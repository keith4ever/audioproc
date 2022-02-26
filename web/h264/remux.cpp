//
// Created by keith on 4/10/21.
//
#include <emscripten/em_macros.h>
#include "main.h"

#ifdef __cplusplus
extern "C" {
#endif

#include "libavutil/time.h"

#define AUDIO_FLUSH_TERM    250
#define VIDEO_FLUSH_TERM    250

int gDownRetry = 0;

void    flushVideoStream(){
    int strIdx = gRemuxer->vIdx;
    av_write_frame(gRemuxer->ofmtCtxt, nullptr); // flushing
    if(gRemuxer->oBuffData <= 0) return;

    if(gRemuxer->errorCode == 0 || gRemuxer->errorCode == kErrorCode_EndReached) {
        gRemuxer->videoCallback(gRemuxer->outBuffer, gRemuxer->oBuffData,
                                gRemuxer->availInFifo, gRemuxer->readDTS[strIdx]);
    }
    gRemuxer->oBuffPtr = gRemuxer->outBuffer;
    gRemuxer->oBuffData = 0;
    gRemuxer->firstDTS[strIdx] = gRemuxer->readDTS[strIdx];
}

ErrorCode procAudioPacket(AVPacket* packet){
    uint16_t frame_length = packet->size + 7;
    int strIdx = gRemuxer->aIdx;
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
    gRemuxer->readDTS[strIdx] = packet->dts;

    av_packet_unref(packet);
    gRemuxer->writtenPktNum[strIdx]++;

    if(gRemuxer->readDTS[strIdx] - gRemuxer->firstDTS[strIdx] >= AUDIO_FLUSH_TERM){
        gRemuxer->audioCallback(gRemuxer->audioBuffer, gRemuxer->currAudBufPos,
                                gRemuxer->availInFifo, gRemuxer->readDTS[strIdx]);
        gRemuxer->currAudBufPos = 0;
        gRemuxer->firstDTS[strIdx] = gRemuxer->readDTS[strIdx];
    }
    return kErrorCode_Success;
}

ErrorCode procVideoPacket(AVPacket* packet) {
    int strIdx = gRemuxer->vIdx;
    if(packet->size <= 0 || packet->data == nullptr){
        jsLog("[%d] packet skipped, size: %d", strIdx, packet->size);
        av_packet_unref(packet);
        return kErrorCode_Success;
    }

    if (packet->dts == AV_NOPTS_VALUE) {
        /* HACK: the first two packets after seeking or after starting
         to read have negative dts. I don't know why.
         so dts is adjusted by -2*duration from pts */
        packet->dts =  (gRemuxer->readDTS[strIdx] == AV_NOPTS_VALUE ) ?
                       (packet->pts -2 * (int64_t)1000/gSegInfo->fps)
                      : gRemuxer->readDTS[strIdx] + (1000/gSegInfo->fps);
        jsLog("auto generated dts: %lld, size: %d", packet->dts, packet->size);
    } else if(packet->dts <= gRemuxer->readDTS[strIdx]){
        jsLog("[%d] packet DTS, prev: %lld, dts: %lld",
              strIdx, gRemuxer->readDTS[strIdx], packet->dts);
        av_packet_unref(packet);
        return kErrorCode_Success;
    }

    /* for fragmented MP4, the sum of video packet duration has to be
     accurate enough.. it seems the player doesn't refer to DTS, but
     refer to duration value instead */
    gRemuxer->readDTS[strIdx] = packet->dts;
    av_packet_rescale_ts(packet,
                         gRemuxer->ifmtCtxt->streams[strIdx]->time_base,
                         gRemuxer->ofmtCtxt->streams[strIdx]->time_base);
    packet->pos = -1;
    if(packet->duration <= 0){
        packet->duration = (int64_t)1000/gSegInfo->fps;
        jsLog("[%d] negative duration:%lld, dts: %lld, pts: %lld",
              strIdx, packet->duration, packet->dts, packet->pts);
    }

    int ret;
    if ((ret = av_interleaved_write_frame(gRemuxer->ofmtCtxt, packet)) < 0) {
        jsLog("****[%d] Error occurred when writing a packet(ret=%d)", strIdx, ret);
        av_packet_unref(packet);
        return kErrorCode_Invalid_Data;
    }

    av_packet_unref(packet);
    gRemuxer->writtenPktNum[strIdx]++;

    if(gRemuxer->readDTS[strIdx] - gRemuxer->firstDTS[strIdx] >= VIDEO_FLUSH_TERM){
        flushVideoStream();
    }
    return kErrorCode_Success;
}

EMSCRIPTEN_KEEPALIVE
int h264downloadSegment(){
    if(gRemuxer == nullptr || gRemuxState != kStatePlay)
        return gSegInfo->nextSegNo;

    if(calcCurrBufferTime(gSegInfo) > BUFF_HIGH_WATERMARK)
        return gSegInfo->nextSegNo;

    bool isDownloading = gFetchAttr.userData != nullptr;
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
            av_usleep(1000000);
            jsLog("end reached, retry#%d segNo: %d, endSegNo: %d", gDownRetry, gSegInfo->nextSegNo, gSegInfo->endSeg);
        }
    }

    if(!isDownloading) downNext((void*)gSegInfo);
    return gSegInfo->nextSegNo;
}

