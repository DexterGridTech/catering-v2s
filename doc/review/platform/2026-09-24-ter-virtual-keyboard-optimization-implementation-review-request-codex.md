# TER 虚拟键盘优化 IMPLEMENTATION 静态 review handoff

REVIEW_TARGET=IMPLEMENTATION
IMPLEMENTATION_AUTHORITY=true
IMPLEMENTATION_AUTHORITY_SOURCE=Dexter 本轮明确授权：清理调试日志，检查键盘优化代码的内存与效率风险；若无未解决风险，组织话术交 Claude 做静态 review
VISUAL_REVIEW=用户已手工体验 Web 与虚拟机端通过；本轮不再补采集计划中的动态/视觉完成证据，Claude 不应将用户体验结论扩写成仓内机器证据

## 背景

TER 虚拟键盘优化已按既有需求、IA、交互设计、详设和实施计划完成代码实施。Dexter 已明确说明 Web
端与虚拟机端均已手工体验通过，本轮目标收窄为：移除本次排障临时加入的输入诊断日志链，检查实现是否
引入内存或效率风险，然后交 Claude 做独立静态 implementation review。本轮不再为了补齐计划中的
截图、逐帧、逐控件或 runner 证据而反复运行动态验证。

本轮已完成的源码收口包括：

- 移除 `InputDiagnostic` 类型、context、provider prop、reporter 调用及测试中的临时诊断断言；保留
  console-assembly 既有 startup/display 必要日志，不把生产可观测性误删为 debug cleanup；
- 修复 Web React Native 事件的 `nativeEvent.target` 命中，以及 pending virtual field 被 surface
  click 错误清除的问题；
- 将实测键盘高度缓存限制在当前 surface 几何代际：窗口宽高变化时清空缓存，避免长期 resize 使
  `Map` 无界累积；当前几何最多保留四种键盘布局的实测值；
- 保留单一 `Animated.Value`、动画取消/unmount cleanup、单次滚动请求与 generation/readback 边界。

首轮并行执行时 `sample-console/test/testExpoApp.test.tsx` 曾出现 5000ms timeout；回读测试脚本后确认
该批包测试由多个包并行启动，且包脚本没有把命令行的 `--runInBand` 传给 Vitest。按 log-first 规则
未修改 timeout 或断言，改为独立运行：该测试 PASS，随后 sample-console 全量 8 files、52/52 PASS。

## 评审目标

请独立判断当前键盘优化生产源码、focused 测试和本轮 debug cleanup 是否存在内存、CPU、渲染、动画、
滚动调度、订阅/定时器生命周期或缓存失控风险，并判断修复是否保持正式需求和详设的行为边界。

请把结论分为：

- `L1_ENGINEERING`：源码、生命周期、缓存、渲染和测试契约；
- `L2_USER_VISIBLE`：仅评价与需求/IA 一致性。动态方面请明确区分 Dexter 的手工体验结论与仓内未新增的机器证据；
- `L3_UNVERIFIED`：本轮按授权不再采集的截图、逐帧、逐控件、runner、Web L2 或设备证据。

如果发现风险，请给出精确路径和行号、first failure/last known good/broken boundary、影响面、最小根因
修复建议，以及是否需要 Dexter 产品裁决。不要把静态测试通过、用户手工体验或 cleanup 结论升级为完整
视觉/业务验收通过。

## 需阅读文件

请从 `catering-v2s` 仓库根阅读：

