# 商品条码与标识、制作信息优化 implementation-facing design

> `PARTIALLY_SUPERSEDED_BY`：`doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-implementation-design-codex.md#11e`。
> 生产标签契约、owner、关系表唯一约束、迁移及测试计划以新详设为准；本文件不得作为恢复标签数组或嵌套标签字段的依据。

<a id="catalog-identification-production-guidance-implementation-design"></a>

## 0 · 元数据与授权边界

```text
BUSINESS_SOURCE=doc/plans/platform/2026-08-23-v2s-catalog-identification-production-guidance-formal-requirements-codex.md#catalog-identification-production-guidance-formal-requirements
JOURNEY_REFS=doc/decisions/2026-08-23-v2s-catalog-identification-production-guidance-journey.md#catalog-identification-production-guidance-journey
IA_REF=doc/plans/platform/2026-08-23-v2s-catalog-identification-production-guidance-information-architecture-codex.md#catalog-identification-production-guidance-information-architecture
INTERACTION_REF=doc/decisions/2026-08-23-v2s-catalog-identification-production-guidance-ui-interaction.md#ui-detailed-design-admission
WIREFRAME_REF=doc/plans/platform/wireframes/2026-08-23-v2s-catalog-identification-production-guidance.svg
DEXTER_WIREFRAME_REVIEW=ACCEPTED@2026-08-23
AUTHORIZED=正式需求、Journey、交互、IA、implementation-facing design、串行计划、设计期独立复核与 CP-00..CP-12 实施（共 13 个 CP）
NOT_AUTHORIZED=真实 migration 执行、DEV start/restart、reset、seed 执行、browser L2、UAT、部署、数据操作、Git
IMPLEMENTATION_AUTHORITY=true
IMPLEMENTATION_AUTHORIZATION=DEXTER_CIPG_DESIGN_GO_CP00_CP13_20260823
```

本文的约束分层是本批实施不变量：generated contract/manifest 只声明机器可消费的结构与约束；operations-admin 拥有用户能理解的业务语言、布局和交互；owner 在事务内重新派生并复核事实。隐藏控件、前端校验和中文文案都不能替代 contract/owner 防线。

## 1 · 真实业务目标与方案比较

### 1.1 结构性问题

当前商品识别存在商品 `kind/code/value` 自由三元组与 SKU 单值 `skuBarcode` 两套模型，既不能稳定唯一反查，也不能证明识别值属于商品还是具体规格。当前制作信息以三个无目标身份的 generic JSON map 表达，SKU 与选项值事实无法绑定具体对象，自由标签、打印、过敏原和 `materialRole` 又混入同一容器。继续沿用会让 contract、owner、数据库和界面分别猜测归属，并让界面暴露 `SKU/profile/source/ref/problem code` 等实现词汇，用户仍无法回答“这个码识别谁”和“这项制作变化属于谁”。

### 1.2 方案比较

| 方案 | 结果 | 结论 |
| --- | --- | --- |
| A · 保留现有 JSON 与 `skuBarcode`，只重做页面 | 页面更整齐，但自由 type、双写、无唯一反查、无 SKU/option target 的根因不变；篡改请求仍可越过 UI | 拒绝，因为把数据模型缺陷伪装成表单问题 |
| B · 为 identifier/profile/effect 分别建立独立 aggregate、状态和保存 API | 可表达全部事实，但引入三套生命周期、版本、保存按钮和跨 aggregate 部分成功；identifier 独立状态还违反 Dexter 裁定 | 拒绝，因为复杂度大于当前业务任务且破坏 whole-save 原子性 |
| C · identifier 建 catalog owner 关系子事实；制作默认、SKU 完整覆盖、option add-only effect 随各自 parent 保存；whole-save 一次提交 | 归属、唯一、反查与制作合并规则可在 contract/owner/DB 闭合，同时保留单次商品保存和最小 UI 心智负担 | **采用** |

我选了 C 而不是 A/B，因为 C 在不增加用户保存流程和独立生命周期的前提下消除了双模型与无目标 JSON，并能把机器约束、用户文案和 owner 权威清楚分层。

实现形态选择：identifier 用关系表；制作信息不用新 aggregate 表，而在 `catalog_item`、`catalog_sku` 与当前有效的 item-scoped `catalog_item_order_option_value_override` 上各放一个闭合 JSONB 父事实。option effect 依附“当前商品配置的具体选项值覆盖行”，不得复活已退役的 `catalog_order_option_value`。这样 identifier 获得唯一索引并为未来按值查询保留单一边界，制作事实继续受当前 parent 生命周期与商品版本约束，不额外发明 profile ID、version 或状态。

## 2 · CP 总览

| CP | 主题 | owner | 主要输出 | 依赖 |
| --- | --- | --- | --- | --- |
| CP-00 | 当前树分母、旧数据形状和锚点预检 | design/implementation | exact-set、首败、迁移停机输入 | 无 |
| CP-01 | 契约单一声明与 red self-test | catalog generator | identifier/preparation schema、capability、problem、旧字段退休断言；不新增解析 operation | CP-00 |
| CP-02 | P1 → token → M1 → P3 生成链 | generators | OpenAPI、Java/TS wire、fixture、shape manifest、operation/budget exact-set | CP-01 |
| CP-03 | catalog 持久化与迁移 | catalog | `product_identifier`、三个 parent JSONB、旧事实确定性迁移/拒绝 | CP-01 |
| CP-04 | catalog owner 写与读回 | catalog | whole-save 校验、唯一索引、effective preparation/source、copy closure；只保留未来查询边界设计 | CP-02, CP-03 |
| CP-05 | production tag task read 与绑定校验 | fulfillment-production + catalog coordinator | query cursor、批量引用复核、既有停用读回 | CP-02 |
| CP-06 | operations-admin wire/model | operations-admin | generated request/readback 解码、业务 copy exact-set、draft model | CP-02, CP-04 |
| CP-07 | 条码与标识 UI | operations-admin | 商品行内编辑、规格摘要与 Modal、业务语言错误定位 | CP-06 |
| CP-08 | 制作信息 UI | operations-admin | 商品默认、规格继承/完整覆盖 Modal、选项值 add-only | CP-05, CP-06 |
| CP-09 | 静态/focused/owner tests | shared | generator red/green、owner integration、七个 IA screen focused proof | CP-04–08 |
| CP-10 | backend acceptance 与 80 分母维护 | backend-acceptance | 既有 80 个 annotation 内扩展真实 HTTP 子用例 | CP-09 |
| CP-11 | seed 源与 executor | catalog seed | 丰富识别/制作业务数据、完整 readback 断言 | CP-04, CP-05 |
| CP-12 | 静态链与受管动态验证设计收口 | shared | exit code、business/cleanup、未验证 UI 清单 | CP-09–11 |

## 3 · 横切机制对照表

