# 第三部分工单 · 商品域建模与提交路径

本文是**工单**,不是分析。每条只有两样东西:**缺陷事实**(仓内可复现)与**验收判据**(可证伪)。
修法由 Codex 定;判据写成"什么事实成立才算做完",不写"应该怎么改"。

分析材料在 `2026-08-14-v2s-catalog-domain-five-layer-merged-claude.md`,可作背景,**但该文 v3 已判 `NO-GO`**,
其中 D-2(编码释放判据)与 §5.3(七拆清单)两处结论**不作数**,以本工单为准。

行号取自当前工作树。标 ✅ 的是我本轮亲自打开源码确认过的;标 ❓ 的需 Codex 自行核实后再动手。

---

## 0 · 本轮定位

商品域今天有六条提交路径 422、一处跨租户全表扫、一处来源误标,以及一个把关系全塞进
`sections JSONB` 的模型。三者不是同一层的问题,**顺序不能颠倒**:

- 六条 422 的根因是前端一个空实现,**不依赖任何建模改动**,且不修就无法验证建模重做——新建商品提交不上去,新表只能靠单测自证;
- 拆表会改写读写路径,**必须在提交路径可用之后**做,否则没有验收手段;
- 编码释放有一条**硬前置**(见 3.2),前置不成立之前不能动。

所以分三批,顺序固定。**判据取自"先做那些不会被后续重做的部分"**,不是"先做便宜的"。

---

## 1 · 批次 3.0 · 提交路径与三处一行级缺陷

**为什么先做**:四条的根因都在建模层之外,任何拆表方案都不会改变它们的正确修法。

### 3.0-1 · 六条提交路径必然 422,根因是同一个空实现

**缺陷事实** ✅

`apps/frontend/operations-admin/.../CatalogItemDrawer.tsx` 第 38 行:

```ts
const draftUuid = (value = ''): ReturnType<typeof wireUuid> => value as ReturnType<typeof wireUuid>;
```

这是一个**类型断言,不是生成器**。无参调用返回空串,带 branded 类型通过编译,运行期被后端
`addRequiredUuid` 判 422。同一模式在第 675、684、697、725、772、840、841、927 行复用。

对照 `libraries/frontend/admin-ui-foundation/src/http/wireUuid.ts` 第 8 行:该函数**会抛**
`WIRE_UUID_REQUIRED`。`draftUuid` 恰好绕开了这道编译期已经建好的闸。

**六条 422 是同一个空实现被复用六次,不是六个独立缺陷。**

**验收判据**

1. 新建商品(含至少 2 个 SKU、1 个组合组、1 条下单选项值、1 张图片)一次提交成功,后端落库
   与请求一致;
2. 全仓不存在"把空串当作合法 UUID 通过 branded 类型"的函数;任何 `*Ref` 的客户端取值路径
   要么来自服务端已有值,要么由服务端铸造;
3. 存在修复前为红的用例,断言新建含 SKU 的商品提交返回 2xx。

**关联裁定(本工单确认,见 4.1)**:新 SKU 的 `productSkuRef` 由**后端铸造**。前端不再需要
铸造任何 `*Ref`,`draftUuid` 应随之消失而不是被"修好"。

### 3.0-2 · 资产反查跨全平台扫描,无 scope 谓词

**缺陷事实** ✅

`modules/catalog/.../CatalogOwnerService.java` 第 912 行:

```java
return jdbc.query("SELECT sections::text FROM catalog.catalog_item WHERE status <> 'VOIDED'", result -> {
```

**全仓唯一一条不带 `data_node_ref` / `brand_ref` 谓词的 catalog 读**。它回答"这个资产还有没有被引用",
于是 A 租户想释放的资产会因为 B 租户在引用而被判定"仍被引用"。

不是数据泄漏(不返回他人数据),是**跨租户的误判 + 全表 detoast**。

**验收判据**

1. 该查询带 `data_node_ref` 与 `brand_ref` 谓词;
2. 存在修复前为红的用例:B 租户引用同一 assetRef 时,A 租户的释放不受阻。

### 3.0-3 · 本地转正的商品被标成"复制来的"

**缺陷事实** ✅

第 1525 行的转正 INSERT 把**自身** `dataNodeRef` 写进 `source_scope_ref`;第 2049 行:

```java
return row.sourceScopeRef() == null ? "SELF_MANAGED" : "COPIED";
```

于是本地临时商品转正后,来源被判成 `COPIED`,并被第 1097 行的 `case "COPIED"` 来源筛选命中。
用户在"复制来的商品"里看到自己新建的商品。

