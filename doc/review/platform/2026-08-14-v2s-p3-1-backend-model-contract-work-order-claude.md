# P3-1 工单 · 数据库 · 后台模型 · 契约

本文替代 `2026-08-14-v2s-part-three-work-order-claude.md`,该文作废(条目不全、无 P3-1/P3-2 划分、无 seed、测试只写方向)。
前端与 IA 部分见 P3-2,本文不含。

> **⚠️ 数据可以清库(Dexter 2026-08-14 裁定)。** 本轮**不需要为存量数据做迁移**——
> 拆表、加约束、改字段一律**不写回填脚本、不写兼容读路径、不留双写期**。
> 迁移只负责把结构改成目标形态;数据由 seed 重建。
> **凡是为"存量数据怎么办"而增加的复杂度,一律不做。**

> **⚠️ 先读 §12。** 三条裁定(枚举标签后台下发 / picker 数据源 / SKU 矩阵引擎照 v4)各自都要改契约,
> 所以它们从 P3-2 挪进了 P3-1。**§12 是 P3-1 范围的一部分,不是附录。**
> §1–§11 未因此改动,已完成的部分不作废;§10 去向表与 §11 对照表已同步。

## 本文的写法(先读这一段)

没有 Codex 详设这一环,所以本文就是详设。但**不写"怎么改"**——我写过四条修法,四条全错,原因都是我没打开代码就写。
改用三样东西锁形态,它们合起来比修法更严:

| | 作用 |
|---|---|
| **不变量** | 改完之后哪些**结构**必须成立。不说怎么做,但排掉一整类错形态 |
| **拒绝形态** | 明确不接受哪些做法 + 理由。**负空间是我最可靠的部分** |
| **判别性测试** | 只有正确形态才能通过的用例。**测试是形态的载体**——写死了用例就等于写死了形态 |

### 四类内容必须分清(**前四轮全部的 M 都出在这里**)

四轮复审共 25 条 M。事后看,它们不是散的——**几乎全部来自把下面四类东西混成一类**,
相邻且同名的对象被当成同一个对象:

| 类别 | 标记要求 |
|---|---|
| **当前仓内事实** | 必须有精确源码落点(文件 + 方法/行/字段名),标 ✅ |
| **产品裁定** | 必须标明是**新加的规则**、适用的 manifest shape、以及**业务后果**理由——**不得用命名论证** |
| **待建能力** | 必须标"新增",并写清它跨越的 owner / 契约边界与量级 |
| **未来验收** | 必须标明依赖哪项尚未获得的授权,且**不计入本轮完成分母** |

**开工判据是这五条,不是继续加行数:**

1. 声称已存在的类型、接口、operation、编号,**都有精确源码落点**
2. 待建能力**明确标为新增**,并写清跨越的边界
3. 每条 acceptance scenario **只有一个发现键**,真实 HTTP 调用列表单独列
4. 每个产品规则**标注适用的 manifest shape**,不把命名当证据
5. 每个生成 / 政策分母**都有 before/after ID 映射**

**DDL、契约字段、约束**写死(走偏代价太大,且我能亲验)。**方法内部实现不写。**

### 测试通则(每条用例都适用)

1. **夹具必须走真实写路径**(HTTP / owner command)。**禁止直接 INSERT 造夹具**——直接造能造出用户造不出的状态,测出来的绿是假的
2. **正负成对**。单条正向或单条负向都能被错误实现骗过
3. **每条用例必须写明"挡住哪种错误实现"**。说不出来的用例,就是测不出健壮性的用例
4. **"修复前是红的"指行为红**,不是注解存在性红、不是索引名存在性红
5. **每条用例必须写明挡不住什么**
6. **每条不变量必须至少被一条用例的某一条断言点名。** 没有用例的不变量等于不存在——它会被读成注释。对照表见 §12,对不上的要么补用例,要么降成"建议"并写明为什么测不了
7. **夹具必须在本批的约束生效之后才构造。** 如果某条用例的夹具在本批改动前造不出来(被现行约束挡住),那条用例就属于本批之后,不能标成"先做"

### 证据标记

✅ = 本轮我亲自打开源码确认 · ❓ = 来自独立抽取/盲审,Codex 动手前请自行核实 · 📗 = v4 对照,已亲验

---

# 1 · 建模拆分

## 1.0 判据(先立,后面每条都受它约束)

**一个对象该从 `sections` JSON 里拆出来,满足下面任一条即可:**

**判据甲 · 外部查询打进来** —— 唯一性需 DB 保证 / 反查"谁引用了我" / 列表过滤排序 / 引用完整性 / 并发粒度。

**判据乙 · 它必须被别的行引用,因此必须有身份** —— **不管有没有外部查询打进来。**

> ⚠️ **判据乙是本轮补的,补它的代价是 §9 里一条撤回被反转。**
> 前一版只有判据甲,于是"下单选项 / 选项值"因为自身零反查被撤回。
> 但实施时发现:`orderOptions[].values[].attributeValueRef` 这条关系**需要一个归属者**,
> 而 **JSON 路径不是能放进外键的归属者**。用 `groupCode` 当归属者更糟——**这个仓刚被"编码当身份"坑过一次**
> (inventory 侧那四处 `item_code` JOIN)。
> **判据甲测的是"谁来查我",判据乙测的是"谁来指我"。少了后者,任何嵌套关系都会在拆表时无处安放。**

**只被"整条读出来渲染"的对象不拆。** 成本不参与判定,反查存在性参与判定。

**前一版工单列了七拆,其中三行(下单选项、生产提示、识别码条码)在 v2s 侧找不到任何反查,已撤回**——见 §9。

> **关于"走索引 / 不再全表扫"这类判据的诚实限定(全节适用)**
> 本工单的用例都是 HTTP 级的,**它们能证明"不再走原来那条 JSON 全扫 SQL",证明不了"新查询用上了索引"**。
> 所以:**HTTP 用例的验收判据一律降为结构性断言**(不出现某条 SQL / 计数来自关系表);
> **"走索引"这一半必须由 `EXPLAIN` 加足量造数单独补证,它是该不变量的必要证据,不是可选项。**
> P3-1 收尾时逐条跑,跑之前不得声称性能不变量已达成。

## 1.1 五处拆分

每处都附了 v2s 侧**今天在扫什么**。给不出这一栏的不拆。

### A · `skus[]` → `catalog_sku` 实体表

**缺陷事实** ✅

`CatalogOwnerService.skuOwnerByRef` 每次商品保存执行:

```sql
SELECT item_ref, sections::text FROM catalog.catalog_item
WHERE data_node_ref=? AND brand_ref=? AND status <> 'VOIDED' FOR KEY SHARE
```

**对整个品牌逐行加锁并 detoast 全部 JSONB,只为回答"这个 ref 属于谁"。** 紧接着在 Java 里循环**模拟唯一约束**。

`inventory.stock_target.product_sku_ref` 已是 UUID 列,catalog 侧**无行可指**。

**不变量**

1. `product_sku_ref` 是主键,与 `sku_code` **解耦**,终身不变(改编码不换 ref)
2. 归属(SKU 属于哪个商品)**一次查询可验证**,且走索引
3. 同一商品内 `sku_code` **唯一**,由数据库约束表达 ❓ 已有迁移用 `INTO STRICT` 隐式依赖该唯一性,而库内无约束
4. 同一商品内**变体组合唯一**——不能存在两个"大杯+热" ❓
5. 每商品**至多一个默认 SKU**,由约束表达 ❓
6. SKU 有**稳定排序键**。契约里现在没有 `displayOrder`,从数组拆成行必然丢顺序 ✅
7. 软归档,**不物理删**;归档前做引用检查
8. ~~`version` 落到 SKU 行但不作并发令牌~~ —— **本条删除。** ✅ 全仓**零个含 `Sku` 的 operation**,SKU 只能随整商品保存,该不变量在真实 owner 路径上**不可观测**。并发语义由商品级 `expectedCatalogVersion` 承担。将来引入独立 SKU 写命令时再重新定义
9. **同一商品内 `productSkuRef` 不重复。** ✅ 现行 `validateCatalogRelationRefs` 只做跨商品归属校验,同商品内两条 SKU 共用同一 ref 会通过,而库存唯一身份依赖该 ref

### 引用保护的封口不变量(**订正:不能从 schema 猜**)

**枚举已经连败两次**:📗 v4 的 `CatalogSkuReferenceGuard` 枚举三张表漏了三源;本工单前一版枚举 `stock_target` 漏了 `stock_bom`。所以封口的不是清单,是**清单的完整性本身**。

> ⚠️ **订正**:前一版写"从 schema 派生"。**做不到。**
> ✅ 这些 UUID 列**没有跨 schema 外键**(迁移里明写 `Cross-owner references are typed values, not cross-schema DML or foreign keys.`),
> 数据库 metadata **判不出某一列指向的是商品、SKU 还是字典值**。靠 `*_ref` 命名去猜,是拿命名当证据——本工单已经因为这个塌过。

**订正二:承载它的机制早就存在,不要新建。** ✅ `contracts/policy/catalog-inventory-reference-path-matrix.json`,
`policyId = CATALOG_TYPED_REFERENCE_PATH_MATRIX`,状态 `DEXTER_ACCEPTED_20260808`。它每条 entry 已含:

| 已有字段 | 承载什么 |
|---|---|
| `storage` | 表.列(如 `catalog.catalog_category.parent_category_ref`) |
| `objectType` | **目标实体,显式声明**(如 `CATALOG_CATEGORY`)—— 正是"不得从列名推断"那一条 |
| `sourceLookup` | 含 scope 轴(如 `scoped by data_node_ref+brand_ref`) |
| `owner` · `jsonPath` · `legacyCodePath` · `readProjection` · `writeConsumers` | 其余上下文 |

> 我上一版"提出"的新机制,**和这份已接受的声明形状几乎一样**。这是同一类错的第三次:
> 上一轮是**声称有源而实际没有**(§12.1 的枚举派生),这一轮是**发明了一个已经有的**。两次都是没打开仓就做结构性断言。

**订正三:不是"补",是"替换"。** ✅ 现有 `R13` / `R14` 的 `objectType` 是复合值 **`CATALOG_ITEM_OR_PRODUCT_SKU`**,
`storage` 正是 `inventory.stock_target` 与 `inventory.stock_bom`。**复合类型答不了 A-6 的按目标实体比对**,
而复合 entry 与细粒度 entry 并存会重复且歧义。

**所以:把 `R13` / `R14` 替换成五条单列 entry**(两张表五列,目标实体分别是商品 / SKU / 字典条目)。

### 替换的 before / after 编号映射(**必须写死,否则实施者不知道用什么编号**)

✅ **当前 17 条 entries 的实际编号是 `R01`–`R14` 加 `C01`–`C03`(三条反例)。不存在 `R15`–`R17`。**

> ⚠️ 我上一轮从"总数 17、门只数 R01–R14"推出"多出来的三条是 R15–R17",**把推论当事实用了**。
> 那三条是 `C` 前缀的反例条目,**不参与 R 分母**。

**after 映射:`R13`/`R14` 退役,五条单列 entry 取 `R13`–`R17`**

> ⚠️ **`objectType` 必须写字面值,不能写中文描述。** ✅ matrix 现有取值是
> `ASSET` · `CATALOG_CATEGORY` · `CATALOG_ITEM_OR_PRODUCT_SKU` · `CATALOG_TAG` · `PRODUCTION_TAG` ·
> `PRODUCT_SKU` · `PROVENANCE_LABEL` · `SALES_UNIT` · `SKU_ATTRIBUTE` · `SKU_ATTRIBUTE_VALUE` · `STOCK_TARGET`。
> 前一版写"商品 / SKU / 字典条目",**那不是可执行的值**——尤其"字典条目"会被实现成错误的泛化类型,
> 真实值是 **`SKU_ATTRIBUTE_VALUE`**(BOM 的 `option_value_ref` 在 inventory 侧就是按这个映射的)。

| 新 ID | `storage` | `objectType`(字面值) |
|---|---|---|
| `R13` | `inventory.stock_target.item_ref` | **`CATALOG_ITEM`** ⭐ |
| `R14` | `inventory.stock_target.product_sku_ref` | `PRODUCT_SKU` |
| `R15` | `inventory.stock_bom.item_ref` | **`CATALOG_ITEM`** ⭐ |
| `R16` | `inventory.stock_bom.product_sku_ref` | `PRODUCT_SKU` |
| `R17` | `inventory.stock_bom.option_value_ref` | `SKU_ATTRIBUTE_VALUE` |

⭐ **`CATALOG_ITEM` 是本批新引入的取值。** ✅ 现有 matrix 里没有它——被拆掉的 `CATALOG_ITEM_OR_PRODUCT_SKU`
才是当前用的复合值。拆分之后复合值退役,`CATALOG_ITEM` 首次出现。**凡是按 `objectType` 做穷举或 switch 的地方,同批加上它。**

**五条 entry 必须完整,不是只有 storage 与 objectType 两列。** 每条都要保留 matrix 既有的
`owner` · `jsonPath` · `sourceLookup`(含 scope 轴)· `legacyCodePath` · `readProjection` · `writeConsumers` · `copyConsumer` · `MIGRATE`。
✅ 按 §"清库"裁定,`MIGRATE` 与 `legacyCodePath` **只描述历史来源,不触发回填或兼容分支**。

**生成器分母的 before / after** —— `scripts/generate/catalog-inventory-p1.mjs` 第 65 行:

| | 正则 | 计数 |
|---|---|---|
| before | `^R(?:0[1-9]\|1[0-4])$` | `!== 14` 则抛 `P1_REFERENCE_PATH_MATRIX_INVALID` |
| after | 匹配 `R01`–`R17` | `!== 17` |

**`C01`–`C03` 保持反例身份,不纳入该分母。**
**不得新建第二套机制绕过这道门。**

> **`MIGRATE` 与 `legacyCodePath` 只是历史来源描述。** 在清库裁定下,它们**不触发任何回填或兼容分支**。
> 替换 entry 时保留这两个字段作为血缘说明即可,**不要据此在 P3-1 里写迁移逻辑**。

**不变量**

1. 新增一个跨 owner 引用列**必须同批更新该声明** —— 这是**变更纪律,不是自动门**(理由见 A-6)
2. 守卫的来源集合**从该声明派生**,与声明做相等断言
3. **守卫通过 Inventory 的公开 owner API 查询,不直连跨 owner SQL** —— catalog 不得跨 schema 读 inventory 表

✅ 当前已知的持有方(**现状快照,不是判据**;判据是上面的声明相等):

| 表 | 指向 catalog 的引用列 |
|---|---|
| `inventory.stock_target` | `item_ref` · `product_sku_ref` |
| `inventory.stock_bom` | `item_ref` · `product_sku_ref` · **`option_value_ref`** |

**`option_value_ref` 意味着字典属性值也在被跨 owner 引用**,所以字典作废同样要走这条封口(见 §1.1-D 用例 D-4)。

### 守卫与新建引用之间的并发协议(前一版完全没写)

**单线程 guard 正确,不代表并发下正确**:guard 查完"没人引用"、在提交之前,inventory 侧可能刚建好一条引用。

**不变量**:guard 与"新建引用"这两个 command 之间必须有**同事务锁或提交前重验**,使得"删除实体"与"新建指向它的引用"**不能同时成功**。

### 先补一个前置缺口:Inventory 现在**答不出** SKU 级依赖

✅ **仓内事实**:全仓**零个含 `Sku` 的 operation** —— catalog 侧没有"删除 SKU"这个命令,移除 SKU 是
`saveOperationsCatalogItem` 提交一个少了该 SKU 的数组。而 Inventory 现有的依赖查询**按 `itemRef` 判断**,
**判不出"这个 SKU 有没有被引用""这个字典值有没有被引用"**。

