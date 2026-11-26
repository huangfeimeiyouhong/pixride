// src/core/config.js
// 全局调参常量：分辨率、物理、关卡、数值平衡集中在此，便于后续扩展多关卡。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});

  PR.config = {
    // 低分辨率帧缓冲（放大后即复古像素感）
    BUFFER_W: 360,
    BUFFER_H: 180,

    GROUND_Y: 142,          // 地面基线（车轮底部）
    PLAYER_SCREEN_X: 92,    // 骑行者固定屏幕 X

    // 速度（虚拟像素 / 秒）
    BASE_SPEED: 130,        // 自动巡航速度
    PEDAL_SPEED: 250,       // 蹬车爆发速度
    DOG_SPEED: 136,         // 野狗奔跑速度（略高于巡航，制造压迫感）
    HIT_SPEED: 45,          // 撞障碍后短暂速度

    // 物理（y 为离地高度，向上为正）
    GRAVITY: 1500,          // px/s^2（向下加速度）
    JUMP_VELOCITY: 560,     // 起跳初速度（向上为正）
    MAX_FALL: 760,          // 最大下落速度（幅值）

    // 体力
    STAMINA_MAX: 100,
    PEDAL_DRAIN: 52,        // 蹬车消耗 / 秒
    PEDAL_REGEN: 26,        // 恢复 / 秒
    PEDAL_MIN: 6,           // 体力低于此值无法蹬车

    // 关卡（Day 1 被野狗追）
    LEVEL_LENGTH: 2800,     // 到今日营地的总里程（虚拟 px ≈ 米）
    DOG_GAP_START: 185,     // 初始狗与骑行者距离
    DOG_GAP_MIN: 10,        // 小于此距离即被追上
    DOG_GAP_MAX: 460,

    // 障碍
    OBSTACLE_MIN_GAP: 150,
    OBSTACLE_MAX_GAP: 320,
    ROCK_HALF_W: 7,
    ROCK_H: 9,
    HIT_STUN: 0.55,         // 撞击减速时长（秒）

    // 积分
    SCORE_PER_METER: 1,
    SCORE_COIN: 10,
    SCORE_STAMINA: 5,
    SCORE_STICK: 25,
    SCORE_CLEAR_ROCK: 8,

    // 道具（沿路可拾取）
    ITEM_MIN_GAP: 120,
    ITEM_MAX_GAP: 260,
    COIN_CLUSTER_MIN: 3,
    COIN_CLUSTER_MAX: 5,
    PICKUP_RANGE_X: 19,     // 拾取 X 半径
    PICKUP_RANGE_Y: 17,     // 拾取 Y 半径（离地高度差）
    ITEM_GROUND_Y: 12,      // 贴地道具离地高度
    ITEM_HIGH_Y: 46,        // 跳高金币离地高度（约跳跃顶点）
    STAMINA_RESTORE: 45,
    STICK_KNOCKBACK: 118,   // 打狗棒把狗打退的距离
    STICK_STUN: 1.3,        // 狗被打眩晕时长（秒）

    // 狗的进阶：随里程进化品种 + 提速 + 周期性猛扑
    DOG_BREED_BLACK_AT: 900,    // 恶犬出现里程
    DOG_BREED_WOLF_AT: 1700,    // 灰狼出现里程
    DOG_SPEED_BLACK: 150,
    DOG_SPEED_WOLF: 162,
    DOG_SPEED_RAMP: 0.011,      // 每米额外提速
    DOG_SPEED_CAP: 196,
    DOG_LUNGE_INTERVAL_START: 9.0,
    DOG_LUNGE_INTERVAL_MIN: 3.2,
    DOG_LUNGE_DURATION: 0.7,
    DOG_LUNGE_SPEED_MULT: 1.55,
    DOG_STUN_SPEED_MULT: 0.35,

    // 渲染
    UPSCALE_MIN: 2,
    COLORS: null            // 由 gfx 注入
  };
})();
