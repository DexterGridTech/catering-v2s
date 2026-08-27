# base-1 · implementation-facing 详设与实施计划(Claude 独立版)

- 作者:Claude · 2026-08-27 · **与 Codex 版并行产出,未参考对方稿件**
- 需求正本:`doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md` 与同日 appendix
- 规则正本:`doc/platform/backend-coding-standard.md` 1-J 至 1-N、2-H、2-I
- 体例:`doc/decisions/templates/implementation-design-template.md`(含 §13b 三维对账)
- **本文不授权实施。** 详设产出不等于实施授权。

## 0 · 这份详设要兑现的四件事

Dexter 的四条要求,逐条对应本文的哪一部分:

| 要求 | 兑现处 |
| --- | --- |
| 极详细,SQL / 契约 / 前后端 / 测试四面全覆盖,不能跑测试才发现漏 | §2 四张分母全集表 —— **全集不是举例**,每项带精确路径 |
| 先完成后端整体验证再改前端 | §3 批次切分与过渡契约形态 |
| 旧代码要下线 | §4 退役清单 —— 删除,不留开关不留兼容层 |
| 实施 agent 有参照不走偏 | §5 每 CP 门控 + §6 三维对账节奏 |

## 1 · 分母扫描的方法声明(先说怎么扫的,再给结果)

需求评审阶段已证明:**凡用窄探针扫出的"零命中",后续都被推翻**。本文的分母因此按以下方式产出,请复核时用同样方式复算:

- **两个源码根都扫**:`modules/*/src/main/java`(210 文件)与 `src/main/java`(416 文件)
- **locale 无关**:本机 `LANG=""`,BSD `grep` 对 CJK **静默返回 0**;全部用 python 正则
- **DDL 三种形态都取**:内联 `CREATE TABLE` 的 CHECK、`ALTER … ADD COLUMN`、`ALTER … ADD CONSTRAINT`
- **契约按 `properties` 名去重**,并同时给出非去重口径

## 2 · 四面分母(全集)

### 2.1 SQL 面 · 全平台带状态列的表共 35 张,本批处理 14 张

| 类 | 表 | 现状 | 本批动作 |
| --- | --- | --- | --- |
| **A 已三态、但编码未释放** | `catalog.catalog_category` | `ENABLED/DISABLED/VOIDED`,inline `UNIQUE(data_node_ref, brand_ref, code)`,**无 partial index** | **补** partial index 排除 `VOIDED`。⚠️ 需求稿曾记为"已符合",**是错的** |
| **A 已三态且已释放** | `catalog.dictionary_entry`、`fulfillment_production.production_tag_definition` | 三态 + `ux_*_active_code WHERE status <> 'VOIDED'` | 零改动,仅复核 |
| **B 加 `VOIDED` + partial index** | `catalog.unit_definition` | 两态,`UNIQUE(data_node_ref, brand_ref, code)` | 加值 + 建 partial |
| | `organization.brand` | 两态,`uq_brand_code` | 同上 |
| | `organization.head_company` | 两态,`uq_head_company_code` | 同上 |
| | `organization.organization_node` | 两态,`uq_organization_node_code(含 node_type)` | 同上 |
| | `organization.store` | 两态,`uq_store_code` | 同上 |
| | `organization.tenant` | 两态,`uq_tenant_code` | 同上 |
| | `workspace_iam.workspace_account` | 两态,**两个唯一键** `uq_workspace_mobile` 与 `uq_workspace_login` | 加值 + **两个 partial 都要建** |
| | `workspace_iam.workspace_role` | 两态,`uq_workspace_role_name`(**按名称,不是 code**) | 加值 + partial 建在名称上 |
| | `business_channel.business_channel_template` | 两态,`uq_business_channel_template_project_code WHERE template_code IS NOT NULL` | 加值 + 谓词并入 `AND status <> 'VOIDED'` |
| **C 合并状态值** | `catalog.catalog_item` | 五态 `DRAFT/ENABLED/DISABLED/ARCHIVED/VOIDED`;`ux_catalog_item_active_code WHERE status <> 'VOIDED'` | `DRAFT→DISABLED`、`ARCHIVED→VOIDED`;索引谓词不变 |
| | `catalog.catalog_sku` | 四态;两个 partial 现为 `NOT IN ('ARCHIVED','VOIDED')` | `ARCHIVED→VOIDED`;两个谓词收敛为 `<> 'VOIDED'` |
| | `business_channel.business_channel` | `DRAFT/EFFECTIVE/DISABLED`;`uq_business_channel_group_channel_code WHERE channel_code IS NOT NULL` | `DRAFT→DISABLED`、`EFFECTIVE→ENABLED`、加 `VOIDED`;⚠️ **`DRAFT` 与现存 `DISABLED` 撞值,回填必须先分流再改 CHECK**;谓词并入 `AND status <> 'VOIDED'` |
| **D 新增状态列** | `catalog.catalog_attribute_definition` | **无状态列**;`UNIQUE(data_node_ref, brand_ref, code)` | 加列 + 回填 `ENABLED` + CHECK 三值 + partial index |
| | `catalog.catalog_order_option_definition` | **无状态列**;`uq_catalog_order_option_definition_scope_code` | 同上 |
| **E 死值清除** | `catalog.catalog_composite_component` | `ENABLED/DISABLED/ARCHIVED`,**无 code 列**,唯一约束是 `(composite_group_ref, display_order)` | **不进主数据清单、不建 partial index**;仅从 CHECK 删 `ARCHIVED`。⚠️ 前置:`CatalogOwnerService` 有两处 `component.status <> 'ARCHIVED'` 的生产查询须先处置;存量是否为零 **`UNVERIFIED`,需数据授权后核** |
| **F 列删除** | `business_channel.business_channel` 的 `stop_reasons` | `TEXT[] NOT NULL DEFAULT '{}'` | 整列删除,见 §4.2 |

