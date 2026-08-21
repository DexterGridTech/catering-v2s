# 商品属性库、点单选项库与两步新建：需求分析讨论稿

> 日期：2026-08-20  
> 状态：`PROPOSED_FOR_DEXTER`（Dexter 的十项产品裁定已记录；仍未授权 implementation-facing 详设或实现）  
> 性质：需求分析与讨论记录；不是 Journey 裁决、implementation-facing 详设、契约/数据库/代码/运行授权。  
> `SKILL_USED=cs-brainstorming@4a54a4858b99807f3155ed1614b2f116e35ea5c1b788e793f565dd837fd3891f`

## 1. 本轮用户问题与目标

现有商品维护把描述属性和点单选项逐商品录入，导致同一业务定义反复创建、口径易漂移。Dexter 提出的目标是：

1. 建立可复用的**商品属性库**。定义有名称、编码和 `TEXT`、`SINGLE_SELECT`、`MULTI_SELECT` 三种值类型；选择型定义自己的选项。商品从库中选择多个属性，并只维护该商品的属性值。
2. 建立可复用的**点单选项库**。库定义选项组、单选/多选、面向客端的顺序与组选项；商品只选择已有选项组，并维护该商品的必选、默认、加价及选项值的扣料数量。
3. 新建商品先以 **Modal** 只提交商品编码、名称、分类、商品形态；提交成功后打开既有商品编辑 **Drawer**，继续维护其他详情。商品形态必须在第一步得到足够说明，并明确创建后不可修改。

### 成功结果

同一“过期时间”属性可在面包填写“三个月”、在可乐填写“六个月”；同一“蘸料”组可被多个商品复用，同时每个商品仍能决定必选、默认、加价和实际扣料。业务用户不再在每个商品中重复发明属性/选项定义。

## 2. 已重开的事实与冲突

### 2.1 现有能力不是新需求的等价实现

| 面向 | 当前事实 | 与新需求的关系 |
| --- | --- | --- |
| 商品属性 | `CatalogItem.attributes` 是无 schema 的自由 JSON map；商品编辑器可逐项输入键和值。 | **明确冲突**：没有属性定义、类型、选择项或引用。 |
| SKU 销售属性 | `SKU_ATTRIBUTE → SKU_ATTRIBUTE_VALUE` 是父子字典，用来生成 SKU 规格矩阵。 | **不能复用**：SKU 规格与商品描述属性是不同用户任务。 |
| 点单选项 | 组和值以 `itemRef` 为父；组名、选择方式、值名、默认、加价和顺序均在商品内保存。 | **明确冲突**：没有共享组选项定义。 |
| `ORDER_OPTION_VALUE` | 已存在无父级的字典值引用。 | **不能误称选项库**：它没有组选项、选择方式、对客顺序或扣料模板。 |
| 选项值扣料 | 选项值已可作为 BOM owner；不是独立库存对象。 | **可复用底座**：`N 克`必须仍是 option-value BOM，而不是把商品引用直接当库存事实。 |
| 商品新建 | 创建成功后可打开同一商品详情 Drawer；当前第一步却是 Drawer，且没有分类、形态详情。 | **可复用跳转，不可复用第一步 surface/契约**。 |

本需求因此是对旧 D-07（描述属性自由 map）和 D-08（点单选项商品内联）的**有界重裁**，不是前端换控件或给既有 JSON 改名。保留未被修改的边界：一个 catalog owner、inventory owner 独立、生成客户端唯一消费路径、商品形态创建后锁定、选项值不能独立成为库存对象。

## 3. 已按 Dexter 裁定收敛的概念模型

### 3.1 商品属性：定义与商品值分离

```text
商品属性定义 ProductAttributeDefinition
  ├─ stable definitionRef / code / name / valueType
  └─ 选择型时：有序的 ProductAttributeOptionDefinition[]

商品属性赋值 ItemAttributeAssignment
  ├─ attributeDefinitionRef
  ├─ TEXT：textValue
  └─ SINGLE/MULTI：selectedOptionDefinitionRefs[]
```

