# 第零批整改 · 立即修(4 条)· **v2(已过一轮独立盲审)**

- **来源**:`2026-08-14-v2s-backend-code-review-findings-claude.md`(问题登记册)、`2026-08-14-v2s-backend-findings-triage-and-sequencing-claude.md`(分流)。
- **准入规则**:已 ✅ 亲验 + 修复面小 + **不需要任何规范或产品决策**。四条互相独立,可并行。
- **审查状态**:v1 交 fresh 独立子 agent 两阶段盲审(阶段一禁读 `doc/`,自行从源码推导修法;阶段二攻击),verdict **`NO-GO`,2 M / 6 S / 5 N**。**两条 M 均经 Claude 复核成立,本 v2 已全部吸收。**

---

## 0. v1 → v2 变更总表

### 0.1 盲审提出、Claude 复核成立、已吸收

| 编号 | 问题 | v2 处置 |
|---|---|---|
| **M-A** | 0-4 的锁查询带 `AND status <> 'VOIDED'`,会**把线上正常的字典重排变成 404** | 锁查询去掉 status 过滤,见 §4 |
| **M-B** | 0-3 打在**生产不可达**的方法上(唯一调用方是单元测试) | 范围移到真正每次请求都跑的点,见 §3 |
| S-A | 0-1 漏了 owner 内部的 legacy 分发器,与"不在控制器修"的排除理由自相矛盾 | 纳入范围,见 §1 |
| S-B | 「当前没有任何超时/永久挂住」**事实错误**;T7/T8 修复前即绿或不可证伪 | 事实基座与用例重写,见 §2 |
| S-C | `setTimeout` 不设 `callTimeout`,达不到"给持锁时间加硬上界"的目的 | 改为强制走 `httpClient(...)`,见 §2 |
| S-D | `code = ANY(?)` 在 `JdbcTemplate` 下不能直接绑定;且 `lockCategory:1622` 根本不是数组样板 | 换绑定方案与样板,见 §4 |
| S-E | 0-3 自述目标(让真实堆栈可见)修完仍达不成 | 同批把 throwable 传进日志,见 §3 |
| S-F | T10 并发用例在红/绿两个方向都不可靠 | 改确定性用例,见 §4 |
| N-1 | catch 块行号 `:721-728` 错 | 实际 `:719-721`,已改 |
| N-2 | `/diagnostics` 可以确认**不泄露**(返回常量、零 DB 访问) | T4 重新定性为一致性变更,见 §1 |
| N-3 | 「12 处 SQL 无一条带租户谓词」夸大暴露面 | 措辞收紧,见 §1 |
| N-4 | 修完后 `readTargetConsumptionReferences` 仍是唯一不经 `target(...)` 的,"六端点同形"判据实质未达成 | 判据改写,见 §1 |
| N-5 | 用 `target(...)` 整行 SELECT 做存在性校验,多读若干列 | 接受,不改(见 §1 说明) |

### 0.2 盲审确认 v1 做对的(保留,不要在后续修订中弄丢)

- **0-2 与 M-01 可以分离**——盲审专门攻这条未攻下:`MinioAssetObjectStorage:71` 抛 unchecked → `PlatformAssetService:210-212` 原样重抛 → 穿出 `@Transactional` → 默认回滚 → **两把 `pg_advisory_xact_lock` 随事务结束释放**;且 `:590-601` 把对象清理注册进 `afterCompletion`(事务**完成之后**才发网络调用)、`:216-218` 的 `finally` 删临时文件,**清理不会二次拖长持锁**。⚠️ 但这条安全性**依赖超时真的触发**——见 §2 的 S-C。
- **`requireScope` 只判空不做授权,只调它不算修好**——判据形态正确,保留。
- **`ORDER BY code ... FOR UPDATE` 防死锁**——PG 的 `LockRows` 在 `Sort` 之上,取锁顺序即排序顺序。正确,保留。
- **原 0-5「加 `AND version=?`」作废、原 0-2「M-02 加租户谓词」移出本批**——两处自我更正的理由均被独立确认成立。

### 0.3 v1 相对分流文档的两处更正(仍然有效)

