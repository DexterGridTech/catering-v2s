SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# ProductionTagDefinition 迁入商品目录域：implementation-facing 详设

> 本文是文档设计产物，不是实施授权。当前只允许编写详设、编写实施计划和只读核查；不允许修改生产代码、契约生成物、迁移、测试、seed，不允许构建、启动 DEV、reset、seed、Browser L2、UAT 或部署。

## 0 · 元数据与授权边界

```text
BUSINESS_SOURCE=用户 2026-09-21 直接指派：将 ProductionTagDefinition 迁入 catalog，作为 catalog 原生实体并删除 fulfillment-production 域
JOURNEY_REFS=既有商品目录生产标签维护、商品编辑中的生产标签选择；本批不新增用户 Journey
IA_REF=N/A_WITH_REASON：页面、抽屉、控件、交互和用户可见业务语义不变；现有 catalog UI 只做 owner/生成物回归
INTERACTION_REF=N/A_WITH_REASON：不改变已有 catalog 生产标签页面的承载形态、控件或文案
AUTHORIZED=编写本详设、编写实施计划、只读源码/契约/文档核查、两轮独立 DESIGN 对抗 review、一轮主 agent 一致性自审、向 Dexter 与 Claude 交接 review brief
NOT_AUTHORIZED=生产代码、测试代码、契约源或生成物、Flyway migration、seed/fixture、构建、契约生成、backend acceptance、DEV、reset、seed、Browser L2、UAT、部署、Git
IMPLEMENTATION_AUTHORITY=false
REVIEW_CYCLE_ID=PTD-CATALOG-MIGRATION-DESIGN-20260921
REVIEW_TARGET=DESIGN
REVIEW_ROUND=准备阶段；完成后执行 Round 1 与 Round 2
REVIEW_ROUND_LIMIT=2
```

本批的词汇边界是：用户称“生产标签”；`ProductionTagDefinition` 是当前表/fixture 中的实体技术名；目标 owner 是 `catalog`；`fulfillment-production` 只在历史迁移、历史 review 或迁移前的事实描述中允许出现。迁移完成后，活动 runtime、契约 owner、生成 registry、测试/seed source、工具和当前设计记忆不得再把它当作 owner。

### 0.1 当前字节确认的承重事实

| 事实 | 当前 owning source | 设计含义 |
| --- | --- | --- |
| 当前履约生产模块的唯一业务实体是生产标签定义 | `apps/backend/catering-business-server/modules/fulfillment-production/src/main/java/com/catering/v2s/fulfillment/production/api/ProductionTagOwnerApi.java`；实现为 `ProductionTagOwnerService` | 不迁移“整个生产域的一组实体”；迁移的是一个 catalog 业务实体及其 owner API。 |
| 该模块另有一张支撑表，不是业务实体 | `apps/backend/catering-business-server/src/main/resources/db/migration/V20260806_120000_000__catalog_inventory_backend.sql` 的 `fulfillment_production.command_receipt`；SQL 消费在 `ProductionTagOwnerServiceSql` | 旧 receipt 随 reset 丢弃；新 catalog owner 仍须建立独立 receipt 命名空间，保证 reset 后的新幂等/重放语义。 |
| 生产标签当前有一个 GET、三个 command | `contracts/openapi/paths/operations-admin/production-tag-management.paths.json`；operation IDs 为 `getOperationsProductionTags`、`createOperationsProductionTag`、`updateOperationsProductionTag`、`transitionOperationsProductionTagStatus` | operation ID、路径、wire 结构和 operations-admin face 保持稳定；owner module 改为 `catalog`。 |
| 当前表已经历 kind 退役和作废编码释放 | `V20260816_030000_000__catalog_dictionary_tag_voided_code_release.sql`、`V20260825_010000_000__retire_production_tag_kind.sql` | 目标表不能把已删除的 `tag_kind` 重新带回；唯一性保持“未作废范围”。 |
| 商品关系已在 catalog 侧承载 | `catalog.catalog_item_reference` 及 `V20260824_120000_000__catalog_single_production_tag.sql` | 迁移后关系查询仍由 catalog owner 直接读取；不新建跨 schema FK 或 read edge。 |
| 当前前端页面已在 catalog management | `apps/frontend/operations-admin/src/features/catalog-management/ui/dictionary/CatalogDictionaryDrawerState.tsx`、`CatalogItemProductionEditor.tsx` | 不新建页面或 IA；只把 owner 元数据、fallback 和生成链改到 catalog。 |

### 0.2 必须保持与本批无关的行为

- 仍然是生产标签而不是营销标签、生产路由、KDS、打印、队列或履约任务。
- 仍然支持启用、停用、作废三态；停用项继续可读，作废项释放编码，不能物理删除业务历史。
- 仍然按 `dataNodeRef + brandRef` 作用域读写，既有 scope grant、typed problem、幂等、锁和 authoritative readback 不变。
- 仍然使用既有 `/operations/catalog-inventory/production-tags` 路径和四个 operation ID；本批不借迁移之名新增 endpoint、改变分页或改变前端用户操作。
- 仍然由商品目录商品关系决定商品级最多一个生产标签；迁移不改变 `catalog_item_reference` 的 kind/ref 事实和商品保存行为。

## 1 · 真实业务目标与方案比较

### 1.1 这次真正要解决的结构性问题

当前业务事实、商品关系、catalog 页面和生产标签 API 已经由商品目录消费，但 owner、表 schema、契约 registry、生成 operation binding、模块依赖、错误映射、测试目录和部分前端 fallback 仍指向 `fulfillment-production`。这形成了一个“目录域消费履约生产域实体”的伪跨域边界：

1. 业务 owner 不符合事实归属，后续目录能力必须继续依赖已无独立业务职责的模块。
2. 删除模块而不搬 receipt、生成 bindings、active memory、fixture 和工具会留下编译死链、运行时旧 owner 或 seed 先失败后写入的半迁移状态。
3. 只改字符串会让 operation owner、Java package、SQL schema、异常映射和 scope/transaction 归属不一致，机器门可能绿而实际 owner 仍旧。

目标是一次性把实体、持久化、owner API、edge operation metadata、测试与 seed 的“事实住址”迁入 catalog，同时保留已存在的业务语义，但不保留当前数据库中的数据。用户已明确所有数据通过 reset 丢弃、再由新 seed 重建；因此本批不设计旧表数据复制、旧 receipt 回放延续或跨版本数据兼容。历史 Flyway 文件与历史 review 记录是不可改的历史证据，不属于活动 owner；新 migration 只负责建立 catalog 目标结构并删除旧 schema，reset 后再由 seed 写入目标数据。

### 1.2 方案比较

| 方案 | 结果 | 结论 |
| --- | --- | --- |
| A. 只把 contract owner 和前端字符串改成 `catalog`，代码/表仍留在 `fulfillment-production` | 表、SQL、Spring bean、测试和 schema 仍是旧域；未来会形成“catalog 名义 owner + fulfillment 实际 owner” | 拒绝：只改元数据，未解决 owner 与事实住址。 |
| B. 把生产标签并入 `catalog.dictionary_entry`，删除独立表和 API | 生产标签有独立 scope、引用 readback、brand copy、状态/编码释放和独立 operation 语义；通用字典表无法承载这些不变量 | 拒绝：用表面相似的字典实体丢失业务身份和边界。 |
| C. 搬 owner/API/SQL/测试/操作适配器到 catalog；新增破坏性 Flyway cutover 建立 `catalog.production_tag_definition` 与独立 `catalog.production_tag_command_receipt`，删除旧 schema，reset 后由 seed 重建数据 | 保持 operation/wire/UI 行为，消除旧 module/schema/package；receipt 仍是 catalog owner-local，但不延续旧数据库中的 receipt 行 | **采用**：它同时改变真实 owner 与数据库事实住址，且把“保留业务语义”和“丢弃当前数据”明确分开。 |
| D. 只在 reset/seed 脚本中换 owner，数据库和运行代码仍留在 `fulfillment-production` | reset 后表、SQL、Spring bean、契约和 schema 仍是旧域；新数据只是被写回旧 owner | 拒绝：reset/seed 是数据生命周期动作，不能替代 owner、schema、契约和模块的根迁移。 |

### 1.3 reset-first 语义冻结

- 本批采用 reset-first cutover：当前数据库中的 tag、item reference 和 receipt 行不迁移、不保留；reset 负责清空并重建数据库，随后 seed 负责重新写入 catalog 事实。
- `tag_ref`、商品单标签关系、三态和编码释放规则仍是业务语义，但它们由新 seed 重新建立，不要求与 reset 前 UUID 或历史 receipt 对应。
- 目标 receipt 表保持 `(data_node_ref, idempotency_key)` 唯一域、`operation_id`、`request_hash`、可空 `response_json` 和创建时间；不与已有 `catalog.command_receipt` 合并，因为 reset 后也必须避免未来两个 owner 的幂等键空间碰撞。
- 新代码只读/写 catalog schema。旧 schema 只会作为历史 Flyway 在 reset 时被建立再由新 cutover migration 删除；cutover 完成后运行 SQL、契约、active tests、seed 和工具不再引用它。

## 2 · CP 总览

| CP | 主题 | owner | 主要输出 | 依赖 |
| --- | --- | --- | --- | --- |
| CP-00 | 当前字节分母、历史/活动引用分类、reset-first 前置 | 主 agent 只读 | 完整 impact ledger、reset/seed 依赖清单、停止点 | 无 |
| CP-01 | Contract source、owner registry 与生成链 | catalog / contract | 四个 operation 的 owner= catalog；schema shard 迁入 catalog；生成物重建 | CP-00 |
| CP-02 | Flyway 目标结构建立与旧 schema 删除 | catalog DB owner | `catalog.production_tag_definition`、`catalog.production_tag_command_receipt`、删除旧表/schema；不复制旧数据 | CP-00；必须在 reset/seed 前完成 |
| CP-03 | Java owner/API/persistence/operation wiring | catalog | 新 catalog package、coordinator/owner/edge/error 依赖、删除旧 module | CP-01；CP-02 的目标 SQL 形状冻结后 |
| CP-04 | operations-admin 生成消费者与活动设计语料 | operations-admin / catalog contract | 生成 API owner、catalog model owner、active design/memory 路径更新；UI 行为不变 | CP-01 |
| CP-05 | 测试、fixture、seed、L2 与静态检查闭环 | catalog + app | module/app/acceptance/seed/L2/check 分母同步，红变异覆盖旧 owner，reset 后 readback | CP-01～04 |
| CP-06 | 三维对账、逐代码对账与动态验证准备 | 主 agent + fresh reviewers | MATCHED/OPEN 对账、未授权动作清单、后续实施交付门 | CP-05 |

## 3 · 横切机制对照表

