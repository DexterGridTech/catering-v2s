# P3-2 + C1-2 + F5c 实施评审

> **REVIEW_TARGET=IMPLEMENTATION** · 2026-08-16
> **结论:`NO-GO` · M 2 · S 4 · N 8**
>
> ⛔ **每条 finding 都配了具体业务场景。场景站不住的已删除或降级(见 §6.3)。**
>
> **会话出处**:fresh v2s-rooted 只读会话。**未运行任何测试、容器或数据操作**,唯一执行是只读的静态检查脚本。
> 所有结论为**静态源码判断**,凡依赖动态行为的已单独标注。

---

## 0 · 本轮的方法说明(先读这一节)

**每条 finding 都做过反证。** 上一轮我在同一个错误上栽了十次——**看到截断的 grep 输出就下断言**——所以本轮所有结论在写入本文前重跑了一遍证伪:

| 反证动作 | 结果 |
|---|---|
| M-1:全仓搜是否有第三处写 `confirmationRequiredCount` | 只有 owner 与协调层两处,**证伪失败** |
| M-2:新增维度的 `attributeRef` 初值是否真为空 | `draftUuid()` 无参调用走默认值 `''`,**证伪失败** |
| S-6:`DictionaryKind` 联合类型是否真缺 `ORDER_OPTION_VALUE` | 取全整行确认,**证伪失败** |
| S-7:页面级字典抽屉是否真不传 `parentEntryRef` | 零命中,**证伪失败** |

⛔ **一条重要的时效声明**:本轮之前的一轮评审是在一棵**移动的树**上做的——我两次读同一个函数体拿到了不同代码。本文是在 Codex 停手后的冻结树上重做的。

---

## 1 · 先说做对的(这一轮的完成度很高)

⚠️ **这一节不是客套。** 下面四项我逐环核过,**它们比我给的规格更严**,直接写进结论以免被 M/S 清单淹没。

### 1.1 · C1-2 的迁移比规格严

双向 CHECK 一字不差:

```sql
CHECK ((dictionary_kind = 'SKU_ATTRIBUTE_VALUE') = (parent_entry_ref IS NOT NULL))
```

**而且三件是我没要求、它自己加的**:

- `UNIQUE (entry_ref, data_node_ref, brand_ref)` + 复合 FK → **父属性必须同 scope**,堵住跨租户
- 预检守卫 `AMBIGUOUS_OWNER_KIND`(一条被 SKU 与 ORDER 两侧同时引用)
- 预检守卫 `MULTIPLE_ATTRIBUTE_PARENTS`(一个值挂在两个属性下)

**五个触发器**把"属性 A 只能选属于 A 的值"钉在数据库层,不只是查询过滤。**数据面是关死的。**

### 1.2 · compatibilityId 的身份链七环全通

`compatibilityId` 是**主键 UUID**,不是数组下标也不是内容 hash。
OpenAPI item schema `additionalProperties: false` 且 id 在 `required` 内;
execute 的 `compatibilityDispositions` 同为闭集;
后端用**集合相等**校验(不是子集),少一条、多一条、id 不存在、id 重复、给 BLOCKED 行提交确认——**全部 422**,且在写入之前、事务之内。

**不勾任何一行直接构造请求调 execute,会被拦住。安全没问题。**

### 1.3 · 媒体上限收敛为单一来源

上限值源头是 `contracts/policy/catalog-inventory-media-assets.json` 的 `catalogItemImageLimits`,
经生成器同时产出 Java 常量与 manifest;**前端不持有常量**,从服务端下发的 manifest 读。
服务端三处校验(商品图条数、**SKU 图条数**、单张字节)全部引用同一常量。

**我上一轮说的"两处各写一个数"已不成立。**

### 1.4 · riskFlags 端到端退净

原有 7 个落点(OpenAPI property、**required 列表**、生成 TS、后端 `putArray`、前端类型、前端解码、前端渲染)
现在**逐个 grep 计数全为 0**,且 `CatalogItemPage.data.items[]` 的 required 列表已重排为 25 个 key、`additionalProperties: false`,不含它。

**不是只删一层,六环同步退净,无契约违约。**

---

## 2 · M-1 · 品牌复制在 UI 上永远执行不了 `CONFIRMED`

> **业务场景**:门店店长要把总公司品牌商品库的商品复制到本店。
> 打开「从品牌复制」→ 勾选商品 → 生成预检 → 逐行确认差异 →
> ⛔ **「执行复制」按钮永远是灰的,页面顶部常驻红色告警「预检确认项与明细不一致」。**
> 把每一行都勾满也解不开。**这个功能对用户完全不存在。**

**落点** `CatalogOwnerService.copyPreflight`(约第 2443–2469 行)· `CatalogInventoryCoordinator.mergeCopyPreflight`(约第 615–618 行)· `BrandCatalogCopyDrawer.tsx` 第 39–40、59、104 行

