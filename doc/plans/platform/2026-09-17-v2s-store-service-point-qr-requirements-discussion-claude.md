# 门店桌台与二维码管理 · 需求讨论稿

```text
DOC_KIND=REQUIREMENTS_DISCUSSION
AUTHOR=Claude
STATUS=讨论稿，不是正式需求稿；不构成详设、实施计划或任何运行授权
BUSINESS_SOURCE=DEXTER_DIRECT_REQUEST_2026-09-17
EVIDENCE_TIER=static；事实来自本会话只读 v2s 当前源码与契约、catering-server-v4 迁移与源码、design-v6 第 22 与 15 章，未执行任何命令
参考边界=v4 与 v6 只作背景，不照抄；下文逐条标出「建议不搬」的部分
路径约定=v2s 路径以仓库根为起点；v4 与 v6 的引用标明出处仓库
修订史=v1 首稿（提出 D-1 至 D-6）；
      v2 Dexter 四项裁决落地：服务点类型保留冗余存储以免级联查询；
        经营规则开关 `tableManagementEnabled` 的**标签**改为「是否启用桌台和二维码管理」（键不变）；
        二维码 URL 采用「模板 URL 后追加查询参数」的简单形态；
        **服务点属性切分为「需系统判断的独立属性 + 纯展示的扩展字段」，服务点成为第 9 类扩展字段宿主**；
      v3 Dexter 确认 D-3、D-7、D-8、D-9 四条：区域与服务点用三态；
        有服务点时禁止改区域类型；扩展字段接受集团空间级粒度；本批不接入动态列与类型化搜索。
        另补齐门店渠道链路的核验结果（§9）
```

## 0. 这份文档是什么

把你口述的需求对着 v2s 当前源码、v4 的实际做法和 v6 的领域裁定推一遍，把**必须先定下来的事**和**我会怎么选**摆出来讨论。不是正式需求稿。

事实分档：**仓内事实**（打开源码核过）、**外部事实**（v4 / v6 原文）、**推论**、**待裁决**。

## 1. 我理解的需求

1. 运营管理后台新增菜单与页面「门店桌台与二维码管理」。
2. 可访问角色与门店商品、库存管理一致；新增一个编辑权限，有此权限者可编辑。
3. 与门店商品管理一样，受门店经营规则开关约束：开启该开关后才能查看或编辑。按 2026-09-17 裁决，该开关的**标签**改为「是否启用桌台和二维码管理」，**键 `tableManagementEnabled` 不变**（键是稳定技术标识，已有数据不可改）。
4. 只抽象三个实体：**区域**、**服务点**、**二维码配置项**。
5. 区域：名称、编码、类型、顺序。类型两个：桌台区、扫码区。
6. 服务点：名称、编码、类型、顺序，外加桌台相关属性。类型两个：桌台、非桌台。桌台类型可补容纳人数、包间与否等，支持上传图片、是否可预约（与经营规则的预约开关互不干涉）。
7. 先有区域，再按区域类型建服务点：桌台区下只能建桌台，扫码区下只能建非桌台。
8. 二维码配置项在同页显示，编辑后可配置是否开启二维码下单，并从门店渠道中选一个「内部接入 + 到店点餐 + 扫码」类型模板的渠道。
9. 渠道模板新增一个 URL 规则属性（字符串），专用于上述类型的模板。
10. 开启二维码下单后，服务点列表与详情抽屉出现二维码查看。
11. 服务点**不存储二维码 URL**；URL 由渠道模板的 URL 加两个参数拼出：集团空间编码、服务点 id。

## 2. v4 与 v6 的实际做法，以及我建议不搬的部分

### 2.1 v4（catering-server-v4）

**外部事实**：v4 有独立的 `onsite-service-service`，迁移在 `backend/edge-bff-service/.../V015__onsite_service_rules.sql`。

