// src/entities/obstacle.js
// 障碍物：石头 / 倒木（跳过去）、低垂树枝（别跳，低头过）、坑洞 / 水洼 / 冰面 / 雪堆（路面陷阱）。
// hw = 半宽（碰撞），h = 高度；solid 有体积，low = 空中才会撞到，flat = 贴在路面上。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});
  var draw = PR.gfx.draw;

  var DEF = PR.OBDEF = {
    rock:    { hw: 12, h: 16, solid: true },
    log:     { hw: 20, h: 18, solid: true },
    branch:  { hw: 60, low: true },
    pothole: { hw: 15, flat: true },
    puddle:  { hw: 20, flat: true },
    ice:     { hw: 29, flat: true },
    drift:   { hw: 24, flat: true }
  };

  function Obstacle(game, type, x, v) {
    this.g = game; this.type = type; this.x = x; this.def = DEF[type];
    var p = PR.sprites.props;
    this.sp = type === 'rock' ? p.rock[v & 3] : p[type];
    this.hit = false; this.broken = false; this.passed = false;
    this.t = v * 1.37; this.sway = 0; this.dogDone = false;
  }
  var O = Obstacle.prototype;
  O.update = function (dt) { this.t += dt; if (this.sway > 0) this.sway -= dt; };
  O.groundY = function () { return this.g.G - this.g.terrain.h(this.x); };

  // layer 0：贴在路面上的（坑 / 水洼 / 冰 / 雪堆）；layer 1：有体积的（石头 / 倒木 / 树枝）
  O.draw = function (ctx, camX, shy, layer) {
    var flat = !!this.def.flat;
    if ((layer === 0) !== flat || this.broken) return;
    var gy = this.groundY() + shy, x = this.x - camX, t = this.t;
    if (this.type === 'puddle') {
      draw(ctx, this.sp, x, gy + 7);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect((x - 12 + ((t * 14) % 30)) | 0, (gy + 3) | 0, 5, 1);
      ctx.fillRect((x + 2 + ((t * 9) % 16)) | 0, (gy + 5) | 0, 4, 1);
    } else if (this.type === 'ice') {
      draw(ctx, this.sp, x, gy + 8);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      var k = Math.floor(t * 2) % 3;
      ctx.fillRect((x - 20 + k * 18) | 0, (gy + 3) | 0, 6, 1);
      ctx.fillRect((x - 8 + k * 9) | 0, (gy + 6) | 0, 4, 1);
    } else if (this.type === 'pothole') {
      draw(ctx, this.sp, x, gy + 6);
    } else if (this.type === 'drift') {
      draw(ctx, this.sp, x, gy + 3);
    } else if (this.type === 'branch') {
      var sw = this.sway > 0 ? Math.sin(this.sway * 26) * this.sway * 5 : 0;      // 被撞后摇晃
      draw(ctx, this.sp, x + sw, gy - 12);
    } else {
      draw(ctx, this.sp, x, gy + 2);
    }
  };

  PR.Obstacle = Obstacle;
})();