**验收判据**

1. 本地转正的商品,来源事实为 `SELF_MANAGED`,不出现在来源筛选的"复制"分支;
2. 真正跨 scope 复制来的商品仍为 `COPIED`;
3. 两条方向各有一条修复前为红的用例。

### 3.0-4 · 按编码装载无状态谓词且取首行

**缺陷事实** ✅

第 2283 行 `loadItems` 以 `WHERE code IN (...)` 装载,**不带 status 谓词**,`ORDER BY code` 后
取 `rows.get(0)`。今天唯一编码约束是 `UNIQUE (data_node_ref, brand_ref, code)` **无状态谓词**,
所以现状同码只可能一行、取首行恰好正确。

但 3.2 一旦让 VOIDED 释放编码,同码即可出现多行,**取首行变成不确定行为**。

**验收判据**

1. 该装载路径明确指定要哪一行(带 status 谓词或等价约束),不依赖 `ORDER BY` 后取首;
2. 有用例覆盖"同编码存在一条 VOIDED 与一条有效行"时装载到有效行。
   (该用例在 3.2 之前需手工构造数据,不能等 3.2。)

---

## 2 · 批次 3.1 · 建模拆分

**为什么做**:今天的反查全部靠**全表扫 `sections::text` 再在 Java 里比字符串**。这不是性能优化
问题,是**用应用层循环模拟数据库约束**。

**本批的硬判据**:每一张要拆的表,**必须给出 v2s 侧今天从那一头打进来的具体查询**。
给不出的**不拆**。下面每条都附了这个证据;三条原清单里的行**已撤回**,见 §5。

### 3.1-1 · 五处拆分及其证据

| 拆分对象 | v2s 侧今天在扫什么 | 状态 |
|---|---|---|
| `skus[]` → 独立表 | 第 1873 行 `skuOwnerByRef` 每次保存执行 `SELECT item_ref, sections::text FROM catalog_item WHERE … FOR KEY SHARE`——**对整个品牌逐行加锁并 detoast 全部 JSONB**,只为回答"这个 ref 属于谁";第 1884 行是**用 Java 循环模拟唯一约束**。且 `inventory.stock_target.product_sku_ref` 已是 UUID 列,catalog 侧无行可指 | ✅ |
| `categoryRefs[]` → 链接表 | 第 1017 行一条 SQL 里 5 个相关子查询,其中 3 个对 `catalog_item` 全扫并 `jsonb_exists`;第 1078 行列表过滤;第 1644、1892 行全扫后 Java 比字符串 | ✅ |
| `compositeGroups[].components[]` → 表 | 第 1755 行 `itemReferencedByOtherItems` 全扫;第 1843 行用 `item_ref IN (…) FOR KEY SHARE` **手写外键** | ❓ |
| `skus[].attributeValueRefs[]` → 表 | 第 1956 行字典作废守卫对 `SKU_ATTRIBUTE_VALUE` 全扫。**另有一条 JSON 装不下的约束**:同一 SKU 同一属性只能有一个值 | ✅ |
| 引用族 → **一张**统一引用表 | `productionTagRefs` / `tagRefs` / `salesUnitRefs` / `images` / `skus[].mediaRefs` **形状相同**,反查分别落在第 871、1956、912 行,**全部是全表 JSONB 扫**。拆成多张是重复;`orderOptions[].values[].attributeValueRef` 的唯一反查(经第 1956 行)也并入此表 | ✅ |

**这五处不是七张业务表。** 引用族合成一张是本批与前一版分析稿最大的差别——五族形状相同,
分开拆是把同一个问题解五遍。

### 3.1-2 · 提列(不是拆表)

`shortName`、`source*`、`governance*` 已经进了列表查询的 WHERE(第 1022 至 1099 行),且仓内
存在多种拼写共存。这些是**提成列**,不是拆表。

**验收判据(3.1-1 与 3.1-2 合并)**

1. 上述五处反查**不再出现 `sections::text` 全表扫**;每条反查走索引;
2. 第 1884 行那类"Java 循环模拟唯一约束"消失,唯一性由数据库约束表达;
3. `inventory.stock_target.product_sku_ref` 能建立指向 catalog 侧实体行的引用完整性;
4. 同一 SKU 同一属性不能有两个值——由数据库约束保证,不由应用层检查;
5. 每条反查有一条修复前为红的用例(红的原因是**行为**,不是索引名存在性)。

