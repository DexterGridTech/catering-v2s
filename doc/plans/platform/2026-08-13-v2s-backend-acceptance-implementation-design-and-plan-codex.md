# SUPERSEDED — 2026-08-14 Dexter 裁定：provider/registry 是待办目录，不是 scenario 实现；当前唯一目标是 getPublicInvitationView 的真实 HTTP CONTRACT/BUSINESS 断言与信息性 DB 调用数。

不得再以本文重开 package entry/exit、P0/W0/P1、receipt、hash-chain 或 successor I0；保留的历史 scenario、lane 与测试骨架不构成本批交付。

当前主动规范改读 `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md`。

# Backend acceptance 整体 implementation-facing 详设与单批实施计划

- status: `DESIGN_GO_ROUND2_REMEDIATED_NOT_IMPLEMENTED`
implementationAuthority: false
runtimeAuthority: false
seedResetAuthority: false
- machineId: `backend-acceptance`
- reviewCadence: `COMPLETE_DESIGN -> CLAUDE_DESIGN_REVIEW_CYCLE -> ONE_SEQUENTIAL_IMPLEMENTATION_BATCH_WITH_INTERNAL_SELF_REVIEW_EACH_NODE -> CLAUDE_IMPLEMENTATION_REVIEW_CYCLE`
- postDesignGoActivation: `PAUSED_AFTER_DESIGN_REMEDIATION_REQUIRES_NEW_DEXTER_IMPLEMENTATION_INSTRUCTION`
- internalDesignAdversarialReview: `DEXTER_WAIVED_IN_FAVOR_OF_THE_SINGLE_CLAUDE_DESIGN_REVIEW`
- userVisibleJourney: `NOT_APPLICABLE_BACKEND_ENGINEERING_CAPABILITY`

## 0. 原因、目标与不做

### 0.1 为什么做

当前后台测试按类、方法级 SQL 台账、历史固定 HTTP workload 与 seed 结果分裂。operation row
集合即使对平，route projection digest 仍可漂移；旧 HTTP PASS 即使存在，生产源码后续变化
也不会自动触发 scenario disposition；未锚定的基础设施代码变化甚至可能推导空影响面。
结果是 seed 作为 DEV 数据动作在末端放大了本应由测试先发现的 DB 开销问题。

### 0.2 目标

实现一个 operation-scoped、真实 HTTP、真实容器、四维同证据链的唯一后台动态验收能力：

```text
backend-acceptance
  = CONTRACT + BUSINESS + deterministic PERFORMANCE + CLEANUP
```

新接口自动进入分母；缺 scenario 第一天 fail closed。实现变更自动反查受影响 operation；
BUG_FIX 必须证明新 case 在旧字节红、新字节绿。seed 回归为 DEV 数据供给，不再承担测试。

### 0.3 明确不做

- 不建立时延/percentile/预热/采样平台；
- 不建立 test seed；
- 不把类数、接口总数或历史编号写进 runtime/test 名称与判据；
- 不让多 lane 共用可写库或对象 namespace；
- 不在本设计包实现、运行或声称 `backend-acceptance`；
- 不恢复 DBCR package，不运行 DEV/L2/reset/seed/UAT。

### 0.4 必须回放的历史问题，不依赖聊天记忆

实施 agent 必须读取并逐行消费
`doc/evidence/platform/2026-08-13-v2s-backend-acceptance-historical-seed-findings.json`；下面三组
是 implementation exit 的机器分母，不是背景举例，也不得用“历史问题已回放”一句话替代：

1. **6 条已证实的结构性能回归**：
   `getOperationsCatalogWorkbenchContext`（CONNECTION 6→9）、
   `getOperationsCatalogNavigation`（12→24）、
   `getOperationsCatalogDictionary`（12→16）、
   `getOperationsCatalogItem`（561→1309）、
   `getOperationsCatalogItems`（6→12）、
   `getOperationsInventoryTargets`（6→12）。六条的 TRANSACTION 均从每调用 4.0 降至 2.0，QUERY
   分别保持每调用 7.5/9.0/7.0/10.0/9.0/9.0 不变，不能用 seed 总耗时下降覆盖；每条必须新增
   route regression case，经 known-cost 校准后在最终字节证明 QUERY、CONNECTION、TRANSACTION
   同时不高于 DBCR 前每调用 baseline，并提供 typed QUERY disposition、accepted baseline 与根因证据。
2. **15 个 HTTP failure family**：`stagePlatformAsset` 的有效资产步骤 HTTP 500；
   `createPlatformAdmin` HTTP 422；`savePublicInvitationCredentials` 两次 HTTP 422；
   `createOperationsOrganizationStore` HTTP 403；`getWorkspaceAccounts` HTTP 500；
   `sendPublicInvitationOtp` HTTP 500；`initializeCommercialGroup` 分别出现 409 已初始化与 422；
   `createPlatformGroupWorkspace` HTTP 422；`createOperationsOrganizationRegion` HTTP 400；
   `getWorkspaceInvitations` HTTP 404；`getOperationsWorkspaceSessionEntry` HTTP 500；
   `reissueWorkspaceInvitation` 虽 HTTP 200 但 response/readback 无法分类；
   `getOperationsCatalogWorkbenchContext` HTTP 403 SCOPE_FORBIDDEN；
   `saveOperationsCatalogItem` HTTP 409 IDEMPOTENCY_MISMATCH；
   `operationsWorkspacePasswordLogin` HTTP 401。每族必须证明当前 route 行为：新增回归，或绑定现有
   fresh route proof，或以 owning source 证明仅为 seed client/fixture 缺陷且 route contract/business/
   cleanup 均 fresh PASS；禁止直接假定后来已经修好。
3. **8 个非 route seed/fixture failure family**：platform-admin revision 对账失败、platform-admin
   schema 缺失、bootstrap 非空上下文冲突、owner command/readback chain 不完整、expired invitation
   terminal fixture 失败、account display-name readback 失败、canonical BOM target 缺失、PRODUCT_SKU
   owner ref 缺失。每项必须给 owning source、根因、受影响 route exact set、source-derived 推导方法
   与 fresh route proof；
   “非 route”不能成为跳过原本要验证的接口行为的理由。

