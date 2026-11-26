// src/core/sprites.js
// 角色精灵：骑行者 + 自行车、车轮辐条、野狗（三品种 × 多姿势）。
// 全部用"参数化骨骼 + 逐像素光栅化"程序化绘制，烘焙进离屏图集；运行时每个精灵只需 1 次 drawImage。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});
  var gfx = PR.gfx, hex = gfx.hex, shade = gfx.shade;
  var S = PR.sprites = {};

  var P = {
    outline: hex('#161c28'), flash: hex('#ffffff'),
    skin: hex('#f2c79b'), skinDk: hex('#d9a877'), shorts: hex('#2f3f63'),
    jersey: hex('#f6901e'), jerseyHi: hex('#ffc062'), white: hex('#f4f6f8'),
    shoe: hex('#1c1c26'), sole: hex('#e9edf2'), glove: hex('#25252f'),
    helmet: hex('#e83f36'), helmetHi: hex('#ff7d70'), helmetDk: hex('#b0251f'),
    frame: hex('#3d78c4'), frameHi: hex('#a5ccff'), frameDk: hex('#1f4576'),
    tire: hex('#23232b'), tireHi: hex('#3d3d4a'),
    rim: hex('#c2ccd8'), rimDk: hex('#8290a2'), rimHi: hex('#f4f8fc'),
    metal: hex('#b4bec9'), metalDk: hex('#566070'), spoke: hex('#aeb9c6'),
    bag: hex('#7a4b2a'), bagDk: hex('#52301a'), roll: hex('#f2c23e'), rollDk: hex('#c7931c'),
    bottle: hex('#ff7a3d'), lamp: hex('#fff6c8'),
    glass: hex('#151823'), glassHi: hex('#8fd3ff'),
    chain: hex('#2b313c')
  };

  // ---------------- 骑行者 + 自行车 ----------------
  // 局部坐标：后轮轴心为原点，x 向右为正，y 向下为正；精灵锚点 = 后轮轴心
  var RW = 96, RHT = 88, RAX = 20, RAY = 70;

  function paintRider(view, o) {
    var v = view.sub(RAX, RAY);      // 局部原点 = 后轮轴心
    var s = o.tilt * 0.045;          // 坡度：车头抬升量/每 px
    var pose = o.pose;
    function C(c) { return o.flash ? P.flash : c; }
    function ty(x, y) { return y - x * s; }

    // 车架关键点
    var RH = [0, 0], FH = [54, ty(54, 0)], BB = [20, ty(20, 3)];
    var ST = [13, ty(13, -27)], HT = [46, ty(46, -24)], HB = [50, ty(50, -14)];

    // 曲柄角（顺时针 = 向前蹬）
    var a;
    if (pose === 'ride') a = (o.ph / 8) * Math.PI * 2;
    else if (pose === 'coast') a = 0.12 + o.ph * Math.PI;
    else if (pose === 'duck') a = 0.3 + o.ph * Math.PI;
    else if (pose === 'air') a = o.ph ? 2.5 : 2.15;
    else a = 0.95;
    var ca = Math.cos(a), sa = Math.sin(a);
    var near = [BB[0] + ca * 7, BB[1] + sa * 7];
    var far = [BB[0] - ca * 7, BB[1] - sa * 7];

    // 身体关键点
    var hip = [11, ty(11, -30)];
    var sh = [33, ty(33, -46)];
    if (pose === 'ride' && o.sprint) sh = [36, ty(36, -44)];
    else if (pose === 'air') sh = [34, ty(34, -43)];
    else if (pose === 'hurt') sh = [25, ty(25, -49)];
    else if (pose === 'cheer') sh = [28, ty(28, -50)];
    else if (pose === 'duck') sh = [40, ty(40, -33)];
    var head = pose === 'hurt' ? [sh[0] + 5, sh[1] - 7] : [sh[0] + 7, sh[1] - 6];
    var grip = [51, ty(51, -29)];
    var elb = [(sh[0] + grip[0]) / 2 + 1, (sh[1] + grip[1]) / 2 + 1], hand = grip;
    if (pose === 'hurt') { elb = [sh[0] + 9, sh[1] + 9]; hand = [sh[0] + 6, sh[1] + 15]; }
    if (pose === 'cheer') { elb = [sh[0] + 6, sh[1] - 3]; hand = [sh[0] + 3, sh[1] - 12]; }

    var fn, ff;
    if (pose === 'hurt') { fn = [6, ty(6, -5)]; ff = [17, ty(17, 1)]; }
    else { fn = [near[0] + 1, near[1] - 3.5]; ff = [far[0] + 1, far[1] - 3.5]; }

    // 两段骨骼 IK：膝盖朝前上方
    function knee(hx, hy, fx, fy) {
      var dx = fx - hx, dy = fy - hy, d = Math.sqrt(dx * dx + dy * dy) || 0.001;
      var maxd = 43.4;
      var dd = d > maxd ? maxd : d;
      var ux = dx / d, uy = dy / d, A = (22 * 22 - 22 * 22 + dd * dd) / (2 * dd);
      var h = Math.sqrt(Math.max(0, 22 * 22 - A * A));
      return [hx + ux * A + uy * h, hy + uy * A - ux * h];
    }

    function leg(hx, hy, fx, fy, dk) {
      var m = dk ? 0.72 : 1;
      var k = knee(hx, hy, fx, fy);
      v.thick(hx, hy, k[0], k[1], 11, P.outline);
      v.thick(k[0], k[1], fx, fy, 7, P.outline);
      v.thick(hx, hy, k[0], k[1], 9, C(shade(P.skin, m)));
      v.taper(hx, hy, hx + (k[0] - hx) * 0.64, hy + (k[1] - hy) * 0.64, 11, 9, C(shade(P.shorts, m)));
      v.taper(k[0], k[1], fx, fy, 6, 4.5, C(shade(P.skin, m)));
      // 袜子
      v.thick(k[0] + (fx - k[0]) * 0.74, k[1] + (fy - k[1]) * 0.74, fx, fy, 5, C(shade(P.white, m)));
      // 鞋
      v.rect(fx - 3, fy - 2, 9, 4, P.outline);
      v.rect(fx - 2, fy - 1, 7, 2, C(shade(P.shoe, m)));
      v.hline(fx - 3, fx + 5, fy + 1, C(shade(P.sole, m)));
      v.px(fx + 5, fy, C(shade(P.white, m)));
    }

    function arm(sx, sy, ex, ey, hx, hy, dk) {
      var m = dk ? 0.72 : 1;
      v.thick(sx, sy, ex, ey, 9, P.outline);
      v.thick(ex, ey, hx, hy, 7, P.outline);
      v.taper(sx, sy, ex, ey, 7, 6, C(shade(P.jersey, m)));
      v.taper(ex, ey, hx, hy, 5.5, 5, C(shade(P.skin, m)));
      v.circle(hx + 1, hy, 3, P.outline);
      v.circle(hx + 1, hy, 2, C(shade(P.glove, m)));
    }

    function wheel(c) {
      v.circle(c[0], c[1], 13, C(P.tire));
      var k, an;
      for (k = 0; k < 20; k++) {
        an = k * Math.PI / 10 + 0.08;
        v.px(c[0] + Math.cos(an) * 12.4, c[1] + Math.sin(an) * 12.4, C(P.tireHi));
      }
      for (k = 0; k <= 6; k++) {
        an = Math.PI + k * Math.PI / 6;
        v.px(c[0] + Math.cos(an) * 13.3, c[1] + Math.sin(an) * 13.3, C(P.tireHi));
      }
      v.ring(c[0], c[1], 10, 8, C(P.rim));
      for (k = 0; k <= 8; k++) {
        an = Math.PI * 1.08 + k * Math.PI * 0.84 / 8;
        v.px(c[0] + Math.cos(an) * 9, c[1] + Math.sin(an) * 9, C(P.rimHi));
        an = Math.PI * 0.08 + k * Math.PI * 0.84 / 8;
        v.px(c[0] + Math.cos(an) * 9, c[1] + Math.sin(an) * 9, C(P.rimDk));
      }
      v.circle(c[0], c[1], 2, C(P.metalDk));
      v.px(c[0] - 1, c[1] - 1, C(P.metal));
    }

    function tube(a, b, hi) {
      v.line2(a[0], a[1], b[0], b[1], C(P.frame), C(P.frameDk));
      if (hi) {
        v.line(a[0] + (b[0] - a[0]) * 0.12, a[1] + (b[1] - a[1]) * 0.12 - 1,
               a[0] + (b[0] - a[0]) * 0.82, a[1] + (b[1] - a[1]) * 0.82 - 1, C(P.frameHi));
      }
    }

    function pedal(p, dk) {
      v.rect(p[0] - 3, p[1] - 1, 7, 2, dk ? P.metalDk : P.outline);
      v.hline(p[0] - 2, p[0] + 2, p[1] - 1, dk ? P.metalDk : P.metal);
    }

    // ---- 远侧（被遮挡的）肢体 ----
    v.line(BB[0], BB[1], far[0], far[1], P.metalDk);
    pedal(far, true);
    leg(hip[0] - 1, hip[1], ff[0], ff[1], true);
    arm(sh[0] - 2, sh[1], (sh[0] * 0.5 + grip[0] * 0.5) - 1, (sh[1] + grip[1]) / 2 + 1, grip[0] - 2, grip[1] + 1, true);

    // ---- 车 ----
    wheel(RH);
    wheel(FH);
    // 驮包
    v.rect(2, -31, 9, 8, P.outline);
    v.rect(3, -30, 7, 6, C(P.bag));
    v.vline(6, -30, -25, C(P.bagDk));
    v.hline(3, 9, -30, shade(P.bag, 1.25));
    tube(RH, BB, false);          // 后下叉
    tube(RH, ST, false);          // 后上叉
    tube(BB, ST, false);          // 立管
    tube(BB, HB, true);           // 下管
    tube([ST[0] + 1, ST[1] - 1], HT, true);   // 上管
    v.line2(HT[0], HT[1], HB[0], HB[1], C(P.frame), C(P.frameDk));
    v.line(HT[0] + 1, HT[1], HB[0] + 1, HB[1], C(P.frameDk));     // 头管
    v.thick(HB[0] - 0.5, HB[1] + 1, FH[0], FH[1], 3, C(P.frameDk));   // 前叉
    v.thick(HB[0] - 0.5, HB[1] - 1, HB[0], HB[1] + 4, 3, C(P.metal));
    // 座管 / 座垫
    v.line(ST[0], ST[1], 12, ty(12, -31), C(P.metal));
    v.rect(5, ty(5, -33), 16, 2, P.outline);
    v.hline(6, 18, ty(6, -33), C(hex('#4a4a58')));
    v.px(20, ty(20, -32), P.outline);
    // 把立 / 车把 / 握把 / 刹车 / 车灯
    v.line(HT[0], HT[1], grip[0] - 6, grip[1] + 1, C(P.metal));
    v.line2(grip[0] - 7, grip[1], grip[0] + 3, grip[1] + 1, P.outline, P.outline);
    v.rect(grip[0] - 1, grip[1] - 1, 5, 3, P.outline);
    v.line(grip[0] + 3, grip[1] + 1, grip[0] + 6, grip[1] + 4, C(P.metal));
    v.circle(grip[0] + 4, grip[1] - 2, 2, P.outline);
    v.circle(grip[0] + 4, grip[1] - 2, 1, C(P.lamp));
    // 车把卷包
    v.rect(grip[0] - 8, grip[1] - 5, 11, 7, P.outline);
    v.rect(grip[0] - 7, grip[1] - 4, 9, 5, C(P.roll));
    v.hline(grip[0] - 7, grip[0] + 1, grip[1] - 4, C(shade(P.roll, 1.2)));
    v.vline(grip[0] - 5, grip[1] - 4, grip[1], C(P.rollDk));
    v.vline(grip[0] - 1, grip[1] - 4, grip[1], C(P.rollDk));
    // 牙盘 / 链条 / 水壶
    v.line(BB[0], BB[1] - 5, RH[0], RH[1] - 2, C(P.chain));
    v.line(BB[0], BB[1] + 5, RH[0], RH[1] + 2, C(P.chain));
    v.ring(BB[0], BB[1], 5, 3, C(P.metalDk));
    v.rect(31, ty(31, -14), 5, 8, C(P.bottle));
    v.rect(30, ty(30, -15), 7, 10, P.outline);
    v.rect(31, ty(31, -14), 5, 8, C(P.bottle));
    v.rect(32, ty(32, -16), 3, 2, C(P.white));
    v.vline(31, ty(31, -13), ty(31, -7), C(shade(P.bottle, 1.25)));

    // ---- 躯干 ----
    var hb = [9, ty(9, -31)];
    v.taper(hb[0], hb[1], sh[0], sh[1], 15, 13, P.outline);
    v.taper(hb[0], hb[1], sh[0], sh[1], 13, 11, C(P.jersey));
    var mx = hb[0] + (sh[0] - hb[0]) * 0.4, my = hb[1] + (sh[1] - hb[1]) * 0.4;
    v.taper(hb[0], hb[1], mx, my, 13, 13, C(P.shorts));
    var dxn = sh[0] - hb[0], dyn = sh[1] - hb[1], nl = Math.sqrt(dxn * dxn + dyn * dyn) || 1;
    var nx = -dyn / nl, ny = dxn / nl;       // 指向胸腹一侧
    v.line(mx - nx * 6, my - ny * 6, mx + nx * 6, my + ny * 6, C(P.white));
    v.thick(mx - nx * 4.5, my - ny * 4.5, sh[0] - nx * 4.5, sh[1] - ny * 4.5, 1, C(P.jerseyHi));
    v.thick(hb[0] + nx * 4, hb[1] + ny * 4, mx + nx * 4.5, my + ny * 4.5, 1, C(shade(P.shorts, 1.5)));

    // ---- 头 + 头盔 ----
    v.thick(sh[0] + 1, sh[1] - 1, head[0] - 2, head[1] + 2, 9, P.outline);
    v.thick(sh[0] + 1, sh[1] - 1, head[0] - 2, head[1] + 2, 7, C(P.skin));
    v.circle(head[0], head[1], 6, P.outline);
    v.circle(head[0], head[1], 5, C(P.skin));
    v.px(head[0] - 1, head[1] + 1, C(P.skinDk));
    v.px(head[0] + 4, head[1] + 2, C(P.skinDk));
    var hc0 = head[0] - 1, hc1 = head[1] - 2, dx, h, y0;
    for (dx = -11; dx <= 11; dx++) {
      h = Math.sqrt(Math.max(0, 115 - dx * dx));
      y0 = Math.round(hc1 - h);
      v.vline(hc0 + dx, y0, hc1, P.outline);
    }
    for (dx = -10; dx <= 10; dx++) {
      h = Math.sqrt(Math.max(0, 97 - dx * dx));
      y0 = Math.round(hc1 - h + 1);
      for (var yy = y0; yy <= hc1; yy++) {
        var col = C(P.helmet);
        if (dx < -1 && yy < hc1 - 3) col = C(P.helmetHi);
        else if (dx > 2 && yy > hc1 - 4) col = C(P.helmetDk);
        v.px(hc0 + dx, yy, col);
      }
    }
    for (dx = -1; dx <= 1; dx++) {             // 中央白条
      h = Math.sqrt(Math.max(0, 97 - dx * dx));
      for (yy = Math.round(hc1 - h + 1); yy <= hc1 - 5; yy++) v.px(hc0 + dx, yy, C(P.white));
    }
    v.px(hc0 + 5, hc1 - 6, C(P.helmetDk));    // 散热孔
    v.px(hc0 + 7, hc1 - 4, C(P.helmetDk));
    v.rect(hc0 - 11, hc1 - 1, 3, 2, P.outline);   // 头盔后尾
    v.px(hc0 - 10, hc1, C(P.helmet));
    v.hline(hc0 - 10, hc0 + 10, hc1 + 1, P.outline);   // 帽檐
    // 风镜
    v.rect(head[0] + 1, head[1] - 1, 5, 2, C(P.glass));
    v.px(head[0] + 2, head[1] - 1, C(P.glassHi));
    v.px(head[0] + 1, head[1] + 3, C(P.skinDk));

    // ---- 近侧肢体 ----
    arm(sh[0], sh[1], elb[0], elb[1], hand[0], hand[1], false);
    v.line(BB[0], BB[1], near[0], near[1], P.metal);
    pedal(near, false);
    leg(hip[0], hip[1], fn[0], fn[1], false);
    // 近侧曲柄重新盖住脚踏中心
    v.px(near[0], near[1], P.metal);
  }

  // 车轮辐条：8 帧旋转
  function paintSpokes(v, f) {
    var base = f * Math.PI / 20, k, an;
    for (k = 0; k < 5; k++) {
      an = base + k * Math.PI * 2 / 5;
      v.line(13, 13, 13 + Math.cos(an) * 8, 13 + Math.sin(an) * 8, P.spoke);
    }
    v.circle(13, 13, 2, P.metalDk);
    v.px(12, 12, P.metal);
  }

  // ---------------- 野狗 ----------------
  var DOGS = {
    yellow: { body: '#cf9138', dark: '#8a5a22', belly: '#f3dcae', hi: '#e9b266', eye: '#141418', nose: '#1a1410',
              tongue: '#ef5f6e', collar: '#d9483b', erect: false, out: '#2a1a0c', muzzle: '#cf9138' },
    black:  { body: '#36363f', dark: '#16161d', belly: '#72727f', hi: '#565664', eye: '#ff3b3b', nose: '#08080c',
              tongue: '#ef5f6e', collar: '#a3acb5', erect: true, out: '#0b0b10', muzzle: '#2c2c35' },
    wolf:   { body: '#8d919b', dark: '#4b4e56', belly: '#c9ccd3', hi: '#b6bcc6', eye: '#ffd23f', nose: '#141418',
              tongue: '#ef5f6e', collar: null, erect: true, out: '#1b1d25', muzzle: '#c9ccd3' }
  };
  // 局部坐标：地面为 y=0，髋关节正下方为原点（朝右跑）；锚点 = (40, 70)
  var DW = 112, DHT = 84, DAX = 40, DAY = 70;

  function paintDog(view, o) {
    var v = view.sub(DAX, DAY);      // 局部原点 = 地面上、髋关节正下方
    var b = DOGS[o.breed] || DOGS.yellow;
    var C = hex(b.body), D = hex(b.dark), BE = hex(b.belly), HI = hex(b.hi), OUT = hex(b.out);
    var pose = o.pose;
    var p = o.ph / 8, TAU = Math.PI * 2;
    var bob = 0;
    if (pose === 'run') bob = -Math.abs(Math.sin(p * TAU)) * 3.5;
    var pitch = pose === 'run' ? Math.sin(p * TAU + 1.2) * 2.2 : 0;

    var HIP = [18, -33 + bob + pitch], SHO = [44, -35 + bob - pitch];
    if (pose === 'pounce') { HIP = [12, -46]; SHO = [46, -47]; }
    else if (pose === 'crouch') { HIP = [21, -22]; SHO = [45, -27]; }
    else if (pose === 'bite') { HIP = [14, -39]; SHO = [48, -41]; }
    else if (pose === 'stun' || pose === 'sit') { HIP = [21, -15]; SHO = [45, -33]; }

    // 脚掌目标：支撑相贴地向后，摆动相抬起向前
    function foot(baseX, phase, reach, lift, stance) {
      var q = (p + phase) % 1; if (q < 0) q += 1;
      if (q < stance) { var u = q / stance; return [baseX + reach * (1 - 2 * u), -0.5]; }
      var w = (q - stance) / (1 - stance);
      return [baseX + reach * (2 * w - 1), -lift * Math.sin(Math.PI * w)];
    }
    var fN, fF, hN, hF;   // 前近/前远/后近/后远
    if (pose === 'run') {
      fN = foot(SHO[0] + 1, 0, 12, 15, 0.38); fF = foot(SHO[0] + 1, 0.1, 12, 15, 0.38);
      hN = foot(HIP[0] - 1, 0.5, 13, 15, 0.38); hF = foot(HIP[0] - 1, 0.6, 13, 15, 0.38);
    } else if (pose === 'pounce') {
      fN = [SHO[0] + 20, SHO[1] + 15]; fF = [SHO[0] + 17, SHO[1] + 18];
      hN = [HIP[0] - 19, HIP[1] + 15]; hF = [HIP[0] - 16, HIP[1] + 18];
    } else if (pose === 'crouch') {
      fN = [SHO[0] + 8, -0.5]; fF = [SHO[0] - 3, -0.5];
      hN = [HIP[0] - 6, -0.5]; hF = [HIP[0] - 10, -0.5];
    } else if (pose === 'bite') {
      fN = [SHO[0] + 12, -0.5]; fF = [SHO[0] + 3, -0.5];
      hN = [HIP[0] - 15, -0.5]; hF = [HIP[0] - 19, -0.5];
    } else {
      fN = [SHO[0], -0.5]; fF = [SHO[0] + 7, -0.5];
      hN = [HIP[0] - 4, -0.5]; hF = [HIP[0] + 5, -0.5];
    }

    // 两段 IK；dir=+1 关节朝前上，-1 朝后下
    function ik(a, f, l1, l2, dir) {
      var dx = f[0] - a[0], dy = f[1] - a[1], d = Math.sqrt(dx * dx + dy * dy) || 0.001;
      var maxd = l1 + l2 - 0.6, dd = d > maxd ? maxd : d;
      var ux = dx / d, uy = dy / d, A = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd);
      var h = Math.sqrt(Math.max(0, l1 * l1 - A * A));
      return dir > 0 ? [a[0] + ux * A + uy * h, a[1] + uy * A - ux * h]
                     : [a[0] + ux * A - uy * h, a[1] + uy * A + ux * h];
    }

    function front(a, f, dk) {
      var m = dk ? 0.66 : 1, j = ik(a, f, 18, 18, -1);
      v.thick(a[0], a[1], j[0], j[1], 9, OUT);
      v.taper(j[0], j[1], f[0], f[1], 7, 5, OUT);
      v.taper(a[0], a[1], j[0], j[1], 7, 5.5, shade(C, m));
      v.taper(j[0], j[1], f[0], f[1], 5, 3.5, shade(C, m));
      v.rect(f[0] - 2, f[1] - 1, 6, 3, OUT);
      v.rect(f[0] - 1, f[1] - 1, 4, 2, shade(C, m * 0.92));
    }
    function hind(a, f, dk) {
      var m = dk ? 0.66 : 1, j = ik(a, f, 16, 17, 1);
      var hx = j[0] + (f[0] - j[0]) * 0.5 - 3.5, hy = j[1] + (f[1] - j[1]) * 0.5;
      v.thick(a[0], a[1], j[0], j[1], 15, OUT);
      v.thick(j[0], j[1], hx, hy, 7, OUT);
      v.taper(hx, hy, f[0], f[1], 7, 5, OUT);
      v.taper(a[0], a[1], j[0], j[1], 13, 8, shade(C, m));
      v.taper(j[0], j[1], hx, hy, 5, 5, shade(C, m));
      v.taper(hx, hy, f[0], f[1], 5, 3.5, shade(C, m));
      v.rect(f[0] - 2, f[1] - 1, 6, 3, OUT);
      v.rect(f[0] - 1, f[1] - 1, 4, 2, shade(C, m * 0.92));
      // 大腿高光
      v.thick(a[0] - 2, a[1] + 2, j[0] - 2, j[1] - 2, 1, shade(HI, m));
    }

    hind([HIP[0] - 1, HIP[1]], hF, true);
    front([SHO[0] - 1, SHO[1] + 1], fF, true);

    // 尾巴
    var tw = pose === 'crouch' ? 0.25 : Math.sin(p * TAU * 2) * 0.22;
    var tail = [[HIP[0] - 6, HIP[1] - 5], [HIP[0] - 13, HIP[1] - 11 - tw * 6], [HIP[0] - 17, HIP[1] - 20 - tw * 10], [HIP[0] - 16, HIP[1] - 28 - tw * 12]];
    if (o.breed === 'wolf') { tail[2] = [HIP[0] - 21, HIP[1] - 19]; tail[3] = [HIP[0] - 25, HIP[1] - 26]; }
    if (pose === 'pounce' || pose === 'bite') tail = [[HIP[0] - 6, HIP[1] - 5], [HIP[0] - 16, HIP[1] - 6], [HIP[0] - 25, HIP[1] - 9], [HIP[0] - 31, HIP[1] - 14]];
    var tw0 = o.breed === 'wolf' ? 9 : 6, i;
    for (i = 0; i < 3; i++) {
      v.taper(tail[i][0], tail[i][1], tail[i + 1][0], tail[i + 1][1], tw0 - i * 1.5 + 2, tw0 - (i + 1) * 1.5 + 2, OUT);
    }
    for (i = 0; i < 3; i++) {
      var tc = i === 2 ? D : C;
      v.taper(tail[i][0], tail[i][1], tail[i + 1][0], tail[i + 1][1], tw0 - i * 1.5, tw0 - (i + 1) * 1.5, tc);
    }

    // 身体
    v.taper(HIP[0], HIP[1], SHO[0], SHO[1], 20, 19, OUT);
    v.taper(HIP[0], HIP[1], SHO[0], SHO[1], 18, 17, C);
    v.circle(SHO[0] + 1, SHO[1] + 2, 9, OUT);
    v.circle(SHO[0] + 1, SHO[1] + 2, 8, C);
    v.taper(HIP[0] + 3, HIP[1] + 5, SHO[0] - 3, SHO[1] + 5, 6, 5, BE);      // 腹部
    v.taper(HIP[0] + 1, HIP[1] - 6, SHO[0] - 1, SHO[1] - 7, 1, 1, HI);      // 背部受光
    v.px(HIP[0] + 8, HIP[1] - 3, D); v.px(HIP[0] + 15, HIP[1] - 4, D);      // 毛色斑

    hind(HIP, hN, false);
    front(SHO, fN, false);

    // 颈 + 头
    var HD = pose === 'crouch' ? [SHO[0] + 15, SHO[1] - 3]
      : pose === 'pounce' ? [SHO[0] + 14, SHO[1] - 8]
      : pose === 'bite' ? [SHO[0] + 14, SHO[1] - 9]
      : [SHO[0] + 13, SHO[1] - 10];
    v.thick(SHO[0] + 2, SHO[1] - 2, HD[0] - 3, HD[1] + 3, 17, OUT);
    v.thick(SHO[0] + 2, SHO[1] - 2, HD[0] - 3, HD[1] + 3, 15, C);
    if (b.collar) {
      v.line2(SHO[0] + 5, SHO[1] + 5, SHO[0] + 10, SHO[1] - 5, hex(b.collar), shade(hex(b.collar), 0.7));
      v.px(SHO[0] + 8, SHO[1] + 1, hex('#ffd56b'));
    }
    v.circle(HD[0], HD[1], 8, OUT);
    v.circle(HD[0], HD[1], 7, C);
    var mz = hex(b.muzzle);
    var open = (pose === 'pounce' || pose === 'bite' || pose === 'crouch');
    v.thick(HD[0] + 5, HD[1] + 1, HD[0] + 15, HD[1] + 3, 9, OUT);
    v.thick(HD[0] + 5, HD[1] + 1, HD[0] + 15, HD[1] + 3, 7, mz);
    if (open) {
      v.thick(HD[0] + 4, HD[1] + 7, HD[0] + 13, HD[1] + 11, 7, OUT);
      v.thick(HD[0] + 4, HD[1] + 7, HD[0] + 13, HD[1] + 11, 5, mz);
      v.poly([[HD[0] + 5, HD[1] + 4], [HD[0] + 13, HD[1] + 5], [HD[0] + 11, HD[1] + 8]], hex('#8c1c28'));
      v.px(HD[0] + 9, HD[1] + 4, hex('#ffffff')); v.px(HD[0] + 12, HD[1] + 5, hex('#ffffff'));
      v.px(HD[0] + 7, HD[1] + 7, hex(b.tongue));
    } else {
      v.line(HD[0] + 6, HD[1] + 5, HD[0] + 14, HD[1] + 5, OUT);
    }
    v.rect(HD[0] + 13, HD[1], 3, 3, hex(b.nose));
    v.px(HD[0] + 13, HD[1], shade(hex(b.nose), 2.2));
    // 眼睛 + 眉
    if (pose === 'stun') {
      v.px(HD[0], HD[1] - 3, OUT); v.px(HD[0] + 2, HD[1] - 1, OUT); v.px(HD[0] + 2, HD[1] - 3, OUT); v.px(HD[0], HD[1] - 1, OUT);
    } else {
      v.rect(HD[0], HD[1] - 3, 3, 2, hex(b.eye));
      v.px(HD[0], HD[1] - 3, hex('#ffffff'));
    }
    v.line(HD[0] - 1, HD[1] - 5, HD[0] + 3, HD[1] - 4, OUT);
    // 耳朵
    if (b.erect) {
      v.poly([[HD[0] - 5, HD[1] - 5], [HD[0] - 6, HD[1] - 17], [HD[0] + 2, HD[1] - 8]], OUT);
      v.poly([[HD[0] - 4, HD[1] - 7], [HD[0] - 5, HD[1] - 14], [HD[0] - 1, HD[1] - 8]], D);
    } else {
      var fl = (o.ph & 1) ? 2 : 0;
      v.poly([[HD[0] - 6, HD[1] - 6], [HD[0] - 10, HD[1] + 2 + fl], [HD[0] - 3, HD[1] - 1]], OUT);
      v.poly([[HD[0] - 6, HD[1] - 5], [HD[0] - 9, HD[1] + 1 + fl], [HD[0] - 4, HD[1] - 1]], D);
    }
  }

  // ---------------- 烘焙 ----------------
  // 骑行者帧矩阵：坡度 5 档 × {骑行(8 相位 × 冲刺/普通), 滑行 2, 腾空 2, 受伤, 欢呼}
  S.buildRider = function () {
    var sheet = new gfx.Sheet(1024, 1088);
    var r = S.rider = { sheet: sheet, ride: [], rideSprint: [], coast: [], air: [], duck: [], hurt: null, hurtFlash: null, cheer: [], W: RW, H: RHT, ax: RAX, ay: RAY };
    var t, i;
    for (t = -2; t <= 2; t++) {
      var rr = [], rs = [], rc = [], ra = [], rd = [];
      for (i = 0; i < 8; i++) {
        rr.push(sheet.add(RW, RHT, function (v) { paintRider(v, { tilt: t, pose: 'ride', ph: i, sprint: false }); }, { ax: RAX, ay: RAY }));
        rs.push(sheet.add(RW, RHT, function (v) { paintRider(v, { tilt: t, pose: 'ride', ph: i, sprint: true }); }, { ax: RAX, ay: RAY }));
      }
      for (i = 0; i < 2; i++) {
        rc.push(sheet.add(RW, RHT, function (v) { paintRider(v, { tilt: t, pose: 'coast', ph: i }); }, { ax: RAX, ay: RAY }));
        ra.push(sheet.add(RW, RHT, function (v) { paintRider(v, { tilt: t, pose: 'air', ph: i }); }, { ax: RAX, ay: RAY }));
        rd.push(sheet.add(RW, RHT, function (v) { paintRider(v, { tilt: t, pose: 'duck', ph: i }); }, { ax: RAX, ay: RAY }));
      }
      r.ride.push(rr); r.rideSprint.push(rs); r.coast.push(rc); r.air.push(ra); r.duck.push(rd);
    }
    r.hurt = sheet.add(RW, RHT, function (v) { paintRider(v, { tilt: 0, pose: 'hurt', ph: 0 }); }, { ax: RAX, ay: RAY });
    r.hurtFlash = sheet.add(RW, RHT, function (v) { paintRider(v, { tilt: 0, pose: 'hurt', ph: 0, flash: true }); }, { ax: RAX, ay: RAY });
    for (i = 0; i < 2; i++) r.cheer.push(sheet.add(RW, RHT, function (v) { paintRider(v, { tilt: 0, pose: 'cheer', ph: i }); }, { ax: RAX, ay: RAY }));
    return r;
  };

  S.buildMisc = function () {
    var sheet = new gfx.Sheet(1024, 1024);
    S.misc = sheet;
    S.spokes = [];
    for (var f = 0; f < 8; f++) S.spokes.push(sheet.add(27, 27, makeSpokes(f), { ax: 13, ay: 13 }));
    return sheet;
  };
  function makeSpokes(fr) { return function (v) { paintSpokes(v, fr); }; }

  // 一次性烘焙全部静态精灵（骑行者 / 野狗 / 障碍 / 道具 / 图标），道具备用件在 PR.art.buildStatic()
  S.buildAll = function () {
    if (S.rider) return;
    S.buildMisc();
    S.buildRider();
    S.buildDog();
    S.buildProps();
  };

  // 野狗帧：奔跑 8 相位 × 3 品种，以及 蓄力 / 猛扑 / 咬 / 眩晕 / 坐（与障碍道具共用一张图集）
  S.buildDog = function () {
    var sheet = S.misc;
    var d = S.dog = { sheet: sheet, breeds: {}, W: DW, H: DHT, ax: DAX, ay: DAY };
    var names = ['yellow', 'black', 'wolf'];
    for (var k = 0; k < names.length; k++) {
      var nm = names[k], set = d.breeds[nm] = { run: [] };
      for (var i = 0; i < 8; i++) {
        set.run.push(sheet.add(DW, DHT, makeDog(nm, 'run', i), { ax: DAX, ay: DAY }));
      }
      var poses = ['crouch', 'pounce', 'bite', 'stun', 'sit'];
      for (var j = 0; j < poses.length; j++) set[poses[j]] = sheet.add(DW, DHT, makeDog(nm, poses[j], 0), { ax: DAX, ay: DAY });
    }
    return d;
  };
  // 注意闭包：为每帧生成独立的 painter
  function makeDog(breed, pose, ph) {
    return function (v) { paintDog(v, { breed: breed, pose: pose, ph: ph }); };
  }
})();