| 变更 | 原因 |
|---|---|
| **M-02 移出第零批** | 收窄谓词**会改变行为**(当前"全平台任何引用即不许释放"是 fail-safe),与 2-4 是同一个产品裁定。→ 第二部分,`DEXTER_DECISION` |
| **原 0-5 修法作废** | `CatalogDictionaryEntryReorderRequest`(`contracts/openapi/catalog-inventory.openapi.yaml:9920-9945`)required 只有三项且 `additionalProperties: false`,**契约里没有 expectedVersion** |

---

## 1. 【0-1】库存台账读路径补租户隔离

### 做什么

**四个 owner 方法 + 接口签名 + 四个控制器调用点 + owner 内部 legacy 分发器。**

**(a) 接口与实现**(`modules/inventory/.../api/InventoryOwnerApi.java:27-31`、`.../application/InventoryOwnerService.java:57-81`)

三个漏了的方法(`readTargetChangeSummary` / `readTargetBusinessHistory` / `readTargetLedger`)加 `readTargetDiagnostics`,签名前置 `String dataNodeRef, String brandRef`,与 `:29` 的 `readTargetConsumptionReferences` 同形。

实现里在取数据之前先解析归属:

```java
target(dataNodeRef, brandRef, targetRef);   // :1324-1327
// SQL: WHERE data_node_ref=? AND brand_ref=? AND target_ref=?
// 不命中 → Problem("NOT_FOUND", 404, "库存对象不存在")
```

**(b) owner 内部 legacy 分发器**(`InventoryOwnerService.java:88-97`)—— **v1 漏了这一处**

```java
case "getOperationsInventoryTargetChangeSummary" -> changeSummaryData(required(request, "targetRef"), optional(request, "period"));
case "getOperationsInventoryTargetBusinessHistory" -> history(requestId, required(request, "targetRef"), request);
case "getOperationsInventoryTargetLedger"         -> ledger(requestId, required(request, "targetRef"), request);
```

这三个 case **直接调私有 helper,绕过 public 方法**。只改签名碰不到它们。**三个 case 同样要过 `target(...)` 守卫。**

**当前无生产调用方**(`CatalogInventoryCoordinator:52` 的 `INVENTORY_READS` 是死常量,全仓无 `inventory.read(` 调用点),所以是潜伏缺口而非活体泄露——**但 BP-U06 切流当天它会变成活的**。而且不补它,本文档"为什么不只在控制器加校验"的理由(owner 会被别的调用方绕过)就自相矛盾。

**(c) 控制器**(`OperationsCatalogInventoryController.java:160 / 166 / 178 / 184`)补传已经在手上的两个值:

```java
ReadRequest read = readRequest(context, query, path, STORE_SCOPE);   // 这行本来就有
application.readInventoryTargetLedger(read.dataNodeRef(), read.brandRef(), required(read.request(), "targetRef"), …)
```

### 为什么这么做

**本轮唯一确认的跨租户数据泄露。** 任一租户的已认证运营用户(会话只要自身具备任意 STORE scope),对任意 `targetRef` 即可读到 `/ledger`(完整流水,可分页全量)、`/changes`(时间窗聚合)、`/business-history`。

四环全验:① 三个 owner 方法签名里就没有 scope;② **`/ledger`、`/changes`、`/business-history` 三条读路径的 SQL(`:1204` / `:1109` / `:1119`)无租户谓词**(措辞按 N-3 收紧:`stock_ledger` 共 12 处 SQL,其余如 `ledgerEntries:1379`、`recentChanges:1380`、`loadChangeSnapshots:1329` 只能经已 scope 化的入口到达,不构成独立暴露面);③ 该表**无任何租户列**(`V20260806_120000_000:88-98`),DB 层无兜底;④ 控制器同一行解析出 scope 然后不传。

**`/diagnostics` 的定性(按 N-2 更正)**:`diagnostics(:1248)` 返回**常量外壳、零 DB 访问,确认不泄露**。纳入本批是**一致性变更**,不是泄露修复。

**为什么不是更小的方案**:只在控制器加校验 → owner 的 legacy 分发器(b)仍是缺口。
**为什么不是更大的方案**:不给 `stock_ledger` 加租户列(要写迁移 + 回填 + 改 8 处写入点),`target(...)` 已能三谓词定位;不引入新授权层,返回 404 而非 403 是对的——不向调用方确认"UUID 存在但你没权限"。

**坑**:`requireScope(scope, brand)`(`:1497`)**只判空,不做授权**。只调它不算修好,必须走 `target(...)`。

