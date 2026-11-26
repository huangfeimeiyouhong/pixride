// src/game/particles.js
// 粒子系统：对象池 + 图集精灵。世界坐标 x（随镜头滚动）+ 屏幕坐标 y；drawScaled 缩放绘制。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});
  var drawScaled = PR.gfx.drawScaled;

  var MAX = 220;
  function Particles(game) {
    this.g = game;
    this.r = PR.gfx.rng(4242);
    this.p = [];
    for (var i = 0; i < MAX; i++) this.p.push({ live: false });
  }
  var Pt = Particles.prototype;

  Pt.add = function (o) {
    var q = null, i;
    for (i = 0; i < MAX; i++) if (!this.p[i].live) { q = this.p[i]; break; }
    if (!q) q = this.p[(this.r() * MAX) | 0];
    q.live = true; q.t = 0; q.x = o.x; q.y = o.y; q.vx = o.vx || 0; q.vy = o.vy || 0; q.life = o.life || 0.5;
    q.grav = o.grav || 0; q.drag = o.drag || 0; q.fr = o.fr || null; q.fps = o.fps || 12;
    q.s = o.s || 1; q.s1 = o.s1 == null ? q.s : o.s1; q.a = o.a == null ? 1 : o.a; q.col = o.col || null;
    q.w = o.w || 2; q.h = o.h || 2; q.world = o.world !== false; q.wind = o.wind || 0; q.delay = o.delay || 0;
    return q;
  };

  Pt.update = function (dt) {
    for (var i = 0; i < MAX; i++) {
      var q = this.p[i];
      if (!q.live) continue;
      if (q.delay > 0) { q.delay -= dt; continue; }
      q.t += dt;
      if (q.t >= q.life) { q.live = false; continue; }
      q.vy += q.grav * dt;
      if (q.drag) { var k = Math.max(0, 1 - q.drag * dt); q.vx *= k; q.vy *= k; }
      q.vx += q.wind * dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
    }
  };

  Pt.draw = function (ctx, camX) {
    for (var i = 0; i < MAX; i++) {
      var q = this.p[i];
      if (!q.live || q.delay > 0) continue;
      var u = q.t / q.life, a = q.a * (u > 0.6 ? (1 - u) / 0.4 : 1);
      if (a <= 0.02) continue;
      var x = q.x - (q.world ? camX : 0);
      if (x < -40 || x > this.g.bw + 40) continue;
      if (q.fr) {
        var sp = q.fr[((q.t * q.fps) | 0) % q.fr.length];
        drawScaled(ctx, sp, x, q.y, q.s + (q.s1 - q.s) * u, q.s + (q.s1 - q.s) * u, a);
      } else if (q.col) {
        ctx.globalAlpha = a; ctx.fillStyle = q.col;
        ctx.fillRect(x | 0, q.y | 0, q.w, q.h);
        ctx.globalAlpha = 1;
      }
    }
  };

  Pt.clear = function () { for (var i = 0; i < MAX; i++) this.p[i].live = false; };

  // ---------------- 发射器 ----------------
  var CONFETTI = ['#ffcf3f', '#ff5a5a', '#5fd35f', '#6cc6ff', '#ff9f43', '#ffffff', '#ff9fc0'];
  Pt.dust = function (x, y, n, dir) {
    var r = this.r, pr = PR.sprites.props;
    for (var i = 0; i < n; i++) this.add({ x: x + r.range(-5, 5), y: y - r.range(0, 3), vx: -(dir || 1) * r.range(12, 55), vy: -r.range(5, 32),
      life: r.range(0.28, 0.55), fr: pr.puff, fps: 10, s: r.range(0.22, 0.4), s1: r.range(0.55, 0.95), drag: 4, a: 0.7 });
  };
  Pt.poof = function (x, y, n) {            // 雪粉 / 水花式的白色团
    var r = this.r, pr = PR.sprites.props;
    for (var i = 0; i < n; i++) this.add({ x: x + r.range(-6, 6), y: y - r.range(0, 4), vx: r.range(-50, 50), vy: -r.range(30, 110),
      life: r.range(0.3, 0.6), fr: pr.puff, fps: 10, s: r.range(0.2, 0.35), s1: r.range(0.5, 0.8), grav: 240, drag: 2, a: 0.9 });
  };
  Pt.spark = function (x, y, n) {
    var r = this.r, pr = PR.sprites.props;
    for (var i = 0; i < n; i++) this.add({ x: x, y: y, vx: r.range(-140, 110), vy: -r.range(60, 230), life: r.range(0.25, 0.5), fr: pr.spark, fps: 20,
      grav: 620, s: 1, a: 1 });
  };
  Pt.splash = function (x, y, n, col) {
    var r = this.r;
    for (var i = 0; i < n; i++) this.add({ x: x + r.range(-8, 8), y: y, vx: r.range(-60, 90), vy: -r.range(60, 220), life: r.range(0.25, 0.55),
      grav: 760, col: col || '#bfe4ff', w: 2, h: 2 });
  };
  Pt.ring = function (x, y, s1) {
    this.add({ x: x, y: y, life: 0.36, fr: [PR.sprites.props.ring], fps: 1, s: 0.3, s1: s1 || 1.6, a: 0.9 });
  };
  Pt.stars = function (x, y, n) {
    var r = this.r, pr = PR.sprites.props;
    for (var i = 0; i < n; i++) this.add({ x: x + r.range(-6, 6), y: y + r.range(-8, 8), vx: r.range(-40, 40), vy: -r.range(40, 120),
      life: r.range(0.3, 0.6), fr: pr.star, fps: 10, grav: 160, s: 0.6, s1: 1, a: 1, delay: r.range(0, 0.08) });
  };
  Pt.confetti = function (x, y, n) {
    var r = this.r;
    for (var i = 0; i < n; i++) this.add({ x: x + r.range(-20, 20), y: y, vx: r.range(-130, 130), vy: -r.range(140, 320), life: r.range(0.9, 1.6),
      grav: 420, drag: 0.6, col: CONFETTI[i % CONFETTI.length], w: r() < 0.5 ? 2 : 3, h: 2, wind: r.range(-30, 30) });
  };
  Pt.leaves = function (x, y, n, fr) {
    var r = this.r, f = fr || PR.sprites.props.leaf;
    for (var i = 0; i < n; i++) this.add({ x: x + r.range(-14, 14), y: y + r.range(-4, 4), vx: r.range(-50, 30) - this.g.player.v * 0.35, vy: -r.range(20, 60),
      life: r.range(0.8, 1.4), fr: f, fps: 6, grav: 130, drag: 1.2, wind: 16, s: 1, a: 1 });
  };
  Pt.sparkle = function (x, y) {            // 金币被吸过来时的小星
    this.add({ x: x, y: y, life: 0.3, fr: PR.sprites.props.star, fps: 14, s: 0.5, s1: 0.2, a: 0.9 });
  };

  PR.Particles = Particles;
})();
