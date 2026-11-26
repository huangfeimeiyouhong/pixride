// src/game/fx.js
// 镜头与画面特效：震屏、顿帧、慢动作、闪白、危险红边、暗角、黑场过渡、飘字、横幅、天气、速度线。
// 特效用"真实时间"推进（不受顿帧 / 慢动作影响）。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});
  var gfx = PR.gfx, hash2 = gfx.hash2, draw = gfx.draw;

  function Fx(game) {
    this.g = game;
    this.t = 0;
    this.trauma = 0; this.sx = 0; this.sy = 0;
    this.hitstop = 0; this.slowT = 0; this.slowK = 0.35;
    this.flashA = 0; this.flashC = '#ffffff';
    this.texts = [];
    this.banner = null;
    this.danger = 0;
    this.fadeA = 0; this.fading = 0; this.fadeCb = null;     // fading: 1 渐黑, -1 渐亮, 0 停
    this.grads = {};
  }
  var F = Fx.prototype;

  F.update = function (dt) {
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.7);
    var s = this.trauma * this.trauma, T = this.t;
    this.sx = Math.round(s * 14 * (Math.sin(T * 71.3) * 0.6 + Math.sin(T * 37.1 + 1.3) * 0.4));
    this.sy = Math.round(s * 10 * (Math.sin(T * 61.7 + 2.1) * 0.6 + Math.sin(T * 43.3) * 0.4));
    if (this.hitstop > 0) this.hitstop -= dt;
    if (this.slowT > 0) this.slowT -= dt;
    this.flashA = Math.max(0, this.flashA - dt * 3.2);
    for (var i = this.texts.length - 1; i >= 0; i--) {
      var x = this.texts[i]; x.t += dt; x.y += x.vy * dt; x.vy += 70 * dt;
      if (x.t >= x.life) this.texts.splice(i, 1);
    }
    if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.life) this.banner = null; }
    if (this.fading === 1) {
      this.fadeA = Math.min(1, this.fadeA + dt * 2.6);
      if (this.fadeA >= 1) { this.fading = -1; var cb = this.fadeCb; this.fadeCb = null; if (cb) cb(); }
    } else if (this.fading === -1) {
      this.fadeA = Math.max(0, this.fadeA - dt * 2.2);
      if (this.fadeA <= 0) this.fading = 0;
    }
  };
  // 模拟时间倍率：顿帧时为 0，慢动作时为 slowK
  F.scale = function () { return this.hitstop > 0 ? 0 : (this.slowT > 0 ? this.slowK : 1); };

  F.shake = function (a) { this.trauma = Math.min(1, this.trauma + a); };
  F.stop = function (sec) { this.hitstop = Math.max(this.hitstop, sec); };
  F.slowmo = function (sec, k) { this.slowT = Math.max(this.slowT, sec); this.slowK = k || 0.35; };
  F.flash = function (a, c) { this.flashA = Math.max(this.flashA, a); this.flashC = c || '#ffffff'; };
  F.fadeOut = function (cb) { if (this.fading === 1) return; this.fading = 1; this.fadeCb = cb; };
  F.fadeIn = function () { this.fading = -1; this.fadeCb = null; this.fadeA = Math.max(this.fadeA, 0); };
  // 飘字：x 为世界坐标；kind 决定颜色（见 hud 的文本配色）
  F.text = function (x, y, str, kind, big) {
    if (this.texts.length > 18) this.texts.shift();
    this.texts.push({ x: x, y: y, vy: -46, t: 0, life: big ? 1.3 : 0.95, str: str, kind: kind || 'gold', big: big ? 2 : 1, drift: -20 });
  };
  F.banner = null;
  F.say = function (str, sub, life) { this.banner = { str: str, sub: sub || '', t: 0, life: life || 1.7 }; };
  F.clear = function () { this.texts.length = 0; this.banner = null; this.trauma = 0; this.hitstop = 0; this.slowT = 0; this.flashA = 0; this.danger = 0; };

  // ---------------- 叠加层（屏幕空间，缓冲区坐标） ----------------
  F.grad = function (ctx, key, W, H, inner, outer, rgb) {
    var gr = this.grads[key];
    if (!gr || this.grads[key + 'w'] !== W || this.grads[key + 'h'] !== H) {
      var cx = W / 2, cy = H / 2, R = Math.sqrt(cx * cx + cy * cy);
      gr = ctx.createRadialGradient(cx, cy, R * inner, cx, cy, R * outer);
      gr.addColorStop(0, 'rgba(' + rgb + ',0)'); gr.addColorStop(1, 'rgba(' + rgb + ',1)');
      this.grads[key] = gr; this.grads[key + 'w'] = W; this.grads[key + 'h'] = H;
    }
    return gr;
  };
  F.overlay = function (ctx, W, H, opts) {
    var night = opts.night || 0;
    if (night > 0) { ctx.globalAlpha = night; ctx.fillStyle = this.grad(ctx, 'vig', W, H, 0.45, 1.05, '6,10,30'); ctx.fillRect(0, 0, W, H); }
    if (this.danger > 0.01) { ctx.globalAlpha = Math.min(1, this.danger); ctx.fillStyle = this.grad(ctx, 'dng', W, H, 0.5, 1.0, '170,20,20'); ctx.fillRect(0, 0, W, H); }
    ctx.globalAlpha = 1;
    if (this.flashA > 0.01) { ctx.globalAlpha = Math.min(1, this.flashA); ctx.fillStyle = this.flashC; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    if (this.fadeA > 0.001) { ctx.globalAlpha = this.fadeA; ctx.fillStyle = '#070910'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  };

  // 速度线：k ∈ (0,1]，越大越密
  F.speedLines = function (ctx, W, H, k, t) {
    if (k <= 0.02) return;
    ctx.fillStyle = '#ffffff';
    for (var i = 0; i < 9; i++) {
      if (hash2(i, 88) > k * 1.1) continue;
      var y = 20 + hash2(i, 89) * (H - 70), len = 30 + hash2(i, 90) * 70;
      var x = W + 40 - ((t * 1500 * (0.7 + hash2(i, 91) * 0.6) + hash2(i, 92) * W * 2) % (W + 160));
      ctx.globalAlpha = 0.1 + k * 0.2;
      ctx.fillRect(x | 0, y | 0, len | 0, 1);
    }
    ctx.globalAlpha = 1;
  };

  // 天气：雨 / 雪 / 落叶 / 花瓣。位置由哈希确定，不产生对象
  F.weather = function (ctx, camX, W, H, t, kind, n) {
    if (!kind) return;
    var i, x, y, sp;
    if (kind === 'rain') {
      ctx.strokeStyle = 'rgba(205,228,255,0.45)'; ctx.lineWidth = 1; ctx.beginPath();
      for (i = 0; i < n; i++) {
        sp = 520 + hash2(i, 5) * 260;
        x = (((hash2(i, 1) * (W + 200) - camX * 0.35 - t * 110) % (W + 200)) + W + 200) % (W + 200) - 100;
        y = ((hash2(i, 2) * (H + 60) + t * sp) % (H + 60)) - 30;
        ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 13);
      }
      ctx.stroke();
    } else if (kind === 'snow') {
      ctx.fillStyle = '#ffffff';
      for (i = 0; i < n; i++) {
        sp = 26 + hash2(i, 3) * 44;
        x = ((((hash2(i, 1) * (W + 40) - camX * 0.22 + Math.sin(t * 0.9 + i * 1.7) * 16 - t * 12) % (W + 40)) + W + 40) % (W + 40)) - 20;
        y = ((hash2(i, 2) * (H + 40) + t * sp) % (H + 40)) - 20;
        ctx.globalAlpha = 0.45 + hash2(i, 4) * 0.55;
        ctx.fillRect(x | 0, y | 0, hash2(i, 6) > 0.75 ? 2 : 1, hash2(i, 7) > 0.75 ? 2 : 1);
      }
      ctx.globalAlpha = 1;
    } else {
      var fr = PR.sprites.props[kind === 'leaf' ? 'leaf' : 'petal'];
      for (i = 0; i < n; i++) {
        sp = 34 + hash2(i, 3) * 30;
        x = ((((hash2(i, 1) * (W + 60) - camX * 0.5 + Math.sin(t * 1.1 + i * 2.3) * 22 + t * 14) % (W + 60)) + W + 60) % (W + 60)) - 30;
        y = ((hash2(i, 2) * (H + 40) + t * sp + Math.sin(t * 0.7 + i) * 12) % (H + 40)) - 20;
        draw(ctx, fr[((t * 5 + i) | 0) % fr.length], x, y, 0.92);
      }
    }
  };

  // 飘字 + 横幅。纯 ASCII 的飘字用像素字；含中文的用系统字体（描边），在主画布上绘制所以是清晰的
  var FLOAT_C = { gold: '#ffd23f', bad: '#ff8f86', good: '#9cf58f', shield: '#8fe8ff', dim: '#cfe0f5', white: '#ffffff' };
  var NOT_ASCII = /[^\x20-\x7e]/;
  F.drawTexts = function (ctx, camX, hud, W) {
    var i, x, sx, u, a, k;
    for (i = 0; i < this.texts.length; i++) {
      x = this.texts[i];
      u = x.t / x.life; a = u > 0.65 ? (1 - u) / 0.35 : 1;
      k = x.t < 0.12 ? gfx.easeOutBack(x.t / 0.12) : 1;
      sx = x.x - camX + x.drift * u;
      if (sx < -200 || sx > W + 200) continue;
      if (NOT_ASCII.test(x.str)) {
        ctx.save(); ctx.translate(Math.round(sx), Math.round(x.y)); ctx.scale(k, k);
        hud.cn(ctx, x.str, 0, 0, x.big ? 15 : 11, FLOAT_C[x.kind] || x.kind || 'white', 'center', a);
        ctx.restore();
      } else hud.text(ctx, x.str, sx, x.y, { kind: x.kind, size: x.big ? 2 : 1, align: 'center', alpha: a });
    }
    if (this.banner) {
      var b = this.banner, ub = b.t < 0.25 ? gfx.easeOutCubic(b.t / 0.25) : (b.t > b.life - 0.35 ? Math.max(0, (b.life - b.t) / 0.35) : 1);
      var oy = (1 - ub) * -18;
      hud.cn(ctx, b.str, W / 2, this.g.bh * 0.3 + oy, 22, 'title', 'center', ub);
      if (b.sub) hud.cn(ctx, b.sub, W / 2, this.g.bh * 0.3 + 28 + oy, 12, 'sub', 'center', ub);
    }
  };

  PR.Fx = Fx;
})();
