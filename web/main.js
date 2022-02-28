/*
 * Copyright (c) 2014 -     Keith Ha (keith4ever@gmail.com)
 * All content herein is protected by U.S. copyright and other applicable intellectual property laws
 * and may not be copied without the expressive permission of Keith Ha, who reserves all rights.
 * Reuse of any of the content for any purpose without the permission of Keith Ha
 * is strictly and expressively prohibited.
 */

let classNameMain = "main.js";
let lockButtons = false;
let audiouuid = null;
let audiosegment = 0;
let samplenum = 0;
let myLog = null;
let myPlayer = null;
let restful = null;

setup();

function setup(){
    myLog = new Logger(classNameMain);
    myPlayer = new Player();
    restful = new RESTful();
    // Get the video info if on the player page
}

// TODO: Move?
function delayStartLiveVideo(){
    changeLiveColorButton(true);
    // TODO: Make function for this in SSPSDK
    showLoading();
}

function playVideo() {
    let fn = "playVideo";
    if(audiouuid === null || audiosegment <= 0) {
        setTimeout(restful.getLiveInfo.bind(restful, handleGetLiveInfo), 5);
        return;
    }

    let currentState = myPlayer.getState();
    if(currentState == constStateStop) {
        myPlayer.play(restful.apiBaseLink + "/" + audiouuid, audiosegment, samplenum);
        myPlayer.unmute();
        showLoading();
    }
    else if(currentState === constStatePlaying){
        myPlayer.stop();
        audiouuid = null; audiosegment = 0;
        document.getElementById("play-pause").className = "play";
        changeLiveColorButton(false);
    }
}

function errReport(e){
    myLog.logError("play error " + e.error + " status " + e.status + ".");
    if (e.error == 1) {
        myLog.logError("Finished.");
    }
}

function onLiveButtonClick(){
    if(lockButtons) return;
    let func = "onLiveButtonClick";
    if(myPlayer === null) return;
    myLog.logInfo(func, "Live already enabled");
}

function onPlayButtonClick(){
    if(lockButtons) return;
    playVideo(); // Plays or pauses depending on state
    if(myPlayer.getState() === constStatePlaying){
        togglePlayPause(false);
    }
    else if(myPlayer.getState() === constStatePause){
        togglePlayPause(true);
    }
}

function onCopyLinkToClipboardClick(){
}

function showVideoMessage(msg){
    if(myLog.isNullOrEmpty(msg)) return;
    let videoMessage = document.getElementById("videoMessage");
    videoMessage.style.visibility = "visible";
    videoMessage.firstElementChild.innerHTML = msg;
}

function handleGetLiveInfo(data){
    const obj = JSON.parse(data);
    audiouuid = obj.id;
    audiosegment = obj.seg - 2;
    samplenum = obj.sample;
    playVideo();
}


function RESTful(){
    //alert("created super stream api");
    this.apiBaseLink = "http://test.cruz.tv:8080";
    this.className = "Api";
    this.logger = new Logger(this.className);
    this.uuid = null;
    this.segno = 0;
}

RESTful.prototype.getLiveInfo = function (callback){
    var url = this.apiBaseLink + "/muselive"
    this.makeRequest(url, callback);
}

RESTful.prototype.makeRequest = function(link, callback) {
    let me = this;
    try {
        fetch(link, {
            method: "GET",
        })
            .then(response => response.text())
            .then(data => {
                me.printJson(data);
                callback(data);
            })
            .catch(err => me.logger.logError(err));
    }
    catch(exception){
        me.logger.logError("Error making Api request");
        const onGetVideoInfoError = new CustomEvent("onSuperStreamApiError", {
            detail: {msg:exception},
            bubbles: true,
            cancelable: true,
            composed: false,
        });

        //  this.dispatchEvent(new CustomEvent('awesome', { bubbles: true, detail: { text: () => textarea.value } }))
        document.dispatchEvent(onGetVideoInfoError);
    }
}

RESTful.prototype.printJson = function (data){
    this.logger.logInfo(data);
}
