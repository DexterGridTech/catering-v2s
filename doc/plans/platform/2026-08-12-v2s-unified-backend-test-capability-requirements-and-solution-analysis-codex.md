---
title: catering-v2s 统一通用后台测试能力：需求分析与解决方案分析（Codex 独立稿）
status: PROPOSED_FOR_INDEPENDENT_MERGE
date: 2026-08-12
packageId: UNIFIED-BACKEND-TEST-CAPABILITY-ANALYSIS-20260812
implementationAuthority: false
runtimeAuthority: false
seedResetAuthority: false
author: Codex
independence: 本文在 Claude 独立稿产生前形成；未读取或继承 Claude 对本议题的结论
---

# SUPERSEDED — 2026-08-14 Dexter 裁定：provider/registry 是待办目录，不是 scenario 实现；当前唯一目标是 getPublicInvitationView 的真实 HTTP CONTRACT/BUSINESS 断言与信息性 DB 调用数。

不得再以本文重开 package entry/exit、P0/W0/P1、receipt、hash-chain 或 successor I0；保留的历史 scenario、lane 与测试骨架不构成本批交付。

# 1. 结论先行

Dexter 的目标可以实现，而且应该收敛成一个公开的**后台 API 行为验收能力**：它从当前 HTTP 契约动态发现全部后台 operation，在真实 Spring Boot + PostgreSQL/对象存储依赖上，通过真实 HTTP 执行 source-based 场景，并在同一次场景中同时判定：

1. HTTP 请求、成功响应和错误响应是否符合 OpenAPI/Problem 契约；
2. 业务结果、拒绝语义、owner readback、幂等/CAS/重放/权限等是否正确；
3. SQL、连接借用、事务、批处理及稳定的耗时指标是否满足已接受预算。

本方案的专业裁决是：

- **保留 Testcontainers，但把它降为统一验收能力内部的隔离基础设施**；用户和日常命令只面对一个能力命名的后台 API 测试入口，不面对“196”“P4”“性能 lane”等历史实现细节。
- **不新建一套与 Testcontainers 并列的共享 test seed 测试体系**。测试数据分成可复用的 lane baseline 与场景 fixture，并在 Testcontainers 隔离环境内创建；它们不是长期共享数据库中的 seed。
- **完整 DEV seed 只负责提供可体验数据并完成创建/readback**。seed 的 duration 和数据库计数只用于诊断，不再参与功能覆盖或性能 GO/NO-GO。
- **“196”只能是某一时点由契约计算出的快照数量，不能继续出现在长期 runner、类名、计划 ID 或验收分母中**。
- 自动化的边界是“自动发现、自动纳入、缺项自动红”，不是根据 operation 名称猜测业务请求、fixture 或正确结果。新增 operation 若缺少任一 source-based 场景、fixture、契约断言、业务 oracle、性能预算或 cleanup，必须在昂贵环境初始化前 fail closed。

本文是需求与方案分析，不是 implementation-facing 详设，不授权改 runner、测试、契约、生产源码或项目记忆，也不授权 Testcontainers、DEV、reset、seed、L2、UAT 或部署。

# 2. 原始问题和真正目的

## 2.1 用户提出的不是“如何写 test seed”，而是统一证明问题

Dexter 要解决的是后台测试事实分裂：测试种类多、分母不同、覆盖不全、绿灯含义互不相同，而且历史数字会随接口增长失效。实现方式必须服务于以下目标：

- 一个新接口不能因为没有人记得修改某个固定清单而逃出测试；
- 一次 HTTP 行为不能出现“形状在 A 测、业务在 B 测、性能在 C 测”，最后三者没有同一次请求与同一 fixture 的关联证据；
- 测试应在代码交付前暴露功能和性能回归，而不是等 DEV seed 或人工页面体验放大问题；
- 失败必须能定位到 operation、scenario、request、业务 oracle、数据库预算和 cleanup；
- DEV seed 保持单纯：为前台体验提供完整数据，不承担测试覆盖率或性能验收。

