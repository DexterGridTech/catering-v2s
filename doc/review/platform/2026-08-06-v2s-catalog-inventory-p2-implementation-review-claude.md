---
title: 商品目录与门店轻库存 P2 后台/API 实施 · Claude 独立评审
reviewTarget: IMPLEMENTATION
scope: P2 静态源码实施（owner 模块、协调器、edge、migration）
verdict: NO-GO
findings: M=3 / S=2 / N=1
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅 P2 静态实施评审；不授权契约/generated 改动、数据库/migration、seed/reset、DEV/UAT/HTTP/L2、runtime 或 Git
createdAt: 2026-08-06
---

# P2 后台/API 实施独立评审

## 0. 结论

**`NO-GO` — `M=3 / S=2 / N=1`。**

**本结论只覆盖静态源码实施。** 我**没有**执行 DEV、HTTP、L2 或任何 runtime，
因此**不对运行时行为、数据库实际状态或业务闭环作任何断言**。

底子是真的：有真实 migration、真实 `JdbcTemplate` 持久化、真实版本 CAS、
真实幂等 receipt、真实 TOCTOU digest——**不是空壳**。
但三条 M 都落在**跨 owner 边界与契约符合性**上，其中一条是数据越界风险。

## 1. 这活儿要解决什么，解决了没有

**要解决的**：把 P1 冻结的 42 个 operation 变成真实的 owner 实现，
且**不得扩契约、不得发明**——P2 的全部自由度应该只有"怎么实现"，没有"实现什么"。

**解决了的部分**（我逐项看源码确认，非采信声明）：

- **持久化是真的**：`V20260806_120000_000__catalog_inventory_backend.sql` 存在，
  `CatalogOwnerService` 用 `JdbcTemplate` 真读真写，不是内存桩；
- **TOCTOU 是真的**：协调器 `CatalogInventoryApplicationService:113` 把
  catalog / inventory / production **三方 digest 合并**成 `combined`，
  与请求携带的 `preflightDigest` 比对，不等则在**任何写之前**抛
  `STALE_COPY_PREFLIGHT`（`:98`）。这条实现得比我预期的好；
- **幂等是真的**：`replay()` 用 `SELECT ... FOR UPDATE` 取 receipt，
  `operationId` 或 `requestHash` 不符即 `IDEMPOTENCY_MISMATCH`，成功后 `saveReceipt`；
- **版本 CAS 是真的**：更新语句一律 `WHERE ... AND version=?`，
  影响行数不为 1 即 `VERSION_CONFLICT`，且都带 `AND status <> 'VOIDED'`——
  **VOIDED 后不可修改在 SQL 层强制**；
- **`voidAvailability` 是真算的**：分类用子查询数「被商品引用数」与「子分类数」，
  字典条目查 `dictionaryReferenced`，`canVoid` 由真实计数推出，
  `blockingReferences` / `dependentFacts` 有真实内容——**不是占位**；
- **`HIERARCHY_CYCLE` 真实实现**（`createsCategoryCycle`）；
- **两个上限单一声明点**：`CopyLimitPolicy.load()` 从
  `catalog-inventory-copy-policy.json` 资源读取，**源码零字面量**，
  且 `selected < 1 || closure < selected` 时直接 fail-closed；
  两处调用都带 `actual` 与 `limit`（`:93`、`:97`）；
- **库存详情六区齐全**：`InventoryOwnerService` 中六个 operation 全部存在；
- **历史欠账诚实登记**：证据文件中 `110`、`unresolved`、`duplicate`、
  `contract-face`、`pre-existing` 均出现，**未误报为本包已修复**。

**没解决的**：跨 owner 的来源校验、资产上传的契约符合性、复制闭包的对象覆盖面。见 §2。

**是不是只为了凑 GO**：我判断**不是**。TOCTOU 的三方 digest、
`voidAvailability` 的真实计数子查询、`FOR UPDATE` 幂等锁，
都是"可以糊弄但没糊弄"的地方。三条 M 更像是**把复制这条最复杂的链做浅了**，
而不是刻意造绿。

## 2. Findings

### M-01｜品牌复制的来源由客户端指定，从未经 organization owner 解析或校验

**位置**：`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/application/cataloginventory/CatalogInventoryApplicationService.java:72-74`；
`modules/catalog/.../CatalogOwnerService.java:240`。
**依据类型**：仓内源码事实。

```java
String source = required(request, "sourceDataNodeRef", dataNodeRef);
if (source.equals(dataNodeRef)) throw new CatalogOwnerApi.Problem("COPY_SOURCE_TARGET_SAME", 422, ...);
return dispatchBrandCopy(operationId, source, dataNodeRef, brandRef, request, requestId, idempotencyKey);
```

