#!/usr/bin/env node
// tools/sim.js — 无渲染数值模拟：用"机器人骑手"跑若干局，统计各天通关所需次数 / 失误 / 死因，用来调平衡。
// 用法：node tools/sim.js [每种打法最多重试次数=10] [endless 局数=6]
'use strict';
var path = require('path'), root = path.join(__dirname, '..');
['core/sys', 'core/raf', 'core/config', 'core/gfx', 'core/sprites', 'core/props', 'core/themes', 'core/input', 'core/synth', 'core/audio',
  'world/terrain', 'world/background', 'entities/obstacle', 'entities/item', 'entities/player', 'entities/dog', 'world/level',
  'game/save', 'game/particles', 'game/fx', 'game/hud', 'game/screens', 'game/main'].forEach(function (f) { require(path.join(root, 'src', f + '.js')); });
var PR = globalThis.PR, cfg = PR.config;

// ---- 无渲染环境：画布 / 上下文用空壳代替 ----
function ctxStub() {
  return new Proxy({}, { get: function (t, k) { return function () {}; }, set: function () { return true; } });
}
function canvasStub() { return { width: 0, height: 0, getContext: function () { return ctxStub(); } }; }

PR.save.load();
var game = new PR.Game({ canvas: canvasStub(), buffer: canvasStub(), viewW: 800, viewH: 390, dpr: 2 });
game.bake = function () {};
game.useTheme = function (ti) { this.loading = null; this.scene.setTheme(ti); };

// ---- 机器人骑手：模拟不同技术水平的玩家 ----
// skill ∈ (0,1]：越高 → 越少漏跳、闪避反应越快、起跳时机越准
// mem：同一玩家跨局保留的"经验"（跳过冰面 / 水坑的概率会随局数增长）
function Bot(g, skill, seed, mem) {
  this.g = g; this.skill = skill; this.r = PR.gfx.rng(seed); this.target = null; this.crouch = null;
  this.mem = mem || { flatP: 0.3 }; this.sp = false; this.lastHurt = -99;
}
Bot.prototype.canJump = function () {            // 摔车期间不能跳；下落中提前按，靠 0.14s 的预输入缓冲
  var p = this.g.player;
  return p.hurtT <= 0 && (p.onGround || (p.z < 60 && p.vz < 0));
};
Bot.prototype.think = function (dt) {
  var g = this.g, p = g.player, inp = PR.input, lv = g.level, i, o, dg, r = this.r, sk = this.skill;
  if (g.state !== 'PLAY' || p.dead || lv.finished) { inp.keySprint = false; return; }
  // 落点在低垂树枝下面就不跳（起跳后约 0.6s 内会进入树枝判定区）
  var nearBranch = false;
  for (i = 0; i < lv.obs.length; i++) { o = lv.obs[i]; if (o.def.low && !o.broken && p.x - 6 < o.x + 57 && p.x + 0.6 * p.v + 48 > o.x - 57) { nearBranch = true; break; } }
  this.nearBranch = nearBranch;
  // 野狗扑咬：看到"!"后经过反应时间起跳；有一定概率没反应过来
  for (i = 0; i < g.dogs.length; i++) {
    dg = g.dogs[i];
    if (dg.state !== 'crouch') continue;
    if (this.crouch !== dg) {
      this.crouch = dg;
      this.reactAt = (1 - sk) * 0.3 + r.range(0.12, 0.3);
      if (r() < (1 - sk) * 0.3) this.reactAt = 99;
    }
    if (dg.t >= this.reactAt && !nearBranch && this.canJump()) { inp.jumpQ++; this.reactAt = 99; }
  }
  if (g.dogs[0].state !== 'crouch' && (!g.dogs[1] || g.dogs[1].state !== 'crouch')) this.crouch = null;
  // 前方最近的障碍：实心障碍必须跳；平面障碍（冰面 / 水坑等）有时跳
  var best = null, flat = null, d;
  for (i = 0; i < lv.obs.length; i++) {
    o = lv.obs[i];
    if (o.broken || o.def.low || o.x - o.def.hw < p.x - 10) continue;
    if (o.def.solid) { if (!best || o.x < best.x) best = o; }
    else if (!flat || o.x < flat.x) flat = o;
  }
  if (best) {
    d = (best.x - best.def.hw + 3) - (p.x + 48);
    if (this.target !== best) {
      this.target = best;
      this.lead = sk > 0.85 ? r.range(0.07, 0.2) : r.range(0.02, 0.3);
      this.miss = r() < (1 - sk) * 0.35; this.done = false;
    }
    if (!this.done && !this.miss && !nearBranch && d <= p.v * this.lead && d > -6 && this.canJump()) { inp.jumpQ++; this.done = true; }
  } else if (flat && this.flatDone !== flat) {
    this.flatDone = flat;
    if (r() < this.mem.flatP) {
      this.mem.flatP = Math.min(0.9, this.mem.flatP + 0.03);
      d = (flat.x - flat.def.hw) - (p.x + 48);
      if (d <= p.v * r.range(0.05, 0.2) && d > -6 && !nearBranch && this.canJump()) inp.jumpQ++;
    }
  }
  // 蹬车：带滞回的"人手"策略——狗追近或刚摔过就按住，拉开距离或体力见底才松开
  var gap = g.dogs[0].gap(), hurtRecent = g.simT - this.lastHurt < 1.4;
  if (p.hurtT > 0.5) this.lastHurt = g.simT;
  if (!this.sp) { if ((gap < 340 && p.stam > 35) || (hurtRecent && p.stam > 20)) this.sp = true; }
  else if (gap > 430 || p.stam <= 6 || p.exhaust > 0) this.sp = false;
  inp.keySprint = !!this.sp && p.exhaust <= 0;
};