## 2.2 本次 DBCR 包已经终止

Dexter 已明确终止 `DB-CALL-REDUCTION-IMPLEMENTATION-20260812`，不得把它强行完成、伪造 package exit 或请求 implementation review。终止证据位于：

- `doc/evidence/platform/2026-08-12-v2s-db-call-reduction-implementation-termination.json`
- 状态：`TERMINATED_BY_DEXTER_SCOPE_REFRAME`
- 已有改动按终止时工作区事实保留；本分析不回滚、不继续实施，也不把其中任一局部 PASS 表述为完成。

# 3. 当前代码与测试环境的事实快照

以下数字是 2026-08-12 当前源码快照，不是未来常量。

## 3.1 当前 HTTP operation 宇宙

| 来源 | 当前数量 | 角色 |
|---|---:|---|
| `edge-route-face-registry.json` | 154 | general edge 的生成投影 |
| `catalog-inventory-edge-route-registry.json` | 42 | catalog/inventory edge 的生成投影 |
| 两者去重 union | 196 | 当前 HTTP operation 快照 |
| `operation-handler-bindings.json` | 196 | 当前 handler/binding 投影 |

当前 union 与 bindings 的 operationId 集合精确相等，但 `scripts/check/operation-handler-bindings` 当前另有 `BP_U02_ROUTE_SOURCE_DIGEST_DRIFT`，说明 metadata 仍有漂移。这个现状恰好证明：未来统一分母不能从某个历史 PASS 报告或字面数量继承，必须每次从当前权威源重算并校验投影新鲜度。

长期 operation identity 至少为：

```text
operationId + HTTP method + normalized path + consumer face + owner
```

其中 `x-consumer-faces` 继续是 HTTP 暴露面的单一真相；`operationId` 只是稳定主键，不能单独证明 route、face 或 owner 未漂移。

## 3.2 当前 Java 测试并不是一个分母

当前 `apps/backend/**/src/test/**/*.java`：

- Java test source：118 个；
- 含 `@Test`：109 个；
- 含 `@Testcontainers`：19 个；
- 含 `@SpringBootTest`：2 个；
- 含 `@ArchTest`：1 个。

这些是**测试源码分类数量**，不是 HTTP operation 覆盖证明。19 个 Testcontainers 类自动发现机制只能证明“所有带该注解的类被调度”，不能证明每个当前或未来 HTTP operation 都有契约、业务和性能场景。

## 3.3 当前远端 Testcontainers runner 的可复用能力

`scripts/test/r5-remote-testcontainers.mjs --all` 已经提供值得保留的执行底座：

- 从源码自动发现当前 `@Testcontainers` 类；
- 三个隔离 daemon lane；
- 每 lane 只初始化一次工作区/依赖，lane 内串行；
- 初始均衡分配并支持 work stealing；
- 一个 lane 首败后只停止自己的后续项，其他 lane 继续收集各自首败；
- 有进度、heartbeat、run manifest、business 与 cleanup；
- 禁止把 Gradle cached/up-to-date/skipped 当作执行成功。

应复用这些运行治理，但未来 runner 的工作分母必须从 HTTP operation/scenario contract 派生，而不是把“19 个测试类都跑了”当成后台接口覆盖率。

## 3.4 历史 196 lane 的真实能力与缺口

历史 `backend-performance-testcontainers-196` 并非完全无用。当前最新 PASS 报告证明它已经：

- 通过真实 HTTP 执行当前 196 个 operation；
- 对齐 operation、route、owner、consumer face、request/completion/database attribution；
- 记录 `CONNECTION`、`QUERY`、`TRANSACTION`、`UPDATE`、logical statement 等数据；
- 分 14 个场景、396 个 fixture row，并验证执行集合与 cleanup。

但它的长期结构有三类根本问题：

