# TER selector 订阅规范与订阅边界收紧 · DESIGN review 交接请求

REVIEW_TARGET=DESIGN
REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
DESIGN_GRANULARITY_MANIFEST=N/A_WITH_REASON：项目规则已明确退役 implementation-design-granularity 控制面，本轮不创建或运行该 manifest/checker
ADVERSARIAL_REVIEW_REPORT=doc/review/platform/2026-09-17-ter-selector-subscription-performance-independent-review-codex.md
REVIEW_STATUS=OPEN
CODEX_SIDE_INDEPENDENT_REVIEW=ROUND_2_COMPLETE_WITH_OPEN_VERIFICATION
IMPLEMENTATION_AUTHORITY=false
SCOPE_DECISION=方案二：本批不主张性能改善，render isolation 只作为 selector-aware 订阅契约的行为结果
PATH_NOTE=文件名沿用创建时的路径以保持既有引用稳定；本批口径以当前标题与 SCOPE_DECISION 为准，不代表性能改善任务
POST_CLAUDE_REVIEW_DISPOSITION=NO-GO(1M/3S/3N) 已按 Dexter 选择方案二修订；本版本等待 Claude 复评

## 背景

本轮要把 TER React UI 的 selector 调用方式提升为框架级规范，并收紧 React UI 与外部 state source 的订阅边界。当前 `useRenderSnapshot` 以完整 `RenderSnapshot` 订阅 state source，`useUiStateSelector` 只在 render 之后缓存 selector 计算结果；因此当前实现没有提供按选择结果隔离订阅的契约。Reselect 可以缓存派生计算和结果引用，但不能替代 selector-aware external-store subscription。本批不主张性能改善、性能数字或用户感知改善；render isolation 只作为要验证的框架行为性质。

Codex 侧已完成两轮 fresh 只读 DESIGN 对抗审查：Round 1 暴露 3M/1S/1N，已逐条修订；Round 2 一名 reviewer 复核为 `GO_WITH_OPEN_VERIFICATION 0M/0S/0N`，另一名因未完成指定材料读回而提前结束，主 agent按项目规则接管其未完成核验并留痕。该结果不是 Claude/Dexter 的最终 verdict。

本次 Codex 只完成了 implementation-facing 详设、实施计划与本交接请求，并根据 Dexter 选择方案二修订了 scope 与 Claude finding 处置；没有修改源码、测试、依赖、规范、脚本或构建产物，也没有执行 typecheck、owned test、terminal static、Web、Metro、Android、DEV、设备或部署。Roadmap 的现行授权字段不被本请求扩展；implementation 仍未获授权。

## 评审目标

请独立判断：

1. 选定的 `use-sync-external-store/with-selector` 方案是否以足够小的改动建立“无关 root 更新且选择结果相等时不重新 render”的订阅契约，而不是只增加 Reselect/cache；不把该契约误读为已经证明的性能改善；
2. `useUiStateSelector`、`useRenderStatus`、`useUiCatalogContext` 的公共边界、root unavailable、selector identity、equality 和 derived reference 语义是否完整；
3. 拟新增的终端规范 `TR-15` 是否足以形成可执行的 selector 调用标准，且没有误伤 kernel actor/foundation 的非 React `getState()`；
4. 五个 direct full-snapshot production consumers、两个共享 hook、admin raw state pass-through 的迁移分母是否闭合；
5. focused render-count oracle、static boundary rule、真实 red mutation、证据分档和三维/逐代码对账是否能防止“测试名/selector call count/字符串匹配伪装成订阅契约成立”；
6. 方案是否无意改变 TER 现有 screen/layer/admin 行为，是否把不属于本批的列表 virtualization、设备性能数字、性能基线或动态环境正确留在范围外；并核对已补充的通知量/selector 执行成本取舍说明。

## 需阅读文件

