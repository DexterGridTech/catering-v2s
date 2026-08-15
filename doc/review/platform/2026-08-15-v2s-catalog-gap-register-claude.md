# 商品域差距登记 · 已知未做项

> **这是登记册,不是工单。** 它记录**已经查实、但本轮 P3-1 / P3-2 都不做**的差距,
> 目的是让它们**不再被重新发现一遍**,以及在有人问"还差什么"时有一份可查的账。
>
> **来源**:2026-08-15 一轮四路 v2s ↔ v4 逐项对比,重判出 **42 条**"我们更差"。
> 其中 **22 条已被两份工单覆盖**,**20 条未覆盖 + 3 条只部分覆盖** —— 本文登记的就是这 23 条。
>
> ⚠️ **不要把本文当成待办清单。** 每条都还没做**方案合理性判断** ——
> "v4 有而我们没有"不等于"我们应该有"。真要做某一条时,先按 P3-1 §1.0 的判据重新评一次。

## 0 · 判定口径

**一条 = 一个可独立验收的能力/约束/控件差异。** 同根因跨面的合并计一条。
**"更差"的判据**:v4 有一个可打开的构件(表/约束/端点/控件/索引)承担某职责,
而 v2s 在对应位置**没有、或被降级成自由文本/常量/全表扫**。

**已被产品裁定 Out 的不计**:导入导出(`IA-CAT-LIST-008` 明写本期 Out)· 治理六值(Dexter 裁定删除)。

---

# 1 · 建模面(7 条未覆盖)

| # | 我们现状 | 📗 v4 | 用户/系统撞上什么 |
|---|---|---|---|
| **M6** | 销售单位只是 `dictionary_entry`(code / name / status / display_order),**没有 `unit_kind`,没有 `precision`** | `catalog_sales_unit.unit_kind`(COUNT / WEIGHT / VOLUME / SERVICE_DURATION / PACKAGE)+ `precision int check 0..6` | **称重商品的小数位无处存** —— 而 `STANDARD_SALE_WEIGHED` 这个形态在我们枚举里是存在的 |
| **M7** | 商品标签**无 kind 维度** ⚠️ 注意生产标签有(`production_tag_definition.tag_kind`),**唯独商品标签没有** | `catalog_tag.tag_kind`:GENERAL / ALLERGEN / NUTRITION / OPERATIONS / REPORTING | **过敏原标签与营销标签在我们这里是同一个平铺列表** |
| **M8** | 描述属性 = `catalog_item.attributes` **自由 JSONB**,无属性定义、无值域、无必填、无顺序。直接后果:编辑态只能给一个 `Input.TextArea rows={12}` + `JSON.parse` 校验 | `catalog_attribute_definition` + `catalog_attribute_value`(带 `owner_type` CATALOG_ITEM/SKU/OPTION_VALUE + `unique(owner_type, owner_ref, attribute_id)`);UI 是专用的属性值表格 | **老板要填「产地」得自己写 `{"origin":"..."}`** |
| **M9** | 识别码 = `sections.identifiers` 自由 JSON,**无表、无唯一约束、无 SKU 级**;编辑态三个自由 `Input`,类型也是自由文本;只读态直接写「状态:当前契约未提供」。SKU 条码列**无唯一索引** | `catalog_identifier` 表:`identifier_type` 六值枚举 + `unique(group, catalog, type, value)` + 可挂 SKU 复合 FK | **两个商品录同一条码,数据库照收** |
| **M10** | 外部身份 = `sections.externalIdentity` JSON,**无唯一性** | `catalog_external_identity` + `unique(group, catalog, source_system, type, value)` | **同一个外部商品被映射到两个本地商品,系统不拦** |
| **M11** | **无任何权益参与度字段** —— 而 `BENEFIT_SHELL` 在 shape 的 CHECK 里是存在的,只是没有承载列 | `catalog_item.benefit_participation` / `benefit_target_ref`;`catalog_sku.benefit_participation` + CHECK | **权益壳商品建出来是个空壳** ⚠️ 这条是有意取舍(权益类未开放),**但此前从未登记** |
| **M12** | **catalog schema 十六张表,没有 `audit_event`** | `catalog_audit_fact` + `catalog_outbox_event` | **「谁在什么时候把这个商品停用了」查不出来**。<br>⚠️ **这条是仓内不一致,不只是不如 v4** —— 同仓 `platform_iam` / `platform_workspace` / `organization` / `extension` / `workspace_iam` / `contract` **六个 owner 都建了 `audit_event`,唯独 catalog 没有** |

