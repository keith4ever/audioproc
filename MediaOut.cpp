/*
 * Copyright (c) 2014 -     Keith Ha (keith4ever@gmail.com)
 * All content herein is protected by U.S. copyright and other applicable intellectual property laws
 * and may not be copied without the expressive permission of Keith Ha, who reserves all rights.
 * Reuse of any of the content for any purpose without the permission of Keith Ha
 * is strictly and expressively prohibited.
 */
#include "MediaOut.h"

#define BIG_NEG_TIMING  -1000000
/* =================
 * MediaOut methods
================= */

MediaOut::MediaOut(SinkConfig* pConfig) {
    m_pFileContext      = NULL;
    m_pSinkConfig       = pConfig;
    m_pAudioCodecCtx    = nullptr;
    initVars();
}

MediaOut::~MediaOut()
{
}

bool MediaOut::openOutputStreams(AVFormatContext *pFormatContext) {
    unsigned int numOfstreams = m_pIFile->GetNumOfStreams();
    AVStream** inStreams = m_pIFile->GetStreams();

    // copy from ffmpeg/doc/exmaples/remuxing.c
    for (unsigned int i = 0; i < numOfstreams; i++)
    {
        AVStream* inStream = inStreams[i];

        if(inStream->codecpar->codec_type != AVMEDIA_TYPE_AUDIO &&
           inStream->codecpar->codec_type != AVMEDIA_TYPE_VIDEO)
            continue;

        switch(inStream->codecpar->codec_type){
            case AVMEDIA_TYPE_AUDIO:
                if(inStream->codecpar->codec_type != AVMEDIA_TYPE_AUDIO) {
                    FUNCPRINT "Reference stream is not audio.." << endl;
                    return false;
                }

                AVStream* outStream = avformat_new_stream(pFormatContext, NULL);
                if (!outStream)
                {
                    FUNCPRINT "Failed to allocate new audio stream" << endl;
                    return false;
                }

                if(avcodec_parameters_copy(outStream->codecpar, inStream->codecpar) < 0){
                    FUNCPRINT "Failed to copy context from input to output stream codec context" << endl;
                    return false;
                }
                outStream->codecpar->codec_tag = 0;
                outStream->codecpar->codec_id = AV_CODEC_ID_AAC;
                outStream->time_base.den = m_pIFile->GetAudioSampleRate();
                outStream->time_base.num = 1;
                outStream->sample_aspect_ratio.num = inStream->sample_aspect_ratio.num;
                outStream->sample_aspect_ratio.den = inStream->sample_aspect_ratio.den;
                outStream->r_frame_rate = inStream->r_frame_rate;
                outStream->avg_frame_rate = inStream->avg_frame_rate;
                break;
        }
        //av_dict_copy(&outStream->metadata, inStream->metadata, 0);
    }
    av_dump_format(pFormatContext, 0, NULL, 1);
    return true;
}

bool MediaOut::setOutputURL() {
    if(strlen(m_pSinkConfig->outputURL) <= 1)
        strcpy(m_pSinkConfig->outputURL, m_pSinkConfig->inputFileName);

    char* pch = strrchr(m_pSinkConfig->outputURL, '.');
    if(pch != NULL && pch[1] != '/') *pch = '\0'; // just get rid of extension with .
    sprintf(m_pSinkConfig->outputURL, "%s.aac", m_pSinkConfig->outputURL);

    return true;
}

