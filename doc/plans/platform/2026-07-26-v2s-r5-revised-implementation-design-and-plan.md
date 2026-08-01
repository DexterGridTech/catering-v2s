---
title: R5 全范围 implementation-facing 详设与实施计划（修订草案）
status: DRAFT_PENDING_GRANULARITY_MANIFEST_AND_INDEPENDENT_REVIEW
createdAt: 2026-07-26
programId: V2S_W0_W4_EXECUTION
reviewCycleId: R5-REVISED-DESIGN-20260726
replaces:
  - doc/plans/platform/2026-07-25-v2s-r5-whole-scope-implementation-design.md@sha256:a3668ac5502735adb2b452fb94ef0b5c55f423078607cc78da1bb78baa0aa014
  - doc/review/platform/2026-07-26-v2s-r5-structure-and-enforcement-execution-directive-claude.md@sha256:950e3714ff74a4b8afc13a85b1e6b4d03de10768a47ffdc89f57795607aff550#phase-a-d-schedule-only
implementationAuthority: false
---

SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# R5 修订详设与实施计划

## 0. 状态、继承与明确阻断

本件重排 R5 的实现形状和次序，不重新推导、更改或缩小以下冻结输入：32 scenario、22 surface、
25 pageDesignKey、7 owner schema、G-01~G-12、D-01~D-11、已接受 Journey/交互和“线框以 v2
为准”的裁决。R3 已完成资产只按既有边界 retain，旧 R3-J02/C-02 不恢复。

operation 基线 **104** 已由当前 `contracts/openapi/paths` 实测。Dexter 已在 2026-07-26 明确裁决：
操作历史按现有 scalar `face` 契约流水线拆为 **2** 个 face-specific read operation，修订分母为
**106**，face closure 为 `platform-admin=39`、`operations-admin=56`、`public=11`。两个 operation
共用同一 owner task-read 形状和同一个 app-local Modal，不复制为 12 个实体端点，也不新增
pageDesignKey：12 个实体详情中的同一 Modal 是已有 surface 内的操作。

`doc/decisions/2026-07-26-v2s-r5-operation-history-interaction-design.md` 的低保真线框已于
2026-07-26 由 Dexter 接受（`DEXTER_WIREFRAME_REVIEW=ACCEPTED`）。因此本文可冻结为新的
implementation-facing design 输入，下一步是生成新 manifest、进行最多两轮独立子 agent 盲审，
再交 Claude 与 Dexter；在这些完成前仍不实施、运行或改动任何业务源码/contract/migration。

## 1. 用户任务、方案取舍与最小替代

R5 的用户目标仍是：两个独立后台在单 deployable、单 PostgreSQL、多 owner schema 边界内，
完成已确认的 32 项用户任务，并在完整 DEV 中以真实 owner readback 验证。新增操作历史只让
获准查看详情的人理解“谁在何时改变了什么”，不把审计膨胀成报表系统。

可选但不采用的替代有两种：

1. 每个实体各开一个审计 endpoint、复制一套权限和前端页。它把同一读语义放大为 12 套
   contract/edge/test，且新增第二套权限，违反 R-11 的最小用户任务。
2. 只保留日志或 v2 的 `auditSummary`。它没有分页、操作者、字段差异或事务性事实，不能
   满足 R-11；但既有 `PlatformAdminDetail.auditSummary` 是冻结 response 的 required string，R5
   必须由 canonical audit event 的 `action` 保持其兼容 readback，不能删除、置空或缩短它。

采用两个 edge operation `getPlatformEntityAuditHistory` / `getOperationsEntityAuditHistory` + owner-local
append + 宿主权限继承。它只在 scalar face 边界复制 edge declaration，owner task-read 与 Modal 仍各一份；
不引入 MQ、outbox、
投影、轮询、通用审计平台或第八个 owner schema。

## 2. 冻结输入与已完成字节盘点的处理

### 2.1 输入优先级

1. 本轮 Dexter R-1~R-14：
   `doc/review/platform/2026-07-26-v2s-problem-discovery-and-direction-claude.md#3-dexter-已下的裁决(全部生效,详设必须遵循)`。
2. G-01~G-12 与不得推导边界：
   `project-memory/decisions/confirmed-business-language-corpus.md`。
3. D-01~D-11、R5 32 scenario、已接受 v2 线框：现行 R5 Journey/interaction/scope decisions。
4. R-2 extension/role JSON 形态：
   `doc/review/platform/2026-07-26-v2s-extension-and-role-storage-alignment-design-claude.md`。
5. 本轮真实现况：
   `doc/review/platform/2026-07-26-v2s-r5-current-implementation-byte-inventory-codex.md`。

发生冲突时，高优先级胜出；Heritage 仅提供被明确采纳的实现机制，绝不形成 runtime/build
fallback。

### 2.2 已有实现 disposition