- `doc/plans/platform/2026-09-17-ter-selector-subscription-performance-implementation-design-codex.md`：本批 implementation-facing 详设、TR-15 草案、公共 API、消费者全集、验收执行体与证据边界；
- `doc/plans/platform/2026-09-17-ter-selector-subscription-performance-implementation-plan-codex.md`：B0–B4 实施顺序、red mutation、三维对账、逐代码与详设对账及交付闸门；
- `doc/review/platform/2026-09-17-ter-selector-subscription-performance-independent-review-codex.md`：Codex 侧两轮 fresh 只读审查、finding 处置、Round 2 收口和未执行证据档位；
- `apps/terminal/ui/base/render/src/hooks/useUiStateSelector.ts`：当前 selector/cache hook，核对它是否仍订阅完整 snapshot；
- `apps/terminal/ui/base/render/src/hooks/useRenderSnapshot.ts`：当前 full-snapshot public hook，核对删除/迁移分母；
- `apps/terminal/ui/base/render/src/hooks/useUiVariable.ts`：共享 hook 的当前 snapshot 依赖；
- `apps/terminal/ui/base/render/src/foundations/createRenderSnapshotReader.ts`：status-first、root identity 与 snapshot 稳定性；
- `apps/terminal/ui/base/render/src/contexts/RenderContext.ts`：state source、snapshot reader 和 framework seam；
- `apps/terminal/ui/base/render/src/components/RenderProvider.tsx`：当前 status subscription 与 context 构造；
- `apps/terminal/ui/base/render/src/components/ScreenContainer.tsx`、`apps/terminal/ui/base/render/src/components/LayerStack.tsx`：两个完整 snapshot 的 render consumers；
- `apps/terminal/ui/base/admin-shell/src/components/AdminLauncher.tsx`、`AdminShellLaptop.tsx`、`AdminShellMobile.tsx`：admin 的完整 snapshot 与 raw state 传递；
- `apps/terminal/ui/base/admin-shell/src/components/AdminSectionContent.tsx`、`apps/terminal/ui/base/admin-shell/src/types/adminSection.ts`、`apps/terminal/ui/base/admin-shell/src/components/sections/DisplayContextSection.tsx`、`RuntimeSection.tsx`：admin section contract 与直接状态读取；
- `apps/terminal/ui/base/render/test/renderState.test.tsx`、`renderProps.test.tsx`、`renderSurface.test.tsx`、`layerStack.test.tsx`：现有 selector/snapshot/renderer 行为测试与 test-only full-root 例外；
- `apps/terminal/ui/base/admin-shell/test/adminLauncher.test.ts`、`adminLayout.test.ts`、`adminSections.test.tsx`：admin 迁移回归分母；
- `apps/terminal/ui/base/render/package.json`、`src/index.ts`、`terminal-invariants.json`：直接依赖与公共面；
- `tools/terminal-ui-render/check-static.mjs` 及其 self-test：现有静态门能力和新增边界的可复用落点；
- `doc/platform/terminal-coding-standard.md`：现有 TR-03 selector 跨包读规则，核对拟新增 TR-15 是否互补；
- `project-memory/decisions/deterministic-context-only.md`、`project-memory/operations/implementation-source-reread-discipline.md`、`project-memory/practices/cache-invalidation-granularity.md`、`project-memory/practices/reuse-projection-within-request.md`：上下文、缓存粒度与逐点双读约束；
- `doc/decisions/templates/implementation-design-template.md`、`doc/platform/review-standard.md`、`doc/platform/claude-review-handoff-template.md`：详设与 review 动作要求。

## 独立核验重点

