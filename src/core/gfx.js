// src/core/gfx.js
// 像素工具库：打包颜色、软件像素缓冲 Pix（逐像素写入，零抗锯齿）、离屏图集 Sheet、数学/缓动/哈希。
//
// 为什么用软件光栅化？抖音小游戏的 canvas 每个绘制调用都要跨 JS/原生桥，逐像素 fillRect 太慢。
// 精灵在"烘焙"阶段全部用 Uint32Array 逐像素画好，再一次性 putImageData 到图集；
// 运行时每个精灵只需 1 次 drawImage。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});
  var gfx = PR.gfx = {};

  // ---------------- 颜色（打包为 uint32，内存布局与 ImageData 的 RGBA 字节序一致） ----------------
  function pack(r, gr, b, a) {
    return ((((a == null ? 255 : a) & 255) << 24) | ((b & 255) << 16) | ((gr & 255) << 8) | (r & 255)) >>> 0;
  }
  function hex(h, a) {
    var n = (typeof h === 'string') ? parseInt(h.slice(1), 16) : h;
    return pack((n >> 16) & 255, (n >> 8) & 255, n & 255, a);
  }
  function rc(c) { return c & 255; }
  function gc(c) { return (c >>> 8) & 255; }
  function bc(c) { return (c >>> 16) & 255; }
  function ac(c) { return (c >>> 24) & 255; }
  // 明暗缩放（k<1 变暗，>1 提亮，保留 alpha）
  function shade(c, k) {
    var r = rc(c) * k, gr = gc(c) * k, b = bc(c) * k, m = Math.max(r, gr, b);
    if (m > 255) { r *= 255 / m; gr *= 255 / m; b *= 255 / m; }
    return pack(Math.round(r), Math.round(gr), Math.round(b), ac(c));
  }
  function mix(c1, c2, t) {
    if (t <= 0) return c1;
    if (t >= 1) return c2;
    var ia = ac(c1), ib = ac(c2), a = ia + (ib - ia) * t;
    return pack(
      Math.round((rc(c1) * ia + (rc(c2) * ib - rc(c1) * ia) * t) / (a || 1)),
      Math.round((gc(c1) * ia + (gc(c2) * ib - gc(c1) * ia) * t) / (a || 1)),
      Math.round((bc(c1) * ia + (bc(c2) * ib - bc(c1) * ia) * t) / (a || 1)),
      Math.round(a));
  }
  function withA(c, a) { return ((c & 0x00ffffff) | ((a & 255) << 24)) >>> 0; }
  // 生成 css 颜色字符串（用于主画布 HUD）
  function css(c, alpha) {
    var a = alpha == null ? ac(c) / 255 : alpha;
    return 'rgba(' + rc(c) + ',' + gc(c) + ',' + bc(c) + ',' + (Math.round(a * 1000) / 1000) + ')';
  }

  // ---------------- 数学 / 缓动 ----------------
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOutCubic(t) { t = 1 - t; return 1 - t * t * t; }
  function easeInCubic(t) { return t * t * t; }
  function easeOutBack(t) { var c = 1.70158; t -= 1; return t * t * ((c + 1) * t + c) + 1; }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

  // 32 位整数乘法（等价 Math.imul，保持 ES5 写法）
  function imul(a, b) {
    var ah = (a >>> 16) & 0xffff, al = a & 0xffff, bh = (b >>> 16) & 0xffff, bl = b & 0xffff;
    return (al * bl + (((ah * bl + al * bh) << 16) >>> 0)) | 0;
  }
  // 整数哈希 → [0,1)，确定性强、分布均匀
  function hash(n) {
    n = (n | 0) ^ 0x9e3779b9;
    n = (n ^ 61) ^ (n >>> 16);
    n = imul(n, 9);
    n = n ^ (n >>> 4);
    n = imul(n, 0x27d4eb2d);
    n = n ^ (n >>> 15);
    return (n >>> 0) / 4294967296;
  }
  function hash2(a, b) { return hash((a | 0) + imul(b | 0, 0x85ebca6b)); }
  function hash3(a, b, c) { return hash((a | 0) + imul(b | 0, 0x85ebca6b) + imul(c | 0, 0xc2b2ae35)); }
  // 可播种随机数（mulberry32）
  function rng(seed) {
    var a = seed | 0;
    var f = function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = a;
      t = imul(t ^ (t >>> 15), t | 1);
      t ^= t + imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.range = function (lo, hi) { return lo + (hi - lo) * f(); };
    f.int = function (lo, hi) { return lo + Math.floor(f() * (hi - lo + 1)); };
    f.pick = function (arr) { return arr[Math.floor(f() * arr.length) % arr.length]; };
    f.chance = function (p) { return f() < p; };
    return f;
  }

  // ---------------- 软件像素缓冲 ----------------
  function Pix(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint32Array(w * h);
  }
  Pix.prototype.clear = function () { this.d.fill(0); return this; };

  // 以下基础函数都带 (ox, oy) 偏移参数，Pix 与 View 共用
  function pxAt(buf, ox, oy, x, y, c) {
    x = (x + ox) | 0; y = (y + oy) | 0;
    if (x < 0 || y < 0 || x >= buf.w || y >= buf.h) return;
    if (buf.clip && (x < buf.clip[0] || y < buf.clip[1] || x >= buf.clip[2] || y >= buf.clip[3])) return;
    buf.d[y * buf.w + x] = c;
  }
  function blendAt(buf, ox, oy, x, y, c) {
    x = (x + ox) | 0; y = (y + oy) | 0;
    if (x < 0 || y < 0 || x >= buf.w || y >= buf.h) return;
    var i = y * buf.w + x, d0 = buf.d[i], a = c >>> 24;
    if (a === 0) return;
    if (a === 255 || d0 === 0 || d0 >>> 24 === 0) { buf.d[i] = c; return; }
    var da = d0 >>> 24, ia = 255 - a, oa = a + da * ia / 255;
    buf.d[i] = pack(
      Math.round(((c & 255) * a + (d0 & 255) * ia) / oa),
      Math.round((((c >>> 8) & 255) * a + ((d0 >>> 8) & 255) * ia) / oa),
      Math.round((((c >>> 16) & 255) * a + ((d0 >>> 16) & 255) * ia) / oa),
      Math.round(oa));
  }
  function rectAt(buf, ox, oy, x, y, w, h, c) {
    var x0 = Math.max(0, (x + ox) | 0), y0 = Math.max(0, (y + oy) | 0);
    var x1 = Math.min(buf.w, ((x + ox) | 0) + (w | 0)), y1 = Math.min(buf.h, ((y + oy) | 0) + (h | 0));
    if (buf.clip) { x0 = Math.max(x0, buf.clip[0]); y0 = Math.max(y0, buf.clip[1]); x1 = Math.min(x1, buf.clip[2]); y1 = Math.min(y1, buf.clip[3]); }
    if (x1 <= x0 || y1 <= y0) return;
    for (var yy = y0; yy < y1; yy++) buf.d.fill(c, yy * buf.w + x0, yy * buf.w + x1);
  }
  function hlineAt(buf, ox, oy, x0, x1, y, c) {
    if (x0 > x1) { var t = x0; x0 = x1; x1 = t; }
    var ax0 = Math.max(0, (x0 + ox) | 0), ax1 = Math.min(buf.w - 1, (x1 + ox) | 0);
    y = (y + oy) | 0;
    if (ax1 < ax0 || y < 0 || y >= buf.h) return;
    if (buf.clip) { ax0 = Math.max(ax0, buf.clip[0]); ax1 = Math.min(ax1, buf.clip[2] - 1); if (y < buf.clip[1] || y >= buf.clip[3] || ax1 < ax0) return; }
    buf.d.fill(c, y * buf.w + ax0, y * buf.w + ax1 + 1);
  }
  function vlineAt(buf, ox, oy, x, y0, y1, c) {
    x = (x + ox) | 0;
    var ay0 = Math.max(0, (y0 + oy) | 0), ay1 = Math.min(buf.h - 1, (y1 + oy) | 0);
    if (x < 0 || x >= buf.w || ay1 < ay0) return;
    if (buf.clip) { ay0 = Math.max(ay0, buf.clip[1]); ay1 = Math.min(ay1, buf.clip[3] - 1); if (x < buf.clip[0] || x >= buf.clip[2] || ay1 < ay0) return; }
    for (var y = ay0; y <= ay1; y++) buf.d[y * buf.w + x] = c;
  }
  function discAt(buf, ox, oy, cx, cy, r, c) {
    cx = Math.round(cx + ox); cy = Math.round(cy + oy);
    var n = Math.floor(r), dy, hw;
    for (dy = -n; dy <= n; dy++) {
      hw = Math.floor(Math.sqrt(r * r - dy * dy));
      hlineAt(buf, 0, 0, cx - hw, cx + hw, cy + dy, c);
    }
  }
  function ringAt(buf, ox, oy, cx, cy, ro, ri, c) {
    cx = (cx + ox) | 0; cy = (cy + oy) | 0;
    for (var dy = -ro; dy <= ro; dy++) {
      var wo = Math.floor(Math.sqrt(ro * ro - dy * dy));
      if (Math.abs(dy) < ri) {
        var wi = Math.floor(Math.sqrt(ri * ri - dy * dy));
        hlineAt(buf, 0, 0, cx - wo, cx - wi - 1, cy + dy, c);
        hlineAt(buf, 0, 0, cx + wi, cx + wo, cy + dy, c);
      } else {
        hlineAt(buf, 0, 0, cx - wo, cx + wo, cy + dy, c);
      }
    }
  }
  function ellipseAt(buf, ox, oy, cx, cy, rx, ry, c) {
    cx = (cx + ox) | 0; cy = (cy + oy) | 0;
    for (var dy = -ry; dy <= ry; dy++) {
      var k = 1 - (dy * dy) / (ry * ry);
      var hw = Math.floor(rx * Math.sqrt(k > 0 ? k : 0));
      hlineAt(buf, 0, 0, cx - hw, cx + hw, cy + dy, c);
    }
  }
  function lineAt(buf, ox, oy, x0, y0, x1, y1, c) {
    x0 = Math.round(x0 + ox); y0 = Math.round(y0 + oy); x1 = Math.round(x1 + ox); y1 = Math.round(y1 + oy);
    var dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    var sx = (x0 < x1) ? 1 : -1, sy = (y0 < y1) ? 1 : -1, err = dx - dy;
    while (true) {
      pxAt(buf, 0, 0, x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }
  // 2px 粗的像素线：沿主线下方（陡线则右侧）补一像素
  function line2At(buf, ox, oy, x0, y0, x1, y1, cTop, cBot) {
    var steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);
    lineAt(buf, ox, oy, x0, y0, x1, y1, cTop);
    lineAt(buf, ox, oy, x0 + (steep ? 1 : 0), y0 + (steep ? 0 : 1), x1 + (steep ? 1 : 0), y1 + (steep ? 0 : 1), cBot);
  }
  function discR(buf, ox, oy, x, y, r, c) { discAt(buf, ox, oy, x, y, r, c); }
  // 粗线：沿线段以半像素步长盖圆章
  function thickAt(buf, ox, oy, x0, y0, x1, y1, t, c) {
    taperAt(buf, ox, oy, x0, y0, x1, y1, t, t, c);
  }
  function taperAt(buf, ox, oy, x0, y0, x1, y1, t0, t1, c) {
    var dx = x1 - x0, dy = y1 - y0;
    var steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 2));
    for (var i = 0; i <= steps; i++) {
      var u = i / steps;
      discAt(buf, ox, oy, x0 + dx * u, y0 + dy * u, (t0 + (t1 - t0) * u) * 0.5, c);
    }
  }
  function numSort(a, b) { return a - b; }
  function polyAt(buf, ox, oy, pts, c) {
    var n = pts.length, minY = Infinity, maxY = -Infinity, i, xs = [];
    for (i = 0; i < n; i++) { if (pts[i][1] < minY) minY = pts[i][1]; if (pts[i][1] > maxY) maxY = pts[i][1]; }
    var y0 = Math.max(-oy, Math.floor(minY - 0.5)), y1 = Math.min(buf.h - 1 - oy, Math.ceil(maxY + 0.5));
    for (var y = y0; y <= y1; y++) {
      var yc = y + 0.5;
      xs.length = 0;
      for (i = 0; i < n; i++) {
        var a = pts[i], b = pts[(i + 1) % n];
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) {
          xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
        }
      }
      if (xs.length < 2) continue;
      xs.sort(numSort);
      for (i = 0; i + 1 < xs.length; i += 2) {
        var xa = Math.ceil(xs[i] - 0.5), xb = Math.floor(xs[i + 1] - 0.5);
        if (xb >= xa) hlineAt(buf, ox, oy, xa, xb, y, c);
      }
    }
  }
  // 竖向渐变矩形
  function gradVAt(buf, ox, oy, x, y, w, h, c0, c1) {
    for (var i = 0; i < h; i++) rectAt(buf, ox, oy, x, y + i, w, 1, mix(c0, c1, h > 1 ? i / (h - 1) : 0));
  }
  // 区域内每个像素回调 fn(x, y) → 颜色（0 表示不画）
  function noiseAt(buf, ox, oy, x, y, w, h, fn) {
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) {
      var c = fn(x + i, y + j);
      if (c) pxAt(buf, ox, oy, x + i, y + j, c);
    }
  }
  // 在矩形范围内给已有像素描边（只看范围内的 alpha）
  function outlineIn(buf, x0, y0, x1, y1, c) {
    var w = buf.w, d = buf.d, out = null, i, x, y, hit;
    for (y = y0; y < y1; y++) for (x = x0; x < x1; x++) {
      i = y * w + x;
      if (d[i]) continue;
      hit = 0;
      if (x > x0 && d[i - 1]) hit = 1;
      else if (x < x1 - 1 && d[i + 1]) hit = 1;
      else if (y > y0 && d[i - w]) hit = 1;
      else if (y < y1 - 1 && d[i + w]) hit = 1;
      if (hit) { if (!out) out = new Uint32Array(w * buf.h); out[i] = c; }
    }
    if (out) for (i = 0; i < out.length; i++) if (out[i]) d[i] = out[i];
  }

  Pix.prototype.px = function (x, y, c) { pxAt(this, 0, 0, x, y, c); };
  Pix.prototype.blend = function (x, y, c) { blendAt(this, 0, 0, x, y, c); };
  Pix.prototype.rect = function (x, y, w, h, c) { rectAt(this, 0, 0, x, y, w, h, c); };
  Pix.prototype.hline = function (x0, x1, y, c) { hlineAt(this, 0, 0, x0, x1, y, c); };
  Pix.prototype.vline = function (x, y0, y1, c) { vlineAt(this, 0, 0, x, y0, y1, c); };
  Pix.prototype.circle = function (cx, cy, r, c) { discAt(this, 0, 0, cx, cy, r, c); };
  Pix.prototype.ring = function (cx, cy, ro, ri, c) { ringAt(this, 0, 0, cx, cy, ro, ri, c); };
  Pix.prototype.ellipse = function (cx, cy, rx, ry, c) { ellipseAt(this, 0, 0, cx, cy, rx, ry, c); };
  Pix.prototype.line = function (x0, y0, x1, y1, c) { lineAt(this, 0, 0, x0, y0, x1, y1, c); };
  Pix.prototype.line2 = function (x0, y0, x1, y1, a, b) { line2At(this, 0, 0, x0, y0, x1, y1, a, b); };
  Pix.prototype.thick = function (x0, y0, x1, y1, t, c) { thickAt(this, 0, 0, x0, y0, x1, y1, t, c); };
  Pix.prototype.taper = function (x0, y0, x1, y1, t0, t1, c) { taperAt(this, 0, 0, x0, y0, x1, y1, t0, t1, c); };
  Pix.prototype.poly = function (pts, c) { polyAt(this, 0, 0, pts, c); };
  Pix.prototype.gradV = function (x, y, w, h, c0, c1) { gradVAt(this, 0, 0, x, y, w, h, c0, c1); };
  Pix.prototype.noise = function (x, y, w, h, fn) { noiseAt(this, 0, 0, x, y, w, h, fn); };
  Pix.prototype.outline = function (c) { outlineIn(this, 0, 0, this.w, this.h, c); };

  // ImageData 是否可用，且字节序为小端（打包颜色的前提）；用 1 个测试像素验证
  var leChecked = false, isLE = false;
  function imageOk(ctx) {
    if (leChecked) return isLE;
    leChecked = true;
    try {
      if (!ctx || typeof ctx.createImageData !== 'function' || typeof ctx.putImageData !== 'function') return false;
      var t = ctx.createImageData(1, 1);
      new Uint32Array(t.data.buffer)[0] = 1;   // 小端下字节序为 [1,0,0,0]
      isLE = (t.data[0] === 1 && t.data[1] === 0 && t.data[3] === 0);
    } catch (e) { isLE = false; }
    return isLE;
  }

  // 把缓冲写成一个离屏画布：优先 putImageData（1 次调用），不支持时退化为逐行 fillRect
  Pix.prototype.toCanvas = function () {
    var c = PR.sys.createCanvas(this.w, this.h);
    if (!c) return null;
    var ctx = c.getContext('2d');
    var ok = false;
    if (ctx && imageOk(ctx)) {
      try {
        var img = ctx.createImageData(this.w, this.h);
        new Uint32Array(img.data.buffer, 0, this.w * this.h).set(this.d);
        ctx.putImageData(img, 0, 0);
        ok = true;
      } catch (e) { ok = false; }
    }
    if (!ok) {
      c.width = this.w; c.height = this.h;   // 清掉可能写入的半截内容
      paintRects(ctx, this, 0, 0, this.w, this.h);
    }
    return c;
  };
  function paintRects(ctx, pix, x0, y0, w, h) {
    var d = pix.d, W = pix.w;
    for (var y = y0; y < y0 + h; y++) {
      var x = x0;
      while (x < x0 + w) {
        var c = d[y * W + x];
        if (!c) { x++; continue; }
        var xe = x + 1;
        while (xe < x0 + w && d[y * W + xe] === c) xe++;
        ctx.fillStyle = css(c);
        ctx.fillRect(x, y, xe - x, 1);
        x = xe;
      }
    }
  }

  // 带原点偏移的"视图"：精灵画师用局部坐标作画（可以为负）
  function View(buf, ox, oy) { this.buf = buf; this.ox = ox; this.oy = oy; this.w = 0; this.h = 0; }
  // 再偏移一层的新视图：精灵画师用它把"锚点"设为局部原点
  View.prototype.sub = function (ox, oy) {
    var n = new View(this.buf, this.ox + ox, this.oy + oy);
    n.w = this.w; n.h = this.h;
    return n;
  };
  View.prototype.px = function (x, y, c) { pxAt(this.buf, this.ox, this.oy, x, y, c); };
  View.prototype.blend = function (x, y, c) { blendAt(this.buf, this.ox, this.oy, x, y, c); };
  View.prototype.rect = function (x, y, w, h, c) { rectAt(this.buf, this.ox, this.oy, x, y, w, h, c); };
  View.prototype.hline = function (x0, x1, y, c) { hlineAt(this.buf, this.ox, this.oy, x0, x1, y, c); };
  View.prototype.vline = function (x, y0, y1, c) { vlineAt(this.buf, this.ox, this.oy, x, y0, y1, c); };
  View.prototype.circle = function (cx, cy, r, c) { discAt(this.buf, this.ox, this.oy, cx, cy, r, c); };
  View.prototype.ring = function (cx, cy, ro, ri, c) { ringAt(this.buf, this.ox, this.oy, cx, cy, ro, ri, c); };
  View.prototype.ellipse = function (cx, cy, rx, ry, c) { ellipseAt(this.buf, this.ox, this.oy, cx, cy, rx, ry, c); };
  View.prototype.line = function (x0, y0, x1, y1, c) { lineAt(this.buf, this.ox, this.oy, x0, y0, x1, y1, c); };
  View.prototype.line2 = function (x0, y0, x1, y1, a, b) { line2At(this.buf, this.ox, this.oy, x0, y0, x1, y1, a, b); };
  View.prototype.thick = function (x0, y0, x1, y1, t, c) { thickAt(this.buf, this.ox, this.oy, x0, y0, x1, y1, t, c); };
  View.prototype.taper = function (x0, y0, x1, y1, t0, t1, c) { taperAt(this.buf, this.ox, this.oy, x0, y0, x1, y1, t0, t1, c); };
  View.prototype.poly = function (pts, c) {
    var p = [], i;
    for (i = 0; i < pts.length; i++) p.push([pts[i][0] + this.ox, pts[i][1] + this.oy]);
    polyAt(this.buf, 0, 0, p, c);
  };
  View.prototype.gradV = function (x, y, w, h, c0, c1) { gradVAt(this.buf, this.ox, this.oy, x, y, w, h, c0, c1); };
  View.prototype.noise = function (x, y, w, h, fn) { noiseAt(this.buf, this.ox, this.oy, x, y, w, h, fn); };
  // 字符位图：rows 为字符串数组，调色板 pal 把字符映射为颜色；' ' 与 '.' 为透明
  View.prototype.bmp = function (rows, pal, x, y) {
    for (var j = 0; j < rows.length; j++) {
      var s = rows[j];
      for (var i = 0; i < s.length; i++) {
        var ch = s.charAt(i);
        if (ch === ' ' || ch === '.') continue;
        var c = pal[ch];
        if (c) pxAt(this.buf, this.ox, this.oy, x + i, y + j, c);
      }
    }
  };

  // ---------------- 离屏图集 ----------------
  function Sheet(w, h) {
    this.pix = new Pix(w, h);
    this.canvas = null;
    this.ctx = null;
    this.cx = 0;      // 当前行的起始 x
    this.cy = 0;      // 当前行的起始 y
    this.rowH = 0;
    this.hasImage = false;
  }
  Sheet.prototype._ensure = function () {
    if (this.canvas) return;
    this.canvas = this.pix.toCanvas();
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.hasImage = imageOk(this.ctx);
  };
  // 在图集中放入一个精灵：painter(v, w, h) 用局部坐标作画
  // opts: { pad: 边距(默认1), outline: 描边颜色, ax, ay: 锚点(默认 w/2, h) }
  Sheet.prototype.add = function (w, h, painter, opts) {
    opts = opts || {};
    var pad = opts.pad == null ? 1 : opts.pad;
    var cw = w + pad * 2, ch = h + pad * 2;
    if (this.cx + cw > this.pix.w) { this.cx = 0; this.cy += this.rowH; this.rowH = 0; }
    if (this.cy + ch > this.pix.h && typeof console !== 'undefined') console.warn('[PR] sheet overflow');
    var bx = this.cx, by = this.cy;
    this.cx += cw;
    if (ch > this.rowH) this.rowH = ch;
    var ox = bx + pad, oy = by + pad;
    var v = new View(this.pix, ox, oy);
    v.w = w; v.h = h;
    this.pix.clip = [bx, by, bx + cw, by + ch];     // 画师只能在单元格内作画，越界自动裁掉
    painter(v, w, h);
    this.pix.clip = null;
    if (opts.outline != null) outlineIn(this.pix, bx, by, bx + cw, by + ch, opts.outline);
    var sp = { sheet: this, sx: ox, sy: oy, w: w, h: h, ax: opts.ax == null ? (w >> 1) : opts.ax, ay: opts.ay == null ? h - 1 : opts.ay, _c: [bx, by, cw, ch] };
    this.flush(sp);
    return sp;
  };
  // 只占位不作画：配合分步烘焙（Job）使用
  Sheet.prototype.reserve = function (w, h, opts) { return this.add(w, h, function () {}, opts || {}); };
  // 把单元格从像素缓冲写到画布
  Sheet.prototype.flush = function (sp) {
    this._ensure();
    if (!this.ctx || !sp._c) return;
    var bx = sp._c[0], by = sp._c[1], cw = sp._c[2], ch = sp._c[3];
    if (this.hasImage) {
      try {
        var img = this.ctx.createImageData(cw, ch);
        var dst = new Uint32Array(img.data.buffer, 0, cw * ch), W = this.pix.w, d = this.pix.d;
        for (var y = 0; y < ch; y++) dst.set(d.subarray((by + y) * W + bx, (by + y) * W + bx + cw), y * cw);
        this.ctx.putImageData(img, bx, by);
      } catch (e) { this.hasImage = false; paintRects(this.ctx, this.pix, bx, by, cw, ch); }
    } else {
      paintRects(this.ctx, this.pix, bx, by, cw, ch);
    }
  };

  // 把精灵画到画布（整数坐标，保持像素锐利）
  function draw(ctx, sp, x, y, alpha) {
    if (!sp || !sp.sheet.canvas) return;
    if (alpha != null) {
      if (alpha <= 0) return;
      if (alpha < 1) { ctx.globalAlpha = alpha; }
    }
    ctx.drawImage(sp.sheet.canvas, sp.sx, sp.sy, sp.w, sp.h,
      Math.round(x) - sp.ax, Math.round(y) - sp.ay, sp.w, sp.h);
    if (alpha != null && alpha < 1) ctx.globalAlpha = 1;
  }
  // 缩放绘制（用于会随高度变化的阴影等）
  function drawScaled(ctx, sp, x, y, sx, sy, alpha) {
    if (!sp || !sp.sheet.canvas) return;
    if (alpha != null) { if (alpha <= 0) return; ctx.globalAlpha = alpha > 1 ? 1 : alpha; }
    var w = Math.round(sp.w * sx), h = Math.round(sp.h * sy);
    ctx.drawImage(sp.sheet.canvas, sp.sx, sp.sy, sp.w, sp.h, Math.round(x) - Math.round(w * sp.ax / sp.w), Math.round(y) - Math.round(h * sp.ay / sp.h), w, h);
    if (alpha != null) ctx.globalAlpha = 1;
  }

  gfx.pack = pack; gfx.hex = hex; gfx.shade = shade; gfx.mix = mix; gfx.withA = withA; gfx.css = css;
  gfx.r = rc; gfx.g = gc; gfx.b = bc; gfx.a = ac;
  gfx.clamp = clamp; gfx.lerp = lerp; gfx.easeOutCubic = easeOutCubic; gfx.easeInCubic = easeInCubic;
  gfx.easeOutBack = easeOutBack; gfx.easeInOut = easeInOut; gfx.smooth = smooth;
  gfx.hash = hash; gfx.hash2 = hash2; gfx.hash3 = hash3; gfx.rng = rng;
  gfx.Pix = Pix; gfx.View = View; gfx.Sheet = Sheet; gfx.draw = draw; gfx.drawScaled = drawScaled;

  // 主画布（HUD）配色
  PR.colors = {
    ink:      '#1a1d2e',
    paper:   '#f4efe3',
    gold:    '#ffcf3f',
    goldDk:  '#d99a1b',
    red:     '#ff4d4d',
    green:   '#5fd35f',
    blue:    '#6cc6ff',
    orange:  '#ff9f43',
    hudBg:   'rgba(12,16,32,0.62)',
    hudLine: 'rgba(255,255,255,0.35)',
    panel:   'rgba(14,18,36,0.9)',
    white:   '#ffffff'
  };
})();