| 已有字节 | disposition | 原因与限制 |
| --- | --- | --- |
| 27 个 `edge/<face>/<capability>` controller | `RETAIN_AND_COMPLETE` | 结构正确；不得当作 27 个已完成 user journey；继续由 generated wire、typed Problem、owner command/read 填实 |
| 7 owner library schema 边界 | `RETAIN` | 单 deployable/单库多 schema 不变；跨 owner 写仅经公开 command API 且同一 REQUIRED 事务 |
| `V20260726_150000_000` 五宿主 revision / legal data | `RETAIN` | 仅新增式补 contract items JSONB、审计、状态/索引等；不可改该 migration 字节 |
| `V20260726_160000_000` extension/role JSON 对齐 | `RETAIN_AUTHORITATIVE` | 五宿主 `extension_values`、definition `definitions` JSONB、role 两数组是 R-2 的正确形态；禁止回建关联表 |
| `V20260726_140000_000` BYTEA + bind grant | `RETAIN_BYTES_REPLACE_SHAPE` | migration 不改；BYTEA 内容迁出对象存储后再 additive DROP；bind grant 成为有效 staging→claim proof，必须接线 |
| `store_contract_item` 使用代码/表 | `RETAIN_BYTES_REPLACE_SHAPE` | 迁至 host-table JSONB item array；旧表只在数据迁移/一致性 precondition 后删除 |
| 8 张 legacy `*_audit` 表 | `REPLACE_SHAPE_AFTER_WRITER_READER_CUTOVER` | 5 张仍有活跃 writer，`platform_iam.platform_audit` 还有喂入冻结 `auditSummary` 的 reader；不得把它们当空表。先按 §5.1 列出的 writer/reader cutover 迁往 canonical `audit_event`，再以 typed precondition drop/recreate/retire |
| 7 张 `*_command_receipt` 表 | `RETAIN_AND_COMPLETE` | 已有 receipt 形状保留；逐 command 补 reserve/fingerprint/replay/complete，不把 header 或空表当闭合 |
| generated edge/前端 descriptor | `RETAIN_GENERATED_REGENERATE` | 已有 104 条 descriptor 与后端 `edge/generated` 只证明生成曾发生；R5 生成 106 条 scalar-face closure，前端再接 RTK endpoint |
| `admin-ui-foundation` 五项差异 | `RETAIN_WITH_EXPLICIT_ADAPTATION_INVENTORY` | 两项 groupWorkspaceKey 修订已落地；`useSubmissionLifecycle`、`index.ts` export、`package.json` 的 RTK 依赖为本仓新增适配，见 §6.1，不再冒称 R3 原样复制 |
| 当前前端 33 个 `src` 文件、无 router/RTK | `REPLACE_ARCHITECTURE_BEFORE_PAGES` | 不把页面继续堆在 `useState` 链上；先建立独立 app routing/store/api/logging substrate |

## 3. 目标架构与不可变边界

### 3.1 owner、事务与读取

- 一个 `catering-business-server`、一个 PostgreSQL、7 owner schema、单 Flyway history；
  `terminal-data-server` 仍是独立占位，不进入 R5。
- command 的业务写、对应 command receipt、目标 owner audit 必须在同一 `REQUIRED` 事务。
  调用其他 owner 写时只走目标公开 command API；edge/controller 不直连 JDBC/repository。
- 审计读取是**按 `entityType` 分派的 owner task read**，不是 edge/controller 的 union/join 或跨 schema
  SQL：edge 先完成 host session 与宿主详情授权，再只调用该 type 的公开 reader API。`platform-access`
  只提供 read facade，不拥有或写入 audit fact；各事实仍由
  platform-workspace/platform-iam/workspace-iam/organization/contract/extension owner 在自己的事务中写入。
  `GROUP_WORKSPACE` 的 platform-workspace reader 在已完成 host authorization 后，才调用 organization 的
  窄 `CommercialGroupInitializationAuditReader` 取得同一 `(workspace_uuid,group_workspace_key)` 的初始化事实；
  这是公开 task API，不是 edge SQL 或 identity lookup。
- `x-consumer-faces` 是暴露面唯一真相。platform-admin 和 operations-admin 各有独立 router、
  store、session boundary、API facade、theme/shell；public 只保留邀请/恢复和公开静态 URL。

### 3.2 时间、数据和安全形状

- 所有时间点：OpenAPI `integer/int64 epochMillis`、Java `long/Long`、PostgreSQL `BIGINT`；
  合同生效日期仍是 `date` / `LocalDate` / `DATE`。不新增 timestamp 或前端 `Date.now()` 业务事实。
- extension definition 一行 `definitions JSONB`；五个 host 表各持 `extension_values JSONB` 与
  `extension_rule_revision`，执行 `preserveUnknown + replaceKnown`。role 的 page/capability 是两个
  JSONB array；运营端文案为“经营资料”。
- `platform-asset` 只拥有公开静态展示资源：图片和视频。它拒绝导入、导出、报表和临时处理
  产物；后者未来另立受鉴权、TTL、非公开 owner，R5 不预建。
- 所有静态资源公开可读；public contract 返回/消费 `publicUrl`，由对象存储 adapter 的 `url()`
  和单一 `asset.public-base-url` 决定。业务数据只保存 asset ref/metadata，浏览器不自行拼 CDN URL。

## 4. 契约先行的 106-operation 基线

契约 source truth 仍按 face/capability 小文件组织；根 `contracts/openapi/edge.openapi.yaml` 只做
引用。每个手写 YAML 非空行不超过 500；达到阈值继续分 `read` / `command`。生成 bundle 只供
codegen，绝不手编或成为权威。

