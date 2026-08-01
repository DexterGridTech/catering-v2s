---
title: catering-v2s R5 whole-scope implementation-facing design
status: PROPOSED_REVIEW_ONLY
createdAt: 2026-07-25
programId: V2S_W0_W4_EXECUTION
roadmapStep: R5
reviewTarget: DESIGN
reviewCycleId: R5-W3-DESIGN-20260725
implementationAuthority: false
skillUsed: cs-writing-plans@local
remediationSkillUsed: cs-spec-to-plan@local
---

# R5 全范围 implementation-facing 详设与实施计划

## 0. 结论、授权与原子边界

R5 把 all-v2 **真实已实现**的 32 项业务场景迁入 v2s：保留两个独立 admin app，以一份
edge OpenAPI、一个 Spring Boot 业务 deployable、一个 PostgreSQL 数据库、七个 owner schema
和单一 Flyway history 重构后端；前端按 Dexter 裁决全部以 v2 线框与已实现页面为基线，
优先搬运/适配并消费 `libraries/frontend/admin-ui-foundation`。

R5 是一个原子交付：

```text
32 项 Journey 分母
  -> A：105 项 v2 候选先辩证评估，再冻结 104 项 edge contract
  -> B：七 owner 模块在一个 deployable 中一次完成
  -> C：两个 app 按 v2 页面一次搬运/适配
  -> D：完整 remote DEV + r5-full seed + 全量 evidence
  -> 一个 IMPLEMENTATION review target
```

A/B/C/D 和本文件的 12 个 unit 只用于依赖顺序、失败定位和 evidence 分账，不形成逐 Journey、
逐 unit 或逐波的产品确认、独立 handoff、review cycle 或 verdict。当前只授权设计、
manifest、独立子 agent 两轮盲审与 Claude handoff；`R5_IMPLEMENTATION_AUTHORIZED=false`，
本设计不得被解释为 contract、源码、migration、DEV、seed/reset 或动态运行许可。

冻结输入：

- Journey：`doc/decisions/2026-07-25-v2s-r5-whole-scope-journey-decision.md`
- 交互：`doc/decisions/2026-07-25-v2s-r5-whole-scope-interaction-design.md`
- 范围与方法：`doc/decisions/2026-07-25-v2s-r5-scope-and-method-decisions.md`
- operation 分母：`doc/plans/platform/2026-07-25-v2s-r5-edge-operation-inventory.md`
- interface 辩证评估：`doc/plans/platform/2026-07-25-v2s-r5-edge-contract-dialectical-assessment.md`
- 逐 operation implementation catalog：
  `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json`
- operation/组件文件落位：
  `doc/plans/platform/2026-07-26-v2s-r5-edge-contract-file-placement-catalog.json`
- error code 全分母 disposition：
  `doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json`
- Claude 五项裁决：
  `doc/decisions/2026-07-26-v2s-r5-claude-review-five-point-resolution.md`
- 开发 agent 低偏航蓝图：`doc/plans/platform/2026-07-25-v2s-r5-development-agent-execution-blueprint.md`
- 前端逐 surface 搬运表：`contracts/policy/frontend-asset-carryover-manifest.json`
- v2 有价值资产与 v2s 约束反向审计：
  `doc/review/platform/2026-07-25-v2s-r5-v2-value-and-v2s-constraint-audit-codex.md`
- DEV/seed fixture contract：
  `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json`
- business corpus：`project-memory/decisions/confirmed-business-language-corpus.md`
- enforcement 分母：`contracts/policy/standards-coverage-matrix.json`

## 1. 方案合理性与替代方案

### 1.1 用户任务

Dexter 最终需要在完整 DEV 中亲自使用平台端和运营端，完成空间、商业集团、组织、经营主体、
门店、轻合同、扩展字段、角色、邀请、任职、登录/session、本人凭据和平台管理员治理，并从
owner readback 验证每个结果。用户不是在验收“迁了多少文件”，而是在验收 32 项任务是否在
新边界下完整、即时一致且可恢复。

### 1.2 采用方案

采用“薄 Journey/交互冻结 → 全量 edge contract → 模块化单体后端 → 前端 carry/adapt →
完整 DEV/seed”的拓扑顺序。接口不是先于用户任务的产品真相，但一旦 Journey 与 v2 线框边界
冻结，接口必须先于后端和前端成为共同分母。

| 方案 | 结论 |
| --- | --- |
| 逐 Journey 重做需求、接口、页面和 review | 拒绝。需求分母已由 v2 实现态与 corpus 冻结，会重复 ceremony 并违背 R 原子交付。 |
| 直接搬 v2 服务、内部 client、MQ/outbox/投影和前端补偿 | 拒绝。把被 v2s 明确退役的分布式成本带回来。 |
| 先写后端，再根据实现补 OpenAPI | 拒绝。owner 与 consumer face 会被代码形状反推，双 app 无稳定共同分母。 |
| 把 v2 的 105 项原样塞进 app controller/service/repository | 拒绝。接口资产必须先按 Journey/owner 辩证处置；单 deployable 也不等于单模块。 |
| 建通用 BFF/组合查询模块 | 拒绝。任务型 query 应归发起用户任务的 application/read adapter，零自有事实；不新建万能聚合 owner。 |
| **七 owner 模块 + 任务型 join + 同事务公开 command API** | **采用。**最小化跨进程机制，同时保留 owner、不变量和未来拆分位置。 |

### 1.3 阶段成本

R5 一次性规模大，但需求漂移低。控制成本的方法不是拆成多个产品 review，而是：

1. contract、backend、frontend 依赖顺序固定；
2. 每个 unit 有 focused compile/test/evidence；
3. 最终 packet 按半小时可核 section 建 index；
4. R4 既有机械门持续运行，但不为每条业务语义再造 gate；
5. implementation 完成后才建立新的 `REVIEW_TARGET=IMPLEMENTATION` cycle。

## 2. Edge contract 设计

### 2.1 104 项唯一分母

`contracts/openapi/edge.openapi.yaml` 是正式实施后的唯一 wire 根入口；其引用的
`paths/<face>/<capability>.paths.yaml` 与 `components/<owner>/<schema-family>.schemas.yaml`
共同构成唯一 contract source truth。逐项 method/path/face 见 operation inventory：
`platform-admin=38`、`operations-admin=55`、`public=11`。
正式实施不得拆出第二 edge spec、内部 OpenAPI client、共享 generated model 或 app 间
generated import。