| 机制 | ① 用哪个现成能力/规范 | ② 如何验证 | ③ 无现成时必须符合的形态 | ④ 本批适用全集 |
| --- | --- | --- | --- | --- |
| 读侧节点授权 | `project-memory/kernel/04-contract-consumer-and-admin.md`；既有 production-tag path 的 `x-consumer-faces`、`x-allowed-data-node-types`、session scope resolver | 用 head-company/store 两类合法上下文和越界 data node 各读一次；owner 只接受可信 context 中的 scope | 若需要新增授权，必须进入 operation identity 和 owner recheck；本批不新增维度 | `getOperationsProductionTags`、商品目录已有生产标签 readback、Catalog item read |
| 写授权与 grant 复核 | `ProductionTagOwnerService` 当前 scope/grant command path；`CatalogAuthorizationScope`、既有 catalog operation adapter | create/update/transition/copy 使用 catalog operation 的 grant；篡改 scope/brand/head-company/store context 必须返回 typed problem，且无写入 | owner command 在事务内再次校验 context、scope、operation capability，不把 edge 结果当授权 | 三个 production-tag command、catalog item save 中 tag reference、brand copy |
| 跨 owner 写与事务 | `project-memory/kernel/03-transaction-data-and-dependencies.md`；`CatalogInventoryCoordinator` 的 `@Transactional` | 读取方法无事务；catalog item whole-save、brand copy 的 owner writes 在一个 REQUIRED 边界中，失败后 item/tag/inventory/receipt 均回滚 | 不跨 schema 直接 DML；跨 owner 只调公开 command API；同一 owner 的 tag API 仍保持 command boundary | tag create/update/status、CatalogInventoryCoordinator brand copy、CatalogOwnerService item save |
| 集合形态与分页 | 当前 `ProductionTagQuery`、`ProductionTagOwnerPersistence` cursor SQL、`collection-boundary-modes.md` | query/usage/status/cursor/pageSize 都进入同一 cursor identity；跨 usage/query 复用旧 cursor 被拒；rows/nextCursor/total 与当前契约一致 | 不把 bounded/cursor 改成 page；不在前端 slice；不扩大 page size | 生产标签 GET、Catalog field runtime candidate read、dictionary drawer read |
| 缓存失效 / 改完刷新什么 | `contracts/catalog/catalog-inventory-rtk-tag-policy.json`、generated RTK tag policy | create/update/status 后 production tag query 和商品 detail 的相关 tag 失效并重取；配置 drawer 保存后不丢父商品草稿 | 只能改生成源再重生成，不手改 RTK generated；不增加 UI 级镜像事实 | 四个 production-tag operations、商品编辑/字典抽屉消费者 |
| RTK 数据读取与加载判定 | `doc/platform/frontend-coding-standard.md §3-B`；现有 `CatalogDictionaryDrawerState` 的 `currentData`/`isFetching` 形态 | 切换 scope/query 时渲染的是当前参数的 currentData，加载/刷新来自 isFetching；静态测试禁止旧 owner fallback 复活 | 无新增 UI；迁移不改变 query identity 或 loading semantics | `CatalogDictionaryDrawerState.tsx`、`CatalogItemProductionEditor.tsx`、`catalogFieldRuntime.ts` |
| 同一事实只有一个住址 | `doc/platform/frontend-coding-standard.md §3-E`；owner readback 是唯一业务事实源 | UI 不在本地 state 镜像 owner 或自行拼生产标签；生成 owner 字段只来自 catalog contract | 不新建 `fulfillmentProductionTag` fallback；不在前端另存 owner truth | ProductionTag option/view/model、catalog detail/readback |
| 失败可见且原因不得改写 | 前端 §3-D；`ContractProblemAdvice`；当前 `ProductionTagOwnerApi.Problem` 注册 | 非法 scope、重复 active code、版本冲突、引用作废阻断、receipt mismatch 各自映射为既有 typed problem；drawer 保留草稿 | 不把 owner 失败改成 network/unknown；新增问题必须注册并由文案映射覆盖 | `ContractProblemAdvice.java`、四个 HTTP operation、frontend feedback |
| owner 错误到 HTTP 的映射与注册处 | `contracts/registry/iam-org-governance-manifest.json`、`ContractProblemAdvice`、OpenAPI TypedProblem | 旧 `FULFILLMENT_PRODUCTION` owner/problem 映射变为 catalog；每个旧问题 code 仍可由同一 precedence 映射；生成/静态检查拒绝旧 owner | 先改 registry source，再生成 route/governance artifacts；不在 controller 手搓 exception map | production tag problem 全集、catalog owner problem registry |
| 幂等键构成与重放语义 | `ProductionTagOwnerPersistence` receipt SQL；`V20260919...command_receipt_nullable_response.sql`；foundation receipt conventions | 新 receipt 表中 null response claim 可重放/完成；同 key 同 hash 同 operation 返回原 readback；不同 hash/operation typed mismatch；失败回滚可重试 | receipt 仍 owner-local；不得把 null response 当成功业务结果；不得合并既有 catalog receipt 表 | create/update/status/copy tag commands |
| 该用生成物的地方不得手搓字符串 | 后端 §2-D；`scripts/generate/catalog-inventory-p1.mjs`、`operation-handler-bindings.mjs`、P3 frontend generator | 变更 source shard/registry 后生成 OpenAPI/Java/TS/route/binding，随后 exact-set tests 对账；源与生成物 digest 一致 | generated 文件只由 generator 产出；不能直接编辑 `catalog-inventory.openapi.json`、RTK、binding Java | contract、backend wire、frontend RTK、operation bindings、shape manifest |
| 日志落点与脱敏字段 | `AGENTS.md` observability；`doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md` | 迁移/seed/test report 记录阶段、run、owner、counts、cleanup；不写 token/cookie/raw payload/完整业务值；业务与 cleanup 分开 | 新增日志沿既有结构化 run-scoped logger；只输出安全 ref/code 摘要 | Flyway preflight、backend acceptance、seed executor、generated/runner diagnostics |
| reset-first schema cutover | 单一 PostgreSQL/Flyway；历史 migration 会在 reset 中重放 | 新 migration 创建 catalog 目标表/索引并删除旧两表和旧 schema；不读取、不复制旧行；reset 后 seed 写入新事实 | 不提供 dual-read/dual-write/fallback；回滚依赖重新 reset 到目标版本并重新 seed，不做旧数据恢复 | 两张目标表、旧 schema、catalog item/reference 的新 seed |
| 迁移回填与可逆性 | 用户已明确所有数据 reset 后再 seed；本批是 owner relocation，不是数据保全迁移 | `N/A_WITH_REASON`：不做旧 tag/ref/receipt 回填，不保留旧 UUID/receipt 连续性；只验证 reset 后空目标和新 seed readback | 如发现任何实现路径需要旧行回填、双读、双写或旧 receipt rollback，立即停机；可逆操作仅为重新 reset 到目标版本并重新 seed | 旧 `fulfillment_production.production_tag_definition`、旧 `command_receipt`、旧 `catalog_item_reference(kind=PRODUCTION_TAG)` 与新 catalog 目标表 |
| 前端共享行为(Drawer/列表/表单生命周期) | 前端 foundation 与既有 catalog dictionary Drawer | UI DOM、控件、dirty guard、错误/恢复、焦点和页面层级与迁移前静态/render/L2 基线一致；只允许 owner metadata 改变 | 不为迁移新造 surface；子控件不自建 dirty/close guard | `CatalogDictionaryDrawerState/View`、Catalog item production editor/view |
| 管理后台交互一致性 | 前端 §3-K-1..§3-K-10；现有 catalog UI/IA | 逐 screen 对照既有生产标签配置与商品编辑：位置、样式、动作、失败保留草稿、停用既有绑定回显均 unchanged | 无新增 IA/interaction；不能把 technical owner 文案展示给用户 | 生产标签配置 Drawer、商品编辑 production tag control、L2 catalog screens |
| 候选/下拉数据源 | `CatalogFieldRuntime`、`getOperationsProductionTags` contract、owner task read | candidate scope/status/query/cursor 仍由 GET owner read；停用只保留既有绑定，不进入新候选 | 不从 fixture、catalog item JSON 或本地硬编码构造候选 | dictionary create/edit、item production tag selection |
| 编码与名称呈现 | `confirmed-business-language-corpus.md#CIPG-01`、ProductionTag wire schema | API 仍返回 code/name/status/ref/version；前端按业务词显示，不把 owner/module/schema 展示出来 | 只改技术 owner；不改生产标签用户称谓 | page rows、select options、detail/readback、seed report |
| 会同时坏的东西是否已声明为原子组 | `doc/platform/foundation-charter.md §5-C`；CP-01～05 | contract owner、Java package、schema、generated bindings、frontend metadata、tests/seed 必须同时切换；任一旧活动引用即 OPEN | 不把“先只改 contract”作为可交付中间态 | 整个 ProductionTagDefinition 迁移组 |

### 3.1 闭包等级口径

本批不把“搜索结果归零”宣称为 `PROVES_CLOSURE`。所有静态门均标为 `NECESSARY_NOT_SUFFICIENT`，并写明漏检边界；行为、reset 后 seed 数据、事务、引用回读和 UI 不漂移依靠 focused/integration/acceptance/L2 与独立 review。尤其旧字符串在历史 migration/review 文档中可以合法存在，文本门必须限定 active runtime/contract/test/seed roots，不能用全仓零命中制造假绿。

## 3a · L2 脚本开发前 UI/testId 前置复核

`N/A_WITH_REASON`（本批不新增 UI-bearing Journey、不新增控件、不改变 IA/交互工件）。仍需在实施后做 catalog 既有页面回归：

- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogSimpleDictionaryLibrary.tsx` 的生产标签库入口、Drawer、create/edit/status action 与既有 `catalogTestIds` 一一对应。
- `CatalogItemProductionEditor.tsx`/`CatalogItemProductionView.tsx` 的现有生产标签选择、既有停用值回显和商品保存 readback 不因 owner 字符串迁移改变。
- `apps/frontend/operations-admin/src/tests/l2/catalog-inventory.spec.ts` 与 `scripts/test/browser-l2-runtime.mjs` 的 locator、network operation IDs 和 business oracle 仍指向同一用户行为；这里只更新 owner/readback 预期，不新增宽 locator。

没有新的 IA ID，因此不能以“没有新 testId”为理由跳过既有控件的 static/render/L2 regression；实施前仍要先做 UI/testId 对账，若现有基线有 OPEN 先停在原问题，不把它归因于 owner 迁移。

## 4 · 每个 CP 的门控

### CP-00 · 分母、历史边界与 reset-first 前置

1. 以 `rg` 生成四个分桶：active source、generated source/output、seed/test/check、historical-only。必须包含 `fulfillment-production`、`fulfillment_production`、旧 Java package、`ProductionTagOwnerApi/Service`、四个 operation owner、schema/table、receipt SQL 和前端 owner fallback。
2. 打开并确认 owning source，不能把 `doc/review`、已经执行过的历史 Flyway migration 或 `catalog-inventory.openapi.json` 这类 generated snapshot 当作修改源。
3. 只读确认目标 schema/索引/约束、reset/seed 入口和 active source 分母；不建立旧行 count、键 hash、source-to-target 映射或历史 receipt collision 分母。
4. `PROOF_LEVEL=NECESSARY_NOT_SUFFICIENT`：分母只能证明扫描范围；不能证明业务语义、reset 成功或 seed readback。

停止条件：找出第二个未登记的业务实体、reset 无法清空并重建 schema、目标结构与本文不符，或 production tag 事实需要额外旧数据才能被 seed 建立。

### CP-01 · Contract 与生成链

- 修改源：`contracts/openapi/paths/operations-admin/production-tag-management.paths.json`、`contracts/openapi/components/fulfillment-production/production-tag.schemas.json`（迁为 `components/catalog/production-tag.schemas.json`）、`contracts/catalog/catalog-inventory-edge-placement.json`、`catalog-inventory-edge-contract.json`、`catalog-inventory-rtk-tag-policy.json`、`contracts/registry/operation-handler-bindings.json`、`iam-org-governance-manifest.json`、`scripts/generate/catalog-inventory-p1.mjs`、`operation-handler-bindings.mjs`、`catalog-inventory-workspace-command-tokens.mjs`、P3 frontend generator、`tools/capability-invariants/cli.mjs` 的 owner registry。
- 保持四个 operation ID、path/method/face/context/transaction/capability/query/wire schema；只把 owner module、owner namespace、problem mapping、schema shard 和生成 output module 改为 catalog。
- 生成：OpenAPI aggregate、edge route registry、catalog operation binding、workspace command-token Java、wire Java/TS、RTK hooks/tag policy、shape/editor manifest、governance artifacts。禁止直接编辑 generated JSON/Java/TS。
- `getOperationsProductionTags` 是现有 controller→`CatalogInventoryCoordinator.readProductionTags` 的 coordinator-owned GET。其 `adapter` 字段是 operation binding 的 owner/命名空间元数据，不是要求仓内存在同名 Java adapter class；详设与生成器必须把这一点显式冻结，并以“真实 controller/coordinator call chain + owner metadata=catalog”校验，不能因为迁 owner 而凭空新增 GET adapter，也不能把 metadata-only 行误当成可反射的实现类。
- red mutation：任一 source operation 保留 `ownerModule=fulfillment-production`、schema shard 仍在旧目录、operation binding 落到旧 package、owner module 从 generator allowlist 删除但 route 未更新时，静态 generator 必须失败。
- GET 负向 proof：`getOperationsProductionTags` 必须留在 generator 的 coordinator-owned read 集合，不得进入 command-adapter 集合；不得生成或调用 `GetOperationsProductionTagsOperation.java`。其唯一运行链是 controller → `CatalogInventoryCoordinator.readProductionTags`，generated `OwnerLocalAdapters`/`invoke` 分支只承载 binding metadata/编译支持，不得成为 GET 的运行时路由。三个 command 则必须各自有实际 catalog operation adapter class；将 GET 加入 command 集合或删除任一 command class 的 red mutation 必须失败。

### CP-02 · 目标结构与 Flyway

新增一个未占用的版本化 migration（实施前重新读取目录确认版本号）：

1. `CREATE TABLE catalog.production_tag_definition`，列为当前旧表 post-kind-retirement 的业务列，不含 `tag_kind`；保留 primary key、status 三态 check、active-code partial unique index、scope/status/code index。
2. `CREATE TABLE catalog.production_tag_command_receipt`，列为 `receipt_ref,data_node_ref,idempotency_key,operation_id,request_hash,response_json,created_at_epoch_millis`；`response_json` 可空，唯一键仍为 `(data_node_ref,idempotency_key)`。
3. 不读取、不复制、不校验旧表行；不得出现 `INSERT ... SELECT`、code 映射、UUID 映射或旧 receipt 回放迁移。
4. `DROP TABLE fulfillment_production.production_tag_definition`、`DROP TABLE fulfillment_production.command_receipt`、`DROP SCHEMA fulfillment_production`，并校验目标表/索引/约束存在。任何额外对象使 migration fail closed。
5. reset 完成后再由 catalog seed 建立新的 tag/ref；migration 不对旧 `catalog.catalog_item_reference` 做 continuity 断言。

历史文件 `V20260806...`、`V20260807...`、`V20260808...`、`V20260816...`、`V20260825...`、`V20260919...` 不改写；它们仍描述历史执行顺序。新 migration 是 reset 后唯一 runtime cutover 住址，不能加 dual-read/dual-write。

### CP-03 · Catalog owner 与 edge wiring

将下面五个旧模块主类物理迁入 catalog 对应 package，并统一改名为 `CatalogProductionTag...` 前缀，避免代码继续把它当外域 owner：

- `ProductionTagOwnerApi` → `modules/catalog/.../api/CatalogProductionTagOwnerApi.java`；records/problem 语义不变。
- `ProductionTagOwnerService` → `modules/catalog/.../application/CatalogProductionTagOwnerService.java`；保留 owner grant、version、idempotency、advisory lock、copy preflight/execute、readback。
- `ProductionTagTaskReadService` → catalog application；仍由 catalog owner 直接提供 task read。
- `ProductionTagOwnerPersistence` / `ProductionTagOwnerServiceSql` → catalog application/persistence；所有 active SQL 改为 `catalog.production_tag_definition` 与 `catalog.production_tag_command_receipt`。
- 三个 app operation adapter → `com.catering.v2s.catalog.application.operations.*`；`getOperationsProductionTags` 的 GET binding 明确标注为 coordinator-owned metadata-only binding，`operation-handler-bindings.mjs` 的 expected-adapter 生成/校验不得把它当成需要反射或编译存在的 Java class；现有 controller GET 继续走 `CatalogInventoryCoordinator.readProductionTags`。命令 adapter 仍必须是实际 catalog operation class，不能把 metadata-only 例外扩到 command。

同步更新 `CatalogInventoryCoordinator`、`CatalogWorkbenchReadService`、`CatalogOwnerService`、`CatalogCopyService`、`CatalogItemService`、`ContractProblemAdvice`、`OperationsCatalogInventoryController` 的 import/字段/注释/typed problem。`CatalogWorkbenchReadService` 的 navigation（约 680-682 行）改为 required catalog API，item preparation/reference（约 1136-1138 行）只迁 API/package 与既有 typed problem；reference-count/read-model（约 733-740 行）继续使用 `CatalogWorkbenchReadPersistence.readProductionTagReferenceCounts` 的 catalog-owned `catalog_item_reference` 事实，不得为了统一形态改走 production-tag owner API。前两条的输出 owner 从 `fulfillment-production` 改为 `catalog`；第三条保持原有 catalog persistence/read breakdown。`CatalogOwnerApi.productionTagReferenced` 仍表示 catalog 自有商品引用事实；不增加 catalog 对自己的跨模块依赖，不把引用检查搬到前端。

`CatalogWorkbenchReadService` 的 navigation owner API 依赖必须 required/non-null。删除 navigation 当前的 `null → []` 成功兜底；owner wiring 缺失必须在构造/启动或 focused failure 中显式失败，不能把基础设施缺失伪装为空列表。item preparation 当前已有 typed `RESULT_UNKNOWN`（`CatalogWorkbenchReadService.java:1136-1138`），只迁 API/package 与 problem type；reference-count/read-model 继续由 `CatalogWorkbenchReadPersistence.readProductionTagReferenceCounts`（`CatalogWorkbenchReadPersistence.java:394`）读取 catalog-owned `catalog_item_reference`，不得改走 production-tag owner API。`ProductionTagOwnerPersistence` 当前的 receipt lock 不是一个点：`:122`、`:205` 的 `"production-receipt:" + scope` 组合值以及 `:364` 的 `AdvisoryLock.acquire(..., "production-receipt", ...)` 都必须迁为 `"catalog-production-receipt"`；`foundation/persistence/AdvisoryLock.java:20-22` 是通用 helper 定义，必须排除在本批替换之外。静态/行为测试必须同时拒绝活动代码继续使用旧 namespace 与漏改任一调用形态。

移除 `modules/fulfillment-production` 的 `build.gradle.kts`、source/test package、root settings include、app/catalog Gradle dependency；移除后 active Java/package 搜索不得命中旧 module。保留历史文档和历史 migration 中的旧路径，并在静态门的排除表明确原因。

### CP-04 · 前端与活动设计语料

- generated API 的 owner 元数据由 CP-01 派生；hooks、operation IDs、path 和 wire shape 不改。
- `CatalogItemProductionEditor.tsx` 两处 `owner: 'fulfillment-production'` 改为从 catalog generated/constant 取得的 `catalog`，不得保留 fallback；`CatalogItemProductionView.tsx` 同样改为 catalog，最好消除裸 owner 字符串而不是再复制一处。
- `catalogTypes.ts`/validation/read-only presenters 的 owner union 与测试 fixture 改为 catalog；`CatalogDictionaryDrawerState/View`、`catalogFieldRuntime`、`catalogTestIds` 的业务行为不改。
- `contracts/catalog/catalog-item-editor-manifest.json` 的 production tag linkage owner 改为 catalog；生成 TS/manifest 只通过 generator 更新。
- 更新当前活动的 `doc/decisions/2026-08-17-v2s-catalog-metadata-central-modal.md`、`doc/decisions/2026-08-23-v2s-catalog-library-workbench-journey.md`、`...production-guidance-journey.md`、`...ui-interaction.md` 中的 owner path；历史 review 不改。更新 `project-memory/practices/backend-capability-lookup.md` 的 active module/API/receipt 目录。业务语料 CIPG-01 的用户语义不改。

### CP-05 · 测试、seed、检查链

所有旧测试不能靠“包路径变化”机械替换；每个测试重新确认它测的是 owner 语义、契约、scope、事务、reset 后目标 schema、seed readback 还是 UI 行为。完整分母见 §9a/§10b/§11。

### CP-06 · 交付前验证边界

当前已获得实施授权，但仍不运行 Browser L2/UAT。必须先完成每个 CP 的 focused proof、步骤级 fresh 三维对账，再做全批三维对账、逐代码与详设对账，最后按受管入口执行已授权的编译、backend acceptance、reset/DEV/seed；Browser L2/UAT 保持 `NOT_AUTHORIZED/NOT_RUN`。

## 5 · operation / path / face / 集合形态

| operationId | method/path | 新 owner | face | context/transaction | 集合/状态语义 | 预期规模与增长驱动 |
| --- | --- | --- | --- | --- | --- | --- |
| `getOperationsProductionTags` | `GET /operations/catalog-inventory/production-tags` | `catalog` | `operations-admin` | READ_CONTEXT / OUTSIDE_TRANSACTION | 保持现有 bounded cursor query：`usage/query/status/cursor/pageSize`，usage/query/pageSize 进入 cursor identity；管理读可看停用，候选读只给启用，新旧既有绑定由商品 readback 单独回显。 | `CollectionRequestSupport` 接受 1..100、默认 20；正常 fixture 0–20 行，pageSize=20 的边界至少覆盖 21 行，pageSize=100 覆盖上限和超过上限的合成数据；增长驱动是同一 `dataNodeRef+brandRef` 下的未作废生产标签数及 query/status/usage 分布，不是商品数。 |
| `createOperationsProductionTag` | `POST /operations/catalog-inventory/production-tags` | `catalog` | `operations-admin` | WORKSPACE_EXECUTION_CONTEXT / REQUIRED | owner create、scope/grant、active code 唯一、receipt replay、authoritative readback。 | 单次只写一个 tag definition 和一个 owner receipt；增长驱动是标签定义数、商品引用数与命令 receipt 数，不把集合 payload 扩成批量写。 |
| `updateOperationsProductionTag` | `PATCH /operations/catalog-inventory/production-tags/{tagCode}` | `catalog` | `operations-admin` | WORKSPACE_EXECUTION_CONTEXT / REQUIRED | name/version/active row 更新；作废行不被普通更新误当启用行；版本冲突 typed。 | 单次更新一个 tag row，并按幂等语义产生/复用一个 receipt；增长驱动是标签定义与引用规模，读回仍为单行 authoritative readback。 |
| `transitionOperationsProductionTagStatus` | `POST /operations/catalog-inventory/production-tags/{tagCode}/status` | `catalog` | `operations-admin` | WORKSPACE_EXECUTION_CONTEXT / REQUIRED | ENABLED↔DISABLED，转 VOIDED 前保留既有 catalog item reference 规则；作废释放 code；无物理删除。 | 单次改变一个 tag row 的状态；增长驱动是同 scope 下标签/商品引用检查与 receipt 数，不引入批量状态 payload。 |

路径、operationId、wire names、capability keys 和前端 hooks 不因 owner 迁移而重命名。`ownerModule`、generated adapter namespace、governance owner/recheck 和 persistence schema 是本批唯一需要变更的 operation metadata。

### 5.1 operation-specific DB 与性能合同

| operation | edge → coordinator → owner → transaction → typed problem → readback | 正常/边界 fixture | 性能与 DB 合同来源/处置 |
| --- | --- | --- | --- |
| `getOperationsProductionTags` | `OperationsCatalogInventoryController` → `CatalogInventoryCoordinator.readProductionTags` → `CatalogProductionTagOwnerService.readTags` → `CatalogProductionTagOwnerPersistence`；read 为 `OUTSIDE_TRANSACTION`；非法 scope/query/cursor/pageSize 走既有 typed problem；返回 rows/nextCursor/total | 0、1、20、21、100+ 行；同 cursor 改 query/usage/status/pageSize 必拒绝 | `CollectionRequestSupport.java:14-31` 冻结 1..100/default20；`contracts/policy/catalog-inventory-assertion-matrix.json` 的 GET entry 与 `backend-performance-cp05-calibration-report.json` 是实施时更新/复核的来源。当前 DB max budget 仍以 assertion matrix 为基线，不因迁 owner 自动放宽；任何增加必须有 Dexter `decisionRef`。 |
| 三个 command | generated catalog command adapter → `CatalogProductionTagOwnerService` → catalog persistence/owner-local receipt，整个 command 为 `REQUIRED`；scope/grant/version/idempotency/reference problem 在 owner 产生；readback 从 catalog owner 返回 | 每次一个 tag row；create duplicate、update stale version、status/reference、same-key/null-response replay | assertion matrix 的 operation owner/coordinated-owner/read breakdown 与 DB budget、`backend-performance-cp05-calibration-report.json` 的现有校准值（create/update/transition 当前记录分别为 31/2/5）必须同步改 owner 并在实施后重新测量；校准值与 max DB budget 是不同维度，不能互相替代或默默改写。 |

本合同冻结“规模如何增长、哪条边界需要读/写多少事实”，但不把尚未运行的数字写成 PASS。实施时若迁入 catalog 使任一 operation 的实际 DB/performance 结果超出既有预算，必须停在该 operation 的 `decisionRef`，不能用删除 owner recheck、receipt、readback 或事务来降数。

## 6 · 跨 owner 写矩阵

| policy | 第一个 owner command | 第二个 owner command | 事务 | 失败时的回滚事实 |
| --- | --- | --- | --- | --- |
| 生产标签 create/update/status | catalog production-tag owner command | N/A | operation adapter → `CatalogProductionTagOwnerService` 的 REQUIRED 事务 | tag 行、catalog receipt、version 均回滚；typed problem 可见；同 key 可重试 |
| 商品保存绑定生产标签 | catalog catalog-item command | catalog production-tag read/reference fact（同一 module API，不是跨 owner 写） | 既有 `CatalogInventoryCoordinator.saveCatalogItem` REQUIRED | item/reference/version/receipt 不产生半写；tag 状态和 scope 在 catalog owner readback 复核 |
| brand copy | catalog copy command | inventory owner command；生产标签 copy 已成为 catalog owner command | 既有 coordinator REQUIRED；调用顺序与失败回滚不变 | catalog item/tag、inventory facts、receipt 全部回滚；preflight digest mismatch 不执行 |
| asset/inventory 与生产标签 | asset/inventory 各自仍由其 owner 负责 | 不新增生产标签对 asset/inventory 的写 | 保持既有调用者事务；本批不把生产标签塞进其他 owner | 不改变库存/BOM/asset 事实；迁移只搬 catalog tag/receipt |

没有跨 schema 运行时 DML、FK 或 read edge。唯一跨 schema 旧引用是历史 Flyway 迁移和最终 data cutover，属于一次性数据库迁移，不是运行时 owner 依赖。

## 7 · 声明—传递—消费矩阵

| fact | declaration | transfer | consumption | proof |
| --- | --- | --- | --- | --- |
| owner | OpenAPI path `x-owner-module=catalog`、edge placement、binding source | generated route/binding/governance owner | Catalog API、operation adapter、frontend generated owner | generated exact-set + old-owner red mutation |
| storage | migration target `catalog.production_tag_definition` | reset 后空表；seed 写入新的 tag_ref/scope/version | Catalog persistence SQL | schema shape + post-seed readback |
| receipt namespace | `catalog.production_tag_command_receipt` | reset 后空表；后续命令写入 nullable response receipt | Catalog tag persistence replay | null-response replay、same-key mismatch；无旧行 collision |
| lifecycle | owner-read-model standard 三态与现有 tag command | typed status command/readback | list candidate、既有绑定、UI status | status matrix + existing reference cases |
| scope/grant | existing capability keys and CatalogAuthorizationScope | edge context → owner command context | owner grant/recheck | scope mutation scenario |
| reference | `catalog.catalog_item_reference(kind=PRODUCTION_TAG, ref=tag_ref)` | no ref rewrite; new owner reads same UUID | CatalogItemService / transition guard | item save and void-reference oracle |
| collection | ProductionTagQuery fields and cursor identity | edge query → task read → SQL | dictionary drawer/editor candidates | cross-query cursor rejection + rows/total |
| errors | `ProductionTagOwnerApi.Problem` current code set | `ContractProblemAdvice` + registry | HTTP problem and existing UI feedback | code mapping matrix + no reason rewrite |
| cache | RTK tag policy source | generated invalidation | dictionary/item screens refetch | source/generator/runtime policy tests |
| generated contract | source shards + generator revisions | OpenAPI/Java/TS/registry | controller and frontend client | regenerate then source/output equality |
| seed identity | catalog fixture `productionTagDefinitions` | catalog seed executor command | owner readback and item reference | seed executor static/readback assertions |
| user language | CIPG-01 “生产标签” | wire code/name only | frontend dictionary/editor | visible text scan + UI regression |
| migration boundary | Flyway versioned cutover | reset 后 old schema → empty catalog schema | runtime only catalog after cutover | old schema drop, empty target before seed, active-source zero scan |
| logging | observability standard | preflight/acceptance/seed run logs | business vs cleanup report | redaction/manifest log inspection |

## 8 · 业务规则 → owner 判定点

| 规则 | owner 判定点 |
| --- | --- |
| scope 为 `dataNodeRef + brandRef` | `CatalogProductionTagOwnerService` command/read entry；不得由前端或 SQL 默认 scope |
| 操作 capability/grant 合法 | edge resolver + catalog owner command recheck；旧 capability key 保持稳定 |
| active code 在同 scope/brand 唯一 | target partial unique index + owner typed conflict；VOIDED 不占用 code |
| lifecycle 只有 ENABLED/DISABLED/VOIDED | target check、owner transition、wire status、frontend dictionary |
| DISABLED 可管理、不可进入新候选 | read usage predicate；既有商品引用通过 item readback 回显 |
| VOIDED 不可新选、释放 code | candidate/status predicate、partial unique index、transition guard |
| 作废既有引用的处理 | `CatalogOwnerApi.productionTagReferenced` / CatalogItemService 既有事实检查；不得由 edge 猜测 |
| 更新需要 expected version | owner persistence update/status where version；冲突 typed 且无局部写入 |
| command idempotency | `catalog.production_tag_command_receipt` replay/hash/operation check |
| brand copy | catalog tag owner preflight/execute，scope 重建、冲突 fail closed、tag_ref/readback 由 owner 负责 |
| 商品最多一个生产标签 | CatalogItemService/`catalog_item_reference` 既有 rule；本批不把它移到前端或 tag table |
| 不实现生产路由 | 任何 owner、seed、契约、UI 不增加 route/KDS/打印/队列字段 |
| reset 后数据重建 | seed fixture、目标 schema、tag/ref/receipt readback；不声明旧 UUID/receipt continuity |

## 9 · owner API 与消费者清单

### 9.1 目标 owner 文件

| 目标文件 | 责任 |
| --- | --- |
| `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/api/CatalogProductionTagOwnerApi.java` | catalog 原生公开 owner API、command/readback/problem/brand-copy records |
| `.../catalog/application/CatalogProductionTagOwnerService.java` | scope/grant/version/status/idempotency/lock/readback/brand-copy owner 语义 |
| `.../catalog/application/CatalogProductionTagTaskReadService.java` | bounded task read，直接调 catalog owner |
| `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogWorkbenchReadService.java` | workbench navigation、item preparation/reference readback 与 reference-count 输出；不得注入旧 `ProductionTagOwnerApi`，输出 owner 固定为 catalog |
| `.../catalog/application/persistence/CatalogProductionTagOwnerPersistence.java` | catalog schema SQL、receipt、row mapping、cursor |
| `.../catalog/application/persistence/CatalogProductionTagOwnerServiceSql.java` | 单点 SQL 常量；不得散落在 coordinator/controller |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/catalog/application/operations/{Create,Update,Transition}OperationsProductionTag*Operation.java` | app edge typed binding adapter；包名与 owner namespace 一致 |

