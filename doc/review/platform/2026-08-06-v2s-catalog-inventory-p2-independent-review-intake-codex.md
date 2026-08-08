---
title: 商品目录与门店轻库存 P2 Round 1 findings intake
REVIEW_CYCLE_ID: CATALOG-INVENTORY-P2-IMPLEMENTATION-20260806
REVIEW_TARGET: IMPLEMENTATION
REVIEW_ROUND: 1
REVIEW_ROUND_LIMIT: 2
reviewerKind: AUTHOR_INTAKE_AFTER_INDEPENDENT_REVIEW
sourceReview: doc/review/platform/2026-08-06-v2s-catalog-inventory-p2-independent-review-codex.md
---

# Findings disposition

本文件只记录独立 Round 1 findings 的逐条复核、适用边界与最小修复，不替代 Round 2 独立 verdict。
每条先重开 owning source、P1 current byte、P2 operation design contract 与实际源码；未把静态 checker PASS 当作业务闭环。

| finding | disposition | evidence / boundary | remediation |
|---|---|---|---|
| M-01 client brand/diagnostic headers | `CONFIRMED_CLOSED` | `CatalogScopeLookup.requireCatalogBrand(...)` 是 organization owner 判定；diagnostic 只读取 session capability `READ_INVENTORY_ADVANCED_DIAGNOSTICS`；业务 header 不再产生权限事实。 | edge 使用 trusted session scope + owner judgment；P2 checker 检查 owner call、无 diagnostic header、写请求幂等守卫。 |
| M-02 generic JSON/RPC boundary | `PARTIALLY_CONFIRMED_CLOSED_WITH_EVIDENCE` | P1 `CatalogInventoryEdgeWire` 的生成形状是 operation registry + coverage/field digest，不是 42 套 server DTO；该既定生成边界由 P1 current-byte recheck N-03 复核。原手工 URI 反向 dispatch 已删除，edge 只经 `CatalogInventoryOperationRegistry` 解析生成 registry；owner API 仍以 JSON 节点承载契约内容，字段形状由 P1 OpenAPI、owner readback builders 与 static denominator 约束。若后续 Dexter 要求 generated server DTO，这是新范围决策，不在本 P2 静态包内自行扩设计。 | 通过生成 registry resolver、operation exact-set 机械门与 focused resolver test 降低漂移；保留为后续 implementation/L2 review 的重点，而非伪称完全 typed server wire。 |
| M-03 runtime vocabulary/status/problem/idempotency drift | `CONFIRMED_CLOSED` | `CatalogOwnerTypes` 绑定 generated `SHAPE_KEYS`/capabilities；migration 与 owner 支持 `VOIDED`；problem codes 对齐 P1 operation registry；edge 对所有非 GET 强制 `Idempotency-Key`。shape manifest 直接从 generated manifest digest/JSON 读。 | 加入 checker 绑定、catalog shape focused test、module tests；Round 2 需重新核对当前字节。 |
| M-04 copy closure/compatibility/rewrite/TOCTOU/multi-owner | `CONFIRMED_CLOSED_FOR_STATIC_IMPLEMENTATION` | brand copy 有 selected/closure limits、typed preflight counts、mapping/compatibility/rewrite preview、source/target expected versions + digest、execute stale rejection；catalog execute 同事务协调 inventory 与 fulfillment-production owner。local copy 单独处理 source/target item 与 selected sections，只协调 inventory。 | 加入闭包/兼容/TOCTOU guard 与 checker；真实 API/L2 尚未获授权，不能把本条写成 runtime PASS。 |
| M-05 placeholder behavior / no API evidence | `PARTIALLY_CONFIRMED_CLOSED_STATIC_ONLY` | owner 读写 readback 已补齐主要 P1 required fields、inventory set-based summary、idempotency/negative-stock guards、asset digest and owner coordination；catalog/inventory/production focused unit tests与generated registry test已编译。受 `runtimeAuthority=false` 且本轮不授权 DEV/UAT/L2，不能执行 100 API cases，也不声称 business PASS。 | 输出 API proof 明确 `NOT_APPLICABLE_WITH_REASON`；Round 2 只核 current byte/static evidence，后续受管 runtime 包再执行共享 fixture。 |
| S-01 complex JSON facts | `PARTIALLY_CONFIRMED` | 本 P2 migration 保留已批准自由 map/sections 载体，尚未新增 SKU/option/BOM row 全 typed relational tables；这是实现债务，不能由静态编译掩盖。 | 记录为后续 owner/schema hardening 输入；不在本包临时引入第二套事实或破坏 P1 contract。 |
| S-02 checker false-green | `CONFIRMED_CLOSED_FOR_STATIC_GATES` | checker 已加入 trusted brand/diagnostic、generated operation registry、manual URI dispatch absence、runtime vocabulary、copy guards、owner guards、test roots；self-test 同时以 route-set、copy guard、generated shape binding 真实 mutation 断言。 | 业务语义仍由 Round 2 独立审查与受管 API proof 判断；不将 checker 结果写成业务 PASS。 |
| N-01 repeated generic dispatch | `CONFIRMED_CLOSED` | route if/regex/switch 已移除；生成 operation registry 是唯一 edge route resolver，application 仍按 operation exact-set 调 owner boundary。 | Round 2 检查 generated registry 与 operation design exact-set。 |