---

# 2 · 交互面(6 条未覆盖 + 3 条部分)

| # | 我们现状 | 📗 v4 | 用户撞上什么 |
|---|---|---|---|
| **X3** | 规格维度**不能排序**,只有新增/移除,顺序靠数组下标 | 行可拖拽,重排回写 `displayOrder` | **想把「口味 × 份量」换成「份量 × 口味」,只能删了重建** |
| **X4** | **无 SKU 组合预览** | 生成前展示将产生的组合标签 | 选完值不知道会出几行 |
| **X6** | 列表**不能排序** —— 六列**无一个** `sorter`;owner 查询白名单十五个字段**无排序键**;SQL 固定 `ORDER BY code` | 列 `sorter: true`;后端支持 name / code / status / updated_at + 方向 | **「按最近更新排」做不到** |
| **X7** | 列表**不能选列**,固定六列 | 列设置 Popover,7 默认列 + 5 技术列,一键恢复 | 屏幕窄时无法取舍 |
| **X11** | **分类计数口径与筛选口径不一致**:navigation 给的 `count` 是直接挂载数并自报 `countSemantics: "SELF_ONLY"`,而前端点父分类时发的是 `includeSubCategories: true` | 计数与筛选同口径 | **左树显示 3,点进去出来 17** |
| **X12** | 展开 SKU 子行**拉整份商品详情**,连带触发 inventory 定义读 + 全量生产标签读 | 列表已带 SKU 预览字段;展开走只回 SKU 行的专用查询 | 展开一行 = 一次完整详情往返 |
| **X8** ⚠️部分 | **无标签筛选**(筛选区只有 状态 / 治理 / 来源) | 多选标签 Select + 后端 `tag_refs_json @> ?` | 按标签找一批商品做不到。<br>P3-2 的 2-1 说了"标签行/筛选/批量三处悬空",**但没单列筛选的目标形态** |
| **X13** ⚠️部分 | 主列**缺「未分类」显式标记与「缺图」提示** | 分类 Tag(无则「未分类」Tag)、标签 Tag + `+N`、**缺图警告 Tag** | **一眼看不出哪些商品缺图**。P3-2 §3.4 只覆盖了 `NameCodeText` 与短名 |
| **X14** ⚠️部分 | BOM 的**每份消耗与单位是自由 `Input`**;节点是平铺卡片,**无商品/SKU/选项值节点树** | 组件 `Select` + 搜索、数量 `InputNumber(min 0.0001, precision 4)`、按节点树配置 | **用户可以在「每份消耗」里打汉字**。P3-2 §3.2 只覆盖了 `targetRef` 换选择器 |

---

# 3 · 逻辑关系与性能面(7 条未覆盖)

| # | 我们现状 | 📗 v4 | 后果 |
|---|---|---|---|
| **P2** | 列表**每页发 8 次关系读**。⚠️ 其中 composite / orderOption / skuVariantDimensions / tagRefs / salesUnitRefs **五类列表投影一个都不读** —— **读了不用** | 投影表一次读出 | 五次纯浪费的往返 |
| **P3** | 每次商品详情都拉**全量生产标签字典**,只为填名字 | 标签名随投影一起来 | **开一次抽屉 = 一次全字典读** |
| **P4** | 分类树每个分类跑 4 个相关子查询,其中 `string_agg(DISTINCT item.name, '、')` 把该分类子树下**所有**商品名拼成一个字符串,**无上限** | 一条 CTE 只回计数 | **1000 个商品的分类 → 导航响应里塞 1000 个名字** |
| **P5** | 复制候选**硬编码 `LIMIT 100`**,`cursor` 恒 null,`total` = 已返回条数;字典读同法 | 有关键词 + 分页 | **商品超过 100 时"总数"是假的,而且翻不了页** |
| **P6** | `closureGraph` 为复制预检把**整个 scope 的全部商品**读出并 hydrate(再乘 8 次关系读),**无 LIMIT** | 定向映射 | 门店商品越多,预检越慢 |
| **P8** | 前端分页**只能 ±1** —— `nextPage > cursorStack.length` 时只 push 一个游标,而分页条却渲染出第 5 页 | 直接跳页 | **点第 5 页只走到第 2 页** |
| **P9** | ⚠️ **本条已订正,原描述有一处方向性错误,见下** | 走关系表 | 见下 |

