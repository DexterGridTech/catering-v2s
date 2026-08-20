# 外部协作与经营渠道 · 需求规格说明书

| 项 | 内容 |
|---|---|
| 状态 | `REQUIREMENTS_CLOSED` · 2026-08-20 · 当前会话已收口并授权 implementation |
| 唯一权威来源 | `doc/review/platform/2026-08-18-v2s-external-platform-capability-and-binding-decoupling-source-claude.md` 的**记录 001～012**(Dexter 口述原文逐字) |
| 取代 | `2026-08-13-v2s-business-channel-requirements-final-claude.md`(已作废)与 `2026-08-18-...-requirements-claude.md`(十二轮补丁,已作废) |
| 边界 | 不是实施设计、不是 Journey 批准、不是运行时授权 |

**本文的三条自我约束**:

1. **不描述仓内已有机制的行为。** 控件、抽屉、列表、渲染、并发、凭证一律**指向既有实现**
   (§11)。描述它们等于要求重造(`project-memory/pitfalls/designing-from-conversation-not-system.md`)。
2. **约束只以 `BR` 一种形式出现。** 不设第二套「功能需求」——同一约束两处表述必然漂移。
3. **裁定与推导分开标注。** `E-xx` = Dexter 逐字裁定(可在记录 001～012 检索);
   未收口的 `C-xx` = 作者推导,**待确认**；`C-03` 已按本批会话裁定收口，不再作为未决项。

---

## 1 · 这份文档解决什么

### 1.1 两个结构性错位

**其一,分类学给错了对象。** 旧规格给**平台**分类,但美团横跨外卖、团购、配送多类。
真实结构是:**能力可分类,平台一对多持有能力**。

**其二,三层结构与经营渠道焊死了。** 现有
`BUSINESS_CHANNEL → PROVIDER_CONFIG → BINDING` 只服务渠道。做团购会再长一套同构的三层。
这三层表达的其实是「**外部系统是谁 / 我以什么身份接它 / 我的哪个主体对上它的哪个主体**」,
**与"是不是下单入口"无关**。渠道只是它的第一个消费者。

### 1.2 本期范围

**唯一做完整的域是「经营渠道」。** 外部协作只做**规则配置**这一层,因为渠道依赖它。

| # | 做 | 属于 |
|---|---|---|
| 1 | `external_system` / `provider_profile` / 能力分类与属性字典的**契约定义** | 外部协作 |
| 2 | platform-admin【外部系统接入配置】页:浏览、按集团空间启停、绑定管理 | 外部协作 |
| 3 | `owner_binding` 的建立与维护 | 外部协作 |
| 4 | **经营渠道模板**(项目自建、四维级联) | **渠道(完整域)** |
| 5 | **经营渠道实例**(项目页 + 门店页) | **渠道(完整域)** |
| 6 | 渠道随绑定有效而生效 | **渠道(完整域)** |

### 1.3 本期明确不做

- **订单同步的一切运行时**:分发收集、组织路径遍历、投递、重试、死信、治理信号
- **异步分发机制**:不引入 MQ、通用 outbox、常态轮询(AGENTS.md 红线)
- **订单来源快照与节点路径快照**:属订单域
- **适配器进程与外部联调**:`EXTERNAL_GRANT` 绑定可长期停在待授权,**这是合法状态**
- **菜单协作数据面**:菜单绑定渠道是后续迭代(G-11)
- **权益核销、团购券结算、库存双向同步**
- **订单同步的判断规则**:Dexter 明确「暂时还没想好」,连声明位置也不建
- **规则在 runtime 如何被使用**(E-28):本期**只管规则本身的管理**(定义、启停、绑定的建立与维护)。
  凡「该字段在授权/可见性/分发中如何被消费」一律不属本期 —— 原 BR-17 据此移出

⚠️ **未来做订单同步时,必须接 G-09 已有的「货号」**(其定义就是「用于订单上报商场 ERP 映射」,
`{编码,名称}` 二元、合同内唯一)。**不得另造映射。**

---

## 2 · 统一语言

| 术语 | 是什么 | **不是**什么 |
|---|---|---|
| **外部系统** `external_system` | 一个外部平台的身份。**契约态、全局、一平台一条** | 不是渠道 |
| **接入档案** `provider_profile` | 以某 ISV 身份接入该平台的**能力档案**。契约态、全局 | **不是"配置项"** —— 它声明能力与约束 |
| **主体绑定** `owner_binding` | 系统内经营主体 ↔ 外部平台经营主体的映射。**运行态、按集团空间隔离** | 不是渠道实例 |
| **能力分类** | 一组标准动作的分类。七类、**非互斥** | 不是平台分类;不是渠道订单类型 |
| **能力属性** | 某能力类下的细分事实(如团购的映射方向) | 不是判断规则 |
| **经营渠道模板** | 项目定义的渠道形态,四维级联 | **不再是预置目录** |
| **经营渠道实例** | 按模板创建的具体渠道 | 同模板可多条 |
| **渠道订单类型** | 模板维度:到店 / 外卖 / 团购 | 与能力分类同名者见 §3.3 |
| **经营主体类型** | 模板维度:项目 / 门店。即**菜单维护方** | 不是组织节点类型 |

---

## 3 · 关键分野(本文最重要的部分)

### 3.1 两层分工

**外部协作层**(通用):外部系统是谁、我以什么身份接它、我的哪个主体对上它的哪个主体。
服务所有外部接入,与业务种类无关。

**经营渠道层**(消费者之一):用户从哪个入口下单。外部渠道**消费**协作层的绑定;
**内部渠道完全不涉及**协作层。

> ❌ **反例**:「因为渠道需要,所以给协作层加个字段」。
> 任何这类诉求必须先证明该字段对**其他**外部接入同样成立,否则它属于渠道层。
> ⛔ 协作层不得反向依赖渠道层。

### 3.2 两类外部平台 —— **本模型的第一分界**(E-26)

| | **开放平台类** | **非开放平台类** |
|---|---|---|
| 成员 | **外卖、团购**、(后续)独立配送 | 其余全部:商场 ERP、会员卡券、主数据同步… |
| 授权 | 互联网平台的**开放授权体系**(跳转) | **不是开放式授权** |
| 谁维护 | **运营自己授权** | **运维管理员手工配置** |
| binding 基数 | **一业务线一条** | **一条覆盖该 provider 全部能力** |
| `externalOwnerId` | **授权的结果**,适配器回填 | 运维**手工填写** |
| 承载字段 | `authenticationKind = EXTERNAL_GRANT` | 其余两态 |

⇒ **该分界无需新增字段**,由既有 `authenticationKind` 承载。
⇒ 与「非渠道对象归运维」(E-18)完全对齐:**渠道绑定 ≡ 开放类 ≡ 运营**;
**非渠道绑定 ≡ 非开放类 ≡ 运维**。

> ❌ **反例(作者曾犯)**:担心"商场 ERP 同时有主数据同步和订单同步,要建两条 binding、跳两次授权"。
> **两个前提都错** —— 它根本不跳转授权,而且**一条 binding 就够**。

### 3.3 能力分类七类,与渠道订单类型的关系

| `capabilityClass` | 中文 | 构成下单入口 | 对应 `orderKind` |
|---|---|---|---|
| `MASTER_DATA_SYNC` | 主数据同步 | 否 | — |
| `MEMBER_BENEFIT` | 用户与权益 | 否(**本期仅占位**) | — |
| `GROUP_BUY` | **团购** | **是** | `GROUP_BUY` |
| `TAKEAWAY` | **外卖** | **是** | `TAKEAWAY` |
| `INVENTORY_SYNC` | 库存 | 否 | — |
| `TAKEAWAY_DELIVERY` | 外卖配送 | 否 | — |
| `ORDER_SYNC` | 订单同步 | 否 | — |