## Explicit non-claims

- 本轮没有修改 P1 OpenAPI、policy、generated contract artifacts。
- 没有执行 Flyway、seed/reset、DEV/UAT、HTTP/L2 或 runtime deployment。
- `scripts/check/openapi-contracts` 的 110 个 unresolved references 与 `scripts/check/contract-face` 的历史 duplicate operation identity 是既有基线失败，不能改写成 P2 PASS；P2 evidence 单独列出。
- source/target DB operation count 目前只有详设声明，未在 runtime 观测中对账；运行授权后由 `RequestCompletionEvent` 做逐 operation 设计值 vs 实测值对账。

## Post-round2 author remediation (2026-08-06)

Round 2 的独立最终报告仍保留为本 cycle 的 `NO-GO` 历史记录；依据 review-cycle 两轮上限，本会话不再召集第三轮独立子 agent。以下仅记录作者在 Round 2 之后对 owning source 的实际修复，交由 Dexter 与 Claude 重新核验当前字节，不把作者自检冒充独立 verdict：

| Round 2 finding | 当前处置 | 代码证据 | 边界 |
|---|---|---|---|
| M-01 copy source / co-owner preflight / TOCTOU | `REMEDIATED_AWAITING_INDEPENDENT_REVIEW` | `CatalogScopeLookup.resolveCatalogCopySource`；品牌候选、预检与执行均由 organization owner 校验来源；application 合并 catalog/inventory/production digest 与版本，并在 owner command 内复核。 | 未执行 HTTP、数据库或 L2；需复核 `CatalogInventoryApplicationService` 的异常顺序与完整响应。 |
| M-02 read model shape / owner task reads | `REMEDIATED_AWAITING_INDEPENDENT_REVIEW` | catalog detail 直接根形状兼容；inventory list/detail 与 catalog task join；production tags 在 detail 读取 owner 名称；复制预检 owner 数组按 OpenAPI 项目形状收敛。 | P1 的重复 schema 行与 generated edge registry 不是本包重生成；OpenAPI baseline failures 仍保留。 |
| M-03 VOIDED / idempotency | `REMEDIATED_AWAITING_INDEPENDENT_REVIEW` | item/category/dictionary 的 VOIDED 进入前分别检查 inbound reference/dependent facts；production tag VOIDED 受 catalog owner 引用判断；asset release 使用命令 receipt；owner commands 拒绝 VOIDED 修改。 | 真实状态迁移、幂等重放与媒体 cleanup 仍属后续受管 runtime 证明。 |
| S-01 JSON facts | `OPEN_NONBLOCKING` | 仍沿用需求批准的 sections/free-map 载体；本轮未另造平行事实模型。 | 需 Dexter 另行决定是否进入 schema hardening，不在本 P2 偷改。 |
| S-02/S-03 checker/evidence | `REMEDIATED_STATIC` | P2 checker 增加来源解析、co-owner preflight、terminal guard、task-read enrichment 的机械存在性检查，并加入 authority/co-owner red mutations；证据哈希已按当前字节重建。 | 机器门不替代语义 review；需 Claude/Dexter fresh implementation review。 |

## Claude review disposition (2026-08-06)

Claude 的 `doc/review/platform/2026-08-06-v2s-catalog-inventory-p2-implementation-review-claude.md` 保持不可变；以下是作者对当前字节的独立核实与修复，不把作者验证冒充 Claude verdict。