**复制来源整个取自请求体 `sourceDataNodeRef`，唯一校验是"不等于目标"。**
没有任何一处向 organization owner 求证；`brandRef` 同样来自调用方上下文而未与来源比对。

配套地，`CatalogOwnerService:240` 把上下文写死：

```java
data.put("scopeName", dataNodeRef).put("scopeCode", dataNodeRef).putNull("headCompanyRef");
```

**`headCompanyRef` 恒为 null**，`scopeName`/`scopeCode` 只是把 dataNodeRef 字符串回显，
并未解析真实组织事实。

**这与冻结需求相反。** 需求 §5.6.4（Dexter 2026-08-06 裁定）明确：
复制来源**唯一确定**为 `organization.store` 的 `head_company_id + brand_id`，
**不提供来源选择器，也不允许前端从名称、合同或层级自行推导**；
设计 §3.4 亦要求 `CatalogWorkbenchContext` 返回 nullable `headCompanyRef` 与 `copySourceAvailable`。

**影响范围**：**跨范围数据边界**。门店侧调用方可传入任意 `sourceDataNodeRef`，
把其它 scope 的商品复制进本店，只要它与目标不同即可通过。
同时"无 `headCompanyRef` 的门店不显示复制入口"这条 Dexter 裁决在后端没有任何事实支撑——
`copySourceAvailable` 无从计算。

**最小修复**：在 preflight 与 execute 两条路径的**最前面**，
由 organization owner 按目标门店解析 `headCompanyRef + brandRef`，
用解析结果**覆盖**（而非校验）请求中的来源；解析不到则拒绝并使
`copySourceAvailable=false`。请求体不应再接受 `sourceDataNodeRef`。

### M-02｜`stageOperationsCatalogAsset` 契约声明 multipart，实现却收 base64 JSON

**位置**：`CatalogInventoryApplicationService.java:307-312`（`stageAsset`）；
契约 `contracts/openapi/catalog-inventory.openapi.yaml`。
**依据类型**：契约与源码对照。

契约中该 operation 的 `requestBody.content` 键为 **`['multipart/form-data']`**（我实测解析）。
实现是：

```java
String encoded = required(request, "content", "");
byte[] bytes = Base64.getDecoder().decode(encoded);
```

即**从 JSON 字段读 base64 再解码**。我在 edge controller 侧检索
`multipart` / `MultipartFile` / `consumes` —— **零命中**，没有任何一处处理 multipart。

**影响范围**：违反"P2 只能实现 P1 字节、不得扩契约"这条 P2 的立身规则；
且与 P1 证据自己写下的约束直接冲突——
「Seed must upload real bytes through `stageOperationsCatalogAsset` **multipart/form-data**」。
后果是 P2 的 seed 无法按设计以真实二进制上传，且 base64 会让载荷膨胀约三分之一。

**最小修复**：edge 侧按契约接 `multipart/form-data`，把 part 的字节流直接交给
`assets.stageContent(...)`；若确实要改成 base64，**必须先重开 P1 改契约**，不能在 P2 私改。

### M-03｜品牌复制不复制分类与字典条目，闭包缺四类对象

**位置**：`CatalogOwnerService.java:117`（复制执行的唯一 INSERT）。
**依据类型**：仓内源码事实。

品牌复制执行路径中，catalog owner **只 `INSERT INTO catalog.catalog_item`**。
全文另有 `INSERT INTO catalog.catalog_category` 与 `INSERT INTO catalog.dictionary_entry`，
但它们只出现在 `createCategory` 与字典创建路径，**不在复制路径上**。
协调器 `coordinateCopyOwners` 会调 `inventory.copy` 与 `production.copy`（这点我确认属实，
最初误判为"只写一张表"，已自我纠正），**但没有任何一处复制分类与字典**。

需求 §5.6.3 的复制闭包目录要求一并按编码去重复制：
**商品分类、商品标签、销售单位、SKU 销售属性与属性值**。

**影响范围**：门店从品牌库复制一个商品后，其 `categoryRefs`、标签、销售单位、
SKU 属性值在门店侧若不存在，引用即悬空——正是需求当初要用闭包解决的问题。

**最小修复**：把这四类纳入 catalog owner 的复制闭包，按编码去重（已存在则沿用门店版本），
并在预检的 `closureItems[]` 中分组呈现。

### S-01｜`OWNER_REFERENCE_LEAK` 在设计中声明为 27/28 的 problemCode，但全仓未实现