- 属性库是**总部或门店私有**的 catalog scope 事实；编码可改，但在同一总部/门店 scope 内必须唯一。商品关联永远保存稳定的 `definitionRef`，不能把可变编码当关系键。
- `TEXT` 只承载展示文本，例如“3个月”；不预设数值、单位、正则或公式，以免把简单描述属性误建成计量体系。
- `SINGLE_SELECT` 恰好一个选项值，`MULTI_SELECT` 一到多个选项值；定义的类型决定商品值的合法形状。
- 定义可删除。删除定义时，同一 scope 内所有 `ItemAttributeAssignment` 及其商品属性值一起删除；这里的“所有引用”是属性关联和值，不是删除商品本身。该强级联正是不能继续把属性存为商品 JSON 的原因。
- 商品从总部复制到门店时，复制它关联的属性定义、选择项和商品赋值到门店 scope，并把关联重写为门店的 `definitionRef`；不得留下跨 scope 引用。
- 旧自由 map 的实际迁移/清理策略属于后续 implementation-facing 详设，不能在本讨论稿中臆定。

### 3.2 点单选项：定义与商品策略分离

```text
点单选项组定义 OrderOptionGroupDefinition
  ├─ stable groupDefinitionRef / code / name / selectionMode
  └─ 面向消费者有序的 OrderOptionValueDefinition[]

商品选项组配置 ItemOrderOptionAssignment
  ├─ optionGroupDefinitionRef
  ├─ required / minSelected / maxSelected（若适用）
  └─ 每个 value 的 ItemOrderOptionValueOverride
       ├─ defaultSelected
       ├─ extraPrice
       └─ 每个强制组件的 option-value BOM quantity（实际扣料）
```

点单选项库同样是**总部或门店私有**的 catalog scope 事实。推荐把**定义事实**固定在库中：组名、值名、仅 `SINGLE` / `MULTIPLE` 的选择方式、消费者顺序、以及每个选项值的一个或多个强制原材料组件；把**商品策略**固定在商品关联层：是否必选、默认、加价及每个强制组件的实际扣料数量。商品不得隐藏库中的任一值，也不得重排、替换、增加或删除强制组件。这样“蘸料”仍是一个定义，“美式薯条”才决定黑松露酱加价和使用量。

对客顺序是业务表达，应存在于组选项定义，且只能由库控制。全局配置表不需要为管理员检索而排序，但这个顺序服务消费者点单，属于例外。多选组必须定义最少和最多可选数；单选不保留旧 `FIXED` 模式。

### 3.3 原材料与库存：保留 owner 边界

“黑松露酱消耗瓶装黑松露酱 N 克”不能只保存原材料 `CatalogItemRef`。实际扣料必须指向 inventory owner 的有效库存 target，并保存数量、库存真相单位以及 option-value BOM 身份。

Dexter 裁定库层原材料关系是**强制**的，并允许一个选项值拥有多个组件。因此，选项库定义 1..n 个必须消耗的原材料商品；商品关联该组选项后，必须逐一配置这些组件的 `N` 值，不能换成别的材料或删掉组件。库存 target 的解析、单位兼容和最终 BOM 行仍属于 inventory owner；在总部商品复制到门店时，相应定义、商品关联与 BOM 引用都必须按既有 brand-copy reference plan 改写到门店 scope。

## 4. 两步新建交互稿

### 第一步：新建商品 Modal

仅出现四项，均为提交所需事实：

1. 商品编码
2. 商品名称
3. 分类（可不选；只能选择一个节点）
4. 商品形态

形态选择不是简单下拉框。每个可创建形态要同时说明：销售/原材料/套餐/服务的用途、是否按 SKU 管理、计量方式、库存/BOM 可配置性，以及创建后不可修改。未开放的权益商品壳保留可见但禁用和原因说明。

分类使用树形选择器，允许为空但至多一个。提交后应以这四项**原子创建 DRAFT**。成功才关闭 Modal，并打开该商品的编辑 Drawer；所以分类必须进入创建 command，不能先声称提交成功、再让用户在第二步补分类。

### 第二步：商品编辑 Drawer

继续复用既有宽 Drawer、dirty-close 生命周期、overlay lock、生成客户端和 manifest 驱动字段/页签。属性页变为“从属性库添加定义 → 填写值”；点单选项页保留现有三栏（组列表、组详情、预览/问题），但把“新建组/值”改为“从点单选项库添加”，并只编辑商品级覆盖。

关闭 Drawer 不撤销第一步成功创建的 DRAFT；建议保留为可继续编辑或按既有治理路径作废，避免一次关闭造成隐式删除或跨 owner 补偿。

## 5. 前置条件链、非目标与禁止推导

### 三段前置条件链

