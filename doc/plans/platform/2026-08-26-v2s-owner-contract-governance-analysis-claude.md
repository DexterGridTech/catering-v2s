# Owner 接口治理 · 分析与初步结论

- 作者:Claude(外部独立评审角色)
- 状态:**分析稿,未裁定**。Dexter 已提出方向,本文负责把方向落成可证伪的规范草案
- 触发:商品库 UI 每改一点,契约、前后台、测试、seed 全线跟改,单批耗时以天计
- 范围:全部已存在模块的 owner 接口,不限 catalog

## 0. 裁定清单(交付前先读这一节)

本文既含分析,也含 Dexter 在 2026-08-26 会话中逐条给出的裁定。为避免把"分析建议"误当"已裁定",三类分开列。

### 0-A · Dexter 已明确裁定(可直接执行)

| # | 裁定 | 详见 |
| --- | --- | --- |
| 1 | 六个定义库的下线语义**一律统一走 `transitionStatus`**;四种语义并存不是设计意图,是各批实施 agent 各自发挥的结果 | §6.3 |
| 2 | **物理删除完全取消** | §6.3.1 |
| 3 | 生命周期**只有三态:启用 / 停用 / 标记删除**,没有第四种 | §6.5.1 |
| 4 | 三态语义:启用⇄停用双向手动;删除后列表不可见但**编码可复用**;停用或删除后在关联选择框中不可见不可选;**已有关联继续有效、详情继续显示,但编辑时不能再被选到** | §6.5.1 L-2、L-3、L-4 |
| 5 | 上述适用**所有域**,不限商品域 | §6.5.6 |
| 6 | **去掉 `DRAFT`**(新建落停用) | §6.5.5 |
| 7 | **去掉 `ARCHIVED`**(并入已删除) | §6.5.5 |
| 8 | 存储值**保留 `ENABLED/DISABLED/VOIDED` 不改名**;用户可见词为「启用 / 停用 / 删除」 | §6.5.1 |
| 9 | **停用可以改**——统一为「启用可编辑、停用可编辑、已删除不可编辑」 | §6.5.6 |
| 10 | `business_channel` **纳入**三态(`DRAFT`→停用,`EFFECTIVE`→启用,新增已删除) | §6.5.6 |
| 11 | 本文建议不动的**都不动**:`platform_admin`、`group_workspace`、`collaboration.*_enablement`、总公司品牌授权解绑 | §6.5.6、§6.3.4 |

### 0-B · Dexter 提出方向、本文判定合理,尚未逐条裁定

读侧接口规范 R-1 至 R-5(§3):owner 暴露业务模型而非视图模型、**后台零拼装**、读接口按实体收敛、默认返回完整模型、适用全部已存在模块。配套边界见 §4(读写不对称、能算/不能算判据、深度参数准入)与 §6.2.3(授权维度留在接口、展示维度进数据)。

### 0-C · 仍待裁定

1. 总公司品牌授权的解绑是否也改状态迁移(§6.3.4)——本轮已按 0-A 第 11 条**不动**,但该事实有审计意义,可后续再议
2. 推进节奏(§7.2)

### 0-D · 本文已撤回的结论

初稿 §6.2「合并 61 个作用域接口、净减 48」**已撤回**,原因与方法教训见 §9。**不要执行初稿那条。**

## 1. 问题陈述(Dexter 原始表述)

读接口返回什么,完全取决于前端要显示什么,没有任何冗余;详情同理。因此前端一变,契约到前后台到测试到 seed 全要改,代价极高。期望是:列表也好详情也好,查询接口结构化返回与该实体相关的**全部关联结构实体**;怎么展示——显示名称还是编码——是前端的事,后台不负责拼装。同时接口数量过多,很多接口只服务某一块 UI;期望每个 owner 只保留有限几个接口,靠返回冗余服务不同前端板块,或以参数控制返回深度。

## 2. 分析过程与实测证据

以下全部为本仓当前源码实测,非文档转述。

### 2.1 同一个读模型里并存四种形态

`CatalogItemPage/data`(商品列表)的字段面实测:

- **完整实体**:`salesUnit`、`baseMeasureUnit`——带 `unitRef / code / name / unitDimension / precision`
- **结构化对象**:`inventoryDeductionSummary`——带 `grain / mode / consumptionUnitSnapshot / bomLineCount`
- **ref + 预渲染标签**:`categoryRef`(UUID)配 `categoryPathLabels`(字符串数组);`tagRefs` 配 `tagSummary`
- **纯展示字符串数组**:`specificationOrOptionSummary`、`attributeSummary`、`preparationSummary`

同一个返回体内四种形态并存,说明背后没有统一原则,每个字段都是当年某一屏需要什么就给什么。分类尤其典型:给了一个前端用不了的 UUID,加一串只能原样打印的标签;前端若想显示分类编码,该字段根本不在契约里。

### 2.2 owner 在生产用户可见文案

`CatalogOwnerService.java` 实测 6 处中文拼装:

- 第 8794 行 `specificationOrOptionSummary.add("规格维度：" + dimension)`
- 第 8820 行 `preparationSummary.add("各规格制作内容不同")`
- 第 8852 行 `lines.add("生产标签：" + productionTagName)`
- 第 8856 行 `lines.add("制作单显示名称：" + displayName)`
- 第 8859 行 `lines.add("预计制作时长：" + … + " 秒")`
- 第 8862 行 `lines.add("制作说明：" + notes)`

冒号、词序、单位后缀、乃至「各规格制作内容不同」这句话本身,当前都是后台的资产。

### 2.3 结构化事实在拼装前已经在手

这是判断成本的关键证据,决定了"改成结构化返回"是省是费:

- `preparationSummaryLines(String productionTagName, JsonNode preparationProfile)` 的入参**本身就是结构化对象**,内含 `productionDisplayName`、`estimatedPreparationSeconds`、`preparationNotes` 三个规整字段,外加已解析的标签名。方法体花十余行把它拆成中文句子。
- 第 8786 行 `categorySummaryFacts.pathLabelsByItem()`:要能按商品给出分类路径,分类祖先结构必然已全量查出,只保留了标签。
- 第 8794 行 `skuFacts.dimensions()`:规格维度实体已在手,被压成 `"规格维度：" + dimension`。

