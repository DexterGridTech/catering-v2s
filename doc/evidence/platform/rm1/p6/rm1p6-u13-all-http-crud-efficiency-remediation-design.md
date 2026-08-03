---
title: RM1 全 HTTP CRUD 效率整改设计
status: DESIGN_FOR_REVIEW
createdAt: 2026-08-01
scope: all generated business-server HTTP operations
sourceProblemFamily: doc/evidence/platform/rm1/p6/rm1p6-u13-all-http-crud-efficiency-problem-family.json
authorizationBoundary: This design supersedes the withdrawn Seed-only optimization direction. It authorizes no production change, DEV/seed/reset, managed L2, business PASS, cleanup PASS, or Roadmap update.
---

# 1. 决策与目标

Seed 报告是本次发现的入口，不是整改分母。目标是让两个管理后台和 public entry 的 **全部 HTTP CRUD/安全接口** 获得可解释的效率画像，并按 owner、事务、权限与读回语义进行根因整改。

当前权威运行时分母是 generated `edge-route-face-registry.json` 的 **147** 个 operation：platform-admin 43、operations-admin 89、public 15；其中 GET 61，command 86。最近成功 Seed 实际只有 26 个 endpoint group、63 次调用，即 17.7% 路由样本。它不能支持“全接口已优化”、也不能支持性能 PASS。

本设计不引入“所有接口三条 SQL 以内”的错误规则。效率的含义按用户任务和接口类型划分：

| 类型 | 合格的优化对象 | 必须保留的业务成本 | 不可作出的结论 |
|---|---|---|---|
| 分页/候选/概览读取 | N+1、重复 owner 读取、未受限集合、重复 read model 组装 | 可解释的 owner task read、显式跨 schema task join | statement 少于三次即性能好 |
| 创建/更新/状态命令 | 重复 session/actor load、validate→insert→re-read→update、逐条同构写 | 幂等、CAS、审计、状态与权限重判、最终 owner readback | 命令 SQL 数高即冗余 |
| public/security | 重复安全事实 load 与重复 entry composition | 限流/锁、OTP、凭证安全、会话写、失效与审计 | 减少数据库操作可放松安全链 |

不改变：一个 deployable/一个 PostgreSQL、多 owner schema、公开 command API 与同一 `REQUIRED` 事务、显式 task read、`x-consumer-faces`、两 admin app 隔离，及禁止把 owner 授权/写入事实移到 edge。

# 2. 原始问题与已确认事实

Seed report 的 23 个“max statement count > 3”组只表示 26 个已执行接口组中的诊断候选。它记录 request-local JDBC `execute*` logical count、累计 statement duration 与 HTTP duration；不记录 SQL/bind，不表示 DB CPU/IO、锁等待、事务数、p95/p99、吞吐或端到端性能。

全量静态检查已确认以下有限问题族，完整搜索、反例与结论在 source problem family：

1. 根 OpenAPI 展开为 146，而 runtime registry 为 147；遗漏的是 `releasePlatformStagedAsset` 根路径引用。该问题必须先修正，否则“全接口”无单一契约分母。
2. 两个真实 list N+1：platform workspace page 的逐 workspace logo asset resolve；operations head-company page 的逐 row `authorizedBrands`。后二者含 owner existence read，页大小 20 时可达 2N。
3. public invitation 五个 token flow 的重复 invitation load；operations password/OTP/session-entry 的重复 canonical entry composition。
4. extension definition/initial create 的重复 validation/read/write/merge/update；hierarchy phase 的不按 node type 分支与逐条写；九个 platform mutation 的 session/actor double load。
5. P4 ledger 中十个高于默认 task-read guidance 的稳定批量读取。这些当前证据不是 N+1，必须逐项分类。
6. 多 intent invitation completion 的线性判断尚只有源码假设；没有多 intent workload 前禁止实施 batch API。

# 3. 先修正分母，再形成全接口工作负载

## 3.1 契约分母（第一交付单元）

