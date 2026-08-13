# 商品管理前端 IA 符合性评估与一次性整改方案（Claude）

- 性质：只读评估 + 整改需求。未改任何代码;本文件为唯一写入。
- 触发：Dexter 2026-08-13 发现总公司/门店商品管理前端交互与详设差距很大(裸编码/ID、JSON 文本框),而当时"逐控件对账"与各门均绿。
- 评审对象：`apps/frontend/operations-admin/src/features/catalog-management/`,对照 IA(`doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md`,1096 行/197 处 IA-ID)与三阶段详设 §5。

---

## 1. 亲验结论:偏差属实,且是系统性模式,不是零星疏漏

### 1.1 已实锤的三类违反(抽查一个核心文件即命中)

**违反一|描述属性 = JSON 文本框(创建与编辑两处)**

- IA 明文(`IA-CAT-TAB-005`,IA:471/523):属性页签 =「**自由 map 键值表**」「**用户逐项维护**描述属性」;基础资料页签只显示"已维护 N 项"及跳转(IA:467)。
- 实现:`CatalogItemCreateDrawer.tsx:76` 表单项 label 就是「**描述属性(JSON 对象,可选)**」+ `JSON.parse` 校验(:84);编辑态 `CatalogItemDrawer.tsx:216` 同样 `attributesText` 整体 JSON.parse。
- 判定:**这正是 Dexter 看到的"让用户自己填 JSON"。IA 从未批准过该形态。**

**违反二|SKU 矩阵编辑退化为手打编码**

- IA 明文:SKU 页签 =「**维度摘要、SKU 组合矩阵**、识别码、价格、默认与状态」(IA:468);线框图明确「SKU矩阵:**属性组合**|SKU编码(创建校验;创建后只读)|名称|识别码|标准价|默认|状态|图片」(IA:498)——**由规格维度组合驱动生成矩阵**。
- 实现:`CatalogItemDrawer.tsx:692-725` 编辑态是平铺卡片列表,每个 SKU 的「属性值引用」让用户**手打三个裸文本框:属性编码/值编码/值名称**(:714-717),无任何维度驱动、无组合生成、无候选选择。
- 判定:**典型偷工减料**——只读态(`SkuMatrixReadOnly`,:728-733)反而基本符合 IA(维度展示、`NameCodeText`),**编辑态被偷掉了**。

**违反三|裸枚举/编码直显**

- 规范:全局 `NameCodeText` 名码规范(IA:35 `DEC-IA-02`、IA:311「复合主列内部仍必须使用 foundation `NameCodeText`」);IA-STATE-006(IA:193)。
- 实现:只读 SKU 明细 `:732` 直接渲染 `${sku.status}` ——用户看到的是 **`ENABLED`/`ARCHIVED` 英文枚举**(编辑态 Select 却有"启用/停用/归档"中文标签,同一文件内双标准);`NameCodeText` 采用不均(ItemDrawer 8 处,**CreateDrawer 0 处**)。

### 1.2 严重性判断

- **IA 与详设本身质量很好**(197 个 IA-ID、逐 surface 状态分母、v4 live 对照记录)——问题不在设计,在**实现对设计的静默降级**。
- 偏差集中在**编辑态控件形态**:读视图接近 IA、编辑交互走捷径。这与"L2 流程能走通即算过"的激励一致——JSON 文本框同样能让流程绿。
- 本评估只深查了 1.5 个文件即命中三类;`CatalogWorkbenchPage`、四个 Drawer、platform-admin 侧 catalog 未逐控件清点。**真实偏差面必须由整改第一步的全量对账清单给出,本文不预估总数。**
- 后台模型与运行时契约**未见同类问题**:`CatalogManagementPage.test.tsx` 的模型契约测试(envelope 解码、scope fail-closed)是真实的。

---

## 2. 根因:为什么当时全部是绿的

逐个复核当时的"门",每一个都没撒谎,但**没有任何一个的分母里有"控件形态与 IA 一致"**:

| 当时的证据 | 它实际核的 | 它核不到的 |
|---|---|---|
| 逐控件对账 / locator binding exact-set | **testId 存在性**与 scenario ID 分母相等 | JSON 文本框只要带对 testId 就通过 |
| L2 18 definitions / 43 cases | 流程可走通(dirty close、overlay、error focus) | 流程用 JSON 文本框照样走通 |
| `crud-presentation-standard-catalog.json` | 主实体列表名称/编码分列 | 亲验:规则里 **无 NameCodeText 断言、无 JSON 输入禁令**;且复合主列被 IA:310 显式排除出该分母 |
| 前端单测 | 运行时模型契约(真实有效) | 零 UI 内容/交互断言 |
| `frontend-architecture` 门 | 架构边界 | 不看控件 |

