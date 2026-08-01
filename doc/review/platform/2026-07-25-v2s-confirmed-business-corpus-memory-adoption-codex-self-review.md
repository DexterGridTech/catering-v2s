---
title: 已确认业务语料项目记忆纳入方案 Codex 对抗式自审
status: GO_FOR_DEXTER_AND_CLAUDE_REVIEW
createdAt: 2026-07-25
implementationAuthority: false
---

# 已确认业务语料项目记忆纳入方案 Codex 对抗式自审

REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=BUSINESS-CORPUS-MEMORY-ADOPTION-2026-07-25
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2

## 用户任务

业务用户不是要一份更长的术语文档，而是要让之后参与设计和实施的人对“集团空间、
门店、合同、角色、商品、库存”等事实说同一种业务语言，且在不知道时诚实停下而
不是再次臆想。成功结果是：被 Dexter 已确认的 G-01–G-12 能在相关任务开始前被读
到，未确认领域不会被伪装成结论。

## Dexter 立场

Dexter 要先暂停继续确认、把当前成果作为可恢复旁支，并让 Claude 审查纳入方式；
他没有授权以此开展 R3/W1、技术物化或把全域草稿直接写成 project-memory。成本
目标是长期少犯概念错误，而不是增加永远要读的治理材料。

## 替代方案

- 只保留 review 草稿更短，但后续 agent 很难按记忆路由发现它，容易重演无来源 UI；不选。
- 把全草稿、22 域 ledger 和历史漂移整体复制进 memory 看似完整，却会把 `UNVERIFIED` 误成当前真相；不选。
- 推荐精简 canonical corpus + read policy + parked intake：多三个小 anchor，但只把已确认结论路由给相关任务，保留来源和未决边界。

## 方案合理性

问题正确：此前风险不是缺一个名词翻译，而是技术隔离概念被改造成虚构的业务任务。
方案用可追溯的业务条目、禁推和按域恢复来减少该风险，复杂度与长期收益匹配。它
刻意拒绝关键词 checker、通用全域强制阅读、一次性补完 22 域和技术 schema 映射，
避免为“完整”过度设计。唯一不可逆动作是未来 memory promotion，已被 Claude review
和 Dexter acceptance 双门阻断。

## UI 与交互

NOT_APPLICABLE：理由是本交付不设计或实现用户界面、页面操作或 Journey。它只规定以后
任何 UI 任务何时需要先读业务语料；具体操作是否符合用户路径仍必须在其各自设计/
实施审查中重新判断，不能以本方案替代。

## 审查意见复核

已复核 Claude 对原语料草稿的 `S-1/N-3`：`CONFIRMED` 的部分是现行 all-v2 裁决层、
目录三义和 `menu_release` 必须进入草稿；这些已在 G-01–G-12 的输入中体现。反例是
把 S-1 当作“现在必须重构 IAM 技术模型”或把 N-3 扩为全域用词清洗；两者超出证据和
授权，故 `REJECTED_WITH_EVIDENCE`。本方案也没有把 Claude review 当自动批准：每个
future anchor 仍需 Dexter 接受，且对新 finding 只做有出处的更小修订。当前未收到针
对本方案的外部 finding，因此第一轮不假装已有独立结论。

## 闭环核验

- 冻结输入已绑定 corpus 草稿 SHA，并将 G-01–G-12 与 parked 08–22 分离；
- 采用既有 deterministic memory route 和 `required-inventory.json`，不引入 provider、daemon 或伪语义门；
- 规定了 future 文件、owner、触发、最小 source reopen、反例控制和 smoke evidence；
- 未修改 `project-memory/`、Roadmap、contract、业务源码、运行环境或 Git。

## 结论

```text
VERDICT=GO
M=0
S=0
N=0
IMPLEMENTATION_AUTHORITY=false
NEXT_DECISION=DEXTER_AND_CLAUDE_REVIEW
```

该结论仅表示“这份纳入方案可交 Dexter 与 Claude 审阅”。它不表示 corpus 已获最终
接受，更不表示可以执行 Unit A/B 或恢复 R3/W1。若收到实质 Claude finding，只允许
同一 cycle 的一次第二轮定向复核；第二轮后由 Codex 自行 `SELF_DECIDED`，不陷入无休
止对抗。
