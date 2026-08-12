# BP 静态 NO-GO 整改二轮复核（Claude 独立评审）

- 结论：**NO-GO**　**M=1　S=0　N=2**
- 范围：上一轮 `M-01 / S-01 / S-02 / S-03 / N-01 / N-02` 的闭合度 + 本轮同族修复（16 GET 严格信封、cleanup ownership、manifestRevision、typed Problem cause、BPF package admission）
- 会话出处：fresh v2s-rooted 会话。**未启动** Testcontainers / L2 / DEV / reset / seed；本仓除本文件外零写入。
- 亲验方式：逐条打开源码、契约、两个生成器与生成物比对；契约 JSON 用独立脚本重算模型形状分布；**7 条声明 SHA-256 全部独立复算**；不采信任何自报数字与两轮 codex review 的结论。

---

## 0. 一句话结论

上一轮六条 findings **全部真实闭合**，其中 canonicalJson fail-closed 消费族修得很扎实（三段式约定 + 空值校验 + 四条真红变异）。但把严格信封从 4 个 GET 扩到 16 个时，**两个生成器用了两条不同的包装规则**：后端只包 4 个白名单模型，前端对**每个 GET** 无条件再包一层。结果是 6 个 GET 的类型声明了两层信封而运行期只有一层，并且已有 3 个消费点按错误类型改写——其中一处会在运行期抛异常。新增的回归测试只按类型名断言"恰有一层"，看不见这层重复。

---

## 1. 上一轮 findings 逐条复核

| 项 | 结论 | 亲验依据 |
|---|---|---|
| M-01 canonicalJson 消费 | **CLOSED** | `parseLocalCopyJson:440`、`parseCatalogSaveOwnerReadback:599`、`requiredInventoryTargetRef:588` 三者均 `readTree` → `isObject` 断言 → typed 绑定 → 空值抛错；`catch (Problem) { throw failure; }` 保证 typed problem 不被外层吞。门 `validateCrossOwnerCanonicalReadbacks` 分母 `return 9`（7 copy + typed/legacy 各 1），并显式禁止 `ensured.path("targetRef").asText("")` 与 `mapper.readValue(canonicalJson,` |
| M-01 红变异 | **有效** | 4 条真变异：绑整个 envelope、给 `targetRef` 加 `== null ? ""` 兜底、退回 `.asText("")`、删掉 isObject 断言；每条断言精确错误码且要求 `WHY=/BACKGROUND=/PATTERN=` 标记。**能拒绝旧的缺陷写法** |
| S-01 两套读信封 | **CLOSED（读族）** | 16/16 `build.query` 全部 `CatalogQueryEnvelope<T>`；`CatalogInventoryEnvelope` 在读族已清零（仅命令族在用） |
| S-02 放宽 cast | **CLOSED** | 解码器签名改为 `CatalogDataEnvelope \| undefined`；`CatalogItemDrawer:113/875/876` 直接传 `query.data` 无 cast；回归测试锁死 `CatalogWorkbenchPage` 不得含 `CatalogInventoryEnvelope` / `currentData as` / `query.data as`。残留 `as CatalogInventoryEnvelope` 均在 mutation 响应与测试文件，属命令族 |
| S-03 cleanup owner | **CLOSED** | 改为诚实声明 `cleanupStatus: NOT_OWNED_BY_WORKLOAD` + `cleanupOwner: TESTCONTAINERS_AND_MANAGED_RUNNER`，且 `BackendPerformanceTestcontainers196Test:181-182` 对两个值都做 `assertEquals` |
| N-01 manifestRevision | **CLOSED** | producer `CatalogOwnerService:1231` 发 `manifestRevision`；`read-models.json`、`catalog-item-editor-manifest.json`、`catalog-common.schemas.yaml`、openapi、design-byte-coverage 全部同名；`revision` 影子消失 |
| N-02 cause 保留 | **CLOSED** | `CatalogOwnerApi.Problem` 新增 `(code, status, message, Throwable cause)` 构造；coordinator `:449/:453/:612/:619/:627`、`SaveOperationsCatalogItemOperation:45`、`shapeManifest:1237`、`saveCatalogItem:285` 均传 cause |

**`SaveOperationsCatalogItemOperation:41` 的 `readValue` 不是缺陷**：生成的 wire `record CatalogItemSaveReadback(String revision, String requestId, Result result, …)` 本身就是命令信封，此处是信封→信封直绑；被门禁止的是"读模型嵌在 `data` 下却直绑"（`BrandCatalogCopyPreflight`），两者不同族。

**package admission 的两项点名控制均为真**：
- authority 漂移：`cli.mjs:167-169` 要求 `implementationAuthority === true` 且 `runtimeAuthority` / `seedResetAuthority` 与 active 逐字段相等，`:188` 对无 predecessor 分支强制二者为 `false`，`:1259` 复检 —— **能拒绝**。
- predecessor hash 漂移：`:183` 以 `hashOrAbsent(exitAbsolute) !== predecessor.packageExitSha256` 拒绝，并同时比对 `packageId`、`staticProofStatus === "PASS"`、`reconciledOperations === 196`。我独立复算该 exit 文件哈希：`a8676788b1a98382…` **与声明一致** —— 串行链真实完整。

