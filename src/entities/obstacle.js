// src/entities/obstacle.js
// 路上障碍（石头）与装饰（灌木）。石头需跳跃越过，撞到会减速并被狗拉近。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});

  PR.Obstacle = function (worldX, type) {
    this.worldX = worldX;
    this.type = type || 'rock';   // 'rock' | 'bush'
    this.hit = false;
  };

  PR.Obstacle.prototype.screenX = function (playerWorldX, playerScreenX) {
    return Math.round(this.worldX - playerWorldX + playerScreenX);
  };

  PR.Obstacle.prototype.draw = function (ctx, sx, groundY) {
    if (this.type === 'rock') {
      var s = PR.sprites.rock;
      PR.gfx.drawBitmap(ctx, s.bitmap, s.palette, sx - 7, groundY - 8, 1);
    } else if (this.type === 'bush') {
      var b = PR.sprites.bush;
      PR.gfx.drawBitmap(ctx, b.bitmap, b.palette, sx - 4, groundY - 5, 1);
    }
  };
})();
