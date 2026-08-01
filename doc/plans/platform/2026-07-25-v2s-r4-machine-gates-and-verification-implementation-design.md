---
title: catering-v2s R4 whole-scope machine gates and verification implementation design
status: PROPOSED_REVIEW_ONLY
createdAt: 2026-07-25
programId: V2S_W0_W4_EXECUTION
roadmapStep: R4
implementationAuthority: false
reviewTarget: DESIGN
reviewCycleId: R4-W2-DESIGN-20260725
skillUsed: cs-spec-to-plan@local
---

# R4 whole-scope machine gates and verification implementation design

## 0. 结论、真实任务和边界

R4/W2 的真实消费者不是终端业务用户，而是 Dexter 负责的快速迭代工作流：
在下一波业务迁移前，Codex/Claude 需要能用一个短命令发现结构、契约、数据库、
安全、生成面和退役路径的确定性回归。R4 不产生新的业务成功结果，因此在
Journey inventory 中保持 `NOT_A_BUSINESS_JOURNEY`，不编造 actor、登录或 UI。

Dexter 的阶段意图是用分钟级、provider-free、run-scoped 的验证网降低 AI 改动的
返工成本；验证网必须比人工全量回归便宜，不能演化成 CI 平台或第二套业务运行时。

### 0.1 方案合理性与替代方案

推荐方案是 **一个 `scripts/verify` 入口 + 小型原生 validator + 真红变异 + 独立语义复核**：

1. 每类机械事实只有一个 owning validator；`scripts/verify` 只编排并聚合，不复制规则；
2. 每个新门共享 production path 与 self-test 核心，并至少有一个会改变判定结果的 red mutation；
3. Testcontainers 只建立临时数据库，静态门不启动浏览器、持久 DEV 或 seed；
4. 语义合理性、业务用户行为和 severity 保持在 Codex 自审、Claude review 与 Dexter 决策面。

不选“R5 迁移时再测”：失败发现太晚，会把结构错误扩散到多个模块和页面。不选“一个巨大
语义 checker”：不可一行解释、难以证明盲区，且维护成本会使它被绕过。不选“为每条规范
创建独立服务/平台”：增加 R4 自身的拓扑和生命周期，违背当前单 deployable 与轻量阶段策略。

### 0.2 设计授权与实施授权分离

本文件和其 manifest 只授权形成 implementation-facing 计划；
`implementationAuthority: false` 是硬边界。当前 `R4_DESIGN_AUTHORIZED=true`，
`R4_IMPLEMENTATION_AUTHORIZED=false`。设计完成、机器门设计期检查通过或 Claude review
给出 GO，都不能替代后续 exact implementation authorization。

## 1. R4 目标形态

```text
frozen source / current production tree
              |
       native validators
  (security, db, arch, contract, UI boundary, retirement, logging)
              |
       scripts/check/standards-coverage --phase R4
              |
       scripts/verify (one deterministic entry)
              |
  static report + temporary Testcontainers report + affected-L2 map
```

`verify` 的输入是当前仓内源码、冻结 contract/registry/matrix 和临时测试资源；它不
读取 Heritage 运行时代码，不写 DEV 数据，不 seed，不依赖端口，不通过进程名清理资源，
也不把静态 PASS 升级为 walking/L2/L3 或 business PASS。

R4 机器分母来自 `contracts/policy/standards-coverage-matrix.json` 的 150 条结构单元。
设计期 `PLANNED` 是诚实状态；只有实现期 production validator、真实 red mutation、
标准入口和 fresh evidence 全部存在，才能将对应条目转为 `ACTIVE`。本轮
`scripts/check/standards-coverage --phase R4` 的 FAIL 是未实施分母到期的预期红灯，不作伪修。

## 2. 全范围实施单元与严格顺序

实施按下列串行单元一次性完成 R4；单元是内部证据边界，不是独立 R4 交付或独立 review。

### R4-U01 — 标准分母、gate catalog 与 phase closure

**目的**：让 Part B.1–B.6、Part C、Part D.1–D.8 每一条规则都有稳定 ID、原文 hash、
memory anchor、machine/review destination 和实施期状态变化。

