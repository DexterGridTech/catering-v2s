# TER 固定逻辑画布实施证据（Codex）

REVIEW_CYCLE_ID=TER_LOGICAL_CANVAS_STRETCH_IMPLEMENTATION_20260908
REVIEW_TARGET=IMPLEMENTATION
IMPLEMENTATION_AUTHORITY=true
MAIN_SESSION_FRESH=false
EVIDENCE_STATUS=IN_PROGRESS
CURRENT_REMEDIATION=SHARED_RN_RENDER_DENSITY_20260909
CURRENT_REMEDIATION_STATUS=READY_FOR_CLAUDE_IMPLEMENTATION_REVIEW_WITH_DYNAMIC_OPEN_ITEMS

> 历史边界：本文件中 `CP-0` 至原有 `CP-7` 记录是在本次 canonical render density 修复之前
> 形成的历史证据；其中出现的 `SECONDARY 1280×720`、旧的 `0.375549...` 残差以及“用
> `screencap -d 2` 无法获得副屏截图”等内容，不得作为本次修复后的当前结论。本文件末尾
> 的“目标 display density remediation addendum”已被 2026-09-09 的“shared RN render density
> remediation addendum”明确取代；本文件末尾最新 addendum 才是当前源码与当前 APK 的证据入口。

本文只记录本次 TER 固定逻辑画布实施的真实过程证据。静态、focused、Web、Android
证据分栏；任何未执行项目保持 `NOT_RUN` 或 `OPEN`，不由设计结论、测试名称或预期数字代替。

## CP-0A：权威来源与旧材料 supersede

CP-0A_STATUS=MATCHED
CP-0A_EVIDENCE_TIER=static
CP-0A_SESSION_FRESH=false

### CP-0A 第 1 轮 fresh 独立审查结论

审查者：Popper，`reviewerKind=INDEPENDENT_SUBAGENT`，fresh 子 agent；只读静态审查，
未运行命令、未修改文件、未进入 CP-0。结论为 `OPEN`，原因是审查发现一份实际存在的
旧实施计划仍把 2026-09-07 Web policy 写成有效条款，以及当前源码中若干旧尺寸命中尚未
逐项分类。该结论先于本次处置记录，不能被本证据文档的作者摘要替代。

本轮处置：旧实施计划已加 `HISTORICAL_SUPERSEDED` 与 supersede notice，并在其 §6.2
明确旧 `scaleToFit`/uniform preview scale 只保留为历史；当前 Web policy 仍是 OPEN。
以下残留源码命中已逐项登记到 CP-1/CP-3 的后续变更分母，避免用“未在三包扫描内”掩盖：

| 路径与行 | 命中语义 | 处置分类 | 后续闭合点 |
| --- | --- | --- | --- |
| `apps/terminal/kernel/base/platform-ports/test/startupDiagnostics.dev.test.ts` 第 50、55 行 | synthetic startup.surfaces declared/measured payload 中的旧 PRIMARY 尺寸 | `CP-3_RUNTIME_DIAGNOSTIC_SYNC`；不是硬件事实，但不能留成当前样例 | CP-3 逐条同步并保留启动事件/断言语义 |
| `apps/terminal/ui/feature/sample-staff-auth/test/staffAuth.test.ts` 第 71、233 行 | PRIMARY frame 行为 fixture 使用旧主屏尺寸 | `CP-1_DIRECT_BEHAVIOR_FIXTURE` | CP-1 改为 1280×800；portrait 360×720 继续作为合成行为 fixture，不当硬件 profile |
| `apps/terminal/ui/feature/sample-member-desk/test/memberDesk.test.tsx` 第 86、235、616 行 | 默认/landscape secondary 与 PRIMARY frame 行为 fixture 使用旧尺寸 | `CP-1_DIRECT_BEHAVIOR_FIXTURE` | CP-1 分别同步 SECONDARY 1280×720、PRIMARY 1280×800；320×541 与 portrait 360×720 仅保留边界/合成行为语义 |
| `apps/terminal/ui/base/input/test/keyboardHeight.test.ts` 第 8、16、28 行及同包其它旧 frame fixture | input 纯函数的 frame 行为输入，不直接读取 sample declaration | `CP-1_CLASSIFY_IN_SCOPE` | 按测试语义改为新画布派生值或命名的中性 fixture，断言语义不变 |
| `apps/terminal/ui/integration/sample-console/**` 与 `apps/terminal/ui/base/dev-host/**` 的旧 shape/旧尺寸命中 | declaration、host shape 与预览 geometry | `CP-1_SYNC` 或 `CP-5_POLICY_FIXTURE`，逐文件分类 | CP-1/CP-5 按计划处理；未分类命中不得闭合 |

### 三项实施前修复的静态回读

| ID | 需求/评审要求 | 当前设计/计划落点 | 当前观察 | 结论 |
| --- | --- | --- | --- | --- |
| S-1 | P-01 不得使用 `rawPx / (logical × density)` 恒真式；必须跨源核对 | `2026-09-08-v2s-terminal-android-web-preview-alignment-design-codex.md` 第 206-229 行；同名 implementation plan 第 64-82 行 | P-01 现在要求记录 PRIMARY/SECONDARY stableDensityDpi 与独立 target-display facts，并把 measurement-context logical bounds 与 owner 非 IME decorView logical bounds 逐轴比较；任一不一致按 O-05 停机 | MATCHED |
| S-2 | `TYPE_APPLICATION` 必须有边界与交叉核对 | 详设第 210、225-229 行；计划第 65、76 行 | 详设说明它只作为一次 stable maximum measurement context，不伪装 Presentation；P-01 另取 owner Activity/Presentation 的非 IME decorView，逐轴 delta 超限停机 | MATCHED |
| S-3 | CP-1 分母必须包含 sample-console 两个生产入口命中 | 详设现状矩阵第 69-72 行；计划第 91-130 行 | `sample-console/src/index.ts` 与 `sample-console/test-expo/App.tsx` 已纳入允许改动、fixture 表和“三包全部源码与入口”扫描范围 | MATCHED |

### 当前横屏权威语义

| 范围 | 权威内容 | 证据 |
| --- | --- | --- |
| PRIMARY | 固定逻辑画布 `1280×800`，目标 16:10 | surface-form 需求第 65-67、230-235 行；alignment 详设第 160-177 行 |
| SECONDARY | 固定逻辑画布 `960×540`，目标 16:9；`1280×720` 仅是当前 Android physical display | surface-form 需求第 65-67、230-235 行；alignment 详设第 160-177 行 |
| Android | carrier 提供 display/window 事实；承载层可按 `scaleX`/`scaleY` 铺满；目标 display density 修正与画布缩放是独立步骤 | dual-screen README 第 21-38 行；surface-form 需求第 236-247 行 |
| Web | 画布映射策略仍待 Dexter 裁决；当前不把 contain 或 browser 非等比 stretch 写成有效契约 | alignment 详设第 150-158 行；sample-console/dev-host README 第 45-49、24-30 行 |
| Portrait | target hardware profile 未提供，保持 OPEN；不转置横屏数字，不使用 landscape 证据 | surface-form 需求第 289-295 行；alignment 详设第 178-186 行；implementation plan 第 41-49、107-110 行 |

### 旧材料扫描与处理

已逐份回读下列 CP-0A 范围内材料。旧 `1157×723`、`962×541` 的剩余命中均明确标成
“退役/历史材料/待 CP-1 同步”，没有被写成当前硬件、验收或运行时基线；当前源码中的旧
package/parser/fixture 命中是 CP-1 的待实施输入，不在 CP-0A 偷改：

1. `doc/plans/platform/2026-09-06-v2s-terminal-input-surface-form-requirements-codex.md`
2. `doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-codex.md`
3. `doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-v2-codex.md`
4. `doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-plan-codex.md`
5. `doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-design-codex.md`
6. `doc/plans/platform/2026-09-06-v2s-terminal-input-surface-and-keyboard-implementation-design-codex.md`
7. `apps/terminal/adapter/android/dual-screen/README.md`
8. `apps/terminal/ui/integration/sample-console/README.md`
9. `apps/terminal/ui/base/dev-host/README.md`
10. `doc/plans/platform/2026-09-06-v2s-terminal-input-surface-and-keyboard-implementation-plan-codex.md`

第 10 份材料现已标记为 `HISTORICAL_SUPERSEDED`，其中旧 Web supplement/§6.2 不能作为
当前实现输入；当前 Web policy 仍以 2026-09-08 alignment 详设中的 OPEN 为准。

本步只修改了历史计划的 supersede 标记与 CP-0A 记录，没有修改生产源码、测试基线或
node_modules，也未运行 Android/Web；在第 2 轮复核前 CP-0A 保持 `OPEN`，不能把材料
处置写成 CP-0 的五项 probe、编译、运行或业务结果通过。

### CP-0A 第 2 轮最终独立复核

审查输入：`doc/review/platform/2026-09-08-ter-logical-canvas-cp0a-independent-review-round2-checklist-codex.md`。

```text
REVIEW_CYCLE_ID=TER_LOGICAL_CANVAS_STRETCH_IMPLEMENTATION_20260908
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
REVIEWER_STATUS=FRESH_READ_ONLY
CP-0A=MATCHED
```

Popper 在 fresh 独立子 agent 上先证伪后读作者记录；未修改文件，未运行 Android/Web/DEV、
seed、UAT 或部署。其第 2 轮确认：历史计划的旧 Web policy 已明确 superseded；残留旧尺寸
已按 CP-1/CP-3 分类且没有从分母漏掉 sample-console 两个生产入口；CP-0A evidence 没有
冒充 P-01～P-05、编译或运行结果；未发现公共契约、fallback、兼容层或提前实施越界。
这是 CP-0A 的最终静态闭合，不是 CP-0 的动态闭合。

### CP-0A 原始静态命令与输出摘要

| 命令/检查 | 原始观察 | 结论 |
| --- | --- | --- |
| `scripts/context/agent-context health` | `STATUS=PASS`；`CONTEXT_MODE=DETERMINISTIC_ONLY`；入口包含 AGENTS、PLATFORM-BLUEPRINT、Roadmap Registry、project-memory、scripts README | MATCHED |
| `scripts/context/recall-memory --task-kind implementation --domain platform --consumer-face platform-admin --owner frontend-platform --impact runtime --trigger implementation` | 返回六个 kernel 与 TER architecture、terminal coding standard、evidence/runtime、test closed-loop 等匹配原文；已逐个打开 | MATCHED |
| `rg` 对十份 CP-0A 文档扫描旧数字与 supersede 语义 | 旧实施计划已显式历史化；当前横屏语义统一为 `1280×800`、`1280×720`；源码残留已进入逐文件分类表 | MATCHED |
| `rg` 对 `apps/terminal` 当前源码旧尺寸命中 | 发现上述 kernel、feature、input、sample-console、dev-host 命中；已逐项登记 CP-1/CP-3，不再声称源码旧命中已经消失 | MATCHED |
| `git diff --check -- <十份 CP-0A 文档>` | 无输出，退出码 `0` | MATCHED |

### 局部 OPEN（不阻断横屏 CP-0）

| OPEN | 当前边界 | 不得声称 |
| --- | --- | --- |
| Web policy | Dexter 尚未在 contain 与 browser stretch 之间作出裁决；CP-5 Web geometry 到此停下 | 不得声称 Web 缩放策略已实现或已验收 |
| Portrait target hardware profile | 没有真实 profile；O-01 保持 OPEN | 不得声称竖屏拓扑、尺寸或键盘已完成 |

后续 CP 的每个阶段记录都必须补充：原始输出路径、session fresh 状态、surfaceKey、display/window
identity、scaleX/scaleY，以及只写 `MATCHED` 或 `OPEN` 的阶段三维对账结果。

## CP-0：P-01 至 P-05 原始 Android probe

CP-0_STATUS=MATCHED
CP-0_EVIDENCE_TIER=Android
CP-0_CODEX_SESSION_FRESH=false
CP-0_ANDROID_RUN_FRESH=true
CP-0_ANDROID_PROBE_PROCESSES=5795 (P-01/P-02/P-04/P-05); 6229 (P-03 evidence repair rerun)
CP-0_ANDROID_PRODUCTION_PROCESS=5939 (P-01 owner-window IME snapshots)
CP-0_DEVICE_SERIAL=emulator-5554
CP-0_DISPLAY_CONFIG=`display 0: 2560×1600 @ 320 dpi`; `display 2: 1280×720 @ 213 dpi`
CP-0_PROBE_SCALE=`scaleX=0.7`, `scaleY=0.5`（临时 probe，仅用于本 CP，已删除）

本轮先清空 logcat，force-stop `com.anonymous.sampleterminal`，再以 `monkey` 启动新的
Android 进程。主屏真实截图保存为 `/tmp/ter-cp0-probe-primary.png`；副屏通过
`adb shell screencap -d 2` 与 `screenrecord --display-id 2` 的尝试均返回
`Invalid physical display ID`/`Capturing failed`，因为当前 display 2 是 virtual display，
不是 ADB 可抓取的 physical display。副屏的真实命中仍通过
`adb shell input -d 2 tap 410 153` 完成，并以 JS handler 事件核对。

### P-01：稳定窗口、密度与 IME 行为

所选分支：`host-ready decorView` branch 2。原因是本轮 fresh run 在 IME visible=true
与 visible=false 前后，primary `decorView`/`ime-root` 仍报告 2560×1600；IME 只改变
独立 inset 事实，不改变当前窗口布局。没有引入 maximum-metrics。

原始 probe 输出 `/tmp/ter-cp0-final-complete.log` 中的关键片段：

```text
09-08 04:25:50.980  5795  5795 I TerminalDualScreen: event=display-snapshot-entry displayIndex=0 displayId=0 ... appWidthPx=2560 appHeightPx=1600 appDensityDpi=320 ... realWidthPx=2560 realHeightPx=1600
09-08 04:25:50.981  5795  5795 I TerminalDualScreen: event=display-snapshot-entry displayIndex=1 displayId=2 ... appWidthPx=1280 appHeightPx=720 appDensityDpi=213 ... realWidthPx=1280 realHeightPx=720
09-08 04:25:51.036  5795  5795 I TerminalDualScreen: event=secondary-target-metrics displayId=2 widthPx=1280 heightPx=720 densityDpi=213 density=1.3312501
09-08 04:25:51.042  5795  5795 I TerminalDualScreen: event=presentation-context-before-surface displayIndex=1 densityDpi=213 ... screenWidthDp=962 screenHeightDp=541 ... resourceWidthPx=1280 resourceHeightPx=720
09-08 04:25:51.103  5795  5795 I TerminalDualScreen: event=secondary-react-surface-layout displayIndex=1 displayId=2 ... widthPx=1280 heightPx=720 ... densityDpi=213 ... logicalWidth=961.5023 logicalHeight=540.84503
09-08 04:25:51.103  5795  5795 I TerminalDualScreen: event=secondary-presentation-window-layout displayIndex=1 displayId=2 ... widthPx=1280 heightPx=720 ... densityDpi=213 ... logicalWidth=961.5023 logicalHeight=540.84503
09-08 04:25:51.132  5795  5795 I TerminalDualScreen: event=ime-insets window=primary displayIndex=0 displayId=0 visible=false bottomPx=0 bottomLogical=0.0
09-08 04:25:51.143  5795  5795 I TerminalDualScreen: event=primary-window-layout displayIndex=0 displayId=0 ... widthPx=2560 heightPx=1600 ... densityDpi=320 ... logicalWidth=1280.0 logicalHeight=800.0
09-08 04:25:51.143  5795  5795 I TerminalDualScreen: event=ime-root-layout window=primary displayIndex=0 displayId=0 ... widthPx=2560 heightPx=1600 ... logicalWidth=1280.0 logicalHeight=800.0
09-08 04:25:53.225  5795  5795 I TerminalDualScreen: event=ime-insets window=primary displayIndex=0 displayId=0 visible=true bottomPx=736 bottomLogical=368.0
09-08 04:25:54.643  5795  5836 I ReactNativeJS: [TER-CP0] event=imeDismissRequest data={"displayIndex":0}
09-08 04:26:17.741  5795  5795 I TerminalDualScreen: event=ime-insets window=primary displayIndex=0 displayId=0 visible=false bottomPx=0 bottomLogical=0.0
```

同一 run 的 probe 日志显示 primary `ime-insets` 从 `visible=false,bottomPx=0` 变为
`visible=true,bottomPx=736`，随后恢复为 `visible=false,bottomPx=0`；primary 的
`primary-window-layout` 与 `ime-root-layout` 在这些状态均为 `2560×1600 / 1280×800`。
为核实 branch 2 不依赖 probe 自报，另以 production app 进程 5939 在同一窗口身份上保存
了前、IME 显示中、收起后三份 `dumpsys window windows` 原始快照：

```text
/tmp/ter-cp0-ime-window-before.txt
  Window #8 Window{5a3178b u0 com.anonymous.sampleterminal/com.anonymous.sampleterminal.MainActivity}:
    mDisplayId=0 ... Requested w=2560 h=1600
    Frames: ... frame=[0,0][2560,1600] ...
  Window #13 Window{5414d49 u0 com.anonymous.sampleterminal}:
    mDisplayId=2 ... Requested w=1280 h=720
    Frames: ... frame=[0,0][1280,720] ...

/tmp/ter-cp0-ime-window-visible.raw.txt
  Window #7 Window{cd3b8c u0 InputMethod}:
    isVisible=true
  Window #8 Window{5a3178b u0 com.anonymous.sampleterminal/com.anonymous.sampleterminal.MainActivity}:
    mDisplayId=0 ... Requested w=2560 h=1600
    Frames: ... frame=[0,0][2560,1600] ...
  Window #13 Window{5414d49 u0 com.anonymous.sampleterminal}:
    mDisplayId=2 ... Requested w=1280 h=720
    Frames: ... frame=[0,0][1280,720] ...

/tmp/ter-cp0-ime-window-after.raw.txt
  Window #7 Window{cd3b8c u0 InputMethod}:
    isVisible=false
  Window #8 Window{5a3178b u0 com.anonymous.sampleterminal/com.anonymous.sampleterminal.MainActivity}:
    mDisplayId=0 ... Requested w=2560 h=1600
    Frames: ... frame=[0,0][2560,1600] ...
  Window #13 Window{5414d49 u0 com.anonymous.sampleterminal}:
    mDisplayId=2 ... Requested w=1280 h=720
    Frames: ... frame=[0,0][1280,720] ...
```

上述 raw dump 还保留了 Presentation 的 `ty=PRESENTATION`、primary 的 `sim={adjust=resize}`
以及 IME window 的可见性状态；`/tmp/ter-cp0-ime-input-method-visible.txt` 记录了同一
次真实焦点会话。production app 的窗口 frame 在 IME 显示中与收起后不变，变化的是独立
IME/inset 状态，因此当前仓内分支为 branch 2：使用 owner `decorView` 的 ready frame，
不引入 `maximumWindowMetrics`。

稳定密度仍由同一次 adapter display snapshot 提供：display 0 为 320、display 2 为 213；
它们不是从 logical size 反推。P-01 的“稳定”结论由 native display snapshot、owner frame
和 IME 显示/收起三态交叉核对，而非恒真比例式。

P-01=MATCHED。

### P-02：RN 0.86.3 surface parent、约束与 fixed child

原始 Android/JS 输出仍在 `/tmp/ter-cp0-final.log`。同一进程 5795 的 native surface
layout 与 JS layout 如下：

```text
TerminalDualScreen: event=secondary-react-surface-layout displayIndex=1 displayId=2 ... widthPx=1280 heightPx=720 measuredWidthPx=1280 measuredHeightPx=720
ReactNativeJS: [TER-CP0] event=hostOnLayout data={"displayIndex":1,"x":0,"y":0,"width":961.5023193359375,"height":540.8450317382812}
ReactNativeJS: [TER-CP0] event=canvasOnLayout data={"displayIndex":1,"x":0,"y":0,"width":1279.9998779296875,"height":720.3755493164062}
ReactNativeJS: [TER-CP0] event=hostOnLayout data={"displayIndex":0,"x":0,"y":0,"width":1280,"height":800}
ReactNativeJS: [TER-CP0] event=canvasOnLayout data={"displayIndex":0,"x":0,"y":0,"width":1280,"height":720}
```

