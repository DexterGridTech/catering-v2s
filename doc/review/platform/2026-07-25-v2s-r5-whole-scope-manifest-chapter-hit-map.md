---
title: R5 全范围详设 manifest Part B / Part C / Part D 章节级命中对照
status: PROPOSED_REVIEW_ONLY
createdAt: 2026-07-25
programId: V2S_W0_W4_EXECUTION
reviewKind: IMPLEMENTATION_FACING_DESIGN
implementationAuthority: false
---

# R5 全范围详设 manifest Part B / Part C / Part D 章节级命中对照

本表是 Claude 评审必需的人工章节级对照，不是 checker，也不代替重开
`doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md` 和
`contracts/policy/standards-coverage-matrix.json`。详设落点包括主设计、接口辩证评估、operation
inventory、开发 agent execution blueprint、Journey、interaction 和 granularity manifest。
round-1 修订后还包括 104 项 edge contract implementation catalog、22-surface frontend
carryover manifest 与精确 `r5-full` fixture contract；三者均是设计输入，不授权实施。
round-2 后作者按终局 findings 补齐 32 行反向 crosswalk、删除 component 零引用、三类
business-entity selector、32 行 seed 前提、15 个 secret/purpose binding、精确 reset
allowlist 与固定 clock/date；没有开启第三轮。Dexter 后续补充的后台时间点 long、contract
分类拆分，以及 v2 有价值资产/v2s 约束反向审计也已进入 owning decision、blueprint、主设计
与 manifest。
Claude 首轮全范围评审后，作者又以
`doc/review/platform/2026-07-26-v2s-r5-whole-scope-design-review-claude-resolution.md`
逐项 intake `23 M / 36 S / 10 N`：增加 89 项错误码 disposition、104 operation 精确文件
落位、140 component 闭包、22 surface / 180 文件资产分母、R3 additive migration、
one-database-per-namespace、DEV fixed clock/OTP 与 post-remediation provenance。当前字节
等待 Claude recheck，仍无实施授权。
Claude Part R 随后确认 `62 CLOSED / 7 PARTIAL / 0 NOT_CLOSED`，并留下
`2 M / 9 S / 12 N`。当前终验字节已补齐 106 active wire code 可达性、139+1 component
落位、frontend foundation 单一真相、四项 R3 RLS disposition、workspace UUID 复合引用、
storeStatus、seed phase/action/asset reset 与 Heritage config/catalog hash；所有修改仍是
既有 Part B/C/D 的表格级承接，不增加 Journey、operation 或 surface。

## Part B

| 章节 | 条目 | R5 设计命中 | 结论 |
| --- | --- | --- | --- |
| B.1 授权与会话安全 | B.1.N01–N17 | 主设计 §5、§8 U03/U06/U09；blueprint §4/§8；platform/operations principal、cookie、face、OTP/grant、owner 复查和 secret logging | HIT |
| B.2 数据与事务 | B.2.N01–N15 | 主设计 §3–§4、U02/U04–U07；blueprint §2.3、§4–§9；七 schema、复合 FK、CAS、receipt/audit、同一 REQUIRED、task-read 边界、所有持久化时间点 long/BIGINT epochMillis | HIT |
| B.3 后端结构 | B.3.N01–N12 | 主设计 §3.1、U02–U07；blueprint §2.1–§3.2；generated adapter→application→domain→persistence，公开 API、依赖 DAG 与窄 backend platform-foundation disposition | HIT |
| B.4 前端架构与状态 | B.4.N01–N20 | 主设计 §6、U08–U10；interaction §3–§8；blueprint §10；frontend carryover manifest 22 surfaces / 180 source files；双 app、38/55/11 face slice、foundation、RTK Query/context/cache/tab ownership；foundation `contextScopedQueryArgs` 明确改 `groupWorkspaceKey` | HIT |
| B.5 交互与信息架构 | B.5.N01–N15 | Dexter 已裁决全部线框以 v2 为准；interaction §2–§10；frontend carryover manifest 的 source hash→target→foundation→generated slice→route→proof；列表/详情/动作、Drawer、状态恢复与词汇 | HIT |
| B.6 性能 | B.6.N01–N06 | 主设计 §10.2；blueprint §11；list/detail≤3、owner command≤5、task query 固定预算、分页/N+1/SQL纪律 | HIT |

