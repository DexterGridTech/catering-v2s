# 商品域 · 缺陷栈与整改顺序 · **v3**

- **合并来源**:`2026-08-13-...-catalog-four-layer-conformance-checklist-claude.md`(**§9 / R2**)+ `2026-08-14-...-backend-code-review-findings-claude.md` 第三部分 + `...-triage-and-sequencing-claude.md` §4 + 本轮 v4 实证调研。
- **v1 → NO-GO(3M/6S/4N);v2 → NO-GO(3M/7S/5N)。两轮的 M 全部经 Claude 复核成立,本 v3 已吸收。**
- **本文不授权实施。**

---

## 0. 基准线(Dexter 2026-08-14 裁定,本版的最大变化)

> **一、长期主义,不看成本。二、代码干净、职责清晰、分工明确。**
> **三、v4 的建模贴近真实;v2s 要在逻辑关系与性能上超过它。**

**这三条推翻了 v2 的两处判断**:

- v2 的 D-4「真拆表只有 SKU 一处」——**作废**。它是拿成本当依据得出的(原文还引用了"JSON 装一组 key 被偏好"来撑),而那句话说的是**属性这类自由数据**,不是**有节点身份与唯一性的结构**。
- v2 通篇的"便宜的建模 / 昂贵的建模"分法——**拆掉**。成本不再是分批依据。

**唯一保留的否决理由是"无效",不是"贵"**。退役的那套控制面被砍是因为门全绿而功能是坏的,不会因本条复活。

**"性能超过 v4"有一个具体含义**:v4 靠**冗余落库 + 投影表 + outbox + 修复任务**换读性能(菜单侧把商品名/价格/编码/媒体全冗余一份,代价是商品改名后菜单陈旧,再拿一整套最终一致基建去兜)。**我们不走这条路,就只能靠正确的关系与索引**——因此该出 JSON 的必须出,留在 JSON 里就只剩冗余那一条路,等于退回 v4 的水平。

---

## 1. 证据分级

| 标记 | 含义 |
|---|---|
| **✅ 亲验** | Claude 本会话打开源码逐字确认 |
| **📗 v4 实证** | v4 调研打开 v4 源码/DDL 确认 |
| **⚠️ 推论** | 由事实推出,未直接验证 |
| **❓ 未验** | agent 报告,Claude 未独立确认 |

**v2 的两轮教训**:证据纪律本身合格(盲审抽查 8 条 ✅、4 条 📗 全部落地),**出问题的是在证据之上做裁定那一步**——五条裁定里两条理由不成立、一条论证不完整、一条支撑表格错。**故本版每条裁定后必须附「什么事实会推翻它」,且理由中不得以成本为唯一依据。**

---

## 2. 已裁定(每条附推翻条件)

### D-1 · 六条坏路先修,建模重做在后 —— **结论保留,支撑订正**

**订正**:v2 的表格写「`skus[].productSkuRef` 拆表后会消失 = 会」,**错**。owner 对它只要求能 parse 成 UUID、且不属于别的商品,**17 处引用中没有任何一处要求它解析到已存在的行**。**六条里依赖拆表的是 0 条,不是 1 条。**

**为什么顺序仍然成立(理由已换,不再是"用户今天点保存就坏")**:六条中五条的修法是**从字典选、提交 owner 给的真实 ref**——**那就是最终形态**,不随建模变化;第六条(新增 SKU)走 D-3 的后端铸造,**也是最终形态**。**先做它们不是止血,是先做那些不会被后续重做的部分。**

> **推翻条件**:若发现六条中任一条的正确修法会随建模结构改变,该条应移到建模之后。

### D-2 · 编码占用的判据是「关系是否已迁移到不透明 ref」,不是「状态是什么」 —— **v2 版本已撤回重裁**

**v2 的 D-2 被证伪**:它称"作废的前提是已确认无 blockingReferences 与 dependentFacts"。实测 ✅:

```java
:1145  voidAvailability.putArray("blockingReferences");   // 建了数组,全段无 addObject —— 恒空
:1144  canVoid = !ARCHIVED/VOIDED && !hasItemDependencies(row)
:1744  hasItemDependencies(row) 读的是 row.sectionsJson() —— 本商品自己的 skuCount/identifiers/inventoryBom/productionTags/skus
```

