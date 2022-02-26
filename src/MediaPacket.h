/*
 * Copyright (c) 2014 -     Keith Ha (keith4ever@gmail.com)
 * All content herein is protected by U.S. copyright and other applicable intellectual property laws
 * and may not be copied without the expressive permission of Keith Ha, who reserves all rights.
 * Reuse of any of the content for any purpose without the permission of Keith Ha
 * is strictly and expressively prohibited.
 */

#ifndef VIDEOENGINE_MEDIAPACKET_H
#define VIDEOENGINE_MEDIAPACKET_H

extern "C"
{
#include <libavcodec/avcodec.h>
}

#include <iostream>
#include "defs.h"

using namespace std;

enum GetPacketReturn {
    PKT_NOREF = 0,
    PKT_NOTSTART,
    PKT_SUCCESS,
    PKT_ENDOFFILE,
    PKT_AFTEREND,
    PKT_NONE_AV,
    PKT_MOREPACKET
};

class ACMediaPacket
{
public:
    ACMediaPacket();
    ~ACMediaPacket();

    AVPacket    avpacket;
    void        Reset();
    void        Unref();
    void        Copy(ACMediaPacket *pPkt);
};

#endif //VIDEOENGINE_MEDIAPACKET_H
