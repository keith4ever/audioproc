/*
 * Copyright (c) 2014 -     Keith Ha (keith4ever@gmail.com)
 * All content herein is protected by U.S. copyright and other applicable intellectual property laws
 * and may not be copied without the expressive permission of Keith Ha, who reserves all rights.
 * Reuse of any of the content for any purpose without the permission of Keith Ha
 * is strictly and expressively prohibited.
 */

#ifndef VIDEOENGINE_MEDIAOUTFILE_H
#define VIDEOENGINE_MEDIAOUTFILE_H


extern "C"
{
#include <libswresample/swresample.h>
#include <libavutil/audio_fifo.h>
}

#include <assert.h>
#include <list>
#include <string>
#include <sys/stat.h>
#include "MediaIn.h"

class MediaOut
{
public:
    MediaOut(SinkConfig* encConfig);
    ~MediaOut();
    bool            Open(MediaIn *    pIFile);
    void            Close();
    int             EncodeWrite();
    bool            IsOpen()                { return m_bOpen; }
    int             GetFifoSize();
    int             GetOutputFrameSize();
    int             ConvertFrame(AVFrame* inFrame);

private:
    void            initVars();
    bool            OpenSegfile();
    bool            CloseSegfile(bool bForce);
    void            timeformat(int sec);

    MediaIn *       m_pIFile;   // To access input file's information
    AVFormatContext* m_pFileContext;
    AVCodecContext* m_pAudioCodecCtx;
    SinkConfig*     m_pSinkConfig;
    int             m_fileSerial;
    bool            m_bOpen;
    SwrContext      *m_pResampleCtx;
    AVAudioFifo     *m_pFifo;
    AVFrame         *m_pOutFrame;
    uint8_t         **m_pConvSample;
    char*           m_outsegfile;

    int64_t         m_printDTS;
    int64_t         m_lastDTS;
    int64_t         m_totalSampleNum;
    int64_t         m_segSampleNum;
    int64_t         m_printSampleNum;
};

#endif //VIDEOENGINE_MEDIAOUTFILE_H