历史 catalog 的每个 source 都绑定受管 run manifest 或 DBCR termination/report SHA-256。它只证明
“曾经发生并必须处置”，不预判当前仍有 bug；当前结论只能来自最终 implementation bytes 上的
`backend-acceptance`。少行、多行、非法 disposition、缺证据或陈旧 proof 均 fail closed。

## 1. Authority 与硬前置

实施开始前必须同时满足：

1. 本设计已完成两轮 Claude DESIGN review 并取得 GO。Dexter 随后于 2026-08-13 明确要求先完成
   DESIGN Round-2 整改、暂不进入实施；因此当前仍停留在 design-only package。后续只有 Dexter
   新的明确 implementation 指令才能激活单一 implementation package 与受管
   `backend-acceptance` 动态运行，既有 GO 不自动越过这条最新暂停裁定；
2. 新 implementation package 必须把本设计、DESIGN GO 与上述 Dexter 条件授权逐 hash 绑定，
   并使 allowed surfaces 覆盖全部单批 surface；当前
   旧 backend-performance step 不能自动授权本能力；
3. `operation-handler-bindings` 当前 catalog-inventory route source digest 漂移先作为 BA-U01
   首项修复；旧 PASS 不继承；
4. `validate-source-map` 的当前 source drift 先在 owning generator/map 机制下闭合；
5. implementation entry 捕获 current operation denominator、KNOWN_UNCOVERED、P4 rows、旧行为
   test assertions、旧 runner assets、完整 production surface `P0` 与 entry anchor set `W0` 的
   不可变 entry snapshot；
6. DESIGN GO 后的动态授权仅限 `backend-acceptance` 所需 managed Testcontainers 运行；明确不含
   DEV、L2、reset、seed、浏览器、UAT、部署或手工 SQL。

## 2. 目标架构

```text
semantic route projections ── exact rows + fresh digests ──┐
operation-handler bindings ──────────────────────────────────┤
module-owned scenario units ─────────────────────────────────┤
accepted structural baselines ───────────────────────────────┤
                                                            ▼
                                              backend-acceptance runner
                                                            │
                              ┌──────────────┬──────────────┬──────────────┐
                              ▼              ▼              ▼              ▼
                          CONTRACT       BUSINESS      PERFORMANCE       CLEANUP
                              └──────────────┴──── same correlation ──────┘
```

公共 runner 只负责编排、通用 contract 校验、计量聚合、隔离与报告。业务 fixture/request/oracle
由 owning module 的 scenario unit 提供，禁止形成一个复制全部业务知识的中央巨型 workload。

## 3. 权威 schema

### 3.1 Operation identity

```json
{
  "operationId": "...",
  "method": "GET|POST|PUT|PATCH|DELETE",
  "normalizedPath": "/...",
  "consumerFace": "platform-admin|operations-admin|public|backend",
  "owner": "...",
  "owningUnit": "fully.qualified.Provider#scenario"
}
```

唯一键是上述五项，不使用数组下标、类名或总数。producer projection 与 bindings 分别携带
content digest；validator 先 exact rows，再逐 producer digest 新鲜度。

### 3.2 Scenario contract

```json
{
  "identity": {},
  "fixture": {"provider": "...", "namespaceOwnership": "RUN_SCOPED"},
  "request": {"builder": "...", "secretHandlesOnly": true},
  "businessOracle": {"provider": "...", "ownerReadback": "..."},
  "performanceCriterion": {
    "baselineRef": "...",
    "metrics": ["LOGICAL_SQL", "QUERY", "UPDATE", "CONNECTION", "TRANSACTION", "BATCH"]
  },
  "cleanup": {"provider": "...", "readback": "..."},
  "correctnessCases": [],
  "correctnessCasesEmptyReason": "read-only lookup has no mutation replay semantics"
}
```

六个强制字段非空；`correctnessCases` 非空时 reason 必须缺席，为空时 reason 必须非空。
contract oracle 不复制进每行。secret/password/OTP/token/cookie/Authorization/身份原值只能
通过 run memory handle 注入。

### 3.3 Accepted structural baseline

每个 operation/case/metric 维护 append-only accepted history：previous、current、direction、
reason、owningSource、approvalRef。首次值来自 fresh route measurement，不继承 P4 数字。
任何首次写入或下降接受都以前置的同 run known-cost 计量校准 PASS 为必要条件；上升只有明确
批准 history entry 才可接受。校准不通过时禁止创建、降低或消费 baseline。当前 scenario 与
accepted latest exact set 对平。

known-cost 校准由 test-only Spring configuration 暴露内部校准 route，只验证 HTTP correlation、
transaction/data-source tracker 与 sink 完整性，不属于 semantic operation denominator，不进入
scenario registry，也不充当 bootstrapOperation。fixture 在 correlation 启动前准备隔离表，在
一个明确事务中执行 2 次 insert 与 3 次 select；期望值先由 fixture 常量独立推导：
`LOGICAL_SQL=5`、`QUERY=3`、`UPDATE=2`、`CONNECTION=1`、`TRANSACTION=1`、`BATCH=0`。
禁止从 measured output 回填期望。每次动态 operation batch、首次 baseline 写入及 baseline 下降
前都运行；任一 metric 缺失、少计、多计或 correlation 错绑统一失败
`MEASUREMENT_SINK_INTEGRITY_FAILED:<metric>`。

### 3.4 KNOWN_UNCOVERED

entry snapshot 是迁移期唯一上界。production validator 比较 entry/current：current 只能是 entry
的真 subset；新增、替换 identity、从当前 denominator 反向重建均失败。新 operation 因不在
entry snapshot 内而直接 `UNCOVERED_OPERATION`。清空后删除迁移 schema 与逻辑，不转成常设
豁免。

## 4. BA-U01｜基线新鲜度与设计准入

### 4.1 改动面

- update `scripts/generate/operation-handler-bindings.mjs` 与 owning generated projection，先修当前
  `BP_U02_ROUTE_SOURCE_DIGEST_DRIFT`；
