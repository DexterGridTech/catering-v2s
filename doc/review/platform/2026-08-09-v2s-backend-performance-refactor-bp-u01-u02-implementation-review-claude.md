# BP-U01 / BP-U02 实施独立复核 —— Claude

`VERDICT=NO-GO`　`M=1`　`S=2`　`N=3`

## 0. 会话出处、亲验范围与一处无法亲验的声明

1. 本会话**不是 fresh v2s-rooted 会话**，是续接；本设计的方案输入由我产出。
2. 本仓评审期间**零写入**，除本文件；变异实验只在会话 scratchpad 拷贝上做。
3. **`scripts/check/operation-handler-bindings` 我在本会话内无法 fresh 复跑**——它依赖 JDK 编译生成的 Java，
   本机 `/usr/bin/java` 是 macOS stub（`BP_U02_GENERATED_JAVA_COMPILE_FAIL`，EXIT=1，退出码本身正确）。
   **因此 BP-U02 的"跨 kind 传参编译失败"断言与 10 条红夹具，我没有亲验，只能从生成代码形态推断。**
   我用替代手段补了另一半，见 §1.2。这一条按纪律必须披露，不得以 Codex 的 GO 代替。

---

## 1. 本阶段已完成且我亲验通过的

### 1.1 BP-U02 exact-set（对应核验项 5）

我从两份 generated registry 独立重算并与 binding 逐行对撞：

- **196 条 binding，`operationId` 唯一无重复，与 registry 并集完全相等**（多出 0、缺失 0）
- **owner / face / method / path 零漂移**；`mode` 与 `method` 一致性零冲突
- `adapter` **196/196 唯一**，无一个 adapter 绑定两个 operation
- 自报计数与我实算全等：`operationCount` 196、`readCount` 83、`commandCount` 113
- `contextCounts` 自报 = 实算：`READ_CONTEXT` 83、`WORKSPACE_EXECUTION_CONTEXT` 69、
  `WORKSPACE_PROTOCOL_CONTEXT` 6、`PLATFORM_COMMAND_CONTEXT` 29、`PUBLIC_PROTOCOL_CONTEXT` 9
  —— **69 + 6 = 75 operations-admin command、29 platform、9 public，合计 113** ✓
- `transactionMode`：`OUTSIDE_TRANSACTION` 83 == READ、`REQUIRED` 113 == COMMAND，无越界
- owner 切片 76/39/25/16/11/10/7/4/3/3/2 与 registry 一致
- `routeRegistry`：catalog-inventory 42 / edge-face 154 ✓
- `copyRole`：`COPY_SOURCE` 2（两条 copy candidates read）、`COPY_TARGET` 6（preflight/execute × local/brand/promotion），语义自洽

### 1.2 生成产物可复现（我的替代亲验，补 JDK 缺失的那一半）

我把 binding、两份 registry、`contracts/openapi/components`、`contracts/catalog` 拷进会话 scratchpad，
在拷贝上调用 `writeOutputs(scratchRoot)` 重新生成，然后与仓内产物逐字节比对：

**24 个产物（12 JSON + 12 Java）逐字节一致，`diff -rq` 零输出。**

这证明仓内 `contracts/registry/generated/operation-handler-bindings/` 的每一个字节都可由冻结输入完全复现，
**没有手工编辑**。这是 D.2「generator `--check` 字节比对」要求的实质，我用自己的实现独立取得。

### 1.3 无动态派发（对应核验项 6）

对 12 个生成 Java 文件全量扫描 `java.lang.reflect` / `Class.forName` / `getDeclaredMethod` /
`ApplicationContext` / `getBean` / `ServiceLoader` / `Map<String, …>` —— **零命中**。

形态核验：

- **命令侧**每 operation 一个 concrete typed method，context kind 写死在签名里，例如
  `createOperationsOrganizationBrand(OperationDescriptor, WorkspaceExecutionContext, BrandCreateRequest)`
  —— 传入 `PlatformCommandContext` 无可调用 overload。
