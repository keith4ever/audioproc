/*
 * Copyright (c) 2014 - present AlcaCruz Inc.
 * All content herein is protected by U.S. copyright and other applicable intellectual property laws
 * and may not be copied without the expressive permission of AlcaCruz Inc., which reserves all rights.
 * Reuse of any of the content for any purpose without the permission of AlcaCruz Inc.
 * is strictly and expressively prohibited.
 */

#ifndef _FILE_SERVER_H
#define _FILE_SERVER_H

#include <iostream>
#include <string>
#include <ctime>
#include <unistd.h>
#include <httpserver.hpp>
#include <filesystem>
#include "defs.h"

using namespace httpserver;
using namespace std;

class FileResponse : public http_resource
{
public:
    FileResponse(SinkConfig* pConfig);
    ~FileResponse();
    const   shared_ptr<http_response> render_GET(const http_request& req);
    void    setRootPath(char* path);
    void    setPortNo(uint16_t port)        { m_pConfig->httpPort = port; }
    uint16_t getPortNo()                    { return m_pConfig->httpPort; }
    void    setFileTermMS(int term);
    bool    checkSettings();

private:
    SinkConfig* m_pConfig;
    void    print_timestamp();
    string  get_local_filepath(const http_request& req);
    shared_ptr<string_response> sendError(char* msg, int code);
};


#endif //_FILE_SERVER_H