### 9.2 直接消费者全集

- `CatalogInventoryCoordinator`：production tag read、brand copy preflight/execute。
- `CatalogOwnerService`：构造注入、CatalogItemService 组合、reference guard。
- `CatalogCopyService`：当前 tag copy preparation/execute wiring。
- `CatalogItemService`：tag reference resolution、detail/readback、save validation。
- `OperationsCatalogInventoryController`：GET 仍 coordinator；GET binding 只提供 owner metadata，不是 Java adapter 的运行时入口；三个 command 仍 generated binding。
- `CatalogWorkbenchReadService`：三条路径必须分别按当前 owning source 处理：navigation（约 680-682 行）改为 required catalog API，删除 `null → []` 成功兜底并把 owner 输出改为 catalog；item preparation/reference（约 1136-1138 行）保留既有 typed problem，只迁 API/package；reference-count/read-model（约 733-740 行）继续读取 `CatalogWorkbenchReadPersistence.readProductionTagReferenceCounts`（当前 `CatalogWorkbenchReadPersistence.java:394` 的 catalog-owned `catalog_item_reference` 事实），不得为了“统一”改走 production-tag owner API。只有前两条是 owner API consumer，第三条保持 catalog read-model persistence 语义。
- `ContractProblemAdvice`：owner problem class import/registration。
- `CatalogInventoryReadTransactionTopologyTest`、catalog module integration tests、app operation tests。
- operations-admin generated client/RTK、`catalogFieldRuntime`、dictionary drawer state/view、item production editor/view、catalog types/validation/presenters。
- catalog acceptance、seed executor、fixture schema/source、catalog L2 fixture/runtime/spec、catalog check/generator tools。

不存在的消费者不得凭空创建：当前 GET 的 registry adapter metadata 不等于必须新建 Java class；controller 已有 coordinator read path，实施只更新 generated owner metadata并保持真实 call chain。

## 9a · 实施前全链同步变更清单

