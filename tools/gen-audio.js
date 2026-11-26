#!/usr/bin/env node
// 生成抖音小游戏降级播放用的音频文件（运行时没有 WebAudio 时，用 InnerAudioContext 播这些 wav）。
// 用法：node tools/gen-audio.js      → assets/sfx/*.wav、assets/bgm/*.wav
// 音效与背景音乐都由 src/core/synth.js 同一份合成器生成，三端听感一致。
var fs = require('fs');
var path = require('path');
require('../src/core/sys.js');
require('../src/core/synth.js');
var root = path.join(__dirname, '..');
var sfxDir = path.join(root, 'assets', 'sfx'), bgmDir = path.join(root, 'assets', 'bgm');
fs.mkdirSync(sfxDir, { recursive: true });
fs.mkdirSync(bgmDir, { recursive: true });
var total = 0, n = 0;
Object.keys(PR.synth.sfx).forEach(function (name) {
  var pcm = PR.synth.sfx[name]();
  var buf = Buffer.from(PR.synth.toWav(pcm, PR.synth.SR));
  fs.writeFileSync(path.join(sfxDir, name + '.wav'), buf);
  total += buf.length; n++;
});
['road', 'calm', 'rush'].forEach(function (kind) {
  var buf = Buffer.from(PR.synth.toWav(PR.synth.bgm(kind, 12000), 12000));
  fs.writeFileSync(path.join(bgmDir, kind + '.wav'), buf);
  total += buf.length; n++;
});
console.log('generated ' + n + ' files, ' + (total / 1024).toFixed(0) + ' KB');
