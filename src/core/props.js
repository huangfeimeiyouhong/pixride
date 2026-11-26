// src/core/props.js
// 障碍 / 道具 / 粒子 / HUD 图标 的像素精灵。与野狗共用一张图集（S.misc）。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});
  var gfx = PR.gfx, hex = gfx.hex, shade = gfx.shade, rng = gfx.rng;
  var S = PR.sprites;

  // 多边形向质心收缩 k 像素（用来在轮廓内留出 1px 描边）
  function shrinkPoly(pts, k) {
    var cx = 0, cy = 0, i;
    for (i = 0; i < pts.length; i++) { cx += pts[i][0]; cy += pts[i][1]; }
    cx /= pts.length; cy /= pts.length;
    var out = [];
    for (i = 0; i < pts.length; i++) {
      var dx = pts[i][0] - cx, dy = pts[i][1] - cy, d = Math.sqrt(dx * dx + dy * dy) || 1;
      var f = Math.max(0, (d - k) / d);
      out.push([cx + dx * f, cy + dy * f]);
    }
    return out;
  }

  // ---------------- 障碍 ----------------
  var ROCK = { out: hex('#1c1f27'), base: hex('#8f939d'), lit: hex('#c6ccd6'), dark: hex('#585c67'), moss: hex('#6fa04a') };
  function paintRock(v, seed) {
    var r = rng(seed);
    var w = 24 + r.int(0, 10), h = 14 + r.int(0, 5);
    var pts = [], n = 6, i, a, rad;
    for (i = 0; i <= n; i++) {
      a = Math.PI + (i / n) * Math.PI;
      rad = 0.8 + r() * 0.3;
      pts.push([Math.cos(a) * (w / 2) * rad, Math.sin(a) * h * rad]);
    }
    pts[0][1] = 0; pts[n][1] = 0;
    v.poly(pts, ROCK.out);
    var inn = shrinkPoly(pts, 1.3), c = [0, -h * 0.38];
    v.poly(inn, ROCK.base);
    v.poly([inn[1], inn[2], inn[3], c], ROCK.lit);
    v.poly([inn[3], inn[4], inn[5], c], ROCK.dark);
    v.line(inn[3][0] - 1, inn[3][1] + 1, c[0] + 1, c[1] + 2, ROCK.dark);
    v.px(inn[1][0], inn[1][1] + 2, ROCK.dark);
    v.px(c[0] - 3, c[1] + 1, ROCK.dark); v.px(c[0] + 4, c[1], ROCK.dark); v.px(c[0] - 1, c[1] - 2, ROCK.dark);
    var mx = Math.round(inn[0][0]) + 2;
    v.rect(mx, -2, 5, 2, ROCK.moss); v.px(mx + 6, -1, ROCK.moss); v.px(mx + 2, -3, ROCK.moss);
  }

  function paintLog(v) {
    var O = hex('#22170c'), B = hex('#7b5331'), HI = hex('#a0713f'), DK = hex('#55381f');
    var RING = hex('#d9b07c'), RING2 = hex('#b08850'), MOSS = hex('#6fa04a');
    v.rect(-12, -22, 6, 6, O); v.rect(-11, -21, 4, 5, B); v.hline(-11, -8, -21, HI);   // 断枝
    v.rect(-28, -17, 52, 17, O);
    v.rect(-26, -16, 48, 15, B);
    v.hline(-26, 21, -16, HI); v.hline(-26, 21, -15, HI);
    v.hline(-26, 21, -2, DK); v.hline(-26, 21, -3, DK);
    for (var i = -22; i < 18; i += 6) { v.vline(i, -12, -5, DK); v.px(i + 3, -9, HI); }
    v.ellipse(22, -8, 7, 10, O); v.ellipse(22, -8, 6, 9, RING);       // 年轮端面
    v.ellipse(22, -8, 4, 6, RING2); v.ellipse(22, -8, 2, 3, RING); v.px(22, -8, RING2);
    v.rect(-20, -17, 9, 2, MOSS); v.px(-8, -17, MOSS); v.px(4, -17, MOSS); v.px(9, -16, MOSS);
  }

  function paintPothole(v) {
    v.ellipse(0, -3, 22, 5, hex('#42454d'));
    v.ellipse(0, -3, 20, 4, hex('#16181d'));
    v.ellipse(0, -2, 16, 2, hex('#08080b'));
    v.px(-19, -5, hex('#868b94')); v.px(-13, -7, hex('#868b94')); v.px(12, -6, hex('#868b94'));
    v.px(18, -4, hex('#868b94')); v.px(-4, -7, hex('#5c6068')); v.px(6, -7, hex('#5c6068'));
  }

  function paintIce(v) {
    v.ellipse(0, -4.5, 32, 4.5, hex('#1d3346'));
    v.ellipse(0, -4.5, 31, 3.6, hex('#a8d8f8'));
    v.ellipse(0, -5.5, 28, 2.8, hex('#dcf2ff'));
    v.hline(-24, -10, -6, hex('#ffffff')); v.hline(4, 14, -6, hex('#ffffff'));
    v.line(-6, -7, 2, -3, hex('#7fb8e8')); v.line(10, -7, 18, -3, hex('#7fb8e8')); v.line(-18, -7, -12, -4, hex('#7fb8e8'));
  }

  function paintPuddle(v) {
    v.ellipse(0, -4.5, 26, 4.5, hex('#4a4034'));
    v.ellipse(0, -4.5, 25, 3.5, hex('#9db7cc'));
    v.ellipse(0, -4, 22, 2, hex('#5d6b80'));
    v.hline(-14, -4, -6, hex('#eef4f8')); v.hline(6, 12, -6, hex('#eef4f8'));
  }

  function paintDrift(v) {
    v.ellipse(0, -4, 29, 9, hex('#7f97b8'));
    v.ellipse(0, -5, 28, 8, hex('#f7faff'));
    v.ellipse(6, -2, 18, 4, hex('#cddcf0'));
    v.hline(-20, -6, -10, hex('#ffffff'));
  }

  // 路边大树横伸出路面的低垂树枝（"不要跳"型障碍）；锚点在悬挂部分正下方的地面
  function paintBranch(v) {
    var BK = hex('#1e140a'), WD = hex('#6b4a2b'), WD2 = hex('#8a6238');
    var L = [hex('#1f4a22'), hex('#2f6b2c'), hex('#3f8a38'), hex('#58a648')];
    v.poly([[-99, 0], [-90, 0], [-84, -70], [-82, -118], [-96, -118], [-95, -70]], BK);
    v.poly([[-97, 0], [-92, 0], [-87, -70], [-86, -116], [-94, -116], [-93, -70]], WD);
    v.vline(-91, -60, -8, WD2);
    v.taper(-88, -100, 20, -96, 11, 6, BK); v.taper(-88, -100, 20, -96, 9, 4, WD);
    v.taper(10, -97, 56, -100, 6, 3, BK); v.taper(10, -97, 56, -100, 4, 2, WD);
    v.taper(-40, -99, -30, -88, 5, 3, BK); v.taper(-40, -99, -30, -88, 3, 2, WD);
    var cl = [[-34, -100, 16], [-6, -104, 18], [22, -103, 17], [46, -104, 14], [-20, -92, 12], [8, -93, 13], [36, -94, 12]];
    var i, j;
    for (i = 0; i < cl.length; i++) v.circle(cl[i][0], cl[i][1] - 1, cl[i][2] + 1, BK);
    for (i = 0; i < cl.length; i++) v.circle(cl[i][0], cl[i][1] - 1, cl[i][2], L[1]);
    for (i = 0; i < cl.length; i++) v.circle(cl[i][0] - 3, cl[i][1] - 4, cl[i][2] - 5, L[2]);
    for (i = 0; i < cl.length; i++) v.circle(cl[i][0] - 5, cl[i][1] - 6, cl[i][2] - 9, L[3]);
    for (j = 0; j < 46; j++) {
      var a = gfx.hash(j + 7) * 6.283, d = 0.6 + gfx.hash(j + 99) * 0.45, ci = cl[j % cl.length];
      v.px(ci[0] + Math.cos(a) * ci[2] * d, ci[1] - 1 + Math.sin(a) * ci[2] * d * 0.9, L[(j & 1) ? 0 : 3]);
    }
  }

  // ---------------- 道具 ----------------
  function paintCoin(v, f) {
    var ws = [13, 11, 7, 3, 7, 11];
    var rx = ws[f] / 2, ry = 7;
    v.ellipse(0, -8, rx + 1, ry + 1, hex('#7a4a0c'));
    v.ellipse(0, -8, rx, ry, hex('#ffcf3f'));
    if (rx >= 3.5) {
      v.ellipse(0, -8, rx * 0.55, ry * 0.62, hex('#ffe27a'));
      v.rect(-1, -11, 2, 6, hex('#e0a81f'));
      v.hline(-3, 3, -9, hex('#e0a81f'));
    }
    v.px(-Math.round(rx * 0.5), -12, hex('#fffbe0'));
    if (rx >= 5.5) v.ellipse(rx * 0.55, -8, rx * 0.3, ry * 0.8, hex('#f0b52a'));
  }

  function paintDrink(v) {
    var O = hex('#0f2a16'), A = hex('#3ecf5a'), B = hex('#23913a'), W = hex('#ffffff');
    v.rect(-6, -21, 12, 21, O);
    v.rect(-5, -19, 10, 18, A);
    v.rect(-5, -21, 10, 2, hex('#dfe6ee')); v.hline(-4, 3, -21, W);
    v.vline(-4, -18, -3, hex('#9df5b0'));
    v.vline(4, -18, -3, B);
    v.hline(-5, 4, -2, B);
    v.bmp(['..##.', '.###.', '..##.', '.##..', '#....'], { '#': W }, -3, -15);
  }

  function paintStick(v) {
    v.taper(-17, 2, 17, -6, 5, 3, hex('#2a1a0c'));
    v.taper(-17, 2, 17, -6, 3, 1, hex('#b5763a'));
    v.taper(-15, 1, 0, -3, 1, 1, hex('#d9a060'));
    v.taper(-17, 2, -10, -1, 5, 4, hex('#2a1a0c')); v.taper(-17, 2, -10, -1, 3, 2, hex('#d9433b'));
    v.px(17, -6, hex('#e8c080'));
  }

  function paintMagnet(v) {
    var O = hex('#3a1410'), R = hex('#e8453c'), T = hex('#dfe6ee'), i, hw, wi;
    // U 形：两根立柱 + 下半圆；原点在底部中心
    v.rect(-9, -19, 6, 13, O); v.rect(3, -19, 6, 13, O);
    for (i = 0; i <= 9; i++) { hw = Math.floor(Math.sqrt(100 - i * i)); v.hline(-hw, hw, i - 10, O); }
    v.rect(-8, -19, 4, 11, R); v.rect(4, -19, 4, 11, R);
    for (i = 0; i <= 8; i++) {
      hw = Math.floor(Math.sqrt(64 - i * i));
      wi = i <= 5 ? Math.floor(Math.sqrt(25 - i * i)) : 0;
      if (i <= 5) { v.hline(-hw, -wi - 1, i - 9, R); v.hline(wi, hw, i - 9, R); } else v.hline(-hw, hw, i - 9, R);
    }
    v.rect(-8, -19, 4, 4, T); v.rect(4, -19, 4, 4, T);
    v.hline(-8, -5, -19, hex('#ffffff')); v.hline(4, 7, -19, hex('#ffffff'));
    v.vline(7, -14, -6, hex('#b02a22'));
  }

  function paintGel(v) {
    var O = hex('#5a1c08'), A = hex('#ff7a3d'), W = hex('#ffffff');
    var body = [[-5, -22], [5, -22], [7, -19], [6, -2], [0, 0], [-6, -2], [-7, -19]];
    var inn = shrinkPoly(body, 1.2);
    v.poly(body, O); v.poly(inn, A);
    v.vline(-5, -18, -5, hex('#ffb080'));
    v.hline(-5, 5, -19, hex('#ffd0b0'));
    v.bmp(['..##.', '.###.', '..##.', '.##..', '#....'], { '#': W }, -2, -14);
    v.px(4, -20, O);
  }

  function paintShield(v) {
    v.poly([[0, -22], [9, -19], [9, -11], [0, 0], [-9, -11], [-9, -19]], hex('#12233a'));
    v.poly([[0, -20], [7, -18], [7, -12], [0, -3], [-7, -12], [-7, -18]], hex('#3d8be8'));
    v.poly([[0, -19], [6, -17], [6, -13], [0, -5]], hex('#6cb0ff'));
    v.poly([[0, -16], [1.5, -12.5], [5, -12.5], [2.5, -10.3], [3.5, -6.5], [0, -8.6], [-3.5, -6.5], [-2.5, -10.3], [-5, -12.5], [-1.5, -12.5]], hex('#ffffff'));
  }

  // ---------------- 粒子 ----------------
  function paintPuff(v, r) {
    v.noise(-r, -r, r * 2 + 1, r * 2 + 1, function (x, y) {
      var d = Math.sqrt(x * x + y * y) / r;
      if (d > 1) return 0;
      var a = d < 0.45 ? 190 : (d < 0.8 ? 120 : (((x + y) & 1) ? 70 : 0));
      return gfx.withA(gfx.pack(255, 255, 255), a);
    });
  }
  function paintSpark(v, n) {
    for (var i = -n; i <= n; i++) {
      if (Math.abs(i) * 2 <= n) { v.px(i, 0, hex('#fffbe0')); v.px(0, i, hex('#fffbe0')); }
      else { v.px(i, 0, hex('#ffe070')); v.px(0, i, hex('#ffe070')); }
    }
    v.px(0, 0, hex('#ffffff'));
  }
  function paintRing(v) {
    var r = 12;
    for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d <= r && d > r - 2.2) v.px(dx, dy, gfx.withA(hex('#ffffff'), d > r - 1 ? 210 : 110));
    }
  }
  function paintStar(v, n) {
    var pts = [], i;
    for (i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, rr = (i & 1) ? n * 0.45 : n;
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    v.poly(pts, hex('#7a4a0c'));
    v.poly(shrinkPoly(pts, 0.9), hex('#ffd53a'));
    v.px(-1, -1, hex('#fff6c0'));
  }
  function paintLeaf(v, f) {
    var cols = [hex('#7cc45a'), hex('#e0b040'), hex('#c9702e'), hex('#5fa04a')];
    var c = cols[f];
    var w = [6, 4, 2, 4][f], h = [3, 5, 7, 5][f];
    v.ellipse(0, 0, w / 2 + 1, h / 2 + 1, hex('#24401c'));
    v.ellipse(0, 0, w / 2, h / 2, c);
    v.px(-1, -1, shade(c, 1.3));
  }
  function paintPetal(v, f) {
    var c = f & 1 ? hex('#ffd7e2') : hex('#ffb8cc');
    var w = [4, 3, 2, 3][f], h = [3, 4, 5, 4][f];
    v.ellipse(0, 0, w / 2 + 1, h / 2 + 1, hex('#c07088'));
    v.ellipse(0, 0, w / 2, h / 2, c);
    v.px(0, 0, hex('#ffffff'));
  }
  function paintDot(v, c, r) { v.circle(0, 0, r, c); }
  function paintShadow(v) {
    v.noise(-23, -4, 47, 9, function (x, y) {
      var d = (x * x) / (23 * 23) + (y * y) / (4 * 4);
      return d > 1 ? 0 : gfx.withA(gfx.pack(10, 14, 30), Math.round(110 * Math.pow(1 - d, 0.9)));
    });
  }

  // ---------------- HUD 图标（白色系，画在主画布） ----------------
  var W = hex('#ffffff'), WA = gfx.withA(hex('#ffffff'), 150);
  var ICONS = {
    bolt: [["....##...", "...##....", "..#####..", "..####...", ".#####...", ".###.....", ".##......", "##......."], { '#': hex('#ffe14a') }],
    pause: [["##....##", "##....##", "##....##", "##....##", "##....##", "##....##", "##....##", "##....##"], { '#': W }],
    play: [["#.......", "##......", "###.....", "####....", "#####...", "#####...", "####....", "###.....", "##......", "#......."], { '#': W }],
    sndOn: [["....#.....#.", "...##....#.#", "#####..#...#", "#####.#....#", "#####.#...#.", "#####.#...#.", "#####.#....#", "#####..#...#", "...##....#.#", "....#.....#."], { '#': W }],
    sndOff: [["........#..#", ".......#.#.#", "#####...#..#", "#####..#.#.#", "#####...#..#", "#####..#.#.#", "#####...#..#", "#####..#.#.#", ".......#.#.#", "........#..#"], { '#': W }],
    up: [["....##....", "...####...", "..######..", ".########.", "##########", "...####...", "...####...", "...####...", "...####..."], { '#': W }],
    ff: [["##....##...", ".##....##..", "..##....##.", "...##....##", "...##....##", "..##....##.", ".##....##..", "##....##...", "#.....#...."], { '#': W }],
    stick: [["......#....", ".....##....", "....###....", "...###.....", "..###......", ".###.......", "###........"], { '#': hex('#d9a060') }]
  };

  function iconPaint(rows, pal) { return function (v) { v.bmp(rows, pal, 0, 0); }; }
  function paintPaw(v) {
    v.circle(-5, -8, 2, W); v.circle(0, -10, 2, W); v.circle(5, -8, 2, W);
    v.ellipse(0, -3, 6, 4, W);
    v.circle(-6, -12, 1.5, WA); v.circle(6, -12, 1.5, WA);
  }
  function paintTent(v) {
    v.poly([[0, 0], [9, -13], [18, 0]], hex('#3a2a1a'));
    v.poly([[1, 0], [9, -12], [17, 0]], hex('#ff9f43'));
    v.poly([[6, 0], [9, -6], [12, 0]], hex('#3a2a1a'));
    v.px(9, -14, hex('#dfe6ee')); v.px(9, -13, hex('#dfe6ee'));
  }
  function paintTrophy(v) {
    v.rect(4, -2, 6, 2, hex('#8a5a10')); v.rect(2, 0, 10, 2, hex('#8a5a10'));
    v.poly([[1, -13], [13, -13], [12, -6], [7, -3], [2, -6]], hex('#ffcf3f'));
    v.rect(0, -13, 14, 2, hex('#ffcf3f'));
    v.rect(-2, -12, 3, 2, hex('#ffcf3f')); v.rect(13, -12, 3, 2, hex('#ffcf3f'));
    v.vline(4, -11, -5, hex('#fff3b0'));
  }
  function paintHome(v) {
    v.poly([[-1, -6], [7, -14], [15, -6]], hex('#dfe6ee'));
    v.rect(1, -6, 12, 8, hex('#dfe6ee'));
    v.rect(5, -2, 4, 4, hex('#3a4a6a'));
  }
  function paintMountain(v) {
    v.poly([[-1, 0], [5, -11], [9, -5], [12, -9], [16, 0]], hex('#9ad8ff'));
    v.poly([[3, -8], [5, -11], [7, -8], [6, -7], [5, -8], [4, -7]], hex('#ffffff'));
  }

  // ---------------- 烘焙 ----------------
  S.buildProps = function () {
    var sh = S.misc, p = S.props = {};
    // 所有道具的画师都以"底边中点"为局部原点
    var add = function (w, h, painter, ax, ay) {
      return sh.add(w, h, function (v) { painter(v.sub(w >> 1, h)); }, { ax: ax, ay: ay });
    };
    var i;
    p.rock = [];
    for (i = 0; i < 4; i++) p.rock.push(add(40, 26, (function (s) { return function (v) { paintRock(v, s); }; })(101 + i * 7), 20, 25));
    p.log = add(62, 28, paintLog, 31, 27);
    p.pothole = add(48, 14, paintPothole, 24, 12);
    p.ice = add(68, 14, paintIce, 34, 11);
    p.puddle = add(56, 10, paintPuddle, 28, 8);
    p.drift = add(62, 22, paintDrift, 31, 20);
    p.branch = add(200, 120, paintBranch, 100, 119);
    p.coin = [];
    for (i = 0; i < 6; i++) p.coin.push(add(16, 18, (function (f) { return function (v) { paintCoin(v, f); }; })(i), 8, 17));
    p.drink = add(16, 24, paintDrink, 8, 23);
    p.stick = add(40, 12, paintStick, 20, 10);
    p.magnet = add(22, 20, paintMagnet, 11, 10);
    p.gel = add(18, 24, paintGel, 9, 23);
    p.shield = add(22, 24, paintShield, 11, 23);
    p.puff = [];
    for (i = 0; i < 3; i++) p.puff.push(add(31, 31, (function (r) { return function (v) { paintPuff(v, r); }; })(4 + i * 4), 15, 15));
    p.spark = [];
    for (i = 0; i < 2; i++) p.spark.push(add(15, 15, (function (n) { return function (v) { paintSpark(v, n); }; })(2 + i * 2), 7, 7));
    p.ring = add(27, 27, paintRing, 13, 13);
    p.star = [];
    for (i = 0; i < 2; i++) p.star.push(add(15, 15, (function (n) { return function (v) { paintStar(v, n); }; })(3.5 + i * 2.5), 7, 7));
    p.leaf = [];
    p.petal = [];
    for (i = 0; i < 4; i++) {
      p.leaf.push(add(9, 11, (function (f) { return function (v) { paintLeaf(v, f); }; })(i), 4, 5));
      p.petal.push(add(7, 9, (function (f) { return function (v) { paintPetal(v, f); }; })(i), 3, 4));
    }
    p.snow = add(4, 4, function (v) { v.px(1, 0, hex('#eaf4ff')); v.px(0, 1, hex('#ffffff')); v.px(1, 1, hex('#ffffff')); v.px(2, 1, hex('#ffffff')); v.px(1, 2, hex('#eaf4ff')); }, 2, 2);
    p.drop = add(5, 5, function (v) { v.px(2, 0, hex('#cfe9ff')); v.px(1, 1, hex('#ffffff')); v.px(2, 1, hex('#ffffff')); v.px(2, 2, hex('#9fd0ff')); }, 2, 2);
    p.shadow = add(48, 10, paintShadow, 24, 5);
    // 图标
    var ic = p.ic = {};
    ic.bolt = add(10, 8, iconPaint(ICONS.bolt[0], ICONS.bolt[1]), 5, 7);
    ic.pause = add(8, 8, iconPaint(ICONS.pause[0], ICONS.pause[1]), 4, 7);
    ic.play = add(8, 10, iconPaint(ICONS.play[0], ICONS.play[1]), 4, 9);
    ic.sndOn = add(12, 10, iconPaint(ICONS.sndOn[0], ICONS.sndOn[1]), 6, 9);
    ic.sndOff = add(12, 10, iconPaint(ICONS.sndOff[0], ICONS.sndOff[1]), 6, 9);
    ic.up = add(10, 9, iconPaint(ICONS.up[0], ICONS.up[1]), 5, 8);
    ic.ff = add(11, 9, iconPaint(ICONS.ff[0], ICONS.ff[1]), 5, 8);
    ic.stickI = add(11, 7, iconPaint(ICONS.stick[0], ICONS.stick[1]), 5, 6);
    ic.paw = add(14, 14, paintPaw, 7, 13);
    ic.tent = add(18, 15, paintTent, 9, 14);
    ic.trophy = add(16, 15, paintTrophy, 8, 14);
    ic.home = add(16, 14, paintHome, 8, 13);
    ic.mountain = add(17, 12, paintMountain, 8, 11);
    return p;
  };
})();