**所以 A-4 / A-5 / D-4 依赖的那个查询,今天不存在。** 本节第一件事是把它补出来:

**不变量**:Inventory 提供一个**公开 owner 查询**——照 `InventoryOwnerApi` 现有的 typed context 形态,
签名接受 `WorkspaceExecutionContext<CatalogAuthorizationScope>` 加 `(objectType, ref)`,
返回**结构化的引用来源与计数**,不是裸字符串。**不新增 HTTP operation**,这是 owner 间的接口。

**catalog 只调这个接口,不跨 schema 读 inventory 表。**

> **量级提示**:这是一个**中等规模的新增 owner API,不是单行修补**,并且连带 A-4 / A-5 / A-7 / D-4
> 与真实事务并发测试。它仍在 P3-1 可控范围内,但排期要把它算进去。

| 用例 A-7 | guard 与新建引用竞争,恰有一方成功 |
|---|---|
| 做法 | **并发**发两个真实命令:① `saveOperationsCatalogItem` 提交一个**移除了 SKU-2** 的数组;② Inventory 的写命令建一条指向 SKU-2 的引用 |
| 断言 | ① 恰好一个成功;② 若保存成功,则事后**不存在**指向 SKU-2 的引用;③ 若新建引用成功,则 SKU-2 **仍在** |
| 协议(必须定死) | 两个命令共用一个**锁键**(建议以被引用实体的 ref 为键);顺序为**先取锁 → 查依赖 → 写 → 提交前重验**;重验失败即回滚 |
| 挡住什么 | **反例**:guard 只在事务开始时查一次 → 两个都成功,**留下悬挂引用**。这是 A-4 / A-5 / A-6 全过之后仍然会漏的那一格 |
| 挡不住 | 挡不住三方并发的更复杂交错;本轮只封二元竞争 |

**拒绝形态**

| 不接受 | 理由 |
|---|---|
| 用 `sku_code` 作主键或外键目标 | 编码可改;改编码会让所有下游引用断掉 |
| 唯一性靠应用层循环检查 | 就是现在的做法,它导致全品牌加锁全扫 |
| 给 `sku_barcode` 建唯一索引 | ❓ 条码在 v2s 侧零反查零约束需求;📗 v4 建唯一索引是因为它有批量导入去重,**而 v2s 全仓无批量导入** |
| 物理删除 SKU | 库存对象、套餐组件、BOM 节点都可能引用它 |
| 引用守卫只查部分来源 | 📗 v4 的 `CatalogSkuReferenceGuard` 只 union 了三张表,**漏了库存对象 / 套餐组件 / BOM 节点三源**。我们要补全,不是照抄 |

**判别性测试**

| 用例 A-0 | **新建 SKU 不带 ref,后端铸造成功**(§4.1 的正向路径) |
|---|---|
| 夹具 | 无 |
| 请求 | 新建商品,含 **2 个不带 `productSkuRef`** 的 SKU;`compositeGroups` 与 `inventoryBom` 各有一处按 `skuCode` 引用其中一个 |
| 断言 | ① 2xx;② 响应里两个 SKU **各有一个 ref**;③ 两个 ref **不相同**;④ 重读后 ref 稳定;⑤ 包内那两处引用**解析到了正确的 ref**,不是空也不是另一个 SKU 的 |
| 修复前为什么红 | ✅ 现在客户端铸的是空串,被判 422 → ① 红 |
| 挡住什么 | **反例甲(最危险)**:实现成"所有 SKU 一律必须带 ref,否则 422" → ① 红。**没有这条用例,该实现能过掉 A-2、A-3 和 §4.1 的全部断言,而新建 SKU 整个功能是坏的** · **反例乙**:两个 SKU 铸出同一个 ref → ③ 红 · **反例丙**:铸了 ref 但包内引用没解析 → ⑤ 红 |
| 挡不住 | 挡不住"ref 铸对了但不是 UUID 格式" —— 由契约 `format: uuid` 兜 |

| 用例 A-0b | 同商品内重复 ref 被拒 |
|---|---|
| 请求 | 保存商品,`skus[]` 里两条 SKU **携带同一个 `productSkuRef`** |
| 断言 | ① 拒绝;② **并发**发两个请求各写一条用同一 ref 的 SKU 时,恰好一个成功 |
| 挡住什么 | ✅ **反例甲**:就是现在的实现——只做跨商品归属校验,同商品内重复直接放行,而库存唯一身份依赖该 ref · **反例乙**:只在应用层查一遍 → ① 过、② 红 |

| 用例 A-1 | SKU 归属查询不再扫全品牌 |
|---|---|
| 夹具 | 同品牌建 30 个商品,每个 3 个 SKU(走真实保存接口) |
| 动作 | 保存其中一个商品 |
| 断言 | ① 保存过程中**不出现**对 `catalog_item` 的全品牌 `FOR KEY SHARE`;② 归属校验的 SQL 带 `sku_ref` 谓词并走索引 |
| 修复前为什么红 | 现在必然扫全品牌 30 行并 detoast |
| 挡住什么 | **反例甲**:拆了表但归属仍从 `sections` 读 → 断言 ① 红 · **反例乙**:拆了表但没建索引 → 断言 ② 红 |
| 挡不住 | 挡不住"索引建了但查询没用上"——那要 EXPLAIN,列为 P3-1 收尾的实测项 |

| 用例 A-2 | 改编码不换 ref(改名 ≠ 删了重建) |
|---|---|
| 夹具 | 商品 P 含 SKU-1(`skuCode="M"`),用 inventory 真实接口建 `stock_target` 指向它 |
| 请求 | 保存 P,SKU-1 **携带原 ref**,`skuCode` 改成 `"MED"`,同时改名称 |
| 断言 | ① 2xx;② SKU 行 ref **不变**;③ `stock_target.product_sku_ref` **不变**;④ 编码和名称已更新;⑤ SKU 表里**只有一行**,没有多出归档行 |
| 修复前为什么红 | ❓ 现在没有 SKU 行,断言 ② 无对象;拆表后若按 `skuCode` 匹配则 ②③⑤ 同时红 |
| 挡住什么 | **反例甲**:按 `skuCode` 匹配 → 被当成删一个建一个,②③⑤ 红 · **反例乙**:先归档旧行再建新行 → ⑤ 红 |

| 用例 A-3 | 缺 ref 且 `skuCode` 已存在必须被拒 |
|---|---|
| 夹具 | 商品 P 含 SKU-1,`skuCode="SKU-A"`,带 ref |
| 请求 | 保存 P,`skus[]` 里一项 `skuCode="SKU-A"` 但**不带 ref** |
| 断言 | ① 拒绝(4xx,不是 5xx);② 原 SKU-1 的 ref 未变;③ 没有新建第二行;④ 错误里指名冲突的是哪个 skuCode |
| 为什么必须有 | 这是"后端铸造 ref"(§4.1)留下的唯一缺口。不堵,客户端可以用"不带 ref"静默换掉一个 SKU,库存挂靠丢失且**没有任何错误** |
| 挡住什么 | **反例**:实现成"没 ref 就当新建" → ①②③ 全红 |

| 用例 A-4 | 删除被库存引用的 SKU 被拒 / 未被引用的成功 |
|---|---|
| 夹具 | 商品 P 含 SKU-1、SKU-2;`stock_target` 指向 SKU-2(**真实接口建**) |
| 请求甲 | 保存 P,`skus[]` 只留 SKU-1 |
| 断言甲 | ① 拒绝;② 错误体**指名 SKU-2**,不是笼统"存在依赖";③ 重读 P,SKU-2 仍在;④ `stock_target` 仍在且 `product_sku_ref` 未被置空 |
| 请求乙 | 同夹具但 `stock_target` 指向 SKU-1,保存只留 SKU-1 |
| 断言乙 | ① 2xx;② SKU-2 的行**确实不存在了**(或已归档且不可见),不是留在表里;③ SKU-1 的 ref 未变 |
| 为什么必须成对 | 只有甲 → "一律拒绝"的实现假绿;只有乙 → "一律放行"的实现假绿 |
| 挡住什么 | **反例丙**:拒绝但已经删了才回滚失败 → 甲③ 红 · **反例丁**:软删并把 `product_sku_ref` 置空 → 甲④ 红 |
| 挡不住 | 并发:A 删 SKU 的同时 B 正在建 `stock_target`;**也挡不住"只查了 `stock_target` 一张表"——那要 A-5** |

| 用例 A-5 | **只被 BOM 引用**的 SKU 同样删不掉 |
|---|---|
| 夹具 | 商品 P 含 SKU-1、SKU-2。给 SKU-2 建一条 `stock_bom` 行(`product_sku_ref` 指向它),**且不给它建任何 `stock_target`** |
| 请求 | 保存 P,只留 SKU-1 |
| 断言 | ① 拒绝;② 错误体指名 SKU-2 **且指明引用来源是 BOM**;③ 那条 `stock_bom` 未被改动 |
| 为什么必须单独有 | ✅ **A-4 的夹具只建 `stock_target`,所以"守卫只查 `stock_target`"的实现能全过 A-4。** `stock_bom` 另有 `item_ref`、`product_sku_ref`、`option_value_ref` 三列指向 catalog |
| 挡住什么 | **反例**:守卫手写枚举只含 `stock_target` → ① 红 |

| 用例 A-6 | **引用源集合完整性**(封口用例,防的是下一次漏表) |
|---|---|
| 做法 | 取 `catalog-inventory-reference-path-matrix.json` 里 `objectType` 属于 catalog 实体(商品 / SKU / 字典条目)的全部 entry,与 **Inventory 公开 guard 实际查询的集合**做相等断言 |
| 断言 | ① 两个集合相等;② 在声明里加一条 guard 未覆盖的 entry → 断言**必须变红** |
| **不再声称** | ~~从 schema 派生~~ —— ✅ 这些列无跨 schema FK,metadata 判不出目标实体,**靠列名猜就是拿命名当证据** |
| 为什么必须有 | 📗 v4 的守卫枚举三张表漏三源;本工单前一版枚举一张表漏一张。**枚举连败两次,所以要测的是枚举本身** |
| 挡住什么 | **反例**:guard 手写枚举 —— 今天补全了,下次加引用列时**仍然全绿** |
| 挡不住 | ⚠️ **挡不住"声明本身漏了一条"**,而且**没有任何机器门能兜住它** —— ✅ 现有生成链只能校验已存在 matrix 的结构与固定分母,**无法从一个新数据库列推断它的业务目标**。<br>所以"新增引用列必须同批加 entry"是**同批变更纪律 + review checklist**,**不是自动门**。<br>前一版把它写成"迁移门变红",那是我又造了一个不存在的机制。**A-6 只证明声明与 guard 查询相等,不证明声明完整。** |

> **警告** ✅:**不要在现有 `canVoid` 上加东西。** 它的 `blockingReferences` **建了数组从不填**(恒空),`hasItemDependencies` 读的是**本商品自己的 sections**——它回答的是"有没有内容",不是"有没有被引用"。在错的答案上加东西只会让它更精致。

---

### B · `categoryRefs[]` → 多对多关系表

**缺陷事实** ✅

分类树查询一条 SQL 里 5 个相关子查询,其中 **3 个对 `catalog_item` 全扫并 `jsonb_exists`**;列表过滤同样;`categoryReferencedItems` / `categoryReferenced` 是 `SELECT sections::text ... status <> 'VOIDED'` 全扫后**在 Java 里比字符串**。

❓ `catalog_item` 上除主键与唯一约束外只有一个索引,**全仓零 GIN**,且**每次开页、每次切品牌都跑**。

**不变量**

1. 商品↔分类是**多对多**关系行,不是 JSON 数组
2. "这个分类下有哪些商品"和"这个商品属于哪些分类"**两个方向都走索引**
3. 分类删除/停用时的引用检查基于关系行,不基于全表扫

**拒绝形态**

| 不接受 | 理由 |
|---|---|
| 📗 抄 v4 的 `catalog_item.category_id varchar(80)` 单值 | v4 一个商品只能挂一个分类,**表达不了 v2s 的多分类**。这是 v4 的限制不是设计 |
| 保留 JSON 数组 + 加 GIN 索引 | GIN 能救全扫,救不了"关系行不存在"带来的引用完整性缺失;且 `jsonb_exists` 的语义与关系查询不等价 |

**判别性测试**

| 用例 B-1 | 分类树查询不再全扫商品表 |
|---|---|
| 夹具 | 一个品牌 200 个商品、20 个分类,每个商品挂 1-3 个分类(真实接口) |
| 动作 | 打开分类树 |
| 断言 | ① 不出现对 `catalog_item` 的 `jsonb_exists` 全扫;② 每个分类的商品计数来自关系表聚合 |
| 挡住什么 | **反例**:拆了关系表但计数仍从 `sections` 算 → ① 红 |

| 用例 B-2 | 两个方向的反查都正确且成对 |
|---|---|
| 夹具 | 商品 P 挂分类 C1、C2;商品 Q 只挂 C1 |
| 断言 | ① 查 C1 得到 {P, Q};② 查 C2 只得到 {P};③ 查 P 得到 {C1, C2};④ 把 P 从 C1 移除后,C1 只剩 Q 且 P 仍在 C2 |
| 挡住什么 | **反例甲**:关系行没删干净 → ④ 红 · **反例乙**:移除时把 P 的所有分类都清了 → ④ 后半红 |

---

### C · `compositeGroups[].components[]` → 组 + 组件两张表

> **这里是两个决定,不要合成一个:**
> **(a) 从 JSON 拆出来** —— 依据是 §1.0 的反查(下面那条全扫 + 手写外键)。**这一条单独就成立。**
> **(b) 拆成组 + 组件两张表而不是一张扁平表** —— 依据是零组件组无法表达 + 组级事实不重复。**这不是 §1.0 的事,是范式。**
> 前一版把 (b) 的理由写成"C 拆表的唯一硬理由",等于给"表达不了就拆"开了口子——而 §9 明令禁止那种推理。

**缺陷事实** ❓

`itemReferencedByOtherItems` 全扫;`item_ref IN (…) FOR KEY SHARE` 是**手写外键**。**(a) 的依据就是这一条。**

**不变量**

1. 组级事实(组名 / 选择规则 / min / max / 排序)**只存一份**,不重复写在每行组件上
2. **零组件的组可以表达**
3. "谁把我当组件用了"走索引反查

**拒绝形态**

| 不接受 | 理由 |
|---|---|
| 📗 抄 v4 的 `catalog_composite_structure` 单张扁平表 | 它把组级事实重复写在每行组件上。**注意:v4 唯一的写者是全量重写(先 delete 再 insert),所以它不会出现更新异常**——真正的缺陷是**零组件的组无法表达**:`appendGroupRows` 只在组件循环里发行,组直接消失 |
| 手写外键(`IN (…) FOR KEY SHARE`) | 就是现在的做法 |

**判别性测试**

| 用例 C-1 | 零组件的组能存能读 |
|---|---|
| 夹具/请求 | 保存一个商品,含一个组名为"配菜"、**组件列表为空**的组 |
| 断言 | ① 2xx;② 重读商品,该组**仍在**且组名保留;③ 组件数为 0 |
| 挡住什么 | **反例**:照抄 v4 扁平表 → 组消失,②③ 红。**这条守的是决定 (b)(两张表),不是决定 (a)(拆出 JSON)** |

| 用例 C-2 | 改组名只改一处 |
|---|---|
| 夹具 | 一个组含 5 个组件 |
| 请求 | 只改组名 |
| 断言 | ① 组表 1 行被更新;② 组件表 0 行被更新;③ 重读后 5 个组件的组名一致 |
| 挡住什么 | **反例**:扁平表 → ② 红(5 行都被写) |