| 机制 | ① 用哪个现成能力/规范 | ② 如何验证 | ③ 无现成时：必须符合什么形态 | ④ 本批适用全集 |
| --- | --- | --- | --- | --- |
| 读侧节点授权 | `doc/platform/backend-coding-standard.md` §1-A；`ProductionTagOwnerService.requireScope`；`CatalogOwnerService.requireScope` | `[backend-acceptance]` 同 workspace 改传另一 dataNode，详情和标签候选均 403，响应不含目标事实 | 本批不新增 identifier 解析入口；未来销售 Journey 必须同时提供当前 `dataNodeRef` 与 brand，不能按值全库搜索 | `getOperationsCatalogItem`、`getOperationsProductionTags` |
| 写授权与 grant 复核 | `CatalogInventoryCoordinator.saveCatalogItem`；generated `x-capability-by-data-node-type` | `[backend-acceptance]` 无编辑能力提交合法 payload 仍 403，商品版本与 identifier/profile/effect 均不变 | UI disabled 仅体验；owner 从 execution context 复核，不信任前端 capability | 唯一写 operation `saveOperationsCatalogItem`，以及其 ITEM/SKU/OPTION_VALUE 三种制作目标与 ITEM/SKU 两种 identifier 目标 |
| 跨 owner 写与事务 | `AGENTS.md` 跨 owner 红线；`CatalogInventoryCoordinator.saveCatalogItem` 的同一 `REQUIRED` command | `[owner integration]` production tag 校验失败时 catalog item、identifier、item/SKU profile、item-scoped option override effect 与 version 全不变 | 本批对 production owner 仅 task read/校验，不新增第二 owner 写；不得直读 fulfillment schema | catalog whole-save 中新绑定的 item profile、SKU override、option effect 三类 `productionTagRefs` |
| 集合形态与分页 | `doc/platform/foundation-charter.md` §1-J；`OpaqueCollectionCursor`；IA §2 | `[acceptance]` 造 21 个匹配标签，pageSize=20，两页无重无漏；query 改变后旧 cursor 被拒 | identifier/profile/effect 属 Detail aggregate；只有标签候选为 Cursor | item identifiers、每个 SKU identifiers、item profile、SKU overrides、option effects、production tag candidates |
| 缓存失效 / 改完刷新什么 | `doc/platform/frontend-coding-standard.md` §3-C；generated RTK tags | `[focused test]` whole-save 成功只失效当前 item detail、items query 与 navigation query；Modal 确定不发请求 | `getOperationsProductionTags` 只在独立标签 owner 变更时失效；商品保存不广播候选页 | `getOperationsCatalogItem`、`getOperationsCatalogItems`、`getOperationsCatalogNavigation`；标签 owner 变更另含 `getOperationsProductionTags` |
| **RTK 数据读取与加载判定** | 前端规范 §3-B；`useCursorCandidates` | `[focused test]` 翻页时保留 `currentData` 已有项并展示加载尾态；scope generation 改变后旧页不写入 | 不复制 RTK page 到第二个服务端 state；仅保存 cursor 聚合所需 generation-aware candidate view | 商品 detail、production tag candidate cursor、whole-save readback |
| **同一事实只有一个住址** | 前端规范 §3-E；`catalogModel.ts` 当前 decode/encode 边界 | `[focused test]` 关闭 Drawer 再打开只从最新 detail 建草稿，旧 Modal 与旧本地集合均为空 | persisted fact 在 detail/readback；组件 state 只保未提交草稿、active tab、open Modal | identifiers、item profile、SKU override、option effect、effective source、tag candidates |
| **失败可见且原因不得改写** | 前端规范 §3-D；后端规范 §1-D/§2-B；IA §4 | `[focused test]` 15 个 problem 输入逐一映射到业务文案/字段，raw code、path、exception 不进 DOM | 新建 app-local `catalogIdentificationPreparationFeedback.ts`，以 exhaustive switch 消费 code+locator，不用默认中文兜底 | IA §4 的 15 个 problem 入口；最终复用 `VERSION_CONFLICT`，其余 14 个语义逐项对账 |
| owner 错误到 HTTP 的映射与注册处 | `scripts/generate/catalog-inventory-p1.mjs` 的 operation `problemCodes/conditionToProblem`；现有 edge typed problem 映射 | `[generator self-test + acceptance]` 每个新 code 同时命中生成源、OpenAPI enum、owner 抛出和至少一个 HTTP 反例 | owner safe locator 只含 target kind、stable row key、field key；不得回传 SQL/raw payload | save 的 identifier 4 类、preparation 6 类、通用 5 类；本批不存在 resolve outcome 或第二套 problem 分母 |
| 幂等键构成与重放语义 | 前端规范 §3-G；现有 `saveOperationsCatalogItem` idempotency | `[acceptance]` 同 key 同 payload 重放返回同一版本/readback；同 key 不同 payload 返回 mismatch | 不为 Modal 或 identifier 子行增加 idempotency key；它们不独立写 | `saveOperationsCatalogItem`、seed executor 对该 operation 的每次 whole-save |
| **该用生成物的地方不得手搓字符串** | 后端规范 §2-D；`scripts/generate/catalog-inventory-p1.mjs`；`scripts/generate/catalog-inventory-p3-frontend.mjs` | `[静态]` generated OpenAPI/Java/TS/fixture 全部 `--check`，生产代码不出现 route literal 或复制 enum exact-set | 中文 copy 不属于 HTTP 生成物，唯一住址为 app-local copy module；generated 只给 machine keys | 3 identifier types、7 shapes、2 identifier grains、3 preparation target kinds、2 override modes、3 source kinds、typed problems、operationId |
| 日志落点与脱敏字段 | `AGENTS.md` 日志硬约束；现有 request/owner diagnostics | `[acceptance log inspection]` 拒绝日志可关联 requestId/operationId/problemCode/targetKind，且搜索不到 identifierValue、notes、instruction、cookie/token | identifierValue、normalizedValue、制作说明、option instruction 视为业务输入，不记录；只记录计数与安全枚举 | save、detail、标签候选、迁移预检、seed executor |
| 迁移回填与可逆性 | 单一 Flyway history；`V20260821_090000_000__catalog_inventory_unit_model.sql` 的 fail-closed 先例 | `[migration integration]` 合法旧行迁入且旧字段删除；任一不确定旧行令整条 migration 回滚并报告计数 | 同一 migration 先预检后 DDL/DML；不建兼容 view、dual-read 或 fallback | item `identifiers`、SKU `sku_barcode`、顶层 `productionTagRefs`、generic `productionProfiles`、materialRole fallback |
| 前端共享行为(Drawer/列表/表单生命周期) | 前端规范 §3-F；`libraries/frontend/admin-ui-foundation` Drawer/overlay primitives；现有 `CatalogItemDrawer` | `[focused test]` Modal 锁定父 Drawer、ESC 先关 Modal、焦点归还触发按钮、父 Drawer 关闭清空全部草稿 | 新组件留在 catalog feature；不得在 app 复制 foundation overlay/lock | 商品 Drawer、SKU identifier Modal、SKU preparation Modal、option effect collapsible |
| 候选/下拉数据源 | `ProductionTagOwnerService.readTags`；`ProductionTagOwnerApi.readTagReferencesByRefs`；`useCursorCandidates` | `[acceptance+focused]` `usage=BINDABLE_CANDIDATE` 即使空 query 也只返回 enabled，管理列表省略 usage 时仍返回 enabled/disabled 全集；既有 disabled 引用由批量 ref readback 回显，候选失败不降级自由文本 | 给现有 GET 增加 `usage` 与 `query`；cursor identity 必含 scope+brand+usage+normalizedQuery+pageSize，rows 与 total 复用同一 predicate | production-tag 管理列表一个 `MANAGEMENT` consumer；item/SKU/option 三处共用一个 `BINDABLE_CANDIDATE` task read |
| 编码与名称呈现 | IA §3.3；`catalogBusinessCopy`（本批新增 app-local） | `[focused/static]` 可见 DOM、placeholder、tooltip、aria 与错误不含 IA 禁止词；“称重键码（PLU）”为唯一 PLU 技术缩写例外 | contract enum 仅映射到“条码/称重键码（PLU）/助记码”；SKU 界面统一说“规格/规格编码” | IA-CIPG-01 至 IA-CIPG-07 全部可见面 |
| **会同时坏的东西是否已声明为原子组** | charter §5-C；whole-save 既有事务 | `[acceptance]` 在唯一冲突、非法 target、停用新标签三种失败点断言 item version、identifier、profile/effect 全部未改变 | 同一请求内 item 基础事实、SKU、option configs、identifier、preparation、reference rows 为一个 catalog atomic group | `saveOperationsCatalogItem` 一组；migration 的 preflight+DDL+DML 一组；P1→tokens→M1→P3 一组 |