这证明同一 Fabric/bridgeless sample 的 fixed child 在 primary 与 secondary surface 中均
完成布局；secondary 的 fixed canvas 可以大于其当前 host logical frame，后续由 host
裁切/承载策略负责，而不是被 RN 的 AT_MOST surface parent 静默改成 host 尺寸。RN public
实现的静态依据是 `ReactSurfaceImpl.kt` 的 `setLayoutConstraints(... AT_MOST ... context
displayMetrics)` 与 `ReactSurfaceView.kt` 的 child-size measurement；没有使用私有 setter
或修改 node_modules。

P-02=MATCHED。

### P-03：非等比 transform 与真实 tap

临时 probe 配置为 `scaleX=0.7`, `scaleY=0.5`，本次证据修复 rerun 的原始输出
`/tmp/ter-cp0-final-verified.log`：

```text
ReactNativeJS: [TER-CP0] event=runtimeMetrics data={"displayIndex":1,"pixelRatio":2,"scaleX":0.7,"scaleY":0.5}
ReactNativeJS: [TER-CP0] event=runtimeMetrics data={"displayIndex":0,"pixelRatio":2,"scaleX":0.7,"scaleY":0.5}
ReactNativeJS: [TER-CP0] event=measureInWindow data={"displayIndex":0,"x":224,"y":90,"width":168,"height":50}
ReactNativeJS: [TER-CP0] event=measureLayoutToCanvas data={"displayIndex":0,"x":320,"y":180,"width":240,"height":100}
ReactNativeJS: [TER-CP0] event=hitPressed data={"displayIndex":0,"logicalX":440,"logicalY":230}
ReactNativeJS: [TER-CP0] event=hitPressed data={"displayIndex":1,"logicalX":440,"logicalY":230}
```

primary 真实截图 `/tmp/ter-cp0-probe-rerun-primary.png` 中 hit box 的视觉位置是逻辑
`left=320, top=180, width=240, height=100` 经 `0.7/0.5` 映射后的窗口区域；ADB
primary tap 的真实 shell trace 在 `/tmp/ter-cp0-tap-primary.txt`，命令为
`adb -s emulator-5554 shell input tap 616 230` 且 `exit=0`；副屏 trace 在
`/tmp/ter-cp0-tap-secondary.txt`，命令为 `adb -s emulator-5554 shell input -d 2 tap 410 153`
且 `exit=0`。同一 fresh probe 进程 6229 随后记录 displayIndex 0 与 1 的
`hitPressed`。`measureLayoutToCanvas` 保持逻辑盒，`measureInWindow` 显示变换后盒，
说明命中与视觉区域没有依靠 props、调用次数或字符串搜索证明。
当前 virtual display 2 无法由 ADB 生成可用 screenshot：`/tmp/ter-cp0-screenrecord.out`
保留了 `Invalid physical display ID`；该失败不会被写成副屏 screenshot 成功。

P-03=MATCHED。

### P-04：scroll 坐标系选择

同一 input 在 transform 前后、scroll 前后的原始输出：

```text
ReactNativeJS: [TER-CP0] event=scrollInputOnLayout data={"displayIndex":0,"x":0,"y":800,"width":300,"height":80}
ReactNativeJS: [TER-CP0] event=scrollInputMeasureLayoutToScroll data={"displayIndex":0,"x":0,"y":800,"width":300,"height":80}
ReactNativeJS: [TER-CP0] event=scrollToRequest data={"displayIndex":0,"beforeOffset":0,"delta":200,"targetOffset":200}
ReactNativeJS: [TER-CP0] event=scrollEvent data={"displayIndex":0,"contentOffsetY":200}
ReactNativeJS: [TER-CP0] event=scrollInputMeasureInWindow data={"displayIndex":0,"x":490,"y":420,"width":210,"height":40}
ReactNativeJS: [TER-CP0] event=scrollInputMeasureInWindow data={"displayIndex":0,"x":490,"y":320,"width":210,"height":40}
ReactNativeJS: [TER-CP0] event=scrollInputMeasureLayoutToScroll data={"displayIndex":0,"x":0,"y":800,"width":300,"height":80}
```

secondary 同样得到 `contentOffsetY=200`，且 `measureInWindow` 的纵向变化是 100，即
`200×scaleY`；这正是混单位缺陷。`onLayout`/`measureLayout` 的 y=800 是 content-local
位置，`contentOffsetY` 也是内容坐标，因此 CP-4 应选 content-local path，用
`inputLayout + currentOffset` 与 viewport content bounds 计算 delta；不能继续把
`measureInWindow` 的 transformed delta 直接加到 currentOffset，也不能把 `measureLayout`
误读成已扣除 scroll offset 的窗口位置。

P-04=MATCHED。

### P-05：同一 JS runtime 的全局 metrics 与 per-surface 追踪

两个 surface 在同一 JS runtime、同一进程 5795 中分别记录：

```text
ReactNativeJS: [TER-CP0] event=runtimeMetrics data={"displayIndex":1,"pixelRatio":2,"scaleX":0.7,"scaleY":0.5}
ReactNativeJS: [TER-CP0] event=runtimeMetrics data={"displayIndex":0,"pixelRatio":2,"scaleX":0.7,"scaleY":0.5}
TerminalDualScreen: event=display-snapshot-entry displayIndex=0 ... appDensityDpi=320 ...
TerminalDualScreen: event=display-snapshot-entry displayIndex=1 displayId=2 ... appDensityDpi=213 ...
```

结果明确：`PixelRatio.get()` 是 process-global 的 2，不能作为 secondary display density
或 scale 的来源；它没有被误当成 per-surface事实。per-surface 追踪由 displayIndex、
displayId、window owner 与 adapter 的 display snapshot 提供，且 primary/secondary host
layout 在同一 JS runtime 中可分别观察。这个 probe 因而闭合了“禁止依赖 global PixelRatio”
的前提，而不是声称 JS 全局 PixelRatio 会自动随 surface 切换。

P-05=MATCHED。

### CP-0 原始输出与分项结论索引

| probe | 原始输出 | surface/window | scaleX/scaleY | 结论 |
| --- | --- | --- | --- | --- |
| P-01 | `/tmp/ter-cp0-final-complete.log` + `/tmp/ter-cp0-ime-window-before.txt` + `/tmp/ter-cp0-ime-window-visible.raw.txt` + `/tmp/ter-cp0-ime-window-after.raw.txt` | PRIMARY display 0 / MainActivity；SECONDARY display 2 / Presentation | probe 0.7/0.5；production owner frame untransformed | MATCHED |
| P-02 | `/tmp/ter-cp0-final.log` native + JS layout lines | same process 5795, both React surfaces | 0.7/0.5 | MATCHED |
| P-03 | `/tmp/ter-cp0-final-verified.log` + `/tmp/ter-cp0-probe-rerun-primary.png` + `/tmp/ter-cp0-tap-primary.txt` + `/tmp/ter-cp0-tap-secondary.txt` | display 0 and display 2 | 0.7/0.5 | MATCHED |
| P-04 | `/tmp/ter-cp0-final.log` scroll request/event/measure lines | display 0 and display 2 | 0.7/0.5 | MATCHED |
| P-05 | `/tmp/ter-cp0-final.log` runtimeMetrics + native display snapshot | same JS runtime 5795 | 0.7/0.5 | MATCHED |

CP-0 的临时 `DebugSurfaceProbe.tsx` 已删除，`App.tsx` 已恢复为 probe 前内容；恢复后
package typecheck 与 `git diff --check` 对本 CP 触及文档与恢复文件退出码为 0。以上只是 CP-0 probe 证据，
不等于 CP-1 之后的生产实现、Web policy、portrait、业务测试或最终交付已完成。

### CP-0 第 1 轮独立审查与证据修复

Singer 为 `reviewerKind=INDEPENDENT_SUBAGENT` 的 fresh 只读审查者，第一轮结论为
`CP-0=OPEN`，M=2。两个 finding 均为证据闭环问题而不是生产行为判断：P-01 引用的
`/tmp/ter-cp0-final.log` 截止在 IME 中间态且没有同一 production owner frame 的三态
原始快照；P-03 引用了不存在的 `/tmp/ter-cp0-secondary.mp4`，且没有保存实际 ADB tap
命令记录。审查者拒绝了 P-02、P-04、P-05 的指控，并确认临时 probe 已清理。

处置已完成：

- 用 production app 进程 5939 保存 `/tmp/ter-cp0-ime-window-before.txt`、
  `/tmp/ter-cp0-ime-window-visible.raw.txt`、`/tmp/ter-cp0-ime-window-after.raw.txt`，
  并以 InputMethod `isVisible=true/false` 与 app 的 primary/secondary frame 逐段交叉核对。
- 重跑临时 probe 为进程 6229，保存 `/tmp/ter-cp0-final-verified.log`，并将 primary 与
  secondary 的真实 tap shell trace 分别保存到 `/tmp/ter-cp0-tap-primary.txt` 与
  `/tmp/ter-cp0-tap-secondary.txt`，两者都记录 `exit=0`；probe 随后再次删除并恢复入口。
- 删除不存在的 secondary mp4 引用，改为引用真实存在的 `/tmp/ter-cp0-screenrecord.out`
  失败输出；不把 virtual display 的截图能力写成成功。

在第 2 轮独立审查结束前，CP-0 顶层状态保持 `OPEN`；不得用上述修复摘要替代复查结论。

### CP-0 第 2 轮最终独立复查

审查输入：`doc/review/platform/2026-09-08-ter-logical-canvas-cp0-independent-review-round2-checklist-codex.md`。

```text
REVIEW_CYCLE_ID=TER_LOGICAL_CANVAS_STRETCH_IMPLEMENTATION_20260908
REVIEW_TARGET=IMPLEMENTATION
REVIEW_SCOPE=CP-0
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
REVIEWER_STATUS=FRESH_READ_ONLY
VERDICT=GO
M/S/N=0/0/0
CP-0=MATCHED
```

Singer 在第 2 轮只读核对了上一轮两个 finding：P-01 的 production owner window 三态
证据已补齐，P-03 的真实 primary/secondary tap shell trace 与 6229 probe 的命中日志已
按坐标和进程对应；未发现阻断 finding。审查者未运行命令、未修改文件、未进入 CP-1。
该 `GO` 只表示 CP-0 的独立审查闭合，不是最终 TER 实施交付结论。

### CP-0 阶段三维对账

以下逐条对比 CP-0 的原始需求、alignment 详设/实施计划与项目设计规范/记忆；没有用
阶段测试结果替代需求对账。全部结论为 `MATCHED` 后才打开 CP-1。

| CP-0 条目 | 需求与源码锚点 | 详设/计划锚点 | 规范/记忆核对 | 结论 |
| --- | --- | --- | --- | --- |
| P-01 stable/current 与密度同源 | `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-design-codex.md` 第 202-238 行；`TerminalDualScreenActivityHandler.kt` 第 364-385 行 | `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-implementation-plan-codex.md` 第 64-82 行 | 适配器提供 display/window 事实，IME 不得改变 scale 基准 | MATCHED |
| P-02 RN public surface/constraint | `ReactSurfaceImpl.kt` 第 65-84 行；`ReactSurface.kt` 第 15-48 行 | 详设第 60-77 行；计划第 66-67 行 | 不反射、不改 node_modules、不创建第二 React host | MATCHED |
| P-03 非等比 transform 与真实命中 | `apps/terminal/assembly/android/sample-terminal/App.tsx` 已恢复；Android display 0/2 tap trace | 计划第 66-82 行；详设 I-04、§4 | 行为用真实 tap 验证，不用 props/调用次数/字符串 | MATCHED |
| P-04 scroll 坐标系 | `apps/terminal/ui/base/input/src/components/InputScrollArea.tsx` 第 19-40 行 | 计划第 67、79 行；详设第 300-344 行 | input 只接收逻辑坐标，不读取宿主 scale/Dimensions | MATCHED |
| P-05 双 surface runtime 追踪 | `TerminalDualScreenModule.kt` 第 6-30 行；`androidDevice.ts` 第 1-84 行 | 计划第 68、80-82 行；详设第 192-213 行 | 不扩展 DevicePort/DisplayInfo/PlatformPortBindings，不复制 DisplayMode | MATCHED |
| 证据与边界 | CP-0 round2 checklist 第 1-49 行；本证据文档 CP-0 原始输出节 | 计划第 84-87 行及全局停止条件 | static/focused/Android/Web 证据分栏，未运行不写成通过 | MATCHED |

CP-0_FINAL=MATCHED。已满足进入 CP-1 的前置条件；Web policy 与 portrait hardware profile
仍分别保持既有 `OPEN`，不因 CP-0 闭合而扩大为已完成。

## CP-1：固定画布声明与结构型 host contract

`CP-1_HISTORICAL_SNAPSHOT=TRUE`。本节是在后续目标 display/shared RN render density 处置前形成的
过程快照；其中的 `SECONDARY 1280×720` 仅是当时记录，不是当前 package 声明或当前逻辑画布。
当前源码与 APK 只以本文文件头的 current remediation 及文件末尾最新 addendum 为准。

CP-1_STATUS=OPEN_PENDING_INDEPENDENT_REVIEW
CP-1_CODEX_SESSION_FRESH=false
CP-1_FOCUSED_RUN_FRESH=true
CP-1_ANDROID_RUN=NOT_RUN_BY_CP1
CP-1_WEB_RUN=NOT_RUN_BY_CP1
CP-1_SURFACE_KEYS=`PRIMARY`, `SECONDARY`（使用既有 `DisplayMode`）
CP-1_DISPLAY_WINDOW_IDENTITY=synthetic logical fixtures only; no Android/Web host was run in CP-1
CP-1_SCALE_X_SCALE_Y=NOT_APPLICABLE（CP-1 只迁移声明与静态/纯 UI fixture；运行时 scale 留在后续 CP）

### CP-1 implementation scope and static result

| 代码/入口 | 当前处置 | 与计划核对 | 结论 |
| --- | --- | --- | --- |
| `apps/terminal/ui/integration/sample-console/package.json` 的 `terminalSurfaces` | 改为 `orientations.landscape.PRIMARY={1280,800}`、`SECONDARY={1280,720}`；移除 package-level `layout`/`scaleToFit` | 计划 §3 规则 1-4 | MATCHED |
| `apps/terminal/ui/integration/sample-console/src/application/terminalSurfaces.ts` | parser 按 `orientations`、既有 `DisplayMode` 和正数尺寸解析；portrait 只接受显式输入，不生成 profile；旧 shape 被拒绝 | 计划 §3 规则 3-5 | MATCHED |
| `apps/terminal/ui/integration/sample-console/src/index.ts` | 保留唯一 `terminalSurfaces` value 入口，并同步导出新 shape 类型 | 计划 CP-1 allowed changes | MATCHED |
| `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx` | 读取 `terminalSurfaces.orientations.landscape[displayMode]`；诊断记录 `orientation`，不再读取 package layout policy | 计划 CP-1 只做 shape/diagnostic migration | MATCHED |
| `apps/terminal/ui/integration/sample-console/test-expo/App.tsx` | 仍通过唯一 value 入口把新结构传入 dev-host；无旧字段读取，故无需代码修改 | 计划 denominator 明确纳入 sample Web production entry | MATCHED |
| `apps/terminal/ui/base/dev-host/src/components/testExpoApp.tsx` | 读取 `orientations.landscape`；排列与 overflow 暂由 dev-host 内部 policy 常量持有，geometry 算法留到 CP-5 | 计划 CP-1 与 Web policy OPEN | MATCHED |
| `apps/terminal/ui/base/dev-host/test/testExpoApp.test.tsx` | 注入新 shape；保留 1920×1080/1024×600 作为 dev-host geometry fixture | 计划分类为自有 host policy fixture | MATCHED |
| `apps/terminal/ui/base/dev-host/test/surfacePreview.test.ts` | 已扫描；`layout`/`scaleToFit` 属 dev-host geometry policy，保持到 CP-5，不误改成 package shape | 计划明确的分类项 | MATCHED |
| `apps/terminal/ui/integration/sample-console/test/packageSurface.test.ts`、`terminalSurfaces.test.ts` | 锁定新 shape、正数、缺失、非法和旧 shape 反例 | 计划 parser/declaration proof | MATCHED |
| `apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx`、`test/testExpoApp.test.tsx` | primary 1280×800、secondary 1280×720；按 surface index 送入对应 logical frame | 计划 sample fixture denominator | MATCHED |
| `apps/terminal/ui/base/input/test/*` | declaration-derived keyboard values按新主/副画布重算；其他用例使用命名中性 960×540 或合成边界，不读取 sample package | 计划 input fixture classification | MATCHED |
| `apps/terminal/ui/feature/sample-staff-auth/test/staffAuth.test.ts` | landscape PRIMARY 与默认 frame 改 1280×800；portrait 360×720 保持合成行为 fixture | 计划 direct business fixture | MATCHED |
| `apps/terminal/ui/feature/sample-member-desk/test/memberDesk.test.tsx` | landscape confirm/默认 secondary 改 1280×720，landscape PRIMARY 改 1280×800；portrait/unsupported fixture 保持合成边界 | 计划 direct business fixture | MATCHED |

`rg` 对 CP-1 三包源码/入口与 test tree 的 shape/旧基线命中只留下一个明确分类项：
`memberDesk.test.tsx` 第 360 行的 `320×541`，它是 unsupported-width 合成边界，不是
`962×541` 声明基线。`surfacePreview.ts` 与其 test 的 `layout`/`scaleToFit` 是后续 CP-5
的 dev-host 自有几何 policy；它们不是遗漏的 package declaration。sample-console 的
`test-expo/App.tsx` 仍只传入 `terminalSurfaces` value，没有旧字段旁路。

### CP-1 focused evidence

以下命令均在本次实现会话的 fresh focused run 中执行；`fresh` 指重新从当前工作树启动的
该 focused command，不等于 Codex 会话 fresh。没有 Android/Web/DEV/seed/UAT/deployment
运行，因此本节不提供 scale、display 或 window runtime 事实。

| focused check | 原始结果 | 证据档位 | 结论 |
| --- | --- | --- | --- |
| `yarn workspace @catering-v2s/ui-integration-sample-console typecheck` | `exit=0` | focused/typecheck | MATCHED |
| `yarn workspace @catering-v2s/ui-base-dev-host typecheck` | `exit=0` | focused/typecheck | MATCHED |
| `yarn workspace @catering-v2s/ui-base-input typecheck` | `exit=0` | focused/typecheck | MATCHED |
| `yarn workspace @catering-v2s/ui-feature-sample-member-desk typecheck` | `exit=0` | focused/typecheck | MATCHED |
| `yarn workspace @catering-v2s/ui-feature-sample-staff-auth typecheck` | `exit=0` | focused/typecheck | MATCHED |
| sample-console owned-tests | `7` test files, `18` tests passed；`TERMINAL_PACKAGE_TEST=PASS`，`exit=0` | focused | MATCHED |
| dev-host owned-tests | `4` test files, `11` tests passed；`TERMINAL_PACKAGE_TEST=PASS`，`exit=0` | focused | MATCHED |
| input owned-tests | `10` test files, `48` tests passed；`TERMINAL_PACKAGE_TEST=PASS`，`exit=0` | focused | MATCHED |
| member-desk owned-tests | `1` test file, `24` tests passed；`TERMINAL_PACKAGE_TEST=PASS`，`exit=0` | focused | MATCHED |
| staff-auth owned-tests | `1` test file, `7` tests passed；`TERMINAL_PACKAGE_TEST=PASS`，`exit=0` | focused | MATCHED |
| `git diff --check` | 无输出，`exit=0` | static | MATCHED |
| old shape/baseline scan | 无 `terminalSurfaces.surfaces/layout/scaleToFit` 与 `1157|962|723|541` 旧组合；仅保留已分类 `320×541` 合成边界 | static | MATCHED |

### CP-1 阶段三维对账（待独立审查确认）

