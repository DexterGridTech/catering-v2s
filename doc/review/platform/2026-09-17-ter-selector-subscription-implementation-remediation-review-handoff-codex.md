# TER React UI selector 订阅边界 implementation remediation review 交接

```text
REVIEW_TARGET=IMPLEMENTATION
IMPLEMENTATION_AUTHORITY=true
REVIEW_STATUS=OPEN
IMPLEMENTATION_PASS=NOT_CLAIMED
ACCEPTANCE_PASS=NOT_CLAIMED
CLAIM_BOUNDARY=本轮只请求对 Claude 上一轮代码逻辑复评提出的 S-1、N-1、N-2 做源码复核；不把此前 GO 扩写为 implementation/acceptance，不背书未由本轮 Claude 核验的 evidence、对账或性能结论
SCOPE=仅默认 placement 引用稳定性、DisplayContextSection 生命周期/undefined 语义、订阅机制测试 full-root 例外注释
```

## 背景

Claude 对本批 selector subscription implementation 的上一轮复评记录在
`doc/review/platform/2026-09-17-ter-selector-subscription-implementation-review-claude.md`，结论为
`GO(0M/1S/2N)`。该复评明确只覆盖源码逻辑，没有核验七条命令、`.runtime/` 产物、步骤级/全批三维
对账、逐代码与详设对账、static/behavior mutation 是否实际执行，因而不构成 implementation acceptance。

本轮已在既有 implementation 授权内只处置这三个 finding：S-1 默认 placement 的引用稳定性、N-1
DisplayContextSection 的 lifecycle/undefined 边界、N-2 订阅机制专用 full-root 测试例外说明。没有改变
业务 Journey、ScreenContainer 失败分类/ready 分支、public 产品语义或本批“不产生性能结论”的边界。

## 评审目标

请独立核对：

1. `ScreenContainer` 是否在 selector 外以完整依赖构造稳定的默认 `ScreenPlacement`，且 persisted placement
   仍优先；配置默认 partKey 时无关 root 更新是否不再触发 screen render；新加的 production-like mutation
   是否确实会使对应 render-count oracle 失败，而不是只改测试或用 equality 掩盖问题；
2. `DisplayContextSection` 是否用 `useRenderStatus()` 判 lifecycle，started 后 owner selector 的
   `undefined` 是否只导致中性数据缺失文案，不再被解释为 runtime 尚未就绪；两条 focused behavior case
   是否真的覆盖这两个分支；
3. `renderProps.test.tsx` 的 full-root selector 是否明确标为订阅机制专用 test exception，且没有被误当作
   production UI 调用模板；
4. 本轮新增 source/focused/static 结果与首败是否诚实分档；不要把上一轮 source-only GO 或本轮局部验证说成
   implementation/acceptance PASS，也不要产生性能改善结论。

## 需阅读文件

请从 `catering-v2s` 仓库根打开：

- `doc/review/platform/2026-09-17-ter-selector-subscription-implementation-review-claude.md`：上一轮代码逻辑复评及 S-1、N-1、N-2 原始 finding；
- `doc/plans/platform/2026-09-17-ter-selector-subscription-performance-implementation-design-codex.md`：默认 placement、TR-15 undefined/status 语义和 focused 执行体；
- `doc/plans/platform/2026-09-17-ter-selector-subscription-performance-implementation-plan-codex.md`：B2 默认 placement identity 约束、本轮 remediation 处置表与验证边界；
- `doc/evidence/platform/2026-09-17-ter-selector-subscription-implementation-codex.md`：历史实施证据与本轮 §8 remediation 记录；
- `doc/platform/terminal-coding-standard.md`：TR-15 的 selector、undefined/status 和 test exception 正本；
- `apps/terminal/ui/base/render/src/components/ScreenContainer.tsx`：`defaultPlacement` 与 placement selector；
- `apps/terminal/ui/base/render/test/renderSurface.test.tsx`：默认 placement render-count focused oracle；
- `apps/terminal/ui/base/admin-shell/src/components/sections/DisplayContextSection.tsx`：lifecycle/data-missing 分支；
- `apps/terminal/ui/base/admin-shell/test/displayContext.test.tsx`：runtime status 与 owner undefined 的两条 focused case；
- `apps/terminal/ui/base/render/test/renderProps.test.tsx`：full-root 订阅机制专用 probe 及例外注释；
- `tools/terminal-ui-render/check-behavior.mjs`：`DEFAULT_PLACEMENT_IDENTITY` production-like red mutation；
- `.runtime/ter-selector-subscription/2026-09-17-remediation/`：本轮 red/green、typecheck、owned test、behavior 与 static 原始输出。