**`blockingReferences` 恒空是空真;`hasItemDependencies` 答的是"这个商品里有没有东西",不是"有没有人引用它"。** 而且按该判据,**任何有 SKU 的商品都不能作废**。真正的守卫在 `TransitionOperationsCatalogItemStatusOperation`,v2 指错了代码。

**重裁**:判据改为**关系是否已迁移到不透明 ref + 下游持有的是不是快照**。

- 仓内先例:`V20260808_140000_000` 注释原文——**先把关系挪到不透明 ref,再允许业务编码复用**;
- inventory 侧**已经挪完**(`item_ref` / `product_sku_ref` NOT NULL,唯一索引重建在 ref 上),`item_code` 那条迁移自陈 "only as read labels";
- 下游快照持有的是**冻结的编码副本**,不是活引用。

**结论:`VOIDED` 与 `ARCHIVED` 都可释放编码**,部分唯一索引写成 `WHERE status NOT IN ('ARCHIVED','VOIDED')`。

**这同时解掉 v2 造出的一个泄漏** ✅:`promotionExecute:1529` **每次临时商品转正都把它置为 `ARCHIVED`**,而临时商品来自外部订单渠道、是生成频率最高的编码族。按 v2 的 D-2 它们永久占用、按 `:1144` 又永远走不到释放通道——**v2 用两条裁定在最高频编码族上造了永久泄漏**。

> **硬前置(不做会上线数据错乱)**:`requireItem` → `loadItems` 是 `WHERE code IN (...)` **不带状态谓词**,然后 `rows.get(0)`。同码两行时返回哪一行不确定。**至少 6 处按编码查询必须逐个审完再加索引。** v2 把这件事写成"两条 SQL"是错的。
>
> **推翻条件**:若发现任一下游持有的是**活引用而非快照**(例如某处按 `item_code` 做 join 而非展示),则该状态不得释放。已知待查:`source_item_code` 血缘字段(当前从不被 SELECT,属潜伏)。

### D-3 · 新增 SKU 由**后端铸造** ID,按 `skuCode` 关联包内引用 —— **v2 的"前端铸造"已撤回**

**v2 推荐前端铸造,理由是"后端铸造则客户端无法在同一请求内引用新 SKU,只能两次往返"——该理由已被证伪** ✅:保存请求里引用 SKU 的**四处全部同时携带 `skuCode`**:

```
catalogDraft.skus[]                          → productSkuRef, skuCode, ...
catalogDraft.compositeGroups[].components[]  → productSkuRef, skuCode, ...
catalogDraft.inventoryBom[]                  → productSkuRef, skuCode, ...
inventoryConfiguration.nodes[]               → productSkuRef, skuCode, ...
```

**关联键本来就在包里**,而且仓内**已有 skuCode → ref 的解析逻辑**。后端完全可以在一个事务里铸 ID 并对上全部包内引用。

**目标形态**:`productSkuRef` 改为**可选**——**带了 = 已有 SKU,按 ref 匹配;没带 = 新 SKU,后端铸造**。`skuCode` 只作数据,不作身份。

**为什么不能只按 `skuCode` 关联**:用户把编码从 `M` 改成 `MED`,若只有 skuCode,后端看到的是"`M` 没了、`MED` 是新的" → 归档旧 SKU 并新建 → **库存余额挂在旧 ref 上直接悬空**。**已有 SKU 必须带 ref,这是"改名"与"删一个建一个"唯一的区分手段。**

> **推翻条件**:若某个包内引用点**不携带 `skuCode`**,后端就无法关联该处的新 SKU,需为该处补关联键或退回客户端铸造。

### D-4 · 拆表范围 —— **v2 的"只拆 SKU 一处"作废,改为逐对象定价后再定**

**作废理由**:v2 的结论是拿成本得出的,且**从未给 `categoryRefs` 的反查定过价**——分类树查询对每个分类跑三遍全品牌商品扫、每行 `jsonb_exists`,而 `catalog_item` 上除主键与唯一约束外**只有一个索引、全仓零 GIN**,且**每次开页与每次切品牌都跑**。这比 M-03 影响面大得多(那条只影响保存,这条影响每一次读)。

**新判据**:**有没有外部查询从它那头打进来**(唯一性、反查、列表过滤排序、外键完整性)。有 → 出 JSON;没有 → 留 JSON。**成本不参与判定。**

逐对象结论见 §5.3。

