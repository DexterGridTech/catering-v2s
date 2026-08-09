# HTTP/DB 往返问题联合分析（Claude 侧）

性质：与 Codex 基于同一份 fresh 受管证据的共同分析，**不是 GO/NO-GO 评审，不实施优化**。
本文所有数字均为我对 `.runtime/r5/evidence/db-operations.jsonl`（29,714 行）的独立复算，
未采信任何报告自述。

新口径：`JDBC_EXECUTION_PLUS_CONNECTION_TRANSACTION_BATCH`。

---

## 0. 三个结论先行

### 0.1 新口径下「DB 操作次数」已不再是延迟的代理指标

按 action 拆解全部 29,714 次操作：

| action | 次数 | 占次数 | 总耗时 | 占耗时 | 单次均值 |
|---|---:|---:|---:|---:|---:|
| `EXECUTE_QUERY` | 15,553 | 52.2% | 635,481ms | 78.1% | 40.9ms |
| `COMMIT` | 3,984 | 13.4% | 116,607ms | 14.3% | 29.3ms |
| `EXECUTE_UPDATE` | 1,742 | 5.8% | 59,685ms | 7.3% | 34.3ms |
| `GET_CONNECTION` | 4,515 | 15.1% | **994ms** | **0.1%** | **0.2ms** |
| `SET_AUTO_COMMIT` | 3,996 | 13.4% | **3ms** | **0.0%** | **0.0ms** |
| `ROLLBACK` | 12 | 0.0% | 725ms | 0.1% | 60.4ms |

**`GET_CONNECTION` + `SET_AUTO_COMMIT` 合计 8,511 次，占次数 28.6%，却只占耗时 0.1%。**
这直接说明两件事：**连接池是健康的**（取连接 0.2ms，不是每次新建连接）；
以及**新口径把次数抬高了约 29%，但那部分次数几乎不产生延迟**。

> **方法论要求（请 Codex 一并采纳）**：后续所有比较、排序与验收都必须以**耗时**为主指标，
> 次数只作辅助。继续用「DB 操作次数 > 5」这类阈值会把 0.2ms 的取连接和 40.9ms 的跨网查询等价看待。
> 历史 evidence 里的 44/36 与本轮的 69/61 **不可直接比较**，口径已变。

### 0.2 真正的大头不是任何一处烂循环，是**每请求都要付的授权前置**

按 `section` 复算（872 个请求）：

| section | 次数 | 每请求 | 耗时 | 占比 |
|---|---:|---:|---:|---:|
| `OWNER_WRITE` | 9,814 | 11.0 | 294,120ms | 35.9% |
| `SESSION` | 8,901 | 10.0 | 269,914ms | 32.9% |
| `SCOPE` | 7,181 | 8.0 | 150,847ms | 18.4% |
| `OWNER_READ` | 3,088 | 3.5 | 87,111ms | 10.6% |
| `AUTHZ` | 998 | 1.1 | 17,483ms | 2.1% |

**`SESSION` + `AUTHZ` + `SCOPE` = 每请求 19.1 次往返、438,244ms、占全部 DB 耗时 53.5%。**

耗时 top12 的 callSite 里，**11 个是共享前置**，唯一的业务逻辑是 `loadItems:1504`：

| callSite | 次数 | 耗时 | 占比 |
|---|---:|---:|---:|
| `WorkspaceAuthenticationService#require:244` | 744 | 46,925ms | 5.7% |
| `CatalogOwnerService#loadItems:1504` | 767 | 37,811ms | 4.6% |
| `WorkspaceAdministrationService#isEnabled:89` | 673 | 37,758ms | 4.6% |
| `WorkspaceAssignmentScopeService#requireActiveScope:24` | 511 | 31,213ms | 3.8% |
| `BusinessEntityService#requireCatalogBrand:351` | 476 | 29,637ms | 3.6% |
| `WorkspaceRoleService#require:145` | 752 | 25,678ms | 3.1% |
| `WorkspaceAuthenticationService#loadSession:162` | 714 | 24,749ms | 3.0% |
| `OrganizationVisibilityService#hierarchy:169` | 725 | 24,556ms | 3.0% |
| `OrganizationVisibilityService#listVisibleDataNodeCandidates:97` | 732 | 24,400ms | 3.0% |
| `OrganizationVisibilityService#listVisibleDataNodeCandidates:116` | 732 | 24,199ms | 3.0% |
| `WorkspaceAuthenticationService#requireAssignment:298` | 719 | 24,004ms | 2.9% |
| `OrganizationTaskPathService#node:346` | 719 | 23,601ms | 2.9% |

十二项合计 **354,531ms = 43.6%**。

**关键判读**：这些 callSite 的调用次数都在 700–770 之间，对应 872 个请求——
**每请求约一次，不是重复调用**。所以这**不是** N+1、**也不是**可以靠请求内缓存消除的重复；
它是**十余次彼此独立、串行发出的前置查询**。

