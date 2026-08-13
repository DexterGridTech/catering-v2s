# backend-acceptance DESIGN 定向复核（第二轮，Claude）

- 结论：**GO（M=0 / S=1 / N=2）**
- 首轮 `M=2 / S=2 / N=2` 的四条阻断/重要 finding **全部真实闭合**，逐条经本会话独立复算，非采信整改自述。
- 会话出处：fresh v2s-rooted 会话，本文件为唯一写入。未运行 Testcontainers / DEV / L2 / reset / seed / 浏览器 / UAT / 部署 / 手工 SQL。
- 唯一 S 不阻断实施，属 catalog 信息完整性，可在 BA-U02 冻结 catalog 时一并补入。

---

## 1. 我方首轮两处错误，Codex 反驳成立，予以接受

按亲验纪律先记自己的账：

1. **「每一个模块的盲区都 ≥ 66.7%」——错。** 独立复算：`modules/audit-read` 生产源 2、锚定 2、**盲区 0**。我在首轮 review 的汇总句中作了全称断言，而我自己算出的分区数据里 audit-read 恰为 0.0%。Codex 的 `PARTIALLY_CONFIRMED` 判定正确。
2. **「会在 77.6% 的**改动**上触发」——措辞错。** 77.58% 是**静态文件占比**，不是观测到的提交频率。我把文件份额说成了变更频率。Codex 的更正（「它不是观察到的提交频率，但足以否定 subset 为默认容量模型」）**在事实与结论上都比我准确**，采纳其表述。

571 / 128 / 443 / 77.58% 本身仍成立（本轮再次复算相符），M-02 的**结论**因此不变，但**论证依据**按 Codex 版本修订。

---

## 2. 四条 finding 的闭合复核

### M-01 · 计量 sink 自证 —— **闭合（强于我提出的最小修复）**

`contracts/policy/backend-acceptance-execution-contract.json` 的 `measurementCalibration`：

| 核验点 | 复算结果 |
|---|---|
| fixture 定义不可变且期望值由其推导 | ✓ `derivationRule` 明写「computed from this immutable fixture definition before execution and **never copied from measured output**」 |
| 期望向量 | ✓ `LOGICAL_SQL = insertCount + selectCount` = 5、`QUERY` = 3、`UPDATE` = 2、`CONNECTION` = 1、`TRANSACTION` = 1、`BATCH` = 0，与声明一致 |
| 前置门 | ✓ `requiredBefore = [FIRST_BASELINE_WRITE, BASELINE_DECREASE_ACCEPTANCE, EACH_DYNAMIC_OPERATION_BATCH]` |
| 「下降直接接受」已被限定 | ✓ 详设 `:164-165`「任何首次写入或下降接受都以前置的同 run known-cost 计量校准 PASS 为必要条件」「校准不通过时**禁止创建、降低或消费 baseline**」 |
| 红变异 | ✓ `redMutations` = no-op sink、逐个摘 metric、错绑 correlation；矩阵新增 `measurement integrity` 族，稳定码 `MEASUREMENT_SINK_INTEGRITY_FAILED:<metric>` |
| 失败细节 | ✓ `failureDetailRequired = [metric, expected, actual, correlationId]` |

**两处超出我最小修复的正确设计**，予以肯定：

- `includedInOperationDenominator: false` 且 `semanticOperation: false`——校准场景**不污染 operation 分母**，避免它变成第 197 个"接口"；
- **`EACH_DYNAMIC_OPERATION_BATCH`**——我只要求门住首次写入与下降接受，Codex 额外门住了**每一批动态执行**。这才真正堵死"校准通过后 sink 中途退化"的窗口。
- 生产可达性：详设 `:168` 校准 route 由 **test-only Spring configuration** 暴露，`BackendAcceptanceMeasurementCalibrationConfiguration` 落在 test 源码树，生产上下文不注册。**无生产暴露面。**

我原提出的反例（把 sink 改成 CONNECTION 恒返回 0）现在会被 `measurement integrity` 族以精确 metric 名红掉。**闭合。**

### M-02 · full mode 容量模型 —— **闭合**

`fullModeCapacity`：