### 3.1-3 · `sections` 必须同批上白名单

**缺陷事实**

`sections` 今天是**无边界、客户端可写**的 JSONB。拆表之后,被拆走的字段**会以旧键名继续被写回**
并与新表共存,形成两份真相。

**验收判据**

1. `sections` 的可写键集合被显式限定;不在集合内的键被拒绝(不是静默丢弃);
2. 存在用例:提交一个已被拆出去的旧键名,请求被拒绝且新表未被绕过。

### 3.1-4 · 保存必须做集合调和

**缺陷事实** ✅

第 1246 至 1255 行的保存是**逐键整体覆盖**,唯一的移除侧检查是第 1268 行的资产锁。
于是删掉一个 SKU 时,挂在它上面的库存对象**悬空**,而全仓没有任何
`DELETE FROM inventory.stock_target`。

拆表之后这个问题从"JSON 里少了一项"变成"表里多了一行孤儿",**必须同批解决**。

**验收判据**

1. 保存能区分**新增 / 修改 / 删除**三种集合变化,而不是整体覆盖;
2. 删除一个仍被库存对象引用的 SKU 被拒绝,并告知被谁引用(**不是静默删除,也不是恒空的
   `blockingReferences`**);
3. 存在修复前为红的用例覆盖上述两条。

> 第 3 条特别说明:现有 `canVoid` 的 `blockingReferences` 建了数组**从不填**,
> `hasItemDependencies` 读的是**本商品自己的 sections**——答的是"有没有内容",不是
> "有没有被引用"。**不要在它上面加东西,它现在回答的是错的问题。**

---

## 3 · 批次 3.2 · 编码释放

### 3.2-1 · 硬前置:inventory 必须先停止按 `item_code` 关联

**缺陷事实** ✅

`modules/inventory/.../InventoryOwnerService.java`:

- 第 1079 行 `AND st.item_code IN (…)`——过滤
- 第 1101 行 `JOIN requested r ON r.item_code = st.item_code`
- 第 1103 行 `JOIN requested r ON r.item_code = sb.item_code`
- 第 1106 行 `LEFT JOIN target_counts t ON t.item_code = r.item_code LEFT JOIN bom_counts b ON …`

喂料方是 catalog:`CatalogInventoryCoordinator` 第 110 至 114 行(分类/关键词过滤时先解析出
商品 **code** 数组再塞进 `catalogItemCodes`)、第 819 至 820 行(驱动商品列表页的库存计数徽章)、
第 788 至 792 行(反向用 inventory 的 `sourceCode` 回查 catalog)。

**且全仓零 `SET item_code`** ✅——"编码创建后不可改"是一条**没有写下来的隐式约束**,
上述四处 JOIN 全靠它成立。

迁移文件 `V20260808_160000_000__inventory_opaque_catalog_identity_refs.sql` 第 1 行的注释
`-- inventory keeps product codes only as read labels.` **与代码相反**。

**验收判据**

1. inventory 侧不再以 `item_code` 做过滤或 JOIN;跨域关联走不透明 ref;
2. 那句迁移注释同批改掉——**它本身就是缺陷**,是这次误判的直接来源;
3. 存在用例:两个不同商品先后使用同一编码时,inventory 侧不会把它们的行混在一起。

**在第 1 条成立之前,3.2-2 不得开始。**

### 3.2-2 · VOIDED 释放,ARCHIVED 不释放

**缺陷事实** ✅

`V20260806_120000_000` 第 22 行 `UNIQUE (data_node_ref, brand_ref, code)` **无状态谓词**;
第 1682 至 1684 行 `formalCodeAvailable` 不看 status,文案自认"已被历史记录占用"(第 1514 行)。

- **VOIDED 必须释放**:所有读路径一律 `status <> 'VOIDED'`,业务不可见却占用业务命名空间,
  是纯粹的命名空间泄漏;
- **ARCHIVED 不得释放**:归档语义是"历史仍有效",`smartViewKey='ARCHIVED'`(第 1088 行)
  证明归档商品是**一等可见视图**。复用会让历史数据指向新商品——那是语义污染,不是空间回收。

**本工单裁定:VOIDED 释放,ARCHIVED 保持占用。** 不接受"两个都释放"。

**验收判据**

1. 编码唯一约束带状态谓词,VOIDED 行不占用编码;`formalCodeAvailable` 用同一谓词;
2. ARCHIVED 行仍占用编码,新建同码被拒;
3. 两个方向各有一条修复前为红的用例。

