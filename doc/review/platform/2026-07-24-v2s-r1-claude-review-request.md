# catering-v2s R1 Claude 复核请求

```text
REVIEW_STATUS=READY
REVIEW_KIND=R1_IMPLEMENTATION_AND_TRANSFER_EVIDENCE
PROGRAM_ID=V2S_W0_W4_EXECUTION
ROADMAP_STEP=R1
SOURCE_PREPARED_SHA256=a76b245cc4afe9a978989bb93b9024ef651a33aad6089d7f4d0a2f20fc0d71b5
TARGET_ADOPTED_SNAPSHOT_SHA256=7ed6fc31be727dd64483b6bc4b051c306fd93417272b8287e108ba00e42c6e76
IMPLEMENTATION_CLOSURE_SHA256=e1bcbf43c8c6a0b475e14169ebc0e0dcc1248e54bbefc8097a384ed1ae1add91
TRANSFER_RECEIPT_SHA256=61bf4f4729efbb5bfbd8d5cbea1c43987503067c306deaf28a34ce7e350cefda
POST_TRANSFER_CLOSURE_SHA256=8093559204490c147aa9cf8ff0828c9441428f85b53b8ca0dafe03e86f4d5b21
CODEX_SELF_REVIEW_SHA256=c37cbebf6ec98c16e3568b0efb859942c6eca503647f539a9d293f1b5a593a0c
```

## 背景

Dexter 已授权 R1，implementation-facing design 经四轮独立审查最终 `GO(0 M / 0 S / 0 N)`。R1 已建立 v2s 仓内入口、确定性 memory/hooks、三类依赖 registry、七项 HANDOFF、四仓/13 资产只读 Heritage，并完成 source `EVIDENCE_READY` 到 v2s Registry-last owner 的切换。

第一次 post-transfer Codex 独立复核给出 `NO_GO(2 M / 2 S / 0 N)`：current Roadmap 被 adoption hash 锁死、fresh entry 残留 PREPARED/R1 文案、README flags 不可执行、closure 未强制 Claude request。当前已按 Registry-first deactivation → 修复 → new candidate → Registry-last republish 完成关闭。

## 评审目标

请 Claude 独立判断 R1 implementation 与 transfer evidence 是否忠实于冻结 ADR/manifest，能否在不依赖 all-v2 current state 或聊天摘要的情况下支持 future fresh v2s-rooted 会话，并确认四项 post-transfer finding 没有假修。

## 需阅读文件

- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`：v2s fresh entry 与冻结红线；
- `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`：唯一 current owner，R1 GO、R2 IN_REVIEW；
- `doc/evidence/platform/2026-07-24-v2s-roadmap-adopted-snapshot.md`：immutable adoption bytes；
- `doc/evidence/platform/2026-07-24-v2s-r1-implementation-closure.json`：pre-transfer business/cleanup 与 red controls；
- `doc/evidence/platform/2026-07-24-v2s-roadmap-control-plane-transfer.json`：immutable candidate receipt；
- `doc/evidence/platform/2026-07-24-v2s-r1-post-transfer-closure.json`：Registry-last activation readback；
- `doc/review/platform/2026-07-24-v2s-r1-codex-self-review.md`：Codex 自审与首败闭环；
- `contracts/policy/module-dependency-registry.json`、`HANDOFF.md`、`doc/heritage/registry.json`：R1 三项治理真相；
- `tools/roadmap-registry/transfer.mjs`、`scripts/check/r1-closure`：transfer 与 completion oracle。

## 独立核验重点

1. 运行：

   ```bash
   scripts/check/foundation-standard-actions
   scripts/check/roadmap-program-registry
   scripts/check/roadmap-control-plane-transfer
   scripts/check/roadmap-control-plane-transfer --self-test
   scripts/check/module-dependency-registry --self-test
   scripts/check/handoff-debt --self-test
   scripts/check/heritage-registry --self-test
   scripts/check/r1-closure --final
   ```

2. 核验 immutable adopted snapshot 保留 transfer hash，而 current Roadmap 可合法推进 R2-R6；`LEGAL_R2_ADVANCE_GREEN` 与 snapshot drift red 都真实。
3. 核验 Registry `ACTIVE`、Roadmap/active index/kernel/managed-runtime skill 均一致表达“R1 closed、R2 current but not write-authorized、W1/DEV forbidden”。
4. 按 `scripts/README.md` 原样执行 canonical recall；确认 foundation gate 自己也执行该命令。
5. 删除/改名 Claude request 或任何 required createPath 时，`r1-closure --final` 必须失败；两个 policy contract 合法，第三个 contract/apps/migration 必须失败。
6. 核验一个 deployable、单库多 schema、module owner、同事务 command、task read join、单 Flyway history、无 MQ/outbox/TDP/常态轮询、`x-consumer-faces` 单一真相、两个 admin 独立、start/restart 不 seed 均准确播种，且 R1 未创建 runtime。
7. 核验 source hash、13 Heritage hashes、target HEAD/worktree honesty、business/cleanup 和 active resources=0。

## 期望结论

请给出明确 `GO` 或 `NO-GO`。findings 按 `M` / `S` / `N` 标注精确文件与行号、影响、最小修复及是否需要 Dexter 产品裁决。`GO` 只表示 R1 达到 Dexter 可复核/接受条件，不授权 R2 写入、W1、DEV、seed/reset、Git 或生产切流。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助独立复核 catering-v2s R1 的 implementation 与 Roadmap 控制面移交证据。

背景：Dexter 已授权 R1；implementation-facing design 最终为 GO(0 M / 0 S / 0 N)。R1 完成后，第一次 post-transfer Codex 独立复核发现 2 M / 2 S / 0 N，现已按 Registry-first 停用、修复、new candidate、Registry-last 再激活的顺序关闭。
目标：请独立核验 v2s AI-first foundation、module dependency registry、HANDOFF、只读 Heritage、持续可更新 Roadmap 与 transfer/closure oracle 是否真实成立，尤其确认四项 post-transfer finding 没有假修。

请从 catering-v2s 仓库根阅读：
- AGENTS.md、PLATFORM-BLUEPRINT.md；
- doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md；
- doc/evidence/platform/2026-07-24-v2s-roadmap-adopted-snapshot.md；
- doc/evidence/platform/2026-07-24-v2s-r1-implementation-closure.json；
- doc/evidence/platform/2026-07-24-v2s-roadmap-control-plane-transfer.json；
- doc/evidence/platform/2026-07-24-v2s-r1-post-transfer-closure.json；
- doc/review/platform/2026-07-24-v2s-r1-codex-self-review.md；
- contracts/policy/module-dependency-registry.json、HANDOFF.md、doc/heritage/registry.json；
- tools/roadmap-registry/transfer.mjs、scripts/check/r1-closure。

请重点独立核验：按评审请求中的命令 fresh 复跑；adopted snapshot 与可变 current Roadmap 是否正确解耦；所有 fresh-entry current surface 是否一致；README canonical recall 是否原样可执行；required output/allowlist gate 是否真能失败；冻结架构红线、source/target/hash/Heritage、business/cleanup 与零资源是否一致。

烦请给出明确 GO 或 NO-GO。如有问题，请按 M / S / N 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。

授权边界：本次结论只复核 R1 是否达到 Dexter 可接受条件；不授权 R2 写入、W1、DEV、seed/reset、Git stage/commit/push、生产切流或任何破坏性操作。谢谢。
```
