# B9 Business Channel CP-0 当前字节矩阵

- `STEP=CP-0`
- `REVIEW_TARGET=IMPLEMENTATION_B9_CP0_RECONCILIATION`
- `AUTHOR=MAIN_AGENT`
- `WRITE_BOUNDARY=production source unchanged while this matrix is produced`
- `SOURCE_ANCHOR_TIME=2026-09-13 focused-test proof after receipt fixture write`
- `DYNAMIC_BOUNDARY=仅受管远端 Testcontainers focused proof；不启动本地 Spring/PostgreSQL，不使用 PostgreSQL tunnel，不执行 DEV/reset/seed/browser L2`

## 1. 范围与分类

本矩阵只覆盖 B9 的 business-channel execution relocation。候选边界是
`modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/`
下四个含 JDBC execution 的类；facade、纯 SQL-shape helper 与 app-edge coordinator 作为边界/调用方登记，不静默纳入。

| source | 当前事实 | B9 处理 | 分类理由与目标 |
| --- | --- | --- | --- |
| `BusinessChannelService.java` | 7 `@Transactional`；12 个 `jdbc.*` sink（含私有 typed query helper 的真实 sink）；负责 channel 读写、锁定、CAS、audit/readback | 纳入 channel persistence execution | channel owner fact/command；保留 application policy、授权、receipt、状态维度与 readback 编排，SQL 与映射进入具名 persistence |
| `BusinessChannelTemplateService.java` | 8 `@Transactional`；13 个 `jdbc.*` sink | 纳入 template persistence execution | template owner fact/command；保留 provider/授权/visibility 规则与事务，SQL、关系替换、映射进入具名 persistence |
| `BusinessChannelTaskReadService.java` | 5 `@Transactional`；3 个 `jdbc.*` sink | 纳入 task-read persistence execution | 销售菜单候选、direct 复核、binding 关联与 provider read 是同一 task-read owner；不拆入 sales-menu 或外部 coordinator |
| `BusinessChannelCommandReceiptService.java` | 无 `@Transactional`；3 个 `jdbc.*` sink | 纳入 receipt persistence execution | receipt 是 adapter-support；事务继续由调用方边界提供，receipt service 保留校验、序列化与 typed problem |
| `BusinessChannelOwnerService.java` | facade；0 事务、0 生产 JDBC；兼容构造器接收 `JdbcTemplate` | 保留稳定 FQCN/API；兼容构造器改为注入 typed persistence 或由 typed persistence 构造 | 不建立第二份 owner fact；所有 public API 继续委托 template/channel/task-read service |
| `BusinessChannelQuerySupport.java` | 纯 helper；无 JDBC/事务；拼接 channel projection、suffix 与 inserted projection | 移入 persistence 段并改为 package-private persistence support | SQL composition 必须由 persistence 拥有；不能留在 application 作为 fragment producer |
| `ExternalCollaborationBusinessChannelCoordinator.java` | app-edge 跨 owner coordinator；调用 `BusinessChannelReadApi`/`BusinessChannelCommandApi` | 不纳入 89 个 module application 候选；列为 caller | 既有 edge coordinator 边界，不因名称包含 Coordinator 改变范围 |

## 2. 事务与持久化 execution 矩阵

`jdbc.*` 的当前计数按大小写敏感的 `jdbc.(query|queryForList|queryForObject|update|batchUpdate)` receiver 逐处计数；不把
`receipts.execute`、纯 SQL holder、`StringBuilder`、facade 委托或 repository interface 当 JDBC sink。当前四类合计
`12 + 13 + 3 + 3 = 31` 个 receiver-qualified sink。

### 2.1 Channel execution（12 sinks）

