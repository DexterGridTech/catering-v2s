---
title: 商品目录与门店轻库存 P2 backend implementation 独立对抗审查 Round 2
REVIEW_CYCLE_ID: CATALOG-INVENTORY-P2-IMPLEMENTATION-20260806
REVIEW_TARGET: IMPLEMENTATION
REVIEW_ROUND: 2
REVIEW_ROUND_LIMIT: 2
ROUND_FINAL_DECISION: SELF_DECIDED
reviewerKind: INDEPENDENT_SUBAGENT
verdict: NO-GO
findings: M=3 / S=3 / N=1
authorizationBoundary: 仅静态 P2 implementation 最终定向复核；不授权实现修改、契约/generated wire、数据库执行、seed/reset、DEV/UAT/L2、部署或 Git
createdAt: 2026-08-06
---

# P2 backend implementation 独立对抗审查 Round 2

## 0. 盲审、输入与当前字节

本轮是 `CATALOG-INVENTORY-P2-IMPLEMENTATION-20260806` 的第二轮暨最终一轮。fresh independent subagent 先重开当前生产源码、P1 current artifacts、P2 operation contract、active package 与真实 evidence，再逐条对照 Round 1 findings；作者 intake 只作为待验证输入，不作为关闭证据。主动构造了 local copy 只选基础资料、brand copy 任意 source node、VOIDED 后再更新、production-tag 同码异义、inventory/BOM source reference 和 runtime non-claim 等反例。

未执行 HTTP、Flyway、数据库、seed/reset、DEV/UAT/L2 或部署；仅实跑静态 checker、module unit tests 与标准矩阵。根 app test 被仓内 remote-Testcontainers guard 在测试执行前 fail closed，因此未将它记作业务失败或 PASS。

主要输入 SHA-256：

| 输入 | SHA-256 |
|---|---|
| `AGENTS.md` | `4d64bfb2bb435326a13c2ccb7955dbbbef621259030693e64db3cbf6a0bd9fda` |
| `PLATFORM-BLUEPRINT.md` | `3b90bd602eb682c4718d6c51f399501c34f804cddd96da82d59495e60b115a8d` |
| `doc/plans/platform/2026-08-06-v2s-catalog-inventory-three-stage-implementation-design-codex.md` | `a31a558b19bf41f6eed48093bc86895e01d1c400adae0c4185e633c00742f00b` |
| `doc/review/platform/2026-08-06-v2s-catalog-inventory-backend-operation-design-contract.json` | `01013d203305fc574e2386cb17a3d692812f64622cf566d8d870e2f7661a3537` |
| `contracts/catalog/catalog-inventory-edge-contract.json` | `4b71089a0ef2ff3ff561403fcc2ea6e703471856f2a5b222bafb56cd1fe7de02` |
| `contracts/openapi/catalog-inventory.openapi.yaml` | `d906a93de2f6de2a7c611741b8fddd5b9ebec4c23cc4f89de3c96e842a93e3a1` |
| `contracts/policy/catalog-inventory-fixture-catalog.json` | `4833d1444ec328754c83d0b4e7e2c443fc8058bee85c481ec72d573f73a9b57b` |
| `contracts/policy/catalog-inventory-api-scenarios.json` | `ba7062f1322b2a4ac103e5a20b4de1eb6467504964c0abefaea6328f295d5fc0` |
| `contracts/policy/catalog-inventory-l2-scenarios.json` | `4c4ce9cc448b226cc9251994ef7c7f2ce1ad19715aa7dd82204ae18d4b9ebe67` |
| `.runtime/compliance-control/active-package.json` | `6d8991ffa42d4300f62cc6678257ebf2682927db0be76929e0322c332fb411f2` |
| Round 1 review | `2aeaf4e0a2ae60dd5099734c24452615cdc6568b2302a8703f725e4a903f3306` |
| Round 1 intake | `02b07dedbf6992ab34540447334eaaf0e0662c34645af2cbbd3c6ffa49c949e4` |
| `OperationsCatalogInventoryController.java` | `08047aa052a9c52eff614c4b9636e7f28259622c0bb2afa278b40c362e04002f` |
| `CatalogInventoryOperationRegistry.java` | `5ffa4e5468525b3a017a3e7451dbf4d3fa872caa8ea1bddb04af1178137c1f50` |
| `CatalogInventoryApplicationService.java` | `b824067650391e62e5dee6babe95ff5ab36ecfd061b994cad266985d33b575ee` |
| `CatalogOwnerService.java` | `bd82dffdbe28773bd7a1906f0d0c621ba917cd56923b63364efbd517c0fae086` |
| `InventoryOwnerService.java` | `7cdf168ff913c975cdc0b33c183666779b1209ad2f59fa873fb54e4a2bd04373` |
| `ProductionTagOwnerService.java` | `ac191cb3a74298639da8d97cda52ee72e8a317258517ef94a013787e4b3a0845` |
| migration | `8e7653918735fc6434c598099b7472c10aac1bf7cc85e727e7a74a06296ab6cb` |
| P2 implementation evidence | `2b3d228e8dbb74d89685b64876f13afb73ad4f3a224062935cfd82718e27803b` |
| P2 API proof | `7c9883b3ccf9961c5da1bd08ad851c6a4f87012944fc17783900c02b40b282eb` |
| P2 checker implementation | `155169117d0079ca467b37f097a43ef11836389e0883c1f6d88df68992f4769c` |

