#!/bin/bash

echo " "
echo "** Usage: $0 [arm | x86] "
echo " "

ARCH=$1

if [ -z "$ARCH" ]; then
    echo "Arch is x86.."
    ARCH="x86"
fi
rm -rf js/muxer_${ARCH}.*

export TOTAL_MEMORY=64MB
export EXPORTED_FUNCTIONS="[ \
    '_initRemuxer', \
    '_deinitRemuxer', \
    '_openRemuxer', \
    '_setCallBack', \
    '_readWrite', \
    '_downloadSegment', \
    '_setError', \
    '_malloc', \
    '_memset', \
    '_free'
]"

echo "Running Emscripten..."
emcc -std=c++11 \
  cpp/main.cpp \
  cpp/utils.cpp \
  cpp/remux.cpp \
  cpp/download.cpp \
  ffmpeg_${ARCH}/lib/libavformat.a \
  ffmpeg_${ARCH}/lib/libavcodec.a \
  ffmpeg_${ARCH}/lib/libavutil.a \
  ffmpeg_${ARCH}/lib/libswscale.a \
  -I "ffmpeg_${ARCH}/include" \
  -O3 \
  -v \
  --profiling \
  -s ENVIRONMENT=web \
  -s WASM=1 \
  -s FETCH=1 \
  -s SINGLE_FILE=1 \
  -s ALLOW_MEMORY_GROWTH \
  -s TOTAL_MEMORY=${TOTAL_MEMORY} \
  -s EXPORTED_FUNCTIONS="${EXPORTED_FUNCTIONS}" \
  -s EXPORTED_RUNTIME_METHODS="['addFunction']" \
  -s RESERVED_FUNCTION_POINTERS=16 \
  -o js/muxer_${ARCH}.js

echo ""
echo "==================================="
echo "== Decoder Wasm Build Completed  =="
echo "==================================="