**结论:数据早已查回,当前是查完再丢弃。** 改为结构化返回不增加数据库往返、不增加查询,只增加序列化体积,并且**净删代码**——上述 6 处拼装与 `preparationSummaryLines` 整个方法可以消失。

### 2.4 一个展示字段的变更爆炸半径(实测落点数)

| 字段 | 契约生成器 | owner 主源码 | seed 执行器 | 契约产物 | 前端 |
| --- | --- | --- | --- | --- | --- |
| `categoryPathLabels` | 10 | 11 | 11 | 4 个文件 | 20 |
| `preparationSummary` | 10 | 7 | 17 | 4 个文件 | 12 |
| `specificationOrOptionSummary` | 2 | 3 | 7 | 3 个文件 | 5 |

一个**纯展示决定**牵动约 55 个落点、横跨五层。这就是"改四天还没改好"的直接成因。

### 2.5 接口普查

全仓 **239 个 operation = 102 个读 + 137 个写**。

读接口按模块:catalog-inventory 22、user-management 20、organization 16、business-channel 6、contracts 5、invitations 4、audit 2,其余零星。

catalog-inventory 的 22 个读接口中可直接观察到的三类冗余:

1. **同一实体多视图切片**:`getOperationsInventoryTarget`、`Targets`、`BusinessHistory`、`ChangeSummary`、`ConsumptionReferences`、`Diagnostics`、`Ledger`——一个库存目标实体,七个读接口。
2. **"候选"被当成实体**:`CategoryCandidates`、`ConsumptionTargetCandidates`、`BrandCopyCandidates`、`LocalCopyCandidates`——四个接口,每个都是某个已有实体换一种形状再暴露一次,只因服务四个不同选择器。分类候选返回的分类,与导航接口返回的分类是同一批数据的两种形状。
3. **同类定义库各开一个**:六个定义库用了 `getOperationsCatalogDictionary`、`getOperationsProductionTags`、`listOperationsCatalogAttributeDefinitions`、`listOperationsCatalogOrderOptionDefinitions`、`listOperationsCatalogUnits` 五个读接口。

## 3. 初步结论:规范草案(读侧)

**R-1 · owner 暴露业务模型,不暴露视图模型。** 返回内容由实体自身的业务结构决定,不由任何调用方要显示什么决定。为某一块 UI 新增读接口或新增字段,默认视为设计错误。

**R-2 · 后台零拼装。** 后台不产出展示文案:不拼冒号、不加单位后缀、不决定行数、不做"摘要"。名称还是编码、排版、截断、空值怎么说,全部归前端。

**R-3 · 读接口按实体收敛。** 每个 owner 只保留少数几个读接口,靠返回冗余同时服务多个前端板块。"候选"不是实体,是带筛选参数的实体列表,不得单独开接口。

**R-4 · 默认返回完整模型。** 深度参数是最后手段,不是首选,准入条件见 4.3。

**R-5 · 适用于全部已存在模块**,以模块为单位推进,不做大爆炸式一次性替换。

## 4. 三条必须写进规范的边界

不写清楚,这条规范会以三种方式走样。

### 4.1 读写不对称:137 个写接口不在裁剪范围

"接口太多"成立,但 239 里 137 是写。**写接口不能按 R-3 合并。** 每个命令承载自己的授权、幂等键、审计凭据、锁与 typed 拒绝码;合并成通用"保存模型"会把本项目投入最大的那部分 owner 保证整体拆除。本规范的分母是那 **102 个读**。写侧有它自己的病,治理方式不同,见第 6 节。

### 4.2 零拼装的判据:能算 / 不能算

契约里存在 `deletionAvailability`、`voidAvailability`、`selectable`、`disabledReason`、`isReferenced` 这类字段。它们形似"后台替前端做判断",但性质与 `preparationSummary` 完全不同。判据:

> **前端拿到完整模型后自己能算出来的,后台不许算;必须依赖模型之外的数据才能算的,后台必须算,并以结构化事实返回(枚举码 + 结构,不是句子)。**

该判据可证伪,逐例:

- `preparationSummary` 的每个组成部分都在 `preparationProfile` 内 → 前端能算 → 拼装,删除
- `各规格制作内容不同` → 规格的 profile 都在返回里就能比出来 → 拼装,删除;若 UI 后续要"5 个规格里 3 个不同",前端零后台改动即可实现
- `deletionAvailability` → 依赖全局引用计数,模型外数据 → 后台必须算,但形状应为 `{blocked: true, reason: "REFERENCED_BY_ITEM", count: 3}`,不是「该分类下还有 3 个商品,无法删除」
- `selectable` / `disabledReason` → 同上,返回枚举原因码而非句子

### 4.3 深度参数的准入条件

一旦出现 `?expand=` 或 `?depth=`,下一步必然是"列表页用 depth=2、选择器用 depth=1",按屏裁剪原封不动搬进 query,只是换了位置。准入条件:

- **无参调用必须返回全部非无界事实。** 参数只能"减",不能"揭示"默认拿不到的东西。
- **只有无界关联允许用参数控制**:流水、日志、可无限递归展开的关系(如 BOM 组件商品的自身 BOM)。
- **递归终止在模型里声明一次**,对所有消费方一致,不随调用方变化。
- **集合分页不算裁剪**:规格子集合走自己的分页(Dexter 本批已裁定),这是集合语义,不是字段裁剪。

## 5. 收敛目标与口径变更

### 5.1 catalog 读接口收敛估算:22 → 8–10

商品列表、商品详情、规格子集合(懒加载分页)、定义库统一读(六库合一,kind 作参数)、分类树、库存目标读、库存流水(真无界集合,独立分页)、模型元数据 manifest。四个候选接口全部消失;库存七个读中五个是视图切片,并入目标读,仅 ledger 保留。

### 5.2 与既有性能门的口径变更

现行预算门按 operation 定 FIXED 上限。读接口合并后,单接口 DB 操作数必然上升,而**每屏接口调用次数下降**——一屏原本打三四个接口,合并后打一个,同一批关联数据不再被各查一遍。因此:

> 预算口径需从「每接口 DB 操作数」改为「**每屏 DB 操作数**」,合并时按新口径重新标定。

这一变更方向对性能有利,但必须与合并同批完成,否则合并会被现行门错误拦截。

## 6. 写接口治理(写侧分析)

### 6.1 写侧的病与读侧不同

