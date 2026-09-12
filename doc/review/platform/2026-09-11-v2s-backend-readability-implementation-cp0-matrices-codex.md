# Backend owner 可读性整改 · CP-0 当前字节矩阵记录

```text
REVIEW_TARGET=IMPLEMENTATION_CP0
AUTHORITY=DEXTER_IMPLEMENTATION_AUTHORIZED
REVIEW_CYCLE=IMPLEMENTATION
RUNTIME_ACTION=NOT_RUN
SOURCE_OF_TRUTH=CURRENT_REPOSITORY_BYTES
```

## 1. CP-0 边界

本记录只冻结实施前的当前源码输入，不把静态事实升级为行为 PASS。实施范围仍严格受
[implementation-facing 详设](../../plans/platform/2026-09-11-v2s-backend-readability-implementation-design-codex.md) 与
[实施计划](../../plans/platform/2026-09-11-v2s-backend-readability-implementation-plan-codex.md) 约束：五个 facade 的职责拆分；不做全量 SQL 归位、契约/generated、migration、前端、L2 spec、测试文件切分或新框架/base class。

写入前已重新打开正式需求、详设、计划、backend coding standard、foundation charter、backend acceptance standard、observability standard、独立审查治理、六维 memory 命中原文及五个 owning source。本文仅记录可复核结果与仍需 CP-1 关闭的行为覆盖状态。

## 2. 候选全集与目标 family

当前枚举命令为：

```bash
find apps/backend/catering-business-server/modules -type f \
  \( -path '*/src/main/java/*/application/*Service.java' \
     -o -path '*/src/main/java/*/application/*Coordinator.java' \) | sort
```

当前输出为 62 个文件。逐文件判定继续以详设 §3 为准；`CatalogInventoryCoordinator` 与 edge 侧
`ExternalCollaborationBusinessChannelCoordinator` 仍是 coordinator，未纳入五个 facade 拆分。

五个 facade 的实施目标仍为：

| owner | SPLIT target | facade 保留的公开边界 |
| --- | --- | --- |
| Catalog | `CatalogWorkbenchReadService`、definition 三类 service、`CatalogCommandRouter`、`CatalogCategoryService`、`CatalogDictionaryService`、`CatalogItemService`、`CatalogCopyService` | `CatalogOwnerService`、`CatalogOwnerApi`、`CatalogTemporaryPromotionOwner` |
| Inventory | `InventoryAvailabilityService`、`InventoryTargetService`、`InventoryReadRouter`、`InventoryCommandRouter`、`InventoryCatalogLifecycleService`、`InventoryBomService`、`InventoryCopyService` | `InventoryOwnerService`、`InventoryOwnerApi` |
| BusinessEntity | `BusinessBrandService`、`BusinessTenantService`、`HeadCompanyService`、`StoreService`、`BusinessEntityCommandRouter`、`BusinessEntityTaskReadService` | `BusinessEntityService` 及其公开异常/record FQCN |
| BusinessChannel | `BusinessChannelTemplateService`、`BusinessChannelService`、`BusinessChannelTaskReadService` | `BusinessChannelOwnerService`、三项既有 API |
| SalesMenu | `SalesMenuDefinitionService`、`SalesMenuSectionService`、`SalesMenuItemService`、`SalesMenuPublicationService`、`SalesMenuManualSaleService`、`SalesMenuOperationRecordService` | `SalesMenuOwnerService`、`SalesMenuCommandApi` |

## 3. 方法族与调用方矩阵摘要

完整 family map 以详设 §7.2 为准；本轮从当前 source declaration 与方法签名重新读取。直接生产代码没有依赖五个 concrete owner 类型（`BusinessEntityService` 的既有生产注入除外，且 facade FQCN 保留），其余 owner 间调用、edge controller、operation handler 均通过既有 API 接口。当前 production concrete 注入点包括：

