// src/entities/player.js
// 骑行者：速度 / 体力 / 跳跃 / 姿态动画 / 道具 / 连击。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});
  var cfg = PR.config, gfx = PR.gfx, clamp = gfx.clamp, draw = gfx.draw, drawScaled = gfx.drawScaled;

  function Player(game) { this.g = game; this.reset(0); }
  var P = Player.prototype;
  var WR = 13;                                   // 车轮半径：精灵锚点是后轮轴心

  P.reset = function (x) {
    var k;
    this.x = x; this.z = 0; this.vz = 0; this.v = cfg.BASE_SPEED * 0.6;
    this.onGround = true; this.coyote = 0; this.jumpBuf = 0; this.jumpCut = false;
    this.pose = 'ride'; this.tilt = 0; this.tiltV = 0; this.wheel = 0; this.pedalPhase = 0;
    this.stam = this.stamMax(); this.exhaust = 0; this.sprinting = false; this.duck = false;
    this.boostT = 0; this.invuln = 0; this.hurtT = 0; this.slipT = 0; this.squash = 0; this.wobble = 0;
    this.sticks = 0; this.shield = false; this.magnetT = 0; this.throwCd = 0; this.throwWant = false;
    this.combo = 0; this.comboT = 0; this.bestCombo = 0; this.comboMax = 1;
    this.dead = false; this.deadT = 0; this.cheerT = 0;
    this.stats = { coins: 0, stumbles: 0, jumps: 0, dodges: 0, clean: 0, sticks: 0, items: 0, dist: 0 };
  };
  P.stamMax = function () { return cfg.STAMINA_MAX * (1 + 0.12 * this.g.upg('stamina')); };
  P.groundY = function () { return this.g.G - this.g.terrain.h(this.x); };

  P.update = function (dt) {
    var g = this.g, inp = PR.input, terr = g.terrain, fx = g.fx, part = g.particles, rnd = g.rand;
    var live = g.state === 'PLAY' && !g.level.finished && !this.dead;
    var sl = terr.slope(this.x);

    // 1) 速度：滑行 / 蹬车 / 坡度 / 打滑 / 能量胶
    var want = live && inp.isSprintHeld() && this.exhaust <= 0 && this.slipT <= 0;
    this.sprinting = want && this.stam > 0;
    var target = cfg.BASE_SPEED * (1 + 0.02 * g.upg('light')) - sl * 260;
    if (this.sprinting) target = cfg.PEDAL_SPEED * (1 + 0.04 * g.upg('pedal')) - sl * 180;
    if (this.slipT > 0) target -= 70;
    if (this.boostT > 0) target += 95;
    if (!live) target = this.dead ? 0 : 215;
    target = Math.max(70, target);
    if (this.hurtT > 0) target = Math.min(target, cfg.HIT_SPEED + 40);
    var acc = target > this.v ? (this.sprinting ? 4.2 : 2.4) : 3.4;
    this.v += (target - this.v) * Math.min(1, acc * dt);
    if (this.dead && this.v < 12) this.v = 0;
    this.x += this.v * dt;

    // 2) 体力
    var drain;
    if (this.sprinting) drain = cfg.STAMINA_DRAIN + Math.max(0, sl) * cfg.SLOPE_DRAIN * 10;
    else drain = -cfg.STAMINA_REGEN * (1 + 0.12 * g.upg('regen')) * (sl < -0.03 ? 1.3 : 1);
    var before = this.stam;
    this.stam = clamp(this.stam - drain * dt, 0, this.stamMax());
    if (this.sprinting && this.stam <= 0 && before > 0) {
      this.exhaust = 1.4; fx.text(this.x + 20, this.groundY() - 96, '力竭!', 'bad'); g.sfx('exhaust');
    }
    if (this.exhaust > 0) { this.exhaust -= dt; if (this.stam > this.stamMax() * 0.35) this.exhaust = 0; }

    // 3) 跳跃：缓冲 + 土狼时间 + 松手截断（短按小跳，最低 330 保证能跳过石头）
    var jp = inp.consumeJump();
    if (jp && live) this.jumpBuf = cfg.JUMP_BUFFER;
    if (this.jumpBuf > 0) this.jumpBuf -= dt;
    if (this.jumpBuf > 0 && this.coyote > 0 && this.hurtT <= 0 && live) this.jump();
    if (!this.onGround) {
      if (!inp.isJumpHeld() && this.vz > 0 && !this.jumpCut) { this.vz = Math.max(this.vz * cfg.JUMP_CUT, 330); this.jumpCut = true; }
      this.vz -= cfg.GRAVITY * dt;
      this.z += this.vz * dt;
      if (this.z <= 0) this.land();
    } else this.coyote = 0.08;

    // 4) 计时器
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.slipT > 0) this.slipT -= dt;
    if (this.magnetT > 0) this.magnetT -= dt;
    if (this.throwCd > 0) this.throwCd -= dt;
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) { this.combo = 0; this.comboMax = 1; } }
    if (this.boostT > 0) {
      this.boostT -= dt;
      if (rnd() < dt * 40) part.add({ x: this.x + rnd.range(-10, 40), y: this.groundY() - 14 - this.z - rnd.range(0, 40), vx: -this.v * 0.5, vy: rnd.range(-10, 10), life: 0.25, col: '#ffe08a', w: 3, h: 1 });
    }
    this.squash *= Math.max(0, 1 - dt * 11);
    this.wobble = this.slipT > 0 ? Math.sin(g.time * 34) * 3 : 0;

    // 5) 姿态
    this.tiltV += (clamp(Math.round(sl / 0.09), -2, 2) - this.tiltV) * Math.min(1, dt * 8);
    this.tilt = clamp(Math.round(this.tiltV), -2, 2);
    this.wheel += this.v * dt / WR;
    var pedaling = this.sprinting || (sl > 0.03 && this.v > 150) || this.boostT > 0;
    this.pedalPhase += (pedaling ? this.v : 0) * dt / 26;
    this.duck = false;
    var pose;
    if (this.dead || this.hurtT > 0) pose = 'hurt';
    else if (!this.onGround) pose = 'air';
    else if (g.level.needDuck(this.x)) { pose = 'duck'; this.duck = true; }
    else if (this.sprinting) pose = 'sprint';
    else if (pedaling) pose = 'ride';
    else pose = 'coast';
    if (g.level.finished && !this.dead) { this.cheerT += dt; pose = (Math.floor(this.cheerT * 1.6) % 3 === 2) ? 'cheer' : 'ride'; }
    this.pose = pose;
    if (this.dead) this.deadT += dt;

    // 6) 尾尘 / 打滑的雪粉
    if (this.onGround && this.v > 340 && rnd() < dt * 20) part.dust(this.x - 12, this.groundY(), 1, 1);
    if (this.slipT > 0 && this.onGround && rnd() < dt * 34) part.poof(this.x + rnd.range(-8, 36), this.groundY(), 1);
  };

  P.jump = function () {
    var g = this.g;
    this.vz = cfg.JUMP_V * (1 + 0.06 * g.upg('light'));
    this.onGround = false; this.coyote = 0; this.jumpBuf = 0; this.jumpCut = false; this.squash = -0.3;
    this.stats.jumps++;
    g.particles.dust(this.x, this.groundY(), 5, 1);
    g.sfx('jump');
    g.onJump && g.onJump();
  };
  P.land = function () {
    var g = this.g;
    this.z = 0; this.vz = 0; this.onGround = true; this.squash = 0.35;
    g.particles.dust(this.x + 6, this.groundY(), 6, 1);
    g.sfx('land');
  };

  // clean：无伤跳过障碍的奖励（由关卡在越过障碍时调用）
  P.cleanPass = function (ob) {
    var g = this.g, mult = this.comboMult();
    this.combo++; this.comboT = 3.2;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    this.stats.clean++;
    g.addScore(5 * mult, ob.x, 60, '+' + (5 * mult) + ' 连击!');
    g.sfx('tick', this.combo);
  };
  P.comboMult = function () { return clamp(1 + Math.floor((this.combo - 1) / 2), 1, 5); };

  // 撞到障碍：kind ∈ rock / log / branch / pothole / puddle / ice / drift
  P.hit = function (kind, ob) {
    var g = this.g, fx = g.fx, part = g.particles, gy = this.groundY();
    if (this.dead || this.invuln > 0) return false;
    if ((kind === 'rock' || kind === 'log') && this.boostT > 0) {          // 能量胶期间直接撞飞
      ob.broken = true; part.spark(ob.x, gy - 14, 8); part.dust(ob.x, gy, 5, 1);
      fx.shake(0.25); fx.stop(0.04); g.sfx('smash');
      g.addScore(15, ob.x, 50, '撞飞!');
      return true;
    }
    var hard = (kind === 'rock' || kind === 'log' || kind === 'branch' || kind === 'pothole');
    if (hard && this.shield) {                                              // 护盾抵挡一次
      this.shield = false; this.invuln = 0.8;
      fx.flash(0.25, '#8fe0ff'); fx.text(this.x + 20, gy - 100, '护盾抵挡!', 'shield'); fx.shake(0.2);
      part.stars(this.x + 20, gy - 50, 8); g.sfx('shield'); g.onShieldLost && g.onShieldLost();
      return true;
    }
    if (hard) {
      this.v = cfg.HIT_SPEED; this.hurtT = 0.62; this.invuln = cfg.INVULN;
      this.stam = Math.max(0, this.stam - 12); this.combo = 0; this.comboT = 0;
      this.z = 0; this.vz = 0; this.onGround = true;
      this.stats.stumbles++;
      fx.shake(0.55); fx.stop(0.07); fx.flash(0.28, '#ffffff');
      part.spark(this.x + 30, gy - 24, 7); part.dust(this.x + 10, gy, 6, 1);
      g.sfx('crash'); g.onStumble && g.onStumble(kind);
    } else if (kind === 'puddle') {
      this.v *= 0.82; this.stam = Math.max(0, this.stam - 4);
      part.splash(this.x + 30, gy + 6, 10); fx.shake(0.12); g.sfx('splash');
    } else if (kind === 'ice') {
      this.slipT = cfg.SLIP_TIME; this.v *= 0.9;
      part.poof(this.x + 30, gy, 5); fx.text(this.x + 20, gy - 96, '打滑!', 'bad'); g.sfx('slip');
    } else {                                                               // drift：雪堆，明显减速
      this.v *= 0.55; this.stam = Math.max(0, this.stam - 6);
      part.poof(this.x + 30, gy - 4, 12); fx.shake(0.25); g.sfx('snow');
    }
    return true;
  };

  // 精灵：按姿态取当前帧
  P.sprite = function () {
    var r = PR.sprites.rider, t = this.tilt + 2, ph = Math.floor(this.pedalPhase) % 8;
    switch (this.pose) {
      case 'hurt': return (this.hurtT > 0.4 && Math.floor(this.hurtT * 30) % 2 === 0) ? r.hurtFlash : r.hurt;
      case 'air': return r.air[t][this.vz < -40 ? 1 : 0];
      case 'duck': return r.duck[t][Math.floor(this.pedalPhase * 0.5) & 1];
      case 'sprint': return r.rideSprint[t][ph];
      case 'coast': return r.coast[t][Math.floor(this.pedalPhase * 0.25) & 1];
      case 'cheer': return r.cheer[Math.floor(this.cheerT * 4) & 1];
      default: return r.ride[t][ph];
    }
  };

  P.draw = function (ctx, camX, shy) {
    var S = PR.sprites, sp = this.sprite(), gy = this.groundY() + shy, x = this.x - camX;
    // 地面阴影
    var k = clamp(1 - this.z / 190, 0.35, 1);
    drawScaled(ctx, S.props.shadow, x + 26, gy + 2, k * (this.dead ? 1.3 : 1), k, 0.55 * k);
    if (this.magnetT > 0 && Math.floor(this.g.time * 8) % 2 === 0) {        // 磁铁光环
      draw(ctx, S.props.ring, x + 26, gy - this.z - 40, 0.35);
    }
    if (this.shield) {
      ctx.globalAlpha = 0.22 + 0.1 * Math.sin(this.g.time * 5);
      ctx.strokeStyle = '#8fe0ff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x + 26, gy - this.z - 40, 50, 0, 6.283); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (this.dead) {
      var u = clamp(this.deadT * 1.6, 0, 1);                               // 摔车：向前滑出并倒地
      draw(ctx, sp, x + gfx.easeOutCubic(u) * 26, gy + 4, 1);
    } else {
      var sq = this.squash, flash = (this.invuln > 0 && this.hurtT <= 0 && Math.floor(this.g.time * 16) % 2 === 0);
      drawScaled(ctx, sp, x, gy - this.z, 1 + sq * 0.1, 1 - sq * 0.1, flash ? 0.55 : 1);
      // 转动的辐条：后轮轴心 = 锚点，前轮轴心随坡度微动
      var fr = Math.floor(this.wheel / (Math.PI / 20)) % 8;
      var fy = gy - this.z - 54 * this.tilt * 0.045;
      draw(ctx, S.spokes[fr], x, gy - this.z, flash ? 0.55 : 1);
      draw(ctx, S.spokes[fr], x + 54, fy, flash ? 0.55 : 1);
    }
  };

  PR.Player = Player;
})();
