# 查询粒度、重复读取与失效风暴：问题发现与整改详设

- 日期：2026-08-17
- 作者：Codex
- 类型：只读问题发现 + implementation-facing 整改详设；**不授权实施**
- 触发样本：`saveOperationsCatalogItem`、`getOperationsCatalogItem` 的 seed 诊断与源码追读。
- 动态边界：本件未启动 DEV、HTTP、浏览器 L2、Testcontainers、reset 或 seed。此前 DEV 已由 `scripts/dev/stop` 受控停止，terminal manifest 的 business 与 cleanup 均为 PASS；该事实不构成任何性能验收。

## 1. 结论

**当前业务 `GO` · 本轮“20 倍业务量底座效率”目标接受关闭 · 技术债 M=5 · S=6 · N=3。**

本件的 `GO` 说明：在 Dexter 给定的现阶段业务规模与交互口径下，未发现会导致当前用户不能完成业务、错误展示业务事实、越权或数据不一致的读取问题。Dexter 已裁定本轮“20 倍业务量底座效率”分析目标在此接受关闭；M/S 项保留为按数据量、选择数或活跃订阅增长时触发的整改清单，而非当前实施阻断。

**证据边界。** 本裁定不是受控压测、吞吐量或 20 倍负载通过证明；本件从未运行该类动态验证，也不得把“接受关闭”转述为已测得的性能承诺。

不是因为每一次多读都会立刻错，而是同一个根因已跨命令、详情、批量编辑、复制闭包、库存详情、组织详情和 RTK 生成面出现：**读取按已有大对象或通用 `LIST` 机制驱动，而不是按当前稳定业务任务的事实闭集驱动。**

必须保留的边界：

- 不为减少读取删除 owner 命令事务中的授权/状态/CAS/幂等重核验、审计或真实命令 readback。
- 不让 catalog 直接读取 inventory/fulfillment 表；跨 owner 只走窄 typed API，页面组合仍是显式 task read。
- 不按每个屏幕/组件另造接口；接口按可复用的业务读模型和事实闭集定义。
- 不手改 generated RTK 输出；失效关系必须进入 generator 的唯一输入并重生成。

## 2. Dexter 裁定转化为接口准入规则

本轮采用以下强制规则。它是设计判断，不是一条只靠 grep 的门：

1. 先列出一次用户交互的消费者、scope/freshness/authorization 以及每个消费者实际读取的字段。
2. 若 A 需要 `X.M`、B 需要 `X.N`，且二者在同一 scope、授权、生命周期和新鲜度下都需要同一个稳定实体 `X`，可以有一个完整而**有界**的 `X` task read 共同服务它们。
3. 若 C 需要 `X + Y` 的不同关系闭集、不同授权或独立 loading/recovery，则它不是 A/B 的同一个 read model；只能复用已有恰当 task read，或新增一个按业务任务命名的组合 read。
4. 集合交互不得退化为 `N × detail`、`N × owner read` 或 `N × JDBC`；批量读取/批量 command 必须保留稳定输入顺序及首个业务错误的可观察语义。
5. 同一请求已经取到并完成 scope 判定的 owner projection，后续 mapper 需要其余字段时复用该对象；不要为“第一次只用一列”再造窄查询。
6. command response 只回传命令完成后真正稳定、可用于界面状态收口的最小 readback；它不能偷换为详情 payload，也不能代替下一次独立详情读取。
7. 缓存 tag 的粒度等于真实受影响 read model：key 至少含资源族、data scope、brand 与（需要时）实体 ref；成功写入后的自动失效、手动 refetch 和回显只可选择一个明确的收口链，不得并行叠加。

每一个新/变 read model 必须写明：业务任务、消费者及共同使用证据、字段闭集和唯一 owner、scope/授权、基数与 batch key、现有 operation 为什么不能满足、DB 访问形状、失效/回显策略、OpenAPI→生成物→edge→owner→UI 闭环、focused tests 与 red mutation。

## 3. 本轮有限分母与方法

本报告不是“全仓性能已量化”的声明。分母和结论如下：

