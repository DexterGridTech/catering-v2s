---
title: R4 design Codex adversarial self-review round 1
status: SUPERSEDED_BY_ROUND_2
createdAt: 2026-07-25
reviewTarget: DESIGN
reviewCycleId: R4-W2-DESIGN-20260725
reviewRound: 1
reviewRoundLimit: 2
---

# R4 design Codex adversarial self-review round 1

## 用户任务与 Dexter 意图

R4 的用户任务是工程团队在 R5 迁移前快速发现冻结边界回归，不是任何业务 actor
登录、创建、编辑或查看业务事实。Dexter 要求一次性形成整个 R4 的详设和实施计划，
保持分钟级验证、单体/单库边界和 R3 现状，不提前建设 TDP 或 C-02。

## 攻击面

1. **假绿攻击**：检查每个 U01–U08 是否要求 production validator、真实 red mutation
   和 `scripts/verify` 接线，而不是仅有自测或文档声明。
2. **范围膨胀攻击**：检查是否新增业务 Journey、operations 登录、TDP、MQ、outbox、
   第二 deployable、数据库或 UI；未发现新增。
3. **第二真相攻击**：检查 standards matrix、gate catalog、Roadmap、manifest 是否会
   形成重复规则 owner；设计声明 matrix 是分母，catalog 只做 gate-to-rule binding，
   Roadmap 仍是状态 owner。
4. **语义 checker 攻击**：检查 B.5、日志和用户任务是否被关键词扫描冒充；设计保留
   当前 accepted UI regression 与人审 checklist，明确 R4 无新 UI。
5. **资源泄漏攻击**：检查 Testcontainers、scratch、generated output、受管资源和
   business/cleanup 是否分账；每个单元均有 cleanup 字段，U04/U07/U08 明确零资源。

## Round 1 结果

发现并在 round 2 前修正一个设计缺口：初稿只在 U05 描述 UI traceability，未在 Part
B.5 hit map 明确“R4 无新 UI、只回归 R3 accepted evidence”的适用性。修正后已写入
`doc/review/platform/2026-07-25-v2s-r4-design-manifest-chapter-hit-map.md` 和 manifest
`standardsCoverage.partB.B.5.note`。没有发现需要 Dexter 新产品裁决的歧义。