**「渠道订单类型」与「能力分类」同名但不同层** —— 前者是**我们的经营意图**,后者是**平台的能力**:

```
渠道 orderKind(单值) --本表映射--> binding.capabilityClass
                                   ∈ provider_profile.businessScope
                                   ⊆ external_system 的能力分类
```

- **外部渠道**:第一段是**相等**(经本表映射),因为一条 binding 只承载一个业务线;
- **内部渠道**:不涉及外部系统,**不做该校验**;
- **「到店」仅内部,因此没有对应能力分类** —— 不存在「到店」这个能力。

> ❌ **反例**:把两个枚举合并成一个。
> 合并后「订单同步」「库存」这些**不构成入口**的能力会变成可选的渠道订单类型。

**「订单同步」与「外卖/团购」方向相反,必须分列**:

> ✅ **判别反例(Dexter 提供)**:购物中心 ERP **只有订单同步,没有外卖/团购** ——
> 它从不产单,只想知道发生了什么。而美团**两者都要才完整**。
> 外卖/团购 = **进单**;订单同步 = **出状态**(一对 N)。

### 3.4 模块边界 —— 按**域**拆,不按后台拆(E-27)

| 模块 | 域 | 拥有 |
|---|---|---|
| `collaboration` | **对外对接关系** | `enablement_state`、`owner_binding` |
| `business-channel` | **经营入口** | 渠道模板、渠道实例 |

**三条判据**:

1. **独立存在**:有绑定无渠道(集团会员卡券、主数据同步)、有渠道无绑定(POS/扫码/自助机)
   —— 两边都能脱离对方存在且语义完整;
2. **变化原因不同**:协作层因接入新平台而变,渠道层因新增下单形态(如本次的「自助机」)而变;
3. **依赖单向**:渠道**引用**绑定;绑定不知道渠道存在。

**仓内先例**:`store-contract` 独立于 `organization` —— 合同基于门店、耦合紧、单向引用,
但属不同域,故独立模块与独立 schema。

> ❌ **反例(作者曾犯)**:以「两个后台、两类用户」为拆分理由。
> **后台是消费面,不是域。** Dexter 明确否定该依据。

**依赖形态**:

- 模块间依赖**单向** `business-channel → collaboration`(读)。
  ⛔ `collaboration` **不得** import `business-channel` —— 否则构成 Gradle 循环依赖。
- **跨域写不由任一 owner 发起**。绑定删除⇒渠道落回草稿、外部系统停用⇒渠道停用,
  一律由 **edge 的 operation policy 显式列出两个 owner command**,同一 `REQUIRED` 事务内依次调用。
  依据 blueprint:「跨 owner 的 whole-save 只能由 operation policy 明确列出有限 owner command、
  同一 `REQUIRED` 事务」;仓内 `contracts/registry/generated/operation-handler-bindings/` 已是该形态。

> ❌ **反例(作者曾犯)**:写成「级联写由 `collaboration` 调 `business-channel` 的公开 command API」。
> 它与"反向禁止"自相矛盾,**按字面实施 Gradle 会因循环依赖失败**。

### 3.5 契约态与运行态

| 对象 | 形态 | 集团空间 |
|---|---|---|
| `external_system` / `provider_profile` / 能力属性字典 | **契约态**:checked-in JSON,随代码交付、随发布生效 | **不区分** |
| `enablement_state`(启用状态) | 运行态 | **按集团空间**。⚠️ **无行时缺省为停用**(E-29):未开放的定义不出现在运营侧候选中 |
| `owner_binding` / 模板 / 渠道 | 运行态 | **按集团空间隔离** |

⚠️ **契约态对象没有 `ref` / `version` / 审计字段** —— 它不是数据库行,它有的是发布版本。
⇒ 判据保住:**新增一个平台 = 部署适配器 + 一行目录数据,主程序零代码改动**。

> ❌ **反例**:给契约态对象照搬运行态的字段习惯,加 UUID 和审计列。

### 3.6 组织节点:五类,跨两条路径

| 路径 | 节点 |
|---|---|
| 购物中心组织(G-02 的组织树) | 集团 → 大区 → 项目 |
| 租户组织 | 总公司(可空) → 门店 |
| 连接点 | **门店必属于且仅属于一个项目** |

**可绑节点类型恰为这五类。** 品牌与实际经营租户**是门店的属性,不是路径层级**:

- G-02:门店和总公司不是组织树节点
- G-03:可见门店范围只来自 `Store.headCompanyRef`,**不从品牌授权反推**
- G-04:每个门店必须且只能引用一个实际经营租户,项目+租户+品牌创建后锁定

> ❌ **反例(作者曾犯)**:问「品牌在不在路径上」。**语料 G-03 早已回答**,该问题不该问。

---

## 4 · 真实业务场景(Dexter 口述的案例;验收夹具的来源)

> 本节全部来自 Dexter 口述记录的**真实案例**,不是推演。

| # | 场景 | 它证明了什么 |
|---|---|---|
| **S-01** | 购物中心 ERP **只有订单同步**,没有外卖/团购;美团**两者都要才完整** | 订单同步必须与外卖/团购分列(§3.3) |
| **S-02** | **三级会员卡券系统**:集团统一 / 项目专属 / 门店自有,各绑各的节点 | 可绑节点类型须支持五类全部 |
| **S-03** | 交易主数据类平台**通常仅允许绑定集团节点** | 可绑节点类型**按档案逐个声明**,不是一视同仁 |
| **S-04** | **项目**可作为主体在美团开店售卖各门店商品(结算由项目自理);**门店**也可独立开店 | 模板需要「经营主体类型」维度 |
| **S-05** | 万象城海底捞一个门店,在美团有**三个外部店铺**:外卖「海底捞拌饭」、外卖「海底捞冒菜」、团购「海底捞万象城店」 ⇒ 建**三条渠道**,各做一次绑定 | **驱动基数的是菜单**(§5.4) |
| **S-06** | 美团:两业务 = 两店铺 ID + 两套授权;**饿了么:两业务 = 共用一个店铺 ID + 两套授权** | `externalOwnerId` **不设唯一约束** |
| **S-07** | 门店自有卡券系统**天然对应当前门店,无需主体映射** | 认证类型必须有第三态 `NO_MAPPING` |
| **S-08** | **美团对 ISV 的能力授权可能不一样**:A 档案仅外卖,B 档案外卖+团购 | 业务范围挂在**档案**上,不挂平台 |
| **S-09** | 团购:商品是外部映射内部还是内部映射外部;外卖:仅拉取外部菜单还是支持推送本地菜单 | 同一能力在不同平台属性取值不同(§5.3) |
| **S-10** | 订单状态变化,找到所有需订单同步的外部系统一起丢过去 | ⚠️ **本期不做**;仅说明订单同步为何是独立能力 |

---

## 5 · 领域模型

### 5.1 `external_system`(契约态)

| 字段 | 类型 | 必填 | 可变 | 业务含义 |
|---|---|---|---|---|
| `externalSystemCode` | 编码·全局唯一 | ✓ | **不可变** | 平台稳定标识 |
| `displayName` | 名称 | ✓ | 可改 | 界面展示名(如「美团」) |
| `capabilities[]` | 能力声明 → §5.2 | ✓ | 可改 | 该平台具备的能力分类,**一对多** |
| `catalogStatus` | `PLANNED` / `AVAILABLE` | ✓ | 可改 | 适配器是否已部署 |

⛔ **一个外部平台恰对应一条。** 不得为同一平台的不同业务建多条。

### 5.2 能力声明(`capabilities[]` 的每一项)

| 字段 | 必填 | 业务含义 |
|---|---|---|
| `capabilityClass` | ✓ | 七类之一(§3.3) |
| `attributeValues` | 可选 | 该平台在该能力下的属性取值;键须出现在 §5.3 字典中 |

