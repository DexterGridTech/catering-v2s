# BP 静态实施 NO-GO 整改复核（Claude 独立评审）

- 结论：**NO-GO**　**M=1　S=3　N=2**
- 范围：上一轮 `M-01`–`M-07` 的整改闭合度 + 四项 Dexter 裁决的落地 + harness/证据修复
- 会话出处：fresh v2s-rooted 会话，续接同一 R 的静态实施评审。**未启动** Testcontainers / L2 / DEV / reset / seed；本仓除本文件外零写入。
- 亲验方式：逐条打开源码与生成物比对；契约 JSON 用独立脚本重算形状分布（25 个 read model）与信封归属；不采信任何自报数字。

---

## 0. 一句话结论

上一轮七条 `M` **全部真实闭合**，其中 `M-04`、`M-07` 修得比我提的要求更稳；四项裁决落地正确，包括最容易做反的裁决四（全局资产不加 scope 谓词）。但**同一类根因在最高频的 save 路径上原样留存**：copy 路径的遮羞消耗被消掉了，`saveOperationsCatalogItem` 侧的同构消耗点没有按项目自己已经入门的 fail-closed 约定消费，并以 `.asText("")` 静默兜底。这正是烧掉几小时的那一类，故 NO-GO。

---

## 1. 上一轮 M 逐条复核

| 项 | 结论 | 亲验依据 |
|---|---|---|
| M-01 库存 CAS | **CLOSED** | `InventoryOwnerService#writeTypedInventoryChange` 签名新增 `long expectedVersion`，`UPDATE … WHERE target_ref=? AND version=?` 绑的是该参数；count/increase/adjust 三处调用点均传 `command.expectedVersion()`；`:225` 的 `version==expected+1` 容忍**正确保留**（重放先在 `:130` 命中回执早返，陈旧写现在会 CAS 落空） |
| M-02 VOIDED 边界 | **CLOSED** | 在 owner 内 `catalog.resolveCatalogItemRef(context, invocation.itemCode())` 解析后再查依赖；错误码为 typed `DEPENDENT_FACTS_BLOCK_VOID` |
| M-03 回执隔离 | **CLOSED（两侧）** | contract 侧：签名带 `workspaceUuid`、双参 advisory lock、SELECT 带 `workspace_uuid=?`、PK 改 `(workspace_uuid, idempotency_key)`、迁移内 backfill 失败即 `RAISE EXCEPTION`（fail-closed）。asset 侧：`scope_key` + `receiptScope(null) → GLOBAL_RECEIPT_SCOPE` |
| M-04 版本重查 | **CLOSED＋** | `requiredCatalogExpectedVersion` 改为 fail-closed（缺 `sections` 或 `<0` 直接 422），原先形同虚设的 `expected >= 0` 守卫现在必然生效 |
| M-05 遮羞 readback | **CLOSED（copy 路径）** | `CopyExecutionReadback(String preflightDigest, List<CopyObjectReadback> created, …)` 为真具名多组件；`LocalCopyExecutionReadback` 改为组合 typed 值 |
| M-06 吞异常 | **CLOSED** | `executeCopy`/`copyLocal`（707–830）已无 catch；残留 18 处宽 catch 均为窄边界且 fail-closed（scope 检查落 typed 403、编解码抛 typed Problem），无一返回成功 |
| M-07 不可满足判定 | **CLOSED＋** | 判定式不再硬编码：非 canonical 支改为 `caseResults.length === scenarioCatalog.caseCount`，且 self-test `:154` 与契约 `catalog-inventory-api-scenarios.json:6` 的 `caseCount: 99` 交叉断言。canonical 支整段跳过 case loop，是独立模式而非关掉断言 |

## 2. 四项裁决落地

- **裁决一（保留回滚、经 M-05 消掉分支）**：copy 路径已无 catch 分支，无 "commit but degrade" 通路。**符合**。
- **裁决二 / 三（四个 GET 统一信封，含 `getOperationsCatalogItem`）**：**恰有一层**，已亲验四层一致——
  后端 `envelope(requestId, data)`（`navigation/items/detail/shapeManifest` 四个 producer 均返回，含 `items` 的空结果早退路径 `return envelope(requestId, empty)`）；
  生成器 `queryEnvelopeModels` 白名单**恰为这四个**；
  TS `CatalogQueryEnvelope<T> = {revision: string; requestId: string; data: T}`（必填、无索引签名），payload 类型平铺；
  `read-models.json` 里这四个的平铺 `required` 描述的正是 `data`，与其余 12 个模型自带信封的写法虽不同源但各自自洽。