| key | 当前方法/行 | 当前 sink | 目标 typed persistence 方法 | 事务/不变量与 proof |
| --- | --- | --- | --- | --- |
| `BC-CH-01` | `pageChannels:163` → helper `query:1218` | `jdbc.query` | `pageChannels(workspace, group, ownerNodeType, ownerNodeRef, status, sort, direction)` | read-only transaction；status/sort branch、bounded limit、projection mapping；after capture |
| `BC-CH-02` | `readChannelCommandContext:200` | `jdbc.query` | `readChannelCommandContext(workspace, group, channelRef)` | read-only；template facts 必须同一 owner read |
| `BC-CH-03` | `updateChannel:401` | `jdbc.update` | `updateChannel(channelRef, workspace, group, channelName, bindingRef, now, expectedVersion)` | REQUIRED；CAS version、锁定 read、audit/readback不变 |
| `BC-CH-04` | `transitionChannelStatus:498` | `jdbc.update` | `transitionChannelStatus(channelRef, workspace, group, status, now, expectedVersion)` | REQUIRED；状态幂等与 CAS、audit 不变 |
| `BC-CH-05` | `detachChannelBinding:558` | `jdbc.update` | `detachChannelBinding(channelRef, workspace, group, now, expectedVersion)` | REQUIRED；binding context、CAS、audit 不变 |
| `BC-CH-06` | `insertChannelReturningProjection:752` | `jdbc.query` | `insertChannelReturning(command, channelRef, channelCode, initialStatus, now)` | REQUIRED；duplicate mapping、RETURNING projection、readback不变 |
| `BC-CH-07` | `readTemplateCommandProjection:785` | `jdbc.query` | `readTemplateCommandProjection(workspace, group, templateRef, channelCode)` | create channel revalidation；template/provider facts不变 |
| `BC-CH-08` | `readChannelRow:821` | `jdbc.query` | `readChannel(workspace, group, channelRef)` | read-only；status dimensions/ancestor readback由 application 编排 |
| `BC-CH-09` | `readChannelForUpdate:840` | `jdbc.query` | `readChannelForUpdate(workspace, group, channelRef)` | REQUIRED；`FOR UPDATE OF c` 锁目标不变 |
| `BC-CH-10` | `readCommandChannelRow:862` | `jdbc.query` | `readCommandChannel(workspace, group, channelRef, forUpdate)` | REQUIRED/reads；channel 与 joined template projection 同次 read，锁 suffix 不变 |
| `BC-CH-11` | `readOrganizationAncestors:1054` | `jdbc.query` | `readOrganizationAncestors(workspace, group, nodeRefs)` | task/status read；placeholder 数量、递归顺序、scope 参数不变 |
| `BC-CH-12` | `audit:1380` | `jdbc.update` | `insertAudit(eventRef, workspace, group, actor, entityRef, action, changesJson, occurredAt)` | REQUIRED；审计 policy/filter 与时间边界由 application 保留 |

### 2.2 Template execution（13 physical sinks；共享 helper 的调用点逐一列出）

| key | 当前方法/行 | 当前 sink | 目标 typed persistence 方法 | 事务/不变量与 proof |
| --- | --- | --- | --- | --- |
| `BC-TPL-01` | `readTemplateCommandContext:336` | `jdbc.query` | `readTemplateCommandContext(workspace, group, template)` | read-only；template/project ownership facts |
| `BC-TPL-02` | `createTemplate:412` | `jdbc.update` | `insertTemplate(templateRef, command, templateCode, scope, now)` | REQUIRED；template row values与duplicate mapping |
| `BC-TPL-03` | `transitionTemplateStatus:614` | `jdbc.update` | `transitionTemplateStatus(templateRef, workspace, group, status, now, expectedVersion)` | REQUIRED；CAS/status/audit |
| `BC-TPL-04` | `readTemplateRow:765` | `jdbc.query` | `readTemplate(workspace, group, templateRef)` | read-only；count/project status mapping |
| `BC-TPL-05` | `readTemplateForUpdate:783` | `jdbc.query` | `readTemplateForUpdate(workspace, group, templateRef)` | REQUIRED；lock target与project relation |
| `BC-TPL-06` | `readTemplateProjectionForUpdate:802` | `jdbc.query` | `readTemplateForUpdateWithVisibleStores(workspace, group, templateRef)` | REQUIRED；ALL visible relation read，VOIDED ref 不隐藏 |
| `BC-TPL-07` | `readOrganizationAncestors:997` | `jdbc.query` | `readOrganizationAncestors(workspace, group, nodeRefs)` | same recursive ancestor shape as channel, owned by template persistence |
| `BC-TPL-08` | `verifyVisibleStoreTemplate:1071` | `jdbc.query` | `verifyTemplateTarget(workspace, group, template, project)` | store-owned/project boundary and typed stale/mismatch problems |
| `BC-TPL-09` | `updateTemplateAndVisibleStoreRelations:1215` | `jdbc.query` | `updateTemplateAndVisibleStoreRelations(template, command, expectedVersion, visibleStoreRefs)` | one REQUIRED atomic relation replacement；CAS、empty set、authoritative projection unchanged |
| `BC-TPL-10` | `insertVisibleStoreRelations:1225` | `jdbc.batchUpdate` | `insertVisibleStoreRelations(template, visibleStoreRefs)` | empty set remains no-op；relation rows and FK semantics unchanged |
| `BC-TPL-11` | `pageStoreTemplateCandidates:230`、`pageTemplateVisibleStores:299`、`requireStoreChannelCreateEligibility:1132-1146` → helper `count:1253-1255` | `jdbc.query` | `countStoreTemplateCandidates(...)`、`countVisibleStores(...)`、`countVisibleStoreMembership(template, store)` | read-only page/count pairing；create-channel selected-store membership check remains in the channel-create REQUIRED/receipt context；NON_VOIDED/ALL and stale-visibility semantics unchanged |
| `BC-TPL-12` | `pageTemplates:144`、`pageStoreTemplateCandidates:232`、`pageTemplateVisibleStores:300` → helper `query:1261` | `jdbc.query` | `pageTemplates(...)`、`pageStoreTemplateCandidates(...)`、`pageVisibleStores(...)` | read-only；each caller keeps its own filter/cursor/visible-store EXISTS/next-cursor mapping |
| `BC-TPL-13` | `audit:1410` | `jdbc.update` | `insertAudit(eventRef, workspace, group, actor, entityRef, action, changesJson, occurredAt)` | REQUIRED；audit policy/filter and time boundary unchanged |

