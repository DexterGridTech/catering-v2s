SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# 20 倍业务量的健壮底座 · implementation-facing 详设与实施计划

| 字段 | 值 |
|---|---|
| 文档状态 | `DRAFT_AWAITING_INDEPENDENT_DESIGN_REVIEW`；作者高风险对账已完成 |
| 需求正本 | `doc/plans/platform/2026-08-16-v2s-scalable-foundation-requirements-claude.md` |
| 需求 SHA-256 | `f06ccfc4fd827bb7803bd556c723cc7fa104ea09165d9b354c648017655f0ddb` |
| 目标 | 在最多三个批次内降低横切重复、命令扩展斜率和失真门，并关闭已确认的并发、数据隔离与可观测缺陷 |
| REVIEW_CYCLE_ID | `SCALABLE_FOUNDATION_DESIGN_20260817` |
| REVIEW_TARGET | `DESIGN` |
| 当前授权 | 只授权详设、实施计划、静态源码核查与独立设计复核；不授权实施、DEV、reset、seed、HTTP、浏览器 L2、UAT |

## 0. 结论与诚实边界

本方案可以作为三个实施批次的直接输入。三个批次不需要增加第四批；B2 通过三个内部 sub-wave 容纳新增的 P-7，仍以一次实现交付、一次全范围 implementation review 收口，不能把 sub-wave 冒充独立批次或独立 GO。

但需求正本仍有一处目标与范围冲突，不能在实施后被文案掩盖：G1 的第一条达成判据要求“下一个新增 owner 模块内 `INSERT INTO .*command_receipt` 与 `pg_advisory` 命中数为 0”，而 P-1、D-1、D-2 被明确推迟。本轮只把四个现有 owner 的首次并发缺陷统一修正，不会产生能让未来 owner 零 SQL、零 advisory 的共享回执能力。因此：

- 三批次可以关闭 P-7 的可测成本判据，并关闭本方案列出的现存缺陷；
- 三批次不能宣称完整关闭 G1 第一条判据；
- P-1 继续推迟是已裁范围，本详设不暗中实施 P-1；
- 最终验收必须把 G1 第一条标成 `DEFERRED_BY_APPROVED_SCOPE`，或者由 Dexter 另行把 P-1 拉入范围。该项只影响最终目标宣称，不阻断本文三个批次的可执行性。

## 1. 当前源码事实校正

需求方向保留，但实施分母必须以当前树为准。以下是详设的输入校正，不是产品范围变更。

| 编号 | 需求文本口径 | 当前树复算 | 本详设采用 |
|---|---|---|---|
| P-2 | 入口数未定 | 四个 owning source 共 22 个 receipt checkpoint；仅 catalog 批量状态迁移 1 个已在 replay 前锁定 | 22 为完整分母，21 个需要改造 |
| P-7 | 3 新建 / 12 手改 / 约 20 生成 | 按当前 operation-inventory profile：1 个手写新文件、15 个生产/契约手改；计入 acceptance proof 为 19；生成/派生为 23，计 fixture/L2 为 25 | 基线 `N=1/M=15/K=23`；目标 `M=9`；L2 不进入本轮运行证明 |
| P-7 emitter | 31 个 `emit*` | 30 个 emitter 函数；第 31 个唯一标识是布尔量 `emitRequested` | 只参数化已证明同形态的 count/increase/adjust；不按名字批量抽象 |
| D-3 | P3 FK 全是单列 | 存在 `(component_item_ref, product_sku_ref)` 复合 FK，但没有 scope-aware；21 个 owner-local 关系中仅 dictionary parent scope-aware | 按 scope-aware 缺口设计，不沿用“全是单列”措辞 |
| D-5 | 3 条索引 | 四个相互独立的 leading column：store.brand_id、store.tenant_id、store_contract.tenant_id、role_assignment.role_id | 新增 4 条索引；一条 B-tree 不能同时覆盖 store 的两个独立首列 |
| E-1 React key | 坏正则 | 当前 `static-boundary.test.mjs` 已含闭合 `}` | 先做红变异；已能抓住则记 `CURRENT_TREE_ALREADY_SATISFIED`，禁止无意义重写 |
| S-1 capability | 3 个 `EDIT_*` 未生成 | 当前 `WorkspaceAuthorizationCatalog` 已含 3 个 `EDIT_*` 常量；检测正则仍只覆盖 `BC-*` | 保留生成物，扩展生成/门的闭集判据与 red mutation，不重复生成常量 |

## 2. 设计不变量

### 2.1 业务与事务不变量

1. 幂等命令必须在第一次业务写之前取得该 `(owner scope, idempotency key)` 的唯一执行权。
2. 同 key、同 canonical request 的并发调用只执行一次业务写，后到者返回第一次 readback。
3. 同 key、不同 canonical request 必须返回既有类型化 mismatch，不得静默重放或执行第二次。
4. 锁、replay、业务写、audit、readback 与 receipt 必须留在 owner 原有 `REQUIRED` 事务内；catalog 批量状态迁移既有的 item-level `REQUIRES_NEW` 只属于该业务，不得复制给其他入口。
5. 锁后 replay 的 freshness 语义不得被一刀切改写：C4 保留既有“lock → replay”；普通写保留 owner current-state recheck 后 replay；copy 在锁后重新计算/复核 fingerprint，再按既有 `replayCopyIfCurrent` 判定。不能让锁前快照成为写入依据，也不能让同 key replay 因错误重排而改变业务语义。
6. catalog、inventory、fulfillment-production 的 receipt identity 保持 `(data_node_ref, idempotency_key)`；本轮不统一 12 张 receipt 表的 scope-key 形态。
7. `data_node_ref + brand_ref` 是 catalog owner scope，不新增冗余 workspace 列，不建立跨 owner FK。

