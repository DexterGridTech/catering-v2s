# SUPERSEDED — 2026-08-14 Dexter 裁定：provider/registry 是待办目录，不是 scenario 实现；当前唯一目标是 getPublicInvitationView 的真实 HTTP CONTRACT/BUSINESS 断言与信息性 DB 调用数。

不得再以本文重开 package entry/exit、P0/W0/P1、receipt、hash-chain 或 successor I0；保留的历史 scenario、lane 与测试骨架不构成本批交付。

# Backend acceptance 统一后台测试能力·合并需求基线（修订版）

- status: `REVISED_AWAITING_DESIGN_REVIEW_CYCLE`
- machineId: `backend-acceptance`
- supersedes: 本文件修订前版本，以及将功能、契约、性能拆成不同后台动态验收入口的方案
- implementationAuthority: `false`
- runtimeAuthority: `false`
- seedResetAuthority: `false`
- reviewedInput: `doc/review/platform/2026-08-12-v2s-unified-backend-test-capability-merged-requirements-review-claude.md`
- standardInput: `doc/review/platform/2026-08-12-v2s-backend-acceptance-standard-and-landing-points-claude.md`

## 0. 用户目标与本轮边界

Dexter 要的不是再增加一种测试，而是把后台动态行为的完成标准收敛成一个便宜、可信、
会自动接纳未来接口的能力：真实 HTTP 同时验证接口形状、业务真值与确定性 DB 开销，且
cleanup 可证。以后“完成后台功能测试”“后台性能测试”“接口测试”均只指向
`backend-acceptance`。

本文件是需求基线，不实施 runner，不运行 Testcontainers、DEV、L2、reset、seed、浏览器、
UAT、部署或手工 SQL，不恢复已终止的 DBCR package。

## 1. 核心裁决

一次 fresh 受管执行对同一 operation identity 与 correlation 给出：

1. `CONTRACT`：HTTP status、OpenAPI schema、成功信封与 Problem 契约；
2. `BUSINESS`：fixture 前置、请求、状态变化、拒绝语义与 owner readback；
3. `PERFORMANCE`：logical SQL、QUERY、UPDATE、CONNECTION borrow、TRANSACTION、batch
   退化等确定性结构计数；
4. `CLEANUP`：运行产生的数据库/schema、对象存储 namespace、容器与受管进程回收。

四维任一 FAIL/NOT_RUN，`OVERALL` 不得 PASS。编译、静态契约门、ArchUnit、源码机械门、
seed、DEV、测试类数量与旧 PASS 均不构成该结论。

### 1.1 明确不采用

- 不以 seed 作为功能/性能测试。seed 只提供 DEV 完整体验数据；它有顺序、状态积累与
  真实数据构造职责，不能成为可重复 accepted baseline。
- 不按 Testcontainers 类枚举覆盖。类是实现资产，不是 semantic HTTP operation 分母。
- 不保留分立的 functional/performance workload，也不以固定接口数量命名。
- 不为每个 operation 建时延、预热、采样、percentile 硬预算；容器噪声会让唯一后台行为
  门 flaky，增加并行资源也不能使噪声变成真值。

### 1.2 选择 C-min

选择最小同效方案：统一 route behavior、统一分母、统一四维报告；contract 由一个通用
validator 覆盖全部 operation；性能只做零采样的确定性结构计数；逐 operation 人工语义只
写 fixture、request、businessOracle，并明确 cleanup 与结构预算。它能直接捕获连接、事务、
SQL 或 batch 回归，而不建设企业级时延平台。

## 2. 当前事实基线（诊断值，不是冻结分母）

- 当前两份 generated route projection 与 bindings 的 operation identity row 集合双向相等；
  任何当前总数都只可作为诊断输出，不可写进成功判据。
- `scripts/check/operation-handler-bindings` 当前 fresh 运行失败：
  `BP_U02_ROUTE_SOURCE_DIGEST_DRIFT`。漂移只在 catalog-inventory route source metadata。
  这证明 row 集合相等与 projection digest 新鲜是两个独立判据。
- 后台 test source 与 `@Testcontainers` 类数量只描述迁移资产，不描述 HTTP 覆盖。
- 本轮独立复算 checked-in `src/main/java` 为 571 个文件；inventory 的 848 个 Java anchor
  只覆盖其中 128 个文件，盲区 443 个（77.58%）。inventory 另覆盖 1 个 build-generated
  Java 文件，所以不能把“129 个 anchored path”误写成 checked-in 覆盖 129。若按当前有效
  compiled main（含 generated）计，分母 616、覆盖 129、盲区 487。`modules/foundation`、
  `DatabaseOperationTracker`、`HttpRequestMetricsInterceptor`、`EdgeWebConfiguration`、
  DataSource/连接池配置均有零 anchor 样本；仅按当前 anchor 反查会错误推出空影响面。
