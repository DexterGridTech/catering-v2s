---
title: catering-v2s 业务语料库独立草稿(Claude 盲写版)
type: review-draft
status: DRAFT_FOR_CROSS_REVIEW
programId: V2S_W0_W4_EXECUTION
author: Claude
createdAt: 2026-07-24
---

# catering-v2s 业务语料库独立草稿(Claude 盲写版)

## 0. 编制说明

- **目的**:让人与两个 AI 在动手前对"同一个业务事实叫什么、是什么、不是什么"达成共识,杜绝臆想业务。
- **来源**:requirement-doc/design-v6(领域分析,最完整)、catering-server-v4(第一版实现 ~20%)、catering-all-v1(第二版 ~5%)、catering-all-v2(第三版 ~5%,含 Dexter 2026-07-24 前的全部术语裁决)。四仓由四个只读采集通道独立提取后,由我综合;**未参考 Codex 侧任何草稿**。
- **权威序(我的建议,待裁决)**:凡冲突,**all-v2 现行裁决 > v6 领域分析 > v4 实现 > v1**。理由:all-v2 是唯一承载 Dexter 显式术语裁决(如 2026-07-21"当前运营角色/可视数据节点")的仓;v6 提供最广的领域骨架但部分已被后续裁决修订。
- **纪律**:每条带出处;分歧不私自消解,进 §8 对照表;拿不准的进 §10 待裁决;"未知"明写未知,不臆想。
- **条目字段**:正名/英文/代码标识 → 一句话定义 → owner → 关键语义与不变量 → 关系 → 别名与曾用名(含禁用) → 例句 → 易混淆 → 出处 → 共识状态。当前范围(四域)全字段;未来范围(§7)用简表。

---

## 1. 一页总览:实体关系骨架(当前批准范围)

```text
集团空间 GroupWorkspace(平台隔离根,workspaceKey 双重语义:编码+URL 路径段)
 └─(初始化,0..1)商业集团 CommercialGroup(经营根,自有编码/名称,禁止复制空间字段)
     ├─(1..*)大区 Region ──(1..*)项目 Project ──(聚合内 JSON)项目分期 phases[{name}]
     │                        └─(1..*)门店 Store ──锁定:项目+经营租户+品牌;可选:总公司
     ├─(名册)经营租户 Tenant   (名册)品牌 Brand   (名册)总公司 HeadCompany
     │                     总公司 *──* 品牌:总公司品牌授权(关系表)
     └─(轻合同)Contract ── 门店 + 项目分期名称快照 phaseName + 门店经营租户;货号 itemCodes[](≥1)

IAM(与组织正交):
 空间账号 WorkspaceUser(userName/loginName/password;loginName 空间内唯一、本人一次设置)
  └─(0..*)运营角色任职 RoleAssignment = 账号 × 具体角色节点 × 运营角色
      运营角色 WorkspaceRole = 角色节点类型(五类之一,建后锁定) + capabilityKeys[] + pageAccessKeys[]
      节点五类:GROUP / REGION / PROJECT / HEAD_COMPANY / STORE(组织树仅前三+门店;总公司不在树内)
 三维授权互不推导:页面准入 ∥ 可视数据节点(数据范围) ∥ 动作能力
 新增用户与角色变化只经 邀请 Invitation(3 天有效、整单原子、手机号+OTP)

扩展(与实体正交):
 扩展字段定义 owner(每 workspace×entityType 一条 current rule) ∥ 值由 host 业务 owner 在自身事务保存
```

---

## 2. 平台与隔离

### 2.1 集团空间 / GroupWorkspace
- **代码标识**:`GroupWorkspace`;v4 表 `org_group_workspace`;id=`groupWorkspaceId`(v2 内部 id),key=`workspaceKey`(v6/v4/v1 作 `groupWorkspaceKey`/`group_workspace_key`)。
- **一句话定义**:平台的最高隔离与入口单元,各集团数据、账号、终端、外部协作都装在自己的集团空间里。
- **owner**:平台运行与隔离(v2s 四域中归 IAM/platform 侧)。
- **关键语义与不变量**:①**不是商业集团**——创建空间不自动初始化集团,空间字段不得充当集团资料;②禁用时业务入口/终端激活/外部出站整体阻断(v6);③只表达运行隔离、入口、展示与启停,不内置生产/测试/沙箱差异;④字段:唯一名称 `name`、运营后台标题 `operationsTitle`(spec 又作 `operationsAdminTitle`,见 §10-6)、`logoAssetRef`、`ENABLED/DISABLED`、version。**不存在"对内/对外名称"双名称**。
- **关系**:1 空间 —(初始化后)恰 1 商业集团;拥有本空间全部账号/角色/邀请/扩展规则。
- **别名与曾用名**:集团空间(正名);v6 曾废弃词 `Sandbox*`、`CommercialGroupIsolation`;**禁用**:`tenantKey`、`tenantId/tenant_id`(表隔离)、"动态品牌"、"对外名称/内部名称"、Branding 领域。
- **例句**:"华润在平台上有自己的集团空间,华东团队登录该空间的运营管理后台维护门店。"
- **易混淆**:≠商业集团(经营根);≠02-org 的 Tenant(经营租户名册)。
- **出处**:v2 `doc/specs/platform/modules/platform-workspace-lifecycle.md`("集团空间不是商业集团");v6 `01-平台运行与隔离域.md` §4.1;v4 `V001`;v1 `contracts/api/01-platform/group-workspace.contract.yaml`。
- **共识状态**:建议共识。

### 2.2 workspaceKey / 集团空间编码(双重语义)
- **代码标识**:`workspaceKey`(v2);`groupWorkspaceKey`(v6/v4/v1);URL 形如 `/{workspaceKey}/console`(v1)或 v2 stable keyed app route;格式 `^[A-Za-z0-9][A-Za-z0-9-]{0,63}$`(v2)。
- **一句话定义**:集团空间的稳定编码,同时是运营端登录/公开邀请等 URL 中区分空间的路径段。
- **关键语义与不变量**:①创建后**不可变、全局唯一、停用后不复用**(v1 原文);②URL 中的 key **只定位空间,不构成授权事实**(v2 裁决);③是"入口识别真相",不得回退默认空间、不得从显示名反查。
- **别名与曾用名**:集团空间 Key;**待裁决命名统一**:v2s 用 `workspaceKey` 还是 `groupWorkspaceKey`(§10-5)。
- **例句**:"运营同学收到的邀请链接里带着集团空间的 workspaceKey,打开就是自己集团的登录页。"
- **出处**:v2 契约多处 `name: workspaceKey, in: path` + `admin-routing-...md`;v6 术语表 §1/§5;v1 DD-E。
- **共识状态**:建议共识(命名拼写待裁决)。

### 2.3 双后台:运维管理后台 platform-admin / 运营管理后台 operations-admin
- **一句话定义**:平台只有两个后台——运维管理后台给"让系统正确跑起来的人",运营管理后台给"把生意做好的人";两个独立 app,永不合并。
- **关键语义与不变量**:①两套账号/权限/会话体系互不共享(平台管理员 ≠ 空间账号);②运维管理员不受业务角色约束,能力=后台提供的功能;③运营侧用户按经营主体分**商场管理方用户**(集团/大区/项目节点)与**商户用户**(总公司/门店节点);④运维后台绝不暴露 capabilityKey/pageKey 等授权内部词(v1 裁决)。
- **别名与曾用名**:v6 face 名 `platform-admin` / `catering-operations`;v4 header `X-Platform-Session-Id` / `X-Operations-Session-Id`;**禁用**:`mall-admin`、`tenant-admin`。
- **易混淆**:consumer face(契约暴露面声明)≠后台产品本身;face 不承担授权。
- **出处**:v2 kernel `04-four-domain-business-boundaries.md`、q01-q12 rulings §2.2;v1 `two-admin-backends-user-model.md`;v6 术语表 §12。
- **共识状态**:建议共识。

### 2.4 平台管理员 / PlatformAdminUser(运维侧账号)
- **代码标识**:`PlatformAdminUser`、`platform_admin_user`;会话 `PlatformSession`;v6 系统主体 `PLATFORM_SUPER_ADMIN`(不属任何空间)。
- **关键语义**:loginName 稳定唯一、accountName 创建后只读;至少保留一名可治理主体;登录防枚举(dummy hash,v2);跨空间高风险动作必须落运维审计(v6 `OperationsAuditRecord`)。**不拥有**空间账号/任职/角色事实;不代设空间账号密码、不直接改任职(v2 对 v1 路径的否定,见 §8-7)。
- **出处**:v2 `platform-admin-governance.md`、`platform-session-authentication.md`;v6 01 域 §4.2。
- **共识状态**:建议共识。

---

## 3. 组织与经营主体

### 3.1 商业集团 / CommercialGroup
- **代码标识**:`CommercialGroup`;v4 表 `org_commercial_group`。
- **一句话定义**:集团空间内的经营组织根,是组织树(大区→项目)与全部经营主体名册的最高业务坐标。
- **关键语义与不变量**:①每空间**至多一个**,由平台在空间详情显式"初始化集团"产生(幂等);②**必须单独录入集团编码与集团名称,禁止复制 workspaceKey/空间名称**(v2 原文);③冲突码 `COMMERCIAL_GROUP_ALREADY_INITIALIZED`;④v6:`displayBrandName` 可承接集团展示品牌(如"华润万象生活"),它不是餐饮 Brand。
- **关系**:1—* 大区;名册(品牌/租户/总公司)归其下。
- **禁用**:用"平台/客户/商户"表达商业集团(v6)。
- **例句**:"给华润的集团空间初始化商业集团后,才能建大区和项目。"
- **出处**:v2 `commercial-group-root.md`;v6 02 域 §4.1;v1 `commercial-group.contract.yaml`("at most one")。
- **共识状态**:建议共识。

