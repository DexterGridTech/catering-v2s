---
title: R4 implementation remediation Claude delta review
type: review
status: DELIVERED
reviewTarget: R4 remediation vs NO-GO(1M/2S/2N) findings
reviewer: Claude
createdAt: 2026-07-25
sessionProvenance: fresh v2s-rooted;Docker 上下文不可用(N-2)
---

# R4 implementation remediation Claude delta review

## 结论

```text
VERDICT=NO_GO
M=1  S=0  N=2
```

上一轮的全部 findings 修复质量都合格——机械面真实回归、命名清零且真红、豁免诚实、46 条剩余 checklist 经我逐条挑战无误路由。**但 remediation 自身引入了一个新 M**:能力改名漏改 `scripts/verify` 的入口引用,R4 的单一确定性入口当前**对任何调用直接崩溃**。一行修复+证据重刷即可转 GO。

## 上轮 findings 的逐项复核

1. **M-1(机械回归)CONFIRMED 修复**:matrix 现为 GATE 43 + ARCHUNIT 2 + 负夹具 1;backend-boundaries(5)/database-boundaries(8)/budget(5)/openapi(4)/security(2)/frontend(2)/logging(3)/两 traceability 各有真实 owner;`BackendModuleBoundariesTest` 被矩阵认领 2 条;intake 还主动加码(B.2.N12 业务时钟注入→database-boundaries)。**对剩余 46 条 R4_BOUNDARY_SEMANTICS_REVIEW 的逐条挑战**(每条拉 manifest 原文判定):全部确属语义/组合型义务或被测面未出现(四维不互推、恒定时间行为、状态机语义、组件纪律、缓存/EXPLAIN 判断等),**无 M 级误路由**;约 8 条含未来机械切片,见 N-1。
2. **S-1(门深度)修复**:红夹具含 contract/server/frontend operation equality 与禁注入依赖等生产路径变异;`code-layout --self-test` 新增四类红(含 TDP 占位边界、空源目录)全 PASS。
3. **S-2(豁免)修复且诚实**:豁免 decision 限定已完成的首个 cycle、明确"不是事后补字段、不升格历史 verdict、下一 cycle 起不得援引";两轮历史 NO_GO 原样未动(亲验)。
4. **命名治理**:`apps/`/`libraries/` 流程 ID 扫描为零;`scripts/check/` 无 r3-/r4- 前缀;无白名单(Dexter 选择改名路径已执行:BusinessDataConfiguration/BusinessServerBoundary/PlatformCommercialGroupController、`architecture/database/DatabaseBoundariesTest`);**行为级亲验**:scratchpad 向 src 塞 `R5Foo.java` → `CODE_LAYOUT=FAIL: FLOW_IDENTIFIER_IN_SOURCE_NAME:<精确路径>`。设计路径守卫与源码名守卫各有真红(self-test 亲验)。
5. **边界**:无新 Journey/UI/operations 登录/J02-C02/TDP/DEV/seed/reset 痕迹;`standards-coverage --phase R4` fresh PASS。

## Findings

### M-1(新):`scripts/verify` 入口因改名断链,任何调用即崩溃

- **owning source/evidence**:`scripts/verify:4` 仍 `exec node …/tools/r4-gates/verify.mjs`;该路径已改名为 `tools/verify-gates/`;我按 request 命令 fresh 运行 → `Error: Cannot find module '…/tools/r4-gates/verify.mjs'`,exit=1,输出为裸 Node 栈而非可诊断 REASON。
- **影响面**:R4 核心交付物(单入口)当前不可用;remediation 后的 `r4-verify-evidence` 若声称经 `scripts/verify` 产生即不新鲜/不实(只能经直接调用 mjs 绕过标准入口产生)。
- **最小修复**:①改一行指向 `tools/verify-gates/verify.mjs`;②在有 Docker 的机器上经**标准入口**重刷 r4-verify/closure evidence(business/cleanup 分账);③防再犯(机械):verify 或 code-layout 增加一条"scripts/* 的 exec 目标存在性"断言+真红——改名类回归正是纯机械可判。不需 Dexter 裁决。

### N-1:8 条 checklist 规则含未来机械切片,应立台账防"永久人审"

`B.4.N03(satisfies 绑死)/N06(tag 必有)/N08(分页四件套 lint 面)/N11(render 纯函数 ESLint 面)/N12(禁 per-endpoint transform)/N13(typed locator 结构)`、`B.1.N13(cookie flags)`、`D.2.L04(术语门扫 label,可绑既有 terminology gate)`——被测面随 R5 首个 UI 波/会话面出现。**最小修复**:matrix 或 HANDOFF 记一张"机械切片接线台账",绑定触发点(R5 首 UI 波)。不需 Dexter。

### N-2:Testcontainers 层仍未能我侧亲验(环境限制,如实披露)

我的环境无 Docker 上下文;且因 M-1,本轮无人能经标准入口完成全链。M-1 修复后的 fresh 全链 manifest(business/cleanup 分账、active resources=0)作为转 GO 的复核件。

## Manifest 章节命中对照(remediation 后)

| 章 | 机械承接 | checklist 留存 | 判定 |
|---|---|---|---|
| B.1(17) | security-boundaries 2 | 15(语义/运行行为类) | 合理;N13 切片入台账 |
| B.2(15) | database-boundaries 8 | 7(语义) | 合理(含加码 N12 时钟) |
| B.3(12) | ArchUnit 2 + backend-boundaries 5 + budget/query | 4(多步凭证/媒资等组合语义) | 合理 |
| B.4(20) | frontend-architecture 2 + traceability | 15(设计纪律,被测面未到) | 合理;6 条切片入台账 |
| B.5(15) | 两 traceability 门 | 13(JOURNEY_INTERACTION 等) | 合理 |
| B.6(6) | budget 5 | 2(缓存策略/EXPLAIN 判断) | 合理 |
| Part C | 编译/生成面 + verify 3 rows | 引用模式类入 REFERENCE_PATTERN 检查单 | 合理 |
| D.1–D.8 | code-layout 4(含流程 ID 守卫/TDP 边界)+ logging 3 + handoff/retirement | 治理类分属既有检查单 | 合理;D.2.L04 建议改绑 terminology gate |

## 授权边界

本 NO_GO 仅因 M-1;修复+标准入口 fresh 证据后我做即时确认即可转 GO 交 Dexter 接受。不授权任何新业务 Journey、UI、operations-admin 真实登录、TDP runtime、DEV、seed 或 reset。Git 归 Dexter。
