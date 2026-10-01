# 批次二详设与实施计划 · Claude 静态复评交接

```text
REVIEW_TARGET=DESIGN
REVIEW_KIND=DEXTER_RELAYED_CLAUDE_REREVIEW
REVIEW_STATUS=READY_FOR_DEXTER_RELAY
SCOPE=CURRENT_BATCH_2_DESIGN_AND_PLAN_BYTES
PRIOR_INDEPENDENT_DESIGN_CYCLE=CLOSED_NOT_REOPENED
PRIOR_CLAUDE_VERDICT=NO_GO_M0_S2_N2_ON_PRE_REPAIR_BYTES
AUTHOR_REPAIR=FOUR_CONFIRMED_DOCUMENT_FINDINGS_REPAIRED
INDEPENDENT_VERDICT_COVERS_CURRENT_BYTES=false
DYNAMIC_EVIDENCE=NOT_RUN
IMPLEMENTATION_AUTHORITY=false
```

## 背景

Claude 对批次二详设与实施计划的 fresh 静态复评结论为 `NO-GO`，`M/S/N=0/2/2`，评审记录见 `doc/review/platform/2026-09-30-v2s-terminal-activation-batch-2-fresh-static-rereview-codex.md`。主 agent 逐条重开当前详设、计划、原需求、项目规范与 owning source，四项均核验为 `CONFIRMED`，并按最小修正同步修改两份目标文档：CP-06 不再包含整批动态验收；补齐 canonical schema 到物化、后端 DTO 与 TER 生成的链路；明确配置 provider 注入 transport adapter 的边界；把 reset/seed/L2 准入改为仅对实际获授权动作适用。本轮只改了详设、实施计划和本交接文件，没有改需求、Journey、decision、源码、依赖或生成物，也没有执行动态验证。

此前的独立子 agent `REVIEW_TARGET=DESIGN` cycle 已关闭，本请求不重开该 cycle，也不是其第三轮。请 Claude 对当前修改后的字节独立复评；当前字节尚无独立 verdict。

## 评审目标

判断四项修正是否真正消除原执行阻断与矛盾，且没有引入新的阶段、来源、owner 或准入冲突。以原始需求、当前规范和 owning source 为准；不要把作者的 `CONFIRMED` 分类或本交接中的修订摘要当作事实。

## 需阅读文件

请从 catering-v2s 仓库根先读规范、原始需求与当前目标字节，形成自己的判断，再读上一轮评审及相关生成链源码：

- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、`scripts/README.md`：仓库执行入口与边界。
- `doc/platform/implementation-task-template.md`、`doc/platform/review-standard.md`、`doc/decisions/templates/implementation-design-template.md`：阶段对账、动态前准入和详设要求。
- `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md`：批次二原始需求与判据。
- `doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md`、`doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md`：已接受的边界与裁决。
- `doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-design-codex.md`、`doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-plan-codex.md`：本次复评的当前目标字节。
- `doc/review/platform/2026-09-30-v2s-terminal-activation-batch-2-fresh-static-rereview-codex.md`：上一轮 `0/2/2` findings 与证据。
- `contracts/openapi-source/terminal-binding.schemas.json`、`contracts/openapi/components/terminal-binding/terminal-binding.schemas.json`、`doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json`、`scripts/generate/r5-edge-materialize.mjs`、`scripts/generate/edge-codegen.mjs`：schema 输入、materialize、catalog hash 与 codegen 的实际生成链。

## 独立核验重点

1. **S-1 阶段依赖环**：核 CP-06 是否仅负责判据/场景闭包、runner 接线、focused proof 和阶段内静态检查；CP-01～06 各自阶段对账完成后，整批 6b 是否明确位于所有整体验收之前；动态结果、cleanup、13c 与整批 implementation review 是否已从 CP-06 退出条件移开。检查总览、CP-06、6b、动态准入、批次完成定义有无残余双向依赖。
2. **S-2 生成源链**：确认计划从 `contracts/openapi-source/terminal-binding.schemas.json` 与 catalog SHA 开始，按 `r5-edge-materialize` → `edge-codegen` → TER generation 执行，并有 canonical/source/materialized component/两个 terminal DTO/TER operation descriptor 的对账。确认没有把 materialized component 或生成 DTO 当成编辑源；只对 `TerminalActivationRequest` 与 `TerminalActivationCancellationRequest` 容忍未知字段，运营后台及其他 DTO 仍严格拒绝；判据能发现源、hash、物化输出与生成输出任一处漂移。
3. **N-1 配置快照边界**：确认 TER composition 通过 server-config owner API 解析配置，并将 provider 注入 transport network adapter；`terminal-data-client` 可调用 transport 公开通用 command，但不读取 server-config selector、snapshot、slice/state 或 persistence；transport 也不绕过 owner。核对 CP-03、跨 owner 矩阵、声明—传递—消费表和实施计划一致。
4. **N-2 条件式准入**：确认本批无 UI action 时 §3a `N/A_WITH_REASON`，没有要求空分母 admission 或虚构 DEV seed dry-run；backend-acceptance 及不 reset/seed 的 DEV 不被这些前置条件阻断；CP 阶段对账、整批 6b、每次受管运行资源身份/预算/cleanup 仍保留。只有实际获授权的 reset/seed/L2 动作才执行适用准入；真实 L2 才要求实际控件分母 admission，完整 seed dry-run 只在确实计划 seed 时要求。