| finding | disposition | owning-source 核实 | 最小修复与边界 |
|---|---|---|---|
| M-01 brand copy source authority | `PARTIALLY_CONFIRMED_CLOSED` | edge 原已有 organization source judgment，但 application 仍直接读取请求 `sourceDataNodeRef`；这留下了 owner API 被直接调用时的第二入口。 | controller 对品牌预检/执行只注入 organization-resolved internal source；application 再次调用 `CatalogScopeLookup.resolveCatalogCopySource` 并覆盖请求来源。候选 GET 仍由 edge 解析 `sourceDataNodeRef`。不涉及契约或 runtime。 |
| M-02 asset multipart contract | `CONFIRMED_CLOSED_STATIC` | OpenAPI 的 `stageOperationsCatalogAsset` requestBody 是 `multipart/form-data`，原实现是 JSON/base64；差异属真实契约违规。 | 新增专用 multipart edge mapping，直接把 `MultipartFile` bytes 交给 `stageContent`；JSON dispatch 对该 operation fail-closed。未改 OpenAPI/generated，未执行 HTTP/asset runtime。 |
| M-03 catalog copy closure coverage | `CONFIRMED_CLOSED_STATIC` | 原品牌复制只写 `catalog_item`；分类与 generic dictionary rows 没有进入 closure/preflight/execute。 | catalog owner 增加 `CatalogClosure` typed graph：分类、标签、销售单位、SKU 属性/值按编码去重进入 closure；写入已有 `catalog_category`/`dictionary_entry`，预检返回 object/edge/version/mapping/rewrite。inventory 与 production 仍由各自 owner 处理。 |
| S-01 OWNER_REFERENCE_LEAK | `CONFIRMED_CLOSED_STATIC` | 原设计声明了该 problemCode，但无实现；恒等 code mapping 不能替代 owner-ref 断言。 | brand copy 写入前后增加 mapping completeness 与目标图 owner-ref 断言，缺失统一抛 typed `OWNER_REFERENCE_LEAK`。未宣称运行时闭环。 |
| S-02 suffix-based reference scan | `CONFIRMED_CLOSED_STATIC` | 原 `collectReferences` 将所有 `*Code/*ItemCode` 当商品引用，且 `referenceKind` 固定；会漏字典并误收业务字段。 | 改为有限 key→typed referenceKind extractor 与 typed rewrite；字典引用按 owner kind 解析，取消 suffix fallback；预检逐类返回 closure edge/rewrite。 |
| N-01 normal DB count comparison | `UNVERIFIED_REQUIRES_EVIDENCE` | Claude 未逐 operation 实测，当前也无 runtime authority；不能把静态读码当作 count 对账。 | 保留 42 operation 详设声明，证据明确延后到受管 API 阶段用 `RequestCompletionEvent.databaseOperationCount` 对账；本次不新增伪静态结论。 |

### Generalized prevention set

| failure family | finite applicability denominator | root layer | primary prevention destination |
|---|---|---|---|
| client-controlled cross-owner copy authority | brand candidates + brand preflight + brand execute = 3 edge paths；application brand dispatch = 1 owner boundary | edge/coordinator authority layering | existing P2 checker + review checklist；checker requires organization resolver in edge/application and no application request source field |
| transport shape drift | asset stage = 1 multipart operation | edge binding | existing P2 checker；multipart mapping presence and base64 branch absence with red mutation |
| catalog closure under-expansion | brand/local copy = 4 operations；catalog-owned object kinds = item/category/tag/sales-unit/SKU-attribute/SKU-attribute-value | owner graph algorithm | typed `CatalogClosure` + checker requiring graph/typed extractor/category+dictionary writes; semantic closure remains review/API evidence |
| owner-reference leak and untyped references | brand preflight/execute = 2 paths；all approved outbound edge kinds | copy safety invariant | typed reference extractor + `OWNER_REFERENCE_LEAK` assertion + checker red mutation |
| normal-path DB drift | 42 operation design rows | runtime evidence layer | `PER_OPERATION_DESIGN_CONTRACT` runtime comparison; explicitly not a universal SQL gate |

## Current-byte recheck boundary

本次修复后重新绑定的 current artifacts 必须由 Claude 重新核验；历史 Round 1/Round 2 independent-subagent verdict 不改写，也不再召集同一 cycle 的第三轮内部 reviewer。P2 仍不主张 OpenAPI baseline、Flyway execution、seed/reset、DEV/UAT/HTTP/L2、runtime 或 cleanup PASS。

## Claude NO-GO disposition and POST_REMEDIATION binding (2026-08-06)

Claude 的 `doc/review/platform/2026-08-06-v2s-catalog-inventory-p2-implementation-review-claude.md` 保持不可变；以下处置只绑定当前 remediation bytes，不能升级历史 verdict，也不能把静态证据写成 runtime PASS。

