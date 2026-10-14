# TER T1 · CP-06 动态执行记录

`CP=CP-06`
`STATUS=PASS`
`AUTHOR_VERDICT=CP06_DYNAMIC_ACCEPTANCE_CLOSED`

本记录绑定当前已归档的 Web/Android owner-flow runs。它证明 CP-06 计划内 owner-flow 动态场景在当前字节上已关闭；它不替代全批 6b、13c 或整批 `REVIEW_TARGET=IMPLEMENTATION`。

## 判据与顺序

- 依据：`doc/plans/platform/2026-10-13-ter-key-code-structure-t1-implementation-plan-codex.md` §7、`doc/plans/platform/2026-10-13-ter-key-code-structure-t1-implementation-design-codex.md` §11a/§13c，以及已完成的 CP-06 `TEST_CHAIN_PREFLIGHT` R1/R2。
- 使用唯一受管入口 `scripts/test/terminal-automation.mjs`；未恢复旧 runner，未使用手工 adb 或旁路验证。
- 已通过且未受后续字节影响的 Web runs 与 console Android run 直接复用；此前 wallpaper Android 首败按同失败族读取日志并定位到受管 HTTP/asset tunnel 正文传输边界后，只重跑该缺口场景。

## 当前可用的 owner-flow 运行

| 执行面 / sample | Run ID / 开始时间 UTC | Business | Diagnostics | Cleanup | 业务观察 |
|---|---|---|---|---|---|
| Expo Web / console | `2fab25c2-3a24-4daa-b807-93deba1e10e3` / `2026-10-13T21:44:41Z` | PASS | 平台专属 Android 项 `N/A`；managed DEV 日志成功读取 | PASS | FULL/HOT 真实供给、report receipt、Operations history 和最终 actual identity 一致 |
| Expo Web / wallpaper | `24976967-4bca-4b09-ae00-3ae108ce551c` / `2026-10-13T21:51:00Z` | PASS | 平台专属 Android 项 `N/A`；managed DEV 日志成功读取 | PASS | FULL/HOT 真实供给、report receipt、Operations history 和最终 actual identity 一致 |
| Android 双屏真机 / console | `0a21ae09-8a15-49f3-b8be-c1195dde0707` / `2026-10-13T22:09:08Z` | PASS | Android `PASS` | PASS | 原生 FULL 下载完整并出现安装器确认；owner-flow、报告及版本读回通过 |
| Android mobile 模拟器 / wallpaper | `15cf417a-3f23-466a-a203-998ce1c296a8` / `2026-10-13T23:11:35Z` | PASS | Android `PASS`；managed DEV `PASS` | PASS | FULL/HOT 真实供给、FULL 25,340,111 bytes 与 HOT 3,103,438 bytes 均完整转发，PackageInstaller 成功回调，Operations history 与当前任务读回通过 |

## Wallpaper Android 首败与关闭证据

首败 run `52bc20f3-8d05-476b-84c0-68063a7d97d5` 记录：

- artifact content 已收到 `200` response headers，但代理仅转发 `6,217,338` bytes 后以 `ECONNRESET` 结束；Android 原生端声明长度 `25,340,012` bytes 后抛 `ProtocolException`，未进入安装器确认。
- 同窗口 `.runtime/r5/remote-http-asset-tds-tunnel.log` 有 `Can't assign requested address` 与 `Broken pipe`，CBS stream 日志记录开始及失败。该证据把首败定位在受管 HTTP/对象存储/tunnel 正文传输边界，不能证明 TER owner 或 Android 安装逻辑错误。
- 后台 `TerminalUpdateDownloadController` 已补充 streaming 失败日志字段，`./gradlew :apps:backend:catering-business-server:compileJava` 后续为 `BUILD SUCCESSFUL`；该日志改动只增强诊断，不把旧失败 run 改写为 PASS。

复验 run `15cf417a-3f23-466a-a203-998ce1c296a8` 关闭上述缺口：

- `TERMINAL_UPDATE_ARTIFACT=FULL PASS ... zipSha256=29d829... apkSha256=8ed27c... publicationId=faa928...`
- FULL 正文完整转发：`TERMINAL_AUTOMATION_BUSINESS_PROXY_BODY_END ... operation=terminalUpdateArtifactContent bytes=25340111 elapsedMs=58842`，随后 `FORWARD_FINISHED ... bytes=25340111`。
- 安装器链路完成：`TERMINAL_AUTOMATION_INSTALLER_SOURCE_SETTINGS ... action=setting-toggled readback=enabled`、`TERMINAL_AUTOMATION_INSTALLER_BUTTON ... label=Update action=install`、`TERMINAL_AUTOMATION_INSTALLER_COMPLETION ... source=success-callback-and-changed-apk`。
- FULL 后新会话读回：`TERMINAL_AUTOMATION_UPDATE_TARGET_ACCEPTED ... phase=fixed source=fresh-full-session`、`TERMINAL_AUTOMATION_UPDATE_STAGE_READBACK ... stage=full entryKind=embedded nativeBuild=2`。
- HOT 正文完整转发：`TERMINAL_AUTOMATION_BUSINESS_PROXY_BODY_END ... operation=terminalUpdateArtifactContent bytes=3103438 elapsedMs=6255`。
- 最终状态与报告：`TERMINAL_AUTOMATION_UPDATE_STATE ... status=SUCCEEDED ... reportPending=1`、`TERMINAL_AUTOMATION_SUPPLY_REPORT_READBACK ... terminal=matched taskId=0800cefa-ed2e-4c66-826e-18298623974c historyPage=1 currentTaskFound=1 visibleHistoryRows=9`。
- 断言与诊断：`TERMINAL_AUTOMATION_UPDATE_CASE_ASSERTIONS_PASS case=update.owner-flow run=15cf417a-3f23-466a-a203-998ce1c296a8`、`TERMINAL_AUTOMATION_DIAGNOSTICS_RESULT ... android=PASS managedDev=PASS`。
- cleanup：manifest 记录 `business=PASS`、`diagnostics=PASS`、`cleanup=PASS`；stdout 记录 `generated-artifacts.cleanup.passed ... removedBytes=2898594752`、`cleanup.passed ... processReadback=EMPTY ... androidDeviceCleanup=PASS`。

