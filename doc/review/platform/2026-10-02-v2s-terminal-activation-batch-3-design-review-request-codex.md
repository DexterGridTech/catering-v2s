# 批次三详设与实施计划 · Dexter / Claude 复评请求

## 背景

批次三详设与实施计划已完成两轮本仓 fresh 独立 DESIGN 审查。第二轮按治理上限结束，reviewer verdict 为 `NO-GO，M/S/N=1/0/0`、`ROUND_FINAL_DECISION=SELF_DECIDED`；唯一阻断是 R-14 resident feasibility 证据不足。此后 Dexter 明确授权一次受管 resident feasibility probe。该 probe 已在远端完整批次二 DEV 服务运行期间启动 Apache 官方 Doris 镜像，完成 health、SQL、隔离持久挂载停止/重启读回、同机资源快照和受管 cleanup。主 agent 对第二轮 finding 的后续 intake 已记录，原两轮 cycle 未重开，也没有作者代写新的独立 verdict。

本次交审文件为修订后的详设、实施计划及 R-14 证据。作者状态为 `READY_FOR_DEXTER_CLAUDE_REVIEW`，不代表独立 DESIGN `GO`，也不授权批次三实施。Amendment proposal 仍为 `PROPOSED`。

## 评审目标

请按当前字节独立判断批次三详设与计划是否具备可实施、可验收的设计完整性，并判断 resident probe 对 R-14 设计前置的支持范围。重点区分：同机 resident feasibility 与正式 DEV Doris 生命周期集成、瞬时资源快照与峰值/长期容量、基础 SQL 与 Stream Load/权限/业务 readback。检查既有 finding 的最小修订是否真正闭合，不沿用历史 GO、MATCHED 或作者结论。

## 需阅读文件

- `AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md`：项目治理、运行拓扑与交付边界；
- `doc/platform/README.md`、`scripts/README.md`、`doc/platform/review-standard.md`、`doc/platform/implementation-task-template.md`、`doc/platform/third-party-library-usage-standard.md`：执行入口、阶段准入、审查及第三方依据要求；
- `project-memory/index.md`、`project-memory/decisions/deterministic-context-only.md` 及本任务六维路由命中的原文：本仓记忆入口与适用约束；
- `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md`：批次三需求及 R-14；
- `doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md`、`doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md`：批次边界及已接受服务形态；
- `doc/decisions/2026-10-02-v2s-terminal-activation-batch-3-amendment-proposal.md`：状态为 `PROPOSED` 的 amendment；
- `doc/plans/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-design-codex.md`、`doc/plans/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-plan-codex.md`：当前待审详设与计划；
- `doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-design-review-intake-r1-codex.md`、`doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-design-review-intake-r2-probe-followup-codex.md`、`doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-design-review-intake-codex.md`：两轮历史 findings 与当前主 agent intake，均为上下文材料，不替代本次独立判断；
- `doc/review/platform/2026-10-01-v2s-terminal-activation-batch-3-doris-feasibility-codex.md`、`doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-resident-feasibility-codex.md`：临时容器与 resident probe 的分层证据和限制；
- `scripts/dev/r5-doris-resident-feasibility.mjs`、`scripts/dev/r5-dev-runner.mjs`、`scripts/dev/r5-reset.mjs`、`scripts/test/r5-remote-testcontainers.mjs`、`scripts/test/backend-acceptance`：实际受管 probe、DEV、reset 与 acceptance 生命周期；
- `.runtime/r5/evidence/doris-resident-feasibility/r5-doris-feasibility-1790872778086-71714-0ff1e0ca-c53f-4352-aac4-448238ff3bc5/run-manifest.json`、`probe.log`：有效 resident run 原始 manifest 与 transcript；
- `apps/backend/terminal-data-server/src/main` 中的 `TdsConnectionStateRepository`、`TdsBindingRevocationListener`、`TdsTerminalSessionActors`、`TdsConnectionStateWriter`、`TdsWebSocketHandler`，以及 terminal-binding notification publisher：当前跨节点 owner 与会话路径。

## 独立核验重点

