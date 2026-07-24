---
title: v2s R1 执行框架复审 resolution
type: review-resolution
status: IN_REVIEW
scope: R2_CONTROL_PLANE_AMENDMENT_ONLY
programId: V2S_W0_W4_EXECUTION
createdAt: 2026-07-24
decisionOwner: Dexter
implementationOwner: Codex
---

# v2s R1 执行框架复审 resolution

## 输入与边界

Claude 的复审文件在 Roadmap transfer 后写入只读 Heritage 仓：

```text
sourceRepository=catering-all-v2
sourcePath=doc/review/platform/2026-07-24-v2s-r1-execution-framework-review-claude.md
sourceSha256=2b9910ce287a25a8dc9066150a9722d54955f918ec353d22d1491fef8657abd0
sourceObservedMtime=2026-07-24T17:56:16+09:00
sourceVerdict=GO(0M / 1S / 2N)
```

该文件只作为 path/hash-bound review 输入。本 resolution 不删除、不修订、不回写 all-v2，也不把它登记为 current owner；后续 R2-R6 review material 只写 v2s。

Dexter 已授权的范围仅为 standards coverage、R1 review resolution 与相应 current-truth 导航修订。`R2_AUTHORIZED=false`、W1/runtime/DEV/database/Git authority 均保持关闭；当前 all-v2-rooted 会话不能冒充 fresh v2s-rooted R2 acceptance。

## Claude 更正的独立核验

Codex 从 v2s 仓只读复跑：

```text
scripts/check/agent-lifecycle=PASS
scripts/check/project-memory=PASS
scripts/check/handoff-debt=PASS
scripts/check/r1-closure --final=PASS (修订前 R1 baseline)
business=PASS
cleanup=PASS
activeManagedResources=0
```

因此接受两项公开更正：

1. hook 真相根是 `.codex/hooks.json` 与 `scripts/hooks/{session-start,prompt-route,stop}`；`agent-lifecycle` 真执行三类 hook，并具有 prompt source injection、active goal 与 cleanup red controls。
2. post-transfer M-1/M-2/S-1/S-2 的逐项修复账位于 immutable implementation closure 的 `/defectRetrospective`，不是 post-transfer closure 自身；`handoff-debt` 已独立 PASS。

## Findings resolution

### S-1：规范到执法覆盖不可判定

结论：`FIXED_PENDING_INDEPENDENT_REVIEW`。

- `contracts/policy/standards-coverage-matrix.json` 绑定冻结 manifest SHA-256 与 `MARKDOWN_STRUCTURAL_RULES_V1` denominator；
- denominator 精确为 Part B numbered=85、Part C table rows=23、Part D bullets=30、Part D table rows=12，总计 150；
- 每个 source unit 具有稳定 `ruleId`、source text hash、active project-memory assertion 与 enforcement；
- generated `project-memory/index.md` 明确不是 memory anchor；current truth 仍是 11 份 active memory 原文；
- 机器不能判定的规则显式使用 `UNENFORCEABLE_BY_MACHINE`，并绑定矩阵内 review checklist；
- `scripts/check/standards-coverage` 按 Roadmap phase 判定，包含缺规则、缺 memory、PLANNED 逾期、坏 active ref、缺 review checklist 五类 red control；
- 矩阵只做 trace/enforcement mapping，不复制冻结规则正文；agent 仍须回读 source path。

### N-1：Claude 入口无机器接线

结论：`INTENTIONAL`。

当前 Claude review 是人为从 v2s 仓根发起的独立会话，`CLAUDE.md` 已要求读取与 Codex 相同的 Registry/memory/source 链。未经真实 Claude client hook 契约验证，不创建 `.claude/settings.json` 第二套 hook 配置。矩阵以 `CLAUDE_ENTRY_INTENTIONAL_REVIEW` 要求 fresh reviewer 人工证明入口链 readback；该 checklist 不能被静态文件存在替代。

### N-2：post-transfer closure 缺 findingsResolutionRef

结论：`RESOLVED_WITH_TARGET_NATIVE_SIDECAR`。

不执行 Claude 建议的字面修改，因为：

- `doc/evidence/platform/2026-07-24-v2s-r1-post-transfer-closure.json` 是 write-once immutable activation evidence；
- 原 hash 为 `8093559204490c147aa9cf8ff0828c9441428f85b53b8ca0dafe03e86f4d5b21`；
- R1 Claude request 已绑定该 hash，直接加字段会制造 stale review chain。

本 resolution 作为 current target-native 单入口，明确指向：

```text
implementationClosure=doc/evidence/platform/2026-07-24-v2s-r1-implementation-closure.json
implementationClosureSha256=e1bcbf43c8c6a0b475e14169ebc0e0dcc1248e54bbefc8097a384ed1ae1add91
findingsResolutionJsonPointer=/defectRetrospective
postTransferClosure=doc/evidence/platform/2026-07-24-v2s-r1-post-transfer-closure.json
postTransferClosureSha256=8093559204490c147aa9cf8ff0828c9441428f85b53b8ca0dafe03e86f4d5b21
```

这保留审计可达性，同时不篡改 R1 immutable evidence。

## Create / update / delete / retain

Create：

- `contracts/policy/standards-coverage-matrix.json`
- `scripts/check/standards-coverage`
- 本 resolution
- `doc/review/platform/2026-07-24-v2s-r2-standards-coverage-review-request.md`

Update：

- `AGENTS.md`、`CLAUDE.md`、`scripts/README.md`
- current Roadmap 与 active-document-index
- `project-memory/kernel/01-workspace-and-roadmap.md`
- `project-memory/decisions/deterministic-context-only.md`
- project-memory required inventory、generated index 与 deterministic CLI denominator hash

Delete：无 current 资产；试作的额外 memory 文件未进入最终 denominator。

Retain：

- 全部 R1 immutable closure、receipt、adopted snapshot 与既有 review request bytes；
- Registry program/current step：`V2S_W0_W4_EXECUTION / R2 / IN_REVIEW`；
- `R2_AUTHORIZED=false`、W1/runtime/DEV/database/Git authority=false；
- all-v2 原状，不回写或清理 transfer 后出现的 review 文件。

## Review 关闭条件

本 resolution 只有在以下证据由 fresh v2s-rooted reviewer 独立复核后才能关闭：

1. `standards-coverage --phase R2` 和 `--self-test` 均 PASS；
2. 150 个 source unit 与 manifest hash/text hash 精确一致；
3. 11 份 active memory 原文仍由 required inventory 和 project-memory red controls 保护；
4. 每项 ACTIVE enforcement ref 存在，每项 PLANNED 未逾期，每项人审规则具有有效 checklist；
5. source review 的 post-transfer 写入不再扩散，R1 immutable hashes 未改变；
6. Roadmap 仍为 R2 `IN_REVIEW`，没有 R3/W1、DEV、seed/reset、数据库或 Git 写入；
7. Claude 给出 `GO(0 M / 0 S / N*)`；任一 M/S 都阻断本控制面修订关闭。
