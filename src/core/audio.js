// src/core/audio.js
// 声音播放。两条通路：
//   web：标准 WebAudio（浏览器；抖音若提供 tt.createWebAudioContext 也走这里），PCM 直接播放，音乐用 AudioBufferSourceNode 循环；
//   tt  ：没有 WebAudio 的小游戏运行时，用 tt.createInnerAudioContext 播放 assets/ 下的 wav（由 tools/gen-audio.js 生成）。
//   none：都没有时静默，不影响游戏。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});

  var A = PR.audio = { mode: 'none', ctx: null, bufs: {}, bgmBufs: {}, src: null, bgmName: null, muted: false, pool: [], poolI: 0, bgmCtx: null, last: {} };

  A.init = function () {
    if (A.mode !== 'none') return A.mode;
    var ctx = null;
    try {
      var AC = typeof AudioContext !== 'undefined' ? AudioContext : (typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null);
      if (AC && typeof tt === 'undefined') ctx = new AC();                 // 抖音里优先用它自己的 WebAudio（如果提供）
      if (!ctx && typeof tt !== 'undefined' && typeof tt.createWebAudioContext === 'function') ctx = tt.createWebAudioContext();
      if (!ctx && AC) ctx = new AC();
    } catch (e) { ctx = null; }
    if (ctx && typeof ctx.createBuffer === 'function') {
      A.ctx = ctx;
      try {
        A.master = ctx.createGain(); A.master.gain.value = 0.9; A.master.connect(ctx.destination);
        A.bgmGain = ctx.createGain(); A.bgmGain.gain.value = 0.42; A.bgmGain.connect(A.master);
        var sfx = PR.synth.sfx, pcm;
        for (var k in sfx) { pcm = sfx[k](); A.bufs[k] = ctx.createBuffer(1, pcm.length, PR.synth.SR); A.bufs[k].getChannelData(0).set(pcm); }
        A.mode = 'web';
      } catch (e) { A.ctx = null; A.mode = 'none'; }
    }
    if (A.mode === 'none' && typeof tt !== 'undefined' && typeof tt.createInnerAudioContext === 'function') A.mode = 'tt';
    return A.mode;
  };

  A.setMuted = function (m) {
    A.muted = !!m;
    if (A.mode === 'web' && A.master) A.master.gain.value = A.muted ? 0 : 0.9;
    if (A.mode === 'tt') { for (var i = 0; i < A.pool.length; i++) A.pool[i].volume = A.muted ? 0 : 1; if (A.bgmCtx) A.bgmCtx.volume = A.muted ? 0 : 0.6; }
  };

  // 浏览器要求用户手势后才能出声；小游戏平台的 InnerAudioContext 也要求首次触摸后再 play
  A.unlock = function () {
    try {
      if (A.mode === 'web' && A.ctx) { if (A.ctx.state === 'suspended' && A.ctx.resume) A.ctx.resume(); }
      else if (A.mode === 'tt' && A.bgmName && !A.bgmOn) { A.bgmOn = true; var k = A.bgmName; A.bgmName = null; A.bgm(k); }
    } catch (e) {}
  };

  var VOLS = { bark: 0.5, land: 0.45, coin: 0.6, tick: 0.4, ui: 0.4 };
  // name：PR.synth.sfx 的键；rate：播放速率（连击音调用）
  A.play = function (name, rate) {
    if (A.mode === 'none' || A.muted) return;
    try {
      if (A.mode === 'web') {
        if (A.ctx.state === 'suspended') return;
        var buf = A.bufs[name];
        if (!buf) return;
        var s = A.ctx.createBufferSource(), gn = A.ctx.createGain();
        s.buffer = buf; s.playbackRate.value = rate || 1;
        gn.gain.value = VOLS[name] || 0.7;
        s.connect(gn); gn.connect(A.master);
        s.start();
      } else {
        if (!A.pool.length) for (var i = 0; i < 6; i++) { var ic = tt.createInnerAudioContext(); ic.obeyMuteSwitch = false; A.pool.push(ic); }
        var now = Date.now();
        if (A.last[name] && now - A.last[name] < 45) return;             // 同名音效限频
        A.last[name] = now;
        var c = A.pool[A.poolI++ % A.pool.length];
        c.volume = VOLS[name] || 0.7;
        c.src = 'assets/sfx/' + name + '.wav';
        c.play();
      }
    } catch (e) {}
  };

  // 背景音乐：kind ∈ road / calm / rush；传 null 停止
  A.bgm = function (kind) {
    if (A.bgmName === kind) return;
    A.bgmName = kind; A.bgmOn = false;
    try {
      if (A.mode === 'web') {
        if (A.src) { try { A.src.stop(); } catch (e) {} A.src = null; }
        if (!kind) return;
        if (!A.bgmBufs[kind]) {
          var pcm = PR.synth.bgm(kind);
          A.bgmBufs[kind] = A.ctx.createBuffer(1, pcm.length, 12000);
          A.bgmBufs[kind].getChannelData(0).set(pcm);
        }
        A.src = A.ctx.createBufferSource(); A.src.buffer = A.bgmBufs[kind]; A.src.loop = true;
        A.src.connect(A.bgmGain); A.src.start();
      } else if (A.mode === 'tt') {
        if (!A.bgmCtx) A.bgmCtx = tt.createInnerAudioContext();
        A.bgmCtx.loop = true; A.bgmCtx.volume = A.muted ? 0 : 0.6;
        if (!kind) { A.bgmCtx.stop(); return; }
        A.bgmCtx.src = 'assets/bgm/' + kind + '.wav';
        A.bgmCtx.play();
      }
    } catch (e) {}
  };

  A.bgmFor = function (ti) { return ti === 2 ? 'rush' : (ti === 3 || ti === 4 ? 'calm' : 'road'); };
})();
