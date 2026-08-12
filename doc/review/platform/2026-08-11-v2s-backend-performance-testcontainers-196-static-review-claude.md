# BACKEND-PERFORMANCE-TESTCONTAINERS-196 静态实施 —— Claude 独立复核（含四路对抗审查）

`VERDICT=NO-GO`　`M=7`　`S=6`　`N=3`

## 0. 给 Dexter 的结论

**一、"一直过不了"的原因不是代码到处都坏。** 194 个运行事件里只有 **1 个**失败，
191 次调用与 26 个 fixture 全部正常。

**二、但代码质量有严重问题，而且是测试**测不出来**的那种。**
本轮四路对抗审查找出 **7 个 M 级缺陷**，其中三个会造成**静默数据丢失、跨租户串扰、
或功能完全不可用**——它们**全部通过了现有全部静态门**。

**三、最要紧的一句话**：这套 196 行矩阵、形态门、拓扑门验证的是**结构**
（一个事务起点、typed 边界、一类一操作、形态声明），
**没有任何一道门验证行为正确性**。下面每一条 M 级缺陷在门全绿的情况下都成立。

**四、验证循环本身是坏的**：即使修好全部缺陷，当前 harness 一次数小时的运行
**仍只能暴露一个失败**，且首败码恒为 `UNCLASSIFIED`。这是"跑了几小时"的直接代价来源。

## 0.1 会话出处、方法与披露

续接会话，非 fresh acceptance。本仓零写入（除本文件）。未启动任何动态环境。

**方法**：我先亲自定位首败根因，再派**四路独立对抗 agent**分头审
owner 正确性 / 契约符合性 / harness 与证据 / 性能回归，
并明确要求"假设代码是错的、给出 file:line"。
**agent 结论我不采信**——下文标 `已亲验` 的条目是我逐条打开源码或直接执行谓词复核过的；
未标注者标 `AGENT_REPORTED_UNVERIFIED`。

**一项披露**：复核中途 `/Volumes/idea`（SMB）掉线导致全仓不可读，Dexter 重挂后才完成。

---

## 1. 首败根因（`CONFIRMED` · 已亲验）

`CatalogOwnerService#copyLocal:722` 只发 `mappings`（`fromCode/toCode/referenceKind`）：

```java
data.putArray("mappings").addObject().put("fromCode", …).put("toCode", …).put("referenceKind", "CATALOG_ITEM");
```

而契约要 `referenceMappings`（`objectType/sourceRef/targetRef/targetCode/…`）。
`CopyPreflightWireShape:90` 抛「missing: referenceMappings」→ 被 `catch (Exception)` 吞 → 500 `RESULT_UNKNOWN`。

**作者判断的"brand 同族风险"经证据不成立**：brand 在 `:673` 发 `mappings`、`:675` 发 `referenceMappings`，
**两个都发**，其余 3 条 shim 路径字段齐全。**这是全仓唯一的硬失败点。**
修复是在 `:722` **增补** `referenceMappings`（按契约 item 形状），不是改名。

---

## 2. M 级缺陷（全部通过了现有静态门）

### M-01｜库存 CAS 可被绕过 —— 并发写静默丢失，HTTP 200（`CONFIRMED` · 已亲验）

`InventoryOwnerService.java:225` 复核允许 `expectedVersion + 1` 通过：

```java
if (current.version() != expectedVersion && current.version() != expectedVersion + 1L) throw VERSION_CONFLICT;
```

`:273` 的写入 CAS 却绑定**重读回来的** `row.version()`，**客户端的 `expectedVersion` 从未进入任何写谓词**：

```java
UPDATE inventory.stock_target SET balance=?,version=version+1,… WHERE target_ref=? AND version=?   // row.version()
```

**对照组精确**：同类的 `updateTargetConfiguration:214` 绑定的是 `command.expectedVersion()`，因此会正确 409。

**失败场景**：目标 v5/余额 100 → B 增加 50 得 v6/150 → A 提交 count=100 且 expectedVersion=5 →
复核 `6 == 5+1` **通过** → 写入 `WHERE version=6` **成功** → 余额回到 100、v7。
**B 的 50 件静默消失，返回 200，无 `VERSION_CONFLICT`。**

**影响面**：`countTarget:137` / `increaseTarget:162` / `adjustTarget:190`，
经 3 条 M1 操作（Count/Increase/Adjust OperationsInventoryTarget）暴露。
**最小修复**：`writeTypedInventoryChange` 绑定 `command.expectedVersion()`。
`+1` 容差应仅用于让**重放**到达 receipt 查找，不得进入写谓词。