| 对账条目 | 原始需求/源码 | alignment 详设与实施计划 | 项目规范/记忆 | 结论 |
| --- | --- | --- | --- | --- |
| landscape declaration | sample-console package JSON 与 parser | 详设 §4.1；计划 CP-1 规则 1-2 | 声明是唯一业务画布输入，旧基线退役 | MATCHED |
| orientation → DisplayMode → canvas | assembly/dev-host 直接读者 | 详设 §3.2、§4；计划 CP-1 规则 3、5 | 复用既有 DisplayMode，不复制 surface key | MATCHED |
| null/portrait boundary | parser optional portrait 与未填 profile | 详设 §4.2；计划 CP-1 规则 4、6 | 不猜测 target hardware，不用 fallback | MATCHED |
| dev-host policy boundary | local layout/overflow constants；surfacePreview 保留 | 详设 §3.3 Web policy OPEN；计划 CP-1/CP-5 boundary | 不把 host policy回写业务声明 | MATCHED |
| fixture denominator | 三包全部源码/入口、test tree、两个业务消费者 | 计划 CP-1 denominator table | 逐代码扫描、未分类命中不得闭合 | MATCHED |
| behavior preservation | feature/input assertions remain behavior assertions | 计划 CP-1 fixture rule；RD-10 | 不削弱既有业务断言语义 | MATCHED |
| evidence boundary | typecheck/focused only | 计划 CP-1 focused proof | static/focused 不冒充 Web/Android runtime | MATCHED |

CP-1_STAGE_RECONCILIATION=MATCHED

### CP-1 fresh 独立只读审查（round 1）

审查输入：`doc/review/platform/2026-09-08-ter-logical-canvas-cp1-independent-review-checklist-codex.md`。
审查者 Jason（agent `01a07ffe-95a5-7f02-a33d-968390443872`）按 checklist 重新读取当前源码、
需求/详设/计划/evidence 与项目边界；没有运行命令、没有修改文件、没有进入 CP-2。

```text
REVIEW_CYCLE_ID=TER_LOGICAL_CANVAS_STRETCH_IMPLEMENTATION_20260908
REVIEW_TARGET=IMPLEMENTATION
REVIEW_SCOPE=CP-1
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
REVIEWER_STATUS=FRESH_READ_ONLY
VERDICT=GO
M/S/N=0/0/0
CP-1=MATCHED
```

独立审查确认：package declaration 只有 landscape 的 `1280×800`/`1280×720`；parser 复用
既有 `DisplayMode`、拒绝旧 shape、只接受显式 portrait；sample-console/dev-host 直接消费者与
fixture 分母已同步；dev-host 的 `layout`/`scaleToFit` 仍是后续 CP-5 的自有 policy；CP-1
旧数字只剩已分类的 `320×541` unsupported synthetic boundary；没有公共平台契约扩展、CP-2
adapter 实施或 CP-4 scroll 提前改动。审查者明确未重跑命令，也未把 Web/Android/portrait
未验证项写成通过。

独立 findings：`OPEN=0`，`CONFIRMED=0`，`PARTIALLY_CONFIRMED=0`，
`REJECTED_WITH_EVIDENCE=0`，`UNVERIFIED_REQUIRES_EVIDENCE=0`，`DEXTER_DECISION=0`。

CP-1_STATUS=MATCHED
CP-1_FINAL=MATCHED。已满足进入 CP-2 的步骤级独立复查前置；Web policy 与 portrait hardware
profile 仍保持全批 OPEN，不因 CP-1 闭合而扩大为已完成。

## CP-2：Android dual-screen adapter 的 per-surface host snapshot

CP-2_STATUS=OPEN_PENDING_INDEPENDENT_REVIEW
CP-2_CODEX_SESSION_FRESH=false
CP-2_FOCUSED_RUN_FRESH=true
CP-2_ANDROID_RUN_FRESH=true
CP-2_ANDROID_PROCESS=6629
CP-2_WEB_RUN=NOT_RUN_BY_CP2
CP-2_SURFACE_KEYS=`PRIMARY`, `SECONDARY`（adapter 内复用既有显示值，不新定义 SurfaceKey）
CP-2_SCALE_X_SCALE_Y=NOT_APPLICABLE（CP-2 只提供 host facts；canvas transform 留在 CP-3/CP-5）

### CP-2 implementation scope

| 代码/入口 | 当前处置 | 详设/计划核对 | 结论 |
| --- | --- | --- | --- |
| `TerminalDualScreenActivityHandler.kt` | 增加 adapter 内部 `TerminalSurfaceHostRegistry`；PRIMARY 绑定 Activity `decorView`，SECONDARY 绑定 Presentation `decorView`；按 owner layout 的同次 `resources.displayMetrics` 换算 stable/current logical size；保留副屏 `createSurfaceContext` density 修正 | alignment 详设 §5.1、§5.2.1；计划 CP-2 规则 1-3 | MATCHED |
| `TerminalDualScreenActivityHandler.kt` | registry entry 绑定 surface key、generation、display id、window identity、orientation、raw px、density、IME 字段；destroy/remove 发布 unavailable，不以另一块屏幕补值 | alignment 详设 §5.1、§5.3；计划 CP-2 规则 5-6 | MATCHED |
| `TerminalImeInsetsCoordinator.kt` | 继续以既有 target-density conversion 产生主屏 IME snapshot；先更新 adapter registry 的 IME 字段，再走既有 IME publisher；不改变 public port | alignment 详设 §5.2.2、§6.1；计划 CP-2/CP-4 边界 | MATCHED |
| `TerminalDualScreenModule.kt` | 在既有 Expo module 增加 `getSurfaceHostSnapshot` 与 `onSurfaceHostChanged`；没有新增 bridge/module，也没有扩展 DevicePort、DisplayInfo 或 PlatformPortBindings | alignment 详设 §5.1；计划 CP-2 规则 4、6 | MATCHED |
| `src/implementations/surfaceHost.ts` | 增加 JS source、snapshot 校验、surface/window/display/generation fence；stale、wrong display、wrong window、缺 bounds/density 均拒绝；unavailable 清空旧 snapshot | alignment 详设 §5.1、§5.3；计划 CP-2 规则 4-6 | MATCHED |
| `test/surfaceHost.test.ts` | 5 个 focused behavior tests 覆盖匹配、拒绝、清理和异步初读顺序；mock 只证明 source fence，不写成 Android 运行证据 | alignment 详设 §5.1、§5.3；计划 CP-2 focused proof | MATCHED |
| `README.md` | 记录 owner-decorView-layout、per-surface identity、IME 字段、无 fallback 和 public-contract 边界 | alignment 详设 §5.1-§5.3；计划 CP-2 allowed changes | MATCHED |

### CP-2 focused evidence

以下命令均从当前工作树重新启动，`fresh` 指该命令本身 fresh，不等于 Codex 会话 fresh：

| focused check | 原始结果 | 证据档位 | 结论 |
| --- | --- | --- | --- |
| `yarn workspace @catering-v2s/adapter-android-dual-screen typecheck` | `exit=0` | focused/typecheck | MATCHED |
| `yarn workspace @catering-v2s/adapter-android-dual-screen test` | `1` test file、`5` tests passed；`TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/adapter-android-dual-screen`；`exit=0` | focused | MATCHED |
| `./gradlew :app:assembleDebug --no-daemon --console=plain` | `:catering-v2s-adapter-android-dual-screen:compileDebugKotlin` 与 `:app:assembleDebug` 完成；`BUILD SUCCESSFUL in 14s`；`exit=0` | focused/Android compile | MATCHED |
| `git diff --check -- apps/terminal/adapter/android/dual-screen` | 无输出；`exit=0` | static | MATCHED |

Gradle 只报告既存的 Android API deprecation warnings（`getMetrics`、`getRealMetrics`、
`scaledDensity` 与 immersive flags），未报告本次 CP-2 的编译错误。APK 安装、明确归属进程
停止和重新启动的原始结果分别为 `adb install -r: Success`、`am force-stop: exit=0`、
`monkey -p com.anonymous.sampleterminal 1: exit=0`。本次 Android 进程为 6629；没有停止未知
进程或其它 Android 资源。

### CP-2 Android raw evidence

本次 Android 设备为 `emulator-5554`。`dumpsys display` 的设备事实为：display 0
`2560×1600`, density `320`；display 2 `1280×720`, density `213`。窗口归属为主屏
`com.anonymous.sampleterminal/.MainActivity` 与副屏 `com.anonymous.sampleterminal` 的
Presentation。原始截图 `/tmp/ter-cp2-primary-before-ime.png` 仅用于确认当前 app 处于可见
运行态；该截图包含既存 LogBox，未把它当作视觉验收证据。

清理 logcat 后重新启动进程 6629，`adb logcat -d -v brief -s TerminalDualScreen:I '*:S'`
得到的关键原始行如下：

```text
I/TerminalDualScreen(6629): event=surface-host-snapshot-ready surfaceKey=SECONDARY generation=1 displayId=2 windowIdentity=secondary orientation=landscape stableWidthPx=1280 stableHeightPx=720 currentWidthPx=1280 currentHeightPx=720 stableWidthLogical=961.5022957581195 stableHeightLogical=540.8450413639423 currentWidthLogical=961.5022957581195 currentHeightLogical=540.8450413639423 densityDpi=213 density=1.3312501 scaledDensity=1.3312501 imeVisible=false imeBottomLogicalBeforeCanvasScale=0.0 source=android-display-context measurementContext=owner-decorView-layout
I/TerminalDualScreen(6629): event=surface-host-snapshot-ready surfaceKey=PRIMARY generation=1 displayId=0 windowIdentity=primary orientation=landscape stableWidthPx=2560 stableHeightPx=1600 currentWidthPx=2560 currentHeightPx=1600 stableWidthLogical=1280.0 stableHeightLogical=800.0 currentWidthLogical=1280.0 currentHeightLogical=800.0 densityDpi=320 density=2.0 scaledDensity=2.0 imeVisible=false imeBottomLogicalBeforeCanvasScale=0.0 source=android-display-context measurementContext=owner-decorView-layout
```

这些是 Android adapter 运行日志，不是 Web、业务画布 transform、视觉或最终命中证据。
两条 READY 记录分别证明每个 owner 的 surface/display/window identity、raw bounds、同源
density conversion、stable/current 值和初始 IME 状态；CP-0 已另行证明当前设备 edge-to-edge
下 IME 前后既有 window layout 不收缩。本步骤没有提前声称 CP-3/CP-4 的 scale、IME 单位或
scroll 行为完成。

### CP-2 阶段三维对账

以下对照原始需求、alignment 详设/实施计划与项目规范/记忆；未以 focused 或 Android 编译
结果替代行为/边界对账。独立子 agent 尚未完成本步骤审查前，CP-2 顶层仍保持待复核状态。

| 对账条目 | 原始需求/源码 | alignment 详设与实施计划 | 项目规范/记忆核对 | 结论 |
| --- | --- | --- | --- | --- |
| per-surface owner | Activity 与 Presentation 的实际 `decorView` layout seam | 详设 §5.1、§5.2.1；计划 CP-2 规则 1-3 | 平台事实由 adapter owner 提供，不把主屏事实复制给副屏 | MATCHED |
| stable/current 分支 | CP-0 既有窗口行为与本次 owner layout raw logs | 详设 §5.2.2；计划 CP-2 规则 2-3 | current 不收缩时走更小 host-ready 路径，不虚构 maximum metrics | MATCHED |
| same-source density | 每条 READY 同时含 owner raw px 与 owner `densityDpi/density` | 详设 §5.2.1；计划 CP-2 规则 2、6 | 不用 `createSurfaceContext` 覆写密度拼接另一来源 bounds | MATCHED |
| identity and lifecycle | display 0/2、primary/secondary、generation=1；remove/destroy 代码路径 | 详设 §5.1、§5.3；计划 CP-2 规则 5 | 不可用 snapshot 清理旧事实，不以 fallback 伪造可用 | MATCHED |
| native-to-JS boundary | 同一 Expo module 的 AsyncFunction/Events | 详设 §5.1；计划 CP-2 规则 4 | 不扩公共 TS port，不创建第二 bridge/React host | MATCHED |
| JS event fence | focused tests 的结果型 accept/reject/clear | 详设 §5.1、§5.3；计划 CP-2 focused proof | mock proof 与 Android proof 分栏，拒绝 stale/wrong identity | MATCHED |
| evidence boundary | typecheck/focused/Android compile/Android raw adapter logs 分栏 | 计划 CP-2 动态出口 | static/focused/Android 不冒充 Web/最终业务视觉结果 | MATCHED |

CP-2_STAGE_RECONCILIATION=MATCHED
CP-2_FINAL=OPEN_PENDING_INDEPENDENT_REVIEW

### CP-2 第 1 轮 fresh 独立只读审查与处置

审查输入：`doc/review/platform/2026-09-08-ter-logical-canvas-cp2-independent-review-checklist-codex.md`。
审查者 Russell（agent `01a08012-abca-7f42-babc-8c53f58cc5c1`）声明为 fresh、只读、未运行命令、
未修改文件。其第 1 轮结论为：

```text
REVIEW_CYCLE_ID=TER_LOGICAL_CANVAS_STRETCH_IMPLEMENTATION_20260908
REVIEW_TARGET=IMPLEMENTATION
REVIEW_SCOPE=CP-2
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
REVIEWER_STATUS=FRESH_READ_ONLY
VERDICT=NO-GO
M/S/N=3/0/0
```

三个 finding 均在 CP-2 范围内，均不需要 Dexter 产品裁决：

| finding | 失败根因 | 主 agent 处置 | 结论 |
| --- | --- | --- | --- |
| M-01 | 同 owner 的 orientation/density/config 变化下，旧 stable raw/logical 值被复用，但新 density 写入 snapshot；generation 虽增加，stable 与 density 已混源 | 抽出 `shouldReuseStableHostContext`；只有同 owner、同 orientation、同 density，且（IME 当前显示或非 IME raw bounds 未变）才复用 stable；否则从本次 owner decorView snapshot 重建 stable/current；增加 JVM focused negative tests 覆盖 orientation、density 与非 IME resize | FIXED |
| M-02 | invalid owner layout 只日志后 return，已有 entry 未清理，JS 仍可读取旧 host | invalid branch 调用 `remove(surfaceIndex, window, "invalid-owner-layout")`；同一 owner 的旧 entry 被清除并发布递增 generation 的 unavailable；无旧 entry 时保持 null，不产生伪造 READY | FIXED |
| M-03 | subscribe 的 event listener 先收到同 generation 新事实时，后到的旧 async initial snapshot 仍可覆盖 | source 增加 `hasAcceptedEvent`；任何已接受事件后 initial snapshot 不再 seed；增加 event-before-initial-resolves 的同 generation focused test | FIXED |

### CP-2 remediation focused evidence

修复后重新执行：

| focused check | 原始结果 | 证据档位 | 结论 |
| --- | --- | --- | --- |
| `yarn workspace @catering-v2s/adapter-android-dual-screen typecheck` | `exit=0` | focused/typecheck | MATCHED |
| `yarn workspace @catering-v2s/adapter-android-dual-screen test` | `1` test file、`6` tests passed；`TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/adapter-android-dual-screen`；`exit=0` | focused | MATCHED |
| `./gradlew :catering-v2s-adapter-android-dual-screen:testDebugUnitTest` | `TerminalSurfaceHostActivityHandlerTest` 编译并执行；`BUILD SUCCESSFUL in 5s`；`exit=0` | focused/Android JVM unit | MATCHED |
| `git diff --check -- apps/terminal/adapter/android/dual-screen ...` | 无输出；`exit=0` | static | MATCHED |

Android JVM focused test 的 3 个测试锁定 stable reuse 的三个反例/边界：IME 导致 current 改变时
stable 可复用；orientation 或 density 改变时 stable 不可复用；非 IME host resize 时 stable 不可
复用。该测试不伪装设备运行，设备 raw snapshot 仍需在修复后 APK 上重跑。

本轮修复没有扩展 public `DevicePort`、`DisplayInfo` 或 `PlatformPortBindings`，没有增加第二
React host/bridge，也没有引入 `maximumWindowMetrics`；仍沿用 CP-0 选定的 owner-decorView-layout
分支。CP-2 在第 2 轮独立复查完成前继续保持 `OPEN_PENDING_INDEPENDENT_REVIEW`。

### CP-2 修复后 Android 重跑

修复后的 APK 重新执行了 assemble、`adb install -r`、明确包名的 `am force-stop`、清理 logcat
和 `monkey -p com.anonymous.sampleterminal 1`；各命令均 `exit=0`，安装输出为 `Success`。
新进程为 6829，采集结束后再次执行同一包名的 `am force-stop`，`exit=0`，未留下本次运行的
Android 应用资源。设备与窗口身份仍为 emulator `emulator-5554`、display 0/Activity 与
display 2/Presentation，显示配置仍为 `2560×1600 @ 320 dpi` 与 `1280×720 @ 213 dpi`。

清理 logcat 后由进程 6829 产生的修复后关键原始行如下：

```text
I/TerminalDualScreen(6829): event=surface-host-snapshot-ready surfaceKey=SECONDARY generation=1 displayId=2 windowIdentity=secondary orientation=landscape stableWidthPx=1280 stableHeightPx=720 currentWidthPx=1280 currentHeightPx=720 stableWidthLogical=961.5022957581195 stableHeightLogical=540.8450413639423 currentWidthLogical=961.5022957581195 currentHeightLogical=540.8450413639423 densityDpi=213 density=1.3312501 scaledDensity=1.3312501 imeVisible=false imeBottomLogicalBeforeCanvasScale=0.0 source=android-display-context measurementContext=owner-decorView-layout
I/TerminalDualScreen(6829): event=surface-host-snapshot-ready surfaceKey=PRIMARY generation=1 displayId=0 windowIdentity=primary orientation=landscape stableWidthPx=2560 stableHeightPx=1600 currentWidthPx=2560 currentHeightPx=1600 stableWidthLogical=1280.0 stableHeightLogical=800.0 currentWidthLogical=1280.0 currentHeightLogical=800.0 densityDpi=320 density=2.0 scaledDensity=2.0 imeVisible=false imeBottomLogicalBeforeCanvasScale=0.0 source=android-display-context measurementContext=owner-decorView-layout
```

这次 Android 运行输出与修复前的 READY 形态一致，说明修复没有破坏当前横屏 owner capture；
它仍只证明 CP-2 adapter snapshot 事实，不能证明 CP-3 canvas transform、CP-4 IME/scroll、
Web policy 或最终视觉验收。

### CP-2 M-02 最小 seam 修复与 focused 复验

第 2 轮独立审查指出：`invalid-owner-layout` 的生产分支已经调用
`remove(surfaceIndex, window, "invalid-owner-layout")`，但 focused proof 没有覆盖 native 侧
清理、代际递增和按 owner/surface 隔离。因此在 CP-2 范围内补了最小的纯状态 seam
`resolveSurfaceHostRemoval`，生产 `TerminalSurfaceHostRegistry.remove` 直接使用该 seam；没有
引入 fallback、兼容层或第二个 registry。其结果只允许两种状态：同 owner 的已有 snapshot 被清除
并产生指定 generation 的 `Unavailable`，或保留已有 snapshot 且不产生事件。

补充的 JVM focused cases 覆盖：

| 反例 | 断言 |
| --- | --- |
| same owner + invalid layout | entry 清除，`Unavailable` 携带 generation+1、surface/display/window identity 与 reason |
| no old entry | snapshot 仍为 null，不产生事件 |
| different owner | 旧 entry 保留，不产生事件 |
| invalidating PRIMARY | SECONDARY entry 完全保持不变 |

修复后的原始结果：`./gradlew :catering-v2s-adapter-android-dual-screen:testDebugUnitTest
--no-daemon --console=plain` 为 `BUILD SUCCESSFUL in 10s`、`exit=0`；JUnit XML 显示
`TerminalSurfaceHostActivityHandlerTest` 共 7 个 testcase，失败数为 0。并行复验的
`yarn workspace @catering-v2s/adapter-android-dual-screen typecheck` 为 `exit=0`，该包
6 个 JS focused tests 全部通过；`./gradlew :app:assembleDebug --no-daemon --console=plain`
为 `BUILD SUCCESSFUL in 12s`、`exit=0`。这些属于 focused/typecheck/Android compile
证据，不是 native invalid-layout 的设备触发证据。

### CP-2 第 2 轮 fresh 独立只读审查（最终轮）

审查输入：`doc/review/platform/2026-09-08-ter-logical-canvas-cp2-independent-review-round2-checklist-codex.md`。
审查者 Euler（agent `01a0801b-ff80-7fb3-b6fe-fda109e2d4cb`）声明为 fresh、只读、未运行命令、
未修改文件；该轮只验证第 1 轮 M-01/M-02/M-03 的闭合，且已达到本 cycle 的第 2/2 轮上限。

