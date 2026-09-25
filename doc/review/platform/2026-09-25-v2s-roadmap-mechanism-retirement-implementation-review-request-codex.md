# Roadmap 机制退役 IMPLEMENTATION Claude 评审请求

REVIEW_TARGET=IMPLEMENTATION
REVIEW_SCOPE=Roadmap 机制退役治理清理
INDEPENDENT_REVIEW=GO,M/S/N=0/0/2

## 背景

Dexter 于 2026-09-25 裁定退役并删除 Roadmap 机制，原因是它已经过时、会误导 agent，且其授权字段只是已结束批次的重复索引。本批已按新决定完成入口链、项目记忆、脚本控制面、skills 与 active policy 文案迁移；历史 review、plan、evidence 和带 R 编号的旧 decision 保持不改。fresh 独立 IMPLEMENTATION 复审第二轮已给出限定范围 `GO`，`M/S/N=0/0/2`。

## 评审目标

请只对当前代码与治理文件做独立 IMPLEMENTATION review，确认 Roadmap 控制面已真正退出当前入口，而不是以改名或措辞隐藏；确认新 Dexter 会话授权 kernel、required-inventory、generated project-memory index、hook、agent-context、prompt route、skills 与 active policy 的边界一致；确认删除清单不存在且历史保留边界没有被误删。

## 需阅读文件

- `doc/decisions/2026-09-25-v2s-roadmap-mechanism-retirement.md`：本批设计依据、替代口径、删除/保留清单；
- `AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md`、`HANDOFF.md`：会话入口与长期规则；
- `doc/platform/README.md`、`doc/platform/active-document-index.json`：平台入口和 active document 导航；
- `scripts/README.md`、`scripts/hooks/session-start`、`scripts/check/agent-lifecycle`、`scripts/hooks/prompt-route`、`scripts/list`：脚本入口、hook 输出与 retired checker 清单；
- `tools/agent-context/cli.mjs`：agent-context 与 working-set 输出；
- `.agents/skills/cs-managed-runtime-execution/SKILL.md`、`.agents/skills/cs-review/SKILL.md`、`.agents/skills/cs-spec-to-plan/SKILL.md`、`.agents/skills/cs-writing-plans/SKILL.md`：授权边界文字；
- `project-memory/kernel/01-workspace-and-authorization.md`、`project-memory/kernel/05-evidence-runtime-and-git.md`、`project-memory/kernel/06-heritage-and-change.md`、`project-memory/decisions/deterministic-context-only.md`、`project-memory/required-inventory.json`、`project-memory/index.md`、`project-memory/index.json`：memory source、assertion 与生成索引；
- `contracts/policy/affected-l2-registry.json`、`contracts/policy/r4-evidence.schema.json`、`contracts/policy/r4-gate-catalog.json`：active policy 与明确保留的历史字段；
- `doc/review/platform/2026-09-25-v2s-roadmap-mechanism-retirement-independent-implementation-review-codex.md`：fresh 独立复审与处置记录。

## 独立核验重点

1. 删除清单中的文件与目录确实不存在：registry、`doc/roadmaps`、registry 工具、两个 retired checker、旧 workspace kernel 与 transfer memory；
2. `session-start` 与 `agent-lifecycle` 的输出完全一致，`agent-context` 不列 registry，`prompt-route` 不再用 Roadmap/路线图触发 memory，skills 不再要求 current Roadmap authorization；
3. `kernel.workspace-authorization`、`required-inventory`、generated index 与六维 memory query 一致，旧 `PROGRAM_SCOPED_CURRENT_ONLY`、`R1_ONLY`、`NO_R2_W1`、transfer entry 不在 active memory；
4. 受限 `rg` 只剩新决定及文件名引用、被取代决定的文件名引用、`scripts/test/standards-enforcement-verify.test.mjs` 的退役标签、`tools/platform-boundary-gates/cli.mjs` 与两个 r4 policy 的冻结 `roadmapStep` 字段；
5. `contracts/policy/affected-l2-registry.json:240` 的授权边界不再引用退役机制；
6. 本批不包含运行期行为，不能要求 Web、Android、VM、DEV、L2、seed、reset 或 UAT 动态证据。现有 `scripts/verify` 的 unrelated frontend-format 首败与两个 capability-invariants checker note 只能作为独立既有问题记录，不能被改写为本批通过或本批缺陷。

## 当前静态结果

