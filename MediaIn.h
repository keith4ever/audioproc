/*
 * Copyright (c) 2014 -     Keith Ha (keith4ever@gmail.com)
 * All content herein is protected by U.S. copyright and other applicable intellectual property laws
 * and may not be copied without the expressive permission of Keith Ha, who reserves all rights.
 * Reuse of any of the content for any purpose without the permission of Keith Ha
 * is strictly and expressively prohibited.
 */
#ifndef _AC_MEDIA_FILE
#define _AC_MEDIA_FILE

extern "C"
{
#include <strings.h>
#include <libavformat/avformat.h>
#include <libavutil/time.h>
#include <libavcodec/avcodec.h>
}

#include <vector>
#include <assert.h>
#include "defs.h"
#include "MediaPacket.h"

// audio, video, subtitle stream
#define MAX_STREAM_NUM  8

using namespace std;

class MediaIn
{
public:
    MediaIn(SinkConfig* pConfig);
    ~MediaIn();

    bool            Open();
    void            Close();
    unsigned int    GetNumOfStreams() const;
    AVStream**      GetStreams() const;
    int             GetPacket(AVFrame *frame);
    int             GetAudioSampleRate()    { return m_sampleRate; }
    int             GetAudioChannel()       { return m_channel; }
    AVSampleFormat  GetAudioSampleFmt()     { return m_sampleFmt; }
    int64_t         m_iBitrate;

private:
    SinkConfig*     m_pSinkConfig;
    AVFormatContext *m_pFormatContext;
    AVCodecContext* m_pAudioCodecCtx;
    AVRational      m_timebase[MAX_STREAM_NUM];
    int             m_sampleRate;
    AVSampleFormat  m_sampleFmt;
    int             m_channel;


    bool            initFormatContext();
    void            initVars();
};

#endif
