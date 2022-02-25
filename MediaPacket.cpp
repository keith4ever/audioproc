/*
 * Copyright (c) 2014 -     AlcaCruz Inc.
 * All content herein is protected by U.S. copyright and other applicable intellectual property laws
 * and may not be copied without the expressive permission of AlcaCruz Inc., which reserves all rights.
 * Reuse of any of the content for any purpose without the permission of AlcaCruz Inc.
 * is strictly and expressively prohibited.
 */

#include "MediaPacket.h"

//=========== ACMediaPacket =================

ACMediaPacket::ACMediaPacket() {
    Reset();
}

void ACMediaPacket::Reset() {
    memset(this, 0, sizeof(ACMediaPacket));
}

void ACMediaPacket::Unref() {
    if(!(avpacket.buf == NULL || avpacket.size <= 0))
        av_packet_unref(&avpacket);
    Reset();
}

void ACMediaPacket::Copy(ACMediaPacket *pPkt) {
    Reset();
    // av_packet_ref() makes duplicates of data, side_data,
    // and all other field value is replaced by the source
    av_packet_ref(&avpacket, &pPkt->avpacket);
}

ACMediaPacket::~ACMediaPacket() {

}