**实现**：保留 standards matrix 作为分母唯一来源；补齐 R4 gate catalog/manifest
绑定与 `scripts/check/standards-coverage --phase R4` 的执行入口；只把真实存在并由
production validator 驱动的条目标为 `ACTIVE`。`UNENFORCEABLE_BY_MACHINE` 仍必须有
明确 checklist，不得用文字扫描冒充语义理解。

**到期校正吸收**：实施时逐条把 12 条 `ARCHUNIT` enforcement ref 从旧
`apps/backend/src/test/java/architecture/BackendModuleBoundariesTest.java` 校正为当前
`apps/backend/catering-business-server/src/test/java/architecture/BackendModuleBoundariesTest.java`；
并按 R2 acceptance 的 standards N-2 逐条复核 `D.4.L03` 与 `B.3.N06–B.3.N12` 的
enforcement kind。仅当对应 production gate/negative fixture 真正存在且能真红时才可改为
`ACTIVE`；不得以空断言、错误 `ARCHUNIT` 分类或 status-only edit 凑 phase closure。

**路径**：更新 `contracts/policy/standards-coverage-matrix.json`；更新
`scripts/check/standards-coverage`；创建 `contracts/policy/r4-gate-catalog.json`
（若实现需要），创建 `doc/evidence/platform/r4-standards-coverage-evidence.json`。

**顺序/失败**：U01 必须先于所有 R4 production gate；source hash、rule count、
enforcement ref 或 phase 发生漂移即 fail closed。只修改 status 不创建 gate、只新增
fixture 不接入 `run()`、把人审 checklist 改成关键词 checker 都是禁止伪修。

**证据**：L1 是分母/hash/引用对账；L2/L3/business 不适用；cleanup 是 scratch
fixture 与临时报告清理 PASS。当前 R4 无业务 Journey，business 明确记录
`NOT_APPLICABLE_R4_TECHNICAL_STEP`。

### R4-U02 — 后端 ArchUnit、模块依赖与 owner 边界

**目的**：将 module imports、domain/repository 可见性、command transaction、
coordinator 零资产、listener 白名单、API 类型和 dependency registry 三方现实对账
变成 production-driven 的后端门。

**实现**：建立 `BackendModuleBoundariesTest`/ArchUnit 规则，读取
`contracts/policy/module-dependency-registry.json`，对比 Java imports、migration FK
和 task-query registry。COMMAND/SCHEMA_FK 必须保持 DAG；TASK_READ 只允许明确 task
surface。跨模块写只能进入目标 `<module>.api` command 和同一 `REQUIRED` 事务；
coordinator 不得有业务表/repository/domain 资产。listener 只允许已登记的传输/遥测
副通道，禁止修改业务主状态。

**路径**：创建或更新
`apps/backend/catering-business-server/src/test/java/architecture/BackendModuleBoundariesTest.java`、
`tools/verify-gates/backend-boundaries.mjs`、`scripts/check/backend-boundaries`；更新
`contracts/policy/module-dependency-registry.json`（仅现实分母变化时）。保留
`apps/backend/terminal-data-server/` 空占位，禁止向其写入 runtime、src、依赖或 wire。

**负例**：domain import Spring/JDBC、跨模块 repository、coordinator 直接 DML、未知
listener、registry 漏边/额外边/环、TDP placeholder 出现 `src/` 或 generated wire
都必须由 production `run()` 真实失败。

**证据**：L1 编译/ArchUnit/registry 三方 PASS；L2 用真实模块测试和错误边负例；L3
只证明 app/module 结构，不产生用户行为；business 为 N/A；cleanup 为测试类路径和
temporary output 清理。

### R4-U03 — 安全边界、consumer face 与两个 admin app 架构

**目的**：阻断伪造 edge context、错误 face、跨 app import、foundation 反向依赖和
平台/运营身份混同。

