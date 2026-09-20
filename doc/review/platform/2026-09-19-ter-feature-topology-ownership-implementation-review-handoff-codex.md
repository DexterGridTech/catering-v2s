# TER feature 端写入归属整改：implementation review 交接

## 背景

本轮对象是 TER feature 端主副屏写入归属整改的实施结果。上一份 Claude 静态
implementation review 为 `NO-GO, M/S/N=2/2/3`，指出：feature 写入未统一避让非拥有
workspace、归属门没有 focused red proof、副屏 projected part 缺 SLAVE 装配约束，以及
topology base 硬编码 sample members slice。主 agent 已按已授权整改范围完成源码、测试、
装配与诊断调整，并完成当前源码绑定下的 focused/static、双机单屏、单机双屏与 mobile
受管验证。本交接请求 Claude 对当前源码与证据重新做 `REVIEW_TARGET=IMPLEMENTATION`
独立复核；不预设 implementation acceptance。

## 评审目标

请独立核验：

1. 六处 content command 写入是否都按 `instanceMode` 与 MAIN/BRANCH 归属闭合，feature
   在不拥有 workspace 时是否是预期 no-op/不产生 ownership error；prune 是否只处理本机
   所属 workspace，且 `APPLY_AUTHORITATIVE_SYNC` 没被误拦；
2. MAIN/BRANCH workspace projection、SECONDARY projected part 的 `SLAVE` admission、
   integration 注入的 state-sync/moduleName contract 与接收侧 local 归一是否仍保持；
3. `resolveCommandTarget` 的 peer-intent/PRIMARY 边界，以及 admin、member、staff-auth、
   wallpaper feature 在当前源码下的实际调用路径；
4. 上一轮 M/S/N 的实现处置是否有新的设计缺口，尤其是 ownership focused red mutation、
   不再由 topology base 硬编码 sample slice、以及同 APP 同构建下不应出现意外
   `incompatible-catalog-entry` 的约束；
5. 当前 focused/static 与受管 device/cleanup 证据是否被正确分档，是否存在把阶段一双机
   证据、阶段二单机双屏证据或 mobile 证据互相冒充的情况。

## 需阅读文件

- `doc/review/platform/2026-09-19-ter-feature-topology-ownership-implementation-review-claude.md`：
  上一轮 Claude 的静态 findings；
- `doc/evidence/platform/2026-09-19-ter-feature-topology-ownership-stage2-reconciliation-codex.md`：
  阶段二动态前的逐文档—代码—artifact 对账；
- `doc/evidence/platform/2026-09-19-ter-feature-topology-ownership-complete-dynamic-validation-codex.md`：
  本次 focused/static、两种阶段二形态与阶段一证据分档汇总；
- `doc/evidence/platform/2026-09-19-ter-feature-topology-ownership-stage1-dynamic-validation-codex.md`：
  双机单屏 topology、WS、重连、会员旅途与 cleanup 原始结论；
- `doc/plans/platform/2026-09-17-ter-dual-machine-topology-requirements-claude.md`：
  双机拓扑需求与 Dexter 已定的写入归属规则；
- `doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-design-codex.md`：
  详设、ownership/projected sync 边界与判据；
- `doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-plan-codex.md`：
  CP 顺序、验证与 cleanup 要求；
- `doc/platform/terminal-coding-standard.md`：终端层级、workspace、feature 与 topology 约束；
- `project-memory/decisions/terminal-architecture-and-stack-rulings.md`、
  `project-memory/operations/verification-governance.md`：运行时 owner 与证据/机器门边界；
- `apps/terminal/kernel/base/ui-state/src/foundations/workspaceOwnership.ts`、
  `apps/terminal/kernel/base/ui-state/src/features/actors/contentActors.ts`：统一写入归属门、
  六处写入与 prune；
- `apps/terminal/kernel/base/ui-state/src/foundations/workspaceSlices.ts`：MAIN/BRANCH projection；
- `apps/terminal/kernel/base/topology/src/application/createTopologyModule.ts`、
  `apps/terminal/kernel/base/topology/src/application/createTopologyStateSyncController.ts`：
  moduleName、state-sync 注入和接收侧归一；
