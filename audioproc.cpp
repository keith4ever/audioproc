/*
 * Copyright (c) 2014 -     Keith Ha (keith4ever@gmail.com)
 * All content herein is protected by U.S. copyright and other applicable intellectual property laws
 * and may not be copied without the expressive permission of Keith Ha, who reserves all rights.
 * Reuse of any of the content for any purpose without the permission of Keith Ha
 * is strictly and expressively prohibited.
 */
#include "MediaIn.h"
#include "MediaOut.h"
#include "defs.h"

SinkConfig      sConfig = {0};
int64_t         glStart = 0, glLastTime = 0;
int64_t         glLastFrames = 0, glCurrFrames = 0;
MediaIn *       gpIFile         = NULL;
MediaOut *      gpOFile         = NULL;

using namespace std;

void signal_callback_handler(int signum)
{
    printf("*** Caught interrupt signal %d ***\n",signum);

    sConfig.bProcessRun       = false;
}

void deleteAllHandles() {
    if(gpIFile){ // only the first instance owns the MediaIn handle
        gpIFile->Close();
        delete(gpIFile);
        gpIFile = NULL;
    }
    if(gpOFile){
        gpOFile->Close();
        delete(gpOFile);
        gpOFile = NULL;
    }
    if(sConfig.outputURL)       delete [] sConfig.outputURL;

}

void PrintHelp(bool bUsage)
{
    printf("\n\n=================================================================\n");
    printf("* audioproc ver. %s - All rights reserved by Keith Ha. *\n", _VERSION);
    if(bUsage) {
        printf("\nUsage: ./audioproc -i <full path of audio wav file>\n"
               "                  [-o <output file.aac>] \n");
    }
    printf("=================================================================\n");
}

void PrintConfigs()
{
    PrintHelp(false);
    printf("    input           : \"%s\"\n", sConfig.inputFileName);
    printf("    output          : \"%s\"\n", sConfig.outputURL);
    printf("=================================================================\n\n");
}

bool parseArguments(SinkConfig *pConfig, int argc, char *argv[])
{
    for (int i = 1; i < argc; i++)
    {
        if (strcasecmp(argv[i], "-i") == 0)
        {
            if (++i >= argc)
            {
                fprintf(stderr, "invalid parameter for %s\n", argv[i - 1]);
                return false;
            }
            pConfig->inputFileName = argv[i];
        }
        else if (strcasecmp(argv[i], "-o") == 0)
        {
            if (++i >= argc)
            {
                fprintf(stderr, "invalid parameter for %s\n", argv[i - 1]);
                return false;
            }
            strcpy(pConfig->outputURL, argv[i]);
        }
        else if(strcasecmp(argv[i], "-t") == 0)
        {
            if (++i >= argc)
            {
                fprintf(stderr, "invalid parameter for %s\n", argv[i - 1]);
                return false;
            }
            pConfig->srcTitle = argv[i];
        }
        else
        {
            fprintf(stderr, "invalid parameter  %s\n", argv[i++]);
            return false;
        }
    }

    return true;
}

void*   checkProgressThread(void *arg){
    int current = 0, numFrames, elapsedTime;
    int64_t lEnd;
    float ffps;
    char fpsmsg[32];
    char title[32];

    strcpy(fpsmsg, "fps");
    strcpy(title, "Concat");
    if(sConfig.srcTitle)
        sprintf(title, "%s (%s)", title, sConfig.srcTitle);

    while(sConfig.bProcessRun) {
        av_usleep(500000);

        lEnd = av_gettime();
        elapsedTime = (int) ((lEnd - glLastTime) / 1000); // in millisec

        if (elapsedTime >= 10000) {
            current = (int) ((lEnd - glStart) / 1000);
            numFrames = (int)(glCurrFrames - glLastFrames);
            ffps = (float) (numFrames * 1000) / elapsedTime;
            printf("[%s %d secs] %d frames recored, Avg. FPS:%.2f \n",
                   title, current / 1000, numFrames, ffps);

            glLastTime = lEnd;
            glLastFrames = glCurrFrames;
        }
    }
    return NULL;
}

void   FileConcatLoop()
{
    //start encoding thread
    int ret = PKT_SUCCESS;
    AVFrame*        pFrame  = av_frame_alloc();;

    // TODO: start here to publish and executing live video engine

    while(sConfig.bProcessRun) {
        // loop until it meets the next whole video frame
        while(gpOFile->GetFifoSize() < gpOFile->GetOutputFrameSize()) {
            ret = gpIFile->GetPacket(pFrame);
            if (ret == PKT_ENDOFFILE || ret == PKT_NOTSTART) break;
            gpOFile->ConvertFrame(pFrame);
        }

        if (ret == PKT_ENDOFFILE || ret == PKT_NOTSTART) break;
        while(gpOFile->GetFifoSize() >= gpOFile->GetOutputFrameSize()){
            glCurrFrames++;
            ret = gpOFile->EncodeWrite();
        }
    }
    av_frame_free(&pFrame);
}

void initConfig(){
    memset(&sConfig, 0, sizeof(SinkConfig));
    sConfig.bProcessRun     = true;
    sConfig.srcTitle        = NULL;
    sConfig.outputURL       = new char[256];
    sConfig.outsegfile      = new char[256];
    sConfig.term            = 10000;
    memset(sConfig.outputURL, 0, sizeof(char) * 256);
}

int main(int argc, char* argv[])
{
    pthread_t progPid;

    signal(SIGINT, signal_callback_handler);
    initConfig();

    if(!parseArguments(&sConfig, argc, argv) || !sConfig.inputFileName)
    {
        PrintHelp(true);
        return 1;
    }

    avformat_network_init();
    av_log_set_level(AV_LOG_QUIET);

    gpIFile     = new MediaIn(&sConfig);
    gpOFile     = new MediaOut(&sConfig);

    pthread_create(&progPid, NULL, checkProgressThread, NULL);

    if (!gpIFile || !gpIFile->Open()) {
        fprintf(stderr, "can't open %s\n", sConfig.inputFileName);
        assert(0);
    }
    bool bRet = gpOFile->Open(gpIFile);

    PrintConfigs();
    if(!bRet){
        fprintf(stderr, "can't write to %s\n", sConfig.outsegfile);
        assert(0);
    }

    //FUNCPRINT "Input source: " << sConfig.inputFileName << endl;
    glLastTime = glStart = av_gettime();
    glCurrFrames = glLastFrames = 0;

    FileConcatLoop();

    deleteAllHandles();
    pthread_cancel(progPid);
    FUNCPRINT "Exiting audioproc.. " << endl;

    return 0;
}