---

### D · `skus[].attributeValueRefs[]` → 关系表

> **2026-08-15 Claude 裁决订正**：前一版把“字典有 `VOIDED` 状态”错误推成“已被引用的字典值可以作废、读模型必须容忍悬挂引用”。真实 owner 路径在作废前分别检查 catalog 与 Inventory 引用；有任一引用即 typed `REFERENCE_BLOCKS_VOID`。因此 D-2 改为 catalog 侧引用阻断，D-4 保留 Inventory/BOM 侧引用阻断，并新增 D-5 覆盖无人引用时的正常作废。`readDictionary` 是否在某个 picker 中隐藏 `VOIDED` 项属于 P3-2 交互语义，**本节不臆造该断言**。

**缺陷事实** ✅

字典作废守卫对 `SKU_ATTRIBUTE_VALUE` **全扫**。而 JSON 数组表达不了"同一 SKU 同一属性只能有一个值"这条约束。

❓ 真正触发拆表的**不是复用**(复用已由 `catalog.dictionary_entry` 表满足),而是**字典里"甜"改名之后,每个 SKU 的 JSON 里 `valueLabel` 快照原地不动**。

**不变量**

1. `unique(product_sku_ref, attribute_ref)` —— 同 SKU 同属性至多一个值
2. **不存 `valueCode` / `valueLabel` 快照**,读时 join 字典
3. 仍被 catalog 或 Inventory 事实引用的字典条目**不得作废**；所有可达商品 readback 都只关联有效、可投影的字典值

**拒绝形态**

| 不接受 | 理由 |
|---|---|
| 📗 抄 v4 的 `value_code_snapshot` / `value_label_snapshot` | 冻结历史是**订单域**的职责,不是商品域的。v4 因此产生了不对称:改属性名老 SKU 跟着变(live join),改属性值名老 SKU 不变(快照)。**同一个界面上两种行为** |
| 只加 unique、不保留引用阻断 | 会让商品或 BOM 指向已作废字典值；若再靠空字段、快照或读时猜测补救，就把不该可达的悬挂状态扩散到 readback、复制与后续写入 |

**判别性测试**

| 用例 D-1 | 字典改名,已有 SKU 跟着变 |
|---|---|
| 夹具 | 字典有属性"口味"、值"甜";商品 P 的 SKU-1 引用它 |
| 动作 | 在字典里把"甜"改名为"微甜" |
| 断言 | ① 重读商品 P,SKU-1 显示"微甜";② SKU 关系行本身**未被更新**(改的是字典行) |
| 挡住什么 | **反例**:存了快照 → ① 红(仍显示"甜") |

| 用例 D-2 | **被 catalog 引用**的字典条目不能被作废 |
|---|---|
| 夹具 | 商品 P 的 order option 引用一个 `SKU_ATTRIBUTE_VALUE` 字典值 |
| 动作 | 对该字典值发起 `VOIDED` 状态迁移,再重读字典与商品 P |
| 断言 | ① typed `422 REFERENCE_BLOCKS_VOID`;② 错误信息指出 catalog 引用来源;③ 字典状态/版本与商品事实均未变化;④ 商品 readback 的 required 字段仍完整 |
| 挡住什么 | **反例甲**:只查 Inventory、不查 catalog 引用 → ① 红 · **反例乙**:拒绝但已改字典行 → ③ 红 |

| 用例 D-3 | 同 SKU 同属性两个值被拒 |
|---|---|
| 请求甲 | 保存一个 SKU,`attributeValueRefs` 里含同一属性的两个值 |
| 断言甲 | 拒绝 |
| 请求乙 | **并发**发两个请求,各给同一 SKU 同一属性写一个不同的值 |
| 断言乙 | **恰好一个成功**,另一个失败;事后表里该 (SKU, 属性) 只有一行 |
| 挡住什么 | **反例**:只在应用层 `if` 查一遍 —— 甲过、**乙红**(两个请求都查到"还没有",都写进去) |
| 为什么不断言约束名 | 断言约束名会把工单绑死在实现上,也会把存储细节漏进错误体。**并发下只有一个成功**是同样强、但不绑实现的判据 |

| 用例 D-4 | **被 BOM 引用的字典属性值不能被作废** |
|---|---|
| 夹具 | 字典有属性"口味"、值"甜";某商品的 SKU 引用它;**且有一条 `stock_bom` 的 `option_value_ref` 指向"甜"** |
| 请求 | 作废字典里的"甜" |
| 断言 | ① 拒绝;② 错误指名引用来源是 BOM;③ 该字典行未被改动 |
| 为什么必须有 | ✅ `stock_bom.option_value_ref` 是跨 owner 引用；D-2 只覆盖 catalog 侧守卫，**不能证明 Inventory/BOM 侧也封口**。 |
| 挡住什么 | **反例**:字典作废只查 catalog 侧引用 → ① 红。这条与 A-5 是同一个封口的两个面(见 §1.1-A 的集合相等不变量) |

| 用例 D-5 | 无引用字典条目可以正常作废 |
|---|---|
| 夹具 | 创建一个没有 catalog、Inventory 或其他事实引用的字典条目 |
| 动作 | 发起 `VOIDED` 状态迁移,再读取该字典 |
| 断言 | ① 状态迁移成功并回读 `VOIDED`;② 版本递增;③ 没有影响任何已有商品或 BOM 事实 |
| 挡住什么 | **反例**:一律拒绝所有字典作废 → ① 红 |
| 不证明什么 | `VOIDED` 是否应由某个前端 picker 隐藏属于 P3-2 交互语义；当前 owner dictionary read 的既有输出不是本用例的判据 |

---

### E · 无序引用 + 两类有序媒体 → **三张**关系表

> ⚠️ **`orderOptions[].values[].attributeValueRef` 已从本表移出**,改由下面 F 的选项值表承接。
> 三列的 `(item_ref, kind, ref)` 表达不了**嵌套带归属**的引用:一个商品有多个选项组、每组多个选项值,
> 读详情时必须知道某个 ref 该回填到**哪一个**选项值。三列里没有 occurrence identity。
> **不接受给统一表加 `occurrence_key`** —— 它对六个 kind 里的五个是 NULL,要么编位置(重排就废)、
> 要么造一个合成稳定键,**而那正是行主键该干的事**;更要命的是选项值仍然没有身份,下一条要挂在它上面的关系会撞同一堵墙。

**缺陷事实** ✅

`productionTagRefs` / `tagRefs` / `salesUnitRefs` 是商品级**无序集合**；`images` 是商品级**有序列表**，其第一个元素承载主图语义；`skus[].mediaRefs` 是 SKU 级**有序列表**。三类形状不能共用 `(item_ref, kind, ref)`：它既表达不了列表顺序，也不能表达 SKU 媒体的 SKU 父级归属。现有反查全部是全表 JSONB 扫，其中资产反查那条**连 scope 谓词都没有**:

```sql
SELECT sections::text FROM catalog.catalog_item WHERE status <> 'VOIDED'
```

`orderOptions[].values[].attributeValueRef` 的唯一反查也落在同一处。

**不变量**

1. `productionTagRefs` / `tagRefs` / `salesUnitRefs` 留在一张无序集合表 `(item_ref, kind, ref)`；`kind` 只允许这三种值
2. 商品图片进入 `catalog_item_image(item_ref, asset_ref, display_order)`；同一商品不得重复引用同一资产
3. SKU 媒体进入 `catalog_sku_media(product_sku_ref, asset_ref, display_order)`；同一 SKU 不得重复引用同一资产
4. 两张媒体表一律按 `display_order, asset_ref` 稳定读取；商品主图是第一张图片，必须由 owner 显式投影，不能依赖未写明的数组偶然约定
5. 每条本 scope 的反查带 `data_node_ref` + `brand_ref` 谓词；物理对象是否仍可删除的全局判断同时查询两张媒体表

**拒绝形态**

| 不接受 | 理由 |
|---|---|
| 把商品图片或 SKU 媒体塞回统一表 | 两类媒体是有序列表且父级不同；多态 owner 会失去真外键，三列无序表会丢失顺序或归属 |
| 保留 JSON 只给资产反查加 scope 谓词 | 那只修了泄漏,没修全扫;而且另外四族的反查还在扫 |

**判别性测试**

| 用例 E-1 | 资产反查不再跨租户 |
|---|---|
| 夹具 | 租户 A 与租户 B 各有一个商品,**引用同一个 assetRef** |
| 动作 | 租户 A 释放该资产 |
| 断言 | ① 释放成功(不被 B 的引用阻挡);② B 的引用不受影响;③ 该查询带 `data_node_ref` + `brand_ref` |
| 修复前为什么红 | ✅ 现在无 scope 谓词,A 会被 B 挡住 → ① 红 |
| 挡住什么 | 见 E-1b —— **单独这一条挡不住"只加了 `data_node_ref`"的实现** |

| 用例 E-1b | **同 data node 跨品牌**同样不相互阻挡(必做,不是备注) |
|---|---|
| 夹具 | **同一个 `data_node_ref`** 下的品牌 A 与品牌 B 各有一个商品,引用同一个 assetRef |
| 动作 | 品牌 A 释放该资产 |
| 断言 | ① 释放成功;② 品牌 B 的引用不受影响 |
| 为什么必须单独有 | ✅ E-1 是跨租户,只加 `data_node_ref` 谓词就能过。**品牌是 catalog 事实 scope 的第二根轴,漏了它等于隔离只做了一半** |
| 挡住什么 | **反例**:只加 `data_node_ref` → E-1 全过,**E-1b ① 红** |

| 用例 E-2 | 五族反查都走其唯一关系事实 |
|---|---|
| 动作 | 分别触发生产标签、标签、销售单位、商品图片、SKU 媒体的"是否仍被引用"查询 |
| 断言 | ① 五条**都不**出现 `sections::text` 全表扫;② 三类无序集合命中统一表，商品图片命中图片表，SKU 媒体命中 SKU 媒体表;③ 资产删除守卫同时覆盖两张媒体表 |
| 挡住什么 | **反例甲**:只迁了商品图片 → SKU 媒体仍漏保护; **反例乙**:只建关系表却保留 JSON 作为详情或复制来源 → 单一事实来源断裂 |

### F · 选项组 + 选项值 → 两张表(**本轮新增,按判据乙**)

**缺陷事实** ✅ `orderOptions` 真实存在(写入 `sections`、第 1177 行读取投影、第 1836 行校验),
其中每个 `values[]` 带一个 `attributeValueRef`。**这条关系需要归属者,而 JSON 路径不是归属者。**

**不变量**

1. 选项组与选项值**各有一行、各有 ref**
2. `attributeValueRef` 是**选项值行的一列**,不进统一引用表
3. **组也要有行,不能只拆值** —— 值属于组;组留在 JSON,值行的父亲就还是 JSON 路径。
   ✅ 用 `groupCode` 当父亲同样不行:**这个仓刚被"编码当身份"坑过一次**(inventory 侧四处 `item_code` JOIN)
4. 组内选项值编码唯一、组编码在商品内唯一,由数据库约束表达
5. 组与值各有稳定 `displayOrder`

**拒绝形态**

| 不接受 | 理由 |
|---|---|
| 给统一引用表加 `occurrence_key` | 五个 kind 为 NULL;编位置则重排即废;造合成稳定键就是在重新发明主键;**且选项值仍无身份** |
| 只拆值不拆组 | 值行的父亲变成 JSON 路径或业务编码,两者都不是可靠身份 |
| `attributeValueRef` 留在 JSON、同时在关系表建索引行 | **双真相**,§2.1 明令禁止 |

**判别性测试**

| 用例 F-1 | 嵌套引用能正确读回 |
|---|---|
| 夹具 | 一个商品含 2 个选项组,每组 2 个选项值,**四个值各引用不同的字典属性值** |
| 断言 | ① 读详情时四个 `attributeValueRef` **各自回到正确的选项值**;② 交换两组的顺序后重读,归属**不变**;③ 删除第一组不影响第二组的值与引用 |
| 挡住什么 | **反例甲**:扁平回填 → ① 红(混进别的组) · **反例乙**:按位置索引归属 → ② 红 · **反例丙**:级联删错 → ③ 红 |

| 用例 F-2 | 字典作废守卫覆盖选项值引用 |
|---|---|
| 做法 | 作废一个**只被某个选项值引用**的字典属性值 |
| 断言 | 被拒且指名是哪个商品的哪个选项组的哪个值 |
| 为什么 | 该引用从统一表移到选项值表之后,**守卫的来源集合必须同批更新**(§1.1-A 的集合相等不变量),否则这一族的保护凭空消失 |

## 1.2 提列(不是拆表)

`shortName` / `source*` / `governance*` ❓ 已经进了列表查询的 WHERE,且仓内**存在多种拼写共存**。这些提成列。

**判别性测试**:按 `shortName` 过滤的列表查询走索引,且**不再出现同一字段的第二种拼写**。

---

# 2 · `sections` 边界与集合调和

## 2.1 `sections` 必须上白名单

**缺陷事实** ✅

`sections` 是**客户端可写任意键的无界 JSONB,DB 层零约束,写入全量透传**。

拆表之后,被拆走的字段**会以旧键名继续被写回**并与新表共存,形成两份真相。

**不变量**

1. 可写键集合**显式限定**
2. 不在集合内的键**被拒绝**,不是静默丢弃
3. 已拆出去的字段名**进入拒绝列表**

**判别性测试**

| 用例 | 提交一个已拆走的旧键名 |
|---|---|
| 请求 | 保存商品,`sections` 里塞一个 `skus`(已拆走) |
| 断言 | ① 拒绝;② 错误指名是哪个键;③ 新表未被绕过写入 |
| 挡住什么 | **反例甲**:静默丢弃 → ① 红,而且是最危险的形态(客户端以为写进去了) · **反例乙**:接受并写进 `sections` → ③ 红,两份真相 |

## 2.2 保存必须做集合调和

**缺陷事实** ✅

`saveItem` 逐键 `sections.set(...)` **整体覆盖**,唯一的移除侧检查是资产锁。

**删除是静默事件:零比对、零归档、零引用检查——不是漏了检查,而是根本没有"删除"这个动作可供检查。**

**不变量**

1. 保存能区分**新增 / 修改 / 删除**
2. 删除路径有引用检查
3. 被拒绝的删除**不留下部分写入**

**判别性测试**:见 §1.1 用例 A-4(成对甲乙)。

---

# 3 · 编码释放

> **适用范围:所有 catalog item 的生命周期,不依赖 manifest shape。**
> 本节的规则不是 `skuMode` 规则,不要硬映射到某个 SKU 形态(与 §12.3 的空组合裁定不同)。

## 3.1 硬前置:inventory 必须先停止按 `item_code` 关联

**缺陷事实** ✅ 本轮亲验

`InventoryOwnerService` 里 `item_code` 是**活的关联键**:一处 `AND st.item_code IN (…)` 过滤,加**四处 JOIN**(`JOIN requested r ON r.item_code=st.item_code`、`... sb.item_code`、以及两处 `LEFT JOIN ... ON t.item_code=r.item_code`)。

喂料方是 catalog:分类/关键词过滤时先解析出商品 **code** 数组塞进 `catalogItemCodes`;商品列表页的库存计数徽章;反向用 inventory 的 `sourceCode` 回查 catalog。

**且全仓零 `SET item_code`** ✅ ——"编码创建后不可改"是一条**没有写下来的隐式约束**,上述四处 JOIN 全靠它成立。

迁移注释 `-- inventory keeps product codes only as read labels.` **与代码相反**。

**不变量**

1. inventory 侧**不再以 `item_code` 承担跨 owner 身份**。前一版写成"不再使用 `item_code` 过滤或 JOIN",**过宽了**,逐类说清:

| 用途 | 裁定 |
|---|---|
| **跨 owner 身份关联**(按 code 认"这是哪个商品") | **禁止**,改走不透明 ref |
| **候选集合传递**(catalog 解析出 code 数组塞给 inventory) | **禁止**,改传 ref |
| **计数 JOIN**(库存计数徽章那三条 JOIN) | **禁止**,改按 ref JOIN |
| **本地展示 / 输出 label**(把 code 当人看的标签显示) | **保留** —— 它不承担身份 |
| **用户关键字搜索**(用户输入的字串在 code 上做匹配) | **保留** —— 它是搜索不是关联;但命中之后必须转成 ref 再往下走 |
2. 那句迁移注释同批改掉——**它本身就是缺陷**,是这次误判的直接来源

**判别性测试**

| 用例 | 编码复用不会让 inventory 认错行 |
|---|---|
| 夹具 | 商品 P 用编码 `"A-001"`,建 `stock_target`;作废 P;新建商品 Q **复用编码 `"A-001"`**,建自己的 `stock_target` |
| 断言 | ① Q 的库存计数只算 Q 的行;② P 的历史行不出现在 Q 的任何查询里;③ 反查 P 的历史仍能取到 P 的行 |
| 挡住什么 | **反例**:仍按 code JOIN → ①② 全红,两个商品的库存混在一起 |

**第 1 条成立之前,§3.2 不得开始。**

## 3.2 VOIDED 释放,ARCHIVED 不释放

**缺陷事实** ✅

`UNIQUE (data_node_ref, brand_ref, code)` **无状态谓词**;`formalCodeAvailable` 不看 status,文案自认"已被历史记录占用"。

**裁定(本工单定,不接受"两个都释放")**

- **VOIDED 释放**:普通业务读路径一律 `status <> 'VOIDED'`,业务不可见却占用业务命名空间,是纯粹的命名空间泄漏

> **例外必须写清,否则与 §3.4 打架。**
> ⚠️ **订正**:前一版写"历史读取必须用 `itemRef` 访问"。✅ 仓内**没有这样的公开 operation** ——
> catalog 侧只有按 `itemCode` 的读取。**我又一次引用了一个不存在的接口。**
>
> **本轮处置:撤回"对外按 ref 读取 VOIDED"这条验收。** P3-1 只保留一条:
> **普通业务解析按编码,且排除 VOIDED。** 对外**不提供** VOIDED 的读取路径。
>
> 内部血缘字段(`source_item_code` 等)不受此约束,它们本来就不经过公开读路径。
> **若将来确实需要历史读取,那是新增 operation,属于新范围,不在本轮。**
- **ARCHIVED 不释放**:归档语义是"历史仍有效";`smartViewKey='ARCHIVED'` 证明归档商品是**一等可见视图**。复用会让历史数据指向新商品——那是语义污染,不是空间回收

> 前一版工单的 D-2 判"两个都释放",**已撤回**。它的论证依赖"关系已迁移到不透明 ref",而 §3.1 证明该前提不成立。

**判别性测试**

| 用例 | 断言 |
|---|---|
| VOIDED 后同码新建 | ① 成功;② 新旧两行都在;③ 各自的读路径互不串 |
| ARCHIVED 后同码新建 | ① **被拒**;② 错误指明被归档商品占用 |
| 两条必须成对 | 只有前者 → "全释放"的实现假绿;只有后者 → "全不释放"的实现假绿 |

## 3.3 转正后的临时行

**缺陷事实** ✅ 转正时把旧临时行置 `ARCHIVED`。按 §3.2 的裁定,`ARCHIVED` 不释放编码,所以这些行会**永久占用编码**。

> 前一版还写了"临时商品是生成频率最高的编码族"。**那是运行事实,本轮未验证,已删** —— 不能拿未验的运行特征当优先级证据。这条的成立不依赖频率:哪怕频率不高,占用也是错的。

**不变量**:转正后的临时行置 `VOIDED` 而非 `ARCHIVED`;来源记在已存在的 `source_item_code` 上。

**判别性测试**:转正 100 个临时商品后,这 100 个编码**全部可复用**,且转正后的正式商品来源可追溯。

## 3.4 按编码装载(**与 §3.2 同批,不是先做**)

**缺陷事实** ✅ `loadItems` 用 `WHERE code IN (...)` **不带状态谓词**,`ORDER BY code` 后取 `rows.get(0)`。现状同码只一行所以恰好正确;**释放编码之后才变成不确定行为**。

❓ 释放编码前需把**所有**按编码查询的路径逐一核过。前一版写了"至少 6 处",**该数字未做分母复算,已删** —— 分母要现场枚举,不要照抄。

> **修正**:前一版说"这条用例在 §3.2 之前需手工构造数据,不能等 §3.2"。**那句话要求的正是 §0 通则第 1 条禁止的直接 INSERT**——现行唯一约束无状态谓词,真实写路径根本造不出同码两行。
> 而且排序理由本身就错:**问题只在约束放开之后才存在,不需要提前修。** 所以 §3.4 与 §3.2 **同批**,约束放开后夹具即可走真实路径构造。

**判别性测试**

| 用例 | 同码两行时装载到正确的那一行 |
|---|---|
| 夹具 | (§3.2 的约束改动生效后)走真实写路径:建商品用编码 `"A-001"` → 作废 → 再建一个新商品复用 `"A-001"` |
| 断言 | ① 按编码装载**确定地**得到有效行,不是 VOIDED 行;② 结果**不依赖 `ORDER BY` 的偶然顺序**(构造两条有效行以上的情形验证);③ **对外不返回 VOIDED 行**(见 §3.2 订正:历史读取路径本轮不提供) |
| 挡住什么 | **反例甲**:加了 `status <> 'VOIDED'` 但仍取 `rows.get(0)` → ③ 红(多个有效行时仍不确定) · **反例乙**:把历史行也过滤掉 → ② 红 |

---

# 4 · 契约

## 4.1 新 SKU 的 `productSkuRef` 由后端铸造

**缺陷事实** ✅

前端 `draftUuid` 是**类型断言不是生成器**,无参调用返回空串,被后端判 422。而后端本来就在**为前端铸的 ID 补做唯一性检查**——实现方式就是 §1.1-A 那条全品牌全扫。

**不变量**

1. 新建 SKU 时客户端**不提供 ref**;后端铸造并在同一事务内解析包内引用
2. 关联键是 `skuCode`;**四处引用点的 `skuCode` 全部进 required**
3. **已存在的 SKU 必须携带 ref**(用于区分改名与删了重建)
4. 缺 ref 且 `skuCode` 已属现存 SKU **一律拒绝**

**契约有洞** ❓:`catalogDraft.skus[]` 与 `compositeGroups[].components[]` 的 `skuCode` 在 required 里;**`inventoryBom[]` 与 `inventoryConfiguration.nodes[]` 的 required 里没有**。把 ref 改成可选正好会放大这个洞。

**判别性测试**:见 §1.1 用例 A-2 / A-3。另加一条:四处引用点**任意一处不带 `skuCode`** 的请求被拒。

## 4.2 五条契约漂移

| ID | 缺陷事实 ❓ | 不变量 |
|---|---|---|
| `X-06` | `smartViewKey` 契约枚举与 owner 实际**互有出入**(契约有 owner 不认 4 个、owner 有契约没有 5 个),`default` 分支落到 422 | 任一枚举值不得只出现在契约/owner/前端三方中的两方。<br>⚠️ **目标集合要去掉 `GOVERNANCE_PENDING`** —— 治理维度整套删除,见 §4.4。**先对齐再删等于白对一次** |
| `X-07` | `CatalogItemPageQuery` **无 `tags` 参数**,而 IA 三处要求标签筛选 | 契约支持 IA 要求的筛选维度 |
| `X-08` | `orderOptions.values` item 级 6 字段、**根级 5 字段(缺 `attributeValueRef`)**;两处都缺 min/max、小票名、后厨名、状态、排序 | 同一对象在契约里只有一种字段集 |
| `X-09` | `CatalogItemDetail.data.item` **无 `materialRole`**,而同一份契约另外三处存在该字段——纯遗漏 | — |
| `X-14′` | 契约把 `smartViews.label` 声明为 **required**,而 owner **从不 put**——owner 违反自己的契约 | 契约声明 required 的字段,owner 必须实际输出。**修法与 §12.1 一致:由后台下发,不是前端硬编码。** ⚠️ 前一轮教训:按"前端补上 label"去修**会让左树标题全变空** |

**判别性测试(通用)**

| 用例 | 三方枚举对账 |
|---|---|
| 做法 | 对每个受控枚举,从契约、owner、前端三处各取一份集合 |
| 断言 | 三方集合**相等**;任一方独有的值都是失败 |
| 挡住什么 | **反例**:只把 owner 缺的补进契约,不管契约多出来的 → 集合仍不等 |

| 用例 | required 字段实际输出 |
|---|---|
| 做法 | 对契约里每个 required 字段,构造一次真实读取 |
| 断言 | 字段**存在且非空**(或契约改成 optional) |
| 挡住什么 | 这条会直接抓出 `X-14′`,也会抓出别的同类 |

> ✅ **`format: uuid` 缺口实际为 0,不要动。** 标量 `*Ref` 共 387 个,缺 `format: uuid` 的 18 个**全是 `externalIdentity.source*Ref`**——第三方平台标识,owner 用 `copyOptionalText` 原样透传。**给它们加 `format: uuid` 是错的。**

## 4.3 派生字段的所有权(本轮新发现,不在任何既有文档里)

三个字段长得像 owner 事实,实际是**客户端可写值**:

| 字段 | 缺陷事实 ❓ | 用户可见后果 |
|---|---|---|
| `sections.skuSummary` | 落在 sections 里的派生值,**保存契约里根本没有这个字段**,任何写路径都无法更新它 | SKU 页签头部**恒显 0/0/0**,而同一页下方列着 N 条真实 SKU;列表"形态/规格"列恒为 **0/N** |
| `ordering.missingPriceCount` | 是**必填字段**,前端原样回传、owner 原样落库,全链路无一处重算 | 界面说明写着"缺价数由 SKU/价格事实派生";**补齐价格数字不变,手改也不被拒** |
| `skus[].version` | 客户端写什么回显什么,owner 从不递增(新建即 0) | 长得像并发令牌,不是 |

**不变量**

1. 派生字段**从请求契约里移除**,只出现在响应
2. 每个派生字段有**唯一一处**计算点,且在写路径上被调用
3. 同一屏幕上不出现对同一事实的两个数字

**判别性测试**

| 用例 | 补齐价格后缺价数变化 |
|---|---|
| 夹具 | 商品含 3 个 SKU,其中 2 个无价 |
| 断言 | ① 初始缺价数为 2;② 给 1 个补价后重读为 1;③ 请求里带一个伪造的缺价数被**拒绝或忽略**,响应仍是真实值 |
| 断言(补) | ④ 保存之后、**不经过任何读接口**,直接查存储可见该派生值已更新;⑤ 未触发保存时该值不变 |
| 挡住什么 | **反例甲**:仍接受客户端值 → ③ 红 · **反例乙(Codex 找出的)**:**读时即时计算、完全不落库** → ①②③ 全过,**④ 红**。没有 ④,"唯一计算点在写路径"这条不变量无人守 |
| 若读时计算是有意设计 | 那就把不变量改成"响应正确 + 拒绝客户端伪造值",并删掉 ④⑤ 与"写路径上被调用"那句。**二选一,不能两句都留着** |

| 用例 | SKU 计数与明细一致 |
|---|---|
| 断言 | ① 新建含 3 个 SKU 的商品,页签头部显示 3;② 归档 1 个后显示 2/3;③ 列表页的计数与详情页**相同** |
| 挡住什么 | **反例**:只修详情不修列表 → ③ 红 |

## 4.4 治理维度 —— **整套删除**(Dexter 2026-08-14 裁定)

> ⚠️ **本节从"统一词表"改为"整套删除"。** 前一版要求把筛选器候选、后台接受值、列表显示值三者同源;
> 现在的裁定是**这个维度整个不要**。
>
> ⚠️ **依据换过一次,前一版是假的。** 前一版写"v4 catalog 域 governance 零命中"——**错的**。
> ✅ v4 有 `catalog_item.governance_status`(六值 check、投影表同列、两条索引、受控 optionSet),catalog 范围内命中 43 个文件。
> 错因:一次 grep 没限范围且 `head -5` 截断,一次限了范围却漏掉承重词。
>
> **真正的依据** ✅ v2s 的 `governanceStatus(row, sections)` **没有任何完整性计算**:
> 客户端写什么回显什么;否则 `"TEMPORARY".equals(sourceFact(...)) ? "GOVERNANCE_TODO" : row.status()`。
> **它是 `source` 与 `status` 两个字段的复读,零新增信息。** 三方词表对不上是症状不是病。
> 而"表达内容是否完整"这条路也走不通——`source` 已能识别临时商品,而 v2s 没有任何地方在算完整性。
>
> Dexter 2026-08-14 裁定:**去掉。**
> **连带**:IA §5.1 线框里的治理筛选、`·待治理` 左树项、`状态治理` 列**同批修订**,否则删完 IA 立刻不符合。

**要删干净的东西(跨三层,漏一处就是残留)**

| 层 | 删什么 |
|---|---|
| 契约 | 列表项的 `governanceStatus` 字段 · 列表查询的 `governanceStatus` 参数 · `smartViewKey` 枚举里的 `GOVERNANCE_PENDING` |
| owner | `itemSummary` 里产出 `governanceStatus` 的那段 · `validateItemPageQuery` 对该参数的校验 · `GOVERNANCE_TODO` 这个值 · smartView 分支里的 `GOVERNANCE_PENDING` |
| 数据 | `sections` 里的 `governanceStatus` 键(白名单里同批排除) |

**连带必须同批改的两处(否则 P3-1 自相矛盾)**

1. **§4.2 的 `X-06`** —— `smartViewKey` 三方枚举对账的目标集合**去掉 `GOVERNANCE_PENDING`**
2. **§12.1 的枚举分母** —— `governanceStatus` 这个 `enumKind` **从规范源里去掉**,不要先建再删

**判别性测试**

| 用例 | 断言 | 挡住什么 |
|---|---|---|
| 契约面 | 契约里 `governanceStatus` 字段与参数**零出现**;`smartViewKey` 枚举**不含** `GOVERNANCE_PENDING` | 只删前端不删契约 |
| owner 面 | 提交带 `governanceStatus` 的查询 → **按未知参数拒绝**,不是静默忽略 | 静默忽略会让老客户端以为筛选生效了 |
| 智能视图 | `smartViewKey` 的合法取值集合里没有 `GOVERNANCE_PENDING`,传它被拒 | 后台留着分支不报错 |

> **前一版本节的内容(三者同源 + 读写侧用例)整体作废**,因为那是"修好这个维度",而裁定是"不要这个维度"。

## ~~4.4b 治理状态词表~~(已被上面替代,保留标题防止引用断裂)

**缺陷事实** ❓ 治理状态筛选下拉的三个选项 `READY / NEEDS_ATTENTION / BLOCKED`,后台 `validateItemPageQuery` **一个都不接受** → 选任意一个都 422。而 422 被显示成**「商品工作台暂时无法获取,请重试」**——**把永久性的词表不一致伪装成可重试的临时故障。**

且列表列显示的值与筛选器候选值是**两套完全不相交的词表**。

**不变量**:筛选器候选值、后台接受值、列表显示值**三者同源**。

**判别性测试**