- `apps/terminal/ui/base/admin-shell/src/components/AdminLauncher.tsx`、
  `apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx`：命令路由与
  projected SECONDARY admission；
- `apps/terminal/ui/feature/sample-staff-auth/src/features/actors/actors.ts`、
  `apps/terminal/ui/feature/sample-member-desk/src/features/actors/actors.ts`、
  `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx`、
  `apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx`：feature
  调用路径与 integration contract；
- `tools/terminal-topology/run-dual-device.mjs`：受管 runner、真实 UI oracle、artifact binding
  与 cleanup 实现；
- `scripts/check/claude-review-handoff`：本交接的结构检查入口。

## 独立核验重点

- 以当前源码字节为准，逐处重扫 `contentActions` dispatch、feature actor 的 MAIN/BRANCH
  写入、prune、projection 和 topology hardcoded sample 名称；不要只采信本交接表；
- 对 ownership 规则做反向代入：按 `currentWorkspace` 错判、删除 guard、恢复双片 prune、
  恢复 slave-local paired fallback，每种缺陷是否会让 focused red 真实变红；
- 核验当前 focused 结果：ui-state 42、topology 32、admin-shell 21、staff-auth 9、
  member-desk 28、wallpaper-picker 16、sample-console 43、sample-wallpaper-console 18，
  以及指定 typecheck 与 `yarn --cwd apps/terminal verify:static` 的原始结果位置；
- 读取双机阶段一原始目录与 WS/anomaly readback，确认 attempt/delay、close reason、
  ping/pong、recovery、ownership error 与短暂 fallback 的定性没有被升格；
- 读取当前单机双屏目录 `stage2-20260919T020922Z` 与 mobile 目录
  `stage2-20260919T021404Z`，确认四个 profile 的 APK local/installed SHA-256 一致、
  UI XML 的 part/reason/disabled oracle、sample-terminal stepwise comparison=MATCHED，
  以及每个 cleanup-result；
- 重点挑战阶段二单机双屏的 `Presentation` 恢复与 primary/secondary part/state 证据，
  但不要把它误读成双机 WS 证据；同样不要把 mobile disabled 证据当成拓扑可用证据；
- 对任何“没有 X”的结论列出检索范围，并给出精确源码位置、影响面、最小修复建议和
  是否需要 Dexter 裁决。

## 证据边界

`static`、`focused`、`device`、`cleanup` 维度在汇总文件中分开。当前阶段一与阶段二的
受管 business/cleanup 均为 PASS，但这不是 Claude 的 implementation acceptance。完整
heartbeat interval、visual/release acceptance 以及本轮未读取的细节仍不得被本交接自动升级。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并报告 `M` / `S` / `N` 数量。每条 finding 请给出：
仓内事实、owning source 与精确行号、反例/适用条件、最小修复建议、证据档位，以及是否需要
Dexter 产品或 Journey 裁决。若证据不足请写 `UNVERIFIED_REQUIRES_EVIDENCE`，不要把本交接
中的作者自报结果或历史记录当作源码真相。

## 授权边界

本交接只请求 Claude 对已实施源码、focused/static 结果、当前阶段一/阶段二设备证据与
cleanup 做 implementation review。它不授权新的产品语义、Journey、范围扩张、Git、部署、
seed、UAT 或把 review GO 升格为 implementation acceptance；任何未在需求/详设/计划中的
改动仍需先回 Dexter。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对 TER feature 端主副屏写入归属整改做一轮 REVIEW_TARGET=IMPLEMENTATION 的独立复核。

背景：上一轮静态 implementation review 结论为 NO-GO，M/S/N=2/2/3，指出 feature 未统一避让非拥有 workspace、归属门没有 focused red proof、projected SECONDARY 缺 SLAVE admission，以及 topology base 硬编码 sample members slice。本轮已按既有授权完成整改，并在当前源码绑定下重新完成 focused/static、双机单屏、单机双屏与 mobile 受管验证；请不要预设 implementation acceptance。

