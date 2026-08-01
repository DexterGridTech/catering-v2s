---
title: R4 全范围 implementation Claude 独立评审
type: review
status: DELIVERED
reviewTarget: R4 implementation U01–U08 vs accepted design + Roadmap §10
reviewer: Claude
createdAt: 2026-07-25
sessionProvenance: fresh v2s-rooted;经 SMB 挂载;Docker 上下文不可用(见 N-1)
---

# R4 全范围 implementation Claude 独立评审

## 结论

```text
VERDICT=NO-GO
M=1  S=2  N=2
```

工程实体大面积真实存在(13 门脚本、verify 编排、红夹具机制、ArchUnit/DB 测试、affected-L2 selection、诚实的 fail-closed);两轮独立子 agent 盲审也真实地抓住了核心问题并两次 NO_GO。**唯一但决定性的 M**:对 round-1 findings 的最终处置是把约 60–70 条**纯机械可判**规则改标 `UNENFORCEABLE_BY_MACHINE` 路由人审——这与 Roadmap §10 验收条款和已接受设计相抵,是"降低承诺面"而非"建立强制面"。作者 intake 已诚实把该判断上交;我的判断是:**不可接受,除非 Dexter 明示修订 R4 验收条款**。

## 亲验记录

1. **fresh 复跑**:`standards-coverage --phase R4` PASS(150);`scripts/verify --changed …` 静态 13 门全 PASS、`SELECTED=…` 只宣称确定性测试选择;Testcontainers 层在我侧因 `R4_TESTCONTAINERS_DOCKER_CONTEXT_UNAVAILABLE` 精确失败且**真实退出码=1**(fail-closed 行为正确,不伪造 DB 证据)。
2. **矩阵解剖(独立重算)**:150 条全 ACTIVE;机械面仅 GATE 13 + NEGATIVE_FIXTURE 1,其中还多为 R1/R2 旧门(agent-lifecycle/code-layout/project-memory 等);`UNENFORCEABLE_BY_MACHINE` 从 57 → **136**,新增 ~78 条挂 `R4_BOUNDARY_SEMANTICS_REVIEW`。被重路由者包含:B.3 模块 import/coordinator 边界(ArchUnit 教科书场景)、DDL/`SELECT *`/锁纪律、DB 次数预算、face/route/generated 三方对账、foundation 反向 import——每条判定都能一行说清且无需业务理解。**反向失实并存**:仓内真实存在 `BackendModuleBoundariesTest.java`(51 行)与 `R4DatabaseBoundariesTest.java`(135 行),矩阵却未把任何规则认领给它们(ARCHUNIT 计数=0)。
3. **两轮盲审(新治理首个 cycle)**:round-1 `NO_GO(5M/2S/1N)` 点名假 ArchUnit 分母、DB/query 覆盖不足、security/OpenAPI 未做承诺对账、affected-L2 与 evidence 失实;round-2(终轮)`NO_GO(2M/1S/1N)`,确认修复只到"重路由"为止。作者 round-2 intake `SELF_DECIDED` 但**明确不宣布接受**,把"语义充分性"上交 Claude/Dexter——程序合规且诚实。
4. **门深度抽验**:`scripts/check/security-boundaries` 为 3 行 wrapper,13 门共享 `tools/r4-gates/cli.mjs` 共 167 行——与设计承诺的 security 三方对账、query/DDL 深检不在一个量级(round-1 S-001 未完全修复)。红夹具 README 描述"经 production 函数、in-process 变异"机制正确,深度同受 cli 体量限制。
5. **边界干净(正面确认)**:无新业务 Journey/UI/页面;operations-admin 无登录痕迹;J02/C-02 未复活;TDP 占位仍空;无 DEV/seed/reset 动作;`MIGRATION_GATES_READY` 未被写入。

## Findings

### M-1:约 60–70 条机械可判规则被失实标注为"机器不可判",违反 Roadmap §10 验收与已接受设计(DEXTER_DECISION)