1. runner、Java bridge、计划和断言硬编码 `196/14/396/10` 等快照数字；
2. `validateDynamicReport` 只验证指标存在且汇总自洽，不把每个 operation 的数据库指标与 accepted budget/ratchet 比较；
3. `http-diagnostic-scenarios.mjs` 中许多 `oracle` 是 source-based 文字声明，当前动态 PASS 的机械判据主要是 HTTP 成功、completion 与集合覆盖，不等于每个 operation 都真实执行了响应 shape、字段语义和 owner readback oracle。

因此，正确处置不是删除全部资产，而是把其中 HTTP workload、相关性、隔离运行、数据库观测和 cleanup 能力迁入通用模型；把数字命名、固定分母和只收集不裁决的部分退役。

## 3.5 P4 SQL budget 也是局部分母

`P4SqlOperationBudgetTest` 当前由 canonical ledger 驱动：28 个 ledger row、26 个 caller symbol、52 个 case，使用 `EXACT_SQL_STATEMENTS` 比较真实 SQL 语句数。它能保护已登记方法，却不是 HTTP operation 全集：

- 分母是方法/case，不是全部 OpenAPI operation；
- 只覆盖已登记 caller；
- 不能天然证明 HTTP 契约与最终业务结果；
- 只看 SQL statements 时，可能看不见连接借用与事务边界的反向变化。

它的 CountingDataSource 和 accepted-baseline/ratchet 思路应被复用；独立的 P4 验收事实最终应迁入统一 scenario budget，而不是永久保留第二套性能结论。

# 4. 为什么问题直到 seed 才暴露

这是本方案必须闭合的关键因果链，而不是一句“测试不全”。

## 4.1 时间事实

- 最新历史 196 Testcontainers PASS 报告时间：2026-08-12 03:31（韩国时区）；
- `CatalogInventoryCoordinator.java` 在 DBCR 中的事务变更时间：2026-08-12 20:49；
- 暴露问题的 catalog/inventory seed 报告时间：2026-08-12 21:52。

所以至少存在第一层直接原因：**当前所引用的 196 PASS 是生产代码变更前的旧运行，不能证明变更后的字节**。本次变更后没有先完成 source-hash 绑定的 affected/full Testcontainers 再运行。

## 4.2 即使重跑旧 196，也仍可能假绿

更深的原因在判据而非时间：

- DBCR 移除 readOnly 事务后，业务结果仍成功，QUERY 与 UPDATE 没有增加；
- 但多个 JdbcTemplate 查询失去同一事务连接绑定，每个查询独立借连接；
- 对 `getOperationsCatalogItem`，同样 187 次调用的变化为：
  - CONNECTION：561 → 1309（+748）；
  - TRANSACTION：748 → 374（-374）；
  - QUERY：1870 → 1870；
  - UPDATE：0 → 0；
  - 每次 database operation count：17 → 19。
- 旧 196 的单次报告已经能记录 `connectionBorrowCount` 等字段，但 validator 没有 per-operation accepted budget，因此“指标更差但格式完整、总数自洽”仍会 PASS；
- U01 topology test 只断言 16 个 coordinator 调用时没有 active transaction，证明了设计动作发生，却没有证明其资源后果可接受；
- P4 没有覆盖这 16 个受影响 HTTP 调用链，也没有把 connection/transaction 与 SQL 一起作为多指标预算。

## 4.3 seed 只是放大器，不是检查方法

catalog seed 为创建和 readback DEV 数据，对 `getOperationsCatalogItem` 重复调用 187 次，于是连接浪费被放大并在运行统计中明显出现。它只是恰好观察到结果：

- seed 没有完整 HTTP operation 分母；
- seed 的 fixture 由 DEV 体验目标决定，不由测试覆盖目标决定；
- seed 的重复次数与顺序不是稳定性能基准；
- seed wall-clock 会受网络、媒体、远端负载和数据量影响；上述回归中 catalog 总时长甚至从 399767ms 降到 314740ms，说明“总耗时变快”不能推翻连接回归。