| 用例 | 断言 | 挡住什么 |
|---|---|---|
| 读侧 | 遍历筛选器每个选项各发一次请求,**全部 2xx**;返回结果的该字段取值落在候选集合内 | 现状:三个选项全 422 |
| **写侧(必做)** | 保存商品时把治理状态写成**候选集合外**的值 → **被拒**,不是静默透传 | ✅ **反例**:`saveItem` 透传 `sections`,只修读侧的话,客户端仍可写进任意值,列表随后再也筛不到它。**只有读侧用例挡不住这个** |

## 4.5 库存写命令的双重 `targetRef`(本轮新增)

**缺陷事实** ✅ 四个库存写 operation 的 **body 与 path 都声明了 `targetRef`**,而实现只用 path(例如 Count 那条取的是 `invocation.targetRef()`)。`body=A, path=B` 时的写入语义**未定义**。

**不变量**:同一标识只有**一个权威来源**。要么 body 侧删除,要么强制二者相等。

**判别性测试**:四个 operation **各一条**负向用例,body 与 path 给不同值 → 按裁定要么被拒、要么明确以某一方为准且有断言。**四条都要,不能只测一个再推广**——它们是四份独立的 operation 实现。

---

# 5 · 后台一行级

| # | 缺陷事实 | 不变量 | 判别性测试 |
|---|---|---|---|
| 5-1 | ✅ 本地转正时把**自身** `dataNodeRef` 写进 `source_scope_ref`,而来源判定是 `null ? SELF_MANAGED : COPIED` → **本地转正商品被标成"复制来的"**,并被来源筛选的 COPIED 分支命中 | 本地转正 = `SELF_MANAGED`;跨 scope 复制 = `COPIED` | 两个方向各一条,断言来源事实与筛选结果都对 |
| 5-2 | ❓ 分页**静默截断第 5001 项**,截断结果继续传播到 inventory 与 production 协调 | **裁定:超过上限一律显式拒绝,不做部分成功**——不得返回"不完整但 2xx"的库存结果。<br>❓ **同时要查一件事**:调用方传的是**整个 scope 的商品**还是**当前页**。如果是整个 scope,那 5000 这个上限只是症状,**真正的缺陷是不该一次问 5000 个**,该改成按页问。查清后若属后者,本条判据改为"按页传递",拒绝那条降为兜底 | 构造 5001 项 → ① **明确失败**并说明超限;② 下游**未被调用**;③ 5000 项及以下正常返回 |
| 5-3 | ❓ `catch (RuntimeException failure)` 捕获后**从未使用 `failure`**,一律抛 `SCOPE_FORBIDDEN` | 原因链保留 | 注入一个非权限类异常,断言不被伪装成 SCOPE_FORBIDDEN |

---

# 6 · 局部复制

> **适用范围:所有本地复制可达的 catalog item,不依赖 manifest shape。**
> 本节的结果模型(`skipped` 原因码、preflight 与 execute 的一致性)是复制规则,不是 `skuMode` 规则。

## 6.1 八个 section 选项,六个是静默空操作

**缺陷事实** ✅ 写入用 `if (json(source.sectionsJson()).has(key))` **静默跳过不存在的 key**,而当前发布的 8 个 section 选项里 **6 个映射到从没人写过的键**(如 `SKU_STRUCTURE`),`skipped` **恒空**。

### 八个 section 的映射(**本轮定死,前一版只说"对齐"没说对到什么**)

✅ 实施时发现枚举与真实保存模型脱节:`SKU_STRUCTURE` 去找不存在的 `skuStructure`,
`BASIC_INFO` 不是单个 sections 键,三个 BOM 类是 Inventory 的事实而 Catalog 没有对应持久化键。

| section | 归属 | 映射到什么 |
|---|---|---|
| `BASIC_INFO` | Catalog | `catalog_item` 的列(name / shortName / attributes)**加**若干 sections 字段——**不是单个键** |
| `SKU_STRUCTURE` | Catalog | **`skus` + `skuVariantDimensions`**(拆表后是两张表),**不是 `skuStructure`** |
| `ORDER_OPTIONS` | Catalog | ✅ 真实存在;拆表后是 §1.1-F 的两张表 |
| `PACKAGE_STRUCTURE` | Catalog | `compositeGroups`(拆表后是组合组 + 组件两张表) |
| `PRODUCTION_PROMPTS` | Catalog | `productionProfiles` |
| `SKU_BOM` | **Inventory** | `stock_bom` 中按 `product_sku_ref` 的行 |
| `OPTION_VALUE_BOM` | **Inventory** | `stock_bom` 中按 `option_value_ref` 的行 |
| `ITEM_BOM` | **Inventory** | `stock_bom` 中按 `item_ref` 的行 |
| ~~`PRINT_NAME`~~ | **无** | ✅ 映射到 `"printName"`,而该键**全仓只在那一行 switch 里出现过**——无写入点、无读取点。**从枚举里删除** |

**三条 Inventory 的必须走跨 owner 编排**:catalog 复制自己的事实,再**调 Inventory 的复制命令**。
`CatalogInventoryCoordinator` 已经是这个编排点。**catalog 不得直接写 inventory 表。**

**「源端不存在」的判定**:`SKIPPED_SOURCE_ABSENT` 只能表示**源商品确实没有这类内容**。
一个**恒为 absent** 的 section(因为映射到不存在的键)是 `SKIPPED_UNSUPPORTED`,**而这种 section 根本不该发布**——
所以 `PRINT_NAME` 是删除,不是标 unsupported。

**不变量**

1. section 选项**必须与 owner 实际写入的键集对齐**
2. `has(key)` 为假**必须写进 `skipped`**——空操作必须变响。**且 `skipped` 必须带稳定的原因码**,至少区分 `SKIPPED_SOURCE_ABSENT`(源端没有这块内容)、`SKIPPED_UNSUPPORTED`(该 section 本就不支持)、`REJECTED_INVALID`(输入非法)。**"有 skipped 但说不出为什么跳过"不算做完**
3. 不存在"选了但什么也不会发生"的选项

**判别性测试**

| 用例 | 每个 section 选项都真的做事 |
|---|---|
| 做法 | 对 8 个实际发布选项**逐一**单独选中执行复制 |
| 断言 | ① 每个选项要么产生可观测的目标侧变化,要么出现在 `skipped` 里并说明原因;② `skipped` **不再恒空** |
| 挡住什么 | **反例**:把 6 个死选项从 UI 删掉但后台还在 → ① 仍红(后台仍静默);**反例乙**:填了 skipped 但内容是空字符串 → ② 要求有原因 |

## 6.2 📗 v4 四件缺一不可(v2s 当前都没有)

| # | v4 的做法 ❓ | 不变量 |
|---|---|---|
| 1 | 依赖与形态适用性是**后台硬校验**(选了 SKU 扣料却没选 SKU 结构 → 422) | 不合法的 section 组合被后台拒绝,不是前端提示 |
| 2 | **先给所有子实体铸新 ID 建全量映射表,再重写引用** | 不存在"边建边解引用"的中间态 |
| 3 | 任何解引用失败**立刻抛**;跨 owner 的库存对象需用户**显式匹配**,不能自动猜 | 无静默降级 |
| 4 | 必须**补发 `NONE` 规则清理目标残留** | 能区分"没配"和"明确清空" |

**不要抄** 📗 v4 的 `PRINT_DISPLAY_NAMES` scope——它是 v4 为自己打印规则历史包袱服务的横切 scope,v2s 无对应域。

## 6.3 预检与执行必须同一失败语义(本轮新增)

> ⚠️ **订正:前一版的缺陷事实是错的,照它写出来的"修复前是红的"会是假红。**
> ✅ 亲验:`selectedSections` 为空**已经被拒**(共享校验路径,422 `selectedSections is required`),**不存在"preflight 绿、execute 红"**。

**真实缺陷事实** ✅ **未知但非空**的 section 能穿过 preflight,到执行阶段才在 section 映射处失败(`default ->` 抛 422 `contains an unknown section`)。用户在预检拿到"可以复制",执行才被拒。

**不变量(限定在静态输入校验)**:凡是 execute 因**输入形状**拒绝的,preflight **必须以同一失败码与理由拒**。

> ⚠️ **限定必须写清,否则这条不成立。** "预检通过 = 执行会过"**只对静态输入校验成立**。
> 版本变化、digest 变化、源数据在两次调用之间被改动 —— 这些都**允许 execute 返回 stale 而 preflight 是绿的**,
> 那不是缺陷,是两次调用之间世界变了。**本节只管输入形状那一类。**

### 四类输入的统一结果模型(必须逐类定死)

| 输入 | preflight | execute |
|---|---|---|
| **空** | 422 拒绝 ✅ 已如此 | 422 拒绝 ✅ 已如此 |
| **未知非空** | **422 拒绝**(当前穿过 ← 本条要修) | 422 拒绝 ✅ 已如此 |
| **重复** | **422 拒绝**(已裁定) | 同 preflight |
| **合法但源端缺失** | **不拒绝**,列入 `skipped` 并给稳定原因 | 同 preflight,且 `skipped` 内容一致 |

> 「合法但源端缺失」这一类与 §6.1 是同一件事——**空操作必须变响**,见 §6.1 的 `skipped` 原因分类。

**判别性测试**

| 用例 | 断言 | 挡住什么 |
|---|---|---|
| 未知非空 section | preflight 与 execute **返回相同失败码与理由** | **反例**:只在 execute 校验(现状)→ preflight 仍 2xx |
| 合法但源端缺失 | 两阶段都不拒绝,且 `skipped` **内容一致** | **反例**:preflight 说会复制、execute 静默跳过 → 两阶段结果不一致 |
| 重复 section | 两阶段**都 422 拒绝**,失败码与理由相同 | **反例甲**:preflight 去重、execute 报错 · **反例乙**:两边都静默去重 → 拒绝断言红 |

**裁定(Dexter 授权我定):重复即拒绝,不去重。**

理由不是"客户端有 bug",而是**去重会污染上面刚定死的输出模型**:`selectedSections` 语义上是**集合**,而 `skipped` 是**按 section 索引**的。
同一个 section 出现两次时,`skipped` 该有一条还是两条?去重就让这个问题变成未定义。
**拒绝把参数的集合语义显式化,输出模型保持无歧义。** 附带好处:真实 UI 是勾选框,产生不出重复,所以这条只会命中脚本类客户端——**告诉一个有 bug 的客户端它有 bug,是对的。**

---

# 7 · 业务自测

P3-1 的验收**靠后台业务自测,不靠前端点得通**。这是把前端放到 P3-2 的前提。

> ⚠️ **订正,并需 Dexter 裁定一项。**
> 前一版写"按标准扩 catalog 的 `*AcceptanceScenarios.java`"。✅ 亲验:现有 scenario 文件只有
> `AssetAcceptanceScenarios` / `CommercialContractAcceptanceScenarios` / `OrganizationAcceptanceScenarios`(加 IAM),
> **没有 catalog group**,而 `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md` 只授权那四个 domain group。
> **默认新建第五个 group 会绕过那份主动规范。**
>
> **裁定(Dexter 授权我定):正式为 catalog 新增第五个 domain group。**
>
> **为什么不选"绕开它、放模块自己的集成测试"**:`CLAUDE.md` 写明「后台动态验收的**唯一能力**是 `backend-acceptance`」。
> 把 catalog——**这一轮改动最大的域**——的业务验收放到平行轨道上,等于让那个"唯一"名不副实,
> 也就制造了两套验收故事。**这正是本工单一路在扣分的"两份真相"。**
> 反对的理由只有一条:要改一份主动规范。**那是成本,不是无效。**
>
> **实施顺序:这是 §7 的第 0 步,先改规范再写场景。**
>
> **改规范时必须守住它当初为什么存在**——196 个 provider 壳被下线是因为**假覆盖**,不是因为贵。所以新 group 必须与现有四个同形:
> 真实 HTTP、真实容器、手写 fixture / request / business assertion、`CONTRACT` 与 `BUSINESS` 分离产出。
> **不得引入 provider 壳、共享 SPI 或 scenario registry**(均已退役)。
>
> 额度:当前 18 条,本节 8 条,合计 26,**远在 80 上限内**。规范里要写清 catalog 的注册位置与发现规则。

### 第 0 步必须同批改的五处分母(**漏一处,新 group 加完测试就是红的**)

⚠️ ✅ `scripts/test/backend-acceptance-structure.test.mjs` **硬编码了四个 scenario 文件名与 18 这个条数**。
只新增 `CatalogAcceptanceScenarios` 而不动它,**既有测试必然失败**——这是第五条开工判据"每个分母都要有 before/after 映射"
在本节的落点,前一版只写了引用矩阵那一处,**漏了这一处**。

| # | 分母 | before | after |
|---|---|---|---|
| 1 | group 文件集合 | 4 个 | **5 个**,新增 `CatalogAcceptanceScenarios.java` |
| 2 | discovery catalog(`BackendAcceptanceScenarioCatalog`) | 4 | **5** |
| 3 | structure test 的 `scenarioFiles` 数组 | 4 项 | **5 项** |
| 4 | structure test 的 expected scenario count | 18 | **26** |
| 5 | 主动规范的 group 列表 | 4 | **5** |

✅ `scripts/test/test-health-entry-runner.mjs` **不需要新增入口**——改的是已登记的结构测试文件本身。

### 落点写死(前一版只说"扩 catalog",不可实施)

✅ 照现有四组的形态:类文件 `src/test/java/com/catering/v2s/app/acceptance/CatalogAcceptanceScenarios.java`,
`final class CatalogAcceptanceScenarios`,静态引入 `BackendAcceptanceTest.*`,
每条方法标 `@AcceptanceScenario(id = ..., module = "CATALOG", operation = ...)`,**`id` 与 `operation` 取下表的实际值**,
在 `BackendAcceptanceScenarioCatalog` 里 `new CatalogAcceptanceScenarios(host)` 注册。
同批更新那份主动规范与 `CLAUDE.md` 的 group 清单。

### 八条场景(每条必须写全六项)

**每条都要给**:`scenarioId` · owner fixture 怎么造 · HTTP path 与 body 要点 · readback oracle(断言哪个业务事实) · **能挡住哪种错误实现** · **不证明什么**。
**只写标题的场景会被实现成"2xx + 存在性",那不是业务断言。**

> ⚠️ **订正:注解的 `operation` 是单值。** ✅ `AcceptanceScenario` 第 13 行是 `String operation();`,
> 筛选逻辑也只做单字符串相等比较。**前一版在场景 4、5、7、8 里写了两三个 operationId,那不是可筛选的真实值。**
> 改成两列:**发现键**(单值,进注解)与**实际 HTTP 调用**(可多个,场景内按顺序发)。**不改框架、不把注解改成数组。**

> ⚠️ **订正:场景 1 的入口写错了。** ✅ `createOperationsCatalogItem` 只接收 `code` / `name` / `shapeKey` / `attributes`,
> `createItem` 建出来的是**空 `sections`**;维度与 SKU 只能经 `saveOperationsCatalogItem` 提交。
> **"一次 POST 建成 2 维度 4 SKU"在当前契约下做不到**,照原样实施只会变成两种结果:造不出夹具,或者**偷偷扩大 create 契约**。
> 改成两步真实 HTTP。**若将来确实要一次建成,那是新增 create 请求契约与 owner command 的范围,不在本轮。**

