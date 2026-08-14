# v2s 后端代码审查 · 已确认问题登记(持续更新)

- 性质:问题登记册。来源为多个独立审查 agent + Claude 亲验。**未亲验的条目已显式标注。**
- 范围:`apps/backend/catering-business-server`,571 个生产 `.java` / 33562 行。
- 状态:**第二轮已收口**。第一轮 3 份 agent 报告(健壮性与过度设计、重复代码、数据持久化)+ 4 份中止报告的碎片(§6b);第二轮 3 份(多租户隔离、M-05~M-07 证伪、v4 建模对照)全部回收;契约生成链与分层命名由 Claude 亲验补齐。
- **第二轮的两个方向性结果**:① 新增 **M-11**——唯一确认的跨租户数据泄露,四环全验;② **M-05 / M-06 / M-07 三条全部被证伪或降级**,原因是它们都建立在"没打开源码就下的推断"上。**证伪比新增更值钱**——见 §0。
- 覆盖对照 Dexter 五点:① 健壮/高效/简单 → §1 M-01~M-07、§2 S-11~S-15;② 不重复造轮子 → S-06~S-10、S-17;③ 该用生成物却手搓字符串 → **M-08**;④ 分层命名可接手 → S-16、S-18、§3 文件规模;⑤ format → §3。**五点均有亲验结论,无一项停在 agent 报告级。**

---

## 0. 亲验状态说明

| 标记 | 含义 |
|---|---|
| ✅ **亲验** | Claude 已打开源码逐字确认,行号与内容一致 |
| ⚠️ **未验** | agent 报告,Claude 尚未独立确认 |

本会话已发生 4 次"只看大概就下结论"的错误(F-41 判 CONFORM、197 provider 误判、X-04 误判必 422、JSONB 全表扫无依据),故未验条目一律不得当作事实引用。

---

## 1. M 级 · 会导致生产故障或数据错误

### M-11 ✅ 亲验(四环全验)· **跨租户库存流水泄露**——三个读端点完全没有租户谓词

> **本轮最严重的一条,也是整个审查里唯一确认的跨租户数据泄露。四个环节我逐个打开源码验过。**

**环节一 · 三个 owner 方法没有 scope 参数,也没有 `requireScope`**(`modules/inventory/.../InventoryOwnerService.java:45-81`)。同一段代码里六个读方法**紧挨着**:

```java
:46  readTargets(String dataNodeRef, String brandRef, …)            { requireScope(dataNodeRef, brandRef); … }   ✅
:52  readTarget(String dataNodeRef, String brandRef, …)             { requireScope(dataNodeRef, brandRef); … }   ✅
:58  readTargetChangeSummary(String targetRef, String period)       { return changeSummaryData(targetRef, period); }   ❌ 无 scope 参数
:63  readTargetBusinessHistory(String targetRef, …)                 { return history(requestId, targetRef, request); }  ❌
:68  readTargetConsumptionReferences(String dataNodeRef, String brandRef, …) { requireScope(…); … }               ✅
:74  readTargetLedger(String targetRef, …)                          { return ledger(requestId, targetRef, request); }   ❌
```

**环节二 · 底层 SQL 只有 `WHERE target_ref=?`**——`stock_ledger` 的全部 12 处 SQL 逐条看过,**没有任何一条带租户谓词**(`:331 / :339 / :345 / :1109 / :1121 / :1206 / :1337 / :1339 / :1379 / :1380`)。

**环节三 · 表本身没有租户列,DB 层无兜底**(`V20260806_120000_000:88-98`):

```sql
CREATE TABLE IF NOT EXISTS inventory.stock_ledger (
    entry_ref UUID PRIMARY KEY, target_ref UUID NOT NULL, operation_id TEXT NOT NULL,
    delta NUMERIC(24,6) NOT NULL, balance_before NUMERIC(24,6) NOT NULL, balance_after NUMERIC(24,6) NOT NULL,
    reason_code TEXT, note TEXT, occurred_at_epoch_millis BIGINT NOT NULL);
```

**环节四 · 控制器解析出了 scope,然后不传**(`OperationsCatalogInventoryController.java:151-179`)。六个端点**每一个都在同一行**跑 `ReadRequest read = readRequest(context, query, path, STORE_SCOPE);`,`read.dataNodeRef()` 就在手上:

| 端点 | 是否传 scope |
|---|---|
| `/inventory-targets/{targetRef}` | ✅ `read.dataNodeRef(), read.brandRef()` |
| `/inventory-targets/{targetRef}/changes` | ❌ **只传 targetRef** |
| `/inventory-targets/{targetRef}/business-history` | ❌ **只传 targetRef** |
| `/inventory-targets/{targetRef}/consumption-references` | ✅ |
| `/inventory-targets/{targetRef}/ledger` | ❌ **只传 targetRef** |

**实际后果**:任一租户的已认证运营用户,只要会话自身具备任意 STORE scope(`STORE_SCOPE` 只校验会话**自己**有门店),就能对**任意** `targetRef` 拉取:

- `/ledger` —— 完整库存流水:`entry_ref, operation_id, delta, balance_before, balance_after, reason_code, occurred_at`,**可分页全量拉**;
- `/changes` —— 任意时间窗的进/出/笔数聚合;
- `/business-history` —— 业务变更历史。

唯一门槛是知道目标 UUID(v4,不可枚举)。**跨租户,也跨本租户内的其他门店。**

**最小修复(一处模式已现成)**:把三个方法签名补上 `dataNodeRef, brandRef`,与紧邻的 `readTargetConsumptionReferences:68` **完全一致**;实现里先 `requireScope(...)` 再走 `target(scope, brand, targetRef)`(`:1324-1327` 已是三谓词查询,不命中即 404),然后才查 ledger;控制器 `:160 / :166 / :178` 补传 `read.dataNodeRef(), read.brandRef()`。
**不建议**给 `stock_ledger` 加租户列——复用 `target(...)` 改动面最小,且与既有模式一致。

**为什么没被任何门抓到**:三个端点各自**内部自洽**、编译通过、类型正确、有测试也会绿——缺的是"同一资源的六个端点,scope 处理必须一致"这条**跨端点判据**,没有任何机器门在做。这正是 `v2s-evidence-falsifiable-criterion-standard` 说的"存在性判据抓不到语义"。

### M-12 ⚠️ 部分亲验 · 隔离扫描的其余四条(按可利用性排序)

同一轮扫描的其余产出。**M-11 我四环全验;以下四条我只验了结构,未逐环追到底,标 ⚠️。**

**【1】catalog 图片资产可被跨租户认领与释放。** `PlatformAssetService:259` 的 early-return(`if ("ACTIVE".equals(current.status()) && "CATALOG_ITEM_IMAGE".equals(current.usage())) return current;`)**在 workspace 校验之前**;`:420` / `:439` 两条释放 UPDATE **无 workspace 谓词**,而同文件 `:289` 的同表释放**是带的**。
**对立证据必须一并交裁**:`:252-256` 的注释写着这是有意的——"deliberately reusable from another approved catalog **scope**"。注释说的是**数据节点**级复用,代码实现成了**无边界**复用。**`DEXTER_DECISION`:先裁定"approved catalog scope"是否跨 workspace,再决定修不修。**

**【2】owner 回执缺 `brand_ref` 分量(租户内跨品牌)。** 三张 `command_receipt` 的唯一键是 `(data_node_ref, idempotency_key)`,而 `brandRef` 来自 header/scope、**不在请求体内**,故不进 `request_hash`。同门店切品牌重放同一请求体 + 同幂等键 → replay 命中另一品牌的 response,本品牌写入静默丢失。
**更小的修复**:把 `brandRef` 拼进 `hash(request)` 输入(不动 DDL),跨品牌重放直接 409 `IDEMPOTENCY_MISMATCH`,与现有错误码一致。

**【3】`platform_workspace.workspace_command_receipt` 主键未含租户。** `V20260726_090000_000:149` 是 `idempotency_key VARCHAR(128) PRIMARY KEY`,此后无 ALTER;`WorkspaceCommandReceiptService:31-32` 的 advisory lock 与 SELECT 均无 workspace 分量。**无数据泄露路径**(request hash 含 group workspace key),但同幂等键跨 workspace 恒 409 + 键存在性 oracle。当前调用方是 platform-admin 面,受害面限于运维管理员之间。**这是前两轮回执收口漏掉的一张表**——`V20260728_090000_000:105` 对同名的 `workspace_iam.workspace_command_receipt` 已经做过一模一样的修复。

**【4】asset 释放回执的 `global`/`legacy` 通配。** `PlatformAssetService:702-707` 的 `scope_key IN (?, 'legacy')` 使任何 scope 都匹配历史行(迁移把全部历史行置为 `'legacy'`);`:409`/`:430` 的 requestHash **不含 workspace**(对比 stage 路径 `:127` **含**)。同时知道对方 `idempotencyKey` + `assetRef` + `expectedVersion` 才能利用,实际可利用性低。**修复一行**:把 workspace 拼进 `:409`/`:430` 的 requestHash,与 `:127` 对齐。