| 扫描面 | 分母 | 方法 | 结论边界 |
|---|---:|---|---|
| 后端 production Java | 561 文件、15 runtime module、41 个 operations edge component | 循环内 JDBC/owner read、同一 HTTP 链的重复投影、全投影的实际字段消费；逐项回读命中方法 | 可确认源码形态；未量化真实耗时/执行计划 |
| 高风险 owner/app 深读 | catalog、inventory、fulfillment-production、organization、platform 及对应 edge 119 文件（71 module + 48 app） | 逐条追 data flow；循环→JDBC 命中 14 文件，循环→跨 owner read 为 0 | 不能推出其他业务域没有未被本模式抓到的低频问题 |
| 生成 RTK 端点 | 4 个输出、197 endpoints = 83 query + 114 mutation | 读生成器和所有输出 tag 声明 | 静态确认失效图过宽；实际 HTTP 合并次数未运行 |
| 前端显式刷新 | 两 app 非 generated TS/TSX 中 55 个 `.refetch()` | 按成功回调、人工重试、详情局部刷新、六区懒加载分类 | 55 并不等于 55 个问题；只有成功链与全局 invalidation 叠加者为确认项 |
| 样本 seed | `saveOperationsCatalogItem` 191 次、均值 2392.72ms、均值 DB ops 65.42；`getOperationsCatalogItem` 187 次、均值 840.63ms、均值 DB ops 38.54 | `.runtime/r5/catalog-inventory/seed/.../seed-report.json` | seed 读回/断言有意存在，不能当生产 HTTP 性能或 UAT 结论 |

### 已排除的反例

- `saveOperationsCatalogItem` 的 command 内 owner 重核验、CAS、receipt replay/readback、审计及有业务子命令时的保存后事实读取，均不能为了次数下降删除。
- catalog 的七类 facts 批量装配、organization hierarchy 的 `IN (...)` phases 批量读、inventory 列表先收集 item refs 再批量调用 catalog，不是 N+1。
- inventory 的 BOM 行校验 `ResolvedBomTargets.load(...)` 已是 set-based；不得重构回逐条查。
- 品牌工作台使用总公司详情仅消费 `authorizedBrands`，目前只是结构性候选，尚无 payload/频率证据，不新增接口。
- 平台 workspace detail 在多个明确详情区共同使用，静态上不足以证明应拆端点。

## 4. 已确认问题

### M-1 · 生成器把所有写入扩散成 app 级 `LIST` 失效

**事实。** `scripts/generate/edge-codegen.mjs` 的 `tsRtkEndpoint` 与 `scripts/generate/catalog-inventory-p3-frontend.mjs` 的 `generatedRtk` 对每个 GET 都生成 `{wire, operationId}` 加 `{wire, LIST}`，每个 mutation 也无条件 invalidates 同一 `LIST`。四份输出的 197 个 endpoint 全部命中。`OperationsApi.ts` 又把 operations/public/catalog 三个 slice 合入同一 RTK substrate。

**后果。** 一个商品保存、库存动作或邀请写入会使同 app 所有活跃 query 都成为失效候选；operations-admin 的 operations/catalog/public 三个 slice 共享 147 个端点和同一个 tag type，platform-admin 的 50 个端点也在自己的 app 内共享它。它没有表达 scope、brand、entity，也不能表达 inventory detail 的 `period`、cursor 或展开 zone。成功回调再手动 refetch 时，形成不可解释的多条收口路径。两处“刷新当前页” helper 本身也是 global `wire/LIST` invalidation，名称比实际范围窄。订阅数和 RTK 的合并行为属于 runtime 未验，不能声称每次必发多少 HTTP。

**最小方案。** 在生成器输入引入每 operation 的声明式 read-model dependency：query 生成精确 read-model key（资源族、适用 scope、品牌、对象/列表 key；子资源另加 period/cursor/zone key），mutation 只 invalidates 真实受影响 key。该 metadata 必须有 schema/exact-set check；生成器拒绝未声明的新 operation。先完成 input→四输出统一重生与红夹具，再删除成功回调里被精确失效覆盖的手动刷新；需要等待完整 detail 恢复编辑态的目标性 refresh 保留。

**禁止。** 直接删 `LIST`、在 feature 里手写 tag、或靠 `refetch()` 修缓存。

### M-2 · inventory 列表借用完整商品工作台 read model，批量 lookup 仍然过宽