**位置**：全模块与 app 层检索 `OWNER_REFERENCE_LEAK` **零命中**。
**依据类型**：设计与源码对照。

设计 §8.4 要求「任何目标图仍含总公司 owner ref 或映射缺失均整体失败」，
并把该码列入 operation 27/28 的 `problemCodes[]`。

**说明一点以免过度定性**：当前实现用 **code 作为引用身份**且复制时保留同一 code
（`INSERT ... VALUES (..., row.code(), ...)`），因此 `rewriteReferences` 的
`code → code` 恒等映射在这个身份模型下是**正确的**，泄漏概率本就低。
——我一度准备把恒等映射报成缺陷，核对 INSERT 后自我纠正。

但**断言缺失本身仍是问题**：它是设计声明的安全网，现在契约说会抛而实现永不抛。

**最小修复**：在写入前后各加一次断言（目标图不得含源 scope ref、映射不得缺项），
不满足即抛该 typed 码。

### S-02｜`collectReferences` 是按 key 后缀的盲扫，不是设计批准的 typed 边

**位置**：`CatalogOwnerService.java:~600`。
**依据类型**：仓内源码事实 + 设计对照。

```java
if ((key.endsWith("Code") || key.endsWith("ItemCode")) && entry.getValue().isTextual()) refs.add(...)
```

它遍历整个 `sections` JSON，**凡字段名以 `Code` 结尾就当作商品引用**，
再靠 `byCode.containsKey(ref)` 过滤掉非商品。

设计 §8.3/§8.4 要求闭包**只沿批准的正向边**扩张
（`CATEGORY`/`TAG`/`SALES_UNIT`/`SKU_ATTRIBUTE`/`PRODUCTION_TAG`/
`COMPOSITE_COMPONENT`/`BOM_COMPONENT`/`SKU`/`STOCK_TARGET`），且边是**有类型**的。

**影响范围**：一是所有字典类边被 `byCode` 静默丢弃——这正是 `M-03` 的成因；
二是任何业务字段只要恰好以 `Code` 结尾且取值与某商品编码相同，就会被误当引用拉进闭包。
另外预检的 `referenceRewritePreview` 每条 `referenceKind` 都硬编码为 `"ITEM_REFERENCE"`，
`fromCode` 与 `toCode` 相同，**无法呈现设计要求的逐类重写预览**。

**最小修复**：改为按 typed 边遍历（从 sections 的已知结构位置取引用并带 `referenceKind`），
不再用字段名后缀猜测。

### N-01｜正常路径 DB 次数我未做系统比对（评审范围声明）

设计为 42 个 operation 各声明了 `normalPathDbOperations.expectedCount` 与逐 owner 分解。
我抽看了 `closure()`（一次全量 scope 查询 + 内存 BFS，不产生逐项查询，方向正确），
但**没有对 42 个 operation 逐一比对声明值与实现的实际往返次数**——
静态读代码难以可靠计数，且该比对本应由 P2 的接口测试在 runtime 用
`databaseOperationCount` 完成，而 runtime 不在本轮授权内。

**建议**：在 P2 的 API 阶段把"实测 `databaseOperationCount` 与设计声明一致，
不一致须具名说明"落成断言，而不是只在日志里记录。**本条不阻塞。**

## 3. 静态与运行时结论的边界

**本评审的全部结论都是静态源码结论。** 我没有启动应用、没有连数据库、
没有跑接口测试或 L2、没有执行 seed/reset。因此：

- 我**不能**断言这些实现在运行时正确，也不能断言 26/100 个 API case 会通过；
- 我**不能**断言 migration 能成功施加，或 SQL 在真实 PostgreSQL 上语义正确；
- 反之，我报的三条 M 是**源码层可直接读出的事实**，不依赖运行时即成立。

## 4. 授权边界

本轮仅 P2 静态 implementation review。不授权修改契约或 generated artifacts、
数据库或 migration、seed/reset、DEV/UAT/HTTP/L2、runtime deployment 或 Git。
`M-01` 涉及跨范围数据边界，建议优先处置；
`M-02` 需判断是改实现还是重开 P1 改契约，**若选后者属产品/契约决策，需 Dexter 裁定**。

## 5. 我在本轮的自我纠正（如实记录）

我在两处险些报出错误 finding，均在提交前自查纠正：
一是看到 `rewriteReferences` 用 `code → code` 恒等映射时准备判为"重写是空操作"，
核对复制 INSERT 保留同一 code、且引用按 code 而非 UUID 后确认**恒等在该身份模型下正确**；
二是看到 catalog owner 复制只写一张表时准备判为"跨 owner 复制缺失"，
查到协调器 `coordinateCopyOwners` 确实调用了 `inventory.copy` 与 `production.copy` 后收窄为
`M-03`（只缺分类与字典，不是全部）。**结论以纠正后为准。**

