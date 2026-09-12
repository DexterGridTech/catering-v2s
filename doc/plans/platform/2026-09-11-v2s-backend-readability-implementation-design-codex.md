SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# 后端 owner 服务职责分离 · implementation-facing 详设

## 0. 元数据、输入与授权边界

```text
PROGRAM_ID=V2S_W0_W4_EXECUTION
BUSINESS_SOURCE=doc/plans/platform/2026-09-11-v2s-backend-readability-requirements-claude.md
RULE_SOURCE=doc/platform/backend-coding-standard.md
ARCHITECTURE_SOURCE=doc/platform/foundation-charter.md
ACCEPTANCE_SOURCE=doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md
OBSERVABILITY_SOURCE=doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md
REVIEW_GOVERNANCE_SOURCE=doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md
TER_REFERENCE_SOURCE=doc/plans/platform/2026-09-07-v2s-terminal-readability-remediation-requirements-claude.md
JOURNEY_REFS=NOT_APPLICABLE_WITH_REASON（本批不改变用户 Journey、页面、HTTP operation 或业务语义）
IA_REF=NOT_APPLICABLE_WITH_REASON（无 UI、契约、候选或用户可见行为新增）
INTERACTION_REF=NOT_APPLICABLE_WITH_REASON（纯后端内部结构重构）
CURRENT_ACTION_AUTHORITY=仅详设与实施计划；本回合不授权生产代码或动态执行
IMPLEMENTATION_AUTHORITY_FOR_THIS_TURN=false
REVIEW_TARGET=DESIGN
INDEPENDENT_SUBAGENT_REVIEW=REQUIRED_AFTER_AUTHOR_DESIGN
```

本文只把当前源码读出的候选、边界与证明路径写成实施输入，不把静态事实升级为实施后 PASS。
当前回合只允许新增/修改本详设和配套实施计划；不得修改 Java、契约、generated、migration、测试、seed、脚本，
不得启动 DEV、reset、seed、backend acceptance、browser L2、UAT、部署或切流。

Roadmap 只提供程序授权记录，不能替代本次 Dexter 直接指派。实施者只有在 Dexter 另行授权实现后，才可按本文
实施计划进入 CP-1 以后；即使 Roadmap 存在全局写权限字段，也不扩大本回合边界。

本文行号是当前定位，不是稳定身份；实施时必须按符号、方法签名与当前字节重开。不得以旧的带 frontend 字样
的可读性需求、旧候选数字或历史 review 结论作为实现依据。

## 1. 第一性目标、范围与方案选择

### 1.1 要解决的问题

目标不是把代码平均切成很多文件，而是让一个 owner 的业务入口在职责上可定位：一类事务入口只进入一个
业务聚合；跨 owner 协调、组合读取和基础设施适配不被伪装成业务聚合。现有五个 owner service 把多个独立
命令族、锁/回执/读回路径和私有 helper 放在同一个文件，导致接手者必须先读完整文件才能判断一次修改会触及
哪些事实。

### 1.2 本批范围

纳入结构重构的当前五个 owner facade：

1. `CatalogOwnerService`；
2. `InventoryOwnerService`；
3. `SalesMenuOwnerService`；
4. `BusinessEntityService`；
5. `BusinessChannelOwnerService`。

`CatalogInventoryCoordinator` 明确留在跨 owner 协调边界，不拆进 Catalog 或 Inventory 聚合。其余候选逐个在 §3
登记为单聚合、组合 task-read、adapter 或 receipt/audit 支持对象；没有以行数小为排除理由。

本批不做：全量 SQL 迁移、数据库变更、HTTP/contract/generated 变更、前端、L2 spec、测试文件切分、新框架/基类、
统一格式化/import/命名扫除、增量机器门、baseline、豁免清单、hash-chain 或其他退役 compliance-control 资产。

### 1.3 三个方案比较

| 方案 | 做法 | 判定 |
| --- | --- | --- |
| A · 只按文件搬运 | 把方法分到几个文件，但保留跨聚合事务、原 facade 逻辑与隐式 helper 依赖 | 拒绝；文件位置变化不能证明职责与事务边界清楚 |
| B · 删除原 owner 类型、让所有调用方改注入 | 新类直接实现 owner API，边缘 controller、其他 owner、测试全部改成新注入点 | 拒绝；不必要地扩大调用面，并增加 advice/嵌套类型断裂风险 |
| C · 原 owner 保留为非事务 facade，新建包内具体 owner service，按实际事务族移动方法及其私有 helper | API/FQCN/异常保持，目标类保留原事务注解和内部事务模板，跨 owner 只继续调用既有公开 API | 采用；改动面可控且能直接证明七条不变量 |

方案 C 中的 facade 不是废弃方案的兼容层，而是 §4.7 要求的现有 owner API 与调用解析边界。它不能拥有业务实现、
不能再保留跨聚合 `@Transactional` public 入口，也不能成为新的万能 service。

## 2. 当前事实基线与测量口径

### 2.1 候选全集

候选源集由当前字节直接取得，不使用旧文档数字：

```bash
find apps/backend/catering-business-server/modules -type f \
  \( -path '*/src/main/java/*/application/*Service.java' \
     -o -path '*/src/main/java/*/application/*Coordinator.java' \) | sort
```

该命令当前返回 62 个文件。`.runtime/browser-l2/l2-source-byte-binding-focused/repository-byte-binding.json` 的
`scope=apps-backend-and-apps-frontend-input-files-excluding-managed-runtime-and-build-output`，只可作为排除构建产物的
辅助清单，不能代替上述当前源枚举，也不能成为本批的事实分母。

需求中的 `CatalogOwnerService` 14,229 行按其采用的逻辑 split 口径保留为背景事实；本文不再把 SQL 行、方法数、
事务注解数或 helper 扇入的旧测量写成范围门。实施前若这些值影响具体移动，必须从当前 AST/源码重新测量并把结果
写在对应 CP 的 focused proof 中。

### 2.2 结构判定规则

对每个候选按以下顺序判断：

1. 先找实际 `@Transactional` public entry 及其调用的命令/读取族；不能只看类名或文件名。
2. 若是跨 owner 事务协调、组合 task-read 或外部/基础设施 adapter，按 §3.1 排除，并明确它不拥有哪个业务事实。
3. 否则用 owner 持有的聚合根、CAS/锁目标、回执键和 readback 目标确定事务族。一个事务族的判断必须由
   “同一命令事实、同一 CAS/锁目标、同一 owner readback”三项共同支持；不能按行数、方法数或表名数量替代。
4. 一个新具体 service 只能保留一个事务族。纯查询可进入同一具体 service，也可以进入 task-read service；不得让
   查询位置反向决定写聚合。仅按 operation-id 做闭集协议分派的 router 是 §3.1 adapter 边界，不能在其中保留
   owner JDBC/业务写逻辑；其外层事务只为保持现有协议边界，具体事实仍由目标 bean 负责。
5. 如一个方法同时写两个 owner，不能硬塞进其中一个新 service；应归还现有 coordinator 或向 Dexter 提交证据、
   成本与收益，由 Dexter 决定是否改变范围。

### 2.3 实施时必须保持的通用形态

- 原五个 facade 继续实现原公开 API；facade public command/read 方法只做参数转发，不带 `@Transactional`，不直接读写
  JDBC，不再次复制业务校验。当前源码中的两个公开纯静态 query-validator（`CatalogOwnerService.validateItemPageQuery`
  与 `InventoryOwnerService.validateTargetPageQuery`）是兼容性入口，保持原 FQCN，只转发到同一纯值校验实现；它们
  不持有 owner 事实、状态、事务或 JDBC，作为 §7.2 的显式例外，不算 facade 业务实现。
- 具体 service 通过 Spring bean-to-bean 调用承接事务代理；同一 service 内部的纯 private implementation 不依赖
  self-invocation 才能获得事务。CP-0 的事务与持久化矩阵必须额外记录每个将移动方法族是否被同类其它事务方法
  自调用；若存在，记录自调用点、外层入口的完整 transaction attributes，以及拆分后该调用是依赖已有外层事务
  汇入还是必须改成 bean-to-bean 调用。仅记录“有/无自调用”不能关闭该风险。
- 每个被移动的入口保留原 `@Transactional` 参数、传播、`readOnly`、`noRollbackFor` 等完整属性。Catalog 的
  `TransactionTemplate.PROPAGATION_REQUIRES_NEW` 逐项批量状态路径也必须原样保留。
- 不改变 SQL 的语义、锁取得顺序、回执 canonical request、receipt first-use、CAS、审计、异常对象、读回时机。
- 允许搬运已有 private helper；只有其所有调用者属于同一目标族时才随族移动。跨族 helper 必须先按 §5.3 的纯度和
  扇入规则判定：纯函数可以放入最小 package-private facts/support；含 JDBC、锁、回执、owner command 或事务语义的
  helper 不能做共享万能层，必须由其真实事实 owner 持有。无法确定时停在当前 CP，不自行选“看起来合理”的归属。

