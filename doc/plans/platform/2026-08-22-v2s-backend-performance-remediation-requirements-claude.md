# 后台接口性能整改 · 需求分析

- 日期:2026-08-22 · 作者:Claude · 状态:`REQUIREMENTS_DRAFT_FOR_DEXTER`
- 性质:需求分析。**不授权**实施、契约/代码修改、测试、DEV、reset、seed、browser L2、UAT、部署或数据操作。
- 全部数字为本会话从原始证据重新提取,非转述历史文档:
  seed `complete-seed-62653d1f`(66 接口)· acceptance run `r5-tc-1787321536079-56325` 的
  `http-request-events.jsonl`(129 operation、逐请求 `databaseOperationCount` /
  `connectionBorrowCount` / `sectionCounts`)· 三份 generated route registry(238 operation 全集)。

---

## 1 · 问题的真正结构:两个独立乘数

### 1.1 决定性对照 —— 同一份代码,两种环境,每次 DB 操作成本差 1000 倍

seed 报告第三个数值列的表头原文是「**DB ms(均/低/高)**」——它是**数据库耗时**,不是服务端总耗时。
用同一口径(DB 耗时 ÷ DB 操作数)对照 acceptance 的 `databaseDurationMillis`:

| 接口 | 环境 | HTTP | **DB 耗时** | DB 次数 | **每次 DB 成本** | DB 占请求比 |
|---|---|---:|---:|---:|---:|---:|
| `saveOperationsCatalogItem` | acceptance(同侧) | 50.8ms | 4.1ms | 102.2 | **0.040ms** | **8%** |
| | seed(隧道) | 5608ms | 5473ms | 128.2 | **42.7ms** | **98%** |
| `getOperationsCatalogItem` | acceptance(同侧) | 18.9ms | 2.1ms | 59.3 | **0.035ms** | **11%** |
| | seed(隧道) | 1476ms | 1436ms | 62.5 | **23.0ms** | **97%** |

⇒ **每次数据库操作的成本被放大 663–1074 倍**;端到端放大 78–110 倍。
隧道环境下 **97–98% 的请求时间是在等数据库往返**;同侧环境下这个比例只有 8–11%。

拓扑证据:`scripts/dev/r5-dev-runner.mjs` 第 186 行
`ssh -N -L 25433:127.0.0.1:5432 $V2S_DEV_REMOTE_HOST` —— 应用在本机、PostgreSQL 在远端,
每条 SQL、每次借连接、每次 BEGIN/COMMIT 各走一次 SSH 往返。

⇒ **架构不慢,代码也没慢到那个量级。** 同侧时最慢的写接口 50.8ms,其中数据库只占 4.1ms,
其余 46.7ms 是应用自身计算 —— 这说明**应用层代码是健康的**。

### 1.2 但这**不**等于代码没问题 —— 它等于代码问题今天被隐藏了

- acceptance 的 0.5ms/次让 **711 次 DB 操作的 `batchTransitionOperationsCatalogItemStatus`
  只花 330ms**,于是它从未被当成缺陷;
- 同一个接口在隧道下 = 711 × 42.7ms ≈ **30 秒**;
- 而未来任何真实部署(应用与 DB 之间有网络)都会把 0.5ms 放大到 0.5–2ms 甚至更多,
  711 次仍然是 0.4–1.4 秒的单请求。

⇒ 结论:**必须两件事都做,而且顺序不能反。**
先修拓扑(L1)让 DEV 说真话;同时立刻加门(L2)否则修好的计数会像 phase3/4 一样被吃回去;
然后才在真实数字上做 L3/L4/L5 的存量清理。

### 1.3 更正一处我此前的判断

我在 08-22 的根因分析里估计"每请求授权地板 25–30 次往返"。
**这个估计过高,现予更正**:acceptance 实测最简单的请求(`getOperationsWorkspaceLoginEntry`、
`acceptPublicInvitation`)只有 **4 次 DB 操作、1 次借连接**。
真正的地板是 4;25–43 是**业务命令自身**的量级,不是公共开销。
这个更正让 L4 的目标从"砍地板"改为"砍每接口自己的多余往返",方向不同。

---

## 2 · 全量分母(238 个 operation,穷举分类)

分母来源:`edge-route-face-registry`(181)+ `platform-route-face-registry`(3)+
`catalog-inventory-edge-route-registry`(57),去重 **238**。
其中 **144** 个有实测 DB 计数,**94** 个无任何证据。
以下分类数字是 **2026-08-21 evidence 的基线快照**；实施期以 CP-05 对当前树重新测量并重分类的结果为准。

| 类 | 判据 | 数量 | 隧道下量级 | 同侧量级 |
|---|---|---:|---|---|
| **P0** | 无任何 DB 计数证据 | **94** | 未知 | 未知 |
| **P1** | DB/次 ≥ 100 | **4** | 4.4s – 31s | 51ms – 330ms |
| **P2** | GET 且每请求借连接 > 1.5 次 | **57** | 0.35s – 2.1s | 3ms – 19ms |
| **P3** | DB/次 ≥ 25(非 P1/P2) | **36** | 0.9s – 1.7s | 12ms – 25ms |
| **P4** | 未分类语句占比 > 50% 且 DB ≥ 10 | **9** | 0.35s – 0.9s | 5ms – 12ms |
| **P5** | 其余(DB < 10 或已达标) | **38** | < 0.35s | < 5ms |

⚠️ **分类互斥且穷尽:94+4+57+36+9+38 = 238。**

---

## 3 · L1 · DEV 拓扑:Java 服务移到远端,前端留本机

### 3.1 目标形态(Dexter 已裁定)

```text
现状: [本机: 前端 + Java 服务] --ssh -L 25433--> [远端: PostgreSQL + MinIO]
                                    ↑ 每条 SQL 一次隧道往返 ≈ 42.7ms

目标: [本机: 前端 dev server]  --ssh -L <HTTP端口>--> [远端: Java 服务 + PostgreSQL + MinIO]
                                    ↑ 每个 HTTP 请求一次隧道往返,与语句数无关
```

### 3.2 需求条目

