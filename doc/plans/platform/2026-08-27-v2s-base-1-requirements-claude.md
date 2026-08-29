# base-1 整体重构 · 需求

- 作者:Claude · 2026-08-27
- 附件:`doc/plans/platform/2026-08-27-v2s-base-1-appendix-cascade-and-members-claude.md` —— 级联关系分母与装配成员矩阵;**需求稿转 GO、形成实施面设计或开始任何实施之前必须完成签入**
- 前身:`2026-08-26-v2s-base-1-overall-refactor-requirements-claude.md` 与 `2026-08-26-v2s-owner-contract-governance-analysis-claude.md`。**那两份是从 catalog 症状往上砌的,出发点错了,已作废为分析留痕。** 本文从原则出发重写。

## 0. 核心思想

Dexter 2026-08-27 原话,三句,后面全部由它推出:

> **后端只返回业务事实。**
> **前端根据事实自己想怎么展示就怎么展示。**
> **如果多个前端展示一个事实,就必须用一个接口。**

今天的接口三句都违背:后端把多个事实拼成字符串返回,前端只能原样打印;同一批事实被按屏切成多个接口,各返回各的形状。于是**表达一变,契约、后台、测试、seed 全线跟改** —— 这是"改一个展示要好几天"的唯一成因。

三句各自的推论:

| 原话 | 推论 | 本文对应 |
| --- | --- | --- |
| 后端只返回业务事实 | 不得装配字符串;不得替前端翻译代码定义的枚举;前端算得出来的不许后台算 | §1.1、§1.2、§2 |
| 前端自己决定展示 | 名称还是编码、排版、截断、空值话术、分隔符、顺序,全归前端;**代码定义的闭集由前端建字典** | §1.2、§2.3 |
| 一个事实一个接口 | 同一批事实不得因消费方不同而拆成多个接口;**不同的事实本来就该是不同接口** | §5 收敛 |

base-1 就是把这三句落地,外加 Dexter 同期裁定的第二条原则:**主数据生命周期全平台统一三态**。

catalog 是违背最严重的一处,但**不是唯一一处**,因此本文按**域**组织,不按 catalog 案例组织。

### 0.1 第一句的例外 · 时点快照本身是事实

**Dexter 2026-08-27 裁定:认。**

当一个事实的业务含义**要求它在写入时被冻结**,owner 必须冻结并返回该快照。这不是替前端表达,**"当时的措辞"本身就是事实**。

语料库已有背书:G-04 明写「合同保存名称快照…**改名不回写历史合同**」。

实例:`actorDisplayName` 的落库列是 `actor_display_snapshot VARCHAR(160) NOT NULL`,写入时冻结,且 wire 里**没有 `actorRef`** —— 前端无 ref 可解,也不该解。若把它退役交还前端,改个名或删个号,同一条历史记录就会显示成另一个人。合同的 `phase_name_snapshot`、商品的 `externalIdentity.snapshot` 同理。

**判据**:这个字段是"当前值的一次渲染",还是"某个时点被固定下来的值"?前者归前端,后者是事实、留在后台。

### 0.2 第三句的一处限定

"一个事实一个接口"有一处不适用,且这处由更硬的约束决定:**当"谁能看这批事实"本身由接口身份承载时,不得合并。**

实测 21 个 operation 带 `noClientDerivedAuthorization: true` 与 `serverDerivedTarget: "STATIC_OPERATION_CAPABILITY"`;IA-05 §32 明定"五类用户页的目标来自已批准的 operation/capability 绑定,而非用户提交的机构"。合并成一个带 `targetType` 请求字段的接口,等于让授权目标由客户端提交决定。

判据:**去掉这个维度后,授权判定会不会变得依赖请求体?** 会 ⇒ 保留分立;不会 ⇒ 必须合并。

## 1. 判据

### 1.1 后台不得装配字符串

**Dexter 2026-08-26 原话:后台做字符串拼装,这些都是不对的。** 判据与语言无关、与分隔符无关:

> **凡由两个以上事实拼接、连接或格式化而成的字符串,不得作为业务事实返回。**

事实各自返回,拼不拼、怎么拼、拼给谁看,是前端的事。

**装配发生在哪一层都算,判据只看"这个响应字段的值是不是拼出来的"。** 实测装配三层,漏掉任一层就等于没判据:

| 层 | 形态 | 实例 |
| --- | --- | --- |
| Java | `+` / `String.join` / `String.format` / `StringBuilder` | `"生产标签：" + productionTagName`;`region.code() + " " + region.name() + " / " + …` |
| **Stream** | `Collectors.joining` / `.reduce((a,b) -> a + sep + b)` | `PlatformContractOverviewController` 的 `itemSummary`;`PlatformWorkspaceInvitationTaskReadService` 第 93 行与 `WorkspaceInvitationService` 第 1203 行的 `.reduce((first, second) -> first + " ; " + second)` → `invitationPageUrl` 一族。⚠️ **同文件第 1424 行的 `.reduce` 不在分母内** —— 它位于 `canonical(String operation, Object... values)`,用于排序并序列化 request/幂等复合键,**不是用户可见 read model**,按 §1.7 豁免;按装配整改它会破坏 request canonicalization 与幂等 replay |
| **SQL** | `\|\|` / `string_agg` / `concat` / `format` | `commercial_group_name \|\| '（' \|\| commercial_group_code \|\| '）' AS node_display_path`(**全角括号的「名称(编码)」**);`string_agg(code \|\| ' ' \|\| name, ' / ' ORDER BY depth DESC)` |

⚠️ **本文前几版连着漏掉两层**:先只按 Java 的 `+` 划范围漏掉 SQL 层,后又漏掉 Stream 层(`Collectors.joining` 与 `reduce` lambda)。**静态 enum mapper 不算装配**,不要把它当成第四种机制。前几版还写过"~~workspace/iam:0 处装配~~ **该结论已作废**:实测该域有 `.reduce` 展示装配两处(见 §1.1 与附件)",实测该域有三处 `reduce` 装配,该结论已作废。原文如下:**本文前几版只按 Java 层划范围,连着三次漏掉 SQL 层的装配** —— 而 SQL 层恰好藏着 Dexter 点名的「名称(编码)」形态。任何只扫 Java 的门,对 `CollaborationOwnerService` 与 `OrganizationAssignmentCandidateService` **全绿**。

**三处例外**:§0.1 时点快照、§1.5 安全与隐私脱敏、§1.7 非人读的复合串。另有错误消息在原则内但不在 base-1 范围(§1.6)。

### 1.2 什么该后台算:能算 / 不能算

> **前端拿到完整模型后自己能算出来的,后台不许算;必须依赖模型之外的数据才能算的,后台必须算,并以结构化事实返回(数字、布尔、枚举码、结构),不得是句子。**

- 「各规格制作内容不同」→ 各规格 profile 都在返回里 → 前端算 → 后台删掉
- 「仍有 3 个商品引用」→ 依赖全局引用计数 → 后台给 `{canDelete:false, blockingReferenceCount:3}`,**句子归前端**

### 1.3 聚合事实是 owner 拥有的结构化事实,不是装配例外

> **归类更正**:此前把本条写成"§1.1 的例外",分类错了。`accountCount`、`roleCount` 这类依赖当前响应之外数据的事实,**本来就是 owner 拥有的业务事实**,不是"装配的例外" —— 它们与时点快照、安全脱敏、非人读复合串三处**真例外**不属同一层。删掉它们不是"少拼一次",是**丢事实**。

**这一条是判据,不是清单。** 判据:

> **该事实是否依赖"本次响应之外"的数据才能算出?** 是 ⇒ owner 必须算并以结构化形式返回;否 ⇒ 归前端。

下面是**已知实例,非穷尽**。⚠️ **不得反读成"清单外的都可以删"** —— 实测清单外同类的至少还有 `accountCount`/`roleCount`、inventory 的 `entryCount`/`increase`/`decrease`/`netChange`、复制预检的 `blockingCount`/`confirmationRequiredCount`/`selectedCount`/`selectedLimit`、`bomLineCount`,其中多个在契约里是 `required`。判据能判它们该留,清单判不了:

导航树各节点商品计数、全部商品计数、未分类计数、分类被引用计数、商品规格三计数(`skuEnabledCount / skuTotalCount / skuNonArchivedCount`)、生产标签 `linkedProductCount`、单位 `isReferenced`、`hasSkuChildren`、分类候选的 `hasChildren`(懒展开树,未展开节点是否有子节点)、复制预检的 `closureCount + closureLimit`、临时商品转正的 `formalCodeAvailable`。

**仓内已有两个正确样板,照抄即可**:

- `skuSummary: {enabledCount, nonArchivedCount, totalCount, dimensions}` —— 前端自己拼「规格数量」
- `deletionAvailability: {canDelete, blockingReferenceCount}` —— 前端自己写「仍有 N 个商品引用」

### 1.4 裁剪的正确对象是集合,不是字段

无界关联(流水、日志、可无限递归的关系)与被显式裁定的懒加载子集合(如商品的规格子行)走自己的分页。**这是集合语义,不是字段裁剪。** 无参调用必须返回全部非无界事实;参数只能"减",不能"揭示"。

### 1.5 安全与隐私脱敏是后端职责,不是违背

**这是判据的第三处例外,由 Codex review 指出,已亲验。**

`platform_iam.platform_admin` 有 `mobile_mask_source` 列;`PlatformWorkspaceAccountTaskReadService` 第 96 行 `mask(row.mobile())`。**手机号这类 PII,后端必须控制"安全可展示值"与"原始值是否暴露"的边界** —— 按 §0 第一句字面执行(返回原始值、前端自己遮盖)会造成敏感数据暴露。

**判据**:这个值的**完整形态是否受访问控制**?是 ⇒ 由后端决定可展示形态,前端不得要求原始值;否 ⇒ 归前端。

脱敏与装配的区别:装配是把多个事实压成一个串(前端本可自己拼),脱敏是**故意不给全**(前端拿不到也不该拿到)。

### 1.6 错误消息:在原则内,不在 base-1 范围内

上面 37 行里有相当一部分是 `Problem(...)` 的错误文案。按 §0 第一句,**它们同样是后台在写用户可见文字**,前端规范 §3-D 的仓内正例(按生成的 problem code 闭集做全量文案覆盖、漏一个即编译错误)也指向"后台给码、前端写话"。

**但本批不做。** `CatalogOwnerService` 一个文件就有 334 处 typed problem,纳入会让 base-1 膨胀到无法小批交付。**登记为 base-1 之后的独立批次**,判据相同。

### 1.7 非人读的复合串不在判据内

游标、幂等键、缓存键、`generation`、SQL 占位符这类**不给人看**的复合串,不是业务事实的表达,不在 §1.1 内。实例:`OpaqueCollectionCursor.encode(...)` → `cursor`;`dataNodeRef + ":" + brandRef` → `generation`;`String.join(",", nCopies(n, "?"))` → SQL 占位符。

**判据**:这个串会不会出现在用户眼前?不会 ⇒ 不在判据内。

## 2. 全平台现状

违背有三种形态,分布完全不同。以下均为本轮实测(两个源码根:`modules/` 210 个 java + `src/main/java/` 416 个)。

### 2.1 形态一 · 句子装配

**37 行 / 11 个文件**(此前各版写"29 处、跨两个文件",偏低)。 `"生产标签：" + name`、`"规格维度：" + dimension`、`"预计制作时长：" + n + " 秒"`、`name + "：" + (value.isBlank() ? "未设置" : value)`;另有 `appendVoidBlockingReason(reasons, "已设置生产标签", …)` 一族把中文标签写进 `voidAvailability.blockingReasons[].label`。

分布:`CatalogOwnerService` 20、`CatalogItemDefinitionFacts` 5、`CatalogInventoryCoordinator` 3、`CatalogPreparationFacts` 2,另有 `CatalogSkuFacts` / `CatalogDefinitionFacts` / `CatalogSkuVariantAxisFacts` / **`InventoryOwnerService`** 各 1 —— **不止 catalog**。

⚠️ **工具纪律**:本机 `LANG=""`(`LC_CTYPE=C`),BSD `grep -E '[一-鿿]'` 对 CJK **静默返回 0 命中**。本文早前各版的 CJK 计数全部因此偏低,现已改用 locale 无关的扫描重算。**任何用 BSD grep 做的中文"实测"都不可信。**

### 2.2 形态二 · 分隔符装配(不含中文,最难扫到)

**organization,18 处,5 个文件。** `OrganizationTaskPathService` 装配组织面包屑:

```
region.code() + " " + region.name() + " / " + target.code() + " " + target.name()
project.taskPath().displayPath() + " / " + store.code() + " " + store.name()
```

落进契约的 `path` / `organizationPath` 字段。**分隔符、节点内分隔、编码在前名称在后,三个表达决定全在后台。** 前端要改成只显示名称、或「名称(编码)」、或每段可点的面包屑,都得改后台。

目标形态:`path: [{nodeRef, code, name, nodeType}]`,怎么连由前端定。

### 2.3 形态三 · 逐记录枚举翻译

**41 个 `*DisplayName` / `*Label` / `*Summary` 字段,跨 8 个域**:catalog 13、collaboration 12、business-channel 8、common 2、inventory 2、workspace-iam 2、contract 1、platform-iam 1。

`operatorKindDisplayName`、`authenticationKindDisplayName`、`bindingStatusDisplayName` 这类,是**枚举到中文的逐记录翻译**——一个三值枚举在 20 行列表里被翻译并传输 20 遍。

**根因已定位:枚举词汇表只有 catalog 有。** 全域扫描,`ShapeManifest` / `enumLabels` 只在 catalog 命中。catalog 的前端能调 `catalogEnumLabel(manifest, …)` 自己翻译;**其它域的前端根本拿不到词汇表**,后台只能逐记录塞中文。

**修法按 Dexter 2026-08-27 判据**:

> 建立前端字典唯一的标准是 —— **后端有明确的代码支撑、不是业务自定义的**,这种前端就需要建字典。

因此 41 个字段按来源分四类,只有第一类才是"建字典"的对象:

| 类 | 数量 | 处置 |
| --- | --- | --- |
| **代码定义的闭集** | **13**(business-channel 7、collaboration 6) | **前端建字典**,后端删字段;**响应契约先补 enum** |
| **实体名字**(`bindingDisplayName`、`externalSystemDisplayName`、`productionDisplayName` 等) | 若干 | 业务自定义 → **后端返实体,不是病** |
| **装配产物**(`categoryPathLabels`、`blockingReferenceLabels`、`relationLabel` 等) | 若干 | 按形态一/二删装配,与字典无关 |
| **时点快照**(`actorDisplayName`) | 2 | **§0.1 例外,保留** |

**⚠️ 判据不是「契约里有 enum」,是「后端有代码支撑」。** 二者实测不等价,且差异正是病根:

```
enum         BusinessChannelTemplateCreateRequest/properties/operatorKind
type=string  BusinessChannelTemplateView/properties/operatorKind
```

同一个概念,**写请求时是闭集、读响应时是裸 `string`**。`accessKind`、`dineInForm`、`orderKind`、`ownerNodeType`、`capabilityClass` 同型。后端知道值域(请求侧的 enum 就是证据)却在响应里不告诉前端,前端拿不到联合类型,只好由后端改送 `*DisplayName` —— **这批字段就是这么来的**。

**Dexter 2026-08-27 裁定:统一都用 enum。** 落成两件事:

1. **响应契约补 enum**(值直接取请求侧现成的字面量,是复制不是新造)。前端生成类型随之变成联合类型,字典获得**编译期穷尽性** —— 后端新增枚举值,前端编译不过直到补上文案。这是白送的一道门,比任何 checker 都硬。
2. 升为通则,已写进后台编码规范 **1-O**;`nodeTypeDisplayName`(collaboration 的 `nodeType`,节点类型是代码闭集)按此判据补入,成员数 12 → 13。

⚠️ **补 enum 时必须同步取齐三值。** 实测 `CatalogItemDetail.status` / `CatalogUnitList.status` 是两值 `('ENABLED','DISABLED')`,而 `CatalogDictionaryQuery.status` 已是三值。三态改完后若响应 enum 仍是两值,owner 会返回一个不在自己 enum 里的值。

**字典在前端,后端不建接口。** 这些标签是代码定义的静态闭集(catalog 的 `enumLabels` 在 `p1.mjs` 里就是字面量),不随租户品牌变化,前端自己持有即可 —— 因此**没有"先建后退役"的顺序约束**。

⚠️ 第二、三类是按字段名启发式分的,实施前须逐个打开确认。

这也说明 `project-memory/practices/external-collaboration-readback-display-and-detail-surface.md` 要求 owner 提供 `*DisplayName` 并不是写错——**在没有词汇表的前提下那是当时唯一可行的做法**。冲突的解法是补词汇表,不是判它违规。

### 2.3.1 contract 域(Codex review 补入,已亲验)

`app/edge/platform/contract/PlatformContractOverviewController` 两处形态,**此前各版完全没有覆盖 contract 域**:

- 第 131、159 行 `value.phaseName() == null ? "未设置" : value.phaseName()` —— **后端替前端决定了空值话术**
- 第 146、174 行 `.collect(Collectors.joining(", "))` 产出 `itemSummary`,**而同一接口已经返回结构化 items**

