# catering-v2s R2 standards coverage 控制面修订复核请求

```text
REVIEW_STATUS=READY
REVIEW_KIND=R2_CONTROL_PLANE_AMENDMENT
PROGRAM_ID=V2S_W0_W4_EXECUTION
CURRENT_STEP=R2
CURRENT_STATUS=IN_REVIEW
MANIFEST_SHA256=84037f1c81ae17ce51ee488723f5e230b4fe3f76c16e690c58c96606793e6c69
STANDARDS_MATRIX_SHA256=358dc6bea08b6094ce7bf633bf68ffcbb4dab777c895f87627b7b5d9b4a18ce9
STANDARDS_CHECKER_SHA256=683c696bd042e4ca865e859e82a42bace74f4bbccd499e38d42921b2c8606238
REVIEW_RESOLUTION_SHA256=ddcadc5f8c85d04de7b10cb2dfbcdd1a55d07efe7aac8790b79eec81c5d6c7ee
ROADMAP_SHA256=a36fc88b0c151fdae719365b11925941a20e7de771b970f8e6eb11b03ac50392
PROJECT_MEMORY_INVENTORY_SHA256=691762577b832efb329e0cfd2f49a0bc67cd4bb9712ab5e3ff5634748815e51f
ACTIVE_DOCUMENT_INDEX_SHA256=97dc4965f131f31a3cb40839ce96da2bb9ef4899c80a2b0c48b11e8d4dd6ecf3
SOURCE_CLAUDE_REVIEW_SHA256=2b9910ce287a25a8dc9066150a9722d54955f918ec353d22d1491fef8657abd0
```

## 背景

R1 已关闭。Claude 随后给出执行框架复审 `GO(0M / 1S / 2N)`：唯一 S 是 manifest Part B-D 缺少规范→memory→执法的可判定 coverage；两条 N 是 Claude 入口无显式接线处置、post-transfer closure 缺 findings resolution 导航。Dexter 仅授权完成这一份 R2 控制面修订包，要求完成后保持 R2 `IN_REVIEW`，不进入 fresh R2 acceptance、R3/W1、DEV、数据库或 Git。

原 Claude review 在 transfer 后写入 all-v2。v2s 不回写或删除 source，而以 path/hash-bound review 输入建立 target-native resolution；后续 review material 只写 v2s。

## 评审目标

请从 fresh v2s-rooted 会话独立判断：

1. standards matrix 是否把冻结 manifest Part B-D 的结构分母、memory acquisition 与机器/人工执法焊成真实可失败闭环；
2. checker 是否会拒绝 denominator 漂移、漏 memory、逾期 PLANNED、坏 active ref 与缺 review checklist，而不是只验证 JSON 形状；
3. Claude 入口 `INTENTIONAL` 与 immutable R1 findings 导航是否关闭两条 N，且没有制造第二 hook 真相或篡改历史 evidence；
4. Roadmap/Registry/AGENTS/memory 是否仍诚实停在 R2 `IN_REVIEW`，没有获得 W1/runtime/Git 权限。

## 需阅读文件

- `AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md`
- `doc/platform/roadmap-program-registry.json`
- `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`
- `doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md`
- `contracts/policy/standards-coverage-matrix.json`
- `scripts/check/standards-coverage`
- `project-memory/required-inventory.json`
- `project-memory/decisions/deterministic-context-only.md`
- `project-memory/index.md`
- `doc/review/platform/2026-07-24-v2s-r1-execution-framework-review-resolution.md`
- `doc/evidence/platform/2026-07-24-v2s-r1-implementation-closure.json`
- `doc/evidence/platform/2026-07-24-v2s-r1-post-transfer-closure.json`
- `scripts/README.md`

## 独立核验重点

1. Fresh 运行：

   ```bash
   scripts/check/standards-coverage --phase R2
   scripts/check/standards-coverage --self-test
   scripts/check/project-memory
   scripts/check/agent-lifecycle
   scripts/check/provider-free-context
   scripts/check/foundation-standard-actions
   scripts/check/roadmap-program-registry
   scripts/check/roadmap-control-plane-transfer
   scripts/check/handoff-debt
   scripts/check/heritage-registry
   ```