1. **业务前置**：属性库、选项库的 scope、传播、删除、强制扣料、分类和 DRAFT 语义已由 Dexter 裁定；实现前仍须为跨 scope 编码冲突给出明确的预检结果。
2. **模型前置**：定义事实、商品赋值/覆盖、BOM/库存 target 和迁移规则各有唯一 owner，不能靠字段名或 JSON 兼容层混用。
3. **交互前置**：创建 Modal 的四项原子提交与 DRAFT 生命周期先在契约闭合，才接入 Drawer 和生成 client。

### 本轮非目标

- 不实现面向消费者的菜单、下单、订单扣减/恢复或对客 UI。
- 不把 SKU 规格属性、商品标签、生产标签或现有 `ORDER_OPTION_VALUE` 偷换成新实体。
- 不引入采购、仓库、批次、调拨或重供应链能力。
- 不在 platform-admin 新建商品维护面；商品维护仍属于 operations-admin。
- 不以“库已维护”宣称订单库存扣减已经实现。

### 禁止推导

- 有原材料商品不等于已有可扣减库存 target。
- 普通商品编辑能使用一个组选项，不等于可在商品内复制、改写该组定义；品牌复制是另一条受控的深复制路径。
- 删除商品属性定义只删除该属性在商品上的关联和值，不等于删除引用它的商品；点单选项库的删除语义不由商品属性的级联规则自动推导。
- 定义层显示顺序不等于管理员配置列表必须提供排序操作。

### 业务语料映射

本稿使用 G-11 的 `CatalogItem`、SKU、选项、BOM 与销售边界，及 G-12 的库存 target/BOM/消耗单位边界；不由这些术语推导菜单发布、可售或订单执行。

## 6. Dexter 决策记录（2026-08-20）

1. 属性库与点单选项库都属于总部/门店私有；门店从品牌复制商品时，关联数据同时复制到门店。
2. 属性 `TEXT` 是普通文本。
3. 属性定义编码可修改、同 scope 内唯一；允许删除，删除时级联删除所有属性引用和值。因此商品属性不能再保存为商品内 JSON。
4. 点单选项库变更影响已关联商品；商品不能隐藏库中某个值。
5. 对客展示顺序只由库控制。
6. 仅保留单选/多选；多选有最小/最大选择数。
7. 一个选项值可有多个原材料 BOM 组件，且库层组件关系是强制模板。
8. 第一步分类可不选、但只能单选，并使用树形选择器。
9. 第二步关闭后保留第一步创建的 DRAFT。
10. 本期仅覆盖运营端配置；不包含对客端读取或订单执行。

### Dexter 补充决策记录（2026-08-20）

11. 门店复制品牌商品时，若目标门店已有同编码但**类型、选择项或强制原材料组件不同**的私有属性/点单定义，预检必须阻止复制、显示冲突定义，并要求先在门店整理；不得自动复用或覆盖。
12. 点单选项组/值删除采用级联删除：删除其所有商品组选项配置、值覆盖和对应 option-value BOM。级联范围是定义及其引用事实，不删除商品、库存 target 或原材料商品本身。

## 7. 讨论记录（本轮）

- **已确认问题根因**：属性和点单选项当前均以商品为中心保存；复用需求要求把“定义”从“商品特有策略/值”中拆出。
- **已确认可复用底座**：现有商品创建后打开详情 Drawer 的衔接、shape 创建后不可改、属性/SKU 的父子字典模式、option-value BOM 和 catalog → inventory 同事务公开 command 路径。
- **已记录的 Dexter 裁定**：第 6 节第 1–12 项；本轮产品语义已闭合。后续只能在获得独立授权后形成 implementation-facing 详设或实施；在此之前不改变契约、数据、代码或运行环境。

## 8. 主要来源

- `doc/plans/platform/2026-08-05-v2s-catalog-store-light-inventory-requirements-analysis-codex.md`
- `doc/plans/platform/2026-08-06-v2s-catalog-inventory-merged-requirements-claude.md`
- `doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md`
- `doc/plans/platform/2026-08-06-v2s-catalog-inventory-three-stage-implementation-design-codex.md`
- `doc/decisions/2026-08-17-v2s-catalog-metadata-central-modal.md`
- `contracts/openapi/components/catalog/catalog-item.schemas.json`
- `contracts/catalog/catalog-item-editor-manifest.json`
- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx`
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java`
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java`
- `apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java`
