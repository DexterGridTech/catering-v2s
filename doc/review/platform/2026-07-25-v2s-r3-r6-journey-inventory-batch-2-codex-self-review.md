---
title: R3–R6 Journey inventory Batch 2 整体计划 Codex 对抗自审
status: SELF_REVIEW_ROUND_1
reviewTarget: doc/plans/platform/2026-07-25-v2s-r3-r6-journey-inventory-batch-2-plan.md
createdAt: 2026-07-25
---

# R3–R6 Journey inventory Batch 2 整体计划 Codex 对抗自审

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=R3-R6-JOURNEY-INVENTORY-BATCH-2
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
```

## 用户任务

本轮业务用户是 Dexter（以产品裁决者身份使用这份排序输入），而非尚未被批准的后台
使用者。其用户任务是从 R3–R6 的未完成描述中看清哪些是合法的业务 Journey、哪些只是
一项技术/验证工作、哪些缺少身份或数据前提，从而能按产品价值和阶段成本排序。成功不
是任何人登录、任何页面出现或任何代码开始写，而是一份不会用技术假设替代业务前提的
候选清单。

## Dexter 立场

Dexter 已接受设计法治 Batch 1/1.5，并只授权候选 inventory 与排序输入；明确没有授权
J02 恢复、implementation-facing design、contract、数据库、app、DEV、seed/reset、动态
运行或 Git。本批必须保持审阅者半小时可核完，优先小批量和前提链，而非把 22 个领域、
R4 门细节或 R5 实现预先铺开。

## 替代方案

1. 先让 C-01/J02 恢复、再补身份来源：会用旧 `PENDING_RECOVERY` 资产制造既成事实，
   不选。
2. 把 R4/R6 写成“验证管理员”Journey：只是把技术工作改名，审阅者无法据此作产品排序，
   不选。
3. 只给 Dexter 两个口头问题、不建立可追溯卡片：成本低，但前提链、禁推和后续 UI 条件
   会再次丢失，不选。
4. 两张具备业务语义的候选卡片，加 R5 范围占位和非 Journey 总表、先裁身份与输入再排序：推荐。

## 方案合理性

| 发起的攻击 | 复核事实与反例 | 结果 |
| --- | --- | --- |
| C-01 是否暗中恢复 J02？ | 计划只把旧 J02 作为历史问题输入，明确不改写/不发送旧 handoff，且要求新的 `PROPOSED` 卡片 | `CONFIRMED`：计划未恢复资产 |
| C-01 是否把“既有集团空间”偷换成已存在数据？ | G-01 只确认空空间/显式初始化语义，并不产生一个可操作的空间实例；计划将其生产者也列为 Dexter 决策 | `CONFIRMED`：必须与 platform-admin 身份一起显式来源化 |
| C-02 是否把 session/API/app 架构当真实登录？ | corpus G-05/G-07 规定账号与已生效任职链；Claude review 已排除 seed/default/匿名/`current-session` 反例 | `CONFIRMED`：C-02 保持外部产品裁决阻断 |
| platform-admin 与 operations-admin 身份缺口是否被错误合并？ | 前者是 C-01 完成自身任务必需前提，后者可由 Dexter 选择从 R3 移除；影响和最小裁决不同 | `CONFIRMED`：必须分列 |
| R4/R6 是否遗漏了用户价值？ | Roadmap 将二者定义为 gates/verify/handoff；没有业务 actor 或用户可观察成功结果 | `CONFIRMED`：标非 Journey 比虚构 actor 更诚实 |
| R5-SCOPE 是否越权指定 R5 产品或伪造空白 Journey？ | Roadmap 仅写“当前批准范围”，confirmed corpus 也不是 Journey approval | `CONFIRMED`：保留 `AWAITING_DEXTER_SCOPE`，不创建 C-03 卡片 |
| 是否因谨慎而陷入无期限研究？ | 本批限定两张候选卡片、一个 R5 范围占位和三个最小裁决问题；Dexter 作排序即可结束本批 | `CONFIRMED`：范围有明确终点 |

## UI 与交互

本计划自身 `NOT_APPLICABLE`：理由是它不涉及用户 route、页面、登录操作或 Drawer；它只定义
何时才有资格为获接受的 UI-bearing Journey 产出 interaction artifact 和低保真线框。
若 C-01/C-02 获 Dexter 接受，才各自独立触发 UI 工件和看图，不能把本计划中的表格当作
线框或交互设计。

## 审查意见复核

本轮尚未收到外部 reviewer finding；因此没有可被全盘接受或拒绝的意见。上文攻击表已经
重开 Roadmap、corpus 与此前 Claude review，逐项给出 `CONFIRMED` disposition、反例和适用
边界。若 Claude 提出 finding，下一轮只复核其 owning source 与反例，并比较更小修复和
成本；不会因 reviewer 身份或措辞直接扩大本批范围。

## 闭环核验

计划引用了 Roadmap 当前授权、已接受模板、confirmed corpus 和 Claude 对 R3 范围缺口的
独立结论；没有新增语义 checker、没有更新 `CURRENT_*`、没有产生 implementation 资产。
残余项完全归 Dexter：C-01 平台身份与既有集团空间输入来源、C-02 是否保留以及首用户
来源、R5 的真实业务范围和排序。它们不能由本轮自审或 Claude review 终裁。

## 结论

```text
VERDICT=GO_FOR_DEXTER_AND_CLAUDE_PLAN_REVIEW
M=0
S=0
N=0
NEXT=冻结本计划与 review request，等待 Claude 独立核验；之后由 Dexter 裁决身份前提和候选排序。
```

未启动第二轮；只有 Claude 提出须由本计划范围内复核的实质 finding，才进行定向 Round 2。
