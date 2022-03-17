# audioproc
<< Building & Execution Instruction >>
```
git clone https://github.com/keith4ever/audioproc
cd audioproc
mkdir build
cd build
cmake ..
make clean; make -j 8
./mediaproc -i http://0.0.0.0:9981/muselive -o output 

```

<< Sending FLAC source >>
```
keith@mercury:/home/projects/muselive/muselive-transcoder$ musesource.sh sample.flac 10.1.10.15
===============================================
===== MuseLive WAV/FLAC source streaming ======
===============================================
 
** Usage 1: Live feed (rtmp://<IP addr>:9981/muselive)
 => /home/keith/bin/musesource.sh [filename] [ipaddress] 
** Usage 2: kill all processes
 => /home/keith/bin/musesource.sh kill
 
[sudo] password for keith: 
keith@mercury:/home/projects/muselive/muselive-transcoder$ sudo ffmpeg -f concat -safe 0 -re -i 9981.txt -loglevel quiet     -c copy -f flac -listen 0 http://10.1.10.15:9981/muselive 
ffmpeg version 4.2.4-1ubuntu0.1 Copyright (c) 2000-2020 the FFmpeg developers
  built with gcc 9 (Ubuntu 9.3.0-10ubuntu2)
  configuration: --prefix=/usr --extra-version=1ubuntu0.1 --toolchain=hardened --libdir=/usr/lib/x86_64-linux-gnu --incdir=/usr/include/x86_64-linux-gnu --arch=amd64 --enable-gpl --disable-stripping --enable-avresample --disable-filter=resample --enable-avisynth --enable-gnutls --enable-ladspa --enable-libaom --enable-libass --enable-libbluray --enable-libbs2b --enable-libcaca --enable-libcdio --enable-libcodec2 --enable-libflite --enable-libfontconfig --enable-libfreetype --enable-libfribidi --enable-libgme --enable-libgsm --enable-libjack --enable-libmp3lame --enable-libmysofa --enable-libopenjpeg --enable-libopenmpt --enable-libopus --enable-libpulse --enable-librsvg --enable-librubberband --enable-libshine --enable-libsnappy --enable-libsoxr --enable-libspeex --enable-libssh --enable-libtheora --enable-libtwolame --enable-libvidstab --enable-libvorbis --enable-libvpx --enable-libwavpack --enable-libwebp --enable-libx265 --enable-libxml2 --enable-libxvid --enable-libzmq --enable-libzvbi --enable-lv2 --enable-omx --enable-openal --enable-opencl --enable-opengl --enable-sdl2 --enable-libdc1394 --enable-libdrm --enable-libiec61883 --enable-nvenc --enable-chromaprint --enable-frei0r --enable-libx264 --enable-shared
  libavutil      56. 31.100 / 56. 31.100
  libavcodec     58. 54.100 / 58. 54.100
  libavformat    58. 29.100 / 58. 29.100
  libavdevice    58.  8.100 / 58.  8.100
  libavfilter     7. 57.100 /  7. 57.100
  libavresample   4.  0.  0 /  4.  0.  0
  libswscale      5.  5.100 /  5.  5.100
  libswresample   3.  5.100 /  3.  5.100
  libpostproc    55.  5.100 / 55.  5.100
Input #0, concat, from '9981.txt':
  Duration: N/A, start: 0.000000, bitrate: N/A
    Stream #0:0: Audio: flac, 48000 Hz, stereo, s16
Output #0, flac, to 'http://10.1.10.15:9981/muselive':
  Metadata:
    encoder         : Lavf58.29.100
    Stream #0:0: Audio: flac, 48000 Hz, stereo, s16
Stream mapping:
  Stream #0:0 -> #0:0 (copy)
Press [q] to stop, [?] for help

```

<< Player by ffplay >>

