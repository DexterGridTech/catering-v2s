> ⚠️ **已作废(2026-08-27)**:本文从 catalog 症状往上砌,出发点错误,已由 `2026-08-27-v2s-base-1-requirements-claude.md` 取代。保留为分析留痕。
# base-1 整体重构 · 需求文档

- 作者:Claude(外部独立评审角色)
- 日期:2026-08-26
- 状态:**需求稿**。第 3 章为 Dexter 已裁定事项,可执行;其余为待批准需求
- 分析出处:`doc/plans/platform/2026-08-26-v2s-owner-contract-governance-analysis-claude.md`
- 本文所有症状均为本仓当前源码实测,非文档转述

## 0. 这份文档要解决什么

一句话:**后台接口按"某一屏要显示什么"来裁剪返回值,导致前端每改一点,契约、前后台、测试、seed 全线跟改;同时全平台的生命周期语义各批各样,共有六种形态。** base-1 把这两件事一次性收口。

不解决的:接口数量(见 §5)。经实测,ORG / IAM 的接口"多"是授权边界的投影,是承重结构。

## 1. 症状(实测)

### 1.1 读接口返回的是视图模型,不是业务模型

商品列表 `CatalogItemPage/data` 的字段面,**同一个返回体内并存四种形态**:

| 形态 | 实例 |
| --- | --- |
| 完整实体 | `salesUnit`、`baseMeasureUnit`(带 `unitRef / code / name / unitDimension / precision`) |
| 结构化对象 | `inventoryDeductionSummary`(带 `grain / mode / consumptionUnitSnapshot / bomLineCount`) |
| ref + 预渲染标签 | `categoryRef`(UUID)配 `categoryPathLabels`(字符串数组);`tagRefs` 配 `tagSummary` |
| 纯展示字符串数组 | `specificationOrOptionSummary`、`attributeSummary`、`preparationSummary` |

分类最典型:给了前端一个用不了的 UUID,加一串只能原样打印的标签。**前端若想显示分类编码,该字段根本不在契约里。**

四种形态并存说明背后没有原则,每个字段都是当年某一屏需要什么就给什么。

### 1.2 后台在生产用户可见文案

> **坐标说明**:本章不写死行号。该文件工作树与 HEAD 有未提交差异,行号会漂;初稿写死的六个行号已因此全部失效。下文一律用**文件 + 符号名**定位,可长期复核。

`CatalogOwnerService.java` 的 `itemSummary(...)` 与 `preparationSummaryLines(...)` 内:`"规格维度：" + dimension`、`"各规格制作内容不同"`、`"生产标签：" + productionTagName`、`"制作单显示名称：" + displayName`、`"预计制作时长：" + … + " 秒"`、`"制作说明：" + notes`。

**初稿声称"共 6 处"是漏计的。** 同类装配至少还有四处,且分布在两个文件:

- `CatalogOwnerService.itemSummary` 内 `values.isEmpty() ? name : name + "：" + String.join("、", values)`(全角冒号 + 顿号连接)
- `CatalogItemDefinitionFacts` 的 `readAttributeSummaryLines` 内 `String.join("、", optionNames)` 与 `assignment.path("name").asText() + "：" + (value.isBlank() ? "未设置" : value)`
- `CatalogOwnerService` 详情读路径的 `.put("relationLabel", "被套餐使用")`
- `appendVoidBlockingReason(reasons, "已设置生产标签", 1, …)` 一族共 9 处,把中文标签写进 `voidAvailability.blockingReasons[].label`

其中 `"未设置"` 不只是排版,是**后台替前端决定了空值话术**。

**这个漏计有直接后果**:最露骨的一处装配(属性行)**根本不在 `CatalogOwnerService` 里**,而在 `CatalogItemDefinitionFacts`。任何按"owner read 路径"划范围的门,今天就漏掉它;把其余几处照样挪进 `*Facts` 类,门全绿而用户看到的字符串一字未改。这是 §4.3 把门改成按文件清单的直接原因。

冒号、词序、单位后缀、空值话术,乃至「各规格制作内容不同」这句话本身,当前都是后台的资产。

### 1.3 成本:三档,不是一档

初稿写「数据早已查回,当前是查完再丢弃…改为结构化返回不增加往返、不增加查询,并且净删代码」。**这个结论只对三分之一的目标字段成立,已按实测分档改写。**

