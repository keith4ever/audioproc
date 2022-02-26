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

Logger.prototype.logDebug = function (line) {
    //console.log("[" + this.module + ": " + this.currentTimeDiff() + "] " + line);
};

Logger.prototype.logWS = function (functionName, line) {
    //console.log("[" + this.module + ", " + functionName + "] " + line);
};

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