> 这是对「究竟是什么样的烂逻辑」的直接回答：
> **不是某一段坏代码，而是"会话→角色→分配→范围→可见性→品牌授权"被拆成十余次顺序往返，
> 每次在当前拓扑上付 41ms。** 业务逻辑本身反而不是主要成本。

### 0.3 单次 41ms 是往返延迟，不是执行时间

`EXECUTE_QUERY` 均值 40.9ms、`EXECUTE_UPDATE` 34.3ms、`COMMIT` 29.3ms，
而同进程内的 `GET_CONNECTION` 0.2ms、`SET_AUTO_COMMIT` 0.0ms。
**凡是需要与数据库交互一个来回的动作都在 30–41ms，凡是本地动作都接近 0。**
这是拓扑特征，与 SQL 复杂度无关。

因此两个杠杆的量级：把每请求 30 次往返砍到 15 次，省 ~615ms；
把单次 41ms 降到 1ms，省 ~1,190ms（同样的 30 次）。
**在当前拓扑下第二个杠杆更大，且不需要动任何业务代码。**

---

## 1. 强信号的证据链、必要性与反例

### 1.1 `CatalogOwnerService#dictionaryReferenced:1192` —— 51 次完全相同的全表扫描（新发现，强度最高）

**证据链**：`getOperationsCatalogDictionary` 的代表请求中，
同一 `statementId` **且同一 `paramsHash`** 出现 **51 次**：

```sql
SELECT sections::text FROM catalog.catalog_item
WHERE data_node_ref=? AND brand_ref=? AND status <> 'VOIDED'
```

源码印证：`CatalogOwnerService:531` 在字典条目游标循环内逐条调用
`dictionaryReferenced(dataNodeRef, brandRef, kind, entryRef)`，
而该方法（第 1190–1192 行）每次都**无 code 过滤地拉取该品牌全部非作废商品的 sections**，
再在 Java 侧判断是否命中引用。参数逐次完全相同 → 51 次拿回的是同一份结果集。

**必要性判定**：`voidAvailability.canVoid` 与 `blockingReferences` 是需求要求的真实业务事实，
**不能删**。但"取数据"与"判断引用"是两件事——同一份 sections 快照可服务全部条目。

**反例边界（如实声明）**：全局只有 112 次、3,623ms、**占总耗时 0.4%**，
因为本次 seed 只调了 4 次该接口。**它是严重的单请求缺陷，但不是本次的耗时大头。**
其危害在于随字典条目数与商品数**双向放大**：51 个条目 × 全表扫描，
真实运营浏览字典时会持续触发。**按性质定优先级，不按本轮占比。**

### 1.2 `CatalogOwnerService#loadItems:1504` —— REDUNDANT_REPEAT，已确认

**证据链**：`saveOperationsCatalogItem` 代表请求中同 statementId+同 paramsHash **×3**；
全局 767 次、37,811ms、**4.6%**，是 top12 中唯一的业务逻辑项。

**必要性判定**：需要复核。同一请求内三次以相同参数装载同一批 item，
若三处调用点之间没有写入介入，则后两次可复用第一次结果；
**若中间有写入，则第二、三次是必要的写后重读**，不能合并。
`saveOperationsCatalogItem` 的 `OWNER_WRITE` 段每请求有 `EXECUTE_UPDATE`，
**所以必须先确认三次调用与写入的相对顺序**（`seq` 字段可还原），不能直接判为冗余。

### 1.3 `CatalogOwnerService#generation:1622` —— REDUNDANT_REPEAT，低风险

`SELECT COALESCE(MAX(version),0) FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=?`
同参数 ×2，全局 382 次。这是 generation 标记读取，**幂等且无副作用**，
同一请求内两次取同一 generation 属可合并。风险低于 1.2。

### 1.4 `InventoryOwnerService#target:755` —— N+1 候选，**证据不足以定性**

**证据链**：同 statementId、**3 个不同 paramsHash**、×3。

**我的判定：`UNVERIFIED`，不建议按 N+1 处理。** 理由：
阈值 ≥3 是最低触发线，3 条不同参数完全可能是"该商品确实有 3 个 SKU 的库存对象"这一真实业务基数，
而非循环逐条查。**要定性必须看该请求的 SKU 数**：
若 SKU 数恒等于查询次数且随商品规模增长，才是 N+1；
若 SKU 数就是 3，那是必要查询。建议补一个 SKU 数为 10+ 的 fixture 再判。

### 1.5 `replay:1618` / `saveReceipt:1619` —— 不是缺陷，是被错误归类

各 423 次，当前 `section=OWNER_WRITE`。**它们是幂等回执的读与写，应归 `IDEMPOTENCY`。**
见 §4 的归因缺口。**这两处不得优化**（见 §5）。