```text
REVIEW_CYCLE_ID=TER_LOGICAL_CANVAS_STRETCH_IMPLEMENTATION_20260908
REVIEW_TARGET=IMPLEMENTATION
REVIEW_SCOPE=CP-2
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
REVIEWER_STATUS=FRESH_READ_ONLY
VERDICT=NO-GO
M/S/N=1/0/0
CP-2=OPEN
```

M-01 与 M-03 被独立 reviewer 以 `REJECTED_WITH_EVIDENCE` 认定已闭合；M-02 在第 2 轮被
`CONFIRMED`，原因是此前的 focused proof 未覆盖 native 生成端的 invalid-layout 分支。
主 agent 随后完成上述最小 seam、四项 JVM focused cases、adapter typecheck、JS focused
tests 与 Android assemble 复验，但按照本 cycle 的 `REVIEW_ROUND_LIMIT=2`，不得召集第三轮
reviewer。因此 CP-2 不能写成 MATCHED，当前收口为：

```text
CP-2_STAGE_RECONCILIATION=MATCHED
CP-2_FINAL=OPEN
CP-2_STOP=IMPLEMENTATION_NOT_READY
ROUND_FINAL_DECISION=SELF_DECIDED
```

### CP-2 治理误读纠正

此前把“CP 阶段三维对账的 fresh 独立复核”写成了带有
`REVIEW_CYCLE_ID`、`REVIEW_TARGET=IMPLEMENTATION`、`REVIEW_ROUND` 和
`REVIEW_ROUND_LIMIT` 的正式对抗 review，因而错误地把正式两轮上限套到了 CP-2 阶段闸门。
根因是 checklist/证据命名和字段没有区分两类控制，而不是源码修复不能继续。

现已按 `doc/platform/implementation-task-template.md` 与实施计划第 1 节纠正：阶段复核使用
`STAGE_RECONCILIATION_ID`、`REVIEW_TARGET=CP_STAGE_RECONCILIATION`，只输出逐条
`MATCHED`/`OPEN`，不占用正式 implementation adversarial review cycle 的轮次；任一
`OPEN` 修复后可以重新召集 fresh 独立 reviewer，直到本 CP 只有 `MATCHED`。正式
`REVIEW_TARGET=IMPLEMENTATION` 的两轮上限仍保留，仅用于 CP-8/交付后的对抗审查。

因此，CP-2 第 2 轮正式字段化报告中的 `NO-GO` 作为历史记录保留，不被改写；它不再被当作
CP 阶段对账的最后一次机会。M-02 已完成最小 seam 与 focused 修复，当前重新进行不受正式
轮次上限约束的 CP-2 阶段三维对账，清单为
`doc/review/platform/2026-09-08-ter-logical-canvas-cp2-stage-reconciliation-checklist-codex.md`。

本轮没有进入 CP-3，也没有声称后续 canvas transform、IME/scroll、Web policy、portrait 或
最终视觉验收完成。没有为了继续批次而把主 agent 的修复与测试输出冒充第 3 轮独立复核。

### CP-2 阶段三维对账复核（治理纠正后）

本次是实施步骤级独立对账，不是正式 `REVIEW_TARGET=IMPLEMENTATION` 对抗 review；不占用
正式 cycle 的两轮上限。清单：
`doc/review/platform/2026-09-08-ter-logical-canvas-cp2-stage-reconciliation-checklist-codex.md`。
审查者 Zeno（agent `01a08026-6a2d-7b93-a7ae-81243fccef64`）为 fresh、只读，未运行命令、未修改文件。

```text
STAGE_RECONCILIATION_ID=TER_LOGICAL_CANVAS_STRETCH_CP2_STAGE_20260908
REVIEW_TARGET=CP_STAGE_RECONCILIATION
REVIEW_SCOPE=CP-2
reviewerKind=INDEPENDENT_SUBAGENT
REVIEWER_STATUS=FRESH_READ_ONLY
STAGE_RECONCILIATION=MATCHED
OPEN_COUNT=0
```

逐条结果：

| 对账项 | 结果 | 证据结论 |
| --- | --- | --- |
| invalid-owner-layout 同 owner 清理、generation+1、Unavailable | MATCHED | production `remove` 实际使用 `resolveSurfaceHostRemoval`；发布 identity/reason 正确 |
| 无旧 entry 与错误 owner | MATCHED | 保持 null 或旧 entry，不产生错误事件 |
| PRIMARY/SECONDARY 隔离与 JS unavailable fence | MATCHED | 只删除当前 surface index，另一 surface 保持不变 |
| native seam 与 4 个 focused cases | MATCHED | seam 在生产路径使用；JVM 用例覆盖四类反例 |
| CP-2 公共契约、bridge、density correction 边界 | MATCHED | 未扩公共 TS/平台契约、未建第二 bridge/React host，副屏 density correction 保留 |
| evidence 分档与后续 CP 边界 | MATCHED | focused、compile、Android adapter runtime 分栏；未冒充 invalid-layout 设备触发证据 |
| 需求→详设/计划→项目规范三维闭合 | MATCHED | CP-2 owner/边界/失败恢复与项目阶段对账规则一致 |

```text
CP-2_STAGE_RECONCILIATION=MATCHED
CP-2_FINAL=MATCHED
CP-2_STOP=NONE
```

CP-2 现已满足进入 CP-3 的步骤前置；Web policy 与 portrait hardware profile 仍保持全批
OPEN，不因 CP-2 关闭而声称已完成。

### CP-3 focused implementation evidence

CP-3 的实现范围是 `ui/base/render` 的固定逻辑 canvas/host controller、sample-console 的
结构性 host source 注入、Android sample-terminal 的 adapter source wiring，以及
`startupDiagnostics.dev.test.ts` 的 synthetic 横屏数值同步。没有进入 CP-4 的 IME/scroll，
也没有进入 CP-5 的 Web preview policy、border 或真实浏览器命中验证。

实现事实：

- `ui-base-render` 新增结构型 `SurfaceHostSource`、`SurfaceHostSnapshot` 与
  `calculateSurfaceHostGeometry`；两轴分别按 `stableHostLogicalSize / canvas declaration`
  计算，非法或缺失 host snapshot 返回 pending。
- `SurfaceHostController` 在 host viewport 内创建固定 declaration width/height 的 canvas，
  唯一 transform 使用 `scaleX`、`scaleY` 与 `transformOrigin: top left`；host snapshot 不
  作为 prop 传给 children，`InputSurfaceFrame` 仍保留自己的 `onLayout`。
- sample assembly 只接受结构型 `surfaceHostSources`，把 landscape declaration 与每个
  `DisplayMode` 的 source 交给 `SurfaceRoot`；Android platformPorts 从现有
  `@catering-v2s/adapter-android-dual-screen` source 为 PRIMARY/SECONDARY 分别接线。
- Web 未传 Android source 时显式使用 declaration identity mode（scaleX=scaleY=1），现有
  dev-host 外层 preview geometry 仍留在 CP-5，未在 CP-3 决定 preview policy。
- source 为 null 或收到 unavailable 时，controller 只渲染 pending viewport，不渲染旧 canvas
  或 keyboard 依赖内容；这不是 declaration/旧 snapshot fallback。
- 为使已有 runtime-unavailable → ready 测试在 React 19 下保持合法，`ScreenContainer` 将
  selection effect 改为无条件调用；runtime-unavailable/container-empty 的可见语义没有改变。

CP-3 focused 原始结果（fresh 当前会话，未将其写成 Android/Web 动态证据）：

| check | 原始结果 | 证据档位 | 结论 |
| --- | --- | --- | --- |
| `yarn workspace @catering-v2s/ui-base-render typecheck` | `exit=0` | focused/typecheck | MATCHED |
| `yarn workspace @catering-v2s/ui-base-render test` | `9` test files、`41` tests passed；`TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-base-render`；`exit=0` | focused | MATCHED |
| `yarn workspace @catering-v2s/ui-integration-sample-console typecheck` | `exit=0` | focused/typecheck | MATCHED |
| `yarn workspace @catering-v2s/ui-integration-sample-console test` | `7` test files、`18` tests passed；`TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-integration-sample-console`；`exit=0` | focused | MATCHED |
| `yarn workspace @catering-v2s/adapter-android-dual-screen typecheck` | `exit=0` | focused/typecheck | MATCHED |
| `yarn workspace @catering-v2s/adapter-android-dual-screen test` | `1` test file、`6` tests passed；`TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/adapter-android-dual-screen`；`exit=0` | focused | MATCHED |
| `yarn workspace @catering-v2s/assembly-android-sample-terminal typecheck` | `exit=0` | focused/typecheck | MATCHED |
| `yarn workspace @catering-v2s/kernel-base-platform-ports typecheck` | `exit=0` | focused/typecheck | MATCHED |
| `yarn workspace @catering-v2s/kernel-base-platform-ports test` | `5` test files、`17` tests passed、`1` skipped；`TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-platform-ports`；`exit=0` | focused | MATCHED |
| `git diff --check` | 无输出；`exit=0` | static | MATCHED |

CP-3 focused behavior tests in `renderSurface.test.tsx` cover independent non-uniform axes
(`scaleX=0.75`、`scaleY=600/720`), fixed canvas style/top-left transform, and pending→ready→
unavailable stale-state clearing. These are render/focused proofs only; they do not claim real
Android tap, Android window fill, Web preview policy, IME conversion, scroll coordinates, Web
runtime, or visual/Pixel proof.

Static boundary check in this session:

```text
rg -n "Platform\.OS|Dimensions|scaleX|scaleY" apps/terminal/ui/feature apps/terminal/ui/base/input/src --glob '*.ts' --glob '*.tsx'
exit=1 (no matches)
git diff --check
exit=0
```

The intentional host wiring matches only the adapter→source→render→assembly path:
`createAndroidSurfaceHostSource('PRIMARY'|'SECONDARY')` → `surfaceHostSources` →
`SurfaceRoot canvas/surfaceHostSource` → `SurfaceHostController`. Public DevicePort,
DisplayInfo and PlatformPortBindings remain untouched by CP-3. Web policy and portrait profile
remain OPEN at this point.

### CP-3 阶段三维对账（fresh 独立 reviewer）

阶段清单：
`doc/review/platform/2026-09-08-ter-logical-canvas-cp3-stage-reconciliation-checklist-codex.md`。
本次是步骤级 `CP_STAGE_RECONCILIATION`，不登记正式 `REVIEW_CYCLE_ID`，不受正式
implementation review 两轮上限约束。Wegener（agent
`01a08034-56b3-7cd3-b16e-d8a5f7f25f8d`）为 fresh、只读；允许使用只读命令读取材料，未写文件、
未构建、未测试、未运行 Android/Web/设备或停止进程。

```text
STAGE_RECONCILIATION_ID=TER_LOGICAL_CANVAS_STRETCH_CP3_STAGE_20260908
REVIEW_TARGET=CP_STAGE_RECONCILIATION
REVIEW_SCOPE=CP-3
reviewerKind=INDEPENDENT_SUBAGENT
REVIEWER_STATUS=FRESH_READ_ONLY
STAGE_RECONCILIATION=MATCHED
OPEN_COUNT=0
```

逐条结果：

| 对账项 | 结果 |
| --- | --- |
| CP3-01 固定 declaration canvas 与独立 scaleX/scaleY | MATCHED |
| CP3-02 source 缺失/不可用时清除旧内容 | MATCHED |
| CP3-03 Android adapter→source→render→sample 接线与业务/input 边界 | MATCHED |
| CP3-04 InputSurfaceFrame 自身 onLayout 与 startup.surfaces measured provenance | MATCHED |
| CP3-05 DisplayMode/TR-11/public contract/CP-4/CP-5 边界 | MATCHED |
| CP3-06 Web declaration identity mode 与 CP-5 policy 边界 | MATCHED |
| CP3-07 CP-3 focused/static 证据未过度宣称 Android/Web/IME/scroll/visual | MATCHED |
| CP3-08 React 19 ScreenContainer hook-order 变更保持原可见语义 | MATCHED |

该阶段已闭合，未提前声称 Android 真实 tap/window fill、Web preview policy、IME 换算、scroll
坐标、portrait 或最终视觉完成。

## CP-4 focused implementation evidence

CP-4 的实现范围是 host-owned IME 逻辑单位转换、input 的 content-local scroll seam 与相应
诊断；没有决定 CP-5 的 Web preview policy，也没有把 focused 结果写成 Web/Android 动态结果。

实现事实：

- `SurfaceHostController` 从 host snapshot 读取 target-window 的
  `bottomLogicalBeforeCanvasScale`，只用当前几何的 `scaleY` 计算最终逻辑 inset；未把
  `scaleX`、host snapshot、density 或 physical px 传给 input。
- sample assembly 通过 render-owned `useSurfaceHostImeInset()` 把最终逻辑 inset 送入
  `InputSurfaceFrame`；Android sample 只接现有 per-surface `surfaceHostSources`，旧的独立
  `imeInsetsSources` 不再接线。
- primitives 将 native input 的 `measureLayout` 与 ScrollView 的真实 content node seam
  暴露给 input；`InputScrollArea` 使用 content-local `measureLayout`、自身 viewport
  `onLayout` 与 current content offset 计算 delta，不再以 `measureInWindow` 计算滚动。
- `InputScrollArea` 的诊断记录使用 `logical-layout-unit`，包括 viewport layout、before
  offset、content-local input/viewport rect、delta、requested offset 与后续 `onScroll` offset；
  不记录业务输入值或 raw payload。

本次 focused 原始结果（当前会话，实际运行；均不是 Web/Android 动态证据）：

| check | 原始结果 | 证据档位 | 结论 |
| --- | --- | --- | --- |
| `yarn workspace @catering-v2s/ui-base-primitives typecheck` | `exit=0` | focused/typecheck | MATCHED |
| `yarn workspace @catering-v2s/ui-base-input typecheck` | `exit=0` | focused/typecheck | MATCHED |
| `yarn workspace @catering-v2s/ui-base-render typecheck` | `exit=0` | focused/typecheck | MATCHED |
| `yarn workspace @catering-v2s/ui-integration-sample-console typecheck` | `exit=0` | focused/typecheck | MATCHED |
| `yarn workspace @catering-v2s/adapter-android-dual-screen typecheck` | `exit=0` | focused/typecheck | MATCHED |
| `yarn workspace @catering-v2s/assembly-android-sample-terminal typecheck` | `exit=0` | focused/typecheck | MATCHED |
| `yarn workspace @catering-v2s/ui-base-primitives test` | `1` test file、`8` tests passed；`TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-base-primitives`；`exit=0` | focused | MATCHED |
| `yarn workspace @catering-v2s/ui-base-input test` | `10` test files、`48` tests passed；`TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-base-input`；`exit=0` | focused | MATCHED |
| `yarn workspace @catering-v2s/ui-base-render test` | `9` test files、`43` tests passed；`TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-base-render`；`exit=0` | focused | MATCHED |
| `yarn workspace @catering-v2s/ui-integration-sample-console test` | `7` test files、`18` tests passed；`TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-integration-sample-console`；`exit=0` | focused | MATCHED |
| `yarn workspace @catering-v2s/adapter-android-dual-screen test` | `1` test file、`6` tests passed；`TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/adapter-android-dual-screen`；`exit=0` | focused | MATCHED |
| `git diff --check` | 无输出；`exit=0` | static | MATCHED |
| `rg -n "Platform\\.OS|Dimensions|scaleX|scaleY" apps/terminal/ui/feature apps/terminal/ui/base/input/src --glob '*.ts' --glob '*.tsx'` | 无匹配；`exit=1` | static | MATCHED |

CP-4 focused scroll fixture 的实际断言是：先收到 viewport `300×270`，current offset 为 `100`；
input 相对 content 的 rect 为 `y=530、height=40`，因此逻辑 delta 为 `200`，请求
`scrollTo({y:300, animated:true})`；随后向真实 ScrollView `onScroll` seam 注入 `y=300`，
并断言 `input.scroll-offset` 诊断记录 `offsetY=300`。这是测试中的 native seam 证据，不是
真实设备滚动证据。render fixture 同时断言 `bottomLogicalBeforeCanvasScale=100` 在
`scaleY=2` 时只换算为 `imeInset=50`，并覆盖 `scaleY=0.5` 得到 `200`；这也是 focused
纯函数/渲染证据，不是 Android 系统 IME 证据。

CP-4 尚未产生 Web/Android 动态输出；scale 稳定性、真实系统 IME show/hide、真实滚动、真实
tap、视觉、portrait 与生产 DCE 仍留给计划中的动态/最终验收步骤。

### CP-4 首次阶段审查后的根因修复与复跑

首次 CP-4 阶段 reconciliation 是独立步骤级审查，不受正式 implementation review 两轮上限
约束。Herschel（agent `01a0804b-0883-7f23-88e4-851c7458ba0f`）给出两个 `OPEN`：旧的独立
IME JS/native 消费面仍可见，以及 scroll fixture 没有显式构造外部 `scaleY != 1` 的 host。
主 agent 重新读取 CP-4 详设、CP-4 计划、旧 API 的全部引用者与 fixture 后，按同一根因处理，
没有加兼容层或 fallback：

- 删除无消费者的 `createAndroidImeInsetsSource`、`AndroidImeInsetsSnapshot`、
  `getImeInsetsSnapshot`、`onImeInsetsChanged` 与 `IME_INSETS_CHANGED` 公共消费面；保留
  `TerminalImeInsetsCoordinator` 到统一 `TerminalSurfaceHostRegistry` 的内部 owner→host
  更新链，使 JS 只消费一个 host snapshot。
- `InputScrollArea` focused fixture 用显式外层
  `transform: [{scaleX: 1.25}, {scaleY: 0.5}]` 包住真实 `InputSurfaceFrame`，并保留旧
  `measureInWindow` 路径抛错，以证明测试走的是 content-local seam 而不是被测旧路径。

修复后的 fresh 当前会话 focused/static 输出：

| check | 原始结果 | 证据档位 | 结论 |
| --- | --- | --- | --- |
| `yarn workspace @catering-v2s/ui-base-input test` | `10` test files、`48` tests passed；`TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-base-input`；`exit=0` | focused | MATCHED |
| `yarn workspace @catering-v2s/ui-base-input typecheck` | `exit=0` | focused/typecheck | MATCHED |
| `yarn workspace @catering-v2s/ui-base-primitives test` | `1` test file、`8` tests passed；`TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-base-primitives`；`exit=0` | focused | MATCHED |
| `yarn workspace @catering-v2s/ui-base-render test` | `9` test files、`43` tests passed；`TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-base-render`；`exit=0` | focused | MATCHED |
| `yarn workspace @catering-v2s/ui-integration-sample-console test` | `7` test files、`18` tests passed；`TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-integration-sample-console`；`exit=0` | focused | MATCHED |
| `yarn workspace @catering-v2s/adapter-android-dual-screen test` | `1` test file、`6` tests passed；`TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/adapter-android-dual-screen`；`exit=0` | focused | MATCHED |
| `yarn workspace @catering-v2s/adapter-android-dual-screen typecheck` | `exit=0` | focused/typecheck | MATCHED |
| `yarn workspace @catering-v2s/ui-base-render typecheck` | `exit=0` | focused/typecheck | MATCHED |
| `yarn workspace @catering-v2s/ui-integration-sample-console typecheck` | `exit=0` | focused/typecheck | MATCHED |
| `yarn workspace @catering-v2s/assembly-android-sample-terminal typecheck` | `exit=0` | focused/typecheck | MATCHED |
| `./gradlew :app:compileDebugKotlin --no-daemon` (sample-terminal Android) | `BUILD SUCCESSFUL in 9s`; `212 actionable tasks: 8 executed, 204 up-to-date`; exit `0` | focused/native compile | MATCHED |
| old independent IME public names search | no matches for `createAndroidImeInsetsSource`, `AndroidImeInsetsSnapshot`, `getImeInsetsSnapshot`, `onImeInsetsChanged`, `IME_INSETS_CHANGED` | static | MATCHED |
| `git diff --check` | 无输出；`exit=0` | static | MATCHED |