### 隔离扫描确认干净的部分(同样重要,不要在整改中破坏)

- **Q5 跨模块调用不丢租户上下文**——被调 owner 一律**重新校验**,不信任调用方:`InventoryOwnerService:1512-1526` 的 `requireTypedContext` 自己从 `scope.dataNodeId()` 派生 `dataNodeRef`,并重跑 `ownerGrant().verifyFor(...)`;`CatalogOwnerService:2405-2416`、`PlatformAssetService:672-690` 各有独立一份。**这是本次核查里做得最扎实的一处。**
- **授权入口收敛**:`WorkspaceCommandContextMint:40-45` 用 StackWalker 白名单钉死唯一铸造点;请求体里的 `dataNodeRef` 只能**选择**会话已有候选,不能引入新值(`CommandExecutionContextResolver:194-200`)。
- **三个"参数替换"嫌疑点全部查证未被绕过**:brand copy 的 `targetDataNodeRef` 是死参数;`sourceDataNodeRef` 被 edge 在调用前覆写;legacy 字符串重载在生产路径不可达。
- **审计表隔离干净**:5 张 canonical `audit_event` 全部 `workspace_uuid + group_workspace_key NOT NULL` + 复合 FK,全部读路径带双谓词。
- **一处有意的 capability 放宽(非租户问题,需知情)**:catalog save 协调 inventory 写入时,校验的是 `EDIT_STORE_CATALOG` 而非 `EDIT_STORE_INVENTORY`(`InventoryOwnerService:680/713/775/784/807/1529`)。`requiredRequirement` 被钉死为 `CATALOG_ITEM_SAVE_REQUIREMENT`,不能借此调任意 inventory 命令。**workspace 与 dataNode 仍正确,是 capability 边界问题,`DEXTER_DECISION`。**

**扫描方法与未覆盖面**:571 条生产 SQL 全量提取,382 条语句自带租户谓词,184 条判为"无谓词但可证安全"(其中约 120 条追到了前置带谓词语句,**约 60 条按模式抽样**),5 条判为不安全。**未覆盖**:未跑任何东西(全静态)、测试代码与 `libraries/` 未看、SQL 提取器召回率未做变异验证、`PlatformAuthenticationService` 的 55 条按"platform_iam 无租户列"整体归类未逐条审。

### M-01 ✅ 亲验 · MinIO 网络 I/O 跑在数据库事务内,且持有两把事务锁

**位置**:`modules/asset/.../PlatformAssetService.java`

```
:97   @Transactional                                    ← 事务开始
:128  lockReceipt(...)          pg_advisory_xact_lock  ← 事务级锁
:146  lockObjectReference(...)  pg_advisory_xact_lock  ← 事务级锁
:150  // Object I/O deliberately happens outside a database transaction  ← 注释说在事务外
:162  objects.exists(objectKey)                        ← 网络 I/O
:163  objects.put(...)                                 ← 上传整个文件
```

**代码与注释相反**。`pg_advisory_xact_lock` 是事务级锁,它的使用本身就证明事务是开着的。唯一调用方 `StageOperationsCatalogAssetMultipartOperation.java:28` 也是 `@Transactional(REQUIRED)`,该文件内无 `NOT_SUPPORTED` / `REQUIRES_NEW` / `TransactionTemplate`。

**MinIO client 无任何超时**:`MinioAssetObjectStorage.java:35` 只有 `endpoint().credentials().build()`。

**后果**:每次上传商品图片占用一个池化数据库连接 + 两把事务锁,直到 MinIO 传完。MinIO 慢或挂 → 连接池耗尽 → **整个后台所有接口一起不可用**,不限于资产相关。相同内容并发上传还会在对象锁上串行等待网络 I/O。

**根因(重要)**:写路径跨 `生成的 binding → 手写 Operation → 接口 → Service` 四层,每层各带 `@Transactional`,**在任何单一位置都看不出"这里有网络 I/O 跑在事务里"**。那句写反的注释就是证据。

**最小修复**:把 `objects.exists`/`objects.put` 移出事务方法(先落盘再开事务记录行),或对该步骤标 `Propagation.NOT_SUPPORTED`;独立地给 MinioClient 设连接/读/写超时;**并改掉那句注释**。

### M-02 ✅ 亲验 · 全仓唯一一条无租户谓词的 SQL,每次删图片触发

**位置**:`modules/catalog/.../CatalogOwnerService.java:951`

```java
jdbc.query("SELECT sections::text FROM catalog.catalog_item WHERE status <> 'VOIDED'", …)
```

拉取**全平台每个租户每一行商品**的完整 `sections` JSONB 到 Java 解析。调用链:`:940 assetReferencedAnywhere` / `:962 requireAssetUnreferencedAnywhere` ← `CatalogInventoryCoordinator.java:548` 与 `:1317`,即**每次资产释放/删图片都执行**。

**双重后果**:
- **性能**:唯一一条成本随**全平台**数据增长的语句;
- **正确性**:判断"资产还有没有被引用"时看的是**所有租户的数据**。

**最小修复**:调用链上游(`PlatformAssetService`)本就持有 scope,加谓词即可。**一行。**

### M-03 ✅ 亲验 · 商品保存对整个品牌加锁

**位置**:`CatalogOwnerService.java:1892-1907` `skuOwnerByRef`

```sql
SELECT item_ref, sections::text FROM catalog.catalog_item
WHERE data_node_ref=? AND brand_ref=? AND status <> 'VOIDED' FOR KEY SHARE
```

每次商品保存(`:1865` 调用)对该 scope **全部非作废商品逐行加 key-share 锁**,同时 detoast + 解析全 scope 的 JSONB。

**后果**:两个运维编辑同品牌下**不同的两个商品**会互相排队;任何并发的改 code 操作(`:1540 updateItem`)或复制路径的 `ON CONFLICT` 探测(`:757`)必须等待。100 倍商品 = 单品牌写吞吐直接塌掉。

**最小修复**:调用方 `:1858-1873` 已持有精确的 `ownSkuRefs` 与 `skuRelations` 集合,把扫描与锁限制到这些 UUID。

### M-04 ✅ 亲验 · 分页静默截断,第 5001 项永远取不到

**位置**:`CatalogOwnerService.java:1092-1093`

```java
long offset   = itemCodesOnly ? 0    : parseCursor(request, "cursor");
int  pageSize = itemCodesOnly ? 5000 : parsePageSize(request, "pageSize", 20);
```

`parsePageSize`(`:2338-2341`)上限为 100,该分支硬编码 5000 绕过,并**强制 offset=0**;而 `:1150` 照常计算 `hasNext` 并吐出 cursor,下次调用 offset 又被重置为 0。

**后果**:商品超过 5000 的品牌**静默返回被截断的编码列表**。该分支喂的是跨 owner 编码列表,**截断会传播到 inventory 与 production 的协调逻辑**。另外该分支 SQL(`:1142`)仍 SELECT 了 `attributes` 与 `sections`——只要编码却 detoast 了 5000 份完整 JSONB。

**最小修复**:去掉 limit(该分支只选 code 且已按 scope 收敛),或 `total > 5000` 时抛 typed problem 让截断变响。

### ~~M-05~~ → **S-19** ✅ 亲验改判 · 核心推断基本不可达,真实缺陷只剩一条

> **独立证伪 agent 打掉了本条主体,Claude 已复核关键反例。M 级定级撤销,降为 S。**

**原始断言的分类表(其中三处已证伪,见下方"改判"):**

| 方案 | 位置 |
|---|---|
| advisory lock | `OrganizationHierarchyCommandReceiptService:31`、`CommercialGroupCommandReceiptService:28`、`ContractCommandReceiptService:21`、`WorkspaceCommandReceiptService:28`、`PlatformCommandReceiptService:22` |
| insert-first claim + `state='SUCCEEDED'` | `BusinessEntityCommandReceiptService:62`、`ExtensionCommandReceiptService:25` |
| `ON CONFLICT DO NOTHING`(无 state 列) | `CatalogOwnerService:2385`、`InventoryOwnerService:1411`、`ProductionTagOwnerService:476` |
| 已泛型化(现成目标形态) | `WorkspaceIamCommandReceiptService:26` |

**后果(agent 报告)**:catalog 路径对**尚不存在的行**做 `SELECT … FOR UPDATE`(锁零行=没锁),两个同幂等键并发请求都执行,输的一方 receipt 在副作用已提交后被静默丢弃 → 第三次同键重试 replay 出**第一次**的响应,而数据是应用了两次的状态。inventory/production 用裸 INSERT,输的一方对**写入已成功**的请求返回 500。

**改判 ✅ 亲验 —— 上面这段有三处是错的:**