- update `contracts/registry/operation-handler-bindings.json` only through generator；
- update `tools/implementation-design-granularity/cli.mjs`，要求每个 delivery unit 声明
  `backendOperationImpact=NONE_WITH_REASON|ADDED_OR_CHANGED`；后者必须有 scenarioContracts；
- update existing granularity self-test，使用 production validator 的 scratchpad mutations；
- 当前 design package 创建 `contracts/policy/backend-acceptance-execution-contract.json` 的
  `PROPOSED_REVIEW_ONLY` 设计态，精确固化 schema、错误码、owner-module/provider 映射、计量校准、
  consumer disposition、full-mode capacity、public entry、证据根、lane isolation 与执行层级；
  它保持 `implementationAuthority=false/runtimeAuthority=false`。BA-U01 只在对应 production
  validator 与真实 red mutations 完成后把该 contract 激活为 runtime 可消费状态，禁止未校验直用。

execution contract 的 owner 映射是封闭集，不从字符串同名猜目录：

| owner | current rows（诊断值） | Gradle module | provider test-fixtures root |
| --- | ---: | --- | --- |
| asset | 2 | `modules/asset` | `.../modules/asset/src/testFixtures/java/com/catering/v2s/platform/asset/acceptance` |
| catalog | 25 | `modules/catalog` | `.../modules/catalog/src/testFixtures/java/com/catering/v2s/catalog/acceptance` |
| contract | 10 | `modules/store-contract` | `.../modules/store-contract/src/testFixtures/java/com/catering/v2s/store/contract/acceptance` |
| extension | 3 | `modules/extension` | `.../modules/extension/src/testFixtures/java/com/catering/v2s/extension/acceptance` |
| fulfillment-production | 4 | `modules/fulfillment-production` | `.../modules/fulfillment-production/src/testFixtures/java/com/catering/v2s/fulfillment/production/acceptance` |
| inventory | 11 | `modules/inventory` | `.../modules/inventory/src/testFixtures/java/com/catering/v2s/inventory/acceptance` |
| organization | 39 | `modules/organization` | `.../modules/organization/src/testFixtures/java/com/catering/v2s/organization/acceptance` |
| platform-asset | 3 | `modules/asset` | `.../modules/asset/src/testFixtures/java/com/catering/v2s/platform/asset/acceptance` |
| platform-iam | 16 | `modules/platform-admin-iam` | `.../modules/platform-admin-iam/src/testFixtures/java/com/catering/v2s/platform/admin/iam/acceptance` |
| platform-workspace | 7 | `modules/workspace` | `.../modules/workspace/src/testFixtures/java/com/catering/v2s/platform/workspace/acceptance` |
| workspace-iam | 76 | `modules/workspace-iam` | `.../modules/workspace-iam/src/testFixtures/java/com/catering/v2s/workspace/iam/acceptance` |

上述 row 数仅复算当前 196 行事实，不进入任何固定分母判据。路径按
`providerRoot + '/' + UpperCamel(operationId) + 'BackendAcceptanceScenarioProvider.java'`
机械物化，未知 owner 失败 `BACKEND_ACCEPTANCE_OWNER_MODULE_UNMAPPED`，路径碰撞失败
`BACKEND_ACCEPTANCE_PROVIDER_PATH_COLLISION`。owner module 使用 `java-test-fixtures`，app acceptance
suite 只通过 Gradle `testFixtures(project(...))` 消费；禁止把 module-owned provider 集中放入 app。

### 4.2 Typed failures

```text
BACKEND_ACCEPTANCE_OPERATION_DISPOSITION_REQUIRED
BACKEND_ACCEPTANCE_SCENARIO_CONTRACT_REQUIRED
BACKEND_ACCEPTANCE_SCENARIO_FIELD_MISSING
BACKEND_ACCEPTANCE_CORRECTNESS_CASES_REASON_REQUIRED
STALE_ROUTE_OR_BINDING
BACKEND_ACCEPTANCE_OWNER_MODULE_UNMAPPED
BACKEND_ACCEPTANCE_PROVIDER_PATH_COLLISION
MEASUREMENT_SINK_INTEGRITY_FAILED
```

### 4.3 顺序与证据

先给 design validator 加 clean/red，再修 bindings digest；不得用重新写死总数或删除 freshness
校验过门。focused proof 包含“row set 相等但 digest 陈旧”真实 mutation。

## 5. BA-U02｜动态分母、scenario registry 与单调迁移

### 5.1 改动面

- create `contracts/registry/backend-acceptance-scenarios.json`：只保存 identity、provider locator、
  digests 与 typed declaration，不复制业务执行代码；
- create `contracts/registry/backend-acceptance-known-uncovered.json`：package-entry 初始台账；
- create `contracts/registry/backend-acceptance-accepted-baseline.json`；
- create `contracts/policy/backend-acceptance-retained-owner-logic.json` 与
  `contracts/policy/backend-acceptance-route-unexpressible-regressions.json` 两份封闭清单；
- consume `doc/evidence/platform/2026-08-13-v2s-backend-acceptance-historical-seed-findings.json`
  作为不可从聊天重建的 entry replay denominator，并 create
  `doc/evidence/platform/backend-acceptance-historical-seed-dispositions.json`；
- create `tools/backend-acceptance/cli.mjs` 的纯静态 `discover/preflight/check`；
- create `scripts/test/backend-acceptance` 作为唯一公共 adapter，但本单元只开放 `--preflight`
  直到 BA-U03 动态 harness 完成；
- create `scripts/test/backend-acceptance.test.mjs`，承载 production validator 的 scratch red。

### 5.2 分母算法

1. 读取所有 authoritative route projections；
2. 规范化 identity 并 exact-union；
3. 对 bindings 做双向 exact set；
4. 对 projection metadata 做 fresh digest；
5. 对 scenarios 做 identity exact set，其中当前 uncovered 只能是 entry ledger subset；
6. 对 covered rows 校验六字段、provider locator、baseline 与 cleanup；
7. 输出诊断 `discoveredOperations`，但不比较固定数。
8. 对历史 catalog 的 6 条 performance、15 族 HTTP 与 8 族 non-route finding 分别做 exact-set
   schema 校验；disposition 不得为 PENDING 或自由文本。