- `onsite_dining_area`：`area_code`、`area_name`、`display_order`、`layout_hint_json`、`status`。**没有类型字段。**
- `onsite_dining_table`：`dining_area_ref`、`table_code`、`table_name`、`seat_capacity`（`check > 0`）、`service_tags_json`、`display_order`、`status`（`ENABLED / LOCKED / DISABLED`）。V049 追加 `table_description`、`minimum_consumption_note`、`service_fee_note`。**没有图片，没有是否可预约。**
- `onsite_pickup_point`：`point_code`、`point_name`、`location_hint`、`supported_party_types_json`、`identity_policy_ref`、`notification_policy_ref`、`status`。
- `onsite_general_self_order_code`：`code`、`name`、`display_order`。
- 另有 `onsite_store_service_model`（DRAFT / PUBLISHED / SUPERSEDED / ARCHIVED 版本化模型）与 `onsite_spatial_policy`（`requires_table`、`requires_pickup_point` 等）。

**v4 在二维码上走过一次弯路然后收敛**，V051 迁移的注释原文：

> 到店服务扫码模型重构：码不再绑定经营入口或服务流程。桌台码由 DiningTable + TABLE_QR_ORDER URL 模板即时派生；通用自助下单码是唯一规则侧扫码实体。

该迁移删掉了 `onsite_scan_entry_definition`、`onsite_scan_entry_code_binding`、`onsite_scan_entry_code_download_task` 三张表，并从桌台上删掉了 `scan_entry_definition_ref`。同仓还有 redline 测试强制二维码预览方法必须只读、不得持久化图片文件。

**建议不搬**：`store_service_model` 的草稿/发布版本化、`spatial_policy` 的策略子模型、`self_order_mode` 三态、桌台的 `LOCKED` 状态。这些服务于 v4 的运行时会话与流程编排，本批只做后台配置，搬进来就是过度设计。

### 2.2 v6（requirement-doc/design-v6/01.领域设计/22-到店服务域.md）

**外部事实**，§5.4 的字段清单：

```text
DiningArea: diningAreaRef, storeRef, areaCode, areaName, displayOrder, layoutHint?
DiningTable: diningTableRef, storeRef, diningAreaRef, tableCode, tableName,
             seatCapacity, serviceTags[], description?, minSpendNote?,
             serviceFeeNote?, displayOrder, layoutPositionHint?
```

同节的设计判断里有三条与本批直接相关：

> 6. 桌台码是按项目自营小程序 URL 模板派生的结果，不是桌台字段；`DiningTable` 不再反向保存旧扫码入口定义引用。
> 7. 区域和桌台不维护启用/停用/锁定状态；不再使用时直接删除。最低消费、服务费等先作为说明字段保存，不作为系统约束。

§5.8 只保留两种码：桌台派生码（不建实体、不作为桌台字段）与通用自助下单码（门店级实体，只存名称与编码）；并明确「区域码和取餐点码不进入起步期模型」。§8.1 裁定：

> 项目自营小程序的 `STORE_QR_ORDER / TABLE_QR_ORDER` URL 模板归经营渠道 provider config 所有，到店服务域只消费模板生成二维码。

**建议不搬**：`TableVisitSession`、`ScanEntrySession`、`WaitingQueueDefinition`、`OnsiteIdentityPolicy` 等运行时与策略模型，以及 TDP 投影。它们都在本批范围之外。

### 2.3 你的方案与 v4 / v6 的三处实质差异

| 事项 | v4 | v6 | 你的方案 | 我的看法 |
| --- | --- | --- | --- | --- |
| 区域是否有类型 | 无 | 无 | 桌台区 / 扫码区 | 是你新增的抽象，见 §5.2 |
| 桌台与非桌台点 | 两张表 | 两个实体 | 合并为一个「服务点」加类型 | 本批成立，见 §5.1 |
| URL 规则住址 | provider config 侧模板 | provider config | 渠道模板 | v2s 无 provider config，你的方案更小，见 §5.4 |

## 3. 仓内现状（核过的）

