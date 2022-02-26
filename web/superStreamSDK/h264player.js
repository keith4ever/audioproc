//Constant.

// TODO: Remove UI functions
const segmentFrameBufferTime    = 5.0;
const normalFrameBufferTime     = 1.5;
const lowFrameBufferTime        = 1.0;

function H264player() {
    this.videoWidth         = 0;
    this.videoHeight        = 0;

    this.fpsInterval        = 33;
    this.chunkInterval      = 1000;
    this.timeLabel          = null;
    this.timeTrack          = null;
    this.trackTimer         = null;
    this.trackTimerInterval = 500;
    this.displayDuration    = "00:00:00";
    this.seeking            = false;  // Flag to preventing multi seek from track.

    this.baseUrl            = null;
    this.srcIdx             = 0;
    this.vnum               = 2;
    this.segterm            = 3000;
    this.firstSec           = 0;
    this.bAllDown           = 0;
    this.videoReadyCounter  = 0;
    this.FSDstring          = null;
    this.videoSource        = null;
    this.audioSource        = null;
    this.videoBuffer        = null;
    this.audioBuffer        = null;
    this.domVideo           = null;
    this.domAudio           = null;
    this.remuxer            = null;
    this.logger             = new Logger("H264player");
    this.playerSDK          = null;
    this.fsd                = null;
    this.fsdCallback        = null;
    this.codec              = 0;
    this.browser            = browserChrome;
    this.errorNo            = 0;

    var ua = navigator.userAgent.toLowerCase();
    if (ua.indexOf('safari') !== -1) {
        if (ua.indexOf('chrome') < 0) {
            this.browser = browserSafari;
            this.logger.logInfo("browser is Safari..")
        }
    } else if(ua.indexOf('firefox') !== -1){
        this.browser = browserFirefox;
        this.logger.logInfo("browser is Firefox..")
    }

    this.initVars(false);
    this.loadRemuxer();
}

H264player.prototype.initRemuxer = function () {
    if(this.remuxer != null) delete this.remuxer;

    this.remuxer = new Remuxer();
    this.remuxer.setPlayer(this);
    this.logger.logInfo("Remuxer is loaded, ARCH: " + self.arch);
    this.logger.logInfo("userAgent: " + navigator.userAgent);
};

H264player.prototype.loadRemuxer = function () {
    if(this.remuxer != null) delete this.remuxer;

    // Adding the script tag to the head as suggested before
    var head = document.getElementsByTagName('head')[0];
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = "superStreamSDK/remuxer.js";

    script.onreadystatechange = this.initRemuxer.bind(this);
    script.onload = this.initRemuxer.bind(this);

    // Fire the loading
    head.appendChild(script);
};

H264player.prototype.onError = function (err) {
    var resetTime = (this.domAudio.currentTime + this.timeOffset);
    if(resetTime < 0) resetTime = this.firstSec;
    this.logger.logError("Error from remuxer.. Reseting at " + resetTime );
    if(!(this.playerState === constStatePlaying || this.playerState === constStatePause))
        return;

    this.firstSec = parseInt(resetTime);
    this.firstSec += (this.segterm/1000); // we need to pass the faulty point

    this.stop(true);
    this.logger.logInfo("Terminated CruzTV WASM");
    if(this.errorNo++ > 2)
        setTimeout(window.location.reload(), 50);
    else
        setTimeout(this.replay.bind(this), 50);
};

H264player.prototype.getFSD = function (url, firstSegNo, callback, playerSDK){
    if(this.FSDstring != null){
        return;
    }

    this.playerSDK = playerSDK;
    this.fsdCallback = callback;

    //var req = {t: constGetFSD, u: url, s: firstSegNo};
    if(this.remuxer === null) {
        var me = this;
        setTimeout(function (){
            me.getFSD(url, firstSegNo, callback, playerSDK);
        }, 20);
        return;
    }
    this.remuxer.getFSD(url, firstSegNo);
}

H264player.prototype.unmute = function (){
    if(this.domAudio === null) return;

    this.domAudio.muted = false;
    this.logger.logInfo("audio unmuted now..");
}

