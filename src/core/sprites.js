// src/core/sprites.js
// 程序化像素精灵（字符串位图 + 调色板）。零外部图片资源，包体小、可离线运行。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});
  var C = PR.gfx.COLORS;

  PR.sprites = {
    cloud: {
      palette: { W: C.white },
      bitmap: [
        "    ####        ",
        "  ########      ",
        " ############   ",
        "##############  ",
        " ############   ",
        "  ##########    "
      ]
    },
    rock: {
      palette: { K: C.outline, D: C.rock, G: C.rockDark },
      bitmap: [
        "     KKKK     ",
        "   KKDDDDKK   ",
        "  KDDDDDDDDK  ",
        " KDDDDDDDDDDK ",
        "KDDDDDDDDDDDDK",
        "KDDDDDDDDDDDDK",
        " KGGGGGGGGGGK ",
        "  KGGGGGGGGK  "
      ]
    },
    bush: {
      palette: { K: C.outline, G: C.grass, D: C.grassDark },
      bitmap: [
        "  KKKK  ",
        " KGGGGK ",
        "KGGGGGGK",
        "KGGDGGGK",
        " KKKKKK "
      ]
    },
    milestone: {
      palette: { K: C.outline, W: C.white, D: C.rockDark, B: C.frameDark },
      bitmap: [
        " KKKKKK ",
        "KWWWWWWK",
        "KWBWBWWK",
        "KWWWWWWK",
        "KWWBWBWK",
        "KWWWWWWK",
        "KKKKKKKK",
        " DDDDDD "
      ]
    }
  };
})();