Rows `BC-TPL-11` and `BC-TPL-12` share private helper sinks but list every current caller, including the channel-create eligibility path. They are physical sink keys, not wildcard permission; the implementation record must preserve the caller-to-business-method mapping shown here.

### 2.3 Task-read execution（3 physical sinks；共享 helper 的调用点逐一列出）

| key | 当前方法/行 | 当前 sink | 目标 typed persistence 方法 | 事务/不变量与 proof |
| --- | --- | --- | --- | --- |
| `BC-TASK-01` | `readChannelWithTemplateProvider:162` | `jdbc.query` | `readChannelWithTemplateProvider(workspace, group, channel)` | task read；provider join/readback and NOT_FOUND mapping unchanged |
| `BC-TASK-02` | `readOrganizationAncestors:258` | `jdbc.query` | `readOrganizationAncestors(workspace, group, nodeRefs)` | task status read；scope/recursive mapping unchanged |
| `BC-TASK-03` | `listSalesMenuEligibleChannels:98`、`requireSalesMenuChannel:129`、`salesMenuChannelBelongsToStore:147`、`findChannelsForBinding:184` → helper `query:457` | `jdbc.query` | `pageSalesMenuEligibleChannels(...)`、`requireSalesMenuChannel(...)`、`salesMenuChannelBelongsToStore(...)`、`findChannelsForBinding(...)` | each caller keeps its own business predicate；INTERNAL + STORE + DINE_IN/TAKEAWAY sales-menu exclusion remains exact；provider/binding/readback mappings unchanged |

`BC-TASK-03` is one physical private sink with four current callers, all listed above; it is not a grouped wildcard and must retain four caller-specific target methods in the implementation ledger.

### 2.4 Receipt execution（3 sinks）

| key | 当前方法/行 | 当前 sink | 目标 typed persistence 方法 | 事务/不变量与 proof |
| --- | --- | --- | --- | --- |
| `BC-RECEIPT-01` | `execute:46` | `jdbc.queryForList` | `lockReceipt(workspace, receiptIdentity)` | advisory transaction lock before lookup |
| `BC-RECEIPT-02` | `execute:50` | `jdbc.query` | `findReceipt(workspace, group, idempotencyKey)` | replay/conflict/corrupt readback |
| `BC-RECEIPT-03` | `execute:69` | `jdbc.update` | `insertReceipt(receiptRef, workspace, group, key, operation, requestHash, responseJson, now)` | no duplicate execution; unique conflict remains observable |

## 3. Facade public overload、caller 与注入矩阵

稳定 public owner interface 与 `BusinessChannelOwnerService` FQCN 不变。每一行是一个独立的 facade/API overload；接口声明、facade 实现、目标 execution、当前 Java caller 和测试 caller 分开列出。没有当前 caller 的公开 overload 仍单列并明确保留理由，不以“可能未来调用”冒充消费者。

