# implementation code↔design 对账（Round 3，Ramanujan）

- `REVIEW_TARGET=IMPLEMENTATION_CODE_DESIGN_RECONCILIATION`
- `reviewerKind=INDEPENDENT_SUBAGENT`
- `REVIEW_ROUND=3`（实施阶段对账；不适用 DESIGN cycle 上限）
- 执行日期：2026-09-15
- `RECORD_STATE=PRE_D14_REPAIR_RECORD`
- `VERDICT=OPEN`
- `M/S/N=2/1/2`
- 限制：只读；未修改源码、文档、测试或工具；未执行 Web、Metro、DEV、Android、设备、seed、deploy 或 Computer Use。
- 说明：该记录审查了 shared console assembly 修复后的字节，但在主 agent 修复 D-14 统一关闭路径、补当前阶段记录与更新 focused evidence 之前形成；因此是当前修复的首败输入，不是最终交付 verdict。

## 已执行的只读核验

```text
node tools/terminal-skeleton/check-static.mjs
```

结果：

```text
RULE_GRAPH_COMPARISON=PASS
RULE_DEPENDENCY_DIRECTION=PASS
RULE_DEPENDENCY_DECLARATION_COMPLETENESS=PASS
RULE_RUNTIME_DEPENDENCY_CONTRACT=PASS
SCAFFOLD_HYGIENE=PASS
```

## Findings

### M-1 — system notice 的 backdrop / Android back 绕过 feature-owned dismiss intent（`CONFIRMED`）

详设 D-14 要求 dismiss button、LayerStack backdrop、Android back 三个入口都接同一 feature dismiss intent。button 走 feature command，但 `LayerStack` 的 backdrop 与 Android back 直接 dispatch `closeLayerCommand`：

- 详设：`doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-design-codex.md:760-766`
- notice parts 默认 `dismissible`：`apps/terminal/ui/feature/sample-wallpaper-picker/src/parts/parts.ts:20-32`；同类在 `sample-staff-auth`、`sample-member-desk`
- 默认 guard：`apps/terminal/ui/base/render/src/foundations/definePart.ts:53-64`
- 直接 generic close：`apps/terminal/ui/base/render/src/components/LayerStack.tsx:175-190`
- feature actor：`apps/terminal/ui/feature/sample-wallpaper-picker/src/features/actors/actors.ts:106-111`

可复核：

```text
rg -n "layerGuard|dismissTopLayer|closeLayerCommand|hardwareBackPress|wallpaperSystemFailureDismissedCommand" apps/terminal/ui/base/render apps/terminal/ui/feature/sample-wallpaper-picker/src
```

主 agent 已据此补充 render 的 feature-owned `layerDismissals` capability，并把三个 feature 的 system notice map 接入两个 integration；button 与 generic layer affordances 共用各 feature 的 dismissal helper。该修复须由新的 fresh reviewer 验证，不能由本记录自行闭合。

### M-2 — post-repair 三类对账前置仍未形成 MATCHED（`CONFIRMED`）

计划要求每个 CP 的 fresh stage reconciliation、动态前 fresh whole-scope reconciliation、交付前 code↔design reconciliation 全部 MATCHED。审查时仓内只有旧的 CP3/CP4 OPEN 记录、focused repair evidence 与 whole-scope OPEN 记录，没有当前字节对应的 fresh MATCHED 记录。可复核：

```text
rg --files doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift | rg "cp3-cp4|whole-scope|code|design"
rg -n "OPEN|MATCHED|fresh stage|whole-scope|code↔design|不能替代|动态" doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift
```

### S-1 — U8 release/mobile/dual cold-start 尚未由当前字节证明（`UNVERIFIED_REQUIRES_EVIDENCE`）

U8 需要 release、手机、双屏冷启动；当时只有源码与 focused 记录，尚无真实 release device evidence。runner 位置：`tools/terminal-sample2/run-u8-release-cold-start.mjs`。

### N-1 — shared console assembly 抽取主体匹配（`CONFIRMED_AT_REVIEW_TIME`）

`ui.base.console-assembly` 已拥有 state/dispatch/surface/input/admin/startup 共享主体，两个 integration 通过 `createConsoleAssembly` 接入；graph、package/dependencies、public exports 与源码形态静态一致。可复核：

- `apps/terminal/skeleton-graph.ts:73-88`
- `apps/terminal/ui/base/console-assembly/src/index.ts:1-17`
- `apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx:105-129,141-219,222-437`
- 两个 integration 各自 `src/assembly/assembly.tsx`

### N-2 — feature factory 与三个 thin adapter 已具备（`CONFIRMED_AT_REVIEW_TIME`）

`ui.base.feature-assembly` 的 factory、可取消 registration、三个 feature adapter 与 requestOutcome / picker two-hop 形态符合详设的静态约束；D-14 的 layer close 仍是上述 M-1 的缺口。

## Boundary

- `FIRST_FAILURE`：D-14 关闭路径的 generic close 绕过 feature intent。
- `BROKEN_BOUNDARY`：feature notice ownership → generic render affordance。
- `LAST_KNOWN_GOOD`：shared console assembly 抽取后的静态与 package-focused 结果；完整阶段对账尚未产生。

## Admission

在 D-14 修复、当前 focused evidence、fresh CP3/CP4 stage、fresh whole-scope 与交付前 code↔design 均 MATCHED 之前，动态仍被阻断。