**由此装配判据要补第三种机制**:`+` / `String.join` / `String.format` / `StringBuilder`(Java)、`||` / `string_agg` / `concat` / `format`(SQL)、以及 **`Collectors.joining` 这类流式收集器**。同时,**硬编码空值 fallback(三元 + 字面量)与装配是两种病,必须分别处置** —— 只删 `Collectors.joining` 不动 `"未设置"`,表达决定仍在后台。

### 2.4 不构成违背的

- inventory 的 2 处 `+` 是幂等键与缓存键
- catalog 的 67 处 `String.join` 与多数 `+` 是 SQL 占位符生成(`String.join(",", nCopies(n,"?"))`)
- ~~workspace/iam:0 处装配~~ **该结论已作废**:实测该域有 `.reduce` 展示装配两处(见 §1.1 与附件)
> ⚠️ **本节前几版有一条错误结论:「名称(编码)后台不拼」。已删除。** 后台**在 SQL 里拼**,而且就是全角括号的那个形态 —— `CollaborationOwnerService` 的 `commercial_group_name || '（' || commercial_group_code || '）' AS node_display_path`。前端 foundation 确有 `NameCodeText` 统一控件,但它拦不住后台已经拼好一份。

**因此形态二的分布要扩:不只 organization 的 Java 层,还有 collaboration 与 organization 的 SQL 层。** `CollaborationOwnerService`(`node_display_name` / `node_display_path`)、`OrganizationAssignmentCandidateService`(`display_path` / `project_path`)、`OrganizationHierarchyService` 均有 `||` 或 `string_agg` 装配,落进契约的 `nodeDisplayPath` 等字段。

### 2.5 改造成本按事实来源分三档

| 档 | 目标 | 依据 | 代价 |
| --- | --- | --- | --- |
| 甲 · 查回后丢弃 | 制作信息、生产标签实体 | 拼装方法的入参就是结构化对象;`ProductionTagReferenceReadback` 已带 `tagRef/code/name/status`,读侧只取 `.name()` | 删掉拼装,**净删代码** |
| 乙 · 在表里但未 SELECT | 标签实体 | SQL 是 `SELECT relation.item_ref, entry.name` | 同一 JOIN 多选几列,不增往返,**净增代码** |
| 乙′ · 结构需重做 | 分类路径实体 | 递归 CTE 累加器是 `ARRAY[category.name]::text[]`,祖先被折叠成 text 数组的**行**而非列 | 累加器换 `jsonb`,Java 侧 `java.sql.Array` 解析同改。**不是"多选两列"** |
| 待实测 | 规格维度实体 | 源码注释明写"故意不加载 axis 关系以避免第二次分页查询" | **可能增加一次查询,先实测再定** |

**统一结论:不增加数据库往返,不需要任何数据库迁移,只有甲档是净删代码。**

> **曾经有过一个"丙档:属性选项要加 `code` 列 + 回填"** —— 已删除。实测契约里 `options` 的 `required` 就是 `["optionRef","name","displayOrder"]`,前端类型也只有 `{optionRef, name}`;**属性选项从来没有编码这个概念**,有 `code` 的是父表属性定义。那一档是"先自己发明目标形态里要有 code,再为这个发明设计迁移"。**教训:不能凭对称性想当然发明字段。**

⚠️ **但"从契约与前端消费反推"这个说法要收窄**:契约与当前前端消费**只能用来证伪**(证明某个字段是凭空发明的,或某个事实被遗漏),**不能用来正向决定 owner 的目标模型** —— 否则就变成了按当前页面塑造 owner,正是 §0 要推翻的那件事。owner 目标模型的来源是**业务身份与已批准的业务事实**。

## 3. 第二条原则 · 生命周期统一三态

Dexter 2026-08-26 裁定,适用所有域。

| 用户可见 | 存储值 | 列表 | 关联选择框 | 编码 |
| --- | --- | --- | --- | --- |
| 启用 | `ENABLED` | 可见 | 可见可选 | 占用 |
| 停用 | `DISABLED` | **可见**(否则无法启用回来) | 不可见不可选 | 占用 |
| 标记删除 | `VOIDED` | 不可见 | 不可见不可选 | **释放** |

**裁定清单**:1 定义库一律 `transitionStatus`;2 物理删除完全取消;3 只有三态;4 三态语义如上;5 适用所有域;6 去掉 `DRAFT`(新建落停用);7 去掉 `ARCHIVED`(并入已删除);8 存储值不改名;9 **停用可以改**;10 `business_channel` 纳入;11 本轮不动 `platform_admin`/`group_workspace`/`collaboration.*_enablement`/品牌授权解绑;12 **`ARCHIVED` 不恢复旧语义,统一并入 `VOIDED` 并释放编码**(主动废止 `V20260815_010000_000`/`V20260816_020000_000` 注释里"ARCHIVED 保持占码可见"的设计声明);13 **停用阻断新建合同、邀请、渠道绑定、菜单发布**(改写语料库 G-08 该段的"待裁决");14 **去掉 backend-acceptance 的 80 条上限**;15 **`catalog_composite_component` 的 `ARCHIVED` 是死值,直接清除、不作为例外**(实测前端只给启用/停用两个选项、owner 侧零命中,但生产查询仍有排除语义,清除前须处置);16 **邀请遇到已停用账号:拒绝并返回 typed problem**,创建与完成两处都拒;17 **接口数量收敛到一处维护**,保留"接口集变动必须显式确认"这道闸,预算值仍须实测;18 **级联不落库,各维度状态各自作为事实返回**,`business_channel.stop_reasons` 整个去除,⛔ 不得合并成 `effectiveStatus` 这类单值;19 **邀请拒绝的 typed problem 定为 `ACCOUNT_NOT_BINDABLE` + 422**,与 `PRODUCTION_TAG_NOT_BINDABLE` 对称;20 **readiness 的 `accountExists` 由布尔改为四态枚举** `ABSENT / ENABLED / DISABLED / VOIDED`。

**另有一条按语料库既有裁定处理、不另立新编号**:总公司**不是**门店的阻断维度 —— 依据 G-03「总公司不干涉门店经营」,且 `store.head_company_id` 实测可空(G-03 明写门店可选关联 0..1 个总公司)。总公司停用只影响总公司自己那条 IAM 访问链,仍作为一个维度事实返回。

### 3.0 裁定 2 的适用面与不适用面(重写时丢失,现恢复)

适用:**业务实体的物理删除**。不适用:**为表达"集合被编辑"而删行的 SQL**。

owner 主源码共 **40 条** `DELETE FROM`,绝大多数属后者 —— `catalog_item_reference`、`catalog_item_attribute_selection`、`catalog_item_attribute_assignment`、`catalog_composite_component`、`catalog_order_option_definition_value`、`catalog_item_order_option_value_override`、各 `*_rate_limit_bucket` 等,都是整组删掉重插或过期清理。**这些不在裁定范围内,不得改动。**

**而且它们物理上无法软删。** 这些子表的唯一约束形如 `UNIQUE (attribute_definition_ref, display_order)`、`UNIQUE (composite_group_ref, display_order)` —— **一行 `VOIDED` 仍然占着它的 `display_order` 槽位**,重排组件必然撞唯一约束。按字面执行裁定 2 是确定失败,不是边界模糊。

### 3.1 配套规则

**既有引用豁免**:保存时只对**本次新增或改变**的引用校验"必须启用",未变更的既有引用一律放行。不这样做,任何引用了停用定义的对象都会变成不可保存。

**「停用可以改」的三处不适用**:已删除件不可编辑;引用校验不是编辑校验(停用件不得被**新**引用选中);业务锁定字段与状态无关。

**编码释放靠 partial index**:`scope + code` 唯一约束必须排除 `VOIDED`。由此 **`code` 不是稳定业务标识,`ref` 才是**;对外传输、导出、跨系统对账不得以 `code` 为身份。删除是终态且释放编码,误删不可撤销,因此删除确认必须给出引用数。

**不适用三态的**:邀请、OTP、会话、任职(G-07:撤销即终态,重授需新邀请)、合同有效性(G-09:存在性衍生状态)、资产上传流程。判据是**能不能由人手动在两个状态间来回切**。

## 3.2 第三条原则 · 级联不落库,各维度状态各自作为事实返回

**Dexter 2026-08-27 裁定。** 起因是渠道的 `stop_reasons`,但问题是**全平台**的。

### 规则

> **对象只存自身状态。owner 读时把每个相关维度的状态各自作为事实返回,⛔ 不合并成一个值。哪些维度的哪种组合允许做什么,由应用场景决定。**

