/*
 * Copyright (c) 2014 -     Keith Ha (keith4ever@gmail.com)
 * All content herein is protected by U.S. copyright and other applicable intellectual property laws
 * and may not be copied without the expressive permission of Keith Ha, who reserves all rights.
 * Reuse of any of the content for any purpose without the permission of Keith Ha
 * is strictly and expressively prohibited.
 */

let windowSwitch = false;

let chunkInterval      = 1000;
let timeTrack = document.getElementById("timeTrack");
let timeLabel = document.getElementById("timeLabel");
let btnPlayPause = document.getElementById("play-pause");
let trackTimer         = null;
let trackTimerInterval = 500;
let displayDuration    = "00:00:00";

let loadingDiv = document.getElementById("loading");
let agent = navigator.userAgent.toLowerCase();

function hasUserAgent(arr){

  for(let i = 0; i < arr.length; i++){
    if(agent.indexOf(arr[i]) > -1) return true;
  }
  return false;
}

let userAgentAndroid = agent.indexOf("android") > -1;
let userAgentIOS = hasUserAgent(["ios","iphone","ipad","ipod"]); // agent.indexOf("iphone") > -1; //

setupMainUI();

function hideLoading(){
  if (loadingDiv != null) {
    loadingDiv.style.display = "none";
    //this.logger.logInfo("Hiding Spin Wheel..");
  }
  lockButtons = false;
};

function showLoading(){
  if (loadingDiv != null) {
    loadingDiv.style.display = "block";
    //this.logger.logInfo("Showing Spin Wheel..");
  }
  lockButtons = true;
};

function displayLiveButton(show){
  let live = document.getElementById("liveButton");
  if(show) live.style.display = "block";
  else live.style.display = "none";
}

function changeLiveColorButton(on){
  let live = document.getElementById("liveButton");
  if(on) live.style.color = "red";
  else live.style.color = "grey";
}

function displayControlButtons(show){
  let controls = document.getElementById("controls");
  if(show) controls.style.display = "block";
  else controls.style.display = "none";
}

function displaySeekButtons(show){
  let trackBar = document.getElementById("trackBar");
  let timeLabel = document.getElementById("timeLabel");

  if(show){
    trackBar.style.visibility = "visible";
    trackBar.style.marginTop = "10px";
  }
  else {
    trackBar.style.visibility = "hidden";
    trackBar.style.marginTop = "0px";
  }
}

function displayPlayButton(show){
  let playButton = document.getElementById("play-pause");
  if (show) playButton.style.display = "flex";
  else playButton.style.display = "none";
}

function togglePlayPause(showPlay){
  if(showPlay){
    btnPlayPause.className = "play";
  }
  else{
    btnPlayPause.className = "pause";
  }
}

function setUpTrack(){
  // timeTrack = document.getElementById("timeTrack");
  // timeLabel = document.getElementById("timeLabel");
  let trackBar  = document.getElementById("trackBar");
  trackBar.addEventListener("click", function(e) {
    if(myPlayer !== null) {
      if (!(myPlayer.getState() === constStatePlaying
          || myPlayer.getState() === constStatePause))
        return;
    }
    else{
      return;
    }
    let seekPos = e.offsetX / this.offsetWidth;
    timeTrack.style.width = seekPos * 100 + "%";
    let seekTimeSec = seekPos * 7200;
    timeLabel.innerHTML = formatTime(seekTimeSec);
  })
}

// Called on resume (video ready or seek end)
function startTrackTimer (){
  trackTimer = setInterval(function () {
    updateTrackTime();
  }, trackTimerInterval);
};

// NOTE: called on pause
function stopTrackTimer () {
  if (trackTimer != null) {
    clearInterval(trackTimer);
    trackTimer = null;
  }
};

// NOTE: Called when video ends
function resetTrack(){
  if (timeTrack) { //} && !bSeek) {
    timeTrack.value = 0;
    timeTrack.style.width = "0%";
  }
  if (timeLabel) { //} && !bSeek) {
    timeLabel.innerHTML = formatTime(0) + " / " + displayDuration;
  }
}

function updateTrackTime() {
  if (myPlayer.getState() !== constStatePlaying) return;
  let currentPlayTime = myPlayer.getCurrentTime() + myPlayer.getTimeOffset();
  if(currentPlayTime < 0) return;

  if (timeTrack) {
    timeTrack.style.width = 100 + "%";
  }
  if (timeLabel) {
    timeLabel.innerHTML = formatTime(currentPlayTime);
  }
};

function formatTime(s) {
  let h = Math.floor(s / 3600) < 10 ? '0' + Math.floor(s / 3600) : Math.floor(s / 3600);
  let m = Math.floor((s / 60 % 60)) < 10 ? '0' + Math.floor((s / 60 % 60)) : Math.floor((s / 60 % 60));
  s = Math.floor((s % 60)) < 10 ? '0' + Math.floor((s % 60)) : Math.floor((s % 60));
  let result = h + ":" + m + ":" + s;
  return result;
};

function setupMainUI(){
  document.addEventListener("onVideoReady", (event) => {
    //me.util.log("constructor", "onVideoReady");
    hideLoading();
    setUpTrack();
    startTrackTimer();

    displayLiveButton(true);
    changeLiveColorButton(true);

    togglePlayPause(false);
  });

  document.addEventListener("visibilitychange", function() {
    if (document.hidden){
      //window.alert("hidden");
      windowSwitch = true;
    } else {
      //window.alert("visible");
    }
  });

  document.addEventListener("onVideoEnd", (event) => {
    let fn = "onVideoEnd";
    //logger.logInfo(fn);
    hideLoading();
    showVideoMessage("The broadcast you were watching has ended");
    //displayControlButtons(false);
  });

  document.addEventListener("onSuperStreamApiError", (event) => {
    showVideoMessage("Unable to load content");
    //displayControlButtons(false);
  });

  setupMouseEvents();

  if(!userAgentIOS && !userAgentAndroid){
    // hide button
    document.getElementById("appButton").style.visibility = "hidden";
  }
  else{
    document.getElementById("appButton").style.visibility = "visible";
  }
}

function setupMouseEvents(){
  let videoPlayer    = document.getElementById("videoPlayer");
  let descriptionBar = document.getElementById("descriptionBar");
  let controls       = document.getElementById("controls");
  let timer;

  videoPlayer.addEventListener("mousemove", function (event) {
    controls.style.transform = "translateY(0)";
    if (document.fullscreenElement)
      descriptionBar.style.transform = "translateY(0)";
    clearTimeout(timer);
    timer = setTimeout(function () {
      controls.style.transform = "translateY(100%)";
      descriptionBar.style.transform = "translateY(-100%)";
    }, 10000);
  });

  videoPlayer.addEventListener("mouseleave", function (event) {
    controls.style.transform = "translateY(100%)";
    descriptionBar.style.transform = "translateY(-100%)";
  });
}