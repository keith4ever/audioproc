#
# Copyright (c) 2014 -     Keith Ha (keith4ever@gmail.com)
# All content herein is protected by U.S. copyright and other applicable intellectual property laws
# and may not be copied without the expressive permission of Keith Ha, who reserves all rights.
# Reuse of any of the content for any purpose without the permission of Keith Ha
# is strictly and expressively prohibited.
#
cmake_minimum_required(VERSION 3.3.0)
project(audioproc)

include(env.cmake)

set(ROOT_PATH		${PROJECT_SOURCE_DIR})

set(CMAKE_C_COMPILER g++)
set(CMAKE_CXX_COMPILER g++)

set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -std=c++11")

set(FFMPEG_INCS  	${ROOT_PATH}/dist/inc)
set(FFMPEG_LIBS 	${ROOT_PATH}/dist/lib)
set(HTTPSERVER_INC   ${ROOT_PATH}/httpd/inc)
set(HTTPSERVER_LIB   ${ROOT_PATH}/httpd/lib)

message("-- FFMPEG lib folder is ${FFMPEG_LIBS}")

include_directories(
        ${APP_INC_PATH}
        ${HTTPSERVER_INC}
        ${FFMPEG_INCS}
        ${VIDEOCORE_COMMON_INC}
)

link_directories(
        ${FFMPEG_LIBS}
        ${HTTPSERVER_LIB}
        ${CMAKE_SOURCE_DIR}
        /usr/lib64
        /usr/lib/x86_64-linux-gnu
)

set(SOURCE_FILES
        MediaIn.cpp
        MediaPacket.cpp
        MediaOut.cpp
        audioproc.cpp
        Queue.cpp
        FileServer.cpp
        )

# sudo apt install libmicrohttpd-dev is required at the host

if(${CMAKE_SYSTEM_NAME} STREQUAL Linux)
    set(DYNAMIC_LIBRARIES
            libm.so
            libz.so
            libdl.so
            libpthread.so
            libgnutls.so
        )
    set(STATIC_LIBRARIES
            libavformat.a
            libavcodec.a
            libavutil.a
            libswresample.a
            libswscale.a
            libhttpserver.a
            libmicrohttpd.a
        )
endif(${CMAKE_SYSTEM_NAME} STREQUAL Linux)

add_executable(audioproc ${SOURCE_FILES})

SET(CMAKE_SHARED_LIBRARY_LINK_CXX_FLAGS "")

target_link_libraries(audioproc ${STATIC_LIBRARIES} ${DYNAMIC_LIBRARIES} )