### 5.3 能力属性字典 —— **直接用 foundation 的 `FieldDescriptor`**

⚠️ **字段语义对齐 foundation,但不强行复用该类型。**
`libraries/frontend/admin-ui-foundation/src/presentation/descriptorRenderer.tsx` 的
`FieldDescriptor` 共 **10 个字段**,其中**五个适用**于契约态只读属性,**五个不适用**:

| `FieldDescriptor` 字段 | 本场景 |
|---|---|
| `fieldKey` / `label` / **`helpText`** / `controlKind` / `optionSourceRef` | ✅ **直接沿用语义与命名**,不另起名字 |
| `dataPath` / `tabKey` / `admittedShapes` | ❌ **不适用** —— 它们是 catalog 商品表单的**布局与形态**概念(字段挂在哪个 tab、适用于哪些 shape),契约态只读属性没有这些维度 |
| `description` / `frontendBehavior` | ❌ 本期不需要 |

⇒ **正确的复用是"对齐语义、不新造名字",不是"照搬类型"。**
若详设选择直接复用 `FieldDescriptor` 类型,必须说明那三个不适用字段如何取值;
更可能的合理做法是**只声明五个字段**,由前端适配到渲染器。
⛔ 这一取舍**不得**由详设默认,须在详设中显式记录理由。

| foundation 已有 | 用作 |
|---|---|
| `FieldDescriptor.fieldKey` | 属性标识 |
| `FieldDescriptor.label` | 展示标签 |
| **`FieldDescriptor.helpText`** | **业务含义**(缺失即定义不完整,BR-30) |
| `FieldDescriptor.controlKind` | 取自 `DESCRIPTOR_CONTROL_KINDS` |
| `FieldDescriptor.optionSourceRef` | 取值来源:`enum` / `endpoint` / `local` |
| `DescriptorFieldRenderer` | 渲染器 |

**本场景是只读展示** ⇒ `controlKind` 取 `ReadonlyControlKind`(`readonlySummary` / `readonlyPreview`)。

⚠️ **不设 `displayOrder`**:数组声明顺序即渲染顺序
(`project-memory/practices/ordering-only-for-consumer-facing.md`)。

**已知两条属性(S-09)**:

| 能力 | `fieldKey` | `helpText` | 取值 |
|---|---|---|---|
| 团购 | `groupBuyMappingDirection` | 团购商品由外部映射到内部,还是必须内部映射到外部 | `EXTERNAL_TO_INTERNAL` / `INTERNAL_TO_EXTERNAL` |
| 外卖 | `menuCollaborationDirection` | 只能拉取外部菜单做内部映射,还是支持推送本地菜单 | `PULL_ONLY` / `PUSH_SUPPORTED` |

> ❌ **反例(作者曾犯两次)**:① 自造 `key`/`label`/`businessMeaning`/`valueType`/`options` 五字段;
> ② 称 `DESCRIPTOR_CONTROL_KINDS` 的 16 个值「是 catalog 专用」。
> **错** —— 只有 `DomainControlKind` 4 个是领域专用,其余 12 个通用。

### 5.4 `provider_profile`(契约态)

| 字段 | 类型 | 必填 | 可变 | 业务含义 |
|---|---|---|---|---|
| `providerCode` | 编码·全局唯一 | ✓ | **不可变** | 档案标识 |
| `displayName` | 名称 | ✓ | 可改 | 如「美团 · ISV-A」 |
| `externalSystemCode` | 引用 | ✓ | **不可变** | 所属外部系统 |
| `businessScope[]` | 能力分类数组 | ✓ | 可改 | 该 ISV 身份可用的业务范围,**⊆ 所属系统能力**(S-08) |
| `bindableNodeTypes[]` | 节点类型数组 | ✓ | 可改 | 允许绑定的节点类型。⚠️ **仅展示与可选性约束,授权路径不得读取** |
| `authenticationKind` | 三态 | ✓ | **不可变** | `EXTERNAL_GRANT` / `INTERNAL_MAPPING` / `NO_MAPPING` |
| `unbindKind` | 二态 | ✓ | **不可变** | `LOCAL_ONLY` 直接标记删除 / `REQUIRES_ADAPTER_UNBIND` 走两段式(§5.6) |
| `catalogStatus` | 枚举 | ✓ | 可改 | 同 §5.1 |

⚠️ **`authenticationKind` 与 `unbindKind` 是两个独立维度,不得互相推导。**
需跳转授权的不一定需要外部解除;仅内部映射的也可能需要通知外部。

⚠️ **两者不可变的理由**:它们决定操作权限与完成条件,中途变更会让已有绑定的语义漂移。
需变更时新建档案。

### 5.5 `owner_binding`(运行态,按集团空间隔离)

**它是一个扁平三元组,不是数组**:

```
owner_binding = (providerCode, capabilityClass, externalOwnerId) @ 组织节点
```

**基数由菜单粒度决定**:菜单 ↔ 渠道 **1:1**(记录 001 第 6 条)→ 每个外部店铺有自己的菜单
→ 外部店铺 ↔ 渠道 1:1 → **渠道 ↔ binding 1:1**(仅开放平台类)。

| 字段 | 必填 | 谁可改 | 可变 | 业务含义 |
|---|---|---|---|---|
| `bindingRef` | ✓ | 系统 | 不可变 | UUID |
| `groupWorkspaceKey` | ✓ | 系统 | 不可变 | 隔离键 |
| `providerCode` | ✓ | 创建时 | **不可变** | 所属档案 |
| `nodeType` / `nodeRef` | ✓ | 创建时 | **不可变** | 绑定的组织节点,**∈ 档案 `bindableNodeTypes`** |
| `capabilityClass` | **仅 `EXTERNAL_GRANT` 时✓** | 创建时 | **不可变** | 开放类:单个业务线,**∈ 档案 `businessScope`**。**非开放类为空**,语义 = 覆盖全部 `businessScope` |
| `bindingDisplayName` | 可选 | 运营/运维 | 可改 | 列表识别名(如「海底捞盖饭」) |
| `externalOwnerId` | 见右 | 见右 | 可改 | 外部店铺标识。**⚠️ 不设唯一约束**(S-06)。`EXTERNAL_GRANT` ⇒ 创建时**可空、授权回填**;`INTERNAL_MAPPING` ⇒ 创建时必填;`NO_MAPPING` ⇒ 必须为空 |
| `authorizationRef` | — | **适配器回填** | 系统写 | opaque,**不含 token** |
| `status` | ✓ | 系统/运营 | 状态机 | 见 §5.7 |
| `unbindRequestedAt` / `externalRevokedAt` / `deletedAt` | 可选 | 系统/适配器 | 一次性 | 解绑两段式与标记删除时点 |
| `version` | ✓ | 系统 | CAS | 并发控制 |

> ❌ **反例(作者曾犯)**:把「饿了么共用店铺 ID」读成「一条 binding 承载两套授权」,
> 于是提议给 binding 加 `authorizations[]` 子项。
> **真实约束是菜单粒度** —— 饿了么是**两条 binding、`externalOwnerId` 相同**。

> ❌ **反例**:`EXTERNAL_GRANT` 绑定要求创建时填 `externalOwnerId`。
> 美团官方文档:「商家就具体业务的服务场景及**授权资源进行选择**,授权同意后…
> 每次授权成功后 ISV 会获得一个**业务授权码**用以换取 `access_token`」,
> 且「授权完成后 SDK 自动跳转至开发者设置的**回调地址**」。
> ⇒ **店铺标识是授权的结果,不是输入**。按错误写法,美团与饿了么的绑定根本创建不出来。
> ⚠️ 早期版本写作「商家在平台页面**输入**店铺号」——**那是 mock 的简化行为**
> (mock 不实现美团登录,用输入代替选择),不是平台真实次序,已更正。