根入口不得内联 operation/schema。每个手写 contract YAML 只拥有一个 face+capability 或一个
owner+schema family，非空行上限为 500；达到上限必须按 read/command 或子能力继续拆分。
codegen 临时 bundle 可以是大文件，但不得成为 source truth 或手工编辑对象。开发 agent
必须在创建每个 operation 时直接落入既定分类，禁止先形成单体大文件再依赖末端整理。

104 项逐行冻结于 edge contract implementation catalog。该 catalog 同时给出
`Scenario↔operation` 双向 trace、owner、page/route anchor、security、query/request/
response、success status、idempotency、CAS、closed error set 与 focused test id；其中
`componentFieldBaseline + componentOverrides` 是 DTO 字段分母。正式 OpenAPI 必须逐项对账，
不得把 v2 schema 名当作全盘吸收理由，也不得在编码时新增未列字段或 alias。
`componentFieldBaseline.ref` 不是空白占位：它必须从 catalog 的 18 个 hash-locked schema
source 中唯一解析，再应用 `componentOverrides`；未解析、多重解析或 source hash 漂移均须在
生成前失败。`Problem`、`EpochMillis`、合同日期、门店合同衍生状态、角色两组授权字段与
StoreContract items 的目标字段均在 override 中完整给出。逐 operation 的 `capability`、
path file、request/response component file 与 content type 通过 file-placement catalog
唯一解析；U01 必须先输出 104 行 resolved report，任何开发 agent 不再拥有落位选择权。

该 104 不是对 v2 的全盘吸收：105 项候选先按 Journey、owner、task surface、拓扑与前端真实
消费逐组评估，删除重复的 `getWorkspaceRoleCandidates` 与未消费且会制造 TOCTOU 的
`checkOperationsPageEntryGuard`，新增 platform assignment revoke；asset content 改为 PUBLIC，
contract path 从 `/organization/contracts` 归回 `/contracts`。完整采纳、优化和拒绝理由见
interface 辩证评估。开发 agent 必须先读该评估，禁止以“v2 已有 operation”为单独实施理由。

R3 三项原位演进：

- `listPlatformGroupWorkspaces` 与 `getPlatformGroupWorkspaceDetail` 保持 GET，去除任何
  `Idempotency-Key`；
- `initializeCommercialGroup` 保持具名 command，并增加统一 header/Problem 约束；其六个已上线
  wire error code 保持 byte-identical，尤其
  `COMMERCIAL_GROUP_ALREADY_INITIALIZED`、`INVALID_EDGE_CONTEXT`，不得被通用码吞并；
- R5 不创建 `getPlatformGroupWorkspacePage` 或
  `initializePlatformCommercialGroupRoot` 同义 operation。

U01 必须把仓内 R3 当前字节作为显式 correction evidence，而不是只验目标：

| current R3 fact | R5 correction | regression proof |
| --- | --- | --- |
| 两个 GET 仍声明 required idempotency header | 删除 header；GET 上 header 为 FORBIDDEN | generated server/client signature 与 request test |
| Problem 使用 `code` 且无 `correlationId` | `errorCode` + 必填 `correlationId` + RFC7807 content type | six-code response fixture and client feedback map |
| route/registry 只有 platform slice | 根 `$ref`/bundle 支持三 face，R3 三 operation 仍只属 platform-admin | 38/55/11 face closure |
| 当前 R3 六码已有源码、脚本和 UI 文案消费 | 六码 byte-identical compatibility；新增 R5 码走 domain prefix catalog | backend assertion + generated enum + frontend text key three-way equality |

错误码不是由 83 个 v2 码坍缩成两个通用码。error-code disposition catalog 对 83 个 heritage
码、6 个 R3 码和 22 个 v2s-native 码逐条登记；除显式 R3 compatibility code 外，新码均
使用稳定 domain prefix。默认 operation 闭集为
`errorSetRef + operationErrorAugmentations[operationId]`；`initializeCommercialGroup`
按 `operationErrorSelectionRules` 以六个 R3 byte-identical 码替换 base set，禁止发同义
`PLATFORM_COMMON_*`。84 个 Heritage/R3 active target 与 22 个 v2s-native target 均至少
接入一个可达 operation；未列 error code 禁止出现在 wire、生成物或前端文案映射中。

### 2.2 wire 统一规则

| 维度 | 冻结设计 |
| --- | --- |
| workspace key | 外部一律 `groupWorkspaceKey`；platform **browser route** 不带 key，operations authenticated browser route 带 key；platform/operations **API path** 按 104-row catalog 可携带 `{groupWorkspaceKey}`。browser/API URL 都不授权。 |
| idempotency | 所有产生业务写效果的 POST/PUT/PATCH 使用 `Idempotency-Key` header，长度 16–128；GET 禁止声明。 |
| CAS | 聚合写 request 只使用 `expectedVersion`；`expectedRevision` 与 `expectedContextVersion` 禁止进入 command request。context/authorization 版本仍留在 session readback、query/cache/tag。 |
| pagination | `{items,page,pageSize,total}`；`sortKey/sortDirection` 为每 surface 闭集 enum。 |
| Problem | `application/problem+json` + RFC7807 基础字段 + uppercase domain-prefixed `errorCode` + 必填 `correlationId`；R3 六码为显式 compatibility exception，不改 wire 字节。 |
| time | 所有后台时间点固定为 wire `epochMillis(integer/int64)`、Java `long/Long`、PostgreSQL `BIGINT`（毫秒）；禁止 String/Java 日期时间对象/DB timestamp 作为持久化形状。纯业务日历日期仅合同 `effectiveFrom/effectiveTo`，固定为 wire `string/date`、Java `LocalDate`、PostgreSQL `DATE`；统一 `TimeProvider` 提供 instant，`BusinessDateProvider` 按 `Asia/Shanghai` 投影业务日。 |
| lifecycle | 简单闭集状态迁移使用 `POST .../{id}/status`；邀请取消、重发、完成、合同失效等保留具名 command。 |
| list/detail | 列表只给摘要和详情入口；修改动作在详情 surface；owner readback 返回 version/revision。 |
| extension | definition 宿主闭集仅 `BRAND/TENANT/HEAD_COMPANY/STORE/CONTRACT`。 |
| contract item | `items:[{code,name}]`；不得保留 `itemCodes[]` 或以 `VALID/INVALID` 冒充门店三态。 |
| asset | stage 返回 `assetRef` 与元数据；workspace command 只交 `logoAssetRef`，不暴露 `logoBindGrant`。 |
| role authorization | 单一命令包含 `pageAccessKeys` 与 `actionCapabilityKeys` 两个独立集合；分别校验、同事务原子替换，不互相推导。 |
| project phase | 项目只保存有序唯一 `phaseNames[]`；合同只存 `phaseNameSnapshot`，禁止 `phase_key/phaseKey`。 |
| store candidates | 邀请候选排除停用门店并在完成时重验；合同候选不得因门店停用而过滤或阻断，只返回状态。 |

