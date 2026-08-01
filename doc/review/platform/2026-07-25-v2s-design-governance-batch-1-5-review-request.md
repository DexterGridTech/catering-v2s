---
title: v2s 设计法治 Batch 1.5 Claude 评审请求
status: FROZEN_FOR_CLAUDE_REVIEW
createdAt: 2026-07-25
programId: V2S_W0_W4_EXECUTION
reviewKind: DESIGN_GOVERNANCE_BATCH_1_5
implementationAuthority: false
---

# v2s 设计法治 Batch 1.5 Claude 评审请求

## 背景

第一批已获 Claude GO(0 M / 0 S / 1 N)，Dexter 授权本批补齐 N-1 和四项治理增补：
all-v2 前端 decision 的冻结出处链、交互工件 B.4/B.5 人审对照、三项第三方 skill 的
本仓适配壳，以及按需高保真静态 demo 规则。

## 评审目标

独立确认这些增补增强可审阅性而没有把旧仓、vendor、mockup 或 checker 变成新的当前
权威。

## 需阅读文件

- doc/decisions/2026-07-25-v2s-design-governance-batch-1-5.md
- doc/review/platform/2026-07-25-v2s-design-governance-batch-1-5-codex-self-review.md
- doc/decisions/templates/ui-interaction-design-template.md
- doc/decisions/templates/journey-decision-template.md
- doc/heritage/registry.json、doc/heritage/required-inventory.json 与
  doc/heritage/frozen/catering-all-v2/project-memory/decisions/
- .agents/skills/vendor/superpowers-6.2.0/manifest.json、三个 VENDOR-SKILL.md 和
  .agents/skills/cs-brainstorming/SKILL.md、cs-writing-plans/SKILL.md、
  cs-systematic-debugging/SKILL.md
- scripts/check/heritage-registry
- contracts/policy/standards-coverage-matrix.json 的 JOURNEY_INTERACTION_REVIEW

## 独立核验重点

1. N-1 是否仅以八列分隔行修正；
2. 十份 all-v2 原文是否 source/target/hash/字节一致，且没有覆盖 v2s current decision、
   形成 runtime/build fallback 或偷换为本仓政策；
3. B.4/B.5 是否是“命中或不适用理由 + 冻结路径@hash”的人工对照，而非语义 checker；
4. vendor 是否确实冻结到本仓、适配壳是否以 AGENTS/local templates 为准并剪掉 Git/
   自动推进，且阶段、交付物头部和人审回写三者一致；
5. 高保真 demo 是否保持可选、纯静态、假数据可追溯、旧壳只读摹写、未来零 app 引用；
6. 是否仍没有 R3–R6 inventory、J02 恢复、implementation、contract、DB、DEV、runtime、
   seed/reset 或 Git。

## 期望结论

请给出 GO 或 NO-GO，finding 采用 M / S / N，并列精确路径/行号、影响、最小修复、
反例或适用条件、是否需要 Dexter 裁决。本批交付量应在约半小时可核完。

## 授权边界

GO 只表示 Batch 1.5 可以交 Dexter 接受；不接受任何 R3–R6 Journey，不恢复 J02，
不启动第二批，也不授权 implementation、contract、数据库、DEV、动态运行、seed/reset
或 Git。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请独立评审 catering-v2s 的“设计法治 Batch 1.5”。

背景：第一批已获 GO(0 M / 0 S / 1 N)。Dexter 授权本批随第一批一并冻结送审，范围仅为：
修复 UI 模板 N-1；把十份 catering-all-v2 前端 decision 按 path/hash 冻结为 Heritage，
让交互工件能将 manifest B.4/B.5 条文回指原文；以本仓 cs-适配壳收编 brainstorming、
writing-plans、systematic-debugging 三个 vendor skill；以及规定按需高保真静态 demo。

目标：请验证这些增补提高出处、阶段与看图的可审阅性，却没有把旧仓、vendor、mockup
或关键词 checker 偷换成当前业务/实现权威。

请从 catering-v2s 根目录阅读：
- doc/review/platform/2026-07-25-v2s-design-governance-batch-1-5-review-request.md
- doc/decisions/2026-07-25-v2s-design-governance-batch-1-5.md
- doc/review/platform/2026-07-25-v2s-design-governance-batch-1-5-codex-self-review.md
- doc/decisions/templates/journey-decision-template.md 与 ui-interaction-design-template.md
- doc/heritage/registry.json、required-inventory.json、doc/heritage/frozen/catering-all-v2/project-memory/decisions/
- .agents/skills/vendor/superpowers-6.2.0/manifest.json、三份 VENDOR-SKILL.md、三份 cs-* 适配壳
- scripts/check/heritage-registry 和 standards-coverage-matrix 的 JOURNEY_INTERACTION_REVIEW。

请重点独立核验：N-1 是否仅补表格列；十份 Heritage 是否 source/target/hash/字节一致且不
覆盖 v2s 现行决策、不形成 fallback；B.4/B.5 是否仅为人工命中/不适用+path@hash 对照；
skill 是否本仓冻结并剪掉 Git/自动推进、阶段和 SKILL_USED 回写是否一致；高保真 demo
是否可选、静态、可追溯、无运行时依赖；是否没有提前启动 R3–R6 inventory 或恢复 J02。
请主动找反例与边界，不要只接受作者说明。

请给出 GO 或 NO-GO；finding 按 M/S/N，给出精确路径/行号、影响、最小修复、反例/适用
条件及是否需 Dexter 裁决。

授权边界：本次 GO 仅评估 Batch 1.5。它不授权任何 R3/W1 implementation、contract、
migration、app、DEV、数据库、动态运行、seed/reset 或 Git；Dexter 接受前不得启动第二批
R3–R6 Journey inventory 或恢复 J02。谢谢。
```