## 3.1 · `P9` 订正(**本文唯一一条方向性错误,发布后自查发现**)

**原描述说它"既是死代码(仓内无调用点),又是一条潜伏的全域扫",并在 §4 建议"可以直接删,不需要方案论证"。**

✅ **"死代码"是错的。** 换一种写法(`consumption-references` / `consumptionReferences`)再搜,**八处命中**:

| 落点 | 说明 |
|---|---|
| `contracts/openapi/catalog-inventory.openapi.yaml` | **真实 HTTP 路由** `/operations/catalog-inventory/inventory-targets/{targetRef}/consumption-references` |
| `InventoryDetailDrawer.tsx` | **前端真的在用** |
| `InventoryTaskReadService.java` | **inventory owner 的实现** |
| `catalog-inventory-edge-route-registry.json` | 已登记在路由注册表里 |

**我错在认错了对象**:catalog 侧那个方法叫 `inventoryConsumptionReferences`,
而真正服务这条路由的是 **inventory owner 的 `InventoryTaskReadService`** ——
**两个不同 owner 里的同名概念,我当成了一个。**

**订正后这条还剩什么**:
✅ catalog 侧那个方法**本身**仍是 `SELECT ... sections::text FROM catalog_item WHERE scope` 的全域扫,
而 `saveItem` 明确跳过 `inventoryBom` 不落 catalog sections,**所以它的谓词恒不命中**。
**它仍然是一段不产生正确结果的代码,但它不是那条路由的实现,删它之前必须先确认没有别的入口。**

⚠️ **本条降级为"待查",不再是"可直接删"。**

> **这条错误值得记在这里而不是悄悄改掉。** 它是这份登记册里**唯一一条我给出了"直接动手"建议的**,
> 而它恰好是错的 —— **越是给出行动建议的条目,越需要亲验**。

---

# 4 · 怎么用这份登记

1. **不要照它开工。** 每条都还没做方案合理性判断——**"v4 有"不是"我们该有"的理由**。
2. **要做某一条时**,先按 P3-1 §1.0 的判据重评:这个对象/能力在 v2s 侧有没有真实的查询、约束或用户任务在要它。
3. **几条可以顺手带的**(它们与已排的批次同区域,单独开成本反而更高):
   - `X13`(缺图提示)可随 P3-2 批次 2 的主列改造一起做
   - `X8`(标签筛选)可随 2-1 的标签能力落地一起做
   - `X14`(BOM 数量控件)可随 P3-2 批次 5 的 picker 接线一起做
   - ~~`P9` 是死代码,可以直接删~~ ⚠️ **这条建议已撤回,照做会删掉一条前端正在用的能力。见 §3.1**
4. **几条建议优先看**:
   - **`M12` audit_event** —— 这是**仓内不一致**,六个 owner 都有唯独 catalog 没有,不是"要不要跟 v4"的问题
   - **`X11` 分类计数口径不一致** —— 用户会直接看到"显示 3 点进去 17",而且是**已发布路径上的现象**
   - **`P4` 无上限 `string_agg`** —— 商品一多,导航响应会膨胀到不可用

---

# 5 · 边界

- 本文**只登记,不授权实施**
- 📗 标注的 v4 事实来自 `/Volumes/idea/catering-server-v4` 一手源码
- ⚠️ 所有 v2s 侧现状是 **2026-08-15 的快照**,而 Codex 正在改 `modules/catalog` —— **动手前当场复验**
- **已被工单覆盖的 22 条不在本文**,见 P3-1 / P3-2 两份工单与矫正批次