H264player.prototype.play = function (url, firstSec, srcIdx, bAllDown) {
    if (this.remuxer === null) {
        //this.initRemuxer();
        setTimeout(this.initRemuxer.bind(this, url, firstSec, srcIdx), 20);
        return;
    }
    this.logger.logInfo("Play: " + this.firstSec + ", " + this.srcIdx);

    var ret = {e: 0, m: "Success"};

    var success = true;
    do {
        if (this.playerState === constStatePlaying) {
            break;
        } else if (this.playerState === constStatePause) {
            ret = this.resume();
            break;
        }

        if (!url) {
            ret = {e: -1, m: "Invalid url"};
            success = false;
            this.logger.logError("[Error] playVideo error, url empty.");
            break;
        }

        /* Yes, we need to separate DOM audio from video. The reason is, with interleaved audio/video
        fMP4, we keep having low buffering issue, which is very weird because it always maintain same buffering
        level all the time. I speculate audio buffering is low after demux, but I couldn't find the root cause.
        I tried to change each packet duration but no use. DTS/PTS are close enough, so it is not the culprit either.
        Anyhow, if there is any buffering discrepancy between A/V, we're changing video playback speed
        (in displayLoop()) to catch up or slow down to match audio buffering. Then we don't have low buffering
        issue any more.
        Because of that, we have to inconviniently control audio and video separately.. :(
         */
        if(this.domVideo == null && this.videoSource == null) {
            this.domVideo = document.createElement('video');

            if (window.MediaSource)
                this.videoSource = new MediaSource();
            else {
                alert("MediaSource is not supported in this browser..");
                return;
            }
            var mimetype = " ";
            if(this.browser === browserSafari){
                if(this.codec === 0)
                    mimetype = 'video/mp4; codecs="avc1.4d002a"';
                else
                    mimetype = 'video/mp4; codecs="hvc1"';
            } else  mimetype = 'video/mp4; codecs="avc1.4d002a"';
            this.logger.logInfo(this.domVideo.canPlayType(mimetype));

            if (self.arch === "arm") {
                alert("non Intel CPU is not yet supported..\n Please use CruzTV app instead..");
                ret = {e: -1, m: "ARCH Not Supported"};
                break;
            } else if (!MediaSource.isTypeSupported(mimetype)) {
                alert("This video codec/format is not supported by this browser\n Please use another browser..");
                ret = {e: -1, m: "Browser Not Supported"};
                break;
            }
            if(this.browser === browserChrome)
                this.domVideo.requestVideoFrameCallback(this.vFrameCallback.bind(this));
        }
        if(this.domAudio == null && this.audioSource == null) {
            this.domAudio = document.createElement('audio');
            this.audioSource = new MediaSource();

            this.logger.logInfo(this.domAudio.canPlayType('audio/aac'));
            if (!MediaSource.isTypeSupported('audio/aac')) {
                alert("Required audio type is not supported by this browser\n Chrome/Edge browser is recommended..");
                ret = {e: -1, m: "Browser Not Supported"};
                break;
            }
        }

        if (!this.canvas) {
            ret = {e: -2, m: "Canvas not set"};
            success = false;
            this.logger.logError("[Error] playVideo error, canvas empty.");
            break;
        }

        this.baseUrl    = url;
        this.firstSec   = ((firstSec > 0)? firstSec : 0);
        this.srcIdx     = srcIdx;
        this.bAllDown   = bAllDown;
        this.playerState = constStateInitializing;

        this.logger.logInfo("Initializing remuxer..");
        var cores = window.navigator.hardwareConcurrency;
        var req = {t: constInitReq, u: url, s:this.firstSec, i:this.srcIdx, c: cores };
        this.remuxer.initRemuxer(url, this.firstSec, this.srcIdx, cores, this.bAllDown);

        var me = this;
        this.registerVisibilityEvent(function(visible) {
            me.visible = visible;
            if(!visible && me.visibleChanged){
                me.logger.logInfo("visibility changed: " + visible);
                me.visibleChanged = false;
                setTimeout(me.displayLoop.bind(me), me.fpsInterval);
            }
        });

        this.buffering = true;
        this.seeking = false;
        //this.showLoading();
    } while (false);
    return ret;
};