// ---- 跑一局 ----
var TRACE = 0, EV = [], lastSample = -1, lastDog = [];
function ev(g, msg) { if (TRACE) EV.push([g.simT, msg]); }
function snapshot(g) {                          // 紧凑快照：各狗距离 + 状态 / 速度 / 高度 / 体力
  var p = g.player, ds = g.dogs.map(function (d) { return (d.gap() | 0) + d.state.slice(0, 2); }).join(' ');
  return 'gap[' + ds + '] v' + (p.v | 0) + ' z' + (p.z | 0) + ' 体力' + ((p.stam / p.stamMax() * 100) | 0) + (p.slipT > 0 ? ' 滑' : '') + (p.hurtT > 0 ? ' 摔' : '') + (p.exhaust > 0 ? ' 竭' : '') + (PR.input.keySprint ? ' [蹬车]' : '');
}
var botThink = Bot.prototype.think;
Bot.prototype.think = function (dt) {           // 轨迹记录：狗的状态变化 + 每 0.25s 一帧快照
  var g = this.g;
  botThink.call(this, dt);
  if (!TRACE) return;
  g.dogs.forEach(function (d) { if (d.state !== lastDog[d.idx]) { ev(g, '◆ 狗' + d.idx + ' ' + lastDog[d.idx] + '→' + d.state + ' gap' + (d.gap() | 0)); lastDog[d.idx] = d.state; } });
  if (g.simT - lastSample >= 0.25) { lastSample = g.simT; ev(g, snapshot(g)); }
};
function run(g, mode, day, bot, maxT) {
  var t = 0, dt = 1 / 60, rec = { stumbleAt: -99, biteAt: -99, cause: '', minGap: 999 };
  var kill = g.kill, bite = g.pounceHit, hit = g.player.hit;
  g.player.hit = function (kind, ob) {           // 记录碰撞，用来归类死因
    rec.stumbleAt = g.simT; rec.stumbleKind = kind;
    if (TRACE && (ob.def.solid || ob.def.low)) ev(g, '✖ 撞到 ' + kind + ' v=' + (g.player.v | 0) + ' z=' + (g.player.z | 0) + ' bot: ' + (bot.target === ob ? '已锁定' : '未锁定') + (bot.miss ? ' 故意漏跳' : '') + (bot.nearBranch ? ' 因树枝不跳' : '') + (bot.done ? ' 已跳过' : ''));
    return hit.call(g.player, kind, ob);
  };
  g.pounceHit = function (dog) { rec.biteAt = g.simT; if (TRACE) ev(g, '✖ 被咬 gap' + (dog.gap() | 0) + ' 体力' + (g.player.stam | 0)); return bite.call(g, dog); };
  g.kill = function () {
    var p = g.player, sinceBite = rec.biteAt < 0 ? 99 : g.simT - rec.biteAt, sinceStu = g.simT - rec.stumbleAt;
    rec.cause = sinceBite < 3.6 ? '被咬后没甩开' : (p.exhaust > 0 || p.stam < 4 ? '力竭' : sinceStu < 2.2 ? '连续摔车' : '狗追上(滑行/减速)');
    rec.gapMin = Math.min(rec.gapMin, g.dogs[0].gap());
    return kill.call(g);
  };
  g.__bot = bot;
  PR.input.reset();
  lastDog = []; EV.length = 0; lastSample = -1;
  g.startRun(mode, day);
  while (g.state === 'PLAY' && t < maxT) {
    bot.think(dt); g.tick(dt); g.dispatchUi(); PR.input.endFrame(); t += dt;
  }
  rec.t = t; rec.result = g.result; rec.stats = g.player.stats; rec.mode = mode; rec.day = day;
  if (TRACE) {                                   // 调试：打印所有碰撞与狗的状态变化；死亡局再打印死前 8 秒的快照
    var win = rec.result && rec.result.win;
    console.log('  [trace] 第' + (day + 1) + '天 ' + (win ? '通关' : '死亡') + ' ' + t.toFixed(1) + 's: 摔车 ' + rec.stats.stumbles + ' 被咬 ' + rec.stats.bites + ' 闪避 ' + rec.stats.dodges + ' 干净通过 ' + rec.stats.clean + ' 金币 ' + (rec.result ? rec.result.coins : 0) + ' 得分 ' + (rec.result ? rec.result.score : 0));
    EV.forEach(function (e) { if (/[✖◆]/.test(e[1])) console.log('    ' + e[0].toFixed(2) + ' ' + e[1]); });
    if (!win && rec.cause) {
      var t0 = g.simT - 1.6, out = [];
      for (var i = 0; i < EV.length; i++) if (EV[i][0] >= t0 - 8) out.push(EV[i][0].toFixed(2) + ' ' + EV[i][1]);
      console.log('    死因: ' + rec.cause + '；死前 8 秒:\n    ' + out.join('\n    '));
    }
  }
  return rec;
}
function buyGreedy() {                           // 营地里有多少钱花多少钱：买最便宜的下一级
  var d = PR.save.data, guard = 0;
  while (guard++ < 40) {
    var best = -1, cost = 1e9, i, c;
    for (i = 0; i < cfg.UPGRADES.length; i++) {
      if (d.up[cfg.UPGRADES[i].key] >= cfg.UPGRADES[i].max) continue;
      c = cfg.UPGRADE_COST[d.up[cfg.UPGRADES[i].key]];
      if (c < cost) { cost = c; best = i; }
    }
    if (best < 0 || d.coins < cost) break;
    d.coins -= cost; d.up[cfg.UPGRADES[best].key]++;
  }
}
function avg(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return a.length ? s / a.length : 0; }
function f1(x) { return (Math.round(x * 10) / 10).toFixed(1); }