### 5.6 两段式解绑 —— **主程序不知道任何平台规则**

各平台的解绑机制与链接各不相同(美团要商家跳转到平台操作并异步回调,其他平台可能完全不同)。
**差异一律由适配器吸收**,主程序只见统一协议:

| 段 | 主程序 | 适配器返回/通知 | 主程序据此 |
|---|---|---|---|
| **一** ⚠️(**C-04 待确认**:分支③与「解绑中」状态是作者推导) | 申请解绑,记 `unbindRequestedAt`,进入**解绑中** | ① 已直接完成 / ② 需用户自行操作(附载荷)/ ③ 失败或被拒(附原因载荷) | ① **同事务内自置 `externalRevokedAt`**,可标记删除;② 载荷**原样展示**,停留解绑中;③ 退回原状态并展示原因 |
| **二** | 等待(可长期) | 用户操作完成后**适配器先收到**,再通知成功或失败 | 成功 ⇒ 回填 `externalRevokedAt`,方可标记删除;失败 ⇒ 退回原状态 |

⚠️ **无超时自动放弃** —— 外部操作由商家决定何时做。运营/运维可**撤销解绑申请**(退回原状态),
这是唯一的主动退出路径。

> ❌ **反例(作者曾犯)**:读了美团文档后,提议主程序按「跳转 + 回调」实现解绑。
> **那是平台细节,正是适配器要吸收的东西。** 主程序不得解析载荷、不得拼装解绑 URL 或签名。

### 5.7 状态机

| 对象 | 状态 | 迁移 |
|---|---|---|
| `enablement_state` | 启用 / 停用 | 运维操作;**停用 ⇒ 相关对象置灰 + 级联停用依赖渠道**,数据一律保留 |
| `owner_binding` | 待授权 → 有效 → 失效;有效/失效 → **解绑中** → 已删除 | 进入有效:`EXTERNAL_GRANT` 授权成功后 / `INTERNAL_MAPPING` 映射完成后 / `NO_MAPPING` 创建即有效。进入已删除:`LOCAL_ONLY` 直接标记;`REQUIRES_ADAPTER_UNBIND` 须 `externalRevokedAt` 非空 |
| `business_channel` | 草稿 → 生效 → 停用 | 主动:运营操作。**被动**:绑定被删⇒落回草稿;模板停用⇒停用;外部系统/档案停用⇒停用 |

**级联与恢复**:

| 触发 | 连带 | 跨域? |
|---|---|---|
| 绑定标记删除 | 引用它的渠道**落回草稿**,`bindingRef` 置空 | **是**(由 edge 编排) |
| 模板停用 | 其渠道停用,`stopReasons` 加 `CASCADE_TEMPLATE` | 否(同域) |
| 外部系统/档案停用 | 依赖渠道停用,`stopReasons` 加 `CASCADE_EXTERNAL` | **是**(由 edge 编排) |

**恢复不是翻转标志,是重新求值**(C-01,作者推导):
移除触发恢复的那个来源 → `stopReasons` **仍非空则保持停用** → 仅当变空才恢复。

> ❌ **反例**:用单值 `stoppedBy`。一条渠道可**同时**被模板与外部系统停用;
> 单值会导致模板恢复时把外部系统仍停用的渠道打开,**违反自身规则**。
> 也会让 `MANUAL` 被级联覆盖,恢复时打开运营手动停掉的渠道。

### 5.8 `business_channel_template`(运行态,项目自建)

| 字段 | 必填 | 可变 | 业务含义 |
|---|---|---|---|
| `templateRef` / `projectRef` | ✓ | 不可变 | 标识;归属项目(模板是项目级资产) |
| `templateName` | ✓ | 可改 | 展示名 |
| `templateCode` | ✓ | **不可变** | 用户创建时录入的项目内唯一业务编码;冲突返回 `DUPLICATE_CODE` |
| `accessKind` | ✓ | **不可变** | `INTERNAL` / `EXTERNAL` |
| `operatorKind` | ✓ | **不可变** | `PROJECT` / `STORE`,即**菜单维护方**(S-04) |
| `orderKind` | ✓ | **不可变** | `DINE_IN` / `TAKEAWAY` / `GROUP_BUY`。`DINE_IN` **仅内部** |
| `dineInForm` | `DINE_IN` 时✓ | **不可变** | `POS` / `QR` / **`KIOSK` 自助机(本次新增)** |
| `providerCode` | `EXTERNAL` 时✓ | **不可变** | 选定的档案,须已对本空间启用 |
| `status` / `version` | ✓ | 状态机 / CAS | 启用 / 停用 |

⚠️ **四维不可变的理由**:它们共同决定业务语义与 §3.3 的校验链;中途改动会让已建实例与其历史事实
失去一致解释。需变更时新建模板。

### 5.9 `business_channel`(运行态,渠道实例)

| 字段 | 必填 | 可变 | 业务含义 |
|---|---|---|---|
| `channelRef` / `templateRef` | ✓ | 不可变 | 标识;来源模板(四维由它冻结) |
| `ownerNodeType` / `ownerNodeRef` | ✓ | 不可变 | 与模板 `operatorKind` 一致 |
| `channelCode` | ✓ | 不可变 | 用户创建时录入的对账稳定码;在同一集团空间内唯一;冲突返回 `DUPLICATE_CODE` |
| `channelName` | ✓ | 可改 | 展示名(如「海底捞冒菜」) |
| `bindingRef` | `EXTERNAL` 时✓ | **可改**(E-22) | 关联绑定;绑定有效 ⇒ 渠道方可生效 |
| `status` / `stopReasons[]` / `version` | ✓ | 状态机 / CAS | 见 §5.7 |

> ❌ **反例(作者曾犯)**:把「渠道不做唯一性校验」外推到 `channelCode`。
> Dexter 说的是**实例条数**不做唯一性;一个不唯一的编码无法充当对账稳定码。

---

## 6 · 业务规则(每条独立可测;验收见 §10)

