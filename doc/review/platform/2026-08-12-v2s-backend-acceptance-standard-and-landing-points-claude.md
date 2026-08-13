# 后台统一测试能力：术语裁定、落点清单与工程管理规范（Claude）

- 性质：**长期约定的规范化落点说明**，不是实施授权，不是 review。
- 触发：Dexter 2026-08-12 裁定——「以后我再说『完成后台功能测试』，就是指的这个后台统一测试的能力」。
- 会话出处：fresh v2s-rooted 会话。未运行 Testcontainers / DEV / L2 / reset / seed / 浏览器。
- 写入边界：本文件位于 `doc/review/platform/`。文中列出的**落点文件均未被本会话修改**，改动需 Codex 在其批准边界内执行。

---

## 1. 术语裁定

### 1.1 唯一正式名称

| 层面 | 名称 |
|---|---|
| Dexter 口语 / 中文 | **完成后台功能测试**（= 后台统一测试） |
| 机器标识 | `backend-acceptance` |
| 公共命令 | 单一入口，无编号、无 Roadmap ID |
| verdict kind | `BACKEND_ACCEPTANCE` |
| 四个维度 | `CONTRACT` / `BUSINESS` / `PERFORMANCE` / `CLEANUP` |

**含义固定为**：通过真实 HTTP、在真实 PostgreSQL/对象存储容器上，对当前后台 operation 全集，在同一次可关联执行中同时给出契约、业务、性能、清理四维结论；任一维 FAIL 则 `OVERALL` FAIL。

### 1.2 禁用词汇（不得出现在能力名、命令、类名、报告 kind、成功条件、日志前缀、文档正式表述中）

`196` / `197` / `198` / 任何接口计数、`P4` / `P5` / 任何阶段编号、Roadmap 或 Journey ID、`performance-only`、`BPF`、`functional lane` 与 `performance lane` 的分立表述。

**允许**：报告中输出 `discoveredOperations: N` 作为**诊断值**；历史文档中作为已退役资产的**指称**（须标注已退役）。

### 1.3 「完成后台功能测试」不等于什么

不等于：编译通过、静态契约门 PASS、ArchUnit PASS、源码机械门 PASS、seed 跑通、DEV 起得来、测试类数量达标、旧 PASS 报告存在。

这些**各自保留原职责**（裁决 7），但**都不能替代**上述四维结论。

---

## 2. 落点清单（每条都是可执行改动，不是原则）

### 2.1 `project-memory/routing-vocabulary.json` —— **术语当前完全无法路由**

**实测**：`dimensions` 含 `taskKinds` / `domains` / `consumerFaces` / `owners` / `impacts` / `triggers`；检索「196」「P4」「性能」「Testcontainers」「后台功能测试」**命中均为 0**。

**要求**：在 `taskKinds`（或等价维度）登记 `backend-acceptance`，并把下列同义触发词全部指向它：

```
完成后台功能测试 / 后台统一测试 / 后台验收 / backend acceptance /
后台功能测试 / 后台性能测试 / 接口测试
```

**关键**：「后台性能测试」必须路由到**同一条**，不得单独成项——这是「功能与性能不分家」在术语层的强制形式。

### 2.2 `.agents/skills/cs-managed-runtime-execution` —— **技能内部当前与本裁定矛盾**

**实测矛盾（须先修）**：

- `SKILL.md:46-47` 明文写着「BPF 196 selector 仍是**独立的精确性能契约**，不得为使通用套件可扩展而弱化」。**这条把被退役的分立模型写成了规范**，与「统一为一类能力」直接冲突。
- `SKILL.md:31` 的目标推导是「把每个带 `@Testcontainers` 的 Java 源纳入其 Gradle `:test` 任务」——**分母是测试类，不是 operation**。合并稿与两份独立分析已一致裁定分母必须是 operation。

**要求**：

1. 删除 196 selector 作为独立性能契约的表述；
2. 目标推导从「测试类枚举」改为「operation 分母 + 其 owning unit」；
3. 明确 `backend-acceptance` 是**一键可独立调用**的受管执行，并写明其前置条件、授权要求与产物路径；
4. 保留该技能既有的授权分级与受管边界，不因统一而放宽。