### 仓内事实

**三个数在说同一件事,其中一个漏了一项:**

| 谁 | 口径 |
|---|---|
| 后端校验的 `expected` 集合 | **全部非阻断行**的 id |
| 前端 `confirmationRows` | **全部非阻断行** |
| ⛔ `confirmationRequiredCount` | 字典行 + inventory 非阻断 + production 非阻断 —— **不含 catalog 自己的商品行** |

owner 侧:`int confirmationRequiredCount = 0;` 在**商品循环之后**才初始化,只在字典循环里自增;
而同一个 `compatibility` 数组里已经装进了每个商品一行。

协调层**不修正**它:

```java
int ownerConfirmations = Math.max(0, ownerResultCount(owners.inventoryJudgement()) - inventoryBlocking)
                       + Math.max(0, ownerResultCount(owners.productionJudgement()) - productionBlocking);
```

只加 inventory 与 production 两个 owner 的非阻断行。

✅ **反证**:全仓搜 `confirmationRequiredCount`,写入点只有 owner 与协调层两处,**没有第三处修正**。

### 后果

```
差值 = 非阻断商品数
→ confirmationCountMatches 恒 false
→ allConfirmationsHandled 是与门,恒 false
→ execute() 第 59 行直接 early-return
→ 第 104 行常驻红色告警「预检确认项与明细不一致」
```

而执行本就要求 `blockingCount === 0`,**所以凡是可执行的场景差值 ≥ 1** —— 用户勾满每一行也解不开。

**对照本地复制**:`confirmationRequiredCount` 取 `blocking ? 0 : 1` 且恰好只有 1 行,分母自洽,**只有品牌路径塌了**。

### 最小修复

`confirmationRequiredCount` 与后端 `expected`、前端 `confirmationRows` **同源派生**,不要第三次单独计算。

⚠️ **本条无任何测试覆盖**:前端只有 model 层手写夹具单测,**夹具自设 `confirmationRequiredCount`**,所以永远不会暴露与真实后端输出的口径差。

**分类**:实施缺陷(本轮新引入)。

---

## 3 · M-2 · 未选属性时,属性值候选跨属性泄漏 `CONFIRMED`

> **业务场景**:运营新建一个 T 恤(SKU 商品),在「SKU 规格与价格」页签点「新增规格维度」。
> 新维度出来了,属性还没选,用户先点开旁边的「属性值」下拉想看看有什么可选 →
> ⛔ **看到的是全品牌所有属性的所有值混在一起**:红色、蓝色、S 码、M 码、大杯、加珍珠……
> 用户选了「S 码」,回头再把属性选成「颜色」→ **刚才选的被清空,白做一遍。**

**落点** `CatalogItemDrawer.tsx` 第 46、920、932 行 · `catalogFieldRuntime.ts` 第 85 行 · `CatalogOwnerService.loadDictionaryListing`(约第 2819 行)

### 仓内事实(链条逐环亲验)

```
const draftUuid = (value = ''): ... => value          ← 无参调用返回空串
新增维度 onClick: applyDimensions([...dimensions, {attributeRef: draftUuid(), ...}])
→ readField('skuVariantAttribute') 返回 ''
→ 第 85 行 ...(query.parentEntryRef ? {parentEntryRef: ...} : {})   ← '' 是 falsy,被省略
→ 后端 (?::uuid IS NULL OR parent_entry_ref=?) 恒真
→ 返回该 scope 下全部属性的全部值
```

而属性值 picker(第 932 行)**没有 `disabled`**。**同一个文件里就有正确写法**:

| 行 | picker | `disabled` |
|---|---|---|
| **932** `skuVariantValues` | ⛔ **无** |
| 1104 `bomOptionValue` | ✅ `disabled={!hasOrderOptionValues}` + `disabledMessage` |
| 1192 `compositeComponentSku` | ✅ `disabled={!itemCode}` |

### 为什么这是 M

**C1-2 规格第五节的判据原文**:

> 「未选属性时 | 属性值选择器整个 `disabled`,**且不发请求**」

**两半都没落。**

✅ **数据面关死**:DB 触发器会拒掉父不匹配的写入,错值落不了库。
⛔ **但该判据判的正是候选面** —— 用户在「口味」下看到别的属性的值,选中后要么被清空要么提交被挡,**白做一遍**。

### 最小修复

`skuVariantValues` picker 补 `disabled={!dimension.attributeRef}` 与 `disabledMessage`;
`CatalogDescriptorPicker` 增加「必需绑定缺失就不发请求」的分支。

**分类**:实施缺陷(既有判据未满足)。

---

## 4 · 四条 S(原八条:两条降 N、一条撤回、一条删除;另有一条由 N 升 S)