| 档 | 目标字段 | 实测依据 | 真实代价 |
| --- | --- | --- | --- |
| **甲 · 查回后丢弃,净删代码** | `preparation:{…}` | `preparationSummaryLines(String, JsonNode)` 入参即结构化 profile,方法体十余行把它拆成中文 | 删掉拼装即可 |
| | `productionTag:{tagRef, code, name, status}` | `ProductionTagReferenceReadback` 已带 `tagRef/code/name/status/version`,读侧只取 `.name()` 丢掉其余 | 删掉丢弃即可 |
| **乙 · 数据在表里但未 SELECT,需改投影** | `category.path:[{categoryRef, code, name}]` | `categorySummaryFactsForItems` 的递归 CTE 只累 `ARRAY[category.name]::text[]`,祖先 ref 与 code 从未进结果集 | 同一 JOIN 多选两列,**不增加往返**,但是**净增代码** |
| | `tags:[{tagRef, code, name, status}]` | `catalogTagLabelsForItems` 的 SQL 是 `SELECT relation.item_ref, entry.name` | 同上 |
| **丙 · 表里根本没有该列,需加列 + 回填** | `attributes[].value:{optionRef, code, name}` | `catalog.catalog_attribute_definition_option` 的列只有 `attribute_definition_option_ref / attribute_definition_ref / name / display_order`,**无 `code` 列**,全仓无后续 `ADD COLUMN code` | **迁移**,且不在初稿的 A/B/C/D/E 分级里 |
| **待定** | `skuDimensions` 结构化实体 | 列表投影处的源码注释明写「List projection intentionally does not load the separate axis relation … instead of issuing a second page query」 | 改成结构化实体**可能增加一次分页查询**,与"不增加往返"正面冲突,**需实测后再定** |

**修订后的成本结论**:

> **不增加数据库往返**基本成立(在 set-based 查询里多选几列不增加 round-trip,而实测的 663–1074× 放大发生在**每次 round-trip** 上)。但「净删代码」只对甲档两项成立;乙档要改 SQL 投影,丙档要加数据库列与回填;`skuDimensions` 一项与源码里的显式性能设计冲突,必须先实测。

**因此 §4.4 的排期依据也随之修订**:甲档可与零拼装同批;丙档(加列)按 §7 风险 1 单独成子批;`skuDimensions` 先做实测再决定是否纳入本批。

### 1.4 一个纯展示决定的爆炸半径

| 字段 | 契约生成器 | owner | seed 执行器 | 契约产物 | 前端 |
| --- | --- | --- | --- | --- | --- |
| `categoryPathLabels` | 10 | 11 | 11 | 4 个文件 | 20 |
| `preparationSummary` | 10 | 7 | 17 | 4 个文件 | 12 |
| `specificationOrOptionSummary` | 2 | 3 | 7 | 3 个文件 | 5 |

约 55 个落点、横跨五层。这是"改一个展示要好几天"的直接成因。

### 1.5 生命周期语义全平台五种形态

> **初稿更正**:初稿写"六种",并把 `organization.store` / `organization.tenant` 列为"有 `status` 列但无 CHECK"。**这是错的** —— `V20260727_020000_000__named_status_and_organization_name_constraints.sql` 用 `ALTER TABLE … ADD CONSTRAINT ck_store_status / ck_tenant_status` 加了 `CHECK (status IN ('ENABLED','DISABLED'))`,全仓 30 处 `DROP CONSTRAINT` 中无一处删它。初稿只读了内联 `CREATE TABLE` 没跟 ALTER。**因此 §4.2 的"E 类(补约束)"是不存在的工作,这两张表属 B 类。**

| 形态 | 表 |
| --- | --- |
| `ENABLED/DISABLED/VOIDED` | `catalog_category`、`dictionary_entry`、`production_tag_definition` |
| `ENABLED/DISABLED` | `unit_definition`、`brand`、`head_company`、`organization_node`、`business_channel_template`、`organization.store`、`organization.tenant` 等 |
| `ENABLED/DISABLED/ARCHIVED/VOIDED`(四值) | `catalog_sku` —— 且 `ux_catalog_sku_active_code … WHERE status <> 'VOIDED'` 已就位 |
| `ENABLED/DISABLED/ARCHIVED` | `catalog_composite_component` —— **该表无 `code` 列**,按 1-L 判据不属主数据(见 §4.2) |
| `DRAFT/ENABLED/DISABLED/ARCHIVED/VOIDED` | `catalog_item` |
| `DRAFT/EFFECTIVE/DISABLED` | `business_channel` |
| **无 `status` 列** | `catalog_attribute_definition`、`catalog_order_option_definition` |

### 1.6 定义库四种下线语义

计量单位是 `delete` 与 `disable` **并存**;生产标签与字典条目走 `transitionStatus`;属性定义、点单选项定义、分类走 `delete`。而 organization 四个实体与 business-channel 两个实体**都统一用 `transitionStatus`** —— 说明统一做得到,catalog 是离群点。