### 2.3 `.agents/skills/cs-writing-plans` 与 `cs-spec-to-plan` —— **设计阶段强制门**

Dexter 裁定：「新功能模块的设计阶段就必须考虑设计测试用例与纳入统一测试框架，不得跳过。」

**要求**：任何新增或修改 operation 的 implementation-facing 设计，**必须**包含该 operation 的 scenario contract 草案，字段至少覆盖：

```
identity / fixture / request / businessOracle / performanceCriterion / cleanup
```

缺任一项，设计**不得进入 review**；技能须给出稳定的 typed 拒绝码，而不是靠评审人肉发现。`correctnessCases` 可为空但需一行理由（见合并稿 review 的 S-04 裁定）。

### 2.4 `project-memory/required-inventory.json` 与 `decisions/`

**要求**：新增一条 decision 记录本裁定（术语、四维、禁用词汇、设计阶段强制门），并登记进 required inventory，使 memory recall 能确定性命中。routed anchor 建议置于 `project-memory/operations/`。

### 2.5 `scripts/` —— 单一入口与受管执行

**要求**：公共入口只有一个，名称不含编号。旧的分立入口在迁移完成后按合并稿 review 的顺序退役（**先建后删**，不得反序）。

### 2.6 `CLAUDE.md` / `AGENTS.md` / `PLATFORM-BLUEPRINT.md`

**要求**：在评审与实施纪律中写明——凡声称「后台功能测试已完成」，必须指向 `backend-acceptance` 的四维 verdict 与 fresh 证据；**静态门 PASS、seed 报告、旧 PASS 一律不构成该声明的证据**。

---

## 3. 执行契约（脚本必须自带，不靠 agent 现场发挥）

Dexter 要求：「脚本里做好各类的前期准备、运行监控、报错明确、查错便捷。」逐条转成可验收要求：

### 3.1 前期准备（自愈，不要求调用者预先布置）

- 自检 Docker/容器运行时、镜像可用性、磁盘与端口；
- 自检 operation 分母与 digest 新鲜度（当前 `BP_U02_ROUTE_SOURCE_DIGEST_DRIFT` 就是这类前置失败）；
- **在启动昂贵环境之前**完成全部 admission 校验，缺 scenario / fixture / oracle / budget 必须**立刻**给出稳定 typed failure，不得等容器起完才失败。

### 3.2 运行监控

- 启动即输出 run/lane ID、分母、计划单元数；
- 持续输出 `discovered / running / passed / failed / remaining` 与当前 operation；
- 心跳间隔有上限，长时间无输出本身即异常信号；
- 单元级耗时可见，便于定位慢点。

### 3.3 报错明确

- 每类失败有**稳定错误码**（如 `UNCOVERED_OPERATION` / `STALE_ROUTE_OR_BINDING` / `BUSINESS_ORACLE_REQUIRED` / `PERFORMANCE_BUDGET_EXCEEDED` / `CLEANUP_FAILED`）；
- 失败必须同时给出：operation identity、失败**维度**、期望 vs 实际、fixture 与 run ID、日志路径；
- **禁止**用 Gradle exit code、测试方法名或「workload failed」作为诊断结论。

### 3.4 查错便捷

- 首败信息在**结尾摘要**中重复一次，不要求翻滚日志；
- 单 operation 可独立重跑，命令在失败输出中直接给出；
- 证据落盘路径固定可预测。

### 3.5 并行

Dexter 裁定：「测试能并行的部分需要并行来节省时间，远端服务器资源很多，不用有太多顾虑，我要的就是又快又准能发现问题。」

- lane 数**不得写死为 3**，须可配置并按远端资源上调；
- 并行粒度是 **unit**（operation 场景），不是测试类；
- 每 lane **独立**容器、数据库/schema、对象存储 namespace；**并行的前提是隔离，不得为提速让多 lane 共用可写库**；
- 单 lane 首败停该 lane，其余 lane 继续跑完并各自保留首败——**一处失败不得掩盖其他 lane 的问题**；
- 空闲 lane 可领取 fixture ownership 独立的待跑 unit。

---

## 4. 变更联动强约束（改后台必须改用例）

Dexter 裁定：「迭代过程中，尤其是改 BUG 的过程中，如果出现了后台接口变化或逻辑变化，必须要能做相应的测试用例的调整，不是只改后台功能。」

