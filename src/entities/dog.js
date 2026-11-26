// src/entities/dog.js
// 野狗 AI：追赶（橡皮筋）→ 低吼蓄力（"!"提示）→ 扑咬（玩家起跳即闪避）→ 喘气；
// 被木棍引开（去捡、坐下啃、伸懒腰）；被障碍绊倒；到站放弃。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});
  var cfg = PR.config, gfx = PR.gfx, clamp = gfx.clamp, draw = gfx.draw, drawScaled = gfx.drawScaled;

  function Dog(game, idx, breed) {
    this.g = game; this.idx = idx || 0;
    this.setBreed(breed || 'yellow');
    this.x = 0; this.z = 0; this.phase = 0; this.hopT = 0; this.t = 0; this.barkT = 1; this.stickX = 0; this.hitDone = false;
  }
  var D = Dog.prototype;
  D.setBreed = function (b) { this.breed = b; this.set = PR.sprites.dog.breeds[b] || PR.sprites.dog.breeds.yellow; };
  D.reset = function (gap) {
    this.x = this.g.player.x - gap; this.z = 0; this.t = 0; this.phase = this.idx * 3; this.hopT = 0; this.hitDone = false;
    this.cool = 1.6 + this.idx * 1.1; this.barkT = 0.6 + this.idx * 0.5; this.state = 'chase';
  };
  D.start = function (s) { this.state = s; this.t = 0; };
  D.groundY = function () { return this.g.G - this.g.terrain.h(this.x); };
  D.gap = function () { return this.g.player.x - this.x; };

  D.update = function (dt) {
    var g = this.g, p = g.player, live = g.state === 'PLAY' && !g.level.finished && !p.dead;
    this.t += dt;
    if (this.hopT > 0) this.hopT -= dt;
    var gap = p.x - this.x, v, u;
    switch (this.state) {
      case 'chase':
        v = g.dogSpeed() + (gap > 430 ? -34 : 0) + (gap < 110 && g.day < 2 ? -8 : 0);
        if (p.hurtT > 0) v += 46;
        if (p.exhaust > 0) v += 14;
        this.x += v * dt;
        this.phase += dt * (5 + v / 30);
        this.barkT -= dt;
        if (gap < 280 && this.barkT <= 0 && live) { this.barkT = 0.9 + g.rand() * 1.5; g.sfx('bark'); if (g.onBark) g.onBark(this); }
        if (this.cool > 0) this.cool -= dt;
        if (live && this.cool <= 0 && gap < g.pounceRange() && p.onGround && !g.level.needDuck(p.x)) {
          this.start('crouch'); g.sfx('growl'); g.fx.shake(0.1);
          if (g.onTelegraph) g.onTelegraph(this);
        }
        break;
      case 'crouch':
        this.x += (p.v - 6) * dt;                           // 保持距离
        if (this.t >= g.telegraphTime()) { this.start('pounce'); this.z = 0; this.hitDone = false; g.sfx('pounce'); }
        break;
      case 'pounce':
        u = this.t / cfg.DOG_POUNCE_TIME;
        this.x += (p.v + g.pounceDist() / cfg.DOG_POUNCE_TIME) * dt;
        if (p.x - this.x < 14) this.x = p.x - 14;           // 不穿过玩家
        this.z = Math.sin(clamp(u, 0, 1) * Math.PI) * 34;
        if (!this.hitDone && p.x - this.x < 22) {
          this.hitDone = true;
          if (p.z > cfg.DODGE_CLEAR && p.onGround === false) { if (g.onDodge) g.onDodge(this); }
          else if (live) { if (g.onBite) g.onBite(this); }
        }
        if (u >= 1) { this.start('recover'); this.z = 0; g.particles.dust(this.x + 40, this.groundY(), 5, 1); }
        break;
      case 'recover':
        this.x += (p.v - 56) * dt;                          // 扑空后喘口气
        this.phase += dt * 5;
        if (this.t > cfg.DOG_COOLDOWN) { this.start('chase'); this.cool = 0.6; }
        break;
      case 'fetch':
        var dv = this.stickX - this.x;
        if (Math.abs(dv) < 12) { this.start('sit'); g.sfx('yelp'); }
        else { this.x += clamp(dv * 3, -260, 300) * dt; this.phase += dt * 15; }
        break;
      case 'sit':
        if (this.t > 1.5) this.start('stretch');
        break;
      case 'stretch':
        if (this.t > 0.5) { this.start('chase'); this.cool = 1.4; }
        break;
      case 'stumble':
        if (this.t > 0.75) { this.start('chase'); this.cool = 0.8; }
        break;
      case 'giveup':
        this.phase += dt * 3;
        break;
    }
    // 追得太近：直接咬到后轮
    if (this.state === 'chase' && live && p.x - this.x < cfg.DOG_GAP_DIE + 4) { if (g.onBite) g.onBite(this); }
    if (p.x - this.x > cfg.DOG_GAP_MAX) this.x = p.x - cfg.DOG_GAP_MAX;
  };

  D.throwStick = function (landX) { this.start('fetch'); this.stickX = landX; };
  D.stumble = function () { this.start('stumble'); this.z = 0; };

  D.draw = function (ctx, camX, shy) {
    var p = PR.sprites.props, x = this.x - camX, gy = this.groundY() + shy, set = this.set, sp, z = this.z;
    if (this.hopT > 0) z += Math.sin(clamp(1 - this.hopT / 0.42, 0, 1) * Math.PI) * 26;
    switch (this.state) {
      case 'crouch': sp = set.crouch; break;
      case 'pounce': sp = set.pounce; break;
      case 'sit': sp = set.sit; break;
      case 'stretch': case 'stumble': sp = set.stun; break;
      default: sp = set.run[Math.floor(this.phase) & 7];
    }
    var k = clamp(1 - z / 160, 0.4, 1);
    drawScaled(ctx, p.shadow, x + 36, gy + 2, k, k, 0.5 * k);
    if (this.state === 'stretch') { drawScaled(ctx, sp, x, gy, 1.08, 0.96, 1); }
    else if (this.state === 'stumble') { drawScaled(ctx, sp, x, gy - Math.abs(Math.sin(this.t * 22)) * 3, 1, 1, 1); }
    else draw(ctx, sp, x, gy - z);
    if (this.state === 'crouch') {                                     // 蓄力提示
      var pop = gfx.easeOutBack(clamp(this.t / 0.2, 0, 1));
      PR.hud.text(ctx, '!', x + 44, gy - 92 - pop * 6, { kind: 'bad', size: Math.max(1, Math.round(3 * pop)), align: 'center' });
    } else if (this.state === 'sit') {
      draw(ctx, PR.sprites.props.stick, x + 52, gy - 26, 0.95);       // 嘴里的木棍
    }
    if (this.state === 'chase' && this.g.rand() < 0.25) {               // 爪下扬尘
      this.g.particles.dust(this.x + 6, gy, 1, 1);
    }
  };

  PR.Dog = Dog;
})();
