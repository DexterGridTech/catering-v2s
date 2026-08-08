---
title: 商品目录与门店轻库存 P2 backend implementation 独立对抗审查 Round 1
REVIEW_CYCLE_ID: CATALOG-INVENTORY-P2-IMPLEMENTATION-20260806
REVIEW_TARGET: IMPLEMENTATION
REVIEW_ROUND: 1
REVIEW_ROUND_LIMIT: 2
reviewerKind: INDEPENDENT_SUBAGENT
verdict: NO-GO
findings: M=5 / S=2 / N=1
authorizationBoundary: 仅静态 P2 implementation 独立审查；不授权实现修改、契约/generated wire、数据库执行、seed/reset、DEV/UAT/L2、部署或 Git
createdAt: 2026-08-06
---

# P2 backend implementation 独立对抗审查 Round 1

## 0. 盲审声明、范围与输入

本轮由 fresh independent subagent 直接读取当前生产源码、P1 current byte、P2 operation design contract、共享 fixture/scenario、标准矩阵与 active package，以证伪为起点形成结论；未读取作者的 P2 自评或预设 verdict。没有执行 HTTP、数据库、seed/reset、DEV/UAT/L2 或部署，也未修改任何 implementation/runtime 字节。

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
| `contracts/policy/standards-coverage-matrix.json` | `3ccb1f7c1913e86a36fc6f39e3b1155478654a3cf41e5531d9bcbb79be2825a8` |
| `.runtime/compliance-control/active-package.json` | `d8b3af1fb674818980a144ef341bf5d85ab0894d5d8fa7321ed2430c43a0345f` |
| `OperationsCatalogInventoryController.java` | `6c3ed95d3fdad9f7b8cff9b06f86cc9d77f1c7c23cf681fd654f0541ed1e1f34` |
| `CatalogInventoryApplicationService.java` | `8ba56e66f18ec5a6a9dc5e1adee048fd79f5beea092a8bb8462361fe22c9ba08` |
| `CatalogOwnerService.java` | `daaf81790d0dee2be6ecb5f77b489001a910f18cbf86379eec08987a52813add` |
| `InventoryOwnerService.java` | `fe5c43eb85e474227eafdc74f229df232dfcdb7af7a7a70ee24def390d8dc7bf` |
| `ProductionTagOwnerService.java` | `2c75a7cae0a1bdb4c981b521b9af3b75e4faa3333d86ef221e1526ec0b0fb390` |
| `V20260806_120000_000__catalog_inventory_backend.sql` | `e4c668cb4750d791c34f8bfbb8cc20f8cd390e824ce1a9f925609291cc5ffa27` |

实跑结果：

- `scripts/check/catalog-inventory-p2`：`PASS`，回显 42 operations、26/100 API、18/43 L2；
- `scripts/check/catalog-inventory-p2 --self-test`：`PASS`，唯一红变异是删一条 route；
- `gradle :apps:backend:catering-business-server:compileJava`：`BUILD SUCCESSFUL`；
- 源码检索未找到引用 `CatalogOwnerService`、`InventoryOwnerService`、`ProductionTagOwnerService`、`CatalogInventoryApplicationService` 或 `OperationsCatalogInventoryController` 的 P2 test；也未找到 P2 implementation manifest、API proof 或 implementation evidence 文件。

## 1. 结论

**NO-GO — M=5 / S=2 / N=1。**

42 条 route 的静态 membership、模块编译、三 owner schema 没有显式跨 schema DML、20/500 从 policy 加载等外形成立；但实现没有忠实落地 P1 typed contract 与 P2 的 per-operation design contract。最严重的不是边角缺字段，而是客户端可自行声明品牌与高级诊断权限、edge/owner 全链路用 `ObjectNode/JsonNode + operationId` 绕过 generated wire、商品形态/生命周期/problem code 与 P1 closed set 不同、复制只复制 `catalog_item` 且完全没有兼容矩阵/引用重写/TOCTOU、100 个 API case 没有任何可执行测试或证据。

## 2. Findings

### M-01｜客户端 header 被当成品牌事实和高级诊断授权，形成直接 scope/权限提升

**轴**：Standards + Spec。  
**依据类型**：当前生产源码 + 项目 owner/session 红线。

`OperationsCatalogInventoryController.java:70-74` 在 trusted request attribute 缺失时回退读取客户端 `X-Workspace-Brand-Ref`；`:57` 更直接以 `X-Inventory-Advanced-Diagnostics:true` 作为高级诊断授权，`:58` 把该布尔值交给 application。任何已登录调用者都能伪造品牌，或自行打开本应“不授权则整区不渲染/接口拒绝”的高级诊断。这不是 display-only 问题，而是 owner 查询 scope 与敏感诊断读取的服务端授权依据被客户端控制。

