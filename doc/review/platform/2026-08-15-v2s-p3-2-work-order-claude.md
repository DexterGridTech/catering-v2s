# P3-2 工单 · 前端与 IA 交互形态

后台模型与契约见 P3-1 及 `2026-08-15-v2s-p3-corrective-batches-claude.md`,本文不重复。
事实依据见 `2026-08-15-v2s-p3-2-fact-base-claude.md`,IA 逐条证据见 `2026-08-15-v2s-ia-89-conformance-evidence-claude.md`。

> **此前的 `2026-08-14-v2s-p3-2-frontend-ia-work-order-claude.md` 已降级为讨论分析稿,本文取代它。**

---

## 0 · 写法

### 0.1 前端的机制与后台不同

P3-1 用 **不变量 + 拒绝形态 + 判别性测试**。**那套在这里不够用**:

> **用例能断言 testId 存在、能断言提交成功,断言不出"这里该是选择器不是输入框"。**

所以每条是:**现在是什么(带落点) → 用户实际遭遇 → 应该是什么 → 依据 → 怎么确认(诚实分开能测的与只能看的)**。

> ⚠️ **前一版写"组件测试基建不存在" —— 那是把一句作用域限定升级成了全仓断言,错了。** 订正为三句可证伪的话:
>
> 1. ✅ `catalog-management/ui` 下现有的 `.test.tsx` **不含渲染**,断言的是六个纯函数
>    (`requireOperationsScopeRef` / `canMoveDictionaryRow` / `decodeDetail` / `decodePreflight` /
>    `decodeBrandCopyReadback` / `decodeNavigation`)——**这一句仍然成立**
> 2. ✅ **但全仓已有渲染型断言**:`OperationsRequiredScopeSurface.test.tsx` 用 `react-dom/server` 的
>    `renderToStaticMarkup` **渲染真实组件并断言输出 markup**(含"子组件有没有被挂载"这类形态断言),
>    **就在 `operations-admin` 自己的 `src/` 下**;`foundation.test.ts` 同法渲染 `NameCodeText` ——
>    **正是 §3.4 要求主列改用的那个组件**。全仓 `renderToStaticMarkup|renderToString` 命中 2 文件 7 处
> 3. ⚠️ **但"五处 picker 不需要新基建"是错的,而且和下一句自相矛盾。**
>    ✅ 五处 picker **全在 `<Drawer>` 内部**,而 Drawer 走 portal;node 环境下 `canUseDom()` 为假 → portal 返回 `null` → **渲染出空**;
>    换 jsdom 则 React 19 的 server renderer 直接抛「Portals are not currently supported by the server renderer」。
>    ✅ 而且 `CatalogItemDrawer.tsx` **只导出一个组件**(整个 Drawer),29 个子组件**一个都没导出**。
>
>    **可行的做法是绕开 Drawer**:✅ `SkuMatrixEditor` / `InventoryBomEditor` / `ProductionProfileEditor` **零 hook**,
>    `OrderOptionsEditor` 只有 `useState` / `useEffect` —— **这四处只要加 `export` 就能直接 `renderToStaticMarkup` 断言**。
>    **"新增导出"这一项成本要写进排期。**
>    第五处(套餐组件 SKU)自带 RTK hook 与第二个 `<Drawer>`,**归第三档**。
>
> **仍需新基建的**:交互(点击、输入、打开下拉)、portal 内容、以及带 RTK hook 的组件 ——
> `renderToStaticMarkup` 都做不到。
>
> **「怎么确认」按三档写**:**渲染可断言**(控件类型、数据源、是否挂载)· **纯函数可断言**(选项集合、映射、判定)·
> **需新基建或只能看**(交互、状态迁移、视觉手感)。**只有第三档要算建基建成本。**

### 0.2 四条动作规则(前面各犯过多次,写成动作不是原则)

1. **句子里出现「只有/唯一/全仓/零/恒」,落笔前先跑搜索并把条数写进句子。写不出条数就不许用这些字。**
2. **写「形状相同/同一类/可以合并」,先把每个成员的实际结构打开看一遍并写出差异。写不出差异才允许说相同。**
3. **v4 是参照不是判据。** 引用前先答"它解决的是不是我们的问题"。
4. **搜索拿到零结果时,先确认自己搜的字面形式对不对。** —— 转义字符串、`List.of` vs `Set.of`、
   `Array<{value,label}>` vs `Record<string,string>`,**三次零结果都是形式不对,不是真的没有**。

### 0.3 四类内容分清

**当前仓内事实**(带落点,标 ✅)· **IA 要求**(引条款)· **产品裁定**(标明新规则 + 业务后果理由,不得用命名论证)·
**待建能力**(标"新增" + 跨越的边界)。

### 0.4 时效

✅ 所有事实是**对当前工作树的快照**。**Codex 正在实施 P3-1,`modules/catalog` 随时在变**——
本轮核验期间就观察到治理维度已被删掉大半(`GOVERNANCE_TODO` 归零、智能视图从六项减到五项)。

> **承重事实要在动手前当场复验,不是提前验好囤着。**

### ⛔ 开工前必须先做:对着 P3-1 的最终状态重校五项

**本文的多处内容是"P3-1 完成到某一时刻"的快照。P3-1 继续推进会让其中一部分自动失效。**
⚠️ **已经发生过一次**:C-a / C-b 被写成契约前置,而 Codex 在途已加上,**契约批次与 picker 批次白等了一轮依赖**。

| # | 重校什么 | 会怎么变 |
|---|---|---|
| 1 | **89 条归属** | 后端每完成一块,"两者"里对应条目变"前端"、"后端"变"无剩余"。**21/21/5/42 会漂** |
| 2 | **§2 的 2-1 ~ 2-6 阻断项** | 可能已被 P3-1 顺手做掉 → **阻断解除,对应批次提前** |
| 3 | **§6.5.1 的 C-c ~ C-i** | 同 C-a/C-b 的下场 —— **已完成的会让批次白等** |
| 4 | **登记册 23 条** | 其中后端项(如分类计数口径、无上限 `string_agg`)可能已被碰过 |
| 5 | **IA 证据文件标 `CONFORM` 的条目** | 见 §6 的全量重验规则 |

**做法**:每项**当场打开源码复验**,不采信本文与证据文件的快照。**判据是"现在还剩什么",不是"当时缺什么"。**

> ⚠️ **第六项是性质不同的**:上面五项都是"P3-2 可能变简单",而这一项相反 ——
> **如果 P3-1 的验收发现七族拆表没有真原子切换(仍有事实同时活在 JSON 与关系表),
> 或 acceptance 的业务断言是假绿,那 P3-2 的 picker 接线与矩阵生成就建在一个不稳的模型上。**
> **那不是调整批次的问题,是要不要开工的问题。**
> **P3-1 验收结论出来之前,F5、F7 与 B4② 不要开工(它们建在七族拆表的结果上);B0、F1、F2 不受影响。**
>
> ⚠️ **P3-1 的三条 M 已经确认成立**(全品牌 `FOR KEY SHARE` 未消灭且锁面变大 ·
> SKU 计数双真相 · 转正路径漏写 SKU 媒体表),**修复在进行中**。上面这条边界因此仍然生效。

### ⛔ 第七项:开工前必须实跑一次 source-to-consumer(2026-08-15 Codex review S-3)

**上面六项核的都是 P3-1 的业务快照,覆盖不到本轮新增的这条链**:

> 生成器 → Java surface → owner 投影 → read-model → OpenAPI → edge 生成物 → transport / adapter → foundation

**为什么必须单列**:这条链上的任何一环断掉,**下游门仍然可以全绿**(见 §3.8 零之二)。
而其中三环(owner 投影白名单 · read-model · OpenAPI)**恰好都不在前六项的复验范围里**。

**做法**:开工前**沿这条链逐环打开一次**,确认当前 `fields` 在每一环的实际状态,
**而不是假设"上一轮查过了"** —— §3.8 零之二里第 3 至 7 环的状态我标的是 `推论`,**没有逐环亲验过**。

---

## 1 · 已裁定,不再讨论(13 条)

治理整套删除 · 一个商品不能同时有无属性与有属性 SKU · 加料料共享每商品选范围 ·
**挂牌价属销售集合域商品域只有标准价** · 批量四个动作都要 · `ordering` 页签删除 · `riskFlags` 删除 ·
生产提示每商品一条 · 分母 89 合并口径 · 不建投影只加搜索索引 · 枚举标签后台下发只做 catalog 域 ·
platform-admin 不在范围 · **导入导出本期 Out(IA 已裁,非 Dexter 裁)**。

---

## 2 · 阻断:必须后端先有的

**这些不是"前端等一等",是前端根本没有数据可渲染。**

| # | 缺什么 ✅ | 前端因此做不了什么 |
|---|---|---|
| **2-1** | `tagRefs` / `salesUnitRefs`:契约声明了(详情侧还是 required)、owner 不产出、前端不解码 | 主列的标签行 · 标签筛选 · 批量改标签 —— **三处全悬空**。而字典抽屉里这两个页签**已经能建条目,用户建完没地方用** |
| **2-2** | 库存配置四字段(消耗单位/低库存阈值/负库存/盘点换算)**不在详情响应字段集里** | **用户填了、保存成功了、重开全没了。** 89 条里唯一一处用户输入静默消失 |
| ~~**2-3**~~ | ~~详情投影不 put `status`~~ ⚠️ **判错了,已移出本表 → F2(零后端)。**<br>✅ `itemDetail` **确实 put 了 `lifecycle.status`**(`CatalogOwnerService:2568`),契约 required 里也有 `lifecycle`,解码层也已解。<br>缺的只是**顶层 `item.status`**,而前端读的正是它。<br>⚠️ **落点是 `CatalogItemDrawer` 的 522(同行两次)、528、529、604 —— 4 行 5 处,不是"三行"。**<br>**而且我把用户可见的伤害说小了**:522 是**抽屉标题的状态 Tag**、604 是**基础资料的状态行** —— `text(undefined)` 返回空串,所以今天**标题挂一个空灰 Tag、基础资料状态行是空白**。<br>**这两处恰恰是用户唯一会主动去看状态的地方**,而我只写了按钮。<br>**修法:四行改读 `lifecycle.status`;并把解码层给 detail 的顶层 `status` 一并去掉,免得留一个恒空的合法字段让下一个人再踩。**<br>⚠️ 而我同日写的证据文件已经说了「前端改读 `lifecycle.status` = P3-2、不必等契约」——**两份文档给出相反归属,工单是错的那份。** | — |
| **2-4** | ✅ `actionAvailability` **硬编码** `canCreate/canEdit/canCopy = true` + **空 `reasons` 数组** | 「新建商品」改成 `disabled` + 原因**没有可渲染的事实**。⚠️ **这条要么后端先填 `reasons`,要么本轮不做** —— 不接受前端编一个理由 |
| **2-5** | 列表契约**无区间价**(只有四个标量,无 min/max) | IA 线框要的 `¥28~34` 做不出来 |
| **2-6** | ✅ `dictionary_entry` 扁平无父列,且 `SKU_ATTRIBUTE_VALUE` **同时装 SKU 维度值与点单选项值** | 属性值选择器**没有可过滤的数据**;quick-manage"在当前属性下新建值"也做不出来 |

**2-1 / 2-2 / 2-3 / 2-5 归 P3-1 契约批次(见矫正批次 C3);2-6 归矫正批次 C1-2。**

---

## 3 · 逐面形态要求

### 3.1 SKU 规格 —— **形态内的矩阵维护(前提已裁定,范围已收窄)**

> **本节现在只剩两件事**:`SKU_VARIANT_SALE_COUNTED` 形态内的**矩阵生成**,
> 以及**删轴 / 删值时的引用守卫**。
> 原来的"五种切换"里,①③⑤ 因"形态不可改"作废,④ 因"引用守卫"改写 —— 逐条处置见下。

> # ✅ 前提已由 Dexter 拍定(2026-08-15),本节据此收口
>
> **「商品一旦新建时确认了形态,就只能按该形态的契约维护;不满足就删除重建。形态确认后不能改。」**
>
> **这一条把本节简化了一半:**
>
> | 原场景 | 处置 |
> |---|---|
> | ① 无属性手工建 SKU | **作废** —— `OPTIONAL_TABLE` 形态不给 SKU 入口,那是该形态的契约 |
> | ② 有属性:矩阵生成 | **保留** —— `SKU_VARIANT_SALE_COUNTED` 形态内的正常维护 |
> | ③ 无属性 → 有属性 | **作废** —— 跨形态,不允许 |
> | ④ 换轴 / 删轴(还有轴) | **保留** —— 同形态内的轴增减 |
> | ④⑤ 删轴 / 删轴上的值 | ✅ **Dexter 2026-08-15 裁定,统一按引用守卫处理,见下** |
>
> **所以本节实际剩三件事:形态内的矩阵生成(②)· 轴增减时的内容保留(④)· 轴被删空后的形态(⑤)。**
>
> ⚠️ **下游还有五处仍按被撤回的方案写着,实施者从 §5 / §6.5 进场会精确地把作废的东西建出来。**
> **这五处必须同批改**:本节的裁定句 · 场景表 ① 那一行 · ① 的依据句 · C1-1 依赖段 ·
> §5 **F7** 的"§3.1 全部" · §6.5.3 测试表的"五种切换每种一条" · §6.5.2 seed 的 S-c。
> **只改 ⚠️ 块而不改下游,等于把撤回写成了一句没人看的注脚。**
>
> ## ✅ 删轴的语义已裁定(Dexter 2026-08-15)
>
> **「销售属性删除或停用前应该查看是否有有效引用,有就提示不能删除,必须显式调整关联的 SKU 之后才可以删。」**
>
> **这条比我此前列的三个选项都好,而且理由是结构性的:**
> 我那三条(保留 / 清空 / 拒绝删最后一根轴)全都是在**给一个不该出现的状态想对策**;
> **这一条是不让它出现。**
>
> **而且它不是新机制** —— ✅ `REFERENCE_BLOCKS_VOID` 这个模式在同一个文件里**已经用了 5 处**
> (字典条目作废前查引用、商品作废前查引用),**唯独轴与轴上的值漏了**。
> ✅ 实测:轴那两处只做 UUID 格式校验(`addRequiredUuid`),**没有任何引用守卫**。
> **所以这是把已有模式补到漏掉的那一处,不是发明新东西。**
>
> ### 要成立的
>
> 1. **删除或停用一根轴**,若其下任一值仍被 SKU 引用 → **拒绝**,并指明**哪些 SKU 在用**
> 2. **删除或停用轴上的某个值**,若仍被 SKU 引用 → 同上
> 3. 用户**先显式调整关联 SKU**(改属性值 / 归档那些 SKU),**之后才能删轴或删值**
> 4. **不做自动合并,不做自动丢弃** —— ⚠️ **前一版 ④ 写的"列出哪 N 条将被丢弃让用户确认"作废**:
>    那仍然是系统替用户决定丢什么,**正确形态是根本不让它进入"要丢东西"的局面**
>
> ### 判别性测试
>
> | 用例 | 断言 | 挡住什么 |
> |---|---|---|
> | 删被引用的轴 | 拒绝 · **指名哪些 SKU 在用** · 轴与 SKU **都未改动** | 静默合并;拒绝但已改了一半 |
> | 删被引用的值 | 同上,粒度到值 | 只在轴级别拦,值级别漏过 |
> | 先调整再删 | 把那些 SKU 的该属性值改掉或归档之后,**删轴成功** | 一律拒绝(那样用户永远删不掉) |
> | 未被引用的轴 | **直接删成功** | 无引用也拦 |
>
> **第三、四条必须有** —— 只有前两条的话,"一律拒绝"的实现会假绿,用户会陷在删不掉的死局里。
>
> ### 连带
>
> ⚠️ 这条同时**消解了"轴被删空之后 SKU 怎么办"这个问题** —— 有引用就删不掉,
> 所以轴被删空时,**引用它的 SKU 必然已经被用户处理过了**。那个未定义状态不再可达。
>
> ⚠️ **`SHAPE_DERIVATION_CONFLICT` 是对的,保持不动。** 前一版围绕它设计的"三个选项"、
> 以及后来按 v4 语义写的收口,**全部作废** —— **裁定不依赖 v4,是产品决定。**
>
> ⚠️ **矫正批次 C1-1(无属性 SKU 每商品只能一条)随之降级**:
> `OPTIONAL_TABLE` 形态既然不给 SKU 入口,那个限制**在正常路径上撞不到**。
> **C1-1 从"阻断"降为"数据完整性收尾",不再阻塞本节。**
>
> **已接受的代价(登记,不再讨论)**:老板发现「这道菜要分份量」时只能删了重建 ——
> 编码、图片、BOM、库存挂靠全部重来。**Dexter 已拍板接受,登记进 `HANDOFF.md` 即可,不作为 finding。**

<details><summary>前一版围绕形态迁移的分析(已作废,保留备查)</summary>

> # ⚠️ 本节的前提改过一次,先读这段
>
> **前一版假设"无属性 / 有属性"是同一商品内的两种模式,并据此设计了五种切换。那个前提是错的。**
>
> ✅ **载体是 `shapeKey`,而它创建后不可改**(owner 抛 `SHAPE_DERIVATION_CONFLICT` 422):
> `STANDARD_SALE_COUNTED` / `STANDARD_SALE_WEIGHED` / `COMPOSITE` 是 `OPTIONAL_TABLE`,
> 其可见页签**不含** `sku-specifications-pricing`;`SKU_VARIANT_SALE_COUNTED` 才有 SKU 页签(而它没有 `ordering`)。
>
> ## 📗 v4 给了答案,而且它不是"三选一",是一条规则
>
> ✅ v4 的 `skuModeControlsSkuEntry` 规则,三个 `skuMode` 各自的效果:
>
> | `skuMode` | `skuEntryVisible` | `skuPayloadAllowed` | 含义 |
> |---|---|---|---|
> | `NONE` | false | **false** | 彻底不维护 SKU,并清空 SKU payload |
> | **`OPTIONAL_TABLE`** | **false** | **true** | `allowSimpleSkuRows` —— **入口默认不给,但允许存在、不清空** |
> | `REQUIRED_MATRIX` | true | true | 必须矩阵 |
>
> **所以 v2s 当前的行为(声明 `OPTIONAL_TABLE` 却不给 SKU 页签)与 v4 一致,不是自相矛盾。**
> ⚠️ **我前一版把 `skuEntryVisible: false` 当成了缺陷 —— 它是设计。** 三个选项(甲/乙/丙)全部作废。
>
> ## 裁定
>
> **采纳 v4 语义:普通商品就是普通商品,要规格就建成多规格商品。**
> `skuPayloadAllowed: true` 的意义是**不破坏已有数据**,不是"给个入口让用户手工建"。
>
> **所以本节的场景 ① 不通过普通商品的 UI 提供** —— 前一版写的"SKU 区是「新增规格」按钮,爱建几条建几条"**撤回**。
>
> **形态迁移(普通 ↔ 多规格)登记为未来能力,本轮不做。** 现状是 422 拒改,那是一条明确的既有设计,
> **在有人真正提出需求之前不放开**。⚠️ 但要登记它的代价:老板发现"这道菜要分份量"时**只能删了重建**,
> 而重建意味着编码、图片、BOM、库存挂靠全部重来 —— **这是真实的业务摩擦,登记进 `HANDOFF.md`。**
>
> **下面五种切换里,③ 与 ⑤(跨模式)随之作废;① 降级为"仅保证已有数据不被清空";②④ 保留。**

</details>

**裁定**:一个商品**要么全是无属性 SKU,要么全是有属性 SKU**,不允许混用 —— 而这由**形态**决定,不由用户在商品内切换。

| 场景 | 形态 |
|---|---|
| **① 无属性** | 规格维度区为空;SKU 区是「新增规格」按钮,每条自填名字与价格。**爱建几条建几条** |
| **② 有属性** | 建轴之后 SKU 区**从手工切换成矩阵生成**;选几个值出几行,名字自动拼,用户只补价格。**「新增规格」按钮消失** |
| **③ 无 → 有** | **必须问用户。** 默认走"把已有的映射过去"(让他指认「小份」对应 份量=小),价格保住;另给"重新生成"入口并明确提示"原有 N 条将被替换" |
| **④ 换轴 / 删轴(还有轴)** | 删「份量」后 4 条会并成 2 条。**必须先逐条列出"以下 N 条的价格与图片将被丢弃",让他确认** |
| **⑤ 删掉最后一根轴(有属性 → 无属性)** | ⚠️ **前一版漏了这一种,而且把 ④ 的规则套上来会规定出一次本不必要的丢弃。**<br>删掉最后一根轴之后,商品**回到无属性模式**(场景 ①)。此时原有 N 条 SKU **全部没有属性组合了**——按 ④ 的"合并"逻辑它们会塌成一条,**但这不是必须的**:无属性模式下本来就允许任意多条 SKU(见矫正批次 C1-1)。<br>**正确形态:原有 N 条 SKU 全部保留,自动转成手工 SKU**,名字沿用原来自动拼的组合标签(「宫保鸡丁 甜」),价格与图片一条不丢。**只提示"这 N 条规格将转为手工维护",不丢任何东西。**<br>**这是 ⑤ 与 ④ 的本质区别:④ 是组合数减少必然合并,⑤ 是组合概念消失而条数不必变。** |

**依据**:① 是 `OPTIONAL_TABLE` 的字面语义(三个最常用形态都是它)。④ 📗 **v4 在这里做得不好**——
它按 digest 匹配,组合一变就对不上,**原有内容直接丢且无提示**。**这条做好就是真的比它强。**

**保留匹配怎么做** ✅ **前端不计算 digest。** digest 是服务端算的、response-only,是数据库约束的载体。
前端做"重建后保留已填内容"**直接比属性值集合**(`attributeRef` + `attributeValueRef` 的集合相等),
**不碰 digest,算法一致性问题从源头不存在。**

