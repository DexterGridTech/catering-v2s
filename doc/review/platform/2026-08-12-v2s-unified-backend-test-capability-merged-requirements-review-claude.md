# 统一后台测试能力·合并需求基线 review（Claude）

- 结论：**NO-GO（M=2 / S=4 / N=2）**
- 评审对象：`doc/plans/platform/2026-08-12-v2s-unified-backend-test-capability-merged-requirements.md`
- 参照对象：Codex 独立稿、Claude 独立稿、Dexter 原始裁决（含本轮追加两条）
- 会话出处：fresh v2s-rooted 会话，本文件为唯一写入。未运行 Testcontainers / DEV / L2 / reset / seed / 浏览器。
- 授权说明：Dexter 本轮授权「需要裁决的由 Claude 决策，方向是**便宜**」。因此全部 M/S 均**附已裁定的处置**，Codex 可单轮改完，不需要二次求裁。

---

## 0. 先说结论方向

合并稿的**方向是对的，事实是硬的**，问题**不在正确性，在代价**。

它把一件本应「便宜地堵住漏报」的事，写成了一套**接近企业级契约测试平台**的建设纲领。按当前一人 + 两个 AI 的阶段标尺，这份需求如果原样实施，风险不是做不对，而是**做不完、跑不动、然后被绕过**——最终退回到今天「有门但没人信」的状态。

因此 NO-GO 的两条 M 都是**代价配不配**，不是**逻辑对不对**。

---

## 1. 事实核验：Codex 这轮很硬，且有一条比我强

我逐条独立复算，**未采信任何自报数字**：

| 合并稿声明 | 我的独立复算 | 结论 |
|---|---|---|
| route registry 154 + 42，并集 196，bindings 196 | 154 / 42 / 并集 196 / bindings 196，双向差集 0 | ✓ |
| `scripts/check/operation-handler-bindings` 当前报 `BP_U02_ROUTE_SOURCE_DIGEST_DRIFT` | 实跑，**确实 FAIL，错误码精确命中** | ✓ |
| test source 118 个 | 118 | ✓ |
| `@Testcontainers` 19 个，仅历史 196 lane 走真实 HTTP | 19；仅该类有 `@SpringBootTest(RANDOM_PORT)`，其余 18 个**无任何 Spring 测试注解** | ✓ |
| P4 台账 28 row / 26 caller symbol / 52 case | rows **28**、`identity.callerSymbol` 去重 **26**、`budget.cases` 合计 **52** | ✓ |
| 「复用现有三 lane 治理」 | `r5-remote-testcontainers.mjs` 确有 `laneIndex` / `laneCount` / `laneDockerHost` / `laneWorkspace` | ✓ 前提为真 |

**一条 Codex 比我强、我必须认的**：合并稿 §3.1 指出「**行集合相等**」与「**投影 metadata 新鲜**」必须分别校验，不得互相冒充。我的独立稿只验了行集合双向差集为 0，就写了「当前零漂移」——**digest 层的漂移我漏了，而它当前是真 FAIL**。这个区分是对的，且是本次分母设计的关键，应当保留。

**一条我自己的错，与 Codex 无关**：我的独立稿 §10 写「P4 台账已有 25 行既有基线」，**实为 28 行**。25 是我前一轮的陈旧数字，未在本轮复算。我的独立稿需据此更正。

---

## 2. 方案合理性判断（先于正确性）

### 2.1 问题对不对 —— **对**

合并稿 §3.2 对漏报根因的分解是准确的：freshness 缺失 + 业务/HTTP 分裂 + 性能只有观测无预算 + 局部分母遗漏。四条都成立，且都不是「seed 跑得不够勤」能解决的。§1.1「明确不采用的方案」四条也都判得对，尤其是否决 test seed 的理由（状态污染、顺序依赖、不可重复的性能基线）与我独立得出的结论一致。

### 2.2 方案优不优 —— **主干对，但没有构造「更便宜的同效方案」**

合并稿比较了 A（test seed）、B（全塞容器）、C（统一验收系统）三个方案，**但三个候选的代价量级是同一档的**。它没有构造出「**能堵住这次漏报、但只要一个零头成本**」的候选，因此「C 最优」这个结论**没有经过便宜方向的检验**。

按 Dexter 本轮标尺，缺失的候选是：

> **C-min**：同样是统一 ROUTE_BEHAVIOR + 统一分母 + 统一计量，但**性能维度只做结构性 DB 计数（确定性、零采样、零预热）**，**契约维度只做通用 schema 校验（一个 validator 覆盖全部 operation，零逐项编写）**，**逐 operation 人工编写的只有 fixture / request / businessOracle 三项**。

C-min 能否堵住这次的漏报？**能**。DBCR 那次的形态是 `QUERY 不变、CONNECTION 从 561 涨到 1309`——这是**结构性计数**，C-min 的预算断言直接命中，不需要任何时延采样、不需要 percentile、不需要 correctnessCases。