### 5.3 迁移绿条件

```text
covered operations preflight PASS
AND currentUncovered ⊂= entryKnownUncovered
AND no new operation in known-uncovered
```

最终完成额外要求 currentUncovered 为空。

## 6. BA-U03｜真实 HTTP harness、计量与可配置隔离 lane

### 6.1 可复用与新增

- 复用现有 remote Testcontainers 的 managed SSH、image cache、PID/start-token、daemon cleanup、
  heartbeat 与 work stealing，不复用“按 @Testcontainers 类发现”和固定三 lane；
- create `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/`
  下的 `BackendAcceptanceScenarioProvider`、`BackendAcceptanceHttpHarness`、
  `BackendAcceptanceDatabaseMetricsSink`、`BackendAcceptanceMeasurementCalibrationConfiguration`、
  `BackendAcceptanceMeasurementCalibrationScenario` 与唯一 suite；该 package 名是能力名，不含
  阶段/数量。校准 configuration 只存在于 test application context，不新增 production endpoint；
- 在既有 `DatabaseOperationTracker`/`HttpRequestMetricsInterceptor` 旁增加 test-visible in-JVM sink，
  production 默认 no-op，不建立第二计量口径；
- 对 execution contract 列出的十个物理 owner module 启用 `java-test-fixtures`，app suite 逐项
  `testImplementation(testFixtures(project(...)))`；同一 `asset` module 同时承载 `asset` 与
  `platform-asset` provider，但仍按 operation identity 唯一物化；
- update `scripts/test/r5-remote-testcontainers.mjs`、
  `scripts/test/r5-testcontainers-daemon-lanes.mjs` 与
  `scripts/test/r5-remote-testcontainers.test.mjs`，将 laneCount、socket、workspace、
  database/schema、asset namespace 全链参数化；旧文件迁移期只作 predecessor owner，最终由
  BA-U06 disposition；
- `scripts/test/backend-acceptance` 开放 `--per-edit`、`--package-exit`、`--operation`。

### 6.2 初始化和执行

先运行完整 preflight，写 `ADMISSION_COMPLETED_AT`；只有之后才能出现
`CONTAINER_INITIALIZATION_STARTED_AT`。每 lane 一次启动独立 app/container context，顺序运行
unit。fixture provider 必须声明 namespace ownership 才可被 work stealing。

容器与 app 就绪后、任何 operation 执行或 baseline 写入前，先运行同一 correlation 链上的
known-cost measurement calibration。校准 exact PASS 写入不可伪造 receipt；失败立即停止该 lane，
错误为 `MEASUREMENT_SINK_INTEGRITY_FAILED:<metric>`，但不取消其他 lane。校准期望来自 execution
contract fixture 常量，不读取 accepted baseline；sink no-op、漏任一 metric、错绑 correlation
三类 scratch mutation 都必须调用 production harness 并红。

BA-U03 的第一条动态证明不由实施者主观选 operation：从 BA-U02 fresh denominator 按完整
identity 规范序排序，取第一条为 `bootstrapOperation`，先按 owning source 补齐其六字段和
route scenario，再执行单 operation CONTRACT/BUSINESS/PERFORMANCE/CLEANUP 与 cleanup。
该 scenario 直接进入 BA-U05 迁移分母，不创建一次性假 endpoint 或专用测试契约。

laneCount 由显式 CLI/config 与远端资源 preflight 决定，最小 1，无固定 3 上限；每 lane Engine
ID、DB/schema、asset namespace 唯一。发现共享可写 namespace 在发送首个 HTTP 前失败。

### 6.3 时长与进度

- `ALL` 按当前覆盖率是常态容量模型，不是低频兜底。571 个 checked-in production Java 中只有
  128 个在 entry anchor 内，443 个（77.58%）落在 W0 外；这是“随机文件等概率变化”的静态
  surface 占比，不冒充实际提交频率，但足以否定 subset 为默认容量假设。模块分布如下：

| source region | total | anchored | blind | unanchored surface ratio |
| --- | ---: | ---: | ---: | ---: |
| app-root | 399 | 96 | 303 | 75.9% |
| organization | 41 | 6 | 35 | 85.4% |
| workspace-iam | 34 | 11 | 23 | 67.6% |
| workspace | 18 | 3 | 15 | 83.3% |
| foundation | 15 | 0 | 15 | 100% |
| audit-model | 9 | 0 | 9 | 100% |
| execution-context | 9 | 0 | 9 | 100% |
| extension | 8 | 1 | 7 | 87.5% |
| platform-admin-iam | 7 | 1 | 6 | 85.7% |
| asset / store-contract / inventory | 20 | 5 | 15 | 75.0% |
| catalog / fulfillment-production | 9 | 3 | 6 | 66.7% |
| audit-read | 2 | 2 | 0 | 0% |
| total | 571 | 128 | 443 | 77.58% |

- per-edit 的容量验收按 **full current denominator** 在 `<=10m` 内完成反推 lane，不按 subset
  估算；subset 仅是优化结果。lane 下界为
  `ceil(sum(latestSchedulingWeightMillisByOperation) / 600000)`，新 operation 采用 current maximum
  weight；没有 fresh history 时直接选 resource manifest 允许的最大隔离 lane 数。
- resource preflight 必须在初始化前记录 target、weight 来源 runId、总 weight、minimumLaneCount、
  isolatedResourceMaximum 与 selectedLaneCount。资源上限低于 minimum 时，以
  `BACKEND_ACCEPTANCE_FULL_MODE_CAPACITY_INSUFFICIENT` fail closed，不降覆盖、不转 seed、不把
  package-exit 的 30 分钟目标冒充 per-edit 成功。
- package-exit 仍以 `<=30m` 为工程目标；任何模式提速只允许增加真正隔离 lane、降低重复初始化
  或修复 runner 开销，绝不缩 operation、四维、fixture 或 cleanup 面。
- 降低 ALL 发生频率只允许未来通过 source-derived anchor 覆盖率提升；增加路径豁免明确禁止，
  本包只登记该欠账，不实施 anchor 扩面。