1. R-14：需求的详设前置具体要求是什么；有效 probe 是否证明远端同机 Doris 可起停、健康、SQL、持久挂载停止/重启读回，并与当前完整 DEV 服务共存？probe run 中 DEV 由受管 runner 启动、结束后受管停止；Doris 未接入 DEV 流量，也未设置 cgroup memory cap。判断这些边界是否足以关闭“设计可行性前置”，并核实详设没有把它升级成容量 SLO、长期 resident 或业务验收结论。
2. S-2：详设/计划 CP-03 是否完整关闭 PG open 提交到本地 active/SESSION_READY 登记之间的取代窗口？检查权威 latest-state reread、同 terminal actor 串行应用、单调 sequence watermark、迟到 candidate 关闭及屏障反例是否能够按计划实现。
3. S-3：reset 是否先停历史生产者并通过 cleanup，再验证 manifest-owned resident Doris 身份/健康、清表并 readback=0，之后才进入 PostgreSQL reset；每个失败点是否明确阻止后续步骤并维持 DEV stopped。
4. S-4：CP-05 仅做新增场景 focused proof、CP-06 只做本阶段门与 focused proof、所有 CP 完成后独立做 6b，再做整批动态验收/cleanup/13c/implementation review 的顺序是否全篇一致，没有自引用依赖或重复全量运行。
5. Doris 与 PostgreSQL 事实边界、事件闭集 `CONNECTED`/`DISCONNECTED`/`HEARTBEAT_RTT`、Doris 有界 writer 故障隔离、有限重试/丢弃及日志是否符合需求且没有过度设计。
6. §9a.1 的本批门入口、validate-only/默认 verify 模式、red marker 与 N/A 反例是否准确；N/A 是否只免除本批专属红例而不跳过全仓适用 verify。
7. 第三方依据：重新核实本次实际解析版本与官方版本文档的对应关系；不得把历史 classpath 当作未来 CP-01 新依赖解析结果。Apache 官方 all-in-one 文档将该镜像定位为开发/测试用途；确认详设没有将其描述成生产方案。
8. 确认详设/计划授权字段与实际指派一致：只完成批次三详设、实施计划和指定 feasibility probe；批次三生产实现、整体验收、DEV 拓扑改造、reset/seed、L2、UAT、生产部署仍未获授权。

## 期望结论

请给出明确 `GO` 或 `NO-GO` 及 `M/S/N`。每条 finding 标注详设/计划章节、owning source 的仓库相对路径与行号、性质（仓内事实/外部事实/推论/产品判断）、影响、最小可验收修正及是否需要 Dexter 裁决。若 R-14 仍阻断设计，请指出原需求中对应的具体前置和最小剩余证据；若接受本次有边界的关闭，也请列出尚未验证的实现期事项。

## 可直接复制给 Claude 的话术