**影响范围**：全部 42 条 operation 的品牌隔离；`getOperationsInventoryTargetDiagnostics` 的权限边界；门店/品牌之间的数据保密性。

**最小修复**：品牌只能来自经 workspace/session owner 验证并注入的 typed trusted context；attribute 缺失必须 fail closed，不得读 header。高级诊断必须由 workspace IAM capability 判断产生，不接受业务 header。增加两个负向 focused test：伪造品牌仍被拒绝、仅发送 diagnostics header 仍为 `SCOPE_FORBIDDEN`。

### M-02｜edge 与 owner 公共边界绕开 generated wire，42 条接口实际上是一个自由 JSON RPC

**轴**：Standards + Spec。  
**依据类型**：当前生产源码与 P1 OpenAPI/generated-wire 约束。

`OperationsCatalogInventoryController.java:37-49` 用三组聚合 mapping、`Map<String,String>`、`ObjectNode` body 和 `ResponseEntity<JsonNode>` 承接全部 42 条接口；`:77-168` 再通过 URI if/regex/switch 手工反推 operationId。三个 owner API 同样暴露 `read/write/copy(String operationId, ..., ObjectNode request)` 并返回 `JsonNode`。代码没有消费 P1 generated request/response 类型，也没有逐 operation controller method/wire mapper。

因此 OpenAPI 的 required、format、closed object、`additionalProperties:false`、typed problem response 都不在 Java 编译边界。route registry 也产生第二套手工真相：checker 只检查 controller 文本“包含 path 字符串”，不会证明 HTTP method、映射优先级、请求类型和响应类型匹配。

**影响范围**：42/42 operation；前后端契约一致性；未来 P3 codegen；审计 route identity。

**最小修复**：由 current P1 OpenAPI 生成/复用 typed server wire，每个 operation 绑定具体 request/response，edge 只做 trusted-context→typed owner command/query 映射；删除 URI 反向识别器和 owner 的 generic JSON dispatch。checker 对 generated interface implementation 与 operation exact-set 做机械检查，而不是字符串 contains。

### M-03｜运行时 closed vocabulary、生命周期和 problem code 与 P1 current byte 分叉

**轴**：Spec。  
**依据类型**：P1 manifest/operation contract 与当前源码逐项对照。

`CatalogOwnerTypes.java:9-12` 把七形态写成 `CATALOG_ITEM/SKU_ITEM/OPTION_ITEM/PACKAGE_ITEM/SERVICE_ITEM/BENEFIT_ITEM/PRODUCIBLE`，而 P1 manifest 的七个 shapeKey 是 `STANDARD_SALE_COUNTED/SKU_VARIANT_SALE_COUNTED/STANDARD_SALE_WEIGHED/MATERIAL/COMPOSITE/SERVICE/BENEFIT_SHELL`；`PRODUCIBLE` 是 usage capability 保留位，不是 shape。运行时 status 只有 `DRAFT/ENABLED/DISABLED/ARCHIVED`，migration `:23` 也固化同一集合，没有 C-17 要求的终态 `VOIDED`。

同一分叉扩散到错误：create duplicate 抛 `CODE_CONFLICT`，shape 抛 `SHAPE_NOT_ALLOWED`，copy source 抛 `COPY_SOURCE_NOT_FOUND`，而 operation contract 要求 `DUPLICATE_CODE`、`VALIDATION_ERROR/NOT_FOUND` 等 exact set。`shapeManifest()` 还返回 `manifestDigest="P1-MANIFEST-BOUND"` 和空的 mode/shape/field rules，不是 P1 manifest 的真实 digest/内容。controller 的 `Idempotency-Key` 又是 `required=false`，owner 在空 key 时直接执行，违反 26 条写 operation 的必填 header 与 idempotency semantics。

**影响范围**：创建商品会拒绝全部合法 shape 并接受非法 shape；VOID 语义、复制判同、P3 形态渲染、typed recovery 和 26 条写接口幂等全部不可依赖。

**最小修复**：运行时 vocabulary/manifest/problem code 只从 current P1 generated artifacts 消费，不再手抄；实现 `VOIDED` terminal 及引用/依赖阻断；edge 强制 write idempotency header，owner 对缺失、重放、payload mismatch、结果未知按 operation contract 返回 exact typed problem。

### M-04｜复制链只复制 catalog_item，闭包、九类兼容、引用重写与 TOCTOU 均未实现