- P4 canonical ledger fresh 静态检查为 28 row、26 个 callerSymbol、52 case；其中 callerSymbol
  不是唯一键，完整 candidate identity 才唯一。其方法级 `EXACT_SQL_STATEMENTS` 与 HTTP
  四维预算不可换算。
- 现有远端 runner 的 work stealing 与 lane-local first failure 源码语义可复用，但 lane 数在
  runner、daemon 与 path 校验中硬编码为 3；“可配置 lane”尚未实现。
- 历史 seed 对比数字未经本轮逐报告重算，本基线不引用其具体数值，也不拿它证明性能事实。

## 3. 动态 operation 分母

每次运行从当前 semantic source 派生：

```text
OpenAPI route registries
  -> operation identity rows
  -> operation-handler bindings
  -> owning route-behavior unit
  -> scenario contract
  -> execution receipt
```

identity 至少包含：

```text
operationId + method + normalizedPath + consumerFace + owner
```

production validator 必须分别执行：

1. route registry union 与 bindings 的 identity row 双向 exact set；
2. route source contractDigest/contentSha256 与当前 producer projection 完全一致；
3. operation ↔ owning unit ↔ scenario ↔ execution receipt 四组 exact set。

只比较总数、固定 N、测试类数量、宽 glob、单向 subset 或陈旧 projection 一律失败。

## 4. Scenario contract

每条 operation 的强制非空字段：

| 字段 | 最小语义 |
|---|---|
| `identity` | operationId/method/path/consumerFace/owner 与 owning unit |
| `fixture` | 通过公开 owner lifecycle 建立的前置状态与 namespace ownership |
| `request` | path/query/header/body 的非敏感形状与 symbolic secret handle |
| `businessOracle` | 业务返回、状态变化、拒绝与 owner readback 真值 |
| `performanceCriterion` | accepted baseline 下的确定性结构计数预算 |
| `cleanup` | 数据库/schema、资产、容器、进程回收与 readback |

`correctnessCases` 可为空，但须一行解释为什么授权、拒绝、幂等、CAS、重放或 scope case 对
该 operation 不适用；不得制造形式化伪声明。`contractOracle` 不作为逐 operation 字段，由
统一 OpenAPI + envelope + Problem validator 对全部 operation 生效。

新增或修改 operation 的 implementation-facing 设计缺上述任一字段时，在 review 前以
`BACKEND_ACCEPTANCE_SCENARIO_REQUIRED` fail closed。自动化负责发现缺项，不猜业务真值。

## 5. 业务断言与旧行为测试处置

`ROUTE_BEHAVIOR` 是后台动态行为唯一常设类别。迁移现有 owner/service/HTTP 测试时先做
assertion-level inventory，逐条把独有业务真值并入 route scenario；不得因文件退役丢断言。

`OWNER_LOGIC` 只允许作为过渡类别。某 operation route 覆盖建立后，相关 owner 行为测试默认
删除。唯一保留例外是“不触库、不过事务、不跨 owner”的纯算法、mapper、parser；例外进入
封闭有限清单，逐条写理由，不产生后台总体功能或性能 verdict，也不得开放式新增。

编译、静态契约生成、ArchUnit 与源码机械门职责不同，不在行为测试删除范围。

## 6. 确定性性能口径

统一权威计量是既有 `DatabaseOperationTracker` 与 HTTP correlation 的同层投影，只增加测试
可见 in-JVM sink，不建第二计量层。每个 operation 按实际语义声明适用指标：

- logical SQL/总 DB operation；
- QUERY；
- UPDATE；
- CONNECTION borrow；
- TRANSACTION；
- batch size/round-trip 退化。

accepted baseline 是独立的单调棘轮：下降可直接收紧；上调必须引用 previous/current、具体
归因、owning source 或产品/契约依据和明确批准状态。当前值与接受基线不得在同包静默一起
调高。容器时延、percentile 与真实数据量研究登记 `HANDOFF.md`，不是本门完成条件。

### 6.1 P4 处置

不做“迁移校准”。某 HTTP operation 获得重新实测的 route 预算后，直接删除其对应 P4 row；
旧方法级 case 值不提供换算输入。无法映射 HTTP operation 的剩余 row 只有满足纯算法保留
判据时才可进入同一封闭例外清单。迁移期 P4 不产生后台总体性能 verdict，不与 tracker 数字
互引。