| change | 精确 source disposition | consumer 在后续阶段如何使用 | failure / compatibility |
| --- | --- | --- | --- |
| 104→106 audit | 创建 `contracts/openapi/paths/platform-admin/audit-history.paths.yaml`（`getPlatformEntityAuditHistory`）和 `contracts/openapi/paths/operations-admin/audit-history.paths.yaml`（`getOperationsEntityAuditHistory`），以及 `contracts/openapi/components/common/audit-history.schemas.yaml`；更新 root ref、两个既有 placement/catalog、operation inventory、scalar face closure 与 route registry | 两 app 各只生成所属 face endpoint；两个 endpoint 共用 request/response schema 与同一 owner reader dispatch；`platform-admin=39`、`operations-admin=56`、`public=11`，总数 106 | platform operation 的闭集为 `GROUP_WORKSPACE,PLATFORM_ADMIN,WORKSPACE_ROLE,WORKSPACE_ACCOUNT,WORKSPACE_INVITATION,EXTENSION_DEFINITION,STORE_CONTRACT`；operations 闭集为 `WORKSPACE_ACCOUNT,WORKSPACE_INVITATION,ORGANIZATION_NODE,BRAND,TENANT,HEAD_COMPANY,STORE,STORE_CONTRACT`。未知、跨 face type 或无宿主 read 权限均返回 typed Problem；GET 不带 idempotency；已有 104 条 path/operationId/error code/事务语义不变 |
| 审计 readback 与脱敏 | `AuditHistoryPage`：`items,page,pageSize,total`；每个 item 同时提供左侧列表摘要 `occurredAt`,`actorDisplayName`,`actionSummary` 与右侧详情 `action`,`target`,`changes[]`。`changes[]` 只含 generated closed `fieldKey,beforeValue,afterValue`，不含中文 label | Master–Detail Modal 只用当前页 `items[]`：左栏按时间定位，点击项在右栏由**所属 app**按 `fieldKey` 映射业务中文 label + before/after display；不为详情再发请求、不解析 `detail_json` | `AuditActor` 由会话解析阶段在 IAM owner 内部构造 `{actorType,actorId,displaySnapshot}` 后传给 command；operations face 对 `PLATFORM_ADMIN` 固定显示“平台管理员”，workspace actor 只在同一 group workspace 内显示快照名，`SYSTEM` 显示“系统”。`changes_json` 仅能由 owner/entity/action 白名单生成，未列字段一律省略；绝不写/返回手机号、登录名、账号 id、token/OTP/hash、credential、raw JSON、内部列名或无权 actor 信息；换页后选择新页首项 |
| 合同货号 JSONB | 更新 `contracts/openapi/components/contract/contract.schemas.yaml` 的 `StoreContract*` item 定义并移除重复 required；更新 operations/platform contract path refs | contract owner 与两个 UI 只消费 `{code,name}` array | `itemCodes` 始终 forbidden；code 以 `strip().toLowerCase()` 比较、保留原展示值；重复/并发冲突为具名 4xx，不泄露 DB exception |
| 资产 URL | 更新 `components/platform-asset/asset.schemas.yaml`、platform stage path、public asset read path 和使用 logo 的 schema；将代理 content response 改为 public URL/reference 形状 | platform UI 使用 generated `publicUrl`，视频使用 URL 交给浏览器/CDN | `logoBindGrant` 不复活；仅 stage response 的不透明 `bindGrant` 可作为一次性 claim proof，禁止持久化、日志、详情/列表回显 |
| 角色/extension | 收紧 `ExtensionEntityType` 至五宿主；定义/值/role readback 全部 JSON 形状 | generated models 供两个 UI 的 definition/role form 消费 | 不恢复 `extension_definition_field`、`role_capability`、`role_page_access` |
| Problem | 保留一个 R5 `contracts/openapi/components/common/problem.schemas.yaml`，移除/重定向重复 R3 schema ref；所有 error set 接 `EdgeProblemCode` | generated typed error + feature feedback mapping | `type` 为 URI、`title` 独立、`errorCode` 为 domain-prefixed code、`correlationId` 必填；前端不拼 `${errorCode}:${detail}` |
| 资产与审计以外的基线 | 更新 catalog 的状态/分页/错误码/operation metadata，不改 HTTP path、既有 operationId 或冻结 error code | codegen 在本阶段末一次重生成 platform/operations/public consumer | 已有 104 条的 path/operationId/error code/事务语义不漂移；新能力只增加两个 face-specific audit operation |

审计不再有 `shared/` path 组织例外：每个 path 都服从 `paths/<face>/<capability>.paths.yaml`，每个
operation 的 `x-consumer-faces` 也只含一个 face。审计 component 是 `common` family，不是第八个 owner；
共享只存在于 common schema、`audit-contract` value API、owner task-read API 与 app-local Modal 组合，
不改变现有 generator 的 scalar face/security 模型。

## 5. 数据库与 owner 详设

### 5.1 新增式 migration 规则

所有新 migration 只追加在现有 `V20260726_200000_000` 后；绝不改动已执行 12 个文件。
每个 destructive cleanup 都先有 typed precondition（违反行按 id 列出）和数据/readback evidence。

| work | owner / transaction | migration/data shape | completion oracle |
| --- | --- | --- | --- |
| extension/role | extension、workspace-iam | 不建新表；contract/code 只消费 V160 JSONB | 五宿主闭集、unknown preservation focused test；旧关联表不存在的 precondition |
| contract items | contract | 增 `items_json JSONB NOT NULL DEFAULT '[]'` + named array/object checks；迁移 `store_contract_item`→JSONB；重复 normalized code typed precondition；验证后 DROP old table/index | 每条 contract JSON element 仅 `{code,name}`；同一事务 command + receipt；并发重放/重复 focused test |
| static assets | platform-asset | 见本节下方“静态资产的新增式形态”子节 |
| audit facts | 各 audit owner | **先 cutover、后 drop**。先新增各 owner canonical `audit_event`；5 个现有 writer 必须先改为同一 REQUIRED 事务 append：`OrganizationCommandService` commercial group/organization、`BusinessEntityService` organization、`ContractCommandService` contract、`PlatformAuthenticationService` platform IAM、`WorkspaceRoleService` workspace IAM。`PlatformAuthenticationService` 的 legacy reader 必须同时改读 `platform_iam.audit_event.action`（按 `PLATFORM_ADMIN + entity_ref_text` 排序，空时仍返回 `NO_ADMIN_AUDIT_EVENT`）以保持 `PlatformAdminDetail.auditSummary` required readback。仅 writer/reader cutover 已证实后，才逐表运行「空表 / 无 active writer / 无 retained reader」typed precondition；失败即具名停止并输出 `schema.table,rowCount,writerPath,readerPath`，不得 DROP。通过后 drop/recreate 七张 owner 表；`platform_asset.asset_audit` 无 writer/reader且不在 12 类浏览闭集，precondition 后 retire、不重建。统一 workspace-scoped 形状为 `id,workspace_uuid,group_workspace_key,entity_type,entity_ref_text,actor_type,actor_id(nullable for SYSTEM),actor_display_snapshot,action,occurred_at_epoch_millis,changes_json`；`platform_iam.audit_event` 是唯一 global exception：无 workspace tuple，以 `(entity_type,entity_ref_text,occurred_at_epoch_millis DESC,id DESC)` named index 查询。其余六表有 named workspace composite FK/check 与 `(workspace_uuid,group_workspace_key,entity_type,entity_ref_text,occurred_at_epoch_millis DESC,id DESC)` named index；`entity_ref_text` 采用 GROUP_WORKSPACE decimal id 或其余 UUID canonical string | command 以明确 `AuditActor` 传入 permitted actor type/id/display snapshot；business mutation 与 audit append 同事务；workspace-scoped task reader 在宿主授权后按四元组过滤，global PLATFORM_ADMIN 只在 platform face 按 `(type,ref)` 过滤；不作前端 identity lookup、跨 owner identity join、复制 identity fact 或新授权；rollback/duplicate receipt 不多写 audit；字段 diff 只能来自 §5.3 action-level allowlist |
| correctness closure | organization、contract、workspace-iam、platform-iam | named status checks、同类 normalized name uniqueness、必要二级索引、删除/停止读死列的 additive strategy | typed precondition + owner integration tests；不以 grep 代替语义 |

