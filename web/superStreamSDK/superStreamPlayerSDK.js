//let idx = 0;
//();

// TODO: Check if player is null for every function
function SuperStreamPlayerSDK(){
    this.classNameSDK = "superStreamPlayerSDK.js";
    this.startPlay = false;
    this.isInit = false;
    this.videoBaseUrl = "";
    this.currentVideoLink = "";
    this.codec   = H264codec;

    this.mainUrl = document.location.toString();
    this.lastSegNo   = -1;
    this.uuid = this.getParameterByName('uuid', this.mainUrl);
    this.firstSec = this.getParameterByName('t', this.mainUrl);
    this.srcIdx = this.getParameterByName('src', this.mainUrl);
    this.bAllDown = 0; // always download D1 video files?
    this.channelName = this.getParameterByName('channel', this.mainUrl);
    this.inputUrl = document.getElementById("inputUrl");
    this.isLive = false;
    this.simulateLive = false;
    this.firstLiveSn = -1;
    this.initLivePlay = false;
    this.enableKeyboardInteraction = true;
    this.playerCodecSet = false;

    this.player = new H264player();

    this.util = new Util(this.classNameSDK);

    if(!this.util.isNullOrEmpty(this.channelName)) this.channelName = this.channelName.toLowerCase();
    if(this.firstSec === "" || this.firstSec === null) this.firstSec = 0;
    else this.firstSec = parseInt(this.firstSec);
    if(this.srcIdx === "" || this.srcIdx === null) this.srcIdx = 0;
    else this.srcIdx = parseInt(this.srcIdx);

    let me = this;

    document.addEventListener("onVideoEnd", (event) => {
        let fn = "onVideoEnd";
        logger.logInfo(fn);
        if(this.superStreamConnect) this.superStreamConnect.closeWebsocket();

    });

    document.addEventListener("onWebsocketOpen", (event) => {
        let fn = "onWebsocketOpen";
        logger.logInfo(fn);
        //sendRTQA();
    });

    document.addEventListener("onWebsocketClose", (event) => {
        let fn = "onWebsocketClose";
        logger.logInfo(fn);
        if(this.isLive && (this.player.playerState === constStatePlaying || this.player.playerState === constStatePause)){
            this.superStreamConnect.reconnect();
        }
        // else{
        //     stopVideo(true);
        // }
        //sendRTQA();
    });

    document.addEventListener("onWebsocketStopReceive", (event) => {
        let fn = "onWebsocketStopReceive";
        logger.logInfo(fn);
        if(isLive) stopVideo(true);
    });

    document.addEventListener("onLiveEndSegmentNumber", (event) => {
        me.handleGetLiveSegmentNumber(event);
    });

    document.addEventListener("onVideoReady", (event) => {
        me.util.log("constructor", "onVideoReady");
    });

    document.addEventListener("onSeekEnd", (event) => {
        me.util.log("constructor", "onSeekEnd");
    });
}

// TODO: Test if works without arguments
SuperStreamPlayerSDK.prototype.play = function (videoContentData, canvas, timeOffset, srcIdx) {
    let fn = "play";
    if(!this.startPlay) {
        this.startPlay = true;
        if(timeOffset > 0) this.firstSec = timeOffset;
        if(srcIdx > 0) this.srcIdx = srcIdx;
        this.processVideoContentData(videoContentData);

        // let url;
        if (this.util.isNullOrEmpty(this.currentVideoLink)) return;
        if (canvas === null) return;

        // url = this.currentVideoLink;
    }

    let currentState = this.player.getState();

    if (currentState === constStateStop) {
        if (!this.isInit) {
            if (canvas === null) return;
            let me = this;
            canvas.addEventListener("mousedown", function (e) {
                me.getMousePosition(canvas, e);
            });
            document.addEventListener("keydown", function (e) {
                switch (e.code) {
                    case "ArrowLeft":
                        me.onArrowKey(0);
                        break;
                    case "ArrowRight":
                        me.onArrowKey(1);
                        break;
                    case "ArrowUp":
                        me.onArrowKey(2);
                        break;
                    case "ArrowDown":
                        me.onArrowKey(3);
                        break;
                    case "Digit1":
                        me.on1234Key(1);
                        break;
                    case "Digit2":
                        me.on1234Key(2);
                        break;
                    case "Digit3":
                        me.on1234Key(3);
                        break;
                    case "Digit4":
                        me.on1234Key(4);
                        break;
                }
            });
            this.isInit = true;
        }
        this.player.set(canvas, errReport);
    }
    else if(currentState === constStatePlaying){ // Play --> Pause
        if(this.isLive) {
            this.lastSegNo = gEndSegmentNumber;
        }
        this.player.pause();
    } else if(currentState === constStatePause) { // Pause --> Play
        // if(gEndSegmentNumber > this.lastSegNo + MAX_PAUSE_SEGS_DIST && this.lastSegNo > -1 && this.isLive){
        //     this.util.log(fn, "Too much time elapsed, resuming live. Current: " + gEndSegmentNumber + ". Last: " + this.lastSegNo);
        //     // TODO: Move
        //     delayStartLiveVideo();
        // }
        // else this.player.resume();
        this.player.resume();
    }
    return true;
}