### 3.2-3 · 转正后的临时行应置 VOIDED

**缺陷事实** ❓

第 1529 行转正时把旧临时行置 `ARCHIVED`。按 3.2-2 的语义,`ARCHIVED` 意味着"历史仍有效、
仍可见",而转正后的临时行**不该继续占用编码,也不该出现在归档视图里**。来源可记在已存在的
`source_item_code` 上。

**验收判据**

1. 转正后临时行不出现在 ARCHIVED 视图;
2. 其编码可被复用;
3. 来源可追溯。

---

## 4 · 两处需要明确的裁定(本工单已定,不再等)

### 4.1 · 新 SKU 的 `productSkuRef` 由**后端**铸造

**理由**:主键必须由持有唯一性约束的一方铸造。第 1884 行今天就是后端在**为前端铸的 ID 补做
唯一性检查**,实现方式是第 1873 行的全品牌全扫——这正是拆表要消掉的东西。

**同一请求内的引用怎么对上**:包内四处引用 SKU 的地方都**声明**了 `skuCode`,后端可以在
一个事务里用它做关联键。

**但契约有洞** ❓:`catalogDraft.skus[]` 与 `compositeGroups[].components[]` 的 `skuCode`
在 required 里;**`inventoryBom[]` 与 `inventoryConfiguration.nodes[]` 的 required 里没有**。
D-3 要把 ref 改成可选,正好会放大这个洞。

**验收判据**

1. 新建 SKU 时客户端不提供 ref;后端铸造并在同一事务内解析包内引用;
2. 四处引用点的 `skuCode` **全部进 required**;
3. **已存在的 SKU 必须携带 ref**——用于区分"改名"与"删一个建一个";
4. **缺 ref 且 skuCode 已属现存 SKU 一律拒绝**,不得静默归档重建。第 4 条要有专门用例:
   先删一行再加一行、复用同一 skuCode,必须被拒。

### 4.2 · 属性值标签不存快照,但要处理字典作废

**理由**:冻结历史是订单域的职责,不是商品域的。商品域按 ref 关联即可。

**但有一个洞** ❓:契约把 `valueCode` / `valueLabel` 放进 `skus[].attributeValueRefs[]` 的
**required**,而字典条目**可以被作废**。作废后按 ref 取不到行,owner 输出 required 字段为空,
即是契约违约。

**验收判据**

1. 字典条目被作废后,引用它的商品仍能被读出且契约字段完整;
2. 有用例覆盖"作废字典条目后读取引用它的商品"。

---

## 5 · 明确撤回 / 明确不做

**以下三处在前一版分析稿的拆表清单里,本工单撤回**——它们在 v2s 侧**没有任何反查、
没有唯一性需求、没有列表谓词**,理由栏当时写的是"v4 有这张表":

| 撤回项 | 撤回理由 |
|---|---|
| 下单选项 / 选项值 | 除 `attributeValueRef` 外零反查;组内唯一在同一份 JSON 里就能判。该 ref 已并入统一引用表 |
| 生产提示 | v2s 契约本来就是开放 map,逐实例**今天就能表达**;零反查 |
| 识别码 / 条码 | 零反查、零唯一约束。v4 有此表是因为它有批量导入去重,**而 v2s 全仓无批量导入** |

**变体轴**不拆:它是推导 SKU 矩阵的**草稿输入**,其"唯一性/排序"都发生在同一商品自己的
JSON 数组内,没有外部查询打进来。

**字典不拆**:`catalog.dictionary_entry` 表已存在且已支持跨商品复用。用户觉得"每次都要新建"
是**前端没给选择器**(属性编码与值编码今天是自由文本输入框),不是模型缺失。**这一条要做的是
补选择器,不是拆表。**

**`inventoryBom[]` 应从 catalog 契约中删除**:owner 边界错放,`inventory.stock_bom` 已存在。

---

## 6 · 从第二部分并入 · **非商品域**

以下条目来自第二部分评审(资产 `NO-GO` 1 M / 4 S / 7 N;回执与批量 `NO-GO` 0 M / 7 S / 8 N)。
**它们与商品域无关,只是并在同一份工单里交办。**

**全部可以独立于批次 3.0/3.1/3.2 先做**——没有一条依赖建模重做。下表的"可独立"列因此
全是"是";列出来是为了让排期不必等商品域。

