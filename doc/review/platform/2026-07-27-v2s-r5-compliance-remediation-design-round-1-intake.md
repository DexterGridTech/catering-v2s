---
title: R5 合规整改 DESIGN 独立审查 Round 1 finding intake
status: AUTHOR_RESOLVED_AWAITING_ROUND_2
createdAt: 2026-07-27
reviewCycleId: R5-COMPLIANCE-REMEDIATION-DESIGN-20260727
reviewTarget: DESIGN
reviewRound: 1
reviewRoundLimit: 2
implementationAuthority: false
---

# R5 合规整改 DESIGN Round 1 finding intake

## 1. Intake 纪律

作者逐条重开 reviewer evidence、Roadmap、design、manifest、matrix、module registry、remote runner 与
业务 decision。8 条 finding 均有 owning source，未发现需要拒绝或升级为产品裁决的部分。
本轮处置不授权实现。

| finding | intake | source-first 结论 | 最小处置 |
| --- | --- | --- | --- |
| M-001 | CONFIRMED | 动态 count 不等于 enforcement 完备，原设计缺 accepted resolver、stable ID、set equality 与 mapping drift red | 详设 §2.2 增 deterministic mapping 六条；manifest 增 mapping contract |
| M-002 | CONFIRMED | 10 unit 只有 boolean，确实没有六分母逐项绑定 | manifest 为 U00–U09 各增六个 source/selector/applicability/missingEntryFails 行 |
| M-003 | CONFIRMED | sole current Roadmap 仍显示旧 implementation=true，和 2026-07-27 exact authorization 冲突 | 同步 sole Roadmap 为 WAITING_R5_COMPLIANCE_REMEDIATION_DESIGN_REVIEW，所有 implementation/runtime/seed authority false |
| S-001 | CONFIRMED | Flyway 有七 fact schema，registry 将 schema-less platform-access 错填为第八 | 详设命名七项；CR04 明确 registry `platform_access -> null`，禁止建空 schema |
| S-002 | CONFIRMED | 方向正确但没有 exact runner/host/task/receipt contract | 绑定 runner path+hash，定义 host SHA、task registry、source snapshot、receipt 与七类 red |
| N-001 | CONFIRMED | 880 拆分缺 88 other pointer 的显式 baseline | CR01 记录 50/742/88；完成仍只看 unresolved=0 |
| N-002 | CONFIRMED | 150 ID 完整但 104 human/46 machine 分区不够直接 | manifest 每章节恢复 reviewRuleIds/machineRuleIds/checklist/reason |
| N-003 | CONFIRMED | corpus miss 不能替代 operation-history/extension owning decision | 详设与 manifest 增 non-corpus decision authority |

## 2. 替代与成本

- 不采用“只补当前 10 个 predicate”的小修，因为无法证明未来 source row 不被漏接。
- 不建设语义 DSL 或新 policy service；versioned mapping manifest + 现有 checker 是更小边界。
- 不创建第二 Roadmap owner；只同步 registry 唯一 owner 的授权状态。
- 不为 platform-access 新建 schema；更正 registry 分类成本最小。
- 不安装本机 Docker；精确绑定既有 remote runner。

## 3. Round 2 定向核验

第二轮只需证伪：

1. mapping contract 是否仍允许 unmapped source row 假绿；
2. 10×6 denominator binding 是否完整且无自引用 hash 悖论；
3. sole Roadmap 与 exact authorization 是否一致；
4. 七 schema/remote runner/150 partition/non-corpus authority 是否闭合；
5. 修订是否引入新 M/S。

`REVIEW_ROUND=2` 是本 cycle hard stop；后续不得开第三轮。