// TODO: Add pause & resume
SuperStreamPlayerSDK.prototype.pause = function () {
    let fn = "pause";
    if(this.player === null) return;
    let currentState = this.player.getState();
    if(currentState === constStatePlaying){ // Play --> Pause
        if(this.isLive) {
            this.lastSegNo = gEndSegmentNumber;
        }
        this.player.pause();
    }
    return true;
}

SuperStreamPlayerSDK.prototype.resume = function () {
    let fn = "pause";
    if(this.player === null) return;

    let currentState = this.player.getState();

    if(currentState === constStatePause) { // Pause --> Play
        // if(gEndSegmentNumber > this.lastSegNo + MAX_PAUSE_SEGS_DIST && this.lastSegNo > -1 && this.isLive){
        //     this.util.log(fn, "Too much time elapsed, resuming live. Current: " + gEndSegmentNumber + ". Last: " + this.lastSegNo);
        //     // TODO: Move
        //     delayStartLiveVideo();
        // }
        // else this.player.resume();
        this.player.resume();
    }
    return true;
}

SuperStreamPlayerSDK.prototype.unmute = function(){
    this.player.unmute();
}

SuperStreamPlayerSDK.prototype.stopPlayer = function(){
    if(this.player.playerState === constStatePlaying || this.player.playerState === constStatePause){
        this.player.stop(false);
    }
}

SuperStreamPlayerSDK.prototype.seekBackwardForward = function(forward){
    if(!(this.player.playerState === constStatePlaying
        || this.player.playerState === constStatePause))
        // || !this.player.domaudio)
        return;
    let fastForwardTime = 20;
    let currentPlayTime = this.getCurrentPlayTime(); //this.player.domaudio.currentTime + this.player.audioTimeOffset; //this.player.pcmPlayer.getTimestamp() +
    let seekTimeMs = (currentPlayTime - fastForwardTime * (forward? -1 : 1)) * 1000;
    this.firstSec = Math.round(seekTimeMs / 1000);
    this.player.seek(this.firstSec);
}

SuperStreamPlayerSDK.prototype.seek = function (timeSec){
    this.firstSec = timeSec;
    this.player.seek(timeSec);
}

SuperStreamPlayerSDK.prototype.fullscreen = function() {
    this.player.fullscreen();
}

SuperStreamPlayerSDK.prototype.changeLiveEndSeg = function(seg){
    let fn = "changeLiveEndSeg";
    logger.logWS(fn, "Changing live end seg: " + seg);
    if(this.player.playerState === constStatePlaying || this.player.playerState === constStatePause)
        this.player.setEndLiveSeg(seg);
}

SuperStreamPlayerSDK.prototype.forceStartLive = function(){
    if(this.superStreamConnect !== null) { // reconnect websocket if disconnected
        if(!this.superStreamConnect.isWsConnected() && !this.util.isNullOrEmpty(currentWsLink)){
            this.superStreamConnect = new SuperStreamConnect(currentWsLink);
        }
    }
    this.player.seek(gEndSegmentNumber - MIN_SEG_DIST);
}

