# 后台接口性能整改 · 设计期辩证 intake

- 日期：2026-08-22
- 作者：Codex
- 状态：`AUTHOR_INTAKE_COMPLETE`
- 输入：
  - `doc/plans/platform/2026-08-22-v2s-backend-performance-remediation-requirements-claude.md`
  - `doc/review/platform/2026-08-22-v2s-backend-performance-root-cause-analysis-claude.md`
- 方法：不继承上游结论；重开 registry 生成源、运行时 registry loader、JDBC tracker、HTTP completion event、catalog owner、operations-admin 消费者和受管 DEV 脚本。

## 1 · 结论摘要

需求的主方向成立：L1 消除 Java↔PostgreSQL 的逐 SQL 隧道往返，L2 用每 operation 预算与连接/分类门防止往返数回涨，L3–L5 再治理现存重复读取。以下修正已折入正本与详设，不把待验证输入直接当事实。

| 输入主张 | 处置 | 独立证据与边界 |
|---|---|---|
| 全量为 238 个 operation | `CONFIRMED` | 运行时实际加载 `edge-route-face-registry` 181 条和 `catalog-inventory-edge-route-registry` 57 条；两者 operationId 无重复。`platform-route-face-registry` 的 3 条是重复副本，不另加分母。 |
| 当前 L1 是本机 Java 经 PostgreSQL tunnel | `CONFIRMED` | `scripts/dev/r5-dev-runner.mjs` 的 `openTunnel` 转发 PostgreSQL/asset，`start` 本机 spawn Gradle 与两个 Vite。 |
| L1 可以“零代码”完成 | `REJECTED_WITH_EVIDENCE` | 业务代码无需改变，但受管脚本、manifest、远端身份、日志、readiness、stop/reset/seed、Vite target 和治理文档都必须改变；故准确口径是“零业务语义改动”。 |
| 资产 tunnel 是否保留待核实 | `CONFIRMED_KEEP` | asset owner 返回由 `MinioAssetObjectStorage.publicUrl` 拼出的 URL，前端图片直接使用；当前不是 presigned/网关代理下载，资产 tunnel 必须保留。 |
| 42.7ms 全部来自 SSH tunnel | `UNVERIFIED_REQUIRES_EVIDENCE` | 同侧 acceptance 是强反例证据，但未做远端 Java 前后同 workload 对照；L1-05 承载验证。 |
| 远端资源足以运行 Java | `UNVERIFIED_REQUIRES_EVIDENCE` | 必须在受管 start 前做 CPU/RAM/磁盘/JDK/Gradle/端口预检；不足即停机，不以本机回退止血。 |
| 238 个 operation 已有统一预算声明 | `REJECTED_WITH_EVIDENCE` | `databaseOperationBudget` 非文档源码零命中。catalog 的 `normalPathDbOperations` 14 个 null、且语义明确不是 ceiling，不能改名冒充预算。 |
| tracker 可直接作为计数底座 | `CONFIRMED_WITH_BOUNDARY` | `DatabaseOperationTracker` 与 `HttpRequestMetricsInterceptor` 已按真实请求输出计数、连接、section。acceptance 的 `BackendAcceptanceDatabaseMetricsSink` 是 scenario-local last snapshot，不能做 238-operation 分母或预算真相源；门消费 run-scoped `http-request-events.jsonl`。 |
| 未分类比例是 20% 门 | `REJECTED_WITH_EVIDENCE` | 同一需求后文已裁定 5%；最终唯一阈值为 SQL execution 分母上的 `UNCLASSIFIED ≤ 5%`，CONNECTION/TRANSACTION 不得稀释。 |
| 56 个 `pushSection` 都是生产打标点 | `PARTIALLY_CONFIRMED` | 宽扫含测试；生产调用约 51 处、分布于 9 个文件。核心结论仍成立：分散式打标已存在且仍漏，不能继续逐 SQL 补。 |
| 层入口打标可用固定点数上限描述 | `REJECTED_WITH_EVIDENCE` | owner 方法不是统一代理入口，实际 owner 数/读写入口需源码分母生成；采用性质门：新增 owner SQL 不改打标代码仍自动归类，并以“生成的入口集合 exact-set”约束，而不是冻结猜测数字。 |
| P2 的 57 个 GET 都由缺少连接作用域导致 | `PARTIALLY_CONFIRMED` | 代表接口与写/读差异成立；仓内已有 218 个 `@Transactional(readOnly=true)` 命中，不能对 57 条 blanket 修改。实施前逐 operation 将 route→task-reader→事务边界闭合，只对确认缺口增加只读任务作用域。 |
| 逐项批量流转当前没有逐项结果 | `REJECTED_WITH_EVIDENCE` | 当前 owner 已返回有序 `{itemRef, ok, failureCode, version}`，UI 已显示成功/失败数和失败项。真实缺口是 itemCode、二值 outcome、owner reason、严格同序完整性与保存后精准刷新。 |
| 批量应改成整批原子 | `REJECTED_WITH_EVIDENCE` | Dexter 后续裁定逐项尽力；每项 `REQUIRES_NEW` 是必要语义。只把循环前可共享读改成 set-based，不压平事务。 |
| batch 结果需要 `SKIPPED` | `DEXTER_DECISION` | 不需要。结果闭集为 `SUCCEEDED | FAILED`；合法 no-op 归成功，请求级前置失败走整体 typed problem。 |
| B-06 保持逐项成功审计 | `REJECTED_WITH_EVIDENCE + DEXTER_DECISION` | 当前单条/批量状态流转没有该审计事实。B-06 修正为不新增审计语义；receipt 不冒充审计。 |
| 按名字扫到的批量操作只有 1 个，足以作为全集 | `REJECTED_WITH_EVIDENCE` | 按 request schema 扫出 24 个数组入参 operation；逐项判定后仅 `batchTransitionOperationsCatalogItemStatus` 是“数组元素各自独立写入”。24 行闭集写入详设。 |
| P0 94 条可直接写最终预算 | `UNVERIFIED_REQUIRES_EVIDENCE` | 真实计数未知。先让 L2 机制可表达但不激活 null/fallback；再在同侧受管 workload 对 238 条取证，最后一次性写入非 null 预算并开启门。未知分母不得编造数值。 |