- `BusinessEntityService`：organization task-read、contract/organization edge controllers 与 overview service；公开 facade 类型必须保持不变。
- `CatalogOwnerService`、`InventoryOwnerService`、`SalesMenuOwnerService`、`BusinessChannelOwnerService`：生产代码命中的是对应 owner API，未发现 `new` concrete 或 concrete field 注入。
- 测试中五个 facade 均有直接 `new`；测试 fixture 不切文件，CP-1/对应 CP 只调整 composition constructor 或 facade 的测试便利构造器。
- `ContractProblemAdvice` 直接引用 `BusinessEntityService` 的公开异常；异常 FQCN 与 mapping 不迁移、不重命名。
- 包内 `CatalogTemporaryPromotionOwner` 仍由 facade 实现；目标类不得移动该接口导致 package-private 解析断裂。

## 4. 事务、自调用与持久化矩阵

下表记录当前源码中会影响拆分事务承接的 self-call；普通 private helper 调用不作为事务代理证据，必须按 family 随同其事实 owner 移动。自调用判定采用去除注释/字符串后的当前 Java 成员方法扫描，并回读原始行确认。

| source | 当前 self-call / 调用点 | 外层 transaction attributes | 拆分处理 |
| --- | --- | --- | --- |
| `CatalogOwnerService` | `write` → `executeWrite`（generic operation router）；`executeWrite` 在 2226–2232 行派发 `createCategory/updateCategory/moveCategory/transitionCategoryStatus` | `write` 在 839–850 行为 `@Transactional`；7 个 generic write caller（842、862、924、945、961、986、1003 附近）均已在既有 transaction 边界进入 | `CatalogCommandRouter` 保留 protocol dispatch 外层属性，category 派发改为 target bean 调用；不得依赖 facade self-invocation。`preflightBrandCopy`→`preflightCopy`、asset/reference 与 query-validator 均在同一 read/copy family 或走纯静态兼容入口。 |
| `InventoryOwnerService` | local/brand copy 的 preflight/execute→copy；`targets`→纯 query validator | copy family 内部保持同一 target；validator 仍是 facade FQCN 的纯值兼容入口 | 不跨 target 借事务；generic read/write router 直接调用对应 target。 |
| `SalesMenuOwnerService` | `claimStagedAssets`→`requireSalesMenuItemAssetTarget`；command overload 进入同名 public protocol method | asset target 与 item family 同一 owner 事务上下文；`SalesMenuCommandApi` overload 当前没有通过 facade 借代理的必要 | item target 直接持有 asset target 依赖；command overload 直接进入对应 target bean。 |
| `BusinessEntityService` | direct head-company status→generic transition；generic overload 间的 dispatch；pageBrands/pageEntities→pageBusinessEntities；read helper→requireEntity | direct/generic transition 的当前 `@Transactional` 属性必须逐签名保留；read helper 没有独立事务代理 | generic router 只做闭集 dispatch；实体 target 与 task-read target 通过显式依赖调用，不把事务注解扩散到 facade。 |
| `BusinessChannelOwnerService` | 当前未发现跨方法族的事务 self-call；模板、channel、task-read 主要调用 private projection/helper | public read 为 `@Transactional(readOnly=true)`，command 为 `@Transactional` | 三个 target 各自保留原 public annotation；共享 projection helper 不改变锁、CAS、receipt 或 readback 顺序。 |

### 4.1 按方法族的事务承接索引

上一版表按 facade 汇总，不能证明拆分后的每个方法族仍承接原事务形态。本表以详设 §7.2 的每个 family 为行，
入口名称直接取当前 target declaration；`默认` 表示无显式参数的 `@Transactional`，`REQUIRED` 表示显式保留
`propagation = Propagation.REQUIRED`，`无注解` 表示当前源码没有该注解。原侧输入为拆分前 facade 的 `HEAD` 字节，
现侧输入为当前 target 字节；同一行的事务形态必须保持一致，不能用 facade 的转发方法是否有注解代替。

