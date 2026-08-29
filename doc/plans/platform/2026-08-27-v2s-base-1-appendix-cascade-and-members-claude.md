# base-1 附件 · 级联关系分母与装配成员矩阵

- 作者:Claude · 2026-08-27
- 主文:`doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md`
- 性质:**分母与成员清单**,不含规则。规则正本在主文与 `doc/platform/backend-coding-standard.md`
- 本附件在需求稿转 GO、形成实施面设计、或开始任何代码/契约/迁移实施**之前**必须完成签入

## 一、级联关系分母(对应主文 §3.2)

判据:**两侧都有生命周期状态,且该对象的可用性判断需要参考对方**。据此从 FK 图与自引用列穷举,再剔除流程状态机。

⚠️ **本表列的是"有哪些维度",不是"合并后是否可用"。** 按主文 §3.2,owner 把**每个维度的状态各自作为事实返回**,⛔ 不合并成单值;**哪些维度的哪种组合允许做什么,由应用场景决定**(见主文适用矩阵)。下表"含义"一列描述的是该维度在业务上代表什么,**不是一条合取规则**。

### 1.1 维度关系(每条各自作为独立状态事实返回)

| 对象 | 维度来源 | 关系来源 | 该维度事实的含义 |
| --- | --- | --- | --- |
| `catalog.catalog_sku` | `catalog.catalog_item` | FK | 商品停用/已删除 ⇒ 其规格**业务上不可用**,UI 仍显示规格自身状态 |
| `catalog.catalog_composite_component` | `catalog.catalog_item` | FK | 组件所引用的商品状态,作为该组件的一个维度事实 |
| `catalog.catalog_composite_component` | `catalog.catalog_sku` | FK | 同上,规格粒度 |
| `catalog.catalog_category` | 自身 `parent_category_ref` | **自引用树** | 祖先分类停用/已删除 ⇒ 后代分类不可用。**FK 图抓不到,必须单列** |
| `organization.organization_node` | 自身 `parent_id` | **自引用树** | 大区停用 ⇒ 其下项目不可用。**FK 图抓不到** |
| `organization.store` | `organization.organization_node`(项目) | FK | 项目状态,作为门店的一个维度事实 |
| `organization.store` | `organization.tenant` | FK | 承租租户状态,作为门店的一个维度事实 |
| `organization.store` | `organization.brand` | FK | 品牌状态,作为门店的一个维度事实 |
| ~~`organization.store` → `organization.head_company`~~ | —— | **不构成阻断维度**(Dexter 2026-08-27 确认按 G-03 既有裁定读,非新裁定) |

> **总公司不是门店的阻断维度。** 两条独立依据:G-03 明写总公司「只发布品牌侧商品信息/资料模板、查看门店经营结果」「**不干涉门店经营**」;且 `organization.store.head_company_id` 实测**可空**(建表行无 `NOT NULL`,全仓无 `SET NOT NULL`),G-03 亦写明「每个门店**可选关联 0..1 个总公司**」 —— 一个没有总公司的门店照常经营,那"有总公司但总公司停用"的门店没有理由更差,否则填了可选字段反而更脆弱。
>
> ⚠️ **不要与准入校验混淆**:G-03 的「选择时须满足该总公司对该品牌的有效授权」是**创建门店时的准入**,保留;与"停用后是否阻断既有门店"是两件事。
>
> 总公司停用只影响**总公司自己那条 IAM 访问链**(该总公司的用户进不来、看不到门店经营结果),仍作为一个维度事实返回。
| `business_channel.business_channel` | `business_channel.business_channel_template` | **非 FK 的 `template_ref`** | 模板状态,作为渠道的一个维度事实。**对应原 `CASCADE_TEMPLATE`** |
| `business_channel.business_channel_template` | 模板的 `project_ref`(组织节点) | **列引用,非 FK** | 模板所属项目状态,作为模板的一个维度事实。**此前完全遗漏** |
| `business_channel.business_channel` | 渠道的 `target_node_ref`(`target_node_type` 为 `PROJECT` 或 `STORE`) | **列引用,非 FK** | 渠道目标项目/门店状态,作为渠道的一个维度事实;门店还要继续向上串到项目/租户/品牌。**此前完全遗漏** |
| `business_channel.business_channel` | **external system / provider profile** | 跨模块,经 collaboration owner | **`CASCADE_EXTERNAL` 的真实触发源是 external system 或 provider profile 停用**(`ExternalCollaborationBusinessChannelCoordinator` 第 183–230 行按 `externalSystemCode` 过滤 `providerProfiles` 并逐个 `applyStopForProvider`) |

