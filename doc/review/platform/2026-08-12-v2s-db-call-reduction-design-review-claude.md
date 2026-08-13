# 无用数据库调用收敛：DESIGN review（Claude 独立评审）

- 结论：**GO（M=0 / S=1 / N=1）**
- 评审对象字节：三份声明 SHA-256 **我逐份独立复算，全部相符**（需求 `0201c0bb…`、详设 `f3c1920c…`、manifest `3c0eca0a…`）。
- 会话出处：fresh v2s-rooted 会话（仓根 `/Volumes/idea/catering-v2s`；Codex 给出的 `/Users/dexter/...` 路径在本机不存在，特此声明）。本文件为唯一写入。
- 亲验声明：**不继承修订前预审 verdict**。16 个 coordinator 方法、5 条 owner set、7 个恢复位置、6 类分母、manifest authority 均由我独立打开源码/产物核对。

---

## 1. 九项重点核验结论

| # | 核验点 | 结论 |
|---|---|---|
| 1 | U01 绑定真实 coordinator 与完整重入分母，不碰命令事务 | **通过（一处符号面缺陷，见 S-01）** |
| 2 | U02 owner-api-registry 为有限、hash-bound 权威映射 | 通过 |
| 3 | U03 诚实处理 721→730 | 通过 |
| 4 | M14/S7/M15 为真实方法级 measurement boundary | 通过 |
| 5 | U04 真正阻止自批升值 | 通过 |
| 6 | U05 顺序唯一无矛盾 | 通过 |
| 7 | PRE/POST 严格同配置 | 通过 |
| 8 | 六类分母完整、无越权结论 | 通过 |
| 9 | 一次设计 / 一批实施 / 一次实施后评审，未提前授权 | 通过 |

### 1.1 U01（点 1）

文件绑定正确：`apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java`。我实测该类**恰有 16 个 `@Transactional(readOnly = true)` 方法**，与详设分母一致。

disposition 表内部自洽：`KEEP_OUTSIDE_TRANSACTION` 6 条 + `REMOVE_BEST_EFFORT_TRANSACTION` 10 条 = 16，与 §2 分母行 "6 keep + 10 remove + 0 snapshot" 相符。

**命令事务未被触碰**：§1.2 明写"不改任何命令事务；同一 owner read 被命令调用时继续 join 外层 `REQUIRED`"。

**legacy dispatcher 正确排除**："保留三个 legacy dispatcher 现状，不把它们计入本分母"，且红变异包含"legacy dispatcher 或命令进入分母也必须红"——闭合了需求 M-01。

**证明手段是真运行断言**而非静态匹配：`CatalogInventoryReadTransactionTopologyTest` 真实调用 16 个 coordinator 并断言 `TransactionSynchronizationManager.isActualTransactionActive()==false`。

### 1.2 U02（点 2）

`contracts/policy/backend-performance-owner-api-registry.json` 以完整 API type/package 为 key、module owner 为 value，**绑定 API 声明源码 path+hash**；未知 API、重复冲突 owner、source hash 漂移三种情形均 fail closed。

可执行性齐备：execute 方法内对字段的方法调用证明 reachability（`ownerApiBindings={field,type,owner,callSymbols}`）；`CatalogScopeLookup` 纯 import 为**固定反例**；context resolver 即使构造注入也按 **closed exclusion kind** 排除；同一 owner 多个 API 只计一次。红变异覆盖漏报第二 owner、shapeClass 漂移、coordinated count 漂移、import 扫描、同 owner 重复计数。

`coordinatedOwnerParticipations=ownerCount-1` 作为预算参与量而**不伪造额外 owner write**，处理得当。

### 1.3 U03（点 3）

**未把净增 9 伪称九条新增项**——§5.3 禁止伪修复清单明列该形态。

有限恢复分母是 **7 个具名位置**，我逐个核实**全部真实存在**：`2026-08-12-p4-runtime-ledger-rebaseline.json`、`p4-ledger-authority-problem-family-discovery.json`、`rm1-u07-package-exit.json`、`p4-final-candidate-fingerprint-14.{pre,post}.json`、`p4-refresh-canonical-ledger-final-source-20260729.{pre,post}.json`。