| familyId | 当前入口（overload 按当前 declaration 展开） | 当前 target | 原/现事务形态 | self-call / 承接结论 |
| --- | --- | --- | --- | --- |
| `catalog.workbench-read` | `readWorkbenchContext/readNavigation/readItems/readCategoryCandidates/readInventoryDisplayFacts/readInventoryTargetDisplayFact/readSalesMenuCandidatePage/readSalesMenuItemFacts/readSalesMenuItemReferenceFacts` | `CatalogWorkbenchReadService` | 无注解 | 无事务 public self-call；保持 task-read 调用位置。 |
| `catalog.definition.attribute` | `listAttributeDefinitions/createAttributeDefinition/updateAttributeDefinition/transitionAttributeDefinitionStatus` | `CatalogAttributeDefinitionService` | list 无注解；后三个默认 | 仅同族 private helper；三项 mutation 由 target bean 承接默认事务。 |
| `catalog.definition.unit` | `listUnitDefinitions/createUnitDefinition/updateUnitDefinition/transitionUnitStatus` | `CatalogUnitDefinitionService` | list 无注解；后三个默认 | 仅同族 private helper；不借用其他 definition target 事务。 |
| `catalog.definition.order-option` | `listOrderOptionDefinitions/createOrderOptionDefinition/updateOrderOptionDefinition/transitionOrderOptionDefinitionStatus` | `CatalogOrderOptionDefinitionService` | list 无注解；后三个默认 | 仅同族 private helper；option 校验与 readback 留在本族。 |
| `catalog.operation-router` | `write` → package-private `route` | `CatalogCommandRouter` | router `route` 默认；facade write 为外层协议入口 | `write→executeWrite` 只保留协议 dispatch；具体 mutation 改为 target bean 调用，不能依赖 facade self-invocation。 |
| `catalog.category` | `createCategory/updateCategory/moveCategory/transitionCategoryStatus` | `CatalogCategoryService` | 四项默认 | 原 category generic dispatch 的外层已记录在上一行；目标内不新增跨族代理依赖。 |
| `catalog.dictionary` | `readDictionary/createDictionaryEntry/updateDictionaryEntry/reorderDictionaryEntries/transitionDictionaryEntry` | `CatalogDictionaryService` | read 无注解；四项 mutation 默认 | `write/executeDictionaryWrite` 只属 dictionary；不跨族共享事务 helper。 |
| `catalog.item-read` | `readItem/readItemSkus` | `CatalogItemService` | 无注解 | 无 public 事务 self-call；保持原 read shape。 |
| `catalog.item-command` | `createCatalogItem/transitionCatalogItemStatus/transitionCatalogItemStatuses/saveCatalogItem` | `CatalogItemService` | 四项默认 | batch 内部的编程式子事务不由 facade 重新包装，按原调用顺序保留。 |
| `catalog.temporary-promotion` | `preflightTemporaryCatalogItemPromotion/executeTemporaryCatalogItemPromotion/executeTemporaryCatalogItemPromotionWithProjection` | `CatalogItemService` | 三项默认 | 同族 receipt/projection helper；不把 promotion 事务移入 copy 或 workbench。 |
| `catalog.copy` | `readLocalCopyCandidates/readBrandCopyCandidates/readShapeManifest/copy/preflightCopy/preflightLocalCopy/prepareLocalCopy/executeLocalCopy/preflightBrandCopy/prepareBrandCopy/executeBrandCopy` | `CatalogCopyService` | candidate/manifest 无注解；preflight/prepare 为 readOnly；copy/execute 为默认 | `preflightBrandCopy→preflightCopy` 仍是同族调用；不跨 target 借代理。 |
| `catalog.query-validation` | `validateItemPageQuery` | `CatalogOwnerValueSupport`；`CatalogOwnerService` 与 `CatalogWorkbenchReadService` 兼容入口均转发 | 纯静态，无注解 | 共享一份纯值校验实现；兼容 FQCN 不承接事务、不保留重复实现。 |
| `catalog.reference-read` | `resolveCatalogItemRef/catalogItemReferencedByOtherItems/itemExists/productionTagReferenced/assetReferenced/assetReferencedAnywhere/assetRefsStillReferenced/readAssetReferences/requireAssetUnreferencedAnywhere/inventoryConsumptionReferences/skuNamesByItemCodes` | `CatalogItemService` | 除 `skuNamesByItemCodes` 外为 readOnly；后者无注解 | 只读 reference family；无跨族事务 self-call。 |
| `inventory.availability` | `readSalesMenuAvailability` | `InventoryAvailabilityService` | readOnly | 只读 bean-to-bean owner read；不写人工销售状态。 |
| `inventory.query-validation` | `validateTargetPageQuery` | `InventoryOwnerService` + `InventoryTargetService` 的纯值校验实现 | 纯静态，无注解 | 兼容 FQCN 只转发纯值校验，不承接事务；当前源码没有 `InventoryOwnerValueSupport` 类型。 |
| `inventory.target-read` | `readTargets/readTarget/readTargetChangeSummary/readTargetBusinessHistory/readTargetConsumptionReferences/readTargetLedger/readTargetDiagnostics` | `InventoryTargetService` | 无注解 | 无 public 事务 self-call；查询不反向决定 mutation 聚合。 |
| `inventory.operation-read-router` | `read` | `InventoryReadRouter` | 默认 | router 只做闭集 dispatch；目标 read 仍由原 target 负责。 |
| `inventory.target-command-router` | `write`（两个 overload） | `InventoryCommandRouter` | 两项默认 | router 的外层属性保留，具体 target mutation 为 bean-to-bean 调用。 |
| `inventory.target-mutation` | `countTarget/increaseTarget/adjustTarget/updateTargetConfiguration` | `InventoryTargetService` | 四项默认 | lock/CAS/ledger/readback 同族保留，不跨 availability/lifecycle 借事务。 |
| `inventory.catalog-lifecycle` | `validateCatalogUnitLifecycle/validateCatalogItemBaseMeasureUnitTransition` | `InventoryCatalogLifecycleService` | 两项默认 | 只读 Catalog 依赖校验的 owner 事务边界保持；不写 Catalog。 |
| `inventory.catalog-dependency` | `catalogItemVoidDependencies/catalogSkuVoidDependencies/catalogSkuVoidDependenciesByRefs/catalogItemVoidDependencies/catalogVoidDependencies/catalogVoidDependenciesByRefs/catalogReferenceDependencies/catalogReferenceDependenciesByRefs` | `InventoryCatalogLifecycleService` | 全部 readOnly | 同族 dependency read；不由 target-read 或 BOM 代承事务。 |
| `inventory.catalog-retirement` | `retireCatalogVoidInventoryDefinitions/retireCatalogVoidInventoryDefinitionsForBatch` | `InventoryCatalogLifecycleService` | 两项默认 | 通过既有 Catalog owner command 完成跨 owner 协作；不把写入移入共享 helper。 |
| `inventory.bom` | `readCatalogInventoryDefinition/readCatalogInventorySummary/readCatalogInventoryConsumptionTargetCandidates/ensureCatalogInventoryTarget/saveCatalogProductBom/ensureCatalogItemSaveTarget/saveCatalogItemProductBom/replaceCatalogInventoryRules/resolveCatalogMaterialStockTarget/resolveCatalogMaterialStockTargets/deleteCatalogOptionValueBoms/copyCatalogOptionValueBoms` | `InventoryBomService` | definition/summary 无注解；candidate readOnly；其余默认 | overload 只在 BOM 同族内派发；关系写入与 readback 保持原顺序。 |
| `inventory.copy` | `copy/preflightCopy/preflightLocalCopy/prepareLocalCopy/executeLocalCopy/preflightBrandCopy/prepareBrandCopy/executeBrandCopy` | `InventoryCopyService` | copy/execute 默认；preflight/prepare readOnly | preflight/execute 同族 self-call 不跨 target；mapping/receipt/CAS 保持。 |
| `business-entity.direct-command` | `createBrand/updateBrand/transitionBrandStatus/createTenant/updateTenant/transitionTenantStatus/createHeadCompany/updateHeadCompany/transitionHeadCompanyStatus/createStore/updateStore/transitionStoreStatus` | `BusinessBrandService` / `BusinessTenantService` / `HeadCompanyService` / `StoreService` | 全部默认 | 各实体 target 承接原 direct command；generic router 不复制实现。 |
| `business-entity.generic-router` | `createEntity/updateEntity/transitionEntityStatus`（全部 overload） | `BusinessEntityCommandRouter` | router 无注解；目标 direct command 为默认 | generic overload 只做闭集 dispatch；事务在实际 entity target bean 上开始。 |
| `business-entity.store-overload` | `createStore/updateStore/addHeadCompanyBrandAuthorization/removeHeadCompanyBrandAuthorization`（全部 overload） | `StoreService` / `HeadCompanyService` | 全部默认 | Store/HeadCompany 授权与 scope 事务不跨 entity target 共享。 |
| `business-entity.task-read` | `authorizedBrands/authorizedBrandsByHeadCompanyIds/authorizedBrandAuthorizations/isEnterableStore/requireSalesMenuStore/resolveCatalogBrand/requireCatalogCopySource/resolveCatalogCopySource/isEnterableEntity/describeEntityPath/requireStoreContractContext/requireStoreContractContextForCreate/requireEntity/requireCommercialGroupId/requireProjectId/requireStoreProjectId/readStoreUpdateFacts/listEntities/pageBrands/pageEntities/pageBusinessEntities/requireBusinessEntity/requireEntities` | `BusinessEntityTaskReadService` | 大多数 readOnly；`requireStoreContractContextForCreate` 默认；`resolveCatalogCopySource/requireStoreProjectId/readStoreUpdateFacts` 无注解 | 逐方法保留混合形态；不把 task-read 全部统一加事务或 readOnly。 |
| `business-channel.template` | `pageTemplates/pageStoreTemplateCandidates/pageTemplateVisibleStores/readTemplate/readTemplateCommandContext/createTemplate/updateTemplate/transitionTemplateStatus` | `BusinessChannelTemplateService` | five read 为 readOnly；three mutation 默认 | 模板关系、CAS、readback 同族；无 channel 事务 self-call。 |
| `business-channel.channel` | `pageChannels/readChannel/readChannelCommandContext/createChannel/updateChannel/transitionChannelStatus/detachChannelBinding` | `BusinessChannelService` | three read 为 readOnly；four mutation 默认 | channel mutation 只通过 template 的公开/package-private eligibility 事实复用，不复制事务。 |
| `business-channel.composed-read` | `readChannelWithTemplateProvider/findChannelsForBinding/listSalesMenuEligibleChannels/requireSalesMenuChannel/salesMenuChannelBelongsToStore` | `BusinessChannelTaskReadService` | 全部 readOnly | 组合 read 与 SalesMenu eligibility 不写 channel/template 事实。 |
| `sales-menu.collection` | `listMenus/readMenu/create/copy/rename/archive/setActivation/updateSchedule` | `SalesMenuDefinitionService` | two read 无注解；six mutation 为显式 REQUIRED | overload 直接进入 target；menu lock/CAS/receipt/readback 同族保留。 |
| `sales-menu.section` | `listDraftSections/listPublishedSections/createSection/renameSection/deleteSection/moveSection` | `SalesMenuSectionService` | two read 无注解；four mutation 为显式 REQUIRED | section lock/order 只在 section target；无跨族锁代理。 |
| `sales-menu.item` | `listDraftItems/readDraftItem/listPublishedItems/readPublishedItem/listItemCandidates/addItems/updateItem/deleteItem/moveItem/requireSalesMenuItemAssetTarget` | `SalesMenuItemService` | five read/asset 无注解；four mutation 为显式 REQUIRED | `claimStagedAssets` 与 asset target 为 item 同族；command overload 不借 facade 代理。 |
| `sales-menu.publication` | `publicationPreview/publish` | `SalesMenuPublicationService` | preview 无注解；publish 显式 REQUIRED | immutable snapshot 与 stale-child 清理同族；不把 publication state放入 read model。 |
| `sales-menu.manual-sale` | `setManualSoldOut/restoreManualSale` | `SalesMenuManualSaleService` | 两项显式 REQUIRED | ITEM/SKU/ORDER_OPTION_VALUE 状态与库存事实分离，receipt/CAS/readback 同族。 |
| `sales-menu.operation-record` | `listOperationRecords/recordRejectedOperation` | `SalesMenuOperationRecordService` | list 无注解；record 显式 REQUIRED | failure record 独立承接；不由 manual-sale target 代写。 |