- 动态期间最迟每 30 秒输出一次 run/lane/current/remaining/elapsed/firstFailure。

### 6.4 结果

固定根 `.runtime/backend-acceptance/<runId>/`，包含 manifest、per-lane log、per-operation receipt、
accepted-baseline comparison、first-failure summary 与 cleanup。单 lane first failure 不取消其他
lane；parent 在全部 lane 终态后聚合。

## 7. BA-U04｜变更联动、BUG_FIX 红证与 consumer

### 7.1 不可自准入的 entry/exit 影响面算法

复用 `contracts/registry/backend-performance-operation-source-inventory.json` 的 path → operation
映射，但只读取 package-entry 字节。当前独立复算证明：checked-in production Java 为 571，
entry inventory 只覆盖其中 128，盲区 443（77.58%）；第 129 个 anchored path 是 generated
Java，不得混入 checked-in 覆盖分母。若按有效 compiled main 计，616 中覆盖 129、盲区 487。
因此 inventory 只能提供精确映射，不能独自证明完整影响面。

BA-U04 在 package lifecycle 中使用以下不可变输入和纯函数算法：

```text
ENTRY:
  P0 = deriveProductionSurface(gradleMainSourceAndTaskInputs, generatorTaskInputs)
  W0 = validateEntryAnchors(entryInventory, P0)
  O0 = entry semantic operation rows + route/schema/error/consumer digests

EXIT:
  P1 = deriveProductionSurface(the same derivation rules)
  D  = changedExistenceOrFullFileHash(P0 union P1)
  if any path in D is not in W0:
      impacted = ALL current operations
  else:
      impacted = all entry operations whose anchor source path is in D
  impacted += operations whose identity/route/schema/error digest changed
```

`P0/P1` 保存规范化仓根相对路径、存在性、全文件 SHA-256 与 derivation owner。production
surface 从 Gradle `main` source sets、compile/processResources task inputs、app/module runtime
build inputs及权威 generator task inputs 自动派生；不是手写共享基础设施清单。生成产物本身
若不属于 repo-owned input，则由其 task input 的变化触发 ALL。Java/resource/build 配置或
generator 输入中的未锚定变化一律 ALL。

`W0` 只允许 entry inventory 中路径合法、无重复、hash 对 entry bytes 可复算且能映射 operation
的 source path；同包更新 inventory 不得扩大它。`P0 ∪ P1` 捕获新增、删除、重命名。entry
snapshot 缺失、路径逃逸、重复、不可读、derivation 规则漂移、anchor hash 不符或 operation
反查不唯一都以稳定 typed error fail closed，禁止退化为 changed-path declaration 或 exit-only
扫描。

### 7.2 Package disposition schema

implementation package evidence 创建 run-scoped
`backend-acceptance-change-dispositions.json`，逐 impacted operation 三选一：

- `SCENARIO_UPDATED` + actual before/after digest + direction + sourceRef；
- `REGRESSION_ADDED` + new case identity/digest；
- `BEHAVIOR_UNCHANGED` + unchanged contract digest + fresh four-dimension accepted receipt。

shape/error/route 变化额外逐 `consumerFace` disposition。集合必须与 impacted operation、changed
consumer faces 双向相等。

consumer 行不得是自由文本，必须三选一并满足 execution contract 的证据 schema：

- `CONSUMER_CONTRACT_REGENERATED`：producer contract before/after digest、generated artifact
  path 与 before/after digest、consumer contract proof 均非空；
- `CONSUMER_UNAFFECTED`：只能命中封闭 wire compatibility class
  `OPTIONAL_FIELD_ADDED / NON_BREAKING_CONSTRAINT_WIDENED /
  ADDITIVE_ERROR_NOT_MATCHING_EXISTING_FLOW`，并绑定 compatibility proof 与 consumer artifact digest；
- `CONSUMER_BREAKING_ACKNOWLEDGED`：必须有 authorityRef、breakingChangeRef、remediation owner/target，
  resolutionStatus 只能是 `RESOLVED_IN_PACKAGE` 或 `DEXTER_APPROVED_EXTERNAL_BLOCKER`。

缺行失败 `CONSUMER_FACE_DISPOSITION_MISSING`；未知枚举、缺证据、`PENDING` 分别失败
`CONSUMER_FACE_DISPOSITION_INVALID / CONSUMER_FACE_EVIDENCE_MISSING /
CONSUMER_FACE_PENDING_FORBIDDEN`。“稍后处理”或 note 不构成 disposition。

### 7.3 BUG_FIX red proof

package kind 为 BUG_FIX 时，至少一个 regression receipt 同时绑定 preByteHash/postByteHash、
相同 fixture/scenario case，并证明 PRE FAIL / POST PASS。不能 route 表达时 exact 命中封闭清单；
无法保护时显式 `UNPROTECTED_FIX`，implementation review 必须作为 finding 输入。两者均不可
被解释为已受回归保护。

### 7.4 Production adapter 与唯一 owner

- create `tools/backend-acceptance/impact.mjs`：唯一纯函数 owner，负责 surface derivation
  normalization、`P0/P1/W0/D`、operation/consumer exact set 与稳定错误码；
- update `tools/compliance-control/cli.mjs`：package activation 在任何 implementation write 前
  原子 no-replace 写 entry impact snapshot；package exit 只消费该 snapshot 并调用 owner；
- create `scripts/check/backend-acceptance-change-impact`：只作 CLI adapter，不复制算法；
- create `scripts/check/backend-acceptance-change-impact.test.mjs`：scratchpad 调 production owner。

entry snapshot 与 packageId、entry inventory hash、derivation contract hash、`P0/W0/O0` digest
绑定；禁止覆盖、删除或由 current tree 重建。production adapter 只做机械 hash/set/digest/
receipt 判定，不判断业务语义。

## 8. BA-U05｜按 owner 迁移断言与预算

### 8.1 迁移清单

entry 时生成不可变：current operations、19 类/118 sources 仅作资产发现、P4 28 rows/52 cases、
所有行为 assertion 与旧 runner/fixture/report assets。数字仅绑定 entry bytes，不进入未来成功
条件。

每个 owner package 串行：