## 3. 62 个候选的逐个判定

以下表是当前字节的候选清单。`SPLIT` 表示纳入本批五个目标；其余均保留原文件，不以“文件较小”为理由。
路径均为仓根相对路径；`§3.1` 是需求明确允许不套用单聚合判据的三类边界。

| # | 当前类（仓根相对路径） | 判定 | 事务/职责边界与排除理由 |
| ---: | --- | --- | --- |
| 1 | `apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/application/PlatformAssetService.java` | KEEP_SINGLE_AGGREGATE | 源码 Javadoc 将其定义为 public static asset/video owner；多个 API 是同一 asset fact、stage/claim/reference/lock 生命周期的不同 owner 面，不是外部 adapter。对象存储是其依赖，不改变本类的 asset 聚合归属。 |
| 2 | `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelCommandReceiptService.java` | KEEP_ADAPTER | command receipt 持久化支持，不拥有 BusinessChannel 事实；不是业务聚合入口（§3.1 adapter/support）。 |
| 3 | `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelOwnerService.java` | SPLIT | 模板/可见范围与渠道/绑定是两个命令族；模板事务与 channel 事务的 CAS/读回目标不同。详见 §4.5。 |
| 4 | `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java` | KEEP_COORDINATOR | 只协调 Catalog、Inventory、ProductionTag、Asset 等 owner command，Javadoc 已声明 task-join/同一 REQUIRED 事务；不拥有单一业务事实，按跨 owner coordinator 保留（§3.1）。 |
| 5 | `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java` | SPLIT | attribute/unit/option/category/dictionary/item/copy/reference 等命令族的锁、回执和 readback 不同。详见 §4.1。 |
| 6 | `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogTaskReadService.java` | KEEP_TASK_READ | 只把 Catalog owner read 转成 task-read，组合读取不构成 mutation 聚合（§3.1）。 |
| 7 | `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CollaborationCommandReceiptService.java` | KEEP_ADAPTER | Collaboration command receipt 支持，不拥有 external system/provider/binding 事实；保留既有 receipt 边界。 |
| 8 | `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CollaborationOwnerService.java` | KEEP_SINGLE_AGGREGATE | 各 mutation entry 分别落在 collaboration enablement/binding owner 的既有 owner 边界；本类没有需要跨该 owner 边界的事务族，组合 tree/provider 读取仍是同一 owner 的 read model。 |
| 9 | `apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/application/ExtensionAuditHistoryService.java` | KEEP_TASK_READ | audit history projection，只读历史，不拥有 extension definition mutation 聚合（§3.1 composition task-read）。 |
| 10 | `apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/application/ExtensionCommandReceiptService.java` | KEEP_ADAPTER | receipt first-use/回放支持，不是 extension definition 聚合的业务入口（§3.1 adapter/support）。 |
| 11 | `apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/application/ExtensionDefinitionService.java` | KEEP_SINGLE_AGGREGATE | 一份 extension definition 是整体读写、整体替换、CAS 的 Detail 聚合；多 host type 是字段事实，不是多 mutation 聚合。 |
| 12 | `apps/backend/catering-business-server/modules/fulfillment-production/src/main/java/com/catering/v2s/fulfillment/production/application/ProductionTagOwnerService.java` | KEEP_SINGLE_AGGREGATE | 所有 mutation entry 的根事实是 production tag definition；copy 是同一 owner 的复制命令，不把跨 owner 协作放入本类。 |
| 13 | `apps/backend/catering-business-server/modules/fulfillment-production/src/main/java/com/catering/v2s/fulfillment/production/application/ProductionTagTaskReadService.java` | KEEP_TASK_READ | ProductionTag task-read facade，不拥有 mutation 聚合（§3.1）。 |
| 14 | `apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java` | SPLIT | availability、target mutation、catalog lifecycle dependency、BOM 与 copy 是不同事务族。详见 §4.2。 |
| 15 | `apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryTaskReadService.java` | KEEP_TASK_READ | 组合 Inventory owner read，保留 task-read 位置。 |
| 16 | `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/BusinessEntityCommandReceiptService.java` | KEEP_ADAPTER | BusinessEntity receipt 支持及 replay/corrupt 处理，不拥有实体 mutation 聚合。 |
| 17 | `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/BusinessEntityService.java` | SPLIT | brand、tenant、head company、store 与通用实体/组织查询的入口族不同；公开异常/DTO FQCN 由 facade 保留。详见 §4.4。 |
| 18 | `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/CommercialGroupCommandReceiptService.java` | KEEP_ADAPTER | CommercialGroup receipt 支持，不拥有 commercial group mutation。 |
| 19 | `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OperationsOrganizationTaskReadService.java` | KEEP_TASK_READ | 组织运营页面的组合 task-read，直接消费 entity/hierarchy owner readback。 |
| 20 | `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationAssignmentCandidateService.java` | KEEP_TASK_READ | assignment/invitation candidate projection，不拥有组织实体 mutation。 |
| 21 | `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationAuditHistoryService.java` | KEEP_TASK_READ | 审计历史与 operations projection，只读历史事实。 |
| 22 | `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationCommandService.java` | KEEP_SINGLE_AGGREGATE | `CommercialGroupLookup` 与 commercial group update/initialize 共享 commercial group 根及同一 receipt/CAS 边界。 |
| 23 | `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationGroupWorkspaceInitializationTaskReadService.java` | KEEP_TASK_READ | 初始化事实 task-read，不拥有 commercial group mutation。 |
| 24 | `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationHierarchyCommandReceiptService.java` | KEEP_ADAPTER | hierarchy command receipt 支持，不拥有 organization node mutation。 |
| 25 | `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationHierarchyService.java` | KEEP_SINGLE_AGGREGATE | `REGION`/`PROJECT` 是 commercial group 下同一 organization hierarchy 根的节点事实；源码 Javadoc 已声明 logical root，mutation 不跨 BusinessEntity 聚合。 |
| 26 | `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationOverviewTaskReadService.java` | KEEP_TASK_READ | 平台/运营组织概览组合读取，不拥有组织实体 mutation。 |
| 27 | `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationTaskPathService.java` | KEEP_TASK_READ | task path、scope 与 command facts 查询/授权投影，不能为套用聚合判据拆入某个实体。 |
| 28 | `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationVisibilityService.java` | KEEP_TASK_READ | visibility/candidate/session scope read policy，不拥有实体 mutation。 |
| 29 | `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/StoreCandidateTaskReadService.java` | KEEP_TASK_READ | Store candidate task-read，组合 organization/contract/binding 事实。 |
| 30 | `apps/backend/catering-business-server/modules/platform-admin-iam/src/main/java/com/catering/v2s/platform/iam/application/PlatformAuthenticationService.java` | KEEP_SINGLE_AGGREGATE | platform credential/session owner；administrator、credential、session 与 rate-limit 是同一平台身份 admission 边界，本类 mutation 不调用另一个业务 owner。 |
| 31 | `apps/backend/catering-business-server/modules/platform-admin-iam/src/main/java/com/catering/v2s/platform/iam/application/PlatformCommandReceiptService.java` | KEEP_ADAPTER | platform IAM receipt 支持。 |
| 32 | `apps/backend/catering-business-server/modules/platform-admin-iam/src/main/java/com/catering/v2s/platform/iam/application/PlatformIamAuditHistoryService.java` | KEEP_TASK_READ | 平台 IAM audit projection。 |
| 33 | `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/application/SalesMenuOwnerService.java` | SPLIT | menu lifecycle、section、item、publication、manual sale 的事务入口族不同；详见 §4.3。 |
| 34 | `apps/backend/catering-business-server/modules/store-contract/src/main/java/com/catering/v2s/contract/application/ContractAuditHistoryService.java` | KEEP_TASK_READ | contract audit projection。 |
| 35 | `apps/backend/catering-business-server/modules/store-contract/src/main/java/com/catering/v2s/contract/application/ContractCommandReceiptService.java` | KEEP_ADAPTER | contract command receipt 支持。 |
| 36 | `apps/backend/catering-business-server/modules/store-contract/src/main/java/com/catering/v2s/contract/application/ContractCommandService.java` | KEEP_SINGLE_AGGREGATE | StoreContract create/update/invalidate 与 contract readback/CAS 属同一 contract 聚合。 |
| 37 | `apps/backend/catering-business-server/modules/store-contract/src/main/java/com/catering/v2s/contract/application/ContractTaskReadService.java` | KEEP_TASK_READ | contract candidate、derived status、页面 list/detail 是组合 task-read。 |
| 38 | `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/PlatformInvitationCandidatesTaskReadService.java` | KEEP_TASK_READ | invitation candidate task-read。 |
| 39 | `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/PlatformWorkspaceAccountTaskReadService.java` | KEEP_TASK_READ | account page/detail 与 command 后 readback 的 task facade；mutation 仍只触及 account 聚合，不需本批拆。 |
| 40 | `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/PlatformWorkspaceInvitationTaskReadService.java` | KEEP_TASK_READ | platform invitation task-read。 |
| 41 | `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceAccountService.java` | KEEP_SINGLE_AGGREGATE | account status/assignment revoke 的 owner CAS 与 readback 在同一 workspace account/assignment admission 边界。 |
| 42 | `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceAssignmentScopeService.java` | KEEP_TASK_READ | scope lookup/authorization read。 |
| 43 | `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceAuditAuthorizationService.java` | KEEP_TASK_READ | 审计授权的 scope read policy。 |
| 44 | `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceAuthenticationService.java` | KEEP_SINGLE_AGGREGATE | workspace credential/session authentication owner，登录、OTP、context/session entry 属同一身份会话边界。 |
| 45 | `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceCommandAuthorizationService.java` | KEEP_TASK_READ | command authorization/capability read policy。 |
| 46 | `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceIamAuditHistoryService.java` | KEEP_TASK_READ | workspace IAM audit projection。 |
| 47 | `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceIamCommandReceiptService.java` | KEEP_ADAPTER | workspace IAM receipt 支持。 |
| 48 | `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceIamSummaryReadService.java` | KEEP_TASK_READ | account/role summary read。 |
| 49 | `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceInvitationService.java` | KEEP_SINGLE_AGGREGATE | invitation lifecycle、public acceptance 与 invitation assignment facts 属同一 invitation 聚合；account/role 调用是既有 owner command 依赖，不在本类写入。 |
| 50 | `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceLoginRateLimitService.java` | KEEP_ADAPTER | 无事务 public business entry，纯 rate-limit support。 |
| 51 | `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceOperationsCommandService.java` | KEEP_COORDINATOR | owner-native operations command 在同一 REQUIRED 边界内协调 invitation、account 与 user task-path；不拥有单一被写入事实，不得为套用判据拆入 invitation 或 account（§3.1 cross-owner coordinator）。 |
| 52 | `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceOtpRateLimitService.java` | KEEP_ADAPTER | 无事务 public business entry，OTP rate-limit support。 |
| 53 | `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspacePasswordRecoveryService.java` | KEEP_SINGLE_AGGREGATE | password recovery flow/OTP completion 是同一 recovery flow aggregate。 |
| 54 | `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspacePasswordResetService.java` | KEEP_SINGLE_AGGREGATE | platform password reset request 的单一 reset flow。 |
| 55 | `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceRoleService.java` | KEEP_SINGLE_AGGREGATE | role、permissions、status、platform task readback 共享 role CAS/owner boundary。 |
| 56 | `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceTaskReadService.java` | KEEP_TASK_READ | workspace IAM task-read 组合入口。 |
| 57 | `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceUserService.java` | KEEP_TASK_READ | user/account/invitation candidate与 scope read 的组合 owner task-read。 |
| 58 | `apps/backend/catering-business-server/modules/workspace/src/main/java/com/catering/v2s/platform/workspace/application/PlatformWorkspaceAdministrationTaskReadService.java` | KEEP_TASK_READ | platform workspace admin task-read。 |
| 59 | `apps/backend/catering-business-server/modules/workspace/src/main/java/com/catering/v2s/platform/workspace/application/PlatformWorkspaceAuditHistoryService.java` | KEEP_TASK_READ | platform workspace audit projection。 |
| 60 | `apps/backend/catering-business-server/modules/workspace/src/main/java/com/catering/v2s/platform/workspace/application/PlatformWorkspaceService.java` | KEEP_SINGLE_AGGREGATE | group workspace list/detail/initialize 的 workspace owner boundary。 |
| 61 | `apps/backend/catering-business-server/modules/workspace/src/main/java/com/catering/v2s/platform/workspace/application/WorkspaceAdministrationService.java` | KEEP_SINGLE_AGGREGATE | workspace administration status/display/account-role summary 属 workspace administration owner read/write boundary。 |
| 62 | `apps/backend/catering-business-server/modules/workspace/src/main/java/com/catering/v2s/platform/workspace/application/WorkspaceCommandReceiptService.java` | KEEP_ADAPTER | workspace administration receipt 支持。 |