---

## 6. P2 remediation current-byte 独立复核（新一轮，原 NO-GO 历史保留不改）

会话出处：fresh v2s-rooted 评审会话，非续接、非它仓。上文第 0–5 节为整改前的原始
`NO-GO M=3 / S=2 / N=1`，**原样保留，未做任何修订**。本节是对当前字节的重新核验。

### 6.1 结论

**NO-GO — M=1 / S=2 / N=2**

先把话说清楚：**Dexter 委托核验的七项，在当前字节上全部通过**，原 5 条 finding
（M-01/M-02/M-03/S-01/S-02）我逐条打开源码亲验，确认是真修复而非文字搬运。
本轮 NO-GO **不指向 P2 的业务实现**，只指向「为这次整改背书的门是假绿的」加两条工程缺口，
Codex 可用小范围改动收口，不需要返工。

### 6.2 七项核验逐条结果

| # | 核验项 | 结果 | 亲验依据 |
|---|---|---|---|
| 1 | 复制来源由 organization owner 判定 | **通过** | 协调器 `resolveBrandCopySource` 委托 `catalogScopes.resolveCatalogCopySource`；organization 侧校验目标必须 STORE、目标 `brand_id` 必须等于 `brandRef`、`head_company_id` 为空即拒、再 join `head_company_brand_authorization` 验授权，失败转 `SCOPE_FORBIDDEN`。客户端 `sourceDataNodeRef` 在协调器已无读取点 |
| 2 | 资产严格走 multipart | **通过** | 控制器 `consumes=MULTIPART_FORM_DATA_VALUE` + `@RequestPart MultipartFile`；且泛 JSON 分发路径**显式拒绝**该 operation，Base64 解码已彻底移除 |
| 3 | 闭包覆盖五类对象 | **通过** | `CatalogClosure(items, categories, dictionaries, edges)`；三张表均有 INSERT；引用类覆盖 CATEGORY/TAG/SALES_UNIT/SKU_ATTRIBUTE/SKU_ATTRIBUTE_VALUE，PRODUCTION_TAG 交生产 owner |
| 4 | 三 owner 具备泄漏防护 | **通过** | catalog/inventory/production 三处均有 `OWNER_REFERENCE_LEAK`；catalog 有三道，含**写后回读目标图**复验 |
| 5 | 显式 typed key，移除后缀猜测 | **通过** | `endsWith("Code")`/`endsWith("ItemCode")` 全文零命中，已换成 `referenceKindForKey` 显式枚举 |
| 6 | D-16 指纹绑定 preflightDigest | **通过** | `copyDigest` 对每个 item 拌入 `skuStructureFingerprint`（`skuCode -> sorted(attr,value)`），摘要变化即 `STALE_COPY_PREFLIGHT` |
| 7 | 红变异真实有效、证据哈希当期 | **哈希通过／红变异不通过** | 15/15 声明哈希与当前字节独立复算一致，零漂移；但红变异见 M-04 |

证据哈希复算说明：我最初把 `p2Checker` 与 `operationDesign` 判为漂移，是我的搜索根
未覆盖 `tools/` 与 `doc/review/`。全仓反查后两条均命中
（`tools/catalog-inventory-p2/cli.mjs`、`doc/review/platform/2026-08-06-v2s-catalog-inventory-backend-operation-design-contract.json`）。
**结论以纠正后为准：15/15 一致。**

### 6.3 Findings

#### M-04｜P2 checker 对权威旁路是假绿（已实证），而 evidence 宣称红变异自测 PASS

**仓内事实。** `tools/catalog-inventory-p2/cli.mjs` 全部 174 行断言都是对源码文本的
`.includes()` 存在性匹配。我在 scratchpad 拷贝上做了对照实验（基线先确认 PASS）：

- **变异 A（保留全部被断言字符串，仅反转行为）**：`resolveBrandCopySource` 照常调用
  `catalogScopes.resolveCatalogCopySource(...)`，但把返回值换成
  `request.path("sourceDataNodeRef").asText()`，即复制来源重新由客户端说了算。
  → **门 exit=0，`CATALOG_INVENTORY_P2_STATIC=PASS`**。
- **控制变异 B（仅重命名方法，行为不变）**：`resolveBrandCopySource` → `resolveBrandCopyOrigin`。
  → 门 exit=1，精确命中 `FAIL:APPLICATION_COPY_SOURCE_AUTHORITY_MISSING`。