### M-02｜`VOIDED` 状态流转无条件损坏（`CONFIRMED` · 已亲验）

`TransitionOperationsCatalogItemStatusOperation.java:24` 传的是**业务码**：

```java
inventory.catalogItemVoidDependencies(context, invocation.itemCode())
```

而 `InventoryOwnerApi.java:142` 形参是 `String itemRef`，
`InventoryOwnerService.java:669` 用 `opaqueRef(itemRef, "itemRef")` 按 **UUID** 解析。

**失败场景**：`POST /items/ITEM-0001/status` `{"targetStatus":"VOIDED"}` →
`UUID.fromString("ITEM-0001")` 抛 → 422 `REFERENCE_MAPPING_UNRESOLVED`。
**每一次作废都失败，且错误信息指向一个不存在的引用映射问题。**
反向更危险：若某商品业务码恰为 UUID 形状，则查询匹配不到任何行、
`hasDependentFacts=false`，**在有活跃库存目标/BOM 的情况下照样作废**。

**旁证**：legacy 路径 `CatalogInventoryCoordinator:294` 先 `catalogItemRef(...)` 解析 code→ref 再判断。
**最小修复**：在 owner 内解析 ref，不要在 adapter 里 UUID 化。

### M-03｜contract / asset 的幂等 receipt 未按 workspace 隔离（`CONFIRMED` · 已亲验）

`ContractCommandReceiptService.java:22-23`：

```java
jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtext(CAST(? AS text)))", key);
… "SELECT … FROM contract.contract_command_receipt WHERE idempotency_key=?" …
```

DDL `V20260726_090000_000…sql:168`：`contract_command_receipt (idempotency_key VARCHAR(128) PRIMARY KEY, …)`。
**对照**：organization 的同类服务是 `hashtext(? || ':' || ?)` + `WHERE workspace_uuid=? AND idempotency_key=?`。
仓内另外四个 receipt 服务全部按 workspace 隔离。

**失败场景**：`Idempotency-Key` 是客户端原始请求头。
租户 A 用 `0123456789abcdef` 建合同；租户 B 在**另一个 workspace** 用同一字符串发任意合同命令 →
命中该行、hash 不同 → 永久 409。**B 的这个键被永久占用，且构成跨租户键存在性探测。**
无关租户还会在同一 advisory lock 上串行。
**最小修复**：主键、advisory lock 与 SELECT 全部加入 `workspace_uuid`。

### M-04｜最高频写入的 receipt 前版本复核是死代码（`CONFIRMED` · 已亲验）

`CatalogOwnerService.java:506-507`：

```java
long expected = requiredLong(request, "expectedVersion", -1);
if (expected >= 0 && current.version() != expected && …) throw VERSION_CONFLICT;
```

但 `CatalogItemSaveRequest(Sections sections, String dataNodeRef, String itemCode)` **顶层没有 `expectedVersion`**；
`requiredLong:2350` 在字段缺失时返回 fallback `-1`；`-1 >= 0` 恒假 → **守卫永不触发**。
`saveItem:1167-1169` 自己是正确的（先读 `sections.expectedCatalogVersion`）。

**失败场景**：商品 v5，客户端带 `Idempotency-Key: K` 保存得 v6 并写入 receipt；
他人改到 v7；客户端网络层重试 K → 版本复核被跳过 → 返回**过期的 v6 readback** 冒充当前状态。
这正是该方法 `:497-502` 自述要防止的事。
**最小修复**：`:506` 与 `saveItem` 共用同一版本解析helper。

### M-05｜typed owner 边界是门面，绕过了门（`CONFIRMED` · 已亲验）

```java
CatalogOwnerApi.java:126   record CopyExecutionReadback(String canonicalJson) { }
Coordinator.java:348       record LocalCopyExecutionReadback(String canonicalJson) { }
```

record 唯一字段是装原始 JSON 的 `String`。对照 delete 的
`value.categoryRef()/deletedSubtreeSize()/deletedCategoryCodes()` 才是真 typed。
**门禁的是 `Map`/`ObjectNode`/`JsonNode`/`Function`——`String` 一个都不沾，必然放行。**
于是"用 record 包一个 JSON 字符串"成为合法绕行路径，
而 M-01 这类字段偏离在这条路径上**没有任何一层会拒绝**。

