# SUPERSEDED — 2026-08-14 Dexter 裁定：provider/registry 是待办目录，不是 scenario 实现；当前唯一目标是 getPublicInvitationView 的真实 HTTP CONTRACT/BUSINESS 断言与信息性 DB 调用数。

不得再以本文重开 package entry/exit、P0/W0/P1、receipt、hash-chain 或 successor I0；保留的历史 scenario、lane 与测试骨架不构成本批交付。

# 后台统一测试能力标准

- status: `DECIDED`
- machineId: `backend-acceptance`
- verdictKind: `BACKEND_ACCEPTANCE`
- decisionOwner: Dexter
- effectiveDate: 2026-08-13

## 1. 唯一术语与完成声明

“完成后台功能测试”“后台统一测试”“后台验收”“后台功能测试”“后台性能测试”与
“接口测试”在本仓统一路由到 `backend-acceptance`。功能与性能不再形成两条后台
动态验收能力。正式能力名、公共命令、运行目录、测试类、日志前缀和报告 kind
不得包含接口数量、`P4`/`P5`、`BPF`、Roadmap/Journey/阶段编号或
`performance-only`、`functional lane`、`performance lane` 等分立名称。

“后台功能测试已完成”只允许由同一次 fresh `BACKEND_ACCEPTANCE` 执行的
`CONTRACT`、`BUSINESS`、`PERFORMANCE`、`CLEANUP` 四维结果共同证明；任一维
FAIL 或 NOT_RUN，`OVERALL` 即不得为 PASS。静态门、编译、ArchUnit、seed、DEV、
测试类计数或历史 PASS 只保留自己的职责，均不得充抵该声明。

## 2. Operation 分母与四维职责

分母由当前 semantic OpenAPI route registry 与 operation-handler bindings 的 identity
row 双向 exact set 派生，不由测试类数量、历史接口总数或手工 allowlist 派生。
“identity row 集合相等”与“route/binding 投影 digest 新鲜”是两个独立判据，任一不符
均 fail closed。

每个当前 operation 的 route scenario 通过真实 HTTP、真实 PostgreSQL/对象存储容器，
在同一 correlation 下给出：

- `CONTRACT`：统一 OpenAPI、成功信封与 Problem 校验器；
- `BUSINESS`：逐 operation 的 fixture、request 与业务真值；
- `PERFORMANCE`：仅确定性结构计数，包括 logical SQL、QUERY、UPDATE、CONNECTION
  borrow、TRANSACTION 与 batch 退化；
- `CLEANUP`：fixture namespace、数据库/schema、对象存储及受管进程/容器的回收。

本轮不把容器内时延、预热、采样、percentile 或真实数据量 wall-clock 设为硬预算；
它们属于后置研究，不得回流成 performance-only 测试。

## 3. Scenario contract 设计准入

任何新增或修改 operation 的 implementation-facing 设计必须逐 operation 提供非空
`identity`、`fixture`、`request`、`businessOracle`、`performanceCriterion` 与
`cleanup` 草案；缺项以 `BACKEND_ACCEPTANCE_SCENARIO_REQUIRED` 拒绝进入设计 review。
`correctnessCases` 可以为空，但必须给出一行与 operation 语义一致的理由；
`contractOracle` 由统一 validator 对全部 operation 承担，不是逐 operation 人工字段。

## 4. 执行、迁移与退役

### 4.1 计量完整性

每次动态 operation batch、首次 accepted baseline 写入及 baseline 下降前，必须先运行
fixture-defined known-cost 校准。LOGICAL_SQL、QUERY、UPDATE、CONNECTION、TRANSACTION、BATCH
的 expected 值从不可变 fixture 定义独立推导，不得由 measured output 回填。任一 metric 少计、
多计、缺失、sink no-op 或 correlation 错绑都必须以 `MEASUREMENT_SINK_INTEGRITY_FAILED` 红；
校准未 PASS 时禁止建立、降低或消费 performance baseline。

### 4.2 Full-mode capacity

当前 checked-in production Java 的 entry anchor 覆盖为 128/571，因此 `ALL` 是正常容量模型，
不是低频兜底。per-edit 最小 lane 数必须从 full current denominator 的 fresh scheduling weight
与时间目标反推，并受真正隔离的 resource manifest 上限约束。资源不足时 fail closed；提速只能
增加隔离 lane、复用每 lane 初始化或修复 runner 开销，禁止缩 operation、四维、fixture 或 cleanup。
未来降低 ALL 频率只能提高 source-derived anchor 覆盖率，禁止增加路径豁免。

### 4.3 Owner provider 与 consumer disposition

module-owned scenario provider 必须通过 review-bound execution contract 的封闭
owner→Gradle module→test-fixtures root 映射机械物化；未知 owner、路径碰撞、集中放置或按 owner
字符串同名猜目录都 fail closed。route/schema/error 变化的 consumerFace 必须使用封闭 typed
disposition 并提供规定 digest、兼容性或整改依据；自由文本、“稍后处理”、缺证据和 PENDING
均不是合法处置。

per-edit 只运行机器推导的受影响 operation；package-exit 必须运行全量。影响面必须绑定
package-entry 的不可变基线：`P0` 是 entry 时完整后台 production surface，`W0` 是 entry
inventory 可复算 anchor 覆盖集，`P1` 是 exit 时同口径 surface。validator 独立比较
`P0 ∪ P1` 的文件存在性与全文件 hash；任一变化文件不在 `W0` 时影响面直接是 `ALL`，
同包重生成 inventory 不得改变 `W0`。不得为了分钟级缩小覆盖。提速先增加可配置且隔离的
lane：每 lane 独立容器、可写数据库/schema 与对象存储 namespace；单 lane 首败只停本
lane，其他 lane 继续并保留各自首败。