**一句话根因:"逐控件对账"对的是控件的"存在",从来不是控件的"形态"。** 这不是某个门假绿,是**这一类事实从未有过守门人**——它属于"业务语义、UI 合理性"象限,按本仓验证分工红线本就该由 fresh 对抗审查承担,而当时的实施 review 接受了结构性证据(testId 齐、L2 绿)充当语义符合性证明。

---

## 3. 一次性整改方案(设计目标:不反复)

反复的根源是"发现一处修一处"。切断它的办法:**先冻结全量差距清单并评审,再一次性修,最后按清单验收**——修复范围在动手前就被双方确认,不存在"修完又发现"。

### P0|全量控件对账清单(只读,不改代码)

Codex 产出逐控件差距表,分母 = IA 的 **89 个 IA-ID**(P3 exit 原有分母,零 orphan 要求不变)展开到控件级,每行:

```text
IA-ID | IA 要求的控件形态(引 IA 行号) | 现状实现(file:line) | 判定 | 处置
判定 ∈ { CONFORM / FORM_DEVIATION(形态偏差) / CONTENT_DEVIATION(名码/文案偏差) / MISSING / EXTRA(IA 外私加) }
```

范围:operations-admin `catalog-management` 全部 surface + platform-admin catalog 侧。**该清单先交独立盲审对抗核验**(抽样复算判定,重点核 CONFORM 行是不是真 CONFORM——防止清单本身再来一次自报),清单冻结后才允许动代码。**已知三类违反必须出现在清单中,缺任一即清单无效。**

### P1|按控件形态契约一次性修复

每个 DEVIATION 的修复目标形态**在清单里就写死**,不留实现自由度。已实锤三类的目标形态:

1. 描述属性 → **键值表格编辑器**(逐行 key/value,增删行,重复 key 校验),创建与编辑同一组件;基础资料页签按 IA:467 只显示"已维护 N 项"+跳转;
2. SKU 编辑 → **规格维度编辑 + 组合生成矩阵**(维度/值定义 → 生成组合行 → 逐行维护编码/识别码/价格/默认/状态/图片;skuCode 创建校验、创建后只读,与 IA:498 一致);属性值引用不再手打编码;
3. 全部枚举展示走**中文标签映射**、全部实体引用展示走 `NameCodeText` 或名称解析——同一字段读/编辑双标准一律拉平。

约束:优先复用 `admin-ui-foundation` 既有能力;修复不得顺手改后台契约(发现契约缺口——如引用名称解析缺字段——单独登记,不混入本包)。

### P2|把"这一类事实"变成有守门人的事实

按验证分工红线拆两半:

- **机械可判的进门(仅两条,新门三问自答:反复发生/纯机械/维护小于返工)**:
  1. `ui/**/*.tsx` 表单提交路径禁止 `JSON.parse`(描述属性类自由 map 必须走结构化编辑器)——纯文本存在性,可红可绿;
  2. 枚举值渲染必须经 label-map 常量(禁止状态字段裸插值进 JSX 文本)——以"状态字段名直出"的机械模式核,允许显式豁免清单。
- **语义符合性不进门、进 review**:控件形态与 IA 一致性列入前端实施 review 的**固定 checklist 维度**(分母=IA-ID),由 fresh 独立盲审执行;**不造关键词 checker 伪装语义**(红线)。

### P3|按清单验收,一次收口

- 差距清单逐行闭合(CONFORM 化),独立盲审对修复后代码**重跑同一张清单**,判定全 CONFORM;
- 两条新机械门绿 + 既有 L2 全绿(修复触及的 case 补交互证明,含"名称非编码"的内容断言);
- 修复触及的每个 operation 若涉后台不动,则四维不需重跑;纯前端包按既有 crud-presentation/L2 门链收口。

### 交付顺序与不反复的保证

```text
P0 清单(Codex) → 独立盲审核清单 → Dexter 过目冻结
→ P1 一次性修复 + P2 两门 → P3 按同一张清单验收(盲审) → 收口
```

不反复的三个机制:**范围先冻结**(修前双方确认同一张表)、**判定不自报**(清单与验收都过独立盲审)、**同类问题以后有守门人**(两条机械门 + review 固定维度)。

---

## 4. 需 Dexter 裁决

1. **整改批次**:catalog 一个 feature 先行(推荐,验证这套流程后再扫其他 feature),还是同轮全量扫 operations-admin + platform-admin 所有 feature?我推荐**catalog 先行**——清单方法验证有效后,其他 feature 复用同一套模板,反而更快。
2. P0 清单冻结是否需要你亲自过目(推荐:盲审核完后你只看 DEVIATION 行,CONFORM 行由盲审背书)。

---

## 5. 授权边界

本文是评估与整改需求,不授权实施。未运行 Testcontainers/DEV/L2/reset/seed/浏览器;引用的 file:line 均为本会话只读亲验。整改包按既有流程:设计→review→实施→review。