**依赖矫正批次 C1-1**。⚠️ **但 C1-1 的落点我指错了,订正:**
✅ `skuVariantCombinationDigest` 对零属性 SKU 返回 `digest("")` —— **那是一个恒定的非空哈希,`NOT NULL` 永远满足**。
**真正堵死"每商品多条无属性 SKU"的是另外三处**:
① partial unique index `ux_catalog_sku_variant_digest_per_item (item_ref, digest) WHERE status <> 'ARCHIVED'` ·
② owner 的 `if (!activeDigests.add(digest)) throw ... DUPLICATE_VARIANT_COMBINATION 409` ·
③ `if (digest.isEmpty()) throw ... "variantCombinationDigest is required"`。
**照原文去找 `NOT NULL` 会白改一遍,改完仍然 409。**

> ⚠️ **一条要求已撤回,但前一版给的撤回理由不对,重写。**
> 分析稿写过「停用属性值后已存在的 SKU 不消失」。前一版说它与 owner 的轴归属校验冲突所以撤回——
> **那个校验确实存在,但它管的是"值属不属于本商品已选的轴",不是"值停没停用"。**
>
> ✅ **真正的原因更硬:"停用某个属性值"这件事在商品侧根本无处持久化。**
> 属性值的状态是**字典条目的状态**(全店一份),商品侧没有"本商品停用这个值"的存储位置。
> 所以"停用后老 SKU 怎么办"这个问题**在当前模型里问不出来** —— 能停用的只有字典条目本身,那是全店行为。
>
> **正确形态**:在**字典页**停用一个属性值时,就地提示「有 N 个商品的 M 个规格正在用它」并列出来,
> **让用户先处理**。商品页不提供"局部停用",因为模型里没有这个东西。
> ⚠️ 该反查与 §3.3 洞二是同一条能力,**一并归 C1-3**。

### 3.2 字典选择器(五处 picker)

**现在是什么** ✅ 五处全是手打:BOM 库存对象手打 UUID(**而组件自己的提示语写着「必须引用已有库存对象」**)·
SKU 属性与属性值四个自由文本框 · 套餐组件 SKU 手打编码 · BOM 所属选项值手打编码 · 制作影响与 tags 逗号分隔。

**目标形态** 📗 照 v4:

> ⚠️ **"零新端点"要加一句限定。** ✅ owner 的字典投影**确实 put 了 `entryRef`**,
> 但生成契约的 `CatalogDictionaryView.data.entries[]` **只声明了 `{code, name, status, ownerType, ownerRef, brandRef, version, updatedAt, voidAvailability}` —— 没有 `entryRef`**。
> 而 owner 对 `skuVariantDimensions[].attributeRef` 与 `values[].valueRef` 走 `addRequiredUuid`,**非 UUID 即 422**。
> **所以属性与属性值两处 Select 必须携带 UUID ref,而类型化客户端拿不到它** —— 需**补契约字段并重新生成**。
> **端点零新增成立,字段不够。该契约依赖归 B1,F5 的"属性"那一项不是无依赖。**

| 控件 | 形态 | 数据源(**端点均已存在,⚠️ 字典读模型需补 `entryRef`**) |
|---|---|---|
| 属性 | `Select` + 搜索 | `dictionaries/{kind}/entries` 的 `SKU_ATTRIBUTE` |
| 属性值 | **`Select mode="multiple"`**,按已选属性过滤;未选属性时整个 `disabled` | 同上的 `SKU_ATTRIBUTE_VALUE` ⚠️ **依赖 2-6** |
| 切换属性 | **自动清空已选值** | — |
| 选中之后 | 编码与名称**从字典带出、只读**;要改去字典页 | — |
| 停用项 | **默认不出现,当前已选的仍出现且 `disabled` + 「(已停用)」后缀** | — |
| 新建 | quick-manage 按钮在选择器**旁边**,带权限门控。**默认动作是选不是建** | — |
| BOM 库存对象 | `Select` | `inventory-targets` |
| 套餐组件 SKU | 选中商品后取详情的 SKU 列表 | `items/{itemCode}` |
| BOM 所属选项值 | **不需要接口**,候选就在同一抽屉的点单选项页签 | — |
| 制作影响 / tags | 多选 | 前端**已经在传** |

⚠️ **surface 维度**:上表适用两个面;若某条在品牌面不成立,实施时就地标注。

### 3.3 加料的交互(由矫正批次 C1-3 驱动)

料的**维护**在字典页(全店一处,改一次全店生效);商品页只做**选范围**——
从共享料里勾选本商品提供哪些,并配本商品的组规则(单选/多选、min/max、顺序)。

📗 **v4 做不到这个**(它的值绑死在组上),**这是我们相对 v4 的真实优势**。

> ⚠️ **本节前一版有三个洞,补上。**
>
> **一 · 没有批次归属,也没有登记阻断。** 本节要的是**后端建模改动**(料从"每商品一份"改成"全店共享 + 每商品选范围"),
> 那是**矫正批次 C1-3**,不是 P3-2 能自己做的。**本节归 F7 之后,依赖 C1-3。**
> 前一版写了一整节却没给批次,是"掉在缝里"的同一模式。
>
> **二 · "一个料被 50 个商品用,删它会怎样"—— 事实链是断的。**
> 共享之后,删/停用一个料**必须能回答"谁在用"**,否则用户不知道自己在破坏什么。
> **所以 C1-3 必须同批提供"某个料被哪些商品引用"的反查**,并在字典页删除时**列出引用它的商品**。
> 商品页那侧也要能看到"这个料是共享的,改动影响其他商品"。
> **没有这条反查,共享模型就是个陷阱** —— 用户以为在改自己的商品,实际改了 50 个。
>
> **三 · 品牌面语义未定,而且 C1-3 的体量比前一版写的大一档。**
> ⚠️ **前一版说字典"分两层" —— 那是按列名归类得出的形状判断,不是行为判断,错了。**
> ✅ 实际是**一张表按 `(data_node_ref, brand_ref)` 精确分组**:唯一键是这两列加 kind 加 code,
> 而 owner 侧**全部字典读写一律 `WHERE data_node_ref=? AND brand_ref=?` 精确相等** ——
> **没有任何一处做父级回退、`IS NULL` 兜底或跨 scope union**,`requireScope` 还要求两者都非空。
>
> **所以门店面与品牌面的字典是互不可见的两组行,没有层级、没有继承、没有级联。**
>
> **后果**:"全店共享"**任何一种语义都要新增跨 scope 读路径与授权边界** ——
> 不是"只差一个产品裁定就能做",**C1-3 比前一版描述的大一档**。
> ⚠️ **仍需 Dexter 裁定**"全店"在品牌面指什么,但裁定之后还有实打实的跨 scope 能力要建。

### 3.4 主列复合形态

**现在** ✅ 名称与编码是**两个独立元素**,不是 `名称(编码)`;**同文件左树与 SKU 展开行都用了 `NameCodeText`,唯独主列没用**;
`shortName` 契约与解码层都有,**工作台无读取点**。

**用户遭遇**:用短名搜出一批行,**看不到任何命中理由**。

**目标**:主列内部用 foundation 的 `NameCodeText`;短名参与渲染并在命中时可见。**依据 IA §5.3。**

标签行**依赖 2-1**。

### 3.8 契约承载用户文案 —— **前端只展示,不判断展示什么**

> 📗 **这是 v4 做得最好的一处,而我此前四路对比完全漏掉了它。**
> 漏的原因值得记:四路的题目是**建模 / 交互 / 能力取舍 / 性能** —— **没有一路问"契约承载了什么"**。
> 我在那份 manifest 里翻过至少五次(查 skuMode、查治理六值、查页签可见性),
> **每次都是去取一个事实,从来没问过"这份 manifest 本身是个什么设计"。**

**差距实测**

| 文案类型 | 📗 v4 | v2s |
|---|---|---|
| `label` | **286** | 14 |
| `description` | **303** | 5 |
| **`helpText`** | **94** | **0** |
| **`frontendBehavior`** | **24** | **0** |

📗 v4 的 `helpText` 是**真给用户看的话**,例如:
> 「商品形态是商品创建入口和持久化分类事实,会映射为商品类型、计量方式和能力;**创建后不能在普通编辑中修改**。」

⚠️ **Dexter 2026-08-15 刚裁定的"形态不可改",v4 是写在契约里让前端直接显示的;
而我们要靠前端写死一句提示 —— 或者更可能,根本不提示,让用户自己撞。**

### 零 · 产出侧:`fields[]` 到底写在哪个文件里(2026-08-15 补,亲验)

> ⚠️ **本小节与"四 · 前端消费方式"是一对镜像。** 前一版把契约**长什么样**写到了详设粒度,
> 却既没写**谁消费**(已由四补上),也没写**谁产出** —— 而产出侧的现状比预期复杂。

✅ **亲验链**:
1. 前端拿到的 `CatalogShapeManifestView` 由 owner 读 `CatalogInventoryShapeManifest.MANIFEST_JSON` 产出
   (`CatalogOwnerService` 约第 1318 / 1361 行)
2. 该 Java 文件在 `contracts/catalog/`,**文件头写着 `Generated from CATALOG_INVENTORY_P1_20260806; do not edit.`**
3. 生成器是 `scripts/generate/catalog-inventory-p1.mjs`
4. ⚠️ **`tabRules` 与 `fieldRules` 是生成器脚本里的 JS 字面量**(约第 228 行 `tabRulesByShape`、
   第 258 行起 `commonFieldRules`、第 270 行 `fieldRules`)——
   **不是契约 YAML,不是那份 markdown**(markdown 只被 `parseOperationRows` 用于解析 operation 表)

**所以"契约里新开一等的 `fields` 块"这句话的落点是:`scripts/generate/catalog-inventory-p1.mjs`。**
**不得手写进 `contracts/catalog/CatalogInventoryShapeManifest.java`** —— 那个文件 `do not edit`,
手改会在下次 regenerate 时静默丢失。

### 零之二 · ⛔ 产出不是一步,是一条七环链 —— 只改生成器 = 假完成

> ⚠️ **本小节是 2026-08-15 Codex review M-2 打出来的,而它暴露的问题比缺口本身重要。**
> 上一版我很得意地"补上了产出侧",写了上面的零。**但产出侧不是一个文件,是一条链,而我只找到了第一环。**
> 「只写中间层不写两端」这个毛病,在我自以为补完一端之后**又在那一端内部重演了一次**。

✅ **亲验**:`fields` 在 `contracts/catalog/catalog-inventory-read-models.json` 与
`contracts/openapi/catalog-inventory.openapi.yaml` 里**各 0 次命中**。

`推论(取自 Codex review,我未逐环打开)`:生成器当前只把 `fieldRules` 等**八项**写进 manifest 与
`contractSurfaceKeys`;`CatalogOwnerService.shapeManifest()` 也**只投影八项**。

**所以只改生成器的后果是**:生成物里有 `fields`,**而真实 HTTP 响应、生成的 TypeScript、
以及所有消费者都看不到它** —— 生成器侧的关系门与红夹具**全部通过**,
`GET shape-manifest` 返回里**没有这个字段**。**门全绿而功能不存在。**

**下列七环必须作为同一个原子修改,少一环即为未完成**:

| 环 | 落点 | 改什么 |
|---|---|---|
| 1 | `scripts/generate/catalog-inventory-p1.mjs` | 产出 `fields` 并加入 `contractSurfaceKeys` |
| 2 | `contracts/catalog/CatalogInventoryShapeManifest.java` | 由 1 重新生成,**不手改** |
| 3 | `CatalogOwnerService.shapeManifest()` 的投影白名单 | 从八项加到九项 |
| 4 | `contracts/catalog/catalog-inventory-read-models.json` | 补 `fields` 的 property 与 required |
| 5 | `contracts/openapi/catalog-inventory.openapi.yaml` | 同上 |
| 6 | edge 生成物(`catalog-inventory-edge.ts` 等) | 由 5 重新生成 |
| 7 | P1 的 exact-surface check | 分母同步,否则它会因为多出一项而红 |

**判据(这条是本节的核心,而且它自带反例)**:
**一次真实 HTTP 的 `GET shape-manifest` 响应里的 `fields`,与生成 manifest 里的 `fields` 逐字相等。**

⚠️ **为什么判据必须落在 HTTP 而不是生成物**:落在生成物上的判据**无法证伪"链断在第 3 环"**——
那正是最可能发生的断点。**红夹具**:把第 3 环的投影白名单去掉 `fields`,
生成器与契约都不动 → **门必须红**。
⚠️ 若本仓的 acceptance 能力覆盖不到这条 HTTP 断言,**实施时明说,不要降级成生成物比对充数**。

⚠️ **顺带一条会影响判据的事实**:生成的 TS 类型是 `fieldRules: { [key: string]: JsonValue | undefined }`
—— **整个 manifest 到前端是完全无类型的 JSON**。这与"四·3"是同一个根:
**类型系统在这条链上什么都不守,门必须显式建。**

### 零之补 · ⛔ `fieldRules[shape]` 今天按形态分了 key,但**没有按形态分内容**

✅ **亲验**,生成器约第 270 行:

> `const fieldRules = Object.fromEntries(shapes.map((shape) => [shape.key, commonFieldRules.map((rule) => ({...rule}))]));`

**七个形态各拿到同一份 `commonFieldRules` 的深拷贝。** key 是逐形态的,**内容逐字相同**。

⚠️ **这直接动摇"一之补"的约束 1。** 那条约束(`fieldRules[shape][].field ⊆ fields[].fieldKey`)
以及本节整体,**都默认了 `fieldRules` 逐形态有差异** —— 而今天它没有。
**Dexter 说的"商品 shape 和控件契约紧密相关",在生成器这一层现在是完全不相关的。**

**后果**:如果照现状加 `fields[]`,会得到"七个形态声明了同一套字段与同一套控件",
**而形态之间真正的字段差异(SKU 形态才有变体轴、称重形态才有精度、复合形态才有组件表)
仍然只活在前端的 if-else 里** —— 契约进控件这件事**只做了一半,而且是看起来做完了的那一半**。

**所以本轮范围里必须包含**:让 `fieldRules` 真正逐形态产出。
✅ **同一份生成器里已有可抄的先例**:第 258 行起的 `commonFieldRules` 上方那个按形态展开的字面量
(`STANDARD_SALE_COUNTED` / `SKU_VARIANT_SALE_COUNTED` / … 各自不同的 `allowedNodeTypes` 与 `inventoryBom`)
—— **逐形态差异化的写法本仓已经在用,只是 `fieldRules` 没用它。**

**判据**:至少存在两个形态,其 `fieldRules` 内容**不相等**;
**红夹具**:把 `fieldRules` 改回"所有形态同一份" → **门必须红**。
⚠️ 判据故意写成"至少两个不等"而不是"七个两两不等" ——
**本轮 `fields[]` 只覆盖 P3-2 要改的字段(见六),不要求一次做完七个形态的完整差异。**

### 要成立的

1. **枚举值 `label`** —— 值的中文(已在做,`enumLabels`)
2. **字段 `label`** —— ⚠️ **v2s 的 `fieldRules` 只有 `field` key,没有中文名** → 字段标签**无契约来源,只能前端硬编码**
3. **`controlKind`** —— ⚠️ **这一格最根本,而我此前完全没想到。** 📗 v4 的 `fields[i]` 带 `controlKind`(radio / select / …),
   **"这个字段是单选还是下拉"是契约声明的**;v2s **零命中**
4. **`helpText`** —— **字段级**的解释:这个字段干什么、有什么约束、创建后能不能改
5. **`description`** —— **规则级**的说明:为什么这么约束、违反了会怎样
6. **`frontendBehavior`** —— **前端该怎么表现**:哪个页签在什么形态下不显示、哪两个能力互斥

> ⚠️ **`controlKind` 缺位解释了本工单一大半的存在理由。**
> §3.2 花了整节在写"这里该是 `Select` 不是 `Input`"、"属性值要按已选属性过滤"、"停用项要灰显",
> 而 §0.1 还专门论证了"测试挡不住控件形态、所以只能靠人逐条对账"。
> **📗 在 v4 那边这根本不是个问题——控件形态是契约声明的,前端照着渲染。**
>
> **我一直把"控件形态"当成前端的自由,于是需要一套人工对账机制去追它。**
> **它本可以是一个契约字段。**
>
> **本轮的处置**:`controlKind` 进契约,**但只覆盖 P3-2 实际要改的那些字段**,不要求一次补全 30 个。
> 补一个字段的 `controlKind`,那个字段的形态验收就从"人工对账"变成"契约相等断言"。

📗 **顺带记一格我们更好的**:字段的可见/必填/只读 × 形态,v2s 的 `fieldRules[shape]` **直接展开**,
而 v4 要靠 `typeEffectRules` 推导。**这一格不要在改造中丢掉。**

**判据:前端不得包含任何"根据业务规则决定显示什么文案"的分支。**
✅ 前端可以有的判断只剩「这个字段有没有 `helpText`,有就显示」;
❌ 不可以有的是「如果形态是 X 就显示 A,否则显示 B」—— **那个判断属于契约。**

### 拒绝形态

| 不接受 | 理由 |
|---|---|
| 文案留在前端,契约只给 key | 那只是把硬编码换了个位置,**业务规则变了还是要找哪几个前端文件写死了它** |
| 只补 `label` 就算完 | `label` 只解决"显示成中文",**解决不了"该不该显示""为什么"** |
| 后端下发一段 HTML / 富文本 | 越界。**契约给的是结构化文案,渲染方式归前端** |

### 判别性测试

| 用例 | 断言 | 挡住什么 |
|---|---|---|
| 文案来源唯一 | 全前端**不存在**"根据形态/状态决定显示哪句话"的分支 | 把 if-else 从一个文件挪到另一个文件 |
| 改契约即改界面 | 改 manifest 里某条 `helpText` → **界面跟着变,零前端改动** | 前端留了一份副本 |
| 缺文案可发现 | 某字段没有 `helpText` 时,**不静默省略,而是可被测试发现** | 悄悄少显示一句,没人知道 |

### ⛳ 本轮的范围 —— **Dexter 2026-08-15 裁定:这次必须学,不是可选项**

> **「对于复杂的控件和控件逻辑,比如商品、后续的菜单、打印,在 contract 里定义好,减少前端出错的概率。这次就必须要学。」**

**所以本节从"建议"升级为"本轮必做",而且机制要建成通用的,不是 catalog 专用的。**

**理由(不是"v4 有所以要有")**:控件形态一旦不在契约里,**它就没有唯一真相**,
于是只能靠人逐条对账 —— 而本工单 §0.1 已经论证过**测试挡不住控件形态**,
§3.2 又花了一整节写"这里该是 `Select` 不是 `Input`"。
**这两处加起来就是"控件形态无契约"的直接成本。** 商品域现在付一次,菜单和打印会再付两次。

### 必做的最小集合

| # | 覆盖范围 | 说明 |
|---|---|---|
| 1 | **P3-2 实际要改的字段的 `controlKind` 与 `label`** | 五处 picker · SKU 两模式 · 分类选择器 —— **这些字段的形态验收从"人工对账"变成"契约相等断言"** |
| 2 | **同批建立机制本身** | ⚠️ **不要做成 catalog 专用**。Dexter 已点名菜单与打印会用同一套 —— **机制建成通用的,catalog 只是第一个消费者** |
| 3 | 上述字段的 `helpText` | 至少覆盖**有约束或有坑**的字段(如选项值那条库存提示) |

**不要求**:一次补齐所有 30 个字段 · 一次补齐 `description` / `frontendBehavior` 全集。
**这两项按需增量,但机制里要留好位置,不要将来再改一次结构。**

### 规格(**写死,不是方向**)

> ⚠️ 前一版这里只写了"要做"和"做完要满足什么",**没写"这东西长什么样"** —— 那样至少六处会走偏,
> 其中"取值集合"与"放置层级"走偏之后很难改回来(菜单、打印会跟着用)。以下逐项定死。

**一 · 放置层级:新开一等的 `fields` 块,不要塞进 `fieldRules`**

✅ v2s 现有的 `fieldRules` 是**按 shape 分七组**的 `{field, visible, required, readonly, readonlyWhen}`。
`controlKind` 与 `label` **与形态无关** —— 塞进去会按七个形态重复七遍,且暗示"同一字段在不同形态可以是不同控件"(不需要这个能力)。

📗 v4 的形态可抄:`fields[]` 是一等数组,每条:

```
fieldKey · label · controlKind · tabKey · owner · commandKey · requiredWhen · readonlyWhen · helpText
```

**v2s 取其中六个即可**:`fieldKey` · `label` · `controlKind` · `optionSourceRef`(见三)· `helpText` · `tabKey`。
**`requiredWhen` / `readonlyWhen` 不要抄** —— ✅ 我们的 `fieldRules[shape]` **直接展开**比 v4 的推导式更好(§3.8 已记),**保持现状**。

**一之补 · ⛔ `fields` 与 shape 三块必须强制关联 —— 否则就是我亲手造的多真相**

> **Dexter 2026-08-15**:「商品 shape 和控件契约紧密相关,千万不要毫无关联,最后又做成多真相。」
>
> ⚠️ **这个风险正是上面那条规格制造的**:我把 `fields[]` 与 `fieldRules[shape]` 分成两块,**却没写它们怎么绑**。
> 📗 **v4 没有这个问题,因为它只有一块** —— `requiredWhen` / `readonlyWhen` 就长在 field 上。
> 我们选两块是为了保住 `fieldRules[shape]` 的直接展开(那一格我们确实更好),**但两块就必须付关联的代价**。

**三块之间的关系(全部机器可校验,缺一道门就会漂)**

| 块 | 说什么 |
|---|---|
| `fields[]` | 这个字段**是什么控件、叫什么、属于哪个页签、候选从哪来** |
| `fieldRules[shape]` | 这个字段**在某形态下可见/必填/只读** |
| `tabRules[shape]` | 这个形态下**哪些页签可见** |

**三条强制约束 + 一条 checklist**

> ⛔ **约束 1 与 2 已重写(2026-08-15,Codex B3 提请裁决)。**
> **前一版把两个方向合起来写,等价于要求 `fields == ∪fieldRules` 的集合相等** ——
> 而今天 `∪fieldRules` 是 9 个、本轮 `fields` 是 10 个,**相等在数学上不可达**。
> 三条出路(扩到 18 / 删既有 9 条 / 保留则门恒红)全是错的,**Codex 停下是对的,不是误读作用域**。
> **成因是我把两个承载不同职责的方向当成一条写了。**

