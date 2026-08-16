# 20 倍底座 · 03 · 六项盘点(后两批的设计输入)

> 先读 `00-总纲-claude.md`。

| 字段 | 值 |
|---|---|
| CP 数 | **6** |
| 性质 | **它们的产物是后两批的设计输入,不是实施动作** |
| 为什么单列一册 | 这六项的分母**全部未知**。第一版给未知分母的批次写了精确 CP 计数,五册全数错 —— 本轮不重犯 |

---

## 0. 盘点产物的验收判据(先说清楚,否则这一册也是自报数字)

**存在性判据不算判据**(项目已有裁定)。「表行数 = 实际断言数」是同义反复 —— 漏登一条,
行数依然等于表里的条数。

⇒ 每份盘点的 PROOF 必须是**可证伪**的:给出一条**独立的、不依赖该表的**交叉校验。
每条 CP 下逐条给出。

---

## CP-INV-1 · E-2 断言盘点

```text
产物      doc/plans/platform/scalable-foundation/INVENTORY-E2-claude.md
覆盖范围  tools/verify-gates/cli.mjs(实测 138 处 fail())
          + apps/backend/**/src/test/java/architecture/**
          + apps/frontend/*/src/tests/architecture/**
每行七列  文件+第X行 | 断言文本 | 声称守的命题 | 实际能抓到什么
          | 反例(能通过但违反命题的写法) | 处置 KEEP/REWRITE/DELETE | 替代证明
FORBID    ⛔ 本 CP 完成前不得删改任何一条断言
          ⛔ 「反例」栏不得留空 —— 写不出「无」以外的东西即该门纸糊
          ⛔ 不得用「存在性 vs 禁止性」二分代替逐条判断:
             精确集合相等、配对断言、确值约束、编译器穷尽性**都是合法形态**
          ⛔ 正判据是「这一对合起来能不能钉死取值」,不是「配对就保留」
PROOF     **交叉校验**:随机抽 10 条 KEEP,逐条构造其反例并实跑 —— 若某条反例真能通过,
          该条处置作废重判。⛔ 不接受「表行数 = 断言数」这类同义反复
```

⚠️ **需求正本记的「218 条 = 169 存在性 + 49 禁止性」本会话复现不出**。
分母以本 CP 为准。

---

## CP-INV-2 · X 组(过度设计)盘点

```text
产物      INVENTORY-X-claude.md
每行      对象 | 声称用途 | 实际消费者(逐个列出,**含测试**)| 零消费者的成因 | 四档处置
四档      ① 删设计(需求本就是想象的)
          ② 删用法留能力(能力真实,这个用法是坏的)
          ③ 删这个但需求走别处(需求真实,由现有机制承接)
          ④ 留概念改实现(概念对,实现坏)
已知对象  contextScopedQueryArgs(33 处)· closedSessionKey(6)· refreshSignal(5)
          · matchesStockView(1)· assertDescriptorSlotBindingSet(5)· OperationsScopeContext(4)
          · generated handler bindings java(12 个文件)
FORBID    ⛔ **零消费者不等于该删**。三种成因必须区分:想象的需求 / 该接没接 / 实现坏了没人敢用
          ⛔ 不得引入 knip 或任何新依赖
          三条已知收窄必须逐条继承:
          ⛔ generated handler bindings **不是只删 Java 文件** —— 生成器、registry/index、
             校验器必须同批,否则留半层契约
          ⛔ descriptor upload —— **资产上传需求是真的**,坏的是 generic descriptor 实现;
             需求由现有资产机制承接,再从**契约声明源向下**删
          ⛔ ProductionTagOwnerService 的 JSON 双实现 —— **测试是隐藏消费者**
          三条第一版漏继承的 ⚠️,本轮补回:
          ⚠️ 删 closedSessionKey 要连带处理 setClosedSessionKey 的副作用(27 个 Drawer 一次 re-render)
          ⚠️ 删 contextScopedQueryArgs 用法时,同批删 commercial-group-boundary.test.mjs 里
             焊死恒等调用的源码断言
          ⚠️ refreshSignal 的 operations 发布线:处置是「删那条线,留原语」
PROOF     **交叉校验**:对每个判「删」的对象,全仓 grep 其标识符并逐个打开命中点确认无活消费者;
          判「留概念改实现」的,给出改后形态的一句话骨架
```

---

## CP-INV-3 · D-3 关系族守卫核查

