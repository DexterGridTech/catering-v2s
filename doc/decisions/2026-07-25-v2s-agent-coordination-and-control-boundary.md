---
title: catering-v2s AI 协作与控制边界
status: ACCEPTED
createdAt: 2026-07-25
acceptedBy: Dexter
scope: all-codex-and-claude-agents
---
# catering-v2s AI 协作与控制边界

## 规范性原文

> 项目只有codex和Claude两个AI在Dexter的分工下协调，git的所有操作权都在Dexter身上，codex和Claude都不得在任何节点要求Dexter必须执行git动作，Dexter想不想git、想什么时候做都不影响任何设计和开发工作，后面codex和Claude都不得再提git的事情

## 强制执行

1. `AGENTS.md` 是 Codex 与仓内 agent 的入口，`CLAUDE.md` 是 Claude 的入口；两者必须执行本决定。
2. Dexter 对仓库控制动作拥有全部决定权，但该决定权不是任何设计、实现、测试、评审、证据或收口步骤的前置条件。
3. Codex 与 Claude 不得要求、提醒、催促、等待、索取或暗示 Dexter 需要执行任何仓库控制动作；不得以此阻断、暂停、降级或延后工作。
4. 设计、实现、测试、评审、动态验证与 closure 只依据 Dexter 当次会话中的明确指派、已接受范围、原始材料、源码和证据继续推进；不得把仓内历史状态或外部控制动作当作工作完成条件。
5. Dexter 可以按自己的意愿和时间处理仓库控制动作；无论其是否处理、何时处理，都不改变 Codex/Claude 的设计与开发路径。
6. 旧文档中要求等待不可变 checkpoint、索取提交标识或把仓库控制动作列为下一步的文字，自本决定起均不再作为 agent 行为依据；当前任务文档应按 Dexter 的明确指派与适用决定执行，历史材料保留其原始记录性质。

## 文档作者边界（Dexter 2026-09-25 裁定）

实施期间 Codex 可以直接修改 Claude 撰写的需求正本。每次修改在该需求的审查与变更记录节（§15）追加一条，写明日期、触发原因（评审 finding 或 Dexter 裁定）与改动位置；§12 中 Dexter 的裁决原话不得改写，新的裁决只追加新的 D 编号。