int h264readWrite(int aQueueMs, int vQueueMs) {
    AVPacket srcpacket;
    int ret = 0;
    int64_t currDTS = 0;

    if(gRemuxer == nullptr) return 0;

    gSegInfo->audioBuffMSec = aQueueMs;
    gSegInfo->videoBuffMSec = vQueueMs;

    int numpackets = 0;
    do{
        if (gRemuxState != kStatePlay || gRemuxer->availInFifo <= (256 << 10)
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
                avformat_seek_file(gRemuxer->ifmtCtxt, gRemuxer->aIdx,
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

        // video
        if (srcpacket.stream_index == gRemuxer->vIdx) {
            if(gRemuxer->writtenPktNum[gRemuxer->vIdx] <= 0){
                gRemuxer->vFirstPTSOffset = srcpacket.pts;
                gRemuxer->firstDTS[gRemuxer->vIdx] = srcpacket.pts;
                jsLog("first PTS offset: %lld, flags: %d", srcpacket.pts, srcpacket.flags);
            }
            if((srcpacket.flags & AV_PKT_FLAG_KEY) != 0){
                if(gRemuxer->errorCode != 0 && gRemuxer->errorCode != kErrorCode_EndReached){
                    flushVideoStream();
                    // to recover from faulty stream, it has to start with key frame with
                    // stream header..
                    gRemuxer->errorCode = 0;
                    avformat_write_header(gRemuxer->ofmtCtxt, &gRemuxer->avoptions);
                    jsLog("rewriting stream header after error");
                }
                if(gSegInfo->queueIdxPos.size() > 0 && gSegInfo->queueIdxPos.front().first < 0 ){
                    /* we need to offset the pts value by the very first one
                     as HTML5 player metadata mediaTime
                     (from requestVideoFrameCallback parameter) will have always 0 and then add
                     delta value to subsequent frames. */
                    gRemuxer->idxCallback(gRemuxer->writtenPktNum[gRemuxer->vIdx],
                                          (int)(srcpacket.pts - gRemuxer->vFirstPTSOffset),
                                          gSegInfo->queueIdxPos.front().second);
                    gSegInfo->queueIdxPos.pop_front();
                }
            }
            procVideoPacket(&srcpacket);
            break;
        } else if(srcpacket.stream_index == gSegInfo->srcIdx+1) { // unless it's same as the current srcIdx
            procAudioPacket(&srcpacket);
        } else {
            av_packet_unref(&srcpacket);
        }
    }while(true);

    return gRemuxer->availInFifo;
}

void h264setError(int code){
    if(gRemuxer == nullptr || gRemuxer->errorCode != 0) return;
    gRemuxer->errorCode = code;
}
#ifdef __cplusplus
}
#endif