| # | 需求 | 验收标准(可证伪) |
|---|---|---|
| L1-01 | Java 服务在远端主机启动,与 PostgreSQL、MinIO 同侧 | 受管 manifest 记录服务 PID 属于远端主机;应用侧 JDBC URL 指向远端本地地址而非 `127.0.0.1:25433` 隧道端口 |
| L1-02 | 本机只保留前端 dev server;隧道**不再转发 PostgreSQL 端口**,继续转发远端 Java HTTP 与资产端口 | 隧道进程命令行不再出现 PostgreSQL forward；源码亲验确认 asset owner 返回 MinIO public URL、前端 `<Image src>` 直接访问该 URL，当前不是 presigned/网关代理下载，因此资产端口必须保留；本机 Vite 的 `/api` proxy 指向 Java HTTP tunnel |
| L1-03 | 前端热更新与调试能力不下降 | 本机改前端源码后浏览器可见变更;不需要重启远端服务 |
| L1-06 | 会话 Cookie 与同源策略不受影响 | **既有设计已降低此风险**:`apps/frontend/operations-admin/vite.config.ts` 第 15 行已有 `proxy: {'/api': {target: gatewayProxyTarget, changeOrigin: false}}`,浏览器始终只见 `localhost:5175` 同源。L1 只需把 `gatewayProxyTarget` 指向隧道后的 HTTP 端口。验收:登录后 `SameSite=Strict` 的会话 Cookie 仍能随后续请求发出(`EdgeSessionCookieWriter` 第 16 行) |
| L1-04 | 受管生命周期(start/stop/reset/seed)全部适配远端 | `scripts/dev/start` 与 `stop` 的 manifest/readiness/PID/start-token 证据仍完整;stop 后远端无残留进程 |
| L1-05 | **拓扑改造前后同一 workload 的对比数字必须留证** | 同一份 seed 计划改造前后各跑一次,报告每接口 avg/p95 与 DB 计数;`saveOperationsCatalogItem` 均值下降 ≥ 90% |

⚠️ L1-05 是历史教训的直接产物:08-10 的 final closure **没有任何前后对比数字**,
所以无法证明收益。这次不留对比数字即视为未完成。

---

## 4 · L2 · 把门加回来

### 4.1 为什么必须加(证据)

现行裁定是「另打印**不设门**的 DB 调用数」。实测后果:

| 事实 | 数字 |
|---|---|
| 08-08 基线"正常写 26–44 次" | 今天简单写 29–43 次 —— **未下降** |
| 曾裁定"每次读 7–10 条 SQL 才是真问题" | `getOperationsCatalogItem` 今天 **59.3** |
| `listOperationsCatalogUnits` 两次 seed 之间 | 13 → **26.75**(单位/属性/选项三批各自加回) |

### 4.2 需求条目

| # | 需求 | 验收标准 |
|---|---|---|
| L2-01 | 每个 operation 在契约生成源声明 `databaseOperationBudget` | 生成物中 238 个 operation 全部有预算值,无遗漏、无 `null` |
| L2-02 | acceptance 断言实测 DB 计数 ≤ 预算 | 任一 operation 超预算 ⇒ 场景 FAIL 且给出 operationId、预算、实测 |
| L2-03 | 借连接数单独设门:GET ≤ 1,写命令 ≤ 事务数 | 超出即 FAIL(P2 类整改的回归保护) |
| L2-04 | 未分类 SQL 占比设门 | `UNCLASSIFIED` SQL 占比 > 5% 即 FAIL —— 见 §4.3；分母只含 SQL execution，不用 CONNECTION/TRANSACTION 稀释 |
| L2-05 | 预算只能调低不能调高,调高需 Dexter 明确裁定并记录理由 | 预算文件的调高变更在 review 中可被逐条指出 |

### 4.3 前置:45% 的语句"未分类",以及最好的解法(Dexter 2026-08-22 裁定按最优方案)

**事实**:`sectionCounts.UNCLASSIFIED` 占全部 DB 操作 **45%**。
`getOperationsCatalogItem` 的 58 次里 26.7 次未分类;`saveOperationsCatalogItem` 的 102 次里 39 次未分类。

**机制现状**(已亲验):
`apps/backend/catering-business-server/modules/foundation/src/main/java/.../DatabaseOperationTracker.java`
第 100 行 `pushSection(Section)` 是**手工作用域**;第 147 行 `UNCLASSIFIED` 是**默认值** ——
也就是说,任何没有被显式 `pushSection` 包住的语句都自动落进未分类。

**三个候选解法,取最优:**

| 方案 | 做法 | 判断 |
|---|---|---|
| A · 逐语句补 `pushSection` | 在每个 JDBC 调用点加作用域 | **拒绝**。数百个调用点,新增代码必然漏,漏了又静默变成 UNCLASSIFIED —— 与今天同一个病 |
| B · 把 UNCLASSIFIED 设成门失败,其余不动 | 只加断言 | **拒绝**。会逼出方案 A 的手工劳动,治标 |
| **C · 在架构层边界打标(采用)** | section 词表与既有分层**本来就一一对应**:owner service 入口 = `OWNER_READ`/`OWNER_WRITE`,scope 解析器入口 = `SCOPE`,会话解析器入口 = `SESSION`,回执组件入口 = `IDEMPOTENCY`,审计组件入口 = `AUDIT`。**在每一层的入口 push 一次**,层内所有语句自动继承 | **采用** |

**决定性证据(本轮自审补测)**:仓内**当前已有 56 个 `pushSection` 调用点**
(`grep -rn pushSection apps/backend --include='*.java'`,排除 Tracker 自身),
**却仍有 45% 的语句未分类**。
⇒ 这不是"还没开始打标",而是**分散式打标已经试过并且失败了** —— 方案 A 被现实证伪,不是被我推理否决。

⚠️ 因此这不是"新建打标",而是**把 56 个分散打标点收敛为层入口打标**,工作量比新建更大,
需求必须照实说。我先前写的"打标点 ≤12"是**我自己的过度自信,现予撤回**:
按当前 owner 数量(catalog/inventory/iam/organization/contract/asset/extension/audit/workspace…)
乘读写两态,层入口本身就接近 20 个,12 这个数字没有依据。

**改用不依赖数量的判据** —— 要的是"防漂移"这个性质,不是某个计数:

| # | 需求 | 验收标准(可证伪) |
|---|---|---|
| L2-04a | section 在各架构层入口归属,层内语句自动继承;收敛现有 56 个分散打标点 | **性质判据**:在任一既有 owner 方法体内新增一条查询,**不修改任何打标代码**,该语句的 section 仍正确归类。做不到即未达成 |
| L2-04a-2 | 打标点数量不随语句数增长 | 打标点数量 ≤ **owner 数 × 2 + 6**(会话/范围/回执/审计/连接/事务);实施期先数出 owner 数并写进详设,不留空泛上限 |
| L2-04b | `UNCLASSIFIED` 占比设门 | 全量 operation 的 `UNCLASSIFIED` 占比 ≤ **5%**(方案 C 下 45%→接近 0,5% 是余量);超出即 FAIL |
| L2-04c | 分类结果驱动 P4 归类 | §5.4 的 9 个 P4 成员分类后重新归入 P2/P3/P5,不得停留在 P4 |

⚠️ L2-04 必须与 L2-01 同批完成:否则会出现"预算达标但一半语句没人知道是什么"的假绿。

## 5 · L3/L4/L5 · 存量问题穷举与整改

### 5.1 P1 · 单请求 DB ≥ 100(4 个)

> 本节表格中 `batchTransitionOperationsCatalogItemStatus` 的“整批原子”方案已被 Dexter 后续裁定
> 覆盖；其唯一有效目标见 §5.8 的“逐项尽力 + 明确报告”。其余三个成员仍按本表执行。

| operationId | DB/次 | 借连接 | 问题诊断 | 整改 | 验收标准 |
|---|---:|---:|---|---|---|
| `batchTransitionOperationsCatalogItemStatus` | **711** | 54 | 每个商品各开一个独立事务；这是逐项尽力语义的必要形态，浪费在循环内重复读 | **见 §5.8**：循环前批量预载，保留每项独立事务并返回严格逐项结果 | **见 §5.8**：DB/次 ≤ `15 + 5 × N`，不设固定连接/事务上限 |
| `executeOperationsBrandCatalogCopy` | 107 | 1 | 复制闭包逐对象查询(商品/SKU/引用/单位/BOM 各一轮) | 闭包按类型批量载入;复制写入批量化 | DB/次 ≤ **35**;复制结果逐字段与整改前一致 |
| `executeOperationsLocalCatalogCopy` | 103.8 | 1 | 同上 | 同上 | DB/次 ≤ **35** |
| `saveOperationsCatalogItem` | 102.2 | 1 | 45.2 OWNER_WRITE + 39 未分类 + 10 OWNER_READ;**保存后从零重查完整详情**(见 §5.5) | L5 回读复用 + 逐引用 `requireActive` 改批量 | DB/次 ≤ **45**;CAS/回执/审计/readback 字段全不变 |

### 5.2 P2 · GET 每请求借多次连接(57 个)—— **单一根因,单一修法**

**根因(实测)**:57 个 GET 每请求借 2–27.7 次连接;而全部 67 个写接口平均只借 3.35 次
(因为写在一个事务里持有一个连接)。**读路径没有连接作用域,每条查询各借一次。**

隧道下每次借连接是一次独立往返,`getOperationsCatalogItem` 的 27.7 次借连接 ≈ **0.6 秒纯连接开销**(按实测 23.0ms/次)。

**修法**:给只读任务加一个**只读连接作用域**(read-only 事务或单连接边界),
一个请求一个连接。⚠️ 这不违反 charter —— charter 禁的是**写事务内**跨 schema JOIN,
只读任务本来就允许受控跨 schema read 组件。

**验收标准(整类统一)**:
- 每个 GET 的 `connectionBorrowCount` = **1**;
- 该 57 个 GET 的 DB/次相对整改前下降 ≥ 30%(`getOperationsCatalogItem` 实测 27/58 = **46%** 是借连接,故 30% 是保守下限);
- 读结果 JSON 逐字段不变(用整改前 readback 做黄金样本对比)。

**整类可省**:GET 借连接总和 241 → 62,**每轮省 179 次往返**。

### 5.3 P3 · DB ≥ 25 但不属 P1/P2(36 个)

**问题诊断(共性)**:业务命令自身的查询数偏高,主要来源是逐引用校验循环
(`requireActive` 逐个 ref 一条查询)与逐节点 ensure。
**整改**:同一请求内对同类引用去重后一次 `IN` 批量校验;逐节点写入合并为批量。
**验收标准**:每个成员 DB/次 ≤ **20**;typed problem 的触发条件与错误定位精度不变
(批量校验必须仍能指出**是哪一个** ref 非法)。

### 5.4 P4 · 未分类语句占比 > 50%(9 个)

**问题诊断**:这些接口的语句大部分没有被 read-budget 分类,无法判断是必要成本还是重复往返。
**整改**:先分类(给语句打 section 标签),再按分类结果决定是否属于 P2/P3。
**验收标准**:`UNCLASSIFIED` SQL 占比 ≤ **5%**;分类后如落入 P2/P3 则按对应类整改。

### 5.5 L5 · 写命令的回读复用(专项)

`saveOperationsCatalogItem` 的 102 次里,写入约 45 次,**回读约 39 次未分类 + 10 次 OWNER_READ**。
保存事务里刚写完的行,直接投影成 readback,不再从零重查。
**验收标准**:save 的 DB/次 ≤ 45;readback JSON 与整改前**逐字段一致**(黄金样本);
CAS、回执、审计一条不少。

### 5.8 批量流转:逐项尽力 + 明确报告(Dexter 2026-08-22 裁定)

**事实**:`batchTransitionOperationsCatalogItemStatus` 实测 `TRANSACTION`=108 对 `UPDATE`=48,
即**每个商品一个独立事务**;`OWNER_READ`=539(约 48 项 ⇒ 每项 ~11 次读);`CONNECTION`=54。

**Dexter 裁定**:批量流转采用「**逐项尽力 + 明确报告每项结果**」,不改为整批原子。

⇒ 这条裁定**改变了整改目标**,必须说清楚:

- **每项一个事务是这个语义的必要形态,不是缺陷** —— 它正是"第 13 项失败不影响前 12 项"的实现方式。
  因此 `TRANSACTION`/`CONNECTION` 随批量大小线性增长是**正确的**,不许为了压计数把它改回单事务。
- **真正的浪费是读**:539 次 OWNER_READ 应当在进入逐项循环**之前**一次批量载入,
  循环内只做校验与写。这部分与裁定无冲突。
- **当前实现缺的那一半必须补上**:它已经是"逐项尽力",却**没有逐项结果报告** ——
  用户看不到哪几项成功、哪几项失败、失败原因是什么。这是本次必须交付的功能项。