## 4 · 每个 CP 的门控

### CP-00 · 分母与旧事实预检

- 可证伪失败条件：生成源 operation/field denominator、80 个 acceptance annotation、迁移文件名或 §9b 锚点任一与本文不同仍继续实施。
- 不变量：记录 first failure、last known good、broken boundary；扫描当前 `sections.identifiers/productionProfiles/productionTagRefs` 与 `catalog_sku.sku_barcode` 的静态形状，不声称已扫描 DEV 数据。
- FORBID：不以文档数字覆盖当前树，不执行 DEV/DB。
- 比例验证：静态 exact-set 与唯一锚点计数。
- 形态理由：先冻结当前树分母而不是实施中追着生成物改，因为本批同时退休旧字段并新增 operation。
- RECALL：正式需求 §2/§5/§7、IA §3、生成器 self-test、backend acceptance 规范。

### CP-01 · 契约声明

- 可证伪失败条件：旧 `kind/code/value`、`skuBarcode`、generic `productionProfiles` 任一仍在新 save/detail schema；服务商品可提交 BARCODE；option effect 可传 remove/负数/完整 profile；字段 label/helpText 被当作 HTTP 业务规则。
- 不变量：所有 object `additionalProperties:false`；identifier 值 trim 后长度 1..160，并保留前导零；三类均拒绝 Unicode 控制字符。BARCODE/PLU 的 normalizedValue 保持 trim 后原值且大小写敏感；MNEMONIC 使用大小写不敏感比较值但 readback 保留用户录入大小写。PLU 不额外猜位数/checksum。制作单显示名称最多 120 个字符，制作说明与追加说明分别最多 1000 个字符。预计制作时长与增量为空或非负整数，不设 86400 等业务上限。以上规则同批进入 contract、owner 与 UI。
- FORBID：不把中文 copy/layout/testId 写入 HTTP contract；不手改 generated 文件；不留 additionalProperties 或 fallback。
- 比例验证：generator red fixture 逐项删错/放宽错后 self-test 必红，再 `--write --check`。
- 形态理由：机器规则进 generator，业务语言进 app-local copy，因为两者变更原因与消费者不同。
- RECALL：正式需求 §3–5、IA §3/§4、`fieldDescriptors`、`applyDefinitionFactsToCatalogItemDetail`、`applyDefinitionFactsToCatalogItemSaveRequest`。

### CP-02 · 生成链

- 可证伪失败条件：P1 通过但 token/M1/P3 任一 exact-set 红，或新 operation 没有非 null DB budget。
- 不变量：固定顺序 P1 → workspace-command-tokens → M1 bindings → P3 frontend；任何 operation 都必须在生成源中拥有非 null、非 placeholder 的真实目标预算，`CALIBRATION_PENDING`/null/无限预算在中间态和最终态都禁止。本批明确不新增 HTTP resolve operation，因此 catalog metadata 保持 57、全平台保持 238。
- FORBID：不为过门填无限/默认预算，不手改 OpenAPI/Java/TS/fixture。
- 比例验证：四段 generator check/self-test 与 operation exact-set verifier。
- 形态理由：当前维护 UI 和销售链没有解析调用者；Dexter 已裁定 HTTP edge 延期到真实销售/扫码 Journey。设计不创建零消费者 endpoint，也不以 placeholder budget 偷渡未来能力。
- RECALL：`scripts/generate/catalog-inventory-p1.mjs`、token/M1/P3 generators、backend performance budget shared validator。

### CP-03 · 持久化与迁移

- 可证伪失败条件：SKU identifier 可归到别的 item；同 scope+brand+type+normalized 可落两行；旧 unknown type/code 或无 target profile 被静默丢弃/猜测；旧字段仍可写。
- 不变量：`catalog.product_identifier` 关系表；三个 parent JSONB 闭合对象；复合 FK、唯一索引与 display order；迁移在一个 Flyway transaction 内先预检。
- FORBID：不建 identifier status，不建 profile aggregate 表，不 dual-write/dual-read，不兼容 view。
- 比例验证：migration integration 包含合法、duplicate、cross-item SKU、unknown legacy、nonempty generic SKU/option 五类。
- 形态理由：关系表服务唯一反查；parent JSONB 服务小而闭合且随父生命周期的制作事实。
- RECALL：正式需求 §5.3/§7、现有 migrations、`CatalogItemReferenceFacts`。

### CP-04 · Catalog owner

- 可证伪失败条件：篡改 ownerRef/target、非法 shape/type、重复值、unknown preparation field 任一保存成功；失败后 version 增长；effective instruction 按 UUID 而不是业务顺序。
- 不变量：owner 从当前 item/SKU/option rows 重新派生归属；identifier replace、parent JSONB、references 与 item version 同事务；effective readback 返回 profile + `ITEM_DEFAULT/SKU_OVERRIDE` 与有序 option contributions。
- FORBID：不信任请求 normalizedValue/ownerType/source；不恢复 `materialRole` opaque promotion。
- 比例验证：owner integration + backend acceptance 篡改请求。
- 形态理由：新建 package-private `CatalogIdentifierFacts` 与 `CatalogPreparationFacts`，让 `CatalogOwnerService` 保持 orchestration，避免继续膨胀 JSON/SQL 细节。
- RECALL：`CatalogOwnerService.saveCatalogItem`、`saveItem`、`CatalogInventoryCoordinator.canonicalSaveRequest`、正式需求 §3/§4。

### CP-05 · Production tag