2. 独立从 manifest 计算 denominator：B numbered=85、C table rows=23、D bullets=30、D table rows=12、total=150；随机抽查 source text hash，不信任矩阵自报。
3. 核验 150 项均绑定 active memory 原文，且 `project-memory/index.md` 只是生成导航；matrix 不复制规则正文，agent 仍需 source reopen。
4. 核验分布：66 ACTIVE、84 PLANNED；机器执法类型为 78 GATE、12 ARCHUNIT、1 NEGATIVE_FIXTURE，另有 59 `UNENFORCEABLE_BY_MACHINE`。重点判断分类是否过度声称、是否把可机器判定项不当降为人审。
5. 将一项 rule 删除、memoryRefs 清空、ACTIVE ref 改成不存在、reviewChecklistRef 删除，并用 `--phase R4` 模拟到期，确认五类 red control 真红。
6. 核验 R3/R4 phase 语义：R2 可保留未到期 PLANNED；到期仍为 PLANNED 必须 FAIL，R4 closure 要求所有 `enforcementPhase<=R4` 清零。
7. 核验 `CLAUDE_ENTRY_INTENTIONAL`：没有 `.claude/settings.json`，但 CLAUDE.md 和 review checklist 明确要求人为 fresh-session readback；不得把约定冒充 hook。
8. 核验 N-2 未直接改写 immutable post-transfer closure；resolution 精确指向 implementation closure `/defectRetrospective`，原 R1 hashes 保持：

   ```text
   implementationClosure=e1bcbf43c8c6a0b475e14169ebc0e0dcc1248e54bbefc8097a384ed1ae1add91
   postTransferClosure=8093559204490c147aa9cf8ff0828c9441428f85b53b8ca0dafe03e86f4d5b21
   ```

9. `r1-closure --final` 的 exact path allowlist 是 immutable R1 baseline oracle；R2 已增加新路径后不应被当成 current-phase aggregate。请改为核验上述 R1 immutable hashes、transfer checker 与 R2 自己的 denominator，避免把合法 phase progression 误报为 R1 evidence 失效。
10. 核验 all-v2 source review hash 未变化，v2s Registry 仍唯一解析 R2；没有 apps、migration、DEV、seed/reset、数据库、branch/worktree/stage/commit/push。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，findings 按 `M` / `S` / `N` 标注精确文件/字段、影响、最小修复和是否需要 Dexter 裁决。只有 `GO(0 M / 0 S / N*)` 才表示该控制面修订达到 Dexter 可接受条件。

该 GO 仍不自动关闭 R2，不授予 fresh R2 write、R3/W1、业务代码、DEV、seed/reset、数据库、生产切流或 Git 写操作；后续状态推进仍由 Dexter 决定。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请从 catering-v2s 仓库根以 fresh 会话独立复核 R2 standards coverage 控制面修订。

背景：R1 已关闭。您上一轮执行框架复审给出 GO(0M / 1S / 2N)，唯一 S 是 manifest Part B-D 缺少规范→memory→执法 coverage；两条 N 是 Claude 入口处置未显式登记，以及 immutable post-transfer closure 不易到达 implementation closure 的 defectRetrospective。Dexter 仅授权修订这一控制面包，当前仍是 R2 IN_REVIEW。

目标：请验证 150 项冻结结构分母是否逐项具有 source hash、active memory anchor、真实机器执法或明确 UNENFORCEABLE_BY_MACHINE review checklist；checker 的五类 red control 与 phase 到期判断是否真能失败；Claude 入口 INTENTIONAL 与 target-native resolution 是否关闭两条 N，同时不破坏 R1 immutable hash 链。

请从仓库根阅读：
- AGENTS.md、CLAUDE.md、PLATFORM-BLUEPRINT.md；
- doc/platform/roadmap-program-registry.json；
- doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md；
- doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md；
- contracts/policy/standards-coverage-matrix.json；
- scripts/check/standards-coverage；
- project-memory/required-inventory.json、project-memory/decisions/deterministic-context-only.md、project-memory/index.md；
- doc/review/platform/2026-07-24-v2s-r1-execution-framework-review-resolution.md；
- doc/evidence/platform/2026-07-24-v2s-r1-implementation-closure.json；
- doc/evidence/platform/2026-07-24-v2s-r1-post-transfer-closure.json；
- scripts/README.md。

请按 review request 中的命令 fresh 复跑，并独立计算 B=85、C=23、D=42、total=150；抽查 source text hash、66 ACTIVE/84 PLANNED 分类、59 项人工 checklist、R3/R4 到期语义，以及缺规则/缺 memory/逾期 PLANNED/坏 active ref/缺 checklist 五类真红。也请确认没有修改 immutable R1 closure，没有写回 all-v2，没有获得 W1/runtime/Git 权限。

烦请给出明确 GO 或 NO-GO；findings 请按 M / S / N 标注精确位置、影响、最小修复及是否需要 Dexter 裁决。

授权边界：本次结论只复核 R2 控制面修订是否达到 Dexter 可接受条件；即使 GO，也不自动关闭 R2，不授权 fresh R2 write、R3/W1、业务代码、DEV、seed/reset、数据库、生产切流或任何 Git 写操作。谢谢。
```