危害不在数量,在于维护者要学四套模型、前端要写四套确认流、用户在六个库之间看到四种行为。

### 1.7 物理删除带静默级联数据损失

- `CatalogDefinitionFacts.java` 第 157–166 行:删一个属性定义会级联物理删 `catalog_item_attribute_selection` 与 **`catalog_item_attribute_assignment`(所有商品身上该属性的赋值)**
- `CatalogOwnerService.java` 第 6362 行:删一个分类是 `DELETE … WHERE category_ref IN (…)`,**整棵子树**

> **初稿更正**:初稿写"两条都不报错、不留痕",**这是错的**。分类删除有 `categoryReferencedItems(...)` 守卫,非空即抛 `REFERENCE_BLOCKS_DELETE / 422`,成功时返回 `deletedSubtreeSize` 与 `deletedCategoryCodes`;属性定义删除前会 `SELECT count(*)` 并把 `assignmentCount` 放进 readback;`deleteUnitDefinition` 有 `isReferenced` 守卫抛 `CATALOG_UNIT_IN_USE / 409`。

真实的问题因此不是"静默级联",而是三条:**级联面在删除时才被告知**(而不是删除前的确认交互)、**不可撤销**、以及**同类实体四种下线语义**。前两条由 RQ-LIFE-7 覆盖,第三条由裁定 1 覆盖。危害等级按此下调,但取消物理删除的理由不变。

## 2. 需求

### 2.1 读接口:owner 暴露业务模型,不暴露视图模型

**RQ-READ-1** owner 的 task-read 返回该实体的业务结构本身,包含相关联的结构化实体;返回内容不由任何调用方要显示什么决定。

**RQ-READ-2 · 零拼装** 后台不产出展示文案:不拼冒号、不加单位后缀、不决定行数、不做"摘要"。名称还是编码、排版、截断、空值怎么说,全部归前端。

**RQ-READ-3 · 能算 / 不能算判据** 前端拿到完整模型后自己能算出来的,后台不许算;必须依赖模型之外的数据才能算的,后台必须算,并以**结构化事实**返回(枚举码 + 结构,不是句子)。

逐例:`preparationSummary` 的每个组成部分都在 `preparationProfile` 内 → 前端能算 → 删除;`各规格制作内容不同` → 各规格 profile 都在返回里就能比出来 → 删除;`deletionAvailability` → 依赖全局引用计数 → 后台必须算,但形状是 `{blocked, reason, count}` 而非句子。

**RQ-READ-4 · 默认返回完整模型** 深度参数是最后手段。无参调用必须返回全部非无界事实;参数只能"减",不能"揭示"。只有无界关联(流水、日志、可无限递归的关系)允许用参数控制。递归终止在模型里声明一次,对所有消费方一致。集合分页(如规格子集合)是集合语义,不算裁剪。

**RQ-READ-5 · 读接口按实体收敛** "候选"不是实体,是带筛选参数的实体列表,不得单独开接口。catalog 22 个读接口的目标形态是 8–10 个。

**RQ-READ-6 · 聚合事实必须随实体返回,且必须是结构化的**

前端对**未加载的集合**无法自行统计。以下七类聚合必须由 owner 提供,它们不是"拼装",而是 RQ-READ-3 里"依赖模型之外的数据"的那一类:导航树各节点的商品计数、全部商品计数、分类被引用计数、商品的规格三计数(`skuEnabledCount / skuTotalCount / skuNonArchivedCount` —— 而规格是懒加载的)、生产标签的 `linkedProductCount`、单位的 `isReferenced`、`hasSkuChildren`。

形态必须是数字、布尔或结构,**不得是句子**。仓内已有两个正确样板,直接照抄即可:

- `skuSummary: {enabledCount, nonArchivedCount, totalCount, dimensions}` —— 前端在 `CatalogItemBasicView` 自己拼 `${totalCount}` 显示「规格数量」
- `deletionAvailability: {canDelete, blockingReferenceCount}` —— 前端在导航树自己写 `仍有 ${n} 个商品引用`

> **不写死这一条,零拼装很容易被执行成"把 `skuSummary` 也删掉",然后前端连「规格数量」都显示不出来。** 零拼装要删的是 `preparationSummary` 那种成品句子,不是这种结构化聚合。

### 2.2 生命周期:全平台统一三态

**RQ-LIFE-1** 主数据实体的生命周期只有三态:**启用 / 停用 / 标记删除**(存储值 `ENABLED / DISABLED / VOIDED`)。

**RQ-LIFE-2 · 可见性与可选性**

