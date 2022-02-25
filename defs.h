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

#define _VERSION     "1.00"

#define SAFE_FREE(x)        if(x){ delete(x); x = NULL;}
#define SAFE_DEINIT_FREE(x) if(x){ x->Deinit(); delete(x); x = NULL;}
#define FUNCPRINT           cout << "[" << __func__ << "] " <<
#define FILESINK_TERM       60
#define MKV_TIMEBASE        {1,1000}
#define MAX_STREAM_BUFFER_SIZE  (4<<20)
#define OUTFORMAT           "matroska"
#define OUTEXTENSION        ".mkv"

#ifdef av_err2str
#undef av_err2str
#define av_err2str(errnum) av_make_error_string((char*)__builtin_alloca(AV_ERROR_MAX_STRING_SIZE), \
                                                AV_ERROR_MAX_STRING_SIZE, errnum)
#endif

typedef struct _SinkConfig
{
    int64_t         bitrate;
    bool            bProcessRun;
    char*           srcTitle;
    char*           inputFileName;
    char*           outputURL;
    int64_t         duration;
}SinkConfig;

#ifdef  DEBUG
#define DEBUG_MARK          fprintf(stderr, "%s : %d\n", __func__, __LINE__);
#define INST_MARK(x)        fprintf(stderr, "[%d]%s : %d\n", x, __func__, __LINE__);
#else
#define DEBUG_MARK
#define INST_MARK(x)
#endif

#endif //_RTSPSINKDEF_H