### 2.3 operation → owner 分组

| operation group | owning module | 说明 |
| --- | --- | --- |
| platform auth/session/admin users | `platform-iam` | 平台 principal、credential、session、管理员治理；不创建默认/root。 |
| workspace list/detail/create/update/status | `platform-workspace` | 空间事实、展示字段、状态与 command receipt。 |
| asset stage/content/claim/release | `platform-asset` | asset bytes/metadata/lifecycle；claim 只经本地公开 API。 |
| commercial group/hierarchy/brand/tenant/head company/store/overview | `organization` | 固定三层组织、经营主体、门店关系与业务不变量。 |
| extension definition | `extension` | 五类 definition/revision；值保存在实体 owner。 |
| role/page/action/account/invitation/membership/operations session/public flows | `workspace-iam` | 账号、凭据、角色、准入、动作、任职、邀请、运营 session/context。 |
| contract/store contract read/platform overview | `contract` | 合同、货号二元组、失效和门店三态 task read。 |

任务型组合 query 可以显式 join 其他 schema，但归发起任务的 module application/read adapter：
workspace detail 可 join commercial group/asset；organization store form 可 join extension；
contract form 可 join organization/extension；workspace-IAM candidates 可 join organization。
它们没有表、repository 或业务不变量，不能被提升成通用 BFF。

## 3. 单体模块、依赖与事务

### 3.1 物理形态

```text
apps/backend/
├── catering-business-server/       # 唯一业务 deployable
└── terminal-data-server/           # 空占位；无 src/runtime/dependency/wire

libraries/backend/
├── platform-access/                # 可信 edge/context 与 web security adapter，无账号事实
├── platform-iam/                   # 平台身份 owner
├── platform-workspace/             # 集团空间 owner
├── platform-asset/                 # 媒资 owner
├── organization/                   # 组织/主体/门店 owner
├── extension/                      # definition owner
├── workspace-iam/                  # 运营身份与授权 owner
├── contract/                       # 轻合同 owner
└── platform-foundation/            # 无业务事实的窄基础能力
```

每个模块遵守 `generated interface → adapter/in → application → framework-free domain →
adapter/out`；对其他模块只公开 `<module>.api` command/judgment DTO。domain 不 import
Spring/JDBC/generated wire；controller 按 module adapter 归位；测试目录/包/类使用能力名，
不得使用 R/U/J/JG/PKG/G-* 流程编号。

`platform-foundation` 只承接开发蓝图 §2.4 已逐项批准的 correlation、脱敏日志、外部 HTTP
约定、无 wire Problem skeleton、TimeProvider、分页值与 DB 次数观测；OTP rate policy 移入
workspace-IAM，未绑定的 `AdvisoryLock` 不搬。
v2 messaging/projection repair、owner proof、internal service security、downstream Problem
translator 和旧 generated wire model 均不搬。foundation 不得依赖 owner、app、generated
wire 或业务 schema。

### 3.2 依赖 DAG

| from | to | kind | 原因 |
| --- | --- | --- | --- |
| catering-business-server `adapter.in.web` | platform-access + owning IAM public API | APP_ASSEMBLY | web adapter 先解析可信 face/correlation/cookie，再调用 platform-IAM 或 workspace-IAM session introspection；owner module 不反向依赖 platform-access |
| platform-workspace | platform-asset | COMMAND | create/update 在同一 `REQUIRED` 事务 claim/release Logo。 |
| platform-workspace | organization | COMMAND | 保留 R3 初始化商业集团命令。 |
| workspace-iam | platform-workspace | JUDGMENT/TASK_READ | 登录/切换时判断空间状态，不写空间。 |
| workspace-iam | organization | JUDGMENT/TASK_READ | 校验服务节点、门店启停和邀请候选。 |
| organization | extension | JUDGMENT/TASK_READ | 保存五类实体值前读取 definition/revision。 |
| contract | organization | JUDGMENT/TASK_READ | 校验门店/租户/分期快照并形成候选。 |
| contract | extension | JUDGMENT/TASK_READ | 保存合同扩展值。 |
| platform-workspace | organization/platform-asset | TASK_READ | workspace 列表/详情组合 readback。 |

COMMAND 与 SCHEMA_FK 图必须无环。旧 all-v2 organization↔workspace-IAM 的双向 MQ/投影环
不迁移：organization 只拥有组织事实；workspace-IAM 只拥有身份授权事实。门店停用只影响未来
登录/切换 judgment，不自动撤销任职；任职撤销只由 workspace-IAM command 完成。

### 3.3 事务规则

- 跨模块写只调用目标公开 command API，并加入发起方同一 `REQUIRED` 事务；
- 禁止跨 schema DML、跨模块 repository、`REQUIRES_NEW`、event/listener 补主状态；
- 目标 owner 在 command 内重查 workspace、身份、capability、node/status、CAS 和唯一约束；
- command receipt 与业务事实同事务；同 key 同规范化请求重放同 readback，不同请求 typed conflict；
- task read 可显式 join，但不得锁其他 owner 表、不得用 read edge 推导写/FK/事务权限；
- unknown result 先 GET owner fact，再决定是否重试，不做前端盲重发或轮询。

## 4. 数据模型与 Flyway

### 4.1 单库与 schema

唯一数据库使用 `public.flyway_schema_history`。R3 已有 migration 永不改写，R5 只追加能力命名、
UTC 秒+毫秒严格单调的 migration：