**N-5 的取舍(接受不改)**:`target(...)` 会读整行(含 `balance`、`configuration::text`),仅为判归属确实多读了几列。改成 `SELECT 1` 存在性查询更省,但会新增一个只此一处使用的私有方法。**本批选择复用既有方法,把"少一个新分支"看得比"少读几列"重**;若后续压测显示 `configuration` 的 detoast 成本显著,再单独优化。

### 测试用例

| # | 用例 | 断言 | 修复前应为 |
|---|---|---|---|
| T1 | 租户 A 的 targetRef + 租户 B 的会话(B 自身有合法 STORE scope)→ `GET …/ledger` | 404,响应体不含任何 A 的流水字段 | **红**(200 + 数据) |
| T2 | 同上,`/changes` | 404 | **红** |
| T3 | 同上,`/business-history` | 404 | **红** |
| T4 | 同上,`/diagnostics` | 404 | 红(但这是**一致性**变更,不是泄露修复,见上) |
| T5 | 同一 workspace 下门店 X 的 targetRef + 门店 Y 的会话 | 404 | **红** |
| T6 | 租户 A 自己的会话读自己的 targetRef,四个端点 | 200,`/ledger` 条目数与写入数一致 | 绿(正向对照) |
| **T13** | **新增**:直接调 owner 的 legacy `read(operationId, …)` 三个 case,传跨租户 targetRef | 404 | **红** |

**T1–T5、T13 必须先在修复前跑并看到失败。** 红过才算数。

### 验收判据(自带反例)

| 判据 | 反例(出现即不成立) |
|---|---|
| 四个 `readTarget*` 的接口签名都带 `dataNodeRef, brandRef` | `InventoryOwnerApi` 里仍有 `readTarget*(String targetRef, …)` 形态 |
| 四个实现 **与 legacy 分发器的三个 case** 都经 `target(dataNodeRef, brandRef, targetRef)` | 任一路径直接把 `targetRef` 传给下游查询,或只调了 `requireScope` |
| T1–T5、T13 修复后全绿,**且修复前跑是红的** | 任一条修复前就是绿的 → 该用例没测到东西,重写 |
| **所有能到达 `stock_ledger` 的 owner 入口都先解析归属** | 存在一条入口只凭 `targetRef` 就能取数(N-4:`readTargetConsumptionReferences` 自身 SQL 带 `sb.data_node_ref=? AND sb.brand_ref=?`,**不经 `target(...)` 但同样不泄露**,满足本判据) |

> **判据措辞按 N-4 改过**:v1 写的是"六个端点同形",而 `readTargetConsumptionReferences` 走的是自带谓词的 SQL 而非 `target(...)`,字面不同形但同样安全。判据改为按**效果**(都先解析归属)而非按**形式**(都调同一个方法)。

---

## 2. 【0-2】MinIO 客户端补调用级超时

### 做什么

`modules/asset/.../MinioAssetObjectStorage.java:35`,**必须走 `httpClient(...)` 路线**:

```java
OkHttpClient http = new OkHttpClient.Builder()
    .connectTimeout(5, SECONDS)
    .readTimeout(30, SECONDS)
    .writeTimeout(60, SECONDS)
    .callTimeout(90, SECONDS)      // ← 关键:唯一的调用级硬上界
    .build();
MinioClient.builder().endpoint(...).credentials(...).httpClient(http).build();
```

**不要用 `MinioClient.setTimeout(connect, write, read)`。** 它只设 OkHttp 的三个 socket 级超时,**不设 `callTimeout`**;对端每 29 秒滴一个字节,30 秒的 readTimeout 永不触发,整次调用仍无上界。

### 为什么这么做(v1 的事实基座是错的,已更正)

**v1 写「当前没有任何超时/无限等待/永久挂住」——错。** minio 8.5.17(`modules/asset/build.gradle.kts:10` 亲验)的默认是 connect/write/read **各 5 分钟**(`S3Base.java:118` 的 `DEFAULT_CONNECTION_TIMEOUT`,`MinioAsyncClient` 在 `httpClient == null` 时用它建默认 client)。

⚠️ **该版本源码由盲审从 upstream tag 拉取核对,不是本机 jar 反编译。执行前请对着实际解析到的 jar 再确认一次。**