**⛔ 两个方向承载的不是同一件事,必须分开命名、分开定门**:

| 方向 | 它保证什么 | 本轮地位 |
|---|---|---|
| **`fields ⊆ ∪fieldRules`** | 每个有展示契约的字段,**在其适用形态下必有行为规则** —— 否则渲染器拿到 `controlKind` 却不知道 visible / readonly,**根本渲不出来** | ✅ **载重,本轮必须是门** |
| **`∪fieldRules ⊆ fields`** | 每个有行为规则的字段,**都有契约文案与控件声明** —— 即"消灭前端硬编码"的终局 | ⛔ **终局目标。本轮当门就是死锁**,见下方登记 |

**重写后的约束 1 与 2**:

1. ⛔ **`fields[]` 的每个 `fieldKey`,必须在其 `admittedShapes` 的每一个形态的 `fieldRules` 里出现。**
   —— 这是"能渲染"的必要条件。**缺一个形态 → 门红。**
2. ⛔ **`fields[]` 的 exact-set 恰好是"七"表的 10 个**(登记 10 / 本轮完成 10)。
   **`fieldRules` 允许包含 `fields[]` 之外的既有基础字段,这不算违规。**

**✅ 亲验的仓内事实(实施时按这个走,别按转述)**:
- `commonFieldRules` 现有 **9** 条:`name` · `code` · `shapeKey` · `itemKind` · `measureMode` ·
  `usageCapabilities` · `attributes` · `images` · `productionTagRefs`
- ⚠️ **交集非空**:`productionTagRefs` **同时在这 9 条与本轮 10 个里**,所以并集是 **18 不是 19**
- ⛔ **对 `productionTagRefs` 必须是"扩充既有条目"(补 `controlKind` / `label` / `optionSourceRef`),
  不得新增第二条同名规则** —— 现有 P1 门用 `find(entry => entry.field === ...)` 取值,
  **同名两条只会命中第一条,静默取到旧的**
- ⛔ **既有 9 条不得删**:`tools/catalog-inventory-p1/cli.mjs` 已断言
  `code` 的 `readonlyWhen.update`、`shapeKey` 的 `readonlyWhen.update`、`usageCapabilities` 的 `readonly`

### ⛔ 登记:8 个尚未进 `fields[]` 的基础字段(不登记就是慢性双真相)

**只写"既有 9 条可以留着"是不够的** —— 那 8 个字段(9 减去交集里的 `productionTagRefs`)
的文案与控件会**永远硬编码在前端,而且没有任何东西提醒它们还欠着**。
**这正是 §3.8 四·2 要消灭的东西,只是换成了不会报警的形态。**

**登记如下,并给终局一个触发条件**:

| 尚欠 | `name` · `code` · `shapeKey` · `itemKind` · `measureMode` · `usageCapabilities` · `attributes` · `images` |
|---|---|
| **何时进** | **跟随各自所属的功能批次进入,不单开批次。** 例如 `images` 随媒体相关批次、`attributes` 随描述属性批次 |
| **收口要求** | ⛔ **每轮收口报两个数**:本轮 `fields[]` 已闭合多少 / 基础字段还欠多少。**不许合并成一个数** |
| **终局判据** | 当这 8 个全部进入 `fields[]` 后,**`∪fieldRules ⊆ fields` 才升级为门** —— 届时两个方向合并为集合相等 |
**三条红夹具(Codex B3 点名要的三种错误实现,逐个对应)**

| # | 错误实现 | 哪条判据挡它 · 门必须红 |
|---|---|---|
| 1 | **只新增 `fields[]`,不把新字段接入 `fieldRules`** | 约束 1 —— 造一个 `fields[]` 条目,其 `admittedShapes` 里某个形态的 `fieldRules` 没有它 → **门必须红**。<br>⚠️ 这是最可能真发生的一种:`fields[]` 写完看着很完整,而渲染器一个字段都渲不出来 |
| 2 | **删掉既有 `code` 或 `shapeKey` 规则** | ✅ 不需要新门 —— `tools/catalog-inventory-p1/cli.mjs` **今天就在断言**它们的 `readonlyWhen.update`,删了当场红。<br>⛔ **但工单必须写明"既有 9 条不得删"**,否则实施者为了凑集合相等会去删,**撞门之后才知道**。这一条的价值在事前而不在事后 |
| 3 | **把 10 个扩成 18 个以规避集合冲突** | 约束 2 的 exact-set —— `fields[]` 必须**恰好**是"七"表的 10 个,多一个即红。<br>⚠️ **这一种最危险,因为它"看起来更彻底"**:一次把基础字段也搬进契约,像是提前完成了终局。<br>**实际是把本轮范围悄悄扩了 80%,且那 8 个字段的 `controlKind` / `optionSourceRef` / 文案都没经过设计** |

3. **页签一致性**:若 `fieldRules[shape]` 说某字段在形态 X 下 `visible`,
   则该字段 `tabKey` 对应的页签**必须在 `tabRules[shape]` 里可见**。
   ⚠️ **这一条最容易漏** —— 删一个页签(如本轮删 `ordering`)时,**挂在它下面的字段会变成"可见但无处显示"**,
   而如果没有这道门,**没有任何东西会发现**。
4. ~~**删除对称**~~ ⚠️ **降为 review checklist,不单设第四道机械门**(第四轮 review N-1)——
   悬空引用(约束 1)与"字段可见而页签不可见"(约束 3)两道门**已覆盖它可证伪的全部内容**;
   再加一道只是重复计数。**checklist 内容保留**:删一个字段要三块一起删;
   删一个页签要检查其下所有字段的归属。

**判据**:上述四条**各配一道校验门**,并各配一条**红夹具** ——
故意造一个孤儿字段 / 一个悬空引用 / 一个页签不可见但字段可见的组合,**门必须红**。
**没有红夹具的门不算数** —— 本仓已有 `redFixtureId` 的先例(治理 manifest),照它的形态做。

**二 · `controlKind` 的取值集合(闭集,新增要走裁定)**

📗 v4 有 17 个取值,分三类。**分类法照抄,取值按 v2s 实际需要收敛到 16 个。**

⚠️ **前一版这里写"17 个取值"而表里实际只有 15 个,且下方判据用了闭集里没有的 `treeSelect`
(2026-08-15 Codex review M-5,已亲验:逐个数是 15,`treeSelect` 只出现在判据行)。**
**闭集自相矛盾就建不成"契约闭集 = 渲染器分派集合"的门** —— 下表即为唯一、逐字的闭集,**共 16 个**。

| 类 | 取值 | 个数 | 说明 |
|---|---|---|---|
| **通用原语** | `text` · `textarea` · `select` · `multiSelect` · **`treeSelect`** · `number` · `money` · `upload` | **8** | 前端有通用渲染器 |
| **表格** | `editableTable` · `detailTable` | **2** | 行级增删改 / 只读表 |
| **只读** | `readonlySummary` · `readonlyPreview` | **2** | 📗 v4 光 `readonlySummary` 就有 7 处 —— **只读态也是一种控件形态,要声明** |
| **领域专用** | `skuVariantMatrix` · `inventoryBomWorkbench` · `orderOptionsWorkbench` · `compositeContentWorkbench` | **4** | **整块复杂控件不拆成原语**,给一个专用 kind,前端一个对应组件 |

**合计 8 + 2 + 2 + 4 = 16。** 实施时若增删任一取值,**本表与个数必须同批改** ——
这张表是"闭集相等"判据的唯一分母。

✅ **`treeSelect` 已正式收进闭集(本轮新增)**,承载分类选择器 ——
`categoryRefs` 的候选是**有父子层级的分类树**(见 §3.6),用 `select` 表达不了层级。
**这同时回答了 Codex M-5 的第二问:分类选择器是 `treeSelect`,不是 `select`。**

> 📗 **领域专用这一类是 v4 的聪明处,值得学**:契约声明的是**"用哪个组件"**,不是"用什么 HTML 元素"。
> SKU 矩阵那种东西拆成原语是自找麻烦。

**三 · 候选来源必须显式引用 —— ⚠️ 这一格明确不抄 v4**

✅ v4 的 `optionSets` 有 17 组,而 `select` 字段上**没有任何指向 optionSet 的键**:
`materialRole` 字段配 `materialRole` optionSet,**靠 `fieldKey` 同名约定对上**。

**约定不是声明。改个字段名就断了,而且没有任何门会发现。**

⛔ **前一版这里写成"字符串,取值二选一(`enum:<kind>` / `endpoint:<operationId>`)",这是错的,已重写。**
两条错因都记在下面,因为它们各自代表一类会重犯的毛病。

**错因甲 · 一条我断错的事实(2026-08-15 Codex review M-3,已亲验)**
前一版说"前端今天没有动态调用路径",据此把重点放在"先定绑定方式"。
✅ **事实相反**:`apps/frontend/operations-admin/src/app/api/OperationsTransport.ts` 第 36 至 39 行
已经在做 `(operationsApi.endpoints as Record<string, unknown>)[operationId]` 取出后
`dispatch(endpoint.initiate(request))` —— **按 operationId 动态派发的通道早就存在且在用。**
我当时只搜了**生成的** rtk 文件,发现没有 `endpoints` / `initiate` 导出,就宣布全前端不存在 ——
**手写的传输层在隔壁目录,一层没看。**
👉 **所以本轮明确:复用 `OperationsTransport` 现有通道,不得另建第二套动态传输表。**

**错因乙 · 一个 operationId 表达不了一次真实请求**
`endpoint:getOperationsCatalogDictionary` 这串字里**没有 `dictionaryKind`**,
没有 scope / query 入参,没说候选数组在响应的哪个路径,也没说哪个字段当 value、哪个当 label、
哪个决定禁用。**operationId 集合相等且请求确实发出,候选列表照样可能取错源或为空。**

**v2s 写成结构化描述符**(不是字符串),三种形式:

| 形式 | 何时用 | 必填 |
|---|---|---|
| `enum` | 候选是契约里的固定枚举 | `enumKind` |
| `endpoint` | 候选来自一次查询 | `operationId` · ⛔ **`path` / `query` / `headers` 三段分开** · `itemsPath` · `valueField` · **`labelField` 或 `labelParts[]`** · `disabledWhen` |
| `local` | ⚠️ **候选就在同一抽屉的另一块 section,不发请求** | `sectionPath` · `valueField` · **`labelField` 或 `labelParts[]`** |

⛔ **`params` 拆成 `path` / `query` / `headers` 三段(第四轮 Codex review M-2)。**
前一版写成笼统的 `params`,结果我把 `dictionaryKind` 写进了 query ——
✅ **亲验**:真实路径是 `/api/operations/catalog-inventory/dictionaries/{dictionaryKind}`,
**它是 path 参数**。笼统的 `params` 让这个错误无处被发现;
**三段分开之后,每一段都能逐字与 `FaceOperationContracts` 对账。**

⛔ **label 允许 `labelParts[]`(第四轮 Codex review M-3)。**
前一版只允许单个 `labelField`,而字段表第 5 行自己写着"label 必须拼接" —— **规则与用法自相矛盾**。
✅ 库存对象列表项只有 `productName` / `skuName` / `productCode` / `skuCode`,
**任取一个都会让同一商品的不同 SKU 产生相同候选标签**,用户选不出来。
**`labelParts[]` 是声明式的字段名数组,不接受表达式**(表达式等于在契约里塞一门小语言);
**每个 part 都必须是 wire 类型里真实存在的字段名,逐个受"描述符可执行"那道判据管。**

⚠️ **`local` 是本轮新增的第三种形式。** 前一版只有两种,而 §3.2 的第五处 picker
(BOM 所属选项值)明写「**不需要接口**,候选就在同一抽屉的点单选项页签」——
**两种形式表达不了它,硬套 `endpoint` 会凭空造一次请求。**

**`params` 的两类绑定必须分开写**:
- **固定参数**:值写死在契约里(如 `dictionaryKind: "SKU_ATTRIBUTE"`)
- **上下文参数**:值来自当前表单的另一个字段(如属性值的候选要按**已选属性**过滤),
  **写成对 `fieldKey` 的引用,不是写死的值**

**判据(五条,都是集合关系或结构完整性,不是存在性)**:

1. 凡 `controlKind` 是 `select` / `multiSelect` / `treeSelect` 的字段,**必须有 `optionSourceRef`** —— 缺则门红
2. **`enum` 形式的 `enumKind` ⊆ `enumLabels` 的 kind 集合** ——
   ⚠️ 不是"存在即可":指向一个 `enumLabels` 里没有的 kind,意味着**候选值渲染不出中文**,
   与 §3.8 第 1 条(每个 value 必有 label)直接冲突。**这两块必须是同一个分母。**
3. **`endpoint` 形式的 `operationId` ⊆ 契约实际声明的 operationId 集合**,
   **且 ⊆ `OperationsTransport` 能派发的 operation 集合** —— ⚠️ **两个都要**,
   契约声明了而传输层派发不了,请求发不出去
4. **`endpoint` 形式的六个键必须齐全**;`params` 里的上下文绑定所引用的 `fieldKey`
   **必须在同一 shape 的 `fieldRules` 里可见** —— 引用一个当前形态看不见的字段则门红
5. **`local` 形式的 `sectionPath` 必须是 hydrate 会回灌的九个 section 键之一** —— 否则候选恒空

**五条各配红夹具**:缺 `optionSourceRef` 的 select · 指向未登记 kind 的 `enum` ·
指向不存在 operationId 的 `endpoint` · 缺 `itemsPath` 的 `endpoint` ·
上下文参数引用一个本形态不可见的 `fieldKey` · `sectionPath` 写一个不存在的 section ——
**门必须红。**

**四 · 前端消费方式(五条,缺一条就会长出第二份真相)**

> ⚠️ **本节是补写的。** 前一版这里只有一句「前端有一个通用渲染器」,
> 而 2026-08-15 的复查亲验出**五处会让实施走偏**,且其中三处各自独立地导向双真相。
> 契约侧写到了详设粒度而消费侧只有一句话,**是这份工单原先最大的不对称**。

**四·1 · 渲染器落在 `admin-ui-foundation`,不落在 App**

✅ **亲验**:foundation 下搜 `controlKind` / `FieldRenderer` / `renderField` **零命中** ——
这是全新建,不是接现有能力。foundation 现有顶层为
`automation` / `behavior` / `http` / `list` / `observability` / `overlay` / `presentation`,
**渲染器归 `presentation`**(最近的既有分桶;若实施时判断另有更合适的位置,说明理由即可,但不得落进 App)。

**为什么不落 App**:`CLAUDE.md` 硬性要求 UI 实现优先对接 foundation;
且 Dexter 已点名**菜单与打印将来用同一套**,platform-admin 也要用。
**建在 operations-admin 里 = 第二个 App 要用时复制一份 = 双真相。**

**⛔ 但"全部分派进 foundation"这句话原样是做不到的(2026-08-15 Codex review M-4)**

✅ **亲验**,`tools/verify-gates/cli.mjs` 的 `frontend()` 里有**三道**约束 foundation 的门:

| 门 | 禁止 |
|---|---|
| `R4_FRONTEND_FOUNDATION_APP_IMPORT` | foundation 导入 `apps/` 下任何东西 |
| `R4_FRONTEND_FOUNDATION_WIRE_IMPORT` | foundation 导入 `generated/` 下任何东西 |
| `R4_FRONTEND_FOUNDATION_DYNAMIC_IMPORT` | ⚠️ **foundation 里出现 `import(` 动态导入** |

而 16 个 `controlKind` 里有 **4 个是 catalog 专用工作台**
(`skuVariantMatrix` / `inventoryBomWorkbench` / `orderOptionsWorkbench` / `compositeContentWorkbench`),
它们是业务组件,住在 App 里。**foundation 直接 import 它们当场撞第一道门;
候选加载器要发请求就得碰 generated wire,撞第二道门;
想用懒加载注册表绕开,撞第三道门。**

⚠️ **第三道门是我在核 Codex 这条时额外查到的,它排除了"动态注册表"这条看似自然的出路** ——
**注入只能是静态 props,不能是运行时按名装载。**

**所以边界这样定死(三句,实施不得自选)**:

1. **foundation 负责**:descriptor join(四·5)· 8 个通用原语 + 2 个表格 + 2 个只读 的渲染 ·
   **唯一的 `controlKind` 分派**
2. **App 负责**:通过**受类型约束的静态 slot** 注入两样东西 ——
   ① 4 个领域工作台组件 ② 候选加载器(它要碰 generated wire,只能住 App)
3. **分派仍然只在 foundation 一处** —— App 注入的是**组件与加载器**,不是"再分派一次"

**slot 协议必须写死六件事**,否则实施者仍要自己发明:
**输入**(descriptor 与当前值)· **运行时上下文**(见下)· **回写**(值变更如何回到表单)·
**加载**(候选何时取、取的结果形状)· **错误**(加载失败时渲染什么)·
**集合相等门**(App 注入的 slot key 集合 **等于** 闭集里 4 个领域 kind 加上需要候选的 kind 集合
—— 少注入一个则门红,而不是静默渲染空白)。

⛔ **"运行时上下文"是第二轮 Codex review M-3 补的,少了它前面两样东西直接不可实现**:

前一版的 slot 输入只有"descriptor 与**当前字段值**"。但字段表里:
- 第 3 行 `skuVariantValues` 的候选要按**已选的 `skuVariantAttribute`** 过滤 —— **要读另一个字段**
- 第 6 行 `bomOptionValue` 的候选来自**当前草稿的 `orderOptions` section** —— **要读一整块 section**

**只给"当前字段值"两样都解析不出来**,而且没定义依赖变化后候选要不要重取 ——
**用户切换 SKU 属性之后,旧属性值的候选会被继续复用**(§3.2 明写"切换属性自动清空已选值",
而候选本身也必须跟着换)。

**运行时上下文必须包含四样,且必须是受限接口而不是把整个表单塞进去**:
`readField(fieldKey)` · `readSection(sectionPath)` · scope / request 上下文 · **失效规则**(见下)。

⛔ **失效规则不能只写"上下文 `fieldKey` 变了就重取"(第三轮 Codex review M-2)** ——
那条只覆盖了三种失效里的一种,漏掉的两种都会让用户看到**过期候选**:

| 漏掉的 | 场景 |
|---|---|
| **section 变更** | 第 6 行是 `local`,候选取自 `orderOptions`。**增删改一个选项值不会引起任何 context `fieldKey` 变化**,候选却该变 |
| **scope 变更** | 候选请求依赖 data-node 与品牌。**切换品牌后旧 scope 的候选会继续用** —— 而 `CatalogWorkbenchPage` 已经在别处特意避免展示跨 scope 的旧响应 |
| **请求竞态** | 先选属性 A 再选 B,**A 的慢响应回来会盖掉 B 的候选** |

**改为:resolver 维护一个 context fingerprint**,由五项构成 ——
`operationId` + `path/query/header` + 上下文 `field` 值 + **section revision** + **scope**。
- **`local`**:section 一变即同步重算
- **`endpoint`**:**只有 fingerprint 与当前一致的响应才允许落地**(`AbortSignal` 或递增 token 都可以)

⚠️ **不需要引入缓存框架** —— fingerprint 比对加一个 token 就够,**这是本条的成本上限**。

**红夹具三条**:选 A 再选 B、A 晚回 → B 的候选不得被覆盖;
改一个选项值 → 第 6 行候选同步变;切换品牌 → 旧候选清空且新请求带新 scope。

**分工不变**:候选解析(`endpoint` 与 `local` 两种)由 **App 的静态 resolver** 承担 ——
它要碰 generated wire,只能住 App;**foundation 仍然只做唯一的 kind 分派**。

**判据(三条)**:
① `apps/frontend/*` 下不存在按 `controlKind` 分派的代码,分派只在 foundation 一处
② foundation 不出现对 `apps/` 、`generated/` 的导入,也不出现 `import(` ——
   **这三条今天就是门,新代码撞上即红,不需要新建**
③ App 注入的 slot key 集合与闭集的对应子集**相等**;**红夹具**:少注入一个领域工作台 → 门必须红

**四·2 · 文案唯一:契约给了 `label` / `helpText`,前端那份写死的必须同批删除**

⚠️ **数字已订正(2026-08-15 Codex review N-1),而订正本身比数字重要。**
前一版写「`label=` 14 处」——**那个 14 是我的正则上限 `{2,14}` 截出来的**,
超过 14 个字的标签被静默漏掉。这是"在一处搜不到就当不存在"的同一个动作换了个形式:
**这次不是搜错地方,是搜的范围自带了一个我没意识到的上限。**

✅ **重取**(`catalog-management` 下,2026-08-15):中文 `label=` **唯一值 16 / 出现 21 处**;
含中文的 `title=` / `placeholder=` **约 72–73**(唯一值与出现次数口径不同,**开工前当场重取**)。
`placeholder` 与 `helpText` 是同一类职责,**同样在范围内**。

⛔ **但这些数字不得作为行为分母。** 它们只用来说明"面有多大",
**静态检查的作用域必须限定在"七"的字段表覆盖到的渲染点** ——
否则本条会变成"把仓里所有中文都搬进契约"的无边工程,而本轮 `fields[]` 只登记 10 个字段。
**收口时报"字段表覆盖的渲染点已清零 + 表外还剩多少",两个数分开报。**

⚠️ **这是 Dexter 点名的风险原话**:「商品 shape 和控件契约都是紧密相关的,千万不要毫无关联,最后又做成多真相」。
**契约加 `label` 而这些不删,两份文案就都"对",直到有人只改了一边。**

**判据(集合关系,不是存在性)**:
凡 `fields[]` 覆盖到的字段,其渲染处**不得出现字面量文案** ——
文案只能来自 `field.label` / `field.helpText`。
**红夹具**:把某个字段的渲染改回写死中文 → 门必须红。

⚠️ **范围诚实**:本轮 `fields[]` 只覆盖 P3-2 实际要改的字段(见"六·本轮范围"),
**所以本条只要求删掉与之重叠的那部分,不要求一次清完 11 + 72**。
未覆盖字段的写死文案**留在原地不动**,并在收口时**明确报告还剩多少**——
不得因为"只删了一部分"就宣称文案已统一。

