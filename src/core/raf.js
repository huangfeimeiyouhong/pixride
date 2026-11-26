// src/core/raf.js
// requestAnimationFrame 兼容层（浏览器 / 抖音小游戏 runtime）。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});

  if (typeof g.requestAnimationFrame === 'function') {
    PR.raf = function (cb) { return g.requestAnimationFrame(cb); };
  } else {
    PR.raf = function (cb) {
      return g.setTimeout(function () { cb(g.performance ? g.performance.now() : Date.now()); }, 16);
    };
  }
})();