本轮没有运行生成、编译、测试、`scripts/verify`、Node/Vitest、backend-acceptance、DEV、Testcontainers、reset、seed、L2、UAT 或部署。请勿把计划中的验证提升为 PASS。

## 期望结论

请针对当前详设与计划给出明确 `GO` 或 `NO-GO`，以及 `M/S/N` 数量。每条 finding 写明目标文件/章节或条款与精确行号、性质、仓库证据、影响、可验收的最小修正和是否需要 Dexter 产品裁决；区分静态事实、推论和未验证项。若四项均关闭，也请说明核验依据；不要以旧评审计数代替本轮结论。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对《终端激活与长连接》批次二当前详设与实施计划做一次独立静态复评。

背景：你上一轮对这两份文档的复评结论为 NO-GO，M/S/N=0/2/2，完整 finding 与证据在 `doc/review/platform/2026-09-30-v2s-terminal-activation-batch-2-fresh-static-rereview-codex.md`。主 agent 逐条重开 owning source 与原始需求后，四项均确认，并已只修改当前详设和实施计划。此前的独立子 agent DESIGN cycle 已关闭，本次不重开该 cycle，也不是第三轮；请只对当前字节独立判断。

目标：确认 S-1 阶段依赖、S-2 canonical→materialize→codegen→TER 生成链、N-1 配置 provider 注入边界、N-2 条件式 reset/seed/L2 准入是否已最小且一致地修正，并检查相邻条款是否还有同根矛盾。

请从 catering-v2s 仓库根阅读：
- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、`scripts/README.md`；
- `doc/platform/implementation-task-template.md`、`doc/platform/review-standard.md`、`doc/decisions/templates/implementation-design-template.md`；
- `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md`；
- `doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md`、`doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md`；
- `doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-design-codex.md`、`doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-plan-codex.md`；
- `contracts/openapi-source/terminal-binding.schemas.json`、`contracts/openapi/components/terminal-binding/terminal-binding.schemas.json`、`doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json`、`scripts/generate/r5-edge-materialize.mjs`、`scripts/generate/edge-codegen.mjs`；
- `doc/review/platform/2026-09-30-v2s-terminal-activation-batch-2-fresh-static-rereview-codex.md`，用于核对前轮 finding，不作为当前结论。

请重点核验：
1. CP-06 的实际退出条件与实现阶段边界；全部 CP `MATCHED` 后 6b 是否单独完成并先于整体验收；全篇是否还有动态结果/cleanup/13c/最终 review 回流到 CP-06 的循环。
2. canonical schema 与 catalog SHA 是否是唯一输入，`r5-edge-materialize`、`edge-codegen`、TER generation 的实际调用链和三方对账是否充分；仅两个终端请求兼容未知字段、运营后台及其他 DTO 保持严格的边界是否明确。
3. composition、server-config、transport、terminal-data-client 的配置读取路径：允许调用 transport 公开通用 command；禁止 client 直接读 server-config selector/snapshot/state/persistence；确认表格和正文没有互相矛盾。
4. §3a N/A 时是否避免空分母 admission 与无条件 seed dry-run，同时保留 CP/6b、资源身份/预算/cleanup，并仅对实际获授权的 reset/seed/L2 执行相应准入。

本轮没有运行生成、构建、测试、verify、backend-acceptance、DEV、reset、seed、L2、UAT 或部署。请明确区分设计中计划的证据与当前已经获得的证据。

烦请给出当前字节的 `GO` 或 `NO-GO` 与 `M/S/N`。每条 finding 请列目标文件/章节或条款与精确行号、性质、证据、影响、可验收的最小修正及是否需要 Dexter 产品裁决；检查通过的 finding 也请简述证据。

授权边界：本次只请求批次二详设与实施计划的独立静态复评，不重开此前关闭的独立 DESIGN cycle。该评审不授权修改需求、Journey、decision、源码、依赖或锁文件，不授权生成、编译、测试、`scripts/verify`、DEV、Testcontainers、reset、seed、L2、UAT、部署或批次三。谢谢。
```
