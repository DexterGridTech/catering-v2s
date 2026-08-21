SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# 商品库存与 BOM 业务模型 · 串行实施计划

## 0 · 元数据与授权边界

```text
SERIAL_PLAN_KIND=ONE_BATCH_INTERNAL_SERIAL_CP
BUSINESS_SOURCE=doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-business-model-requirements-discussion-codex.md#catalog-inventory-bom-formal-requirements
JOURNEY=doc/decisions/2026-08-22-v2s-catalog-inventory-bom-configuration-journey.md#catalog-inventory-bom-configuration-journey
UI=doc/decisions/2026-08-22-v2s-catalog-inventory-bom-configuration-ui-interaction.md#catalog-inventory-bom-configuration-interaction
IA=doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-information-architecture-codex.md#catalog-inventory-bom-information-architecture
IMPLEMENTATION_DESIGN=doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-implementation-design-codex.md
DEXTER_WIREFRAME_REVIEW=ACCEPTED@2026-08-22
IMPLEMENTATION_AUTHORITY=false
RUNTIME_AUTHORITY=false
```

本计划只定义未来一次性实施的内部顺序，不授权修改生产代码、contract/generated 文件、migration、seed，也不授权执行测试、DEV、reset、start、seed、browser L2、UAT、部署或数据操作。后续只有 Dexter 的新明确指派可以打开相应阶段。

## 1 · 目标、结束条件与证据口径

目标是把商品库存与 BOM 从三个互不闭合的 flat payload 收束为由 contract 约定、catalog 重派生合法 owner、inventory 原子拥有扣减定义的单一模型；七种 shape、三类节点和三种扣减方式在前后端遵守同一矩阵，不通过 UI 隐藏或 fallback 维持旧语义。

未来 implementation task 的完成条件是：CP-00 至 CP-07 全部依次完成；contract/generated、migration、catalog/inventory owner、operations-admin、acceptance 与 seed 的静态链闭合；只有另获动态授权后才能执行 CP-08，并分别留下 business 与 cleanup 证据。静态 compile/typecheck 不得写成 Testcontainers、DEV、browser L2 或 UAT 证据。

每个实际改点都必须执行同一套逐点双读：写入前重开本计划该 CP 的 `RECALL`、对应正式需求/IA条目、六维 memory 命中、owning source 与可复用先例；focused proof 后用同一组原文回读实现。第一首败必须保留；重复 signal 第二次尝试前先诊断 last known good、broken boundary、日志与受管资源身份。

## 2 · 唯一串行关键路径

```text
CP-00 implementation admission 与实时分母复核
  ↓
CP-01 P1 contract source → tokens → M1/bindings → P3 generated chain
  ↓
CP-02 additive Flyway → inventory owner 原子定义/生命周期/candidate query
  ↓
CP-03 catalog shape/owner 重派生 → REQUIRED whole-save coordinator
  ↓
CP-04 operations-admin owner workbench 与 generated hooks
  ↓
CP-05 20 个非法 fixture 迁移 → 3 个参数化 acceptance scenario
  ↓
CP-06 P1 唯一 seed source → seed plan/executor/static tests
  ↓
CP-07 静态全链、focused tests、编译/typecheck 的首败闭合
  ↓（仅在 Dexter 另行明确授权后）
CP-08 受管 Testcontainers / DEV / reset+seed / browser L2，各自独立授权与证据
```

没有 CP-01 的 generated request/readback，后端和前端不得手写临时 DTO；没有 CP-02 的 inventory 原子命令，catalog 不得以多次补偿写替代；没有 CP-03 的 owner 重派生，前端不得成为准入真相；CP-07 静态未绿，不得进入任何动态动作。

## 3 · CP-00：implementation admission 与实时事实复核

**目标**：后续若获实施授权，先确认设计前提仍与当时源码一致；本轮不执行这些实施动作。