- **裁决四（图片资产全局共享）**：**符合，且是最容易做反而没做反的一项**。`assetRefsStillReferenced` 是单条 `SELECT sections::text FROM catalog.catalog_item WHERE status <> 'VOIDED'`，**无 `data_node_ref` / `brand_ref` 谓词**；`assetReferencedAnywhere` 退化为它的单元素委托；coordinator 改为一次批量调用；残留两处 `assets.require(` 都在 `stageWorkspaceAsset` / `stageAsset`，那里 readback 就是该操作自身产物，不属预读。

## 3. harness 与证据

- `safeCode` 白名单正则 + 兜底常量 ✓
- child first failure **真透传**：`:243` 用 `safeCode(catalogReport.firstFailure ?? …)` 带出真实码；`:36` 在子报告 FAIL 且码为兜底值时**抛错**而非吞掉 ✓
- `seen` 保全：`:75` 对重复/越界/错 runId 事件直接抛，`:81` 与 `operationIds` 精确集合相等，`:82` 返回 `count: events.length`，无归零计数 ✓
- skip reason 由 `caseLoopSkipReason({performanceCanonicalMode, sharedFixtureBarrier})` 从**实际变量**派生 ✓
- Java 侧 `assertEquals(196, result.path("completedOperations").asInt())` 是真分母断言 ✓
- `problem-family` 证据存在且实质完整：有限分母、searchedSurfaces、反例、`preventionDispositions` 齐备，且 `M-03` 诚实标 `PARTIALLY_CONFIRMED` ✓

---

## 4. 本轮 findings

### M-01（新）｜save 路径未按项目自己的 fail-closed 约定消费 owner readback，空 `targetRef` 静默落库

- **仓内事实**：`CatalogInventoryCoordinator:516`
  ```java
  JsonNode ensured = parseCatalogSaveOwnerReadback(inventory.ensureCatalogItemSaveTarget(…).canonicalJson());
  node.put("targetRef", ensured.path("targetRef").asText(""));
  ```
  `node` 是 catalog draft 的 inventory 配置条目，随 draft 持久化进 `catalog.catalog_item.sections`。
- **仓内事实（对照标准已存在且已入门）**：`scripts/check/backend-performance-sql-merge-coverage:523-529` 把消费 `CanonicalJsonDocument` 的正确写法固化为三段——`readTree` → `if (!envelope.path("data").isObject())` 形状断言 → `treeToValue(…, X.class)` typed 绑定，并**显式禁止** `readValue` 直绑。该门只覆盖 brand copy preflight adapter，不覆盖本站点。
- **推论**：owner 侧一旦改名或漏发 `targetRef`，此处不抛、不告警，写入空串并继续，最终把商品的库存配置绑到空引用。
- **为什么不是更小方案**：不是要废掉 `CanonicalJsonDocument`（那是刻意的直通传输，有 `writeRawValue` 序列化器与专门的门）。最小修复就是让本站点执行**已有**约定：加形状断言 + typed 绑定，去掉 `.asText("")` 兜底；并把该门的适用面从单个 adapter 扩到所有跨 owner canonicalJson 消费点。
- **适用条件与反例**：这是**潜在**缺陷，需 owner 侧字段漂移才触发。但本仓已有先例——上一轮 `copyLocal` 正是发出 `mappings` 而契约要 `referenceMappings`，那次漂移真实发生并烧掉数小时；且此处比那次更难发现（那次会抛，这次静默）。
- **同一方法内的不对称本身即佐证**：入参方向写的是 `if (!targetRef.isBlank()) ensure.put("targetRef", targetRef);`，出参方向却接受空串。
- **落点**：`saveOperationsCatalogItem`，M1 profile（113 条 COMMAND 里 68 条的那一档）最高频写路径。

### S-01｜读信封两套约定并存，旧那套等于不校验

4 个走严格 `CatalogQueryEnvelope`，其余 12 个仍走
`CatalogInventoryEnvelope<T> = {revision?; requestId?; data?: T; result?: T; version?: number; [key: string]: …}`
——**全可选 + 开放索引签名**，任何形状都能通过。裁决二/三的范围（四个 GET）已满足；但"从根上消掉"只在这四个上成立，其余 12 个读接口仍无编译期约束。

### S-02｜新加的严格类型在 3/4 消费点被 cast 掉

`CatalogWorkbenchPage.tsx:138/139/145`、`:291` 把 `currentData` / `data` 强转为 `CatalogInventoryEnvelope`，只有 `CatalogItemCreateDrawer.tsx:38` 保留 `CatalogQueryEnvelope<CatalogShapeManifestView>`。运行期正确（`envelopeData` 读 `.data`），但刚加的编译期防线在多数站点被抹掉，payload 漂移仍不会在构建期暴露。

### S-03｜`cleanupStatus` 声明的 owner 里没有 cleanup