**最小修复**：把 copy 的 owner 输出改成具名组件的真 typed readback，由编译器接管字段完整性。
**新增门断言**：公开 owner readback record 不得只有单一 `String` 且字段名匹配
`canonicalJson|json|payload|body`。

### M-06｜`catch (Exception)` 同时销毁诊断并回滚已完成的业务写入（`CONFIRMED` · 已亲验）

`ExecuteOperationsLocalCatalogCopyOperation:27-28`（`Preflight…:24-25` 同形），位于 `@Transactional(REQUIRED)` 内：

```java
catch (Exception failure) { throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "…readback is invalid"); }
```

① 投影异常里**本来就写着缺哪个字段**，被整个丢弃；
② owner 写入（`INSERT INTO catalog.catalog_category/…`）已完成，
一个**展示层映射失败**导致整笔业务命令回滚，且因映射必然失败而**重试永不可能成功**。

**最小修复**：只捕获具体投影异常并把 message 带进 Problem detail。

**`DEXTER_DECISION`（2026-08-11 已裁决）**：
关于"写入已成功但响应投影失败时该提交还是回滚"——
**Dexter 裁定：保持回滚（现状），并通过 M-05 从根上消除该分支，不在提交/回滚之间做取舍。**

依据：响应投影是纯内存字段拼装，不涉及网络与数据库，因此失败是**确定性的**而非偶发——
本次即为永远失败，重试不可能成功。在此前提下"写入保留 + 响应降级"会制造
**"报告失败但数据实际已写入"**的状态：客户端收到 500 判定未成功，重试时幂等回放又返回同样的失败，
数据在库中而调用方永不知情。该状态需要一整套对账机制才安全，代价与收益不匹配。

**因此实施要求**：
① 保持异常回滚语义，不新增"提交但降级响应"的路径；
② 按 M-05 把 copy 的 owner 输出改成具名组件的 typed readback，
使字段完整性由**编译器**保证，从而"响应投影失败"这一分支在结构上不存在；
③ 在 ② 落地前，`catch` 必须携带具体缺失字段信息（本条前半部分）。

### M-07｜非 canonical 模式结构上永远不可能 PASS（`CONFIRMED` · 已亲验）

> **分类说明（自查后补）**：M-01…M-06 是**生产代码**缺陷，会在真实使用中造成数据或语义后果；
> M-07 是**验证链**缺陷，不影响线上行为，但会使 API 闭环**永远无法宣告通过**。
> 两者严重度相当但性质不同，实施时不应混在同一批。

`catalog-inventory-api.mjs:1592`：

```js
: failCount === 0 && caseResults.length === 100
```

而场景目录实际是 **26 scenarios / 99 cases**（`caseCount: 99`，我独立数过）。
唯一的 `runCase` 调用点在那个 99 条的循环内，`caseResults.length` 上限就是 99 → **谓词不可满足**。
自测更矛盾：`:131` 断言 `caseCount === 99`，`:155` 却打印 `API_CASE_DENOMINATOR=100`。

**根因可追溯**：99 是 CI-API-007 被改为 `NOT_APPLICABLE_WITH_REASON`（零可执行 case）的结果——
**那条修改是我上一轮 review 通过的，而这个硬编码的 100 没有跟着改。这是我漏掉的连带影响。**
**最小修复**：`caseResults.length === allCases.length`；`:155` 由 `scenarios.caseCount` 派生。

---

## 3. S 级：为什么一次运行只能学到一个比特

### S-01｜首败码恒为 `UNCLASSIFIED`（`CONFIRMED` · 已亲验，我直接执行了该谓词）

`…-remote-workload.mjs:27-31` 的 `safeCode` 只读 `value.code`，
而该文件**每一处**都是 `throw new Error('CODE')`、从不设 `.code`，`message` 从不被读。
我执行：`safeCode(new Error('BP_U06_REMOTE_WORKLOAD_CATALOG_HTTP_FAILED'))`
→ **`BP_U06_REMOTE_WORKLOAD_UNCLASSIFIED_FAILURE`**。
`AGENT_REPORTED_UNVERIFIED`：agent 称这是回归（更早的 run 目录记录着精确码），我未逐个复核那些目录。
**最小修复**：`typeof value === 'string' ? value : (value?.code ?? value?.message)`。