1. **分类错(行号指错方法)。** `InventoryOwnerService:1411` / `ProductionTagOwnerService:476` 指向的是 **`replay` 方法**,不是 saveReceipt。真实的 saveReceipt 在**下一行**(`:1412` / `:477`),是**裸 INSERT**。`ON CONFLICT (data_node_ref,idempotency_key) DO NOTHING` **全仓只有 catalog 一处**(`CatalogOwnerService:2386`)。
2. **语义说反了。** 三张 receipt 表都有 `UNIQUE (data_node_ref, idempotency_key)`(`V20260806_120000_000:68 / 121 / 149`)。inventory/production 的竞争输家撞唯一索引 → `DuplicateKeyException` → **整事务回滚,副作用一并撤销**。这是 fail-closed,不是"写入已成功却返回 500"。
3. **`WorkspaceIamCommandReceiptService` 不是第四种方案。** `:32` 就是 `pg_advisory_xact_lock`,与另 5 处同方案;"已泛型化"是代码复用维度。advisory lock 实为 **6 处**。

**核心推断"两个同幂等键并发请求都执行副作用"——13 条 catalog 写操作里 12 条被挡住**,三道原断言未列出的防线:`recheckWriteFactsBeforeReceipt:534 → lockCategory:1622` 对**已存在的行**做真实 `FOR UPDATE`;`transitionItem`/`saveItem`/`updateDictionary`/`transitionDictionary`/`promotionExecute` 的 UPDATE 全带 `AND version=?`,T2 重估谓词得 0 行 → `VERSION_CONFLICT 409` 回滚;`createItem`/`createCategory`/`createDictionary` 全部 catch `DuplicateKeyException`。

**幸存的真实缺陷只有一条(S 级)**——`CatalogOwnerService:1474` 的 `reorderDictionary`:

```sql
UPDATE catalog.dictionary_entry SET display_order=?,version=version+1,updated_at_epoch_millis=?
 WHERE data_node_ref=? AND brand_ref=? AND dictionary_kind=? AND code=? AND status <> 'VOIDED'
```

**无 version 谓词**,前置 recheck(`:555`)只是不加锁的 `SELECT COALESCE(MAX(version),0)`。T1 提交后 T2 重估 WHERE 仍匹配 → 二次生效 → version 从 N+1 漂到 N+2。`display_order` 本身幂等,危害限于版本漂移——**但那正是乐观并发的判据**。修复:加 `AND version=?`,与同文件其余 UPDATE 一致。

**仍成立**:11 处实现确实存在且确实分叉,advisory 内部还有**三种 key 推导**——`WorkspaceCommandReceiptService:31` 与 `PlatformCommandReceiptService:25` 是 `hashtext(?)`,**只锁 key、不含 workspace 分量**(见 M-12【4】)。归并价值仍在,但属 S-08 工具类范畴。

### ~~M-06~~ → **N-01** ✅ 亲验改判 · 原断言的核心理由**是错的**

> **改判摘要(证据在本条末尾)**:原断言称该复合唯一"逻辑上蕴含、约束不了新东西"——**这是错的**。它是 **14 条复合外键的被引用目标**,删掉则那 14 条 FK 全部建不出来。可达危害不成立,降为 N。以下保留原文供对照。

**(原始断言)** `workspace_uuid` 不唯一,而它是 15 张表的租户键

**位置**:`db/migration/V20260726_090000_000__owner_schemas_and_workspace_compatibility.sql:50`

只有 `UNIQUE (workspace_uuid, group_workspace_key)`,而 `group_workspace_key` 本身已唯一 → 该复合唯一**逻辑上蕴含,约束不了新东西**。数据库层面不阻止两行 group_workspace 共用同一 `workspace_uuid`。

**后果(agent 报告)**:`workspace_uuid` 是 `organization_command_receipt` / `workspace_command_receipt` / `contract_command_receipt` 与六张 `audit_event` 的租户键。若某次恢复/导入让两个 workspace 复用同一 uuid,**两个租户共享幂等键命名空间,租户 B 的命令会 replay 出租户 A 的 `response_json`**。

**改判依据 ✅ 亲验:**

1. **该复合唯一是承重的,不是冗余的。** 同一迁移文件里 **14 条**复合外键以它为目标:
   ```sql
   FOREIGN KEY (workspace_uuid, group_workspace_key)
     REFERENCES platform_workspace.group_workspace(workspace_uuid, group_workspace_key)
   ```
   (`:109 fk_asset_workspace`、`:117 fk_extension_workspace`、`:121 fk_organization_workspace`、`:127 fk_store_workspace` 等)。PostgreSQL 要求被引用列必须有匹配的唯一约束——**删掉它,这 14 条 FK 全部建不出来。**
2. **租户键说错了一半。** audit 表的租户键是**复合对** `(workspace_uuid, group_workspace_key)`(`V20260726_210000_000:36` 等),不是单列;只有 receipt 表单用 `workspace_uuid`。
3. **可达性不成立。** 全仓唯一插入路径 `WorkspaceAdministrationService:46` 用 `UUID.randomUUID()`,且**全仓 `SET workspace_uuid` 零命中**(插入后不可变)。两行共用需要一次 v4 UUID 碰撞。

**仍成立**:确实没有 `UNIQUE (workspace_uuid)`(41 个迁移全扫确认)。作为纵深防御可补一行 DDL `ADD CONSTRAINT uq_group_workspace_uuid UNIQUE (workspace_uuid)`,**但无可达危害,不进整改批次**。

### M-08 ✅ 亲验 · 契约声明了 `format: uuid` 223 处,两条生成链**全部丢弃**,由 119 处手搓 `UUID.fromString` 顶替

**这是 Dexter 第 3 点「该用生成物却手搓字符串」的根因,不是症状。**

| 环节 | 实测 |
|---|---|
| `contracts/openapi/**` 声明 `"format": "uuid"` | **223 处** |
| 生成的 TS(6 个 `generated/*.ts`)中带 uuid 语义的 | **0**——所有 `*Ref` 是裸 `string` |
| 生成的 Java(302 个 generated `.java`)中 `UUID xxxRef` | **0**;`String xxxRef` **150** |
| 生产代码手写 `UUID.fromString` 调用点 | **119** |
| 其中所在文件**完全没有** `catch (IllegalArgumentException\|RuntimeException)` | **25** |

**因果链**:契约明明标了 uuid → 两个 generator 都只映射到 `string`/`String` → 于是**每个消费点各自重新实现一遍"把字符串变成 UUID 并处理失败"** → 119 个独立的正确性判断,25 个所在文件连兜底 catch 都没有(裸 `IllegalArgumentException` 会成 500 而不是 400)。

**已经造成过真实故障**:前端拿到的类型是 `string`,于是 `CatalogItemDrawer.tsx` 六条提交路径把**业务编码**填进 `*Ref` 字段(`:116/670/679/692/720`),还有一处直接 `crypto.randomUUID()` 伪造域引用(`:767`);owner 侧 `CatalogOwnerService.java:1814-1824` 用 `UUID.fromString` 一律 422 `REFERENCE_MAPPING_UNRESOLVED`。**类型系统本来能在编译期挡住,是生成链把这个能力扔了。**

**最小修复(按性价比排序)**:
1. **改 generator 的类型映射**:`format: uuid` → Java `UUID`、TS `type Uuid = string & {__uuid: never}`(branded type)。改一处,119 个手写点里的绝大多数直接变成编译期保证,前端六条错路当场变红;
2. 若暂不动 generator:至少把 25 个无 catch 的收进统一 helper,让失败变 400 而不是 500。

**不建议**:逐个给 119 处加 try/catch——那是把根因当症状修,且下一个新接口还会再犯。

### M-09 ✅ 亲验 · 局部复制的 9 个 section 选项里 **7 个是静默空操作**,接口照样返回 200

**这是本轮发现里唯一"用户勾了、系统说成功了、其实什么都没做"的一条。**

局部复制的写入逻辑(`CatalogOwnerService.java:802-806`):

```java
for (JsonNode section : selectedSections) {
    String key = sectionKey(section.asText());
    if (json(source.sectionsJson()).has(key)) merged.set(key, json(source.sectionsJson()).path(key).deepCopy());
}
```

`has(key)` 为假就**静默跳过**——不报错、不记录、不出现在响应的 `skipped` 数组里(`:812` 的 `data.putArray("skipped")` 恒为空数组)。

而 `sectionKey()`(`:870-881`)映射出的 JSON key,**有 7 个在 `sections` 里根本不存在**。把它和契约里 `catalogDraft` 的实际字段集(`contracts/openapi/catalog-inventory.openapi.yaml`,生成的 TS 同源)逐一对齐:

| API `selectedSections` 值 | 映射到的 key | 该 key 在 `catalogDraft` 里存在吗 | 实际结果 |
|---|---|---|---|
| `ORDER_OPTIONS` | `orderOptions` | ✅ 存在 | **生效** |
| `PRODUCTION_PROMPTS` | `productionProfiles` | ✅ 存在 | **生效** |
| `BASIC_INFO` | `basicInfo` | ❌ | sections 不复制;但 `:807` 另有特判复制了 `attributes` —— **部分生效** |
| `SKU_STRUCTURE` | `skuStructure` | ❌ **SKU 存在 `sections.skus`** | **空操作** |
| `SKU_BOM` | `skuBom` | ❌ | **空操作** |
| `OPTION_VALUE_BOM` | `optionValueBom` | ❌ | **空操作** |
| `PACKAGE_STRUCTURE` | `packageStructure` | ❌ | **空操作** |
| `PRINT_NAME` | `printName` | ❌ | **空操作** |
| `ITEM_BOM` | `inventoryBom` | ✅ 存在于请求,但 `:1289` 明确**不落盘** | **空操作** |

**`SKU_STRUCTURE` 这条最刺眼**:契约把 SKU 放在 `catalogDraft.skus`,owner 保存时也写 `sections.skus`,而复制映射写的是 `"skuStructure"`——**一个从来没有人写过的键**。全仓 `"skuStructure"` 字符串只出现 2 次:这个 switch,和 `skuStructureFingerprint:2695` 的一个兜底读。

**用户可见后果**:运维在复制商品时勾选"SKU 结构"/"打印名"/"包装结构",接口返回 `200`、`reused` 里列着目标商品、`ownerReadbacks.status = "COMMITTED"`、版本号 +1,**而目标商品的 SKU 一个都没变**。没有任何信号提示他。

**最小修复**:`SKU_STRUCTURE -> "skus"`,其余 5 个要么映射到真实键、要么从契约枚举里删掉。**同时把 `has(key)` 为假的情况写进响应的 `skipped` 数组**——空操作必须变响,否则下次改键名还会重演。

**为什么没被任何门抓到**:`sectionKey()` 的 switch 对未知值抛 422,所以"枚举闭集"这类检查是绿的;真正错的是**闭集里的值映射到了不存在的键**,这需要把 owner 的写入键集与复制的读取键集对账——没有任何机器门在做这件事。

### M-10 ✅ 亲验 · `sections` 是客户端可写任意键的无界 JSONB

`saveItem` 落盘前(`CatalogOwnerService.java:1285-1292`):

```java
draft.fields().forEachRemaining(entry -> {
    if (!"inventoryBom".equals(entry.getKey())) sections.set(entry.getKey(), entry.getValue().deepCopy());
});
sectionsRequest.fields().forEachRemaining(entry -> {
    if (!Set.of("catalogDraft","expectedCatalogVersion","expectedInventoryVersions").contains(entry.getKey())) sections.set(entry.getKey(), entry.getValue().deepCopy());
});
```

**除 4 个显式排除项外,客户端提交的任何键都被原样写进 `sections` 并持久化**,无白名单、无 schema 校验、无大小上限。契约里 `catalogDraft` 声明了 `additionalProperties: false`,但**那只约束请求体,不约束落盘**——owner 拿到的是已解析的 `ObjectNode`,遍历时不再有契约。

**后果**:① `sections` 大小与内容由调用方决定,而它同时是 M-03 那条品牌级 `FOR KEY SHARE` 全扫要 detoast 解析的对象;② 任何写错的键名(见 M-09、S-01)都会**默默落盘并永久留存**,这正是三种拼写能共存的机制性原因;③ 未来加字段无需迁移,也就永远不会被迫清理。

**最小修复**:落盘前按 shape manifest 已声明的字段集过滤,未知键抛 422。`CatalogInventoryShapeManifest.ShapeRule`(`:1282 shapeRule(...)`)已经在这条路径上被取到了,**判据现成,只是没用来拦未知键**。

### ~~M-07~~ → **S-20** ✅ 亲验改判 · 4 条里 **2 条成立、2 条触发点描述有误**

> **改判摘要**:`invitation` 与 `workspace_session` 两条成立(降 S);`role_assignment` 与 `staged_asset` 两条**不成立**——前者已有 `ix_workspace_role_assignment_account (account_id)`(`V20260729_010000_000:2` 亲验)且 `role_id` 只是 `account_id` 锚定 EXISTS 内的可选过滤器;后者所有查询均主键锚定,那两列只作单行租户守卫,且父表从不删除。`workspace_session` 那条的触发点应为 `WorkspaceAccountService:35`(两列谓词),不是 `:38`(三列)。
> **未做**:未跑 `EXPLAIN`,后两条的"索引不会被选中"是谓词结构推断。

**(原始四条,后两条已证伪)** 热路径缺索引

| 缺失 | 触发点 | 后果 |
|---|---|---|
| `workspace_iam.invitation (workspace_uuid, group_workspace_key, mobile_normalized)` | `PlatformWorkspaceAccountTaskReadService:166,195` LATERAL | 该表除 PK 与 `token_hash` 外**无任何索引**;账号列表每行触发一次全表扫 |
| `workspace_iam.workspace_session (account_id, status)` | `WorkspaceAccountService:38` UPDATE | 每次撤销分配对**全平台所有 session** 做全表扫描 |
| `workspace_iam.role_assignment (role_id)` | `WorkspaceUserService:217` | FK 为 `ON DELETE RESTRICT`,角色键变更触发扫描 |
| `platform_asset.staged_asset (workspace_uuid, group_workspace_key)` | FK 无对应索引 | workspace 键更新/删除全表扫资产 |

---

## 2. S 级 · 会导致维护困难、误导或潜在 bug

### S-01 ✅ 亲验(本轮扩大) · 一个事实多种拼写,**26 处回退链,其中三对优先级互相矛盾**

原记录的只是最显眼的一处:`sections->>'source'` / `'sourceType'` / `'ownershipSource'` 三重 COALESCE,出现在七处 SQL(`CatalogOwnerService.java:1062, 1066, 1114, 1124, 1128, 1137, 1138`)。

**实测远不止**。`firstText(node, key...)`(实现在 `:2727-2731`,按顺序取第一个非空键)在 `CatalogOwnerService.java` 里共 **27 处调用,其中 26 处传了 ≥2 个候选键**:

| 回退链 | 次数 |
|---|---|
| `firstText(sku, "skuCode", "code")` | 5 |
| `firstText(sections, "source", "sourceType", "ownershipSource")` | 3 |
| `firstText(value, "valueCode", "attributeValueCode", "code", "name")` | 2 |
| `firstText(group, "groupName", "name")` / `("groupCode","code")` | 各 2 |
| 其余各 1 处 | 12 |

**新发现的、比"多写几个 COALESCE"严重得多的部分——三对方向相反**:

| 同一对象,两处优先级相反 | 位置 |
|---|---|
| `firstText(sku, "skuCode", "code")` × 5 处 ↔ `firstText(sku, "code", "skuCode")` | `:1029, 2173, 2587, 2639` ↔ **`:2699`** |
| `firstText(value, "valueCode", "attributeValueCode", "code", "name")` ↔ `firstText(value, "code", "valueCode")` | `:2677, 2681` ↔ `:2213` |
| `firstText(group, "selectionMode", "selectionRule")` ↔ `firstText(group, "selectionRule", "selectionMode")` | `:2204` ↔ `:2234` |

**同一个 JSON 对象若两个键都有值,这两处会读出不同答案。** 而 M-10 已证明客户端能把任意键写进 `sections`,所以"两个键都在"不是假想。

**其中 `:2699` 落在关键路径上**。它在 `skuStructureFingerprint`(`:2693`,注释自称 *Stable product compatibility bit*)里,而该指纹的两个消费者都是硬判定:

- `compatibilityCheck:2600` —— 指纹不等就 `BLOCKED` + `"SKU 结构指纹不一致"` + `STRUCTURE_INCOMPATIBLE`,**直接拒绝复制**;
- `copyDigest:2500` —— 进 `preflightDigest`,而 `:799` 拿它做 `STALE_COPY_PREFLIGHT 409` 判定。

即:**规范化投影(`:2173`)与兼容性指纹(`:2699`)对"这个 SKU 的编码是什么"用相反的优先级**。指纹还额外认第三个位置 `sections.skuStructure.skus`(`:2695`),而另外 **12 处**读 SKU 的代码只认 `sections.skus`(`:1025, 1381, 1769, 1803, 1858, 1899, 1961, 2014, 2085, 2278, 2365, 2580`)。

**最恶心的一条**:`firstText(value, "valueCode", "attributeValueCode", "code", "name")` —— 最后一档回退到 `name`。**`name` 是展示标签,不是编码**,语义不同的字段被当成同一事实的第四种拼写。

**定级说明**:回退链本身是 S;但因为它落在 `compatibilityCheck` 的 BLOCKED 判定上,**"两个键都有值"这一具体条件下会产生错误的复制拒绝或错误的兼容放行**。是否已在生产数据上发生,我没有查库,故不升 M,标为 **S(触及 M 边界)**。