**事实。** `CatalogInventoryCoordinator.enrichInventoryTargets` 为库存目标补商品名、SKU 名、物料角色和分类展示名时，按 `itemRefs` 调 `catalog.readItems`，随后再读 catalog navigation 解析分类名称。`CatalogOwnerService.readItems` 无条件执行 `hydrateItemFacts`：SKU、分类、组合、点单选项、规格轴、图片和引用等事实都会被装配。库存页真正消费的只是 `{itemRef, itemName, skuName, materialRole, categoryDisplayName}`。这不是 N+1，却是把商品工作台的完整 list/detail read model 误作库存展示的 batch lookup。

**后果。** 库存页有 100 个 target（含重复 item ref）时，会负担与库存展示无关的商品 hydration 与全量 navigation payload；商品关联越丰富，该成本越随无关事实增长。它也使“已经批量调用”成为掩盖过宽读取的错误理由。

**最小方案。** 由 catalog owner 增加有界 typed task read `displayFactsByItemRefs`：在 owner 内去重、以 scope/brand 谓词过滤并 set-based 查询，只返回 inventory 所需的五类展示事实，分类展示名同一 task read 内解析。inventory coordinator 仅调用该 read；不得给 `getOperationsCatalogItems` 加隐藏 `light` 模式，不得把 catalog facts 物化或应用层 `IN` fan-out 搬到 coordinator。

**证明。** 以 100 个库存 target、重复 `itemRef` 与跨 scope ref 的 focused + Testcontainers 证明：不触发完整 `hydrateItemFacts`、无逐行查询、越界 ref 不泄露/不错误映射；并保留 inventory owner 已有 scoped `EXISTS` 任务型 read，不把它误改为跨 owner 写或全量预取。

### M-3 · 批量分类/标签更新退化为 `N × 全量详情 + N × save`

**事实。** `CatalogWorkbenchPage.runBatchAction` 的 CATEGORY/TAG 分支对每个选中行调用 `getOperationsCatalogItem`，再用 `buildCatalogBatchSaveRequest` 拼完整 save body。当前 builder 明确发送 `inventoryConfiguration.nodes: []`。状态批量已有集合 command，但分类/标签没有。

**后果。** 选择 N 个商品时，先做 N 次详情 HTTP、再 N 次完整 save；每一条 save 还触发 M-1 的全局失效。它是确定性的规模线性增长，且读取内容超出“设置分类/标签”所需。

**最小方案。** 扩展为一个稳定的集合业务 command（例如 `batchUpdateOperationsCatalogItemRelations`）：请求仅含 data scope、relation kind、目标 relation refs 与每项 `{itemRef, expectedVersion}`；catalog owner 在同一批量任务内按 item 顺序重核验并仅更新相应关系，返回逐项成功/typed failure/readback。不得新增 “batch drawer detail” query，也不得信任列表缓存构造完整 save。

**证明。** 前端请求 mock/architecture test 断言批量关系操作零调用 `getOperationsCatalogItem`；backend unit + Testcontainers 覆盖不同 version、部分失败、授权和顺序；backend-acceptance 用真实 HTTP 断言业务结果，不以 2xx/DB 次数代替。

### M-4 · inventory copy closure 与 catalog copy preflight 含按图规模增长的 JDBC 读取

**inventory 事实。** `InventoryOwnerService.sourceCopyClosure`、`localSourceCopyClosure` 与 `verifyTargetNoOwnerReference` 形成 3 个循环读取落点：按 item `loadTargetsByItemRef`/`loadBomOwnersByItemRef`，并按 BOM row `findTargetByRef`；写后泄漏校验再次每 item 查询 targets 与 BOM。`verifyTargetNoOwnerReference` 的真实字段只有 target configuration 与 BOM rows，却取完整 `TargetRow`。

**catalog 事实。** `CatalogOwnerService.targetScopeVersion` 对 closure 的 category/dictionary 逐项取 version；preflight `objectVersions` 又逐项取同类 version；`validateCopyCompatibility` 再逐项查 active target ref。类别/字典闭包大小为 C/D 时，该子链是 `1 + 3 × (C + D)` 量级。注意 version 查询包含 VOIDED，而 active mapping 排除 VOIDED；不能把三者粗暴合并为一个条件。

**最小方案。**

- inventory：按 frontier 的 item refs 一次批量加载 target/BOM；收集 component target refs 后复用既有 `loadTargetsByRefs`；泄漏校验改成两条按 item-ref 集合的窄 projection，并在内存按原 item/row 顺序报告首个失败。
- catalog：owner-local batch target facts 按 `(objectKind, code[, dictionaryKind])` 返回 max version 与 active ref（必要时同一批 query 以不同 status 谓词得到两套事实）。三处只读同一个 batch facts，不跨 schema、不跨请求缓存。