其中 #51 的 `WorkspaceOperationsCommandService` 虽然类名不是 `Coordinator`，但当前 Javadoc、依赖和四个 public
command 的行为都表明它是 owner-native 的跨 owner operations coordinator：它在 REQUIRED 边界内读取 task path，调用
invitation/account owner command，并在 revoke 后读取 user detail；它不拥有被写入的单一 invitation/account 事实。
该判断不是行数豁免。若实施前源码显示它实际直接拥有独立事实或跨 owner write 需要新的事务协议，必须在 CP-0 重新提交
候选判定给 Dexter，不能静默并入五个目标之外的拆分。

## 4. 五个目标的产物边界

### 4.1 Catalog

原 `CatalogOwnerService` 保留 `CatalogOwnerApi` 与 `CatalogTemporaryPromotionOwner` facade。新具体 service 只使用
现有 API/domain 类型和当前已有 facts 类，不引入 repository abstraction 或 base class。

| 目标类（建议名） | 聚合/职责 | 移动的入口族与当前锚点 |
| --- | --- | --- |
| `CatalogCommandRouter` | operation-id 到单一 Catalog 命令族的协议适配/闭集分派；不拥有业务事实 | `write(...)`（839–852）以及当前 `executeWrite(...)` 的 operation 分派。router 不直接读写 JDBC；当前 `write` 的外层 `@Transactional` 传播属性保留在该协议边界，真正的业务分支由目标 bean 承接。它按 §3.1 adapter 边界记录，不冒充聚合 service。 |
| `CatalogAttributeDefinitionService` | 属性定义聚合 | `listAttributeDefinitions/createAttributeDefinition/updateAttributeDefinition/transitionAttributeDefinitionStatus`（675–711）。 |
| `CatalogUnitDefinitionService` | 计量单位定义聚合 | `listUnitDefinitions/createUnitDefinition/updateUnitDefinition/transitionUnitStatus`（715–771）。 |
| `CatalogOrderOptionDefinitionService` | 订单选项定义聚合 | `listOrderOptionDefinitions/createOrderOptionDefinition/updateOrderOptionDefinition/transitionOrderOptionDefinitionStatus`（774–811）。 |
| `CatalogCategoryService` | Catalog category hierarchy | `createCategory/updateCategory/moveCategory/transitionCategoryStatus`（854–932）；move 的 hierarchy lock、CAS 与 readback 同族移动。`readCategoryCandidates` 是 workbench task-read，归 §4.1 的 `CatalogWorkbenchReadService`。 |
| `CatalogDictionaryService` | 字典与 dictionary entry 顺序/状态 | `readDictionary`（814–819）与 `createDictionaryEntry/updateDictionaryEntry/reorderDictionaryEntries/transitionDictionaryEntry`（937–1018）。 |
| `CatalogItemService` | catalog item、SKU、商品引用、item 状态与临时转正 | `readItem/readItemSkus`（662–672）、`createCatalogItem/transitionCatalogItemStatus/transitionCatalogItemStatuses`（1021–1108）、`resolveCatalogItemRef/catalogItemReferencedByOtherItems/saveCatalogItem`（1617–1663）、临时转正三入口（1666–1764）、item/asset/production-tag reference read（3748–3860、3921–3963）。批量状态路径的 receipt transaction、锁定后的逐 item `REQUIRES_NEW`、失败项转换与 readback 必须整体移动。 |
| `CatalogCopyService` | Catalog copy candidates、preflight/prepare/execute task | `readLocalCopyCandidates/readBrandCopyCandidates/readShapeManifest`（821–833）与 generic/local/brand copy 入口族（2368–2618），以及其 canonical request、preflight digest、compatibility disposition、replay 与 target readback helper。该 task 只写 Catalog owner facts；跨 Catalog/Inventory 的协调仍调用 `CatalogInventoryCoordinator`，不能在本类新增 owner write。 |
| `CatalogWorkbenchReadService` | workbench 与跨事实 task-read 投影；不拥有 mutation | `readWorkbenchContext/readNavigation/readItems/readCategoryCandidates/readInventoryDisplayFacts/readInventoryTargetDisplayFact/readSalesMenuCandidatePage/readSalesMenuItemFacts/readSalesMenuItemReferenceFacts`（151–351）。已有 `CatalogTaskReadService` 仍保持 task-read API；不得由该 wrapper 反向调用 facade 形成环。 |
| `CatalogOwnerService` facade read forwarding（不新增类） | owner-read 的 API 转发；不拥有事实 | facade 将 `readItem/readItemSkus` 转给 `CatalogItemService`，`readDictionary` 转给 `CatalogDictionaryService`，`readLocalCopyCandidates/readBrandCopyCandidates/readShapeManifest` 转给 `CatalogCopyService`，其余 workbench read 转给 `CatalogWorkbenchReadService`。`validateItemPageQuery` 保留为纯静态兼容入口，不复制 owner 事实。 |