| 状态 | 定义库列表 | 关联选择框 | 编码占用 |
| --- | --- | --- | --- |
| 启用 | 可见 | 可见、可选 | 占用 |
| 停用 | **可见**(否则无法启用回来) | 不可见、不可选 | 占用 |
| 标记删除 | 不可见 | 不可见、不可选 | **释放,可复用** |

**RQ-LIFE-3 · 既有关联不受影响** 已停用或已删除的定义,其既有关联继续有效,详情继续正常显示其名称。

**RQ-LIFE-4 · 校验只针对本次变更的引用** 保存时只对**本次新增或改变**的引用做"必须启用"校验;未变更的既有引用一律放行。

> 这条不写死会出灾难:否则任何引用了已停用/已删除定义的商品都会变成不可保存,用户连改个名字都做不到。

**RQ-LIFE-5 · 编辑权与状态的关系(「停用可以改」的适用边界)**

Dexter 裁定「停用可以改」。本文将其精确化为:**停用不额外增加编辑限制**,而非"停用状态下什么都能改"。三处不适用:

1. **已删除件不可编辑** —— 裁定本身已含
2. **引用校验不是编辑校验** —— 停用件不得被**新**引用选中(RQ-LIFE-2)。实例:`BusinessChannelOwnerService` 第 649 行检查的是"用某模板新建渠道"时该模板的状态,属引用校验,**必须保持挡停用**;而第 511 行(改模板)与第 736 行(改渠道)是编辑校验,改为只挡已删除
3. **业务锁定字段与状态无关** —— 停用不解锁任何本就不可变的事实。仓内已有 `CATALOG_BASE_MEASURE_UNIT_CHANGE_BLOCKED`、`INVENTORY_DEDUCTION_MODE_CHANGE_BLOCKED`、`IMMUTABLE_FIELD`;语料库侧 G-04「项目 + 经营租户 + 品牌创建后锁定」、G-07「角色归属节点类型创建后不可改」

**RQ-LIFE-6 · `code` 不是稳定业务标识,`ref` 才是** 编码可复用意味着同一 `code` 在不同时间可指向两个实体。引用一律按 `ref`;对外传输、导出、跨系统对账不得以 `code` 作为身份。

**RQ-LIFE-7 · 删除前必须告知引用数** 删除是终态且释放编码,误删不可撤销(新建同 `code` 同名的是**另一个实体**,老引用仍指向旧行)。删除确认必须以结构化事实给出当前引用数。

## 3. 决策(Dexter 2026-08-26 已裁定)

| # | 裁定 |
| --- | --- |
| 1 | 六个定义库的下线语义一律统一走 `transitionStatus`;四种语义并存不是设计意图 |
| 2 | **物理删除完全取消** |
| 3 | 生命周期只有三态:启用 / 停用 / 标记删除 |
| 4 | 三态语义如 RQ-LIFE-2、RQ-LIFE-3、RQ-LIFE-4 |
| 5 | 适用**所有域**,不限商品域 |
| 6 | **去掉 `DRAFT`**(新建落停用) |
| 7 | **去掉 `ARCHIVED`**(并入已删除) |
| 8 | 存储值保留 `ENABLED/DISABLED/VOIDED` 不改名;用户可见词为「启用 / 停用 / 删除」 |
| 9 | **停用可以改**(适用边界见 RQ-LIFE-5) |
| 10 | `business_channel` 纳入三态(`DRAFT`→停用,`EFFECTIVE`→启用,新增已删除) |
| 11 | 本轮不动:`platform_admin`、`group_workspace`、`collaboration.*_enablement`、总公司品牌授权解绑 |
| 12 | **`ARCHIVED` 不恢复其原有语义**,统一并入 `VOIDED` 并**释放编码**。这是对既有设计声明的**主动废止**,不是疏漏 —— `V20260815_010000_000` 与 `V20260816_020000_000` 的注释原文写着「ARCHIVED remains visible to historical views and therefore keeps its code occupied」,该语义按本裁定作废;存量归档件编码全部释放、列表不再可见 |
| 13 | **停用阻断新建合同、邀请、渠道绑定、菜单发布等。** 这批事项在语料库 G-08(2026-07-25)中记为「全部逐项待裁决」,**由本裁定改写为"阻断"**;G-08 的该段自本日起以本裁定为准 |
| 14 | **去掉 backend-acceptance 的 80 条上限。** 该上限出自 `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md` 第 17 行(文件头 `decisionOwner: Dexter`),经 `CLAUDE.md` 第 55 行传入 `BackendAcceptanceTest.java` 第 386 行的断言。**Dexter 2026-08-26 确认该上限非其裁定**,予以去除 |