C 相对 C-min 多出来的部分（逐 operation 时延分位数、逐 operation 授权/幂等/CAS/重放用例、impact graph 复测跳过），**对本次根因零贡献**。

### 2.3 代价配不配 —— **不配，这是 NO-GO 的核心**

按合并稿 §6 的强制字段，每个 operation 需人工产出：contract oracle、business oracle、correctnessCases（授权/拒绝/幂等/CAS/重放/scope）、performanceCriterion（8 类指标 + 采样策略）、cleanup。按当前 196 个 operation 的时点规模，这是**四位数量级的人工判据编写**，且 §6 明确「不接受空值或泛化 `NOT_APPLICABLE`」。

再叠加 §7.3 的时延分位数、§8.4 的五类 hash freshness tuple 与 impact graph、§10 的 30 秒 heartbeat 与全维度报告——这套东西的建设与维护成本，**超过了它要保护的后台本身在当前阶段的变更速率**。

CLAUDE.md 的判据在此适用：**「过度工程或偏离用户意图，本身就是 finding」**。

---

## 3. Findings

### M-01｜逐 operation 时延/分位数预算：成本最高、可靠性最低、与原始需求不符

- **严重度**：M　**状态**：CONFIRMED　**是否阻断**：是
- **owning source**：合并稿 §7.3（`duration/percentile sample policy`、`pinned runtime、预热、多次样本和分位数/噪声策略`）、§6（`performanceCriterion` 强制含 sample policy）、§12-9（scale profile 红）
- **仓内事实**：现有唯一权威计量基 `JDBC_EXECUTION_PLUS_CONNECTION_TRANSACTION_BATCH` 是**计数**口径，`DatabaseOperationTracker` 与 `HttpRequestMetricsInterceptor` 产出的是操作计数与归因，**不是时延分布**。时延分位数需要新建采样、预热与噪声治理，全部是增量建设。
- **推论**：容器内时延受宿主负载、Docker I/O、JIT 预热影响，在 CI 与本机之间不可比。把它作为**硬预算**加在**每个** operation 上，必然产生持续 flaky。而这套东西一旦成为**唯一**后台行为测试，flaky 的代价是**整个后台行为保护被绕过**。
- **与原始需求的偏离**：Dexter 的性能诉求指向的是 DB 开销回归（DBCR 的 CONNECTION 恶化就是这个形态）。时延分位数不在其中，我的独立稿已把它标为「独立且可后置」。
- **反例**：DBCR 那次漏报，`QUERY 1870 → 1870` 不变而 `CONNECTION 561 → 1309`。纯计数预算即可必红，**时延采样对该案零贡献**。
- **已裁定处置（便宜方向）**：**本轮完全移除时延/分位数/预热/采样策略**。性能维度只保留**确定性结构计数**：logical SQL、QUERY、UPDATE、CONNECTION borrow、TRANSACTION、batch 退化。时延与真实数据量下的行为登记进 `HANDOFF.md` 欠账，不作为本次要求。`scale fixture` 同步降级为**可选**，仅在某 operation 被实测证明数据量敏感时才引入。

### M-02｜没有执行位置与时长约束，而它将成为唯一后台行为测试

- **严重度**：M　**状态**：CONFIRMED　**是否阻断**：是
- **owning source**：合并稿全文；§13 要求「所有 current operation 通过真实 HTTP 同时得到 CONTRACT/BUSINESS/PERFORMANCE 结果」，但**未声明这套东西在哪里运行、允许跑多久**。我在 `backend-performance-testcontainers-plan.json` 中未检出任何时长约束。
- **仓内事实**：当前 19 个 `@Testcontainers` 类各自实例化容器（`new PostgreSQLContainer` 实例化点 20 处，`extends` 关系 0）。合并稿 §8.2 把共享收敛为「每 lane 一次初始化」，方向对，但仍未给出总时长上限。
- **推论**：Dexter 的既有红线是 `scripts/verify` 保持**分钟级**。若统一能力是唯一后台行为测试却无法分钟级运行，只有两种结局：verify 变慢被砍，或统一能力被移出 per-edit——**后者等于后台行为在日常开发中重新失去保护**，正是本次要修的问题。
- **已裁定处置（便宜方向）**：需求中**必须写入两层执行契约**，且用现有 owner metadata 实现，零新建：
  1. **per-edit 层**：只运行受影响 owner/package 的 ROUTE_BEHAVIOR unit（owner 已在 route registry 与 bindings 中登记，映射现成）。必须分钟级。
  2. **package-exit 层**：全量运行，产出四维 verdict。
  并**显式写明总时长上限**；超限时的处置是**砍最弱维度**，不是接受变慢。

