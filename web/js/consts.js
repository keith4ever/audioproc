/*
 * Copyright (c) 2014 -     Keith Ha (keith4ever@gmail.com)
 * All content herein is protected by U.S. copyright and other applicable intellectual property laws
 * and may not be copied without the expressive permission of Keith Ha, who reserves all rights.
 * Reuse of any of the content for any purpose without the permission of Keith Ha
 * is strictly and expressively prohibited.
 */


const COMMAND = ["none", "pause", "resume", "seek", "seek2", "rtqa", "ad"];

const ADEVENT_NONE = 0;
const ADEVENT_OPEN = 1;
const ADEVENT_CLOSE = 2;
const ADEVENT_WATCHSTART = 3;
const ADEVENT_WATCHEND = 4;

const ADEVENTS = ["none", "open", "close", "watchstart", "watchend"];

// SuperStream Play Control
const NONE        = 0;
const PAUSE       = 1;
const RESUME      = 2;
const AD          = 6;

//Decoder request.
const constInitReq          = 0;
const constOpenReq          = 1;

//Decoder response.
const constAudioFrame       = 13;
const constOtherMsg         = 15;
const constEndReached       = 16;
const constUUIDNotFound     = 22;
const constInitAudioOffset  = -100000;

// Browser
const browserChrome = 0;
const browserSafari = 1;
const browserFirefox = 2;

//Player states.
const constStateStop            = 0;
const constStatePlaying         = 1;
const constStatePause           = 2;
const constStateInitializing    = 3;

//Constant.
const constBufferTime           = 20;
