// src/world/background.js
// 场景渲染：天空 / 星辰 / 日月 / 云 / 远中近三层视差山体 / 湖面倒影 / 道具 / 经幡 / 路面 / 前景。
// 所有静态美术都已烘焙进图集，每帧只做少量 drawImage；路面用"逐段锐利矩形"保持像素干净。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});
  var gfx = PR.gfx, hex = gfx.hex, hash2 = gfx.hash2, hash3 = gfx.hash3, draw = gfx.draw;
  var ROAD_FAR = 14;
  var FLAG_COLS = ['#2a5ad0', '#f4f4f4', '#d03028', '#2a9a50', '#e8c030'];

  function Scene(game) {
    this.g = game;
    this.themeIndex = -1;
    this.art = null;
    this.def = null;
    this.clouds = [];
    this.ys = [];
    this.cache = {};
    this.cacheOrder = [];
  }

  Scene.prototype.setTheme = function (ti) {
    ti = ((ti % PR.themes.length) + PR.themes.length) % PR.themes.length;
    if (this.themeIndex === ti) return;
    if (this.themeIndex >= 0) this.cache[this.themeIndex] = this.art;      // 保留上一套，重开时免重建
    this.themeIndex = ti;
    this.def = PR.themes[ti];
    this.art = this.cache[ti] || PR.art.build(ti);
    delete this.cache[ti];
    this.skyGrad = null; this.shoulder = null;                  // 随主题重建
    this.cacheOrder.push(ti);
    while (this.cacheOrder.length > 2) { delete this.cache[this.cacheOrder.shift()]; }   // 最多缓存 2 套，控制内存
    var r = gfx.rng(ti * 977 + 5), n = this.def.cloud.n;
    this.clouds = [];
    for (var i = 0; i < n; i++) {
      this.clouds.push({ sp: this.art.clouds[i % this.art.clouds.length], x: r() * 1800, y: 14 + r() * 150, v: 1.5 + r() * 4, p: 0.012 + r() * 0.03, a: 0.82 + r() * 0.18 });
    }
  };

  // 竖向构图（相对路面基准线 G）：远山脚 → 湖面 → 对岸（中景）→ 近处树线 → 草带 → 路面 → 近路肩
  var L = { FAR: 46, LAKE_TOP: 96, LAKE_BOT: 50, RIVER_TOP: 84, RIVER_BOT: 44, MID: 16, NEAR: 2, SHOULDER: 64, SKY: 40 };

  // 无缝平铺的山体瓦片
  function tile(ctx, sheet, sp, p, top, camX, W) {
    var tw = sp.w, off = Math.floor(((camX * p) % tw + tw) % tw), x = 0, w;
    while (x < W) {
      w = Math.min(tw - off, W - x);
      ctx.drawImage(sheet, sp.sx + off, sp.sy, w, sp.h, x, top, w, sp.h);
      x += w; off = 0;
    }
  }

  function pickWeighted(list, t) {
    var sum = 0, i;
    for (i = 0; i < list.length; i++) sum += list[i][1];
    var acc = 0;
    for (i = 0; i < list.length; i++) { acc += list[i][1] / sum; if (t < acc) return list[i][0]; }
    return list[0][0];
  }

  Scene.prototype.drawSky = function (ctx, camX, W, H, G, shy, t) {
    var def = this.def, i, art = this.art, by = shy;
    var horizon = G + by - L.SKY;
    if (!this.skyGrad) {
      var gr = ctx.createLinearGradient(0, 0, 0, horizon);
      gr.addColorStop(0, def.sky[0]); gr.addColorStop(0.55, def.sky[1]); gr.addColorStop(1, def.sky[2]);
      this.skyGrad = gr;
    }
    ctx.fillStyle = this.skyGrad;
    ctx.fillRect(0, 0, W, H);
    // 星星
    if (def.stars > 0) {
      for (i = 0; i < 64; i++) {
        var sx = (hash2(i, 3) * W * 1.2 - camX * 0.006) % W; if (sx < 0) sx += W;
        var sy = hash2(i, 11) * horizon * 0.78 + shy;
        var tw = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.8 + hash2(i, 5) * 2) + i));
        ctx.globalAlpha = tw * def.stars;
        ctx.fillStyle = i % 7 === 0 ? '#fff6d8' : '#eef2ff';
        ctx.fillRect(sx | 0, sy | 0, 1, 1);
        if (i % 11 === 0) { ctx.fillRect((sx | 0) - 1, sy | 0, 3, 1); ctx.fillRect(sx | 0, (sy | 0) - 1, 1, 3); }
      }
      ctx.globalAlpha = 1;
    }
    // 日月
    var sun = def.sun, sp = this.art.sun, sunX = Math.round(sun.x * W);
    draw(ctx, sp, sunX, Math.round(sun.y * horizon + shy));
    // 远山
    var farBase = G + by - L.FAR;
    tile(ctx, art.sheet.canvas, art.far, 0.06, farBase - art.far.base, camX, W);
    // 云（在远山之前、对岸之后）
    var span = W + 420;
    for (i = 0; i < this.clouds.length; i++) {
      var c = this.clouds[i], cx = ((c.x - camX * c.p + t * c.v) % span + span) % span - 210;
      draw(ctx, c.sp, cx, c.y + by * 0.4 + c.sp.h, c.a);
    }
    // 湖 / 江
    if (def.lake) this.drawLake(ctx, camX, W, G, shy, t, sunX, farBase);
    if (def.river) this.drawRiver(ctx, camX, W, G, shy, t);
    tile(ctx, art.sheet.canvas, art.mid, 0.16, G + by - L.MID - art.mid.base, camX, W);
    // 布达拉宫：贴在中景之上
    this.drawLandmark(ctx, camX, W, G, shy);
    // 近处树线
    tile(ctx, art.sheet.canvas, art.near, 0.36, G + by - L.NEAR - art.near.base, camX, W);
  };

  Scene.prototype.drawLake = function (ctx, camX, W, G, shy, t, sunX, farBase) {
    var lake = this.def.lake, art = this.art, h = this.def.haze.c;
    var top = G + shy - L.LAKE_TOP, bot = G + shy - L.LAKE_BOT, hh = bot - top;
    ctx.fillStyle = lake.top; ctx.fillRect(0, top, W, hh * 0.45);
    ctx.fillStyle = gfx.mix(hex(lake.top), hex(lake.bot), 0.5); ctx.fillRect(0, top + hh * 0.45, W, hh * 0.3);
    ctx.fillStyle = lake.bot; ctx.fillRect(0, top + hh * 0.75, W, hh * 0.25 + 1);
    // 倒影：远山上下翻转、压扁一半；按 4px 高的水条逐条错位，模拟水波把倒影揉碎
    var a = top + 0.5 * farBase, k, topY = farBase - art.far.base, band = 4, nb = Math.ceil(hh / band);
    ctx.globalAlpha = 0.36;
    for (k = 0; k < nb; k++) {
      var y0 = top + k * band;
      if (farBase - (y0 - top) * 2 < topY) break;
      var dx = Math.round(Math.sin(k * 0.9 + t * 0.8) * 2.5 + Math.sin(k * 2.3 - t * 0.5) * 1.5);
      ctx.save();
      ctx.beginPath(); ctx.rect(0, y0, W, band); ctx.clip();
      ctx.translate(dx, 0);
      ctx.transform(1, 0, 0, -0.5, 0, a);
      tile(ctx, art.sheet.canvas, art.far, 0.06, topY, camX, W);
      ctx.restore();
    }
    // 水面的细长涟漪
    ctx.fillStyle = '#ffffff';
    for (k = 0; k < 12; k++) {
      var u = hash2(k, 51), yr = top + 4 + u * (hh - 8), len = 30 + hash2(k, 52) * 90;
      var xr = ((hash2(k, 53) * W * 2 + t * (5 + hash2(k, 54) * 7) * (0.4 + u)) % (W + 200)) - 100;
      ctx.globalAlpha = 0.1 + 0.12 * Math.abs(Math.sin(t * 0.9 + k));
      ctx.fillRect(xr | 0, yr | 0, len | 0, 1);
    }
    // 日光在水面上的一条碎金
    ctx.fillStyle = '#ffffff';
    for (k = 0; k < 26; k++) {
      var u = hash2(k, 31), y = top + 2 + u * (hh - 5), half = 5 + u * u * 74;
      var x = sunX + (hash2(k, 21) * 2 - 1) * half;
      ctx.globalAlpha = (0.18 + 0.5 * Math.abs(Math.sin(t * 2.6 + k * 1.7))) * (1 - u * 0.35);
      ctx.fillRect((x + Math.sin(t * 1.3 + k) * 2) | 0, y | 0, 2 + (k % 5) * 2, 1);
    }
    // 零散波光
    for (k = 0; k < 14; k++) {
      var x2 = (hash2(k, 41) * W + t * (4 + hash2(k, 9) * 9)) % W, y2 = top + 3 + hash2(k, 43) * (hh - 6);
      ctx.globalAlpha = 0.12 + 0.22 * Math.abs(Math.sin(t * 1.9 + k * 1.3));
      ctx.fillRect(x2 | 0, y2 | 0, 3 + (k % 4) * 2, 1);
    }
    ctx.globalAlpha = 0.25; ctx.fillStyle = h; ctx.fillRect(0, top, W, 3);       // 远岸水汽
    ctx.globalAlpha = 1;
  };

  Scene.prototype.drawRiver = function (ctx, camX, W, G, shy, t) {
    var rv = this.def.river, top = G + shy - L.RIVER_TOP, bot = G + shy - L.RIVER_BOT, hh = bot - top, k;
    ctx.fillStyle = rv.c; ctx.fillRect(0, top, W, hh);
    ctx.fillStyle = rv.c2;
    for (k = 0; k < 16; k++) {
      var sp = 60 + hash2(k, 4) * 110, x = W + 200 - ((camX * 0.22 + t * sp + hash2(k, 8) * 900) % (W + 400));
      ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 5 + k);
      ctx.fillRect(x | 0, (top + 3 + hash2(k, 6) * (hh - 8)) | 0, 8 + (k % 5) * 5, 2);
    }
    ctx.globalAlpha = 0.7; ctx.fillStyle = '#f4e4c0';
    for (k = 0; k < 8; k++) {
      var x2 = W + 200 - ((camX * 0.22 + t * 90 + hash2(k, 12) * 900) % (W + 400));
      ctx.fillRect(x2 | 0, (top + 4 + hash2(k, 14) * (hh - 9)) | 0, 3, 1);
    }
    ctx.globalAlpha = 1;
  };

  // 布达拉宫（拉萨段末尾远景）
  Scene.prototype.drawLandmark = function (ctx, camX, W, G, shy) {
    var def = this.def;
    if (!def.potala || this.g.level.endX == null) return;
    var things = PR.art.buildStatic(), sp = things.potala[0];
    var sx = Math.round((this.g.level.endX + 260 - camX) * 0.5 + W * 0.5);
    if (sx - sp.w * 0.5 > W || sx + sp.w * 0.5 < 0) return;
    ctx.globalAlpha = 0.92;
    draw(ctx, sp, sx, G + shy - L.MID + 6);
    ctx.globalAlpha = 1;
  };

  // 路后方的道具（树、民居、佛塔、电线杆、经幡…）
  Scene.prototype.drawProps = function (ctx, camX, W, G, shx, shy, t, extras) {
    var things = PR.art.buildStatic(), def = this.def, list = def.props, terr = this.g.terrain, i;
    var c0 = Math.floor((camX - 180) / 44), c1 = Math.floor((camX + W + 180) / 44);
    var seed = this.themeIndex * 31 + 7, dark = def.darken ? hex(def.darken) : 0;
    for (i = c0; i <= c1; i++) {
      var h0 = hash2(i, seed);
      if (h0 > 0.6) continue;
      var wx = i * 44 + ((h0 * 997) | 0) % 34;
      var nm = pickWeighted(list, hash2(i, 911));
      var lst = things[nm]; if (!lst) continue;
      var sp = lst[((h0 * 7919) | 0) % lst.length];
      var gy = Math.round(G - terr.h(wx)) - ROAD_FAR - 1 + shy;
      draw(ctx, sp, wx - camX + shx, gy);
    }
    if (def.house) {                                   // 大型民居：每 760 单位一座
      var b0 = Math.floor((camX - 400) / 760), b1 = Math.floor((camX + W + 400) / 760);
      for (i = b0; i <= b1; i++) {
        var hb = hash2(i, 333);
        if (hb > 0.7) continue;
        var bx = i * 760 + ((hb * 811) | 0) % 80, hs = things[def.house][((hb * 613) | 0) % 3];
        draw(ctx, hs, bx - camX + shx, Math.round(G - terr.h(bx)) - ROAD_FAR - 2 + shy);
      }
    }
    if (def.flags) {                                   // 经幡：每 940 单位一处
      var f0 = Math.floor((camX - 300) / 940), f1 = Math.floor((camX + W + 300) / 940);
      for (i = f0; i <= f1; i++) {
        var fb = hash2(i, 777);
        if (fb > 0.7) continue;
        this.drawFlags(ctx, i * 940 + ((fb * 509) | 0) % 60 - camX + shx, G, shy, t + i);
      }
    }
    if (def.birds) {                                   // 飞鸟
      for (i = 0; i < 5; i++) {
        var bx2 = W + 80 - ((camX * 0.1 + t * 34 + hash2(i, 55) * 1400) % (W + 160));
        var by2 = G + shy - 150 + hash2(i, 66) * 60 + Math.sin(t * 1.3 + i) * 6, wing = Math.sin(t * 9 + i * 1.7) > 0 ? 0 : 2;
        ctx.fillStyle = def.stars ? '#c8d0e0' : '#3a3a44';
        ctx.fillRect(bx2 | 0, (by2 + wing) | 0, 3, 1); ctx.fillRect((bx2 | 0) + 3, by2 | 0, 1, 1); ctx.fillRect((bx2 | 0) + 4, (by2 + wing) | 0, 3, 1);
      }
    }
    if (extras) for (i = 0; i < extras.length; i++) draw(ctx, extras[i].sp, extras[i].x - camX + shx, extras[i].y + shy);
  };

  Scene.prototype.drawFlags = function (ctx, x0, G, shy, t) {
    var things = PR.art.buildStatic(), terr = this.g.terrain, camX = this.g.camX;
    var xa = x0, xb = x0 + 150, ya = Math.round(G - terr.h(camX + xa)) - ROAD_FAR + shy, yb = Math.round(G - terr.h(camX + xb)) - ROAD_FAR + shy;
    var topA = ya - 66, topB = yb - 58, k;
    ctx.fillStyle = '#4a4038';
    ctx.fillRect(xa, topA, 2, ya - topA); ctx.fillRect(xb, topB, 2, yb - topB);
    for (k = 0; k < 10; k++) {
      var u = (k + 0.5) / 10, fx = xa + (xb - xa) * u, fy = topA + (topB - topA) * u + Math.sin(u * Math.PI) * 14 + Math.sin(t * 7 + k * 0.9) * 1.6;
      ctx.fillStyle = FLAG_COLS[k % 5];
      ctx.fillRect(Math.round(fx), Math.round(fy), 9, 6);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(Math.round(fx), Math.round(fy) + 5, 9, 1);
    }
  };

  // 路面：整块填充（带抗锯齿的斜边）之后，用逐段 1px 对齐的矩形把可见边缘重新描清楚
  Scene.prototype.drawGround = function (ctx, camX, W, H, G, shx, shy, step) {
    var terr = this.g.terrain, def = this.def, road = def.road, g1 = def.grass[0], g2 = def.grass[1];
    var n = Math.ceil(W / step) + 1, ys = this.ys, i;
    if (ys.length < n + 1) ys.length = n + 1;
    for (i = 0; i <= n; i++) ys[i] = Math.round(G - terr.h(camX + i * step) + shy);
    var sh = this.shoulder || (this.shoulder = { fill: gfx.css(gfx.shade(gfx.mix(hex(road.b), hex(g2), 0.45), 0.6)), edge: gfx.css(gfx.shade(gfx.mix(hex(road.b), hex(g2), 0.45), 0.86)) });
    // 1) 远边缘以下整块
    ctx.fillStyle = road.b;
    ctx.beginPath(); ctx.moveTo(-4, H + 10);
    for (i = 0; i <= n; i++) ctx.lineTo(i * step + shx, ys[i] - ROAD_FAR);
    ctx.lineTo(W + 4, H + 10); ctx.closePath(); ctx.fill();
    // 2) 草带
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.moveTo(-4, ys[0] - ROAD_FAR - 10);
    for (i = 0; i <= n; i++) ctx.lineTo(i * step + shx, ys[i] - ROAD_FAR - 10);
    for (i = n; i >= 0; i--) ctx.lineTo(i * step + shx, ys[i] - ROAD_FAR + 1);
    ctx.closePath(); ctx.fill();
    // 2b) 近路肩（斜边用路径填充，边缘线在下一步描清楚）
    ctx.fillStyle = sh.fill;
    ctx.beginPath(); ctx.moveTo(-4, H + 10);
    for (i = 0; i <= n; i++) ctx.lineTo(i * step + shx, ys[i] + L.SHOULDER);
    ctx.lineTo(W + 4, H + 10); ctx.closePath(); ctx.fill();
    // 3) 远半幅路面 + 亮边 + 路肩亮边（逐段对齐，保持像素锐利）
    i = 0;
    while (i <= n) {
      var y = ys[i], j = i + 1, len;
      while (j <= n && ys[j] === y) j++;
      len = (j - i) * step;
      ctx.fillStyle = road.a; ctx.fillRect(i * step + shx, y - ROAD_FAR, len, ROAD_FAR);
      ctx.fillStyle = road.edge; ctx.fillRect(i * step + shx, y - ROAD_FAR - 1, len, 1);
      ctx.fillStyle = g1; ctx.fillRect(i * step + shx, y - ROAD_FAR - 10, len, 1);
      ctx.fillStyle = sh.edge; ctx.fillRect(i * step + shx, y + L.SHOULDER, len, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.07)';                        // 两条被车轮磨暗的车辙
      ctx.fillRect(i * step + shx, y + 18, len, 4);
      ctx.fillRect(i * step + shx, y + 38, len, 4);
      i = j;
    }
    // 4) 中线虚线
    var d0 = Math.floor((camX - 40) / 48), d1 = Math.floor((camX + W + 40) / 48), k;
    ctx.fillStyle = road.line;
    for (k = d0; k <= d1; k++) {
      for (var q = 0; q < 2; q++) {
        var x1 = k * 48 + q * 9 - camX, y1 = Math.round(G - terr.h(k * 48 + q * 9) + shy) - 8;
        ctx.fillRect(Math.round(x1 + shx), y1, 9, 1);
      }
    }
    // 5) 近半幅：补丁、裂缝、颗粒
    var cw = 28, k0 = Math.floor(camX / cw), k1 = Math.floor((camX + W) / cw), cx, cy;
    for (cx = k0; cx <= k1; cx++) {
      var hp = hash2(cx, 555), wx0 = cx * cw + ((hp * 7919) | 0) % 20, gy0 = Math.round(G - terr.h(wx0) + shy);
      var px0 = wx0 - camX + shx;
      if (hp < 0.3) {                                             // 沥青补丁：略深或略浅的一块
        ctx.globalAlpha = 0.13;
        ctx.fillStyle = hp < 0.14 ? '#ffffff' : '#000000';
        ctx.fillRect(px0, gy0 + 10 + ((hp * 313) | 0) % 44, 12 + ((hp * 97) | 0) % 26, 3 + ((hp * 37) | 0) % 5);
        ctx.globalAlpha = 1;
      } else if (hp > 0.87) {                                     // 裂缝：顺着路面方向折一下
        var cy0 = gy0 + 8 + ((hp * 577) | 0) % 52, seg;
        for (seg = 0; seg < 4; seg++) ctx.fillRect(px0 + seg * 5, cy0 + seg * 2 + (seg > 1 ? 1 : 0), 5, 1);
      }
      ctx.fillStyle = road.spot;
      for (cy = 0; cy < 3; cy++) {
        var hh = hash2(cx * 5 + cy, 77);
        if (hh > 0.55) continue;
        var wx = cx * cw + ((hh * 9973) | 0) % 24, gy = Math.round(G - terr.h(wx) + shy);
        ctx.fillRect(wx - camX + shx, gy + 4 + cy * 19 + ((hh * 613) | 0) % 14, 1 + (cy > 1 ? 1 : 0), 1);
      }
    }
    ctx.fillStyle = sh.edge;                                      // 路肩碎石
    for (cx = k0; cx <= k1; cx++) for (cy = 0; cy < 3; cy++) {
      var hs = hash2(cx * 7 + cy, 913);
      if (hs > 0.42) continue;
      var sx2 = cx * cw + ((hs * 7919) | 0) % 28, sy2 = Math.round(G - terr.h(sx2) + shy);
      ctx.fillRect(sx2 - camX + shx, sy2 + L.SHOULDER + 3 + ((hs * 577) | 0) % 15, 1 + (hs > 0.2 ? 1 : 0), 1);
    }
  };

  // 前景草丛（视差 > 1，从画面底边探出，放大一档更有纵深）
  Scene.prototype.drawFront = function (ctx, camX, W, H, shx, list) {
    var things = PR.art.buildStatic(), c0 = Math.floor((camX * 1.3 - 40) / 58), c1 = Math.floor((camX * 1.3 + W + 40) / 58), i;
    for (i = c0; i <= c1; i++) {
      var h0 = hash2(i, 4242);
      if (h0 > 0.72) continue;
      var nm = list[(h0 * 31 | 0) % list.length], lst = things[nm];
      var k = 1.4 + h0 * 0.9;
      gfx.drawScaled(ctx, lst[((h0 * 577) | 0) % lst.length], i * 58 + ((h0 * 37) | 0) % 20 - camX * 1.3 + shx, H + 3, k, k, 0.96);
    }
  };

  PR.Scene = Scene;
  PR.ROAD_FAR = ROAD_FAR;
})();
