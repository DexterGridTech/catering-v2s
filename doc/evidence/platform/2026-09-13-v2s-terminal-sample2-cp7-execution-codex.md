# TER sample2 壁纸终端 CP-7 执行证据

- `RUN_ID`: `ter-sample2-cp7-20260914-01`
- `SCOPE`: sample2 assembly、Expo/Android 入口、壁纸选择/确认/恢复、共享 admin console
  生产接入，以及当前两个 `ui/integration` 包的 360×640 mobile 规则。
- `STATUS`: `ANDROID_DYNAMIC_PARTIAL_WITH_OPEN_REVIEW_ITEMS`
- `AUTHORITY`: Dexter 已授权 sample2 实施与动态验收；仅使用 TER 自有 Expo/Metro、Gradle、
  `adb`、`uiautomator` 和仓内静态/包测试。未启动后台 DEV，未执行 seed、UAT、部署或 Git，
  未使用 computer use。
- `EXECUTED_AT`: `2026-09-14 00:22-08:04 +09:00`

本证据只记录已经真实执行的 CP-7 工作；未运行的档位保持 `NOT_RUN`/`OPEN`，不由截图、
测试名称或退出码提升为完整 implementation acceptance。

## 首败、诊断和最后已知良好

1. 静态骨架重跑最初发现 sample2 assembly 的 `ui.base.admin-shell` 被误加到了 picker 节点，
   造成依赖图与真实 owner 不一致。主 agent 删除该错误边后重跑，skeleton 与 layering 静态
   门均恢复通过。这个失败是门对错误依赖的有效拦截，不是通过后隐藏。
2. CP-7 的 `none` 确认第一次 adb 点按未命中按钮，初始 XML/截图显示 state 没有变化；保留
   了该日志和截图，边界诊断为第一次坐标/时机点按未命中，随后在同一真实控件上用第二个
   已定位坐标重试成功，`none` confirmed、`background` 节点消失且按钮禁用。当前没有证据
   把它归因于源码缺陷，仍作为输入命中稳定性观察记录。
3. Android debug 期间出现 `power-bridge.subscription-unavailable` 的 LogBox 警告。源码
   `apps/terminal/kernel/base/display-context/src/application/createPowerStatusBridge.ts`
   将可选 `subscribePowerStatus` unavailable 记录为 warning；这不是 `persistKv`/`persistSecure`
   失败，也没有观察到 fatal app exception。它曾遮挡确认控件，实测中通过 LogBox 关闭控件
   后继续完成同一业务动作。该 warning 的产品呈现不在 sample2 wallpaper owner 范围内，
   不将其伪装成 PASS，也不把它扩写为 persistKV 根因。
4. CP-7 的真实滚动诊断发现 `InputSurfaceFrame` 外层 `Pressable` 会在嵌套的
   `PrimitiveScrollView` 上抢 responder，导致确认按钮在长 picker 上不能通过真实滚动稳定进入
   操作区。主 agent 在共享输入边界补了
   `onStartShouldSetResponder={event => event.target === event.currentTarget}` 与
   `onStartShouldSetResponderCapture={() => false}`：直接点 surface content 仍可 dismiss，
   后代 ScrollView 不再被父级抢 responder；并在 `ui/base/input` focused 回归中锁死该行为。
   重建并安装当前 APK 后，mobile 的真实 `adb shell input ... swipe` 已能移动 picker 内容并
   露出确认按钮。该修复是共享输入边界的根因修复，不新增 sample2 专用滚动逻辑。

`last known good`：删除错误 graph edge 后，两个 integration 包 typecheck/test、skeleton/layering/
runtime/display-context 静态门均通过；随后两台 VM 均完成真实登录、选择/确认、重启恢复和
admin 浮层重开/恢复观察。

## 静态与 focused 结果

| 检查 | 真实结果 | 原始记录 |
| --- | --- | --- |
| sample-console typecheck | exit 0 | `/tmp/ter-sample2-cp7-sample-console-typecheck.log` |
| sample-console package tests | 7 files / 35 tests passed，`TERMINAL_PACKAGE_TEST=PASS` | 当前回合 fresh output |
| sample-wallpaper-console typecheck | exit 0 | `/tmp/ter-sample2-cp7-sample-wallpaper-typecheck.log` |
| sample-wallpaper-console package tests | 4 files / 12 tests passed，`TERMINAL_PACKAGE_TEST=PASS` | 当前回合 fresh output |
| skeleton static | `SCAFFOLD_HYGIENE=PASS`，graph/dependency/entry gates PASS | command output retained in CP-7 run log；重跑结果摘要 `/tmp/ter-sample2-cp7-display-static.log` |
| skeleton red/model test | baseline 与 red mutation 均按预期，`TERMINAL_SKELETON_MODEL_TEST=PASS` | command output retained in CP-7 run log |
| layering static/red test | baseline、真实目录 census 与 fixture mutation gate PASS | command output retained in CP-7 run log |
| runtime/display-context static | `TERMINAL_RUNTIME_STATIC=PASS`、`TERMINAL_DISPLAY_CONTEXT_STATIC=PASS` | `/tmp/ter-sample2-cp7-display-static.log` |
| Android debug APK | `BUILD SUCCESSFUL`，当前 sample2 APK 可安装 | `/tmp/ter-sample2-cp7-android-assemble-360-admin.log` |

当前两个 `apps/terminal/ui/integration/*` 目录均已静态复核：package.json 与
`src/dependencies.ts` 声明 `@catering-v2s/ui-base-admin-shell`，assembly 将
`adminShellAssembly.parts` 放入同一 catalog，并以生产 `AdminLauncher` 包住 content；两包
的 mobile portrait 均为 `PRIMARY 360×640`，没有第二套 admin registry/open path。

### 当前回合 fresh focused/static/red 重跑

2026-09-14 01:22--01:24 在不使用 computer use、后台 DEV、seed、UAT、部署或 Git 的边界内，
主 agent 重新执行了当前可执行的 sample2 与共享基础包验证：

