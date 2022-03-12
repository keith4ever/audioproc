/*
 * Copyright (c) 2014 -     Keith Ha (keith4ever@gmail.com)
 * All content herein is protected by U.S. copyright and other applicable intellectual property laws
 * and may not be copied without the expressive permission of Keith Ha, who reserves all rights.
 * Reuse of any of the content for any purpose without the permission of Keith Ha
 * is strictly and expressively prohibited.
 */

#include <unistd.h>
#include <iomanip>
#include "MediaOut.h"

#define BIG_NEG_TIMING  -1000000
/* =================
 * MediaOut methods
================= */

MediaOut::MediaOut(SinkConfig* pConfig) {
    m_pFileContext      = nullptr;
    m_pSinkConfig       = pConfig;
    m_pAudioCodecCtx    = nullptr;
    m_outsegfile        = new char[256];
    initVars();
}

MediaOut::~MediaOut()
{
    delete [] m_outsegfile;
    m_outsegfile = nullptr;
}

bool MediaOut::OpenSegfile() {
    int ret;

    // setting next segment file name here
    m_pSinkConfig->lastSegno = m_fileSerial-1;
    if(m_fileSerial >= 200){
        sprintf(m_outsegfile, "%s/%s_%d.%s", m_pSinkConfig->outputID,
                m_pSinkConfig->outputID, (m_fileSerial-200), M4AEXTENSION);
        remove(m_outsegfile);
    }
    sprintf(m_outsegfile, "%s/%s_%d.%s", m_pSinkConfig->outputID,
            m_pSinkConfig->outputID, m_fileSerial++, M4AEXTENSION);
    ret = avformat_alloc_output_context2(&m_pFileContext, nullptr,
                                         nullptr, m_outsegfile);
    if(ret < 0)
        FUNCPRINT "could not open output file: " << av_err2str(ret) << endl;

    unsigned int numOfstreams = m_pIFile->GetNumOfStreams();
    AVStream** inStreams = m_pIFile->GetStreams();

    // copy from ffmpeg/doc/exmaples/remuxing.c
    for (unsigned int i = 0; i < numOfstreams; i++)
    {
        AVStream* inStream = inStreams[i];

        if(inStream->codecpar->codec_type != AVMEDIA_TYPE_AUDIO) continue;

        AVStream* outStream = avformat_new_stream(m_pFileContext, NULL);
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
        avcodec_parameters_from_context(outStream->codecpar, m_pAudioCodecCtx);
        break;
        //av_dict_copy(&outStream->metadata, inStream->metadata, 0);
    }
    av_dump_format(m_pFileContext, 0, NULL, 1);

    ret = avio_open(&m_pFileContext->pb, m_outsegfile, AVIO_FLAG_WRITE);
    if (ret < 0) {
        printf("Could not open output file %s", m_outsegfile);
        return false;
    }

    if (avformat_write_header(m_pFileContext, NULL) < 0)
        printf("Error occurred when writing header\n");
    //FUNCPRINT "** Outfile seq. number: " << (m_pSinkConfig->inputSeqno-1) << endl;

    return true;
}

bool MediaOut::Open(MediaIn *pIFile)
{
    // Allocate an AVFormatContext for an output format.
    // avformat_free_context() can be used to free the context and
    // everything allocated by the framework within it.
    assert(pIFile);
    m_pIFile            = pIFile;

    char* pch = strrchr(m_pSinkConfig->outputID, '.');
    if(pch != NULL && pch[1] != '/') *pch = '\0'; // just get rid of extension with .

    if(access(m_pSinkConfig->outputID, F_OK) == -1){
        if(mkdir(m_pSinkConfig->outputID, 0777) == -1){
            FUNCPRINT "Could not create subfolder: " << m_pSinkConfig->outputID << endl;
            return false;
        }
    } else {
        char temp[256];
        sprintf(temp, "rm -rf %s/*", m_pSinkConfig->outputID);
        system(temp);
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

    int ret = avcodec_open2(m_pAudioCodecCtx, codec, NULL);
    if(ret < 0){
        FUNCPRINT "Audio codec open error.." << endl;
        return false;
    }

    OpenSegfile();
    /* Some container formats (like MP4) require global headers to be present.
    * Mark the encoder so that it behaves accordingly. */
    if (m_pFileContext->oformat->flags & AVFMT_GLOBALHEADER)
        m_pAudioCodecCtx->flags |= AV_CODEC_FLAG_GLOBAL_HEADER;

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

void MediaOut::timeformat(int sec) {
    int h = sec / (60 * 60);
    sec -= h * (60 * 60);

    int m = sec / (60);
    sec -= m * (60);
    cout << "[" << std::setfill('0') << std::setw(2) << h << ':' << std::setw(2) << m
         << ':' << std::setw(2) << sec << "] ";
}

bool MediaOut::CloseSegfile(bool bForce) {
    if(m_pFileContext == nullptr) return false;

    if(!bForce) {
        if ((m_totalSampleNum - m_segSampleNum) * 1000 / m_pAudioCodecCtx->sample_rate <
            m_pSinkConfig->term)
            return false;
    }

    AVStream *outStream = m_pFileContext->streams[0];
    outStream->nb_frames = (int)(m_totalSampleNum - m_segSampleNum);
    m_pSinkConfig->sampleNumPerSeg = outStream->nb_frames;
    outStream->duration = (m_totalSampleNum - m_segSampleNum) * 1000 / m_pAudioCodecCtx->sample_rate;
    m_segSampleNum = m_totalSampleNum;

    if(m_lastDTS - m_printDTS >= 10000){
        timeformat(m_lastDTS/1000);
        cout << "#" << (m_fileSerial - 1) << " elapsed = " << (int)((m_lastDTS - m_printDTS) / 1000)
                      << " s, # of samples = " << (m_totalSampleNum - m_printSampleNum) << endl;
        m_printDTS = m_lastDTS;
        m_printSampleNum = m_totalSampleNum;
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
    return true;
}

void MediaOut::Close()
{
    CloseSegfile(true);

    avcodec_free_context(&m_pAudioCodecCtx);
    av_free(m_pAudioCodecCtx);
    av_frame_free(&m_pOutFrame);
    free(*m_pConvSample);
}

void MediaOut::initVars() {
    m_pFifo         = nullptr;
    m_pConvSample   = nullptr;
    m_pOutFrame     = nullptr;
    m_printDTS      = 0;
    m_totalSampleNum = 0;
    m_segSampleNum  = 0;
    m_fileSerial    = 0;
    m_printSampleNum = 0;
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
    if(CloseSegfile(false))
        OpenSegfile();

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

    packet.pts = 1000 * m_totalSampleNum / m_pAudioCodecCtx->sample_rate;
    packet.dts = packet.pts;
    packet.duration = 1000 * m_pOutFrame->nb_samples / m_pAudioCodecCtx->sample_rate;
    m_lastDTS = packet.dts;
    int res = av_interleaved_write_frame(m_pFileContext, &packet);
    if (res < 0) {
        printf("Error from output writing packet: %s\n", av_err2str(res));
    }
    m_totalSampleNum += m_pOutFrame->nb_samples;
    av_packet_unref(&packet);

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