### 3.2 大区 / Region;项目 / Project;项目分期 / phases
- **代码标识**:`Region`/`org_region`;`Project`/`org_project`;项目内 `phases: [{name}]`(JSON Array)。
- **一句话定义**:商业集团下固定两层管理层级"大区→项目";项目即购物中心(如长沙万象城);分期是项目聚合内的有序名称列表。
- **关键语义与不变量**:①层级**固定**为集团→大区→项目(v2 现行;v6 曾允许大区多级——分歧见 §8-1);②大区不跨集团,项目只可在同集团大区间调整;③**分期不是实体**:无 ID/状态/版本,trim 非空、项目内唯一、整组 CAS;分期改名/删除**不回写**合同里的历史名称快照;④大区不拥有订单/库存等交易事实,不能替代门店做交易锚点(v6)。
- **别名与曾用名**:项目=购物中心项目/商场/项目方(口语);**禁用**:`Mall` 作实体或前缀(v6:`MallErpReportingSnapshot`→`ProjectErpReportingSnapshot`)。
- **例句**:"深圳万象城项目分二期招商,合同上记的是签约当时的分期名称。"
- **出处**:v2 `organization-hierarchy.md`(含 phases 裁决);v6 02 域 §4.2/§4.3;v4 V001。
- **共识状态**:建议共识(大区层级数为已决分歧,见 §8-1)。

### 3.3 门店 / Store
- **代码标识**:`Store`;v4 表 `store_registry`(独立 registry,不在 org tree)。
- **一句话定义**:某项目下、某经营租户以某品牌经营的门店实例,是经营、交易与数据范围的最小业务锚点。
- **关键语义与不变量**:①关系**严格为"项目+经营租户+品牌",创建后锁定**;总公司可空可调,非空时该总公司必须持有门店锁定品牌的有效授权;②v2 现行:`ENABLED/DISABLED` 只是主数据候选状态,**不代表营业或经营资格,不使合同失效**;③v6 原则:**换经营者必须新建门店**(不改 operatingTenantRef 换人);④门店不是铺位、不是合同、不是外部平台门店(外部门店 ID 归渠道绑定/映射)。
- **关系**:*—1 项目;*—1 租户;*—1 品牌;*—0..1 总公司;1—* 合同;(未来)1—* 渠道绑定/终端/库存对象。
- **别名与曾用名**:店铺(仅顾客/营销口语);v4 曾有 `operatingStatus(NOT_OPEN/PENDING_OPEN/OPEN)`+`isValid`(现行已退役该词面,见 §8-2)。
- **例句**:"喜茶(租户:深圳喜茶餐饮公司)在深圳万象城项目用'喜茶'品牌开了一家门店。"
- **易混淆**:门店 ≠ 档口/工位(v6 履约域 `WorkstationDefinition`);门店 ≠ 外部平台店铺。
- **出处**:v2 `store-management.md`;v6 02 域 §4.11;v4 `store_registry`。
- **共识状态**:建议共识。

### 3.4 经营租户 / Tenant
- **代码标识**:`Tenant`;v4 表 `tenant_registry`(`tenant_code` 建后不可改)。
- **一句话定义**:集团内实际经营门店的主体(公司)名册条目,被门店以 `operatingTenantRef` 引用。
- **关键语义与不变量**:①只表达实际经营主体,**不承载总公司类型**;②默认不是 IAM 节点、不进终端投影(v4);③法人信息(`legalProfile`:法人名称/统一社会信用代码)是租户/总公司的可选属性,**不建独立 LegalEntity 实体**(v6)。
- **别名与禁用**:**禁用** `TenantCompany`、`companyType`、用"商户"表达租户(v6);历史上 v4 曾把租户与总公司混在 `TenantCompany(companyType)` 一个实体,后拆分(§8-3)。
- **易混淆**:≠隔离意义上的"租户"(隔离根是集团空间)——**"tenant"一词在本系统只允许指经营租户**。
- **出处**:v6 02 域 §4.5、术语表 §4;v4 拆实体设计;v2 `business-entity-management.md`。
- **共识状态**:建议共识。

### 3.5 品牌 / Brand;总公司 / HeadCompany;总公司品牌授权 / HeadCompanyBrandAuthorization
- **代码标识**:`Brand`/`brand_registry`;`HeadCompany`/`head_company_registry`;授权关系表 `head_company_brand_authorization`(**关系表,非 JSON**,v2 裁决)。
- **一句话定义**:品牌是集团内餐饮品牌名册;总公司是品牌侧管理与可见性主体(也是 IAM 节点);授权表记录哪个总公司可管理哪些品牌的模板资料。
- **关键语义与不变量**:①同一品牌可由不同租户经营、可授权给多个总公司;②**总公司不是门店的管理上级、不在组织树内**;③总公司可见门店范围**只来自 `Store.headCompanyRef`,不得从品牌授权反推同品牌全部门店**(v6/v4 一致红线);④移除仍被门店使用的品牌授权必须拒绝并返回受影响门店摘要(v2);⑤门店选总公司时校验其持有门店品牌的有效授权。
- **禁用**:`TenantHeadCompany`、`TenantBrandAuthorization`。
- **例句**:"喜茶总公司被授权管理'喜茶'品牌的资料模板,但它只能看到把总公司字段指向它的那些门店。"
- **出处**:v6 02 域 §4.6-4.8;v4 拆实体设计 §3.2-3.3、可见性快照;v2 `business-entity-management.md`。
- **共识状态**:建议共识。

### 3.6 集团自定义门店类型 / StoreOperationType
- **现状分歧(待裁决,§10-3)**:v6 定义为**集团自定义实体**(`typeCode` 集团内唯一,平台不得写死正餐/快餐/茶饮);v4 实现为字段;v1 明确**删实体改为契约固定枚举**(`CATERING_TEA/CATERING_FAST_FOOD/CATERING_FULL_SERVICE/RETAIL_DEFAULT`);v2 四域范围未触及。到店服务/渠道能力组合未来按门店类型驱动(v6),该词的实体/枚举之争影响 R5 后的设计。
- **共识状态**:待裁决(当前范围可暂不落)。

---

## 4. 合同(轻合同)

### 4.1 轻合同 / Contract(light-contract)
- **代码标识**:`Contract`;编号 `contractNo`(spec 正文曾作 `contractNumber`,§10-6);页面 `PG-CONTRACT-STORE-MANAGE`;能力 `BC-CONTRACT-CREATE/EDIT/INVALIDATE`。
- **一句话定义**:门店与项目方的轻量租赁/经营合同记录,核心是"哪家门店、哪个分期、哪个经营租户、哪些货号、什么起止"。
- **关键语义与不变量**:①**最关键关系 = 门店 + 项目分期名称快照(phaseName,创建时字符串快照) + 门店经营租户**;项目只提供数据范围与分期候选,品牌不是合同字段;②**创建即生效**;状态仅 `VALID→INVALID` 单向手动,无草稿/审批/续签/恢复;③编号创建后锁定;④不限一店多合同,**系统不推导"当前合同"**;⑤扩展值随合同聚合保存。
- **货号 / itemCodes**:一份合同 1..* 个货号,规范化去重、按录入顺序;**货号只属于合同**。(v1 曾为单值 `goodsCode`,分歧见 §8-4;v6 有更重的 `ContractGoodsCodeCandidate`→销售项分配模型,属未来范围。)
- **别名**:Pack key `light-contract` 只是系统设计分类,前端 feature 保持 `contract-management`。
- **例句**:"这家门店在二期的合同挂了三个货号,月底 ERP 上报按合同货号走。"
- **易混淆**:合同 ≠ 门店营业状态;合同失效不自动停用门店,门店停用也不使合同失效。
- **出处**:v2 `light-contract.md`、q01-q12 §4;v6 03 域(合同是资格输入,不是万能营业状态);v1 域地图(货号=合同属性)。
- **共识状态**:建议共识(货号单值→数组已由 v2 裁决,记录于 §8-4)。

### 4.2 平台只读概览三件套(集团空间总览 / 组织与经营概览 / 合同概览)
- **关键语义**:平台侧只读排障/审计面,**不是第二管理入口**;无 mutation;商业集团名称/编码必须来自 organization owner,不得用空间字段顶替;合同概览的 `phaseName` 是创建时快照,不回连可变分期;界面用词"总览/概览",**不用"诊断"**(Q02)。
- **出处**:v2 `organization-overview.md`、`contract-overview.md`、q01-q12 Q02。
- **共识状态**:建议共识。

---

## 5. 账号与权限(IAM)

### 5.1 空间账号 / WorkspaceUser 与三要素 userName / loginName / password
- **一句话定义**:业务运营人员在某集团空间内的账号;`userName`=姓名,`loginName`=登录名(**空间内唯一、只允许本人设置一次**),`password` 永不回显;手机号用于邀请/验证码登录/恢复。
- **关键语义与不变量**:①账号与凭证、任职、会话、密码重置代际、投递 outbox 各自独立;②**管理员不代设密码**——重置只发起,由本人 OTP 设新密码(v2 对 v1 的否定);③账号可**零任职保留**,仍可登录空工作台;④停用账号 ≠ 撤销角色,两者独立;⑤同一手机号在不同集团空间是不同空间账号(v1 隔离链)。
- **命名分歧**:v6 术语表废弃"由 `WorkspaceUser`/`Principal` 承担登录凭据"的旧用法,主张 `Account`(凭据)与 `Principal`(授权主体)分离;v2 现行仍用"空间账号 WorkspaceUser"作为业务词。**建议**:业务文案用"空间账号",wire 名待 Codex 物化契约时统一(§10-4)。
- **例句**:"新店长收到邀请短信,自己设了登录名和密码——运维和项目管理员都看不到这个密码。"
- **出处**:v2 `workspace-account-administration.md`、q01-q12 Q10;v6 04 域 §4.1;v1 workspace-user contract。
- **共识状态**:建议共识(wire 命名待裁决)。

### 5.2 运营角色 / WorkspaceRole
- **代码标识**:`WorkspaceRole`;节点类型 `WorkspaceOrganizationType ∈ {GROUP, REGION, PROJECT, HEAD_COMPANY, STORE}`(创建后锁定);`capabilityKeys[]`(JSONB 去重数组)+ `pageAccessKeys[]`。
- **一句话定义**:可命名的角色定义(如"大区管理员""项目财务"),由角色节点类型加一组可执行动作和页面准入组成。
- **关键语义与不变量**:①能力用 **JSONB bundle,禁止重建 role-capability 关联表**(v2 明确否定 v4/v1 的 grant 表形态);②capability key 形如 `BC-ORG-STORE-CREATE`、`BC-IAM-STORE-INVITE`;历史 key(`BC-IAM-MEMBERSHIP-MANAGE`、`…-INVITE-{CREATE,CANCEL,REISSUE}`)已**物理退役,不留 alias**(2026-07-21 decision);③**没有 scopePolicy DSL**:可视范围由角色节点类型固定推导(集团全见;大区见本大区及以下;项目见本项目及门店;门店见本店;总公司仅用户管理,不参与门店经营查看)——v4 的六值 `scopePolicy` 枚举与 v1 的删除史见 §8-5。
- **例句**:"给'项目财务(深圳万象城)'这个角色勾上合同管理页面和 BC-CONTRACT-EDIT 能力。"
- **出处**:v2 `workspace-role-administration.md`、q01-q12 §3.0、`2026-07-21-workspace-role-capability-historical-key-retirement.md`;v4 iam2;v1 role.schema。
- **共识状态**:建议共识。