- `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-formal-requirements-codex.md`：正式需求与范围；
- `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-ui-interaction-design-codex.md`：键盘形态、交互与动画视觉规则；
- `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-ia-design-codex.md`：布局与用户可见控件分母；
- `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-implementation-design-codex.md`：owner、测量、呈现、滚动与性能契约；
- `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-implementation-plan-codex.md`：CP-0 至 CP-4 与 focused/交付边界；
- `apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx`：每 surface 的呈现状态机、实测高度缓存、动画与内容位移；
- `apps/terminal/ui/base/input/src/components/InputProvider.tsx`：输入 owner、pending focus、字段注册与状态快照；
- `apps/terminal/ui/base/input/src/components/InputScrollArea.tsx`：ScrollView 边界测量、单次滚动、generation 与 readback；
- `apps/terminal/ui/base/input/src/components/VirtualKeyboard.tsx`：键盘渲染、键帽 handler memoization 与布局开销；
- `apps/terminal/ui/base/input/src/foundations/keyboardLayout.ts`、`keyboardHeight.ts`、`keyboardPresentation.ts`：冻结布局、容量计算与分段动画轨迹；
- `apps/terminal/ui/base/input/src/contexts/context.ts`、`apps/terminal/ui/base/input/src/types/types.ts`：cleanup 后 public/internal API；
- `apps/terminal/ui/base/input/test/`：input focused 测试与行为边界；
- `apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx`：startup/display 必要日志与 assembly 侧 input 接线；
- `apps/terminal/ui/integration/sample-console/test/`、`apps/terminal/ui/integration/sample-wallpaper-console/test/`：两个 integration 的静态/focused 消费者回归；
- `apps/terminal/ui/base/input/package.json`、`apps/terminal/ui/base/console-assembly/package.json`、两个 integration 的 package.json：测试与 typecheck 入口。

## 独立核验重点

### 已完成的静态结果

- input focused：11 files、96/96 PASS；input typecheck PASS；
- console-assembly focused：6 files、15/15 PASS；console-assembly typecheck PASS；
- sample-console 独立全量：8 files、52/52 PASS；typecheck PASS；
- sample-wallpaper-console focused：4 files、26/26 PASS；typecheck PASS；
- `git diff --check` PASS；输入诊断符号扫描不再命中 `InputDiagnostic`、`onDiagnostic`、
  `useInputDiagnostic`、`reportDiagnostic` 或 `input.diagnostics`。

### 请证伪的工程风险

1. `InputSurfaceFrame.tsx:238-250,479-494` 的每 surface 单一动画与实测高度 cache 是否确实有界；
   尤其确认宽高变化清空 cache 不会造成错误复用或反复测量抖动。
2. `InputSurfaceFrame.tsx:647-702` 是否在重定向、handoff、exit、unmount 和异常完成路径停止旧
   animation，且没有 listener、timer 或 JS 每帧回调泄漏；250ms/native-driver 选择是否保持详设语义。
3. `InputScrollArea.tsx:33-210` 是否只保留当前 request 的测量/readback，过时 generation 不会触发
   scroll 或 focus commit；稳定态与动画起点是否不会重复发出滚动。
4. `VirtualKeyboard.tsx:153-163` 的静态 definition、regions 与 handlers 是否只在 layout/shift/
   next-field/handler 变化时重建，没有每帧重建键盘或无界闭包增长。
5. `InputProvider`/field registry 的 Map 是否随字段 unregister 收敛；pending target、presentation
   snapshot 和 outgoing/incoming layer 是否存在异常路径累积。
6. debug cleanup 是否只删除临时诊断链；既有 startup/display/error 日志是否仍保留且没有敏感数据。
7. 不要把测试中预期的 `power-bridge.subscription-unavailable` capability warning 误判成键盘
   debug 残留；请判断它是否为既有无 adapter 测试环境事实。

### 本轮明确不补的证据

- 不再启动 Web/Metro/Android/设备，不再运行动态 runner，不再补 19 帧截图、逐帧动画、逐控件视觉、
  URL 十字符全路径或 Web L2 证据；
- Dexter 的 Web 与虚拟机手工体验“通过”作为用户验收输入保留，但仓内本轮没有新增机器证据；
- 未覆盖项请标 `OPEN`、`NOT_COVERED_BY_PRODUCT_CONSUMER` 或 `USER_OBSERVED_ONLY`，不要静默升级。

## 期望结论

请给出明确的：

```text
REVIEW_TARGET=IMPLEMENTATION
VERDICT=GO | NO-GO | GO_WITH_OPEN_EVIDENCE
M/S/N=<数字>/<数字>/<数字>
```

请按 `L1_ENGINEERING`、`L2_USER_VISIBLE`、`L3_UNVERIFIED` 分档；每条 finding 给出精确仓库相对
路径与行号、影响、first failure、last known good、broken boundary、最小修复建议，以及是否需要
Dexter 裁决。若详设没有覆盖某个性能/生命周期问题，请标记 `DESIGN_GAP`。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助对 TER 虚拟键盘优化当前 IMPLEMENTATION 做静态独立复核。