| schema | owning tables（实施目标） |
| --- | --- |
| `platform_iam` | `platform_admin`、`platform_credential`、`platform_session`、`platform_credential_reset`、`platform_command_receipt`、`platform_audit` |
| `platform_workspace` | retain/alter `group_workspace`、`workspace_command_receipt`、`workspace_audit` |
| `platform_asset` | `staged_asset`（含 metadata、claim/release lifecycle；bytes 在受管 asset storage）、`asset_cleanup`；不另建 `asset_content/asset_claim` |
| `organization` | retain `commercial_group`；`organization_node`、`brand`、`tenant`、`head_company`、`head_company_brand_authorization`、`store`；每类实体独立 `*_extension_value` 表与 audit/receipt，实体行不放 extension JSONB |
| `extension` | `extension_definition`、`extension_definition_field`、definition receipt/audit |
| `workspace_iam` | `workspace_account`、credential、role、page access、capability、assignment、invitation、OTP/grant/reset、session/context、receipt/audit |
| `contract` | `store_contract`、`store_contract_item`、contract extension value、receipt/audit |

所有 workspace-scoped 表携带 `workspace_uuid + group_workspace_key` 复合引用，复合
unique/FK 防止跨空间对象拼接；公开 query 必须有可信 workspace/subject/scope predicate。
表名、migration 名、package、文件和类全部按能力命名。

R3 migration 继续位于同一 Flyway history，绝不重写或从 V1 重开。第一条 R5 compatibility
migration 必须按下表 additive 演进；每一阶段都有 precondition/readback，任一失败停止而不是
删库冒充成功：

| R3 现状 | R5 additive 决议 | 切换与保留 |
| --- | --- | --- |
| `group_workspace.id BIGINT IDENTITY` | 增 `workspace_uuid UUID`，回填、`NOT NULL`；增加具名 `UNIQUE(workspace_uuid, group_workspace_key)`，新 owner 表只以该二元组作为复合引用 | 旧 `id` 与既有 FK 本 R 保留为 `TRANSITIONAL_RETAIN`，不得回收或改 PK |
| `commercial_group.id BIGINT IDENTITY` | 增 `commercial_group_uuid UUID`，回填、`NOT NULL`、unique，外部 readback 改用 UUID | 旧 `id` 及 audit/idempotency FK 本 R 保留 |
| `group_workspace_key VARCHAR(120)` | 先 readback 所有值长度≤64，再 `ALTER ... VARCHAR(64)`；超长即 typed migration precondition failure | 禁止截断、hash 或建立 120/64 双 alias |
| `revision BIGINT`（commercial group 还固定 `=1`） | 增 `version BIGINT NOT NULL DEFAULT 1`，回填 revision；新 command 只 CAS `version` | `revision` 本 R 只读 transitional，禁止新写/新 contract 暴露 |
| `created_at TIMESTAMPTZ` 等 | 增同名语义的 `*_epoch_millis BIGINT`，用 `floor(extract(epoch)*1000)` 一次回填并校验非负；repository/readback 切新列 | timestamp 列本 R transitional，只用于回滚核对，禁止新写 |
| idempotency key 长度 200 | 新统一 receipt 表使用 16–128；旧 R3 表原列不缩短 | R3 receipt 可读迁移到新表后再停止旧表写，不丢重放结果 |
| R3 对 `group_workspace`、`commercial_group`、`commercial_group_audit`、`commercial_group_idempotency` 的 FORCE RLS + `consumer_face='platform-admin'` policy | compatibility migration 先校验四个 policy 的名称与定义仍等于 R3 冻结字节，再逐表 `DROP POLICY`、`NO FORCE ROW LEVEL SECURITY`、`DISABLE ROW LEVEL SECURITY` | 不改写 R3 文件；R5 授权唯一来源是 §5.3 immutable execution context、owner command/judgment 复核与 task-query workspace/scope predicate，禁止用 consumer-face RLS 制造 operations 假“空间不存在” |

后续 migration 按 expand → backfill → constraint → read/write switch 排序；本 R 不做 destructive
cleanup。Testcontainers 必须同时证明从零 rebuild 与从 R3 schema 升级两条路径，不能只证明
空库。

### 4.2 核心不变量

- `platform_admin` 与 operations `workspace_account` 是不同 principal/session/cookie；
- 平台管理员均为 platform-super-admin，不建立 operations role/page/action 模型；
- 首个平台身份仍是部署期外部受控前提；R5 不 seed runtime 默认/root；
- commercial group code/name 必须由平台人员独立录入；不得借用、复制或反写
  group workspace key/name；
- 商业集团与空间分离且每空间至多一个，保留 R3 owner 约束；
- 组织固定 `GROUP → REGION → PROJECT`，分期只是 project 属性集合；
- brand、tenant、head company 分离；head company 的 brand authorization 不推出门店写权；
- store 锁定 project+tenant+brand；head company 为 `0..1` 可选，提供时才校验同空间与品牌授权；
  停用不改合同事实；
- role 的 service node type 锁定；assignment、page access、action capability、visible data node
  四维不互推；
- 新增任职只能通过 invitation 完成；平台/运营均可按已准 capability 直接 revoke；
- invitation、OTP、credential readiness、assignment 在完成命令内原子生效；
- 合同创建即有效，item 为 `{code,name}`；失效保留历史；
- 门店三态按受控业务日计算：当前有效合同→`OPERATING`；无当前但有未来→`PREPARING`；
  否则 `NOT_OPERATING`。它只读且不驱动 command/授权/启停。

### 4.3 媒资

上传仍是 multipart staging 与 JSON 业务表单两个动作。`platform-asset` 执行大小、
magic-byte/解码、digest、opaque key 和 workspace 隔离；R5 不引入 object-store 服务依赖，
DEV 使用受管 remote host 上明确 allowlist 的 asset storage root，metadata/claim 在 PostgreSQL。
workspace create/update 调本地 asset command，在同一事务完成 claim/release 与 workspace
readback；wire 删除 bind grant，提交成功时 content 必须立即可读。staging TTL cleanup 与
业务结果分账，reset 只清 allowlist 中的 DEV namespace。

## 5. 身份、安全和失败恢复

### 5.1 platform face