### 5.3 运营角色任职 / RoleAssignment;当前运营角色;可视数据节点
- **代码标识**:`RoleAssignment`/`roleAssignmentRef`(wire);`selectedDataNode{type,ref,ancestorPath}`;Cascader 深度 `requiredDataNodeType ∈ {NONE, REGION, PROJECT, STORE}`。
- **一句话定义**:任职=某空间账号在某个具体角色节点上持有某运营角色;右上角切"**当前运营角色**"(显示"角色名(节点名)"),左下角选"**可视数据节点**"。
- **关键语义与不变量**:①任职是会话与切换的技术主键;②角色 A→B **不直接编辑,重新授权必须走邀请**;撤销任职 ≠ 停用账号;③切运营角色关闭旧业务 Tab 回固有首页;仅切数据节点保留仍准入的 Tab;④**术语裁决(2026-07-21,Dexter)**:用户可见文案一律"当前运营角色/可视数据节点",**禁用"当前身份""查看范围"**(仅历史迁移对照可出现);⑤可视数据节点只决定"读哪段数据",不授予页面或动作。
- **例句**:"她先切到'大区管理员(华东大区)',再把可视数据节点选到杭州万象城,看该项目的门店列表。"
- **出处**:v2 q01-q12 §3.0/§3.4、`workspace-membership.md`、`workspace-session-context.md`。
- **共识状态**:已裁决(照录)。

### 5.4 三维授权:页面准入 ∥ 数据范围 ∥ 动作能力
- **一句话定义**:页面准入(RolePageGrant)、可视数据范围、动作能力是三个独立维度,任何一维不得推导另一维。
- **关键语义**:①"数据可见不自动产生页面准入;页面准入不自动产生动作能力;动作能力不扩大数据可见范围"(v2 原文);②页面目录为 closed catalog(`pageDesignKey`,五类角色首页固有可见 `pageAccessManaged=false`,12 业务页可配);③用户管理固定拆**五类独立菜单/页**(集团/大区/项目/总公司/门店用户管理,`PG-IAM-*-USERS`),**禁止退化为通用"组织成员"菜单**;④系谱:v4 首创"读范围/页面准入/动作授权三分离",v2 承接并删掉范围 DSL。
- **出处**:v2 `workspace-page-access.md`、q01-q12 §3/§6.9;v4 core-design §5。
- **共识状态**:建议共识。

### 5.5 邀请 / Invitation(节点访问邀请)
- **代码标识**:`Invitation`(v6/v1 `NodeAccessInvitation`);状态 `PENDING/CONFIRMED/CANCELED/EXPIRED`;一次性 `inviteToken`。
- **一句话定义**:新增运营用户与任何角色授权变化的**唯一入口**:管理员对手机号发出"到某节点担任某些角色"的邀请,本人确认后生效。
- **关键语义与不变量**:①固定 **3 天**有效,重发使旧 token 失效;②多角色**整单原子**(任一冲突整单拒绝);③接受流程顺序(v2 修订):先展示对象/角色/有效期/脱敏手机号 → 同意 → 完整手机号+OTP → 补齐 userName/loginName/password(如无账号)→ 原子完成;④三类发起:平台发起/运营发起/公开接受;⑤手机号绑定防串用(`MOBILE_MISMATCH`,v1)。
- **例句**:"项目管理员邀请 138…的师傅当门店店员,他三天内点开链接验证码确认后就能登录了。"
- **出处**:v2 `workspace-invitation-lifecycle.md`、q01-q12 Q06/Q08/Q10/Q11;v1 DD-E;v6 04 域 §4.4.2。
- **共识状态**:建议共识。

### 5.6 会话与恢复:WorkspaceSession / 访问恢复
- **关键语义**:①keyed 登录(URL 带 workspaceKey);身份与数据范围分离;**URL 不可成为 session owner**;②`fixedStoreRef` 只由门店身份 readback 产生(门店角色只读自己门店的"基本资料/合同信息"两个子 Tab;总公司不进入门店经营);③访问恢复把 page/action/data/status/session/credential 类错误映射到唯一恢复出口,不是万能 recovery service。
- **出处**:v2 `workspace-session-context.md`、`workspace-access-recovery.md`、q01-q12 §7。
- **共识状态**:建议共识。

---

## 6. 扩展字段(entity-extension)

- **一句话定义**:给业务实体追加集团自定义字段的通用能力:定义与值分离——定义 owner 每 `(workspace, entityType)` 只存一条 current rule;值由各实体的 host 业务 owner 在自身聚合事务里存 `extensionValues JSONB`。
- **关键语义与不变量**:①适用实体 closed enum:`COMMERCIAL_GROUP/REGION/PROJECT/STORE/BRAND/TENANT/HEAD_COMPANY/CONTRACT`;字段类型 `TEXT/NUMBER/DATE/BOOLEAN/SELECT`;②**运营用户无感**:字段按业务含义混排进原实体表单,不出现"扩展信息/自定义字段"分区;③容错解析:删除/未知/类型不兼容的旧值不展示但**原样保留**;④`host-business-owner` 是分派规则不是新服务;⑤定义无历史版本(current rule only)。
- **系谱**:v6/v4 曾有重治理(`EntityExtensionSchema`/`fieldStatus` 三态);v2 裁决保持 all-v1 式简单(Q07:从 ORG 专属升为跨域统一,但不继承 v4 复杂度)。
- **出处**:v2 `entity-extension.md`、q01-q12 §5/Q07;v1 extension-schema.schema.yaml;v4 V014。
- **共识状态**:建议共识。

---

## 7. v6 全域概念清单(22 域逐实体;当前四域之外均为未来范围,勿在当前实现引用,但命名与边界从现在起对齐)

> 组织方式:按 v6 七层 × 22 域;每域一表,覆盖该域**全部主权事实实体**。出处均为 `requirement-doc/design-v6/01.领域设计/<域文件>.md` 的节号;层级/红线出自 `00-V6领域地图与外部系统边界.md` 与 `00.V6统一术语与废弃词表.md`。与 §2–§6 重叠的条目此处只补 v6 独有语义。

### 7.1 平台坐标层

**01 平台运行与隔离域**

| 术语(中/英) | 定义与关键红线 | 出处 |
|---|---|---|
| 集团空间 `GroupWorkspace` | 稳定运行空间、入口身份、最高隔离锚点;禁用时业务入口/终端激活/凭证刷新/外部出站/开放 API 全阻断;不内置生产/测试/沙箱差异 | §4.1;红线 R07 |
| 外部入口键 `groupWorkspaceKey` | 编码+URL 路径段双重语义(详见 §2.2) | 术语表 §1/§5 |
| 内部隔离坐标 `groupWorkspaceId` | Key 解析后的内部事实坐标,用于库/缓存/消息/TDP/审计/分片;废弃 `tenantId/sandboxId` | 术语表 §1/§5 |
| 运行隔离上下文 `IsolationContext` | 由 id+业务范围派生的运行期坐标,**不是资源实体** | §3.3 |
| 平台运维审计记录 `OperationsAuditRecord` | 平台超管跨空间查看/维护/导出/治理必留的审计产物 | §4.2 |
| 平台事实流 `BusinessFact` | 源业务域显式发布的已发生业务事实;平台级基础设施 | §4.3 |
| 规则工作者 `RuleWorker` | `MQ + RuleWorker` 消费 BusinessFact 的规则运行时(起步期;Flink 不进) | §4.3 |
| 业务规则运行日志 `BusinessRuleRunLog` / 结果 `BusinessRuleOutcomeProduced` | 规则运行记录与命中结果事件;营销域只消费 outcome,不订阅来源域内部表 | §4.3 |
| 废弃:`Sandbox*`、`CommercialGroupIsolation` | 旧隔离层词,仅历史迁移语境 | §5 |

**02 组织与经营主体域**(核心实体见 §3;此处补 v6 独有)

| 术语(中/英) | 定义与关键红线 | 出处 |
|---|---|---|
| 法人信息 `legalProfile` | 租户/总公司可选**属性**(法人名称/统一社会信用代码/外部编码);不建 `LegalEntity` 实体、无法人名册 | §4.4 |
| 集团自定义门店类型 `StoreOperationType` | 集团自定义,`typeCode` 集团内唯一,**非平台枚举**;正餐/快餐/茶饮仅样例(与 v1 枚举化分歧见 §8/§10-3) | §4.12 |
| 组织范围 `OrgScope` | 范围表达非权限绑定;`scopeKind`:COMMERCIAL_GROUP/REGION/PROJECT/STORE/BRAND/TENANT/HEAD_COMPANY/COMPOSITE;仅集团/大区/项目/门店可作 TDP 组织投影节点 | §4.13 |
| 组织主数据维护策略 `OrgMasterDataPolicy` | `MANUAL/AUTO_SYNC`;AUTO_SYNC 下人工维护被阻断;起步默认 MANUAL | §4.15 |
| 实体外部编码 `externalCode` | 组织实体可选属性,与内部 `code` 不同字段;起步仅记录不校验唯一 | §4.16 |
| 项目服务商归属 `ProjectServiceProviderAssignment` | 项目级 ISV/服务商"选择/归属"事实;凭证/回调/诊断归 16 域 | §4.17 |

**03 商业关系与合同域**(v2 轻合同为其最小子集,见 §4)