```
keith@mercury:/home/projects/muselive$ ffplay http://10.1.10.15:8080/output/output.m3u8
ffplay version 4.2.4-1ubuntu0.1 Copyright (c) 2003-2020 the FFmpeg developers
  built with gcc 9 (Ubuntu 9.3.0-10ubuntu2)
  configuration: --prefix=/usr --extra-version=1ubuntu0.1 --toolchain=hardened --libdir=/usr/lib/x86_64-linux-gnu --incdir=/usr/include/x86_64-linux-gnu --arch=amd64 --enable-gpl --disable-stripping --enable-avresample --disable-filter=resample --enable-avisynth --enable-gnutls --enable-ladspa --enable-libaom --enable-libass --enable-libbluray --enable-libbs2b --enable-libcaca --enable-libcdio --enable-libcodec2 --enable-libflite --enable-libfontconfig --enable-libfreetype --enable-libfribidi --enable-libgme --enable-libgsm --enable-libjack --enable-libmp3lame --enable-libmysofa --enable-libopenjpeg --enable-libopenmpt --enable-libopus --enable-libpulse --enable-librsvg --enable-librubberband --enable-libshine --enable-libsnappy --enable-libsoxr --enable-libspeex --enable-libssh --enable-libtheora --enable-libtwolame --enable-libvidstab --enable-libvorbis --enable-libvpx --enable-libwavpack --enable-libwebp --enable-libx265 --enable-libxml2 --enable-libxvid --enable-libzmq --enable-libzvbi --enable-lv2 --enable-omx --enable-openal --enable-opencl --enable-opengl --enable-sdl2 --enable-libdc1394 --enable-libdrm --enable-libiec61883 --enable-nvenc --enable-chromaprint --enable-frei0r --enable-libx264 --enable-shared
  libavutil      56. 31.100 / 56. 31.100
  libavcodec     58. 54.100 / 58. 54.100
  libavformat    58. 29.100 / 58. 29.100
  libavdevice    58.  8.100 / 58.  8.100
  libavfilter     7. 57.100 /  7. 57.100
  libavresample   4.  0.  0 /  4.  0.  0
  libswscale      5.  5.100 /  5.  5.100
  libswresample   3.  5.100 /  3.  5.100
  libpostproc    55.  5.100 / 55.  5.100
[hls @ 0x7fb428000bc0] Skip ('#EXT-X-VERSION:3')B sq=    0B f=0/0   
[hls @ 0x7fb428000bc0] Opening 'http://localhost:8080/output/output_00054.ts' for reading
[hls @ 0x7fb428000bc0] Opening 'http://localhost:8080/output/output_00055.ts' for reading
[http @ 0x7fb42801d140] Opening 'http://localhost:8080/output/output_00056.ts' for reading
[hls @ 0x7fb428000bc0] Skip ('#EXT-X-VERSION:3')B sq=    0B f=0/0   
[http @ 0x7fb42801d140] Opening 'http://localhost:8080/output/output_00057.ts' for reading
Input #0, hls, from 'http://localhost:8080/output/output.m3u8':
  Duration: N/A, start: 54.016000, bitrate: N/A
  Program 0 
    Metadata:
      variant_bitrate : 0
    Stream #0:0: Audio: aac (LC) ([15][0][0][0] / 0x000F), 48000 Hz, stereo, fltp
    Metadata:
      variant_bitrate : 0

```

<< Console Output >>
```
./mediaproc -i http://0.0.0.0:9981/muselive -o output
[Open] sample rate: 48000, channel: 2, format: 1, codec: flac


=================================================================
* mediaproc ver. 1.01 - All rights reserved by Keith Ha. *
=================================================================
=================================================================
    root file path  : "/home/projects/muselive/storage"
    file check term : 1000 (ms)
    play m3u8 URL   : "http://<IPaddr>:8080/output/output.m3u8"
    service started : [Thu Mar 17 12:05:39 2022] 
    input           : "http://0.0.0.0:9981/muselive"
    output ID       : "output"
=================================================================

<127.0.0.1> Requested for: /home/projects/muselive/storage/output/output.m3u8
<127.0.0.1> Requested for: /home/projects/muselive/storage/output/output_00054.ts
<127.0.0.1> Requested for: /home/projects/muselive/storage/output/output_00055.ts
<127.0.0.1> Requested for: /home/projects/muselive/storage/output/output_00056.ts
<127.0.0.1> Requested for: /home/projects/muselive/storage/output/output.m3u8
```