三个 definition 家族在详设中固定为三个具体 service。它们虽然共用 Catalog owner 的 JDBC 依赖，但入口、事实类型、状态/CAS
与 readback 由各自 API 家族表达；共用的纯值转换才可留在最小 package-private facts/support。不得为了少建文件把三类
definition 再合并成一个新的通用 definition service，也不得让其中一个 service 直接持有另一个 definition 的写入逻辑。

### 4.2 Inventory

| 目标类（建议名） | 聚合/职责 | 移动的入口族与当前锚点 |
| --- | --- | --- |
| `InventoryAvailabilityService` | 面向 SalesMenu 的库存可售事实读取 | `readSalesMenuAvailability`（77–95）及其只读 SQL/map helper。不得在此写 SalesMenu。 |
| `InventoryReadRouter` | inventory operation-id 只读闭集协议适配；不拥有 mutation | `read(...)`（162–198）及当前 operation switch。各具体 read target 保持原 scope/type 校验和 readback；当前 generic `read` 的 `@Transactional` 外层传播属性保留在 router，router 不直接复制 JDBC。 |
| `InventoryTargetService` | inventory target ledger/configuration read/write | `readTargets/readTarget/readTargetChangeSummary/readTargetBusinessHistory/readTargetConsumptionReferences/readTargetLedger/readTargetDiagnostics`（96–160）与 `countTarget/increaseTarget/adjustTarget/updateTargetConfiguration`（240–404）；operation-id `read/write(...)` 只由 router 分派，锁/CAS/readback helpers 随该 target 族移动。 |
| `InventoryCommandRouter` | inventory operation-id 写入协议适配/闭集分派；不直接拥有 target/BOM 事实 | 两个 `write(...)` overload（200–239）及当前 `writeCore(...)` 的 operation 分派。当前 generic `write` 的外层事务传播属性保留在 router；router 只验证 scope、选择目标 bean，各 mutation target 保留原事务属性。 |
| `InventoryCatalogLifecycleService` | Catalog item/SKU void dependency、reference 与 inventory retirement | `validateCatalogUnitLifecycle/validateCatalogItemBaseMeasureUnitTransition`（405–485）、Catalog void dependency/reference/retirement 族（2029–2200、2374–2383）。它读取 Catalog 公开 owner API/任务 facts，不绕过 owner 写入。 |
| `InventoryBomService` | Catalog inventory target、BOM、material stock target 与 option-value BOM | `readCatalogInventoryDefinition`、inventory summary/candidate、`ensureCatalogInventoryTarget`（1838、2714–2890）、`saveCatalogProductBom/ensureCatalogItemSaveTarget/saveCatalogItemProductBom/replaceCatalogInventoryRules/resolveCatalogMaterialStockTarget(s)/deleteCatalogOptionValueBoms/copyCatalogOptionValueBoms`（2922–3200）。 |
| `InventoryCopyService` | Inventory copy preflight/prepare/execute | generic/local/brand copy 族（920–1494），保持 copy receipt、preflight digest、CAS 与 replay。 |
| `InventoryOwnerService` facade read forwarding（不新增类） | owner-read 的 API 转发；不拥有事实 | `readTargets/readTarget/readTargetChangeSummary/readTargetBusinessHistory/readTargetConsumptionReferences/readTargetLedger/readTargetDiagnostics/readCatalogInventoryDefinition` 等 owner read 分别转发到对应 target。`validateTargetPageQuery` 保留为纯静态兼容入口，不复制 owner 事实。已有 `InventoryTaskReadService` 仍保持 task-read API；不得与 facade 互相回调。 |

`InventoryCatalogLifecycleService` 与 `InventoryBomService` 的交界以写入事实为准：前者只做 lifecycle dependency
判断与 retirement，后者才负责 BOM/target 关系行。任何同时改变两者事实的入口必须回到现有协调器或提交停机证据，
不得通过共享 `JdbcTemplate` 私有 helper 隐藏跨聚合写。

### 4.3 SalesMenu

| 目标类（建议名） | 聚合/职责 | 移动的入口族与当前锚点 |
| --- | --- | --- |
| `SalesMenuDefinitionService` | menu collection 生命周期、激活与 schedule | `listMenus/readMenu`（146–249）、`create/copy/rename/archive/setActivation/updateSchedule`（461–613）。 |
| `SalesMenuSectionService` | menu section hierarchy/order | `listDraftSections/listPublishedSections`（252、294）与 `createSection/renameSection/deleteSection/moveSection`（614–696）。 |
| `SalesMenuItemService` | menu item 选择、SKU/option selection、item readback | `listDraftItems/readDraftItem/listPublishedItems/readPublishedItem/listItemCandidates`（257–381）、`addItems/updateItem/deleteItem/moveItem/requireSalesMenuItemAssetTarget`（697–930）。 |
| `SalesMenuPublicationService` | draft→published snapshot、publication validation/preview | `publicationPreview`（384–391）、`publish`（932–1000）及只服务 publication 的 stale child cleanup。published snapshot、immutable facts、publication blockers 与 readback 必须同族。 |
| `SalesMenuManualSaleService` | ITEM/SKU/ORDER_OPTION_VALUE 人工销售状态 | `setManualSoldOut/restoreManualSale`（1014–1091）及 manual status projection、publication 后 stale child 清理中真正属于该事实的 helper。库存自动可售事实仍由 Inventory API 读取，不与人工状态合并。 |
| `SalesMenuOperationRecordService` | operation record 写入与只读 projection | `recordRejectedOperation`（1093–1131）与 `listOperationRecords`（394–458）。它只维护失败/操作记录事实，不把失败记录伪装成 manual-sale 状态。 |

原 facade 继续同时实现 `SalesMenuOwnerApi` 与 `SalesMenuCommandApi`，但不再承载任何 transaction annotation。`SalesMenuAssetCommandFacade`
仍是现有 asset adapter，不并入 SalesMenuItemService。

### 4.4 BusinessEntity

| 目标类（建议名） | 聚合/职责 | 移动的入口族与当前锚点 |
| --- | --- | --- |
| `BusinessBrandService` | brand lifecycle 与 brand readback | `createBrand/updateBrand/transitionBrandStatus`（89–107、229–243）及对应 generic dispatch。 |
| `BusinessTenantService` | tenant lifecycle | `createTenant/updateTenant/transitionTenantStatus`（129–166、244–258）及对应 generic dispatch。 |
| `HeadCompanyService` | head company lifecycle 与 brand authorization | `createHeadCompany/updateHeadCompany/transitionHeadCompanyStatus/addHeadCompanyBrandAuthorization/removeHeadCompanyBrandAuthorization`（169–297、259–296、1815–1925）。 |
| `StoreService` | store lifecycle、store-specific command facts | `createStore/updateStore/transitionStoreStatus`（299–383、1401–1814）及 store update facts。 |
| `BusinessEntityCommandRouter` | generic entity create/update/status command 的闭集分派；不拥有事实、无事务 public entry | `createEntity/updateEntity/transitionEntityStatus` 的 generic overload（795–1400）；根据 entity type 只调用四个具体 owner bean 的公开 command。 |
| `BusinessEntityTaskReadService` | entity list/page、path、scope、SalesMenu/Contract/Catalog lookup | `authorizedBrands*`、`isEnterable*`、`requireSalesMenuStore`、`resolveCatalogBrand`、copy source、`requireEntity/require*Id`、`listEntities/page*`、`requireBusinessEntity/requireEntities`（1928–2748）。这些 readback/资格判断不直接变成 write。 |

`BusinessEntityService` facade 保留当前公开嵌套异常和公开 DTO/record 的完全限定名。特别是
`ContractProblemAdvice` 对 `BusinessEntityService.OrganizationNotFoundException`、conflict、validation、authorization
异常的直接映射保持原样；具体 service 抛出的异常必须仍是这些类型，不能以同名新异常替代。

### 4.5 BusinessChannel

| 目标类（建议名） | 聚合/职责 | 移动的入口族与当前锚点 |
| --- | --- | --- |
| `BusinessChannelTemplateService` | project/store template、scope、visible-store relation | `pageTemplates/pageStoreTemplateCandidates/pageTemplateVisibleStores/readTemplate/readTemplateCommandContext`（135–285、524–559）、`createTemplate/updateTemplate/transitionTemplateStatus`（633–920）。可见门店整体替换、VOIDED ref 保存语义、CAS 与审计随模板族。 |
| `BusinessChannelService` | store/project channel lifecycle、binding 状态与 channel readback | `pageChannels/readChannel/readChannelCommandContext/createChannel/updateChannel/transitionChannelStatus/detachChannelBinding`（460–632、921–1268）。 |
| `BusinessChannelTaskReadService` | composed channel+template+provider read and binding/sales-menu projections | `readChannelWithTemplateProvider`（594–615）、`findChannelsForBinding`（616–632）以及 `listSalesMenuEligibleChannels/requireSalesMenuChannel/salesMenuChannelBelongsToStore`（355–458）。这些是组合 read/资格判断，不在模板或 channel mutation service 中复制写逻辑。 |