| BR | 规则 | 判定时机 | ❌ 违反的样子 | 状态 |
|---|---|---|---|---|
| **BR-01** | 一个外部平台恰一条 `external_system` | 目录发布 | 同一平台建两条 |
| **BR-02** | 档案 `businessScope` ⊆ 所属系统能力分类 | 目录发布 | 档案声明平台没有的能力 |
| **BR-03** | 开放类绑定的 `capabilityClass` ∈ 档案 `businessScope`;非开放类无该字段,覆盖面即全部 `businessScope` | 绑定创建 | 绑定声明档案范围外的业务 |
| **BR-04** | `nodeType` ∈ 档案 `bindableNodeTypes` | 绑定创建 | 把仅限集团的平台绑到门店 |
| **BR-05** | 外部渠道 `orderKind` 经 §3.3 映射后**等于**绑定 `capabilityClass` | 渠道创建/关联 | 外卖渠道关联团购绑定 |
| **BR-06** | `orderKind = DINE_IN` ⇒ `accessKind` 必须 `INTERNAL` | 模板创建 | 建"外部到店"模板 |
| **BR-07** | `DINE_IN` ⇒ `dineInForm` 必填;其余 ⇒ 必须为空 | 模板创建 | 外卖模板填了点餐形式 |
| **BR-08** | `EXTERNAL` ⇒ `providerCode` 必填且该档案**已对本空间启用**。⚠️ 判据是**启用状态**,**不是** `catalogStatus`(E-33) | 模板创建 | 选了**未启用**的档案 |
| **BR-09** | 外部渠道当且仅当绑定**有效**时可生效 | 渠道状态迁移 | 绑定待授权却把渠道置为生效 |
| **BR-10** | `EXTERNAL_GRANT` 绑定**只能由授权回填**进入有效 | 绑定状态迁移 | 人工点"标记为已授权" |
| **BR-11** | `EXTERNAL_GRANT` 时 platform-admin **仅可删除** | 界面与写入 | 出现编辑入口 |
| **BR-12** | `externalOwnerId` 三分:`NO_MAPPING` 必空 / `INTERNAL_MAPPING` 创建必填 / `EXTERNAL_GRANT` 创建可空、授权回填 | 绑定创建/回填 | 要求 `EXTERNAL_GRANT` 创建时填店铺号 |
| **BR-13** | 停用**不删除、不隐藏**任何下游对象,一律置灰 | 启停操作 | 停用后渠道从列表消失 |
| **BR-14** | 置灰对象**不可编辑**,历史事实保持可读 | 界面与写入 | 置灰对象仍可保存 | ✅ 裁定(E-31) |
| **BR-15** | 同一模板可创建**任意多条**渠道实例 | 渠道创建 | 因唯一性拒绝第二条 |
| **BR-16** | 门店渠道的模板候选**仅**上级项目维护、`operatorKind = STORE` 且 `status = ENABLED`（有效）者 | 候选查询 | 门店页出现项目主体模板或停用模板 |
| **BR-18** | 模板四维、绑定的 `providerCode`/`nodeType`/`nodeRef` 创建后不可变 | 修改 | 改已建模板的订单类型 |
| **BR-19** | 界面任何位置**不得**展示 ISV 凭证、token 或 `authorizationRef` 的**值** | 所有读接口与页面 | 详情页显示 token |
| **BR-20** | 渠道相关写能力**恰为两个**;读不设独立 capability | 权限模型 | 出现第三个渠道写 capability |
| **BR-21** | 模板与渠道**只能停用,不能删除**;置灰对象同样不可删 | 删除请求 | 提供删除按钮并生效 |
| **BR-22** | **本规格涉及的对象一律无物理删除**(外部系统与档案的启用状态、绑定、模板、渠道);绑定的删除是标记删除 | 删除请求 | 真的 DELETE 掉行 | ✅ 裁定(E-32,范围=本需求范围内) |
| **BR-23** | `REQUIRES_ADAPTER_UNBIND` 须两段式完成(`externalRevokedAt` 非空)才可标记删除 | 删除请求 | 直接标记删除 |
| **BR-24** | 绑定标记删除 ⇒ 引用它的渠道**落回草稿**且 `bindingRef` 置空 | 删除事务内 | 渠道仍指向已删绑定 |
| **BR-25** | 模板停用 ⇒ 其渠道停用记 `CASCADE_TEMPLATE`;外部系统/档案停用 ⇒ 依赖渠道停用记 `CASCADE_EXTERNAL` | 停用事务内 | 渠道未被连带停用 |
| **BR-26** | 恢复时**重新求值** `stopReasons`,仍非空则保持停用;`MANUAL` 永不被清除 | 启用事务内 | 模板恢复把外部系统仍停用的渠道打开 | ⚠️ **C-01 待确认** —— Dexter 只裁了级联停用,未裁恢复语义 |
| **BR-27** | 跨域级联由 **edge 的 operation policy 编排两个 owner command**,同一 `REQUIRED` 事务 | 级联写 | `collaboration` 直接调 `business-channel` |
| **BR-28** | 主程序**不得解析**解绑载荷、不得拼装解绑 URL 或签名 | 实现与评审 | 主程序出现平台特定分支 |
| **BR-29** | **开放类**一条 binding 恰一个业务线;外部渠道恰关联一条 binding。**不适用于非开放类** | 绑定/渠道创建 | 让多个业务线共用一条开放类 binding |
| **BR-30** | 能力属性字典每条须有非空 `label` 与 `helpText` | 契约发布 | 属性只有 key 没有业务含义 |
| **BR-31** | 渠道/绑定与门店启停(G-08)、合同衍生状态(G-09)**互不推导**;已停用门店**不阻断**建绑定/渠道,判定**集中单点**。**出处**:2026-08-13 R-4 裁定,2026-08-19 Dexter 再次确认(记录 011);G-08 明载该项属其「逐项待裁决」子项 | 创建 | 因门店停用拒绝建渠道 |
| **BR-32** | 主程序**不直连外部平台**;适配器**绝不读主库**,自有独立 schema 独立账号 | 实现与评审 | 主程序直接调美团 API |
| **BR-17** | 建绑定时,节点类型候选**仅列**档案 `bindableNodeTypes` 内的类型;节点候选按 `nodeType` 从对应路径取 | 管理面候选查询 | 列出档案不允许的节点类型 |
| **BR-34** | 非渠道绑定运营侧**无写入口**,由运维统一维护 | 界面与写入 | 运营页出现集团级绑定维护 |
| **BR-35** | **契约中存在的定义即可被启用**;`catalogStatus` 仅为信息标注,**不构成启用门槛**,也不阻断进入运营侧候选 | 启用/候选 | 因 `PLANNED` 拒绝启用或从候选中剔除 | ✅ 裁定(E-33)。⚠️ **推翻**作者原推导「`PLANNED` 不可启用」 |

⚠️ **BR-13/14/15/17/19/20/22/27/28/29/32/34 是「出现即为缺陷」型** ——
正确实现下不会触发,须由**红夹具或评审期人工核验**证明其不发生,不能只靠正向用例。

---

## 7 · 用户旅程

> 每个旅程只写**非显然的要求**。控件、抽屉、列表、搜索、空态等一律由既有实现承担(§11)。

### UC-01 · 只读浏览(运维管理员)

- **前置**:已切换到目标集团空间(G-10:运维后台 URL 不携带空间编码,所选空间是**端内会话上下文**)
- **两条非显然要求**:
  1. **展示状态 = 契约定义 ⊕ 本集团空间的 `enablement_state`** —— 定义全局、启用按空间,界面是二者叠加
  2. **未切换空间时不得展示任何绑定数据**
- **异常**:`catalogStatus = PLANNED` 的对象展示并标注「适配器未部署」,**仍可启用**(E-33);该标注仅为信息,不影响任何门槛

### UC-02 · 启停外部系统或接入档案(运维管理员)

1. 展示**影响面计数**:该操作将影响的下游档案、绑定与渠道数量
2. 确认后写 `enablement_state`(CAS)
3. 下游对象转为**置灰**,并**级联停用**依赖渠道(BR-25)
- **后置**:无任何数据被删除或隐藏(BR-13)

### UC-03 · 维护绑定(运维管理员)

1. 读档案的 `authenticationKind` 与 `bindableNodeTypes`
2. `EXTERNAL_GRANT` ⇒ **仅呈现删除入口**(BR-11)
3. 其余两态 ⇒ 增删改。新建时:
   - **先选节点类型** —— 候选**仅**档案 `bindableNodeTypes` 内的类型(BR-17)
   - **再选具体节点** —— 用既有 `usePlatformOrganizationCandidates`(§11)
   - `externalOwnerId` 按 BR-12 三分
   - **`capabilityClass` 不填** —— 非开放类一条绑定覆盖全部能力(§3.2)
- **删除**:走 §5.6 两段式;`REQUIRES_ADAPTER_UNBIND` 本期**无法完成解绑**(适配器不在本期),
  绑定停在有效或失效态,**这是合法状态**

### UC-04 · 创建经营渠道模板(项目运营;需**项目渠道编辑**)

1. 填 `templateName`、`templateCode`，再选 `accessKind` → `operatorKind` → `orderKind`(`DINE_IN` 则继续选 `dineInForm`); `templateCode` 创建后不可修改
2. `EXTERNAL` ⇒ 按**能力分类**筛选,从已对本空间开放的档案中选
3. 校验 BR-06/07/08 后写入,四维冻结(BR-18)

### UC-05 · 创建渠道实例并建立绑定(项目/门店运营)