**Dexter 2026-08-27 原话**:一个对象可以有很多个维度的状态,每个维度都是事实都不能丢;至于不同维度状态组合能做什么事情,那是应用场景要考虑的,**但是不要把多个维度的状态合并成一个**。

#### 这条推翻了本节初稿的公式

初稿写「有效可用性 = 自身状态 ∧ 全部祖先的有效状态」,**那正是把多个维度合并成一个**。合并成一个布尔之后,「是自己停用了、还是模板停用了、还是 external system 停用了、还是 binding 被撤销了」四个事实**全部丢失**,只剩一个「不可用」。前端拿到它既写不出准确的话,也无法引导用户去修对的那个地方。

**⛔ 不得引入 `effectiveStatus` 这类单值字段。**

#### 正确形态

渠道的读模型返回的是**一组并列的事实**:

- 自身状态
- 所引用模板的状态
- 模板所属项目的状态
- 渠道目标节点(项目或门店)的状态
- external system 与 provider profile 的状态
- collaboration binding 的状态(含被外部撤销)

**每一个都是独立的事实,各自可读、各自可解释。** 前端要显示「因为模板停用所以这个渠道现在不能新建订单」,拿得到「模板停用」这个具体事实,而不是一个笼统的 false。

#### 组合规则归应用场景

**同一组维度事实,在不同场景下的组合规则不同** —— 这正是适用矩阵四行在做的事:候选与新增引用要求全维可用;管理编辑与重新启用**只看自身状态**;历史与审计**任何维度都不影响**。owner 负责给全维事实,**不负责替场景做合取**。

#### binding 的问题由此消解

此前把「binding 是否构成祖先」作为待裁项,是因为公式里只有一个合并值,必须决定 binding 进不进那个合取。**按本条原则,binding 的状态就是一个维度、就是一个事实,必须返回**;它在哪些场景构成阻断,由那些场景各自定义。**该待裁项撤销。**

### 为什么 `stop_reasons` 该整个去掉

实测三个取值:`MANUAL`(第 909 行,人手动停用)、`CASCADE_EXTERNAL`(第 1029 行,**上游 external system 或 provider profile 停用**;⚠️ 早前误写为"绑定失效",binding 删除走的是渠道退回草稿,是另一条路)、`CASCADE_TEMPLATE`(第 1178 行,引用的模板被停)。

- `MANUAL` **完全冗余** —— `status='DISABLED'` 已经表达了"有人停了它",这个值不携带任何额外信息。
- 两个 `CASCADE_*` 是**把上游状态的派生结果当成事实存了下来**。这正是不可逆的根因:存下来的派生值没法反派生,而全仓 `array_remove` 零命中、没人写清除路径。

**改成读时派生后,清除路径这个问题不存在了** —— 上游恢复,有效状态自动恢复。因此**不需要在选项 a/b/c 之间选,整个问题消失**。

**去除面(此前只列五处,实测远不止,现补全)**:

- **数据库**:`business_channel.stop_reasons` 列;`V20260819_230000_004__business_channel_internal_effective_repair.sql` 第 13 行
- **契约**:`contracts/openapi-source/business-channel.schemas.json` 第 360、414 行
- **边缘映射**:`BusinessChannelWireMapper` 第 64–65 行
- **owner**:`BusinessChannelOwnerService` 第 284 至 1594 行区间内的查询、写入、投影与状态判断(含第 872、893 行的阻断判断,改为按有效状态判断)
- **readback**:`BusinessChannelReadback` 第 37、40 行
- **前端**:`BusinessChannelDetailDrawer` 第 158–159 行
- **测试**:`BusinessChannelOwnerContractTest` 第 268 行;`BusinessChannelAcceptanceScenarios` 第 355、421、458、565 行
- **⚠️ 跨 owner producer 与级联写(此前完全遗漏,只删列会留下物化调用)**:
  - `ExternalCollaborationBusinessChannelCoordinator` 第 183–230 行,external system / provider profile 停用后调用 `applyExternalStopReason`
  - `BusinessChannelCommandApi` 第 31–42 行**仍对外暴露 `applyExternalStopReason`** —— **该 command 必须退役**,不得保留任何 materialized stop 命令
  - `BusinessChannelPolicy` 第 20–22 行的 `MANUAL` / `CASCADE_TEMPLATE` / `CASCADE_EXTERNAL` 三个常量
  - `BusinessChannelOwnerService` 第 594 行模板停用的级联写调用;第 994–1052 行 external 级联写;第 1175–1185 行 template 级联写

  ⛔ **只删列与投影、保留这些物化调用,裁定十八的"只存自身状态、读时派生、上游恢复自动恢复"就不成立。** 上述依赖必须改为 owner 读时派生。

- **⚠️ active 记忆(最要紧的一处)**:`project-memory/practices/business-channel-list-scope-and-validity-display.md` 第 31–37 行**明令要求物化级联** —— 「业务渠道 owner 必须在同一停用事务内把引用渠道置为 `DISABLED`,并追加 `CASCADE_TEMPLATE`」「已有渠道查询…读回 owner **已物化**的渠道状态与 `stopReasons`」。**这与裁定 18 直接冲突,必须同批改写**,否则两个 active 权威互相矛盾,实施者按记忆做就会把级联重新物化回去。

**只按此前那五处删列的后果**:残余 SQL、契约与 mapper 断裂、前端继续按旧数组阻断恢复、以及 active 记忆继续要求重新物化。

### 这不只是渠道的问题 —— 分母待穷举

至少还有:**商品 → 规格**(Dexter 点名的例子,catalog 今天**没有**任何父子状态联合判断,全仓只有 `status <> 'VOIDED'` 这类自身过滤)、**渠道 → 模板**、**分类树的父子**、**组织树的大区 → 项目 → 门店**。

**全平台级联关系分母已产出**,见附件第一章:维度关系 12 条(其中分类树与组织树的自引用、渠道→模板的 `template_ref`、渠道→目标节点、模板→所属项目、渠道→external system/provider profile 的跨模块引用**都不是 FK,FK 图抓不到**)、workspace 维度覆盖 13 类对象,取事实方式应统一实现、剔除 5 类流程状态机。⚠️ **附件自陈存在盲区**:非 FK 引用只能靠读代码补,不得以该表为穷尽。

### 适用矩阵 · 各场景如何组合维度事实

原表述过宽,与本文自己的规则冲突(§3.1 明写停用件可编辑、未变更的既有引用一律放行)。四类各不相同:

| 场景 | 用哪个状态 |
| --- | --- |
| **候选查询、新增引用、真实业务准入、下游消费** | **要求全部相关维度可用**。任一维不可用则不可被选中、不可被新引用、不参与业务 |
| **管理列表与详情** | 返回**全部维度事实各自的值**(自身状态,加每个相关维度的 `{ref, type, status}`)。UI 显示自身状态,并能指名道姓说出是哪一维不可用 |
| **管理编辑、重新启用、未改引用的保存** | **只看自身状态**,⛔ 不得因任何祖先维度不可用而阻断。否则祖先一停,后代永远修不好也启用不回来 —— 与 §3.1 的"停用可以改"和"既有引用豁免"直接冲突 |
| **历史、审计、快照、幂等回执** | **任何维度都不影响**,不得按当前可用性丢弃事实。这些是时点事实(§0.1),与当前有效性无关 |

### 与既有判据的关系

- 与三态**不冲突**:自身状态仍然只有三个值。
- 与装配判据**不冲突**:有效状态是派生的**事实**(布尔或枚举),不是拼出来的串;而"被谁阻断"必须以 `{blockedBy: {ref, type, status}}` 这类结构返回,**不得是句子**。
- 与 §1.2 **一致**:前端拿不到完整祖先链就算不出有效状态,因此**必须由 owner 算** —— 正是"依赖模型之外的数据"那一类。

## 4. 已知拦截(照做会撞上的墙)

这几条不是风险,是确定会发生的失败。

**拦截 1 · 接口数被硬编码在四条正在跑的门上 —— 射程远大于一个常量。**

| 位置 | 形态 |
| --- | --- |
| `scripts/generate/backend-performance-budget.mjs:10,210` | `EXPECTED_OPERATION_COUNT = 239`,数量不符即 `BUDGET_OPERATION_COUNT_INVALID` |
| `scripts/generate/operation-handler-bindings.mjs:19-25` | `EXPECTED_COUNTS = {operations: 239, **reads: 102**, commands: 137, …}`,另有 `BP_U02_BINDING_COUNT_DRIFT` 与 `BP_U02_BINDING_EXACT_SET_DRIFT` |
| `contracts/policy/backend-performance-cp05-calibration-report.json` | 签入的**实测冻结产物**,`expected/observed: 239`,分类合计须等于 239 |
| `scripts/generate/edge-codegen.mjs` | `buildBudgetProjectionSubset` 对**每一个** live operationId 要求在冻结报告里存在,否则 `BUDGET_PROJECTION_OPERATION_MISSING` |
| `scripts/test/r5-remote-testcontainers.mjs:343,352,353,368,369` | 五处字面 239 |
| `catalog-inventory-p1` 的 design-byte 摘要链 | `DESIGN_FIELD_DIGEST` / `designByteCoverage.fieldCount` 随契约字段集变动 |