- 可证伪失败条件：query 在客户端本地过滤；候选 consumer 空 query 时混入 disabled；管理 consumer 丢失 disabled；rows/total/cursor 使用不同 predicate；新绑定 disabled tag 成功；既有 disabled 引用从详情消失；同一保存逐 ref 查询形成 N+1。
- 不变量：现有 `readTags` 增加 `usage=MANAGEMENT|BINDABLE_CANDIDATE` 与服务端 query；管理 consumer 省略时按 `MANAGEMENT` 处理，候选 consumer 始终显式传 `BINDABLE_CANDIDATE`；usage、normalized query 与 pageSize 都进入 cursor identity，rows/total 使用同一 predicate。现有 `readTagReferencesByRefs` 一次批量返回全部 refs，catalog coordinator 区分 existing refs 与 newly bound refs。
- FORBID：不让 catalog 直读 fulfillment schema，不恢复商品页快速创建，不创建第二 candidate endpoint。
- 比例验证：production tag cursor acceptance、owner query test、catalog save tag binding acceptance。
- 形态理由：扩展既有 task read 而不是新建候选 API，因为 owner、集合和消费者相同。
- RECALL：`ProductionTagOwnerService.readTags`、`readTagReferencesByRefs`、IA-CIPG-05/06/07。

### CP-06–08 · 前端模型与两个页面专题

- 可证伪失败条件：界面显示 IA §3.3 禁止词；普通商品出现 SKU入口；规格 Modal 确定即发 HTTP；切回默认仍提交 partial override；option 出现移除/负时长；raw problem/detail 可见。
- 不变量：generated wire→`catalogModel` typed draft→专用 UI components；业务 copy 在 app-local exact-set；父 Drawer 保存唯一写；七个 IA screen 的 loading/empty/error/accessibility/cascade 全覆盖。
- FORBID：不手写 endpoint/enum；不把 contract descriptor 的 label 当用户文案；不把服务端集合镜像进 state；不改商品标签、规格销售属性、点单选择、库存/BOM。
- 比例验证：静态 architecture test + render/user-event focused tests；browser L2 未授权则明确 UNVERIFIED。
- 形态理由：从 592+ 行旧编辑器拆出 identification/preparation 专题组件，但仍由 CatalogItemDrawer 拥有整体草稿和保存。
- RECALL：交互稿、IA 全文、前端规范、`CatalogItemDrawer`、`catalogModel`、admin-ui-foundation。

### CP-09–12 · 证明、seed 与收口

- 可证伪失败条件：只改测试标题/删断言；acceptance annotation 超 80；seed 只造 happy path；generated fixture 被手改；静态 PASS 冒充 browser L2。
- 不变量：现有 80 annotation 内扩展子用例；seed 只改 P1 `catalogDefinitionSeed` 与 executor；三处 readback 均比 target、业务值、完整 tag/source/order；最终区分 business/cleanup/未验证 UI。
- FORBID：无动态授权不运行 Testcontainers/DEV/reset/seed/browser；不新增 provider/registry。
- 比例验证：node test-health exit、generator check、module compile/test、受权后 managed Testcontainers business+cleanup。
- 形态理由：把相同 Journey 的正反例放进既有 catalog 场景，维持 80 上限且不牺牲可证伪断言。
- RECALL：backend acceptance 标准、seed executor、managed runtime skill（仅取得动态授权后）。

## 5 · operation / path / face / 集合形态

| 业务意图 | operationId | method/path | consumer face | 集合形态 | 预期规模与增长驱动 |
| --- | --- | --- | --- | --- | --- |
| 读取商品及 identifier/preparation aggregate | `getOperationsCatalogItem` | `GET /operations/catalog-inventory/items/{itemCode}` | operations-admin | Detail | 每商品 1，identifier/SKU/option 子集合随该商品规格和选项增长，通常个位至几十 |
| whole-save 商品识别与制作事实 | `saveOperationsCatalogItem` | `POST /operations/catalog-inventory/items/{itemCode}` | operations-admin | Command + Detail readback | 单商品原子请求；子集合同上，受现有 JSON document size policy |
| 搜索/管理制作处理标签 | `getOperationsProductionTags` | `GET /operations/catalog-inventory/production-tags`，增加 `usage=MANAGEMENT|BINDABLE_CANDIDATE` 与 `query`，保留 `dataNodeRef,cursor,pageSize`；管理页省略 usage，候选控件显式传 `BINDABLE_CANDIDATE` | operations-admin | Cursor | 正常十几个至数百；由当前 dataNode+brand 的标签治理增长；每页 20、最大 100 |

本批不生成 identifier 解析 operation。唯一索引只作为当前事实不变量，未来销售 Journey 再增加自己的 edge、consumer face 与预算；不得复用 operations-admin 会话或让 catalog 猜 brand。

## 6 · 跨 owner 写矩阵

| policy | 第一个 owner command | 第二个 owner command | 事务 | 失败时的回滚事实 |
| --- | --- | --- | --- | --- |
| 商品 whole-save 内引用 production tag | catalog coordinator 调用 fulfillment-production `readTagReferencesByRefs` 做 task read/资格复核 | catalog `saveCatalogItem` 写 item/SKU/option parent、identifier 与 reference rows | 同一个外层 `REQUIRED`；第二个 owner **无写 command** | 任一 ref 不存在、越 scope 或新绑定已停用，catalog 所有写和 version 均不发生 |

本批没有跨 owner 写。catalog 不得直写 `fulfillment_production` schema；fulfillment-production 不反向 import catalog。

## 7 · 声明—传递—消费矩阵

| fact | declaration | transfer | consumption | proof |
| --- | --- | --- | --- | --- |
| Identifier 类型与最小格式 | P1 generator `identifierRules`：BARCODE/PLU/MNEMONIC，trim、1..160、无控制字符；BARCODE/PLU 大小写敏感，MNEMONIC 比较不区分大小写且 readback 保留原值 | OpenAPI schema + generated Java/TS + shape manifest allowedTypes | catalog owner 重新 normalize/validate；UI 只映射业务名与即时提示 | generator red self-test、owner integration、focused UI |
| Identifier shape×grain×type | P1 generator 7×2 matrix | `CatalogShapeManifestView` + save schema | UI 决定入口；owner 从真实 rows 重新派生 | manifest HTTP、7×2×3=42 格正反例参数化；不适用格也断言拒绝 |
| 唯一域 | 正式需求 `dataNodeRef+brandRef+type+normalizedValue` | whole-save context；不向 UI显示组合键 | DB unique index + owner conflict mapping | concurrent owner integration + HTTP save duplicate |
| 制作三层语义 | P1 typed schemas：item default、SKU full override、option add-only | detail/save/readback/effective source | owner merge；UI 显示“使用商品默认/单独设置/制作变化” | owner merge table tests + focused render |
| Option instruction 顺序 | option group displayOrder、value displayOrder、definitionValueRef | detail 已带业务顺序与 ref | owner effective readback 按三级排序 | acceptance 以反序 UUID/正序 displayOrder 断言文本顺序 |
| Production tag 新绑定/既有引用 | fulfillment owner status/readTagReferences | batch task read | catalog 校验新增必须 ENABLED；detail 回显既有 DISABLED | acceptance 一正一反及停用历史可见 |
| **集合形态** | IA 各 screen `collectionShapeAndScale` | 标签 query=`dataNodeRef,query,cursor,pageSize`；其余无 page 参数 | `useCursorCandidates` 连续加载；detail 子集合不 slice、不伪造 total | 21 行两页 acceptance + focused stale generation |
| **授权执行点** | IA 各 screen `stateAndPermission` | generated x-consumer-face/capability；edge execution context | catalog/production owner 再验 scope/brand/target/version | 跨 dataNode、无 grant、cross-item target 三类 acceptance |
| **缓存失效** | IA `navigationAndRefresh` | RTK tag invalidation from save result | 当前 detail/items/navigation 重取；Modal 确定不重取 | focused spies 精确集合相等 |
| **错误映射** | IA §4 全集 | P1 `problemCodes/conditionToProblem` 与 safe locator | `catalogIdentificationPreparationFeedback.ts` exhaustive map 到字段/行/Modal | generator exact-set + 15-case focused test + owner HTTP hits |
| **日志与脱敏** | identifierValue/normalizedValue/notes/instruction/raw payload 禁止 | requestId/operationId/problemCode/targetKind/count 结构化传递 | owner/runner 日志与 evidence 只读安全字段 | log scan negative assertions |
| **用户业务语言** | interaction `USER_VISIBLE_COPY` + IA §3.3 | app-local copy keys，不经 HTTP contract | 七个 IA screen、error、aria、placeholder | focused DOM exact forbidden-set search |

