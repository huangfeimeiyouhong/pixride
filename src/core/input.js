// src/core/input.js
// 统一输入：触屏（左半屏点按 = 跳跃，右半屏按住 = 蹬车）+ 键盘。
// 兼容浏览器与抖音小游戏：小游戏运行时 canvas 可能没有 addEventListener，此时回退到 tt.onTouchStart 等全局 API。
// 指针位置统一由 mapper(clientX, clientY) 换算成"缓冲区坐标"，界面层按缓冲区坐标做按钮命中。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});

  var JUMP_KEYS = { ' ': 1, Spacebar: 1, ArrowUp: 1, w: 1, W: 1 };
  var SPRINT_KEYS = { Shift: 1, ArrowRight: 1, d: 1, D: 1 };
  var lastPressAt = 0, lastPressId = null;

  var S = PR.input = {
    mapper: null,                    // function(clientX, clientY) → { x, y }
    sprintZone: null,                // function(x, y) → 是否属于"蹬车"区域
    jumpQ: 0,                        // 待处理的跳跃（键盘或程序触发，带位置的手势不入队）
    keyTaps: [],                     // 键盘产生的"确认"（Enter / 空格），供界面使用
    taps: [],                        // 本帧的按下事件（缓冲区坐标）
    active: {},                      // 仍在按下的指针：id → { x, y, ui }
    keySprint: false, keyJump: false,
    anyAt: 0,                        // 最近一次按下的时间戳（Date.now）
    seq: 0                           // 每次按下 +1，用于"进入某状态后才有新输入"的判断
  };

  function unlock() { try { if (PR.audio && PR.audio.unlock) PR.audio.unlock(); } catch (e) {} }

  function pointOf(t) {
    var cx = (t.clientX != null) ? t.clientX : (t.pageX != null ? t.pageX : (t.x != null ? t.x : 0));
    var cy = (t.clientY != null) ? t.clientY : (t.pageY != null ? t.pageY : (t.y != null ? t.y : 0));
    return S.mapper ? S.mapper(cx, cy) : { x: cx, y: cy };
  }

  function press(x, y, id) {
    var now = Date.now();
    if (now - lastPressAt < 35 && lastPressId === id) return;       // 模拟器对同一次按下重复派发
    lastPressAt = now; lastPressId = id;
    unlock();
    S.anyAt = now; S.seq++;
    S.active[id] = { x: x, y: y, ui: false };
    S.taps.push({ x: x, y: y, id: id, used: false });
  }
  function release(id) { delete S.active[id]; }

  function isSprint() {
    if (S.keySprint) return true;
    if (!S.sprintZone) return false;
    for (var k in S.active) {
      var p = S.active[k];
      if (!p.ui && S.sprintZone(p.x, p.y)) return true;
    }
    return false;
  }

  function bindTouch(canvas) {
    var on = function (target, type, handler, opts) {
      if (target && typeof target.addEventListener === 'function') { target.addEventListener(type, handler, opts); return true; }
      if (target && target['on' + type] !== undefined) { target['on' + type] = handler; return true; }
      return false;
    };
    var got = false, list;
    var down = function (e) {
      list = (e.changedTouches && e.changedTouches.length) ? e.changedTouches : [e];
      for (var i = 0; i < list.length; i++) {
        var t = list[i], p = pointOf(t);
        press(p.x, p.y, t.identifier != null ? t.identifier : 'mouse');
      }
      if (e && e.preventDefault) e.preventDefault();
    };
    var up = function (e) {
      list = (e.changedTouches && e.changedTouches.length) ? e.changedTouches : [e];
      for (var i = 0; i < list.length; i++) release(list[i].identifier != null ? list[i].identifier : 'mouse');
      if (e && e.preventDefault) e.preventDefault();
    };
    if (typeof window !== 'undefined') {
      got = on(canvas, 'touchstart', down, { passive: false });
      on(canvas, 'touchend', up); on(canvas, 'touchcancel', up);
      if (!got) { on(canvas, 'mousedown', down); on(window, 'mouseup', up); }
    } else {
      got = on(canvas, 'touchstart', down);
      on(canvas, 'touchend', up); on(canvas, 'touchcancel', up);
      if (!got) { on(canvas, 'mousedown', down); on(canvas, 'mouseup', up); }
    }
    // 回退：抖音小游戏全局触摸 API
    if (!got && typeof tt !== 'undefined') {
      if (typeof tt.onTouchStart === 'function') tt.onTouchStart(function (res) { down({ changedTouches: res.touches || res.changedTouches || [] }); });
      if (typeof tt.onTouchEnd === 'function') tt.onTouchEnd(function (res) { up({ changedTouches: res.changedTouches || [] }); });
      if (typeof tt.onTouchCancel === 'function') tt.onTouchCancel(function (res) { up({ changedTouches: res.changedTouches || [] }); });
    }
  }

  function bindKeys() {
    var kd = function (e) {
      var k = e.key || e.keyCode;
      if (JUMP_KEYS[k]) { S.jumpQ++; S.keyJump = true; S.keyTaps.push('enter'); unlock(); if (e.preventDefault) e.preventDefault(); }
      else if (SPRINT_KEYS[k]) { S.keySprint = true; unlock(); if (e.preventDefault) e.preventDefault(); }
      else if (k === 'Enter') { S.keyTaps.push('enter'); S.anyAt = Date.now(); S.seq++; if (e.preventDefault) e.preventDefault(); }
      else if (k === 'Escape' || k === 'p' || k === 'P') { S.keyTaps.push('pause'); }
      else if (k === 'm' || k === 'M') { S.keyTaps.push('mute'); }
    };
    var ku = function (e) {
      var k = e.key || e.keyCode;
      if (JUMP_KEYS[k]) S.keyJump = false;
      else if (SPRINT_KEYS[k]) S.keySprint = false;
    };
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    } else if (typeof tt !== 'undefined' && typeof tt.onKeyDown === 'function') {
      tt.onKeyDown(kd); tt.onKeyUp(ku);
    }
  }

  S.init = function (canvas) {
    S.taps.length = 0; S.keyTaps.length = 0; S.active = {}; S.jumpQ = 0; S.keySprint = false; S.keyJump = false;
    if (canvas) bindTouch(canvas);
    bindKeys();
  };
  S.consumeJump = function () { var v = S.jumpQ > 0; S.jumpQ = 0; return v; };
  S.isSprintHeld = isSprint;
  S.isJumpHeld = function () { for (var k in S.active) if (!S.active[k].ui && S.sprintZone && !S.sprintZone(S.active[k].x, S.active[k].y)) return true; return S.keyJump; };
  S.takeKeyTaps = function () { var v = S.keyTaps; S.keyTaps = []; return v; };
  // 标记某次按下已被界面消耗：它不再参与蹬车 / 跳跃
  S.consumeTap = function (tap) { tap.used = true; if (S.active[tap.id]) S.active[tap.id].ui = true; };
  // 某次按下是否落在当前已登记的界面按钮上（rects 由 hud 在绘制时登记）
  S.isUi = function (tap) {
    var R = PR.hud && PR.hud.rects, k, r;
    if (!R || !tap) return false;
    for (k in R) {
      r = R[k];
      if (tap.x >= r.x && tap.x <= r.x + r.w && tap.y >= r.y && tap.y <= r.y + r.h) return true;
    }
    return false;
  };
  // 帧末兜底：仍按在按钮上的指针标记为界面操作（不会触发蹬车 / 跳跃）
  S.markUi = function (tap) { if (tap && !tap.used && S.isUi(tap)) S.consumeTap(tap); };
  S.endFrame = function () { for (var i = 0; i < S.taps.length; i++) S.markUi(S.taps[i]); S.taps.length = 0; };
  S.reset = function () { S.taps.length = 0; S.keyTaps.length = 0; S.jumpQ = 0; S.keySprint = false; S.keyJump = false; S.active = {}; };
})();