---

## 2. owner-local 的 DB 次数削减方案

按预期收益排序。**全部不改变授权、事务与业务语义。**

### 2.1 `catalog` owner：把 `dictionaryReferenced` 提到循环外（收益/风险比最高）

把第 531 行循环前**一次性**取回 sections 快照，循环内改为在内存快照上判断引用。
单请求 51 次 → **1 次**。语义完全不变（同一请求内本就应看到一致快照，
现在的 51 次分别读还引入了不必要的读偏斜）。

**验收**：同一请求的 `dictionaryReferenced` 语句数应等于 1；
`voidAvailability.canVoid` 与 `blockingReferences` 的输出逐条不变。

### 2.2 `workspace-iam` + `organization` owner：合并授权前置的串行往返（收益最大）

当前每请求约 19 次前置往返，分布在 `require:244`、`loadSession:162`、
`requireAssignment:298`、`WorkspaceRoleService#require:145`、`isEnabled:89`、
`requireActiveScope:24`、`hierarchy:169`、`listVisibleDataNodeCandidates:97/116`、
`node:346`、`requireCatalogBrand:351` 等十余处。

这些是**彼此独立的顺序查询**，不是重复。可行方向按侵入性从低到高：

1. **合并同 owner 内的相邻查询**：`listVisibleDataNodeCandidates:97` 与 `:116` 各 732 次、
   合计 48,599ms，同一方法内两次查询，优先确认能否一次 join 取回；
2. **会话读取一次成型**：`loadSession` + `requireAssignment` + `WorkspaceRoleService#require`
   合计 2,185 次、74,431ms，语义上都是"这个会话的身份与授权"，
   可考虑一条 join 查询产出完整授权快照；
3. **请求作用域缓存**：仅对**同一请求内被多次读取的同一事实**生效。
   注意本轮数据显示这些调用基本是每请求一次，**所以缓存收益有限**——
   这一条优先级低于前两条，不要先做。

**边界**：合并查询**不得**改变任何一处校验的判定结果或抛出的 typed failure；
每一处合并都必须能证明"合并前后每个校验分支的取值完全相同"。

### 2.3 事务边界：4.6 次 COMMIT/请求，值得核查但不要贸然合并

`COMMIT` 3,984 次 / 872 请求 = **4.6 次/请求**，每次 29.3ms，即约 135ms/请求、占 14.3%。
`SET_AUTO_COMMIT` 3,996 次与之基本一一对应，说明每段都显式开了事务。

**核查方向**：确认这 4.6 段中有多少是**只读**路径。只读路径不需要写事务提交，
若能以只读方式执行可省去 COMMIT 往返。

**这一条我标记为需要 Dexter 裁定**：事务边界牵涉原子性与隔离级别，
合并事务可能改变失败时的回滚范围。**不属于"纯性能改动"，不得在本轮自行决定。**

---

## 3. 拓扑 / 连接池 / tunnel 的验证方案

**已可下的结论**：连接池健康。`GET_CONNECTION` 4,515 次均值 **0.2ms**，
不存在"每次新建连接"或"池耗尽等待"。这条**不需要再验证，也不需要优化**。

**待验证的是单次 30–41ms 的构成。** 建议按以下顺序，每步都是独立可证伪的：

1. **空往返基线**：在业务服务进程内执行 `SELECT 1` × 100，取 p50/p95。
   若 p50 ≈ 40ms，则 41ms 几乎全是网络往返，SQL 本身不是因素——
   这一步就能定性，**必须先做**。
2. **旁路 tunnel 对照**：同一台机器直连数据库（不经 SSH tunnel）重复第 1 步。
   两者之差即 tunnel 引入的延迟。
3. **同机对照**：应用与数据库同机（容器或本地 PostgreSQL）跑同一个 seed，
   比较端到端 p50/p95 与 DB 耗时占比。**这一步决定"次数优化"到底值多少**。
4. **批量效应**：确认驱动是否启用了 `reWriteBatchedInserts`，
   以及是否存在可合并为单次往返的连续小查询。

**验收口径**：第 1、2 步产出的是**单次往返成本**；第 3 步产出的是**端到端 p50/p95**。
优化建议必须分别引用，**不得用"DB 次数下降 40%"去宣称"延迟下降 40%"**——
在同机拓扑下前者可能只对应几十毫秒。

---

## 4. 观测覆盖缺口的根因与最小修复

### 4.1 「catalog CONNECTION/TRANSACTION 为 0」这一说法**与证据不符**

我按 owner 复算：

| owner | CONNECTION | TRANSACTION | QUERY |
|---|---:|---:|---:|
| catalog | **3,579** | **6,312** | 12,632 |
| organization | 212 | 368 | 757 |
| workspace-iam | 293 | 586 | 1,000 |
| asset | 238 | 408 | 680 |