SuperStreamPlayerSDK.prototype.isBuffering = function(){
    return this.player.buffering;
}

SuperStreamPlayerSDK.prototype.isSeeking = function(){
    return this.player.seeking;
}

SuperStreamPlayerSDK.prototype.getDuration = function(){
    return (this.player.duration)/1000;
}

SuperStreamPlayerSDK.prototype.getCurrentPlayTime = function(){
    if(this.player !== null) {
        return this.player.getCurrentTime() + this.player.getTimeOffset();
    }
    else return 0;
}

SuperStreamPlayerSDK.prototype.getPlayerState = function(){
    if(this.player !== null) {
        return this.player.playerState;
    }
    else return -1;
}

SuperStreamPlayerSDK.prototype.callbackPlay = function(c, playerSDK) { // codec: 0 -> H264, 1 -> H265
    let fn = "callbackPlay";
    // Safari browser supports both H264/H265 natively.. just use H264 player for this
    if(playerSDK.codec === H264codec && playerSDK.player.browser === browserSafari){
        playerSDK.util.log(fn, "Safari browser: using H264 remuxer..");
    }else if (playerSDK.codec != c) {
        playerSDK.player.deinitWASM();
        delete playerSDK.player;

        playerSDK.codec = c;
        if (playerSDK.codec === H265codec)
            playerSDK.player = new H265player();
        else
            playerSDK.player = new H264player(); //playerSDK.h264TempPlayer;
        playerSDK.player.set(canvas, errReport);
    }
    if (!playerSDK.isLive && (playClicked || enableAutoPlay)) {
        let success = playerSDK.player.play(playerSDK.currentVideoLink, playerSDK.firstSec,
                                            playerSDK.srcIdx, playerSDK.bAllDown);
        playerSDK.util.log(fn, "Starting play with start: " + playerSDK.firstSec
            + " and index: " + playerSDK.srcIdx + ". Success: " + success.e);
    } else {
        // TODO: implement live
    }
    playerSDK.unmute();
    playerSDK.playerCodecSet = true;
}

// TODO: Test with h264
SuperStreamPlayerSDK.prototype.handleGetLiveSegmentNumber = function(event){
    if(!this.isLive) return;
    let fn = "handleGetLiveSegmentNumber"
    let sn = event.detail.sn;
    //logger.logInfo(fn, sn + ". Link: " + event.detail.link);
    //changeLiveEndSeg(sn);
    if(this.firstLiveSn === -1) this.firstLiveSn = Math.max(sn - MIN_SEG_DIST, 0);
    let me = this;
    this.player.getFSD(this.currentVideoLink, this.firstLiveSn, this.callbackPlay, this);
    // need to reach right seg distance
    let shouldWait = sn <= MIN_SEG_DIST || !this.playerCodecSet;
    //logger.logInfo(fn, "SN: " + sn + ", min: " + MIN_SEG_DIST + ", should wait: " + shouldWait);
    if (!this.util.isNullOrEmpty(this.currentVideoLink) && this.startPlay && !shouldWait && !this.initLivePlay) {
        this.firstSec = this.firstLiveSn * (this.player.segterm/1000);
        this.player.play(this.currentVideoLink, this.firstSec, this.srcIdx, this.bAllDown);
        //playVideoWithUrl(currentVideoLink);
        // this.player.hideLoading();
        this.changeLiveEndSeg(sn);
        this.initLivePlay = true;
        this.util.log(fn, "Starting live play with start: " + this.firstSec
            + " and index: " + this.srcIdx);
        return;
    }
    if(sn > 0 && !shouldWait) {
        this.util.log(fn, "SN: " + sn);
        gEndSegmentNumber = sn;
        this.changeLiveEndSeg(sn);
    }
}