即：门能发现**标识符消失**，发现不了**权威被旁路**——而后者正是 M-01 的缺陷类。
第 69 行更把当前文本形状固化成门（断言 `CatalogOwnerService` **必须仍然含有**
`required(request, "sourceDataNodeRef")`）。

**影响。** evidence 的 `p2RedMutationSelfTest: PASS` 高估了保障强度：它证明的是
drift 类变异可被拒，不是错误行为可被拒。CLAUDE.md 明令「不得用关键词/字段匹配把语义
伪装成 checker」「必须以真实 red mutation 证明能拒绝错误行为」，此处与该强制条款直接冲突。
**当前字节的行为是对的**，风险是未来回归无人拦截。

**最小修复。** 不要重写整个 checker。只把**安全边界那一条**（cli.mjs:53）从文本匹配换成
一个 focused 单测：构造带有伪造 `sourceDataNodeRef` 的 request，断言
`resolveBrandCopySource` 仍返回 organization 解析值。仓内已有
`CatalogSkuStructureFingerprintTest` 等 focused 测试，模式现成，成本是分钟级。
其余纯结构断言（数量、路由集合相等）保持文本匹配即可，不必升级。

#### S-03｜字典类按子串推断，而 `dictionaryKind` 在四处都没有定义域

**仓内事实。** 分类逻辑有两处都是 `contains()`：
`dictionaryKindMatches()`（`"SALES_UNIT"` 匹配任何含 `UNIT` 的 kind）与
`DictionaryRow.objectType()`（含 `TAG`→CATALOG_TAG、含 `UNIT`→SALES_UNIT，
**兜底分支无条件 `return "SKU_ATTRIBUTE"`**）。而 `dictionaryKind` 的取值域：
契约里是裸 `{"type":"string"}` 无 enum；migration 里是 `TEXT NOT NULL` 无 CHECK；
`createDictionary` 对它零白名单校验；设计文档全文只出现两次"字典"，均非定义。
**四处都没有权威取值表**，分类却依赖运营自己起的名字。

**失败场景（两个方向）。**
① 漏采导致误拦：运营把 SKU 属性字典命名为 `SPEC`（v4 里就叫"规格"，很自然）。
商品引用 `attributeCode`，`dictionaryKindMatches("SKU_ATTRIBUTE","SPEC")` 为 false
→ 该字典不进闭包 → 映射缺失 → 抛 `OWNER_REFERENCE_LEAK`，**一次合法复制被拦，且错误码
指向"越权泄漏"，运营无从定位真因**。
② 误采导致多复制：`UNIQUE(data_node_ref,brand_ref,dictionary_kind,code)` 允许同一 code
存在于不同 kind。若同时有 `SALES_UNIT/BOX` 与 `PACKAGE_UNIT/BOX`，引用 `salesUnitCode: "BOX"`
时两行都通过 `contains("UNIT")` → 无关字典条目被静默复制进目标门店，闭包计数也虚高。

**这与 S-02 是同一类做法**：整改把 key 侧的后缀猜测移除了，却在 kind 侧重新引入了子串推断。

**最小修复。** 把封闭 kind 列表落到已有的 `contracts/policy/catalog-inventory-copy-policy.json`
（该文件已在被消费，无需新建契约），`createDictionary` 按表校验、未知 kind 直接 422，
两处 `contains()` 换成精确查表。不建议扩大成新实体或新表。

#### S-04｜multipart 无体积上限，且超限错误逃逸契约信封

**仓内事实。** 全仓 `application*.yml` 无 `spring.servlet.multipart.*` 配置
→ 走 Spring 默认 `max-file-size=1MB`。`ContractProblemAdvice` 已正确注册新三 owner 的
`Problem` 类型，但**没有 `MaxUploadSizeExceededException` 处理器**；该异常不在 Spring MVC
`DefaultHandlerExceptionResolver` 处理清单内，会落到默认错误路径，返回非契约 body，
而契约对该端点只声明了 `200` 与 `4XX`。

**为什么种子语料测不出来。** 我实测 34 张种子图**全部小于 1MB**（最大 556KB，
`seafood-risotto.jpg`），所以 P1/P2 的资产用例在默认上限下全绿——**这个缺口在现有测试里
是不可见的**。但 Dexter 明确要求"商品支持多个图片上传"，运营手机拍的商品图普遍 3–8MB，
上线即撞，且拿到的不是可读的业务错误。

