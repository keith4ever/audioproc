/*
 * Copyright (c) 2014 - present AlcaCruz Inc.
 * All content herein is protected by U.S. copyright and other applicable intellectual property laws
 * and may not be copied without the expressive permission of AlcaCruz Inc., which reserves all rights.
 * Reuse of any of the content for any purpose without the permission of AlcaCruz Inc.
 * is strictly and expressively prohibited.
 */

#include "FileServer.h"

using json = nlohmann::json;

FileResponse::FileResponse(SinkConfig* pConfig)
{
    m_pConfig = pConfig;
    memset(m_pConfig->httpFilePath, 0, sizeof(m_pConfig->httpFilePath));
    m_pConfig->httpPort = 8080;  // default listening port no is 8080
    m_pConfig->httpFilecheckterm = 1000;
}

FileResponse::~FileResponse()
{

}

shared_ptr<http_response> FileResponse::getRESTfulResponse(string api) {
    if(api.find("muselive") == string::npos)
        return nullptr;

    json jsonresp;
    jsonresp["id"]    =   m_pConfig->outputID;
    jsonresp["seg"]   =   m_pConfig->lastSegno;
    return shared_ptr<http_response>(new string_response(jsonresp.dump()));
}

const shared_ptr<http_response> FileResponse::render_GET(const http_request& req)
{
    //print_timestamp();
    string filepath = get_local_filepath(req);
    string clientip = req.get_requestor();

    cout << "<" << clientip << "> ";
    auto response = getRESTfulResponse(filepath);
    if(response != nullptr)
        return response;

    if(filepath.length() < 16) {
        cout << "Invalid Path: " << req.get_path() << endl;
        return sendError((char*)"Invalid Path", 404);
    }

    string uri(m_pConfig->httpFilePath);
    uri += filepath;
    cout << "Requested for: " << uri << endl;

    int repeat = 0;
    while(1){
        if(access(uri.c_str(), F_OK) != -1) break;
        if(repeat++ > (m_pConfig->httpFilecheckterm / 100)) {
            cout << "File Not Found: " << uri << endl;
            return sendError((char*)"File Not Found", 404);
        }
        usleep(100000);         // 100ms
    }

    response = shared_ptr<file_response>(new file_response(uri, 200, "application/octet-stream"));
    response->with_header("Access-Control-Allow-Origin","*");

    return response;
    //file_response(uri, 200, "video/webm"));
    //return shared_ptr<file_response>(new file_response(uri, 200, "text/plain"));
}

void FileResponse::print_timestamp()
{
    time_t now = time(0);
    char* dt = ctime(&now);
    dt[strlen(dt)-1] = 0;   // removing tailing new line character

    cout << "[" << dt << "] ";
}

string FileResponse::get_local_filepath(const http_request& req)
{
    string path = req.get_path();

    // the requested path has to start either with "muselive"
    // muselive/ff199aa1-b586-470b-8312-530ced0a44f7/ff199aa1-b586-470b-8312-530ced0a44f7_0_10.mkv
    string servstr("/");
    size_t pos = path.find(servstr);
    if(pos == string::npos){
        path.clear();
        return path;
    }

    return path;
}

shared_ptr<string_response> FileResponse::sendError(char* msg, int code)
{
    switch (code){
    case 404:
    case 403:
        return shared_ptr<string_response>(new string_response(msg, code, "text/plain"));
    default:
        return shared_ptr<string_response>(new string_response("Unknown Error", 422, "text/plain"));
    }
}

void FileResponse::setRootPath(char *path) {
    if(path == nullptr)
        getcwd(m_pConfig->httpFilePath, 128);
    else strcpy(m_pConfig->httpFilePath, path);

    // the tailing / is not needed at the base URL
    if(m_pConfig->httpFilePath[strlen(m_pConfig->httpFilePath)-1] == '/') {
        m_pConfig->httpFilePath[strlen(m_pConfig->httpFilePath)-1] = 0;
    }
}

void FileResponse::setFileTermMS(int term) {
    if(term < 1000) term = 1000;
    m_pConfig->httpFilecheckterm = term;
}
