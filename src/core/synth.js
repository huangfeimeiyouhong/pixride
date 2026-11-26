// src/core/synth.js
// 芯片音乐合成器：把音效 / 背景音乐渲染成 PCM（Float32Array 单声道）。浏览器、抖音、Node 三端通用。
// 同一份 PCM 有两种播放方式：WebAudio 直接播；或由 tools/gen-audio.js 导出 wav 给 InnerAudioContext 播。
(function () {
  var root = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = root.PR || (root.PR = {});

  var SR = 22050, seed = 22222;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x40000000 - 1; }
  var WAVE = {
    sq: function (p) { return (p % 1) < 0.5 ? 1 : -1; },
    pulse: function (p) { return (p % 1) < 0.25 ? 1 : -1; },
    tri: function (p) { p = p % 1; return p < 0.5 ? p * 4 - 1 : 3 - p * 4; },
    saw: function (p) { return 2 * (p % 1) - 1; },
    sine: function (p) { return Math.sin(6.283185307 * p); }
  };
  // 单音：频率从 f0 指数滑到 f1；o: a 起音秒, dec 衰减指数, sus 延音点, am [频率, 深度] 颤音
  function tone(type, f0, f1, dur, vol, o) {
    o = o || {};
    var n = Math.round(dur * SR), d = new Float32Array(n), ph = 0, f, w = WAVE[type] || WAVE.sq, i, t, env;
    for (i = 0; i < n; i++) {
      t = i / n; f = f0 * Math.pow(f1 / f0, t); ph += f / SR;
      env = Math.min(1, (i / SR) / (o.a || 0.004)) * (o.flat ? 1 : Math.pow(1 - t, o.dec == null ? 1.6 : o.dec));
      if (o.sus != null) env = Math.min(1, (i / SR) / (o.a || 0.004)) * (t < o.sus ? 1 : (1 - t) / (1 - o.sus));
      if (o.am) env *= 1 - o.am[1] * (0.5 + 0.5 * Math.sin(6.283185307 * o.am[0] * i / SR));
      d[i] = w(ph) * env * vol;
    }
    return d;
  }
  // 噪声 + 一阶低通，截止频率从 lp 滑到 lp2
  function noise(dur, vol, lp, lp2) {
    var n = Math.round(dur * SR), d = new Float32Array(n), y = 0, t, fc, k;
    for (var i = 0; i < n; i++) {
      t = i / n; fc = lp * Math.pow((lp2 || lp) / lp, t); k = 1 - Math.exp(-6.283185307 * fc / SR);
      y += k * (rnd() - y);
      d[i] = y * vol * Math.pow(1 - t, 1.3);
    }
    return d;
  }
  // 叠加：每个参数是 [片段, 起始秒]
  // 参数写法宽松：片段 / [片段] / [片段, 起始秒]；也可以在片段后面单独跟一个数字作为起始秒
  function mix() {
    var parts = [], i, j, p;
    for (i = 0; i < arguments.length; i++) {
      p = arguments[i];
      if (typeof p === 'number') { if (parts.length) parts[parts.length - 1].o = p; continue; }
      if (p && p.buffer) parts.push({ b: p, o: 0 });
      else if (p && p[0] && p[0].buffer) parts.push({ b: p[0], o: p[1] || 0 });
    }
    var n = 0;
    for (i = 0; i < parts.length; i++) parts[i].o = Math.round(parts[i].o * SR), n = Math.max(n, parts[i].o + parts[i].b.length);
    var d = new Float32Array(n);
    for (i = 0; i < parts.length; i++) for (j = 0; j < parts[i].b.length; j++) d[parts[i].o + j] += parts[i].b[j];
    return d;
  }
  function arp(notes, step, dur, type, vol) {
    var parts = [], i;
    for (i = 0; i < notes.length; i++) parts.push([tone(type, notes[i], notes[i], i === notes.length - 1 ? dur * 3 : dur, vol), i * step]);
    return mix.apply(null, parts);
  }

  PR.synth = {
    SR: SR, tone: tone, noise: noise, mix: mix, WAVE: WAVE,
    sfx: {
      jump: function () { return mix([tone('sq', 300, 640, 0.14, 0.32)], [noise(0.04, 0.1, 2600), 0]); },
      land: function () { return mix([noise(0.08, 0.4, 900, 300)], [tone('tri', 150, 70, 0.08, 0.4)]); },
      coin: function () { return mix([tone('sq', 1175, 1175, 0.06, 0.24)], [tone('sq', 1760, 1760, 0.14, 0.22)], 0.05); },
      tick: function () { return tone('sq', 1320, 1320, 0.05, 0.2); },
      pickup: function () { return arp([659, 784, 988, 1319], 0.06, 0.1, 'tri', 0.3); },
      crash: function () { return mix([noise(0.26, 0.75, 1600, 240)], [tone('saw', 190, 44, 0.24, 0.4)]); },
      smash: function () { return mix([noise(0.16, 0.6, 3000, 600)], [tone('sq', 320, 80, 0.14, 0.35)]); },
      bark: function () {
        return mix([tone('sq', 430, 170, 0.08, 0.4, { am: [60, 0.7] })], [noise(0.08, 0.22, 2200, 800)],
          [tone('sq', 400, 150, 0.09, 0.38, { am: [55, 0.7] }), 0.11], [noise(0.09, 0.22, 2000, 700), 0.11]);
      },
      growl: function () {
        return mix([tone('saw', 96, 62, 0.42, 0.3, { am: [26, 0.6], sus: 0.5 })], [tone('saw', 143, 93, 0.42, 0.2, { am: [31, 0.6], sus: 0.5 })], [noise(0.42, 0.14, 520, 380)]);
      },
      pounce: function () { return mix([noise(0.2, 0.45, 500, 3200)], [tone('sine', 260, 110, 0.2, 0.3)]); },
      whiff: function () { return mix([noise(0.2, 0.4, 2600, 500)], [tone('sine', 700, 1400, 0.18, 0.12)]); },
      splash: function () { return mix([noise(0.28, 0.5, 1900, 400)], [tone('sine', 320, 150, 0.1, 0.18)]); },
      slip: function () { return noise(0.34, 0.32, 4200, 1800); },
      snow: function () { return mix([noise(0.22, 0.5, 1200, 400)], [tone('tri', 180, 90, 0.14, 0.3)]); },
      stick: function () { return mix([noise(0.13, 0.35, 900, 4200)], [tone('tri', 540, 300, 0.12, 0.2)]); },
      yelp: function () { return mix([tone('sq', 900, 300, 0.16, 0.36)], [tone('sq', 760, 230, 0.16, 0.3)], 0.1); },
      shield: function () { return mix([tone('tri', 880, 1320, 0.2, 0.4)], [tone('sq', 1760, 1760, 0.1, 0.1)], 0.02); },
      boost: function () { return mix([tone('saw', 220, 990, 0.4, 0.3, { sus: 0.6 })], [tone('sq', 440, 1980, 0.4, 0.1, { sus: 0.6 })]); },
      magnet: function () { return mix([tone('tri', 700, 700, 0.36, 0.3, { am: [18, 0.8], sus: 0.6 })], [tone('sq', 1046, 1046, 0.36, 0.08, { am: [18, 0.8], sus: 0.6 })]); },
      exhaust: function () { return mix([tone('saw', 420, 140, 0.36, 0.26, { sus: 0.5 })], [noise(0.36, 0.14, 800, 300)]); },
      ui: function () { return tone('sq', 880, 880, 0.035, 0.25); },
      buy: function () { return mix([tone('sq', 988, 988, 0.07, 0.25)], [tone('sq', 1319, 1319, 0.16, 0.25)], 0.07); },
      deny: function () { return tone('sq', 220, 180, 0.12, 0.25); },
      start: function () { return mix([tone('sq', 523, 523, 0.09, 0.3)], [tone('sq', 784, 784, 0.16, 0.3)], 0.09); },
      win: function () {
        var parts = [523, 659, 784, 1047, 1319, 1568].map(function (n, i) { return [tone('sq', n, n, i === 5 ? 0.5 : 0.12, 0.26), i * 0.1]; });
        parts.push([tone('tri', 2093, 2093, 0.5, 0.1), 0.5]);
        return mix.apply(null, parts);
      },
      lose: function () {
        return mix.apply(null, [440, 349, 262, 196].map(function (n, i) { return [tone('saw', n, n * 0.94, i === 3 ? 0.55 : 0.22, 0.3), i * 0.19]; }));
      },
      camp: function () { return arp([392, 523, 659, 784], 0.13, 0.26, 'tri', 0.3); },
      cheer: function () { return arp([784, 1047, 1319], 0.08, 0.18, 'sq', 0.2); }
    },
    // 背景音乐：8 小节循环。kind: road（明亮）/ calm（舒缓）/ rush（急促）
    bgm: function (kind, sr) {
      var B = sr || 12000, bpm = kind === 'calm' ? 92 : (kind === 'rush' ? 138 : 118), beat = 60 / bpm, bars = 8;
      var n = Math.round(bars * 4 * beat * B), d = new Float32Array(n), rs = kind === 'calm' ? 7 : (kind === 'rush' ? 13 : 3), b, k, i;
      function rb() { rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; return (rs >>> 0) / 4294967296; }
      function midi(m) { return 440 * Math.pow(2, (m - 69) / 12); }
      function put(t0, dur, fn, vol) {
        var i0 = Math.round(t0 * B), nn = Math.round(dur * B);
        if (i0 + nn > n) nn = n - i0;
        for (var j = 0; j < nn; j++) d[i0 + j] += fn(j / B, j / nn) * vol;
      }
      function note(t0, dur, f, type, vol, rel) {
        var ph = 0;
        put(t0, dur, function (t, u) { ph += f / B; return WAVE[type](ph) * Math.min(1, t / 0.004) * (rel ? Math.pow(1 - u, rel) : 1); }, vol);
      }
      var kick = (function () { var ph = 0; return function (t) { ph += (45 + 65 * Math.exp(-t / 0.018)) / B; return Math.sin(6.283185307 * ph) * Math.exp(-t / 0.05); }; })();
      var hat = (function () { var y = 0; return function (t) { y += 0.9 * (rb() - y); return y * Math.exp(-t / 0.008); }; })();
      var snr = (function () { var y = 0; return function (t) { y += 0.6 * (rb() - y); return y * Math.exp(-t / 0.03); }; })();
      var prog = kind === 'calm' ? [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]] : [[48, 52, 55], [55, 59, 62], [57, 60, 64], [53, 57, 60]];
      var scale = kind === 'calm' ? [57, 60, 62, 64, 67, 69, 72, 74, 76, 79] : [60, 62, 64, 67, 69, 72, 74, 76, 79, 81];
      var mel = [];
      for (b = 0; b < bars; b++) {
        var ch = prog[b % 4], pool = ch.concat(scale);
        for (k = 0; k < 4; k++) {
          var tb = (b * 4 + k) * beat;
          if (k % 2 === 0) note(tb, beat * 0.9, midi(ch[0] - 24), 'tri', 0.5, 1.2);
          else if (rb() < 0.55) note(tb, beat * 0.42, midi(ch[0] - 24 + (rb() < 0.5 ? 0 : 7)), 'tri', 0.34, 1.2);
          put(tb, 0.07, kick, 0.55);
          put(tb + beat / 2, 0.03, hat, kind === 'calm' ? 0.04 : 0.1);
          if (kind !== 'calm' && k % 2 === 1) put(tb, 0.09, snr, 0.2);
          if (kind === 'rush') put(tb + beat * 0.75, 0.025, hat, 0.07);
        }
        for (k = 0; k < 3; k++) note(b * 4 * beat, 4 * beat, midi(ch[k]), 'tri', 0.06, 0);
        for (k = 0; k < 8; k++) {
          if (kind === 'calm') { if (k % 2 === 1 || rb() < 0.35) continue; }
          else if (rb() < 0.2) continue;
          mel.push([b * 4 * beat + k * beat / 2, pool[(rb() * pool.length) | 0] + 12, (k < 6 && rb() < 0.18) ? 2 : 1]);
        }
      }
      for (i = 0; i < mel.length; i++) note(mel[i][0], beat / 2 * mel[i][2] * 0.92, midi(mel[i][1]), kind === 'calm' ? 'tri' : 'pulse', kind === 'calm' ? 0.2 : 0.12, 0.7);
      var peak = 0;
      for (i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i]));
      if (peak > 0) for (i = 0; i < n; i++) d[i] *= 0.8 / peak;
      return d;
    },
    // PCM → 16bit WAV
    toWav: function (samples, sr) {
      var n = samples.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf), i;
      function str(o, s) { for (var j = 0; j < s.length; j++) v.setUint8(o + j, s.charCodeAt(j)); }
      str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
      v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true);
      v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
      for (i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 32767, true);
      return buf;
    }
  };
})();