**最小修复。** 显式配置 `max-file-size`/`max-request-size`（与媒体资产策略取一致口径），
加一个 `@ExceptionHandler(MaxUploadSizeExceededException.class)` 映射到该端点已声明的
4XX problemCode。两处改动，不涉及设计变更。

#### N-02｜`_resolvedCatalogCopySource` 只写不读

`request.put("_resolvedCatalogCopySource", ...)` 在控制器与协调器各写一次，全仓无读取点。
当前无害（我据此确认它未构成第二权威入口），但它是留在 request 载荷里的死标记，
日后容易被误读成权威通道。建议删除，或明确其消费方。

#### N-03｜正常路径 DB 次数仍未做系统比对

同原 N-01，本轮范围未覆盖，`normalPathDbOperationDeclarations` 分母未逐条对账。
`DatabaseOperationTracker` 已由全局拦截器覆盖新端点，具备运行时核验条件，留待 P3/运行时轮次。

### 6.4 与既有后台的融合度（Dexter 本轮追加问题：有没有重复造轮子）

**结论：融合良好，未发现实质性重复造轮子。** 新域跨模块 import 的完整普查结果：

- `platform.foundation.time.TimeProvider` ×4 —— 三个 owner 与协调器**都注入了统一时间源**，
  没有自造时钟；checker 亦有 `System.currentTimeMillis()` 反向断言兜底。
- `platform.asset.application.PlatformAssetService` ×3 —— 资产字节走
  `assets.stageContent(...)` / `releaseCatalogStaged(...)`，并接住其幂等与认领异常。
  既有 `AssetObjectStorage` 头部写明"platform-asset owner 是唯一被允许搬运静态展示字节的业务层"，
  **新代码遵守了该主权声明，没有另起一套存储**；MinIO 对象存储也正是 Dexter 要的 CDN 就绪路径。
- `organization.api.CatalogScopeLookup` ×2 —— 跨 owner 走 api face，符合 `X_CONSUMER_FACES_ONLY`。
- `contracts.generated.*` ×3 —— 词汇绑定生成物，非手写常量。
- `app.edge.session.EdgeRequestContext` / `OperationsSessionResolver` —— 复用既有边缘会话设施。
- 错误处理接入既有 `ContractProblemAdvice`，未自建异常映射；路由用生成的
  `CatalogInventoryOperationRegistry`，未手写 URI 分发。

**唯一的重复项**是三个新 owner 各自实现了私有 `saveReceipt`/`envelope`/`required`。
但仓内已有 8 个 `*CommandReceiptService`，**彼此之间也没有共享基类或接口**——
即"每个 owner 自己实现幂等回执"本就是既有仓内惯例，新模块是**遵循惯例**，不是新增偏离。
按当前阶段标尺，全仓 11 处幂等实现的收敛属于 `HANDOFF.md` 欠账，不作为 P2 finding。

我原本以为这里有三处重复造轮子（时间源、资产存储、诊断埋点），逐一打开源码后**全部证伪**：
最初的 import 普查我用了错误包根 `com.catering.v2s.foundation`（实际是
`com.catering.v2s.platform.foundation`），导致 grep 全空。**结论以纠正后为准。**

### 6.5 方案合理性

- **问题对不对**：对。七项核验对应的都是真实业务风险——跨门店越权复制、资产字节主权、
  闭包不完整导致目标门店商品残缺、SKU 结构不兼容导致复制后价格/属性错乱。不是凑门。
- **方案优不优**：复制来源改由 organization 判定是正解，比"在 catalog 侧再验一遍 request"
  更短且单一权威；`copyDigest` 拌入结构指纹复用了已有 preflight 机制，没有新造 TOCTOU 设施。
  唯一偏弱的是字典分类，用子串推断替代了本该有的封闭枚举（见 S-03）。
- **代价配不配**：配。`CatalogOwnerService` 647→863 行，增量集中在闭包与兼容性校验，
  无过度抽象；复制上限外置为 `CopyLimitPolicy` 也满足了"后续要方便调整"。

UI：`NOT_APPLICABLE` —— P2 为后台/API 范围，前端 L2 属 P3。

### 6.6 授权边界

本节仅授权「P2 current-byte 静态 implementation 复核」这一件事。**不授权**：进入 P3、
OpenAPI/契约重生成、数据库或 migration 执行、seed/reset、DEV/UAT、HTTP/L2 运行时、
runtime deployment、cleanup。`api100CaseRuntime` 与 `l2Runtime` 在 evidence 中标注
`runtimeAuthority=false`，本轮不对其真实性作任何背书。红变异实验在 scratchpad 拷贝上进行，
用后即弃；本轮对本仓的写入仅限本文件。

