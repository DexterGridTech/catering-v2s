# ProductionTagDefinition 迁入 catalog · DESIGN review

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=PTD-CATALOG-MIGRATION-DESIGN-20260921
VERDICT=NO-GO
M/S/N=2/4/4
SESSION_PROVENANCE=续接会话（非 fresh v2s-rooted）；本会话此前在做打印域行业调研，非独立盲审子 agent
VERIFICATION_MODE=静态只读（grep/find/sed/python 解析）；未执行任何构建、生成、测试、reset、seed、L2
```

评审对象：
- `doc/plans/platform/2026-09-21-v2s-production-tag-catalog-migration-implementation-design-codex.md`（569 行）
- `doc/plans/platform/2026-09-21-v2s-production-tag-catalog-migration-implementation-plan-codex.md`（254 行）

---

## 0 · 方案合理性判断（先于闭环核验）

**问题对不对：对。** 我独立核到 owner 与事实住址确实错位：`ProductionTagOwnerApi` 的 catalog 侧消费者有 5 个主类（`CatalogCopyService`、`CatalogInventoryCoordinator`、`CatalogItemService`、`CatalogOwnerService`、`CatalogWorkbenchReadService`），商品关系存在 `catalog.catalog_item_reference`，前端 owner 字符串硬编码在 catalog feature 内，而 `modules/fulfillment-production/src` 下只有 5 个 main 类 + 4 个 test 类、且全部围绕生产标签一个实体。迁 owner 是真问题，不是为迁而迁。

**方案优不优：C 方案的形态正确。** A（只改元数据）、B（并入 `dictionary_entry`）、D（只改 seed）三个拒绝理由都成立；B 的拒绝理由与 Dexter 裁决 5 一致，且与生产标签自有 scope/编码释放/brand copy 的事实相符。详设没有构造的替代项里，我认为只有一个值得补记：**「迁入 catalog 但保留独立子模块」** 与 **「扁平并入 catalog 模块」** 的取舍，详设在 CP-03「禁止误做」里直接选了后者且给了理由（catalog 已拥有引用事实），这个取舍我认同，但它是以禁令形式出现而不是以比较形式出现。属 N 级观察，不单列 finding。

**代价配不配：配。** reset-first 把本批从「数据保全迁移」降级为「owner 搬家」，与当前阶段匹配；详设把「保留业务语义」与「丢弃当前数据」显式分开写，是本文档最好的一处。

**UI/交互自问：** 已核 `N/A_WITH_REASON` 成立——四个 operationId、path、wire、face 不变，前端只有 owner 字符串变化，无新增控件/IA。详设 §3a 没有用「没有新 testId」豁免既有控件回归，这一点写对了。

---

## 1 · Findings

### M-01 · `transitionOperationsProductionTagStatus` 迁移后成为「catalog 协调 catalog」，详设未裁决且机器门恒绿

- **等级**：Major
- **类型**：仓内事实 + 需产品/架构裁决
- **详设位置**：§5.1 第 202 行、§9a assertion matrix 行（第 297 行）；两处均只写「改为 catalog 语义」
- **当前字节证据**：
  - `contracts/policy/catalog-inventory-assertion-matrix.json`：`transitionOperationsProductionTagStatus` 当前 `initiatingOwner="fulfillment-production"`、`coordinatedOwners=["catalog"]`
  - `apps/backend/catering-business-server/src/main/java/com/catering/v2s/fulfillment/production/application/operations/TransitionOperationsProductionTagStatusOperation.java:6,23,26,44` —— 该 adapter 同时注入 `ProductionTagOwnerApi` 与 `CatalogOwnerApi`，并在 VOIDED 分支调用 `catalog.productionTagReferenced(...)`。这正是 `coordinatedOwners=["catalog"]` 的来源。
  - `scripts/generate/catalog-inventory-p1.mjs:1780-1786` —— 每个 coordinatedOwner 生成一条 `{kind:'COORDINATED_OWNER', target: owner + '.api'}` callChain 条目
  - `tools/catalog-inventory-p1/cli.mjs:841-843` —— `expect(exact(actualOwners, expectedOwners), "P1_OWNER_CHAIN_EXACT_SET:"...)`，比较的是 **source 与 generated**，两边同源，因此无论填 `["catalog"]` 还是 `[]` 都恒绿
- **影响**：迁移后 `initiatingOwner=catalog` 与 `coordinatedOwners=["catalog"]` 并存，生成的 callChain 会同时出现 `INITIATING_OWNER → catalog.api` 与 `COORDINATED_OWNER → catalog.api`，即声明一次「对自己的跨 owner 协调」。这同时影响：契约生成物语义、`normalPathDbOperations.breakdown` 的归属、以及详设自己冻结的「DB budget 不得因搬 owner 自动放宽」判据。
- **文档内部矛盾**：详设 §6 跨 owner 写矩阵已经认定商品保存绑定生产标签是「**同一 module API，不是跨 owner 写**」，但 §9a 对同一语义变化只给了「改为 catalog 语义」，未把这条判断落到 `coordinatedOwners` 的目标值上。
- **最小修复**：在 §9a assertion-matrix 行（或 §5.1）逐 operation 写出 `coordinatedOwners` 的目标值，至少覆盖：`transition` 是保留 `["catalog"]`（即承认迁移后仍以公开 API 自读）还是清空为 `[]`（即引用检查内化为 owner 内部调用）；并写明该取值对 callChain 与 DB breakdown 的连带结果。`create` 的 `["organization"]` 保持不变需一并写明。
- **为什么不能更小**：两种取值都能通过 `P1_OWNER_CHAIN_EXACT_SET`，机器门无法替人做这个判断；不写就等于把架构语义交给实施时随手定。另外它与 CP-03「禁止误做」的现有禁令有边界关系——现禁令只禁「通过自己的另一个 public module API **写**自己」，本条是**读**，不在禁令覆盖内。
- **需 Dexter 裁决**：**是**。这是 owner 边界语义，不是笔误。

### M-02 · seed 正本地址写错：r5 fixture 正本里没有任何生产标签事实

- **等级**：Major
- **类型**：仓内事实（详设断言与当前字节不符）
- **详设位置**：§10b.1 第 1 行、§10b.2b 第 1 行；实施计划 §7「数据库/reset/seed 测试」
- **当前字节证据**：
  - `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json` —— 全文 `productionTag` / `production_tag` / `生产标签` / `fulfillment` **四个词均为 0 次命中**；顶层键为 `kind,status,programId,…,stableFixtures,expectedCounts,seedStages,…`，不含生产标签对象
  - 真实住址是 `contracts/policy/catalog-inventory-fixture-catalog.json`：`productionTagDefinitions` 1 处、`productionTagCode` 40 处、`productionTagRef` 23 处、`productionTagSelection` 8 处、`productionTags` 1 处
- **详设原话与事实的冲突**：§10b.1 称 r5 正本是「稳定 fixture 正本；**catalog/organization 阶段的生产标签引用和三态数据从这里派生**」，§10b.2b 称要改「**fixture 正本中的 `productionTagDefinitions`**」。二者在当前字节都不成立。
- **影响**：seed 分母失真；「先改正本再改 executor」的顺序不可执行；更实际的风险是诱导实施者在 r5 正本**新增**一份 `productionTagDefinitions`，从而为同一事实建立第二个住址——这恰好违反详设 §3 自己列的横切机制「同一事实只有一个住址」。
- **最小修复**：把 §10b.1 / §10b.2b 中生产标签 fixture 的正本改为 `contracts/policy/catalog-inventory-fixture-catalog.json`；r5 正本改判 `N/A_WITH_REASON`，或写明它只承载阶段与数量而不承载生产标签对象。
- **为什么不能更小**：这不是措辞问题，是「哪份文件是改动源」的事实错误；不改则 CP-05 的 seed 分母从第一行起就是错的。
- **需 Dexter 裁决**：否。

### S-01 · §10b.1 的 seed 分母中 5/8 行无据，且「不得再有 fulfillment stage」描述了不存在的现状

- **等级**：Significant
- **类型**：仓内事实
- **详设位置**：§10b.1 后五行；实施计划 §7
- **当前字节证据**（`grep -ic 'production.?tag|fulfillment.?production'`）：
  - `scripts/dev/catalog-inventory-seed-executor.mjs` = **48** 处（唯一真实受影响者）
  - `scripts/dev/catalog-inventory-seed-plan.mjs` = 0
  - `scripts/dev/r5-seed-plan.mjs` = 0
  - `scripts/dev/r5-fixture-contract.mjs` = 0
  - `scripts/dev/r5-complete-seed-executor.mjs` = 0
  - `scripts/dev/owner-command-seed-executor.mjs` = 0
  - `scripts/dev/r5-complete-seed-executor.mjs:20`：`COMPLETE_SEED_STAGE_IDS = Object.freeze(["owner-command","external-collaboration-business-channel","catalog-inventory","sales-menu"])` —— **当前不存在 fulfillment stage**
- **影响**：详设对这 5 个文件给了具体 处置（「只有 catalog stage 消费生产标签；不得再有 fulfillment stage」「闭集与数量断言同步」），但它们当前与生产标签无字符串关联，且四阶段列表本就无 fulfillment。这会让 CP-05 的「逐文件必须有处置」变成对空气的处置，稀释分母纪律。
- **最小修复**：这 5 行逐行改为 `N/A_WITH_REASON`（写明零命中与四阶段现状），或给出与字符串无关的真实改动理由（例如 `expectedCounts` 是否含生产标签数量——需先核）；删除「不得再有 fulfillment stage」这句对现状的错误断言。
- **需 Dexter 裁决**：否。

### S-02 · advisory lock 是三处而非一处，其中两处是拼接字面量

- **等级**：Significant
- **类型**：仓内事实
- **详设位置**：CP-03 第 174 行「`ProductionTagOwnerPersistence` 当前 `"production-receipt"` advisory-lock namespace 迁为 `"catalog-production-receipt"`」（单数）；实施计划 §5 表末行同样单数
- **当前字节证据**（`apps/backend/catering-business-server/modules/fulfillment-production/src/main/java/com/catering/v2s/fulfillment/production/application/persistence/ProductionTagOwnerPersistence.java`）：
  - `:122` `"production-receipt:" + scope`
  - `:205` `"production-receipt:" + scope`
  - `:364` `AdvisoryLock.acquire(jdbc, "production-receipt", scope, key)`
  - `modules/foundation/src/main/java/com/catering/v2s/platform/foundation/persistence/AdvisoryLock.java:20-22`：`acquire(jdbc, namespace, scopeKey, idempotencyKey)` → `acquireHashTextPair(jdbc, namespace + ":" + scopeKey, idempotencyKey)` → `pg_advisory_xact_lock(hashtext(?), hashtext(?))`
  - 因此三处计算的是**同一把锁** `hashtext("production-receipt:" + scope)`
- **影响**：若实施者按单数表述只改 `:364`，则 claim 路径（`createTypedTag`/更新路径内联锁）与 replay 路径（`findReceiptReplay`）会落在**两把不同的锁**上，命令幂等重放失去互斥。这是 command 路径的正确性缺陷，不是命名问题。
- **缓解与残余**：若静态门按字面量 `production-receipt` 扫活动源码，`"production-receipt:"` 也会命中，可拦住部分迁移；但详设只说「static/behavior test 拒绝 active code 使用旧 namespace」，未冻结该门的匹配形态。
- **最小修复**：CP-03 与实施计划对应行补一句：该锁标识在 `ProductionTagOwnerPersistence` 有三处（:122、:205 为 `"production-receipt:" + scope` 拼接形态，:364 经 `AdvisoryLock.acquire` 传入），必须同批改且改后仍须是同一把锁。
- **需 Dexter 裁决**：否。

### S-03 · Workbench 第三条路径不走 owner API，详设「三条都改为 catalog owner API」会诱导错误改动

- **等级**：Significant
- **类型**：仓内事实 + 推论
- **详设位置**：CP-03 第 165-166 行、§9.1 `CatalogWorkbenchReadService` 行、§9.2、§9a「backend application」行
- **当前字节证据**（`apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogWorkbenchReadService.java`）：
  - 路径 1 navigation `:680-682`：`productionTags == null ? List.of() : productionTags.readNavigationTags(...)` —— **确有 `null → []` 静默兜底**，详设指认正确
  - 路径 1 输出 `:698`：`.put("owner", "fulfillment-production")` —— 硬编码 owner，详设指认正确
  - 路径 2 `productionTagFactsForItems` `:1136-1138`：`if (productionTags == null) throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "生产标签摘要读取失败")` —— **已经是 typed 失败，不是空列表**
  - 路径 3 `productionTagReferenceCounts` `:733-740`：走 `persistence.readProductionTagReferenceCounts(...)`，落点是 `CatalogWorkbenchReadPersistence:394`，读的是 catalog 自有 `catalog_item_reference`，**完全不经过 `ProductionTagOwnerApi`**
- **影响**：详设与实施计划都写「navigation tag、item preparation tag reference、reference-count/read-model **三条输出路径都必须改为 catalog owner API**」。按字面执行，路径 3 会被改成经 tag owner API 取计数，从而改变 read breakdown 与该 operation 的 DB 操作数——而详设自己冻结了「不因迁 owner 自动放宽 DB budget」。
- **最小修复**：把三条路径分别写清处置：路径 1 删除 `null → []` 并改 owner 输出为 catalog；路径 2 仅换类型/包名，失败语义已合规；路径 3 保持 catalog 本地 persistence 读取不变，只确认它不因迁移改变 SQL 与计数。
- **为什么不能更小**：现表述把三条不同形态的路径压成一句同构指令，是 S-03 的根因；只改 owner 字符串不足以消除这条歧义。
- **需 Dexter 裁决**：否。

### S-04 · L2 oracle `:1956` 的语义在迁移后变假，不是换 owner 字符串能修

- **等级**：Significant
- **类型**：仓内事实 + 推论
- **详设位置**：§9a「active L2 policy/oracle」行（引用 `catalog-inventory-l2-scenarios.json:1904,1939,1956`），处置写的是「ownerGraph、network/oracle 与 readback expectation 改 catalog」
- **当前字节证据**：
  - `contracts/policy/catalog-inventory-l2-scenarios.json:1904` 与 `:1939` = `"生产标签归 fulfillment-production owner"` —— 换 owner 值即可
  - `contracts/policy/catalog-inventory-l2-scenarios.json:1956` = `"expectedBusinessResult": "商品字典与生产处理标签是**不同 owner surface**，入口和回填不混用。…"`
  - `contracts/policy/catalog-inventory-l2-case-blueprint.json:328` = `"businessOracle": ["生产标签归 fulfillment-production owner", "不把生产标签当作商品标签字典"]`
- **影响**：迁移后商品字典与生产标签**同属 catalog owner**，`:1956` 断言的「不同 owner surface」不再成立。按详设的「oracle 改 catalog」机械执行，要么保留一句已为假的断言，要么把它改成同义反复。业务意图（两个入口不混用）仍然成立且必须保留——详设 §1.2 拒绝方案 B 的理由正是这个——但承载它的措辞必须从 owner 维度换成 surface/operation 维度。
- **最小修复**：在 §9a L2 行把三个锚点分类：`1904/1939` 与 blueprint `:328` 第一句换 owner 值；`:1956` 单列，要求改写为「不同 surface / 不同 operation / 不同编码空间」而非「不同 owner」。
- **需 Dexter 裁决**：否（业务意图未变，只是表述载体）。

### N-01 · §9a.1 冻结的扫描命令在已构建工作树上会产生 4 个未分类命中

- **等级**：Note
- **类型**：仓内事实
- **证据**：按 §9a.1 冻结的范围与命令扫描 `apps/backend/catering-business-server/modules` 得 34 个文件，其中 4 个是 `modules/fulfillment-production/build/` 下的 Gradle 测试报告与 XML（`git ls-files` 确认**未入库**）。详设列出的分桶不含它们，也未声明排除 `build/`。
- **影响**：详设自订「任何未分类文件都使 CP-00/CP-05 为 OPEN」，在已构建的工作树上该门会因构建产物自伤。干净克隆上不会。
- **最小修复**：§9a.1 的扫描命令补 `--glob '!**/build/**'`，或在分桶说明里显式排除构建产物。

### N-02 · 校准报告含 GET 的记录值，§9a 只点名 create/update/transition

- **等级**：Note
- **类型**：仓内事实
- **证据**：`contracts/policy/backend-performance-cp05-calibration-report.json` 的 `/source/runs[0]/operationSet/counts` 与 `/measurement/exactSet[0]/counts` 两处均含 `createOperationsProductionTag=31`、`updateOperationsProductionTag=2`、`transitionOperationsProductionTagStatus=5`（与详设一致 ✓），**另含 `getOperationsProductionTags=9`**，详设未提。该报告另有 `/operations[102].owner="fulfillment-production"`，所以「必须同步改 owner」这句本身成立。
- **最小修复**：§9a 与实施计划 §7 的校准值枚举补上 GET=9，避免 GET 的重新测量被漏出分母。

### N-03 · `MasterDataLifecycleMigrationIntegrationTest.java:553` 的旧 schema DROP 在分桶内但无处置

- **等级**：Note
- **类型**：仓内事实
- **证据**：该文件 `production.?tag` 命中为 0，进入 §9a.1「acceptance/edge/database tests」分桶的原因是 `:553` 的 `statement.execute("DROP SCHEMA IF EXISTS fulfillment_production CASCADE")`。
- **影响**：它是一条不带断言、幂等的防御性语句，但也是活动测试源码中对旧 schema 的直接引用，与停机条件 4 的零命中口径相关。
- **最小修复**：在 §9a.1 或 CP-05 为该行写明处置（删除或保留为 no-op 并列入排除表）。

### N-04 · 现有 acceptance helper 结构上无法承载 §11 要求的 duplicate / replay 子场景

- **等级**：Note
- **类型**：仓内事实 + 推论
- **证据**：`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CatalogAcceptanceScenarios.java:7295-7312` 的 `createProductionTag(...)` 硬编码 `Set.of(200)` 期望状态，且每次生成新 `Idempotency-Key`（`"acceptance-production-tag-" + UUID.randomUUID()`）。
- **与停机条件 7 的关系**：详设停机条件 7 与 §10b.2b 关注的是「builder 强制传入本应测试缺省的参数」。就该点而言**当前无违反**——该 helper 只传 `dataNodeRef/code/name`，**不传 `brandRef`**，所以 brand 缺省路径仍被覆盖。但硬编码 200 与每次新幂等键，是同一类问题的另一面：§11 要求的 `create duplicate`（期望 typed conflict）与 `production-tag-idempotency-and-null-receipt`（同键重放）无法复用该 helper。
- **最小修复**：在 §11.1 或实施计划 §7 注明这两个子场景需独立请求构造，不得复用 `createProductionTag`；或把 helper 的期望状态与幂等键提为参数。

---

## 2 · 核验通过的项（逐条列出，避免与未核验混淆）

| Dexter 指定的核验项 | 结论 | 关键证据 |
| --- | --- | --- |
| GET metadata-only 与三个 command adapter 的负向边界 | **通过** | 仓内**不存在** `GetOperationsProductionTagsOperation.java` 源文件；`contracts/registry/operation-handler-bindings.json` 的 GET 条目 `adapter="com.catering.v2s.fulfillment.production.application.GetOperationsProductionTagsOperation"`（注意命名空间为 `.application.` 而非三个 command 的 `.application.operations.`），确为纯 metadata；三个 command 的 Java 类在 `src/main/java/.../application/operations/` 下真实存在。详设 CP-01/CP-03/§9.2 对此的冻结与负向 red mutation 要求成立 |
| 旧 schema 住址与历史 migration 清单 | **通过** | `V20260806_120000_000__catalog_inventory_backend.sql:5,124,141` 建 schema、`production_tag_definition`、`command_receipt`；全仓提到 `fulfillment_production` 的 migration 恰为详设列出的 6 个（`V20260806/0807/0808/0816/0825/0919`）；当前最新版本为 `V20260919_000000_000`，详设要求「实施前重读目录确认版本号」恰当 |
| lifecycle-vocabulary / reference-path-matrix 行号 | **通过** | `contracts/policy/lifecycle-vocabulary.json:17` 为 `fulfillment_production.production_tag_definition`（在详设所称 14-18 区间内）；`catalog-inventory-reference-path-matrix.json:14`=R07、`:18`=R11，两者 `sourceLookup` 均为 `fulfillment_production.production_tag_definition.tag_ref`，与详设点名完全一致 |
| M1 performance generator 锚点 | **通过** | `scripts/generate/backend-performance-m1-command-execution-bindings.mjs:9` 为生成物路径常量；`:374-376` 为三个 command 的 type/field 列表；`:444` 的输出模板硬编码 `import com.catering.v2s.fulfillment.production.application.operations.{Create,Transition,Update}OperationsProductionTagOperation`，详设「生成 imports/class namespace 改 catalog」成立 |
| command token 与 gate 派生 | **通过（含一处措辞可收紧）** | `scripts/generate/catalog-inventory-workspace-command-tokens.mjs:46` 的 `storeOperatingRuleGateOwners` 同时含 `catalog` 与 `fulfillment-production`，`:95-97` 据此派生 `catalogManagementEnabled`。因此三个 command token 的 **owner 会变、gate 值不变**；详设写「owner/gate 派生必须随之改为 catalog」略含糊，但不构成缺陷。`CATALOG_WORKSPACE_COMMAND_TOKEN_COUNT=36` 与现状一致 |
| 前端 owner 载体 | **通过** | `CatalogItemProductionEditor.tsx:223,241` 恰为详设所称「两处」裸 owner；`CatalogItemProductionView.tsx:14` 为 `selectedTag.owner \|\| 'fulfillment-production'` fallback；`app/api/generated/catalog-inventory-edge.ts:22-25` 四条为生成物。详设 CP-04 的载体清单准确 |
| §9a.1 的 acceptance/edge/database 分桶 | **通过** | 8 个文件全部存在于 `src/test` 下；命中数 `BackendAcceptanceTest`=7、`BackendPerformanceOperationCoverage`=6、`CatalogAcceptanceScenarios`=98、`P2ReadConnectionScopeScenarios`=19、`SalesMenuAcceptanceScenarios`=1、`CatalogInventoryReadTransactionTopologyTest`=6、`OperationsCatalogInventoryControllerRouteTest`=1、`MasterDataLifecycleMigrationIntegrationTest`=0（原因见 N-03） |
| §9a.1 其余分桶的文件数 | **通过** | `contracts/policy`=12、`scripts/generate`=5、`scripts/test`=17、`src/test`=10、`apps/frontend/.../src/tests`=3，与详设列出的清单数量一致 |
| 旧 module 只有一个业务实体 | **通过** | `modules/fulfillment-production/src` 下只有 `main`（api 1 + application 2 + application/persistence 2 = 5 类）与 `test`（4 类），无 `testFixtures` 源目录；停机条件 1 的前提成立 |
| 文档是否把动态验证写成已完成 | **通过** | 两份文档未出现把未运行动作写成 PASS；§15 如实记录 Round 1 `NO-GO 2/1/0`、Round 2 `NO-GO 5/2/0`，§16 的 `SELF_AUDIT_RESULT=PASS_WITHIN_DOCUMENT_CONSISTENCY_SCOPE` 自带「不表示已获 Claude GO，也不授权实施」的限定 |
| 两轮 DESIGN 对抗 review 上限 | **通过** | Round 1 + Round 2 后由主 agent 一致性自审收口、不启第三轮，符合 `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` 的两轮硬上限与第二轮 SELF_DECIDED |
| 实施计划的对账三件套 | **通过** | 步骤级三维对账（§8.1、计划 §1 末段）、全批三维对账（§8.2）、逐代码与详设对账（§8.3、详设 §13c）三者齐备，且均限定结论只有 `MATCHED`/`OPEN`、`OPEN` 不得交付、不得用额外动态运行掩盖 |
| seed 两类分母是否分别列出 | **形式通过，内容见 M-02/S-01** | §10b.2a 新功能上线分母 = `N/A_WITH_REASON` 且附「不得据此省略既有功能调整分母」的限定；§10b.2b 既有功能调整分母逐行列出。形式正确，但其中 seed 正本地址错误（M-02）、5 行无据（S-01） |
| acceptance fixture builder 强制缺省参数 | **当前无违反** | 见 N-04：`createProductionTag` 不传 `brandRef`，缺省路径仍被覆盖 |

---

## 3 · 动态项目（单列，不计入 finding）

```text
NOT_AUTHORIZED / NOT_RUN（本次评审未执行，也不授权执行）：
  契约生成与生成物 digest 比对
  Gradle 编译与 focused backend 测试
  backend-acceptance（CONTRACT / BUSINESS / DB_OPERATIONS / cleanup）
  Flyway migration 的 Testcontainers 验证、目标 schema 空态与旧 schema drop
  受管 reset / DEV / catalog seed 与 seed readback
  Browser L2 catalog 回归
  M1 performance 重新测量与 DB budget 复核
```

本评审为**静态文档与源码对照**。以上任一项未运行，因此本稿不构成实施通过、不构成任何动态 PASS，也不授权下一步动作。

---

## 4 · 结论

```text
REVIEW_TARGET=DESIGN
VERDICT=NO-GO
M/S/N=2/4/4
```

**授权边界**：本结论仅覆盖上述两份文档在当前字节的设计正确性与分母完整性。它不授权实施、不授权契约生成、不授权任何数据库或 DEV 动作，也不替代实施完成后的 `REVIEW_TARGET=IMPLEMENTATION` 评审。

**NO-GO 的理由集中在两条 Major**：M-01 是一条机器门恒绿、必须由人裁决的 owner 语义空缺，且与详设 §6 自己的判断相矛盾；M-02 是 seed 改动源的事实错误，会从 CP-05 第一行起带偏分母，并有诱导「同一事实两个住址」的具体风险。四条 Significant 都不需要 Dexter 裁决，改文档即可。

**只有 M-01 需要 Dexter 做产品/架构裁决**；其余 8 条由 Codex 在既有批准边界内自主修复。