要防的是三种真实失守形态，**不是"忘了写测试"这种笼统说法**：

| 失守形态 | 今天会发生什么 |
|---|---|
| 改了实现，用例没动 | 用例本来就没断言那处行为 → 照样绿 |
| 改了 bug，补的用例抓不到该 bug | 用例在修复前的字节上**也是绿的** → 零回归价值 |
| 用例挡路，于是把用例改松 | 断言删掉或预算调高 → 门变绿，保护消失 |

### 4.1 机制可以很便宜，因为反查映射已经现成

**实测**：`contracts/registry/backend-performance-operation-source-inventory.json` 有 **196 行**，每行的 `edge` / `adapter` / `transaction` / `ownerBoundary` 均带 **`sourceAnchor`（`路径#方法`）与 `sourceSha256`**，全表 **848** 处 `.java` 锚点。

因此「改动 → 受影响 operation」是**逐 operation 的字节级判定**，不是文件级粗猜。该 registry 目前服务于静态对账，**只需改指向变更门，不需要新建数据源**。

### 4.2 层一 · 影响面自动推导（零人工，且必须 fail-safe 兜底）

package exit 重算每个 operation 的 anchor `sourceSha256`；**任何 anchor 哈希变化的 operation 自动进入 `IMPACTED_OPERATIONS`**。纯机械，无判断，绕过需要伪造哈希。

**但只有这一条会漏 77%。这是我本节初稿的漏洞，必须补，实测如下：**

| 事实 | 数值 |
|---|---|
| 后台生产源 `.java` 总数 | **571** |
| anchor 覆盖的源文件数 | **128**（更正，原写 129） |
| **盲区** | **443 个文件（77.58%）**（更正，原写 442） |
| `modules/foundation`（含 `DatabaseOperationTracker`） | **0 覆盖** |
| `HttpRequestMetricsInterceptor` | **0 覆盖** |
| `EdgeWebConfiguration` | **0 覆盖** |
| DataSource / 连接池配置 | **0 覆盖** |

anchor 只锚在 `edge` / `adapter` / `transaction` / `ownerBoundary` 四类 **operation 专属**位置。改动持久化层、事务配置、连接池、拦截器或 web 配置，**移动不了任何 operation 的 anchor 哈希**，于是推导出 `IMPACTED_OPERATIONS = ∅`、无需任何 disposition、干净收口——**而每个接口的行为与 DB 开销都可能已经变了**。这正是 DBCR 那一类失守形态。

**修正后的推导规则 —— 两条取并集：**

1. **精确面**：anchor `sourceSha256` 变化的 operation；
2. **兜底面**：本包 changed path 中存在**任何一条落在 anchor 覆盖白名单之外的后台生产源** → **`IMPACTED_OPERATIONS = ALL`**。

**为什么不是"列一份共享基础设施路径清单"**：那份清单必然漏——漏的那条正好就是下次出事的那条。白名单反向判定是 **fail-safe 默认**：未被精确映射的改动一律按全影响处理。

**且激励方向正确**：想要窄影响面，就得把该源文件纳入 anchor 覆盖。覆盖率提升是收益而非负担，`128 / 571` 会被自然推高。

**补充更正（2026-08-13）**：初稿写 129 / 442，**错**。第 129 条 anchor 指向 `build/generated/sources/` 下的生成物，不是 checked-in 生产源；我当时对生产源集合过滤了 `build/`，却未对从 registry 抽取的路径同样过滤。正确值为 **128 / 443（77.58%）**。

**另一条初稿未评估、但决定可用性的事实**：ALL 兜底的**触发频率**是 **77.6%**，每个模块盲区均 ≥ 66.7%，`foundation` / `audit-model` / `execution-context` 为 100%。因此 **ALL 是常态而非兜底**。这不影响兜底规则的正确性，但意味着执行时间必须按「full mode 是常态」来设计——提速只能靠加并行 lane，不得靠缩小影响面。详见 `doc/review/platform/2026-08-13-v2s-backend-acceptance-design-review-claude.md` 的 M-02。

### 4.3 层二 · 每个受影响 operation 必须有 disposition，且逃生口必须机器背书