**实现**：创建 `scripts/check/security-boundaries`，由受信边缘输入、route-face
registry、OpenAPI `x-consumer-faces` 和安全链的 production source 驱动；创建或更新
`scripts/check/frontend-architecture`，检查两个独立 app 的 shell/router/store/theme/
session/context/generated slice 方向，以及 `libraries/frontend/admin-ui-foundation`
保持 wire-agnostic、不能 import `apps/*` 或业务 generated 类型。R3 已有静态 boundary
和 C-01 surface 是回归输入，不在 R4 新增 operations 登录。

**未来 UI 设计强制输入**：任何后续 UI-bearing Journey 在画线框、拆组件或写页面前，
必须先重开 all-v2 中对应页面、交互与架构做法，逐项写明 `CARRY / ADAPT / NOT_CARRIED`
及原因；同时先盘点并优先消费 `libraries/frontend/admin-ui-foundation` 的已有能力。只有
foundation 未覆盖、且差异由 app-owned 用户任务/生命周期/策略所必需时，才可在 app
新增实现并记录理由。不得重造已有 Drawer lifecycle、overlay lock、list context、HTTP
protocol、observability 或 automation primitive；也不得把 all-v2 变成 runtime/build fallback。

**路径**：创建/更新 `scripts/check/security-boundaries`、
`scripts/check/frontend-architecture`、`tools/verify-gates/security-boundaries.mjs`、
`tools/verify-gates/frontend-architecture.mjs`；更新两个 app 的 architecture map/test；
保留 `libraries/frontend/admin-ui-foundation` 的当前物理复制与未接入状态，后续 UI
功能仍必须优先消费它。

**负例**：缺失/伪造/错误 face 的 edge context、operations 生成业务 endpoint、
foundation import app/generated、app 间 import、合并两个 app 的 session/context
都必须真红。

**证据**：L1 source/import/route 对账；L2 edge/face 负例与 focused frontend test；
L3 两 app 构建与各自 route boundary；business 为 N/A；cleanup 为 build output、
temporary generated output 和 test resources PASS。

### R4-U04 — Flyway、schema/FK、SQL/query 与真库负例

**目的**：持续证明单库、单 Flyway history、DDL owner、workspace composite FK、安全谓词、
CAS/约束、查询锁纪律和每请求数据库次数预算。

**实现**：创建/更新 `scripts/check/database-boundaries`、
`scripts/check/database-operation-budget`、`scripts/check/query-boundaries` 和共享
`tools/verify-gates/database-boundaries.mjs`。静态门检查 migration owner/version/history、
SQL 禁 DML/锁/`SELECT *`/循环 IO；Testcontainers 测试从零 migration、rollback、跨
workspace FK、revoked/scope predicate、CAS、named constraint、idempotency 和 query
count budget。真实测试库与 DEV 库完全隔离。

**路径**：创建/更新 `apps/backend/catering-business-server/src/test/**/database/**`、
`scripts/check/{database-boundaries,database-operation-budget,query-boundaries}`、
`tools/verify-gates/database-boundaries.mjs`；不创建第二 Flyway history、第二数据库或
生产 seed 入口。

**负例**：跨 workspace reference、CAS stale write、修改已应用 migration、
`FOR UPDATE`/DML/`SELECT *`/budget overrun、rollback 后残留事实、缺安全谓词均真红。

**证据**：L1 SQL/migration/registry 对账；L2 clean migration、真库负例、rollback 与
count budget；L3 N/A；business 为 N/A；cleanup 必须证明 Testcontainers、临时卷和
连接全部回收，cleanup 非 PASS 不得完成。

### R4-U05 — OpenAPI、生成可达闭包、wire closure 与 UI traceability

**目的**：保证 `x-consumer-faces → server route registry → platform-admin/operations-admin`
三方精确一致，并证明每个 target 只生成 operation 可达类型闭包。

**实现**：创建/更新 `scripts/check/openapi-contracts`，复算 operation、face、route、
generated endpoint/type、schema reachability 和 foundation wire-agnostic 方向；接入
现有 `scripts/check/edge-codegen` 的 native generator `--check`，禁止手写 allowlist、
共享 generated API、全局 model barrel 或 foundation 间接转出 wire。R4 同时运行
`ui-wireframe-traceability` 与 `business-terminology-traceability`：它们只核对当前已批准
R3 UI evidence/词汇和显式 N/A，不把 R4 技术工作伪装成新页面。