1. 为 operation 建 owning provider 与 scenario 六字段；
2. 逐条迁入旧 owner/service/HTTP 测试的独有业务 assertion；
3. 通过真实 HTTP fresh 测量结构 baseline；
4. route scenario red/green 后从 KNOWN_UNCOVERED 删除；
5. 删除对应 P4 row；
6. 删除被 route 覆盖的旧行为测试；纯算法例外入封闭清单；
7. assertion inventory 的 migrated/deleted/retained exact set 必须等于 entry assertion set。

implementation package entry 先验证 current owner exact set 与 execution contract 的
`ownerModuleMappings` 双向相等，再按该封闭映射和 className/filePath formula 机械生成逐 operation
provider path 与 class symbol，写入 scenario registry 和 exact allowed-change manifest；不存在的
文件标 `CREATE`，已存在的标 `UPDATE`。未登记 owner 或路径碰撞在任何源码写入前 fail closed。
实施 agent 不得按聊天、旧 196 行号、测试类名或 owner 字符串同名规则猜 module，也不得以目录
通配代替逐行清单。provider 位于 owning module `src/testFixtures/java` 并统一实现 BA-U03 SPI；
fixture、request、oracle、cleanup 仍由 owning module 源码与需求逐 operation 回读后填写。

不得先删测试再补 scenario，不得从方法级 SQL 或 seed 计数推导 HTTP baseline。

### 8.2 Scale fixture

默认不要求。只有 fresh 结构计数证明某 operation 随基数非预期增长时，新增最小 scale fixture
与 deterministic count criterion；不得引入时延采样。

### 8.3 历史 seed finding 的逐项回放与修复

历史 catalog 不是 seed 重跑清单，而是 route scenario 的迁移输入。每个 owner group 开始时先取
该 owner/operation 命中的历史行，再读其 source manifest、项目记忆、operation contract 与 owning
source，完成根因分类后才允许写 scenario：

- 六条结构性能回归只允许 `REGRESSION_ADDED`，并固定提供 scenarioCaseId、历史计量对照、当轮
  calibration receipt、同 fixture 的 before-failure/after-pass、accepted baseline、rootCauseRef、
  tripleMetricClosureReceipt、transactionBoundaryDisposition 与 queryDisposition；
- 十五个 HTTP family 只允许 `REGRESSION_ADDED / ALREADY_COVERED_WITH_FRESH_ROUTE_PROOF /
  SEED_CLIENT_OR_FIXTURE_ONLY_WITH_ROUTE_PROOF`。后两者仍需当前 contract/business/cleanup receipt；
  seed-only 另需 seed owning source 与 route unaffected proof；
- 八个 non-route family 只允许 `SEED_CLIENT_OR_FIXTURE_ROOT_CAUSE /
  BACKEND_ROUTE_REGRESSION_ADDED`，并必须列出 affectedRouteSet、封闭枚举的
  affectedRouteDerivationMethod 与具体 affectedRouteDerivationOwningSource；原 fixture 旨在证明的
  route 行为没有 fresh proof 时不得判 seed-only。

六条 PERF finding 的 source-based 复算结果是同一签名：DBCR 前均为每调用 3.0 CONNECTION、
4.0 TRANSACTION；DBCR 后均为每调用 2.0 TRANSACTION，而 CONNECTION 分别为
4.5/6.0/4.0/7.0/6.0/6.0；QUERY 分别为 7.5/9.0/7.0/10.0/9.0/9.0 且前后完全不变。
task-read policy 与 source inventory 将六条逐一绑定到
`CatalogInventoryCoordinator#readCatalogWorkbenchContext/readCatalogNavigation/readCatalogDictionary/
readCatalogItem/readCatalogItems/readInventoryTargets`；当前六方法均在 transaction 外，且其中
workbench/items/item/inventoryTargets 继续进入各自不同的 coordinator-owned enrichment helper。
共同 coordinator/task-read 边界与完全一致的 3.0 CONNECTION/4.0 TRANSACTION 前签名证明应先审查
共享基础设施和共同调用层，不能按六个孤立 endpoint 猜修复；但源码并不证明六条共用同一个
enrichment helper，实施 agent 必须继续逐条分解 primary read、fact loader、enrichment 与 interceptor
贡献，不得把“共享边界”偷换成“已有一个可直接单点修改的共享方法”。

六条的机器收口必须同时满足：在等价 fixture 与调用语义下，每调用 QUERY、CONNECTION、
TRANSACTION 三项均小于等于该行 `perCallBefore`，缺一不可；只让 CONNECTION 回落仍为红。
恢复 read-only transaction 只允许以连接经济性为理由，且恢复本身不构成收口；PostgreSQL 默认
READ COMMITTED 下不得声称普通 read-only transaction 提供多查询稳定快照或因此保证读一致性。
每条 QUERY 另须二选一：`QUERY_REDUCED_TO_<n>` 并绑定 freshQueriesPerCall、合并方式与 owning
source，或 `QUERY_ALREADY_MINIMAL` 并逐条说明 fresh counted QUERY 的业务必要性及 owning source。

方向目标是一次 read 使用一个 transaction、一个 connection 与最少 QUERY，优先减少 QUERY；
这不是额外硬数值门。若 owning source 证明共享管线存在真实约束，记录约束即可接受，不追加返工。
该裁定只覆盖 `BA-HIST-PERF-001..006`；DBCR package 保持
`TERMINATED_BY_DEXTER_SCOPE_REFRAME`，不得借机扩到其余 finding。

implementation validator 必须对 catalog findingId 与 disposition findingId 双向相等，并验证 source
hash、证据 schema 与 receipt freshness。删除任一历史行、把六条性能回归标成“已覆盖”、仅写 note、
仅让 CONNECTION 回落、以一致性理由恢复普通 read-only transaction、缺 QUERY disposition、伪造
non-route affectedRouteSet 而没有 source-derived 推导方法，或复用旧 seed PASS 都必须红。发现生产
根因时按 contract、backend、consumer 全影响面修复；发现 seed client/fixture 根因时修 seed owning
source，但仍以 route proof 关闭，不运行 seed 充抵。

