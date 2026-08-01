---
title: R3 全范围详设 manifest Part B / Part C / Part D 章节级命中对照
status: READY_FOR_CLAUDE_QUICK_REVIEW
createdAt: 2026-07-25
programId: V2S_W0_W4_EXECUTION
reviewKind: IMPLEMENTATION_FACING_DESIGN
implementationAuthority: false
---

# R3 全范围详设 manifest Part B / Part C / Part D 章节级命中对照

> 这是 Claude 评审材料的人工章节级对照，不是语义 checker，也不替代逐条回读冻结 manifest。
> 规则原文唯一来源为 `doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md`；本表只说明
> R3 总详设在哪里响应，或为什么不适用。U06 边界页已由 Dexter 决定补入交互工件附录并看图接受。

## 使用边界

审阅者应先阅读 R3 总详设、granularity manifest 和冻结 carry-over manifest，再逐章核验下表。每一行
只列最直接的命中规则与落点，不声称其余同章规则已经由关键词自动证明。缺少本表的 design 或
implementation-facing design Claude 评审材料不完整，不得给出 `GO` 或 `NO-GO`。

## Part B 命中

| 章节 | 命中条目号 | R3 设计落点 | 结论 |
| --- | --- | --- | --- |
| B.1 授权与会话安全 | B.1.N01–N12 | 总详设 §1.4、§3.2；U02 trusted edge context、直连拒绝与受控外部前提；U04 owner 复查 | HIT |
| B.2 数据与事务 | B.2.N01–N13 | 总详设 §2.2–§2.3；U04 owner schema、public command、同一 `REQUIRED`、unique/FK/audit 回滚 | HIT |
| B.3 后端结构 | B.3.N01–N06 | 总详设 §2.2、§3.1；U03 typed Problem/codegen，U04 vertical chain 与 owner API | HIT |
| B.4 前端架构与状态 | B.4.N01–N20 | 总详设 §3.1、§4；U03 face-specific generated closure，U05 app-owned C-01，U06 app isolation | HIT |
| B.5 交互与信息架构 | B.5.N01–N15 | C-01 interaction §2、§4–§8（含 `operations-r3-boundary` 附录）；总详设 §4、U05、U06、U07 owner-readback / feedback / typed locator / L2 | HIT |
| B.6 性能 | B.6.N01–N06 | 总详设 U04、U07 与 §7 L2：`databaseOperationCount` 列表/详情各 `≤3`、初始化写 `≤5` | HIT |

## Part C 规范性条款命中

| 条款组 | 设计落点或不适用理由 | 结论 |
| --- | --- | --- |
| 立即适用：封闭路由面、on-conflict-returning、Drawer 生命周期、架构归属测试、门红夹具、generator `--check` | 总详设 §3.1、U03–U05、U07：OpenAPI 是唯一 wire truth，`x-consumer-faces` 生成三端闭集；唯一约束处理并发；C-01 Drawer/readback；架构与 red mutation evidence | HIT |
| 触发时适用：proof receipt、outbox/投影 repair、内部命令 HMAC 信封、消息 broker 失败落库 | `NOT_APPLICABLE`：R3 是单 deployable、同一 `REQUIRED` 事务，且当前红线禁止 MQ/outbox/内部 OpenAPI client；真实触发条件出现后另经 Journey/decision | NOT_APPLICABLE |

## Part D 命中

| 章节 | 命中条目号 | R3 设计落点或不适用理由 | 结论 |
| --- | --- | --- | --- |
| D.1 目录与布局 | D.1 全章 | U01 Gate 0 与既有 `code-layout`；总详设 §6 路径分母 | HIT |
| D.2 契约治理 | D.2 全章 | 总详设 §3.1；U03 闭集 OpenAPI Problem code、双端 typed codegen；U05 穷尽 `switch` / `never` | HIT |
| D.3 门纪律 | D.3 全章 | U01 shared production validator + red mutation；总详设 §7；不把业务语义写成 checker | HIT |
| D.4 文档治理 | D.4 全章 | 本总详设、granularity manifest、C-01 journey/interaction、review/evidence 路径；U01 checkpoint | HIT |
| D.5 流程右尺寸化 | D.5 全章 | 七个串行 unit、Gate 0 后停止、R4 gate 不提前；总详设 §0、§5、§7 | HIT |
| D.6 后端技术栈候选与依赖白名单 | D.6 全章 | U02 先做 Java 21/Spring Boot 版本 spike 与 allowlist；未在设计阶段臆定旧 API | HIT |
| D.7 AI-first 底座迁移 | D.7 全章 | `NOT_APPLICABLE`：R2 已关闭的仓根治理底座，不是 R3 实现面新增或变更；本次只在其既有约束下设计 | NOT_APPLICABLE |
| D.8 日志与诊断 | D.8 全章 | U02 managed commands / trusted correlation，U07 run manifest 与 business/cleanup 分账；不把“诊断”作为用户可见 C-01 文案 | HIT |

## 裁决闭合

- `R3-U06` 的 operations-admin boundary route 是用户可见页面，故不能以“非业务 Journey”自动免除
  UI 工件。Dexter 于 2026-07-25 决定补入 C-01 interaction 附录 `operations-r3-boundary` 并接受看图；
  该页只作静态边界说明，不推导 operations 登录、session 或业务能力。