H264player.prototype.stop = function (bSeek) {
    this.logger.logInfo("Stop");

    this.pause();

    if(playClicked) displayPlayButton(true);

    if (this.playerState === constStateStop) {
        var ret = {e: -1,m: "Not playing"};
        return ret;
    }

    this.seeking = bSeek;
    if (bSeek)
        this.layout = this.webglPlayer.layout;
    else
        this.layout = null;
    this.playerState = constStateStop;
    btnPlayPause.className = "play";
    if(!bSeek){
        //this.hideLoading();
        const onVideoEnd = new CustomEvent("onVideoEnd", {
            detail: {},
            bubbles: true,
            cancelable: true,
            composed: false,
        });
        document.dispatchEvent(onVideoEnd);
    }

    if (this.domVideo) {
        this.domVideo.pause();
        if(this.videoSource.readyState === 2) {
            this.videoSource.endOfStream();
            this.videoBuffer.abort();
        }
        delete this.videoBuffer;
        this.videoBuffer = null;

        delete this.videoSource;
        this.videoSource = null;

        delete this.domVideo;
        this.domVideo = null;
        this.logger.logInfo("HTML5 video closed..");
    }
    if (this.domAudio) {
        this.domAudio.pause();
        if(this.audioSource.readyState === 2) {
            this.audioSource.endOfStream();
            this.audioBuffer.abort();
        }
        delete this.audioBuffer;
        this.audioBuffer = null;

        delete this.audioSource;
        this.audioSource = null;

        delete this.domAudio;
        this.domAudio = null;
        this.logger.logInfo("HTML5 audio closed..");
    }

    if (this.timeTrack && !bSeek) {
        this.timeTrack.value = 0;
        this.timeTrack.style.width = "0%";
    }
    if (this.timeLabel && !bSeek) {
        this.timeLabel.innerHTML = this.formatTime(0) + " / " + this.displayDuration;
    }

    this.logger.logInfo("Deiniting remuxer");
    this.remuxer.deinitRemuxer();
    this.logger.logInfo("Terminated CruzTV WASM");

    this.initVars(bSeek);
    setTimeout(this.replay.bind(this), 50);

    return ret;
};

H264player.prototype.replay = function(){
    if(this.seeking)
        this.play(this.baseUrl, this.firstSec, this.srcIdx, this.bAllDown);
};

H264player.prototype.set    = function(canvas, callback){
    this.canvas     = canvas;
    this.callback   = callback;
};

H264player.prototype.setvFrameCallback = function (){
    if(this.domVideo != null && this.playerState === constStatePlaying)
        this.domVideo.requestVideoFrameCallback(this.vFrameCallback.bind(this));
}

H264player.prototype.vFrameCallback = function (now, metadata){
    this.setvFrameCallback();
    if(this.webglPlayer === null) return;

    if (3 >= metadata.presentedFrames) {
        this.logger.logInfo("#" + metadata.presentedFrames
                            + " mediaTime: " + metadata.mediaTime);
    }
    if (this.srcIdxArray.length > 0) {
        let front = this.srcIdxArray[0];

        //if (front.frame <= metadata.presentedFrames){
        var timeDiff = (front.pts - (metadata.mediaTime * 1000));
        if(timeDiff < 5){
            this.logger.logInfo(" Idx change frame#: " + front.frame
                + ", pFrames: " + metadata.presentedFrames
                + ", idx: " + front.idx + ", dts: " + front.pts
                + ", diff: " + (front.pts - (metadata.mediaTime * 1000))
                + ", dom diff: " + this.to2decimal(front.pts - (this.domVideo.currentTime * 1000)));

            this.webglPlayer.newHqFrame(front.idx);
            this.srcIdxArray.shift();
        }
    }

    // Put your drawing code here
    this.webglPlayer.renderFrame(this.domVideo);
}

H264player.prototype.changeSrc = function(srcIdx) {
    if(srcIdx < 0 || srcIdx >= this.vnum) return -1;

    this.srcIdx = srcIdx;
    this.remuxer.changeSrcIdx(this.srcIdx);
    return 0;
};

H264player.prototype.setEndLiveSeg = function(endLiveSeg) {
    //let tag = createTag(classNameWasm, "setEndLiveSeg");
    //console.log(tag + sp + endLiveSeg);
    //this.logger.logInfo("sendEndLiveSeg: " + endLiveSeg);
    if(endLiveSeg <= 0) return;

    this.remuxer.changeLiveEndSeg(endLiveSeg);
    return 0;
};

H264player.prototype.seek = function(firstSec){
    this.firstSec = firstSec;
    this.stop(true);
};

H264player.prototype.pause = function () {
    if(this.playerState !== constStatePlaying && this.playerState !== constStateInitializing)
        return;

    this.playerState = constStatePause;
    btnPlayPause.className = "play";
    this.pauseRemuxing();
    this.stopSegDownload();
    if(this.domVideo)
        this.domVideo.pause();
    if(this.domAudio)
        this.domAudio.pause();

    this.stopTrackTimer();
};