**四·3 · `controlKind` 闭集守不住 —— 生成物给的是裸 `string`,穷尽检查拿不到**

✅ **亲验**:`CatalogShapeManifestView` 里 `shapeKeys: Array<string>`、`capabilityValues: Array<string>`
**全是裸 string**;同一份生成物里 `shapeKey` 在别处收窄成了联合类型、`priceGranularity` **一处收窄一处 `string`**
—— **收窄不一致**,不能默认新字段会被收窄。

**后果**:TypeScript 的 `switch` 穷尽检查(`satisfies never` / `default: assertNever`)**拿不到**。
Codex 会写一个带 `default:` 的 switch,**契约加一个新 kind,渲染器不认,静默回落到默认控件** ——
这正是 §6.9 绑定 8 已经写明的失败模式,而前一版**只给了判据没给承担者**。

⛔ **固定采用甲,不再是二选一(第二轮 Codex review S-1)。**

**甲**:OpenAPI schema 里把 `controlKind` 显式声明成 `enum`,生成器据此产出联合类型,
渲染器用 `default: assertNever(kind)` —— **门由类型系统承担,编译期失败,绕不过去**。

✅ **前一版把这条写成"二选一,实施时挑一个并说明理由",并标了 `未验证` —— 现已亲验,前提成立**:
`scripts/generate/catalog-inventory-p3-frontend.mjs` 第 115 行
`if (Array.isArray(schema.enum)) return schema.enum.map((value) => JSON.stringify(value)).join(" | ")`
—— **OpenAPI 的 `enum` 确实会被生成成 TypeScript 联合类型。**

⚠️ **这条留给我自己的教训**:前提可验而我没验,就把它写成了实施者的自由度。
**"我没查证"不该变成"你去选" —— 那是把不确定性转嫁给实施,而不是消除它。**

**乙(测试断言渲染器分派表 key 集合等于契约闭集)不再作为实施选项**,
只保留为一种情况的阻断条件:**若实施时发现类型生成能力失效(联合类型没生成出来),
立即停下报出来,不得默默改用乙** —— 因为乙需要渲染器把分派表导出给测试,那是个可被绕过的约定。

**红夹具(两条路都要)**:契约加一个 kind 而不改渲染器 → **门必须红**。

**四·4 · `endpoint:<operationId>` 拿到之后怎么调 —— 今天没有动态调用路径**

✅ **亲验**:生成的 RTK 文件**只导出 `catalogInventoryRtkRequest`**,
**没有 `endpoints` 对象、没有 `.initiate`**;而 catalog 功能区现在用的是 **33 个具名 hook**。
React hooks 不能按字符串动态取。

**所以 `endpoint:getOperationsCatalogDictionary` 这串字今天调不起来。**
前一版判据只管了"operationId 存在",**没管"存在之后怎么用"** —— 实施会卡在这里,
或者绕成一张带业务判断的 if-else 映射表,**而那张表就是第二份真相**。

**约束(不指定机制,指定性质)**:`operationId → 实际调用` 的绑定一定会以某种形式存在。
它**必须是纯机械绑定**(只做 id 到调用的转发,**不含任何业务判断、不含默认回落**),
且**必须有一道集合相等的门**:契约里出现的所有 `endpoint:` operationId
**等于**绑定表登记的集合 —— 多一个少一个都红。

**满足这个性质的写法即可**,不限定是注册表、是走 `catalogInventoryRtkRequest` 底层通道、还是别的。
⚠️ `catalogInventoryRtkRequest` 是否接受 operationId 入参,**我没有验证签名** —— 实施时自行确认。 `未验证`

**四·5 · `fieldRules[shape]` 与 `fields[]` 的 join 只做一次**

契约结构是:`fields[]` 是**全局字段字典**,`fieldRules[shape]` 是**逐形态清单**(见"一之补"约束 1)。
渲染时要把两者 join 出"当前形态该渲染哪些字段、各是什么控件"。

**这个 join 落在 foundation 的渲染器入口一处**,签名形如"给我 shape 与 manifest,还你该渲染的字段序列"。
**不接受**每个抽屉各 join 一次 —— **N 个 join 点 = N 个可以各自跑偏的地方**,
Dexter 说的"shape 与控件契约紧密相关"就是在这里散掉的。

**判据**:⛔ **生产渲染路径只能调用 foundation 的唯一 join API**。
⚠️ **前一版写成「全仓只有一处同时读 `fieldRules` 与 `fields`」,过宽**(第四轮 review N-2)——
**生成器、校验器与测试是合理例外**,它们本来就要读这两块。判据管的是渲染路径,不是全仓。

**五 · 判据怎么断言**

✅ 渲染型断言本仓可用(`renderToStaticMarkup`,两文件已有先例)。断言写法:

| 用例 | 断言 |
|---|---|
| 契约与渲染一致 | 对每个声明了 `controlKind` 的字段,渲染后的 markup **含该 kind 对应的判别特征**(`select` 有 `role="combobox"` 或对应类名;`text` 是 `input[type=text]`)。**具体判别特征在实施时逐 kind 固定下来并写进测试工具,不要每条用例自己发明** |
| 候选来源存在 | 每个 `optionSourceRef` 指向的 enumKind / operationId **确实存在** |
| ~~无遗漏~~ | ⚠️ **已并入下方「字段分母固定」** —— exact-set 逐字枚举 10 个 `fieldKey` 本身就是无遗漏判据,两条并存等于同一件事有两个名字 |
| 渲染器唯一 | 前端不存在第二处按 `controlKind` 分派的代码,且分派**不在 `apps/frontend/*` 内**(四·1) |
| **文案唯一** | `fields[]` 覆盖到的字段,渲染处**无字面量文案**;收口时报告未覆盖字段还剩多少处写死(四·2) |
| **闭集相等** | 渲染器认识的 kind 集合 **等于** 契约闭集 —— 甲由类型系统承担,乙由测试承担(四·3) |
| **候选来源可调** | 契约里的 `endpoint:` operationId 集合 **等于** 绑定表登记集合,且绑定**无默认回落**(四·4) |
| **join 唯一** | **生产渲染路径只能调用 foundation 的唯一 join API**(生成器/校验器/测试是合理例外)(四·5) |
| **投影链贯通** | ⛔ **一次真实 HTTP 的 `GET shape-manifest` 响应里的 `fields`,与生成 manifest 逐字相等**;红夹具是拿掉 owner 投影白名单里的 `fields`(零之二) |
| **slot 集合相等** | App 注入的 slot key 集合 **等于** 闭集里 4 个领域 kind 加需要候选的 kind 集合;少注入一个则红,不得静默渲染空白(四·1) |
| **字段分母固定** | `fields[]` 的 exact-set 测试**逐字枚举"七"表的 10 个 `fieldKey`**(登记分母 10,本轮完成 10,每一行都是可执行 descriptor);每个的 `admittedShapes` 与生成器产出的 `fieldRules` 逐形态精确对应,且凡该 `tabKey` 在 `tabContentRules` 里有 `admittedShapes` 的**逐字取用**(七) |
| **描述符可执行** | ⛔ 每个 `endpoint` 的 `path`/`query`/`header`、`itemsPath`、`valueField`、`labelField`、`disabledWhen` **必须是 wire 类型里真实存在的字段名**;红夹具:删掉分类的 `viewKey`、把分类 `disabledWhen` 改成 `status`、把库存对象 label 指向 `name` —— **三条都必须红**(七) |

**五之补 · 每条判据由哪个 runner 承担,`scripts/verify` 跑不跑得到(2026-08-15 亲验)**

> ⚠️ **判据没有 runner 就是装饰。** 前一版写了八条判据,**没写它们各自挂在哪个门上** ——
> 这与"只写中间层不写两端"是同一个毛病的第三次出现。

✅ **亲验(2026-08-15 B0 实跑订正)**:`scripts/verify` → `tools/verify-gates/verify.mjs`,
共 **37 个门** —— `staticCommands` **9** + `runtimeCommands` **28**。

⚠️ **前一版写「36」是我数错的**:我用 `grep -oE '^\s*\["[a-zA-Z0-9_-]+"'` 数,
**漏掉了唯一那个跨行 tuple**(`backend-archunit`,名字不在 `[` 那一行)。
**而漏掉的这一个,正好就是 B0 实跑时唯一失败的门** —— 见下方 ⛔。

| 判据 | 承担者 | `scripts/verify` 跑得到吗 |
|---|---|---|
| 契约与渲染一致(逐 kind 判别特征) | foundation 渲染测试 | ✅ `THCL-04-foundation-tests` |
| 闭集相等 | 甲=编译期类型错误 / 乙=foundation 测试 | ✅ 甲走 `U08/U09-*-build`,乙走 `THCL-04-foundation-tests` |
| 候选来源可调(`endpoint:` 集合相等) | foundation 测试 | ✅ `THCL-04-foundation-tests` |
| 渲染器唯一(不在 `apps/frontend/*`) | 静态检查 | ⚠️ **扩 `scripts/check/frontend-architecture`**(已在门里,第 16 行) |
| 文案唯一(覆盖字段处无字面量文案) | 静态检查 | ⚠️ **同上** |
| join 唯一 | 静态检查 | ⚠️ **同上** |
| 候选来源存在(`enum` / `endpoint` / `local` 三形式五条判据) | 生成器侧 | ❌ **无门 —— 见下** |
| `admittedShapes` 与 `fieldRules` 逐形态精确对应(七) | 生成器侧 | ❌ **无门 —— 见下** |
| 字段分母恰好 10 个(七) | 生成器侧 | ❌ **无门 —— 见下** |
| **投影链贯通(HTTP `fields` 与生成 manifest 相等)** | ⛔ **需要一次真实 HTTP** | ⚠️ **`THCL-JAVA-catalog` 跑 Java 测试但不碰这条链;若 acceptance 覆盖不到,实施时明说,不得降级成生成物比对** |
| **slot 集合相等** | 静态检查 | ⚠️ **扩 `scripts/check/frontend-architecture`**,并**同批把 catalog slice 纳入其 operation 分母**(见下 S-1) |
| **描述符可执行**(字段名是 wire 类型里真实存在的) | 生成器侧 | ❌ **无门** —— 归 **B6 验收第 4 条**,三条红夹具在那里 |

⚠️ **本表与 §3.8 五 判据表已对齐(2026-08-15 自查)**:前一版两表条目对不上 ——
判据表列了「无遗漏」与「描述符可执行」而本表没有它们的落点。
**「无遗漏」已并入「字段分母固定」**(exact-set 逐字枚举 10 个,本身就是无遗漏判据,
两条并存等于同一件事有两个名字);**「描述符可执行」补在上面一行。**

⛔ **两条判据无门,而且是同一个原因**:

✅ **亲验**:全仓只有 `scripts/check/catalog-inventory-p1` 与 `tools/catalog-inventory-p1|p2/cli.mjs`
碰 manifest 生成物,**三个都不在 verify 的 37 个门里**(verify 里唯一与 catalog 相关的门是
`THCL-JAVA-catalog`,跑的是 catalog 模块的 Java 测试,**不碰生成器**)。

**后果**:§3.8 最关键的那条红夹具 ——「契约加一个 `controlKind` 不改渲染器 → 门必须红」——
**契约那一半今天没有门在守**。改了生成器不重生成、或重生成后与提交的生成物不一致,
**`scripts/verify` 全绿**。

**本轮必须做**:把生成器侧的检查挂进 `scripts/verify`。
⚠️ **挂哪个门是实施决定**(新增一个门,或并进已有的 `U01-codegen` / `openapi-contracts`),
**但"挂进去"不是可选项** —— 否则本节前面所有关于契约侧的判据与红夹具,**全部无人执行**。

⛔ **还有一处门的分母漏了 catalog(2026-08-15 Codex review S-1,已亲验)**

`scripts/check/frontend-architecture` 的 operation 分母只读**三个** generated slice ——
`platform-edge.ts` / `operations-edge.ts` / `public-edge.ts`,
**`catalog-inventory-edge.ts` 不在其中**。

**后果**:本轮新增的 `endpoint` 形式 `optionSourceRef` 所引的 operationId,
**这道门一个都约束不到** —— 而它正是判据表里"渲染器唯一 / 文案唯一 / join 唯一"三条要扩的那个检查器。
**扩它的时候必须同批把 catalog slice、路由注册表与 operation 字面量检查一起纳入分母**,
否则三条判据挂上去了,而第三条(`endpoint:` operationId 集合相等)仍然无人执行。

### ⛔ B0 实跑暴露的两条(2026-08-15,已验)

**一 · 「基线是绿的」是宿主条件性的,必须在交付说明里写出前置条件**

✅ **亲验**:`verify.mjs` 第 21–26 行的 `backend-archunit` tuple 调的是**裸 `gradle`**,不是 wrapper;
而 **`gradlew` 在仓根与后端模块都不存在**。在没有系统 Gradle 的宿主上,该门 spawn 失败:

> `R5_VERIFY=FAIL` / `REASON=R5_VERIFY_STATIC_SPAWN_FAILURE:backend-archunit`(8 个门 PASS,第 9 个失败)

⚠️ **这不推翻任何一次 9/9 PASS** —— 装了 Gradle 的宿主上那个 PASS 是真的。
**它推翻的是"基线是绿的"这句话的无条件性。**
**而 B0 的存在理由正是"让实施者能判断红是不是自己造成的"** ——
没有 Gradle 的人会看到一个不是自己造成的红,**恰好是 B0 要消灭的那种红**。

**最小修正(二选一,都不是生产化基建)**:B0 交付说明写明宿主前置条件;
或仓内 vendor 一个 wrapper 让门自带工具链。**归 HANDOFF.md 欠账也可以,但不得默认它不存在。**

**二 · `scripts/verify` 不产出分层输出,`R5_VERIFY=PASS` 是单个聚合 token**

✅ **亲验**:`verify.mjs` 第 74 行逐个回显各门自己的 stdout,第 122 行只发一个 `R5_VERIFY=PASS`。
**没有静态 / 测试 / Testcontainers / 前端 / L2 / 业务 L3 的分层结构。**

**所以任何"verify 输出区分了六类"的说法都是人为归纳,不是仓内事实。**
⛔ **由此得出一条对所有批次都成立的纪律**:
`R5_VERIFY=PASS` **本身不携带任何业务 L3 语义**,`U11-seed-dry-run` 就是 dry-run。
**报告绿的时候必须同时说明哪一层没覆盖** —— 正因为 verify 不分层,这句限定才不可省。

⚠️ **顺带一条要报给 Dexter 的**:`catalog-inventory-p1` 检查器**存在但不在门里**,
这不只影响 P3-2 —— 它意味着**整个 catalog manifest 的生成物漂移今天都没有门**。
本轮只要求把 P3-2 需要的判据挂上;**"这个检查器为什么一直不在门里"是仓内既有状况,
超出本工单范围,登记不处置。** `DEXTER_DECISION`

**六 · 本轮范围**

**只覆盖 P3-2 实际要改的字段**(五处 picker · SKU 矩阵 · 分类选择器)。
**但 `fields` 块、`controlKind` 闭集、`optionSourceRef` 这三样是机制,一次建好**——
Dexter 已点名菜单与打印会用同一套,**建成 catalog 专用等于将来重建一次**。

**所以这一节同时解决了 §0.1 的困境:控件形态一旦进契约,它就从"只能看"变成"能测"。**

**其中一条必须有**(它正是刚裁定的业务规则,而且是用户会踩的坑):

> **选项值那一层的 `helpText`:「选项不产生独立库存单元;需要独立库存、条码或独立成本的规格,请使用 SKU 商品形态。」**

✅ 依据:`stock_target`(独立库存单元)只挂 `item_ref` / `product_sku_ref`,**没有 `option_value_ref`**;
选项值只能挂 `stock_bom`(扣料)。**所以用做法选项去表达「黑色128G / 黑色256G」,库存必然算错,而系统今天不会拦。**

### 七 · ⛔ 本轮 `fields[]` 的逐字分母(2026-08-15 补,Codex review M-1)

> ⚠️ **前一版只写"五处 picker · SKU 矩阵 · 分类选择器"——那是描述,不是分母。**
> 实施者得自己决定哪些字段算本轮,而「无遗漏」判据**没有固定分母就恒绿**:
> 只登记 `categoryRefs` 加一个 SKU 字段,`fields ↔ fieldRules` 双向集合检查照样通过,
> 其余 picker 继续留着本地控件和写死文案。**这是我一直在别处禁止的"存在性判据",却出现在自己的工单里。**

**下表是本轮 `fields[]` 的唯一分母,共 10 个 `fieldKey`。多一个少一个都要改本表。**

⚠️ **`admittedShapes` 的权威来源已订正(2026-08-15 第二轮 Codex review M-2)。**
前一版这一列是我从 `allowedNodeTypes` 与 `inventoryBom` **推导**的,**而仓里本来就有权威**:
✅ **亲验**:生成器的 `tabContentRules` 里**已经有 `admittedShapes` 键** ——
`order-options` 明写 `["STANDARD_SALE_COUNTED", "STANDARD_SALE_WEIGHED"]`,
`composite-content` 明写 `["COMPOSITE"]`。
**有现成权威还去推导,推出来的结果就与它冲突** —— 这正是下面 ⛔ 那一行的成因。

⛔ **第三轮订正(2026-08-15 Codex review M-1):下表的字段名全部改为从生成的 wire 类型逐字取来。**
前两版写的是"label=名称 · `disabledWhen`=`status` · `itemsPath`=库存对象数组"这类**自然语言占位**,
而亲验发现**其中至少三处指向根本不存在的字段** —— 分类树条目没有 `status`,
库存对象列表项既没有 `name` 也没有 `status`。**占位符通不过 operationId 集合门以外的任何东西,
但它会让实施者写出读空字段的 resolver。**

| # | `fieldKey` | 数据路径 | `controlKind` | `tabKey` | `admittedShapes`(来源) | 候选描述符(✅ 字段名取自生成 wire 类型) |
|---|---|---|---|---|---|---|
| 1 | `categoryRefs` | `categoryRefs[]` | `treeSelect` | `basic` | 全 7 | `endpoint` `getOperationsCatalogNavigation` · query `viewKey:"ALL"`(**必填,类型里无 `?`**)+ `dataNodeRef`(**上下文 scope**)· `itemsPath`=`data.tree` · value=`categoryRef` · label=`name` · **parent=`parentCategoryRef`**(树形必需)· `disabledWhen`=**`null`**(⚠️ 树条目**没有 `status`**) |
| 2 | `skuVariantAttribute` | `skuVariantDimensions[].attributeRef` | `select` | `sku-specifications-pricing` | 仅 `SKU_VARIANT_SALE_COUNTED` | `endpoint` `getOperationsCatalogDictionary` · ⛔ **path** `dictionaryKind="SKU_ATTRIBUTE"`(**不是 query** —— 路径是 `/dictionaries/{dictionaryKind}`)· query `dataNodeRef` · `itemsPath`=`data.entries` · value=`entryRef` · label=`name` · `disabledWhen`=`status<>"ENABLED"` |
| 3 | `skuVariantValues` | `skuVariantDimensions[].values[].valueRef` | `multiSelect` | `sku-specifications-pricing` | 同上 | 同第 2 行,**path** `dictionaryKind="SKU_ATTRIBUTE_VALUE"` + **上下文参数绑定 `fieldKey=skuVariantAttribute`** · ⚠️ **依赖 2-6** |
| 4 | `skuMatrix` | `skus[]` | `skuVariantMatrix` | `sku-specifications-pricing` | 同上 | 无(整块领域控件) |
| 5 | `bomTarget` | `inventoryBom[].targetRef` | `select` | `inventory-bom` | 4 个:`STANDARD_SALE_COUNTED` · `SKU_VARIANT_SALE_COUNTED` · `STANDARD_SALE_WEIGHED` · `MATERIAL` | `endpoint` `getOperationsInventoryTargets` · `itemsPath`=`data.items` · value=`targetRef` · ⛔ **label 用 `labelParts[]`,不是 `labelField`** —— 列表项只有 `productName` / `skuName` / `productCode` / `skuCode`,**任取一个都会让同商品的不同 SKU 产生相同标签** · `disabledWhen`=**`null`**(⚠️ **没有 `status`**;`stockState` 不是启用语义,不得拿它当禁用判据) |
| 6 | `bomOptionValue` | `inventoryBom[].optionValueRef` | `select` | `inventory-bom` | ⛔ **仅 2 个**:`STANDARD_SALE_COUNTED` · `STANDARD_SALE_WEIGHED`(取自 `tabContentRules["order-options"].admittedShapes`) | `local` · `sectionPath`=`orderOptions` · `valueField`=`attributeValueRef` · `labelField`=`name`(均取自 `CatalogItemDetail.item.orderOptions[].values[]` wire 类型) |
| 7 | `compositeComponentSku` | `compositeGroups[].components[].productSkuRef` | `select` | `composite-content` | 仅 `COMPOSITE`(取自 `tabContentRules["composite-content"].admittedShapes`) | `endpoint` `getOperationsCatalogItem` · path 绑定**已选组件商品的 `itemCode`**(上下文) · `itemsPath`=`data.item.skus` · `valueField`=`productSkuRef` · `labelParts`=`[skuCode,skuName]`(均取自商品详情 wire 类型) |
| 8 | `productionTagRefs` | `productionTagRefs[]` | `multiSelect` | `production-prompts` | 3 个:`STANDARD_SALE_COUNTED` · `SKU_VARIANT_SALE_COUNTED` · `STANDARD_SALE_WEIGHED`(取自 `tabRulesByShape`) | `endpoint` `getOperationsProductionTags` · query `dataNodeRef` · `itemsPath`=`data.entries` · value=**`tagRef`** · label=`name` · `disabledWhen`=`status<>"ENABLED"` · ⛔ **另见下方"第 8 行是活 bug"** |
| 9 | `tagRefs` | `tagRefs[]` | `multiSelect` | `basic` | 全 7 | `endpoint` `getOperationsCatalogDictionary` · **path** `dictionaryKind="TAG"` · query `dataNodeRef` · `itemsPath`=`data.entries` · `valueField`=`entryRef` · `labelField`=`name` · `disabledWhen`=`status<>"ENABLED"` |
| 10 | `salesUnitRefs` | `salesUnitRefs[]` | `multiSelect` | `basic` | 全 7 | `endpoint` `getOperationsCatalogDictionary` · **path** `dictionaryKind="SALES_UNIT"` · query `dataNodeRef` · 其余同第 2 行 |