### S-1 · 作废阻断被 edge 层通用文案短路 `CONFIRMED`

> **业务场景**:运营要作废一个录错的商品,点「作废并重建」→
> 弹出「库存对象或 BOM 仍存在,不能作废商品」→
> ⛔ **不告诉是哪个库存对象。** 用户得自己切到库存页一条条翻,找出挡路的那个。

`TransitionOperationsCatalogItemStatusOperation` 在调 owner **之前**抛两条**零指名**的通用文案:

```java
if ("VOIDED".equals(request.targetStatus())) {
    if (catalog.catalogItemReferencedByOtherItems(...)) throw ... "商品仍被其他商品引用，不能作废";
    if (inventory.catalogItemVoidDependencies(...).hasDependentFacts()) throw ... "库存对象或 BOM 仍存在，不能作废商品";
}
return ... catalog.transitionCatalogItemStatus(...)   // owner 的指名消息在这之后
```

两侧判据**完全等价**(同两表同两列),所以**凡 owner 会触发的场景,edge 必然先触发** —— owner 那条指名消息在商品作废 HTTP 路径上**不可达**。

违反工单 §7 判别性测试第四条「`blockingReferences` 在有引用时**非空并指名是谁**」。

### S-2 · ⛔ 验收用例把缺陷锁成基线 `CONFIRMED`

> **场景(工程侧,与 S-1 连体)**:有人按 S-1 去修,把 422 文案从
> `stock_target.product_sku_ref x1` 改成「库存对象『中杯-珍珠奶茶』」→
> ⛔ **这条验收用例当场变红**,修复被自己的测试挡回去。

```java
assertTrue(rejectionDetail.contains("stock_target.product_sku_ref"),
        () -> "BUSINESS: rejection identifies the inventory reference source instead of a generic failure; ...");
```

**断言的文案**说"指名了库存引用来源,而不是通用失败";**断言的谓词**查的是"detail 里含数据库表名点列名"。

双重后果:用户可见的 422 里**泄露内部 schema**;而**若有人改成指名真实业务对象,这条断言会红**。

**它不只是没抓住缺陷,它把缺陷认证成了正确行为。**

### ~~原 S-3 · `UNCLASSIFIED_VALUE_EXISTS` 不报数~~ → **降为 N**

### ~~原 S-4 · 把"未被引用"等同于"无法分类"~~ → ⛔ **已撤回**

> **Dexter 2026-08-16 确认:不存在这种迁移场景。**
>
> 本项目当前阶段没有需要迁移的存量数据(库可重置重播种),
> 所以「历史零引用属性值导致 Flyway 失败」这个场景**不成立**,S-4 整条撤回。
>
> 连带:S-3 的「异常不报数」也随之降级为 N —— **那条异常永远不会触发**,报不报数不影响任何人。
>
> ⚠️ **我上一版把它写成 S 是过度告警**:我从代码推出了两条能产生零引用行的真实用户流程
> (quickManage 建完值不保存商品、删维度时硬删 axis_value),**推理本身没错**,
> 但我没有先问"这个项目现在有没有需要迁移的库",就把一个不适用的场景报成了风险。
>
> **附带观察(不是 finding)**:迁移里约 160 行的再分类与父回填逻辑,
> 在无存量数据的环境里对着空集运行,三道守卫从不触发。
> 防御性写法本身不错,但它**从未被真实数据检验过** —— 若将来真有需要迁移的环境,
> 这段代码是未经验证的。

### ~~原 S-5 · 前端 `DictionaryKind` 联合类型缺 `ORDER_OPTION_VALUE`~~ → ⛔ **已删除**

> **构造不出业务场景。** ✅ 亲验:`ORDER_OPTION_VALUE` 在前端 `.ts` / `.tsx` **零命中** ——
> 没有任何代码试图用这个 kind 打开字典抽屉,也没有对应的用户任务。
> 联合类型少一个成员**不产生任何用户可见后果**,是纯粹的类型洁癖。**整条删除。**

### S-3 · 字典抽屉「属性值」页签的新建按钮是死的 `CONFIRMED`

> **业务场景**:运营打开工具栏「商品字典」→ 切到「属性值」页签 → 点「新建」→
> 填好编码和名称 → 提交 → ⛔ **报错**。而且是后端 422,用户不知道为什么、也不知道该去哪建。
> **页签摆在那里、按钮能点,但它永远失败。**

`dictionaryTabs` 含 `{key: 'SKU_ATTRIBUTE_VALUE', label: '属性值'}`,
但页面级抽屉**不传 `parentEntryRef`**(零命中),创建体因而必然不带该字段,
而后端对 `SKU_ATTRIBUTE_VALUE` **必填父属性** → **必然 422**。

