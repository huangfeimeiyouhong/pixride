// src/entities/item.js
// 沿路道具：金币 / 体力饮料 / 打狗棒。漂浮动画 + 像素绘制，由 Level 生成与回收。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});
  var px = PR.gfx.px;

  // type: 'coin' | 'stamina' | 'stick'
  // y: 离地高度（像素，向上为正，与 player.y 同坐标系）
  PR.Item = function (worldX, type, y) {
    this.worldX = worldX;
    this.type = type || 'coin';
    this.y = y != null ? y : PR.config.ITEM_GROUND_Y;
    this.collected = false;
    this.t = Math.random() * 6;   // 动画相位随机，避免整排同频
  };

  PR.Item.prototype.update = function (dt) { this.t += dt; };

  PR.Item.prototype.screenX = function (playerWorldX, playerScreenX) {
    return Math.round(this.worldX - playerWorldX + playerScreenX);
  };

  PR.Item.prototype.draw = function (ctx, sx, groundY) {
    var bob = Math.round(Math.sin(this.t * 4) * 2);
    var cy = groundY - this.y + bob;
    if (this.type === 'coin') drawCoin(ctx, sx, cy, this.t);
    else if (this.type === 'stamina') drawStamina(ctx, sx, cy);
    else if (this.type === 'stick') drawStick(ctx, sx, cy);
  };

  function drawCoin(ctx, x, y, t) {
    var gold = '#ffcf3f', edge = '#e0a81f', hi = '#fff3b0';
    // 旋转感：偶数帧更窄（像硬币侧面）
    var spin = Math.floor(t * 5) % 4;
    var w = (spin === 1) ? 4 : 6;
    var x0 = x - Math.round(w / 2);
    px(ctx, x0, y - 3, w, 1, edge);
    px(ctx, x0, y - 2, w, 4, gold);
    px(ctx, x0, y + 2, w, 1, edge);
    if (w >= 6) {
      px(ctx, x0, y - 2, 1, 4, edge);
      px(ctx, x0 + 5, y - 2, 1, 4, edge);
      px(ctx, x0 + 1, y - 1, 1, 1, hi);
      px(ctx, x0 + 2, y - 2, 1, 1, hi);
    }
  }

  function drawStamina(ctx, x, y) {
    var can = '#3ecf5a', dark = '#23913a', top = '#bfffc9', bolt = '#fff';
    // 罐体 6x9
    px(ctx, x - 3, y - 5, 6, 1, dark);
    px(ctx, x - 3, y - 4, 6, 8, can);
    px(ctx, x - 3, y + 4, 6, 1, dark);
    px(ctx, x - 3, y - 4, 1, 8, dark);
    px(ctx, x + 2, y - 4, 1, 8, dark);
    // 罐顶高光
    px(ctx, x - 2, y - 4, 2, 1, top);
    // 闪电
    px(ctx, x, y - 2, 1, 2, bolt);
    px(ctx, x - 1, y, 2, 1, bolt);
    px(ctx, x, y + 1, 1, 2, bolt);
  }

  function drawStick(ctx, x, y) {
    var wood = '#a9703a', dark = '#6e4521', wrap = '#d9b27a';
    // 斜向棍身（用线段逐段描）
    PR.gfx.line(ctx, x - 6, y + 3, x + 6, y - 5, wood);
    PR.gfx.line(ctx, x - 6, y + 4, x + 6, y - 4, wood);
    PR.gfx.line(ctx, x - 6, y + 5, x + 6, y - 3, dark);
    // 手握处的缠布
    px(ctx, x - 6, y + 3, 3, 2, wrap);
    px(ctx, x - 6, y + 5, 3, 1, dark);
    // 棍尖
    px(ctx, x + 6, y - 5, 1, 2, dark);
  }
})();