M-04/S-03/S-04/N-02 均在既有批准边界内，可直接交 Codex 自主修复，不需要 Dexter 裁决。

---

## 7. P2 remediation 第二轮 current-byte 独立复核

会话出处：fresh v2s-rooted 评审会话。§0–5（原始 `NO-GO M=3/S=2/N=1`）与 §6（第一轮复核
`NO-GO M=1/S=2/N=2`）**均原样保留，本轮未做任何改写**；本节只追加当前字节的新结论。

### 7.1 结论

**GO — M=0 / S=0 / N=3**

上一轮四条（M-04 / S-03 / S-04 / N-02）逐条亲验确认闭合，且均为行为性修复而非文字搬运。
三条 N 为可延后的加固项，不构成 GO 障碍。

### 7.2 四条整改核验

**M-04（假绿门）— 闭合。** `CatalogCopySourceAuthorityTest` 是真测试而非占位：它构造
伪造 `sourceDataNodeRef`，用 stub lookup 返回 `approved`，断言
`resolveBrandCopySource` 的返回值等于 `approved` 而非 `forged`——**这正是我上一轮所做变异
所违反的性质**，该测试对那次变异是必红的。checker 已删除行为性文本断言，改为
`fs.existsSync` 存在性 tripwire（防测试被静默删除）；evidence 的
`p2RedMutationSelfTest` 已改为准确措辞「structural/drift mutations only; copy-source
authority behavior is covered by CatalogCopySourceAuthorityTest」，不再高估保障强度。
执行链亦已确认：该测试位于 `apps/backend/catering-business-server/src/test/java` 下，
属 `scripts/verify` 的 `U02-backend`（`:apps:backend:catering-business-server:test`）任务范围。
`NOT_EXECUTED_REMOTE_GUARD` 指该任务经 `scripts/test/r5-remote-testcontainers.mjs` 跑在
远程 Testcontainers 主机上，本轮与作者轮次均无 runtime 授权——属如实披露，不是规避。
`resolveBrandCopySource` 由 `private` 放宽为包内可见，是可测性所需的最小改动。

**S-03（字典类子串推断）— 闭合。** `contracts/policy/catalog-inventory-copy-policy.json`
与 catalog 模块 runtime resource 声明同一四值闭集 `TAG / SALES_UNIT / SKU_ATTRIBUTE /
SKU_ATTRIBUTE_VALUE`；`CopyLimitPolicy.load` 强制 `kinds.size() != 4` 即启动失败，
`allowsDictionaryKind` 用 `Set.contains` 精确成员判定。`dictionaryObjectType` 改为精确
switch、default 抛 `VALIDATION_ERROR/422`，兜底归为 `SKU_ATTRIBUTE` 的行为已消除。
create / read / update / reorder / transition 五个入口统一经 `requiredDictionaryKind`
→ `canonicalDictionaryKind` 校验，未知值 422；`dictionaryReferenced` 的 kind 由已校验的
transition 传入。`dictionaryKindMatches` 已改为 `referenceKind.equals(dictionaryKind)`。
字典相关的 `contains/indexOf/startsWith/endsWith` 子串归类全仓零残留。
`CatalogDictionaryKindTest` 以 `SPEC` 作为未知值反例——恰好是我上一轮举的失败场景。

**S-04（上传上限逃逸）— 闭合。** `application.yaml` 显式声明
`max-file-size: 5MB` / `max-request-size: 6MB`；`catalog-inventory-media-assets.json`
的 `uploadLimits` 声明 `maxFileSizeBytes: 5242880` / `maxRequestSizeBytes: 6291456`，
**与配置字节口径完全一致**。`ContractProblemAdvice` 新增
`@ExceptionHandler(MaxUploadSizeExceededException.class)` → `multipartTooLarge`，
返回端点已声明的 `VALIDATION_ERROR` / 422 契约信封；
`ContractProblemAdviceTypedOwnerMappingTest` 断言该映射并断言该异常类型在 declared 集合内。

**N-02（死标记）— 闭合。** `_resolvedCatalogCopySource` 在生产源码中零写入零读取，
仅存在于 checker 的两条否定断言与 focused test 的 `assertFalse` 中。

### 7.3 本轮独立红变异（scratchpad 拷贝，基线先确认 PASS，用后即弃）

