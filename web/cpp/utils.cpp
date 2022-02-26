//
// Created by keith on 3/5/21.
//
#include "main.h"
#include <thread>

#ifdef __EMSCRIPTEN_PTHREADS__
#warning "__EMSCRIPTEN_PTHREADS__ is enabled.."
#endif

#ifdef __cplusplus
extern "C" {
#endif

unsigned long getTickCount() {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return ts.tv_sec * (unsigned long) 1000 + ts.tv_nsec / 1000000;
}

void jsLog(const char *format, ...) {
    if (logLevel == kLogLevel_None) {
        return;
    }

    char szBuffer[1024] = {0};
    char szTime[32] = {0};
    char *p = NULL;
    int prefixLength = 0;
    const char *tag = "WASM";
    struct tm tmTime;
    struct timeb tb;

    ftime(&tb);
    localtime_r(&tb.time, &tmTime);

    int tmHour = tmTime.tm_hour;
    int tmMin = tmTime.tm_min;
    int tmSec = tmTime.tm_sec;
    int tmMillisec = tb.millitm;
    sprintf(szTime, "%02d:%02d:%02d.%03d", tmHour, tmMin, tmSec, tmMillisec);

    prefixLength = sprintf(szBuffer, "[%s: %s] ", tag, szTime);
    p = szBuffer + prefixLength;

    if (1) {
        va_list ap;
        va_start(ap, format);
        vsnprintf(p, 1024 - prefixLength, format, ap);
        va_end(ap);
    }

    printf("%s\n", szBuffer);
}

void logCallback(void *ptr, int level, const char *fmt, va_list vl) {
    static int printPrefix = 1;
    static int count = 0;
    static char prev[1024] = {0};
    char line[1024] = {0};
    static int is_atty;
    AVClass *avc = ptr ? *(AVClass **) ptr : NULL;
    if (level > AV_LOG_DEBUG) {
        return;
    }

    line[0] = 0;

    if (printPrefix && avc) {
        if (avc->parent_log_context_offset) {
            AVClass **parent = *(AVClass ***) (((uint8_t *) ptr) + avc->parent_log_context_offset);
            if (parent && *parent) {
                snprintf(line, sizeof(line), "[%s @ %p] ", (*parent)->item_name(parent), parent);
            }
        }
        snprintf(line + strlen(line), sizeof(line) - strlen(line), "[%s @ %p] ", avc->item_name(ptr), ptr);
    }

    vsnprintf(line + strlen(line), sizeof(line) - strlen(line), fmt, vl);
    line[strlen(line) + 1] = 0;
    jsLog("%s", line);
}
int getSampleRateIdx(int samplerate){
    int ret = 0;
    switch (samplerate) {
        case 96000:
            ret = 0;
            break;
        case 88200:
            ret = 1;
            break;
        case 64000:
            ret = 2;
            break;
        case 48000:
            ret = 3;
            break;
        case 44100:
            ret = 4;
            break;
        case 32000:
            ret = 5;
            break;
        case 24000:
            ret = 6;
            break;
        case 22050:
            ret = 7;
            break;
        case 16000:
            ret = 8;
            break;
        case 12000:
            ret = 9;
            break;
        case 11025:
            ret = 10;
            break;
        case 8000:
            ret = 11;
            break;
        case 7350:
            ret = 12;
            break;
        default:
            ret = 0;
            break;
    }
    return ret;
}

int readData(WebRemuxer *decoder, uint8_t *data, int len) {
    int32_t ret = -1;
    int canReadLen = 0, bytesPos;

    do {
        if (decoder->fifo == NULL) {
            break;
        }

        bytesPos = av_fifo_size(decoder->fifo);
        if (bytesPos <= 0) {
            break;
        }

        canReadLen = MIN(decoder->availInFifo, len);
        av_fifo_generic_read(decoder->fifo, data, canReadLen, NULL);
        decoder->availInFifo = av_fifo_size(decoder->fifo);
        bytesPos -= decoder->availInFifo; // # of bytes consumed
        ret = canReadLen;
    } while (false);
    //jsLog("readData ret %d, left %d.", ret, av_fifo_size(gRemuxer->fifo));
    return ret;
}

int readCallback(void *opaque, uint8_t *data, int len) {
    auto decoder = (WebRemuxer*) opaque;
    int32_t ret = -1;
    do {
        if (decoder == nullptr) {
            break;
        }

        if (data == NULL || len <= 0) {
            break;
        }

        ret = readData(decoder, data, len);
    } while (0);
    //jsLog("readCallback ret %d.", ret);
    return ret;
}

int64_t seekCallback(void *opaque, int64_t offset, int whence) {
    int64_t req_pos = -1;
    //jsLog("seekCallback %lld %d.", offset, whence);

    return req_pos;
}

void freeInputContext(WebRemuxer* remuxer) {
    if(remuxer->ifmtCtxt == nullptr) return;
    if (remuxer->ifmtCtxt->pb != nullptr) {
        if (remuxer->ifmtCtxt->pb->buffer != nullptr) {
            av_freep(&remuxer->ifmtCtxt->pb->buffer);
            remuxer->inputBuffer = nullptr;
        }
        av_freep(&remuxer->ifmtCtxt->pb);
    }

    avformat_close_input(&remuxer->ifmtCtxt);
    avformat_free_context(remuxer->ifmtCtxt);
    remuxer->ifmtCtxt = nullptr;
}

int openInputContext(WebRemuxer* remuxer) {
    int ret = kErrorCode_Success;

    freeInputContext(remuxer);
    remuxer->ifmtCtxt = avformat_alloc_context();
    remuxer->inputBuffer = (unsigned char *) av_mallocz(CUSTIO_BUFF_SIZE);

    AVIOContext *ioContext = avio_alloc_context(
            gRemuxer->inputBuffer, CUSTIO_BUFF_SIZE, 0, remuxer,
            readCallback, nullptr, seekCallback);

    if (ioContext == nullptr) {
        ret = kErrorCode_FFmpeg_Error;
        jsLog("avio_alloc_context failed.");
        return ret;
    }

    remuxer->ifmtCtxt->pb = ioContext;
    remuxer->ifmtCtxt->flags = AVFMT_FLAG_CUSTOM_IO;
    int r = 0;
    int i = 0;

    r = avformat_open_input(&remuxer->ifmtCtxt, nullptr, nullptr, nullptr);
    if (r != 0) {
        ret = kErrorCode_FFmpeg_Error;
        char err_info[32] = {0};
        av_strerror(ret, err_info, 32);
        jsLog("avformat_open_input failed %d %s.", ret, err_info);
        return ret;
    }

    r = avformat_find_stream_info(remuxer->ifmtCtxt, nullptr);
    if (r != 0) {
        ret = kErrorCode_FFmpeg_Error;
        jsLog("av_find_stream_info failed %d.", ret);
        return ret;
    }

    for (i = 0; i < remuxer->ifmtCtxt->nb_streams; i++) {
        remuxer->ifmtCtxt->streams[i]->discard = AVDISCARD_DEFAULT;
    }

    int avret = av_find_best_stream(remuxer->ifmtCtxt, AVMEDIA_TYPE_AUDIO,
                                -1, -1, nullptr, 0);
    if (avret < 0) {
        jsLog("Could not find %s stream.", av_get_media_type_string(AVMEDIA_TYPE_AUDIO));
        return ret;
    }
    remuxer->aIdx = 0;

    return ret;
}

int roundUp(int numToRound, int multiple) {
    return (numToRound + multiple - 1) & -multiple;
}

int calcCurrBufferTime(MTVsegment* seginfo){
    int currBufferedTime;
    if(seginfo->numBytes[0] <= 0 && seginfo->numBytes[1] <= 0)
        currBufferedTime = BUFF_LOW_WATERMARK + 1000;
    else {
        int buffTime = seginfo->audioBuffMSec;
        currBufferedTime = buffTime + (2000  * (int64_t)gRemuxer->availInFifo)
                            / (seginfo->numBytes[0] + seginfo->numBytes[1]);
    }
    return currBufferedTime;
}

#ifdef __cplusplus
}
#endif
