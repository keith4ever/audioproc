let classNameMain = "mainPlayer.js";
let lockButtons = false;
let uuid = null;
let segment = 0;

setup();

function setup(){
    this.util = new Util(classNameMain);
    this.player = new Player();
    this.Api = new Api();
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
    if(uuid === null || segment <= 0) {
        setTimeout(this.Api.getLiveInfo.bind(handleGetLiveInfo), 10);
    }

    let currentState = this.player.getState();
    if(currentState == constStateStop) {
        this.player.play(this.Api.apiBaseLink + "/" + uuid, segment);
        this.player.unmute();
        showLoading();
    }
    else if(currentState === constStatePlaying){
        this.player.stop();
        uuid = null; segment = 0;
        document.getElementById("play-pause").className = "play";
        changeLiveColorButton(false);
    }
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
    if(this.player === null) return;
    this.util.log(func, "Live already enabled");
}

function onPlayButtonClick(){
    if(lockButtons) return;
    playVideo(); // Plays or pauses depending on state
    if(this.player.getState() === constStatePlaying){
        togglePlayPause(false);
    }
    else if(this.player.getState() === constStatePause){
        togglePlayPause(true);
    }
}

function onCopyLinkToClipboardClick(){
}

function showVideoMessage(msg){
    if(this.util.isNullOrEmpty(msg)) return;
    let videoMessage = document.getElementById("videoMessage");
    videoMessage.style.visibility = "visible";
    videoMessage.firstElementChild.innerHTML = msg;
}

function handleGetLiveInfo(data){
    const obj = JSON.parse(data);
    uuid = obj.id;
    segment = obj.seg;
    playVideo();
}
