# audioproc
<< Building & Execution Instruction >>
```
git clone https://github.com/keith4ever/audioproc
cd audioproc
mkdir build
cd build
cmake ..
make clean; make -j 8
./audioproc -i ../sample.wav -o output.aac
```

<< Sample Result >>
```
keith@mercury:/home/projects/temp/audioproc/build$ ./audioproc -i ../sample.wav -o output.aac
[Open] sample rate: 48000, channel: 2, format: 1, codec: 65536

=================================================================
* audioproc ver. 1.00 - All rights reserved by Keith Ha. *
=================================================================
    input           : "../sample.wav"
    output          : "output.aac"
=================================================================

[main] Exiting audioproc.. 
```