| 核验点 | 复算结果 |
|---|---|
| ALL 定为正常路径 | ✓ `planningAssumption: ALL_IS_COMMON_BECAUSE_ENTRY_ANCHOR_COVERAGE_IS_128_OF_571_CHECKED_IN_JAVA_FILES` |
| 时间目标挂在 **full mode** 而非 subset | ✓ `perEditFullModeEngineeringTargetMillis: 600000` |
| lane 数由公式反推而非拍脑袋 | ✓ `minimumLaneFormula = ceil(sum(latestSchedulingWeightMillisByOperation) / perEditFullModeEngineeringTargetMillis)` |
| 新 operation 权重 | ✓ 取当前已接受权重最大值（保守方向正确） |
| 无历史调度数据时 | ✓ 取 resource manifest 允许的最大隔离 lane 数 |
| 不得以时间换覆盖 | ✓ `coverageNeverReducedForTime: true`；资源不足在**初始化前** fail closed，禁止缩小 operation、四维或 cleanup |
| 红控制 | ✓ 矩阵新增 `full-mode capacity` 族 |

这正是我要求的"反推方向"：**由目标时间推 lane 数，而不是由 lane 数推目标时间**。**闭合。**

### S-01 · owner → provider 派生 —— **闭合**

`ownerModuleMappings` 11 条，与 inventory 中实际 owner 取值**双向覆盖，缺失 0**。四个歧义 owner 全部落定：

| owner | moduleRoot | providerRoot |
|---|---|---|
| `platform-iam` | `platform-admin-iam` | `modules/platform-admin-iam/src/testFixtures/java/…/acceptance` |
| `contract` | `store-contract` | `modules/store-contract/src/testFixtures/java/…/acceptance` |
| `platform-workspace` | `workspace` | `modules/workspace/src/testFixtures/java/…/acceptance` |
| `platform-asset` | `asset` | `modules/asset/src/testFixtures/java/…/acceptance` |

**关键复核 —— provider 未退化为集中放置**：11 条 `providerRoot` **无一**落在 `app/acceptance/`，全部在 `modules/<owner>/src/testFixtures/`。这正是 Dexter「每个包的测试天然包含」的结构保证。我首轮 N-01 提示的"物化时悄悄集中"风险已被堵住。

**我额外验了一个未被声明、但会导致方案不成立的前提**：`java-test-fixtures` 插件当前 **0/10 模块应用、0 个 `src/testFixtures` 目录存在**。若未同步启用，`providerRoot` 下的文件不会被编译。复核 manifest：**已声明 11 条 `build.gradle.kts` 改动面**（10 个模块 + app 级），app 级 target 明写「consume the ten explicit owner module test-fixture projects」。**前提已覆盖，闭合。**

错误码 `BACKEND_ACCEPTANCE_OWNER_MODULE_UNMAPPED` 与 `BACKEND_ACCEPTANCE_PROVIDER_PATH_COLLISION` 均已固化。首轮 N-01 随之自动闭合。

### S-02 · consumerFace disposition —— **闭合（强于我提出的最小修复）**

`consumerFaceDisposition` 三枚举值均绑定必需证据数组，且：

- `CONSUMER_UNAFFECTED` 的 `allowedCompatibilityClasses` **枚举封闭**（`OPTIONAL_FIELD_ADDED` / `NON_BREAKING_CONSTRAINT_WIDENED` / `ADDITIVE_ERROR_NOT_MATCHING_EXISTING_FLOW`）——不能自由声明"兼容"；
- `CONSUMER_BREAKING_ACKNOWLEDGED` 的 `allowedResolutionStatuses` 仅 `RESOLVED_IN_PACKAGE` 与 `DEXTER_APPROVED_EXTERNAL_BLOCKER`——**"稍后处理"在结构上不可表达**；
- `pendingForbidden: true`、`freeTextDispositionForbidden: true`、`exactSetRequired: true`。

我首轮的反例（`{consumerFace, note: "前端稍后处理"}`）现已无法构造。**闭合。**

---

## 3. 历史 catalog 复核（6 + 15 + 8 = 29）