实跑：`scripts/check/catalog-inventory-p2` PASS；`--self-test` PASS，但实际 mutation 仍只有 route-set 删除；三个 owner module unit-test task PASS；`scripts/check/standards-coverage --phase R5` PASS（150 rules）。

## 1. 最终结论

**NO-GO — M=3 / S=3 / N=1。ROUND_FINAL_DECISION=SELF_DECIDED。**

Round 1 的可信 brand/diagnostic authority 与手工 URI 反向路由已真实关闭，generated shape set、VOIDED migration、负库存守卫和 owner idempotency 也有实质进展；runtime non-claim 现在诚实。仍然阻断的是三个业务字节问题：复制预检/闭包/TOCTOU 仍只覆盖 catalog 子图且 source scope 未授权，42 个响应大面积不符合 P1 response component，VOIDED/错误码/幂等仍有可达分叉。静态 checker 和 focused tests没有覆盖这些路径，evidence 又已与当前源码 hash 漂移。

## 2. Round 1 逐条 disposition

| Round 1 finding | 最终 disposition | 当前证据 |
|---|---|---|
| M-01 trusted brand/diagnostic | `CONFIRMED_CLOSED` | controller `:61` 从 session capability 取诊断权限；requested brand 经 `BusinessEntityService:348-366` organization owner 判定，不再由 header 直接授权 |
| M-02 generic JSON/manual route | `PARTIALLY_CONFIRMED_CLOSED` | 手工 URI switch 已删除并使用 generated operation registry；edge/owner 仍是 generic JSON，且已产生 M-02 的真实 response drift |
| M-03 vocabulary/status/problem/idempotency | `PARTIALLY_CONFIRMED_CLOSED` | shape 与 migration closed set 已修；VOIDED command/action、catalog mismatch code、asset release idempotency仍错误，见 M-03 |
| M-04 copy closure/compatibility/rewrite/TOCTOU | `NOT_CLOSED` | catalog-only preflight/digest、未授权 source、co-owner blind copy 与 local selected-section 反例均成立，见 M-01 |
| M-05 placeholder/read/API evidence | `PARTIALLY_CONFIRMED_CLOSED` | 多个 required field 已补；response root/field仍错且 co-owner reads缺失。API runtime non-claim 本身已诚实，不作为本轮 finding |
| S-01 JSON core facts | `NOT_CLOSED` | migration 仍以 `sections/configuration/rows` 承载关键 SKU/BOM/关系事实，见 S-01 |
| S-02 false-green checker | `NOT_CLOSED` | 新检查多为源码字符串存在性，self-test 没有真实 copy/shape mutation，见 S-02 |
| N-01 repeated dispatch | `PARTIALLY_CONFIRMED_CLOSED` | URI repeated switches 已移除；operationId + ObjectNode dispatch仍跨四层重复，见 N-01 |

## 3. Findings

### M-01｜复制仍是 catalog-only 预检，source scope、完整闭包、co-owner TOCTOU 与 selected-section 均可被绕过

**依据类型**：当前生产源码 + operation 22/23/27/28 contract + 可执行路径推论。  
**路径/行**：`OperationsCatalogInventoryController.java:65-81`；`CatalogInventoryApplicationService.java:62-70,103-119`；`CatalogOwnerService.java:84-125,130-138,141-194,370-392,471-472,519-535`；`InventoryOwnerService.java:64-83`；`ProductionTagOwnerService.java:43-51`。

