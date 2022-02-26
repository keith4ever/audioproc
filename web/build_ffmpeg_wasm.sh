#!/bin/sh

echo "==================================="
echo "=== Beginning FFMPEG Wasm Build ==="
echo "==================================="
echo ""
echo "NOTE: did you run source ./emsdk/emsdk_env.sh ??"
echo ""
echo "** deleting previous build files **"

rm -r dist
rm -rf debug*
rm -rf config*
rm -rf ffbuild
rm -rf doc
rm -rf *.o


echo " "
echo "** Usage: $0 [arm | x86] "
echo " "

ARCH=$1

if [ -z "$ARCH" ]; then
    echo "assuming this is for x86 arch..."
    ARCH="x86"
fi

mkdir -p dist
#cd /home/projects/videocore/ffmpeg
echo ""
echo "** emsdk configure **"
echo ""

CFLAGS="-s USE_PTHREADS=1 -O3 -Wl,--export=__heap_base -Wl,--export=__data_end -Wl,--export=malloc -Wl,--export=free "
LDFLAGS="$CFLAGS"
emconfigure ../ffmpeg/configure \
  --prefix=./webffmpeg \
  --enable-cross-compile \
  --target-os=none \
  --arch=${ARCH} \
  --disable-x86asm \
  --disable-inline-asm \
  --objcc=emcc \
  --dep-cc=emcc \
  --cpu=generic \
  --cc=emcc \
  --cxx=em++ \
  --ar=emar \
  --ranlib=emranlib \
  --extra-cflags="$CFLAGS" \
  --extra-cxxflags="$CFLAGS" \
  --extra-ldflags="$LDFLAGS" \
  --disable-avdevice \
  --disable-swresample \
  --disable-postproc \
  --disable-avfilter \
  --disable-programs \
  --disable-logging \
  --disable-everything \
  --enable-avformat \
  --disable-ffplay \
  --disable-ffprobe \
  --disable-asm \
  --disable-doc \
  --disable-devices \
  --disable-network \
  --disable-hwaccels \
  --disable-parsers \
  --disable-bsfs \
  --disable-debug \
  --disable-indevs \
  --disable-outdevs \
  --enable-decoder="matroska,flac,aac,mp3,m4a" \
  --enable-parser="matroska,flac,aac,mp3,m4a" \
  --enable-demuxer="matroska,flac,aac,mp3,m4a" \
  --enable-muxer="matroska,flac,aac,mp3,m4a" \
  --enable-optimizations \
  --enable-stripping \
  --enable-protocol=file 

if [ -f "Makefile" ]; then
  echo "make clean"
  make clean
fi
echo "make"
emmake make -j 8
echo "make install"
make install

rm -rf lib*

echo ""
echo "==================================="
echo "=== FFMPEG Wasm Build Completed ==="
echo "==================================="