| key | 完整 API overload 签名 | declaration | facade implementation → target execution | 当前生产 caller（逐点） | 当前测试 caller/oracle（逐点） |
| --- | --- | --- | --- | --- | --- |
| `BC-API-R01` | `BusinessChannelReadback.TemplatePage pageTemplates(UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef, String status, String operatorKind, String sortKey, String sortDirection)` | `BusinessChannelReadApi.java:8-15` | `BusinessChannelOwnerService.java:91-100` → `BusinessChannelTemplateService.pageTemplates:102-162` | `OperationsBusinessChannelController.java:105` | `OperationsBusinessChannelControllerScopeTest.java:237,242,290,299`; `BusinessChannelOwnerContractTest.java:834,857,893` |
| `BC-API-R02` | `BusinessChannelReadback.TemplatePage pageStoreTemplateCandidates(UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef, String storeRef, String cursor, int pageSize, String sortKey, String sortDirection)` | `BusinessChannelReadApi.java:17-25` | `BusinessChannelOwnerService.java:104-121` → `BusinessChannelTemplateService.pageStoreTemplateCandidates:167-251` | `OperationsBusinessChannelController.java:127` | `OperationsBusinessChannelControllerScopeTest.java:349,365`; `BusinessChannelOwnerContractTest.java:925` |
| `BC-API-R03` | `BusinessChannelReadback.VisibleStorePage pageTemplateVisibleStores(UUID workspaceUuid, String groupWorkspaceKey, UUID templateRef, UUID projectRef, String storeStatusFilter, String cursor, int pageSize)` | `BusinessChannelReadApi.java:27-34` | `BusinessChannelOwnerService.java:125-140` → `BusinessChannelTemplateService.pageTemplateVisibleStores:256-319` | `OperationsBusinessChannelController.java:151` | `OperationsBusinessChannelControllerScopeTest.java:249,257` |
| `BC-API-R04` | `BusinessChannelReadback.ChannelPage pageChannels(UUID workspaceUuid, String groupWorkspaceKey, String ownerNodeType, String ownerNodeRef, String status, String sortKey, String sortDirection)` | `BusinessChannelReadApi.java:36-43` | `BusinessChannelOwnerService.java:144-153` → `BusinessChannelService.pageChannels:125-186` | `OperationsBusinessChannelController.java:454` | `OperationsBusinessChannelControllerScopeTest.java:150,181`; `BusinessChannelOwnerContractTest.java:502,629,741,767,811,873,906` |
| `BC-API-R05` | `BusinessChannelReadback.Template readTemplate(UUID workspaceUuid, String groupWorkspaceKey, UUID templateRef)` | `BusinessChannelReadApi.java:45` | `BusinessChannelOwnerService.java:157-160` → `BusinessChannelTemplateService.readTemplate:324-329` | `NONE_FOUND`（当前 Java 源码无外部调用；保留稳定 read API，不能在本批静默删除） | `NONE_FOUND` |
| `BC-API-R06` | `BusinessChannelReadback.Channel readChannel(UUID workspaceUuid, String groupWorkspaceKey, UUID channelRef)` | `BusinessChannelReadApi.java:47` | `BusinessChannelOwnerService.java:163-165` → `BusinessChannelService.readChannel:189-192` | `OperationsBusinessChannelController.java:552`; `ExternalCollaborationBusinessChannelCoordinator.java:271` | `OperationsBusinessChannelControllerScopeTest.java:216,226` |
| `BC-API-R07` | `BusinessChannelReadback.TemplateCommandContext readTemplateCommandContext(UUID workspaceUuid, String groupWorkspaceKey, UUID templateRef)` | `BusinessChannelReadApi.java:50-51` | `BusinessChannelOwnerService.java:168-171` → `BusinessChannelTemplateService.readTemplateCommandContext:332-349` | `OperationsBusinessChannelController.java:265,294` | `OperationsBusinessChannelControllerScopeTest.java:258`（negative `never` oracle；无 positive module test） |
| `BC-API-R08` | `BusinessChannelReadback.ChannelCommandContext readChannelCommandContext(UUID workspaceUuid, String groupWorkspaceKey, UUID channelRef)` | `BusinessChannelReadApi.java:54-55` | `BusinessChannelOwnerService.java:174-177` → `BusinessChannelService.readChannelCommandContext:196-227` | `OperationsBusinessChannelController.java:351,381`; `ExternalCollaborationBusinessChannelCoordinator.java:104,166` | `NONE_FOUND` |
| `BC-API-R09` | `BusinessChannelReadback.ChannelWithTemplateProvider readChannelWithTemplateProvider(UUID workspaceUuid, String groupWorkspaceKey, UUID channelRef)` | `BusinessChannelReadApi.java:58-59` | `BusinessChannelOwnerService.java:180-183` → `BusinessChannelTaskReadService.readChannelWithTemplateProvider:158-176` | `NONE_FOUND`（当前 Java 源码无直接 caller；保留稳定 cross-owner read API） | `NONE_FOUND` |
| `BC-API-R10` | `List<BusinessChannelReadback.Channel> findChannelsForBinding(UUID workspaceUuid, String groupWorkspaceKey, UUID bindingRef)` | `BusinessChannelReadApi.java:62-63` | `BusinessChannelOwnerService.java:186-189` → `BusinessChannelTaskReadService.findChannelsForBinding:180-194` | `ExternalCollaborationBusinessChannelCoordinator.java:77-78` | `NONE_FOUND` |
| `BC-API-O01` | `BusinessChannelOwnerApi.SalesMenuEligibleChannelPage listSalesMenuEligibleChannels(UUID workspaceUuid, String groupWorkspaceKey, String storeRef, String cursor, int pageSize, String sortKey, String sortDirection)` | `BusinessChannelOwnerApi.java:13-20` | `BusinessChannelOwnerService.java:192-201` → `BusinessChannelTaskReadService.listSalesMenuEligibleChannels:55-121` | `OperationsBusinessChannelController.java:196` | `OperationsBusinessChannelControllerScopeTest.java:58,73,107,135,190`; `BusinessChannelSalesMenuOwnerTest.java:58,85,118,123` |
| `BC-API-O02` | `BusinessChannelOwnerApi.SalesMenuChannelJudgment requireSalesMenuChannel(UUID workspaceUuid, String groupWorkspaceKey, String storeRef, UUID channelRef)` | `BusinessChannelOwnerApi.java:23-24` | `BusinessChannelOwnerService.java:205-208` → `BusinessChannelTaskReadService.requireSalesMenuChannel:124-139` | `SalesMenuEdgeSupport.java:88`; `SalesMenuDefinitionService.java:601`; `SalesMenuSectionService.java:465`; `SalesMenuItemService.java:1609`; `SalesMenuManualSaleService.java:399`; `SalesMenuOperationRecordService.java:230`; `SalesMenuPublicationService.java:890` | `BusinessChannelSalesMenuOwnerTest.java:142,163`; `SalesMenuOwnerServiceOwnerApiTest.java:141,270,391` |
| `BC-API-O03` | `boolean salesMenuChannelBelongsToStore(UUID workspaceUuid, String groupWorkspaceKey, String storeRef, UUID channelRef)` | `BusinessChannelOwnerApi.java:27-28` | `BusinessChannelOwnerService.java:211-214` → `BusinessChannelTaskReadService.salesMenuChannelBelongsToStore:142-155` | `SalesMenuOperationRecordService.java:160` | `BusinessChannelSalesMenuOwnerTest.java:181`; `SalesMenuOwnerServiceOwnerApiTest.java:257,269` |
| `BC-API-C01` | `BusinessChannelReadback.Template createTemplate(BusinessChannelCommandApi.CreateTemplateCommand command)` | `BusinessChannelCommandApi.java:16` | `BusinessChannelOwnerService.java:217-219` → `BusinessChannelTemplateService.createTemplate:353-461` | `CreateOperationsBusinessChannelTemplateOperation.java:21` | `BusinessChannelOwnerContractTest.java:104` |
| `BC-API-C02` | `BusinessChannelReadback.Template updateTemplate(BusinessChannelCommandApi.UpdateTemplateCommand command)` | `BusinessChannelCommandApi.java:18` | `BusinessChannelOwnerService.java:222-224` → `BusinessChannelTemplateService.updateTemplate:463-564` | `UpdateOperationsBusinessChannelTemplateOperation.java:21` | `NONE_FOUND`（现有模板行为测试通过 status/edge 读取覆盖，未有直接 owner invocation） |
| `BC-API-C03` | `BusinessChannelReadback.Template transitionTemplateStatus(BusinessChannelCommandApi.TransitionTemplateStatusCommand command)` | `BusinessChannelCommandApi.java:20` | `BusinessChannelOwnerService.java:227-229` → `BusinessChannelTemplateService.transitionTemplateStatus:566-640` | `TransitionOperationsBusinessChannelTemplateStatusOperation.java:21` | `BusinessChannelOwnerContractTest.java:147,216` |
| `BC-API-C04` | `BusinessChannelReadback.Channel createChannel(BusinessChannelCommandApi.CreateChannelCommand command)` | `BusinessChannelCommandApi.java:22` | `BusinessChannelOwnerService.java:232-234` → `BusinessChannelService.createChannel:230-330` | `CreateOperationsBusinessChannelOperation.java:21` | `NONE_FOUND`（无直接 module owner invocation；由 operation/acceptance 路径覆盖） |
| `BC-API-C05` | `BusinessChannelReadback.Channel updateChannel(BusinessChannelCommandApi.UpdateChannelCommand command)` | `BusinessChannelCommandApi.java:24` | `BusinessChannelOwnerService.java:237-239` → `BusinessChannelService.updateChannel:332-446` | `ExternalCollaborationBusinessChannelCoordinator.java:240`; `UpdateOperationsBusinessChannelOperation.java:21` | `NONE_FOUND`（无直接 module owner invocation） |
| `BC-API-C06` | `BusinessChannelReadback.Channel transitionChannelStatus(BusinessChannelCommandApi.TransitionChannelStatusCommand command)` | `BusinessChannelCommandApi.java:26` | `BusinessChannelOwnerService.java:242-244` → `BusinessChannelService.transitionChannelStatus:448-523` | `TransitionOperationsBusinessChannelStatusOperation.java:21` | `BusinessChannelOwnerContractTest.java:276,346` |
| `BC-API-C07` | `BusinessChannelReadback.Channel detachChannelBinding(DetachChannelBindingCommand command, long expectedVersion)` | `BusinessChannelCommandApi.java:29` | `BusinessChannelOwnerService.java:247-250` → `BusinessChannelService.detachChannelBinding:525-583` | `ExternalCollaborationBusinessChannelCoordinator.java:81-88,144-151` | `BusinessChannelOwnerContractTest.java:412-420` |
| `BC-API-C08` | `default BusinessChannelReadback.Channel detachChannelBinding(DetachChannelBindingCommand command)` | `BusinessChannelCommandApi.java:31-33` | interface default delegates to `BC-API-C07`; facade inherits it | `NONE_FOUND`（无一参 direct caller；保留 API default 兼容面，不能静默删除） | `NONE_FOUND` |

