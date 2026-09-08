# TER 固定逻辑画布详设修订独立静态审查（remediation cycle round 2）

REVIEW_CYCLE_ID=TER_LOGICAL_CANVAS_STRETCH_REMEDIATION_20260908
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
reviewerKind=INDEPENDENT_SUBAGENT
EVIDENCE_TIER=static design/source review only
blindReviewDeclaration=本报告由无作者上下文的 fresh 独立子 agent 形成；只读重开输入与 owning source，未修改文件，未构建，未运行测试、Web、Android、设备、浏览器、DEV、seed、UAT 或部署。

## 独立 verdict

VERDICT=NO-GO（审查时）
M=1 / S=0 / N=1

审查时的阻断不是 Android bridge 或 stable measurement 方案本身，而是旧画布数字的同根扫描分母没有覆盖 `ui/base/input` 测试，导致计划可以按表关闭 CP-1，却把旧 keyboard/scroll/provider oracle 留在后续验证中。

## Findings

### M-01 · CONFIRMED：旧画布数字漏出 CP-1 denominator

- 路径与行号：`doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-design-codex.md` 第 173-174 行；`doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-implementation-plan-codex.md` 第 103-106、112-126 行（审查时版本）。源码命中为：
  - `apps/terminal/ui/base/input/test/keyboardHeight.test.ts` 第 8、16、28、70-79 行；
  - `apps/terminal/ui/base/input/test/virtualKeyboard.test.tsx` 第 15、80、114、138 行；
  - `apps/terminal/ui/base/input/test/scrollArea.test.tsx` 第 55-57、82-84 行；
  - `apps/terminal/ui/base/input/test/provider.test.tsx` 第 13-24、97、213、229 行。
- 失败场景：只迁移 sample-console/dev-host 的 shape 与基线后，input 包仍以 1157×723、962×541 作为 keyboard height、VirtualKeyboard、scroll 和 provider 的既有 oracle；后续新画布下的高度、可见性或 unsupported 边界可被旧 fixture 假绿。
- 影响面：固定画布基线的可验证性、CP-1 原子迁移、input 的用户可见键盘/滚动行为；不改变 adapter 架构判断。
- 最小修复：把分母扩为 sample-console、dev-host、ui/base/input 三棵测试树的全量命中，逐项分类为“按新画布重算”“改为平台无关的中性行为 fixture”或“明确 red fixture”；未分类命中不得关闭 CP-1。input 测试不得因此依赖 sample-console 或宿主。
- 是否需要 Dexter 裁决：否。

### N-01 · CONFIRMED：旧 round2 artifact 元数据不属于本 remediation cycle

- 路径与行号：`doc/review/platform/2026-09-08-ter-logical-canvas-stretch-design-independent-review-round2-codex.md` 第 3 行仍为旧 cycle `TER_LOGICAL_CANVAS_STRETCH_20260908`。
- 失败场景：把历史旧 cycle 的 GO 文件误当成本 remediation cycle 的最终 round2 evidence，造成轮次与证据归属混淆。
- 影响面：review 证据追溯，不直接改变设计行为。
- 最小修复：为 remediation cycle 单独保存本报告，使用正确 cycle ID，并包含独立 reviewer 所需字段；保留旧文件作为历史记录，不混用。
- 是否需要 Dexter 裁决：否。

## 定向核验

- M-1：REJECTED_WITH_EVIDENCE。详设 `§5.2.1` 已规定 stable bounds 与 density 必须来自同一 measurement context、同一次 snapshot，并给出逐轴 `rawPx / (logicalSize * density)` 配对比值；`createSurfaceContext` 仅作 React surface density 修正，不得作 host measurement context。
- M-2：REJECTED_WITH_EVIDENCE。详设 `§5.2.2` 及 H-02 已先依现有 `primary-window-layout`、`secondary-presentation-window-layout`、`ime-root-layout` 判定 current 是否变化，并覆盖 current 不变时的 current-as-stable 错误实现及更小 decorView 路径。
- S-1：REJECTED_WITH_EVIDENCE。owner UI window、display-context → window-context、`createSurfaceContext` 与无 fallback 边界已写明。
- S-2：PARTIALLY_CONFIRMED。sample-console/dev-host 直接消费者已列出，但 `ui/base/input` 旧数字测试分母未列出，见 M-01。
- S-3：REJECTED_WITH_EVIDENCE。详设和计划复用既有 `DisplayMode`，不定义新的 `SurfaceKey` 类型。
- S-4：REJECTED_WITH_EVIDENCE。A 只证明 frame/canvas box；B 以实际宿主 content rect 为参照并要求四角真实 tap。
- S-5：REJECTED_WITH_EVIDENCE。display-context owner、TR-11 与 `onSurfaceHostChanged` 的 render-infrastructure-only 边界已写明。
- N-1（Web policy）：REJECTED_WITH_EVIDENCE。uniform contain 只保留为待 Dexter 确认的候选，未作为既定裁定；dev-host README 的旧语义仍需纳入文档回读，已成为主 agent 的修复项。

## L1/L2/L3/SAME_ROOT_SCAN/DESIGN_GAPS

L1_ENGINEERING=NO-GO（审查时）：host measurement context、DisplayMode、bridge、no-fallback、公共契约边界基本闭合；旧 input fixture denominator 未闭合。

L2_USER_VISIBLE=NO-GO（审查时）：旧 keyboard/scroll/provider oracle 可能掩盖新画布下键盘高度、可见性和 unsupported 行为偏差。

L3_UNVERIFIED=CP-0/CP-7 的 RN surface、transform/hit-test、IME、scroll、DisplayMetrics/PixelRatio、Web viewport/elementFromPoint、Android/Web 运行与 cleanup 均未运行；portrait profile 与 Web preview policy 仍未得到 Dexter 裁决。

SAME_ROOT_SCAN=FOUND_GAP：审查确认的同根漏项是 ui/base/input 测试树；未发现第二 bridge、SurfaceKey 新类型、公共契约扩张、input 平台泄漏、fallback 或未授权动态承诺。

DESIGN_GAPS=审查时存在 M-01 与 N-01；主 agent 在本报告之后已扩展 CP-1 denominator 至九组并建立三棵测试树的逐项分类，且以本 remediation cycle ID 保存本报告。由于本 cycle 已达到两轮上限，不再召集第三轮；上述 post-review 文档修复不写成独立 reviewer GO。

## 主 agent post-review 处置

主 agent 逐条重开并确认 M-01：`ui/base/input` 的旧数字命中确实存在，但它们不应自动变成 sample declaration 依赖。已在：

- `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-design-codex.md` 第 72 行：将三棵测试树纳入旧 shape/基线分母，并定义 input fixture 分类；
- `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-implementation-plan-codex.md` 第 100、112-126 行：纳入四个 ui/base/input 测试文件，分母改为九组，明确中性 fixture/新画布派生预期的处置与未分类停机；
- 同计划第 247 行附近的文档回读约束：dev-host README 的旧 width-only `scaleToFit` 只能改成 Web policy OPEN/待 Dexter 确认。

这些是文档处置记录，不是独立 reviewer 的重新 verdict，也不是源码、编译或运行证据。实施仍未获授权；动态 CP-0/CP-7 必须在后续获得实施与运行授权后按计划真实执行。