| 事实/载体 | 精确路径 | 处置 | 证明 |
| --- | --- | --- | --- |
| HTTP owner/path | `contracts/openapi/paths/operations-admin/production-tag-management.paths.json` | 同步修改 `x-owner-module`，路径和 operationId 不变 | source/generator red mutation |
| wire schema shard | `contracts/openapi/components/fulfillment-production/production-tag.schemas.json` → `components/catalog/production-tag.schemas.json` | 移动源 shard，引用同步 | OpenAPI aggregate source-set check |
| edge placement/contract | `contracts/catalog/catalog-inventory-edge-placement.json`、`catalog-inventory-edge-contract.json` | owner/initiatingOwner/target 更新 | exact operation owner matrix |
| RTK policy/shape manifest | `contracts/catalog/catalog-inventory-rtk-tag-policy.json`、`catalog-item-editor-manifest.json` | 只改 owner metadata，invalidates/fields不漂移 | generator and frontend static test |
| binding/governance source | `contracts/registry/operation-handler-bindings.json`、`iam-org-governance-manifest.json` | owner/adapter namespace/problem mapping更新；GET binding 保持 metadata-only 语义，command adapter 必须实际存在 | generated binding + governance check + GET call-chain assertion |
| generator owner maps | `scripts/generate/catalog-inventory-p1.mjs`、`operation-handler-bindings.mjs`、`catalog-inventory-workspace-command-tokens.mjs`、`catalog-inventory-p3-frontend.mjs` | source-of-truth update；去旧 module from active allowlist；token generator 的 `storeOperatingRuleGateOwners` 只保留活动 owner，三个 production-tag command token 的 owner/gate 派生必须随之改为 catalog | red mutation old owner + generated token exact-set |
| operation scale/performance | `modules/foundation/.../CollectionRequestSupport.java:14-31`、`contracts/policy/catalog-inventory-assertion-matrix.json`、`contracts/policy/backend-performance-cp05-calibration-report.json` | 保留 GET 1..100/default20、cursor identity 与 command 单对象语义；更新 owner/read breakdown、operation-specific calibration source 和 DB budget 复核，不静默增预算 | boundary fixture 0/20/21/100+；`getOperationsProductionTags` 当前校准值 9、create/update/transition 当前校准值 31/2/5 均需重测；超预算必须 decisionRef |
| active lifecycle/reference policy | `contracts/policy/lifecycle-vocabulary.json:14-18`、`contracts/policy/catalog-inventory-reference-path-matrix.json:14,18` | active lifecycle target/source owner 改 catalog；R07/R11 的 `sourceLookup` 改为 `catalog.production_tag_definition`；历史路径保留在排除表 | policy positive + old owner red mutation |
| active L2 policy/oracle | `contracts/policy/catalog-inventory-l2-case-blueprint.json:328`、`contracts/policy/catalog-inventory-l2-scenarios.json:1904,1939,1956` | ownerGraph、network/oracle 与 readback expectation 改 catalog；1904/1939 的 owner 值改为 catalog；1956 不再写“不同 owner surface”，改为“商品字典与生产标签仍由不同业务入口/operation surface 管理，入口不混用”；用户动作、控件、testId、状态/失败语义不变 | L2 fixture static exact-set + later authorized run |
| backend performance generator | `scripts/generate/backend-performance-m1-command-execution-bindings.mjs:9,356-377,444`、`contracts/policy/backend-performance-cp05-calibration-report.json` | 生成 imports/class namespace 从 fulfillment-production 改 catalog；create/update/transition 的 generated exact-set 与校准值同步复核 | old import red mutation、missing class red mutation、calibration/readback |
| assertion matrix | `contracts/policy/catalog-inventory-assertion-matrix.json` production-tag entries and related coordinated-owner/read breakdown/DB budget | 四个 operation 的 initiatingOwner/coordinatedOwners/read breakdown/DB budget 改为 catalog 语义；`transitionOperationsProductionTagStatus` 明确 `initiatingOwner=catalog`、`coordinatedOwners=[]`。Java adapter 仍可调用 `CatalogProductionTagOwnerApi` 完成状态变更并调用 `CatalogOwnerApi.productionTagReferenced` 做 catalog 内商品引用事实检查，但这不是跨 owner coordination；两次调用都归 catalog-local breakdown。固定预算不得因为搬 owner 自动改变 | matrix source check + operation-specific performance proof |
| generated contract outputs | `contracts/openapi/catalog-inventory.openapi.json`、`contracts/registry/generated/**`、backend generated route/wire、frontend generated catalog-inventory edge/RTK、shape TS | generator 派生，不手改 | digest/exact-set |
| backend owner | `modules/fulfillment-production/**` → `modules/catalog/**` | move/rename every production-tag owner source/test; remove old module | compile/package scan |
| backend application | `CatalogInventoryCoordinator`、`CatalogWorkbenchReadService`、`CatalogOwnerService`、`CatalogCopyService`、`CatalogItemService`、`ContractProblemAdvice`、operations adapters、edge controller | imports/fields/problem mappings/namespace；workbench 三条读取/输出路径一并迁 owner | focused compile + coordinator/workbench call-chain read |
| database history | `src/main/resources/db/migration/V20260806...` 等历史文件 | 不改历史；新增 cutover migration | Flyway history and immutable-history check |
| active DB SQL | 新 `V20260921...catalog_production_tag_owner_cutover.sql`（版本实施前确认） | create/constraint-verify/drop；不 copy | reset schema matrix + post-seed readback |
| frontend model | `CatalogItemProductionEditor.tsx`、`CatalogItemProductionView.tsx`、`catalogTypes.ts`、`catalogValidation.ts`、presenters | catalog owner，删除旧 fallback | focused/static readback |
| frontend state/RTK consumer | `CatalogDictionaryDrawerState.tsx`、`catalogFieldRuntime.ts`、drawer view/model | generated owner only；行为不变 | currentData/isFetching and no duplicate fact |
| backend unit/integration tests | fulfillment-production test files、app operation test、catalog module tests、transaction topology | relocate/rename to catalog; expand migration/receipt/reference matrix | all selected tests + old package absence |
| acceptance | `CatalogAcceptanceScenarios.java`、route tests、`CatalogInventoryReadTransactionTopologyTest.java` | existing operation identity preserved; add owner/reset-seed/ref subcases without wrong operation host | scenario identity/fixture/request/oracle nonempty |
| seed source | `contracts/policy/catalog-inventory-fixture-catalog.json` and schema are the production-tag fact source; `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json` is only the global r5 fixture/stage/count contract and currently has zero production-tag fact hits | production tag facts remain catalog seed facts; no fulfillment executor; do not create a second fact address in r5 fixture | source/readback/expected counts |
| seed executor/check | `scripts/dev/catalog-inventory-seed-executor.mjs`、`catalog-inventory-seed-plan.mjs`、`r5-fixture-contract.mjs`、`r5-complete-seed-executor.mjs`、related tests | owner operation/readback and phase checks update; no seed run now | static seed tests, later controlled readback |
| L2/static check | `apps/frontend/operations-admin/src/tests/l2/catalog-inventory.spec.ts`、`scripts/test/browser-l2-runtime.mjs`/tests、`catalog-inventory-l2-fixture.mjs`、`browser-l2-catalog-fixture.mjs` | update owner oracle/allowlist only; existing UI actions unchanged | preflight UI/testId and later L2 |
| repository checks | `tools/catalog-inventory-p1/cli.mjs`、`tools/capability-invariants/cli.mjs`、`tools/verify-gates/{cli,verify}.mjs`、`scripts/test/standards-enforcement-verify.test.mjs`；`catalog-inventory-p2` 按 `doc/decisions/2026-09-21-v2s-catalog-inventory-p2-retirement.md` 退役 | catalog is active owner; historical migration strings excluded explicitly; retired P2 is not an active carrier or gate | static gate + red mutation |
| active memory/design | `project-memory/practices/backend-capability-lookup.md` and current `doc/decisions/2026-08-17...`, `2026-08-23...` production guidance/workbench docs | update current owner/API references; do not rewrite historical reviews | memory/source cross-check |
| historical records | `doc/review/**` and historical Flyway content | no rewrite; label as historical | scope exclusion is documented |

### 9a.1 当前字节影响扫描的精确分母

CP-00/CP-05 必须以仓库根执行固定扫描：`rg -l -i --glob '!**/build/**' 'production.?tag|fulfillment.?production'`，范围为 `contracts/policy`、`scripts/policy`、`scripts/generate`、`scripts/dev`、`scripts/test`、`apps/backend/catering-business-server/modules`、`apps/backend/catering-business-server/src/test`、`apps/frontend/operations-admin/src/tests`；构建目录及其中的 untracked/generated 输出不进入活动源码分母。输出逐文件分入 active source、generated、seed/test/check 或 historical-only，不能只写目录名。当前只读扫描得到的 active carrier 全集如下，后续每个文件都必须有处置或 N/A_WITH_REASON：

下表中 `modules/...`、`execution-context/...`、`inventory/...`、`workspace-iam/...` 均以 `apps/backend/catering-business-server/` 为前缀；其余路径从仓库根起算。

| 分桶 | 当前字节精确路径全集 |
| --- | --- |
| catalog backend consumers | `modules/catalog/build.gradle.kts`；`CatalogOwnerApi.java`、`CatalogCopyService.java`、`CatalogInventoryCoordinator.java`、`CatalogItemService.java`、`CatalogOwnerService.java`、`CatalogOwnerValueSupport.java`、`CatalogWorkbenchReadService.java`；`persistence/CatalogItemPersistence.java`、`CatalogItemReferenceFacts.java`、`CatalogItemServiceSql.java`、`CatalogWorkbenchReadPersistence.java` |
| catalog backend tests | `CatalogBatchStatusTransitionIntegrationTest.java`、`CatalogCategoryOwnerIntegrationTest.java`、`CatalogDictionaryKindConstraintIntegrationTest.java`、`CatalogIdentificationPreparationFactsTest.java`、`CatalogInventoryCoordinatorCopySourceAuthorityTest.java` |
| old owner and app edges | `modules/fulfillment-production/**` 下 `ProductionTagOwnerApi.java`、`ProductionTagOwnerService.java`、`ProductionTagTaskReadService.java`、`ProductionTagOwnerPersistence.java`、`ProductionTagOwnerServiceSql.java` 及其四个 owner tests；`src/test/.../ProductionTagCopyConflictIntegrationTest.java`、`src/test/.../TransitionOperationsProductionTagStatusOperationTest.java`；`execution-context/.../CatalogInventoryWorkspaceCommandTokens.java`；`inventory/.../InventoryCopyService.java`；`workspace-iam/.../WorkspaceCapabilityRequirementCatalog.java` 与 `CommandExecutionContextResolverTest.java` |
| acceptance/edge/database tests | `BackendAcceptanceTest.java`、`BackendPerformanceOperationCoverage.java`、`CatalogAcceptanceScenarios.java`、`P2ReadConnectionScopeScenarios.java`、`SalesMenuAcceptanceScenarios.java`、`CatalogInventoryReadTransactionTopologyTest.java`、`OperationsCatalogInventoryControllerRouteTest.java`、`MasterDataLifecycleMigrationIntegrationTest.java:553` |
| active policy | `backend-performance-cp05-calibration-report.json`、`catalog-inventory-api-scenarios.json`、`catalog-inventory-assertion-matrix.json`、`catalog-inventory-design-byte-coverage.json`、`catalog-inventory-fixture-catalog.json`、`catalog-inventory-fixture-catalog.schema.json`、`catalog-inventory-l2-case-blueprint.json`、`catalog-inventory-l2-locator-bindings.json`、`catalog-inventory-l2-scenarios.json`、`catalog-inventory-l2-timing-budget.json`、`catalog-inventory-reference-path-matrix.json`、`lifecycle-vocabulary.json` |
| generators and seed | `scripts/generate/backend-performance-m1-command-execution-bindings.mjs`、`catalog-inventory-p1.mjs`、`catalog-inventory-p3-frontend.mjs`、`catalog-inventory-workspace-command-tokens.mjs`、`operation-handler-bindings.mjs`；`scripts/dev/catalog-inventory-seed-executor.mjs` |
| static/L2/check tests | `browser-l2-catalog-fixture.mjs`、`browser-l2-runtime.mjs`、`browser-l2-runtime.test.mjs`、`catalog-identification-migration.test.mjs`、`catalog-inventory-definition-seed.test.mjs`、`catalog-inventory-l2-fixture.mjs`、`catalog-inventory-query-envelope.test.mjs`、`catalog-inventory-reference-path-matrix.test.mjs`、`catalog-inventory-rtk-tag-generation.test.mjs`、`catalog-inventory-seed-identity.test.mjs`、`catalog-p3-model-migration.test.mjs`、`catalog-single-production-tag-migration.test.mjs`、`frontend-idempotency-boundary.test.mjs`、`frontend-transport-cache-lifecycle.test.mjs`、`l2-locator-bindings.static.test.mjs`、`standards-enforcement-verify.test.mjs`、`test-health-entry-runner.mjs` |
| frontend static/architecture/L2 | `apps/frontend/operations-admin/src/tests/architecture/catalog-test-id-exact-set.test.mjs`、`static-boundary.test.mjs`、`l2/catalog-inventory.spec.ts` |