**缺陷仍然成立,只是量级变了**:5 分钟内持有一个池化数据库连接 + 两把 `pg_advisory_xact_lock`,足以打爆连接池。**修的是"把 5 分钟降到 90 秒并加上调用级硬上界",不是"把无限降到有限"。**

**为什么和 M-01 分开做**:M-01 的事务重构要动四层 `@Transactional` 的传播语义,依赖 1-E 规范。而超时是独立的纯配置。盲审专门攻过这个分批的安全性并**未攻下**:超时触发 → unchecked 异常 → 默认回滚 → 两把 advisory lock 释放;清理动作被 `afterCompletion` 推迟到事务完成之后,不会二次拖长持锁。
**但这条安全性依赖超时真的触发**——所以 `callTimeout` 不是可选项,是这个分批能成立的前提。

**为什么不是更大的方案**:不引入熔断/重试/限流,那属生产化项,进 `HANDOFF.md` 欠账。

**一个必须算进阈值的量级**:`MinioAssetObjectStorage:78` 的 `exists()` 会先 `ensureBucket()`,而 `ensureBucket()`(`:45-56`)是 `bucketExists` +(可能)`makeBucket` + **每次都执行的** `setBucketPolicy`;`bucketPrepared` 只在成功后置真,失败即每请求重来。**一次 stage 在事务内最多串起 5 次网络往返**,所以端到端上界 ≈ 5 × `callTimeout`。定阈值时按这个算,不要按单次。

### 测试用例(v1 的 T7/T8 均不可用,已重写)

| # | 用例 | 断言 | 修复前应为 |
|---|---|---|---|
| **T7** | 指向**黑洞地址**(SYN 不响应,如 `192.0.2.1` 这类 TEST-NET 保留网段),调用上传 | 在 **10 秒内**失败 | **红**(默认 connect 5 分钟) |
| **T8** | 指向**接受连接但每 29 秒滴 1 字节**的慢速桩,调用上传 | 在 **≤ 120 秒**内失败 | **红**(socket 级超时永不触发,会一直滴下去) |

**v1 的 T7/T8 为什么作废**:
- v1 的 T7 写"不接受连接的地址(如保留端口)"——**可达主机上的关闭端口回 RST,毫秒级失败,修复前后一样,是绿的**;
- v1 的 T8 断言"在读/写超时时限内抛异常"——**修复前它也在它自己的 5 分钟时限内抛异常,字面即满足,不可证伪**。

T8 正是区分 `setTimeout` 与 `callTimeout` 的用例:**只做 `setTimeout` 的实现跑不过 T8**。这是本条最重要的一个用例,不许省。

若判定 T8 的慢速桩成本过高,允许降级为「断言构造出的 client 的 `callTimeout()` 非零」——**弱,且必须写进 `HANDOFF.md` 欠账**,不得静默省略。

### 验收判据(自带反例)

| 判据 | 反例 |
|---|---|
| MinioClient 经 `httpClient(...)` 注入,且该 client 的 `callTimeout` 非零 | 只调了 `MinioClient.setTimeout(...)` → 无调用级上界,本批的分批安全性不成立 |
| T7 在 10 秒内失败 | 超过 10 秒 |
| **T8 通过** | 慢速滴流下跑满测试超时 → 说明只设了 socket 级超时 |
| 依赖版本与默认超时已对着**实际 jar** 确认 | 仅凭本文档的 5 分钟结论就动手 |

---

## 3. 【0-3】`SCOPE_FORBIDDEN` 传递原始异常(**范围已改**)

### 做什么

**v1 打的位置作废。** `CatalogInventoryCoordinator.java:719-721`(v1 误写 `:721-728`)所在的 `resolveBrandCopySource:715`,**唯一调用方是单元测试** `CatalogInventoryCoordinatorCopySourceAuthorityTest:32`(全仓 grep 亲验;控制器 `:355` 是同名的独立私有方法,不是对它的调用)。修它产出为零。

**改打真正每次请求都跑的两处**(`OperationsCatalogInventoryController.java`):

| 位置 | 可达性 | 现状 |
|---|---|---|
| `:385-388` `resolvedBrand` | **被 `readRequest:319` 调用 → 每一个 catalog-inventory 读端点都跑** | `catch (RuntimeException failure)` → 403「当前会话没有已授权品牌」,`failure` 丢弃 |
| `:350-352` `resolveBrandCandidateSource` | 被 `:141` 的 `/copy/brand/candidates` 调用 | 同形,403「当前门店没有可用的品牌商品复制来源」 |

