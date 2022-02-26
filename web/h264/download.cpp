//
// Created by keith on 4/21/21.
//
#include <emscripten/em_macros.h>
#include "main.h"

#ifdef __cplusplus
extern "C" {
#endif

#include "libavutil/time.h"

void downloadSuccess(emscripten_fetch_t *fetch) {
    switch (gSegInfo->mode) {
        case kDownFSD: {
            auto tempbuf = (char *) av_mallocz(4096);
            jsLog("Finished downloading FSD file with %llu bytes", fetch->numBytes);
            // The data is now available at fetch->data[0] through fetch->data[fetch->numBytes-1];
            memcpy(tempbuf, fetch->data, MIN(4096, fetch->numBytes));
            av_free(gFetchAttr.userData);

            int start = 0;
            int end = 0;
            char charB;
            for (int i = 0; i < 4096; i++) {
                charB = tempbuf[i];
                if (charB == '{') {
                    start = i;
                } else if (charB == '}') {
                    if (start <= 0 || (i - start) <= 32) continue;
                    end = i;
                    break;
                }
            }

            if (start == 0 || end == 0 || end <= start) {
                jsLog("Error in parsing FSD - start: %d, end: %d", start, end);
                return;
            }
            tempbuf[end + 1] = 0;
            parseFSDBuffer(&tempbuf[start]);
            gFSDDown.fsdlen = (end + 1 - start);
            memcpy(&gFSDDown.fsd[0], &tempbuf[start], gFSDDown.fsdlen);
            av_free(tempbuf);
            if(gFSDDown.fsdCallback)
                ((MessageCallback) gFSDDown.fsdCallback)(MSG_FSD_STRING,
                                    (unsigned char *) gFSDDown.fsd, gFSDDown.fsdlen);
            break;
        }

        case kDownFirst: {
            jsLog("Finished downloading first %llu bytes", fetch->numBytes);
            // The data is now available at fetch->data[0] through fetch->data[fetch->numBytes-1];
            gSegInfo->numBytes[1] = fetch->numBytes;
            fillData((unsigned char *) fetch->data, fetch->numBytes);
            gSegInfo->nextSegNo = gSegInfo->firstSegNo + 1;
            if(gRemuxer->msgCallback)
                gRemuxer->msgCallback(MSG_OPEN_REMUXER, nullptr, 0);
            break;
        }

        case kDownNext:
        default: {
            int currBufferedTime = calcCurrBufferTime(gSegInfo);
            int currSrcIdx = gSegInfo->srcIdx; // srcIdx may change in the meantime, so let's use the value at the moment
            int bDown = gSegInfo->bDown;
            currSrcIdx = (bDown > 0 && (gFSDDown.d1w * gFSDDown.d1h > 0)) ? -1 : currSrcIdx;
            jsLog("[#%d done, %s%dKB] in queue: %d / %dms, fifo: %dKB, time: %dms, EndSeg: %d",
                  gSegInfo->nextSegNo, (char*)((bDown > 0)? "D1, ": ""),
                  (int) (fetch->numBytes >> 10), gSegInfo->audioBuffMSec,
                  gSegInfo->videoBuffMSec, (gRemuxer->availInFifo >> 10),
                  currBufferedTime, gSegInfo->endSeg);
            // The data is now available at fetch->data[0] through fetch->data[fetch->numBytes-1];
            gSegInfo->numBytes[0] = gSegInfo->numBytes[1];
            gSegInfo->numBytes[1] = fetch->numBytes;

            if (gSegInfo->prevSegIdx != currSrcIdx) { // srcIdx just now changed..
                gSegInfo->queueIdxPos.push_back(std::pair<int, int>(gRemuxer->availInFifo, currSrcIdx));
                jsLog("Source changed: %d -> %d, for #%d",
                      gSegInfo->prevSegIdx, currSrcIdx, gSegInfo->nextSegNo);
            }
            gSegInfo->prevSegIdx = currSrcIdx;
            fillData((unsigned char *) fetch->data, fetch->numBytes);
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
        case kDownFSD:
            jsLog("FSD Downloading failed, HTTP failure status code: %d with url: %s", fetch->status, gFetchAttr.userData);
            emscripten_fetch_close(fetch); // Also free data on failure.

            av_usleep(500000);
            emscripten_fetch(&gFetchAttr, (const char*)gFetchAttr.userData);
            break;

        case kDownFirst:
            jsLog("Downloading #%d failed, HTTP failure status code: %d with url: %s", gSegInfo->firstSegNo, fetch->status, nextUrl);
            av_usleep(500000);
            emscripten_fetch_close(fetch);
            gSegInfo->firstSegNo++;

            sprintf(nextUrl, "%s/%s_%d_%d.mkv",
                    gSegInfo->baseUrl, gSegInfo->uuid, gSegInfo->srcIdx, gSegInfo->firstSegNo);
            gSegInfo->bDown = gSegInfo->bAllDown;

            gFetchAttr.userData = gSegInfo;
            emscripten_fetch(&gFetchAttr, nextUrl);
            break;

        case kDownNext:
        default:
            int currSrcIdx = gSegInfo->srcIdx; // srcIdx may change in the meantime, so let's use the value at the moment

            jsLog("[#%d has failed!] srcIdx: %d, status code: %d",
                  gSegInfo->nextSegNo, currSrcIdx, fetch->status);
            emscripten_fetch_close(fetch);

            if (gSegInfo->bDown > 0) gSegInfo->bDown = 0;
            else gSegInfo->bDown = 1;

            if (gSegInfo->isLive){
                av_usleep(500000);
                if(gDownRetry >= MAX_LIVE_RETRY){
                    jsLog("end reached after retries, segNo: %d, endSegNo: %d", gSegInfo->nextSegNo, gSegInfo->endSeg);
                    if(gRemuxer->msgCallback)
                        gRemuxer->msgCallback(MSG_END_REACHED, nullptr, 0);
                    gRemuxer->errorCode = kErrorCode_EndReached;
                    break;
                } else if (gDownRetry >= 3) // if it is live and has failed more than 3 times
                    gSegInfo->srcIdx = (gSegInfo->srcIdx + 1) % (gFSDDown.vnum);
            } else if(gSegInfo->nextSegNo >= gSegInfo->endSeg-1){
                gSegInfo->nextSegNo = gSegInfo->endSeg + 1;
                break;
            }

            if (gSegInfo->bDown > 0) {
                if(gFSDDown.d1w * gFSDDown.d1h > 0)
                    sprintf(nextUrl, "%s/%s_d1_0_%d.mkv",
                            gSegInfo->baseUrl, gSegInfo->uuid, gSegInfo->nextSegNo);
                else
                    sprintf(nextUrl, "%s/%s_d1_%d_%d.mkv",
                            gSegInfo->baseUrl, gSegInfo->uuid, currSrcIdx, gSegInfo->nextSegNo);
            } else
                sprintf(nextUrl, "%s/%s_%d_%d.mkv",
                        gSegInfo->baseUrl, gSegInfo->uuid, currSrcIdx, gSegInfo->nextSegNo);

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

EMSCRIPTEN_KEEPALIVE
void h264fsdDownParse(char *url, int segno, long msgCallback){
    if(gFSDDown.fsdlen > 0) return;

    char *nextUrl;
    gFSDDown.vnum       = 4;
    gFSDDown.duration   = 0;
    gFSDDown.segTerm    = 3000;
    gFSDDown.codec      = 1;
    gFSDDown.fsdCallback = msgCallback;
    initDown();

    char* pos = (char*)strrchr((const char*)url, '/');
    if (pos == NULL) {
        jsLog("wrong stream URL error: %s", url);
        return;
    }
    char *baseUrl   = (char*)malloc(128);
    char *uuid      = (char*)malloc(64);
    strcpy((char*)baseUrl, (const char*)url);
    strcpy((char*)uuid, &pos[1]);
    nextUrl = (char*) av_mallocz(256);
#ifdef  TEST_URL
#ifdef  ADAPTIVE_DYNRESOLUTION
    sprintf(nextUrl, "%s/%s/%s_d1_0_%d.mkv", TEST_URL, uuid, uuid, segno);
#else
    sprintf(nextUrl, "%s/%s/%s_d1_0_%d.mkv", TEST_URL, uuid, uuid, segno);
#endif
    jsLog("test FSD URL: %s", nextUrl);
#else
    sprintf(nextUrl, "%s/%s_d1_0_%d.mkv", baseUrl, uuid, segno);
#endif
    free(uuid);

    gFetchAttr.userData = nextUrl;
    gSegInfo->mode = kDownFSD;
    emscripten_fetch(&gFetchAttr, (const char*)nextUrl);
    jsLog("Trying to download FSD from %s..", nextUrl);
}

void *downFirst(void *arg) {
    auto seginfo = (MTVsegment *) arg;
    if (seginfo == nullptr) return nullptr;

    char nextUrl[256];

    sprintf(nextUrl, "%s/%s_%d_%d.mkv",
            seginfo->baseUrl, seginfo->uuid, seginfo->srcIdx, seginfo->firstSegNo);
    seginfo->bDown = seginfo->bAllDown;

    gSegInfo->mode = kDownFirst;
    gFetchAttr.userData = seginfo;
    emscripten_fetch(&gFetchAttr, nextUrl);

    return nullptr;
}

void *downNext(void *arg) {
    auto seginfo = (MTVsegment *) arg;
    if (seginfo == nullptr || gFetchAttr.userData != nullptr)
        return nullptr;

    int currBufferedTime = calcCurrBufferTime(seginfo);
    if (currBufferedTime > BUFF_HIGH_WATERMARK) return nullptr;

    char nextUrl[256];
    int currSrcIdx = seginfo->srcIdx; // srcIdx may change in the meantime, so let's use the value at the moment
    seginfo->bDown = seginfo->bAllDown;
    if(seginfo->bDown <= 0) seginfo->bDown = (currBufferedTime < BUFF_LOW_WATERMARK);
    seginfo->mode = kDownNext;

    gFetchAttr.userData = seginfo;
    //jsLog("Next down: %s", nextUrl);
    // set header key:value at gFetchAttr.requestHeaders
#if     D1_DEBUG
    if(gFSDDown.d1w * gFSDDown.d1h > 0) // debug instrumentation code
        seginfo->bDown += ((seginfo->nextSegNo % 4 == 3) ? 1 : 0);
#endif
    if (seginfo->bDown > 0) {
        if(gFSDDown.d1w * gFSDDown.d1h > 0)
            sprintf(nextUrl, "%s/%s_d1_0_%d.mkv",
                    seginfo->baseUrl, seginfo->uuid, seginfo->nextSegNo);
        else
            sprintf(nextUrl, "%s/%s_d1_%d_%d.mkv",
                seginfo->baseUrl, seginfo->uuid, currSrcIdx, seginfo->nextSegNo);
    } else
        sprintf(nextUrl, "%s/%s_%d_%d.mkv",
                seginfo->baseUrl, seginfo->uuid, currSrcIdx, seginfo->nextSegNo);

    emscripten_fetch(&gFetchAttr, nextUrl);
    return nullptr;
}

#ifdef __cplusplus
}
#endif
