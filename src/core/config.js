// src/core/config.js
// 全部可调数值集中在这里。单位：世界坐标 1 = 1 像素（缓冲区分辨率下）。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});

  PR.config = {
    // ---- 视口 ----
    TARGET_H: 330,          // 期望的缓冲区高度（实际按整数倍缩放适配屏幕）
    MAX_BUFFER_W: 1100,
    GROUND_H: 84,           // 基线以下的路面带高度
    ROAD_FAR: 14,           // 路面远边缘在基线上方的距离（路面纵深）
    PLAYER_X_FRAC: 0.27, PLAYER_X_MIN: 150, PLAYER_X_MAX: 250,
    STEP: 1 / 120,          // 固定物理步长

    // ---- 骑行 ----
    BASE_SPEED: 250,        // 滑行速度
    PEDAL_SPEED: 430,       // 蹬车速度
    HIT_SPEED: 95,          // 摔车后的速度
    STOP_SPEED: 0,
    ACCEL: 5.5,             // 速度趋近目标的系数
    SLOPE_FACTOR: 1.3,      // 坡度对速度的影响
    SLOPE_DRAIN: 1.6,       // 上坡额外耗力
    STAMINA_MAX: 100,
    STAMINA_DRAIN: 40,      // 蹬车每秒消耗
    STAMINA_REGEN: 24,      // 滑行每秒恢复
    STAMINA_MIN: 8,
    JUMP_V: 520, GRAVITY: 1700,
    JUMP_BUFFER: 0.14,      // 落地前按跳的预输入窗口
    HURT_TIME: 0.75, INVULN: 1.25, SLIP_TIME: 0.8,

    // ---- 追狗 ----
    // 狗在身后 150~180 以内会蓄力扑咬：看到"!"后起跳即可闪避；蓄力 + 扑出 = 0.56s 后咬到，所以 0.5s 内起跳都来得及。
    DOG_GAP_START: 300, DOG_GAP_MAX: 420, DOG_GAP_DIE: 78,   // 追到 78 以内 = 咬到后轮
    DOG_POUNCE_RANGE: 150,  // 距离小于此值且冷却完毕时扑咬
    DOG_TELEGRAPH: 0.3,     // 蓄力（"!"提示）时长
    DOG_POUNCE_TIME: 0.26,  // 扑出时长
    DOG_COOLDOWN: 2.4,      // 扑咬后的冷却
    DOG_SURGE: 75, DOG_SURGE_TIME: 1.1,   // 野狗间歇性冲刺的加速量与时长
    DOG_BITE_COINS: 6,      // 被扑中掉落的金币
    DODGE_CLEAR: 26,        // 腾空高度超过此值即完美闪避

    // ---- 关卡 ----
    DAY_LEN: [9000, 11000, 13000, 15000, 17000, 19000],       // 每天路程（10 单位 = 1 米）
    DOG_SPEED: [262, 272, 282, 290, 298, 306],                // 比滑行略快：不蹬车就会被慢慢追上
    TUTORIAL_X: 1500,
    FLAT_BEFORE: 320, FLAT_AFTER: 460,     // 营地前后平坦区

    // ---- 升级 ----
    UPGRADES: [
      { key: 'stamina', name: '肺活量', desc: '体力上限 +12%', max: 5 },
      { key: 'regen', name: '恢复力', desc: '体力恢复 +12%', max: 5 },
      { key: 'pedal', name: '大腿力量', desc: '蹬车速度 +4%', max: 5 },
      { key: 'light', name: '轻量车架', desc: '跳跃 +6% 滑行 +2%', max: 5 }
    ],
    UPGRADE_COST: [60, 140, 280, 480, 760]
  };
})();