未来 UI design 的 traceability gate 还必须证明上述 all-v2 对照已经发生：不是按旧页面
直接复制，而是把现有可用交互/组件组合、foundation 能力和当前批准 Journey 的差异写成
可审计 disposition。没有对应 all-v2 资产时，必须显式记录“无 counterpart”与检索范围，
不得以未检索为由自行造轮子。

**路径**：创建/更新 `scripts/check/openapi-contracts`、
`tools/verify-gates/openapi-contracts.mjs`、`scripts/check/ui-wireframe-traceability`、
`scripts/check/business-terminology-traceability`；保留 edge OpenAPI、两个 app 独立
generated slices 和 foundation 复制，不搬运旧仓 runtime/build 资产。

**负例**：缺/未知/额外/漏生成 face 或 endpoint、不可达 schema、generated drift、
foundation 反向 wire import、R4 新增未批准 UI operation 都真红。

**证据**：L1 contract/generator/reachability；L2 generated binding 与 focused test；
L3 两 app closure；business 为 N/A（当前无 R4 Journey）；cleanup 为 temporary
generated output 删除。

### R4-U06 — 日志边界、retirement 与 handoff debt

**目的**：把运行诊断的敏感信息边界、旧 topology 的零引用/零注册/零 route/零 generated
symbol 和延后欠账字段纳入统一验证，但不复制业务语义 checker。

**实现**：创建/更新 `scripts/check/logging-boundaries`、`scripts/check/retirement`、
`scripts/check/handoff-debt`；logging 只作结构化字段/脱敏/禁止秘密落地/首败 evidence
结构检查。retirement 的 denominator 来自已批准 replacement map，禁止 deprecated、alias、
adapter、双读双写和静默 fallback。handoff-debt 只检查稳定 ID、七字段和 deferred item
存在，不建立第二状态机。

**路径**：创建 `tools/verify-gates/{logging-boundaries,retirement,handoff-debt}.mjs`，
更新 `scripts/check/{logging-boundaries,retirement,handoff-debt}` 和
`HANDOFF.md`（仅 R4 确认的 deferred item）。保留当前 R3 closure evidence，不把
R4 planned gate 的文件存在当成 GO。

**负例**：secret/cookie/token 进入 log/trace、旧 service/client/polling/MQ/outbox/
generated route 残留、缺 handoff 字段或重复 ID 真红。

**证据**：L1 zero-reference/field schema/deferred manifest；L2 logging red fixture；
L3 不适用；business 为 N/A；cleanup 为 scratch reports 与临时 scanner roots 清理。

### R4-U07 — `scripts/verify` 单入口、原生发现与红夹具

**目的**：将 U01–U06 按固定序列编排成分钟级、一次性退出、可诊断的单入口。

**实现**：创建 `scripts/verify` 和 `tools/verify-gates/verify.mjs`。顺序固定为：context/
source hash → standards coverage → static architecture/security/dependency → contract/
generated → database/query → native compile/unit/ArchUnit/Testcontainers → retirement/
handoff → deterministic affected-L2 map。每个子门失败即保留首败日志/manifest并退出非零；
不得用延长 timeout、轮询或魔法等待掩盖失败。`verify` 不启动 browser、持久 DEV、seed
或 reset，且可与 DEV 并行而不共享资源。

**路径**：创建 `scripts/verify`、`tools/verify-gates/verify.mjs`、
`tools/verify-gates/red-fixtures/**`、`doc/evidence/platform/r4-verify-evidence.json`；
更新 `scripts/README.md` 写清命令、输入、输出、失败定位、business/cleanup 分账。

**红夹具**：每个 production validator 至少一个行为变异；fixture 只改变被测事实，
不能绕开 `run()`。必须覆盖 rule source hash drift、unknown face、wrong dependency edge、
cross-workspace FK、SQL lock、generated reachability、foundation reverse import、secret
logging、retirement residue 和 missing handoff field。

**证据**：L1 是整套 gate/compile/test discovery；L2 是真红/真绿与诊断路径；L3 只在
受影响 app target 明确时派生；business 为 N/A；cleanup 必须分开记录并为零 active
managed resources。

