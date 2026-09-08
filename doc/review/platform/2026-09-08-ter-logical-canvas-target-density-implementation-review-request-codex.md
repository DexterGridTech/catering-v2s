# TER 固定逻辑画布目标 display density 修复实施后 review request

REVIEW_CYCLE_ID=TER_LOGICAL_CANVAS_STRETCH_IMPLEMENTATION_20260908
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=IMPLEMENTATION_REMEDIATION_HANDOFF
reviewerKind=CLAUDE_EXTERNAL_STATIC_REVIEW

## 背景

TER 固定逻辑画布实施的上一轮 Claude 实施后静态复核给出 `NO-GO，M=1 / S=3 / N=2`。
阻断 finding 是 Android 实现额外引入了未写入详设的 canonical render density：副屏 React
surface 被主屏 `320dpi` 排版后，再以约 `0.6667` 的承载变换降采样；该机制既没有详设依据，
也保留了用户最初看到的副屏文字放大/下沿疑似裁切的候选成因。

本轮已按现有边界自主修复：副屏 React surface 恢复使用目标 Presentation display 的
`213dpi`，固定 SECONDARY 画布改为 `960×540`；删除 canonical render density，不增 clamp、
fallback、兼容层或第二套画布尺寸真相。hardware density 与 surface density 在 diagnostics
中分栏，且在 owner window 与 React surface 不同源时 fail closed。详设、实施计划、README、
Kotlin/JS adapter、native fixture 已同步。

本次追加处置已闭合 Claude 新指出的两项 S：详设验收 A 不再要求不可实现的 `delta=0`，
改为从半个物理像素量化误差除以实际 `surfaceDensity` 推导上界；PRIMARY 上界为 `0.25`
logical unit，SECONDARY 上界为 `0.3755868263` logical unit。另将
`apps/terminal/ui/feature/sample-member-desk/test/memberDesk.test.tsx` 第 86 行的隐式默认
frame 已从当前工作区实际旧值 `962×541` 改为代表该 helper 顾客确认/SECONDARY 行为的
`960×540`；Claude 评审描述中的 `1280×720` 与当前字节不一致，已在 evidence 中如实标明。
本次没有改业务断言文本或断言条件。请以当前 evidence 追加段中的 focused 原始输出核对这两项，
不要把历史段中的旧数字或旧判据当作当前实现。

请不要采信此前会话的 GO/NO-GO 或本文件的自述；请以当前仓库字节、当前证据追加段和可复跑
输出为准，重新做 implementation review。

## 评审目标

请独立判断：

1. canonical render density 是否已从生产实现、诊断字段、详设和计划中完整移除；副屏是否由
   同一目标 display 的 density 提供 React surface/host 换算，且没有误删既有副屏 density 修正；
2. `hardwareDensity*` 与 `surfaceDensity*` 的拆分是否能防止“硬件密度与渲染密度错配却静默
   继续布局”，以及 `stable/current` 逻辑尺寸、owner window、React surface 的证据是否自洽；
3. SECONDARY `960×540` 是否是当前横屏 16:9 目标的正确逻辑声明，是否仍保持单一生产声明
   源；PRIMARY `1280×800` 与 portrait OPEN 边界是否被意外改变；
4. 目标 density 修复是否夹带业务行为、input 包越界、公共 TS 契约变更、第二个 React host、
   fallback 或逐页面样式补丁；
5. 当前静态/focused/Android 证据哪些可确认，哪些仍不能确认，尤其不要把 SECONDARY 的
   `deltaHeight=0.093872...` 写成零，也不要把 welcome 状态截图写成原 input-form 全量视觉验收；
6. 上一轮 M-1、S-1、S-2、S-3、N-1、N-2 是否已闭合；如未闭合，请给出精确路径、行号、
   失败场景、影响面、最小修复及是否需要 Dexter 裁决。

## 需阅读文件