结论：前置未发现是**新源码没有绑定 fresh Testcontainers 证据 + 旧 Testcontainers 只有观测无 per-operation 性能 oracle + 局部 topology/P4 分母没有覆盖同一 HTTP 行为**共同造成的。seed 不应被改造成检查工具，正确修复点是统一 Testcontainers 判据。

# 5. 方案比较与裁决

## 5.1 方案 A：放弃 Testcontainers，建设长期共享 test seed + 测试环境

优点：看起来与 DEV seed 类似，HTTP 测试可以直接使用一套准备好的数据。

拒绝原因：

- 数据会跨 run 污染，测试顺序和历史状态进入结果；
- 三个 lane 难以真正隔离，并行运行会互相影响；
- cleanup、幂等、CAS、时钟与唯一键失败难以复现；
- PostgreSQL/对象存储版本和配置漂移难以绑定；
- “test seed 是否新鲜”会成为新的假绿入口；
- 功能和性能都需要可重复的初始状态，共享长期库正好破坏这一条件。

因此不采用。

## 5.2 方案 B：所有测试一律改成 Testcontainers

它把纯算法单元测试、编译、ArchUnit、静态契约 gate 也全部塞进容器。

拒绝原因：这会让分钟级静态反馈变慢，且没有增加业务证明。`BigDecimal` 计算、parser、纯 state transformation 等确定性逻辑不需要数据库容器；编译、OpenAPI exact-set、模块依赖规则也不应伪装成动态业务测试。

因此“后台测试只有一类”的准确边界必须是：**后台 API/数据库/事务/owner 行为验收只有一个 Testcontainers 系统**；编译、静态契约、架构和纯函数单元测试继续作为工程控制存在，但不再各自产生“后台功能已通过”或“后台性能已通过”的竞争结论。

## 5.3 方案 C：一个后台 API 验收系统，Testcontainers 作为内部基础设施

采用。它同时满足：

- 对用户只有一个日常测试入口和一个权威 verdict；
- 对工程内部保留快速静态/单元反馈；
- 同一 source-based scenario、同一 fixture、同一次 HTTP interaction 同时产生契约、业务和数据库性能证据；
- 每次 run 隔离、可重复、可 cleanup；
- 可复用当前三 daemon runner 和 diagnostics 观测能力；
- 可从契约自动发现未来 operation，不依赖固定数量。

# 6. 目标模型

## 6.1 一个公开入口、一个权威 verdict

公共入口应使用能力命名，例如：

```text
scripts/test/backend-api
```

具体名字留给 implementation-facing 详设裁决，但禁止包含 `196`、Roadmap/Journey ID 或“performance-only”。默认 full 模式输出：

```text
CONTRACT=PASS|FAIL
BUSINESS=PASS|FAIL
PERFORMANCE=PASS|FAIL
CLEANUP=PASS|FAIL
OVERALL=PASS|FAIL
```

任何一项 FAIL，OVERALL 必须 FAIL。不能用功能 PASS 覆盖性能 FAIL，也不能用业务 PASS 覆盖 cleanup FAIL。

## 6.2 动态、未来安全的 operation denominator

每次测试启动前，从当前 OpenAPI root、`x-consumer-faces` 和生成 route/binding 投影重算 operation universe：

```text
HTTP_OPERATION_DENOMINATOR = current authoritative operations
```

不保存 `expectedOperations: 196`。报告可以输出 `discoveredOperations: N` 作为本次诊断值，但所有集合校验基于实际 identity rows，而不是 N。

必须 exact-set 对账：

- authoritative OpenAPI operation ↔ route registry；
- route registry union ↔ handler bindings；
- operation denominator ↔ scenario registry；
- operation denominator ↔ execution receipt；
- operation denominator ↔ contract/business/performance result。

