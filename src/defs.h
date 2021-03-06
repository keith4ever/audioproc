/*
 * Copyright (c) 2014 -     Keith Ha (keith4ever@gmail.com)
 * All content herein is protected by U.S. copyright and other applicable intellectual property laws
 * and may not be copied without the expressive permission of Keith Ha, who reserves all rights.
 * Reuse of any of the content for any purpose without the permission of Keith Ha
 * is strictly and expressively prohibited.
 */
#ifndef _RTSPSINKDEF_H
#define _RTSPSINKDEF_H

#include <pthread.h>
#include <stdio.h>
#include <fstream>
#include <signal.h>
#include <iostream>

#define _VERSION     "1.01"

#define SAFE_FREE(x)        if(x){ delete(x); x = NULL;}
#define SAFE_DEINIT_FREE(x) if(x){ x->Deinit(); delete(x); x = NULL;}
#define FUNCPRINT           cout << "[" << __func__ << "] " <<
#define MKV_TIMEBASE        {1,1000}
#define MAX_STREAM_BUFFER_SIZE  (4<<20)
#define MKVFORMAT           "matroska"
#define MKVEXTENSION        "mkv"
#define ADTSFORMAT          "adts"
#define AACEXTENSION        "aac"
#define M4AEXTENSION        "m4a"
#define TSEXTENSION         "ts"
#define HLSEXTENSION        "m3u8"

#ifdef av_err2str
#undef av_err2str
#define av_err2str(errnum) av_make_error_string((char*)__builtin_alloca(AV_ERROR_MAX_STRING_SIZE), \
                                                AV_ERROR_MAX_STRING_SIZE, errnum)
#endif

typedef struct _SinkConfig
{
    int         term;
    bool        bProcessRun;
    char*       inputURL;
    char*       outputID;
    char        httpFilePath[128];
    uint16_t    httpPort;
    int         httpFilecheckterm;
    int         lastSegno;
    int         sampleNumPerSeg;
}SinkConfig;

#ifdef  DEBUG
#define DEBUG_MARK          fprintf(stderr, "%s : %d\n", __func__, __LINE__);
#define INST_MARK(x)        fprintf(stderr, "[%d]%s : %d\n", x, __func__, __LINE__);
#else
#define DEBUG_MARK
#define INST_MARK(x)
#endif

#endif //_RTSPSINKDEF_H