原 `BusinessChannelOwnerService` 保留 owner API facade。候选查询必须继续使用既有 owner/service boundary；新具体类不能改变
provider catalog、store visibility 或 SalesMenu eligibility 语义。

## 5. facade、调用方与 Spring 边界

### 5.1 public surface 的保留策略

采用“原类型保留、逻辑下沉”的单一形态：

- `CatalogOwnerService` 保留 `CatalogOwnerApi`、`CatalogTemporaryPromotionOwner`；
  `InventoryOwnerService` 保留 `InventoryOwnerApi`；
  `SalesMenuOwnerService` 保留 `SalesMenuOwnerApi`、`SalesMenuCommandApi`；
  `BusinessEntityService` 保留所有当前公开嵌套异常/DTO；
  `BusinessChannelOwnerService` 保留现有 owner APIs。
- facade 的现有构造器只保留为 owner/test construction boundary；生产构造器新增具体 service 依赖时，必须继续支持
  当前测试所用的 JdbcTemplate/mapper/time 等 test-only 构造方式，不把生产必需授权降级为 optional。
- facade public forwarding method 不再标 `@Transactional`。目标 bean 的对应 method 带原注解，从 facade 到目标 bean 的调用
  必须是 Spring 注入的 bean-to-bean 调用；测试直接 new 时，事务代理本来就不存在，仍按现有测试方式使用真实事务 fixture。
- 不删除任何当前 public owner API、generated wire 类型、edge operation 或 controller 方法；本批不修改 `contracts/`、
  `generated/` 与 HTTP 资源路径。

### 5.2 调用方矩阵

| 调用方类别 | 当前事实 | 处理 |
| --- | --- | --- |
| edge controller / operation handler | Catalog/Inventory/SalesMenu/BusinessChannel 主要通过 `*OwnerApi`；`CatalogInventoryCoordinator` 在 catalog operation 中作为明确跨 owner coordinator，通过 `CatalogOwnerApi` 调用 definition、save、copy 等 owner 命令，并通过 `CatalogTemporaryPromotionOwner` 调用 temporary-promotion projection owner 命令；BusinessEntity 多处直接注入具体 `BusinessEntityService` | 保留 facade 类型或接口，调用方不改业务调用；只验证 Spring 注入仍唯一、没有歧义 bean。 |
| 其他 owner | `InventoryOwnerService` 与 Catalog/Coordinator 有跨 owner API 依赖；SalesMenu 通过 Catalog/Inventory/Channel/Organization API | 继续调用公开 owner API，不从新具体类读取内部 JDBC；cross-owner write 继续调用 target public command 并加入原 REQUIRED 事务。 |
| `ContractProblemAdvice` | 直接按 BusinessEntity facade 的公开嵌套异常注册 handler | facade 保留异常 FQCN；加 advice mapping focused compile/behavior proof。 |
| 生产直接 concrete `BusinessEntityService` consumer | `Operations*Controller`、organization task-read、contract/catalog task-read 与 receipt support 等当前源码存在直接引用 | 不改这些注入点；facade 仍是唯一该类型 Spring bean。 |
| test 直接构造 owner service | Catalog/Inventory/SalesMenu/BusinessEntity/BusinessChannel 多个 application test 直接 new concrete owner | 不切分测试文件；在原测试文件保留 owner facade fixture factory，补目标 bean 构造参数或使用 package-private delegate constructor。 |
| Spring configuration | 当前这些类以 `@Service` 扫描，未发现需要手写 bean alias 的 owning source | 新具体类使用同包、明确职责的 `@Service`；不新增 qualifier/扫描旁路。若出现 bean ambiguity，停在 CP 并修复注入形态，不能以 primary/fallback 隐藏。 |

### 5.3 跨 owner 与事务

| 规则 | 实施要求 | 证明 |
| --- | --- | --- |
| 外部 caller → owner | 只依赖既有公开 API/interface | 全仓 Java compile + edge/owner focused tests |
| owner → owner write | 目标 owner command API，原 REQUIRED 事务与原调用顺序不变 | CatalogInventoryCoordinator tests、full acceptance BUSINESS/readback |
| facade → target | Spring bean-to-bean；target 保留原注解 | application context/transaction topology focused proof |
| target 内 helper | private helper 只能被同一事务族共享；跨族纯 helper 才可 package-private facts | method-family review 与 targeted tests |
| 外部网络/资产 | 不新增；现有 adapter 依赖不进入事务 facade | static import review；全批无新增外部 I/O |

## 6. 七条不变量的证明矩阵

| # | 不变量 | 实施前证据 | 实施后证据 | 失败判定 |
| ---: | --- | --- | --- | --- |
| 1 | HTTP contract/error code 不变 | 当前 edge route、wire mapper、owner API 与 contract/generated 读取；记录不修改集合 | Java compile、edge contract tests、完整 backend acceptance `CONTRACT` 全绿；contracts/generated 无变更 | 任一路由、字段、错误码或序列化行为变化；不能用只看 HTTP status 替代。 |
| 2 | 公开异常仍由 advice 解析 | `ContractProblemAdvice` 直接映射 BusinessEntity 公开嵌套异常（当前源码 244–378、587–592 区间） | 同 FQCN 保留；`ContractProblemAdviceTypedOwnerMappingTest` 与组织/合同负向场景 `BUSINESS` 全绿 | advice 无法解析、异常被新类型替换或错误码/状态变为 generic。 |
| 3 | transaction propagation/readOnly/noRollback 与 `REQUIRES_NEW` 不变 | 逐入口记录 annotation 完整值；Catalog 批量状态记录 receipt tx、逐 item `TransactionTemplate` | transaction topology focused tests；Catalog batch 正常/部分失败/未知异常场景；full acceptance BUSINESS | facade 仍含跨族 tx、target 丢属性、批量失败污染兄弟项、未知异常被吞。 |
| 4 | idempotency/receipt boundary 不变 | 逐入口记录 operation id、canonical request、receipt read/write 与 replay 分支 | `CatalogReceiptFirstUseConcurrencyIntegrationTest`、`InventoryReceiptFirstUseConcurrencyIntegrationTest`、copy replay/owner acceptance；同 key replay 与 conflict 业务 readback | replay 读错 owner、canonical key 变化、first-use race 重复写、conflict 被当 replay。 |
| 5 | lock order 不变 | 逐方法族记录 lock helper、SQL `FOR UPDATE`/advisory lock 与跨 owner 调用次序 | catalog/inventory/sales-menu/channel concurrency/lock focused tests；full BUSINESS 读回 | 新 service 为了共享 helper 重排锁、target bean 额外取锁、deadlock/lock timeout 或 read-before-lock。 |
| 6 | owner readback timing 不变 | 方法族矩阵记录写入前复核、写入后 owner readback、projection/asset/inventory readback 顺序 | 原 owner behavior tests + full BUSINESS；每个命令至少检查事实内容而非只看 status code | readback 提前、从 facade 拼装旧值、漏掉 post-command authoritative readback。 |
| 7 | 所有 callers 仍解析 | `rg` 记录接口与 concrete `BusinessEntityService` 引用、测试构造点、Spring `@Service` graph | full compile、application context、edge route tests、全量 backend acceptance | missing bean、ambiguous bean、direct concrete caller 断裂或跨 owner 开始引用 implementation class。 |

证明方式不创建 hash 输入台账。静态结构用当前源码、编译器、focused test 与 review；动态业务用受管 backend acceptance
的 `CONTRACT`/`BUSINESS` 分层结果；cleanup 与 budget verifier 独立报告，任何一层不能替代另一层。

## 7. 方法族与测试缺口计划

### 7.1 方法族矩阵的最低字段

实施 CP-1 的第一步必须从当前源码生成并人工核对一张方法族矩阵。每行是一个将移动的 public 方法族，而不是每个
private helper 一行。最低字段：

| 字段 | 内容 |
| --- | --- |
| familyId | `catalog.item.status` 这类能力命名；禁止 Journey ID |
| source | 当前类、方法签名与当前行锚点 |
| target | §4 目标类及其 owner aggregate |
| overloads | 所有 overload 的完整签名；不能只登记一个名称 |
| side effects | JDBC table/fact、owner API、asset、audit、receipt |
| tx | annotation 全值或 `TransactionTemplate` 传播 |
| lock/CAS | lock helper、锁定行、版本字段、取得顺序 |
| idempotency | operation id、canonical input、replay/conflict |
| readback | 写入后由谁读哪一事实、何时读 |
| exception | public exception/problem FQCN、advice mapping |
| tests | 现有测试文件/方法；新增缺口的具体文件/方法 |
| riskDimensions | §6 的实际适用条目；不适用必须写原因 |