## 双机更新与 surfaceForm 差量

阶段计划要求 console 与 wallpaper 分别执行同 App `update.pair`。首个 console pair run `bacd91fd-01fd-4db3-b2a9-e42a160ad0fa` 在配对建链前被 topology 拒绝：测试安装器根据模拟器物理尺寸把 `surfaceForm=mobile` 传入，尽管该 pair 场景需要验证 laptop 双机 topology。根因不是 topology 资格规则，而是 automation build 的显式测试形态被 Android adapter 的真实设备形态覆盖。

最小修正是在两套 Android App wrapper 中让 automation-only 的 `EXPO_PUBLIC_TER_AUTOMATION_SURFACE_FORM` 优先于 adapter launch prop；普通构建没有该变量，仍使用 adapter 的真实设备形态。两个 app README 已同步说明这一边界。共享 Android TypeScript 配置允许 workspace source-only `.ts` imports 保持扩展名，以便 runner 直接加载 server-config resolver；生产 resolver 的 `.ts` import 未改变。

| 执行面 / sample | Run ID / UTC 开始—结束 | Business | Diagnostics | Cleanup | 业务观察 |
|---|---|---|---|---|---|
| Android 同 App 双机 / console | `d6d95c6b-c637-41b3-95bd-2c2e6d9a2124` / `2026-10-14T00:42:16Z`—`2026-10-14T00:47:36Z` | PASS | PASS | PASS | 两台独立 emulator `5556`（PAIR_MASTER）/`5554`（PAIR_SLAVE）；same-app pair 建立，主副机状态投影完成；FULL installer 成功回调 `status=0`，后续 HOT/报告流程完成，最终 selector `phase=SUCCEEDED`、报告 `pending=0`。 |
| Android 同 App 双机 / wallpaper | `052c705d-a073-47b1-8cb2-717ddb48d1d1` / `2026-10-14T00:47:46Z`—`2026-10-14T00:53:05Z` | PASS | PASS | PASS | 同两台独立 emulator；pair 后 slave 日志读回 `surfaceForm=laptop`、`instanceMode=SLAVE`、`displayRole=VICE`、`activationPeerCurrent=true`，并记录主到副状态投影；FULL installer 成功回调 `status=0`，更新状态 `SUCCEEDED`、报告 `pending=0`。 |

两个 run 均来自唯一受管入口 `scripts/test/terminal-automation.mjs`，具有独立 manifest 与 driver/Android/managed-DEV 日志；各自日志包含 `UPDATE_CASE_ASSERTIONS_PASS case=update.pair`、Android 与 managed-DEV diagnostics PASS、`androidDeviceCleanup=PASS` 以及生成产物清理 PASS。manifest 为 `firstFailure=null`、`lastKnownGood=cleanup`、`business=PASS`、`diagnostics=PASS`、`cleanup=PASS`。console pair 首个 topology 失败只记录为失败尝试；改动后同一 console 场景的 PASS 关闭该失败族，失败尝试未被覆盖成通过。

## Cleanup 与受管 DEV 边界

- Run `15cf417a-3f23-466a-a203-998ce1c296a8` 自身的 process/browser/Android cleanup 为 `PASS`，生成中间产物清理 `removedBytes=2898594752`。
- 本记录不把 DEV 是否长期保留作为 runner cleanup 判据；runner manifest 已单独记录 managed DEV diagnostic `PASS`。若后续交付 review 需要现场复验，应重新以当时 manifest 和受管入口核实 DEV 状态。
- CP-06 动态验收关闭不等于 13c 或整批 `REVIEW_TARGET=IMPLEMENTATION` 已关闭；这些收口项另行记录。

## 状态

- 当前字节上的最新运行：`052c705d-a073-47b1-8cb2-717ddb48d1d1`，2026-10-14 00:47:46 UTC 开始、00:53:05 UTC 结束，wallpaper Android `update.pair` 的 `business=PASS`、`diagnostics=PASS`、`cleanup=PASS`。
- 最后一次通过：同一 run，2026-10-14 00:53:05 UTC，与当前字节一致；它关闭了当前 Android automation pair 对 `surfaceForm` 的差量缺口。此前 `15cf417a-3f23-466a-a203-998ce1c296a8` 仍是 wallpaper Android owner-flow 的有效通过记录。
- Expo Web 两个 owner-flow 与 console Android owner-flow 均 PASS，详见上表；既有其他 CP/场景只在其原运行字节和范围内沿用，不升级为新的动态运行。
- 13c 逐代码对账与整批 IMPLEMENTATION 独立 review 仍需在本记录之后单独完成。