| # | 缺陷事实 | 验收判据 | 可独立 |
|---|---|---|---|
| **P2-1** | **【我的规格问题,非 Codex 执行问题】** 三张 owner 回执表把品牌塞进 request hash,而 workspace 回执**把 scope 加进主键**;仓内 organization / workspace_iam / extension / platform_asset **四张同类表全部是 scope 进键**。hash 方案的安全性依赖"每个调用点都记得调 helper",光 catalog 就有 8 个调用点,漏一个静默回退且无门可查 | `brand_ref` 进回执唯一键;跨品牌同幂等键各有各的回执,**不返回 409**;hash 里保留 `brandRef` 作纵深防御 | 是 |
| **P2-2** | 全仓**唯一**覆盖"release 与跨 scope reuse 在同一 advisory lock 上串行"的用例被注释掉(留 47 行死代码),而第二部分恰好移动了对象 I/O 相对该锁的位置 | 该锁语义有可运行的用例覆盖;死代码删除 | 是 |
| **P2-3** | 裁定甲改动 #3(restage 不再改写 workspace 归属)实现正确但**零覆盖**——原来唯一走该分支的用例被改成走 INSERT 新行 | 存在"同 workspace + 该行已 RELEASED + 重传同字节"的用例,断言 assetRef 不变、version 递增、workspace 归属未被改写 | 是 |
| **P2-4** | `SET enable_seqscan=off` **不生效**:`DriverManagerDataSource` 非连接池,该 SET 作用在随即关闭的会话上,EXPLAIN 跑在默认设置的新连接;且每表只插 1 行、从不 ANALYZE | SET 与 EXPLAIN 在同一连接,或造数到计划自然选中索引的规模并写明规模 | 是 |
| **P2-5** | `EXECUTE_BATCH` 断言只证明"走了 batch 分支",**不能**证明没有额外逐条 SQL。现场就有残留:production 复制两次调用同一个预检方法,每 tag 两条查询;organization 的批量化**零测量** | 两处复制测试加总量上界断言(tracker 的 N+1 嫌疑清单已现成);organization 补同形测量 | 是 |
| **P2-6** | production 唯一的跨品牌回执集成测试打的是**全仓只有测试在调**的旧桥;inventory 六条 typed 路径零跨品牌覆盖 | production 那条改打生产路径;inventory 加一条 typed mutation 的跨品牌用例 | 是 |
| **P2-7** | `HANDOFF.md` 的 cursor 条目写成"先不动",**抹掉了当前对外语义不实这个事实**——字段名叫 `cursor`、422 文案自称 opaque,值是 `offset + pageSize` | 条目补一句事实陈述:当前分页语义对外不实,属未修复项,等契约裁定 | 是 |
| **P2-8** | `CONFLICT` 是全新对外词汇,两个复制抽屉**原样渲染裸串**,中文界面出现未翻译的 `CONFLICT`,而整个抽屉仍呈现为成功流程 | **本工单裁定文案**:`COMMITTED` →「已写入」,`CONFLICT` →「已存在,未新建」。抽屉在非全部写入时不呈现为纯成功 | 是 |
| **P2-9** | 部分冲突语义缺失:2 条插 1 条 → `COMMITTED` + `version=1`,调用方只能自己拿 version 和请求条数比。**且 `version` 字段装的是插入条数,这本身是命名谎言**(与 P2-7 的 cursor 同一类) | 回读携带**显式计数**(请求数 / 实际写入数 / 跳过数),`status` 由计数派生而非相反;`version` 不再兼任计数 | 是 |

---

## 7 · 本工单的边界

- 本工单**不授权**下一 Roadmap step、DEV 或数据操作;
- 涉及产品语义、Journey、契约枚举变更的,§4 与 P2-8 已就地裁定,其余出现时先提出;
- **§5 的撤回项不要"顺手也做了"**——它们被撤回是因为在 v2s 侧找不到反查,不是因为暂时不做;
- 判据里凡写"修复前为红",指的是**行为**红,不是"注解存在性"或"索引名存在性"红。
  上一轮有两条新用例修复前就是绿的(直接 `new` 出服务对象,无 Spring 代理,`@Transactional`
  本就不生效),这次每条负向用例请自行确认修复前确实失败。

## 8 · 会话出处

本工单由 `/Volumes/idea/catering-v2s` 仓根的评审会话产出。标 ✅ 的行号由我本轮亲自打开源码
确认;标 ❓ 的取自独立盲审报告,未经我本轮复核,动手前请自行核实。本轮未编译、未跑测试、
未起容器、未跑 EXPLAIN;所有性能判断均为**从 SQL 文本得出的结构判断,不是实测**。