| 核验点 | 复算结果 |
|---|---|
| 条数 | ✓ 6 / 15 / 8 |
| 引用的受管报告 | ✓ 27 条路径**全部存在**，缺失 0 |
| 声明 SHA-256 | ✓ **28 对逐个复算，相符 28 / 不符 0 / 缺失 0** |
| 性能族 disposition | ✓ `allowed: ["REGRESSION_ADDED"]` 唯一取值，7 项必需证据含 `knownCostCalibrationReceipt`（与 M-01 联动）、`freshBeforeFailureReceipt` / `freshAfterPassReceipt`（红证）、`rootCauseRef` |
| HTTP 族 | ✓ 3 个 allowed 值；公共证据含 `operationId` + contract/business/cleanup 三 receipt + `rootCauseRef`；`REGRESSION_ADDED` 另需 `preByteHash`/`postByteHash`/`sameFixtureDigest` |
| non-route 族 | ✓ 2 个 allowed 值；必需 `affectedRouteSet` 与 `freshRouteProofRefs`；并有规则禁止用 non-route 分类压制 route scenario |
| U02→U05→U06 接线 | ✓ U02 冻结（`:250`）；U05 逐 findingId 双向 exact set（`:499`）；U06 退役前要求三组 exact set 闭合（`:514`） |
| 自由文本出口 | ✓ 未检出；矩阵第 25 族 `historical seed replay` 专拒删行、把性能回归标"已覆盖"、仅写 note |
| 矩阵族数 | ✓ 精确 **25** 族，无残留"20 类"表述 |

**行内容抽查结论：可行动。** 性能行带完整前后指标向量与调用次数；HTTP 行带具体 fixture 名与机器信号 token（如 `asset-asset-boreal_HTTP_500_UNCLASSIFIED`）；non-route 行带 signal token。配合可复算的报告哈希，一个无聊天背景的 agent 能够：findingId → 打开经哈希验证的报告 → 检索 signal token → 定位失败 → 从 owning source 做根因。**Dexter「不得依赖聊天」的要求在结构上成立。**

---

## 4. Findings

### S-01｜6 条性能回归的已知来因未入 catalog，两种相反修复都能过门

- **严重度**：S　**状态**：CONFIRMED　**是否阻断**：否
- **owning source**：`doc/evidence/platform/2026-08-13-v2s-backend-acceptance-historical-seed-findings.json`，`requiredPerformanceRegressions[].regression`
- **仓内事实（本会话复算）**：6 条呈现**同一签名**——

| findingId | operationId | CONNECTION | TRANSACTION | QUERY |
|---|---|---|---|---|
| BA-HIST-PERF-001 | `getOperationsCatalogWorkbenchContext` | 6→9 | **8→4** | 15→15 |
| BA-HIST-PERF-002 | `getOperationsCatalogNavigation` | 12→24 | **16→8** | 36→36 |
| BA-HIST-PERF-003 | `getOperationsCatalogDictionary` | 12→16 | **16→8** | 28→28 |
| BA-HIST-PERF-004 | `getOperationsCatalogItem` | 561→1309 | **748→374** | 1870→1870 |
| BA-HIST-PERF-005 | `getOperationsCatalogItems` | 6→12 | **8→4** | 18→18 |
| BA-HIST-PERF-006 | `getOperationsInventoryTargets` | 6→12 | **8→4** | 18→18 |

  **6 条的 TRANSACTION 全部精确减半，QUERY 全部完全不变。** 这是摘除只读事务后、原本 join 同一事务的读各自借连接的教科书特征。
- **问题**：`regression` 字段一律只写「CONNECTION increased … while QUERY and UPDATE were unchanged」，**六条无一提及 TRANSACTION 减半**；全库检索「读事务 / readOnly / precedingChange / fixDirection」命中 **0**；`DBCR` 在详设中出现 3 次，均为「不恢复 DBCR package」，**未记录这批回归源自一次刻意的事务边界变更**。
- **反例（两种相反修复都过门）**：
  - 修复 A：恢复只读事务 → CONNECTION 回到 6、TRANSACTION 回到 8 → regression case PASS、四维 PASS、全绿；
  - 修复 B：保持无事务、改为连接复用或 set-based 合并 → CONNECTION 回到 6 或更低 → 同样全绿。
  两者**业务与架构含义相反**（A 撤销了 DBCR 的意图，B 保留），而 `REGRESSION_ADDED` + `rootCauseRef` + fresh 四维证据**无法区分**。catalog 的既定用途正是让 agent 不必查聊天，但在这 6 条上，它给了症状却隐去了决定修复方向的那一个事实。
