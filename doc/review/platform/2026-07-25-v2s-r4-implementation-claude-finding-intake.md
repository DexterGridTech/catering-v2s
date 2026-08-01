---
title: R4 implementation Claude NO-GO finding intake
status: REMEDIATION_IN_PROGRESS
reviewSource: doc/review/platform/2026-07-25-v2s-r4-implementation-review-claude.md
authorization: Dexter authorized Codex to choose the M-1 remediation path
---

# R4 implementation Claude finding intake

## M-1 — CONFIRMED

采纳推荐路径：不修改 Roadmap §10，不把机械规则转给长期人审。已重开 Roadmap §10、
standards matrix、现有 Gate 和 ArchUnit/DB production tests。第一批已恢复的精确机械
承接包括既有 34 条之外的 `B.2.N12`（注入业务时钟）→ database-boundaries 与
`B.3.N10`（无 outbox/常态投递链）→ backend-boundaries；后者同时新增对 JPA/Hibernate、
Lombok、Spring Cloud、Redis/MQ、外部搜索和 Resilience4j/Quartz 的依赖禁入检查，且以
Lombok 注入作 production-path 红变异。

较小替代是只改 matrix 文字或把全部规则留给 checklist；两者均不能满足 Roadmap §10，故拒绝。
其余 `UNENFORCEABLE_BY_MACHINE` 将在 delta packet 中逐条给出“缺少批准 feature”或“需要
产品/任务语义判断”的原因，不再用泛化标签覆盖机械面。

## S-1 — CONFIRMED

Gate 已由 token/file presence 加深为 contract→server registry→frontend generated slice 的精确
operation 对账、controller face verifier、Flyway/RLS/FK、SQL budget、模块 import 与 dependency
禁入；每个核心 Gate 保持 production-path red mutation。catalog 以 `matrixRuleIds` 公开其承接分母。

## S-2 — CONFIRMED

已新增仅适用于 `R4-W2-IMPLEMENTATION-20260725` 的诚实豁免：
`doc/decisions/2026-07-25-v2s-r4-first-independent-review-input-checklist-exemption.md`。
不修改两份历史 verdict，不把补充文档伪装为当时输入清单；下一 cycle 严格要求该字段。

## 新增命名治理修复 — CONFIRMED

冻结 Heritage `runtime-source-organization-must-not-follow-journey-ids` 的运行/测试能力命名规则已
落入设计期 granularity、代码期 layout、AGENTS 与 cs-writing-plans。apps/libraries 存量清单、改名与
唯一待决的 scripts/tools 前缀处置见
`doc/evidence/platform/2026-07-25-v2s-r4-capability-naming-remediation.json`。