H264player.prototype.resume = function () {
    if(this.playerState === constStatePlaying) return;

    this.playerState = constStatePlaying;
    btnPlayPause.className = "pause";
    this.startRemuxing();
    this.startSegDownload();
    this.startTrackTimer();
    this.displayLoop(); // it will resume playing when there is enough buffer in displayLoop
};

H264player.prototype.initVars = function (bSeek){
    if(!bSeek){
        this.canvas             = null;
        this.callback           = null;
        this.duration           = 60000;
        this.fps                = 30;
    }
    if(this.webglPlayer != null) delete this.webglPlayer;
    this.webglPlayer        = null;
    this.timeOffset         = constInitAudioOffset;
    this.playerState        = constStateStop;
    this.remuxing           = false;
    this.vFrameBuffer       = [];
    this.aFrameBuffer       = [];
    this.srcIdxArray        = [];
    this.buffering          = false;
    this.downloading        = false;
    this.endReached         = false;
    this.visible            = true;
    this.visibleChanged     = false;
    this.vBuffAppending     = false;
    this.aBuffAppending     = false;
    this.prevVideoEndTime   = -1;
    this.lowBuffLevel       = lowFrameBufferTime;
    this.highBuffLevel      = normalFrameBufferTime;
};

H264player.prototype.fullscreen = function () {
    if (this.webglPlayer) {
        if(document.fullscreenElement)
            this.webglPlayer.exitfullscreen();
        else
            this.webglPlayer.fullscreen();
    }
};

H264player.prototype.getState = function () {
    return this.playerState;
};

H264player.prototype.setTrack = function (timeTrack, timeLabel) {
    this.timeTrack = timeTrack;
    this.timeLabel = timeLabel;

    if (this.timeTrack) {
        this.timeTrack.min = 0;
        this.timeTrack.value = 0;
        this.timeTrack.max = this.duration;
        this.displayDuration = this.formatTime(this.duration / 1000);
    }
};

H264player.prototype.onInitRemuxer = function (objData) {
    if (this.playerState !== constStateInitializing) {
        return;
    }

    this.logger.logInfo("Init remuxer: " + objData.e);
    if (objData.e == 0) {
        this.onVideoParam(objData.v);
        this.logger.logInfo("Start Playing now..");
        this.resume();
    } else {
        this.reportPlayError(objData.e);
    }

    if(this.videoReadyCounter <= 0) {
        const onVideoReady = new CustomEvent("onVideoReady", {
            detail: {},
            bubbles: true,
            cancelable: true,
            composed: false,
        });
        document.dispatchEvent(onVideoReady);
    }
    else{
        // TODO: Move elsewhere
        const onSeekEnd = new CustomEvent("onSeekEnd", {
            detail: {},
            bubbles: true,
            cancelable: true,
            composed: false,
        });
        document.dispatchEvent(onSeekEnd);
    }
    this.videoReadyCounter++;
};

H264player.prototype.onMediaEvent = function (msg){
    this.logger.logInfo("DOM event: " + msg);
}

H264player.prototype.onMediaStalled = function (msg){
    this.logger.logInfo("DOM event: " + msg);
    if(this.endReached)
        this.stop(false);
}

H264player.prototype.addVideoSourceBuffer = function(){
    var mimetype = " ";
    if(this.browser === browserSafari){
        if(this.codec === 0) mimetype = 'video/mp4; codecs="avc1.4d002a"';
        else mimetype = 'video/mp4; codecs="hvc1"';
    } else mimetype = 'video/mp4; codecs="avc1.4d002a"';
//        'video/mp4; codecs="avc1.4d002a, mp4a.40.2"');

    var me = this;
    if(this.videoBuffer != null) delete this.videoBuffer;

    this.videoBuffer = this.videoSource.addSourceBuffer(mimetype);
    if(this.videoBuffer == null){
        alert(" The video codec/format is not supported by this browser\n Please try with another browser..");
        return;
    }
    this.videoBuffer.addEventListener('updateend', function (){
        me.vBuffAppending = false;
    });
    this.videoBuffer.addEventListener('onerror', function (e){
        me.logger.logError(e);
    });
    this.videoSource.duration = (this.duration/1000);
    this.videoBuffer.duration = (this.duration/1000);
    this.domVideo.duration = (this.duration/1000);
    this.videoBuffer.mode = 'sequence';
    this.logger.logInfo("HTML video is set now" );
    this.vBuffAppending = false;
}