- **没有任何近亲**。全仓搜索「区域」「服务点」「桌台」相关实体，除门店经营规则开关里的 `tableManagementEnabled` 之外无命中；后端 18 个模块中没有到店服务类的域。本批需要新建一个域。
- **开关已就绪**：`contracts/catalog/store-operating-rule-switches.json` 第 13 行的 `tableManagementEnabled`，父键是 `catalogManagementEnabled`，默认 `false`。上一批已建成的 gate 与三页空态模式可直接复用。
- **渠道分类闭集**（`contracts/openapi/components/business-channel/business-channel.schemas.json`）：`accessKind ∈ {INTERNAL, EXTERNAL}`、`operatorKind ∈ {PROJECT, STORE}`、`orderKind ∈ {DINE_IN, TAKEAWAY, GROUP_BUY}`、`dineInForm ∈ {POS, QR, KIOSK, null}`。你说的「内部接入 + 到店点餐 + 扫码」精确对应 `INTERNAL + DINE_IN + QR`。
- **渠道实体**：`business_channel.business_channel_template` 与 `business_channel.business_channel`（带 `ownerNodeType`、`ownerNodeRef`、`templateRef`、`channelCode`、`channelName`、`bindingRef`、状态维度）。**v2s 没有 `BusinessChannelProviderConfig`**；provider 相关只在 collaboration 域做启用登记（`provider_profile_enablement`、`external_system_enablement`、`owner_binding`）。
- **模板更新面偏窄**：`BusinessChannelTemplateUpdateRequest` 当前只允许 `templateName`、`expectedVersion`、`storeVisibilityScope`、`visibleStoreRefs`。新增 URL 规则属性要同时动创建与更新两个请求。
- **图片上传有共享核心**：`PlatformAssetService` 提供通用 `stageContent`，各域各有一组 command API（`CatalogAssetCommandApi`、`SalesMenuAssetCommandApi`、`WorkspaceLogoAssetCommand`）。服务点图片应新增一组同构的 API，不新建存储机制。
- **页面与能力注册形态**：`contracts/catalog/admin-catalog.json` 中 PAGE 条目带 `navigation.groupKey`、`experience`；ACTION 条目带 `targetPageKey`、`grantableRoleNodeTypes`、`scopeApplicability`。三个门店页的可授予角色是 `GROUP / REGION / PROJECT / STORE`，`requiredDataNodeType` 为 `STORE`，导航组 `NAV-CATALOG-SERVICES`。

## 4. 第一性判断：三个实体够不够

够，而且合并是对的。理由：本批只做**后台配置**，不做桌台会话、扫码会话、取餐任务。桌台与非桌台服务点在配置层面只差几个属性，且都挂在区域下；v4 与 v6 分成两个实体，是因为它们要承载不同的运行时（桌台会话 vs 取餐任务），那层本批不做。

代价要讲清楚：将来运行时进来时，桌台会话与取餐任务归属不同 owner，单表加类型判别符会需要按类型分组的属性集合。因此建议现在就把**桌台专属属性放进一个 JSON 属性组**（见 §5.1），而不是平铺成一堆只对一半行有意义的列。

## 5. 关键设计选择

### 5.1 服务点属性的三层切分（2026-09-17 裁决）

裁决原文：「把是否可预约这类的需要做系统判断的参数作为独立属性，图片也需要独立属性，但个性化的纯展示的描述部分，作为扩展字段。」

据此切成三层：

**第一层 · 核心平铺列**（所有类型都有）：`区域引用`、`编码`、`名称`、`类型`、`顺序`、状态。

**第二层 · 需系统判断的独立属性**（仅桌台类型有意义）：判据是「后续会有代码读它做判断，或会被别的域消费」。建议至少包含：

| 属性 | 为什么必须独立 |
| --- | --- |
| 容纳人数 | 预约选桌、并桌、桌态展示都要按它计算 |
| 是否可预约 | 你明确点名；预约功能落地时按它筛选可预约服务点 |
| 桌台形态（大厅 / 包间 / 卡座 / 户外…） | 「是不是包间」会影响预约策略与计价说明；塞进展示层后续读不到 |
| 图片 | 你明确点名；走资产链路，有引用与生命周期，不是纯文本 |

**第三层 · 纯展示描述 → 扩展字段**：v4 与 v6 都把最低消费、服务费明确标为「仅说明，不参与系统约束、计价或下单校验」（v4 schema 的 description 与 v6 §5.4 判断 7 原文一致）。这类正好落进扩展字段，由运维管理后台定义。详见 §5.8。

