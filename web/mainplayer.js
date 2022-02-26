let classNameMain = "mainPlayer.js";

// Only for easter egg
let forceLive; // = parseQueryString(mainUrl)["isLive"] == "true" ? true : false;
// simulate getting segment number from websocket
let liveEnabled = false;
let forceStop = false;
//let logger  =     new Logger("mainplayer");
let playClicked = false;
let lockButtons = false;
let enableAutoPlay = false;

// TODO: Move
let currentVideoLink = "";
//let videoBaseUrl = "";
let currentVideoContent = null;
let canvas = null;

setup();

function setup(){
    // if(uuid === "" || uuid.length === 0) uuid = "c3ce5bbb-9845-4386-8d44-5b90c2987449";
    // inputUrl.value = uuid;
    this.util = new Util(classNameMain);
    this.superStreamPlayerSDK = new SuperStreamPlayerSDK();

// //Formated logger.
//     let logger = new Logger("Page");

    const canvasId = "playCanvas";
    canvas = document.getElementById(canvasId);

    this.superStreamApi = new SuperStreamApi();
    // Get the video info if on the player page
    if(!this.util.isNullOrEmpty(this.superStreamPlayerSDK.uuid)) {
        this.superStreamApi.getVideoInfo(this.superStreamPlayerSDK.uuid, handleGetVideoInfo);
    }
    // Otherwise, get video content list
    this.superStreamApi.getVideoContentList(handleGetVideoList);
}

// TODO: rename
function openHomePageClick(){
  //window.open("https://watch.cruz.tv"); // new tab
    if(window.location.href.includes("test.cruz.tv"))
        window.location = "https://test.cruz.tv";
    else window.location = "https://watch.cruz.tv";
}

// TODO: Move?
function delayStartLiveVideo(){
    changeLiveColorButton(true);
    // TODO: Make function for this in SSPSDK
    showLoading();
    //startPlay = false; // When next segment received, it will restart stream
    liveEnabled = true;
    this.superStreamPlayerSDK.forceStartLive();
}

function playVideo() {
    let fn = "playVideo";
    playClicked = true;
    let currentState = this.superStreamPlayerSDK.getPlayerState();
    if(currentState == constStateStop) {
        this.superStreamPlayerSDK.play(currentVideoContent, canvas);
        this.superStreamPlayerSDK.unmute();
        showLoading();
    }
    else if(currentState === constStatePause) { // Pause --> Play
        if(gEndSegmentNumber > this.superStreamPlayerSDK.lastSegNo + MAX_PAUSE_SEGS_DIST && this.superStreamPlayerSDK.lastSegNo > -1 && this.superStreamPlayerSDK.isLive){
            this.util.log(fn, "Too much time elapsed, resuming live. Current: " + gEndSegmentNumber + ". Last: " + this.lastSegNo);
            delayStartLiveVideo();
        }
        else this.superStreamPlayerSDK.resume();
    }
    else if(currentState === constStatePlaying){
        this.superStreamPlayerSDK.pause();
        if(this.superStreamPlayerSDK.isLive){
            changeLiveColorButton(false);
        }
    }
}

function stopVideo(changeButton) {
    // var firstSec = Math.floor(Math.random() * this.player.duration / this.player.segterm);
    // this.player.seek(firstSec, 0);

    this.superStreamPlayerSDK.stopPlayer();
    if(changeButton){
        document.getElementById("play-pause").className = "play";
    }
    //startPlay = false;
}

function copyLinkToClipboard(){
    if (!window.getSelection) {
        alert('Please copy the URL from the location bar.');
        return;
    }
    const dummy = document.createElement('p');
    dummy.textContent = window.location.href;
    document.body.appendChild(dummy);

    const range = document.createRange();
    range.setStartBefore(dummy);
    range.setEndAfter(dummy);

    const selection = window.getSelection();
    // First clear, in case the user already selected some other text
    selection.removeAllRanges();
    selection.addRange(range);

    document.execCommand('copy');
    alert('Copied Link to Clipboard.');
    document.body.removeChild(dummy);
    this.superStreamPlayerSDK.stopPlayer();
}

function errReport(e){
    let fn = "errReport";
    this.util.log(fn, "play error " + e.error + " status " + e.status + ".");
    if (e.error == 1) {
        this.util.log("Finished.");
    }
}

function onLiveButtonClick(){
    if(lockButtons) return;
    let func = "onLiveButtonClick";
    if(this.superStreamPlayerSDK === null) return;
    let currentState = this.superStreamPlayerSDK.getPlayerState();
    // if(currentState !== constStatePlaying) {
    //     logger.logInfo(func, "Video not playing");
    //     return;
    // }
    if(!liveEnabled || currentState === constStatePause) {
        this.util.log(func, "Enabling live");
        //stopVideo(false);
        setTimeout(delayStartLiveVideo, 500);
        togglePlayPause(false);
    }
    else this.util.log(func, "Live already enabled");
}