- **根因**：`regression` 字段是**症状描述**，而这 6 条真正需要的是**来因与修复方向约束**。
- **最小修复（便宜，一个字段）**：为 `requiredPerformanceRegressions` 增加 `knownPrecedingChange`（记录该批回归源自只读事务边界移除，引用 DBCR 需求文档与终止状态）与 `fixDirectionConstraint`（明确"恢复只读事务"是否属可接受修复，或必须先由 Dexter 裁定）。同时把 TRANSACTION 的变化写进 `regression` 描述——数据已在 `before`/`after` 里，只是描述未提。
- **裁决状态**：**已裁定。** Dexter 于 2026-08-13 授权 Claude 代为决策，指令为「我只希望我的后台代码是最健康效率最高的」。裁定内容见 §4.1。

### 4.1｜6 条性能回归的修复方向裁定（已代 Dexter 裁定）

**先看被两种候选修复共同忽略的数据**（本会话从 catalog 的 `calls` / `before` / `after` 逐条换算）：

| operation | QUERY/次 | CONNECTION/次 前→后 | TRANSACTION/次 前→后 |
|---|---|---|---|
| `getOperationsCatalogWorkbenchContext` | 7.5 | 3.0 → 4.5 | 4.0 → 2.0 |
| `getOperationsCatalogNavigation` | 9.0 | 3.0 → 6.0 | 4.0 → 2.0 |
| `getOperationsCatalogDictionary` | 7.0 | 3.0 → 4.0 | 4.0 → 2.0 |
| `getOperationsCatalogItem` | 10.0 | 3.0 → 7.0 | 4.0 → 2.0 |
| `getOperationsCatalogItems` | 9.0 | 3.0 → 6.0 | 4.0 → 2.0 |
| `getOperationsInventoryTargets` | 9.0 | 3.0 → 6.0 | 4.0 → 2.0 |

三条推论：

1. **DBCR-U01 的前提被数据否定。** 该改动假设只读事务是纯开销，实测结果是 **QUERY 一条没降、CONNECTION 反升**。因此「摘掉只读事务能降低数据库成本」这一判断，在这 6 条上**不成立**。
2. **但恢复事务也不是健康态。** DBCR **之前**每次读就已经是 **3 个连接 + 4 个事务**。一次读要开 4 个事务，本身就不是「一个只读事务包住 N 次查询」的正常形态。恢复到 3/4 只是回到另一个不健康的点。
3. **真正的问题两种候选都没碰**：**读一个 catalog item 要发 10 条 SQL**。事务包不包，只决定这 10 条 SQL 花 3 个连接还是 7 个连接，**一条 SQL 都不会少**。6 条 operation 的 3.0 / 4.0 高度整齐，且它们全部经由 `CatalogInventoryCoordinator` 的只读方法——说明这是**共享读管线的固定开销**，不是各自的业务需要；修一次管线，6 条同时受益。

**裁定如下：**

**（一）允许恢复只读事务，但它不构成收口。** 恢复事务在机制上正当——一次读发 N 条 SQL 时，由一个事务持有一个连接优于每条 SQL 各借一个连接。但**理由只能是连接经济性，不能是一致性**：PostgreSQL 默认 `READ COMMITTED` 下，普通 `@Transactional(readOnly = true)` **不提供**多查询稳定快照（该结论见 DB call reduction 需求 §2.3）。以「保证读一致性」为由恢复事务属误述，必须拒绝。

**（二）收口判据是三项同时不劣化，禁止只看 CONNECTION。** 这 6 条的 accepted baseline 必须同时钉住 **QUERY、CONNECTION、TRANSACTION**，三项均 **≤ DBCR 前基线**。任何仅凭 CONNECTION 回落即宣告闭合的 disposition 必须红。这一条直接封死本 finding 指出的"两种相反修复都能过门"。

**（三）`QUERY/次` 必须单独 disposition，不得沉默通过。** 每条 operation 须二选一：`QUERY_REDUCED_TO_<n>`（附合并方式与 owning source），或 `QUERY_ALREADY_MINIMAL`（附逐条查询的业务必要性说明）。**7–10 条 SQL 读一个条目，默认应视为待证明项而非既定事实。**