| # | 需求 | 验收标准(可证伪) |
|---|---|---|
| B-01 | 目标行在进入逐项循环前一次批量载入 | `OWNER_READ` ≤ **10**(与批量大小无关);今为 539 |
| B-02 | 预算按批量大小表达,而非固定值 | DB/次 ≤ **15 + 5 × N**(N=批内项数)。N=48 时 ≤255,今为 711 |
| B-03 | **响应逐项报告结果** | readback 含每项 `{itemCode, outcome: SUCCEEDED\|FAILED, problemCode?, reason?}`;项数、身份与请求项**严格同序相等**，重复、缺失、额外或乱序均为契约缺陷；合法同状态 no-op 归 `SUCCEEDED` |
| B-04 | 部分失败是正常结果而非错误 | 20 项中第 13 项失败 ⇒ HTTP 仍为成功响应，body 中其余 19 项按真实执行结果为 `SUCCEEDED`，第 13 项为 `FAILED` 且带 `problemCode`/`reason`；**不返回整体 4xx/5xx 掩盖已成功项**。请求级前置条件失败仍返回整体 typed problem |
| B-05 | 前端按逐项结果展示 | 用户可见"成功 N 项、失败 M 项"及失败项清单与原因;不显示笼统"操作失败" |
| B-06 | **不新增审计语义** | 保持单条/批量现状；验收成功项的状态与版本、失败项无成功写入。幂等 receipt 只用于重放结果，不得冒充审计；不新增审计表、事件、查询面或用户可见审计承诺 |

⚠️ B-03/B-04/B-05 是**产品功能新增**(响应契约与 UI 都要改),不是纯性能整改。
它随本批交付是因为整改会改动这段事务边界,分开做会改两次。

**同族全集(本轮自审已扫)**:按名称扫描 238 个 operation,含 `batch`/`Bulk`/`Many`/`All` 的
**只有 1 个** —— 即 `batchTransitionOperationsCatalogItemStatus` 本身。
⚠️ 但**按名称扫描不是充分的分母**:接受数组入参的 operation 未必带 batch 字样。
实施期必须改用**按请求 schema 扫描**(request body 含数组且数组元素各自产生独立写入的 operation),
把该全集写进详设并逐个判定;名称扫描的结果只作为下限。

### 5.6 P0 · 94 个无任何证据的 operation

**这是最大的一类,也是最危险的一类** —— 它们不是"没问题",是"没人知道"。
**整改**:纳入 acceptance 或 seed workload,取得 DB 计数;取得后按上述判据归类并整改。
**验收标准**:238 个 operation 全部有 DB 计数证据,P0 归零。
⚠️ 若某 operation 确实无法在自动化 workload 中触发,必须显式登记原因,不得默认放行。

### 5.7 P5 · 38 个已达标

**整改**:无。**验收标准**:纳入 L2 预算门,防止回涨。

---

## 6 · 明确不做(附理由)

| 方向 | 结论 | 理由(实测) |
|---|---|---|
| 减少事务使用 | **不做** | 实测 `TRANSACTION` 段每请求仅 2 次;既有裁定已确认"事务包装只决定连接数"。砍事务只买风险不买速度 |
| 推翻 owner/schema 架构 | **不做** | 同侧实测最慢写接口 51ms;架构税完全可承受。为省它引入跨 owner 写耦合是把已买到的边界退货 |
| 写事务内跨 schema JOIN | **不做** | charter 明禁;且 §5.2 证明读侧作用域就能解决问题,不需要动写侧 |
| 缓存层 / 读写分离 | **本批不做** | 在往返数与拓扑修好前引入缓存,是用复杂度掩盖可直接消除的成本 |

---

## 7 · 执行顺序与依赖

```text
L1 拓扑改造(环境,零代码)  ──┐
                              ├─→ 在真实数字上做 L3/L4/L5 存量整改 ─→ 复跑对比,留前后数字
L2 门 + 语句分类(治理)    ──┘        (P0 补证据 → P1 → P2 整类 → P3 → P4)
```

L1 与 L2 可并行,都必须在 L3/L4/L5 之前完成:
- 没有 L1,整改效果被 42.7ms/次 淹没,无法判断哪一项真的有效;
- 没有 L2,整改成果会在后续功能批内被吃回去 —— **这是 phase3/4 已经发生过一次的事实**。

---

## 8 · 分母全员清单(穷举)

以下清单是 **2026-08-21 evidence 的基线快照**；实施期以 CP-05 对当前树重新测量并重分类的结果为准，不得按本节历史成员清单直接驱动整改。


<details><summary><b>P1 全员清单(4 个,点击展开)</b></summary>

| operationId | method | DB/次 | 借连接/次 | 未分类/次 |
|---|---|---:|---:|---:|
| `batchTransitionOperationsCatalogItemStatus` | POST | 711.0 | 54.0 | 5.0 |
| `executeOperationsBrandCatalogCopy` | POST | 107.0 | 1.0 | 99.0 |
| `executeOperationsLocalCatalogCopy` | POST | 103.8 | 1.0 | 73.4 |
| `saveOperationsCatalogItem` | PATCH | 102.2 | 1.0 | 39.0 |

</details>


<details><summary><b>P2 全员清单(57 个,点击展开)</b></summary>