#### 5.1.1 静态资产的新增式形态

`platform-asset` 增 metadata `bucket_name`,`object_key`,`sha256`,`content_type`,`size_bytes` 与 named
status/usage checks；对象存储 adapter 是唯一字节通道。object key 内容哈希化，metadata 与 storage object
双 readback；所有历史 BYTEA 已转存后才允许 DROP `asset_content`。保留 `asset_bind_grant`：claim 在 lock 下
常时比对 hash、assetRef、usage、workspace、expiry 和未消费状态，再标 consumed；错 grant/过期/跨 workspace/
重放均 typed reject，成功 claim 与 workspace logo 变更同 REQUIRED transaction。

### 5.2 各 owner command 的必做语义

| owner | 责任 | 必须拒绝 / 不得推导 |
| --- | --- | --- |
| platform-iam | account 10 次/15 分、source fingerprint 30 次/5 分限流；built-in/self/last-active-admin guard；登录/治理审计 | 401 也持久计数；不得停用自己、built-in 或最后一个启用管理员 |
| workspace-iam | OTP verify 5 次/10 分、send 3 次/10 分；password/login/invitation lifecycle；角色/账号/邀请审计 | raw invitation token 仅一次交付，不持久；不以 invitation progress 双状态伪造一致性；不因 audit 增新权限 |
| platform-workspace / organization | 商业集团初始化 advisory lock + receipt + audit；组织 REGION 父为 commercial group 事实而非不存在的 GROUP node；组织/实体/门店 audit | 集团存在不推导树；store project/tenant/brand 创建后锁定；store 启停不互推经营状态 |
| organization | brand/tenant/head-company/store normalized name unique、状态闭集、二级列表索引；head-company brand authorization audit | 不使用“商户”泛称；不由品牌授权推门店可见 |
| contract | items JSONB normalized uniqueness；合同/货号 audit；三态只读计算；typed DB conflict mapping | 合同状态不等于门店启停或经营态；不选择唯一当前合同 |
| extension | five-host definition JSON、revision、audit | 不扩成三种无 value host；不覆盖 unknown values |
| platform-asset | streaming magic-byte/decode validation、图片/视频 usage closed set、object metadata、Range 支持 | 不读完整视频入内存；不接受 import/export/report/temp artifact；static public read 不鉴权 |

### 5.3 审计 task API、Actor 与 changes allowlist（R5 新能力的精确形状）

`AuditActor`、`AuditTarget`、`AuditReadScope` 与 `AuditChangePolicy` 必须住在新建的
`libraries/backend/audit-contract/` 这个**无 schema、无 repository、无 owner fact 的 value-only API library**；
它不是第八个 owner。所有 owner 与 `platform-access` / workspace session facade 只依赖该窄类型库，不能反向
依赖任一 IAM owner。`contracts/policy/module-dependency-registry.json` 必须在同一 U04 变更中登记该 library
及 `platform-workspace → organization` 的审计 TASK_READ edge。平台会话在 `platform-iam` 内解析为
`PLATFORM_ADMIN/{platformAdminId}/{displayName}`；运营会话在 `workspace-iam` 内解析为
`WORKSPACE_ACCOUNT/{accountId}/{displayName}`；系统写入者为 `SYSTEM/null/系统`。两个 session facade 只在
认证边界调用各自 IAM resolver 并把 immutable actor 下传给 command；下游 owner 严禁自行从 session、credential
或 account 表再解析身份。`OrganizationCommandService` 既有直接写入 `context.externalSubject()` 的路径必须在
同一次 writer cutover 中删除，改为接收 `AuditActor`。