> **推翻条件**:某对象若能证明"外部查询"实际不存在或可被现有索引服务,则不拆。

### D-5 · 并发单位是**整商品**;`version` 落到 SKU 行但不作并发令牌

**理由(非成本)**:值得拆表的那几条不变量本身是**商品级**的——"每商品至多一个默认 SKU""同商品内变体组合不重复""SKU 定价时每个启用 SKU 有价"——只拿着一行 SKU 谁也判不了。写接口就是商品形状(整包 + 单个 `expectedCatalogVersion`)。

**反例佐证**:`expectedInventoryVersions` 确实是逐 target 版本列表,但那是因为库存对象**有第二个写者**(出入库);SKU 没有第二个写者。**这个类比是反对逐 SKU 版本的证据。**

**落地形态**:版本仍在 `catalog_item`,任何 SKU 写入 bump 商品版本,锁点收敛到 `item_ref` 单行 `FOR UPDATE`——**比今天的全品牌 `FOR KEY SHARE` 严格更窄,收益就在这里**。

**⚠️ 现存字段的性质要纠正**:今天的 `skus[].version` 是**客户端写什么回显什么、owner 从不递增**的字段(新建即 `version: 0`)。它是一个长得像 owner 事实的客户端可写值。

> **推翻条件**:若 SKU 出现第二个写者(例如菜单侧直接改 SKU 挂牌价),则并发单位需重议。

### D-6 · 库存配置照 v4「商品页只读、库存域独写」;资产按 workspace 隔离、物理对象跨 workspace 去重

(早前裁定,详见 §7.4 与第二部分文档。)

---

## 3. 契约层

### 3.1 五条漂移 ❓(盲审当场判定,Claude 未逐条复核)

`X-06` `smartViewKey`:**契约有 owner 不认 4 个,owner 有契约没有 5 个**,`default -> 422` · `X-07` `CatalogItemPageQuery` 无 `tags`,而 IA 三处要求标签筛选 · `X-08` `orderOptions.values` item 级 6 字段、**根级 5 字段(缺 `attributeValueRef`)**,两处都无 min/max、小票后厨名、状态、排序 · `X-09` `CatalogItemDetail.data.item` 无 `materialRole`(同一份契约另外三处**存在**,纯遗漏) · **`X-14′` 契约把 `smartViews.label` 声明为 required,而 owner 从不 put——owner 违反自己的契约输出必填字段**。

### 3.2 `format: uuid` 缺口 = **0** ✅(v2 的"18"结论错了)

标量 `*Ref` 共 **387** 个,缺 `format: uuid` 的 **18** 个——**但这 18 个全是 `externalIdentity.sourceOrderRef / sourceRecordRef / sourceItemRef`**(6 属性 × 3 文件),**第三方平台标识**,owner 用 `copyOptionalText` 原样透传、从不 parse 成 UUID。**给它们加 `format: uuid` 是错的。真实剩余缺口为 0。**

### 3.3 判据

| 判据 | 反例 |
|---|---|
| 任一枚举值不得只出现在契约/owner/前端三方中的两方 | 修完仍有单方独有的值 |
| 契约声明 required 的字段,owner 必须实际输出 | 存在 required 却从不 put 的字段 |

---

## 4. 解码层

**至少五处丢弃 owner 事实** ❓:`tagRefs`、`salesUnitRefs`、`sourceRef` + `targetRef`、`smartViews.label`、`actionAvailability.reasons`。

**⚠️ 一处归因撤回**:v1 称"复制预览只显示目标"的根因在解码层——**不成立**。复制抽屉直接用生成契约类型、**不经解码层**,渲染层同样只读 target,是独立成因。owner 另发的 `mappingPreview{fromCode,toCode}` **根本不在契约里**,那才是"来源可读"的真正载体。

**📗 v4 对照**:v4 在 **BOM 层**做了成对展示(来源 owner / 目标 owner / 目标库存对象 / 匹配方式)+ 四类分档,**未匹配或被阻断的行必须处理或显式跳过才能提交**。item 级字段 diff v4 也没有,且它最终预览页**没读后台给的 source/target 对**。

---

## 5. 建模层(**按 §0 基准整个重写**)

### 5.1 缺陷事实