```text
产物      INVENTORY-D3-claude.md
行        (关系表 × 写入路径)
列        关系表 | 写入路径(文件+方法+第X行)| 父 ref 从哪来(客户端提交/内部派生)
          | 是否有 scope 守卫(**具名到方法与行号**)| 守卫形态 | 有/无
必须覆盖的关系表(12 张,已列举并核实存在)
          catalog_item_category · catalog_composite_group · catalog_composite_component
          · catalog_sku · catalog_sku_attribute_value · catalog_sku_variant_axis
          · catalog_sku_variant_axis_value · catalog_order_option_group
          · catalog_order_option_value · catalog_item_image · catalog_item_reference
          · **catalog_sku_media**
必须覆盖的写入路径(3 类)  常规创建/更新 · copy · promotion
FORBID    ⛔ 不得只查一条路径就对整族下结论
          ⛔ 「有守卫」必须具名到方法与行号,不接受「应该有校验」
          ⛔ 本 CP 内不改任何源码或迁移
PROOF     **交叉校验**:对每个判「有守卫」的路径,构造一个跨 scope 的父 ref 并确认它被拒
          (可在测试里做,不需改生产码)
```

**已知锚点**(供对照,不是结论):`CatalogOwnerService` 第 2899 行 `lockAndValidateCategoryRefs`
排在第 2918 行 `categoryFacts.replace` 之前;`lockCategories` 第 4383-4386 行按
`data_node_ref=? AND brand_ref=?` 查,第 4397 行计数相等,第 4398 行抛 `NOT_FOUND/404`。
⇒ **item 更新路径已设防**。copy(第 1628 行)、promotion(第 4099 行)与其余 11 张表**未验**。

⚠️ **需求正本对 D-3 的门也有缺陷,必须一并登记**:
`tools/verify-gates/cli.mjs` 第 569 行硬编码 7 个 schema
(`platform_iam` / `platform_workspace` / `platform_asset` / `organization` / `extension` /
`workspace_iam` / `contract`),**不含 catalog / inventory / fulfillment_production** ——
即那道门看不见本条要查的表。

---

## CP-INV-4 · P-7 手改点与 emitter 盘点

```text
产物      INVENTORY-P7-claude.md
两张表    ① 43 个 operation 的 contract JSON 现有字段 → 需补字段 → 取值来源
          ② backend-performance 生成器的具名 emitter 逐个标「同形态可参数化 / 专用」
FORBID    ⛔ 同形态边界只确认 count / increase / adjust;updateConfiguration 的 response 不同,
             未证明同形,不纳入
          ⛔ 不得按目录或命名前缀一刀切
PROOF     **交叉校验**:在临时 fixture 里加一条 count-like operation,实际统计需手改的文件集合,
          与表推导的结果比对
```

### ⚠️ 三条第一版的错误事实,本轮更正

1. **参数化 emitter 已经存在。** 第 53 行 `emitInventoryMutation(row, requestType, adapterType, field)`
   就是参数化形态;第 63 / 67 行的 increase / adjust 只是三行委托。
   ⇒ 「引入参数化 emitter」是伪动作。真实残留手改是第 273 行的 `emitters` Map 与 `baseBindingDependencies`。
   ⇒ **目标手改数是 10 不是 9。** 需求正本 G1 判据二的表述须同步更正为「15 → 10」。

2. **markdown 真相链不是四处,至少七处。** 除已知的
   ① 第 97 行 · ② 第 1359/1361 行 · ③ 第 1711-1716 行 · ④ `p1/cli.mjs` 第 671-673 行,
   还有第 **86 / 87 / 89** 行三个 `fileHash(<markdown>)`
   (`REQUIREMENTS_PATH` / `IA_PATH` / `CATEGORY_REMEDIATION_DESIGN_PATH`,定义在第 9 / 10 / 12 行),
   烧进第 415 / 416 / 448-450 / 512-514 / 1145 / 1427-1430 行的生成物;
   第八处在 `apps/backend/catering-business-server/build.gradle.kts` 第 16-21 行
   (四份 markdown 声明为 Gradle task `inputs.files`)。
   ⇒ **「改任一 markdown 生成物逐字节不变」这条判据,在断完 ①②③④ 后仍不成立。**

3. **③ 的三个「消费者」不消费 ③。** `implementationInputs` 全仓**零读取者**;
   `p1/cli.mjs` 第 476 行与 `p2/cli.mjs` 第 42-43 行读的是
   `contracts/policy/catalog-inventory-design-byte-coverage.json` 第 8 行**手工固化**的 `designSha256`。
   ⇒ 真正的绑定源是那个 JSON,不是 manifest。

