const COMMAND = ["none", "pause", "resume", "seek", "seek2", "rtqa", "ad"];

const VIDEOTYPE_VR    = 1;
const VIDEOTYPE_MTV   = 2;

const KEY_LINK       = "link";
const KEY_URL     = "url";
const KEY_WSLINK     = "ws_link";
const KEY_MSG        = "msg";
const KEY_C          = "c";
const KEY_META       = "meta";
const KEY_WIDTH      = "width";
const KEY_SN         = "sn";
const MSG_NoSession  = "sessions are up and running";
const C_START        = "start";
const C_FIRST        = "first";
const C_FOV          = "fov";
const C_RESET        = "reset";
const C_STOP         = "stop";

// Keys
const COMMANDKEY = "c";
const TIMESTAMP = "t";
const AZIMUTH = "a";
const PITCH = "p";
const BANDWIDTH = "b";
const HEIGHT = "h";
const WIDTH = "w";
const FRAME = "f";
const LATENCY = "l";
const RELATIVE = "x";
const ABSOLUTE = "s";

// RTQA
const SCREENWATCHED = "sw";
const FRAMENUMBER = "fn";
const CONTENTID = "cid";
const CLIENTID = "clid";
const UA = "ua";
const CUSTOMMSG = "cm";
const VIEWMODE = "vm";
const DEVICE = "dvc";
const WATCHTIME = "wt";
const ADEVENT = "ae";
const SKIP = "skp";

const ERROR_UNDEFINED = 0;
const ERROR_OTHER = 1;
const ERROR_VIDEO = 2;
const ERROR_CONNECTION = 3;

const ERROR_VIDEO_NONE = 0;
const ERROR_VIDEO_OTHER = 1;
const ERROR_VIDEO_DECODING = 2;
const ERROR_VIDEO_RENDER = 3;

const SB_LAYOUT_UNDEFINED = 0;
const SB_LAYOUT_SINGLE = 1;
const SB_LAYOUT_QUAD = 2;
const SB_LAYOUT_THREEMINOR = 3;

const ADEVENT_NONE = 0;
const ADEVENT_OPEN = 1;
const ADEVENT_CLOSE = 2;
const ADEVENT_WATCHSTART = 3;
const ADEVENT_WATCHEND = 4;

const LAYOUT = ["undefined", "single", "quad", "dominant"];
const ADEVENTS = ["none", "open", "close", "watchstart", "watchend"];

// Constants pulled consto this class for convenience.
const STATE_ERROR = -1;
const STATE_IDLE = 0;
const STATE_PREPARING = 1;
const STATE_PREPARED = 2;
const STATE_PLAYING = 3;
const STATE_PAUSED = 4;
const STATE_PLAYBACK_COMPconstED = 5;

// SuperStream Play Control
const NONE        = 0;
const PAUSE       = 1;
const RESUME      = 2;
const SEEK        = 3;
const SEEK2       = 4;
const RTQA        = 5;
const AD          = 6;

//Decoder request.
const constInitReq          = 0;
const constDeinitReq        = 1;
const constStartDecodingReq = 2;
const constPauseDecodingReq = 3;
const constUpdateFrameBuff  = 4;
const constChangeSrcIdx     = 5;
const constChangeEndSeg     = 6;
const constGetFSD           = 7;
const constOpenReq          = 8;

//Decoder response.
const constInitRsp          = 10;
const constDeinitRsp        = 11;
const constVideoFrame       = 12;
const constAudioFrame       = 13;
const constSrcIdxChange     = 14;
const constOtherMsg         = 15;
const constEndReached       = 16;
const constFSDString        = 21;
const constUUIDNotFound     = 22;
const constDecoderError     = 23;
const constInitAudioOffset  = -100000;

// Websocket
const MIN_SEG_DIST = 5;
const MAX_PAUSE_SEGS_DIST = 100;

// Browser
const browserChrome = 0;
const browserSafari = 1;
const browserFirefox = 2;