**证明。** 用至少 3 item、多个 BOM row、category/dictionary 同名与 VOIDED 反例，证明结果/readback/首个 error 和重放语义不变；对数据访问形状断言是 batch，不对 SQL 总数作全局性能承诺。

### S-1 · `saveOperationsCatalogItem` 在无 inventory 子命令时仍读取完整 catalog detail

**事实。** `CatalogInventoryCoordinator.coordinateSaveInventory` 只要 `inventoryConfiguration.nodes` 是 array 即进入；前端的非库存 tab 与 batch builder 都发送 `nodes: []`。随后 `catalogInventoryProjection` 调用完整 `catalog.readItem`，实际只取 item/SKU/option opaque refs 以发 inventory command。`nodes` 全为 NONE/BOM 且没有有效 BOM write 时也可落入同一路径。

**最小方案。** 先以纯请求体 `hasActionableInventoryChildCommand` 判断是否存在 INDEPENDENT_STOCK 或实际 BOM write；无则直接 return。命中时才调用 catalog owner 的 typed `readCatalogInventoryRefs` 窄投影（itemRef、SKU refs、option value refs、必要 code-to-ref map）。它不是 UI endpoint，而是 catalog→inventory command coordination 的 owner API。

**不可做。** 不用请求 item/SKU ref 取代 owner 的 command 内事实核验；不把 inventory 写拿到 coordinator 表/跨 schema DML。

### S-2 · 保存前的媒体释放判断用全详情只取 asset refs；空集仍跨 owner

**事实。** `CatalogInventoryCoordinator.catalogItemAssetRefs` 通过 `catalog.readItem` 提取 item/SKU media refs。`settleWorkspaceCatalogAssets` 即使 `previousAssetRefs` 与 next refs 都为空，也会调用 `catalog.assetRefsStillReferenced(empty)`，并调用 asset settlement；asset 内部会很快 no-op，但已跨越 owner 边界。

**最小方案。** catalog 增加 owner-local `readItemAssetRefs`；`previousAssetRefs` 为空时跳过 global reference judgment，且 bindings/releasable 均为空时不调用 asset command。非空情形保留 catalog 的全局引用判断、asset 的锁/授权/claim/release 顺序。

### M-5 · `getOperationsInventoryTarget` 首屏预装三个独立懒加载区，随后又重复读取

**事实。** `InventoryOwnerService.current` 在当前状态 endpoint 内固定执行三次 `changeSummaryData`、`recentChanges`、全 scope `referencesData` 与 `ledgerEntries(..., 100)`。但 `InventoryDetailDrawer` 初始仅展开 `current`；变化、引用与完整流水分别有独立 query，且以展开状态 `skip` 延迟请求。当前区实际需要 target/configuration/balance/state/threshold 与 `recentChanges`；它不显示三周期汇总、全部引用或 100 条流水。UI 还以 `currentView.changeSummary` 作为变化区 query 尚未返回时的 fallback，掩盖了同一闭集被首屏和展开区各读一次。

**后果。** 打开详情即读取用户尚未打开的区；之后展开变化/引用/流水又读取同一业务事实。引用读取还叠加原 S-5 的全 scope BOM 搬运问题。

**最小方案。** 将 `InventoryTargetCurrentView` 收窄为当前区真实字段和最近变化；删除 `changeSummary`、`references`、`ledger`。变化区保留其独立任务 read，但在该区内用一个 conditional aggregate 同时得到三周期；引用/流水继续独立、可恢复、可分页的 typed task read。前端移除 summary fallback，等待相应 zone 的 own data。不得把六个独立 zone 再合成 mega endpoint。

**证明。** focused UI 断言初开只请求 current，展开每一区只请求本区；owner unit/Testcontainers 断言 current 不触碰 summary/reference/ledger SQL，且 current zone 的 recent changes 仍完整可见。保存后以 M-1 精确 tag 与唯一收口链刷新已展开区。

### N-3 · `getOperationsCatalogItem` 为少量已选商品处理标签重复读取 scope tag page