| 术语(中/英) | 定义与关键红线 | 出处 |
|---|---|---|
| 项目经营管理关系 `ProjectManagementRelation` | 管理方/业主方是商业关系,不是组织树 | §4.1 |
| 项目业主分期 `ProjectOwnerPhase` | 项目业主侧分期 | §4.2 |
| 项目参与方关系 `ProjectPartyRelation` | 项目参与方关系 | §4.3 |
| 门店租赁合同 `StoreLeaseContract` | 合同是资格**输入**,不是万能营业状态 | §4.4 |
| 合同空间约定行 `ContractedSpaceLine` | 合同内铺位/空间约定 | §4.5 |
| 合同货号候选 `ContractGoodsCodeCandidate` | 货号**候选**,不污染商品与当前销售项;由 06 域销售项选用 | §4.6;红线 R03 |
| 门店营销参与协议 `StoreMarketingParticipationAgreement` / 权益类型接受行 `AcceptedBenefitTypeLine` | 只控制门店接受哪些权益类型 | §4.7/4.8 |
| 商业责任规则 `CommercialResponsibilityRule` | 解释责任,不计算金额 | §4.9 |
| 门店合同状态快照 `StoreContractualStatusSnapshot` | 无有效合同门店不能正常收退款,但项目管理方可后台退款 | §4.10 |
| 门店商业资格快照 `StoreCommercialEligibilitySnapshot` / 商业责任快照 `CommercialResponsibilitySnapshot` | 资格/责任派生快照 | §4.11/4.12 |
| 维护策略 `CommercialMasterDataPolicy` / 外部编码 `CommercialExternalCode` | 同组织域对应概念 | §4.13/4.14 |

**04 账号与权限契约域**(v2 现行模型见 §5;此处为 v6 完整模型)

| 术语(中/英) | 定义与关键红线 | 出处 |
|---|---|---|
| 账号 `Account` | 可认证登录的稳定身份与登录凭据;认证与业务授权分离;废弃由 `WorkspaceUser/Principal` 承担凭据 | §4.1 |
| 授权主体 `Principal` | 可授权主体,不直接挂业务角色 | §4.2 |
| 登录凭证引用 `CredentialRef` / 外部身份绑定 `ExternalIdentityBinding` | 凭证引用/外部身份绑定结果 | §4.3/4.4 |
| 空间登录凭证 `WorkspaceLoginCredential` | 运营用户自设 `loginName`+密码;验证码仅邀请确认/首次进入/恢复 | §4.4.1 |
| 节点访问邀请 `NodeAccessInvitation` | "某管理员希望某手机号在某节点获得某角色";不代建账号密码 | §4.4.2 |
| 当前工作上下文 `WorkContext` | 授权判断一等输入;范围授权不跨 OrgScope 泄漏 | §4.5 |
| 能力定义 `CapabilityDefinition` | 业务域贡献的可授权动作清单;`PermissionManifest` 为历史兼容名 | §4.6 |
| 角色模板 `RoleTemplate` / 角色动作授权 `RoleCapabilityGrant` | 角色与动作授权(v2 现行改 JSONB bundle,见 §5.2) | §4.7 |
| 页面定义/准入 `PageDefinition`/`RolePageAccessGrant` | 页面准入模型 | §4.7.3 |
| 节点成员关系 `UserNodeMembership` / 角色分配 `UserNodeRoleAssignment` | 任职关系与角色授权,分别落库不写回账号 | §4.8 |
| 直接权限授予 `PermissionGrant` / 资源范围授权 `ResourceScopeGrant` | 直接授予/资源范围授权(v2 未采,未来再议) | §4.9/4.10 |
| 一次性/短时提权 `DelegatedAuthorization` | 不是审批平台 | §4.11 |
| 服务主体 `ServicePrincipal` | 服务账号;必走权限域,token 存在≠有授权 | §4.12 |
| 授权/可读范围/导航快照 `AuthorizationSnapshot`/`ReadableScopeSnapshot`/`NavigationSnapshot` | 云端授权真相投影;与终端授权快照分离 | §4.13/A/B |
| 终端当前操作人上下文快照 `TerminalOperatorContextSnapshot`(投影 `…Projection`) | POS 当前操作人授权投影;终端激活≠操作人授权;撤权即失效 | §4.14 |
| 授权判断结果 `AuthorizationDecision` / 授权审计事实 `AuthorizationAuditFact` | 一次授权判断及其审计 | §4.15/4.16 |

### 7.2 经营对象层

**05 商品目录域**

| 术语(中/英) | 定义与关键红线 | 出处 |
|---|---|---|
| 商品目录 `ProductCatalog` | 商品容器,owner=`HeadCompanyCatalogOwner`/`StoreCatalogOwner`,绑定 brandRef;品牌本身不作 owner;总部库=模板/候选,门店复制后独立生命周期;**不得把 CatalogItem 叫"商品目录"** | §4.1 |
| 商品(壳)`CatalogItem` | 核心聚合根,一个可经营对象;下单必须有商品壳;`itemKind`:STANDARD/SERVICE/COMPOSITE/BENEFIT/EXTERNAL_ORDER_TEMP_ITEM;`usageCapabilities[]`:SELLABLE/STOCK_MANAGED/BOM_COMPONENT/PRODUCIBLE;称重=`measureMode=WEIGHED` 非独立种类;`materialRole`:RAW_MATERIAL/PACKAGING_MATERIAL/SEMI_FINISHED。废弃 `BENEFIT_PRODUCT/OPTION_ITEM/MATERIAL_ITEM/SEMI_FINISHED_ITEM/PACKAGING_ITEM/WEIGHED_ITEM/product_kind`;v4 系谱:"模板"→"商品形态 `shapeKey`" | §4.2 |
| 商品管理分类 `CatalogCategory` | 一/二级管理分类;≠POS/小程序展示分区 | §4.3 |
| 商品静态标签 `CatalogTag` | 新品/招牌/辣/含坚果等静态标签;沽清/会员专享等动态标签不属本域 | §4.4 |
| 商品属性定义 `CatalogAttributeDefinition` | 档案扩展描述字段(保质期/口味说明);不是 SKU 销售属性 | §4.5 |
| SKU 销售属性/值 `CatalogSkuSalesAttribute(/Value)` | 生成 SKU 组合的维度与值字典(颜色/尺码/容量);只区分 SKU,不是点单选项 | §4.5.1/2 |
| 销售计量单位 `SalesUnit` | `unitKind`:COUNT/WEIGHT/VOLUME/SERVICE_DURATION/PACKAGE | §4.6 |
| 商品识别码 `ProductIdentifier` | 条码/PLU/助记码/店内编码;外部平台商品 ID 归 16 域映射 | §4.7 |
| SKU 管理策略 `CatalogItemSkuPolicy` | `skuMode`:NONE/OPTIONAL_TABLE/REQUIRED_MATRIX;REQUIRED_MATRIX 与点单选项互斥 | §4.8 |
| 规格 `ProductSku` | 可识别销售/库存规格单元(大杯/中杯);属性值组合同商品内唯一;与 OptionValue 分开 | §4.9 |
| 点单选项组/值 `OptionGroup`/`OptionValue` | kind:METHOD/TASTE/TEMPERATURE/SWEETNESS/DONENESS/ADD_ON/PACKAGING/REMARK/CUSTOM;选项耗料由 `ProductBom(ownerTargetType=OPTION_VALUE)` 表达 | §4.10 |
| 套餐结构 `CompositeItemStructure` | 稳定商品型套餐(仅 COMPOSITE_ITEM);禁套套餐;团购/秒杀/储值套餐归营销 | §4.11 |
| 商品间关系 `CatalogItemRelation` | SUBSTITUTE/SIMILAR/MATERIAL_OF/PACKAGING_OF/BENEFIT_SHELL_OF/REPORTING_GROUP/MANUAL_LINK | §4.12 |
| 制作画像(菜谱提示)`PreparationProfile` | 给履约/生产/打印的提示:`stationTags[]`(冷菜/热厨/吧台/烘焙/打包)/预估时长/打印名;不描述设备路由。**"菜谱"=PreparationProfile+ProductBom,无独立菜谱实体** | §4.13 |
| 外部商品身份映射 `ExternalCatalogIdentity` | 上游 ERP/主数据身份映射;不表达美团/饿了么菜单对象 | §4.14 |
| (边界)供应商/采购/仓库/调拨 | **本系统显式不建**,归外部 ERP/专业供应链;非遗漏 | 域文档边界节 |

**06 销售集合与发布域**

| 术语(中/英) | 定义与关键红线 | 出处 |
|---|---|---|
| 销售集合 `SalesCollection` | 门店菜单/销售范本/自助/预点餐/外卖菜单统一抽象;起步 owner=StoreRef;`sourceMode`:MANUAL/BRAND_TEMPLATE_COPY/EXTERNAL_MENU_IMPORT/ORDER_DRIVEN_REPAIR | §4.1 |
| 销售集合版本 `SalesCollectionVersion` | 草稿可编辑,发布版本冻结不可改 | §4.2 |
| 销售展示分区 `SalesSection` | 菜单目录树;≠商品分类;`sectionKind`:CUSTOM/FROM_CATALOG_CATEGORY/FEATURED/BENEFIT/TIME_SLOT/CHANNEL | §4.3 |
| 销售商品行(销售项)`SalesItem` | 可售入口;每行引用一个 CatalogItem,创建后不可换绑;动态可售不在此 | §4.4 |
| 门店销售项货号分配 `StoreSalesItemGoodsCodeAssignment` | 当前可售销售项层的合同货号分配;`assignmentSource`:MANUAL/CONTRACT_DEFAULT/BATCH_RULE;批量调整只影响未来订单 | §4.5 |
| 基础挂牌价 `ListedSalePrice` | 价格分层:标准价→集合挂牌价→SKU 挂牌价→营销权益价→支付实付→交易成交价;本域不做会员价/活动价 | §4.6 |
| 销售展示策略 `SalesPresentationPolicy` | 招牌/推荐/新品/营养展示、默认口味提示 | §4.7 |
| 门店销售编辑策略 `StoreSalesEditPolicy` | 门店侧编辑准入;不是总部字段锁死/强继承 | §4.8 |
| 销售集合启用 `SalesCollectionActivation` | 菜单在哪个门店渠道绑定、什么时间规则生效;`publicationRoute`:TERMINAL_TDP/CUSTOMER_APP_API/EXTERNAL_PLATFORM_SYNC/INTERNAL_ONLY;绑定集合非版本。废弃 `SalesCollectionAssignment`/`AssignSalesCollection` | §4.9 |
| 销售窗口策略 `SalesWindowPolicy` | 时段菜单/可售窗口;不可用日期优先于可用日期 | §4.10 |
| 销售入口动作能力策略/快照 `SalesEntryActionCapabilityPolicy`/`Snapshot` | displayable/cartAddable/submittable/requiresStaffAssistance/customerHintText;称重/时价商品小程序可展示不可加购。废弃 `SalesSurface` | §4.11 |
| 销售可用性控制 `SalesAvailabilityControl` | 人工上下架/沽清/限售;`controlKind`:MANUAL_STATUS/SALE_LIMIT/INVENTORY_SOLD_OUT_HINT/EXTERNAL_STATUS_SYNC;退菜后不自动恢复 | §4.12 |
| 销售下单约束策略 `SalesOrderingConstraintPolicy` | 起售量/步进/低消/开台必点/服务费提示 | §4.13 |
| 销售发布 `SalesPublication` | 发布成功=校验+快照持久化+outbox;**≠TDP 送达/ACK/POS 展示/外部同步成功**。废弃 `menu_release` | §4.14 |
| 有效销售视图 `EffectiveSalesView` / 已发布销售快照 `PublishedSalesSnapshot` | 发布时持久化的视图候选/对外不可变快照 | §4.15/4.16 |
| 门店渠道绑定期望销售状态 `BusinessChannelBindingSalesDesiredState` | 给 15/16 域的内部目标状态/索引契约;非 TDP payload/外部结果 | 术语表 §9 |