**轴**：Spec。  
**依据类型**：当前 `CatalogOwnerService.copy/closure/copyPreflight` 与 P2 operation 27/28 设计对照。

`CatalogOwnerService.java:83-108` 的 execute 只循环 `INSERT catalog.catalog_item ... ON CONFLICT DO NOTHING`。`:231-242` preflight 把所有行标为 `REUSE_OR_CREATE`，`blockingCount` 永远 0，`mappingPreview/compatibilityResults/referenceRewritePreview` 永远空；`:251-252` 仅递归扫描商品 `sections` 内字段名以 `Code/ItemCode` 结尾的字符串。分类、销售单位、SKU 属性和值、SKU、生产标签、StockTarget、BOM 都不进入闭包，也没有逐类映射与全图引用重写。

execute 不重算/比对 preflightDigest 或任何 source/target version；甚至在未提供 digest 时自行生成，在提供时原样回显，所以 `STALE_COPY_PREFLIGHT` 不可能抛出。它也没有消耗单位/SKU fingerprint/结构兼容判断，没有调用 inventory/fulfillment-production owner；`CatalogInventoryApplicationService.java:62-66` 直接把 local/brand copy 都委托给 catalog owner。operation 27 声明的 3 owner、operation 28 的 22 DB 次与 12 类 problem condition 因此没有落地。

**影响范围**：复制会产生缺依赖/错引用数据；同编码不兼容对象被静默复用；源或目标在预检后变化仍执行；品牌复制不满足“同一 REQUIRED 事务内各 owner 自复核”。这是数据损坏路径。

**最小修复**：按唯一闭包目录实现 set-wise、可停止的多类型闭包，20/500 在完整对象分母上检查；preflight 返回完整对象/边/version/mapping/compatibility/rewrite/digest；execute 在同一 REQUIRED transaction 内按设计顺序调用 catalog→production→inventory owner，各 owner 复核版本/兼容与引用，漂移抛 `STALE_COPY_PREFLIGHT`，任何失败整体回滚。用 canonical fixtures 覆盖两个 limit、18 compatibility case、单位/SKU fingerprint、reference leak、owner 中途失败和 replay。

### M-05｜核心读写语义大量占位，且“26/100 API”只有目录计数、没有一条接口测试或运行证据

**轴**：Spec。  
**依据类型**：生产源码、测试源码检索、checker/evidence 实验。

代表性缺口不是 UI 延后项：

- `CatalogOwnerService.detail()` 返回的 root 没有 revision/requestId envelope；固定七 tab，缺 SKU/套餐差异；引用、生产标签、治理大多空；
- navigation 的六个 smart view count 全为 0；列表忽略 IA/P1 的分类上下文与 cursor；
- `InventoryOwnerService.current()` 通过内部再次调用 summary+ledger，ledger 被查两次，references 固定空，diagnostics 是空数组；change summary 为 COUNT + 全量 SELECT delta 后在 Java 聚合，不符合设计的 set-based 2 DB；
- inventory 三类写没有 idempotency receipt，允许减成负库存，也未实现 `NEGATIVE_STOCK_NOT_ALLOWED`；production owner 同样不做 idempotency，使用错误 problem code；
- save 只保存一个自由 `sections` JSON，最多协调现有 target configuration，没有创建/维护 SKU、StockTarget、BOM、生产标签引用或 asset bind；
- 资产 stage 接受 JSON base64 `content`，而 P1 是真实 binary/multipart 路径，且资产写也未接幂等。

仓内没有任何 P2 service/controller test；也没有 P2 implementation manifest、API proof、implementation evidence。`scripts/check/catalog-inventory-p2` 仅读取 scenario 的声明数字 `26/100`，并不加载 fixture、调用 owner/controller 或断言业务结果。因此当前不能声称第二阶段“后台接口测试全绿”，连静态 focused behavior proof 都不存在。

**影响范围**：workbench、列表、详情、库存六区、四库存动作、资产、标签及 100 个 API case；P3 没有可依赖后台。

**最小修复**：以 42 operation design contract 的 logicSteps/conditionToProblem/callChain/DB count 为逐条分母实现 typed behavior；用同一 fixture catalog 写真实 owner/controller integration tests，至少执行 26/100 API cases，并输出 case-level result、设计 DB count vs measured count、business 与 cleanup 分账。缺少运行授权时只能诚实保持 P2 未闭合，不能以静态目录计数替代。

### S-01｜迁移把复杂 owner 事实压进自由 JSON，数据库无法守住关键不变量