### 3.1 适用范围边界

**适用三态的 16 张表**与**不适用的 7 类**,清单见分析文档 §6.5.6。判据是:**能不能由人手动在两个状态之间来回切换?** 能 → 主数据;不能(单向推进,终态由过程决定)→ 过程或关系记录,保留自有状态机。

不适用的两条有语料库直接背书:**任职** `ACTIVE/REVOKED` 由 G-07 定死「不存在直接编辑任职,撤销即终态,重新授予必须走新邀请」;**合同** `ACTIVE/INVALID` 由 G-09 定为「存在性衍生状态」,不是 lifecycle。

### 3.2 物理删除取消的适用面与不适用面

适用:**业务实体的物理删除**。不适用:**为表达"集合被编辑"而删行的 SQL**。

owner 主源码共 40 条 `DELETE FROM`,绝大多数属于后者——`catalog_item_reference`(生产标签 0→1、1→0、1→另一个的唯一写入点)、`catalog_item_attribute_selection`、`catalog_item_order_option_config`、`catalog_composite_component` 等,都是"整组删掉重插"来表达一次编辑。**这些不在裁定范围内,不得改动。**

## 4. 优化方案

### 4.1 读模型改造

以 catalog 先行,逐字段替换:

| 现状 | 目标 |
| --- | --- |
| `categoryRef` + `categoryPathLabels` | `category: {categoryRef, code, name, parentCategoryRef, path: [{categoryRef, code, name}]}` |
| `tagRefs` + `tagSummary` | `tags: [{tagRef, code, name, status}]` |
| `productionTagRef`(仅 ref) | `productionTag: {tagRef, code, name, status} \| null` |
| `attributeSummary` | `attributes: [{definitionRef, code, name, valueType, value:{optionRef, code, name}}]` |
| `specificationOrOptionSummary` | `skuDimensions: […]` 或 `orderOptions: […]`,各为结构化实体 |
| `preparationSummary` | `preparation: {productionTag, displayName, estimatedSeconds, notes}` + 各规格 profile |
| `inventoryDeductionSummary` | 保留结构化形态,去掉派生的展示措辞 |

**读接口收敛:22 → 12–13(初稿写 8–10,已下修)。**

站得住的两项:

- **四个"候选"接口消失** —— 候选不是实体,是带筛选参数的实体列表。这一项很硬。
- **库存目标的视图切片并入目标读** —— 但**不是初稿说的五个**。`business-history` 与 `ledger` 的参数形态完全相同(都是 `targetRef + cursor + pageSize` 的无界历史),按 RQ-READ-4「只有无界关联允许用参数控制」两者都该独立保留;`changes` 有必填 `period`,把它并入默认完整模型等于让后台替调用方选一段,与 RQ-READ-2 冲突。**因此可并的是 `diagnostics` 与 `consumption-references` 两个,不是五个。**

**已撤回:六个定义库合一。** 初稿提出用 `kind` 参数把五个定义库读接口并成一个。实测五者实体形状差异很大 —— 单位是 `precision + unitDimension + isReferenced`,属性定义是 `valueType + options[]`,点单选项是 `selectionMode + values[]`,字典条目是 `parentEntryRef + dictionaryKind`,生产标签是 `linkedProductCount`。合并只能靠 `kind` 做多态返回,而前端本来就要按 §4.7 的三种形态分支,契约反而更难校验。**这与写侧结论一致:六个库是六种实体,读侧同样不该硬合。**

**分母必须写死。** "catalog 22 个读接口"的分母是 `catalog-inventory.openapi.json` 的全部 GET,其中 8 个属 inventory(targets / target / ledger / diagnostics / changes / consumption-references / business-history / consumption-target-candidates)。验收时按 catalog+inventory 合计计,不得只算 catalog。

### 4.2 生命周期改造分级