### R4-U08 — 受影响 L2 映射、全范围 evidence 与 closure packet

**目的**：让后续 R5 每次变更能确定性派生 affected L2/L3，并让 R4 完成条件不被单项
static PASS 冒充。

**实现**：创建 `scripts/check/affected-l2` 与稳定 registry/schema；从 changed
module/contract/foundation/owner surface 计算受影响 test set，无法唯一归属时选择
全量 L2。创建 R4 evidence schema，明确 L1/L2/L3/business/cleanup 五账、失败复现命令、
source hashes、red fixture IDs、runtime residual scan 和 deferred handoff refs。

**路径**：创建 `scripts/check/affected-l2`、`contracts/policy/affected-l2-registry.json`、
`contracts/policy/r4-evidence.schema.json` 和最终 `doc/evidence/platform/r4-closure-readiness-evidence.json`。
保留 R3 evidence 为历史输入，不改写其 closure；不建立第二 Roadmap 状态 owner。

**失败/恢复**：changed surface 无 registry 命中、命中多个互斥 owner、evidence 缺
business/cleanup 字段、active resources 非零或 gate/evidence hash drift 都 fail closed。

**证据**：L1 规则/registry/schema；L2 deterministic mapping self-test；L3 受影响集的
真实 test selection；business 在 R4 明确为 N/A；cleanup 为 evidence scratch/runtime
manifest 清理。只有 U01–U08 全部实现且 Claude/Dexter 接受后，才可写
`MIGRATION_GATES_READY`。

## 3. 跨单元数据、事务和前端边界

R4 不新增业务事实、schema、command、consumer operation 或 app。它验证 R3 当前事实：
一个业务 deployable、单 PostgreSQL/单 Flyway、多 owner schema、两个独立 admin app、
foundation 只被后续 UI 功能消费且 wire-agnostic。Testcontainers 的 schema/data 仅为
临时测试 fixture，不能成为 DEV 或生产 seed。

所有真库写测试都使用 run-scoped database/transaction；任何业务 command 规则继续由
owner API 与同一 `REQUIRED` transaction 负责，R4 只验证，不复制一份业务写逻辑。

## 4. 统一 evidence 与验收

| 层 | R4 必须证明 | 不能证明 |
|---|---|---|
| L1 | validator、hash、registry、编译和静态边界 | 真实业务用户成功 |
| L2 | clean migration、负例、生成绑定、red mutation、日志/退役边界 | 运营用户真实登录 |
| L3 | 被变更 surface 的确定性测试集合和两 app 架构边界 | 全量产品迁移 |
| business | `NOT_APPLICABLE_R4_TECHNICAL_STEP`，不伪造业务 PASS | C-02/J02 或任何新 Journey |
| cleanup | 临时库、进程、容器、scratch、generated output 归零 | “退出码 0”单独等于 cleanup |

完成条件：每个 R4 交付物有 production validator、标准入口、至少一个真红变异和失败
定位；`scripts/verify` 分钟级且一次退出；R4 standards coverage 的到期 planned 条目
全部被真实 gate/ArchUnit/red fixture 或明确 review checklist 承接；affected-L2 映射可复算；
业务和 cleanup evidence 分账；最后经 Codex 两轮 bounded self-review、Claude 全范围 review
和 Dexter 接受。该文件本身不设置 `MIGRATION_GATES_READY`。

## 5. 实施后复核与 deferred

实施完成后必须以 `REVIEW_TARGET=IMPLEMENTATION` 重开真实 production source、validator
`run()`、compiler/test output、fresh red mutations、Testcontainers 和所有 evidence；
“按本设计实现”不能豁免方案合理性复核。R4 不开启 R5 业务范围，不恢复 J02/C-02，
不把 operations-admin boundary 当成登录闭环。

保留的生产化欠账（CI、备份恢复、密钥轮换、health/readiness、部署回滚、指标告警、
DB role 提升）只通过 `HANDOFF.md` 的稳定 ID 和可判定 trigger 管理，不在 R4 偷换为新平台。