| task reader owner | entity types | public narrow API | host / isolation rule |
| --- | --- | --- | --- |
| platform-workspace | `GROUP_WORKSPACE` | `readGroupWorkspaceAudit(AuditReadScope,AuditTarget,AuditHistoryCursor)`；内部调用 organization 的 `readCommercialGroupInitializationAuditForGroupWorkspace` | organization 只允许 `GROUP_WORKSPACE/COMMERCIAL_GROUP_INITIALIZED` 这一跨 owner host-fact exception；两段 reader 各取 `pageSize+1`，platform-workspace 在内存按 `(occurredAt DESC,sourceRank ASC,eventId DESC)` 合并，opaque composite cursor 持有两个 source cursor。初始化事实虽每 workspace 至多一条，仍不以“有界全取”绕过分页；host authorization 与同一 workspace/group key 过滤先行，organization 不返回 identity 或任意组织列表 |
| platform-iam | `PLATFORM_ADMIN` | `readPlatformAdminAudit(AuditReadScope,AuditTarget)` | platform face only；scope 中无 operations actor 扩权 |
| workspace-iam | `WORKSPACE_ROLE`,`WORKSPACE_ACCOUNT`,`WORKSPACE_INVITATION` | `readWorkspaceIamAudit(AuditReadScope,AuditTarget)` | workspace/group key 必须与 resolved session context 相等 |
| organization | `ORGANIZATION_NODE`,`BRAND`,`TENANT`,`HEAD_COMPANY`,`STORE` | `readOrganizationAudit(AuditReadScope,AuditTarget)` | owner validates target belongs to scope；不由 brand authorization 推 store 可见 |
| contract | `STORE_CONTRACT` | `readStoreContractAudit(AuditReadScope,AuditTarget)` | platform/operations 两个 edge 都经过各自 host authorization；owner API 不接受 face 以外的权限推导 |
| extension | `EXTENSION_DEFINITION` | `readExtensionDefinitionAudit(AuditReadScope,AuditTarget)` | 仅五宿主 definition 版本事实；不扩大到 unknown value host |

`changes_json` 从来不是 entity、request body、JDBC row、`detail_json` 或通用 reflection diff 的序列化。
每个 owner 为每个 `entityType/action` 声明封闭 `AuditChangePolicy`；未列字段、省略字段、任何 nested raw
JSON 和任何未知 extension value 一律不写。允许集合仅为：平台管理员的显示名/启停；集团空间的名称/状态与
商业集团编码/名称；角色的名称/描述/状态/page-access/capability **闭集 key**；账号与邀请的状态、角色/服务节点
分配和生命周期事件名；组织实体的业务名称/编码/状态/关系；合同的编号、日期、状态、`{code,name}` item array；
extension definition 的 field key、显示名、类型、required/revision。密码变更、credential hash/algorithm、OTP、
token/grant、mobile、login name、raw invitation、session、internal id、authorization receipt 与自由 JSON 均为
forbidden set，不能以 `before/after`、label 或嵌套对象形式绕过。

`AuditChangeFieldKey` 是 contract 的稳定技术 key；除已冻结的 actor display snapshot（`SYSTEM` 为“系统”）和
operations face 对 `PLATFORM_ADMIN` 的固定投影“平台管理员”外，服务端不返回业务字段中文 label 或可本地化
`actionSummary/target` 文案；两个 app 依据自己的业务文案表显示它们。每个 `entityType/action` 必须各有一份
封闭 allowlist policy，不能仅按实体放宽。focused evidence 至少覆盖 platform credential、workspace credential、account、invitation 与 role：
注入一个敏感候选字段的变更，断言持久 `changes_json`、owner readback 和 Modal fixture 都不出现该字段/值；同时
断言一个允许的业务字段仍完整显示。这是 owner focused test/L2 evidence，不新增 gate 类别。

## 6. 前端底座与页面实现详设

### 6.1 先于页面的两 app substrate

| path disposition | platform-admin | operations-admin | 约束 |
| --- | --- | --- | --- |
| `CREATE apps/frontend/<app>/src/app/routing/*Router.tsx` | platform route/page registry、受保护 layout、context reset | key-bearing browser routes、public/authenticated split、role home bootstrap | 使用 `react-router`；运营 browser URL 第一段带 groupWorkspaceKey，URL 不授权 |
| `CREATE apps/frontend/<app>/src/app/state/*Store.ts` | 独立 Redux store / session boundary | 独立 Redux store / context lifecycle listener | 不共享 session/store；context/authorization revision 变化扇出清理缓存 |
| `CREATE apps/frontend/<app>/src/app/api/*Api.ts` | generated platform endpoints + foundation observed base query | generated operations/public endpoints + foundation observed base query | 必须消费 `createObservedBaseQuery`、correlation id、401 intercept；不手写 feature HTTP client |
| `CREATE apps/frontend/<app>/src/app/feedback/*ProblemFeedback.ts` | domain error→用户文案 | domain error→用户文案 | 消费 generated problem codes；服务端 detail 不直接展示 |
| `CREATE apps/frontend/<app>/src/app/observability/*Logger.ts` | app-bound safe logger | app-bound safe logger | 消费 `createSafeLogger`；不记录 token/grant/password/OTP |
| `UPDATE apps/frontend/<app>/src/*App.tsx`、`main.tsx` | 挂 router/store/session boundary | 挂 router/store/session boundary | 删除 `useState` 页面分支和 path regex 作为应用路由 |

前述路径是 stable capability names；不在 runtime/test 使用 R/U/J/G 等流程编号。所有 mutation 通过
foundation lifecycle 取得稳定 idempotency key；没有 `expectedVersion` 的创建也必须如此。多标签
shell 照 v2 搬运，但快照逻辑只放一份共享 helper，两个 app 不复制。

### 6.2 页面与交互承载

- 22 surface / 25 pageDesignKey 的 carry/adapt 基线继续由已接受 interaction artifact 和 frozen
  frontend manifest 决定；不因为新增审计 Modal 改写该分母。
- 每个管理页：名称进入详情，详情右上承载动作，列表不新增操作列；优先使用
  `libraries/frontend/admin-ui-foundation`、ProTable、Descriptions、Drawer/Modal 的既有组合。