上述 native compile 不是 Android 设备运行证据；本段没有声称真实 system IME、真实 scroll、真实
tap、Web/Android visual 或生产 DCE 已通过。下一步必须由新的 fresh、只读、独立 CP 阶段 reviewer
重开 CP-4 checklist，核验两项修复及全部 CP-4 闭环；阶段 reviewer 可在仍有 `OPEN` 时继续被召回，
直到 `OPEN_COUNT=0`。

### CP-4 第二次阶段审查与根因修复

新的 Mendel reviewer（agent `01a08054-6c6e-7640-ad19-7fef09743f02`）按
`REVIEW_TARGET=CP_STAGE_RECONCILIATION` fresh、只读复核，未修改、未构建、未测试、未运行
Web/Android/设备。该阶段审查确认 CP4-01、02、03、06、07、08、09 为 `MATCHED`，但发现
两个可复现的实现缺口：

- `PrimitiveInput` 在 native ref 缺失或没有 `measureLayout` 时原来静默结束，未调用 failure
  callback，导致 `InputScrollArea` 无法产生失败诊断。
- `InputScrollArea` 在调用 `scrollTo` 前原来把 requested offset 写入 `currentOffsetRef`；
  native clamp、滚动失败或尚未到达 `onScroll` 时，下一次计算会把请求值误当实际 content offset。

主 agent 按 reviewer 指向的最小根因修复：`PrimitiveInput` 现在显式检测 native seam，不可用时
调用 `onFail?.()` 且不回退 `measureInWindow`；`InputScrollArea` 现在只在实际 `onScroll` 中更新
`currentOffsetRef`，请求值仅进入 diagnostics。新增/调整 focused tests 覆盖缺失 seam 失败回调、
非均匀 host transform、非零实际 offset、未收到实际滚动回调时重复请求仍以旧 actual offset
计算，以及 native offset 改变后按实际值计算。

该 reviewer 的原始阶段结果（保留为首个阶段 OPEN，不以后的绿色结果覆盖）：

```text
STAGE_RECONCILIATION_ID=TER_LOGICAL_CANVAS_STRETCH_CP4_STAGE_20260908
REVIEW_TARGET=CP_STAGE_RECONCILIATION
REVIEW_SCOPE=CP-4
reviewerKind=INDEPENDENT_SUBAGENT
REVIEWER_STATUS=FRESH_READ_ONLY
STAGE_RECONCILIATION=OPEN
OPEN_COUNT=2
CP4-04=OPEN PrimitiveInput missing-measureLayout failure callback
CP4-05=OPEN requested offset written before actual onScroll
```

修复后当前会话 focused/static 复跑原始结果：

| check | 原始结果 | 证据档位 | 结论 |
| --- | --- | --- | --- |
| `yarn workspace @catering-v2s/ui-base-primitives test` | `1` test file、`9` tests passed；`TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-base-primitives`；`exit=0` | focused | MATCHED |
| `yarn workspace @catering-v2s/ui-base-primitives typecheck` | `exit=0` | focused/typecheck | MATCHED |
| `yarn workspace @catering-v2s/ui-base-input test` | `10` test files、`48` tests passed；`TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-base-input`；`exit=0` | focused | MATCHED |
| `yarn workspace @catering-v2s/ui-base-input typecheck` | `exit=0` | focused/typecheck | MATCHED |
| `git diff --check` | 无输出；`exit=0` | static | MATCHED |

第二次阶段审查没有因为首次 `OPEN_COUNT=2` 达到任何轮次上限而结束；修复后必须由另一名
fresh、只读阶段 reviewer 重新核验 CP4-01 至 CP4-09。只有该次返回 `OPEN_COUNT=0` 才能将
CP-4 记录为 `MATCHED` 并允许进入 CP-5；本段仍不声称 Web/Android 动态行为或最终视觉通过。

### CP-4 第三次阶段审查与测试门补强

James 的第二次 fresh 阶段审查返回：CP4-01、02、03、05、06、07、08、09 为 `MATCHED`，
CP4-04 为 `OPEN`，原因不是生产实现错误，而是 focused test 只覆盖了“native ref 存在但
没有 `measureLayout`”且未显式证明不存在 `measureInWindow` fallback，遗漏了 native ref 为
`null` 的分支。

该阶段原始结果保留如下：

```text
STAGE_RECONCILIATION_ID=TER_LOGICAL_CANVAS_STRETCH_CP4_STAGE_20260908
REVIEW_TARGET=CP_STAGE_RECONCILIATION
REVIEW_SCOPE=CP-4
reviewerKind=INDEPENDENT_SUBAGENT
REVIEWER_STATUS=FRESH_READ_ONLY
STAGE_RECONCILIATION=OPEN
OPEN_COUNT=1
CP4-04=OPEN incomplete failure/no-fallback focused coverage
```

主 agent 补齐最小测试门，没有改变生产行为：

- node mock 提供 `measureInWindow` 但不提供 `measureLayout`，断言只调用 `onFail`、不调用
  `measureInWindow`；
- 不提供 node mock，使 native ref 为 `null`，断言 `measureLayout(..., onFail)` 仍调用
  `onFail`；
- 既有 content-local、非零 offset、外部 `scaleX=1.25/scaleY=0.5` 与 actual `onScroll`
  行为断言保持不变。

修复后的当前会话 focused/static 原始输出：

| check | 原始结果 | 证据档位 | 结论 |
| --- | --- | --- | --- |
| `yarn workspace @catering-v2s/ui-base-primitives test` | `1` test file、`10` tests passed；`TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-base-primitives`；`exit=0` | focused | MATCHED |
| `yarn workspace @catering-v2s/ui-base-primitives typecheck` | `exit=0` | focused/typecheck | MATCHED |
| `yarn workspace @catering-v2s/ui-base-input test` | `10` test files、`48` tests passed；`TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-base-input`；`exit=0` | focused | MATCHED |
| `yarn workspace @catering-v2s/ui-base-input typecheck` | `exit=0` | focused/typecheck | MATCHED |
| `git diff --check` | 无输出；`exit=0` | static | MATCHED |

此处仍不把 focused/static 结果写成 Android/Web 动态通过。必须再召回一名 fresh、只读阶段
reviewer，重新逐条核验 CP4-01 至 CP4-09；阶段 review 不设轮次上限，只有 `OPEN_COUNT=0`
才能闭合 CP-4 并继续。

### CP-4 最终阶段对账

第三名 fresh、只读阶段 reviewer Tesla（agent `01a08064-3f41-7f31-a7f4-21a85083e1cc`）
在上一轮测试门补强后重新打开 CP-4 checklist、详设、实施计划、证据与当前源码。该审查不是
正式 implementation review，不受两轮上限；未修改文件、未构建、未测试、未运行 Web/Android/
设备。Reviewer 说明 `ast-grep` 未安装，且本轮未运行 LSP/测试；其结论来自指定材料、源码、
只读 `git diff`/`rg` 与已有分档证据回读。

```text
STAGE_RECONCILIATION_ID=TER_LOGICAL_CANVAS_STRETCH_CP4_STAGE_20260908
REVIEW_TARGET=CP_STAGE_RECONCILIATION
REVIEW_SCOPE=CP-4
reviewerKind=INDEPENDENT_SUBAGENT
REVIEWER_STATUS=FRESH_READ_ONLY
STAGE_RECONCILIATION=MATCHED
OPEN_COUNT=0
CP4-01=MATCHED
CP4-02=MATCHED
CP4-03=MATCHED
CP4-04=MATCHED
CP4-05=MATCHED
CP4-06=MATCHED
CP4-07=MATCHED
CP4-08=MATCHED
CP4-09=MATCHED
```

CP-4 已闭合，允许进入 CP-5；该结论只表示 CP-4 的实现/阶段对账闭合，不表示 Web/Android
动态运行、真实系统 IME、真实 scroll/tap、最终视觉或生产 DCE 已通过。

## CP-5：Web preview viewport 与装饰盒

CP-5_SCOPE=Web preview 的非 policy 基础设施
CP-5_CODEX_SESSION_FRESH=false
CP-5_FOCUSED_RUN_FRESH=true
CP-5_WEB_RUN=NOT_RUN
CP-5_ANDROID_RUN=NOT_RUN
CP-5_WEB_POLICY=OPEN_BY_DEXTER_DECISION
CP-5_IMPLEMENTATION_STATUS=MATCHED_FOR_LOCAL_SCOPE

本阶段没有替 Dexter 选择 Web preview policy。uniform contain、browser 非等比 stretch 与
其它候选仍保持 OPEN；因此本节只记录不依赖该裁决的 viewport 测量和装饰盒实现，不能
把 focused proof 写成 Web 运行或最终视觉通过。

### CP-5 实施观察

| 代码锚点 | 实施观察 | 结论（独立阶段对账前） |
| --- | --- | --- |
| `apps/terminal/ui/base/dev-host/src/components/testExpoApp.tsx` 第 165-198 行 | geometry 的输入状态来自 `preview-viewport` 的 `onLayout`；outer canvas 只做诊断，不再把带 border 的宽度反推为可用宽度 | MATCHED |
| 同文件第 259-281 行 | 新增 `testID=:canvas:preview-viewport` 的无 border 节点；该节点通过 margin 排除 canvas border 与 stage padding，直接把实际 content width 交给 geometry | MATCHED |
| 同文件第 213-244 行 | dev-only geometry diagnostics 同时记录 `canvasRect`、`previewViewportRect`、logical/stage/surface rect 与 viewport facts | MATCHED |
| 同文件第 304-339、826-850 行 | surface wrapper 保留背景与裁切，但移除 border；border 改为 surface 内 `position: absolute`、`pointerEvents="none"` 的 decoration，wrapper 加 `position: relative` 作为定位 containing block | MATCHED |
| `apps/terminal/ui/base/dev-host/src/foundations/surfacePreview.ts` 第 22-60 行 | geometry 函数消费已测量的 preview content width，不再重复扣 canvas border/stage padding；stage declaration 与 preview policy 仍分离 | MATCHED |
| `apps/terminal/ui/base/dev-host/test/testExpoApp.test.tsx` 第 86-154 行 | focused fixture 先提供 canvas 与 preview viewport 两个不同 layout；断言逻辑 surface 仍为原始尺寸、wrapper 无 border、decoration 为绝对定位且 resize 重新计算缩放 | MATCHED |
| `apps/terminal/ui/base/dev-host/test/surfacePreview.test.ts` 第 8-61 行 | focused geometry fixture 明确传入 content rect width；逻辑尺寸、排列 gap 与 scale 计算结果保持既有语义 | MATCHED |

### CP-5 focused 原始输出

执行会话：`CP5_FOCUSED_RUN_FRESH=true`；为本阶段新启动的命令进程；未启动浏览器、
Android、DEV、seed、UAT 或部署。

```text
$ yarn workspace @catering-v2s/ui-base-dev-host typecheck
exit=0
stdout/stderr: empty

$ yarn workspace @catering-v2s/ui-base-dev-host test
 RUN  v4.1.10 /Users/dexter/Documents/workspace/idea/catering-v2s/apps/terminal/ui/base/dev-host
 Test Files  4 passed (4)
      Tests  11 passed (11)
   Start at  18:57:40
   Duration  589ms (transform 775ms, setup 372ms, import 1.05s, tests 24ms, environment 0ms)
 TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-base-dev-host
 exit=0

$ git diff --check -- apps/terminal/ui/base/dev-host
exit=0
stdout/stderr: empty
```

focused 输出只证明 dev-host 的类型和本地测试行为；没有产生 browser viewport、CSS rect、
elementFromPoint、scaleX/scaleY 或真实 Web 命中证据。`CP5_WEB_RUN=NOT_RUN` 保持不变。

### CP-5 阶段对账结果

本次阶段对账使用独立的阶段审查类型，不是正式 implementation review，因此不受正式
两轮上限约束：

```text
STAGE_RECONCILIATION_ID=TER_LOGICAL_CANVAS_STRETCH_CP5_STAGE_20260908
REVIEW_TARGET=CP_STAGE_RECONCILIATION
REVIEW_SCOPE=CP-5
REVIEW_ROUND_LIMIT=NOT_APPLICABLE
reviewerKind=INDEPENDENT_SUBAGENT
REVIEWER_STATUS=FRESH_READ_ONLY

CP5-01=MATCHED
CP5-02=MATCHED
CP5-03=MATCHED
CP5-04=MATCHED
CP5-05=MATCHED
CP5-06=MATCHED
CP5-07=OPEN_BY_DEXTER_DECISION
STAGE_RECONCILIATION=MATCHED_FOR_LOCAL_SCOPE
OPEN_COUNT=0
```

Reviewer `01a0808b-1e33-7b03-bd40-0bddf48fc253` 为 fresh、只读独立阶段 reviewer；未修改
文件，未构建、未测试、未运行 Web/Android。其只读核验使用了 `rg`、`sed`、`nl` 与
`git diff --check`，后者无输出。该 reviewer 确认 preview viewport 是内部无 border
测量节点，装饰层是 absolute 且 `pointerEvents="none"`，sample-console 覆盖了真实
`SurfaceRoot -> renderContentFrame -> SurfaceInputFrame -> InputSurfaceFrame` 接缝，
width-only 公式仍明确标为待裁决前的候选，且逻辑点映射 helper 只有 policy-neutral 的
focused 正/反例。`CP5-05` 的真实 dev-only logger payload 与 `CP5-06` 的真实
`elementFromPoint` 仍属于 CP-7 Web 动态证据，不能由本次阶段对账冒充已运行。

因此，CP-5 的本地可实施范围已完成阶段对账并闭合；`CP5-07` 仍是 Dexter 外部裁决项，
不代表 Web policy 或真实 Web 命中已完成。

### CP-5 阶段对账入口

阶段对账清单：
`doc/review/platform/2026-09-08-ter-logical-canvas-cp5-stage-reconciliation-checklist-codex.md`。

本阶段 reviewer 必须使用 `REVIEW_TARGET=CP_STAGE_RECONCILIATION`、
`REVIEW_ROUND_LIMIT=NOT_APPLICABLE`、`reviewerKind=INDEPENDENT_SUBAGENT`；这不是正式
`REVIEW_TARGET=IMPLEMENTATION`，不受正式两轮上限限制。若发现可修复 OPEN，主 agent 修复
后重新召集 fresh reviewer；只有 CP5-01 至 CP5-06 全部没有 OPEN 才能把非 policy 部分
写成阶段 MATCHED。CP5-07 在 Dexter 裁决前必须保持 `OPEN_BY_DEXTER_DECISION`。

## CP-6：文档、基线回读与阶段材料对账

CP-6_SCOPE=文档、旧材料语义回读、portrait 未决边界与测试基线回读
CP-6_CODEX_SESSION_FRESH=false
CP-6_STATIC_SCAN_FRESH=true
CP-6_FOCUSED_RUN=NOT_APPLICABLE
CP-6_WEB_RUN=NOT_RUN
CP-6_ANDROID_RUN=NOT_RUN
CP-6_WEB_POLICY=OPEN_BY_DEXTER_DECISION
CP-6_PORTRAIT=OPEN_BY_DEXTER_DECISION

CP-6 只修正与当前固定逻辑画布实现相冲突的历史材料表述和路径锚点，没有修改源码、
测试、依赖、Android 实现或 Web policy。portrait hardware profile 与 Web preview policy
仍按授权保持 OPEN；本阶段不得把它们写成已决定或运行通过。

### CP-6 实施观察

| 对账范围 | 实施观察 | 结论（独立阶段对账前） |
| --- | --- | --- |
| surface-form 需求的当前语义 | 冻结期旧 shape、旧静态桥接与旧路径已明确标为 CP-1 之前的历史事实；当前实现锚点改为 `src/application/terminalSurfaces.ts`、`src/assembly/assembly.tsx`、`InputSurfaceFrame` 自己的 `onLayout` 与 dev-host `preview-viewport` | MATCHED |
| input keyboard 旧计划/详设 | `InputSurfaceFrame` 不再接收或读取 surface declaration 作为运行时高度；键盘计算使用自身 `onLayout` 的 measured frame，固定画布声明只由承载层消费 | MATCHED |
| 旧计划与旧详设路径 | assembly、terminalSurfaces、dev-host 的路径均回读到当前 `src/application`、`src/assembly`、`src/components` 位置；没有保留旧路径作为当前实现指引 | MATCHED |
| keyboard visual requirements | secondary keyboard 的基准改为 `InputSurfaceFrame` local measured frame；没有把 host canvas declaration 下发到 input | MATCHED |
| README 边界 | adapter README 保持 display metrics、owner window 与副屏边界；dev-host README 保持 preview viewport 与 Web policy 待裁决；sample README 不引入已退役的两套基线 | MATCHED |
| 1280×800 / 1280×720 高度表 | 旧文档中仍存在的数字只作为明确的历史/实现推导记录；运行时 input 语义不再以 surface declaration 直接作为 measured frame | MATCHED |
| portrait 与 Web policy | 没有伪造竖屏 profile，也没有擅自选 contain 或 browser stretch | OPEN_BY_DEXTER_DECISION |
| CP-0A 至 CP-5 证据边界 | 阶段证据继续区分 static、focused、Web、Android；CP-5 只闭合 policy-neutral 的本地范围，未增加动态声明 | MATCHED |

### CP-6 静态核验原始输出

以下命令由当前会话新启动的静态命令进程执行；输出为空的命令保留 `exit` 作为原始结果。
历史材料中的禁令、supersede 说明和被裁定的旧事实没有被误删，因此扫描只针对“仍被当作
当前实现语义”的旧 shape、旧路径和旧静态桥接。

```text
$ rg -n 'terminalSurfaces\.surfaces|src/terminalSurfaces\.ts|src/assembly\.tsx|src/testExpoApp\.tsx|副屏虚拟键盘使用 surface 声明尺寸|surface 声明尺寸和现有公式' doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-plan-codex.md doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-design-codex.md doc/plans/platform/2026-09-06-v2s-terminal-input-surface-form-requirements-codex.md doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-codex.md
exit=1
stdout/stderr: empty

$ rg -n 'terminalSurfaces\.orientations\.landscape|InputSurfaceFrame|onLayout|OPEN_BY_DEXTER_DECISION|1280[×x]800|1280[×x]720|surfaceSize' doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-plan-codex.md doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-design-codex.md doc/plans/platform/2026-09-06-v2s-terminal-input-surface-form-requirements-codex.md doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-codex.md
exit=0
stdout/stderr: only expected current anchors, explicit prohibition/history, and OPEN markers

$ rg -n 'src/application/terminalSurfaces\.ts|src/assembly/assembly\.tsx|src/components/testExpoApp\.tsx|preview-viewport' doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-plan-codex.md doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-design-codex.md doc/plans/platform/2026-09-06-v2s-terminal-input-surface-form-requirements-codex.md
exit=0
stdout/stderr: canonical current paths present

$ git diff --check -- doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-design-codex.md doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-plan-codex.md doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-codex.md doc/plans/platform/2026-09-06-v2s-terminal-input-surface-form-requirements-codex.md
exit=0
stdout/stderr: empty
```

CP-6 的静态命令没有启动浏览器、Android、DEV、seed、UAT 或部署，也没有生成 Web/Android
运行证据。`surfaceSize` 的命中若出现在历史禁止项或回顾性材料中，不等于当前生产路径仍
使用它；当前 input 运行语义以 `InputSurfaceFrame.onLayout` 为准。

### CP-6 阶段对账入口

阶段对账清单：
`doc/review/platform/2026-09-08-ter-logical-canvas-cp6-stage-reconciliation-checklist-codex.md`。

本阶段必须使用独立阶段审查类型：
`STAGE_RECONCILIATION_ID=TER_LOGICAL_CANVAS_STRETCH_CP6_STAGE_20260908`、
`REVIEW_TARGET=CP_STAGE_RECONCILIATION`、`REVIEW_ROUND_LIMIT=NOT_APPLICABLE`、
`reviewerKind=INDEPENDENT_SUBAGENT`。它不是正式 `REVIEW_TARGET=IMPLEMENTATION`，因此不受
正式实施 review 两轮上限。若 fresh reviewer 发现可由主 agent 修复的 OPEN，主 agent 修复
后继续召回 fresh reviewer，直到 CP-6 本地项没有 OPEN；portrait 与 Web policy 只能保持
`OPEN_BY_DEXTER_DECISION`，不能被阶段 reviewer 自行裁决。

### CP-6 第一次阶段对账与根因处置