| finding | disposition | owning-source 核实 | 最小修复与边界 |
|---|---|---|---|
| M-01 brand copy source authority | `PARTIALLY_CONFIRMED_CLOSED` | edge 原已有 organization owner 判断，但 application 仍接受请求 `sourceDataNodeRef` 作为第二入口，故 finding 的边界风险真实存在。 | `OperationsCatalogInventoryController` 与 `CatalogInventoryApplicationService` 的品牌预检/执行均调用 `CatalogScopeLookup.resolveCatalogCopySource`，以 organization 事实覆盖客户端来源；候选读取仍由 edge 解析。未改契约或 runtime。 |
| M-02 asset multipart contract | `CONFIRMED_CLOSED_STATIC` | OpenAPI 明确要求 `multipart/form-data`，旧实现读取 JSON `content` 并 Base64 解码，属真实 transport shape drift。 | 增加专用 multipart edge mapping，直接把 `MultipartFile` bytes 交给 asset owner；JSON dispatch 对该 operation fail-closed，并移除 generic JSON route。未改 OpenAPI/generated，未执行 HTTP/asset runtime。 |
| M-03 catalog copy closure coverage | `CONFIRMED_CLOSED_STATIC` | 旧品牌复制只写 `catalog.catalog_item`，未将 catalog category 与 dictionary entry 纳入 closure/preflight/execute。 | catalog owner 使用 `CatalogClosure` typed graph，按编码纳入分类、标签、销售单位、SKU 属性/值，写入既有 category/dictionary 表，并返回 object/version/mapping/rewrite 预览；inventory 与 production 仍归各自 owner。 |
| S-01 OWNER_REFERENCE_LEAK | `CONFIRMED_CLOSED_STATIC` | 设计声明了该 problem code，旧实现没有 owner-reference 断言；恒等编码映射不能证明边界安全。 | catalog、inventory、fulfillment-production 三个 copy owner 都在写前/写后或目标 scope readback 处执行 owner-reference 断言，缺失统一抛 `OWNER_REFERENCE_LEAK`。未宣称运行时闭环。 |
| S-02 suffix-based reference scan | `CONFIRMED_CLOSED_STATIC` | 旧实现用 `*Code/*ItemCode` 后缀猜引用种类，既会误收业务字段又会漏字典 kind。 | 改为有限 key→typed referenceKind extractor，按 typed key 加载字典并只重写声明的引用；取消后缀 fallback。 |
| D-16 SKU structure fingerprint | `CONFIRMED_CLOSED_STATIC` | 需求稿 §5.9 D-16 与详设 §3.6.2 明确商品兼容除形态外还必须比较 `skuCode -> sorted(attributeCode,valueCode)`；旧实现只比较形态/消耗单位。 | catalog owner 统一计算稳定 SKU 结构指纹，预检兼容判定与 `preflightDigest` 同时绑定，focused test 覆盖顺序稳定与结构变化阻断。 |
| N-01 normal-path DB count comparison | `UNVERIFIED_REQUIRES_EVIDENCE` | 本轮没有 runtime authority，Claude 也未逐 operation 实测；静态读码不能替代 42 条设计声明与 `RequestCompletionEvent` 的观测对账。 | 延后到获批 API/runtime package，使用共享 fixture 实测 `databaseOperationCount` 与设计值，并单独记录偏差；本包不新增伪静态门。 |

### Generalized prevention set

| failure family | finite applicability denominator | root layer | prevention |
|---|---|---|---|
| client-controlled cross-owner authority | brand candidates + preflight + execute = 3 edge paths；application brand dispatch = 1 boundary | edge/coordinator authority layering | P2 checker 要求 organization resolver 与 application owner re-resolution，并以 red mutation 验证调用存在。 |
| transport shape drift | asset stage = 1 multipart operation | edge binding | P2 checker 检查 multipart mapping、generic JSON route 缺失及 Base64 分支缺失。 |
| closure under-expansion | brand/local copy = 4 operations；catalog kinds = item/category/tag/sales-unit/SKU-attribute/SKU-attribute-value | owner graph algorithm | `CatalogClosure` typed graph + category/dictionary writes + checker；商品 SKU 结构指纹进入兼容与 digest；语义闭包仍需 Claude/API evidence。 |
| owner-reference leak and untyped refs | brand preflight/execute = 2 paths；批准 outbound reference kinds finite | copy invariant | typed extractor、`OWNER_REFERENCE_LEAK` pre/post assertion 与 red mutation。 |
| normal-path DB drift | 42 operation design rows | runtime evidence | `PER_OPERATION_DESIGN_CONTRACT` runtime comparison；不是通用 SQL 计数上限。 |

### POST_REMEDIATION boundary