| 顺序 | 现成能力/规范 | 可证伪观察 | FORBID / 停机 |
|---|---|---|---|
| 1 | `AGENTS.md`、Roadmap 授权字段、`project-memory/index.md`、`scripts/context/recall-memory`、`scripts/README.md` | 六维 recall 含 `task-kind=implementation`，所有命中原文和本批五份设计重新读取 | 授权仍仅设计则不得写代码或跑测试 |
| 2 | `scripts/generate/catalog-inventory-p1.mjs`、`CatalogAcceptanceScenarios.java`、`BackendAcceptanceScenarioCatalog.discover(this)`、`InventoryOwnerApi`/`Service`、`CatalogInventoryCoordinator`、`CatalogItemDrawer.tsx` | 先分别统计 operation、command token、`@AcceptanceScenario`、20 个非法 SKU fixture、legacy payload 和 API consumer；再实际走 `scripts/test/backend-acceptance --operation all` 的 discovery，核对 `annotated == discovered == selected`，并把差集按 scenario id、owner 文件和行号输出 | 数字与详设不同却继续按快照改；只数注解不核对 discovery；用文档分母代替源码 |
| 3 | `doc/platform/implementation-task-template.md`、详设 §13 | 每个差异能归类为可自主技术形态或四类停机之一 | 用 fallback、兼容层、缩范围或改业务规则绕过冲突 |

**RECALL**：正式需求 §3–§13、Journey、交互稿、IA、implementation design 全文、deterministic-context-only、backend/frontend coding standard。

## 4 · CP-01：contract 与生成链

**目标**：由唯一 P1 源声明 shape policy、单一 `inventoryRules` detail aggregate、新 candidate cursor GET 与 15 个 typed problem；移除三个旧 active rule 住址。

1. 只修改 `scripts/generate/catalog-inventory-p1.mjs` 的 `shapeAdmission`、operation metadata、save/read schema、problem definition、seed schema/self-test 等 owning declarations；`inventoryRules.nodes[]` 用生成的 owner union 表达 ITEM/SKU/OPTION_VALUE，mode 只允许 NONE/DIRECT/BOM。
2. 新增 ordinal 57 的 `getOperationsInventoryConsumptionTargetCandidates`：GET `/operations/catalog-inventory/inventory-consumption-target-candidates`，Cursor default 20/max 100；本批 command 数仍为 37。
3. 依序执行并修复生成链：P1 → `catalog-inventory-workspace-command-tokens.mjs` → `backend-performance-m1-command-execution-bindings.mjs` → `operation-handler-bindings.mjs` → `catalog-inventory-p3-frontend.mjs`；每个 generator 的 expected/check/self-test/red mutation 同时更新。

| 现成能力/规范 | 可证伪观察 | 无成文规范时的同形先例 |
|---|---|---|
| P1 generator、generated exact-set、backend/frontend coding standard §generated wire | generated OpenAPI/Java/TS/RTK 中只有一个 rule aggregate；57 operations、37 command tokens 精确一致；普通/称重 schema 不可构造 SKU owner | candidate operation 与同 controller 的 cursor query、同 P1 operation metadata/schema pipeline 同形 |

**FORBID**：手改 generated OpenAPI/root shard/Java/TS/RTK/fixture；保留 `inventoryConfiguration.nodes`、`catalogDraft.inventoryBom`、option `materialQuantities` 作为 fallback/双写；把 `HAS_SKU` 当运行时粒度开关。

**RECALL**：正式需求 §5/§8/§9、IA §2.2/§3、详设 §4 CP-01/§5/§7、collection boundary memory、两份 coding standard。

## 5 · CP-02：Flyway 与 inventory owner

**目标**：inventory 在一个 public command 内锁定、校验并原子替换一个商品的所有合法 owner rule，同时保留历史事实。

