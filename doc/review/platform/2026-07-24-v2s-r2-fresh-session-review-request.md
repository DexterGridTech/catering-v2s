# catering-v2s R2 fresh session 静态入口验收复核请求

```text
REVIEW_STATUS=READY
REVIEW_KIND=R2_FRESH_STATIC_ENTRY_ACCEPTANCE
PROGRAM_ID=V2S_W0_W4_EXECUTION
CURRENT_STEP=R2
CURRENT_STATUS=IN_REVIEW
ACCEPTANCE_STATE=EVIDENCE_READY_PENDING_DEXTER_ACCEPTANCE
ACCEPTANCE_EVIDENCE_SHA256=bb382a2df1bf472d4875f4ac285d8bef0e2dc3087ab0444426ef7448e7d0d340
CODEX_SELF_REVIEW_SHA256=f042e0f8cf92101e2864c52bbe342f04917a271790a1e33d0ac3c47c4ea2bdb9
ROADMAP_SHA256=a36fc88b0c151fdae719365b11925941a20e7de771b970f8e6eb11b03ac50392
STANDARDS_MATRIX_SHA256=358dc6bea08b6094ce7bf633bf68ffcbb4dab777c895f87627b7b5d9b4a18ce9
HANDOFF_EXPECTED_HEAD=5b083504f6687ca6be832171c79a4e1234078937
OBSERVED_HEAD=331984e8147e435e1ac7029f66fe38ff9cc8214e
OBSERVED_ORIGIN_MAIN=331984e8147e435e1ac7029f66fe38ff9cc8214e
BUSINESS=PASS
CLEANUP=PASS
ACTIVE_MANAGED_RESOURCES=0
CLAUDE_FRESH_CLIENT_STATUS=UNVERIFIED_CLIENT_UNAVAILABLE
```

## 背景

R1 已关闭，standards coverage 控制面修订已取得既有 `GO(0 M / 0 S / 3 N)`，但该 review 明确不能替代 fresh v2s-rooted R2 acceptance。

Dexter 已在本次 fresh `catering-v2s` 根会话明确授权 R2 静态入口验收、goal、target-native evidence、Codex 自审与 review handoff。授权不包含 R3/W1、业务 runtime、DEV、seed/reset、数据库或 Git 写操作。

本轮 Codex 从当前仓根重新走完整入口、六维 memory 路由、source reopen、standards clean/red、Roadmap owner、transfer/Heritage 与授权边界核验，形成结构化 evidence 与独立自审。Roadmap 仍为 `R2 / IN_REVIEW`；`V2S_FOUNDATION_READY` 尚未写入。

## 评审目标

请 Dexter 与 Claude 独立确认：

1. evidence 是否真实证明本会话从 `catering-v2s` 根发现项目身份，而非跨仓 `cd`、all-v2 current state 或聊天摘要续跑；
2. SessionStart、Prompt、recall、Stop 与 memory/source reopen receipt 是否足以证明确定性入口链真实工作；
3. standards source→memory→enforcement 的 150 项分母、clean/red controls 与 phase 语义是否新鲜且未被夸大；
4. service shape、consumer/admin、DEV/Heritage/Git 红线是否准确恢复；
5. Git HEAD 从 handoff 的 `5b083504…` 前移到 Dexter 提交 `331984e8…` 的解释是否可接受；
6. acceptance 是否应由 Dexter 关闭为 `V2S_FOUNDATION_READY`，同时保持 R3/W1 仍需专项设计、独立审查与精确授权。

## 需阅读文件

- `AGENTS.md`：项目入口、当前授权边界与全程红线；
- `CLAUDE.md`：独立评审纪律；
- `PLATFORM-BLUEPRINT.md`：服务形态与 target truth；
- `doc/platform/roadmap-program-registry.json`：唯一 program owner；
- `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`：R2 当前状态与验收条款；
- `doc/evidence/platform/2026-07-24-v2s-r2-fresh-session-acceptance.json`：本轮 acceptance 原始/结构化证据；
- `doc/review/platform/2026-07-24-v2s-r2-fresh-session-codex-self-review.md`：Codex 独立自审；
- `contracts/policy/standards-coverage-matrix.json`：150 项 standards denominator；
- `project-memory/index.md` 与 evidence 中列出的 7 份 memory 原文：确定性 recall 与 source reopen；
- `doc/evidence/platform/2026-07-24-v2s-roadmap-control-plane-transfer.json`：source/target transfer receipt；
- `doc/evidence/platform/2026-07-24-v2s-r1-implementation-closure.json`：R1 immutable implementation closure；
- `doc/evidence/platform/2026-07-24-v2s-r1-post-transfer-closure.json`：R1 immutable activation closure；
- `doc/heritage/registry.json`：Heritage read-only/fallback 边界。

## 独立核验重点

