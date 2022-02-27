/*
 * Copyright (c) 2014 -     Keith Ha (keith4ever@gmail.com)
 * All content herein is protected by U.S. copyright and other applicable intellectual property laws
 * and may not be copied without the expressive permission of Keith Ha, who reserves all rights.
 * Reuse of any of the content for any purpose without the permission of Keith Ha
 * is strictly and expressively prohibited.
 */

#include <emscripten/em_macros.h>
#include "main.h"

#ifdef __cplusplus
extern "C" {
#endif

#include "libavutil/time.h"

void downloadSuccess(emscripten_fetch_t *fetch) {
    int samplenum = 0;
    switch (gSegInfo->mode) {
        case kDownFirst: {
            jsLog("Finished downloading first %llu bytes", fetch->numBytes);
            // The data is now available at fetch->data[0] through fetch->data[fetch->numBytes-1];
            gSegInfo->numBytes = fetch->numBytes;
#ifdef  ADTS_FORMAT
            getAACSampleNum((unsigned char*)fetch->data, fetch->numBytes);
            gRemuxer->audioCallback((unsigned char *)fetch->data, fetch->numBytes,
                                    gRemuxer->sampleRate, gSegInfo->firstSegNo);
#else
            fillData((unsigned char *) fetch->data, fetch->numBytes);
#endif
            gSegInfo->nextSegNo = gSegInfo->firstSegNo + 1;
            if(gRemuxer->msgCallback)
                gRemuxer->msgCallback(MSG_OPEN_REMUXER, nullptr, 0);
            break;
        }

        case kDownNext:
        default: {
            int currBufferedTime = calcCurrBufferTime(gSegInfo);
            jsLog("[#%d done, %dKB] in queue: %d ms, fifo: %dKB, time: %dms, EndSeg: %d",
                  gSegInfo->nextSegNo, (int) (fetch->numBytes >> 10), gSegInfo->audioBuffMSec,
                  (gRemuxer->availInFifo >> 10), currBufferedTime, gSegInfo->endSeg);
            // The data is now available at fetch->data[0] through fetch->data[fetch->numBytes-1];
            gSegInfo->numBytes = fetch->numBytes;
#ifdef  ADTS_FORMAT
            gRemuxer->audioCallback((unsigned char *)fetch->data, fetch->numBytes,
                                    gRemuxer->sampleRate, gSegInfo->nextSegNo);
#else
            fillData((unsigned char *) fetch->data, fetch->numBytes);
#endif
            gSegInfo->nextSegNo++;
            break;
        }
    }
    gDownRetry = 0;
    gFetchAttr.userData = nullptr;

    emscripten_fetch_close(fetch); // Free data associated with the fetch.
}

void downloadFail(emscripten_fetch_t *fetch) {
    char nextUrl[256];
    gDownRetry++;

    switch (gSegInfo->mode) {
        case kDownFirst:
            jsLog("Downloading #%d failed, HTTP failure status code: %d with url: %s", gSegInfo->firstSegNo, fetch->status, nextUrl);
            av_usleep(500000);
            emscripten_fetch_close(fetch);
            gSegInfo->firstSegNo++;

            sprintf(nextUrl, "%s/%s_%d.%s",
                    gSegInfo->baseUrl, gSegInfo->uuid, gSegInfo->firstSegNo, EXTENSION);

            gFetchAttr.userData = gSegInfo;
            emscripten_fetch(&gFetchAttr, nextUrl);
            break;

        case kDownNext:
        default:
            jsLog("[#%d has failed!] status code: %d",
                  gSegInfo->nextSegNo, fetch->status);
            emscripten_fetch_close(fetch);

            if (gSegInfo->isLive){
                av_usleep(500000);
                if(gDownRetry >= MAX_LIVE_RETRY){
                    jsLog("end reached after retries, segNo: %d, endSegNo: %d", gSegInfo->nextSegNo, gSegInfo->endSeg);
                    if(gRemuxer->msgCallback)
                        gRemuxer->msgCallback(MSG_END_REACHED, nullptr, 0);
                    gRemuxer->errorCode = kErrorCode_EndReached;
                    break;
                }
            } else if(gSegInfo->nextSegNo >= gSegInfo->endSeg-1){
                gSegInfo->nextSegNo = gSegInfo->endSeg + 1;
                break;
            }

            sprintf(nextUrl, "%s/%s_%d.%s",
                        gSegInfo->baseUrl, gSegInfo->uuid, gSegInfo->nextSegNo, EXTENSION);

            emscripten_fetch(&gFetchAttr, nextUrl);
            break;
    }
}

void initDown() {
    emscripten_fetch_attr_init(&gFetchAttr);
    strcpy(gFetchAttr.requestMethod, "GET");
    gFetchAttr.attributes = EMSCRIPTEN_FETCH_LOAD_TO_MEMORY;

    gFetchAttr.timeoutMSecs = 3000;
    gFetchAttr.onsuccess = downloadSuccess;
    gFetchAttr.onerror = downloadFail;
    //gFetchAttr.onprogress = downloadProg;
    gFetchAttr.userData = nullptr;
}

void *downFirst(void *arg) {
    auto seginfo = (MTVsegment *) arg;
    if (seginfo == nullptr) return nullptr;

    char nextUrl[256];

    sprintf(nextUrl, "%s/%s_%d.%s",
            seginfo->baseUrl, seginfo->uuid, seginfo->firstSegNo, EXTENSION);

    gSegInfo->mode = kDownFirst;
    gFetchAttr.userData = seginfo;
    emscripten_fetch(&gFetchAttr, nextUrl);

    return nullptr;
}

void *downNext(void *arg) {
    auto seginfo = (MTVsegment *) arg;
    if (seginfo == nullptr || gFetchAttr.userData != nullptr)
        return nullptr;

#ifndef ADTS_FORMAT
    int currBufferedTime = calcCurrBufferTime(seginfo);
    if (currBufferedTime > BUFF_HIGH_WATERMARK) return nullptr;
#endif
    char nextUrl[256];
    seginfo->mode = kDownNext;

    gFetchAttr.userData = seginfo;
    //jsLog("Next down: %s", nextUrl);
    // set header key:value at gFetchAttr.requestHeaders
    sprintf(nextUrl, "%s/%s_%d.%s",
                seginfo->baseUrl, seginfo->uuid, seginfo->nextSegNo, EXTENSION);

    emscripten_fetch(&gFetchAttr, nextUrl);
    return nullptr;
}

#ifdef __cplusplus
}
#endif
