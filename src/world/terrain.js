// src/world/terrain.js
// 地形：分段余弦插值的高低起伏路面。h(x) 为路面高度（正 = 高于基准线），slope(x) 为坡度。
// 全部由种子确定，任意位置可重复计算；营地前后强制平坦。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});
  var STEP = 240;            // 控制点间距
  var AMP = 26;              // 相邻控制点最大高差

  function Terrain(seed) {
    this.seed = seed | 0;
    this.r = PR.gfx.rng(this.seed * 7919 + 13);
    this.keys = [0];
    this.flats = [];         // [起点, 终点] 列表
  }

  Terrain.prototype.inFlat = function (x) {
    for (var i = 0; i < this.flats.length; i++) if (x >= this.flats[i][0] && x < this.flats[i][1]) return true;
    return false;
  };
  Terrain.prototype.addFlat = function (a, b) { this.flats.push([a, b]); };

  // 顺序生成控制点高度（随机游走 + 平坦区）
  Terrain.prototype.ensure = function (i) {
    var k = this.keys, j, x, prev, d;
    for (j = k.length; j <= i; j++) {
      x = j * STEP;
      prev = k[j - 1];
      if (x < 420 || this.inFlat(x) || this.inFlat(x - STEP)) k.push(0);
      else if (this.inFlat(x + STEP)) k.push(prev * 0.5);
      else {
        d = (this.r() - 0.5) * AMP;
        if (this.r() < 0.3) d = 0;
        var v = prev + d;
        k.push(v < -20 ? -20 : (v > 24 ? 24 : v));
      }
    }
  };

  Terrain.prototype.h = function (x) {
    if (x < 0) x = 0;
    var i = Math.floor(x / STEP), t = x - i * STEP;
    this.ensure(i + 1);
    var a = this.keys[i], b = this.keys[i + 1];
    return a + (b - a) * (1 - Math.cos(Math.PI * t / STEP)) * 0.5 + Math.sin(x * 0.09) * 0.7;
  };
  Terrain.prototype.slope = function (x) {
    if (x < 0) x = 0;
    var i = Math.floor(x / STEP), t = x - i * STEP;
    this.ensure(i + 1);
    return (this.keys[i + 1] - this.keys[i]) * Math.PI * Math.sin(Math.PI * t / STEP) / (2 * STEP);
  };

  PR.Terrain = Terrain;
  PR.TERRAIN_STEP = STEP;
})();