> ⚠️ **本表此前有一处错误已更正**:曾把 `CASCADE_EXTERNAL` 的父项写成 `collaboration.owner_binding`。**binding 删除走的是另一条路径** —— 第 74–105 行是"渠道退回草稿",不是级联停用。**binding 的待裁项已撤销。** 按「维度不合并」原则(主文 §3.2),binding 的状态就是一个维度、就是一个事实,**必须作为独立事实返回**;它在哪些场景构成阻断,由那些场景各自定义,不需要先决定它进不进某个合取。

### 1.2 workspace 级联(此前写"六次实例",实测远不止)

`platform_workspace.group_workspace` 自身有 `ENABLED/DISABLED` 状态。**直属它、且自身带生命周期状态的对象至少十三个**:

- **organization 域**:`organization_node`(大区/项目)、`brand`、`tenant`、`head_company`、`store`
- **workspace-iam 域**:`workspace_account`、`workspace_role`
- **business-channel 域**:`business_channel`、`business_channel_template`
- **collaboration 域**:`external_system_enablement`、`owner_binding`、`provider_profile_enablement`
- **extension 域**:`extension_definition_field`

集团空间的状态,是这十三类对象各自的**一个维度事实**。⛔ 不得把它与对象自身状态合并;各场景自行决定该维度在本场景是否构成阻断。**十三类的取事实方式应统一实现,而不是各写一遍。**

⚠️ **此前只列了六个(business-channel 二、collaboration 三、extension 一),漏掉了 organization 五个与 workspace-iam 两个。** 照旧清单实施,集团空间停用后这七类对象仍会被判定为有效。

### 1.3 剔除项(不是级联,是流程状态机或非主数据)

| 表 | 剔除理由 |
| --- | --- |
| `platform_iam.platform_otp_grant` → `platform_admin` | OTP 是流程状态机(`ACTIVE/USED/SUPERSEDED`),非主数据 |
| `platform_iam.platform_password_recovery_flow` → `platform_admin` | 流程状态机 |
| `platform_iam.platform_session` → `platform_admin` | 会话 |
| `platform_iam.platform_command_receipt` → `group_workspace` | 幂等回执,非主数据 |
| `inventory.stock_target` / `stock_bom` | `definition_status` 的 DISABLED 是**不可逆历史快照**,非主数据(见主文 §5.1) |

### 1.4 已知盲区

FK 图只能抓到显式外键。**`template_ref` 与跨模块的 collaboration 引用都不是 FK**,是靠读代码补上的;可能还有同类的非 FK 引用未被发现。实施前应由 owner 侧逐个模块自查一遍,不得以本表为穷尽。

## 二、装配成员矩阵(对应主文 §1.1、§2)

按**机制**分类。⚠️ 计数受工具影响:本机 `LANG=""`,BSD `grep` 对 CJK 静默返回 0;下列均以 locale 无关方式重扫。

### 2.1 Java 层 `+` 拼接(含 CJK)

37 行 / 11 个文件。分布:`CatalogOwnerService` 20、`CatalogItemDefinitionFacts` 5、`CatalogInventoryCoordinator` 3、`CatalogPreparationFacts` 2,`CatalogSkuFacts` / `CatalogDefinitionFacts` / `CatalogSkuVariantAxisFacts` / `InventoryOwnerService` / `ProductionTagOwnerService` / `ContractProblemAdvice` / `PlatformCommercialGroupController` 各 1。

