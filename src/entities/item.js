// src/entities/item.js
// 道具：金币（6 帧旋转）/ 水壶（体力）/ 木棍（引开野狗）/ 磁铁（吸金币）/ 能量胶（冲刺）/ 护盾（抵挡一次）。
// z = 离地高度。磁铁生效时，附近的道具会飞向骑行者。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});
  var draw = PR.gfx.draw, drawScaled = PR.gfx.drawScaled;

  var INFO = PR.ITEMS = {
    coin:   { name: '金币' },
    drink:  { name: '水壶', tip: '体力 +35' },
    stick:  { name: '木棍', tip: '引开野狗' },
    magnet: { name: '磁铁', tip: '自动吸金币' },
    gel:    { name: '能量胶', tip: '冲刺 + 撞飞' },
    shield: { name: '护盾', tip: '抵挡一次' }
  };

  function Item(game, kind, x, z) {
    this.g = game; this.kind = kind; this.x = x;
    this.z = z == null ? 42 : z;
    this.t = (x * 0.013) % 6.28; this.got = false; this.mag = false; this.pop = 0;
  }
  var I = Item.prototype;

  I.update = function (dt, p) {
    this.t += dt;
    if (this.got) { this.pop += dt; return; }
    var dx = (p.x + 26) - this.x, dz = (p.z + 40) - this.z, d = Math.sqrt(dx * dx + dz * dz);
    if (!this.mag && p.magnetT > 0 && d < 190) this.mag = true;
    if (this.mag) {
      var sp = 640 * dt;
      if (d < sp || d < 14) { this.x = p.x + 26; this.z = p.z + 40; }
      else { this.x += dx / d * sp; this.z += dz / d * sp; }
      if (this.g.rand() < 0.5) this.g.particles.sparkle(this.x, this.g.G - this.g.terrain.h(this.x) - this.z);
    }
  };

  I.draw = function (ctx, camX, shy) {
    var p = PR.sprites.props, x = this.x - camX, gy = this.g.G - this.g.terrain.h(this.x) + shy;
    var bob = Math.sin(this.t * 3 + this.x * 0.01) * 2;
    if (this.z < 30) drawScaled(ctx, p.shadow, x, gy + 2, 0.45, 0.4, 0.35);
    if (this.kind !== 'coin') {                                       // 道具背后的呼吸光环
      var a = 0.22 + 0.12 * Math.sin(this.t * 3);
      var k = 0.9 + 0.15 * Math.sin(this.t * 2.2);
      drawScaled(ctx, p.ring, x, gy - this.z - bob + 12, k, k, a);
    }
    var sp = this.kind === 'coin' ? p.coin[Math.floor(this.t * 12) % 6] : p[this.kind];
    draw(ctx, sp, x, gy - this.z - bob);
  };

  PR.Item = Item;
})();