**这不是设计,是多次改名都没清理旧的**。如果它是列,改名必须写迁移;JSONB 让"再加一层回退"成本为零,而 M-10 让写错的键能落盘。**S-01 + M-09 + M-10 是同一个机制的三个断面**,这是支持做建模整改最直接的理由。

### S-02 ✅ 亲验 · 吞异常并伪装成 403

`modules/catalog/.../CatalogInventoryCoordinator.java:721-728`

```java
} catch (RuntimeException failure) {
    throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "复制来源不属于当前品牌与目标门店的组织授权范围");
}
```

`failure` 被捕获后**从未使用**。DB 抖动、NPE、`resolveCatalogCopySource` 内的任何 bug,都被报成"你的品牌没有该复制来源的授权"——把排查者引向权限模型,而真实堆栈在任何地方都不存在。

`CatalogOwnerApi.Problem` 已有 `(code, status, message, Throwable cause)` 构造器(`CatalogOwnerApi.java:208`)。**修复=加一个参数**,并把 catch 收窄到 scope 解析异常类型。

### S-03 ⚠️ 未验 · 阈值格式错误 → 低库存告警永久静默

`modules/inventory/.../InventoryOwnerService.java:1585-1587`:非数字 `lowStockThreshold` 被 catch 成 `BigDecimal.ZERO`,而后 `signum() > 0` 为假 → 该库存对象**永远报 "OK"**。配置损坏的门店从此不再有低库存告警,且没有任何东西暴露这个错误配置。词表里已有 `UNKNOWN` 可用。

### S-04 ⚠️ 未验 · 客户端 header 可选择服务端故障行为

`src/main/.../app/edge/session/EdgeRequestContextArgumentResolver.java:49` 读取请求头 `X-Catalog-Test-Failure-Point`,穿过约 12 个生产签名传到 `CatalogInventoryCoordinator:1350` 与 `StageOperationsCatalogAssetMultipartOperation:35`,注入 422/500。

**agent 已核实防护**:另需 `V2S_CATALOG_TEST_FAULTS=true`,该变量只由三个 dev/test 脚本设置,**从不由部署配置设置**。故当前**不是线上漏洞**,评为 S。

问题在于:故障注入路径**随生产二进制发布、可由公开 header 到达**,唯一屏障是一个未设的环境变量,无 profile 检查;并且污染了三个模块的生产 API 签名。

### S-05 ⚠️ 未验 · 测试脚手架混入生产类型

- `modules/organization/.../OrganizationTaskPathLookup.java:17,26,46,55,64,72`:五个 `default` 方法体为 `throw new UnsupportedOperationException("... not provided by this test double")`。唯一生产实现全部 override,**这些默认值只为测试替身存在**——代价是生产契约不再强制要求它们,未来实现漏掉一个,编译错误变成**授权路径上的运行时异常**。
- `modules/workspace-iam/.../WorkspaceInvitationService.java:62,67,71,76`:四个伸缩构造器,短的传 `null` 给 `user`/`taskPaths`/`candidates`/`commandAuthorization` → **生产 `@Service` 可被构造成半 null 实例**。

### S-06 ✅ 亲验(方向成立,**配对说反了**)· 遗留 grant 写路径不可达,但删除范围要重算

**成立的部分**:`OperationsCatalogInventoryController.java:295` 的 `command(...)` 桥接方法,在**405 行的文件里只出现一次——就是它自己的声明**,零调用点。29 处写路由全部走 `m1Bindings.bind*Operation`。✅ 亲验。

**说反了的部分**:原记称 "`stageAsset` 是 legacy、`stageWorkspaceAsset` 是 live,删前者"。**实际两个都零调用**:

| coordinator 方法 | 可见性 | 调用方 |
|---|---|---|
| `stageAsset` `:1283` | public | **零** |
| `stageWorkspaceAsset` `:241` | public `@Transactional` | **零** |
| `releaseAsset` `:1307` | private | **零** |
| `releaseWorkspaceAsset` `:539` | private | `:302` 的字符串派发 `if (operationId.equals("releaseOperationsCatalogStagedAsset"))` |

真实的 stage 活路径是 `控制器:255 → m1Bindings.bindStageOperationsCatalogAsset → StageOperationsCatalogAssetMultipartOperation → PlatformAssetService`(即 M-01 那条链),**与 coordinator 的两个 stage 方法都无关**。我最初 grep 到 `控制器:246 stageAsset` 是**方法重名造成的假阳性**——那是 `@PostMapping("/assets/stage")` 的端点方法名。

**死代码面比原记的更大**:`CatalogInventoryCoordinator:190-232` 有约 **24 个** `@Transactional public JsonNode xxx(CommandRequest request) { return execute(request, TOKEN); }` 一行门面,它们的形态正好匹配已死的 `command(...)` 的 `Function<CatalogInventoryCoordinator.CommandRequest, JsonNode> directOperation` 参数——**是为方法引用准备的**。`command(...)` 死了,这批门面连同其下的 `execute:234 → executeWorkspaceCommand:176 → dispatchWorkspaceCommand:266` 整条链大概率一起死。⚠️ **这条我只追到形态吻合,没有逐个门面确认零调用。**

**给执行者的关键修正**:
1. **不要按 "legacy vs Workspace" 的命名启发式删**——本条就是这么判错的。**按可达性删**:从 `command(...)` 与那 24 个门面出发做一次真实的调用图收敛;
2. **风险低于我原先的估计**:Java 静态类型给了兜底,删掉真被调的东西**编译期就会红**。所以这批可以放心做,但**范围要重新算,不能照抄本条原文**;
3. `releaseWorkspaceAsset` 经字符串派发可达,**先确认 `ReleaseOperationsCatalogStagedAssetOperation:36` 是不是已经接管了同一职责**,再决定删哪一边。

**结论不变**:这是删除不是重构,零设计负担,仍**建议排在所有抽取动作之前**(整改批 1)——只是删的清单得现算。

### S-07 ⚠️ 未验 · audit history 读服务 6 模块同构,`projection()` 逐字节相同

`OrganizationAuditHistoryService:36`、`ExtensionAuditHistoryService:21`、`ContractAuditHistoryService:27`、`PlatformIamAuditHistoryService:22`、`WorkspaceIamAuditHistoryService:55`、`PlatformWorkspaceAuditHistoryService:56`。agent 用 diff 确认其中三份 `projection` 逐字节相同。另各自并存一份遗留两查询版。预计净减约 350 行。

### S-08 ⚠️ 未验 · owner 守卫与 JSON 工具成套复制 3–5 处

`requireOwnerScopeGrant` / `requireTypedContext` / `catalogCapabilityForTarget`(三处 switch 完全相同)/ `copySourceDataNodeRef` / `canonical`+`json`+`hash` / `envelope`+`command` / `required`+`optional`,分布于 catalog、inventory、production、asset 四个 owner。差异仅为 Problem 类型与中文文案。四模块已共同依赖 `modules/execution-context`。

### S-09 ⚠️ 未验 · SHA-256 摘要 13 个命名 helper / 17 处计算点,其中 2 处手搓 Hex

`CommercialGroupCommandReceiptService:96-98` 与 `OrganizationCommandService:411-412` 用 `StringBuilder`+`String.format("%02x")` 手拼,而**同一个包里** `BusinessEntityCommandReceiptService:104` 已在用 JDK 17 的 `HexFormat.of().formatHex(...)`。

### S-10 ⚠️ 未验 · 手搓 Base64+正则 JSON 编解码,同包已在用 Jackson

`OrganizationHierarchyCommandReceiptService:79-160`(约 80 行)、`CommercialGroupCommandReceiptService:63-116`(约 55 行)、`WorkspaceCommandReceiptService:54`、`PlatformCommandReceiptService:35-36`:把 record 序列化成 `{"k":"<base64>"}` 再用正则读回。同包 `BusinessEntityCommandReceiptService:81-95` 对同类对象直接用 Jackson。**无任何"Jackson 不可用"的理由。**

⚠️ 切换会改变**已落库回执的物理格式**,属数据迁移动作,需 Dexter 裁定时机。

### S-11 ⚠️ 未验 · 数据完整性四项