### S-02｜父进程校验子报告"存在"却从不读它（`AGENT_REPORTED_UNVERIFIED`）

`runChild:175-181` 只返回 `{code, signal}`；`:230` 断言日志文件存在但不读一个字节。
**精确码就躺在磁盘上**——`catalog-inventory-api-runtime-report.json` 里写着
`BACKEND_PERFORMANCE_CANONICAL:BP_U07_LOCAL_COPY_EXECUTE_HTTP_500_RESULT_UNKNOWN`（这一条我亲验过）。
**只修 S-01 无效**，S-02 在它前面就把子进程的码换成了自己的通用 message。两条必须一起修。

### S-03｜canonical 失败把已测得的操作列表清成 `[]`（`AGENT_REPORTED_UNVERIFIED`）

`catalog-inventory-api.mjs:1240` 在 catch 里写 `operationIds: []`，丢弃了已积累 23 个 id 的 `seen`。
agent 从 `report.calls` 重算得：**42 条中 23 条已发起、22 条成功、1 条被拒、19 条从未发出**，
而报告显示 `0`。工程师因此无法区分"死在第 1 条"与"死在第 23 条"。

### S-04｜`SHARED_FIXTURE_BARRIER_FAILED` 是硬编码字面量（`AGENT_REPORTED_UNVERIFIED`）

`:1244` 的 `else` 覆盖两个互斥原因；本次为假的那个合取项是 `!performanceCanonicalMode`，
屏障本身是 PASS（报告里 `sharedFixtureBarrier: {"status":"PASS"}` 这一条我亲验过）。
**没有任何变量被查询，理由是字面量**——这就是那处自相矛盾的全部来源。

### S-05｜`cleanup: PASS` 与证据自毁（`AGENT_REPORTED_UNVERIFIED`，但结论重要）

agent 称 stall 路径 `rm -rf -- "$root"` 会删除 `http-request-events.jsonl`、`db-operations.jsonl`、
workload 结果与子报告（均未先 rsync），而 `cleanup.status` 仅由"进程已死 + 目录已删"推导；
`reap()` 内**零 docker 命令**且 Ryuk 已禁用，被 `kill -KILL` 的 JVM 必然遗留容器。
agent 统计 256 个 run：**94 个 `business FAIL` 全部报 `cleanup PASS` 且 `lastKnownGood: CLEANUP`**。
**这条若成立，意味着 `cleanup=PASS` 不能作为清理证据使用。建议优先复验。**

### S-06｜顶层制品把业务失败归咎于容器清理（`AGENT_REPORTED_UNVERIFIED`）

`r5-remote-testcontainers.mjs:532-535` 把三个独立条件折叠成一个码，
在 `containerCleanup/volumeCleanup` 均为 PASS、仅 `gradleStatus=1` 时，
仍向 `doc/evidence/` 写入 `REMOTE_TEST_OR_CONTAINER_CLEANUP_FAILED`——
把工程师引向 Docker，而真因是一个 500。

**agent 对"修好已知 bug 后一次重跑能否暴露全部剩余失败"的结论：不能，只能暴露下一个。**
三道独立 fail-fast 墙（`:236` 抛出、canonical 无 per-op try/catch、`runCase` 在 canonical 模式被排除）。
按其测算最坏需 **≈67 次**串行远端运行。**这与我独立观察到的 0/196 与 19 条未发出一致。**

---

## 4. 性能：优化包自身引入/遗留的冗余（`AGENT_REPORTED_UNVERIFIED`，需复验）

我亲验的一条：`CatalogInventoryCoordinator:363-368` 在 execute 内**把整个 preflight 又跑一遍**
来重算 digest 做 CAS；且 adapter 传入的 `catalogPreflightDigest` / `referencePlanJson` 是 `""`，
被 coordinator 全部丢弃重算——**两个承载 CAS 语义的字段是死参数**。

agent 另报（未逐条复验，按代价排序）：

| 位置 | 问题 | agent 估算 |
|---|---|---|
| `CatalogOwnerService:849-857` | `assetReferencedAnywhere` 是**无 scope 的全表扫描** `SELECT sections::text FROM catalog_item`，每删一张图跑一次 | P 次全表扫描 |
| `InventoryOwnerService:412-464` | local copy 源闭包被走 **4 次**（`:417/:418/:436/:463`），加 coordinator 一次共 5 次 | ≈40 次冗余 |
| `CatalogInventoryCoordinator:215-224` | saveItem 把同一商品详情读两遍；每个 SKU 一次 owner 命令 | 6 SKU ≈30 次 |
| `OperationsStoreManagementController:78` | 一次 PATCH 开 **5 个事务起点** | 4 次多余 |
| `CatalogOwnerService:1491-1494` | brand preflight 三次**完全相同**的 `loadItems` | 2 次纯浪费 |
| `PlatformAssetService:227-240` | 每次写后重读自己刚写的行 | 每图 1 次 |