第一次 fresh、只读阶段 reviewer Halley（agent `01a08095-16fd-7302-a7e0-cca334d5f828`）
按 `CP_STAGE_RECONCILIATION` 对账后返回以下原始结果。该阶段审查不是正式 implementation
review，不受正式两轮上限；因此本地 OPEN 出现后继续修复并重新召回 fresh reviewer。

```text
STAGE_RECONCILIATION_ID=TER_LOGICAL_CANVAS_STRETCH_CP6_STAGE_20260908
REVIEW_TARGET=CP_STAGE_RECONCILIATION
REVIEW_SCOPE=CP-6
REVIEW_ROUND_LIMIT=NOT_APPLICABLE
reviewerKind=INDEPENDENT_SUBAGENT
FRESH_READ_ONLY=YES
NO_WRITE=YES
NO_BUILD_TEST_WEB_ANDROID=YES
STAGE_RECONCILIATION=OPEN
OPEN_COUNT=2
EXTERNAL_OPEN_BY_DEXTER_DECISION=1

CP6-01=MATCHED
CP6-02=MATCHED
CP6-03=MATCHED
CP6-04=OPEN
CP6-05=MATCHED
CP6-06=MATCHED
CP6-07=MATCHED
CP6-08=OPEN_BY_DEXTER_DECISION
CP6-09=MATCHED
CP6-10=MATCHED
CP6-11=OPEN
CP6-12=MATCHED
```

根因是 CP-6 初始扫描遗漏了仍作为有效 implementation design 的
`doc/plans/platform/2026-09-06-v2s-terminal-input-surface-and-keyboard-implementation-design-codex.md`。
该文件还保留了旧的 `src/testExpoApp.tsx`、`sample-console/src/assembly.tsx` 与
`terminalSurfaces.surfaces[displayMode]` 有效锚点。主 agent 已回读 owning source，
将它们修正为 `src/components/testExpoApp.tsx`、`src/assembly/assembly.tsx` 与
`terminalSurfaces.orientations.landscape`，并把该文件加入 CP-6 输入清单与扫描分母。

### CP-6 修复后的扩大静态核验

```text
$ rg -n 'src/testExpoApp[.]tsx|src/assembly[.]tsx|terminalSurfaces[.]surfaces|副屏虚拟键盘使用 surface 声明尺寸|surface 声明尺寸和现有公式' doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-plan-codex.md doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-design-codex.md doc/plans/platform/2026-09-06-v2s-terminal-input-surface-form-requirements-codex.md doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-codex.md doc/plans/platform/2026-09-06-v2s-terminal-input-surface-and-keyboard-implementation-design-codex.md
exit=1
stdout/stderr: empty

$ rg -n 'src/components/testExpoApp[.]tsx|src/assembly/assembly[.]tsx|src/application/terminalSurfaces[.]ts|terminalSurfaces[.]orientations[.]landscape|InputSurfaceFrame.*onLayout|preview-viewport' doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-plan-codex.md doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-design-codex.md doc/plans/platform/2026-09-06-v2s-terminal-input-surface-form-requirements-codex.md doc/plans/platform/2026-09-06-v2s-terminal-input-surface-and-keyboard-implementation-design-codex.md
exit=0
stdout/stderr: canonical current paths and local-measurement anchors present

$ git diff --check -- doc/plans/platform/2026-09-06-v2s-terminal-input-surface-and-keyboard-implementation-design-codex.md doc/review/platform/2026-09-08-ter-logical-canvas-cp6-stage-reconciliation-checklist-codex.md
exit=0
stdout/stderr: empty
```

上述修复只改变文档锚点与 CP-6 扫描分母，没有改变源码、测试、依赖、Android 或 Web policy。
本记录等待下一名 fresh 阶段 reviewer 对 CP6-04/CP6-11 复核；CP6-08 仍只能保持
`OPEN_BY_DEXTER_DECISION`。

### CP-6 第二次阶段对账结果

第二名 fresh、只读阶段 reviewer Schrodinger（agent `01a0809a-3078-7101-972f-92726d60bf7a`）
在主 agent 修复遗漏的 2026-09-06 implementation design 并扩大扫描分母后重新打开当前
checklist、证据、详设、计划、README 与 owning source。该审查使用阶段对账类型，不是正式
implementation review，`REVIEW_ROUND_LIMIT=NOT_APPLICABLE`。

```text
STAGE_RECONCILIATION_ID=TER_LOGICAL_CANVAS_STRETCH_CP6_STAGE_20260908
REVIEW_TARGET=CP_STAGE_RECONCILIATION
REVIEW_SCOPE=CP-6
REVIEW_ROUND_LIMIT=NOT_APPLICABLE
reviewerKind=INDEPENDENT_SUBAGENT
FRESH_READ_ONLY=YES
NO_WRITE=YES
NO_BUILD_TEST_WEB_ANDROID=YES
STAGE_RECONCILIATION=MATCHED_FOR_LOCAL_SCOPE
OPEN_COUNT=0
remaining findings=NONE_LOCAL
EXTERNAL_OPEN_BY_DEXTER_DECISION=CP6-08

CP6-01=MATCHED
CP6-02=MATCHED
CP6-03=MATCHED
CP6-04=MATCHED
CP6-05=MATCHED
CP6-06=MATCHED
CP6-07=MATCHED
CP6-08=OPEN_BY_DEXTER_DECISION
CP6-09=MATCHED
CP6-10=MATCHED
CP6-11=MATCHED
CP6-12=MATCHED
```

Reviewer 复核确认：2026-09-06 有效 implementation design 已进入 CP-6 扫描分母；旧
`src/testExpoApp.tsx`、`src/assembly.tsx`、`terminalSurfaces.surfaces` 模式在扩大分母中
无命中；当前 canonical path 与 `InputSurfaceFrame` 自身 `onLayout` 命中。`surfaceSize`
只保留在删除、禁止、历史或替代语义中，未作为生产 public input。CP-6 仍未启动 build、test、
Web、Android、DEV、seed、UAT 或 deployment。

因此 CP-6 本地阶段闭合，允许进入 CP-7。CP6-08（portrait profile 与 Web preview policy）
仍是 Dexter 外部决策项，不由阶段 reviewer 自行裁决，也不阻断横屏可运行证据。

## CP-7：生产与端到端证据

CP-7_STATUS=OPEN_PENDING_STAGE_RECONCILIATION
CP-7_STAGE_RECONCILIATION_ID=TER_LOGICAL_CANVAS_STRETCH_CP7_STAGE_20260908
CP-7_REVIEW_TARGET=CP_STAGE_RECONCILIATION
CP-7_REVIEW_ROUND_LIMIT=NOT_APPLICABLE
CP-7_CODEX_SESSION_FRESH=false
CP-7_WEB_SESSION_FRESH=true
CP-7_ANDROID_RUN_FRESH=true
CP-7_DEVICE_SERIAL=emulator-5554
CP-7_DISPLAY_CONFIG=`display 0: 2560×1600 @ 320 dpi`; `display 2: 1280×720 @ 213 dpi, virtual FLAG_PRESENTATION`
CP-7_WEB_POLICY=OPEN_BY_DEXTER_DECISION
CP-7_PORTRAIT_PROFILE=OPEN_BY_DEXTER_DECISION

本节按 static、focused、Web、Android 分开记录。`CP_STAGE_RECONCILIATION` 是实施步骤级
对账类型，不是正式 `REVIEW_TARGET=IMPLEMENTATION`；本阶段 reviewer 没有正式两轮上限。
下列 `OPEN` 是本轮真实证据或当前设备能力边界，不能被静态结论、预期数字或模型夹具
改写成通过。

### CP-7 focused 与 static 原始结果

#### input diagnostics 的生产 DCE 修复

首次 fresh Web export 的原始输出为 `exit=0`，但 bundle 中仍命中以下 dev-only event
字符串：`input.surface-frame-layout`、`input.content-layout`、`input.scroll-viewport-layout`、
`input.scroll-into-view`、`input.scroll-offset`。这是 CP-7 的首败，证明仅在 sample logger
内部 no-op 不足以保证 production bundle DCE。

根因是 `InputSurfaceFrame.tsx` 与 `InputScrollArea.tsx` 在生产模块图中仍无条件保留
diagnostic callback 调用点。主 agent 将这些调用统一包在 `__DEV__ && callback !== undefined`
分支中；`apps/terminal/ui/base/input/test/scrollArea.test.tsx` 中对应 diagnostic assertions
只在 `__DEV__` 下执行，保留所有 scroll behavior assertions。没有改变业务断言语义，也没有
给 production graph 引入 fallback。

修复后的 fresh export 原始输出：

```text
$ npx expo export --platform web --output-dir /tmp/ter-cp7-web-export.mixLOt
Web Bundled 936ms apps/terminal/assembly/android/sample-terminal/index.ts (616 modules)
web bundles: CSS 9.3KB, JS 998KB
Exported: /tmp/ter-cp7-web-export.mixLOt
exit=0

$ rg -n 'web[.]surface-geometry|web[.]react-layout|input[.]surface-frame-layout|input[.]content-layout|input[.]scroll-viewport-layout|input[.]scroll-into-view|input[.]scroll-offset|render[.]surface-host-layout' /tmp/ter-cp7-web-export.mixLOt/_expo/static/js/web/index-ad7158d4e9e6df10ff2597ac2d02fc2a.js
stdout/stderr: empty
web.surface-geometry ABSENT
web.react-layout ABSENT
input.surface-frame-layout ABSENT
input.content-layout ABSENT
input.scroll-viewport-layout ABSENT
input.scroll-into-view ABSENT
input.scroll-offset ABSENT
render.surface-host-layout ABSENT
exit=0
```

对应 focused 检查：

```text
$ yarn workspace @catering-v2s/ui-base-input typecheck
exit=0

$ yarn workspace @catering-v2s/ui-base-input test
Test Files 10 passed (10)
Tests 48 passed (48)
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-base-input
exit=0

$ yarn workspace @catering-v2s/adapter-android-dual-screen typecheck
exit=0

$ yarn workspace @catering-v2s/adapter-android-dual-screen test --run test/surfaceHost.test.ts
Test Files 1 passed (1)
Tests 7 passed (7)
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/adapter-android-dual-screen
exit=0
```

adapter broadcast 修复的 focused 行为证据：native module 把 PRIMARY 与 SECONDARY 事件
广播给两个 source listener 时，合法的另一 surface 事件由非对应 source 静默忽略；对应
source 仍执行自身的 generation/display/window fence；stale、wrong-display、wrong-window
仍拒绝。测试不是调用次数或字符串证明，而是检查 primary snapshot 更新、secondary snapshot
不被污染、`console.error` 为空。该修复落点为
`apps/terminal/adapter/android/dual-screen/src/implementations/surfaceHost.ts`，测试为
`apps/terminal/adapter/android/dual-screen/test/surfaceHost.test.ts`。

#### focused/模型与生产边界

CP-7 没有把模型 red fixture 的 FAIL 写成生产 FAIL。生产 DCE 是真实 Expo export；red fixture
仍只用于验证门能击穿错误实现，需在后续交付 brief 中与生产结果分栏。Web/Android 的
environment errors 也不归入画布业务结果：Web console 的 protected-storage adapter 未注入、
`BackHandler` web unsupported、dark-mode media warning 与 password-form warning；Android
sample 的 protected-storage persistence failure 与 display-context power bridge unavailable。
这些说明样例环境缺少既有适配器能力，不是本次 canvas geometry 的成功证据，也没有被本轮
用兼容层或 fallback 掩盖。

### CP-7 Web 真实运行证据

会话：`ter-cp7-web-20260908`，fresh headed Playwright session；启动命令为
`/Users/dexter/.codex/skills/playwright/scripts/playwright_cli.sh --session ter-cp7-web-20260908 open http://localhost:8082/ --headed`。
Web 会话初始 `innerWidth=1200`、`innerHeight=918`、DPR=2、`visualViewport.scale=1`；
宽窄场景之后均在同一 fresh browser session 中重新设置 viewport，并记录真实 DOM、
console 与 pointer 命中。

#### 宽窗口（双 surface）

viewport 取 `1400×1000`，`devicePixelRatio=1`，真实 console 记录：

```text
startupRunId=terminal-startup-1788864401664-1
web.surface-geometry showSecondary=false stageWidth=1280 stageHeight=800 scale=1 rendered=1280×800
input.surface-frame-layout PRIMARY width=1280 height=800 declared=1280×800
startup.surfaces.measured PRIMARY deltaWidth=0 deltaHeight=0
web.surface-geometry showSecondary=true stageWidth=1280 stageHeight=1532 scale=1 rendered=1280×1532
input.surface-frame-layout PRIMARY width=1280 height=800 declared=1280×800
input.surface-frame-layout SECONDARY width=1280 height=720 declared=1280×720
startup.surfaces.measured PRIMARY deltaWidth=0 deltaHeight=0
startup.surfaces.measured SECONDARY deltaWidth=0 deltaHeight=0
render.surface-host-layout canvas=1280×800 host=1280×800 scaleX=1 scaleY=1 imeVisible=false imeInset=0
render.surface-host-layout canvas=1280×720 host=1280×720 scaleX=1 scaleY=1 imeVisible=false imeInset=0
```

真实 DOM rect 与逻辑结构：canvas `1344×1556`（含外部装饰/留白），preview viewport
`x=40,y=112,width=1320,height=1532`，logical stage `x=60,y=112,width=1280,height=1532`
且 transform matrix 为 identity；PRIMARY `x=60,y=112,width=1280,height=800`，SECONDARY
`x=60,y=924,width=1280,height=720`。这里 `scale=1` 是该 viewport 的事实，不是把 policy
写成已裁决。

宽窗口上以登录按钮中心做真实 `elementFromPoint` 和 `page.mouse.click`，owner 为
`sample.auth.login:submit`。未用 props、调用次数或字符串搜索证明命中。

#### 窄窗口（双 surface）

viewport 取 `800×1000`，`devicePixelRatio=1`。真实 DOM/console 记录：

```text
viewport=800×1000
preview viewport CSS=720×861.75
logical stage transform=matrix(0.5625,0,0,0.5625,0,0)
primary CSS rect=720×450
secondary CSS rect=720×405
logical React input frames PRIMARY=1280×800 SECONDARY=1280×720
startup.surfaces.measured PRIMARY deltaWidth=0 deltaHeight=0
startup.surfaces.measured SECONDARY deltaWidth=0 deltaHeight=0
web.surface-geometry scale=0.5625 renderedPrimary=720×450 renderedSecondary=720×405
elementFromPoint owner=sample.auth.login:submit
realMouseClick=true
startupRunId=terminal-startup-1788864430346-1
```

这证明当前 width-only candidate 下的真实窄窗映射与逻辑命中链路；它不证明 Web preview
policy 已由 Dexter 裁决，也不证明 Web 应采用 contain 或 browser 非等比 stretch。该外部
决策继续记录为 `OPEN_BY_DEXTER_DECISION`。

### CP-7 Android 真实运行证据

`CP-7_HISTORICAL_SNAPSHOT=TRUE`。本节及其原始输出记录的是旧 target-density 过程，不能用来
解释当前 SECONDARY 的 render density、逻辑尺寸或残差；当前解释以文件末尾
`SHARED_RN_RENDER_DENSITY_20260909` addendum 为准。

#### fresh build/install/launch 与 display facts

最终 broadcast-fix APK 使用以下 fresh command 重新构建、安装、清 logcat 并启动：

```text
$ ./gradlew :app:assembleDebug --no-daemon --console=plain
BUILD SUCCESSFUL in 12s
352 actionable tasks: 39 executed, 313 up-to-date
exit=0

$ adb -s emulator-5554 install -r app/build/outputs/apk/debug/app-debug.apk
Success

$ adb -s emulator-5554 shell am force-stop com.anonymous.sampleterminal
exit=0

$ adb -s emulator-5554 shell monkey -p com.anonymous.sampleterminal 1
Events injected: 1
exit=0
```

该 run 的 native log 原始文件为 `/tmp/ter-cp7-android-after-broadcast-fix.log`，JS/LogBox
关联输出为 `/tmp/ter-cp7-android-final.log`。设备事实由 `adb devices -l`、`wm size`、
`wm density` 与 `dumpsys display` 取得：display 0 为内置主屏 `2560×1600 @ 320 dpi`；
display 2 为 `1280×720 @ 213 dpi` 的 virtual `FLAG_PRESENTATION` display。窗口身份为
PRIMARY `com.anonymous.sampleterminal/.MainActivity` 与 SECONDARY Presentation。

#### adapter host snapshot 与 JS layout

最终 fresh native 输出：

```text
event=secondary-react-surface-layout displayId=2 widthPx=1280 heightPx=720 densityDpi=213 density=1.3312501 logicalWidth=961.5023 logicalHeight=540.84503
event=secondary-presentation-window-layout displayId=2 widthPx=1280 heightPx=720 densityDpi=213 density=1.3312501 logicalWidth=961.5023 logicalHeight=540.84503
event=surface-host-snapshot-ready surfaceKey=SECONDARY generation=1 displayId=2 windowIdentity=secondary stableWidthPx=1280 stableHeightPx=720 currentWidthPx=1280 currentHeightPx=720 stableWidthLogical=961.5022957581195 stableHeightLogical=540.8450413639423 currentWidthLogical=961.5022957581195 currentHeightLogical=540.8450413639423 densityDpi=213 source=android-display-context measurementContext=owner-decorView-layout
event=primary-window-layout displayId=0 widthPx=2560 heightPx=1600 densityDpi=320 logicalWidth=1280 logicalHeight=800
event=surface-host-snapshot-ready surfaceKey=PRIMARY generation=1 displayId=0 windowIdentity=primary stableWidthPx=2560 stableHeightPx=1600 currentWidthPx=2560 currentHeightPx=1600 stableWidthLogical=1280.0 stableHeightLogical=800.0 currentWidthLogical=1280.0 currentHeightLogical=800.0 densityDpi=320 source=android-display-context measurementContext=owner-decorView-layout
event=secondary-start-completed
```

最终 JS 输出的关键几何事实：

```text
startup.surfaces.declared SECONDARY=1280×720
input.surface-frame-layout SECONDARY width=1279.9998779296875 height=720.3755493164062 declared=1280×720
startup.surfaces.measured SECONDARY deltaWidth=-0.0001220703125 deltaHeight=0.37554931640625
render.surface-host-layout SECONDARY canvas=1280×720 host=961.5022957581195×540.845... scaleX=0.7511736685610308 scaleY=0.751173668561031 imeVisible=false imeInset=0
startup.surfaces.declared PRIMARY=1280×800
input.surface-frame-layout PRIMARY width=1280 height=800 declared=1280×800
startup.surfaces.measured PRIMARY deltaWidth=0 deltaHeight=0
render.surface-host-layout PRIMARY canvas=1280×800 host=1280×800 scaleX=1 scaleY=1 imeVisible=false imeInset=0
```

SECONDARY `height=720.3755493164062` 是 RN Android 在 `densityDpi=213` 下将 720 logical
units 映射/量化到 native pixels 后回报的真实残差，不得通过 JS 四舍五入、改 declaration
或放宽判据隐藏。由于当前详设 A 要求 delta 逐轴为 0，这一条目前是 `OPEN`，需要 Dexter
决定是否接受与平台量化一致的精度，或给出能真实达到 exact-zero 的承载/测量契约；本 agent
不自行改判据。

#### Android primary 业务与键盘真实画面

最终清理提示条后保存：

- `/tmp/ter-cp7-android-after-fix-clean.png`：primary member list，`已登记会员`、Alice
  行与新增/退出操作可见，无 LogBox 遮挡。
- `/tmp/ter-cp7-android-after-fix-financial-clean.png`：primary 新增会员表单与金额键盘，
  画布未被错误 rejection banner 遮挡；键盘为 4 行一行高度布局。
- UIAutomator `/tmp/ter-cp7-final-ui.xml`：真实层级确认金额键盘 action 区域中 `-`、`.`、`0`、
  `⌫`、`完成`；`⌫` 与 `完成` 在最右侧，均位于最后一行，退格 bounds 为
  `[1712,1486][2120,1582]`，完成 bounds 为 `[2136,1486][2544,1582]`。

这是 primary 的真实业务/呈现证据，不是 secondary 像素证据。sample 仍报告既有
protected-storage persistence failure；该环境问题单独分类，未把它写成 TER canvas failure。