- **A 类(零改动)**:已三态的 3 张表,确认 partial unique index 已就位
- **B 类(加一个状态值)**:`ENABLED/DISABLED` 的表,改 CHECK 加 `VOIDED`,补 partial unique index
- **C 类(合并状态)**:`catalog_item` 去 `DRAFT` 去 `ARCHIVED`;`catalog_sku`、`catalog_composite_component` 的 `ARCHIVED` → `VOIDED`;`business_channel` 的 `DRAFT` → `DISABLED`、`EFFECTIVE` → `ENABLED`
- **D 类(新增列 + 回填)**:`catalog_attribute_definition`、`catalog_order_option_definition` —— 现在完全没有生命周期,**本裁定隐含的最大一块工作**
- ~~**E 类(补约束)**~~ —— **该类不存在**,已删除。`organization.store` / `organization.tenant` 的 `ck_store_status` / `ck_tenant_status` 早在 `V20260727_020000_000` 就已建立且从未被 DROP;这两张表属 B 类
- **需重新分类**:`catalog.catalog_composite_component` 初稿列入"适用三态",但该表**没有 `code` 列**(列为 `composite_component_ref / composite_group_ref / component_item_ref / product_sku_ref / quantity / unit / is_default / extra_price / status / display_order`,唯一约束是 `(composite_group_ref, display_order)`),按 `1-M` 物理上无法满足。而按 `1-L` 的可证伪判据(能否由人手动在两个状态间来回切换),组件行是"整组删掉重插表达一次编辑",**本就不是主数据**。先按判据分类,不要靠豁免打补丁
- **已就位无需改**:`catalog_sku` 已是四值且 `ux_catalog_sku_active_code … WHERE status <> 'VOIDED'` 已建;本批只需把 `ARCHIVED` 并入 `VOIDED`(4→3),不是新建 partial index

契约变更:`CatalogItemBatchStatusTransitionRequest.targetStatus` 由五值收敛为 `"ENABLED" | "DISABLED" | "VOIDED"`。

**编码释放必须靠 partial unique index**:`VOIDED` 行仍在表内,普通唯一约束会永久占住编码。照搬 `V20260816_030000_000__catalog_dictionary_tag_voided_code_release.sql` 已验证形态。

### 4.3 门(gate)

> **本节不复述规则。** 按 `doc/platform/backend-coding-standard.md` §5「本文是唯一内容源…别处只放指针,不复述规则内容」,门的判据、反例与红夹具**全部只在规范正本**:`1-J`(引用必须可解析为业务身份)、`1-K`(已零拼装的文件不得再出现展示文本装配)、`1-L`(主数据状态词汇恰好三值)、`1-M`(作废后编码必须可复用)、`1-N`(校验只针对本次变更的引用)、以及只能靠 review 的 `2-H`、`2-I`。
>
> 初稿用第二套编号(G-1..G-5 / RQ-READ-*)把同一批规则又写了一遍,已按规范删除。两份当时已经开始漂移(规范写明了门脚本名,需求文档没写)。

本节只登记**需求侧仍未闭合的三件事**:

**一 · 五个门全部尚未建成。** `scripts/check/read-model-reference-identity`、`scripts/check/read-model-zero-assembly`、`scripts/check/lifecycle-vocabulary` 在 `scripts/check/` 下不存在,在 `tools/verify-gates/verify.mjs` 的 command 列表中零命中。规范条目已逐条标注「待建」。**门存在 ≠ 门生效**,建成后必须进 command 列表。

**二 · 两份登记是门成立的前置,尚未建立。**

- `1-J` 需要**业务实体引用登记**:仓内 `format: uuid` 属性 837 个,作用域坐标、请求条件回显、资产句柄本就不该有业务身份。不登记就只能按名字猜,而 `1-L` 明令禁止名字猜测。
- `1-L` / `1-M` 需要**主数据表登记 + 豁免登记 + 逐表 scope/code 列登记**。分母可查:`db/migration` 下 105 个 `CREATE TABLE`,建表体内带 `status` 的 20 张,另有 ALTER 追加的若干。

**登记未建立之前,对应规则只能靠 review,不得接门。**

**三 · `1-N` 的验收场景名额已解除阻塞。** 该门走 `backend-acceptance` 真实场景,是这批规则里**唯一验证真实行为的门**。原先受 80 条上限阻塞(当前恰好 80/80),按裁定 14 该上限去除,阻塞解除。落地时需三处同改:`doc/decisions/2026-08-14-…-standard.md` 第 17、27 行、`CLAUDE.md` 第 55 行(该行"当前已实现并运行 28 条"也已过时,实测 80)、`BackendAcceptanceTest.java` 第 386 行。

### 4.4 分批

一,**catalog 读模型零拼装 + 读接口收敛**,同批建 G-1、G-2。catalog 正在被改动,趁热做;同时验证 RQ-READ-3 的能算/不能算判据是否真可判。

二,**catalog 六库下线语义统一 + 三态改造(A/B/C/D/E 五类)**,同批建 G-3、G-4、G-5。与一同批,都动 catalog 契约。

三,**其余模块逐个体检,不逐个重构**。体检只回答两个问题:该模块读接口里有没有预渲染字符串或"某屏专用"字段;有没有维度进了接口身份却不决定授权。有才动。

四,ORG / IAM **不在范围内**(§5)。

## 5. 明确不做