1. 选模板,填用户录入且创建后不可修改的 `channelCode` 与 `channelName`
2. 外部接入 ⇒ 初始化绑定,行为受 `authenticationKind` 约束:
   - `EXTERNAL_GRANT` ⇒ 跳转外部平台授权,适配器回填 `authorizationRef` **与 `externalOwnerId`**
   - `INTERNAL_MAPPING` ⇒ 系统内填写 `externalOwnerId`
   - `NO_MAPPING` ⇒ 创建即有效
3. `INTERNAL` 渠道创建即生效；`EXTERNAL` 渠道只有绑定**有效**后方可生效(BR-09)
- **门店页**:模板候选仅上级项目维护且主体为门店者(BR-16)
- **同模板可再建**:如「海底捞盖饭」「海底捞冒菜」(BR-15)

---

## 8 · 界面数据要求(**只规定数据,不规定行为**)

| 界面 | 至少显示 | **绝不显示** |
|---|---|---|
| **P1** 外部系统树 | 系统与档案的 `displayName` + **本空间启用状态** | 凭证、token、`authorizationRef` 值 |
| **P2** 系统详情 | `displayName`、`externalSystemCode`、`catalogStatus`、**能力分类及属性取值(按 `label` + `helpText` 渲染)**、本空间启用状态 | 只有 key 没有 `label` 的裸属性 |
| **P3** 档案详情 | `displayName`、`providerCode`、所属系统、`businessScope`、`bindableNodeTypes`、`authenticationKind` 及其对操作权限的影响、`unbindKind`、本空间启用状态 | ISV 静态凭证 |
| **P4** 绑定列表 | `bindingDisplayName`、`nodeType` + **节点名称**、`capabilityClass`、`externalOwnerId`、`status` | `authorizationRef` 值 |
| **P5** 绑定详情 | P4 全部 + `boundAt` / `statusChangedAt` + 授权状态说明 | token;**`nodeRef` 的 UUID 不得作用户文案** |
| **P6** 绑定新建/编辑 | 节点类型选择器(**仅档案允许的类型**)、节点选择器、`externalOwnerId`(按 BR-12) | `NO_MAPPING` 不得出现 `externalOwnerId` 输入框 |
| **O1** 模板列表 | `templateName`、`templateCode`、四维、外部时的档案名、`status` | 停用系统对应的模板**置灰不隐藏** |
| **O2** 模板创建 | `templateName`、`templateCode`、四维取值;外部时可选档案及其 `authenticationKind`、`bindableNodeTypes` | 未对本空间开放的档案 |
| **O3/O5** 渠道列表 | **`channelName`**、**`channelCode`**、来源模板、`status`、外部时绑定状态 | 门店页不得出现项目主体模板 |
| **O4** 渠道详情 | 四维、`channelName`、`channelCode`、绑定的 `externalOwnerId`/`capabilityClass`/`status` | 需授权者不得有"手工置为有效"入口 |

⚠️ **`channelCode` 列是机械控制项**:G-05B 要求「owner 有真实业务编码时必须另有可见『编码』列」,
由 `contracts/policy/crud-presentation-standard-catalog.json` + `scripts/check/frontend-architecture` 强制。

**通用**:能力分类、节点类型、认证类型一律用中文业务名,不暴露枚举字面量;停用对象一律置灰。

---

## 9 · 接口、错误与权限

### 9.1 操作清单(业务意图;实际 operationId 由详设按生成器约定确定)

| # | 操作 | 读写 | 消费面 | 集合形态 |
|---|---|---|---|---|
| OP-01 | 读系统与档案树(含本空间启用状态) | 读 | platform-admin | Bounded(契约目录) |
| OP-02 | 读系统详情(含能力与属性) | 读 | platform-admin | Detail 聚合 |
| OP-03 | 读档案详情 | 读 | platform-admin | Detail |
| OP-04 | 启停系统 | 写 | platform-admin | — |
| OP-05 | 启停档案 | 写 | platform-admin | — |
| OP-06 | 分页查询某档案下的绑定 | 读 | platform-admin | **Page** |
| OP-07 | 读绑定详情 | 读 | 两端 | Detail |
| OP-08/09 | 创建 / 修改绑定 | 写 | 两端 | — |
| OP-10 | 申请解绑 / 标记删除 | 写 | 两端 | — |
| OP-11 | 授权回填(`authorizationRef` + `externalOwnerId`) | 写 | **适配器** | — |
| OP-12 | 解绑通知回填(`externalRevokedAt`) | 写 | **适配器** | — |
| OP-13 | 查询可选档案(按能力分类筛) | 读 | operations-admin | Bounded |
| OP-14 | 模板新增/修改/停用 | 写 | operations-admin | — |
| OP-15 | 分页查询模板 | 读 | operations-admin | **Page** |
| OP-16 | 查询门店可选模板 | 读 | operations-admin | **Page** |
| OP-17 | 渠道新增/修改/停用 | 写 | operations-admin | — |
| OP-18 | 分页查询渠道 | 读 | operations-admin | **Page** |
| OP-19 | 读渠道详情 | 读 | operations-admin | Detail |
| OP-20 | 读能力属性字典 | 读 | 两端 | Detail 聚合 |
| OP-21 | 按节点类型检索可绑节点候选 | 读 | 两端 | **复用既有,见 §11** |

⚠️ **OP-14/OP-17 无删除**(BR-21)。集合形态依据
`project-memory/practices/collection-boundary-modes.md`。

### 9.2 错误语义(违反 BR 时必须返回确定的 typed problem)

| problem code | HTTP | 对应 |
|---|---|---|
| `BUSINESS_SCOPE_EXCEEDED` | 422 | BR-03 |
| `NODE_TYPE_NOT_BINDABLE` | 422 | BR-04 |
| `ORDER_KIND_MISMATCH` | 422 | BR-05 |
| `DINE_IN_MUST_BE_INTERNAL` | 422 | BR-06 |
| `DINE_IN_FORM_MISMATCH` | 422 | BR-07 |
| `PROVIDER_NOT_ENABLED` | 422 | BR-08、BR-35 |
| `BINDING_NOT_EFFECTIVE` | 409 | BR-09 |
| `AUTHORIZATION_REQUIRED` | 409 | BR-10 |
| `BINDING_EDIT_NOT_ALLOWED` | 403 | BR-11 |
| `EXTERNAL_OWNER_ID_MISMATCH` | 422 | BR-12 |
| `DUPLICATE_CODE` | 409 | 模板/渠道创建时项目或集团空间编码重复 |
| `DISABLED_OBJECT_NOT_EDITABLE` | 409 | BR-14 |
| `IMMUTABLE_FIELD` | 422 | BR-18 |
| `DELETE_NOT_ALLOWED` | 403 | BR-21 |
| `ADAPTER_UNBIND_REQUIRED` | 409 | BR-23 |
| `VERSION_CONFLICT` | 409 | 通用 CAS |

⚠️ **「出现即为缺陷」型 BR 不配拒绝码** —— 正确实现下不会触发,由红夹具或人工核验证明。
⚠️ **BR-01/02/30 是目录发布期校验**,失败即契约发布失败,不产生 HTTP 响应。

### 9.3 权限

**运营侧写能力恰两个**(E-17):

| capability | 覆盖 |
|---|---|
| **项目渠道编辑** | 模板新增/修改/停用;项目主体渠道;**其渠道对应绑定** |
| **门店渠道编辑** | 门店主体渠道;**其渠道对应绑定** |

**读不设独立 capability** —— 有页面菜单权限即可读。依据 blueprint 红线:
「operations capability 只表达用户发起的写工作流,**不得作为页面访问或任何 GET 的读取权限**」。

**两个写能力符合红线,不是偏好**:红线要求「**不同目标数据节点类型的写入必须有不同 capability**」;
项目渠道(target `PROJECT`)与门店渠道(target `STORE`)恰是两种。