本表的验证动作是：以 `git show HEAD:<facade>` 读取拆分前 annotation，再以当前 target declaration 对照每个入口；对混合 family
逐入口记录而不把 `@Transactional(readOnly=true)`、默认事务和无注解合并。self-call 只在会改变 Spring proxy 边界的调用处列出，
普通 private helper 的归属仍按其唯一事实 owner 对账。该表关闭的是 S-02 的**证据粒度**，不是把静态 annotation 存在升级为运行期事务行为 PASS；
事务 rollback、锁顺序、幂等 replay 和 readback 仍以对应 CP focused/business evidence 为准。

五个 source 的 current member scan 也确认：所有新增 target 必须保留原 `@Transactional` 完整属性；Catalog 的编程式
`PROPAGATION_REQUIRES_NEW` 不受 bean 边界影响，仍归 item/status family。JDBC、lock、receipt、CAS、audit、owner command 与 readback
必须只由真实事实 owner 持有，不以 facade 或万能 base 共享。

## 5. 测试覆盖矩阵状态

CP-0 只登记覆盖状态，不以文件名、method/class token、异常类型、HTTP status 或 DB operation 数冒充 behavior oracle。当前可直接从源码确认的测试资产与需 CP-1 逐风险维度关闭的缺口如下：

| family | 现有可复用测试资产 | CP-1 需要确认/补齐的真实 oracle |
| --- | --- | --- |
| Catalog definition/category/dictionary | category、dictionary reorder、owner API/application tests | scope、CAS/status、hierarchy lock、problem、authoritative readback；逐 method family 未以 token 命中升级为覆盖 |
| Catalog item/status/promotion/copy | batch status、receipt concurrency、asset/reference、temporary promotion/copy tests | replay/conflict、`REQUIRES_NEW` partial/unknown failure rollback、lock order、owner dependency、post-readback |
| Inventory availability/target/lifecycle/BOM/copy | typed CAS、ledger、BOM、reference dependency、copy、sales-menu availability tests | target scope/CAS/lock、ledger/BOM atomicity、cross-owner retirement、mapping replay/conflict、relation readback |
| SalesMenu definition/section/item | owner API、read-model、ordering/query tests | version ordering、SKU/option/asset readback；不切分既有测试文件 |
| SalesMenu publication/manual/operation record | owner/read-model 与全量 acceptance 场景资产 | immutable snapshot、三级 manual target 独立事实、stale child、failure record readback |
| BusinessEntity entity targets/router/task-read | organization owner/store/contract/sales-menu/task-read tests | generic type dispatch、CAS/status、authorization、公开异常到 advice 的业务失败映射与 readback |
| BusinessChannel template/channel/task-read | policy、command/query、sales-menu owner tests | template/channel 分离、visibility relation、provider revalidation、binding/candidate readback |

状态解释：已存在测试资产只作为候选入口；未在 CP-1 以真实 fixture/request/positive oracle/negative oracle/write-readback 逐点核实的维度仍为
`UNVERIFIED_REQUIRES_EVIDENCE`，不能由后续全量 acceptance 追认。CP-1 的最小补齐不改变 Journey、HTTP contract、数据库模型或测试文件拓扑。

## 6. CP-0 结论

- 62 个候选均已有详设判定；五个 facade 的 family map、目标类、公开 FQCN、生产 caller 与 Spring 边界已重开。
- self-call 列已补齐五个 SPLIT 目标；已识别的 Catalog generic router 风险明确由 bean-to-bean target dispatch 处理。
- 当前没有把缺少行为覆盖误报为已覆盖；剩余行为项进入 CP-1，不能跳过。
- CP-0 只产生本记录，不启动 DEV、reset、seed、backend acceptance 或 browser L2。

`CP-0_STATUS=READY_FOR_CP-1`