矩阵只服务四个决定：纳入/排除、目标边界、移动顺序、测试缺口。不得把其余静态字段扩展成 hash、baseline、违规清单
或“所有 private 方法”的重复台账。

### 7.2 当前源码的 family map

下表是从当前五个目标源码直接分组得到的 implementation-facing family map。方法名后的 `xN` 表示当前源码存在
N 个 overload；实现 CP-0 时必须把这些 overload 的完整参数类型逐一抄入方法族矩阵，并以编译器核对，不能把 `xN`
当成签名本身。纯 read family 不因没有 mutation 而从 facade surface 中删除。

| familyId | 当前 public symbols（含 overload 组） | 目标产物类 | 主要证明维度 |
| --- | --- | --- | --- |
| `catalog.workbench-read` | `readWorkbenchContext/readNavigation/readItems/readCategoryCandidates/readInventoryDisplayFacts/readInventoryTargetDisplayFact/readSalesMenuCandidatePage/readSalesMenuItemFacts/readSalesMenuItemReferenceFacts` | `CatalogWorkbenchReadService` | scope、task join、owner readback、read shape |
| `catalog.definition.attribute` | `listAttributeDefinitions/createAttributeDefinition/updateAttributeDefinition/transitionAttributeDefinitionStatus` | `CatalogAttributeDefinitionService` | CAS/status、scope、readback、problem |
| `catalog.definition.unit` | `listUnitDefinitions/createUnitDefinition/updateUnitDefinition/transitionUnitStatus` | `CatalogUnitDefinitionService` | Inventory lifecycle command、lock、CAS/status、readback |
| `catalog.definition.order-option` | `listOrderOptionDefinitions/createOrderOptionDefinition/updateOrderOptionDefinition/transitionOrderOptionDefinitionStatus` | `CatalogOrderOptionDefinitionService` | option fact validation、CAS/status、readback |
| `catalog.operation-router` | `write` x1 | `CatalogCommandRouter` | closed operation dispatch、target bean transaction、invalid operation |
| `catalog.category` | `createCategory/updateCategory/moveCategory/transitionCategoryStatus` | `CatalogCategoryService` | hierarchy lock/order、CAS/status、readback、cycle/depth failure |
| `catalog.dictionary` | `readDictionary/createDictionaryEntry/updateDictionaryEntry/reorderDictionaryEntries/transitionDictionaryEntry` | `CatalogDictionaryService` | dictionary scope、CAS/order、receipt/readback |
| `catalog.item-read` | `readItem/readItemSkus` | `CatalogItemService` | scope、SKU/option projection、read shape |
| `catalog.item-command` | `createCatalogItem/transitionCatalogItemStatus/transitionCatalogItemStatuses/saveCatalogItem` | `CatalogItemService` | item/SKU facts、batch `REQUIRES_NEW`、partial rollback、Inventory owner call、readback |
| `catalog.temporary-promotion` | `preflightTemporaryCatalogItemPromotion/executeTemporaryCatalogItemPromotion/executeTemporaryCatalogItemPromotionWithProjection` | `CatalogItemService` | receipt/replay、promotion projection、Inventory coordination、readback |
| `catalog.copy` | `readLocalCopyCandidates`、`readBrandCopyCandidates`、`readShapeManifest`、`copy`、`preflightCopy`、`preflightLocalCopy`、`prepareLocalCopy`、`executeLocalCopy`、`preflightBrandCopy`、`prepareBrandCopy`、`executeBrandCopy`（全部 overload） | `CatalogCopyService` | preflight digest、compatibility disposition、receipt/replay、CAS、target readback |
| `catalog.query-validation` | `validateItemPageQuery`（`CatalogOwnerService` 与 `CatalogWorkbenchReadService` 的公开纯静态兼容入口） | `CatalogOwnerValueSupport` 共享纯值实现；两个入口只转发并保留原 FQCN | unknown field/status/query shape 拒绝；不持有 owner 事实、事务或 JDBC；不得在 facade 与 target 各保留一份校验实现 |
| `catalog.reference-read` | `resolveCatalogItemRef/catalogItemReferencedByOtherItems/itemExists/productionTagReferenced/assetReferenced/assetReferencedAnywhere/assetRefsStillReferenced/readAssetReferences/requireAssetUnreferencedAnywhere/inventoryConsumptionReferences/skuNamesByItemCodes` | `CatalogItemService` | scope、reference ownership、asset lock/readback、not-found |
| `inventory.availability` | `readSalesMenuAvailability` | `InventoryAvailabilityService` | store scope、availability projection、read shape |
| `inventory.query-validation` | `validateTargetPageQuery`（公开纯静态兼容入口） | `InventoryOwnerService` facade 保留；纯值实现可由 `InventoryTargetService` 的 package-private helper 承接 | unknown field/stock view/query shape 拒绝；不持有 owner 事实、事务或 JDBC |
| `inventory.target-read` | `readTargets/readTarget/readTargetChangeSummary/readTargetBusinessHistory/readTargetConsumptionReferences/readTargetLedger/readTargetDiagnostics` | `InventoryTargetService` | scope/type, bounded projection, history/ledger readback |
| `inventory.operation-read-router` | `read` x1 | `InventoryReadRouter` | operation closed set、原 annotation 语义、invalid operation |
| `inventory.target-command-router` | `write` x2 | `InventoryCommandRouter` | operation closed set、scope grant、target bean transaction |
| `inventory.target-mutation` | `countTarget/increaseTarget/adjustTarget/updateTargetConfiguration` | `InventoryTargetService` | typed receipt、CAS、target lock、ledger/readback |
| `inventory.catalog-lifecycle` | `validateCatalogUnitLifecycle/validateCatalogItemBaseMeasureUnitTransition` | `InventoryCatalogLifecycleService` | cross-owner read/validation、lock、failure boundary；不得写 Catalog |
| `inventory.catalog-dependency` | `catalogItemVoidDependencies`、`catalogSkuVoidDependencies`、`catalogSkuVoidDependenciesByRefs`、`catalogVoidDependencies`、`catalogVoidDependenciesByRefs`、`catalogReferenceDependencies`、`catalogReferenceDependenciesByRefs`（全部 overload） | `InventoryCatalogLifecycleService` | dependency readback、scope、retirement precondition |
| `inventory.catalog-retirement` | `retireCatalogVoidInventoryDefinitions/retireCatalogVoidInventoryDefinitionsForBatch` | `InventoryCatalogLifecycleService` | cross-owner command contract、transaction/rollback、authoritative readback |
| `inventory.bom` | `readCatalogInventoryDefinition`、`readCatalogInventorySummary`、`readCatalogInventoryConsumptionTargetCandidates`、`ensureCatalogInventoryTarget`、`saveCatalogProductBom`、`ensureCatalogItemSaveTarget`、`saveCatalogItemProductBom`、`replaceCatalogInventoryRules`、`resolveCatalogMaterialStockTarget`、`resolveCatalogMaterialStockTargets`、`deleteCatalogOptionValueBoms`、`copyCatalogOptionValueBoms`（全部 overload） | `InventoryBomService` | BOM atomicity、target CAS/lock、option-value relation、readback |
| `inventory.copy` | `copy`、`preflightCopy`、`preflightLocalCopy`、`prepareLocalCopy`、`executeLocalCopy`、`preflightBrandCopy`、`prepareBrandCopy`、`executeBrandCopy`（全部 overload） | `InventoryCopyService` | digest、mapping、receipt/replay、CAS、cross-owner reference plan、readback |
| `sales-menu.collection` | `listMenus/readMenu/create/copy/rename/archive/setActivation/updateSchedule` | `SalesMenuDefinitionService` | menu CAS、activation/schedule、receipt/readback |
| `sales-menu.section` | `listDraftSections/listPublishedSections/createSection/renameSection/deleteSection/moveSection` | `SalesMenuSectionService` | version/order/CAS、readback |
| `sales-menu.item` | `listDraftItems/readDraftItem/listPublishedItems/readPublishedItem/listItemCandidates/addItems/updateItem/deleteItem/moveItem/requireSalesMenuItemAssetTarget` | `SalesMenuItemService` | Catalog/Inventory/Channel owner calls、SKU/option selection、asset/readback |
| `sales-menu.publication` | `publicationPreview/publish` | `SalesMenuPublicationService` | immutable snapshot、publication blockers、stale child cleanup、readback |
| `sales-menu.manual-sale` | `setManualSoldOut/restoreManualSale` | `SalesMenuManualSaleService` | ITEM/SKU/ORDER_OPTION_VALUE facts、CAS、independent inventory fact、readback |
| `sales-menu.operation-record` | `listOperationRecords/recordRejectedOperation` | `SalesMenuOperationRecordService` | failure record target semantics、scope、record readback |
| `business-entity.direct-command` | `createBrand/updateBrand/createTenant/updateTenant/createHeadCompany/updateHeadCompany/transitionHeadCompanyStatus/transitionBrandStatus/transitionTenantStatus/transitionStoreStatus` | `BusinessBrandService`/`BusinessTenantService`/`HeadCompanyService`/`StoreService` | entity CAS/status、extension facts、audit/readback；Store/HeadCompany 的 authorization 与 create/update overload 在下一行单独展开。 |
| `business-entity.generic-router` | `createEntity`、`updateEntity`、`transitionEntityStatus`（全部 overload，以当前完整签名为准） | `BusinessEntityCommandRouter` | closed entity type、target dispatch、receipt/canonical input、no direct JDBC |
| `business-entity.store-overload` | `createStore`、`updateStore`、`addHeadCompanyBrandAuthorization`、`removeHeadCompanyBrandAuthorization`（全部 overload） | `StoreService`/`HeadCompanyService` | operations grant、store/project scope、CAS、advice/readback |
| `business-entity.task-read` | `authorizedBrands/authorizedBrandsByHeadCompanyIds/authorizedBrandAuthorizations/isEnterableStore/requireSalesMenuStore/resolveCatalogBrand/requireCatalogCopySource/resolveCatalogCopySource/isEnterableEntity/describeEntityPath/requireStoreContractContext/requireStoreContractContextForCreate/requireEntity/requireCommercialGroupId/requireProjectId/requireStoreProjectId/readStoreUpdateFacts/listEntities/pageBrands/pageEntities/pageBusinessEntities/requireBusinessEntity/requireEntities` | `BusinessEntityTaskReadService` | scope、task join、candidate/detail/readback；不直接写 entity |
| `business-channel.template` | `pageTemplates/pageStoreTemplateCandidates/pageTemplateVisibleStores/readTemplate/readTemplateCommandContext/createTemplate/updateTemplate/transitionTemplateStatus` | `BusinessChannelTemplateService` | visibility scope/relations、CAS、provider validation、audit/readback |
| `business-channel.channel` | `pageChannels/readChannel/readChannelCommandContext/createChannel/updateChannel/transitionChannelStatus/detachChannelBinding` | `BusinessChannelService` | channel CAS/status/binding、template revalidation、readback |
| `business-channel.composed-read` | `readChannelWithTemplateProvider/findChannelsForBinding/listSalesMenuEligibleChannels/requireSalesMenuChannel/salesMenuChannelBelongsToStore` | `BusinessChannelTaskReadService` | cross-fact read, SalesMenu eligibility, fail-closed negative paths |