**排除(裁定 11 与判据)**:`platform_workspace.group_workspace`、`platform_iam.platform_admin`、`collaboration.external_system_enablement`、`collaboration.provider_profile_enablement` 本轮不动;`inventory.stock_target` / `stock_bom` 的 `definition_status` 是不可逆历史快照、非主数据(索引 `WHERE definition_status='ENABLED'` **不得改**);其余 16 张是流程状态机或非主数据。

### 2.2 契约面

**退役 operation 5 个**(实测均存在):`deleteOperationsCatalogCategory`、`deleteOperationsCatalogUnit`、`disableOperationsCatalogUnit`、`deleteOperationsCatalogAttributeDefinition`、`deleteOperationsCatalogOrderOptionDefinition`。

**新增 operation 2 个**:`transitionOperationsCatalogAttributeDefinitionStatus`、`transitionOperationsCatalogOrderOptionDefinitionStatus`。

**净变化 −3**,当前总数 239 →(批次 1 新增后)241 →(批次 5 退役后)236。⚠️ **增与减同时发生**,必须先按裁定 17 把数量收敛到单一 canonical source 并同步六个位置,否则 `BUDGET_OPERATION_COUNT_INVALID`、`BP_U02_BINDING_COUNT_DRIFT`、`BP_U02_BINDING_EXACT_SET_DRIFT`、`BUDGET_PROJECTION_OPERATION_MISSING` 会同时红。

**枚举收窄**:`CatalogItemBatchStatusTransitionRequest.targetStatus` 与单条转状态由五值收为 `ENABLED | DISABLED | VOIDED`;`business_channel` 的 `DRAFT|EFFECTIVE|DISABLED` 同样收敛。

**响应字段删除 · 装配产物**:`preparationSummary`、`specificationOrOptionSummary`、`attributeSummary`、`categoryPathLabels`、`tagSummary`(catalog);`path` / `organizationPath`(organization 与 workspace-iam);`nodeDisplayName` / `nodeDisplayPath`(collaboration);`itemSummary`(contract);`invitationPageUrl`(workspace-iam)。

**响应字段删除 · 代码闭集 DisplayName(成员全集,此前只有计数)**

⚠️ **两个口径都写明,避免重蹈 33/41 那类分母争议**:**按域计 12 个字段**;**全局去重 11 个不同名字** —— 差异来自 `statusDisplayName` 在 business-channel 与 collaboration **各有一个同名但不同枚举的字段**,退役时**必须按域分别处理,不能当成一个**。
- business-channel 7:`accessKindDisplayName`、`bindingStatusDisplayName`、`dineInFormDisplayName`、`operatorKindDisplayName`、`orderKindDisplayName`、`ownerNodeTypeDisplayName`、`statusDisplayName`
- collaboration 5:`authenticationKindDisplayName`、`capabilityClassDisplayName`、`catalogStatusDisplayName`、`statusDisplayName`、`unbindKindDisplayName`