## 8 · 业务规则 → owner 判定点

正式需求业务规则按下表 24 条闭合；空号无。

| 规则编号 | owner 判定点 |
| --- | --- |
| R-01 | `CatalogIdentifierFacts.normalizeType/value` 限定三类、trim、1..160、控制字符；BARCODE/PLU 大小写敏感，MNEMONIC 比较不区分大小写且保留展示原值 |
| R-02 | `CatalogIdentifierFacts.deriveOwners` 从 shape 和当前 SKU rows 派生 ITEM/SKU grain |
| R-03 | `CatalogIdentifierFacts.requireAdmission` 执行 7 shape 准入；SKU shape 拒父 item identifier |
| R-04 | DB unique index + duplicate problem 映射执行 dataNode+brand+type+normalized 唯一 |
| R-05 | 本批不创建 identifier resolve HTTP edge 或零调用者 owner 生产方法；唯一索引与未来查询边界必须要求 dataNode+brand 并只允许唯一 item 或具体 SKU |
| R-06 | identifier replace 与 item version/CAS 同事务；移除不改历史快照 |
| R-07 | item preparation 仅四字段，additionalProperties/owner parser 拒未知字段 |
| R-08 | SKU override 仅 INHERIT_ITEM 或完整 OVERRIDE；partial profile 拒绝 |
| R-09 | option effect 仅 add tags、非负 seconds、instruction，拒完整 profile/remove |
| R-10 | estimated/delta 为空或非负整数；0 与 null 区分；不设 86400 等业务上限 |
| R-11 | display name 最多 120 个字符，notes/instruction 分别最多 1000 个字符；同值进入 contract、owner 与 UI 即时提示 |
| R-12 | item/SKU/option target 从当前 parent rows 复核，跨商品/已删除拒绝 |
| R-13 | production tag 新绑定必须当前 scope 可绑定且 enabled |
| R-14 | 既有 disabled production tag 允许 readback，不可新增到别处 |
| R-15 | SKU effective = override 或 item default，不逐字段隐式合并 |
| R-16 | option tags 做集合并集，seconds 求和，均不受选择顺序影响 |
| R-17 | instruction 按 group displayOrder、value displayOrder、definitionValueRef 排序 |
| R-18 | STANDARD_SALE_COUNTED/WEIGHED 允许 item profile 与 option effect，拒 SKU profile |
| R-19 | SKU_VARIANT_SALE_COUNTED 允许 item profile 与每 SKU override，拒 option effect |
| R-20 | MATERIAL/COMPOSITE/SERVICE/BENEFIT_SHELL 拒任意制作信息；COMPOSITE 壳不替组件解析 |
| R-21 | SERVICE 仅 MNEMONIC；BENEFIT_SHELL 不允许 identifier |
| R-22 | `materialRole` 只读顶层 typed catalog field；opaque profile promotion 删除 |
| R-23 | stationTags/printTags/allergens/旧 generic profile 与 skuBarcode 不被新 schema/owner 接受 |
| R-24 | 商品标签、SKU销售属性、点单选择规则、库存/BOM、单位、菜单与可售事实不因本批改写 |

## 9 · owner API 与消费者清单

| owner 方法 | 谁调用 |
| --- | --- |
| `CatalogOwnerApi.saveCatalogItem`（扩展 typed save/readback） | `CatalogInventoryCoordinator.saveCatalogItem` |
| `CatalogOwnerApi.read` 的 `getOperationsCatalogItem` 分支（扩展 detail） | 既有 catalog read edge/operation |
| `ProductionTagOwnerApi.readTags`（增加 query） | 既有 `getOperationsProductionTags` operation；CatalogDictionaryDrawer 与 CatalogItemDrawer 共享生成 client |
| `ProductionTagOwnerApi.readTagReferencesByRefs`（语义收紧，不新增方法） | `CatalogOwnerService` detail read 与 `CatalogInventoryCoordinator.saveCatalogItem` 批量绑定复核 |

不新增 identifier 子命令、preparation 子命令或无人调用的 profile API。
不新增 `CatalogOwnerApi.resolveIdentifier` 或 HTTP resolution operation；未来销售 Journey 必须重新声明调用者、brand 上下文、consumer face 与预算。

## 9b · 变更定位

以下锚点由 CP-00 按当前树逐项 `rg -F` 重算并要求唯一命中；实施前后必须重算，任何 0 或 >1 先停机更新本文。CP-00 发现其中三个旧实现锚点已在当前树中提前替换，以下改为其当前唯一 owning symbol；这只是定位修订，不改变业务规则、契约语义或实施范围。

| 文件 | 唯一锚点 | 变更意图 |
| --- | --- | --- |
| `scripts/generate/catalog-inventory-p1.mjs` | `const fieldDescriptors = [` | 删除旧 productionTagRefs 描述，声明机器 capability 与新 schema |
| `scripts/generate/catalog-inventory-p1.mjs` | `CatalogItemSaveRequest: {dataNodeRef:` | 增加 identifier save machine fields；不得顺带生成 resolve query |
| `scripts/generate/catalog-inventory-p1.mjs` | `const applyDefinitionFactsToCatalogItemDetail = (detailSchema) => {` | detail typed identifier/preparation/effective readback，退休旧字段 |
| `scripts/generate/catalog-inventory-p1.mjs` | `const applyDefinitionFactsToCatalogItemSaveRequest = (saveSchema) => {` | save typed request，additionalProperties false |
| `scripts/generate/catalog-inventory-p1.mjs` | `const catalogDefinitionSeed = {` | 唯一 seed 业务图新增识别与制作事实 |
| `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/api/CatalogOwnerApi.java` | `public interface CatalogOwnerApi {` | typed save/readback records；不得新增零调用者 resolve API |
| `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java` | `public CatalogOwnerApi.CatalogItemSaveReadback saveCatalogItem(` | whole-save orchestration |
| `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java` | `private SaveItemResult saveItem(` | CAS 内 identifier/preparation replace |
| `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java` | `private void decoratePreparationFacts(` | typed preparation readback、effective source 与 option contribution |
| `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java` | `private ObjectNode canonicalSaveRequest(String canonicalRequestJson) {` | 删除 opaque materialRole promotion/opaque null special-case |
| `apps/backend/catering-business-server/modules/fulfillment-production/src/main/java/com/catering/v2s/fulfillment/production/application/ProductionTagOwnerService.java` | `public JsonNode readTags(String dataNodeRef, String brandRef, ObjectNode request, String requestId) {` | 服务端 query 与 cursor identity |
| `apps/frontend/operations-admin/src/features/catalog-management/model/catalogModel.ts` | `export type CatalogDetail = {` | typed detail/draft/effective source |
| `apps/frontend/operations-admin/src/features/catalog-management/model/catalogModel.ts` | `function decodeIdentifiers(value: JsonValue | undefined): CatalogIdentifier[] {` | typed decode，删除 kind/code/value |
| `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx` | `export function CatalogItemDrawer({` | 父草稿与专题组件接线 |
| `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx` | `export function PreparationProfileEditor({` | 退休 generic editor，使用专用制作信息组件 |
| `scripts/dev/catalog-inventory-seed-executor.mjs` | `const materializeOwnerRefs = async (client) => {` | 通过 HTTP 物化并严格断言新 seed |

