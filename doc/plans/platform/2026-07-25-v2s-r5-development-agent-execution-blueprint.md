---
title: R5 development-agent execution blueprint
status: PROPOSED_REVIEW_ONLY
createdAt: 2026-07-25
programId: V2S_W0_W4_EXECUTION
reviewTarget: DESIGN
implementationAuthority: false
---

# R5 开发 agent 低偏航执行蓝图

## 1. 使用方式

本蓝图把 whole-scope design 下钻为开发 agent 可直接执行的结构。它不授权实施。未来获得
exact implementation authorization 后，每个 unit 必须按以下顺序工作：

1. 重开本蓝图该 unit、对应 Journey/interaction、edge dialectical assessment；
2. 只创建/修改列出的 package、表、operation 与页面；
3. 先写 owner/domain/transaction test，再接 generated adapter 与 UI；
4. focused evidence PASS 后继续下一 unit，不产生中途 review verdict；
5. 任一未决行为不得由开发 agent自行扩产品，回到 owning design/decision。

门用于发现回归；本蓝图负责在编码前给出正确路径。
若本蓝图、whole-scope design、Journey/interaction、机器可读 catalog/manifest 或当日相关
decision 对同一事实给出不同值，必须在写源码前停止并修正 owning design；禁止以“主设计优先”
丢掉更具体的列/字段/路径，也禁止临场选择第三种实现。2026-07-26 五项裁决以及机器可读
catalog/manifest 是本轮已知冲突的显式收口，不再保留旧值。

## 2. 全局编码和命名约定

### 2.1 Java package

每个 owner library 使用：

```text
com.catering.v2s.<capability>.api
com.catering.v2s.<capability>.domain
com.catering.v2s.<capability>.application
com.catering.v2s.<capability>.adapter.out.persistence
```

- `api` 只放跨模块 command/judgment/readback，不放 repository、Spring 或 generated wire；
- `domain` 只放实体、值对象、不变量和 typed domain problem；
- `application` 只放 use-case service、事务顺序与 task-query assembler；
- generated server interface 的 face adapter 位于 business server 的
  `com.catering.v2s.app.edge.<face>.<capability>`；它做 wire↔application 映射和可信 edge
  resolver 调用，不能迁入多 face owner library；
- `adapter.out.persistence` 实现本模块 repository 与显式 task-query SQL；
- 不创建 `common/domain/shared-model/util/serviceImpl` 通用桶；
- 不在目录、package、文件或类名使用 R/U/J/JG/PKG/G-*。

### 2.2 Java 类型约定

- command：动词+对象，如 `CreateGroupWorkspaceCommand`；
- owner readback：对象+`Readback`，始终含 stable id/key、status、version、时间；
- task query：页面任务+`TaskQuery`，如 `PlatformOrganizationOverviewTaskQuery`；
- judgment：`CanEnterServiceNode`、`ResolveContractCandidates` 等窄接口；
- repository 只在 `application` 定义 port，在 `adapter.out.persistence` 实现；
- controller 不直接注入 JDBC/repository；
- domain 不接收 HTTP headers、cookie、generated request 或 execution context。

### 2.3 数据约定

- id：UUID；外部业务 key/code 为单独列；
- 所有 instant/timestamp：Java `long/Long epochMillis`，PostgreSQL `BIGINT`，单位毫秒；包括所有
  `createdAt/updatedAt/changedAt/expiresAt/lockedUntil/lastSeenAt/revokedAt/invalidatedAt`
  及同义业务时间点。repository mapper 必须显式读写 long，禁止以 `String`、`LocalDateTime`、
  `OffsetDateTime`、`Instant` 或数据库 timestamp 作为持久化字段类型；如 domain 内部短暂使用
  `Instant` 做运算，只能在 application/domain 边界由同一个 clock 转换，repository 与 readback
  仍为 epochMillis long；
- 纯 business date：Java `LocalDate`、PostgreSQL `DATE`、wire `format: date`，只用于不含
  时区/时分秒的业务日历日（R5 仅合同 `effectiveFrom/effectiveTo`）；禁止把 business date
  偷换成零点 epochMillis；
- 所有 owner/application 只能从 `platform-foundation/time.TimeProvider` 取得 instant；
  production/default 实现返回真实 epoch millis，DEV fixed 实现只有 namespace 匹配、
  `r5-full` profile 且非-production marker 三项同时成立才装配，否则 fail-closed；
  `contract.application.BusinessDateProvider` 只把同一 instant 按 `Asia/Shanghai` 投影为业务日；
  禁止直接调用 `System.currentTimeMillis()`、系统默认 zone 或把作者机器时区写入 fixture；
- status：具名 `VARCHAR` + CHECK；
- CAS：`version BIGINT NOT NULL`，写 SQL 以 `WHERE id=? AND version=?`；
- workspace-scoped：`workspace_uuid UUID + group_workspace_key VARCHAR(64)`；
- FK/unique/Check 全部具名；
- receipt：`operation_id, subject_id, idempotency_key, request_hash, response_json,
  outcome, created_at`，唯一 `(operation_id, subject_id, idempotency_key)`；
- audit：只存业务摘要、subject、operation、target、outcome、time、correlation，不存 secret/raw body。

### 2.4 v2 backend foundation 逐项去留

`libraries/backend/platform-foundation/` 是无业务事实、无 generated wire、无 Spring owner
依赖的窄基础库，不是 `common` 杂物桶。开发 agent 只可按下表落盘；未列 v2 类不得顺手复制：

