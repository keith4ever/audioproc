#!/bin/bash

echo " "
echo "** Usage: $0 [arm | x86] "
echo " "

ARCH=$1

if [ -z "$ARCH" ]; then
    echo "Arch is x86.."
    ARCH="x86"
fi
rm -rf superStreamSDK/h264muxer_${ARCH}.*
rm -rf h264muxer_${ARCH}.wasm

export TOTAL_MEMORY=64MB
export EXPORTED_FUNCTIONS="[ \
    '_h264fsdDownParse', \
    '_h264initRemuxer', \
    '_h264deinitRemuxer', \
    '_h264openRemuxer', \
    '_h264setCallBack', \
    '_h264readWrite', \
    '_h264downloadSegment', \
    '_h264changeSrcIdx', \
    '_h264changeLiveEndSeg', \
    '_h264setError', \
    '_malloc', \
    '_memset', \
    '_free'
]"

#    -s INITIAL_MEMORY=67108864 \
#   -msse -msimd128 \
#   -s NO_EXIT_RUNTIME=1 \
#   --profiling \
#  -s ALLOW_MEMORY_GROWTH \
#  -s ASSERTIONS=1 \
#   -s PROXY_TO_PTHREAD=1 \
#   -s SAFE_HEAP=1 \
#  -s USE_PTHREADS=1 \
#  -s USE_SDL=2 \
#  -s PTHREAD_POOL_SIZE=4 \
#   -s FORCE_FILESYSTEM=1 \
echo "Running Emscripten..."
emcc -std=c++11 \
  h264/main.cpp \
  h264/utils.cpp \
  h264/remux.cpp \
  h264/download.cpp \
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
  -s RESERVED_FUNCTION_POINTERS=24 \
  -o superStreamSDK/h264muxer_${ARCH}.js

#mv superStreamSDK/h264muxer_${ARCH}.wasm .
#js-beautify h264.js >h264.js.tmp
#mv -f h264.js.tmp h264.js

echo ""
echo "==================================="
echo "== Decoder Wasm Build Completed  =="
echo "==================================="