| 范围 | 实际输出 | 档位 |
| --- | --- | --- |
| `kernel/feature/sample-wallpaper` | 2 files / 9 tests，`TERMINAL_PACKAGE_TEST=PASS` | focused |
| `ui/feature/sample-wallpaper-picker` | 2 files / 9 tests，`TERMINAL_PACKAGE_TEST=PASS` | focused |
| `ui/integration/sample-wallpaper-console` | 4 files / 12 tests，`TERMINAL_PACKAGE_TEST=PASS` | focused |
| `ui/base/primitives` | 1 file / 16 tests，`TERMINAL_PACKAGE_TEST=PASS` | focused |
| `kernel/base/ui-state` | 6 files / 38 tests，`TERMINAL_PACKAGE_TEST=PASS` | focused |
| `ui/base/render` | 10 files / 46 tests，`TERMINAL_PACKAGE_TEST=PASS` | focused |
| `kernel/base/runtime` | 16 files / 94 tests，`TERMINAL_PACKAGE_TEST=PASS` | focused |
| `kernel/base/display-context` | 5 files / 57 tests，`TERMINAL_PACKAGE_TEST=PASS` | focused |
| `ui/base/admin-shell` | 2 files / 8 tests，`TERMINAL_PACKAGE_TEST=PASS` | focused |
| `adapter/android/dual-screen` | 1 file / 7 tests，`TERMINAL_PACKAGE_TEST=PASS` | focused |
| `ui/base/input` | 10 files / 50 tests，`TERMINAL_PACKAGE_TEST=PASS`；typecheck exit 0 | focused |
| picker `check-behavior.mjs` | baseline、F-A2b mutation、cleanup 均 PASS | focused/red |
| `tools/terminal-sample2/check-behavior.mjs` | kernel/picker/integration baseline、9 个 behavior red mutation、2 个 admission rejection、恢复后 baseline、cleanup 均 PASS；F-A9_RUNTIME 另以受控真实 Android 变异执行 | focused/red + Android red |
| image-compare self-test | threshold mutation、self-test、cleanup 均 PASS | focused/red |
| primitives `check-behavior.mjs` | baseline、theme mutation、cleanup 均 PASS | focused/red |
| render `check-behavior.mjs` | 26 个 mutation vector 均 PASS，cleanup PASS | focused/red |
| runtime `check-behavior.mjs` | 5 个 mutation vector 均 PASS，cleanup PASS | focused/red |
| display-context `check-behavior.mjs` | secondary-surface mutation、cleanup 均 PASS | focused/red |
| skeleton/layering/runtime/display-context static | 各自 `PASS` | static |

上述命令输出在本回合由工具直接返回；render red runner 的完整输出另保留于
`/tmp/ter-sample2-cp7-render-red-rerun.log`。这些结果只关闭了对应包和通用工具的
focused/static/red 边界，不关闭 sample2-specific 全部 F、全部 ordered-pair、Web、release
或完整 visual 验收。

## 设备与安装边界

| serial | 载体 | 实际边界 |
| --- | --- | --- |
| `emulator-5554` | Pixel Tablet / laptop | host `PRIMARY 1280×800`、`SECONDARY 960×540`，`surfaceForm=laptop`；双屏生产 surface 可见 |
| `emulator-5556` | phone / mobile | VM physical `720×1280`，integration logical `PRIMARY 360×640`，portrait，未创建 `SECONDARY`，`surfaceForm=mobile` |

安装包为 `com.catering.v2s.terminal.samplewallpaper`，通过精确 serial 安装和启动。启动时
`dumpsys input_method` 观察到 `mInputShown=false`；登录和 admin 输入使用应用自己的虚拟键盘，
本轮观察没有系统软键盘弹出。

## 实际 Android 业务证据

### 登录与 picker

- 两台 VM 都从清空后的匿名状态进入登录页，并通过真实控件与应用虚拟键盘输入 `A001`/`1111`；
  登录后主屏显示 picker，四个可寻址选项为 `none`/`w1`/`w2`/`w3`，三张缩略图有 source，
  confirm 初始禁用。
- 证据：
  `/tmp/ter-sample2-cp7-emulator-5554-anonymous.png/.xml`、
  `/tmp/ter-sample2-cp7-emulator-5554-picker-after-login.png/.xml`、
  `/tmp/ter-sample2-cp7-emulator-5556-anonymous.png/.xml`、
  `/tmp/ter-sample2-cp7-emulator-5556-picker-after-login.png/.xml`。

### pending 与 confirmed

- 选择 `w1`、`w2`、`w3` 时，XML 中对应 radio 的 selected 变化、confirm 变为 enabled，背景
  仍显示先前 confirmed 图；对应截图分别记录了 pending 状态。
- 点击确认后，对应 `sample.wallpaper.background` 出现且 confirm disabled；主屏截图中可见
  sunrise/lake/beach 三种不同背景。`WallpaperPicker` 仍由 `pending ?? confirmed` 驱动选中态，
  `WallpaperBackground` 只读取 confirmed；这与源码 `WallpaperPicker.tsx:40-106`、
  `WallpaperBackground.tsx` 以及 kernel actor `actors.ts:19-34` 对账一致。
- w1：`...5554-w1-pending.png/.xml`、`...5554-w1-confirmed.png/.xml`、
  `...5556-w1-pending.png/.xml`、`...5556-w1-confirmed.png/.xml`。
- w2：`...5554-w2-pending-after-restart.png/.xml`、`...5554-w2-confirmed-clean.png/.xml`、
  `...5556-w2-pending-after-restart.png/.xml`、`...5556-w2-confirmed-clean.png/.xml`。
- w3：`...5554-w3-pending.png/.xml`、`...5554-w3-confirmed.png/.xml`、
  `...5556-w3-pending.png/.xml`、`...5556-w3-confirmed.png/.xml`。
- none：第一次确认点按未命中；重试成功并记录在
  `...5554-none-confirmed-retry.png/.xml`、`...5556-none-confirmed-retry.png/.xml`，此时
  `sample.wallpaper.background` 不再出现在 XML，none selected、confirm disabled，截图中
  不再有 wallpaper。对应首次失败材料为 `...none-pending.png/.xml` 与 `...none-confirmed.png/.xml`。

### laptop 双屏

- laptop 的 secondary surface 使用当前 SurfaceFlinger 虚拟显示标识
  `11529215047789101945` 截图；使用普通 logical display `2` 的 `screencap -d 2` 返回
  status `-2`，该失败已保留，改用 `dumpsys display` 解析出的实际 SF id 后成功。
- secondary w1 与 w2 确认截图均可见对应 wallpaper 与 waiting/welcome 文案：
  `/tmp/ter-sample2-cp7-emulator-5554-secondary-w1-confirmed-v2.png`、
  `/tmp/ter-sample2-cp7-emulator-5554-secondary-w2-confirmed-clean.png`。
- 这证明双屏实际可见性、同一确认选择的传播及副屏业务内容同时存在；尚未把两块截图送入
  `terminal-image-compare` 做需求 §5 的定量 ROI 四指标，所以不宣称 A3 的完整像素判定 PASS。

### 重启与浮层

- w1 confirmed 后 force-stop/start：两台 VM 的 picker、confirmed background 与 disabled
  confirm 恢复；证据 `...5554-restart.png/.xml`、`...5556-restart.png/.xml`。