对 `IMPACTED_OPERATIONS` 中每一条，**三选一，不接受空值、不接受 `PENDING`**：

| disposition | 含义 | 准入条件 |
|---|---|---|
| `SCENARIO_UPDATED` | 该 operation 的 scenario contract 本包内已调整 | scenario hash 必须真的变了 |
| `REGRESSION_ADDED` | 新增了用例 | 新 case 必须真的存在 |
| `BEHAVIOR_UNCHANGED` | 行为未变，用例无需动 | **必须机器可验**：contract digest 未变 **且** 四维实测结果与 accepted baseline 一致 |

**`BEHAVIOR_UNCHANGED` 不得是自由文本声明**——这是整条约束的成败点。允许作者写一句「行为没变」就放行，等于没有约束。它必须由重跑结果背书。

该形态与仓内已验证的 source-anchor disposition（`RETAIN` / `MOVE` / `MIGRATE`，不允许 `PENDING`）同构，成本已知。

### 4.4 层三 · BUG_FIX 包必须出红证（最高价值的一条）

改 bug 的包，**至少一个 scenario case 必须被证明：在修复前的字节上 FAIL，在修复后的字节上 PASS。**

- 没有这条，「改了 bug 但用例根本抓不到」会静默通过，回归保护为零；
- 这正是 DBCR 那次的形态：历史 PASS 报告早于生产源码变更，旧绿证明不了新字节；
- **成本低**：per-edit ledger 已记录 PRE 状态与 receipt，红证是既有机制的复用，不是新建。

无法产出红证时，只允许两种收口：说明该 bug 属于**不可在 route 层表达**的形态（进封闭保留清单并写明理由），或**承认这是一次未受回归保护的修复**并显式登记——**不允许沉默通过**。

### 4.5 反弱化（防"把用例改松"）

`SCENARIO_UPDATED` 必须自带**变更方向**，不能只说"改了"：

| 方向 | 准入条件 |
|---|---|
| `ORACLE_TIGHTENED` | 无需额外授权 |
| `ORACLE_ADJUSTED_TO_NEW_SPEC` | 必须引用产品/Journey/契约依据 |
| `ORACLE_RELAXED` | **必须引用明确依据；「用例挡路」「测试跑不过」不构成理由** |

性能维度沿用已存在的 accepted baseline 棘轮（`doc/evidence/platform/rm1/p4/canonical-performance-accepted-baseline.json` 现有 52 case 已是该形态）：预算上调必须引用独立接受基线与归因，**禁止把当前值与接受基线一起静默调高**。

### 4.6 接口形状变化要联动到消费方

若变化落在 route/OpenAPI 形状（method / path / schema / 错误契约），除本 operation 的 disposition 外，还须标记其 `consumerFace`（该字段在 inventory 每行已有）为待处置。**后台接口形状变了而前端毫不知情，是本仓已发生过的形态**，代价是零——字段现成。

### 4.7 落点

- **门**：package exit，复用既有六类分母对账，新增 `IMPACTED_OPERATIONS` 与其 disposition 分母；
- **技能**：`cs-systematic-debugging` 的改 bug 流程必须要求 §4.4 红证，且作为**收口前置**而非事后建议；
- **纪律**：`CLAUDE.md` / `AGENTS.md` 写明——**只改后台实现、不动 scenario contract 且无 `BEHAVIOR_UNCHANGED` 机器背书的包，不得收口**。

### 4.8 本节的红变异

1. 改动某 operation 的 adapter 实现，不给任何 disposition → package exit 红；
2. 给 `BEHAVIOR_UNCHANGED` 但四维实测与 accepted baseline 不一致 → 红；
3. BUG_FIX 包补的用例在修复前字节上**也是绿的** → 红证缺失，红；
4. 删除某断言或调高预算而标为 `ORACLE_TIGHTENED` → 方向自相矛盾，红；
5. `ORACLE_RELAXED` 无依据引用 → 红；
6. route 形状变化未标记 `consumerFace` 待处置 → 红；
7. 伪造 anchor `sourceSha256` 使 operation 不进入影响面 → 哈希重算红；
8. **改动 `modules/foundation` / 拦截器 / 事务或连接池配置等 anchor 白名单之外的后台生产源，而 `IMPACTED_OPERATIONS` 未置为 `ALL` → 红**（这条直接针对 §4.2 的 442 文件盲区，是本节最重要的红控制）。