两处都改成传 cause(4 参构造器 `CatalogOwnerApi.java:208-212` 已存在)。

**同批必须做的第二件事**:`src/main/java/com/catering/v2s/app/edge/problem/ContractProblemAdvice.java:66-68` 的 `log.warn` **不传 throwable**:

```java
log.warn("catalog-inventory owner problem code={} status={} exceptionType={} causeType={}",
    code, status, exception.getClass().getSimpleName(),
    exception.getCause() == null ? "none" : exception.getCause().getClass().getSimpleName());
```

只传 cause 而不改这里,**堆栈仍然不会出现在任何地方**,排查者拿到的只是一个类名。把 throwable 作为最后一个参数传进去。

**v1 的原位置(`:719-721`)可以顺手一起改**,但它是纯代码卫生,**不计入本条的收益陈述**。

### 为什么这么做

DB 抖动、NPE、`requireCatalogBrand` 内的任何 bug,当前都被报成「当前会话没有已授权品牌」——把排查者引向权限模型,而**真实堆栈在任何地方都不存在**。因为 `:385` 每次读都跑,这条是全部 catalog-inventory 读端点的共用诊断盲区。

**关于"零行为变更"(v1 的说法不准确)**:
- **对外 wire 无变化**——已核:`ContractProblemAdvice:58-71` 的 `detail` 是硬编码字符串,status/code 只从 `Problem` 的两个字段取;Spring 按抛出类型命中 handler,不回溯 cause 改派;`Throwable` 未重写 `equals`;全仓无 `@ExceptionHandler(Exception/Throwable/RuntimeException)`;无测试断言 `causeType`。
- **但日志会变**:`causeType` 从 `none` 变成具体类名,并新增堆栈。**这正是本条唯一的产出**,不该说成"零变更"。

**为什么不在本批收窄 catch 范围**:把 `catch (RuntimeException)` 收窄到具体异常类型**会改变对外状态码**(部分从 403 变 500),归第一部分 1-D。

### 测试用例

| # | 用例 | 断言 | 修复前应为 |
|---|---|---|---|
| **T9** | 注入使 `catalogScopes.requireCatalogBrand` 抛非授权类异常(如 `IllegalStateException`)的桩,请求任一 catalog-inventory 读端点 | ① 响应仍是 403 且文案不变;② 捕获到的 `Problem.getCause()` **非 null** 且是注入的那个异常;③ **日志中出现该异常的堆栈** | **红**(cause 为 null,日志无堆栈) |

**v1 的 T9 降级版作废**:它是"直接构造 `Problem(code,status,message,cause)` 并断言 cause 可取回"——该 4 参构造器**早就存在**,这条用例现在跑就是绿的,测不到任何东西。

### 验收判据(自带反例)

| 判据 | 反例 |
|---|---|
| `:385-388` 与 `:350-352` 两处 catch 都把 `failure` 传给 Problem | 任一处 `failure` 仍未被引用 |
| `ContractProblemAdvice:66` 的 `log.warn` 传了 throwable | 只加了 cause 却没改日志 → **堆栈仍然不存在,本条目标未达成** |
| 对外状态码与文案无变化 | 任一既有测试因状态码变化而失败 → 说明顺手改了 catch 范围,超出本批 |
| T9 修复前是红的 | 修复前即绿 → 用例测的是构造器而不是调用点,重写 |

---

## 4. 【0-4】字典重排加行锁(**锁范围与 SQL 均已改**)

### 做什么

`modules/catalog/.../CatalogOwnerService.java:1474` 的 `reorderDictionary`,在 for 循环之前锁住本次涉及的条目:

```java
// 样板:lockCategories:1646-1648 的 IN (占位符) 形态
String placeholders = String.join(",", Collections.nCopies(codes.size(), "?"));
List<String> locked = jdbc.queryForList(
    "SELECT code FROM catalog.dictionary_entry "
  + "WHERE data_node_ref=? AND brand_ref=? AND dictionary_kind=? AND code IN (" + placeholders + ") "
  + "ORDER BY code FOR UPDATE", String.class, args);
if (locked.size() != distinctCodes.size()) throw new Problem("NOT_FOUND", 404, …);
```

**三条硬要求:**