该分母不是把每个字面量都判为缺陷：例如历史 migration、生成快照或共享测试中的引用可进入 historical-only/N/A_WITH_REASON，但必须逐文件写出理由；构建产物不属于活动源码分母，固定扫描命令必须带 `--glob '!**/build/**'` 排除它们；任何未分类文件都使 CP-00/CP-05 为 OPEN。`MasterDataLifecycleMigrationIntegrationTest.java:553` 是通用 reset 的 `DROP SCHEMA ... fulfillment_production CASCADE` 防御性清理，不是生产标签专属消费者，保留该通用行并另加目标 migration 的 catalog 空态/旧 schema absence 断言；它在生产标签 owner 分桶中记 `N/A_WITH_REASON`，不得因为命中旧 schema 名称而虚构旧 owner 运行依赖。

`apps/backend/catering-business-server/src/main/java/com/catering/v2s/fulfillment/production/application/operations/TransitionOperationsProductionTagStatusOperation.java` 是 active application edge source，不是历史文件。它当前调用 `ProductionTagOwnerApi` 做状态变更、调用 `CatalogOwnerApi` 做 catalog 商品引用 guard；迁移后两者都属于 catalog-local API。故 assertion matrix 的目标必须是 `initiatingOwner=catalog`、`coordinatedOwners=[]`，不再登记 catalog 为第二 owner，也不产生跨 owner command。实现可以保留两个 catalog-local API 调用或在 catalog owner 内收拢，但必须保持引用 guard、状态 readback 和事务事实，并在 matrix DB/read breakdown 中按 catalog-local 调用核实。

### 9b · 变更定位锚点

| 当前锚点 | 当前事实 | 目标锚点/动作 |
| --- | --- | --- |
| `ProductionTagOwnerApi` public records | owner API and problem types | `CatalogProductionTagOwnerApi` in catalog/api |
| `ProductionTagOwnerService` methods `read/readTags/readNavigationTags/readTagReferencesByRefs/write/createTag/updateTag/transitionTagStatus/copy/preflight*` | tag owner semantics | same methods in `CatalogProductionTagOwnerService` |
| `ProductionTagOwnerPersistence` + `ProductionTagOwnerServiceSql` | old schema and receipt SQL | catalog persistence names and target schema |
| `CatalogInventoryCoordinator.production` field and `readProductionTags`/brand-copy calls | catalog coordinator injects external owner | catalog production-tag API; no external module dependency |
| `CatalogOwnerService` constructor production API | item/reference composition | catalog production-tag API |
| `ContractProblemAdvice` production problem class | HTTP mapping | catalog problem class, same public problem codes |
| `operation-handler-bindings.json` four entries | owner fulfillment-production/old adapter namespace | owner catalog/catalog metadata namespace；GET 行的 adapter 只作生成身份，不新增 Java read class |
| `catalog-inventory-workspace-command-tokens.mjs` + `CatalogInventoryWorkspaceCommandTokens.java` | `storeOperatingRuleGateOwners` 包含旧 owner；3 个 production-tag command token 仍写 fulfillment-production | allowlist、owner/gate 派生及生成 token 全部改 catalog；token exact-set 与旧 owner red mutation 必须覆盖 |
| `CatalogItemProductionEditor` lines with owner fallback | frontend old owner | generated catalog owner; no fallback |
| `V20260806...` old schema + `V20260919...` receipt alter | historical source of old shape | new versioned cutover; history immutable |

## 10 · 数据迁移：reset-first 数据库切换

### 10.1 目标结构

`catalog.production_tag_definition`：

```text
tag_ref UUID PRIMARY KEY
data_node_ref TEXT NOT NULL
brand_ref TEXT NOT NULL
code TEXT NOT NULL
name TEXT NOT NULL
status TEXT NOT NULL DEFAULT 'ENABLED'
version BIGINT NOT NULL DEFAULT 1
created_at_epoch_millis BIGINT NOT NULL
updated_at_epoch_millis BIGINT NOT NULL
CHECK status IN ('ENABLED','DISABLED','VOIDED')
UNIQUE INDEX (data_node_ref, brand_ref, code) WHERE status <> 'VOIDED'
INDEX (data_node_ref, brand_ref, status, code)
```

`catalog.production_tag_command_receipt`：

```text
receipt_ref UUID PRIMARY KEY
data_node_ref TEXT NOT NULL
idempotency_key TEXT NOT NULL
operation_id TEXT NOT NULL
request_hash TEXT NOT NULL
response_json JSONB NULL
created_at_epoch_millis BIGINT NOT NULL
UNIQUE (data_node_ref, idempotency_key)
```

### 10.2 Flyway 顺序与 fail-closed

本批不做旧数据迁移。reset 会重放 Flyway history，因此历史 migration 可能先创建旧 `fulfillment_production` 表；新增 cutover migration 只负责把数据库切到新的空 catalog 结构：

1. 创建 `catalog.production_tag_definition` 及其三态约束、未作废编码唯一索引、scope/status/code 索引；列形状按当前 post-kind-retirement 事实冻结，不含 `tag_kind`。
2. 创建空的 `catalog.production_tag_command_receipt`，保留可空 `response_json` 和 `(data_node_ref, idempotency_key)` 唯一约束；不读取或复制旧 receipt 行。
3. 删除 `fulfillment_production.production_tag_definition` 与 `fulfillment_production.command_receipt`，再删除空的 `fulfillment_production` schema。不得通过 `INSERT ... SELECT`、code 映射或 UUID 映射搬运任何旧行。
4. 在 migration 事务内校验目标表、索引、约束和旧 schema 不存在；不做旧行 count、digest、receipt collision 或旧 reference continuity 断言，因为这些数据由 reset 丢弃。
5. reset 完成后，先做目标 schema 空态检查，再执行 catalog seed；seed 负责重新建立生产标签、商品 `PRODUCTION_TAG` reference、三态样本和后续命令 receipt。

这是一条显式破坏性 reset-first 边界：旧数据、旧 `tag_ref`、旧商品引用和旧 receipt 不属于本批交付物。失败后的恢复方式是停止、保留首败日志，重新执行受管 reset 并按当前 fixture 重建，不提供旧数据 rollback、双读、双写、fallback 或手工回填。当前仍不执行 migration/reset/seed。

### 10.3 回填与可逆性（模板必填行的 N/A 结论）

| 迁移 | 加/改什么 | 旧行回填取什么值 | 为什么那是唯一可恢复的事实 | 可否回滚 |
| --- | --- | --- | --- | --- |
| `fulfillment_production.production_tag_definition` rows → `catalog.production_tag_definition` | 创建 catalog 空目标表、删除旧表；reset 后由 seed 新建 | N/A：用户已明确 reset 丢弃旧 rows | 没有旧行需要恢复；新 fixture/readback 是本批唯一目标事实 | 不回滚旧数据；只能 reset 到目标版本后重新 seed |
| `catalog.catalog_item_reference(kind=PRODUCTION_TAG)` rows | 不做旧 ref 回填；reset 后由 catalog seed 建立新 references | N/A：不保留旧 tag_ref/商品引用连续性 | 本批唯一可恢复事实是当前 fixture 与新 owner readback | 不做旧 ref rollback；失败时重新 reset/seed |
| `fulfillment_production.command_receipt` rows → `catalog.production_tag_command_receipt` | 创建独立 catalog owner receipt 空表，启用 nullable response replay | N/A：不复制旧 receipt、不做 collision continuity | 新 receipt 的 claim/readback 从 reset 后空表开始 | 不回滚旧 receipt；只能重新 reset/seed |
| 旧 schema rollback/撤销 | 不提供 dual-read、dual-write、旧 schema fallback 或手工回填 | N/A | 用户已明确 destructive reset-first；旧数据不是可恢复输入 | 仅可受管 reset 到目标 migration 并重新 seed |

这不是遗漏迁移方案，而是本批的破坏性数据边界；只要实现需要任一旧行、旧 receipt 或旧 UUID，必须按停机条件退出，而不是临时增加兼容层。

## 10b · seed 数据

### 10b.1 受影响 seed 全集

| seed 文件 | 受影响原因 | 处置 |
| --- | --- | --- |
| `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json` | r5 全局 fixture/stage/count contract；当前 productionTag/production_tag/fulfillment 命中为 0 | `N/A_WITH_REASON`：不在此文件新增或维护 ProductionTagDefinition 事实；仅当 catalog seed 改变全局 stage/count contract 时同步结构校验，不能把它当生产标签数据正本 |
| `contracts/policy/catalog-inventory-fixture-catalog.json` | catalog definition seed 的生产标签定义、item assignment、L2 fixtures；当前含 `productionTagDefinitions`、`productionTagCode`、`productionTagRef`、`productionTagSelection` | 唯一生产标签事实来源；owner 字段/expected readback 改为 catalog；不改变生产标签业务语义 |
| `contracts/policy/catalog-inventory-fixture-catalog.schema.json` | fixture contract 闭集和 exact shape | 同步 schema required/properties/old owner red mutation |
| `scripts/generate/catalog-inventory-p1.mjs` | 唯一生成 catalog definition/contract/seed related source；当前含 owner 与 schema shard | 改 catalog owner/schema source，再重生成 |
| `scripts/dev/catalog-inventory-seed-executor.mjs` | 创建、readback、status、item binding/copy 的实际 seed consumer | 仍走 catalog operation IDs；readback 断言 owner catalog、ref/status/name/version |
| `scripts/dev/catalog-inventory-seed-plan.mjs`、`scripts/dev/r5-seed-plan.mjs`、`scripts/dev/r5-fixture-contract.mjs` | seed plan、stage/fixture 校验和闭集数量；当前无生产标签事实命中 | `N/A_WITH_REASON`：只在全局 stage/count/fixture contract 被 catalog seed 结构影响时同步，不能凭空增加生产标签 owner/数据入口；不改四阶段顺序 |
| `scripts/dev/r5-complete-seed-executor.mjs`、`scripts/dev/owner-command-seed-executor.mjs` | full seed stage orchestration/owner count gate；当前四阶段闭集不含 fulfillment stage，且两文件无生产标签事实命中 | `N/A_WITH_REASON`：保留通用编排/闭集校验；生产标签只由 catalog executor 消费，不添加或删除虚构的 fulfillment stage |
| `scripts/dev/catalog-inventory-seed-executor.mjs` | 当前唯一实际生产标签 seed consumer，命中 48 处 | 迁移后唯一负责 catalog production-tag create/readback/reference/status/receipt seed 事实，并逐项校验 source fixture 与 owner readback |
| `scripts/dev/*seed*.test.mjs`、`scripts/test/catalog-inventory-definition-seed.test.mjs`、`catalog-inventory-seed-identity.test.mjs` | static fixture/plan/readback tests | 加旧 owner red mutation、catalog owner positive、source fixture/expected count对账 |

