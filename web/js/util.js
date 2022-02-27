/*
 * Copyright (c) 2014 -     Keith Ha (keith4ever@gmail.com)
 * All content herein is protected by U.S. copyright and other applicable intellectual property laws
 * and may not be copied without the expressive permission of Keith Ha, who reserves all rights.
 * Reuse of any of the content for any purpose without the permission of Keith Ha
 * is strictly and expressively prohibited.
 */

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