agent 另指出 `backend-performance-operation-database-shape-matrix.json` 的 `BPF-SHAPE-023`
声明 `ownerCount: 1`，而含 inventory section 时实际调用**两个** owner——
若属实，属 `PER_OPERATION_DESIGN_CONTRACT` 的声明失真。

---

## 5. 契约符合性全量结果（`AGENT_REPORTED_UNVERIFIED`，分母可信）

agent 给出分母：196 条中 191 条有 2xx JSON schema（190 条 `additionalProperties:false`），
**逐字段打开比对的生产者 19 个，发现偏离 4 个**；
其余 65 条 adapter 用位置构造 record，**名称错配在编译期即不可能**。

- **硬失败 1 条**：即 §1 的 `copyLocal`。**全仓只有 4 个 adapter 用 `treeToValue`，因此只有它们能硬失败。**
- **静默偏离 3 条**：`getOperationsCatalogNavigation:972`、`getOperationsCatalogItems:991/1047`、
  `getOperationsCatalogShapeManifest:1142` 发 `{revision,requestId,data}` 信封，
  而这三个闭合 schema 要求平铺字段。读路径经 `convertValue(value, Object.class)` **无校验**，故不报错。
  **方向曾存在真实歧义**：Java 生成器按 schema 字面生成（=> 这三个错），
  TS 生成器给**每个**响应套 `CatalogInventoryEnvelope<T>`（=> 这三个对、另外约 11 个双层）。
  前端 `catalogModel.ts:256` 用三路 fallback 吸收了差异，当前无用户可见故障。

  **`DEXTER_DECISION`（2026-08-11 已裁决）：统一为信封形状
  `{revision, requestId, data}`，以既有的 `CatalogDictionaryView` 为准——
  判定生产者正确、schema 错误。**

  **因此要改的是 OpenAPI，不是后端代码**：
  `CatalogNavigationView`、`CatalogItemPage`、`CatalogShapeManifestView` 三个 schema
  改为信封形状，把现有平铺属性整体下沉进 `data`，顶层置 `revision` / `requestId`。

  **可行性我已亲验**：三个生产者 `data` 内的字段与各自平铺 schema 的 required 完全一致
  （navigation = `tree/smartViews/shapeCounts/uncategorizedCount/generation`；
  items = `items/total/cursor/generation/queryGeneration`），故改动是机械的，后端零改动。

  **两处实施注意**：
  ① `CatalogShapeManifestView` 当前是混合形状——平铺但 required 里已含 `revision`；
  改信封时 `revision` 须提到外层，且确认生产者未在 `data` 内重复一份；
  ② 改完后前端 `catalogModel.ts:256` 的三路 fallback 应收敛为单路，否则歧义会以另一种形式留存。

  **补充裁决（2026-08-11）**：`getOperationsCatalogItem`（`CatalogItemDetail`）**一并统一为信封**。
  因此本次改动共 **4 个** schema：`CatalogNavigationView`、`CatalogItemPage`、
  `CatalogShapeManifestView`、`CatalogItemDetail`。
  全族统一后，前端 `catalogModel.ts:256` 的三路 fallback 才可能真正收敛为单路；
  留任何一个例外，fallback 就必须保留，歧义会换一种形式继续存在。

### 附｜`assetReferencedAnywhere` 的作用域（2026-08-11 `DEXTER_DECISION`）

`CatalogOwnerService:849` 的 `assetReferencedAnywhere(String assetRef)` 不带
`dataNodeRef` / `brandRef`，查的是整张 `catalog.catalog_item`（所有数据节点、所有品牌）。

**Dexter 裁定：图片资产是全局共享的，因此当前的全局语义是正确的，不是缺陷。**

**因此实施要求（重要，防止被"顺手修正"）**：
① **不得**为该查询补 `data_node_ref` / `brand_ref` 谓词——那会破坏预期的全局共享语义，
   使一个节点释放掉另一个节点仍在引用的资产；
