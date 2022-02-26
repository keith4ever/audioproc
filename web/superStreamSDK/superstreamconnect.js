let socket = null;
let className = "SuperStreamConnect";
let wsConnected = false;
let stopCommandReceieved = false;
let reconnectTimes = 0;
const maxReconnect = 5;
let currentWsLink = "";
let timePassed = 0;

const onWebsocketOpen = new CustomEvent("onWebsocketOpen", {
  detail: {},
  bubbles: true,
  cancelable: true,
  composed: false,
});

const onWebsocketClose = new CustomEvent("onWebsocketClose", {
  detail: {},
  bubbles: true,
  cancelable: true,
  composed: false,
});

const onWebsocketError = new CustomEvent("onWebsocketError", {
  detail: {},
  bubbles: true,
  cancelable: true,
  composed: false,
});

const onWebsocketStopReceive = new CustomEvent("onWebsocketStopReceive", {
  detail: {},
  bubbles: true,
  cancelable: true,
  composed: false,
});

function SuperStreamConnect(wsLink){
  this.logger = new Logger(className);
  self.util = new Util(className);

  startWebsocket(wsLink);
}

SuperStreamConnect.prototype.sendMessage = function (msg) {
  let func = "sendMessage";

  this.logger.logWS(func, `sending ${msg}`);
  sendMessage(msg);
}

SuperStreamConnect.prototype.isWsConnected = function () {
  if(socket === null) return false;
  wsConnected = socket.readyState === 1;
  return wsConnected;
}

SuperStreamConnect.prototype.reconnect = function () {
  reconnectInternal();
}

SuperStreamConnect.prototype.closeWebsocket = function(){
  closeWebsocketInternal();
}

function startWebsocket(wsLink){
  this.logger = new Logger(className);
  let func = "startWebsocket";
  //console.log(tag + sp + "WS link: " + wsLink);
  if(self.util.isNullOrEmpty(wsLink)){
    this.logger.logWS(func, "Link is null");
    return;
  }
  else{
    this.logger.logWS(func, "WS Link: " + wsLink);
  }

  checkConnection();
  currentWsLink = wsLink;

  try{
    socket = new WebSocket(wsLink + "&ak="+apiKeyWs + "&ua=cruztv-webapp");

    socket.onopen = function(e) {
      //console.log(tag + sp + "Connection established");
      this.logger = new Logger("SuperStreamConnect");
      this.logger.logWS(func, "Connection established");

      wsConnected = true;
      document.dispatchEvent(onWebsocketOpen);
      heartbeat();
      //alert("Sending to server");
      reconnectTimes = 0;
      timePassed = 0;
    };

    socket.onmessage = function(event) {
      //console.log(tag + sp + `[message] Data received from server: ${event.data}`);
      this.logger.logWS(func, `[message] Data received from server: ${event.data}`);
      processData(event.data);
    };

    socket.onclose = function(event) {
      if (event.wasClean) {
        this.logger.logWS(func, `[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`);
      } else {
        // e.g. server process killed or network down
        // event.code is usually 1006 in this case
        this.logger.logWS(func, '[close] Connection died');
      }
      document.dispatchEvent(onWebsocketClose);
    };

    socket.onerror = function(error) {
      this.logger.logWS(func, `[error] ${error.message}`);
      document.dispatchEvent(onWebsocketError);
    };
  }
  catch (exception) {
    this.logger.logError(exception);
  }
}

function closeWebsocketInternal(){
  if(socket){
    socket.closeWebsocket();
    socket = null;
  }
}

function processData(data){
  let json = JSON.parse(data);
  for(let prop in json){
    //console.log(prop + ": " + json[prop]);
  }
  if(json.hasOwnProperty(KEY_SN)){
    gEndSegmentNumber = json[KEY_SN];
    const onLiveEndSegmentNumber = new CustomEvent("onLiveEndSegmentNumber", {
      detail: {sn: gEndSegmentNumber, link: json[KEY_URL]},
      bubbles: true,
      cancelable: true,
      composed: false,
    });

    //  this.dispatchEvent(new CustomEvent('awesome', { bubbles: true, detail: { text: () => textarea.value } }))
    document.dispatchEvent(onLiveEndSegmentNumber);
  }
  else if (json.hasOwnProperty(KEY_C)){
    processCommand(json[KEY_C]);
  }
}

function sendMessage(msg){
  let func = "sendMessage";

  if(msg != null) {
    this.logger.logWS(func, msg);
    socket.send(msg);
  }
}

function processCommand(c){
  let func = "processCommand";
  this.logger.logWS(func, "Command: " + c);
  if(c == C_STOP){
    document.dispatchEvent(onWebsocketStopReceive);
  }
}

function reconnectInternal(){
  let func = "reconnect";

  if(reconnectTimes < maxReconnect){
    setTimeout(()=>{
      startWebsocket(currentWsLink);
      reconnectTimes++;
    }, 1000);
  }
  this.logger.logWS(func, "Reconnecting: " + reconnectTimes);
}

function heartbeat() {
  if (!socket) return;
  if (socket.readyState !== 1) return;
  socket.send("heartbeat");
  setTimeout(heartbeat, 500);
}

function checkConnection() {
  let timeInterval = 500;
  timePassed += timeInterval;
  let readyState = -1;
  if(socket !== null) readyState = socket.readyState;
  let connected = false;
  if(socket !== null) {
    if(socket.readyState === 1) connected = true;
  }
  if(timePassed >= 10 * 1000 && !connected){
    this.logger.logWS("checkConnection", "Timeout");
    if(reconnectTimes >= 1 && reconnectTimes < maxReconnect){
      this.logger.logWS("checkConnection", "Attempting to reconnect...");
      reconnectInternal();
    }
    return;
  }
  else if(connected) {
    this.logger.logWS("checkConnection", "Started normally");
    return;
  }
  else{
    this.logger.logWS("checkConnection", "Time passed: " + timePassed + "ms" + ". Ready state: " + readyState);
  }

  setTimeout(checkConnection, timeInterval);
}