迁移期使用只减不增的 `KNOWN_UNCOVERED` 台账。新 operation 永远不得加入台账，因而
第一天即 fail closed；台账清空才表示迁移完成。已有 route 预算必须在 HTTP 边界重新
实测，不从方法级 SQL 台账换算；route 预算建立后删除对应旧 row。已有 owner/service
行为断言逐条迁入 route scenario 后默认删除，只有不触库、不过事务、不跨 owner 的纯
算法、mapper、parser 可进入封闭有限保留清单，且不产生总体功能或性能 verdict。

### 4.4 历史 seed finding 必须逐项迁移

`doc/evidence/platform/2026-08-13-v2s-backend-acceptance-historical-seed-findings.json` 是实施期
不可省略的历史回放分母。它明确包含：

- 6 条 CONNECTION 回归：`getOperationsCatalogWorkbenchContext`、
  `getOperationsCatalogNavigation`、`getOperationsCatalogDictionary`、
  `getOperationsCatalogItem`、`getOperationsCatalogItems`、`getOperationsInventoryTargets`；
- 15 个 HTTP failure family：asset staging 500、platform admin create 422、invitation credentials
  422、store create 403、workspace accounts 500、invitation OTP 500、commercial-group initialize
  409/422、group-workspace create 422、region create 400、invitation readback 404、operations session
  500、invitation reissue 200 但契约不可分类、catalog workbench 403、catalog item save 409、operations
  workspace login 401；
- 8 个 seed/client/fixture failure family：revision 对账、schema 缺失、bootstrap 非空冲突、owner
  chain 不完整、expired invitation terminal fixture、display-name readback、canonical BOM target 与
  product-SKU owner ref 缺失。

实施必须逐 findingId 形成 schema-valid disposition 与 fresh route 证据。六条结构回归必须新增
route regression，并在等价调用语义下证明每调用 QUERY、CONNECTION、TRANSACTION 均不高于各行
DBCR 前 baseline；只让 CONNECTION 回落不构成闭合。每条 QUERY 必须明确为已降至 fresh n 或逐条
证明当前 counted query 最小。恢复 read-only transaction 只允许用于连接经济性，不得以 PostgreSQL
默认 READ COMMITTED 下的稳定快照或读一致性为理由。HTTP 与 non-route 行即使最终证实是
seed/fixture 问题，也必须绑定 owning source、受影响 route exact set、source-derived 推导方法及当前
contract/business/cleanup proof。历史 run 只证明“必须处置”，不证明
当前仍有 bug，也不能充抵当前 PASS。少行、多行、PENDING、自由文本、旧 PASS 或陈旧 proof 均
fail closed；禁止用“历史问题已回放”作为验收证据。

## 5. 变更联动与反弱化

package exit 先从 entry inventory 形成不可变 `W0`，再独立扫描 entry/exit 的完整 production
surface 形成 `P0/P1`。`D` 是 `P0 ∪ P1` 中存在性或全文件 hash 变化的文件；`D - W0`
非空即 `IMPACTED_OPERATIONS=ALL`，否则把 entry inventory 中 anchor source path 属于 `D`
的全部 operation 纳入影响面。新增、删除、重命名均由 `P0 ∪ P1` 捕获；路径必须仓根相对、
去重且不得逃逸。entry inventory 缺失、不可读、hash 不可复算或同包自报的新 whitelist
均 fail closed。

production surface 不是手写共享基础设施清单：它至少由 Gradle `main` source sets 自动派生
全部 production Java/resource，并把会改变后台编译或运行行为的 app/module build 配置、
权威 generator 输入与产物纳入同口径 manifest。任何该 surface 内未被 entry anchor 覆盖的
变化都走 `ALL`。operation row、route/schema/error contract digest 的变化另直接并入影响面
和 consumer disposition，不依赖 Java anchor 是否变化。

每个受影响 operation 必须精确三选一：`SCENARIO_UPDATED`、`REGRESSION_ADDED`、
`BEHAVIOR_UNCHANGED`。前两项必须有实际 scenario/case digest 变化；后一项必须由 contract
digest 未变且 fresh 四维实测等于 accepted baseline 机器背书，不接受自由文本或 PENDING。

BUG_FIX 包至少一个 scenario 必须在修复前字节 FAIL、修复后 PASS。无法 route 表达时只可
进入封闭例外清单并说明理由，或显式登记为未受回归保护的修复；不得沉默通过。
`SCENARIO_UPDATED` 必须声明 `ORACLE_TIGHTENED`、`ORACLE_ADJUSTED_TO_NEW_SPEC` 或
`ORACLE_RELAXED`；后两者分别引用新规范或明确放宽依据，“测试跑不过”不是依据。route、
schema 或错误契约变化还必须处置 inventory 已声明的 `consumerFace`。

## 6. Seed 与其他证明边界

seed 的唯一职责是为 DEV 提供完整可体验数据。seed 可以暴露问题，但不是后台功能或性能
检查方法，不进入 `BACKEND_ACCEPTANCE` verdict，也不得作为 accepted performance baseline。
编译、静态契约生成、ArchUnit 与源码机械门继续存在，因为它们证明不同职责；只有与后台
动态行为重复的旧测试在 route 覆盖和断言迁移后退役。

## 7. 授权边界

本 decision 固化术语、规范与未来实施准入，不授权执行 Testcontainers、DEV、L2、reset、
seed、浏览器、UAT、部署或手工 SQL，也不恢复已终止的 DBCR package。当前旧 runner、
旧数字命名或历史 PASS 在迁移完成前只能作为 predecessor 资产，不能被称为
`backend-acceptance` 已实现或已通过。