- **不合并 ORG / IAM 的接口。** 实测 21 个 operation 被 `noClientDerivedAuthorization: true` 与 `serverDerivedTarget: "STATIC_OPERATION_CAPABILITY"` 显式治理,IA-05 §32 明定「五类用户页的目标来自已批准的 operation/capability 绑定,而非…用户提交的机构」。合并等于把声明式授权边界改成请求体驱动。ORG 四实体由 G-02 / G-04 / G-06 明确区分,组织树节点的 `Node` 统一已完成。
- **不把写命令合并成通用"保存模型"。** 每个命令承载自己的授权、幂等键、审计凭据、锁与 typed 拒绝码。
- **不动流程状态机**:邀请、OTP、密码恢复、资产暂存、会话、任职、合同有效性。
- **不加"显示已删除"筛选**找补 `ARCHIVED` 智能视图退役。想保留可浏览就用停用。
- **不改 `ENABLED/DISABLED/VOIDED` 枚举字面量**。

## 6. 验收判据(可证伪)

初稿八条中有三条不可证伪,已重写。

| # | 判据 | 自带反例 |
| --- | --- | --- |
| A-1 | **在已零拼装的字段集合内**,新增一个展示形态(如把分类路径改成显示编码)不需要改后台 | 判据必须先声明"已零拼装字段集合",否则任何当前未 SELECT 的字段都需要改后台,判据循环。初稿举的例子(分类编码)恰是 §4.1 计划**加进**模型的那一个 |
| A-2 | **零拼装文件清单内**的文件,`git grep` CJK 字面量为空 | 初稿写的是"owner read 路径内无 CJK 字面量",可被**移动文件**绕过——今天最露骨的一处装配已在 `CatalogOwnerService` 之外;改为文件清单后,移出清单需要显式改清单 |
| A-3 | 已登记的业务实体引用,均可在同响应体内解析到 `code` 与 `name` | 摘掉某个已登记 ref 的 `code`,门必须红。**未建立引用登记前本条不可验收** |
| A-4 | 主数据清单内的表 `status` 恰好三值,且**任何带 `status` 的表都落在主数据清单或豁免清单** | 新建一张带 `status` 且两处清单都不登记的表,门必须红 |
| A-5 | 作废后同 `code` 可重建 | partial index 改回普通 UNIQUE,门必须红 |
| A-6 | 引用了停用定义的对象仍可保存(不改该引用);改成另一个停用的被拒 | **这是唯一的真行为判据**,可先红后绿。现有 `catalog.tag-navigation` 只断言读侧可见,写侧未覆盖 |
| A-7 | 停用件可编辑;已删除件不可编辑;停用件不可被新引用选中 | 三条各有独立场景;第三条的正例是 `BusinessChannelOwnerService` 中"用某模板新建渠道"的模板状态检查 |
| A-8 | `catalog-inventory.openapi.json` 的 GET 总数 ≤ 13 | 分母写死为该文件全部 GET(含 8 个 inventory),不按域拆分 |

## 7. 风险与未决

**风险 1 · 丙档(加数据库列)不在初稿的迁移分级里。** `catalog_attribute_definition_option` 无 `code` 列,要返回选项编码必须加列 + 回填。按 CLAUDE.md「超过半小时难以核完的交付应先切小」,这一项与 D 类(`catalog_attribute_definition` / `catalog_order_option_definition` 新增 `status` 列)应合并为一个可独立验收的迁移子批。

**风险 2 · 读接口收敛会改变验收分母。** `backend-acceptance` 场景绑定具体 operationId,接口合并须与场景更新同批,不得先合并后补。

**风险 3 · 预算门口径需同步变更(经复核成立)。** 有评审意见认为该门不存在。**已亲验:门存在且生效** —— `scripts/test/r5-remote-testcontainers.mjs` 第 195 行 `assertPerformanceOperationBudgets(registry, events)`、第 344 行判 `evidence.exceeded !== 0`、第 385 行 `requireClosedPerformanceCount(…, 'BUDGET')`,且 `scripts/generate/backend-performance-budget.mjs` 被四个脚本消费;本会话实测某次 run 产出 `declared=239 / observed=239 / exceeded=0`。提出反对的评审查的是 `x-database-operation-budget` 这个 OpenAPI 扩展与 acceptance 层的 metrics sink,那两处确实不设门,但真正的门在 run 级。**读接口合并后单接口 DB 操作数上升而每屏调用次数下降,口径须改为「每屏 DB 操作数」并与合并同批,否则合并会被现行门拦下。**

**风险 4 · 两份登记未建立之前,四个门都不能接。** 见 §4.3 第二条。强行接门的后果:`1-J` 在真实契约上会大面积判红(其中相当比例是本就不该有业务身份的作用域坐标与资产句柄),`1-L` 则是有登记才绿、无登记也绿的存在性判据。

