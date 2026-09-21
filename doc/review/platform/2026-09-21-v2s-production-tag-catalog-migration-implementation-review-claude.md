# ProductionTagDefinition 迁入 catalog · IMPLEMENTATION review

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取
VERDICT=NO-GO
M/S/N=2/4/4
L1_ENGINEERING=findings（M-01、M-02、S-01、S-03、S-04、N-01、N-02、N-03、N-04）
L2_USER_VISIBLE=findings（S-02 一条；用户可见文案本身无回归，见下）
L3_UNVERIFIED=非空（见 §4）
SAME_ROOT_SCAN=见 §3，全变体全集 9 文件 23 处，逐文件判定
DESIGN_GAPS=见 §5
EVIDENCE_TIER=静态源码/契约对照（本会话亲验）＋ Codex 自报动态结果（未由本会话复跑，不升格）
```

- 仓库根：`/Volumes/idea/catering-v2s`（HEAD `6ac5b511`）。**评审请求给出的 `/Users/dexter/Documents/workspace/idea/catering-v2s` 在本机不存在**，已按实际根执行。
- 会话出处：**续接会话，非 fresh、非独立盲审子 agent**；本会话此前完成同一批次的 DESIGN review，因此对该批已有先验，不构成盲审。
- 本轮只做静态只读核验：未执行构建、契约生成、测试、reset、DEV、seed、L2、UAT、部署，也未执行任何仓库控制动作。

---

## 0 · 先说结论的形状

**迁移主体做得干净。** 五个 owner 类、三个 operation adapter、四个 owner 测试都真实迁入 catalog，命名统一为 `CatalogProductionTag*`，旧模块已从 `settings.gradle.kts` 与磁盘移除，cutover migration 形态正确且无任何数据搬运，DESIGN review 的两条 Major 与四条 Significant **全部被正确修复**（逐条见 §2）。

**NO-GO 卡在实施范围之外的一圈：`scripts/verify` 门链里有两个门在本批之后会直接失败，而本批交付的 evidence 不覆盖门链。** 另有四条语义或分母残留。这些都不动用户行为，但按 `VERIFY_MINUTE_BUDGET` 与 `PRODUCTION_RED_MUTATION_REQUIRED` 都属于必须闭合的项。

---

## 1 · Findings

### M-01 · `scripts/verify` 仍声明指向已删除 Gradle 项目的运行时门

- **级别**：Major ｜ **类型**：仓内事实（`CONFIRMED`）
- **详设位置**：CP-03「移除 `modules/fulfillment-production` 的 `build.gradle.kts`、source/test package、root settings include、app/catalog Gradle dependency」；§9a「repository checks ｜ `tools/verify-gates/{cli,verify}.mjs` ｜ catalog is active owner」
- **实际源码**：
  - `tools/verify-gates/verify.mjs` 第 163–170 行：门 `THCL-JAVA-fulfillment-production`，参数为 `['scripts/test/r5-remote-testcontainers.mjs', ':apps:backend:catering-business-server:modules:fulfillment-production:test']`
  - `settings.gradle.kts` 第 18–35 行：模块清单已无 `fulfillment-production`，该 Gradle 项目不存在
  - 失败语义在 `tools/verify-gates/verify.mjs` 第 231–236 行：`if (result?.error || result?.status !== 0) fail('R5_VERIFY_FIRST_FAILURE:' + label)`
- **影响**：验收/契约/权限/用户行为均不受影响；影响的是**工程闸本身**——`scripts/verify` 会在该门 first-failure 退出。本批 evidence 列的四项（Node 355、catalog module suite、full acceptance、reset/seed）均不包含门链，因此这条缺陷在已有 evidence 下不可见。
- **最小根因修复**：删除 `verify.mjs` 第 163–170 行该门条目。迁入的四个 owner 测试已落在 catalog 模块内，由第 137 行的 `THCL-JAVA-catalog` 门承载，覆盖不丢。
- **为什么不能更小**：不能只改路径字符串——模块整体已删，门没有承载对象；保留任何形式都会让门链恒红。
- **需 Dexter 裁决**：否。

### M-02 · verify 静态链内的 P1 契约门会 ENOENT 崩溃

- **级别**：Major ｜ **类型**：仓内事实（`CONFIRMED`）
- **详设位置**：CP-01「`contracts/openapi/components/fulfillment-production/production-tag.schemas.json`（迁为 `components/catalog/production-tag.schemas.json`）」；§9a「repository checks ｜ `tools/catalog-inventory-p1/cli.mjs`」
- **实际源码**：
  - `tools/catalog-inventory-p1/cli.mjs` 第 753 行 `limitScanRoots` 仍含 `"contracts/openapi/components/fulfillment-production/production-tag.schemas.json"`
  - 该文件已不存在：`contracts/openapi/components/fulfillment-production/` 现为**空目录**，shard 已正确落到 `contracts/openapi/components/catalog/production-tag.schemas.json`
  - 第 754–758 行循环：`const files = fs.existsSync(absolute) && fs.statSync(absolute).isDirectory() ? walk(absolute) : [absolute];` 随后 `fs.readFileSync(file, "utf8")` —— 路径不存在时走 `[absolute]` 分支并**无保护读取**
  - 门链位置：`tools/verify-gates/verify.mjs` 第 31 行 `['catalog-inventory-p1', 'node', ['tools/catalog-inventory-p1/cli.mjs'], ['CATALOG_INVENTORY_P1_CHECK=PASS']]`（`staticCommands` 内）
- **影响**：P1 门以异常退出而非 typed 失败结束，`CATALOG_INVENTORY_P1_CHECK=PASS` 标记不会出现，verify 静态段失败；该门承载的 copy-limit 字面量扫描等断言整类停摆。
- **最小根因修复**：从 `limitScanRoots` 删除该条目（同列表第 753 行已含目录项 `"contracts/openapi/components/catalog"`，`walk()` 会覆盖新 shard），并删除残留空目录 `contracts/openapi/components/fulfillment-production/`。
- **为什么不能更小**：改指新路径也能跑通，但新 shard 已被目录项覆盖，单列会重复扫描；且不删空目录，下次同类扫描仍会把它当有效根。
- **需 Dexter 裁决**：否。

### S-01 · `tools/catalog-inventory-p2/cli.mjs` 整体不可运行

- **级别**：Significant ｜ **类型**：仓内事实（`CONFIRMED`）
- **详设位置**：§9a「repository checks ｜ …`tools/catalog-inventory-p2/cli.mjs`… ｜ catalog is active owner；historical migration strings excluded explicitly」
- **实际源码**（`tools/catalog-inventory-p2/cli.mjs`，`readText` 定义在第 8 行为无保护 `fs.readFileSync`）：
  - 第 207 行读旧 adapter 路径 `.../com/catering/v2s/fulfillment/production/application/operations/TransitionOperationsProductionTagStatusOperation.java`（已迁至 `catalog/application/operations/`）
  - 第 216、227、229、355 行读 `modules/fulfillment-production/...` 下的 owner service / api（模块已删）
  - 第 265、276 行把 `"fulfillment-production"` 映射到已删除的 source root
  - 第 270、281 行断言迁移文本含 `CREATE SCHEMA IF NOT EXISTS fulfillment_production`
- **影响**：该工具**不在** verify 链内（链内只有 p1，见 `verify.mjs` 第 31 行），故不影响当前门链；但它是详设明文点名需更新而未更新的载体，且现已不可运行。
- **最小根因修复**：按 p2 的实际职责把五处读取指向 catalog 路径与目标 schema；若该工具已实质退役，则显式登记退役并从仓内移除，不留半死状态。
- **为什么不能更小**：只改其中几处仍会在第一处不存在的路径抛错；必须整体处置或整体退役。
- **需 Dexter 裁决**：**是（仅范围）**——「修好」还是「登记退役」属范围选择。

### S-02 · L2 业务要求与同场景内的 oracle 自相矛盾

- **级别**：Significant ｜ **类型**：仓内事实（`CONFIRMED`）｜ **归属层**：`L2_USER_VISIBLE`
- **详设位置**：§9a「active L2 policy/oracle ｜ `catalog-inventory-l2-case-blueprint.json:328`、`catalog-inventory-l2-scenarios.json:1904,1939,1956` ｜ ownerGraph、network/oracle 与 readback expectation 改 catalog」
- **实际源码**：
  - **已改对**：`catalog-inventory-l2-case-blueprint.json` 第 328 行、`catalog-inventory-l2-scenarios.json` 第 1904、1939 行 → `"生产标签归 catalog owner"`
  - **未改**：`catalog-inventory-l2-case-blueprint.json` 第 307 行、`catalog-inventory-l2-scenarios.json` 第 1807、1882、1956 行 → `"商品字典与生产处理标签是不同 owner surface，入口和回填不混用。"`
  - 第 1956 行同一条 scenario 内，`expectedBusinessResult` 说「不同 owner surface」，其内嵌 `businessOracle` 说「生产标签归 catalog owner」——**互相矛盾**
- **影响**：迁移后商品字典与生产标签同属 catalog owner，该 requirement 事实上为假。L2 断言的是用户可见行为，一条自相矛盾的业务要求会让后续 L2 判读失去基准。用户实际看到的文案不受影响（见 §2 的 L2 提取结果）。
- **最小根因修复**：把这四处的「不同 owner surface」改为不依赖 owner 的表述（例如「不同入口 / 不同 surface / 不同编码空间」）。业务意图（两个入口不混用）必须保留——详设 §1.2 拒绝方案 B 的理由正是它。
- **为什么不能更小**：只改 oracle 不改 requirement，正是当前这条自相矛盾的成因。
- **需 Dexter 裁决**：否（业务意图未变，只换承载措辞）。

### S-03 · 前端测试 fixture 仍用旧 owner 字面量，且该文件未被本批改动

- **级别**：Significant ｜ **类型**：仓内事实（`CONFIRMED`）
- **详设位置**：CP-04「`catalogTypes.ts`/validation/read-only presenters 的 owner union 与**测试 fixture 改为 catalog**」
- **实际源码**：
  - `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.test.tsx` 第 131、219、702、706 行：`owner: 'FULFILLMENT_PRODUCTION'`
  - `git diff --stat HEAD` 对该文件与 `catalogTypes.ts` 均为空 —— 本批**未触及**
  - 该字面量在非测试的契约/类型源码中**零命中**，即它从来不是合法 owner 取值（契约侧历来是 kebab 形态 `fulfillment-production`）
  - `.../model/catalog/catalogTypes.ts` 第 47、127、221 行：`owner: string` 为宽类型，故编译与测试均不报错
- **影响**：前端测试以一个从未合法、现在双重错误的 owner 值构造夹具。更重要的是**旧 owner red mutation 门若按 kebab 形态扫描会漏掉这个大写下划线形态**——本轮我自己第一遍 kebab 扫描也漏了它，第二遍全变体扫描才命中。
- **最小根因修复**：四处改为 `'catalog'`；并把 `catalogTypes.ts` 的 `owner` 由 `string` 收紧为字面量联合类型，使同类漂移变成编译期错误。
- **为什么不能更小**：只改四处字面量，下一次同类漂移仍然静默通过；收紧类型是让这条 finding 自带反例的唯一方式。
- **需 Dexter 裁决**：否（收紧类型在既有批准边界内）。

### S-04 · cutover migration 缺详设明文要求的迁移内 fail-closed 校验

- **级别**：Significant ｜ **类型**：仓内事实（`CONFIRMED`）
- **详设位置**：CP-02 第 4 条与 §10.2 第 4 条，两处措辞一致：「**在 migration 事务内**校验目标表、索引、约束和旧 schema 不存在；**任何额外对象使 migration fail closed**」
- **实际源码**：`apps/backend/catering-business-server/src/main/resources/db/migration/V20260921_000000_000__catalog_production_tag_owner_cutover.sql` 全文无 `DO $$` / `ASSERT` / 任何校验块；只有三段 DDL 与末行 `DROP SCHEMA IF EXISTS fulfillment_production CASCADE;`
- **补偿控制（已亲验存在且正确）**：`apps/backend/catering-business-server/src/test/java/database/MasterDataLifecycleMigrationIntegrationTest.java` 第 530–538 行以 `to_regclass` 断言两张 catalog 目标表存在、两张旧表为 `null`、`ux_catalog_production_tag_active_code` 存在、`fulfillment_production` 下的 `ux_production_tag_active_code` 不存在
- **影响**：PostgreSQL 的 DDL 事务性使「部分应用」实际不可能，故运行时风险低；但详设明文的门被**降档**到集成测试（不在 reset 执行路径内），且「任何额外对象 fail closed」这一条**在任何地方都未实现**。
- **最小根因修复**：二选一并留痕——在 migration 内补校验块；或在详设记录「该校验改由 migration 集成测试承载」的理由，并补上「无额外对象」断言。
- **为什么不能更小**：当前是「文档说 A、实现做 B、且 B 缺 A 的一个子项」，只补断言不留痕，下轮仍会被当成偏离。
- **需 Dexter 裁决**：否。

### N-01 · `tools/capability-invariants/cli.mjs` 的 owner 授权表仍含已删除 owner

- `tools/capability-invariants/cli.mjs` 第 27 行：`"fulfillment-production": {ownerRecheckId: "OWNER_RECHECK_FULFILLMENT_PRODUCTION", typedProblemMappingId: "PROBLEM_FULFILLMENT_PRODUCTION_TYPED_OWNER_EXCEPTION"}`
- 第 1395–1402 行遍历该表，manifest 缺失时**向 `manifest.ownerRechecks` push 合成条目**——即为一个已不存在的 owner 制造治理记录
- 详设 CP-01 点名 `tools/capability-invariants/cli.mjs` 的 owner registry 需更新；未做
- 修复：删除第 27 行该条目

### N-02 · 「绿得不对」的门：仍断言已删除 schema 的 CREATE 存在

- `tools/verify-gates/cli.mjs` 第 975–984 行在 schema 列表中含 `'fulfillment_production'`，断言全量迁移文本匹配 `CREATE SCHEMA ... fulfillment_production`
- 因历史迁移不可改写，`V20260806_120000_000` 第 5 行的 `CREATE SCHEMA IF NOT EXISTS fulfillment_production;` 仍在文本内，该断言**恒真**
- 即它现在认证的是一个运行时已被 `DROP SCHEMA` 的 owner schema —— 按 `verification-governance.md` 的 `PRODUCTION_RED_MUTATION_REQUIRED`「伪语义门按 finding 处理」记入
- 同形问题在 `tools/catalog-inventory-p2/cli.mjs` 第 270、281 行（已并入 S-01）
- 修复：从该列表移除 `'fulfillment_production'`

### N-03 · 残留空目录 `contracts/openapi/components/fulfillment-production/`

- `ls -la` 确认目录内只有 `.` 与 `..`；git 不跟踪空目录，故不会出现在任何 diff 里
- 它是 M-02 的共因之一；修复见 M-02

### N-04 · 详设 §11 点名的 workbench 失败场景未见落地

- 详设 §11 行 `production-tag-workbench-owner-failure`：「catalog application focused test ｜ required owner API absent/failing; no nullable fallback ｜ missing owner is construction/typed failure, never a successful empty production-tag list」
- 实际：`modules/catalog/src/test/java/com/catering/v2s/catalog/application/` 下 20 个测试文件中无对应项；`CatalogWorkbenchReadService` 第 124 行的 `Objects.requireNonNull(productionTags, "productionTags")` 与 navigation 去兜底后的行为**无测试覆盖**
- 影响：该条负向证明缺失，构造期失败语义无回归保护；实现本身正确（见 §2）
- 修复：补一个 focused test，断言缺 owner 时构造抛出、且 navigation 不返回成功空列表

---

## 2 · 核验通过的项（逐条，含上一轮 findings 的处置）

### 2.1 上一轮 DESIGN review findings 的实施处置

| 上轮编号 | 要求 | 当前字节 | 判定 |
| --- | --- | --- | --- |
| M-01 | 裁决 transition 的 `coordinatedOwners` 目标值 | `catalog-inventory-assertion-matrix.json`：transition 为 `initiatingOwner=catalog, coordinatedOwners=[]`；create 保留 `['organization']`；GET/update 为 `[]` | **已按推荐解法落实** |
| M-02 | 改正 seed fixture 正本地址 | 详设第 307 行改为「`catalog-inventory-fixture-catalog.json` … is the production-tag fact source」，第 413 行把 r5 正本改判 `N/A_WITH_REASON` 并写明「currently has zero production-tag fact hits」「do not create a second fact address」 | **已改正** |
| S-02 | advisory lock 三处同批改 | `CatalogProductionTagOwnerPersistence.java` 第 122、205、364 行**全部**为 `catalog-production-receipt`，两处拼接形态与一处 `AdvisoryLock.acquire` 一致 | **已全改** |
| S-03 | Workbench 三条路径分别处置 | 第 124 行 `Objects.requireNonNull(productionTags)`；第 680–681 行 `null → List.of()` 兜底**已删除**；第 697、1343 行 owner 输出为 `"catalog"`；第 736 行引用计数**仍走 catalog 本地 persistence**（`readProductionTagReferenceCounts`），未被误改走 owner API | **已按建议分别处置** |
| S-04 | L2 oracle 语义改写 | oracle 三处已改；requirement 四处未改 | **部分**，见本轮 S-02 |
| N-04 | duplicate / replay 子场景需独立构造 | `CatalogAcceptanceScenarios.java` 新增 `production-tag-create-duplicate-code`（第 2242 行，断言 `DUPLICATE_CODE` typed 且不产生第二行）与 `production-tag-idempotency-replay-negative`（第 2278 行）、`production-tag-update-version-readback`（第 2327 行） | **已落地** |

### 2.2 本轮十项核验

| 核验项 | 结论 | 关键证据 |
| --- | --- | --- |
| 1 catalog 真正拥有 API/service/persistence/SQL/receipt/adapter/测试 | **通过** | 磁盘存在 `CatalogProductionTagOwnerApi/Service/TaskReadService/OwnerPersistence/OwnerServiceSql` 五类于 `modules/catalog/`；三个 adapter 于 `src/main/java/com/catering/v2s/catalog/application/operations/`；四个 owner 测试迁至 `modules/catalog/src/test/.../application/` |
| 2 旧 owner 从 settings/Gradle/package/契约/生成物/seed/test 移除 | **主体通过，工具链未清** | `settings.gradle.kts` 无该模块、磁盘目录已删、shard 已迁 `components/catalog/`、生成物 `catalog-inventory-edge.ts` 第 22–25 行 owner 全为 `catalog`；残留见 M-01/M-02/S-01/S-03/N-01/N-02/N-03 |
| 3 migration 建表建 receipt 删旧 schema 且无数据搬运 | **通过** | cutover 全文只有三段 DDL + `DROP SCHEMA IF EXISTS fulfillment_production CASCADE`；**无** `INSERT ... SELECT`、无 code/UUID 映射、无双读双写；三态 check、`ux_catalog_production_tag_active_code` partial unique（`WHERE status <> 'VOIDED'`）、`ix_catalog_production_tag_scope_status`、receipt 的 nullable `response_json` 与 `(data_node_ref, idempotency_key)` 唯一键均在 |
| 4 item/copy/workbench/reference readback 走 catalog owner | **通过** | `CatalogWorkbenchReadService` 全文 owner 类型已是 `CatalogProductionTagOwnerApi`；owner 输出 `"catalog"`；引用计数保持 catalog 本地持久化，未改变 read breakdown |
| 5 OpenAPI/registry/bindings/token/性能绑定闭环 | **通过（静态）** | 生成物 edge.ts owner=catalog；断言矩阵四条 owner=catalog；shard 已迁。⚠️ 生成链是否可重跑受 M-02 影响 |
| 6 scope/version/status/idempotency/lock/reference guard/readback 语义保持 | **通过** | 锁三处一致迁移；acceptance 覆盖 duplicate typed + 无第二行、replay negative、update version readback；三态 check 在 migration 内 |
| 7 reset 后 seed 从 catalog owner 重建、无旧 UUID/receipt 连续性假设 | **通过（静态）** | `catalog-inventory-seed-executor.mjs` 第 243、296、799、1400 行按 `productionTagDefinitions` 闭集与业务标签校验；第 328–330 行 ref 由本次 seed 的 `productionTagByCode` 解析，不引用旧 UUID；r5 正本仍零生产标签命中，与详设第 413 行的 `N/A_WITH_REASON` 一致 |
| 8 测试 fixture 覆盖可选参数/duplicate/version/idempotency/migration shape/reference readback | **通过，一项缺口** | 三条新 acceptance 场景 + migration 集成测试第 530–538 行 shape 断言；缺 workbench 失败场景（N-04） |
| 9 死代码/旧构造器/生成残留/详设点名未实现 | **findings** | 见 S-01、N-01、N-02、N-03、N-04 |
| 10 不把静态或旧 evidence 扩大为 L2/UAT PASS | **本稿遵守** | 见 §4 与文首 `EVIDENCE_TIER` |

### 2.3 动作 1-A：用户可见事实提取结果

扫描 `apps/frontend/operations-admin/src/features/catalog-management/ui/**` 含 `production` 的 19 个文件：

- 用户可见业务词为**「生产标签」**（`CatalogItemReadOnlyPresenters.tsx` 可见标签集合内），与 `confirmed-business-language-corpus.md#CIPG-01` 一致，**技术 owner 未泄漏到任何用户可见串**。
- `CatalogItemProductionEditor.tsx` 可见标签、中文串、校验提示与迁移前一致；owner 字面量已为 `catalog`（第 223、241 行）。
- `CatalogItemProductionView.tsx` 第 14 行 fallback 为 `selectedTag.owner || 'catalog'`。
- 未发现新增控件、新增前端自造枚举文案或新增 IA。
- 唯一 L2 层 finding 是 S-02（policy 内的业务要求措辞），不是渲染文案。

---

## 3 · 同族全集扫描（动作 3）

扫描式：`fulfillment[-_]?production | FULFILLMENT_PRODUCTION | fulfillmentProduction | FulfillmentProduction`，范围 `apps contracts scripts tools settings.gradle.kts`，排除 `build/`、`node_modules`、六个历史 migration。**全集 9 文件 23 处，逐文件判定如下，无遗漏项**：

| 文件 | 处数 | 判定 |
| --- | --- | --- |
| `tools/catalog-inventory-p2/cli.mjs` | 8 | **OPEN** — S-01 |
| `apps/frontend/.../CatalogItemDrawer.test.tsx` | 4 | **OPEN** — S-03 |
| `apps/backend/.../database/MasterDataLifecycleMigrationIntegrationTest.java` | 4 | **合规** — 第 535、536、538 行是「旧 schema 已消失」的负向断言，第 570 行是测试自清理；我最初假设它「断言旧 schema 存在」，开源码后**撤回该假设** |
| `tools/verify-gates/verify.mjs` | 2 | **OPEN** — M-01 |
| `tools/verify-gates/cli.mjs` | 1 | **OPEN** — N-02 |
| `tools/catalog-inventory-p1/cli.mjs` | 1 | **OPEN** — M-02 |
| `tools/capability-invariants/cli.mjs` | 1 | **OPEN** — N-01 |
| `scripts/test/catalog-p3-model-migration.test.mjs` | 1 | **合规** — 断言 cutover 文本含 `DROP SCHEMA ... fulfillment_production CASCADE` |
| `V20260921_000000_000__catalog_production_tag_owner_cutover.sql` | 1 | **合规** — 即本批要求的 DROP |

六个历史 migration（`V20260806/0807/0808/0816/0825/0919`）按详设作为不可改写历史排除，已逐一确认其内容未被改动。

**大小写变体的教训**：第一遍按 kebab `fulfillment-production` 扫描**漏掉了** `CatalogItemDrawer.test.tsx` 的四处 `FULFILLMENT_PRODUCTION`。任何旧 owner 零命中门若只匹配单一形态都会同样漏检——这一点建议写进修复后的静态门。

---

## 4 · 未验证清单（动作 4，`L3_UNVERIFIED` 非空）

| 事实 | 档位 |
| --- | --- |
| 五个 owner 类、三个 adapter、四个测试的**迁移位置与命名** | **静态已证**（本会话亲验磁盘） |
| cutover migration 的 DDL 形态、无数据搬运 | **静态已证**（本会话逐行读全文） |
| 断言矩阵 owner、生成物 owner、锁 namespace、Workbench 三路径 | **静态已证**（本会话亲验） |
| catalog 模块测试、full backend acceptance、reset、seed 的实际结果 | **他报未复跑** — Codex 自报 `r5-tc-1789974770278-57613`、`r5-tc-1789975126141-64610`、`r5-reset-9de2d311…`、`complete-seed-382f75a2…`；本会话未执行也未读取其产物，**不升格为本稿证据** |
| `scripts/verify` 门链能否通过 | **无人验证** — 且本稿 M-01/M-02 判断它**不能**通过；现有 evidence 不覆盖门链 |
| 生产标签配置页、商品编辑生产标签控件的**实际渲染与交互** | **无人验证** — Browser L2 `NOT_AUTHORIZED / NOT_RUN` |
| 迁移后 dirty guard、失败保留草稿、焦点、状态回显是否无漂移 | **无人验证** — 同上 |
| seed 后的 readback 与 fixture 一致性 | **他报未复跑** |

**给产品负责人的话**：后端 owner 迁移在静态层面是干净的，但**没有任何人打开过页面确认生产标签的配置与选择仍然正常**。本批改了前端 owner 元数据与四条 RTK 消费路径，虽不改控件，仍建议在授权后跑一次既有 catalog L2 回归再认为它完成。

---

## 5 · `DESIGN_GAPS`（正本里缺判据的条目）

1. **旧 owner 零命中门未规定匹配形态。** 详设与实施计划多处要求「旧 owner red mutation 必须失败」「active source 旧 owner 出现次数为零」，但未规定该扫描需覆盖 kebab / snake / UPPER_SNAKE / camel / Pascal 哪些形态。本轮 S-03 正是单形态扫描的漏网。建议把「owner 字面量零命中门必须覆盖全部命名形态」写入 `doc/platform/backend-coding-standard.md` 或 `foundation-charter.md` 的门形态一节，**不在本评审内立规**。
2. **「工具链随模块删除同步」无正本。** M-01、M-02、S-01、N-01、N-02 同属一类：删除一个 Gradle 模块时，`tools/verify-gates`、`tools/catalog-inventory-p*`、`tools/capability-invariants` 中对它的引用没有任何规范要求同步。本批详设 §9a 是靠逐文件点名覆盖的，换一批就会再漏。建议在 charter 增加「模块退役的载体清单」条目。

---

## 6 · 结论与授权边界

```text
REVIEW_TARGET=IMPLEMENTATION
VERDICT=NO-GO
M/S/N=2/4/4
```

两条 Major 都不影响用户行为、契约、数据或权限，影响的是**工程闸可用性**：`scripts/verify` 在本批之后会在 `THCL-JAVA-fulfillment-production` 与 `catalog-inventory-p1` 两处失败，而本批提交的四项 evidence 恰好不覆盖门链。四条 Significant 中，S-02 属 L2 语义、S-03 属前端夹具与类型松弛、S-01 与 S-04 属工具与文档留痕。

**十条 finding 中只有 S-01 需要 Dexter 做一次范围选择**（p2 工具是修好还是登记退役）；其余九条均在 Codex 既有批准边界内可自主修复。

**授权边界**：本结论只覆盖当前字节的实施结果静态复核。它不授权实施、不授权任何动态动作、不构成 Browser L2 / UAT / 部署的通过，也不把 Codex 自报的动态结果升格为本稿证据。Browser L2、UAT、生产部署保持 `NOT_AUTHORIZED`。
