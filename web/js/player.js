//Constant.

// TODO: Remove UI functions
const segmentFrameBufferTime    = 5.0;
const normalFrameBufferTime     = 1.5;
const lowFrameBufferTime        = 1.0;

function Player() {
    this.timeLabel          = null;
    this.timeTrack          = null;
    this.trackTimer         = null;
    this.trackTimerInterval = 500;
    this.displayDuration    = "00:00:00";

    this.baseUrl            = null;
    this.srcIdx             = 0;
    this.vnum               = 2;
    this.segterm            = 3000;
    this.firstSec           = 0;
    this.videoReadyCounter  = 0;
    this.audioSource        = null;
    this.audioBuffer        = null;
    this.domAudio           = null;
    this.remuxer            = null;
    this.logger             = new Logger("Player");
    this.playerSDK          = null;
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

Player.prototype.initRemuxer = function () {
    if(this.remuxer != null) delete this.remuxer;

    this.remuxer = new Remuxer();
    this.remuxer.setPlayer(this);
    this.logger.logInfo("Remuxer is loaded, ARCH: " + self.arch);
    this.logger.logInfo("userAgent: " + navigator.userAgent);
};

Player.prototype.loadRemuxer = function () {
    if(this.remuxer != null) delete this.remuxer;

    // Adding the script tag to the head as suggested before
    var head = document.getElementsByTagName('head')[0];
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = "js/remuxer.js";

    script.onreadystatechange = this.initRemuxer.bind(this);
    script.onload = this.initRemuxer.bind(this);

    // Fire the loading
    head.appendChild(script);
};

Player.prototype.onError = function (err) {
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

Player.prototype.unmute = function (){
    if(this.domAudio === null) return;

    this.domAudio.muted = false;
    this.logger.logInfo("audio unmuted now..");
}

Player.prototype.play = function (url, firstSec) {
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
        this.playerState = constStateInitializing;

        this.logger.logInfo("Initializing remuxer..");
        var req = {t: constInitReq, u: url, s:this.firstSec};
        this.remuxer.initRemuxer(url, this.firstSec, this.srcIdx);

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
        //this.showLoading();
    } while (false);
    return ret;
};

Player.prototype.stop = function (bSeek) {
    this.logger.logInfo("Stop");

    if(playClicked) displayPlayButton(true);

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
    this.logger.logInfo("Terminated CruzTV WASM");

    this.initVars(false);

    return ret;
};


Player.prototype.setEndLiveSeg = function(endLiveSeg) {
    if(endLiveSeg <= 0) return;

    this.remuxer.changeLiveEndSeg(endLiveSeg);
    return 0;
};

Player.prototype.initVars = function (bSeek){
    this.timeOffset         = constInitAudioOffset;
    this.playerState        = constStateStop;
    this.remuxing           = false;
    this.aFrameBuffer       = [];
    this.srcIdxArray        = [];
    this.buffering          = false;
    this.downloading        = false;
    this.endReached         = false;
    this.visible            = true;
    this.visibleChanged     = false;
    this.aBuffAppending     = false;
    this.lowBuffLevel       = lowFrameBufferTime;
    this.highBuffLevel      = normalFrameBufferTime;
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
        this.timeTrack.max = this.duration;
        this.displayDuration = this.formatTime(this.duration / 1000);
    }
};

Player.prototype.onInitRemuxer = function (objData) {
    if (this.playerState !== constStateInitializing) {
        return;
    }

    this.logger.logInfo("Init remuxer: " + objData.e);
    if (objData.e == 0) {
        this.onVideoParam(objData.v);
        this.logger.logInfo("Start Playing now..");
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

Player.prototype.onVideoParam = function (v) {
    if (this.playerState === constStateStop) {
        return;
    }

    if (this.timeTrack) {
        this.timeTrack.max = this.duration;
        this.displayDuration = this.formatTime(this.duration / 1000);
    }
    var me = this;
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

Player.prototype.to2decimal = function(num){
    return (Math.round(num * 1000) / 1000).toFixed(3);
};

Player.prototype.calcBufTime = function (isAudio){
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

Player.prototype.addFrameBuffer = function (dts, isAudio) {
    let dom;
    let buffer;
    let frameBuffer;

    if(this.playerState !== constStatePlaying) return false;

    dom = this.domAudio;
    buffer = this.audioBuffer;
    frameBuffer = this.aFrameBuffer;
    if(this.domAudio === null || this.audioBuffer === null
        || this.audioBuffer.updating){
        return false;
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

    this.aBuffAppending = true;

    //remove too big of buffer.. once it's removed, it'll also invoke 'updateend' event
    var errorFlush = 0;
    if(currentTime > 0 && isAudio === 0 &&
        dom.paused && endTime <= this.prevVideoEndTime){
        this.logger.logInfo("Video Buffer stuck, buf length: "
            + (endTime - currentTime) + ", curr: " + currentTime
            + ", end: " + endTime + ", dts: " + norDTS);
        this.remuxer.setRemuxError(1);
        // now resetting videoSource with new videoBuffer
        errorFlush = 1;
    } else
    if (startTime < (endTime - constBufferTime)) {
        buffer.remove(0, endTime - constBufferTime/2);
        return true;
    }

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

Player.prototype.onFrameInput = function (frame) {
    this.aFrameBuffer.push(frame);
    this.addFrameBuffer(frame.s, frame.a);

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
}

Player.prototype.displayLoop = function() {
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

    /* we need to check and pause HTML5 player before it reaches low buffer with
    readyState == 2. The reason is, once it goes to low buffer state twice, it'll need
    more than 1.5 secs of buffering, which we can't set that high.
    So we pause and play before HTML5 player pauses..
     */

    var abufTime = this.calcBufTime(1);
    while(this.domAudio.currentTime > 20 && !this.endReached){
        if(!this.domAudio.paused && abufTime < (this.lowBuffLevel/3)){
            this.domAudio.pause();
        }
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
            var timePos = currentPlayTime / this.duration * 1000;
            this.timeTrack.style.width = timePos * 100 + "%";
        }

        if (this.timeLabel) {
            this.timeLabel.innerHTML = this.formatTime(currentPlayTime) + " / " + this.displayDuration;
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

Player.prototype.startSegDownload = function () {
    if(this.downloading) return;

    this.downloading = true;
    this.reportFrameBuffTime();
};

Player.prototype.stopSegDownload = function () {
    this.downloading = false;
};

Player.prototype.reportFrameBuffTime = function(){
    if(!this.remuxer) return;

    this.remuxer.downloadSegment();

    if(this.downloading)
        setTimeout(this.reportFrameBuffTime.bind(this), 500);
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

Player.prototype.deinitWASM = function (){
    if(this.remuxer != null) delete this.remuxer;
    this.remuxer = null;
}