| v2 机制 | v2s 目标 | disposition |
| --- | --- | --- |
| `CorrelationIdSupport`、`RequestContext`、`PlatformRequestContextFilter` | `platform-foundation/correlation` | `CARRY_ADAPT`；仅 edge/proxy 可信请求上下文 |
| `SafeLogEvent`、`SafeLogSanitizer`、`StructuredLogger`、`PlatformObservabilityAutoConfiguration`、`PlatformDatabaseObservationConfiguration`、`logback-spring.xml` | `platform-foundation/logging` | `CARRY_ADAPT`；完整编译依赖一起搬，服从 v2s run-scoped 脱敏日志标准 |
| `PlatformHttpHeaders`、`PlatformHttpProtocol` | `platform-foundation/http` | `CARRY_ADAPT`；只定义外部 edge header/Problem 约定 |
| `PlatformHttpHeadersInterceptor` | 无 | `NOT_CARRIED`；不存在内部 OpenAPI client |
| `ProblemDetailSupport` | `platform-foundation/problem` + business app advice | `SPLIT_ADAPT`；foundation 只保留 RFC7807 skeleton、correlationId 与无 wire 的 typed problem carrier；generated ErrorCode→HTTP status/Problem 映射落 `catering-business-server` app advice |
| 新建 `TimeProvider` | `platform-foundation/time` | `CREATE_NARROW_PRIMITIVE`；唯一 epoch millis 来源；DEV fixed 实现受三条件 profile 门禁 |
| `PagedQuery`、`WhereBuilder` | `platform-foundation/pagination` | `CARRY_ADAPT`；七 owner 的所有 list task query 使用，sort 值先由闭集 enum 解析再进入 builder |
| `CountingJdbcTemplate`、`DatabaseOperationTracker` | `platform-foundation/persistence` | `CARRY_ADAPT`；只做 query budget observation |
| `AdvisoryLock` | 无 | `NOT_CARRIED`；R5 使用具名 unique/FK/CAS 与行级 owner command 锁，不引入未绑定的通用锁 primitive |
| `OtpRateLimitPolicy` | `workspace-iam/application/security` | `MOVE_TO_OWNER`；purpose/account/workspace 语义归 IAM |
| `CryptoSupport` | 无 | `NOT_CARRIED`；密码 hash 使用 workspace/platform IAM 明确配置的 Spring `PasswordEncoder`，不复用通用 crypto |
| `OwnerCommandAuthorizationProofCanonicalizer`、`OwnerCommandAuthorizationProofTransport`（Ed25519 owner proof） | 无 | `NOT_CARRIED`；单 deployable 无 owner proof transport |
| `GeneratedProblemSemantics`、`DownstreamProblemTranslator` | 无 | `NOT_CARRIED`；当前 edge catalog 重新生成 app advice，且无 downstream |
| `InternalServiceSecurity` | 无 | `NOT_CARRIED`；无内部 HTTP client/服务调用 |
| `ExtensionDefinitionProjectionMessageProtocol`、`ExtensionDefinitionProjectionRepairMessageProtocol`、`OrganizationAuthorizationProjectionMessageProtocol`、`OrganizationAuthorizationProjectionRepairMessageProtocol`、`OrganizationContractReferenceProjectionMessageProtocol`、`OrganizationContractReferenceProjectionRepairMessageProtocol`、`PlatformWorkspaceAssetBindingMessageProtocol`、`WorkspaceAuthorizationProjectionMessageProtocol`、`WorkspaceAuthorizationProjectionRepairMessageProtocol` | 无 | `NOT_CARRIED`；MQ/projection/repair 拓扑残件 |
| generated operation/page constants | `scripts/generate` 从当前 edge OpenAPI 再生 | `REGENERATE`；不得复制旧 `platform-wire-model` |

基础库可以被七个 owner module 与 business app 依赖，但不能依赖任一 owner module、app、
generated client/server 或业务 schema。owner 不变量、状态机、receipt 和 repository 永不进入
foundation。表中每个 v2 production 类均已 disposition；未列类名仍一律禁止搬运。

## 3. Edge implementation map

### 3.1 contract 文件布局

```text
contracts/openapi/
├── edge.openapi.yaml
├── paths/
│   ├── platform-admin/
│   │   ├── authentication.paths.yaml
│   │   ├── workspace-management.paths.yaml
│   │   ├── platform-admin-governance.paths.yaml
│   │   ├── organization-overview.paths.yaml
│   │   ├── contract-overview.paths.yaml
│   │   ├── role-management.paths.yaml
│   │   ├── workspace-account-management.paths.yaml
│   │   └── extension-field-management.paths.yaml
│   ├── operations-admin/
│   │   ├── authentication.paths.yaml
│   │   ├── organization-hierarchy.paths.yaml
│   │   ├── business-entity-management.paths.yaml
│   │   ├── store-management.paths.yaml
│   │   ├── contract-management.paths.yaml
│   │   ├── user-management.paths.yaml
│   │   └── store-profile.paths.yaml
│   └── public/
│       ├── asset-content.paths.yaml
│       └── invitation.paths.yaml
└── components/
    ├── common/
    │   ├── pagination.schemas.yaml
    │   ├── problem.schemas.yaml
    │   └── security.schemas.yaml
    ├── platform/
    │   ├── authentication.schemas.yaml
    │   ├── workspace.schemas.yaml
    │   ├── asset.schemas.yaml
    │   └── administration.schemas.yaml
    ├── organization/
    │   ├── hierarchy.schemas.yaml
    │   ├── business-entity.schemas.yaml
    │   ├── store.schemas.yaml
    │   └── extension.schemas.yaml
    ├── workspace-iam/
    │   ├── role.schemas.yaml
    │   ├── account.schemas.yaml
    │   ├── invitation.schemas.yaml
    │   └── session.schemas.yaml
    └── contract/
        ├── contract-command.schemas.yaml
        └── contract-read.schemas.yaml
```

