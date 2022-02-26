let sp = " :: ";

function createTag(className, fn){
  return "[" + className + ", " + fn + "]";
}

function Util(className){
  this.className = className;
}
Util.prototype.log = function(functionName, msg){
  let tag = createTag(this.className, functionName);
  if(msg !== "" && msg !== null) tag = tag + sp + msg;
  console.log(tag);
}

Util.prototype.isNullOrEmpty = function(str){
  if(str !== null){
    if (str != "" && str.length !== 0) return false;
    else return true;
  }
  return true;
}