✅ **第 6、7、9 行已逐字取自当前 wire 类型与真实 owner 端点** —— 实施不得把 `attributeValueRef`、`productSkuRef`、`entryRef` 替换成业务编码，也不得把 `TAG` 改成不存在的 `CATALOG_TAG` 请求 kind。

⛔ **第 8 行不是描述符问题,是一条活 bug(第三轮 Codex review M-3,已亲验)**

`CatalogItemDrawer.tsx` 里这条链今天是断的:

| 行 | 现状 |
|---|---|
| 第 120 行 | 候选映射成 `{code, name, owner}` —— **`tagRef` 被直接丢掉** |
| 第 179 行 | `setSelectedProductionTagRefs(detail.item.productionTagRefs)` —— 详情给的是 **UUID** |
| 第 406 行 | 快速创建后 `[...current, candidate.code]` —— **往同一个数组里塞 `code`** |
| 第 273 行 | 保存时 `selectedProductionTagRefs.map(ref => wireUuid(ref))` —— **对混型数组统一做 UUID 转换** |
| 第 619 行 | `tagMap` 以 `tag.code` 为键 —— 而选中值是 UUID,**回显对不上** |

**用户可见后果**:选中的标签显示不出来;**快速创建一个标签之后保存,`wireUuid` 拿到的是 `code`。**

⛔ **而且这不是纯前端能修完的 —— 契约给不了 ref(我在核这条时发现的,Codex 未提)**

✅ **亲验**:快速创建的回读类型 `ProductionTagReadback.result` 只有
`code` · `tagKind` · `name` · `status` · `version` —— **没有 `tagRef`**。
**所以第 406 行塞 `code` 不是前端偷懒,是它拿不到 ref。**

⛔ **固定采用甲,并归入第一步 B1(第四轮 Codex review M-4)。**
**甲**:`ProductionTagReadback` 补 `tagRef` —— 契约改动,走七环链。

⚠️ **前一版写成「实施挑一条」,这直接违反我自己定的冻结纪律** ——
甲是契约改动,若留到第二步选,就成了「第二步反向改契约」。
**而且创建一个资源的回读本来就该带上它的身份**,这不是为了迁就前端。
**乙(快速创建后重取列表按 `code` 查回 `tagRef`)不再是选项** ——
它多一次往返,只为绕开一个本该修的契约缺口。

**红夹具**:快速创建一个标签 → 它处于选中态 → 保存请求里该项是 **UUID** → 重开详情仍显示该标签名。
**今天这条会红。**

⚠️ **第 10 行是本轮补的(第二轮 Codex review M-1)。** 前一版九行漏了 `salesUnitRefs`,
而工单自己把「标签与**销售单位**」列进 F6、把 `salesUnitRefs` 列为活缺口 ——
**分母与批次自相矛盾**:9/9 全绿、文案清干净、形态门全过,**销售单位仍然没有控件也没有候选来源**。

### ✅ Dexter 裁定(2026-08-15):**SKU 形态不可以有选项**

**原矛盾**:`SKU_VARIANT_SALE_COUNTED` 的 `allowedNodeTypes` 含 `OPTION_GROUP` 与 `OPTION_VALUE`,
而它的 `tabRules` 没有 `order-options` 页签,`tabContentRules` 也把该页签限定为另外两个形态。

**裁定**:`allowedNodeTypes` 那两项对 SKU 形态是错的。**SKU 形态不承载点单选项。**
所以字段表第 6 行的 2 个形态是正确的,不是保守选择。

⛔ **但这条裁定今天落不下去 —— 被裁定的那个东西没有任何执行点(已亲验)**

| 查什么 | 结果 |
|---|---|
| 后端 Java 里 `allowedNodeTypes` | **零命中** |
| 前端 TS/TSX 里 `allowedNodeTypes` | **零命中** |
| `modeRules`(承载它的那块)在 owner 里 | 只在第 1368 行**被原样投影出去**,是外发的八个键之一,**无人据此校验** |
| BOM 保存时的 `nodeType` | `bomEntry` 第 2672 行 **原样回显客户端传来的值**,缺省填 `STOCK_TARGET`,**不校验** |

**所以 `allowedNodeTypes` 是一句"声称",不是"行为"。**
把 `OPTION_GROUP` / `OPTION_VALUE` 从 SKU 那行删掉,**运行时什么都不会变** ——
今天客户端照样可以给一个 SKU 商品(甚至 SERVICE 商品)提交 `nodeType: "OPTION_VALUE"` 的 BOM 条目,
以及提交一整块 `orderOptions`,**服务端全盘接受**。页签不可见只是 UI 不发,**不是拦。**

**所以本裁定要落成两件事,少一件就还是一句注释**:

1. **改声明**:生成器里 SKU 形态的 `allowedNodeTypes` 删掉 `OPTION_GROUP` 与 `OPTION_VALUE`
2. ⛔ **建执行点**(这才是主体):保存时校验两条 ——
   ① 凡该形态在 `tabContentRules["order-options"].admittedShapes` 之外,
   提交的 `orderOptions` **必须为空**,否则 typed problem
   ② ⛔ **BOM 条目的节点判定落在 refs 上,不是 `nodeType` 字符串** —— 见下

### ⛔ 订正:节点判定的载体是 refs,不是 `nodeType`(2026-08-15,Codex B4 提请裁决后重写)

> **前一版第 2 条写的是「BOM 条目的 `nodeType` 必须在该形态的 `allowedNodeTypes` 内」。**
> **这条是错的,照它实施挡不住任何东西,而且会拒掉今天的正常请求。**
> Codex 在 B4 停下并指出「两套词汇没有 canonical mapping」——**停得对,但根子不是缺映射,
> 而是被校验的那个字段根本不承载权威。**

✅ **亲验四处,`nodeType` 是一个客户端提交、被回显、无人消费的字符串**:

| 落点 | 事实 |
|---|---|
| `CatalogInventoryCoordinator` | ⛔ **全文 `nodeType` 命中数 = 0** —— 它用 `itemRef │ productSkuRef │ optionValueRef` 三个 ref 建 inventory 命令(约第 342–345 行)。**`nodeType` 从未到达 inventory** |
| `CatalogOwnerService.bomEntry` | 只做 `entry.path("nodeType").asText("STOCK_TARGET")` —— **原样回显** |
| `InventoryOwnerService` 约第 1136–1138 行 | `productSkuRef != null → SKU_BOM`;`optionValueRef != null → OPTION_VALUE_BOM`;否则 `ITEM_BOM` —— ⛔ **inventory 自己从 ref 派生,不接受输入** |
| `CatalogItemDrawer` 约第 827 行 | `lineSign：{entry.lineSign ?? entry.nodeType}` —— **前端只拿它当显示兜底** |

⛔ **而且 `nodeType` 与 `optionValueCode` 由构造决定会打架**:
✅ 前端约第 822、823 行只写两个值(`ITEM` / `ITEM_BOM`),
而 `optionValueCode` 是约第 830 行**一个独立的输入框** ——
**用户在一条 `ITEM_BOM` 上填选项值,`nodeType` 仍然是 `ITEM_BOM`。前端从不写 `OPTION_VALUE_BOM`。**

**所以按 `nodeType` 判会同时犯两个错**:
一条真正挂在选项值上的 BOM 被判为合法(`ITEM_BOM` 映射到 `CATALOG_ITEM`,而它在 SKU 形态的允许集里);
而这恰恰是 UI 今天产出的正常 payload —— **要挡的没挡住,不该拒的会拒。**

#### 正确判据:两个维度都判,与 inventory 的派生规则逐字同构

| 条目实际带的 | 判定节点 | 要求 |
|---|---|---|
| ⛔ **同时有 `skuCode` 与 `optionValueCode`** | **歧义,不判定** | **直接 `VALIDATION_ERROR`** —— 不得静默择一 |
| 有 `optionValueCode`(无 `skuCode`) | `OPTION_VALUE` | `OPTION_VALUE ∈ allowedNodeTypes` |
| 有 `skuCode`、无 `optionValueCode` | `SKU` | `SKU ∈ allowedNodeTypes` |
| 两者都无 | `CATALOG_ITEM` | `CATALOG_ITEM ∈ allowedNodeTypes` |
| **任意 BOM 条目** | —— | ⛔ **该形态 `inventoryBom` 必须为 `true`**(**独立维度,必须单独判**) |

✅ **第一行是实现给出的,不是我写的(2026-08-15 补)** —— `validateShapeOwnedSections` 对
"`skuCode` 与 `optionValueCode` 同时非空"直接拒绝。
**我原来的写法只有优先级(有 `optionValueCode` 就判 `OPTION_VALUE`),会静默接受歧义输入。**
**实现比规格严,规格照实现改** —— 这一条也进 B6 收口条件第 5 条的 ③。

⛔ **不得建 wire 值到领域值的 canonical mapping 表。**
建表等于在 catalog 里为 inventory 的概念**造第三处陈述**,
而 `InventoryOwnerService` 已有唯一的派生规则 —— **判据与它同构即可,全仓保持一处规则。**
⚠️ **而且映射表会丢掉第二个维度**:`ITEM_BOM → CATALOG_ITEM`,
而 `SERVICE` 的 `allowedNodeTypes` 恰好是 `["CATALOG_ITEM"]` 且 `inventoryBom: false` ——
**给一个服务商品提交 BOM,映射表会放行。**

#### 连带裁定三项

- **`nodeType` 与 refs 冲突时:refs 胜,`nodeType` 完全不参与判定。**
  **必须这样**,否则今天 UI 支持的正常操作会被拒
- **`STOCK_TARGET`**:它只是 `bomEntry` 里一个无人消费字段的缺省值,inventory 从不产出它。
  **不进任何词汇表,B4 不校验它** —— B4 不碰 `nodeType`,这个问题自动消失
- **`OPTION_GROUP`**:前端零写入、inventory 零派生,**在 `allowedNodeTypes` 里是死值** ——
  与本节要删的那个 `OPTION_VALUE` 同类,**同批从 SKU 形态删掉**

**红夹具三条**(第三条最要紧):
① 给 `SKU_VARIANT_SALE_COUNTED` 提交非空 `orderOptions` → **必须被拒**
② 给它提交带 `optionValueCode` 的 BOM 条目 → **必须被拒**
③ ⛔ 提交一条 **`nodeType` 写着 `ITEM_BOM`、同时带 `optionValueCode`** 的条目 → **仍必须被拒**
   —— **若实现是按 `nodeType` 判的,这条会绿,当场暴露。**

**今天①②③都会通过。**

### ⚠️ 登记不处置:`nodeType` 本身就是一处双真相

它是客户端可随意填、被回显、无人消费的字段,**与 refs 各说各话**。
清理它(删掉,或改为服务端按 ref 派生后回填)**不属于 B4**,请勿顺手做 ——
它会动到契约与前端显示兜底,是独立范围。 `DEXTER_DECISION`

⚠️ **范围诚实**:上面第 2 条是**新增的后端校验**,不在原 P3-2 的"前端与 IA 对账"范围内。
**它是这条产品裁定的必要成本** —— 不建执行点,裁定就只是把一句错的声称换成一句对的声称。
**归 B4① —— 改声明与建执行点同批,与 B4② 引用守卫同期做,整体在第一步内完成。**

⚠️ **一个我没查的口子**:存量数据里如果已经有 SKU 形态的商品挂了选项值 BOM,
新校验只在保存时生效,**存量行不会被重新校验**。是否需要一次性排查,留给实施判断后回报。 `UNVERIFIED`

**`admittedShapes` 的门(S-2 的修复)**:上表每个 `fieldKey` 的 `admittedShapes`
必须与生成器产出的 `fieldRules` **逐形态精确对应**,且**凡该 `tabKey` 在 `tabContentRules`
里有 `admittedShapes` 的,必须逐字取用它,不得另行推导**。
**红夹具两条**:把第 4 行发给全部七个形态 → 门必须红;把第 6 行改成 3 个形态
(即与 `tabContentRules` 不一致)→ **门必须红**。

**范围边界**:上表**只是本轮**的分母。`fields` 块、16 个 `controlKind` 的闭集、
`optionSourceRef` 三种形式 —— **这三样机制一次建好**(见"六"),
但**字段只登记上表这 10 个**,其余字段本轮不进 `fields[]`,其写死文案按四·2 留在原地并在收口时报数。

⛔ **登记 10 项,本轮完成也必须是 10 项 —— 两个数分开报,不许混用**

前一版这里写"9 个"而上表已是 10 行,**同一份文里两套口径** ——
这正是我在别处反复抓的"分母不唯一"。订正为:

- **登记分母 = 10** —— `fields[]` 的 exact-set 测试**逐字枚举这 10 个 `fieldKey`**,多一个少一个都红
- **本轮完成分母 = 10** —— 第 9 行复用现有 `TAG` 字典读取端点,不等待另建接口；若 2-1
  后端投影仍未落地,这是字段值没有候选数据的实现缺陷,不能通过删掉第 9 行降低分母

⚠️ **第 9 行必须保持为已登记且可执行的 descriptor** —— `TAG` 是现有字典 kind,
省略会让 exact-set 门的分母变成 9,并掩盖商品标签候选没有接通的问题。

### 3.9 从 v4 商品域挪过来的另两条(盘点式对比所得)

> 📗 前一轮盘点让 v4 自己的结构当分母,商品域挑出三条可比对象。`controlKind` 那条已并入 §3.8,另两条在此。

**一 · seed 数据要有仓外锚点** ✅ 📗 v4 在 fixture 目录里放了一份 `research-notes.md`,
开头一句「本数据包不是随机造数」,然后列真实餐厅的菜单结构、POS 的组织习惯,再列五条落地原则
(为什么有午餐/晚餐两套菜单、为什么同一商品在不同销售区生成不同售卖项)。

**v2s 无对应物** —— fixture 的 `sourceBindings` 只引仓内四条路径。

**后果是自证循环**:评审「seed 里为什么要这样组织」时,v4 能翻到一句仓外依据,
**v2s 只能翻到自己写的需求文档**。而本仓的评审纪律要求「问题对不对」先于「闭环对不对」——
**判断"问题对不对"需要仓外锚点,而现在所有产品依据都是内生的**,早期的任何一次误解都会被后续文档逐层固化且无处发现。

**处置**:成本是一个 markdown 文件。**归 §6.5.2 seed 那批一起做**,不单开批次。

**二 · 复制场景要按组合枚举,不要按数量** 📗 v4 的 fixture 验收里有 `copyScenarios[]` ——
列的是「源商品 × 复制范围组合 → 期望」,**自带反例**。

⚠️ **但同一个文件里的另一半明确不要学**:`catalogItemCount: 50` / `skuCount: 10` 这类**数量下限门**。
**造 50 个同名空壳商品即可通过,证伪不了任何业务错误** —— 这正是本仓已裁定退役的"存在性判据"。
📗 v4 甚至还有更赤裸的一条:「schemas 覆盖度当前 N 个,至少需要 80 个」。

**⚠️ 反向自查**:v2s 的 `catalog-inventory-fixture-catalog.json#/denominators` 是同形态的数量门 ——
**按本仓自己的标准应当一并复核**,不要因为它是我们自己的就放过。

### 3.5 减法三项

| 项 | 形态 |
|---|---|
| **治理** | ⚠️ **不是"减法",是现行故障。** ✅ **后端已删净**:`itemSummary` / `itemDetail` 内 `governanceStatus` 命中 **0**,owner 主动 `removeRetiredGovernanceFacts`,生成契约里该字段 **0** 命中,`validateItemPageQuery` 的白名单**不含 `governanceStatus`**。<br>**而前端还在读写它**:解码器仍解 `governanceStatus`、列表仍渲染治理列、筛选 Select 仍写死 `['READY','NEEDS_ATTENTION','BLOCKED']` 并把参数塞进查询。<br>**所以现在:治理列恒为空,用户一选治理筛选就命中 422。** F1 该标"**回归修复**"而不是"减法",否则会被按低优先级排。<br>前端删筛选下拉、列表治理列、`smartLabels` 对应项。<br>⚠️ **「治理与引用」页签(`IA-CAT-TAB-008`)两份工单都没人认领** —— `tabRules` 里 `\"governance\"` **31 处**。**该页签是保留改名、只删治理行、还是整页删除并把引用关系迁走,需 Dexter 裁定** |
| **`ordering`** | ⚠️ **不是纯前端。** 页签由 manifest `tabRules` 声明(`\"ordering\"` **18 处**),只删前端映射会渲染出标题叫 `ordering` 的空页签。<br>三件事缺一不可:manifest 与 owner 投影同步删 · **标准价按 IA §6.3 迁入基础资料** · 提交门跟着改。<br>✅ **挂牌价不迁,按裁定归销售集合域** —— 商品域删除它 |
| **`riskFlags`** | 删列表风险 Tag。✅ 唯一写入点是空数组,**删掉不损失任何行为** |

### 3.6 分类选择器(**零后端,但已从 F2 移到 F5**)

⚠️ **它是零后端,却不能最先做** —— `categoryRefs` 是字段表第 1 行,
先用写死控件接一遍再改成 descriptor 驱动就是双真相。**代价见 §5 F5 那条说明。**

**现在** ✅ 写入链路端到端已通(前端发、owner 写、`lockAndValidateCategoryRefs` 校验加锁、契约必填)。
**缺的只是控件**——基础资料编辑态只有名称、短名、图片。

**用户遭遇**:新建的商品**进不了左树任何分类节点**——不是后端不收,是界面没地方选。

**候选源现成**:`getOperationsCatalogNavigation` 已返回带计数的分类树;`CompositeCandidatePicker` 里有可复用的 Tree。

> ⚠️ **只做编辑态,不做创建抽屉。** ✅ `CatalogItemCreateRequest` 是 `additionalProperties: false`,**只有五个字段**,
> 不含 `categoryRefs`。要让创建时就能选分类,需要**改契约 + 改 owner**——那不是零后端。
> **本轮:创建后进详情补分类。** 若要"新建时必须能选分类",登记为 P3-1 契约批次的增项。

### 3.7 其余逐 IA-ID 条目

✅ 89 条逐条结论见 `2026-08-15-v2s-ia-89-conformance-evidence-claude.md`(629 行,六个面)。
**实施前必须逐条过,不得抽样。** 已知的其余 M 级:

分类树**无启停**(前端无入口、后端无状态迁移端点)· 结果域标签写死"当前分类"而非"当前结果域" ·
**冲突筛选既不禁用也不解释** · `lineSign` 用 `nodeType` 冒充(**契约里 `lineSign` 出现 0 次**)·
**复制范围八个裸标签缺逐项说明**(📗 v4 有九条逐范围说明,但 v2s 当前实际登记为八项;**复制是覆盖性写操作,勾选项含义不明是直接的误操作风险**)·
✅ **「全部商品」被挂进「商品分类」分组下**(导航语义错位,**且不在 89 条里** —— 说明 IA 分母覆盖不全)。

---

## 4 · 批量动作(**重新设计,原方案作废**)

> ⚠️ **"照 v4 = 前端 allSettled 循环 = 零个新后端命令"两个部分都不成立。**
> ✅ **v4 是两种形态混用**:改分类/改标签走循环单条(`loadDetail` + `updateBasics`,**2N 请求**);
> **改状态走专用批量命令** —— `batchChangeCatalogItemStatus({ items: selectedRows.map(...) })`,**一个请求带整个数组**。
> ⚠️ **前一版对 v2s 保存语义的描述是错的,订正如下。**
> ✅ SQL 层确实是 `UPDATE ... SET attributes=?, sections=?` 整列替换,**但 Java 侧不是从空对象起手**:
> `saveItem` 第 1382 行 `ObjectNode sections = json(current.sectionsJson()).deepCopy()` ——
> **从现有 sections 起手,再用 draft 里出现的键逐个覆盖**。
> **所以省略的可选块会被保留,不会丢。** 我写的"漏带任何一块那一块就没了"**不成立**。
>
> **⚠️ 「省略可选块会不会丢」已闭合:不会丢。但我原来给的理由是错的,真实机制在下面。**
>
> ✅ **`saveItem` 落库前把九块全剥掉** —— `persistedSections.remove("skus"/"categoryRefs"/"compositeGroups"/
> "orderOptions"/"skuVariantDimensions"/"images"/"productionTagRefs"/"tagRefs"/"salesUnitRefs")`,
> **`catalog_item.sections` 里根本不留这九块**。所以"从现有 sections 起手"这个理由**推不出结论**——
> 裸的持久化 JSON 里那九块是空的,省略就该清空。
>
> ✅ **真正让它成立的是回灌链**:`requireItem → loadItems → hydrateItemFacts` ——
> 写入前读到的 `current` 已经把这九块**从关系表回灌进 `sections`**;
> 而九个 `nextXxx` **全部读 merge 后的 `sections`,没有一个读 `draft`**。
>
> **所以这是一条必须写下来的不变量:合并基底依赖 `hydrateItemFacts` 的回灌。**
> **这条一旦被后续改动破坏,"省略即保留"会静默失效,而理由在文档里看不出来。**
>
> ✅ **旁证**:抽屉现有保存本来就按页签可见性省略若干块,而且**从不发送 `tagRefs`/`salesUnitRefs`** ——
> 要不是回灌链在,今天每次保存都会清空这些关系。
>
> ⚠️ **`3N` 这个数我没有实测依据,标 `未验证`** —— 不要照它排期。

**分档设计**