#### IME show/hide round trip

同一 primary window identity 的 fresh interaction 先聚焦姓名输入框打开系统 Gboard，再用
Android back 隐藏。原始日志中：

```text
before: render.surface-host-layout PRIMARY canvas=1280×800 host=1280×800 scaleX=1 scaleY=1 imeVisible=false imeInset=0
show:   event=ime-insets window=primary displayId=0 visible=true bottomPx=736 bottomLogical=368.0
show:   event=surface-host-snapshot-ready surfaceKey=PRIMARY stable/current=2560×1600 logical=1280×800 imeVisible=true imeBottomLogicalBeforeCanvasScale=368
show:   render.surface-host-layout PRIMARY scaleX=1 scaleY=1 imeVisible=true imeInset=368
hide:   event=ime-insets window=primary displayId=0 visible=false bottomPx=0 bottomLogical=0.0
hide:   event=surface-host-snapshot-ready surfaceKey=PRIMARY stable/current=2560×1600 logical=1280×800 imeVisible=false imeBottomLogicalBeforeCanvasScale=0
hide:   render.surface-host-layout PRIMARY scaleX=1 scaleY=1 imeVisible=false imeInset=0
```

IME 前后 stable/current window layout 与 scale 均不变；IME 最终值为逻辑单位 `368`，来自
`bottomPx=736 / density=2`。默认显示配置的 primary 与 secondary 都是等比例 scale（primary
1、secondary 0.751...），因此另行使用可恢复的 primary 显示尺寸 override 取得非等比场景，
结果见下节。该默认 run 仍没有提供 `scaleY != 1` 的 production scroll 场景。

#### Android non-uniform primary run

为验证详设 C/D 的承载层路径，保存了默认配置后仅对当前精确 emulator 的 primary display
做可恢复 override：`wm size 2560x1440`，density 保持 `320`；未改副屏 density、manifest
或业务代码。原始配置为 `2560x1600 @ 320`，run 完成后执行 `wm size reset` 与 `wm density reset`，
并重新 readback 为 `2560x1600 @ 320`。该 run 的完整原始日志、截图和 UI hierarchy 分别保存在：
`/tmp/ter-cp7-android-nonuniform.log`、`/tmp/ter-cp7-android-nonuniform-primary.png`、
`/tmp/ter-cp7-android-nonuniform-form-2.png`、`/tmp/ter-cp7-android-nonuniform-financial.png`、
`/tmp/ter-cp7-android-nonuniform-ime.png`、`/tmp/ter-cp7-nonuniform-form-ui.xml` 与
`/tmp/ter-cp7-nonuniform-financial-ui.xml`。

该配置的原始 owner/JS 关键输出为：

```text
event=primary-window-layout displayId=0 widthPx=2560 heightPx=1440 densityDpi=320 density=2 logicalWidth=1280 logicalHeight=720
event=surface-host-snapshot-ready PRIMARY generation=1 displayId=0 windowIdentity=primary stableWidthLogical=1280 stableHeightLogical=720 currentWidthLogical=1280 currentHeightLogical=720 imeVisible=false
render.surface-host-layout PRIMARY canvas=1280×800 host=1280×720 scaleX=1 scaleY=0.9 imeVisible=false imeInset=0
input.surface-frame-layout PRIMARY width=1280 height=800 declared=1280×800
startup.surfaces.measured PRIMARY deltaWidth=0 deltaHeight=0
```

真实交互已在该非等比配置下完成：从 primary member list 点击 `新增会员` 进入表单，点击
金额字段显示 custom keyboard，再点击姓名字段显示系统 Gboard；截图显示表单和键盘整体纵向
压缩而非局部错位。UI hierarchy 的真实 bounds 记录了表单字段与键盘 action row，且金额键盘的
`-`、`.`、`0`、`⌫`、`完成` 仍按右侧 action 布局出现。此证据证明了 `scaleY=0.9` 的真实
承载与业务入口可用，但尚未构成四角 safe-point 全集，因此 CP7-13 仍为 `OPEN`。

同一非等比配置下的 IME 原始输出为：

```text
event=ime-insets window=primary displayId=0 visible=true bottomPx=678 bottomLogical=339.0
event=surface-host-snapshot-ready surfaceKey=PRIMARY stable/current raw=2560×1440 logical=1280×720 imeVisible=true imeBottomLogicalBeforeCanvasScale=339
render.surface-host-layout PRIMARY canvas=1280×800 host=1280×720 scaleX=1 scaleY=0.9 imeVisible=true imeInset=376.6666666666667
event=ime-insets window=primary displayId=0 visible=false bottomPx=0 bottomLogical=0
render.surface-host-layout PRIMARY canvas=1280×800 host=1280×720 scaleX=1 scaleY=0.9 imeVisible=false imeInset=0
```

`339 / 0.9 = 376.6666666666667`，且 show/hide 前后 `scaleX=1`、`scaleY=0.9` 不变；这
是 Android 档的真实 IME 单位换算证据。该 run 没有让 sample 产生一个位于可见区下方 200
逻辑单位的真实输入框滚动事件，故 CP7-14 仍为 `OPEN`，不得用这段 IME 证据替代 E。

run 结束后精确停止 `com.anonymous.sampleterminal`，`pidof` 为空，主/副屏 top activity 均
回到 launcher；显示尺寸和 density override 均已恢复。该 run 不改变当前 production 配置。

#### Additional narrow production attempts for CP7-14

为避免把 focused fixture 或人工 `scrollTo` 当成 production E，继续对当前 sample 做了两次
仅显示尺寸的可逆探测：`2560×1000 @320`（`scaleY=.625`）和 `2560×480 @320`（约
`scaleY=.3`）。两次都在无 IME 态从真实 member list 点击 `新增会员`，进入真实 member form，
再点击真实金额输入框触发 custom keyboard，并保存截图、UI hierarchy 和 logcat：
`/tmp/ter-cp7-android-scroll-probe-financial.png`、
`/tmp/ter-cp7-scroll-probe-financial.xml`、
`/tmp/ter-cp7-android-scroll-probe-financial.log`，以及 480 配置的
`/tmp/ter-cp7-android-scroll-probe-480-financial.png`、
`/tmp/ter-cp7-scroll-probe-480-financial.xml`、
`/tmp/ter-cp7-android-scroll-probe-480-financial.log`。

480 配置下真实 UI hierarchy 为：scroll viewport `[48,41][2512,296]`、金额字段
`[48,245][2512,274]`、custom keyboard `[0,349][2560,480]`；字段仍完整位于当前可见
viewport 内，没有产生 production `input.scroll-into-view` 或 before/after offset 日志。
这不是 E 的通过证据，而是该 sample 在现有真实形态下不能提供 E oracle 的原始反证；CP7-14
仍保持 `OPEN`。探测后再次执行 `wm size reset`、`wm density reset` 并 readback
`2560×1600 @320`，停止精确 sample 包，未保留 override 或进程。

#### secondary screenshot 能力边界

按项目授权用 ADB 尝试了当前真实 virtual display 2 的截图/录屏，原始失败如下：

```text
$ adb -s emulator-5554 exec-out screencap -d 2 -p > /tmp/ter-cp7-android-secondary-final.png
Failed to take screenshot. Status: -2
Capturing failed.
file: ASCII text, 56 bytes

$ adb -s emulator-5554 shell screenrecord --display-id 2 --time-limit 1 --size 1280x720 ...
Invalid physical display ID
SCREENRECORD_SECONDARY_EXIT=2
```

`dumpsys SurfaceFlinger` 将 display 2 标为
`virtual:com.android.emulator.multidisplay:1234562`、owner
`com.android.emulator.multidisplay`、type `VIRTUAL`、`FLAG_PRESENTATION`；因此上述失败是
当前 emulator/ADB surface capture 能力边界，不是空白 PNG，也不是 secondary 业务画布成功。
secondary 真实 tap 仍可通过 `adb shell input -d 2 tap` 发送，但不能把它与像素截图混为一谈。
CP7-10 保持 `OPEN`。

#### broadcast rejection 修复后的最终检查

最终 fresh launch 与交互后，对 `/tmp/ter-cp7-android-after-broadcast-fix.log` 和同 run
输出执行 rejection absence check：

```text
SURFACE_HOST_REJECTION=ABSENT
```

这只证明合法另一 surface 广播不再制造错误 rejection/LogBox；同 source 的 stale、wrong
display、wrong window fence 仍由 focused test 覆盖。它不替代 secondary screenshot、非等比
Android display、scaleY 非 1 的 scroll 或最终全批验收。

### CP-7 当前阶段判定与未决边界

| 项目 | 结论 | 原因 |
| --- | --- | --- |
| focused input/adapter proof | MATCHED | typecheck 与真实 focused tests 均通过 |
| production Web DCE | MATCHED | fresh Expo export 成功，dev-only event strings absent |
| Web wide/narrow runtime | MATCHED | 真实 console/DOM/elementFromPoint/mouse click 已记录；Web policy 仍外部 OPEN |
| Android build/install/launch | MATCHED | 最终 APK fresh build/install/launch 原始输出成功 |
| Android adapter facts/IME roundtrip | MATCHED | 两 surface identity、density、stable/current 与 primary IME show/hide 已记录 |
| Android primary business/custom keyboard | MATCHED | clean screenshot 与 UIAutomator hierarchy 已保存 |
| Android secondary pixels | OPEN | 当前 virtual display 2 的 ADB capture 返回 Invalid physical display ID/Capturing failed |
| Android exact secondary measured delta | OPEN | RN secondary height 720.3755 的 density quantization 残差，不能静默舍入 |
| Android non-uniform scale C/E | OPEN | 已有 primary `scaleX=1, scaleY=0.9` 真实 run；但四角 safe-point 与 scaleY 非 1 的 production scroll 证据仍缺 |
| Web policy | OPEN_BY_DEXTER_DECISION | 不自行选择 contain 或 browser stretch |
| portrait profile | OPEN_BY_DEXTER_DECISION | 未提供 target hardware profile |
| runner/app cleanup | MATCHED | Web session closed；`am force-stop com.anonymous.sampleterminal` 后无 pid，top activity 为 launcher/secondary launcher |

当前 CP-7 不能写成整体 `MATCHED`，因为 secondary screenshot、Android exact-zero residual 与
非等比生产 E/C 仍是 `OPEN`；它们是证据/设备或外部决策边界，不应通过 round cap、预期数字、
primary screenshot 或结构性测试关闭。

### CP-7 阶段对账入口

阶段对账清单：
`doc/review/platform/2026-09-08-ter-logical-canvas-cp7-stage-reconciliation-checklist-codex.md`。

本阶段必须召集 fresh、只读独立 reviewer，使用：
`STAGE_RECONCILIATION_ID=TER_LOGICAL_CANVAS_STRETCH_CP7_STAGE_20260908`、
`REVIEW_TARGET=CP_STAGE_RECONCILIATION`、`REVIEW_ROUND_LIMIT=NOT_APPLICABLE`、
`reviewerKind=INDEPENDENT_SUBAGENT`。它不受正式 implementation review 两轮上限。reviewer
若发现本地可修复 OPEN，主 agent 修复后继续召集下一名 fresh reviewer；若确认是设备能力、
平台量化或 Dexter 决策边界，则保留 OPEN 并停止声称整体交付完成。

### CP-7 首次阶段 reviewer 原始结论

Plato 为本阶段第一次 fresh、只读、非作者 reviewer；未运行命令、构建、测试、Web 或 Android，
没有文件写入。其原始结论如下：

```text
STAGE_RECONCILIATION_ID=TER_LOGICAL_CANVAS_STRETCH_CP7_STAGE_20260908
REVIEW_TARGET=CP_STAGE_RECONCILIATION
REVIEW_ROUND_LIMIT=NOT_APPLICABLE
reviewerKind=INDEPENDENT_SUBAGENT
FRESH_READ_ONLY=YES
NO_WRITE=YES
NO_BUILD_TEST_WEB_ANDROID=YES

STAGE_RECONCILIATION=OPEN
OPEN_COUNT=4
OPEN_BY_DEXTER_DECISION_COUNT=2
LOCAL_FIXABLE_OPEN=0

CP7-01=MATCHED
CP7-02=MATCHED
CP7-03=MATCHED
CP7-04=MATCHED
CP7-05=MATCHED
CP7-06=MATCHED
CP7-07=MATCHED
CP7-08=MATCHED
CP7-09=MATCHED
CP7-10=OPEN
CP7-11=MATCHED
CP7-12=OPEN
CP7-13=OPEN
CP7-14=OPEN
CP7-15=OPEN_BY_DEXTER_DECISION
CP7-16=OPEN_BY_DEXTER_DECISION
CP7-17=MATCHED
CP7-18=MATCHED
```

该 reviewer 的阶段性证伪点为：当前 virtual `FLAG_PRESENTATION` secondary 无可读 ADB 像素捕获；
secondary measured delta 为 `0.375549...` 且不可静默四舍五入；当时证据中没有非等比 Android
production 配置，也没有 `scaleY != 1` 的 production scroll。它同时确认没有额外本地可修复 OPEN：
DCE guard、另一 surface 广播 fence、阶段对账不受正式 review 轮次上限均与源码和证据一致。
在此 reviewer 返回后，主 agent 又补录了上节的 `scaleY=0.9` 非等比 run；CP7-13/14 是否可因
新增证据收窄，交由下一名 fresh 阶段 reviewer 重新判定，不由作者会话自审关闭。

### CP-7 第二次阶段 reviewer 原始结论

Raman 为本阶段第二次 fresh、只读、非作者 reviewer；未运行命令、构建、测试、Web 或 Android，
没有文件写入。该次阶段对账明确使用不受轮次上限的阶段轨道，原始结论如下：

```text
STAGE_RECONCILIATION_ID=TER_LOGICAL_CANVAS_STRETCH_CP7_STAGE_20260908
REVIEW_TARGET=CP_STAGE_RECONCILIATION
REVIEW_ROUND_LIMIT=NOT_APPLICABLE
reviewerKind=INDEPENDENT_SUBAGENT
FRESH_READ_ONLY=YES
NO_WRITE=YES
NO_BUILD_TEST_WEB_ANDROID=YES

STAGE_RECONCILIATION=OPEN
OPEN_COUNT=4
OPEN_BY_DEXTER_DECISION_COUNT=2
LOCAL_FIXABLE_OPEN=0

CP7-01=MATCHED
CP7-02=MATCHED
CP7-03=MATCHED
CP7-04=MATCHED
CP7-05=MATCHED
CP7-06=MATCHED
CP7-07=MATCHED
CP7-08=MATCHED
CP7-09=MATCHED
CP7-10=OPEN
CP7-11=MATCHED
CP7-12=OPEN
CP7-13=OPEN
CP7-14=OPEN
CP7-15=OPEN_BY_DEXTER_DECISION
CP7-16=OPEN_BY_DEXTER_DECISION
CP7-17=MATCHED
CP7-18=MATCHED

remaining findings=NONE_LOCAL
```

Raman 逐条确认：新增的 non-uniform run 只证明 primary `scaleX=1, scaleY=0.9` 的真实承载、
业务入口和 `339/.9` IME 换算，不能证明 CP7-13 所需四角 safe-point 全集；它也没有提供
CP7-14 所需的 production scroll before/after offset。secondary capture 的 ADB 失败、secondary
`0.375549...` quantization residual、Web policy 与 portrait profile 的 OPEN 均与现有边界一致。
该 reviewer 没有发现本地可修复 OPEN；源码侧也确认 DCE、broadcast fence、IME 轴向换算、
input 自身测量与 cleanup 的档位没有混写。新增证据不能把这些 OPEN 擅自改为 MATCHED。

### CP-7 无效 reviewer 委派记录

第三次委派未形成有效阶段 verdict。委派提示错误地把“只读静态审查”写成“不得运行任何命令”，
而该 reviewer 的可用读取入口只有只读 shell；其在未读取材料的情况下返回
`STAGE_RECONCILIATION=OPEN / OPEN_COUNT=UNVERIFIED_REQUIRES_READ_TOOL / LOCAL_FIXABLE_OPEN=UNVERIFIED_REQUIRES_READ_TOOL`
与 `remaining findings=BLOCKED_BY_TOOL_BOUNDARY`。该输出不计入 CP-7 的阶段判定，也不增加真实
OPEN；根因已修正为允许只读 `rg/sed/nl/awk`，继续禁止写文件、构建、测试、Web、Android 与
任何动态验证，并重新召集 fresh reviewer。该记录保留以说明为什么不能把这次委派当作独立审查。

### CP-7 第三次有效阶段 reviewer 原始结论

Ramanujan 使用修正后的读取边界完成第三次有效 fresh、只读阶段对账：允许只读 shell 打开/搜索
材料，但没有写文件、构建、测试、Web 或 Android 动态操作。原始机器可读结论如下：

```text
STAGE_RECONCILIATION_ID=TER_LOGICAL_CANVAS_STRETCH_CP7_STAGE_20260908
REVIEW_TARGET=CP_STAGE_RECONCILIATION
REVIEW_ROUND_LIMIT=NOT_APPLICABLE
reviewerKind=INDEPENDENT_SUBAGENT
FRESH_READ_ONLY=YES
NO_WRITE=YES
NO_BUILD_TEST_WEB_ANDROID=YES

STAGE_RECONCILIATION=OPEN
OPEN_COUNT=4
OPEN_BY_DEXTER_DECISION_COUNT=2
LOCAL_FIXABLE_OPEN=0
EVIDENCE_EXAGGERATION=NONE_FOUND_LOCAL
remaining findings=NONE_LOCAL

CP7-01=MATCHED
CP7-02=MATCHED
CP7-03=MATCHED
CP7-04=MATCHED
CP7-05=MATCHED
CP7-06=MATCHED
CP7-07=MATCHED
CP7-08=MATCHED
CP7-09=MATCHED
CP7-10=OPEN
CP7-11=MATCHED
CP7-12=OPEN
CP7-13=OPEN
CP7-14=OPEN
CP7-15=OPEN_BY_DEXTER_DECISION
CP7-16=OPEN_BY_DEXTER_DECISION
CP7-17=MATCHED
CP7-18=MATCHED

ROUND_LIMIT_RECONCILIATION=MATCHED
CP7_13_PROOF=CONFIRMED_OPEN
CP7_14_PROOF=CONFIRMED_OPEN
LOCAL_REPAIR_RECOMMENDATION=NONE

## 历史修复追加证据：目标 display density（2026-09-08，HISTORICAL_SUPERSEDED）

ADDENDUM_ID=TER_LOGICAL_CANVAS_TARGET_DISPLAY_DENSITY_REMEDIATION_20260908
ADDENDUM_STATUS=HISTORICAL_SUPERSEDED_BY_20260909_SHARED_RN_RENDER_DENSITY
ADDENDUM_AUTHOR_SESSION_FRESH=false
ANDROID_RUNTIME_SESSION_FRESH=true
ANDROID_DEVICE=emulator-5554
ANDROID_APK_INSTALL_VERIFIED=true
ANDROID_APK_LAST_UPDATE_TIME=2026-09-08 11:49:43

本追加段取代本文件历史 CP 记录中关于 canonical render density、SECONDARY `1280×720`
逻辑画布以及旧截图入口的当前解释。修复选择恢复目标 display density：PRIMARY 使用主 Activity
的 `320dpi`，SECONDARY 的 React surface 使用目标 Presentation display 的 `213dpi`；没有把
主屏 density 作为副屏 canonical render density 注入，也没有增加 clamp、fallback 或第二套尺寸真相。

### 逐代码与详设回读

| 代码/文档锚点 | 当前观察 | 结论 |
| --- | --- | --- |
| `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt` 第 207-323 行 | owner decorView 读取窗口尺寸；surface view 读取 React surface density；hardware display metrics 与 surface metrics 分开记录并要求 dpi/浮点密度一致；逻辑尺寸除以 surface density | MATCHED |
| 同文件第 516-564 行 | SECONDARY target display metrics 直接作为 `createSurfaceContext` 的 densityDpi；无 primary canonical render density | MATCHED |
| 同文件第 711-732 行 | 复制 Presentation context configuration，只覆写目标 display 的 `densityDpi`，不引入主屏密度 | MATCHED |
| `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenModule.kt` 第 43-74 行 | diagnostics 同时区分 hardwareDensity 与 surfaceDensity，hardware 只作诊断，surface 是 React surface/host 换算密度 | MATCHED |
| `apps/terminal/adapter/android/dual-screen/src/implementations/surfaceHost.ts` | JS snapshot validator 与字段名同步为 hardware/surface density | MATCHED |
| `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-design-codex.md` §4.1、§5.2.1、§5.2.3、P-01 | SECONDARY `960×540`；目标 density 与 owner window 同源核对；目标 display density 方案与 canonical 方案有明确取舍 | MATCHED |
| `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-implementation-plan-codex.md` CP-2/P-01 | 计划与目标 density 代码路径一致 | MATCHED |
| `apps/terminal/adapter/android/dual-screen/README.md` 第 21-38 行 | 记录 hardware/surface density 边界，明确与 host canvas scale 正交 | MATCHED |

### Android display 与 SurfaceFlinger 事实

本次先用 `dumpsys display` 识别逻辑 display，再从 `dumpsys SurfaceFlinger --display-id`
动态解析 screenshot display id；没有猜测 `2` 是 SurfaceFlinger id。

```text
device=emulator-5554 model=Pixel_Tablet
display-0=2560x1600@320dpi FLAG_BUILT_IN
display-2=1280x720@213dpi FLAG_PRESENTATION virtual=Emulator_2D_Display
PRIMARY_SF_ID=4619827259835644672
SECONDARY_SF_ID=11529215047789101945
```

`surfaceKey=PRIMARY` 的 fresh log：

```text
event=primary-window-layout widthPx=2560 heightPx=1600 displayId=0
  densityDpi=320 density=2.0 logicalWidth=1280.0 logicalHeight=800.0
