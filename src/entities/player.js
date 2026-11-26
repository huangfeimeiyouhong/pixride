// src/entities/player.js
// 骑行者 + 自行车：程序化像素绘制、跳跃物理、体力与速度管理。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});
  var C = PR.gfx.COLORS;
  var cfg = PR.config;
  var px = PR.gfx.px, circle = PR.gfx.circle, line = PR.gfx.line;

  PR.Player = function () {
    this.reset();
  };

  PR.Player.prototype.reset = function () {
    this.worldX = 0;
    this.y = 0;          // 离地高度
    this.vy = 0;
    this.grounded = true;
    this.speed = cfg.BASE_SPEED;
    this.stamina = cfg.STAMINA_MAX;
    this.stun = 0;
    this.animT = 0;
    this.pedaling = false;
  };

  PR.Player.prototype.update = function (dt, input) {
    // 撞击眩晕倒计时
    if (this.stun > 0) this.stun -= dt;

    // 蹬车判定（按住 + 体力足够）
    this.pedaling = input.isPedalHeld() && this.stamina > cfg.PEDAL_MIN && this.stun <= 0;
    if (this.pedaling) {
      this.stamina = Math.max(0, this.stamina - cfg.PEDAL_DRAIN * dt);
      if (this.stamina < cfg.PEDAL_MIN) this.pedaling = false;
    } else {
      this.stamina = Math.min(cfg.STAMINA_MAX, this.stamina + cfg.PEDAL_REGEN * dt);
    }

    // 速度
    if (this.stun > 0) this.speed = cfg.HIT_SPEED;
    else if (this.pedaling) this.speed = cfg.PEDAL_SPEED;
    else this.speed = cfg.BASE_SPEED;

    // 跳跃（y 为离地高度，向上为正）
    if (input.consumeJump() && this.grounded) {
      this.vy = cfg.JUMP_VELOCITY;
      this.grounded = false;
    }
    // 重力：向下拉，vy 递减
    this.vy -= cfg.GRAVITY * dt;
    if (this.vy < -cfg.MAX_FALL) this.vy = -cfg.MAX_FALL;
    this.y += this.vy * dt;
    if (this.y <= 0) { this.y = 0; this.vy = 0; this.grounded = true; }

    // 前进
    this.worldX += this.speed * dt;
    this.animT += this.speed * dt;
  };

  PR.Player.prototype.hit = function () {
    if (this.stun <= 0) this.stun = cfg.HIT_STUN;
  };

  // 碰撞盒（用于障碍判定）
  PR.Player.prototype.getBounds = function (screenX, groundY) {
    return {
      x: screenX + 4,
      y: groundY - this.y - 16,
      w: 32,
      h: 16
    };
  };

  PR.Player.prototype.draw = function (ctx, screenX, groundY) {
    var by = groundY - this.y;            // 车轮底部基线
    var x = screenX;
    var spin = this.animT * 0.012;         // 车轮转角
    var blink = this.stun > 0 && (Math.floor(this.stun * 14) % 2 === 0);

    // 车轮中心
    var rearCx = x + 7, rearCy = by - 7;
    var frontCx = x + 33, frontCy = by - 7;
    var crankCx = x + 13, crankCy = by - 7;
    var seatX = x + 10, seatY = by - 17;
    var barX = x + 26, barY = by - 17;

    // 阴影（贴地）
    if (this.y > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x + 2, groundY - 1, 38, 2);
    }

    drawWheel(ctx, rearCx, rearCy, spin);
    drawWheel(ctx, frontCx, frontCy, spin);

    // 车架
    var fc = blink ? C.white : C.frame;
    line(ctx, rearCx, rearCy, crankCx, crankCy, fc);        // 后下叉
    line(ctx, crankCx, crankCy, seatX, seatY, fc);          // 立管
    line(ctx, seatX, seatY, barX, barY, fc);                // 上管
    line(ctx, barX, barY, frontCx, frontCy, fc);            // 前叉
    // 车座 & 车把
    px(ctx, seatX - 2, seatY - 1, 5, 2, blink ? C.white : C.outline);
    px(ctx, barX - 1, barY - 2, 3, 2, blink ? C.white : C.outline);

    // 牙盘 + 脚踏
    circle(ctx, crankCx, crankCy, 2, C.outline);
    var a = spin * 1.6;
    var p1x = crankCx + Math.round(Math.cos(a) * 5), p1y = crankCy + Math.round(Math.sin(a) * 5);
    var p2x = crankCx + Math.round(Math.cos(a + Math.PI) * 5), p2y = crankCy + Math.round(Math.sin(a + Math.PI) * 5);
    px(ctx, p1x - 1, p1y - 1, 3, 2, C.outline);
    px(ctx, p2x - 1, p2y - 1, 3, 2, C.outline);

    // 躯干（骑行服）
    ctx.fillStyle = blink ? C.white : C.jersey;
    ctx.beginPath();
    ctx.moveTo(seatX, seatY);
    ctx.lineTo(x + 12, by - 28);
    ctx.lineTo(x + 20, by - 28);
    ctx.lineTo(barX - 2, barY + 1);
    ctx.closePath();
    ctx.fill();

    // 手臂（肩→车把）
    line(ctx, x + 17, by - 27, barX, barY, C.skin);
    line(ctx, x + 15, by - 26, barX - 1, barY + 1, C.skin);

    // 头 + 头盔
    circle(ctx, x + 16, by - 31, 3, C.skin);
    px(ctx, x + 13, by - 35, 7, 2, blink ? C.white : C.helmet);
    px(ctx, x + 12, by - 33, 9, 1, blink ? C.white : C.helmet);
    px(ctx, x + 13, by - 31, 1, 1, C.skin); // 脸侧

    // 腿：画在躯干之上，髋→膝→脚两段（2px 粗），鞋踩在脚踏上
    var hipX = x + 10, hipY = by - 16;
    if (!this.grounded) {
      drawLeg(ctx, hipX, hipY, x + 13, by - 20, x + 18, by - 12);  // 腾空收腿
      drawLeg(ctx, hipX, hipY, x + 7, by - 19, x + 4, by - 12);
    } else {
      drawLeg(ctx, hipX, hipY, x + 12, by - 20, p1x, p1y);
      drawLeg(ctx, hipX, hipY, x + 7, by - 19, p2x, p2y);
    }

    // 蹬车时的速度线
    if (this.pedaling && (Math.floor(this.animT * 0.05) % 2 === 0)) {
      px(ctx, x - 6, by - 9, 4, 1, C.white);
      px(ctx, x - 9, by - 6, 3, 1, C.white);
    }
  };

  // 画一条腿：大腿(shorts) + 小腿(skin) + 鞋
  function drawLeg(ctx, hx, hy, kx, ky, fx, fy) {
    thickLine(ctx, hx, hy, kx, ky, C.shorts);
    thickLine(ctx, kx, ky, fx, fy, C.skin);
    px(ctx, fx - 1, fy - 1, 3, 2, C.shoe);   // 鞋
  }
  // 2px 粗的像素直线（在原线下方再画一行）
  function thickLine(ctx, x0, y0, x1, y1, color) {
    line(ctx, x0, y0, x1, y1, color);
    line(ctx, x0, y0 + 1, x1, y1 + 1, color);
  }

  function drawWheel(ctx, cx, cy, spin) {
    circle(ctx, cx, cy, 7, C.tire);
    circle(ctx, cx, cy, 5, C.rim);
    circle(ctx, cx, cy, 2, C.outline);
    var frame = Math.floor(spin / (Math.PI / 2)) % 2;
    var off = frame === 0 ? 0 : Math.PI / 4;
    for (var i = 0; i < 4; i++) {
      var ang = off + i * (Math.PI / 2);
      var ex = cx + Math.round(Math.cos(ang) * 5);
      var ey = cy + Math.round(Math.sin(ang) * 5);
      line(ctx, cx, cy, ex, ey, C.frameDark);
    }
  }
})();