新增文件使用能力命名：`CatalogIdentifierFacts.java`、`CatalogPreparationFacts.java`、`CatalogItemIdentificationEditor.tsx`、`CatalogItemPreparationEditor.tsx`、`catalogIdentificationPreparationFeedback.ts`、`V20260823_120000_000__catalog_identifiers_and_preparation_model.sql`。写前必须先确认 migration 文件名未占用。

## 10 · 数据迁移

| 迁移 | 加/改什么 | 旧行回填取什么值 | 为什么是唯一可恢复事实 | 可否回滚 |
| --- | --- | --- | --- | --- |
| `V20260823_120000_000__catalog_identifiers_and_preparation_model.sql` | 新 `catalog.product_identifier`；`catalog_item.preparation_profile jsonb`、`catalog_sku.preparation_override jsonb`、`catalog_item_order_option_value_override.preparation_effect jsonb`；复合 FK/unique/check/index；最终删除 `catalog_sku.sku_barcode` 与 sections 旧键 | item `identifiers`: 仅 kind 为 BARCODE/PLU/MNEMONIC、`code` 空、`value` 合法且 shape 准入时迁；SKU 非空 `sku_barcode` 迁 BARCODE；item 顶层 productionTagRefs + item profile 的 `printName/estimatedPreparationSeconds/preparationNotes` 映射到新 profile；option effect 只落到当前 item config 下已存在的 definition-value override；generic sku/option 仅空对象可迁为空 | type/value、SKU row、顶层 typed tag refs、已命名 item 字段及 item-scoped option value override 都有唯一目标；`code`、unknown kind、stationTags/printTags/allergens、无 target 的 sku/option map 没有唯一业务含义，不能猜 | schema migration 不提供运行时 rollback；在事务内预检失败即零变更。部署回退依赖数据库恢复，不建兼容层 |

迁移激活前先由 implementation/managed start 的只读 preflight 运行同一组 SQL predicate；它不改数据，只输出分类、数量、安全 item code、建议 disposition 与 `READY|DEXTER_DECISION_REQUIRED`。确定性等值规则必须先执行：nested `materialRole` 与顶层相同则保留顶层并删除 nested；冲突才停止。其余分类包括未知/空 identifier type、非空 legacy `code`、非法 shape/grain、trim 后空或超 160、规范化后 duplicate、无明确 target 的 generic SKU/option profile、item profile unknown key、stationTags/printTags/allergens、制作秒数非法、production tag ref 非 UUID。真正 unknown 非零时不启动 Flyway，由 Dexter 在显式数据操作边界内选择 repair 或 reset；清零后重跑同一 preflight，只有 `READY` 才允许 migration。报告不得输出 identifierValue、notes、instruction 或 raw JSON。Flyway transaction 内再次执行同一 predicate，防止 preflight 与迁移之间漂移；命中即零 DDL/DML 并以同分类失败。

历史快照不回写。旧 identifier 行迁移后只有当前解析行为改变；订单/工作单已冻结内容不重解释。

## 10b · seed 数据

### 10b.1 受影响的 seed 全集

| seed 文件 | 本批为什么受影响 | 处置 |
| --- | --- | --- |
| `scripts/generate/catalog-inventory-p1.mjs` 的 `catalogDefinitionSeed` | 唯一业务图目前无新 identifier/preparation，production tag 名称还误写营销语义 | 作为唯一生成源新增完整业务数据并修正标签语义 |
| `scripts/dev/catalog-inventory-seed-executor.mjs` | 仍按旧 `identifiers/skuBarcode/productionProfiles/productionTagRefs` 形状组装或读回 | 仅通过 generated client whole-save；新增严格 identifier 归属/readback/effective 断言，不调用不存在的 resolve operation |
| generated catalog fixture | 由 P1 生成且 schema 变化 | 只经 generator 重生成，禁止手改 |
| `scripts/test/catalog-inventory-definition-seed.test.mjs` | 当前断言旧 seed 形状和标签语义 | 更新为新业务图、分支与非法旧字段 exact-set |

以上四项是本批 seed 影响全集；没有第二个域 seed plan。

### 10b.2 两类改动

| 类型 | 覆盖清单 |
| --- | --- |
| **新功能上线** | 普通瓶装商品两个 BARCODE+一个 MNEMONIC；称重商品 PLU+BARCODE；SKU 商品每个规格至少一条 BARCODE，其中一个规格有两条同类型；原料与套餐商品 BARCODE；服务商品 MNEMONIC；商品默认制作信息；两个 SKU 一个继承、一个完整覆盖并清除后继承；普通商品两个 option effect，含加标签/加秒数/追加说明；同商品多个 effect 的说明顺序与 displayOrder 可证伪；覆盖 MNEMONIC 大小写碰撞、控制字符、120/1000 边界和无时长业务上限；不造 HTTP resolve seed 调用 |
| **旧功能调整** | 将 SIGNATURE/LUNCH/DINNER/TAKEOUT 从 production tag 移除，改造为 HOT_KITCHEN/COLD_DISH/BEVERAGE/PACKING 等真实制作语义；删除 seed 中 kind/code/value、skuBarcode、generic productionProfiles、自由 stationTags/printTags/allergens；商品营销标签继续保留在 catalog tagDefinitions，不误路由 |

### 10b.3 覆盖判据

seed report 必须逐业务对象输出安全名称/编码、识别类型数量与归属目标、制作默认/继承/覆盖/选项变化摘要；不得输出完整识别值或制作说明。失败条件至少包括：任一 expected identifier 少行、多行或指错 target；SKU clear 后 source 不是 ITEM_DEFAULT；option effective 标签/秒数/说明顺序不符；停用标签不能读回；营销词仍出现在 production tag。

### 10b.4 同步项

P1 self-test、generated fixture schema、definition seed static test、executor readback 必须同批更新。seed executor 的三个 readback 族——item、SKU、option effect——都必须同时比较 target identity、完整 profile/effect、production tag refs、effective source 与 instruction order，不能只比数量。

### 10b.5 边界

本节只设计 seed；执行 reset/start/seed 需另获授权并走受管入口。seed 不承担迁移旧 DEV 数据，reset 后直接按新模型物化。

