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
assertions: ["BUSINESS_CORPUS_G01_G12_ACCEPTED","BUSINESS_CORPUS_CIPG01_ACCEPTED","BUSINESS_CORPUS_CIPG01_USER_LANGUAGE","BUSINESS_CORPUS_CIPG01_SINGLE_PRODUCTION_TAG","BUSINESS_CORPUS_CIPG01_CONSTRAINT_SPLIT","BUSINESS_CORPUS_READ_POLICY"]
sourceRefs: ["doc/decisions/2026-07-25-v2s-confirmed-business-corpus-memory-adoption.md","doc/plans/platform/2026-08-23-v2s-catalog-identification-production-guidance-formal-requirements-codex.md","doc/plans/platform/2026-08-23-v2s-catalog-library-ui-experience-formal-requirements-codex.md","doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-ia-design-codex.md","doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-interaction-design-codex.md"]
---

# Confirmed business language corpus

## Authority and use

This is the current canonical business-language anchor for G-01 to G-12 plus CIPG-01 only.
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
| CIPG-01 | 条码与标识、识别码、条码、称重键码（PLU）、助记码、商品编码、规格、规格编码、制作信息、生产标签、制作单显示名称、预计制作时长、制作说明、商品默认、单独设置、制作变化 |

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

### G-05A 读取范围与写 capability 的边界

角色节点是 workspace 内**主对象读取**的唯一范围真相：列表、详情和查询结果按主对
象的角色节点范围判断，不能用 capability 代替、更窄化或补充读取授权。capability 只
控制写操作；数据可见、页面准入和 capability 三者均不得相互推导。

已可读取的主对象返回的关联事实不再按角色节点二次裁剪、置空或改写。例如门店可读
后可返回其品牌、实际经营租户、项目与总公司；合同可读后可返回门店、项目和实际经
营租户。表单内为了完成当前业务关系而提供的关联候选（例如项目下门店查询中的品牌、
经营主体、总公司编码/名称）同样只受集团空间隔离、启停状态、查询词、分页与业务关
系约束，不能再受读取节点范围限制；但它不得枚举跨集团空间或与当前业务关系无关的
实体。

反例必须保留：项目、门店等本身作为主对象的列表、详情或范围选择器时，仍受当前角
色节点范围约束；关联读取/候选规则不能放宽主对象集合。

写操作必须以 workspace-IAM 的实时任职、角色 capability 和 owner 首次读取出的实际
目标生成 grant。前端 session 投影、页面可见性、客户端 capability 字面量或请求 body
中的 scope/target 不能成为写授权真相。目标 owner 在 CAS、审计或 idempotency receipt
replay 前核验 grant 与首读事实；拒绝必须以 owner typed access-denied problem 返回，不
得伪装为校验错误、资源不存在或凭据错误。

当前实际写目标：品牌和实际经营租户为 `GROUP`；总公司更新、状态、品牌授权为
`HEAD_COMPANY`，总公司新建仍为 `GROUP`，仅该新建 capability 的白名单 policy 可令
`HEAD_COMPANY` 节点写入 `GROUP`，绝不泛化该转换；门店和门店合同的实际写目标都是
所属 `PROJECT`，允许 `GROUP`、`REGION`、`PROJECT` 节点，不得以 `STORE` target 扩大
门店写权。合同创建从 store owner context 得到项目，更新/失效从持久合同的 store
context 得到项目，不能相信请求项目 ID。

### G-05B CRUD 主实体、关联实体与查询呈现

Dexter 确认双后台的 CRUD 可读界面必须区分**当前列表/详情的主实体**与其已返回的
**关联实体**。列表中主实体“名称”列只显示名称；如该 owner 具有真实业务编码，必须另有
可见“编码”列且只显示编码。详情中同样把主实体名称与编码分成两项。关联实体作为列表列、
详情关联字段、路径外的搜索选择项时，才显示为 `名称(编码)`，并复用统一格式化函数。

关系型筛选不得把名称或编码塞入自由文本条件：前端必须调用该关联 owner 的候选查询、选择
owner-issued opaque ID，并让候选按其真实名称和编码检索；候选查询只受集团空间、业务关系、
状态（适用时）与分页约束，不追加主对象读取范围。主实体自身的名称/编码搜索仍是文本条件。
owner 模型没有真实编码时，不得编造编码或伪造括号格式，显式按名称候选处理。