读侧的病是**返回什么由前端展示决定**——一种裁剪。写侧不是裁剪,是另外两种:**接口数量由"业务动作 × 组织维度"的笛卡尔积决定**,以及**同一动作在不同实体上语义不统一**。因此治理手段也不同,不能把读侧的 R-1/R-3 直接套到写侧。

需要先立一条否定句,防止规范被误用:

> **W-0 · 写接口不得为了减少数量而合并成通用"保存模型"命令。** 每个命令承载自己的授权、幂等键、审计凭据、锁与 typed 拒绝码,这是本项目投入最大的一部分 owner 保证。写侧的收敛只允许沿"同一动作的维度参数化"方向进行,不允许沿"不同动作合并"方向进行。

### 6.2 W-1 已撤回:ORG / IAM 的"接口多"是承重结构,不是浪费

**本节初稿提出把 61 个"作用域被复制"的接口合并为 13 个(净减 48)。读过业务语料库与 IA 裁决文档后,该结论撤回。它是错的,并且照做会破坏一条已治理的安全不变量。**

#### 6.2.1 IAM 五层级:那不是笛卡尔积,那就是授权机制

`contracts/registry/iam-org-governance-manifest.json` 中,**恰好 21 个 operation** 携带如下三项声明:

- `"noClientDerivedAuthorization": true`
- `"serverDerivedTarget": "STATIC_OPERATION_CAPABILITY"`
- `"targetOrganizationType": "GROUP" | "REGION" | "PROJECT" | "HEAD_COMPANY" | "STORE"`

这 21 个是:邀请的 `create / cancel / reissue`、`revokeUserAssignment`,各被五个节点类型固化一次(20 个),外加 `updateOperationsCommercialGroup`。**初稿提议合并的正是这 20 个。**

`doc/decisions/2026-07-29-v2s-rm1-ia-05-...` 第 13 行与第 32 行给出业务侧同一裁决:

> 运营管理后台的用户管理**不是一个泛化页面**:集团、大区、项目、总公司和门店对应不同的任职对象及可用角色。
>
> 五类用户页的目标来自**已批准的 operation/capability 绑定**,而非页面名称、当前任职类型或**用户提交的机构**。

因此:把五个接口合并成一个带 `targetType` 请求字段的接口,等于让**目标由客户端提交决定**——这正是 `noClientDerivedAuthorization: true` 与 IA-05 第 32 行同时明文禁止的。当前架构里能力按 operationId 绑定,所以"每个 (动作, 目标) 一个 operation"**就是**"目标由服务端静态能力推导"的实现形式。接口数量在这里是授权边界的投影,减少它等于把声明式的安全边界换成 handler 内的命令式判断。

初稿把 `CreateOperationsWorkspaceInvitationOperation` 的注释「Thin edge adapter **shared by the five**」读作浪费的证据,读反了。它恰恰是正确设计的证据:**实现已经去重(一个类),而授权入口保持分立(五个能力)**。该去重的已经去重,剩下的分立是必需的。

语料库 G-07 与之一致:「新增任职只走邀请…不存在直接编辑任职:角色或服务节点替换等于撤销旧任职 + 发起新邀请」「归属节点类型创建后不可改」。owner 侧实测也已按此交叉校验——`WorkspaceInvitationService` 第 585 / 685 行 `requireExpectedTargetType(expectedTargetType, target.serviceNodeType())`,第 160 / 1014 行从角色 intent 反推目标类型并要求全体一致。路由钉住的类型与角色定义携带的类型互为校验,不是冗余真相。

同理,五类用户页对应的读接口(`getOperationsWorkspace«S»Invitations` 等)也受 IA-05 第 32 行约束,同样不合并。

#### 6.2.2 ORG 四实体:语料库明确禁止合并,且代码已经做对

初稿把 `createOperationsOrganization«S» × 6` 识别为一个家族,是**按名字前缀匹配造成的测量假象**。打开真实路径后是两组:

- `/hierarchy/regions` 与 `/hierarchy/regions/{regionId}/projects` —— 大区与项目,即 G-02 定义的组织树「商业集团 → 大区 → 项目」
- `/organization/brands`、`/head-companies`、`/stores`、`/tenants` —— 四个**非组织树实体**

语料库对这四者有明确边界:

- **G-02**:组织树只指「商业集团 → 大区 → 项目」;**门店和总公司不属于组织树**
- **G-04**:实际经营租户是承载统一社会信用代码与注册地的**法律主体**,不是店铺运营方、总公司、品牌或 SaaS 隔离租户
- **G-06**:品牌是商业集团内唯一的餐饮品牌名册条目,**不是总公司、实际经营租户、门店或商业集团展示品牌**

四者是语料库逐条区分过的四类实体,合并成多态"组织节点"会直接违反 G-02 / G-04 / G-06。

而真正该统一的部分**代码已经统一了**:组织树节点的更新与状态迁移用的是 `updateOperationsOrganizationNode` 与 `transitionOperationsOrganizationNodeStatus` 两个统一接口,只有 create 因父级不同而分开(大区在空间下,项目在大区下)。

**结论:ORG 域没有需要合并的接口。**

#### 6.2.3 由此得到的统一判据(本文最有价值的一条)

读侧与写侧看似矛盾——一边说"接口不该按维度复制",一边说"这些复制必须保留"。二者由同一条判据统一:

> **一个维度该不该出现在接口身份里,取决于它决定什么。决定授权的维度必须留在 operation 身份里;只决定展示的维度必须离开接口身份、进入数据。**

逐例:

- catalog 的分类路径标签只决定怎么显示 → 必须离开接口进入数据 → 读侧 R-1 / R-2 成立
- IAM 的五个节点类型决定谁能执行 → 必须留在 operation 身份里 → 20 个接口保留
- ORG 的四类实体是不同实体而非同一实体的不同视图 → 保留
- 库存目标的七个读接口只决定看哪一块 → 应合并

这条判据可证伪:对任一接口问"去掉这个维度后,授权判定会不会变得依赖请求体?"答"会"则必须保留,答"不会"则应当合并。

### 6.3 W-2 · 同一动作,四种下线语义 —— **Dexter 已裁定统一走 `transitionStatus`**

catalog 六个定义库的"下线/删除"实测:

| 定义库 | 写接口数 | 下线方式 |
| --- | --- | --- |
| 计量单位 | 4 | `delete` **与** `disable` 并存 |
| 生产标签 | 3 | `transitionStatus` |
| 字典条目 | 4 | `transitionStatus`(另有 `reorder`) |
| 商品属性定义 | 3 | `delete` |
| 点单选项定义 | 3 | `delete` |
| 商品分类 | 4 | `delete`(另有 `move`) |

**四种语义并存。** 而 organization 的四个实体、business-channel 的两个实体**都统一使用 `transitionStatus`**——说明统一是做得到的,catalog 是离群点。

危害不在接口数量,在认知与前端成本:维护者要学四套模型,前端要为同一类操作写四套确认流与四套错误处置,而用户在六个库之间切换时看到的是四种不同的行为。这与本仓刚确立的「管理后台交互一致性七族」直接冲突。

**Dexter 2026-08-26 裁定**:四种语义并存**不是设计意图**,是各批实施 agent 各自发挥的结果。**六个定义库一律统一走 `transitionStatus`。**

裁定的执行含义:`disableOperationsCatalogUnit` 与四个 `delete*` 接口退役,统一为各库的 `transitionStatus`(启用 / 停用 / 作废)。`move` 与 `reorder` 是真结构动作,不在此列,保留。

**Dexter 2026-08-26 追加裁定:物理删除完全取消。**

#### 6.3.1 裁定适用面与不适用面

适用:**业务实体的物理删除**。不适用:**为表达"集合被编辑"而删行的 SQL**。

这条边界必须写清楚,否则会误伤承重代码。owner 主源码共 40 条 `DELETE FROM`,绝大多数属于后者——`catalog_item_reference`(生产标签 0→1、1→0、1→另一个的唯一写入点)、`catalog_item_attribute_selection`、`catalog_item_order_option_config`、`catalog_composite_component` 等,都是"整组删掉重插"来表达一次编辑,与实体生命周期无关。**这些不在裁定范围内,不得改动。**

真正属于实体物理删除的是四处,全部退役:

| 现状 | 实测行为 | 裁定后 |
| --- | --- | --- |
| `deleteOperationsCatalogAttributeDefinition` | `CatalogDefinitionFacts.java` 第 157–166 行级联物理删:先删 `catalog_item_attribute_selection`、再删 **`catalog_item_attribute_assignment`(商品身上的属性赋值)**、再删选项、最后删定义 | 退役,改 `transitionStatus` |
| `deleteOperationsCatalogCategory` | `CatalogOwnerService.java` 第 6362 行 `DELETE FROM catalog.catalog_category WHERE category_ref IN (…)`,**整棵子树** | 退役,改 `transitionStatus` |
| `deleteOperationsCatalogOrderOptionDefinition` | 同类级联物理删 | 退役,改 `transitionStatus` |
| `deleteOperationsCatalogUnit` + `disableOperationsCatalogUnit` | `CatalogUnitDefinitionFacts.java` 第 147 行是 `SET status='DISABLED'`,第 168 行是 `DELETE FROM catalog.unit_definition` —— 两条路并存 | 两个接口都退役,合并为 `transitionStatus` |

**顺带消除两条静默数据损失路径**:删一个属性定义会连带抹掉所有商品身上该属性的赋值;删一个分类会抹掉整棵子树。裁定之后这两条不复存在。

#### 6.3.2 可用性事实收敛

`deletionAvailability` 随之退役(实测 owner 5 处、前端 16 处、契约产物 4 个文件),`voidAvailability` 成为唯一可用性事实(实测 owner 21 处、前端 43 处、契约产物 7 个文件)。退的是少数那个,方向与既有代码重量一致。

#### 6.3.3 落地时会立刻撞上的一道墙:作废后编码能否重用

物理删除时,行消失,`code` 自动释放。改为只作废后,VOIDED 行会永久占住 `code`,用户建错一个单位再作废,就再也不能用同一个编码重建。

实测约束现状:

- 已走 `transitionStatus` 的两个库**已经解决**——`V20260816_030000_000__catalog_dictionary_tag_voided_code_release.sql` 建了 `ux_catalog_dictionary_active_code` 与 `ux_production_tag_active_code` 两个 partial unique index
- 待改的四个库仍是表级普通唯一约束,例如 `uq_catalog_order_option_definition_scope_code UNIQUE (data_node_ref, brand_ref, code)`

**因此裁定落地必须同批把这四个库的 `scope + code` 唯一约束改成 partial(排除 VOIDED),照搬 `V20260816_030000_000` 已验证的形态。** 漏掉这一步,用户会在"编码已存在"上撞墙,而且撞的是一个看不见的作废行。

#### 6.3.4 两个关系解绑接口:本文判断不在裁定范围,待确认

全仓 DELETE 动词共 7 个,上表覆盖 4 个。另外三个是**关系解绑**而非实体删除:

- `deleteOperationsOwnerBinding` / `deletePlatformOwnerBinding` —— 渠道的 owner 绑定
- `removeOperationsOrganizationHeadCompanyBrandAuthorization` —— 总公司品牌授权(`BusinessEntityService.java` 第 1810 行物理删关系行)

本文判断:关系的 1→0 是编辑,不是实体删除,与生产标签解绑同类,**不在本裁定范围**。

但 `head_company_brand_authorization` 值得单独请 Dexter 看一眼:G-06 规定该授权表示"总公司可维护该品牌侧资料",而 G-08 的原则是"历史资料、合同、订单、审计一律保留"。**谁在什么时间可以维护某品牌资料,是有审计意义的事实**;物理删掉这行就查不到了。若 Dexter 认为该保留,则它也改状态迁移;若认为不必,维持现状。本文不替这一条做判断。

### 6.4 W-3 · 定义库 CRUD 不是全都能合(与直觉相反)

六库 21 个写接口看起来同构,但实测**只有部分可合**:`createDictionaryEntry` 已经以 `dictionaryKind` 参数化,覆盖字典型库;而计量单位(precision / unitDimension)、商品属性定义(valueType / options)、点单选项定义(selectionMode / values / materials)、商品分类(层级)各有真实不同的字段与业务规则,硬合会把差异塞进一个松散的 payload 里,反而制造新的裁剪。

**结论:此处的治理目标是 W-2 的语义统一,不是接口合并。** 把"看起来像"当成"可以合",是这轮治理最容易犯的错。

### 6.5 W-4 · 单条与批量并存:保留,但需准入条件