这张 map 的用途是让实施者先知道“每个当前 public family 去哪里”，而不是承诺每个 family 都能安全移动。若 CP-0
发现某 family 的真实调用图、锁序或 owner write 与此不符，状态必须改为 `OPEN` 并把证据交 Dexter；不能静默换目标。

### 7.3 当前已知的测试资产与缺口判定方法

当前五个模块已有按 owner 分组的 application tests，例如：

- Catalog：`CatalogCategoryOwnerIntegrationTest`、`CatalogBatchStatusTransitionIntegrationTest`、
  `CatalogReceiptFirstUseConcurrencyIntegrationTest`、`CatalogDictionaryReorderIntegrationTest`、
  `CatalogAssetGlobalReferenceTest`、`CatalogTemporaryPromotionContractTest`、`CatalogSalesMenuTaskReadTest`；
- Inventory：`InventoryTypedMutationCasIntegrationTest`、`InventoryReceiptFirstUseConcurrencyIntegrationTest`、
  `InventoryCopyReplayIntegrationTest`、`InventoryBomBatchIntegrationTest`、`InventoryCatalogReferenceDependenciesIntegrationTest`、
  `InventorySalesMenuAvailabilityTest`；
- SalesMenu：`SalesMenuOwnerServiceOwnerApiTest`、`SalesMenuOwnerServiceReadModelTest`、
  `SalesMenuOwnerServiceOrderingTest`、`SalesMenuOwnerServiceQueryTest`；
- BusinessEntity：`OrganizationOwnerServiceTest`、`OrganizationSalesMenuOwnerTest`、
  `BusinessEntityStoreContractQueryTest` 与 task-read/overview tests；
- BusinessChannel：`BusinessChannelOwnerContractTest`、`BusinessChannelCommandQueryTest`、
  `BusinessChannelPolicyTest`、`BusinessChannelSalesMenuOwnerTest`。

这些文件名只能证明存在测试资产，不能证明每个方法族已经被钉住。CP-1 必须按矩阵逐行检查测试方法的真实
fixture、request/command、positive oracle、negative oracle 和 write/readback oracle。token 命中不是覆盖证明；无法从
测试方法可靠确认的行标记 `UNVERIFIED_REQUIRES_EVIDENCE`，并在结构移动前补齐。

### 7.4 缺口模板与最低行为集合

| 目标族 | 结构移动前必须覆盖的风险维度 | 既有资产方向 | 缺口处理 |
| --- | --- | --- | --- |
| Catalog definition/category/dictionary | owner validation、CAS/status、hierarchy lock、readback、advice problem | category/dictionary tests；definition paths需逐方法确认 | 缺任一实际 mutation family 就在既有 Catalog application test 中补 focused case；不新建测试大类。 |
| Catalog item/status/promotion | receipt/replay、batch `REQUIRES_NEW`、partial failure rollback、lock order、asset/inventory dependency、authoritative readback | batch/receipt/asset/promotion tests | 明确逐 item success/failure/unknown failure、replay/conflict 与 post-readback；未知异常不得只断言抛出。 |
| Catalog copy | preflight digest、compatibility disposition、local/brand path、replay/CAS、target facts | temporary/copy authority tests | 缺口补入现有 copy/application test；不把 copy 退化成单纯 response shape。 |
| Inventory target/availability | target CAS、scope isolation、inventory ledger readback、sales-menu availability projection | typed CAS、ledger、sales-menu availability tests | 补负向 scope/status 与 mutation 后事实 readback；不把菜单人工状态与库存事实合并。 |
| Inventory lifecycle/BOM/copy | cross-owner read/write boundary、BOM atomic group、reference retirement、copy replay/CAS | BOM/reference/copy tests | 各自补失败 rollback 与关系行后读；跨 owner command 必须看目标 owner 业务事实。 |
| SalesMenu definition/section/item | menu/section/item CAS、ordering、SKU/option selection、asset/readback | query/read-model/ordering/owner API tests | 对每个新增 target bean 的 command 族补真实 repository behavior；不能只把现有单元对象换成新构造器。 |
| SalesMenu publication/manual sale/operation record | immutable snapshot、publication blocker、ITEM/SKU/ORDER_OPTION_VALUE 独立事实、manual status readback、failure record | owner API/read model + full acceptance sales-menu scenarios | 补人工目标三级、独立库存状态与发布边界；业务 oracle 必须读回各自事实，失败记录由 operation-record 族单独核对。 |
| BusinessEntity brand/tenant/head company/store | nested exception/advice、CAS/status、authorization、readback、generic dispatch | organization owner/store/contract/sales-menu tests | generic dispatch 每个闭集 type 至少一正一负；对每个异常维度补 advice 可解析 proof。 |
| BusinessChannel template/channel/task read | visibility relation CAS、channel template revalidation、candidate eligibility、binding readback | BusinessChannel policy/contract/sales-menu tests | 证明 template 与 channel 分离、既有 channel 不被 scope 改动、候选过滤不变。 |

缺口清单的“补齐”发生在 CP-1；若缺口规模或共享 helper 依赖使拆分成本明显超过可读性收益，实施者不得自行缩小五个
目标，必须把矩阵、成本、收益与未决边界交 Dexter 决定。

## 8. 固定横切机制对照

本批是 backend-only readability refactor，模板固定行不删除；不适用项显式写明。

| 模板机制 | 本批形态与证据 | 结论 |
| --- | --- | --- |
| reader authorization | 无新增 HTTP/read operation；原 owner scope/edge authorization 不动 | N/A_WITH_REASON |
| write grant/owner sovereignty | 不新增 command；具体 service 只承接原 owner 事实，跨 owner 仍公开 API | 保持 |
| cross-owner write/transaction | `CatalogInventoryCoordinator` 保留；target 不直接写他 owner JDBC | 保持 |
| collection/pagination | 不改变 collection shape、cursor/page、Detail 原子替换或上界 | 保持 |
| cache invalidation/RTK | 无前端、无远程 cache | N/A_WITH_REASON |
| same fact one home | facade 只转发；真实 JDBC/lock/CAS/readback 迁入对应 target | 逐方法族审查 |
| failure visible/no rewrite | 原 problem/exceptions/receipt unknown failure 行为保持 | focused negative + advice |
| idempotency/receipt | 原 operation/canonical/replay first-use 代码随同事务族移动 | receipt/concurrency tests |
| generated strings | 不动 contracts/generated/error catalog；class 名仅能力命名 | static source review |
| logging/masking | 不新增敏感日志；若移动日志调用，保持既有结构化脱敏上下文 | log path/owner review |
| migration/seed | 无 schema/fixture product change | N/A_WITH_REASON |
| shared frontend behavior | 无 UI | N/A_WITH_REASON |
| candidate/dropdown | 无候选语义新增；原 read API forwarding | N/A_WITH_REASON |
| encoding/name | 新类名按能力/owner，不含 Journey ID；package 不跨 module | compile + review |
| atomic group | 每个 CP 以 focused proof + fresh step review 关闭；不以总览替代 | 必须 |

