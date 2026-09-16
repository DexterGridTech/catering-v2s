# TER selector 订阅边界 B4 测试前全批对账

```text
REVIEW_KIND=FULL_BATCH_THREE_DIMENSIONAL_RECONCILIATION_AND_SOURCE_DESIGN_READBACK
REVIEW_TARGET=IMPLEMENTATION
FULL_BATCH_REVIEWER_KIND=FRESH_INDEPENDENT_READ_ONLY_SUBAGENT
FULL_BATCH_REVIEWER_NICKNAME=Lorentz
FULL_BATCH_REVIEWER_AGENT_ID=01a0ab53-4ccd-78a1-8a35-fbf62f2f2b9d
FULL_BATCH_THREE_DIMENSIONAL_RECONCILIATION=STATUS=MATCHED
B4_OVERALL_COMMANDS=STATUS=OPEN_NOT_RUN
AUTHOR_LINE_BY_LINE_DESIGN_READBACK=STATUS=MATCHED
```

## Fresh 全批三维对账

全批 reviewer 在任何整体 typecheck/test/static 之前，重新读取了当前详设、实施计划、Claude round2
GO review、终端 TR-03/TR-15、项目记忆、B0-B3 owning source 与 evidence，并逐项证伪：

1. Dexter 当前授权、详设/计划的 selector-aware subscription、公共面、scope 与证据边界；
2. 终端规范与项目记忆中的 owner、依赖、只读订阅、对账和失败处理约束；
3. 当前源码、依赖、lock、测试、static checker/self-test、README 和已有日志。

结果为 `FULL_BATCH_THREE_DIMENSIONAL_RECONCILIATION=STATUS=MATCHED`。reviewer 同时明确：B4 计划中的
七条整体命令尚未运行，保持 `B4_OVERALL_COMMANDS=STATUS=OPEN_NOT_RUN`，没有把它们升级为 PASS。

核对的关键边界：

| 边界 | 结果 | 证据 |
|---|---|---|
| `useUiStateSelector` / `useRenderStatus` / `useUiCatalogContext` 是当前 render 订阅面 | MATCHED | 当前 hooks、`RenderProvider`、`src/index.ts`、`b4-line-readback.log` |
| `useRenderSnapshot` 不再是生产/public 入口 | MATCHED | 旧文件缺失、invariant/index、production source scan、`render-selector-boundary` |
| public context 与 admin contract 不暴露 raw source/root | MATCHED | `RenderContextValue`、admin section types/consumers、`render-public-context-boundary`、`render-admin-state-pass-through` |
| direct dependency、React peer resolution 与 lock 一致 | MATCHED | render/terminal `package.json`、`yarn.lock`、B0 inventory、package boundary |
| selector identity、equality、status/unavailable/unsubscribe 行为有 focused/red 执行体 | MATCHED | render focused tests、`check-behavior.mjs`、B1 red-mutation log |
| TR-15、README、static rule 清单与源码一致 | MATCHED | terminal standard、render README、static checker/self-test、B3 evidence |
| 设备/Web/release/性能范围未被扩张 | MATCHED | 详设/计划 scope 与 evidence 分档 |

## 主 agent 逐代码与详设 §9a 对账

本表是主 agent 在整体命令前按详设 §9a、计划 §7 逐行/逐符号回读的结果；不是 fresh reviewer 的替代。
每项只使用 `MATCHED` / `OPEN`，当前所有已实施项均为 `MATCHED`。

| 详设 §9a 变更项 | 实际源码/证据落点 | 状态 |
|---|---|---|
| render direct runtime dependency 与 terminal peer-resolution anchor | `apps/terminal/ui/base/render/package.json`、`apps/terminal/package.json`、`yarn.lock`；B0 inventory | MATCHED |
| `@types/use-sync-external-store` direct devDependency | render `package.json`、lock、`render-package-boundary` dependency mutation | MATCHED |
| selector hook | `apps/terminal/ui/base/render/src/hooks/useUiStateSelector.ts`；B1 focused/red mutation | MATCHED |
| status hook | `apps/terminal/ui/base/render/src/hooks/useRenderStatus.ts`；B1 status proof | MATCHED |
| catalog adapter/equality | `apps/terminal/ui/base/render/src/hooks/useUiCatalogContext.ts`；catalog field mutation proof | MATCHED |
| public/private context seam | `src/contexts/RenderContext.ts`、`src/components/RenderProvider.tsx`；public-context and external-consumer red proof | MATCHED |
| old full-snapshot hook removal | `src/hooks/useRenderSnapshot.ts` absent、`src/index.ts`、`terminal-invariants.json` | MATCHED |
| render consumer migration | `ScreenContainer.tsx`、`LayerStack.tsx`、`useUiVariable.ts`；source readback与B1/B2行为日志 | MATCHED |
| admin consumer migration | `AdminLauncher.tsx`、`AdminShellLaptop.tsx`、`AdminShellMobile.tsx`、`DisplayContextSection.tsx`、`RuntimeSection.tsx` | MATCHED |
| admin contract收窄 | `AdminSectionContent.tsx`、`types/adminSection.ts`；admin typecheck/test evidence | MATCHED |
| focused tests | render `renderState.test.tsx`、`renderProps.test.tsx`及既有 render/admin tests；B1/B2 logs | MATCHED |
| behavior mutation harness | `tools/terminal-ui-render/check-behavior.mjs`；36 vectors与sandbox cleanup | MATCHED |
| public invariant | `apps/terminal/ui/base/render/terminal-invariants.json`；public surface static rule | MATCHED |
| static checker与self-test | `tools/terminal-ui-render/check-static.mjs`、`check-static.test.mjs`；10 rules、red mutations、cleanup | MATCHED |
| TR-15终端规范 | `doc/platform/terminal-coding-standard.md` | MATCHED |
| render README与源码示例 | `apps/terminal/ui/base/render/README.md`；`DisplayContextSection.tsx` / `RuntimeSection.tsx`回读 | MATCHED |
| active stale-contract audit | 当前 `apps/terminal/ui/**/src` 未发现生产 `useRenderSnapshot`；命中文档均为历史 review/旧设计记录或当前显式否认 | MATCHED |

## 测试前状态

- B0/B1/B2/B3 步骤级三维对账：均有 fresh 只读留痕且为 `MATCHED`。
- 全批三维对账：`MATCHED`，记录于本文件头部和 reviewer 输出。
- 主 agent 逐代码与详设对账：`MATCHED`，证据为 `.runtime/ter-selector-subscription/2026-09-17/b4-line-readback.log` 与本表。
- 七条整体命令：`OPEN_NOT_RUN`；只有完成上述对账后才获准执行。
- native/Android/Web/release/visual/cleanup 与真实性能结论：按详设保持 `NOT_APPLICABLE_WITH_REASON` 或 `OPEN`，不得由本次对账升格。