`transitionOperationsCatalogItemStatus` 与 `batchTransitionOperationsCatalogItemStatus` 是两个接口、两个 owner 方法(第 651 行与第 691 行)。二者**失败语义不同**:单条给 typed 拒绝,批量按 Dexter 已裁定的「逐项尽力 + 逐项报告」返回逐项结果,并以 `PROPAGATION_REQUIRES_NEW` 保证一项失败不回滚全部。这是真实业务差异,不是重复,应保留。

但需要一条准入规范,否则批量版本会随机出现:**只有当业务确实允许部分成功、且用户需要逐项结果时才提供批量接口;否则前端循环调用单条即可。**

### 6.6 W-5 · preflight / execute:保留,需规范化

复制与临时商品转正各有 preflight/execute 成对,共 6 个接口,并以 `preflightDigest` 加 `STALE_COPY_PREFLIGHT` 防陈旧。这是合法的两阶段提交。准入条件应写明:**仅当用户必须先看到闭包或影响面才能决定是否执行时,才允许两阶段;否则单命令。**

### 6.7 写侧不存在读侧那种拼装问题

`saveOperationsCatalogItem` 是对整个商品模型的一次 PATCH,owner 合并未变更的区段事实。写侧的入参形状是模型形状,不是屏幕形状。**读侧的病没有在写侧重演,这一点不需要治理。**

## 6.5 全平台主数据生命周期统一(Dexter 2026-08-26 裁定,适用所有域)

裁定原文:不做物理删除;启用可以手动停用,停用也可以手动启用;删除后列表不可见,但**编码可被复用**;停用或删除后,在关联选择框中不可见、不能被选择;已删除的若有商品关联没关系,继续关联、详情继续显示,但**编辑时不能再被选到**。适用范围为**所有域**,不限商品域。

### 6.5.1 规范化表述

**L-1 · 只有三态,没有第四种。**(Dexter 2026-08-26 裁定原文:「只有启用、停用、标记删除」)

| 用户可见 | 存储值 | 迁移方向 |
| --- | --- | --- |
| 启用 | `ENABLED` | ⇄ 停用 |
| 停用 | `DISABLED` | ⇄ 启用 |
| 标记删除 | `VOIDED` | 终态,不可逆 |

`DRAFT` 与 `ARCHIVED` **一并去掉**(Dexter 同日追加裁定),执行面见 §6.5.5。

存储值建议保留 `VOIDED` 不改名:它已在 owner 代码 105 处、3 张表与 `VOIDED_RECORD_IMMUTABLE` 语义中固化,而"标记删除"是用户可见叫法,不是枚举字面量。用户可见文案统一为「删除」(动作)与「已删除」(状态)。若 Dexter 要求枚举字面量也与业务词一致,再统一改名。

**L-2 · 三态的可见性与可选性:**

| 状态 | 定义库列表 | 关联选择框 | 编码占用 |
| --- | --- | --- | --- |
| `ENABLED` | 可见 | 可见、可选 | 占用 |
| `DISABLED` | **可见**(否则无法手动启用回来) | 不可见、不可选 | 占用 |
| `VOIDED` | 不可见 | 不可见、不可选 | **释放,可复用** |

**L-3 · 既有关联不受状态影响。** 已 `DISABLED` 或 `VOIDED` 的定义,其既有关联继续有效,商品详情继续正常显示该定义的名称。

**L-4 · 校验只针对本次变更的引用。** 保存时,只对**本次新增或改变**的引用做"必须 ENABLED"校验;**未变更的既有引用一律放行**。

> 这一条不写死会出灾难:否则任何引用了已停用/已删除定义的商品都会变成不可保存,用户连改个名字都做不到。

**L-5 · 流程状态机不在统一范围。** 邀请、OTP、密码恢复、资产暂存、合同有效性等是**流程状态机或衍生状态**,与主数据生命周期是两回事,不得被本裁定波及。合同尤其要注意:G-09 明确"经营中/待开业/未经营"是**存在性衍生状态**,不是 lifecycle。

**L-6 · 编码释放必须靠 partial unique index。** `VOIDED` 行仍在表内,普通唯一约束会永久占住编码。所有主数据表的 `scope + code` 唯一约束必须改为排除 `VOIDED` 的 partial index,照搬 `V20260816_030000_000__catalog_dictionary_tag_voided_code_release.sql` 已验证形态。

**L-7 · `code` 不是稳定业务标识,`ref` 才是。** 编码可复用意味着同一 `code` 在不同时间可指向两个不同实体(一个 `VOIDED` 仍被历史数据引用,一个新建)。引用一律按 `ref`。任何对外传输、导出、跨系统对账都不得以 `code` 作为身份。

**L-8 · 删除前必须告知引用数。** `VOIDED` 是终态且编码释放,误删不可撤销——新建同 `code` 同名的是**另一个实体**,老引用仍指向旧行。因此删除确认必须以结构化事实给出当前引用数(仓内已有 `isReferenced`、`linkedProductCount` 可用),而不是一句"确定删除吗"。

### 6.5.5 `DRAFT` 与 `ARCHIVED` 的去除(执行面实测)

#### `DRAFT` —— 去掉后无事实丢失

实测 owner 内 8 处。真实语义**不是**我先前推测的"来源/完整度",而是**新建商品的初始状态**:

- 第 4489、4515 行:`createCatalogItem` 新建即落 `DRAFT`
- 第 6817、6832、6843、6884 行:临时商品转正后也落 `DRAFT`
- 第 3398 行:导航计数 `COUNT(*) FILTER (WHERE status IN ('DRAFT','DISABLED'))`
- 第 4025 行:`INACTIVE` 智能视图 `AND i.status IN ('DRAFT','DISABLED')`

**两处读它的地方本来就与 `DISABLED` 同等对待**,因此去除是纯简化:新建与转正改落 `DISABLED`,两处 SQL 由 `IN ('DRAFT','DISABLED')` 收敛为 `= 'DISABLED'`,存量 `DRAFT` 行迁移为 `DISABLED`。这也与 `J-CATUI-03`「以最少身份建立商品草稿,再继续完善」一致——建完处于停用、完善后由用户启用。

**不得波及** `business_channel.business_channel` 的 `DRAFT/EFFECTIVE/DISABLED`:那是渠道流程状态,按 L-5 排除在外。

#### `ARCHIVED` —— 行为上本来就等于 `VOIDED`