`FOUND_WITH_FINGERPRINT | NOT_PRESENT_OR_NO_ROW_SET` 逐位置记录；找不到时 receipt 声明 `OLD_ROW_SET_UNRECOVERABLE` 并转 730 行全量 disposition；exclusion reason 是**封闭四项**（`TEST_FIXTURE_SETUP | STATIC_INITIALIZER | NON_REPEATED_OWNER_WRITE | OBJECT_STORAGE_NOT_SQL`）且绑 owning source path+hash+anchor；**无 PENDING 才可更新**；scanner 对 disposition 与 current scan 做 exact-set，"只改 count/fingerprint" 必红。

### 1.4 measurement boundary（点 4）

三条 mapping 各自写明 `measurementBoundary`，且**均显式排除 HTTP 与 setup**（"不含 HTTP/setup"、"不含 HTTP resolver"、"不含 platform session/workspace context"），共享 counted DataSource 子调用计入。

**"只在 fresh remote Testcontainers 获授权运行后写入实测整数，不填理想值、不复制 seed 数值"**——闭合需求 §4.3 的红线。

### 1.5 U04（点 5）

INCREASE 的授权 artifact 要求**两个独立条件同时成立**：在 package entry 前已存在，**且不属于当前 package changedPaths**。closed kind `DEXTER_EXPLICIT_SQL_BUDGET_INCREASE_AUTHORITY` 且字段完整（decisionId / approver=DEXTER / ledgerId / caseId / previous / approved / reason / 自身 hash）。

self-test 红变异覆盖面完整：只提高 current、无 authority 同步提高两文件、**同包伪造 authority**、未知 authority kind、断链、未批准、坏 hash、case set 漂移、降低 current 未降低 accepted latest。**自批路径被封死。**

### 1.6 U05 顺序与 PRE/POST（点 6、7）

顺序唯一且无矛盾：先修 report/comparator 并静态验红（步 2）→ **在任何 production behavior source 改动前**记录 PRE-bound source exact path+sha256 并执行 PRE（步 3，且"若任一 PRE-bound source 已偏离 package-entry hash，admission 直接失败"）→ U01–U04（步 4–6）→ fresh P4 → POST（步 7）。

PRE/POST identity 要素齐全：fixture path/version/sha256、**41-operation exact set**、每 operation callCount 与 stageIds exact map、report/measurement schema、seedProfile 全部相同；两侧 business 与 cleanup **均 PASS**；CONNECTION/TRANSACTION **严格下降**，QUERY/UPDATE 不上升。§5.3 亦禁止"保留 UPDATE comparator 的反向逻辑"。

### 1.7 分母与节奏（点 8、9）

六类分母与 manifest 的 `sourceComplianceDenominators` **逐条一一对应**，且 exit 规则含"evidence claim 超出 41 operations 必须失败"，§5.2 结论限制明写"不得表述为全部接口或全部性能达标；本项目不执行 L2"——无过度结论。

manifest `implementationAuthority: false`、`status: PROPOSED_REVIEW_ONLY`；§5.1 步 1 要求"同时取得明确 dynamic/reset/seed authority 才能进入比较步骤"，并"不重开已关闭 P0"。§5.1 步 8 与 §0 明确一次 DESIGN + 一批实施 + 一次 IMPLEMENTATION review。**未提前授予任何权限。**

---

## 2. Findings

### S-01｜DBCR-01 分母表列出的 16 个 coordinator 方法名在 owning source 中不存在

- **finding ID**：DBCR-DR-S01　**严重度**：S
- **owning source**：`doc/plans/platform/2026-08-12-v2s-db-call-reduction-implementation-design-codex.md` §DBCR-01 1.1 表格「coordinator」列
- **精确证据**：表列 `workbenchContext` / `navigation` / `listCatalogItems` / `catalogItemDetail` / `dictionary` / `productionTags` / `localCopyCandidates` / `brandCopyCandidates` / `inventoryTargets` / `inventoryTarget` / `inventoryTargetChangeSummary` / `inventoryTargetBusinessHistory` / `inventoryTargetConsumptionReferences` / `inventoryTargetLedger` / `inventoryTargetDiagnostics` / `catalogShapeManifest`。
  我在 `CatalogInventoryCoordinator.java` 中提取全部 16 个带 `@Transactional(readOnly = true)` 的方法，实际签名为：`readCatalogWorkbenchContext` / `readCatalogNavigation` / `readCatalogItems` / `readCatalogItem` / `readCatalogDictionary` / `readLocalCatalogCopyCandidates` / `readBrandCatalogCopyCandidates` / `readCatalogShapeManifest` / `readInventoryTargets` / `readInventoryTarget` / `readInventoryTargetChangeSummary` / `readInventoryTargetBusinessHistory` / `readInventoryTargetConsumptionReferences` / `readInventoryTargetLedger` / `readInventoryTargetDiagnostics` / `readProductionTags`。**表列 16 个名字无一在该类中存在。**
  表列名实为 **owner service 的私有方法名**（例如 `readCatalogShapeManifest` 的方法体是 `catalogReads.shapeManifest(...)`），因此该列既非 coordinator 符号亦非 owner 公开符号。