- confirmed w2 后选择 w3 但不确认，force-stop/start：两台 VM 同时保持 confirmed background
  为 w2、radio/pending 为 w3、confirm enabled、picker 内容恢复；证据
  `...5554-pending-restart.png/.xml`、`...5556-pending-restart.png/.xml`。
- 通过 admin hidden gesture 真实打开 admin login，随后 force-stop/start；重启后 XML 仍含
  `terminal.admin:login`、`terminal.admin:verify`、`terminal.admin:close`，截图显示红色
  admin login 与虚拟键盘。关闭后 admin login 节点归零，picker 的 w3 confirmed 状态保持。
  证据：`...5554-admin-reopen.png/.xml`、`...5554-admin-restart.png/.xml`、
  `...5554-admin-closed.png/.xml` 及对应 `5556` 文件。

### 既有 sample-terminal 回归（A8）

在停止 sample2 Metro 后，使用 sample-terminal 自己的 Metro 入口重新启动同一
`com.anonymous.sampleterminal` APK；之前误连 sample2 Metro 的首败单独保留在
`/tmp/ter-sample2-cp7-sample-terminal-restarted.xml`，根因是运行时入口串包，不是
sample-terminal 源码。随后用真实 Android 控件完成了完整既有旅途：匿名登录页 → `A001`/`1111`
登录 → 空会员列表 → 新增会员 → 填入 `ALICE`/`010-1234-5678` → 提交等待顾客确认 →
在 logical display `2` 的副屏按确认 → 主屏会员列表显示已登记会员 → 登出回登录页 →
force-stop/start 冷启动再次回登录页。

证据文件：

- 登录与列表：`/tmp/ter-sample2-cp7-sample-terminal-regression-login2.xml`、
  `/tmp/ter-sample2-cp7-sample-terminal-list-after-login.png`；
- 表单与真实字段：`/tmp/ter-sample2-cp7-sample-terminal-member-form.xml`、
  `/tmp/ter-sample2-cp7-sample-terminal-member-values.xml`；
- 提交/等待/副屏确认：`/tmp/ter-sample2-cp7-sample-terminal-member-submitted.xml`、
  `/tmp/ter-sample2-cp7-sample-terminal-secondary-submitted.png`、
  `/tmp/ter-sample2-cp7-sample-terminal-secondary-confirmed.png`；
- 主屏确认后、登出、冷启动：`/tmp/ter-sample2-cp7-sample-terminal-main-after-confirm.png`、
  `/tmp/ter-sample2-cp7-sample-terminal-after-logout.xml`、
  `/tmp/ter-sample2-cp7-sample-terminal-after-cold-restart.xml`；
- 过滤后的结构化日志：`/tmp/ter-sample2-cp7-sample-terminal-regression-final.log`。

旅途中出现的 `power-bridge.subscription-unavailable` 是现有可选电源订阅端口的 warning，
曾遮挡应用虚拟键盘；通过 XML 中唯一 warning 关闭节点精确关闭后继续完成旅途。它不是
本批 sample2 或 persistKV 的失败，warning 本身仍未修复，不能把“关闭后继续”记作 warning
PASS。

### Android ROI 实测补充

使用 CP-1 已通过 self-test 的 `tools/terminal-image-compare/compare.mjs`，对同一设备、同一
画布和同一 picker 几何的截图执行了真实 PNG 比较。metadata 为
`doc/evidence/platform/2026-09-13-v2s-terminal-sample2-cp7-laptop-picker-roi.json`，
网格固定在 `2560×1600` canvas，遮罩只覆盖三个 option card 与确认按钮；原始输出为：

| 比较 | changedFraction | P95 | meanAbsDiff | changedCellFraction | 结果 |
| --- | ---: | ---: | ---: | ---: | --- |
| w1 pending → w1 confirmed | 0.8987617731 | 217 | 68.5751746 | 1 | confirmed 变化阈值通过 |
| w2 confirmed → w3 pending | 0 | 0 | 0 | 0 | pending 不改变 confirmed 背景通过 |
| w2 confirmed → w3 confirmed | 0.4870088545 | 186 | 36.0072418 | 1 | 换图变化阈值通过 |

输出分别保留在 `/tmp/ter-sample2-cp7-laptop-w1-pending-to-confirmed-metrics.json`、
`/tmp/ter-sample2-cp7-laptop-w2-confirmed-to-w3-pending-metrics-v2.json` 和
`/tmp/ter-sample2-cp7-laptop-w2-to-w3-confirmed-metrics.json`。副屏使用
`doc/evidence/platform/2026-09-13-v2s-terminal-sample2-cp7-secondary-roi.json`，w1→w2
输出为 `changedFraction=0.9991736562`、`P95=210`、`meanAbsDiff=65.8757403`、
`changedCellFraction=1`，输出在 `/tmp/ter-sample2-cp7-secondary-w1-to-w2-metrics.json`。
同一 metadata 下补齐了反向与其余有序对：w2→w1 为
`changedFraction=0.9991736562`、`P95=210`、`meanAbsDiff=65.8757403`、
`changedCellFraction=1`，输出在 `/tmp/ter-sample2-cp7-secondary-w2-to-w1-metrics.json`；
w1→w3 与 w3→w1 均为 `changedFraction=0.9991759109`、`P95=192`、
`meanAbsDiff=80.5116349507`、`changedCellFraction=1`，输出分别在
`/tmp/ter-sample2-cp7-secondary-w1-to-w3-current-metrics.json` 与
`/tmp/ter-sample2-cp7-secondary-w3-to-w1-current-metrics.json`；w2→w3 与 w3→w2 均为
`changedFraction=0.9861866432`、`P95=186`、`meanAbsDiff=78.9466345`、
`changedCellFraction=1`，输出分别在 `/tmp/ter-sample2-cp7-secondary-w2-to-w3-current-metrics.json`
与 `/tmp/ter-sample2-cp7-secondary-w3-to-w2-metrics.json`。
这关闭了本轮已执行截图对的定量变化/不变化证明，但尚未替代全部有序对、全部 F 变异或
完整视觉验收。

### 2026-09-14 07:54-07:58 +09:00 当前字节 fresh w1/w2 双屏对

上一段历史截图对中，曾有一份 `w2` 文件被误标为 confirmed；其 XML 实际仍显示
`确认壁纸 enabled=true`，因此不把它用于本次结果。随后在同一 TER-owned sample2 运行中，
保持 picker 滚动位置和几何不变，用真实 Android 触摸先确认 `w1`，再选择并确认 `w2`，重新
采集主屏与实际 SurfaceFlinger 副屏截图。两组 XML 分别确认 `山景/湖景 selected=true` 且
`确认壁纸 enabled=false`。