R3 的可信边缘 adapter 保留；R5 增加 platform-IAM 产品登录/session。未认证的 login operation
只接受凭据，不接受客户端身份头；成功设置 app-owned HttpOnly/Secure/SameSite cookie。
平台 session 不能进入 operations face。管理员创建、启停、凭据恢复均由 platform-IAM owner，
不能创建或识别“root/default”特权类别。

### 5.2 operations/public face

operations 登录入口必须带 `groupWorkspaceKey`，但 owner 从可信 route + account/assignment
重建上下文。单角色直入，多角色明确选择，无角色进入 v2 空工作台；session readback 包含
current role、service node、visible data node、`contextVersion` 和
`authorizationRevision`。切换命令返回完整新 readback，前端清旧 context cache 后使用返回值，
不补拉旧投影。

邀请公开流程采用 token → accept → purpose-bound OTP → conditional credential readiness →
complete；新增任职只在 complete 的同一事务产生。找回密码使用独立 reset generation key 和
purpose-bound grants，不复用 invitation/session。密码、OTP、token、cookie、Authorization、
手机号明文和 raw payload 不进入日志/evidence。

### 5.3 授权

每个 operations command 在 owner 内同时验证：

```text
有效 session
AND URL groupWorkspaceKey == session workspace
AND current assignment active
AND service node active
AND page access
AND action capability
AND target within visible data scope
AND command-specific owner invariant
```

页面隐藏只是体验，不是授权。typed Problem 区分 unauthenticated、denied、stale、disabled、
not-found、validation、CAS、idempotency 和 unknown。失败 UI 以 v2 基线恢复；不得把不同错误
展平成“版本冲突”或空列表。

## 6. 前端搬运与适配

### 6.1 双 app 与 foundation

```text
apps/frontend/platform-admin/
apps/frontend/operations-admin/
libraries/frontend/admin-ui-foundation/
```

两个 app 各自拥有 shell/router/store/baseApi/theme/session/context/generated slice、business
text、L2/L3 config，禁止互相 import。foundation 只提供 wire-agnostic primitive；R5 页面必须
优先消费其中已有的 Drawer lifecycle、overlay lock、list context、HTTP Problem、observability
和 automation 能力，不得在 app 重造。foundation 不能 import app 或 generated wire。
R5 必须先更新 foundation 自身的 `src/list/contextScopedQueryArgs.ts` 与
`src/foundation.test.ts`：`workspaceKey` 全量改为 `groupWorkspaceKey`，不留 alias/overload；
不得把全局改名只做在 app 页面。
两个 app 可以保留只注入参数的薄 `useDrawerFormLifecycle` wrapper，但不得重实现 foundation
状态机；两侧 wrapper 都必须注入 `idempotencyKey:true` 与
`onDiagnosticEvent`→各自脱敏 safe logger。operations 侧缺失的 logger/注入是明确 ADAPT，
不得按 v2 原样搬运。

### 6.2 carry/adapt

交互工件 §3 的每个 `path@SHA-256` 是静态基线。实施开始后先把所有
`PENDING_HERITAGE_REGISTRATION` 来源复制到 `doc/heritage/frozen` 并更新 registry/
required-inventory，复算双侧 hash；之后才能搬页面。不存在 sibling runtime/build fallback。

manifest 的 UI 分母为 22 个 surface、133 个 handwritten runtime 文件、2 个
`NOT_CARRIED_REGENERATE` wire 文件和 45 个 reference-only test 文件；180 文件 aggregate hash
与 feature/app-shared ownership 共同闭合非页面文件。页面任务、信息层级、
ProTable/Descriptions/Drawer/Modal 组合、名称进详情、详情右上动作、列表无操作列按 v2
基线保留，但所有业务 surface 均为 `ADAPT`；只有五类首页使用
`CARRY_ROUTE_BOOTSTRAP_ONLY`：

- wire 全部从 v2s edge OpenAPI 重生成；
- `workspaceKey` 改 `groupWorkspaceKey`；
- 业务词按 G-01～G-10 校正；
- 删除旧内部 client、MQ/outbox/projection status、补偿 refetch/轮询/双读；
- 页面每个独立 task surface 使用一个后端 task query，不在前端跨 owner 扇出拼装；
- 新增任职入口只保留 invitation，删除 direct add/edit；
- 平台账号详情增加直接 revoke assignment；
- contract item 改 `{code,name}`，门店三态只读；
- asset UI 保留两段上传，但删除 bind grant 和 transient-404 重试；
- 五类首页只搬 v2 route/bootstrap，不新增页面内容或后端 operation。
- operations 的 authenticated browser route 统一带 `:groupWorkspaceKey`；这不改 API path，
  也不把 URL 当授权；
- 每个 surface 按 manifest 的 `v2Consumed/r5Required` 消费 foundation，并至少断言一条 required
  文案及全部 forbidden 文案零出现；
- v2 的双 app generated wire 与六个 generated catalog 全部 `NOT_CARRIED_REGENERATE`；
  pageDesignKey、错误词表和 presentation catalog 只从 v2s edge/registry/manifest 生成；
- pageDesignKey↔surface 双向表必须闭合；auth/public/shell/password 等非 catalog surface
  逐条登记原因；
- page-entry guard hook、role candidates、logo bind grant、404 retry、direct assignment
  add/edit 和旧 generated wire 按 manifest 七条负向资产做目标仓零引用。

### 6.3 状态所有权

server fact、session、context、version 和 mutation 由 generated RTK Query 拥有；router 拥有
stable route/page；app state 拥有 shell/tabs/query resume；overlay local state 只拥有单一安全
草稿。context identity/version 进入 query args/cache/tag，迟到响应只有仍匹配当前 context 才可
落地。context 切换前关闭 overlay，切换后清理旧 workspace/node/session 的 cache/tab state。

## 7. 完整 DEV 与 seed

### 7.1 受管入口

实施期扩展现有能力命名脚本，不创建流程编号目录：

| entry | contract |
| --- | --- |
| `scripts/dev/start` | remote dependency/config/readiness preflight；启动 proxy、business server、双 app；只 additive Flyway，不 seed。 |
| `scripts/dev/restart` | 按 active run manifest 重启并保留 DEV 数据/asset；不 seed。 |
| `scripts/dev/stop` | 只清 manifest 所有的进程/资源；不按端口/名称模糊清理，不删持久数据。 |
| `scripts/dev/reset` | 每个 namespace 一个精确派生 database；重建该库的 `public` Flyway history 与七个固定 owner schema，并只清同 namespace asset root；二次确认、前后 readback、不自动 seed。 |
| `scripts/dev/seed --profile r5-full` | dry-run 分母、显式执行、版本化/可重复、逐阶段 receipt、批量 owner readback。 |
| `scripts/dev/check` | env、remote PostgreSQL、asset root、contract/runtime version、凭据文件权限、seed profile 完整性。 |

