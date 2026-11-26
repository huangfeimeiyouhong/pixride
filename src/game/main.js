// src/game/main.js
// 游戏主控：状态机（菜单 / 游戏中 / 失败 / 胜利）、主循环、渲染与 HUD。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});
  var cfg = PR.config;
  var C = PR.gfx.COLORS;
  var px = PR.gfx.px;

  var STATE = { MENU: 'MENU', PLAYING: 'PLAYING', GAMEOVER: 'GAMEOVER', WIN: 'WIN' };

  PR.Game = function (opts) {
    this.canvas = opts.canvas;
    this.ctx = this.canvas.getContext('2d');
    this.buffer = opts.buffer;
    this.bctx = this.buffer.getContext('2d');
    this.bctx.imageSmoothingEnabled = false;
    // 视口：逻辑尺寸（CSS 像素）+ DPR。canvas 物理分辨率 = 逻辑 * DPR，ctx 缩放 DPR，
    // 这样在高分屏上仍保持像素锐利（buffer 整数放大到逻辑尺寸，再由 DPR 映射到物理像素）。
    this.dpr = opts.dpr || 1;
    this.viewW = opts.viewW || this.canvas.width || cfg.BUFFER_W;
    this.viewH = opts.viewH || this.canvas.height || cfg.BUFFER_H;
    this.safeArea = opts.safeArea || { left: 0, top: 0, right: this.viewW, bottom: this.viewH };
    this.paused = false;
    this._pedalSfxT = 0;
    this._applyViewport();
    try {
      console.log('[PR-Viewport] ' + JSON.stringify({
        viewW: this.viewW, viewH: this.viewH, dpr: this.dpr,
        safeArea: this.safeArea, cw: this.canvas.width, ch: this.canvas.height
      }));
    } catch (e) {}
    this.bg = new PR.Background({ width: cfg.BUFFER_W, height: cfg.BUFFER_H, groundY: cfg.GROUND_Y });
    this.player = new PR.Player();
    this.dog = new PR.Dog();
    this.level = new PR.Level({ playerScreenX: cfg.PLAYER_SCREEN_X });
    this.state = STATE.MENU;
    this.menuCam = 0;
    this.shake = 0;
    this.time = 0;
    this.lastT = 0;
    this.bestMeters = this._loadBest();
    this.bestScore = this._loadBestScore();
    this.score = 0;
    this._lastMeters = 0;
    this.floatTexts = [];        // 拾取/加分漂浮字
    this._lungeT = cfg.DOG_LUNGE_INTERVAL_START;  // 下次猛扑倒计时
    this._stickSwingT = 0;       // 挥棒动画剩余
    this._probeT = 0;
    this._lastProbeState = null;
    this._stateEnteredAt = Date.now();
    this._running = false;
    this._dbgPrevGrounded = true;
    this._dbgPrevPedaling = false;
    this._dbgMaxAirY = 0;
    this._dbgPedalLogT = 0;
    this.barkTexts = [];          // 漂浮的"汪汪汪"字
    this._barkT = 0;              // 狗吠节拍计时
    this._dogFirstBark = false;   // 狗进入视野后的第一声
    this._deathT = 0;             // 被咬死亡动画计时
    this._deathSeq = 0;           // 死亡序列 id，用于取消过期的 setTimeout
    this._bindLoop();
  };

  // 把 canvas 物理分辨率设为 逻辑尺寸 * DPR，并让 ctx 以逻辑坐标绘制。
  PR.Game.prototype._applyViewport = function () {
    var dpr = this.dpr || 1;
    try {
      this.canvas.width = Math.max(1, Math.floor(this.viewW * dpr));
      this.canvas.height = Math.max(1, Math.floor(this.viewH * dpr));
    } catch (e) {}
    var ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;
  };

  PR.Game.prototype.resize = function (viewW, viewH, dpr, safeArea) {
    if (viewW) this.viewW = viewW;
    if (viewH) this.viewH = viewH;
    if (dpr) this.dpr = dpr;
    if (safeArea) this.safeArea = safeArea;
    this._applyViewport();
  };

  PR.Game.prototype.pause = function () { this.paused = true; };
  PR.Game.prototype.resume = function () { this.paused = false; this.lastT = 0; };

  PR.Game.prototype._sfx = function (name) {
    try { if (PR.audio && PR.audio.play) PR.audio.play(name); } catch (e) {}
  };

  PR.Game.prototype._loadBest = function () {
    try {
      var v = null;
      if (typeof tt !== 'undefined' && tt.getStorageSync) v = tt.getStorageSync('pr_best_meters');
      else if (typeof localStorage !== 'undefined') v = localStorage.getItem('pr_best_meters');
      var n = parseInt(v, 10);
      return isNaN(n) ? 0 : n;
    } catch (e) { return 0; }
  };

  PR.Game.prototype._saveBest = function () {
    try {
      var v = String(this.bestMeters);
      if (typeof tt !== 'undefined' && tt.setStorageSync) tt.setStorageSync('pr_best_meters', v);
      else if (typeof localStorage !== 'undefined') localStorage.setItem('pr_best_meters', v);
    } catch (e) {}
  };

  PR.Game.prototype._loadBestScore = function () {
    try {
      var v = null;
      if (typeof tt !== 'undefined' && tt.getStorageSync) v = tt.getStorageSync('pr_best_score');
      else if (typeof localStorage !== 'undefined') v = localStorage.getItem('pr_best_score');
      var n = parseInt(v, 10);
      return isNaN(n) ? 0 : n;
    } catch (e) { return 0; }
  };
  PR.Game.prototype._saveBestScore = function () {
    try {
      var v = String(this.bestScore);
      if (typeof tt !== 'undefined' && tt.setStorageSync) tt.setStorageSync('pr_best_score', v);
      else if (typeof localStorage !== 'undefined') localStorage.setItem('pr_best_score', v);
    } catch (e) {}
  };

  // 计算 buffer 矩形相对屏幕安全区的内缩边距，避免 HUD/面板被刘海/状态栏遮挡。
  PR.Game.prototype._safeInsets = function (ox, oy, dw, dh) {
    var sa = this.safeArea || {};
    var l = sa.left != null ? sa.left : 0;
    var t = sa.top != null ? sa.top : 0;
    var r = sa.right != null ? sa.right : this.viewW;
    var b = sa.bottom != null ? sa.bottom : this.viewH;
    return {
      l: Math.max(0, l - ox),
      t: Math.max(0, t - oy),
      r: Math.max(0, (ox + dw) - r),
      b: Math.max(0, (oy + dh) - b)
    };
  };

  // 调试状态探针：状态变化时必打一条；PLAYING 期间每 0.5s 打一条。
  // MENU/GAMEOVER/WIN 待机不周期打点，避免刷屏冲掉控制台历史里的事件证据。
  PR.Game.prototype._emitProbe = function (dt) {
    var changed = this._lastProbeState !== this.state;
    if (changed) {
      this._probeT = 0;
      this._lastProbeState = this.state;
      this._logProbe();
      return;
    }
    if (this.state === STATE.PLAYING) {
      this._probeT += dt;
      if (this._probeT >= 0.5) {
        this._probeT = 0;
        this._logProbe();
      }
    }
  };

  PR.Game.prototype._logProbe = function () {
    var snap = {
      state: this.state,
      worldX: Math.round(this.player.worldX),
      gap: Math.round(this.gap || 0),
      stamina: Math.round(this.player.stamina),
      grounded: !!this.player.grounded,
      y: Math.round(this.player.y),
      dtMs: Math.round((this._lastDt || 0) * 1000),
      gt: Math.round(this.time * 10) / 10
    };
    try { console.log('[PR-State] ' + JSON.stringify(snap)); } catch (e) {}
  };

  PR.Game.prototype._bindLoop = function () {
    var self = this;
    this._loop = function () {
      if (!self._running) return;   // 已被停止（如重载时被新实例取代）则不再调度
      // 用系统真实时钟 Date.now() 计算 dt：抖音小游戏 rAF 回调频率远高于 60fps，
      // 且其 performance.now()/回调时间戳都是被加速的合成时钟，会导致游戏时间超速。
      // Date.now() 读取系统真实时间，能保证游戏速度与真实时间一致。
      var now = Date.now();
      if (!self.lastT) self.lastT = now;
      var dt = (now - self.lastT) / 1000;
      self.lastT = now;
      if (dt > 0.05) dt = 0.05;   // 切后台回来防止大跳
      if (dt < 0) dt = 0;
      self._lastDt = dt;
      self.time += dt;
      self.update(dt);
      self._emitProbe(dt);
      self.render();
      PR.raf(self._loop);
    };
  };

  PR.Game.prototype.start = function () {
    if (this._running) return;
    // 单例：重载时旧实例的 rAF 循环可能仍在跑，先停掉上一个，保证全局只有一个循环
    if (typeof globalThis !== 'undefined' && globalThis.__PR_stopLoop) {
      try { globalThis.__PR_stopLoop(); } catch (e) {}
    }
    var self = this;
    this._running = true;
    if (typeof globalThis !== 'undefined') {
      globalThis.__PR_stopLoop = function () { self._running = false; };
    }
    PR.raf(this._loop);
  };

  PR.Game.prototype.startGame = function () {
    PR.input.reset();
    this.player.reset();
    this.dog.reset();
    this.level.reset();
    this.shake = 0;
    this._dbgPrevGrounded = true;
    this._dbgPrevPedaling = false;
    this._dbgMaxAirY = 0;
    this._dbgPedalLogT = 0;
    this._pedalSfxT = 0;
    this.barkTexts = [];
    this._barkT = 0;
    this._dogFirstBark = false;
    this._deathT = 0;
    this.score = 0;
    this._lastMeters = 0;
    this.floatTexts = [];
    this._lungeT = cfg.DOG_LUNGE_INTERVAL_START;
    this._stickSwingT = 0;
    this.state = STATE.PLAYING;
    this._stateEnteredAt = Date.now();
    this._sfx('start');
  };

  PR.Game.prototype.update = function (dt) {
    if (this.paused) return;   // 切后台：冻结更新，但仍渲染静止帧
    if (this.shake > 0) this.shake -= dt;   // 屏幕震动在所有状态下衰减（含死亡定格）
    if (this.state === STATE.MENU) {
      this.menuCam += 50 * dt;
      this.bg.update(dt);
      if (PR.input.consumeAny(this._stateEnteredAt)) this.startGame();
      return;
    }
    if (this.state === STATE.GAMEOVER || this.state === STATE.WIN) {
      // 被咬死亡动画在前 ~1.6 秒播放
      if (this.state === STATE.GAMEOVER && this._deathT < 2) this._deathT += dt;
      if (PR.input.consumeAny(this._stateEnteredAt)) {
        this.state = STATE.MENU;
        this._stateEnteredAt = Date.now();
        PR.input.reset();
      }
      return;
    }
    // PLAYING
    this.player.update(dt, PR.input);
    this._updateDogBreed();
    this.dog.update(dt);
    this.dog.worldX += this._dogSpeed() * dt;
    this.level.update(this.player, dt);

    // 里程积分
    var meters = Math.floor(this.player.worldX);
    if (meters > this._lastMeters) {
      this.score += (meters - this._lastMeters) * cfg.SCORE_PER_METER;
      this._lastMeters = meters;
    }

    // 野狗距离
    var gap = this.player.worldX - this.dog.worldX;
    if (gap > cfg.DOG_GAP_MAX) { gap = cfg.DOG_GAP_MAX; this.dog.worldX = this.player.worldX - gap; }
    this.gap = gap;

    // 消费关卡事件（拾取道具 / 成功跳过石头）—— 在距离 clamp 之后，
    // 这样打狗棒的击退不会被本帧的 gap 上限抵消。
    var evs = this.level.drainEvents();
    for (var ei = 0; ei < evs.length; ei++) this._handleEvent(evs[ei]);

    // 狗吠：狗进入视野后开始叫，越近叫得越频繁，同时冒出"汪汪汪"漂浮字
    if (gap < 170) {
      if (!this._dogFirstBark) { this._dogFirstBark = true; this._spawnBark(); }
      var interval = Math.max(0.35, Math.min(0.95, gap / 200));
      this._barkT += dt;
      if (this._barkT >= interval) { this._barkT = 0; this._spawnBark(); }
    }
    // 更新漂浮字（淡出、上飘）
    for (var bi = this.barkTexts.length - 1; bi >= 0; bi--) {
      var bt = this.barkTexts[bi];
      bt.life += dt; bt.y += bt.vy; bt.x += bt.vx;
      if (bt.life >= bt.max) this.barkTexts.splice(bi, 1);
    }

    // 猛扑：间隔随里程缩短；狗被眩晕时不触发
    if (this.dog.stunT <= 0) {
      this._lungeT -= dt;
      if (this._lungeT <= 0) {
        this.dog.lungeT = cfg.DOG_LUNGE_DURATION;
        this._sfx('growl');
        var lprog = Math.min(1, this.player.worldX / cfg.LEVEL_LENGTH);
        this._lungeT = cfg.DOG_LUNGE_INTERVAL_START -
          (cfg.DOG_LUNGE_INTERVAL_START - cfg.DOG_LUNGE_INTERVAL_MIN) * lprog;
      }
    }
    // 挥棒动画计时
    if (this._stickSwingT > 0) this._stickSwingT -= dt;
    // 拾取/加分漂浮字
    for (var fi = this.floatTexts.length - 1; fi >= 0; fi--) {
      var f = this.floatTexts[fi];
      f.life += dt; f.y += f.vy;
      if (f.life >= f.max) this.floatTexts.splice(fi, 1);
    }

    // 调试事件日志（跳跃/蹬车）：写入控制台历史，供自动化验证取证（不受读取延迟影响）
    if (!this.player.grounded) {
      if (this.player.y > this._dbgMaxAirY) this._dbgMaxAirY = this.player.y;
    }
    if (this._dbgPrevGrounded && !this.player.grounded) {
      try { console.log('[PR-Jump] takeoff worldX=' + Math.round(this.player.worldX)); } catch (e) {}
      this._sfx('jump');
    }
    if (!this._dbgPrevGrounded && this.player.grounded && this._dbgMaxAirY > 0) {
      try { console.log('[PR-Jump] landed maxY=' + Math.round(this._dbgMaxAirY) + ' worldX=' + Math.round(this.player.worldX)); } catch (e) {}
      this._dbgMaxAirY = 0;
    }
    this._dbgPrevGrounded = this.player.grounded;
    if (this.player.pedaling) {
      this._dbgPedalLogT += dt;
      if (!this._dbgPrevPedaling || this._dbgPedalLogT >= 0.5) {
        this._dbgPedalLogT = 0;
        try { console.log('[PR-Pedal] stamina=' + Math.round(this.player.stamina) + ' gap=' + Math.round(this.gap) + ' worldX=' + Math.round(this.player.worldX)); } catch (e) {}
      }
    } else {
      this._dbgPedalLogT = 0;
    }
    this._dbgPrevPedaling = this.player.pedaling;

    // 蹬车音效节拍（按住时周期性触发）
    if (this.player.pedaling) {
      this._pedalSfxT += dt;
      if (this._pedalSfxT >= 0.16) { this._pedalSfxT = 0; this._sfx('pedal'); }
    } else {
      this._pedalSfxT = 0;
    }

    // 撞击：减速 + 狗逼近
    if (this.level.checkCollision(this.player)) {
      this.dog.worldX += 55;   // 狗拉近一截
      this.shake = 0.25;
      this._sfx('hit');
    }

    this.bg.update(dt);

    if (this.gap <= cfg.DOG_GAP_MIN) {
      // 狗贴到骑手身上，定格"被咬"画面 + 震屏 + 咬杀音效 + 一串爆发的"汪汪汪"
      this.gap = 6;
      this.dog.worldX = this.player.worldX - 6;
      this.shake = 0.6;
      this.state = STATE.GAMEOVER;
      this._stateEnteredAt = Date.now();
      this._deathT = 0;
      this._deathSeq++;
      this.bestMeters = Math.max(this.bestMeters, Math.floor(this.player.worldX));
      this._saveBest();
      this.bestScore = Math.max(this.bestScore, this.score);
      this._saveBestScore();
      this._sfx('bite');
      this._sfx('lose');
      var self = this, seq = this._deathSeq;
      for (var k = 0; k < 5; k++) {
        (function (d) { setTimeout(function () { if (self._deathSeq === seq) self._spawnBark(); }, d); })(k * 90);
      }
    } else if (this.level.finished) {
      this.state = STATE.WIN;
      this._stateEnteredAt = Date.now();
      this.bestMeters = Math.max(this.bestMeters, cfg.LEVEL_LENGTH);
      this._saveBest();
      this.bestScore = Math.max(this.bestScore, this.score);
      this._saveBestScore();
      this._sfx('win');
    }
  };

  PR.Game.prototype.render = function () {
    var ctx = this.ctx, bctx = this.bctx;
    // 用逻辑视口尺寸（CSS 像素）布局；canvas 物理像素已由 _applyViewport 按 DPR 设置，
    // ctx 已缩放 DPR，所以这里所有坐标都是逻辑坐标。
    var sw = this.viewW || cfg.BUFFER_W;
    var sh = this.viewH || cfg.BUFFER_H;

    // 清屏（黑边letterbox）
    ctx.fillStyle = '#0b0d17';
    ctx.fillRect(0, 0, sw, sh);
    bctx.clearRect(0, 0, cfg.BUFFER_W, cfg.BUFFER_H);

    var camX = (this.state === STATE.MENU) ? this.menuCam : this.player.worldX;

    // 背景
    this.bg.draw(bctx, camX);

    if (this.state === STATE.MENU) {
      // 菜单：静态骑行者（车轮慢转）+ 标题由主画布叠加
      this.player.draw(bctx, cfg.PLAYER_SCREEN_X, cfg.GROUND_Y);
    } else {
      // 障碍
      this.level.draw(bctx, this.player);
      // 野狗（屏幕左侧追入）
      var dogSX = cfg.PLAYER_SCREEN_X - Math.round(this.gap);
      if (dogSX > -45) this.dog.draw(bctx, dogSX, cfg.GROUND_Y, this.gap);
      // 骑行者
      this.player.draw(bctx, cfg.PLAYER_SCREEN_X, cfg.GROUND_Y);
      if (this._stickSwingT > 0) this.drawStickSwing(bctx);
      // "汪汪汪"漂浮字
      this.drawBarkTexts(bctx);
      // 拾取/加分漂浮字
      this.drawFloatTexts(bctx);
    }

    // 屏幕震动偏移
    var sx = 0, sy = 0;
    if (this.shake > 0) {
      var s = this.shake * 6;
      sx = (Math.random() * 2 - 1) * s;
      sy = (Math.random() * 2 - 1) * s;
    }

    // 放大到主画布（整数缩放，保持像素锐利）
    var scale = Math.max(1, Math.floor(Math.min(sw / cfg.BUFFER_W, sh / cfg.BUFFER_H)));
    var dw = cfg.BUFFER_W * scale, dh = cfg.BUFFER_H * scale;
    var ox = Math.floor((sw - dw) / 2) + sx;
    var oy = Math.floor((sh - dh) / 2) + sy;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.buffer, 0, 0, cfg.BUFFER_W, cfg.BUFFER_H, ox, oy, dw, dh);

    // 像素外框
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(ox - 1, oy - 1, dw + 2, dh + 2);

    // 触屏按下反馈（PLAYING 时，左右区域高亮）
    this.drawTouchFeedback(ctx, ox, oy, dw, dh);

    // HUD（ crisp 文本，画在主画布）
    this.drawHUD(ctx, ox, oy, dw, dh, scale);

    // 覆盖层
    if (this.state === STATE.MENU) this.drawMenu(ctx, ox, oy, dw, dh, scale);
    else if (this.state === STATE.GAMEOVER) this.drawGameOver(ctx, ox, oy, dw, dh, scale);
    else if (this.state === STATE.WIN) this.drawWin(ctx, ox, oy, dw, dh, scale);
  };

  // 触屏视觉反馈：左半屏按下→蓝色高亮+跳跃图标，右半屏按住→橙色高亮+蹬车图标。
  PR.Game.prototype.drawTouchFeedback = function (ctx, ox, oy, dw, dh) {
    if (this.state !== STATE.PLAYING) return;
    var leftHeld = false, rightHeld = false;
    try {
      leftHeld = PR.input.isJumpHeld();
      rightHeld = PR.input.isPedalHeld();
    } catch (e) {}
    var split = ox + dw * 0.45;
    ctx.save();
    if (leftHeld) {
      ctx.fillStyle = 'rgba(120,200,255,0.22)';
      ctx.fillRect(ox, oy, split - ox, dh);
      ctx.fillStyle = 'rgba(210,240,255,0.95)';
      ctx.font = 'bold ' + Math.round(22 * (dw / cfg.BUFFER_W)) + 'px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('↑', ox + (split - ox) / 2, oy + dh / 2);
    }
    if (rightHeld) {
      ctx.fillStyle = 'rgba(255,200,120,0.22)';
      ctx.fillRect(split, oy, ox + dw - split, dh);
      ctx.fillStyle = 'rgba(255,235,180,0.95)';
      ctx.font = 'bold ' + Math.round(22 * (dw / cfg.BUFFER_W)) + 'px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('»', split + (ox + dw - split) / 2, oy + dh / 2);
    }
    // 左右区分隔细线（淡）
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(split + 0.5, oy); ctx.lineTo(split + 0.5, oy + dh); ctx.stroke();
    ctx.restore();
  };

  PR.Game.prototype.drawHUD = function (ctx, ox, oy, dw, dh, scale) {
    if (this.state !== STATE.PLAYING) return;
    var pad = 6 * scale;
    // 安全区内缩：buffer 矩形若侵入刘海/状态栏区域，把内容往里推
    var ins = this._safeInsets(ox, oy, dw, dh);
    var padL = Math.max(pad, ins.l);
    var padT = Math.max(pad, ins.t);
    var padR = Math.max(pad, ins.r);
    var x = ox + padL, y = oy + padT;

    // 进度条（顶部）
    var pw = dw - padL - padR, ph = 6 * scale;
    ctx.fillStyle = C.hudBg;
    ctx.fillRect(x, y, pw, ph);
    var prog = this.level.progress(this.player);
    ctx.fillStyle = '#ffd56b';
    ctx.fillRect(x, y, Math.max(ph, pw * prog), ph);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, pw - 1, ph - 1);

    // 里程 / 关卡名
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + Math.round(11 * scale) + 'px monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText('DAY 1 · 被野狗追   大理→拉萨', x, y + ph + 4 * scale);

    var meters = Math.floor(this.player.worldX);
    ctx.textAlign = 'right';
    ctx.fillText(meters + 'm / ' + cfg.LEVEL_LENGTH + 'm', ox + dw - padR, y + ph + 4 * scale);

    // 体力条（左上第二条）
    var by = y + ph + 22 * scale;
    var bw = 90 * scale, bh = 8 * scale;
    ctx.fillStyle = C.hudBg;
    ctx.fillRect(x, by, bw, bh);
    var ratio = this.player.stamina / cfg.STAMINA_MAX;
    ctx.fillStyle = ratio > 0.3 ? '#5fd35f' : '#e63946';
    ctx.fillRect(x, by, bw * ratio, bh);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeRect(x + 0.5, by + 0.5, bw - 1, bh - 1);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + Math.round(9 * scale) + 'px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('体力', x, by + bh + 2 * scale);

    // 分数 / 最佳（左下第三行）
    var sy = by + bh + 14 * scale;
    ctx.font = 'bold ' + Math.round(10 * scale) + 'px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd56b';
    ctx.fillText('分数 ' + this.score, x, sy);
    ctx.fillStyle = '#9ad8ff';
    ctx.fillText('最佳 ' + this.bestScore, x + 74 * scale, sy);

    // 野狗距离警示（右上）
    var gapTxt = Math.round(this.gap) + 'm';
    var danger = this.gap < 70;
    ctx.font = 'bold ' + Math.round(13 * scale) + 'px monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = danger ? '#ff4d4d' : '#fff';
    ctx.fillText(this.dog.label() + ' ' + gapTxt, ox + dw - pad, by);
    // 猛扑中：距离字变红 + "!" 警示
    if (this.dog.lungeT > 0) {
      ctx.fillStyle = '#ff4d4d';
      ctx.fillText(this.dog.label() + ' 猛扑！' + gapTxt, ox + dw - pad, by);
    }
    if (danger) {
      // 红色警示闪烁边
      if (Math.floor(this.time * 6) % 2 === 0) {
        ctx.strokeStyle = 'rgba(255,60,60,0.8)';
        ctx.lineWidth = 3;
        ctx.strokeRect(ox + 1, oy + 1, dw - 2, dh - 2);
      }
    }

    // 操作提示（底部，仅前几秒）
    if (this.player.worldX < 260) {
      ctx.font = 'bold ' + Math.round(9 * scale) + 'px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText('左屏=跳跃  右屏=蹬车 · 吃金币 捡打狗棒击退野狗', ox + dw / 2, oy + dh - 14 * scale);
    }
  };

  PR.Game.prototype.panel = function (ctx, ox, oy, dw, dh) {
    ctx.fillStyle = 'rgba(8,10,22,0.78)';
    ctx.fillRect(ox, oy, dw, dh);
    ctx.strokeStyle = '#ffd56b';
    ctx.lineWidth = 2;
    ctx.strokeRect(ox + 2, oy + 2, dw - 4, dh - 4);
  };

  PR.Game.prototype.drawMenu = function (ctx, ox, oy, dw, dh, scale) {
    this.panel(ctx, ox, oy, dw, dh);
    var ins = this._safeInsets(ox, oy, dw, dh);
    oy = oy + ins.t; dh = dh - ins.t - ins.b;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var cx = ox + dw / 2;
    ctx.fillStyle = '#ffd56b';
    ctx.font = 'bold ' + Math.round(26 * scale) + 'px monospace';
    ctx.fillText('像素骑行', cx, oy + dh * 0.28);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + Math.round(13 * scale) + 'px monospace';
    ctx.fillText('滇藏线 · 大理 → 拉萨', cx, oy + dh * 0.40);
    ctx.fillStyle = '#9ad8ff';
    ctx.font = 'bold ' + Math.round(11 * scale) + 'px monospace';
    ctx.fillText('DAY 1  被野狗追', cx, oy + dh * 0.50);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + Math.round(10 * scale) + 'px monospace';
    ctx.fillText('金币积分 · 体力回能 · 打狗棒击退野狗', cx, oy + dh * 0.58);
    ctx.fillText('跳过石头躲狗，越往后狗越凶', cx, oy + dh * 0.64);
    ctx.fillText('左侧屏幕 = 跳跃      右侧屏幕 = 蹬车', cx, oy + dh * 0.70);
    if (Math.floor(this.time * 2) % 2 === 0) {
      ctx.fillStyle = '#ffd56b';
      ctx.font = 'bold ' + Math.round(14 * scale) + 'px monospace';
      ctx.fillText('点击屏幕开始', cx, oy + dh * 0.80);
    }
  };

  // 随里程切换狗的品种：普通黄狗 → 恶犬(黑) → 灰狼
  PR.Game.prototype._updateDogBreed = function () {
    var want = this.player.worldX >= cfg.DOG_BREED_WOLF_AT ? 'wolf'
      : this.player.worldX >= cfg.DOG_BREED_BLACK_AT ? 'black' : 'normal';
    if (want !== this.dog.breed) {
      this.dog.breed = want;
      this.dog.morphFlash = 0.5;
      this.shake = 0.22;
      this._sfx('growl');
      this._spawnFloat('狗进化了！', 72, cfg.GROUND_Y - 32, '#ff4d4d');
    }
  };

  // 当前帧狗的追击速度：品种基线 + 里程提速，猛扑 / 眩晕修正
  PR.Game.prototype._dogSpeed = function () {
    var base = this.dog.breed === 'wolf' ? cfg.DOG_SPEED_WOLF
      : this.dog.breed === 'black' ? cfg.DOG_SPEED_BLACK : cfg.DOG_SPEED;
    var sp = base + this.player.worldX * cfg.DOG_SPEED_RAMP;
    sp = Math.min(sp, cfg.DOG_SPEED_CAP);
    if (this.dog.lungeT > 0) sp *= cfg.DOG_LUNGE_SPEED_MULT;
    if (this.dog.stunT > 0) sp *= cfg.DOG_STUN_SPEED_MULT;
    return sp;
  };

  // 处理关卡事件：拾取道具 / 成功跳过石头
  PR.Game.prototype._handleEvent = function (ev) {
    if (ev.type === 'clearRock') {
      this.score += cfg.SCORE_CLEAR_ROCK;
      this._spawnFloat('+' + cfg.SCORE_CLEAR_ROCK, cfg.PLAYER_SCREEN_X, cfg.GROUND_Y - 34, '#9ad8ff');
      return;
    }
    if (ev.type !== 'pickup') return;
    if (ev.item === 'coin') {
      this.score += cfg.SCORE_COIN;
      this._sfx('coin');
      this._spawnFloat('+' + cfg.SCORE_COIN, cfg.PLAYER_SCREEN_X + 6, cfg.GROUND_Y - 28, '#ffd56b');
    } else if (ev.item === 'stamina') {
      this.player.stamina = Math.min(cfg.STAMINA_MAX, this.player.stamina + cfg.STAMINA_RESTORE);
      this.score += cfg.SCORE_STAMINA;
      this._sfx('pickup');
      this._spawnFloat('+' + cfg.STAMINA_RESTORE + ' 体力', cfg.PLAYER_SCREEN_X + 6, cfg.GROUND_Y - 32, '#5fd35f');
    } else if (ev.item === 'stick') {
      this.dog.worldX -= cfg.STICK_KNOCKBACK;
      this.dog.stunT = cfg.STICK_STUN;
      this._stickSwingT = 0.25;
      this.score += cfg.SCORE_STICK;
      this.shake = 0.18;
      this._sfx('whoosh');
      this._sfx('yelp');
      this._spawnFloat('打狗棒！击退', cfg.PLAYER_SCREEN_X + 12, cfg.GROUND_Y - 34, '#ff9f43');
    }
  };

  // 产生一个拾取/加分漂浮字（buffer 坐标系）
  PR.Game.prototype._spawnFloat = function (text, x, y, color) {
    this.floatTexts.push({ x: x, y: y, text: text, color: color || '#fff', life: 0, max: 0.9, vy: -0.6 });
  };

  // 绘制拾取/加分漂浮字（低分辨率 buffer，随世界整数放大）
  PR.Game.prototype.drawFloatTexts = function (bctx) {
    for (var i = 0; i < this.floatTexts.length; i++) {
      var f = this.floatTexts[i];
      var k = f.life / f.max;
      var alpha = k < 0.2 ? k / 0.2 : (1 - Math.max(0, (k - 0.5) / 0.5));
      bctx.save();
      bctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      bctx.fillStyle = f.color;
      bctx.font = 'bold 8px monospace';
      bctx.textAlign = 'center'; bctx.textBaseline = 'middle';
      bctx.fillText(f.text, Math.round(f.x), Math.round(f.y));
      bctx.restore();
    }
  };

  // 挥棒动画：骑手前方甩出一根棍子（0.25s）
  PR.Game.prototype.drawStickSwing = function (bctx) {
    var p = 1 - this._stickSwingT / 0.25;
    var cx = cfg.PLAYER_SCREEN_X + 24, cy = cfg.GROUND_Y - 16;
    var a = -0.9 + 1.7 * p;
    var len = 16;
    var x2 = Math.round(cx + Math.cos(a) * len);
    var y2 = Math.round(cy + Math.sin(a) * len);
    PR.gfx.line(bctx, cx, cy, x2, y2, '#d9b27a');
    PR.gfx.line(bctx, cx, cy + 1, x2, y2 + 1, '#a9703a');
    bctx.save();
    bctx.globalAlpha = 0.5;
    PR.gfx.line(bctx, cx, cy - 2, x2, y2 - 2, '#ffffff');
    bctx.restore();
  };

  // 产生一声狗吠：音效 + 在狗嘴边冒出一个漂浮的"汪"字
  PR.Game.prototype._spawnBark = function () {
    this._sfx(Math.random() < 0.5 ? 'bark' : 'barks');
    var dogSX = cfg.PLAYER_SCREEN_X - Math.round(this.gap || 0);
    var pool = ['汪！', '汪！汪！', '汪汪！', '汪！'];
    var t = pool[(Math.random() * pool.length) | 0];
    this.barkTexts.push({
      x: dogSX + 30 + (Math.random() * 10 - 5),
      y: cfg.GROUND_Y - 16 - (Math.random() * 6),
      text: t,
      life: 0, max: 0.75 + Math.random() * 0.25,
      vy: -0.7 - Math.random() * 0.5,
      vx: 0.4 - Math.random() * 0.8
    });
  };

  // 绘制漂浮的"汪汪汪"（画在低分辨率 buffer 上，随世界一起整数放大）
  PR.Game.prototype.drawBarkTexts = function (bctx) {
    for (var i = 0; i < this.barkTexts.length; i++) {
      var b = this.barkTexts[i];
      var k = b.life / b.max;
      var alpha = k < 0.15 ? k / 0.15 : (1 - Math.max(0, (k - 0.55) / 0.45));
      var sz = 10 + (k < 0.25 ? (k / 0.25) * 5 : 5);
      bctx.save();
      bctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      bctx.fillStyle = '#ff4d4d';
      bctx.font = 'bold ' + Math.round(sz) + 'px monospace';
      bctx.textAlign = 'center';
      bctx.textBaseline = 'middle';
      bctx.fillText(b.text, Math.round(b.x), Math.round(b.y));
      bctx.restore();
    }
  };

  // 被咬瞬间的死亡画面：血红闪烁 + 满屏爆发的"汪！汪！汪！" + 惨叫
  PR.Game.prototype.drawDeathIntro = function (ctx, ox, oy, dw, dh, scale) {
    var t = this._deathT;
    var cx = ox + dw / 2, cy = oy + dh / 2;
    var flash = Math.max(0, 1 - t / 0.5);          // 前 0.5s 血红强闪
    ctx.fillStyle = 'rgba(140,10,15,' + (0.32 + flash * 0.4) + ')';
    ctx.fillRect(ox, oy, dw, dh);

    var barks = ['汪！', '汪！', '汪！', '汪！汪！', '汪！', '汪！'];
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var i = 0; i < barks.length; i++) {
      var ang = -Math.PI / 2 + i * (Math.PI * 2 / barks.length);
      var r = (18 + i * 20) * scale;
      var tx = cx + Math.cos(ang) * r;
      var ty = cy + Math.sin(ang) * r * 0.5;
      var appear = Math.min(1, t * 3 - i * 0.06);
      var fade = 1 - Math.max(0, (t - 0.6) / 1.0);
      ctx.globalAlpha = Math.max(0, Math.min(1, appear)) * Math.max(0, fade);
      ctx.fillStyle = i % 2 ? '#ffd56b' : '#ff4d4d';
      ctx.font = 'bold ' + Math.round((16 + i * 3) * scale) + 'px monospace';
      ctx.fillText(barks[i], tx, ty);
    }
    ctx.globalAlpha = 1;
    if (t > 0.35) {
      ctx.globalAlpha = Math.min(1, (t - 0.35) * 3);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold ' + Math.round(22 * scale) + 'px monospace';
      ctx.fillText('啊——！', cx, oy + dh * 0.78);
      ctx.globalAlpha = 1;
    }
  };

  PR.Game.prototype.drawGameOver = function (ctx, ox, oy, dw, dh, scale) {
    if (this._deathT < 1.6) { this.drawDeathIntro(ctx, ox, oy, dw, dh, scale); return; }
    this.panel(ctx, ox, oy, dw, dh);
    var ins = this._safeInsets(ox, oy, dw, dh);
    oy = oy + ins.t; dh = dh - ins.t - ins.b;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var cx = ox + dw / 2;
    ctx.fillStyle = '#ff4d4d';
    ctx.font = 'bold ' + Math.round(24 * scale) + 'px monospace';
    ctx.fillText('被野狗追上了！', cx, oy + dh * 0.34);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + Math.round(12 * scale) + 'px monospace';
    ctx.fillText('坚持骑行了 ' + Math.floor(this.player.worldX) + ' 米', cx, oy + dh * 0.46);
    ctx.fillText('最佳：' + this.bestMeters + ' 米', cx, oy + dh * 0.53);
    ctx.fillStyle = '#ffd56b';
    ctx.fillText('本局得分 ' + this.score, cx, oy + dh * 0.61);
    ctx.fillStyle = '#9ad8ff';
    ctx.fillText('最佳得分 ' + this.bestScore, cx, oy + dh * 0.67);
    if (Math.floor(this.time * 2) % 2 === 0) {
      ctx.fillStyle = '#ffd56b';
      ctx.font = 'bold ' + Math.round(13 * scale) + 'px monospace';
      ctx.fillText('点击屏幕重新挑战', cx, oy + dh * 0.72);
    }
  };

  PR.Game.prototype.drawWin = function (ctx, ox, oy, dw, dh, scale) {
    this.panel(ctx, ox, oy, dw, dh);
    var ins = this._safeInsets(ox, oy, dw, dh);
    oy = oy + ins.t; dh = dh - ins.t - ins.b;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var cx = ox + dw / 2;
    ctx.fillStyle = '#7CFC9A';
    ctx.font = 'bold ' + Math.round(24 * scale) + 'px monospace';
    ctx.fillText('到达今日营地！', cx, oy + dh * 0.32);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + Math.round(12 * scale) + 'px monospace';
    ctx.fillText('成功甩开野狗，完成 Day 1 骑行', cx, oy + dh * 0.44);
    ctx.fillStyle = '#ffd56b';
    ctx.fillText('本局得分 ' + this.score, cx, oy + dh * 0.52);
    ctx.fillStyle = '#9ad8ff';
    ctx.fillText('最佳得分 ' + this.bestScore, cx, oy + dh * 0.58);
    ctx.fillStyle = '#9ad8ff';
    ctx.fillText('DAY 2 · 雪崩  （敬请期待）', cx, oy + dh * 0.66);
    if (Math.floor(this.time * 2) % 2 === 0) {
      ctx.fillStyle = '#ffd56b';
      ctx.font = 'bold ' + Math.round(13 * scale) + 'px monospace';
      ctx.fillText('点击屏幕再来一次', cx, oy + dh * 0.72);
    }
  };
})();