**轴**：Standards + Spec。  
**依据类型**：migration 与需求模型对照。

`catalog_item.sections`、`stock_target.configuration`、`stock_bom.rows` 以 JSONB 承载 SKU、BOM、配置等关键事实；没有 SKU、option group/value、商品-标签关系、BOM row 的 typed owner tables/constraints，也没有 shapeKey closed check。编码不可修改、tuple 唯一、BOM 引用完整、消费单位、VOID immutable 等规则只能依赖 generic service JSON，当前服务又没有实现。

**影响范围**：商品真实模型、复制判同与引用重写、库存/BOM 一致性、未来查询效率。

**最小修复**：自由 map 只保留批准的描述属性；SKU、字典关系、标签关联、StockTarget、BOM header/row、版本与生命周期使用 owner typed tables/constraints。不要建立跨 schema FK，但 owner 内同 schema 约束应守住不变量。

### S-02｜P2 checker/evidence 的证明范围被表述成实现闭环，且唯一 red 与主要风险无关

**轴**：Standards。  
**依据类型**：checker 源码与 mutation 实跑。

checker 对每条 operation 只检查设计字段非空，对 controller 只查 path 字符串存在，对场景只查顶层 `scenarioCount/caseCount`，对 owner 只查目录存在、无显式跨 schema DML、源码里无 20/500 字面量。唯一 self-test 删除一条 route。它没有核对 generated typed wire、trusted scope、problem exact-set 的实现、copy owner chain、fixture execution、DB observed count、idempotency或读模型字段，因此在 M-01..M-05 全部存在时仍 PASS。

**最小修复**：保留 route exact-set gate，但补一行可说清的结构门与真实红变异：禁止 controller/owner generic JSON dispatch、禁止客户端 scope/capability header、runtime vocabulary exact-set、operation problem symbols subset/exact coverage、required test/evidence paths与 case result exact-set。业务正确性继续由独立审查和真实 API tests 判断，不用关键词冒充语义门。

### N-01｜单文件 generic dispatch 造成重复 switch/字符串和 shotgun surgery 风险

**轴**：Standards（judgement call）。  
**依据类型**：Fowler smell baseline + 当前代码。

42 operation 的 route、owner selection、problem、request field 都靠字符串在 controller、application、owner、registry、design contract 多处重复；controller 有 if/regex/switch 三层 route 判定。这是 Primitive Obsession、Repeated Switches 与 Shotgun Surgery 的组合，已经实际造成 shape/problem/route 语义漂移。

**最小修复**：M-02 修复时按 operation typed handler + owner command/query 分解；generated registry 只做观测/审计映射，不参与第二次业务路由。

## 3. 已确认成立、不应返工

- route registry 与 operation design 当前均为 42 个唯一 operation，静态 exact-set 成立；
- catalog/inventory/fulfillment-production 三个 owner module 与单一 Flyway migration 已建立；
- owner 源码未发现显式跨 owner schema DML，application 使用 owner API 协调的方向成立；
- 20/500 runtime 由 module resource 声明绑定 contract policy，不是 owner Java 魔法数字；
- migration 没有创建跨 schema FK、MQ、outbox、internal HTTP client；
- backend 当前字节可通过 Java 编译；
- RequestCompletion diagnostic 底座已有 `databaseOperationCount/databaseDurationMillis`，具备后续按 operation 对账设计 DB 次数的基础。

## 4. Package-exit 与下一步

本轮不接受以 `CATALOG_INVENTORY_P2_STATIC=PASS` 关闭 P2。建议修复顺序：

1. 先堵 M-01 可信 scope/capability 漏洞；
2. 以 generated typed wire 重建 edge/owner 边界，并一次性收口 vocabulary/problem/idempotency（M-02/M-03）；
3. 完整实现 copy 多 owner chain（M-04）；
4. 逐 operation 落地真实 read/write behavior 与 100 个 API case（M-05）；
5. 最后扩展 checker 和 package evidence，证明实际字节而非声明计数。

同一 review cycle 仍可在 remediation 后进行 **Round 2 定向复核**，届时应核验上述 M/S 的 current-byte 关闭证据；Round 2 后按 `REVIEW_ROUND_LIMIT=2` 停止，不得用更名或换 reviewer 重置轮次。

## 5. 授权边界

本 `NO-GO` 仅覆盖 P2 backend implementation 的静态独立审查。它不授权 implementation 修改、OpenAPI/契约/generated wire、数据库或 migration 执行、seed/reset、DEV/UAT/L2、runtime 部署或 Git；也不把 compile/static checker PASS 表述为业务或环境 PASS。