**事实。** catalog owner detail 的 `productionTagDetails` 为 selected refs 调用 `getOperationsProductionTags` 并在全 page entries 中匹配；随后 `CatalogInventoryCoordinator.enrichInventory` 无条件第二次 `production.readTags`，再次以 code 过滤回填名称。无 tag 时 coordinator 的读取仍发生；有 tag 时同一个详情路径两次读取 scope+brand 的最多 100 条 tag page。直接标签管理需要完整 page，但商品详情仅需 selected tag 的 `{ref, code, name}`。

**业务影响校准（Dexter）。** 此处是 production/商品处理标签；单门店真实业务预计不超过 20 个。因此当前两次小集合读取不构成用户可感知的业务阻断，也不应为了消除它引入新的 contract/owner task read。`LIMIT 100` 容量风险在该业务上限下不成立。

**处置。** 接受当前实现；不新增 `readTagLabels`，不改 contract。若将来有业务依据突破 100 个处理标签，或动态证据显示详情读取成为真实延迟热点，再按 owner-local selected-ref lookup 重开。

### S-3 · SKU void availability 是确定性的 per-SKU JDBC N+1

**事实。** `CatalogOwnerService.skuRows` 对每个 SKU 调 `skuInboundReferences`。SKU 数为 K 时，此段为 K 次 relation query。详情的其他 facts 已是批量装配，说明这里不是必要模式。

**最小方案。** 一条按 item/SKU refs 的 batch inbound-reference query，返回 `skuRef → references[]` map，保留每 SKU 原有 `canVoid` 和 blocking/dependent facts 的输出顺序。

### S-4 · `getOperationsInventoryTarget` 的引用区读取全 scope BOM；变化区内部仍可合并三次 summary

**事实。** M-5 处置后，变化区仍会调用 TODAY/7D/30D 三个 summary endpoint；这是同一 target 的可合并窗口 aggregate。其 `referencesData(scope, brand, targetRef)` 则先读取该 scope+brand 的所有 `stock_bom.rows`，再在 Java 中筛 targetRef；这是 “需要一个 target 的引用，却搬运全 scope BOM” 的直接实例。

**最小方案。**

- 一个 conditional aggregate 同时算三窗口 summary；ledger-100 的前 20 行在内存投射为 recent，降为两次 ledger read。
- `referencesData` 改为数据库端 JSONB path/lateral filter，仅返回引用该 target 的 BOM rows；先以 `EXPLAIN` 判断现有 JSONB 路径能否用索引。若不能证明计划可接受，单独裁定是否需要 owner-owned 反向关系物化，不能以 Java 过滤伪装成选择性查询。

### S-5 · 同请求已读组织 projection 却再次读同一 store；workspace 初始化也有同类双读

**store 事实。** `OperationsStoreManagementController.detail` 调 `scopedReadStore` 读取 store projection 并完成 selected-project scope 判定，随后 `store(...)` 又 `overview.detail(...)` 读取同一 projection作 mapper 输入。前一对象已含 mapper 所需 project/brand/tenant/head-company reference。

**workspace 事实。** `PlatformWorkspaceService.initializeCommercialGroup` 先 `repository.detail`（含 commercial-group join），实际只用 enabled/key/id；再按 key/id 查询 workspace UUID。

**最小方案。** store detail 复用 `scopedReadStore` 返回的 Item 传 mapper；workspace owner 提供/使用单行 initialization context `{workspaceUuid,key,id,status}`，替换 detail+second query。均不改变 command grant/recheck。

### S-6 · brand copy 已知空 owner 闭包仍进入 execute 路径

**事实。** `executeBrandCopy` 无条件调用 inventory 和 production execute；catalog plan 可以合法没有 production tag refs。inventory preflight 在继续执行前必须读取私有 target/BOM 事实，因此**不能跳过 preflight**；但 preflight 已得出 target/BOM closure 均为空后，继续执行 inventory 写链没有已见业务写入。production 的空 tag plan 同样仍进入 preflight/execute。

**结论边界。** “预检也应跳过”是错误方案；“已知 no-op 后 execute 可跳过”是 `PARTIALLY_CONFIRMED`，因为 combined digest、ownerReadbacks 和 receipt semantics 必须先由 owner 证明空执行没有其他承重副作用。

**最小方案。** inventory/production preflight readback 增加 typed `actionable`，由各 owner 的真实 closure 推导。仅 `false` 时 coordinator 不调用 execute、不伪造 mutation/readback；combined digest/response 的参与 owner 集合必须由同一事实声明推导。若该契约变更不能保持 copy 预检/执行的一致性，本项退回，不做局部 if。