**07 销售库存与物料扣减域**

| 术语(中/英) | 定义与关键红线 | 出处 |
|---|---|---|
| 库存对象 `StockTarget` | 门店级;`stockTargetType`:CATALOG_ITEM/SKU;消耗单位=库存真相单位;`allowNegative` | §4.1 |
| 库存余额 `StockBalance` | 读模型,由流水重建;`stockState`:IN_STOCK/LOW_STOCK/OUT_OF_STOCK/NEGATIVE/UNKNOWN | §4.2 |
| 库存变化流水 `StockChangeLedger` | 追加式事实;`sourceType`:ORDER_DEDUCTION/RESTORE/EXTERNAL_COVERAGE/MANUAL_ADJUSTMENT/MANUAL_COUNT_COVERAGE/GOVERNANCE_ADJUSTMENT/BENEFIT_SERVICE_COVERAGE;无 SYSTEM_RECALCULATION | §4.3 |
| 物料清单 `ProductBom`/`ProductBomLine` | 商品/SKU/选项值下的库存消耗规则(配方);SKU 级 BOM 表不同配方 | §4.4 |
| 库存权威配置 `InventoryAuthorityConfig` | 内部/外部权威(INTERNAL/ERP/BENEFIT_SERVICE) | §4.5 |
| 扣减/恢复计划与执行行 `StockDeductionPlan`/`DeductionExecutionLine`/`StockRestorePlan`/`RestoreExecutionLine` | 计划-执行分离;超卖无法履约走退款,不做复杂自动补偿 | §4.6/4.7 |
| 外部库存调用记录 `ExternalInventoryCallRecord` | 外部同步可覆盖当前快照,须留审计+流水 | §4.8 |
| 销售库存视图 `SalesStockView` | 卖端库存提示读模型 | §4.9 |

### 7.3 顾客、权益与忠诚度层

**08 顾客与会员身份域**

| 术语(中/英) | 定义与关键红线 | 出处 |
|---|---|---|
| 顾客主体 `CustomerProfile` | 某隔离上下文/业务范围内被识别的消费者;非全局自然人/CDP 主档;有会员资格称"会员";**"客户"不用于后台用户** | §4.1 |
| 消费者身份系统 `ConsumerIdentitySystem` | 可识别消费者身份的系统/命名空间(历史 `IdentitySystem`) | §4.2 |
| 顾客身份 `CustomerIdentity` / 身份凭证 `IdentityCredential` | 某身份系统中的身份记录/识别入口;公域私域并存 | §4.3/4.4 |
| 身份绑定 `IdentityBinding` | 身份间绑定/归并/关联;门店私域与项目公域隐式绑定 | §4.5 |
| 会员计划 `MembershipProgram` / 会员等级 `MembershipLevel` | 会员卡体系(项目公域/门店私域/品牌会员)与等级 | §4.6/4.7 |
| 会员账户/资格 `MembershipAccount`/`Membership` | 某身份在某计划下的会员关系;会员看到余额/券≠身份域拥有资产(资产归 09) | §4.8 |
| 顾客同意 `CustomerConsent` | 联系/营销触达/隐私授权最小事实 | §4.9 |
| 顾客标签定义 `CustomerTagDefinition` | 轻量标签;不是 CRM 人群包 | §4.10 |
| 身份解析结果 `CustomerIdentityResolution` | 一次身份解析结果,可被交易/营销/支付引用 | §4.11 |

**09 权益账本域**

| 术语(中/英) | 定义与关键红线 | 出处 |
|---|---|---|
| 权益资产系统 `BenefitAssetSystem` | 独立资产/账本系统边界(联邦模型):哪套身份识别持有人、哪个经营主体拥有 | §4.1 |
| 账本空间开通 `LedgerSpaceOpening` | 为某经营范围开通的内部账本空间 | §4.2 |
| 权益持有人 `LedgerHolder` | `benefitAssetSystemRef+consumerIdentityRef` 定位 | §4.3 |
| 账户模板 `BenefitAccountTemplate` | 数值类权益记账模板;积分/购物金/储值/购物卡统一账本模型 | §4.4;红线 R02 |
| 权益账户 `BenefitAccount` / 来源批次 `BenefitOriginBatch` | 持有人账户/权益来源批次 | §4.5(两条) |
| 权益账本流水 `BenefitLedgerEntry` | 不可变流水 | §4.6 |
| 权益冻结占用 `BenefitReservation` / 退款扣回冻结 `BenefitRecoveryFreeze` | 交易冻结/退款扣回前冻结 | §4.7/4.8 |
| 后置动作计划行输入 `BenefitActionPlanLineSnapshot` / 执行结果 `BenefitActionExecutionResult`/`BenefitRecoveryExecutionResult` | 按 10 域冻结计划行执行,不重算发放规则 | §4.9–4.11 |
| 券/卡券载体模板 `BenefitInstrumentTemplate` | 券/卡/次卡/券包实例的载体模板(别名"券模板");废弃"权益模版/券规则实体" | §4.12 |
| 券/卡券实例 `BenefitInstrumentInstance`(`BenefitInstrument`) | 具体券/卡/次卡/券包;归账本域,不归营销活动自造 | §4.13 |
| 权益持有人转移 `BenefitHolderTransfer` | 礼品卡/券包转赠事实 | §4.14 |
| 外部权益迁移批次 `ExternalLedgerMigrationBatch` | 一次性迁移导入;迁入后成内部账本事实 | §4.15 |
| 账本可见范围快照 `LedgerVisibilitySnapshot` | 账本可见范围 | §4.16 |

**10 营销权益与忠诚度域**

| 术语(中/英) | 定义与关键红线 | 出处 |
|---|---|---|
| 权益 `Benefit`(伞概念) | 统一伞概念,展示词"优惠";不把优惠/活动/券建成平行大模型 | 术语表 §7 |
| 权益类型 `BenefitType` | 类型字典;用于合同权益接受/模板分类 | §4.1 |
| 权益规则模板 `BenefitTemplate` | 计算与支付核销的主规则模板;非资产类(全场五折)也是模板;资产类=模板+账本实例 | §4.2 |
| 模板排他标签 `BenefitTemplateExclusionTag` | 不可同用约束 | §4.2.1 |
| 营销活动 `PromotionCampaign` | **只是组织多个模板的活动,不是计算单元** | §4.3 |
| 权益发放规则 `BenefitGrantRule` / 触发事实 `BenefitTriggerFact` / 发放追踪 `BenefitGrantTrace` | 事实命中→动作意图→领域处理入口→链路追踪 | §4.4 |
| 结果处理链 `BenefitRuleOutcomeHandlingRun`/`AcceptedRuleOutcome`/`BenefitActionRequest`/`BenefitActionPlan(+Line)` | 后置动作四段链路;计划行发给 09/08/20/16 目标域执行 | §4.4.2–4.4.6 |
| 忠诚度规则集/事件规则 `LoyaltyRuleSet`/`LoyaltyEventRule` | 事件驱动规则引擎,不是 CRM/账户 | §4.5/4.6 |
| 权益策略组件 `BenefitPolicy Components` | 模板由标准策略组件组成 | §4.7 |
| 权益计算上下文/记录/应用方案 `BenefitEvaluationContext`/`Record`/`ApplicationPlan` | POS 与小程序共用统一权益计算框架的输入/诊断/输出 | §4.8–4.10 |
| 外部权益参与策略 `ExternalBenefitParticipationPolicy` | 外部券/团购券/外部会员权益如何参与本系统计算 | §4.11 |
| 补偿可选项策略 `CompensationOptionPolicy` | 人工异常补偿可选项 | §4.12 |

### 7.4 交易闭环层

**11 交易订单域**