**⇒ P-7 的范围与判据必须在本盘点后重定,本轮不写它的实施计划。**

---

## CP-INV-5 · P-4 内联块与 `DomainControlKind` 量化

```text
产物      INVENTORY-P4-claude.md
两部分    ① 内联块:位置(文件+行区间)| 内容摘要 | 与哪几处重复 | 是否纯 antd 控件 switch
             | 目标(上提 foundation / 上提 feature 内共享 / 不动)| 涉及的 testId 值
          ② **DomainControlKind 占比量化**:CatalogItemDrawer.tsx 的 5174 行里,
             有多少行是 descriptorRenderer.tsx 第 29 行那 4 个 DomainControlKind 的 slot 实现
FORBID    ⛔ 只上提「纯 antd 控件 switch」;带业务判断、文案、权限或数据依赖的不上提
          两条第一版漏继承的 ⚠️,本轮补回:
          ⚠️ OrganizationExtensionFields.tsx **进不了 foundation**(4 个 App-local import
             + 一个直打 operations 端点的 hook)
          ⚠️ 同目录 OrganizationExtensionFields.test.ts 是相对导入,移动即断
PROOF     **交叉校验**:对每个标「纯控件 switch」的块,确认它不引用任何 App-local 模块
```

### 决策规则(预先写死,量完自动落定,不再回来问)

| 量化结果 | 结论 |
|---|---|
| 4 个 slot 实现 **占 5174 行过半** | `DomainControlKind` 补全是真病根 ⇒ **拉回范围**,B3 认账变重 |
| **不过半** | 需求正本对病因判断错了 ⇒ **如实写出并改判**,`DomainControlKind` 登记 HANDOFF,同时说明 5174 行的真实成因 |

⚠️ 需求正本称它是「唯一真正该补全的」;第一版把它整条丢了(不在 CP、不在不做清单、不在 HANDOFF)。
**不许再丢。**

---

## CP-INV-6 · 跨界 testId 交集盘点

```text
产物      INVENTORY-TESTID-claude.md
三列      testId 值 | 源码出现处(文件+第X行)| spec 出现处
只列**两侧都出现**的(= 跨界),单侧的不列
FORBID    ⛔ 不得把单侧使用的 testId 也常量化 —— 判据是「谁必须达成一致」不是「谁在用」
          ⛔ **必须先写明口径**(是否含 libraries、是否排除 test/spec 目录),
             口径不同得数不同
PROOF     **交叉校验**:改任一跨界 testId 的源码侧值,确认对应 spec 真的失败
```

⚠️ **需求正本的「161 个跨界 testId」复现不出。** 第一版记的 1044 / 12 / 333 三个数**同样复现不出**
(独立复核在不同口径下得到 1061 / 1052 / 1042 / 1077,16 / 9 / 17,353 / 341)。
⇒ 三个数**一并作废**,以本 CP 的口径声明 + 实测为准。
同理第一版记的「跨 feature `model/` import 31 处」也复现不出(真正跨 feature 的是 7 处)。

---

## 4. 本册没有门

盘点不产生行为改变,**不设门**。
每条 CP 的 PROOF 是一条独立的交叉校验,见各条。

⛔ 不得为盘点建「表行数 = X」这类存在性门 —— 那是同义反复,项目已有裁定不算判据。

---

## 5. 盘点完成后要回答的问题

产物齐备后,由 **Dexter** 决定后两批怎么切。本轮不替他决定。

需要他裁的至少有:

1. **P-7 的判据要不要从「< 10」改成「< 11」** —— 因为真实目标是 10 不是 9(见 CP-INV-4)
2. **markdown 真相链的第 86/87/89 行与 `build.gradle.kts` 要不要进范围** —— 不进则
   「生成物对 markdown 不敏感」这条判据永远不成立,须改判据措辞
3. **`DomainControlKind` 按 CP-INV-5 的规则落定后**,B3 的规模
4. **D-3 的门缺陷**(`cli.mjs` 第 569 行硬编码 7 schema)是否本轮修

---

## 6. 本册未验项

- 六份产物**均未产出**,本册只定义格式与判据
- 「138 处 `fail(`」是本会话实测;需求正本的 218 未能复现,**两者都未逐条核对**
- X 组已知对象的计数(33/6/5/1/5/4/12)来自独立核验,**未逐个打开确认语义**
- 全册零编译、零测试、零动态运行
