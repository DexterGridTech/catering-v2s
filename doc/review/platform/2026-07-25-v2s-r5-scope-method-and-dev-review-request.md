---
REVIEW_KIND=R5_SCOPE_METHOD_AND_DEV_GOVERNANCE
title: R5 scope, execution method and complete DEV delivery Claude review request
type: review
status: READY_FOR_CLAUDE
reviewTarget: doc/decisions/2026-07-25-v2s-r5-scope-and-method-decisions.md
reviewer: Claude
createdAt: 2026-07-25
authorizationState: R5_DESIGN_AUTHORIZED=false; R5_IMPLEMENTATION_AUTHORIZED=false
manifestApplicability: NOT_APPLICABLE_THIS_IS_NOT_IMPLEMENTATION_FACING_DESIGN
---

# R5 scope, execution method and complete DEV delivery Claude review request

## 背景

R4 已关闭。Dexter 先将 R5 范围固定为 all-v2 当前已实现的业务与前端能力、后端按 v2s
单体边界重构；随后要求 Codex 与 Claude 双盲分析 all-v2。双盲对比后，Dexter 明确委托
Codex 处理所有遗留裁决。Codex 已将 32 项 source-backed inventory、三大批次的内部依赖
方法、R 原子交付、A0 契约惯例、业务语料差异、扩展宿主、合同派生状态，以及 R5 完成时
必须具备的真实远端 DEV 与丰富 seed，收敛进一个 scope/method decision 和 Roadmap §11。

本轮是**范围/执行方法/验收交付治理 review**，不是 implementation-facing design：没有
Journey、交互工件、详设、granularity manifest、代码、contract、数据库或动态运行产物，故
manifest Part B/C/D 章节命中表不适用。请不要把本轮 GO 解释为 R5 design 或 implementation
授权。

## 评审目标

请从业务用户与 Dexter 的成本意图出发，独立判断 R5 scope/method decision 是否同时做到：

1. 将“v2 已实现范围”收敛为可审计的 32 项 source-backed inventory，而非历史设计或 parked 域；
2. 保持一个业务 deployable、单库多 owner schema、双 admin、无 MQ/outbox/TDP/内部 client 的
   v2s 架构，而不是复制 all-v2 旧拓扑；
3. 既遵守每个 R 一次性设计→实施→全范围复核的原子交付要求，又能让 A/B/C 内部 group 保持
   可验证、可定位、最终 review 可分 section 阅读；
4. 对 G-07/G-09/G-10 等语料差异作出正确、不过度的迁移裁决；
5. 把完整 DEV、远端已批准依赖、脚本分权和丰富 seed 作为 R5 交付，而不引入运行时默认账号、
   手工补数、生产化宣称或 v4 的不适用中间件。

## 需阅读文件

- `doc/decisions/2026-07-25-v2s-r5-scope-and-method-decisions.md`：本轮被审范围、方法、契约与 DEV/seed 裁决（`bee8d00c…`）；
- `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` §0、§11：现行状态、R5 交付与验收（`8d062c72…`）；
- `doc/review/platform/2026-07-25-v2s-r5-v2-implementation-state-and-dependency-analysis-codex.md`：Codex 独立 all-v2 实现态、依赖和语料差异分析（`10810af3…`）；
- `doc/review/platform/2026-07-25-v2s-r5-scope-and-order-independent-analysis-claude.md`：Claude 盲写分析，作为对照输入而非本次事实权威（`0685b156…`）；
- `doc/review/platform/2026-07-25-v2s-r5-dual-analysis-comparison-claude.md`：双盲收敛与曾存裁决点（`dab1ea4c…`）；
- `project-memory/decisions/confirmed-business-language-corpus.md`：G-01～G-12 现行业务语言、禁推与待裁决（`51415f7d…`）；
- `doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md`：不可漂移的服务/事务/数据/edge 边界（`ebc8cc3a…`）；
- `doc/decisions/2026-07-24-v2s-verification-governance.md`：机械门、review、分钟级与批量治理（`c9632a65…`）；
- `doc/decisions/2026-07-25-v2s-frontend-asset-carry-over-first.md`：UI carry-over 与 foundation 优先消费纪律（`08566474…`）；
- `contracts/policy/standards-coverage-matrix.json` 与 `project-memory/decisions/deterministic-context-only.md`：R5 标准分母与确定性规则。

## 独立核验重点

1. **R 原子性**：D-01 是否正确拒绝按 A/B/C group 单独 GO/NO-GO、独立 Claude handoff 或
   review cycle，同时没有借“末审”推迟首次验证；Roadmap §11 的旧“每波 review”是否已被
   这份新 decision 明确且有限地解释。
2. **范围分母**：32 项是否仍只包含 source-backed all-v2 能力；C-01 retain 是否避免重复实施；
   商品/库存/TDP、纯历史 Scenario 与无 source anchor 的内容是否仍被排除。
3. **契约与语料 delta**：`groupWorkspaceKey` 全量统一、货号 `{code,name}`、邀请链禁止
   direct-add、`OPERATING/PREPARING/NOT_OPERATING` 的只读派生，是否与 G-07/G-09/G-10
   逐字相容，且没有擅自增加阻断/新 Journey。
