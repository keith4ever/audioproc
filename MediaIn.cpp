/*
 * Copyright (c) 2014 -     Keith Ha (keith4ever@gmail.com)
 * All content herein is protected by U.S. copyright and other applicable intellectual property laws
 * and may not be copied without the expressive permission of Keith Ha, who reserves all rights.
 * Reuse of any of the content for any purpose without the permission of Keith Ha
 * is strictly and expressively prohibited.
 */
#include "MediaIn.h"

av_always_inline char* av_err2str_inline(int errnum)
{
    static char str[AV_ERROR_MAX_STRING_SIZE];
    memset(str, 0, sizeof(str));
    return av_make_error_string(str, AV_ERROR_MAX_STRING_SIZE, errnum);
}

static int cbDecodeInterrupt(void *ctx)
{
    // return whether to stop the input stream or not
    MediaIn *infile = (MediaIn *)ctx;

    //if(infile->isRunning())
        return 0;
    //else return 1;
}

//=========== MediaIn =================

MediaIn::MediaIn(SinkConfig* pConfig)
{
    avformat_network_init();
    av_log_set_level(AV_LOG_ERROR);
    m_pSinkConfig           = pConfig;
    initVars();
}

MediaIn::~MediaIn()
{
    assert(!m_pFormatContext);
}

bool MediaIn::initFormatContext() {
    int res, i;
    AVDictionary **opts;

    // allocating Format I/O context
    m_pFormatContext = avformat_alloc_context();

//    if(!parseInputPort()) return false;

    if (!m_pFormatContext)
    {
        printf("alloc format context failed\n");
        return false;
    }
    // Just copied from ffmpeg
    // TODO: we need to investigate what this flag means.
    //m_pFormatContext->flags |= AVFMT_FLAG_NONBLOCK;

    AVDictionary* pFormatOpts = NULL;
    // av_dict_set will allocate it. I don't like this kind of allocation though.
    // TODO: what setting "scan_all_pmts" is doing?
    av_dict_set(&pFormatOpts, "scan_all_pmts", "1", AV_DICT_DONT_OVERWRITE);

    m_pFormatContext->interrupt_callback.callback = cbDecodeInterrupt;
    m_pFormatContext->interrupt_callback.opaque = this;
    m_pFormatContext->max_analyze_duration = 10240000;

    // Open an input stream and read the header. The codecs are not opened.
    // The stream must be closed with avformat_close_input().
    // AVInputFormat *pInputFormat == NULL --> format is not specified. Will be autodected.
    res = avformat_open_input(&m_pFormatContext, m_pSinkConfig->inputFileName,
                              NULL, &pFormatOpts);
    if (res < 0)
    {
        printf("** avformat_open_input Error: %s: %s\n",
               av_err2str_inline(res), m_pSinkConfig->inputFileName);
        return false;
    }

    av_dict_set(&pFormatOpts, "scan_all_pmts", NULL, AV_DICT_MATCH_CASE);
    assert(pFormatOpts == NULL); // should be deallocated
    av_format_inject_global_side_data(m_pFormatContext);
    opts = (AVDictionary **) av_mallocz_array(m_pFormatContext->nb_streams, sizeof(*opts));
    avformat_find_stream_info(m_pFormatContext, opts);

    // assume all codec ids are NONE here
    assert(m_pFormatContext->audio_codec_id == AV_CODEC_ID_NONE);
    assert(m_pFormatContext->video_codec_id == AV_CODEC_ID_NONE);
    assert(m_pFormatContext->subtitle_codec_id == AV_CODEC_ID_NONE);
    assert(m_pFormatContext->data_codec_id == AV_CODEC_ID_NONE);

    //av_free(opts);
    return true;
}

// most of code is copied from ffmpeg.c and ffmepg_xxx.c and shrinked a bit
bool MediaIn::Open()
{
    if(!initFormatContext())
        return false;

    AVCodecParameters *pCodecPar;
    AVCodec *codec;
    for (unsigned int i = 0; i < m_pFormatContext->nb_streams; i++)
    {
        pCodecPar = m_pFormatContext->streams[i]->codecpar;
        m_timebase[i] = m_pFormatContext->streams[i]->time_base;
        if(pCodecPar->codec_type == AVMEDIA_TYPE_AUDIO) {
            m_sampleRate = pCodecPar->sample_rate;
            m_channel = pCodecPar->channels;
            m_sampleFmt = (AVSampleFormat) pCodecPar->format;
            codec = avcodec_find_decoder(pCodecPar->codec_id);
            if(!codec) {
                fprintf(stderr, "Could not find input codec\n");
                return false;
            }
            m_pAudioCodecCtx = avcodec_alloc_context3(codec);
            avcodec_parameters_to_context(m_pAudioCodecCtx, pCodecPar);
            avcodec_open2(m_pAudioCodecCtx, codec, NULL);
            FUNCPRINT "sample rate: " << m_sampleRate << ", channel: " << m_channel
                  << ", format: " << m_sampleFmt << ", codec: " << pCodecPar->codec_id
                  << endl;
            break;
        }
    }

    av_dump_format(m_pFormatContext, 0, NULL, false);
    return true;
}

unsigned int MediaIn::GetNumOfStreams() const
{
    assert(m_pFormatContext);
    return m_pFormatContext->nb_streams;
}

AVStream**  MediaIn::GetStreams() const
{
    assert(m_pFormatContext);
    return m_pFormatContext->streams;
}

void MediaIn::Close()
{
    if (m_pFormatContext)
    {
        avformat_flush(m_pFormatContext);
        avformat_close_input(&m_pFormatContext);
        avformat_free_context(m_pFormatContext);
        m_pFormatContext = NULL;
    }
    avcodec_free_context(&m_pAudioCodecCtx);
    av_free(m_pAudioCodecCtx);
    //FUNCPRINT "Closed input connection, segno: " << m_pSinkConfig->inputSeqno << endl << endl;
    initVars();
}

int MediaIn::GetPacket(AVFrame *frame)
{
    assert(frame);
    int ret;
    AVPacket packet;

    if (av_read_frame(m_pFormatContext, &packet) < 0)
        return PKT_ENDOFFILE;

    ret = avcodec_send_packet(m_pAudioCodecCtx, &packet);
    if(ret < 0) {
        fprintf(stderr, "Could not send packet for decoding (error '%s')\n",
                av_err2str(ret));
        return PKT_NONE_AV;
    }
    ret = avcodec_receive_frame(m_pAudioCodecCtx, frame);
    if (ret == AVERROR(EAGAIN)) {
        return PKT_MOREPACKET;
    } else if (ret == AVERROR_EOF) {
        return PKT_ENDOFFILE;
    } else if (ret < 0) {
        fprintf(stderr, "Could not decode frame (error '%s')\n",
                av_err2str(ret));
        return PKT_NONE_AV;
    }
    av_packet_unref(&packet);

    return PKT_SUCCESS;
}

void MediaIn::initVars() {
    m_pFormatContext        = NULL;
    m_iBitrate              = 0;
    m_sampleRate            = 0;
    m_channel               = 0;
    m_sampleFmt             = AV_SAMPLE_FMT_FLTP;
    m_pAudioCodecCtx        = nullptr;
}