② 该处**只做性能修复**：把 `CatalogInventoryCoordinator:551-555` 里"每删一张图跑一次全表扫描"
   改为一次批量查询（如 `Set<String> assetRefsStillReferenced(Set<String> refs)`），
   语义、返回值与判定结果必须与逐条调用完全等价；
③ 同一循环内 `:553` 的 `assets.require(...)` 仅为读取 version 再原样回传作 `expectedVersion`，
   不提供任何乐观并发保护，可一并去除，由 asset owner 在自己的命令内读当前版本。

---

## 6. 元结论：门为什么全绿

把上面 7 个 M 级缺陷放在一起看，**没有一个是"忘了写"**，全都是**没有任何机制会拒绝**：

| 缺陷 | 为什么门抓不到 |
|---|---|
| M-01 CAS 绕过 | 门查事务起点与形态，不查写谓词绑定的是哪个变量 |
| M-02 code/ref 混用 | 两者都是 `String`，编译器与门都无从区分 |
| M-03 receipt 未隔离 | 门查幂等**声明**，不查 SQL 谓词与主键 |
| M-04 死复核 | 门查"复核在 receipt 之前"，不查复核是否有效 |
| M-05 门面 typed API | 门禁的是 `Map`/`JsonNode`，`String` 合法 |
| M-06 吞异常 | 无任何门检查异常处理 |
| M-07 100 vs 99 | 无任何门检查 harness 自身的判据 |

**准确的表述是**（自查后收紧，原文"没有任何门验证行为"过于绝对）：
**静态门集验证的是拓扑与声明**——196 行矩阵、形态地板、单事务起点、typed 边界，全部是结构性断言；
仓内**确有**行为层验证，但只有两处，且都够不着这些缺陷：
① 读预算门在**运行时**核对每请求 DB 次数——它管的是数量，不管写谓词绑定了哪个变量；
② 动态 workload 是唯一的端到端行为验证，而它本身正因 §3 的四个缺陷处于**又瞎又只跑一条**的状态。

换句话说：能发现这七条的那一层，恰好是当前坏掉的那一层。

因此我的建议不是再加几条门，而是：**把"行为正确性"明确登记为门管不住的部分**
（现有 standards-coverage 已有 `UNENFORCEABLE_BY_MACHINE` 这一类），
并为 CAS、幂等隔离、code/ref 类型混用这三类各补一条**可机械判定**的窄断言——
它们恰好都是能机械判的（写谓词绑定源、receipt SQL 是否含 workspace 列、
owner API 形参名与实参来源的命名一致性）。

---

## 7. 修复顺序建议

**第一批（阻断，必须在下一次远端运行之前）**：
M-01、M-02、M-03、M-04 —— 四个行为缺陷，与性能无关，但会造成数据丢失/串扰/功能不可用。

**第二批（让验证循环可用）**：
S-01 + S-02 一起修（只修一个无效）、S-03、S-04、M-07 —— 目标是**一次运行给出精确码与完整进度**。
若不做这一批，即使缺陷全修好，仍需按 agent 测算的 ≈67 次串行运行逐个发现。

**第三批**：M-05（真 typed readback）、M-06、§1 的 `referenceMappings` 增补。

**第四批**：§4 性能冗余与 §5 契约歧义（后者先要 Dexter 裁决方向）。

---

## 8. 结论

**NO-GO**（M=7，S=6，N=3）。

**测试通过与否与代码质量是两件事**——这正是 Dexter 的判断，而且被证据支持：
唯一的运行失败是一个可以一行修复的字段名，
而**真正危险的四个缺陷（M-01…M-04）根本不会让任何测试变红**：
它们分别是静默丢数据、返回 200、跨租户 409、以及返回过期快照。

**这些缺陷全部通过了当前全部静态门**，因为门验证拓扑而不验证行为。
本轮我用四路对抗审查才把它们翻出来，其中三条（CAS 绑定、code/ref 混用、receipt 未隔离）
我逐条打开源码与对照组亲验，一条（safeCode）我直接执行了谓词。

**授权边界**：本 NO-GO 意味着当前字节不可进入下一轮动态验证。
不授权 Testcontainers、L2、reset、DEV、seed、UAT、部署；
不授权修改 HTTP/OpenAPI 契约、删除 fixture、放宽门、绕过 remote-only guard 或以重试制造 PASS；
**不构成任何性能数值成功声明**。