### N-1 · manifest 同 request key 的多个订阅

工作台常驻 `getOperationsCatalogShapeManifest`；商品、创建、字典、本地复制、品牌复制 Drawer 又使用相同 scope/brand 独立订阅（6 个调用点）。RTK 可能 dedupe transport，实际 HTTP 数未运行；但 subscription/lifecycle 重复已确认。父工作台已有 manifest 时应 prop 下传，独立挂载才自行 query。

### N-2 · organization overview 的 materialized CTE 用 `SELECT *`

`OrganizationOverviewTaskReadService` 的 `filtered → paged` 把四个仅用于筛选的列继续带到分页投影。它不含 base-table `SELECT *`，也没有执行计划证据；整改可在同一 owner task read 以显式列替换，但不提升为性能故障。

## 5. 分阶段实施详设

### Batch A：消除确定性无效/重复读取（不改 HTTP contract）

1. `coordinateSaveInventory` 先判断 actionable child command；无 action 零 catalog/inventory owner read。
2. 媒体 settlement 空集短路；非空路径不改锁和 release 顺序。
3. `current` 移除变化三窗口、references 与 full ledger 的预装；保留当前区的最近变化，独立 zone 按展开读取。
4. store detail 复用首次 scoped Item；workspace initialization 使用窄 context。
5. inventory detail 的变化区合并三窗口 aggregate，并将 target references 改为数据库端选择性过滤。

验收：每项先写 focused unit test 与 red mutation，再改实现；输出字段、typed problem、授权、版本和 command 原子性逐项 readback 相同。无动态性能宣称。

### Batch B：集合/闭包 set-based 化（owner-local）

1. catalog `displayFactsByItemRefs`：库存列表消费的五类展示事实一次 owner-local batch 读取，不复用完整商品列表 hydration。
2. inventory copy closure frontier batch、component target batch、post-copy no-owner-reference batch。
3. catalog copy preflight 的 category/dictionary version + active-ref batch facts。
4. SKU inbound-reference batch facts。

验收：最少三层 closure、多 row BOM、VOIDED target、重复引用和原顺序的首个失败 fixture；Testcontainers 覆盖正常/失败/重放/rollback。不可把“query 更少”作为唯一 oracle。

### Batch C：合约化批量关系命令与 read shapes

1. 增加批量分类/标签 command，替代 N×detail+save。
2. 增加两个 catalog owner private/API projection：asset refs、inventory coordination refs；仅在实际 command 子链使用。
3. 确立 `CatalogItemDetail.inventoryBom` 的唯一 canonical path。当前 coordinator 同时写 `data.inventoryBom` 和 `data.item.inventoryBom`；先由消费者和契约逐字段确认唯一层级，再删另一条，禁止双路径长期兼容。
4. command readback 补稳定的 identity/version/changed sections（及确有需要的 inventory version）；它只帮助一次明确回显/失效收口，不替代 detail。

验收：OpenAPI source、route registry、Java/TS generated wire、controller/owner、frontend consumer 和 unit/Testcontainers 同批更新；seed executor 仍只把明确业务 readback 用于 opaque ref/业务图验证，不能把删掉的过宽详情重新带回。

### Batch D：生成器级缓存失效收敛

1. 为所有 197 endpoint 建立 read-model tag input，先覆盖 catalog edit/batch、inventory action、workspace invitation 三条真实成功链。
2. tag input 显式声明资源族、scope key、brand key 与可选 entity key；批量写失效同 scope/brand 的列表、navigation/dictionary 依赖和每个受影响详情，且不得碰其他 brand/data-node 的订阅。
3. 生成精确 tag；完成反向 schema/exact-set proof 后才删除对应成功回调 `refetch()`。目前可确认的成功后 `await refetch()` 至少有 7 处（字典 3、商品详情 4）；其中创建后依靠 refetch 返回值定位新项的路径不得未替代先删。
4. 保留用户显式 Retry、网络 `RESULT_UNKNOWN` 恢复与独立 six-zone 按需刷新；它们不是普遍重复。
5. scoped tag 不得重置 workbench 的 `scope + brand + filter + cursor` query identity、metadata modal 当前 Tab 或未保存草稿；为此补 focused UI regression。
6. 用真实受管 HTTP/浏览器请求观测验证保存、批量、邀请三条链的 request set；该项需单独动态授权。

## 6. 测试、Testcontainers、seed 与证据影响