- `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-design-codex.md`：当前固定逻辑画布详设、目标 density 取舍、P-01 与横屏/portrait 边界；
- `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-implementation-plan-codex.md`：当前 CP-0 至 CP-8 实施顺序与允许变更范围；
- `doc/review/platform/2026-09-08-ter-logical-canvas-stretch-implementation-evidence-codex.md`：历史 evidence 与末尾 `TARGET_DISPLAY_DENSITY_REMEDIATION_20260908` 当前追加证据；历史 CP 段不得覆盖追加段；
- `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt`：目标 display metrics、Presentation React surface context、owner/surface/hardware density 与 host snapshot；
- `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenModule.kt`：native snapshot 到 JS 的 diagnostics 字段边界；
- `apps/terminal/adapter/android/dual-screen/src/implementations/surfaceHost.ts`：JS snapshot 校验与 surface-host 输入；
- `apps/terminal/adapter/android/dual-screen/android/src/test/`：目标 density 与 hardware/surface mismatch 的 native focused tests；
- `apps/terminal/ui/integration/sample-console/package.json`：PRIMARY `1280×800` 与 SECONDARY `960×540` 的唯一生产画布声明；
- `apps/terminal/ui/base/render/src/`：Android/Web 承载层缩放与 input frame 测量边界；
- `apps/terminal/ui/base/input/src/`：确认 input 未读取 density、Dimensions、Platform 或宿主 scale；
- `apps/terminal/adapter/android/dual-screen/README.md`：硬件 density、surface density 与承载层 scale 的边界说明。

## 独立核验重点

请至少完成以下证伪式核验，并区分 static、focused、Web、Android 四档证据：

- 对全仓 TER 相关生产源码搜索 `renderDensity`、`canonical`、`canonical render density`、
  主屏 density 注入和第二套画布常量；核对没有通过改名或诊断字段残留规避；
- 逐行核对 `createSurfaceContext` 的输入是目标 display/Presentation context 与目标
  `densityDpi`，而不是主 Activity density；副屏 density 修正仍存在；
- 核对 P-01 的跨源判据不是恒真式，且 Android fresh 输出中 `hardwareDensityDpi=213`、
  `surfaceDensityDpi=213`、`stableWidthLogical≈961.5023`、`stableHeightLogical≈540.8450`
  与 owner non-IME window 事实一致；
- 核对当前 fresh Android 运行输出：PRIMARY `1280×800 @ 320dpi`、SECONDARY physical
  `1280×720 @ 213dpi`，JS SECONDARY canvas `960×540`、host
  `961.5023×540.8450`、`scaleX=scaleY≈1.0015649`；明确 residual 不是零；
- 按当前详设 A 的真实量化上界复核 residual：SECONDARY 的
  `|deltaWidth|=0.00006103515625`、`|deltaHeight|=0.0938720703125` 均须与
  `0.5 / 1.3312501 = 0.3755868263` 比较；不得引用不存在的“每轴 ≤1”条款，也不得把 residual
  写成零；PRIMARY 的对应上界为 `0.5 / 2.0 = 0.25`；
- 核对 `InputSurfaceFrame` 的 SECONDARY measured
  `959.9999389648438×540.0938720703125` 与 declared `960×540` 的 delta，判断这是
  Android 213dpi 整数像素量化还是实现错误；
- 核对 `apps/terminal/ui/feature/sample-member-desk/test/memberDesk.test.tsx` 第 86 行的
  默认 frame 已为 `960×540`，以及该默认 helper 的行为语义确实是 SECONDARY 顾客确认；对比
  第 235 行的显式 SECONDARY 与第 616 行的显式 PRIMARY `1280×800`，确认没有用修改断言来掩盖
  基线变化；
- 核对 typecheck、139 个 focused tests、native unit test、APK assemble 与 `git diff --check`
  的真实原始输出；不能把这些输出升级成 Web、IME、真实 tap、DCE、portrait 或业务视觉 PASS；