## 9. BA-U06｜全量验收、旧资产退役与实施 review cycle

### 9.1 退役前置

- KNOWN_UNCOVERED 为空；
- current operation/unit/scenario/receipt/four verdict exact set；
- full `backend-acceptance` 四维与 cleanup PASS；
- P4 row 只剩合法封闭例外或为空；
- OWNER_LOGIC 只剩合法封闭例外；
- change gate 与 25 类 mutation PASS；
- history replay catalog 的 6 条 performance、15 族 HTTP、8 族 non-route disposition exact set 与
  fresh required evidence PASS；
- old behavior assertion migration exact set PASS。

### 9.2 退役

从 entry old-asset inventory 逐条 `DELETE / RETAIN_DIFFERENT_DUTY / HISTORICAL_HASH_BOUND`。
删除固定数字 workload、分立功能/性能 runner、重复 acceptance report 和已迁移行为测试；保留
编译、OpenAPI 生成/静态契约、ArchUnit、源码机械门及 hash-bound 历史 evidence。公共动态入口
只剩 `scripts/test/backend-acceptance`。

### 9.3 外部 Claude review

所有实施与 fresh full evidence 完成后，才交 Claude 进入外部 IMPLEMENTATION review cycle；
cycle 内允许按 finding 整改与复核，但实施完成前禁止中途送审。review 必须重开
真实 runner、scenario providers、计量 owner、change-impact validator、旧资产 disposition、
四维 receipts 与 cleanup，不以“按设计实现”豁免合理性判断。

### 9.4 DESIGN GO 后的唯一连续执行状态机

下一 implementation agent 只能按下列状态迁移；每个实现节点都必须先完成本节点内部 self-review
才能进入下一状态，但内部 self-review 不是暂停、拆包、交付或提前 Claude review 点：

```text
D0  DESIGN_GO
 -> I0  create one implementation package; bind design/review/authority hashes;
        atomically capture operation rows, P0/W0/O0, uncovered, baselines,
        P4 rows, behavior assertions and predecessor assets before any write
 -> I1  BA-U01 static clean/red/freshness PASS -> SR1 internal self-review CLOSED(max 2)
 -> I2  BA-U02 denominator/scenario/ratchet preflight PASS -> SR2 internal self-review CLOSED(max 2)
 -> I3  BA-U03 static runner proofs + deterministic bootstrapOperation
        managed four-dimension dynamic PASS + cleanup PASS -> SR3 internal self-review CLOSED(max 2)
 -> I4  BA-U04 impact/disposition/BUG_FIX/consumer production validators
        and all scratch red mutations PASS; package coupling active
        -> SR4 internal self-review CLOSED(max 2)
 -> I5  BA-U05 owner groups in source-derived order; for every operation:
        reopen requirement+memory+owning source, add red/green route scenario,
        measure fresh structural baseline, then delete uncovered/P4/duplicate test;
        additionally consume every matching BA-HIST finding by exact findingId,
        root-cause and close the explicit 6 performance + 15 HTTP + 8 non-route rows;
        operation/scenario/assertion/baseline/history-disposition exact sets PASS
        -> SR5 per-owner and aggregate internal self-review CLOSED(max 2 each)
 -> I6  BA-U06 pre-retirement fresh full denominator PASS + cleanup PASS
        -> SR6A internal self-review CLOSED(max 2)
 -> I7  apply predecessor exact dispositions and retire only proven duplicates
        -> SR6B internal self-review CLOSED(max 2)
 -> I8  post-retirement fresh full denominator PASS + cleanup PASS
        -> SR6C internal self-review CLOSED(max 2)
 -> I9  final static/package-exit exact reconciliation PASS
        -> SR-FINAL internal self-review CLOSED(max 2)
 -> IR  Claude IMPLEMENTATION review cycle handoff
```

I6 不能充抵 I8：退役本身改变 runner/test/control bytes，必须在最终字节上重新全量证明。
I5 的 owner group 顺序从 current operation owner、path、operationId 规范排序派生；同一 owner 内
逐 operation 串行，动态 lane 只并行彼此 fixture ownership 独立的 execution units，不并行写
scenario registry、baseline、uncovered、P4 或 assertion disposition 这些共享权威文件。

每个 `SR*` 使用同一固定模板并落 implementation evidence：重开本节点批准 requirement、命中
project memory、详设 unit、实际 changed sources；核对 planned/actual changed surface、六类 source
分母、禁止捷径、稳定错误码、clean proof、真实 scratch red、business/cleanup applicability；逐条
记录 `CONFIRMED / FIXED_BEFORE_CONTINUE / NOT_APPLICABLE_WITH_REASON`。每个节点最多两轮：
round 1 全面自审并修复，round 2 只核验 round-1 finding 与修复影响面。round 2 仍有 finding 时，
完成对应修复与 focused mechanical proof，记录
`SELF_REVIEW_ROUND_LIMIT_REACHED_FIX_APPLIED_CONTINUE` 并直接进入下一节点；禁止第三轮，
不得因此暂停整个实施。仍需 Claude 判断的语义风险进入最终 review input，但不触发中途 Claude
review。SR 由实施 agent 自己完成，是连续实施的质量闸，不冒充独立或 Claude review；Claude
只在完整 DESIGN 形成后进入 DESIGN review cycle，在最终 IMPLEMENTATION 整体完成后进入
IMPLEMENTATION review cycle；两个 cycle 都可包含整改后的复核，不限制为单次结论。

任一状态 FAIL 时，agent 必须保留 first failure 和其他 lane 的完整终态，按固定顺序重读
project memory → operation requirement/design row → owning source，并扫描 contract/backend/
consumer 同根影响面；根因修复后先复跑 impacted subset，再从失败状态继续。禁止跳到下一状态、
删除断言、调高预算、扩大 exception、只重试、延长 timeout 或用 seed 充抵。只有无法从权威
材料裁定的产品语义或超出上述条件授权的外部动作才可中断交 Dexter；普通实现失败不拆包、
不触发中途 Claude review；未到两轮上限时根因修复后继续本节点 SR，达到上限后修复并做
focused mechanical proof 即继续下一节点。