完整动作、状态 XML、截图、日志与四个 metrics 输出见：
`doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-current-a3-pair-codex.md`。

本次 fresh 同几何比较结果：

| 比较 | changedFraction | P95 | meanAbsDiff | changedCellFraction |
| --- | ---: | ---: | ---: | ---: |
| 主屏 w1 → w2 | 0.48651425013835087 | 143 | 25.3042473713337 | 1 |
| 主屏 w2 → w1 | 0.48651425013835087 | 143 | 25.3042473713337 | 1 |
| 副屏 w1 → w2 | 0.9991736562049062 | 210 | 65.87574028980279 | 1 |
| 副屏 w2 → w1 | 0.9991736562049062 | 210 | 65.87574028980279 | 1 |

四个结果均超过现有变化阈值。这补强了当前字节的双屏 w1/w2 A2/A3 变化证据，但不把它
扩写为完整 A1-A9/F、Web、release 或视觉验收 GO。

### CP-7 当前回合 Android 补充证据

共享输入 responder 修复后，重新在两台指定 VM 上用真实触摸注入验证了长 picker 的滚动与
确认动作。laptop `emulator-5554` 的 picker 从 bounds
`[48,1164][2512,1552]` 滚到 `[48,1036][2512,1432]`，随后确认控件从 clipped 状态进入
可操作区域；mobile `emulator-5556` 同样先滚动再完成确认。对应的当前字节证据包括：

- laptop `w3`：`/tmp/ter-sample2-cp7-laptop-w3-selected-final.xml`、
  `/tmp/ter-sample2-cp7-laptop-w3-confirmed-final.xml`、
  `/tmp/ter-sample2-cp7-laptop-w3-confirmed-final-5554.png`；
- mobile `w1`：`/tmp/ter-sample2-cp7-mobile-w1-confirmed-final.xml`、
  `/tmp/ter-sample2-cp7-mobile-w1-confirmed-final-5556.png`；
- laptop 副屏当前 `w3` 截图：`/tmp/ter-sample2-cp7-secondary-w3-confirmed-current-5554.png`；
  与此前 `w2` 的 ROI 比较输出：
  `/tmp/ter-sample2-cp7-secondary-w2-to-w3-current-metrics.json`，
  `changedFraction=0.9861866432`、`P95=186`、`meanAbsDiff=78.9466345`、
  `changedCellFraction=1`。

这组补充证明了当前共享滚动边界在两台 VM 上可达，以及当前执行的一个副屏换图 ROI 对确有
变化；它不替代所有壁纸有序对、每个 Android F 反向变异或完整 visual acceptance。期间普通
`adb shell input swipe` 在部分尝试中未产生位移，随后用同一精确 serial 的
`adb shell input touchscreen swipe` 完成了真实触摸注入；这属于 ADB 注入方式的边界观察，
不是将产品滚动实现改成另一套机制。

### A4 独立冷启动补充（本回合）

在共享输入 responder 修复、Metro 已完成 Android bundle 后，重新使用 TER 自有 Metro 和
`emulator-5554` 完成了一次从匿名登录到认证、w1 选择/确认，再 force-stop/start 的独立
旅途。认证后的主屏真实 UI XML 同时包含四个 picker 选项、三张 thumbnail、`sample.wallpaper.picker`
与禁用的确认按钮；副屏截图显示已确认的 w1 壁纸与 `欢迎，请等待店员操作`。冷启动后：

- 主屏 XML `/tmp/ter-sample2-cp7-a4-laptop-auth-cold-primary.xml` 仍显示
  `sample.wallpaper.picker:options:w1` 为 selected，`none/w2/w3` 未 selected，确认按钮
  为 disabled；没有回到 `sample.auth.login`。
- 冷启动主屏截图为 `/tmp/ter-sample2-cp7-a4-laptop-auth-cold-primary.png`，副屏截图为
  `/tmp/ter-sample2-cp7-a4-laptop-auth-cold-secondary.png`；两者均成功导出，副屏为真实
  SurfaceFlinger display id `11529215047789101945`。
- 冷启动日志为 `/tmp/ter-sample2-cp7-a4-laptop-auth-cold.log`，包含
  `surface-form-decision surfaceForm=laptop smallestScreenWidthDp=800`、secondary placement
  `secondaryAvailable=true`、PRIMARY/SECONDARY `surface-created` 及 MMKV plain/protected
  namespace load 记录。

这次补充关闭了“认证态冷启动回到匿名登录”的 laptop A4 子场景，但不宣称 A4 的完整
匿名→认证→副屏文案→登出→冷启动矩阵已闭合；sample2 本身没有可见的 staff logout 控件，
既有 sample-terminal 的真实 logout 回归仍以 A8 证据为准。

### 生成 Android 工程与资产身份对账

在当前字节上执行了只读的生成工程 reconciliation，输出保留于
`/tmp/ter-sample2-cp7-generated-reconciliation-final.log`。检查覆盖 `app.json` 的 slug 与
applicationId、Gradle namespace/applicationId、Manifest 的相对入口、Kotlin package、
`settings.gradle`/`strings.xml` app identity、5 张 app 资产的 SHA-256，以及剔除 build/cache/
runtime 证据目录后与既有 `sample-terminal` Expo 生成工程的文件集合（将 Kotlin package path
做预期替换）对账。实际结果为：

```text
SAMPLE2_GENERATED_IDENTITY=PASS
SAMPLE2_GENERATED_ASSETS=PASS
SAMPLE2_GENERATED_ANDROID_SET=PASS
```

sample2 与参考 Expo 工程各为 56 个生成源文件，集合差异为空；该对账只证明生成物/身份与
当前设计的静态一致性，不提升 release 或完整 Android A/F 红变异证据。

## 分档证据矩阵

| 档位 | 当前状态 | 边界 |
| --- | --- | --- |
| static | PASS | 源码、包依赖、graph、分层、入口与两个 integration 的 admin 接入已复核 |
| focused | PASS（已执行的包/CP 测试） | 真实 picker/kernel/ui-state 测试与 red mutation 仍以各 CP evidence 为准，不扩写成 Android 或视觉 PASS |
| native | PASS（CP-6） | dual-screen Kotlin 分支、Bundle helper、configuration freeze 与 red mutation 已有 CP-6 证据 |
| Android | PARTIAL | sample2 两台 VM 的登录、四选项、pending/confirmed、重启、admin 浮层、双屏背景/mobile 单屏已实测；A8 既有 sample-terminal 旅途已完成，所有 A/F 动态红夹具尚未全部执行 |
| Web | NOT_RUN | 本轮遵守“不使用 computer use”；已有 Metro export/CP-0 只证明资源图，不证明 Web 事件层或 Web 视觉行为 |
| release | NOT_RUN | 未获得 release 执行边界，本轮不执行 |
| visual/quantified ROI | PARTIAL | 已对主屏六个与副屏六个 directed ordered-pair 执行 image-compare；仍未完成全部真实红变异与完整视觉验收 |
| cleanup | PASS | `doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-f-a5d-cleanup-codex.md`、`doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-a4-cleanup-codex.md` 与 `doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-f-a5-runtime-cleanup-codex.md`；两台 serial 上 sample2 包均 ABSENT，本回合 Metro process tree 已停止 |

