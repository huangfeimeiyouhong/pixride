// src/core/audio.js
// 程序化音效：用 WebAudio 合成，无需素材文件。兼容浏览器与抖音小游戏。
// 首次用户交互后调用 unlock() 恢复被挂起的 AudioContext（自动播放策略）。
// 模块挂全局命名空间 PR。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});

  var ctx = null;
  var master = null;
  var enabled = true;

  function ensureCtx() {
    if (ctx) return ctx;
    var AC = null;
    try {
      AC = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext))
        || (typeof globalThis !== 'undefined' && (globalThis.AudioContext || globalThis.webkitAudioContext))
        || (typeof tt !== 'undefined' && tt.AudioContext);
    } catch (e) { AC = null; }
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { ctx = null; }
    if (ctx) {
      try { master = ctx.createGain(); master.gain.value = 0.25; master.connect(ctx.destination); } catch (e) {}
    }
    return ctx;
  }

  function unlock() {
    var c = ensureCtx();
    if (c && c.state === 'suspended') { try { c.resume(); } catch (e) {} }
  }

  // 单个合成音
  function tone(opts) {
    if (!enabled) return;
    var c = ensureCtx();
    if (!c) return;
    var t = c.currentTime;
    var dur = opts.dur || 0.1;
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = opts.type || 'square';
    var f0 = opts.freq || 440;
    var f1 = (opts.freqEnd != null) ? opts.freqEnd : f0;
    try {
      osc.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(opts.vol != null ? opts.vol : 0.3, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    } catch (e) {}
    osc.connect(gain);
    gain.connect(master || c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // 噪声 burst（用于撞击）
  function noise(dur, vol, filterFreq) {
    if (!enabled) return;
    var c = ensureCtx();
    if (!c) return;
    var t = c.currentTime;
    var bufSize = Math.floor(c.sampleRate * dur);
    var buf;
    try { buf = c.createBuffer(1, bufSize, c.sampleRate); } catch (e) { return; }
    var data = buf.getChannelData(0);
    for (var i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    var src = c.createBufferSource();
    src.buffer = buf;
    var gain = c.createGain();
    gain.gain.value = vol || 0.3;
    var filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master || c.destination);
    src.start(t);
    src.stop(t + dur);
  }

  var sfx = {
    jump: function () { tone({ type: 'square', freq: 420, freqEnd: 880, dur: 0.13, vol: 0.26 }); },
    // 金币：清脆双音
    coin: function () {
      tone({ type: 'square', freq: 1180, dur: 0.05, vol: 0.18 });
      setTimeout(function () { tone({ type: 'square', freq: 1570, dur: 0.08, vol: 0.16 }); }, 45);
    },
    // 拾取道具：上行琶音
    pickup: function () {
      tone({ type: 'triangle', freq: 660, dur: 0.07, vol: 0.2 });
      setTimeout(function () { tone({ type: 'triangle', freq: 990, dur: 0.09, vol: 0.2 }); }, 60);
    },
    // 挥棒：噪声下扫
    whoosh: function () {
      noise(0.14, 0.3, 2400);
      tone({ type: 'sawtooth', freq: 620, freqEnd: 180, dur: 0.14, vol: 0.18 });
    },
    // 狗被打中的惨叫
    yelp: function () {
      tone({ type: 'square', freq: 900, freqEnd: 300, dur: 0.18, vol: 0.24 });
      setTimeout(function () { tone({ type: 'square', freq: 700, freqEnd: 240, dur: 0.16, vol: 0.2 }); }, 80);
    },
    // 低吼 / 猛扑
    growl: function () {
      tone({ type: 'sawtooth', freq: 110, freqEnd: 70, dur: 0.3, vol: 0.22 });
      noise(0.2, 0.12, 500);
    },
    pedal: function () { tone({ type: 'triangle', freq: 180, freqEnd: 135, dur: 0.09, vol: 0.18 }); },
    hit: function () { noise(0.18, 0.4, 900); tone({ type: 'sawtooth', freq: 220, freqEnd: 70, dur: 0.2, vol: 0.24 }); },
    bark: function () { tone({ type: 'square', freq: 360, freqEnd: 150, dur: 0.09, vol: 0.3 }); },
    barks: function () {
      sfx.bark();
      setTimeout(function () { sfx.bark(); }, 110);
    },
    bite: function () {
      noise(0.22, 0.45, 1400);
      tone({ type: 'sawtooth', freq: 180, freqEnd: 50, dur: 0.25, vol: 0.28 });
      setTimeout(function () { tone({ type: 'square', freq: 720, freqEnd: 280, dur: 0.18, vol: 0.26 }); }, 60);
    },
    start: function () {
      tone({ type: 'square', freq: 523, dur: 0.1, vol: 0.26 });
      setTimeout(function () { tone({ type: 'square', freq: 784, dur: 0.14, vol: 0.26 }); }, 90);
    },
    win: function () {
      [523, 659, 784, 1047].forEach(function (f, i) {
        setTimeout(function () { tone({ type: 'square', freq: f, dur: 0.16, vol: 0.28 }); }, i * 120);
      });
    },
    lose: function () {
      [440, 349, 262].forEach(function (f, i) {
        setTimeout(function () { tone({ type: 'sawtooth', freq: f, dur: 0.22, vol: 0.26 }); }, i * 150);
      });
    }
  };

  PR.audio = {
    init: function () { ensureCtx(); },
    unlock: unlock,
    setEnabled: function (v) { enabled = !!v; },
    isEnabled: function () { return enabled; },
    play: function (name) { if (name && sfx[name]) sfx[name](); }
  };
})();