评审目标：独立核验六处 content command 写入与 MAIN/BRANCH 归属、按 instanceMode 的 prune、APPLY_AUTHORITATIVE_SYNC 豁免、workspace projection、projected SECONDARY 的 SLAVE admission、integration state-sync/moduleName contract、peer-intent/PRIMARY 路由、feature no-op 边界，以及上一轮 findings 是否在真实源码和证据中闭合。请同时核验 static/focused/device/cleanup 分档，不要把任一设备形态的证据冒充另一形态。

请从 catering-v2s 仓库根阅读下方“仓库相对路径汇总”中的需求、详设、计划、上一轮
review、证据、规范、memory、实现源码与受管 runner；每个路径旁的用途见交接文件正文。

请重点复核：
1. 对 ownership guard、instanceMode 分片、projection 豁免、feature no-op 与 topology hardcoded sample 名称做完整源码扫描，并为“没有 X”的结论列出检索范围；
2. 将按 currentWorkspace 错判、删除 guard、恢复双片 prune、恢复 slave-local paired fallback 等反例代入 focused 判据，确认缺陷会真实变红；
3. 读取 `.runtime/ter-dual-machine-topology/2026-09-17/cp5/stage1-20260919T014710Z/` 的双机单屏与 WS 证据；读取 `stage2-20260919T020922Z/` 的单机双屏证据和 `stage2-20260919T021404Z/` 的 mobile 证据，确认四个 profile 的 APK binding、UI XML、stepwise comparison 与 cleanup；
4. 保持 static、focused、device、cleanup 分档，尤其不要把完整 heartbeat interval、visual/release 或未读取内容升级为 PASS。

烦请给出明确 GO 或 NO-GO，并报告 M/S/N 数量。每条 finding 请给出精确仓库相对路径与行号、事实与推论区分、反例/适用条件、最小修复建议、证据档位，以及是否需要 Dexter 产品或 Journey 裁决；证据不足请标记 UNVERIFIED_REQUIRES_EVIDENCE。

授权边界：本次只请求对已实施源码及其当前验证证据做 implementation review，不授权新增产品语义、Journey、范围扩张、Git、部署、seed 或 UAT，也不把你的 GO 自动升级为 implementation acceptance。谢谢。

仓库相对路径汇总：doc/review/platform/2026-09-19-ter-feature-topology-ownership-implementation-review-claude.md；doc/evidence/platform/2026-09-19-ter-feature-topology-ownership-stage2-reconciliation-codex.md；doc/evidence/platform/2026-09-19-ter-feature-topology-ownership-complete-dynamic-validation-codex.md；doc/evidence/platform/2026-09-19-ter-feature-topology-ownership-stage1-dynamic-validation-codex.md；doc/plans/platform/2026-09-17-ter-dual-machine-topology-requirements-claude.md；doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-design-codex.md；doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-plan-codex.md；apps/terminal/kernel/base/ui-state/src/foundations/workspaceOwnership.ts；apps/terminal/kernel/base/ui-state/src/features/actors/contentActors.ts；apps/terminal/kernel/base/ui-state/src/foundations/workspaceSlices.ts；apps/terminal/kernel/base/topology/src/application/createTopologyModule.ts；apps/terminal/kernel/base/topology/src/application/createTopologyStateSyncController.ts；apps/terminal/ui/base/admin-shell/src/components/AdminLauncher.tsx；apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx；apps/terminal/ui/feature/sample-staff-auth/src/features/actors/actors.ts；apps/terminal/ui/feature/sample-member-desk/src/features/actors/actors.ts；apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx；apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx；tools/terminal-topology/run-dual-device.mjs；doc/platform/terminal-coding-standard.md；project-memory/decisions/terminal-architecture-and-stack-rulings.md；project-memory/operations/verification-governance.md。
```