// TODO: Retrieve UUID
SuperStreamPlayerSDK.prototype.processVideoContentData = function(data){
    let fn = "processVideoContentData";
    if(data["videoLink"]) this.videoBaseUrl = data["videoLink"].replace("http","https").split("multiview/")[0] + "multiview/";
    this.isLive = data["wsLink"].includes("st=live");

    let temp = data["videoLink"].split('/');
    let vidUuid = temp[temp.length-1];

    // Sets uuid in case it hasn't been set
    if(this.util.isNullOrEmpty(this.uuid)) this.uuid = vidUuid;

//"wss://javascript.info/article/websocket/demo/hello"
    let newWsLink = data["wsLink"].replace("ws://rtqa.alcacruz.com:3000", "wss://rtqa.cruz.tv:3443");

    if(this.simulateLive && !this.isLive){
        newWsLink = newWsLink.replace("st=vod", "st=livesim");
        this.isLive = true;
        this.util.log(fn, "Simulating live");
    }

    this.currentVideoLink = this.videoBaseUrl + this.uuid;
    if(!this.isLive){
        // for VOD, always download 0 segment # for FSD parsing
        this.player.getFSD(this.currentVideoLink, 0, this.callbackPlay, this);
    }

    this.currentWsLink = newWsLink;
    this.superStreamConnect = new SuperStreamConnect(newWsLink);

}

SuperStreamPlayerSDK.prototype.on1234Key = function(numkey) {
    //if(lockButtons) return;
    if(!this.enableKeyboardInteraction) return;
    if(numkey < 1 || numkey > this.player.webglPlayer.fsd.vnum)
        return;
    this.player.webglPlayer.setBufferData(this.player.webglPlayer.layout, numkey-1);
}

SuperStreamPlayerSDK.prototype.onArrowKey = function(keyvalue) { // left: 0, right: 1, up: 2, down: 3
    //if(lockButtons) return;
    if(!this.enableKeyboardInteraction) return;

    let layout          = this.player.webglPlayer.layout;
    let selectedVideo   = this.player.webglPlayer.curAudioTrack;
    let newLayout;

    if(keyvalue >= 2) { // up/down, just change source index
        selectedVideo   = (selectedVideo + ((keyvalue === 2)? 1 : -1));
        if(selectedVideo < 0) selectedVideo = this.player.webglPlayer.fsd.vnum - 1;
        else selectedVideo = (selectedVideo % this.player.webglPlayer.fsd.vnum);

        this.player.webglPlayer.setBufferData(layout, selectedVideo);
    } else {
        if (this.player.webglPlayer.fsd.vnum === 2) {
            newLayout   = (layout + 1) % 2;
        } else {
            newLayout   = ((layout + ((keyvalue === 1)? 1 : -1)) % 3 + 3) % 3;
        }
        this.player.webglPlayer.setBufferData(newLayout, this.player.webglPlayer.curAudioTrack);
    }
}

SuperStreamPlayerSDK.prototype.getMousePosition = function(canvas, event) {
    let fn = "getMousePosition";
    let rect = canvas.getBoundingClientRect();
    let x = (event.clientX - rect.left)/rect.width;
    let y = (event.clientY - rect.top)/rect.height;
    // logger.logInfo("Coordinate x: " + x,
    //     "Coordinate y: " + y);
    let selectedVideo = this.player.webglPlayer.curAudioTrack;
    let layout = this.player.webglPlayer.layout;
    let vnum = this.player.webglPlayer.fsd.vnum;
    if (layout === layoutQuadrant)
    {
        switch(vnum) {
            case 2:
                if (x <= 0.5)
                    selectedVideo = 0;
                else
                    selectedVideo = 1;
                break;
            case 3:
                if (x >= 0.5 && y <= 0.5)
                    selectedVideo = 1;
                else if (x >= 0.5 && y > 0.5)
                    selectedVideo = 2;
                else
                    selectedVideo = 0;
                break;
            case 4:
                if (x <= 0.5 && y <= 0.5)
                    selectedVideo = 0;
                else if (x >= 0.5 && y <= 0.5)
                    selectedVideo = 1;
                else if (x <= 0.5 && y > 0.5)
                    selectedVideo = 2;
                else
                    selectedVideo = 3;
                break;
        }
    } else if(layout === layoutThreeMinor)
    {
        switch(vnum){
            case 3:
                if (y >= 1/2)
                    if (x <= 1/2)
                        selectedVideo = this.player.webglPlayer.renderedVideoOrderThree[1];
                    else
                        selectedVideo = this.player.webglPlayer.renderedVideoOrderThree[2];
                break;
            case 4:
                if (y >= 2/3){
                    if (x <= 1/3)
                        selectedVideo = this.player.webglPlayer.renderedVideoOrderFour[1];
                    else if (x <= 2/3)
                        selectedVideo = this.player.webglPlayer.renderedVideoOrderFour[2];
                    else
                        selectedVideo = this.player.webglPlayer.renderedVideoOrderFour[3];
                }
                break;
        }
    }

    if (this.player.webglPlayer.curAudioTrack !== selectedVideo) {
        this.player.webglPlayer.setBufferData(layout,selectedVideo);
        //logger.logInfo(fn, "[mainplayer::getMousePosition]" + "video number " + selectedVideo + " is selected");
    }
}