unknown source、重复 identity、缺 binding、陈旧 digest、缺 scenario、孤儿 scenario 都必须在启动 Testcontainers 前失败。

## 6.3 每个 operation 的统一 scenario contract

每个 operation 至少声明：

```text
identity:
  operationId, method, normalizedPath, consumerFace, owner
source:
  OpenAPI operation, owning controller/operation/owner, business requirement
fixture:
  laneBaselineRefs, scenarioFixtureRecipe, prerequisiteHandles
request:
  explicit path/query/header/body builder, auth/session context
contractOracle:
  status, content-type, success/error schema, envelope/problem shape
businessOracle:
  semantic fields, owner readback, required state transition or no-change
correctnessCases:
  applicable authorization, rejection, idempotency, CAS, replay, scope
performanceBudget:
  accepted baseline and ratchets
cleanup:
  owned database/assets/session/resources and verification
```

自动发现不能猜业务请求。新 operation 被发现后，如果 source owner 尚未提供这些声明，应以 `SCENARIO_REQUIRED` 一类 typed failure 阻断，而不是生成空 body、只看 2xx 或静默跳过。

## 6.4 一次场景如何“一箭三雕”

一次 canonical interaction 的证据链为：

```text
fixture receipt
  → real HTTP request
  → OpenAPI request validation
  → HTTP response
  → OpenAPI/Problem response validation
  → explicit business oracle + owner readback
  → request/completion/database attribution
  → per-operation performance budget
  → cleanup receipt
```

接口形状不是只比较生成类型，而是对真实 HTTP wire 做 request/response schema validation。业务不是只看 2xx，而是执行字段、状态和 owner readback oracle。性能不是另造 workload，而是对同一次 canonical HTTP interaction 关联数据库指标。

对于吞吐、尾延迟等需要样本的指标，可以在同一 scenario/fixture 下增加预热和重复采样 phase，但仍复用同一业务 oracle、operation identity 与统一报告，不建立第二套“性能测试”。

## 6.5 性能预算必须多指标且可审计

每个 operation 的 canonical budget 至少处置：

- logical SQL statements；
- QUERY；
- UPDATE；
- CONNECTION borrow；
- TRANSACTION；
- JDBC batch/批量退化；
- 适用的 read budget、rows/shape 约束；
- duration/percentile（仅在环境、样本和波动策略足以稳定判定时）。

数据库计数类指标可使用 exact 或 upper-bound ratchet。时延不能把单次远端 wall-clock 当确定性门，应采用预热、样本、分位数、允许噪声边界，并把环境/容器/代码/fixture hash 绑定到报告。任何预算上调都需要独立 accepted baseline 或显式已批准 disposition；不能改当前值使测试自绿。

`getOperationsCatalogItem` 的 CONNECTION 3 → 7、QUERY 不变就是强制 red mutation：若只检查 SQL 或总耗时，该反例必须证明门会失败。

## 6.6 测试数据：Biz seed 与 Test fixture 分权

### Biz seed

- 唯一用途：给受管 DEV 环境准备完整、可长期体验的数据；
- 验收：计划内数据创建成功、owner readback 成功、DEV 状态保留；
- 日志：可保留阶段耗时和数据库计数用于诊断 runner 自身；
- 禁止：作为 HTTP 覆盖、业务回归、性能预算或 release verdict。

### Test fixture

- 运行在 Testcontainers 隔离环境；
- 每个 daemon lane 只初始化一次最小公共 baseline，例如身份、workspace、必要组织拓扑；
- 每个 scenario 创建自己拥有的最小业务数据，并记录 opaque handles；
- scenario 不得依赖另一个 scenario 的执行顺序或未声明副作用；
- secrets/raw payload 不进入报告；
- cleanup 按 run/lane/scenario ownership 验证。

它可以口语上称为 test seed，但工程上不应复刻一份完整 DEV seed，也不应成为独立公共命令。更准确的名称是 `lane baseline + scenario fixtures`。

