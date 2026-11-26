// src/core/sys.js
// 平台抽象层：屏蔽抖音小游戏运行时（tt.*）与浏览器（document/localStorage）的差异。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});

  var hasTT = (typeof tt !== 'undefined') && !!tt;

  function createCanvas(w, h) {
    var c = null;
    if (hasTT && typeof tt.createCanvas === 'function') {
      c = tt.createCanvas();
    } else if (typeof document !== 'undefined' && document.createElement) {
      c = document.createElement('canvas');
    }
    if (!c) return null;
    c.width = w;
    c.height = h;
    return c;
  }

  function getItem(k) {
    try {
      if (hasTT && tt.getStorageSync) { var v = tt.getStorageSync(k); return v === '' ? null : v; }
      if (typeof localStorage !== 'undefined') return localStorage.getItem(k);
    } catch (e) {}
    return null;
  }

  function setItem(k, v) {
    try {
      if (hasTT && tt.setStorageSync) { tt.setStorageSync(k, v); return true; }
      if (typeof localStorage !== 'undefined') { localStorage.setItem(k, v); return true; }
    } catch (e) {}
    return false;
  }

  PR.sys = {
    isTT: hasTT,
    createCanvas: createCanvas,
    storage: { get: getItem, set: setItem }
  };
})();