### 2.2 来源与生成不变量

1. OpenAPI/契约 JSON 是 wire 与 operation declaration 的真相；Markdown 详设不得成为生成输入。
2. 生成器只能派生重复机械形状，不得把 owner 规则、授权、事务、CAS 或 UI Journey 隐藏进配置 DSL。
3. 生成物必须标明 generated/do-not-edit；手写 owner API、owner service、controller 和 UI 仍是明确审阅点。
4. 固定数量不是结构不变量。保留精确集合相等、唯一性、分类完备和编译器穷尽性，删除只限制“当前有多少个”的比较。

### 2.3 门与证明不变量

每道新增或重写的门必须登记：

- 一句机械可判定的不变量；
- 一个真实 red mutation，且 mutation 改的是 production/contract 输入；
- 一个明确不该被抓的 negative control；
- owning test 与 `scripts/verify` 接线；
- 它不能证明的边界。

源码存在性断言只有在与其他证明共同钉死语义时才可保留。“有某字符串”本身不是行为证明。

### 2.4 现阶段迁移不变量

当前无业务数据且每次 reset + seed，因此直接修改 owning migration，不做 backfill、dual read、兼容列、兼容 view 或回滚桥。实施后的全量 migration replay 与 seed 是动态验收，必须在另行授权后通过受管入口执行；没有该证据时只能报静态/模块结果。

## 3. 前置一：P-2 完整逐入口分母

### 3.1 分母与现状

| ID | owning source / 入口 | 当前首用语义 | 目标动作 |
|---|---|---|---|
| C1 | `CatalogOwnerService.executeWrite`，category/dictionary/general item write 共用路径 | replay 先于唯一锁，save 使用 `ON CONFLICT DO NOTHING` | canonical request 完成后、任何 owner recheck/业务写前调用 owner-local `lockCommandReceipt` |
| C2 | `createCatalogItem` | typed replay 无首用锁 | 同 C1，锁后重做 typed owner recheck，再 replay |
| C3 | `transitionCatalogItemStatus` | typed replay 无首用锁 | 同 C2 |
| C4 | `transitionCatalogItemStatuses` / `executeBatchStatusWithReceipt` | 已调用 `lockBatchStatusReceipt` 后 replay | 保留为合规正例；不改变 item-level `REQUIRES_NEW` 部分成功语义 |
| C5 | `preflightTemporaryCatalogItemPromotion` | typed replay 无首用锁 | receipt 锁后重新生成/校验 preflight 输入，再 replay |
| C6 | `executeTemporaryCatalogItemPromotion` | typed replay 无首用锁 | receipt 锁后复核 digest/current state，再 replay |
| C7 | brand catalog copy execute path | replay 与 fingerprint 判定发生在唯一执行权之前 | 先 receipt 锁，再重算 plan/fingerprint，再 replay/execute |
| C8 | local catalog copy execute path | 同 C7 | 同 C7 |
| I1 | `InventoryOwnerService.writeCore` | replay 无首用锁，裸 receipt insert | receipt 锁后 replay，再执行 supplier |
| I2 | `countTarget` / typed inventory change | typed replay 无首用锁 | receipt 锁后 `recheckTypedTargetBeforeReceipt`，再 replay |
| I3 | `increaseTarget` | 同 I2 | 同 I2 |
| I4 | `adjustTarget` | 同 I2 | 同 I2 |
| I5 | `updateTargetConfiguration` | 同 I2 | 同 I2 |
| I6 | `copyCore` | replay/fingerprint 在唯一执行权之前 | receipt 锁后重做 preflight/fingerprint，再 replay |
| I7 | `ensureCatalogItemSaveTarget` | receipt checkpoint 无首用锁 | receipt 锁后 recheck，再 replay/write |
| I8 | `saveCatalogItemProductBom` | receipt checkpoint 无首用锁 | receipt 锁后 recheck，再 replay/write |
| P1 | `ProductionTagOwnerService.writeCore` | replay 无首用锁，裸 receipt insert | receipt 锁后 replay，再执行 mutation |
| P2 | `createTag` | typed replay 无首用锁 | receipt 锁后 create recheck，再 replay |
| P3 | `updateTag` | typed replay 无首用锁 | receipt 锁后 version/current-state recheck，再 replay |
| P4 | `transitionTagStatus` | typed replay 无首用锁 | 同 P3 |
| P5 | `copyCore` / brand copy execute | replay/fingerprint 在唯一执行权之前 | receipt 锁后重做 plan/fingerprint，再 replay |
| E1 | `ExtensionCommandReceiptService.execute` | insert-as-claim 捕获 `DuplicateKeyException` 后在同一已 abort 的 PostgreSQL 事务查询 | 改为 advisory lock → SELECT/replay → 不存在时 INSERT IN_PROGRESS → business → UPDATE SUCCEEDED；删除 duplicate catch 续查 |

分母结论：`catalog 8 + inventory 8 + fulfillment-production 5 + extension 1 = 22`。C4 已合规，因此实施修改分子是 21；验收仍必须遍历 22，避免“改过的通过、漏掉的未计”。Inventory 现有三处 advisory lock 是 PRODUCT_SKU/CATALOG_ITEM/SKU_ATTRIBUTE_VALUE 生命周期锁，不是 receipt 锁，必须保留且不得计作 P-2 合规入口。