远端依赖只包含已批准 PostgreSQL 和受管 asset storage root；不引入 MQ、outbox、Redis、TDP、
内部 client 或搜索。凭据只通过本地受保护环境文件/进程环境提供，evidence 只记录变量名、
fingerprint 和可达性，不记录 secret。
数据库隔离不能靠派生 schema 名：`V2S_DEV_NAMESPACE` 必须派生出唯一
`catering_v2s_dev_<namespace>` database，业务 schema 始终是七个固定名，Flyway history 位于
该库 `public`。reset 只可重建精确 database；host/database binding、production marker 或
database name 任一不符即在连接/破坏前失败。

### 7.2 `r5-full` profile

seed 必须让 Dexter 无需手工补数据即可完成 32 项：

- 两个以上 group workspace，包含 enabled/disabled、已/未初始化商业集团；
- platform admin 测试身份、独立 operations accounts；没有 runtime default/root；
- commercial group、多个 region/project/phases；
- brand、tenant、head company、brand authorization、enabled/disabled stores；
- 五类 extension definitions/values，含 unknown-value 保留样本；
- 五类 service-node role、页面准入、动作 capability、可视数据节点；
- invitation pending/accepted/cancelled/reissued、单角色/多角色/无角色、可 revoke assignment；
- active/disabled account、credential recovery、typed denied/stale 场景；
- contract current/future/invalid、`{code,name}` 多行，覆盖三种 store derived status；
- 列表分页、筛选、详情、空态、无结果与负权限需要的足量数据。

所有创建时间和合同派生日来自统一 `TimeProvider`；`r5-full` 的 DEV fixed clock 固定
`1784908800000` / `Asia/Shanghai`。固定 clock 与 `DEV_FIXED_OTP_ISSUER` 都只有 namespace
匹配、profile 恰为 `r5-full`、明确 non-production marker 三项同时成立才装配；默认 profile
必须证明两者不可用。fixed OTP 仍走 purpose/expiry/attempt/grant 状态机，只保存 hash，不是
万能验证码。

普通事实必须经真实 edge/owner command；新增任职必须走邀请接受链。仅平台首个身份和用于
启动 command 链的 DEV-only bootstrap 可直写，实施设计落地时必须在 seed manifest 逐
table/column allowlist、理由、receipt、审计和写后 owner readback；不得直写普通组织、角色、
任职、门店或合同事实。

### 7.3 fresh rebuild evidence

最终动态证据从 clean DEV namespace 开始：

```text
dev check
-> dev reset (cleanup readback)
-> dev start (Flyway only)
-> seed --profile r5-full --dry-run
-> seed --profile r5-full
-> 双 admin / public 32 项 L2/L3
-> owner/database readback
-> dev stop
-> process/resource cleanup readback
```

business 与 cleanup 两账分开；任一 cleanup 非 PASS 不得宣称完成。运行每 30 秒进度，
首败保存 run-scoped manifest/结构化日志；同 signal 第二次前先做边界诊断。

## 8. 十二个实施单元与严格顺序

以下 unit 在获得 implementation exact authorization 后连续执行；它们不是中途 review 点。
开发 agent 不得只读本节摘要后自由发挥；每个 unit 必须同时重开 execution blueprint 中对应的
package/class、table/constraint、transaction sequence、page/hook、focused test 和 seed stage，
并把 blueprint 的进入/退出 checklist 作为实施输入。若主设计与蓝图不一致，以本主设计的
业务/边界为 owning source，但必须先停止并把两份文档修到同值后才可编码；不得忽略蓝图的
具体列/路径，也不允许编码时自行选择第三种行为。

unit 严格串行，U01→U12 不可并行。单个 unit 内只有先拆成互不写同一 owner、contract、
manifest、generated output 或 evidence index 的只读盘点/测试准备才可并行；同一 owner 的 domain/
application/repository、同一 OpenAPI/catalog、同一 app shell/router 或同一 seed stage 始终单写者。
并行 worker 只回传 patch/evidence 建议，由当前 unit owner 按顺序 intake；不得各自宣布 closure。

每个 unit 进入、首个真实产物、focused test 完成、退出或阻断时都输出结构化进展：
`unit/status/done/on/next/remaining/risk/evidenceRef`。持续工作仍服从 AGENTS 的五分钟节律，
动态运行服从 30 秒节律；unit 进展不能用无内容的“继续中”代替。

### R5-U01 — Heritage freeze、contract 分母与生成 closure

冻结交互工件列出的 v2 页面/规范来源；先用 file-placement catalog 解析并保存 104 行
operation 落位报告，再把 104 operation 写入唯一 edge OpenAPI，更新 Problem、face、route
registry 和 server/two-client generated closure。必须显式改造
`tools/verify-gates/cli.mjs` 与 `scripts/generate/edge-codegen.mjs`：接受三 face、解析根入口
`$ref`，或只以确定性 bundle 作校验/生成输入；不得继续硬编码单文件和
`platform-admin`。这只是使既有工具承认新分母，不新增语义 gate。

**路径**：`doc/heritage/**`、`contracts/openapi/**`、`contracts/policy/route-face-registry.json`、
`scripts/generate/**`、两个 app generated 目录。
**失败**：operation/face/type 不闭合、双形状、手写 wire、Heritage hash 漂移即停。
**evidence**：104=38+55+11，104 行 placement 零缺失/零歧义，server/clients 精确闭包，
error-code disposition 83/83+6/6，两项 operation 与全部字段/生成物 NOT_CARRIED 零残留，
R3 三项 method/header/Problem/error-code/前端文案键回归。

### R5-U02 — 组装、schema 基线与模块依赖

在唯一 business server 中登记七 owner 模块，保留 TDP 空占位；更新 module dependency
registry、Flyway locations 与 additive capability migrations；从零 Testcontainers migration。
同时创建窄 `libraries/backend/platform-foundation`，只按开发蓝图 §2.4 搬运/适配允许的
基础 primitive，拒绝把 v2 foundation 整包复制。