| 变更类别 | 必须同步的 proof | 本轮状态 |
|---|---|---|
| owner-local SQL/read shape | unit + source/query-shape test + Testcontainers 业务/rollback/typed problem | 未运行 |
| OpenAPI/new batch command/readback | contract source、生成物、controller/owner、generated TS、前端 focused test | 未运行 |
| cache tag generator | generator fixture、red mutation、四输出刷新、前端 success/retry path test | 未运行 |
| seed | executor 的显式 readback/asset/media/ref assertions、诊断 DB op report 预期 | 未运行；不允许把现有 seed 次数冒充 production 结果 |
| runtime | managed HTTP request trace，若进入浏览器则 L2 + run-scoped cleanup | 未授权、未运行 |

## 7. 对抗式 review（当前轮）

### 输入与方法

独立只读盲查从 backend loop/duplicate-read、frontend RTK/refetch、copy closure/owner boundary 多路进行；作者随后重新打开 owning source，按 `CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE / UNVERIFIED_REQUIRES_EVIDENCE / DEXTER_DECISION` intake。未使用运行期结果补静态证据。

- `REVIEW_CYCLE_ID=QUERY-GRANULARITY-20260817`
- `REVIEW_TARGET=DESIGN`
- `REVIEW_ROUND=1` / `REVIEW_ROUND_LIMIT=2`
- reviewerKind：`INDEPENDENT_SUBAGENT`
- blind declaration：独立 reviewer 未读取本报告，只重开 query generator、generated edge、catalog/inventory owner/coordinator 与前端消费源码后形成 verdict。
- input 清单：`project-memory/decisions/http-crud-efficiency-design-redlines.md`、`doc/plans/platform/2026-08-06-v2s-catalog-inventory-three-stage-implementation-design-codex.md`、相关生成器/owner/coordinator/UI owning source。

| 输入 finding | Intake | 结论 |
|---|---|---|
| 以“每屏新接口”降低详情读取 | `REJECTED_WITH_EVIDENCE` | 违反 task-read 和 Dexter 的 full-X 复用规则；改为 Batch C 的稳定业务 read/command。 |
| 删除 command 详情刷新，把完整详情塞进 command response | `REJECTED_WITH_EVIDENCE` | 会混淆 command readback 与独立详情；保留最小 readback + 单一收口链。 |
| catalog detail 标签名用 full page | `PARTIALLY_CONFIRMED` | 过宽与重复成立；首选删除 coordinator 第二次读，只有 owner detail 不能闭合时才新增 selected-ref lookup。 |
| 所有 `.refetch()` 都删 | `REJECTED_WITH_EVIDENCE` | 55 处包括 retry、网络恢复和 six-zone lazy reads；只处理成功自动失效重复链。 |
| 全部 `SELECT *` 都是同等级性能问题 | `REJECTED_WITH_EVIDENCE` | 仅 3 个 CTE 中间 wildcard，0 个 base-table wildcard；N-2 降级。 |
| 任何 tag invalidation 都会立刻发 197 HTTP | `UNVERIFIED_REQUIRES_EVIDENCE` | 全局 tag 静态成立；活跃订阅数、RTK dedupe 和真实请求数未运行。 |
| copy 执行前后再读 source closure 是“同一读取” | `REJECTED_WITH_EVIDENCE` | stale-preflight、receipt replay、target mapping 和写后 no-owner-reference 校验的时间点不同；只可 batch 化每个阶段内的集合读取，不可跨阶段删除。 |
| JSONB BOM 反向关系必须立刻新建表 | `DEXTER_DECISION` | 先做 JSONB path/filter + EXPLAIN；只有计划不可接受才裁定物化关系的模型代价。 |
| inventory 列表已是批量 item-ref lookup，因此可继续复用 catalog item list | `CONFIRMED` | 该 lookup 的 `readItems` 仍完整 `hydrateItemFacts`，与库存消费字段闭集不符；新增 owner-local `displayFactsByItemRefs`，见 M-2 / Batch B。 |
| 当前全局 `LIST` 会在每次写入中发送所有 197 个 HTTP | `UNVERIFIED_REQUIRES_EVIDENCE` | 197 个 endpoint 共享全局失效 tag 是源码事实；活跃订阅和 RTK transport dedupe 未运行，不能把它夸大为固定 HTTP 数。 |
| 同 hook-family 的多个订阅都是重复请求 | `REJECTED_WITH_EVIDENCE` | 已抽验的邀请候选、库存窗口汇总、字典订阅分别有不同请求维度；不能按 hook 名合并。 |