1. **锁查询绝不能带 `status <> 'VOIDED'`**(见下方 M-A);
2. **必须 `ORDER BY code`**——两个反向重排若按相反顺序取行锁会死锁 40P01;
3. **不要用 `code = ANY(?)`**。`JdbcTemplate.query(sql, mapper, Object... args)` 传 `String[]` 会被变参**摊平成 N 个参数**,传 `List<String>` 时 pgjdbc 无法推断数组类型。样板是 `lockCategories:1646-1648` 的 `IN (占位符)`;若确要用数组,仓内可跑的先例是 `modules/inventory/.../ResolvedBomTargets.java:17`(`= ANY(?::uuid[])`)+ `:32`(`statement.setArray(3, statement.getConnection().createArrayOf(...))`)——**注意字典 `code` 是文本不是 uuid,类型要相应改**。
   **v1 说"照抄 `lockCategory:1622`"是错的**:那是单值 `AND category_ref=?`,里面没有任何数组绑定。

### 为什么锁查询不能带 `status <> 'VOIDED'` —— M-A

**v1 的写法会把线上正常的字典重排变成 404。** 三个环节我逐个亲验:

1. 字典读 SQL(`CatalogOwnerService:1933`)的 `WHERE` 只有 `data_node_ref` / `brand_ref` / `dictionary_kind`,**不过滤 status**,VOIDED 条目照样返给前端;
2. 前端 `CatalogDictionaryDrawer.tsx:179-181` 的 `rows` 直接映射 `dictionaryData?.entries`,**不过滤 status**;
3. 同文件 `:169` `const orderedCodes = rows.map((row) => row.code);` —— 无论移动哪一行,提交的都是**含 VOIDED 的完整列表**。

于是:**任何一个 dictionaryKind 只要作废过一条,之后所有重排一律 404。** 今天这条路径是通的——现有 UPDATE 的 `status <> 'VOIDED'` 让 VOIDED 的 code 静默跳过、其余照排。

**正确形态**:锁查询与集合校验对**全集**做,`status <> 'VOIDED'` 只留在 UPDATE 上。

### 为什么这么做(而不是 v1 的修法)

**原修法「加 `AND version=?`」不可行**:`CatalogDictionaryEntryReorderRequest`(`contracts/openapi/catalog-inventory.openapi.yaml:9920-9945`)required 只有 `dictionaryKind` / `orderedCodes` / `dataNodeRef`,且 `additionalProperties: false` —— **契约里没有 expectedVersion**,加 version 谓词要改契约,不属第零批。

**缺陷本体**:实现是逐条无 version 谓词的 UPDATE(`:1474`),前置 recheck(`:555`)只是不加锁的 `SELECT COALESCE(MAX(version),0)`。两个并发重排的逐行 UPDATE 会交错,而 `display_order` 上**无唯一约束**,数据库不会拦。

**为什么不是更小的方案**:没有。不加锁就无法阻止交错。
**为什么不是更大的方案**:不改契约、不引 `expectedVersion`——那属契约变更,归第三部分随字典域一起裁定。

**顺带**:这个 for 循环是 S-14(循环里发 SQL)的一例。**本批不合并优化**——批量化是性能改动,混在一起会让 diff 不可单独评审。

### 测试用例(T10 已重写)

| # | 用例 | 断言 | 修复前应为 |
|---|---|---|---|
| **T10** | **确定性并发**:双数据库连接 + 闩锁。连接 1 开事务、执行第一条 UPDATE 后停在闩锁上;连接 2 提交一个不同顺序的重排;释放闩锁让连接 1 完成 | 两个事务结束后 `display_order` **无重复值**,最终顺序等于其中某一个提交的完整顺序 | **红** |
| T11 | `orderedCodes` 含一个不属于该 scope 的 code | 404,且**没有任何行被改动** | **红** |
| T12 | **单线程重排,fixture 中必须含至少一条 VOIDED 条目**,`orderedCodes` 按前端行为提交**完整列表(含 VOIDED)** | 200,非 VOIDED 条目顺序与提交一致 | 绿(正向对照;**这条专门守 M-A,少了 VOIDED 就守不住**) |

