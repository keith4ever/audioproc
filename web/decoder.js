//Constant.
const highVFrameBufferTime      = 1500;
const lowAFrameBufferTime       = 700;

if(navigator.userAgent.includes("x64") || navigator.userAgent.includes("x86")
    || navigator.userAgent.includes("Intel"))
    self.arch = "x86";
else self.arch = "arm";

let locationURL = "superStreamSDK/";

self.Module = {
    locateFile: (file) => file,
    onRuntimeInitialized: function () {
        onWASMLoaded();
    },
    mainScriptUrlOrBlob: locationURL + "h265decoder.js", //
};

//locationURL = "";
// NOTE: works relatively?
self.importScripts(locationURL + "print.js");
self.importScripts(locationURL + "superstreamconsts.js");
self.importScripts(locationURL + "h265decoder.js");

function Decoder() {
    this.logger             = new Logger("Decoder");
    this.wasmLoaded         = false;
    this.videoCallback      = null;
    this.audioCallback      = null;
    this.initVars();
}

Decoder.prototype.initVars = function(){
    this.dataInFifo         = 0;
    this.tmpReqQue          = [];
    this.cacheBuffer        = null;
    this.vBuffTime          = 0;
    this.decoding           = false;
    this.reachedEnd         = false;
    this.vFrames            = 0;
    this.aBuffTime          = 0;
    this.fps                = 0;
};

Decoder.prototype.getFSD = function (req) {
    var buf = new ArrayBuffer(req.u.length);
    var bufView = new Uint8Array(buf);
    for(var i = 0; i < req.u.length; i++)
        bufView[i] = req.u.charCodeAt(i);

    this.cacheBuffer = Module._malloc(256);
    Module._memset(this.cacheBuffer, 0 , 256);
    Module.HEAPU8.set(bufView, this.cacheBuffer);

    //this.logger.logInfo("Downloading FSD info: " + req.u + ", segno: " + req.s);
    var ret = Module._h265fsdDownParse(this.cacheBuffer, req.s);
    Module._h265fetchFSD(this.msgCallback);
    Module._free(this.cacheBuffer);
    this.cacheBuffer = null;
};

Decoder.prototype.initDecoder = function (req) {
    var buf = new ArrayBuffer(req.u.length);
    var bufView = new Uint8Array(buf);
    for(var i = 0; i < req.u.length; i++)
        bufView[i] = req.u.charCodeAt(i);

    this.cacheBuffer = Module._malloc(256 * 1024);
    Module._memset(this.cacheBuffer, 0 , 256*1024);
    Module.HEAPU8.set(bufView, this.cacheBuffer);

    var ret = Module._h265initDecoder(this.cacheBuffer, req.s, req.i, req.c, req.b);
    ret = Module._h265setCallBack(this.videoCallback, this.audioCallback,
                                    this.msgCallback, this.idxCallback);

    var paramCount = 9, paramSize = 4;
    var paramByteBuffer = Module._malloc(paramCount * paramSize);
    ret = Module._h265openDecoder(paramByteBuffer, paramCount);
    this.logger.logInfo("Init CruzTV WASM: " + req.s);

    if (ret == 0) {
        var paramIntBuff    = paramByteBuffer >> 2;
        var paramArray      = Module.HEAP32.subarray(paramIntBuff, paramIntBuff + paramCount);
        var duration        = paramArray[0];
        this.fps            = paramArray[1];
        var videoWidth      = paramArray[2];
        var videoHeight     = paramArray[3];
        var audioSampleFmt  = paramArray[4];
        var audioChannels   = paramArray[5];
        var audioSampleRate = paramArray[6];
        var vnum            = paramArray[7];
        var segterm         = paramArray[8];

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
            },
            a: {
                f: audioSampleFmt,
                c: audioChannels,
                r: audioSampleRate
            }
        };
        self.postMessage(objData);
    } else {
        var objData = {
            t: constInitRsp,
            e: ret
        };
        self.postMessage(objData);
    }
    Module._free(paramByteBuffer);
};

Decoder.prototype.deinitDecoder = function () {
    this.stopDecoding();

    var ret = Module._h265deinitDecoder();
    this.logger.logInfo("Deinit CruzTV WASM: " + ret);
    if (this.cacheBuffer != null) {
        Module._free(this.cacheBuffer);
        this.cacheBuffer = null;
    }
    this.initVars();

    var objData = {
        t: constDeinitRsp,
        e: 0
    };
    self.postMessage(objData);
};

Decoder.prototype.startDecoding = function () {
    if(this.decoding) return;

    this.logger.logInfo("Start CruzTV WASM");
    this.decoding = true;
    this.parseAudioDecode(); // use idle CPU cycle, in a single thread
    this.flushVideoDecode(); // take advantage of multithreaded video decoding
};

Decoder.prototype.stopDecoding = function () {
    if(!this.decoding) return;

    this.logger.logInfo("Stop CruzTV WASM");
    this.decoding = false;
};

Decoder.prototype.handleError = function (e) {
    this.reachedEnd = true;
    var objData = {
        t: constDecoderError,
        e: e
    };
    self.postMessage(objData);
}

Decoder.prototype.flushVideoDecode = function () {
    if(!this.decoding) return;

    var delay = 1;
    if (this.vBuffTime < highVFrameBufferTime || this.aBuffTime < lowAFrameBufferTime) {
        try{
            var ret = Module._h265flushVideoDecode();
            if (ret > 0 && this.dataInFifo !== ret) {
                //this.logger.logInfo(Math.round(this.frameBuffTime) + " : " + ret);
                this.dataInFifo = ret; // dataInFifo is same as the one in h265player.js
            }
        } catch (e) {
            this.logger.logError("error from video decoder: " + e);
            this.handleError(e);
            return;
        }
    } else {
        delay = Math.min((this.vBuffTime - highVFrameBufferTime), 30);
    }

    if(this.decoding) { // after each video frame decoding, invoke next decode() by the time diff
        //this.frameBuffTime -= delay;
        setTimeout(this.flushVideoDecode.bind(this), delay);
    }
};