| # | 问题 |
|---|---|
| a | **作废编码永不可回收**:`catalog_item` 用 `status='VOIDED'` 软删,但 `UNIQUE (data_node_ref, brand_ref, code)` **无 `WHERE status <> 'VOIDED'`**。作废后该编码永久占用,而所有列表都过滤 VOIDED → 运维界面上找不到它却被告知"编码已存在"。同样存在于 `dictionary_entry` 与 `production_tag_definition`。对照:`catalog_category` 选择物理删除以允许回收(`V20260808_140000:1-3` 注释说明)。**仓内两种策略并存,只在分类上做了裁决** |
| b | **裸 `ON CONFLICT DO NOTHING` 把空操作报成成功**:`InventoryOwnerService:446` 的 `copied` 作为 receipt 的 `version` 返回,全冲突时返回 `{"status":"COMMITTED","version":0}`;`ProductionTagOwnerService:351` 同形 |
| c | **`stock_ledger` 无 scope 列、无 FK**:资金级审计轨迹只靠裸 `target_ref UUID` 挂着 |
| d | **`organization_node.parent_id` 无 FK、无索引、无环守卫**:五处递归 CTE(`OrganizationHierarchyService:434,473` 等)全是 `UNION ALL` **无深度上限**,一旦出现环即语句超时;也不阻止 parent 指向另一 workspace 的节点 |

### S-12 ⚠️ 未验 · 冗余与死索引

- `ix_stock_target_scope_item_ref` 与 `ix_stock_bom_scope_item_ref` 是各自唯一索引的**严格前缀**,只放大写成本;
- `ix_stock_bom_option_value`、`ix_production_tag_scope_status`、`ix_platform_password_recovery_flow_active` **无任何查询会用到**。

### S-13 ⚠️ 未验 · 版本化 migration 里用 `IF NOT EXISTS`

Flyway 的 `V…` 只执行一次,这些守卫**永远不可能防重复执行**,唯一效果是"对象已存在但形状不同时静默成功"。最危险的一处:`V20260808_160000:154` 靠 Postgres **自动生成的约束名**去 `DROP CONSTRAINT IF EXISTS`,名字差一字符即静默跳过,留下"看起来已迁移、实际允许重复无 SKU 库存对象"的表。

### S-14 ⚠️ 未验 · 循环里发 SQL

`CatalogOwnerService:1474` 重排字典每条一次 UPDATE;`:743-759` 复制每个对象一条 INSERT;`InventoryOwnerService:443-455` 每 target 一条 INSERT + **第二个循环**每 target 一条 SELECT 回读自己刚写的 ref + 每 BOM 一条 copy;`OrganizationHierarchyService:297,581` 每阶段名一条 INSERT。**200 商品的品牌复制约 600 次往返。**

### S-15 ⚠️ 未验 · OFFSET 分页,cursor 就是 offset

`CatalogOwnerService:1092/1142/1150`、`InventoryOwnerService:1040/1048/1119-1121`、`PlatformWorkspaceAccountTaskReadService:145`、`PlatformWorkspaceInvitationTaskReadService:95`、`WorkspaceInvitationService:168`。叠加 `aggregate` CTE 每页物化整个过滤集与 JSONB 谓词,第 N 页成本 = 第 1 页 + 丢弃成本。

### S-16 ✅ 亲验 · 6 个包名跨 Gradle 模块边界共用(split package),且**共用不承重**

6 个包在 `src/main/java/…`(app)与 `modules/*/src/main/java/…`(领域模块)下各有一份:

| 包 | app 侧 | module 侧 |
|---|---|---|
| `catalog/application` | 18 | 4 |
| `inventory/application` | 4 | 3 |
| `organization/application` | 19 | 14 |
| `fulfillment/production/application` | 3 | 2 |
| `platform/asset/application` | 2 | 4 |
| `workspace/iam/application` | 20 | 25 |

**拆分是有规律的,不是乱放**:app 侧**清一色是 `*Operation`**(69 个手写 operation 全在这边);module 侧是 `*Service` / `*Resolver` / `*Storage` / `*Facts`。以 `workspace/iam/application` 为例——app 侧 20 个全部 `Operation`,module 侧 20 个 `Service` + 2 `Resolver` + 2 `Facts` + 1 `Cache`。

**关键亲验结论:共用包名不承重,可以直接拆。**
- **零 FQN 冲突**(两侧全部 570 个类的全限定名逐一比对,交集为空)——**没有"改了一份、跑的是另一份"的影子代码**;
- app 侧 Operation 引用的 module 侧类**全是 `public`**:`CatalogInventoryCoordinator`、`CatalogOwnerService`(`public class`)、`CatalogTaskReadService`、`CommandExecutionContextResolver`(`public final class`)。它们同包所以省了 import,**但加上 import 一样能编译**;
- 反证:同一个 `SaveOperationsCatalogItemOperation.java:8` 已经在 `import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver` —— **跨模块 import `application` 包本来就是这里的常态**,同包只是省了一行。

**确定的代价**(不依赖是否被利用):
1. 看到 `com.catering.v2s.catalog.application.X` 无法判断它在哪个 Gradle 模块、依赖方向是什么。这正是 Dexter 第 4 点;
2. ArchUnit 若按包名写模块边界规则,**无法区分这两侧**——规则写了也是空转。

**latent(未穷举核实,标为推论)**:因包名相同,module 侧类的 package-private 成员对 app 侧可见,构建划的边界在 Java 可见性层不成立。**当前是否真有代码在用这个通道,我没有逐一核过**,故只作为风险登记,不作为整改理由。

**最小修复**:app 侧 69 个 Operation 的包名改为 `…catalog.operation` 之类,加 import。纯机械,IDE 一次重构完成。归入格式批(§7 批 5)。

### S-17 ✅ 亲验 · 15 个邀请 Operation 类,组内差异只有一个枚举常量

`modules/workspace-iam/.../application/` 下三族各 5 个(scope = Group / HeadCompany / Project / Region / Store):

| 族 | 每文件行数 | 组内实际差异 |
|---|---|---|
| `Cancel*InvitationOperation` | **4** | **1 行**(类名 + `ServiceNodeTypes.X`) |
| `Create*InvitationOperation` | 15 | 4 行 |
| `Reissue*InvitationOperation` | 18 | 4 行 |

Create 族的完整差异**逐字节**只是:

```
CreateOperationsWorkspaceGroupInvitationOperation  ↔  ...StoreInvitationOperation
"createOperationsWorkspaceGroupInvitation"         ↔  "createOperationsWorkspaceStoreInvitation"
ServiceNodeTypes.GROUP                             ↔  ServiceNodeTypes.STORE
```

**15 → 3 个带 scope 参数的类。** 这三族是纯转发(构造 command 交给 `WorkspaceOperationsCommandApi`),**无任何 per-scope 业务规则**,符合 Dexter「只接受工具类合并」的四条(无业务语义、无状态、可单测、抽走后无 owner 少一条规则)。

**同时验证了反面,防止过度归纳**:`CreateOperationsOrganization*Operation` 6 个虽同名式,组内差异 **12–36 行 / 共 20–39 行**,携带真实的 per-scope 逻辑,**不是复制,不要合**。`*Operation` 全族 69 个 / 2047 行,其中 >50 行的 8 个都是有实质内容的。

### S-18 ✅ 亲验 · 62 个 `.yaml` 文件装的是 JSON

`contracts/openapi/` 下全部 `*.openapi.yaml` / `*.paths.yaml` / `*.schemas.yaml` 首字符都是 `{`。JSON 是合法 YAML,故工具链不报错——**代价全在人身上**:扩展名说谎、按 YAML 习惯改会写出混合语法、diff 噪声大。属 Dexter 第 5 点(format)与第 4 点(可接手)。

改扩展名会牵动 generator 的 glob 与既有 check,**不建议单独动**;登记在此,并入下次动 generator(见 M-08)时一起改。

---

## 3. 格式化(✅ 全量实测)

| 指标 | 值 |
|---|---|
| 生产 `.java` | 571 |
| 总行数 | 33562 |
| **>120 字符的行** | **5154**(15%) |
| >200 字符 | 1864 |
| >400 字符 | 480 |
| **最长单行** | **2812 字符**(`CatalogOwnerService.java:1056`) |
| **一行内多语句**(`;` 后仍有 40+ 字符) | **约 5867 处** |

超 500 行的文件 **11 个**:`CatalogOwnerService` 2826、`InventoryOwnerService` 1597、`CatalogInventoryCoordinator` 1367、`BusinessEntityService` 861、`PlatformAssetService` 769、`WorkspaceInvitationService` 746、`OrganizationHierarchyService` 609、`PlatformAuthenticationService` 600、`OrganizationOverviewTaskReadService` 587、`WorkspaceAuthenticationService` 554、`ProductionTagOwnerService` 541。

---

## 4. 已确认干净的项(不要在整改中破坏)

健壮性 agent 逐项排查后报告无问题,**这些是真功夫**:

- **金额精度**:33562 行内**零个 `double`/`float`**,金额与数量全部 `BigDecimal`;
- **SQL 注入**:所有插值标识符均为白名单闭集(`switch`/`Set.of`),值全部 `?` 绑定;`WorkspaceAdministrationPageRequest:21-22` 还用 `Math.multiplyExact` 防 offset 溢出;
- **Optional**:无 `.get()` 裸用,`orElse(null)` 处均立即判空;
- **资源**:try-with-resources + `finally` 清理临时文件;
- **鉴权**:`requireOwnerScopeGrant` 的 `catch(RuntimeException ignored)` 均落到抛 403,是 **fail-closed**;
- **N+1**:批量读一致使用 `IN (placeholders)`;
- **时间**:`SystemTimeProvider:9` 是全仓唯一 `System.currentTimeMillis()` 来源,foundation 能力未被绕开;
- **Spring 能力未重造**:零 `TransactionTemplate`、零 `ApplicationEventPublisher`、零 `@Cacheable`;
- **分类并发**:删分类与保存商品在分类行上经 `FOR UPDATE` 串行化,无"检查通过后被并发加引用"窗口。

**追加一项(Claude 亲验)· 命名体系是一致的,不构成 finding。**

Dexter 第 4 点点名了"分层命名可接手",我按后缀做了全量分布,结论与预期相反——**命名不是这里的问题,不要在这上面花时间**:

| 后缀 | 数量 | | 包叶子名 | 数量 |
|---|---|---|---|---|
| `*Operation` | 69 | | `wire` | 253 |
| `*Request` | 63 | | `application` | 138 |
| `*Service` | 58 | | `api` | 59 |
| `*Controller` | 30 | | `diagnostic` | 14 |
| `*Api` | 10 | | `contract` | 14 |

`*Service` 内部的二级后缀同样成体系:`*TaskReadService` 15 个、`*CommandReceiptService` 8 个、`*AuditHistoryService` 6 个、`*OwnerService` 3 个——**职责能从类名直接读出来**。

- **唯一的不一致**:`WorkspaceIamSummaryReadService` 少了 `Task`,与另外 15 个 `*TaskReadService` 不同名。**N 级,改一个类名,不值得单独排批次。**
- **层次编码在后缀而非包路径**(138 个业务类全在 `*/application/` 下)是**刻意的、一致的**约定,不是缺陷。真正妨碍"知道一个类在哪个模块"的是 S-16 的 split package,不是命名。

**结论**:第 4 点的整改价值全部集中在 S-16(包名跨模块共用)与 §3(11 个 >500 行的文件),命名本身不用动。

---

## 5. 明确不该合并的重复(警示后来者)

重复审查 agent 判定以下**不是 finding**,合并会造成错误抽象:

1. **五个类型词表类**(`ServiceNodeTypes` / `BusinessEntityTypes` / `OrganizationNodeTypes` / `ExtensionHostTypes` / `AuditEntityTypes`)——字面量高度重叠,但每个类的 Javadoc 都显式写了边界意图("intentionally narrower than service-node types"、"STORE is a separate managed entity path")。它们是**演化规则不同的独立闭合词表**,合并会把 owner 词表焊死到 service-node 契约上;
2. **每模块自有异常类**——owner 边界要求不互相 import;正解是加**标记接口**让 advice 挂接口,不是共用异常类;
3. **domain record vs wire record**(`audit-model/AuditHistoryItem` vs `generated/wire/AuditHistoryItem`)——分层刻意;
4. **69 个 `*Operation` 各自的 `Invocation` record**——一操作一份入参契约,是设计意图;重复的是其内部 helper;
5. **catalog/inventory/production 三份 `command_receipt` 表**——每 owner 自有表是隔离要求;重复的是访问它的 Java 代码(M-05),不是表结构。

**Dexter 裁定:本次只接受工具类合并**——无业务语义、无状态、可单独单测、抽走后任何 owner 都不少一条业务规则。四条缺一即不动。

---

## 6. 总体判断(健壮性 agent 结论,Claude 认可)

> **不是欠健壮,是过度设计。而且唯一那条 M 级缺陷正是过度设计造成的。**

写路径跨生成 binding → 手写 Operation → 接口 → Service 四层,每层各带 `@Transactional`,所以没有任何单一位置能看出 MinIO 上传跑在事务里。**那句写反的注释就是证据。**

过度设计的具体载体:69 个手写 Operation 类、253 个签入的 wire DTO、约 880 行自建 DB/HTTP 观测设施、每模块缝一个接口(40 个接口中 38 个只有单一实现)、故障注入参数穿透三个模块的生产签名。而实际业务逻辑约为六个 service。

---

## 6b. 被中止 agent 的碎片结论(Dexter 2026-08-14 因 token 预算叫停)

四份审查在产出完整报告前被中止。**以下是它们停止时的中间判断,可信度不同,已分级标注。禁止当作事实引用,仅作后续审查的线索。**

| 线索 | 来源 | 可信度 |
|---|---|---|
| **生产代码无循环依赖**——唯一那条回边只存在于 test-fixtures | 分层命名 agent | **较高**:结论明确,且与"模块边界基本正确"的其他证据一致 |
| **40 个接口中 37 个只有单一实现** | 过度设计 agent | **较高**:与健壮性 agent 独立报的"38/40 单实现"互相印证,差 1 属统计口径 |
| 授权解析器的**每个调用点都检查了 decision** | 权限覆盖 agent | 中:方向性结论,未完成全部 controller 核对 |
| 密码/OTP 侧有**补偿控制(OTP 门控 + 哈希)** | 注入与泄漏 agent | 中:局部确认,未覆盖 `@Value`/SpEL 与 MinIO 配置源 |
| MinIO 无 presigned URL 使用 | 资产路径 agent | 中 |
| **`tools/backend-acceptance/*` 在工作树中已被删除** | 工程机制 agent | **需复核**:与本仓退役裁决有关,应确认删除范围是否符合"保留 runner/lanes/workload"的要求 |

**明确未得出结论、不可引用的**:
- **多租户隔离**——安全 agent 停止时正在说「ripgrep 输出可疑,改用 grep 验字节」,**没有任何隔离结论**。这是本次审查**最大的未覆盖面**,而它是 SaaS 唯一"出一次即致命"的风险类别;
- 契约生成链中的 **operationId 一致性、错误码闭集、枚举漂移**(`format: uuid` 这一条已由 Claude 亲验补齐,见 M-08;`smartViewKey` 枚举漂移在 catalog 前端审查中已单独记录,不重复);
- 跨模块同构的 A/B/C 分类(工具类抽取候选清单)——S-17 只补了其中最确凿的一族;
- 命名规范、注释质量、测试有效性、依赖方向、API 风格一致性。

---

## 6c. v4 建模对照(Dexter 指示:不要只看 v2s 下结论)

来源:独立 agent 读 `catering-server-v4` 的 `V009__catalog_items_rebuild.sql`(910 行 / 29 张表)等迁移。**下列承重断言已由 Claude 亲验**:契约 `skus[]` 形状、`inventory` 侧已有列、`firstText` 计数。其余为 agent 报告。

### v4 想到而 v2s 没有的(按痛感排序)

| # | v4 的做法 | 对症 v2s 的哪个具体问题 |
|---|---|---|
| 1 | **SKU 一行一条**,`catalog_sku_id` 主键 + `unique(…, catalog_item_id, catalog_sku_id)` 供别表复合外键证明归属 | **M-03 那条品牌级 `FOR KEY SHARE` 全扫**——它现在做的两件事("这个 ref 有没有被别的商品用过"、"这个 SKU 属不属于这个商品")在 v4 分别是一个主键和一条外键,零查询零锁 |
| 2 | 唯一索引带状态谓词:`… where status <> 'ARCHIVED'` | **S-11a 作废 code 永不回收**。两条 SQL,零代码,不改契约 |
| 3 | 粒度**显式声明**且三根轴独立:`price_granularity` / `identifier_granularity` / `inventory_hint_granularity` | v2s 的 `priceGranularity` 是从 shapeKey 派生写进 JSON,读时还要 `ordering` 与根节点二选一回退;条码粒度、库存粒度在 v2s 无对应概念 |
| 4 | 条码独立表 + `unique(目录, 类型, 值)` | v2s `sections.skus[].skuBarcode` **零约束**——同品牌两个 SKU 可录同一条码,收银扫码歧义。**这是业务硬伤,不是性能问题** |
| 5 | `variant_combination_digest` + 部分唯一索引 | v2s 同一商品可存在两个"大杯+热" |
| 6 | 反查关系是行(`catalog_item_tag`、`catalog_sku_attribute_value`、`product_bom_line.stock_target_ref` 真外键) | v2s 的 5 处全表扫 JSON(`:914 / :927 / :951 / :1948`、`InventoryOwnerService:352`) |
| 7 | 扩展字段**注册制**:先声明字段才能写,且白纸黑字"不做动态 DDL、不建扩展字段索引",另有 `rejected_field_keys_json` 审计 | **正对 M-10**。注意:v2s 现在不该建这套(当前阶段是过度工程),**有价值的是那条界线本身** |
| 8 | `governance_status` / `source_mode` 是**列**且带 CHECK 闭集 | **S-01 的 26 处回退链**。列化的价值不在这次省几个 COALESCE,而在**下次改名会被迁移强制暴露** |