1. 在 `apps/backend/catering-business-server/src/main/resources/db/migration/` 新建 additive migration：给 `inventory.stock_target`、`inventory.stock_bom` 增加 `definition_status=ENABLED|DISABLED` 及 active lookup index；旧行只回填 ENABLED，不猜历史 DISABLED。后续 DISABLED 行连同 configuration/rows/unit snapshots/version 成为不可变历史定义快照；先检查并报告普通/称重 SKU fact、双 active、空 active BOM、无法解析 owner。
2. 在 `InventoryOwnerApi` 新增 `replaceCatalogInventoryRules` 和 typed cursor candidate query；以 immutable command 接收 catalog 已重派生的 owner 集合与单位快照，不读取 catalog schema。
3. 在 `InventoryOwnerService` 用 scope/advisory/row locks 串行化同商品定义替换；准入矩阵、单一 active mode、非空 BOM、组件五条件、自引用、option 正负/实际用量和单位快照全部在 owner 再校验。
4. A-05 切换按详设 §8.1 的权威事实表执行：锁定后先拍下命令开始前的两表 status 集合，再检查余额、ledger、active BOM 引用、pre-existing `DISABLED` definition。无 blocker 时才把旧定义 `DISABLED`、新定义 `ENABLED`；当前命令新停用的行不算本次 blocker，后续第二次自动切换会被它阻断。任一 blocker 返回 `INVENTORY_DEDUCTION_MODE_CHANGE_BLOCKED`，`details.blockingFacts` 只含四个固定 kind/计数，不搬余额、不删流水、不重写快照。
5. candidate query 只返回同 scope、usable、具 `BOM_COMPONENT`、已有 StockTarget、基础/消耗单位快照完整且非 self 的 target；cursor 排序键稳定，101 条两页不重不漏。

| 现成能力/规范 | 可证伪观察 | 同形要求 |
|---|---|---|
| `InventoryOwnerService.requireTypedContext`、现有 advisory lock/`FOR UPDATE`、`validateCatalogUnitLifecycle`、cursor envelope | owner integration tests 中双 mode、每个 blocker、六个组件 red case 均在写前拒绝；失败后 target/BOM/version 不变；candidate 第二页无重复/缺失 | 新 command 与既有 typed command 的 immutable DTO、同一 scope 复核、结构化脱敏日志、typed problem handler 同形 |

**FORBID**：跨 schema 读 catalog；自动建 component target；自动转换余额；清除 ledger/history；静默挑选 fallback mode；SQL/日志输出 raw payload 或敏感身份。

**RECALL**：正式需求 A-01..A-05 与单位八条、详设 §6/§8/§9/§10/§13、`InventoryOwnerApi.java`、`InventoryOwnerService.java`、相关 Flyway 与 backend standard。

## 6 · CP-03：catalog 重派生与 REQUIRED whole-save

**目标**：catalog 保存商品结构后，以服务端当前事务事实派生合法 owner，并且 whole-save 只调用 inventory 一次原子 replace。

1. `CatalogOwnerService.saveCatalogItem`/shape policy 禁止普通和称重商品 SKU、SKU shape item owner、MATERIAL BOM、COMPOSITE/SERVICE/BENEFIT rule；标签、商品属性、SKU 销售属性、选项组目录不进入 owner tree。
2. `CatalogInventoryCoordinator.saveCatalogItem` 在现有 `SaveOperationsCatalogItemOperation.execute @Transactional(REQUIRED)` 中，catalog save 后重派生 owner identity，调用 `InventoryOwnerApi.replaceCatalogInventoryRules` 最多一次，再执行既有 asset settlement。
3. request 中任何 ownerType/ref/shape 只作为待校验输入；服务端结构与 request 不一致返回 typed problem，不能按数组顺序配对。
4. 删除无全仓消费者的 `ensureCatalogItemSaveTarget`、`saveCatalogItemProductBom` 与 overload；保留 order-option value delete/copy 等专用 lifecycle command，并改为新定义语义。

