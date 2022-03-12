/*
 * Copyright (c) 2014 -     Keith Ha (keith4ever@gmail.com)
 * All content herein is protected by U.S. copyright and other applicable intellectual property laws
 * and may not be copied without the expressive permission of Keith Ha, who reserves all rights.
 * Reuse of any of the content for any purpose without the permission of Keith Ha
 * is strictly and expressively prohibited.
 */

const normalFrameBufferTime     = 1.0;
const lowFrameBufferTime        = 0.7;

function Player() {
    this.timeLabel          = null;
    this.timeTrack          = null;
    this.trackTimer         = null;
    this.trackTimerInterval = 500;
    this.displayDuration    = "00:00:00";

    this.baseUrl            = null;
    this.firstSec           = 0;
    this.videoReadyCounter  = 0;
    this.samplePerSeg       = 0;
    this.sampleRate         = 0;
    this.audioSource        = null;
    this.audioBuffer        = null;
    this.domAudio           = null;
    this.remuxer            = null;
    this.logger             = new Logger("Player");
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
    this.initRemuxer();
}

Player.prototype.initRemuxer = function () {
    if(this.remuxer != null) delete this.remuxer;

    this.remuxer = new Remuxer();
    this.remuxer.setPlayer(this);
    this.logger.logInfo("Remuxer is loaded, ARCH: " + self.arch);
    this.logger.logInfo("userAgent: " + navigator.userAgent);
};

Player.prototype.onError = function (err) {
    var resetTime = (this.domAudio.currentTime + this.timeOffset);
    if(resetTime < 0) resetTime = this.firstSec;
    this.logger.logError("Error from remuxer.. Reseting at " + resetTime );
    if(!(this.playerState === constStatePlaying || this.playerState === constStatePause))
        return;

    this.firstSec = parseInt(resetTime);

    this.stop(true);
    this.logger.logInfo("Terminated WASM");
    if(this.errorNo++ > 2)
        setTimeout(window.location.reload(), 50);
};

Player.prototype.unmute = function (){
    if(this.domAudio === null) return;

    this.domAudio.muted = false;
    this.logger.logInfo("audio unmuted now..");
}

Player.prototype.play = function (url, firstSec, samplePerSeg) {
    if (this.remuxer === null) {
        //this.initRemuxer();
        setTimeout(this.initRemuxer.bind(this, url, firstSec), 20);
        return;
    }

    this.baseUrl    = url;
    this.firstSec   = ((firstSec > 0)? firstSec : 0);
    this.samplePerSeg = samplePerSeg;
    this.logger.logInfo("Play: " + this.firstSec);

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

        this.playerState = constStateInitializing;

        this.logger.logInfo("Initializing remuxer..");
        var req = {t: constInitReq, u: this.baseUrl, s:this.firstSec};
        this.remuxer.initRemuxer(this.baseUrl, this.firstSec);

        var me = this;
        this.registerVisibilityEvent(function(visible) {
            me.visible = visible;
            if(!visible && me.visibleChanged){
                me.logger.logInfo("visibility changed: " + visible);
                me.visibleChanged = false;
                setTimeout(me.audioplayLoop.bind(me), 10);
            }
        });

        this.buffering = true;
        //this.showLoading();
    } while (false);
    return ret;
};

Player.prototype.stop = function (bSeek) {
    this.logger.logInfo("Stop");

    this.pause();
    displayPlayButton(true);

    if (this.playerState === constStateStop) {
        var ret = {e: -1,m: "Not playing"};
        return ret;
    }

    this.layout = null;
    this.playerState = constStateStop;
    btnPlayPause.className = "play";
    const onVideoEnd = new CustomEvent("onVideoEnd", {
        detail: {},
        bubbles: true,
        cancelable: true,
        composed: false,
    });
    document.dispatchEvent(onVideoEnd);

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
    this.logger.logInfo("Terminated WASM");

    this.initVars(false);

    return ret;
};

Player.prototype.initVars = function (){
    this.timeOffset         = constInitAudioOffset;
    this.playerState        = constStateStop;
    this.remuxing           = false;
    this.aFrameBuffer       = [];
    this.buffering          = false;
    this.endReached         = false;
    this.visible            = true;
    this.visibleChanged     = false;
};

Player.prototype.getState = function () {
    return this.playerState;
};

Player.prototype.setTrack = function (timeTrack, timeLabel) {
    this.timeTrack = timeTrack;
    this.timeLabel = timeLabel;

    if (this.timeTrack) {
        this.timeTrack.min = 0;
        this.timeTrack.value = 0;
    }
};

