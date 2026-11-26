// game.js — 抖音小游戏入口
// 按依赖顺序加载核心模块（均挂到全局命名空间 PR），再创建画布并启动游戏。
require('./src/core/raf.js');
require('./src/core/config.js');
require('./src/core/gfx.js');
require('./src/core/sprites.js');
require('./src/core/input.js');
require('./src/core/audio.js');
require('./src/world/background.js');
require('./src/entities/player.js');
require('./src/entities/dog.js');
require('./src/entities/obstacle.js');
require('./src/entities/item.js');
require('./src/world/level.js');
require('./src/game/main.js');

(function () {
  var PR = globalThis.PR;
  var cfg = PR.config;

  // 读取视口信息：逻辑尺寸（windowWidth/Height）+ 像素比 + 安全区（刘海/状态栏）。
  // 注意：横屏时 tt.getSystemInfoSync().safeArea 仍是竖屏坐标，需旋转到横屏坐标系，
  // 否则 right/top 会是竖屏值，把 HUD 文字错误地推向屏幕中间。
  function viewport() {
    var s = tt.getSystemInfoSync();
    var vw = s.windowWidth, vh = s.windowHeight;
    var sa = s.safeArea || { left: 0, top: 0, right: vw, bottom: vh };
    var saW = sa.right - sa.left, saH = sa.bottom - sa.top;
    if (vw >= vh && saW < saH) {
      // 视口横屏、safeArea 竖屏 → 顺时针旋转 90°（横屏 home 在右）
      var SH = vw; // 竖屏高度 = 横屏长边宽度
      sa = {
        left: SH - sa.bottom,
        top: sa.left,
        right: SH - sa.top,
        bottom: sa.right
      };
    }
    return { viewW: vw, viewH: vh, dpr: s.pixelRatio || 1, safeArea: sa };
  }

  // 主画布（第一个 createCanvas 即显示画布）；物理分辨率交给 Game 按 DPR 设置
  var canvas = tt.createCanvas();
  var v0 = viewport();

  // 低分辨率离屏帧缓冲
  var buffer = tt.createCanvas();
  buffer.width = cfg.BUFFER_W;
  buffer.height = cfg.BUFFER_H;

  // 输入
  PR.input.init(canvas);

  // 音效（首次用户交互时解锁）
  if (PR.audio && PR.audio.init) PR.audio.init();

  // 启动
  var game = new PR.Game({
    canvas: canvas,
    buffer: buffer,
    viewW: v0.viewW,
    viewH: v0.viewH,
    dpr: v0.dpr,
    safeArea: v0.safeArea
  });
  game.start();

  // 暴露给自动化调试探针（miniapp-execute-js 可读取状态）
  globalThis.__pixelRide = game;

  // 窗口尺寸变化（如旋转、分屏）时更新视口
  if (typeof tt.onWindowResize === 'function') {
    tt.onWindowResize(function () {
      var v = viewport();
      game.resize(v.viewW, v.viewH, v.dpr, v.safeArea);
    });
  }
  // 切后台自动暂停，回来恢复（并重置时钟防止 dt 大跳）
  if (typeof tt.onHide === 'function') tt.onHide(function () { game.pause(); });
  if (typeof tt.onShow === 'function') tt.onShow(function () { game.resume(); });
})();