| 动作 | 形态 | 理由 |
|---|---|---|
| **改状态 / 归档** | **新增专用批量命令**,一个请求带 ref 数组,**逐条回 failureCode** | 状态迁移不涉及整对象,天然适合批量;📗 v4 就是这么做的 |
| **改分类** | 循环单条:**先读详情 → 带回六个必填块 → 只改 `categoryRefs` → 保存**(其余可选块可省略,省略即保留) | ⚠️ **前一版两句话都错了。**<br>"走只改分类的路径" —— 没有这条路径,商品字段写入只有 `saveOperationsCatalogItem` 一个(PATCH)。<br>但"必须整对象保存"**也不成立** —— ✅ 契约里 `catalogDraft.required` **只有六项**(`name` / `shapeKey` / `attributes` / `images` / `productionTagRefs` / `categoryRefs`),其余 11 项全可选,**而省略即保留**。<br>**真实约束是**:六个必填里的 `attributes` 与**完整 `images` 列表**不在列表投影里(列表只给 `primaryImageAssetRef`)—— **这才是必须先读详情的原因** |
| **改标签** | 同上,**且依赖 2-1** | `tagRefs` owner 不产出,现在做不了 |

**不变量**

1. **部分失败不影响其他条**
2. **结果逐条回报**,失败的要能看出**是哪一条、为什么** —— 不接受"N 成功 M 失败"
3. **任何批量动作不得清空用户没有触碰的字段** —— 这是最硬的一条
4. 现有单条权限与校验原样生效

**怎么确认**:50 条里 3 条失败时,**另外 47 条确实生效**、失败三条**逐条可见原因**、
且**所有 50 条的图片与描述属性都没变**。第三条是防覆盖的唯一守门。

**规模限定**:列表分页,一次选中被页大小限住。**跨页全选是新范围,不在本轮。**

---

## 5 · 批次 —— **两步走(Dexter 2026-08-15 裁定)**

> **第一步做完所有契约与后端功能,并用用例验收;第二步基于冻结的契约与后端做全部前端。**

**为什么这么切比原来的十二批好**:原来的依赖网是横向的 ——
批次 4 同时压着 5、6、7b,而它自己又混着契约、生成器、后端投影、前端渲染器和门,
**一批做完才能验证 = 验证点全堆在最后**。
两步切法把它变成纵向:**第一步有真实 HTTP 可验,第二步有冻结的契约可依。**

⛔ **这条纪律是两步切法唯一的价值来源,少了它就白切**:

> **第一步收口后契约冻结。第二步不得反向要求改契约。**
> 若第二步确实发现契约不够用,**回第一步走一轮完整流程(改 → 七环链 → 重验收),
> 不得就地改契约或在前端绕过去。**

### ⛔ 两步切法对"新增"成立,对"删除"不成立(第四轮 Codex review M-1)

**这是切分线的通则,不是某一批的补丁**:

| 契约动作 | 能不能两步分开 |
|---|---|
| **新增**字段 | ✅ 可以 —— 第一步加,第二步用。中间态是"契约多了个没人用的字段",构建照样绿 |
| **删除**字段 | ⛔ **不可以** —— 第一步删,第二步才删消费者,**两步之间构建必红** |

✅ **亲验**:`CatalogItemDrawer.tsx` 第 31 行 `type OrderingDraft = CatalogDetail['item']['ordering']`、
第 267 行 `const catalogDraft: CatalogItemSaveRequest['sections']['catalogDraft']` ——
**前端类型是从生成契约推导出来的**,并且第 169 行 `setOrderingDraft(cloneOrdering(detail.item.ordering))`
在读、保存路径在写。**B2 把 `ordering` 从契约删掉而消费者留到 F2,中间那段时间 TypeScript 编译不过。**

**所以规则改为**:

1. **凡第一步涉及"从契约删字段",其消费者的删除必须并入第一步同一批**,
   只带**最窄的那一刀**(改到能编译过为止),**其余前端形态修正仍归第二步**
2. **B6 验收必须包含两个 App 的类型构建**(`U08-platform-ui-build` / `U09-operations-ui-build`)——
   **红夹具**:删 wire 的 `ordering` 而保留保存路径的赋值 → **构建必须红**

**受这条规则影响的,不只 `ordering`**:
- **B2** 的 `ordering` 与 `listedSalePrice` —— 消费者切面并入 B2
- ⚠️ **`riskFlags`** —— 前一版把"删到哪一层"留作待定。**按本规则:若决定连 owner 的空数组写入一起删,
  则前端 Tag 的删除必须同批进第一步;若只删前端 Tag,则它是纯前端,留 F1。**
  **不许"契约删在第一步、Tag 删在 F1"** —— 那正是本条禁止的形态
- ✅ **`governanceStatus` 不受影响** —— 契约与 owner 均已零命中(见 §6.5.1 `C-g`),
  前端删除是纯前端动作,留 F1 正确

⚠️ **我自己刚吃过这个亏**:P3-2 的多处内容是"P3-1 完成到某一时刻"的快照,
`C-a` / `C-b` 两条被写成契约前置而 Codex 在途已加上,**契约批次与 picker 批次白等了一轮依赖**。
**给移动的契约写前端规格,写多少废多少。**

---

### 第一步 · 契约与后端(七批 + 验收)

| 批次 | 内容 | 依赖 |
|---|---|---|
| **B0 · 基线** | ⚠️ **确认测试基线是绿的**;红的先登记再动手(见 §6.5.3 一)· ⛔ **交付说明必须写明宿主前置条件与未覆盖层**,见下 | 无 |
| **B1 · 阻断项后端半 + 契约变更集** | ⛔ **2-1 / 2-2 / 2-3 / 2-5 的后端半**(⚠️ **不含 2-6** —— 前一版误写成「2-1 ~ 2-6」,而 §2 第 125 行与矫正批次 C1-2 都把 2-6 归 P3-1 建模,**不在 P3-2**。这处误写让 2-6 看起来已排期,F5b 撞上时才发现)· §6.5.1 的 `C-c` ~ `C-i` 逐条 · ⛔ **`ProductionTagReadback` 补 `tagRef`**(第四轮 review M-4:创建资源的回读该带身份;留到第二步选就成了反向改契约) | 无。⚠️ `C-a`/`C-b` 已撤回(Codex 在途已加),**开工前按 §0.4 重校一次现状** |
| **B2 · `ordering` 删除(含最窄消费者切面)** | manifest `tabRules` · 生成器 `tabRulesByShape` · 校验器 `expectedTabs` 与红夹具 · owner 投影 · 标准价迁基础资料 · 挂牌价 `listedSalePrice` 契约多处 · ⛔ **前端 `ordering` / `listedSalePrice` 的读写消费者与标准价迁移的最小切面** | ⚠️ **不止 manifest**,见 §6.5.1 `C-h`。<br>⛔ **消费者切面必须同批**(第四轮 review M-1):前端类型由生成契约推导,删契约而留消费者则**两步之间构建必红**。**只带最窄的一刀(改到能编译过),其余页签形态修正仍归 F2** |
| **B3 · `fields[]` 机制(本步主体)** | ① `fields` 块 + 16 个 `controlKind` 闭集 + `optionSourceRef` 三形式 · ② `helpText`/`description`/`frontendBehavior` 三类文案进契约 · ③ ⛔ `fieldRules` 真正逐形态产出 · ④ ⛔ **七环投影链作为同一原子修改** | 落点是 `scripts/generate/catalog-inventory-p1.mjs` 与七环链上各文件,**不是 `do not edit` 的生成物**(§3.8 零 / 零之二)。**字段分母是"七"表的 10 个**(登记 10 / 本步完成 10,每行都必须有可执行 descriptor) |
| **B4 · 新增后端校验** | ① **SKU 形态不可有点单选项的执行点**(Dexter 裁定)· ⛔ **判据落在 refs 上,不是 `nodeType` 字符串;不得建 wire→领域的映射表** —— 见 §「节点判定的载体是 refs」· ② 删轴/删值的 `REFERENCE_BLOCKS_VOID` · ③ 批量"改状态/归档"的新 operation,**`failureCode` 取值 ⊆ 契约 typed problem codes** | ③ 要同批动契约、生成物、边界声明与路由登记等多处分母。**红夹具**:回一个未登记的 `failureCode` → 门必须红 |
| **B5a · catalog operation 分母** | `frontend-architecture` 的 operation 分母纳入 catalog slice、路由注册表与 operation 字面量 | ⛔ **排在 B1 之后、B2 之前**(第四轮 review S-1)—— B2 要动前端消费者,**分母不先扩,那一刀就没有门守着** |
| **B5b · 生成器侧挂门** | 生成器侧检查挂进 `scripts/verify`(今天不在 37 个门里,契约侧判据全部无人执行) | **B3 之后** —— 它守的是 `fields[]` 机制,机制没落地无从守起 |
| **B6 · ⛔ 验收** | **见下"第一步的收口条件"**,⛔ **含两个 App 的类型构建** | B0~B5b 全部 |

### ⛔ 第一步的收口条件(达不到就不进第二步)

**必须由真实 HTTP 承担,不接受生成物比对充数**:

1. **投影链贯通** —— 一次真实 `GET shape-manifest` 响应里的 `fields`,与生成 manifest **逐字相等**。
   **红夹具**:拿掉 owner 投影白名单里的 `fields`,生成器与契约都不动 → **必须红**
2. **字段分母** —— exact-set 断言**逐字枚举 10 个 `fieldKey`**,多一个少一个都红
3. **逐形态差异** —— 每个 `fieldKey` 的 `admittedShapes` 与产出的 `fieldRules` 精确对应;
   **红夹具**:把 `skuMatrix` 发给全部七个形态、把 `bomOptionValue` 改成 3 个形态 → **都必须红**
4. **描述符可执行** —— 每个 `endpoint` 的 `path`/`query`/`header`、`itemsPath`、`valueField`、
   `labelField`、`disabledWhen` **是 wire 类型里真实存在的字段名**;
   **红夹具**:删分类的 `viewKey`、把分类 `disabledWhen` 改成 `status`、把库存对象 label 指向 `name` → **三条都必须红**
5. ⛔ **SKU 无选项已可执行 —— 判据落在 refs,`nodeType` 不参与**(2026-08-15 订正,见下)
   - ① 给 `SKU_VARIANT_SALE_COUNTED` 提交**非空 `orderOptions`** → typed validation failure
   - ② 任意 BOM 条目**带非空 `optionValueCode`** → typed validation failure,
     ⛔ **不论 `nodeType` 写成什么,包括 `nodeType=ITEM_BOM`**
   - ③ BOM 条目**同时带 `skuCode` 与 `optionValueCode`** → typed validation failure(歧义输入,不得静默择一)
   - ④ `inventoryBom` 为 `false` 的形态提交任意 BOM 条目 → typed validation failure(**独立维度**)

> ⛔ **本条原来写的是「或提交 `nodeType=OPTION_VALUE` 的 BOM」,与 B4 的 refs 判据矛盾,已改。**
> **它会制造假绿**:一个只查 `nodeType` 的错误实现能拒掉 `nodeType=OPTION_VALUE`,
> **却放行真实前端产出的 `nodeType=ITEM_BOM` + `optionValueCode`** —— 旧断言照样绿,
> 而 refs 规则一条都没被证明。**这正是"用一个可以随便填的字段当判据"的代价,在验收侧又重演了一次。**
>
> ✅ **上面第 ③ 条是实现给出的,不是我写的** —— `validateShapeOwnedSections`(约第 1777 行)
> 对"两者同时非空"直接拒绝,而我的规格只写了"有 `optionValueCode` 就判 `OPTION_VALUE`",
> **那会静默接受一个有歧义的 payload**。**实现比规格严,规格照实现改。**
6. **引用守卫** —— 删一个被引用的变体轴/值 → `REFERENCE_BLOCKS_VOID`
7. **批量命令** —— 50 条里 3 条失败时,另外 47 条生效、失败三条逐条可见原因、
   **且 50 条的图片与描述属性都没变**(防覆盖的唯一守门)

⚠️ **新增业务场景前先读主动规范** `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md`;
业务断言按域扩进对应的 `*AcceptanceScenarios.java`,**总数保持在 80 条以内**。

---

### 第二步 · 前端(八批)

**开工前提**:第一步 B6 验收通过,**契约已冻结**。

| 批次 | 内容 | 依赖 |
|---|---|---|
| **F1 · 减法** | 治理前端半 · `riskFlags` 前端 Tag | 无 |
| **F2 · 零后端形态修正** | 主列 `NameCodeText` 与短名 · 状态徽章改读 `lifecycle.status` · 冲突筛选禁用与解释 · 结果域标签 · `ordering` 页签的前端渲染 | ⚠️ **必须排在 F1 之后** —— 冲突筛选要处理的三个 Select 里,有一个正是 F1 要删的治理筛选。<br>⚠️ **分类选择器已移出本批**,见下方说明 |
| **F3 · 渲染器与 slot(本步主体)** | foundation 的 descriptor join + 8 原语 + 2 表格 + 2 只读 + **唯一 kind 分派** · App 的静态 slot 与 resolver(含 fingerprint 失效规则) | §3.8 四·1 ~ 四·5 六条约束逐条。⚠️ foundation 三道既有门(禁 `apps/` 导入、禁 `generated/` 导入、**禁 `import(`**)新代码撞上即红 |
| **F4 · 文案接线与删除** | 枚举标签接线(删前端映射表)· ⛔ **删除 `fields[]` 覆盖字段的写死文案** | **F3 之后**。⚠️ 只删字段表覆盖到的渲染点;表外的留在原地,**收口时两个数分开报** |
| **F5a · 分类选择器(descriptor 首个实例)** | 分类选择器 | ⛔ **F3 之后立刻做**(第四轮 Codex 技术建议)—— 它是全表唯一一处"用户完全做不成一件正常事",**把它作为渲染器的第一个 descriptor 实例**,既不产生双真相,也不把这个痛点继续压在整批之后 |
| **F5b · 四处 picker** | SKU 属性 · BOM 库存对象 · 套餐组件 SKU · BOM 所属选项值 | **F5a 之后**(复用它验过的通路)。✅ **四处均不依赖 C1-2,可以先做** |
| **C1-2 · 字典 kind 拆分(补丁批次,后端)** | `SKU_ATTRIBUTE_VALUE` 拆出 `ORDER_OPTION_VALUE` · `parent_entry_ref` + 双向 CHECK · `parentEntryRef` 查询与响应字段 · 七环链 | ⛔ **不依赖任何 F 批次**,与 F8 碰不到(F8 用 `TAG` kind,本批拆的是 `SKU_ATTRIBUTE_VALUE`)。**排在 F8 收口之后立刻做,不是等 F1–F8 全完**。完整规格见矫正批次文档 C1-2 |
| **F5c · SKU 属性值 picker** | 属性值选择器(按已选属性过滤) | ⛔ **依赖 C1-2,紧跟其后**,不要拖到最后 —— 见下方"为什么不能拖" |
| **F6 · 阻断项的前端半** | 标签与销售单位 · 库存配置回读 · 区间价 | **F3 之后**(`tagRefs`/`salesUnitRefs` 是字段表第 9、10 行)。⚠️ 第 9 行的候选端点在 B1 落地后已写死 |
| **F7 · SKU 矩阵 UI** | 矩阵按维度生成(descriptor 驱动)· ⛔ **生产标签 code/ref 值链同批替换**(见 §3.8 七"第 8 行是活 bug") | **F3 之后**。✅ 生产标签的 `tagRef` 已固定在 B1 补齐,F7 只做前端值链替换 |
| **F8 · 批量动作前端 + 逐 IA-ID 收口** | 改分类 · 改标签 · 证据文件其余条目逐条过 | 全部 |

⚠️ **`分类选择器` 从"最该先做"变成了"F3 之后"** —— 这是 `fields[]` 决策的直接代价,**必须明说**。
它原本是全表唯一一处"用户完全做不成一件正常事"(新建商品进不了左树任何分类节点),
且零后端,所以原计划把它排在最前。
**但 `categoryRefs` 现在是字段表第 1 行,先用写死控件接一遍、回头再改成 descriptor 驱动,
就是本工单反复禁止的双真相。** 所以它只能等渲染器。
**代价是这个用户痛点的修复被推迟了 第一步全程 + F1~F3 的长度。** `DEXTER_DECISION`(是否接受这个推迟)

### ⛔ C1-2 与 F5c 的排期(2026-08-15 Dexter 裁定后补写)

> **前一版只写了「F5c 依赖 C1-2」,没写 C1-2 自己排在哪。**
> ⚠️ **这正是让 2-6 隐形的同一类空白** —— 一个项被标注了依赖,却没有被标注位置,
> 于是它既不在任何批次里,也没人觉得它缺席。**依赖关系不等于排期。**

**依赖事实**:C1-2 不依赖任何 F 批次(纯后端建模);F5c 只依赖 C1-2;F8 与 C1-2 互不相碰。
**三者无环,没有"必须等 F1–F8 全完"的理由。**

| 时点 | 做什么 |
|---|---|
| ⛔ **现在** | **C1-2 的只读清点**:统计"两边都没被 R06 / R12 / R17 引用、无法自动分类"的存量字典行有多少。**只读,不改任何东西**,但它可能触发 Dexter 的裁决 —— **早知道比做到一半停下来问好** |
| **F8 收口之后立刻** | C1-2 主体。⚠️ 不是因为依赖,是因为 F8 已在手上,中途切换浪费上下文 |
| **C1-2 之后紧跟** | F5c |

### ⛔ 为什么 F5c 不能拖:现状是"半迁移",而且在持续积累坏数据

✅ **亲验**(F5b 之后的现状):

| | 控件 | 写入 |
|---|---|---|
| **SKU 属性** | `CatalogDescriptorPicker` | ✅ 真从字典选,写真实 `attributeRef` |
| **SKU 属性值** | ⛔ **两个自由 `Input`**(`valueCode` / `valueLabel`) | ⛔ `CatalogItemDrawer` 约第 755 行 **`valueRef: draftUuid()` —— 前端自己铸一个 UUID** |

**父是真字典引用,子是前端现铸的孤儿 UUID。**
保存不会报错(UUID 格式合法),但那个值**不对应任何字典条目,也没有父子关系**。

⛔ **这直接放大 C1-2 的迁移成本**:C1-2 的第一步是"把存量属性值分类并回填父属性",
**而每多跑一天就多积累一批孤儿值** —— 存量越多,那批"分不出是哪一种"的行就越多,
**也就越可能触发"非零必须停下报数"那条裁定**。

**拖 F5c 不是省事,是让迁移越来越难。**

### ⛔ 第二步的收口条件

> ⚠️ **本节是 2026-08-15 自查补的。** 两步切法原先**只写了第一步的收口条件** ——
> 第二步做完凭什么算完成,整份文里没有答案。**这正是我一路在别处抓的"没有可证伪判据"。**

**第一步的七条是后端与契约的,不重复。第二步另有八条,全部由前端承担**:

1. **契约与渲染一致** —— 每个声明了 `controlKind` 的字段,渲染后 markup **含该 kind 的判别特征**
   (逐 kind 的判别特征在 F3 一次固定进测试工具,不许每条用例自己发明)
2. **渲染器唯一** —— `apps/frontend/*` 下不存在按 `controlKind` 分派的代码;
   且 foundation 不出现对 `apps/`、`generated/` 的导入,也不出现 `import(`(**这三条今天就是门**)
3. **闭集相等** —— 渲染器认识的 kind 集合 = 契约 16 个闭集,由 `assertNever` 在**编译期**承担;
   **红夹具**:契约加一个 kind 不改渲染器 → 必须编译失败
4. **文案唯一** —— 字段表覆盖到的渲染点**无字面量文案**;
   ⚠️ **收口时两个数分开报**:表内已清零多少、表外还剩多少(**不许合并成一个数**)
   - ⛔ **范围写死:只覆盖"七"表的 10 个 `fieldKey`。**
     **页签标签(`tabLabels` 那 9 条)不在本判据内** —— 它们是常量不是字段,
     且契约今天没有承载它们的插槽(见 §7 订正)。**它们计入"表外还剩多少"。**
   - ⚠️ **这一条前一版与 §7 冲突**:§7 曾写「页签名字按 §3.8 走契约下发」,
     而 §3.8 四·2 的范围从来只有 `fields[]`。**冲突已由 §7 订正解决,此处写死范围防止再漂。**
5. **候选来源可调** —— 契约里的 `endpoint` operationId 集合 = 前端绑定表登记集合,**且绑定无默认回落**
6. **join 唯一** + **slot 集合相等** —— 生产渲染路径只调用 foundation 的唯一 join API(生成器/校验器/测试除外);
   App 注入的 slot key 集合 = 闭集对应子集,**少注入一个则红,不得静默渲染空白**
7. **fingerprint 失效三条** —— 选 A 再选 B、A 晚回 → B 的候选不被覆盖;
   改一个选项值 → `bomOptionValue` 候选同步变;切换品牌 → 旧候选清空且新请求带新 scope
8. **生产标签值链已换** —— 快速创建一个标签 → 它处于选中态 → 保存请求里该项是 **UUID**
   → 重开详情仍显示该标签名(**今天这条会红**)
9. ⛔ **编辑值按 `dataPath` 真的进了保存请求(第四轮 Codex review M-5)** ——
   **表驱动往返**:`hydrate → 编辑 → 捕获 typed save request → 精确比对 `dataPath` → 重开 readback`。
   **至少覆盖分类,以及套餐组件那两个数组行。**

⛔ **第 9 条是这八条里最要紧的,因为前八条全绿它仍可能是坏的。**

前八条管的是**控件对不对、候选对不对、文案从哪来** ——
**没有一条管"用户改完之后那个值有没有被提交"。**
✅ 而保存组装今天仍是手写的:分类那处直接回带 `detail.item.categoryRefs`,
**它表达的是"详情给了什么",不是"用户改成了什么"**。

**所以可能出现的假绿**:控件是 descriptor 驱动的、候选来源正确、fingerprint 正确、文案唯一 ——
**而保存请求里写的是旧值、错的数组行,或者把 `code` 写进了 ref 位。**
⚠️ **这正是字段表第 8 行那条活 bug 的同族** —— 它已经在生产标签上真实发生过一次,
**没有理由假设其余九个字段不会。**

**外加一条跨两步的**:**89 条 IA 全量重验**,`CONFORM` 与"有差异"一视同仁,
**重验对象是依据链不只是结论**。

⚠️ **F8 的第 0 步是先列清单**:收口分母(v4 差距 28 条)现在**不存在**,不先列出来这一批无法证明闭合。见 §6。