- 操作历史只在 Journey §4.1 的 12 个实体详情右上增加按钮，打开同一 `AUDIT-HISTORY-MODAL`：
  左栏为时间优先的分页历史列表，右栏为当前选中项详情；首屏和每个成功新页默认选中首项。
  它不产生路由、tab、首页、dashboard、独立 page key 或 Drawer，也不为单项详情新增 operation。
- `AUDIT-HISTORY-MODAL` 是第 22 个 `x-page-key`，但不是第 26 个 pageDesignKey：前者是 generated
  operation-to-consumer UI annotation，后者是 25 个冻结导航/页面设计 key；二者分母不可互推。
  inventory §1.1 精确列出 12 个详情承载 surface、所属 face operation、`overlayLock` 与 app-local
  field-label map；没有 foundation Modal primitive，也不得新造一个。
- `doc/plans/platform/2026-07-26-v2s-r5-revised-carryover-execution-inventory.md` 是本节的逐 surface/
  pageDesignKey/shell/foundation 执行分母：每项已有 v2 `sourcePath@hash`、v2s target、consumer app、
  disposition、route/generated slice、必须消费的 foundation primitive 与 L2/L3 evidence。实施者不得在
  当前目录结构、旧页面或接口形状中自行推导 carry/adapt/rewrite；该清单和冻结 manifest 是唯一输入。
- 五个 operations 首页继续只搬 v2 route/bootstrap，不填造指标、待办或新内容。
- 所有静态图/视频展示只消费 generated `publicUrl`；没有直接 CDN 字符串拼接、asset byte proxy 或
  前端对 asset existence 的假定。

## 7. 控制先行基线（工作边界契约）

下表的 `baseline control state` 是每个被守卫工作**开始时必须已达到的状态**；字段值闭集只有
`ACTIVE_RED_VERIFIED` 与 `OUT_OF_SCOPE_THIS_PACKAGE`。R5 内的项目均在 scope，故全部必须是
`ACTIVE_RED_VERIFIED`；任何实际未达到者会阻止其后续阶段，而不是登记为 PENDING。

| control | baseline control state | production 判定（一句） | scratchpad 真红变异 | 守卫的后续工作 |
| --- | --- | --- | --- | --- |
| backend ArchUnit servlet/edge/capability | `ACTIVE_RED_VERIFIED` | edge 不依赖 servlet cookie/request、JDBC/repository，capability 只单向依赖允许 owner API | 分别注入 `HttpServletRequest`、`JdbcTemplate`、反向 capability import | 所有 edge/owner 改动 |
| code-layout allowlist | `ACTIVE_RED_VERIFIED` | frontend/backend app 根及 capability tree 只能出现声明目录 | 在真实双层 frontend tree 和 backend root 各加未声明目录 | 所有结构/前端搬迁 |
| frontend architecture | `ACTIVE_RED_VERIFIED` | 每个 catalog-required mutation 经 lifecycle stable key，app feature 不直连手写 client | 删除 lifecycle key；feature 直接 import client | 所有前端 feature |
| route registry reverse coverage | `ACTIVE_RED_VERIFIED` | runtime route 集减 error/actuator 白名单是 registry 子集 | 新增未注册 controller route | 所有 contract/edge 路由 |
| security self-test | `ACTIVE_RED_VERIFIED` | security gate 的变异实际修改被生产检查读取的 face/security input | 篡改真实 `x-consumer-faces` 或对应 policy input | contract/edge 安全变更 |
| logging sensitive-literal | `ACTIVE_RED_VERIFIED` | 仅敏感值侧字面量被拒绝，cookie 名称常量不误伤 | 在请求/日志值注入 token literal；cookie name fixture 保持绿 | logging/HTTP 变更 |
| database/media boundary | `ACTIVE_RED_VERIFIED` | 新 static asset metadata 不含 BYTEA/base64，且具 bucket/object/sha；业务 media ref 有 FK 或 owner 校验 | 插入 BYTEA/base64 或缺 object_key metadata fixture | asset/migration/seed |
| test discovery/L2/L3 | `ACTIVE_RED_VERIFIED` | declared L2/L3 测试必须被实际 runner `--list` 发现 | 添加未被 runner 发现的 spec | L2/L3/evidence/verify |

这些都扩展现有 checker/architecture/verify 分类，不创建“语义理解门”。每项自测绿不计完成；
必须保留 scratchpad 拷贝、变异前后命令和准确红因。`scripts/verify` 只编排一次必要 Gradle
批次，保持分钟级；若超时先删除重复冷启动而非降低判定。

## 8. 总册 §4 八档问题逐项闭合矩阵