`BusinessChannelWireMapper.java:151-160` consumes the owner sales-menu page shape, and `ContractProblemAdvice.java:161-167` consumes the public `BusinessChannelCommandApi.Problem` mapping; these are boundary consumers rather than method invocations and remain explicit proof points. `BusinessChannelOwnerService`'s compatibility constructor at `:56-87` and the direct-test construction callers at `BusinessChannelOwnerContractTest.java:65,138,207,267,337,403,493,620,732,940` and `BusinessChannelSalesMenuOwnerTest.java:193-202` are constructor evidence, not hidden API callers.

### 3.1 Constructor 结论

- Current source fact: production injection is `BusinessChannelOwnerService` → template/channel/task services, while `BusinessChannelOwnerService.java:56-87` compatibility construction and the three service constructors still pass `JdbcTemplate`; the services still execute JDBC before B9.
- Target contract after B9: `BusinessChannelOwnerService` → template/channel/task services, and each service receives its typed persistence collaborator; this is a post-move proof requirement, not a current-byte fact.
- Target contract after B9: `BusinessChannelCommandReceiptService` production injection receives `BusinessChannelCommandReceiptPersistence` and `TimeProvider`.
- Existing direct-test constructors accepting `JdbcTemplate` remain as compatibility constructors only; after the move they must construct typed persistence collaborators and must not execute JDBC in the service. This is proven only after source relocation and focused tests.
- No `@Primary`/fallback bean is added. If Spring finds an ambiguous bean after the change, the CP stops at injection repair and records the exact duplicate rather than masking it.

