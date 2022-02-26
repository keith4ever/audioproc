/*
 * Copyright (c) 2014 -     Keith Ha (keith4ever@gmail.com)
 * All content herein is protected by U.S. copyright and other applicable intellectual property laws
 * and may not be copied without the expressive permission of Keith Ha, who reserves all rights.
 * Reuse of any of the content for any purpose without the permission of Keith Ha
 * is strictly and expressively prohibited.
 */
#include "MediaIn.h"
#include "MediaOut.h"
#include "FileServer.h"
#include "defs.h"

SinkConfig      sConfig = {0};
shared_ptr<MediaIn>       gpIFile  = nullptr;
shared_ptr<MediaOut>      gpOFile  = nullptr;
FileResponse*   gpFileRes          = nullptr;

using namespace std;

void signal_callback_handler(int signum)
{
    printf("*** Caught interrupt signal %d ***\n",signum);

    sConfig.bProcessRun       = false;
    av_usleep(1000000);
    exit(0);
}

void deleteAllHandles() {
    if(gpIFile){ // only the first instance owns the MediaIn handle
        gpIFile->Close();
        gpIFile = nullptr;
    }
    if(gpOFile){
        gpOFile->Close();
        gpOFile = nullptr;
    }
    if(gpFileRes){
        delete gpFileRes;
        gpFileRes = nullptr;
    }

}

void PrintHelp(bool bUsage)
{
    printf("\n\n=================================================================\n");
    printf("* audioproc ver. %s - All rights reserved by Keith Ha. *\n", _VERSION);
    if(bUsage) {
        printf("\nUsage: ./audioproc -i <input url> -o <output UUID> \n");
    }
    printf("=================================================================\n");
}

void print_timestamp()
{
    time_t now = time(0);
    char* dt = ctime(&now);
    dt[strlen(dt)-1] = 0;   // removing tailing new line character

    cout << "[" << dt << "] ";
}

bool CheckConfigs()
{
    PrintHelp(false);
    if(strlen(sConfig.httpFilePath) < 6) return false;
    else if(access(sConfig.httpFilePath, F_OK) == -1) return false;

    if(sConfig.httpPort <= 30) return false;

    printf("=================================================================\n");
    printf("    root file path  : \"%s\"\n", sConfig.httpFilePath);
    printf("    file check term : %d (ms)\n", sConfig.httpFilecheckterm);
    printf("    URL             : \"http://<IPaddr>:%d/%s/%s_#seg.mkv\"\n",
           sConfig.httpPort, sConfig.outputID, sConfig.outputID);
    printf("    service start   : ");
    print_timestamp();  cout << endl;

    printf("    input           : \"%s\"\n", sConfig.inputURL);
    printf("    output          : \"%s\"\n", sConfig.outputID);
    printf("=================================================================\n\n");
    return true;
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
            pConfig->inputURL = argv[i];
        }
        else if (strcasecmp(argv[i], "-o") == 0)
        {
            if (++i >= argc)
            {
                fprintf(stderr, "invalid parameter for %s\n", argv[i - 1]);
                return false;
            }
            pConfig->outputID = argv[i];
        }
        else if (strcasecmp(argv[i], "-d") == 0) {
            if (++i >= argc) {
                fprintf(stderr, "invalid file root path: %s\n", argv[i - 1]);
                exit(0);
            }
            gpFileRes->setRootPath(argv[i]);
        }
        else if (strcasecmp(argv[i], "-p") == 0) {
            uint16_t portno = 0;
            if (++i >= argc || sscanf(argv[i], "%hu", &portno) != 1)
            {
                fprintf(stderr, "invalid port number: %s\n", argv[i - 1]);
                _exit(0);
            }
            gpFileRes->setPortNo(portno);
        }
        else if (strcasecmp(argv[i], "-t") == 0) {
            uint16_t term = 0;
            if (++i >= argc || sscanf(argv[i], "%hu", &term) != 1)
            {
                fprintf(stderr, "invalid file check term: %s\n", argv[i - 1]);
                _exit(0);
            }
            gpFileRes->setFileTermMS(term);
        }
        else
        {
            fprintf(stderr, "invalid parameter  %s\n", argv[i++]);
            return false;
        }
    }
    if(strlen(pConfig->httpFilePath) < 6)
        gpFileRes->setRootPath(nullptr);
    if(pConfig->inputURL == nullptr || pConfig->outputID == nullptr)
        return false;

    return true;
}

void*   fileserverThread(void *arg){
    webserver ws = create_webserver(gpFileRes->getPortNo());

    ws.register_resource("/", gpFileRes, true);
    ws.start(true);
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
            ret = gpOFile->EncodeWrite();
        }
    }
    av_frame_free(&pFrame);
}

void initConfig(){
    memset(&sConfig, 0, sizeof(SinkConfig));
    sConfig.bProcessRun     = true;
    sConfig.inputURL        = nullptr;
    sConfig.outputID        = nullptr;
    sConfig.term            = 1000;
    sConfig.lastSegno       = 0;
}

int main(int argc, char* argv[])
{
    pthread_t progPid;

    signal(SIGINT, signal_callback_handler);
    initConfig();

    gpFileRes   = new FileResponse(&sConfig);

    if(!parseArguments(&sConfig, argc, argv) || !sConfig.inputURL)
    {
        PrintHelp(true);
        return 1;
    }

    avformat_network_init();
    av_log_set_level(AV_LOG_QUIET);

    pthread_create(&progPid, NULL, fileserverThread, NULL);

    gpIFile     = make_shared<MediaIn>(&sConfig);
    gpOFile     = make_shared<MediaOut>(&sConfig);

    if (!gpIFile || !gpIFile->Open()) {
        fprintf(stderr, "can't open %s\n", sConfig.inputURL);
        assert(0);
    }
    bool bRet = gpOFile->Open(gpIFile.get());
    if(!bRet){
        fprintf(stderr, "can't write to output.. \n");
        assert(0);
    }

    bRet = CheckConfigs();
    if(!bRet){
        fprintf(stderr, "erro from Config setting.. \n");
        assert(0);
    }

    FileConcatLoop();

    pthread_cancel(progPid);
    deleteAllHandles();
    FUNCPRINT "Exiting audioproc.. " << endl;

    return 0;
}