## A1-A9 当前执行情况

| 判据 | 实际情况 | 证据档位 |
| --- | --- | --- |
| A1 | 两台 VM 登录后四个真实 option、三张 source、selected/testID 可见 | focused + Android |
| A2 | pending 不换背景、确认后背景可见；已对 laptop 主屏执行定量 ROI 变化/不变化比较 | Android partial |
| A2d | w1/w2/w3 都真实选择/确认，独立期望资源两两不同；主屏与副屏 w1/w2、w1/w3、w2/w3 的六个有序 pair 均已执行独立 ROI 比较 | focused + Android |
| A2b | pending 不同 confirmed 时 confirm enabled，确认后 disabled | Android |
| A2c | kernel typed no-pending 由 focused CP evidence 覆盖；本轮未在设备上直接派发非法命令 | focused |
| A3 | laptop secondary 的 w1/w2 wallpaper 与业务文案真实可见，未完成 ROI 四指标/全部换图对 | Android partial |
| A4 | laptop 已补认证后 w1 picker/副屏 welcome 及认证态冷启动恢复；sample2 无可见 logout 控件，完整匿名/认证/登出矩阵仍未闭合 | Android partial |
| A5 | confirmed wallpaper 重启恢复 | Android |
| A5b | 未确认 w3 与 w2 background/picker 重启恢复 | Android |
| A5d | confirm 后 pending 清除；真实 Android 变异保留 pending 后重启，私有 MMKV 同时出现 confirmed/pending w1，故变异命红 | focused + Android mutation |
| A5c | admin layer 重启恢复并可关闭 | Android |
| A6 | two VM surfaceForm：laptop/mobile | native + Android |
| A7/A7b | static/focused theme and red UI observed；未执行设备端对比度数值/红夹具 | static + focused + Android supporting |
| A8 | 既有 sample-terminal 已完成登录、会员新建、主副屏确认、回列表、登出与冷启动；warning 影响已单独登记 | Android |
| A9 | 当前 mobile XML/启动日志显示 single PRIMARY，无 SECONDARY；补充的强制 SECONDARY runtime 变异已在 mobile VM 的真实日志中命红；原始 guard-only 变异仍不作为等价证据 | native + Android partial |

## F 红夹具当前执行情况

CP-0 至 CP-6 的静态/focused/native red mutation 结果保留在各自 evidence 文件；本 CP 已执行
skeleton/layering 的 graph、directory census 与依赖边 mutation。`tools/terminal-sample2/check-behavior.mjs`
又对 kernel/picker/integration baseline 与 11 个 sample2 focused 反向变异逐项执行，所有 mutation
均按预期退出非零，恢复后 baseline 与 cleanup 也 PASS。这只关闭 focused/source-level red
边界；F-A2b（非 none source 缺失的完整 Android oracle）、原 F-A5 的非法 descriptor
变异与 F-A9 的真实 Android 或完整 ROI 反向变异仍未逐项运行，不能以 focused mutation 或
baseline Android 运行代替，当前保持 OPEN；F-A2a、F-A3a、F-A3b 已在本回合补做真实 Android
ROI 变异并命红，F-A5_RUNTIME 也已补做可启动的真实 Android storage-loss 变异并命红。

`terminal-image-compare` known-PNG self-test 与 threshold mutation 已实际通过，原始输出为
`/tmp/ter-sample2-cp7-image-compare.log`；这只是工具自身证据，不等于上述 sample2 全部
真实红夹具已执行。

本回合又在真实 Android VM 上执行了多项 sample2 反向变异，并在恢复后重启回到当前实现：

- F-A2a：将 picker、waiting、welcome 的容器临时改为不透明 `fill`；mobile `emulator-5556`
  的同状态截图比较为 `changedFraction=0.8715222838`、`P95=214`、
  `meanAbsDiff=78.6256840`、`changedCellFraction=1`，故真实 wallpaper ROI 变异命红。
  截图为 `/tmp/ter-sample2-cp7-mobile-f-a2a-before-5556.png`、
  `/tmp/ter-sample2-cp7-mobile-f-a2a-after-5556.png`，metadata 为
  `doc/evidence/platform/2026-09-13-v2s-terminal-sample2-cp7-mobile-roi.json`。
- F-A3a：临时移除 assembly 中的 `WallpaperBackground`；laptop secondary 的比较为
  `changedFraction=1`、`P95=157`、`meanAbsDiff=65.9982958`、`changedCellFraction=1`，
  真实副屏 ROI 命红，输出为 `/tmp/ter-sample2-cp7-secondary-f-a3a-before-5554.png` 与
  `/tmp/ter-sample2-cp7-secondary-f-a3a-after-5554.png`。
- F-A3b：临时将 background source 硬编码为 `assetsById.w2`；同一 laptop secondary 比较为
  `changedFraction=0.9862509019`、`P95=183`、`meanAbsDiff=73.7372020`、
  `changedCellFraction=1`，真实错误 source 命红，输出为
  `/tmp/ter-sample2-cp7-secondary-f-a3b-after-5554.png`。
- F-A9：第一次只移除 mobile 的 SECONDARY 声明与尺寸保护；真实 mobile 入口仍只向 assembly
  请求 `displayIndex=0`，最终 XML 仍只有一个 PRIMARY picker/launcher，因此该 guard-only 变异
  没有形成有效的设备红夹具，不能把它当作 PASS。focused F-A9 仍按预期命红。
- F-A9_RUNTIME：为使同一 A9 禁止条件在真实 mobile 入口可观察，受控地将 App 的
  `createSurfaceForDisplayIndex` 调用固定为 `displayIndex=1`，让 mobile 临时复用 laptop 的
  dual-surface declarations，并移除 assembly 的 SECONDARY/declared-size 两个保护。真实
  `emulator-5556` 的 Metro 运行输出随后出现 `sample-wallpaper-console.surface-created`，其
  `displayIndex=1`、`displayMode=SECONDARY`、`surfaceForm=mobile`，紧接着出现
  `render.surface-root-mounted` 且 `displayMode=SECONDARY`。Android XML 同时出现
  `ui-base-render:surface-root` 与 `ui-base-render:surface-host-pending`/“正在准备显示面”；
  该加载态是单屏设备没有 SECONDARY host 的结果，不影响 A9 所禁止的 SECONDARY surface
  已被真实创建这一反例。截图/XML 为
  `/tmp/ter-sample2-cp7-f-a9-runtime-5556.png`、
  `/tmp/ter-sample2-cp7-f-a9-runtime-5556.xml`，Metro transcript 与 mutation/restore 记录见
  `doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-f-a9-runtime-output-codex.md`。
  变异源码、Metro 与 app 已停止并恢复，cleanup PASS。