| # | 缺陷 | 级别 |
|---|---|---|
| **M-10** | `sections` 是客户端可写任意键的无界 JSONB;DB 层零约束,写入全量透传 | ✅ |
| **【新】保存不做集合调和** | `saveItem` 把 `sections` **整体覆盖**。删除是**静默事件**——零比对、零归档、零引用检查。**这是"删 SKU 让库存对象悬空"的上游**:不是漏了检查,是**根本没有"删除"这个动作可供检查** | ✅ |
| **S-01** | `firstText` 26 处传 ≥2 候选键;**仍相反的一对是 `:2225` ↔ `:2694`**(v2 写的 `:2264`/`:2732` 是错的;且 `:2690` 读的是另一棵子树,不构成对) | ✅ |
| **S-01 已修** | 指纹处已改 `skuCode` 优先并有合格反例测试 | ✅ |
| **S-01 框定更正** | `selectionMode`/`selectionRule` 读的是两棵不同子树、输出字段名与默认值都不同,**不算同一对象** | ✅ |
| **M-03** | 商品保存对整个品牌加锁并解析全 scope JSONB | ✅ |
| **M-04** | 分页静默截断第 5001 项,截断传播到 inventory 与 production 协调 | ✅ |
| **M-09** | 局部复制 9 个 section 选项 **7 个静默空操作**,`skipped` 恒空 | ✅ |
| **S-11a** | 作废编码永久占用 | ✅ |
| **S-11b** | 裸 `ON CONFLICT DO NOTHING` 把空操作报成 `{"status":"COMMITTED","version":0}` | ❓ |
| **S-14/S-15 catalog 部分** | 循环里发 SQL、OFFSET 分页 | ❓ |
| **【新】分类树查询** | 每个分类跑三遍全品牌商品扫 + 每行 `jsonb_exists`;`catalog_item` 上**只有一个索引、全仓零 GIN**;**每次开页与切品牌都跑** | ❓ |

### 5.2 两个现在就在漏的洞 ✅

**删 SKU 让库存对象悬空**(引用保护只覆盖 asset 与字典条目)· **item 内 skuCode 唯一性被迁移脚本隐式依赖**(`INTO STRICT` + `TOO_MANY_ROWS`)而库内无约束。

### 5.3 拆表范围 —— 逐对象定价(D-4 的落地)

**判据:有没有外部查询从它那头打进来。成本不参与。**

| 对象 | 📗 v4 怎么做 | 📗 v4 错在哪 | **我们要好在哪** | 拆 |
|---|---|---|---|---|
| **SKU** | `catalog_sku` 表 + 三条部分唯一索引 | 引用守卫**漏了库存对象、套餐组件、BOM 节点**三个源 | 拆表,**并补全那三个源** | **拆** |
| **分类关系** | 商品挂 `category_id` 单值 + 分类表 | 单值,表达不了多分类 | 拆**多对多关系表**,消灭 `jsonb_exists` 全品牌扫 | **拆** |
| **下单选项 / 选项值** | 两张表 + `status <> 'ARCHIVED'` 部分唯一索引 | — | 照做 | **拆** |
| **组合商品** | `catalog_composite_structure` **一张扁平表** | **组级事实(组名/选择规则/min/max)重复写在每行组件上,有更新异常**——改组名要更新 N 行,漏一行就分裂 | **拆成 group + component 两张表**,消灭更新异常。**这是明确要超过 v4 的一处** | **拆** |
| **生产提示** | `catalog_preparation_profile` 表,但 `unique(catalog_item_id)` **每商品单例** | 粒度不足,多 SKU 配不了不同制作提示 | 拆表 + `node_type + target_ref` —— **抄 v4 BOM 的形状,超过 v4 profile 的形状**(两张表在同一个迁移文件里前后相邻) | **拆** |
| **识别码 / 条码** | `catalog_identifier` 表 + `unique(目录,类型,值)` | 用 `sku_id IS NULL` 与 `scope` **两处编码同一事实**,必然漂移 | 拆表,**只用一种编码方式** | **拆** |
| **SKU ↔ 属性值关联** | `catalog_sku_attribute_value` 表 + `unique(sku, attribute)`,**同时存 `value_code_snapshot` / `value_label_snapshot` 两个冗余列** | **存了标签快照** —— 改名后陈旧,与它菜单侧冗余落库是同一个病 | 拆关系表 + `unique(product_sku_ref, attribute_ref)`,**但不存标签快照,直接 join**。**理由是职责不是省空间**:冻结历史标签是**订单域**的事(v6 明写订单行必须冻结商品快照),商品域存快照等于替下游做了它自己该做的事,还做错了——**商品域的快照永远不知道该在哪个时间点冻结** | **拆** |
| **商品用哪几根变体轴**(`skuVariantDimensions[]`) | `catalog_item_sku_variant_dimension` 表 + `unique(item, sales_attribute)` | — | 照做。**同一根轴不能挂两次(唯一性)、轴的先后决定 SKU 矩阵怎么展示(排序)——两条现在都在 JSON 数组里没有约束** | **拆** |
| **属性字典本身**(口味 / 甜 / 辣) | 独立注册表两张 | — | ✅ **v2s 已经是表**(`catalog.dictionary_entry`,`dictionary_kind` 区分 `SKU_ATTRIBUTE` / `SKU_ATTRIBUTE_VALUE`,唯一键 `(data_node_ref, brand_ref, dictionary_kind, code)`)。**跨商品复用能力本来就有;用户感觉"每次要新建"是因为前端没给选择器**(即六条坏路第 2、3 条),**修法是给选择器不是拆表** | **不动** |
| `productionProfiles` 的自由内容、`attributes` | — | — | 只被"已拿着这一行"的路径读,无唯一性无反查 | **不拆** |

