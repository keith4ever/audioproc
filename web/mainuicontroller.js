let windowSwitch = false;

let easterEggClicks = 0;

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
  // arr.forEach(val => {
  //   //window.alert(val);
  //   if(agent.indexOf(val) > -1) return true;
  // });
  for(let i = 0; i < arr.length; i++){
    if(agent.indexOf(arr[i]) > -1) return true;
  }
  return false;
}

let userAgentAndroid = agent.indexOf("android") > -1;
let userAgentIOS = hasUserAgent(["ios","iphone","ipad","ipod"]); // agent.indexOf("iphone") > -1; //
// window.alert(agent);
// window.alert("iOS: " + userAgentIOS);

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

function onEasterEggClick(){
  easterEggClicks++;
  if(easterEggClicks >= 5){
    document.getElementById("testBar").style.display = "block";
    document.getElementById("videoPlayer").style.height = "calc(56.25vw + 28px)"; //NOTE: Doesn't work?
  }
}

function loadAppOrPlayStore() {
  if(!userAgentIOS && !userAgentAndroid) return;
  windowSwitch = false;
  let url = window.location.pathname;
  window.location.href = "cruztv://uuid?" + this.superStreamPlayerSDK.uuid;
  setTimeout(()=>{
    if(!windowSwitch){
       //window.alert("hidden");
       let store = userAgentAndroid ? "https://play.google.com/store/apps/details?id=com.alcacruz.cruztv"
          : "https://apps.apple.com/us/app/cruztv/id1472275741";
       window.location = store;
     }
    }, 1000);
}

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
  let forward = document.getElementById("forward");
  let backward = document.getElementById("backward");
  let timeLabel = document.getElementById("timeLabel");

  if(show){
    trackBar.style.visibility = "visible";
    forward.style.display = backward.style.display = timeLabel.style.display = "flex";
    trackBar.style.marginTop = "10px";
  }
  else {
    trackBar.style.visibility = "hidden";
    forward.style.display = backward.style.display = timeLabel.style.display = "none";
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

function addVideoListItem(title, author, imageLink, uuid){
  let videoListContainer = document.getElementById("videoListContainer");
  let videoListItem = document.createElement('div');
  videoListItem.className = "videoListItem";
  videoListItem.onclick = function() {onVideoListClick(uuid)};//onVideoListClick(uuid);

  let vliImg = document.createElement('div');
  vliImg.className = "VLI_img";
  if(!imageLink.includes("https"))
    imageLink = imageLink.replace("http", "https");
  vliImg.style.backgroundImage = "url(" + imageLink +")";
  videoListItem.appendChild(vliImg);

  let vliTextContainer = document.createElement('div');
  vliTextContainer.className = "VLI_textContainer";
  let vliTitle = document.createElement('div');
  vliTitle.className = "VLI_title";
  vliTitle.innerHTML = title;
  vliTextContainer.appendChild(vliTitle);

  let vliAuthor = document.createElement('div');
  vliAuthor.className = "VLI_author";
  vliAuthor.innerHTML = author;
  vliTextContainer.appendChild(vliAuthor);

  videoListItem.appendChild(vliTextContainer);

  videoListContainer.appendChild(videoListItem);
}

function setUpTrack(){
  // timeTrack = document.getElementById("timeTrack");
  // timeLabel = document.getElementById("timeLabel");
  let trackBar  = document.getElementById("trackBar");
  let me = this;
  trackBar.addEventListener("click", function(e) {
    if(me.superStreamPlayerSDK !== null) {
      if (!(me.superStreamPlayerSDK.getPlayerState() === constStatePlaying || me.superStreamPlayerSDK.getPlayerState() === constStatePause))
        return;
    }
    else{
      return;
    }
    let seekPos = e.offsetX / this.offsetWidth;
    timeTrack.style.width = seekPos * 100 + "%";
    let seekTimeSec = seekPos * me.superStreamPlayerSDK.getDuration();
    timeLabel.innerHTML = formatTime(seekTimeSec) + " / " + displayDuration;
    let firstSec = Math.round(seekTimeSec);
    me.superStreamPlayerSDK.seek(firstSec);
  })
  //self.superStreamPlayerSDK.setTrack(timeTrack, timeLabel);
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
  if (this.superStreamPlayerSDK.player.playerState == constStatePlaying) {
    let currentPlayTime = this.superStreamPlayerSDK.getCurrentPlayTime();
    if(currentPlayTime < 0) return;

    if (timeTrack && !this.superStreamPlayerSDK.isSeeking()) {
      let timePos = currentPlayTime / this.superStreamPlayerSDK.getDuration(); //* 1000;
      timeTrack.style.width = timePos * 100 + "%";
    }
    if (timeLabel && !this.superStreamPlayerSDK.isSeeking()) {
      timeLabel.innerHTML = formatTime(currentPlayTime) + " / " + displayDuration;
    }
  }
};

function formatTime(s) {
  let h = Math.floor(s / 3600) < 10 ? '0' + Math.floor(s / 3600) : Math.floor(s / 3600);
  let m = Math.floor((s / 60 % 60)) < 10 ? '0' + Math.floor((s / 60 % 60)) : Math.floor((s / 60 % 60));
  s = Math.floor((s % 60)) < 10 ? '0' + Math.floor((s % 60)) : Math.floor((s % 60));
  let result = h + ":" + m + ":" + s;
  return result;
};

function onVideoListClick(uuid){
  if(window.location.href.includes("test.cruz.tv"))
    window.location = "https://test.cruz.tv/player.html?uuid=" + uuid;
  else window.location = "https://watch.cruz.tv/player.html?uuid=" + uuid;
}

function setupMainUI(){
  document.addEventListener("onVideoReady", (event) => {
    //me.util.log("constructor", "onVideoReady");
    hideLoading();
    if (timeTrack) {
      timeTrack.max = this.superStreamPlayerSDK.getDuration();
      displayDuration = formatTime(this.superStreamPlayerSDK.getDuration());
    }
    setUpTrack();
    startTrackTimer();

    if(this.superStreamPlayerSDK.isLive) {
      displayLiveButton(true);
      displaySeekButtons(false);
      changeLiveColorButton(true);
    }

    togglePlayPause(false);
    //
  });

  document.addEventListener("onSeekEnd", (event) => {
    //me.util.log("constructor", "onSeekEnd");
    hideLoading();
    startTrackTimer();
    // if (timeTrack) {
    //   timeTrack.max = this.duration;
    //   displayDuration = formatTime(this.duration / 1000);
    // }
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
    logger.logInfo(fn);
    hideLoading();
    if(this.superStreamPlayerSDK.isLive && !forceStop) {
      showVideoMessage("The broadcast you were watching has ended");
      displayControlButtons(false);
      // if(this.superStreamConnect) this.superStreamConnect.closeWebsocket();
    }
    //sendRTQA();
  });

  document.addEventListener("onSuperStreamApiError", (event) => {
    showVideoMessage("Unable to load content");
    displayControlButtons(false);
  });

  document.addEventListener('fullscreenchange', (event) => {
    document.getElementById("full-screen").className = document.fullscreenElement? "compress" : "expand";
    // TODO: Change how we get canvas
    let canvas = document.getElementById("playCanvas");
    canvas.style.width = document.fullscreenElement? "100vw" : "100%";
    canvas.style.height = document.fullscreenElement? "56.25vw" : "100%";
    document.getElementById("timeTrack").style.width = document.fullscreenElement? "calc(100vw - 20px)" : "calc(90vw - 20px)";
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
    }, 2000);
  });

  videoPlayer.addEventListener("mouseleave", function (event) {
    controls.style.transform = "translateY(100%)";
    descriptionBar.style.transform = "translateY(-100%)";
  });
}