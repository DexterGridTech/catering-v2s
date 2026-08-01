---
title: 已确认业务语料项目记忆纳入方案 Claude finding 辩证处置
status: SELF_DECIDED_GO_FOR_DEXTER_ACCEPTANCE
createdAt: 2026-07-25
implementationAuthority: false
---

# 已确认业务语料项目记忆纳入方案 Claude finding 辩证处置

REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=BUSINESS-CORPUS-MEMORY-ADOPTION-2026-07-25
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED

## 用户任务

业务用户需要未来 agent 读到完整、已确认的 G-01–G-12 业务边界，同时在未确认概念
首次出现时停下求证；不能因摘要截断、索引遗漏或域编号而重演无来源的业务设计。

## Dexter 立场

Dexter 要的是可长期使用但右尺寸的业务共识底座：不把 review 草稿整体升格，不增设
伪语义门，不为补齐 22 域启动泛研究，也不借此授权 R3/W1 或技术物化。

## 替代方案

- 只在 record 补两句限定词：更短，但无法防止 Unit A 以后从摘要遗漏其他限定、历史映射和修订台账；不选。
- 让词干索引决定是否读语料：表面自动化，但会把词面不命中误判成语义不相关；不选。
- 仅把 08–22 放 parked：实现简单，却让 01–07 未覆盖概念无一致的停下入口；不选。
- 采用最小修订：全文基准句、人工定位索引、01–07 residual 栏；推荐。

## 方案合理性

Claude 的三条 N 均为 `CONFIRMED`：草稿 §7.3/§7.11 的完整限定确实可能在摘要复制时
丢失；现有触发矩阵确实需一个不决定语义的查找入口；01–07 仍有不被 G-01–G-12 覆盖
的业务概念。修订不改变任何产品结论、不新增 G 条目，也没有把索引编码成 checker，
所以收益大于极小维护成本。

## UI 与交互

NOT_APPLICABLE：理由是本轮仅处置项目记忆纳入设计的文档 finding，不设计、实现或
验证任何用户界面。未来 UI 仍须按其用户任务和批准 Journey 重开独立审查。

## 审查意见复核

复核证据与来源：Claude review 的 N-1/N-2/N-3、冻结草稿 §7.3/§7.11、proposal §4–§7、
record §6，以及 V6 02/03 域在草稿 §9 的 source ledger；均已重新打开对照。以下只采
取更小修订，拒绝以新增 checker、补齐全域或技术物化来回应 finding，避免过度设计。

- `N-1=CONFIRMED`：重开草稿 §7.3、§7.11，确认 G-03 的“未来分析/报表类能力”和
  G-11 的 `shapeKey` 历史映射属于不可随摘要丢失的限定。反例是完整复制 record；它
  会不断膨胀且仍无法保证其它修订台账不遗漏。最小修订是在 Unit A 固定以 §7.1–§7.12
  全文为基准，record 保持目录。
- `N-2=PARTIALLY_CONFIRMED`：人工索引有助于起始自查，但若把未命中视为否定会重建
  关键词伪语义门。最小修订是 canonical 文件头的主叫法/别名/禁用词索引，并明写无命
  中不免除跨域和歧义判断；不接入 route/gate/checker。
- `N-3=CONFIRMED`：V6 02 的 `StoreOperationType`、`OrgScope` 与 V6 03 的轻合同外
  商业关系实体确实不由当前 G 条目解决。反例是把它们直接纳入 canonical；这会以技术
  名字代替 Dexter 产品裁决。最小修订是 parked 台账新增 01–07 residual 栏，仅列问题
  与来源，沿用同一逐题 grill 机制。

未发现需要 `DEXTER_DECISION` 的新产品选择；Claude 的 GO 不被当作自动 memory
promotion。三条修订均已落在 proposal/record，且仍等待 Dexter 的 §10 接受。

## 闭环核验

- 重开 Claude review、proposal、record 与草稿 §7.3/§7.11；finding 与原文一致；
- 新增的词干索引只在“未来 canonical”设计中出现，未引入脚本、checker、route 或实现；
- parked residual 明确标未确认，未新增业务答案、contract/schema/页面或授权；
- 当前仍未改写 `project-memory`、Roadmap、业务代码、数据库、运行环境或 Git。

## 结论

```text
VERDICT=GO
M=0
S=0
N=0
ROUND_FINAL_DECISION=SELF_DECIDED
DEXTER_ACCEPTANCE_REQUIRED=true
PROJECT_MEMORY_MUTATION=false
```

本 cycle 达到两轮上限，Codex 对 Claude N finding 已自行作出最小、可追溯处置，不再
启动第三轮。下一步仅等待 Dexter 接受 proposal §10；接受后才可执行 Unit A/B。