| operationId | method | DB/次 | 借连接/次 | 未分类/次 |
|---|---|---:|---:|---:|
| `getOperationsCatalogItem` | GET | 59.3 | 27.7 | 26.7 |
| `getOperationsInventoryTarget` | GET | 44.0 | 20.0 | 19.0 |
| `getOperationsCatalogItems` | GET | 34.0 | 15.0 | 14.0 |
| `getOperationsInventoryTargetConsumptionReferences` | GET | 34.0 | 15.0 | 14.0 |
| `getOperationsOrganizationStores` | GET | 28.0 | 5.0 | 10.0 |
| `getOperationsWorkspaceStoreUser` | GET | 24.0 | 2.0 | 14.0 |
| `getOperationsOrganizationStore` | GET | 22.8 | 4.4 | 6.6 |
| `getOperationsWorkspaceGroupUser` | GET | 22.0 | 2.0 | 12.0 |
| `getOperationsBrandCatalogCopyCandidates` | GET | 19.0 | 7.0 | 6.0 |
| `getOperationsCatalogNavigation` | GET | 18.0 | 7.0 | 6.0 |
| `getOperationsInventoryTargets` | GET | 18.0 | 7.0 | 6.0 |
| `getOperationsWorkspaceGroupInvitations` | GET | 18.0 | 2.0 | 8.0 |
| `getOperationsContract` | GET | 17.0 | 3.0 | 5.0 |
| `getOperationsContracts` | GET | 17.0 | 3.0 | 5.0 |
| `getOperationsBusinessChannelDetail` | GET | 16.0 | 3.0 | 4.0 |
| `getPlatformOwnerBindingDetail` | GET | 16.0 | 4.0 | 3.0 |
| `getOperationsOwnerBindingDetail` | GET | 15.0 | 3.0 | 3.0 |
| `getPlatformProviderProfileBindings` | GET | 14.9 | 3.7 | 2.7 |
| `getOperationsBusinessChannelTemplates` | GET | 13.5 | 2.5 | 3.0 |
| `getOperationsProjectBusinessChannels` | GET | 13.5 | 2.5 | 3.0 |
| `getOperationsStoreBusinessChannelTemplateCandidates` | GET | 13.5 | 2.5 | 3.0 |
| `getOperationsOrganizationHeadCompany` | GET | 13.0 | 2.0 | 3.0 |
| `getPlatformExternalCollaborationTree` | GET | 13.0 | 3.0 | 3.0 |
| `getWorkspaceInvitations` | GET | 13.0 | 3.0 | 3.0 |
| `listOperationsCatalogOrderOptionDefinitions` | GET | 13.0 | 4.5 | 3.5 |
| `getWorkspaceAccounts` | GET | 12.7 | 3.0 | 2.7 |
| `listOperationsCatalogUnits` | GET | 12.7 | 3.0 | 2.7 |
| `getExtensionEntityCatalog` | GET | 12.0 | 3.0 | 2.0 |
| `getOperationsInventoryTargetLedger` | GET | 12.0 | 4.0 | 3.0 |
| `getOperationsLocalCatalogCopyCandidates` | GET | 12.0 | 4.0 | 3.0 |
| `getOperationsOrganizationHierarchy` | GET | 12.0 | 2.0 | 3.0 |
| `getPlatformExternalSystemDetail` | GET | 12.0 | 3.0 | 2.0 |
| `getPlatformOrganizationCandidates` | GET | 12.0 | 3.0 | 2.0 |
| `getPlatformOrganizationOverviewPage` | GET | 12.0 | 3.0 | 2.0 |
| `getPlatformProviderProfileDetail` | GET | 12.0 | 3.0 | 2.0 |
| `getWorkspaceInvitationCandidates` | GET | 12.0 | 3.0 | 2.0 |
| `getWorkspaceRoles` | GET | 12.0 | 3.0 | 2.0 |
| `getOperationsCatalogDictionary` | GET | 11.8 | 3.9 | 2.9 |
| `getExtensionDefinition` | GET | 11.5 | 3.0 | 1.5 |
| `getOperationsOrganizationBrands` | GET | 11.0 | 2.0 | 2.0 |
| `getOperationsOrganizationHeadCompanies` | GET | 11.0 | 2.0 | 2.0 |
| `getOperationsOrganizationTenants` | GET | 11.0 | 2.0 | 2.0 |
| `getOperationsStoreBusinessChannels` | GET | 11.0 | 2.0 | 2.0 |
| `getPublicInvitationView` | GET | 11.0 | 2.0 | 5.0 |
| `getOperationsContractExtensionDefinition` | GET | 10.0 | 2.0 | 1.0 |
| `getOperationsEntityAuditHistory` | GET | 10.0 | 2.0 | 1.0 |
| `getOperationsExternalProviderCandidates` | GET | 10.0 | 2.0 | 1.0 |
| `getOperationsOrganizationBusinessEntityExtensionDefinition` | GET | 10.0 | 2.0 | 1.0 |
| `getOperationsOrganizationHierarchyExtensionDefinition` | GET | 10.0 | 2.0 | 1.0 |
| `getOperationsOrganizationStoreExtensionDefinition` | GET | 10.0 | 2.0 | 1.0 |
| `getOperationsProductionTags` | GET | 10.0 | 3.0 | 2.0 |
| `getPlatformEntityAuditHistory` | GET | 10.0 | 2.0 | 3.0 |
| `getPlatformGroupWorkspaceDetail` | GET | 10.0 | 2.0 | 3.0 |
| `listOperationsCatalogAttributeDefinitions` | GET | 10.0 | 3.0 | 2.0 |
| `getPlatformAdminPage` | GET | 9.0 | 2.0 | 2.0 |
| `listPlatformGroupWorkspaces` | GET | 9.0 | 2.0 | 2.0 |
| `getOperationsCatalogShapeManifest` | GET | 8.0 | 2.0 | 1.0 |

</details>


<details><summary><b>P3 全员清单(36 个,点击展开)</b></summary>