**以下 239 描述是 CP-B0 实施前的历史基线，不是 CP-F3 后的 active denominator。CP-F3 当前权威值为 `238/102/136/93/34/9`；所有运行时、生成器、report 与 verifier 必须读取 canonical count source，历史 239/243 只用于说明实施阶段的接口集变化。**

**三个后果**:

1. **不只"收敛(减)会撞",新增一个 operation 同样立刻撞** —— `BUDGET_PROJECTION_OPERATION_MISSING` 对新 id 直接失败。
2. **第一步(甲档零拼装)就会撞。** 删响应字段 ⇒ OpenAPI 字段集变 ⇒ `DESIGN_FIELD_DIGEST` 变 ⇒ 签入的 `CatalogInventoryEdgeWire.java` / `.ts` 必须重生成。**"不动接口身份"不等于"不动契约字节"。**
3. **CLAUDE.md 宣告"PERFORMANCE verdict、accepted-baseline、calibration 均已退役",但代码里这套控制面还卡在四条门上。** 这是一处需要先处置的矛盾。⚠️ **处置方式已由裁定 17 定死:数量收敛到一处人工维护,⛔ 不得改成自动从契约派生** —— 那会把"有人显式确认"这道闸换掉。

**处置必须拆两类,不能用一个"第零步"阻断所有字段修改**(此前写成统一第零步,过宽,经 Codex review 更正):

| 类 | 触发什么 | 处置 |
| --- | --- | --- |
| **仅改字段/schema** | 不改 operation 身份与数量,**不触发** 239 / `reads:102` / CP05 / binding drift;只触发 design-byte 摘要链 | contract source、generator、生成的 Java/TS 与 design-byte **同批同步**即可,不需要先关掉整个 performance 控制面 |
| **改 operation 身份/数量** | 新增、删除或重命名 operation ⇒ 立刻撞 `BUDGET_OPERATION_COUNT_INVALID`、`BP_U02_BINDING_COUNT_DRIFT`、`BUDGET_PROJECTION_OPERATION_MISSING` | **必须先**关闭 239 / CP05 / generated binding / reconciliation 的漂移,再动 |

⚠️ **新增 operation 的预算不能只从契约静态派生** —— run-level verifier 仍需实测数据。

**裁定 17(Dexter 2026-08-27):数量收敛到一处维护。** `239` 与 `reads: 102` 由**单一人工维护的 canonical count source** 声明,以下 consumer **全部**改为引用它(此前只列了三类,漏两类):

- `scripts/generate/operation-handler-bindings.mjs` 第 19–25 行的 `EXPECTED_COUNTS`
- `contracts/policy/backend-performance-cp05-calibration-report.json` 的分类合计校验
- `scripts/test/r5-remote-testcontainers.mjs` 第 343、352、353、368、369 行
- **`scripts/test/backend-performance-operation-reconciliation.mjs` 第 163、223、261、302、332 行**
- **`scripts/test/backend-performance-cp05-reclassification.mjs` 第 64–70、323、331、420、429 行**

⚠️ **裁定只要求"数量单源 + 显式人工修改"。** 不得借机引入 operation-id digest、`decisionRef` 或任何自动派生机制 —— 那会把"有人显式确认"这道闸换掉。

- **保留的**:"接口集变动必须有人显式确认"这道闸 —— 改数字仍是一个刻意动作,防止有人悄悄加接口。
- **去掉的**:每次增删接口要人工同步四处、还容易漏掉一处的负担。
- **不变的**:预算**值**仍须实测,只有**数量**收敛到一处。

**同时更正 `CLAUDE.md` 的表述**:该文现在写「…calibration…均已退役」,会让人以为整套都退役了。实际是**两套控制面**:scenario 级的 performance verdict 与 calibration 确已退役;**run 级的 operation budget verifier 仍在跑**,并卡在四条门上。这句需精确化。

**拦截 2 · `requireEditable` 按裁定 9 应整体退役,不是改两处。**

裁定 9 是「启用可编辑、停用可编辑、已删除不可编辑」,而 `requireEditable` 的定义(`BusinessChannelOwnerService:1465`)就是 `if (DISABLED.equals(status)) throw DISABLED_OBJECT_NOT_EDITABLE` —— **它本身就是被裁定推翻的那条规则**。逐处处置:

| 行 | 检查谁 | 性质 | 处置 |
| --- | --- | --- | --- |
| 511 | 模板自身(改模板) | 编辑校验 | **删** |
| 649 | 模板(**新建**渠道引用) | 引用校验 | **保留** |
| 736 | 渠道自身(改渠道,锁前) | 编辑校验 | **删** |
| 767 | 渠道自身(改渠道,锁后) | 编辑校验 | **删** |
| 769 | 模板(**既有**渠道引用) | 既有引用 | **改豁免** |
| 868 | 渠道自身(转状态) | 编辑校验 | **删** |
| 870 | 模板(**既有**渠道引用) | 既有引用 | **改豁免** |

**`ExternalCollaborationBusinessChannelCoordinator` 第 310 行的同名 helper 只有定义、无 live caller**,是 dead helper,**不计为第 8 个 live call site**(此前误计,现更正)。清理时一并处置。

**⚠️ 删除 `requireEditable` 之后必须补终态保护,否则是净损失。** 裁定 9 推翻的是"停用不可编辑",**不是"已删除也可编辑"**。替代规则必须明确写死:

- **启用、停用**:可编辑、可转状态
- **已删除**:**不可编辑、不可继续转状态**
- **新增引用**:只允许引用启用件
- **未改变的既有引用**:走豁免(第 769、870 行)

`BusinessChannelOwnerService` 相关位置:第 511、649、736、767、769、868、870 行,helper 定义在第 1465–1469 行。

**其中 769 / 870 是今天生产代码里的真 bug**:停用一个模板会连带冻结所有基于它建的既有渠道。

**拦截 3 · 裁定 13 目前零落点。** 实测:「菜单发布」全仓 `.java/.ts/.json` **0 命中**(该能力尚未建设);`ContractCommandService` 创建路径**无门店/租户 ENABLED 校验**;`WorkspaceInvitationService` 创建邀请时**不校验 role.status**。裁定要落地,这三处需新建校验,或明确该裁定是对将来能力的约束。

**拦截 4 · 形态三的分母不能按字段名后缀切。** 按后缀取的 41 个里混着 `skuSummary`(§1.3 亲自点名的正确样板)、`inventoryDeductionSummary`(结构化对象)与 `actorDisplayName`(§0.1 快照例外)。**必须按 §2.3 四分类逐个判定,不得整批退役。**

**拦截 6 · 渠道停用后永久启用不回来 —— 裁定 10 照现状无法成立。**

实测 `BusinessChannelOwnerService`:`array_append(stop_reasons, …)` 三处(第 909、1029、1178 行),**`array_remove` 零处,全仓无任何清除路径**;转 DISABLED 时无条件 `array_append('MANUAL')`(第 904–906 行);而第 872 行(目标态 EFFECTIVE)与第 893 行(目标态 DRAFT)都在 `stopReasons` 非空时抛 `DISABLED_OBJECT_NOT_EDITABLE`。源码注释自陈 `stop reason recovery remains pending under C-01`。

**后果**:按拦截 2 删掉 `requireEditable`、按裁定 10 做完映射之后,**手动停用过的渠道仍然一条都启用不回来** —— 两个非 DISABLED 目标态都被 `stopReasons` 挡死。而三态表格里"停用件列表可见"的**唯一理由**就是"否则无法启用回来";裁定 2 又取消了物理删除,连删掉重建这条退路也没了。

**更坏的是门全绿**:A-7 的三条判据(停用可编辑 / 已删除不可编辑 / 停用件不可被新引用选中)**没有一条会红**,而不变量是破的。

**处置(Dexter 2026-08-27 裁定 18):不是补恢复路径,而是整个去掉 `stop_reasons`,改为按 §3.2 读时派生有效状态。** 上游恢复则有效状态自动恢复,C-01 那个 pending 随之消失,不需要设计任何清除语义。

