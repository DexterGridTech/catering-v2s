---
id: decisions.owner-read-model-and-lifecycle-standard
status: active
layer: routed
taskKinds: ["design","implementation","review","testing"]
domains: ["backend","contract","admin-ui","platform"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["architecture","contract","database"]
triggers: ["task-start","implementation","review"]
assertions: ["FRONTEND_DICTIONARY_FOR_CODE_DEFINED_ENUMS","BUSINESS_IDENTITY_IS_ENTITY_SPECIFIC","COMMAND_SPECIFIC_STATUS_SEMANTICS","AGGREGATE_FACTS_ARE_OWNER_OWNED","CASCADE_STATUS_IS_DERIVED_NOT_STORED","OWNER_READ_EXPOSES_BUSINESS_MODEL","NO_BACKEND_DISPLAY_ASSEMBLY","COMPUTABLE_BY_CONSUMER_STAYS_WITH_CONSUMER","MASTER_DATA_LIFECYCLE_IS_THREE_STATES","NO_PHYSICAL_DELETE_FOR_ENTITIES","DISABLED_STAYS_EDITABLE","EXISTING_REFERENCE_EXEMPT_FROM_STATUS_CHECK","VOIDED_RELEASES_CODE_AND_REF_IS_IDENTITY","AUTHORIZATION_DIMENSION_STAYS_IN_OPERATION_IDENTITY"]
sourceRefs: ["doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md"]
---

# owner 读模型与生命周期标准(Dexter base-1 裁定)

## OWNER_READ_EXPOSES_BUSINESS_MODEL

**Dexter 2026-08-27 原话(三句,是本条的完整表述)**:

> 后端只返回业务事实。前端根据事实自己想怎么展示就怎么展示。**如果多个前端展示一个事实,就必须用一个接口。**

owner 的 task-read 返回**该实体的业务结构本身,含相关联的结构化实体**;返回内容不由任何调用方要显示什么决定。为某一屏新增读接口或新增字段,默认是设计错误。

第三句的推论:同一批事实不得因消费方不同而拆成多个接口("候选"不是实体,是带筛选参数的实体列表);而**不同的事实本来就该是不同接口**,不要求多个事实合成一个。

**唯一限定**:当"谁能看这批事实"由接口身份承载时不得合并 —— 见 `AUTHORIZATION_DIMENSION_STAYS_IN_OPERATION_IDENTITY`。

反例(实测):商品列表给 `categoryRef`(UUID)配 `categoryPathLabels`(字符串数组),前端想显示分类编码时该字段不在契约里。

## NO_BACKEND_DISPLAY_ASSEMBLY

**判据与语言无关、与分隔符无关**(Dexter 2026-08-26 原话:后台做字符串拼装,这些都是不对的):

> **凡由两个以上事实拼接、连接或格式化而成的字符串,不得作为业务事实返回。**

事实各自返回;拼不拼、怎么拼、名称还是编码、排版、截断、空值怎么说,全归前端。

⚠️ **不要把判据缩窄成"中文",也不要缩窄成"Java 层"。** 两者都是代理不是本体,而且实测最难发现的两类,一类不含中文,一类不在 Java 里。

**装配发生在哪一层都算,实测三层**:Java 的 `+` / `String.join` / `String.format` / `StringBuilder`;**Stream 的 `Collectors.joining` 与 `.reduce((a,b) -> a + sep + b)`**;**SQL 的 `||` / `string_agg` / `concat` / `format`**。静态 enum mapper 不是装配。只扫 Java 的门,对 `CollaborationOwnerService` 里 `commercial_group_name || '（' || commercial_group_code || '）'` 这种**全角括号的「名称(编码)」全绿**。

**三处例外**:

1. **时点快照本身是事实**(Dexter 2026-08-27 裁定)。当一个事实的业务含义要求它在写入时冻结,owner 必须冻结并返回。语料库 G-04 已有背书「合同保存名称快照…改名不回写历史合同」。实例:`actorDisplayName` 落库列是 `actor_display_snapshot`,wire 里没有 `actorRef`。判据:这个字段是"当前值的一次渲染",还是"某个时点被固定下来的值"?
2. **安全与隐私脱敏**:手机号等 PII 的完整形态受访问控制,后端必须决定可展示形态(如 `mobile_mask_source`、`mask(row.mobile())`)。判据:这个值的完整形态是否受访问控制?**装配是把多个事实压成一个串(前端本可自己拼),脱敏是故意不给全(前端拿不到也不该拿到)。**
3. **非人读的复合串**:游标、幂等键、缓存键、`generation`、SQL 占位符。判据:会不会出现在用户眼前?

三种实测违背形态:

1. **句子装配**(37 行 / 11 个文件,不止 catalog —— `InventoryOwnerService` 也有):`"生产标签：" + name`、`preparationSummary.add("各规格制作内容不同")`
2. **分隔符装配**(organization Java 层 18 处 + collaboration/organization 的 **SQL 层**,**无中文**):`region.code() + " " + region.name() + " / " + target.code() + " " + target.name()`,落进契约的 `path` / `organizationPath`。分隔符、节点内分隔、编码在前名称在后,三个表达决定全在后台
3. **逐记录枚举翻译**(41 个 `*DisplayName` 字段跨 8 域):根因是**枚举词汇表只有 catalog 有**,其它域前端拿不到词汇表。**修法按 Dexter 2026-08-27 判据**:后端有明确代码支撑、非业务自定义的闭集,**由前端建字典,后端不建接口**;业务自定义的由后端返实体;时点快照保留。41 个后缀字段须按四类逐个判定,**不得整批退役**

**成本按事实来源分三档,不要一概而论**:入参已是结构化对象的(制作信息、生产标签实体)是净删代码;数据在表里但未 SELECT 的(标签)是同一 JOIN 多选列、不增往返但净增代码;**不需要任何数据库迁移** —— 曾以为属性选项要加 `code` 列,实测那个字段是凭空发明的:契约 `required` 就是 `["optionRef","name","displayOrder"]`,属性选项没有编码概念。⚠️ **契约与当前前端消费只能用来证伪**(证明某字段是凭空发明的、或某事实被遗漏),**不能用来正向决定 owner 的目标模型** —— 否则就成了按当前页面塑造 owner。owner 目标模型的来源是**业务身份与已批准的业务事实**。另有一项(规格维度)源码注释明写"故意不加载以避免第二次分页查询",改结构化**可能增加查询,必须先实测**。

## COMPUTABLE_BY_CONSUMER_STAYS_WITH_CONSUMER

**前端拿到完整模型后自己能算出来的,后台不许算;必须依赖模型之外的数据才能算的,后台必须算,并以结构化事实返回(枚举码 + 结构,不是句子)。**

- 「各规格制作内容不同」→ 各规格 profile 都在返回里 → 前端算 → 后台删掉
- `deletionAvailability` → 依赖全局引用计数 → 后台算,形状为 `{blocked, reason, count}` 而非句子

## MASTER_DATA_LIFECYCLE_IS_THREE_STATES

主数据实体只有三态:**启用 / 停用 / 标记删除**(存储值 `ENABLED / DISABLED / VOIDED`,不改名)。`DRAFT`、`ARCHIVED`、`EFFECTIVE` 等一律并入三态。

**适用判据(可证伪)**:能不能由人手动在两个状态之间来回切换?能 → 主数据,适用三态;不能(单向推进,终态由过程决定)→ 过程或关系记录,保留自有状态机(邀请、OTP、会话、任职、合同有效性、资产上传)。

可见性:启用件列表可见且可被选择;停用件**列表可见**(否则无法启用回来)但**不可被新引用选择**;已删除件列表不可见、不可被选择、**编码释放**。

## FRONTEND_DICTIONARY_FOR_CODE_DEFINED_ENUMS

**Dexter 2026-08-27 判据(原话)**:建立前端字典唯一的标准就是 —— **后端有明确的代码支撑、不是业务自定义的**,这种前端就需要建字典。

- **代码定义的闭集**(枚举、状态、种类)⇒ **前端建字典**,后端只返原始值,**不建词汇表接口**。这类标签是静态的、不随租户品牌变化,前端自己持有即可。
- **业务自定义的数据**(用户维护的条目)⇒ **后端返实体**(ref + 业务身份),不是字典问题。

**反例**:逐记录下发 `operatorKindDisplayName`、`authenticationKindDisplayName` —— 一个三值枚举在一页 20 行的列表里被翻译并传输 20 遍,而「门店」这个词成了后台的资产。

⚠️ **后端建词汇表接口不是省事的做法**:每个域 +1 个 operation,直接撞接口数量门。且 catalog 现有的 `shapeManifest` **不是词汇表** —— `enumLabels` 只是它十几个键中的一个,照抄会为别的域造一整套用不上的规则引擎。

## BUSINESS_IDENTITY_IS_ENTITY_SPECIFIC

**业务身份由该实体自己决定,不得写死成 `code` + `name`。**

商品标签是 `code` + `name`;**属性选项没有编码概念**(契约 `required` 就是 `["optionRef","name","displayOrder"]`);**运营角色也没有编码**(唯一键是名称,且 G-07 明写名称可改)。

**教训**:要求一个实体交出它从来没有的字段,**只会逼出一次没必要的数据库迁移**。实测曾据此设计过"给属性选项加 `code` 列 + 回填"的整档工作,后发现该字段是凭空发明的。

由此还得两条:**业务唯一键不一定叫 `code`**(仓内至少四种形状,含按名称唯一的);**业务唯一键 ≠ 稳定标识**,身份永远是 `ref` / `id`。

## COMMAND_SPECIFIC_STATUS_SEMANTICS

**同一个"目标已停用",不同命令的正确处置不同,不得机械复制。**

实测同一张 `workspace_account` 的六类查找:密码登录与 OTP **必须只选启用账号**;邀请流程遇到停用账号**必须拒绝并给 typed problem**;密码恢复已带启用过滤可作正向对照。

⚠️ **不能简单给查询加 `status='ENABLED'`** —— 那样停用行会被误判为**不存在**,随后走新建分支、撞唯一键。**查找必须先取回状态再分支**,至少区分 ABSENT / ENABLED / DISABLED / VOIDED。

## AGGREGATE_FACTS_ARE_OWNER_OWNED

**对未加载集合的聚合,是 owner 拥有的结构化业务事实,不是"装配的例外"。**

分类错会导致误删:把它归成例外,读者会以为"例外之外都能删";而**删掉它们不是"少拼一次",是丢事实** —— 前端拿不到完整集合就算不出来。

形态必须是数字、布尔或结构,**不得是句子**。仓内正例:`skuSummary` 给 `{enabledCount, nonArchivedCount, totalCount}`、前端自己拼「规格数量」;`deletionAvailability` 给 `{canDelete, blockingReferenceCount}`、前端自己写「仍有 N 个商品引用」。

## CASCADE_STATUS_IS_DERIVED_NOT_STORED

**对象只存自身状态。owner 读时把每个相关维度的状态各自作为事实返回,⛔ 不合并成一个值。哪些维度的哪种组合允许做什么,由应用场景决定。**

**Dexter 2026-08-27 原话**:一个对象可以有很多个维度的状态,每个维度都是事实都不能丢;至于不同维度状态组合能做什么,那是应用场景要考虑的,**但是不要把多个维度的状态合并成一个**。

⛔ **不得引入 `effectiveStatus` 这类单值字段。** 合并成一个布尔之后,「是自己停用了、还是父级停用了、还是上游被撤销了」这些事实全部丢失,前端既写不出准确的话,也无法引导用户去修对的那个地方。

- **"用哪个状态"必须分类,不得写成"业务逻辑一律用有效状态"** —— 那样会误伤管理编辑与恢复:

| 场景 | 用哪个 |
| --- | --- |
| 候选查询、新增引用、业务准入、下游消费 | **要求全部相关维度可用** |
| 管理列表与详情 | 返回**全部维度事实各自的值**,能指名道姓说出哪一维不可用 |
| 管理编辑、重新启用、未改引用的保存 | **只看自身状态**,⛔ 不得因任何祖先维度不可用而阻断(否则祖先一停,后代永远修不好也启不回来) |
| 历史、审计、快照、幂等回执 | **任何维度都不影响**,不得按当前可用性丢弃事实 |
- 被祖先阻断时,owner 必须返回**结构化阻断事实**(`{blockedBy: {ref, type, status}}`),**不是句子**。

**反例(实测,已裁定去除)**:`business_channel.stop_reasons` 把上游状态的派生结果当事实存下来 —— `CASCADE_EXTERNAL`(**external system 或 provider profile 停用**,非绑定失效)、`CASCADE_TEMPLATE`(模板被停),而全仓 `array_remove` 零命中、无清除路径,导致**停用后永久启用不回来**;`MANUAL` 则与 `status='DISABLED'` 完全冗余。

**级联落库必然产生不可逆**:存下来的派生值没法反派生。改成读时派生后,上游恢复则有效状态自动恢复,清除路径这个问题根本不存在。

**分母不止一处**:商品→规格、渠道→模板、分类树父子、组织树大区→项目→门店。catalog 今天**没有**任何父子状态联合判断(全仓只有 `status <> 'VOIDED'` 这类自身过滤)。

## NO_PHYSICAL_DELETE_FOR_ENTITIES

业务实体不做物理删除。

**边界(必须区分,否则误伤承重代码)**:"为表达集合被编辑而删行的 SQL"不在此列 —— 例如生产标签 0→1、1→0、1→另一个的整组删掉重插,是一次编辑的实现形式,不是实体删除。

## DISABLED_STAYS_EDITABLE

**停用不额外增加编辑限制**,而非"停用状态下什么都能改"。三处不适用:

1. 已删除件不可编辑
2. **引用校验不是编辑校验** —— 停用件不得被**新**引用选中;检查"用某模板新建对象"时该模板的状态,属引用校验,必须继续挡停用
3. **业务锁定字段与状态无关** —— 停用不解锁任何本就不可变的事实

## EXISTING_REFERENCE_EXEMPT_FROM_STATUS_CHECK

保存时只对**本次新增或改变**的引用做"必须启用"校验;**未变更的既有引用一律放行**。

不这样做的后果:任何引用了已停用/已删除定义的对象都会变成不可保存,用户连改个名字都做不到。

## VOIDED_RELEASES_CODE_AND_REF_IS_IDENTITY

已删除行仍在表内,普通唯一约束会永久占住编码,因此 `scope + code` 唯一约束必须是**排除已删除的 partial index**。

由此:**`code` 不是稳定业务标识,`ref` 才是** —— 同一 `code` 在不同时间可指向两个实体。对外传输、导出、跨系统对账不得以 `code` 作为身份。删除是终态且释放编码,误删不可撤销,因此删除确认必须给出当前引用数。

## AUTHORIZATION_DIMENSION_STAYS_IN_OPERATION_IDENTITY

**一个维度该不该出现在接口身份里,取决于它决定什么。决定授权的维度必须留在 operation 身份里;只决定展示的维度必须离开接口身份、进入数据。**

可证伪:对任一接口问「去掉这个维度后,授权判定会不会变得依赖请求体?」答会 ⇒ 必须保留分立接口;答不会 ⇒ 应当合并。

实例:IAM 的五个节点类型决定谁能执行,被 `noClientDerivedAuthorization: true` 与 `serverDerivedTarget: "STATIC_OPERATION_CAPABILITY"` 显式治理,**不得合并**;catalog 的分类路径标签只决定怎么显示,**必须进数据**。

⛔ **接口形状的相似性不能作为合并依据。** "这个维度决定什么"只能从业务语料库与已批准裁决中读出,不能从代码形状反推。
