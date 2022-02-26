//
// Created by keith on 3/5/21.
//

#ifndef FFMPEGWASM_DEMO_AC_MAIN_H
#define FFMPEGWASM_DEMO_AC_MAIN_H
#include <stdio.h>
#include <stdarg.h>
#include <sys/time.h>
#include <sys/timeb.h>
#include <pthread.h>
#include <unistd.h>
#include <stdlib.h>
#include <list>
#include <emscripten/fetch.h>
#include <queue>

typedef void(*VideoCallback)(unsigned char *buff, int size,
                            int fifosize, double timestamp);
typedef void(*AudioCallback)(unsigned char *buff, int size,
                             int fifosize, double timestamp);
typedef void(*MessageCallback)(int msg, unsigned char* buff, int size);
typedef void(*SrcIdxCallback)(int frame, int pts, int idx);

#ifdef __cplusplus
extern "C" {
#endif

//#define     TEST_URL        "https://10.1.10.100/multiview"
//#define D1_DEBUG    1
//#define LOG_SILENCE    1
#define MIN(X, Y)  ((X) < (Y) ? (X) : (Y))

#define MSG_END_REACHED     16
#define MSG_FSD_STRING      21
#define MSG_UUID_NOTFOUND   22
#define MSG_OPEN_REMUXER    8
#define MAX_LIVE_RETRY      9

#define BUFF_HIGH_WATERMARK     6000
#define BUFF_LOW_WATERMARK      3000

#define CUSTIO_BUFF_SIZE    (256 << 10)
#define DEFAULT_FIFO_SIZE   (16 << 20)
#define MAX_FIFO_SIZE       (32 << 20)
#define PCM_BUFFER_SIZE     (2 << 20)

#define     MAX_STREAM_BUFFER_SIZE      (4<<20)
#define     MKV_CONTAINER               "matroska"
#define     MP4_CONTAINER               "mp4"

typedef enum ErrorCode {
    kErrorCode_Success = 0,
    kErrorCode_Invalid_Param,
    kErrorCode_Invalid_State,
    kErrorCode_Invalid_Data,
    kErrorCode_Invalid_Format,
    kErrorCode_NULL_Pointer,
    kErrorCode_Open_File_Error,
    kErrorCode_Eof,
    kErrorCode_EndReached,
    kErrorCode_FFmpeg_Error,
    kErrorCode_Old_Frame
} ErrorCode;


typedef enum DecodeState {
    kStateStop = 0,
    kStateInit,
    kStatePlay,
    kStatePause,
} RemuxState;

typedef enum LogLevel {
    kLogLevel_None, //Not logging.
    kLogLevel_Core, //Only logging core module(without ffmpeg).
    kLogLevel_All   //Logging all, with ffmpeg.
} LogLevel;

typedef enum DownMode {
    kDownFSD = 0,
    kDownFirst,
    kDownNext
} DownMode;

#include "libavcodec/avcodec.h"
#include "libavformat/avformat.h"
#include "libavutil/fifo.h"
//#include "libswscale/swscale.h"

typedef struct FSDDownload{
    unsigned int    vnum    = 4;
    unsigned int    codec   = 1;    // 0: H264, 1:H265
    unsigned int    segTerm = 3000;
    int64_t         duration = 0;
    char            fsd[384] ;
    unsigned int    fsdlen = 0;
    unsigned int    width = 0;
    unsigned int    height = 0;
    unsigned int    d1w = 0;
    unsigned int    d1h = 0;
    long            fsdCallback;
}FSDDownload;

typedef struct WebRemuxer {
    AVFormatContext *ifmtCtxt;
    AVFormatContext *ofmtCtxt;
    AVDictionary    *avoptions;

    unsigned char*  outBuffer;
    unsigned char*  streamBuffer;
    unsigned int    oBuffData;
    unsigned char*  oBuffPtr;

    unsigned char   *audioBuffer;
    unsigned int    audBuffSize;
    unsigned int    currAudBufPos;

    int             vIdx;
    int             aIdx;
    VideoCallback   videoCallback;
    AudioCallback   audioCallback;
    MessageCallback msgCallback;
    SrcIdxCallback  idxCallback;
    int             availInFifo;
    int64_t         firstDTS[2];
    int64_t         readDTS[2];
    int64_t         vFirstPTSOffset;
    int             aRateIdx;
    int             aChannels;
    int             writtenPktNum[2];
    unsigned char   *inputBuffer;
    // For streaming.
    AVFifoBuffer    *fifo;
    int             fifoSize;
    int             errorCode;
} WebDecoder;


typedef struct MTVsegment {
    unsigned char   *baseUrl;
    unsigned char   *uuid;

    unsigned int    fps;
    unsigned int    isLive;
    unsigned int    audioBuffMSec;
    unsigned int    videoBuffMSec;

    unsigned int    numBytes[2];
    unsigned int    firstSegNo;
    int             bDown;
    int             bAllDown;
    DownMode        mode;
    unsigned int    endSeg = 0;
    unsigned int    nextSegNo;
    int             srcIdx;
    int             prevSegIdx;
    std::deque<std::pair<int, int>> queueIdxPos;
} MTVsegment;

extern FSDDownload  gFSDDown;
extern MTVsegment   *gSegInfo;
extern WebRemuxer   *gRemuxer;
extern emscripten_fetch_attr_t gFetchAttr;
extern LogLevel     logLevel;
extern int          numCPUcores;
extern int          gDownRetry;
extern RemuxState   gRemuxState;


void        jsLog(const char *format, ...);
void        logCallback(void* ptr, int level, const char* fmt, va_list vl);
bool        parseFSDBuffer(char* buff);
int         sendFSD(struct AVFormatContext* context);
int         fillData(unsigned char *buff, int size);

void        initDown();
void*       downFirst(void* arg);
void*       downNext(void* arg);

void        freeInputContext(WebRemuxer* remuxer);
int         openInputContext(WebRemuxer* remuxer);
int         openOutputContext(WebRemuxer* remuxer);
int         calcCurrBufferTime(MTVsegment* seginfo);
void        setError(int code);
#ifdef __cplusplus
}
#endif
#endif //FFMPEGWASM_DEMO_AC_MAIN_H
