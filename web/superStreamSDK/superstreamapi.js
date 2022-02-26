// Constructor
function SuperStreamApi(){
  //alert("created super stream api");
    this.apiBaseLink = "https://api.cruz.tv";// "https:/rtqa.alcacruz.com"; // TODO: Check https
    this.videoInfoLinkExt = "/content/video/info";
    this.videoContentListLinkExt = "/content/list/video";
    this.apiKey = "7d3568e5f1126764ac2c249f5240315441d725793d1b7b638f63e3d20769f381012a2cf89ae716f419404be8dd11153be9c5bada35490747faf38b262bd55270";
    this.className = "SuperStreamApi";
    this.util = new Util(this.className);
}

SuperStreamApi.prototype.setApiKey = function (apiKey){
    this.apiKey = apiKey;
}

SuperStreamApi.prototype.getVideoInfo = function (uuid, callback){
    let link = this.apiBaseLink + this.videoInfoLinkExt + '/' + uuid;
    this.makeRequest(link, callback);
}

SuperStreamApi.prototype.getVideoContentList = function (callback){
    let link = this.apiBaseLink + this.videoContentListLinkExt;
    this.makeRequest(link, callback);
}

SuperStreamApi.prototype.makeRequest = function(link, callback) {
    let me = this;
    try {
        fetch(link, {
            method: "GET",
            headers: {
                "Content-type": "application/json;charset=UTF-8",
                "Authorization": "Alcacruz:" + me.apiKey
            }
        })
            .then(response => response.json())
            .then(data => {
                me.util.log(data);
                //printJson(data);
                callback(data);
            })
            .catch(err => me.util.log(err));
    }
    catch(exception){
        me.util.log("Error making SuperStreamApi request");
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

function printJson(data){
  for(let prop in data){
    console.log(prop + ": " + data[prop]);
  }
}

// const params = {
//     param1: value1,
//     param2: value2;
// };

// POST
// const params = {
//     param2: value2;
// };
// const options = {
//     method: 'POST',
//     body: JSON.stringify( params )
// };
// fetch( apiBaseLink + videoInfoLinkExt, options )
//     .then( response => response.json() )
//     .then( response => {
//         // Do something with response.
//     } );