| # | `scenarioId` | 发现键 `operation`(单值) | 实际 HTTP 调用(按顺序) | 业务事实(oracle 断言) | 挡住的错误实现 |
|---|---|---|---|---|---|
| 1 | `catalog.item-with-sku-matrix-create` | `saveOperationsCatalogItem` | `POST .../items` 建壳 → `PATCH .../items/{itemCode}` 提交 2 维度 4 SKU | 保存后 **4 个 SKU 各有后端铸的 ref、digest 两两不同** | "必带 ref";digest 恒等 |
| 2 | `catalog.sku-removal-blocked-by-inventory` | `saveOperationsCatalogItem` | inventory 真实写路径建 `stock_target` → `PATCH .../items/{itemCode}` | 被库存对象引用的 SKU **删不掉且指名是谁**;未被引用的删得掉 | 一律拒绝;一律放行;拒绝但已写入 |
| 3 | `catalog.sku-code-change-keeps-inventory` | `saveOperationsCatalogItem` | 同上建 `stock_target` → `PATCH` 改编码 | 改 SKU 编码后**库存挂靠不丢**,ref 不变 | 按 code 匹配 → 变成删一个建一个 |
| 4 | `catalog.dictionary-rename-and-void` | `updateOperationsCatalogDictionaryEntry` | `PATCH .../dictionaries/{kind}/entries/{entryCode}` → `GET .../items/{itemCode}` → 对 catalog/BOM 引用值 `POST .../status` → 对无引用值 `POST .../status` | 字典改名后商品**跟着变**;引用值作废被 typed 拒绝且事实不变;无引用值可作废 | 存了快照;只查一侧引用;一律拒绝作废;拒绝但已写入 |
| 5 | `catalog.code-release-voided-not-archived` | `transitionOperationsCatalogItemStatus` | `POST .../items/{itemCode}/status` → `POST .../items` 复用同码 | 作废商品的编码**可复用**;归档商品的编码**不可复用** | 全释放;全不释放 |
| 6 | `catalog.asset-ref-scope-isolation` | `releaseOperationsCatalogStagedAsset` | workspace A/B 各 `POST .../assets/stage` 同一字节 → A `POST .../assets/{assetRef}/release`;同一 workspace 内品牌 A 先 stage 并经真实商品保存使资产 ACTIVE，再由品牌 B stage 同一字节 | 跨 workspace 各有独立 `assetRef`;A 释放不影响 B 的逻辑资产;同 workspace 跨品牌对**已 ACTIVE**的同字节内容复用同一 workspace 级 `assetRef`，不伪造两份独立状态 | 把跨 workspace 隔离误实现成只加 `data_node_ref`;把同 workspace 共享误建成品牌级逻辑资产 |
| 7 | `catalog.local-copy-section-outcomes` | `executeOperationsLocalCatalogCopy` | `POST .../copy/local/preflight` → `.../execute`,8 个实际发布 section 逐一 | 每个 section **要么产生可观测目标侧变化,要么进 `skipped` 并带原因码** | 静默空操作;`skipped` 恒空;有条目但无原因 |
| 8 | `catalog.category-relation-integrity` | `deleteOperationsCatalogCategory` | `POST .../categories` → `PATCH .../items/{itemCode}` 挂分类 → `DELETE .../categories/{categoryRef}` | 分类被引用时的删除约束、商品↔分类**两个方向**的反查结果正确 | 关系行没删干净;移除一个分类把其他分类也清了 |

**每次真实调用仍按现有 route registry 的真实 operationId 观测**,发现键只用于场景筛选。

**跨 owner 夹具(场景 2、3、6)必须写清**:场景 2、3 需要先经 inventory 的真实写路径建 `stock_target`;
场景 6 需要两个独立 workspace 各自可用的 catalog scope，并在其中一个 workspace 内造两个品牌的有效执行上下文。跨 workspace 验证的是逻辑资产隔离；同 workspace 跨品牌须先让首个资产进入 `ACTIVE`，再验证内容复用的 workspace 级身份与既有授权路径。`STAGED` 的不同 intent 可能正确返回幂等冲突，**不得把该生命周期保护误判为品牌隔离**；本场景不宣称品牌级持久化隔离。
**这三条的夹具不是 catalog 单域能造出来的,不写清就会被实现成同域的假场景。**

> ⚠️ **第 8 条已替换。** 前一版写"分类树不出现全表扫"。✅ 该能力的 DB 调用数**只打印、不设门**,
> 性能与结构证据**不属于 backend-acceptance**。`EXPLAIN` 与"不再全表扫"的结构断言留在迁移或模块集成测试里(见 §1.0 的限定)。

**每条场景还要写明不证明什么。** 例如第 2 条不证明并发下的正确性(那是 A-7),第 5 条不证明历史读取(本轮不提供)。

**判据**:每条场景的断言是**业务结果**(数据状态 + 用户可见输出),不是"接口返回 200"。

**每条场景都要按 §0 通则写全**:夹具怎么造(走哪个真实接口、造几条什么状态的数据)、断言什么、挡住哪种错误实现、挡不住什么。
上一版这八条只写了场景名,**自己违反了 §0 通则第 1 条**。场景 2、3、6 的夹具尤其要写清——它们跨两个 owner,夹具建错了整条场景就是假的:

- 场景 2 / 3 的 `stock_target` 必须走 inventory 的**真实写接口**建,不是直接 INSERT
- 场景 5 的"作废后复用编码"依赖 §3.2 已生效,**排在 §3.2 之后**
- 场景 6 的隔离夹具必须是**两个不同 `workspace_uuid`**；同 workspace 跨品牌只证明共享逻辑资产与既有授权路径，不复用 §1.1-E/E-1b 的 catalog 引用 scope 判据

---

# 8 · Seed

**现状** ✅ 三个 executor **零直接 SQL,全走 HTTP**(39 / 32 处 fetch)。**这个形态是对的,必须保住。**

**为什么这一节不是收尾杂活**

seed 是 P3-1 的**第一个真实消费者**。拆表 + 白名单 + 契约改完,seed 会立刻撞上新约束——**这是一次免费的集成测试**。撞上之后有两条路:把 seed 改对,或者把约束放松让 seed 过去。**第二条更省事,而且改完门还是绿的。这是 P3-1 最容易悄悄失败的地方。**

> ⚠️ **授权边界(前一版没写)**:seed 的**执行**需要单独的 runtime/seed 授权,并且要在**隔离且可回收的命名空间**里跑。
> 本节的判据是**未来获得该授权后**的验收标准,**不是本轮的普通测试**,也**不能作为 P3-1 实施完成的证据**。
> P3-1 收尾时能做的只有静态部分:seed 脚本是否仍走 HTTP、是否手工填写了派生字段。**跑不跑得通要等授权。**

**不变量**

1. seed 继续走 HTTP,**不得为了性能改成直接 INSERT**——直接 INSERT 能造出用户造不出的状态,后面所有测试都在测幻觉
2. seed 跑不通时,**默认结论是 seed 错了,不是约束错了**。要放松约束必须单独说明理由并留证
3. seed 必须覆盖**新模型才有的形态**,最关键一条:**两个商品共用同一个字典属性值**。没有它,拆表带来的复用能力在 DEV 里根本看不出来
4. seed 数据不得手工填写派生字段(`skuSummary` / `missingPriceCount`)——❓ 当前 seed 计划里这两个字段零命中,**保持零命中**

**判别性测试**

| 用例 | seed 产出的状态用户也能产出 |
|---|---|
| 做法 | 对 seed 建出的每类商品,用同样的请求体走一次真实接口。**必须用两个隔离的命名空间**(或对 readback 做规范化后再比) |
| 断言 | 两条路径产出的数据状态**等价** |
| ⚠️ 陷阱 | **同一命名空间里重放 create 会合法触发 `DUPLICATE_CODE`** —— 那是正确行为,不是缺陷。不隔离就会把这条用例做成假红 |
| 挡住什么 | **反例**:seed 走了某个后门参数或跳过某个校验 → 不等价 |

| 用例 | seed 覆盖字典复用 |
|---|---|
| 断言 | ① seed 后至少有两个商品引用**同一个** `SKU_ATTRIBUTE_VALUE` 字典行;② 改该字典行的名称,两个商品**同时**变 |
| 为什么必须有 | 这是 Dexter 要的"口味不用每次新建"在 DEV 里唯一可见的证据 |

---

# 9 · 明确撤回 / 明确不做

**以下三处在前一版工单的拆表清单里,本文撤回**——v2s 侧**零反查、零唯一性需求、零列表谓词**,当时的理由栏写的是"v4 有这张表":

| 撤回项 | 撤回理由 |
|---|---|
| ~~下单选项 / 选项值~~ | ⚠️ **本轮反转,该撤回作废,改为拆表(见 §1.1-F)。**<br>当初撤回的理由是"自身零反查",那个测试**没错,是判据不完整**——§1.0 当时只有判据甲(谁来查我),缺判据乙(谁来指我)。<br>`attributeValueRef` 需要一个归属者,JSON 路径不是能放进外键的归属者。**这是实施阶段撞出来的,不是评审阶段看出来的。** |
| 生产提示 | v2s 契约本来就是开放 map,逐实例**今天就能表达**;零反查 |
| 识别码 / 条码 | 零反查、零唯一约束 |

> **撤回理由的限定**:三处撤回**只依据当前 v2s 静态源码里找不到反查**这一条。
> 📗 v4 为什么有这些表(批量导入去重等)属于 v4 的历史原因,**不构成 v2s 现在必须拆的理由,也不构成不拆的理由**——它只是解释了 v4 为何不同。
> 同样,"将来要做扫码或导入"是未来需求,**不是本轮仓内事实**。真要做时重新按 §1.0 判据评一次,不要拿未来需求反推现在。

**变体轴仍要拆,但理由换了。** 前一版写"唯一性 + 排序"——那两条都发生在同一商品自己的 JSON 数组内,不构成外部查询。真正的理由是 📗 **v4 在这里有明确的建模缺陷,而 v2s 会继承它**:v4 的 per-item 维度表只存 `sales_attribute_id + display_order + status`,**根本没有"这个商品选了哪些值"这一列**,读回 SQL 也没有商品条件 → **重开一个已存在的商品,属性值多选框显示该属性下全部值都被选中**。v2s 拆表时**必须存已选值集合**。

**字典不拆**:`catalog.dictionary_entry` 表已存在且已支持跨商品复用。用户觉得"每次都要新建"是**前端没给选择器**——修法在 P3-2,不在这里。

**`inventoryBom[]` 从 catalog 契约中删除**:owner 边界错放,`inventory.stock_bom` 已存在。

**`productionProfiles` 自由内容与 `attributes` 不拆**:只被"已拿着这一行"的路径读,无唯一性无反查。

---

# 10 · 去向表(带分母)

> 上一版工单**没有这一节**,结果整个前端层无声掉出去。本节是防同类错误的唯一手段:分母对不上就是没写完。

**商品域全集来源**:六份上游评审文档 + 一路不读文档直接翻代码的独立扫描。

| 分类 | 条数 | 去向 |
|---|---|---|
| 建模层 | 66(去重后) | **本文 §1 / §2** |
| 契约层 | 17 | **本文 §4** |
| 编码 | 17 | **本文 §3** |
| 局部复制 | 11 | **本文 §6** |
| **P3-1 小计** | **111**(亲验 44 / 待核 47 / 已撤回 9 / 未标 11) | 本文 |
| 控件层 | 115 | **P3-2**,但**三族的契约那一半已挪进本文 §12**:约 55 处裸枚举 → §12.1 · 五处手打编码/UUID 控件 → §12.2 · SKU 矩阵与属性值控件 → §12.3。**这三族在 P3-2 只剩前端接线** |
| 解码层 | 15 | **P3-2** |
| 提交层 | 27 | **P3-2**(六条 422 的正确修法依赖本文 §4.1) |
| 其他 / 已路由 | 87 | 第零批(已实施)· 第一部分 · 第二部分 · 已作废 |
| **文档外新发现** | **25** | 3 条进本文 §4.3 / §4.4;其余待分派到 P3-2 |

**IA 分母** ✅ 五路独立复算收敛:**89**,不是 76。
机器源:`doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md` §11.3,另有三份 JSON 实例(`contracts/policy/catalog-inventory-assertion-matrix.json` 等,`iaIdCount: 89`)。
`76` 是**三段式正则漏掉 13 条四段式 ID**(`IA-CAT-COPY-LOCAL-*`、`IA-INV-ACTION-*` 等),76 + 13 = 89 算术闭合。**那 13 条恰好覆盖库存四类写操作与同库复制向导,是风险最高的写路径。**

**分母的 scope 需裁定**(P3-2 开工前):89 是"商品目录 + 门店轻库存"合并分母;严格商品域是 CAT 47 + COPY 8 = 55,另加 NAV/STATE/CONTRACT 共用 24 条。

---

# 10.5 · 实施顺序:六个批次(**本轮新增**)

> **P3-1 不拆成两份工单。** 五轮评审才收一份文档,再切一次等于重来。
> 但必须定死批次顺序,**让实施过程永远不处在双真相状态**。

## 铁律:按对象族原子切换

✅ 实施中出现的真实困境是——新表建好了,而保存、详情投影、复制图、反向 guard 仍在读 `sections` 里的旧键;
**现在删 JSON 会立刻打断详情、复制与库存投影;暂时保留就是双真相。**

**解法不是"先建完所有表再统一切读",而是每一族:读路径 + 写路径 + 删 JSON 键,同一次改动里完成。**
✅ 清库裁定让这条更容易——**没有回填,切换只是代码加 schema**。

**判据**:任何一次可交付的改动结束时,**不存在任何一个事实同时活在 JSON 与表里**。

### "读路径"指的是这七个,不是只有详情投影

> ⚠️ **前一版没有把这七个列出来,导致"读路径"被读窄成"详情投影",而批次表又把复制整个写成批次五**——
> 两者叠加就变成"批次三删了 JSON、批次五才改复制",中间那一段品牌复制是坏的。
> **一份能被读成两种意思的规格,一定会被按错的那种实现。**

每一族的原子切换**必须同批扫完下面七个消费方**,少一个就是发布路径被打断:

| # | 消费方 | ✅ 以 SKU 族为例的实证落点 |
|---|---|---|
| 1 | 保存写入 | `saveItem` |
| 2 | 详情投影 | `itemDetail` / `skuRows` |
| 3 | **品牌复制闭包** | `rawSkuRows(json(row.sectionsJson()))` · `skuRefsByCode(json(existing.sectionsJson()))` · `closureGraph` · `validateCopyCompatibility` · `referenceMapping` · `copyDigest` |
| 4 | **本地复制搬运** | `if (json(source.sectionsJson()).has(key)) merged.set(key, ...)` —— 按 section 键整块搬 JSON |
| 5 | **库存投影** | `catalogInventoryProjection` · `skuNamesByItemCodes` |
| 6 | **引用反查与守卫** | 资产引用反查 · 字典作废守卫 |
| 7 | **归属校验** | `skuOwnerByRef` · `validateCatalogRelationRefs` |

**这七个是每一族都要过一遍的清单,不是 SKU 独有。** 分类关系、组合、选项组值、统一引用族同理——
它们各自在这七处都有 JSON 读点,切换时一起改。

### 批次五只保留"非逐族"的部分

**批次五不是"复制批次"。** 它原来的内容要拆开:

| 原属批次五 | 实际归属 |
|---|---|
| 每一族的复制**数据路径**(闭包读什么、搬什么) | **溶进批次三**,随该族切换 |
| 九个 section 的**映射语义**、删 `PRINT_NAME` | 批次五 |
| **跨 owner 编排**(三个 BOM 类调 Inventory 复制命令) | 批次五 |
| preflight / execute **统一结果模型**与 `skipped` 原因码 | 批次五 |

**判据**:批次三每一族做完时,**该族的品牌复制与本地复制都仍然可用**——不接受"批次三期间暂时拒绝复制"。
临时下线一个已发布能力,与"原子切换后路径可用"直接冲突。

### `SKU_STRUCTURE` 映射错误必须在 SKU 族切换的同一批修