function onPlayButtonClick(){
    if(lockButtons) return;
    playVideo(); // Plays or pauses depending on state
    if(this.superStreamPlayerSDK.getPlayerState() === constStatePlaying){
        togglePlayPause(false);
    }
    else if(this.superStreamPlayerSDK.getPlayerState() === constStatePause){
        togglePlayPause(true);
    }
}

function onSeekBackwardForwardClick(forward){
    if(lockButtons) return;
    this.superStreamPlayerSDK.seekBackwardForward(forward);
    showLoading();
}

function onCopyLinkToClipboardClick(){
    copyLinkToClipboard();
}

function onFullScreenButtonClick(){
    this.superStreamPlayerSDK.fullscreen();
}

function showVideoMessage(msg){
    if(this.util.isNullOrEmpty(msg)) return;
    let videoMessage = document.getElementById("videoMessage");
    videoMessage.style.visibility = "visible";
    videoMessage.firstElementChild.innerHTML = msg;
}

function handleGetVideoList(data) {
    let fn = "handleGetVideoList";
    let totalVids = 0;

    if(document.getElementById("mainContainerInnerRight") === null) return; // for player page
    for(let i = 0; i < data["videoContent"].length; i++){
        let videoArray = data["videoContent"][i];

        let temp = videoArray["videoLink"].split('/');
        let vidUuid = temp[temp.length-1];

        // NOTE: If this is true, we are on the home page loading up first video
        if(this.util.isNullOrEmpty(this.superStreamPlayerSDK.uuid) && i === 0) {
            this.superStreamPlayerSDK.uuid = vidUuid;
            this.superStreamApi.getVideoInfo(this.superStreamPlayerSDK.uuid, handleGetVideoInfo);
        }

        if(this.superStreamPlayerSDK.uuid != vidUuid) {
            // Displays videos from current channel only
            if(!this.util.isNullOrEmpty(this.superStreamPlayerSDK.channelName)) {
                if(!this.util.isNullOrEmpty(videoArray["channel"])) {
                    if (videoArray["channel"].toLowerCase() === this.superStreamPlayerSDK.channelName) {
                        addVideoListItem(videoArray["title"], videoArray["channel"], videoArray["imageLink"], vidUuid);
                        totalVids++;
                    }
                }
            }
            else {
                addVideoListItem(videoArray["title"], videoArray["channel"], videoArray["imageLink"], vidUuid);
                totalVids++;
            }
        }

        // Print each video list item
        // for (let prop in videoArray) {
        //     this.util.log(fn, prop + ": " + videoArray[prop]);
        // }
    }

    if(totalVids < 1) totalVids = 1;
    let height = 120 * totalVids; // 120 is default video list item height
    document.getElementById("videoListContainer").style.height = height + "px";
}

function handleGetVideoInfo(data){
    let fn = "handleGetVideoInfo";

    currentVideoContent = data;
    for(let prop in data){
        this.util.log(fn, prop + ": " + data[prop]);
    }

    // TODO: Add defines for video content info
    document.getElementById("videoTitle").style.visibility = "visible";
    if(data["title"]) {
        document.getElementById("videoTitle").innerHTML = data["title"];
        document.getElementById("videoTitleBar").innerHTML = data["title"];
    } // TODO: Check null
    else {
        document.getElementById("videoTitle").innerHTML = "ERROR";
        document.getElementById("videoTitleBar").innerHTML = "ERROR";
    }
    if (data["author"]) document.getElementById("videoAuthor").innerHTML = data["author"];
    else document.getElementById("videoAuthor").innerHTML = "ERROR";
    document.getElementById("videoAuthor").style.visibility = "visible";
    if(data["description"]) {
        document.getElementById("descriptionBox").firstElementChild.innerHTML = data["description"];
        // document.getElementById("videoDescriptionBar").innerHTML = data["description"];
    }
    else {
        document.getElementById("descriptionBox").firstElementChild.innerHTML = "ERROR";
        // document.getElementById("videoDescriptionBar").innerHTML = "null";
    }
    // if(data["viewCount"]) document.getElementById("videoViewCountBar").innerHTML = data["viewCount"] + " views";
    // else document.getElementById("videoViewCountBar").innerHTML = "0" + " views";
    document.getElementById("descriptionBox").firstElementChild.style.visibility = "visible";

    if (!canvas) {
        this.util.log(fn, "No Canvas with id " + canvasId + "!");
        return false;
    }

    // NOTE: If live, gotta wait for segment number from websocket to connect
    if(!this.superStreamPlayerSDK.isLive && (playClicked || enableAutoPlay)) {
        //if (currentVideoLink !== "" && currentVideoLink !== 0)
            this.superStreamPlayerSDK.play(data, canvas);//playVideoWithUrl(currentVideoLink);

        hideLoading();
    }

    //else logger.logInfo(tag + sp + "A value is undefined");
    //sendRTQA();
}