**v2 的"生产提示走 JSON map"撤回**:那是拿"JSON 装一组 key 被偏好"当挡箭牌得出的,而那句话说的是**属性这类自由数据**,不是**有节点身份与唯一性的结构**。

### 5.4 SKU 拆表的必备条件 ❓

`R1` `product_sku_ref` 主键、与 `sku_code` 解耦、终身不变 · `R2` 归属可一次查询验证并建索引 · `R3` 软归档 + 引用保护(**现在就在漏**;📗 v4 从不物理删只归档,但守卫漏三源,**我们要补全**)· `R4` `version` 落行但不作并发令牌(D-5)· `R5` item 内 `sku_code` 唯一(**已有迁移在依赖**)· `R6` 单一默认 SKU · `R7` 变体组合唯一 · `R8` **`attributeValueRefs` 关系化 —— 已定,拆**(Dexter 2026-08-14:属性跨商品复用,不能每次让用户新建)。**触发它的不是复用本身**(复用已由字典表满足),**是复用的必然后果**:字典里"甜"改名后,每个 SKU 的 JSON 里那份 `valueLabel` 快照原地不动全变陈旧,且**"哪些 SKU 用了这个属性值"只能全表扫 JSONB**——停用前想知道还有没有人在用同样无解。**这就是此前一直悬着的"按属性值反查 SKU"的实际需求** · `R9` 价格列可空并与 `priceGranularity` 绑定 · `R10` **稳定排序键**(契约里无 `displayOrder`,从数组拆成行必失)· `R11` 不给 `skuBarcode` 建唯一索引 · `R12` 加 `benefit_participation` 列 · `R13` 按 owner scope 分区索引。

**⚠️ 不得触碰的边界**:迁移注释原文 `-- Cross-owner references are typed values, not cross-schema DML or foreign keys.`。同 schema 内 FK 不受影响,**但不要建 `inventory → catalog` 的跨 schema 外键**。

---

## 6. 提交层(顺序最前)

### 6.1 六条坏路 ✅

| owner 要求 | 前端提交 | 正确修法 | 依赖拆表 |
|---|---|---|---|
| `productionTagRefs` | 丢弃契约给的 `tagRef`,只取 `code` | 用 owner 给的 ref | 否 |
| `skuVariantDimensions[].attributeRef` | 空串 | 从字典选 | 否 |
| `dimension.values[].attributeValueRef` | 空串 | 从字典选 | 否 |
| `skus[].productSkuRef` | 空串 | **后端铸造(D-3)** | 否 |
| `skus[].attributeValueRefs[].attributeValueRef` | 空串 | 从字典选 | 否 |
| `orderOptions[].values[].attributeValueRef` | `crypto.randomUUID()` 伪造 | 从字典选 | 否 |

另加 `tagRefs` / `salesUnitRefs` 前端从不提交(字段永远为空)。

**⚠️ 库存分类筛选那条的机制**:前端在 `useMemo` 内、**无 try/catch** 调 `wireUuid(categoryRef)`,而筛选项标题写着"商品分类**编码**"——用户按提示填编码,**`wireUuid` 在渲染期抛,请求根本发不出去**,不是 422。

