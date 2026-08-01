---
title: R3–R6 Journey inventory Batch 2 计划 Claude finding 辩证处置
status: SELF_DECIDED_GO_FOR_INVENTORY_DRAFTING
reviewTarget: doc/plans/platform/2026-07-25-v2s-r3-r6-journey-inventory-batch-2-plan.md
createdAt: 2026-07-25
---

# R3–R6 Journey inventory Batch 2 计划 Claude finding 辩证处置

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=R3-R6-JOURNEY-INVENTORY-BATCH-2
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
```

## 用户任务

业务用户 Dexter 需要一份不遗漏 R3 技术底座、但也不会把技术底座伪装成产品 Journey 的
排序输入；同时需要前次 Claude review 的出处不确定性被诚实保留，而不是由 Codex 追认。

## Dexter 立场

Dexter 已裁 C-01 的两个前提为部署期外部受控，并从 R3 删除 C-02 的运营用户真实登录。
当前仍只授权 inventory，不授权 UI、implementation-facing design、contract、数据库、
app、DEV、runtime、seed/reset 或 Git。

## 替代方案

1. 忽略 R3-TECH：文件更短，但会误导排序者，以为 R3 只剩 C-01/C-02，不选。
2. 将 R3-TECH 编造成管理员用户 Journey：可填模板但无真实用户任务，属于伪 Journey，
   不选。
3. 猜测旧 Claude review 的会话来源并补 frontmatter：看似闭环但伪造 provenance，不选。
4. 增一行技术 disposition、为新卡片补 skill 回执，并保留 N-2 的未验证出处：推荐。

## 方案合理性

N-1 的问题是总表覆盖不完整，最小修复是一行 `R3-TECH`；N-3 是 Batch 1.5 已定义的回执
遗漏，最小修复是在计划和两张卡片回写完整冻结 hash。N-2 的内容结论已有当前 Claude 的
独立复核，问题仅为初始会话 provenance；它不改变业务判断、又无法由仓内资料证实，故以
`UNVERIFIED_REQUIRES_DEXTER_CONFIRMATION` 保留，既不阻断 inventory，又不虚构出处。三项
修复没有新 checker、依赖、UI 或实现成本。

## UI 与交互

`NOT_APPLICABLE`：理由是本轮只处置计划 review finding 并建立 inventory 文档；C-01 虽为
UI-bearing 候选，但未获新的 UI 设计授权，未创建任何线框、登录页或 Drawer。C-02 已从
R3 登录范围删除。

## 审查意见复核

- **N-1=CONFIRMED**：重开 R3 Roadmap 的 GATE_0、代理、五命令和双 app 条目后，R3 技术
  工作确实未在原总表列出。反例是把它们当作 Journey；没有业务 actor/成功结果，不适用。
  最小修复为 `R3-TECH / NOT_A_BUSINESS_JOURNEY / SUBSTRATE_FOR_SELECTED_JOURNEY` 一行。
- **N-2=UNVERIFIED_REQUIRES_DEXTER_CONFIRMATION**：重开该 review 文件只能确认其内容和
  `reviewer: Claude`，无法确认最初会话 origin。反例是从文件日期、文字或聊天摘要推断会话，
  均不构成证据。最小处理是登记缺口并等待 Dexter；不改写历史字段。
- **N-3=CONFIRMED**：重开 Batch 1.5 §4 和 `cs-brainstorming` 壳，Journey 裁决前必须回写
  完整 hash。最小修复为计划 §5/§6 与 C-01/C-02 头部；反例是只在总表写 skill 名，不能证明
  单卡遵循阶段边界。

三项处置均比较过更小替代：N-1 不新建技术卡片或 checker，只加总表一行；N-2 不猜测
会话 origin 或重写旧文件，只保留出处缺口；N-3 不新增 gate，只补既有适配壳要求的回执。
因此没有因审查增加实现范围、语义门或无关成本。

## 闭环核验

计划已加入 R3-TECH、skill 回执和 N-2 provenance 台账；C-01/C-02 卡片使用本仓
`cs-brainstorming` 完整 hash，C-02 的 R3 scope rejection 已同步 Roadmap 的 R3 目标、交付物
和验收文字。旧 J02 不改写，且没有 UI、contract、DB、app/DEV/runtime 资产。

## 结论

```text
VERDICT=GO
M=0
S=0
N=1 (N-2: UNVERIFIED_REQUIRES_DEXTER_CONFIRMATION; non-blocking provenance record)
ROUND_FINAL_DECISION=SELF_DECIDED
NEXT=对实际 C-01/C-02/R3-TECH inventory 发起 Claude 独立 review；不得进入 UI 或 implementation。
```