实测 owner 内 22 处。关键证据是这两行:

- 第 4238 行 `canEdit = !Set.of("ARCHIVED","VOIDED").contains(status)` —— 归档件**不可编辑**
- 第 4239 行 `canEnable = !Set.of("ENABLED","ARCHIVED","VOIDED").contains(status)` —— 归档件**不可重新启用**

即 `ARCHIVED` 与 `VOIDED` 同为终态、同样不可编辑、同样不可恢复,唯一差别是归档件能通过 `ARCHIVED` 智能视图看见。这正是三态模型要消除的"第四种语义"。

执行面:

- 用户可见的「归档」动作(`CatalogItemViewDrawer` 第 189 行)与「归档」标记(`CatalogItemReadOnlyPresenters` 第 119 行 `· 归档`)并入「删除」
- 规格在编辑商品时被移除会置 `ARCHIVED`(`CatalogSkuFacts` 第 227 行)→ 改置 `VOIDED`;`CatalogSkuFacts` 第 210 行、`CatalogOwnerService` 第 3230、4657 行的 `NOT IN ('ARCHIVED','VOIDED')` 收敛为 `<> 'VOIDED'`
- `ARCHIVED` 智能视图与其计数(第 3399、3419、4026 行)退役
- 存量 `ARCHIVED` 行迁移为 `VOIDED`

#### 契约变更

`CatalogItemBatchStatusTransitionRequest.targetStatus` 由 `"DRAFT" | "ENABLED" | "DISABLED" | "ARCHIVED" | "VOIDED"` 收敛为 `"ENABLED" | "DISABLED" | "VOIDED"`。批量与单条转状态的可选目标同步收窄。

#### 一个必须接受的后果,不得私自加回

`ARCHIVED` 智能视图退役后,**已删除的商品在列表不可见**(L-2)。今天用户可以浏览归档商品,之后不能。这是三态模型的必然结果:想保留可浏览就用**停用**,想删掉就看不见。实施时不得自作主张加"显示已删除"筛选来找补——那等于把第四种状态从后门放回来。

### 6.5.2 现状实测:全平台 5 种形态,另有 2 张表没有 status 列

> **2026-08-26 更正(经两轮独立对抗评审)**:本节初稿写"6 种形态",并把 `organization.store` / `organization.tenant` 列为"有 `status` 列但无 CHECK" —— **这是错的**。`V20260727_020000_000__named_status_and_organization_name_constraints.sql` 已用 `ALTER TABLE … ADD CONSTRAINT ck_store_status / ck_tenant_status` 加了 `CHECK (status IN ('ENABLED','DISABLED'))`,全仓无 DROP。初稿只读内联 `CREATE TABLE` 未跟 ALTER。另:`catalog_sku` 实为**四值** `ENABLED/DISABLED/ARCHIVED/VOIDED` 且 partial index 已就位(`V20260816_020000_000`),非初稿所写三值。执行面以 base-1 需求文档 §4.2 为准。

| 现状形态 | 表 | 与 L-1 的距离 |
| --- | --- | --- |
| `ENABLED/DISABLED/VOIDED` | `catalog.catalog_category`、`catalog.dictionary_entry`、`fulfillment_production.production_tag_definition` | **已符合** |
| `ENABLED/DISABLED` | `catalog.unit_definition`、`organization.brand`、`organization.head_company`、`organization.organization_node`、`business_channel.business_channel_template`、`platform_iam.platform_admin`、`platform_workspace.group_workspace`、`collaboration.*_enablement` 等 | 需加 `VOIDED` |
| `ENABLED/DISABLED/ARCHIVED/VOIDED` | `catalog.catalog_sku`(partial index 已就位) | 按裁定 7 把 `ARCHIVED` 并入 `VOIDED`,是 4→3 合并 |
| `ENABLED/DISABLED/ARCHIVED` | `catalog.catalog_composite_component` | **无 `code` 列,按判据不属主数据**,应移出清单 |
| `DRAFT/ENABLED/DISABLED/ARCHIVED/VOIDED` | `catalog.catalog_item` | 五态,需裁定 |
| `status` 列有值但**无 CHECK 约束** | `organization.store`(实测 `status VARCHAR(16) NOT NULL`,无 CHECK) | 词汇只靠代码约束,需补约束 |
| **没有 `status` 列** | `catalog.catalog_attribute_definition`、`catalog.catalog_order_option_definition` | **需新增列 + 回填 + 约束**,工作量最大的一块 |

排除在外(流程状态机,按 L-5 不动):`contract.store_contract` 的 `ACTIVE/INVALID`、`platform_iam.platform_otp_grant` 的 `ACTIVE/USED/SUPERSEDED`、`platform_iam.platform_password_recovery_flow` 的 `PENDING/VERIFIED/COMPLETED`、邀请的 `PENDING/CONSENTED/COMPLETED/CANCELLED/EXPIRED`、资产的 `STAGED/ACTIVE/RELEASED`、`business_channel.business_channel` 的 `DRAFT/EFFECTIVE/DISABLED`。

### 6.5.6 逐实体判定:哪些状态机适用三态

**判据(可证伪):能不能由人手动在两个状态之间来回切换?**

- 能 → **主数据实体**,状态表达"现在能不能用",适用三态
- 不能(只能单向推进,终态由过程本身而非人决定)→ **过程或关系记录**,状态表达"进行到哪一步",保留自有状态机

#### 适用三态