- F-A2b：临时令 `assetsById.w2` 为 `undefined` 后重启 mobile；真实 UI XML 仍有
  `sample.wallpaper.picker:options:w2`，但没有 `sample.wallpaper.picker:options:w2:thumbnail`，
  与当前正常 bundle 的 w2 thumbnail 节点形成可复核差异；截图/XML 为
  `/tmp/ter-sample2-cp7-mobile-f-a2b-before-5556.png`、`/tmp/ter-sample2-cp7-mobile-f-a2b-after-5556.png`、
  `/sdcard/sample2-f-a2b-before.xml`、`/sdcard/sample2-f-a2b-after.xml`，随后已恢复资产并重启。
- F-A5b：临时删除 `pendingWallpaperId` persistence descriptor，在真实 mobile 上选择 w2 但不确认，
  XML 显示 w2 selected；force-stop/start 后 selected 回到已确认的 w1，证明该变异会丢失未确认
  选择；源码随后恢复。F-A5 的 `persistIntent: 'never'` 变异被 `defineStateRuntimeSlice`
  的运行时不变量直接拒绝并记录 `[runtime not ready]`，没有形成确认持久化行为证据，故 F-A5
  仍保持 OPEN。
- F-A5d：临时把 `confirmPending` 的返回值改为同时保留 `pendingWallpaperId`，在真实 mobile
  `emulator-5556` 上完成 TER 自有虚拟键盘登录、选择 w1、真实确认、force-stop/start，并读取
  应用私有 MMKV 文件。重启后的 XML 仍显示 `sample.wallpaper.background` 与 w1 选中状态；
  `/tmp/ter-sample2-cp7-f-a5d-after-restart.mmkv` 同时含有
  `kernel.feature.sample-wallpaper.selection/field/wallpaperId="w1"` 与
  `.../field/pendingWallpaperId="w1"`。这直接违反“确认后 pending 必须清除”的持久化状态
  不变量，故 F-A5d 的真实 Android storage mutation 已命红。变异源码随后恢复为只返回
  `wallpaperId`，并在恢复后停止 app；该结果是状态/持久化证据，不外推为完整视觉验收。
- F-A5_RUNTIME：为避免 `persistIntent: 'never'` 在运行时 descriptor 不变量处提前拒绝，临时
  令 confirmed 字段 `wallpaperId` 的 `shouldPersist` 返回 `false`。在 `emulator-5556` 清空
  数据后，真实登录、选择 w1、真实确认并冷启动；变异确认态截图为
  `/tmp/ter-sample2-cp7-f-a5-runtime-confirmed-5556.png`，冷启动后截图/XML 为
  `/tmp/ter-sample2-cp7-f-a5-runtime-after-restart-5556.png`、
  `/tmp/ter-sample2-cp7-f-a5-runtime-after-restart-5556.xml`，运行日志为
  `/tmp/ter-sample2-cp7-f-a5-runtime.log`。冷启动后认证态与 picker 恢复，但 `none` 为
  selected、w1 未 selected，且 `sample.wallpaper.background` 不存在，证明 confirmed wallpaper
  丢失，故 F-A5_RUNTIME 的真实 Android storage-loss 红夹具实际命红。原 F-A5 的非法
  `persistIntent='never'` 变异仍仅证明 runtime 结构拒绝，不把两者混同；变异源码、Metro
  与 app 已恢复，cleanup PASS。

上述动态变异只证明当前取样状态下相应 ROI/状态变异可被判据捕获；原 F-A5 非法 descriptor
变异仍仅被运行时不变量拒绝，原始 guard-only F-A9 变异没有到达 SECONDARY，但补充的
F-A9_RUNTIME 已在真实 mobile 日志中命红。全量 A/F 矩阵仍保持 OPEN，未将一次设备变异
外推成全部动态覆盖。

## 本回合恢复后的最终复跑

2026-09-14 03:26 +09:00，在 source mutation 已恢复、sample2 Android app 与自有 Metro 已
cleanup 后，重新执行了行为 runner、骨架静态门、分层静态门和 Claude handoff checker：

```text
node tools/terminal-sample2/check-behavior.mjs
  SAMPLE2_KERNEL_BASELINE=PASS
  SAMPLE2_PICKER_BASELINE=PASS
  SAMPLE2_INTEGRATION_BASELINE=PASS
  SAMPLE2_F_A5_RED=PASS mutation_exit=1
  SAMPLE2_F_A5B_RED=PASS mutation_exit=1
  SAMPLE2_F_A5D_RED=PASS mutation_exit=1
  SAMPLE2_F_A2_RED=PASS mutation_exit=1
  SAMPLE2_F_A2C_RED=PASS mutation_exit=1
  SAMPLE2_F_A2A_RED=PASS mutation_exit=1
  SAMPLE2_F_A3A_RED=PASS mutation_exit=1
  SAMPLE2_F_A3B_RED=PASS mutation_exit=1
  SAMPLE2_F_A7_RED=PASS mutation_exit=1
  SAMPLE2_F_A9_RED=PASS mutation_exit=1
  SAMPLE2_RED_MUTATION_CLEANUP=PASS

node tools/terminal-skeleton/check-static.mjs
  RULE_GRAPH_COMPARISON=PASS
  RULE_TRIPLE_NAMING=PASS
  RULE_DEPENDENCY_DIRECTION=PASS
  RULE_DEPENDENCY_DECLARATION_COMPLETENESS=PASS
  RULE_TR01_REDUCER_BOUNDARY=PASS
  RULE_KERNEL_PLATFORM_INDEPENDENCE=PASS
  SCAFFOLD_HYGIENE=PASS

node tools/terminal-layering/check-static.mjs
  RULE_P_5A_DIRECTION=PASS
  RULE_P_5C_STATE_EDGE=PASS
  RULE_P_10_KERNEL_UI_LITERALS=PASS
  RULE_P_5D_UI_FEATURE_NATIVE_ELEMENTS=PASS
  TERMINAL_LAYERING=PASS

scripts/check/claude-review-handoff --file doc/review/platform/2026-09-14-v2s-terminal-sample2-wallpaper-implementation-review-request-codex.md
  CLAUDE_REVIEW_HANDOFF=PASS
```

