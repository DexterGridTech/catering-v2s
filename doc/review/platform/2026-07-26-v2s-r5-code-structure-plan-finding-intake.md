---
title: R5 代码结构整改计划 Claude finding 辩证 intake
status: CLAUDE_GO_RECEIVED
createdAt: 2026-07-26
reviewSource: doc/review/platform/2026-07-26-v2s-r5-code-structure-remediation-plan-review-claude.md
reviewTarget: doc/review/platform/2026-07-26-v2s-r5-code-structure-retrospective-and-remediation-plan.md
programId: V2S_W0_W4_EXECUTION
roadmapStep: R5
authorizationBoundary: PLAN_AND_BLUEPRINT_REMEDIATION_ONLY
claudeRecheckReceipt: 2026-07-26 Dexter-transferred GO(M=0 / S=0 / N=2); no additional product scope, contract, schema, migration, DEV/seed behavior, or review cycle was authorized.
---

# R5 代码结构整改计划 Claude finding 辩证 intake

## Claude 复核回执

Dexter 于 2026-07-26 转交 Claude 复核结论：`GO(M=0 / S=0 / N=2)`。三项原 M 已全部关闭：
同次职责归位、17 个 operations page key 与 22 surface 的完整分母、以及既有控制从假绿修为真红。
两项 N 被纳入 R5 全范围 implementation review 核验分母，不阻断 S0-S5 执行。

执行边界不变：S0-S5 是既有 R5 implementation 授权内的内部结构整改；S5 前不得恢复 DEV/seed；R5
完成后只提交一次全范围 implementation review。

| Finding | 状态 | owning source 重开结论 | 处置 |
|---|---|---|---|
| M-01 职责修复不能只搬目录 | `CONFIRMED` | `OperationsOrganizationController` 实际重复读取 `V2S_OPERATIONS_SESSION` cookie、inline request record、字符串闭集和 `Object` response；`PlatformApp` 内联 fetch、多个 mutation 缺 idempotency、前端构造邀请时间并以 TextArea 编辑闭集。 | 整改计划 S1-S3 改为“搬迁与职责修复同次完成”；加入 shared edge resolver、generated wire、typed Problem、catalog-driven page envelope、per-face generated client facade、lifecycle idempotency、server-owned time 与 closed-set selector。注意：raw `List` 是否应改 page envelope 逐 operation 服从 frozen catalog，不作无依据的全量改写。 |
| M-02 页面/surface 分母失真 | `CONFIRMED` | `contracts/policy/frontend-asset-carryover-manifest.json` 明确 closure 为 22 surfaces / 25 pageDesignKey；含 `PLATFORM-WORKSPACE-OVERVIEW`、`PG-STORE-PROFILE` 和五个 `HOME-*`。 | S0/S2/S3 改锚该 manifest；平台为 10 surface，operations 12 surface；17 个 operations page key 分别归 feature 或显式 app routing/bootstrap。 |
| M-03 控制面死代码 | `CONFIRMED` | `tools/code-layout/cli.mjs` 只查 `apps/<name>/src`，不进入实际 `apps/frontend/<name>/src`；其 red fixture 也使用错误的扁平路径。现存 frontend architecture tests 是将拆除文件的文本断言。 | S0 前置修复既有 `code-layout`、`frontend-architecture` 与后端 ArchUnit，并以真实目录 red mutation 验证；新增 project-memory pitfall 和 blueprint 禁令均列为 S0 完成项。没有新增独立 gate。 |
| S-01 计数混用 | `CONFIRMED` | app 根有 24 controller，另有 advice、bootstrap/configuration 和 3 generated 文件；7 是 owner schema 数，owner library/module 另有不同物理计数。 | 术语统一为“7 owner schema、8 owner registry module、9 backend library（含 access/foundation）”；不再称“7 owner library”。 |
| S-02 feature 对照缺失 | `CONFIRMED` | `workspace-overview` 确有 manifest surface；invitation 是 workspace-account surface 的子能力而非另一个 manifest surface。 | 增加 heritage-name → v2s-name → surface/pageKey 对照；邀请管理归 `workspace-account-management` feature。 |
| S-03 v2 后端描述与 frontend api 约束 | `CONFIRMED` | v2 backend 为 capability-first 后再 adapter/application 分层；v2s `features/*/api` 是必要增强，不能变成手写 fetch 桶。 | 计划更正描述；`feature/api` 只放 generated slice 的 typed facade/query hook，底层 transport 只在 app per-face client。 |
| S-04 public 聚合文件 | `CONFIRMED` | `PublicEntry.tsx` 同时承载 invitation 和 recovery。 | S3 明列拆为两 feature。 |
| S-05 单行密度 | `CONFIRMED` | 当前关键 TSX 存在超高单行密度。 | S2/S3 加入正常格式化和 readable component boundary。 |
| N-01~N-04 | `CONFIRMED` | 与 owner/package、长期证据、测试差异和 configuration SQL boundary 一致。 | 纳入计划附录与 S0/S4 检查表。 |

反例检查：没有采纳“把 controller 放进各 owner library 的 adapter.in.web”替代方案。一个 owner 可服务
多个 face；把 face adapter 放入 owner library 会污染 owner 的独立性。已接受主设计 §3.2 已指定
`catering-business-server adapter.in.web` 作为 app assembly，故采用 `app/edge/<face>/<capability>`。
这不改变 owner API、业务事实或事务边界。