## 6.7 Runner 执行模型

复用现有三 lane 能力：

1. parent 从当前 operation/scenario denominator 生成工作项；
2. 三个隔离 daemon 各初始化一次 Testcontainers 环境；
3. lane 内串行，lane 间并行；
4. 初始均衡分配，空闲 lane 从尚未开始的队列动态领取；
5. 某 lane 首败后停止该 lane 的后续项，但其他 lane 继续跑完并保留各自首败；
6. parent 汇总 contract/business/performance/cleanup；
7. 根因修复后默认 fresh full rerun，确保共享 fixture/contract/runner 影响没有被错误跳过。

未来若要“跳过已双 PASS 项”，只能另行设计 source/fixture/runner/contract/budget 的完整 impact hash 和 fresh-environment 证明；当前不得按 operationId 或旧 PASS receipt 直接跳过。

## 6.8 错误与进度可观测性

runner 必须持续输出：

- run/lane ID、开始时间、初始化阶段和耗时；
- discovered/scenario/current/completed/passed/failed/remaining；
- 当前 operation/scenario；
- 每 30 秒 heartbeat 与最近完成项；
- first failure：稳定错误码、operation identity、失败 boundary、脱敏摘要和 log path；
- lane business 与 cleanup；
- 总 business/performance/cleanup。

失败不能只显示 Gradle 类名或“196 workload failed”。

# 7. 自动接纳未来接口的 fail-closed 规则

新增 OpenAPI operation 后，不需要人工修改某个 expected count，但必须触发以下状态机：

1. operation 自动进入 authoritative denominator；
2. route/binding projection 未同步：静态前置红；
3. scenario contract 缺失：静态前置红；
4. fixture/request builder 缺失：静态前置红；
5. contract oracle、business oracle、performance budget 或 cleanup 缺失：静态前置红；
6. 全部具备后自动进入 runner queue；
7. 未产生 execution receipt 或任一 verdict：动态 exact-set 红。

同样，删除 operation 后留下的 orphan scenario、fixture、budget、workload recipe 必须红，避免陈旧测试资产继续制造“有测试”的错觉。

# 8. 测试资产处置与迁移方案

实施前必须先做 assertion-level inventory，而不是按文件名批量删除。每个现有测试/fixture/budget/runner 得到有限 disposition：`MIGRATE / RETAIN_AS_ENGINEERING_CONTROL / RETIRE_AFTER_PROOF_MIGRATION / DEBT_WITH_REASON`。

建议单批顺序如下：

## UBT-01：冻结真相与建立动态分母

- 固化 authoritative HTTP source manifest；
- 消除 operation/binding digest 漂移；
- 生成不含数量常量的 operation denominator；
- 用新增/删除/重复 operation 真变异证明 exact-set。

## UBT-02：统一 scenario schema 与静态 admission

- 建立 operation → source/fixture/request/oracles/budget/cleanup contract；
- 迁移现有 `http-diagnostic-scenarios` 的 source facts；
- 未知 future operation fail closed；
- 禁止 route/body/name inference。

## UBT-03：统一 HTTP 契约与业务 oracle

- 在真实 HTTP wire 上校验 OpenAPI success/error shape；
- 将当前只写散文的 oracle 落为可执行断言；
- 引入 owner readback、拒绝/no-change、幂等/CAS/重放等适用 cases；
- 迁移现有 19 个 Testcontainers 类中真实独有的行为断言。

## UBT-04：统一性能 budget 与观测

- 复用 diagnostics attribution 和 CountingDataSource；
- 把 P4 accepted baseline 映射到 operation/scenario；
- 为当前 operation 补全多指标 baseline 与批准语义；
- 证明 connection 上升而 SQL 不变会红。

## UBT-05：通用 runner 与报告

- 将三 daemon 调度从测试类分母升级到 scenario work item 分母；
- 输出统一 contract/business/performance/cleanup verdict；
- 保留资源预检、heartbeat、first failure 和 cleanup。

