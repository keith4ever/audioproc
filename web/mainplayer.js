/*
 * Copyright (c) 2014 -     Keith Ha (keith4ever@gmail.com)
 * All content herein is protected by U.S. copyright and other applicable intellectual property laws
 * and may not be copied without the expressive permission of Keith Ha, who reserves all rights.
 * Reuse of any of the content for any purpose without the permission of Keith Ha
 * is strictly and expressively prohibited.
 */

let classNameMain = "mainPlayer.js";
let lockButtons = false;
let audiouuid = null;
let audiosegment = 0;
let samplenum = 0;
let myUtil = null;
let myPlayer = null;
let myApi = null;

setup();

function setup(){
    myUtil = new Util(classNameMain);
    myPlayer = new Player();
    myApi = new Api();
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
        setTimeout(myApi.getLiveInfo.bind(myApi, handleGetLiveInfo), 5);
        return;
    }

    let currentState = myPlayer.getState();
    if(currentState == constStateStop) {
        myPlayer.play(myApi.apiBaseLink + "/" + audiouuid, audiosegment, samplenum);
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
    let fn = "errReport";
    myUtil.log(fn, "play error " + e.error + " status " + e.status + ".");
    if (e.error == 1) {
        myUtil.log("Finished.");
    }
}

function onLiveButtonClick(){
    if(lockButtons) return;
    let func = "onLiveButtonClick";
    if(myPlayer === null) return;
    myUtil.log(func, "Live already enabled");
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
    if(myUtil.isNullOrEmpty(msg)) return;
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