## 9. CP 总览与实施顺序

本文当前只写计划，不执行以下动作。实施授权后按以下内部 CP 推进；每个 CP 结束后先做当前步骤的 fresh 独立三维
对账，主 agent 处理 finding 并获得 `MATCHED`，才进入下一 CP。

| CP | 范围 | 主要产物 | 进入条件 | 退出条件 |
| --- | --- | --- | --- | --- |
| CP-0 | 当前源码重开、候选/方法族/调用方/测试矩阵冻结 | §3–§7 的当前字节修订版；不改 production | Dexter 实施授权 | 每个候选有明确判定；五个目标每个方法族有 target、tx、risk、test；无法确认项列 OPEN 并交 Dexter |
| CP-1 | 五个 facade 的 test fixture 与行为钉住 | 不切分测试文件；补齐 §7 缺口并先跑绿 | CP-0 MATCHED | 每行风险维度有真实 behavior oracle；focused business/compile proof 绿；无“只看状态码” |
| CP-2 | Catalog split | facade + Catalog target services；不改 API/SQL 语义 | CP-1；Catalog 矩阵完整 | Catalog focused tests、编译、事务/回执/锁/readback proof；fresh step review MATCHED |
| CP-3 | Inventory split | facade + Inventory target services | CP-2 review MATCHED | Inventory focused tests、跨 owner proof、fresh step review MATCHED |
| CP-4 | BusinessEntity split | facade + entity target services/router/read service | CP-3 review MATCHED | advice/exception/caller/Spring proof、fresh step review MATCHED |
| CP-5 | BusinessChannel split | facade + template/channel/task read services | CP-4 review MATCHED | template/channel/candidate/readback proof、fresh step review MATCHED |
| CP-6 | SalesMenu split | facade + definition/section/item/publication/manual/operation-record services | CP-5 review MATCHED | ordering/SKU/option/publication/manual/operation-record/asset proof、fresh step review MATCHED |
| CP-7 | 全批静态/行为收口 | 全量 compile、focused、逐代码与详设对账 | CP-2..6 全部 MATCHED | 全量 backend acceptance 的 CONTRACT/BUSINESS/cleanup/budget 独立证据齐备；整体 fresh 三维对账 MATCHED |

不得把 CP-1 与任一结构 CP 合并。不得在 CP-2..6 中顺便改前端、SQL 全局归位、契约、migration、seed 或其他 owner。

## 10. 每个 CP 的逐点双读与证据要求

### 10.1 写入前

主 agent 对当前要移动的每个方法族逐点重开：

1. 正式需求 §3–§10 与本文对应 §3–§7；
2. 当前六维 memory route 命中的适用原文和 `project-memory/decisions/deterministic-context-only.md`；
3. 方法签名、annotation、private helper、SQL/JDBC、lock/CAS、receipt、owner calls、exception/readback owning source；
4. 对应测试文件与真实 oracle；
5. 当前 CP 入口/退出条件。

写入前记录不是 compliance receipt 或 hash-chain；只需在实施回报中保留可复核的 source/test 路径与事实结论。

### 10.2 写入后

同一方法族使用同一组原文和 owning source 回读：行为、形态、动作、关系、位置、失败/恢复、事务、锁、回执、异常、
读回和调用方逐项只能为 `MATCHED` 或 `OPEN`。任何 `OPEN` 都不能由后续全量测试“覆盖掉”，必须主 agent 修复并由 fresh
step reviewer 复查。

### 10.3 代码与详设对账

CP-7 必须有一个明确步骤名：**逐代码与详设对账**。

范围是本批全部实际改动行，尤其是五个 facade、所有新增 target service、所有移动方法、构造器、imports、annotation、
helper、异常引用和测试缺口补充。逐行/逐符号核对：

- 方法族是否落在 §4 的目标类；
- facade 是否只转发且没有残留跨聚合事务；
- transaction/readOnly/noRollback/REQUIRES_NEW、锁/CAS、receipt、owner readback 是否一一保留；
- public exception/DTO/API 与 concrete caller 是否仍能解析；
- no new HTTP/contract/migration/frontend/owner write 是否成立；
- §6 七条不变量与 §7 behavior oracle 是否均有对应证据。

结果只允许 `MATCHED` 或 `OPEN`。只要有 `OPEN`，本批不得进入 full acceptance 或交付 review。

## 11. 实施后验证命令与分层判读

命令由实施授权后的受管执行环境运行；本文不执行。

### 11.1 静态与 focused

先使用仓内现有 Gradle/脚本入口完成 backend 编译与目标模块 focused tests；不手写新的 runner，不切分既有测试文件。
Focused proof 必须按 CP 记录：目标 class/method family、fixture、业务 oracle、失败 boundary、cleanup（如有）。

### 11.2 全量 backend acceptance

最后一次代码改动完成并经 CP-7 对账后，只用：

```bash
scripts/test/backend-acceptance --operation all
```

必须分别报告：

- `CONTRACT`：全量场景逐条全绿；
- `BUSINESS`：全量场景逐条全绿，`businessMode=REAL`；
- `DB_OPERATIONS`：信息性结果，不替代业务 oracle；
- `cleanup`：受管 Testcontainers 资源清理全绿；
- generated 238-operation budget verifier：独立证据，不写入场景 `BUSINESS`，不替代场景 oracle。

本批不需要新增 backend acceptance operation；如果实现中发现确实缺一条新的业务事实 oracle，必须先按
`doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md` 设计真实 fixture/request/oracle，
并把范围/成本交 Dexter，不能把现有 unit test 或预算结果冒充 acceptance。

### 11.3 运行期边界

本批设计阶段不启动任何服务。未来若 acceptance 获授权，必须遵守当前受管 Testcontainers/DEV 联动：检查 DEV manifest，
如有已拥有且 identity 匹配的 DEV 先受管 stop 并记录 `DEV_WAS_RUNNING=true`；Testcontainers business 与 cleanup 都 PASS
且原先有 DEV 才受管 start；不得使用本机 Spring、PostgreSQL tunnel、端口猜测或旧 browser L2 拓扑。

## 12. 停机条件与 Dexter 决策边界

以下任一情况发生，实施者必须停止当前 CP，保留首个失败和当前源码证据，向 Dexter 提交事实、影响、最小替代和成本：

- 一个方法无法由 CAS/锁/readback/owner fact 唯一归入目标聚合；
- 一个目标 service 必须直接写两个 owner，或需要新增跨 owner 事务协议；
- facade 保留原 public surface 会导致不可恢复的异常/advice/构造器断裂；
- 现有测试缺口需要改变 Journey、HTTP contract、数据库模型或引入新依赖；
- 共享 helper 的移动会改变锁顺序、receipt boundary、readback timing 或异常类型；
- 矩阵显示可读性收益小于结构、测试和调用方改动成本；
- 文档、project-memory、foundation charter、当前源码或 Dexter 指令冲突。

实施者不得以“先缩小范围再报完成”、保留 TODO、加 facade fallback、把跨聚合入口留回旧 God class 或新增万能 base
class 继续。范围停止、推迟或缩小只由 Dexter 决定。

## 13. 设计阶段自审结论与待 review 项

当前设计阶段静态结论：

- 候选全集已由当前源枚举为 62 个，五个 SPLIT 与 57 个保留对象逐个登记；
- `CatalogInventoryCoordinator`、task-read、adapter/support 没有被伪装成业务聚合；
- 五个 facade 的 public API、BusinessEntity 异常 FQCN、edge/owner caller 与 Spring bean 边界已给出；
- 七条不变量各有实施前/后证明路径；
- 行为钉住在结构移动前，full acceptance 在所有代码改动之后；
- 本批未增加产品语义、契约、数据库、前端、动态执行或新的机器控制面。

仍需 fresh independent subagent 以“找出本文为什么不成立”为立场盲审，至少攻击：

1. 62 个候选中是否有漏纳入的多聚合事务类，或五个 SPLIT 是否有错误纳入；
2. §4 的方法族边界是否能覆盖所有 public overload、private helper、nested exception/advice 与跨 owner call；
3. facade 无事务与 bean-to-bean target 是否真的保留原 transaction/readback/receipt/lock 语义；
4. CP-1 行为钉住是否可执行，是否把 token/文件存在误当覆盖；
5. full acceptance、cleanup、budget 与业务 oracle 是否分层正确；
6. 本文是否偷偷引入了过度设计、范围扩大或未授权动态动作。

本文不构成实施授权，也不构成最终产品验收。