这个切分的判据可以一句话说清：**会被代码读来做判断的进独立属性，只给人看的进扩展字段。** 建议在正式需求稿里把这句作为规则写死，避免后续新增属性时两边乱放。

非桌台服务点本批只用第一层加扩展字段。

### 5.2 服务点类型：保留冗余存储（2026-09-17 裁决）

裁决原文：「即使是冗余，这样方便直接根据服务点类型做很多判断，不用级联查询。」采纳。

反规范化的代价必须由 owner 兜住，两条要求：

- 写入时 owner 必须校验服务点类型与其所属区域类型一致，不得只靠前端不给选。
- **区域类型是否允许修改，需要你定**（见 §6 D-7）。若允许，已有服务点怎么办：禁止改（下面有服务点时锁死类型）、级联改、还是要求先清空。我倾向**下面已有服务点时禁止修改区域类型**，这是最小且无歧义的做法；级联改会让一批服务点的属性含义突然改变。

### 5.3 二维码配置项：建议独立一行，不塞进开关 JSON

它是门店级单例：一个「是否开启二维码下单」加一个渠道引用。

两个候选：放进门店已有的 JSON（经营规则开关那一列），或新建一张一店一行的配置表。

**建议新建一行**。理由：它引用渠道，有外键语义和有效性校验（选中的渠道被停用怎么办），而且将来会长出更多二维码相关配置。放进经营规则开关那一列会把「上级授权开关」和「门店自己的功能配置」混成一个住址——而这两件事正是上一批刚刚分清的：开关层由集团、大区、项目设置，详细规则由门店自己设置。二维码配置属于后者。

**可选渠道的精确谓词**（已核实，见 §9）：候选集合是 `getOperationsStoreBusinessChannels` 返回的、`target_node_type='STORE'` 且 `target_node_ref` 为当前门店的渠道实例，再按其 `template_ref` 指向的模板过滤 `accessKind='INTERNAL'` 且 `orderKind='DINE_IN'` 且 `dineInForm='QR'`。

由此带出两条要在正式需求稿定死的性质：

- **候选为空时要说清原因**。门店没有这类渠道实例时，二维码配置只能停在「无可选渠道」，且应指向「先去门店渠道页开通」，不能只显示一个空下拉。
- **选中的渠道后来失效怎么办**。渠道状态闭集是 `DRAFT / EFFECTIVE / DISABLED`，且带 `stop_reasons`。建议：只允许选择 `EFFECTIVE` 的渠道；已选渠道转为非 `EFFECTIVE` 时，**不自动清空配置**（否则会丢用户的选择），而是二维码停止生成并在页面给出准确原因。这与「关闭开关不删数据」是同一条取向。

### 5.4 URL 规则属性：接受放在渠道模板上，但要加类型约束

v6 把 URL 模板放在 provider config，v2s 没有这个实体，为了放一个字符串新建一层是过度设计。**接受你的方案。**

但要加一条 owner 校验：该属性**只对 `accessKind=INTERNAL` 且 `orderKind=DINE_IN` 且 `dineInForm=QR` 的模板有意义**，其他模板必须为空。否则它会变成一个谁都能填、谁都不读的自由字段。

已知代价：模板级意味着同一模板下所有项目与门店共用一条 URL 规则。v6 放在项目级 provider config 是为了项目差异。若将来需要按项目区分，届时再把该属性下沉，本批不预留。

### 5.5 二维码 URL：模板后追加查询参数（2026-09-17 裁决）

裁决原文：「简单点，就在 URL 后面拼参数就好了。」采纳，不做 v4 的占位符替换。

v4 与 v6 都是「即时派生、不回写实体」，与你的要求一致，这条没有分歧。

落地为三条要求：

- **参数名固定在契约里**：`groupWorkspaceKey` 与 `servicePointId`，与仓内既有命名一致。模板作者据此知道系统会追加什么。
- **连接符必须正确**：模板 URL 本身可能已带查询串，追加时要判断用 `?` 还是 `&`。这是最容易被写死成 `?` 的地方，正式需求稿要把「模板已带查询串时仍能正确拼接」列为验收判据。
- **拼接只有一个住址**：建议由 owner 在返回服务点时一并给出成品 URL，前端不自行拼接。上一批的教训是同一规则散落多处必然两端漂移。