### 6.2 现在多了一层伪装 ✅

`draftUuid`(本轮新增,9 行 10 处)是无校验强转。**`wireUuid` 本身是校验的**(foundation 版会抛 `WIRE_UUID_REQUIRED`)。

两条加重:`draftUuid` 的注释("drafts 只在组装请求时由 `wireUuid` 校验")**是假的**——提交路径原样赋值不经校验;**1.2 引入一条新回归**——`productionTagRefs` 过 `wireUuid` 而下拉 `value: tag.code`,**浏览器里抛后被 catch 成 `NETWORK_ERROR` 文案**,用户被告知"网络错误",实际是客户端校验 bug。

**⚠️ 关键**:生成 TS 现在是 branded 的,**没有 `draftUuid` 的话 `attributeRef: ''` 就是编译错误**。它恰好是把 generator 刚关上的编译期门重新撬开的那一手。

### 6.3 判据

| 判据 | 反例 |
|---|---|
| **先摘掉 `draftUuid` 让六条重新编译不过** | 在其上继续叠加适配 |
| 用户选择域对象时提交 **owner 给出的 ref** | 仍从 `code` 推导,或用 `randomUUID()` 造 |
| 新增 SKU 由**后端**铸 ref | 前端仍自己生成 |
| 不再有任何 `*Ref` 由**自由文本输入**填充 | 存在让用户手打 UUID 的输入框 |
| 每条都有**修复前是红的**端到端用例 | 修复前即绿 |

---

## 7. 控件层

### 7.1 继承自 R2 ❓(未对当前树复核)

B-13(基础资料 IA 要 12 项、实现 3 项)、F-06(生命周期按钮门控)、F-35(409 无重载入口、草稿全丢)、F-43(把契约话术展示给终端用户)、F-57(引用重写预览名不副实)、F-61(启用无激活校验),以及手打编码、裸枚举约 55 处、级联缺失、字段集残缺。

**【v2 遗漏,本 v3 补回,两条在源清单里都是 M、今天都可复现】**
- **F-39 生命周期无二次确认**:启用/停用/归档三处全是直接 `onClick`,全文只有一处 `Modal.confirm`(给作废用);
- **F-34 幂等键现场生成**:状态转换(含作废与归档)、分类增删改移、字典改名/改状态/作废,**每次重试都 `crypto.randomUUID()`**,整个 drawer 只有 1 处 `getIdempotencyKey`。

**最清楚的分界线:owner 驱动的级联全对,前端草稿内的级联全缺。**

### 7.2 本轮亲验 11 条(成立 8 / 不成立 3)

**推翻三条**:字典分页"数据破坏"(后端无 LIMIT、cursor 恒 null,reorder 对残缺集合一律 422,**前提不可达**)· `orderOptions` 双分支优先级相反(两分支**源自同一 section、经同一投影函数**,恒等)· smartViews label 被硬编码替代(**owner 从不发 label**,按原建议修**会让左树标题全变空**)。

**成立但需限定五条**:候选列表无分页(**封顶在 owner 侧**,生产标签**无关键词逃生口**,第 101 个永远选不到)· 解码层丢 sourceRef/targetRef(归因撤回)· 生产提示无法逐实例("须动契约"撤回——读写契约每层都是开放 map)· quickManage 违反 IA(surface 实际独立,**S 降 N**)· manifest 静默回落(回落集合与权威集合当前相同,**S 降 N**)。

**原样成立两条**:标题区缺治理与来源徽章 · **复合主列缺短名(升 S)**——**主列根本没用 `NameCodeText`** 而同文件分类树用了;用户用短名搜出一批行却**看不到任何命中理由**。

### 7.3 📗 v4 可直接抄

标题区**四徽章**(状态/治理/来源/形态)且**全部用后台下发的中文标签** · 停用项在选择器里的处理(`include: isActive || 当前已选` + `disabled` + 「(已停用)」后缀) · 套餐组件候选的真分页 + 全文搜索(⚠️ **前提是有可索引的搜索列**,不要在没索引时抄 SQL 形状然后声称"已分页")。

### 7.4 📗 v4 明确不要抄