| 表 | 现状 | 需要做的 |
| --- | --- | --- |
| `catalog.catalog_category` | `ENABLED/DISABLED/VOIDED` | 已符合 |
| `catalog.dictionary_entry` | `ENABLED/DISABLED/VOIDED` | 已符合 |
| `fulfillment_production.production_tag_definition` | `ENABLED/DISABLED/VOIDED` | 已符合 |
| `catalog.catalog_item` | 五态 | 去 `DRAFT`、去 `ARCHIVED`(§6.5.5) |
| `catalog.catalog_sku` | `ENABLED/DISABLED/ARCHIVED` | `ARCHIVED` → `VOIDED` |
| ~~`catalog.catalog_composite_component`~~ | —— | **移出主数据清单**:无 `code` 列,且组件行是"整组删掉重插表达一次编辑",按本节判据不是主数据 |
| `catalog.unit_definition` | `ENABLED/DISABLED` | 加 `VOIDED`;退役物理删 |
| `catalog.catalog_attribute_definition` | **无 status 列** | 新增列 + 回填 + 约束 |
| `catalog.catalog_order_option_definition` | **无 status 列** | 新增列 + 回填 + 约束 |
| `organization.brand` | `ENABLED/DISABLED` | 加 `VOIDED` |
| `organization.head_company` | `ENABLED/DISABLED` | 加 `VOIDED` |
| `organization.organization_node`(大区、项目) | `ENABLED/DISABLED` | 加 `VOIDED` |
| `organization.store` | `ENABLED/DISABLED`(`ck_store_status` 已存在) | 加 `VOIDED` |
| `organization.tenant` | `ENABLED/DISABLED`(`ck_tenant_status` 已存在) | 加 `VOIDED` |
| `business_channel.business_channel` | `DRAFT/EFFECTIVE/DISABLED` | **Dexter 2026-08-26 裁定纳入**,映射见下 |
| `business_channel.business_channel_template` | `ENABLED/DISABLED` | 加 `VOIDED` |

#### 不适用三态(保留自有状态机)

| 表 | 现状 | 为什么不适用 |
| --- | --- | --- |
| `workspace_iam.role_assignment`(任职) | `ACTIVE/REVOKED` | **G-07 明定**:「不存在直接编辑任职」,撤销即终态,重新授予必须走新邀请。人无法把 `REVOKED` 切回 `ACTIVE` |
| `workspace_iam.workspace_session` | `ACTIVE/REVOKED` | 会话,单向 |
| `contract.store_contract` | `ACTIVE/INVALID` | **G-09 明定**「经营中/待开业/未经营」是存在性衍生状态,不是 lifecycle |
| `platform_iam.platform_otp_grant` | `ACTIVE/USED/SUPERSEDED` | 令牌,由使用推进 |
| `platform_iam.platform_password_recovery_flow` | `PENDING/VERIFIED/COMPLETED` | 流程 |
| 邀请 | `PENDING/CONSENTED/COMPLETED/CANCELLED/EXPIRED` | **G-07**:受邀人接受后生效,不由管理员切换 |
| 资产 | `STAGED/ACTIVE/RELEASED` | 上传流程推进 |

#### `business_channel` 纳入的映射与一个行为变化

实测其迁移**完全由人驱动且可逆**:`transitionChannelStatus` 接受 `DRAFT | EFFECTIVE | DISABLED` 三个自由目标,`transitionTemplateStatus` 只接受 `ENABLED | DISABLED`。因此它是主数据,不是流程状态机——本文初稿把它归入流程状态机是错的,Dexter 的判断正确。

映射:`DRAFT` → `DISABLED`(已建成但未投入使用,与 `catalog_item` 的 `DRAFT` 同理);`EFFECTIVE` → `ENABLED`;`DISABLED` 保持;新增 `VOIDED`。`BINDING_NOT_EFFECTIVE` 的校验相应改判 `ENABLED`。

**一个必须明说的行为变化**:今天 `BusinessChannelOwnerService.requireEditable` 对 `DISABLED` 抛 `DISABLED_OBJECT_NOT_EDITABLE`,即停用的渠道不可编辑;而 catalog 的统一规则是 `canEdit = !Set.of("ARCHIVED","VOIDED").contains(status)`(第 4238 行)——**停用件可编辑,只有已删除件不可编辑**。统一后渠道要改成只挡 `VOIDED`。

**Dexter 2026-08-26 裁定:停用可以改。** 统一规则确定为「启用可编辑、停用可编辑、已删除不可编辑」,全平台一致。

**但这一条不能机械照做——三个调用点里有一个不是编辑校验。** 实测 `requireEditable` 的三处:

| 位置 | 检查的是谁的状态 | 性质 | 裁定后 |
| --- | --- | --- | --- |
| 第 511 行 | 模板自身(更新模板时) | **编辑校验** | 改为只挡 `VOIDED` |
| 第 736 行 | 渠道自身(更新渠道时) | **编辑校验** | 改为只挡 `VOIDED` |
| 第 649 行 | **模板的状态,而当前动作是"用该模板新建渠道"** | **引用校验,不是编辑校验** | **保持挡 `DISABLED`** |

第 649 行必须保持原样,因为它正是 L-2 要求的行为:**停用的模板不得再被选来新建渠道**。若跟着一起改成只挡 `VOIDED`,等于允许用已停用的模板建新渠道,直接违反 L-2。

同时按 L-4,若某渠道是在模板停用**之前**就已基于它创建的,后续编辑该渠道不得因模板已停用而被拒——引用校验只针对本次新建或改变的引用。

#### 本轮明确不动(Dexter 2026-08-26 裁定:建议不动的都不动)

- `platform_iam.platform_admin`、`platform_workspace.group_workspace` —— 形态上是 `ENABLED/DISABLED` 主数据,但"删除一个平台管理员账号 / 删除一个集团空间"是否为允许的业务动作,语料库未覆盖(**G-01 明确集团空间的解绑、替换、重建均为「待裁决」**)。**本轮不加 `VOIDED`,维持两态。**
- `collaboration.external_system_enablement`、`collaboration.provider_profile_enablement` —— 需先判定是独立实体还是关系开关。**本轮不动。**
- `organization` 的品牌授权解绑(§6.3.4)—— **本轮不动,维持物理删关系行。**

三者均为"未裁定即不动",不是"判定为不适用"。将来业务动作被裁定后可再纳入,届时按同一三态规范处理。

### 6.5.3 工作量分级

- **A 类(零改动)**:已是三态的 3 张表,只需确认 partial unique index 已就位。
- **B 类(加一个状态值)**:`ENABLED/DISABLED` 的表,改 CHECK 加 `VOIDED`,补 partial unique index。
- **C 类(需裁定后再动)**:`ARCHIVED`、`DRAFT` 的归属,见 §8。
- **D 类(新增列 + 回填)**:属性定义与点单选项定义两张表。它们现在**完全没有生命周期**——要么存在,要么被物理删掉。这是本裁定隐含的最大一块工作。
- **E 类(补约束)**:有 `status` 列但无 CHECK 的表。

### 6.5.4 这套语义不是新发明,仓内已有可直接推广的样板

L-2 的"选择框不可见"与 L-4 的"既有引用豁免",生产标签已经实现:

