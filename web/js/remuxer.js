if(navigator.userAgent.includes("x64") || navigator.userAgent.includes("x86")
    || navigator.userAgent.includes("Intel"))
    self.arch = "x86";
else self.arch = "arm";

JSloaded = function (){
    if(self.remuxer == null) return;

    self.remuxer.wasmLoaded = true;
    self.remuxer.setCallback();
}

Module = {
    locateFile: (file) => file,
    onRuntimeInitialized: JSloaded,
    //mainScriptUrlOrBlob: "h264muxer_" + self.arch +".js",
};

function Remuxer() {
    this.logger             = new Logger("Remuxer");
    this.wasmLoaded         = false;
    this.videoCallback      = null;
    this.audioCallback      = null;
    this.msgCallback        = null;
    this.idxCallback        = null;
    self.remuxer            = this;
    this.player             = null;
    this.url                = null;
    this.prevTime           = new Date(Date.now());
    this.initVars();
    this.locationPath       = "js/";
    this.loadJS('print.js', null);
    this.loadJS('consts.js', null);
    this.loadJS("muxer_" + self.arch +".js", null);
}

Remuxer.prototype.initVars = function(){
    this.dataInFifo         = 0;
    this.cacheBuffer        = null;
    this.remuxing           = false;
    this.reachedEnd         = false;
    this.fps                = 0;
    this.firstSegNo         = 0;
    this.prevPlayTime       = 0;
};

Remuxer.prototype.loadJS = function (url, callback) {
    // Adding the script tag to the head as suggested before
    var head = document.getElementsByTagName('head')[0];
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = this.locationPath + url;

    //console.log(url + " is loaded..");
    script.onreadystatechange = callback;
    script.onload = callback;

    // Fire the loading
    head.appendChild(script);
};

Remuxer.prototype.setPlayer = function (player) {
    this.player = player;
    this.setCallback();
};

Remuxer.prototype.getFSD = function (url, firstSegNo) {
    this.url = url;
    this.firstSegNo = firstSegNo;

    this.parseFSDplay();
};

Remuxer.prototype.parseFSDplay = function (){
    if(!this.wasmLoaded || this.url == null){
        setTimeout(this.parseFSDplay.bind(this), 20);
        return;
    }

    var buf = new ArrayBuffer(this.url.length);
    var bufView = new Uint8Array(buf);
    for(var i = 0; i < this.url.length; i++)
        bufView[i] = this.url.charCodeAt(i);

    this.cacheBuffer = Module._malloc(256);
    Module._memset(this.cacheBuffer, 0 , 256);
    Module.HEAPU8.set(bufView, this.cacheBuffer);

    //this.logger.logInfo("Downloading FSD info: " + req.u + ", segno: " + req.s);
    var ret = Module._h264fsdDownParse(this.cacheBuffer, this.firstSegNo, this.msgCallback);
    //Module._h264fetchFSD(this.msgCallback);
    Module._free(this.cacheBuffer);
    this.cacheBuffer = null;
}

Remuxer.prototype.initRemuxer = function (url, firstSec, srcIdx, cores, bAllDown) {
    var buf = new ArrayBuffer(url.length);
    var bufView = new Uint8Array(buf);
    for(var i = 0; i < url.length; i++)
        bufView[i] = url.charCodeAt(i);

    this.cacheBuffer = Module._malloc(256 * 1024);
    Module._memset(this.cacheBuffer, 0 , 256*1024);
    Module.HEAPU8.set(bufView, this.cacheBuffer);

    Module._h264initRemuxer(this.cacheBuffer, firstSec, srcIdx, cores, bAllDown);
    // these two deinit and init fixes no value pts issue.. TODO
    Module._h264deinitRemuxer(1);
    Module._h264initRemuxer(this.cacheBuffer, firstSec, srcIdx, cores, bAllDown);
    Module._h264setCallBack(this.videoCallback, this.audioCallback,
                            this.msgCallback, this.idxCallback);
};

Remuxer.prototype.deinitRemuxer = function () {
    this.stopRemuxing();

    var ret = Module._h264deinitRemuxer(0);
    this.logger.logInfo("Deinit CruzTV WASM: " + ret);
    if (this.cacheBuffer != null) {
        Module._free(this.cacheBuffer);
        this.cacheBuffer = null;
    }
    this.initVars();
};

Remuxer.prototype.openRemuxer = function () {
    var paramCount = 6;
    var paramSize = 4;
    var paramByteBuffer = null;
    var ret = 0;
    try{
        paramByteBuffer = Module._malloc(paramCount * paramSize);
        ret = Module._h264openRemuxer(paramByteBuffer, paramCount);
        this.logger.logInfo("Opening CruzTV WASM..");
    } catch (e) {
        this.logger.logError("error from openRemuxer: " + e);
        this.handleError(e);
        return;
    }

    if (ret == 0) {
        var paramIntBuff    = paramByteBuffer >> 2;
        var paramArray      = Module.HEAP32.subarray(paramIntBuff, paramIntBuff + paramCount);
        var duration        = paramArray[0];
        this.fps            = paramArray[1];
        var vnum            = paramArray[2];
        var segterm         = paramArray[3];
        var videoWidth      = paramArray[4];
        var videoHeight     = paramArray[5];

        var objData = {
            t: constInitRsp,
            e: ret,
            v: {
                d: duration,
                p: this.fps,
                w: videoWidth,
                h: videoHeight,
                v: vnum,
                s: segterm
            }
        };
        this.player.onInitRemuxer(objData);
    } else {
        var objData = {
            t: constInitRsp,
            e: ret
        };
        this.player.onInitRemuxer(objData);
    }
    Module._free(paramByteBuffer);
};