Decoder.prototype.parseAudioDecode = function () {
    if(!this.decoding) return;

    var delay = 3;

    try{
        if (this.vBuffTime < highVFrameBufferTime || this.aBuffTime < lowAFrameBufferTime) {
            var ret = Module._h265parseAudioDecode(this.vFrames);
            if(ret > 0) this.dataInFifo = ret; // dataInFifo is same as the one in h265player.js
        }

        if (this.decoding) { // after each video frame decoding, invoke next decode() by the time diff
            //this.frameBuffTime -= delay;
            setTimeout(this.parseAudioDecode.bind(this), delay);
        }
    } catch (e) {
        this.logger.logError("error from segment downloader: " + e);
        this.handleError(e);
        return;
    }
};

Decoder.prototype.downloadSegment = function(){
    if(!this.decoding || this.reachedEnd) return;

    try{
        var ret = Module._h265downloadSegment();
        if(ret < 0){
            this.logger.logInfo("End reached...");
            this.reachedEnd = true;
            var objData = {
                t: constEndReached,
                e: 0
            };
            self.postMessage(objData);
        }
    } catch (e) {
        this.logger.logError("error from segment downloader: " + e);
        this.handleError(e);
        return;
    }

    //this.logger.logInfo(Math.round(this.frameBuffTime) + " : " + ret);
};

Decoder.prototype.changeSrcIdx = function(idx){
    Module._h265changeSrcIdx(idx);
};

Decoder.prototype.changeLiveEndSeg = function(seg){
    //this.logger.logInfo("changeLiveEndSeg, SN: " + seg);
    Module._h265changeLiveEndSeg(seg);
}

Decoder.prototype.processReq = function (req) {
    //this.logger.logInfo("processReq " + req.t + ".");
    switch (req.t) {
        case constChangeEndSeg:
            //this.logger.logInfo("sn: " + req.sn);
            this.changeLiveEndSeg(req.sn);
            break;
        case constInitReq:
            this.initDecoder(req);
            break;
        case constDeinitReq:
            this.deinitDecoder();
            break;
        case constStartDecodingReq:
            this.startDecoding();
            break;
        case constPauseDecodingReq:
            this.stopDecoding();
            break;
        case constUpdateFrameBuff:
            this.vFrames = req.v;
            this.aBuffTime = (req.a * 1000);
            this.vBuffTime = (this.vFrames * 1000 / this.fps);
            // invoke downloading the next segment (by onmessage, for pthread operation in C)
            this.downloadSegment();
            break;
        case constChangeSrcIdx:
            this.changeSrcIdx(req.i);
            break;
        case constGetFSD:
            this.getFSD(req);
            break;
        default:
            this.logger.logError("Unsupport messsage " + req.t);
    }
};

Decoder.prototype.cacheReq = function (req) {
    if (req) {
        this.tmpReqQue.push(req);
    }
};

Decoder.prototype.onWASMLoaded = function () {
    this.logger.logInfo(" CruzTV WASM loaded.");
    this.wasmLoaded = true;

    this.videoCallback = Module.addFunction(function (buff, size, fifo, timestamp) {
        var outArray = Module.HEAPU8.subarray(buff, buff + size);
        var data = new Uint8Array(outArray);
        var objData = {
            t: constVideoFrame,
            s: timestamp,
            f: fifo,
            d: data
        };
        self.postMessage(objData, [objData.d.buffer]);
    }, 'viiid');

    this.audioCallback = Module.addFunction(function (buff, size, fifo, timestamp) {
        var outArray = Module.HEAPU8.subarray(buff, buff + size);
        var data = new Uint8Array(outArray);
        var objData = {
            t: constAudioFrame,
            s: timestamp,
            f: fifo,
            d: data
        };
        self.postMessage(objData, [objData.d.buffer]);
    }, 'viiid');

    this.msgCallback = Module.addFunction(function (msg, buff, size) {
        if(size <= 0){
            var objData = {
                t: constOtherMsg,
                m: msg,
                d: null
            };
            self.postMessage(objData, null);
        } else {
            var outArray = Module.HEAP8.subarray(buff, buff + size);
            var data = new Int8Array(outArray);
            var objData = {
                t: constOtherMsg,
                m: msg,
                d: data
            };
            self.postMessage(objData, [objData.d.buffer]);
        }
    }, 'viii');

    this.idxCallback = Module.addFunction(function (pts, idx) {
        var objData = {
            t: constSrcIdxChange,
            p: pts,
            i: idx
        };
        self.postMessage(objData);
    }, 'vji');

    while (this.tmpReqQue.length > 0) {
        var req = this.tmpReqQue.shift();
        this.processReq(req);
    }
};

self.decoder = new Decoder;

self.onmessage = function (evt) {
    if (!self.decoder) {
        console.log("[Err]  CruzTV WASM not initialized!");
        return;
    }

    var req = evt.data;
    if (!self.decoder.wasmLoaded) {
        self.decoder.cacheReq(req);
        self.decoder.logger.logInfo("Cached Request: " + req.t + ".");
        return;
    }
    self.decoder.processReq(req);
};

function onWASMLoaded() {
    if (self.decoder) {
        self.decoder.onWASMLoaded();
    } else {
        console.log("[Err] No decoder!");
    }
}