## 7. KNOWN_UNCOVERED 单调迁移台账

为了避免新门在迁移数周内恒红，建立 package-entry 捕获的 `KNOWN_UNCOVERED`：

1. 只允许删除，不允许增加或替换；
2. 当前 uncovered set 必须是 entry 台账的 subset；
3. 新 operation 不存在于 entry 台账，因此第一天即 `UNCOVERED_OPERATION`；
4. 已覆盖 operation 必须四维通过；
5. 台账清空才表示迁移完成。

台账不是永久豁免，不能由当前 scan 反向生成，也不能用“暂不做”自由文本扩张。

## 8. 两层受管执行与并行

### 8.1 Per-edit

只运行变更联动门机械推导的 impacted operations。目标为分钟级，但时间约束不能缩覆盖：
package-entry 的不可变 production surface `P0` 与 anchor-covered `W0`、exit 的 `P1` 共同
决定影响面；`P0 ∪ P1` 中变化但不在 `W0` 的任一 production input 令 impacted set 为 ALL，
即使因此超过分钟级也必须跑。

### 8.2 Package-exit

全量运行当前 operation denominator，只有它产生完整 `BACKEND_ACCEPTANCE` verdict。
提速顺序固定：增加隔离 lane → 到远端资源上限后才评估最弱非覆盖维度；任何情况下不砍
operation 覆盖。

lane 数可配置，不能硬编码 3。每 lane：

- 一次初始化 source/JVM/container 环境；
- 独立容器、可写数据库或 schema、对象存储 namespace；
- 串行执行分配到的 route units；
- 首败只停本 lane，其他 lane 继续；
- 空闲时只领取 fixture ownership 独立且尚未开始的 unit；
- 产出本 lane first failure 与 cleanup。

多 lane 共享可写库、共享对象 namespace 或一处失败取消全部 lane 均是 runner failure。

## 9. 运行可观测性

公共入口唯一命名为 `scripts/test/backend-acceptance`。启动前完成 runtime/image/disk/namespace、
denominator digest 与 scenario admission；不得先起容器再报缺声明。

固定证据根：`.runtime/backend-acceptance/<runId>/`。stdout、manifest 与结构化日志持续输出：

```text
runId / laneId / discovered / running / passed / failed / remaining
currentOperation / elapsed / heartbeat / firstFailure / logPath
```

每类失败有稳定错误码、operation identity、维度、expected/actual、fixture/runId、日志路径与
单 operation 重跑命令。Gradle exit、测试名或“workload failed”不能代替诊断。敏感请求值只
以 run-scoped 内存 handle 注入，不进入 manifest、日志、report 或错误输出。

## 10. 变更联动门

### 10.1 自动影响面

复用现有 operation source inventory 的 edge/adapter/transaction/ownerBoundary 映射，但绝不
把同包 exit inventory 当作 whitelist。package-entry 必须保存不可变：

- `P0`：由 Gradle `main` source/task inputs 与权威 generator task inputs 自动派生的完整
  repo-owned production surface，保存规范化仓根相对路径、存在性和全文件 SHA-256；
- `W0`：entry inventory 中 source path 与 hash 均可复算、路径合法且属于 entry production
  source 的 anchor-covered set，以及 path → operations 反查；
- entry semantic operation rows 与 route/schema/error/consumer digests。

package-exit 用同一 derivation 生成 `P1`，并独立计算：

```text
D = { path in P0 union P1 | existence changed or full-file SHA-256 changed }
if D - W0 is not empty:
  IMPACTED_OPERATIONS = ALL
else:
  IMPACTED_OPERATIONS += every entry operation anchored to any path in D
IMPACTED_OPERATIONS += operations changed by identity/route/schema/error digest
```

`P0 ∪ P1` 捕获新增、删除与重命名。路径逃逸、重复、entry 缺失/不可读、anchor hash 不可
复算、同包重生成 inventory 试图扩大 `W0` 均 fail closed。production surface 的规则从 Gradle
source sets、compile/processResources/task inputs 与 generator dependency graph 派生，不能替换
为手写“共享基础设施路径清单”。因此 Java、resource、build/runtime 配置或 generator 输入中
任何未被 entry anchor 覆盖的变化都保守提升为 ALL。

### 10.2 强制 disposition

每条 impacted operation 精确三选一且无 PENDING：