- `scripts/memory/build-index`：PASS，`ENTRIES=83 KERNEL=6 ROUTED=77`；
- `scripts/memory/build-index --check`：PASS；
- `scripts/check/project-memory`：PASS；
- `scripts/check/agent-lifecycle`：PASS；
- `scripts/verify`：FAIL，首败 `R5_VERIFY_STATIC_FIRST_FAILURE:frontend-format`，命中四个无关 store-terminal 文件；本批未修改这些文件；
- fresh 独立 IMPLEMENTATION 复审：`GO`，`M/S/N=0/0/2`。

## 期望结论

请给出明确的 `GO` 或 `NO-GO`，并使用 `M` / `S` / `N` 逐条列出精确路径与行号、影响面、最小修复建议，以及是否需要 Dexter 产品或范围裁决。若认为既有 `scripts/verify` 或 capability-invariants 失败阻断本批，请说明其与 Roadmap 退役字节的直接因果证据。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助对 TER/v2s「Roadmap 机制退役」治理清理做一次 REVIEW_TARGET=IMPLEMENTATION 静态代码与控制面复核。

背景：Dexter 已裁定退役并删除 Roadmap 机制，当前任务与授权只来自 Dexter 会话中的明确指派；本批已完成删除 registry/roadmaps/transfer 控制面、改写入口链与 memory kernel、同步 required-inventory/index、更新 hook/agent-context/prompt-route/skills，并清理 active policy 中对退役机制的残留文案。fresh 独立子 agent 复审结果为 GO，M/S/N=0/0/2。历史 review、plan、evidence 与带 R 编号的旧 decision 按新决定保持不改。

目标：请只看当前代码与治理文件，独立确认 Roadmap 不再是任何当前入口、授权或状态源；新 Dexter 会话授权 kernel 与 project-memory 生成索引一致；删除清单、active policy、hook、agent-context、prompt route、skills 与历史保留边界均正确。

请从 catering-v2s 仓库根阅读：
- doc/decisions/2026-09-25-v2s-roadmap-mechanism-retirement.md：本批设计依据与删除/保留清单；
- AGENTS.md、CLAUDE.md、PLATFORM-BLUEPRINT.md、HANDOFF.md：入口链与长期规则；
- doc/platform/README.md、doc/platform/active-document-index.json：平台入口；
- scripts/README.md、scripts/hooks/session-start、scripts/check/agent-lifecycle、scripts/hooks/prompt-route、scripts/list、tools/agent-context/cli.mjs：静态检查与上下文输出；
- .agents/skills/cs-managed-runtime-execution/SKILL.md、cs-review/SKILL.md、cs-spec-to-plan/SKILL.md、cs-writing-plans/SKILL.md：授权边界；
- project-memory/kernel/01-workspace-and-authorization.md、project-memory/kernel/05-evidence-runtime-and-git.md、project-memory/kernel/06-heritage-and-change.md、project-memory/decisions/deterministic-context-only.md、project-memory/required-inventory.json、project-memory/index.md、project-memory/index.json：memory 路由与 source/assertion；
- contracts/policy/affected-l2-registry.json、contracts/policy/r4-evidence.schema.json、contracts/policy/r4-gate-catalog.json：active policy 与保留的历史字段；
- doc/review/platform/2026-09-25-v2s-roadmap-mechanism-retirement-independent-implementation-review-codex.md：独立复审与处置。

请重点核验：删除文件/目录是否确实不存在；session-start 与 agent-lifecycle 输出是否一致；agent-context 是否移除 registry；六维 query 是否返回新 kernel 且不返回旧授权 assertions；受限 rg 是否只剩新决定/文件名引用、退役标签与冻结 roadmapStep 字段；active policy 是否不再引用退役机制；以及本批是否误改历史材料。

当前静态结果：build-index、build-index --check、project-memory、agent-lifecycle 均 PASS；scripts/verify 首败为四个无关 store-terminal 文件的 frontend-format，不属于本批字节；本批不授权也不需要 Web、Android、VM、DEV、L2、seed、reset、UAT 或真机动态验证。

烦请给出明确 GO 或 NO-GO；如有问题，请按 M/S/N 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 裁决。

授权边界：本次评审只覆盖 Roadmap 机制退役的治理、脚本、memory、入口与 active policy 字节；不授权修复无关 frontend-format/capability-invariants 问题，不授权业务代码、运行期行为、依赖、构建、动态环境或数据操作。谢谢。
```
