// src/core/gfx.js
// 共享图形工具：调色板、像素绘制辅助、低分辨率帧缓冲。
// 所有模块挂到全局命名空间 PR（同时兼容抖音小游戏 runtime 与浏览器）。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});

  // 复古有限调色板
  PR.colors = {
    skyTop:    '#7ec8f0',
    skyMid:    '#aee3f5',
    skyBottom: '#e7f6ff',
    sun:       '#ffd56b',
    mountainFar:  '#8aa9c9',
    mountainFar2: '#a9c4dd',
    hillNear: '#6fb06a',
    hillDark: '#4e9e54',
    ground:   '#c8a06a',
    groundDark: '#9c7a4a',
    grass:    '#7cc47a',
    grassDark:'#4fa05a',
    rock:     '#8a8a8a',
    rockDark: '#5c5c5c',
    outline:  '#1f1f2e',
    tire:     '#2b2b33',
    rim:      '#dfe6ee',
    frame:    '#5a6ea8',
    frameDark:'#3c4d7a',
    skin:     '#f2c79b',
    helmet:   '#e8453c',
    jersey:   '#f4a020',
    shorts:   '#33415c',
    shoe:     '#1c1c26',
    blood:    '#b8262c',
    dogBody:  '#c98a3a',
    dogDark:  '#8a5a22',
    dogBelly: '#f0d3a0',
    white:    '#ffffff',
    hudBg:    'rgba(20,24,40,0.55)'
  };

  // 整数像素矩形（防止抗锯齿糊边）
  function px(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
  }

  // 低分辨率下的实心圆（天然带锯齿 = 像素感）
  function circle(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx + 0.5, cy + 0.5, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 把一张像素图（字符串数组 + 调色板映射）画到 ctx
  function drawBitmap(ctx, bitmap, palette, x, y, scale, flipX) {
    scale = scale || 1;
    for (var row = 0; row < bitmap.length; row++) {
      var line = bitmap[row];
      for (var col = 0; col < line.length; col++) {
        var ch = line.charAt(col);
        if (ch === ' ' || ch === '.') continue;
        var color = palette[ch];
        if (!color) continue;
        var dx = flipX ? (line.length - 1 - col) : col;
        px(ctx, x + dx * scale, y + row * scale, scale, scale, color);
      }
    }
  }

  // Bresenham 直线（像素级，避免 canvas 抗锯齿）
  function line(ctx, x0, y0, x1, y1, color) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    var dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    var sx = (x0 < x1) ? 1 : -1, sy = (y0 < y1) ? 1 : -1;
    var err = dx - dy;
    while (true) {
      px(ctx, x0, y0, 1, 1, color);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }

  // 横向重复平铺一个绘制函数（用于背景层）
  function tile(ctx, drawFn, offset, tileW, left, right) {
    var start = Math.floor((left - offset) / tileW) * tileW + offset;
    for (var x = start; x < right + tileW; x += tileW) {
      drawFn(ctx, x - offset);
    }
  }

  PR.gfx = { px: px, circle: circle, line: line, drawBitmap: drawBitmap, tile: tile, COLORS: PR.colors };
})();
