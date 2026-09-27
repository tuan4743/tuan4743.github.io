/* ============================================================
   GLSL 宿主:在离屏 WebGL 画布上跑 Shadertoy 风格的着色器
   ─────────────────────────────────────────────────────────────
   为什么需要它:用户提供的 train.glsl 是 Shadertoy 格式
     · 入口是 mainImage(out vec4, in vec2)
     · 依赖 iTime / iResolution / iChannel0(噪声图)
   这里补上前缀与纹理,再把结果 drawImage 到 2D 画布上
   (所以能和现有的 2D 动画管线共存)。
   ============================================================ */
(function () {
  "use strict";

  var VERT = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";

  var FRAG_HEAD = [
    "precision highp float;",
    /* Shadertoy 用 GLSL ES 3.0 的 texture();WebGL1 只有 texture2D() —— 一行宏补齐 */
    "#define texture texture2D",
    "uniform vec3 iResolution;",
    "uniform float iTime;",
    "uniform vec4 iMouse;",
    "uniform sampler2D iChannel0;",
    "uniform sampler2D iChannel1;",
    "uniform sampler2D iChannel2;",
    "uniform sampler2D iChannel3;",
    /* ★★★ 时间必须【两个名字都声明】。
       教训(用户第六轮贴了控制台):
         [boot-glsl] 编译失败 aurora: ERROR: 0:210: 'uTime' : undeclared identifier
       原因:这份头只声明了 iTime,而极光那份 GLSL 全程用的是 u_time/uTime
       (它原文件顶上有 `#define u_time iTime`,我照搬时按约定去掉了那行、
         把正文换成了 uTime —— 换名是对的,但我【没有在宿主里声明 uTime】)。
       于是着色器一编译就失败,而失败的后果是【极光整层不出现】:
       render() 返回 null,那一层就一直是空的 —— 用户看到的"极光没有"就是这个。
       ★ 为什么雪那一场没暴露这个问题:它正文里用的是 iTime,没碰 uTime。
       ★ 两个名字指向同一个值,host 在 render() 里两个都 set 一遍(见下面 uniform1f)。
       以后再加着色器:正文用哪个名字,这里就必须声明哪个 ——
       测试里有一条断言钉着"正文用到的每个时间名字,FRAG_HEAD 里都声明了"。 */
    "uniform float uTime;",
    ""
  ].join("\n");

  var FRAG_TAIL = [
    "",
    "void main(){",
    "  vec4 c = vec4(0.0);",
    "  mainImage(c, gl_FragCoord.xy);",
    "  gl_FragColor = c;",
    "}"
  ].join("\n");

  var gl = null, cv = null, prog = null, uni = {}, quad = null;
  var noiseTex = null;
  var cache = {};                       /* 已编译的着色器 */

  function init() {
    if (gl) return true;
    cv = document.createElement("canvas");
    var opts = { antialias: false, depth: false, stencil: false, alpha: true, preserveDrawingBuffer: true };
    gl = cv.getContext("webgl", opts) || cv.getContext("experimental-webgl", opts);
    if (!gl) return false;
    quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    /* 噪声图:iChannel0(着色器只用它的 .x 通道)*/
    var N = 1024;
    var data = new Uint8Array(N * N * 4);
    for (var i = 0; i < N * N; i++) {
      var v = (Math.random() * 256) | 0;
      data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
    }
    noiseTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, noiseTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return true;
  }

  function compile(name, src) {
    var fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, FRAG_HEAD + src + FRAG_TAIL);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.warn("[boot-glsl] 编译失败 " + name + ": " + gl.getShaderInfoLog(fs).slice(0, 300));
      return null;
    }
    var vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, VERT);
    gl.compileShader(vs);
    var pr = gl.createProgram();
    gl.attachShader(pr, vs);
    gl.attachShader(pr, fs);
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) {
      console.warn("[boot-glsl] 链接失败: " + gl.getProgramInfoLog(pr).slice(0, 200));
      return null;
    }
    var u = {
      res: gl.getUniformLocation(pr, "iResolution"),
      time: gl.getUniformLocation(pr, "iTime"),
      utime: gl.getUniformLocation(pr, "uTime"),
      mouse: gl.getUniformLocation(pr, "iMouse"),
      ch0: gl.getUniformLocation(pr, "iChannel0"),
      cloud: gl.getUniformLocation(pr, "uCloud"),
      hue: gl.getUniformLocation(pr, "uHue"),
      dark: gl.getUniformLocation(pr, "uDark"),
      speed: gl.getUniformLocation(pr, "uSpeed"),
      scale: gl.getUniformLocation(pr, "uScale"),
      grow: gl.getUniformLocation(pr, "uGrow"),
      bias: gl.getUniformLocation(pr, "uBias"),
      sun: gl.getUniformLocation(pr, "uSun")
    };
    return { pr: pr, u: u };
  }

  var srcCache = {};
  function loadSource(url) {
    if (srcCache[url]) return Promise.resolve(srcCache[url]);
    return fetch(url)   /* 网址已带指纹,按默认缓存即可;force-cache 会拿到旧版本 */
      .then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); })
      .then(function (t) { srcCache[url] = t; return t; });
  }

  /* 对外:预加载某个着色器 */
  function preload(name, url) { return loadSource(url).then(function (t) { cache[name] = t; return true; }).catch(function () { return false; }); }

  /* 对外:渲染一帧;返回离屏 WebGL 画布(可直接 drawImage)*/
  function render(name, url, time, w, h, params) {
    if (!init()) return null;
    if (!cache[name]) return null;                 /* 还没加载好就先跳过这一帧 */
    if (!prog || prog._name !== name) {
      var got = compile(name, cache[name]);
      if (!got) { cache[name] = ""; return null; }
      got._name = name;
      prog = got;
    }
    w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog.pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    var loc = gl.getAttribLocation(prog.pr, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    if (prog.u.res) gl.uniform3f(prog.u.res, w, h, 1);
    if (prog.u.time) gl.uniform1f(prog.u.time, time);
    /* ★ 两个时间名字都要喂:不同着色器用的名字不一样(雪用 iTime,极光用 uTime)。
       少喂一个,那个 uniform 就是 0 —— 着色器不会报错,但画面是静止的/错的。 */
    if (prog.u.utime) gl.uniform1f(prog.u.utime, time);
    if (prog.u.mouse) gl.uniform4f(prog.u.mouse, 0, 0, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, noiseTex);
    if (prog.u.ch0) gl.uniform1i(prog.u.ch0, 0);
    var p = params || {};
    if (prog.u.cloud) gl.uniform1f(prog.u.cloud, p.cloud == null ? 1.6 : p.cloud);
    if (prog.u.hue) gl.uniform1f(prog.u.hue, p.hue == null ? 3.7 : p.hue);
    if (prog.u.dark) gl.uniform1f(prog.u.dark, p.dark == null ? 0.85 : p.dark);
    /* 雪(snow.glsl)用的四个:没传就用范例的手感 */
    if (prog.u.speed) gl.uniform1f(prog.u.speed, p.speed == null ? 1 : p.speed);
    if (prog.u.scale) gl.uniform1f(prog.u.scale, p.scale == null ? 1 : p.scale);
    if (prog.u.grow) gl.uniform1f(prog.u.grow, p.grow == null ? 1 : p.grow);
    if (prog.u.bias) gl.uniform1f(prog.u.bias, p.bias == null ? 1 : p.bias);
    if (prog.u.sun) gl.uniform1f(prog.u.sun, p.sun == null ? 1 : p.sun);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return cv;
  }

  window.CDBootGlsl = { preload: preload, render: render, ok: function () { return init(); } };
})();