## 独立核验重点

- 对照 `ScreenContainer.tsx` 的 `defaultPlacement`、selector 依赖与 `persistedPlacement ?? defaultPlacement`，确认稳定引用没有被 equality 取巧替代；
- 复跑 `node tools/terminal-ui-render/check-behavior.mjs`，确认 `DEFAULT_PLACEMENT_IDENTITY` 的坏实现真实让 render-count focused oracle 失败，并确认 baseline/37 vectors/cleanup；
- 对照 `DisplayContextSection.tsx` 与 `displayContext.test.tsx`，确认 lifecycle 只由 `useRenderStatus()` 判定，started 后的 owner `undefined` 不再产生 lifecycle 文案；
- 对照 `renderProps.test.tsx` 与 TR-15，确认 full-root 仅为订阅机制测试例外且有说明，不成为 production UI 模板；
- 读取 `.runtime/ter-selector-subscription/2026-09-17-remediation/` 的原始输出，区分源码首败、runner cwd/config 首败、last known good 和最终 cleanup；不要把本轮局部 proof 或上一轮 source-only GO 升格为 implementation/acceptance PASS。

## 本轮处置与结果

| finding | 处置 | 当前源码落点 | 本轮结果 |
|---|---|---|---|
| S-1 | 真修复。默认 `partKey` 在 selector 外按 `useMemo<ScreenPlacement \| undefined>` 稳定化；selector 保持 persisted placement 优先；补无关 root 更新 render-count case 与真实坏实现 mutation | `ScreenContainer.tsx` lines 35–44；`renderSurface.test.tsx` lines 442–485；`check-behavior.mjs` lines 346–355 | 未修源码时 focused count `1→2` 红；修复后 focused PASS；behavior `DEFAULT_PLACEMENT_IDENTITY=PASS`，坏实现 exit=1 |
| N-1 | 真修复。先用 `useRenderStatus()` 判 lifecycle；started 且 role/instance 缺失时使用“显示上下文暂无数据”，不从 `undefined` 推断生命周期；补两个行为用例 | `DisplayContextSection.tsx` lines 9–20；`displayContext.test.tsx` lines 26–41 | 2 focused tests PASS；admin owned test 8 files/19 tests PASS |
| N-2 | 真修复。full-root selector 保留为订阅机制专用 probe，并写明不得作为生产 UI 模板 | `renderProps.test.tsx` lines 86–91 | render/admin owned tests 与 terminal static 均 PASS |

## 可复现核验

从仓库根可执行：

```bash
node tools/terminal-ui-render/check-behavior.mjs
yarn workspace @catering-v2s/ui-base-render typecheck
yarn workspace @catering-v2s/ui-base-render test
yarn workspace @catering-v2s/ui-base-admin-shell typecheck
yarn workspace @catering-v2s/ui-base-admin-shell test
yarn --cwd apps/terminal verify:static
```

本轮已获得的实际结果：

- `behavior-after-fix.log`：baseline 82 tests、37 个 red vectors，含 `DEFAULT_PLACEMENT_IDENTITY`，sandbox cleanup PASS；
- `render-typecheck-after-type-fix.log`、`admin-typecheck-after-type-fix.log`：typecheck PASS；
- `render-test-final-after-fix.log`：13 files / 82 tests PASS；
- `admin-test-final-after-fix.log`：8 files / 19 tests PASS；
- `terminal-static-after-fix.log`：最终 `TERMINAL_STATIC=PASS`；
- `s1-red-before-fix.log` 与 `s1-green-after-fix.log`：S-1 focused red→green；
- `admin-n1-focused-after-type-fix-correct.log`：N-1 两个 focused case PASS。

首败保持可见：

- `render-typecheck-after-fix.log` 记录了 S-1 初次实现的 TS2339 联合类型错误，随后用显式
  `ScreenPlacement | undefined` 修复；
- `render-s1-focused-after-type-fix.log` 与 `admin-n1-focused-after-type-fix.log` 记录了从仓根调用时重复拼接
  workspace 内 Vitest config 的 runner cwd/path 错误，随后用正确 workspace 工作目录重验；
- static 首次读取时停在模型测试，但真实进程仍在运行且日志继续推进，最终同一日志以
  `TERMINAL_STATIC=PASS` 收口；这不是源码首败。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并报告 `M` / `S` / `N` 数量。每条 finding 请给出精确仓库相对路径、symbol