- `SCENARIO_UPDATED`：scenario digest 必须变化，并声明
  `ORACLE_TIGHTENED` / `ORACLE_ADJUSTED_TO_NEW_SPEC` / `ORACLE_RELAXED`；后两者引用依据；
- `REGRESSION_ADDED`：新 case identity 与 digest 必须真实出现；
- `BEHAVIOR_UNCHANGED`：contract digest 未变且 fresh CONTRACT/BUSINESS/PERFORMANCE/CLEANUP
  与 accepted baseline 完全相等。

删断言、调高预算却标 tightened；relaxed 无依据；以“测试挡路”为理由，全部 fail closed。

### 10.3 BUG_FIX 红证与消费方

BUG_FIX 至少一条 scenario 在 preserved pre-fix bytes FAIL、post-fix bytes PASS。若无法 route
表达，只可进入封闭 route-unexpressible 清单；若无法建立保护，显式登记 unprotected fix。
两者都不得沉默通过。

method/path/schema/错误契约变化必须联动 inventory 的 `consumerFace` disposition；后端变化而
前端未处置不得收口。

### 10.4 历史 seed finding 不是一句话，而是明确回放分母

初次统一迁移必须消费
`doc/evidence/platform/2026-08-13-v2s-backend-acceptance-historical-seed-findings.json`，逐项关闭：

- 6 条 CONNECTION/TRANSACTION/QUERY 联合回归：catalog workbench、catalog navigation、catalog dictionary、catalog
  item detail、catalog item list、inventory targets；
- 15 个 HTTP failure family：asset staging 500、platform-admin create 422、invitation credentials
  422、store create 403、workspace accounts 500、invitation OTP 500、commercial-group initialize
  409/422、group-workspace create 422、region create 400、invitation readback 404、operations session
  500、invitation reissue 200 但 response/readback 不可分类、catalog workbench 403、catalog item
  save 409、operations workspace login 401；
- 8 个 seed/client/fixture failure family：revision 对账、schema 缺失、bootstrap 非空冲突、owner
  chain 不完整、expired-invitation terminal fixture、display-name readback、canonical BOM target
  缺失、PRODUCT_SKU owner ref 缺失。

六条结构回归必须新增 route regression，并在等价调用语义下同时证明每调用 QUERY、CONNECTION、
TRANSACTION 不高于各行 DBCR 前 baseline；只让 CONNECTION 回落不构成闭合。每条 QUERY 必须
给出 `QUERY_REDUCED_TO_<n>` 的合并证据，或 `QUERY_ALREADY_MINIMAL` 的逐 statement 必要性证据。
恢复 read-only transaction 只允许用于连接经济性，不能以默认 READ COMMITTED 下的稳定快照为由，
且恢复本身不构成闭合。其余 finding 即使最终判定为 seed/fixture 缺陷，也必须给 owning source、
affected route exact set、source-derived 推导方法与 fresh contract/business/cleanup proof。历史 source
只证明“曾暴露且必须处置”，不预判当前仍有 bug；禁止用“历史问题回放完成”、旧 PASS 或 seed
总耗时下降收口。finding/disposition/evidence 三个集合必须双向相等且无 PENDING。

## 11. 串行实施顺序

一次设计 review、一次单批实施、一次 implementation review。实施内部严格串行：

1. 修复当前 route projection digest/source-map 基线漂移；
2. 上线 operation denominator、scenario schema、design admission 与 KNOWN_UNCOVERED；
3. 上线唯一 runner、通用 contract validator、in-JVM tracker sink、可配置隔离 lanes；
4. 上线变更联动门、BUG_FIX red proof 与 consumerFace disposition；
5. 按 owner/package 迁入 route scenarios 与业务 assertions，同时重新实测结构预算，并逐
   findingId 关闭 6 条性能回归、15 个 HTTP family 与 8 个 seed/fixture family；
6. route 预算建立即删除对应 P4 row；route 覆盖建立即删除对应旧行为测试；
7. KNOWN_UNCOVERED 清空，OWNER_LOGIC 只剩封闭合法例外；
8. fresh full 四维 PASS 且 cleanup PASS 后，按 exact-set 退役旧分立 runner、固定数字契约与
   重复报告；
9. 唯一 implementation review 重开真实源码、runner、场景与 fresh evidence。

不得先删旧能力再建新能力，不得把迁移切成互不约束的功能/契约/性能项目。

## 12. Production validator 与真实 red mutations

每条 mutation 在 scratchpad current-tree copy 上驱动与 production 相同的 validator：

