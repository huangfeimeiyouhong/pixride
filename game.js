// game.js — 抖音小游戏入口
// 按依赖顺序加载模块（均挂到全局命名空间 PR），再创建画布并启动游戏。
// 注意：小游戏运行时里第一次 tt.createCanvas() 返回的是上屏画布，所以必须先创建主画布，再加载模块。
var mainCanvas = tt.createCanvas();
require('./src/core/sys.js');
require('./src/core/raf.js');
require('./src/core/config.js');
require('./src/core/gfx.js');
require('./src/core/sprites.js');
require('./src/core/props.js');
require('./src/core/themes.js');
require('./src/core/input.js');
require('./src/core/synth.js');
require('./src/core/audio.js');
require('./src/world/terrain.js');
require('./src/world/background.js');
require('./src/entities/obstacle.js');
require('./src/entities/item.js');
require('./src/entities/player.js');
require('./src/entities/dog.js');
require('./src/world/level.js');
require('./src/game/save.js');
require('./src/game/particles.js');
require('./src/game/fx.js');
require('./src/game/hud.js');
require('./src/game/screens.js');
require('./src/game/main.js');

(function () {
  var PR = globalThis.PR;

  // 读取视口信息：逻辑尺寸（windowWidth/Height）+ 像素比 + 安全区（刘海/状态栏）。
  // 注意：横屏时 tt.getSystemInfoSync().safeArea 仍是竖屏坐标，需旋转到横屏坐标系。
  function viewport() {
    var s = tt.getSystemInfoSync();
    var vw = s.windowWidth, vh = s.windowHeight;
    var sa = s.safeArea || { left: 0, top: 0, right: vw, bottom: vh };
    var saW = sa.right - sa.left, saH = sa.bottom - sa.top;
    if (vw >= vh && saW < saH) {
      // 视口横屏、safeArea 竖屏 → 顺时针旋转 90°（横屏 home 在右）
      var SH = vw;
      sa = { left: SH - sa.bottom, top: sa.left, right: SH - sa.top, bottom: sa.right };
    }
    return { viewW: vw, viewH: vh, dpr: s.pixelRatio || 1, safeArea: sa };
  }

  var v0 = viewport();
  var buffer = tt.createCanvas();                 // 低分辨率帧缓冲

  PR.input.init(mainCanvas);
  PR.audio.init();

  var game = new PR.Game({
    canvas: mainCanvas,
    buffer: buffer,
    viewW: v0.viewW,
    viewH: v0.viewH,
    dpr: v0.dpr,
    safeArea: v0.safeArea
  });
  game.start();

  // 暴露给自动化调试探针（可读取 / 修改状态）
  globalThis.__pixelRide = game;

  // 窗口尺寸变化（如旋转、分屏）时更新视口
  if (typeof tt.onWindowResize === 'function') {
    tt.onWindowResize(function () {
      var v = viewport();
      game.resize(v.viewW, v.viewH, v.dpr, v.safeArea);
    });
  }
  // 切后台自动暂停（回到前台后停在暂停菜单，由玩家继续）
  if (typeof tt.onHide === 'function') tt.onHide(function () { game.autoPause(); });
  if (typeof tt.onShow === 'function') tt.onShow(function () { game.autoResume(); });
})();