`edge.openapi.yaml` 只放 OpenAPI metadata、全局 security/tag 与每条 route 到
`paths/<face>/<capability>.paths.yaml` 中 Path Item 的 `$ref`，不得内联 operation/schema。
每个 path 文件只拥有一个 face+capability；每个 component 文件只拥有一个 owner+schema family。
手写 YAML 单文件非空行上限为 500；达到上限时必须在同一目录继续按 `read/command` 或明确
子能力拆分，禁止把内容重新汇总进 `edge.openapi.yaml`。codegen 可生成临时 bundled spec，
但 bundle 只用于校验/生成且不进入 source truth。禁止再建 internal OpenAPI。

逐 operation 的规范性输入不是本节摘要，而是
`doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json` 与
`doc/plans/platform/2026-07-26-v2s-r5-edge-contract-file-placement-catalog.json`。开发
agent 必须逐行实现其中的 `scenarioIds/owner/pageKey/security/queryParameters/
requestSchema/responseSchema/successStatus/idempotency/expectedVersion/errorSetRef/
focusedTestId`，并先确定性解析每项 `capability/pathFile/requestComponentFile/
responseComponentFile/successContentType/errorContentType`。解析报告必须是 104 行、operationId
集合完全相等、零缺失、零歧义。catalog 未列字段、alias、errorCode 或 operation 一律不得临场
补造。

开发 agent 的固定落盘顺序是：先按 placement catalog 生成 resolved report，再按其中目标 path
文件写 operation，把 request/response schema 写入唯一目标 component 文件，最后只在根入口增加
route `$ref`。
不得先把 104 项堆进一个文件后再“以后整理”；分类是创建文件时的前置输入。

### 3.2 每类 operation 的 adapter

| group | generated adapter class | application entry |
| --- | --- | --- |
| platform auth/session | `PlatformAuthenticationController` | `PlatformAuthenticationService` |
| platform admins | `PlatformAdminGovernanceController` | `PlatformAdminGovernanceService` |
| group workspaces | `PlatformGroupWorkspaceController` | `PlatformWorkspaceCommandService` / `PlatformWorkspaceTaskQuery` |
| assets | `PlatformAssetController`、`PublicAssetContentController` | `PlatformAssetService` |
| platform overviews | `PlatformOrganizationOverviewController`、`PlatformContractOverviewController` | owner task-query interfaces |
| roles/accounts/invitations | `PlatformWorkspaceAccessController` | `WorkspaceRoleService` / `WorkspaceAccountService` / `WorkspaceInvitationService` |
| operations organization | `OperationsOrganizationController` | `OrganizationCommandService` / task queries |
| operations contracts | `OperationsContractController` | `ContractCommandService` / `ContractTaskQuery` |
| operations membership/invitations | `OperationsWorkspaceAccessController` | workspace-IAM services |
| operations auth/session | `OperationsAuthenticationController` | `WorkspaceAuthenticationService` / `WorkspaceSessionService` |
| public invitation/reset | `PublicInvitationController`、`PublicPasswordResetController` | purpose-specific workspace-IAM services |

adapter 统一流程：

```text
generated request
-> resolve correlation + trusted face/session
-> map to typed application command/query
-> call exactly one initiating application service
-> map owner readback to generated response
-> map typed problem through central generated ErrorCode
```

controller 不编排多个 repository。需要多 owner 的用户任务由 initiating module application service
调用公开 API 或 task-query SQL。

### 3.3 write header matrix

| command category | Idempotency-Key | expectedVersion | 特例 |
| --- | --- | --- | --- |
| create/update/status/replace/revoke/invalidate | required 16–128 | create 无；update/status/replace 有 | owner receipt |
| login/logout/session switch | 逐 operation 服从 contract catalog；login/OTP 使用 secret-safe security purpose receipt，logout terminal replay | 不用 aggregate CAS；switch 必须带 context `expectedVersion` | receipt 只保存脱敏 canonical hash，不保存 password/OTP/token；session/context version 在 readback |
| invitation accept/OTP/credentials/complete | required | invitation aggregate写使用 expectedVersion only when readback exposes it | purpose/token/grant由 owner解析 |
| GET | forbidden | forbidden | 不读取同名 header |

若实现时某个 POST 被判定完全无写效果，应改为 GET，而不是豁免 header。不得给 GET 加 header
凑统一。

## 4. platform-IAM 详细设计

### 4.1 package/class

```text
platform-iam/api/
  PlatformPrincipalRef
  PlatformSessionReadback
  ResolvePlatformExecutionContext
  RevokePlatformSessions
platform-iam/domain/
  PlatformAdmin
  PlatformCredential
  PlatformSession
  PlatformAdminStatus
  PlatformIamProblem
platform-iam/application/
  PlatformAuthenticationService
  PlatformAdminGovernanceService
  PlatformCredentialService
  PlatformSessionRepository
  PlatformAdminRepository
  PlatformCredentialRepository
platform-iam/adapter/out/persistence/
  JdbcPlatformAdminRepository
  JdbcPlatformCredentialRepository
  JdbcPlatformSessionRepository
```

`platform-access` 继续拥有 edge signature/proxy context verification，但认证成功后的 product
principal/session 解析委托 `ResolvePlatformExecutionContext`；它不创建第二身份表。

### 4.2 tables