**两个页面的可访问角色与数据节点层级**(Dexter 逐字):

| 页面 | 可访问节点角色 | 数据节点定位到 |
|---|---|---|
| 项目经营渠道管理 | **集团、大区、项目** | **项目** |
| 门店经营渠道管理 | **集团、大区、项目、门店** | **门店** |

**platform-admin 无 capability 模型**(blueprint 红线,非本文裁定):
平台管理员均为同级 `platform-super-admin`;写授权 = **有效平台 session + platform owner 对已启用状态的最终复核**;
契约用 `x-required-platform-authorization`;**生成链与不变量门必须拒绝 platform-admin 的 `capabilityKey`**。

> ❌ **反例(作者曾犯)**:为 platform-admin 设计「运维写能力」并登记为待裁项。
> 它不是待裁,是**红线禁止**,且生成门会直接拒绝。

**运营侧写授权走既有机制**:edge 解析 server-minted `OperationsOwnerScopeGrant` 传入事实 owner;
owner 在 CAS/审计/replay **之前**复核 grant 的 workspace、group、target type、target reference、
capability、operation purpose。

| 写操作 | 实际写 target |
|---|---|
| OP-04/05 启停 | 集团空间;平台侧授权形态 |
| OP-08/09/10 渠道绑定 | 该绑定所挂组织节点 |
| OP-08/09/10 非渠道绑定 | 同上,**仅运维**(BR-34) |
| OP-11/12 适配器回填 | 该绑定所挂节点;**仅适配器身份** |
| OP-14 模板 | **`PROJECT`** |
| OP-17 渠道 | 项目主体 ⇒ `PROJECT`;门店主体 ⇒ **`STORE`** |

⛔ 门店主体渠道**不得**以 `PROJECT` target 放宽;⛔ 请求体/session 投影/UI capability 不是授权真相。

---

## 10 · 验收判据(**以 BR 编号为键,不设序号**)

> 上一版用连续序号,中途插条目后引用整体错位。**以 BR 编号作键 —— 没有序号,就没有序号可错位。**
> §4 的十个场景是夹具来源。

| 键 | 判据 | 方式 |
|---|---|---|
| **BR-01** **BR-02** **BR-30** | 目录发布期校验:一平台一条;`businessScope` ⊆ 系统能力;属性有 `label` 与 `helpText` | 契约校验 |
| **BR-03** **BR-05** | §3.3 映射链可机器校验 | 静态 + 场景 |
| **BR-04** **BR-17** | 可绑节点恰五类;候选按 `nodeType` 取且仅列档案允许的类型 | 场景 |
| **BR-06** **BR-07** | 到店仅内部;`dineInForm` 到店必填、其余必空 | 场景 |
| **BR-08** **BR-35** | **未启用**的档案不出现在候选中、强行提交被拒;⚠️ **`PLANNED` 档案不得因此被剔除**(红夹具:因 `PLANNED` 拒绝启用或剔除候选应判失败) | 场景 + 红夹具 |
| **BR-09** **BR-10** **BR-11** **BR-12** | 认证三态与操作权限对应;需授权者仅可删除;`EXTERNAL_GRANT` **不得**创建时要求店铺号 | 场景(须覆盖美团真实次序) |
| **BR-13** **BR-14** | **两条各自独立验**:① 停用后下游对象**仍在列表中且可读**(BR-13);② 对置灰对象发起编辑/保存**被拒**(BR-14) | 红夹具**两个**:停用触发删除或隐藏应判失败;置灰对象保存成功应判失败 |
| **BR-15** | 同模板可多实例 | 场景 S-05 |
| **BR-16** | 门店页模板候选正确 | 场景 S-04 |
| **BR-18** | 不可变字段修改被拒 | 场景 |
| **BR-19** | 响应体或 DOM 出现凭证/token/`authorizationRef` 值 | 红夹具:出现即失败 |
| **BR-20** | 渠道写能力恰两个 | **评审期人工核验**(打开 capability 注册表数) |
| **BR-21** **BR-22** | 模板/渠道删除被拒;绑定删除后行仍在且 `deletedAt` 有值 | 红夹具:物理删除应判失败 |
| **BR-23** | `externalRevokedAt` 为空时请求标记删除被拒 | 场景 |
| **BR-24** | 绑定删除后渠道 `status=草稿` 且 `bindingRef` 为空 | 场景 |
| **BR-25** **BR-26** | 级联停用记来源;恢复重新求值,**双来源时仅恢复一个不放行**;**且运营 `MANUAL` 停用的渠道在任何级联恢复后仍为停用** | 场景(**必须覆盖双来源 + MANUAL 混合来源**) |
| **BR-27** | 协作域未直接写渠道域表;跨域由 edge 编排 | **评审期人工核验** |
| **BR-28** **BR-32** | 主程序无平台特定解绑逻辑;不直连外部;适配器不读主库 | **评审期人工核验** |
| **BR-29** | **双平台夹具**:同店两渠道 `externalOwnerId` **不同**(美团)与**相同**(饿了么),两者均成功 | 场景 S-06 |
| **BR-31** | 已停用门店的渠道/绑定新建**不阻断**;判定集中单点 | 场景 + 人工核验 |
| **BR-34** | 运营侧无非渠道绑定入口 | 红夹具 |

⚠️ **自证(一行命令可跑)**:本表的 BR 键集合必须等于 §6 的 BR 编号集合。
键一律**全写**,不用 `BR-01/02` 缩写 —— **需要聪明解析的自证机制不会被跑**。

---

## 11 · 既有实现对接(**本文不描述它们的行为**)

⚠️ AGENTS.md 强制:UI 功能必须先对接 `libraries/frontend/admin-ui-foundation`,
不得在 `apps/frontend/*` 重复实现共享行为。
**完整查找表**:`project-memory/practices/frontend-capability-lookup.md` 与 `backend-capability-lookup.md`。

| 要用的 | 既有实现 | 本需求需要的改动 |
|---|---|---|
| 节点选择框 | `usePlatformOrganizationCandidates`(已包 foundation `useCursorCandidates`;`PAGE_SIZE=50`、debounce、滚动累加不呈现页码、`selectedId` 回显、`total`) | **仅扩两个枚举**:`subjectType` 补 `COMMERCIAL_GROUP`/`REGION`;`candidateUsage` 补一个外部绑定用途值。⛔ 不新建 operation |
| 能力属性只读渲染 | foundation `DescriptorFieldRenderer` + `FieldDescriptor` | 无 |
| 详情抽屉 | foundation `adminDrawerSurfaceProps` / `useDetailDrawer` / `overlayLock` | 无 |
| 列表状态与查询身份 | foundation `adminListState` / `usePageQuery` / `contextScopedQueryArgs` | 无 |
| 集团空间切换 | `platform-admin/app/state/WorkspaceScope.tsx` | 无 |
| 树 + 右侧详情 | `PlatformReadPage.tsx`(样板) | 无 |
| 表格 + 启停 + 状态弹窗 | `WorkspaceManagementPage.tsx` + `WorkspaceStatusModal.tsx`(样板) | 无 |
| 编码+名称展示 | foundation `formatNameCode` / `NameCodeText` | 无 |
| 写授权 grant | `organization.api.OperationsOwnerScopeGrant` | 无 |
| 跨 owner 编排 | `contracts/registry/generated/operation-handler-bindings/` | 新增本域的 policy 行 |
| 乐观并发 | `expectedVersion` + `version` | 无 |

⚠️ **已知依赖**:`getPlatformOrganizationCandidates` 的 owner 侧读法在统一列表分页整改中被判为
**内存分页族**(全量物化后 Java 切片)。本需求复用即继承该缺陷,须待那批整改完成或本批一并修。

### 11.1 低成本演进(最硬的一条非功能要求)