四个独立反例均成立：

1. **brand source 未授权**：edge 只用 session node 验证目标，`sourceDataNodeRef` 在 application `:67` 直接取 request，未调用 organization owner 验证“门店唯一关联总公司/品牌来源”。知道任意 node UUID 即可尝试读取并复制同品牌 catalog。
2. **preflight 不是三 owner 预检**：brand preflight 在 catalog `:370-392` 只加载 `catalog_item`；application 仅在 execute 后调用 inventory/production。inventory target、BOM、production tag 既不进入 500 closure count，也不进入 mapping/compatibility/version/digest。
3. **TOCTOU 只看 catalog**：digest 只绑定 catalog scope max version；preflight 后修改 BOM、消费单位或 production tag 不会产生 `STALE_COPY_PREFLIGHT`。execute 先写 catalog，再由 inventory/production `ON CONFLICT DO NOTHING` 盲复制；同码异义 tag、单位不兼容、BOM source ref 和 `OWNER_REFERENCE_LEAK` 都不会被 owner 复核或抛出。
4. **local selected-section 被绕过**：即使 `selectedSections=[BASIC_INFO]`，application `:64` 仍无条件调用 inventory.copy；inventory `:81-83` 会复制/覆盖整个 BOM。用户明确未选 BOM，目标 BOM 仍被改写。

此外 brand owner 顺序是 catalog→inventory→production，而 design call chain 是 catalog→organization→inventory→fulfillment-production；organization 只对目标 brand 做过一次 lookup，没有 source/闭包 owner judgment。外层 REQUIRED transaction 能回滚异常，但不能弥补“owner 根本不判断且不报错”。

**影响**：跨 scope 数据泄露；20/500 分母错误；复制预检显示可执行但执行后静默复用不兼容事实；BOM/标签引用指向错误对象；用户未选的配置被覆盖。

**最小修复**：source 必须由 organization owner 从当前 target session scope 唯一解析并验证，request 不得拥有 source authority。preflight 与 execute 共享一次完整 catalog+production+inventory typed graph algorithm；所有对象计入 closure/version/digest，owner 在写前按 precedence 复核 compatibility/rewrite/leak。local copy 只协调被选 section 对应 owner；未选 BOM 时 inventory command必须完全不调用。

### M-02｜P1 response component 与 runtime JSON 仍大面积不相容，co-owner read chain 实际未发生

**依据类型**：P1 edge/OpenAPI current byte 与当前源码逐字段对照。  
**路径/行**：`CatalogOwnerService.java:225-323,397-451`；`InventoryOwnerService.java:86-120,146-155`；`ProductionTagOwnerService.java:27-35`；`CatalogInventoryApplicationService.java:81-93`；`CatalogOwnerApi.java:7-18`、`InventoryOwnerApi.java:7-13`、`ProductionTagOwnerApi.java:7-12`。

P1 operation registry 将读响应直接绑定 `CatalogWorkbenchContext`、`CatalogNavigationView`、`CatalogItemPage`、`ProductionTagPage`、`InventoryTargetPage` 等 closed response component；runtime 多数方法却返回 `{revision,requestId,data:{...}}` envelope。以 `getOperationsCatalogItems` 为例，契约根 required 是 `items/total/cursor/generation`，源码 `:247-254` 返回 envelope，既缺根 required 又多三个 forbidden property。相同问题覆盖 workbench、navigation、dictionary、copy candidates、production tags、inventory list/history/ledger/diagnostics。

即便 root 恰好直接返回，field shape 仍漂移：

- item list 契约要求平铺 `skuEnabledCount/skuNonArchivedCount/skuTotalCount/skuDimensionSummary`，源码 `:427-434` 返回额外 `skuSummary` 且缺四个 required；
- catalog detail 的 coordinator `enrichInventory` 只接受 envelope.data（application `:82`），但 detail `:257-287` 返回 direct object，因此 inventory enrichment永远 no-op；fulfillment-production owner从未在 detail链调用，和 operation contract 的 4-owner/read count不符；
- inventory current `:94-106` 不调用 catalog owner，references `:154` 永远空，详情的商品名称/形态只是 itemCode/measureMode 回填；列表 `:146-148` 的 today/7d/30d 永远 0，即使 ledger有变化；
- `shapeManifest()`、command readback 也混合 direct/envelope 两套形状，没有 runtime schema validation捕获。

