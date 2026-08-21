# 商品属性库、点单选项库与两步新建 · IMPLEMENTATION 独立评审

- 日期:2026-08-20 · 评审:Claude · 会话:续接(非 fresh,已声明)
- 依 `doc/platform/review-standard.md` 收口。**未采信作者 disposition 与上轮旧 finding,全部从当前工作树亲验。**

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/2
L1_ENGINEERING=PASS
L2_USER_VISIBLE=PASS
L3_UNVERIFIED=非空 —— 九屏渲染与交互行为无人验证(未跑浏览器 L2);见 §4
SAME_ROOT_SCAN=见 §3、N-1
DESIGN_GAPS=空
EVIDENCE_TIER=静态源码 + 契约 + 前端 focused(7 个测试文件)+ **真实 backend-acceptance(72/72 REAL PASS,时序已对账)**;⛔ 未跑浏览器 L2 / DEV / seed / reset / UAT
```

---

## 0 · 证据档位与时序对账(先于结论)

| 档位 | 本轮实际 |
|---|---|
| 静态源码 | 全部 finding 均现开源码亲验 |
| 契约 | `selectionMode` enum 实测为 `["SINGLE","MULTIPLE"]`;`FIXED` 契约**零命中** |
| focused | catalog 域 7 个测试文件(含 `catalogDefinitionForm.test.ts`) |
| **真实 backend-acceptance** | `r5-tc-1787230542611-7994`:**discovered 72 / selected 72,business 72×PASS,contract 72×PASS,businessMode 全 REAL,非 PASS 0**;其中 `catalog.*` **23 条**全绿 |
| 浏览器 L2 / DEV / seed / reset / UAT | **未执行**,不作任何声称 |

**时序对账(自算,未采信自报)**:run `startedAt=2026-08-20T12:55:42Z`(本地 21:55:42);
本批八个关键源文件 mtime 最晚为 `21:47:38`(`CatalogDefinitionLibraries.tsx`)——
**全部早于 run**,该 run 覆盖当前工作树。✅

## 1 · L2 用户可见事实(动作 1-A 提取 → 与 IA/交互工件对账)

| 核验点 | 结果 | 证据 |
|---|---|---|
| 商品主面**无顶层 Tab** | ✅ | `CatalogWorkbenchPage.tsx` 中 `<Tabs` **零命中**;残留的 `key:`/`label:` 全属树节点、下拉菜单与列定义 |
| 两个库**只在商品元数据 Modal 内** | ✅ | `CatalogDefinitionLibraries` 全仓**唯一消费者**是 `CatalogDictionaryDrawer.tsx:36,732` |
| 与四类字典**并列** | ✅ | Modal tabs = 商品标签/销售单位/SKU 销售属性/商品处理标签 + **商品属性库/点单选项库** |
| 动态原料**按当前可选项归属** | ✅ | `CatalogDefinitionLibraries.tsx:396` `Form.List name="values"` 内嵌 `:403` `Form.List name={[field.name,'materials']}` —— 原料挂在**每个可选项索引下**,结构上不可能跨值混排 |
| 原料**多行不丢失** | ✅ | 同处 `addMaterial`/`removeMaterial` 支持多行;`:404` 空态「不扣原料可留空」 |
| 点单选项路径**无 FIXED** | ✅ | `OrderOptionConfigurationsEditor`(`:4687`)只处理 SINGLE/MULTIPLE;契约 enum 恰两值 |
| `MULTIPLE max=1` **仍显示多选** | ✅ | `:4778`/`:4835` 逐字 `多选${maxSelectionCount === 1 ? '（最多 1 项）' : ''}` |
| min/max **仅 MULTIPLE 时出现且在商品侧** | ✅ | `:4781` 条件渲染;`:4783/4785`「最少可选」「最多可选」;`:706-707` 非 MULTIPLE 时置 null |
| **旧自由 JSON 生产路径已清除** | ✅ | `attributesText` / `parseAttributes` 前端**零命中**(排除测试) |
| **商品内新建/改名组选项已清除** | ✅ | 相关关键词零命中 |
| RTK **精确 detail 失效** | ✅ | `catalog-inventory-edge.rtk.ts:117-119` 用 `requestPath`/`responsePath`/`responseArrayValue` 三类 tag,含 `catalog-item-detail` 与 `catalog-item-code` 前缀,**非全局失效** |

### ⚠️ 我撤回一条误报

我最初在 `CatalogItemDrawer.tsx:4241,4297` 发现 `selectionRule: 'FIXED'` 与可选项「固定包含」,
一度判为「FIXED 未清除」。**打开上下文后不成立** ——
那是 `catalog-item-composite-groups-editor`(**套餐组件**编辑器,Alert 写着「在此设置套餐组件」),
字段名是 `selectionRule`,与点单选项的 `selectionMode` 是**两个域两个字段**。
Dexter 的裁定 `FR-OPT-02` 针对的是**点单选项**方式,套餐组合不在其内。**该 finding 撤回。**

## 2 · L1 工程不变量

| 核验点 | 结果 | 证据 |
|---|---|---|
| **StockTarget 前置门只在建库** | ✅ | `CatalogInventoryCoordinator.java:791` 附近保存路径只取已解析的 `stockTargetRef`,并留有自证注释:「**No item or stock readiness is inferred here: material target was resolved at definition save.**」 |
| copy **hard block 不可确认** | ✅ | `CatalogOwnerService.java:2031-2032` `blockingCount = blocking?1:0` 与 `confirmationRequiredCount = blocking?0:1` **互斥**;`:2083` 产出 `BLOCKED` |
| 删除级联三条路径 | ✅ | acceptance 三条独立场景全绿:`attribute-definition-delete-cascade` · `order-option-definition-delete-cascade` · `order-option-definition-value-delete-cascade` |
| 跨 owner 事务与 BOM 映射 | ✅ | coordinator 内 `deleteCatalogOptionValueBoms` 等公开 command 调用;空 rows 时走删除分支而非留空行 |
| FIXED 拒绝 | ✅ | acceptance `catalog.fixed-selection-rejected` PASS |
| min/max 与 max=1 | ✅ | acceptance `catalog.option-selection-mode-and-range` PASS |
| 500/501 有界读取 | ✅ | acceptance `catalog.definition-list-limit` 与 `order-option-definition-list-limit` 双双 PASS |

## 3 · 同族全集扫描

| 形态 | 全集与判定 |
|---|---|
| `FIXED` 出现处 | 全仓前端 2 处,**均属套餐组件域**(非本批范围);点单选项域 0 处;契约 0 处 ⇒ **无遗漏** |
| `CatalogDefinitionLibraries` 消费者 | 全仓 1 处(元数据 Modal)⇒ **无第二入口** |
| 旧自由 JSON 入口 | `attributesText`/`parseAttributes` 全仓 0 处(排除测试)⇒ **清除彻底** |
| 顶层 Tab | `<Tabs` 在工作台 0 处 ⇒ **删除彻底** |
| 级联路径 | 设计声明 3 条,acceptance 覆盖 3 条 ⇒ **1:1 对齐** |

## N-1 · 九屏无组件测试,与上一批的同族问题相同(但本批分母更好)

**事实**:`catalog-management` 下 focused 测试 **7 个**,但其中 **6 个在 `model/`**,
`ui/` 只有 1 个(`CatalogManagementPage.test.tsx`)。
本批新增/改造的九屏 —— 定义库 Modal 内两屏、商品属性页、点单选项三栏、首步 Modal 等 ——
**没有针对性的组件测试**。

**与上批的差别(应予肯定)**:上一批 `business-channel` 是 `ui/` **零测试**;
本批至少有 `catalogDefinitionForm.test.ts` 覆盖了定义表单的模型层,分母更好。

**同族扫描**:`operations-admin` 全部 feature 的 `ui/*.test.*` —— catalog-management 1 个,
business-channel 0 个(上批 M-1 未闭),其余 feature 待另行盘点。
⇒ **这是跨批次的既有欠账,不是本批新增**,故记 N 不记 M。

**最小修复**:为「首列/首步 Modal 四字段/三栏不混排/max=1 显示多选」四条加组件测试。
**可复验反例**:把 `多选（最多 1 项）` 改回 `单选` ⇒ 测试须转红。
**不需 Dexter 裁决。**

## N-2 · preflight 污染根因的修复留痕不足以独立复验

Dexter 点名「三次失败后通过结构化日志定位并修复的 preflight 污染根因」。
我在 `CatalogOwnerService.java` 的 preflight 路径(`:1282`/`:1295`/`:1332`/`:1347`)**看到了
重跑 preflight 与 digest 的结构**,acceptance 两条 copy 场景也全绿;
但**「污染」的具体根因与修复点在源码中无注释留痕**,disposition 文件(3373 字节)我按要求未采信。

⇒ **我能确认结果正确(场景全绿、blockingCount/confirmationRequiredCount 互斥),
但无法独立复验「根因是什么、修在哪一行」。** 标 `UNVERIFIED_REQUIRES_EVIDENCE`。

**最小修复**:在修复点加一行注释说明该处曾发生的污染形态,
或在交付里指出精确行号 —— 使下一位评审者可独立复验。**不需 Dexter 裁决。**

## 4 · L3 未验证清单(非空 ⇒ `GO_WITH_UNVERIFIED_UI`)

| 用户可见事实 | 静态已证 | 测试已证 | **无人验证** |
|---|---|---|---|
| 元数据 Modal 内两个库的实际渲染与切换 | ✅ | ❌ | ⚠️ |
| 定义库三栏/嵌套 Form.List 在真机的表现 | ✅ | ❌ | ⚠️ |
| 首步 Modal → Drawer 的点击衔接 | ✅ | ❌ | ⚠️ |
| 九屏容器宽高、不溢出视口、唯一滚动容器 | ✅(IA/交互工件写全) | ❌ | ⚠️ |
| 1280px 以下三栏与嵌套原料表的实际表现 | ✅(有红例描述) | ❌ | ⚠️ |
| 501 时前端呈现的业务错误文案 | ✅ | acceptance 覆盖**后端** | ⚠️ **前端呈现** |

**用产品所有者能据以决策的话说**:
**上面六类只存在于代码与文档里,没有任何人或测试确认过界面真的会那样表现。**
后端行为有 72/72 真实 HTTP 验收背书,**前端渲染与交互没有**。
本轮未授权浏览器 L2,故这是**已知且被接受的边界**;Dexter 将是第一个看到这些界面的人。

## 结论

**GO_WITH_UNVERIFIED_UI · M=0 · S=0 · N=2。**

零 M 零 S:最新 UI 裁定(删顶层 Tab、两库移入元数据 Modal)**已正确落地且唯一入口**;
旧自由 JSON 与商品内定义编辑**清除彻底**;点单选项域**无 FIXED**;`max=1` 仍为多选;
原料按可选项嵌套归属、多行可增删;RTK 精确失效;StockTarget 门只在建库并有自证注释;
copy hard block 互斥计数;三条级联路径 1:1 覆盖;**72/72 真实 acceptance 全绿且时序对账通过**。

两条 N 都不阻断:组件测试欠账是跨批既有问题(本批分母反而优于上批);
preflight 根因结果正确但留痕不足以独立复验。

**授权边界**:本轮仅独立 IMPLEMENTATION 评审。
未执行代码、契约、数据库、测试、数据、DEV、seed、reset、浏览器 L2、UAT、发布或任何仓库控制动作。
本结论不授权上述任何动作。