- **读侧**唯一的 string branch 是 `invoke(OperationDescriptor, ReadContext, Object)` 内的
  `switch (descriptor.operationId())`，**case 集合在生成期固定**，不是 `Map` 查表，
  且入口先 `requireReadDescriptor(descriptor)`。
- `OperationBindingTypes` 的五个 context 类均为 `final` + 私有构造器，无法外部构造。

### 1.4 HMAC 与裸 SQL / 裸 hash（对应核验项 4）—— **实现扎实**

`DatabaseOperationTracker.java`：

- `:284` `String statementId = sqlTemplate == null || options.hmacKey() == null ? null : hmac(...)`
  —— **无密钥即 `statementId` 为 null，绝不退化为裸 hash**
- `:274-276` `if (options.hmacKey() == null) return null;` … `encoded == null ? "UNAVAILABLE" : hmac(encoded)`
  —— paramsHash 同样无密钥即 null；`UNAVAILABLE` 哨兵在 `:315` 被排除出 suspect 分析
- `:285` 裸 SQL 模板只在 `statementId != null`（即有密钥）**且**显式 opt-in
  `retainStatementTemplatesForLocalDictionary` 时才进本地字典
- `:216-217` `statementId` / `paramsHash` 强制匹配 `[A-Za-z0-9_-]{8,64}`，结构上装不下裸 SQL
- `:103` 密钥长度 ≥16；`:102`/`:106` 构造与读取**双向 clone**，调用方拿不到可变引用

`HttpRequestMetricsInterceptor.appendDatabaseOperations` 首行注释与 `if (!databaseCaptureActive …) return;`
明确「配置了路径但没有有效 HMAC 密钥是证据失败，不是退回裸值的许可」，而 `databaseCaptureActive`
= 路径非空 **且** 密钥非空。**核验项 4 通过，无 finding。**

### 1.5 snapshot 防篡改（对应核验项 2）

`scripts/check/backend-performance-evidence-snapshot`：

- 目录名 = `contentDigest`，`:153` 校验目录名与 manifest 一致且为 64 位 hex
- `:129`/`:143` **staging 目录 + rename 原子发布**，读者只能看到"完整"或"不存在"，看不到半拷贝
- 输入文件与 manifest 均 `chmod 0400`
- `validateSnapshot` **三重校验**：`:159` 逐文件重算 sha256 与 byteSize；
  `:176` `metadataDigest` 对比"从快照文件重新派生的 metadata"**且**对比"声明字段重新哈希"；
  `:177` `contentDigest` 用重算的 records + 派生 metadata 再算一次
- self-test 含 4 条真红变异：manifest 篡改、文件删除、join 不匹配、UNCLASSIFIED 状态

### 1.6 UNCLASSIFIED / phase fail-closed（对应核验项 3）

`:104` `unclassifiedRatio > 0.15 || missingPhases.length ? "UNMEASURED_BLOCKS_OPTIMIZATION" : "MEASURABLE"`
——阈值方向与「>15% 即失败」一致；`missingPhases` 取自 8 个 `REQUIRED_PHASES` 的并集覆盖。
`:122` 另对 `EDGE_IN`/`EDGE_OUT` 缺失**硬失败**（不只是降级），分级正确。
`:121` 空证据硬失败。`:181` 校验声明状态与派生状态一致，防止手改 `optimizationStatus`。

### 1.7 未虚报后续单元（对应核验项 7）—— **诚实**

`contracts/registry/operation-handler-bindings.json` 顶层：

```json
"runtimeIntegration": {
  "status": "DEFERRED_TO_BP_U06",
  "legacyDispatcher": "CatalogInventoryApplicationService.dispatch(String,...)",
  "reason": "BP-U02 publishes compile-time owner-local bindings; BP-U06 owns parity-proven runtime cutover and old-signature absence."
}
```

