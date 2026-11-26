// src/world/level.js
// 关卡：按难度生成"障碍 + 金币 + 道具"的组合段落（图案），驱动碰撞、拾取、木棍、狗过障碍、到站结算。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});
  var cfg = PR.config, gfx = PR.gfx, clamp = gfx.clamp, draw = gfx.draw;

  var SOLID = ['rock', 'log'], FLAT = ['pothole', 'puddle', 'ice', 'drift'];
  // 图案：[名称, 权重, 最低难度]
  var TABLE = [
    ['single', 3.0, 0], ['coins', 1.5, 0], ['arc', 1.1, 0], ['hazard', 0.9, 0], ['rest', 0.9, 0],
    ['double', 1.5, 0.3], ['branch', 1.3, 0.12], ['pickup', 0.75, 0],
    ['driftBank', 0.9, 0.4], ['branchTrap', 1.1, 0.5], ['triple', 0.9, 0.8], ['comboTrap', 1.0, 0.65]
  ];

  function Level(game) {
    this.g = game;
    this.obs = []; this.items = []; this.sticks = [];
    this.nextX = 0; this.endX = 0; this.finished = false; this.finT = 0;
    this.day = 0; this.mode = 'journey'; this.r = gfx.rng(1); this.nextPickup = 0; this.theme = 0;
  }
  var L = Level.prototype;

  L.start = function (day, mode, startX) {
    var g = this.g;
    this.day = day; this.mode = mode;
    this.obs.length = 0; this.items.length = 0; this.sticks.length = 0;
    this.endX = mode === 'endless' ? Infinity : cfg.DAY_LEN[day];
    this.nextX = startX + cfg.FLAT_BEFORE + 80;
    this.finished = false; this.finT = 0; this.finX = 0;
    this.r = gfx.rng(day * 1013 + (mode === 'endless' ? 7701 : 0) + (g.runSeed | 0));
    this.nextPickup = this.nextX + 500;
    this.theme = mode === 'endless' ? 0 : day;
    this.def = PR.themes[this.theme];
    this.maxCombo = 0;
  };

  L.themeAt = function (x) { return this.mode === 'endless' ? Math.floor(Math.max(0, x) / 2800) % PR.themes.length : this.day; };
  L.setTheme = function (ti) { this.theme = ti; this.def = PR.themes[ti]; };

  // 难度：行程模式按天数 + 进度；无尽模式随距离增长
  L.difficulty = function (x) {
    if (this.mode === 'endless') return Math.min(1.9, 0.3 + x / 6500);
    var d = [0.15, 0.35, 0.6, 0.85, 1.1, 1.35][this.day];
    return clamp(d + clamp(x / this.endX, 0, 1) * 0.35, 0.15, 1.8);
  };

  L.kindsOf = function (cls) {
    var list = this.def.hazards, out = [], i;
    for (i = 0; i < list.length; i++) if (cls.indexOf(list[i]) >= 0 && out.indexOf(list[i]) < 0) out.push(list[i]);
    return out;
  };
  L.jumpKind = function () {
    var ks = this.kindsOf(SOLID);
    if (!ks.length) return 'rock';
    return ks[(this.r() * ks.length) | 0];
  };
  L.flatKind = function () {
    var ks = this.kindsOf(FLAT);
    if (!ks.length) return 'pothole';
    return ks[(this.r() * ks.length) | 0];
  };
  L.hasBranch = function () { return this.def.hazards.indexOf('branch') >= 0; };

  L.ob = function (type, x) { var o = new PR.Obstacle(this.g, type, x, (this.r() * 4) | 0); this.obs.push(o); return o; };
  L.item = function (kind, x, z) { var it = new PR.Item(this.g, kind, x, z); this.items.push(it); return it; };
  // 金币弧线：span 长度、apex 最高点（离地 70 以上：必须起跳才吃得到）
  L.arc = function (x0, n, span, apex) {
    for (var i = 0; i < n; i++) { var u = (i + 0.5) / n; this.item('coin', x0 + (u - 0.5) * span, 70 + Math.sin(u * Math.PI) * apex); }
  };
  L.line = function (x0, n, z, gap) {
    for (var i = 0; i < n; i++) this.item('coin', x0 + i * (gap || 34), z == null ? 38 : z);
  };
  L.powerup = function (x, z) {
    var p = this.g.player, w = [['drink', 3], ['stick', p.sticks >= 2 ? 0.5 : 2.6], ['gel', 1.5], ['magnet', 1.6], ['shield', p.shield ? 0.4 : 1.3]];
    var sum = 0, i, t = this.r();
    for (i = 0; i < w.length; i++) sum += w[i][1];
    for (i = 0; i < w.length; i++) { t -= w[i][1] / sum; if (t <= 0) break; }
    this.item(w[i][0], x, z == null ? 44 : z);
    this.nextPickup = x + 850 + this.r() * 500;
  };

  // 生成一个段落，返回占用长度（不含段落间距）
  L.gen = function (x) {
    var r = this.r, d = this.difficulty(x), sum = 0, i, k, t, name;
    for (i = 0; i < TABLE.length; i++) if (TABLE[i][2] <= d) sum += TABLE[i][1] * (TABLE[i][0] === 'rest' ? 1 / (0.5 + d) : 1);
    t = r() * sum; name = 'single';
    for (i = 0; i < TABLE.length; i++) {
      if (TABLE[i][2] > d) continue;
      t -= TABLE[i][1] * (TABLE[i][0] === 'rest' ? 1 / (0.5 + d) : 1);
      if (t <= 0) { name = TABLE[i][0]; break; }
    }
    if (name === 'pickup' && x < this.nextPickup) name = 'coins';
    var len = 0, jk = this.jumpKind(), fk = this.flatKind(), dx;
    switch (name) {
      case 'single':
        this.ob(jk, x);
        if (r() < 0.6) this.arc(x, 5, 170, 34);
        break;
      case 'double':
        dx = r.range(150, 195);
        this.ob(jk, x); this.ob(r() < 0.5 ? jk : this.jumpKind(), x + dx);
        if (r() < 0.5) this.arc(x + dx, 5, 170, 34);
        len = dx;
        break;
      case 'triple':
        for (i = 0; i < 3; i++) { this.ob(i === 1 ? this.jumpKind() : jk, x + i * 168); this.item('coin', x + i * 168, 112); }
        len = 336;
        break;
      case 'branch':
        this.ob('branch', x);
        this.line(x - 62, 5, 40, 32);
        len = 40;
        break;
      case 'branchTrap':
        this.ob(jk, x); this.ob('branch', x + 232);
        this.arc(x, 5, 160, 30); this.item('coin', x + 214, 38); this.item('coin', x + 250, 38);
        len = 272;
        break;
      case 'comboTrap':
        this.ob(jk, x); this.ob(fk, x + 150); this.ob(this.jumpKind(), x + 330);
        this.item('coin', x, 112); this.arc(x + 150, 3, 90, 30); this.item('coin', x + 330, 112);
        len = 330;
        break;
      case 'hazard':
        this.ob(fk, x);
        if (r() < 0.4) this.ob(this.flatKind(), x + 130);
        if (r() < 0.5) this.arc(x, 5, 150, 34);
        break;
      case 'driftBank':
        this.ob('drift', x); this.ob('drift', x + 132); this.item('coin', x, 104); this.item('coin', x + 66, 112); this.item('coin', x + 132, 104);
        len = 132;
        break;
      case 'coins':
        this.line(x, 5 + ((r() * 3) | 0), 38);
        break;
      case 'arc':
        this.arc(x, 7, 210, 44);
        len = 40;
        break;
      case 'pickup':
        this.powerup(x + 20);
        break;
      default:
        break;
    }
    if (d > 0.9 && name !== 'triple' && r() < (d - 0.9) * 0.9) { this.ob(this.flatKind(), x + len + 210); len += 210; }
    var gap = 540 - 210 * Math.min(d, 1.2) - 110 * Math.max(0, d - 1.2);
    return len + gap * r.range(0.86, 1.14);
  };

  L.fill = function () {
    var limit = Math.min(this.g.camX + this.g.bw + 560, this.endX - cfg.FLAT_AFTER), guard = 0;
    while (this.nextX < limit && guard++ < 14) this.nextX += this.gen(this.nextX);
    // 清理身后的
    var cut = this.g.camX - 320, i;
    for (i = this.obs.length - 1; i >= 0; i--) if (this.obs[i].x < cut && (this.obs[i].x + 70 < cut)) this.obs.splice(i, 1);
    for (i = this.items.length - 1; i >= 0; i--) if (this.items[i].x < cut || this.items[i].got && this.items[i].pop > 0.3) this.items.splice(i, 1);
    for (i = this.sticks.length - 1; i >= 0; i--) if (this.sticks[i].dead) this.sticks.splice(i, 1);
  };

  // 低头判定：前方 / 头顶有低垂树枝（范围与碰撞盒一致）
  L.needDuck = function (px) {
    var o = this.obs, i;
    for (i = 0; i < o.length; i++) if (o[i].def.low && !o[i].broken && px > o[i].x - 108 && px < o[i].x + 64) return true;
    return false;
  };

  L.update = function (dt) {
    var g = this.g, p = g.player, i, ob, it, dogs = g.dogs, k;
    this.fill();
    for (i = 0; i < this.obs.length; i++) this.obs[i].update(dt);
    for (i = 0; i < this.items.length; i++) this.items[i].update(dt, p);

    // ---- 障碍碰撞 ----（碰撞盒比精灵略小：后轮前缘到前轮轴心，障碍半宽内缩 3，手感更宽容）
    if (!this.finished && !p.dead && g.state === 'PLAY') {
      var px0 = p.x - 6, px1 = p.x + 48, m = 3;
      for (i = 0; i < this.obs.length; i++) {
        ob = this.obs[i];
        if (ob.broken) continue;
        var inX = px1 > ob.x - ob.def.hw + m && px0 < ob.x + ob.def.hw - m;
        if (!ob.passed && ob.x + ob.def.hw + 4 < p.x) {
          ob.passed = true;
          if ((ob.def.solid || ob.def.low) && !ob.hit) p.cleanPass(ob);
        }
        if (ob.hit || !inX) continue;
        var hit = false;
        if (ob.def.solid) hit = p.z < ob.def.h + 2;
        else if (ob.def.low) hit = p.z > 12;
        else hit = p.z < 9;
        if (hit) {
          if (p.hit(ob.type, ob)) {
            ob.hit = true;
            if (ob.def.low) { ob.sway = 0.7; g.particles.leaves(p.x + 40, p.groundY() - 90, 9); }
          }
        }
      }
      // ---- 拾取 ----
      for (i = 0; i < this.items.length; i++) {
        it = this.items[i];
        if (it.got) continue;
        if (Math.abs(it.x - (p.x + 26)) < 38 && Math.abs(it.z - (p.z + 40)) < 48) { it.got = true; g.collect(it); }
      }
      // ---- 木棍：野狗追近时自动扔出 ----
      if (p.sticks > 0 && p.throwCd <= 0) {
        for (k = 0; k < dogs.length; k++) {
          var dg = dogs[k];
          if (dg.state === 'chase' && dg.gap() < 200 && dg.gap() > 40) { this.throwStick(dg); break; }
        }
      }
    }
    // ---- 狗过障碍：会跳，偶尔绊倒 ----
    for (k = 0; k < dogs.length; k++) {
      var d = dogs[k];
      if (d.state !== 'chase' && d.state !== 'fetch') continue;
      for (i = 0; i < this.obs.length; i++) {
        ob = this.obs[i];
        if (!ob.def.solid || ob.dogDone || ob.broken) continue;
        if (d.x > ob.x - 22 && d.x < ob.x + ob.def.hw) {
          ob.dogDone = true;
          if (g.rand() < g.dogFailChance()) {
            d.stumble(); g.fx.text(d.x + 30, d.groundY() - 70, '狗绊了一下!', 'good'); g.sfx('yelp'); g.addScore(10, d.x, 60, '');
          } else d.hopT = 0.42;
        }
      }
    }
    // ---- 飞行中的木棍 ----
    for (i = 0; i < this.sticks.length; i++) {
      var st = this.sticks[i];
      st.t += dt; st.z += st.vz * dt; st.vz -= 620 * dt; st.x += st.vx * dt; st.rot += dt * 12;
      if (st.z <= 0) { st.z = 0; st.dead = true; }
    }
    // ---- 到站 ----
    if (!this.finished && p.x >= this.endX) { this.finished = true; this.finT = 0; if (g.onArrive) g.onArrive(); }
    if (this.finished) { this.finT += dt; if (this.finT > 2.4 && g.state === 'PLAY' && g.onDayDone) g.onDayDone(); }
  };

  L.throwStick = function (dog) {
    var p = this.g.player;
    p.sticks--; p.throwCd = 1.3; p.stats.sticks++;
    this.sticks.push({ x: p.x + 10, z: 46, vx: -(190 + p.v * 0.25), vz: 210, rot: 0, t: 0, dead: false });
    dog.throwStick(p.x - 120 - p.v * 0.25);
    this.g.sfx('stick');
    this.g.fx.text(p.x + 20, p.groundY() - 104, '看这边!', 'good');
    if (this.g.onStick) this.g.onStick();
  };

  L.drawSticks = function (ctx, camX, shy) {
    var i, st, gy;
    for (i = 0; i < this.sticks.length; i++) {
      st = this.sticks[i]; if (st.dead) continue;
      gy = this.g.G - this.g.terrain.h(st.x) + shy;
      ctx.save(); ctx.translate(Math.round(st.x - camX), Math.round(gy - st.z)); ctx.rotate(st.rot);
      draw(ctx, PR.sprites.props.stick, 0, 10, 1);
      ctx.restore();
    }
  };

  // 到站时的营地装饰（画在路面之后、角色之前）
  L.drawCamp = function (ctx, camX, shy) {
    if (this.mode !== 'journey') return;
    var g = this.g, th = PR.art.buildStatic(), k;
    var x = this.endX + 40 - camX, gy = Math.round(g.G - g.terrain.h(this.endX + 40)) + shy;
    if (x > -260 && x < g.bw + 120) {
      draw(ctx, th.tent[0], x + 30, gy - 14);
      draw(ctx, th.hay[0], x - 60, gy - 15);
      // 终点旗门
      ctx.fillStyle = '#f4efe3'; ctx.fillRect(x - 6, gy - 92, 3, 92); ctx.fillRect(x + 96, gy - 92, 3, 92);
      ctx.fillStyle = PR.colors.red;
      for (k = 0; k < 8; k++) if (k % 2 === 0) ctx.fillRect(x - 3 + k * 12, gy - 92, 12, 7);
      ctx.fillStyle = PR.colors.ink; ctx.fillRect(x - 3, gy - 85, 96, 1);
    }
  };

  PR.Level = Level;
})();