event=surface-host-snapshot-ready surfaceKey=PRIMARY displayId=0
  stableWidthLogical=1280.0 stableHeightLogical=800.0
  currentWidthLogical=1280.0 currentHeightLogical=800.0
  hardwareDensityDpi=320 hardwareDensity=2.0
  surfaceDensityDpi=320 surfaceDensity=2.0 imeVisible=false
```

`surfaceKey=SECONDARY` 的 fresh log：

```text
event=secondary-target-metrics displayId=2 widthPx=1280 heightPx=720
  densityDpi=213 density=1.3312501
  surfaceDensityDpi=213 surfaceDensity=1.3312501
event=secondary-surface-context-normalized hardwareTargetDensityDpi=213 surfaceDensityDpi=213
event=secondary-react-surface-context displayId=2 densityDpi=213 density=1.3312501
  screenWidthDp=962 screenHeightDp=541
event=secondary-react-surface-layout displayId=2 widthPx=1280 heightPx=720
  densityDpi=213 density=1.3312501 logicalWidth=961.5023 logicalHeight=540.84503
event=secondary-presentation-window-layout displayId=2 widthPx=1280 heightPx=720
  densityDpi=213 density=1.3312501 logicalWidth=961.5023 logicalHeight=540.84503
event=surface-host-snapshot-ready surfaceKey=SECONDARY displayId=2
  stableWidthLogical=961.5022957581195 stableHeightLogical=540.8450413639423
  currentWidthLogical=961.5022957581195 currentHeightLogical=540.8450413639423
  hardwareDensityDpi=213 hardwareDensity=1.3312501
  surfaceDensityDpi=213 surfaceDensity=1.3312501 imeVisible=false
```

这里的 SECONDARY measured residual 不是零：JS `InputSurfaceFrame` 受 Android 213dpi 的整数像素
量化得到 `959.9999389648438×540.0938720703125`，相对声明 `960×540` 的 delta 为
`-0.00006103515625×0.0938720703125`。当前详设 A 的推导上界是 `0.5 / surfaceDensity`：
SECONDARY 为 `0.5 / 1.3312501 = 0.3755868263` logical unit，因此两个轴均在真实量化上界内。
这里不再引用旧的“每轴 ≤1”表述，也不能把结果写成“逐轴精确相等”或“零残差”。

### JS 承载与运行时业务观察

```text
render.surface-host-layout surfaceKey=PRIMARY
  ready=true canvas=1280x800 host=1280x800 scaleX=1 scaleY=1
render.surface-host-layout surfaceKey=SECONDARY
  ready=true canvas=960x540 host=961.5022957581195x540.8450413639423
  scaleX=1.001564891414708 scaleY=1.001564891414708
input.surface-frame-layout surfaceKey=SECONDARY
  width=959.9999389648438 height=540.0938720703125 declared=960x540
startup.surfaces.measured surfaceKey=SECONDARY
  deltaWidth=-0.00006103515625 deltaHeight=0.0938720703125 ready=true
```

fresh Android screenshots were captured from the dynamically resolved SurfaceFlinger ids:

- `/tmp/ter-primary-target-density-after.png` — PNG `2560×1600`;
- `/tmp/ter-secondary-target-density-after.png` — PNG `1280×720`, contains the unrelated persistence error overlay;
- `/tmp/ter-primary-target-density-current.png` — PNG `2560×1600`, clean current member-list state;
- `/tmp/ter-secondary-target-density-clean-attempt.png` — PNG `1280×720`, clean current welcome state;
- `/tmp/ter-secondary-target-density-welcome-crop.png` — PNG `260×100`, crop of the welcome text.

The clean secondary crop shows the current welcome string fully visible. This is not evidence that the
historical input-form text has passed all visual acceptance criteria: the current clean runtime state is
the welcome screen, not the original input-form state.

The same runtime emitted:

```text
event=sample.customer-welcome-text-lines
lines=[{text='欢迎，请等待店员操作', x=0, y=0, width=140, height=24, ascender=18, descender=6}]
```

The persistence adapter errors (`persistSecure.listKeys: adapter not injected` and
`ui-state.content.persistence-failed`) remain an independent data/overlay issue. They are not used as
evidence for density, text metrics, or clipping, and they must be resolved or excluded before a clean
business-screen visual acceptance run.

### Static/focused proof

```text
workspace typecheck: 6 TER packages exit=0
workspace focused tests: 32 files, 139 tests passed
native ./gradlew :catering-v2s-adapter-android-dual-screen:testDebugUnitTest --no-daemon: exit=0
native ./gradlew :app:assembleDebug --no-daemon: exit=0, BUILD SUCCESSFUL in 13s
git diff --check (scoped TER paths): exit=0
```

### 当前 OPEN，不得写成 PASS

```text
OPEN=historical input-form three-part pixel crop/text-object verification
OPEN=clean business-screen screenshot without persistence overlay
OPEN=real Android IME show/hide roundtrip and scale invariance
OPEN=production scaleY!=1 scroll before/after offset +200 evidence
OPEN=four-corner real tap hit testing on a non-uniform display
OPEN=Web secondary business content and visual behavior (current fallback container-empty)
OPEN=production bundle DCE evidence
OPEN=portrait hardware profile and portrait acceptance
```

上述 OPEN 不否定本次 target-density 代码修复的静态、focused 与当前 Android 运行事实，但阻止
把 TER 全部用户可见验收写成完成。RD-10 的“断言语义一字不得改”由职责到测试矩阵与逐代码/详设
对账记录承担；本次代码修复未改既有业务断言，仅更新密度字段、fixture 与受影响的几何基线。

## 2026-09-09 S-A/S-B 处置追加

REMEDIATION_ID=TER_LOGICAL_CANVAS_ACCEPTANCE_BOUND_AND_MEMBER_DESK_DEFAULT_FRAME_20260909
REMEDIATION_STATUS=READY_FOR_CLAUDE_IMPLEMENTATION_REVIEW
REMEDIATION_AUTHOR_SESSION_FRESH=false

S-A 已将详设 A 从 `delta=0` 改为由 `0.5 physical px / surfaceDensity` 推导的逐轴上界：
PRIMARY `surfaceDensity=2.0` 时为 `0.25`，SECONDARY `surfaceDensity=1.3312501` 时为
`0.3755868263`。当前 fresh Android SECONDARY 的 `deltaWidth=-0.00006103515625`、
`deltaHeight=0.0938720703125` 均低于该上界；这不是用 `≤1` 容差放宽，也不是把 residual
改写成零。Web 的 CSS layout density 定义为 `1`，其整数 CSS layout 观测上界为 `0.5`。

S-B 已将当前工作区 `apps/terminal/ui/feature/sample-member-desk/test/memberDesk.test.tsx` 第 86 行
的隐式默认 frame 从实际旧值 `962×541` 改为 `960×540`。Claude 评审描述把该旧值写成
`1280×720`，但当前字节与本次 diff 证明旧值是 `962×541`；两者都不是当前逻辑画布，故该描述
差异不改变底层问题的确认。依据是该 helper 的隐式调用覆盖 member-desk 的公共/顾客确认行为，
而 `962×541` 是已退役的旧逻辑基线；PRIMARY 的真实逻辑 frame 已在第 616 行显式使用
`1280×800`，landscape confirm 已在第 235 行显式使用 `960×540`。
本次只改变旧单位混写的默认输入，没有改业务断言文本或断言条件；focused test 结果须以本次
重新运行的原始输出为准，若结果改变必须单列为行为差异，不能调断言收口。

S-A/S-B 逐代码与详设对账：

```text
design A bound and derivation=MATCHED
implementation-plan member-desk denominator and default semantics=MATCHED
memberDesk.test.tsx implicit default frame=MATCHED
evidence residual citation=MATCHED
RD-10 assertion semantic preservation=OPEN_PENDING_BEFORE_AFTER_COMPARISON
```

S-B focused proof（本次处置后重新运行，package test 会话 fresh=true；没有修改业务断言）：

```text
$ yarn workspace @catering-v2s/ui-feature-sample-member-desk typecheck
TERMINAL_PACKAGE_TYPECHECK_EXIT=0

$ yarn workspace @catering-v2s/ui-feature-sample-member-desk test
RUN v4.1.10 /Users/dexter/Documents/workspace/idea/catering-v2s/apps/terminal/ui/feature/sample-member-desk
Test Files 1 passed (1)
Tests 24 passed (24)
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-feature-sample-member-desk
TERMINAL_PACKAGE_TEST_EXIT=0
```

本次 focused 运行没有出现因默认 frame 从当前源码实际旧值 `962×541` 改为 `960×540` 导致的失败或结果变化；
这只能说明当前 fixture 仍可运行，不能单独证明 RD-10 要求的前后断言语义一字未改。该项仍由
前后代码对账记录承担，状态保持 `OPEN_PENDING_BEFORE_AFTER_COMPARISON`。没有为通过测试而调整
任何断言文本或条件。

N-1 note：终端编码规范仍未把 `PixelRatio` 的“仅诊断”限制登记为独立规则；当前源码、详设与
README 已明确禁止其进入布局/业务/input 路径。本轮不扩展规范正本，不把该欠账升级为阻断项。

## 2026-09-09 当前源码与最新 APK 复核：共享 RN render density

CURRENT_ADDENDUM_ID=TER_LOGICAL_CANVAS_SHARED_RN_RENDER_DENSITY_20260909
CURRENT_ADDENDUM_STATUS=READY_FOR_CLAUDE_IMPLEMENTATION_REVIEW
CURRENT_ADDENDUM_AUTHOR_SESSION_FRESH=false
CURRENT_ANDROID_RUN_FRESH=true
CURRENT_ANDROID_RUN_DIR=/tmp/ter-latest-20260909-pf6iRA

本追加段是当前源码与最新安装 APK 的证据入口，取代前一段把 `213dpi` 作为 SECONDARY
React surface density 的历史追加段。`213dpi` 只出现在本次模拟器硬件事实与测试/文档预期中，
没有写入 Android production source；生产代码读取目标 display 的实际 hardware density，
并读取同一 RN runtime 的共享 render density。

### 代码与配置边界

| 锚点 | 当前事实 | 结论 |
| --- | --- | --- |
| `TerminalDualScreenActivityHandler.kt` 第 517 行 | `targetDisplay.getMetrics(targetMetrics)` 每次副屏创建读取目标 display 的实际 metrics | MATCHED |
| 同文件第 518 行 | `sharedReactRenderMetrics(activity)` 从 RN `DisplayMetricsHolder.screen` 取得共享 render metrics | MATCHED |
| 同文件第 557-561 行 | `createSurfaceContext` 接收 `renderMetrics.densityDpi`，不接收目标 display 的 hardware dpi | MATCHED |
| 同文件第 715-718 行 | render density 通过 RN runtime 的共享 metrics 获取，没有 `213` 常量 | MATCHED |
| 同文件第 206-220、272-313 行 | owner raw bounds、hardware density、surface render density 分开读取；逻辑尺寸除以实际 surface density | MATCHED |
| `apps/terminal/ui/integration/sample-console/package.json` 第 11-23 行 | 画布唯一声明为 PRIMARY `1280×800`、SECONDARY `960×540` | MATCHED |
| `ui/base/render/src/foundations/surfaceHost.ts` 第 60-64 行 | `scaleX=host.width/canvas.width`、`scaleY=host.height/canvas.height`，不读取 hardware dpi | MATCHED |
| production source `apps/terminal/adapter/android/dual-screen/android/src/main` 的 `213` 扫描 | 无输出；未发现硬编码 213 | MATCHED |
| `TerminalSurfaceHostActivityHandlerTest.kt` 第 35-38 行 | 同时覆盖 hardware 213/render 320 与 hardware 440/render 320；440 是防止把当前模拟器值误当协议的测试夹具 | MATCHED |

### 最新 Android run：原始设备、APK 与截图证据

设备 serial=`emulator-5554`，model=`Pixel_Tablet`，包=`com.anonymous.sampleterminal`，
安装结果为 `Success`，进程为 `13114`。本次 APK SHA-256 为
`159898b5e08d5b427a77e7535a76bf729e8b5377093a07a45f5feab6191a5b06`。

`dumpsys display` 原始事实：display 0 为 `2560×1600 / 320dpi`，display 2 为
`1280×720 / 213dpi / FLAG_PRESENTATION`。同一 run 先读取
`dumpsys SurfaceFlinger --displays`，动态得到：

```text
Display 4619827259835644672
Virtual Display 11529215047789101945
primaryLogicalDisplayId=0
secondaryLogicalDisplayId=2
primarySurfaceFlingerId=4619827259835644672
secondarySurfaceFlingerId=11529215047789101945
virtualDisplayCount=1
```

截图使用上述 SurfaceFlinger ID，而不是把 logical displayId `2` 直接传给 `screencap`：

```text
/tmp/ter-latest-20260909-pf6iRA/primary.png:   PNG image data, 2560 x 1600, 8-bit/color RGBA
/tmp/ter-latest-20260909-pf6iRA/secondary.png: PNG image data, 1280 x 720, 8-bit/color RGBA
```

### Android 原始密度与布局日志

```text
event=secondary-target-metrics displayId=2 widthPx=1280 heightPx=720
  densityDpi=213 density=1.3312501
  hardwareDensityDpi=213 hardwareDensity=1.3312501
  renderDensityDpi=320 renderDensity=2.0
  renderDensitySource=react-native.DisplayMetricsHolder.screen

event=secondary-surface-context-output displayIndex=1 densityDpi=320 density=2.0
  resourceWidthPx=1280 resourceHeightPx=720

event=secondary-react-surface-layout displayIndex=1 displayId=2
  widthPx=1280 heightPx=720 measuredWidthPx=1280 measuredHeightPx=720
  densityDpi=320 density=2.0 logicalWidth=640.0 logicalHeight=360.0

event=secondary-presentation-window-layout displayIndex=1 displayId=2
  widthPx=1280 heightPx=720 measuredWidthPx=1280 measuredHeightPx=720
  densityDpi=213 density=1.3312501 logicalWidth=961.5023 logicalHeight=540.84503

event=surface-host-snapshot-ready surfaceKey=SECONDARY generation=1 displayId=2
  windowIdentity=secondary stableWidthPx=1280 stableHeightPx=720
  currentWidthPx=1280 currentHeightPx=720
  stableWidthLogical=640.0 stableHeightLogical=360.0
  currentWidthLogical=640.0 currentHeightLogical=360.0
  hardwareDensityDpi=213 hardwareDensity=1.3312501
  surfaceDensityDpi=320 surfaceDensity=2.0 imeVisible=false
```

PRIMARY 同一 run 的 ready 记录为 `stable/current=1280×800 logical`、
`hardwareDensityDpi=320`、`surfaceDensityDpi=320`、`displayId=0`、
`windowIdentity=primary`。

JS 同一 run 的承载日志为：

```text
event=render.surface-host-layout
  canvasWidth=960 canvasHeight=540 hostWidth=640 hostHeight=360
  scaleX=0.6666666666666666 scaleY=0.6666666666666666 pixelRatio=2 fontScale=1

event=input.surface-frame-layout
  width=960 height=540
  declaredWidth=960 declaredHeight=540 displayMode=SECONDARY ready=true

event=sample.customer-welcome-text-lines
  text='欢迎，请等待店员操作' width=140 height=24 ascender=18 descender=6
```

本次副屏截图中欢迎文本完整可见；截图仍包含 `persistSecure.listKeys: adapter not injected`
产生的持久化失败浮层，因此只能作为 density/text 现象的动态取证，不能作为干净业务视觉验收。

### focused proof 与当前未决边界

```text
./gradlew :catering-v2s-adapter-android-dual-screen:testDebugUnitTest --no-daemon
BUILD SUCCESSFUL in 20s

./gradlew :app:assembleDebug --no-daemon
BUILD SUCCESSFUL in 10s
```

本次 focused test 新增的 hardware `440` 夹具通过；它验证的是密度来源边界，不等于在真实
440dpi 设备上完成 Android 运行验收。portrait、真实 IME 往返、scaleY 非 1 的滚动 +200、
四角真实 tap、持久化端口注入后的干净业务屏、Web secondary 业务行为与 production DCE
仍保持 OPEN，不能由本次日志改写为 PASS。

### 本次对“213dpi 是否被写死”的结论

```text
production-source-literal-213-scan=NO_MATCH
target-display-density-source=Display.getMetrics(targetMetrics)
react-surface-density-source=DisplayMetricsHolder.screen
canvas-declaration-source=sample-console/package.json
hardware-density-policy=diagnostics-and-native-display-facts-only
```

因此，替换副屏型号、分辨率或硬件 dpi 时，副屏的目标 display metrics 会随设备读取，
Presentation/host 的实际窗口 bounds 会随 layout 读取，`scaleX/scaleY` 会重新计算；不会因
213 这个数值消失而使 JS 业务逻辑崩溃。若换成不同宽高比，当前已裁定的整体承载拉伸会改变
视觉比例，这是明确接受的形变，不是逻辑坍塌。若要求运行中热切换多个非默认 display，或要
覆盖 portrait/厂商 ROM，则需要单独的硬件 profile 与生命周期验证，本轮不把它们冒充已验证。

## 2026-09-09 dev-host 画布内调试标注移除

本次用户反馈针对的是画布左上角的只读调试标注，而不是顶部 dev-host 状态栏。该标注原由
`apps/terminal/ui/base/dev-host/src/components/testExpoApp.tsx` 的 `preview-scale` Text
渲染，内容为 `PRIMARY … @ …% · SECONDARY …`；它已从画布树中删除，配套的
`previewScaleLabel` 样式也已删除。承载层的 `web.surface-geometry` 结构化日志仍保留，
因此诊断能力没有被业务 UI 污染或一并删除。

本次 focused 证据：

```text
rg -n 'preview-scale|previewScaleLabel' apps/terminal/ui/base/dev-host
NO_MATCH

yarn workspace @catering-v2s/ui-base-dev-host typecheck
exit=0

yarn workspace @catering-v2s/ui-base-dev-host test
4 files passed, 12 tests passed
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-base-dev-host
```

删除后的 fresh Web 截图（会话 fresh=false，浏览器 tab=2，URL=`http://localhost:8082/`，
viewport screenshot=1385×886）显示：画布左上角不再出现 `PRIMARY 1280×800 …` 标注，
业务画布与主/客显内容仍存在；顶部 dev-host 的 surface 状态摘要仍保留在画布外，
用于显示当前挂载状态，不属于用户指出的画布内调试标注。

该截图仍不是完整视觉验收证据：当前 Web 会话存在持久化端口未注入导致的状态浮层，
且本节只验证调试标注移除与 dev-host 编译/测试，不把 Web 业务视觉、Android 视觉、
IME、真实点击、生产 DCE 或 portrait 状态写成 PASS。