// ---- 命令行：node tools/sim.js [最多重试=10] [endless局数=6] [day=N] [skill=x] [trace=1] ----
var argv = process.argv.slice(2), opt = { try: 10, end: 6, day: -1, skill: -1, trace: 0 };
argv.forEach(function (a, i) {
  if (/^\d+$/.test(a)) { if (i === 0) opt.try = +a; else if (i === 1) opt.end = +a; return; }
  var kv = a.split('='); opt[kv[0]] = kv[1] === undefined ? 1 : +kv[1];
});
var MAXTRY = opt.try, NEND = opt.end, seed = 1, reports = [];
function census(day) {                          // 关卡普查：整天的障碍 / 道具数量（30 局平均）
  var oc = {}, ic = {}, k, runs = 30, L = game.level, ob0 = L.ob, it0 = L.item;
  L.ob = function (type, x) { oc[type] = (oc[type] || 0) + 1; return ob0.call(L, type, x); };
  L.item = function (kind, x, z) { ic[kind] = (ic[kind] || 0) + 1; return it0.call(L, kind, x, z); };
  for (k = 0; k < runs; k++) {
    game.startRun('journey', day);
    for (var x = 0; x < cfg.DAY_LEN[day]; x += 300) { game.camX = x; L.fill(); }
  }
  L.ob = ob0; L.item = it0;
  for (k in oc) oc[k] = Math.round(oc[k] / runs * 10) / 10;
  for (k in ic) ic[k] = Math.round(ic[k] / runs * 10) / 10;
  return { obs: oc, items: ic, sec: Math.round(cfg.DAY_LEN[day] / 290) };
}
if (opt.census) {
  for (var cday = 0; cday < 6; cday++) { var c = census(cday); console.log('第' + (cday + 1) + '天 ' + c.sec + 's: 障碍 ' + JSON.stringify(c.obs) + ' 道具 ' + JSON.stringify(c.items)); }
  process.exit(0);
}
var profiles = [['新手', 0.5], ['普通', 0.75], ['熟练', 0.92]];
if (opt.skill >= 0) profiles = [['指定', opt.skill]];