| 术语(中/英) | 定义与关键红线 | 出处 |
|---|---|---|
| 主订单 `MasterOrder` | 一次交易意图、统一金额/支付/售后入口;`orderScene`:DINE_IN/TAKEAWAY/SELF_PICKUP/STORE_DELIVERY/PLATFORM_DELIVERY/RETAIL/SERVICE/ONLINE;`orderPurpose`:SALE/RECHARGE/BENEFIT_BUNDLE_PURCHASE/…;三独立状态轴 `paymentLifecycleStatus`/`businessOutcomeStatus`/`fulfillmentSummaryStatus` | §4.1;红线 R05 |
| 门店子订单 `StoreSubOrder` | 按门店/经营主体/履约/结算责任拆分;`subOrderKind`:FIRST_ORDER/ADDITIONAL_ORDER/FEE_ONLY/EXTERNAL_ORDER;CONFIRMED 后不能加菜。废弃"店铺子订单" | §4.2 |
| 订单商品行 `OrderItem` | 支付分摊/退款/权益分摊/履约/结算最小坐标;`lineRole`:NORMAL/SERVICE_FEE/PACKAGING_FEE/DELIVERY_FEE/BENEFIT_ITEM/COMPOSITE;`lineDirection`:POSITIVE/NEGATIVE_REVERSAL | §4.3 |
| 订单输入证据 `OrderInputEvidence` | 录入/识别/导入/修正方式;`inputKind`:BARCODE_SCAN/WEIGHING/MARKET_PRICE_INPUT/CHANNEL_IMPORT/… | §4.4 |
| 订单金额快照 `OrderAmountSnapshot` | 固定计算顺序:原价→人工调整→价格权益→抹零→`BASE_PAYABLE_FINAL`→支付分摊;金额一律整数分 | §4.5 |
| 人工金额调整行 `OrderAmountAdjustmentLine` | ITEM_PRICE_CHANGE/ITEM_DISCOUNT/ORDER_DISCOUNT/GIFT/WAIVE/MANAGER_DISCOUNT/ROUNDING/…;只能减不能加 | §4.5.1 |
| 价格权益行 `PriceBenefitLine` | 冻结到订单的已应用价格权益(会员价/满减);与支付核销行分开 | §4.6 |
| 支付核销行引用 `PaymentSettlementLineRef` / 权益分摊 `BenefitAllocation` | 引用 12 域执行事实/权益到行分摊(旧 `AppliedBenefitSnapshot` 等为兼容视图) | §4.7–4.10 |
| 订单支付快照/状态线 `OrderPaymentSnapshot`/`OrderStateLine` | 支付/状态快照 | §4.11/4.12 |
| 退货案件 `ReturnCase` | 外部平台"退款成功"≠内部案件完成 | §4.13 |
| 订单更正案件 `OrderCorrectionCase` / 补偿案件标记 `CompensationCaseMarker` | 反结账/人工异常补偿(单独权限) | §4.14/4.15 |
| 桌台会话引用 `TableVisitSessionRef` | 引用 22 域会话,仅要求桌台的 flow 使用 | §4.16 |
| 订单来源快照 `OrderSourceSnapshot` | 入口/渠道来源,渠道域拥有、订单级冻结保存;废弃"订单备注渠道字符串" | §4.17 |
| 预点餐草稿 `PreOrderDraft` | 辅助功能;扫码/预点餐≠订单成立 | §4.18 |
| 外部订单动作门禁 `ExternalOrderActionGate` | 接单/拒单/取消/退款/核销/出餐**外部成功内部才成功**;平台不可达 POS 直接失败 | §4.18(重号);红线 R06 |
| 订单关系/合单批次 `OrderRelation`/`CombinedCheckoutBatch` | 订单间关系/合单支付 | §4.19/4.20 |
| 异常支付处理案件 `AbnormalPaymentHandlingCase` | ABNORMAL_FAILED/退款未知处理 | §4.21 |
| 订单履约预览快照 `OrderFulfillmentPreviewSnapshot` | 履约预览 | §4.22 |

**12 支付中心域**

| 术语(中/英) | 定义与关键红线 | 出处 |
|---|---|---|
| 支付方式 `PaymentMethod` | 支付/核销/记账方式标准定义 | §4.1 |
| 收单机构 `AcquiringInstitution` | 支付/核销服务提供方;支付域"商户号"≠组织域租户/总公司 | §4.2 |
| 收单产品实例 `AcquiringProductInstance` | 某机构某产品在某范围/主体下的开通实例 | §4.3 |
| 支付受理配置 `PaymentAcceptanceConfig` / 场景收单配置 `ScenarioAcquiringConfig` | 某范围接受哪些支付方式/场景收单配置 | §4.4/4.5 |
| 支付路由策略 `PaymentRoutingPolicy` | 按订单用途/行类型/场景/方式选实际收款实例(商户号路由) | §4.6 |
| 支付计划快照 `PaymentSettlementPlanSnapshot` | 执行侧幂等/路由计划;不是订单金额版本 | §4.7 |
| 支付核销行 `PaymentSettlementLine` | 一次支付/扣减/核销/记账执行事实;旧 `PaymentExecutionLine` 为别名;废弃"子支付单/支付请求行" | §4.8 |
| 内部权益扣减快照 `InternalBenefitDeductionSnapshot` | 支付中心可调账本扣减但**不拥有余额** | §4.9;红线 R04 |
| 核销执行 `VerificationExecution` | 外部券/团购券/核销码执行事实 | §4.10 |
| 支付结果构成 `PaymentResultComponent` | 顾客出资/机构优惠/银行补贴/手续费/尾差、逐券核销结果;废弃 `PaymentResultComposition` | §4.11 |
| 最终结果快照 `PaymentSettlementFinalResultSnapshot` | 冻结快照;不含商品行分摊(归订单域) | §4.12 |
| 退款执行 `RefundExecution` | 退款/撤销/人工退款执行事实 | §4.13 |
| 通道账单/对账状态 `PaymentChannelStatement`/`PaymentReconciliationState` | 外部账单输入/对账状态 | §4.14/4.15 |
| 未关联支付事实 `UnlinkedPaymentFact` | 已存在但未关联订单的支付事实 | §4.16 |

**13 履约与生产域(排餐/配餐/出品)**

| 术语(中/英) | 定义与关键红线 | 出处 |
|---|---|---|
| 履约要求行 `FulfillmentLine` | 承诺后的稳定锚点;`requirementKinds[]`:PRODUCTION/PACKAGE/LABEL/PRINT_TICKET/PICKUP_CALL/HANDOFF/DELIVERY;`fulfillmentTarget`:TABLE/COUNTER/PICKUP_SCREEN/RIDER/…;无独立 FulfillmentOrder | §4.1 |
| 生产计划快照 `ProductionPlanSnapshot` | 工作单生成时只读计划快照;等叫/预约/分批起菜/重排走新快照;不做排班/产能优化/配送调度 | §4.2 |
| 工作单 `WorkUnit` | 现场最小执行容器;`workUnitKind`:PRODUCTION/PACKAGE/LABEL/PRINT_TICKET/QUALITY_CHECK/HANDOFF_PREPARE/DELIVERY_PREPARE | §4.3 |
| 工作单执行快照 `WorkUnitExecutionSnapshot` | 生成时冻结执行决策;规则更新只影响后续新工作单 | §4.4 |
| 履约事实线 `FulfillmentActionLine` | 本域唯一事实线,只追加不可编辑;`factKind` 含 STARTED/COMPLETED/RECALLED/URGED(催)/PRINT_SUCCEEDED/PICKUP_CALLED(叫号)/HANDOFF_COMPLETED/RIDER_PICKUP_CONFIRMED/EXTERNAL_MEAL_READY_SUCCEEDED | §4.5 |
| 履约异常 `FulfillmentException` | OUT_OF_STOCK_AT_PRODUCTION/CUSTOMER_NOT_PICKED_UP/WRONG_ITEM/MISSING_ITEM/… | §4.6 |
| 生产规则事实:商品处理标签 `ProductionTagDefinition`、现场岗位 `WorkstationDefinition` 等 | 固化进两类快照;`WorkRoutingRule`/`WorkQueueDefinition` 已退出用户主路径(历史兼容) | §4.7 |

**14 结算对账与外部财务输出域**

| 术语(中/英) | 定义与关键红线 | 出处 |
|---|---|---|
| 结算参与主体 `SettlementParty` | 结算解释主体角色;不新建组织主数据 | §4.1 |
| 结算协议快照 `SettlementAgreementSnapshot` | 规则/协议发生时快照 | §4.2 |
| 结算明细 `SettlementLine` | 不可变、最核心财务解释事实;本域不打款、无总账/凭证/发票生命周期 | §4.3 |
| 退款结算冲正明细 `RefundSettlementLine` | 退款/反结账/撤销核销冲正 | §4.4 |
| 递延结算链路 `DeferredSettlementLink` | 预收/代售/跨店消费/后续核销释放 | §4.5 |
| 权益结算结果快照 `BenefitSettlementResultSnapshot` | 外部权益结算结果只读解释;不进 09/10/12 主权模型 | §4.6 |
| 门店权益结算汇总视图 `StoreBenefitSettlementSummaryView` | 门店按时段读模型 | §4.7 |
| 结算周期/账单 `SettlementCycle`/`SettlementBill` | 出账周期锁账/账单 | §4.8/4.7(重号) |
| 对账匹配/差异 `ReconciliationMatch`/`ReconciliationDifference` | 内外匹配;**外部账单不得改写内部支付事实** | §4.8/4.9 |
| 结算调整 `SettlementAdjustment` / 出账指令 `PayoutInstruction` | 调整/冲正/补差;出账候选指令,不执行打款 | §4.10/4.11 |
| 开票协作快照 `InvoiceCollaborationSnapshot` | 开票协作 | §4.12 |
| 项目 ERP 上报快照 `ProjectErpReportingSnapshot` | 租金业绩口径;废弃 `MallErpReportingSnapshot` | §4.13 |
| 记账导出/财务口径快照 `SettlementAccountingExportSnapshot`/`FinancialPerspectiveSnapshot` | 凭证候选输入/口径解释 | §4.14/4.15 |

### 7.5 接入与场景层

**15 经营渠道域**

| 术语(中/英) | 定义与关键红线 | 出处 |
|---|---|---|
| 渠道类型定义 `ChannelKindDefinition` | 渠道类型契约定义 | §5.1 |
| 经营渠道 `BusinessChannel` | **项目级**渠道实例(POS/扫码点餐小程序/外卖小程序/美团外卖/美团团购/饿了么/京东外卖);不承接排队叫号/预点餐/预约/客流;不表达某门店是否落地 | §5.2 |
| 渠道对接配置 `BusinessChannelProviderConfig` | 项目级对接方式 | §5.3 |
| 门店渠道绑定 `BusinessChannelBinding` | 门店在项目渠道上的落地/启停事实;菜单发布与订单来源的**最小渠道粒度**;同一门店可绑多个同平台外部门店。废弃 `ChannelRef`/`joinedChannelRef` | §5.4 |
| (系谱)v4 旧值 `PLATFORM_TAKEOUT`/`OTHER` | 仅迁移语境,新模板禁引用;TDP 销售 topic 固定 `tdp.sales.menu_activation`/`menu_projection`/`availability` | v4 registry;术语表 §9 |

**16 外部协作与防腐域**