| table | critical columns / constraints |
| --- | --- |
| `platform_iam.platform_admin` | `id, login_name, login_name_normalized, display_name, mobile_mask_source, status, version, created_at, updated_at`; unique normalized login；status ENABLED/DISABLED |
| `platform_iam.platform_credential` | `platform_admin_id PK/FK, password_hash, algorithm, changed_at, failed_attempts, locked_until, version` |
| `platform_iam.platform_session` | `id, platform_admin_id, token_hash, status, expires_at, created_at, last_seen_at, revoked_at, revision`; token_hash unique |
| `platform_iam.platform_credential_reset` | `id, platform_admin_id, generation_key_hash, status, expires_at, completed_at, version` |
| receipt/audit | 按全局约定；不得保存 password/token/hash原文 |

### 4.3 transaction sequences

login：

```text
normalize login -> read admin+credential -> constant-time verify
-> check ENABLED/lock -> create session(token hash only)
-> update successful login metadata -> return session readback + cookie
```

self password：

```text
verify current credential -> validate new credential policy
-> CAS credential version -> revoke all other sessions
-> retain current request only until response -> audit -> readback
```

admin disable：

```text
CAS admin status -> revoke all target sessions -> audit -> detail readback
```

禁止：默认/root 行、platform role 表、管理员输入他人新密码、operations assignment。

## 5. platform-workspace 与 asset 详细设计

### 5.1 classes

```text
platform-workspace/api/
  GroupWorkspaceRef
  RequireActiveGroupWorkspace
  GroupWorkspaceReadback
  PlatformWorkspaceCoordinator
platform-workspace/application/
  PlatformWorkspaceCommandService
  PlatformWorkspaceTaskQueryService
  GroupWorkspaceRepository
platform-asset/api/
  StageAssetCommand
  ClaimWorkspaceLogoCommand
  ReleaseWorkspaceLogoCommand
  AssetContentRead
  AssetReadback
platform-asset/application/
  PlatformAssetService
  AssetRepository
  AssetStorage
```

### 5.2 workspace columns

R3 `group_workspace` additive 扩为；不得改写
`V20260725_170000_000__platform_workspace_and_commercial_group.sql`，也不得从 V1 重开：

```text
id BIGINT transitional retain
workspace_uuid UUID not null
group_workspace_key
name / name_normalized
operations_title
logo_asset_ref nullable
notes nullable
status ENABLED|DISABLED
version
revision transitional read-only / version
created_at transitional / created_at_epoch_millis / updated_at / status_changed_at
```

unique：key、normalized name。`logo_asset_ref` 只引用 asset owner readback，不由客户端拼 URL。
另建具名 `UNIQUE(workspace_uuid, group_workspace_key)`，所有新 owner 表只以该二元组复合
FK 回指 workspace。
切换顺序固定为：新增 UUID/version/epoch 列 → 回填 → readback 对账 → 加约束 → 新 repository
切列；旧 BIGINT/revision/TIMESTAMPTZ 本 R 保留且停止新写。`commercial_group` 同样新增
`commercial_group_uuid`、`version`、epoch millis；旧 FK 只作 transitional retain。key 从
120 收窄到 64 前必须全表长度 readback，超长即失败，禁止截断或 alias。

同一 compatibility migration 必须先比对 R3 四个 FORCE RLS policy 的名称和
`consumer_face='platform-admin'` 定义，再对 `group_workspace`、`commercial_group`、
`commercial_group_audit`、`commercial_group_idempotency` 逐一 drop policy、`NO FORCE`
并 disable RLS。不得改写 R3 migration，也不得放宽为按 face 猜授权；R5 的唯一授权链是
app layer 解析 immutable execution context，owner 在 command/judgment 内复核，task query
显式带 workspace/subject/scope predicate。policy 漂移或 drop/readback 不一致立即停止。

### 5.3 asset columns/storage

```text
platform_asset.staged_asset(
  asset_ref PK, usage, workspace_scope_key nullable,
  storage_key, content_type, size_bytes, sha256,
  status STAGED|ACTIVE|RELEASED|CLEANUP_PENDING|CLEANED,
  expires_at, claimed_by_type, claimed_by_id,
  created_at, activated_at, released_at, version
)
platform_asset.asset_cleanup(
  asset_ref PK/FK, reason, attempts, last_error_code, next_attempt_at, completed_at
)
```

DEV `AssetStorage` 只允许配置的 remote host root；key 精确为
`<V2S_DEV_ASSET_ROOT>/catering-v2s/dev/<V2S_DEV_NAMESPACE>/<groupWorkspaceKey-or-staging>/<opaque-id>`，
不使用文件名。`staged_asset` 自身保存 claim/release owner fact，不另建 `asset_content` 或
`asset_claim` 表；bytes 只在受管 storage。上传以 bounded
stream 写 temp key，完成 magic-byte/decoder/digest 后原子 rename。

### 5.4 workspace create/update transaction

```text
reserve receipt
-> validate workspace fields
-> if logo ref: platformAsset.claimWorkspaceLogo(...)
-> insert/update workspace with CAS
-> if replacing/removing old logo: platformAsset.releaseWorkspaceLogo(...)
-> append workspace audit
-> return task readback with backend-built logoUrl
```

任一失败整体 rollback DB；storage temp/cleanup 另记 cleanup account。成功返回前 public content
必须可读。无 outbox、proof/grant、transient 404 retry。

## 6. extension 详细设计

### 6.1 classes

```text
extension/api/
  ExtensionHostType
  ExtensionDefinitionReadback
  ResolveExtensionDefinition
  ValidateExtensionValues
extension/domain/
  ExtensionDefinition
  ExtensionFieldDefinition
  ExtensionFieldType
  ExtensionProblem
extension/application/
  ExtensionDefinitionService
```

