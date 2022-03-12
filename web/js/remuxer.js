/*
 * Copyright (c) 2014 -     Keith Ha (keith4ever@gmail.com)
 * All content herein is protected by U.S. copyright and other applicable intellectual property laws
 * and may not be copied without the expressive permission of Keith Ha, who reserves all rights.
 * Reuse of any of the content for any purpose without the permission of Keith Ha
 * is strictly and expressively prohibited.
 */

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
    this.audioCallback      = null;
    this.msgCallback        = null;
    self.remuxer            = this;
    this.player             = null;
    this.url                = null;
    this.initVars();
    this.locationPath       = "js/";
    this.loadJS("muxer_" + self.arch +".js", null);
}

Remuxer.prototype.initVars = function(){
    this.dataInFifo         = 0;
    this.cacheBuffer        = null;
    this.remuxing           = false;
    this.reachedEnd         = false;
    this.firstSegNo         = 0;
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

Remuxer.prototype.initRemuxer = function (url, firstSec) {
    if(!this.wasmLoaded) {
        setTimeout(this.initRemuxer.bind(url, firstSec), 50);
        return;
    }
    var buf = new ArrayBuffer(url.length);
    var bufView = new Uint8Array(buf);
    for(var i = 0; i < url.length; i++)
        bufView[i] = url.charCodeAt(i);

    this.cacheBuffer = Module._malloc(256);
    Module._memset(this.cacheBuffer, 0 , 256);
    Module.HEAPU8.set(bufView, this.cacheBuffer);

    Module._initRemuxer(this.cacheBuffer, firstSec);
    // these two deinit and init fixes no value pts issue.. TODO
    Module._deinitRemuxer(1);
    Module._initRemuxer(this.cacheBuffer, firstSec);
    Module._setCallBack(this.audioCallback, this.msgCallback);
};

Remuxer.prototype.deinitRemuxer = function () {
    this.stopRemuxing();

    var ret = Module._deinitRemuxer(0);
    this.logger.logInfo("Deinit WASM: " + ret);
    if (this.cacheBuffer != null) {
        Module._free(this.cacheBuffer);
        this.cacheBuffer = null;
    }
    this.initVars();
};

Remuxer.prototype.openRemuxer = function () {
    var ret = 0;
    try{
        ret = Module._openRemuxer();
        this.logger.logInfo("Opening WASM..");
    } catch (e) {
        this.logger.logError("error from openRemuxer: " + e);
        this.handleError(e);
        return;
    }

    this.player.onInitRemuxer();
};

Remuxer.prototype.startRemuxing = function () {
    if(this.remuxing) return;

    this.logger.logInfo("Start WASM");
    this.remuxing = true;
    this.readWrite(); // use idle CPU cycle, in a single thread
};

Remuxer.prototype.stopRemuxing = function () {
    if(!this.remuxing) return;

    this.logger.logInfo("Stop WASM");
    this.remuxing = false;
};

Remuxer.prototype.handleError = function (e) {
    this.reachedEnd = true;
    this.player.onError(e);
}

Remuxer.prototype.setRemuxError = function (e) {
    Module._setError(e);
}

Remuxer.prototype.readWrite = function () {
    if(!this.remuxing) return;

    let delay = 20, repeat = 0;

    var aBuffTime = this.player.calcBufTime();
    try{
        while((aBuffTime <= normalFrameBufferTime || this.reachedEnd)
            && repeat++ < 5) {
            //var ret = Module._readWrite(aBuffTime * 1000);
            var ret = Module._downloadSegment(aBuffTime * 1000);
            if (ret > 0) this.dataInFifo = ret; // dataInFifo is same as the one in h265player.js

            if ((aBuffTime > lowFrameBufferTime) && !this.reachedEnd)
                break;
            aBuffTime = this.player.calcBufTime();
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
        var ret = Module._downloadSegment();
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

Remuxer.prototype.setCallback = function () {
    if(!this.wasmLoaded) return;
    this.logger.logInfo(" WASM loaded:" + "muxer_" + self.arch +".js");

    let me = this;
    this.audioCallback = Module.addFunction(function (buff, size, fifo, timestamp) {
        var outArray = Module.HEAPU8.subarray(buff, buff + size);
        var data = new Uint8Array(outArray);
        var objData = {
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
};