**v1 的 T10 为什么作废**:它给的输入是 `[A,B,C]` 对 `[C,B,A]`,两个事务按**相反顺序**逐行取行锁,在 Postgres 里的典型结果是**死锁 40P01**、一方被 abort,而不是"重复的 display_order"——用例第一句"两次都返回后"当场不满足;反过来若 T1 三条 UPDATE 全部先于 T2 开始,则既不死锁也不交错,**修复前就是绿的**。两个方向都不可靠。v1 提的补救(在生产代码里注入暂停点)还与本批验收 E 冲突。**双连接 + 闩锁不需要动生产代码。**

### 验收判据(自带反例)

| 判据 | 反例 |
|---|---|
| 循环前存在带 `data_node_ref` + `brand_ref` + `dictionary_kind` 三谓词的 `FOR UPDATE` 查询 | 无锁查询,或缺任一谓词 |
| **锁查询不含 `status` 过滤** | 出现 `status <> 'VOIDED'` → M-A 回归,含 VOIDED 的字典全部 404 |
| 锁查询按 `code` 排序 | 无 `ORDER BY` → 两个反向重排可死锁 |
| 参数绑定形态是 `IN (占位符)` 或 `createArrayOf` + `setArray` | 出现 `= ANY(?)` 直接传 `String[]`/`List` → 首次运行即炸 |
| **T12 的 fixture 含 VOIDED 条目且提交完整列表** | fixture 无 VOIDED → 测不到 M-A |
| 契约文件未被改动 | `contracts/` 出现在本批 diff |

---

## 5. 本批整体验收

| # | 判据 | 反例 |
|---|---|---|
| A | 四条各自独立提交,可单独评审 | 任两条混在同一次改动里 |
| B | T1–T5、T7、T8、T9、T10、T11、T13 **在修复前跑是红的** | 有用例修复前就是绿的 → 重写该用例 |
| C | `scripts/verify` 全绿且仍在分钟级 | 变慢 → 先砍最弱的门 |
| D | 本批**不含**任何契约文件改动 | `contracts/` 下有 diff |
| E | 本批**不含**任何格式化/重命名/搬文件/生产代码测试缝 | diff 里出现与四条无关的行 |
| F | 降级掉的测试已写进 `HANDOFF.md` 欠账 | 静默降级 |
| **G** | **minio 默认超时已对着实际 jar 复核**(本文的 5 分钟结论来自 upstream 源码,非本机 jar) | 仅凭本文数字动手 |
| **H** | **M-A / M-B 两处未被后续修订弄丢** | 锁查询又出现 status 过滤;0-3 又打回测试专用方法 |

---

## 6. 明确不在本批范围

| 项 | 去哪 |
|---|---|
| M-02 全表扫无租户谓词 | 第二部分,**需 Dexter 先裁定资产跨 scope 复用语义**(与 2-4 同一问题) |
| M-01 MinIO I/O 移出事务 | 第二部分,依赖 1-E 事务边界规范 |
| S-02 收窄 catch 范围 | 第一部分 1-D |
| S-14 循环里发 SQL 的批量化 | 第二/第三部分 |
| `reorderDictionary` 引入 `expectedVersion` | 第三部分(契约变更) |
| `resolveBrandCopySource` 只被测试调用这件事本身 | 属死代码/测试可见性范畴,归第一部分 1-J |

---

## 7. 审查与授权边界

- **v1 已过一轮 fresh 独立子 agent 两阶段盲审**(阶段一禁读 `doc/`,自行推导修法后才允许读作者文档),verdict `NO-GO`,2 M / 6 S / 5 N。
- **两条 M 均由 Claude 复核成立**:M-A 的三环链路(owner 读 SQL 不过滤 status → 前端不过滤 → 提交完整列表)逐环亲验;M-B 的"唯一调用方是单元测试"全仓 grep 亲验。**v1 的 0-4 修法会造成生产回归,0-3 修法产出为零——这两条都是本会话作者(Claude)写错的,由独立盲审抓出。**
- 盲审自述未覆盖:**没有编译、没有跑任何测试**(本机无 gradle 依赖缓存);minio 结论来自 upstream 源码而非本机 jar;前端只查了 operations-admin 一个重排入口,platform-admin 侧未查;未核 `scripts/verify` 的实际门集合。
- 本文为整改说明,**不授权实施**。范围、批次与时机由 Dexter 裁定。
- 按两轮硬上限,v2 尚可再过一轮独立盲审;是否再过由 Dexter 决定,若不过则本文以 `SELF_DECIDED` 收口。