```text
您好 Claude，请对《终端激活与长连接》批次三详设与实施计划按当前字节做独立评审。

背景：批次三详设与计划此前完成两轮本仓 fresh 独立 DESIGN 审查；第二轮按治理上限结束，结论为 NO-GO、M/S/N=1/0/0、ROUND_FINAL_DECISION=SELF_DECIDED，唯一阻断是 R-14 resident feasibility 证据不足。其后 Dexter 授权一次受管 resident feasibility probe。有效 run `r5-doris-feasibility-1790872778086-71714-0ff1e0ca-c53f-4352-aac4-448238ff3bc5` 在远端完整批次二 DEV 服务运行期间，以缓存的 Apache 官方 `apache/doris:all-in-one-4.1.3` 完成 health、SQL、隔离持久挂载停止/重启读回、同机资源快照和受管 cleanup。DEV 由受管 runner 启动，并在 probe 后由受管 runner 停止。探针不接 DEV 业务流量，Doris 未设 cgroup memory 上限；它不是 Stream Load、业务 acceptance、长期容量或 SLO 证明。两轮 DESIGN cycle 未重开；本交审不授权实施。Amendment proposal 仍为 PROPOSED。

目标：独立判断当前详设与计划是否完整、可实施、可验收；判断本次有界 resident probe 是否满足需求 R-14 的设计前置，并区分剩余实现期验证。请主动核验原始需求、当前 owning source、受管 runner 与原始 run evidence，不继承旧 reviewer 或作者的结论。

请从 catering-v2s 仓库根阅读：
- `AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、`scripts/README.md`：治理与运行拓扑；
- `doc/platform/review-standard.md`、`doc/platform/implementation-task-template.md`、`doc/platform/third-party-library-usage-standard.md`：审查、阶段准入和第三方版本依据规则；
- `project-memory/index.md`、`project-memory/decisions/deterministic-context-only.md` 及六维路由命中的原文：项目记忆与任务约束；
- `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md`：需求正本及 R-14；
- `doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md`、`doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md`：批次边界与接受的服务形态；
- `doc/decisions/2026-10-02-v2s-terminal-activation-batch-3-amendment-proposal.md`：状态仍为 PROPOSED；
- `doc/plans/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-design-codex.md`、`doc/plans/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-plan-codex.md`：待审详设与计划；
- `doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-design-review-intake-r1-codex.md`、`doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-design-review-intake-r2-probe-followup-codex.md`、`doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-design-review-intake-codex.md`：历史 findings 及作者处置记录，仅供定位，不作为结论；
- `doc/review/platform/2026-10-01-v2s-terminal-activation-batch-3-doris-feasibility-codex.md`、`doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-resident-feasibility-codex.md`：探针报告与证据边界；
- `.runtime/r5/evidence/doris-resident-feasibility/r5-doris-feasibility-1790872778086-71714-0ff1e0ca-c53f-4352-aac4-448238ff3bc5/run-manifest.json`、`probe.log`：本次有效 run 原始证据；
- `scripts/dev/r5-doris-resident-feasibility.mjs`、`scripts/dev/r5-dev-runner.mjs`、`scripts/dev/r5-reset.mjs`、`scripts/test/r5-remote-testcontainers.mjs`、`scripts/test/backend-acceptance`：受管运行与清理路径；
- TDS 中 `TdsConnectionStateRepository`、`TdsBindingRevocationListener`、`TdsTerminalSessionActors`、`TdsConnectionStateWriter`、`TdsWebSocketHandler` 及 terminal-binding notification publisher：跨节点真实 owner 与会话路径。

请重点核验：
1. R-14 原文是否要求详设前证明DEV主机resident及资源共存；当前 probe 是否足以在有边界的范围内关闭该设计前置。核对 host/boot ID、完整DEV共存、同一持久挂载restart/readback、image digest、Docker memory limit、run manifest 与cleanup；勿把瞬时样本升级为峰值或长期容量结论。
2. CP-03 是否明确闭合 PG open commit → local active/SESSION_READY 之间的跨节点取代窗口，并有可执行的 barrier 反例；通知只作唤醒，是否始终以PG latest-state为准。
3. CP-04 reset 是否具备清晰的 writer stop、Doris身份与健康检查、truncate/readback、PG reset顺序和失败隔离；是否不会在 Doris 清理失败后继续 PG reset。
4. CP-05、CP-06、全CP对账、全批6b与批次级整体验收的顺序是否一致，是否消除了循环依赖和重复全量运行。
5. PG/Doris事实边界、事件闭集、有界异步写入、超时/重试/drop、监控和日志是否满足需求而未引入MQ、outbox、轮询或统计API。
6. §9a.1有限门映射是否可复验：命令、verify模式、marker、红例或N/A理由是否准确；N/A是否没有被用来跳过全仓verify。
7. 第三方实际解析版本与相应官方资料是否对齐；本次run证明了哪些行为、没有证明哪些行为。
8. 当前详设、计划、amendment 状态和授权边界是否准确；本轮为外部复评，不重开两轮本仓 DESIGN cycle，也不授权源码实施、动态验收、DEV拓扑改造、reset/seed、L2、UAT或部署。

请给明确 `GO` 或 `NO-GO` 与 `M/S/N`。每条 finding 写精确章节/条款、仓库相对路径与行号、事实/推论/产品判断、影响、最小可验收修正，以及是否需要 Dexter 裁决。请分开报告静态核验、本次受管 probe、历史证据、未运行项；不要将计划中的验证描述为当前 PASS。

授权边界：本次只请你评审批次三详设、计划和指定 feasibility 证据；不授权任何源码实施、正式整体验收、DEV拓扑改造、reset/seed、L2、UAT、部署或批次外工作。谢谢。
```

## 交付前检查

按模板运行：

```bash
scripts/check/claude-review-handoff --file doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-design-review-request-codex.md
```

最终交付时还需在回复中直接展示上述可复制话术。