H264player.prototype.addAudioSourceBuffer = function() {
    var me = this;
    this.audioBuffer = this.audioSource.addSourceBuffer('audio/aac');
    if(this.audioBuffer == null){
        alert("Required audio type is not supported by this browser\n Chrome/Edge browser is recommended..");
        return;
    }
    this.audioBuffer.addEventListener('updateend', function (){
        me.aBuffAppending = false;
    });
    this.audioBuffer.addEventListener('onerror', function (e){
        me.logger.logError(e);
    });
    this.audioBuffer.addEventListener('onabort', function (){
        me.logger.logError("video buffer aborted");
    });
    this.audioSource.duration = (this.duration/1000);
    this.audioBuffer.duration = (this.duration/1000);
    this.domAudio.duration = (this.duration/1000);
    this.audioBuffer.mode = 'sequence';
    this.logger.logInfo("HTML audio is set now" );
}

H264player.prototype.onVideoParam = function (v) {
    if (this.playerState === constStateStop) {
        return;
    }

    this.duration       = v.d;
    this.fps            = v.p;
    this.canvas.width   = v.w;
    this.canvas.height  = v.h;
    this.videoWidth     = v.w;
    this.videoHeight    = v.h;
    this.vnum           = v.v;
    this.segterm        = v.s;
    this.chunkInterval  = (this.segterm * 2/3);
    this.logger.logInfo("Video codec: " + this.codec
        + ", dur:" + v.d + ", fps:" + v.p
        + ", width:" + v.w + ", height:" + v.h
        + ", vnum:" + v.v + ", segterm:" + v.s
        + ", interval: " + this.chunkInterval);

    if (this.timeTrack) {
        this.timeTrack.max = this.duration;
        this.displayDuration = this.formatTime(this.duration / 1000);
    }

    this.fpsInterval = 1000/this.fps - 1;
    this.webglPlayer = new H264WebGLPlayer(this.canvas, this);
    if(this.FSDstring != null && this.fsd != null) {
        this.webglPlayer.setFSD(this.fsd, this.srcIdx);
        if (this.layout != null)
            this.webglPlayer.layout = this.layout;
        this.webglPlayer.setBufferData(this.webglPlayer.layout, this.srcIdx);
    }

    this.domVideo.src = URL.createObjectURL(this.videoSource);
    var me = this;
    this.videoSource.addEventListener('sourceopen', function () {
        me.addVideoSourceBuffer();
    });
    this.videoSource.addEventListener('sourceended', function () {
        me.logger.logInfo("VideoSource ended..");
    })
    //this.domVideo.autoplay = true;

    this.domVideo.onsuspend = this.onMediaEvent.bind(this, "video onsuspend");
    this.domVideo.onemptied = this.onMediaEvent.bind(this, "video onemptied");
    this.domVideo.onended   = this.onMediaEvent.bind(this, "video onended");
    this.domVideo.onwaiting = this.onMediaEvent.bind(this, "video onwaiting");
    this.domVideo.onstalled = this.onMediaStalled.bind(this, "video onstalled");

    this.domAudio.src = URL.createObjectURL(this.audioSource);
    this.audioSource.addEventListener('sourceopen', function () {
        me.addAudioSourceBuffer();
    });
    this.audioSource.addEventListener('sourceended', function () {
        me.logger.logInfo("AudioSource ended..");
    })
    //this.domAudio.autoplay = true;
    this.domAudio.addEventListener('onerror', function (e){
        me.logger.logError(e);
    });

    this.domAudio.onsuspend = this.onMediaEvent.bind(this, "audio onsuspend");
    this.domAudio.onemptied = this.onMediaEvent.bind(this, "audio onemptied");
    this.domAudio.onended   = this.onMediaEvent.bind(this, "audio onended");
    this.domAudio.onwaiting = this.onMediaEvent.bind(this, "audio onwaiting");
    this.domAudio.onstalled = this.onMediaStalled.bind(this, "audio onstalled");
    this.frameBuffer   = [];
};

H264player.prototype.to2decimal = function(num){
    return (Math.round(num * 1000) / 1000).toFixed(3);
};