⚠️ **重验规则订正**:前一版说"只重验标 `CONFORM` 的,标'有差异'的会在修复时自然被重新打开"——
**仓内有反例**(有差异的条目其依据链同样会失效)。改为:**89 条全量重验,`CONFORM` 与"有差异"一视同仁,
重验对象是依据链不只是结论。**

### 两步之内的隐含顺序

**第一步**:⛔ `B0 → B1 → **B5a** → B2 → B3 → B4 → **B5b** → B6`。

⚠️ **B5a 插在 B1 与 B2 之间,不是排在最后**(2026-08-15 B0 review N-2 订正)——
B2 要动前端消费者(见"删除必须同批"那条规则),**分母不先扩,那一刀就没有门守着**。
**B5b(生成器侧挂门)在 B3 之后**,它守的是 `fields[]` 机制,机制没落地无从守起。
两者都**必须在第二步开工前落地** —— 它们是第二步前端代码的守门,**晚了就只能去守已经写完的代码**。

**第二步**:`F1 → F2 → F3 → (F4 · F5 · F6 · F7) → F8`。
- **F1 必须在 F2 之前** —— 冲突筛选要处理的三个 Select 里,有一个正是 F1 要删的治理筛选
- **F3 是 F4~F7 的硬前置** —— 这四批渲染的都是 `fields[]` 覆盖的字段;
  渲染器与闭集不先落地,它们只能用写死控件先接一遍,**回头再搬进契约就是双真相**,
  而且是"先做对了再做成两份"的那种,**最难在收口时发现**
- **F4~F7 之间无强顺序**,可按人手安排

⚠️ **前一版那句"如果只能先做一条,做分类选择器"已撤回。**
理由不是它不重要 —— 它仍然是全表唯一一处"用户完全做不成一件正常事"
(新建的商品进不了左树任何分类节点),其余条目都是显示劣化或多余动作。
**撤回是因为它现在做不了第一条**:`categoryRefs` 是字段表第 1 行,
先用写死控件接一遍、回头改成 descriptor 驱动,**正是本工单反复禁止的双真相**。
**它现在的位置是 F5,前面压着第一步全程加 F1~F3。** 这个推迟的代价见 §5 F5 那条说明。

---

## 6 · 分母与去向

**IA-ID 分母 89** ✅ 五路复算收敛。⚠️ `76` 是已撤回口径(三段式正则漏 13 条四段式)。

> ⚠️ **归属统计必须重做。** 分析稿的「33 / 55 / 13」三数相加 **101 ≠ 89**,那是按标记次数不是按条目。
> **实施第一步:以 89 条为主键,一条一个归属,三类相加必须等于 89。对不上就是没分完。**

⚠️ **IA 分母覆盖不全**:✅ 至少「全部商品挂错分组」这一条**不在 89 条里**。
**IA 分母是"IA 写了什么"的分母,不是"前端有什么问题"的分母** —— 逐条过完 89 条**不等于**问题清完了。

### ✅ 问题分母已闭合(2026-08-15 补齐,两个欠账都做完了)

**问题分母 = 三个来源的并集:**

| 来源 | 条数 | 状态 |
|---|---|---|
| **IA 89 条** | **89** | ✅ **第三次重做已闭合**:无剩余 **21** · 前端 **21** · 后端 **5** · 两者 **42** = **89**。<br>**六个面分面闭合,列向也闭合**;89 行 = 89 个不重复 IA-ID,无重复计数 |
| **v4 差距** | ⚠️ **重判为 42,不是 28** | ✅ 已逐条列出。**工单已覆盖 22(其中 3 条只部分覆盖)· 未覆盖 20** |
| **独立发现** | 开放集合 | 已知至少 1(全部商品挂错分组)。**只能靠"发现即登记"** |

> ⚠️ **归属重算的结果作废,而且作废的理由比数字本身更值得记。**
>
> 我采信了一份「`CONFORM` 23 / 纯前端 18 / 跨越 43 / 纯后端 5 = 89,分面校验通过」的重算,
> 并据此宣布"纯前端的活比原来少了近一半"。**核对证据文件之后,这份重算站不住:**
>
> 1. ✅ 证据文件的分类法是 `P3-2` / `跨越两者` / `已被P3-1覆盖` —— **`纯后端` 这个桶在文件里零命中**
> 2. ✅ 文件里 `跨越两者` = **55**、`已被P3-1覆盖` = **13** —— **就是我当作"已作废"的那个 33/55/13**
> 3. ⚠️ **`CONFORM` 是符合性判定,不是归属。** 一条可以既 `CONFORM` 又有归属 ——
>    **把它当成第四个互斥桶是维度混淆**
> 4. ✅ **分面并不闭合**:第一面 23 条而归属相加 18,第二面 16 条而归属相加 14,**方向还相反**
>
> **所以那仍然是按标记次数,不是按条目** —— 正是这一节声称已修的那个缺陷,**换了个数字重犯一次**。
>
> ⚠️ **而且抽查发现归属系统性偏向"跨越"**:它是对着 **IA 原文**算的,**没套用工单自己的裁定**。
> 治理与 `riskFlags` 在裁定下已是**纯前端删除**,却因为"IA 要而后端没有"被记成跨越 ——
> **于是本已是纯前端的活,被排到了后端批次之后。**
>
> ### ✅ 第三次重做已完成并闭合
>
> **判据改成了「当前所有裁定生效之后,这一条还剩什么工作、剩的工作在哪」** —— 不是"IA 原文要什么"。
>
> | 归属 | 条数 | 含义 |
> |---|---|---|
> | **无剩余** | **21** | 已符合,**或已被裁定删除/不做**(治理、`riskFlags`、导入导出等) |
> | **前端** | **21** | 剩余工作全在前端 |
> | **后端** | **5** | 剩余工作全在后端/契约 |
> | **两者** | **42** | 前后端各有一半 |
>
> **闭合校验**:89 行 = 89 个不重复 IA-ID · 四类相加 89 · **六个面分面闭合** · 列向也闭合。
>
> **"后端"那五条第一次有实名**(前两次这一桶要么零命中要么凭空冒出):
> `IA-CAT-LIFECYCLE-003`(复制候选 SQL 加一个状态谓词即闭合)·
> `IA-COPY-002`(闭包 `visited` 键从 item code 改成 `(objectType, sourceRef)`)·
> `IA-CONTRACT-008` / `IA-CONTRACT-009` / `IA-CONTRACT-011`。
>
> ⚠️ **"两者 42"仍是最大的一桶** —— 结构判断不变:**P3-2 不是纯前端批次**,近半条目要前后台各做一半。
> 但**纯前端有 21 条可以立即排**,而前两次的错误归属把其中一部分压在了后端批次后面。

### ⚠️ v4 差距里 20 条未覆盖 —— 这是本工单当前最大的闭合缺口

`M6 M7 M8 M9 M10 M11 M12` · `X3 X4 X6 X7 X11 X12` · `P2 P3 P4 P5 P6 P8 P9`
另有三条**只部分覆盖,按未闭合处理**:`X8`(标签筛选形态)· `X13`(未分类 Tag 与缺图提示)· `X14`(BOM 数量单位控件与节点树)。

**其中几条值得单独点名**(它们不是"比 v4 差一点",是用户能直接撞上的):

| # | 缺什么 |
|---|---|
| **M8** | **描述属性是一个 JSON 文本框** —— 老板要填「产地」得自己写 `{"origin":"..."}`。📗 v4 有属性定义表 + 值域 + 专用编辑表格 |
| **M9** | **识别码没有表也没有唯一约束** —— 两个商品录同一条码,数据库照收。只读态还写着「状态:当前契约未提供」 |
| **M12** | **catalog 没有 `audit_event`** —— ⚠️ 而同仓 `platform_iam` / `platform_workspace` / `organization` / `extension` / `workspace_iam` / `contract` **六个 owner 都建了**。"谁在什么时候停用了这个商品"查不出来。**这是仓内不一致,不只是不如 v4** |
| **X3** | **规格维度不能排序** —— 想把「口味 × 份量」换成「份量 × 口味」只能删了重建 |
| **X6** | **列表不能排序** —— 六列无一个 `sorter`,owner 白名单里也没有排序键,SQL 固定 `ORDER BY code`。"按最近更新排"做不到 |

**这 20 条不进本轮批次,但必须登记** —— ⚠️ **本工单不得声称"问题清完了"**,
只能声称:**IA 89 条闭合 · v4 差距 42 条中 22 条闭合 · 20 条已登记未做 · 独立发现随时可能增加。**

> ⚠️ **收口输入正在过期。** ✅ `2026-08-15-v2s-ia-89-conformance-evidence-claude.md` 是一次性快照,
> 而 Codex 正在改 `modules/catalog`(治理已删净、行号已位移)。
> **重验规则**: F8 收口前,对证据文件中 89 条 IA-ID **全部**重新打开当前源码核验,
> 无论原快照标记为 `CONFORM` 还是"有差异"；重验对象是依据链而不只是历史结论,
> 因为两类条目都可能在实施过程中静默失效或被当前裁定改变。

**枚举映射表分母** ✅ **已重算(四种写法各扫一遍)**:

| 写法 | 文件数 |
|---|---|
| `Labels: {` 常量表 | **1** |
| `Options: [` 选项数组 | 0 |
| **内联 `label:`** | **20** |
| `options={[` 属性 | 3 |
| **合并去重** | **21**,其中 **catalog 域 7 个** |

> ⚠️ **"六个"那个数是 `Record<string,string>` 这一族的数量,而那一族实际只有 1 个文件。
> 真正的大头是内联 `label:` 的 20 个** —— 我原来那一扫,正好扫的是最小的那一族。
>
> ⚠️ **重扫时又踩了一次同一个坑**:第一遍用 shell grep,四个模式里三个返回 0,
> **而那是转义写坏了,不是真的零**;换成不受转义影响的实现后是 1 / 0 / 20 / 3。
> **这是今天第五次栽在"零结果 = 真的没有"上。**

**B3 的范围:catalog 域 7 个文件。** 其余 14 个属别域,按 §5 B3 的边界说明由各自 owner 处置。

---

## 6.5 · 契约 / seed / 测试三面的完整性(**Dexter 2026-08-15 点名要查的三项**)

> 三轮对抗攻的都是"工单 vs 代码",**这三面一次都没系统攻过**。补在这里。

### 6.5.1 契约变更清单

**P3-2 会碰到的契约文件**:`catalog-common` · `catalog-item` · `catalog-dictionary` · `catalog-workbench` · `catalog-copy`。

| # | 变更 | 触发它的批次 | ⚠️ 连带 |
|---|---|---|---|
| ~~C-a~~ | ⚠️ **已不成立,撤回。** `enumLabels` **现在在契约里**(`catalog-workbench` / `catalog-common` 各处,生成物已带类型,owner 也已 put,manifest 里 17 组标签齐全) | ~~原契约前置~~ | **Codex 本轮在途加上的。F4 现在是纯前端零后端。** |
| ~~C-b~~ | ⚠️ **已不成立,撤回。** `entryRef` **现在是 `CatalogDictionaryView` 的首个 property**(`format: uuid`),生成 TS 已带 | ~~原契约前置~~ | **同上。F5 的属性那处现在也是纯前端。** |
> ⚠️ **前一版这里每条只有一句话 —— 那是方向不是规格。**
> 没有 Codex 详设这一环,**字段名、类型、层级、必填性、连带门每一项都得由本文定死**,否则实施必然走偏。
> 以下逐条写到"照着加"的程度。**契约文件是 `contracts/openapi/catalog-inventory.openapi.yaml`(后缀 yaml 实为 JSON),schema 在 `components.schemas` 下。**

| # | 规格 |
|---|---|
| **C-c** | **列表项区间价**。在 `CatalogItemPage` 的 item 里、**紧挨现有 `standardSalePrice`** 增两个字段:`standardSalePriceMin` 与 `standardSalePriceMax`。<br>**类型照抄邻居**:`{"type": ["integer","null"], "format": "cents"}`。**optional**(单价商品这两个为 null)。<br>**owner 侧**:由该商品全部**未归档** SKU 的 `standardSalePrice` 取 min/max;无 SKU 或全为 null 时两者皆 null。<br>**前端**:两者非空且不等时渲染 `¥min~max`,否则回落到现有 `standardSalePrice` 的渲染 |
| **C-d** | **列表项 `tagRefs`**。在同一 item 层新增 `tagRefs`,类型 `{"type":"array","items":{"type":"string","format":"uuid"}}`,**optional**。<br>⚠️ **注意与 C-e 的区别**:详情侧 `tagRefs` **已经 required 了**,这里是**列表侧从零新增**。两处字段名一致,不要一个叫 `tagRefs` 一个叫 `tags` |
| **C-e** | **详情投影补产出,不动契约**。⚠️ ✅ `CatalogItemDetail.data.item` 的 `tagRefs` / `salesUnitRefs` **契约里已 required,而 owner 不 put —— 当前就在违约**。<br>**所以这条是零契约改动、纯 owner 补两行 put**,与 C-d 不是同一件事。**别把它当契约变更做。** |
| **C-f** | **库存配置四字段进详情**。在详情的 BOM 条目结构里新增 `configuration` 对象(含 `allowNegative` / `lowStockThreshold` / `countingUnit` / `conversionFactor`)与 `consumptionUnit`。<br>⚠️ **字段名与类型必须与 inventory owner 现有的 `InventoryTargetCurrentView.configuration` 逐字段对齐** —— 打开那个视图照抄,**不要在 catalog 侧另起一套名字**,否则两个 owner 对同一事实两种叫法 |
| **C-g** | **删 `governanceStatus`**。✅ 已核:契约与 owner **均已零命中**,**本条无剩余契约工作**。前端删除见 F1 |
| **C-h** | **删 `ordering` 与挂牌价**。两件事分开:<br>① `ordering` 页签 —— 删 manifest `tabRules` 里两个 STANDARD 形态的 `ordering` 项,**连带** ⚠️ 生成器的 `tabRulesByShape`、校验器的 `expectedTabs` 与其红夹具。<br>② **挂牌价 `listedSalePrice`** —— 按裁定归销售集合域,**商品域删除**:契约里该字段的每一处声明、owner 投影、前端两个控件(`:660` 标准价保留,`:662` 挂牌价删除)。<br>⚠️ **`listedSalePrice` 在契约里有多处,必须逐处清点后一次删完** —— 漏一处会让生成物与 owner 对不上 |
| **C-i** | **批量命令新增 operation**。⛔ **粗形态已作废,完整契约见下方 §6.5.1-i**(2026-08-15 Codex B1 提请裁决后补写)。<br>⚠️ **新增 operation 的连带远不止 yaml**:路径与 operationId 声明 · 生成的 Java wire 与 TS 客户端 · **路由注册表** · handler binding · 能力注册 · edge contract · 前端 operation 分母 · 四道校验门的固定分母 |

### §6.5.1-i · `C-i` 批量状态迁移的完整公开契约(2026-08-15 补写)

> **为什么补**:Codex 在 B1 停下并提请裁决 —— C-i 原文只有粗形态,
> 按执行纪律不得自行发明 operationId、path、版本语义或归档语义。**这是对的,停得对。**
> 下面每一项都写死;凡我不能从仓内推出的,单独标 `DEXTER_DECISION` 并说明它**不阻塞** C-i 实施。

#### 零 · 一条决定性的仓内事实:**归档不是作废**

✅ **亲验**,`V20260806_120000_000__catalog_inventory_backend.sql`:
> `CHECK (status IN ('DRAFT', 'ENABLED', 'DISABLED', 'ARCHIVED', 'VOIDED'))`

**`ARCHIVED` 与 `VOIDED` 是两个并列状态,不是同一件事的两种叫法。**

✅ 且两者的守卫**不同**:`CatalogOwnerService` 第 1699 行只判 `"VOIDED".equals(target)` ——
**作废受引用守卫(`REFERENCE_BLOCKS_VOID`),归档不受。**

⛔ **所以 C-i 的"归档"= `ARCHIVED`,不得实现为 `VOIDED`。**
**批量路径的守卫必须与单条路径逐字一致,不得自行加严或放松。**

#### 一 · operation 身份

| 项 | 值 |
|---|---|
| `operationId` | `batchTransitionOperationsCatalogItemStatus` |
| method · path | `POST /api/operations/catalog-inventory/items/status` |
| 风格依据 | ✅ 现有单条是 `POST /items/{itemCode}/status`;批量是**集合级子资源**,与之并列 |
| owner / coordinated owner | **逐字复用单条 operation 的声明**,不新增 |
| capability | **逐字复用**:`HEAD_COMPANY` · `STORE` · `EDIT_HEAD_COMPANY_CATALOG` · `EDIT_STORE_CATALOG`。**不新增 capability key** —— 同一权限、同一批数据,新增只会多一处要对齐的分母 |

**必须同批登记的七处**(缺一处做到一半会被门挡住):
OpenAPI path 与 schema · 生成的 Java wire · 生成的 TS 客户端 ·
**路由注册表** · **operation-handler binding** · **capability registry** · **edge contract**。

#### 二 · request:⛔ **粗形态的 `itemRefs[]` 不够用,改为逐条对象**

```
{
  dataNodeRef: uuid,          // 必填,与单条一致
  targetStatus: <枚举>,        // 单值,一批只改一个目标状态
  items: [ { itemRef: uuid, expectedVersion: int } ]   // 逐条带版本
}
```

⛔ **为什么不是 `itemRefs[]`**:单条 operation 用 `expectedVersion` 做 CAS。
**只传 ref 不传版本 = 并发更新被静默覆盖** ——
用户 A 在列表里勾了 50 条,用户 B 同时改了其中一条,A 的批量会把 B 的改动盖掉且无人知道。
**这是把现有的并发安全等级降级,不是"批量的简化"。**

- **brand scope 从执行上下文取**,不进 request(与单条一致)
- **不允许跨 data node、不允许跨 brand** —— `itemRef` 不属于当前 scope 时,
  **该条返回 `SCOPE_FORBIDDEN`,不整批失败**(它是数据问题,不是请求格式问题)
- **一批只允许一个 `targetStatus`** —— 混合目标状态不予支持。
  理由:用户动作是"把这些改成 X";混合会让幂等 hash 与 UI 双双复杂化,而没有对应的用户任务
- **整批拒绝(HTTP 400 + `VALIDATION_ERROR`)的三种**:空数组 · 重复 `itemRef` · 超过上限。
  ⚠️ **上限取列表单页最大条数**(§4 已定"跨页全选是新范围,不在本轮"),
  **实施时从契约里取实际值写死,不要另编一个数**

#### 三 · 事务与部分失败:⛔ **逐条独立事务,不是一个大事务**

§4 的不变量要求"50 条里 3 条失败,另 47 条生效"。

**定为:每个 item 走一次独立的 owner command,各自独立事务。**
❌ **不接受"一个 REQUIRED 事务 + savepoint"** —— savepoint 在部分失败下的回滚边界脆弱,
而这里没有任何跨 item 的一致性要求需要它。
❌ **更不接受"任一条失败即整体回滚"** —— 直接违反 §4 不变量 1。

- **结果顺序与请求顺序逐位一致**
- **HTTP 一律 200 + 逐条结果**;整批性错误(见上三种)才用 4xx
- **未知异常**:该条 `ok:false` + `RESULT_UNKNOWN`,**不中断其余条**
- ⛔ **§4 不变量 3 是最硬的一条**:**任何批量动作不得清空用户没有触碰的字段**。
  批量状态迁移**只写 `status` 与 `version`**,不得走整体 `saveItem` 路径

#### 四 · 逐条结果与 `failureCode`:✅ **零新增 problem code**

```
{
  results: [ { itemRef, ok, failureCode?, version? } ]   // version 为成功后的新版本
}
```

✅ **亲验**:catalog owner 现有 20 个 typed problem code 已覆盖全部情形,**本轮不新增**:

| 情形 | `failureCode` |
|---|---|
| item 不存在 | `NOT_FOUND` |
| `itemRef` 越出当前 data node / brand scope | `SCOPE_FORBIDDEN` |
| 版本冲突 | `VERSION_CONFLICT` ——**该条失败,其余继续** |
| 目标 `VOIDED` 但被其他商品或库存事实引用 | `REFERENCE_BLOCKS_VOID` |
| 目标 `VOIDED` 但有依赖事实 | `DEPENDENT_FACTS_BLOCK_VOID` |
| 源已是 `VOIDED`,试图迁往别的状态 | `VOIDED_RECORD_IMMUTABLE` |
| owner 内部未知异常 | `RESULT_UNKNOWN` |
| **已经是目标状态** | ✅ **不是失败** —— `ok:true` 幂等无操作。**这样就不必新增 code** |

⚠️ **整批性错误不进 `results[]`**,它们是 HTTP 4xx + `VALIDATION_ERROR`。
**混淆这两层会让前端既要判 HTTP 又要判逐条,还判不全。**

**判据**:`results[].failureCode` 的取值集合 **⊆ 契约已声明的 typed problem code 闭集**;
**红夹具**:回一个未登记的 code → 门必须红(§6.9 绑定 9)。

#### 五 · 幂等与重放

**必须支持 `Idempotency-Key`,与单条命令同机制。**

- **request hash 覆盖**:scope(data node + brand)· `targetStatus` ·
  **`(itemRef, expectedVersion)` 的规范排序集合**
- **顺序无关** —— 同一批次不同顺序视为同一请求(hash 前先排序);
  **但响应里的 `results[]` 仍按本次请求的顺序返回**
- **重复 `itemRef` 在 hash 之前就整批拒绝**,不进入幂等逻辑
- ⛔ **首次部分成功之后的重放,必须原样返回首次的逐条结果** ——
  **不得重新执行**。即使某一条的状态此后被别处改动,重放仍返回历史 readback
- hash 不一致 → `IDEMPOTENCY_MISMATCH`(现有 code)

#### 六 · 需 Dexter 裁决的一项(**不阻塞 C-i 实施**)