### 5.8 服务点作为第 9 类扩展字段宿主（2026-09-17 裁决）

裁决原文：「在运维管理后台定义好，跟项目、门店、合同那些一样，归为可扩展的实体。」

**仓内事实**：扩展字段宿主闭集当前是 8 类（`contracts/openapi/components/extension/extension.schemas.json` 的 `ExtensionEntityType`：BRAND、TENANT、HEAD_COMPANY、STORE、CONTRACT、COMMERCIAL_GROUP、REGION、PROJECT）；其中真正存值并消费的**平面宿主只有 5 类**（`ExtensionHostTypes.java` 第 17 行的 `FLAT_VALUES`），树宿主只配置、不消费。

据此，服务点接入需要四件事：

1. 宿主闭集新增一类（建议 `SERVICE_POINT`），并**加入 `FLAT_VALUES`**，否则只能配置、存不了值。
2. 服务点表新增 `extension_values` JSONB 与定义版本号两列，与门店同构。
3. 运维管理后台的扩展字段配置页多一类宿主可选。
4. 服务点的扩展字段值变更纳入审计，与上一批补齐的四类实体同一表示（四态、标签快照、截断）。这属于共用机制，应一次补齐而不是留欠账。

**一个必须你确认的粒度问题**：扩展字段定义表的主键是 `(group_workspace_key, entity_type)`（`V20260726_160000_000` 迁移第 66 行），也就是说**服务点的扩展字段是集团空间级的一套定义，管这个集团空间下所有门店的所有服务点**，无法按门店或按区域差异化。对「最低消费说明、服务费说明」这类字段我认为够用，但如果你预期不同门店要定义不同的展示字段，现有机制承载不了。见 §6 D-8。

**一个可以顺带拿到、但需要显式接入的能力**：上一批刚建成的「扩展字段列表展示与类型化搜索」适用于平面宿主，服务点列表因此可以有动态列与动态搜索。但它是按列表 operation 逐个接入的，不会自动获得，需要在本批显式接入或明确不做（D-9）。

### 5.6 图片上传：复用共享核心

新增一组服务点 asset command API，走既有 `PlatformAssetService`，与商品、销售菜单同构（暂存、释放、保存时认领）。不新建存储机制、不新建资产表。

### 5.7 「是否可预约」与经营规则的预约开关互不干涉

按你的明确要求记录：服务点的「是否可预约」是桌台自身属性，与门店经营规则的 `reservationEnabled` 不联动、不互相校验。实现时不得自作主张做联动。

## 6. 待你裁决

### 6.1 已裁决（2026-09-17）

| # | 事项 | 裁决 |
| --- | --- | --- |
| D-1 | 服务点类型是否独立存储 | **保留冗余存储**，便于直接按类型判断、免级联查询。一致性由 owner 写入校验兜住（§5.2） |
| D-2 | 桌台属性怎么建模 | **三层切分**：核心平铺列、需系统判断的独立属性、纯展示描述走扩展字段（§5.1、§5.8） |
| D-4 / D-5 | URL 拼接形态与参数名 | **模板 URL 后追加查询参数**，不做占位符替换；参数名 `groupWorkspaceKey` 与 `servicePointId`（§5.5） |
| D-6 | 页面进入开关 | **改开关标签**为「是否启用桌台和二维码管理」，键不变 |
| D-3 | 区域与服务点的状态 | **跟 v2s 惯例用三态**（启用 / 停用 / 作废），不跟 v6 的「不用就删」 |
| D-7 | 区域类型能否修改 | **下面已有服务点时禁止修改区域类型**；要改先清空该区域下的服务点 |
| D-8 | 扩展字段定义粒度 | **接受集团空间级一套定义**，不按门店差异化 |
| D-9 | 服务点列表是否接入动态列与类型化搜索 | **本批不接入**；作为独立增量，后续单独决定 |

### 6.2 仍待确认的一处