H264player.prototype.calcBufTime = function (isAudio){
    let dom = ((isAudio >= 1) ? this.domAudio : this.domVideo);
    if(dom === null) return 0;

    const currentTime = dom.currentTime;
    const startTime = (dom.buffered.length>0) ? dom.buffered.start(0) : 0;
    const endTime = (dom.buffered.length>0) ? dom.buffered.end(0): 0;
    // this endTime is always same as this.audioBuffer.timestampOffset
    var bufTime = (endTime - currentTime);
    if(bufTime <= 0 && (currentTime - this.timeOffset > 5.0 )){
        bufTime = 0;
    }
    return this.to2decimal(bufTime);
};

H264player.prototype.addFrameBuffer = function (dts, isAudio) {
    let dom;
    let buffer;
    let frameBuffer;

    if(this.playerState !== constStatePlaying) return false;

    if(isAudio >= 1){
        dom = this.domAudio;
        buffer = this.audioBuffer;
        frameBuffer = this.aFrameBuffer;
        if(this.domAudio === null || this.audioBuffer === null
            || this.vBuffAppending || this.audioBuffer.updating){
            return false;
        }
    } else {
        dom = this.domVideo;
        buffer = this.videoBuffer;
        frameBuffer = this.vFrameBuffer;
        if(this.domVideo === null || this.videoBuffer === null
            || this.vBuffAppending || this.videoBuffer.updating){
            return false;
        }
    }

    const currentTime = this.to2decimal(dom.currentTime);
    const startTime = (dom.buffered.length>0) ? this.to2decimal(dom.buffered.start(0)) : 0;
    // this endTime is always same as this.audioBuffer.timestampOffset
    const endTime = (dom.buffered.length>0) ? this.to2decimal(dom.buffered.end(0)): 0;

    if (this.timeOffset === constInitAudioOffset && isAudio <= 0 && dts >= 0) {
        this.timeOffset = (dts/1000) - this.domVideo.currentTime;
        this.logger.logInfo("First video frame time: " + (dts/1000)
            + " - currentTime: " + this.domVideo.currentTime);
    }

    var norDTS = this.to2decimal(((dts / 1000) - this.timeOffset));
/*    if(currentTime > 20 && dom.readyState === 2 && !this.endReached) {
        if(isAudio >= 1) {
            this.logger.logError("Audio Buffer low (readyState 2), buf length: "
                + (endTime - currentTime) + ", curr: " + currentTime
                + ", end: " + endTime + ", dts: " + norDTS);
            this.domAudio.pause();
        } else {
            this.logger.logInfo("Video Buffer low (readyState 2), buf length: "
                + (endTime - currentTime) + ", curr: " + currentTime
                + ", end: " + endTime + ", dts: " + norDTS);
            this.domVideo.pause();
        }
    }
*/
    if(isAudio >= 1)
        this.aBuffAppending = true;
    else{
        this.vBuffAppending = true;
    }
    //remove too big of buffer.. once it's removed, it'll also invoke 'updateend' event
    var errorFlush = 0;
    if(currentTime > 0 && isAudio === 0 &&
        dom.paused && endTime <= this.prevVideoEndTime){
        this.logger.logInfo("Video Buffer stuck, buf length: "
            + (endTime - currentTime) + ", curr: " + currentTime
            + ", end: " + endTime + ", dts: " + norDTS);
        this.remuxer.setRemuxError(1);
        // now resetting videoSource with new videoBuffer
        this.videoSource.removeSourceBuffer(this.videoBuffer);
        this.domVideo.src = URL.createObjectURL(this.videoSource);
        errorFlush = 1;
    } else
    if (startTime < (endTime - constBufferTime)) {
        buffer.remove(0, endTime - constBufferTime/2);
        return true;
    }
    if(isAudio === 0)
        this.prevVideoEndTime = endTime;

    let length = 0;
    let i = 0;
    let item = null;
    let buflen = frameBuffer.length;

    for(; i < buflen; i++){
        item = frameBuffer[i];
        length += item.d.length;
    }
    if(length <= 0) return true;

    // Create a new array with total length and merge all source arrays.
    let mergedArray = new Uint8Array(length);
    let offset = 0;
    for(i = 0; i < buflen; i++){
        item = frameBuffer[i];
        mergedArray.set(item.d, offset);
        offset += item.d.length;
    }

    if(errorFlush <= 0){
        buffer.appendBuffer(mergedArray);
    }

    for(i = 0; i < buflen; i++){
        delete frameBuffer[0];
        frameBuffer.shift();
    }
    delete mergedArray;
    return true;
};

