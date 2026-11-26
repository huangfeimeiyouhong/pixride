// src/core/input.js
// 统一输入：触屏（左半屏=跳跃，右半屏按住=蹬车加速）+ 键盘。
// 兼容浏览器与抖音小游戏：小游戏运行时 window/canvas 可能没有 addEventListener，
// 此时回退到 tt.onTouchStart / canvas.ontouchstart 等 API。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});

  var state = {
    _jumpQueued: false,
    _anyQueued: false,
    _anyQueuedAt: 0,
    pedalHeld: false,
    jumpHeld: false,
    _jumpKeys: { ' ': 1, ArrowUp: 1, w: 1, W: 1 },
    _pedalKeys: { Shift: 1, ArrowRight: 1, d: 1, D: 1 }
  };

  // 首次输入时解锁音频（浏览器/小游戏自动播放策略）
  function tryUnlockAudio() {
    try { if (PR.audio && PR.audio.unlock) PR.audio.unlock(); } catch (e) {}
  }

  var lastAnyAt = 0;  // 去重：模拟器可能对一次物理按下派发多个事件
  function queueJump() { state._jumpQueued = true; queueAny(); }
  function queueAny() {
    var now = Date.now();
    if (now - lastAnyAt < 100) return;   // 100ms 内的重复按下视为同一次
    lastAnyAt = now;
    state._anyQueued = true;
    state._anyQueuedAt = now;
  }

  function zoneFromX(x, width) {
    return x < width * 0.45 ? 'jump' : 'pedal';
  }

  function getCanvasWidth(canvas) {
    return (canvas && canvas.width) ? canvas.width : 360;
  }

  // 安全绑定：优先 addEventListener，返回是否成功
  function on(target, type, handler, opts) {
    if (target && typeof target.addEventListener === 'function') {
      target.addEventListener(type, handler, opts);
      return true;
    }
    return false;
  }

  PR.input = {
    init: function (canvas) {
      if (!canvas) return;

      // ---- 键盘（仅浏览器等有 window.addEventListener 的环境）----
      var kd = function (e) {
        if (state._jumpKeys[e.key]) { queueJump(); state.jumpHeld = true; tryUnlockAudio(); e.preventDefault && e.preventDefault(); }
        if (state._pedalKeys[e.key]) { state.pedalHeld = true; tryUnlockAudio(); e.preventDefault && e.preventDefault(); }
        if (e.key === 'Enter') { queueAny(); tryUnlockAudio(); }
      };
      var ku = function (e) {
        if (state._jumpKeys[e.key]) state.jumpHeld = false;
        if (state._pedalKeys[e.key]) state.pedalHeld = false;
      };
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('keydown', kd);
        window.addEventListener('keyup', ku);
      }

      // ---- 触屏 / 鼠标 ----
      var activePointers = {}; // id -> zone
      var touchFiredAt = 0, touchEndedAt = 0;

      var touchesOf = function (e) {
        if (!e) return [];
        if (e.changedTouches && e.changedTouches.length) return e.changedTouches;
        if (e.touches && e.touches.length) return e.touches;
        return [e];
      };

      var onDown = function (e, isTouch) {
        var now = Date.now();
        if (isTouch) { touchFiredAt = now; }
        else if (now - touchFiredAt < 500) { return; } // 忽略触屏后合成的鼠标事件
        tryUnlockAudio();
        queueAny();
        var w = getCanvasWidth(canvas);
        var changed = touchesOf(e);
        var rect = null;
        try { rect = (canvas.getBoundingClientRect) ? canvas.getBoundingClientRect() : null; } catch (err) { rect = null; }
        for (var i = 0; i < changed.length; i++) {
          var t = changed[i];
          var cx = (t.clientX != null) ? t.clientX : (t.pageX != null ? t.pageX : 0);
          if (rect) cx = cx - (rect.left || 0);
          var zone = zoneFromX(cx, rect ? (rect.width || w) : w);
          var id = (t.identifier != null) ? t.identifier : 'mouse';
          activePointers[id] = zone;
          if (zone === 'jump') { queueJump(); state.jumpHeld = true; }
          else state.pedalHeld = true;
        }
        e.preventDefault && e.preventDefault();
      };
      var onUp = function (e, isTouch) {
        var now = Date.now();
        if (isTouch) { touchEndedAt = now; }
        else if (now - touchEndedAt < 500) { return; }
        var changed = touchesOf(e);
        var stillPedal = false, stillJump = false;
        for (var i = 0; i < changed.length; i++) {
          var t = changed[i];
          var id = (t.identifier != null) ? t.identifier : 'mouse';
          delete activePointers[id];
        }
        for (var k in activePointers) {
          if (activePointers[k] === 'pedal') stillPedal = true;
          if (activePointers[k] === 'jump') stillJump = true;
        }
        state.pedalHeld = stillPedal;
        state.jumpHeld = stillJump;
      };

      // 优先用 canvas.addEventListener（现代小游戏 / 浏览器）
      // 触屏与鼠标事件区分：模拟器可能对一次点击同时派发 touchstart 和 mousedown，
      // 用 isTouch + touchFiredAt 去重，避免输入被置位两次。
      var onDownTouch = function (e) { onDown(e, true); };
      var onDownMouse = function (e) { onDown(e, false); };
      var onUpTouch = function (e) { onUp(e, true); };
      var onUpMouse = function (e) { onUp(e, false); };
      var gotTouch = on(canvas, 'touchstart', onDownTouch, { passive: false });
      on(canvas, 'touchend', onUpTouch);
      on(canvas, 'touchcancel', onUpTouch);
      on(canvas, 'mousedown', onDownMouse);
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('mouseup', onUpMouse);
      } else {
        on(canvas, 'mouseup', onUpMouse);
      }

      // 回退：抖音小游戏全局触摸 API
      if (!gotTouch && typeof tt !== 'undefined') {
        if (typeof tt.onTouchStart === 'function') tt.onTouchStart(onDown);
        if (typeof tt.onTouchEnd === 'function') tt.onTouchEnd(onUp);
        if (typeof tt.onTouchCancel === 'function') tt.onTouchCancel(onUp);
      } else if (!gotTouch) {
        // 最后回退：ontouchstart 属性赋值
        if (canvas.ontouchstart !== undefined) canvas.ontouchstart = onDown;
        if (canvas.ontouchend !== undefined) canvas.ontouchend = onUp;
      }
    },

    consumeJump: function () {
      var v = state._jumpQueued;
      state._jumpQueued = false;
      return v;
    },
    consumeAny: function (since) {
      var v = state._anyQueued;
      state._anyQueued = false;
      if (!v) return false;
      // 只接受进入当前状态之后的新按下，避免游戏内的点击残留触发结算画面秒退
      if (since != null && state._anyQueuedAt < since) return false;
      return true;
    },
    isPedalHeld: function () { return !!state.pedalHeld; },
    isJumpHeld: function () { return !!state.jumpHeld; },
    reset: function () {
      state._jumpQueued = false; state._anyQueued = false; state.pedalHeld = false; state.jumpHeld = false;
    }
  };
})();
