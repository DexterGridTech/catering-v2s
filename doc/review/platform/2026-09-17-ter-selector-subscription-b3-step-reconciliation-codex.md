# TER selector 订阅边界 B3 步骤级三维对账

```text
REVIEW_KIND=STEP_THREE_DIMENSIONAL_RECONCILIATION
REVIEW_TARGET=IMPLEMENTATION_STEP
STEP=B3
REVIEWER_KIND=FRESH_INDEPENDENT_READ_ONLY_SUBAGENT
REVIEWER_NICKNAME=Banach
REVIEWER_AGENT_ID=01a0ab51-2c4b-77f1-a737-541d91f3bb25
B3_STEP_RECONCILIATION=STATUS=MATCHED
```

## 对账范围

本次 reviewer 重新读取了当前详设、实施计划、终端规范、项目执行规则、render/admin owning
source、`tools/terminal-ui-render/check-static.mjs` 及 self-test、B0-B2 与 B3 evidence。对账三维为：

1. 当前 Dexter 授权、详设/计划的 B3 目标与证据边界；
2. `doc/platform/terminal-coding-standard.md` 的 TR-03/TR-15 及命中的项目记忆；
3. 当前源码、静态规则、red mutation、baseline、cleanup 与 README。

## 逐项结果

| 项目 | 结果 | 证据 |
|---|---|---|
| TR-15 入口、纯 selector、identity、派生引用、Reselect 边界与窄例外 | MATCHED | `doc/platform/terminal-coding-standard.md`；`apps/terminal/ui/base/render/README.md`；render hooks 与既有 owner selector callers |
| public context 不暴露 raw source/snapshot reader | MATCHED | `RenderContextValue` 与 `render-public-context-boundary`；self-test 同时覆盖定义变异与外部 consumer 变异 |
| 旧 full-snapshot hook 不回流 | MATCHED | `render-selector-boundary`；`useRenderSnapshot` production source exact scan；`b3-static-model.log` |
| direct runtime/type dependency 与 public surface/invariant 闭包 | MATCHED | `render-package-boundary`、`render-public-surface`；直接依赖缺失 mutation 均变红 |
| admin raw state pass-through | MATCHED | `render-admin-state-pass-through`；外部 `useRenderContext().stateSource` fixture 变异变红 |
| 静态规则 baseline、真实 mutation 与 cleanup | MATCHED | `.runtime/ter-selector-subscription/2026-09-17/b3-static-model.log`；`.runtime/ter-selector-subscription/2026-09-17/b3-static-production.log` |
| B1/B2 既有订阅与行为边界未被 B3 文档/工具改动破坏 | MATCHED | `b1-red-mutations.log`、`b2-admin-test.log`、当前 source readback |
| 性能/设备/Web/Android scope 未被扩张 | MATCHED | 详设/计划 scope 与证据档位；无性能数字或未授权动态结论 |

## OPEN 处置记录

第一名 B3 reviewer 曾指出外部 production raw-context consumer 的 red proof 缺失，状态为 OPEN。主
agent 在 `tools/terminal-ui-render/check-static.test.mjs` 增加了真实 fixture 变异：

```ts
const readRawStateSource = () => useRenderContext().stateSource
```

该变异由现有 `render-admin-state-pass-through` 规则捕获并输出 `FAIL`，fixture cleanup 为 PASS；第二名
fresh reviewer 重新核验后给出唯一结论 `B3_STEP_RECONCILIATION=STATUS=MATCHED`。这不是把第一次 OPEN
覆盖掉，而是记录其最小修复及 fresh 复查结果。

## 当前 evidence

- B3 model baseline 与所有 red mutation：`.runtime/ter-selector-subscription/2026-09-17/b3-static-model.log`；日志保留了首次规则清单不同步的失败、修复后的完整 mutation 与 cleanup。
- B3 production static：`.runtime/ter-selector-subscription/2026-09-17/b3-static-production.log`；10 条 static rules 与 support 均 PASS。
- B0 source/dependency inventory：`.runtime/ter-selector-subscription/2026-09-17/b0-source-dependency-inventory.log`。
- B1 behavior/red mutation：`.runtime/ter-selector-subscription/2026-09-17/b1-red-mutations.log`。
- B2 admin typecheck/test：`.runtime/ter-selector-subscription/2026-09-17/b2-admin-typecheck.log`、`.runtime/ter-selector-subscription/2026-09-17/b2-admin-test.log`。

本记录只证明 B3 步骤级三维对账闭合，不替代全批三维对账、逐代码与详设对账、七条整体命令或最终
implementation review。