`backend-performance-testcontainers-196-remote-workload.mjs:260` 写 `cleanupStatus: 'OWNED_BY_JAVA_TEST_AND_MANAGED_RUNNER'`，但 `BackendPerformanceTestcontainers196Test.java` 内**没有 `@AfterAll`/`@AfterEach`，也没有任何 cleanup 断言**。容器由 Testcontainers 自身回收，实际风险低，但这条字符串声明了一个被点名 owner 并不执行的责任——正是本轮要消灭的"声明即绿"形态。

### N-01｜`CatalogShapeManifestView.revision` 与信封 `revision` 同名异值

`resp.revision`（契约修订 `CATALOG_INVENTORY_P1_20260806`）与 `resp.data.revision`（manifest 自身修订）都合法且不同值，消费方取错不会报错。建议 payload 内改名为 `manifestRevision`。

### N-02｜typed Problem 未链因

`parseCatalogSaveOwnerReadback` / `canonicalLocalJson` / `canonicalSaveRequest` 均 `catch (Exception failure)` 后抛 typed Problem，**不带 cause**。行为 fail-closed 无误，但下一次同类排障仍拿不到原始异常——这正是本轮成本的一部分。

---

## 5. 方案合理性（不只看闭环）

- **问题对不对**：对。四项裁决瞄准的是真实的用户/契约问题，不是自造的。
- **方案优不优**：整体优。特别是 `M-07` 把分母从硬编码改成契约派生、`M-04` 把守卫改成 fail-closed，都比我提的最小要求更根本。**唯一走偏处**是把 `M-05` 当作**实例**修（copy 一处），而它是**类**缺陷（凡跨 owner 消费 `CanonicalJsonDocument` 处皆同构）——见 M-01。
- **代价配不配**：配。没有引入新基建，均在既有结构内改；`assetRefsStillReferenced` 的全表扫描在当前数据量下不构成问题，且比逐条查询更省，符合本程序"合理架构约束下的最小调用次数"的目标。
- **过度工程**：未见。新增 `CatalogQueryEnvelope` 是必要的严格类型，不是多余抽象。

## 6. UI 与交互自问

- **是否来自明确批准的 Journey**：是。信封统一直接源自 Dexter 裁决二/三，非我方或作者自拟。
- **用户此时这样操作是否合逻辑 / 有无更短路径**：四个读接口的外层形状统一后，前端解码收敛到 `envelopeData` 一处，比原先 A/B 混用更短。
- **不合理之处的来源**：S-01 的两套并存来自**历史实现惯性**（`CatalogInventoryEnvelope` 是覆盖读写两类的旧宽松兜底类型），不是后台接口限制，也不是产品语义未裁决。
- **运行期是否真的通了**：四个消费点已亲验均读 `.data`（`decodeNavigation` / `decodeItems` / `decodeDetail` 经 `envelopeData`，manifest 直接 `?.data`），无一残留平铺读法。

## 7. manifest Part B / C / D 对照（本轮 delta）

| 章 / 条款 | 命中 | 落点 |
|---|---|---|
| B.1 owner 边界 | 命中 | M-02 在 owner 内解析 code→ref；M-01（新）指出 coordinator 侧跨 owner 消费未达约定 |
| B.2 transaction 起点 | `NOT_APPLICABLE` | 本轮整改未触及 `ONE_REQUEST_ONE_TRANSACTION_ORIGIN` 分类 |
| B.3 data / 并发 | 命中 | M-01（上轮）CAS 绑调用方 `expectedVersion`；M-03 回执 PK 改复合键 |
| B.4 security / 租户隔离 | 命中 | M-03 contract 回执按 `workspace_uuid` 隔离；裁决四确认资产全局共享**不得**加 scope 谓词 |
| B.5 consumer 契约 | 命中 | 裁决二/三信封统一，后端/生成器/契约/TS/UI 五处一致；S-01、S-02 为残留 |
| B.6 failure / evidence oracle | 命中 | M-06 无吞异常；harness first-failure 透传与 `seen` 保全；S-03、N-02 为残留 |
| Part C 规范性条款 | 命中 | `HTTP_OPERATION_DENOMINATOR_BEFORE_EFFICIENCY_CLAIM`：`caseCount` 改契约派生并交叉断言；`SET_BASED_COLLECTION_READS`：资产判断改单条批量 |
| Part D 章节级 | 见上表逐行 | 无遗漏章；未触及章已显式标 `NOT_APPLICABLE` |

## 8. 授权边界

- 本结论为**静态**评审：仅覆盖源码、契约、生成器、测试脚本与证据文件。
- **不授权**下一 Roadmap step、不授权 DEV、不授权 Testcontainers / L2 / reset / seed / UAT / 部署 / 手工 SQL。
- 全绿的静态门**不等于**动态或性能成功；本轮未运行任何动态负载，不得据此宣称 196 条已跑通。
- `M-01` 与三条 `S` 均在 Codex 既有批准边界内，可自主修复，不构成再授权门槛；**无需 Dexter 裁决项**。