这证明 Round 1 的 generic JSON 风险不是抽象洁癖，而是已发生的 wire incompatibility。生成物当前确实只有 operation registry/digest、没有 server DTO；这解释了原因，不构成“edge typed mapping only”的豁免。

**影响**：P3 generated client无法解析关键列表/详情；库存六区与生产标签关联缺事实；正常路径 DB count与设计链不可能一致。

**最小修复**：为42 operation建立具体 request/response mapper或生成 server types，并在 edge返回前按 current OpenAPI component校验；删除自创 envelope。每个 read operation按 operation contract显式调用 coordinated owners并组装唯一 response shape；增加至少一条逐 operation response-schema test，不能只编译 registry。

### M-03｜VOIDED 与 problem/idempotency 只修了数据库外形，多个 owner 仍违反 terminal 与 exact problem semantics

**依据类型**：migration、operation exact problem set 与当前 command源码。  
**路径/行**：migration `:23-24,40,57,135`；`CatalogOwnerService.java:339-368,409-424,476-477`；`ProductionTagOwnerService.java:54-65`；`CatalogInventoryApplicationService.java:122-135`。

migration 已允许 `VOIDED`，shape closed check也正确；但可达命令仍分叉：

- `saveItem` 只排除 `ARCHIVED`，所以 `VOIDED` 商品仍可修改；detail/action readback对 VOIDED仍给 `canEdit=true/canVoid=true`；
- category/dictionary transition只允许 ENABLED/DISABLED，根本不能 VOID；update/reorder又没有 `status <> 'VOIDED'`，若数据已 VOIDED仍可改；
- production tag transition可直接 VOID，但 `voidAvailability` 的 blocking/dependent数组固定空，也不调用 catalog判断引用，因此 operation contract中的 `REFERENCE_BLOCKS_VOID/DEPENDENT_FACTS_BLOCK_VOID` 永远不会抛；
- catalog receipt mismatch仍抛不存在于 P1 problem vocabulary的 `IDEMPOTENCY_CONFLICT`（`:476`），而 contract要求 `IDEMPOTENCY_MISMATCH`；
- `releaseOperationsCatalogStagedAsset` 虽经 edge强制携带 key，application `:131-135` 完全丢弃 key，既无 asset-owner idempotent command也无 receipt/mismatch路径。

**影响**：C-17 的作废重建保护失效；复制判同编码可被作废后修改破坏；客户端无法按 P1 typed recovery处理错误；资产 release重试可能重复执行且无法判定请求漂移。

**最小修复**：所有 mutable command先读取生命周期并统一拒绝 VOIDED；所有 transition按各对象 contract实现 VOID和引用/依赖owner判断；actionAvailability由同一判断派生。problem code只取 operation exact set；catalog mismatch改为 `IDEMPOTENCY_MISMATCH`，asset release把 idempotency key交给asset owner并提供可重放readback。

### S-01｜关键 SKU/BOM/关系事实仍压在自由 JSON，typed owner不变量无落点

**依据类型**：migration/owner schema审查。  
**路径/行**：migration `:7-25,71-86,101-110`；`CatalogOwnerService.java:339-345,471-472`；`InventoryOwnerService.java:64-83`。

`catalog_item.sections`、`stock_target.configuration`、`stock_bom.rows` 继续承载 SKU、option、production refs、BOM row与消费单位；migration没有 SKU/option/商品-标签关系等 typed tables。当前 copy只靠字段名后缀扫描 JSON，引证了该设计会漏关系。描述性 attributes自由 map是批准项，但结构事实不是。

**影响**：owner内唯一性、code immutable、SKU fingerprint、BOM引用与消费单位不能由schema/typed repository守住；复制与查询只能猜JSON结构。

**最小修复**：保持 attributes自由map，其余结构事实拆成owner内typed table/value object；不建跨schema FK，但同owner约束、version与identity必须可机械验证。

### S-02｜checker 新增的是关键词存在检查，不是宣称的 copy/shape red mutation

**依据类型**：checker源码与self-test实跑。  
**路径/行**：`tools/catalog-inventory-p2/cli.mjs:31-49,59-97,109-119`。