**`blockedActions` 死脚手架**(契约/投影列/前端消费方全齐,写入点硬编码 `'[]'`,前端所有"是否被阻断"恒为 false——"看起来有保护"的最坏形态) · **商品级归档零引用检查**,而确认框写着"仍被使用的商品会返回失败原因"(**文案与实现直接冲突**)。**v2s 在商品级与字典级反而比 v4 严,不要为抄 v4 而弱化。**

---

## 8. 局部复制(📗 v4 最值得参照的一块)

**v2s 现状**:9 个 section 选项 **7 个静默空操作**(`SKU_STRUCTURE` 映射到从没人写过的键)。

**v4 九个 scope 按 owner 边界切**(BOM 拆主商品/SKU/选项值三层),四件**缺一不可**:依赖与形态适用性是**后台硬校验**(选 SKU 扣料没选 SKU 结构 → 422)· 先给所有子实体**铸新 ID 建全量映射表**再重写 · 任何解引用失败**立刻抛**,跨 owner 的库存对象**需用户显式匹配不能自动猜** · **补发 `NONE` 规则清理目标残留**(没有它分不清"没配"和"明确清空")。

**⚠️ 不要抄** `PRINT_DISPLAY_NAMES`——v4 为自己打印规则历史包袱服务的横切 scope,v2s 无对应域。

**判据**:section 选项**必须与 owner 实际写入的键集对齐**;`has(key)` 为假必须写进 `skipped`,**空操作必须变响**。

---

## 9. 整改顺序

```
提交层六条坏路          五条=从字典选,一条=后端铸 ref。都是最终形态,不随建模变化
   ↓
摘掉 draftUuid,把 generator 那道编译期门重新焊死
   ↓
失败必须可见            M-04 / M-09 / S-11b
   ↓
契约层五条漂移          不得只改一方
   ↓
解码层 / 控件层(含补回的 F-34、F-39)
   ↓
建模重做                集合调和 → 编码释放(先审 6 处按码查询)→ 逐对象拆表(§5.3)
   ↓
M-03 全品牌加锁自然消失
```

**为什么建模在后而不是在前**:六条的修法不随建模变化(见 D-1)。**不是因为建模贵——成本不参与排序。**

---

## 10. 本文不含哪些商品域条目、去了哪里

M-11 / MinIO 超时 / SCOPE_FORBIDDEN 传 cause / 字典重排加锁 → **第零批,已实施** · M-02 全表扫、M-12【1】资产跨租户、M-01 事务改造 → **第二部分**(M-02 的 GIN + `@>` 建议**已作废**:四种形态,一个 `@>` 只能表达一种,按字面实现会把 fail-safe 变成误释放)· S-14/S-15 **非 catalog** 部分 → 第二部分 · 格式/split package/扩展名/命名 → 第一部分收尾批 · 字典排序"作废是锚点"规则 → **已被移除**(全仓零命中,并有测试 `keeps VOIDED dictionary entries in the same reorderable sequence`,方向与 v4 一致)。

**【v2 遗漏,本 v3 补入,均有 catalog/inventory 实例】**:S-03 阈值格式错误致低库存告警静默 · S-04 故障注入 header 随生产二进制发布 · S-06 coordinator 遗留门面死代码 · S-12/S-13 冗余死索引与版本化迁移的 `IF NOT EXISTS`。**纠正一条**:S-13 点名的"最危险一处"约束名 59 字符、在 PG 63 字节上限内且与生成规则一致,**该处是安全的**。

---

## 11. 未验与授权边界

**⚠️ 最需要被攻的**:D-2 的重裁依赖"下游持有的是快照而非活引用"。**已知待查:`source_item_code` 血缘字段**(按编码写入,当前从不被 SELECT,属潜伏)。**若存在任一按 `item_code` 做 join 而非展示的路径,D-2 塌。**

**其余未验**:契约层五条为盲审判定 · 解码层五处、控件层 R2 继承条目未对当前树复核 · R1–R13 只抽查 R3/R5/R10/M4 · §5.3 的逐对象定价**只有分类关系一处有实测支撑**,其余为 📗 v4 对照 + ⚠️ 推论 · v4 结论全部静态阅读,**未起容器未跑测试** · 89 IA-ID 分母未复核 · **工作树带大量未提交改动,上游两份文档的行号已大面积漂移**,凡引用它们的 ❓ 条目在复核前只能当线索。

本文只给缺陷事实与验收判据,**不给修法,也不授权实施**。范围与时机由 Dexter 裁定。