| 现成能力/规范 | 可证伪观察 | 同形要求 |
|---|---|---|
| `CatalogInventoryCoordinator.saveCatalogItem`、`CatalogOwnerApi.saveCatalogItem`、REQUIRED transaction、unit U01 同事务拒绝先例 | 故意让 inventory 验证失败，catalog item/version/sections、inventory definitions、asset binding 全部不变；每次 whole-save inventory replace 调用数为 1 | coordinator 的跨 owner 调用继续使用 public API 与相同 execution context，不跨 schema DML、不事后补偿 |

**FORBID**：catalog 写 inventory 表；inventory 反读 catalog；恢复旧 three-write 编排；前端或 JSON fallback 派生 owner；误伤标签/属性/点单选项定义。

**RECALL**：A-01/A-02、IA owner tree、详设 §6/§7/§8、coordinator 和 catalog owner 全部调用者。

## 7 · CP-04：operations-admin owner workbench

**目标**：同一 Drawer 中按 shape 展示唯一合法配置面，前端使用 generated contract，交互与后端矩阵同源。

1. 在 `CatalogItemDrawer.tsx` 删除 flat `inventoryBomDraft` 与旧拼装；新增同目录 `CatalogInventoryBomWorkbench.tsx`、`useInventoryConsumptionTargetCandidates.ts`，先查并复用 `libraries/frontend/admin-ui-foundation` 的 Drawer/lifecycle/overlay/list/HTTP 能力。
2. 普通/称重/MATERIAL 的单节点树退化为直接详情；SKU_VARIANT 左树右详情，主壳只读；OPTION_VALUE 只出现“按 BOM 扣组件”，不创建 target；非库存壳只显示 IA 文案。
3. mode 卡片和表单只消费 detail readback；BOM 组件用 cursor candidate hook，前端筛选只改善体验，owner 仍复核。direct 不出现外部 target selector。
4. 使用 source unit precision 做输入归一化、target consumption precision 做结果截断；不使用会四舍五入的 `InputNumber precision`。复用统一 submit/dirty/reset/close、refresh signal、problem feedback。

| 现成能力/规范 | 可证伪观察 | 同形要求 |
|---|---|---|
| accepted interaction/wireframe、IA、frontend coding standard、admin-ui-foundation、generated RTK hooks | focused component/model tests 证明三个布局分支、非法 mode 无入口、cursor 两页、typed problem 定位、关闭后草稿清空、保存后 item detail/candidate 精确失效 | 新 workbench 与同 Drawer 已有 foundation integration、abort/unwrap/problem-feedback/cache-tag 生命周期同形 |

**FORBID**：新建单位/库存/BOM详情页；复制 foundation；手写 path/DTO；本地维护服务端镜像；自由单位文本；InputNumber round；把组件过滤或 mode 准入只放前端。

**RECALL**：Journey、accepted interaction、wireframe、IA 两 screen、详设 §4 CP-04/§5/§7、frontend capability memory、现有 Drawer/hook tests。

## 8 · CP-05：acceptance fixture 迁移与 3 个参数化场景

**目标**：保持机器场景总数不超过 80，同时完整覆盖正式需求十五条、全矩阵及强制反例。

1. 现跑确认 `CatalogAcceptanceScenarios.java` 基线；若仍为 77，先通过 `BackendAcceptanceScenarioCatalog.discover(this)` 的实际 discovery 核对 `annotated == discovered == selected == 77`，任何差集先停机并闭合；确认后只新增：
   - `catalog.inventory-rule-admission-matrix`
   - `catalog.inventory-component-option-and-unit-semantics`
   - `catalog.inventory-mode-switch-guard`
2. 三个 method 内用具名 case table 建独立 fixture/request/oracle：63 个 shape×node×mode case、A-05 八 case、组件六 red case、option 三分支，以及空 BOM、双 mode、属性伪 node、历史单位和 `0.3567kg→356g`。A-05 历史 PRESENT 必须先走真实首次切换产生 pre-existing DISABLED definition，再以第二次反向切换证明拒绝；历史 ABSENT 证明首次切换不会被当前命令刚停用的行自我阻断。
3. 迁移当前 20 个 `saveIndependentSku*` 非法调用点：单位2、base-unit1、SKU lifecycle/reference/copy16、伪 material1；保留 SKU 语义的改合法 SKU_VARIANT，纯 target/单位测试改 ITEM/MATERIAL。同步六个 helper 与所有手写旧 payload。
4. 每个拒绝 case 不只断言 HTTP/code，还读回 catalog version、inventory definition/status/version，证明事务内 no-write。