## 10. Red-mutation matrix

| family | production validator | scratch mutation | stable failure |
|---|---|---|---|
| scenario design | implementation-design-granularity | 删除任一六字段 | `BACKEND_ACCEPTANCE_SCENARIO_FIELD_MISSING` |
| route freshness | operation bindings preflight | 保留 rows、改 producer digest | `STALE_ROUTE_OR_BINDING` |
| uncovered ratchet | backend-acceptance preflight | entry 后新增 ledger row | `KNOWN_UNCOVERED_MONOTONICITY_VIOLATION` |
| new operation | backend-acceptance preflight | 新 route 同时塞进 current ledger | `UNCOVERED_OPERATION` |
| business | HTTP harness | 返回 schema 合法的错误业务值 | BUSINESS FAIL |
| measurement integrity | HTTP harness + sink | sink no-op、漏任一 metric 或错绑 correlation | `MEASUREMENT_SINK_INTEGRITY_FAILED` |
| performance | baseline comparator | 校准 PASS 后 CONNECTION/TRANSACTION/SQL 超 accepted | PERFORMANCE FAIL |
| impact | change-impact | 改 adapter 无 disposition | `IMPACT_DISPOSITION_MISSING` |
| behavior unchanged | change-impact | 四维一项漂移 | `BEHAVIOR_UNCHANGED_EVIDENCE_MISMATCH` |
| bug red proof | change-impact | case 在 pre/post 都 PASS | `BACKEND_ACCEPTANCE_BUG_FIX_RED_PROOF_REQUIRED` |
| anti weakening | change-impact | 删 assertion 标 tightened | `SCENARIO_DIRECTION_INVALID` |
| relaxed oracle | change-impact | 无 sourceRef | `SCENARIO_RELAXATION_AUTHORITY_REQUIRED` |
| consumer | change-impact | schema 改动无 face disposition | `CONSUMER_FACE_DISPOSITION_MISSING` |
| consumer evidence | change-impact | 自由文本、未知枚举、缺证据或 PENDING | `CONSUMER_FACE_DISPOSITION_INVALID` / `CONSUMER_FACE_EVIDENCE_MISSING` / `CONSUMER_FACE_PENDING_FORBIDDEN` |
| owner mapping | backend-acceptance preflight | 新 owner 无显式 module/provider root | `BACKEND_ACCEPTANCE_OWNER_MODULE_UNMAPPED` |
| source integrity | change-impact | 伪造 sourceSha | `SOURCE_ANCHOR_HASH_DRIFT` |
| fail-safe ALL | change-impact | 改 entry W0 外 production input 但 subset | `IMPACTED_OPERATIONS_ALL_REQUIRED` |
| immutable W0 | change-impact | 同包重生成 inventory 纳入新文件 | `ENTRY_ANCHOR_SET_IMMUTABLE` |
| union delta | change-impact | 删除/重命名 entry 文件但只扫 P1 | `PRODUCTION_SURFACE_DELTA_INCOMPLETE` |
| lane isolation | runner self-test | 两 lane 同 DB/schema | `LANE_WRITABLE_NAMESPACE_COLLISION` |
| lane independence | runner self-test | 一 lane fail 取消 siblings | `LANE_FAILURE_PROPAGATION_INVALID` |
| full-mode capacity | runner preflight | resource maximum 小于按 full weight 反推的 minimum 仍启动或缩面 | `BACKEND_ACCEPTANCE_FULL_MODE_CAPACITY_INSUFFICIENT` |
| fail-fast | runner self-test | container-init 先于 admission | `ADMISSION_AFTER_INITIALIZATION` |
| terminology | project-memory validator | 后台性能测试映射 testing | `BACKEND_ACCEPTANCE_ALIAS_SPLIT` |
| historical seed replay | backend-acceptance preflight/exit | 删除一条 finding、把性能回归标成已覆盖、仅让 CONNECTION 回落、用稳定快照理由恢复普通 read-only transaction、缺 QUERY disposition、non-route 只填 route 集合却无 source-derived 推导，或引用陈旧 proof | `BACKEND_ACCEPTANCE_HISTORICAL_FINDING_MISSING` / `BACKEND_ACCEPTANCE_HISTORICAL_PERFORMANCE_REGRESSION_NOT_ADDED` / `BACKEND_ACCEPTANCE_HISTORICAL_PERFORMANCE_TRIPLE_METRIC_CLOSURE_FAILED` / `BACKEND_ACCEPTANCE_HISTORICAL_TRANSACTION_REASON_INVALID` / `BACKEND_ACCEPTANCE_HISTORICAL_QUERY_DISPOSITION_INVALID` / `BACKEND_ACCEPTANCE_HISTORICAL_AFFECTED_ROUTE_DERIVATION_INVALID` / `BACKEND_ACCEPTANCE_HISTORICAL_ROUTE_PROOF_STALE` |

所有 mutation 使用 scratchpad copy，调用 production 路径；不在 production 文件上做破坏性变异。

## 11. Package-exit 六类 source 分母

每个 BA unit 的 granularity manifest 必须声明：

1. `PROJECT_MEMORY_ASSERTION_OCCURRENCES`；
2. `APPROVED_ASSERTIONS`；
3. `FORBIDDEN_PSEUDO_FIXES`；
4. `DETAIL_DESIGN_COMPLETION_AND_INCREMENTAL_CRITERIA`；
5. `OWNED_SURFACE_AND_OPERATION_KEYS`；
6. `DUE_STANDARDS_RULE_IDS`。

implementation package 另做 actual changed-path、Pre/Post receipt、change-disposition 与六类分母
exact reconciliation。单项 checker、mapping 或动态 PASS 均不替代 package exit。

## 12. 设计验收边界

本设计只允许进入唯一 DESIGN review。GO 前不授权当前包实施或运行；GO 后按第 1 节 Dexter
条件授权立即建立一个 implementation package，并严格执行 9.4 的完整连续状态机。当前没有
动态、业务、performance 或 cleanup 结论，`backend-acceptance` 公共入口仍不存在，属于诚实的
`NOT_IMPLEMENTED_DESIGN_ONLY`。