1. 新 operation 无 scenario 六字段 → `BACKEND_ACCEPTANCE_SCENARIO_REQUIRED`；
2. row set 相等但 route digest 过期 → `STALE_ROUTE_OR_BINDING`；
3. KNOWN_UNCOVERED 新增一条 → `KNOWN_UNCOVERED_MONOTONICITY_VIOLATION`；
4. 新 operation 试图加入 KNOWN_UNCOVERED → `UNCOVERED_OPERATION`；
5. 2xx/schema 合法但业务值错 → BUSINESS 红；
6. 结构计数超 accepted baseline → PERFORMANCE 红；
7. 改 adapter 无 disposition → package exit 红；
8. BEHAVIOR_UNCHANGED 但四维不同 → 红；
9. BUG_FIX case 在 pre-fix 也绿 → `BACKEND_ACCEPTANCE_BUG_FIX_RED_PROOF_REQUIRED`；
10. 删除断言/调高预算标 tightened，或 relaxed 无依据 → 红；
11. route/schema/error 变化无 consumerFace disposition → 红；
12. 伪造 sourceSha → current-byte hash 重算红；
13. 改未被 entry `W0` 覆盖的 production Java/resource/build/generator input 而 impacted set
    非 ALL → 红；
14. 新增未锚定文件后同包重生成 inventory 试图把它纳入 whitelist → self-admission 红；
15. 删除或重命名 entry 文件但差异扫描只看 exit paths → 红；
16. 多 lane 共享可写 namespace → isolation 红；
17. 一 lane fail 导致其他 lane 被取消 → scheduler self-test 红；
18. admission 发生在 container-init receipt 后 → fail-fast 顺序红；
19. “后台性能测试”路由到第二能力 → project-memory alias 红；
20. 静态/seed/旧 PASS 被写成完成声明 → acceptance claim 红。
21. 删除历史 finding、把六条性能回归标成“已覆盖”、只让 CONNECTION 回落、用稳定快照理由恢复
    普通 read-only transaction、缺 QUERY disposition、non-route route 集合无 source-derived 推导，
    仅写自由文本或引用陈旧 route proof →
    `BACKEND_ACCEPTANCE_HISTORICAL_FINDING_MISSING` /
    `BACKEND_ACCEPTANCE_HISTORICAL_PERFORMANCE_REGRESSION_NOT_ADDED` /
    `BACKEND_ACCEPTANCE_HISTORICAL_PERFORMANCE_TRIPLE_METRIC_CLOSURE_FAILED` /
    `BACKEND_ACCEPTANCE_HISTORICAL_TRANSACTION_REASON_INVALID` /
    `BACKEND_ACCEPTANCE_HISTORICAL_QUERY_DISPOSITION_INVALID` /
    `BACKEND_ACCEPTANCE_HISTORICAL_AFFECTED_ROUTE_DERIVATION_INVALID` /
    `BACKEND_ACCEPTANCE_HISTORICAL_EVIDENCE_MISSING` /
    `BACKEND_ACCEPTANCE_HISTORICAL_ROUTE_PROOF_STALE`。

## 13. 最终验收

- `KNOWN_UNCOVERED=[]`；
- current operation ↔ unit ↔ scenario ↔ execution receipt ↔ 四维结果 exact set；
- projection digests fresh；
- 全量 fresh CONTRACT/BUSINESS/PERFORMANCE/CLEANUP 全 PASS；
- OWNER_LOGIC 保留清单为空或为逐条合法的封闭有限集；
- 对应 P4 rows 与重复行为测试已按顺序删除；
- 公共入口、报告 kind 与成功条件不存在编号/阶段/分立性能命名；
- 旧资产退役 exact set 与保留的静态/架构/生成控制无误伤；
- 历史 6 条 performance、15 个 HTTP、8 个 non-route seed finding 的 typed disposition 与 fresh
  evidence exact set PASS；
- seed 只保留 DEV 数据供给职责。

## 14. 授权边界

本修订基线与规范落点不代表 `backend-acceptance` 已实现或已通过。当前 bindings digest 漂移、
固定三 lane 和旧测试资产都是未来实施输入，不在本设计包修复。完整设计文档与计划形成前不得
提前发起 Claude review；完整设计完成后进入 Claude DESIGN review cycle，允许按 finding 整改与
复核直至形成 GO/NO-GO。DESIGN GO 后才可按 §11 建立一个 package 连续实施；全部实施、动态验收
与 package exit 完成前不得提前送审，完成后才进入 Claude IMPLEMENTATION review cycle。
