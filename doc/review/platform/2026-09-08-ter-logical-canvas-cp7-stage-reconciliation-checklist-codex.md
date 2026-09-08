# TER 固定逻辑画布 CP-7 阶段三维对账清单

STAGE_RECONCILIATION_ID=TER_LOGICAL_CANVAS_STRETCH_CP7_STAGE_20260908
REVIEW_TARGET=CP_STAGE_RECONCILIATION
REVIEW_SCOPE=CP-7
REVIEW_ROUND_LIMIT=NOT_APPLICABLE
reviewerKind=INDEPENDENT_SUBAGENT
REVIEWER_STATUS=FRESH_READ_ONLY_REQUIRED

## 用途与轮次边界

本清单只控制 CP-7 的 focused、Web、Android、DCE、清理证据与实施后逐点回读。它不是
正式 `REVIEW_TARGET=IMPLEMENTATION` 对抗审查，不使用正式 implementation review 的轮次，
也不受两轮上限约束。每次发现本阶段可由主 agent 修复的 OPEN，主 agent 修复并取得
focused proof 后必须重新召集 fresh、只读阶段 reviewer，直到本阶段本地可修复项没有 OPEN。

Web preview policy 与 portrait target hardware profile 是 Dexter 外部决策项；它们只能保持
`OPEN_BY_DEXTER_DECISION`，不能由本阶段 reviewer 自行裁决。当前 emulator 的 virtual
secondary display 不能由 ADB 输出可用像素截图，该设备能力边界单独记录为 `OPEN`，不得以
primary 截图或 UI hierarchy 冒充 secondary screenshot。

## 输入清单

- `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-design-codex.md`
- `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-implementation-plan-codex.md`
- `doc/plans/platform/2026-09-06-v2s-terminal-input-surface-form-requirements-codex.md`
- `doc/plans/platform/2026-09-06-v2s-terminal-input-surface-and-keyboard-implementation-design-codex.md`
- `apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx`
- `apps/terminal/ui/base/render/src/components/ScreenContainer.tsx`
- `apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx`
- `apps/terminal/ui/base/input/src/components/InputScrollArea.tsx`
- `apps/terminal/ui/base/dev-host/src/foundations/surfacePreview.ts`
- `apps/terminal/ui/base/dev-host/src/components/testExpoApp.tsx`
- `apps/terminal/adapter/android/dual-screen/src/implementations/surfaceHost.ts`
- `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt`
- `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalImeInsetsCoordinator.kt`
- `apps/terminal/assembly/android/sample-terminal/App.tsx`
- `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx`
- `apps/terminal/ui/integration/sample-console/test-expo/App.tsx`
- CP-0A 至 CP-6 证据与阶段清单：`doc/review/platform/2026-09-08-ter-logical-canvas-stretch-implementation-evidence-codex.md` 及其列出的输入。

## 对账条目