host enum 只有 `BRAND/TENANT/HEAD_COMPANY/STORE/CONTRACT`。

### 6.2 tables

```text
extension.extension_definition(
  id, workspace_uuid, group_workspace_key, host_type,
  version, created_at, updated_at,
  UNIQUE(workspace_uuid, group_workspace_key, host_type)
)
extension.extension_definition_field(
  definition_id, field_key, label, field_type,
  required, display_order, config_json,
  PRIMARY KEY(definition_id, field_key)
)
```

replace command 在一事务中校验 field key 唯一、type/config、order、required 后完整替换 fields，
CAS definition version，返回新完整集合。value 不进 extension schema；各 entity owner 保留未知
旧 key/value，只有当前可解析字段参与编辑校验。

## 7. organization 详细设计

### 7.1 package/class

```text
organization/api/
  OrganizationNodeRef
  RequireOrganizationNode
  RequireStoreForAssignment
  ResolveStoreCandidates
  OrganizationReadbacks
organization/application/
  OrganizationHierarchyService
  BusinessEntityService
  StoreService
  PlatformOrganizationOverviewTaskQuery
  OperationsStoreTaskQuery
organization/domain/
  OrganizationNode
  Brand
  Tenant
  HeadCompany
  Store
  BrandAuthorization
```

### 7.2 tables

| table | critical columns / constraints |
| --- | --- |
| `organization.organization_node` | workspace composite ref、`node_type GROUP/REGION/PROJECT`、parent、code/name/status/version；GROUP parent null，REGION parent GROUP，PROJECT parent REGION |
| `organization.project_phase_name` | `project_id, phase_name, display_order`；`UNIQUE(project_id,phase_name)`；只有有序名称，无 phase id/key/lifecycle |
| `organization.brand` | workspace ref、code/name/status/version |
| `organization.tenant` | workspace ref、code/name/legal_name/credit_code/status/version |
| `organization.head_company` | workspace ref、code/name/legal fields/status/version |
| `organization.head_company_brand_authorization` | workspace ref、head_company_id、brand_id、authorized_at；复合 FK |
| `organization.store` | workspace ref、project_id、tenant_id、brand_id、`head_company_id nullable`、code/name/status/version |
| `organization.{brand,tenant,head_company,store}_extension_value` | entity_id、field_key、value_json、definition_version；`PRIMARY KEY(entity_id,field_key)`，随实体 command 同事务写 |

所有 referenced entity composite unique 含 workspace keys；store FK 使用复合键，防跨空间拼接。

### 7.3 store command

```text
require active workspace
-> require PROJECT node in workspace
-> require tenant/brand in workspace
-> if head-company supplied, require it in workspace and require head-company-brand authorization
-> validate extension values against STORE definition
-> insert/update with CAS
-> audit/receipt -> owner readback
```

门店 DISABLED 只改变 store status。workspace-IAM 在未来 login/switch judgment 中拒绝
store-node assignment entry；不撤销 assignment，不改 contract。

## 8. workspace-IAM 详细设计

### 8.1 package/class

```text
workspace-iam/api/
  WorkspaceAccountRef
  WorkspaceSessionReadback
  RequireWorkspaceExecutionContext
  ResolveNavigation
  RevokeAssignmentCommand
workspace-iam/application/
  WorkspaceRoleService
  WorkspaceAccountService
  WorkspaceInvitationService
  PublicInvitationService
  WorkspaceAuthenticationService
  WorkspaceSessionService
  WorkspacePasswordResetService
  WorkspaceMembershipTaskQuery
  WorkspaceInvitationCandidateTaskQuery
```

### 8.2 tables

| table | critical columns / constraints |
| --- | --- |
| `workspace_iam.workspace_account` | workspace ref、mobile normalized、login normalized、display name、status/version；workspace+mobile/login unique |
| `workspace_iam.workspace_credential` | account_id、password_hash/algorithm、changed/lock/version |
| `workspace_iam.workspace_role` | workspace ref、name、service_node_type、description、status/version |
| `workspace_iam.role_page_access` | role_id、page_design_key |
| `workspace_iam.role_capability` | role_id、capability_key |
| `workspace_iam.role_assignment` | workspace ref、account_id、role_id、service_node_type/id、status、source_invitation_id、version；新增必须 source invitation |
| `workspace_iam.invitation` | workspace ref、mobile、inviter、status、expires_at、version |
| `workspace_iam.invitation_assignment_intent` | invitation_id、role_id、service_node_type/id；完成前只是 intent |
| OTP/grant | token/grant hash、purpose、status、expires/used_at、attempt count；不同 purpose 不共用 |
| `workspace_iam.workspace_session` | workspace/account、token_hash、current_assignment_id、visible_data_node、context_version、authorization_revision、status/expires/revoked |

### 8.3 invitation state machine

```text
PENDING
  -> ACCEPT_INTENT_RECORDED
  -> MOBILE_VERIFIED
  -> CREDENTIAL_READY
  -> COMPLETED

PENDING/ACCEPT_INTENT_RECORDED -> CANCELLED
PENDING/CANCELLED/EXPIRED -> REISSUED (new token generation, old token stays terminal)
```

`complete` transaction：

```text
lock invitation by token hash
-> require accepted + verified + unexpired purpose grants
-> revalidate every role/service node with organization judgment
-> create or reuse account only under owner readiness rules
-> create all assignment rows; any conflict rejects whole set
-> mark invitation COMPLETED and grants USED
-> receipt/audit -> stable completion readback
```

任何早期 step 不创建 assignment。新增任职没有其他 API。
邀请候选不得返回停用门店；`complete` 仍须在事务内重验门店启用状态，防候选读取后的竞态。
该规则不撤销既有任职，也不得反推合同候选或合同状态。