**响应字段改形**:`accountExists` 布尔 → 四态枚举 `ABSENT/ENABLED/DISABLED/VOIDED`(`workspace-access.schemas.json` 两个响应)。

**新增响应字段**:各对象的维度状态事实(见 §7)。

**每个契约改动的传导面**:openapi source → `contracts/openapi/**` 生成产物 → `contracts/catalog/catalogInventoryEdgeWire.ts` 与 `.java` → `apps/backend/.../edge/generated/wire/*` → `apps/frontend/*/src/app/api/generated/*` → design-byte 摘要链(`DESIGN_FIELD_DIGEST`、`designByteCoverage.fieldCount`)。**任一环不同步,`catalog-inventory-p1` 静态门必红。**

### 2.3 前端面 · 消费点全集

| 字段 | 手写文件 | 生成文件 |
| --- | --- | --- |
| `categoryPathLabels` | **7** | 1 |
| `organizationPath` | **6** | 2 |
| `accessKindDisplayName` | 4 | 1 |
| `nodeDisplayPath` / `invitationPageUrl` | 3 / 3 | 2 / 2 |
| `operatorKindDisplayName`、`bindingStatusDisplayName`、`authenticationKindDisplayName`、`capabilityClassDisplayName`、`preparationSummary`、`attributeSummary`、`specificationOrOptionSummary`、`tagSummary` | 各 2 | 各 1–2 |
| `stopReasons`、`itemSummary` | 各 1 | 各 1 |
| `accountExists` | 0 | 1 |

**新增前端工作**:两个 App 各建一份枚举字典(或从生成契约 `enum` 派生),覆盖上列 12 个(按域计,11 个不同名)闭集;`DRAFT`/`ARCHIVED` 的前端引用点(`BusinessChannelDetailDrawer` 第 160 行、`CatalogItemViewDrawer` 第 42/90/123 行、两个 generated 类型文件)同步收窄。

### 2.4 测试面

**backend-acceptance 现 80 条**(上限已去除):Catalog 38、Iam 10、Collaboration 9、BusinessChannel 7、Organization 7、CommercialContract 4、Asset 2、Extension 2、Audit 1。

受本批触及的场景文件:`deleteOperationsCatalog*` **4 个**、`DRAFT` **3 个**、`stopReasons` / `CASCADE_TEMPLATE` / `ARCHIVED` / `disableOperationsCatalogUnit` **各 1 个**。

**必须新增的场景(对应验收判据)**:既有引用豁免(停用定义后保存引用它的对象成功 / 改成另一个停用被拒)、账号四态 lookup(创建与完成两处拒绝 `DISABLED`)、维度事实返回(祖先停用后子对象自身状态不变且维度事实可读)、编码释放(作废后同 code 可重建)。

**其它测试面**:`BusinessChannelOwnerContractTest` 第 268 行;L2 blueprint 65 个 case;`catalog-inventory-seed-executor.mjs`(2963 行)。

## 3 · 批次切分 · 后端整体验证在前

### 批次 0 · 解除接口数量阻塞(不改任何业务行为)

把 `239` 与 `reads: 102` 收敛到单一人工维护的 canonical source,六个位置改为引用。**产出判据**:改一处数字,六个位置同时随动;`scripts/verify` 全绿。**不得引入自动派生**(裁定 17)。

### 批次 1 · 后端 · 生命周期(SQL + owner 内部)· **契约只增不减**

A–F 六类迁移;owner 侧改为写三态;**新增** `transitionOperationsCatalogAttributeDefinitionStatus` 与 `transitionOperationsCatalogOrderOptionDefinitionStatus`;`stop_reasons` 的**数据库列与 owner 写入**去除。

⛔ **本批不退役任何 operation、不收窄任何枚举、不删任何响应字段。**

