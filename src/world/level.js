// src/world/level.js
// 关卡：障碍 + 道具 的生成 / 回收 / 碰撞判定 / 终点里程碑。Day1「被野狗追」。
// 通过 events[] 向 Game 上报本帧事件：clearRock（成功跳过石头）、pickup（拾取道具）。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global : Function('return this')()));
  var PR = g.PR || (g.PR = {});
  var cfg = PR.config;

  PR.Level = function (opts) {
    this.playerScreenX = opts.playerScreenX;
    this.length = cfg.LEVEL_LENGTH;
    this.reset();
  };

  PR.Level.prototype.reset = function () {
    this.obstacles = [];
    this.items = [];
    this.events = [];            // 本帧事件，Game 消费后清空
    this.nextSpawn = 320;        // 第一个障碍
    this.nextItemSpawn = 420;    // 第一个道具
    this.finished = false;
  };

  PR.Level.prototype.update = function (player, dt) {
    // ---- 障碍生成 ----
    var spawnAhead = 420;
    while (this.nextSpawn < player.worldX + spawnAhead) {
      var type = Math.random() < 0.78 ? 'rock' : 'bush';
      this.obstacles.push(new PR.Obstacle(this.nextSpawn, type));
      var gap = cfg.OBSTACLE_MIN_GAP + Math.random() * (cfg.OBSTACLE_MAX_GAP - cfg.OBSTACLE_MIN_GAP);
      this.nextSpawn += gap;
    }
    // ---- 道具生成 ----
    var itemAhead = 480;
    while (this.nextItemSpawn < player.worldX + itemAhead) {
      var prog = Math.min(1, player.worldX / this.length);
      var r = Math.random();
      // 越往后打狗棒越常见（狗更快更凶，需要更多反击手段）
      var wStick = 0.14 + 0.12 * prog;
      var wStam = 0.22 + 0.06 * prog;
      if (r < wStick) {
        this.items.push(new PR.Item(this.nextItemSpawn, 'stick', cfg.ITEM_GROUND_Y));
      } else if (r < wStick + wStam) {
        this.items.push(new PR.Item(this.nextItemSpawn, 'stamina', cfg.ITEM_GROUND_Y));
      } else {
        // 金币串：n 枚等距排列，一半贴地、一半抬高（需跳跃）
        var n = cfg.COIN_CLUSTER_MIN + Math.floor(Math.random() * (cfg.COIN_CLUSTER_MAX - cfg.COIN_CLUSTER_MIN + 1));
        var high = Math.random() < 0.5;
        var h = high ? cfg.ITEM_HIGH_Y : cfg.ITEM_GROUND_Y;
        for (var i = 0; i < n; i++) {
          // 抬高串做成轻微上抛弧线，引导跳跃
          var arc = high ? Math.round(Math.sin((i / Math.max(1, n - 1)) * Math.PI) * 10) : 0;
          this.items.push(new PR.Item(this.nextItemSpawn + i * 15, 'coin', h + arc));
        }
      }
      var ig = cfg.ITEM_MIN_GAP + Math.random() * (cfg.ITEM_MAX_GAP - cfg.ITEM_MIN_GAP);
      this.nextItemSpawn += ig;
    }

    // ---- 回收 & 事件上报 ----
    for (var i = this.obstacles.length - 1; i >= 0; i--) {
      var o = this.obstacles[i];
      if (o.worldX < player.worldX - 80) {
        if (o.type === 'rock' && !o.hit && !o.scored) {
          this.events.push({ type: 'clearRock' });   // 成功越过石头
        }
        this.obstacles.splice(i, 1);
      }
    }
    for (var j = this.items.length - 1; j >= 0; j--) {
      if (this.items[j].worldX < player.worldX - 80) this.items.splice(j, 1);
    }

    // ---- 拾取判定 ----
    for (var k = 0; k < this.items.length; k++) {
      var it = this.items[k];
      if (it.collected) continue;
      if (Math.abs(it.worldX - player.worldX) < cfg.PICKUP_RANGE_X &&
          Math.abs(player.y - it.y) < cfg.PICKUP_RANGE_Y) {
        it.collected = true;
        this.events.push({ type: 'pickup', item: it.type });
      }
    }
    // 推进道具动画
    for (var m = 0; m < this.items.length; m++) this.items[m].update(dt);

    // 终点判定
    if (player.worldX >= this.length) this.finished = true;
  };

  // Game 调用：取出并清空本帧事件
  PR.Level.prototype.drainEvents = function () {
    var ev = this.events;
    this.events = [];
    return ev;
  };

  // 返回是否发生撞击（每障碍只触发一次）
  PR.Level.prototype.checkCollision = function (player) {
    var hit = false;
    for (var i = 0; i < this.obstacles.length; i++) {
      var o = this.obstacles[i];
      if (o.type !== 'rock' || o.hit) continue;
      var dx = Math.abs(o.worldX - player.worldX);
      if (dx < cfg.ROCK_HALF_W + 14) {
        if (player.y < cfg.ROCK_H - 1) {
          o.hit = true;
          player.hit();
          hit = true;
        }
      }
    }
    return hit;
  };

  PR.Level.prototype.draw = function (ctx, player) {
    for (var i = 0; i < this.obstacles.length; i++) {
      var o = this.obstacles[i];
      var sx = o.screenX(player.worldX, this.playerScreenX);
      if (sx < -30 || sx > cfg.BUFFER_W + 30) continue;
      o.draw(ctx, sx, cfg.GROUND_Y);
    }
    for (var j = 0; j < this.items.length; j++) {
      var it = this.items[j];
      if (it.collected) continue;
      var isx = it.screenX(player.worldX, this.playerScreenX);
      if (isx < -20 || isx > cfg.BUFFER_W + 20) continue;
      it.draw(ctx, isx, cfg.GROUND_Y);
    }
    // 终点里程碑
    var finishSX = Math.round(this.length - player.worldX + this.playerScreenX);
    if (finishSX > -20 && finishSX < cfg.BUFFER_W + 20) {
      var m = PR.sprites.milestone;
      PR.gfx.drawBitmap(ctx, m.bitmap, m.palette, finishSX - 4, cfg.GROUND_Y - 11, 1);
    }
  };

  PR.Level.prototype.progress = function (player) {
    return Math.min(1, player.worldX / this.length);
  };
})();