**路径**：`settings.gradle.kts`、`build.gradle.kts`、`apps/backend/catering-business-server/**`、
`libraries/backend/**`、`contracts/policy/module-dependency-registry.json`。
**失败**：第二 deployable/history、COMMAND/FK 环、跨模块 repository、流程编号命名、TDP
出现 `src` 即停。

### R5-U03 — platform IAM

实现平台密码登录/session/logout/self-password、平台管理员 list/create/detail/profile/status/
credential reset。平台首个身份仍为外部部署前提；无 root/default。

**owner**：`platform-iam`。
**evidence**：cookie/face 隔离、凭据与 session 撤销、登录限流/typed error、DB rollback、
platform/operations cookie 不互用。

### R5-U04 — workspace、asset 与 extension

扩展 R3 workspace owner，完成 create/display/status；实现 asset staging/content 与同事务
claim/release；实现五类 extension definition revision/CAS。保留 commercial group 初始化。

**owner**：`platform-workspace`、`platform-asset`、`extension`。
**evidence**：Logo 立即可读、失败整体回滚/cleanup 分账、五类宿主闭集、workspace
disabled 不推导其他事实、commercial group code/name 与 workspace key/name 独立输入及
重复初始化 typed error。

### R5-U05 — organization

实现固定三层组织、phases、brand、tenant、head company、brand authorization、store、
entity extension values 和平台 task overview。所有写由 organization owner 同事务复查。

**evidence**：跨 workspace FK/谓词、节点类型/父子关系、store 三关系、brand authorization、
unknown extension value typed rejection 且不静默删除、无 IAM 写入。

### R5-U06 — workspace IAM

实现 role/page/action、account、invitation、assignment/revoke、public acceptance、password
reset、operations login/session/context/data-node/logout 和 internal `ResolveNavigation`。
禁止恢复 `checkOperationsPageEntryGuard` 或任何同义公开/read-edge endpoint；navigation
只服务 route UX，每个 task endpoint 重新执行 owner authorization。organization 与
workspace status 仅作为 narrow judgment。

**evidence**：新增任职只经 invitation、完成原子性、平台/运营 revoke、四维不互推、
单/多/无角色、disabled node/store typed denial、session/version stale。

### R5-U07 — contract

实现 contract list/create/detail/update/invalidate、候选、platform overview、store profile
contracts 和受控日期三态；扩展值由 contract owner 保存。

**evidence**：`{code,name}`、phase snapshot/current reselection、CAS、历史保留、
OPERATING/PREPARING/NOT_OPERATING 三态且不驱动 command。

### R5-U08 — platform-admin 搬运/适配

逐行执行 `contracts/policy/frontend-asset-carryover-manifest.json`，先消费 foundation，再
搬运 v2 platform login/workspace/admin/overview/role/account/invitation/extension/password
页面；generated wire 全量替换。列表/详情/动作、错误恢复和业务词按交互工件。
首个动作是把共享 foundation 的 `contextScopedQueryArgs.ts` 与 `foundation.test.ts` 改为
`groupWorkspaceKey`，之后才允许页面接入。

**evidence**：38 operation closure、真实浏览器 task、owner readback、无 operations import、
无 runtime Heritage。

### R5-U09 — operations public/session/shell

搬运 keyed login、invitation、recovery、session/context shell、password 和五类
route/bootstrap；不新增首页内容。

**evidence**：public→login→single/multi/no-role、context switch、cache isolation、
shell/tab/navigation、55/11 face 隔离。

### R5-U10 — operations business pages

搬运/适配 hierarchy、business entities、store、contract、five user/invitation pages 和 store
profile；task query 替换前端扇出，删除分布式补偿。

**evidence**：v2 视觉/交互基线、G-01～G-10 术语与权限、owner command/readback、
foundation consumption、无 direct-add。

### R5-U11 — remote DEV 与 rich seed

逐行执行
`doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json`，完成六命令、远端
PostgreSQL/asset readiness、run manifest、`r5-full` profile、dry-run、explicit reset/seed
和 credential handoff。start/restart 永不 seed；fixture stable key/count、credential
reference、negative state、business/cleanup predicate 不得临场改变。

**evidence**：clean rebuild、seed denominator/readback、DEV 可由 Dexter 使用、业务/cleanup
分账、日志脱敏。

### R5-U12 — 全范围验证与 review packet

运行 `scripts/verify`、全量 backend L1/L2/Testcontainers、两个 app build/L2、proxy-mediated
L3、32 项 business、retirement/zero-reference 和 cleanup；按 section index 生成一个
IMPLEMENTATION review packet。

**退出条件**：32/32、104/104、两个 app、七 owner、DEV/seed、business/cleanup 全 PASS；
旧 service/client/MQ/outbox/polling/projection/generated alias/runtime fallback 零残留。

## 9. 32 项 → unit / evidence 对照

| scenario | implementation units | fresh proof |
| --- | --- | --- |
| D01-S01 | U03,U08,U12 | platform login/session L2/L3 |
| D01-S02/S03/S04 | U04,U08,U12 | workspace+asset transaction/readback |
| D01-S05,D02-S01 | U01,U04,U08,U12 | R3 retain + contract convention regression |
| D01-S06 | U04,U08,U12 | selected workspace shell/cache |
| D01-S07P/O | U04,U05/U07,U08/U10,U12 | five-host definition/value CAS |
| D02-S02 | U05,U10,U12 | hierarchy owner + UI |
| D02-S03 | U05,U10,U12 | three independent entity pageKeys |
| D02-S04 | U05,U10,U12 | store invariant/status |
| D02-S06 | U05,U08,U12 | platform task overview |
| D02-S07 | U05,U07,U10,U12 | current store profile/read |
| D03-S01/S02/S03 | U05,U07,U10,U12 | contract command/CAS/status |
| D03-S04 | U07,U10,U12 | full/read-only contract + three states |
| D03-S06 | U07,U08,U12 | platform contract overview |
| D04-S01/S02 | U06,U08,U12 | page/action independent fields, one atomic save |
| D04-S03 | U06,U08,U12 | platform account/status/reset/revoke |
| D04-S04 | U06,U10,U12 | five user pages/revoke |
| D04-S05P/O | U05,U06,U08/U10,U12 | invitation/candidates |
| D04-S06 | U06,U09,U12 | public atomic acceptance |
| D04-S08/S09 | U04,U05,U06,U09,U12 | keyed login/context/data node |
| D04-S10 | U06,U09,U12 | denied/stale/reset recovery |
| D04-S11 | U03,U08,U12 | independent platform principal governance |
| D04-S12P/O | U03/U06,U08/U09,U12 | self-password/session revocation |

