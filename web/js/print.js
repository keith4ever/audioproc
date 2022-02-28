/*
 * Copyright (c) 2014 -     Keith Ha (keith4ever@gmail.com)
 * All content herein is protected by U.S. copyright and other applicable intellectual property laws
 * and may not be copied without the expressive permission of Keith Ha, who reserves all rights.
 * Reuse of any of the content for any purpose without the permission of Keith Ha
 * is strictly and expressively prohibited.
 */

function Logger(module) {
    this.module = module;
    this.prevtime = 0;
}

Logger.prototype.log = function (line) {
    console.log("[" + this.module + ": " + this.currentTimeStr() + "] ");
};

Logger.prototype.logError = function (line) {
    console.log("%c [" + this.module + ": " + this.currentTimeStr() + "] " + line,
        'color: red;');
};

Logger.prototype.logInfo = function (line) {
    console.log("[" + this.module + ": " + this.currentTimeStr() + "] " + line);
};

Logger.prototype.isNullOrEmpty = function(str){
    if(str !== null){
        if (str != "" && str.length !== 0) return false;
        else return true;
    }
    return true;
}

Logger.prototype.currentTimeStr = function () {
    var now = new Date(Date.now());
    var hour = now.getHours();
    var min = now.getMinutes();
    var sec = now.getSeconds();
    var ms = now.getMilliseconds();
    return hour + ":" + min + ":" + sec + ":" + ms;
};


Logger.prototype.currentTimeDiff = function () {
    var now = new Date(Date.now());
    var hour = now.getHours();
    var min = now.getMinutes();
    var sec = now.getSeconds();
    var ms = now.getMilliseconds();

    var curr = min * 60000 + sec * 1000 + ms;
    var diff = curr - this.prevtime;
    this.prevtime = curr;
    return hour + ":" + min + ":" + sec + ":" + ms + " Diff: " + diff;
};