这些 PASS 只证明恢复后的 focused/static/red 工具边界与交接格式通过；不关闭 Web、release、
完整 visual、完整 A/F 动态矩阵或当前表中明确保留的 Android OPEN。

### 2026-09-14 06:09 +09:00 fresh 回归复跑

在没有任何 source mutation 残留、两个 Android serial 与自有 Metro 均处于 cleanup 状态时，重新
执行了新建包真实测试、skeleton/layering 静态门和 image-compare self-test：

```text
@catering-v2s/kernel-feature-sample-wallpaper       2 files / 9 tests   PASS
@catering-v2s/ui-feature-sample-wallpaper-picker    2 files / 8 tests   PASS
@catering-v2s/ui-integration-sample-wallpaper-console 4 files / 11 tests PASS
tools/terminal-image-compare/compare.test.mjs       1 test              PASS
IMAGE_COMPARE_RED_THRESHOLD_MUTATION=PASS
IMAGE_COMPARE_SELF_TEST=PASS
IMAGE_COMPARE_CLEANUP=PASS
RULE_GRAPH_COMPARISON=PASS
SCAFFOLD_HYGIENE=PASS
TERMINAL_LAYERING=PASS
```

本次复跑仍只证明上述 focused/static 工具和包级回归边界；不把它升级为 Web、release、完整
visual、完整 A/F 或尚未执行的 Android 反向路径证据。

### 2026-09-14 07:16 +09:00 F-A5_RUNTIME 恢复后 focused 复跑

在真实 Android storage-loss 变异完成并恢复 `slice.ts` 后，重新执行行为 runner；这次输出包含
新增的可启动 F-A5_RUNTIME 变异：

```text
SAMPLE2_KERNEL_BASELINE=PASS
SAMPLE2_PICKER_BASELINE=PASS
SAMPLE2_INTEGRATION_BASELINE=PASS
SAMPLE2_F_A5_RED=PASS mutation_exit=1
SAMPLE2_F_A5_RUNTIME_RED=PASS mutation_exit=1
SAMPLE2_F_A5B_RED=PASS mutation_exit=1
SAMPLE2_F_A5D_RED=PASS mutation_exit=1
SAMPLE2_F_A2_RED=PASS mutation_exit=1
SAMPLE2_F_A2C_RED=PASS mutation_exit=1
SAMPLE2_F_A2A_RED=PASS mutation_exit=1
SAMPLE2_F_A3A_RED=PASS mutation_exit=1
SAMPLE2_F_A3B_RED=PASS mutation_exit=1
SAMPLE2_F_A7_RED=PASS mutation_exit=1
SAMPLE2_F_A9_RED=PASS mutation_exit=1
SAMPLE2_KERNEL_BASELINE=PASS
SAMPLE2_PICKER_BASELINE=PASS
SAMPLE2_INTEGRATION_BASELINE=PASS
SAMPLE2_RED_MUTATION_CLEANUP=PASS
```

该 focused 复跑与真实 Android F-A5_RUNTIME 红夹具相互独立：前者证明当前测试层仍能捕获变异，
后者证明该可启动变异在真实 mobile 冷启动后确实丢失 confirmed wallpaper；两者都不关闭原
`persistIntent='never'` 非法 descriptor 变异、F-A9 或完整 A/F 动态矩阵。

### 2026-09-14 08:03 +09:00 最终源码恢复后 focused/red 复跑

在当前 Android fresh pair 证据写入、运行资源 cleanup 完成、文档更新后，重新执行
`node tools/terminal-sample2/check-behavior.mjs`。结果为：三个 sample2 package baseline
均 PASS；F-A5、F-A5_RUNTIME、F-A5B、F-A5D、F-A2、F-A2C、F-A2A、F-A3A、F-A3B、F-A7、
F-A9 共 11 个变异均以 `mutation_exit=1` 命红；恢复后的三个 baseline 再次 PASS；
`SAMPLE2_RED_MUTATION_CLEANUP=PASS`。随后源级临时变异残留扫描为空，handoff checker 为
`CLAUDE_REVIEW_HANDOFF=PASS`。

这次 focused 复跑确认当前源码没有被实验变异污染，不改变 Web/release/完整 visual 或完整
A/F 动态矩阵仍 OPEN 的分档结论。

## 当前 OPEN 与下一动作

1. 已完成 sample-terminal 旅途与本轮精确 cleanup；这些结果已写入本文件，但不把 warning 的
   关闭动作记成 warning 修复。
2. sample2-specific 的 focused red 已完成；F-A2a/F-A2b/F-A3a/F-A3b/F-A5b/F-A5d 已补真实
   Android 变异，F-A5_RUNTIME 的可启动 confirmed-field storage-loss 变异也已补真实 Android
   红夹具并命红；原 F-A5 的非法变异仅被运行时不变量拒绝。F-A9 的 guard-only 真实入口尝试
   未到达 SECONDARY，但 F-A9_RUNTIME 已以强制 displayIndex=1 的真实 mobile 运行日志命红；
   完整 ROI 反向变异及完整 A/F 动态矩阵仍 OPEN，不能用 baseline 运行代替；A2d 的主屏六个有序 pair 与
   副屏的三种无序组合（w1↔w2、w1↔w3、w2↔w3）各自两个方向、共六个 directed pair 的变化比较已补入本回合证据。
3. laptop A4 的认证态冷启动已在本回合独立补齐；sample2 无可见 logout 控件，因此 sample2
   自身完整匿名→认证→登出矩阵仍未闭合，既有 sample-terminal 的 logout/冷启动回归另由 A8
   证据覆盖。
4. Web、release 和完整 visual/quantified ROI 仍未关闭；本轮不使用 computer use，不得用 static、
   focused、Android manual screenshots 或欢迎文本替代。

本回合最后恢复确认：`WallpaperPicker.tsx`、`Waiting.tsx`、`Welcome.tsx` 均回到
`layout="transparent"`，`WallpaperBackground.tsx` 回到按 confirmed `wallpaperId` 选择 source，
assembly 的 display/declared-size 两个保护条件均恢复；两台 VM 重启后 XML 均重新出现
`sample.wallpaper.background`、`sample.wallpaper.picker` 与 `terminal.admin:launcher`，说明
变异未残留到当前工作区运行结果。

## CP-7 中间状态的 fresh 独立步骤复核

```text
REVIEW_CYCLE_ID=TER-SAMPLE2-IMPLEMENTATION-20260913
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
REVIEWER=Plato/01a09b75-e116-73f0-96b5-3048f11331ec
REVIEW_SCOPE=CP-7 current source and evidence before the final ROI/cleanup append
```