修复 root `edge.openapi.yaml` 对 staging release path shard 的缺失引用，并扩展既有 `edge-codegen --check`：root OpenAPI 的展开 operationId/method/path/consumer-face 集合必须与 generated route registry exact-set 相同。它是已有 generated contract drift 防线的直接补足，不是新增语义 gate。此处应当补 root 路径键、不能退役 route：path shard 已声明 `releasePlatformStagedAsset`，`PlatformAssetController` 已实现它，registry 也将它声明为 `platform-admin` / `platform-asset`；唯一缺口是 root 对 `/api/platform/assets/staging/{assetRef}/release` 的引用，且没有批准业务来源将该 operation 退役。

focused red：删除该 root reference 或改动其中 operationId/path，`--check` 必须失败；修复后生成输出继续具备 `Generated … do not edit` 头。这个单元不涉及 handler 行为。

## 3.2 147-operation workload 清单（第二交付单元）

由 registry 派生 operation inventory，并为**每个** operation 声明一个合法真实 HTTP 场景。清单不是把 Seed fixture 扩成“伪全量初始化”，也不允许删除难以调用的 route：

- `operationId`、method、normalized path、consumer face、owner 必须来自 generated registry，未知/重复/缺项 fail closed。
- 每项声明 `positive` 或 `expectedRejected`，前置事实、最小 request template、所需身份/时钟、业务 oracle 和 owner readback（若该命令的正常语义要求）。无合法成功条件的端点用明确 typed 4xx 场景覆盖，不能默默跳过。
- runner 按前置事实的依赖拓扑建立最小 owner-command data；不跨 schema DML，不重用 Seed 的最小 fixture 边界，也不把 client 推导当服务端 metadata。
- report 产生 `declared / attempted / correlated / passed / expectedRejected / unexecuted`；任何 147 分母缺项、未知 op、缺 completion 或错误 operation metadata 均失败。每个 `unexecuted` 必须记录单项原因及显式 disposition（例如前置事实不可建立、需要外部副作用或已由 `expectedRejected` 覆盖）；缺少该记录时 coverage 单元不得宣称完成。报告同时给出 `executedRatio` 与未处置 `unexecuted` 计数；正常 completion 的 DB count 可以是 0，零不能被误判失败。
- completion 继续由服务端 `SeedRequestMetricsInterceptor` 的 registry metadata 和 runId/correlation 驱动。报告只保存低基数 operation/owner/outcome、时长与计数，不保存 password/hash、OTP、token、cookie、Authorization、手机号、登录名、IP 或 raw payload。

这是**覆盖与诊断**，不是性能 benchmark 或 browser L2。HTTP diagnostic 只启动其本机 backend 和所需受管 remote-middleware tunnel，并保留 run-scoped manifest、日志读取与资源回收；它只报告 coverage/diagnostic 与 cleanup，**不**启动两个 frontend/Playwright，也不产生 Journey business 结果。已批准 Journey 的 browser L2 才在本机启动两个 frontend/Playwright，并单独判定该 Journey 的 business 与 cleanup。

## 3.3 两层指标

| 层 | 指标 | 用途 | 不能替代 |
|---|---|---|---|
| operation profile | 每 operation 的 HTTP avg/min/max、JDBC statement avg/min/max、statement-duration sum、outcome/correlation coverage | 定位重复读取、N+1、意外写循环和分母缺口 | latency/吞吐性能结论 |
| controlled performance study | warm-up、固定样本和并发阶梯、p50/p95/p99、throughput/error rate、pool/lock wait、DB CPU/IO、`EXPLAIN (ANALYZE, BUFFERS)` | 对已确认热点的优化前后决策 | 用户流程或安全正确性证明 |

性能研究只对阶段 4 中已确认热点做；不会以 147 个 endpoint 的统一阈值制造噪声。

# 4. 候选整改流、准入与根因边界

Batch A–E 是本全接口诊断设计的**候选整改流**，不是已获准的 implementation package、change
surface 或 package exit。只有在某流保持 confirmed、Dexter 对该小包授权且详情设计冻结后，才可建立
它自己的 implementation manifest；D/E 在此之前分别保持逐项裁决与研究状态。

每个未来小包的 manifest 必须把下列六类 source denominator 与 owning source 写全；它只保留本包实际
changed-path 清单，不恢复旧式 after-hash 或双向 receipt 链：