---

## 2. 本轮 findings

### M-01｜两个生成器包装规则不一致，6 个 GET 类型声明两层信封而运行期一层，3 个消费点已按错误类型改写

**仓内事实（生成器分歧）**
- 后端/契约生成器 `scripts/generate/catalog-inventory-p1.mjs`：`queryEnvelopeModels` 仍是**仅 4 个**（`CatalogNavigationView` / `CatalogItemPage` / `CatalogItemDetail` / `CatalogShapeManifestView`），其余模型直接用自身 `dataSchema`。
- 前端生成器 `scripts/generate/catalog-inventory-p3-frontend.mjs:59`：`operation.method === "GET" ? \`CatalogQueryEnvelope<${response}>\` : …` —— 对**每个 GET 无条件包装**。

**仓内事实（10 个模型 payload 自带信封）**
`catalog-inventory-read-models.json` 中 10 个模型的 `required` 本身就是 `[revision, requestId, data]`。其中 6 个是 GET 响应：

| operationId | responseComponent |
|---|---|
| `getOperationsCatalogWorkbenchContext` | `CatalogWorkbenchContext` |
| `getOperationsCatalogDictionary` | `CatalogDictionaryView` |
| `getOperationsProductionTags` | `ProductionTagPage` |
| `getOperationsLocalCatalogCopyCandidates` | `LocalCopyCandidatePage` |
| `getOperationsBrandCatalogCopyCandidates` | `BrandCopyCandidatePage` |
| `getOperationsInventoryTargets` | `InventoryTargetPage` |

生成的 TS 对这 6 个是 `CatalogQueryEnvelope<T>` 而 `T` 首层已是 `{revision: string; requestId: string; data: {…}}`（`catalog-inventory-edge.ts:54/58/59/60/65/68`）—— **类型两层**。

**仓内事实（运行期一层）**
`ProductionTagOwnerService.readTags` 末行 `return envelope(requestId, data)`；controller `OperationsCatalogInventoryController` 的 `readResponse(JsonNode body) { return ResponseEntity.ok(jsonBody(body)); }` **不再包装**。故运行期恒为一层。

