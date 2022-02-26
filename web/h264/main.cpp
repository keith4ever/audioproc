#include "main.h"

#ifdef __cplusplus
extern "C" {
#endif

#include <string.h>
#include "libavutil/time.h"

MTVsegment *gSegInfo = nullptr;
WebRemuxer *gRemuxer = nullptr;
#ifdef  LOG_SILENCE
LogLevel    logLevel = kLogLevel_None;
#else
LogLevel    logLevel = kLogLevel_Core;
#endif
emscripten_fetch_attr_t gFetchAttr;
int numCPUcores     = 8;
RemuxState  gRemuxState = kStateStop;
FSDDownload gFSDDown;

//////////////////////////////////Export methods////////////////////////////////////////
ErrorCode h264initRemuxer(unsigned char* url, int startSec, int srcIdx,
                          int numcores, int bAllDown) {
    ErrorCode ret = kErrorCode_Invalid_Data;
    do {
        if (gRemuxer != nullptr || gRemuxState != kStateStop) {
            jsLog("Remuxer instance is not null..");
            break;
        }
        avformat_network_init();

        gRemuxer            = (WebRemuxer *) av_mallocz(sizeof(WebRemuxer));
        gSegInfo            = (MTVsegment *) av_mallocz(sizeof(MTVsegment));
        memset(gRemuxer, 0, sizeof(WebRemuxer));
        memset(gSegInfo, 0, sizeof(MTVsegment));
        gRemuxer->fifoSize  = DEFAULT_FIFO_SIZE;
        gRemuxer->fifo      = av_fifo_alloc(gRemuxer->fifoSize);

        // 3sec is just the default for now
        gSegInfo->firstSegNo = (startSec / (gFSDDown.segTerm/1000));
        srcIdx              = MIN(srcIdx, 3);
        gSegInfo->srcIdx    = srcIdx;
        gSegInfo->prevSegIdx = srcIdx;
        gSegInfo->bAllDown  = (bAllDown > 0) ? 1 : 0;
        numCPUcores         = numcores;
        gRemuxer->readDTS[1] = gRemuxer->readDTS[0] = AV_NOPTS_VALUE;

        gRemuxer->audioBuffer = (unsigned char *) av_mallocz(PCM_BUFFER_SIZE);
        gRemuxer->audBuffSize = PCM_BUFFER_SIZE;
        jsLog("Initial PCM buffer size %d.", gRemuxer->audBuffSize);

        char* pos = (char*)strrchr((const char*)url, '/');
        if (pos == nullptr) {
            jsLog("wrong stream URL error: %s", url);
            return ret;
        }
        gSegInfo->baseUrl   = (unsigned char*)malloc(128);
        gSegInfo->uuid      = (unsigned char*)malloc(64);
        strcpy((char*)gSegInfo->baseUrl, (const char*)url);
        strcpy((char*)gSegInfo->uuid, &pos[1]);
#ifdef  TEST_URL
        sprintf((char*)gSegInfo->baseUrl, "%s/%s", TEST_URL, gSegInfo->uuid);
        jsLog("test URL: %s", gSegInfo->baseUrl);
#endif

        initDown();
        gFetchAttr.userData = gSegInfo;
        downFirst((void*) gSegInfo);

        jsLog("Init remuxer, UUID: %s, firstSeg: %d, Idx: %d, AllDown: %d",
              gSegInfo->uuid, gSegInfo->firstSegNo, gSegInfo->srcIdx, gSegInfo->bAllDown);
        ret = kErrorCode_Success;
        gRemuxState = kStateInit;
    } while (0);
    //jsLog("Remuxer initialized %d.", ret);

    return ret;
}

ErrorCode h264deinitRemuxer(int bRevisit) {
    ErrorCode ret = kErrorCode_Success;
    do {
        if (gRemuxer == nullptr || bRevisit > 0) {
            break;
        }
        else if(!(gRemuxState == kStatePause || gRemuxState == kStatePlay))
            break;

        gRemuxState = kStateStop;

        freeInputContext(gRemuxer);
        //jsLog("Input closed.");

        if(gRemuxer->ofmtCtxt != nullptr) {
            av_write_trailer(gRemuxer->ofmtCtxt);
            if (gRemuxer->ofmtCtxt->pb) {
                av_free(gRemuxer->ofmtCtxt->pb);
                gRemuxer->ofmtCtxt->pb = nullptr;
            }
            avformat_free_context(gRemuxer->ofmtCtxt);
            gRemuxer->ofmtCtxt = nullptr;
        }

        if (gRemuxer->outBuffer != nullptr) {
            av_freep(&gRemuxer->outBuffer);
            gRemuxer->outBuffer = nullptr;
            av_freep(&gRemuxer->streamBuffer);
            gRemuxer->streamBuffer = nullptr;
        }

        if (gRemuxer->audioBuffer != nullptr) {
            av_freep(&gRemuxer->audioBuffer);
            gRemuxer->audioBuffer = nullptr;
            gRemuxer->audBuffSize = 0;
            gRemuxer->currAudBufPos = 0;
        }

        if (gRemuxer->fifo != nullptr) {
            av_fifo_freep(&gRemuxer->fifo);
        }
        free(gSegInfo->baseUrl);
        free(gSegInfo->uuid);
        av_freep(&gSegInfo);
        gSegInfo = nullptr;
        av_freep(&gRemuxer);
        gRemuxer = nullptr;
        jsLog("Remuxer destroyed..");
    } while (0);

    av_log_set_callback(nullptr);

    return kErrorCode_Success;
}

ErrorCode h264setCallBack(long videoCallback, long audioCallback,
                          long msgCallback, long idxCallback) {
    if(gRemuxer == nullptr) return kErrorCode_Invalid_Data;

    gRemuxer->videoCallback = (VideoCallback) videoCallback;
    gRemuxer->audioCallback = (AudioCallback) audioCallback;
    gRemuxer->msgCallback   = (MessageCallback) msgCallback;
    gRemuxer->idxCallback   = (SrcIdxCallback) idxCallback;
    jsLog("Callback setup..");
    return kErrorCode_Success;
}

ErrorCode h264openRemuxer(int *paramArray, int paramCount) {
    ErrorCode ret = kErrorCode_Success;
    int params[6] = {0};
    do {
        if(gRemuxState != kStateInit)
            break;

        if (logLevel == kLogLevel_All) {
            av_log_set_callback(logCallback);
        }

        if(gSegInfo->nextSegNo == 0){ // uuid content doesn't exist..
            gRemuxer->msgCallback(MSG_UUID_NOTFOUND, nullptr, 0);
            ret = kErrorCode_Open_File_Error;
            jsLog("video with the UUID doesn't exist");
            break;
        }
        openInputContext(gRemuxer);
        AVStream* inputStream = gRemuxer->ifmtCtxt->streams[gRemuxer->vIdx];
        gFSDDown.width = inputStream->codecpar->width;
        gFSDDown.height = inputStream->codecpar->height;

        sendFSD(gRemuxer->ifmtCtxt);

        openOutputContext(gRemuxer);
        AVStream* outputStream = gRemuxer->ofmtCtxt->streams[gRemuxer->vIdx];
        jsLog("Input time: %d, %d", inputStream->time_base.den, inputStream->time_base.num);
        jsLog("Ouput time: %d, %d", outputStream->time_base.den, outputStream->time_base.num);
        params[0] = gFSDDown.duration;

        AVRational                              fps = inputStream->time_base;
        if(fps.den <= 1 || fps.num < fps.den)   fps = inputStream->avg_frame_rate;

        gSegInfo->endSeg = (gFSDDown.duration / gFSDDown.segTerm);
        gSegInfo->fps = (int)(fps.num/fps.den);
        params[1] = (int)(fps.num/fps.den);
        params[2] = gFSDDown.vnum;
        params[3] = gFSDDown.segTerm;
        params[4] = gFSDDown.width;
        params[5] = gFSDDown.height;

        if (paramArray != nullptr && paramCount > 0) {
            for (int i = 0; i < paramCount; ++i) {
                paramArray[i] = params[i];
            }
        }

        gRemuxState = kStatePlay;
        jsLog("Remuxer opened, duration %ds.", params[0]);
    } while (0);

    if (ret != kErrorCode_Success && gRemuxer != nullptr) {
        av_freep(&gRemuxer);
        gRemuxer = nullptr;
    }
    return ret;
}

void h264changeSrcIdx(int idx){
    if(gSegInfo == nullptr || idx < 0 || idx > gFSDDown.vnum-1) return;

    gSegInfo->srcIdx = idx;
}

void h264changeLiveEndSeg(int seg){
    gSegInfo->endSeg = seg;
}

int fillData(unsigned char *buff, int size) {
    int ret = 0;

    do {
        if (buff == nullptr || size == 0) {
            ret = -1;
            break;
        }

        if (gRemuxer->fifo == nullptr) {
            ret = -1;
            break;
        }

        int64_t leftSpace = av_fifo_space(gRemuxer->fifo);
        if (leftSpace < size) {
            int growSize = 0;
            do {
                leftSpace += gRemuxer->fifoSize;
                growSize += gRemuxer->fifoSize;
                gRemuxer->fifoSize += gRemuxer->fifoSize;
            } while (leftSpace < size);
            av_fifo_grow(gRemuxer->fifo, growSize);

            jsLog("Fifo size grew to %d.", gRemuxer->fifoSize);
            if (gRemuxer->fifoSize >= MAX_FIFO_SIZE) {
                jsLog("[Warn] Fifo size larger than %d.", MAX_FIFO_SIZE);
            }
        }

        //jsLog("Wrote %d bytes to fifo, total %d.", size, av_fifo_size(gRemuxer->fifo));
        ret = av_fifo_generic_write(gRemuxer->fifo, buff, size, nullptr);
        gRemuxer->availInFifo = av_fifo_size(gRemuxer->fifo);
    } while (0);

    return ret;
}

#ifdef __cplusplus
}
#endif