或行号、违反的约束、影响、可复现核验方式、最小修复建议，并区分 `CONFIRMED`、`PARTIALLY_CONFIRMED`、
`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE`。本轮不需要 Dexter 产品裁决；如发现超出 S-1、N-1、
N-2 或需要改变产品/范围的事项，请单独标 `DEXTER_DECISION`，不要默默扩大范围。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对 TER React UI selector 订阅边界 implementation 的三条 remediation 做独立复评。

背景：你上一轮对 `doc/review/platform/2026-09-17-ter-selector-subscription-implementation-review-claude.md` 的代码逻辑复评结论是 GO(0M/1S/2N)，但你明确没有核验 evidence、`.runtime/`、三维对账、逐代码与详设对账、static/behavior mutation 执行结果或 implementation acceptance。本轮只在既有授权内处置 S-1、N-1、N-2，不改变业务 Journey、ScreenContainer 失败/ready 语义，也不产生任何性能结论。

目标：请独立核验三条是否真实关闭：
1. `ScreenContainer` 的默认 placement 是否在 selector 外以完整依赖稳定引用；配置默认 `partKey` 且无持久化记录时，无关 root 更新是否保持 screen render count 不变；`DEFAULT_PLACEMENT_IDENTITY` 的坏实现 mutation 是否真实让 focused oracle 变红；
2. `DisplayContextSection` 是否使用 `useRenderStatus()` 判 lifecycle，started 后 role/instance selector 返回 `undefined` 是否只显示中性数据缺失文案，不再推断 runtime 尚未就绪；两个 focused case 是否覆盖非 started 与 started+undefined；
3. `renderProps.test.tsx` 的 full-root selector 是否明确标为订阅机制专用 test exception，且没有被当成 production UI 模板。

请从 catering-v2s 仓库根阅读：
- `doc/review/platform/2026-09-17-ter-selector-subscription-implementation-review-claude.md`：原始 S-1/N-1/N-2；
- `doc/plans/platform/2026-09-17-ter-selector-subscription-performance-implementation-design-codex.md`：设计契约与 TR-15；
- `doc/plans/platform/2026-09-17-ter-selector-subscription-performance-implementation-plan-codex.md`：B2 约束、red mutation 与 remediation 处置；
- `doc/evidence/platform/2026-09-17-ter-selector-subscription-implementation-codex.md`：本轮 §8 处置、首败与证据分档；
- `doc/platform/terminal-coding-standard.md`：TR-15 正本；
- `apps/terminal/ui/base/render/src/components/ScreenContainer.tsx`、`apps/terminal/ui/base/render/test/renderSurface.test.tsx`：S-1 owning source 与 oracle；
- `apps/terminal/ui/base/admin-shell/src/components/sections/DisplayContextSection.tsx`、`apps/terminal/ui/base/admin-shell/test/displayContext.test.tsx`：N-1 owning source 与行为用例；
- `apps/terminal/ui/base/render/test/renderProps.test.tsx`：N-2 例外 probe；
- `tools/terminal-ui-render/check-behavior.mjs`、`.runtime/ter-selector-subscription/2026-09-17-remediation/`：新 red mutation 与本轮原始输出。

请重点核验：坏实现真的会红；修复后的 source/typecheck/focused/static 结果与日志相符；不要以测试名、退出码或作者自报数字替代业务 oracle。特别注意，`GO(0M/1S/2N)` 只是上一轮代码逻辑 review 的结论，本轮也不对未由你独立核验的 evidence、三维对账、implementation acceptance、Web/native/Android/release/visual 或性能结论背书。

请给出明确 `GO` 或 `NO-GO`，并报告 `M` / `S` / `N` 数量。每条 finding 请带精确仓库相对路径、symbol/行号、影响、核验方式、最小修复建议，并标明 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE` 或 `UNVERIFIED_REQUIRES_EVIDENCE`。本轮如发现必须改变产品语义或范围的事项，请标为 `DEXTER_DECISION`，不要自行扩大范围。

授权边界：本轮只授权对 S-1、N-1、N-2 做 implementation 源码逻辑复评；不授权新增产品机制、扩大 selector 迁移范围、修改既有失败/ready 语义、Web、Metro、Android、native/device、release、visual、seed、UAT、部署或真实性能研究。最终 implementation/acceptance 结论由 Dexter 与你依据当前源码和适用证据独立决定，Codex 不预先宣称 PASS。谢谢。
```