> **初稿这里是错的,已更正。** 初稿把 5 个 operation 退役与枚举收窄放在本批,并声称"契约对前端兼容、前端零改动"。**实测反证**:五个待退役 operation 前端**各有一个手写文件在调**;`DRAFT`/`ARCHIVED` 在前端**至少八个手写文件**里(`CatalogWorkbenchController` 的状态数组、`catalogModel` 的 `CatalogBatchStatus` 类型、`if (row.status === 'ARCHIVED') return;` 等行为分支)。照初稿做,批次 1 结束前端当场崩,"后端整体验证再改前端"这条要求直接落空。

### 批次 2 · 后端 · 零拼装与维度事实 · **契约只增不减**

删除 Java / Stream / SQL 三层装配**代码**;新增结构化实体与各维度状态事实字段。

**旧装配产物字段如何过渡** —— 初稿写"保留最后一次值或由新结构派生",**那是自相矛盾的**(装配代码已删,旧字段无从取值;派生回去等于没删)。正确做法:**旧字段在本批保留声明但由 owner 返回 `null`,并在契约里标注 `deprecated`**;前端在批次 4 切走之前仍能读到字段、只是值为空,不会因字段缺失而解析失败。⛔ 不得为了给旧字段供值而保留任何装配代码。

### 批次 3 · 后端整体验证(不动任何代码)

`scripts/verify` 全绿;`backend-acceptance` 全部场景 `CONTRACT/BUSINESS` 双 PASS 且含本批新增场景;run-level operation budget verifier 通过。**此刻 operation 数为 241**(239 + 新增 2,尚未退役)。

**这是"先完成后端整体验证再改前端"的验收点** —— 未通过不得进入批次 4。此刻契约对前端**仍然可解析**(旧字段在、旧 operation 在、旧枚举值在),前端零改动。

### 批次 4 · 前端 · 切换

两个 App 建枚举字典;消费点从装配产物切到结构化实体与维度事实;`accountExists` 四态;**改调 `transitionStatus` 不再调 `delete*`**;状态分支去掉 `DRAFT`/`ARCHIVED`。

### 批次 5 · 契约面下线(唯一的破坏性批次)

退役 5 个 `delete*` / `disable*` operation;枚举收窄为三值;删除旧装配字段与 12 个 DisplayName;`stop_reasons` 的契约、mapper、readback、command API、policy 常量、测试断言全部删除。**operation 数 241 → 236。**

**放在这里的原因**:这批每一项都是**契约破坏性**的,只有前端切完才安全。⛔ 全程不得为了让前端不崩而加开关或兼容层 —— 顺序本身就是兼容手段。

### 批次 6 · L2 与 seed 收口

L2 case 与 seed 数据按新形态更新;整体测试。

## 4 · 退役清单(删除,不留开关不留兼容层)

### 4.1 operation

5 个 delete/disable(§2.2 已列)。⛔ **禁止的规避**:为了不动数量,把 `deleteOperationsCatalogCategory` 的语义偷偷改成软删而保留 operation id。

### 4.2 `stop_reasons` 完整去除面

- **DB**:`business_channel.business_channel.stop_reasons` 列;`V20260819_230000_004__business_channel_internal_effective_repair.sql` 第 13 行
- **契约**:`contracts/openapi-source/business-channel.schemas.json` 第 360、414 行
- **边缘映射**:`BusinessChannelWireMapper` 第 64–65 行
- **readback**:`BusinessChannelReadback` 第 37、40 行
- **owner**:`BusinessChannelOwnerService` 第 284 至 1594 行区间的查询、写入、投影;第 872、893 行的阻断判断改为按维度事实判断;**第 594 行模板级联写调用、第 994–1052 行 external 级联写、第 1175–1185 行 template 级联写**
- **跨 owner producer**:`ExternalCollaborationBusinessChannelCoordinator` 第 183–230 行的 `applyExternalStopReason` 调用
- **command API**:`BusinessChannelCommandApi` 第 31–42 行的 `applyExternalStopReason` —— **该 command 整个退役**
- **policy 常量**:`BusinessChannelPolicy` 第 20–22 行的 `MANUAL` / `CASCADE_TEMPLATE` / `CASCADE_EXTERNAL`
- **前端**:`BusinessChannelDetailDrawer` 第 158–159 行
- **测试**:`BusinessChannelOwnerContractTest` 第 268 行;`BusinessChannelAcceptanceScenarios` 第 355、421、458、565 行
- **记忆**:`business-channel-list-scope-and-validity-display`(已改写完成)

