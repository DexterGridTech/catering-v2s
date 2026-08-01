---
title: RM1 实施详设 post-remediation Claude 复核请求
reviewKind: IMPLEMENTATION_FACING_DESIGN
programId: V2S_W0_W4_EXECUTION
reviewCycleId: RM1-WHOLE-SCOPE-DESIGN-2026-07-28
reviewRoundLimit: 2
status: PROPOSED_REVIEW_ONLY
implementationAuthority: false
---

# RM1 实施详设 post-remediation 第二次 Claude 复核请求

REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
DESIGN_GRANULARITY_MANIFEST=doc/review/platform/2026-07-28-v2s-rm1-design-granularity-manifest.json
ADVERSARIAL_REVIEW_REPORT=doc/review/platform/2026-07-28-v2s-rm1-design-adversarial-review-round-2.json

## 背景

RM1 是对 R5 当前代码与控制面问题的重组整改设计，不是 implementation 授权。独立子 agent 的两轮 DESIGN 盲审已到上限，round-2 保留 `NO_GO` 的历史 verdict。Claude 首轮静态设计评审提出 M1–M6，post-remediation 复评又提出 D1 routed 分母不完整（M1）与 `create/update` 语义失真（S1）；本次仍只以 `POST_REMEDIATION_V1` 把 current bytes、作者 intake 与历史 round-2 不可变绑定起来，绝不伪造第三轮或改写历史 hash。

本次修订包括：P-D0 从固定写端点数字改为 post-P3-B inventory exact set；每 unit 声明 D1/D5 的 `owningSourceSet[]`；D1 以 unit 显式六维 route 从 active `project-memory/index.json` 动态派生 exact set（11/11 自检相等）；UI unit 对缺失 IA 保持 `BLOCKED_FOR_INTERACTION_ACCEPTANCE`；P2 补正分母、Flyway 相对路径、缺失根与 scope-drift 控制；所有已存在 concrete path 改为 `update`，仅保留真实缺失的 `create`；P7/P8 在执行计划中仍为严格串行、独立 receipt 的两个 package。由于历史 round-2 的 immutable unit denominator 是 11，manifest 的 U11 只保留该历史 review binding，内部显式要求 P7 receipt 先 PASS、P8 才可开始，不能把两个 package 的执行 exit 合并。

## 评审目标

请独立核验 current RM1 详设是否已真实关闭 Claude M1–M6 与复评 M1/S1，且没有以 post-remediation、source set 或 historical review binding 制造假绿。重点判断：D1 是否按 declared route 完整派生、`create` 是否只指向不存在路径、11-unit 历史 review binding 与 P7/P8 两个 execution package 的隔离是否诚实、可审计；不要把计划中的 P0 checker 当作已实施控制。

## 需阅读文件

- `doc/plans/platform/2026-07-28-v2s-rm1-restructure-and-remediation-implementation-design-and-plan.md`：RM1 57 项逐行实施详设、串行拓扑、P2/P3/P6/P7/P8 exit 与 amendment 边界。
- `doc/review/platform/2026-07-28-v2s-rm1-design-granularity-manifest.json`：11 个历史 review unit 的 current-byte hash、六类 package-exit 分母、D1/D5 owning source set 与 post-remediation 声明。
- `doc/review/platform/2026-07-28-v2s-rm1-design-post-remediation-intake.md`：对 M1–M6 的 source-first disposition 与本轮非实施边界。
- `doc/review/platform/2026-07-28-v2s-rm1-design-adversarial-review-round-2.json`：不可变的第二轮独立盲审及其 historical manifest binding。
- `doc/review/platform/2026-07-28-v2s-rm1-implementation-design-review-claude.md`：前次 Claude M1–M6、S1/S2、N1–N3 的完整 finding 原文。
- `doc/review/platform/2026-07-28-v2s-rm1-implementation-design-review-round2-claude.md`：本次 D1 routed completeness 与 create/update 语义的 finding 原文。
- `doc/review/platform/2026-07-28-v2s-rm1-manifest-chapter-hit-map.md`：Part B/C/D 章节级 standards 命中对照。
- `contracts/policy/standards-coverage-matrix.json`：150 条 standards 的 trace/enforcement 分母。

## 独立核验重点