且 `operation-handler-bindings.mjs:206` **把这段作为不变量校验**（`JSON.stringify` 全等比对），
无法在不触发红的情况下悄悄改成"已完成"。
交叉印证：`CatalogOwnerService` 仍有 **65 个 `case "`** 旧分发分支——与"运行期切换延期到 BP-U06"一致，
没有一边宣称已切换一边留着旧路径。**核验项 7 通过，无虚报。**

### 1.8 request tuple 关联（对应核验项 1，字段层面）

`:53-61` `requestTuple` 取 `managedDevRunId ?? runId` + `correlationId` + `requestId`，
三者任一缺失或空白即 `BP_U01_REQUEST_TUPLE_INCOMPLETE` 硬失败；
`:87-92` 要求每条 DB 行的 tuple 在事件集合中存在，否则 `BP_U01_DB_EVENT_JOIN_MISSING`。
`appendDatabaseOperations` 写入 `runId`/`correlationId`/`requestId` 三字段齐全。
**字段与校验都对——但写入时机有缺陷，见 M-01。**

---

## 2. Findings

---

### M-01｜DB 行在凭据门之前写入、事件在之后 → 孤儿行使 snapshot 无法建立

**path:line**

- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/diagnostic/HttpRequestMetricsInterceptor.java:110-111`
- 同文件 `appendDatabaseOperations` 首行守卫（只判 `databaseCaptureActive`）
- 判据方：`scripts/check/backend-performance-evidence-snapshot:87-92`

**复现证据**

`afterCompletion` 的顺序是：

```java
appendDatabaseOperations(state, snapshot, response.getStatus());   // 无条件
appendStatementDictionary(snapshot.statementDictionary());          // 无条件
if (!state.eventAuthorized()) return;                               // 之后才 gate 事件
```

`appendDatabaseOperations` 的守卫是 `if (!databaseCaptureActive || snapshot.operations().isEmpty()) return;`，
而 `databaseCaptureActive = databaseOperationsPath != null && databaseOperationHmacKey != null`（`:61`），
**与 `eventAuthorized` 无关**。`eventAuthorized` 来自 `credentialAuthorized`（`:82-88`），需要
`validSecret(...)` 与 `runId.equals(header)` 同时成立。

于是：`scopeActive && databaseCaptureActive` 但**凭据未授权**的请求 → 写 DB 行、不写事件 →
该 tuple 在事件集合中不存在 → snapshot 创建时 `BP_U01_DB_EVENT_JOIN_MISSING` 直接 fail。

这类请求在受管运行中必然存在：浏览器/探针命中、未带头的调用、以及历史 diagnostic 中的
3 条 `EXPECTED_REJECTED` operation。

**实证（口径声明：以下取自旧口径的 live 语料，仅用于演示失败形态，不是对新代码的运行验证）**：
`.runtime/r5/evidence/db-operations.jsonl` 与 `seed-request-events.jsonl` 按
`(runId, correlationId, requestId)` 对撞——DB 侧 2,809 个 tuple 中 **1,957 个（69.7%）在事件侧无匹配**，
涉及 **15,280 条 DB 行**。

**适用范围**：BP-U01；影响该 unit 的核心交付物（内容寻址 snapshot）在任何含一个未授权请求的 run 中都无法产出。
**不是假绿**——门 fail-closed，覆盖状态停在 `UNMEASURED_BLOCKS_OPTIMIZATION`；是**产不出交付物**。

**修复建议（最小）**：把 `appendDatabaseOperations` 与 `appendStatementDictionary` 移到
`if (!state.eventAuthorized()) return;` **之后**，或在这两个方法入口加 `state.eventAuthorized()` 条件。
证据本就应当 run-scoped 且凭据受限，未授权请求不应留下 DB 行。

**Dexter 决策**：不需要。

---

### S-01｜`changeCurrentWorkspacePassword` 绑成 `WORKSPACE_EXECUTION_CONTEXT`，与既有受限读语义及 B.1.15 冲突

**path:line**

- `contracts/registry/operation-handler-bindings.json`（`changeCurrentWorkspacePassword` 行，`contextKind`）
- 既有生产语义：`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/session/OperationsSessionResolver.java:60`
- 其实现：`…/workspace/iam/application/WorkspaceAuthenticationService.java:152-157`

**复现证据**

binding 给出 `WORKSPACE_EXECUTION_CONTEXT`（= 详设定义的「active assignment/capability 的 server judgment」，
并产出 `OwnerGrant`）。但改密的既有 edge 路径走的是 `sessions.sessionForPasswordChange(...)`，其实现带注释
「Restricted read used only by the password-change edge route」，返回
`ScopeContext.empty()`、`Set.of()`（无 page keys）、`Set.of()`（无 capability keys）、assignment 为 `null`
——**刻意不解析 capability**。

冲突点三条：

1. manifest **B.1.15**「自助改密与重置他人凭据严格分离」：给自助改密授予 `OwnerGrant` 打破这条分离。
2. manifest **B.1.7**「零角色用户可登录见空工作台，不偷偷造默认角色」：零角色用户没有 active assignment，
   改密路径不应依赖 assignment 解析链。
3. 内部不一致：`changeCurrentPlatformPassword` 得到 `PLATFORM_COMMAND_CONTEXT`（正确，平台无 capability 模型）；
   6 条 `WORKSPACE_PROTOCOL_CONTEXT` 是 logout / passwordLogin / sendOtp / verifyOtp /
   selectSessionContext / selectSessionDataNode ——自助改密属同类凭据协议，却单独落在 EXECUTION。

**为什么门没抓到**：`scripts/generate/operation-handler-bindings.mjs:255` 只校验
「operations-admin command 必须是 WORKSPACE_EXECUTION_CONTEXT 或 WORKSPACE_PROTOCOL_CONTEXT 之一」，
**它判得了"是不是两者之一"，判不了"选得对不对"**——正是 manifest D.3「门只判客观事实，不宣称理解业务语义」的适用面。

**适用范围**：BP-U02，196 行中的 **1 行**。运行期暂无影响（`DEFERRED_TO_BP_U06`），
但它是 BP-U03 `CommandExecutionContextResolver` 的冻结输入，错误会顺延。

**修复建议（最小）**：改为 `WORKSPACE_PROTOCOL_CONTEXT`。
若坚持 `WORKSPACE_EXECUTION_CONTEXT`，须在设计中论证：零角色用户的改密路径如何不被 assignment 解析阻断，
以及为何给自助改密授予 `OwnerGrant` 不违反 B.1.15。

**Dexter 已裁定（2026-08-09）**：采纳我的建议——**自助改密视为凭据协议**，
`changeCurrentWorkspacePassword` 改绑 `WORKSPACE_PROTOCOL_CONTEXT`。

据此该 finding 的处置固定为：binding 该行 `contextKind` 由 `WORKSPACE_EXECUTION_CONTEXT` 改为
`WORKSPACE_PROTOCOL_CONTEXT`；`contextCounts` 相应变为 `WORKSPACE_EXECUTION_CONTEXT` 68 /
`WORKSPACE_PROTOCOL_CONTEXT` 7（**75 与 113 的总数不变**）；
生成器的 `EXPECTED_COUNTS` 若含分档数字需同步；
并**新增一条红夹具**：把该 operation 改回 `WORKSPACE_EXECUTION_CONTEXT` 必须红——
否则这次裁定不会有机器记忆，下一次重排 binding 时会悄悄退回。

**Dexter 决策：已完成，无需再裁。**

---

### S-02｜`backend-performance-observability` 的默认形态是关键词扫描

**path:line**：`scripts/check/backend-performance-observability:18-22`（`requireText` = `source.includes(token)`）、
`:39-40`（13 个 token）、`:55`（无参分支打印 `PASS`）

**复现证据**：无参运行本会话 fresh 复跑输出

```
BP_U01_OBSERVABILITY=PASS
EVIDENCE=UNMEASURED_BLOCKS_OPTIMIZATION
```

它只断言 `"statementId"`、`"paramsHash"`、`"UNCLASSIFIED"`、`"phaseCheckpoints"` 等 13 个字符串
在两个 Java 文件中**存在**。子串语义——出现在注释或死字段里同样通过，**无法检出行为被摘除**。

这正是我三轮前对旧 `database-operation-budget` 提 M-04 时的同一形态，也是 manifest Part C
「门红夹具范本（**永不红的门**）」与 D.3「新门验收必查 `run()` 实际执行面」点名的反模式。

**缓解（必须一并记下，故定为 S 而非 M）**：它同时打印 `EVIDENCE=UNMEASURED_BLOCKS_OPTIMIZATION`，
**对证据状态是诚实的**；`--run-dir` 形态做真实 snapshot 校验；`--self-test` 形态调用 snapshot 的真红夹具。
所以它不是"永不红"，是"**默认形态无分辨力而仍打 PASS**"。

**适用范围**：BP-U01 的一道门。

**修复建议（最小）**：无参形态不要打印 `PASS`——改为 `BP_U01_OBSERVABILITY=UNVERIFIED` 或
`SOURCE_CONTRACT_ONLY`，把 `PASS` 保留给 `--run-dir` 与 `--self-test`。一行输出改动即可，
不需要重写 token 检查。

**Dexter 决策**：不需要。

---

### N-01｜三道新门都不在 `scripts/verify` 链上

`tools/verify-gates/verify.mjs` 的 `scripts/check/*` 列表仍是原 10 个
（`openapi-contracts`、`contract-face`、`edge-codegen`、`retirement`、`backend-boundaries`、
`database-boundaries`、`flyway-layout`、`frontend-architecture`、`affected-l2`、`standards-coverage`），
**不含** `operation-handler-bindings`、`backend-performance-observability`、`backend-performance-evidence-snapshot`。

设计 BP-U01 的门 disposition 要求进 verify 的是后续的 `backend-performance-budget`，本阶段未明确要求这三道进链，
**因此不构成违约**；但 `operation-handler-bindings` 是纯静态、秒级、无 run-dir 依赖的门，
不进链意味着 196 exact-set 的漂移只有在有人手动跑时才会被发现。

**建议**：把 `operation-handler-bindings` 接入 `scripts/verify`；另两道依赖 run-dir，留在受管运行链合理。

### N-02｜BP-U02 门需要 JDK，缺环境时与真失败不可区分

`scripts/check/operation-handler-bindings` → `--check` → `compileJavaSources` 需要 JDK。
本机无 JDK 时输出 `BP_U02_GENERATED_JAVA_COMPILE_FAIL:...Unable to locate a Java Runtime`，EXIT=1。
退出码正确，但**"缺环境"与"生成代码真的编译不过"用了同一个失败码**，会让后来者误判。

**建议**：无 JDK 时输出独立的 `BP_U02_COMPILE_UNVERIFIED` 并以非零退出（或在证据报告里注明该门的环境前置），
使"未验证"与"验证失败"可区分。这一条同时是我 §0.3 无法亲验的原因。

### N-03｜snapshot manifest 的 provenance 字段未纳入 digest

`scripts/check/backend-performance-evidence-snapshot:109-113`：`snapshotDigest` 只覆盖
`{inputs: [{name, sha256, byteSize}], metadata}`。manifest 中的 `sourceRunDir`、`inputs[].sourcePath`、
`createdAt` **不在任何 digest 内**，改写它们不会被 `validateSnapshot` 检出。

输入字节与派生 metadata 的防篡改是完整的（三重校验），**仅"这份快照来自哪个 run 目录"这一出处声明不可验**。

**建议**：把 `sourceRunDir` 与 `inputs[].sourcePath` 纳入 `snapshotDigest`，
或在 manifest 中显式标注它们是非验证性 provenance 字段。

---

## 3. 三类边界的明确区分

### 3.1 本阶段（BP-U01 / BP-U02）已完成

- 196 operation binding contract 与 12 owner 的生成产物；exact-set、owner/face/path/wire/copyRole 零漂移
- 生成产物**逐字节可复现**（我独立重生成比对通过）
- 编译期 owner-local 静态 binding 的**代码形态**：命令侧逐 operation typed method、读侧闭合 `switch`、
  零反射/零 Map dispatcher/零 service locator
- 请求级 DB 计量：HMAC 强制、无密钥不落裸值、statementId/paramsHash 格式受限、密钥双向 clone
- 内容寻址 evidence snapshot：原子发布、三重 digest 校验、join 强制、UNCLASSIFIED/phase fail-closed
- 生成器 10 条具名红夹具、snapshot 4 条真红变异（**红夹具本身我未能执行，见 §0.3 与 N-02**）

### 3.2 延期到后续单元（本轮不得声称已完成，实现也确实没有声称）

- **BP-U06**：运行期切换、旧 `operationId + ObjectNode` 签名退役、旧动态 dispatcher 删除。
  `runtimeIntegration.status = DEFERRED_TO_BP_U06` 已显式声明并被生成器作为不变量校验；
  `CatalogOwnerService` 的 65 个 `case "` 仍在，与声明一致。
- **BP-U03**：`CommandExecutionContextResolver`、`OwnerScopeKind<S>`、`OwnerGrant`、
  `CatalogAuthorizationScope`、receipt 顺序。生成的 context 类目前是空的 marker（`final` + 私有构造器），
  **没有任何 owner readback 或授权判定实现**——形态诚实。
- **BP-U04**：C4/C6 分支语义与命令基线。
- **BP-U05 / BP-U07**：read budget、`ReadContextKind`、SQL-M1～M6 合并、196 行覆盖矩阵落地。

### 3.3 不在本次授权范围内（我未做、也不建议在本轮做）

- 未启动 DEV、未 reset、未 seed、未运行任何受管 workload
- 未进入 BP-U03～BP-U07 的任何实现评审
- 未实施或建议实施任何 SQL 合并、缓存、事务边界或业务优化
- **未创建任何 evidence snapshot**：这需要一次受管运行，属实施授权范围。
  `.runtime/r5/evidence/` 下的 live 文件我只读、只用于演示 M-01 的失败形态，
  并已在该条中声明它是旧口径语料、不能当作新代码的运行验证。

---

## 4. 结论

**NO-GO**（M=1，S=2，N=3）。

BP-U02 的静态部分质量很高：exact-set 零漂移、产物逐字节可复现、生成代码零动态派发、
`runtimeIntegration` 的延期声明被当作不变量校验而不是一句自述。BP-U01 的 HMAC 纪律与
snapshot 的三重 digest + 原子发布也扎实。

阻断的是 M-01：DB 行写在凭据门之前、事件写在之后，两者错位会让 snapshot 在任何含未授权请求的 run 中
**根本产不出来**——它 fail-closed 不假绿，但 BP-U01 的核心交付物拿不到。修复是两行位置调整。

S-01 需要你裁一句：**自助改密应不应该算凭据协议**（我建议算，既有代码的受限读已经这么表达了）。
S-02 是一行输出措辞：默认形态的关键词扫描不该打 `PASS`。

**我无法亲验的部分已在 §0.3 声明**：BP-U02 的编译期隔离与 10 条红夹具因本机无 JDK 未能执行，
我用 scratchpad 独立重生成 + 逐字节比对补了产物可复现这一半，**编译不可达这一半仍是推断，不是验证**。
Codex 的 GO 在这一点上我不能背书。

**授权边界**：本结论仅覆盖 BP-U01 / BP-U02 的实施复核。它**不**授权进入 BP-U03～BP-U07、
不授权 DEV / reset / seed / L2 / UAT、不授权任何 SQL 合并或业务优化、不授权任何仓库控制动作。
