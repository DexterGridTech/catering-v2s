---
title: v2s Roadmap 机制退役与 Dexter 会话授权决定
status: ACCEPTED
createdAt: 2026-09-25
decisionOwner: Dexter
supersedes: doc/decisions/2026-07-25-v2s-roadmap-r-unit-atomic-delivery-rule.md
---

# v2s Roadmap 机制退役与 Dexter 会话授权决定

## Dexter 裁定

Dexter 于 2026-09-25 明确裁定：

> 我现在想退役删除Roadmap的这个机制，已经过时没有用了，而且每次agent都可能被他误导。

本决定是本批治理清理的设计依据。它取代仓内以 Roadmap、program registry 或 transfer 工具作为当前任务
与授权来源的做法；历史 review、plan、evidence 和已完成批次的 decision 保持历史真实性，不因本决定改写。

## 退役原因

1. Roadmap 自 2026-08-19 起只剩 R* 授权字段与 V2S 就绪标志；相关批次均已结束，且每项授权在
   `doc/decisions/` 下已有决定文件，Roadmap 只是会过期的重复索引。
2. 它已经产生相互矛盾的状态：历史 Roadmap 同时出现 `R3_IMPLEMENTATION_AUTHORIZED=false` 与
   `R3_IMPLEMENTATION_AUTHORIZED=true`；旧 project-memory kernel 还要求消费过期的 `CURRENT_*` 和禁止项。
3. 当前 runner 与运行期代码不读取这些授权字段，依赖只存在于会话控制面、检查脚本、启动 hook、agent-context
   与少数 project-memory sourceRefs。删除控制面比继续维护一份重复状态更安全。

## 替代口径

- 当前任务与授权只来自 Dexter 在会话中的明确指派。跨会话的批次，必须把授权原文写进该批次需求、详设或
  实施计划的授权段；仓内不再新建 Roadmap、registry、授权登记表或等价 current-state registry。
- L2、reset、seed、UAT、设备数据清除以及其他昂贵或破坏性动作，仍须 Dexter 逐项明确授权；本决定不构成
  任何动态环境或数据操作授权。
- 保留批次原子交付原则：Dexter 指派的每个交付批次一次性完成设计、一次性完成实施、一次性完成全范围复核；
  不得按 Journey、模块、文件、App 或单项 gate 拆成独立 review。单项 gate 只是批次内部的验证组成部分。
- 入口文件只写长期有效的规则、边界与命令，不写会过期的进度状态、当前 owner、授权计数或场景条数。
- Git 仍由 Dexter 自主控制；Codex 与 Claude 不得要求或等待任何 Git 控制动作。

## 删除清单

以下控制面资产从当前仓删除：

- `doc/platform/roadmap-program-registry.json`；
- `doc/roadmaps/platform/` 下的四个历史 Roadmap 文件；
- `tools/roadmap-registry/` 整个目录；
- `scripts/check/roadmap-program-registry`；
- `scripts/check/roadmap-control-plane-transfer`；
- `scripts/list` 中对应的两个命令条目；
- `project-memory/operations/roadmap-control-transfer.md` 及其 `required-inventory.json` 条目；
- 入口链、agent-context、project-memory 与 skill 中把 Roadmap 当作当前授权/状态源的文字。

删除不包含历史 review、plan、evidence，也不包含 `doc/decisions/` 中带 R 编号的既有授权决定文件。

## 保留清单

- `doc/review/`、`doc/plans/`、`doc/evidence/` 中的历史材料保持原样；其中指向已删除路径的引用是历史事实，
  不再作为当前入口。
- `doc/decisions/` 中带 R 编号的历史授权决定保持原样；它们只说明历史裁定，不恢复 Roadmap 控制面。
- `scripts/test/standards-enforcement-verify.test.mjs` 中的退役标签 `roadmap-program-registry` 保留，防止控制面
  被重新接回。
- `tools/platform-boundary-gates/cli.mjs` 的 `roadmapStep` 冻结证据字段，以及 `contracts/policy` 下两个 r4
  文件的 `roadmapStep` 字段保留；它们是历史证据字段，不是当前授权来源。
- `contracts/policy/frontend-asset-carryover-manifest.json` 第 4 行的 `programId: "V2S_W0_W4_EXECUTION"`，以及
  `tools/platform-boundary-gates/cli.mjs` 第 14 行同名的冻结证据期望对象保留；它们是冻结证据兼容字段，不是当前授权或状态来源。
- 批次原子交付原则保留，但其正本改由本决定与当前批次授权段共同表达。原决定
  `doc/decisions/2026-07-25-v2s-roadmap-r-unit-atomic-delivery-rule.md` 在文件开头标记为已由本决定取代，
  不删除历史正文。

## 迁移与验证要求

- `project-memory` 的 kernel、routed memory、`required-inventory.json` 与生成的 `index.json`/`index.md` 必须
  同步；`project-memory/operations/roadmap-control-transfer.md` 的 memory 条目删除，kernel 01 改成工作区与授权。
- `scripts/memory/build-index --check` 与 `scripts/check/project-memory` 是同步门；任何缺失 owning source 或 stale
  generated index 都必须失败。
- 会话启动 hook 与 `scripts/check/agent-lifecycle` 必须输出同一组不含 registry 的入口；agent-context 不得列出
  registry；prompt-route 不再把 Roadmap/路线图作为记忆路由触发词。
- 本批只验证治理静态门；不启动 DEV、L2、seed、reset、UAT、Web、Android、虚拟机或真机。
