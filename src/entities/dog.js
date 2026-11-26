// src/entities/dog.js
// 野狗：从后方追击，2 帧奔跑动画。随里程进化为「普通黄狗 → 恶犬(黑) → 灰狼」，
// 可被打狗棒打眩晕（冒星星减速），会周期性猛扑（速度线 + 前倾）。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});
  var C = PR.gfx.COLORS;
  var px = PR.gfx.px;

  var BREEDS = {
    normal: { body: C.dogBody, dark: C.dogDark, belly: C.dogBelly, w: 18, hx: 20, label: '野狗' },
    black:  { body: '#2c2c35', dark: '#0e0e13', belly: '#52525e', w: 20, hx: 22, label: '恶犬' },
    wolf:   { body: '#83878f', dark: '#4a4d54', belly: '#b0b3ba', w: 22, hx: 24, label: '灰狼' }
  };

  PR.Dog = function () { this.reset(); };
  PR.Dog.prototype.reset = function () {
    this.worldX = -PR.config.DOG_GAP_START;
    this.animT = 0;
    this.breed = 'normal';
    this.stunT = 0;       // 被打狗棒眩晕剩余时间
    this.lungeT = 0;      // 猛扑剩余时间
    this.morphFlash = 0;  // 进化闪光剩余时间
  };

  PR.Dog.prototype.update = function (dt) {
    this.animT += dt;
    if (this.stunT > 0) this.stunT -= dt;
    if (this.lungeT > 0) this.lungeT -= dt;
    if (this.morphFlash > 0) this.morphFlash -= dt;
  };

  PR.Dog.prototype.label = function () {
    return (BREEDS[this.breed] || BREEDS.normal).label;
  };

  PR.Dog.prototype.draw = function (ctx, screenX, groundY, gap) {
    var br = BREEDS[this.breed] || BREEDS.normal;
    var body = br.body, dark = br.dark, belly = br.belly, out = C.outline;
    var x = screenX;
    var frame = Math.floor(this.animT * 10) % 2;

    // 猛扑时前倾：身体整体向前挪 2px
    var lean = this.lungeT > 0 ? 2 : 0;
    var bob = (frame === 0) ? 0 : -1;
    var y = groundY + bob;
    var w = br.w, hx = br.hx;

    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(x + 2, groundY, w + 4, 2);

    // 猛扑速度线（身后）
    if (this.lungeT > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(x - 8, y - 11, 4, 1);
      ctx.fillRect(x - 6, y - 7, 3, 1);
      ctx.fillStyle = 'rgba(255,200,120,0.6)';
      ctx.fillRect(x - 7, y - 9, 5, 1);
    }

    // 尾巴（摇动）
    var tailY = y - 11 + (frame === 0 ? -1 : 1);
    PR.gfx.line(ctx, x + 1, y - 9, x + 4, tailY, dark);
    px(ctx, x, tailY - 1, 2, 2, dark);

    // 后腿 / 前腿
    var legX0 = x + 5, legX1 = x + 9, legX2 = x + hx - 5, legX3 = x + hx - 1;
    if (frame === 0) {
      leg(ctx, legX0, y - 5, 0, body, dark); leg(ctx, legX1, y - 5, 1, body, dark);
      leg(ctx, legX2, y - 5, 1, body, dark); leg(ctx, legX3, y - 5, 0, body, dark);
    } else {
      leg(ctx, legX0, y - 5, 1, body, dark); leg(ctx, legX1, y - 5, 0, body, dark);
      leg(ctx, legX2, y - 5, 0, body, dark); leg(ctx, legX3, y - 5, 1, body, dark);
    }

    // 身体
    px(ctx, x + 3 + lean, y - 10, w, 5, body);
    px(ctx, x + 3 + lean, y - 10, w, 1, out);
    px(ctx, x + 3 + lean, y - 6, w, 1, belly);
    px(ctx, x + 2 + lean, y - 9, 1, 3, out);
    px(ctx, x + 2 + lean + w + 1, y - 9, 1, 3, out);

    // 头
    var hx0 = x + hx + lean;
    px(ctx, hx0, y - 13, 7, 5, body);
    px(ctx, hx0, y - 13, 7, 1, out);
    px(ctx, hx0, y - 9, 1, 1, out);
    // 耳朵
    if (this.breed === 'wolf') {
      px(ctx, hx0 + 1, y - 16, 2, 3, dark);   // 尖耳
      px(ctx, hx0 + 4, y - 16, 2, 3, dark);
    } else {
      px(ctx, hx0 + 1, y - 15, 2, 2, dark);
      px(ctx, hx0 + 4, y - 15, 2, 2, dark);
    }
    // 口鼻
    px(ctx, hx0 + 6, y - 11, 2, 2, body);
    px(ctx, hx0 + 7, y - 10, 1, 1, out);
    px(ctx, hx0 + 6, y - 8, 1, 1, dark);
    // 眼：恶犬/灰狼常态红眼
    var mean = this.breed !== 'normal';
    px(ctx, hx0 + 3, y - 12, 1, 1, mean ? '#ff3b3b' : out);

    // 距离近时吐舌头 + 红眼（所有品种逼近时更凶）
    if (gap < 70) {
      px(ctx, hx0 + 7, y - 8, 2, 1, '#e63946');
      px(ctx, hx0 + 3, y - 12, 1, 1, '#ff3b3b');
    }
    // 口水飞溅（很近）
    if (gap < 40) {
      px(ctx, hx0 + 9, y - 12, 1, 1, '#ffffff');
      px(ctx, hx0 + 10, y - 9, 1, 1, '#ffffff');
    }
    // 狼牙（灰狼）
    if (this.breed === 'wolf') {
      px(ctx, hx0 + 6, y - 8, 1, 1, '#ffffff');
    }

    // 眩晕：头顶旋转星星
    if (this.stunT > 0) {
      var ang = this.animT * 8;
      var cx = x + w / 2 + lean, cy = y - 18;
      for (var s = 0; s < 3; s++) {
        var a = ang + s * (Math.PI * 2 / 3);
        var sx2 = Math.round(cx + Math.cos(a) * 5);
        var sy2 = Math.round(cy + Math.sin(a) * 2);
        px(ctx, sx2, sy2, 2, 2, '#ffd56b');
        px(ctx, sx2, sy2 + 2, 2, 1, '#ffd56b');
      }
    }

    // 进化闪光
    if (this.morphFlash > 0) {
      var a = Math.max(0, Math.min(1, this.morphFlash * 2));
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 4, y - 16, w + 16, 14);
      ctx.restore();
    }
  };

  function leg(ctx, lx, ly, onGround, body, dark) {
    if (onGround) {
      px(ctx, lx, ly, 2, 5, body);
      px(ctx, lx, ly + 4, 2, 1, dark);
    } else {
      px(ctx, lx, ly, 2, 3, body);
      px(ctx, lx + 1, ly + 2, 1, 1, dark);
    }
  }
})();