背景：Dexter 已手工体验确认 Web 端和虚拟机端通过，本轮不再补采集计划中的动态、截图、逐帧或逐控件完成证据。当前工作只收口临时输入调试日志，并检查键盘优化代码的内存、CPU、渲染、动画、滚动调度、订阅/定时器生命周期与缓存风险。源码中已移除 InputDiagnostic 类型/context/provider bridge、reporter 调用和测试诊断断言；保留 console-assembly 原有 startup/display/error 必要日志。另修复了 Web nativeEvent.target 的输入命中和 pending virtual field 被 surface click 清除的问题，并将 InputSurfaceFrame 的实测高度缓存限制为当前 surface 几何代际；宽高变化即清空，避免长期 resize 无界增长。

静态结果：input 11 files/96 tests、console-assembly 6 files/15 tests、sample-console 8 files/52 tests、sample-wallpaper-console 4 files/26 tests 均 PASS；四个相关包 typecheck PASS，git diff --check PASS。sample-console 曾在跨包并行执行时出现一个 5000ms timeout；按 log-first 读取测试与脚本后未改 timeout/断言，改为独立运行，单测及全量均 PASS，因此请把它视为已诊断的并行资源假失败，不要把它写成源码回归。测试里已有的 power-bridge.subscription-unavailable 是无 adapter 环境 warning，不是本轮键盘 debug 日志。

目标：请独立判断当前实现是否有内存泄漏、无界缓存、动画/滚动生命周期泄漏、每帧 JS 开销、重复渲染或闭包增长，并确认 debug cleanup 没有误删必要 startup/display 可观测性；同时核对需求、IA、详设和实现边界是否仍成立。请把结果分为 L1_ENGINEERING（源码与静态契约）、L2_USER_VISIBLE（只评价需求一致性）和 L3_UNVERIFIED（本轮不再采集的动态/视觉/业务证据）。Dexter 的手工体验结论请标为 USER_OBSERVED_ONLY，不要扩写成仓内机器证据。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-formal-requirements-codex.md：正式需求；
- doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-ui-interaction-design-codex.md：交互/视觉规则；
- doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-ia-design-codex.md：布局和控件分母；
- doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-implementation-design-codex.md：owner、测量、呈现、滚动和性能契约；
- doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-implementation-plan-codex.md：CP-0 至 CP-4 边界；
- apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx：呈现状态机、实测高度 cache、Animated.Value、cleanup；
- apps/terminal/ui/base/input/src/components/InputProvider.tsx：owner/pending/registry 状态；
- apps/terminal/ui/base/input/src/components/InputScrollArea.tsx：ScrollView 测量、generation、单次 scroll 和 readback；
- apps/terminal/ui/base/input/src/components/VirtualKeyboard.tsx：布局渲染和 handler memoization；
- apps/terminal/ui/base/input/src/foundations/keyboardLayout.ts、keyboardHeight.ts、keyboardPresentation.ts：布局、容量和动画轨迹；
- apps/terminal/ui/base/input/test/、apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx、两个 integration 的 test/：focused 与接线回归。

请重点证伪：InputSurfaceFrame 的 cache 是否有界且不会错误复用；动画是否在重定向/exit/unmount 停止且无 listener/timer 泄漏；InputScrollArea 的 stale generation 是否不会重复滚动或提交；VirtualKeyboard 是否没有每帧重建；字段 registry 与 presentation snapshot 是否能收敛；临时 debug 日志是否清干净而必要 startup/display/error 日志仍在。请记录 first failure、last known good、broken boundary 和最小修复建议；详设没有覆盖的性能/生命周期问题请标 DESIGN_GAP。

烦请给出明确 REVIEW_TARGET=IMPLEMENTATION、VERDICT=GO/NO-GO/GO_WITH_OPEN_EVIDENCE 与 M/S/N。请区分静态、focused、Web、Android/native/device、visual、business、cleanup；本轮不要使用 computer use，不要修改文件，不要启动设备或补采集动态证据。

授权边界：本轮只请求代码和静态实现 review；不授权扩大功能、不改登录/业务/keyboard 语义、不删除历史证据、不把用户手工体验或 focused PASS 升级为完整视觉/业务验收。谢谢。
```
