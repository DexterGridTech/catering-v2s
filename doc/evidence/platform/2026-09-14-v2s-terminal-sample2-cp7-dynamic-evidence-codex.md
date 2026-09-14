# TER sample2 CP-7 动态验收证据（Codex）

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

## 范围与边界

- 目标：`sample-wallpaper-terminal` 当前实施的 focused 与 Android supporting proof。
- 未启动后台 DEV、Web、seed、UAT 或部署；本轮没有使用 Computer Use。
- 设备：`emulator-5554`（laptop 双屏）、`emulator-5556`（mobile 单屏）。
- APK：`apps/terminal/assembly/android/sample-wallpaper-terminal/android/app/build/outputs/apk/debug/app-debug.apk`。
- 包名：`com.catering.v2s.terminal.samplewallpaper`。
- 本文件只报告实际执行的 focused/Android/cleanup 证据；不把它外推为 Web、release、native 真机或完整 visual acceptance。

## 首败、根因与当前修复

首败是 mobile 的真实 `adb input swipe` 不改变 wallpaper picker 的可见 bounds。源码与 RN
`Pressable` owning source 对账后确认，共享输入表面的 `Pressable` responder wiring 会覆盖同名
外部 prop，导致嵌套 `PrimitiveScrollView` 无法稳定接管手势。这个修复没有新增滚动实现：
`InputSurfaceFrameContents` 当前使用普通 `View`，由 `onTouchStart/onTouchEnd` 被动记录短点按，
由 `onTouchEndCapture` 做诊断，Web 分支单独使用 `onClick`（见
`apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx:139-213`）。

随后发现一个同根但更窄的事件边界：`VirtualKeyboard` 是 `surface-content` 的后代，数字键
事件若继续冒泡，会被表面的 passive observer 当作外点短按而关闭键盘。当前键盘根节点在
`apps/terminal/ui/base/input/src/components/VirtualKeyboard.tsx:27-35,187-192` 对 native
`onTouchEnd`、Web `onClick` 调用 `stopPropagation`；输入控件自身的边界仍由
`apps/terminal/ui/base/input/src/hooks/useInputField.ts` 保持。这样没有新增输入管线、tracker
或命令路径。

## focused / mutation 输出

2026-09-14 当前源码实际运行结果：

```text
ui-base-input: 10 files / 51 tests PASS
ui-base-primitives: 1 file / 16 tests PASS
ui-integration-sample-wallpaper-console: 4 files / 13 tests PASS
terminal-image-compare: self-test PASS; red-threshold mutation PASS; cleanup PASS
check-behavior.mjs: all baselines PASS; F_A5/F_A5_RUNTIME/F_A5B/F_A5D/F_A2/F_A2C/F_A2A/F_A2_SCROLL/F_A2_TOKEN/F_A3A/F_A3B/F_A7/F_A7B/F_A9 admission PASS; cleanup PASS
```

`check-behavior.mjs` 的实际输出保留了 4 个 baseline、14 个变异/准入结果与恢复 cleanup；
因此不再把它概括成“11 个反向变异”。F-A9 的真实 Android runtime 变异另见下文。

## mobile 输入事件边界（当前 VirtualKeyboard 修复后的 fresh Android run）

```text
RUN_ID=ter-sample2-cp7-input-boundary-20260914-02
DEVICE=emulator-5556
PHYSICAL_DISPLAY=720x1280
LOGICAL_SURFACE=360x640 portrait
PACKAGE=com.catering.v2s.terminal.samplewallpaper
```

真实动作与 XML readback：

1. 五次入口点按后，`mobile-key-boundary-before-current.xml` 同时包含
   `terminal.admin:login` 与 `ui.base.input:virtual-keyboard`，第一位为“未填写”。
2. 点按虚拟键盘数字键 `[208,675]` 后，`mobile-key-boundary-after-key.xml` 仍包含键盘，
   第一位变为“已填写”。这证明键盘按键没有冒泡成 surface dismiss。
3. 点按 admin 标题等非输入区域 `[360,260]` 后，
   `mobile-key-boundary-after-surface-tap.xml` 仍包含 login，键盘节点消失，第一位仍为
   “已填写”。这证明表面短点按仍能收键盘且不清空输入状态。
