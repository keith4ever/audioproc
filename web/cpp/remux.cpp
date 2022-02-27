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

#define AUDIO_FLUSH_TERM    100

int gDownRetry = 0;

ErrorCode procAudioPacket(AVPacket* packet){
    uint16_t frame_length = packet->size + 7;
    unsigned char *adts_header = &gRemuxer->audioBuffer[gRemuxer->currAudBufPos];

    /* from:
     https://stackoverflow.com/questions/32598792/ffmpeg-duration-of-audio-file-is-inaccurate
     or https://titanwolf.org/Network/Articles/Article?AID=044645c8-489a-4fff-be7b-4a8c32deafed#gsc.tab=0
     */
    adts_header[0] = 0xFF;
    adts_header[1] = 0xF9;
    adts_header[2] = 1 << 6;
    adts_header[2] |= (gRemuxer->aRateIdx << 2);
    adts_header[2] |= (gRemuxer->aChannels & 0x4) >> 2;
    adts_header[3] = (gRemuxer->aChannels & 0x3) << 6;
    adts_header[3] |= (frame_length) >> 11;
    adts_header[4] = (frame_length & 0x7FF) >> 3;
    adts_header[5] = ((frame_length & 0x7) << 5) + 0x1F;
    adts_header[6] = 0xFC;

    memcpy(&adts_header[7], packet->data, packet->size);
    gRemuxer->currAudBufPos += (packet->size + 7);
    gRemuxer->readDTS = packet->dts;

    av_packet_unref(packet);
    gRemuxer->writtenPktNum++;

    if(gRemuxer->firstDTS < 0) gRemuxer->firstDTS = gRemuxer->readDTS;
    if(gRemuxer->readDTS - gRemuxer->firstDTS >= AUDIO_FLUSH_TERM){
        jsLog("Sending %d", gRemuxer->currAudBufPos);
        gRemuxer->audioCallback(gRemuxer->audioBuffer, gRemuxer->currAudBufPos,
                                gRemuxer->availInFifo, gRemuxer->readDTS);
        gRemuxer->currAudBufPos = 0;
        gRemuxer->firstDTS = gRemuxer->readDTS;
    }
    return kErrorCode_Success;
}

EMSCRIPTEN_KEEPALIVE
int downloadSegment(int aQueueMs){
    if(gRemuxer == nullptr || gRemuxState != kStatePlay)
        return gSegInfo->nextSegNo;

    gSegInfo->audioBuffMSec = aQueueMs;
    bool isDownloading = gFetchAttr.userData != nullptr;
#ifndef ADTS_FORMAT
    if(calcCurrBufferTime(gSegInfo) > BUFF_HIGH_WATERMARK)
        return gSegInfo->nextSegNo;

    if(!gSegInfo->isLive && gSegInfo->endSeg < gSegInfo->nextSegNo){
        jsLog("end reached, segNo: %d", gSegInfo->nextSegNo);
        return -1;
    }
    // Live
    else if(gSegInfo->isLive &&!isDownloading
        && gSegInfo->nextSegNo > gSegInfo->endSeg && gSegInfo->endSeg > 0){
        if(gDownRetry >= MAX_LIVE_RETRY){
            jsLog("end reached after retries, segNo: %d, endSegNo: %d", gSegInfo->nextSegNo, gSegInfo->endSeg);
            if(gRemuxer->msgCallback)
                gRemuxer->msgCallback(MSG_END_REACHED, nullptr, 0);
            gRemuxer->errorCode = kErrorCode_EndReached;
            return -1;
        }
        else {
            av_usleep(300000);
            jsLog("end reached, retry#%d segNo: %d, endSegNo: %d", gDownRetry, gSegInfo->nextSegNo, gSegInfo->endSeg);
        }
    }
#endif

    if(!isDownloading) downNext((void*)gSegInfo);
    return gSegInfo->nextSegNo;
}

int readWrite(int aQueueMs) {
#ifndef  ADTS_FORMAT
    AVPacket srcpacket;
    int ret = 0;
    int64_t currDTS = 0;

    if(gRemuxer == nullptr) return 0;

    gSegInfo->audioBuffMSec = aQueueMs;

    int numpackets = 0;
    do{
        if (gRemuxState != kStatePlay || gRemuxer->availInFifo <= gSegInfo->numBytes
            || numpackets++ > 2){
            if(gRemuxer->errorCode != kErrorCode_EndReached)
                break;
        }

        ret = av_read_frame(gRemuxer->ifmtCtxt, &srcpacket);
        if (ret >= 0) { // all is good, won't try to get next file
            currDTS = srcpacket.dts;
            if (ret > 0)
                jsLog("[ff_play, ff_read] :: av_read_frame size: %d\n", srcpacket.size);
        } else {
            if (ret == AVERROR_EOF) {
                if(gRemuxer->errorCode == kErrorCode_EndReached) break;
                jsLog("[E/ff_play, read_thread] :: av_read_frame ret AVERROR_EOF, %d bytes\n",
                      gRemuxer->availInFifo);
                // keep on going.. these two func calls will reset AVERROR_EOF status
                avio_seek(gRemuxer->ifmtCtxt->pb, 0, SEEK_SET);
                avformat_seek_file(gRemuxer->ifmtCtxt, 0,
                            0, 0, currDTS, 0);
                av_usleep(3000);
            }
            else if (ret != 0)
                jsLog("[E/ff_play, read_thread] :: av_read_frame ret error (%d)\n", ret);
        }

        if (ret < 0) {
            av_packet_unref(&srcpacket);
            break;
        }
        if(srcpacket.stream_index == 0) {
            procAudioPacket(&srcpacket);
        } else {
            av_packet_unref(&srcpacket);
        }
    }while(true);

    return gRemuxer->availInFifo;
#else
    return 0;
#endif
}

void setError(int code){
    if(gRemuxer == nullptr || gRemuxer->errorCode != 0) return;
    gRemuxer->errorCode = code;
}
#ifdef __cplusplus
}
#endif
