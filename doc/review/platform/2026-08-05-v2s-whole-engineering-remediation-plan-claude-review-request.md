---
title: Claude 评审交接：全工程修复程序详细设计与执行计划
reviewStatus: PENDING
reviewKind: PROGRAM_REMEDIATION_DESIGN
implementationFacing: false
implementationAuthority: false
sourceReview: doc/review/platform/2026-08-05-v2s-whole-engineering-merged-review-claude.md
---

# Claude 评审交接：全工程修复程序详细设计与执行计划

## 背景

`doc/review/platform/2026-08-05-v2s-whole-engineering-merged-review-claude.md` 是 Dexter 指定的全工程评审最终结论。Codex 据此形成了程序级修复详细设计和执行计划，并已把终稿中撤回项、B3 节点集合的自相矛盾、同源契约消费者漂移、跨层可观测性闭环及受管 cleanup proof 拆开处理。

这是评审修复程序的设计，不是 implementation-facing 详设；当前没有实现、契约/schema、DEV、seed/reset、动态运行或 Roadmap 变更授权。

## 评审目标

请独立判断该计划是否完整、可执行且没有过度设计：所有仍有效 finding 是否都有正确 owner、有限分母、反例、防复发与验收；合并/拆分是否避免了跨 owner 的错误耦合；需要 Dexter 决策的事项是否被显式列出；计划是否错误地把设计评审当成实施授权。

## 需阅读文件

- `doc/review/platform/2026-08-05-v2s-whole-engineering-merged-review-claude.md`：最终 finding、撤回项、优先级和终稿的修订语义。
- `doc/review/platform/2026-08-05-v2s-whole-engineering-remediation-design-and-execution-plan-codex.md`：待评审的程序级详细设计、单元分母、依赖、决策和验收。
- `AGENTS.md`：owner、环境、日志、审查和实施边界。
- `doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md`：全链路日志、脱敏、受管运行和 business/cleanup 证据约束。
- `doc/decisions/2026-07-27-v2s-identified-finding-generalization-and-prevention.md`：问题族、反例、有限分母和防再犯要求。

## 独立核验重点

1. 154/144/147、废弃 `projectId`、U01 placement report 与 U01 catalog 是否应作为同一个消费者契约 delivery unit；并确认手写 scenario fact 不能从 registry 生成，以及 `.mjs` 的类型/运行时验证选择是真正可执行的。
2. 可观测性是否正确被设计为“一个架构闭环、三个实现面”，并确实要求 Dexter 先决定 sink、保留、访问和 edge face；核验脱敏红线、`AdminErrorBoundary` 与 bootstrap 输出没有被遗漏。
3. 品牌 queryText 搜索与 Drawer lifecycle 是否应拆为两个单元；在 Dexter 已裁定全量收敛 316 处的前提下，节点字面量是否严格先分类、再按集合独立实施，未发生危险的全局替换授权。
4. host self-hash 与 cleanup tree proof 是否拆分，且 cleanup 要求的是整棵受管树的证明而不是组长 PID 消失。
5. B0 gate 分类与接线是否先后分离；跨 schema audit read、`SELECT *`、presentation filter、password-reset skeleton、Flyway denominator、ST-11、heritage hash、MinIO、read model、OpenAPI error、page-size、`findFirst` 和 helper 收敛是否保留了各自 owner/产品决策。
6. 检查终稿已撤回或明确不重开的事项没有被错误纳入实施分母。

## 期望结论

请给出明确 `GO` 或 `NO-GO`。如有问题，请按 `M` / `S` / `N` 标注精确文件与行号、影响面、最小修复建议及是否需要 Dexter 产品/架构裁决。若 GO，请明确说明它仅代表“可以为各已授权单元进入 implementation-facing 详设”，不代表任何实现获授权。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审本次全工程修复程序的详细设计与执行计划。

背景：`doc/review/platform/2026-08-05-v2s-whole-engineering-merged-review-claude.md` 是 Dexter 指定的最终 finding 结论；Codex 已据此完成程序级计划，刻意拆开了同源契约漂移、跨层可观测性、两个用户缺陷、受管 cleanup 与多语义节点集合。本轮没有实现授权。
目标：请独立核验 `doc/review/platform/2026-08-05-v2s-whole-engineering-remediation-design-and-execution-plan-codex.md` 是否完整、正确分批、边界清晰、可验证且没有过度设计；特别检查 owner、有限分母、反例、防复发、Dexter 决策依赖和实施授权边界。

请从 catering-v2s 仓库根阅读：
- `doc/review/platform/2026-08-05-v2s-whole-engineering-merged-review-claude.md`：最终 finding、撤回项和优先级；
- `doc/review/platform/2026-08-05-v2s-whole-engineering-remediation-design-and-execution-plan-codex.md`：待评审的详细设计与执行计划；
- `AGENTS.md`：owner、运行、日志和审查红线；
- `doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md` 与 `doc/decisions/2026-07-27-v2s-identified-finding-generalization-and-prevention.md`：验收和防再犯约束。

请重点独立核验：154/144/147 + `projectId` + catalog 的契约消费者单元；可观测性 backend/frontend/bootstrap 三层闭环；品牌 queryText 与 Drawer lifecycle 的拆分；节点集合是否在既有全量收敛裁定下先分类、再按集合实施且未抢跑；host trust 与 cleanup tree proof 的拆分；以及 B0 分类先于 gate 接线、跨 schema audit read 等 owner 决策。请确认已撤回项没有重新进入计划。

烦请给出明确 GO 或 NO-GO。如有问题，请按 M / S / N 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品或架构裁决。

授权边界：本次 GO/NO-GO 仅评审程序级设计；它不授权任何实现、契约/schema 改动、DEV、seed/reset、动态运行、Roadmap 变更或 gate 接线。即使 GO，每个实施单元仍须获得单独授权、implementation-facing 详设、独立对抗审查和证据闭环。谢谢。
```