- 候选查询 `ProductionTagOwnerService.java` 第 92 行 `AND (? = 'MANAGEMENT' OR status='ENABLED')` —— 库管理视图看得到全部,关联选择框只给 `ENABLED`
- 既有绑定豁免 `CatalogOwnerService.java` 第 4609 行取 `existingProductionTagRefs`,第 7950 行传入校验,停用标签**仅当不是既有绑定时**才拒绝

`CatalogUnitDefinitionFacts.java` 第 44 行、`CatalogOwnerService.java` 第 3349 行也已按 `status='ENABLED'` 过滤候选。**因此这次是把三处已验证的做法推广到全平台,不是从零设计。**

## 7. 治理总账与推进顺序(按 §6.2 撤回后重算)

### 7.1 数量总账

初稿的「239 → 约 170」作废。撤回 W-1 后的真实可收敛面:

| 类别 | 现状 | 可收敛 | 依据 |
| --- | --- | --- | --- |
| 全部 operation | 239 | — | 实测 |
| IAM 静态能力绑定 | 21 | **0** | `noClientDerivedAuthorization` + `STATIC_OPERATION_CAPABILITY`,IA-05 §32 |
| IAM 五类用户页读接口 | 20 | **0** | 同上,IA-05 §32 |
| ORG 四实体 + 组织树节点 | 21 | **0** | G-02 / G-04 / G-06;`Node` 统一已完成 |
| catalog 读 | 22 | → 8–10 | 本文 §2、§5.1 |
| catalog 定义库写 | 21 | 语义统一,数量净减 1–2 | §6.3 Dexter 裁定 |
| 其余模块读 | ~60 | 待体检 | 方法见 §7.2 |

**修正后的判断:这轮治理的主要收益不是接口数量,是读模型形状与写侧语义一致性。** 数量上可见的收敛约在 239 → 225 区间,且几乎全部来自 catalog。把"接口太多"当成主要问题会走错方向——ORG / IAM 那部分的"多"是承重的。

### 7.2 推进顺序

一,**catalog 读模型零拼装 + 读接口收敛**(22 → 8–10)。catalog 正在被改动,趁热做;同时验证 §4.2「能算 / 不能算」判据是否真的可判、§6.2.3 的统一判据是否真的可证伪。

二,**catalog 六库下线语义统一**(§6.3 已裁定)。与一同批,都动 catalog 契约。

三,**其余模块逐个体检**,不逐个重构。体检只回答两个问题:该模块的读接口里有没有预渲染字符串或"某屏专用"字段(§2.1 四形态自检);有没有维度进了接口身份却不决定授权(§6.2.3 判据)。有才动,没有就不动。

四,ORG / IAM **不在治理范围内**,除非语料库或 IA 裁决本身发生变化。

### 7.3 与已有机制的接口

- **预算门口径**:按 §5.2 改为「每屏 DB 操作数」。
- **验收分母**:`backend-acceptance` 当前 80 条场景绑定具体 operationId,catalog 接口合并会改变分母,须与合并同批更新。
- **前端生成类型与 RTK 绑定**:每个模块一次做完,不做跨模块的部分合并。
- **IAM 治理清单**:任何触碰那 21 个 operation 的改动,必须同时更新 `iam-org-governance-manifest.json` 并说明为何不违反 `noClientDerivedAuthorization`。本文建议:**不要触碰。**

## 8. 尚需 Dexter 裁定的事项

初稿列的三项中,两项已由语料库与 IA 裁决回答,不再需要 Dexter 裁定:

- ~~organization 四实体是否多态组织节点~~ → G-02 / G-04 / G-06 已明确区分,**不合并**
- ~~IAM 五层级是否可参数化~~ → IA-05 §32 与治理清单已明确,**不合并**

仍需裁定的:

1. ~~物理删除是否完全取消~~ → **Dexter 2026-08-26 已裁定:完全取消**。执行面与边界见 §6.3.1–§6.3.3。
2. **总公司品牌授权的解绑是否也改状态迁移**(§6.3.4)。本文判断它是关系编辑、不在物理删除裁定范围,但它承载"谁在什么时间可维护该品牌资料"这一有审计意义的事实,请 Dexter 定夺。
3. ~~`ARCHIVED` 与 `VOIDED` 是否同义~~ → **Dexter 已裁定:去掉 `ARCHIVED`**,并入 `VOIDED`。实测证实两者行为本就相同(§6.5.5)。
4. ~~`catalog_item` 的 `DRAFT` 归属~~ → **Dexter 已裁定:去掉 `DRAFT`**,新建落 `DISABLED`。实测证实无事实丢失(§6.5.5)。
5. ~~枚举字面量是否改名~~ → **Dexter 已确认:`ENABLED/DISABLED/VOIDED` 保留不改名。**
6. **渠道停用件是否可编辑**(§6.5.6)。统一后建议改为"停用可编辑、已删除不可编辑",与 catalog 一致;这是相对今天的行为变化。
7. **`platform_admin` 与 `group_workspace` 是否允许删除**(§6.5.6)。G-01 将集团空间的解绑/替换/重建列为待裁决,建议本轮不动。
8. **`collaboration` 两张 enablement 表是实体还是关系开关**(§6.5.6)。
9. **推进节奏**:是按 §7.2 一次做完 catalog 的读收敛与写语义统一,还是先只做读侧零拼装验证规范。

## 9. 本文的自我更正记录

初稿第 6.2 节提出合并 61 个接口(净减 48),该结论**已于同日撤回**。撤回原因:分析只基于代码形状,未读业务语料库与 IA 裁决文档。读后发现所提议合并的 20 个 operation 恰好是被 `noClientDerivedAuthorization: true` 与 `serverDerivedTarget: STATIC_OPERATION_CAPABILITY` 显式治理的那一批,照做会把声明式授权边界改成请求体驱动。

同时更正一处测量假象:初稿把 `createOperationsOrganization«S» × 6` 当成一个家族,是按 operationId 前缀正则匹配的结果;打开真实路径后,其中大区与项目属组织树(走 `/hierarchy`),品牌、总公司、门店、租户是四类独立实体(走 `/organization`),不构成同一家族。

**方法教训**:接口形状的相似性不能作为合并依据。合并与否由该维度**决定什么**决定(§6.2.3),而"决定什么"只能从业务语料库与已批准裁决中读出,不能从代码形状反推。