| 类别 | 必须回答的问题 | 本设计提供的后续 owning source |
|---|---|---|
| `PROJECT_MEMORY_ASSERTION_OCCURRENCES` | 哪些六维路由 memory/架构红线约束本次改动？ | `project-memory/decisions/http-crud-efficiency-design-redlines.md`、kernel owner/transaction/contract 及实际 route recall |
| `APPROVED_ASSERTIONS` | 已确认的用户任务、contract/owner/性能事实是什么？ | 本文 #1–#3 与 source problem family 的对应 finding；UI 变化另重开批准 IA |
| `FORBIDDEN_PSEUDO_FIXES` | 哪些“降次数”会破坏 owner 或正确性？ | 本文 #6 与本流明确反例 |
| `DETAIL_DESIGN_COMPLETION_AND_CHANGED_PATH_CRITERIA` | 什么实作与 focused proof 才算完成，哪些实际路径会被列出？ | 每个被授权小包的 detail design、focused proof 和 changed-path list |
| `OWNED_SURFACE_AND_OPERATION_KEYS` | 哪些 operation/controller/owner API/页面或 runner 是有限分母？ | generated 147-route registry；每个 Batch 下列出的具体 source family |
| `DUE_STANDARDS_RULE_IDS` | 哪些 standards matrix 规则适用，哪些为明确 N/A？ | 当前 package input 的有效 phase 参数；不得从 Roadmap 名称猜 phase |

每个小包在写前重开该项业务/owner/contract/IA（若 UI-bearing）与项目记忆，完成 focused proof 后用相同
输入回读。这里不提前伪造任何 package manifest、运行证明或 exit。

## Batch A — 列表的真实 N+1（P0）

1. **platform workspace list**：asset owner 新增批量 public-reference task API，edge 仅按 page item 映射。输入是页面出现的 assetRef 集合；保留 ACTIVE public URL、缺失/失效语义和 asset owner 权威性。
2. **operations head-company list**：organization owner 新增 `authorizedBrandsByHeadCompanyIds` 型批量 task-read，在 workspace/key/status 谓词内一次载入并按 head company 映射。detail/create/update 不纳入此批次。

proof：分别构造 1、20、50 item page；数据库操作随 page item 数保持常数上界；空 asset/brand、越 workspace、失效 status 与单对象 detail 反例都保留语义。

## Batch B — owner 内一次事实装载（P0）

1. invitation 的 accept/send OTP/verify/save/complete：一次 typed invitation load 传给 private helpers。OTP bucket、CAS、audit、typed errors、完成后的 owner completion readback 不删除。
2. password login、OTP verify、session entry：workspace-iam owner 返回/复用 canonical session entry；edge 不拼 authorization facts。
3. extension initial create / definition replace：extension public command-api 提供窄的 typed validation/normalization result 与 typed failures，宿主 owner 使用 initial INSERT 写 canonical values/revision；不得 import application/repository/entity，不得跨 schema DML。
4. organization hierarchy：仅 owner 内按 Region/Project/phase 行为分支；同构 project phase 使用 bounded batch，不删除 Project readback/CAS/audit。

**extension API closure.** The public normalization result and every public typed failure (including
definition absence) must be declared in `com.catering.v2s.extension.api`; an implementation nested
exception is not a public contract. The finite direct-reference denominator is six production locations:
four cross-module application consumers (`BusinessEntityService`, `OrganizationOverviewTaskReadService`,
`ContractCommandService`, `ContractTaskReadService`), edge mapper `ContractProblemAdvice`, and owner-
internal `ExtensionAuditHistoryService`. The first five must migrate to the API-level failure, with the
edge mapping that exact type. The internal service also migrates to the API type so that the obsolete
application nested failure can be removed rather than remaining an ambiguous second contract. This is
owner-boundary repair, not a new extension business rule.

proof：每种成功、replay、stale、forbidden、disabled/invalid type/revision、OTP/rate limit、缺/过期 token、Region/Project update 变体都有 focused red/green；statement 减少只在业务等价后作为补充断言。

## Batch C — platform context 重用（P1）

枚举九个 platform workspace/role/account mutation controller，复用一次 immutable `PlatformSessionReadback` 构造 edge actor。不得删除下游 owner authorization、对象状态或 version recheck。先扫描所有 `sessions.require` + `requireActor` 同形调用后再改，避免只治疗一个 endpoint。

