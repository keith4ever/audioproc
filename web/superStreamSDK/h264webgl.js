
function H264WebGLPlayer(canvas, player) {
    this.canvas             = canvas;
    this.gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    this.player             = player;
    this.positionsBuffer    = null;
    this.attributes         = [];
    this.uniforms           = [];
    this.verticesIndexBuffer = null;
    this.vertices           = [];
    this.indices            = [];
    this.curAudioTrack      = 0;
    this.layout             = layoutUndefined;
    this.fsd                = null;
    this.isUnifiedD1        = false;
}

H264WebGLPlayer.prototype.setFSD = function (fsd, srcIdx) {
    //this.fsd = JSON.parse(fsd);
    this.fsd = fsd;
    switch(this.fsd.vnum){
        case 2:
            this.vertices = [
                [1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0],
                [0, 0.5, 0, -1, 0.5, 0, 0, -0.5, 0, -1, -0.5, 0,
                    1, 0.5, 0, 0, 0.5, 0, 1, -0.5, 0, 0, -0.5, 0]
            ];
            this.eachVidUv = [
                [1, 1, 0, 1, 1, 1-this.fsd.mainh/this.fsd.height, 0, 1-this.fsd.mainh/this.fsd.height],
                [1/2, 1-this.fsd.mainh/this.fsd.height, 0, 1-this.fsd.mainh/this.fsd.height, 1/2, 0, 0, 0]
            ];
            switch(srcIdx){
                case 0:
                default:
                    this.sourceVideoOrder = [0,1];
                    break;
                case 1:
                    this.sourceVideoOrder = [1,0];
                    break;
            }            break;
        case 3:
            this.vertices = [
                [1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0],
                [0, 1/2, 0, -1, 1/2, 0, 0, -1/2, 0, -1, -1/2, 0,
                    1, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0,
                    1, 0, 0, 0, 0, 0, 1, -1, 0, 0, -1, 0],
                [2/3, 1, 0, -2/3, 1, 0, 2/3, -1/3, 0, -2/3, -1/3, 0,
                    0, -1/3, 0, -2/3, -1/3, 0, 0, -1, 0, -2/3, -1, 0,
                    2/3, -1/3, 0, 0, -1/3, 0, 2/3, -1, 0, 0, -1, 0]
            ];
            this.eachVidUv = [
                [1, 1, 0, 1, 1, 1-this.fsd.mainh/this.fsd.height, 0, 1-this.fsd.mainh/this.fsd.height],
                [1/2, 1-this.fsd.mainh/this.fsd.height, 0, 1-this.fsd.mainh/this.fsd.height, 1/2, 0, 0, 0],
                [1, 1-this.fsd.mainh/this.fsd.height, 1/2, 1-this.fsd.mainh/this.fsd.height, 1, 0, 1/2, 0]
            ];
            switch(srcIdx){
                case 0:
                default:
                    this.sourceVideoOrder = [0,1,2];
                    this.renderedVideoOrderThree = [0,1,2];
                    break;
                case 1:
                    this.sourceVideoOrder = [1,0,2];
                    this.renderedVideoOrderThree = [1,0,2];
                    break;
                case 2:
                    this.sourceVideoOrder = [2,0,1];
                    this.renderedVideoOrderThree = [2,0,1];
                    break;
            }
            break;
        case 4:
            this.vertices = [
                [1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0],
                [0, 1, 0, -1, 1, 0, 0, 0, 0, -1, 0, 0,
                    1, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0,
                    0, 0, 0, -1, 0, 0, 0, -1, 0, -1, -1, 0,
                    1, 0, 0, 0, 0, 0, 1, -1, 0, 0, -1, 0],
                [2/3, 1, 0, -2/3, 1, 0, 2/3, -1/3, 0, -2/3, -1/3, 0,
                    -1/3, -1/3, 0, -1, -1/3, 0, -1/3, -1, 0, -1, -1, 0,
                    1/3, -1/3, 0, -1/3, -1/3, 0, 1/3, -1, 0, -1/3, -1, 0,
                    1, -1/3, 0, 1/3, -1/3, 0, 1, -1, 0, 1/3, -1, 0]
            ];
            this.eachVidUv = [
                [1, 1, 0, 1, 1, 1-this.fsd.mainh/this.fsd.height, 0, 1-this.fsd.mainh/this.fsd.height],
                [1/2, 1-this.fsd.mainh/this.fsd.height, 0, 1-this.fsd.mainh/this.fsd.height, 1/2, 1-(this.fsd.mainh + this.fsd.subh)/this.fsd.height, 0, 1-(this.fsd.mainh + this.fsd.subh)/this.fsd.height],
                [1, 1-this.fsd.mainh/this.fsd.height, 1/2, 1-this.fsd.mainh/this.fsd.height, 1, 1-(this.fsd.mainh + this.fsd.subh)/this.fsd.height, 1/2, 1-(this.fsd.mainh + this.fsd.subh)/this.fsd.height],
                [1/2, 1-(this.fsd.mainh + this.fsd.subh)/this.fsd.height, 0, 1-(this.fsd.mainh + this.fsd.subh)/this.fsd.height, 1/2, 1-(this.fsd.mainh + this.fsd.subh*2)/this.fsd.height, 0, 1-(this.fsd.mainh + this.fsd.subh*2)/this.fsd.height]
            ];
            switch(srcIdx){
                case 0:
                default:
                    this.sourceVideoOrder = [0,1,2,3];
                    this.renderedVideoOrderFour = [0,1,2,3];
                    break;
                case 1:
                    this.sourceVideoOrder = [1,0,2,3];
                    this.renderedVideoOrderFour =[1,0,2,3];
                    break;
                case 2:
                    this.sourceVideoOrder = [2,0,1,3];
                    this.renderedVideoOrderFour = [2,0,1,3];
                    break;
                case 3:
                    this.sourceVideoOrder = [3,0,1,2];
                    this.renderedVideoOrderFour = [3,0,1,2];
                    break;
            }
            break;
    }
    this.singleIndex = [2, 3, 0, 3, 1, 0];
    this.indices = [
        [2, 3, 0, 3, 1, 0,
            6, 7, 4, 7, 5, 4],
        [2, 3, 0, 3, 1, 0,
            6, 7, 4, 7, 5, 4,
            10, 11, 8, 11, 9, 8],
        [2, 3, 0, 3, 1, 0,
            6, 7, 4, 7, 5, 4,
            10, 11, 8, 11, 9, 8,
            14, 15, 12, 15, 13, 12]
    ];
    this.quadrantUv = [
        [1/2.0, 1, 0, 1, 1/2.0, 1/2.0, 0, 1/2.0],
        [1, 1, 1/2.0, 1, 1, 1/2.0, 1/2.0, 1/2.0],
        [1/2.0, 1/2.0, 0, 1/2.0, 1/2.0, 0, 0, 0],
        [1, 1/2.0, 1/2.0, 1/2.0, 1, 0, 1/2.0, 0]
      ];
    this.initGL();
};