Remuxer.prototype.startRemuxing = function () {
    if(this.remuxing) return;

    this.logger.logInfo("Start CruzTV WASM");
    this.remuxing = true;
    this.readWrite(); // use idle CPU cycle, in a single thread
};

Remuxer.prototype.stopRemuxing = function () {
    if(!this.remuxing) return;

    this.logger.logInfo("Stop CruzTV WASM");
    this.remuxing = false;
};

Remuxer.prototype.handleError = function (e) {
    this.reachedEnd = true;
    this.player.onError(e);
}

Remuxer.prototype.setRemuxError = function (e) {
    Module._h264setError(e);
}

Remuxer.prototype.readWrite = function () {
    if(!this.remuxing) return;

    let currPlayTime = this.player.domVideo.currentTime;
    let currTime = new Date(Date.now());
    var timeDiff = (currTime - this.prevTime);
    let delay = 20, repeat = 0, bufferTimeLimit;

    if((currPlayTime - this.prevPlayTime)*1000 < 5){
        if(timeDiff >= 30) // for the past 50ms, there was no progress in play
            bufferTimeLimit = segmentFrameBufferTime;
        else bufferTimeLimit = this.player.highBuffLevel;
    }
    else{
        bufferTimeLimit = this.player.highBuffLevel;
        this.prevTime = currTime;
        this.prevPlayTime = currPlayTime;
    }

    var aBuffTime = this.player.calcBufTime(1);
    var vBuffTime = this.player.calcBufTime(0);
    if(vBuffTime < 0) vBuffTime = 0;
    try{
        while((aBuffTime <= bufferTimeLimit || vBuffTime < bufferTimeLimit || this.reachedEnd)
            && repeat++ < 3) {
            var ret = Module._h264readWrite(aBuffTime * 1000, vBuffTime * 1000);
            if (ret > 0) this.dataInFifo = ret; // dataInFifo is same as the one in h265player.js

            if ((aBuffTime > this.player.lowBuffLevel || this.dataInFifo < (256 << 10))
             && !this.reachedEnd)
                break;
            aBuffTime = this.player.calcBufTime(1);
            vBuffTime = this.player.calcBufTime(0);
        }

        if (this.remuxing) { // after each video frame decoding, invoke next decode() by the time diff
            //this.frameBuffTime -= delay;
            setTimeout(this.readWrite.bind(this), delay);
        }
    } catch (e) {
        this.logger.logError("error from readWrite: " + e);
        this.handleError(e);
        return;
    }
};

Remuxer.prototype.downloadSegment = function(){
    if(!this.remuxing || this.reachedEnd) return;

    try{
        var ret = Module._h264downloadSegment();
        if(ret < 0){
            this.logger.logInfo("End reached...");
            this.reachedEnd = true;
            this.player.endReached = true;
        }
    } catch (e) {
        this.logger.logError("error from segment downloader: " + e);
        this.handleError(e);
        return;
    }

    //this.logger.logInfo(Math.round(this.frameBuffTime) + " : " + ret);
};

Remuxer.prototype.changeSrcIdx = function(idx){
    Module._h264changeSrcIdx(idx);
};

Remuxer.prototype.changeLiveEndSeg = function(seg){
    //this.logger.logInfo("changeLiveEndSeg, SN: " + seg);
    Module._h264changeLiveEndSeg(seg);
}

Remuxer.prototype.setCallback = function () {
    if(!this.wasmLoaded || this.videoCallback != null) return;
    this.logger.logInfo(" CruzTV WASM loaded:" + "h264muxer_" + self.arch +".js");

    let me = this;
    this.audioCallback = Module.addFunction(function (buff, size, fifo, timestamp) {
        var outArray = Module.HEAPU8.subarray(buff, buff + size);
        var data = new Uint8Array(outArray);
        var objData = {
            a: 1,
            s: timestamp,
            f: fifo,
            d: data
        };
        me.player.onFrameInput(objData);
    }, 'viiid');

    this.videoCallback = Module.addFunction(function (buff, size, fifo, timestamp) {
        var outArray = Module.HEAPU8.subarray(buff, buff + size);
        var data = new Uint8Array(outArray);
        var objData = {
            a: 0,
            s: timestamp,
            f: fifo,
            d: data
        };
        me.player.onFrameInput(objData);
    }, 'viiid');

    this.msgCallback = Module.addFunction(function (msg, buff, size) {
        if(size <= 0){
            me.player.onOtherMsg(msg, null);
        } else {
            var outArray = Module.HEAP8.subarray(buff, buff + size);
            var data = new Int8Array(outArray);
            me.player.onOtherMsg(msg, data);
        }
    }, 'viii');

    this.idxCallback = Module.addFunction(function (frame, pts, idx) {
        me.player.onSrcIdxChange(frame, pts, idx);
    }, 'viii');
};