SuperStreamPlayerSDK.prototype.getParameterByName = function(name, url = window.location.href) {
    name = name.replace(/[\[\]]/g, '\\$&');
    let regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

// TODO: Make
SuperStreamPlayerSDK.prototype.sendRTQA = function(){
    let fn = "sendRTQA";
    logger.logInfo(fn, "WS connected: " + this.superStreamConnect.isWsConnected());
}

function setup(){
    switch(idx){
        case 0:
            let superstreamconsts = document.createElement('script');
            superstreamconsts.src = 'superstreamconsts.js';
            document.head.appendChild(superstreamconsts);
            break;
        case 1:
            let superstreamglobal = document.createElement('script');
            superstreamglobal.src = 'superstreamglobal.js';
            document.head.appendChild(superstreamglobal);
            break;
        case 2:
            let util = document.createElement('script');
            util.src = 'util.js';
            document.head.appendChild(util);
            break;
        case 3:
            let print = document.createElement('script');
            print.src = 'print.js';
            document.head.appendChild(print);
            break;
        case 4:
            let h264wasmplayer = document.createElement('script');
            h264wasmplayer.src = 'h264player.js';
            document.head.appendChild(h264wasmplayer);
            break;
        case 5:
            let h264webgl = document.createElement('script');
            h264webgl.src = 'h264webgl.js';
            document.head.appendChild(h264webgl);
            break;
        case 6:
            let h265webgl = document.createElement('script');
            h265webgl.src = 'h265webgl.js';
            document.head.appendChild(h265webgl);
            break;
        case 7:
            let h265wasmplayer = document.createElement('script');
            h265wasmplayer.src = 'h265player.js';
            document.head.appendChild(h265wasmplayer);
            break;
        case 8:
            let superstreamapi = document.createElement('script');
            superstreamapi.src = 'superstreamapi.js';
            document.head.appendChild(superstreamapi);
            break;
        case 9:
            let superstreamconnect = document.createElement('script');
            superstreamconnect.src = 'superstreamconnect.js';
            document.head.appendChild(superstreamconnect);
            break;
        case 10:
            let mainuicontroller = document.createElement('script');
            mainuicontroller.src = 'mainuicontroller.js';
            document.head.appendChild(mainuicontroller);
            break
        case 11:
            let mainplayer = document.createElement('script');
            mainplayer.src = 'mainplayer.js';
            document.head.appendChild(mainplayer);
            break;
        default:
            return; // return?
    }
    idx++;
    setTimeout(setup, 50);
}
/*
    <script type='text/javascript' src="superStreamPlayerSDK.js"></script>
    <script type='text/javascript' src="superstreamconsts.js"></script>
    <script type='text/javascript' src="superstreamglobal.js"></script>
    <script type='text/javascript' src="util.js"></script>
    <script type='text/javascript' src="print.js"></script>
    <script type='text/javascript' src="h265webgl.js"></script>
    <script type='text/javascript' src="h265player.js"></script>
    <script type='text/javascript' src="superstreamapi.js"></script>
    <script type='text/javascript' src="superstreamconnect.js"></script>
    <script type='text/javascript' src="mainuicontroller.js"></script>
    <script type='text/javascript' src="mainplayer.js"></script>
 */