## 2 · 方案收敛

1. L1 的远端 Java、本机 Vite、HTTP/asset 双 tunnel 必须作为一个原子切换；AGENTS、Blueprint、受管脚本和 runtime memory 在代码形态完成时同批翻转，不能先把文档改成一个尚不能执行的拓扑。
2. L2 预算声明、238 exact-set、每请求事件消费、连接/transaction-begin/UNCLASSIFIED 门和层入口打标同批闭合。`normalPathDbOperations` 保持原语义，不作兼容字段。
3. 预算支持固定式与批量线性式；`batchTransitionOperationsCatalogItemStatus` 唯一使用 `15 + 5 × N`，N 取规范化后请求项数。调高必须有 Dexter decisionRef；普通维护只能调低。
4. P0 取证是预算激活的前置，不是事后补证。P1–P5 分类在当前树上重新计算，不能把历史 94/4/57/36/9/38 当永久台账。
5. UI 只改现有批量结果 Modal；不新增页面、不新增审计入口、不把技术计数展示给用户。

## 3 · 仍需由实施证据关闭的边界

- 远端主机资源与 Java readiness；
- L1 前后同 workload 的真实延迟差；
- P0 94 条在当前树的真实 DB/连接/section 值；
- 57 个 GET 中每条现有只读作用域的实际边界；
- 每个初始预算值及 P4 九条重分类结果。

这些不是产品未决项，不阻塞设计；它们是实施时有明确停机条件的测量任务。设计不为它们填假值，也不提供本机 Java fallback。

## 4 · 独立设计审查 Round 1 辩证处置

| finding | 作者状态 | 处置 |
|---|---|---|
| M-01 · 新预算门与“性能门退役”正本冲突 | `CONFIRMED` 冲突；`REJECTED_WITH_EVIDENCE` 其“需再获产品裁定”部分 | Dexter 已确认本轮 requirements，L2 明确写“把门加回来”。已把 2026-08-14 标准、AGENTS、Blueprint、scripts README 与 runtime skill 修正为：旧 scenario `performanceCriterion`/provider 控制面继续退役；新 generated 238-operation budget 由独立 run-level verifier 消费 production completion events，不参与单场景 CONTRACT/BUSINESS。没有复活旧 lane/provider。 |
| S-01 · `CALIBRATION_PENDING` 含糊 | `CONFIRMED` | 删除 pending 状态。CP-03/04 先产生非门控 event，CP-05 取得 238 实值；此前不写 canonical budget、不生成 registry、不接 verifier。实值齐全后 CP-02 一次性写满并原子生成/激活。 |

Round 1 后没有产品未决项；进入同 cycle 的 Round 2 定向核验，之后硬停止。

## 5 · 独立设计审查 Round 2 收口

`GO · M/S/N=0/0/1`。N-01（IA 尾注仍为 pending）已确认并改为 `CROSS_CHECK_WITH_DESIGN=COMPLETE`；不改变设计语义。两轮上限已达到，`ROUND_FINAL_DECISION=SELF_DECIDED`，本 cycle 硬停止，不再召集第三轮。
