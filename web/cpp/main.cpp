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
RemuxState  gRemuxState = kStateStop;

//////////////////////////////////Export methods////////////////////////////////////////
ErrorCode initRemuxer(unsigned char* url, int startSec) {
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
        gSegInfo->firstSegNo = startSec;
        gSegInfo->isLive    = true;
        gRemuxer->firstDTS  = gRemuxer->readDTS   = -1;
#ifndef  ADTS_FORMAT
        gRemuxer->audioBuffer = (unsigned char *) av_mallocz(PCM_BUFFER_SIZE);
        gRemuxer->audBuffSize = PCM_BUFFER_SIZE;
        jsLog("Initial PCM buffer size %d.", gRemuxer->audBuffSize);
#endif
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

        jsLog("Init remuxer, UUID: %s, firstSeg: %d", gSegInfo->uuid, gSegInfo->firstSegNo);
        ret = kErrorCode_Success;
        gRemuxState = kStateInit;
    } while (0);
    //jsLog("Remuxer initialized %d.", ret);

    return ret;
}

ErrorCode deinitRemuxer(int bRevisit) {
    ErrorCode ret = kErrorCode_Success;
    do {
        if (gRemuxer == nullptr || bRevisit > 0) {
            break;
        }
        else if(!(gRemuxState == kStatePause || gRemuxState == kStatePlay))
            break;

        gRemuxState = kStateStop;

#ifndef  ADTS_FORMAT
        freeInputContext(gRemuxer);
        //jsLog("Input closed.");

        if (gRemuxer->audioBuffer != nullptr) {
            av_freep(&gRemuxer->audioBuffer);
            gRemuxer->audioBuffer = nullptr;
            gRemuxer->audBuffSize = 0;
            gRemuxer->currAudBufPos = 0;
        }

        if (gRemuxer->fifo != nullptr) {
            av_fifo_freep(&gRemuxer->fifo);
        }
#endif
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

ErrorCode setCallBack(long audioCallback, long msgCallback) {
    if(gRemuxer == nullptr) return kErrorCode_Invalid_Data;

    gRemuxer->audioCallback = (AudioCallback) audioCallback;
    gRemuxer->msgCallback   = (MessageCallback) msgCallback;
    jsLog("Callback setup..");
    return kErrorCode_Success;
}

ErrorCode openRemuxer() {
    ErrorCode ret = kErrorCode_Success;

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
#ifndef  ADTS_FORMAT
        openInputContext(gRemuxer);
#endif
        gRemuxState = kStatePlay;
    } while (0);

    if (ret != kErrorCode_Success && gRemuxer != nullptr) {
        av_freep(&gRemuxer);
        gRemuxer = nullptr;
    }
    return ret;
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