| 术语(中/英) | 定义与关键红线 | 出处 |
|---|---|---|
| 外部系统 `ExternalSystem` | 外部平台/权益系统/ERP/支付机构/配送平台的标准定义;`systemKind`:EXTERNAL_LOYALTY/EXTERNAL_VALUE_BENEFIT/EXTERNAL_INSTRUMENT_BENEFIT/EXTERNAL_ACTIVITY_BENEFIT;废弃 `ExternalBenefitSystem` | §4.1 |
| 外部连接器 `ExternalConnector` | 协议适配器配置 | §4.2 |
| 外部凭证绑定 `ExternalCredentialBinding` | 安全引用,不存明文 | §4.3 |
| 外部授权 `ExternalAuthorization` | 授权状态与能力租约 | §4.4 |
| 外部协作配置/能力清单 `ExternalCollaborationConfig`/`IntegrationManifestRef` | 稳定配置引用;Manifest 只表达能力,≠经营入口/业务来源 | §4.5 |
| 外部对象映射 `ExternalObjectMapping` | 外部↔内部身份映射(CatalogItem/ProductSku/OptionValue/CompositeComponent/SalesItem) | §4.6 |
| 入站三层 `InboundEnvelope`/`InboundRawPayload`/`NormalizedInboundPayload` | raw/token/secret 不进普通业务用例 | §4.7–4.9 |
| 入站处理轨迹 `InboundProcessingCase` | 接收→路由完成轨迹 | §4.10 |
| 出站任务/尝试 `OutboundTask`/`OutboundAttempt` | 对外动作真相源/调用尝试 | §4.11/4.12 |
| 外部回调/账单文件 `ExternalCallback`/`ExternalStatementFile` | 回调/回单文件 | §4.13/4.14 |
| 集成游标/幂等记录 `IntegrationCursor`/`IdempotencyRecord` | 同步水位/防重 | §4.15/4.16 |
| 载荷翻译规则/诊断/操作日志 `PayloadTranslationRule`/`IntegrationDiagnostic`/`IntegrationOperationLog` | 翻译规则/异常台账/审计线 | §4.17–4.19 |

### 7.6 终端运行层

**17 终端数据平面域(TDP)**

| 术语(中/英) | 定义与关键红线 | 出处 |
|---|---|---|
| TDP topic 定义 `TdpTopicDefinition` | 投递元数据最小注册项;非业务 payload 结构注册表;TDP 被动承接显式发布,不主动拉表 | §4.1 |
| 投影条目 `TdpProjectionEntry` / 源事件 `TdpProjectionSourceEvent` | 某 topic 某 scope 某 item 当前投影/源事件幂等事实 | §4.2/4.3 |
| topic 游标 `TdpTopicCursor` / 游标状态 `TdpCursorState` | 版本水位/终端同步进度 | §4.4/4.9 |
| 快照传输 `TdpSnapshotTransfer` | full snapshot/rebase WebSocket 会话 | §4.5 |
| 终端可见投影索引 `TdpTerminalProjectionAccess` / 解析投影 `TdpResolvedProjection` / 投递目标快照 `TdpDeliverySelectorSnapshot` | 可见性与最终投递决策 | §4.6/4.10/4.11 |
| TDP 会话/订阅 `TdpSession`/`TdpSubscription` | 已订阅≠业务授权、≠一定收到全部内容 | §4.7/4.8 |
| 命令投递/排障快照 `TdpCommandDelivery`/`TdpOperationsSnapshot` | `command_outbox` 只承载 TCP 控制命令,**不承载业务打印命令** | §4.12/4.13 |
| (红线)投递 scope 七类 | GROUP_WORKSPACE/COMMERCIAL_GROUP/REGION/PROJECT/STORE/TERMINAL_GROUP/TERMINAL;**Brand/Tenant/HeadCompany 不是投递节点** | v4 core-design §7 一致 |

**18 终端控制平面域(TCP)**

| 术语(中/英) | 定义与关键红线 | 出处 |
|---|---|---|
| 终端 `Terminal` ≠ 设备/外设 `Device/Peripheral` ≠ 工位 `Station` | 能激活并与 TCP/TDP 交互的软件端才是终端(POS/KDS/叫号机);打印机/扫码枪/电子秤/刷卡器/摄像头是外设;钱箱起步不纳入 | 术语表 §10;红线 R08 |
| 终端类型定义 `TerminalTypeDefinition` | 平台预定义可激活类型 | §4.1 |
| 打印能力/设备能力定义 `PrinterCapabilityDefinition`/`TerminalDeviceCapabilityDefinition` | 预定义打印类/非打印本地能力 | §4.2/4.3 |
| 系统参数/错误定义与覆盖 `TerminalSystemParameterDefinition`/`TerminalSystemErrorDefinition` + Project/Store 级 Override | 可覆盖运行参数/错误码 | §4.4–4.9 |
| 项目终端配置 `ProjectTerminalConfig` | 项目级终端配置 source fact | §4.6 |
| 终端实例 `TerminalInstance` / 绑定 `TerminalBinding` / 凭证状态 `TerminalCredentialStatus` | 纳管实例/绑定经营坐标/凭证安全 | §4.10–4.12 |
| Profile/模板/能力声明 `TerminalProfile`/`TerminalTemplate`/`TerminalCapabilityManifest` | 能力边界/初始配置/实际能力 | §4.13–4.15 |
| 激活码 `ActivationCode` | 现场终端进入系统的受控凭证(v4:12 位数字码) | §4.16 |
| 终端关系/组 `TerminalRelation`/`TerminalGroup` | 控制关系/稳定终端组 | §4.17/4.18 |
| 终端打印机/设备配置 `TerminalPrinterConfig`/`TerminalDeviceConfig` | 某终端下可调用打印机/本地设备配置实例 | §4.19/4.20 |
| 在线镜像/健康 `TerminalPresenceMirror`/`TerminalHealthSignal`/`TerminalHealthAssessment` | 在线/健康信号与结论 | §4.21–4.23 |
| 任务发布/实例 `TerminalTaskRelease`/`TerminalTaskInstance` | 控制任务发布/单台执行 | §4.24/4.25 |
| 日志/更新/资格 `TerminalLogUpload`/`TerminalUpdatePackage`/`TerminalUpdateRelease`/`TerminalServiceEntitlement` | 日志上传/热更新/版本/服务资格 | §4.26–4.29 |

### 7.7 管理与规则支撑层

**19 经营分析域**(红线 R09:只解释不改源事实)

| 术语(中/英) | 定义 | 出处 |
|---|---|---|
| 指标口径 `MetricDefinition` / 分析对象 `AnalysisSubject` / 时间口径 `AnalysisTimeFrame` | 指标/对象/时间三口径 | §4.1–4.3 |
| 分析数据集 `AnalyticDataset` / 指标快照 `MetricSnapshot` | 数据集/快照 | §4.4/4.5 |
| 报表视图定义 `ReportViewDefinition` / 发布报表快照 `PublishedReportSnapshot` | 报表定义/发布快照 | §4.6/4.7 |
| 指标差异解释 `MetricDifferenceExplanation` | 口径差异解释 | §4.8 |
| 经营目标 `PerformanceTarget` / 绩效归因数据集 `CommissionAttributionDataset` | 目标/归因 | §4.9/4.10 |
| 预警规则 `AnalyticWatchRule` / 经营发现 `AnalyticFinding` / 诊断解释 `DiagnosticExplanation` / 行动建议 `ActionRecommendation` | 预警→发现→解释→建议链 | §4.11–4.14 |
| 经营简报 `ManagementBrief` | 晨间简报/闭店复盘 | §4.15 |

**20 运营治理域**(红线 R09/R12:改源事实必须回源域公开 command)

| 术语(中/英) | 定义 | 出处 |
|---|---|---|
| 治理信号/案件/任务 `GovernanceSignal`/`GovernanceCase`/`GovernanceTask` | 信号→案件→任务 | §4.1–4.3 |
| 审批案件/时限规则 `ApprovalCase`/`ApprovalDeadlineRule` | 审批与时限 | §4.4/4.5 |
| 补偿任务 `CompensationTask` | 人工补偿任务 | §4.6 |
| 巡店模板/计划/执行/发现 `InspectionTemplate`/`Plan`/`Execution`/`Finding` | 巡店四件套 | §4.7–4.10 |
| 整改案件 `RectificationCase` | 整改闭环 | §4.11 |
| SLA/升级策略 `SlaPolicy`/`EscalationPolicy` | 时限与升级 | §4.12 |
| 治理审计线/诊断 `GovernanceAuditLine`/`GovernanceDiagnostic` | 审计与诊断 | §4.13/4.14 |

**21 打印规则域**(只定义规则与模板;打印机配置归 TCP、执行结果归终端)

| 术语(中/英) | 定义 | 出处 |
|---|---|---|
| 打印场景引用 `PrintSceneRegistryRef`(`printScene`) | closed registry,由业务 owner/终端提出,非自由字符串;v4 落地 19 类:小票/预结单/占桌单/退款单/会员充值单/外卖顾客小票/外卖商家小票/厨房单/退菜单/催菜单/等叫单/放行单/外卖厨房单/打包单/取餐单/交班单/盘点单/杯贴/价签 | §4.1;v4 print-scenes.json |
| 字段库引用 `PrintFieldLibraryRef` / 场景治理策略 `PrintSceneGovernancePolicy` | 字段库/项目锁定 vs 门店可定制(v4:PROJECT_LOCKED/STORE_CUSTOMIZABLE) | §4.2 |
| 打印配置库 `PrintConfigLibrary` / 打印模板 `PrintTemplate` / 模板资源清单 `PrintTemplateAssetManifest` | 配置库/模板/资源清单(v4 曾建又删资源清单表,建模不稳,见 §8-14 同类) | §4.3/4.4 |
| 打印规则 `PrintRule` / 门店有效打印配置快照 `StoreEffectivePrintConfigSnapshot` | 规则(失败策略 WARN_AND_CONTINUE/BLOCK_LOCAL_FLOW/RECORD_ONLY)与发布投影 | §4.5 |

**22 到店服务域**