## Part C normative pattern groups

| group | rule IDs | R5 设计命中或不适用理由 | 结论 |
| --- | --- | --- | --- |
| owner / transaction | C.TABLE.01–C.TABLE.06 | 主设计 §3–§4；blueprint §4–§9：公开 command、同事务、owner CAS/receipt/readback、显式 task join | HIT |
| contract / generated face | C.TABLE.07–C.TABLE.12 | 辩证评估；operation inventory；edge contract catalog 104 行、32 行反向 crosswalk 与 component/error closure；主设计 §2/U01：分类 OpenAPI source→route-face→target generated closure | HIT |
| frontend / foundation / test | C.TABLE.13–C.TABLE.19 | interaction、主设计 §6、blueprint §10–§11、frontend carryover manifest：v2 hash-bound carry/adapt、foundation precedence、per-surface real L2 | HIT |
| managed run / red fixture | C.TABLE.20–C.TABLE.23 | 主设计 §7/§10、U11/U12；blueprint §11–§13；r5-full fixture contract 的 stable keys/counts/stages/business/cleanup predicates | HIT |
| distributed proof / internal HMAC / MQ-outbox-repair | trigger-only rows | `NOT_APPLICABLE`：R5 单 deployable/单库/同事务，且明确拒绝 MQ、outbox、内部 OpenAPI client；不复制 v2 机制 | NOT_APPLICABLE |

## Part D

| 章节 | 条目 | R5 设计命中或不适用理由 | 结论 |
| --- | --- | --- | --- |
| D.1 目录与布局 | D.1.* | 主设计 §3.1、U02/U08–U10；blueprint §2.1/§2.4/§10；business server、TDP 空占位、libraries backend、双 app/foundation | HIT |
| D.2 契约治理 | D.2.L01–L04 | operation inventory、辩证评估、edge contract catalog、主设计 §2/U01、blueprint §3；32↔104、DTO、closed errors、face、generated closure、face/capability 与 owner/schema-family 分类、500 非空行上限 | HIT |
| D.3 门纪律 | D.3.L01–L03 | 主设计 §10.1/U12；复用 R4 existing gates，不新增语义 gate；实现行为由 focused L2/L3 | HIT |
| D.4 文档治理 | D.4.* | Journey、interaction、main design、assessment、inventory、blueprint、manifest、review checklists 与 evidence index | HIT |
| D.5 流程右尺寸化 | D.5.* | 主设计 §0/§1.3/§8/§12；12 unit连续执行、一个 R5 target、section-sized review packet | HIT |
| D.6 技术栈与依赖 | D.6.* | 主设计 §2–§4/§7；现有 Java/Spring/Gradle/React/RTK/AntD/foundation；无新中间件 | HIT |
| D.7 AI-first entry | D.7.* | deterministic recall、Heritage freeze、local skill、granularity manifest、fresh independent-subagent two-round review | HIT |
| D.8 日志与诊断 | D.8.L01–L03 | 主设计 §5.2/§7.3/U11/U12；blueprint §4/§8/§11–§12；结构化脱敏、首败、run manifest、cleanup | HIT |

## 核验重点

- v2 接口只作为候选：两项 NOT_CARRIED、一项 ADD、contract path 与 asset face 优化必须逐字核；
- 全部 UI 线框以 v2 静态基线为准，五类首页只保留 route/bootstrap，不新增内容；
- execution blueprint 与三个精确 catalog 必须共同约束开发 agent 的
  operation/class/table/transaction/page/test/seed 路径，不能把关键选择留给最后的门；
- `doc/review/platform/2026-07-25-v2s-r5-v2-value-and-v2s-constraint-audit-codex.md`
  的逐类 disposition 必须核验，尤其 backend foundation 白名单与 frontend
  `contextScopedQueryArgs` 的旧 key 修订；
- 本表完整不代表语义自动 GO，reviewer 仍须独立证伪方案。