当前源码与 checker 哈希已更新到本轮 remediation evidence；Claude NO-GO 原文与本 cycle Round 1/Round 2 verdict 均保留。此处不宣称 OpenAPI baseline、generated regeneration、Flyway execution、seed/reset、DEV/UAT/HTTP/L2、runtime 或 cleanup PASS；请 Claude 对当前字节做新的独立 implementation recheck。

## Claude current-byte NO-GO disposition (2026-08-06)

Claude 的 current-byte 复核报告继续保持不可变；本节只记录作者对 M-04、S-03、S-04、N-02 的 owning-source 重开、最小修复与静态证据，不把未执行的应用测试或 runtime 结果写成 PASS。

| finding | disposition | owning-source 核实 | 最小修复与边界 |
|---|---|---|---|
| M-04 checker 对复制来源权威是假绿 | `CONFIRMED_CLOSED_STATIC` | P2 checker 原先用 `.includes()` 证明 `resolveBrandCopySource` 字符串存在，伪造 request source 的行为变异可保持绿；这不能证明 owner authority。 | 移除该行为性文本断言，新增 `CatalogCopySourceAuthorityTest`：伪造 `sourceDataNodeRef` 时断言返回 organization `resolveCatalogCopySource` 的值；checker 只检查 focused test 存在，结构/漂移变异继续保留。`p2RedMutationSelfTest` 改为明确的 `STRUCTURAL_AND_DRIFT_ONLY`。不进入 runtime。 |
| S-03 dictionaryKind 子串推断与开放域 | `CONFIRMED_CLOSED_STATIC` | `dictionaryKindMatches` 与 `DictionaryRow.objectType` 原使用 `contains`，未知值会被兜底为 `SKU_ATTRIBUTE`；契约、migration 与 create 端均未形成闭集。 | 在既有 `catalog-inventory-copy-policy` 中声明四值闭集 `TAG/SALES_UNIT/SKU_ATTRIBUTE/SKU_ATTRIBUTE_VALUE`，runtime resource 同步；create/read/update/reorder/transition 统一 exact validation，object type 改为 exact switch，未知值抛 `VALIDATION_ERROR`；新增 `CatalogDictionaryKindTest` 与 policy focused assertions。不新增表、不改 OpenAPI。 |
| S-04 multipart 超限逃逸契约信封 | `CONFIRMED_CLOSED_STATIC` | 应用无显式 multipart 限制，Spring 默认 1MB；`MaxUploadSizeExceededException` 原无契约 advice。媒体 owner 的图片上限已是 5MB。 | `application.yaml` 显式配置 5MB 单文件/6MB 请求上限，媒体策略登记同一字节口径；`ContractProblemAdvice` 捕获超限并返回已声明的 `VALIDATION_ERROR` problem envelope；现有 advice focused test 增加映射断言。未执行 HTTP。 |
| N-02 `_resolvedCatalogCopySource` 只写不读 | `CONFIRMED_CLOSED_STATIC` | controller/application 各写一次，全仓无生产读取点；它不是第二权威入口但会误导后续实现。 | 删除两个生产写入点，保留 organization resolver 的 guard 与 application owner re-resolution；focused test 断言该死标记不再进入 request。 |

### Current-round generalized prevention set

| failure family | finite applicability denominator | root layer | prevention |
|---|---|---|---|
| 行为安全被文本 checker 冒充 | brand copy authority = 1 application resolver behavior | checker design | 真实行为由 focused unit test 证明；checker 只绑定测试存在性，禁止将字符串存在当行为证据。 |
| 字典类型域漂移/子串猜测 | 4 dictionary kinds；catalog read/write dictionary operations = 5 | owner vocabulary | 既有 policy 单一声明点 + runtime mirror + exact switch/validation + unknown-kind focused red test。 |
| multipart 边界与 problem envelope 脱节 | asset stage = 1 operation；file/request = 2 limits | edge/config | media policy、Spring config 与 advice 三方值/错误码静态绑定，advice unit test 证明 422 envelope。 |
| 死的中间 authority marker | brand preflight/execute = 2 edge paths + 1 application resolver | request lifecycle | 生产 request 不携带未消费的 internal marker；checker 对 marker 零命中，focused test 断言。 |

### Current-round boundary

本轮只更新 P2 implementation/static bytes、既有策略、应用配置、focused tests、checker 与 evidence；没有 OpenAPI/generated regeneration、Flyway execution、seed/reset、DEV/UAT/HTTP/L2、runtime deployment 或 cleanup。`N-03 normalPathDbOperationDeclarations` 仍为 `UNVERIFIED_REQUIRES_EVIDENCE`，留待后续受管 API/runtime package。
