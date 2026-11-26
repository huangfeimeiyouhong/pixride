// src/world/background.js
// 视差背景：天空渐变 → 太阳 → 远山 → 云 → 近山 → 地面。全部程序化绘制。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});
  var C = PR.gfx.COLORS;
  var px = PR.gfx.px;

  // 生成一条可无缝平铺的山脊折线（基于固定种子，保证每帧一致）
  function makeRidge(tileW, baseY, peakMin, peakMax, seed) {
    var pts = [];
    var n = 8;
    for (var i = 0; i <= n; i++) {
      var x = (i / n) * tileW;
      // 伪随机但确定
      var r = Math.sin(seed + i * 12.9898) * 43758.5453;
      r = r - Math.floor(r);
      var h = peakMin + r * (peakMax - peakMin);
      pts.push({ x: x, y: baseY - h });
    }
    return pts;
  }

  function drawRidge(ctx, pts, baseY, color, offset, left, right, tileW) {
    ctx.fillStyle = color;
    ctx.beginPath();
    var started = false;
    var startTile = Math.floor((left - offset) / tileW) - 1;
    var endTile = Math.ceil((right - offset) / tileW) + 1;
    for (var t = startTile; t <= endTile; t++) {
      var ox = t * tileW + offset;
      for (var i = 0; i < pts.length; i++) {
        var x = ox + pts[i].x;
        var y = pts[i].y;
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
    }
    ctx.lineTo(right + tileW, baseY);
    ctx.lineTo(left - tileW, baseY);
    ctx.closePath();
    ctx.fill();
  }

  PR.Background = function (opts) {
    this.W = opts.width;
    this.H = opts.height;
    this.groundY = opts.groundY;
    this.cloudT = 0;
    // 预生成两条山脊
    this.farRidge = makeRidge(220, this.groundY, 26, 52, 1.7);
    this.farRidge2 = makeRidge(260, this.groundY, 18, 38, 5.1);
    this.nearRidge = makeRidge(200, this.groundY + 2, 12, 30, 9.3);
  };

  PR.Background.prototype.update = function (dt) {
    this.cloudT += dt;
  };

  PR.Background.prototype.draw = function (ctx, worldX) {
    var W = this.W, H = this.H, gy = this.groundY;

    // 1) 天空渐变（3 段色带）
    var bands = [
      { y: 0, h: gy * 0.35, c: C.skyTop },
      { y: gy * 0.35, h: gy * 0.4, c: C.skyMid },
      { y: gy * 0.75, h: gy * 0.25, c: C.skyBottom }
    ];
    for (var b = 0; b < bands.length; b++) px(ctx, 0, bands[b].y, W, bands[b].h + 1, bands[b].c);

    // 2) 太阳（固定位置，加一圈光晕）
    var sx = W - 52, sy = 30;
    circle(ctx, sx, sy, 14, 'rgba(255,213,107,0.35)');
    circle(ctx, sx, sy, 9, C.sun);

    // 3) 远山（两层，不同视差）
    var offFar = (worldX * 0.12) % 220;
    drawRidge(ctx, this.farRidge2, gy, C.mountainFar2, -offFar, 0, W, 260);
    var offFar2 = (worldX * 0.18) % 220;
    drawRidge(ctx, this.farRidge, gy, C.mountainFar, -offFar2, 0, W, 220);

    // 4) 云（视差 0.3，两排高度）
    this.drawClouds(ctx, worldX * 0.3, 22, 170, 1);
    this.drawClouds(ctx, worldX * 0.25, 46, 210, 0.7);

    // 5) 近山（绿色丘陵，视差 0.55）
    var offNear = (worldX * 0.55) % 200;
    drawRidge(ctx, this.nearRidge, gy + 2, C.hillDark, -offNear, 0, W, 200);
    // 近山亮面
    var offNear2 = (worldX * 0.6) % 200;
    drawRidge(ctx, this.nearRidge, gy + 1, C.hillNear, -offNear2 + 4, 0, W, 200);

    // 6) 地面
    px(ctx, 0, gy, W, H - gy, C.ground);
    px(ctx, 0, gy, W, 3, C.grass);        // 草皮顶
    px(ctx, 0, gy + 3, W, 1, C.grassDark); // 草皮阴影线
    // 地面滚动纹理：小土点 + 草簇，随 worldX 移动
    this.drawGroundTexture(ctx, worldX, gy);
  };

  PR.Background.prototype.drawClouds = function (ctx, offset, y, spacing, scale) {
    var s = PR.sprites.cloud;
    var tileW = spacing;
    var startX = -((offset % tileW + tileW) % tileW);
    for (var x = startX; x < this.W + tileW; x += tileW) {
      PR.gfx.drawBitmap(ctx, s.bitmap, s.palette, Math.round(x), y, scale);
    }
  };

  PR.Background.prototype.drawGroundTexture = function (ctx, worldX, gy) {
    var H = this.H;
    // 用 worldX 做确定性散点，每 12px 一格
    var step = 12;
    var start = -((worldX % step) + step) % step;
    for (var x = start; x < this.W + step; x += step) {
      var cell = Math.floor((x + worldX) / step);
      var r = Math.sin(cell * 78.233) * 43758.5453; r = r - Math.floor(r);
      if (r > 0.55) {
        var py = gy + 6 + Math.floor(r * 20) % (H - gy - 8);
        px(ctx, x, py, 2, 2, C.groundDark);
      }
      if (r > 0.82) {
        px(ctx, x, gy - 2, 1, 2, C.grassDark); // 草簇
      }
    }
  };

  function circle(ctx, cx, cy, r, color) { PR.gfx.circle(ctx, cx, cy, r, color); }
})();
