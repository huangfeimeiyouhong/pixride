// src/game/screens.js
// 各界面：标题 / 营地（升级商店）/ 被追上结算 / 抵达拉萨 / 暂停 / 确认框。
// 每个界面只负责绘制并登记按钮，点击由 Game 在帧末用 PR.hud.hit() 派发到 g.onUi(id)。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});
  var H = PR.hud, draw = PR.gfx.draw, drawScaled = PR.gfx.drawScaled;
  var S = PR.screens = {};
  var SHOP = [
    ['stamina', '肺活量', '体力上限 +12%'],
    ['regen', '恢复力', '滑行时体力回复 +12%'],
    ['pedal', '踏频', '蹬车速度 +4%'],
    ['light', '轻量化', '滑行更快 · 跳得更高']
  ];
  var TIPS = ['捡到木棍：野狗追近时会自动扔出去引开它', '能量胶期间撞到石头会直接撞飞', '下坡不蹬车也能回体力', '狗低吼（出现 !）时起跳，可以完美闪避',
    '低垂的树枝别跳，低头骑过去', '连击越高，金币分数倍率越高', '护盾能抵挡一次撞击', '冰面会打滑，跳过去更稳'];

  function dim(ctx, g, a) { ctx.fillStyle = 'rgba(6,8,16,' + a + ')'; ctx.fillRect(0, 0, g.bw, g.bh); }

  S.title = function (ctx, g) {
    var W = g.bw, Hh = g.bh, sa = g.safe, d = PR.save.data, x = 16 + sa.l, t = g.time, pr = PR.sprites.props, i;
    var top = Math.round(Hh * 0.12), ty = top + 26;
    H.cn(ctx, '像素骑行', x + 4, ty + 4, 46, '#3a2400', 'left', 1);
    H.cn(ctx, '像素骑行', x, ty, 46, '#ffd23f', 'left', 1);
    H.cn(ctx, '滇藏线 · 一路被狗追的骑行', x + 2, ty + 38, 14, 'sub', 'left');
    var by = ty + 58, def = PR.themes[g.day], bob = Math.sin(t * 2.2) * 2;
    H.button(ctx, 'start', x, by + bob, 212, 48, { kind: 'primary', cn: (d.done && d.day >= 5) ? '再骑一次' : '出发', sub: 'DAY ' + (d.day + 1) + ' · ' + def.place, size: 18 });
    H.button(ctx, 'endless', x, by + 60, 212, 34, { kind: d.done ? 'good' : 'normal', cn: d.done ? '无尽模式' : '无尽模式 · 通关后解锁', size: 13, alpha: d.done ? 1 : 0.6 });
    H.button(ctx, 'sound', x + 222, by + 60, 40, 34, { kind: 'normal', icon: d.sound ? pr.ic.sndOn : pr.ic.sndOff });
    H.button(ctx, 'reset', x, by + 104, 82, 22, { kind: 'normal', cn: '重置进度', size: 10, alpha: 0.7 });
    var xr = W - 16 - sa.r;
    H.cn(ctx, '最高分', xr - 150, top + 7, 11, 'sub', 'left'); H.text(ctx, '' + d.best.score, xr, top, { kind: 'white', size: 2, align: 'right' });
    H.cn(ctx, '最远骑行', xr - 150, top + 27, 11, 'sub', 'left'); H.text(ctx, d.best.dist + 'M', xr, top + 20, { kind: 'white', size: 2, align: 'right' });
    H.cn(ctx, '最高连击', xr - 150, top + 47, 11, 'sub', 'left'); H.text(ctx, '' + d.best.combo, xr, top + 40, { kind: 'white', size: 2, align: 'right' });
    // 底部：滇藏线小地图
    var n = 6, gap = Math.min(76, (W - 40) / n), y = Hh - 34 - sa.b;
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(W / 2 - gap * 2.5, y + 1, gap * 5, 2);
    for (i = 0; i < n; i++) {
      var nx = W / 2 + (i - 2.5) * gap, done = i < d.day || d.done, cur = i === d.day && !d.done;
      ctx.fillStyle = done ? '#ffd23f' : '#3a4560'; ctx.beginPath(); ctx.arc(nx, y + 1, cur ? 6 + Math.sin(t * 5) : 4.5, 0, 6.283); ctx.fill();
      if (cur) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke(); }
      for (var j = 0; j < d.stars[i]; j++) drawScaled(ctx, pr.star[0], nx - 8 + j * 8, y - 6, 0.4, 0.4, 1);
      H.cn(ctx, PR.themes[i].name, nx, y + 16, 10, cur ? 'title' : (done ? 'gold' : 'sub'), 'center');
    }
    H.cn(ctx, '左屏点按 / 空格 = 跳跃      右屏按住 / Shift = 用力蹬车', W / 2, y - 22, 12, 'title', 'center');
    if (g.confirmReset) S.confirm(ctx, g, '确定清空全部进度吗？', 'resetYes');
  };

  S.camp = function (ctx, g) {
    var W = g.bw, Hh = g.bh, d = PR.save.data, r = g.result, t = g.uiT, pr = PR.sprites.props, i, j;
    dim(ctx, g, 0.45);
    var pw = Math.min(600, W - 24), ph = Math.min(316, Hh - 16), px = (W - pw) / 2, py = (Hh - ph) / 2, cx = px + pw / 2;
    H.panel(ctx, px, py, pw, ph);
    H.cn(ctx, '第' + (g.day + 1) + '天 · 抵达营地', cx, py + 22, 18, 'title', 'center');
    H.stars(ctx, cx, py + 40, r.stars, 22, t);
    H.cn(ctx, '得分 ' + r.score + ' · 金币 +' + r.coins + ' · 摔车 ' + r.stumbles, cx, py + 62, 12, 'sub', 'center');
    var rh = ph < 300 ? 33 : 38, sy = py + 76;
    for (i = 0; i < 4; i++) {
      var y = sy + i * rh, k = SHOP[i], lv = d.up[k[0]], maxed = lv >= 5, cost = maxed ? 0 : PR.config.UPGRADE_COST[lv], ok = !maxed && d.coins >= cost;
      if (i & 1) { ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(px + 10, y, pw - 120, rh - 2); }
      H.cn(ctx, k[1], px + 18, y + 11, 13, 'white', 'left');
      H.cn(ctx, k[2], px + 18, y + 24, 10, 'sub', 'left');
      for (j = 0; j < 5; j++) {
        ctx.fillStyle = j < lv ? '#ffd23f' : '#4d5b82';
        ctx.fillRect(px + 150 + j * 12, y + rh / 2 - 3, 8, 6);
        if (j < lv) { ctx.fillStyle = '#fff3c4'; ctx.fillRect(px + 150 + j * 12, y + rh / 2 - 3, 8, 2); }
      }
      H.button(ctx, 'up' + i, px + pw - 108, y + (rh - 26) / 2, 98, 26, { kind: ok ? 'primary' : 'normal', cn: maxed ? '已满级' : cost + ' 金币', size: 11, alpha: maxed ? 0.5 : (ok ? 1 : 0.75) });
    }
    var fy = py + ph - 50;
    draw(ctx, pr.coin[(t * 10 | 0) % 6], px + 24, fy + 20, 1.4);
    H.text(ctx, '' + d.coins, px + 40, fy + 10, { kind: 'gold', size: 3 });
    H.cn(ctx, '金币', px + 40 + ('' + d.coins).length * 13 + 8, fy + 22, 11, 'sub', 'left');
    var nd = Math.min(5, g.day + 1);
    H.button(ctx, 'next', px + pw - 196, fy, 180, 42, { kind: 'primary', cn: '继续出发', size: 16, sub: 'DAY ' + (nd + 1) + ' · ' + PR.themes[nd].place });
  };

  S.over = function (ctx, g) {
    var W = g.bw, Hh = g.bh, pw = 400, ph = 216, px = (W - pw) / 2, py = (Hh - ph) / 2 - 6, r = g.result, pr = PR.sprites.props;
    var dog = PR.sprites.dog.breeds[g.dogs[0] ? g.dogs[0].breed : 'yellow'];
    dim(ctx, g, 0.55);
    draw(ctx, dog.sit, px + pw - 30, py + ph + 8, 1);                      // 蹲在面板边的"罪魁祸首"
    H.panel(ctx, px, py, pw, ph);
    H.cn(ctx, g.mode === 'endless' ? '骑行结束' : '被追上了!', px + pw / 2, py + 28, 22, 'bad', 'center');
    H.cn(ctx, '骑行 ' + r.dist + 'M    得分 ' + r.score, px + pw / 2, py + 60, 13, 'white', 'center');
    H.cn(ctx, '金币 +' + r.coins + '   最高连击 ' + r.combo + '   完美闪避 ' + r.dodges + ' 次', px + pw / 2, py + 82, 12, 'sub', 'center');
    if (r.newBest) { ctx.globalAlpha = 0.7 + 0.3 * Math.sin(g.uiT * 6); H.cn(ctx, '新纪录！', px + pw / 2, py + 104, 14, 'gold', 'center'); ctx.globalAlpha = 1; }
    else if (g.mode === 'endless') H.cn(ctx, '无尽最佳 ' + r.best + 'M', px + pw / 2, py + 104, 11, 'sub', 'center');
    H.cn(ctx, '提示：' + TIPS[(g.tipIdx || 0) % TIPS.length], px + pw / 2, py + 126, 11, 'sub', 'center');
    H.button(ctx, 'retry', px + 26, py + ph - 56, 164, 40, { kind: 'primary', cn: '再来一次', size: 16 });
    H.button(ctx, 'title', px + pw - 190, py + ph - 54, 164, 36, { kind: 'normal', cn: '回到标题', size: 14 });
  };

  S.win = function (ctx, g) {
    var W = g.bw, Hh = g.bh, pw = 470, ph = 236, px = (W - pw) / 2, py = (Hh - ph) / 2 - 8, r = g.result;
    dim(ctx, g, 0.3);
    H.panel(ctx, px, py, pw, ph);
    H.cn(ctx, '抵达拉萨！', px + pw / 2, py + 36, 30, 'gold', 'center');
    H.cn(ctx, '滇藏线全程 ' + (PR.config.DAY_LEN.reduce(function (a, b) { return a + b; }, 0) / 10 | 0) + 'M，骑行完成', px + pw / 2, py + 70, 13, 'title', 'center');
    H.cn(ctx, '总金币 ' + PR.save.data.coins + '    最高连击 ' + PR.save.data.best.combo + '    最高分 ' + PR.save.data.best.score, px + pw / 2, py + 94, 12, 'sub', 'center');
    H.cn(ctx, '布达拉宫前合个影 —— 然后继续被狗追吧', px + pw / 2, py + 118, 11, 'sub', 'center');
    H.button(ctx, 'endless', px + 30, py + ph - 58, 190, 42, { kind: 'good', cn: '无尽模式', size: 16 });
    H.button(ctx, 'title', px + pw - 220, py + ph - 56, 190, 38, { kind: 'normal', cn: '回到标题', size: 14 });
  };

  S.pause = function (ctx, g) {
    var W = g.bw, Hh = g.bh, pw = 300, ph = 232, px = (W - pw) / 2, py = (Hh - ph) / 2, pr = PR.sprites.props;
    dim(ctx, g, 0.5);
    H.panel(ctx, px, py, pw, ph);
    H.cn(ctx, '暂停', px + pw / 2, py + 26, 20, 'title', 'center');
    H.button(ctx, 'sound', px + pw - 46, py + 8, 38, 34, { kind: 'normal', icon: PR.save.data.sound ? pr.ic.sndOn : pr.ic.sndOff });
    H.button(ctx, 'resume', px + 40, py + 52, 220, 42, { kind: 'primary', cn: '继续骑行', size: 16 });
    H.button(ctx, 'restart', px + 40, py + 104, 220, 36, { kind: 'normal', cn: '重新出发', size: 14 });
    H.button(ctx, 'title', px + 40, py + 148, 220, 36, { kind: 'normal', cn: '回到标题', size: 14 });
  };

  S.confirm = function (ctx, g, str, yesId) {
    var W = g.bw, Hh = g.bh, pw = 360, ph = 132, px = (W - pw) / 2, py = (Hh - ph) / 2;
    H.panel(ctx, px, py, pw, ph);
    H.cn(ctx, str, px + pw / 2, py + 40, 15, 'title', 'center');
    H.button(ctx, yesId, px + 30, py + ph - 54, 140, 36, { kind: 'danger', cn: '确定', size: 14 });
    H.button(ctx, 'cancel', px + pw - 170, py + ph - 54, 140, 36, { kind: 'normal', cn: '取消', size: 14 });
  };
})();