## UBT-06：历史资产迁移与退役

- 将 `BackendPerformanceTestcontainers196Test`、`backend-performance-testcontainers-196*`、硬编码计划/报告 ID 改为能力命名；
- 只有 current operation、fixture、oracle、budget、execution 和 red mutation 做完 findings/prevention set equality 后，才删旧 196 控制；
- P4 standalone 只有在全部有效 cases 迁入统一 budget 后才退役；
- 19 个 Testcontainers 类逐断言迁移，不能因“统一入口”丢掉独有 correctness proof；
- static/compile/ArchUnit/纯函数单元测试保留为工程控制，但不得再宣称后台行为或性能整体成功。

## UBT-07：seed 去测试化

- 完整 `r5-full` seed 保留 DEV 数据职责；
- seed plan 不再承担全接口 preflight；
- seed report 不再给出性能 GO/NO-GO 或测试覆盖结论；
- 历史 seed performance comparator 只有在 Testcontainers 已有等价预算证明后才退役；
- seed 慢仍可作为 seed runner 的可观测性问题诊断，但不能反向成为产品接口性能门。

# 9. 必须存在的真实 red mutations

1. OpenAPI 新增 operation、无 scenario：前置红；
2. operation 有 scenario 但缺 fixture 或 request builder：前置红；
3. 删除真实 response shape/Problem 校验但仍返回 2xx：红；
4. 删除业务字段/readback oracle、只看成功状态：红；
5. performance budget 随当前值一起调高、无 entry/accepted authority：红；
6. `getOperationsCatalogItem` 模拟 QUERY 不变但 CONNECTION 3 → 7：红；
7. operation 未产生 execution receipt，或只产生 contract 而无 business/performance result：红；
8. 删除 operation 后遗留 orphan scenario/fixture/budget：红；
9. 将动态 denominator 改回 `196` 或只比数量不比 identity rows：红；
10. 一个 lane 首败导致其他 lane 被 parent 取消：runner self-test 红；
11. cleanup FAIL 但 overall PASS：红；
12. 引用 seed report 作为 contract/business/performance PASS 依据：验收红。

# 10. 统一验收条件

未来实施只有同时满足以下条件才可 GO：

- 当前 authoritative operation universe 动态派生，无任何历史数量常量参与判定；
- operation、binding、scenario、fixture、request builder、contract oracle、business oracle、performance budget、cleanup 与 execution receipt 全部 exact-set；
- 所有真实 red mutations 能拒绝对应缺陷；
- 每个 current operation 的 canonical HTTP 场景同时产生 contract、business、performance verdict；
- 所有 lane business PASS，所有 performance budget PASS，所有 cleanup PASS；
- 报告能从 operation 定位 first failure 和日志；
- 新 operation mutation 能自动进入分母并因缺场景而 fail closed；
- seed 不出现在统一后台测试 verdict 的 source list；
- 不以静态 gate、编译、测试类数量、旧 PASS report 或 seed PASS 代替 fresh 动态结果。

# 11. 范围外与后续决策

本需求不要求：

- 将所有纯单元/编译/架构检查容器化；
- 用自动生成器猜测业务 request 或 oracle；
- 本轮运行 Testcontainers、DEV、reset、seed、L2 或 UAT；
- 本轮修复已终止 DBCR 代码；
- 本轮决定 wall-clock budget 的具体统计阈值；该项须在详设中基于环境与样本设计；
- 本轮立即删除任何 196/P4/seed 资产。

# 12. Claude 独立稿与合并协议

Claude 应独立形成：

`doc/review/platform/2026-08-12-v2s-unified-backend-test-capability-requirements-and-solution-analysis-claude.md`

在其产物形成前不得读取本文。两份独立稿都完成后，再由 Codex 逐条建立：

```text
Codex requirement/solution
Claude requirement/solution
共同事实
冲突点
更小替代与反例
最终 disposition
```