| operationId | method | DB/次 | 借连接/次 | 未分类/次 |
|---|---|---:|---:|---:|
| `createOperationsOwnerBinding` | POST | 50.0 | 10.0 | 21.0 |
| `preflightOperationsBrandCatalogCopy` | POST | 48.0 | 1.0 | 40.0 |
| `updateOperationsOrganizationStore` | PATCH | 47.0 | 6.0 | 24.0 |
| `createOperationsContract` | POST | 38.0 | 5.0 | 19.0 |
| `createOperationsOrganizationStore` | POST | 38.0 | 4.0 | 21.0 |
| `updateOperationsContract` | PATCH | 36.7 | 5.0 | 17.7 |
| `invalidateOperationsContract` | POST | 34.0 | 5.0 | 15.0 |
| `transitionOperationsCatalogItemStatus` | POST | 34.0 | 1.0 | 3.0 |
| `transitionOperationsOrganizationStoreStatus` | POST | 34.0 | 5.0 | 15.0 |
| `preflightOperationsLocalCatalogCopy` | POST | 33.3 | 1.0 | 25.3 |
| `createOperationsOrganizationHeadCompany` | POST | 30.0 | 4.0 | 14.0 |
| `transitionPlatformGroupWorkspaceStatus` | POST | 30.0 | — | — |
| `transitionWorkspaceAccountStatus` | POST | 30.0 | — | — |
| `createOperationsOrganizationProject` | POST | 29.0 | 4.0 | 14.0 |
| `reissueWorkspaceInvitation` | POST | 29.0 | — | — |
| `selectOperationsWorkspaceSessionContext` | POST | 29.0 | — | — |
| `updateOperationsOrganizationBrand` | PATCH | 29.0 | 4.0 | 13.0 |
| `createOperationsOrganizationBrand` | POST | 28.0 | 4.0 | 12.0 |
| `createOperationsOrganizationTenant` | POST | 28.0 | 4.0 | 12.0 |
| `transitionOperationsOrganizationNodeStatus` | POST | 28.0 | 4.0 | 13.0 |
| `selectOperationsWorkspaceSessionDataNode` | POST | 27.2 | 2.0 | 12.0 |
| `updatePlatformGroupWorkspaceDisplay` | PATCH | 27.0 | 5.0 | 11.0 |
| `createOperationsOrganizationRegion` | POST | 26.0 | 4.0 | 11.0 |
| `transitionOperationsBusinessChannelStatus` | POST | 26.0 | 4.0 | 10.0 |
| `transitionOperationsBusinessChannelTemplateStatus` | POST | 25.8 | 4.0 | 9.8 |
| `createWorkspaceInvitation` | POST | 25.0 | — | — |
| `cancelWorkspaceInvitation` | POST | 24.0 | — | — |
| `requestWorkspaceCredentialReset` | POST | 20.0 | — | — |
| `revokePlatformWorkspaceAssignment` | POST | 19.0 | — | — |
| `transitionPlatformAdminStatus` | POST | 19.0 | — | — |
| `createWorkspaceRole` | POST | 18.0 | — | — |
| `createPlatformAdmin` | POST | 16.0 | — | — |
| `createPlatformGroupWorkspace` | POST | 16.0 | — | — |
| `getOperationsCatalogWorkbenchContext` | GET | 15.0 | — | — |
| `stagePlatformAsset` | POST | 13.0 | — | — |
| `getCurrentPlatformSession` | GET | 4.0 | — | — |

</details>


<details><summary><b>P4 全员清单(9 个,点击展开)</b></summary>

| operationId | method | DB/次 | 借连接/次 | 未分类/次 |
|---|---|---:|---:|---:|
| `operationsWorkspacePasswordLogin` | POST | 24.8 | 1.0 | 21.8 |
| `updateOperationsCatalogOrderOptionDefinition` | PATCH | 22.2 | 1.0 | 14.2 |
| `deleteOperationsCatalogOrderOptionDefinition` | DELETE | 21.0 | 1.0 | 13.0 |
| `updateOperationsCatalogUnit` | PATCH | 19.0 | 1.0 | 11.0 |
| `completePublicInvitation` | POST | 17.9 | 1.0 | 14.9 |
| `disableOperationsCatalogUnit` | POST | 17.0 | 1.0 | 9.0 |
| `createOperationsCatalogOrderOptionDefinition` | POST | 16.0 | 1.0 | 8.0 |
| `verifyPublicInvitationOtp` | POST | 13.0 | 1.0 | 10.0 |
| `platformPasswordLogin` | POST | 11.0 | 1.0 | 8.0 |

</details>


<details><summary><b>P5 全员清单(38 个,点击展开)</b></summary>

| operationId | method | DB/次 | 借连接/次 | 未分类/次 |
|---|---|---:|---:|---:|
| `stageOperationsCatalogAsset` | POST | 24.6 | 4.6 | 1.8 |
| `transitionOperationsOrganizationBrandStatus` | POST | 24.0 | 4.0 | 8.0 |
| `transitionOperationsOrganizationTenantStatus` | POST | 24.0 | 4.0 | 8.0 |
| `updateOperationsInventoryTargetConfiguration` | PATCH | 24.0 | 1.0 | 6.0 |
| `updatePlatformOwnerBinding` | PATCH | 24.0 | 4.0 | 11.0 |
| `createOperationsBusinessChannel` | POST | 23.6 | 4.5 | 9.2 |
| `deletePlatformOwnerBinding` | DELETE | 21.0 | 3.5 | 9.5 |
| `transitionOperationsOrganizationHeadCompanyStatus` | POST | 21.0 | 3.0 | 8.0 |
| `updateOperationsBusinessChannelTemplate` | PATCH | 21.0 | 4.0 | 5.0 |
| `createOperationsBusinessChannelTemplate` | POST | 20.2 | 3.0 | 7.2 |
| `removeOperationsOrganizationHeadCompanyBrandAuthorization` | DELETE | 20.0 | 3.0 | 8.0 |
| `transitionPlatformProviderProfileStatus` | POST | 20.0 | 3.0 | 10.0 |
| `updateOperationsOrganizationNode` | PATCH | 19.5 | 3.0 | 8.0 |
| `addOperationsOrganizationHeadCompanyBrandAuthorization` | POST | 19.0 | 3.0 | 7.0 |
| `createOperationsCatalogCategory` | POST | 19.0 | 1.0 | 6.0 |
| `createPlatformOwnerBinding` | POST | 18.9 | 3.6 | 7.0 |
| `countOperationsInventoryTarget` | POST | 18.0 | 1.0 | 3.0 |
| `replaceExtensionDefinition` | PUT | 17.6 | 3.0 | 7.6 |
| `updateOperationsCatalogDictionaryEntry` | PATCH | 17.0 | 1.0 | 3.0 |
| `transitionOperationsCatalogDictionaryEntryStatus` | POST | 16.7 | 1.0 | 3.0 |
| `deleteOperationsCatalogCategory` | DELETE | 16.0 | 1.0 | 3.0 |
| `createOperationsCatalogDictionaryEntry` | POST | 15.6 | 1.0 | 3.0 |
| `deleteOperationsCatalogAttributeDefinition` | DELETE | 15.0 | 1.0 | 7.0 |
| `initializeCommercialGroup` | POST | 15.0 | 2.0 | 7.0 |
| `releaseOperationsCatalogStagedAsset` | POST | 14.4 | 1.0 | 4.8 |
| `createOperationsProductionTag` | POST | 14.0 | 1.0 | 3.0 |
| `updateOperationsCatalogAttributeDefinition` | PATCH | 14.0 | 1.0 | 6.0 |
| `createOperationsCatalogItem` | POST | 13.9 | 1.0 | 3.0 |
| `createOperationsCatalogAttributeDefinition` | POST | 13.0 | 1.0 | 5.0 |
| `createOperationsCatalogUnit` | POST | 12.9 | 1.0 | 5.0 |
| `savePublicInvitationCredentials` | POST | 9.0 | 1.0 | 6.0 |
| `sendPublicInvitationOtp` | POST | 9.0 | 1.0 | 6.0 |
| `getOperationsWorkspaceSessionEntry` | GET | 7.5 | 1.0 | 4.5 |
| `acceptPublicInvitation` | POST | 6.0 | 1.0 | 3.0 |
| `getOperationsOrganizationCandidates` | GET | 5.0 | 1.0 | 0.5 |
| `getPublicInvitationCompletion` | GET | 5.0 | 1.0 | 2.0 |
| `getOperationsWorkspaceLoginEntry` | GET | 4.0 | 1.0 | 1.0 |
| `getPlatformExternalCapabilityDictionary` | GET | 4.0 | 1.0 | 0.0 |