## Batch D — 稳定 task-read 的逐项读模型裁决（P2）

对 P4 ledger 的十个超默认项逐条写明：用户任务、最大 cardinality、当前 query chain、是否已有 batch、跨 owner 事实、可接受预算或 owner-local read-model 合并方案。只有确认了重复事实或未受限集合才实施；`<=3` 不可作为自动目标，也不允许为了压数量引入跨 schema 大 SQL 或 DTO 拼接。

## Batch E — multi-intent invitation 研究（P3）

先在 full workload 增加 1/N intent、每类 typed failure、role 缺失/不可进入、并发完成与 replay。只有测得线性 owner judgment 且能逐项保留失败归因时，才评估 workspace-iam/role owner 的 `requireAll` 或 batch availability API；否则明确 `NOT_APPLICABLE_WITH_REASON`。

# 5. 验收顺序

1. root contract/registry exact-set green，并保留真实 red mutation；
2. 147-operation workload 清单的 exact coverage green（该项仅证明调用/观察完整性）；
3. 每个 confirmed batch 的 owner/contract/edge focused proof、typecheck 和 relevant existing machine gates；
4. 先读运行日志，后判业务和 cleanup；在动态受管 L2 中报告全接口 coverage 与 cleanup，绝不把静态或 workload coverage 说成业务性能 PASS；
5. 对每个已确认热点进行独立 controlled performance study，再决定是否继续优化；
6. fresh independent DESIGN review（本设计）→ implementation packages 的 independent IMPLEMENTATION review → Dexter/Claude review。

## 5.1 受管执行分类与敏感数据流

The future 147-operation run is an explicitly authorized **HTTP coverage/diagnostic integration run**.
It is neither browser L2 nor a user Journey/business PASS. It may establish its own isolated facts by
approved owner commands, produces only coverage/diagnostic and cleanup outcomes, and must not become
DEV start or an implicit Seed. Browser L2 remains a separate local frontend + Playwright proof for an
approved Journey and its IA; performance study remains a third, separately authorized measurement run.

The future workload inventory is declarative and contains only operation metadata, non-sensitive
template shape, symbolic secret handles and expected outcome category. Passwords, OTPs, invitation
tokens, cookies, Authorization headers and identity values are generated per run or supplied through a
managed secret channel directly into the in-memory request client. They must never be written to the
inventory, manifest, fixture receipt, request/response dumps, stdout/stderr, structured logs, report,
error detail or cleanup artifact. Cookie jars and raw response bodies stay in memory and are discarded
at run cleanup. Before any dynamic implementation, focused red proof must show that an attempted write
of each secret category to every persisted/output surface fails or is redacted; non-sensitive path/query
templates are the explicit counterexample.

# 7. Round-2 author disposition (final cycle)

`S2=CONFIRMED` from independent Round 2: §3.2 previously still prescribed frontend/Playwright for the
raw route workload. The corrected text now makes the process and result boundary mutually exclusive:
HTTP diagnostic uses backend/tunnel only and reports coverage/diagnostic plus cleanup; browser L2 uses
frontend/Playwright only when an approved Journey has its own interaction oracle.

`S3=CONFIRMED` from independent Round 2: four cross-module application consumers were an incomplete
direct-reference denominator. The corrected denominator is all six production direct references,
including the edge problem mapper and owner-internal audit service; the chosen minimal repair is one
API-level typed absence failure and removal of the application nested public escape. This avoids both a
second contract and a hidden edge mapping fall-through. No source code is changed by this design
disposition.

This document remains design-only. Round 2 is the hard stop for this design cycle; a separately
authorized implementation package must receive its own independent IMPLEMENTATION review.

# 6. 明确不做

- 不恢复已经暂停的 Seed-only P0 package，也不把此前 23 个候选直接改成生产 SQL。
- 不删除 idempotency、CAS、audit、rate limit、session/authorization recheck、owner final readback 或安全 typed failure 来降低计数。
- 不把 statement count、平均时长或成功的 Seed/fixture report 说成全接口性能、business PASS 或 cleanup PASS。
- 不引入全局 ORM cache、跨 owner repository import、edge 拼 owner truth、跨 schema DML、MQ/outbox/polling，或没有 workload 的抽象 batch API。