profiles.forEach(function (pf) {
  var name = pf[0], sk = pf[1], mem = { flatP: 0.3 };
  PR.save.reset();
  var line = { profile: name, days: [] };
  for (var day = 0; day < 6; day++) {
    if (opt.day >= 0 && day !== opt.day) continue;
    var tries = 0, wins = 0, stum = [], bites = [], dodg = [], coins = 0, time = [], causes = {}, last = null;
    while (tries < MAXTRY && !wins) {
      TRACE = !!opt.trace;
      var rec = run(game, 'journey', day, new Bot(game, sk, seed++, mem), 240);
      tries++; last = rec;
      if (rec.result && rec.result.win) { wins = 1; stum.push(rec.result.stumbles); bites.push(rec.result.bites); dodg.push(rec.result.dodges || 0); time.push(rec.t); coins += rec.result.coins + rec.result.bonus; }
      else causes[rec.cause || '?'] = (causes[rec.cause || '?'] || 0) + 1;
      buyGreedy();
    }
    line.days.push({ day: day + 1, tries: tries, won: !!wins, stumbles: f1(avg(stum)), bites: f1(avg(bites)), dodges: f1(avg(dodg)), sec: f1(avg(time)), coins: coins, deaths: causes,
      lastDist: last && last.result ? last.result.dist : 0, lastTotal: cfg.DAY_LEN[day] / 10, up: JSON.stringify(PR.save.data.up) });
    if (!wins) break;                            // 这一档打不过去，后面的天数不用测
  }
  var d = PR.save.data;
  line.endless = [];
  for (var k = 0; k < NEND; k++) line.endless.push(run(game, 'endless', 0, new Bot(game, sk, seed++, mem), 900));
  line.up = d.up;
  reports.push(line);
});

console.log('=== 行程模式（每档从零开始，打不过就重试，金币全用来升级）===');
reports.forEach(function (line) {
  console.log('\n[' + line.profile + ']');
  line.days.forEach(function (x) {
    console.log('  第' + x.day + '天 ' + (x.won ? '通关' : '卡关') + ' 重试 ' + (x.tries - 1) + ' 次 | 通关局: 摔车 ' + x.stumbles + ' 被咬 ' + x.bites + ' 闪避 ' + x.dodges + ' 用时 ' + x.sec + 's | 累计金币 ' + x.coins +
      (x.won ? '' : ' | 最后死于 ' + x.lastDist + 'm / ' + x.lastTotal + 'm') + ' | 升级 ' + x.up);
    var ks = Object.keys(x.deaths); if (ks.length) console.log('      死因: ' + ks.map(function (c) { return c + '×' + x.deaths[c]; }).join('，'));
  });
  var e = line.endless, dist = e.map(function (r) { return (r.result ? r.result.dist : (r.stats ? Math.round(r.stats.dist / 10) : 0)) + 'm'; }), ec = {};
  e.forEach(function (r) { ec[r.cause || (r.result && r.result.win ? '结束' : '超时')] = (ec[r.cause || '超时'] || 0) + 1; });
  console.log('  无尽: 距离 ' + dist.join(' / ') + ' | 用时 ' + e.map(function (r) { return Math.round(r.t); }).join('/') + 's | 得分 ' + e.map(function (r) { return r.result ? r.result.score : 0; }).join('/') + ' | 死因 ' + JSON.stringify(ec));
});
