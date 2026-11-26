// src/game/save.js
// 存档：行程进度、金币、升级、各日星级、各项纪录。抖音用 tt.get/setStorageSync，浏览器用 localStorage。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});

  var KEY = 'pr_journey_v2';
  function defaults() {
    return {
      v: 2, day: 0, coins: 0,
      up: { stamina: 0, regen: 0, pedal: 0, light: 0 },
      stars: [0, 0, 0, 0, 0, 0],
      best: { score: 0, dist: 0, combo: 0, endless: 0 },
      done: false,               // 是否已抵达拉萨（解锁无尽模式）
      tut: 0,                    // 已看过的教学提示位掩码
      sound: 1
    };
  }
  function merge(dst, src) {
    if (!src || typeof src !== 'object') return dst;
    for (var k in src) {
      if (k === 'v') continue;
      if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && dst[k]) merge(dst[k], src[k]);
      else dst[k] = src[k];
    }
    return dst;
  }

  var save = PR.save = {
    data: defaults(),
    load: function () {
      var raw = null;
      try { raw = PR.sys.storage.get(KEY); } catch (e) { raw = null; }
      var d = defaults();
      if (raw) {
        try {
          var obj = (typeof raw === 'string') ? JSON.parse(raw) : raw;
          merge(d, obj);
        } catch (e) {}
      }
      // 合法性兜底
      d.day = Math.max(0, Math.min(5, d.day | 0)); d.coins = Math.max(0, d.coins | 0);
      if (!d.stars || d.stars.length !== 6) d.stars = [0, 0, 0, 0, 0, 0];
      for (var i = 0; i < 6; i++) d.stars[i] = Math.max(0, Math.min(3, d.stars[i] | 0));
      for (var k in d.up) d.up[k] = Math.max(0, Math.min(5, d.up[k] | 0));
      this.data = d;
      return d;
    },
    write: function () {
      try { PR.sys.storage.set(KEY, JSON.stringify(this.data)); } catch (e) {}
    },
    reset: function () { this.data = defaults(); this.write(); }
  };
})();