### S-01｜P4「逐项迁移校准」在语义上不可执行，应为「重新测量后删除」

- **严重度**：S　**状态**：CONFIRMED
- **owning source**：合并稿 §7.4（`可映射到 HTTP operation 的 case 校准到 tracker 口径`）、§11-7
- **仓内事实**：P4 的 `budget.mode` 是 `EXACT_SQL_STATEMENTS`，边界是**方法级**（`identity.callerSymbol` 形如 `ContractTaskReadService#fixedStoreContracts`），经 `CountingDataSource` 计数；tracker 口径是 **HTTP 请求级**且含 CONNECTION / TRANSACTION / batch。两者**边界不同、计量项不同**。
- **推论**：一个方法级 SQL 语句数**无法换算**成 HTTP 级的多指标预算——HTTP 级还包含该方法之外的边界层、鉴权、上下文解析开销。所谓「校准」实际只能是**在新边界上重新测一遍**。既然要重新测，旧的 52 个 case 值就**不提供任何输入**，「迁移」是空转工作量。
- **已裁定处置（便宜方向）**：不做迁移项目。规则改为：**某 operation 一旦获得 ROUTE_BEHAVIOR 预算，其对应 P4 row 直接删除**（新预算是重新实测的，不继承旧值）。P4 剩余无法映射到任何 HTTP operation 的 row，按 §S-03 的保留清单规则处置。迁移期内**禁止 P4 产出任何后台总体性能 verdict**，也禁止与 tracker 数字互引——这条合并稿已有，保留。

### S-02｜迁移期间门将长期常红，且合并稿明确禁止子集化，无收敛机制

- **严重度**：S　**状态**：CONFIRMED
- **owning source**：合并稿 §11-2（先建动态分母）、§11-5（逐 package 建 unit）、§11 末「不得因新 admission 首次暴露大量缺口而放宽为子集或跳过」、§13
- **推论**：第 2 步建立 fail-closed 分母后，尚未迁移的 operation 全部落为 `UNCOVERED_OPERATION`。在第 5 步逐 package 完成之前，统一门**持续 FAIL**。一个在数周内恒红的门，实际效果等于没有门：它无法区分「迁移未完成」与「真的坏了」，且必然被日常绕过。
- **反例**：这正是本仓已发生过的模式——门存在、结论不可行动、于是被跳过。
- **已裁定处置（便宜方向）**：引入 **`KNOWN_UNCOVERED` 单调台账**，规则三条：
  1. 台账**只能删条目，不能加条目**（机器强制）；
  2. 门的绿条件 = 已覆盖 operation 全部通过 **且** 未覆盖集合 ⊆ 台账；
  3. **新出现的 operation 永远进不了台账**，因此新接口**从第一天起就 fail-closed**。
  这样既立刻拿到裁决 4 要求的新接口 fail-closed，又不制造恒红门。台账清空即迁移完成，收敛可度量。

### S-03｜`OWNER_LOGIC` 被定为永久类别，与本轮「其他后台测试下线删除」冲突

- **严重度**：S　**状态**：CONFIRMED
- **owning source**：合并稿 §5.2（`现有 owner/service 测试中的纯业务断言继续保留`，未设退役条件）、§11（10 步中**没有任何一步**退役包测试）
- **Dexter 本轮追加要求**：「这次统一了后台测试能力后，其他的后台测试需要下线删除」。
- **需要区分的边界**：裁决 7 保护的是**编译、静态契约生成、架构边界、源码机械门**——它们职责不同，不是后台**行为**测试，**不在删除范围**。而 `OWNER_LOGIC` 是行为测试，在范围内。
- **披露**：我的独立稿同样把 `OWNER_LOGIC` 写成了并列常设类别，**这一点我和 Codex 一起错了**，按 Dexter 本轮要求两份都需修正。
- **已裁定处置（便宜方向）**：`OWNER_LOGIC` 降级为**过渡类别**：
  - 某 operation 获得 ROUTE_BEHAVIOR 覆盖后，其 owner 层行为测试**默认删除**，业务断言在迁移中逐条并入 route 场景（合并稿 §7.2「逐断言保留其独有业务价值」这条要保留）；
  - 例外只能进入一份**显式、有限、逐条写明理由的保留清单**，判据严格限定为「**不触库、不过事务、不跨 owner** 的纯算法 / mapper / parser」；
  - 保留清单**不得产出任何后台性能或整体功能 verdict**；
  - 清单是**封闭集**，新增需逐条说明，禁止开放式增长。

### S-04｜`correctnessCases` 强制非空且禁止 `NOT_APPLICABLE`，会批量制造伪声明

