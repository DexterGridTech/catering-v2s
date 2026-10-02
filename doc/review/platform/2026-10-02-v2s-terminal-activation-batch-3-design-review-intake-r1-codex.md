# 批次三详设与计划 · 首轮独立 DESIGN review intake

REVIEW_CYCLE_ID=2026-10-02-terminal-activation-batch-3-design
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
INTAKE_OWNER=MAIN_AGENT
INTAKE_STATE=NO-GO_WITH_R14_BLOCKER

## Verdict

首轮 fresh 独立只读审查：**NO-GO，M/S/N=1/2/1**。reviewerKind 为 `critic` 子 agent；作者主 agent 对每条 finding 重新打开需求、详设、计划、依赖报告与受管 runner，以下分类和处置由主 agent 作出，不把 reviewer 的 severity 当作 Dexter 决策。

## Findings intake

### M-1 · R-14 设计前可行性证据不完整

- **Classification**：`CONFIRMED`。
- **判据/依据**：需求正本 `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md:506` 要求在写批次三详设前，证明 Doris 可在远端 Testcontainers 主机按运行起停、在 DEV 主机常驻，并提供每次运行启动耗时。现有 R-14 记录 `doc/review/platform/2026-10-01-v2s-terminal-activation-batch-3-doris-feasibility-codex.md:9-18` 只证明历史 Testcontainers 启动、health、`SELECT 1`、镜像缓存命中及 cleanup；DEV 常驻、同机容量与 Doris RSS 为 `NOT_RUN`，启动子阶段耗时不能由归档独立重算。
- **owning-source recheck**：`scripts/README.md:55-68` 的远端 Testcontainers 入口只管理每次运行的 Gradle workspace/container/volume；`scripts/dev/r5-dev-runner.mjs` 当前没有 Doris resident 生命周期或资源读回路径；`scripts/dev/r5-reset.mjs` 当前也没有 Doris reset/readback。
- **影响**：当前详设在其设计前置证据未闭的情况下已写成条件稿；远端常驻与资源预算若失败，DEV/reset/acceptance 方案需返工。因此本设计不能标 GO 或作为实施输入。
- **最小修正/验收判据**：DESIGN GO 前经受管入口取得归档记录，包含 DEV resident 启停/health/cleanup、远端主机与 Docker 资源快照（CPU/RAM/disk/限额及 PG/MinIO/HAProxy/3 TDS 的同机基线）、镜像 digest/ID、冷拉和缓存命中耗时、container/health/SQL/cleanup 分阶段时间戳。现有入口不具备该能力；不得用手写 SSH/Docker 命令补证。若只能通过修改受管 runner 才能取证，先将所需的最小 runner 改动和批准边界交 Dexter 确认。
- **是否需 Dexter 裁决**：资源不足时必须裁决；若只需在已授权 R-14 范围内增补受管 probe，则属工程证据，仍须先确定 runner 写入是否在当前授权内。
- **当前处置**：详设/计划改为明确的条件稿；不把未验证工作藏进普通实施 CP，也不宣称 R-14 完成。**OPEN，阻断设计 GO。**

### S-1 · §11a 漏列 V-S6 与 V-S11

- **Classification**：`CONFIRMED`，已修复。
- **判据/依据**：需求正本 `:560` 要求每条验收判据映射到场景 ID 与执行档位；V-S6 批次三范围见 `:665-672`，V-S11 的 Doris 搜索见 `:692`。原详设有相应场景，却无两条独立 §11a 映射。
- **修正**：在 `doc/plans/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-design-codex.md:261-284` 分别增加 `R-6.3/V-S6 → terminal.connection.latest-state-stale-write` 与 `R-2.3/V-S11 → terminal.connection.history-secret-scan`，并列明执行面和文件。
- **验证**：静态回读需求、场景表和 §11a 对照；未运行动态场景，结果是 `NOT_RUN`。
- **是否需 Dexter 裁决**：否。

### S-2 · Testcontainers 解析版本与官方依据范围含混

- **Classification**：`PARTIALLY_CONFIRMED`，已修正文案，未重新解析依赖。
- **判据/依据**：`doc/platform/third-party-library-usage-standard.md:7-10` 要求准确写出实际运行 classpath。仓内生成报告 `apps/backend/catering-business-server/build/reports/backend-acceptance/runtime-classpaths.txt:2` 与历史远端报告 `.runtime/r5/evidence/remote-testcontainers/r5-tc-1790865119120-67780/backend-runtime-classpaths.txt:2` 显示 core `org.testcontainers:testcontainers:2.0.5`，adapter `junit-jupiter`、`postgresql`、`jdbc`、`database-commons` 为 `1.21.4`。本设计引用的 `GenericContainer` 和 image pull policy 属 core API。`apps/backend/catering-business-server/build.gradle.kts:90-91` 当前直接声明两个 1.21.4 adapters；构建定义时间早于 2026-10-01 runtime report，报告晚于该构建定义。当前没有运行新的依赖解析。
- **反例/处置**：reviewer 的“没有可用解析图”表述过强，仓内已有生成的当前验收 classpath 报告；但详设先前把依赖组统称 Testcontainers，且没有把 core 与 adapters 的 API 适用面说清。本轮已在详设 §第三方库依据区分坐标/版本，并要求实施前若输入变化重新解析。
- **最小后续判据**：任何相关 Gradle 输入变化后，CP-01须生成新 runtime classpath 并核对 API 所属模块及精确官方资料；在目前文档工作阶段不运行构建。
- **是否需 Dexter 裁决**：否。

### N-1 · R-14 启动子阶段耗时不能独立重算

- **Classification**：`CONFIRMED`，未来计划已补强，历史局限保留。
- **判据/依据**：R-14 历史记录 `doc/review/platform/2026-10-01-v2s-terminal-activation-batch-3-doris-feasibility-codex.md:12,26` 明示约 32.452 秒来自控制台，manifest 不能独立复算。
- **修正**：实施计划 CP-01 `doc/plans/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-plan-codex.md:31-38` 增加 pull/image-ready、container-created、health-ready、SQL-ready、cleanup 的时间戳与资源/manifest artifact 要求；详设第三方依据及验证处同步要求归档阶段时间戳。
- **验证**：静态回读计划和详设；旧 32.452 秒仍只算历史控制台证据，新阶段时间戳 `NOT_RUN`。
- **是否需 Dexter 裁决**：否。

## Review scope / evidence

- Reviewer 未修改文件，未执行构建、测试、verify 或受管运行。
- 主 agent intake 为只读检查与以上文档修订；`scripts/check/claude-review-handoff --file doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-design-review-request-codex.md` 返回 `CLAUDE_REVIEW_HANDOFF=PASS`。
- R-14 DEV resident、同机资源、Stream Load 表级权限与读回、reset、跨节点业务均未在本轮运行；均不得称为当前 PASS。
- 本轮只完成 S-1、S-2 文档精确化和 N-1 计划增强；M-1 没有可由文档修改替代的证据修复，故总 verdict 仍为 `NO-GO`。
