// Constructor
function Api(){
  //alert("created super stream api");
    this.apiBaseLink = "http://10.1.10.43:8080";
    this.className = "Api";
    this.util = new Util(this.className);
    this.uuid = null;
    this.segno = 0;
}

Api.prototype.getLiveInfo = function (callback){
    var url = this.apiBaseLink + "/muselive"
    this.makeRequest(url, callback);
}

Api.prototype.makeRequest = function(link, callback) {
    let me = this;
    try {
        fetch(link, {
            method: "GET",
        })
            .then(response => response.json())
            .then(data => {
                me.util.log(data);
                printJson(data);
                callback(data);
            })
            .catch(err => me.util.log(err));
    }
    catch(exception){
        me.util.log("Error making Api request");
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