- **影响 unit**：`DBCR-U01`；连带 `TRANSACTION_OPERATION_DISPOSITION` 分母的 16-row exact ledger。
- **根因**：表格用 operation 语义简称代替真实 method symbol，而设计自身 §1.2 要求 topology ledger「逐项绑定 operationId、method symbol、source path 与 source anchor，禁止仅按类名计数」——**表格未达到它自己设定的精度标准**。
- **风险**：实施者按表建 16-row ledger 会写入不存在的符号；虽然 §1.2 的散文（文件路径 + "16 个具名 GET coordinator"）与红变异会在后续暴露，但会产生返工；更坏的情形是实施者转而去 owner service 找同名私有方法，与 §1.2 另行规定的「`CatalogOwnerService` 八个 typed read 入口」混淆层次，**漏掉真正的事务起点层**——而该层正是需求 M-01 纠正的核心。
- **最小根因修复**：将表格「coordinator」列的 16 个名字**替换为上列真实 method symbol**（`read*` 全称），并在同表增加 `sourcePath` 与 `sourceAnchor` 两列，使表格本身即满足 §1.2 的绑定标准。**不扩大到任何其他改动。**
- **是否需 Dexter 产品裁决**：否。

### N-01｜manifest 的 deliveryUnits 缺 `unitId`

- **finding ID**：DBCR-DR-N01　**严重度**：N
- **owning source**：`doc/evidence/platform/2026-08-12-v2s-db-call-reduction-design-granularity-manifest.json`，`deliveryUnits[]`
- **精确证据**：5 个 unit 的 `unitId` 字段解析为 `None`；仅有 title（`Sixteen GET transaction topology` 等）。而详设与本 review 通篇以 `DBCR-U01…U05` 指代。
- **影响 unit**：全部五个；连带 exit 阶段按 unit 对账的可机读性。
- **根因**：manifest 未落 unit 标识符，标识只存在于详设散文。
- **风险**：低。title 与详设顺序一一对应，人工可对齐；但 package exit 若需按 unitId 机械对账则缺键。
- **最小根因修复**：为 5 个 unit 补 `unitId: DBCR-U01…DBCR-U05`，与详设一致。
- **是否需 Dexter 产品裁决**：否。

---

## 3. 我认可的三处高于要求的设计选择

1. **U01 的证明用运行期断言而非静态匹配**——`isActualTransactionActive()==false` 直接证伪"事务是否真的没开"，比任何源码扫描都硬。
2. **U04 的 INCREASE 双条件**——"package entry 前已存在" **且** "不在当前 package changedPaths 内"，两条同时成立才算合法授权，把"同包造一份授权再引用"这条自批路径封死。
3. **U05 步 3 的 PRE-bound source hash 前置**——在任何行为改动前钉住源字节，且偏离即 admission 失败，使 PRE/POST 对比不可能跨越未记录的源码变更。

---

## 4. 授权边界

- 本结论仅为**静态 DESIGN review**，覆盖需求、详设、manifest、intake、adversarial review 产物，以及 `CatalogInventoryCoordinator`、canonical ledger 恢复位置等 owning source 的只读核验。
- **未实施任何生产源码**；未运行 Testcontainers、DEV、L2、reset、seed、浏览器、UAT、部署或手工 SQL。
- **不宣称任何动态、业务、cleanup 或性能成功。** seed 只覆盖 41 个 operation，不代表全部接口。
- **设计 GO 不自动授予实施权。** 后续必须等待 Dexter 明确授权，以一个 package 严格按 `DBCR-U01 → U05` 既定顺序实施，实施后只做一次 IMPLEMENTATION review。
- `S-01` 与 `N-01` 均在 Codex 既有批准边界内可自主修复；**无需 Dexter 产品裁决项**。