- 单独读取本次 S-B 修复后的 focused 原始输出：member-desk typecheck exit 0、1 个测试文件
  的 24 个测试通过；它只能证明当前 fixture 可运行，不能替代 RD-10 的前后断言语义对比；
- 对历史 input-form 文本下沿问题保持证据纪律：当前只有 welcome 状态 crop，原始 input-form
  的三项像素取证、主副屏同一文本的 `onTextLayout/onLayout` 对账仍应标为未验证；
- 将持久化端口未注入造成的浮层/错误与 density、字体、裁切根因分开判定；检查 Web secondary
  当前 fallback container-empty、生产 bundle DCE、IME show/hide、scaleY 非 1 scroll+200、
  四角真实 tap、portrait profile 是否仍是 OPEN；
- 运行或静态核对时不得修改源码、测试、依赖或文档，不得通过 fallback、临时常量、放宽门或
  业务页面字号补丁关闭 finding。

## 期望结论

请给出：

```text
REVIEW_TARGET=IMPLEMENTATION
VERDICT=GO | GO_WITH_UNVERIFIED_UI | NO-GO
M/S/N=<数量>
L1_ENGINEERING=<PASS 或 findings>
L2_USER_VISIBLE=<PASS 或 findings>
L3_UNVERIFIED=<逐条列出仍无人验证的用户可见事实>
```

每条 finding 标注 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、
`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION`，并给出仓库根相对路径与「第 X 行」、
失败场景、影响面、最小修复及是否需要 Dexter 裁决。请明确说明是否发现新的 M/S/N，不能只
复述代码“看起来正确”。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助对 TER 固定逻辑画布的目标 display density 修复做一次实施后静态 review。

背景：上一轮你对当前实现重开源码后指出，Android 实现额外引入了详设没有覆盖的 canonical render density：副屏 React surface 以主屏 320dpi 排版，再以约 0.6667 的承载变换降采样；这既与保留目标 display density 修正的详设冲突，也保留了副屏中文放大/下沿疑似裁切的候选成因。本轮已按既有边界修复为目标 display density：PRIMARY 继续使用主 Activity 的 320dpi，SECONDARY 的 React surface 使用目标 Presentation display 的 213dpi；SECONDARY 固定逻辑画布为 960×540；canonical render density 已删除，没有增加 clamp、fallback、兼容层或第二套画布声明。

目标：请不要采信此前会话结论或 Codex 自述，重新打开当前源码、详设、实施计划和 evidence，判断 canonical render density 是否真的从生产路径消失，目标 display density 是否与 hardware/surface diagnostics 同源，SECONDARY 声明与承载 scale 是否自洽，以及本次修复是否夹带业务行为、input 包越界或第二个尺寸真相。请同时区分已取得的 static/focused/Android 事实与仍未取得的 Web、IME、真实 tap、DCE、portrait、input-form 像素验收。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-design-codex.md：当前详设、P-01、目标 density 取舍与 portrait/Web 边界；
- doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-implementation-plan-codex.md：实施步骤与允许范围；
- doc/review/platform/2026-09-08-ter-logical-canvas-stretch-implementation-evidence-codex.md：重点读取末尾 TARGET_DISPLAY_DENSITY_REMEDIATION_20260908 追加段；文件前面的 canonical/旧 CP 记录是历史证据，不得作为当前结论；
- apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt：目标 display metrics、Presentation surface context、owner/surface/hardware density 与 snapshot；
- apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenModule.kt：native diagnostics 到 JS 的字段边界；
- apps/terminal/adapter/android/dual-screen/src/implementations/surfaceHost.ts：JS snapshot 校验与承载输入；
- apps/terminal/adapter/android/dual-screen/android/src/test/：目标 density 与 density mismatch focused tests；
- apps/terminal/ui/integration/sample-console/package.json：唯一生产画布声明源，PRIMARY 1280×800、SECONDARY 960×540；
- apps/terminal/ui/base/render/src/：承载缩放与 frame 测量；
- apps/terminal/ui/base/input/src/：确认 input 不读 density、Dimensions、Platform 或宿主 scale；
- apps/terminal/adapter/android/dual-screen/README.md：硬件 density、surface density 和 host scale 的边界。