✅ **这是一个独立的既有缺陷,与拆表无关**:`sectionKey("SKU_STRUCTURE")` 返回 `"skuStructure"`(第 880 行),
而保存与详情用的是 `skus`。**今天本地复制就复制不了 SKU**,它会被误判成 `SKIPPED_SOURCE_ABSENT` ——
这正是 §6.1 那七个静默空操作之一。

**为什么不能留到批次五**:SKU 族切换之后,"复制 `SKU_STRUCTURE`" 的正确含义变成"复制 SKU 关系行"。
映射还指着一个从不存在的键,等于批次三交付了一条仍在找 `skuStructure` 的复制路径。**同批修。**

## 六个批次

| 批次 | 内容 | 依赖 |
|---|---|---|
| **1 · 契约与词表** | 枚举规范源与标签下发(§12.1)· 五条契约漂移(§4.2)· 派生字段移出请求(§4.3)· 治理状态词表(§4.4)· 双 `targetRef`(§4.5)· picker 端点字段保证(§12.2) | 无 |
| **2 · inventory 解绑** | inventory 停止按 `item_code` 关联(§3.1)· **Inventory typed dependency API**(§1.1-A 前置) | 无 |
| **3 · 拆表** | 七族逐族原子切换:SKU · 分类关系 · 组合 · SKU↔属性值 · **选项组+选项值** · 无序引用 + 商品图片 + SKU 媒体三张关系表 · 提列。`sections` 白名单与集合调和随最后一族落 | 无(但族间有序:SKU 先于 SKU↔属性值,选项组先于选项值) |
| **4 · 编码释放** | §3.2 · §3.3 · §3.4 | **批次 2** |
| **5 · 局部复制** | 九 section 映射 · 删 `PRINT_NAME` · 跨 owner 编排 · preflight/execute 统一结果模型(§6) | **批次 3** |
| **6 · 验收与 seed** | 第五个 acceptance group 与八条场景(§7)· seed(§8) | 全部 |

**批次 1 与 2 无依赖,可并行。批次 3 是主体。**

---

# 11 · 不变量 → 用例对照表

> 本工单的机制是"测试是形态的载体"。**没有用例的不变量等于不存在**——它会被读成注释。
> 上一版 §1.1-A 列了 8 条不变量却只有 4 条用例,一半无人守。本表是防同类错误的唯一手段:**对不上的格,要么补用例,要么把那条不变量降成"建议"并写明为什么测不了。**

| 不变量 | 守它的用例 |
|---|---|
| A-1 ref 与 code 解耦、终身不变 | A-2 |
| A-2 归属一次查询可验证且走索引 | A-1 + `EXPLAIN` 补证 |
| A-3 item 内 `sku_code` 唯一 | `CatalogCategoryOwnerIntegrationTest#skuCodeDefaultAndDisplayOrderInvariantsRejectBeforeChangingPersistedFacts`：同商品重复 `skuCode` 的 owner 拒绝 + 直接插入重复行的数据库完整性负探针 |
| A-4 变体组合唯一 | `CatalogCategoryOwnerIntegrationTest#requiredMatrixRejectsDuplicateOrPartialActiveSkuCombinationsBeforeAnyWrite` + `#databaseVariantDigestConflictIsTranslatedToTheTypedCombinationProblem` |
| A-5 至多一个默认 SKU | `CatalogCategoryOwnerIntegrationTest#skuCodeDefaultAndDisplayOrderInvariantsRejectBeforeChangingPersistedFacts`：422 拒绝双 default，重读保持唯一 default，不自动改写 |
| A-6 稳定排序键 | `CatalogCategoryOwnerIntegrationTest#skuCodeDefaultAndDisplayOrderInvariantsRejectBeforeChangingPersistedFacts`：显式 `displayOrder` 重读稳定，新增 SKU 不改变旧顺序 |
| A-7 软归档 + 引用保护 | A-4 · A-5 · A-6；`InventoryCatalogReferenceDependenciesIntegrationTest` 与 `CatalogCategoryOwnerIntegrationTest#skuRemovalAndInventoryTargetCreationCannotBothCommit` 覆盖 owner 查询与竞争边界 |
| ~~A-8 version 不作并发令牌~~ | **撤回。** 本轮**没有 SKU 独立写命令**,SKU 只能随整商品保存,所以"SKU 行 version 不作令牌"**在真实 owner 路径上不可观测**——写不出能红的用例。<br>不可观测的不变量等于注释,按本工单自己的规矩应当删除,而不是留着当装饰。<br>并发语义由**商品级 `expectedCatalogVersion`** 承担,那条本来就有用例。**将来若引入独立 SKU 写命令,再重新定义并配用例。** |
| A-9 同商品内 ref 不重复 | A-0b |
| 引用源集合相等(封口) | A-6 · D-4 |
| B 多对多关系行 | B-2 |
| B 两个方向都走索引 | B-1 + `EXPLAIN` 补证 |
| B 引用检查基于关系行 | `CatalogCategoryOwnerIntegrationTest#categoryOperationsUseOpaqueRefsAndAllowDeleteThenCodeReuse` 的 owner 行为覆盖 + `scripts/test/catalog-p3-model-migration.test.mjs` 结构断言：`categoryReferencedItems` 命中 `catalog_item_category`，不含 JSON 扫描 |
| C(a) 从 JSON 拆出 | `scripts/test/catalog-p3-model-migration.test.mjs` 结构断言：`itemReferencedByOtherItems` 只查 `catalog_composite_component`，不含 `sections::text` 或 legacy fallback |
| C(b) 组级事实只存一份 | C-2 |
| C(b) 零组件组可表达 | C-1 |
| D unique(sku, attribute) | D-3 |
| D 不存快照 | D-1 |
| D catalog 引用阻断作废且 readback 不变 | D-2 |
| D 被 BOM 引用不可作废 | D-4 |
| D 无引用字典可作废 | D-5 |
| E 合并成一张表 | E-2 |
| E 每条反查带 scope | E-1 · E-1b |
| E `kind` 是受控枚举 | `scripts/test/catalog-p3-model-migration.test.mjs` 校验数据库 CHECK 与 `CatalogItemReferenceFacts` 同为 `PRODUCTION_TAG` / `CATALOG_TAG` / `SALES_UNIT`；`kind` 无用户写入口 |
| §2.1 白名单拒绝未知键 | §2.1 用例 |
| §2.2 区分增改删 | A-4 |
| §3.1 inventory 不按 code 关联 | §3.1 用例 |
| §3.2 VOIDED 释放 / ARCHIVED 不释放 | §3.2 成对用例 |
| §4.1 后端铸造 | **A-0**(本轮补) |
| §4.3 派生字段唯一计算点 | §4.3 用例断言 ④⑤ |
| §4.4 三方词表同源 | §4.4 读侧 + 写侧 |
| §4.5 `targetRef` 单一权威 | §4.5 四条 |
| §6.1 空操作变响 | §6.1 用例 |
| §6.3 预检与执行同语义 | §6.3 双向用例 |
| §8 seed 走真实路径 | §8 两条用例 |
| **§12.1** 标签字典与枚举集合相等 | 12.1-a |
| **§12.1** 三方集合两两相等 | 12.1-a |
| **§12.1** 每个 value 必有 label(结构保证) | 12.1-b |
| **§12.1** 标签字典是契约字段 | 12.1-c |
| **§12.1** `smartViews.label` 由 owner 实际输出 | 12.1-d |
| **§12.2** 端点在拆表后不缩水 | 12.2-a |
| **§12.2** 端点返回停用项不服务端过滤 | 12.2-b |
| **§12.3** digest 稳定且与 code/label 无关 | 12.3-a |
| **§12.3** 组合唯一由数据库约束表达 | 12.3-b |
| **§12.3** 归档行不占唯一性 | 12.3-c |
| **§12.3** digest 为 response-only | 12.3-d |
| **§12.3** 再启用冲突时零写入 | 12.3-e |

**当前缺 0 格**。A-3 / A-4 / A-5 / A-6 / B / C(a) / E / A-7 的真实测试或结构断言已在本表逐项列明；新增后续不变量时，必须先补本表对应测试落点，不能再次形成无守卫的注释。
这 8 条在补齐用例之前只是注释,不构成对实施的约束。

> **A-8 已删除**,不再计入分母。**seed(§8)也不计入本轮完成分母**——它的执行要等单独授权。

### P3-2 对照表(**本轮不做、不验收,列出来防止它们被遗忘**)

| P3-2 不变量 | 归属 |
|---|---|
| 前端删除内置枚举映射表;找不到标签时显示原值且可被发现 | §12.1 的前端半 |
| 五处 picker 接线;提交带 ref 不带手打编码;停用项灰显且已选不消失 | §12.2 的前端半 |
| SKU 矩阵由维度笛卡尔积生成 | §12.3 的前端半 |
| 停用属性值排除出**新组合**(老 SKU 保留由后端保证) | §12.3 的前端半 |
| 改维度重建时按 digest 保留已填内容 | §12.3 的前端半 |
| SKU 编码与名称自动生成默认值并避开已用编码 | §12.3 的前端半 |
| 默认 SKU 跨重建保持 | §12.3 的前端半 |
| 逐 SKU 手填属性值引用的控件消失 | §12.3 的前端半 |

---

# 12 · 增补:三条裁定倒灌进 P3-1 的契约

> 这三条本来是 P3-2 的题,但它们各自都要改契约,而契约是 P3-1 的活。**不在 P3-1 做,P3-2 就要回头改契约。**
> Dexter 2026-08-14 裁定:① 标签后台下发 ② 接口由我定 ③ 矩阵引擎跟 v4 一样。

## 12.1 · 枚举中文标签由后台下发

**缺陷事实** ✅ 前端约 55 处直显裸英文枚举(列表的 status / governanceStatus / source / priceGranularity / riskFlags、SKU 行 status、详情的 itemKind / measureMode / usageCapabilities、点单选项只读态的 selectionMode、字典状态列、套餐候选 description 等)。
而**整份 catalog 契约只下发 10 处标签**(`valueLabel` 八处、`label` 两处)——**这 55 处没有后台标签来源。**

❓ 佐证当初就想走这条路:`X-14′` —— 契约把 `smartViews.label` 声明为 **required 而 owner 从不 put**。做了一半停了。

### 形态(我定,不接受另外两种)

**挂在已有的 `GET /operations/catalog-inventory/shape-manifest` 上,不新增 operation。** ✅ 该端点已存在,返回 `CatalogShapeManifestView`。

manifest 里下发**一份** `(enumKind → value → label)` 字典,前端查表。

**明确拒绝的两种形态**

| 不接受 | 理由 |
|---|---|
| 每个枚举字段旁边加一个 `*Label` 兄弟字段 | 契约字段翻倍,而且**每加一个枚举就要记得加一次 Label**——这正是"枚举一次漏一次"的形态,本工单已经因为它塌过两次(见 §1.1-A 封口不变量) |
| 枚举值本身改成 `{value, label}` 对象 | 对所有现有消费方是破坏性变更,且让筛选与比较变别扭 |

### 规范源:先建源,再谈派生

> ⚠️ **订正**:前一版写"从枚举定义派生",**但没有可派生的源**。
> ✅ 亲验:`CatalogOwnerTypes` 里有 **0 个** `Set.of(`,`CatalogOwnerService` 里有 **22 个**——枚举集合散落在 22 处;
> OpenAPI 与生成物只有裸值、不承载中文。**光凭 `ENABLED` 这个值推不出「启用」。**
> 所以本节的第一件事不是"派生",是**建立唯一源**。

**第一步 · 定分母** ⚠️ **订正:分母不是"22 处 `Set.of(`"。**
✅ `CatalogOwnerTypes` 第 11 行的 `STATUSES = List.of("DRAFT","ENABLED","DISABLED","ARCHIVED","VOIDED")`
就是用户可见的 status 词表,**用 `Set.of` 去 grep 根本扫不到它**;
同文件第 10、12 行的 `SHAPES` 与 `CAPABILITIES` 还来自 `CatalogInventoryShapeManifest`——**至少三个源**。

> 我上一轮 grep `Set.of(` 得到 0,就断言"这里没有源"。**我让 grep 的形状定义了答案。**
> 这与"拿注释当行为""拿命名当证据"是同一族错误:**用一个便利的代理替代实际检查。**

**分母的正确定义:所有实际接受或输出 catalog 枚举的校验点与投影点。**
22 处 `Set.of(` 只是**初始线索**,必须至少同时纳入 `CatalogOwnerTypes.STATUSES`、
`SHAPES`、`CAPABILITIES` 以及 shape-manifest 派生值,并**逐点确认没有第四种写法**(`List.of` / `Arrays.asList` / 数组常量 / enum 类型)。
已知候选(**不完整,以实际枚举结果为准**):`itemStatus` · `governanceStatus` · `source` · `priceGranularity` · `riskFlag` · `itemKind` · `measureMode` · `usageCapability` · `shapeKey` · `selectionMode` · `lineSign` · `nodeType` · `smartViewKey` · `dictionaryEntryStatus` · `skuStatus`。

**第二步 · 建唯一源** 一份**受版本控制的** `(enumKind, value, label)` 规范源。形态不限(资源文件或单一 Java 常量结构),但必须满足:

1. **它是唯一的定义处。** 一个值只在这里出现一次
2. **三个消费方都从它取,不各自持有副本**:
   - **校验器** —— 那 22 处 `Set.of(` 全部改为向该源查询 kind 的 value 集合
   - **OpenAPI 枚举** —— 由该源生成,或以**构建期门**断言契约枚举集合与源相等
   - **shape manifest 输出** —— 由该源序列化
3. **`label` 与 `value` 在源里同行。** 加一个值而不给标签,**在源的结构上就不可能**

> **关于"派生 vs 比对"的诚实界定**:契约是签入的文件,严格意义上做不到运行期从 Java 源读取。
> 所以 OpenAPI 那一路的形态是**"源生成 / 或构建期与源做集合相等断言"**。
> 这与 Codex 点名禁止的"手写 map 再比对一下"的区别在于:**前者只有一份手写(源),另外两份是产物;后者是三份手写互相比对。**
> 实施时如果最后落成了三份手写,请直接说,**不要让它看起来像派生的**。

### 不变量(P3-1 侧)

1. 三个消费方的 value 集合与规范源**按 `enumKind` 逐类两两相等**
   ⚠️ 唯一性是 **`(enumKind, value)`**,**不是 value 全局唯一** —— `ENABLED` 可以同时属于 `itemStatus` 与 `skuStatus`
2. 规范源里每个 `(enumKind, value)` **必有 label**(结构保证,不是约定)
3. manifest 的标签字典是 **`CatalogShapeManifestView` 的契约字段**,不是运行期附加物
4. `smartViews.label` 由 owner **从同一规范源输出**(`X-14′` 的修法)

### 判别性测试(P3-1 侧,走真实 HTTP)

| 用例 12.1-a | 三方集合相等 |
|---|---|
| 断言 | 对每个 `enumKind`:① 规范源、② 校验器实际接受的集合、③ 契约枚举 —— **两两相等**,多一个或少一个都失败 |
| 挡住什么 | **反例**:22 处 `Set.of(` 留着不动,只新加一份标签 map → ①② 不等 |

| 用例 12.1-b | 加枚举值不给标签必须红 |
|---|---|
| 做法 | **用受控的测试输入或变异**注入一个"校验器接受但源中无标签"的 `(enumKind, value)`。**不修改生产集合** |
| 断言 | 完整性断言变红 |
| 挡住什么 | **反例**:label 是可选字段 → 加值不给标签仍绿,前端又冒出一个英文 |

| 用例 12.1-c | manifest 是契约字段且真实下发 |
|---|---|
| 做法 | 走**真实 HTTP** 请求 `shape-manifest` |
| 断言 | ① 响应里有标签字典且**契约里声明了该字段**;② 每个 kind 的 value 集合与规范源相等;③ 每个 value 都有非空中文 label |
| 挡住什么 | **反例**:字典只在 Java 里有、契约没声明 → ① 红,生成物拿不到类型 |