角色授权保持一个 command：request 有 `pageAccessKeys` 与 `actionCapabilityKeys` 两个独立集合，
分别校验 catalog 闭集、重复项、调用者可授予上限与目标 role 约束，然后在一个
workspace-IAM transaction 中原子替换。任一集合失败则两组均不变；页面准入不能推导动作能力，
动作能力也不能推导页面准入。

### 8.4 login/context

login：

```text
resolve workspace by groupWorkspaceKey -> require workspace ENABLED
-> verify account/credential -> list active assignments
-> for each assignment ask organization whether service node is enterable
-> 0 role: session with empty workbench
-> 1 role: select it
-> N roles: return explicit choices
```

switch role/data node：

```text
require current session + expectedVersion
-> re-read assignment/role/page/action + organization node status
-> validate visible data node independent from page/action
-> increment contextVersion
-> set authorizationRevision from owner facts
-> return complete session/navigation readback
```

不提供 page-entry guard endpoint。router 用 navigation 做 UX；每个 task endpoint 重新执行真实
授权，避免 TOCTOU。

内部导航判断唯一命名为 `ResolveNavigation`，输入 owner-confirmed session/context，输出当前
page keys/actions 的 UX readback。它不是公开 operation、不是 authorization proof，也不得被
controller 暴露。每个 route 的 owner source 固定为
`contracts/policy/frontend-asset-carryover-manifest.json` 的 `generatedSlice`；真实请求仍按
§8.4 的 session、assignment、node、page、capability、visible-data 与 owner invariant 全量复核。

## 9. contract 详细设计

### 9.1 classes

```text
contract/api/
  ContractReadback
  ResolveStoreContractRead
  ContractDerivedStatus
contract/application/
  ContractCommandService
  ContractTaskQuery
  PlatformContractOverviewTaskQuery
  StoreContractTaskQuery
  BusinessDateProvider
contract/domain/
  StoreContract
  ContractItem
  ContractStatus
```

### 9.2 tables

```text
contract.store_contract(
  id, workspace composite ref,
  contract_no, store_id, tenant_id,
  effective_from DATE, effective_to DATE nullable,
  phase_name_snapshot,
  notes, status ACTIVE|INVALID,
  invalidated_at, version, created_at, updated_at,
  UNIQUE(workspace..., contract_no)
)
contract.store_contract_item(
  contract_id, line_no, item_code, item_name,
  PRIMARY KEY(contract_id, line_no),
  UNIQUE(contract_id, item_code)
)
contract.store_contract_extension_value(
  contract_id, field_key, value_json,
  PRIMARY KEY(contract_id, field_key)
)
```

create/update：

```text
require capability + visible data scope
-> organization resolves store/tenant/project and returns store status without filtering disabled store
-> validate optional supplied phase name against current project phaseNames, then persist name snapshot only
-> validate date interval and nonempty unique item codes with names
-> validate extension values
-> insert/update aggregate+items+values with CAS
-> receipt/audit -> complete readback
```

derived status uses `BusinessDateProvider.today()`：

```text
exists ACTIVE where effective_from <= today
  and (effective_to is null or effective_to >= today) -> OPERATING
else exists ACTIVE where effective_from > today -> PREPARING
else -> NOT_OPERATING
```

不写 derived column，不挑“唯一当前合同”，不影响 store/session/authorization。

## 10. frontend 执行映射

### 10.1 app/foundation import rule

```text
app page/feature
  -> app-owned generated RTK endpoint
  -> admin-ui-foundation primitive

admin-ui-foundation
  -X-> app
  -X-> generated wire
platform-admin -X-> operations-admin
operations-admin -X-> platform-admin
```

开发 agent 新建页面前先尝试：

- `useDrawerFormLifecycle`
- `useDetailDrawer`
- `contextScopedQueryArgs`
- `overlayLock`
- `observedBaseQuery`
- `platformHttpProtocol`
- `testId` / automation exports

只有 foundation 确实没有且行为属于 app-specific task，才在 feature 内新增。
已复制 foundation 的
`libraries/frontend/admin-ui-foundation/src/list/contextScopedQueryArgs.ts` 与
`src/foundation.test.ts` 是 R5 明确更新面：把 context/input/output 的 `workspaceKey`
一次性改为 `groupWorkspaceKey`，不保留 alias、dual field 或兼容 overload。其余 primitive
逐个按 `frontend-asset-carryover-manifest.json` 消费；不得因为文件已复制就假设语义无需适配。
manifest 是 22 surface、133 handwritten runtime、2 generated wire、45 reference test 的完整
分母；app shell/routing/state/layout/theme/forms/feedback/automation 按 APP_SHARED_ADAPT 归属，
不得只搬 22 个主文件。两个 app 的薄 Drawer wrapper 仅可注入参数，必须都设置
`idempotencyKey:true` 与 `onDiagnosticEvent`→app safe logger；operations 侧不能照搬其缺失
幂等/日志的 v2 wrapper。

### 10.2 platform feature folders