**桌台形态（大厅 / 包间 / 卡座 / 户外）归哪一层**。按 §5.1 的判据我放进了「需系统判断的独立属性」，理由是它会影响预约策略与最低消费、服务费的适用；但你原话「是包间还是什么」也可以理解为纯展示。若按纯展示处理就下沉到扩展字段，代价是将来做预约按形态筛桌时要再迁一次。**未见异议则按独立属性执行。**

除此之外，D-1 至 D-9 全部已裁决。

**D-6 的连带事实**（裁决已定，此处只记录影响）：`tableManagementEnabled` 的标签改了但键不变，因此键名与标签从此不完全对应——这符合仓内「键是稳定技术标识、不是用户文案」的既有口径。它的三个子开关（桌台状态、等叫、宴会订单）仍是桌台专属，父级标签扩大到二维码后，子开关的归属没有变化。另外，历史审计行里保存的是**当时的标签快照**，改名不回改历史记录，这是上一批刚建成的行为，符合预期。

## 7. 验收要证明什么

1. 未开启对应开关的门店，进入该页面显示未开启文案且不发列表请求；后端写入口同样拒绝。
2. 区域与服务点的级联约束成立：桌台区下建不出非桌台服务点，反之亦然；构造违规请求必须被 owner 拒绝，只证明前端不给选不算通过。
3. 服务点不存储二维码 URL：直接查库确认无该字段；URL 由读取路径派生。
4. 未选择渠道或渠道被停用时，二维码不可生成，且给出准确原因而不是空白。
5. URL 规则属性在非「内部接入 + 到店点餐 + 扫码」模板上必须为空，构造违规模板必须被拒。
6. 新编辑权限的可授予角色与三个门店页一致；门店层角色的可用性需与项目层各自验证一次。
7. 服务点图片走既有资产链路，保存失败不产生孤儿资产。

## 8. 明确不在本次范围

- 桌台会话、扫码会话、开台换桌并桌清台等运行时事实（v4 与 v6 的 `TableVisitSession` / `ScanEntrySession`）。
- 候位排队、取餐任务、叫号通知。
- 服务模型的草稿与发布版本化、空间策略子模型（v4 的 `store_service_model` / `spatial_policy`）。
- 区域码、取餐点码（v6 明确不进起步期）。
- 二维码图片的生成、下载与批量导出；本批只做「查看」，具体形态待交互设计。
- 终端消费这些配置。
- 经营规则开关的树形、默认值与键的任何改动；本批只改 `tableManagementEnabled` 的**标签**一处。
- 扩展字段机制本身的改造；本批只新增一类宿主并接入，不动定义、版本号与校验机制。

## 9. 证据边界与未决

标「仓内事实」的都打开了 v2s 当前源码或契约；标「外部事实」的引用 v4 迁移与源码、v6 第 22 与 15 章原文。本会话只做静态只读，未执行任何构建、测试、生成或运行命令。

**v1 标注的未核实项已补核，结论如下**（仓内事实）：

- 渠道实例表 `business_channel.business_channel` 的列是 `target_node_type`（闭集 `PROJECT / STORE`）、`target_node_ref`、`template_ref`、`channel_code`（可空、opaque、刻意不唯一）、`channel_name`、`binding_ref`、`status`（闭集 `DRAFT / EFFECTIVE / DISABLED`）、`stop_reasons`。注意契约里叫 `ownerNodeType / ownerNodeRef`，与表列名 `target_node_*` 不同名，同一事实两种叫法。
- 门店层渠道实例有完整的读写面：`getOperationsStoreBusinessChannels`、`createOperationsBusinessChannel`、`getOperationsBusinessChannelDetail`、`updateOperationsBusinessChannel`、`transitionOperationsBusinessChannelStatus`；另有 `getOperationsStoreBusinessChannelTemplateCandidates`（按 `projectRef + storeRef` 过滤可开通的模板）。
- 运营后台 `StoreBusinessChannelPage` 同时承载模板候选浏览与渠道实例列表、绑定抽屉（`BusinessChannelList`、`BusinessChannelBindingDrawer`）。

因此「从门店渠道中选一个」有真实可选集合，不会无处可选；精确谓词已写入 §5.3。**v1 中「该链路需在正式需求稿前补核」的提示据此关闭。**

本稿为需求讨论稿，不构成实施或运行授权。