### 3.2 最小实现形状

catalog、inventory、fulfillment-production 各自在 owning service 内新增一个私有方法：

```text
lockCommandReceipt(scopeKey, idempotencyKey)
  -> SELECT pg_advisory_xact_lock(hashtext(scopeKey), hashtext(idempotencyKey))
```

本批不建立跨 owner receipt helper，不改模块依赖。现有 C4 的锁函数可收口到 catalog 的新私有方法。Catalog 的所有入口覆盖后删除 `saveReceipt` 的 `ON CONFLICT DO NOTHING`；此时冲突应由事务级锁消除，继续保留会把未来漏锁静默化。Extension 删除 `DuplicateKeyException` catch/import，不用 SAVEPOINT 补丁，不用 `ON CONFLICT`。

除 C4 与 copy 的保留例外外，普通 owner command 的顺序固定为：

```text
scope/auth/key 基本校验
→ receipt 唯一执行权
→ owner current-state / version / fingerprint recheck
→ replay 与 request mismatch 判定
→ 业务写 / CAS / audit / readback
→ receipt 持久化
```

### 3.3 P-2 证明矩阵

新增或扩展：

- `CatalogReceiptFirstUseConcurrencyIntegrationTest.java`
- `InventoryReceiptFirstUseConcurrencyIntegrationTest.java`
- `ProductionTagReceiptFirstUseConcurrencyIntegrationTest.java`
- `ExtensionDefinitionServiceTest.java`
- 对 `CatalogAcceptanceScenarios.java` 增加一个代表性真实 HTTP 并发幂等场景；它只证明被选 operation，不冒充 22 个入口的完整 HTTP 覆盖。

每个 ID 至少覆盖：两独立事务同 key/同请求、同 key/不同请求、业务失败回滚后无 receipt 残留。Copy 入口额外证明锁后 fingerprint recheck；C4 额外证明部分成功语义未改变。受管 Testcontainers 的 business 与 cleanup 必须分别 PASS；未获动态授权时标 `UNVERIFIED_REQUIRES_EVIDENCE`。

## 4. 前置二：P-7 当前手改分母与目标

### 4.1 当前 15 个生产/契约手改点

| # | 当前手改路径 | 每加标准 inventory target command 时为何要改 | 目标后是否保留手改 |
|---|---|---|---|
| 1 | `doc/review/platform/2026-08-06-v2s-catalog-inventory-backend-operation-design-contract.json` | 新 operation declaration | 是，唯一声明入口 |
| 2 | `doc/plans/platform/2026-08-06-v2s-catalog-inventory-three-stage-implementation-design-codex.md` | P1 generator 正则解析 Markdown | 否；彻底移出 generator/runtime 输入 |
| 3 | `contracts/policy/catalog-inventory-design-byte-coverage.json` | operation 设计覆盖 | 是 |
| 4 | `contracts/registry/iam-org-governance-manifest.json` | capability/face governance | 是 |
| 5 | `contracts/registry/operation-handler-bindings.json` | operation → handler 绑定 | 是 |
| 6 | `scripts/generate/catalog-inventory-p1.mjs` | ordinal 分组与显式 route 逻辑 | 否；改为读取 contract JSON 后不再逐 operation 改脚本 |
| 7 | `scripts/generate/operation-handler-bindings.mjs` | catalog-inventory Java adapter 白名单/计数 | 否；从 route registry + mode 派生，且 B1 后只生成 JSON |
| 8 | `scripts/generate/catalog-inventory-workspace-command-tokens.mjs` | 固定 27 项 | 否；由 operation exact set 派生 |
| 9 | `scripts/generate/backend-performance-m1-command-execution-bindings.mjs` | 每个命令新增 emitter | 否；仅标准 inventory target command 走参数化 emitter |
| 10 | `tools/catalog-inventory-p1/cli.mjs` | 固定 operation/command 分组与计数 | 否；改为 exact set、reachability 与结构不变量 |
| 11 | `modules/inventory/.../InventoryOwnerApi.java` | owner command/readback 类型与公开方法 | 是 |
| 12 | `modules/inventory/.../InventoryOwnerService.java` | 业务、事务、CAS 与 owner readback | 是 |
| 13 | `app/.../OperationsCatalogInventoryController.java` | HTTP adapter | 是 |
| 14 | `features/inventory-management/ui/InventoryActionModal.tsx` | 命令交互 | 是 |
| 15 | `features/inventory-management/ui/InventoryDetailDrawer.tsx` | 详情/结果呈现 | 是 |

计入完整 proof 时还会触及 4 个文件：

- `InventoryTargetReferenceConsistencyOperationTest.java`
- `InventoryTypedMutationCasIntegrationTest.java`
- `contracts/policy/catalog-inventory-l2-case-blueprint.json`
- `apps/frontend/operations-admin/src/tests/l2/catalog-inventory.spec.ts`

前两者属于本轮可执行证明；后两者可静态同步，但浏览器 L2 实跑明确暂缓，不进入本轮 PASS。

### 4.2 目标 9 个手改点

标准 inventory target command 完成 P-7 后，手改集合精确为：operation contract JSON、design-byte coverage、IAM governance、handler binding、owner API、owner service、controller、action modal、detail drawer，共 9 个。生成器/validator/tooling 的一次性改造不再按 operation 改动；Markdown 设计不再是输入。