### 3.2 Exact test-oracle index for the public boundary

The following index replaces filename-only coverage claims. Each entry points to a named test method or explicitly records `NONE_FOUND`; `@Test` count is a current inventory signal, not proof that a risk dimension is closed.

| oracle key | exact test method / path | public boundary or risk actually exercised | current proof status |
| --- | --- | --- | --- |
| `BC-OR-01` | `application/persistence/BusinessChannelCommandQueryTest.java:8-27`, `commandChannelReadCarriesTemplateFactsInTheSameOwnerRead` | persistence-owned command projection carries joined template facts | reusable focused oracle; rerun after persistence move |
| `BC-OR-02` | `BusinessChannelOwnerContractTest.java:44-49`, `readbackDoesNotExposeAdapterSecretsOrOpaqueAuthorizationValues` | public channel/template readback projection boundary | reusable focused oracle |
| `BC-OR-03` | `BusinessChannelOwnerContractTest.java:52-58`, `nullableChannelCodeIsReturnedExactly` | channel readback nullable code preservation | reusable focused oracle |
| `BC-OR-04` | `BusinessChannelOwnerContractTest.java:61-108`, `staleOperationsContextIsRejectedBeforeReceiptReplayOrWrite` | command facade pre-receipt grant rejection/no write | reusable focused oracle |
| `BC-OR-05` | `BusinessChannelOwnerContractTest.java:109-176`, `templateStatusUsesTheLockedRowForAuthorizationAndReadback` | template lock, grant, status write and authoritative readback | reusable focused oracle |
| `BC-OR-06` | `BusinessChannelOwnerContractTest.java:177-237`, `templateStatusRejectsAGrantWhenTheLockedTemplateTargetDiffers` | locked target authorization negative path | reusable focused oracle |
| `BC-OR-07` | `BusinessChannelOwnerContractTest.java:238-307`, `channelStatusUsesTheLockedJoinedRowForAuthorizationAndReadback` | channel lock, joined template facts, status/audit/readback | reusable focused oracle |
| `BC-OR-08` | `BusinessChannelOwnerContractTest.java:308-368`, `channelStatusAllowsReenableAfterUpstreamStatusChanges` | status transition positive path after upstream change | reusable focused oracle |
| `BC-OR-09` | `BusinessChannelOwnerContractTest.java:369-433`, `detachBindingClearsOnlyBindingAndPreservesTheChannelStatus` | detach command, expected version, audit/readback and public overload | reusable focused oracle |
| `BC-OR-10` | `BusinessChannelOwnerContractTest.java:434-553`, `channelReadbackCarriesTheCompleteIndependentStatusDimensionSet` | status dimension/ancestor readback mapping | reusable focused oracle |
| `BC-OR-11` | `BusinessChannelOwnerContractTest.java:554-665`, `projectChannelReadbackCarriesTargetProjectAndAncestorDimensions` | project target/ancestor readback | reusable focused oracle |
| `BC-OR-12` | `BusinessChannelOwnerContractTest.java:666-750`, `collectionStatusFactsAreLoadedOnceForDuplicateChannelRows` | task/status fact collection and duplicate-row behavior | reusable focused oracle |
| `BC-OR-13` | `BusinessChannelOwnerContractTest.java:751-822`, `boundedChannelReadReturnsTheExactSetAndIgnoresRequestPageSize`; `boundedChannelReadRejectsOverflowInsteadOfSilentlyTruncating` | bounded channel read and overflow failure | reusable focused oracle |
| `BC-OR-14` | `BusinessChannelOwnerContractTest.java:823-860`, `boundedTemplateReadUsesTheSameFixedSourceLimit`; `boundedTemplateReadRejectsOverflowInsteadOfReturningAPartialSet` | bounded template read and overflow failure | reusable focused oracle |
| `BC-OR-15` | `BusinessChannelOwnerContractTest.java:862-929`, `boundedChannelReadUsesTheRequestedColumnAndDirection`; `boundedReadRejectsUnsupportedSortKeyBeforeQuerying`; `boundedReadRejectsDirectionWithoutAColumnBeforeQuerying`; `storeTemplateCandidateReadRejectsUnsupportedSortBeforeQuerying` | sort/cursor input validation and query shape | reusable focused oracle |
| `BC-OR-16` | `BusinessChannelPolicyTest.java:14` `externalDineInIsStoreOnlyAndDoesNotUseInternalForm`; `:61` `nonDineInTemplateAcceptsNullDineInForm`; `:72` `storeTemplateRequiresTheDedicatedVisibilityScopeProblem`; `:84` `plannedCatalogueStatusDoesNotBlockAnEnabledProvider`; `:95` `disabledProviderIsRejectedEvenWhenItsCatalogueStatusIsAvailable`; `:108` `channelCodeIsRequiredAndOnlySurroundingWhitespaceIsTrimmed`; `:114` `effectiveExternalChannelRequiresMatchingEffectiveBinding` | policy negative/positive admission, provider and binding validation | reusable focused oracles |
| `BC-OR-17` | `BusinessChannelSalesMenuOwnerTest.java:40` `eligibleChannelsUseAStoreBoundOpaqueKeysetWithoutAHiddenTotal`; `:105` `cursorIsBoundToTheCompleteStoreAndSortIdentity`; `:130` `requireSalesMenuChannelReturnsExactFactsAndRejectsIneligibleRowsAsTypedProblem`; `:170` `channelTargetReadCanProveStoreOwnershipWithoutApplyingSalesMenuEligibility` | sales-menu candidate/direct predicates, cursor identity and store relation | reusable focused oracles |
| `BC-OR-18` | `BusinessChannelCommandReceiptServiceTest.java:27` `invalidIdempotencyKeyIsTypedAndRejectedBeforeDatabaseAccess`; `:47` `replayReturnsTheStoredResponseWithoutExecutingTheCommandAgain`; `:85` `differentRequestForTheSameIdempotencyKeyIsRejectedBeforeCommandExecution`; `:120` `corruptStoredResponseIsTypedBeforeReturningAReplay` | invalid key, replay/no duplicate, same-key conflict, corrupt response | current PASS in `r5-tc-1789290667377-85794`; rerun after move |
| `BC-OR-19` | `OperationsBusinessChannelControllerScopeTest.java:39` `storeChannelListReadsTheRealStoreProjectBeforeRejectingAnotherSelectedStore`; `:62` `salesMenuChannelListUsesTheEligibleOwnerAndFixedProductPageSize`; `:118` `salesMenuChannelListRejectsWrongUsageOrNonProductPageSizeBeforeOwnerRead`; `:140` `businessChannelListUsesTheGenericStoreOwnerReadAndKeepsSalesMenuOwnerSeparate`; `:194` `channelBindingReadsChannelOwnerAndStoreBeforeReadingTheBinding`; `:232` `templateListPassesTheSessionSelectedProjectToTheOwnerRead`; `:246` `visibleStorePageReusesFreshSessionProjectAndLetsOwnerVerifyTemplateInOneRead`; `:263` `storeAssignedTemplateListUsesItsOwnerValidatedProjectAndStoreTemplates`; `:304` `storeAssignedTemplateListRejectsAProjectOutsideItsSelectedStoreOwner`; `:340` `selectedStoreCanReadItsProjectTemplateCandidatesWithoutProjectScopeResolution` | HTTP edge scope/read/candidate routing; exact method rows `BC-API-R01`–`R04`, `R06`, `O01` | reusable edge oracles; no production API shape change |
| `BC-OR-20` | `SalesMenuOwnerServiceOwnerApiTest.java:132` `publishedReadUsesOneTypedInventorySetReadAndOneManualSetRead` (mock at `:141`); `:247` `ineligibleChannelRejectionUsesStoreTargetProofBeforeRecording` (mock/verify at `:257-270`); `:358` `disabledMenuActivationDoesNotBlockPublish` (negative `never().requireSalesMenuChannel` verify at `:391`); `:397` `publishUsesMonotonicPublicationRevisionAndCurrentDraftRevision` | sales-menu owner mocks for `requireSalesMenuChannel` and store relation | reusable cross-owner oracles |