H264player.prototype.onFrameInput = function (frame) {
    if(frame.a >= 1)
        this.aFrameBuffer.push(frame);
    else
        this.vFrameBuffer.push(frame);
    this.addFrameBuffer(frame.s, frame.a);

    if (this.playerState === constStatePlaying && this.buffering) {
        //this.hideLoading();
        this.buffering = false;
    }
};

H264player.prototype.onSrcIdxChange = function (frame, pts, idx) {
    this.srcIdxArray.push({frame : frame, pts : pts, idx : idx});
};

H264player.prototype.onOtherMsg = function (msg, data) {
    switch (msg) {
        case constOpenReq:
            this.remuxer.openRemuxer();
            break;
        case constFSDString:
            this.FSDstring = new TextDecoder().decode(data);
            this.fsd = JSON.parse(this.FSDstring);

            if(0 > this.FSDstring.indexOf("codec")) this.codec = 1;
            else this.codec = this.fsd.codec;
            this.logger.logInfo("video codec: " + this.codec);

            if(this.webglPlayer != null) {
                this.webglPlayer.setFSD(this.fsd, this.webglPlayer.curAudioTrack);
            }
            var me = this;
            setTimeout(function (){
                if(me.fsdCallback != null)
                    me.fsdCallback(me.codec, me.playerSDK);
                me.fsdCallback = null; // no need to call twice
            }, 10);
            this.logger.logInfo(this.FSDstring);
            break;
        case constUUIDNotFound:
            this.logger.logInfo("requested contents is not found..");
            this.stop(false);
            break;
        case constEndReached:
            this.logger.logInfo("End of the content has reached..");
            this.stop(false);
            break;
    }
};

H264player.prototype.playPromise = function(abufTime, vbufTime) {
    if(this.domAudio === null || this.domVideo === null) return;
    if(this.domAudio.paused && abufTime >= this.lowBuffLevel + 0.2){
        var audioPromise  = this.domAudio.play();

        var me = this;
        if (audioPromise !== undefined) {
            audioPromise.then(function() {
                // should we set a flag indicating successful play from promise?
            }).catch(function(error) {
                me.logger.logError("audio play failed: " + error);
            });
        }
    }

    if(this.domVideo.paused && vbufTime > this.lowBuffLevel + 0.2){
        var videoPromise  = this.domVideo.play();
        if (videoPromise !== undefined) {
            videoPromise.then(function() {
                // should we set a flag indicating successful play from promise?
            }).catch(function(error) {
                me.logger.logError("video play failed: " + error);
            });
        }
        this.logger.logInfo("resume, buffer length: "
            + this.to2decimal(abufTime) + ", " + this.to2decimal(vbufTime));
    }
}

H264player.prototype.displayLoop = function() {
    if (this.playerState === constStatePlaying) {
        if(this.visible)
            requestAnimationFrame(this.displayLoop.bind(this));
        else{
            setTimeout(this.displayLoop.bind(this), this.fpsInterval);
        }
    }

    if (this.playerState !== constStatePlaying || this.buffering) {
        //self.logger.logInfo("Stopping display loop");
        return;
    }

    if(this.browser !== browserChrome ){
        if(this.srcIdxArray.length > 0) {
            let front = this.srcIdxArray[0];
            var timeDiff = (front.pts - (this.domVideo.currentTime * 1000));
            if (timeDiff < 0) {
                this.logger.logInfo(" Idx change frame#: " + front.frame
                    + ", idx: " + front.idx + ", dts: " + front.pts
                    + ", diff: " + this.to2decimal(timeDiff));

                this.webglPlayer.newHqFrame(front.idx);
                this.srcIdxArray.shift();
            }
        }

        if(!this.domVideo.paused){
            this.webglPlayer.renderFrame(this.domVideo);
        }
    }
    /* we need to check and pause HTML5 player before it reaches low buffer with
    readyState == 2. The reason is, once it goes to low buffer state twice, it'll need
    more than 1.5 secs of buffering, which we can't set that high.
    So we pause and play before HTML5 player pauses..
     */

    var abufTime = this.calcBufTime(1);
    var vbufTime = this.calcBufTime(0);
    if (vbufTime - abufTime > 0.12)
        this.domVideo.playbackRate = 1.1;
    else if (vbufTime - abufTime < -0.12)
        this.domVideo.playbackRate = 0.9;
    else this.domVideo.playbackRate = 1.0;

    while(this.domAudio.currentTime > 20 && !this.endReached){
        if(!this.domAudio.paused && abufTime < (this.lowBuffLevel/3)){
            this.domAudio.pause();
        } else
        if(!this.domVideo.paused && vbufTime < (this.lowBuffLevel/3)){
            this.domVideo.pause();
        } else break; // run this.playPromise()

        this.logger.logInfo("pause, buffer length: "
            + this.to2decimal(abufTime) + ", " + this.to2decimal(vbufTime));
        return;
    }
    this.playPromise(abufTime, vbufTime);
};