| 档 / finding | 本详设落点 | `NOT_APPLICABLE` | completion oracle |
| --- | --- | --- | --- |
| A-1 密码猜测 | §5.2 platform/workspace IAM rate-limit policy、source HMAC/advisory lock、401 no-rollback receipt/audit | 否 | 10/30 阈值、窗口、成功清零、并发 test |
| A-2 OTP 猜测/发送 | §5.2 workspace-iam OTP state + version CAS | 否 | verify 5/10、send 3/10、锁定/过期 test |
| A-3 管理员锁死 | §5.2 platform-iam built-in/self/last active guard | 否 | 三个负例与 advisory-lock 并发 test |
| A-4 幂等空壳 | §5.1/§5.2 receipt reserve→fingerprint→replay→complete | 否 | same key replay、different fingerprint 409、rollback 不烧 key |
| A-5 asset bind proof | §5.1 bind proof + §5.2 claim | 否 | wrong/expired/reused/cross-workspace grant red cases |
| A-6 初始化非事务 | §5.2 platform-workspace/organization | 否 | lock/receipt/group/audit 单事务成功与中途失败回滚 |
| B-1 组织根断链 | §5.2 organization parent model | 否 | 新 group 后 create region 成功；不存在 group typed fail |
| B-2 可变 store FK | §5.2 store update owner invariant | 否 | update 不接收/不写 project/tenant/brand；重建门店的拒绝/读回 |
| B-3 货号重复/500 | §4 JSONB contract、§5.1/§5.2 contract | 否 | strip-lower duplicate、concurrent receipt、mapped Problem |
| B-4 status 无闭集 | §5.1 named checks | 否 | 每 status 列 inventory + invalid write negative |
| B-5 名称唯一 | §5.1 typed preconditions + normalized unique index | 否 | brand/tenant/head-company/store same-class scan and per-table red test |
| B-6 索引/N+1 | §5.1 owner read index inventory + task read batch joins | 否 | explain/read query count budget evidence，不用逐行 secondary lookup |
| B-7 组织无审计 | §5.1 audit facts | 否 | create/update/status actor/action/diff readback |
| B-8 死 GUC | §5.2 remove set_config call sites | 否 | source/runtime query evidence 无写入；不恢复 RLS |
| C-1 receipt/audit/cleanup 空壳或零消费 | §5.1/§5.2 保留已有 owner-local receipt/audit 的有效部分并补齐 106-operation 覆盖、结构化 audit read；asset cleanup 仅对 static object cleanup 保留 | 部分：不再使用的历史表经 precondition DROP，不为空壳强留 | table→owner command/read usage matrix；audit 不再是 `{}`/局部 summary |
| C-2 死列/双时间形状 | §3.2/§5.1 列 inventory；停止读写并 additive retire | 否 | source/query/migration triple scan；不新增 timestamp |
| C-3 invitation 过度状态机 | §5.2 workspace-iam 单一可观测 lifecycle + generation | 否 | 状态转换闭集、EXPIRED write/read、progress 不双主 |
| C-4 分页/排序/重概念重复 | §4 common page schema/sort enum、§6 shared helper | 否 | 106 catalog schema and generated model audit |
| D-1 problem code 零消费 | §4 Problem + §6 feedback | 否 | Java typed code imports、wire error sets、frontend mapping coverage |
| D-2 malformed Problem | §4 common Problem + advice mapping | 否 | type/title/errorCode/correlationId exact response test |
| D-3 双 problem schema | §4 source consolidation | 否 | one authoritative file/ref graph validation |
| D-4 frontend raw detail | §6 feedback mapping | 否 | response fixture proves user text has no raw detail |
| D-5 generated map collapse | §4/§6 typed schema/codegen | 否 | generated wire has typed page/item models, no `Map<String,Object>` boundary |
| D-6 overview projection constants | §5.2 task-read contracts | 否 | remove dead source-status fields or supply real fact; no v2 projection semantics |
| D-7 extension enum 8 vs 5 | §3.2/§4 V160 + schema | 否 | five value contract/code/database crosscheck |
| E-1 无 routing | §6.1 routers | 否 | route integration and protected/public split tests |
| E-2 无 RTK | §6.1 stores/baseApi | 否 | generated endpoint import/cache invalidation test |
| E-3 foundation 三项零消费 | §6.1 observed query/logger/detail lifecycle | 否 | production imports + behavior tests |
| E-4 idempotency 6/22 | §6.1 lifecycle rule | 否 | catalog mutation matrix + stable retry proof |
| E-5 raw feedback/inline locator | §6.1 feature feedback/locator modules | 否 | feature source rules + L2 locator use |
| E-6 catalog 手抄 | §6.1 generated catalog adapter | 否 | menu/page/status/capability derive one generated source |
| F-1 BYTEA | §3.2/§5.1 asset object storage migration | 否 | no BYTEA/base64 + object metadata/object readback |
| F-2 proxy bytes | §4/§5.2 public URL + Range | 否 | public URL/CDN header/Range L3 proof |
| F-3 unused bind grant | §4/§5.1 proof contract | 否 | stage→claim proof consumed once and grant never displayed/persisted |
| F-4 video/validation/cache | §3.2/§5.2 streaming, magic/decode, video Range, immutable ETag | 否 | image/video positive/invalid/Range/cache tests |
| F-5 dangling business media refs | §5.1 owner FK/equivalent validation + seed owner readback | 否 | invalid ref reject; seed cross-table readback |
| G-1 L2/L3 not executed | §7 test discovery + phase 7 runners | 否 | runner `--list`, real L2/L3 exit/evidence |
| G-2 affected-l2 assert only / seed refuses | phase 7 owner-command seed executor | 否 | actual selected tests and r5-full seed owner readback |
| G-3 verify repeated Gradle | §7 minute-scale verify | 否 | timing manifest; no six redundant reruns |
| G-4 security self-test no-op | §7 real mutation target | 否 | scratchpad exact red cause |
| G-5 layout/ArchUnit/frontend missing clauses | §7 baseline controls | 否 | eight red mutations listed in §7 |
| G-6 keyword pseudo gates | phase 1 removes traceability/terminology keyword verdicts to review checklist | 否 | scripts no longer claim semantic PASS; review checklist explicit |
| G-7 logging red undisclosed | phase 1 narrow regex + record current red honestly | 否 | cookie name fixture green; sensitive value red; evidence includes prior failure |
| G-8 v2 governance bloat | §7 adopts only L3/run-managed/test discovery/seed method | 是：permit/journey registry machinery is explicitly excluded | source inventory proves no copied bloat |
| H-1 silent GO revision | phase 0 revision provenance declaration | 否 | old/new hash and reason bound in review package |
| H-2 Roadmap contradiction | phase 0 documentation correction, no scope/authorization inference | 否 | current status prose equals state block |
| H-3 evidence wording drift | phase 1 evidence template exact criterion binding | 否 | evidence cites immutable criterion and does not paraphrase completion |
| H-4 guard after guarded work | §7 control boundary | 否 | no baseline table state outside closed pair; phase entry rejects absent red proof |

