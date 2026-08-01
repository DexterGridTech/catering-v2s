---
title: R3–R6 Journey inventory Codex 对抗自审
status: SELF_REVIEW_ROUND_1
reviewTarget: doc/decisions/2026-07-25-v2s-r3-r6-journey-inventory.md
createdAt: 2026-07-25
---

# R3–R6 Journey inventory Codex 对抗自审

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=R3-R6-JOURNEY-INVENTORY-DELIVERY
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
```

## 用户任务

本轮业务用户是 Dexter：其用户任务是获得可据以选择后续产品 Journey 的 inventory，而不是
看见一个由技术底座、默认账号或旧设计拼出的“看似能走通”的 R3。成功结果是 C-01 的外部
前提被明确、C-02 的错误验收被删除、R3-TECH/R4/R6 不被伪装为业务 Journey、R5 不被空白
模板抢先定义。

## Dexter 立场

Dexter 已裁定 C-01 的平台身份和既有集团空间均为部署期外部受控前提，并裁定 R3 不要求
运营用户真实登录；但当前仍只授权 Journey inventory。Dexter 没有授权 C-01 交互设计、
implementation-facing design、contract、数据库、app、DEV、runtime、seed/reset 或 Git。

## 替代方案

1. 将 C-01 标为已实施/已接受并马上画平台登录和初始化页面：能更快产生图，但越过当前
   inventory 授权，也会把外部前提误写成现有运行事实，不选。
2. 继续沿用旧 J02：文本更少，却保留 operations 登录矛盾和旧设计资产依赖，不选。
3. 只在 Roadmap 写一句“删 operations 登录”：成本最低，但 C-01 前提、R3-TECH 与未来
   R5 边界会不可追溯，不选。
4. C-01 `PROPOSED` 卡片、C-02 `DEXTER_REJECTED` 卡片、一页总表和 Roadmap 文字同步：推荐。

## 方案合理性

| 发起的攻击 | 复核事实、反例与边界 | 结果 |
| --- | --- | --- |
| C-01 是否把“部署期外部受控”偷换为可用运行时账号/空间？ | 卡片明确没有 session、credential/provisioning 实现；反例是 root/默认空间/seed，均列为伪修复 | `CONFIRMED`：只把前提来源裁决入库 |
| C-01 是否复活 J02？ | 新卡 `PROPOSED`、新 Journey ID 与新前提链；旧 J02 只作为禁用历史输入 | `CONFIRMED`：不复活、不复用旧 handoff |
| 删除 C-02 是否误删双 app 架构？ | Roadmap 与 C-02 均保留 platform-admin/operations-admin 独立 app；反例是 app 200 或 session 壳被称为业务登录 | `CONFIRMED`：只删除真实运营用户登录验收 |
| R3-TECH 是否应成为 Journey？ | GATE_0、代理、Flyway、五命令没有业务 actor 或用户成功结果 | `CONFIRMED`：维持 `NOT_A_BUSINESS_JOURNEY` |
| R5-SCOPE 是否应先填一个模板？ | 没有 actor、任务、owner 数据或批准范围；反例是按 heritage/语料索引猜模块 | `CONFIRMED`：只作占位 |
| 旧 Claude review 出处不明是否应阻断全部内容？ | 本轮 Claude 已独立亲验关键推导；最初会话 origin 无证据 | `PARTIALLY_CONFIRMED`：内容可作经复核问题输入，origin 保持 `UNVERIFIED_REQUIRES_DEXTER_CONFIRMATION` |

该方案的收益是把真实产品裁决与技术底座分开，代价仅为两张卡片、一页总表和一次 review；
比新增登录流、平台 IAM 治理或语义 checker 更小，且不会把 R3 扩成 R5 量级。

## UI 与交互

`NOT_APPLICABLE`：理由是本交付物是 inventory，不交付用户 route、线框、mockup 或操作设计。
C-01 的 `UI_BEARING=true` 只表示将来若获明确 UI 设计授权必须走 interaction artifact；C-02
在 R3 已被拒绝，不能因它是 UI-bearing 就补画 operations 登录页。

## 审查意见复核

- **计划评审 N-1=CONFIRMED**：重开 R3 Roadmap，GATE_0、代理、Flyway、五命令和双 app
  均是尚未完成的 R3 技术工作。以总表 `R3-TECH` 一行处理，比为每项建伪 Journey 更小。
- **计划评审 N-2=UNVERIFIED_REQUIRES_DEXTER_CONFIRMATION**：重开 scope-gap review 可验证文本
  内容，不能验证历史会话 origin。保留 inventory §4 登记；不猜测、不改旧 frontmatter，是
  比重写来源更小也更诚实的处理。
- **计划评审 N-3=CONFIRMED**：重开 Batch 1.5 与本仓 `cs-brainstorming`，两张卡均回写完整
  `SKILL_USED` hash。未新增 checker，避免把阶段适配壳变成语义 gate。

没有收到本 inventory 的其他 reviewer finding。所有处置均重开 owning source、比较反例和
更小替代；无一项扩大到 UI、contract 或 implementation。

## 闭环核验

- C-01 四项前提均有来源类型，且明确外部受控前提不等于现有 runtime；
- C-02 明确 `DEXTER_REJECTED`，Roadmap R3 的目标、交付物和验收文字已同步删除运营用户
  真实登录主张；
- R3-TECH、R4、R6 均可见且是非 Journey，R5-SCOPE 没有虚构 actor；
- 两张卡都含 `cs-brainstorming` 冻结 hash；N-2 仍是可见、非阻断的 provenance 待确认项；
- 无旧 J02 修改、无 UI/contract/DB/app/DEV/runtime/Git 产物。

## 结论

```text
VERDICT=GO_FOR_CLAUDE_INVENTORY_REVIEW
M=0
S=0
N=1 (scope-gap Claude review sessionOrigin remains UNVERIFIED_REQUIRES_DEXTER_CONFIRMATION)
NEXT=发送 inventory review packet；Claude GO 后交 Dexter 接受 Batch 2，不进入 UI 或 implementation。
```
