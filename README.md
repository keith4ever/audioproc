# audioproc
<< Building & Execution Instruction >>
```
git clone https://github.com/keith4ever/audioproc
cd audioproc
mkdir build
cd build
cmake ..
make clean; make -j 8
audioproc -i http://0.0.0.0:9981/muselive -o output 

```

<< Sample Result >>
```
[Open] sample rate: 48000, channel: 2, format: 1, codec: 86028

=================================================================
* audioproc ver. 1.01 - All rights reserved by Keith Ha. *
=================================================================
=================================================================
    root file path  : "/home/keith/video"
    file check term : 1000 (ms)
    URL             : "http://<IPaddr>:8080/output/output_#seg.mkv"
    service start   : [Tue Mar  1 22:01:32 2022] 
    input           : "http://0.0.0.0:9981/muselive"
    output          : "output"
=================================================================
```