Player.prototype.onInitRemuxer = function () {
    if (this.playerState !== constStateInitializing) {
        return;
    }

    this.logger.logInfo("Init remuxer..");
    this.onParam();
    this.logger.logInfo("Start Playing now..");
    this.resume();

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

Player.prototype.resume = function () {
    if(this.playerState === constStatePlaying) return;

    this.playerState = constStatePlaying;
    btnPlayPause.className = "pause";
    this.startRemuxing();
    this.startTrackTimer();
    this.audioplayLoop(); // it will resume playing when there is enough buffer in displayLoop
};

Player.prototype.pause = function () {
    if(this.playerState !== constStatePlaying && this.playerState !== constStateInitializing)
        return;

    this.playerState = constStatePause;
    btnPlayPause.className = "play";
    this.pauseRemuxing();
    if(this.domAudio)
        this.domAudio.pause();

    this.stopTrackTimer();
};

Player.prototype.onMediaEvent = function (msg){
    this.logger.logInfo("DOM event: " + msg);
}

Player.prototype.onMediaStalled = function (msg){
    this.logger.logInfo("DOM event: " + msg);
    if(this.endReached)
        this.stop(false);
}

Player.prototype.addAudioSourceBuffer = function() {
    var me = this;
    this.audioBuffer = this.audioSource.addSourceBuffer('audio/aac');
    if(this.audioBuffer == null){
        alert("Required audio type is not supported by this browser\n Chrome/Edge browser is recommended..");
        return;
    }
    this.audioBuffer.addEventListener('updateend', function (){
    });
    this.audioBuffer.addEventListener('onerror', function (e){
        me.logger.logError(e);
    });
    this.audioBuffer.addEventListener('onabort', function (){
        me.logger.logError("audio buffer aborted");
    });
    this.audioSource.duration = 7200;
    this.audioBuffer.duration = 7200;
    this.domAudio.duration = 7200;
    this.audioBuffer.mode = 'sequence';
    this.logger.logInfo("Audio source is now open.." );
}

Player.prototype.onParam = function () {
    if (this.playerState === constStateStop) {
        return;
    }

    var me = this;
    this.audioSource.addEventListener('sourceopen', function () {
        me.addAudioSourceBuffer();
    });
    this.audioSource.addEventListener('sourceended', function () {
        me.logger.logInfo("AudioSource ended..");
    });
    this.audioSource.addEventListener('sourceclose', function () {
        me.logger.logInfo("AudioSource closed..");
    });
    this.domAudio.src = URL.createObjectURL(this.audioSource);
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

Player.prototype.to2decimal = function(num){
    return (Math.round(num * 1000) / 1000).toFixed(3);
};

Player.prototype.calcBufTime = function (){
    if(this.domAudio === null) return 0;

    const currentTime = this.domAudio.currentTime;
    const startTime = (this.domAudio.buffered.length>0) ?
        this.domAudio.buffered.start(0) : 0;
    const endTime = (this.domAudio.buffered.length>0) ?
        this.domAudio.buffered.end(0): 0;
    // this endTime is always same as this.audioBuffer.timestampOffset
    var bufTime = (endTime - currentTime);
    if(bufTime <= 0 && (currentTime - this.timeOffset > 5.0 )){
        bufTime = 0;
    }
    return this.to2decimal(bufTime);
};

Player.prototype.addFrameBuffer = function () {
    if(this.playerState !== constStatePlaying) return false;

    if(this.domAudio === null || this.audioBuffer === null
        || this.audioBuffer.updating){
        return false;
    }

    const currentTime = this.to2decimal(this.domAudio.currentTime);
    const startTime = (this.domAudio.buffered.length>0) ?
        this.to2decimal(this.domAudio.buffered.start(0)) : 0;
    // this endTime is always same as this.audioBuffer.timestampOffset
    const endTime = (this.domAudio.buffered.length>0) ?
        this.to2decimal(this.domAudio.buffered.end(0)): 0;

    var dts;
    if (this.timeOffset === constInitAudioOffset) {
        dts = (this.samplePerSeg * this.firstSec) / this.sampleRate;
        this.timeOffset = dts - this.domAudio.currentTime;
        this.logger.logInfo("First frame time: " + this.to2decimal(dts)
            + " - currentTime: " + this.domAudio.currentTime);
    }

    var norDTS = this.to2decimal((dts - this.timeOffset));

    var errorFlush = 0;
    if(currentTime > 0 && this.domAudio.paused && this.playerState === constStatePlaying){
        this.logger.logInfo("Buffer stuck, buf length: "
            + (endTime - currentTime) + ", curr: " + currentTime
            + ", end: " + endTime + ", dts: " + norDTS);
        //this.remuxer.setRemuxError(1);
        //this.domAudio.removeSourceBuffer(this.audioBuffer);
        //this.domAudio.src = URL.createObjectURL(this.audioSource);
        //return true;
    } else if (startTime < (endTime - constBufferTime)) {
        this.audioBuffer.remove(0, endTime - constBufferTime/2);
        return true;
    }

    let length = 0;
    let i = 0;
    let item = null;
    var bufnum = this.aFrameBuffer.length;

    for(; i < bufnum; i++){
        item = this.aFrameBuffer[i];
        length += item.d.length;
    }
    if(length <= 0) return true;

    // Create a new array with total length and merge all source arrays.
    let mergedArray = new Uint8Array(length);
    let offset = 0;
    for(i = 0; i < bufnum; i++){
        item = this.aFrameBuffer[i];
        mergedArray.set(item.d, offset);
        offset += item.d.length;
    }

    if(errorFlush <= 0){
        this.audioBuffer.appendBuffer(mergedArray);
    }

    for(i = 0; i < bufnum; i++){
        delete this.aFrameBuffer[0];
        this.aFrameBuffer.shift();
    }
    //delete mergedArray;
    return true;
};

Player.prototype.onFrameInput = function (frame) {
    if(this.sampleRate <= 0)
        this.sampleRate = frame.f;
    this.aFrameBuffer.push(frame);
    this.addFrameBuffer();

    if (this.playerState === constStatePlaying && this.buffering) {
        //this.hideLoading();
        this.buffering = false;
    }
};

Player.prototype.onOtherMsg = function (msg, data) {
    switch (msg) {
        case constOpenReq:
            this.remuxer.openRemuxer();
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

Player.prototype.playPromise = function(abufTime) {
    if(this.domAudio === null) return;
    if(this.domAudio.paused && abufTime >= lowFrameBufferTime + 0.1){
        var audioPromise  = this.domAudio.play();

        var me = this;
        if (audioPromise !== undefined) {
            audioPromise.then(function() {
                me.logger.logInfo("domAudio playpromise is set..");
                // should we set a flag indicating successful play from promise?
            }).catch(function(error) {
                me.logger.logError("audio play failed: " + error);
            });
        }
    }
}

Player.prototype.audioplayLoop = function() {
    if (this.playerState === constStatePlaying) {
        setTimeout(this.audioplayLoop.bind(this), 50);
    }

    if (this.playerState !== constStatePlaying || this.buffering) {
        //this.logger.logInfo("Stopping audio play loop");
        return;
    }

    var abufTime = this.calcBufTime();
    while(this.domAudio.currentTime > 0.1 && !this.endReached){
        if(this.domAudio.paused || abufTime > 0.7) break;

        this.domAudio.pause();
        this.logger.logInfo("pause, buffer length: "
            + this.to2decimal(abufTime));
        return;
    }
    this.playPromise(abufTime);
};

Player.prototype.startTrackTimer = function () {
    var me = this;
    this.trackTimer = setInterval(function () {
        me.updateTrackTime();
    }, this.trackTimerInterval);
};

Player.prototype.stopTrackTimer = function () {
    if (this.trackTimer != null) {
        clearInterval(this.trackTimer);
        this.trackTimer = null;
    }
};

Player.prototype.updateTrackTime = function () {
    if (this.playerState == constStatePlaying && this.domAudio) {
        var currentPlayTime = this.domAudio.currentTime + this.timeOffset;
        if (this.timeTrack) {
            var timePos = currentPlayTime; // / this.duration * 1000;
            this.timeTrack.style.width = timePos * 100 + "%";
        }

        if (this.timeLabel) {
            this.timeLabel.innerHTML = this.formatTime(currentPlayTime); // + " / " + this.displayDuration;
        }
    }
};

Player.prototype.startRemuxing = function () {
    if (this.remuxing) return;

    this.remuxer.startRemuxing();
    this.remuxing = true;
};

Player.prototype.pauseRemuxing = function () {
    if(!this.remuxing) return;

    this.remuxer.stopRemuxing();
    this.remuxing = false;
};

Player.prototype.formatTime = function (s) {
    var h = Math.floor(s / 3600) < 10 ? '0' + Math.floor(s / 3600) : Math.floor(s / 3600);
    var m = Math.floor((s / 60 % 60)) < 10 ? '0' + Math.floor((s / 60 % 60)) : Math.floor((s / 60 % 60));
    var s = Math.floor((s % 60)) < 10 ? '0' + Math.floor((s % 60)) : Math.floor((s % 60));
    return result = h + ":" + m + ":" + s;
};

Player.prototype.reportPlayError = function (error, status, message) {
    var e = {
        error: error || 0,
        status: status || 0,
        message: message
    };
 };

Player.prototype.registerVisibilityEvent = function (callbackfunc) {
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

Player.prototype.getCurrentTime = function(){
    if(this.domAudio == null) return 0;
    return this.domAudio.currentTime;
}

Player.prototype.getTimeOffset = function(){
    return this.timeOffset;
}
