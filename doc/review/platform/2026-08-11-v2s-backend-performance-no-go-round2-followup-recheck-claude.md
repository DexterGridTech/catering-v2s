# BP 静态 NO-GO Round-2 整改复核（Claude 独立评审）

- 结论：**GO**　**M=0　S=0　N=1**
- 范围：上一轮 `M-01`（P3 重复包装信封族）、`N-01`（package hash 语义）、`N-02`（命令族宽松包装）的闭合度；16 GET / 26 mutation / catalog-management 消费端 / package hash 证据 / 196 registry source-derivation
- 会话出处：fresh v2s-rooted 会话。**未启动** Testcontainers / L2 / DEV / reset / seed；评审期本仓零写入（`.runtime` 复查无新增文件），本文件为唯一写入。
- 亲验方式：不采信 codex round-1 盲审结论与任何自报数字。**信封归属分布用我自己实现的脚本从权威产物独立重算**；**6 条 entry 哈希与 2 条 legal drift 全部独立复算**；授权范围内的门与测试全部 fresh 复跑。

---

## 0. 一句话结论

上一轮的 `M-01` 是真根因修复，不是打补丁：P3 不再按 `method` 猜，而是**从权威 read-model 与 OpenAPI wire 的 `required` 派生 envelope 归属**，并对未知 GET fail-closed 抛错。我独立重算的分布与声明**逐条吻合**（GET 16 = MODEL 6 + P1 3 + P3 7；mutation 26 = MODEL 24 + LEGACY 2），三类 GET 各恰一层，消费端 `.data.data` 清零，且补上的机器断言比我建议的更强。`N-01`、`N-02` 亦全闭。唯一残留是后端 coordinator 三处已不可达的 A/B 兼容三元表达式，无运行期影响，记 N。

---

## 1. 上一轮 findings 复核

### M-01（P3 重复包装信封）——**CLOSED，根因级**

**归属改为从权威产物派生**（`scripts/generate/catalog-inventory-p3-frontend.mjs:75-84`）：

```js
if (operation.method !== "GET") return transportEnvelopeRequired(wireRequired) ? "MODEL" : "LEGACY";
const sourceRequired = readModelRequired.get(response);
if (!Array.isArray(sourceRequired)) throw new Error(`P3_GET_READ_MODEL_REQUIRED_MISSING:${response}`);
if (transportEnvelopeRequired(sourceRequired)) return "MODEL";
return transportEnvelopeRequired(wireRequired) ? "P1" : "P3";
```

我用自己实现的脚本、直接读 `catalog-inventory-read-models.json` / `catalog-inventory.openapi.yaml` / `catalog-inventory-edge-contract.json` 重算，结果与声明**完全一致**：

| 归属 | 数量 | operationId |
|---|---|---|
| MODEL | 6 | workbenchContext、dictionary、productionTags、localCopyCandidates、brandCopyCandidates、inventoryTargets |
| P1 | 3 | catalogNavigation、catalogItems、catalogItem |
| P3 | 7 | inventoryTarget、changeSummary、businessHistory、consumptionReferences、ledger、diagnostics、shapeManifest |
| **GET 合计** | **16** | |
| mutation MODEL | 24 | 无额外包装 |
| mutation LEGACY | 2 | `preflightOperationsBrandCatalogCopy`、`updateOperationsInventoryTargetConfiguration` |

**各恰一层，已逐类亲验生成物**：
- P1 三个的 TS 类型现已自带信封（`catalog-inventory-edge.ts:55/56/57` 为 `{revision; requestId; data:{…}}`），rtk **裸用**不再包 —— 一层；
- P3 七个 payload 平铺（`:78` `CatalogShapeManifestView` 首字段已是 `manifestRevision`），由 `CatalogQueryEnvelope<>` 包 —— 一层；rtk 中恰 7 处 `build.query<CatalogQueryEnvelope<`；
- MODEL 六个裸用 —— 一层；
- 两条 LEGACY 的 wire `required` 我核过确为平铺（`BrandCatalogCopyPreflight` = `[sourceScope, targetScope, …]`、`InventoryTargetCurrentView` = `[target, balance, …]`），包装真属必需，**source-proven 成立**。

**消费端**：全前端 `.data.data` / `.data?.data.data` **清零**；`localCopyPayload` 的 `asRecord(outer.data) ?? outer` 双层兼容解码已移除；`decodeDetail` 为严格单次 `envelopeData` 解包，且 `CatalogManagementPage.test.tsx:163-164` 传裸对象断言 `toBeUndefined()` —— 这是**红控制**（证明拒绝无信封形状），不是容忍。残留的 `as CatalogInventoryEnvelope` 仅在 `BrandCatalogCopyDrawer:36/51` 的 mutation 响应与测试夹具，属 LEGACY 族，与归属一致。