| 用例 12.1-d | `smartViews.label` 实际被 put |
|---|---|
| 做法 | 真实读取带 smartViews 的响应 |
| 断言 | 每个 smartView 的 `label` **非空**,且值来自规范源 |
| 为什么必须单独有 | `X-14′` 的现状是契约声明 required 而 owner 从不 put。**manifest 下发标签字典并不自动闭合它**——owner 那一侧要真的 put |
| ⚠️ 教训 | 前一轮有人按"前端补上 label"去修,**会让左树标题全变空**。修法必须是 owner 输出 |

> **移至 P3-2**:前端删除内置映射表、找不到标签时的显示行为。P3-1 只负责**源、校验器、契约、manifest 输出**四件事。

## 12.2 · 五处 picker 的候选数据源:**零个新接口**

**裁定:五处全部复用已有端点,不新增 operation。** 逐处点名:

| picker | 现状 ✅ | 数据源 ✅ |
|---|---|---|
| BOM 的库存对象 | `<Input addonBefore="已有库存对象">` **手打 UUID**,而组件自己的提示语写着「必须引用已有库存对象」 | `GET /operations/catalog-inventory/inventory-targets` **已存在** |
| SKU 属性 / 属性值 | 四个自由文本框,商品抽屉里**零字典 API 消费方** | `GET /operations/catalog-inventory/dictionaries/{dictionaryKind}/entries` **已存在** |
| 套餐组件的 SKU | 商品那一层用了功能完整的候选选择器,紧邻的 SKU 却是**手打编码** | 选中商品后取 `GET /operations/catalog-inventory/items/{itemCode}` 的详情 |
| BOM 的「所属选项值」 | 手打编码 | **不需要接口** —— 候选就在同一抽屉的点单选项页签里,前端本地就有 |
| 制作影响 / 生产提示 tags | `<Input>` + 逗号分隔字符串 | 生产标签候选前端**已经在传**(`availableProductionTags`) |

**所以这五处从来不是"后台没接口",是前端没调。** P3-1 侧只需保证这些端点在拆表之后仍返回 picker 需要的字段。

> ⚠️ **一条连带依赖**:套餐组件那条走的是 `items/{itemCode}`,**按编码**。§3.4 要审的"所有按编码查询的路径",**这一条在内**——编码释放之后它必须能确定地解析到有效行。

### P3-1 侧只做两件事(**picker 接线整体是 P3-2**)

> ⚠️ 前一版把"候选来自该端点""提交带 ref""停用项可见不可选"写成 P3-1 的判别性测试——**那三条全是前端行为**,越界了。

**P3-1 的判别性测试**

| 用例 12.2-a | 端点在拆表后仍返回 picker 所需字段 |
|---|---|
| 做法 | 对上表四个端点各发一次真实 HTTP |
| 断言 | 每个候选项都带 ① 稳定 ref;② 展示名;③ 状态(用于前端灰显);④ 所属 scope。**拆表前后字段集不缩水** |
| 挡住什么 | **反例**:拆表时把某个字段挪走或改名 → 前端 picker 无法灰显停用项。这是 §1 拆表的连带回归 |

| 用例 12.2-b | 端点返回已停用项,不在服务端过滤掉 |
|---|---|
| 断言 | 列表包含已停用的候选,并**明确标出状态** |
| 为什么 | 📗 v4 的做法是"停用项由前端灰显、当前已选的不消失"。**服务端提前过滤会让前端无法实现该行为**,而且已选的停用项会凭空消失 |
| 挡住什么 | **反例**:服务端 `WHERE status='ACTIVE'` → 已选停用项在编辑时消失,用户一保存就丢数据 |

**移至 P3-2**:五处 picker 的前端接线、提交带 ref 不带手打编码、停用项灰显与已选保留的交互验收。

## 12.3 · SKU 矩阵引擎照 v4 建 —— 契约四项增补

**缺陷事实** ✅ v2s 无矩阵引擎(📗 v4 是 292 行的 `buildSkuMatrix`),因此 `skus[].attributeValueRefs` **有一个独立的手工编辑控件**:「新增属性值引用」push 的是**两个空串 ref + 四个空文本框**,**每个 SKU 都要重打一遍**。

**v4 根本没有这个控件**——SKU 的属性值是从维度笛卡尔积**推导**的。**所以 v2s 这个控件是错的存在,它存在只是因为没有引擎。补了引擎它就该消失。**

### 契约的准确清单(**前一版写错了两项,已订正**)

> ⚠️ **订正**:前一版列了"四项增补",其中两项**契约里本来就有**。
> ✅ 亲验:`skuVariantDimensions[].values[]` 当前已含 `valueRef` · `valueCode` · `valueLabel` · `displayOrder` · `status`。
> **`valueRef` 就是"这个商品选了哪些值",`displayOrder` 也已存在。**
> 我的错在于:📗 v4 缺的是**它自己那张 per-item 维度表的列**,我把那个事实直接搬成了"v2s 契约缺字段",**没有打开 v2s 的契约看**。
> v4 那条对照仍然有效,但它约束的是 **§1 的建模**(拆变体轴表时必须持久化 `valueRef` 集合),**不是契约**。

**已存在,不要重复定义**

| 字段 | 位置 |
|---|---|
| `values[].valueRef` | 变体轴每根轴选了哪些值 |
| `values[].displayOrder` | 轴内值的顺序 |
| `values[].valueCode` / `valueLabel` / `status` | 读回带出(与 §1.1-D「不存快照」的关系见下) |

**真正缺失,需要新增**

| # | 新增 | 为什么 |
|---|---|---|
| 1 | SKU 的 `displayOrder` | §1.1-A 不变量 6:从数组拆成行必然丢顺序 |
| 2 | SKU 的 `variantCombinationDigest` | 一列两用:矩阵重建时按 digest 保留已填内容;同时是不变量 A-4「同商品内变体组合唯一」的约束载体 |

> **与 §1.1-D 的关系**:`values[].valueCode` / `valueLabel` 是**读回投影**,由 owner 从字典 join 出来,**不是持久化快照**。§1.1-D 的"不存快照"约束的是持久层,不是响应字段。两者不冲突,但实施时不要把响应字段当成可写入字段。

### `variantCombinationDigest` 的语义(P3-1 必须定死,不能留给 UI)

| 项 | 定义 |
|---|---|
| **写入权** | **response-only。** 该字段**不出现在请求契约里**;客户端提交它 → **wire 层拒绝**(与 §4.3「派生字段从请求契约移除」同一条规则,不做第二套)<br>⚠️ 订正:前一版写"忽略并返回 2xx",与 §4.3 直接打架。**二选一的结果是拒绝。** |
| **规范化输入** | 该 SKU 的 `attributeValueRefs` 集合,**按 `attributeRef` 升序**排序后取 `(attributeRef, attributeValueRef)` 对序列。**与顺序、与 code/label 无关**——改名不改 digest |
| **触发时机** | 在**商品保存**这一个 command 内计算并落库。**没有独立的"重建矩阵"后端 command** —— 矩阵重建是客户端行为,服务端只保证 digest 稳定可比 |
| **唯一约束范围** | `unique(item_ref, variantCombinationDigest) WHERE status <> 'ARCHIVED'` —— 归档行不参与,允许"归档一个大杯+热,再建一个新的" |
| **归档行行为** | 归档 SKU 保留其 digest,不清空;它不占用唯一性,但仍可按 digest 查回历史 |
| **读回** | 每个 SKU 的响应里带 digest。**客户端凭它做重建时的内容保留匹配——这是 P3-2 的事**,P3-1 只保证同一组合两次计算得到同一 digest |

**明确不做**:P3-1 **不**提供"重建矩阵"接口。矩阵是客户端从维度笛卡尔积算出来的,服务端只接收结果并保证 digest 与唯一性。**若将来要把重建挪到后台,那是新的 owner command,不在本轮。**

### 不变量(**P3-1 侧**,均可由后端行为观测)

1. 客户端提交该字段**被拒绝**;服务端**仅对合法请求**计算 digest。同一组合两次保存得到同一 digest
   ⚠️ 前一版这里写"被忽略",与本节的 wire 层拒绝裁定打架。**两种错误实现各能引用一处正文自证。已统一为拒绝。**
2. digest **与 code/label 无关** —— 字典改名不改 digest
3. `unique(item_ref, digest) WHERE status <> 'ARCHIVED'`,由**数据库约束**表达
6. **同一 SKU 同一属性至多一个值** —— 与 §1.1-D 的 `unique(sku, attribute)` 是同一条,digest 的规范化依赖它成立(否则同一属性两个值时排序不唯一)
7. SKU 引用的属性值**必须属于该商品已选的维度集合** —— 提交一个不在任何维度里的属性值 → 拒绝
4. 归档 SKU 保留 digest 且不占用唯一性
5. 停用/归档的属性值**不阻止已存在 SKU 的读取与保存**

### 判别性测试(**P3-1 侧,全部走 owner/HTTP,不含 UI**)

| 用例 12.3-a | digest 稳定且与 code/label 无关 |
|---|---|
| 夹具 | 商品含 SKU-1,属性值 {口味:甜, 份量:大} |
| 动作 | ① 原样再保存一次;② 在字典里把「甜」改名为「微甜」后再保存一次;③ 提交时把 `attributeValueRefs` 的**顺序颠倒** |
| 断言 | 三次得到的 digest **完全相同** |
| 挡住什么 | **反例甲**:digest 用 `valueCode` / `valueLabel` 参与计算 → ② 红 · **反例乙**:按数组顺序拼接不排序 → ③ 红 · **反例丙**:每次保存重新随机 → ① 红 |
| 挡不住 | 挡不住"两个不同组合算出同一个 digest" —— 见 12.3-b |

| 用例 12.3-b | 组合唯一由数据库约束表达 |
|---|---|
| 请求甲 | 同一商品保存两条 SKU,属性值组合**完全相同** |
| 断言甲 | 拒绝 |
| 请求乙 | **并发**两个请求各建一条同组合的 SKU |
| 断言乙 | **恰好一个成功**;事后该 (item, digest) 只有一行 |
| 请求丙 | 两条 SKU 组合**不同** |
| 断言丙 | 都成功,digest 不相等 |
| 挡住什么 | **反例甲**:只在应用层查一遍 → 甲过、**乙红** · **反例乙**:digest 算法把不同组合折叠 → **丙红** |

| 用例 12.3-c | 归档行不占唯一性 |
|---|---|
| 动作 | 建 SKU {甜,大} → 归档它 → 再建一条 {甜,大} |
| 断言 | ① 第二次成功;② 归档行**仍在**且 digest **未被清空**;③ 按 digest 能同时查回两行(一归档一有效) |
| 挡住什么 | **反例甲**:唯一索引不带状态谓词 → ① 红 · **反例乙**:归档时清空 digest → ②③ 红 |

| 用例 12.3-d | 客户端提交 digest 被拒 |
|---|---|
| 请求 | 保存 SKU 时带一个 `variantCombinationDigest` 字段 |
| 断言 | ① **拒绝**(wire 层,与其他 response-only 派生字段同一条规则);② 落库里的 digest 仍是服务端算的 |
| 挡住什么 | **反例甲**:原样落库 → ② 红 · **反例乙**:接受并忽略 → ① 红。**忽略比拒绝更坏**——客户端以为自己设置生效了 |

### 三种边界状态必须定死(前一版没写)

| 状态 | 裁定 |
|---|---|
| **空属性组合**(SKU 不带任何 `attributeValueRefs`) | digest 为**空组合的稳定值**(不是 null)。**每个商品至多一条空组合 SKU** —— 唯一约束天然覆盖。<br>**三种情形已裁定**,见下表 |
| **归档后重建同组合** | 允许(唯一索引带 `WHERE status <> 'ARCHIVED'`)。归档行保留 digest |
| **重建之后再启用旧 SKU** | **必须失败,且零写入**:此时 (item, digest) 会有两行活跃。返回 typed 冲突(409),**不得部分成功、不得自动归档新那条** |

### 空组合的三种情形 —— **这是新增的产品裁定,不是既有语义**

> ⚠️ **性质必须标清。** ✅ manifest 只声明了 `SKU_VARIANT_SALE_COUNTED` 的 `skuMode` 是 `REQUIRED_MATRIX`;
> **现有 owner 代码没有任何组合完整性校验**。下面这三条**不被当前源码证明,也不与之冲突**——
> 它们是**新加的规则**,适用范围限定在 **`SKU_VARIANT_SALE_COUNTED`** 这一形态。
>
> 前一版用"形态名就是必需矩阵"来论证,**那是拿命名当证据**——本工单已经因为这一族错误塌过四次。理由改成业务后果。

| 情形 | 裁定 | 理由(业务后果,不是命名) |
|---|---|---|
| **无维度** | **必须允许**空组合。这是唯一的 SKU | 没有维度就没有组合可言;不允许等于这个商品不能有 SKU |
| **`OPTIONAL_TABLE` 且有维度** | **允许**空组合与有组合并存 | 用户可能既卖"标准款"(不选规格)又卖若干规格款,两者要能同时存在 |
| **`SKU_VARIANT_SALE_COUNTED`(`REQUIRED_MATRIX`)且有维度** | **拒绝**空组合与部分维度留白 | 收银端要按规格出单。留白的 SKU 在点单时无法回答"这是什么规格",且会与某个完整组合的价格产生歧义 |

**判别性测试**:三种情形各一条 HTTP 用例。`REQUIRED_MATRIX` 那条要断言 **422 且零写入**;
另需一条:`REQUIRED_MATRIX` 下提交一个**只填了部分维度**的 SKU → 同样拒绝(不是只查全空)。

| 用例 12.3-e | 再启用制造冲突时零写入 |
|---|---|
| 做法 | 建 SKU-A {甜,大} → 归档 → 建 SKU-B {甜,大} → **再把 A 改回有效态**。<br>⚠️ **没有 SKU 级命令**:这一步是用 `saveOperationsCatalogItem` 提交**同时含 A 与 B 两行、带当前商品 version** 的完整数组,把 A 的状态从 `ARCHIVED` 改成有效态 |
| 断言 | ① typed 409;② SKU-A **仍是归档态**;③ SKU-B **未被改动**;④ 无任何行被写 |
| 挡住什么 | **反例甲**:启用成功 → 两行活跃同组合,唯一约束形同虚设 · **反例乙**:自动把 SKU-B 归档 → ③ 红,替用户做了没授权的破坏性动作 |

> **以下三条移至 P3-2**,P3-1 不做也不验收:矩阵由笛卡尔积生成 · 停用值排除出新组合但老 SKU 保留(**前半是客户端行为**) · 手工属性值控件消失。
> P3-1 只保证:**后端接受任意合法组合、digest 稳定、唯一性由约束表达、停用值不阻止已有 SKU 读写**。前端拿这些保证去做交互。

---

# 13 · 边界与会话出处

- 本工单**不授权**下一 Roadmap step、DEV 或数据操作
- §9 的撤回项**不要"顺手也做了"**——它们被撤回是因为 v2s 侧找不到反查,不是暂时不做
- 涉及产品语义、Journey、契约枚举语义的,本文已就地裁定的照做,其余出现时先提出
- 标 ✅ 的由我本轮亲自打开源码确认;标 ❓ 的来自独立抽取或盲审,**动手前请自行核实**——工作树有大量未提交改动,行号已大面积漂移,所有 ❓ 条目的行号只能当线索
- 本轮未编译、未跑测试、未起容器、未跑 EXPLAIN。所有性能判断是**从 SQL 文本得出的结构判断,不是实测**