## 10. 验证、性能与退役

### 10.1 复用 R4 分母

本设计不新建通用 gate。实施按 R4 现有 `scripts/verify` 复用：

- standards coverage、code layout、backend/module/security/database/query boundaries；
- OpenAPI/face/generated closure、frontend architecture/foundation direction；
- Flyway/constraint/CAS/idempotency/Testcontainers；
- logging、retirement、affected-L2 与 evidence schema；
- production validator 的既有真红 fixtures。

R5 新增的是业务测试、owner integration、页面 L2/L3、seed/DEV evidence，不把业务语义降格为
关键词 checker。matrix 中到期可机器判定条目只有在 production gate 真实承接后才改 ACTIVE。

五账分别落盘，任何一账不能替代另一账：

| ledger | 分母与允许证据 | 关闭条件 |
| --- | --- | --- |
| L1 | domain/unit、纯函数、fixture/schema 静态校验 | 测试命令、断言数、首败与最终结果可重放 |
| L2 | owner application/repository/generated adapter、前端真实浏览器 task | 每个 owner/surface 有 focused behavior，不用 mock readback 冒充 |
| L3 | remote PostgreSQL、受管进程、proxy、双 app 与真实 public flow | run-scoped manifest、版本/contract fingerprint、业务结果 |
| business | 32 scenario、104 operation、owner readback | 32/32 与 104/104，失败分支和恢复路径均有结果 |
| cleanup | 进程、database namespace、asset、browser/session/OTP grant | 独立 PASS；非 PASS 时整体不得完成 |

每条 evidence index 行固定含 `unit,scenarioIds,operationIds,owner,surface,level,command,runId,
sourceHash,result,cleanupResult`；不适用必须写明理由，禁止空字段或跨等级冒充。

### 10.2 请求预算

延续“写到哪个 endpoint 就断言哪个 endpoint”的预算，不建专项平台：

- 独立 list/detail/task-read：默认 `databaseOperationCount ≤ 3`；
- 单 owner command + receipt/audit/readback：默认 `≤ 5`；
- 显式跨 schema task query：设计 query plan 后以固定上限断言，禁止 per-row IO/N+1；
- 分页必须 count + page 有界；无 `SELECT *`、自由锁、循环 repository call；
- 超预算须先解释 owner/readback 必要性并给更小替代，不能拆 endpoint 隐藏。

### 10.3 retirement

实现结束必须零残留：

- all-v2 服务名、内部 OpenAPI client、service credential、MQ/outbox/listener/polling/repair；
- projection/asOf/per-source degradation、mutation 后补 refetch、transient 404 retry；
- `workspaceKey` 外部 alias、`itemCodes[]`、`logoBindGrant`、direct assignment add/edit；
- app 间 import、shared generated API、Heritage runtime/build fallback；
- TDP runtime/source；五类首页新增 dashboard/content。

## 11. Part B / C / D 规范命中

正式 Claude handoff 附独立 chapter-hit-map；本节给实现位置：

| part | 设计落点 |
| --- | --- |
| B.1 安全/session | §5、U03/U06/U09 |
| B.2 数据/事务 | §3–§4、U02/U04–U07 |
| B.3 后端结构 | §3、U02–U07 |
| B.4 前端架构/状态 | §6.1/§6.3、U08–U10 |
| B.5 UI/信息架构 | 已接受 interaction + §6.2 |
| B.6 性能 | §10.2 |
| Part C normative patterns | generated→adapter→application→domain→adapter；owner command/readback；typed Problem；RTK Query state；Drawer lifecycle |
| D.1 layout | §3.1、U02 |
| D.2 contract | §2、U01 |
| D.3 gates | §10.1、U12 |
| D.4 docs/evidence | §7.3、U12 |
| D.5 process/review | §0/§1.3/§12 |
| D.6 stack/dependencies | §2–§4、§7 |
| D.7 AI foundation | deterministic context、Heritage freeze、foundation carry-first、review input checklist |
| D.8 logging/debug | §5.2、§7.3、U11/U12 |

## 12. 设计 review、实施入口与停止条件

本设计冻结后必须：

1. 生成 implementation-design granularity manifest；
2. 为每轮生成 path+SHA-256 的 reviewer input checklist；
3. 派两个不同的 fresh independent subagent，先证伪、先独立 verdict，最多两轮；
4. 作者逐 finding 重开 source/evidence，作
   `CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE /
   UNVERIFIED_REQUIRES_EVIDENCE / DEXTER_DECISION` intake；
5. 第二轮 reviewer 作 `ROUND_FINAL_DECISION=SELF_DECIDED`，禁止第三轮；
6. fresh 运行 design granularity、standards coverage、Roadmap/registry、memory/lifecycle 和
   diff-format checks；
7. 作为一个 R5 DESIGN review target 一次性交 Dexter 与 Claude。

即使 DESIGN 获 GO，也不得实施。只有 Dexter 后续明确给出 R5 implementation exact
authorization，才从 U01 开始连续执行；不得恢复 R3 J02/C-02 旧资产作为入口，也不得将
任何 unit 单独交付 review。

本 cycle 已完成两轮独立子 agent 审查并到达硬上限。第二轮历史 verdict 为
`NO_GO(3 M / 4 S / 0 N)`；七项均经作者重开确认为真实并完成局部修复：
32↔104 反向 crosswalk、删除 component 零引用、三类 business-entity selector、32 行 seed
前提、15 个 secret/purpose binding、精确 reset allowlist 与固定 clock/date。另按 Dexter
要求补入后台时间点 long、contract 分类拆分，以及 v2 有价值资产/v2s 约束反向审计。
不启动第三轮；post-remediation 新字节直接作为 Claude/Dexter review target，详见
`doc/review/platform/2026-07-25-v2s-r5-design-round-2-finding-intake.md`。
