---
title: catering-v2s 跨代业务语料库草稿 Claude 独立评审请求
status: READY_FOR_EXTERNAL_REVIEW
createdAt: 2026-07-24
reviewTarget: business-corpus-draft
implementationAuthority: false
---

# catering-v2s 跨代业务语料库草稿 Claude 独立评审请求

## 背景

- 草稿：`doc/review/platform/2026-07-24-v2s-cross-generation-business-corpus-draft.md`
- SHA-256：`9cc9db48eb9d359b44502a898df55a8e967be60fb1476c6d05eac5e8f0ea980d`
- 当前状态：`DRAFT_FOR_DEXTER_AND_CLAUDE_REVIEW`

该草稿因 Codex 曾把技术 `workspace` 误写成无来源业务场景而建立。R3 专项设计已暂停；本次只恢复跨代业务语言，不讨论或授权任何 R3/W1 implementation、应用代码、contract、数据库、动态运行或 Git 写入。

## 评审目标

请先自行回读草稿 §9 Source ledger 中的 V6、v4、all-v1、all-v2 原文，再读草稿的结论；不要被“跨代一致”或现有实现状态锚定。

本草稿的目标是恢复 V6 **01–22 全部领域**的第一层业务语料，而非只审组织/IAM。请重点检查：

1. `GroupWorkspace / 集团空间`、`CommercialGroup / 商业集团`、`Tenant / 实际经营租户`、`HeadCompany / 总公司`、`Store / 门店` 是否被正确区分；
2. `workspaceKey`、`groupWorkspaceKey`、集团空间编码、外部入口与 URL 的边界是否被草稿夸大或遗漏；
3. 组织树、访问节点、业务范围、总公司品牌授权与门店可见性是否有反向推导；
4. 平台技术管理员、运营用户、账号、Principal、任职、角色分配、页面准入、能力、数据范围、当前工作上下文是否被错误合并；
5. 03–22 各领域是否都同时写清了业务目的、owner fact、禁止推导、生命周期/旧词和仍待裁决项；尤其检查目录/菜单/库存、身份/权益/营销、订单/支付/履约/结算、渠道/外部协作/终端/打印/到店服务、分析/治理之间是否错误吞并；
6. 03、13、16、17、19、22 中记录的正式文档漂移，是否有足够证据且没有因修复措辞重新引入已删除对象；
7. 草稿的词条格式是否足以同时约束未来业务设计、UI 文案、contract 命名与实现审查，而不会把技术实现细节误升格为产品真相；
8. §6 的每个冲突是否被诚实保留；是否还有应新增的冲突、禁用词或未决产品决定；
9. §10 的 project-memory 推广门是否足以确保未确认草稿不会被自动当作当前业务真相。

## 需阅读文件

请从 `catering-v2s` 仓库根打开：

- `doc/review/platform/2026-07-24-v2s-cross-generation-business-corpus-draft.md`：本次全域草稿、冲突表和 §9 source ledger；
- `doc/review/platform/2026-07-24-v2s-cross-generation-business-corpus-claude-review-request.md`：本评审边界与输出格式；
- `CLAUDE.md`：独立评审、业务合理性与授权边界纪律；
- `project-memory/operations/claude-review-handoff-standard.md`：本次交接必须自足、可复制的规则。

草稿 §9 所列 V6、v4、all-v1、all-v2 原文均为 Heritage，只读回查；不得从旧实现状态反推产品真相。

## 独立核验重点

请先从 V6 统一术语、领域设计和产品导读独立形成判断，再用 v4/v1/v2 资料核验历史映射与冲突。特别核验：草稿是否把技术隔离、领域对象、用户任务、实现形态和历史别名错误混同；对每项正式文档漂移是否只登记证据而没有擅自裁决。

## 期望结论

请按以下格式输出；每项都写精确来源路径和标题/行号：

```text
VERDICT=GO_FOR_DEXTER_REVIEW | NO-GO

TERM=<术语或关系>
STATUS=CONFIRMED | PARTIALLY_CONFIRMED | REJECTED_WITH_EVIDENCE | UNVERIFIED_REQUIRES_EVIDENCE | DEXTER_DECISION
EVIDENCE=<原始来源>
FINDING=<语义错误、遗漏、冲突或确认内容>
MINIMAL_CHANGE=<对草稿最小的修订；无则 NONE>
DO_NOT_INFER=<不得由该术语推出的业务含义；无则 NONE>

CONFLICT=<草稿 §6 条目或新增条目>
STATUS=<同上>
EVIDENCE=<原始来源>
DECISION_OWNER=Claude | Dexter
WHY=<为什么不能由实现便利性裁决>
```

如果结论为 `GO_FOR_DEXTER_REVIEW`，它只表示草稿可以交 Dexter 做产品裁决；不表示可写入项目记忆，更不表示 R3/W1 可以恢复。请同时汇总 `M` / `S` / `N` finding 数量；每项写精确文件与行号、影响面、最小修订及是否需要 Dexter 裁决。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助独立评审本次“跨代 V6 全域业务语料库草稿”。

背景：Codex 曾把技术 `workspace` 误写成无来源业务场景，因此 R3 专项设计已暂停。本轮只恢复 V6 01–22 的业务语言和跨代映射；草稿不能被当作已确认产品真相。
目标：请独立判断草稿是否准确区分技术隔离、经营组织、账号权限与 03–22 领域事实，并且没有从旧代码、接口或实现便利反推用户任务、业务规则或 UI。

请从 catering-v2s 仓库根阅读：
- doc/review/platform/2026-07-24-v2s-cross-generation-business-corpus-draft.md：全域草稿、冲突和 source ledger；
- doc/review/platform/2026-07-24-v2s-cross-generation-business-corpus-claude-review-request.md：本次范围、读法和结论格式；
- CLAUDE.md、project-memory/operations/claude-review-handoff-standard.md：独立评审与交接纪律。

请重点独立核验：先回读草稿 §9 列出的 V6 术语/领域设计与 v4/v1/v2 Heritage 原文，再审集团空间/商业集团/租户/总公司/门店、账号/任职/角色/上下文、商品到结算链、渠道到终端/打印/到店服务链、分析与治理边界；并确认 03、13、16、17、19、22 的正式文档漂移没有被草稿擅自选边。请从业务用户与 Dexter 的立场判断该语料是否真的能约束未来 Journey、UI、contract 和实现，而不是只检查名词闭环。

烦请给出明确 GO_FOR_DEXTER_REVIEW 或 NO-GO，并汇总 M / S / N。如有问题，请按 M / S / N 标注精确文件与行号、影响面、最小修订建议，以及是否需要 Dexter 产品裁决。

授权边界：本次结论只代表该草稿是否可以交 Dexter 做产品裁决；不写入 project-memory，不恢复 R3/W1，不授权业务代码、contract、数据库、DEV/seed/reset、动态运行或任何 Git 操作。谢谢。
```