**机器控制比我建议的更强**（`scripts/test/catalog-inventory-query-envelope.test.mjs`）：
- `:44` `queryOperations.length === 16`；`:46/:49/:53/:81` 对 P1/MODEL/P3/LEGACY 四组做 `assert.deepEqual` **精确 operationId 列表**，不是计数；
- `:31-33` `assertP3WrapperIsTransportFlat`：被 P3 包装的模型，其 read-model `required` **与** P3 输入 schema `required` 都不得已含 transport envelope —— 正是我上一轮建议的那条断言；`:71` 配红变异证明它会红；
- `:43` 断言生成器保留 `P3_GET_READ_MODEL_REQUIRED_MISSING` fail-closed 抛出；
- `:105-119` 对 6 个消费文件逐个钉 required / forbidden 表达式（如 `CatalogDictionaryDrawer` 必须有 `dictionaryQuery.data?.data` 且**不得**有 `…data.data`；`CatalogItemDrawer` 必须有 `productionTagsQuery.data?.data.entries`）。

fresh 复跑：`node --test scripts/test/catalog-inventory-query-envelope.test.mjs` → **11/11 PASS**。

### N-01（package hash 语义）——**CLOSED**

三层语义已分离命名并 fail-closed：
- `inputs.entrySnapshot.semantics = IMMUTABLE_PACKAGE_ENTRY_SNAPSHOT`，条目 schema 由 `cli.mjs:214-217` 严格校验（`exactObjectKeys(["path","entrySha256"])` + path 相等 + sha256 格式）；
- `inputs.{id}.sha256` = 当前字节，语义 `CURRENT_INPUT_BYTES_MUST_MATCH_PACKAGE_EXIT_OBSERVED_STATE`；
- exit `observedInputState` 记录退出态；`cli.mjs:238-253` 以 `exactSet(声明的 legalDrift 集合, 实测 drift 集合)` 双向拒绝（漏报与虚报都红），每条 disposition 的 entry/exit 双哈希必须对齐。

**我的独立复算**（口径与 `hashOrAbsent` 的 `sha256(readFileSync)` 一致）：6 条 entry 快照中 4 条相符，drift 集合 = `{sourceInventory, shapeMatrix}`，与 exit 声明的两条 legal drift **精确相等**；两条 disposition 的 `entrySha256`（`3b4e7c91…` / `e6168feb…`）与 `exitSha256`（`3ed5da95…` / `06500239…`）均与我实测一致。

fresh 复跑 `backend-performance-package-input-self-test` → `PASS`，`RED_STALE_EXIT_STATE=PASS`、`RED_MALFORMED_ENTRY_SNAPSHOT=PASS`。

### N-02（命令族宽松包装）——**CLOSED**

26 个 mutation 中 24 个由 wire 类型自带信封、P3 不再包装；仅剩 2 条 LEGACY，且如上已证其 wire 确为平铺，包装必需。命令族不再存在语义双层。

---

## 2. 196 registry 是否仍 source-derived —— **是**

两个 registry 各 196 行。fresh 复跑（授权范围内）：

| 命令 | 结果 |
|---|---|
| `backend-performance-operation-source-inventory --check` | PASS，`M1=68`、`NON_M1_CUR=45`、`LOADERS=10` |
| `… --self-test` | `PASS`，`RED_MISSING_ROW / RED_SOURCE_SUBSTITUTION / RED_LOADER_ORPHAN / CLEANUP` 全 PASS |
| `backend-performance-operation-database-shape --check` | PASS，`PROTOCOL_COMMANDS=25`、`TASK_READS=78` |
| `… --self-test` | `RED_MISSING_ROW / RED_SOURCE_REF / RED_LITERAL_SOURCE / RED_FOLD_PROOF / RED_BUDGET_FORMULA / CLEANUP` 全 PASS |
| `backend-performance-static-196-reconciliation --check` | `PASS`，`OPERATIONS=196`、`SCENARIOS=14`、`LOADERS=10` |

`RED_SOURCE_SUBSTITUTION` 与 `RED_LITERAL_SOURCE` 正是"行不再由 source 派生就必须红"的控制，二者在重建后仍能拒绝 —— 重建**未**削弱 source-derivation。reconciliation 同时诚实输出 `DYNAMIC_ADMISSION=NOT_YET_AUTHORIZED`，没有把静态结果冒充动态准入。

---

## 3. 本轮 finding

### N-01｜后端 coordinator 三处已不可达的 A/B 兼容三元表达式

`apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java:917`、`:956`、`:1121`：

```java
JsonNode item = detail.path("data").path("item").isObject() ? detail.path("data").path("item") : detail.path("item");
```

- **仓内事实**：`CatalogOwnerService#detail` 恒以 `envelope(requestId, data)` 返回，故 `: detail.path("item")` 分支不可达。
- **推论**：无运行期影响；但它在生产代码里明写"两种形状都收"，与本轮"恰有一层"的权威结论相矛盾，且若 owner 未来漏发信封，这三处会静默改读平铺形状而不是失败，正是本程序要消灭的静默容忍族。
- **适用条件**：契约与生成器层已把形状钉死并有红变异，漂移在到达这三行之前就会被上游拒绝，所以风险是被上游控制兜住的，不是敞口。
- **最小修复**：删掉三元的 else 分支，直接 `detail.path("data").path("item")`；若要更严，可比照前端做法在非 object 时抛 typed Problem。属删除死分支，不构成新设计。
- **为什么不是更小方案**：更小的方案是不动它——但那会让下一个读这段代码的人（或 agent）合理地认为形状仍然二义，从而在别处复制这种写法。
- **是否需要 Dexter 产品裁决**：否。

---

## 4. 方案合理性

- **问题对不对**：对。修的是"谁拥有 envelope"这个真问题，而不是把三个报错的消费点改回去。
- **方案优不优**：优，且优于我上一轮给的建议。我建议的是"前端复用后端白名单"，作者改成**从两个权威产物的 `required` 派生**——白名单是一份需要人工同步的清单，派生则不会漂移，并且顺带把 mutation 族一并纳入同一条规则。三段归属（MODEL/P1/P3）看似比"单一规则"复杂，但它如实反映了信封本来就有三个可能的产生点，把这个事实显式化比强行统一更诚实；关键是三者互斥且覆盖 16，已被 `deepEqual` 钉死。
- **代价配不配**：配。无新基建，新增控制是一个测试文件内的断言与红变异，分钟级。
- **过度工程**：未见。`assertP3WrapperIsTransportFlat` 满足右尺寸三问（反复发生、纯机械、成本远小于返工）。

## 5. UI 与交互自问

- **是否来自明确批准的 Journey**：是，延续上轮裁决二/三。
- **用户此时这样操作是否合逻辑**：上轮会崩的商品抽屉生产标签选择、字典抽屉均已恢复为单层读取，路径未变长。
- **是否有更短路径**：无更短者；消费端现在每处只解一层。
- **不合理之处来源**：上轮的分叉来自生成器启发式，本轮已从权威产物派生消除，非产品语义未裁决。

## 6. manifest Part B / C / D 对照（本轮 delta）

| 章 / 条款 | 命中 | 落点 |
|---|---|---|
| B.1 owner 边界 | `NOT_APPLICABLE` | 本轮未触及 owner 事务与跨 owner 消费 |
| B.2 transaction 起点 | `NOT_APPLICABLE` | 未触及 |
| B.3 data / 并发 | `NOT_APPLICABLE` | 未触及 |
| B.4 security / 租户隔离 | `NOT_APPLICABLE` | 未触及 |
| B.5 consumer 契约 | 命中 | 16 GET / 26 mutation 归属派生化，各恰一层；6 个消费文件被 required/forbidden 钉死；**本章上轮未闭项已闭** |
| B.6 failure / evidence oracle | 命中 | package hash 三层语义 + `exactSet` 双向 fail-closed + 两条红变异；196 三门 self-test 红控制全绿 |
| Part C 规范性条款 | 命中 | `HTTP_OPERATION_DENOMINATOR_BEFORE_EFFICIENCY_CLAIM`：16 / 26 / 196 三个分母均为机器断言且我独立重算命中；红变异满足"真 red mutation 证明能拒绝错误行为" |
| Part D 章节级 | 见上表逐行 | 未触及章已显式标 `NOT_APPLICABLE` |

## 7. 授权边界

- 本结论仅为**静态**评审，覆盖源码、契约、两个生成器、控制面、测试与证据文件。
- **不得**把本结论表述为动态、业务、cleanup 或性能成功；本轮未运行任何动态负载，196 条是否跑通**未经验证**，reconciliation 自身亦标注 `DYNAMIC_ADMISSION=NOT_YET_AUTHORIZED`。
- **不授权** Testcontainers、DEV、L2、reset、seed、UAT、部署或手工 SQL，也不授权下一 Roadmap step。
- 唯一 `N` 在 Codex 既有批准边界内，可自主修复；**无需 Dexter 产品裁决项**。