**风险 5 · `skuDimensions` 结构化与既有性能设计冲突。** 列表投影处的源码注释明写"故意不加载 axis 关系以避免第二次分页查询"。改成结构化实体可能增加一次查询,**必须先实测再决定是否纳入本批**,不得按"不增加往返"想当然。

**未决 1**:总公司品牌授权解绑是否也改状态迁移(按裁定 11 本轮不动;该事实有审计意义,可后续再议)。

**未决 2**:推进节奏 —— 甲档零拼装与三态改造是否同批。

**未决 3**:两份现行 active 记忆与本标准冲突,需一并处置:
- `project-memory/practices/external-collaboration-readback-display-and-detail-surface.md` 要求 owner 提供 `*DisplayName` 并由 owner 决定空值话术(「待外部授权回填」「无需主体映射」),与 `NO_BACKEND_DISPLAY_ASSEMBLY` 的"空值怎么说归前端"直接冲突。**建议的消解**:owner 返回 `authenticationKind` 与空值原因码,前端写话术 —— 这与 RQ-READ-3 一致,但需改动 collaboration 域的契约与该条记忆,超出本批范围。
- `doc/platform/foundation-charter.md` §1-H 仍逐字保留被本批推翻的旧判别式(「消费者真正用到的字段闭集,和读模型返回的是不是同一个」),而该文件是"实施 agent 的第三份必读"。**必须同批修**,否则两个权威同时生效。

**未决 4**:契约层的旧口径。`contracts/catalog/catalog-inventory-edge-contract.json`(7 处)与 `contracts/policy/catalog-inventory-assertion-matrix.json`(2 处)写着 `Load exactly the approved detail section with bounded task reads and return its typed read model.` —— 这是**契约级**的按屏取数义务,与 RQ-READ-1 相反,需要与读模型改造同批处置。

## 8. 本文的自我更正记录

本文初稿于同日经两轮独立对抗评审(两个 fresh 子 agent,分别攻需求/症状与门/规范),合计判 M=15、S=22,两侧在六条上独立收敛。以下为已更正内容,保留记录以免被当作待办重新捡起:

| 初稿结论 | 处置 | 原因 |
| --- | --- | --- |
| 六处中文拼装的具体行号 | **删除行号,改符号定位** | 六个行号系统性偏移,既不匹配 HEAD 也不匹配工作树 |
| "共 6 处拼装" | **改为至少 10 处、跨两个文件** | 漏计 `CatalogItemDefinitionFacts` 三处与 `appendVoidBlockingReason` 一族九处 |
| `store` / `tenant` 无 CHECK;"六种形态";E 类补约束 | **全部更正** | `ck_store_status` / `ck_tenant_status` 早已存在;实为五种形态;E 类是不存在的工作 |
| `catalog_sku` 是三值 | **更正为四值,partial index 已就位** | `V20260816_020000_000` |
| 删除"不报错、不留痕" | **更正** | 分类删除有引用阻断,属性删除回报影响面 |
| "数据早已查回,净删代码" | **分三档改写** | 只有甲档两项成立;乙档要改投影,丙档要加列 |
| G-1..G-5 / RQ-READ-* 的规则正文 | **删除,改为指向规范正本** | 违反 `backend-coding-standard` §5「唯一内容源…别处只放指针」,且两份已开始漂移 |
| 五个门"可接入 verify.mjs" | **改为逐条标注"待建" + 两份登记为前置** | 门脚本全仓不存在;`1-J` 的字面判据会大面积误报,连本方案自己的目标形态(`tags:[{tagRef, code, name, status}]`)都判红;`1-K` 的判定边界不可机器定义,且仓内今天就有绕过路径 |
| 六个定义库合一 | **撤回** | 五者实体形状差异大,合并只能靠多态,前端并不因此简化 |
| 22 → 8–10 | **下修为 22 → 12–13** | 六库合一撤回;`business-history` 与 `changes` 按 RQ-READ-4 不该并入 |
| 验收判据 A-1 / A-2 / A-8 | **重写** | A-1 循环、A-2 可被移动文件绕过、A-8 分母未定义 |
| "复用现有 backend-acceptance,不新增基建" | **更正** | 场景数当时已 80/80 顶格;该上限已由裁定 14 去除 |

**方法教训**:凡以行号为坐标的"实测"声明,在文件有未提交改动时即刻失效;凡只读 `CREATE TABLE` 不跟 `ALTER` 的 DDL 结论,会凭空造出不存在的工作项;凡把两项验证结果推广到六项,成本论证就会塌。