| 变异 | 门结果 | 判定 |
|---|---|---|
| 删除 `CatalogCopySourceAuthorityTest` | `FAIL:COPY_SOURCE_AUTHORITY_FOCUSED_TEST_MISSING` | 红，精确命中 |
| 重新写入 `_resolvedCatalogCopySource` | `FAIL:DEAD_COPY_SOURCE_MARKER_REMAINS` | 红，精确命中 |
| 契约字典集改为含 `PACKAGE_UNIT` | `FAIL:DICTIONARY_KIND_POLICY_DRIFT` | 红，精确命中 |
| 权威旁路（保留全部被断言字符串） | checker 绿 | 符合预期：行为证明已移交 focused test，checker 只保结构 |
| `dictionaryKindMatches` 改回子串 | checker 绿、现有测试亦不覆盖 | 见 N-04 |

### 7.4 Findings（均为加固项，不阻断 GO）

**N-04｜`dictionaryKindMatches` 无行为测试覆盖。** 全仓无测试引用
`dictionaryKindMatches` / `loadDictionaries` / `closureGraph`；我把该方法改回子串匹配后，
checker 与 focused test 均不报错。**影响有限**：写入侧词汇已封闭（五个入口 422 拦截 +
启动期强制四值），库中不可能再出现 `PACKAGE_UNIT` / `SPEC` 这类 kind，S-03 描述的撞码与
漏采场景已基本不可达，该方法的精确性属纵深防御而非第一道防线。最小修复：在
`CatalogDictionaryKindTest` 追加一条断言（`dictionaryKindMatches("SALES_UNIT","SKU_ATTRIBUTE")`
为 false），一行成本。

**N-05｜evidence 中 DB 次数分母缺状态限定词。** evidence JSON 携带
`normalPathDbOperationDeclarations: 42`，但全文 `UNVERIFIED_REQUIRES_EVIDENCE` 出现 0 次；
该限定只写在 intake 文档第 123 行。checks 中确无 DB 预算 PASS 声明，**未把静态结果误报成
运行时结论**，本轮要求已满足。但单独阅读 evidence 的人可能把 42 误读为已核验数值。
最小修复：在 evidence 对应位置补 `UNVERIFIED_REQUIRES_EVIDENCE` 标记。

**N-06｜`CatalogOwnerService:199` 仍是「序列化后子串匹配」。**
`selectedSections.toString().contains("BASIC_INFO")` 把 JSON 数组转字符串再判子串。
这是 section 选择而非字典归类，不在 S-03 范围内；且九个 section 名两两无包含关系
（`BASIC_INFO` / `SKU_STRUCTURE` / `SKU_BOM` / `ORDER_OPTIONS` / `OPTION_VALUE_BOM` /
`ITEM_BOM` / `PACKAGE_STRUCTURE` / `PRODUCTION_PROMPTS` / `PRINT_NAME`），**当前行为正确**。
但它与本轮刚清除的是同一模式，日后新增一个含 `BASIC_INFO` 的 section 名即误判。
最小修复：改为遍历数组元素做 `equals` 比较。

### 7.5 方案合理性

本轮修复方向正确且克制：把行为证明从 checker 移交 focused test，而不是把 checker 写得更复杂；
字典闭集落在**已在被消费的** `catalog-inventory-copy-policy.json` 上，没有新增表、新增契约或
改 OpenAPI；上传上限与媒体策略共用一个字节口径，没有制造第二真相源。没有发现为凑门而做的改动，
也没有发现过度工程。

UI：`NOT_APPLICABLE` —— 本包为后台/API 范围。

### 7.6 哈希与分母

evidence `artifacts` 声明 27 条，独立复算**全部命中当前字节，零漂移**。
（我最初把 `activePackage` 判为漂移，是我的遍历排除了 `.runtime`；全仓反查命中
`.runtime/compliance-control/active-package.json`。**结论以纠正后为准。**）
checker fresh 复跑：`CATALOG_INVENTORY_P2_STATIC=PASS`，`OPERATIONS=42`，
`API_SCENARIOS=26/100`，`L2_SCENARIOS=18/43`，与 evidence 声明一致。

### 7.7 授权边界

本节仅授权「P2 current-byte 静态 implementation 复核」。**不授权**：进入 P3、
OpenAPI/generated 重生成、数据库或 migration 执行、seed/reset、DEV/UAT、HTTP/L2 运行时、
runtime deployment、cleanup。`CatalogCopySourceAuthorityTest` 与
`ContractProblemAdviceTypedOwnerMappingTest` 当前状态为 `COMPILED; NOT_EXECUTED`，
本轮**不对其执行结果作任何背书**——GO 的依据是静态数据流与门的红变异，不是测试已通过。
`api100CaseRuntime`、`l2Runtime`、N-03 DB 次数同样不在背书范围内。

N-04/N-05/N-06 均在既有批准边界内，可由 Codex 自主处置，不需要 Dexter 裁决。