## 11 · 验收场景设计

backend acceptance annotation 上限仍为 80。当前 `CatalogAcceptanceScenarios.java` 有 38 个 annotation，全仓总数当前按既有门为 80；本批不新增 annotation，而在下列既有业务场景内扩展命名 subcase，保持 `discovered=selected=results=80`。

每个 subcase 的 request 必须与其宿主 `@AcceptanceScenario.operation` 完全一致；调用 `saveOperationsCatalogItem` 的子场景只允许落在当前 operation 同为 `saveOperationsCatalogItem` 的 annotation 下，不得借 `createOperationsCatalogItem` 场景承载后续 whole-save 断言。

| scenario id | owner 文件 | identity | fixture | request | businessOracle |
| --- | --- | --- | --- | --- | --- |
| `catalog.inventory-rule-admission-matrix` · subcase `item-identifiers-and-default-preparation` | `CatalogAcceptanceScenarios.java` | head/store catalog editor | 普通、称重、服务、权益各一商品；真实 production tags | `saveOperationsCatalogItem` whole-save item identifiers/profile；篡改 PLU/service barcode/benefit identifier | detail 精确读回 item 归属、原值与规范化结果；非法请求 problem 精确且 version、identifier/profile 均不变 |
| `catalog.item-with-sku-matrix-create` · subcase `sku-identifiers-and-preparation-override` | 同上 | SKU catalog editor | 两规格、反序 UUID、item default | 每 SKU identifiers；一个 inherit、一个完整 override、再 clear | 父 item identifier 被拒；detail 指向具体 SKU；clear 后 effective source/item profile 精确 |
| `catalog.option-selection-mode-and-range` · subcase `option-preparation-additive-effects` | 同上 | option editor | 两组多值，displayOrder 与 UUID 顺序相反 | 保存两 effect；篡改 remove/negative/full profile/cross-item value | tag 并集、秒数求和、说明按业务序；四类篡改 code 精确且 version 不变 |
| `pagination.production-tags-real-cursor` · subcase `management-and-bindable-candidate-modes` | 同上 | production tag reader | 21 个匹配+不匹配+disabled | 管理 usage 两页；候选 usage 空 query/有 query 两页；篡改 cursor usage/query | 管理全集含 disabled；候选只含 enabled；rows/total 无重漏且旧 cursor 跨 usage/query 被拒 |
| `catalog.inventory-rule-admission-matrix` · subcase `identification-preparation-capabilities` | 同上 | catalog whole-save admission | 七 shape、item/SKU/option 三种 target、合法与篡改 payload | 对 7×2×3 identifier 格与 7×3 preparation target 逐格 save | 每格准入与 owner 结果一致；拒绝后 version/新事实不变；manifest 只作为声明输入，不承担 save oracle |
| `catalog.copy-definition-semantic-conflict` · subcase `copy-identifiers-and-preparation-rewrite` | 同上 | brand copy editor | source/target brand，identifier 冲突与 tag mappings | preflight/execute copy | identifier scope 重建且冲突 fail closed；三类 preparation tag refs 全部 rewrite，说明/秒数不变 |
| `catalog.inventory-rule-admission-matrix` · subcase `whole-save-atomicity-with-identification-preparation` | 同上 | catalog whole-save editor | 合法基础事实 + duplicate identifier + invalid effect | 同一 `saveOperationsCatalogItem` whole-save | 任一新事实失败时 item、identifier、profile/effect、version 全部不变；同 key 重放同结果；资产生命周期仍由原 asset scenario 独立证明 |

红夹具 exact-set：`BARCODE4`、空 type、161 字符、Unicode 控制字符、MNEMONIC 大小写碰撞、duplicate normalized、跨 item SKU、普通 item PLU、SKU PLU、service BARCODE/PLU、benefit 任意码、121 字 display name、1001 字 notes/instruction、partial SKU override、generic unknown field、stationTags/printTags/allergens、负/小数 seconds、remove tags、完整 option profile、跨 item option value、new disabled/foreign tag、generic sku/option legacy data；另有一个显著大于一日秒数的非负整数正例（如 100000），证明不存在隐式上限。每个红夹具必须断言具体 problem、field/target locator 与 catalog version 不变。

本批不新增解析 HTTP operation，run-level operation 分母保持 238；item/SKU 场景只断言 whole-save、detail readback 与唯一冲突，不伪造 HTTP resolve 断言。

## 12 · 未决项处置

| 项目 | 当前状态 | 本批允许 | 本批禁止 |
| --- | --- | --- | --- |
| 多品牌同址扫码歧义 | Dexter 已接受的已知边界 | 本批只登记未来销售 Journey 必须携带 brand 上下文 | 当前 catalog 提前建 resolve；未来缺 brand 时猜品牌或返回多候选 |
| 扫父商品码后选择 SKU | 未裁且本批不需要 | 父码请求明确拒绝 | 静默选默认 SKU、增加选择流程 |
| EAN/UPC checksum 与 symbology | 非目标 | 把条码作为 trim 后字符串保存 | 按 EAN13/CODE128 再扩 type 或自加 checksum |
| 选项移除制作标签/减少时长 | Dexter 已拒绝 | add-only | priority、remove、负数、下限保护 |
| browser L2/UAT | 未授权 | focused/static/backend 证据并列未验证清单 | 用 render test 冒充键盘、焦点、真实滚动或 UAT |

### 12.1 本轮独立 review 新暴露且 Dexter 已接受的裁定

| decision | 已裁定规则 | 本批落实 | 不得扩张 |
| --- | --- | --- | --- |
| D-CIPG-01 | BARCODE/PLU 保留 trim 后原值并大小写敏感；MNEMONIC 比较不区分大小写但保留用户展示；三类拒绝控制字符 | generator、owner、DB 唯一性、UI 提示和正反测试同值 | 不借设备规则补 checksum/位数，不把数据库 collation 偶然行为当业务规则 |
| D-CIPG-02 | 显示名称 120、两类说明 1000；时长只要求非负整数且无业务上限 | contract、owner、UI 与边界测试同值 | 不借无关列宽；不把 UI 控件默认 max 当 contract；不自加 86400 |
| D-CIPG-03 | 本批只闭合唯一索引、save/readback 与未来 owner 查询边界设计；HTTP edge 延期到真实销售 Journey | operation exact-set 固定 238，不创建 owner 生产方法、route、client 或预算 | 不建零消费者 endpoint，也不得由 catalog 猜 brand |

## 13 · 停机条件

出现以下任一情形，实施方必须单条报告原文事实、两种解释与倾向，不得 fallback 止血：

1. 当前生成源的旧字段、operation denominator、acceptance 80 分母或 §9b 锚点与本文不符；
2. 真实旧数据存在本文未列且无法唯一迁移的 identifier/profile 字段，或 migration 预检命中非零；
3. 现有 production tag owner 无法区分“既有停用引用”和“新绑定”且修复需要新增生命周期语义；
5. 维持 80 场景上限需要删除与本批无关的业务断言；
6. 任一既有 operation 因本批改动需要调高已冻结 budget；
7. 满足设计必须改商品标签、SKU 销售属性、点单选择、库存/BOM、单位、菜单、销售入口、打印规则或过敏原 owner；
8. contract 机器规则与已接受业务文案无法一一映射，或 UI 必须展示技术词才能解释；
9. 继续执行需要 reset/DEV/seed/browser/UAT 等未授权动态动作。

