# HTTP 接口数据库往返与时延问题描述

## 状态与目的

`STATUS=OPEN_DIAGNOSTIC`  
`SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787`

本报告只固化已观察到的现象、证据范围与待核验问题；它不把 DEV seed 样本推断为全部接口的性能结论，也不授权任何性能代码、schema、契约或运行拓扑变更。

## 已观察到的现象

本次受管 DEV 运行在本机业务服务经受管 SSH tunnel 访问远端非生产 PostgreSQL。r5-full seed 的 `seed-report.json` 已按 operation 聚合 HTTP 耗时、`databaseOperationCount` 与 `databaseDurationMs`；catalog-inventory seed 目前只聚合 HTTP 调用耗时，后端结构化日志才保有按 requestId 关联的数据库计数。

| operationId | 样本数 | DB 操作/请求 | DB 总耗时 | HTTP 总耗时 |
|---|---:|---:|---:|---:|
| `createOperationsOrganizationStore` | 5 | 44 | 1.411–1.826s | 1.637–2.136s |
| `createOperationsContract` | 5 | 36 | 1.390–1.558s | 1.700–1.858s |
| `createOperationsOrganizationHeadCompany` | 3 | 34 | 1.402–1.497s | 1.646–1.751s |
| `selectOperationsWorkspaceSessionDataNode` | 5 | 28–33 | 0.904–1.267s | 1.044–1.469s |

上述请求的数据库操作平均单次约 35–40ms。catalog-inventory seed 共执行 679 个 HTTP 调用/688 个阶段，其中包括 34 次真实媒体 multipart、112 次字典创建、96 次商品创建和 191 次商品保存；它说明“完整体验数据重建”会放大单请求 DB 往返，但**不**说明所有 42 个 catalog-inventory operation 或系统全部 HTTP operation 都有相同问题。

## 已知范围与未知范围

1. 本次 r5-full seed 只覆盖 41 个 endpoint group，catalog seed 亦只是调用子集，二者都不能充当全接口性能分母。
2. 当前源树有两份不重叠的 generated route registry：通用 edge registry 154 条、catalog-inventory registry 42 条；按 method + 规范化 path 的当前并集为 **196 条**。这才是本轮静态审计分母。
3. 存在一份历史、隔离的全 HTTP diagnostic：其时的 registry 分母为 147，147 条均已关联（144 条正常、3 条预期拒绝、0 条未执行）。其中 **115 条正常接口的 DB 操作次数超过 5**，按 owner 分布为 workspace-iam 64、organization 26、platform-iam 10、contract 9、platform-workspace 5、extension 1。该报告的计数范围为 6–34、median 15。当前通用 registry 与该报告共有 144 个 operationId，当前新增/更名 10 个、历史已退役 3 个；再加上当前 catalog 42 条，历史 report 的 run manifest 又不含源码字节 binding。因此它只证明机制可以逐接口覆盖，不能作为当前 196 条接口的性能结论。
4. `databaseOperationCount` 是 request-local 诊断信号，包含会话、授权、范围/状态校验、扩展字段、幂等回执、审计、CAS 与 owner readback 等正确性成本；当前没有逐 SQL 分类，所以不能把 36 次直接归咎于任一具体 repository、SQL 或模块。
5. catalog seed report 未把后端 requestId 对应的数据库计数聚合回来。这是 observability/evidence 缺口，不是“catalog DB 次数为零”的结论。

## 问题陈述

当前至少一组正常写请求显示出 26–44 次数据库操作、约 1–2 秒端到端耗时。考虑本机应用到远端数据库的受管 tunnel，这种高往返数会将网络等待累加到用户可感知的时延；是否为重复权限/会话解析、扩展字段或引用校验 N+1、重复 owner read/write、审计/回执模式，或预期的跨 owner 正确性成本，尚待根因分析。

系统需要建立以当前 196 条 generated route 为分母的受控性能诊断计划：先分清已执行与未执行接口，再对每一个正常路径 DB 操作次数超过 5 的接口采集 DB 读/写分解、端到端时延及必要的 DB/连接资源信息。优化不得通过删除授权重核、幂等、CAS、审计、锁、typed failure 或必要 readback 来换取低计数。

## 已确认的同根候选与反例边界

以下是对历史 115 条高计数接口与当前源码共同层的静态复核结果；它们是待以请求级分账验证的优化候选，不是可以直接删减的 SQL 清单。

| 发现 | 已确认的有限影响面 | 安全优化边界 |
|---|---|---|
| 扩展字段定义重复读取 | organization 的品牌、租户、总公司、门店创建/更新 8 条操作，以及合同创建/更新 2 条操作：`validateValues()` 与 `replaceValues()` 均读取同一 extension definition。 | 在 owner 内传递已验证的 definition snapshot 或初始 canonical value；保留字段类型/状态/revision 校验、事务、幂等、审计和最终 readback。 |
| session 选择重复可见范围枚举 | `selectOperationsWorkspaceSessionDataNode` 和非 group assignment 的 `selectOperationsWorkspaceSessionContext`：先枚举候选用于验证，更新后又为 response 枚举。 | 把当前已验证的 candidate snapshot 传给 entry assembler；仍执行 CAS、contextVersion、assignment/role 当前态校验。 |
| catalog 保存 BOM 行级重复查目标 | `saveOperationsCatalogItem` 协调库存 BOM 时，inventory owner 对每个 component 逐个查询 target。 | 仅由 inventory owner 对本次 rows 去重后 bounded batch lookup；保留逐行 scope、存在性、typed failure、BOM CAS 与同一 `REQUIRED` 事务。 |
| command scope/path 两次解析 | project-scoped command 先解析 selected project scope，capability resolver 又重读 active assignment、role/capability 与 task path。 | 只能在同一命令授权判断内合并本次即时事实读取；不得用 session snapshot、前端输入或跨请求缓存替代撤权防护。 |

