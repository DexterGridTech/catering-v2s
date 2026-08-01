---
id: decisions.confirmed-business-language-corpus
status: active
layer: routed
taskKinds: ["design","implementation","review","testing"]
domains: ["all"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["all"]
triggers: ["task-start","implementation","review"]
assertions: ["BUSINESS_CORPUS_G01_G12_ACCEPTED","BUSINESS_CORPUS_READ_POLICY"]
sourceRefs: ["doc/decisions/2026-07-25-v2s-confirmed-business-corpus-memory-adoption.md"]
---

# Confirmed business language corpus

## Authority and use

This is the current canonical business-language anchor for G-01 to G-12 only.
It is not an implementation specification, schema, API contract, Journey approval, or runtime
authorization. When a related task begins, use the index below to locate candidate entries, then
read the whole entry and its stated `不得推导` boundary. An index miss never proves that a task has
no business meaning.

### 命中词干索引（人工定位，不是语义 checker）

| Entry | 主叫法、英文和高风险别名 |
| --- | --- |
| G-01 | 集团空间、商业集团、`GroupWorkspace`、`CommercialGroup`、`workspaceKey`、`groupWorkspaceKey`、工作区、租户隔离 |
| G-02 | 组织、组织树、大区、项目、项目分期、`Region`、`Project` |
| G-03/G-04/G-06 | 系统服务提供者、商场运营方、店铺运营方、门店、实际经营租户、总公司、品牌、商户、`Tenant`、`HeadCompany`、`Store` |
| G-05/G-07 | 运营用户、账号、运营角色、任职、可视数据节点、页面准入、动作能力、邀请、`Account`、`Principal`、`WorkspaceUser`、`RoleAssignment` |
| G-08/G-09 | 已启用、已停用、合同、货号、经营中、待开业、未经营、已停业、`StoreLeaseContract` |
| G-10 | 集团空间编码、运营管理后台、运维管理后台、URL、路由 |
| G-11/G-12 | 商品、商品目录、菜单、销售集合、销售项、发布、可售、库存、BOM、沽清、SKU、选项、`CatalogItem`、`ProductCatalog`、`SalesCollection`、`StockTarget` |

## G-01 集团空间与商业集团

集团空间是平台为一组经营事实划出的隔离与入口，创建时可以为空且空态可长期合法
存在。平台可以显式初始化商业集团：每个集团空间至多一个，初始化成功后恰有一个，
重复初始化必须拒绝 `COMMERCIAL_GROUP_ALREADY_INITIALIZED`。商业集团有自己的名称和
编码，必须单独录入，不得借用、复制或回写集团空间名称和编码。

不得由空间存在推导集团存在；不得由初始化集团推导组织树、账号、角色或门店自动创
建。初始化后的解绑、替换、重建均待裁决，不得默认永久绑定或擅自实现。

## G-02 商场运营方组织树

组织主干固定为“商业集团 → 大区 → 项目”三层，大区单级，项目之下不能再建组织
下级；项目分期是项目聚合内属性，不是组织节点。业务语境的“组织/组织树”专指这棵
商场运营方树；门店和总公司不是组织树节点。V6 多级大区是未采纳的历史设计。

## G-03 三类用户、总公司与门店关联

三类用户是系统服务提供者（运维管理员，使用运维管理后台）、商场运营方（集团/
大区/项目节点运营用户）、店铺运营方（门店节点运营用户，可为仅门店或门店+总公
司）。“商场运营方/店铺运营方”为主叫法；“商场管理方用户/商户用户”为历史别名；
“商户”不得指实际经营租户。

总公司不干涉门店经营，职责只有发布品牌侧商品信息/资料模板，以及查看门店经营结
果（未来分析/报表类能力）。它仍是 IAM 访问节点，但当前四域不进入门店基础资料页。
可见门店范围只来自 `Store.headCompanyRef`，不从品牌授权反推。每个门店可选关联
0..1 个总公司；选择时须满足该总公司对该品牌的有效授权。

## G-04 实际经营租户、法律形态与项目分期

实际经营租户是实际经营门店的公司或个体工商户，承载统一社会信用代码、注册地等
法律属性。每个门店必须且只能引用一个实际经营租户；变更时必须新建门店，项目+
经营租户+品牌创建后锁定。它不是店铺运营方、总公司、品牌或 SaaS 隔离租户；不得
称“商户”。租户与总公司都可有实体自身 `legalProfile`，但不建独立法人实体或名册。

门店是在项目（购物中心/商场）里开店的叫法，商场 ERP 的门店记录仅是外部对接语境，
不是本系统要镜像的主数据。项目分期代表业主方分界；项目只保留名称，合同存名称快
照，不建分期/业主方主数据，改名不回写合同。

## G-05 运营访问上下文

运营用户是集团空间内使用运营管理后台的个人。账号关联唯一手机号，支持登录名+
密码与手机号验证码；同一手机号在不同集团空间可对应不同账号，但物理账号是否跨
空间复用待裁决。运营角色由归属节点、页面准入（只读功能面）、动作能力（写功能
面）和名称组成。运营角色任职是某人以某角色服务于具体节点的事实；一个账号可有
多个任职，右上角切换即切换页面与权限。

可视数据节点与当前运营角色分别选择，只限制功能页数据范围；按大区→项目→门店
三级级联，页面必须声明所需层级或不需要，可选范围由角色归属节点固定推导，不设
范围表达式。数据可见不产生页面准入，页面准入不产生写权限。`Account`、`Principal`、
`WorkspaceUser`、`RoleAssignment`、`UserNode*`、`WorkContext` 只作跨代技术称呼，映
射待裁决；未来 LDAP/既有商户服务平台关联也不预置。

## G-06 品牌与总公司品牌授权

品牌是商业集团内唯一的餐饮品牌名册条目；门店创建时锁定一个品牌。同一品牌可由不
同实际经营租户经营，也可授权多个总公司。品牌不是总公司、租户、门店或商业集团
展示品牌。总公司品牌授权只表示该总公司有维护该品牌侧资料（模板/商品信息）的资
格；不得推导同品牌全部门店可见、门店资料写权或组织上下级。

## G-07 任职动作与角色定义

新增任职必须走邀请，受邀人接受后生效；撤销任职是无需邀请的直接操作，可由运维
管理员或具备相应节点用户管理权限的运营用户执行。不存在直接编辑任职；角色或服
务节点变化一律是“撤销旧任职 + 发起新邀请”。

运营角色由运维管理员维护，可修改名称、页面准入、动作能力；归属节点类型创建后
不可改。修改即时作用于后端授权，但不要求已登录前端即时刷新；注销重登录后取得
新权限即可。显式修订 all-v2：运维管理员可撤销任职，但仍不可直接新增或编辑任职。
未来外部系统推送“用户+角色”不预置。

## G-08 门店主数据状态

门店“已启用/已停用”是主数据候选状态，停用是管理员手动强制动作；不表示实际营
业、合同有效、经营资格、订单或 POS 可用性，且不使合同失效。历史门店资料、合同、
订单、审计一律保留。

唯一已裁决影响是：门店节点任职不能登录或切换到该门店角色；账号和其他节点任职
不受影响。停用还应阻断哪些新操作逐项待裁决。v4 营业状态三轴与 V6 门店状态文字
只作历史对照，未来营业状态必须另起词。

## G-09 轻合同、货号与合同衍生状态

门店租赁合同是轻量经营关系档案/资格依据：基于门店，记录承租租户和项目分期名称
快照；不建设完整合同系统、业主方主数据、法务/结算责任主数据。无合同、未生效或
失效时门店资料照常存在；一个门店可有多份合同且时间可重叠。

货号用于订单上报商场 ERP 映射，是 `{编码,名称}` 二元结构；一份合同可有多个，合
同内编码唯一。存在当前生效合同为“经营中”，否则存在未来生效合同为“待开业”，两
者皆无为“未经营”（禁用“已停业”）。这是存在性衍生状态，不选唯一当前合同，暂不
驱动/阻断操作；多份有效合同的订单货号选择待裁决。合同状态与门店启停不得互推，
`itemCodes[]` 纯字符串数组是被修订的历史 schema，不在本次物化。

## G-10 集团空间编码与双后台 URL

业务主叫法为“集团空间编码”，技术拼写统一 `groupWorkspaceKey`；`workspaceKey` 是
历史别名，迁移留 R3 contract 物化另批。运营管理后台的登录、公开邀请和业务页 URL
第一段均携带该编码；运维管理后台 URL 不携带，所选空间是端内会话上下文，只在生成
运营端链接时使用。URL 只定位空间，不构成授权，不回退默认空间，不由显示名反查。

## G-11 商品、目录、销售集合与可售

`CatalogItem` 是可复用商品事实/商品壳，回答“卖的是什么”，含名称、分类、标签、
描述、SKU、点单选项、BOM、识别码和制作提示；不回答是否上架/可售、价格或库存。
`SELLABLE` 只是用途能力，称重是 `measureMode=WEIGHED`，不是商品种类。

`ProductCatalog` 是商品容器，可为总公司品牌库或门店库；总部库是模板/候选来源，门
店复制后本地独立生命周期，不强继承/自动合并。菜单是面向门店渠道绑定的
`SalesCollection`：商品显式编入不可换绑销售项→版本（草稿可改、发布冻结）→发布
→门店渠道启用，才成为入口可售内容。发布不等于 TDP ACK、POS 展示或外部同步成功；
沽清/限售走独立可售控制，不改写菜单事实。

价格和库存不在商品上；价格层为标准价→集合挂牌价→SKU 挂牌价→营销权益价→支付实
付，库存提示必须显式转为可售控制。`ProductCatalog`、`CatalogCategory`、`SalesSection`
三义严格区分；禁用 `WEIGHED_ITEM`、`BENEFIT_PRODUCT`、`OPTION_ITEM`、`MATERIAL_ITEM`、
`SEMI_FINISHED_ITEM`、`PACKAGING_ITEM`、`product_kind`、`menu_release`。SKU 回答规格
单元，选项回答怎么做/加什么；强 SKU 矩阵与选项互斥细则待后续。v4 `shapeKey`（商品
形态）仅作历史映射，v2s 是否采用待未来商品域裁决。

## G-12 门店轻库存、BOM 与可售控制

库存域只管理门店级轻库存：固定到门店、按商品或 SKU 的库存对象、真实余额、BOM
扣减/恢复、不可变流水和库存提示。流水账本是唯一真相，余额是追加式流水重建读模
型，状态为在库/低库存/缺货/负库存/未知；负库存由库存对象显式开关决定，不存在静
默重算流水来源。

扣减/恢复走计划→执行两段并留执行行；超卖无法履约走退款，不做复杂自动补偿。外部
ERP 可权威覆盖当前余额，但必须留调用审计与流水。明确不建仓库、批次、采购、供应
商、调拨、入/出库、预占与重供应链模型。

库存提示、沽清和库存状态只是销售库存视图；影响展示、加购或提交必须由销售集合域
显式转为可售控制。已成立订单不因库存变化改写，退菜不自动恢复沽清。BOM 可挂商品、
SKU、选项值；无 BOM 不阻断销售。消耗单位是库存真相单位，盘点单位仅为录入便利。
不得由有库存推可售、缺货推菜单下架、库存流水推订单/结算。v4 `isolation_context_ref` 与
`group_workspace_id` 是历史同义异名，v2s 未来统一且不得并用；`is_key_material_for_sales_stock_view`
只作历史参考。

## Provenance

Canonical content is promoted from `doc/review/platform/2026-07-24-v2s-cross-generation-business-corpus-draft.md`
§7.1–§7.12 under the 2026-07-25 Dexter decision. The detailed source ledger and cross-generation
conflict records remain in that review draft; they are not duplicated here as independent truth.