**其中相当一部分是 `Problem` 错误文案** —— 按主文 §1.6 在原则内但不在 base-1 范围,须在成员表里逐条标注,不得混入本批工作量。

### 2.2 Java 层分隔符拼接(不含 CJK)

`OrganizationTaskPathService` 10、`BusinessEntityService` 3、`OrganizationOverviewTaskReadService` 3、`OrganizationHierarchyService` 1、`OrganizationCommandService` 1。

### 2.3 Stream 层

- `Collectors.joining`:`PlatformContractOverviewController` 第 146、174 行 → `itemSummary`
- `.reduce((a,b) -> a + sep + b)`:`PlatformWorkspaceInvitationTaskReadService` 第 93 行、`WorkspaceInvitationService` 第 1203 行 → `invitationPageUrl` 一族。⚠️ **同文件第 1424 行的 `.reduce` 不在本分母内** —— 它位于 `canonical(String operation, Object... values)`,序列化 request/幂等复合键,按主文 §1.7 归"非人读复合串"豁免;按装配整改它会破坏 request canonicalization 与幂等 replay

### 2.4 SQL 层

- `CollaborationOwnerService` 第 200、204、205、210、215、216 行 → `nodeDisplayName` / `nodeDisplayPath`,**含全角括号的「名称(编码)」**
- `OrganizationAssignmentCandidateService` 第 244、268、270 行 → `display_path` / `project_path`
- `OrganizationHierarchyService` 第 1294 行

### 2.5 后缀字段四分类(对应主文 §2.3)

按契约 `properties` 名去重实测 33 个(按 schema 出现次数计为 41;**口径差异是此前计数不一致的原因,以去重数为准**)。四类:

1. **代码定义的闭集 → 前端建字典**:13 个(business-channel 7、collaboration 6；包含 `nodeTypeDisplayName`，契约响应 enum 与 owner 代码共同背书)
2. **实体名字 → 后端返实体,不是病**:`bindingDisplayName`、`externalSystemDisplayName`、`providerDisplayName`、`productionDisplayName` 等
3. **装配产物 → 按机制删装配**:`categoryPathLabels`、`blockingReferenceLabels`、`relationLabel`、`actionGroupLabel`、`businessScopeDisplayNames`、`stopReasonDisplayNames`、`itemSummary`
4. **时点快照 / 结构化聚合 → 保留**:`actorDisplayName`、`auditSummary`(§0.1 例外);`skuSummary`、`inventoryDeductionSummary`、`changeSummary`、`conversionSummary`(§1.3 owner 拥有的结构化事实)

⚠️ **第 2、3 类是按字段名启发式分的,实施前必须逐个打开确认。** 第 1 类按 owner 代码定义的闭集与契约响应 enum 逐项背书,以 exact matrix 为准。

### 2.6 接口数量 consumer(对应裁定 17)

- `scripts/generate/backend-performance-budget.mjs` 第 10、210 行
- `scripts/generate/operation-handler-bindings.mjs` 第 19–25 行
- `contracts/policy/backend-performance-cp05-calibration-report.json`
- `scripts/test/r5-remote-testcontainers.mjs` 第 343、352、353、368、369 行
- `scripts/test/backend-performance-operation-reconciliation.mjs` 第 163、223、261、302、332 行
- `scripts/test/backend-performance-cp05-reclassification.mjs` 第 64–70、323、331、420、429 行

### 2.7 尚未穷举的

`edge mapper` 与 `checked-in static catalog` 两类的成员表**未产出**。前者需要逐个 mapper 核对哪些字段是 edge 计算而非 owner 返回,后者需要清点契约目录下的静态字典文件。**这两类是本附件的已知缺口,不得声称成员矩阵已完整。**