这 9 个不是为了凑数保留：前四个分别表达 wire、设计、权限与 handler ownership；后五个分别表达 owner API、业务事务、edge adapter 与两处用户行为。继续压缩会把业务判断藏进 DSL，违反本项目 owner 与 Journey 边界。

### 4.3 P-7 契约与生成设计

1. 在 operation contract JSON 的每个 operation 行补齐 `method`、`path`、`requestComponent`、`responseComponent`、`scenarioIds`。字段只描述 wire/证明归属，不承载事务或 UI 流程。
2. `catalog-inventory-p1.mjs` 删除 Markdown `readFileSync`、`parseOperationRows`、ordinal partition 与 `routeByOrdinal`；从 contract JSON 读取，按 owner + path family 派生 shard。`tools/catalog-inventory-p1/cli.mjs` 同时删除 `IA_PATH`/Markdown exact-set 读取和固定 89 判据：把 operation 的 `iaIds` 纳入同一 contract JSON 或 design-byte coverage JSON，再由 JSON 闭集验证。否则 Markdown 仍是决定验证成败的隐性真相。
3. `operation-handler-bindings.mjs` 从 route registry + binding mode 派生 catalog-inventory adapter metadata，删除 per-operation Java whitelist 和冻结数量；B1 已删除无消费者 Java 产物后只保留真实 JSON 消费链。
4. workspace command token generator 从 exact command set 派生，不检查固定 27。
5. backend-performance generator 引入“标准 inventory target command”参数化 emitter，生成 import/field/constructor/method glue。Multipart、copy、preflight 与非标准 response 继续专用实现。
6. P1 checker 改为 declaration exact set、生成 reachability、唯一 method+path、consumer completeness 和 JSON 中 `iaIds` 闭集；删除固定 43、固定 4 command、Markdown IA 读取与固定 89 判据。

同形态边界只确认 `count/increase/adjust`。`update configuration` response 不同，未证明同形，不纳入参数化；不能按目录一刀切。

### 4.4 P-7 可证伪验收

- 红变异：只在临时 contract fixture 增加一个 count-like 标准 operation，生成链必须产出所有 derived Java/TS/registry 变化，且 generator/tool source 无需新增 operation 分支。
- 红变异：缺 request/response component、重复 method+path、binding exact set 缺项分别失败。
- 红变异：标准 command 已声明但 emitter 不可达时失败。
- 负控制：只改 Markdown 不改变任何生成输出。
- 负控制：新增 GET 不生成 command token/emitter。
- 负控制：multipart/copy 保留专用路径不会被标准 emitter 接管。
- 负控制：IAM-only declaration 不生成 route。
- 成本判据：同一临时 operation mutation 的 production/contract 手改目标集合精确等于上述 9 个，不能通过新增一份 per-operation 配置把第 10 个手改藏起来。

## 5. B1 · 修缺陷、删死物、接线

B1 共 10 个对账项：P-2、P-8、D-6、X、S-2、E-1、E-2、E-3、E-5、O-5。

### B1-01 P-2：四 owner 首用幂等并发

按 §3 一次覆盖 22 个 checkpoint。修改前逐 ID 重开 owning source；focused proof 后按同一 22 行回读。禁止只按 `replay(` 搜索结果判完成，还要验证 copy fingerprint 与 typed recheck 的相对顺序。

### B1-02 D-6：只删除 legacy audit 语句

精确写集：

1. `V20260725_170000_000`：删除 `organization.commercial_group_audit` 的 CREATE 整块及对应 ENABLE/FORCE RLS、policy。
2. `V20260726_090000_000`：policy 名单移除该项，计数 4→3；删除 legacy 的 DISABLE/NO FORCE/DROP POLICY 与七个 CREATE TABLE。
3. `V20260727_010000_000`：删除 190–208 的八表空表守卫与 210–217 的八条 DROP TABLE。
4. 保留 V27 的 149–188：这是两个活 audit_event 表之间的校验、INSERT 与 DELETE。

先做静态依赖 test；实施获得动态权限后，用受管 reset/full replay/seed 验证。不得删除三个迁移文件，不得补兼容迁移。

### B1-03 E-2：先建立 218 行 disposition，再删任何证明

新增 `doc/plans/platform/2026-08-17-v2s-frontend-architecture-assertion-disposition-codex.md`，逐断言记录：测试文件、test name、源码 anchor、意图不变量、当前 proxy、`KEEP_EXACT / REWRITE_BEHAVIOR / REWRITE_MECHANICAL / DELETE`、替代 proof、red mutation、negative control。

规则：

- 精确集合/确值/穷尽性可保留；
- 可由 TypeScript、component test、generator exact set 或 API test接管的，先落替代 proof 再删旧断言；
- 纯排版、变量名或 JSX 换行形状删掉；
- 只有浏览器才能证明的交互在 L2 暂缓期间不得伪造单元证明，也不得在没有替代时删掉现有告警；标 `DEFERRED_L2_WITHOUT_PASS_CLAIM`。

### B1-04 X：按隐藏消费者顺序退役