每个 CRUD 列表的可见结果列集合必须**严格覆盖**其可见查询条件：每一个查询语义都有等价
可见列可核对，且结果表还至少有一项非查询业务列。层级树标题及其本地名称/编码导航搜索
不是平面 CRUD 列表，属于明确反例。该规则由
`contracts/policy/crud-presentation-standard-catalog.json` 与现有
`scripts/check/frontend-architecture` 的机械校验共同控制；任何新增或变更 CRUD surface 都必须
先登记有限分母和反例，再通过该 gate 和 L2 交互证明。

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

## CIPG-01 商品识别与制作信息

用户可见主叫法固定为“条码与标识”和“制作信息”，不再称“条码与识别”或“生产提
示”。“识别码”是条码、称重键码（PLU）和助记码的统称；“商品编码”与“规格编
码”是商品和具体规格自身的业务编码，不作为识别码重复维护。按规格管理的商品在具
体“规格”行维护识别码，用户界面称“规格”和“规格编码”，不显示 `SKU`、引用值或
内部枚举。服务与费用商品只支持助记码；条码和称重键码不适用于此类商品。

制作字段的用户叫法固定为“生产标签”“制作单显示名称”“预计制作时长（秒）”
和“制作说明”。不得再用“制作处理标签”或“打印名称”代替；“制作单显示名称”只表示制作
人员看到的名称，不推导打印机、打印模板、打印规则、KDS、队列或工作台能力。商品维
护至多一个生产标签，允许不设置；具体规格只选择“使用商品默认”或“单独设置”制作单显示名称、
预计制作时长和制作说明，不得单独设置生产标签。单独设置是这三项的整套覆盖，不在用户
界面解释为 profile、override、source 或逐字段继承。停用生产标签不进入新候选，既有商品
绑定继续显示并可清除。

点单选项对制作信息的用户叫法固定为“制作变化（可选）”：只允许“增加制作时长
（秒）”和“追加制作说明”。点单选项不得增加、移除或替换生产标签，也不得提供“减少
时长”；多项制作说明按点单选项在页面中的业务顺序依次呈现。改变生产去向不由制作变化
或具体规格表达，未来确有生产路由 Journey 时必须重开需求。

识别码去除首尾空白后至少 1 个、最多 160 个字符，且不得包含不可见控制字符。条码
与称重键码保留原值和前导零并区分大小写；助记码在重复判断时不区分大小写，但界面
仍按用户录入形式展示。“制作单显示名称”最多 120 个字符，“制作说明”和“追加制作
说明”分别最多 1000 个字符；制作时长只允许为空或零及正整数，不设置业务上限。

用户界面只显示上述业务语言、业务原因和可恢复动作。`shape`、`dataNodeRef`、
`brandRef`、`itemRef`、`skuRef`、`owner`、`scope`、`contract`、`profile`、`effect`、
`source`、`readback`、`payload`、`problem code`、`capability`、`grant`、`UUID`、内部枚举
和 raw exception 均不得作为可见文案。机器字段、类型、范围、准入、唯一域和稳定错误
定位由 contract 声明，owner 在真实事实边界最终复核；界面只负责业务文案、控件、草稿
和即时提示。隐藏、禁用或即时校验不得被解释为业务防线，错误码也不得直接展示给用户。

不得由“识别码用于扫码、称重键码或快速检索”推导本批建设扫码枪、标签秤、设备协
议或销售解析入口；本批不新增识别码解析 HTTP 接口，真实销售/扫码 Journey 出现后须
携带品牌上下文另行设计；不得由“制作单显示名称”推导打印能力；不得由生产标签推导本期已实现
生产路由、生产工作台、队列、KDS、打印、营销标签、过敏原或物料角色。生产标签只作为商品级
0..1 稳定业务分类，未来生产链可在新专题中显式消费。历史订单与工作单仍按已冻结快照解释，移除识别码只影响后
续新识别，不重解释历史。

## Provenance

G-01–G-12 are promoted from
`doc/review/platform/2026-07-24-v2s-cross-generation-business-corpus-draft.md` §7.1–§7.12 under the
2026-07-25 Dexter decision. CIPG-01 was first promoted from the 2026-08-23 identifier/preparation design;
its production-tag terminology, cardinality and target semantics were superseded on 2026-08-24 by the
Dexter-accepted catalog workbench formal requirement, Journey, interaction and IA listed in `sourceRefs`.
Those sources also require user surfaces to use only business language and keep contract, UI and owner constraints separate. Detailed source ledgers and
cross-generation conflict records remain in their owning documents; they are not duplicated here as
independent truth.