bool MediaOut::Open(MediaIn *pIFile)
{
    // Allocate an AVFormatContext for an output format.
    // avformat_free_context() can be used to free the context and
    // everything allocated by the framework within it.
    assert(pIFile);
    m_pIFile            = pIFile;

    if(!setOutputURL()) return false;

    avformat_alloc_output_context2(&m_pFileContext,
                                   nullptr, nullptr, m_pSinkConfig->outputURL);

    if(!openOutputStreams(m_pFileContext))
        return false;

    int ret;
    ret = avio_open(&m_pFileContext->pb, m_pSinkConfig->outputURL, AVIO_FLAG_WRITE);
    if (ret < 0) {
        printf("Could not open output file %s", m_pSinkConfig->outputURL);
        return false;
    }

    AVCodec* codec = avcodec_find_encoder(AV_CODEC_ID_AAC);
    if(codec == NULL){
        FUNCPRINT ": Audio Encoder AAC is not found.." << endl;
        return false;
    }

    m_pAudioCodecCtx = avcodec_alloc_context3(codec);
    m_pAudioCodecCtx->bit_rate      = 256000;
    m_pAudioCodecCtx->sample_rate   = m_pIFile->GetAudioSampleRate();
    m_pAudioCodecCtx->channels      = m_pIFile->GetAudioChannel();
    m_pAudioCodecCtx->channel_layout
        = av_get_default_channel_layout(m_pIFile->GetAudioChannel());

    /* Allow the use of the experimental AAC encoder. */
    m_pAudioCodecCtx->strict_std_compliance = FF_COMPLIANCE_EXPERIMENTAL;

    m_pAudioCodecCtx->time_base     = (AVRational){1, m_pAudioCodecCtx->sample_rate};
    m_pAudioCodecCtx->codec_type    = AVMEDIA_TYPE_AUDIO;
    m_pAudioCodecCtx->sample_fmt    = codec->sample_fmts[0];
    /* Some container formats (like MP4) require global headers to be present.
 * Mark the encoder so that it behaves accordingly. */
    if (m_pFileContext->oformat->flags & AVFMT_GLOBALHEADER)
        m_pAudioCodecCtx->flags |= AV_CODEC_FLAG_GLOBAL_HEADER;

    ret = avcodec_open2(m_pAudioCodecCtx, codec, NULL);
    if(ret < 0){
        FUNCPRINT "Audio codec open error.." << endl;
        return false;
    }

    avcodec_parameters_from_context(m_pFileContext->streams[0]->codecpar, m_pAudioCodecCtx);

    if (avformat_write_header(m_pFileContext, NULL) < 0)
        printf("Error occurred when writing header\n");
    //FUNCPRINT "** Outfile seq. number: " << (m_pSinkConfig->inputSeqno-1) << endl;

    m_pResampleCtx = swr_alloc();
    m_pResampleCtx = swr_alloc_set_opts(nullptr,
                            m_pAudioCodecCtx->channel_layout,
                            m_pAudioCodecCtx->sample_fmt,
                            m_pAudioCodecCtx->sample_rate,
                            av_get_default_channel_layout(m_pIFile->GetAudioChannel()),
                            m_pIFile->GetAudioSampleFmt(),
                            m_pIFile->GetAudioSampleRate(),
                            0, NULL);
    swr_init(m_pResampleCtx);

    m_pFifo = av_audio_fifo_alloc(m_pAudioCodecCtx->sample_fmt,
                                  m_pAudioCodecCtx->channels, 1);

    m_pOutFrame = av_frame_alloc();
    m_pOutFrame->nb_samples     = m_pAudioCodecCtx->frame_size;
    m_pOutFrame->channel_layout = m_pAudioCodecCtx->channel_layout;
    m_pOutFrame->format         = m_pAudioCodecCtx->sample_fmt;
    m_pOutFrame->sample_rate    = m_pAudioCodecCtx->sample_rate;

    m_pConvSample = (uint8_t**) calloc(m_pAudioCodecCtx->channels, sizeof(**m_pConvSample));

    return true;
}

void MediaOut::Close()
{
    if(m_pFileContext == NULL) return;

    AVStream *outStream;
    for (unsigned int i = 0; i < m_pFileContext->nb_streams; i++) {
        outStream = m_pFileContext->streams[i];
        int packetnum = m_writtenPacketNum[i] - m_lastPacketNum[i];
        outStream->nb_frames = packetnum;
        outStream->duration = (m_lastWriteDTS[i] - m_firstWriteDTS[i]);
        m_lastPacketNum[i] = m_writtenPacketNum[i];
        m_firstWriteDTS[i] = m_lastWriteDTS[i];
        /*cout << "   #" << i << " stream: duration = " << (int)(outStream->duration)
            << " ms, # of packets = " << outStream->nb_frames << endl;*/
    }

    av_write_trailer(m_pFileContext);
    if(m_pFileContext->pb) {
        if (!(m_pFileContext->flags & AVFMT_NOFILE)) {
            avio_closep(&m_pFileContext->pb);
            m_pFileContext->pb = nullptr;
        }
    }
    avformat_free_context(m_pFileContext);
    m_pFileContext = nullptr;
    m_lastSegDTS = m_currSegDTS;
    avcodec_free_context(&m_pAudioCodecCtx);
    av_free(m_pAudioCodecCtx);
    av_frame_free(&m_pOutFrame);
    free(*m_pConvSample);
}