| feature folder | v2 screen baseline | generated operations | foundation |
| --- | --- | --- | --- |
| `authentication` | PLATFORM-LOGIN/PASSWORD | platform login/session/password/logout | HTTP/observability/overlay |
| `workspace-management` | PLATFORM-WORKSPACES | list/detail/create/update/status/init, asset stage | list/detail/drawer/overlay |
| `platform-admin-governance` | PLATFORM-ADMIN-USERS | admin list/detail/create/profile/status/reset | list/detail/drawer |
| `organization-overview` | PLATFORM-ORGANIZATION-OVERVIEW | page/detail | list/detail |
| `contract-overview` | PLATFORM-CONTRACT-OVERVIEW | page/detail | list/detail |
| `role-management` | PLATFORM-ROLES | role list/create/update/status; no candidates endpoint | list/detail/drawer |
| `workspace-account-management` | PLATFORM-WORKSPACE-ACCOUNTS | account/invitation/candidates/revoke | list/detail/drawer |
| `extension-field-management` | PLATFORM-EXTENSION-FIELDS | catalog/detail/replace | list/detail/drawer |
| `workspace-overview` | PLATFORM-WORKSPACE-OVERVIEW | owner task-read | list/detail/context |

### 10.3 operations feature folders

| feature folder | baseline | generated operations | key adaptation |
| --- | --- | --- | --- |
| `authentication` | OPERATIONS-LOGIN | login entry/password/OTP/session | route key + owner session |
| `invitation` | INVITATION-ACCEPTANCE | 7 public operations | explicit state machine |
| `access-recovery` | ACCESS-RECOVERY | 3 reset operations | purpose grants |
| `session` | OPERATIONS-SHELL/PASSWORD | context/data-node/password/logout | complete mutation readback; no refetch |
| `organization-hierarchy` | ORG-STRUCTURE | hierarchy read + 4 commands | fixed tree |
| `business-entity-management` | BRAND/TENANT/HEAD-COMPANY | 16 entity ops + definition | correct terms |
| `store-management` | STORE-MANAGEMENT | list/create/candidates/definition/detail/update/status | owner task query |
| `contract-management` | CONTRACT-MANAGEMENT | `/contracts` 8 ops | item pair/three-state |
| `user-management` | FIVE-USER-PAGES | membership/invitations/revoke | no direct add/edit |
| `store-profile` | STORE-PROFILE | profile + contracts | read-only |
| home routes | five v2 bootstrap routes | no new operation | no new content |

所有 authenticated operations browser route 均以
`/operations/:groupWorkspaceKey/...` 开头；API 仍以 operation catalog 的
`/api/operations/group-workspaces/{groupWorkspaceKey}/...` 为准，二者不得互相改名。
generatedAdminCatalog/generatedPresentationCatalog/generatedProblemSemantics 与两个 generated
wire 文件均从 v2s source 重生成，禁止复制 v2 字节。每个 surface 的 required/forbidden 文案、
pageDesignKey 双向归属、七类 NOT_CARRIED 负向资产和 affected L2 名称均直接读取 manifest，
不得以“页面能渲染”代替。

### 10.4 state/recovery recipe

每个 list/detail/form：

```text
route/context args
-> generated query loading/success/typed error
-> name link opens detail Drawer
-> detail right-top action opens form/confirm
-> dirty guard + overlay lock
-> submit once with idempotency/CAS
-> owner readback
-> close overlay
-> success feedback + targeted cache update/invalidation
```

- CAS：保留安全草稿，展示 latest owner summary，用户明确决定重试；
- denied：不伪装空列表，保留当前位置并给恢复路径；
- unknown：GET owner detail/completion，不自动重发 command；
- context stale：关闭 overlay，清旧 context cache/tab state，使用新 owner readback；
- password/OTP/token 字段失败后清空敏感值。

## 11. focused test blueprint

### 11.1 backend

每个 owner至少：

- domain unit：不变量与 typed problem；
- repository Testcontainers：named constraints、composite FK、CAS、receipt/idempotency；
- application integration：事务顺序、跨模块公开 API、rollback；
- generated adapter test：wire mapping、face/security、Problem；
- query budget：list/detail默认≤3，owner command默认≤5，task join固定预算；
- security negative：wrong workspace/face/session/scope/capability/status；
- no `SELECT *`、per-row repository call、free `FOR UPDATE`。

### 11.2 frontend

每个 page至少：

- loading/empty/no-result/detail/submit/success；
- validation/denied/conflict/unknown/network；
- v2 static structure and approved terminology；
- real generated hook, no manual fetch；
- foundation primitive import；
- context switch late-response rejection；
- operation absent from wrong app generated target；
- browser L2 clicks actual control and reads owner result。

### 11.3 cross-module must-fail examples

1. platform session calls operations command；
2. direct assignment insert without invitation；
3. store references other workspace project/brand；
4. contract item has code without name；
5. derived contract status attempts to update store；
6. role page access implies capability；
7. workspace disabled login succeeds；
8. unknown extension value is silently deleted；
9. asset wrong usage/workspace is claimed；
10. old `workspaceKey`/`itemCodes`/organization contract route compiles。

## 12. seed stage blueprint

精确 fixture、stable key、count、credential reference、stage receipt、reset allowlist 和
business/cleanup predicate 见
`doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json`。该 JSON 是
`r5-full` 的规范性输入；本节只解释顺序，开发 agent 不得自行增删 fixture、改 key/count、
把 secret 写进 profile，或用手工数据补缺。

`r5-full` 分阶段，失败时可定位且不靠人工补数据：

| stage | channel | creates | readback |
| --- | --- | --- | --- |
| bootstrap | DEV-only allowlisted SQL | first platform identity only | platform-IAM owner query + audit receipt |
| platform | real platform commands | second admins, workspaces, asset logos, commercial groups | list/detail |
| extension | platform commands | five host definitions | definition detail/version |
| organization | operations owner commands | regions/projects/phases/entities/authorizations/stores | owner details |
| access | platform/operations invitation chain | roles/pages/actions, accounts, assignments, sessions | invitation completion + membership |
| contract | operations commands | current/future/invalid contracts and item pairs | detail + store three-state |
| negatives | commands or terminal fixture state | disabled/stale/denied/cancelled/expired cases | typed problem expectations |

