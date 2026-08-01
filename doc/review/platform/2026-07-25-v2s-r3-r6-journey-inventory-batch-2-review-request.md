---
title: R3–R6 Journey inventory Batch 2 整体计划 Claude 评审请求
status: READY_FOR_CLAUDE_REVIEW
createdAt: 2026-07-25
programId: V2S_W0_W4_EXECUTION
reviewKind: JOURNEY_INVENTORY_PLAN
implementationAuthority: false
---

# R3–R6 Journey inventory Batch 2 整体计划 Claude 评审请求

## 背景

第一批与 Batch 1.5 已获 Claude GO 且 Dexter 接受，当前 Roadmap 唯一授权为
`R3_R6_JOURNEY_INVENTORY_BATCH_2`。旧 R3-J02 的 implementation-facing 资产均为
`PENDING_RECOVERY`，因为其把“不创建运营账号/任职/角色”与“运营端独立登录/session”
并列，无法证明真实运营用户登录。现需先规划如何建立并审查候选 Journey inventory，
再交 Dexter 排序；本次不是恢复 J02，也不是开始实现。

## 评审目标

请独立核验这份整体计划是否以最小、可审、不过度设计的方式：

1. 把 R3 的 platform-admin 身份与“既有集团空间”输入前提，以及 operations-admin 首用户前提分开；
2. 把 R4/R6 的技术工作诚实标为非业务 Journey；
3. 让 R5 在没有 Dexter 批准业务范围时保持范围占位，而不是伪造空白 Journey；
4. 以三选一前提链和 confirmed corpus 禁推防止 test/seed/default/历史资产绕行；
5. 在 Claude GO 后仍把产品取舍留给 Dexter，而非将 review 偷换为实现授权。

## 需阅读文件

- `doc/plans/platform/2026-07-25-v2s-r3-r6-journey-inventory-batch-2-plan.md`：本次待评审的整体计划、候选边界、执行顺序和完成条件；
- `doc/review/platform/2026-07-25-v2s-r3-r6-journey-inventory-batch-2-codex-self-review.md`：Codex 从 Dexter/业务立场完成的第一轮对抗自审；
- `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`：当前 `CURRENT_*`，以及 R3–R6 的原始阶段定位；
- `doc/decisions/templates/journey-decision-template.md`：候选卡片的前提链三选一与阻断规则；
- `project-memory/decisions/confirmed-business-language-corpus.md`：G-01、G-03、G-05、G-07、G-10 的现行业务语言与禁推；
- `doc/review/platform/2026-07-25-v2s-r3-scope-login-ui-method-gap-review-claude.md`：此前已确认的 R3 登录范围缺口，作为问题输入而非当前实现依据；
- `doc/decisions/2026-07-25-v2s-design-governance-batch-1.md` 与 `doc/decisions/2026-07-25-v2s-design-governance-batch-1-5.md`：已接受的 Journey/交互法治与 Batch 2 授权边界。

## 独立核验重点

- 计划是否把旧 J02 当作历史候选输入而非已恢复的当前 Journey；
- C-01/C-02 的身份、既有集团空间输入、任职、入口和业务数据前提是否足够分开，且所有未决前提均真实阻断详设；
- “R4/R6 非 Journey、R5 待 Dexter 选范围”的判断是否遗漏真实业务 Journey，或反过来是否把技术活动伪装成用户价值；
- 两张候选卡片 + R5 范围占位 + 一页总表是否确实能在约半小时内审完；是否存在应该拆掉或不该预先纳入的范围；
- Codex 的推荐“先裁 C-01/C-02 身份与输入，再排 C-01/C-02/R5 范围顺序”是否有更小、更合理的替代；
- 本计划是否真的没有线框、mockup、implementation-facing design、contract、DB、app/DEV/runtime 或 Git 的暗中推进。

## 期望结论

请给出明确 `GO` 或 `NO-GO`。如有 finding，请按 `M` / `S` / `N` 标注精确文件与行号、
影响面、最小修复建议，以及是否需要 Dexter 产品裁决。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审本次 R3–R6 Journey inventory（Batch 2）整体计划。

背景：设计法治 Batch 1/1.5 已获您 GO 且 Dexter 接受；当前只授权建立候选 Journey 的前提链和排序输入。旧 R3-J02 implementation-facing 资产为 PENDING_RECOVERY：它无法证明 operations-admin 存在合法真实登录者。本次只规划如何盘点、分类和交 Dexter 排序，不恢复 J02，也不进入实现。
目标：请独立核验该计划是否把业务 Journey、外部待裁决前提、R5 尚无 Journey 的范围占位和 R4/R6 技术工作准确分开，并且以最小批量暴露 platform-admin 身份、既有集团空间输入与 operations-admin 首用户来源缺口。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-07-25-v2s-r3-r6-journey-inventory-batch-2-plan.md：整体计划、候选边界、执行顺序；
- doc/review/platform/2026-07-25-v2s-r3-r6-journey-inventory-batch-2-codex-self-review.md：Codex 第一轮对抗自审；
- doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md：当前授权与 R3–R6 定位；
- doc/decisions/templates/journey-decision-template.md：前提链三选一和阻断规则；
- project-memory/decisions/confirmed-business-language-corpus.md：G-01/G-03/G-05/G-07/G-10 及禁推；
- doc/review/platform/2026-07-25-v2s-r3-scope-login-ui-method-gap-review-claude.md：既有登录范围缺口的独立结论；
- doc/decisions/2026-07-25-v2s-design-governance-batch-1.md 和 doc/decisions/2026-07-25-v2s-design-governance-batch-1-5.md：已接受治理与 Batch 2 边界。

请重点独立核验：C-01/C-02 是否把 platform 身份、既有空间输入与 operations 首用户缺口分别呈现；R4/R6 标为非 Journey、R5 只保留范围占位而不伪造 Journey 是否合理；未决前提是否真实阻断详设且未以 seed/default/历史资产绕行；计划是否仍为半小时内可核的小批量；以及是否没有借 review 暗中推进 UI、contract、DB、app/DEV/runtime。

烦请给出明确 GO 或 NO-GO。如有问题，请按 M / S / N 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。

授权边界：本次 GO/NO-GO 仅评价 Journey inventory 整体计划。它不恢复 R3-J02，不授权 R3/W1 implementation、contract、migration、database、apps、DEV、动态运行、seed/reset 或任何 Git 操作；即使 GO，产品前提与候选排序仍由 Dexter 裁决。谢谢。
```