### 10b.2 两类改动分开写

以下两类分母必须分开记录；本批的新功能上线类明确为 N/A，既有功能调整类则逐项执行。

#### 10b.2a 新功能上线分母

本批是既有生产标签能力的 owner relocation，不是新建用户功能；因此新功能上线分母为 `N/A_WITH_REASON`，理由是页面、operation、控件、用户词和 seed 业务事实均已存在，不新增一套“新生产标签”功能。不得因该 N/A 省略既有功能调整分母、target schema readback 或 UI regression。

| 新功能上线载体 | 判定 |
| --- | --- |
| 新页面/新 IA/新 operation | `N/A_WITH_REASON`：不新增 |
| 新用户控件/新用户文案 | `N/A_WITH_REASON`：不新增 |
| 新业务 seed entity | `N/A_WITH_REASON`：ProductionTagDefinition 已存在，只改变 owner 与重建来源 |

#### 10b.2b 既有功能调整分母

| 既有功能调整载体 | 精确调整 |
| --- | --- |
| `contracts/policy/catalog-inventory-fixture-catalog.json` 中的 `productionTagDefinitions`、商品 `PRODUCTION_TAG` refs | 这是唯一事实正本；`productionTagCode`、`productionTagRef`、`productionTagSelection` 的精确命中计数必须用 CP-00 固定命令在实施前重算并冻结，不把一次 ad-hoc 搜索数字写成事实；owner 从履约生产事实改为 catalog facts；reset 后用本次 seed 返回的新 refs，禁止旧 UUID/旧行连续性 |
| `contracts/policy/catalog-inventory-fixture-catalog.json` / schema | catalog owner、target table、三态/引用/expected readback 与旧 owner red mutation 同步 |
| `scripts/dev/catalog-inventory-seed-executor.mjs` | 唯一生产标签 seed consumer；只走 catalog operation/target readback；四阶段顺序不变 |
| `r5-fixture-contract.mjs`、`r5-seed-plan.mjs`、`owner-command-seed-executor.mjs` | `N/A_WITH_REASON`：当前无生产标签事实命中；仅在全局闭集/数量断言因 catalog seed 结构变化时同步，不能只改 validator，也不能把它们改造成第二个事实入口 |
| `catalog-inventory-l2-fixture.mjs`、`browser-l2-catalog-fixture.mjs`、L2 policy/oracle | ownerGraph/readback 改 catalog，动作/testId/失败语义保持 |
| acceptance fixture builders/scenarios | builder 不强制待测缺省参数；read/create/update/status/copy/reset-seed 子场景逐项使用 catalog owner；`createProductionTag` 当前仅覆盖 happy path，duplicate-code 与 same-key/null-response replay 必须使用显式 request/key builder，不得复用其“期望 200 + 每次新 key”假设 |
| command-token/generator/performance bindings | 三个 command token、M1 generated imports/classes、校准/预算矩阵同步到 catalog；GET 仍 metadata-only |
| receipt/lock namespace | target receipt 空态、null-response replay 和 `catalog-production-receipt` lock；不做旧 receipt collision |
| seed/static tests/checks | catalog positive、旧 owner red mutation、target empty-before-seed、post-seed owner/ref/status/readback 全部入分母 |

### 10b.3 reset 后的目标事实

- reset 后由 fixture 重新建立生产标签、停用标签、作废可复用 code、商品单标签引用和 brand copy 场景；这些是业务语义 fixture，不是旧数据库数据的延续。
- 活动生产标签 seed source/executor 中不得保留 `fulfillment-production` module/schema/owner 事实；r5 的通用 stage/count contract 不承载生产标签事实，也不得为了清理字符串而虚构 fulfillment stage；删除“生产标签由履约生产域创建”的断言；不要把 tag 变成 `catalog.dictionary_entry`。
- seed 不得依赖旧 `tag_ref`、旧 receipt、旧 schema 或旧数据库中的预存行；所有 reference 必须引用本次 seed 返回的 catalog tag ref。

### 10b.4 覆盖判据

每个 seed report/readback 必须验证：

1. catalog production tag definition 数量、scope、code/name/status/ref/version 与 fixture 一致；
2. ENABLED/DISABLED/VOIDED 三态都有稳定对象，VOIDED code 可以新建；
3. item `PRODUCTION_TAG` reference 指向本次 seed 返回的 catalog tag_ref，DISABLED 绑定按 fixture 重新建立且不被 seed 清空；
4. create/update/status/copy 的 owner operation readback 来自 catalog；
5. receipt/operation idempotency 只由 catalog tag receipt 表重放；
6. active source 和 generated seed 中旧 owner 出现次数为零（历史 migration/review 排除项单独报告）；reset 前旧行数量不作为本批判据。

### 10b.5 同步项与边界

改 validator 不等于改 fixture；fixture、schema、generator、executor、seed plan、stage list、readback 和 static tests 必须同批。reset/seed 执行需另行授权，本批不执行；不通过 seed 预造旧 schema fallback。

## 11 · 验收场景设计

本批不新增 HTTP operation，既有四个 operation identity 不变。新增/调整场景必须放入正确的 owning `*AcceptanceScenarios.java`，每条都有非空 identity、fixture、request、businessOracle；不得借其他 operation annotation 承载 production-tag 请求。

| scenario/subcase | owner 文件 | identity | fixture | request | businessOracle |
| --- | --- | --- | --- | --- | --- |
| `production-tag-owner-read-catalog-scope` | `CatalogAcceptanceScenarios.java` 或当前 catalog-inventory owning scenario file | head-company/store catalog editor | enabled/disabled/voided tags、两 brand、同 code | `getOperationsProductionTags` management/candidate queries | owner catalog；scope 只读本 brand；管理含停用，candidate 不含停用，分页 cursor 稳定 |
| `production-tag-create-catalog-owner` | `CatalogAcceptanceScenarios.java` | catalog editor with valid grant | fresh code、same-scope duplicate、cross-brand duplicate | `createOperationsProductionTag` | 只写 catalog target；readback ref/status/version；duplicate typed conflict，无半写 |
| `production-tag-update-version-readback` | `CatalogAcceptanceScenarios.java` | catalog editor holding version | enabled/disabled tag and stale version | `updateOperationsProductionTag` | name/readback准确；stale version拒绝且版本/receipt/row不变 |
| `production-tag-transition-reference-matrix` | `CatalogAcceptanceScenarios.java` | catalog editor with existing item binding | enabled bound tag、unbound tag、disabled tag、voided row | `transitionOperationsProductionTagStatus` | ENABLED/DISABLED 各按既有规则处理；作废引用 guard 准确；VOIDED 不可新选且释放 code |
| `production-tag-idempotency-and-null-receipt` | catalog/application integration test + acceptance owner file | same data node/key/hash and mismatch variants | fresh claim-only/null response and completed receipt | repeat create/update/status | same operation/hash replays exact result；不同 hash/op typed mismatch；失败回滚后同 key 可重试 |
| `production-tag-brand-copy` | `CatalogAcceptanceScenarios.java` | source/target brand catalog editor | source tags, target active conflict, item refs | existing brand-copy operation preflight/execute | tag refs scoped/rebuilt by catalog owner；conflict fail closed；item references and readback atomic |
| `production-tag-reset-schema-and-seed` | `CatalogInventoryMigrationIntegrationTest` + controlled seed verification | reset/seed operator and catalog readback verifier | empty target tables after reset; catalog fixture with all three statuses, fresh refs, item bindings | Flyway reset then catalog seed | target schema/constraints present；old tables/schema absent；seed readback matches fixture；no old-row continuity or old receipt collision claim |
| `production-tag-catalog-transaction-topology` | existing `CatalogInventoryReadTransactionTopologyTest` / catalog tests | catalog owner wiring | mock CatalogProductionTagOwnerApi and coordinator | read/brand-copy composition | read outside txn；commands REQUIRED；no fulfillment module bean/import |
| `production-tag-generated-owner-closure` | static generator/check tests | contract maintainer | old-owner red mutation + catalog positive | generator/check only | source owner/catalog schema shard/generated binding/catalog frontend owner exact; old owner active roots rejected |
| `production-tag-workbench-owner-failure` | catalog application focused test | catalog owner wiring missing or failing | required owner API absent/failing; no nullable fallback | navigation/read-reference/read-model paths | navigation must fail explicitly rather than become an empty list; item preparation keeps the existing typed problem; reference-count/read-model keeps `CatalogWorkbenchReadPersistence.readProductionTagReferenceCounts` and its catalog item-reference query, without routing through tag owner API |
| `production-tag-create-duplicate-code` | `CatalogAcceptanceScenarios.java` | catalog editor with valid grant | same-scope active code already exists; independent explicit idempotency key | explicit `createOperationsProductionTag` request, not `createProductionTag` happy-path helper | typed duplicate conflict; no new definition/receipt side effect; helper's expected-200/new-key assumption is not reused |
| `production-tag-idempotency-replay-negative` | `CatalogAcceptanceScenarios.java` plus catalog integration test | same data node/key/hash and same key/different hash or operation | explicit repeated request with stable key, including claim-only/null response and completed receipt | same request replays exact result; different hash/operation is typed mismatch; failed business write leaves key retryable |
| `production-tag-existing-ui-regression` | existing frontend static/render/L2 files | catalog operations user | existing fixture/page/drawer/testIds | existing page actions only | no new control/route; existing UI displays “生产标签” and preserves draft/error/focus/status behavior |

### 11.1 测试载体全集

- module unit/integration: existing four `modules/fulfillment-production/src/test/...ProductionTag...` move to catalog; `ProductionTagCopyConflictIntegrationTest` and `TransitionOperationsProductionTagStatusOperationTest` move/rename under catalog/application/operations。
- app/application/edge: `CatalogInventoryReadTransactionTopologyTest`、`OperationsCatalogInventoryControllerRouteTest`、`ContractProblemAdvice` focused mapping test。
- catalog existing: `CatalogCategoryOwnerIntegrationTest`、`CatalogBatchStatusTransitionIntegrationTest`、`CatalogInventoryCoordinatorCopySourceAuthorityTest` 中所有 production tag API imports/fixture assertions。
- HTTP business: `CatalogAcceptanceScenarios.java` production tag cases; `BackendAcceptanceTest` runner 不增旧 owner operation。
- frontend: `CatalogDictionaryDrawerState`/`CatalogItemProductionEditor`/`CatalogItemProductionView` focused tests；`catalogFieldRuntime.test.ts`、`CatalogItemDrawer.test.tsx`、`CatalogManagementPage.test.tsx`、architecture/static exact-set tests。
- L2: `apps/frontend/operations-admin/src/tests/l2/catalog-inventory.spec.ts`、`scripts/test/browser-l2-runtime.mjs`/`.test.mjs`、`catalog-inventory-l2-fixture.mjs`、`browser-l2-catalog-fixture.mjs` 和对应 policy JSON。
- migration/seed/static: `catalog-single-production-tag-migration.test.mjs` 扩展 cutover；catalog fixture/seed tests；`tools/catalog-inventory-p1`、`tools/capability-invariants`、`tools/verify-gates`、standards enforcement；退役 `catalog-inventory-p2` 不进入活动分母。