> **`ARCHIVED` 要不要也受引用守卫?**
>
> ✅ **今天不受**(第 1699 行只判 `VOIDED`)。所以一个被别的商品引用的商品,**今天可以被归档**。
> - **甲**:`ARCHIVED` 是可逆的下架/收纳状态,不该拦 —— 与今天一致
> - **乙**:归档也该拦,否则引用方会指向一个已归档商品
>
> ⛔ **无论裁成哪样,都不由 C-i 承担** —— 它会同时改变单条路径的行为,是独立范围。
> **C-i 只需与单条路径逐字一致。** `DEXTER_DECISION`

#### 七 · 九种错误实现,逐个对应到哪条判据挡它

| # | 错误实现 | 被哪条挡住 |
|---|---|---|
| 1 | 循环调现有单条 HTTP operation 冒充批量 | 一 · 七处登记(**路由注册表里必须真有这个 operationId**) |
| 2 | 只接 `itemRefs[]` 取消 `expectedVersion` | 二 · request 逐条带版本;**红夹具**:并发改一条 → 必须 `VERSION_CONFLICT` 而不是静默覆盖 |
| 3 | 任一条失败即整批回滚 | 三 · 逐条独立事务;§4 不变量 1 的 47/50 用例 |
| 4 | 逐条成功但清空用户没碰的 sections | 三 · **只写 `status` 与 `version`**;§4 不变量 3 的用例(50 条图片与描述属性都没变) |
| 5 | 把"归档"实现成 `VOIDED` | 零 · `ARCHIVED` 与 `VOIDED` 是两个状态;**红夹具**:批量归档一个被引用的商品 → **必须成功**(若实现成 VOIDED 会被守卫拦下而失败) |
| 6 | 自由字符串 `failureCode` | 四 · 取值 ⊆ typed problem code 闭集 + 红夹具 |
| 7 | 只加 OpenAPI path 不同步其余六处 | 一 · 七处同批登记 |
| 8 | 把 `itemRef` 当跨租户全局身份 | 二 · 越出 scope 该条回 `SCOPE_FORBIDDEN`;**红夹具**:传一个别 brand 的 ref → 必须该条失败且**不泄露该商品是否存在** |
| 9 | 重放同一 key 时重新执行 | 五 · 重放必须原样返回首次逐条结果;**红夹具**:首次部分成功后改动某条状态再重放 → 仍返回历史 readback |

⚠️ **第 5 条那个红夹具是反着写的**,值得留意:
**"批量归档一个被引用的商品必须成功"** —— 如果实现者把归档做成了作废,这条会红。
**用一条"必须成功"的用例去挡一个错误实现,比再写一条"必须失败"更能证伪。**

> ⚠️ **另一处全局问题,登记但本轮不做**:✅ v2s 契约里所有字段的 `description` 都是占位符
> `"design-bound field"` —— **一句真话都没有**。这与 §3.8 的 `helpText` 缺位是同一个坑的两半:
> **契约有位置放说明,但里面装的是废话。** 本轮新增/修改的字段,**`description` 必须写真话**,不得沿用占位符。

> ⚠️ **每一条契约改动的扇出,不止改 yaml。** ✅ 仓内有 **4 个 catalog 生成器**
> (`catalog-admin-p3` / `catalog-inventory-p1` / `catalog-inventory-p3-frontend` / `catalog-inventory-workspace-command-tokens`)
> 与 **4 道校验门**(`catalog-inventory-p1` / `catalog-inventory-p2` / `contract-face` / `database-boundaries`)。
> **改契约必须同批重新生成并跑这些门,且门里的固定分母要同步。**
>
> ⚠️ **`ordering` 删除的连带被前一版记成"manifest 改动",实际更宽**:
> 生成器的 `tabRulesByShape` · 校验器的 `expectedTabs` 与其红夹具 · `listedSalePrice` 在契约里的多处声明 ·
> byte-coverage 相关行。**这些不列全,B2 做到一半会被门挡住。**

### 6.5.2 seed 调整

> ⚠️ **本节前一版整段是错的,已重写。错因记在这里。**
>
> 前一版说「六个键在 `catalog-inventory-seed-plan.mjs` 里全部零命中 → DEV 里这些功能全看不见」。
> **两个错叠加:**
> ① ✅ 那个文件是**校验器,不是数据**。真实数据源是 `scripts/dev/profiles/catalog-inventory.json` 指向的
>    v4 fixture 目录(73 条商品)。
> ② ✅ 我搜的是 **payload 键名**(`categoryRefs`),而 fixture 那一层的域名是 **`categoryKey`**。
>
> **实测**:该目录里 `categoryKey` **73 处**、`optionGroups` **36 处**。
> 而 executor 已经在用:逐条写 `categoryRefs`、由 `sku.attributeValues` 生成 `skuVariantDimensions`、
> 对 `SKU_ATTRIBUTE` / `SKU_ATTRIBUTE_VALUE` / `ORDER_OPTION_GROUP` 做精确标签集断言。
>
> **所以 seed 早就覆盖了大部分形态,前一版列的七条里有四条(S-a/S-b/S-d/S-f)基本已满足。**
> ⚠️ 这是"零结果 = 真的没有"这个坑的**第六次**,而且这次我连搜的文件都指错了。

### ✅ seed 真正缺的只有三条,而且都是"接已有字段"不是"补商品"

| # | 缺什么 | 性质 |
|---|---|---|
| **S-1** | **每商品只挂 1 个分类** —— executor 写死单元素数组。"至少两个商品共享同一分类""一个商品挂多个分类"都没有 | 改 executor 一处 |
| **S-2** | **`tagRefs`(商品标签)没接** —— fixture 里的 `tagKeys` 映射的是 `PRODUCTION_TAG`,不是 `CATALOG_TAG` | 接一个已有字段 |
| **S-3** | **`salesUnitRefs` 没接** —— 源里 49 条有 `salesUnitKey`,而 executor 的单位映射只收库存/BOM 单位,没接销售单位 | 接一个已有字段 |

**sed 的硬约束不变**:继续走 HTTP 真实写路径,不得改成直接 INSERT;seed 跑不通时默认结论是 seed 错了。

<details><summary>前一版列的七条 seed(S-a 到 S-g,大部分已满足,保留备查)</summary>

**seed 必须补的最小集合**(每条都对应一个 P3-2 能力,不是凑数):

| # | 补什么 | 为了让哪条能力在 DEV 里可见 |
|---|---|---|
| S-a | 商品挂 1–3 个分类,且**至少两个商品共享同一分类** | 分类选择器 · 左树计数 · 分类删除阻断 |
| S-b | **至少一个商品带变体轴**(如 口味 = 甜/辣),生成对应 SKU | SKU 矩阵 · 属性值选择器 |
| S-c | **至少一个无属性多 SKU 的商品**(小份/大份) | `OPTIONAL_TABLE` 语义(⚠️ 依赖矫正批次 C1-1) |
| S-d | **两个商品引用同一个字典属性值** | ✅ Dexter 要的"口味不用每次新建"在 DEV 里唯一可见的证据 |
| S-e | 商品挂 `tagRefs` 与 `salesUnitRefs` | 2-1 的前端半 |
| S-f | **至少一个商品带点单选项组与共享料** | 加料模型(⚠️ 依赖 C1-3) |
| S-g | 一个商品的库存配置四字段有值 | 2-2 的回读 |

**seed 的硬约束沿用矫正批次 §8**:继续走 HTTP 真实写路径,**不得为了造数据改成直接 INSERT**;
**seed 跑不通时默认结论是 seed 错了,不是约束错了**。

⚠️ **S-c / S-f 依赖矫正批次,矫正批次未获开工授权前这两条造不出来** —— 登记,不阻塞其余五条。

</details>

### 6.5.3 测试用例完整性

**三档分级**(见 §0.1)之外,还有三个前一版没写的问题:

**一 · 开工前拿不到绿基线**

⛔ **本条原来的依据是假的,已订正(2026-08-15 B0 实跑)。**
前一版写「`nodeTestFiles` 声明与 `scripts/` 下实有的测试文件**数量对不上**」——
✅ **实跑**:declared **16** / discovered **16** / executed **16**,**相等**,
且 `validateExplicitTestSet` 对 missing / extra / duplicate 抛错,**三条红夹具各守一种**
(`RED_MISSING_ENTRY` / `RED_DUPLICATE_ENTRY` / `RED_BROAD_GLOB`)。**这个分母一直是自洽的。**

⚠️ **我无法确认它曾经为真** —— 本会话没有它当时被亲验的记录,
**同样可能是我当时没查就写了**。查证要 git 历史,不在评审授权内。 `UNVERIFIED`

**B0 仍然成立,但理由换了**:不是"分母对不上",而是
**"实施者需要一个已知绿的参照点,才能判断后面出现的红是不是自己造成的"**。
✅ B0 实跑已经建立了这个参照点,**并且顺带证伪了上面那条假依据**。

**二 · 每个批次的验收用例,前一版只给了形态没给清单。** 补:

| 批次 | 至少要有的用例 | 档 |
|---|---|---|
| F1 治理删除 | 工作台**任何路径都发不出** `governanceStatus` 参数 · 智能视图可选集合不含 `GOVERNANCE_PENDING` | 纯函数 |
| F5 分类选择器 | 新建商品选两个分类 → **左树两个节点计数各 +1** · 编辑态能取消某个分类 | 渲染 + 纯函数 |
| F2 主列 | 主列渲染路径经过 `NameCodeText` · 短名命中时可见 | **渲染**(✅ `foundation.test.ts` 已有该组件的渲染断言可参照) |
| B2 + F2 `ordering` 删除 | 页签集合与 IA §6.2 矩阵**逐形态相等** · **`STANDARD_SALE_COUNTED` 商品仍能编辑并保存标准价** | 渲染 + 集成 |
| F4 枚举标签 | 三方集合两两相等 · 加枚举值不给标签**必须红** · 前端不存在内置映射表 | 纯函数 + 门 |
| F5 picker | 候选来自指定端点 · 提交带 ref 不带手打编码 · 已停用可见不可选 · 未选属性时值选择器 `disabled` | **渲染**(四个编辑器**加 `export` 后**可直接断言) |
| F6 阻断项前端半 | 详情标题状态徽章非空 · 基础资料状态行非空 · 库存配置四字段**保存后重开仍在** | 渲染 + 集成 |
| B4② + F7 SKU 矩阵 | ① 矩阵按维度生成 · ② 删被引用的轴/值**被拒且指名哪些 SKU 在用** · ③ 先调整 SKU 再删**必须成功** · ④ 未被引用的轴**直接删成功** | 集成 + 渲染 |
| B4③ + F8 批量 | 50 条里 3 条失败 → 另 47 条生效 · 失败三条**逐条可见原因** · **所有 50 条的图片与描述属性未变** | 集成 |

**三 · 第三档的成本**:交互(点击、输入、下拉)、portal 内容、带 RTK hook 的组件 ——
`renderToStaticMarkup` 都做不到,**要新建交互测试基建**。
✅ 但**四个编辑器子组件零 hook 或只有 `useState`,加 `export` 即可绕开 Drawer 直接渲染断言** ——
**这一步成本是"加四行导出",不是"建一套基建"。**

## 6.9 · 绑定清单 —— **凡两块讲同一件事,必须有集合关系与门**

> **Dexter 2026-08-15**:「商品 shape 和控件契约紧密相关,千万不要毫无关联,最后又做成多真相。」
>
> 这条不只适用于 shape 与控件。**本工单里凡是"A 必须与 B 对齐"的地方,都是一处潜在多真相。**
> 集中列在这里,**一眼可查哪些已绑、哪些还没**。

| # | A | B | 关系 | 状态 |
|---|---|---|---|---|
| 1 | `fields[].fieldKey` | 其 `admittedShapes` 各形态的 `fieldRules[shape][].field` | ⛔ **`fields ⊆ ∪fieldRules` 单向**(反向是终局目标,**本轮不当门**,见 §3.8 一之补) | ✅ 已绑,三门 + 三条红夹具 |
| 2 | `fieldRules[shape]` 的可见字段 | `tabRules[shape]` 的可见页签 | 字段可见 ⇒ 其 `tabKey` 页签必可见 | ✅ 已绑(同上第 3 条) |
| 3 | `optionSourceRef` 的 `enum:` 取值 | `enumLabels` 的 kind 集合 | **⊆** | ✅ 已绑,红夹具(§3.8 三) |
| 4 | `optionSourceRef` 的 `endpoint:` 取值 | 契约实际声明的 operationId | **⊆** | ✅ 已绑(同上) |
| 5 | `enumLabels` · 校验器接受集合 · 契约枚举 | 三方 | **两两相等** | ✅ 已绑(§12.1 用例 12.1-a) |
| 6 | 引用矩阵 entry | Inventory guard 实际查询集合 | **相等** | ✅ 已绑(P3-1 §1.1-A 用例 A-6) |
| **7** | catalog 详情新增的 `configuration` | inventory 的 `InventoryTargetCurrentView.configuration` | **字段名与类型逐项相等** | ⚠️ **未绑** —— C-f 只写了"必须对齐",没有门 |
| **8** | `controlKind` 闭集 | 前端渲染器的分派表 | **相等** | ⚠️ **未绑** —— 契约加一个 kind 而渲染器不认,会静默回落 |
| **9** | 批量命令的 `failureCode` 取值 | 契约的 typed problem codes | **⊆** | ✅ **已定,归 B4③**(第四轮 review S-2):复用该闭集;**红夹具**:回一个未登记的 code → 门必须红 |
| **10** | 契约的 `label` / `helpText` | 前端写死的字段文案 | **前者唯一,后者应为空** | ⚠️ **未绑** —— 亲验:11 处字段 `label=` + 72 处含中文 `title=`/`placeholder=` 仍在。已补,见 §3.8 四·2 |
| **11** | 契约里的 `endpoint:` operationId 集合 | 前端 operationId→调用 的绑定表 | **相等** | ⚠️ **未绑** —— 亲验:生成物无 `endpoints`/`.initiate`,今天根本调不起来。已补,见 §3.8 四·4 |
| **12** | `fieldRules[shape]` | `fields[]` | **join 只做一次** | ⚠️ **未绑** —— 每抽屉各 join 一次则 shape 与控件契约脱钩。已补,见 §3.8 四·5 |
| **13** | `fieldRules[shape]` 的内容 | 形态之间的真实字段差异 | **不同形态内容不等** | ⛔ **今天是反的** —— 亲验:生成器给七个形态发同一份 `commonFieldRules` 拷贝,key 逐形态而内容逐字相同。已补,见 §3.8 零之补 |

> ⚠️ **10 / 11 / 12 / 13 是 2026-08-15 复查新增的。** 前一版的九条绑定**全部落在契约内部与后端之间** ——
> 契约**长什么样**写到了详设粒度,而**谁产出它、谁消费它**这两端都没写。新增的四条正好补这两端:
> **10 / 11 / 12 在消费侧**(契约写好之后、前端用它之前),**13 在产出侧**。
>
> ⛔ **13 与其余十二条性质不同:它不是"未绑",是"今天绑反了"。**
> 其余各条是"两块讲同一件事但没有门";13 是**契约已经声称按形态区分,而生成器发的是同一份拷贝** ——
> 门加上去当场就红。**这也是本轮唯一一条会让 §3.8 的既有约束落空的**(约束 1 默认了逐形态有差异)。
>
> **判据与红夹具见 §3.8 四与零之补,本节不重复。**

### 七条未绑的,本轮补上

> 原为三条(7 / 8 / 9,都在契约与后端之间);2026-08-15 复查新增 10 / 11 / 12(消费侧)与 13(产出侧)。
> **10~13 的判据与红夹具写在 §3.8 四与零之补,此处不重复**,下面只展开 7 / 8 / 9。

**7 · 库存配置字段名跨 owner 对齐**
✅ 两个 owner 描述**同一个事实**(某库存对象的配置),字段名一旦不同就是两种叫法。
**判据**:catalog 详情里 `configuration` 的字段名与类型集合,**与 inventory 那个视图逐项相等**;
**红夹具**:在 catalog 侧加一个 inventory 没有的字段 → 门必须红。

**8 · `controlKind` 与渲染器分派表相等**
⚠️ 这条不补的后果最隐蔽:契约声明了一个新 kind,**渲染器不认,于是静默回落到某个默认控件** ——
界面看起来正常,而契约与实际渲染已经脱钩。**这正是"契约进控件"这件事本身要防的。**
**判据**:渲染器支持的 kind 集合 **等于** 契约闭集;**红夹具**:契约加一个 kind 不改渲染器 → 门必须红。

⚠️ **承担者已在 §3.8 四·3 指定(2026-08-15 补)。** 前一版这里只有判据没有承担者,
而**亲验发现生成物给的是裸 `string`**(`CatalogShapeManifestView` 的 `shapeKeys` / `capabilityValues`
均为 `Array<string>`;同文件里 `shapeKey` 别处收窄、`priceGranularity` 一处收窄一处不收窄),
**所以 TypeScript 的穷尽检查默认拿不到,门不会自己出现**。走甲(schema 用 `enum:` 使生成器收窄)
或乙(测试断言集合相等),**必须挑一个并说明理由**。

**9 · `failureCode` 取值受控**
**判据**:批量结果里出现的 `failureCode`,**必须是契约已声明的 typed problem code**;
不接受自由字符串 —— 否则前端又得靠 if-else 判断该显示什么(与 §3.8 冲突)。

### 通则

**今后本工单再出现"A 必须与 B 对齐"的表述,同批必须给出:集合关系(相等 / 包含)· 一道门 · 一条红夹具。**
**只写"必须对齐"而不给门,等于把多真相推迟到实施之后再发现。**

## 7 · 边界与未决

### ✅ 「治理与引用」页签已裁定(Dexter 2026-08-15)

**「只保留引用,不需要治理。引用还是有用的。」**

**所以是"页签留、内容减半"**,不是整页删除,也不是迁走引用关系。

| 动作 | 落点 |
|---|---|
| **页签保留** | `tabRules` 里 `governance` **七个形态都不动** —— ⚠️ 与 `ordering` 那条不同,**不要顺手一起删** |
| **页签改名** | ✅ **Dexter 已定名:「引用关系」**。⛔ **落法是改前端 `tabLabels` 里那个常量,不走契约** —— 理由见下方订正 |
| **删治理内容** | 页签正文里 `detail.governance.status` 那一段 —— ✅ 后端已删净,前端删渲染 |
| **保留引用内容** | `deniedFields` 与 `externalIdentity` ⚠️ **这两个另有消费方**(根级也有一份 `deniedFields`),**删治理时不要连带删掉** |
| **补齐引用能力** | ⚠️ `blockingReferences` 建了数组**从不填**(恒空)· inbound 反查缺失 —— **这才是"引用还有用"要兑现的部分**,归"两者" |

### ⛔ 订正:页签改名走常量,不走契约(2026-08-15,Codex F4 提请裁决后重写)

> **前一版这里写的是「名字属产品文案,按 §3.8 走契约下发,不在前端写死」。**
> ⛔ **这句是空头指令,已删。** §3.8 的机制是 `fields[]`,它承载**字段**的
> `label` / `controlKind` / `helpText`,**没有页签标签的插槽**;
> `tabRules` 只有 `tabKey` / `visible` / `disabled` / `reason`。
> **我把一个 payload 路由到了一个没有对应插槽的机制** ——
> 与我反复犯的「只写中间层不写两端」同型,这次是写了投递地址却没查收件箱在不在。

✅ **亲验**:`CatalogItemDrawer.tsx` 约第 27 行的 `tabLabels` 是**一张 9 条的 `Record<string, string>`** ——
`basic` · `sku-specifications-pricing` · `identifiers` · `order-options` · `attributes` ·
`production-prompts` · `inventory-bom` · **`governance`** · `composite-content`。
**`governance` 是其中第八条,不是唯一一条。**

⛔ **所以只把 `governance` 一条搬进契约,会造出「1 条在契约、8 条在前端」的分裂** ——
同一类东西分两处维护,**比现状更差**:今天查页签名字只有一个地方,搬完之后有两个,而分界线毫无道理。
**要么 9 条全进,要么一条都别进。** 而 9 条全进是新契约结构加七环链加重验收,**不在本轮范围**。

**而且页签标签与字段标签本来就不同类**:
- **字段标签逐形态可变** —— 所以要 `fields[]` × `fieldRules[shape]` 两块
- **页签标签是常量** —— `governance` 在七个形态里都叫同一个名字

§3.8 契约承载文案的理由是「**前端只展示,不判断展示什么**」,要消灭的是 `if`;
而 `tabLabels[tabKey]` 是一次查表,**没有任何判断**。

**本轮落法**:把 `tabLabels` 里 `governance` 的值从「治理与引用」改成 **「引用关系」**,一个常量。
**那张表仍是页签文案的唯一真相,不新增第二处。**

### ⚠️ 登记欠账:页签文案的契约化(范围是 9 条,不是 1 条)

| 欠什么 | 上述 9 个页签标签**全部**仍在前端常量表里,契约不声明任何页签名称 |
|---|---|
| **何时做** | 与 §3.8「零之补」登记的那 8 个基础字段**同期考虑** —— 都是"该不该进契约"的同一类问题 |
| **不得** | ⛔ **不得只搬其中一条**。要搬就 9 条一起,配 exact-set 门(所有实际 tab key 都在集合内) |
| **收口口径** | 页签标签进 F4「表外还剩多少」那个数,**不计入本轮文案唯一的完成分母** |

**判别性测试**:① 七个形态该页签**仍可见** · ② 页签内**无任何治理字段** ·
③ **`deniedFields` 与 `externalIdentity` 仍正常工作** · ④ `blockingReferences` 在有引用时**非空并指名是谁**。

**第三条是防连带删错的唯一守门** —— 删治理时最容易把同一信封里的另两个一起带走。

**一处 `DEXTER_DECISION`** —— ✅ **已清零,无待裁项。**

**IA 同批修订**:治理删除牵动 IA 的 §5.1 筛选行与左树、§6.1 标题徽章与页签行、§6.2 七行矩阵、
§6.1 只读表达表、`IA-CAT-TAB-008` —— ⚠️ 全文「治理」**32 处**,**不止 §5.1**。

**本工单不授权**下一 Roadmap step、DEV 或数据操作。
遇到"按工单做会打断已发布路径",**停下来报**,不要绕过去实施。
