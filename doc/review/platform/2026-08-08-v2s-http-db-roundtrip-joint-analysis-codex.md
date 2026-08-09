# HTTP/DB 往返问题联合分析（Codex 侧）

性质：与 Claude 基于同一 fresh 受管证据的共同分析，**不是 GO/NO-GO 评审，不实施优化**。本文件是 Codex 的独立分析输入，需与 Claude 报告相互证伪后才可形成优化计划。

`SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787`

## 1. 证据范围与口径

本报告只使用本次受管 DEV 的原始 DB 逐操作事件及其精确关联的 seed 报告：

- r5-full：173/173 API 调用精确关联，41 个 endpoint group；
- catalog-inventory：679/679 API 调用精确关联，15 个 endpoint group；
- 原始事件中，54 个唯一 operationId 的请求 DB 往返超过 5 次，共 4,471 个请求。

当前 measurement 为 `schemaVersion=2`、`JDBC_EXECUTION_PLUS_CONNECTION_TRANSACTION_BATCH`。因此 `databaseOperationCount` 是 JDBC 交互总数，不等同于 SQL 条数，也不等同于业务 owner 的查询数：其中包含 `GET_CONNECTION`、事务控制、查询、更新和批处理逻辑语句数。

本报告不把 seed 样本外推为全部 196 条 HTTP operation 的性能结论。未执行 operation 必须独立建立 disposition，不能默认正常。

## 2. 结论先行

1. 本轮已经足以确认三处 owner-local 问题：字典 readback 的纯重复查询、商品保存的重复详情读取、BOM 行级 target 校验 N+1。
2. 高计数的最大共同部分是请求级会话、权限与组织范围解析。它们是当前正确性边界，尚不能因计数高而删除；是否可合并为更少的 set-based 即时事实读取，需单独对照撤权、assignment、任务路径与品牌授权语义。
3. 约 41ms/query 和约 29ms/commit 是本机 Spring Boot 经 SSH tunnel 到远端 PostgreSQL 的 JDBC 综合往返，不是 SQL 执行时间。没有 `SELECT 1` 预热基线、有效 Hikari 配置和 pool 指标，不能将其归因为 SQL、tunnel 或远端数据库中的任一项。
4. `sectionCounts` 表示逻辑业务段，不是 JDBC 类型；连接、事务真实存在于 DB JSONL 的 `kind`。`READBACK_END` 未出现则是确定的 phase 覆盖缺口。

## 3. 已确认的 owner-local 根因

### M-01：字典 readback 逐条重复读取全部商品 sections

`CatalogOwnerService#dictionaryReferenced` 在 `getOperationsCatalogDictionary` 的条目循环中，反复执行同一 scope/brand 的商品 sections 查询。代表请求同一 `statementId + paramsHash` 连续出现 51 次，四次字典 readback 共 112 次。

这不是业务事实不需要，而是同一份商品 sections snapshot 被重复拉取。最小修复应限定在当前 owner readback：一次读取后供多个字典条目判断引用。不得先引入跨请求缓存，也不得删除 `voidAvailability`、`blockingReferences` 或状态过滤。

### M-02：保存商品的跨 owner 协调借用了三次详情读取

`saveOperationsCatalogItem` 191 次请求均三次执行同参数的 `CatalogOwnerService#loadItems`，合计 573 次；并伴随两次 `generation` 查询，合计 382 次。

调用语义经源码回读为：

1. 保存前通过详情读取旧 asset refs；
2. `saveItem` 内读取当前商品，承担状态、来源、引用和 CAS 更新前事实；
3. 保存后再通过详情读取 item/SKU/option refs，供库存 owner 定义命令使用。

第 2 次是 owner 自身正确性读取，必须保留。第 1、3 次不应继续走 UI/detail read model；catalog owner 可在已读取 current 与保存后的 canonical sections 上返回受控的内部协调上下文。这样可同时去除每次保存 2 次 `loadItems` 和由这两次详情组装派生的 2 次 `generation`，但不得缓存跨越写入的 generation，也不得弱化 CAS、幂等、资产 claim/release 或同一 `REQUIRED` 事务。

### S-01：保存 BOM 时按行查询库存 target

`InventoryOwnerService#target` 在 `saveCatalogProductBom` 中逐行验证 component target 存在性。观测到相同 SQL 模板连续出现、参数不同：本次 64 次，其中部分请求为 2–3 个 BOM 行。

这是随 BOM 行数线性增长的 N+1。存在性与 scope 验证仍是库存 owner 的必要事实；最小修复是先收集去重 targetRef，一次 `IN (...)` 查询得到存在集合，再按原始行顺序维持同样的首个 `REFERENCE_MAPPING_UNRESOLVED` failure、版本 CAS 与同事务边界。