4. **扩展宿主**：五个实际 value host 的闭集是否比“八类定义但三类无承载”更诚实；是否把三类
   延后为未来范围而非删除业务语义或预建空壳。
5. **完整 DEV/seed**：D-06 是否足以保证 Dexter 能在远端已批准依赖上亲自走完整系统：
   start/restart 不 seed、reset 不自动 seed、seed 独立且可 dry-run/readback、fixture 覆盖双 admin
   与 32 项所需 source facts、business/cleanup 分账。请特别找出是否漏掉复现、凭据安全、
   remote namespace 隔离、失败恢复或脚本可诊断性。
6. **边界与成本**：v4 formal-UAT 只被借鉴为 fixture/脚本/readback/observability 方法，未复制
   v4 MQ/outbox/projection/cache；R5 DEV 不被误写成 production/cutover。
7. 在本轮 Claude 会话中 fresh 运行：
   `scripts/check/roadmap-program-registry`、
   `scripts/check/standards-coverage --phase R5`、
   `scripts/check/claude-review-handoff --file doc/review/platform/2026-07-25-v2s-r5-scope-method-and-dev-review-request.md`。

## 期望结论

请给出明确 `GO` 或 `NO-GO`。如有问题，请按 `M` / `S` / `N` 标注精确文件与行号、影响面、
最小修复建议，以及是否需要 Dexter 产品/范围裁决。请先独立重开 owning source 和反例，再评价
Codex 裁决；不要仅以双盲结论、文档自洽或文件存在给 GO。

## 授权边界

本次 GO 只代表 R5 的范围、执行方法与完成条件可以作为未来全范围设计的冻结输入；它不授权
R5 Journey、交互工件、implementation-facing design、app/contract/database/Flyway/test/业务源码、
DEV、远端连接、seed/reset 或动态运行。`R5_DESIGN_AUTHORIZED=false` 与
`R5_IMPLEMENTATION_AUTHORIZED=false` 保持不变。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审 catering-v2s 的 R5 新范围、执行方法与完整 DEV/seed 交付要求。

背景：R4 已关闭。R5 的 all-v2 双盲分析已完成，Dexter 将遗留裁决委托 Codex 处理；现已形成 32 项 source-backed 范围、三大批内部依赖方法、R 原子交付、契约基线、业务语料差异和完整远端 DEV/seed 要求。本轮是范围/治理 review，不是 implementation-facing design。
目标：请独立核验这套裁决是否既保留单 deployable/单库多 owner schema/双 admin/无 MQ-outbox-TDP 的 v2s 边界，又能让 R5 在一次性设计、一次性实施、一次性全范围复核后交付 Dexter 可亲测的真实完整 DEV 环境。

请从 catering-v2s 仓库根阅读：
- doc/decisions/2026-07-25-v2s-r5-scope-and-method-decisions.md：被审的范围、方法、契约和 DEV/seed 裁决；
- doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md §0、§11：R5 当前状态、交付与验收；
- doc/review/platform/2026-07-25-v2s-r5-v2-implementation-state-and-dependency-analysis-codex.md：Codex 独立分析；
- doc/review/platform/2026-07-25-v2s-r5-scope-and-order-independent-analysis-claude.md、doc/review/platform/2026-07-25-v2s-r5-dual-analysis-comparison-claude.md：双盲对照与收敛；
- project-memory/decisions/confirmed-business-language-corpus.md：G-01～G-12 业务语料；
- doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md：架构红线；
- doc/decisions/2026-07-24-v2s-verification-governance.md、doc/decisions/2026-07-25-v2s-frontend-asset-carry-over-first.md：验证与 UI 搬运边界；
- contracts/policy/standards-coverage-matrix.json、project-memory/decisions/deterministic-context-only.md：标准分母与确定性规则。

请重点独立核验：R 原子复核与可审阅 section 是否兼容；32 项分母、C-01 retain 与 parked 域排除是否准确；G-07/G-09/G-10 的 key、货号、邀请链、合同三态是否无过度推导；五类扩展值宿主是否诚实；远端 DEV 的 start/restart/reset/seed/check 分权、`r5-full` fixture、dry-run/readback、双 admin 测试数据、日志/耗时、business/cleanup 是否足够且没有引入 v4 的 MQ/outbox/projection/cache 或 production/cutover 误称。

请在本轮 fresh 运行：scripts/check/roadmap-program-registry；scripts/check/standards-coverage --phase R5；scripts/check/claude-review-handoff --file doc/review/platform/2026-07-25-v2s-r5-scope-method-and-dev-review-request.md。

烦请给出明确 GO 或 NO-GO。如有问题，请按 M/S/N 标注精确文件与行号、影响面、最小修复建议及是否需要 Dexter 产品/范围裁决。

授权边界：本次结论只评价 R5 范围、执行方法与完成条件能否作为未来全范围设计的冻结输入；不授权 R5 Journey、交互、详设、任何 app/contract/database/Flyway/test/业务源码、DEV、远端连接、seed/reset 或动态运行。谢谢。
```