1. fresh 复算设计正文 sha256，并确认 manifest 的 design、approvedSources、D2/D3/D4 current-byte binding 全部一致；复跑 `scripts/check/implementation-design-granularity --manifest ... --review ...`，应得到 `DECLARED_POST_REMEDIATION_AWAITING_CLAUDE`，而不是伪称历史 verdict 已变绿。
2. 核对 P-D0 不再有固定 `all 20 writes` 类判据；P2 是否明确包含正分母、8 个 Flyway location、缺失 input-root 和 `budget()` scope-drift 的行为级红证明。
3. 对每 unit 的 D1 以其 `memoryRoute` 与 `project-memory/index.json` frontmatter 独立重算 expected set，并验证与 `owningSourceSet[]` exact equality；`all` 必须作为应命中而非可选项。对 U09/U10 的 D5 验证既有 carry-over input 与 required IA artifact 都被列出，IA 未接受时必须保持阻塞。
4. 枚举所有 `changeSurfaces`：`create` 仅可指向当前不存在的 concrete path；已存在文件或目录必须是 `update`/`retain`/`delete`，并确认 P0 的 planned red mutation 能精确拒绝反例。
5. 核对 amendment 的三条限制：新 cycle 只覆盖 amendment artifact 与绑定 P6/P3-D 段；历史未闭合 finding exact-carry；re-freeze 只新增 amendment binding、不得重算旧 frozen bytes。
6. 核对 P7/P8 的执行 receipt 串行性没有被 U11 的历史审查绑定吞掉；若该解释不足以防止 package-exit 假绿，请给出设计级最小修复。
7. 按 current Roadmap `R5` fresh 运行 `scripts/check/standards-coverage --phase R5`，并结合 hit map 审阅 Part B/C/D，而不将机械 PASS 误作业务或 implementation PASS。

## 期望结论

请给出明确 `GO` 或 `NO-GO`。findings 请按 `M` / `S` / `N` 写精确相对路径和行号、影响面、最小修复建议，并标明是否需要 Dexter 产品裁决。请单列“方案合理性”判断：RM1 的串行控制与 source-set 治理是否仍是当前一人加两 AI、分钟级、零基建场景下的最小充分方案。

## 授权边界

本次是静态 implementation-facing design 的 Claude 复核。即使 GO，也只表示该设计可由 Dexter 决定是否接受；不授权 contract、业务源码、migration、测试、脚本、DEV、seed/reset、动态运行或 Roadmap current-state 变更。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审本次 RM1 实施详设 post-remediation 设计包。

背景：RM1 是 R5 当前代码与控制面问题的重组整改设计，不是 implementation 授权。两轮独立子 agent DESIGN 盲审已封顶；此前静态设计评审提出 M1–M6。本轮以 POST_REMEDIATION_V1 绑定 current bytes、作者 intake 与不可变的 round-2，不重置 cycle、不改写历史 hash。
目标：请独立核验 M1–M6 是否真实关闭，特别是动态 P-D0 分母、D1/D5 owning source set、UI amendment 阻塞、P2 静默失败防线，以及 P7/P8 严格串行 receipt 是否仍可审计。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-07-28-v2s-rm1-restructure-and-remediation-implementation-design-and-plan.md：57 项详设与串行计划；
- doc/review/platform/2026-07-28-v2s-rm1-design-granularity-manifest.json：current-byte manifest 与 post-remediation binding；
- doc/review/platform/2026-07-28-v2s-rm1-design-post-remediation-intake.md：M1–M6 处置；
- doc/review/platform/2026-07-28-v2s-rm1-design-adversarial-review-round-2.json：不可变 round-2；
- doc/review/platform/2026-07-28-v2s-rm1-implementation-design-review-claude.md：前次 finding；
- doc/review/platform/2026-07-28-v2s-rm1-manifest-chapter-hit-map.md：Part B/C/D 命中对照；
- contracts/policy/standards-coverage-matrix.json：standards 分母。

请重点独立核验：fresh 重算所有设计 hash；复跑 scripts/check/implementation-design-granularity --manifest doc/review/platform/2026-07-28-v2s-rm1-design-granularity-manifest.json --review doc/review/platform/2026-07-28-v2s-rm1-design-adversarial-review-round-2.json；确认结果是 DECLARED_POST_REMEDIATION_AWAITING_CLAUDE 而非历史绿。请检查 U09/U10 在 IA 未接受时仍为 BLOCKED_FOR_INTERACTION_ACCEPTANCE，并判断 U11 对 P7/P8 独立 execution receipt 的解释是否足以避免假绿。

烦请给出明确 GO 或 NO-GO。如有问题，请按 M / S / N 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。

授权边界：本次 GO/NO-GO 仅覆盖静态 implementation-facing design；不授权 contract、源码、migration、测试、脚本、DEV、seed/reset、动态运行或 Roadmap 状态变更。谢谢。
```