| 项 | 具体动作 | 保留/迁移证明 |
|---|---|---|
| generated operation-handler Java | 同批删除 generator Java output、registry/index Java metadata、validator branch 与 `contracts/registry/generated/operation-handler-bindings/java/**` | JSON binding 的 exact set/consumer test |
| descriptor 9 个无用/坏控件 | 先让 upload 需求明确走既有 asset 机制，再从 descriptor 契约声明源、renderer 与校验器向下删除；保留实际使用控件 | 资产上传现有测试；exact slot-binding 针对真实 slot |
| `assertDescriptorSlotBindingSet` | 无生产调用且比需求更严，删除 | 真实 descriptor render/component test |
| `closedSessionKey` / `handleOpenChange` | 删除 state、副作用与 27 个 caller 的 `diagnosticOperationId` | O-4 统一 bridge 承接错误诊断，不保留双链 |
| `OperationsScopeContext` | 删除 slice/provider/selector，唯一读者直接使用已有 prop | 既有 operations context test |
| platform `contextScopedQueryArgs` 4 处 | 改为直接使用 `groupWorkspaceKey`；删焊死恒等调用的 architecture assertion；foundation 函数与 operations 31 个真实消费者保留 | operations context-version tests |
| operations `refreshSignal` publish | 删除该发布线；保留 primitive 与 platform 真实 subscriber | platform subscriber test |
| inventory model 恒等/死 helper | 删除 identity helper、`jsonBody`、`matchesStockView` 及只证明它们存在的 test | 调用方行为测试 |
| ProductionTag JSON 双实现 | 先把 JSON-path 测试中的业务断言迁到 typed path，再删除 226 行 legacy implementation | typed create/update/transition/copy 同等断言 |

不用 `knip`，不新增依赖。

### B1-05 P-8：冻结计数改为结构不变量

逐个处理 `edge-codegen.mjs` 八个位置：

- 删除 operation count 与 error count 的固定数量，如果同段已有 exact set 则不另造门；
- 保留 229 的集合相等、281 的唯一性；
- 删除固定 4、固定分组数、8/5/20、固定 10、固定 5；
- 保留 consumer/partition、ROLE_HOME/BUSINESS 分类、action coverage 与 uniqueness。

Red mutation 覆盖 missing、duplicate、misclassified；negative control 是合法新增一个 manifest node 可通过并产生生成物。

### B1-06 S-2：只统一真实同义分叉

- `DISABLED` 统一展示为“停用”；同族扫描不得把其他业务状态强行改词。
- 两个商品编码输入统一后台 `[A-Z0-9][A-Z0-9_-]{1,63}` 及同一提示；不修改其他三个不同业务字段的正则。
- 锁常量分叉由 B2 P-3 处理，不在此复制第二次。

### B1-07 E-1：可运行的一键门

1. 引入仓根 Gradle wrapper，版本与 checksum 固定。
2. 新增共享 `scripts/lib/gradle-runtime.mjs`：本机优先验证显式 `V2S_GRADLE_HOME`，否则使用仓根 wrapper；远端 runner 必须解析、校验并同步真实 distribution home，不能把 wrapper 当 GRADLE_HOME。
3. `tools/verify-gates/verify.mjs` 与 `scripts/test/r5-remote-testcontainers.mjs` 共同使用该 resolver，删除裸字符串 `gradle` 和分叉解析。
4. 在 static verify 接入 backend `spotlessCheck`；现有 PMD 保留。
5. React editable-key 门先跑真实 red mutation；当前已能抓住则不改正则。

Red：空 PATH/无 env 仍可用 wrapper；坏 env 明确失败；远端缺真实 distribution 拒绝。Negative：PATH 中无关同名文件不被接纳。此步骤只建能力，不在设计阶段执行远端测试。

### B1-08 E-5：规范可达性与冲突修正

`AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`HANDOFF.md` 直接链接：

- `doc/platform/backend-coding-standard.md`
- `doc/platform/frontend-coding-standard.md`

同时修正文档漂移：后台规范把“当前必须统一 JDBC receipt helper”改为“P-1 经 scope-key 决策后统一；本轮 P-2 只要求完整唯一执行语义”；前端规范把“门只能是禁止句”改为 §2.3 的机械不变量规则。不能让 implementation 同时面对互斥标准。

### B1-09 O-5：最小健康端点

加入 `spring-boot-starter-actuator`，只暴露 `health`，details 永不公开；可启用 liveness/readiness group。不得顺带引入 OTel、Prometheus、业务指标或生产告警。用 focused Spring context/config test 证明端点暴露集合和 details 策略；设计阶段不启动 DEV。

### B1-10 E-3：确认现状，无源代码动作

保留 `scripts/test/backend-acceptance --operation <X>` 的显式入口与默认不进 verify 的边界。不要删除 `@EnabledIfEnvironmentVariable`，也不要把完整 HTTP 结果冒充 static verify。该项只在对账表标 `CURRENT_TREE_ALREADY_SATISFIED`。

## 6. B2 · 契约化、数据约束、可观测与命令斜率

B2 不拆为第四批，内部按 A/B/C 三个 sub-wave 串行，最后一次全范围复核。B1 先删除 Java binding 假产物并统一 Gradle 入口，避免 B2 重改同一旧形态。

### B2-A：契约与数据底座

#### B2-A1 D-4：迁移模板和 grandfather gate

- 增加 migration 模板，规定 constraint/index 命名、scope 列顺序、comment、无 `IF EXISTS` 掩盖。
- 建立剩余匿名 CHECK/UNIQUE 的精确 file+anchor grandfather baseline；不以总数宽松放行。
- 新迁移和本轮触及语句必须具名；不要求一次重命名全部 49/24 个 legacy 约束。
- D-3 直接修改旧 migration 时，本轮新增/改写的 constraint 全部按新规则命名，并同步后来引用的 drop 名。

Red：新增匿名 CHECK、改动 allowlist anchor、使用自动截断名均失败。Negative：未触及的 exact grandfather 项通过。

#### B2-A2 S-1：跨层闭集契约

1. 字典 kind：以 catalog-inventory contract 为唯一声明源，生成完整 TS union 与后端 owner 可用 enum，包含 `ORDER_OPTION_VALUE`；seed 使用同一 canonical set。数据库添加具名 CHECK。
2. problem code：从 contract `typedProblemCodes` 生成 module-accessible enum；catalog/inventory/production 构造 problem 时接受 enum，edge advice 只输出 `wireValue`。不让 owner 依赖 app-only edge enum。
3. capability key：生成器对 `admin-catalog.json` 全部 key（`BC-*` 与 `EDIT_*`）生成常量与 exact set；扩展 literal gate 的格式覆盖。当前已有三个 `EDIT_*` 常量，实施以保留并补证明为主。

单次中文文案、SQL 表名、`R5_*` marker 与 `group_workspace_key=?` 不契约化。

#### B2-A3 D-3：catalog scope-aware 关系

统一 scope `S=(data_node_ref, brand_ref)`。只对 owner-local 可证明关系补 scope，不给 asset/production opaque ref 加跨 owner FK。

| 关系 | 迁移目标 |
|---|---|
| category parent | category 增加 `(category_ref,S)` unique；parent 使用 `(parent_category_ref,S)` self-FK |
| catalog item / SKU | item 增加 `(item_ref,S)` unique；SKU 带 S，并以 `(item_ref,S)` FK；SKU 增加 `(product_sku_ref,S)` 与 `(item_ref,product_sku_ref,S)` unique |
| SKU attribute value | 带 S；分别约束 item/SKU/dictionary value 的 scope-aware FK |
| item category | 带 S；item 与 category 两端复合 FK |
| composite group/component | group 带 S 并约束 item；component 带 S，并约束 group、component item、`(component_item_ref,product_sku_ref,S)` |
| variant axis/value | 两表带 S；axis 约束 item 与 dictionary；value 约束 axis 与 dictionary |
| order option group/value | 两表带 S；group 约束 item；value 约束 group，nullable dictionary ref 使用 scope-aware FK |

直接修改：

- `V20260814_100000_000__catalog_p3_model.sql`
- `V20260814_101000_000__catalog_order_option_relations.sql`
- 必要时同步 `V20260808_140000_000...` category 与 `V20260816_010000_000...` dictionary 的既有 unique/FK 名称

同步 Java facts：`CatalogItemCategoryFacts`、`CatalogSkuFacts`、`CatalogCompositeFacts`、`CatalogSkuVariantAxisFacts`、`CatalogOrderOptionFacts` 与 `CatalogOwnerService` 的 SELECT/DELETE/INSERT 必须携带 S。只按单一 parent 外键且无需跨行 join 的 media/reference child 不因“看起来统一”机械加 S。

证明：扩展 `catalog-p3-model-migration.test.mjs`；真实 PostgreSQL 参数化测试覆盖 category parent、item-category、SKU attribute、composite、variant、option 的 same-scope PASS 与 cross-scope FK FAIL；copy 写入 target S；`CatalogAssetGlobalReferenceTest` 保留为不应加 scope FK 的反例。

#### B2-A4 D-5：四个独立索引

在一个新具名 migration 中增加：

- `ix_organization_store_brand` on `organization.store(brand_id)`
- `ix_organization_store_tenant` on `organization.store(tenant_id)`
- `ix_contract_store_contract_tenant` on `contract.store_contract(tenant_id)`
- `ix_workspace_role_assignment_role` on `workspace_iam.role_assignment(role_id)`

结构测试检查 exact leading column，不用“存在任意包含该列的索引”弱判据。后续运行期 `pg_stat_user_indexes` 只属于性能观测，不是本轮静态实现 PASS。

#### B2-A5 P-3：只共享纯锁键推导

选择需求候选中的更小方案：在 backend foundation 增加无 JDBC 的纯工具 `CrossOwnerAdvisoryLockKey`，包含三个 namespace：PRODUCT_SKU、CATALOG_ITEM、SKU_ATTRIBUTE_VALUE，以及 UUID→两 int、排序、去重的确定性推导。Catalog 与 Inventory 保留各自 `JdbcTemplate` 调用。

不把能力放 inventory，不让 catalog 反向依赖业务模块；不为三个常量给 foundation 引入 `spring-jdbc`；不改 dependency registry。测试钉住现有合法 key pair，并确保两 owner source 不再各自持有位移/掩码字面量。各 owner 锁空间不要求互斥，只要求同一 namespace+UUID 算法一致。

### B2-B：一条可关联错误链

#### B2-B1 O-2/O-3：后端请求完成事件与异常 cause

扩展：

- `RequestCompletionDiagnosticState` 保存安全的 workspace/data-node scope、actor account、最终捕获 Throwable；
- `OperationsSessionResolver`、`PlatformSessionResolver` 在解析成功时写入 state，不在每个 controller 重复；
- foundation 提供 boot-scoped `RuntimeNodeIdentity`：优先安全的 `V2S_RUNTIME_NODE_ID`，否则 `node-<boot UUID>`，不记录 IP/hostname；
- `RequestCompletionEvent.Fields` 和 `renderCompletion()` 增加 tenant/scope、actor、runtime node；不能只 `addKeyValue`，因为当前 console pattern 不渲染 kvp；
- `Slf4jSecurityDiagnosticRecorder` 用真实 Throwable 设置 cause，成功 INFO、已分类 4xx WARN/INFO、未知或 5xx ERROR。

对需求中“前置 resolver 立即记日志”做一处必要细化：新增 `RequestFailureCaptureResolver`，在 `extendHandlerExceptionResolvers` 首位只把 Throwable 写入 request state 并返回 null，不立即决定日志级别。既有 Advice/DefaultHandlerExceptionResolver 继续决定响应；`afterCompletion` 根据最终 status + captured Throwable 只记录一次。这样不复制第二套 Advice status 映射，也不抢 400/404/405/406。

O-1 没有独立“给每个业务 service 加 logger”的实施项：它由本步骤的统一 completion event 承接。验收看一条 completion log 能否关联租户、操作人、operation、节点与失败 cause，而不是 logger 命中数。

验证：已认证失败命令的单条完成日志可独立给出 tenant、actor、operation、node 和 stack frame；400/404/405/406 响应形状不变；类型化 4xx 非 ERROR；未知 5xx 为 ERROR；同一异常只记录一次；日志不含 token、cookie、Authorization、手机号、登录名、原始 IP 或 raw payload。

#### B2-B2 O-4：前端统一错误 bridge

在 `libraries/frontend/admin-ui-foundation` 增加一个 bridge，同时接：

- React ErrorBoundary `(Error, ErrorInfo.componentStack)`；
- `window.error`；
- `unhandledrejection`。

`safeLogger` 增加 dedicated `captureError` 或 discriminated thrown-error event；message、stack、componentStack 只对真实 thrown error 必填，不能迫使普通协议 ERROR 伪造 stack。两个 App 各安装一次并在卸载时清理 listener，ErrorBoundary callback 直接转发真实对象。测试三个来源各记录一次、重复安装不重复、cleanup 生效、敏感字段脱敏。

两个 App 保留现有 `createBeaconLogSink(import.meta.env.VITE_FRONTEND_LOG_SINK_URL)` 注入点；bridge 产生的 WARN/ERROR 在 sink 被注入时必须发送，即使 `enabled` 仅控制 console。真实生产 sink URL/部署配置仍归 `HANDOFF.md`；本轮证明 injected sink 收到正确 event，不把“代码路径可达”冒充生产已出网。

#### B2-B3 O-6：用户问题编号

foundation 提供纯 helper，把安全 correlationId 追加为 `问题编号：<id>`。platform/operations 两套 problem feedback/transport 共用；网络失败或 response 无 correlationId 时不制造假编号。两 App focused tests 分别证明 typed 4xx、unknown 5xx 与无 ID 情况。

### B2-C：P-7 命令扩展斜率

按 §4 改 canonical declaration、四个 generator/tooling 与成本 fixture。P-7 最后执行，基于 B1 已清理的 JSON-only handler binding 和 B2-A 已冻结的 contract enum，避免先生成旧 Java 层再删除。

## 7. B3 · 前端形状与收尾

顺序固定为 P-4 → testId → P-5。

### B3-01 P-4：只上提纯结构

在 `admin-ui-foundation` 提供：

- 泛型 extension field form control renderer；
- 泛型 detail renderer；
- 纯 antd control switch 与布局，不 import app API、routing、generated wire 或业务 hook；
- `testIdFor(field)` callback，让 app 保留选择器命名所有权。

替换 7 个内联表单 renderer：ContractCreate/Edit、StoreCreate/Edit、BusinessEntityCreate/Edit、OrganizationExtensionFields。`OrganizationExtensionFields` 的 endpoint hook 继续 app-local；catalog domain workbench 继续 feature-owned。只有结构确实同形的 detail renderer 一并收口。

Focused component test 证明字段 kind、必填/禁用、值往返、error/help、testId 与未知 kind fail-fast。静态/组件证明不能冒充浏览器交互。

### B3-02 S-1：跨源码/spec testId 常量

分别新增 app-owned：

- `apps/frontend/platform-admin/src/app/automation/platformTestIds.ts`
- `apps/frontend/operations-admin/src/app/automation/operationsTestIds.ts`

只收录 161 个跨 production/spec 边界 id；动态 id 使用 typed function/prefix。L2 spec import 同一常量。P-4 先冻结最终字符串，常量化不得再次改值；本轮只跑 typecheck/static selector exact-set，不运行浏览器 L2。

### B3-03 P-5：尺寸 ratchet 最后落地

阈值：手写 production source 超过 600 LOC 进入治理。规则：

- generated/do-not-edit header 文件、test/spec 不计；
- 新增手写 production 文件 >600 直接失败；
- 现有超阈值文件用 exact path+LOC baseline grandfather，只能不增长；
- P-2/P-4 等拆分降低 baseline 后立即 ratchet 到新值；
- 不要求本批一次拆完全部大文件。

当前 baseline 必须由 gate 生成并人工确认，起始参考为 backend 22 个、frontend 11 个非生成文件；`generatedAdminCatalog` 有 generated header，明确排除。Red：新 601 行文件、grandfather +1；negative：600 行、generated header 或 test 文件不报错。

## 8. 三批逐文件实施序列

### B1 顺序

1. 逐入口冻结 P-2 22 行清单与 tests。
2. 完成 P-2 四 owner 改造与 focused proof。
3. D-6 精确删语句；静态依赖 proof；动态 replay 留到获批受管运行。
4. E-2 形成 218 行 disposition，先落替代证明。
5. X 组按隐藏消费者顺序删除。
6. P-8 删除冻结数、保留结构不变量。
7. S-2 两族统一。
8. E-1 Gradle resolver/wrapper/spotless 接线与 mutation tests。
9. E-5 三入口引用与两份规范冲突修正。
10. O-5 health-only actuator；E-3 current-state 对账。
11. B1 全范围作者回读、fresh implementation review、Claude review。

### B2 顺序

1. D-4 模板/命名规则先落。
2. S-1 canonical enum/capability contract 与 generated types。
3. D-3 scope-aware migration + facts + real PG constraints。
4. D-5 四索引。
5. P-3 pure lock-key foundation。
6. O-2/O-3 request-state/cause/最终级别一体落地。
7. O-4 前端 bridge；O-6 用户问题编号。
8. P-7 canonical operation declaration、JSON `iaIds` 闭集与生成链斜率；确认 `cli.mjs` 不再读取 Markdown 作为 operation/IA exact-set 输入。
9. B2 全范围生成一致性、编译、focused proof、fresh implementation review、Claude review。

### B3 顺序

1. P-4 foundation renderer 与 7 个调用方。
2. 冻结 DOM selector 值后完成双 App testId 常量化与 spec import。
3. P-5 生成当前 exact baseline 并接 ratchet。
4. 双 App focused tests、typecheck、architecture/static gates；不运行浏览器 L2。
5. B3 fresh implementation review、Claude review。

## 9. 验证与证据矩阵

| 能力 | 机械/模块 proof | 未来动态 proof | 不可冒充 |
|---|---|---|---|
| P-2 | 四模块编译、并发 integration test、22 行 static inventory | 受管 Testcontainers business+cleanup；代表性 HTTP case | 不能说完整 HTTP/DEV/seed/UAT |
| D-6 | migration text/依赖 test | 获批后的受管 reset→full replay→seed | static PASS 不能证明 replay |
| E-1/P-8/E-2/P-5 | mutation tests、negative controls、`scripts/verify --validate-only` 与 focused scripts | 无 | gate PASS 不能证明业务 Journey |
| D-3/D-4/D-5 | migration parser、real PG constraint/index metadata test | 后续 seed/readback；索引使用率另议 | 有索引不能证明生产 planner 一定使用 |
| O-2/O-3/O-5 | Spring context、captured logger、status regression tests | 后续真实 HTTP 日志抽样 | unit log 不能证明部署 sink/告警 |
| O-4/O-6 | foundation + 双 App focused tests、injected sink | 浏览器 L2 暂缓 | 不宣称生产出网或浏览器捕获 |
| P-7/S-1 | generator determinism、exact set、compile/typecheck、cost fixture | 新真实 command 首次采用时复核 M=9 | fixture 不等同已交付新业务命令 |
| P-4/testId | component/focused/typecheck/static exact set | 浏览器 L2 暂缓 | selector 编译通过不等同可点击 |

实现期每个批次最终至少运行 `./scripts/verify --validate-only`、该批 focused tests、typecheck/architecture lint；所有需要 PostgreSQL/长运行的验证只能走 `scripts/` 受管入口并分别报告 business/cleanup。具体命令以实施时 `scripts/README.md` 当前入口为准，不在本设计冻结可能漂移的 shell 拼接。

## 10. 逐点双读与同族修复纪律

每个实际变更点都执行：

1. 重开需求对应条目、适用详设、本任务六维 memory 命中和 owning source；
2. `rg` 同根模式与反例，写清完整分母；
3. 做最小根因实现，不做单点字符串止血；
4. focused proof；
5. 用第 1 步同一组材料回读源码与证明；
6. 抽象普遍失败模式并落到既有 test、review checklist 或 project-memory；只有明确授权时才写 project-memory；
7. fresh independent implementation reviewer 必须看到前后双读留痕。

## 11. 明确不做与 HANDOFF

- P-1、D-1、D-2：等待 scope-key 形态裁决；不在 P-2 中偷做统一 receipt framework。
- P-6：第 4 个 owner 前不做 coordinator registry。
- E-4：浏览器 L2 暂缓期间不造零效果的“写测试代价”门，登记 `HANDOFF.md`。
- S-3：明确不契约化的字符串类别不动。
- 构建循环性能、SMB、`--rerun-tasks` 优化不在本轮。
- CI、备份、密钥轮换、生产 sink、OTel/Prometheus/告警归 `HANDOFF.md`。
- 不做 backward-compatible read、backfill、migration compatibility layer。

## 12. 验收判定

每个问题逐条使用：`CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE / UNVERIFIED_REQUIRES_EVIDENCE / DEXTER_DECISION`。

批次只有在：源码与设计逐项对账、focused proof、适用静态门、受权范围内 dynamic business/cleanup、fresh independent implementation review、Claude review 都关闭后才可 GO。未授权的 DEV、seed、完整 HTTP、L2、UAT 不写成失败，但必须保持 `UNVERIFIED_REQUIRES_EVIDENCE`，不能被其他 PASS 替代。

最终项目级结论另受 §0 的 G1/P-1 冲突约束：三个批次即使全部通过，也只能说“本轮批准范围 GO”；在 P-1 仍推迟时不得说完整 G1 已关闭。
