#!/bin/sh
TARGET=$1
FLAVOR=$2
THIRD=$3

if [ "$#" -lt 1 ]; then
    echo "Usage: $0 <lib | rebuild | clean> [rel|deb] [output]"
    exit -1
fi

# ERROR: srt >= 1.3.0 not found using pkg-config
# in order to fix this, run 'sudo apt install libsrt-dev'

BUILD_CMD="../ffmpeg/configure --enable-static --disable-shared --disable-programs \
--disable-ffplay --disable-ffmpeg --disable-ffprobe --disable-avfilter \
--disable-doc --disable-symver --disable-postproc --disable-gpl --disable-encoders \
--disable-muxers --disable-bsfs --disable-protocols --disable-indevs \
--disable-outdevs --disable-devices --disable-decoders --disable-avdevice \
--disable-parsers --disable-demuxers --disable-filters --disable-hwaccels \
--disable-debug --disable-indevs --disable-outdevs \
--enable-encoder="flac,aac,mp3,mp4,m4a,wav,pcm_s16le,matroska" \
--enable-decoder="flac,aac,mp3,mp4,m4a,wav,pcm_s16le,matroska" \
--enable-parser="matroska,flac,aac,mp3,mp4,m4a,wav,pcm_s16le" \
--enable-demuxer="matroska,flac,aac,mp3,mp4,m4a,mov,wav,pcm_s16le,pcm_f32le,adts,rtsp" \
--enable-muxer="matroska,flac,aac,mp3,mp4,m4a,mov,wav,pcm_s16le,pcm_f32le,adts,rtsp" \
--enable-protocol=file,http,tcp,rtmp,rtsp,rtp \
--prefix=${PWD} --libdir=${PWD}/muselive/lib --incdir=${PWD}/muselive/inc "


DEBUG_CMD="--enable-debug --disable-optimizations --disable-stripping "
RELEASE_CMD="--disable-debug --enable-optimizations --enable-stripping"
OSTR=`uname`

copy_headers()
{
	mkdir muselive/inc
	cp src/libavformat/*.h muselive/inc/libavformat/.
	cp src/libavutil/internal.h muselive/inc/libavutil/.
	mkdir muselive/inc/libavutil/x86
	cp src/libavutil/x86/asm.h muselive/inc/libavutil/x86/.
	mkdir muselive/inc/libavresample 
	cp src/libavresample/avresample.h muselive/inc/libavresample/.
	cp src/libavutil/version.h muselive/inc/libavutil/.
	cp src/libavutil/x86/emms.h muselive/inc/libavutil/x86/.
	cp src/libavutil/libm.h muselive/inc/libavutil/.
	cp src/libavcodec/mathops.h muselive/inc/libavcodec/.
	cp src/libavutil/time_internal.h muselive/inc/libavutil/.
	cp src/libavutil/timer.h muselive/inc/libavutil/.
	cp src/libavutil/x86/timer.h muselive/inc/libavutil/x86/.
	cp src/libavresample/version.h muselive/inc/libavresample/.
	mkdir muselive/inc/libavcodec/x86
	cp src/libavcodec/x86/mathops.h muselive/inc/libavcodec/x86/.
	cp src/libavcodec/vdpau.h muselive/inc/libavcodec/.
}

case "$TARGET" in
	lib)
        BUILD_CMD="$BUILD_CMD"
		;;
	rebuild)
		make -j 10
		make install
		exit 0
		;;
	clean)
		make clean
		rm -rf muselive/* 
		rm -rf debug*
		rm -rf config*
		rm -rf bin
		exit 0
		;;
	*)
		echo "build target = lib | rebuild | clean"
		exit -1
		;;
esac

case "$FLAVOR" in
	rel)
		BUILD_CMD="$BUILD_CMD $RELEASE_CMD"
		;;
	deb)
		BUILD_CMD="$BUILD_CMD $DEBUG_CMD"
		;;
	*)
		BUILD_CMD="$BUILD_CMD $DEBUG_CMD"
		;;
esac

echo "** Running this build command **"
echo $BUILD_CMD
$BUILD_CMD
make -j 10
make install
copy_headers
