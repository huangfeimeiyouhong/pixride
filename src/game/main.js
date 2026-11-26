// src/game/main.js
// 游戏主控：状态机（标题 / 营地 / 骑行 / 结算 / 通关 / 暂停）、固定步长主循环、渲染合成、存档与界面事件分发。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});
  var cfg = PR.config, gfx = PR.gfx, clamp = gfx.clamp, draw = gfx.draw, drawScaled = gfx.drawScaled;

  var ST = { TITLE: 'TITLE', PLAY: 'PLAY', PAUSE: 'PAUSE', CAMP: 'CAMP', OVER: 'OVER', WIN: 'WIN' };
  var BAKE_MS = 4;                 // 每帧用于主题烘焙的时间预算（毫秒）
  var DOG_DUST = 14;               // 野狗奔跑时每秒扬尘次数（期望值）
  PR.STATES = ST;

  PR.Game = function (opts) {
    var c = this.canvas = opts.canvas, self = this;
    this.ctx = c.getContext('2d');
    this.buffer = opts.buffer || PR.sys.createCanvas(64, 64);
    this.bctx = this.buffer.getContext('2d');
    PR.save.load();                                                        // 以下一次性准备都是幂等的
    PR.sprites.buildAll();
    PR.art.buildStatic();
    PR.hud.init();
    if (PR.audio && PR.audio.setMuted) PR.audio.setMuted(!PR.save.data.sound);
    this.dpr = 1; this.bw = 586; this.bh = 330; this.s = 1; this.G = this.bh - cfg.GROUND_H;
    this.ox = 0; this.oy = 0; this.safe = { l: 0, t: 0, r: 0, b: 0 };
    this.time = 0; this.uiT = 0; this.state = ST.TITLE; this.mode = 'journey'; this.day = 0; this.runSeed = 0;
    this.score = 0; this.coins = 0; this.result = null; this.hints = [];
    this.acc = 0; this.simT = 0; this.lastX = 0; this.camX = 0; this.titleX = 0;
    this.surgeT = 0; this.surgeCd = 5; this.deathT = 0; this.comboAt = 0; this.tipIdx = 0; this.confirmReset = false;
    this.job = null; this.bakeQ = []; this.loading = null;
    this.fpsA = 16; this.q = 1; this.running = false; this.lastT = 0;
    this.rand = gfx.rng(((Date.now() & 0xffff) + 7) | 0);                  // 可播种随机数（带 range / int / pick），以 g.rand() 形式调用
    this.fx = new PR.Fx(this);
    this.particles = new PR.Particles(this);
    this.terrain = new PR.Terrain(3);
    this.level = new PR.Level(this); this.level.endX = Infinity;
    this.player = new PR.Player(this);
    this.dogs = [new PR.Dog(this, 0, 'yellow')];
    this.scene = new PR.Scene(this);
    // 输入映射：指针位置 → 缓冲区坐标；右半屏 = 蹬车区
    this.cssW = 800; this.cssH = 450;
    PR.input.mapper = function (cx, cy) {
      var r = (c.getBoundingClientRect && c.getBoundingClientRect()) || null;
      var w = (r && r.width) || self.cssW, h = (r && r.height) || self.cssH;
      return { x: ((cx - (r ? r.left : 0)) * c.width / (w || 1) - self.ox) / self.s, y: ((cy - (r ? r.top : 0)) * c.height / (h || 1) - self.oy) / self.s };
    };
    PR.input.sprintZone = function (x) { return x >= self.bw * 0.5; };
    this.resize(opts.viewW, opts.viewH, opts.dpr, opts.safeArea);
    this.toTitle();
  };

  // ---------------- 视口 ----------------
  // 缓冲区高度取 330 的整数倍（约），再整数倍放大铺满屏幕：像素锐利且没有黑边。竖屏时在屏幕中央留 16:9 的游戏区。
  PR.Game.prototype.resize = function (vw, vh, dpr, sa) {
    var c = this.canvas, r;
    if (vw == null) {
      r = (c.getBoundingClientRect && c.getBoundingClientRect()) || null;
      vw = (r && r.width) || c.clientWidth || 0;
      vh = (r && r.height) || c.clientHeight || 0;
      if (!vw || !vh) { vw = (typeof window !== 'undefined' && window.innerWidth) || 800; vh = (typeof window !== 'undefined' && window.innerHeight) || 450; }
    }
    dpr = dpr || (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    this.dpr = dpr;
    this.cssW = vw; this.cssH = vh;
    var cw = Math.max(1, Math.round(vw * dpr)), ch = Math.max(1, Math.round(vh * dpr));    // 画布物理像素
    this.ox = 0; this.oy = 0; this.vw = cw; this.vh = ch;
    if (cw < ch) { this.vh = Math.min(ch, Math.round(cw * 1.6)); this.oy = Math.round((ch - this.vh) / 2); }  // 竖屏：保全宽，高屏补天空，极端比例才留黑
    var s = Math.max(1, Math.floor(this.vh / cfg.TARGET_H)), bw, bh;
    for (;;) { bw = Math.ceil(this.vw / s); bh = Math.ceil(this.vh / s); if (bw <= cfg.MAX_BUFFER_W || s >= 16) break; s++; }
    this.s = s; this.bw = bw; this.bh = bh; this.G = bh - cfg.GROUND_H;
    c.width = cw; c.height = ch;
    this.buffer.width = bw; this.buffer.height = bh;
    this.bctx.imageSmoothingEnabled = false;
    // 安全区（刘海 / 圆角）→ 缓冲区坐标下的内缩量
    var W0 = this.vw / dpr, H0 = this.vh / dpr;
    sa = sa || { left: 0, top: 0, right: W0, bottom: H0 };
    this.safe = {
      l: clamp(sa.left || 0, 0, W0) / dpr / s, t: clamp(sa.top || 0, 0, H0) / dpr / s,
      r: (W0 - clamp(sa.right == null ? W0 : sa.right, 0, W0)) / dpr / s,
      b: (H0 - clamp(sa.bottom == null ? H0 : sa.bottom, 0, H0)) / dpr / s
    };
    this.scene.skyGrad = null; this.scene.shoulder = null; this.fx.grads = {};
  };

  // ---------------- 主循环 ----------------
  PR.Game.prototype.start = function () {
    if (this.running) return;
    this.running = true; this.lastT = 0;
    var self = this;
    if (g.__PR_stopLoop) { try { g.__PR_stopLoop(); } catch (e) {} }       // 单例：停掉上一个实例的循环
    g.__PR_stopLoop = function () { self.running = false; };
    this.loop = function () {
      if (!self.running) return;
      var t = Date.now(), dt = (t - self.lastT) / 1000;                     // 用系统真实时钟：小游戏 rAF 可能是加速的合成时钟
      self.lastT = t;
      if (dt > 0.05) dt = 0.05;                                             // 切后台回来防止大跳
      if (dt > 0) self.frame(dt);
      PR.raf(self.loop);
    };
    PR.raf(this.loop);
  };

  PR.Game.prototype.frame = function (dt) {
    this.tick(dt);
    this.render();
    this.dispatchUi();
    PR.input.endFrame();
  };

  PR.Game.prototype.autoPause = function () { if (this.state === ST.PLAY && !this.player.dead) this.pause(); };
  PR.Game.prototype.autoResume = function () { this.lastT = 0; };
  PR.Game.prototype.pause = function () {
    if (this.state !== ST.PLAY || this.player.dead || this.fx.fading) return;
    this.state = ST.PAUSE; this.uiT = 0; this.sfx('ui');
  };
  PR.Game.prototype.resume = function () {
    if (this.state !== ST.PAUSE) return;
    PR.input.reset(); this.state = ST.PLAY; this.uiT = 0; this.lastT = 0; this.sfx('ui');
  };

  // ---------------- 小工具 ----------------
  PR.Game.prototype.playerX = function () { return clamp(this.bw * cfg.PLAYER_X_FRAC, cfg.PLAYER_X_MIN, cfg.PLAYER_X_MAX); };
  PR.Game.prototype.upg = function (key) { return PR.save.data.up[key] || 0; };
  PR.Game.prototype.scoreNow = function () { return this.score | 0; };
  PR.Game.prototype.sfx = function (name, rate) { if (PR.audio && PR.audio.play) PR.audio.play(name, rate); };
  PR.Game.prototype.toggleSound = function () {
    var d = PR.save.data; d.sound = d.sound ? 0 : 1;
    if (PR.audio) PR.audio.setMuted(!d.sound);
    PR.save.write(); this.sfx('ui');
  };

  // ---------------- 每帧更新 ----------------
  PR.Game.prototype.tick = function (dt) {
    this.time += dt; this.uiT += dt;
    var fx = this.fx, st = this.state, i, k, keys = PR.input.takeKeyTaps();
    this.fpsA = this.fpsA * 0.94 + dt * 1000 * 0.06;
    this.q = this.fpsA > 26 ? 0 : 1;                                         // 自适应画质：持续掉帧时降低特效
    fx.update(dt);                                                            // 淡出的回调可能在这一步切换状态
    st = this.state;
    for (i = 0; i < keys.length; i++) {
      k = keys[i];
      if (k === 'mute') this.toggleSound();
      else if (k === 'pause') { if (st === ST.PLAY) this.pause(); else if (st === ST.PAUSE) this.resume(); }
      else if (k === 'enter') {                                              // 键盘确认 = 各界面的默认按钮
        if (st === ST.TITLE) this.onUi('start');
        else if (st === ST.CAMP) this.onUi('next');
        else if (st === ST.OVER && this.uiT > 0.5) this.onUi('retry');
        else if (st === ST.PAUSE) this.onUi('resume');
        else if (st === ST.WIN) this.onUi('endless');
      }
    }
    if (this.loading != null) {                                              // 主题烘焙中：显示加载画面
      this.bake(12);
      if (this.themeReady(this.loading)) { this.scene.setTheme(this.loading); this.loading = null; }
      return;
    }
    this.bake(st === ST.PLAY ? 2 : BAKE_MS);
    for (i = this.hints.length - 1; i >= 0; i--) if (this.hints[i].t > this.hints[i].life) this.hints.splice(i, 1);
    if (st !== ST.PLAY) {
      if (st === ST.TITLE) this.tickTitle(dt);
      this.fx.danger += (0 - this.fx.danger) * Math.min(1, dt * 4);
      this.particles.update(dt);
      return;
    }
    this.pollTaps();
    if (this.player.dead) {                                                  // 被追上：定格慢动作后结算
      this.deathT += dt;
      if (this.deathT > 1.6) { this.finishRun(false); this.state = ST.OVER; this.uiT = 0; }
    }
    var scale = fx.scale(), n = 0;
    this.acc += dt * scale;
    while (this.acc >= cfg.STEP && n < 8) {
      this.step(cfg.STEP); this.acc -= cfg.STEP; n++;
      if (this.state !== ST.PLAY) { this.acc = 0; break; }
    }
    if (n >= 8) this.acc = 0;
    this.particles.update(dt * (scale > 0.25 ? scale : 0.25));
  };

  // 标题画面：骑手与野狗在路上"原地"奔跑，背景缓缓滚动
  PR.Game.prototype.tickTitle = function (dt) {
    var p = this.player, i;
    this.titleX += 150 * dt; this.camX = this.titleX;
    p.x = this.camX + this.bw * 0.76; p.z = 0; p.pose = 'ride'; p.tilt = 0; p.dead = false;
    p.pedalPhase += dt * 9; p.wheel += dt * 24; p.hurtT = 0; p.invuln = 0; p.squash = 0; p.wobble = 0;
    for (i = 0; i < this.dogs.length; i++) { var d = this.dogs[i]; d.x = p.x - 200 - i * 120; d.phase += dt * 11; d.t = 0; d.z = 0; d.hopT = 0; d.state = 'title'; }
  };

  // 游玩中的点按：左半屏（且不在按钮上）= 跳跃；右半屏按住 = 蹬车（由 input.isSprintHeld 处理）
  PR.Game.prototype.pollTaps = function () {
    var taps = PR.input.taps, i, t;
    for (i = 0; i < taps.length; i++) {
      t = taps[i];
      if (t.used || PR.input.isUi(t)) continue;
      if (!PR.input.sprintZone(t.x, t.y)) { PR.input.jumpQ++; t.used = true; }
    }
  };

  // ---------------- 模拟（固定步长） ----------------
  PR.Game.prototype.step = function (dt) {
    var p = this.player, dogs = this.dogs, i, d, fx = this.fx, part = this.particles, live = !p.dead && !this.level.finished;
    this.simT += dt;
    p.update(dt);
    this.camX += (p.x - this.playerX() - Math.max(0, p.v - 250) * 0.3 - this.camX) * Math.min(1, dt * 3);   // 镜头：高速时略向前看
    this.surge(dt);
    for (i = 0; i < dogs.length; i++) {
      d = dogs[i];
      d.update(dt);
      if ((d.state === 'chase' || d.state === 'pounce') && this.rand() < dt * (this.surgeT > 0 && i === 0 ? 46 : DOG_DUST)) part.dust(d.x + 6, d.groundY(), 1, 1);
    }
    this.level.update(dt);
    this.score += Math.max(0, p.x - this.lastX) * 0.1;                      // 里程分：每 10 单位 1 分
    this.lastX = p.x;
    this.sprintT = p.sprinting ? this.sprintT + dt : 0;
    // 无尽模式：每隔一段距离换一个主题
    if (this.mode === 'endless' && live) {
      var ti = this.level.themeAt(p.x);
      if (ti !== this.level.theme) { this.switchTheme(ti); }
      this.requestTheme(this.level.themeAt(p.x + 1400));
    }
    // 危险红边：野狗贴近时渐显
    var gap = dogs[0].gap(), danger = live && dogs[0].state !== 'fetch' && dogs[0].state !== 'sit' && dogs[0].state !== 'stretch' ? clamp((230 - gap) / 200, 0, 1) : 0;
    fx.danger += (danger - fx.danger) * Math.min(1, dt * 4);
    this.tickHints(dt);
  };

  // 野狗间歇冲刺：距离较远时突然加速逼近（带"!"预警与扬尘）
  PR.Game.prototype.surge = function (dt) {
    var d = this.dogs[0], p = this.player;
    if (this.surgeT > 0) { this.surgeT -= dt; return; }
    if (p.dead || this.level.finished || d.state !== 'chase') return;
    this.surgeCd -= dt;
    if (this.surgeCd > 0) return;
    var gap = d.gap();
    if (gap < 200 || gap > 500) return;
    this.surgeT = cfg.DOG_SURGE_TIME;
    this.surgeCd = (this.mode === 'endless' ? 5.4 - Math.min(1.6, p.x / 9000) : 5.6 - this.day * 0.4) + this.rand() * 1.6;
    this.fx.text(d.x + 40, d.groundY() - 112, '!', 'bad', true);
    this.fx.shake(0.1);
    this.sfx('bark');
  };

  // 野狗相关数值：随天数 / 无尽距离提高
  PR.Game.prototype.dogSpeed = function (dog) {
    var p = this.player, base = this.mode === 'endless' ? 244 + Math.min(110, p.x / 280) : cfg.DOG_SPEED[Math.min(5, this.day)];
    if (dog && dog.idx > 0) base -= 16;                                      // 第二条狗稍慢，错开队形
    if (this.surgeT > 0 && (!dog || dog.idx === 0)) base += cfg.DOG_SURGE;
    return base;
  };
  PR.Game.prototype.pounceRange = function () { return cfg.DOG_POUNCE_RANGE + (this.mode === 'endless' ? Math.min(40, this.player.x / 600) : this.day * 6); };
  // 蓄力时长：随天数略缩短（到第 6 天 0.24s）。蓄力 + 扑出 ≈ 0.56s 后咬到，所以看到"!"后 0.5s 内起跳都来得及
  PR.Game.prototype.telegraphTime = function () { return cfg.DOG_TELEGRAPH - (this.mode === 'endless' ? Math.min(0.06, this.player.x / 500000) : this.day * 0.012); };
  PR.Game.prototype.dogFailChance = function () { return 0.3 - (this.mode === 'endless' ? Math.min(0.18, this.player.x / 90000) : this.day * 0.036); };

  // ---------------- 教学提示 ----------------
  PR.Game.prototype.hintOn = function (bit) { for (var i = 0; i < this.hints.length; i++) if (this.hints[i].bit === bit) return true; return false; };
  PR.Game.prototype.hint = function (bit, str, x, y, zone, color, life) {
    if ((PR.save.data.tut & bit) || this.hintOn(bit)) return;
    this.hints.push({ bit: bit, str: str, x: x, y: y, zone: zone, color: color, t: 0, life: life || 8 });
  };
  // 完成了对应操作：提示消失，并记入存档（之后不再提示）
  PR.Game.prototype.learn = function (bit) {
    var i, learned = PR.save.data.tut & bit;
    for (i = this.hints.length - 1; i >= 0; i--) if (this.hints[i].bit === bit && this.hints[i].t > 0.25) this.hints.splice(i, 1);
    if (!learned && !(PR.save.data.tut & bit)) { PR.save.data.tut |= bit; PR.save.write(); }
  };
  PR.Game.prototype.tickHints = function (dt) {
    var p = this.player, t = this.simT, tut = PR.save.data.tut, i;
    for (i = 0; i < this.hints.length; i++) this.hints[i].t += dt;
    if (p.dead) return;
    if (!(tut & 1)) { if (t > 0.8 && p.x > 120) this.hint(1, '点按左屏：跳跃', 0.25, 0.5, true, '#6cc6ff'); }
    else if (!(tut & 2) && t > 1.2 && this.day === 0 && this.mode === 'journey') this.hint(2, '按住右屏：蹬车加速', 0.75, 0.5, true, '#ffb347');
    if (p.sprinting && this.sprintT > 0.4) this.learn(2);
  };

  // ---------------- 事件回调（由实体 / 关卡调用） ----------------
  PR.Game.prototype.addScore = function (n, wx, wy, str, kind, big) {
    this.score += n;
    if (str) this.fx.text(wx, wy, str, kind, big);
  };
  PR.Game.prototype.collect = function (it) {
    var p = this.player, y = this.G - this.terrain.h(it.x) - it.z - 30;
    p.stats.items++;
    switch (it.kind) {
      case 'coin':
        this.coins++; this.addScore(10 * p.comboMult());
        this.sfx('coin', 1 + Math.min(0.6, p.combo * 0.05));               // 连击越高音调越高
        this.particles.sparkle(it.x, y + 16);
        break;
      case 'drink':
        p.stam = Math.min(p.stamMax(), p.stam + p.stamMax() * 0.35);
        this.fx.text(it.x, y, '体力 +35', 'good'); this.sfx('pickup'); break;
      case 'stick':
        if (p.sticks < 3) p.sticks++;
        this.fx.text(it.x, y, '木棍! 狗追近时自动扔出', 'good'); this.sfx('pickup'); break;
      case 'magnet':
        p.magnetT = 8; this.fx.text(it.x, y, '磁铁!', 'shield'); this.sfx('magnet'); break;
      case 'gel':
        p.boostT = 4; this.fx.text(it.x, y - 4, '能量胶! 冲刺', 'gold', true); this.sfx('boost'); this.fx.flash(0.12, '#ffe08a'); break;
      default:
        p.shield = true; this.fx.text(it.x, y, '护盾!', 'shield'); this.sfx('shield');
    }
  };
  PR.Game.prototype.onJump = function () { this.learn(1); };
  PR.Game.prototype.onTelegraph = function () { this.hint(4, '狗低吼时 → 起跳闪避', 0.22, 0.4, false, null, 5); };
  PR.Game.prototype.onDodge = function (dog) {
    var p = this.player, gy = p.groundY();
    p.stats.dodges++;
    this.addScore(25 * p.comboMult(), p.x + 20, gy - 124, '完美闪避!', 'shield', true);
    this.fx.slowmo(0.32, 0.4); this.fx.shake(0.12);
    this.particles.ring(dog.x + 40, dog.groundY() - 30, 2.2); this.particles.sparkle(p.x + 26, gy - 60);
    this.sfx('whiff'); this.learn(4);
  };
  // 被咬：扑击中 = 摔一跤、掉金币，野狗仍贴在身后（必须马上蹬车拉开）；被追到身后 = 骑行结束
  PR.Game.prototype.onBite = function (dog) {
    if (this.player.dead) return;
    if (dog.state === 'pounce') this.pounceHit(dog); else this.kill();
  };
  PR.Game.prototype.pounceHit = function (dog) {
    var p = this.player, fx = this.fx, gy = p.groundY(), lost = Math.min(this.coins, cfg.DOG_BITE_COINS);
    dog.fed = true;
    p.v = 70; p.hurtT = 0.85; p.z = 0; p.vz = 0; p.onGround = true; p.slipT = 0; p.boostT = 0;
    p.stam = Math.max(0, p.stam - 15);                     // 被咬很消耗：连续失误会力竭，才真正致命
    p.combo = 0; p.comboT = 0; p.stats.bites++;
    this.coins -= lost;
    fx.shake(0.7); fx.stop(0.09); fx.flash(0.3, '#ff6a5e');
    this.particles.stars(p.x + 26, gy - 50, 10); this.particles.dust(p.x + 10, gy, 6, 1);
    this.sfx('crash'); this.sfx('bark');
    fx.text(p.x + 20, gy - 116, lost ? '被咬住! -' + lost + ' 金币' : '被咬住了!', 'bad', true);
    if (!(PR.save.data.tut & 4)) fx.say('快蹬车甩开它!', '按住右屏 / Shift', 2.2);
  };
  PR.Game.prototype.kill = function () {
    var p = this.player, gy = p.groundY(), i;
    p.dead = true; p.deadT = 0; p.hurtT = 0; p.z = 0; p.vz = 0; p.onGround = true;
    this.deathT = 0;
    this.fx.shake(0.9); this.fx.stop(0.12); this.fx.flash(0.4, '#ff4d4d'); this.fx.slowmo(1.1, 0.3);
    this.fx.say('被追上了!', '', 1.6);
    this.particles.spark(p.x + 30, gy - 20, 10); this.particles.dust(p.x + 10, gy, 8, 1);
    for (i = 0; i < this.dogs.length; i++) this.dogs[i].start('giveup');
    this.sfx('lose'); this.sfx('bark');
    this.bgm(null);
  };
  PR.Game.prototype.onArrive = function () {
    this.fx.say('抵达营地', this.level.def.name, 2.2); this.sfx('camp');
    this.particles.confetti(this.player.x + 90, this.G - 150, 36);
  };
  PR.Game.prototype.onDayDone = function () {
    this.finishRun(true);
    if (this.mode === 'journey' && this.day >= 5) { this.state = ST.WIN; this.sfx('win'); }
    else { this.state = ST.CAMP; this.requestTheme(Math.min(5, this.day + 1)); }
    this.uiT = 0;
  };
  PR.Game.prototype.bgm = function (kind) { if (PR.audio && PR.audio.bgm) PR.audio.bgm(kind); };

  // ---------------- 一局流程 ----------------
  PR.Game.prototype.startRun = function (mode, day) {
    var p = this.player, breeds, i;
    this.mode = mode; this.day = day; this.runSeed = (Math.random() * 1e6) | 0;
    PR.input.reset(); this.fx.clear(); this.particles.clear(); this.hints.length = 0;
    this.terrain = new PR.Terrain(day * 131 + (mode === 'endless' ? 5000 : 0) + 17);
    if (mode === 'journey') this.terrain.addFlat(cfg.DAY_LEN[day] - cfg.FLAT_AFTER, cfg.DAY_LEN[day] + 300);   // 营地前后平坦
    this.level.start(day, mode, 0);
    p.reset(0);
    breeds = this.level.def.dogs;
    this.dogs.length = 0;
    for (i = 0; i < Math.min(2, breeds.length); i++) { this.dogs.push(new PR.Dog(this, i, breeds[i])); this.dogs[i].reset(cfg.DOG_GAP_START + i * 90); }
    this.score = 0; this.coins = 0; this.result = null; this.lastX = 0; this.acc = 0; this.simT = 0; this.deathT = 0;
    this.surgeT = 0; this.surgeCd = 4.5; this.sprintT = 0; this.comboAt = 0; this.confirmReset = false;
    this.tipIdx = (Math.random() * 8) | 0;
    this.camX = p.x - this.playerX();
    this.state = ST.PLAY; this.uiT = 0;
    this.useTheme(this.level.theme);
    if (mode === 'endless') this.requestTheme(this.level.themeAt(1400));
    this.fx.fadeIn();
    this.level.fill();
    this.sfx('start'); this.bgm(PR.audio && PR.audio.bgmFor ? PR.audio.bgmFor(this.level.theme) : null);
  };

  // 一局结束（到站或被追上）：结算、写存档。金币无论如何都会留下；星级只在到站时结算
  PR.Game.prototype.finishRun = function (win) {
    var d = PR.save.data, p = this.player, st = p.stats, r = this.result = {};
    r.win = !!win; r.coins = this.coins; r.stumbles = st.stumbles; r.bites = st.bites; r.dist = p.x / 10 | 0;
    r.score = this.scoreNow(); r.combo = p.bestCombo; r.dodges = st.dodges; r.stars = 0; r.bonus = 0;
    if (win && this.mode === 'journey') {                                     // 星级：失误（摔车 / 被咬）占比
      var misses = st.stumbles + st.bites * 1.5, total = Math.max(8, st.clean + st.stumbles);
      r.stars = misses <= 0.12 * total ? 3 : (misses <= 0.35 * total ? 2 : 1);
      r.bonus = 30 + r.stars * 10;
      d.stars[this.day] = Math.max(d.stars[this.day], r.stars);
      if (this.day >= 5) d.done = true; else d.day = this.day + 1;
    }
    d.coins += r.coins + r.bonus;
    r.newBest = r.score > d.best.score;
    d.best.score = Math.max(d.best.score, r.score);
    d.best.dist = Math.max(d.best.dist, r.dist); d.best.combo = Math.max(d.best.combo, r.combo);
    if (this.mode === 'endless') { r.best = d.best.endless; d.best.endless = Math.max(d.best.endless, r.dist); }
    PR.save.write();
  };
  PR.Game.prototype.buy = function (i) {
    var d = PR.save.data, up = cfg.UPGRADES[i], lv = d.up[up.key], cost;
    if (lv >= up.max) { this.sfx('deny'); return; }
    cost = cfg.UPGRADE_COST[lv];
    if (d.coins < cost) { this.sfx('deny'); return; }
    d.coins -= cost; d.up[up.key]++; PR.save.write();
    this.sfx('buy'); this.particles.confetti(this.bw * 0.5, this.bh * 0.22, 18);
  };
  PR.Game.prototype.toTitle = function () {
    var ti = (PR.save.data.done && PR.save.data.day >= 5) ? 0 : PR.save.data.day;
    this.state = ST.TITLE; this.uiT = 0; this.confirmReset = false;
    this.fx.fadeIn(); this.fx.danger = 0; this.fx.banner = null; this.fx.texts.length = 0;
    this.setTitleTheme(ti);
    this.bgm(PR.audio && PR.audio.bgmFor ? PR.audio.bgmFor(ti) : null);
  };
  PR.Game.prototype.setTitleTheme = function (ti) {
    var dogs = PR.themes[ti].dogs, i;
    this.day = ti; this.titleX = 0; this.dogs.length = 0;
    for (i = 0; i < Math.min(2, dogs.length); i++) this.dogs.push(new PR.Dog(this, i, dogs[i]));
    this.useTheme(ti);
    if (PR.save.data.done) this.requestTheme(0);
  };

  // ---------------- 主题图集：按帧预算分片烘焙 ----------------
  PR.Game.prototype.themeReady = function (ti) { return this.scene.themeIndex === ti || !!this.scene.cache[ti]; };
  PR.Game.prototype.requestTheme = function (ti) {
    if (this.themeReady(ti) || this.bakeQ.indexOf(ti) >= 0 || (this.job && this.job.ti === ti)) return;
    this.bakeQ.push(ti);
  };
  PR.Game.prototype.useTheme = function (ti) {
    this.requestTheme(ti);
    if (this.themeReady(ti)) { this.scene.setTheme(ti); return true; }
    this.loading = ti;
    return false;
  };
  PR.Game.prototype.switchTheme = function (ti) {
    var dogs = PR.themes[ti].dogs, i;
    this.level.setTheme(ti); this.scene.setTheme(ti);
    for (i = 0; i < this.dogs.length; i++) this.dogs[i].setBreed(dogs[i % dogs.length]);
    this.fx.flash(0.45, '#ffffff'); this.fx.say(PR.themes[ti].name, '', 1.6);
    this.bgm(PR.audio && PR.audio.bgmFor ? PR.audio.bgmFor(ti) : null);
  };
  PR.Game.prototype.bake = function (budget) {
    var t0 = Date.now(), sc = this.scene;
    while (Date.now() - t0 < budget) {
      if (!this.job) { if (!this.bakeQ.length) return; this.job = new PR.art.Job(this.bakeQ.shift()); }
      if (this.job.step()) { this.job.art.sheet.pix = null; sc.cache[this.job.ti] = this.job.art; this.job = null; }
    }
  };

  // ---------------- 界面事件 ----------------
  PR.Game.prototype.dispatchUi = function () {
    var ids = PR.hud.hit(), i;
    for (i = 0; i < ids.length; i++) this.onUi(ids[i]);
  };
  PR.Game.prototype.fade = function (cb) { this.sfx('ui'); this.fx.fadeOut(cb); };
  PR.Game.prototype.onUi = function (id) {
    var st = this.state, fx = this.fx, d = PR.save.data, self = this;
    if (st === ST.PLAY) { if (id === 'pause') this.pause(); return; }
    if (this.loading != null) return;
    if (id === 'cancel') { this.confirmReset = false; this.sfx('ui'); return; }
    if (fx.fading || fx.fadeA > 0.01) return;                                 // 转场中不响应，避免连点
    if (st === ST.TITLE) {
      if (id === 'start') this.fade(function () { self.startRun('journey', self.day); });
      else if (id === 'endless') { if (!d.done) { this.sfx('deny'); return; } this.fade(function () { self.startRun('endless', 0); }); }
      else if (id === 'sound') this.toggleSound();
      else if (id === 'reset') { this.confirmReset = true; this.sfx('ui'); }
      else if (id === 'resetYes') {
        PR.save.reset(); this.confirmReset = false; this.sfx('buy');
        if (PR.audio && PR.audio.setMuted) PR.audio.setMuted(!PR.save.data.sound);
        this.setTitleTheme(0);
      }
    } else if (st === ST.CAMP) {
      if (id === 'next') this.fade(function () { self.startRun('journey', self.day + 1); });
      else if (id.length > 2 && id.slice(0, 2) === 'up') this.buy(+id.slice(2));
    } else if (st === ST.OVER) {
      if (id === 'retry') this.fade(function () { self.startRun(self.mode, self.day); });
      else if (id === 'title') this.fade(function () { self.toTitle(); });
    } else if (st === ST.WIN) {
      if (id === 'endless') this.fade(function () { self.startRun('endless', 0); });
      else if (id === 'title') this.fade(function () { self.toTitle(); });
    } else if (st === ST.PAUSE) {
      if (id === 'resume') this.resume();
      else if (id === 'restart') { d.coins += this.coins; PR.save.write(); this.fade(function () { self.startRun(self.mode, self.day); }); }
      else if (id === 'title') { d.coins += this.coins; PR.save.write(); this.fade(function () { self.toTitle(); }); }
      else if (id === 'sound') this.toggleSound();
    }
  };

  // ---------------- 渲染 ----------------
  // 世界画在低分辨率缓冲区（整数倍放大铺满屏幕，像素锐利）；界面直接画在主画布上（文字清晰）。
  PR.Game.prototype.render = function () {
    var ctx = this.ctx, b = this.bctx, s = this.s, W = this.bw, H = this.bh, st = this.state, fx = this.fx, i, o;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#070910'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.loading != null) { this.drawLoading(); return; }
    var p = this.player, camX = this.camX, shx = fx.sx, shy = fx.sy, def = this.scene.def, lv = this.level;
    this.shy = shy;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.fillStyle = def.haze.c; b.fillRect(0, 0, W, H);                      // 震屏时露出的边缘
    b.setTransform(1, 0, 0, 1, shx, shy);
    b.imageSmoothingEnabled = false;
    this.scene.drawBack(b, camX, shy, null);
    if (st !== ST.TITLE) {
      lv.drawCamp(b, camX, shy);
      for (i = 0; i < lv.obs.length; i++) { o = lv.obs[i]; if (o.x - camX > -260 && o.x - camX < W + 260) o.draw(b, camX, shy, 0); }
      for (i = 0; i < lv.obs.length; i++) { o = lv.obs[i]; if (o.x - camX > -260 && o.x - camX < W + 260) o.draw(b, camX, shy, 1); }
      for (i = 0; i < lv.items.length; i++) { o = lv.items[i]; if (o.x - camX > -60 && o.x - camX < W + 60) o.draw(b, camX, shy); }
      lv.drawSticks(b, camX, shy);
    }
    for (i = 0; i < this.dogs.length; i++) this.dogs[i].draw(b, camX, shy);
    p.draw(b, camX, shy);
    this.particles.draw(b, camX);
    this.scene.drawFrontAll(b, camX, shx);
    var fast = p.sprinting && p.v > 380 ? clamp((p.v - 380) / 60, 0, 0.7) : (p.boostT > 0 ? 1 : 0);
    if (this.q && fast > 0.02 && st === ST.PLAY) fx.speedLines(b, W, H, fast, this.time);
    if (def.weather.kind) fx.weather(b, camX, W, H, this.time, def.weather.kind, this.q ? def.weather.n : Math.ceil(def.weather.n / 2));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.buffer, 0, 0, W, H, this.ox, this.oy, W * s, H * s);
    ctx.setTransform(s, 0, 0, s, this.ox, this.oy);
    fx.overlay(ctx, W, H, { night: def.stars ? 0.26 : 0 });
    fx.drawTexts(ctx, camX, PR.hud, W);
    PR.hud.begin();
    if (st === ST.PLAY) { PR.hud.play(ctx, this); PR.hud.hints(ctx, this); }
    else if (st === ST.TITLE) PR.screens.title(ctx, this);
    else if (st === ST.CAMP) PR.screens.camp(ctx, this);
    else if (st === ST.OVER) PR.screens.over(ctx, this);
    else if (st === ST.WIN) PR.screens.win(ctx, this);
    else if (st === ST.PAUSE) PR.screens.pause(ctx, this);
  };

  // 主题烘焙期间的加载画面
  PR.Game.prototype.drawLoading = function () {
    var ctx = this.ctx, s = this.s, W = this.vw / s, H = this.vh / s, u = this.job ? this.job.i / this.job.q.length : 0;
    ctx.setTransform(s, 0, 0, s, this.ox, this.oy);
    ctx.fillStyle = '#0b1020'; ctx.fillRect(0, 0, W + 1, H + 1);
    PR.hud.cn(ctx, '像素骑行', W / 2, H * 0.42, 26, 'title', 'center');
    PR.hud.bar(ctx, W / 2 - 70, H * 0.56, 140, 5, u, '#ffd23f', '#2a3350');
    PR.hud.cn(ctx, '加载中…', W / 2, H * 0.56 + 24, 12, 'sub', 'center');
  };
})();