- **owning source**:Roadmap §10 验收原文"所有 machine-enforceable 规则必须由已存在的 gate/ArchUnit/negative fixture 承接";已接受 R4 设计 U01"只把真实存在并由 production validator 驱动的条目标为 ACTIVE"、U02–U06 的逐门承诺;验证治理 `GATE_ADMISSION_THREE_QUESTIONS`(这批规则当初正因通过三问而设计为门)。
- **evidence**:matrix 现状(kind 分布、checklist 路由)与本文亲验记录 2;round-1 M-001–003、round-2 M-001/M-002 两轮独立 NO_GO。
- **影响面**:R4 的目的是"AI 改动的分钟级防回归网";把 import 边界、DB 预算、face 对账交给每轮人审,等于把一次性建设成本转换为**永久性人工成本+必然的疲劳漏检**,并让 `--phase R4 PASS` 与"150 全 ACTIVE"呈现虚假的完成度。
- **最小修复(推荐)**:按判定准则"一行可说清且无需业务理解"逐条重分类:该子集改回 `GATE/ARCHUNIT/NEGATIVE_FIXTURE`,validator 深化到 catalog 声明面并配行为级真红;真正需要业务判断的少数(如 UI 语义、方案取舍类)留在 checklist。已有的两个测试文件应认领其对应规则。**替代路径**:Dexter 明示修订 Roadmap §10 验收条款,接受"人审承担机械规则"的长期负担——我不推荐,该选择与建立 R4 的初衷相反。
- **需 Dexter 裁决**:是(二选一;这是本 NO-GO 唯一的裁决点)。

### S-1:保留的 13 条机械门深度窄于 catalog/设计声明

3 行 wrapper + 167 行共享 cli 承载 13 门;security 未见三方对账实装。随 M-1 修复一并深化,每门补足其 catalog 声明面与行为级红变异。不需 Dexter。

### S-2:两轮盲审缺 `reviewerInputChecklist` 工件(治理规定"缺任一项该轮无效")

两轮 `reviewerKind=INDEPENDENT_SUBAGENT` 正确,但输入清单工件缺失。findings 内容优质且恰中要害,不因形式否定;**处置**:为本 cycle 落一行豁免注记(新规与模板同日落地的首个 cycle),自下一 cycle 起严格执行,不重开轮次。不需 Dexter。

### N-1:Testcontainers 层未能在我侧亲验(环境限制,如实披露)

我的评审环境无 Docker 上下文;DB 负例/rollback/cleanup 层只完成了对 `r4-verify-evidence.json` 的复核,未亲手重放,标 `UNVERIFIED_BY_ME_ENV`。verify 对此 fail-closed(exit=1)行为正确。

### N-2:值得保留的正面事实

作者 intake 的诚实上交、两轮盲审制第一次真实运转并抓住核心、affected-L2 只宣称 selection、fail-closed 纪律、边界零漂移——这些是本轮的真实资产,M-1 修复不应波及。

## Manifest 章节命中对照(实施态)

| 章 | 实施承接现状 | 我的判定 |
|---|---|---|
| B.1 授权与会话安全(17) | security-boundaries 门(浅)+ 大部分入 R4_BOUNDARY_SEMANTICS_REVIEW | 受 M-1/S-1:对账类应回机械面 |
| B.2 数据与事务(15) | database-boundaries/budget 门(浅)+ R4DatabaseBoundariesTest + 重路由 | 受 M-1:FK/CAS/预算/锁属机械 |
| B.3 后端结构(12) | BackendModuleBoundariesTest 存在但矩阵未认领;规则全入人审 | 受 M-1:教科书 ArchUnit,必须回归 |
| B.4 前端架构(20) | frontend-architecture 门(浅)+ 重路由 | 受 M-1:import 方向/生成切片属机械 |
| B.5 交互与信息架构(15) | 两 traceability 门 + checklist | 大体合理:语义多,机械少;traceability 保持机械 |
| B.6 性能(6) | budget 门 + 重路由 | 受 M-1:DB 计数断言属机械 |
| Part C 规范性条款 | 错误码/typed symbol 由 R3 conformity+编译承接;矩阵路由部分入人审 | 契约唯一真相类应保持编译/生成面承接 |
| D.1–D.8 | code-layout/占位守卫/verify/logging/handoff 门 + checklist | D.1/D.3/D.8 机械面基本成立;D.5 右尺寸由本评审裁定 |

## 授权边界

本 NO-GO 只针对"机械规则重路由"这一处置与门深度;不撤销已验证的工程实体,不重开 R3,不触碰业务边界。M-1 由 Dexter 裁决路径后,Codex 在既有授权内修复,我做定向 delta 复审(重点:重分类清单、深化后的门与真红、matrix 对账)。Git 归 Dexter。