dry-run 输出每 stage 的 planned count、依赖、command/DEV-only channel 和缺口；不写数据。
正式 seed 每 stage 写 receipt，重复执行要么按 stable fixture key 重放相同 readback，要么以
`SEED_PROFILE_DRIFT` 拒绝，禁止静默覆盖。

## 13. unit 进入/退出 checklist

每个 unit 开始前：

- 上游 operation/schema/generated hash 已固定；
- change-surface 不含未批准路径；
- owner/face/Journey 映射可读；
- current deviation 仍与仓内现实一致；
- focused test 名称和失败样例已确定。

每个 unit 结束前：

- 执行下表该 unit 的全部命令，任一非零立即停止；
- owner readback/evidence 与 cleanup 分账；
- 未实现项继续留在同一 R5 task，不生成局部 GO 或 handoff。

| unit | 必跑命令（从仓根） | 期望 |
| --- | --- | --- |
| U01 | `scripts/check/openapi-contracts`；`scripts/check/contract-face`；`scripts/check/edge-codegen`；`scripts/check/retirement` | `104=38+55+11`、placement 104/104、server/two clients、83/83+6/6 error disposition、NOT_CARRIED 零引用 |
| U02 | `gradle :apps:backend:catering-business-server:test --no-daemon`；`scripts/check/backend-boundaries`；`scripts/check/database-boundaries`；`scripts/check/flyway-layout` | assemble、R3→R5 upgrade 与 clean migration 同时 PASS，TDP 仍无 src |
| U03 | `gradle :libraries:backend:platform-iam:test --no-daemon` | platform IAM domain/repository/application/adapter focused PASS |
| U04 | `gradle :libraries:backend:platform-workspace:test :libraries:backend:platform-asset:test --no-daemon` | workspace/asset owner transaction、R3 compatibility 与 public content PASS |
| U05 | `gradle :libraries:backend:organization:test --no-daemon` | hierarchy/entity/store/extension value、可选 head-company 与候选谓词 PASS |
| U06 | `gradle :libraries:backend:workspace-iam:test --no-daemon` | role two-set atomic replace、invitation-only assignment、session/context/OTP PASS |
| U07 | `gradle :libraries:backend:contract:test --no-daemon` | item unique、date/phase snapshot、disabled-store candidate 与三态 PASS |
| U08 | `npm --prefix apps/frontend/platform-admin test`；`npm --prefix apps/frontend/platform-admin run build` | 10 platform surfaces、required/forbidden text、generated platform slice PASS |
| U09 | `npm --prefix apps/frontend/operations-admin test`；`npm --prefix apps/frontend/operations-admin run build` | auth/public/shell/password、keyed routes、context/session PASS |
| U10 | `npm --prefix apps/frontend/operations-admin test`；`npm --prefix apps/frontend/operations-admin run build`；`scripts/check/frontend-architecture`；`scripts/check/affected-l2` | 11 operations/public surfaces+home bootstrap、七类负向资产零引用、affected L2 精确选择 |
| U11 | `scripts/dev/check`；`scripts/dev/seed --profile r5-full --dry-run`；经显式 destructive authorization 后才可运行 `scripts/dev/reset` 与正式 seed | remote preflight、planned count、fixed clock/OTP profile guards、business/cleanup ledger 可判；本设计本身不授权运行 |
| U12 | `scripts/check/standards-coverage --phase R5`；`scripts/verify` | 分钟级单入口全 PASS，L1/L2/L3/business/cleanup 五账索引闭合 |

命令尚不存在或参数与本表不符时，责任属于相应 unit：先按已接受设计建立/校正能力命名入口；
禁止跳过、用邻仓命令或手写“PASS”替代。表中的 U11 破坏性命令仍受单独运行授权约束。

## 14. 禁止伪修复

下列任一行为都不能把失败变成通过：

1. 删除、弱化或改写断言、expected count、owner readback、error set、surface/operation 分母；
2. 使用 `@Disabled`、skip/only、空测试、永真 stub、mock owner readback 或 fake generated client；
3. 修改 gate/checker/fixture 让当前错误字节被接受，或把可执行规则重标为人工 checklist；
4. 手写未执行的 evidence、复制 v2 evidence、复用旧 run id，或把 L1 冒充 L2/L3；
5. 为过测试新增 alias、双字段、runtime/build fallback、默认/root、fixed OTP 非 DEV 通道；
6. 用清空现有数据库替代 R3→R5 migration，或用前端补偿/轮询掩盖 owner 一致性；
7. 把业务失败记 cleanup PASS，或把 cleanup 失败隐藏在业务 PASS 后。
8. 在 `app` 根新增业务 controller/page/form/table，或让 controller 直接读取 cookie/servlet API、
   JDBC/repository；必须经 capability-scoped edge resolver 和 owner public API。
9. 在 feature/app 手写 fetch、客户端生成业务时间，或用自由文本编辑 page/action closed-set；必须
   使用 per-face generated facade、foundation lifecycle idempotency 和 closed-set selector。
10. 一个控制不得以 `PENDING` 状态跨越它所守卫的工作：控制要么在该工作前已完成真实 red
    mutation 验证，要么该工作等待；不得以“后续 step 再激活”绕过控制。

若 agent 证明既有 gate、catalog 或设计本身错误，唯一动作是保留首败日志与反例、停止该 unit，
回到 owning design 做显式修订；不得在源码中绕过。该规则不新增 checker，但每个 unit evidence
必须声明 `pseudoFixAudit=PASS` 并列出本 unit 触及的测试/gate/evidence 文件。