- **严重度**：S　**状态**：CONFIRMED
- **owning source**：合并稿 §6（`除明确允许的附加 case 外，不接受空值或泛化 NOT_APPLICABLE`），字段含 `applicable authorization, rejection, idempotency, CAS, replay, scope`
- **推论**：幂等、CAS、重放对**读取类 operation 本质不适用**。当前 196 中读写并存，强制每条非空会导致作者为了过门而写入形式化、无业务含义的 case——**这正是「静态门伪装成语义证明」的形态**，与裁决 7 精神相悖，且是纯成本。
- **已裁定处置（便宜方向）**：按维度分级，**只把真正不可省略的设为强制**：
  - **强制非空**：`identity`、`fixture`、`request`、`businessOracle`、`performanceCriterion`、`cleanup`（这六项对应裁决 5 的「不得自动猜测」，一项都不能松）；
  - **可为空但需一行理由**：`correctnessCases`；
  - **通用能力承担、零逐项编写**：`contractOracle` 由**一个**通用 OpenAPI + 信封 + Problem 校验器对全部 operation 生效，不作为逐 operation 人工字段。

### N-01｜我方独立稿的 P4 行数陈旧（自我更正，非 Codex 问题）

我的独立稿 §10 写「25 行既有基线」，实测 **28 行 / 26 caller symbol / 52 case**。25 系前一轮陈旧数字。记录于此避免被下游引用。

### N-02｜合并稿 §3.2 的 seed 对比数字我未独立复算

`CONNECTION 561 → 1309`、`TRANSACTION 748 → 374`、`QUERY 1870 → 1870`、`17 → 19` 及三个时间戳（03:31 / 20:49 / 21:52）。seed 报告目录存在，但我本轮**未逐份比对**，故标 **UNVERIFIED**。该组数字用于论证根因，方向与 DBCR-U01 的已知信号一致（摘读事务后 CONNECTION 上升而 QUERY 持平），**不影响结论成立**，但不应被当作已核验事实向下游引用。

---

## 4. 应当原样保留的部分（不要在修改中丢掉）

- §1 四维 verdict（CONTRACT / BUSINESS / PERFORMANCE / CLEANUP）共享同一 operation identity 与 correlation，任一 FAIL 则 OVERALL FAIL；
- §1.1 四条「明确不采用」，尤其否决 test seed 的三条理由；
- §2.1 seed 的四条禁止用途；
- §3.1「行集合相等」与「投影 digest 新鲜」分别校验——**这是本次分母设计最关键的一条**；
- §4.2 禁止计数判定，一律走双向 exact set；
- §7.2「迁移现有包测试时必须逐断言保留其独有业务价值」；
- §7.3 以 `DatabaseOperationTracker` 为唯一权威计量基，预算上调必须引用独立 accepted baseline（该 baseline 已存在，52 case）；
- §8.2 澄清「共享容器 = 每 lane 一次初始化」而非三 lane 共用可写库；
- §8.3 只增测试可见 in-JVM sink，不建第二测量层；
- §11「不得先删旧能力再补新能力」的顺序硬约束；
- §12 的红变异清单（移除第 9 条 scale profile 后其余保留），尤其第 5 条「2xx 且 schema 合法但业务值错 → BUSINESS 红」——这正是历史 lane 的真实缺口。

---

## 5. 修改后的验收条件调整

合并稿 §13 中下列三条需按上述裁定改写：

- 「所有 current operation 通过真实 HTTP 同时得到 CONTRACT/BUSINESS/PERFORMANCE 结果」→ 增加 `KNOWN_UNCOVERED` 台账为空作为最终条件，允许迁移期内台账非空但单调收缩；
- 「旧 196、P4 和 seed 资产只在等价证明迁移后退役」→ P4 改为「对应 operation 获得重新实测的 route 预算后直接删除」，不要求等价换算；
- 新增：per-edit 层与 package-exit 层的执行契约与**显式时长上限**；
- 新增：`OWNER_LOGIC` 保留清单为空或为封闭有限集，且清单内各条已逐条写明理由。

---

## 6. UI 与交互

`NOT_APPLICABLE`。本需求不引入、不修改任何用户可见界面或 Journey 操作，仅涉及后台测试能力与受管执行。

---

## 7. 授权边界

- 本结论仅为**静态需求基线 review**。`NO-GO` 指向**代价与范围**，不否定方向、不否定其事实基础。
- 本轮**未执行** Testcontainers / DEV / L2 / reset / seed / 浏览器 / UAT / 部署 / 手工 SQL。
- 本 review **不授权**任何实施、不授权下一 Roadmap step、不授权动态或数据操作。
- 全部 M/S 的处置均已由 Claude 依 Dexter 本轮「你来决策、方向要便宜」的授权裁定，Codex 可在既有批准边界内直接修改，**不需要再向 Dexter 求裁**。若 Codex 认为某条裁定会破坏其未在合并稿中写明的约束，应带证据回述，而不是默默保留原文。
