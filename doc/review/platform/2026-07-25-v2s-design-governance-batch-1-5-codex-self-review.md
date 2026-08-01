---
title: v2s 设计法治 Batch 1.5 Codex 对抗式自审
status: FROZEN_FOR_CLAUDE_REVIEW
reviewTarget: doc/decisions/2026-07-25-v2s-design-governance-batch-1-5.md
createdAt: 2026-07-25
---

# 设计法治 Batch 1.5 Codex 对抗式自审

REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=DESIGN-GOVERNANCE-BATCH-1-5
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2

## 用户任务

未来业务用户需要看到合理、可解释、可追溯的后台交互；需要在看图前能回到可靠
历史依据，却不希望旧仓文档或第三方 skill 重新取得当前决策权。本批因此只补“引用如何
核验”和“如何看图/使用方法”的缺口，不设计任何实际用户任务。

## Dexter 立场

Dexter 已授权本批随第一批一并送 Claude，但明确不启动 R3–R6 inventory、不恢复 J02，
也不授权 implementation、contract、数据库、DEV、动态运行、seed/reset 或 Git。因此
本批必须停在来源冻结、适配壳和人审字段，不能借高保真 demo 或 vendor skill 推进业务。

## 替代方案

1. 仅在模板写“参考 all-v2”：无法定位版本，也无法发现来源漂移，取舍后不选。
2. 将 B.4/B.5 和 skill 使用写成关键词 checker：不能证明业务理解，且会复制作者盲区，
   违反验证治理；不采用。
3. 建高保真应用原型或把旧壳 import 到 v2s：看似快，但会绕过 Journey 和 owner 设计，
   引入 runtime 依赖；不采用。

## 方案合理性

采用的最小方案是十个字节冻结来源、表格化人审映射、三个本仓优先的适配壳和可选静态
HTML 规则。问题是出处、阶段和看图不能独立核验；方案复杂度限于小批文档与三份 source
copy，代价低于后续按错误前提出 UI 的返工，收益是审阅能检验出处、阶段和看图内容。

## UI 与交互

NOT_APPLICABLE：理由是本批没有用户页面、真实 Journey 或业务操作；它只规定未来
UI-bearing Journey 的工件必须怎样看图和回指。高保真静态 demo 也是模板规则，不能以
它替代批准 Journey、用户路径或实现授权。

## 审查意见复核

CONFIRMED：Claude 的 N-1 是纯呈现错误；补齐一个表格列即可，未扩张工作。

CONFIRMED：重开 Claude review、registry source/target 和十份 Heritage 原文后，B.4/B.5
的内容会受 all-v2 后续漂移影响，故直接链接不足。registry 的
path/hash/字节一致性可检测漂移，而交互模板只要求“命中/不适用理由”，不假装机器理解
条文。反例是无 UI Journey；它不需交互模板或 B.4/B.5 映射，应在 Journey 中明确 UI
不适用理由。更小修复是只列路径，但不能复核版本，故不采用。

PARTIALLY_CONFIRMED：第三方 skill 的“设计先行、计划细化、根因优先”方法有价值，但
其 Git、自动推进、worktree、自动分派与默认路径同本仓授权边界冲突。因此只保留可审计
vendor 原文和本仓适配壳；冻结 source hash 不等于接受原文全部指令。适用边界是已授权
的对应阶段；更小替代为只写一条提醒，但无法留下可复核 hash 和阶段约束。

CONFIRMED：高保真画面能帮助 Dexter 判断新交互与用户语言，但不能成为实现或需求来源。
默认线框、按需升级、假数据出处、水印和零引用规则保留了其沟通价值并限制误导。

## 闭环核验

- 重新运行 Heritage registry 正常校验和 self-test，23 件分母、hash 与 byte equality 均通过；
- standards coverage R3 仍为 PASS，B.4/B.5 和 adapter 使用只加入人审文字，不新增语义门；
- 三个 vendor 原文 hash 已与 manifest、适配壳的 SKILL_USED 回写逐项对读；
- 未创建 mockup、app、contract、migration、数据库或动态环境产物，未执行 Git。

## 结论

VERDICT=GO
M=0
S=0
N=0
NEXT=冻结 Batch 1.5 并送 Claude 独立复核；在 Dexter 接受前，不启动 R3–R6 inventory、不恢复 J02，亦不做实现。