</details>


<details><summary><b>P0 全员清单(94 个,点击展开)</b></summary>

| operationId | method | DB/次 | 借连接/次 | 未分类/次 |
|---|---|---:|---:|---:|
| `adjustOperationsInventoryTarget` | POST | — | — | — |
| `cancelOperationsWorkspaceGroupInvitation` | POST | — | — | — |
| `cancelOperationsWorkspaceHeadCompanyInvitation` | POST | — | — | — |
| `cancelOperationsWorkspaceProjectInvitation` | POST | — | — | — |
| `cancelOperationsWorkspaceRegionInvitation` | POST | — | — | — |
| `cancelOperationsWorkspaceStoreInvitation` | POST | — | — | — |
| `changeCurrentPlatformPassword` | POST | — | — | — |
| `changeCurrentWorkspacePassword` | POST | — | — | — |
| `completeOperationsPasswordRecovery` | POST | — | — | — |
| `completePlatformPasswordRecovery` | POST | — | — | — |
| `createOperationsWorkspaceGroupInvitation` | POST | — | — | — |
| `createOperationsWorkspaceHeadCompanyInvitation` | POST | — | — | — |
| `createOperationsWorkspaceProjectInvitation` | POST | — | — | — |
| `createOperationsWorkspaceRegionInvitation` | POST | — | — | — |
| `createOperationsWorkspaceStoreInvitation` | POST | — | — | — |
| `deleteOperationsCatalogUnit` | DELETE | — | — | — |
| `deleteOperationsOwnerBinding` | DELETE | — | — | — |
| `executeOperationsTemporaryCatalogItemPromotion` | POST | — | — | — |
| `getOperationsContractCandidates` | GET | — | — | — |
| `getOperationsExternalCapabilityDictionary` | GET | — | — | — |
| `getOperationsFixedStoreContracts` | GET | — | — | — |
| `getOperationsInventoryConsumptionTargetCandidates` | GET | — | — | — |
| `getOperationsInventoryTargetBusinessHistory` | GET | — | — | — |
| `getOperationsInventoryTargetChangeSummary` | GET | — | — | — |
| `getOperationsInventoryTargetDiagnostics` | GET | — | — | — |
| `getOperationsOrganizationBrand` | GET | — | — | — |
| `getOperationsOrganizationTenant` | GET | — | — | — |
| `getOperationsStoreProfile` | GET | — | — | — |
| `getOperationsWorkspaceGroupInvitationCandidates` | GET | — | — | — |
| `getOperationsWorkspaceGroupUserAccount` | GET | — | — | — |
| `getOperationsWorkspaceHeadCompanyInvitationCandidates` | GET | — | — | — |
| `getOperationsWorkspaceHeadCompanyInvitations` | GET | — | — | — |
| `getOperationsWorkspaceHeadCompanyUser` | GET | — | — | — |
| `getOperationsWorkspaceHeadCompanyUserAccount` | GET | — | — | — |
| `getOperationsWorkspaceProjectInvitationCandidates` | GET | — | — | — |
| `getOperationsWorkspaceProjectInvitations` | GET | — | — | — |
| `getOperationsWorkspaceProjectUser` | GET | — | — | — |
| `getOperationsWorkspaceProjectUserAccount` | GET | — | — | — |
| `getOperationsWorkspaceRegionInvitationCandidates` | GET | — | — | — |
| `getOperationsWorkspaceRegionInvitations` | GET | — | — | — |
| `getOperationsWorkspaceRegionUser` | GET | — | — | — |
| `getOperationsWorkspaceRegionUserAccount` | GET | — | — | — |
| `getOperationsWorkspaceStoreInvitationCandidates` | GET | — | — | — |
| `getOperationsWorkspaceStoreInvitations` | GET | — | — | — |
| `getOperationsWorkspaceStoreUserAccount` | GET | — | — | — |
| `getPlatformAdminDetail` | GET | — | — | — |
| `getPlatformContractOverviewDetail` | GET | — | — | — |
| `getPlatformContractOverviewPage` | GET | — | — | — |
| `getPlatformOrganizationHierarchyTree` | GET | — | — | — |
| `getPlatformOrganizationOverviewDetail` | GET | — | — | — |
| `getPublicAssetContent` | GET | — | — | — |
| `getWorkspaceAccount` | GET | — | — | — |
| `getWorkspaceInvitation` | GET | — | — | — |
| `getWorkspaceRole` | GET | — | — | — |
| `increaseOperationsInventoryTarget` | POST | — | — | — |
| `moveOperationsCatalogCategory` | POST | — | — | — |
| `operationsWorkspaceLogout` | POST | — | — | — |
| `platformLogout` | POST | — | — | — |
| `preflightOperationsTemporaryCatalogItemPromotion` | POST | — | — | — |
| `reissueOperationsWorkspaceGroupInvitation` | POST | — | — | — |
| `reissueOperationsWorkspaceHeadCompanyInvitation` | POST | — | — | — |
| `reissueOperationsWorkspaceProjectInvitation` | POST | — | — | — |
| `reissueOperationsWorkspaceRegionInvitation` | POST | — | — | — |
| `reissueOperationsWorkspaceStoreInvitation` | POST | — | — | — |
| `releasePlatformStagedAsset` | POST | — | — | — |
| `reorderOperationsCatalogDictionaryEntry` | POST | — | — | — |
| `resetPlatformAdminCredential` | POST | — | — | — |
| `revokeOperationsWorkspaceGroupUserAssignment` | POST | — | — | — |
| `revokeOperationsWorkspaceHeadCompanyUserAssignment` | POST | — | — | — |
| `revokeOperationsWorkspaceProjectUserAssignment` | POST | — | — | — |
| `revokeOperationsWorkspaceRegionUserAssignment` | POST | — | — | — |
| `revokeOperationsWorkspaceStoreUserAssignment` | POST | — | — | — |
| `sendOperationsPasswordRecoveryOtp` | POST | — | — | — |
| `sendOperationsWorkspaceOtp` | POST | — | — | — |
| `sendPlatformLoginOtp` | POST | — | — | — |
| `sendPlatformPasswordRecoveryOtp` | POST | — | — | — |
| `startOperationsPasswordRecovery` | POST | — | — | — |
| `startPlatformPasswordRecovery` | POST | — | — | — |
| `transitionOperationsProductionTagStatus` | POST | — | — | — |
| `transitionPlatformExternalSystemStatus` | POST | — | — | — |
| `transitionWorkspaceRoleStatus` | POST | — | — | — |
| `updateOperationsBusinessChannel` | PATCH | — | — | — |
| `updateOperationsCatalogCategory` | PATCH | — | — | — |
| `updateOperationsCommercialGroup` | PATCH | — | — | — |
| `updateOperationsOrganizationHeadCompany` | PATCH | — | — | — |
| `updateOperationsOrganizationTenant` | PATCH | — | — | — |
| `updateOperationsOwnerBinding` | PATCH | — | — | — |
| `updateOperationsProductionTag` | PATCH | — | — | — |
| `updatePlatformAdminProfile` | PATCH | — | — | — |
| `updateWorkspaceRole` | PATCH | — | — | — |
| `verifyOperationsPasswordRecoveryOtp` | POST | — | — | — |
| `verifyOperationsWorkspaceOtp` | POST | — | — | — |
| `verifyPlatformLoginOtp` | POST | — | — | — |
| `verifyPlatformPasswordRecoveryOtp` | POST | — | — | — |

