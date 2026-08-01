---
title: R4 全范围 implementation-facing 详设 Claude 独立评审
type: review
status: DELIVERED
reviewTarget: doc/plans/platform/2026-07-25-v2s-r4-machine-gates-and-verification-implementation-design.md
reviewTargetSha256: d07cfffdb0cb3cf7…(全文已复算)
manifestSha256: 6229a4f430f699a7…
chapterHitMapSha256: ff1537e5c401af38…
reviewer: Claude
createdAt: 2026-07-25
---

# R4 全范围 implementation-facing 详设 Claude 独立评审

## 结论

```text
VERDICT=GO
M=0  S=0  N=2
```

R4 详设方向正确、分母闭合、边界干净:未误造业务 Journey,未恢复 J02/C-02,未引入 TDP/MQ/outbox/第二真相;门体系严格贴合验证治理(机器只管机械、每门真红变异、分钟级 verify、business=NA 诚实分账);未来 UI 的 all-v2 对照与 foundation 优先消费被固化成 traceability gate 输入。两条 N 均为接受前的分钟级校正。

## 方案合理性(先于闭环)

问题对:R4 服务的是"下一波迁移前的确定性回归网",不是 CI 平台——§0 把消费者定义为 Dexter 的迭代工作流,三个替代方案(R5 再测/巨型语义 checker/每规范一平台)否决理由全部成立。代价配:单入口+原生 validator+真红变异,零基建,与"分钟级、防回归"阶段标尺一致;§5 保留生产化欠账走 HANDOFF,不偷换。

## 亲验记录(含章节 sweep)

1. **分母交叉核验(独立重算)**:matrix 中 `PLANNED` 且到期 ≤R4 的 distinct enforcement ref 共 10 个,9 个被设计/manifest 逐一命中(security/frontend/database×2/query→database、openapi、logging、两 traceability、verify);唯一未命中的是 12 条 ARCHUNIT 规则的**旧路径 ref**——见 N-2。57 条 `UNENFORCEABLE_BY_MACHINE` 保持 6 份 checklist 承接,U01 明令不得改造成关键词 checker。
2. **诚实红灯**:`standards-coverage --phase R4` 当前 FAIL(`PLANNED_ENFORCEMENT_OVERDUE:B.1.N01`),设计 §1 如实把它标为"未实施分母到期的预期红灯,不作伪修"。✔
3. **章节 sweep**:hit map 覆盖 B.1–B.6(逐章条目号+落点)、**Part C normative groups(§27 起)**、D.1–D.8;我抽验 B.3/B.4/B.6/D.1/D.5 行与设计实文一致(B.4/B.5 行还写入了"future UI 必须先做 all-v2 CARRY/ADAPT/NOT_CARRIED 对照、优先消费 foundation"——Dexter 两项裁决被正确固化)。评审首轮曾误判"缺 Part C",经复查撤销(grep 模式之误,如实记录)。
4. **八单元与 UI 适用性**:manifest 8 单元全部诚实 `notApplicableReason`(R4 无用户面;R3 UI 仅作回归/追踪输入,未借"非 Journey"话术遮蔽真实 UI)。
5. **边界扫描**:J02/C-02 仅以"不恢复"出现;MQ/outbox 仅出现在 retirement 负例;TDP 占位受 U02 负例守卫(长出 src/wire 即红);Testcontainers 与 DEV 隔离、verify 不启动浏览器/持久 DEV/seed;`MIGRATION_GATES_READY` 由本文件自我禁写。✔
6. **红夹具设计**:U07 列举十类行为变异(hash drift/unknown face/wrong edge/跨 workspace FK/SQL lock/reachability/foundation 反向/secret logging/retirement 残留/handoff 字段),均要求走 production `run()`,符合"真红先于上线"。
7. **授权与轮次**:R4 design authorization decision 仅设计授权(`implementationAuthority:false`);round-2 `SELF_DECIDED` 收口于旧规则下,按子 agent 治理 decision 的不追溯条款有效;实施期将以 `REVIEW_TARGET=IMPLEMENTATION` 且新盲审制重开。✔

## Findings

### N-1:manifest 绑定的 granularity checker hash 已漂移,设计包当前过不了自己的机械门(接受前必修)

fresh 复跑 `implementation-design-granularity --manifest … --review …` → `FAIL: IMPLEMENTATION_DESIGN_CHECKER_TOOL_HASH_DRIFT:tools/implementation-design-granularity/cli.mjs`。成因:R4 manifest 冻结后,独立子 agent 治理批次修改了该 checker(新增 INDEPENDENT_SUBAGENT 校验)。**最小修复**:刷新 manifest 的 checker hash 与 round-2 review json 的 `manifestSha256`,注记"机械刷新,因 governance 批次 checker 演进",不重置 cycle(换 hash 不重置轮次的既有规则适用);刷新后复跑须 PASS。不需 Dexter。

### N-2:U01 缺两件到期校正的显式吸收

①matrix 12 条 ARCHUNIT 规则的 ref 仍指旧路径 `apps/backend/src/test/java/architecture/BackendModuleBoundariesTest.java`,结构裁决后实路径为 `apps/backend/catering-business-server/src/test/java/architecture/…`(U02 已用新路径,但 U01 的 matrix 更新未点名此校正);②R2 acceptance 遗留的 standards N-2(B.3.N06–N12 等 enforcement kind 偏乐观,部分应转 NEGATIVE_FIXTURE,**到期就在 R4**)未在 U01 出现。**最小修复**:U01 补一段——"实施时逐条校正 12 条 ARCHUNIT ref 路径,并按 R2 遗留 N-2 清单逐条复核 enforcement kind,禁止空断言凑 ACTIVE"。不需 Dexter。

## 授权边界

本 GO 仅表示 R4 全范围 implementation-facing 设计(连同两条 N 的修订)可交 Dexter 接受。不授权任何 R4 app、contract、数据库、Flyway、测试/业务源码、DEV、动态运行、seed/reset;不改变 R3/J02/C-02/TDP 边界;`MIGRATION_GATES_READY` 须待实施完成、`REVIEW_TARGET=IMPLEMENTATION` 复核(独立子 agent 盲审制)与 Dexter 验收后另行判定。Git 归 Dexter。