请重点独立核验：
1. 全仓 TER 生产源码是否仍有 renderDensity/canonical 或主屏 density 注入；createSurfaceContext 是否确实使用目标 Presentation display 的 213dpi；副屏 density 修正是否保留。
2. P-01 是否是跨源判据而不是 rawPx/(logical×density) 的恒真式；hardwareDensityDpi 与 surfaceDensityDpi 是否同源且不匹配时 fail closed。
3. 当前 Android fresh 输出是否真实支持：PRIMARY 1280×800@320dpi；SECONDARY physical 1280×720@213dpi；JS canvas 960×540；host 约 961.5023×540.8450；scaleX=scaleY 约 1.0015649；InputSurfaceFrame measured 与 declared 的 SECONDARY delta 为 -0.000061×0.093872。请按 `0.5/surfaceDensity` 的推导上界核对，SECONDARY 上界为 `0.3755868263`，不得引用不存在的“≤1”详设条款。
4. S-B 的 `memberDesk.test.tsx` 第 86 行默认 frame 是否已从当前源码实际的 `962×541` 改为代表 SECONDARY 顾客确认行为的 `960×540`；Claude 原评审写作 `1280×720` 的差异也请与当前字节核对。本次 focused 输出是否为 typecheck exit 0、1 file/24 tests pass，且没有为了让断言通过而修改既有业务断言。
5. 上一轮 M-1、S-1、S-2、S-3、N-1、N-2 是否全部闭合；若未闭合，请按 CONFIRMED、PARTIALLY_CONFIRMED、REJECTED_WITH_EVIDENCE、UNVERIFIED_REQUIRES_EVIDENCE 或 DEXTER_DECISION 标注，并给精确仓根相对路径、行号、失败场景、影响面、最小修复和是否需要 Dexter 裁决。
6. 不要把当前 welcome 状态的副屏 crop 写成原 input-form 的文本裁切已修复；原 input-form 三项像素取证、主副屏同一文本 onTextLayout/onLayout 对账、干净业务屏、IME、scaleY 非 1 scroll+200、四角真实 tap、Web secondary 业务、DCE 与 portrait 仍分别核对并标注 OPEN。
7. 将持久化端口未注入浮层与 density/字体/裁切问题分开，不要混为同一根因。

Codex 已有的证据档位请你重新核对：target-density 修复前置套件记录为 6 个 TER 包 typecheck exit 0、32 个文件共 139 个 focused tests 通过、dual-screen native unit test exit 0、sample-terminal APK assemble exit 0、scoped diff check exit 0；S-B 修复后另有 member-desk typecheck exit 0、1 个文件/24 个测试通过。Android fresh log 与动态 SurfaceFlinger id、截图路径记录在 evidence 追加段。不能运行的项目请明确写成未亲验，不能将静态或 focused 结果升级为 Web、Android 全量视觉或生产 DCE PASS。

烦请给出明确的 REVIEW_TARGET=IMPLEMENTATION、GO / GO_WITH_UNVERIFIED_UI / NO-GO、M/S/N 数量，并补充 L1_ENGINEERING、L2_USER_VISIBLE、L3_UNVERIFIED。评审只读，不修改任何源码、测试、依赖、文档或 Git 状态。

授权边界：本次只请求对当前 target-density 修复做 implementation review。它不授权 portrait 实施、不授权新的画布策略、不授权业务页面补丁、不授权公共 TS 契约扩展、不授权 DEV、seed、reset、UAT、部署或其他 TER 整改。若仍有需要 Dexter 决定的产品或范围事项，请单列，不要自行改变方案。
谢谢。
```