上游规格、评审 finding、本文数字与建议形态均是待验证输入，以当前 owning source 和可复现实验证据为准。

## 14 · 交付前自查

| 检查 | 判据 |
| --- | --- |
| §3 行完整 | 17 行齐全，无无理由 N/A |
| §3 ④ 列 | 每行均列本批全集 |
| §7 机制行 | 集合、授权、缓存、错误、日志、用户语言均有跨层具体值 |
| 详设 ↔ IA | 七 screen、15 problem、cursor、缓存、技术词禁用与业务 copy 逐字一致 |
| contract/UI/owner 分层 | contract 无中文布局/按钮/帮助 copy；UI 不自创准入/唯一/范围；owner 对篡改复核 |
| seed 全集 | 生成源、executor、generated fixture、static test 四项齐全；generated 不手改 |
| seed 两类 | 新事实覆盖与旧错误语义清理分栏齐全 |
| acceptance 分母 | annotation 不超过 80；新增为既有业务场景 subcase，四要素与副作用断言非空 |
| 迁移 | 不确定旧事实 fail closed；无 dual-read/dual-write/fallback |
| 计数自证 | catalog metadata 固定 57、全平台 operation 固定 238；38/80、7×2×3 等在实施前重新计算 |
| 证据档位 | 静态/focused/owner integration/Testcontainers/browser/UAT 不互相冒充 |
| 结束边界 | 未经新授权不执行代码、测试、DEV、reset、seed、browser、UAT 或部署 |

## 15 · 独立 DESIGN review Round 1 辩证 intake

评审输入：`doc/review/platform/2026-08-23-v2s-catalog-identification-production-guidance-design-review-independent-claude.md`。该 verdict 是待验证输入，不继承其结论。

| finding | 主审裁决 | owning-source 处置 |
| --- | --- | --- |
| F-01 option effect 指向退役表 | `CONFIRMED` | 已改为当前 `catalog_item_order_option_value_override.preparation_effect`，并补 parent/FK/copy/readback 约束；禁止复活旧表。 |
| F-02 resolve/budget/零 consumer | `PARTIALLY_CONFIRMED + DEXTER_DECISION` | `CALIBRATION_PENDING` 与零当前 UI consumer 成立；validator 并不要求最终 max 必须先通过生成后的 route 实测，因此“必然死锁”表述过强。Dexter 已裁定不新增 HTTP edge，operation exact-set 固定 238，仍保留未来 owner 查询边界设计。 |
| F-03 legacy Flyway 处置 | `CONFIRMED` | 已加 migration 激活前只读 preflight、materialRole 等值折叠/冲突停止、分类报告、Dexter repair/reset disposition 与 Flyway 内二次防漂移；不引入 fallback。 |
| F-04 production-tag 双消费语义 | `CONFIRMED` | 同一 endpoint 加 `MANAGEMENT|BINDABLE_CANDIDATE` usage；usage/query/pageSize 进入 cursor identity，rows/total 同 predicate，既有停用由 refs readback 回显。 |
| F-05 无出处数值/规范化 | `CONFIRMED + DEXTER_DECISION` | Round 1 先删除无 authority 的自报语义；Dexter 随后明确裁定 120/1000、无时长业务上限、类型化大小写与控制字符规则，现已回写正式需求、交互、IA、详设、计划与业务语料。 |
| F-06 acceptance operation identity | `CONFIRMED` | 42 格写准入迁入 save admission matrix；candidate 分页归 cursor 场景；whole-save 原子性归 item save 场景；manifest/asset 不再承载跨 operation oracle，annotation 仍为 80。 |
| F-07 `BOM` 可见 | `REJECTED_WITH_EVIDENCE` | `project-memory/decisions/confirmed-business-language-corpus.md` G-11/G-12 已把 BOM 定为仓内业务词，Dexter 本专题输入也使用“商品库存和 BOM”；本批保留既有宿主 Tab，不因 reviewer 偏好重命名相邻领域。新增专题文案仍优先使用“规格”等业务语言。 |
| F-08 problem 分组 | `CONFIRMED` | 修正为 identifier 4、preparation 6、common 5；当前无 resolve operation，因此不存在 resolve outcome 分组，不改变 save 的 15 总数。 |
| F-09 陈旧逐字文本 | `CONFIRMED` | 已冻结 get/save operationId，并把可见 screen 名统一为“规格与商品编码”“制作变化”；技术 boundary 内仍可使用 SKU/effect。 |

Round 1 修订后暴露的 D-CIPG-01/02/03 已由 Dexter 于 2026-08-23 全部按推荐裁定并逐项回写。下一步只使用同一 cycle 的最终 Round 2 定向核验，重点查三项裁定、四个 M 修订、238 operation 分母及文档逐字一致；Round 2 后按两轮上限收口。

## 16 · 独立 DESIGN review Round 2 辩证 intake 与两轮收口

独立评审：`doc/review/platform/2026-08-23-v2s-catalog-identification-production-guidance-design-review-round2-independent-claude.md`。该轮为 `REVIEW_CYCLE_ID=CIPG-DESIGN-20260823` 的最终 Round 2，独立 verdict 为 `NO-GO`、`M/S/N=0/1/1`；作者未继承 verdict，逐条重开 owning source 后处置如下。

| finding | 主审裁决 | 同根扫描与处置 |
| --- | --- | --- |
| S-01 · create scenario 承载 save whole-save request/oracle | `CONFIRMED` | 当前 `catalog.item-create-draft-category` 的 operation 确为 `createOperationsCatalogItem`。重扫 §11 七行后发现同根成员共两行：`item-identifiers-and-default-preparation` 与 `whole-save-atomicity-with-identification-preparation`。两者均已移入 operation 为 `saveOperationsCatalogItem` 的 `catalog.inventory-rule-admission-matrix`；§11 新增 operation identity 硬约束，CP-10 与之逐字对齐；不新增 annotation，总数仍设计为 80。其余五行的宿主 operation 已逐项核对。 |
| N-01 · §9b 使用 basename/“同上” | `CONFIRMED` | §9b 全部 16 行已展开为完整仓根相对路径，原唯一 anchor 与 CP-00 前后复算规则不变；不存在第二份路径推断表。 |

reviewer 输出中的 `com/voyager`、frontend 缺少 `catalog-management/model|ui`、seed 多一层 `/seed` 属报告路径转录错误；同一 reviewer 已出具路径勘误并明确 verdict/findings 不变，review 文件按其勘误机械落盘，不把勘误冒充第三轮审查。

两轮上限已经用尽，不再召集第三轮或换 reviewer 重置轮次。作者对修订后当前工件作 `ROUND_FINAL_DECISION=SELF_DECIDED` 收口：`GO_WITH_UNVERIFIED_UI`。该结论只表示设计已可交 Dexter/Claude 做外部 DESIGN review；实现、generated、migration、HTTP、acceptance、seed、DEV、browser L2 与 UAT 仍全部未授权、未执行、未验证。