| 现成能力/规范 | 可证伪观察 | 同形要求 |
|---|---|---|
| backend acceptance business scenario standard、`CatalogAcceptanceScenarios.java`、显式 scenario catalog | 先证明基线 `annotated == discovered == selected == 77`；新增后再证明 discovery 的 `annotated == discovered == selected == 80`；每个新增 scenario 的 identity/fixture/request/businessOracle 非空；15需求逐项能指向失败断言；普通/称重+SKU fixture=0 | 参数化 case 仍走真实 HTTP/容器/owner，不建 provider 壳、共享 SPI 或第二 registry |

**FORBID**：删断言降分母；把 15 条各拆成新 scenario 超过 80；直接 SQL 代替被测业务路径（只允许受控 blocker fixture）；把 seed readback 当 acceptance。

**RECALL**：正式需求 §11、详设 §11 全文、Claude 的测试要求、acceptance standard、20个源码调用点和 runner/catalog。

## 9 · CP-06：丰富 seed 的唯一生成源与执行器

**目标**：新功能和旧数据调整分栏落在专题自己的唯一源，generated fixture 不手改。

1. 只在 `scripts/generate/catalog-inventory-p1.mjs` 的 `catalogDefinitionSeed`/`seedDatasets` 定义业务图；`scripts/dev/catalog-inventory-seed-executor.mjs` 只负责 generated whole-save HTTP 物化/readback。
2. 新功能实例覆盖七 shape、NONE/DIRECT/BOM、普通/称重 item、SKU 两个独立 BOM、option 加珍珠正向与换燕麦奶一负一正及 actual quantity、公共 `BOX-001` 多 BOM 引用、MATERIAL direct、盘点有/无两支、A-05 blocker 与单位历史。
3. 旧功能调整删除三个 flat rule 住址；普通/称重 SKU 分母为 0；SKU shell readonly；MATERIAL 无 BOM；套餐内容不转库存 BOM；保留单位单值、SKU override/clear、停用绑定、`0.3567kg→356g`。
4. 同步 `catalog-inventory-seed-plan.mjs`、P1 generated fixture/schema/evidence、`catalog-inventory-definition-seed.test.mjs`、`catalog-inventory-seed-identity.test.mjs`、executor static test；只有新增 test 文件才改 `test-health-entry-runner.mjs` 登记分母。

| 现成能力/规范 | 可证伪观察 | 同形要求 |
|---|---|---|
| P1唯一生成源、owner HTTP executor、seed plan、现有 static tests | generator/self-test 与 Node health runner exit=0；generated fixture 中七 shape/三 mode/option sign/actual/shared component/counting branches 精确可枚举；executor readback 验 owner/mode/status/rows/unit/version | executor 与现有受管 seed 分阶段、route registry、结构化脱敏日志、失败 no fallback 同形 |

**FORBID**：手改 `contracts/policy/catalog-inventory-fixture-catalog.json`/schema/evidence；把对象塞进其他域 plan；executor 直写 SQL；只造 happy path；start 隐式 seed。

**RECALL**：详设 §10b、单位专题 seed 规则、P1 generator、executor/plan/static tests、managed runtime 边界。

## 10 · CP-07：静态与 focused 闭合

**目标**：按依赖顺序拿到可信静态/测试证据，并保持 first failure 链路。

