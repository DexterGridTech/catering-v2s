# Focused first-failure record — startup completion after N-2 ordering change

日期：2026-09-15

## 复现

在 `ScreenReadyBoundary` 改为先调用 console-assembly readiness writer、再调用 native
loading hide 后，分别运行：

```text
yarn workspace @catering-v2s/ui-integration-sample-console test --runInBand
yarn workspace @catering-v2s/ui-integration-sample-wallpaper-console test
```

首个可观察失败为：

- `sample-console` 的 `does not reuse a platform-port run id for separate console writers`
  找不到 `startup.complete` 的 run id；完整输出保存在
  `/tmp/ter-sample2-focused-console-first-failure-20260915.log`。
- 随后单独修复了 platform-port descriptor 的 `__DEV__` 边界后，sample-console
  该用例恢复；`sample-wallpaper-console` 的
  `keeps one startup completion across a real-part navigation in one runtime` 仍为
  `startup.complete` 数量 0。

## 根因与边界

这是两个相邻但不同的 focused 边界：

1. `startup.complete` 的 `ports` 组使用真实 capability descriptor 判断，而默认端口、
   Android adapter 与 Web adapter 原先只在 `__DEV__` 注册 descriptor；因此
   `__DEV__=false` 的运行期判定必然返回未完成。该根因修复为让 descriptor 成为运行期
   元数据，并让 integration test support 为自定义 sink/device/storage 保留显式 fixture
   descriptor；没有放宽 writer 的 readiness 条件。
2. wallpaper 失败用例只手动触发了 `ScreenReadyBoundary` 的 layout，没有触发外层
   `InputSurfaceFrame` 的测量回调；故 `primaryMeasured=false`，writer 按需求拒绝写
   `startup.complete`。这是测试缺少真实 surface-measurement 事件，不是 production writer
   应忽略该前提。

## 处置状态

第 1 项源码修复后 sample-console 全包 37/37 通过；第 2 项补发真实的 primary surface
measurement 后，sample2 wallpaper 全包 14/14 通过。platform-ports 18/18 通过（另有
2 个既有 skip）。此记录保留首败，不把 `tee` 管道的 shell exit 0 当作测试 PASS。
