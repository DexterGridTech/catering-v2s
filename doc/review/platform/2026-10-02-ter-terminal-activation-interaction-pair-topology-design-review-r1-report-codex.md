# 终端激活交互与双机拓扑优化 · 独立 DESIGN 复核第 1 轮

```text
REVIEW_CYCLE_ID=TER-ACTIVATION-INTERACTION-PAIR-TOPOLOGY-DESIGN-2026-10-02
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewer=/root/ter_design_review_r1 (prometheus-strict-momus)
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=0/1/0
L1_ENGINEERING=findings
L2_USER_VISIBLE=PASS_STATIC_WITH_NOT_RUN_DYNAMIC
L3_UNVERIFIED=V-01..V-20、focused tests、Expo Web、VM/application/device、adapter、cleanup 均 NOT_RUN
SAME_ROOT_SCAN=ACT-01..04 与 ADMIN-01..03 七个受影响 screen 全部核对；其他 screen 未发现这两个 package path
DESIGN_GAPS=正式需求与初版设计对terminal-activation/server-config-panel的包住址不一致
EVIDENCE_TIER=STATIC_CURRENT_BYTES_ONLY（作者材料为复核时的冻结字节）
ROUND_1_PROCESS=INCOMPLETE_REVIEW_ACTIONS；NO-GO finding可用于intake，但不能作为完整模板覆盖结论
```

## 独立复核边界

Reviewer 声明先依据授权、需求、规范、记忆和 owning sources 形成独立初判，再读取作者材料；之后将 finding 定位到下列复核时文件。复核仅为静态 DESIGN，不运行生成、构建、测试、verify、DEV、设备或受管环境。详见 reviewer 回传的 finding；本文件由主 agent 据其结果归档，不冒充 reviewer 自行写入。

本轮作者材料 SHA-256：

| 文件 | SHA-256 |
| --- | --- |
| `doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-journey-codex.md` | `da9c3fd25f32f3be76b48aaf6267a2b390b9eb21a847dc3ffe2b9f72e4331993` |
| `doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ia-codex.md` | `fd93aec29ff4d5ff0c11f2d882222291b4d63cb9bea63f0777e17ecca9f8c15f` |
| `doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ui-interaction-codex.md` | `cb94aa83d948237ace67e70086421279240e640330cceb553048b1eea2cce4e4` |
| `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-design-codex.md` | `33ab7cdde7631ad3ff0cdee882e5b5347f65c9a1dc42d278e93df7356e03426c` |
| `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-plan-codex.md` | `e29c505ecdf93b7e2264ccc8db29be3e4787a635f29d51c29cd034b455c050cb` |

## S-1 · 新 UI 包住址与类型偏离正式需求

- 分类：`CONFIRMED`。
- 判据：正式需求 R-03 明确要求新包位于 `apps/terminal/ui/base/terminal-activation` 与 `apps/terminal/ui/base/server-config-panel`。终端规范 TR-12 规定 `ui/feature` 的 module/actor 契约；`ui-base-feature-assembly` 进一步只接受 `ui.feature.*` module。`ui/base/admin-shell` 提供现有 base UI parts 与 `AdminSectionComponent` 先例。
- 复核前实现文字：详设 CP-02/CP-03、screen 表、owner API 消费者与输入清单把两个包称为 UI feature 或放在 `apps/terminal/ui/feature/*`；计划 CP-02/CP-03 也要求按 sample feature assembly 实现。交互文档 ACT-01..04、ADMIN-01..03 共七处列了 feature 路径。
- 证据：正式需求 `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-formal-requirements-codex.md:52-55`；初版详设 `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-design-codex.md:36-37,81-90,190-191,226`；初版计划 `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-plan-codex.md:68,95`；TR-12 `doc/platform/terminal-coding-standard.md:499-518`；feature assembly 限制 `apps/terminal/ui/base/feature-assembly/README.md:35-40`；base UI 先例 `apps/terminal/ui/base/admin-shell/README.md:3-16`、`apps/terminal/ui/base/admin-shell/src/parts/parts.ts`。
- 影响：按初版直接实施会新建错误目录，并可能让 `createFeatureAssemblyModule` 与 `ui.feature.*` 的模块名校验不兼容。审查与实施对包图、public export、dependency/invariant 的预期将不一致。
- 最小修正：按正式需求保留两个 `ui/base` 路径；Journey、IA、交互、详设、计划统一记录包类型与住址；terminal-activation 复用 `ui/base/admin-shell` 的 moduleName/dependencies/public-export/parts 组织以及现有 owner command/selector，两个 integration 消费 `needToActivateTerminalCommand` 作阶段路由；server-config-panel 以现有 `AdminSectionComponent` 装入 admin shell。不得照搬只接受 `ui.feature.*` 的 feature assembly；不新增凭证、配置事实或第二份业务状态。
- Dexter 裁决：不需要。明确正式需求优先，不改需求正本。

## 当前复核限制

L2 可见结构只由 Journey、IA、逐屏线框和源码事实作静态判断；26 个 screen 不代表已实现。未来 Web→VM 顺序、adapter 行为、业务结果、可访问性与清理仍无人动态验证。Browser L2 为 `N/A_WITH_REASON`（本轮没有该授权）。

```text
TEMPLATE_COVERAGE=OPEN_NOT_COMPLETED
journey-decision-template.md=OPEN_NOT_COMPLETED
ia-design-template.md=OPEN_NOT_COMPLETED
ui-interaction-design-template.md=OPEN_NOT_COMPLETED
implementation-design-template.md=OPEN_NOT_COMPLETED
```

Reviewer 确认本轮没有逐节核对四份模板。主 agent 因此将第 1 轮记录为流程不完整；S-1 的源码与文档矛盾仍经主 agent 独立核验并处置。后续独立复核采用第 2 轮硬上限内的 fresh reviewer，完整填写模板 coverage；不会再召集第三轮。