| ID | 要求 | 证据/观察 | 结论 |
| --- | --- | --- | --- |
| CP7-01 | CP-7 前后按详设与源码逐点回读；不得用阶段结论相加替代整批核验 | CP-7 evidence 的 source/readback 表与本清单 | MATCHED |
| CP7-02 | 最终实现 focused typecheck/test 与 Android adapter broadcast fence 保持通过 | input、adapter focused 原始输出；adapter typecheck | MATCHED |
| CP7-03 | 生产 Web bundle 不包含 dev-only geometry/layout diagnostics | fresh Expo web export 与 bundle `rg` 原始输出 | MATCHED |
| CP7-04 | Web 宽窗口真实 startup/layout/geometry 记录 PRIMARY/SECONDARY declaration、measured、delta、scale 与 identity | Playwright fresh headed session 原始 console/DOM 输出 | MATCHED |
| CP7-05 | Web 窄窗口真实 geometry 与逻辑点命中；不把未裁决的 Web policy 写成完成 | Playwright 800px viewport、`elementFromPoint` 与真实 mouse click 输出 | MATCHED |
| CP7-06 | Android 最终 APK fresh build/install/launch，记录设备、display、window identity 与 host snapshot | Gradle、ADB、native/JS logcat 原始输出 | MATCHED |
| CP7-07 | Android PRIMARY/SECONDARY owner facts、density 与 stable/current 由真实 adapter 输出；无错误跨 surface rejection | 最终进程 logcat；`surface-host-snapshot-ready`；rejection absence check | MATCHED |
| CP7-08 | Android IME show/hide 后 stable bounds、scaleX/scaleY 不因 IME 改变；IME 数值进入逻辑单位 | primary Gboard 前后 native/JS 原始日志 | MATCHED |
| CP7-09 | Android primary 业务形态与 custom financial keyboard 实际呈现；退格/完成在右侧并保持一行高度 | final clean primary screenshot、UIAutomator hierarchy | MATCHED |
| CP7-10 | Android secondary screenshot 必须是可读 PNG 才能作为像素证据；失败不得被伪装 | `screencap -d 2`、`screenrecord --display-id 2` 原始失败输出 | OPEN |
| CP7-11 | Android 主屏截图只作为 primary 业务/视觉证据，不能代替 secondary 像素证据 | `/tmp/ter-cp7-android-after-fix-clean.png`、`...financial-clean.png` | MATCHED |
| CP7-12 | Android A 的 measured/declaration 逐轴 delta 必须满足详设精度；当前 secondary RN layout 的 0.3755 logical px 量化残差不得被四舍五入掩盖 | 最终 JS `input.surface-frame-layout` 与 `startup.surfaces.measured` 原始日志 | OPEN |
| CP7-13 | scaleX 与 scaleY 明显不相等的真实 Android 配置下完成 C 与四角 tap | 已取得 primary `2560×1440 @320` 的真实 `scaleX=1, scaleY=0.9` 与业务交互；四角 safe-point 全集尚未完成 | OPEN |
| CP7-14 | scaleY 非 1 的 Android E 真实输入框滚动证据 | `.9/.625/.3` 非等比真实探测均未让 sample 产生目标输入框的 production scroll before/after offset；480 hierarchy 记录字段完整在 viewport 内 | OPEN |
| CP7-15 | Web preview policy 由 Dexter 决定；未决前不声称 contain 或 browser stretch 已完成 | 详设/README/CP-5 记录一致 | OPEN_BY_DEXTER_DECISION |
| CP7-16 | portrait target hardware profile 与 F 项真实验证 | Dexter 尚未提供 profile；landscape manifest 证据不得转置 | OPEN_BY_DEXTER_DECISION |
| CP7-17 | environment errors 与 TER 画布行为分离；不得把 sample protected-storage 缺失写成画布 PASS/FAIL | logcat/console error 分类 | MATCHED |
| CP7-18 | Android/Web runner 和当前 sample app cleanup 分别完成，cleanup 不冒充业务结果 | Playwright close、`am force-stop`、top activity/pid readback | MATCHED |

## 证据判定边界

- `MATCHED` 只表示该条已有与条款相称的真实证据或静态对账；focused、Web、Android、
  static 档位在 evidence 中分开标注。
- `OPEN` 表示本轮当前真实证据缺失或设备能力/精度边界未满足；不得写成 PASS。
- `OPEN_BY_DEXTER_DECISION` 只表示外部决策未下达，不是 reviewer 有权自行关闭的 finding。
- 当前阶段不以 secondary UIAutomator hierarchy 证明 secondary 像素；也不以模型 red fixture
  的 FAIL 证明生产源码 FAIL。

## 阶段出口

CP7-01 至 CP7-09、CP7-11、CP7-17、CP7-18 必须由 fresh 独立阶段 reviewer 逐条复核。
CP7-10、CP7-12、CP7-13、CP7-14 是当前真实证据边界，保留 `OPEN`，不得由主 agent 擅自
放宽验收；CP7-15、CP7-16 保留 `OPEN_BY_DEXTER_DECISION`。本清单不产生整个 TER 的
最终 GO；全批逐代码与详设对账、整体测试、最终实施 review 仍须分别完成。