</details>

---

## 9 · 未决与边界

- **L1 的远端主机资源**是否足以承载 Java 服务(内存/CPU),本文未验证 —— 属 `DEXTER_DECISION` 或实施期实测。
- **42.7ms/次** 为实测(DB 耗时 ÷ DB 操作数),非推定;但"它全部来自 SSH 隧道"仍是**推论** —— 未做单语句 ping 显微测量(属 DEV 操作,未授权)。反例边界:若远端 PG 自身慢,同侧 acceptance 不会是 0.04ms。
- P0 的 94 个 operation 的真实 DB 计数**未知**,§5.6 的整改量级无法预估。
- 本文不构成实施授权;进入实施前需按仓内流程完成 Journey/IA(如涉 UI)、详设与串行计划。

---

## 10 · 作者对抗性自审记录(四轮)

本文交付前由作者对自己做了四轮证伪,**三轮抓到本文自身的错误并已修正**。逐条留痕:

| 轮 | 攻击点 | 结果 | 处置 |
|---|---|---|---|
| 1 | 「acceptance 102 次 vs seed 128 次,是不是在对比两个不同的东西?」 | 两者 `measurementBasis` 同为 `JDBC_EXECUTION_PLUS_CONNECTION_TRANSACTION_BATCH`、schemaVersion 同为 2,**口径一致,对比成立** | 无需改 |
| 1 | 「seed 第三列到底是不是服务端耗时?」 | ❌ **我错了**。表头原文是「DB ms(均/低/高)」,是**数据库耗时**不是服务端耗时 | §1.1 整节重写,改用同口径(DB 耗时 ÷ DB 次数),结论从"88 倍"更正为**每次 DB 操作 663–1074 倍**;并补上"DB 占请求 97–98% vs 8–11%"这个更强的证据 |
| 2 | 「P2 的『每 GET 借 1 次连接』真能降 DB 计数吗?」 | 成立且我**低估了**:`getOperationsCatalogItem` 的 58 次里 27 次是借连接 = **46%** | 把"下降 ≥30%"标注为保守下限并给出实测值 |
| 2 | 「batchTransition 的 54 次借连接,写命令为何不复用?」 | ❌ **我的诊断不够精确**。实测 `TRANSACTION`=108 ⇒ **每个商品一个独立事务**,不是"反复借还" | 重写 P1 诊断;并因此发现**批量流转非原子**的正确性缺口,新增 §5.8 与一条 `DEXTER_DECISION` |
| 3 | 「前端留本机,Cookie/同源会不会坏?」 | 不会,且**既有设计已降低风险**:vite 已有 `/api` proxy 且 `changeOrigin: false`,浏览器始终同源 | 新增 L1-06 并写明依据 |
| 3 | 「资产服务也在远端,L1-02 说『隧道只转发 HTTP 端口』对吗?」 | ❌ **我写错了**。浏览器可能直连资产服务,资产端口隧道需保留 | 修正 L1-02,并标注需实施期核实是否 presigned 直连 |
| 4 | 「所有验收标准都写得出失败条件吗?」 | 通过。全部判据带具体阈值,无"尽量/改善"类不可证伪表述 | 无需改 |
| 5 | 「§5.8 的同族全集写得出来吗?」 | 按名称扫 238 个 operation,含 batch/Bulk/Many/All 的**只有 1 个**;但名称扫描**不是充分分母** | B-06 改为要求按 request schema 扫描,名称结果只作下限 |
| 5 | 「方案 C 的层入口打标,代码里现状如何?」 | ❌ **抓到我的过度自信**。仓内**已有 56 个 `pushSection` 调用点**却仍 45% 未分类 —— 这证明分散打标已失败(强化论点),但也证伪了我写的"打标点 ≤12" | 撤回 12 这个数字;改用**防漂移性质判据**(新增查询不改打标代码仍正确归类)+ 不随语句数增长的上限公式;并如实写明这是"收敛 56 个已有打标点",工作量比新建大 |

**仍然承认的薄弱处**(未被自审消除,列在 §9):
远端主机资源是否够跑 Java 服务未验证;"42.7ms 全部来自 SSH 隧道"是推论(反例边界已写明:
若远端 PG 自身慢,同侧 acceptance 不会是 0.04ms);P0 的 94 个 operation 真实计数未知,
§5.6 的整改量级无法预估。