**影响（3 个消费点已按错误类型改写）**
- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx:116`
  `(productionTagsQuery.data?.data.data.entries ?? [])` —— `?.` 只守第一跳；`data` 存在时 `.data.data` 求值为 `undefined`，再取 `.entries` **抛 TypeError**，`?? []` 接不住异常。商品抽屉在生产标签加载成功时即崩。
- `CatalogDictionaryDrawer.tsx:69` `dictionaryQuery.data?.data.data` —— 恒 `undefined`，字典抽屉无数据（静默）。
- `CatalogDictionaryDrawer.tsx:70` `productionQuery.data?.data.data` —— 同上。

**为什么门没拦住**
`scripts/test/catalog-inventory-query-envelope.test.mjs` 断言的是**类型名**：每个 GET 在 edge/rtk 两侧出现 `CatalogQueryEnvelope<`、不出现 `CatalogInventoryEnvelope<`、`queryOperations.length === 16`。它不检查被包装的模型是否**已经**是信封，因此对重复包装完全不可见。这与上一轮的根因同族：声明层自洽，跨层一致性无人负责。

**最小修复（并说明为何不是更小方案）**
让两个生成器共用同一条规则，而不是在前端按 `method` 猜。两条可选，推荐前者：
1. 前端生成器复用后端的 `queryEnvelopeModels` 白名单（或等价地：`required` 已含 `[revision,requestId,data]` 的模型不再包装）；
2. 或把这 10 个模型在 `read-models.json` 中改为平铺 payload，使"信封只由生成器加"成为唯一规则。

更小的方案（只改那 3 个消费点回单层）不可取：类型仍是错的，下一个消费者会再次被类型误导。修复后需把 3 个 `.data.data` 回退为单层，并在回归测试中补一条机械断言：**被 `CatalogQueryEnvelope` 包装的模型，其 `required` 不得包含 `data`**。该断言满足右尺寸三问（反复发生、纯机械、成本远小于返工）。

**适用条件与反例**：另外 10 个 GET（4 个 catalog 平铺模型 + 6 个 inventory 平铺模型）包装正确，不受影响；命令族（`build.mutation`）不走此路径，亦不受影响。

**是否需要 Dexter 裁决**：否。属实现一致性，不涉产品语义。

### N-01｜package-input 的 `/inputs/*` 哈希是入口前态快照，未标注亦不校验，2/7 已漂移

`doc/evidence/platform/2026-08-11-…-remote-package-input.json` 的 7 条 `{path, sha256}` 我逐条复算（口径与 `cli.mjs` 的 `sha256(fs.readFileSync)` 一致）：

- 相符 5 条：predecessor exit、`operation-handler-bindings.json`、`fact-loader-catalog.json`、`final-fixture-catalog.json`、`testcontainers-plan.json`
- 不符 2 条：`backend-performance-operation-source-inventory.json`（声明 `3b4e7c91…` / 实算 `07741806…`）、`backend-performance-operation-database-shape-matrix.json`（声明 `e6168feb…` / 实算 `0075541b…`）

**这不是伪造**：两者都在 `active-package.json` 的 `allowedChangeSurfaces` 内，包内合法变更导致漂移属设计内。问题在于：`cli.mjs` 对 `inputs` / `sourceInventory` / `shapeMatrix` **零引用**，字段既不校验也未标注语义，任何遵守「声明 SHA-256 逐个复算」纪律的评审者都会撞上这 2 条并无法区分"包内合法漂移"与"证据陈旧"。最小修复：把字段改名为 `entrySha256` 或加 `capturedAt: PACKAGE_ENTRY`，并在 package-exit 记录退出态哈希。

### N-02｜命令族仍用全可选宽松信封类型

`catalog-inventory-edge.ts:52` `CatalogInventoryEnvelope<T> = {revision?; requestId?; data?: T; result?: T; version?: number; [key: string]: …}` 现仅服务 mutation。因命令 wire 类型自身已是信封，`CatalogInventoryEnvelope<CatalogItemSaveReadback>` 在类型上同样是重复包装，只是全可选 + 索引签名使其恒可通过。本轮范围是 16 个 GET，命令族未在裁决范围内，故记 N；若后续统一，应与 M-01 同批处理，避免第三套规则。

---

## 3. 方案合理性

- **问题对不对**：对。六条 findings 的修复方向都对准了真实问题，没有回避。
- **方案优不优**：canonicalJson 消费族优（把散点写法收敛为一条可红变异的约定）；cleanup 改为诚实声明比补假回执优；manifestRevision 改名是根治。**唯一走偏**是信封扩面：把"给 GET 加信封"实现成前端按 `method` 判断，而不是与后端共用模型白名单——用了一条更省事但与既有事实不符的规则。
- **代价配不配**：配，无新基建。但 M-01 的返工成本正来自"两个生成器各写一条规则"，修复时应一并消掉这个分叉而非再加补丁。
- **过度工程**：未见。

## 4. UI 与交互自问

- **是否来自明确批准的 Journey**：16 GET 统一信封是上轮裁决二/三的自然延伸，方向经批准。
- **用户此时这样操作是否合逻辑**：受影响的是商品抽屉的生产标签选择与字典抽屉——都是用户在编辑商品时的常规路径，不是边缘操作。
- **不合理之处来自哪里**：来自**生成器规则分叉**，不是后台接口限制，也不是产品语义未裁决。
- **是否有更短路径**：有。单一包装规则即可，无需在消费点做双层解包。

## 5. manifest Part B / C / D 对照（本轮 delta）

| 章 / 条款 | 命中 | 落点 |
|---|---|---|
| B.1 owner 边界 | 命中 | 三个 canonicalJson parser 均在 coordinator 内 fail-closed；门分母 9 |
| B.2 transaction 起点 | `NOT_APPLICABLE` | 本轮未触及 `ONE_REQUEST_ONE_TRANSACTION_ORIGIN` |
| B.3 data / 并发 | `NOT_APPLICABLE` | 本轮未触及 CAS 与版本事实 |
| B.4 security / 租户隔离 | `NOT_APPLICABLE` | 本轮未触及回执隔离与 scope |
| B.5 consumer 契约 | 命中 | 16 GET 严格信封；**M-01 双层信封为本章未闭项** |
| B.6 failure / evidence oracle | 命中 | cause 全链保留；cleanup 诚实声明并被断言；N-01 为 evidence 标注残留 |
| Part C 规范性条款 | 命中 | `HTTP_OPERATION_DENOMINATOR_BEFORE_EFFICIENCY_CLAIM`：回归测试 `queryOperations.length === 16` 为真分母；红变异四条满足"真 red mutation 证明能拒绝错误行为" |
| Part D 章节级 | 见上表逐行 | 未触及章已显式标 `NOT_APPLICABLE` |

## 6. 授权边界

- 本结论为**静态**评审：仅覆盖源码、契约、两个生成器、测试脚本、控制面与证据文件。
- **不授权**下一 Roadmap step、DEV、Testcontainers、L2、reset、seed、UAT、部署、手工 SQL。
- 静态门全绿**不等于**动态或性能成功；本轮未运行任何动态负载，不得据此宣称 196 条已跑通。
- `M-01` 与两条 `N` 均在 Codex 既有批准边界内，可自主修复；**无需 Dexter 产品裁决项**。