---

## 5. 对我此前代价裁定的更新（诚实披露）

我在合并稿 review 中按「便宜」标尺给出 M-01 / M-02。Dexter 补充「远端资源很多，要又快又准」后，需要区分两种成本：

| 成本类型 | 标尺 | 是否放宽 |
|---|---|---|
| **建设与维护复杂度**（逐 operation 人工判据、多套机制、可维护性） | 便宜 | **不放宽**，M-01 / S-04 的裁定维持 |
| **机器资源与并行度**（lane 数、容器数、CPU、总机时） | 充裕 | **放宽**，鼓励加并行 |

因此 **M-02 的处置修正如下**：

- 原处置：per-edit 只跑受影响 owner，package-exit 跑全量，写死总时长上限。
- **修正后**：仍保留两层执行契约（per-edit 必须分钟级这一红线不变），但 **package-exit 全量的提速手段首选「加并行 lane」，而不是砍维度或砍覆盖**。只有并行已达资源上限仍超时，才按「砍最弱门」处置。
- M-01（移除逐 operation 时延/分位数）**维持不变**：它的问题不是机时贵，而是**容器内时延不可靠**——加资源不能让 flaky 变准，反而会因并行加剧噪声。**这一条恰恰因为要并行而更该移除。**

---

## 6. 规范自身的红变异

规范若无法被违反检出，就只是文档。以下须有真实红控制：

1. 新增 operation 的设计未附 scenario contract 六字段 → 设计门红；
2. 任何新代码、命令、类名、报告 kind 引入禁用词汇（编号/阶段 ID）→ 红；
3. 「后台性能测试」被路由到独立于 `backend-acceptance` 的能力 → 红；
4. 以静态门 PASS、seed 报告或旧 PASS 声称「后台功能测试已完成」→ 验收红；
5. 多 lane 共用同一可写数据库 → 隔离自检红；
6. 某 lane 首败导致其他 lane 被取消 → runner self-test 红；
7. admission 失败发生在容器启动**之后** → 前置校验红（证明 fail-fast 未生效）。

---

## 7. 已代 Dexter 裁定（2026-08-12 授权「需要确认的你替我确认」）

### 7.1 机器标识 —— **确定为 `backend-acceptance`**

满足全部约束：无接口计数、无阶段编号、无 Roadmap/Journey ID、中英一致、语义不随规模变化。**此后不再更名**；若将来能力扩展，扩展的是其维度，不是名字。

### 7.2 per-edit 分钟级红线 —— **维持**，但附三条限定

维持：per-edit 只跑**受影响面**，全量放 package-exit。理由是这个 subset **不是猜的**——它由 §4.2 的 anchor 哈希 + 白名单兜底机械推导，有据可依。

三条限定，缺一则该红线失效：

1. **影响面只能推导，不能声明。** 任何允许作者手工声明「本次只影响 X」的通道都是绕过口，禁止存在。
2. **兜底必须生效。** 命中 §4.2 第 2 条（改动落在 anchor 白名单之外）时，per-edit 也必须按 `ALL` 跑。**此时超出分钟级是正确行为，不得为了守住分钟级而缩小影响面**——守时间的代价永远不能是缩覆盖。
3. **超时的处置顺序固定**：先加并行 lane（远端资源充裕），加到资源上限仍超时，才按「砍最弱门」处置。**任何情况下都不得砍覆盖面。**

package-exit 无论如何跑全量，因此 per-edit 的 subset 永远不是最终结论。

---

## 8. 授权边界

- 本文件是**规范落点说明**，不授权实施，不授权下一 Roadmap step，不含 `GO` / `NO-GO`。
- §2 中所列落点文件**均未被本会话修改**；`routing-vocabulary.json` 的 0 命中与 `cs-managed-runtime-execution` 的两处矛盾均为**本会话实测**，非推测。
- 本轮未执行 Testcontainers / DEV / L2 / reset / seed / 浏览器 / UAT / 部署 / 手工 SQL。
- §4 对我此前裁定的修正已显式披露，避免下游同时引用两个版本。