H264WebGLPlayer.prototype.setBufferData = function (layout, selectedVideo) {
    if (!this.gl) {
        console.log("[ER] WebGL not supported.");
        return;
    }

    var gl = this.gl;
    let program = this.program;

    let vertices, indices, uvs;
    if (this.layout !== layout)
    {
        this.layout = layout;
        switch (this.layout){
            case layoutSingle:
                vertices = this.vertices[0];
                indices = this.singleIndex;
                break;
            case layoutQuadrant:
            case layoutUndefined:
                vertices = this.vertices[1];
                indices = this.indices[this.fsd.vnum-2];
                break;
            case layoutThreeMinor:
                vertices = this.vertices[2];
                indices = this.indices[this.fsd.vnum-2];
                break;
        }
        var vertexPositionAttribute = gl.getAttribLocation(program, "aVertexPosition");
        gl.enableVertexAttribArray(vertexPositionAttribute);

        var indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.DYNAMIC_DRAW);
        var verticesBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, verticesBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);
    }

    if (this.curAudioTrack !== selectedVideo){
        var ret = this.player.changeSrc(selectedVideo);
        if(ret >= 0)
            this.curAudioTrack = selectedVideo;
    }

    if (this.layout === layoutThreeMinor){
        switch (this.fsd.vnum){
            case 3:
                this.renderedVideoOrderThree = threeMinorVideoOrderThree[this.curAudioTrack];
                break;
            case 4:
                this.renderedVideoOrderFour = threeMinorVideoOrderFour[this.curAudioTrack];
                break;
        }
    } else {
        switch (this.fsd.vnum){
            case 3:
                this.renderedVideoOrderThree = quadrantVideoOrderThree;
                break;
            case 4:
                this.renderedVideoOrderFour = quadrantVideoOrderFour;
                break;
        }
    }

    this.uv = this.isUnifiedD1? this.quadrantUv : this.eachVidUv;
    switch (this.layout){
        case layoutSingle:
            uvs = this.uv[this.sourceVideoOrder.indexOf(this.curAudioTrack)];
            break;
        case layoutQuadrant:
            switch(this.fsd.vnum){
                case 2:
                    uvs = this.uv[this.sourceVideoOrder.indexOf(0)]
                        .concat(this.uv[this.sourceVideoOrder.indexOf(1)]);
                    break;
                case 3:
                    uvs = this.uv[this.sourceVideoOrder.indexOf(0)]
                        .concat(this.uv[this.sourceVideoOrder.indexOf(1)])
                        .concat(this.uv[this.sourceVideoOrder.indexOf(2)]);
                    break;
                case 4:
                default:
                    uvs = this.uv[this.sourceVideoOrder.indexOf(0)]
                        .concat(this.uv[this.sourceVideoOrder.indexOf(1)])
                        .concat(this.uv[this.sourceVideoOrder.indexOf(2)])
                        .concat(this.uv[this.sourceVideoOrder.indexOf(3)]);
                    break;
            }
            break;
        case layoutThreeMinor:
            switch (this.fsd.vnum){
                case 3:
                    uvs = this.uv[this.sourceVideoOrder.indexOf(threeMinorVideoOrderThree[this.curAudioTrack][0])]
                        .concat(this.uv[this.sourceVideoOrder.indexOf(threeMinorVideoOrderThree[this.curAudioTrack][1])])
                        .concat(this.uv[this.sourceVideoOrder.indexOf(threeMinorVideoOrderThree[this.curAudioTrack][2])]);
                    break;
                case 4:
                default:
                    uvs = this.uv[this.sourceVideoOrder.indexOf(threeMinorVideoOrderFour[this.curAudioTrack][0])]
                        .concat(this.uv[this.sourceVideoOrder.indexOf(threeMinorVideoOrderFour[this.curAudioTrack][1])])
                        .concat(this.uv[this.sourceVideoOrder.indexOf(threeMinorVideoOrderFour[this.curAudioTrack][2])])
                        .concat(this.uv[this.sourceVideoOrder.indexOf(threeMinorVideoOrderFour[this.curAudioTrack][3])]);
                    break;
            }
            break;
    }
    var textureCoordAttribute = gl.getAttribLocation(program, "aTextureCoord");
    gl.enableVertexAttribArray(textureCoordAttribute);

    var texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(textureCoordAttribute, 2, gl.FLOAT, false, 0, 0);
};