4. 关闭 admin 后执行真实 `adb shell input -d 0 swipe 360 1000 360 300 1000`。
   `mobile-scroll-before-current.xml` 中 w1/w2 label 的 y 坐标为 646/1066；
   `mobile-scroll-after-current.xml` 中变为 198/618，ScrollView 的 bounds 不变但内容真实移动。

证据文件均已落仓：

- `doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-android/20260914-input-run-02/mobile-key-boundary-before-current.xml`
- `.../mobile-key-boundary-after-key.xml`
- `.../mobile-key-boundary-after-surface-tap.xml`
- `.../mobile-input-boundary-log-current.txt`
- `.../mobile-scroll-before-current.xml` 与 `.../mobile-scroll-after-current.xml`
- 对应 PNG 与同目录 `README.md`、`SHA256SUMS.txt` 中的校验和

日志关键事实：数字键动作只有 `input.surface-touch-start` 与 capture 诊断，没有随后
`input.surface-touch-end`；标题点按产生完整 surface touch start/capture/end，随后 keyboard
消失；没有记录密码原文、token 或其他敏感值。

## laptop 双屏连续确认（A3 supporting proof）

`20260914-current-run-02` 在同一几何、同一运行中完成 `w1 confirmed → w2 confirmed →
w3 confirmed`。它不再声称镜像 directed-pair 是独立证据；A3 的第二次连续确认由
`w2 → w3` 这一真实动作提供。

| transition | display | changedFraction | P95 | meanAbsDiff | changedCellFraction |
| --- | --- | ---: | ---: | ---: | ---: |
| w1 → w2 | primary `2560×1600` | 0.8873175498063088 | 242 | 127.5279849197565 | 1 |
| w1 → w2 | secondary `1280×720` | 1 | 242 | 137.10243468915343 | 1 |
| w2 → w3 | primary `2560×1600` | 0.882721707249585 | 191 | 75.61599739439218 | 1 |
| w2 → w3 | secondary `1280×720` | 0.9861866432178932 | 186 | 78.9466344997595 | 1 |

四份 metric JSON 与六张 confirmed screenshot 在
`doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-android/20260914-current-run-02/`。
后续只改动了 VirtualKeyboard 的事件传播边界；该 patch 不改 wallpaper selector、asset map、
placement、surface 或 image-compare 路径，故上表作为 A3 supporting evidence 保留这一明确
source-delta 说明，不冒充对输入 patch 的同一 run 证明。

## A9 runtime red fixture（当前字节重新执行）

`tools/terminal-sample2/run-a9-runtime.mjs` 在当前源码下重新执行，输出：

```text
SAMPLE2_F_A9_RUNTIME=PASS CLEANUP=PASS
OUTPUT=doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-android/20260914-a9-runtime-run-02
```

该 runner 临时把 mobile assembly 的 `displayIndex` 固定为 1，并让 mobile declaration 走
SECONDARY 形态；真实 Metro 过滤日志读到 `surface-created displayIndex=1 displayMode=SECONDARY`
以及 `render.surface-root-mounted displayMode=SECONDARY`，所以恶意实现确实到达违反 A9 的
运行点。恢复后的正常入口重新只创建 PRIMARY。全部 mutation、APK、Metro、reverse 与精确
包名 cleanup 均在 runner 内完成并记录在 `a9-runtime-result.json`。

## 仍然开放的边界

- Web、release、native 真机与完整 visual acceptance 未执行。
- A1-A9 的完整场景矩阵与每一条红夹具不因本文件的 supporting proof 自动关闭。
- Android 的本次证据关闭的是当前修复涉及的输入/滚动、壁纸切换、双屏可见性和已执行的
  恢复边界；其余未实际执行的场景继续保持 OPEN。
- 旧 `/tmp` 证据文件仍只属于历史记录，不能作为本轮承重证据；当前承重文件均在仓内路径。

## Cleanup

- A9 runner：`business=PASS`、`cleanup=PASS`，恢复源码并验证精确 package absence。
- 输入/滚动 run：动作完成后由后续 A9 runner 对同一精确包名再次 force-stop，并在 runner
  结束时确认 Metro/reverse/package 的受控资源清理；不按端口或模糊命令名停止未知进程。