1. 先跑 P1、tokens、M1/bindings、P3 的 `--check`/self-test；首败只修 owning source及其 expected/red fixture，不改 generated 文件止血。
2. 再跑 catalog/inventory focused owner tests、模块 `compileJava`/`test`、operations-admin typecheck/focused tests、Node test health runner；每轮报告 first failure、last known good、broken boundary、business、cleanup。
3. 最后跑仓内当时登记的静态全链；用退出码判断，不用单文件 PASS 拼全绿。静态 cleanup 固定 `NOT_APPLICABLE_STATIC_ONLY`。
4. 任何同 signal 第二次出现前调用 `cs-systematic-debugging`，读取结构化日志、源码声明/传递/消费链和 runner denominator；不得延长 timeout 或盲重试。

**RECALL**：先回到触发首败所属 CP 的原 `RECALL` 并重走该点的写前/写后双读；同时读取正式需求/IA/详设对应条目、首败原始日志与 last known good、触发 generator/test/runner 的 owning source、当前 denominator、self-test/red fixture。CP-07 只负责暴露和闭合失败，不形成脱离原 CP 的“修门”修改点；任何修复及 proof 必须回写到所属 CP 的双读记录后才继续全链。

**退出条件**：generated exact-set、compile/typecheck、focused tests、Node runner、静态全链全部真实 exit=0；legacy flat fields/API/非法 fixture 同根扫描为设计声明的精确零；未声称动态、DEV、seed 或浏览器证据。

## 11 · CP-08：动态动作仅在后续分别授权后执行

| 动态层 | 需要的新授权 | 受管入口与证据 | 不得冒充 |
|---|---|---|---|
| backend Testcontainers | 明确授权测试 | `scripts/test/backend-acceptance`；manifest 中 discovered=selected=80、0 failed，真实读日志；business 与 cleanup 分开 | focused/compile 不是 Testcontainers |
| DEV restart | 明确授权 DEV 生命周期 | 只走 `scripts/dev/stop`/`start`；manifest/readiness/PID+start token/log；start 不 seed | 端口可达不是受管 PASS |
| reset+seed | 明确授权破坏性数据动作 | reset→start→seed；run-scoped manifest、seed readback、business/cleanup | 旧 DEV 或 seed 计划不是新执行证据 |
| browser L2 | 明确授权 browser | 本机受管 Playwright、隔离 namespace、用户行为 oracle、进程/隧道/远端数据 cleanup | DEV 页面截图不是 L2；本机 runtime 不是 UAT |

动态运行超过 30 秒每 30 秒按 AGENTS 六行格式汇报；日志无新增即诊断信号。只清理当前 manifest 证明拥有的 PID/container/namespace，不按端口或命令名杀未知资源。

## 12 · 全局停机清单

1. implementation 或任何测试/运行仍未获 Dexter 新授权；
2. 真实源码出现第八种 shape、SKU shape 可配置 option，或正式矩阵与批准 Journey 冲突；
3. catalog 无法从当前事务结构唯一派生 owner；
4. migration 发现无法无损解释的普通/称重 SKU fact、双 active、空 active BOM或 opaque owner；
5. “历史快照”权威事实源不同于详设所列事实，且两者不可兼容；
6. 拟退役 inventory API 存在不能迁移的非 whole-save consumer；
7. acceptance 实时基线导致新增3条后超过80；
8. seed 必须修改其他域业务计划才可成立；
9. 任一方案要求销售扣减换算、生产配方、采购/WMS、任意单位换算、兼容层或历史重解释。

停机报告必须给出：源码事实、两种候选理解、推荐及理由；不得只说“不确定”。

## 13 · 实施交接与后续 review

未来若获 implementation 授权，工单入口是本计划全文，实施纪律唯一正本为 `doc/platform/implementation-task-template.md`；每个 CP 按 `RECALL` 逐点双读，不能把多个 CP 拆成独立业务交付。实现完成后必须新建 `REVIEW_TARGET=IMPLEMENTATION` 的 fresh 独立审查，重开真实生产源码、运行证据和用户行为；本轮 DESIGN review 或“按设计实现”不能代替。

本计划本身的完成只代表设计链可交付 review，不代表 implementation ready 已获授权，也不代表任何静态、动态、DEV、seed、browser L2 或 UAT 已执行。