### 4.3 状态值

`catalog_item` 的 `DRAFT` 与 `ARCHIVED`;`catalog_sku` 的 `ARCHIVED`;`catalog_composite_component` 的 `ARCHIVED`;`business_channel` 的 `DRAFT` 与 `EFFECTIVE`。

### 4.4 `requireEditable` 整体退役

`BusinessChannelOwnerService` 七个 live call:511 / 736 / 767 / 868 **删**;769 / 870 **改豁免**;649 **保留**(引用校验)。helper 定义第 1465–1469 行删除。`ExternalCollaborationBusinessChannelCoordinator` 第 310 行是 **dead helper**,一并删。**必须同时补已删除件的终态保护**,否则是净损失。

### 4.5 装配代码

Java 层 37 行 / 11 文件;Stream 层 5 处;SQL 层 9 处。⚠️ **其中 `Problem` 错误文案不在本批范围**(§1.6),须在成员表逐条标注区分。

## 5 · 每个批次的门控(可证伪失败条件)

| 批次 | 失败条件(空实现必红) | FORBID |
| --- | --- | --- |
| 0 | 改 canonical 数字后,六个位置有任一不随动 | 引入 digest / decisionRef / 自动派生 |
| 1 | 任一在范围表作废后同业务唯一键不可重建;`business_channel` 回填后出现两条同身份 `DISABLED` | 改 `inventory.*` 的 `definition_status` 索引 |
| 2 | 响应体内存在由 `+` / `Collectors.joining` / `.reduce` / SQL `\|\|` 产生的字段值 | 引入 `effectiveStatus` 单值字段 |
| 3 | `backend-acceptance` 任一场景 `BUSINESS` 非 PASS;operation 数不等于 241;**前端有任一文件被本批改动** | 跳过任何新增场景 |
| 4 | 前端仍从后端读取任一闭集的 `DisplayName`(按域计 12 个) | 后端为前端字典新建 operation |
| 5 | 删除旧字段后前端有任一消费点未切;operation 数不等于 236 | 保留兼容层或开关;为旧字段保留装配代码 |

## 6 · 三维对账节奏(强制)

每批完成、进入下一批**之前**,对该批范围做**需求文档 / 详设与 IA / 项目记忆设计规范**三维对账,逐条 `MATCHED` 或 `OPEN`;`OPEN` 先同根修复再复查,**不得启动下一批**。

全部批次完成、**进入整体测试之前**,对全批范围**再逐条走一遍**。整体对账不是阶段对账的汇总 —— 跨批偏移(同一事实在两批被改成两个样、后批推翻前批判定、某条规范在合并后不再成立)只有它能发现。

⛔ **本应在开发阶段解决的问题不得留给测试发现。**

## 7 · 维度事实的返回形态(裁定 18)

各对象返回**并列的维度事实**,⛔ 不合并:

- **渠道**:自身状态 + 模板状态 + 模板所属项目状态 + 目标节点状态 + external system 与 provider profile 状态 + binding 状态
- **规格**:自身状态 + 所属商品状态
- **套餐组件**:自身状态 + 所引用商品/规格状态
- **分类**:自身状态 + 全部祖先分类状态
- **组织节点 / 门店**:自身状态 + 上级节点、租户、品牌状态(**总公司不构成阻断维度**,但仍作为维度事实返回)
- **workspace 直属 13 类对象**:各自状态 + `group_workspace` 状态,**取事实方式统一实现**

形态一律 `{ref, type, status}`;⛔ 不得返回句子。组合规则按需求稿适用矩阵四行,由场景决定。

## 8 · 未决与已知缺口

- **`collaboration binding` 在哪些场景构成阻断** —— `DEXTER_DECISION`;维度事实必须返回,组合规则待定
- **菜单发布** —— 能力尚未建设,裁定 13 记为该能力建成时的准入条件
- **`catalog_composite_component` 存量 `ARCHIVED` 行** —— `UNVERIFIED`,需数据授权后核
- **`ExtensionDefinitionService` 第 392–397 行的 `.reduce`** —— 产出进审计 `AuditChange`,**是否属用户可见 read model 未裁**
- **edge mapper 与静态字典两类成员表** —— 附件自陈未产出,**直接影响批次 4 工作量估算**,必须在批次 4 开工前补齐
