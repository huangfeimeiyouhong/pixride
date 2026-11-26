// src/core/themes.js
// 场景主题与场景美术：6 段滇藏线主题（洱海 / 丽江 / 虎跳峡 / 梅里雪山 / 然乌湖 / 拉萨），
// 以及远山瓦片、道具备用件、云、日月等程序化像素画。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});
  var gfx = PR.gfx, hex = gfx.hex, shade = gfx.shade, mix = gfx.mix, clamp = gfx.clamp, withA = gfx.withA;
  var rng = gfx.rng, hash = gfx.hash, hash3 = gfx.hash3, smooth = gfx.smooth;
  var T = PR.themes = [];
  var A = PR.art = {};

  // ---------------- 主题定义 ----------------
  function def(o) { T.push(o); }

  // 1 大理 · 洱海：清晨晴空，苍山雪顶，洱海波光，白族民居，油菜花田
  def({
    key: 'dali', name: '洱海晨光', place: '大理 → 喜洲', blurb: '苍山不墨千秋画，洱海无弦万古琴',
    sky: ['#2f86d6', '#7cc0ee', '#d8f0fa'],
    sun: { x: 0.72, y: 0.17, r: 12, c: '#fff8dc', glow: '#ffeaa8', ga: 0.42 },
    stars: 0, cloud: { top: '#ffffff', bot: '#c9dcf0', n: 6 },
    haze: { c: '#cfe6f5', a: 0.55 },
    far: { kind: 'peaks', amp: 124, lit: '#9fb8d6', shade: '#6f88ad', snow: '#f6f9fd', snowShade: '#c9dbee', snowLine: 0.68, haze: 0.46, sharp: 0.25 },
    mid: { kind: 'hills', amp: 30, lit: '#86c27a', shade: '#5aa066', haze: 0.26 },
    lake: { top: '#a8d8f0', bot: '#4f93c8' },
    near: { kind: 'forest', amp: 22, lit: '#5aa848', shade: '#3a7c34', haze: 0 },
    props: [['willow', 3], ['pole', 1.2], ['bush', 1.4], ['mani', 0.3]],
    front: ['tuftGreen', 'flowersYellow'],
    grass: ['#7cc64f', '#559b39'], road: { a: '#5f636b', b: '#4d5159', edge: '#bdb5a4', line: '#e9e4d0', spot: '#43474f' },
    house: 'baiHouse', birds: true,
    weather: { kind: 'petal', n: 9 }, lamp: false,
    hazards: ['rock', 'rock', 'log'], dogs: ['yellow'], density: 0.85
  });

  // 2 丽江 · 玉龙雪山：正午，巨型雪峰，松林，纳西民居，草垛
  def({
    key: 'lijiang', name: '玉龙雪山', place: '丽江 → 白汉场', blurb: '雪山不语，松涛入耳',
    sky: ['#2a7fd4', '#74bdf0', '#cfeaf8'],
    sun: { x: 0.8, y: 0.12, r: 11, c: '#fffbe6', glow: '#fff0c0', ga: 0.3 },
    stars: 0, cloud: { top: '#ffffff', bot: '#cfe0f2', n: 5 },
    haze: { c: '#cfe4f5', a: 0.5 },
    far: { kind: 'peaks', amp: 214, lit: '#b3c4de', shade: '#8496b8', snow: '#ffffff', snowShade: '#d5e0f0', snowLine: 0.36, haze: 0.38, sharp: 0.9 },
    mid: { kind: 'forest', amp: 40, lit: '#52996c', shade: '#2f6e4c', haze: 0.18 },
    near: { kind: 'forest', amp: 22, lit: '#2f7a4c', shade: '#1e5634', haze: 0 },
    props: [['pine', 3], ['naxiHouse', 1], ['hay', 0.6], ['fence', 0.8], ['poplar', 0.6], ['bush', 1]],
    front: ['tuftGreen', 'flowersPurple'],
    grass: ['#6fbf4a', '#4c9434'], road: { a: '#5a5e66', b: '#484c54', edge: '#b5ae9c', line: '#e6e2d4', spot: '#3e424a' },
    house: 'naxiHouse',
    weather: { kind: 'leaf', n: 8 }, lamp: false,
    hazards: ['log', 'rock', 'branch'], dogs: ['black'], density: 1
  });

  // 3 虎跳峡 · 金沙江：金色黄昏，红色峭壁，江水奔腾，阵雨
  def({
    key: 'gorge', name: '虎跳峡', place: '桥头 → 中峡', blurb: '金沙江水拍山崖，虎跳峡中浪滔天',
    sky: ['#4a3f86', '#e0785a', '#ffcf78'],
    sun: { x: 0.62, y: 0.4, r: 16, c: '#ffe9b0', glow: '#ffb060', ga: 0.5 },
    stars: 0, cloud: { top: '#ffd9a8', bot: '#d9795a', n: 4 },
    haze: { c: '#f0a870', a: 0.5 },
    far: { kind: 'peaks', amp: 196, lit: '#c07a5a', shade: '#7a4048', haze: 0.46, facet: 0.14, sharp: 0.5 },
    mid: { kind: 'mesa', amp: 62, lit: '#a05a4a', shade: '#5e3440', haze: 0.2, facet: 0.12 },
    river: { c: '#c98a4a', c2: '#e8b86a' },
    near: { kind: 'mesa', amp: 20, lit: '#6a3a3a', shade: '#3e2428', haze: 0, facet: 0.1 },
    props: [['boulder', 1], ['sign', 0.35], ['pineDark', 0.9]],
    front: ['tuftDry'],
    grass: ['#a89a5a', '#7a7040'], road: { a: '#55504f', b: '#454140', edge: '#b09a80', line: '#d9cdb0', spot: '#393635' },
    tint: { c: '#ff9a3c', a: 0.1 },
    weather: { kind: 'rain', n: 46 }, lamp: false,
    hazards: ['rock', 'pothole', 'puddle', 'branch'], dogs: ['yellow', 'black'], density: 1.15
  });

  // 4 白马雪山 · 梅里：星夜，月亮，经幡，牦牛，风雪
  def({
    key: 'meili', name: '白马雪山', place: '奔子栏 → 白马垭口', blurb: '星垂平野阔，月涌大江流',
    sky: ['#070b22', '#16204a', '#3a3a6e'],
    sun: { kind: 'moon', x: 0.7, y: 0.16, r: 11, c: '#f4f6ff', glow: '#aebcff', ga: 0.35 },
    stars: 1, cloud: { top: '#5a6288', bot: '#2a3060', n: 3 },
    haze: { c: '#2a3060', a: 0.3 },
    far: { kind: 'peaks', amp: 196, lit: '#7a8cb8', shade: '#3a466e', snow: '#b8c6ec', snowShade: '#7c8cbc', snowLine: 0.3, haze: 0.3, sharp: 0.8 },
    mid: { kind: 'forest', amp: 34, lit: '#2a3a58', shade: '#141c30', haze: 0 },
    near: { kind: 'forest', amp: 20, lit: '#1a2438', shade: '#0c1220', haze: 0 },
    props: [['stupa', 0.7], ['yak', 0.6], ['tibetHouse', 0.6], ['pineSnow', 2], ['mani', 0.4]],
    front: ['tuftSnow'],
    grass: ['#e8effa', '#c0cee6'], road: { a: '#6a7080', b: '#585e6c', edge: '#eef3fb', line: '#b8c0d0', spot: '#4e5462' },
    house: 'tibetHouse', flags: true,
    tint: { c: '#101a4a', a: 0.2 }, lamp: true,
    weather: { kind: 'snow', n: 60 },
    hazards: ['drift', 'ice', 'rock', 'branch'], dogs: ['wolf'], density: 1.3
  });

  // 5 然乌湖 · 来古冰川：粉霞黎明，镜面湖，冰川，桃花
  def({
    key: 'ranwu', name: '然乌湖', place: '八宿 → 然乌', blurb: '湖光潋滟，冰川倒影，晨霞满天',
    sky: ['#3a4a9c', '#c07ab0', '#ffd9a0'],
    sun: { x: 0.22, y: 0.36, r: 12, c: '#fff0d0', glow: '#ffc0a0', ga: 0.45 },
    stars: 0, cloud: { top: '#ffe0e8', bot: '#c090b8', n: 4 },
    haze: { c: '#e8c0d0', a: 0.5 },
    far: { kind: 'peaks', amp: 186, lit: '#d0d8f0', shade: '#9098c8', snow: '#ffffff', snowShade: '#c0c8f0', snowLine: 0.28, haze: 0.34, sharp: 0.6 },
    mid: { kind: 'hills', amp: 34, lit: '#7a98bc', shade: '#44608a', haze: 0.25 },
    lake: { top: '#d8c0e0', bot: '#7a8cc0' },
    near: { kind: 'forest', amp: 18, lit: '#5c9a78', shade: '#39705a', haze: 0 },
    props: [['stupa', 0.8], ['pineSnow', 2], ['yak', 0.5], ['tibetHouse', 0.4], ['mani', 0.3]],
    front: ['tuftFrost', 'flowersWhite'],
    grass: ['#8cc47a', '#5a9a56'], road: { a: '#5c626c', b: '#4b5058', edge: '#e4ebf2', line: '#dfe6ee', spot: '#424750' },
    house: 'tibetHouse', flags: true, birds: true,
    tint: { c: '#ffc0d8', a: 0.07 },
    weather: { kind: 'snow', n: 26 }, lamp: false,
    hazards: ['ice', 'drift', 'pothole', 'rock'], dogs: ['wolf', 'black'], density: 1.4
  });

  // 6 林芝 → 拉萨：晴日，桃花，布达拉宫
  def({
    key: 'lhasa', name: '布达拉宫', place: '林芝 → 拉萨', blurb: '桃花深处，圣地拉萨',
    sky: ['#2a8ee0', '#7ccbf4', '#dff4fc'],
    sun: { x: 0.76, y: 0.14, r: 12, c: '#fffbe0', glow: '#fff0b0', ga: 0.38 },
    stars: 0, cloud: { top: '#ffffff', bot: '#cfe6f8', n: 6 },
    haze: { c: '#cfe4f0', a: 0.4 },
    far: { kind: 'hills', amp: 112, lit: '#a8c0a0', shade: '#7a9a84', haze: 0.4 },
    mid: { kind: 'forest', amp: 22, lit: '#f0a8c0', shade: '#c87098', haze: 0.1 },
    near: { kind: 'forest', amp: 16, lit: '#4a9a58', shade: '#2a6a3c', haze: 0 },
    props: [['peach', 3], ['poplar', 0.8], ['tibetHouse', 1], ['pole', 0.5], ['bush', 0.8]],
    front: ['tuftGreen', 'flowersPink'],
    grass: ['#7cc94f', '#569c3a'], road: { a: '#5c6068', b: '#4a4e56', edge: '#b8b0a0', line: '#efe9d8', spot: '#41454b' },
    house: 'tibetHouse', flags: true,
    weather: { kind: 'petalPink', n: 12 }, lamp: false,
    hazards: ['rock', 'log', 'pothole', 'branch', 'ice'], dogs: ['yellow', 'black', 'wolf'], density: 1.5,
    potala: true
  });

  // ---------------- 远山瓦片（可无缝平铺） ----------------
  var TW = 1024;
  // 山脊高度曲线
  function makeProfile(kind, W, amp, seed, sharpness) {
    var r = rng(seed), hh = new Float32Array(W), x, i;
    var k1 = r.int(1, 3), k2 = r.int(4, 7), k3 = r.int(12, 19), p1 = r() * 6.283, p2 = r() * 6.283, p3 = r() * 6.283;
    for (x = 0; x < W; x++) {
      var t = x / W * 6.283;
      var n = 0.55 * Math.sin(t * k1 + p1) + 0.3 * Math.sin(t * k2 + p2) + 0.15 * Math.sin(t * k3 + p3);
      hh[x] = amp * (0.5 + 0.5 * n);
    }
    if (kind === 'peaks') {
      // 山体 = 几座宽底山块的包络 × 中频起伏（山肩、支脊）× 细碎锯齿（越高的地方越碎）
      var m = 4 + r.int(0, 2), pk = [], best, d, v, rel, und, jag, sharp = sharpness || 0;
      for (i = 0; i < m; i++) pk.push({ c: (i + 0.15 + r() * 0.7) / m * W, w: W / m * r.range(0.95, 1.45), h: amp * r.range(0.5, 1) });
      for (x = 0; x < W; x++) {
        best = 0;
        for (i = 0; i < m; i++) {
          d = Math.abs(x - pk[i].c); d = Math.min(d, W - d);
          v = pk[i].h * Math.pow(Math.max(0, 1 - Math.pow(d / pk[i].w, 1.7 - 0.7 * sharp)), 1.25 - 0.45 * sharp);
          if (v > best) best = v;
        }
        rel = best / amp;
        und = (pnoise(x / 64, 0.5, 16, 1, seed + 21) - 0.5) * amp * 0.34 * Math.min(1, rel * 2.2);
        jag = ((pnoise(x / 16, 0.5, 64, 1, seed + 22) - 0.5) * 0.1 + (pnoise(x / 8, 0.5, 128, 1, seed + 23) - 0.5) * 0.06) * amp * rel;
        hh[x] = Math.max(2, best + und + jag);
      }
    } else if (kind === 'mesa') {
      for (x = 0; x < W; x++) hh[x] = Math.round(hh[x] / amp * 5) / 5 * amp + 1.5 * Math.sin(x * 0.9);
    } else if (kind === 'forest') {
      var base = new Float32Array(W), sp = r.int(5, 8), k, cx, th, tw, dx, j;
      for (x = 0; x < W; x++) base[x] = amp * 0.3 + hh[x] * 0.35;
      for (k = 0; k * sp < W; k++) {
        cx = Math.round(k * sp + r.int(-2, 2)); th = amp * r.range(0.3, 0.75); tw = r.range(2.5, 4.5);
        for (dx = -Math.ceil(tw); dx <= Math.ceil(tw); dx++) {
          j = (cx + dx + W) % W;
          hh[j] = Math.max(hh[j], base[j] + th * (1 - Math.abs(dx) / (tw + 0.5)));
        }
      }
      for (x = 0; x < W; x++) if (hh[x] < base[x]) hh[x] = base[x];
    } else if (kind === 'fields') {
      for (x = 0; x < W; x++) hh[x] = Math.round(hh[x] / (amp || 1) * 3) / 3 * amp;
    }
    return hh;
  }

  function paintRidge(v, W, H, o) {
    var hh = makeProfile(o.kind, W, o.amp, o.seed, o.sharp);
    var lit = hex(o.lit), sh = hex(o.shade), haze = hex(o.hazeC), mid = mix(sh, lit, 0.5);
    var snow = o.snow ? hex(o.snow) : 0, snowS = o.snowShade ? hex(o.snowShade) : 0, snowM = snow ? mix(snowS, snow, 0.5) : 0;
    var sl = o.amp * (o.snowLine || 0), facet = o.facet || 0;
    var sunSide = o.sunSide, base = o.base, x, y;
    for (x = 0; x < W; x++) {
      // 用 ±5px 的坡向定明暗（避免逐列细条纹），用局部凹陷 / 凸起画沟壑和棱线
      var slope = hh[(x + 5) % W] - hh[(x - 5 + W) % W];
      var curve = hh[(x + 3) % W] + hh[(x - 3 + W) % W] - 2 * hh[x];
      var top = Math.round(base - hh[x]);
      var facing = slope === 0 ? 0 : (slope < 0 ? 1 : -1) * sunSide;      // >0 朝阳
      var q = clamp(0.5 + facing * Math.min(1, Math.abs(slope) / 6) * 0.5, 0, 1), q2 = q < 0.5 ? q * 2 : (q - 0.5) * 2;
      var fc = facet ? 1 + (hash((x >> 4) + o.seed) - 0.5) * facet : 1;
      var sn = sl * (0.8 + 0.4 * hash((x >> 3) + o.seed * 3));
      var hgt = hh[x], snowy = snow && hgt > sn;
      var gully = pnoise(x / 16, 0.5, W / 16, 1, o.seed + 3) * 0.6 + pnoise(x / 8, 0.5, W / 8, 1, o.seed + 4) * 0.4;
      sn += (gully - 0.5) * 26;                                   // 雪顺着沟壑往下延伸
      var depth = Math.max(1, base - top);
      for (y = top; y < H; y++) {
        var d = y - top;
        var c = q < 0.5 ? mix(sh, mid, q2) : mix(mid, lit, q2);                  // 三阶明暗：背光 / 中间调 / 向光
        if (snowy && d < hgt - sn + 2.5) c = q < 0.5 ? mix(snowS, snowM, q2) : mix(snowM, snow, q2);
        c = shade(c, fc);
        var k = smooth(d / 26);
        if (k > 0) c = shade(c, 1 + (gully - 0.5) * 0.2 * k);                     // 侵蚀沟壑（竖向纹理）
        if (curve > 2 && d > 3) c = shade(c, 1 - Math.min(0.2, curve * 0.02) * k); // 山谷折痕压暗
        else if (curve < -2.5 && d > 3) c = shade(c, 1 + Math.min(0.1, -curve * 0.012) * k);   // 山脊棱线提亮
        if (d > 6 && hash3(x, y, o.seed) < 0.035) c = shade(c, 0.9);      // 岩石颗粒
        var ft = smooth(clamp(d / depth, 0, 1));
        if (o.haze) c = mix(c, haze, o.haze * ft);
        v.px(x, y, c);
      }
    }
  }

  // ---------------- 云 / 日月 ----------------
  // 周期性值噪声（保证瓦片左右无缝）：px / py 是以"噪声格"为单位的周期
  function pnoise(x, y, px, py, s) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    var x0 = ((ix % px) + px) % px, x1 = (x0 + 1) % px, y0 = ((iy % py) + py) % py, y1 = (y0 + 1) % py;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    var a = hash3(x0, y0, s), b = hash3(x1, y0, s), c = hash3(x0, y1, s), d = hash3(x1, y1, s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function vnoise(x, y, s) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    var a = hash3(ix, iy, s), b = hash3(ix + 1, iy, s), c = hash3(ix, iy + 1, s), d = hash3(ix + 1, iy + 1, s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }

  // 积云：一团团球体叠加成"密度场"，再用噪声啃出蓬松的菜花边缘；
  // 明暗取密度梯度当法线 → 朝上的面受光、朝下的面背光，底部自然压暗。锚点：底边中点。
  function paintCloud(v, w, h, seed, cTop, cBot, sunSide) {
    var r = rng(seed), n = 5 + r.int(0, 3), bl = [], i;
    for (i = 0; i < n; i++) {
      var u = (i + 0.5) / n, k = Math.sin(u * Math.PI);
      bl.push({ x: (u - 0.5) * w * 0.66 + r.range(-w * 0.03, w * 0.03), y: -h * (0.3 + k * r.range(0.1, 0.3)), r: h * r.range(0.17, 0.27) * (0.7 + 0.5 * k), e: 1 });
    }
    bl.push({ x: 0, y: -h * 0.26, r: w * 0.3, e: 0.3 });            // 扁平底座
    function dens(x, y) {
      var d = 0, dx, dy;
      for (i = 0; i < bl.length; i++) {
        dx = x - bl[i].x; dy = (y - bl[i].y) / bl[i].e;
        d = Math.max(d, bl[i].r / (Math.sqrt(dx * dx + dy * dy) + 0.5));
      }
      return d + (vnoise(x * 0.16, y * 0.16, seed) * 0.6 + vnoise(x * 0.42, y * 0.42, seed + 7) * 0.4 - 0.5) * 0.5;
    }
    var deep = shade(cBot, 0.88), lit = shade(cTop, 1.05), soft = withA(mix(cTop, cBot, 0.3), 130);
    v.noise(-(w >> 1), -h, w, h, function (x, y) {
      var d = dens(x, y);
      if (d < 0.94) return 0;
      if (d < 1) return soft;
      var gx = dens(x + 2, y) - dens(x - 2, y), gy = dens(x, y + 2) - dens(x, y - 2);
      var lam = (0.94 * gy - 0.34 * sunSide * gx) / (Math.sqrt(gx * gx + gy * gy) + 1e-6);
      var c = mix(cBot, cTop, clamp(0.5 + lam * 0.5, 0, 1));
      if (lam < -0.45) c = mix(c, deep, clamp((-0.45 - lam) * 2.5, 0, 1));
      else if (lam > 0.5) c = mix(c, lit, (lam - 0.5) * 1.2);
      if (d < 1.07) c = withA(c, 215);
      return c;
    });
  }
  function paintSun(v, o) {
    var r = o.r, R = Math.round(r * 5.5), core = hex(o.c), glow = hex(o.glow), ga = o.ga;
    v.noise(-R, -R, R * 2 + 1, R * 2 + 1, function (x, y) {
      var d = Math.sqrt(x * x + y * y);
      if (d > R) return 0;
      if (d <= r) return core;
      return gfx.withA(glow, Math.round(255 * ga * Math.pow(1 - (d - r) / (R - r), 2.4)));
    });
    if (o.kind === 'moon') {
      v.circle(r * 0.3, -r * 0.25, r * 0.72, mix(core, hex('#b8c0e8'), 0.55));
      v.circle(-r * 0.3, -r * 0.1, r * 0.12, hex('#c8d0f0')); v.circle(r * 0.05, r * 0.4, r * 0.09, hex('#c8d0f0')); v.circle(-r * 0.15, -r * 0.5, r * 0.07, hex('#c8d0f0'));
    } else {
      v.circle(-r * 0.25, -r * 0.25, r * 0.45, mix(core, hex('#ffffff'), 0.6));
    }
  }

  // ---------------- 道具（全局只烘焙一次） ----------------
  var OUT0 = hex('#161a22');
  function pWillow(v, seed) {
    var r = rng(seed), OUT = hex('#22331a'), TR = hex('#5a4030'), TRH = hex('#7d5c44');
    var G1 = hex('#9ed05e'), G2 = hex('#74ad3e'), G3 = hex('#548a2c'), cl, i;
    v.taper(0, 0, 3, -46, 12, 8, OUT); v.taper(0, 0, 3, -46, 10, 6, TR);
    v.taper(-2, -2, 1, -40, 2, 1, TRH);
    v.taper(3, -46, 30, -72, 7, 3, OUT); v.taper(3, -46, 30, -72, 5, 2, TR);
    v.taper(3, -46, -24, -68, 7, 3, OUT); v.taper(3, -46, -24, -68, 5, 2, TR);
    cl = [[-25, -77, 26, 16], [0, -90, 30, 17], [26, -79, 23, 14], [-6, -72, 20, 9], [14, -100, 17, 10]];
    for (i = 0; i < cl.length; i++) v.ellipse(cl[i][0], cl[i][1] + 1, cl[i][2] + 1, cl[i][3] + 1, OUT);
    for (i = 0; i < cl.length; i++) v.ellipse(cl[i][0], cl[i][1], cl[i][2], cl[i][3], G2);
    for (i = 0; i < cl.length; i++) v.ellipse(cl[i][0] - 3, cl[i][1] - 3, cl[i][2] * 0.66, cl[i][3] * 0.55, G1);
    for (i = 0; i < 34; i++) v.px(r.int(-46, 46), r.int(-104, -66), G3);
    for (var x = -46; x <= 46; x += 3) {
      var y0 = -66 + Math.round(Math.abs(x) / 46 * 14) + r.int(-2, 2), len = r.int(12, 38);
      v.vline(x, y0, y0 + len, G3);
      v.px(x, y0 + len, G1); v.px(x, y0 + len - 6, G2);
    }
  }
  function pPine(v, seed, snowy, dark) {
    var r = rng(seed), OUT = hex('#0e2014');
    var D = hex(dark ? '#173a2c' : '#1d5632'), L = hex(dark ? '#24543c' : '#2a7442'), H = hex(dark ? '#346e50' : '#469a5a'), TR = hex('#4a3222');
    var SN = hex('#f4f8ff'), SS = hex('#c8d8ec');
    var tiers = 6, i, w, ty;
    v.rect(-3, -150, 6, 150, TR); v.vline(-3, -150, -2, shade(TR, 1.35));
    for (i = 0; i < tiers; i++) {
      w = 14 + i * 5.5 + r.int(0, 2); ty = -150 + i * 22;
      v.poly([[0, ty - 1], [w + 2, ty + 31], [-w - 2, ty + 31]], OUT);
      v.poly([[0, ty + 1], [w, ty + 30], [-w, ty + 30]], D);
      v.poly([[0, ty + 1], [w * 0.1, ty + 22], [-w, ty + 30]], L);
      v.line(0, ty + 2, -w * 0.62, ty + 26, H);
      if (snowy) {
        v.poly([[0, ty + 1], [w * 0.78, ty + 24], [w * 0.3, ty + 17], [-w * 0.78, ty + 24]], SN);
        v.poly([[0, ty + 1], [-w * 0.78, ty + 24], [-w * 0.3, ty + 17]], SS);
      }
    }
  }
  function pPoplar(v, seed) {
    var r = rng(seed), OUT = hex('#3a3210'), A = hex('#e0c040'), B = hex('#c09020'), C = hex('#f0d860'), TR = hex('#d8d2c4'), DK = hex('#3a3a30');
    v.rect(-2, -80, 4, 80, TR); v.px(-1, -40, DK); v.px(0, -62, DK); v.px(-1, -22, DK); v.px(0, -8, DK);
    v.ellipse(0, -88, 23, 50, OUT); v.ellipse(0, -88, 22, 49, B); v.ellipse(-3, -92, 15, 38, A); v.ellipse(-6, -100, 8, 20, C);
    for (var i = 0; i < 40; i++) v.px(r.int(-20, 20), r.int(-134, -44), r() < 0.5 ? A : C);
  }
  function pPeach(v, seed) {
    var r = rng(seed), OUT = hex('#2a1a22'), TR = hex('#4a3428'), P1 = hex('#ffd0dd'), P2 = hex('#ff9fbc'), P3 = hex('#e8749a');
    v.taper(0, 0, -4, -34, 12, 8, OUT); v.taper(0, 0, -4, -34, 10, 6, TR);
    var br = [[-30, -58], [6, -62], [28, -50]], i;
    for (i = 0; i < 3; i++) { v.taper(-4, -34, br[i][0], br[i][1], 7, 3, OUT); v.taper(-4, -34, br[i][0], br[i][1], 5, 2, TR); }
    var cl = [[-32, -64, 18, 13], [-10, -78, 19, 13], [12, -76, 18, 12], [32, -58, 15, 11], [0, -58, 14, 9]];
    for (i = 0; i < cl.length; i++) v.ellipse(cl[i][0], cl[i][1] + 1, cl[i][2] + 1, cl[i][3] + 1, OUT);
    for (i = 0; i < cl.length; i++) v.ellipse(cl[i][0], cl[i][1], cl[i][2], cl[i][3], P3);
    for (i = 0; i < cl.length; i++) v.ellipse(cl[i][0] - 3, cl[i][1] - 3, cl[i][2] * 0.72, cl[i][3] * 0.6, P2);
    for (i = 0; i < cl.length; i++) v.ellipse(cl[i][0] - 5, cl[i][1] - 5, cl[i][2] * 0.4, cl[i][3] * 0.32, P1);
    for (i = 0; i < 30; i++) v.px(r.int(-46, 46), r.int(-88, -46), P1);
  }
  function pBush(v, seed, c1, c2, c3) {
    var r = rng(seed), OUT = shade(hex(c3), 0.42), A = hex(c1), B = hex(c2), C = hex(c3);
    var cl = [[-14, -10, 12, 10], [0, -15, 14, 12], [14, -9, 12, 9], [6, -7, 10, 7]], i;
    for (i = 0; i < cl.length; i++) v.ellipse(cl[i][0], cl[i][1], cl[i][2] + 1, cl[i][3] + 1, OUT);
    for (i = 0; i < cl.length; i++) v.ellipse(cl[i][0], cl[i][1], cl[i][2], cl[i][3], C);
    for (i = 0; i < cl.length; i++) v.ellipse(cl[i][0] - 2, cl[i][1] - 3, cl[i][2] * 0.7, cl[i][3] * 0.55, B);
    for (i = 0; i < cl.length; i++) v.ellipse(cl[i][0] - 4, cl[i][1] - 4, cl[i][2] * 0.3, cl[i][3] * 0.22, A);
  }
  function pTuft(v, seed, a, b) {
    var r = rng(seed), A = hex(a), B = hex(b);
    for (var i = -10; i <= 10; i += 3) v.line(i, -1, i + r.int(-3, 3), -r.int(7, 15), (i % 2) ? A : B);
  }
  function pFlowers(v, seed, col, a, b) {
    var r = rng(seed), F = hex(col), C = hex('#ffd53a'), A = hex(a), B = hex(b);
    for (var i = -12; i <= 12; i += 3) v.line(i, -1, i + r.int(-2, 2), -r.int(6, 11), (i % 2) ? A : B);
    for (var k = 0; k < 4; k++) {
      var x = r.int(-10, 10), y = -r.int(9, 17);
      v.px(x - 1, y, F); v.px(x + 1, y, F); v.px(x, y - 1, F); v.px(x, y + 1, F); v.px(x, y, C);
    }
  }
  function winRect(v, x, y, w, h, frame, glass) {
    v.rect(x - 1, y - 1, w + 2, h + 2, frame);
    v.rect(x, y, w, h, glass);
    v.vline(x + (w >> 1), y, y + h - 1, frame); v.hline(x, x + w - 1, y + (h >> 1), frame);
  }
  function pBaiHouse(v, seed) {
    var r = rng(seed), OUT = hex('#1c1c24'), W1 = hex('#f4f2ea'), W2 = hex('#d6d2c6'), RF = hex('#4a5666'), RF2 = hex('#39434f');
    var RFL = hex('#6a788c'), WD = hex('#6a4a2a'), WD2 = hex('#4a321a'), BL = hex('#7a94b8');
    v.rect(-58, -56, 116, 56, OUT); v.rect(-56, -54, 112, 54, W1);
    v.rect(30, -54, 26, 54, W2); v.hline(-56, 55, -54, W2);
    for (var x = -56; x < 56; x += 4) v.vline(x, -4, -1, W2);
    v.rect(-13, -36, 26, 36, OUT); v.rect(-11, -34, 22, 34, WD); v.vline(-1, -34, -1, WD2); v.px(6, -18, hex('#d9c060'));
    winRect(v, -40, -44, 16, 14, OUT, hex('#2a3444')); winRect(v, 24, -44, 16, 14, OUT, hex('#2a3444'));
    v.rect(-54, -50, 36, 2, BL); v.hline(-54, -17, -51, W1);
    v.poly([[-68, -54], [-60, -72], [60, -72], [68, -54]], OUT);
    v.poly([[-66, -55], [-58, -70], [58, -70], [66, -55]], RF);
    for (x = -56; x < 58; x += 4) v.vline(x, -69 + Math.round(Math.abs(x) / 16), -56, RF2);
    v.hline(-59, 59, -70, RFL);
    v.rect(-63, -74, 126, 3, OUT); v.hline(-61, 61, -73, RFL);
    v.rect(-67, -77, 5, 4, OUT); v.rect(62, -77, 5, 4, OUT);
    v.px(-66, -78, RFL); v.px(65, -78, RFL);
  }
  function pNaxiHouse(v, seed) {
    var OUT = hex('#1c1c22'), W1 = hex('#d9b98a'), W2 = hex('#b89668'), RF = hex('#4f5660'), RF2 = hex('#3a4048'), RFL = hex('#7a828e');
    var WD = hex('#5a3a1e'), WD2 = hex('#3a2410'), L = hex('#c94f3a'), TL = hex('#e0e4ea');
    v.rect(-56, -50, 112, 50, OUT); v.rect(-54, -48, 108, 48, W1);
    v.rect(28, -48, 26, 48, W2);
    for (var x = -54; x < 54; x += 6) v.vline(x, -48, -1, W2);
    v.rect(-12, -32, 24, 32, OUT); v.rect(-10, -30, 20, 30, WD); v.vline(-1, -30, -1, WD2);
    winRect(v, -38, -38, 16, 14, OUT, hex('#2a2a30')); winRect(v, 24, -38, 16, 14, OUT, hex('#2a2a30'));
    v.rect(-56, -50, 112, 3, L);
    v.poly([[-66, -50], [-58, -68], [58, -68], [66, -50]], OUT);
    v.poly([[-64, -51], [-56, -66], [56, -66], [64, -51]], RF);
    for (x = -54; x < 56; x += 4) v.vline(x, -65 + Math.round(Math.abs(x) / 16), -53, RF2);
    v.rect(-61, -70, 122, 3, OUT); v.hline(-59, 59, -69, RFL);
    v.rect(-64, -74, 128, 5, OUT); v.rect(-62, -73, 124, 3, TL); v.hline(-62, 61, -73, hex('#ffffff'));
  }
  function pTibetHouse(v, seed) {
    var r = rng(seed), OUT = hex('#16161c'), W1 = hex('#e6e2d8'), W2 = hex('#b8b4aa'), ST = hex('#8a8a92');
    var R = hex('#b03a30'), R2 = hex('#7a241c'), B = hex('#2a4a9a'), G = hex('#2a8a5a'), WD = hex('#2a1e14');
    v.rect(-58, -62, 116, 62, OUT); v.rect(-56, -60, 112, 60, W1);
    for (var y = -60; y < 0; y += 6) for (var x = -56 + ((y / 6) & 1) * 6; x < 56; x += 12) { v.hline(x, x + 10, y, W2); }
    v.rect(26, -60, 30, 60, W2);
    v.rect(-56, -60, 112, 10, R2);                                   // 檐下棕色白玛墙
    v.hline(-56, 55, -60, R);
    // 窗（黑色梯形框 + 彩色过梁）
    var wx = [-40, -8, 24], i;
    for (i = 0; i < 3; i++) {
      var x = wx[i];
      v.poly([[x - 9, -50], [x + 9, -50], [x + 7, -32], [x - 7, -32]], OUT);
      v.rect(x - 5, -48, 10, 14, WD);
      v.vline(x, -48, -35, W2); v.hline(x - 5, x + 4, -42, W2);
      v.rect(x - 10, -54, 20, 2, B); v.rect(x - 9, -56, 18, 2, G); v.rect(x - 8, -58, 16, 2, R);
    }
    v.rect(-12, -34, 24, 34, OUT); v.rect(-10, -32, 20, 32, WD); v.rect(-10, -32, 4, 32, R2); v.px(4, -16, hex('#d9c060'));
    // 平顶 + 女儿墙
    v.rect(-60, -66, 120, 6, OUT); v.rect(-58, -65, 116, 4, ST); v.hline(-58, 57, -65, W2);
    v.rect(-60, -70, 120, 4, OUT); v.hline(-58, 57, -69, R2);
    for (i = 0; i < 3; i++) v.rect(-44 + i * 36, -74 - r.int(0, 3), 22, 5, hex('#c9a84a'));   // 屋顶晾晒的谷物
  }
  function pStupa(v) {
    var OUT = hex('#2a2a3a'), W1 = hex('#f4f4f8'), W2 = hex('#c0c6d8'), GD = hex('#e0b030'), GD2 = hex('#a87810');
    v.rect(-21, -14, 42, 14, OUT); v.rect(-19, -12, 38, 12, W2); v.hline(-19, 18, -12, W1); v.hline(-19, 18, -6, W2);
    v.rect(-16, -23, 32, 10, OUT); v.rect(-14, -21, 28, 7, W1);
    v.circle(0, -36, 16, OUT); v.circle(0, -36, 15, W1);
    v.circle(-5, -41, 6, hex('#ffffff'));
    for (var dy = -8; dy <= 8; dy++) v.px(Math.floor(Math.sqrt(225 - dy * dy)), -36 + dy, W2);
    v.rect(-8, -64, 16, 15, OUT); v.rect(-6, -62, 12, 11, GD);
    for (var y = -60; y <= -52; y += 2) v.hline(-6, 5, y, GD2);
    v.rect(-9, -67, 18, 3, OUT); v.hline(-7, 6, -66, GD);
    v.circle(0, -72, 5, OUT); v.circle(0, -72, 4, GD); v.px(0, -79, GD); v.px(0, -78, GD2);
  }
  function pYak(v, seed) {
    var r = rng(seed), OUT = hex('#0c0c12'), B = hex('#2e2628'), BL = hex('#3a3032'), HI = hex('#5a4c4a'), HI2 = hex('#7a6860');
    var HN = hex('#e8dcc0'), HN2 = hex('#c8b898'), NOSE = hex('#b88a80'), LEG = hex('#241e20'), TIP = hex('#4a3e3c');
    var lx = [-32, -16, 12, 26], i, x, y;
    for (i = 0; i < 2; i++) { v.rect(lx[i + 1] + 4, -30, 8, 30, OUT); v.rect(lx[i + 1] + 5, -30, 6, 28, hex('#1a1416')); }   // 远侧的腿
    for (i = 0; i < 4; i++) { v.rect(lx[i], -32, 9, 32, OUT); v.rect(lx[i] + 1, -32, 6, 30, LEG); v.rect(lx[i] + 1, -5, 6, 3, TIP); }
    v.taper(-30, -52, 30, -54, 40, 38, OUT); v.taper(-30, -52, 30, -54, 38, 36, B);             // 躯干
    v.ellipse(-4, -60, 34, 14, OUT); v.ellipse(-4, -60, 32, 12, B);
    v.ellipse(-8, -66, 16, 8, OUT); v.ellipse(-8, -66, 14, 6, HI);                              // 驼峰
    v.taper(-26, -64, 26, -66, 8, 7, HI);                                                      // 背脊受光
    for (x = -30; x < 32; x += 4) v.vline(x, -42, -34 - (x & 1) * 2 - r.int(0, 2), OUT);        // 腹下垂毛
    for (i = 0; i < 26; i++) { x = r.int(-30, 30); y = r.int(-66, -40); v.px(x, y, r() < 0.5 ? BL : HI2); }   // 毛发颗粒
    v.taper(30, -54, 46, -40, 20, 16, OUT); v.taper(30, -54, 46, -40, 18, 14, BL);              // 低垂的头
    v.circle(48, -36, 10, OUT); v.circle(48, -36, 9, BL);
    v.ellipse(54, -31, 7, 5, OUT); v.ellipse(54, -31, 6, 4, NOSE); v.rect(51, -28, 7, 1, hex('#7a4a48'));
    v.circle(44, -40, 3, OUT); v.circle(44, -40, 2, hex('#2a1e1e'));                            // 耳
    v.px(49, -40, hex('#ffffff')); v.px(49, -39, hex('#101010'));
    v.taper(44, -45, 34, -60, 5, 2.5, OUT); v.taper(44, -45, 34, -60, 3, 1, HN);                // 角
    v.taper(34, -60, 32, -68, 3, 1, OUT); v.taper(34, -60, 32, -68, 1.5, 0.5, HN2);
    v.taper(52, -45, 62, -60, 5, 2.5, OUT); v.taper(52, -45, 62, -60, 3, 1, HN);
    v.taper(62, -60, 64, -68, 3, 1, OUT); v.taper(62, -60, 64, -68, 1.5, 0.5, HN2);
    v.taper(-30, -52, -38, -36, 5, 3, OUT); v.taper(-30, -52, -38, -36, 3, 2, B);              // 尾巴
    v.circle(-38, -34, 3, OUT); v.circle(-38, -34, 2, TIP);
  }
  function pPole(v) {
    v.rect(-2, -146, 5, 146, OUT0); v.rect(-1, -145, 3, 145, hex('#8a8f99')); v.vline(-1, -145, -2, hex('#b0b6c0'));
    v.rect(-9, -133, 18, 3, OUT0); v.rect(-8, -132, 16, 1, hex('#6a5a48'));
    v.rect(-7, -118, 14, 3, OUT0); v.rect(-6, -117, 12, 1, hex('#6a5a48'));
    v.px(-8, -134, hex('#dfe6ee')); v.px(7, -134, hex('#dfe6ee')); v.px(-6, -119, hex('#dfe6ee')); v.px(5, -119, hex('#dfe6ee'));
  }
  function pMani(v, seed) {
    var r = rng(seed), C = [hex('#f0f0f0'), hex('#3a5aa8'), hex('#c9403a'), hex('#3a9a5a'), hex('#e0c040')], i;
    for (i = 0; i < 7; i++) {
      var x = -18 + i * 6 + r.int(-1, 1), y = -r.int(6, 16), w = r.int(7, 11), h = r.int(4, 7);
      v.rect(x, y, w, h, OUT0); v.rect(x + 1, y + 1, w - 2, h - 2, C[i % 5]);
    }
    v.rect(-10, -24, 9, 7, OUT0); v.rect(-9, -23, 7, 5, C[0]);
  }
  function pFence(v) {
    var OUT = hex('#241808'), A = hex('#8a6a42'), B = hex('#6a4a2a'), i;
    for (i = 0; i < 4; i++) { v.rect(-58 + i * 36, -28, 6, 28, OUT); v.rect(-57 + i * 36, -27, 4, 26, A); v.vline(-57 + i * 36, -27, -2, hex('#a8845a')); }
    v.rect(-60, -23, 120, 4, OUT); v.rect(-59, -22, 118, 2, B);
    v.rect(-60, -12, 120, 4, OUT); v.rect(-59, -11, 118, 2, B);
  }
  function pSign(v) {
    v.rect(-2, -56, 5, 56, OUT0); v.rect(-1, -55, 3, 55, hex('#8a8f99'));
    v.rect(-26, -86, 52, 32, OUT0); v.rect(-24, -84, 48, 28, hex('#2a7a4a')); v.rect(-22, -82, 44, 1, hex('#9ad8b0'));
    v.rect(-16, -76, 32, 3, hex('#ffffff')); v.rect(-12, -68, 24, 3, hex('#ffffff'));
  }
  function pTent(v) {
    var OUT = hex('#2a1408'), A = hex('#f28a3a'), B = hex('#d06a22'), C = hex('#ffb070');
    v.poly([[-50, 0], [-30, -52], [30, -52], [50, 0]], OUT);
    v.poly([[-48, 0], [-28, -50], [28, -50], [48, 0]], A);
    v.poly([[-48, 0], [-28, -50], [0, -50], [-14, 0]], B);
    v.poly([[0, -50], [28, -50], [48, 0], [14, 0]], C);
    v.poly([[-12, 0], [0, -34], [12, 0]], OUT);
    v.poly([[-9, 0], [0, -28], [9, 0]], hex('#3a1e10'));
    v.line(-30, -52, -44, 0, OUT); v.line(30, -52, 44, 0, OUT);
  }
  function pBoat(v) {
    v.poly([[-20, -8], [20, -8], [14, -1], [-16, -1]], OUT0); v.poly([[-19, -7], [19, -7], [13, -2], [-15, -2]], hex('#e8e4d8'));
    v.rect(-6, -10, 12, 3, hex('#4a5666')); v.vline(0, -26, -8, hex('#5a4030')); v.poly([[1, -26], [15, -10], [1, -10]], hex('#f4f0e4'));
  }
  function pHay(v, seed) {
    var r = rng(seed), OUT = hex('#4a3410'), A = hex('#d9b04a'), B = hex('#b0882a'), C = hex('#f0d070');
    v.poly([[-20, 0], [-22, -20], [-12, -40], [0, -48], [12, -40], [22, -20], [20, 0]], OUT);
    v.poly([[-19, 0], [-21, -20], [-11, -39], [0, -47], [11, -39], [21, -20], [19, 0]], A);
    for (var i = 0; i < 16; i++) { var x = r.int(-16, 16), y = -r.int(4, 38); v.hline(x, x + 4, y, B); v.px(x + 2, y - 1, C); }
    v.vline(0, -56, -46, OUT); v.vline(0, -56, -47, hex('#8a6a42'));
  }
  function pBoulder(v, seed, c1, c2, c3) {
    var r = rng(seed), pts = [], n = 8, i, a, rad;
    var OUT = shade(hex(c3), 0.4), L = hex(c1), M = hex(c2), D = hex(c3);
    var w = 90 + r.int(0, 26), h = 54 + r.int(0, 22);
    for (i = 0; i <= n; i++) {
      a = Math.PI + (i / n) * Math.PI; rad = 0.78 + r() * 0.3;
      pts.push([Math.cos(a) * (w / 2) * rad, Math.sin(a) * h * rad]);
    }
    pts[0][1] = 0; pts[n][1] = 0;
    v.poly(pts, OUT);
    var inn = [], cx = 0, cy = -h * 0.35;
    for (i = 0; i < pts.length; i++) { var dx = pts[i][0] - cx, dy = pts[i][1] - cy, d = Math.sqrt(dx * dx + dy * dy) || 1, f = Math.max(0, (d - 1.6) / d); inn.push([cx + dx * f, cy + dy * f]); }
    v.poly(inn, M);
    v.poly([inn[1], inn[2], inn[3], [cx, cy]], L);
    v.poly([inn[3], inn[4], inn[5], inn[6], [cx, cy]], D);
    v.line(inn[3][0] - 2, inn[3][1] + 3, cx + 2, cy + 4, D); v.line(inn[2][0] + 2, inn[2][1] + 4, cx - 6, cy - 2, OUT);
    for (i = 0; i < 10; i++) v.px(r.int(-w / 3, w / 3), -r.int(4, h * 0.6), D);
  }
  function pPotala(v) {
    var OUT = hex('#1c1418'), W1 = hex('#f6f2ea'), W2 = hex('#d0c8bc'), RD = hex('#9a3028'), RD2 = hex('#6e1e1c');
    var GD = hex('#e0b030'), GD2 = hex('#a87810'), BK = hex('#1c1418'), GR = hex('#5a5a60');
    // 山体
    v.poly([[-215, 0], [-180, -60], [-120, -96], [120, -96], [180, -60], [215, 0]], OUT);
    v.poly([[-212, 0], [-178, -59], [-119, -94], [119, -94], [178, -59], [212, 0]], GR);
    for (var x = -200; x < 200; x += 16) v.vline(x, -Math.round(60 * (1 - Math.abs(x) / 260)), -1, shade(GR, 0.86));
    // 白宫两翼
    v.rect(-192, -118, 384, 118, OUT);
    v.rect(-190, -116, 150, 114, W1); v.rect(40, -116, 150, 114, W1);
    v.rect(112, -116, 78, 114, W2); v.rect(-40, -116, 80, 114, W2);
    // 红宫
    v.rect(-46, -156, 92, 156, OUT); v.rect(-44, -154, 88, 152, RD);
    v.rect(22, -154, 22, 152, RD2);
    v.rect(-44, -128, 88, 3, W1); v.rect(-44, -96, 88, 3, W1);
    // 金顶
    v.poly([[-58, -156], [-46, -172], [46, -172], [58, -156]], OUT);
    v.poly([[-56, -157], [-45, -170], [45, -170], [56, -157]], GD);
    v.poly([[-56, -157], [-45, -170], [0, -170], [0, -160]], hex('#f0cc50'));
    for (x = -40; x < 46; x += 8) v.vline(x, -169, -158, GD2);
    v.poly([[-30, -172], [-20, -184], [20, -184], [30, -172]], OUT); v.poly([[-28, -173], [-19, -182], [19, -182], [28, -173]], GD);
    v.rect(-4, -196, 8, 13, OUT); v.rect(-2, -194, 4, 11, GD);
    // 窗
    for (var wy = 0; wy < 3; wy++) for (x = -176; x < 176; x += 16) {
      if (x > -50 && x < 44) continue;
      v.rect(x, -102 + wy * 30, 7, 11, BK); v.rect(x + 2, -100 + wy * 30, 3, 8, hex('#4a3a30'));
    }
    for (x = -34; x < 40; x += 12) for (wy = 0; wy < 4; wy++) {
      if (wy === 1 && (x < -6 || x > 4)) continue;
      v.rect(x, -148 + wy * 26, 7, 12, BK); v.rect(x + 2, -146 + wy * 26, 3, 9, hex('#4a3a30'));
    }
  }

  // 道具注册表：尺寸 + 画师（seed, 主题色参数）
  var PROPS = {
    willow: { w: 108, h: 128, paint: pWillow },
    pine: { w: 84, h: 156, paint: function (v, s) { pPine(v, s, false, false); } },
    pineDark: { w: 84, h: 156, paint: function (v, s) { pPine(v, s, false, true); } },
    pineSnow: { w: 84, h: 156, paint: function (v, s) { pPine(v, s, true, false); } },
    poplar: { w: 54, h: 140, paint: pPoplar },
    peach: { w: 94, h: 98, paint: pPeach },
    bush: { w: 56, h: 34, paint: function (v, s) { pBush(v, s, '#9ed05e', '#6fae3e', '#4a8a2c'); } },
    boulder: { w: 122, h: 88, paint: function (v, s) { pBoulder(v, s, '#c08468', '#8a5048', '#4e2a30'); } },
    tuftGreen: { w: 26, h: 18, paint: function (v, s) { pTuft(v, s, '#a8e060', '#5aa03a'); } },
    tuftDry: { w: 26, h: 18, paint: function (v, s) { pTuft(v, s, '#e0c870', '#a08a40'); } },
    tuftSnow: { w: 26, h: 18, paint: function (v, s) { pTuft(v, s, '#eef4ff', '#a8bcd8'); } },
    tuftFrost: { w: 26, h: 18, paint: function (v, s) { pTuft(v, s, '#d8f0c0', '#7ab05a'); } },
    flowersYellow: { w: 30, h: 20, paint: function (v, s) { pFlowers(v, s, '#ffe14a', '#a8e060', '#5aa03a'); } },
    flowersPurple: { w: 30, h: 20, paint: function (v, s) { pFlowers(v, s, '#c89aff', '#8ad05a', '#4a9a3a'); } },
    flowersWhite: { w: 30, h: 20, paint: function (v, s) { pFlowers(v, s, '#ffffff', '#a8d888', '#6aa858'); } },
    flowersPink: { w: 30, h: 20, paint: function (v, s) { pFlowers(v, s, '#ff9fc0', '#9ad860', '#58a038'); } },
    baiHouse: { w: 140, h: 100, paint: pBaiHouse },
    naxiHouse: { w: 128, h: 94, paint: pNaxiHouse },
    tibetHouse: { w: 128, h: 108, paint: pTibetHouse },
    stupa: { w: 60, h: 112, paint: pStupa },
    yak: { w: 100, h: 72, paint: pYak },
    pole: { w: 22, h: 150, paint: pPole },
    mani: { w: 46, h: 28, paint: pMani },
    fence: { w: 124, h: 34, paint: pFence },
    sign: { w: 56, h: 88, paint: pSign },
    tent: { w: 104, h: 68, paint: pTent },
    boat: { w: 46, h: 30, paint: pBoat },
    hay: { w: 50, h: 58, paint: pHay },
    potala: { w: 440, h: 200, paint: pPotala }
  };
  A.PROPS = PROPS;
  var VARIANTS = 3;

  // 全局静态道具：只烘焙一次
  A.buildStatic = function () {
    if (A.things) return A.things;
    var sheet = new gfx.Sheet(1024, 1024), things = A.things = { sheet: sheet };
    var names = ['potala', 'willow', 'pine', 'pineDark', 'pineSnow', 'poplar', 'peach', 'bush', 'boulder',
      'baiHouse', 'naxiHouse', 'tibetHouse', 'stupa', 'yak', 'pole', 'mani', 'fence', 'sign', 'tent', 'boat', 'hay',
      'tuftGreen', 'tuftDry', 'tuftSnow', 'tuftFrost', 'flowersYellow', 'flowersPurple', 'flowersWhite', 'flowersPink'];
    for (var k = 0; k < names.length; k++) {
      var nm = names[k], d = PROPS[nm], list = things[nm] = [];
      var nv = (nm === 'potala') ? 1 : VARIANTS;
      for (var i = 0; i < nv; i++) {
        list.push(sheet.add(d.w, d.h, (function (p, s) { return function (v, w, h) { p(v.sub(w >> 1, h), s); }; })(d.paint, 11 + i * 13 + k * 7), { ax: d.w >> 1, ay: d.h - 1 }));
      }
    }
    return things;
  };

  // ---------------- 主题烘焙 ----------------
  var FAR_H = 300, MID_H = 150, NEAR_H = 96, CLOUD_H = 54;
  A.FAR_H = FAR_H; A.MID_H = MID_H; A.NEAR_H = NEAR_H;
  A.build = function (ti) {
    var def = T[ti], sunSide = def.sun.x > 0.5 ? 1 : -1;
    var sheet = new gfx.Sheet(1024, 1024), art = { def: def, sheet: sheet, sunSide: sunSide };
    var mk = function (o, H, base) {
      return sheet.add(TW, H, function (v) {
        paintRidge(v, TW, H, { kind: o.kind, amp: o.amp, lit: o.lit, shade: o.shade, snow: o.snow, snowShade: o.snowShade, snowLine: o.snowLine,
          haze: o.haze, hazeC: def.haze.c, facet: o.facet, sunSide: sunSide, base: base, seed: ti * 31 + H, sharp: o.sharp });
      }, { pad: 0 });
    };
    art.far = mk(def.far, FAR_H, 274); art.far.base = 274;
    art.mid = mk(def.mid, MID_H, 96); art.mid.base = 96;
    art.near = mk(def.near, NEAR_H, 40); art.near.base = 40;
    art.clouds = [];
    var cw = [150, 190, 120, 220, 165];
    for (var i = 0; i < cw.length; i++) {
      art.clouds.push(sheet.add(cw[i], CLOUD_H, (function (w, s) { return function (v) { paintCloud(v.sub(w >> 1, CLOUD_H), w, CLOUD_H, s, hex(def.cloud.top), hex(def.cloud.bot), sunSide); }; })(cw[i], i * 17 + ti * 5), { pad: 1 }));
    }
    var sun = def.sun, R = Math.round(sun.r * 5.5) + 1;
    art.sun = sheet.add(R * 2 + 2, R * 2 + 2, function (v) { paintSun(v.sub(R + 1, R + 1), sun); }, { ax: R + 1, ay: R + 1 });
    return art;
  };
})();