并生成唯一合并稿：

`doc/plans/platform/2026-08-12-v2s-unified-backend-test-capability-merged-requirements.md`

合并稿仍只是需求，不自动授权 implementation-facing 详设、实施或动态运行。

# 13. 本文复算输入

关键当前字节：

- `contracts/openapi/edge.openapi.yaml@e8a13db8a95bfd1e3436a3701a37fecfbf92d68cf4a40cedde4743bebebd2033`
- `contracts/openapi/catalog-inventory.openapi.yaml@f00ef04d206b3eab65bda62e95a66b9fa0686f1859cf530ed58463cbf666e21d`
- `edge-route-face-registry.json@1f7900fb24b930dfb41fd5c73659a094c75f7e4e827de1ecd2e763596d7e2824`
- `catalog-inventory-edge-route-registry.json@8770dac5dc4a2ba9609e8e2d63da9749a4e20333b531c4f3891fd68ff09c3df2`
- `operation-handler-bindings.json@13f08da276c5ca943836651a83c181fd9ccd76bae0f87b7c29cd1fd1b1c4ae81`
- `scripts/test/r5-remote-testcontainers.mjs@2e8f59e5a51737d7e1226293c7ba35d5fd35ac8d9a68e9991076d2972e737e2b`
- `scripts/test/backend-performance-testcontainers-196.mjs@f39e314a46740455db417950c30e8b7fe034537789bd04219f43636cff85656d`
- `scripts/test/backend-performance-testcontainers-196-remote-workload.mjs@21d2581de66f624460992a16786cafa5ff041f57099d7999720017f22a282202`
- `scripts/test/http-diagnostic-workload.mjs@d15223ec8f2737e63b00c3791ee7a29f0326adb38ea8ef385b7fb9e092671b77`
- `scripts/test/http-diagnostic-scenarios.mjs@13a6e9ac16df24af852bee877e2064c8263b9e36c477ea557a03b2f9baed932e`
- `BackendPerformanceTestcontainers196Test.java@62007f1b45d955086ab410e873fdf97585c9338a04f8bf35ec7be6c52c4e8676`
- `P4SqlOperationBudgetTest.java@a78f60f4beac55ba8a22361ecabd39e6acac6ba17343ee8c25fc4a7096337a88`
- `CatalogInventoryReadTransactionTopologyTest.java@a67dff42eac1c84229f7a33518b525b9e16344ddbb1d916491a5f9aa7faae059`
- `canonical-performance-ledger.json@d3cc91476c4f6a2e0d0d7ccbf3a6bb2082e4ca05f08ceabf0e67ab58a43fe9c0`
- `canonical-performance-accepted-baseline.json@abd4792942ec365265c1634f9d61445b3a5e4a0b65234794334c3121f411b8be`
- latest referenced 196 report `@91bb5e8ced11703b9a641626284e7abf63aaa22091cc2e31f5f2173231d603d6`
- regression catalog seed report `@fc93e404671247731bd52f8669d7bcdc59a56a52003086702ef5d0fa341ab25f`

项目记忆路由：`task-kind=review, domain=backend, consumer-face=backend, owner=backend, impact=governance, trigger=failure`。本文服从 `test-closed-loop`、`verification-governance`、`http-crud-efficiency-design-redlines`、`phase-retrospective-and-systemic-repair`、`deterministic-context-only`。

`SKILL_USED=cs-brainstorming@4a54a4858b99807f3155ed1614b2f116e35ea5c1b788e793f565dd837fd3891f`

# 14. 授权边界

本轮只完成静态需求分析与解决方案分析。没有运行 Testcontainers、DEV、reset、seed、L2、浏览器、UAT、部署或手工 SQL；没有宣称动态、业务、cleanup 或性能成功。任何后续合并、详设、实施、运行和退役动作都需要按 Dexter 后续明确节奏与授权执行。