### ~~原 S-7 · 8 条 orphan `fieldRules`~~ → **降为 N**

> **今天没有用户可见后果。** 契约说 `name` 必填、`code` 只读,前端**手写了同样的规则**,
> 两边当前一致,用户体验正确。风险只在将来:改契约里那条规则,**界面不会跟着变**。
> **是规格与代码的漂移,不是缺陷。降 N。**

### ~~原 S-8 · 库存关键词 owner 侧 ILIKE 死分支~~ → **降为 N**

> **搜索功能对用户是好的** —— 真正生效的实现在 catalog owner,还配了逐字匹配的 GIN trigram 索引。
> 那条死分支只误导将来读代码的人。**无用户场景,降 N。**

### S-4 · 库存列表次级行给中文用户直出英文枚举 `CONFIRMED`

> **业务场景**:店长打开库存页,列表每行第二行本该显示「对象形态｜分类｜物料角色」,
> 实际渲染 `{[row.targetType, row.categoryName, row.materialRole].filter(Boolean).join('｜')}`,
> 而 `targetType` 全链硬编码为 `"PRODUCT"` ——
> ⛔ **用户看到的是「PRODUCT｜饮品｜…」**,一个英文枚举夹在中文里。`materialRole` 同样无 label 映射。

**落点** `InventoryOwnerService.targetListRow`(硬编码 `"PRODUCT"`)· `InventoryManagementPage.tsx` 第 57 行(原样渲染)

**最小修复**:`targetType` 与 `materialRole` 走 manifest 的 `enumLabels` 映射,与其他枚举一致。


---

## 5 · 七条 N

| | |
|---|---|
| **N-1** | `catalog-local-copy-skipped` testId **3 处重名** |
| **N-2** | `copyConfirmationKey` 是**悬空导入**(只在 import,零调用)。build 全绿说明门不查未使用导入 |
| **N-3** | 库存列表 `targetType` 全链硬编码 `"PRODUCT"`,中文界面直出英文枚举;`materialRole` 同样无 label 映射 |
| **N-4** | 库存区①「来源」仍是写死字面量 `'内部轻库存'`,未读 `authorityType`;而同区「对象形态」已改为真读 |
| **N-5** | 5MB 暂存上限**抄了三份且无派生关系**(Java 常量、policy JSON、p2 cli 字面量),改 Java 常量没有门会红 |
| **N-6** | 字节校验发生在 `settleCatalogSaveAssets` **之后**,是 claim 落定后的事后否决,靠事务回滚兜底 |
| **N-7** | 迁移的 `UNCLASSIFIED_VALUE_EXISTS` 异常不带数量与条目标识(**原 S-3**,因该异常在当前阶段永不触发而降级) |

---

## 6 · 分类与边界

### 6.1 · 实施缺陷 vs 规格/范围外

**实施缺陷**:M-1 · M-2 · S-1 · S-2 · S-5 · S-6 · S-7 · S-8 · 全部 N

**规格已定但实现未达**:M-2(C1-2 判据)· S-1(工单 §7 判据)· S-3(Dexter 裁定的"报数")

**需 Dexter 裁决**:✅ **无** —— 原 S-4 已由 Dexter 于 2026-08-16 确认场景不存在,整条撤回。

### 6.2 · 明确未做的验证

| 项 | 状态 |
|---|---|
| ~~真实存量统计~~ | ✅ **已不需要** —— Dexter 确认无迁移场景,原 S-4 撤回 |
| 浏览器 L2 验收 | ⛔ **未做** —— 本文全部为静态源码判断 |
| Testcontainers 结果 | **未复跑**,不把 Codex 报的 PASS 升级为我的结论 |
| 库存关键词与名称投影的 HTTP 级判据 | ⛔ **不存在** —— acceptance 里无任何请求打到 `/inventory-targets` 列表端点 |

⚠️ **本文任何"通过"都不等于生产数据或浏览器行为的结论。**

---

## 7 · 一个跨全轮的观察

本轮两条 M 与两条 S 是**同一个形态**:

| | 声称 | 行为 |
|---|---|---|
| M-1 | 三个数说同一件事 | 其中一个单独算,漏了一项 |
| S-2 | 断言消息说"指名了来源" | 断言谓词查的是表名点列名 |
| S-7 | 契约里有 `required: true` | 两端都没人执行,前端另写一套 |
| S-8 | owner 里有关键词 SQL | 协调层已把参数删掉,分支不可达 |

**同一个事实被陈述两次,而两次不一致——且门是绿的。**

这与本轮做对的四项恰成对照:C1-2 的双向 CHECK、compatibilityId 的集合相等校验、媒体上限的单一来源、riskFlags 的六环同步退净,**每一样都是把"两处陈述"收成一处**。

**方向是对的,剩下的是四处没收干净。**