**独立 verdict：`NO-GO · M=2 · S=1 · N=1`。** 独立 reviewer 的 M 是全局 tag 设计与库存列表复用完整 hydration；S 是 detail tag enrichment；N 是不得误伤 inventory owner 已有 scoped `EXISTS` task read。

### Round 2（最终轮）独立 verdict 与作者 intake

- `REVIEW_CYCLE_ID=QUERY-GRANULARITY-20260817`
- `REVIEW_TARGET=DESIGN`
- `REVIEW_ROUND=2` / `REVIEW_ROUND_LIMIT=2`
- `reviewerKind=INDEPENDENT_SUBAGENT`
- `ROUND_FINAL_DECISION=SELF_DECIDED`
- blind declaration：reviewer 未打开或读取本报告，未写入源码，未运行 DEV/seed/HTTP；仅按原始材料、契约和生产源码形成 verdict。
- input 清单：`doc/review/platform/independent-subagent-adversarial-review-input-checklist-template.md`，以及本节前列的 kernel、效率红线、单 deployable/owner 约束与 catalog-inventory design。

| Round 2 输入 finding | Intake | 结论 |
|---|---|---|
| `current()` 首屏预装三周期、references 和 ledger；各区又在展开时独立读取 | `CONFIRMED` | 当前区只使用 recent changes；三周期、references、full ledger 是独立懒加载区的重复/提前读取。升为 M-5，按区拆回 typed task read，保留 current 的最近变化。 |
| 商品详情选中少量 production tag 仍读两次 whole-scope tag page | `PARTIALLY_CONFIRMED` | 重复读取事实成立；Dexter 明确该商品处理标签单门店预计不超过 20 个，收益不足以支持新增 task read，降为 N-3 并接受现状。 |
| 全局 `LIST` tag 未隔离 scope/brand/entity/zone，并叠加手动 refresh | `CONFIRMED` | M-1 补入 `period/cursor/zone` 子资源 key；保留确实要等待完整 detail 回到编辑态的目标性 refresh。真实重复 HTTP 次数仍为 `UNVERIFIED_REQUIRES_EVIDENCE`。 |
| 批量分类/标签 `Promise.all(detail → save)` | `CONFIRMED` | 已在 M-3；由一个 batch relation command/readback 解决，不再造页面 query。 |
| 已有 inventory definition/summary task read、store/workspace path 应继续扩 finding | `REJECTED_WITH_EVIDENCE` | source 未显示新 owner 越权或手写 route；bounded owner task reads 是正例，不纳入扩张。 |

**Round 2 独立 verdict：`NO-GO · M=3 · S=0 · N=0`。**

**作者 disposition 后的本件最终 verdict：当前业务 `GO` · 本轮“20 倍业务量底座效率”目标接受关闭 · 技术债 M=5 · S=6 · N=3。** M-1/M-2/M-3/M-4/M-5 分别允许失效范围、库存展示读取、批量关系操作、复制闭包或详情首屏预装随 app 活跃 query、无关商品事实、选择数或 closure 图扩大；它们是规模触发型技术债，当前无业务失败证据。N-3 的商品处理标签重复读取在 Dexter 给定的单门店不超过 20 个业务上限下接受，不进入当前整改批次。本结论不是动态性能证明。

### 独立复核状态

本件的 `REVIEW_ROUND=1` 与 `REVIEW_ROUND=2` fresh 独立盲审均已完成；以上保留独立 verdict 与作者逐项 disposition。**两轮上限已用尽，禁止以换模型/agent/文件名再开第三轮；本报告的业务 `GO` 不构成任何性能整改实施授权。**

## 8. 授权边界

本报告授权范围为只读发现、整改设计和 review intake。它**不授权**源码、契约、生成器、测试、迁移、seed、DEV、reset、start/restart、浏览器 L2、HTTP、UAT 或下一 Roadmap step 的执行。

任何实施前，必须按每个 Batch 重新读取本报告、适用详设、命中 project-memory、owner source 和 OpenAPI/generator source；每一 change point 后用同一材料与 focused proof 回读。产品/Journey/数据模型取舍（尤其 BOM 反向关系物化）交 Dexter；实现验证再交独立 Claude review。