1. 从仓库根 fresh 复跑：

   ```bash
   scripts/context/agent-context health
   scripts/context/recall-memory \
     --task-kind review \
     --domain platform \
     --consumer-face backend \
     --owner platform \
     --impact governance \
     --trigger task-start
   scripts/check/standards-coverage --phase R2
   scripts/check/standards-coverage --self-test
   scripts/check/project-memory
   scripts/check/agent-lifecycle
   scripts/check/provider-free-context
   scripts/check/foundation-standard-actions
   scripts/check/roadmap-program-registry
   scripts/check/roadmap-control-plane-transfer
   scripts/check/roadmap-control-plane-transfer --self-test
   scripts/check/handoff-debt
   scripts/check/heritage-registry
   ```

2. 逐个重新打开 recall 返回的 7 份 memory 与全部 sourceRefs，确认 `project-memory/index.md` 只是导航。
3. 独立从冻结 manifest 重算 B=85、C=23、D=42、total=150，并全量核对 source text hash；不要采信 evidence 自报。
4. 确认 Prompt 没有注入 memory/code，Stop 只对 session marker 的 active goal、managed run/cleanup 及畸形输入 fail-closed。
5. 复算 request 中 evidence、自审、Roadmap、matrix 与 R1 immutable/transfer hashes。
6. 只读核对 Git：
   - `331984e8…` 的父提交是 `5b083504…`；
   - branch 与 origin/main 都是 `331984e8…`；
   - 该提交作者是 Dexter；
   - staged files=0，Codex 没有 Git 写入。
7. 确认没有 apps、migration、DEV、seed/reset、数据库或 Heritage write-back；active managed resources=0。
8. 当前工作区已有的 hook compatibility dirty review/evidence 不得被当作本次 fresh R2 discovery，也不得被本轮修改。
9. Claude fresh client 若仍不可用，保留 `UNVERIFIED_CLIENT_UNAVAILABLE`；不得用既有 Claude review 冒充 fresh client evidence。

## 期望结论

请给出明确 `GO` 或 `NO-GO`。findings 按 `M` / `S` / `N` 标注精确文件与行号、影响、最小修复及是否需要 Dexter 裁决。

只有 `GO(0 M / 0 S / N*)` 且 Dexter 最终接受，才允许另行把 R2 关闭为 `V2S_FOUNDATION_READY`。本 request、evidence、自审或 Claude GO 均不直接修改 Roadmap，也不自动授权 R3/W1。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请从 catering-v2s 仓库根独立复核本次 R2 fresh session 静态入口验收。

背景：R1 已关闭，standards coverage 控制面修订已有既有 GO，但它明确不能替代 fresh v2s-rooted acceptance。Dexter 已在本次新会话授权 Codex 执行 R2 静态入口验收、形成 target-native evidence、自审与 review handoff；当前 Roadmap 仍为 R2 IN_REVIEW，尚未写 V2S_FOUNDATION_READY。
目标：请独立确认本会话是否真正从 v2s 根恢复唯一 Roadmap owner、project-memory/source、服务形态、standards denominator、Heritage 与授权边界；同时核验 handoff HEAD 5b083504… 已被 Dexter 的 331984e8… 后继提交取代这一观测是否真实且不影响控制面 hash 连续性。

请从 catering-v2s 仓库根阅读：
- doc/evidence/platform/2026-07-24-v2s-r2-fresh-session-acceptance.json：本轮结构化 acceptance evidence；
- doc/review/platform/2026-07-24-v2s-r2-fresh-session-codex-self-review.md：Codex 独立自审；
- doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md 与 doc/platform/roadmap-program-registry.json：唯一状态与授权 owner；
- contracts/policy/standards-coverage-matrix.json、project-memory/index.md 及 evidence 列出的 memory/sourceRefs：standards 与确定性上下文；
- doc/evidence/platform/2026-07-24-v2s-roadmap-control-plane-transfer.json、doc/evidence/platform/2026-07-24-v2s-r1-implementation-closure.json、doc/evidence/platform/2026-07-24-v2s-r1-post-transfer-closure.json、doc/heritage/registry.json：transfer、immutable R1 与 Heritage 连续性。

请重点独立核验：fresh 复跑 request 列出的全部命令；逐个 reopen recall 返回的 memory/source；独立重算 B=85、C=23、D=42、total=150 与 150 条 source hash；复算 evidence、自审、Roadmap、matrix、transfer/R1 hashes；确认 Prompt 不注入、Stop red controls 真实；确认 Git 前移只来自 Dexter，staged=0；确认无 apps/migration/DEV/seed/reset/database/Heritage write-back，business=PASS、cleanup=PASS、active resources=0。若没有真正的 fresh Claude client，请继续诚实记录 UNVERIFIED_CLIENT_UNAVAILABLE，不要用既有 review 冒充。

烦请给出明确 GO 或 NO-GO。如有问题，请按 M / S / N 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。

授权边界：本次 GO 只表示 R2 fresh static acceptance evidence 达到 Dexter 可接受条件；只有 Dexter 最终接受后才可另行关闭 R2 为 V2S_FOUNDATION_READY。它不自动授权 R3/W1、业务代码、DEV、seed/reset、数据库、生产切流或任何 Codex Git 写操作。谢谢。
```