### v4 实际划的那条界线(这条最值得抄)

> **JSON 只装"永远整块读、只按已经拿在手上的那一行取"的载荷。凡是有外部查询要从它那头打进来的——唯一性、反查、列表过滤/排序、外键完整性——一律出 JSON。**

v4 允许 JSON 自由生长的地方,是它**已经先承诺"永不索引、永不反查"**的地方。v2s 的 `sections` 恰好相反:既自由生长(M-10),又被 7 处 SQL 过滤、5 处全表扫反查。

### 反向:v4 更差、或 v2s 确实更好的(不做单边论证)

1. **v4 根本没有资产引用计数,是绕开了**——`asset_media_object` 13 列,无引用表,`media_refs` 就是 JSONB 数组。v2s 的 `requireAssetUnreferencedAnywhere` 是 v4 **没有的能力**;M-02 那个全表扫是"多做了一件事"的代价,不是"模型选错"的代价。照搬 v4 不会让它变快,只会让它消失。
2. **v4 的通用属性表是空壳**——`catalog_attribute_definition` 五个列被一条 CHECK 全部钉成常量。典型的"为想象中的未来拆表",v2s 不该学。
3. **v4 的组合结构表有更新异常**——组级事实(组名、选择规则、min/max)重复写在每行组件上,无独立 group 表约束一致性;v2s 的嵌套 `compositeGroups[].components[]` **结构上不可能有这个异常**,这处 v2s 更好。
4. **v4 为列表面付了三张表 + 一个最终一致窗口**(投影表 + outbox + repair task + watermark 对账)。按当前阶段,**v2s 一条 SELECT 读全详情是对的,投影明确不该抄**。
5. **v4 自己也把 BOM 模板留在 JSON**(`bom_lines_json`)。所以"BOM 必须拆表"是伪命题——只有出现"按物料反查"才需要行,那是**一个查询的需求,不是模型的需求**。
6. **v2s 的 SKU 属性值内嵌快照读得更省**,v4 要 join 才拿到同样的 snapshot 列。两边都选了快照冗余,v2s 的存法更贴合"整块读"。

### 建议的拆法:**只拆一张表**

**`sections.skus[]` → `catalog.product_sku`。其余全部用索引和约束解决。**

必须出 JSON 的理由只有一条,但无可替代:**PostgreSQL 无法对 JSON 数组元素建唯一索引。** `productSkuRef` 唯一、`(item_ref, sku_code)` 唯一、"每商品至多一个默认 SKU"、变体组合不重复、条码唯一——这五条**没有任何表达式索引方案**。

**可以留在 JSON**:`orderOptions` / `compositeGroups` / `productionTags` / `images` / `attributes` / 拆出去后的 `attribute_value_refs`。它们只被"我已经拿着这一行"的路径读,无唯一性、无反查、不参与列表过滤排序。

**为什么不是更小的方案——以及哪些地方更小的方案确实够用**:
- **5 处全表扫 JSON:不要拆表。** 建 `GIN (sections jsonb_path_ops)`,谓词改写成 `@>` 包含查询。M-02 那条缺租户谓词是**独立 bug**,先补谓词就砍掉绝大部分行;
- **26 处回退链:不要拆表,但也不要停在生成列。** 生成列能把多处收成一处,**但把旧拼写永久固化,第四次改名照样不需要迁移**。直接加 `source_mode` / `governance_status` 两列并回填,约 10 行迁移;
- **作废 code 回收:不要拆表。** drop 掉现有唯一约束,换带 `WHERE status <> 'VOIDED'` 的部分唯一索引。两条 SQL,零代码;
- **明确不抄**:投影表三件套、多态标识表(v2s 只有条码一种,一列够)、两张变体注册表(`dictionary_entry` 已在做同一件事)、`catalog_item_capability`(v2s 由 shape manifest 派生,建表就是第二份真相)、扩展字段注册制。

### ⚠️ Claude 亲验时发现的一处限定(agent 未提)

agent 称"inventory 侧 `product_sku_ref UUID` 列已存在,外键目标现成"。**列确实存在**(`V20260808_160000_000…:6,10` 亲验),**但同一文件开头 1-3 行写着**:

> `-- …no cross-schema FK is introduced because the owners still coordinate through REQUIRED commands.`

**不建外键是既有的显式设计决定,不是遗漏。** 拆表后 `catalog.product_sku → catalog.catalog_item` 的同 schema 外键不受影响;但**不要顺手去建 inventory→catalog 的跨 schema 外键**,那会推翻一条已裁定的 owner 边界。此处需 Dexter 裁定是否重开该决定。

---

## 7. 整改批次建议(按"改动小 × 收益大"排序;建议,非承诺)

| 批 | 内容 | 规模 | 为什么排这里 |
|---|---|---|---|
| **−1** | **M-11 三个库存读端点补 scope** | 3 个方法签名 + 3 行控制器 | **唯一确认的跨租户数据泄露。修法在紧邻的 `readTargetConsumptionReferences` 里现成抄。排在所有事情前面。** |
| **0** | M-02 加租户谓词、S-02 传 cause、MinioClient 加超时、S-19 给 `reorderDictionary` 加 `AND version=?`、M-12【2】把 `brandRef` 拼进 `hash(request)`、M-12【4】把 workspace 拼进释放路径 requestHash | 各 1–3 行 | 单行级,当天可完 |
| **0.5** | **M-09 修复局部复制的 section 映射** + 把跳过写进 `skipped` | 一个 switch + 几行 | 用户勾了没生效,且**永远不会有人报错** |
| **1** | **S-06 删遗留 grant 写路径** | 纯删除 | 一次砍掉约一半重复面,**零设计负担**;必须排在任何抽取动作**之前**,否则会去抽将死的代码 |
| **2** | **M-01 MinIO I/O 移出事务** + 改掉那句写反的注释 | 一个方法 | 唯一"能拖垮全站"的缺陷 |
| **3** | M-04 截断变响、M-03 锁收敛到 `ownSkuRefs` | 各一处 | 调用方已持有所需集合,不需新设计 |
| **4** | **M-08 改 generator 类型映射** | 改一处生成器 + 全量重生成 | 一处改动换 119 个手写点的编译期保证,**并让前端六条错路当场变红** |
| **5** | **格式批**:formatter(§3 的 5154 长行 / 5867 多语句行)+ 11 个 >500 行文件拆分 + S-16 split package + S-18 扩展名 | 全仓 | 纯机械,但会淹没 diff,**必须单独成批、不与语义修改混提** |
| **6** | S-17 邀请 Operation 15→3、S-07 audit history 六模块、S-08~S-10 工具类 | 抽取 | 落在「只接受工具类合并」四条边界内 |
| **7** | JSONB 建模整改(S-01 三种拼写、S-11a 编码回收、SKU 拆表) | 大 | **需先做 v4 对照**,见 §8 |

**批 0–4 与批 5 不要交叉**:语义修复要能被单独 review,格式批要能被整体跳过。

---

## 8. 未完成项(明确登记,不得当作"已覆盖")

**~~最大空白:多租户隔离~~ —— 已补,见 M-11 / M-12。** 补的结果证明这一轮值得:找到了整个审查里**唯一确认的跨租户数据泄露**(M-11),而它是前六个 agent 全都没碰到的。**"顺带撞见"与"系统性扫描"的差距,这一条就说明了。**

隔离扫描自身未覆盖的:全静态无运行验证、测试代码与 `libraries/` 未看、SQL 提取器召回率未做变异验证、约 60 条 (b) 类按模式抽样未逐条追、`OrganizationVisibilityService` / `WorkspaceCapabilityScopeResolver` 的可见性推导未独立核。

其余:
- 全部 ⚠️ 未验条目(M-05~M-07、S-03~S-15)须逐条亲验后方可作为整改依据。本会话已发生 4 次"只看大概就下结论",此约束不放宽;
- **SKU 拆表须先对照 v4 已运行模型**(Dexter 指示原文:不要只看 v2s 下结论)。v4 迁移在 `backend/edge-bff-service/src/main/resources/db/migration`,**本会话未读**;
- 数据库 agent 自述未做:未跑 EXPLAIN、未测真实行数、未审 `CatalogInventoryShapeManifest` 是否在 Java 侧已堵住价格与 skuCode 的洞(**影响 S-11a 与 JSONB 定级**);
- 未做:命名规范、注释与测试有效性、API 风格一致性、依赖方向的系统性核查;
- §6b 中「`tools/backend-acceptance/*` 已被删除」需复核删除范围是否符合"保留 runner / lanes / workload"。

---

## 9. 授权边界

本文为只读审查登记,**不授权实施**。✅ 条目为 Claude 本会话亲验(打开源码逐字确认);⚠️ 条目为 agent 报告,未经独立确认。§7 的批次是建议,整改范围与顺序由 Dexter 裁定。§8 列出的空白**不因本文收口而消失**。