Plato 在只读且不使用 computer use、ADB、Gradle、测试或写文件的边界内完成了 CP-7 中间状态
的三维对账。其确认：当前两个 `ui/integration` 包均遵守 TR-13；CP-7 的 static/focused
记录与源码大体一致；此前的 picker 组件测试标题与实现语义过宽，已收窄为“组件产生 UI intent、
actor 不产生 kernel change command”；计划中“CP-0 未执行”等旧状态已由主 agent 按实际证据
修正。其保留的 OPEN 为 sample2-specific F 变异、A2/A3 完整 ROI、完整 A/F 矩阵以及当时
尚未完成的既有回归；既有回归与部分 ROI 随后已补入本文件，但没有把该中间复核扩写为整批
实现 review 或验收 PASS。

## 2026-09-14 当前字节动态补充与滚动修复

本节覆盖本文件前文之后的当前字节；若前文保留旧的临时计数或旧的滚动描述，以本节和
`2026-09-14-v2s-terminal-sample2-cp7-dynamic-evidence-codex.md` 为准。

- `InputSurfaceFrameContents` 新增直接触点 responder 边界；`ui-base-input` fresh focused 为
  10 files / 50 tests passed。
- 重新构建 TER debug APK：`yarn android --device Small_Phone --no-bundler` 返回
  `BUILD SUCCESSFUL in 24s`；同一 APK 通过精确 `adb install -r` 安装到 `emulator-5554`，返回
  `Success`。
- mobile 修复前后同一真实 swipe 已产生可复核 bounds 差异：修复前 `none` 在视口内、确认控件
  不在可见树；修复后 `none` 被滚出、w1/w2/w3 与确认按钮进入可见树，且确认按钮可真实点击。
- mobile w1→w2 compare：`changedFraction=0.8715552478902954`、`changedCellFraction=1`、
  `P95=190`；laptop w2→w3 compare：主屏 `0.882721707249585`、副屏 `0.9861866432178932`，
  两者 `changedCellFraction=1`。
- mobile confirmed w2 再次冷启动后仍为 w2 selected、确认按钮 disabled、认证态保留；laptop
  fresh 安装启动后 w3 selected、确认按钮 disabled，主/副屏均有 wallpaper。
- 详细截图、XML、指标、脱敏日志与 SHA-256 见
  `doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-android/`。

本补充仍不关闭 Web、release、native 真机、完整 visual acceptance 或完整 A/F 矩阵；它只把
本次实际跑到的 TER Android/focused 证据写实化。

## 2026-09-14 11:57-12:03 当前字节最终 responder 复验

前一版尝试仍保留 `Pressable`，真实 swipe 在重建 APK 上不移动。回读 React Native
`Pressable` owning source 后确认其 Pressability handler 会覆盖同名
`onStartShouldSetResponder` prop；因此该尝试不能证明 responder 边界已改变。主 agent 在
当前授权范围内做了根因修复：`InputSurfaceFrameContents` 改用普通 `View`，直接承载
`onStartShouldSetResponder`、`onStartShouldSetResponderCapture` 与
`onResponderRelease`，不新增滚动机制、不改变输入控件 owner 或命令路径。

最终当前 source 在 `apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx:138-176`，
focused 对账在 `apps/terminal/ui/base/input/test/provider.test.tsx:478-490`。最终重建命令
`yarn android --device Small_Phone --no-bundler` 返回 `BUILD SUCCESSFUL in 3s`，并安装到
`emulator-5556`；同一 APK 精确安装到 `emulator-5554` 返回 `Success`。

在关闭 Expo warning 后，`emulator-5556` 执行真实
`adb shell input -d 0 swipe 360 1000 360 300 1000`，当前 XML 显示 w1/w2/w3 分别为
`[48,120][672,272]`、`[48,296][672,692]`、`[48,716][672,1112]`，确认按钮为
`[48,1136][176,1232]`；此前未修复 XML 未产生该位移。随后真实选择 w3，force-stop/start
后 w3 仍 selected，确认按钮仍 enabled；真实确认后 w3 selected、确认按钮 disabled，
对应 artifacts 见 `doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-android/` 的
`mobile-w3-*current.xml/.png`。

最终 focused 复跑为：ui-base-input 10 files/50 tests、primitives 1/16、picker 2/9、
sample-wallpaper-console 4/12、sample-console 7/35 均 PASS；
`node tools/terminal-sample2/check-behavior.mjs` 的 baseline、11 个变异与恢复后的
baseline 均按预期返回，`SAMPLE2_RED_MUTATION_CLEANUP=PASS`。本节不把它们扩写为完整
Android A/F 或 implementation acceptance。

## 2026-09-14 11:57-12:03 当前字节最终 responder 复验

前一版尝试仍保留 `Pressable`，真实 swipe 在重建 APK 上不移动。回读 React Native
`Pressable` owning source 后确认其 Pressability handler 会覆盖同名
`onStartShouldSetResponder` prop；因此该尝试不能证明 responder 边界已改变。主 agent 在
当前授权范围内做了根因修复：`InputSurfaceFrameContents` 改用普通 `View`，直接承载
`onStartShouldSetResponder`、`onStartShouldSetResponderCapture` 与
`onResponderRelease`，不新增滚动机制、不改变输入控件 owner 或命令路径。

最终当前 source 在 `apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx:138-176`，
focused 对账在 `apps/terminal/ui/base/input/test/provider.test.tsx:478-490`。最终重建命令
`yarn android --device Small_Phone --no-bundler` 返回 `BUILD SUCCESSFUL in 3s`，并安装到
`emulator-5556`；同一 APK 精确安装到 `emulator-5554` 返回 `Success`。

在关闭 Expo warning 后，`emulator-5556` 执行真实
`adb shell input -d 0 swipe 360 1000 360 300 1000`，当前 XML 显示 w1/w2/w3 分别为
`[48,120][672,272]`、`[48,296][672,692]`、`[48,716][672,1112]`，确认按钮为
`[48,1136][176,1232]`；此前未修复 XML 未产生该位移。随后真实选择 w3，force-stop/start
后 w3 仍 selected，确认按钮仍 enabled；真实确认后 w3 selected、确认按钮 disabled，
对应 artifacts 见 `doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-android/` 的
`mobile-w3-*current.xml/.png`。

最终 focused 复跑为：ui-base-input 10 files/50 tests、primitives 1/16、picker 2/9、
sample-wallpaper-console 4/12、sample-console 7/35 均 PASS；
`node tools/terminal-sample2/check-behavior.mjs` 的 baseline、11 个变异与恢复后的
baseline 均按预期返回，`SAMPLE2_RED_MUTATION_CLEANUP=PASS`。本节不把它们扩写为完整
Android A/F 或 implementation acceptance。