Rows in the API matrix marked `NONE_FOUND` are explicit test gaps, not silently inferred coverage. They must be attached to the relevant CP-1/execution proof or remain an open gap; compilation, file presence or DB-operation counts cannot close them.

## 4. Transaction、self-call、lock/CAS、receipt、audit/readback ledger

This is the pre-write matrix, not a claim that all rows are already proven. Production implementation must expand every public overload and every grouped sink into stable rows.

| invariant dimension | current fact to preserve | current source anchor | after proof |
| --- | --- | --- | --- |
| outer transaction/proxy | channel 7、template 8、task-read 5 public transaction boundaries；receipt no annotation and joins caller transaction | four service `@Transactional` declarations above | annotation diff + focused transaction/proxy proof |
| self-call | private helper calls are same-class today; moving to persistence creates bean boundary only for execution, not policy callbacks | `BusinessChannelService` private read/write helpers；template/task helpers | per moved method family self-call/outer tx row；if outer REQUIRED already active, target REQUIRED must join |
| channel lock/CAS | `readChannelForUpdate`/`readCommandChannelRow(...,true)` use `FOR UPDATE OF c`; update predicates include expected version | `BusinessChannelService.java:839-875,401-408,498-505,558-565` | SQL capture + real DB CAS/conflict/readback |
| template lock/CAS/relation | locked template read, full visible-store ALL read, one transaction relation replacement + template CAS | `BusinessChannelTemplateService.java:494-536,1163-1218` | SQL/data-flow + real DB relation/readback |
| receipt lock/replay | advisory lock → receipt lookup → command once → insert; replay returns parsed stored response | `BusinessChannelCommandReceiptService.java:46-80` | focused replay/conflict/corrupt/no-duplicate proof already PASS; after persistence proof required |
| audit | policy filters allowed changes and writes in same command transaction | `BusinessChannelService.java:1372-1392`; `BusinessChannelTemplateService.java:1402-1424` | focused audit/readback + source mapping |
| authoritative readback | mutation return is built from RETURNING/read after write, not status code/DB count | channel insert/update and template relation update methods above | focused business oracle/readback; DB operations informational only |
| public exception mapping | `BusinessChannelCommandApi.Problem` and existing typed exception/advice paths remain FQCN-compatible | `ContractProblemAdvice.java:161-167` and module tests | compile + mapping test |