**catalog 的 CONNECTION 与 TRANSACTION 都不是 0。** 请 Codex 复核该结论的来源——
可能是从 catalog seed report 的某个聚合字段读的，而该字段未包含新 kind。
若如此，**修的是 report 聚合，不是采集**。

### 4.2 真实缺口一：phase 缺两个终态

实测 phase 分布：`EDGE_IN` 9,894、`SESSION_RESOLVED` 5,702、`AUTHORIZED` 7,181、
`SCOPE_RESOLVED` 1,850、`OWNER_COMMAND_BEGIN` 4,670、`OWNER_COMMAND_END` **641**。
**`READBACK_END` 与 `EDGE_OUT` 完全不存在**，且 `OWNER_COMMAND_END` 只有 BEGIN 的 14%。

**后果**：写后回读的成本无法从 phase 维度切出，
`OWNER_COMMAND_BEGIN` 之后的所有操作都无法确认属于命令本体还是回读。
**最小修复**：在 owner 协调层的 readback 结束与 edge 出口各补一条事件；
并排查 `OWNER_COMMAND_END` 为何在 86% 的情况下未发出（很可能是异常路径或提前 return 未覆盖）。

### 4.3 真实缺口二：section 只落地 5 个，且 `UNCLASSIFIED` 为 0

实测只有 `OWNER_WRITE`/`SESSION`/`SCOPE`/`OWNER_READ`/`AUTHZ` 五个，
规格约定的 `IDEMPOTENCY`、`CAS`、`AUDIT`、`READBACK`、`REFERENCE_CHECK`、`EXTENSION` **全部缺失**，
而 `UNCLASSIFIED` **一次都没有出现**。

**这两件事合起来说明：未匹配的操作没有落到兜底类，而是被吸收进了那 5 个桶。**
直接证据：`replay:1618`（幂等回执读）与 `saveReceipt:1619`（幂等回执写）各 423 次，
当前都标 `OWNER_WRITE`——它们显然应属 `IDEMPOTENCY`。

**后果**：`OWNER_WRITE` 的 35.9% 里混入了幂等、CAS、审计、回读的成本，
**无法回答"哪些是必要正确性成本"这个核心问题**——而这正是 Dexter 立的红线所在。

**最小修复**：把 section 判定改为**先精确匹配、未命中一律落 `UNCLASSIFIED`**，
不允许兜底到 OWNER_WRITE/OWNER_READ；并为幂等、CAS、审计、回读四类各补一个 push 点。
`UNCLASSIFIED` 占比应作为下一轮的质量闸：**超过 15% 说明覆盖不足，不得据此下优化结论**。

---

## 5. 明确不应优化的项

以下每一项都在本轮证据中可见，**均属必要正确性成本，不得为降低次数而削减**：

- **授权重核**：`require:244`、`requireAssignment:298`、`WorkspaceRoleService#require:145`、
  `requireActiveScope:24`、`requireCatalogBrand:351`、`isEnabled:89`。
  §2.2 允许**合并查询**，**不允许减少校验点或跳过任一分支**。
- **幂等**：`replay:1618` + `saveReceipt:1619`（各 423 次）。回执读写是重放安全的基础。
- **CAS**：`UPDATE ... WHERE version=?` 形态的语句。版本冲突检测不得改为无条件写。
- **审计**：审计与历史写入。
- **锁**：`SELECT ... FOR UPDATE` 形态。
- **typed failure**：任何为产生具名 problem code 而做的前置查询。
- **必要 readback**：写后回读中**用于返回给调用方的**部分。
  §4.2 的 phase 缺口修好之前，**无法区分哪些回读是必要的**，
  所以在那之前**不得对任何 readback 做削减**。

另有两项属"当前无需优化"：**连接池**（0.2ms，健康）与 **`SET_AUTO_COMMIT`**（0.0ms，本地）。

---

## 6. 我这份分析的置信边界

- §0 全部数字为我对 29,714 行 JSONL 的独立复算，与报告自述交叉核对一致
  （`saveOperationsCatalogItem` 50.1 次/1417ms、`getOperationsCatalogDictionary` 49 次均已复现）；
- catalog owner 我算得 23,526 次 / 642,506ms / 629 请求，
  与所述 25,449 次 / 689,530ms **有差异**，差额约等于同一次 seed 中
  asset(1,428) + fulfillment-production(344) + inventory(46) 等非 catalog-owner 请求，
  **请 Codex 确认口径是"catalog owner"还是"catalog seed 全过程"**；
- §1.4 的 N+1 候选我标 `UNVERIFIED` 并给出了证伪条件，未按 N+1 处理；
- §2.3 的事务合并与 §3 的拓扑对照**都需要新的受控运行才能定论**，本轮不下结论；
- 我**未**逐个打开 155 个未执行接口的实现，本文不覆盖它们。