正常检查仅用 `includes("STALE_COPY_PREFLIGHT")/includes("rewriteReferences")` 等关键词判定；self-test `:114-117` 也只是确认原文件包含关键词，并未制造删除/错序/错误 owner/错误 shape的变异。唯一真实 mutation仍是 `routes.operations.slice(0,-1)`，最终回显也只有 `RED_MUTATION=OPERATION_ROUTE_EXACT_SET`。因此 M-01..M-03 全存在时 checker仍 PASS。

**影响**：evidence所称“copy guards、generated shape binding真实 mutation”强于实际；future实现可留空方法或不可达分支照样绿。

**最小修复**：只为机械事实建门：source authority调用存在且raw source不可直达、四copy operation的owner call-set exact、response root/component mapper exact-set、runtime problem symbol属于operation集合。对每门真实修改解析输入并证明红；业务顺序与兼容性留给focused test/独立review。

### S-03｜P2 evidence未绑定当前源码，focused test PASS也不覆盖实现行为

**依据类型**：SHA-256重算 + 当前测试源码。  
**路径/行**：`doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p2-implementation-evidence-codex.json` 的 `artifacts/focusedTestResults`；五个新增测试文件。

evidence中的 catalog/inventory/production/coordinator/checker hash 全部与本轮 current byte不同；只有 controller/registry/migration匹配。checker不校验这些 evidence hash，所以仍 PASS。新增 module tests只验证七 shape、limit为正、两个 owner缺key会拒绝；没有实例化 service、没有数据库/mapper response、没有 copy、VOID、problem或读模型测试。registry test只编译，根app test因受管Testcontainers guard未执行，evidence对此诚实。

**影响**：当前 evidence不能证明被审查字节；`PASS_STATIC_IMPLEMENTATION_WITH_RUNTIME_DEFERRED` 的 focused-test范围易被误读成核心实现已验。

**最小修复**：冻结current byte后重算artifact hash并让package-exit checker做exact equality；把focused results准确命名为 vocabulary/idempotency-helper/registry compilation proof。核心behavior必须由真实owner integration test或明确 `NOT_RUN` 表示，不能以test-root存在替代。

### N-01｜generated route registry关闭了一处重复真相，但generic operation dispatch仍造成字符串扩散

**依据类型**：代码结构 judgement call。  
**路径/行**：controller `:40-62`；application `:25-78`；三个 owner API与service `read/write/copy` switch。

URI if/regex/switch已删除，这是实质改善。剩余 operationId字符串、ObjectNode字段与problem code仍在edge→coordinator→owner多层手拼，M-02/M-03正是其已发生后果。

**最小修复**：不要求P1重新生成42套DTO才能开始；可先在P2 app内建立每operation typed mapper/handler与sealed problem mapping，逐步消除generic dispatch，generated registry只负责route identity。

## 4. 已确认关闭与诚实 non-claim

- requested brand不再直接成为authority：store品牌从organization持久化事实得出；head-company requested brand经authorization表验证；
- advanced diagnostics只来自session capability，不读客户端diagnostic header；
- manual URI reverse dispatch删除，42 route由generated registry解析；
- runtime七shape绑定generated manifest，`PRODUCIBLE`只在capability；migration含VOIDED与shape check；
- inventory负库存守卫、inventory/production idempotency helper已存在；
- module unit tests本轮可执行PASS；三owner无显式跨schema DML、无MQ/outbox/internal HTTP；
- API proof明确 `DEFERRED_RUNTIME_PROOF`、business/cleanup均 `NOT_APPLICABLE_WITH_REASON`，没有把未获授权的HTTP/DB/100-case冒充PASS；这一点正确，不应为了review去运行环境。

## 5. Round final decision

本cycle已达到 `REVIEW_ROUND_LIMIT=2`，**禁止再召集第三轮**，也不得以改文件名/hash或换reviewer重置轮次。作者应按 `ROUND_FINAL_DECISION=SELF_DECIDED` 对本轮当前字节 findings逐项 disposition；三个M未关闭前P2不能作为P3可依赖后台。后续修复的验收由Dexter/Claude按package acceptance处理，或在产品/授权实质改变后建立新的、明确说明原因的review cycle。

## 6. 授权边界

本 `NO-GO` 仅覆盖 P2 backend implementation current-byte静态最终复核。它不授权implementation、P1 contract/generated wire、数据库或migration执行、seed/reset、DEV/UAT/L2、runtime部署或Git，也不把module unit/static checker PASS表述为业务环境PASS。