**（四）方向目标（非硬门）：单次读收敛为 1 事务 / 1 连接 / 最小 QUERY。** 优先级是**先降 QUERY，再谈包装**。若共享读管线因真实约束无法达到 1/1，须记录该约束；**记录了就接受，不追加返工**——这是方向不是硬指标，避免用评审制造过度设计。

**（五）范围限定。** 本裁定只适用于 catalog 的这 6 条 PERF finding，**不重启 DBCR package**（其状态维持 `TERMINATED_BY_DEXTER_SCOPE_REFRAME`），也不扩展到其余 15 族 HTTP 与 8 族 non-route finding。

**（六）落点。** 上述（一）至（三）须写入 `historical-seed-findings.json` 的 `requiredPerformanceRegressions` disposition contract 作为**机器判据**，而非仅写进散文；（四）以 `fixDirectionNote` 记录即可。同时把 **TRANSACTION 的变化补进 `regression` 描述**——数据已在 `before`/`after` 中，只是描述未提，这正是本 finding 的成因。

### N-01｜我方首轮两处论证错误（自我更正，已在 §1 记录）

`audit-read` 盲区为 0，全称断言不成立；77.58% 是静态文件占比而非提交频率。Codex 的 `PARTIALLY_CONFIRMED` 正确。我的首轮 review 文件与标准文档需据此更正措辞；**M-02 的结论与整改方向不受影响**。

### N-02｜8 条 non-route finding 的 `affectedRouteSet` 无起点，推导方法未要求留痕

- **严重度**：N　**是否阻断**：否
- `nonRouteSeedFailureFamilies` 每行只有 `findingId` / `signal` / `problem` / `source`，**无 operationId**（对 non-route 而言合理）；但其 disposition 强制要求 `affectedRouteSet`。
- 例如 `BA-HIST-SEED-007 canonical BOM target 缺失`，agent 需自行判定哪些 route 受影响。这是**必要的分析工作**，不是缺陷；但 disposition 只要求**结果**（route 集合），未要求**推导方法**留痕，因此无法机械区分"认真推导得出的集合"与"填了个看起来合理的集合"。
- **最小修复**：`requiredEvidence` 增加 `affectedRouteDerivationMethod`（如 owner API 反查、fixture 消费方反查），并要求引用具体 owning source。
- **是否需 Dexter 裁决**：否。

---

## 5. 方案合理性（仍以 Dexter 初衷为尺）

| 初衷 | 本轮判定 |
|---|---|
| 只剩一类、功能性能不分家 | 维持达成 |
| 无编号模型 | 维持达成；校准场景明确排除出 operation 分母，未制造"第 197 条" |
| 每个包天然包含 | **本轮达成**：provider 全部落在 `modules/<owner>/src/testFixtures/`，且 build 启用已入改动面 |
| 又快又准 | **本轮达成**：时间目标改挂 full mode，lane 数由公式反推，覆盖面绝不因时间缩减 |
| 不依赖聊天 | **基本达成**：29 条 hash-bound catalog，27 报告齐备、28 哈希全对；**唯 6 条 PERF 的修复方向缺约束（S-01）** |
| 便宜 | 维持达成：无时延平台、无 test seed，复用既有 lane 基建与计量；本轮新增仅为一条校准场景、一张映射表、一份 catalog |

**UI 与交互**：`NOT_APPLICABLE`，理由同首轮（后台工程能力，不触及任何用户可见界面或 Journey）。

---

## 6. 授权边界

- 本结论为**静态 implementation-facing DESIGN review**（第二轮定向复核）。
- **GO 仅表示设计具备实施条件**，不代表任何动态、业务、performance 或 cleanup 成功；`backend-acceptance` 尚未实现，公共入口仍不存在。
- 本轮未运行也未授权 Testcontainers、DEV、L2、reset、seed、浏览器、UAT、部署、手工 SQL 或 Git。
- S-01 不阻断 GO，但其中的**一句产品裁决**（是否允许以恢复只读事务修复那 6 条）须在 BA-U05 触及第一条 PERF finding **之前**取得；N-02 可在 BA-U02 冻结 catalog 时一并补入。
- DESIGN GO 后按 Dexter 已记录条件授权激活**单一** implementation package，连续完成 BA-U01→U06 与受管 `backend-acceptance` 动态验收，再交唯一一次外部 IMPLEMENTATION review。