## 4. 不得误判为 owner 缺陷的成本

以一个 48 次 DB 交互的 `saveOperationsCatalogItem` 为例：

- SESSION：12；
- AUTHZ：2；
- SCOPE：13；
- OWNER_WRITE：21。

因此“商品保存 48 次”不能直接等价为“catalog owner 写了 48 条 SQL”。样本进入 owner command 前已发生约 27 次会话、授权和 scope 的即时事实读取。这些读取可能有后续 set-based 合并空间，但目前承担 session、角色、assignment、可见节点、品牌与任务路径的实时校验；禁止以 session snapshot、前端输入或跨请求缓存替换。

另有两个反例：

- `PlatformAssetService#require` 的双次读取被写入/claim 分隔，当前不能当作纯重复合并；
- 保存后的 `generation` 可能体现写后版本，不能通过简单 request cache 合并。

## 5. 时延与拓扑边界

catalog 直接样本的 JDBC kind 汇总：

| kind/action | 次数 | 平均耗时 | 结论 |
|---|---:|---:|---|
| QUERY/EXECUTE_QUERY | 15,581 | 40.88ms | 主要综合往返成本 |
| UPDATE/EXECUTE_UPDATE | 1,742 | 34.26ms | 主要综合往返成本 |
| TRANSACTION/COMMIT | 4,004 | 29.38ms | 同样是远端事务往返 |
| CONNECTION/GET_CONNECTION | 4,543 | 0.34ms | Hikari borrow，不是物理建连 |
| TRANSACTION/SET_AUTO_COMMIT | 4,024 | 约 0ms | 本地代理动作 |

运行清单显示应用连接 `127.0.0.1:25432`，该端口由受管 SSH tunnel 转发至 `catering-remote-dev:5432`。`BusinessDataConfiguration` 已包装全部 Spring DataSource，没有发现第二个生产 DataSource。因此数据源未接入不是原因；但当前没有有效 Hikari 配置/池状态，也没有预热 `SELECT 1` 基线，不能把 40ms 归到 SQL、network、tunnel 或远端 PG 任一层。

下一轮只能先补观测：记录非敏感 Hikari 生效配置、pool active/idle/pending、固定次数的预热 `SELECT 1` p50/p95，并把它与 query/update/commit 分布并列。若要拆分 tunnel 与服务端耗时，需要单独的远端侧测量授权。

## 6. 观测质量结论

`sectionCounts.CONNECTION=0`、`sectionCounts.TRANSACTION=0` 不是采集缺失：它们是 JDBC kind，而当前 tracker 会保留外层 SESSION/AUTHZ/SCOPE/OWNER 的逻辑 section。报告应改名为 `logicalSectionCounts`，并平行输出 `kindCounts`、`kindDurationMillis`、`connectionBorrowCount` 和 `connectionBorrowDurationMillis`。

真正的覆盖缺口是 `READBACK_END`：catalog 请求没有任何真实标记。应只在 `CatalogInventoryApplicationService` 的真实 enrich/readback 完成分支中 push `READBACK` 并标记 `READBACK_END`；不得在 finally 无条件补一个 phase。

## 7. 后续联合分析分母

1. 对已执行的 54 个 `>5` operationId 逐项分为：固定安全前置、必要写入/回读、确定重复、N+1 候选、拓扑主导、观测不足。
2. 对 196 条 generated route 中未执行部分逐条落六类 disposition；不可由 seed 未触达推定低成本。
3. 所有优化设计必须同时列出：保留的 owner 事实、事务、CAS、idempotency、audit、typed failure、锁与 readback；预期减少的 request-local JDBC 往返；以及同 workload 的 HTTP/JDBC p50/p95 复验方法。

## 8. 证据与源码

- `.runtime/r5/evidence/db-operations.jsonl`
- `.runtime/r5/evidence/seed-request-events.jsonl`
- `.runtime/r5/seed/rm1-seed-8a596243-58cc-4637-90f2-f0bf12627775/seed-report.json`
- `.runtime/r5/catalog-inventory/seed/catalog-seed-a7ac3855-17d3-49ba-abff-9d14244163de/seed-report.json`
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java`
- `apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java`
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/application/cataloginventory/CatalogInventoryApplicationService.java`
- `apps/backend/catering-business-server/modules/foundation/src/main/java/com/catering/v2s/platform/foundation/persistence/CountingDataSource.java`
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/configuration/BusinessDataConfiguration.java`
- `.runtime/r5/run-manifest.json`