## 12 · 未决项处置

| 项目 | 当前状态 | 本详设处理 | 需要 Dexter 裁决 |
| --- | --- | --- | --- |
| 旧数据处理 | 用户明确所有数据 reset 后再 seed | 不迁移、不保留旧 tag/ref/receipt；reset 后由 catalog fixture 重建 | 不需要；这是当前范围决定 |
| 是否合并 `catalog.command_receipt` | reset 不改变未来幂等键空间的 owner 边界 | 仍采用独立 `catalog.production_tag_command_receipt`，防未来不同 owner 的同 key 碰撞 | 不需要 |
| operation ID/path 是否重命名 | 用户未要求，现有 UI/seed/L2 广泛使用 | 保持四个 operation ID/path/wire 不变，只换 owner metadata | 不需要 |
| UI/IA 是否重做 | 需求是域迁移，无用户行为改变 | N/A；只做 regression | 若要改页面/文案另开 UI Journey |
| 历史 Flyway/review 是否改写 | 历史事实必须可追溯 | 不改；active source 与新 migration 更新 | 不需要 |

## 13 · 停机条件

1. 生产标签源表之外发现第二个未登记的履约生产业务实体，或发现其有独立用户/消费者语义。
2. reset 重建后的目标结构与本文不符：例如 `tag_kind` 仍进入 target、status 不是三态、目标约束/索引缺失，或旧 schema 删除后仍有活动依赖。
3. reset 后目标表不是预期空态、seed fixture 无法建立完整 tag/ref/receipt 关系、seed readback 与 fixture 不一致，或目标 schema 存在额外对象。
4. 任一 active contract/generated/backend/frontend/test/seed/tool 仍把 `fulfillment-production` 当 owner；历史 migration/review 排除项必须单独列明，不得用“全仓零命中”掩盖。
5. 直接合并 catalog generic receipt 被发现会改变未来同 key 重放语义；不得因 reset 已清空数据而删除 owner-local receipt 边界或改写 key。
6. operation owner 迁移要求新增权限维度、改 path/wire 或改变候选/停用既有绑定语义。
7. acceptance fixture builder 强制传入本应 optional 的 production tag/status/scope 参数，导致负路径分母为零。
8. migration、seed 或 test 只能靠旧模块/旧 schema fallback，或依赖 reset 前数据库中残留的数据才能通过。
9. 前端为了 owner 迁移需要新增 UI 控件、改变 dirty guard、改变用户可见词或依赖技术 owner 字符串。
10. 需要执行实现、契约生成、构建、测试、reset、DEV、seed、L2、UAT 或部署但当前授权未覆盖。

## 13b · 实施节奏 · 三维对账

三维为：

1. 用户原始目标与本详设：实体成为 catalog 原生 owner、删除旧域、保留业务行为但按明确 reset-first 边界丢弃并重新 seed 数据；
2. 项目规范与 owning source：owner sovereignty、single Flyway、typed operation、receipt、collection、前端 currentData/dirty、seed/acceptance 规则；
3. IA/交互：本批 N/A，但逐项证明现有 production-tag screen 的控件、位置、行为、文案、失败/恢复未改变。

时点：每个 CP 完成后、进入下一个 CP 前做 fresh 独立三维对账；所有 CP 完成后、任何整体动态测试前再做一次跨 CP 全批三维对账。任意 `OPEN` 先由主 agent 根因修复，再交新的 fresh reviewer 复查；不得留给最终 Claude review。

## 13c · 逐代码与详设对账（交付前置门）

实施完成后，按 §9a 的每一行逐代码核对，不抽样。每行比较：真实文件是否迁到目标 owner、SQL/schema/receipt 是否一致、operation owner/path/transaction、problem/readback、frontend owner consumer、test fixture/seed/check 是否同步、历史文件是否只留在允许的历史分桶。结论只有 `MATCHED` 或 `OPEN`；任何 `OPEN` 不得交 Dexter/Claude 做 IMPLEMENTATION review，也不能用额外动态运行掩盖。

## 14 · 交付前自查

| 检查 | 判据 |
| --- | --- |
| 模板行集 | §3 固定机制行全部存在，包括“迁移回填与可逆性”；不适用均有理由 |
| owner 单一真相 | active contract、generated、Java、SQL、frontend、test、seed 的 owner 都是 catalog；历史文件排除有清单 |
| operation scale/performance | operation 表写明 GET 1..100/default20、0/20/21/100+ boundary、command 单对象增长；assertion matrix、calibration report、M1 generator 与 owner/read breakdown 同步 |
| active policy closure | lifecycle vocabulary、reference path matrix、L2 blueprint/scenarios、backend performance generator 和 assertion matrix 均列入 §9a；旧 owner red mutation 有明确落点 |
| impact denominator | §9a.1 的 current-byte scan roots、逐文件分桶和未分类即 OPEN 规则与实施计划 CP-00/CP-05 一致 |
| 数据闭包 | reset 后目标表空态、seed fixture 数量/ref/status/unique/readback、旧 schema drop 均有可运行观察；不检查旧行 hash/continuity |
| receipt | 独立 target receipt 表、reset 后空态、null response、replay/mismatch 均有场景；不做旧 receipt collision/continuity |
| contract | 四个 operation ID/path/wire/capability/face 不漂移；owner/namespace/catalog schema 正确 |
| backend | 无旧 module dependency/import/package；coordinator、owner、edge、problem、copy 全链一致 |
| workbench failure | navigation required catalog owner API and no null-to-empty fallback；item preparation keeps typed problem；reference-count/read-model remains catalog persistence-backed and is not forced through tag owner API；focused failure/owner-path scenarios入分母 |
| GET adapter boundary | GET 只有 coordinator-owned metadata；不生成/调用 read operation class；三个 command 各有实际 catalog adapter class，且有 GET→command red mutation |
| frontend | 无旧 owner fallback；现有 currentData/loading/dirty/UI 行为不变；生成物非手改 |
| tests | module/app/catalog/acceptance/frontend/static/L2/migration 每类都有归属与负路径 |
| seed | catalog fixture/schema and `catalog-inventory-seed-executor` are production-tag facts; r5 fixture/plan/stage files are only global structural carriers with explicit N/A reasons; generator/executor/readback 同批；不执行 seed |
| closure | 静态门均标 `NECESSARY_NOT_SUFFICIENT`；没有用字符串零命中声称行为闭合 |
| dynamic boundary | 当前所有动态项仍 `NOT_AUTHORIZED/NOT_RUN`，不写 PASS |
| review | 需完成 fresh Round 1、Round 2；第二轮后由主 agent 做一致性自审并记录，不新增第三轮 |

## 15 · 评审记录（完成两轮后回填）

本节只记录独立 reviewer 的原文 verdict、每条 finding 的 `CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE / UNVERIFIED_REQUIRES_EVIDENCE / DEXTER_DECISION` 处置和当前字节路径；主 agent 不预写 GO。

| 轮次 | reviewer kind | 输入清单 | verdict/M/S/N | 处置 |
| --- | --- | --- | --- | --- |
| Round 1 | INDEPENDENT_SUBAGENT | 本文、实施计划、AGENTS、模板、命中 memory、§9a owning source | REVIEW_TARGET=DESIGN / VERDICT=NO-GO / M/S/N=2/1/0 | F-01/F-02 Major 与 F-03 Significant 均按当前源码确认并已修：Workbench 三条消费者、token generator 分母、GET metadata-only 语义分别补入 §9a/CP-01/CP-03；当前字节由 Round 2 重新核验 |
| Round 2 | INDEPENDENT_SUBAGENT | 当前修订字节、Round 1 finding 及 owning source | REVIEW_TARGET=DESIGN / VERDICT=NO-GO / M/S/N=5/2/0，最终轮 | 5 条 Major：operation 规模/DB 性能合同、active policy/L2/M1 generator 分母、seed 双分母、模板回填/可逆性行，均已补入；2 条 Significant：Workbench null→empty 失败语义、GET metadata-only 负向证明，均已补入；本轮后不再启动第三轮，交由主 agent 一致性自审和 Dexter/Claude 复核 |
| Claude current-byte handoff review | CLAUDE_CROSS_AGENT | 当前详设、实施计划及 Claude 指定的矩阵/seed/Workbench/L2/migration/acceptance owning source | REVIEW_TARGET=DESIGN / VERDICT=NO-GO / M/S/N=2/4/4；正文写“九条”但实际枚举十条，按 2M+4S+4N 全量接收 | M-01 transition matrix 改为 catalog-local、`coordinatedOwners=[]`；M-02/S-01 更正 r5 与 catalog fixture/seed 分母；S-02 补齐三处 lock；S-03 按三条 Workbench 路径分别落位；S-04 修正 L2 owner/surface 语义；N-01 排除 build 产物；N-02 纳入 GET=9 校准；N-03 纳入 `MasterDataLifecycleMigrationIntegrationTest.java:553` 结构性载体；N-04 增加 duplicate-code 与 same-key/null-response 的显式 acceptance request/key 场景。以上十项已按当前源码修订；本行只记录 Claude 原 verdict，不把修订后的文档伪装成已被该 review 看过。 |

## 16 · 主 agent 一致性自审（两轮后执行）

自审只检查当前两份文档前后矛盾和上下文漂移，不替代独立 verdict：operation owner、schema/receipt target、Java package、frontend owner、seed owner、test denominator、operation scale/performance contract、active policy denominator、Workbench 三路径分工、lock 三位点、GET metadata-only boundary、reset-first migration/backfill row、历史排除项、未授权边界必须逐字一致。Round 2 的所有 finding 与 Claude handoff review 的十项 finding 已按当前字节回读；本自审不把历史 NO-GO 改写成独立 GO，也不新增第三轮 DESIGN review。Claude 文本标题称“九条”但实际列出 2M+4S+4N=10 条，本文以十条为完整分母，未丢弃任何一条。

`SELF_AUDIT_RESULT=PASS_WITHIN_DOCUMENT_CONSISTENCY_SCOPE`：两份文档的四个 operation、catalog owner、target schema/receipt、reset-first/no-data-migration、活动 policy/性能/seed/test/L2 分母、Workbench 三路径分工、三处 lock、GET metadata-only 边界、migration test 结构性载体、acceptance 负路径、三轮 review/intake 记录和当前 NOT_AUTHORIZED/NOT_RUN 边界已逐项对齐。该结果只表示本次文档修订后的主 agent 一致性核对通过；不把 Claude 的历史 NO-GO 改写成其已 review 新字节，也不替代后续实施验证。若 Dexter 依据本次 Claude 授权继续，实施阶段从 CP-00 开始，并保留所有动态与 L2 边界。
