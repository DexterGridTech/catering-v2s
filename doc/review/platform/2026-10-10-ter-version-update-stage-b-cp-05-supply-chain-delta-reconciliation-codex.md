# TER 阶段 B CP-05 供给链差量对账

`REVIEW_SCOPE=CP-05_SUPPLY_CHAIN_CURRENT_DELTA`
`VERDICT=MATCHED`
`REVIEWER=FRESH_INDEPENDENT_READ_ONLY_SUBAGENT`

## 范围

本记录只覆盖 CP-05 中 `update.supply-chain` 的 wallpaper 中间 FULL 会话断言边界、流式工件空闲超时，以及 console/wallpaper 两个指定真机供给链运行。它不代替完整 CP-05、全批 6b、13c 或整批 `REVIEW_TARGET=IMPLEMENTATION`。

## 对账依据

- 详设要求同一受管供给链完成后台 FULL/HOT 保存、规则启用、TDC snapshot、A command、CBS grant/content、真实 FULL→HOT 更新、HTTP 报告及运营端读回；本轮 TER 执行面为单机双屏 Android。
- `tools/terminal-automation/journeys/update.android.test.ts:2268-2279` 保留 FULL 的 embedded/native-build 实际读回；`:2285-2288` 仅在 wallpaper 的供给链 case 跳过紧随其后的中间 FULL 登录/assets 检查，因为 HOT 会立即替换该 session；`:2350-2359` 仍断言最终 HOT 身份并对 wallpaper 等待 assets `loaded`；`:2725-2828` 保留报告投递与后台报告读回。
- 同文件 `:250-342` 将 `terminalUpdateArtifactContent` 的 socket idle timeout 设为 115 秒；实际 wallpaper run 完整流入 18,460,476 bytes，未改变其他操作 timeout。
- Fresh reviewer 独立检查上述源、计划判据与运行日志，结论为本差量 `MATCHED`。Review 输出及证据范围见本 turn 独立 CP-05 reviewer 结论。

## 动态证据

| App | Run | 执行面 | 结果 | 关键业务读回 |
|---|---|---|---|---|
| console | `313353c8-f19c-4ca0-9d7a-65e5e5bbbfe1` | Android / dual / `D409P5C2J0285` | business PASS；cleanup PASS | FULL/HOT 供给与启用、真实更新、CBS 报告投递归零、运营端 `terminal=matched history=1` |
| wallpaper | `ad05f7b8-6ef0-4ab9-ba75-59ba9fe63066` | Android / dual / `D409P5C2J0285` | business PASS；cleanup PASS | FULL/HOT 供给与启用、最终 HOT wallpaper assets `loaded`、真实报告投递归零、运营端 `terminal=matched history=1` |

两次 manifest 均记录 `firstFailure=null`，日志有 `TERMINAL_AUTOMATION_UPDATE_CASE_ASSERTIONS_PASS`；事件记录显示生成工件清理、设备卸载/读回、连接与 browser cleanup 通过。失败运行保留为历史首败，不由该记录覆盖。

## 证据限制

两个 run manifest 未含源码 digest、git revision 或 workspace hash，因此它们不是强 hash-bound 证据；本结论将其标记为本批受管运行证据，不声明来源提交摘要绑定。Web、mobile、双机与其他 Stage B 场景仍按授权边界保持 `NOT_RUN`/`NOT_COVERED`。本结论仅关闭当前 CP-05 差量，不给 Stage B 整批 `GO`。