| 术语(中/英) | 定义与关键红线 | 出处 |
|---|---|---|
| 门店服务模型 `StoreServiceModel` | 到店服务配置**发布单元**,不是运行时大聚合 | §5.1 |
| 门店服务流程 `StoreServiceFlow` | 门店级现场服务组合规则(桌台点餐/叫号取餐/自动清台/取餐通知);历史词 `StoreServiceFlowProfile` 新旧并存需注意 | §5.2 |
| 生产启动策略 `ProductionStartPolicy` | 某条 flow 何时允许启动生产(闸门:下单/支付/接单/人工确认/时间) | §5.3 |
| 就餐区/餐桌(桌台)`DiningArea`/`DiningTable` | 堂食现场服务资源 | §5.4 |
| 桌台到店服务会话 `TableVisitSession` | 一次桌台会话;可关联多订单但**不拥有订单事实** | §5.5 |
| 取餐点 `PickupPoint` | 取餐点配置;取餐任务生命周期归履约域 | §5.6 |
| 候位队列定义/取号 `WaitingQueueDefinition`/`QueueTicket` | 候位/入座;完整候位排队属增强期 | §5.7 |
| 通用自助点餐码/扫码会话 `GeneralSelfOrderCode`/`ScanEntrySession` | 码不绑经营入口/服务流程、不区分启停;废弃 `ScanEntryDefinition`/`ScanEntryCodeBinding` | §5.8 |

### 7.8 跨域固定流程与 Actor(骨架级)

- **权益四段主链**:查询事实 → 计算可用 → 支付执行 → 结算解释(09/10/12/14 分工的总纲)。
- **金额计算固定顺序**:原价 → 人工金额调整(不含抹零)→ 价格权益 → 人工抹零 → 基础应付终版 → 支付核销与分摊。
- **平台事实流后置发放链**:BusinessFact → MQ RuleWorker → RunLog → OutcomeProduced → 营销域消费 outcome 生成计划行 → 目标域执行。
- **业务打印固定流程**(红线 R08):业务 owner 确认 → TDP 投递投影+规则/模板 manifest+打印机配置 → 终端定 printScene → 本地渲染打印 → 结果回传 owner。
- **12 条跨域业务闭环**(未来验收骨架):门店开业准备与终端生效/商品菜单发布多入口可售/渠道绑定与订单入站/到店点单支付生产启动/POS 交易结账退款反结账/会员权益支付核销补偿/履约生产 KDS 叫号取餐打印/库存扣减估清恢复/结算对账开票 ERP/经营分析预警治理/终端数据同步外设诊断/账号权限高风险授权。
- **Actor 八大类**(全带 `actorId`,详单见 v6 `06.功能用例与用户旅程清单/01-全系统用户与Actor清单.md`):顾客与会员侧(匿名顾客/私域顾客/公域会员/品牌会员/取餐人…)、门店前台与现场(收银员/服务员/店长/POS 当前操作人 `ACT-POS-CURRENT-OPERATOR`/厨师/传菜打包…)、总公司与品牌区域(总公司管理员/品牌运营/督导/供应链协作人…)、项目管理方(集团管理员/项目运营/招商/支付配置员/项目财务…)、财务结算治理(结算会计/对账专员/审批人/巡店人员…)、外部组织系统(外卖平台/支付机构/ERP/ISV…)、终端与外设(POS/KDS/自助机 + 打印机/电子秤…)、系统 actor(平台超管 `PLATFORM_SUPER_ADMIN`/服务账号/TDP/TCP/授权判断器…)。
- **术语守门**:v6 讨论过程记录(目录 18–28 的互动记录)含被推翻旧词,**不得作为命名来源**;以"讨论结论整理与 V6 修订索引/正式文档修订清单"为准;可执行守门脚本 `design-v6/tools/check-terminology-guard.mjs`、`check-source-domains.mjs`。

---

## 8. 四版本分歧对照表(同一业务事实,不同版本说法;"现行"=我建议采纳并写入语料库正文的)

| # | 业务事实 | v6 | v4 | v1 | v2(现行) | 状态 |
|---|---|---|---|---|---|---|
| 1 | 大区层级 | 支持多级 | 单层表 | 单级 | **固定 集团→大区→项目** | 已按 v2,建议确认 |
| 2 | 门店"状态"语义 | 不设关闭/暂停;换经营者新建店 | `operatingStatus` 三态 + `isValid` + 生命周期 | 同 v4 加重算事件 | **ENABLED/DISABLED 仅主数据候选,不代表营业/资格**;"经营状态"词退役 | 已按 v2;未来引入营业概念需新词(§10-3) |
| 3 | 租户与总公司 | Tenant/HeadCompany 分立 | 曾 `TenantCompany(companyType)`,后拆分 | 分立 | 分立(三独立实体三菜单) | 共识;`TenantCompany` 全禁 |
| 4 | 合同货号 | `ContractGoodsCodeCandidate`(候选)+销售项分配 | — | `goodsCode` 单值/合同 | **`itemCodes[]` ≥1** | 已按 v2;v6 分配模型留未来 |
| 5 | 授权范围策略 | `ResourceScopeGrant` 等较重模型 | `scopePolicy` 六值枚举 | 删授予侧 scopePolicy(保留范围解析同名词) | **无 DSL,按角色节点类型固定推导** | 已按 v2;注意"scopePolicy"一词双物(§10-7) |
| 6 | 角色能力存储 | grant 行 | grant 表 | JSONB(`capabilityGrants`) | **JSONB bundle,禁 join table** | 已按 v2 |
| 7 | 管理员建号/设密 | — | 代建路径存在 | root 自举+邀请 | **只邀请;不代设密码;重置=本人 OTP** | 已按 v2 |
| 8 | 用户管理入口 | — | 按节点页面 | 通用+按节点 | **五类独立菜单;"组织成员"退役** | 已按 v2 |
| 9 | 隔离键叫法 | `groupWorkspaceId/Key`(废 tenant/sandbox) | `group_workspace_id`;但库存域 `isolation_context_ref` | `groupWorkspaceId/Key` | `workspaceKey` + 内部 id | 语义共识;**拼写待统一**(§10-5) |
| 10 | 身份/范围用词 | — | 当前节点/查看范围 | 当前身份(membership) | **当前运营角色 / 可视数据节点**(Dexter 裁决) | 已裁决 |
| 11 | 空间展示字段 | — | "动态品牌" | 展示字段 | **WorkspaceEntry 展示字段;无 Branding 域、无双名称** | 已按 v2 |
| 12 | 邀请能力粒度 | — | — | 多 key(CREATE/CANCEL/REISSUE) | **单 `BC-IAM-<TYPE>-INVITE` + `…-ROLE-REVOKE`;旧 key 物理退役** | 已裁决(2026-07-21) |
| 13 | 扩展字段治理 | 属性定义较重 | `fieldStatus` 三态治理 | 简单 schema | **current rule only + 容错解析 + 无感混排** | 已按 v2 |
| 14 | 菜单/渠道术语 | `SalesSurface` 曾出现后废弃 | `sales_collection` 两代同名表 | 概念未落契约 | (未来范围)v6 废词表为准 | 未来范围 |

---

## 9. 禁用词表(草稿;机器可做零引用检查的候选清单)

**实体/模型类**:`TenantCompany`、`companyType`、`tenant_company`、`TenantBrandAuthorization`、`TenantHeadCompany`、`LegalEntity`(独立实体)、`Sandbox`/`sandboxId`、`CommercialGroupIsolation`、`Mall` 前缀、Branding/“动态品牌”、`SalesSurface*`、`SalesCollectionAssignment`、`AssignSalesCollection`、`menu_release`、`BENEFIT_PRODUCT/OPTION_ITEM/MATERIAL_ITEM/SEMI_FINISHED_ITEM/PACKAGING_ITEM/WEIGHED_ITEM/product_kind`、`ScanEntryDefinition/ScanEntryCodeBinding`、`ExternalBenefitSystem`、`PaymentResultComposition`。
**隔离/命名类**:`tenantKey`、`tenantId/tenant_id`(隔离义)、"商户"(指租户)、"客户"(指后台用户)、`mall-admin`、`tenant-admin`。
**用户文案类**:"当前身份"、"查看范围"(以"当前运营角色/可视数据节点"替代)、"经营状态"(门店启停语境)、"诊断"(概览界面用词)、"对内/对外名称"。
**能力 key 类**:`BC-IAM-MEMBERSHIP-MANAGE`、`BC-IAM-*-INVITE-CREATE/CANCEL/REISSUE`(已物理退役);v4 渠道旧值 `PLATFORM_TAKEOUT`、`OTHER`(仅迁移语境)。

---

## 10. 待 Dexter 裁决清单

1. **权威序确认**:冲突时按"all-v2 现行裁决 > v6 > v4 > v1"取词,是否接受?
2. **语料库范围**:正式版是否如本稿"当前四域全字段 + 未来范围简表"分层?还是只做当前四域?
3. **门店未来的"营业/经营资格"概念**:v2 已裁决 ENABLED/DISABLED 不表营业;未来 R5 引入营业语义时用什么词(v6 的合同资格快照方向?),以及 `StoreOperationType` 走集团自定义实体(v6)还是固定枚举(v1)?
4. **Account vs WorkspaceUser**:业务词"空间账号"无争议;契约/代码层的实体命名(v6 主张 Account/Principal 分离)在 R3 物化契约时定谁?
5. **key 拼写统一**:v2s 统一 `workspaceKey` 还是 `groupWorkspaceKey`(v6/v4/v1 系谱是后者,v2 契约是前者)?
6. **v2 仓内三处自不一致待 Codex 修**(纳入语料库前先定拼写):`operationsTitle` vs `operationsAdminTitle`;`contractNo` vs `contractNumber`;`phaseName` vs `projectPhaseName`。
7. **"scopePolicy"一词双物**:授予维度已删,但范围解析快照仍用同名字段(v1/v4);v2s 未来契约是否换名(如 `scopeResolution`)以绝混淆?
8. **禁用词表是否机器化**:§9 清单未来是否做成零引用检查门(纯机械,符合建门三问)。

---

## 11. 采集与出处说明

四仓各由一个只读采集通道穷尽式提取(v6 覆盖 22 域主权事实+术语表+Actor 清单;v4 以 DB migration V001–V060 为最可靠出处;v1 以 contracts+project-memory decisions 为主;v2 以 module specs+q01-q12 rulings+OpenAPI 为主),再由本人交叉综合。条目出处均可回溯到具体文件;正式版落 project-memory 前,建议按出处逐条抽验(尤其 §8/§9 的每一行)。本稿未读取 Codex 侧任何草稿,满足盲写纪律。