1. 从 `useUiStateSelector` 的实际调用链核对当前订阅边界是否粗于选择边界；给出 root 新引用但选择结果相等时当前组件为何仍会 render 的机制反例，但不要把它升格为已测得的性能问题或改善幅度。
2. 反向挑战方案 C：比较 Reselect-only、独立 Context、手写 `useSyncExternalStore` wrapper 与官方 `with-selector` shim 的真实边界；特别检查直接依赖是否合理、是否会引入第二份 store/Provider。
3. 核对 `useSyncExternalStoreWithSelector` 的 snapshot/root/equality 语义：root unavailable 不调用业务 selector；selector identity 变化仍生效；derived object/array 的 equality 不会吞掉真实字段变化。
4. 用 `rg` 重新枚举所有 `useRenderSnapshot` 生产调用、`stateRoot/stateSource` admin pass-through、已有 `useUiStateSelector` 和非 React `getState()`；判断详设 §6/§9.2 是否漏项。
5. 检查 `useUiCatalogContext` 是否是必要的共享 adapter，还是可以用更小的现有 selector 组合替代；如果保留，核对 equality 是否覆盖它实际返回的全部字段。
6. 逐条挑战 TR-15：纯度、参数 selector identity、equality 稳定性、Reselect 的正确定位、render framework/test exception，以及它是否误伤 actor/foundation。
7. 逐条检查 F-1～F-12 的执行体：把“full snapshot subscription”“删除 equality”“stale dependency”“status 读 root”“恢复 raw pass-through”“删除 static rule”等 red mutation 代入，确认订阅契约缺陷真实发生时对应判据必红；F-4 还需核对 `undefined` 与 lifecycle status 的边界。
8. 核对 `tools/terminal-ui-render/check-static.mjs` 能否在现有 checker 中表达新增机械边界；不能机械证明的语义不得被字符串匹配冒充。
9. 核对 B0→B1→B2→B3→B4 顺序、每 CP 的 fresh 三维对账、全批测试前全批对账和交付前逐代码/详设对账是否互不替代。
10. 确认文档没有把 focused/static 证据升级成 native/Android/Web/release/visual/动态性能或性能改善结论，也没有偷偷授权 implementation；确认方案二的 scope 改写在详设、计划与交接中一致。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并报告 `M` / `S` / `N` 数量。请特别复核本轮对 Claude 上次 `NO-GO(1M/3S/3N)` 的处置：M-1 采用 Dexter 选择的方案二；S-1/S-2/S-3 与 N-1/N-2/N-3 已改文档但尚未执行。每条 finding 请标注：

- `CONFIRMED` / `PARTIALLY_CONFIRMED` / `REJECTED_WITH_EVIDENCE` / `UNVERIFIED_REQUIRES_EVIDENCE` / `DEXTER_DECISION`；
- 精确仓库相对路径、symbol 或行号、影响面、最小修复建议；
- 仓内事实、推论和仍缺证据的假设；
- 如果不同意，请给出可复现反例；
- 若涉及产品 Journey、用户可见行为、授权或范围扩大，单独标 `需 Dexter 裁决`。

请区分 `static`、`focused`、`native/Android`、`Web`、`release/visual`、`cleanup` 证据；当前实现尚未开始，任何未执行档位都不能写成 PASS。

## 授权边界

本轮只授权评审详设、实施计划和 review handoff，不授权修改源码、测试、依赖、脚本、规范或构建产物，不授权 typecheck/test/static、Web、Metro、Android、DEV、设备、seed、UAT、部署或 Git 操作。设计 review GO 也不等于 implementation authority；是否进入实施由 Dexter 另行决定。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助独立评审 TER React UI selector 订阅规范与订阅边界收紧的 implementation-facing 详设与实施计划。

背景：本轮目标是把 TER React UI 的 selector 调用方式提升为框架级规范，并收紧订阅边界。当前 `useRenderSnapshot` 以完整 `RenderSnapshot` 订阅 TER state source，`useUiStateSelector` 只在组件 render 之后缓存 selector 计算结果；root 以新引用更新时，当前实现没有按选择结果隔离订阅的契约。Reselect 能缓存派生计算和结果引用，但不能替代 selector-aware external-store subscription。Dexter 已选择方案二，因此本批不主张性能改善或任何性能数字；render isolation 只作为行为契约核验。本轮 Codex 仅修订详设、计划和交接，没有修改源码或执行验证。

目标：请站在实施方立场独立核验方案是否建立了正确的订阅边界，`useUiStateSelector`、`useRenderStatus`、`useUiCatalogContext` 的公共边界与 selector 调用规范是否完整，TR-15 是否能作为 TER 框架级规范，生产消费者分母是否闭合，以及 focused/static 判据和真实 red mutation 是否能在订阅契约缺陷发生时变红。不要把本批结果解释为性能改善证据。