以下成本已明确为**不得为了阈值而删除**：request-scoped session cache miss、live capability/assignment recheck、owner scope recheck、idempotency receipt lock/replay lookup、CAS、audit、typed failure 和必要 readback。当前 `CountingDataSource` 逐条保留 `QUERY/UPDATE/BATCH` 类型，但 HTTP event/report 只持久化总 count/duration，且没有 owner/阶段标签；因此尚不能把任一接口的总数精确分摊到上述 bucket。必须在不记录 SQL 或敏感参数的前提下补充聚合阶段观测，再下调任意接口的 count。

历史 finding 也不得机械照搬：例如 platform workspace 列表当前已经使用 `requireActivePublicReferences(...)` 批量解析 logo，而不是逐项 asset 查询。每一条超过阈值的 operation 都必须以当前源码、当前 generated route 与当前受控诊断的三者交叉验证。

## 后续分析准入与验收

1. Claude 与 Codex 分别独立核验 operation denominator、现有 tracker 语义和样本代表性；交换证据并互相证伪根因假设，不作 `GO/NO-GO` 审批。
2. 根因调查先从当前 generated HTTP operation 的 196 条全量分母建立已执行/未执行矩阵，并审计所有 operation 共用的请求诊断、session、权限、scope、事务、审计/幂等与 JDBC tracker 链；对每个正常路径 `databaseOperationCount > 5` 的接口，必须逐项拆解 DB 操作来源并区分必要正确性成本与重复往返。历史 147 条诊断中的 115 条超过阈值必须逐一纳入，当前新增/变化 operation 必须通过独立 fixture 补齐；`createOperationsContract`、`createOperationsOrganizationStore`、会话选择和 catalog save 仅作为跨 owner 的报警样本，用于验证共同模式，不能作为调查主线或全系统结论。
3. 任何优化建议必须 owner-local，保留正确性成本，并区分“减少 request-local DB count”与“经受控 workload 验证的 p50/p95 性能改善”。
4. catalog seed report 的 DB 指标聚合需要纳入诊断闭环，但不得与 API/L2 fixture 或报告共享运行态。

## 逐接口调查方法（阈值超过 5 的强制分母）

1. 从两份当前 generated registry 生成 196 条 `operationId + method + normalizedPath + owner + consumerFace` 的 exact-set；历史 147 条 profile 只作为已观察样本回填，不得覆盖或删除当前 operation。
2. 对每条正常成功请求，在既有 request-local tracker 内记录**聚合阶段**的 statement count/duration：`SESSION`、`SCOPE`、`CAPABILITY`、`OWNER_CONTEXT`、`RECEIPT`、`EXTENSION`、`OWNER_WRITE`、`AUDIT`、`READBACK`、`BATCH_OR_FANOUT`。不得记录 SQL、bind 值、token、cookie、手机号、登录名或 raw payload。
3. 任何结果超过 5 的 operation，都要输出其完整阶段分账、当前 source call chain、正常/重放/拒绝/冲突反例及 disposition；结果不超过 5 的 operation 也保留一行覆盖记录，防止分母选择性遗漏。
4. 对当前 10 个新增/更名的通用 operation 与 42 个 catalog operation，建立各自独立、最小的 HTTP diagnostic fixture；catalog 的 DEV experience seed 不得成为 API/L2/HTTP diagnostic 的依赖。无法安全执行的接口必须给出逐条 `reasonId + disposition`，不能默认正常。
5. 优化后的比较必须在同一受控 workload 下同时报告 success/replay/denial/conflict 结果、总 DB count、阶段分账、HTTP p50/p95、DB p50/p95、连接池/锁等待；只有 count 减少时称“往返优化”，只有 workload 指标改善时称“性能改善”。

### 历史高计数集合与当前路由的精确对账

历史报告中的 115 条正常 `>5` operationId **全部仍在当前 154 条通用 registry 中**，没有任何一条可因重命名或退役从本轮调查中排除。除它们外，当前通用 registry 有 10 条新增/更名 operation，catalog registry 有 42 条此前未纳入历史 diagnostic；这 52 条没有当前 DB count 时只能标为 `UNMEASURED`，不能推定低于阈值。

该集合必须由下列确定性查询从历史报告取得，禁止手工筛选或只保留最高几个样本：

```sh
jq -r '.operationProfiles[]
  | select(.outcome == "PASSED" and .databaseOperationCount.max > 5)
  | [.operationId, .owner, .method, .path,
     .databaseOperationCount.average, .databaseOperationCount.max]
  | @tsv' \
  .runtime/rm1/http-diagnostic/rm1-http-diagnostic-1785592416417-9e221440/evidence/http-diagnostic-report.json
```

每一行随后必须以当前 registry/handler/source chain 复核；按 owner 的 64/26/10/9/5/1 仅用于安排调查，不可把一个 owner 的公共解释自动套给该 owner 的每个 operation。

## 证据

- `.runtime/r5/seed/rm1-seed-23c45701-b96b-49d3-8010-69bb5fc4fbb6/seed-report.json`
- `.runtime/r5/catalog-inventory/seed/catalog-seed-2734036b-93aa-4e9e-9a3c-f60fef067612/seed-report.json`
- `.runtime/r5/business-server.log`
- `.runtime/rm1/http-diagnostic/rm1-http-diagnostic-1785592416417-9e221440/evidence/http-diagnostic-report.json`
- `doc/evidence/platform/rm1/p6/rm1p6-u13-all-http-crud-efficiency-problem-family.json`
- `apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json`
- `apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json`
- `project-memory/decisions/http-crud-efficiency-design-redlines.md`
- `doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md`
