var gEndSegmentNumber = -1;
const apiKeyWs = "ZW1haWw9c2Fsb21vbi5sZWVAYWxjYWNydXouY29tOmNvbXBhbnk9QWxjYWNydXo6Zmlyc3RfbmFtZT1TYWxvbW9uOmxhc3RfbmFtZT1MZWU6cmVnaXN0cmF0aW9uX2R0PTE0NzU3NzUxMzI5NDA=";

const H264codec = 0;
const H265codec = 1;

//Display Layout
const layoutSingle       = 0;
const layoutQuadrant     = 1;
const layoutThreeMinor   = 2;
const layoutUndefined    = 3;
//Default Video Order
const quadrantVideoOrderFour = [0,1,2,3];
const quadrantVideoOrderThree = [0,1,2];
const threeMinorVideoOrderFour = [
    [0,1,2,3],
    [1,0,2,3],
    [2,0,1,3],
    [3,0,1,2],
    [0,1,2,3]
];
const threeMinorVideoOrderThree = [
    [0,1,2],
    [1,0,2],
    [2,0,1],
    [0,1,2]
];
const videoOrderTwo = [
    [0,1],
    [1,0],
    [0,1]
];

//H264player states.
const constStateStop            = 0;
const constStatePlaying         = 1;
const constStatePause           = 2;
const constStateInitializing    = 3;

//Constant.
const constBufferTime           = 20;

// let btnPlayPause = document.getElementById("play-pause");
// let lockButtons = false;