H264player.prototype.startTrackTimer = function () {
    var me = this;
    this.trackTimer = setInterval(function () {
        me.updateTrackTime();
    }, this.trackTimerInterval);
};

H264player.prototype.stopTrackTimer = function () {
    if (this.trackTimer != null) {
        clearInterval(this.trackTimer);
        this.trackTimer = null;
    }
};

H264player.prototype.updateTrackTime = function () {
    if (this.playerState == constStatePlaying && this.domAudio) {
        var currentPlayTime = this.domAudio.currentTime + this.timeOffset;
        if (this.timeTrack && !this.seeking) {
            var timePos = currentPlayTime / this.duration * 1000;
            this.timeTrack.style.width = timePos * 100 + "%";
        }

        if (this.timeLabel && !this.seeking) {
            this.timeLabel.innerHTML = this.formatTime(currentPlayTime) + " / " + this.displayDuration;
        }
    }
};

H264player.prototype.startRemuxing = function () {
    if (this.remuxing) return;

    this.remuxer.startRemuxing();
    this.remuxing = true;
};

H264player.prototype.pauseRemuxing = function () {
    if(!this.remuxing) return;

    this.remuxer.stopRemuxing();
    this.remuxing = false;
};

H264player.prototype.formatTime = function (s) {
    var h = Math.floor(s / 3600) < 10 ? '0' + Math.floor(s / 3600) : Math.floor(s / 3600);
    var m = Math.floor((s / 60 % 60)) < 10 ? '0' + Math.floor((s / 60 % 60)) : Math.floor((s / 60 % 60));
    var s = Math.floor((s % 60)) < 10 ? '0' + Math.floor((s % 60)) : Math.floor((s % 60));
    return result = h + ":" + m + ":" + s;
};

H264player.prototype.reportPlayError = function (error, status, message) {
    var e = {
        error: error || 0,
        status: status || 0,
        message: message
    };

    if (this.callback) {
        this.callback(e);
    }
};

H264player.prototype.startSegDownload = function () {
    if(this.downloading) return;

    this.downloading = true;
    this.reportFrameBuffTime();
};

H264player.prototype.stopSegDownload = function () {
    this.downloading = false;
};

H264player.prototype.reportFrameBuffTime = function(){
    if(!this.remuxer) return;

    this.remuxer.downloadSegment();

    if(this.downloading)
        setTimeout(this.reportFrameBuffTime.bind(this), 500);
};

H264player.prototype.registerVisibilityEvent = function (callbackfunc) {
    var hidden = "hidden";

    // Standards:
    if (hidden in document) {
        document.addEventListener("visibilitychange", onchange);
    } else if ((hidden = "mozHidden") in document) {
        document.addEventListener("mozvisibilitychange", onchange);
    } else if ((hidden = "webkitHidden") in document) {
        document.addEventListener("webkitvisibilitychange", onchange);
    } else if ((hidden = "msHidden") in document) {
        document.addEventListener("msvisibilitychange", onchange);
    } else if ("onfocusin" in document) {
        // IE 9 and lower.
        document.onfocusin = document.onfocusout = onchange;
    } else {
        // All others.
        window.onpageshow = window.onpagehide = window.onfocus = window.onblur = onchange;
    }

    var me = this;
    function onchange(evt) {
        let visible = false;
        if (document.visibilityState === "visible") {
            visible = true;
        } else {
            visible = false;
        }
        if(!me.visibleChanged)
            me.visibleChanged = true;
        callbackfunc(visible);
    }

    // set the initial state (but only if browser supports the Page Visibility API)
    if (document[hidden] !== undefined) {
        onchange({type: document[hidden] ? "blur" : "focus"});
    }
};

H264player.prototype.getCurrentTime = function(){
    if(this.domAudio == null) return 0;
    return this.domAudio.currentTime;
}

H264player.prototype.getTimeOffset = function(){
    if(this.domVideo == null) return 0;
    return this.timeOffset;
}

H264player.prototype.deinitWASM = function (){
    if(this.remuxer != null) delete this.remuxer;
    this.remuxer = null;
}