## 5. 测试覆盖与缺口矩阵

Current inventory is from exact JUnit `@Test` annotation count, not file presence: 5 files / 35 tests on the current bytes (32 before the receipt fixture extension). The current focused run includes the three extended receipt tests.

| risk dimension | current candidate proof | gap / next proof |
| --- | --- | --- |
| template/channel/task read contract | `BusinessChannelOwnerContractTest.java` and `BusinessChannelSalesMenuOwnerTest.java` | after typed persistence must retain SQL predicate and mapped readback assertions |
| policy negative paths | `BusinessChannelPolicyTest.java` (7 tests) | unchanged policy; compile and existing focused proof |
| receipt invalid input | `BusinessChannelCommandReceiptServiceTest.invalidIdempotencyKeyIsTypedAndRejectedBeforeDatabaseAccess` | retained |
| receipt replay/no duplicate | `BusinessChannelCommandReceiptServiceTest.replayReturnsTheStoredResponseWithoutExecutingTheCommandAgain` | current proof PASS in `r5-tc-1789290667377-85794`; rerun after persistence move |
| receipt same-key conflict | `...differentRequestForTheSameIdempotencyKeyIsRejectedBeforeCommandExecution` | current proof PASS; rerun after move |
| receipt corrupt readback | `...corruptStoredResponseIsTypedBeforeReturningAReplay` | current proof PASS; rerun after move |
| lock/CAS | existing owner contract/update/status tests | after move assert locked read, conflict and authoritative version/readback |
| audit | existing command contract fixtures | after move assert action/allowed changes/cardinality |
| rollback/no partial write | existing acceptance coverage, not module-only proof | final backend acceptance real business oracle; no status/DB-count substitution |
| effective SQL | no historical runtime before artifact | post-move after capture plus complete source/data-flow ledger; any tier-2 unknown stays explicit |
| self-call/proxy | static source only before move | per execution method-family matrix plus focused proof where boundary changes |

## 6. M-01 raw SQL / fragment boundary

Current public raw-SQL/fragment scan of the B9 source found no public method in the four execution services that accepts a `String sql`
parameter; the raw execution is private in the current services. The facade helper
`BusinessChannelOwnerService.channelCommandSelect(String suffix)` and
`BusinessChannelQuerySupport.channelSelect/channelProjection(String ...)` are nevertheless SQL composition points and are included in this
matrix. They must move behind package-private persistence support; no application/domain caller may pass SQL text, fragment, wrapper, mapper or
generic varargs into a public persistence method.

Target public persistence method rule:

- read methods receive business query inputs such as filter/sort/page/target and perform all SQL condition selection/combination internally;
- write methods receive aggregate/command objects and field values, plus server-side version/time values where the owner already owns them;
- SQL fragment names such as `suffix`, `whereFragment`, `orderFragment`, `tableName`, `refColumn` and SQL wrapper types are not business parameters;
- `BusinessChannelQuerySupport` must not remain an application-level SQL fragment producer after B9.

## 7. CP-0 status and entry gate

- Pre-write behavior pin: `PASS` — managed remote run `r5-tc-1789290667377-85794`.
- Current matrix state: `OPEN_UNTIL_FRESH_INDEPENDENT_RECONCILIATION`.
- Required next step: fresh read-only independent reviewer must compare this matrix with the requirements, implementation design/plan, memory/standards and current source, and either return `STEP_RECONCILIATION=MATCHED` or preserve first finding.
- No production B9 source may be written while this CP-0 reconciliation is `OPEN`.