H264WebGLPlayer.prototype.initGL = function () {
    if (!this.gl) {
        console.log("[ER] WebGL not supported.");
        return;
    }

    var gl = this.gl;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    let program = gl.createProgram();
    this.program = program;
    var vertexShaderSource = [
        "attribute highp vec4 aVertexPosition;",
        "attribute vec2 aTextureCoord;",
        "varying highp vec2 vTextureCoord;",
        "void main(void) {",
        " gl_Position = aVertexPosition;",
        " vTextureCoord = aTextureCoord;",
        "}"
    ].join("\n");
    var vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    var fragmentShaderSource = [
        "varying lowp vec2 vTextureCoord;",
        "uniform sampler2D uSampler;",
        "void main(void)",
        "{",
            "gl_FragColor = texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y));",
        "}"
    ].join("\n");

    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    {
        alert("Unable to initialize the shader program: " + gl.getProgramInfoLog(program));
    }

    gl.useProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.log("[ER] Shader link failed.");
    }
    this.uniforms["uSampler"] = gl.getUniformLocation(program, "uSampler");
    gl.enableVertexAttribArray(this.attributes["uSampler"]);

    this.setBufferData(this.layout === layoutUndefined? (this.fsd.vnum === 2 ? layoutQuadrant : layoutThreeMinor) : this.layout, this.curAudioTrack);

    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
};

H264WebGLPlayer.prototype.newHqFrame = function (idx) {
    if(idx < 0){
        this.isUnifiedD1 = true;
        this.sourceVideoOrder = [0,1,2,3];
    }
    else if (idx < this.fsd.vnum)
    {
        this.isUnifiedD1 = false;
        switch (this.fsd.vnum)
        {
            case 2:
                this.sourceVideoOrder = videoOrderTwo[idx];
                break;
            case 3:
                this.sourceVideoOrder = threeMinorVideoOrderThree[idx];
                break;
            case 4:
                this.sourceVideoOrder = threeMinorVideoOrderFour[idx];
                break;
        }
    }
    this.setBufferData(this.layout, this.curAudioTrack);
};

H264WebGLPlayer.prototype.renderFrame = function (video) {
    if (!this.gl) {
        console.log("[ER] Render frame failed due to WebGL not supported.");
        return;
    }

    var gl = this.gl;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    //# next line fails in Safari if input video is NOT from same domain/server as this html code
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.useProgram(this.program);

    // Specify the texture to map onto the faces.
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.uniforms['uSampler'], 0);

    // Draw
    gl.drawElements(gl.TRIANGLES,this.layout === layoutSingle ? 6 :this.fsd.vnum*6, gl.UNSIGNED_SHORT, 0);
};

H264WebGLPlayer.prototype.fullscreen = function () {
    var videoPlayer = document.getElementById("videoPlayer");
    if (videoPlayer.requestFullscreen) {
        videoPlayer.requestFullscreen();
    } else if (videoPlayer.webkitRequestFullScreen) {
        videoPlayer.webkitRequestFullScreen();
    } else if (videoPlayer.mozRequestFullScreen) {
        videoPlayer.mozRequestFullScreen();
    } else if (videoPlayer.msRequestFullscreen) {
        videoPlayer.msRequestFullscreen();
    } else {
        alert("This browser doesn't support fullscreen");
    }
};

H264WebGLPlayer.prototype.exitfullscreen = function (){
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    } else {
        alert("Exit fullscreen doesn't work");
    }
};
