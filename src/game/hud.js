// src/game/hud.js
// 界面绘制工具：3×5 像素字体（数字 / 英文，描边）、中文（系统字体）、面板、按钮、进度条、局内 HUD、教学提示。
// 所有坐标都是"缓冲区坐标"（Game 已把主画布的变换设成：1 单位 = 1 缓冲像素）。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});
  var gfx = PR.gfx, draw = gfx.draw, drawScaled = gfx.drawScaled, clamp = gfx.clamp, hex = gfx.hex;

  var CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ*+-!.:%/#><?,()';
  var GLYPH = {
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001011001111', '4': '101101111001001',
    '5': '111100111001111', '6': '111100111101111', '7': '111001001010010', '8': '111101111101111', '9': '111101111001111',
    'A': '010101111101101', 'B': '110101110101110', 'C': '011100100100011', 'D': '110101101101110', 'E': '111100110100111',
    'F': '111100110100100', 'G': '111100101101111', 'H': '101101111101101', 'I': '111010010010111', 'J': '001001001101010',
    'K': '101101110101101', 'L': '100100100100111', 'M': '101111101101101', 'N': '110101101101101', 'O': '010101101101010',
    'P': '110101110100100', 'Q': '010101101110011', 'R': '110101110101101', 'S': '011100010001110', 'T': '111010010010010',
    'U': '101101101101111', 'V': '101101101101010', 'W': '101101101111101', 'X': '101101010101101', 'Y': '101101010010010',
    'Z': '111001010100111', '*': '000101010101000', '+': '000010111010000', '-': '000000111000000', '!': '010010010000010',
    '.': '000000000000010', ':': '000010000010000', '%': '101001010100101', '/': '001001010100100', '#': '101111101111101',
    '>': '100010001010100', '<': '001010100010001', '?': '111001011000010', ',': '000000000010100', '(': '001010010010001', ')': '100010010010100'
  };
  var KINDS = {
    white: ['#f6f8ff', '#0e1220'], gold: ['#ffd23f', '#4a2a00'], bad: ['#ff5a4e', '#3a0806'], good: ['#7df07a', '#06300e'],
    shield: ['#8fe8ff', '#063040'], dim: ['#b4c0d4', '#0e1220'], ink: ['#1a2234', '#00000000']
  };
  var H = PR.hud = { fonts: {}, rects: {}, onTap: null, cnFont: '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC","Heiti SC",sans-serif' };
  var CN_COLORS = { title: '#fff7d6', sub: '#cfe0f5', gold: '#ffd23f', bad: '#ff8f86', good: '#9cf58f', white: '#ffffff' };

  H.init = function () {
    if (H.fonts.white) return;
    for (var k in KINDS) {
      var w = CHARS.length * 4 + 1, pix = new gfx.Pix(w, 7), i, r, c, idx;
      for (i = 0; i < CHARS.length; i++) {
        var bits = GLYPH[CHARS[i]];
        for (r = 0; r < 5; r++) for (c = 0; c < 3; c++) if (bits.charAt(r * 3 + c) === '1') pix.px(1 + i * 4 + c, 1 + r, hex(KINDS[k][0]));
      }
      var d = pix.d;
      for (var y = 0; y < 7; y++) for (var x = 0; x < w; x++) {               // 四邻域描边
        if (d[y * w + x]) continue;
        var n = (x > 0 && d[y * w + x - 1]) || (x < w - 1 && d[y * w + x + 1]) || (y > 0 && d[(y - 1) * w + x]) || (y < 6 && d[(y + 1) * w + x]);
        if (n) d[y * w + x] = hex(KINDS[k][1]);
      }
      H.fonts[k] = pix.toCanvas();
    }
  };

  H.width = function (str, s) { return str.length * 4 * s - s; };
  H.text = function (ctx, str, x, y, o) {
    o = o || {};
    var s = o.size || 1, img = H.fonts[o.kind || 'white'], w = str.length * 4 * s - s;
    if (o.align === 'center') x -= w / 2; else if (o.align === 'right') x -= w;
    x = Math.round(x); y = Math.round(y);
    var a = ctx.globalAlpha;
    if (o.alpha != null) ctx.globalAlpha = a * o.alpha;
    for (var i = 0; i < str.length; i++) {
      var idx = CHARS.indexOf(str.charAt(i));
      if (idx >= 0) ctx.drawImage(img, idx * 4, 0, 5, 7, x + i * 4 * s, y - s, 5 * s, 7 * s);
    }
    ctx.globalAlpha = a;
  };

  // 中文 / 系统字体文本。size 为缓冲区像素；带描边保证在场景上可读
  // 中文 / 系统字体文字：描边 + 填充。stroke 传 false 表示不描边（用于浅色底上的深色小字）
  H.cn = function (ctx, str, x, y, size, color, align, alpha, weight, stroke) {
    if (!str) return;
    ctx.font = (weight || 'bold') + ' ' + size + 'px ' + H.cnFont;
    ctx.textBaseline = 'middle'; ctx.textAlign = align || 'left';
    var a = ctx.globalAlpha;
    if (alpha != null) ctx.globalAlpha = a * alpha;
    if (stroke !== false) { ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, size * 0.26); ctx.strokeStyle = 'rgba(8,10,18,0.85)'; ctx.strokeText(str, Math.round(x), Math.round(y)); }
    ctx.fillStyle = CN_COLORS[color] || color || '#ffffff';
    ctx.fillText(str, Math.round(x), Math.round(y));
    ctx.globalAlpha = a; ctx.textAlign = 'left';
  };

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  H.rr = rr;

  H.panel = function (ctx, x, y, w, h, o) {
    o = o || {};
    var a = ctx.globalAlpha; if (o.alpha != null) ctx.globalAlpha = a * o.alpha;
    ctx.fillStyle = 'rgba(4,6,14,0.45)'; rr(ctx, x + 3, y + 4, w, h, 10); ctx.fill();
    ctx.fillStyle = o.fill || 'rgba(16,21,36,0.94)'; rr(ctx, x, y, w, h, 10); ctx.fill();
    ctx.strokeStyle = o.border || '#4a5c84'; ctx.lineWidth = 2; rr(ctx, x + 1, y + 1, w - 2, h - 2, 9); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.07)'; rr(ctx, x + 3, y + 3, w - 6, Math.round(h * 0.45), 7); ctx.fill();
    ctx.globalAlpha = a;
  };

  H.bar = function (ctx, x, y, w, h, frac, col, bg) {
    ctx.fillStyle = 'rgba(8,10,18,0.75)'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = bg || '#2a3350'; ctx.fillRect(x, y, w, h);
    var fw = Math.round(w * clamp(frac, 0, 1));
    if (fw > 0) { ctx.fillStyle = col; ctx.fillRect(x, y, fw, h); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(x, y, fw, 1); }
  };

  // 按钮：注册点击区域，点击命中由 Game 在帧末调用 H.hit() 完成
  H.button = function (ctx, id, x, y, w, h, o) {
    o = o || {};
    var pr = H.pressed(id), yy = y + (pr ? 2 : 0), k = o.kind || 'normal';
    var st = { primary: ['#ffc93c', '#7a4f00', '#2a1a00', '#ffe58a'], normal: ['#2b3652', '#8fa3c8', '#eef4ff', '#4a5c84'],
      danger: ['#a8322c', '#ff9a90', '#fff0ee', '#c84a42'], good: ['#2f9a52', '#b8f0b0', '#08301a', '#56c878'] }[k];
    var a = ctx.globalAlpha; if (o.alpha != null) ctx.globalAlpha = a * o.alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; rr(ctx, x, y + 4, w, h, 8); ctx.fill();
    ctx.fillStyle = st[0]; rr(ctx, x, yy, w, h - (pr ? 2 : 0), 8); ctx.fill();
    ctx.fillStyle = st[3]; ctx.fillRect(x + 5, yy + 2, w - 10, 2);
    ctx.strokeStyle = st[1]; ctx.lineWidth = 2; rr(ctx, x + 1, yy + 1, w - 2, h - 2 - (pr ? 2 : 0), 7); ctx.stroke();
    if (o.icon) draw(ctx, o.icon, x + 16, yy + h / 2 + 7, 1);
    if (o.cn) H.cn(ctx, o.cn, x + w / 2, yy + (o.sub ? h / 2 - 8 : h / 2) + 1, o.size || 15, 'white', 'center', 1);
    if (o.sub) {
      if (/[^\x20-\x7e]/.test(o.sub)) H.cn(ctx, o.sub, x + w / 2, yy + h - 12, 11, '#f4f8ff', 'center', 1);
      else H.text(ctx, o.sub, x + w / 2, yy + h - 14, { kind: 'dim', size: 1, align: 'center' });
    }
    ctx.globalAlpha = a;
    H.rects[id] = { x: x, y: y, w: w, h: h };
  };
  H.begin = function () { H.rects = {}; };
  H.pressAt = {};
  H.pressed = function (id) {
    var r = H.rects[id], act = PR.input.active, k;
    if (!r) return false;
    if (H.pressAt[id] && Date.now() - H.pressAt[id] < 110) return true;       // 点击后的短暂按压反馈
    for (k in act) { var p = act[k]; if (!p.ui && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return true; }
    return false;
  };
  // 用本帧的点击命中按钮：返回被点的 id 列表；被命中的点击标记为界面消耗
  H.hit = function () {
    var taps = PR.input.taps, out = [], i, k, r;
    for (i = 0; i < taps.length; i++) {
      var t = taps[i];
      if (t.used) continue;
      for (k in H.rects) {
        r = H.rects[k];
        if (t.x >= r.x && t.x <= r.x + r.w && t.y >= r.y && t.y <= r.y + r.h) { out.push(k); H.pressAt[k] = Date.now(); PR.input.consumeTap(t); break; }
      }
    }
    return out;
  };

  H.stars = function (ctx, x, y, n, size, t) {
    var p = PR.sprites.props, i;
    for (i = 0; i < 3; i++) {
      var on = i < n, pop = on ? gfx.easeOutBack(clamp((t - i * 0.18) / 0.3, 0, 1)) : 1;
      if (pop <= 0.01) continue;
      drawScaled(ctx, p.star[i % 2], x + (i - 1) * size * 1.3, y, size / 15 * pop * (on ? 1 : 0.8), size / 15 * pop * (on ? 1 : 0.8), on ? 1 : 0.28);
    }
  };

  // ---------------- 局内 HUD ----------------
  H.play = function (ctx, g) {
    var W = g.bw, Hh = g.bh, sa = g.safe, p = g.player, lv = g.level, pr = PR.sprites.props, ic = pr.ic, t = g.time;
    var x0 = 12 + sa.l, y0 = 10 + sa.t, xr = W - 12 - sa.r;
    H.begin();
    // 左上：天数 / 地点 + 进度
    if (g.mode === 'journey') {
      H.cn(ctx, '第' + (g.day + 1) + '天 · ' + lv.def.place, x0, y0 + 5, 11, 'sub', 'left');
      var bw = 168, bx = x0, by = y0 + 14, prog = clamp(p.x / lv.endX, 0, 1);
      H.bar(ctx, bx, by, bw, 5, prog, '#ffd23f', '#2a3350');
      drawScaled(ctx, ic.tent, bx + bw, by + 6, 0.6, 0.6, 1);
      var dg = g.dogs[0];                                             // 狗的位置：红色小点
      if (dg && !lv.finished) { var dp = clamp(dg.x / lv.endX, 0, 1); ctx.fillStyle = '#ff5a4e'; ctx.fillRect(Math.round(bx + dp * bw) - 1, by - 2, 3, 9); }
      ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(bx + prog * bw) - 1, by - 3, 3, 11);
    } else {
      H.cn(ctx, '无尽模式', x0, y0 + 5, 11, 'sub', 'left');
      H.text(ctx, (p.x / 10 | 0) + 'M', x0, y0 + 14, { kind: 'white', size: 1 });
    }
    // 右上：金币 / 分数 / 暂停
    draw(ctx, pr.coin[(t * 10 | 0) % 6], xr - 70, y0 + 11, 1);
    H.text(ctx, '' + g.coins, xr, y0 + 1, { kind: 'gold', size: 2, align: 'right' });
    H.text(ctx, '' + g.scoreNow(), xr, y0 + 15, { kind: 'white', size: 2, align: 'right' });
    H.button(ctx, 'pause', W / 2 - 13, y0 - 3, 26, 24, { icon: ic.pause, kind: 'normal' });
    // 左下：体力 + 道具
    var y1 = Hh - 20 - sa.b, st = p.stam / p.stamMax(), warn = st < 0.25 || p.exhaust > 0;
    var scol = st > 0.5 ? '#6fe06a' : (st > 0.25 ? '#ffd23f' : '#ff5a4e');
    if (p.exhaust > 0 && Math.floor(t * 8) % 2 === 0) scol = '#ffffff';
    H.bar(ctx, x0, y1, 112, 7, st, scol, '#2a3350');
    draw(ctx, ic.bolt, x0 - 2, y1 + 9, 1);
    H.cn(ctx, '体力', x0 + 118, y1 + 4, 10, warn ? '#ff8f86' : 'sub', 'left');
    var ix = x0, iy = y1 - 20;
    if (p.sticks > 0) { draw(ctx, ic.stickI, ix, iy + 8, 1); H.text(ctx, '*' + p.sticks, ix + 9, iy, { kind: 'white', size: 1 }); ix += 26; }
    if (p.shield) { draw(ctx, pr.shield, ix + 8, iy + 12, 1); ix += 22; }
    if (p.magnetT > 0) { draw(ctx, pr.magnet, ix + 8, iy + 12, 1); H.bar(ctx, ix, iy + 14, 16, 2, p.magnetT / 8, '#8fe8ff'); ix += 26; }
    if (p.boostT > 0) { draw(ctx, pr.gel, ix + 6, iy + 12, 1); H.bar(ctx, ix, iy + 14, 16, 2, p.boostT / 4, '#ffe08a'); ix += 24; }
    // 连击
    if (p.combo >= 2 && !lv.finished) {
      var pop = 1 + 0.35 * Math.max(0, 1 - (t - g.comboAt) * 6);
      H.text(ctx, p.combo + ' COMBO', W / 2, y0 + 30, { kind: p.combo >= 10 ? 'bad' : (p.combo >= 5 ? 'shield' : 'gold'), size: Math.round(2 * pop), align: 'center' });
      H.bar(ctx, W / 2 - 24, y0 + 48, 48, 2, p.comboT / 3.2, '#ffd23f');
    }
    // 狗在屏幕外：左缘指示器
    var d0 = g.dogs[0];
    if (d0 && !lv.finished) {
      var gap = d0.gap(), sx = d0.x - g.camX;
      if (sx < -80) {
        var yy = g.G - 60 + g.shy;
        ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(t * 5));
        draw(ctx, ic.paw, x0 + 7, yy + 7, 1);
        H.text(ctx, (gap / 10 | 0) + 'M', x0 + 18, yy - 2, { kind: gap < 140 ? 'bad' : 'white', size: 1 });
        ctx.globalAlpha = 1;
      }
    }
  };

  // 教学提示：在屏幕上标出操作区域
  H.hints = function (ctx, g) {
    var hs = g.hints, i, h;
    for (i = 0; i < hs.length; i++) {
      h = hs[i];
      var u = clamp(h.t / 0.3, 0, 1), a = h.life - h.t < 0.4 ? (h.life - h.t) / 0.4 : 1;
      var pulse = 0.5 + 0.5 * Math.sin(h.t * 6), x = h.x * g.bw, y = h.y * g.bh;
      ctx.globalAlpha = a * (h.zone ? 0.12 + pulse * 0.08 : 0.9) * u;
      if (h.zone) {                                                    // 半屏区域高亮
        ctx.fillStyle = h.color || '#ffffff';
        ctx.fillRect(h.x < 0.5 ? 0 : g.bw / 2, 0, g.bw / 2, g.bh);
      }
      ctx.globalAlpha = a * u;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 16 + pulse * 6, 0, 6.283); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(x, y, 6, 0, 6.283); ctx.fill();
      ctx.globalAlpha = a * u;
      H.cn(ctx, h.str, x, y + 38, 14, 'title', 'center');
      ctx.globalAlpha = 1;
    }
  };
})();