**拦截 5 · 契约里写着旧口径。** `contracts/catalog/catalog-inventory-edge-contract.json`(7 处)与 `contracts/policy/catalog-inventory-assertion-matrix.json`(**7 处**:第 802、6053、6249、6380、6513、6656、6788 行;此前误写 2 处)写着 `Load exactly the approved detail section with bounded task reads and return its typed read model.` —— **按屏取数是写进契约的义务**,不改它,零拼装在契约层就自相矛盾。

## 5. 落地顺序

**零 · 在动 operation 身份/数量之前处置拦截 1。**

- **不需要先关闭漂移的**:步骤一、二、三 —— 只改字段与 schema,不动 operation 身份与数量,只需与 design-byte 摘要链同批同步。
- **必须先关闭漂移的**:步骤四与步骤六。

⚠️ **步骤四会改变 operation 集合,此前把它漏了。** 裁定 1「定义库一律 `transitionStatus`」加裁定 2「物理删除完全取消」意味着要**退役** `deleteOperationsCatalogCategory`、`deleteOperationsCatalogUnit`、`disableOperationsCatalogUnit`、`deleteOperationsCatalogAttributeDefinition`、`deleteOperationsCatalogOrderOptionDefinition` 五个 operation,并**新增 4 个** `transitionStatus`(**Dexter 2026-08-27 裁定 D01=B**:`catalog_category`、`unit_definition`、`catalog_attribute_definition`、`catalog_order_option_definition` 各一个)。**只加属性与点单选项两个是不够的** —— 分类与单位会一个状态命令都不剩,裁定 1、2 在这两个库上不可执行。**operation 净 −1**;减与增同时发生 —— 同时触发 `BUDGET_OPERATION_COUNT_INVALID`、`BP_U02_BINDING_COUNT_DRIFT`、`BP_U02_BINDING_EXACT_SET_DRIFT` 与 `BUDGET_PROJECTION_OPERATION_MISSING`。

⛔ **禁止的规避路径**:为了不动数量,把 `deleteOperationsCatalogCategory` 的**语义偷偷改成软删而保留 operation id**。那是用兼容层掩盖裁定,仓规明禁。步骤四的 operation 集合 delta 必须在开工前量化并显式确认。

一 · **catalog 甲档零拼装**。范围最小、净删代码、不动接口身份(但会动契约字节,见拦截 1)。用来验证 §1 的判据是否真可判。

二 · **catalog 乙/乙′档**。改 SQL 投影与递归 CTE 累加器,无数据库迁移。

三 · **形态二:SQL 层装配**。`CollaborationOwnerService`、`OrganizationTaskPathService`、`OrganizationAssignmentCandidateService`、`OrganizationHierarchyService` 的 `||` / `string_agg` 装配改为返回结构化节点数组。⚠️ **范围不是"只动 organization"** —— `organizationPath` 实际定义在 `workspace-iam` 的契约里、由 `WorkspaceUserService` 产出、落到 platform-admin 面。**跨两个域、两个 App。**

四 · **三态改造**。真实迁移分母见下;`business_channel` 纳入时同步修拦截 2。

五 · **形态三:前端建字典**。按 Dexter 判据 —— **代码定义的闭集由前端建字典,后端不建接口**;业务自定义的由后端返实体。**本批含一步后台改动:响应契约补 enum(规范 1-O)**,不是纯前端批;补完前端才拿得到联合类型,字典才有编译期穷尽性。不新增 operation。须在四之后,因为 `enumLabels` 现含 `DRAFT` / `ARCHIVED`,三态改完才有正确内容可写,且响应 enum 必须同步取齐三值。

六 · **读接口收敛**。分母写死为 `catalog-inventory.openapi.json` 全部 GET(实测 22,含 8 个 inventory)。

### 5.1 三态改造的真实迁移分母

初稿写"唯一需要迁移的是新增 `status` 列",**不成立**。实测:

- **按当前值域重数(2026-08-27 全量迁移扫描)**:恰为 `ENABLED/DISABLED` 两值的 **15 处**;已是三值的 3 处(`catalog_category`、`dictionary_entry`、`production_tag_definition`,**不需改**);其他值域 10 处。
  - **本批加 `VOIDED` 的两值表 = 9 张**:`organization_node`、`brand`、`tenant`、`head_company`、`store`、`workspace_account`、`workspace_role`、`business_channel_template`、`unit_definition`。
  - **本批做值域变更 + 回填的 4 张**(不属两值,须单列):`business_channel`(`DRAFT/EFFECTIVE/DISABLED`)、`catalog_item`(五值)、`catalog_sku`(四值)、`catalog_composite_component`(`ENABLED/DISABLED/ARCHIVED`,存量 ARCHIVED 须先判零)。
  - **须按规范 1-L 反向判据登记豁免并写理由的 2 处**:`stock_target.definition_status`、`stock_bom.definition_status`(inventory 两张本批不动)。**不登记就是门红,不能靠「没列进来」默认放过。**
  - ⚠️ **更正(2026-08-27 独立复核)**:此前本行写「16 处」并把 `organization.commercial_group_idempotency.status` 列为第三处豁免,**两者都是错的**。该表实测无 `status` 列(列为 `idempotency_key/group_workspace_key/request_fingerprint/commercial_group_id/commercial_group_code/commercial_group_name/created_at`);原扫描按「最近前置表名」归属 CHECK,被该表的 `ENABLE ROW LEVEL SECURITY` 等 ALTER 带偏。按严格归属重数为 **15 处**,豁免 **2 处**。9 张表的清单不受影响(15−4−2=9)。
  - 裁定 11 排除的 4 张(`group_workspace`、`platform_admin`、`external_system_enablement`、`provider_profile_enablement`)不得出现在以上任何一档。
  - ⚠️ 此前版本写作「17 处 / 15 表 / 本批 11 张」,其中 `catalog_category`(已三值)与 `business_channel`(非两值)两处归档错误,已按实测更正。
- **`catalog_item`** 五值 → 三值(裁定 6 + 7)
- **`catalog_sku`** 四值 → 三值(裁定 7)
- **`business_channel`** `DRAFT/EFFECTIVE/DISABLED` → 三态(裁定 10),⚠️ `DRAFT→停用` 会与现存 `DISABLED` **撞值**,映射须显式定义
- **2 张新增 `status` 列**:`catalog_attribute_definition`、`catalog_order_option_definition`
- **2 处既有 partial index 谓词改写**:`ux_catalog_sku_default_per_item`、`ux_catalog_sku_variant_digest_per_item`(现为 `status NOT IN ('ARCHIVED','VOIDED')`)
- **`inventory.stock_target` / `stock_bom` 移出迁移分母,进豁免清单。** 此前采纳了"其 partial index `WHERE definition_status='ENABLED'` 会让 DISABLED 提前释放业务键、违反三态不变量"这一意见,**该意见经复核不成立,现推翻**:

  - 迁移文件头注释即设计声明 —— `A disabled row is an immutable historical definition snapshot`
  - 索引名是 `ux_inventory_stock_target_active_identity`,约束的是"同一 owner 身份**至多一条在用定义**",**故意允许多条 DISABLED 历史行共存**;它**不是编码占用索引**
  - `InventoryOwnerService` 全仓 `SET definition_status` 只有两处(第 3197、3219 行),**都写 `'DISABLED'`,从不写回 `'ENABLED'`** —— DISABLED 在这里是**终态**

  按 §3.1 的判据(能否由人手动在两状态间来回切),这两张表**不是主数据**。

  ⚠️ **若照原意见改谓词,会造成三件坏事**:已存在"同身份 DISABLED + ENABLED"的库**建索引直接 duplicate key 失败**;`saveDirectDefinition` 在有历史行时 INSERT 必然唯一键冲突;三处 `ON CONFLICT ... WHERE definition_status='ENABLED'` 的仲裁索引变宽后,**新定义会被写进那条不可变历史行** —— 用户保存返回 200、定义不生效、历史快照被覆盖,是静默数据丢失。

ORG / IAM 的接口**不合并**:实测 21 个 operation 带 `noClientDerivedAuthorization: true` 与 `serverDerivedTarget: "STATIC_OPERATION_CAPABILITY"`;IA-05 §32 明定目标来自能力绑定而非用户提交。**决定授权的维度必须留在 operation 身份里;只决定表达的维度才进数据。**

## 6. 防回退

规则正文只在 `doc/platform/backend-coding-standard.md`(§5:该文是唯一内容源,别处只放指针)。本节只说门的能与不能。

**能做成真门的两条**:

- **装配门**:**判据是"这个响应字段的值是不是拼出来的",不是"这个文件里有没有拼接"。**

  ⚠️ **两者不等价,而且冲突就落在步骤一的头号目标文件上**:`CatalogOwnerService` 实测 39 处 `String.join`,其中 **31 处是 `String.join(",", Collections.nCopies(n, "?"))` 的 SQL 占位符生成**(§2.4 已豁免)。若门按"清单内出现装配即红"执行,该文件进清单第一天就红 31 次,实施者只剩三条路:把它排除出清单(门在最需要的地方零覆盖)、把门降级成关键词白名单(仓规明禁)、或去改承重的占位符生成代码。**A-1 与 A-2 在这个文件上无法同时成立。**

  **诚实的结论**:要真正成门,必须做到**响应字段的数据流可判**(装配表达式是否流向响应字段),而这与"分钟级、零基建"有真实张力。

  **在数据流判定做出来之前,本条只能靠 review,不得接成机器门。** 文件清单**只是范围登记,不是判据** —— ⛔ 不得用"清单内出现装配即红"这种写法接门。

  判据成立后,门必须同时覆盖三层:Java 的 `+` / `String.join` / `String.format` / `StringBuilder`、Stream 的 `Collectors.joining` 与 `reduce` lambda、SQL 的 `||` / `string_agg` / `concat` / `format`。只扫 Java 的门对 `CollaborationOwnerService` 与 `OrganizationAssignmentCandidateService` 全绿,而那里正藏着「名称(编码)」。
- **既有引用豁免门**:走 `backend-acceptance` 真实场景——把被引用的定义置停用后保存引用它的对象(不改该引用)必须成功;改成另一个停用的必须被拒。**这是唯一验证真实行为的门。** 裁定 14 去掉 80 上限后名额不再是阻塞。

**登记建立之前只能靠 review、建立之后可以接门的**:哪些 ref 是业务实体引用(规范 `1-J`)、哪些表是主数据(规范 `1-L` / `1-M`)。二者在规范里位于 §1「能变成门的九类」并逐条标注「待建」,与本节不矛盾 —— **差别只在登记是否已建**。⚠️ "带 `status` 的表"这个分母本身有边界问题:列名有 `status` 与 `definition_status` 两种,放宽匹配又会误收 `status_changed_at_epoch_millis` 这类时间戳列,登记方案必须处理。

**永远做不成门、只能靠 review 的**:一个读模型是不是某一屏的取景框(纯语义判断,仓规明定业务语义不得做成 checker)。

**登记未建立之前,对应规则不得接门。** 门存在 ≠ 门生效。

## 6.1 验收判据(每条自带反例)

| # | 判据 | 反例 |
| --- | --- | --- |
| A-1 | **已零拼装文件清单内**,新增一个展示形态不需要改后台 | 判据须先声明清单;不声明则任何未 SELECT 的字段都要改后台,判据循环 |
| A-2 | 清单内文件的响应字段值不由拼接产生 | 在清单内文件把某响应字段改成两事实拼接,门必须红。**Java 与 SQL 两层都要红** —— 把 `commercial_group_name \|\| '（' \|\| commercial_group_code \|\| '）'` 登记进清单,今天的门不红,即门未达标 |
| A-3 | 已登记的业务实体引用,均可在同响应体内解析到业务身份 | 摘掉某个已登记 ref 的身份字段,门必须红。**未建立引用登记前本条不可验收** |
| A-4 | 主数据清单内的表 `status` 恰好三值,且任何带 `status` 的表都落在主数据清单或豁免清单 | 新建一张带 `status` 且两处清单都不登记的表,门必须红 |
| A-5 | 作废后业务唯一键可复用 | partial index 改回普通 UNIQUE,门必须红 |
| A-6 | 引用了停用定义的对象仍可保存(不改该引用);改成另一个停用的被拒 | **唯一的真行为判据**,走 backend-acceptance,可先红后绿。现有 `catalog.tag-navigation` 只断言读侧可见,写侧未覆盖 |
| A-7 | 停用件可编辑;已删除件不可编辑;停用件不可被新引用选中 | 三条各有独立场景。第三条正例是 `BusinessChannelOwnerService:649`;第一条的反例是 `requireEditable` 若未退役则必然失败 |
| A-8 | `catalog-inventory.openapi.json` 的 GET 总数下降且分母写死 | 分母 = 该文件全部 GET(实测 22,含 8 个 inventory),不按域拆分 |
| A-9 | 时点快照字段未被误退役 | 把 `actorDisplayName` 从审计读模型删掉,历史记录会随账号改名漂移 —— 该改动必须被 review 拦下 |
| A-10 | 聚合事实按**判据**保留,不按清单 | 新增一个 required 计数字段而不在任何清单里,判据仍须判定它该留 |

## 7. 已代 Dexter 裁定(2026-08-27 授权:"需要我裁定的,你都替我决定吧")

本章四条中,**§7.1 与 §7.4 由 Claude 代裁、可一句话推翻**;**§7.2 与 §7.3 已由 Dexter 亲裁**(分别对应裁定 19/20 与裁定 15),不再是代裁项。每条给出裁定、理由与执行面。

### 7.1 裁定 13 是业务规则,不是现状修补

**裁定**:三处已有落点的(新建合同、创建邀请、渠道绑定)本批补校验;**「菜单发布」记为该能力建成时的准入条件**,不虚构落点。

**理由**:业务规则先于实现存在是正常的。实测「菜单发布」全仓 0 命中,为一条尚未建设的能力造校验点是虚构工作;而把裁定丢掉又会让规则在能力建成时失传。记为准入条件两头都不丢。

**执行面**:`ContractCommandService` 创建路径加门店/租户 `ENABLED` 校验(现无);`WorkspaceInvitationService` 创建邀请时加 role `status` 校验(现无);**渠道绑定这一条此前写错了,现更正**:`BINDING_NOT_EFFECTIVE`(`BusinessChannelPolicy` 第 101、117 行)检查的是 **collaboration binding 是否存在且为 `EFFECTIVE`**,**不检查 channel 或 template 的状态**。因此它不能充当"停用阻断渠道绑定"的落点。需明确:新增引用时由哪个 owner 检查 channel/template 为启用,并列出真实 live call site。**不得靠改 problem code 文案代替缺失的状态谓词。**菜单发布能力的设计文档必须引用本条。

### 7.2 `workspace_role` / `workspace_account` 纳入三态

**裁定**:纳入。**但 1-M 的对象是它们的业务唯一键,不是 `code`。**

**理由**:按判据二者是主数据 —— `WorkspaceRoleService` 有真实 `transitionStatus`,`Set.of("ENABLED","DISABLED")` 可由人手动来回切;裁定 5 明写适用所有域。

**执行面**:两表实测**无 `code` 列**。`workspace_role` 的唯一键是 `uq_workspace_role_name`(按名称),`workspace_account` 是登录名与手机号。加 `VOIDED` 值后,**`workspace_role` 的 partial index 建在真实唯一键上**。

⚠️ **`workspace_account` 例外(Dexter 2026-08-27 裁定 D02=B)**:`uq_workspace_mobile` 与 `uq_workspace_login` **保持普通 `UNIQUE`,不改 partial**。账号一旦 `VOIDED`,该手机号/登录名**永久不可再用** —— 身份键不是业务编码,复用会让「这个号以前是谁」不可判定。既然应用层永久拒绝,DB 就不能放行;改成 partial 会让 predicate 变成死代码。已登记为规范 1-M 的显式例外。`accountExists` 的 `VOIDED` 与 `DISABLED` 同样返回 `ACCOUNT_NOT_BINDABLE` / 422,**不新增「存在作废历史」字段**。

**⚠️ 前一版在这里写错了两条执行面,均会造成回退,现更正:**

**(a) 不得把"既有引用豁免"套到运行期授权解析上。分母是 7 处不是 4 处。** 该豁免的原文限定是「**保存时**只对本次新增或改变的引用校验」,是**写入期**规则。实测 `role.status='ENABLED'` 共 **7 处,散在 4 个文件**(此前误写成"全在 `WorkspaceAuthenticationService`",是因为文件列举只匹配了 `r.status=` 这一种写法):`WorkspaceAuthenticationService` 第 522、901、1282、1303 行;`WorkspaceCapabilityScopeResolver` 第 409 行;`WorkspaceCommandAuthorizationService` 第 151 行;`WorkspaceAuditAuthorizationService` 第 87 行。会话、任职解析、能力域解析、命令授权与审计授权**今天都已带该过滤**;**7 处全部必须保留** —— 角色一停用,既有任职在授权解析里就已失效,这与 G-07「修改即时作用于后端授权」一致。要让"既有任职继续有效"成立,就得把过滤放宽到包含 `VOIDED`,**等于让已删除的角色继续授权**。两者错的后果完全不同:写入期错了用户改不了名字,运行期错了是越权。**保持现状:角色停用/删除即时影响授权。**

**(b) 释放登录名/手机号会撞车,分母是 6 类不是 2 类,而且语义按命令区分。** 实测:

| 查找 | 位置 | 现状 |
| --- | --- | --- |
| 密码登录 | `WorkspaceAuthenticationService:195` | **无状态过滤** |
| OTP 手机号 | `WorkspaceAuthenticationService:953` | **无状态过滤** |
| 邀请完成时的账号查找 | `WorkspaceInvitationService:1066` | **无状态条件** |
| 邀请 `accountExists` | `WorkspaceInvitationService:1326` | **无状态条件** |
| 密码恢复 ×2 | `WorkspacePasswordRecoveryService:282-283, 305` | **已带 `status='ENABLED'`,正向对照** |

**语义必须按命令区分,不得机械复制:**

- **登录与 OTP**:只选 `ENABLED` 账号。
- **邀请(裁定 16)**:遇到已停用账号 **拒绝并返回 typed problem**。owner 是 `workspace-iam` 的 `WorkspaceInvitationService`,**两处都要拒**:

  1. **创建邀请时**(`createWithFacts` 第 220–272 行)—— 给邀请人即时反馈
  2. **完成邀请时**(`completeReadyInvitation` 第 1046–1089 行)—— 覆盖"邀请存续期间账号被停用"的竞态

  ⚠️ **不能简单给查询加 `status='ENABLED'`。** 第 1064–1072 行的账号查找现在不读 status;若只加过滤,已停用账号会被误判为**不存在**,随后走新建分支、撞手机号唯一键。**account lookup 必须至少区分 ABSENT / ENABLED / DISABLED / VOIDED 四态**,再按态分支。

  **以下已由 Dexter 2026-08-27 裁定十九、二十确定,不再是待裁项**:

  - **拒绝范围**:创建邀请与完成邀请**两处**都拒绝 `DISABLED` 与 `VOIDED` 账号
  - **problem**:固定为 **`ACCOUNT_NOT_BINDABLE`**,HTTP **422**(与既有 `PRODUCTION_TAG_NOT_BINDABLE` 对称)
  - **readiness**:`accountExists` 由布尔改为四态枚举 **`ABSENT / ENABLED / DISABLED / VOIDED`**;现契约 `workspace-access.schemas.json` 第 257–375 行的两个响应仍是布尔,须一并改
  - **拒绝时不得创建任职或凭据**

  实施落点:`WorkspaceInvitationService` 第 220–272 行(创建时不查账号状态)、第 1046–1089 行(完成时按手机号查但不读状态)、第 1323–1331 行(`accountExists` helper 只返布尔)。

> **今天的行为是四种可能里最差的一种**:`WorkspaceInvitationService:1064` 按手机号查账号**不带任何状态过滤**,查到就直接复用 —— 任职建好了、账号还是停用的、人登不进去,**全程没有提示**。邀请人看到"邀请成功",受邀人接受后登录失败。裁定 16 把这个静默失败改成显式拒绝。
>
> 裁定理由:停用是管理员的明确动作,邀请不得绕过;与裁定 13「停用阻断邀请」同向;G-08 对门店停用的已裁影响也是**阻断**而非提示。

**顺序:先按上述补齐各命令的状态语义,再加 `VOIDED` 与 partial index。**

**顺序:先补状态语义,再加 `VOIDED` 与 partial index。**

删除前必须给出引用数(有多少任职在用该角色),与其它主数据一致。

**角色的业务唯一键是可变的名称,不是编码 —— 这使"唯一键 ≠ 稳定标识"这条对它更成立。** `workspace_role` 完整列为 `id / workspace_uuid / group_workspace_key / name / service_node_type / description / status / version` 加两个 JSONB 与两个时间戳,**无 `code` 列**,唯一键是 `uq_workspace_role_name UNIQUE(workspace_uuid, group_workspace_key, name)`;代码侧 `roleCode` / `role_code` 零命中。

而 G-07 明写角色**可改名称**。因此标记删除后释放名称,并不引入**新的一类**歧义 —— 今天改名就已经能造出同名歧义。**裁定:仍然释放,与现状一致。** 真正必须守住的是:**角色身份永远是 `id`,不是名称**;审计、任职、能力绑定一律按 id 记录,任何按名称反查角色的写法都是既有缺陷,与本批无关也应修。

Dexter 2026-08-27 确认按此处理。给角色新增不可变编码属新增业务概念,超出 base-1,如需要请单独提。

### 7.3 `catalog_composite_component`:移出主数据清单 + `ARCHIVED` 作为死值清除

**Dexter 2026-08-27 裁定:死值直接清,不当例外。**

两件事分开:

**(a) 移出主数据清单。** 该表无 `code` 列,唯一约束是 `(composite_group_ref, display_order)`,组件行是"整组删掉重插表达一次编辑",按 §3.1 判据(能否由人手动在两状态间来回切)不是主数据。**不进主数据清单、不建 partial index、不适用 1-M。**

**(b) `ARCHIVED` 待清除,但"只活在 CHECK 里"这个说法是错的,现更正。**

准确的事实分三层:

- **UI 选不到**:`CatalogItemCompositeEditor` 第 466 行把状态选项过滤为 `option.value === 'ENABLED' || option.value === 'DISABLED'`
- **无 writer 字面量**:`CatalogCompositeFacts` 内 `ARCHIVED` 零命中,owner 从不写它
- **但生产查询仍赋予它排除语义**:`CatalogOwnerService` 第 5460 行与第 5528 行都执行 `component.status <> 'ARCHIVED'`

**因此清除该值不是纯 CHECK 改动**,实施前必须先处置这两处查询。

**存量数据是否为零 —— `UNVERIFIED_REQUIRES_EVIDENCE`。** 本轮禁止数据操作,不能把"理论上不该有"写成已证事实;须在获得数据授权后核验真实存量,再决定是否需要迁移处置。

⚠️ **该表的 `status` 列本身是活的,不得删** —— `CatalogCompositeFacts` 第 301 行起有 `UPDATE … status=?`,第 371 行 `text(component, "status", null, "ENABLED")` 从请求体读取,读模型也回显。此前有一版称它是死字段并建议"一并删除",那是假实测(格式化器把列名劈成了 `"stat" + "us=?"`),已作废。

### 7.4 形态三:前端建字典,后端不建接口

**裁定**(按 Dexter 2026-08-27「后端有明确代码支撑、不是业务自定义的,前端就建字典」):纳入 base-1,**字典建在前端**;后端删那 **13** 个代码闭集的 `DisplayName` 字段,并**先在响应契约补上 enum**(规范 1-O)。

**为什么不是"后端各建一份词汇表接口"**(此前版本的写法,已作废):

1. 这些标签是**代码定义的静态闭集**,不随租户品牌变化 —— catalog 的 `enumLabels` 在 `p1.mjs` 里就是一个字面量对象。静态数据前端自己持有即可。
2. 后端建接口等于**每个域 +1 个 operation**,直接撞拦截 1(`BUDGET_PROJECTION_OPERATION_MISSING` 对新 id 立刻失败)。
3. catalog 的 `shapeManifest` **不是"词汇表"** —— 它还带 `fields`、`modeRules`、`shapeRules`、`fieldRules`、`tabRules`、`linkageRules`、`typeEffects`、`saveSections`、`detailSections`、`identifierRules`、`preparationRules`,`enumLabels` 只是其中一个键。"照抄它的形态"会为别的域造一整套用不上的规则引擎。

**顺带**:按同一判据,catalog 现在把 `enumLabels` 放在 shapeManifest 里**运行时下发**也差一步 —— 静态闭集不该每次请求都取。catalog 不是标杆,是"比别的域走远一步但仍未到位"。是否一并改,列为实施时的可选项。

**执行面**:① 后端在**响应** schema 补 enum(取请求侧现成字面量;`status` 类须取齐三值);② 重生成契约,两个 App 的字典**从生成的联合类型派生**——不是手抄一份平行清单,否则新增枚举值前端不会红;③ 后端删除那 13 个字段;④ 第二、三、四类按 §2.3 分别处置,**不整批退役**。

⚠️ **①必须先做。** 实测 `operatorKind` 等 6 个字段的响应侧现为裸 `string`,不补 enum 就没有联合类型可派生,②会退化成手抄清单——那正是本条要避免的形态。

## 8. 授权边界

本文是需求稿。第 3 章为 Dexter 已裁定事项;第 7 章中 §7.1 为 Claude 代裁可推翻,**§7.4 的 enum 口径已由 Dexter 2026-08-27 亲裁**,§7.2、§7.3 已由 Dexter 亲裁;其余为待批准需求。**本文不授权任何实施、DEV 或数据操作。** 第 4 章的六条拦截在开工前必须逐条有处置结论,其中拦截 2 是生产代码里的既有缺陷,与本批范围无关也应尽快修。