void MediaOut::initVars() {
    m_pFifo         = nullptr;
    m_pConvSample   = nullptr;
    m_pOutFrame     = nullptr;
    memset(&m_inTimebase, 0, MAX_STREAM_NUM * sizeof(AVRational));
    memset(&m_writtenPacketNum, 0, MAX_STREAM_NUM * sizeof(int));
    memset(&m_lastPacketNum, 0, MAX_STREAM_NUM * sizeof(int));
    m_currSegDTS = 0;
    m_lastSegDTS = 0;
    m_fileSerial        = 0;
    for(int i = 0; i < MAX_STREAM_NUM; i++) {
        m_lastWriteDTS[i] = BIG_NEG_TIMING;
        m_inPktStart[i] = BIG_NEG_TIMING;
        m_firstWriteDTS[i] = BIG_NEG_TIMING;
    }
}

int MediaOut::ConvertFrame(AVFrame *inFrame) {
    assert(inFrame);
    if(m_pFileContext == nullptr || inFrame->data[0] == nullptr)
        return PKT_NOREF;

    av_samples_alloc(m_pConvSample, NULL, m_pAudioCodecCtx->channels,
                     inFrame->nb_samples, m_pAudioCodecCtx->sample_fmt, 0);

    swr_convert(m_pResampleCtx, m_pConvSample, inFrame->nb_samples,
                (const uint8_t **)inFrame->extended_data, inFrame->nb_samples);

    av_audio_fifo_realloc(m_pFifo, av_audio_fifo_size(m_pFifo) + inFrame->nb_samples);
    av_audio_fifo_write(m_pFifo, (void**)m_pConvSample, inFrame->nb_samples);

    av_frame_unref(inFrame);
    av_freep(&m_pConvSample[0]);

    return PKT_SUCCESS;
}

int MediaOut::EncodeWrite() {
    const int frame_size = FFMIN(av_audio_fifo_size(m_pFifo),
                                 m_pAudioCodecCtx->frame_size);

    /* Allocate the samples of the created inFrame. This call will make
     * sure that the audio inFrame can hold as many samples as specified. */
    av_frame_get_buffer(m_pOutFrame, 0);
    /* Initialize temporary storage for one output inFrame. */

    /* Read as many samples from the FIFO buffer as required to fill the inFrame.
     * The samples are stored in the inFrame temporarily. */
    if (av_audio_fifo_read(m_pFifo, (void **)m_pOutFrame->data, frame_size) < frame_size) {
        FUNCPRINT "Could not read data from FIFO" << endl;
        return AVERROR_EXIT;
    }

    AVPacket packet;
    av_init_packet(&packet);
    int ret = avcodec_send_frame(m_pAudioCodecCtx, m_pOutFrame);
    /* The encoder signals that it has nothing more to encode. */
    if (ret == AVERROR_EOF) {
        return PKT_NOREF;
    } else if (ret < 0) {
        fprintf(stderr, "Could not send packet for encoding (error '%s')\n", av_err2str(ret));
        return PKT_NOREF;
    }

    ret = avcodec_receive_packet(m_pAudioCodecCtx, &packet);
    if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) {
        return PKT_NOREF;
    }else if (ret < 0) {
        fprintf(stderr, "Could not encode outFrame (error '%s')\n", av_err2str(ret));
        return PKT_NOREF;
    }
    int stridx = packet.stream_index;

    if (m_inPktStart[stridx] == BIG_NEG_TIMING) {
        m_inPktStart[stridx] = packet.pts;
    }

    if(packet.dts != AV_NOPTS_VALUE)
        packet.dts -= m_inPktStart[stridx];
    packet.pts -= m_inPktStart[stridx];

    //av_packet_rescale_ts(&packet->avpacket, m_pIFile->GetTimeBase(stridx), MKV_TIMEBASE);
    m_duration[stridx] = packet.duration;

    m_lastWriteDTS[stridx] = packet.dts;
    if(m_firstWriteDTS[stridx] == BIG_NEG_TIMING)
        m_firstWriteDTS[stridx] = m_lastWriteDTS[stridx];

    int res = av_write_frame(m_pFileContext, &packet);
    if (res < 0) {
        printf("Error from output writing packet: %s\n", av_err2str(res));
    }

    av_packet_unref(&packet);
    m_writtenPacketNum[stridx]++;

    return PKT_SUCCESS;
}

int MediaOut::GetFifoSize() {
    if(m_pFifo == nullptr) return 0;
    return av_audio_fifo_size(m_pFifo);
}

int MediaOut::GetOutputFrameSize() {
    if(m_pAudioCodecCtx == nullptr) return 0;
    return m_pAudioCodecCtx->frame_size;
}