请从 catering-v2s 仓库根阅读：
- `doc/plans/platform/2026-09-17-ter-selector-subscription-performance-implementation-design-codex.md`：详设、TR-15 草案、API、消费者全集和验收执行体；
- `doc/plans/platform/2026-09-17-ter-selector-subscription-performance-implementation-plan-codex.md`：B0–B4 顺序、red mutation、三维对账和逐代码与详设对账；
- `apps/terminal/ui/base/render/src/hooks/useUiStateSelector.ts`、`useRenderSnapshot.ts`、`useUiVariable.ts`：当前 selector 与 full snapshot 订阅；
- `apps/terminal/ui/base/render/src/foundations/createRenderSnapshotReader.ts`、`src/contexts/RenderContext.ts`、`src/components/RenderProvider.tsx`：snapshot/status framework seam；
- `apps/terminal/ui/base/render/src/components/ScreenContainer.tsx`、`LayerStack.tsx`：render consumers；
- `apps/terminal/ui/base/admin-shell/src/components/AdminLauncher.tsx`、`AdminShellLaptop.tsx`、`AdminShellMobile.tsx`、`AdminSectionContent.tsx`、`src/types/adminSection.ts`、`src/components/sections/DisplayContextSection.tsx`、`RuntimeSection.tsx`：admin consumers 与 raw state pass-through；
- `apps/terminal/ui/base/render/test/renderState.test.tsx`、`renderProps.test.tsx`、`renderSurface.test.tsx`、`layerStack.test.tsx`、`apps/terminal/ui/base/admin-shell/test/adminLauncher.test.ts`、`adminLayout.test.ts`、`adminSections.test.tsx`：现有 focused 分母；
- `apps/terminal/ui/base/render/package.json`、`src/index.ts`、`terminal-invariants.json`、`tools/terminal-ui-render/check-static.mjs`：依赖、public surface 与静态门；
- `doc/platform/terminal-coding-standard.md`、`project-memory/decisions/deterministic-context-only.md`、`project-memory/operations/implementation-source-reread-discipline.md`、`project-memory/practices/cache-invalidation-granularity.md`、`project-memory/practices/reuse-projection-within-request.md`：规范与记忆约束。

请重点独立核验：
1. 当前 hook 是否确实因完整 root snapshot 订阅而缺少按选择结果隔离的契约；Reselect-only 是否不能替代该订阅边界；官方 `use-sync-external-store/with-selector` 是否在不复制 store/不增加 Provider 的前提下足够；不要据此推导性能改善幅度；
2. `useUiStateSelector` 的 root unavailable、selector identity、默认 `Object.is`、派生 object/array equality 和 status-only subscription 是否闭合；
3. direct `useRenderSnapshot`、admin raw root/source pass-through、已有 selector callers 与 kernel 非 React `getState()` 的全集是否漏项；
4. TR-15 的纯度、稳定调用身份、Reselect 边界和窄例外是否可执行，哪些必须留给 focused/review 而不能伪装成 AST/字符串门；
5. F-1～F-12 与每个 red mutation 是否真能逮住对应订阅契约缺陷，尤其 F-4 是否明确 `undefined` 不能单独代表 lifecycle unavailable；B0–B4 的对账顺序是否正确，证据档位是否有过度宣称；

请给出明确 `GO` 或 `NO-GO`，并报告 `M` / `S` / `N` 数量。每条 finding 请标注状态、仓内事实/推论/尚缺证据、精确相对路径与 symbol/行号、影响面、最小修复建议和是否需 Dexter 裁决；不同意时请给出可复现反例。请分开报告 static、focused、native/Android、Web、release/visual、cleanup，未执行档位不得写成 PASS。

授权边界：本轮只评审详设、实施计划与交接，不授权修改源码、测试、依赖、脚本、规范或构建产物，不授权任何 typecheck/test/static、Web、Metro、Android、DEV、设备、seed、UAT、部署或 Git 操作。设计 review GO 不等于 implementation authority，是否进入实施由 Dexter 决定。本批不主张性能改善；若未来需要真实性能结论，必须另开有改前基线和独立授权的任务。谢谢。
```
