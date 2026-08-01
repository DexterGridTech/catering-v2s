---
title: all-v2 执行治理 disposition 与缺口补齐 Claude 评审请求
status: READY_FOR_CLAUDE_REVIEW
createdAt: 2026-07-25
reviewKind: GOVERNANCE_HERITAGE_MEMORY
authorizationBoundary: "仅治理、Heritage 冻结、project-memory、matrix 登记；不授权 implementation、contract、数据库、DEV、动态运行或 Git"
---

## 背景

Dexter 要求优先于 C-01 线框回补，对 all-v2 的 AGENTS 逐条 disposition，并对 CLAUDE 与 platform
standards 作清单级对账。已知缺口包括 carry-over-first、六行汇报/final gate、两条 traceability gate、
阶段反思和完整日志标准。本批以四态 disposition 处理所有条目，新增三个 hash-bound Heritage 资产、
一份 operation memory 和两个 R4 `PLANNED` matrix 接线；没有移动任何业务实现边界。

## 评审目标

请独立确认：(1) AGENTS 逐条 disposition 没有把旧多服务/MDB 规则误标为当前真相；(2) 七项初始
缺口均有明确、最小且不越权的落点；(3) Heritage 扩展仍是 source/copy hash-bound 且不成为 fallback；
(4) R4 `PLANNED` 没有被偷换为已实现 gate；(5) memory denominator 与 progress/final gate 的语义完整。

## 需阅读文件

- `doc/review/platform/2026-07-25-v2s-all-v2-governance-disposition-ledger.md`：逐条对账、标准清单和缺口补齐台账；
- `doc/review/platform/2026-07-25-v2s-all-v2-governance-disposition-codex-self-review.md`：第一轮 Codex 对抗自审；
- `AGENTS.md`：新增六行汇报、final 闸门、完整日志标准回指和当前 v2s 红线；
- `doc/decisions/2026-07-25-v2s-frontend-asset-carry-over-first.md`：明确“恢复既有规则而非新增”的 decision；
- `doc/heritage/registry.json`、`doc/heritage/required-inventory.json`、`doc/heritage/frozen/catering-all-v2/`：26 项当前 Heritage 分母及三个冻结副本；
- `project-memory/operations/phase-retrospective-and-systemic-repair.md`、`project-memory/pitfalls/log-first-failure-retry.md`、`project-memory/kernel/05-evidence-runtime-and-git.md`：memory 蒸馏与回指；
- `contracts/policy/standards-coverage-matrix.json`：`B.5.N01`/`B.5.N08` 的 R4 `PLANNED`；
- `../catering-all-v2/AGENTS.md`、`../catering-all-v2/CLAUDE.md`、`../catering-all-v2/doc/platform/*standard*.md`：源仓独立对照材料（只读）。

## 独立核验重点

1. 复算新增三项 all-v2 source/copy SHA-256，确认 source hash 与 frozen copy 均为：
   `173c7d5e…8e5d`、`93e7ccb6…3053`、`597a8774…e03b`；并运行 `scripts/check/heritage-registry` 与 `--self-test`。
2. 对照 all-v2 AGENTS 全部 L3–L88 规则，尤其 L37 的分布式拓扑、L39/L40、L46、L54、L63、L71–84、L88，确认 disposition 诚实且没有 `MISSING` 被静默跳过。
3. 运行 `scripts/check/project-memory`，确认 17-entry denominator、新 operation memory、压缩 kernel 与 frozen log standard 的 source anchor 无漂移。
4. 运行 `scripts/check/standards-coverage --phase R3`，确认两条新 ref 只是 R4 `PLANNED`；不要运行或把 frozen all-v2 checker 当作 v2s production gate。
5. 从业务/Dexter 视角追问：carry-over-first 是否可能压过已批准 Journey；六行/final gate 是否产生错误阻断；并检查本批是否暗中授权 R3 实现、contract、database、DEV、动态运行或 Git。

## 期望结论

请给出明确 `GO` 或 `NO-GO`。如有 finding，请按 `M` / `S` / `N` 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审本次 all-v2 执行治理 disposition 与缺口补齐批次。

背景：Dexter 要求在继续 C-01/R3 前，逐条对账 all-v2 AGENTS，并清单核对 CLAUDE 与八份 platform standard。此批只恢复治理、冻结 Heritage、更新 project-memory 和登记 R4 future gate；不做任何实现、contract、数据库、DEV、动态运行或 Git。
目标：请独立核验 disposition 是否忠实、是否错误迁入多服务/旧 MDB 拓扑、七项初始缺口是否都以最小方式补齐，以及 R4 待接线项有没有被写成已实现。

请从 catering-v2s 仓库根阅读：
- doc/review/platform/2026-07-25-v2s-all-v2-governance-disposition-ledger.md：逐条对账与缺口补齐；
- doc/review/platform/2026-07-25-v2s-all-v2-governance-disposition-codex-self-review.md：Codex 第一轮对抗自审；
- AGENTS.md：v2s 当前进度/结束/日志规则；
- doc/decisions/2026-07-25-v2s-frontend-asset-carry-over-first.md：恢复既有规则的 decision；
- doc/heritage/registry.json、doc/heritage/required-inventory.json、doc/heritage/frozen/catering-all-v2/：26 项 Heritage 分母；
- project-memory/operations/phase-retrospective-and-systemic-repair.md、project-memory/pitfalls/log-first-failure-retry.md、project-memory/kernel/05-evidence-runtime-and-git.md：memory 落点；
- contracts/policy/standards-coverage-matrix.json：B.5.N01/B.5.N08 的 R4 PLANNED；
- ../catering-all-v2/AGENTS.md、../catering-all-v2/CLAUDE.md、../catering-all-v2/doc/platform/*standard*.md：只读源仓对照。

请重点独立核验：新增三项的 source/copy hash；all-v2 L37/L39/L40/L46/L54/L63/L71–84/L88 是否被诚实 disposition；project-memory 17-entry denominator 是否闭合；两条 frozen checker 是否仅为 R4 参照；以及本批没有暗中扩大到 R3 实现或产品范围。

烦请给出明确 GO 或 NO-GO。如有问题，请按 M / S / N 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。

授权边界：本次 GO/NO-GO 只接受或否决治理/Heritage/memory/matrix 登记；它不授权 implementation、contract、数据库、DEV、动态运行、seed/reset 或任何 Git 写入。谢谢。
```