### 8.1 Standards Part B/C/D 的规范性命中与执法路由

`doc/review/platform/2026-07-26-v2s-r5-revised-design-granularity-manifest.json` 的
`standardsCoverage` 是本计划的逐条规范性命中表：它逐条列出 B=85、C=23、D=42 个**真实 ruleId**，
并对每个异构组分开给出 `reviewRuleIds + reviewChecklistRef` 与
`notApplicableRuleIds + machine-enforced reason`；不得用范围、通配符或一个 checklist 冒充整组。
本计划的落位为：B.1–B.3→§3/§4/§5，B.4–B.5→§6/inventory，B.6→§5/§10，C.1–C.4→§3–§7/§10，
D.1–D.8→§0/§2/§4/§5/§7/§9/§10。矩阵中 `GATE`、`ARCHUNIT` 与 `NEGATIVE_FIXTURE` 的 ruleId 在
本次 human design review 均明确为 `NOT_APPLICABLE(machine-enforced)`；只有矩阵指定的 review ruleId
进入对应 checklist。实施 P1 在**既有** `standards-coverage` 内补 manifest→matrix 的 ruleId/checklist/
N-A 机械一致性校验及 Claude round-2 的四组 red mutation；它不新增 gate 类别，也不在本 design-only
阶段伪称已落地。

## 9. 实施阶段与顺序

实施在本设计经完整 review/接受后才可启动。阶段内可按无共享写集并行，但每一条 phase exit
是硬前置，不形成中途产品验收或独立 review cycle。

| phase | 进入前提 | 工作内容 | 不可跨越的完成判定 |
| --- | --- | --- | --- |
| P0 设计冻结与审计看图 | 本草案、audit Journey/interaction 都存在 | 审计 Master–Detail Modal 已由 Dexter 接受；生成 revised manifest；独立子 agent 盲审（最多两轮）→ Claude → Dexter 接受；披露旧方案 hash 修订与 Roadmap 叙事矛盾 | audit interaction `ACCEPTED`；新 design status accepted；此后才产生实施许可 |
| P1 控制先行 | P0 accepted | 完成 §7 全部现有分类控制，逐条 scratchpad 真红；登记 logging/verify 当前红；移除关键词伪 gate；minute-scale verify 编排 | §7 8/8 `ACTIVE_RED_VERIFIED`，无 PENDING；任一红/无红证明即停止，不开始 P2 |
| P2 契约与数据库基线 | P1 pass | 104→106 scalar-face contract、Problem/source consolidation、JSONB items、asset URL/metadata、audit schemas、status/index/precondition migrations、codegen；同时更新既有 generator、placement catalog、boundary gate、verify gate 的 `39/56/11/106` 常量与真实 route-face registry 生成目标 | contract lint/codegen/106 catalog and face closure all pass；migration bytes只新增；所有 consumer 仍未开始依赖旧形状 |
| P3 owner 后端与安全 | P2 pass | A-1~A-6，B/C/D owner changes，asset streaming/object adapter/Range，receipt/audit，同事务与 task reads | compiler + owner focused tests；每安全负例与 audit/receipt transaction proof pass |
| P4 双前端 substrate | P2 contract codegen pass；P3 可用 read/write contract | router、RTK generated api、401/context fan-out、logger、feedback、catalog adapter、多标签 shared helper | two independent app architecture tests/L2 prove foundation imports、stable idempotency、no raw error/client duplication |
| P5 页面 carry/adapt 与审计 Modal | P4 pass；P3 对应 owner endpoint pass | 22 surfaces/25 keys的 v2 baseline搬运/适配，五 home bootstrap，12详情 audit button/Master–Detail Modal | 每 surface 的 route/owner/locator/readback matrix；audit 左侧时间列表分页、当前项右侧详情、换页默认首项、denied/empty cases pass |
| P6 DEV 与丰富 seed | P3/P5 pass | 受管 dev start/restart/stop/reset/seed/check；remote readiness；r5-full owner-command fixture/邀请链；业务与 cleanup 分账 | 从清洁 remote DEV namespace rebuild→explicit seed→双 app 完整操作/readback；普通 dev start 永不 seed |
| P7 全范围证据与唯一 implementation review | P6 pass | L2/L3 actual runner、106/32/22/25/7 traceability、security/cleanup evidence、方案合理性重审 | 一份 section-sized R5 implementation review target；不把 phase evidence 伪装为中途 GO |

## 10. DEV、seed、测试与证据

- `dev start/restart/stop`：run-scoped manifest、remote readiness、结构化脱敏日志；只 additive Flyway，
  不 seed。stop 只清理自身 manifest 资源。
- `dev reset`：仅显式远端 DEV namespace allowlist；前后 readback；永不自动 seed。
- `dev seed --profile r5-full`：普通事实优先真 edge/owner command，任职重放邀请接受链；只有不能
  由 command 产生的部署前提可以有逐表列 DEV-only bootstrap allowlist，并给 owner readback。
- static asset seed 必须先 stage/claim 生成真实 metadata/object，后写 business asset ref；不得直写
  `logoAssetRef` 造成悬空引用。
- L2/L3 runner 先 `--list` 证明发现，再运行；业务结果和 cleanup 分开，cleanup 非 PASS 即未完成。
  动态首败先保留 manifest/log，第二次同 signal 前定位边界，禁止以增长 timeout 代替诊断。

## 11. 实施限制与下一步

本文不授权实施、DEV、seed/reset 或动态运行。操作历史 Master–Detail Modal 已由 Dexter 接受；
下一步是以本修订设计和 manifest 完成最多两轮独立子 agent 盲审、Claude review 与 Dexter 接受。
在这些完成前不写 app/contract/database/test/business 源码。