**可证伪判据**:

> - 新增一个**能力分类** = 加一个枚举值 + 一份属性 schema,**两处**
> - 新增一个**能力属性** = 契约数组加一条声明,**一处**;后端零改动、前端无需新增展示代码
> - 新增一个**外部平台** = 一条定义 + 其档案,**主程序零代码改动**
>
> 任一项若需要新增表、改后端 owner 代码或改页面结构 ⇒ **该抽象未达标**。

⛔ 本期**不建**条件 DSL、配置化谓词表、规则引擎、DB 表或后台维护页来承载判断规则。

### 11.2 其他约束

- **凭证两层**:静态 ISV 身份走部署配置**不进 DB**;动态 token 在适配器独立 schema 加密列;
  主程序只持 opaque ref 与治理信号
- **授权失效不自动改渠道状态**,以治理信号呈现
- **backend-acceptance 总数硬上限 80 条**(当前 44),验收转场景须核余量
- **编号只属文档**:`BR-*` / `OP-*` / `UC-*` / `S-*` **不得进入 runtime 或测试的目录、包、文件、类名**
- **跨层变更闭合**:改 operation 范围/selector/字段/生成 wire 前,先建「声明—传递—消费」矩阵

---

## 12 · 裁定、未决与边界

### 12.1 Dexter 裁定(逐字可在记录 001～012 检索)

| # | 事项 | 裁定 |
|---|---|---|
| E-01 | 平台分类 → **能力分类**,七类、非互斥、平台一对多 | 采纳 |
| E-02 | 三层结构**通用化**,不再仅服务渠道 | 采纳 |
| E-03 | 定义预制不分空间;绑定运行时按空间隔离 | 采纳 |
| E-04 | 档案约定业务范围、可绑节点类型、认证类型 | 采纳 |
| E-05 | 绑定业务覆盖面 ⊆ 档案业务范围 | 采纳 |
| E-06 | 可绑节点类型**不用于权限与数据校验** | 采纳 |
| E-07 | 订单同步与外卖/团购是**独立能力**,方向相反 | 采纳 |
| E-08 | 分发沿组织树;订单商品带完整节点路径 | 采纳但**本期不做** |
| E-09 | 模板**项目自建**,四维级联;新增「自助机」 | 采纳 |
| E-10 | 渠道**不做唯一性校验**,同模板可多实例 | 采纳 |
| E-11 | **严禁过度设计**(逐字);⚠️ 「本期不建模」是作者归纳,**C-08 待确认** | 部分采纳 |
| E-12 | 命名 `external_system` / `provider_profile` / `owner_binding` | 采纳 |
| E-13 | 定义走 **checked-in 契约**,仅启用状态与绑定进库 | 采纳 |
| E-14 | 「用户与权益」本期**仅占位** | 采纳 |
| E-15 | 停用 ⇒ 相关对象**置灰,不能删** | 裁定 |
| E-16 | 契约完整详实,更新后**前后台不改码、前台自动识别** | 裁定 |
| E-17 | 运营写能力**只设两个**;有菜单权限即可读 | 裁定 |
| E-18 | **除经营渠道外,一切由运维管理员统一维护** | 裁定 |
| E-19 | 模板与渠道**只能停用不能删** | 裁定 |
| E-20 | 删绑定 ⇒ **渠道自动落回草稿** | 裁定 |
| E-21 | 停用模板/外部系统 ⇒ **现在就把渠道关掉** | 裁定 |
| E-22 | 渠道**能改绑**到另一条绑定 | 裁定 |
| E-23 | 删除**只是标记删除** | 裁定 |
| E-24 | 解绑方式**在档案中配置**:自己删 / 走适配器 | 裁定 |
| E-25 | binding 是**三元组不是数组**;三个外部店铺 ⇒ 三条渠道,**因为菜单不同** | 裁定 |
| E-26 | **两类外部平台分野**:只有外卖/团购/配送需运营自己授权;其余运维手工配置且一条绑定覆盖全部能力 | 裁定 |
| E-27 | 模块**按域拆,不按后台拆** | 裁定 |
| E-28 | 本期**只关心规则本身的管理**,不关心规则在 runtime 如何被使用 | 裁定 |
| E-29 | `enablement_state` 无行时**缺省为停用** | 裁定 |
| E-30 | R-4 继承:已停用门店**不阻断**建绑定/渠道 | 裁定(2026-08-19 再确认) |
| E-31 | 置灰对象**不能编辑** | 裁定(记录 012) |
| E-32 | 无物理删除的适用范围 = **本需求范围内** | 裁定(记录 012) |
| E-33 | **只要有 contract 就算可启用**;`PLANNED` 不构成门槛 | 裁定(记录 012)。**推翻**作者原推导 |

### 12.2 作废清单(不得再引用)

| 旧结论 | 原因 |
|---|---|
| 外部平台六类分类学 | 被能力分类七类取代 |
| `BusinessChannelTemplate` 预置七条目录 | 模板改为项目自建四维 |
| **R-1** 同项目同模板至多一条渠道 | 被 E-10 推翻 |
| `channelKind` 承载 `menuCollaborationOptions` | 改由能力属性 `menuCollaborationDirection` 推导 |
| 协作三层专属于经营渠道 | 被 E-02 取代 |

### 12.3 作者推导(**待 Dexter 确认**)

⚠️ **每一条在正文的使用点都已就地标注** —— 实施者在读到该规则时即可看见保留意见,
不必翻到本节。⛔ 未确认前,详设**不得**把这些内容当作已定需求落到契约或数据库约束。

**C-05 / C-06 / C-07 已于 2026-08-19 裁定**(记录 012),移出本表;其中 **C-07 被推翻** —— 原推导「`PLANNED` 不可启用」错误,现为「只要有 contract 就算可启用」。
**C-10 已撤回**:经查记录 009 原文「U-05,现在就把这些渠道关掉。…U-07,需要级联停用渠道吧」,
模板停用与外部系统停用**两个触发都是 Dexter 逐字裁定**,不是作者细化。

| # | 内容 | 理由 |
|---|---|---|
| **C-01** | 恢复时**重新求值** `stopReasons`,仍非空则保持停用 | Dexter 只裁了级联停用未裁恢复;否则会打开运营手动停掉的渠道 |
| **C-02** | `nodeRef` 统一为 `(nodeType, nodeRef)` 二元,UUID + 判别式 | 五类节点无共同 owner |
| **C-03** | `channelCode` **集团空间内唯一** | 已按本规格与 implementation-facing 详设收口并落 owner 判重及数据库并发兜底 |
| **C-04** | 两段式解绑的**分支③(失败/被拒)与「解绑中」状态** | 原协议只有两个分支,分支①永远拿不到 `externalRevokedAt` |
| **C-08** | E-11 的措辞「判断规则本期**不建模**」 | Dexter 原话是「千万不要过度设计」+「具体要定哪些属性、如何判断,我暂时还没想好」;「不建模」是作者归纳 |
| **C-09** | §11.1 的**精确成本判据**(两处/一处/零改动) | Dexter 原话是「成本要低,不能变化一个地方很多代码都要动」;把它量化成可证伪判据是作者构造 |

### 12.4 未决

| # | 问题 | 归属 |
|---|---|---|
| **U-01** | `capabilityClass` 对**非渠道绑定**是否确实不填(一条覆盖全部)—— 已由 E-26 回答,此处仅记录其推论边界 | 已闭 |
| **U-02** | 外部平台商家**单方面解除授权**的语义(适配器通知后应是绑定失效而非删除) | 待适配器批次 |

### 12.5 授权边界

本文是**需求规格收口记录**，作为本批详设与实施的业务输入；不单独授予 runtime、reset、seed、L2 或 UAT 动作，相关边界仍以 Roadmap 授权字段和 Dexter 会话指派为准。
