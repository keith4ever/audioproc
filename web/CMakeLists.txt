#
# Copyright (c) 2016 AlcaCruz Inc.
# All content herein is protected by U.S. copyright and other applicable intellectual property laws
# and may not be copied without the expressive permission of AlcaCruz Inc., which reserves all rights.
# Reuse of any of the content for any purpose without the permission of AlcaCruz Inc.
# is strictly and expressively prohibited.
#
cmake_minimum_required(VERSION 3.3.0)
project(decoder)

set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -std=c++11")

set(FFMPEG_INCS  	ffmpeg_x86/include)
set(FFMPEG_LIBS 	ffmpeg_x86/lib)

message("-- CMAKE_BUILD_TYPE: ${CMAKE_BUILD_TYPE}")
message("-- ffmpeg_libs is ${FFMPEG_LIBS}")

include_directories(
        ${APP_INC_PATH}
        ${FFMPEG_INCS}
        /home/projects/emsdk/upstream/emscripten/system/include
)

link_directories(
        ${FFMPEG_LIBS}
        ${CMAKE_SOURCE_DIR}
        /usr/lib64
        /usr/lib/x86_64-linux-gnu
)

set(SOURCE_FILES
        h265/main.cpp
        h265/utils.cpp
        h265/parsedecode.cpp
        h265/queue.cpp
        h265/download.cpp
        h264/main.cpp
        h264/utils.cpp
        h264/remux.cpp
        h264/download.cpp
        )

if(${CMAKE_SYSTEM_NAME} STREQUAL Linux)
    set(DYNAMIC_LIBRARIES
            libm.so
            libz.so
            libdl.so
            libpthread.so
            libcurl.so
            libssl.so
            libcrypto.so
            libsrt.so
        )
    set(STATIC_LIBRARIES
            libavformat.a
            libavcodec.a
            libavutil.a
            libswresample.a
            libswscale.a
        )
endif(${CMAKE_SYSTEM_NAME} STREQUAL Linux)

add_executable(decoder
        ${SOURCE_FILES}
        )

SET(CMAKE_SHARED_LIBRARY_LINK_CXX_FLAGS "")

target_link_libraries(decoder ${STATIC_LIBRARIES} ${DYNAMIC_LIBRARIES} )
