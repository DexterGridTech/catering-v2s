---
title: 已确认业务语料项目记忆纳入方案 Claude 独立评审请求
status: READY_FOR_EXTERNAL_REVIEW
createdAt: 2026-07-25
reviewTarget: confirmed-business-corpus-memory-adoption-proposal
implementationAuthority: false
---

# 已确认业务语料项目记忆纳入方案 Claude 独立评审请求

## 背景

Dexter 已通过 grill 确认当前只沉淀 G-01–G-12，要求把余下业务语料确认工作停为
未来按域恢复的旁支。当前 corpus 草稿为
`doc/review/platform/2026-07-24-v2s-cross-generation-business-corpus-draft.md`，SHA-256
是 `4422ed54b3c693b6f44031ad0a17660a39ce86a4f7387abdd072ef0f8068bbb0`。

本轮不是确认新的业务词、不是 R3-J01 评审，也不是任何 implementation-facing
design。目标是审阅：在 Claude 复核与 Dexter 接受之后，是否应以“精简 canonical
corpus + 读取策略 + parked domain intake”的方式纳入 project-memory。

## 评审目标

请独立判断该方案能否同时做到：

1. 后续相关 agent 确实会读到 G-01–G-12，而不是再次从旧 UI、接口或表结构臆想业务；
2. G-13 以后、V6 08–22 和技术映射不会因“写进 memory”被误升级为已确认真相；
3. 读取触发足够具体、可由 deterministic route 落地，但不会把无关机械任务拖慢；
4. authority、来源重开、冲突升级、Claude/Dexter 决策和两轮 Codex 自审边界没有被偷换成自动化或实现授权；
5. 与 Claude 2026-07-24 对原草稿的 S-1/N-3 修订是否一致，且没有据此过度扩张 IAM 或全域工程范围。

## 需阅读文件

请从 `catering-v2s` 仓库根打开：

- `doc/plans/platform/2026-07-25-v2s-confirmed-business-corpus-memory-adoption-proposal.md`：待审的落点、读取触发、parked 机制和验收设计；
- `doc/review/platform/2026-07-25-v2s-confirmed-business-corpus-memory-adoption-codex-self-review.md`：Codex 从业务用户与 Dexter 视角的第一轮自审；
- `doc/review/platform/2026-07-25-v2s-confirmed-business-corpus-record.md`：只含 G-01–G-12 的可读提升候选，供核对本次提升集合；
- `doc/review/platform/2026-07-24-v2s-cross-generation-business-corpus-draft.md`：G-01–G-12、出处、禁推和待裁决项；
- `doc/review/platform/2026-07-24-v2s-cross-generation-business-corpus-review-claude.md`：此前 Claude 的 S-1/N-3 与独立证据；
- `project-memory/decisions/deterministic-context-only.md`、`project-memory/operations/verification-governance.md`：确定性路由与“语义不做伪 checker”的约束。

## 独立核验重点

请从业务用户和 Dexter 的立场先判断真正要解决的任务，再审文件完整性。尤其寻找：

- 方案是否把“可检索”错当成“已经理解”，或把全部业务语料强迫所有 agent 阅读；
- canonical / policy / parked 三份文件是否职责重叠，是否可以更少而不丢失关键边界；
- 项目记忆的 route 维度是否真的能表达业务设计、UI、contract、implementation、review 的命中条件；
- “相关术语命中”是否太模糊，是否需要给出可操作而非关键词式的触发定义；
- future 08–22 域首次进入时，是否有足够的停下、回读、逐题 grill 和重新审阅机制；
- 是否有任何文字让接受该方案看起来等同于写入 memory、确认技术映射或授权 R3/W1。

## 期望结论

请给出 `GO_FOR_DEXTER_ACCEPTANCE` 或 `NO-GO`，并汇总 `M` / `S` / `N`。每项 finding
须含精确文件与行号、业务影响、最小修订、证据，以及是否需要 Dexter 产品裁决。请
按 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、
`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION` 处置，不要因本方案或以前 review
写得完整而全盘接受。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请独立评审本次“已确认业务语料纳入项目记忆方案”。

背景：Dexter 已通过 grill 确认当前只沉淀 G-01–G-12，并要求其余业务语料确认工作作为未来按域恢复的旁支。本轮不确认新业务词，不重开 R3-J01，也不授权 R3/W1、contract、数据库、代码或动态运行。
目标：请独立判断 proposed canonical corpus + read policy + parked domain intake 是否既能让未来相关设计/UI/contract/实施避免臆想业务，又不会把未确认的 V6 08–22、技术映射或历史实现误升为当前真相。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-07-25-v2s-confirmed-business-corpus-memory-adoption-proposal.md：待审落点、读取触发、旁支恢复与验收；
- doc/review/platform/2026-07-25-v2s-confirmed-business-corpus-memory-adoption-codex-self-review.md：Codex 第一轮方案合理性自审；
- doc/review/platform/2026-07-25-v2s-confirmed-business-corpus-record.md：只含 G-01–G-12 的提升候选；
- doc/review/platform/2026-07-24-v2s-cross-generation-business-corpus-draft.md：G-01–G-12、禁推、出处与未决项；
- doc/review/platform/2026-07-24-v2s-cross-generation-business-corpus-review-claude.md：您此前 S-1/N-3 的独立审阅；
- project-memory/decisions/deterministic-context-only.md、project-memory/operations/verification-governance.md：现有 route 与语义审阅纪律。

请重点独立核验：先从业务用户和 Dexter 立场判断这个方案是否解决“以后不会再造业务概念”而非仅增加文件；检查三份 future memory anchor 是否有重复或遗漏，route 是否对相关 Journey/UI/contract/implementation/review 足够可操作但不拖慢无关任务，08–22 首次进入时是否能诚实停下并按域恢复 grill；并检查任何文字是否偷换成 memory 已写入、技术映射已定或 R3/W1 获授权。

烦请给出明确 GO_FOR_DEXTER_ACCEPTANCE 或 NO-GO，并汇总 M / S / N。如有问题，请按 M / S / N 标注精确文件与行号、业务影响、最小修订建议、证据以及是否需要 Dexter 产品裁决；每项须给出 CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE / UNVERIFIED_REQUIRES_EVIDENCE / DEXTER_DECISION 处置。

授权边界：本次 GO 只表示该“纳入方案”可以交 Dexter 接受；不写入 project-memory，不确认 G-13+，不确认技术/contract 映射，不恢复 R3/W1，不授权业务代码、contract、数据库、DEV/seed/reset、动态运行或任何 Git 操作。谢谢。
```
