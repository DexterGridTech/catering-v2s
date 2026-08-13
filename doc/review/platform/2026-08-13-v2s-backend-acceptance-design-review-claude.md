# backend-acceptance 整体 implementation-facing DESIGN review（Claude）

- 结论：**NO-GO（M=2 / S=2 / N=2）**
- 评审对象：`doc/plans/platform/2026-08-13-v2s-backend-acceptance-implementation-design-and-plan-codex.md` 及其 manifest / package-input / authorization / decision / memory / skill 落点
- 会话出处：fresh v2s-rooted 会话，本文件为唯一写入。未运行 Testcontainers / DEV / L2 / reset / seed / 浏览器 / UAT / 部署 / 手工 SQL。
- **NO-GO 的性质**：这是一份高质量详设，两条 M 都是**具体缺口**，不是方向否定。两条修复都很便宜，可单轮改完。
- 评审尺子：按 Dexter 指示，**以其初衷为准，不以方案自洽为准**。M-02 即是自洽但偏离初衷的一条。

---

## 1. 亲验结果（不采信任何自报数字）

### 1.1 声明 SHA-256 逐个复算

7 份 `inputs` 全部**相符**（`MERGED_REQUIREMENT` / `CLAUDE_MERGED_REVIEW` / `CLAUDE_STANDARD` / `CLAUDE_INDEPENDENT_ANALYSIS` / `CODEX_INDEPENDENT_ANALYSIS` / `IMPLEMENTATION_DESIGN` / `DESIGN_AUTHORIZATION`）：**相符 7 / 不符 0 / 缺失 0**。

### 1.2 第 4 项要求的独立复算 —— **Codex 对，我先前错**

| 口径 | 复算值 | 判定 |
|---|---|---|
| checked-in production Java | **571** | ✓ |
| entry inventory anchor 覆盖 | **128** | ✓ |
| 盲区 | **443（77.58%）** | ✓ |
| 第 129 条 anchor | 指向 `build/generated/sources/…/BackendPerformanceM1CommandExecutionBindings.java` | ✓ 确为 generated，不得计入 checked-in 分母 |
| compiled main 口径（含 generated） | **616** | ✓ |

**我在 2026-08-12 标准文档中写的 129 / 442 是错的**：我对生产源集合过滤了 `build/`，却未对从 registry 抽取的路径同样过滤。设计 §7.1 的 128 / 443 与 616 / 129 / 487 双口径表述**正确且更严谨**，采纳。该更正已记录于本节，避免下游继续引用旧数。

### 1.3 其余现状事实

| 声明 | 复算 |
|---|---|
| `operation-handler-bindings` 当前 digest 漂移 | 实跑确为 `BP_U02_ROUTE_SOURCE_DIGEST_DRIFT` ✓ |
| P4 台账 28 rows / 52 cases | ✓ |
| 19 类 / 118 test sources | ✓ |
| `scripts/test/backend-acceptance` 尚不存在 | ✓ |
| `tools/backend-acceptance/`、`backend-acceptance-*.json` 尚不存在 | ✓ |

**诚实性通过**：`NOT_IMPLEMENTED_DESIGN_ONLY` 属实，无任何产物先行存在，无任何动态或性能成功声明。

### 1.4 落点复验

| 落点 | 状态 |
|---|---|
| `routing-vocabulary.json` 登记 `backend-acceptance` | ✓ `taskKinds[8]` |
| **「后台性能测试」与「后台功能测试」同 alias 到 `backend-acceptance`** | ✓ **「不分家」已落到机器层，这是本轮最关键的落点** |
| `196` / `P4` 在词表中 | 0 命中 ✓ |
| `cs-managed-runtime-execution` 中「BPF 196 selector 是独立性能契约」矛盾 | **已清除** ✓；`@Testcontainers` 类枚举式发现亦已移除 |
| package-input `sourceComplianceDenominators` 带 `capturedAt` | ✓ 我在 per-edit 门 review 提的 N-01 已被采纳 |

---

## 2. 逐项核验九个重点

| # | 要求 | 判定 | 依据 |
|---|---|---|---|
| 1 | row exact equality 与 digest freshness 分别校验；新 operation 第一天 fail closed | **通过** | §5.2 算法第 3、4 步分离；§3.4 新 operation 不在 entry snapshot → `UNCOVERED_OPERATION` |
| 2 | P0/W0/O0 不可变；P1 独立扫 P0∪P1；拒绝同包重生成 inventory 自准入 | **通过** | §7.1 `D = changed(P0 ∪ P1)`；「同包更新 inventory 不得扩大 W0」；matrix `ENTRY_ANCHOR_SET_IMMUTABLE`、`PRODUCTION_SURFACE_DELTA_INCOMPLETE` |
| 3 | production surface 自动派生；未锚定变化提升 ALL | **通过（但见 M-02）** | §7.1 从 Gradle main / task / generator inputs 派生，明确否决手写清单；generated 产物由其 task input 触发 ALL |
| 4 | 571 / 128 / 443 | **通过** | §1.2 |
| 5 | 四维一致且完全排除时延、percentile、seed 性能基线 | **通过** | §0.3、§8.2 明确不引入时延采样；§3.3 首值来自 fresh route measurement，不继承 P4 |
| 6 | lane 可配置、独立可写 namespace、首败只停本 lane、admission 早于容器 | **通过** | §6.3 最小 1 无固定 3；§6.2 `ADMISSION_COMPLETED_AT` 早于 `CONTAINER_INITIALIZATION_STARTED_AT`；§6.4 parent 待全部 lane 终态 |
| 7 | BUG_FIX 前红后绿；route/schema/error 联动 consumerFace | **部分通过** | §7.3 绑定 pre/post byte hash + 同 fixture/scenario ✓；consumerFace 见 S-02 |
| 8 | BA-U01→U06 连续链、每节点最多两轮 self-review、U06 前后两次 full | **通过** | §9.4 状态机与 Dexter 裁定逐字一致；`I6 不能充抵 I8` 的理由（退役改变 runner 字节）成立 |
| 9 | 20 类 mutation 调用真实 production validator | **部分通过** | 20 族齐备且覆盖 row-equal/digest-stale、KNOWN_UNCOVERED 新增、W0 自准入、BUG_FIX 双绿、consumer 缺失、lane 共用写空间 ✓；**缺计量自证族，见 M-01** |

另外两处设计亮点，值得保留：

- §6.2 `bootstrapOperation` 由**规范序取第一条**，不由实施者主观挑选，且直接进入 U05 迁移分母、禁止造一次性假 endpoint——这条消除了「挑个最容易的接口证明能力可用」的空转风险；
- §3.2 `correctnessCases` 与 `correctnessCasesEmptyReason` 的 XOR 约束，精确落地了我在合并稿 review S-04 的裁定。

---

## 3. Findings

### M-01｜计量 sink 无自证能力，叠加「下降直接接受」，性能维度可能从第一天起静默为空

- **严重度**：M　**状态**：CONFIRMED　**是否阻断**：是
- **owning source**：
  - 设计 §3.3（`doc/plans/platform/2026-08-13-…-codex.md:126`）：「**下降直接接受**；上升只有明确批准 history entry 才可接受」
  - 设计 §3.3（`:125`）：「首次值来自 **fresh route measurement**，不继承 P4 数字」
  - 设计 §6.1（`:208`）：在 `DatabaseOperationTracker` / `HttpRequestMetricsInterceptor` 旁**新增 test-visible in-JVM sink，production 默认 no-op**
  - manifest `BA-U03.changeSurfaces`：`DatabaseOperationTracker.java` = `update`，`HttpRequestMetricsInterceptor.java` = `update`
  - Red-mutation matrix（`:433-454`）：20 族**无任何一族证明 sink 真的在计数**
- **仓内事实**：在设计与 manifest 全文检索「校准 / calibrat / under-count / 漏计 / SINK」，命中 **0**。performance 族的唯一 mutation 是「超 accepted → FAIL」，**只测超出方向**。
- **失效链（三步都在本设计内）**：
  1. BA-U03 新建并接线 sink，且要修改生产计量代码；
  2. BA-U05 **用这个尚未被任何红控制验证过的 sink 建立全部首次 baseline**；
  3. §3.3 规定下降自动接受。
- **后果**：若 sink 少计（例如 correlation 绑定在某类请求路径上丢失、CONNECTION 未纳入、异步借用未归因），**baseline 从出生起就偏低**，此后所有 operation 永远 PASS，且下降永不触发审查。**本program 存在的唯一理由——DBCR 那次 `QUERY 1870→1870 不变而 CONNECTION 561→1309`——在这条链上将不可检出。**
- **反例**：把 sink 改成对 CONNECTION 恒返回 0。当前 20 族 mutation **无一会红**：不超 accepted（performance 族不触发）、无 disposition 缺失（impact 族不触发）、四维仍有 receipt（behavior-unchanged 族不触发）。这正是 manifest Part 0.1 所列的假绿形态。
- **根因**：把「计量正确」当作前提而非被证明对象；而本设计恰恰要修改计量代码。
- **最小修复（便宜）**：
  1. 增加一条 **known-cost 校准 scenario**：fixture 产生**独立可推算**的确定性 DB 操作数（如 N 次 insert + M 次 select），对 `LOGICAL_SQL / QUERY / UPDATE / CONNECTION / TRANSACTION` 逐项 **exact** 断言，且该期望值**由 fixture 定义推导，不由测量结果回填**；
  2. 增加第 21 族 red mutation：把 sink 置为 no-op 或摘掉任一 metric → 必须以稳定错误码红（建议 `MEASUREMENT_SINK_INTEGRITY_FAILED`）；
  3. §3.3 的「下降直接接受」限定为**在校准 scenario 当轮 PASS 的前提下**才成立。
- **需 Dexter 裁决**：否。

### M-02｜fail-safe ALL 将在 77.6% 的改动上触发，per-edit 的时间模型建立在 22.4% 的例外之上

- **严重度**：M　**状态**：CONFIRMED　**是否阻断**：是
- **owning source**：设计 §6.3（`:233`）「per-edit impacted subset 工程目标 `<=10m`；若 fail-safe 推导 ALL，自动升级 full mode，绝不缩面」；§6.3（`:234`）「package-exit 工程目标 `<=30m`」
- **仓内事实（本会话独立复算，按模块分布）**：

| 区域 | 生产源 | 已锚定 | 盲区 | 改动即触发 ALL |
|---|---|---|---|---|
| app-root | 399 | 96 | 303 | 75.9% |
| modules/organization | 41 | 6 | 35 | 85.4% |
| modules/workspace-iam | 34 | 11 | 23 | 67.6% |
| modules/workspace | 18 | 3 | 15 | 83.3% |
| **modules/foundation** | 15 | **0** | 15 | **100%** |
| **modules/audit-model** | 9 | **0** | 9 | **100%** |
| **modules/execution-context** | 9 | **0** | 9 | **100%** |
| modules/extension | 8 | 1 | 7 | 87.5% |
| modules/platform-admin-iam | 7 | 1 | 6 | 85.7% |
| 其余模块 | — | — | — | 66.7%–75.0% |
| **合计** | **571** | **128** | **443** | **77.58%** |

  anchor 只锚在 `edge` / `adapter` / `transaction` / `ownerBoundary` 四类 operation 专属位置，因此**日常最常改的 domain / service / repository / 配置代码几乎全部落在 W0 之外**。

**更正（2026-08-13，第二轮复核）**：本节初稿写「**每一个模块的盲区都 ≥ 66.7%**」，**该全称断言错误**——`modules/audit-read` 生产源 2、锚定 2、**盲区 0**，是唯一例外。本节表头「改动即触发 ALL」也应读作**静态文件占比**，不是观测到的提交频率；初稿正文「会在 77.6% 的**改动**上触发」把文件份额说成了变更频率。两处均由 Codex 在整改 intake 中指出，判定 `PARTIALLY_CONFIRMED` 正确。**571 / 128 / 443 / 77.58% 与 M-02 的结论不受影响**，仅论证依据按此更正。
- **推论**：`impacted = ALL` 是**常态**而非兜底；per-edit 将以压倒性概率走 full mode。设计把 `<=10m` 写成 per-edit 路径、`<=30m` 写成 package-exit 路径，**实际结果是绝大多数单次编辑要等 full mode**。
- **为何是 M 而不是 S（初衷判据）**：Dexter 的原话是「**又快又准**能发现问题」。fail-safe ALL 保住了「准」，但按当前时间模型，「快」在 77.6% 的场景下不成立。一个每次编辑都要跑 full 的门，在一人快速迭代阶段的可预见结局是**被绕过**——那就退回到今天「有门但没人信」的状态，等于本 program 白做。**这是自洽但偏离初衷的典型形态，按 CLAUDE.md 属 finding。**
- **反例**：修改 `modules/foundation` 下任一文件（该模块 anchor 覆盖为 0，且 `DatabaseOperationTracker` 就在其中——**BA-U03 自己就要改它**）→ 必然 ALL → per-edit 升级 full。也就是说，本设计的实施过程本身就会持续命中该路径。
- **根因**：把 ALL 的**正确性**（对的）与 ALL 的**发生频率**（未评估）混为一谈，因而按「subset 是常态」设定时间目标。
- **最小修复（便宜，且与 Dexter「加并行不砍覆盖」的裁定一致）**：
  1. 在设计中**显式写明** ALL 是常态（附本表分布），不再把 `<=10m` 表述为 per-edit 的正常路径；
  2. **lane 数按「full mode 满足 per-edit 时间预期」反推**，而不是按 `<=30m` 的 package-exit 目标设定；resource manifest 需给出达成该时间所需的最小 lane 数；
  3. 保留「绝不缩面」不变——**提速只允许来自并行，不允许来自缩小影响面**。
  4. 可选、不阻断：若日后要真正缩小 ALL 频率，唯一正当路径是**提高 anchor 覆盖率**（128/571），而非增加豁免；建议将覆盖率作为登记欠账而非本包范围。
- **需 Dexter 裁决**：否（他已裁定"提速首选加并行 lane，任何情况下不砍覆盖面"，本修复即该裁定的具体化）。

### S-01｜`owner` → provider 路径的派生规则未定义，36/196 个 operation 无法机械落地

- **严重度**：S　**状态**：CONFIRMED
- **owning source**：设计 §8.1（`:335-337`）「由 current operation identity 的 `owner` 字段**机械生成**逐 operation provider path 与 class symbol」「实施 agent **不得**按聊天、旧 196 行号或测试类名**猜 owner**」；manifest `BA-U05.changeSurfaces` 的 `DERIVED_FROM_CURRENT_OPERATION_OWNER_ROWS`
- **仓内事实**：`owner` 取值与模块目录名**不是 1:1**——

| owner 取值 | operation 数 | 同名模块目录 |
|---|---|---|
| `platform-iam` | 16 | ✗（实际模块为 `platform-admin-iam`） |
| `contract` | 10 | ✗（实际模块为 `store-contract`） |
| `platform-workspace` | 7 | ✗（`workspace` 与 `workspace-iam` 二选一，无判据） |
| `platform-asset` | 3 | ✗（实际模块为 `asset`） |
| 其余 7 个取值 | 160 | ✓ |

  **合计 36 条（18.4%）无法由 owner 字段机械派生出模块路径。**
- **反例**：`platform-workspace` 同时存在 `modules/workspace` 与 `modules/workspace-iam` 两个候选，设计未给判据。实施 agent 只有两条路：猜（被 §8.1 明文禁止），或停下来问（破坏 §9.4 的连续实施链）。**两条都与设计自身要求冲突。**
- **根因**：把「owner 字段存在」当成了「路径可派生」。
- **最小修复**：在 `contracts/policy/backend-acceptance-execution-contract.json`（BA-U01 已规划创建）中固化 **owner → 模块根**的显式映射表，覆盖当前 11 个取值；**未登记 owner 一律 fail-closed**，稳定错误码建议 `BACKEND_ACCEPTANCE_OWNER_MODULE_UNMAPPED`。映射表为封闭集，新增 owner 需显式登记。
- **需 Dexter 裁决**：否（纯机械映射，无产品语义）。

### S-02｜`consumerFace` disposition 只声明存在性，未定义行 schema，存在退化为自由文本的风险

- **严重度**：S　**状态**：CONFIRMED
- **owning source**：设计 §7.2（`:294-295`）「shape/error/route 变化额外逐 `consumerFace` disposition。集合必须与 impacted operation、changed consumer faces 双向相等」；matrix `CONSUMER_FACE_DISPOSITION_MISSING`
- **事实**：operation disposition 有三个**枚举值**并各自规定必需证据（`SCENARIO_UPDATED` 要 before/after digest + direction + sourceRef；`BEHAVIOR_UNCHANGED` 要 unchanged digest + fresh 四维 receipt）。**`consumerFace` disposition 没有任何枚举值、没有任何必需证据字段**，只有「必须存在且集合对平」。
- **反例**：写入 `{consumerFace: "operations-admin", note: "前端稍后处理"}` 即可满足「存在 + 双向相等」，`CONSUMER_FACE_DISPOSITION_MISSING` 不触发。这与本设计对 `BEHAVIOR_UNCHANGED` 精心避免的「自由文本逃生口」是**同一失效形态**，只是换了维度。
- **根因**：只规定了分母对平，未规定行内容。
- **最小修复**：枚举 consumer disposition 值并各自绑定必需证据，例如 `CONSUMER_CONTRACT_REGENERATED`（要 generated 契约 digest 变化）/ `CONSUMER_UNAFFECTED`（要 wire-level 兼容性依据：新增可选字段、非破坏性放宽）/ `CONSUMER_BREAKING_ACKNOWLEDGED`（要显式登记与去向）。**「稍后处理」不构成合法取值。**
- **需 Dexter 裁决**：否。

### N-01｜`DERIVED_FROM_CURRENT_OPERATION_OWNER_ROWS` 是占位符，在 S-01 修复前 BA-U05 的 allowed surface 未闭合

- **严重度**：N　**状态**：CONFIRMED　**是否阻断**：否
- manifest `BA-U05.changeSurfaces` 中该条不是路径，而是「entry 时机械物化」的承诺。设计 §1.2 要求「allowed surfaces 覆盖全部单批 surface」。延迟物化本身**可接受**（确切文件表依赖 entry snapshot），但其物化规则即 S-01 所缺。**S-01 修复后本条自动闭合**，无需单独处理。
- 顺带确认：该条 target 写的是「**module-owned** provider files」，即设计意图是 provider 落在 owner 模块而非集中在 `app/acceptance/`。这与 Dexter「每个包的测试天然包含」的初衷一致，**方向正确**；只是落地规则缺失。请在 S-01 的映射表中一并把 provider 根固定为 owner 模块的 test 树，避免物化时退化为集中放置。

### N-02｜我方 2026-08-12 标准文档中的 129 / 442 为错值（自我更正）

`doc/review/platform/2026-08-12-v2s-backend-acceptance-standard-and-landing-points-claude.md` §4.2 与我的项目记忆条目写的是 129 / 442。正确值为 **128 / 443**，差异源于第 129 条 anchor 指向 `build/generated/sources/` 下的生成物。设计 §7.1 的表述正确。记录于此避免下游继续引用旧数；该文档与记忆条目需据此更正。

---

## 4. 方案合理性判断（按 Dexter 指示，以初衷为尺）

| 初衷 | 判定 | 说明 |
|---|---|---|
| 只剩一类后台测试，功能性能不分家 | **达成** | 四维同 correlation；术语层「后台性能测试」已 alias 到同一能力，无法再分裂 |
| 不要 196/197/198 这类编号模型 | **达成** | 分母从 semantic source 每次重算，禁止计数判定；命名、类名、报告 kind 均无编号；`app/acceptance/` package 名即能力名 |
| 每个包的测试天然包含 DB 性能 | **方向达成，落地规则缺失** | provider 声明为 module-owned（正确），但派生规则缺失（S-01 / N-01） |
| seed 只供 DEV 数据 | **达成** | §0.2、§9.2 明确；不引入 test seed |
| 又快又准 | **准达成，快未达成** | **M-02** |
| 一键执行、前期准备/监控/报错/查错 | **达成** | 单一公共入口；admission 早于容器；30 秒心跳；固定证据根；稳定错误码族齐备 |
| 并行、资源不必顾虑 | **达成** | lane 最小 1、无固定上限、全链参数化、首败不牵连兄弟 lane |
| 设计阶段必须带测试用例 | **达成** | BA-U01 的 `backendOperationImpact` + scenarioContracts 强制 |
| 改 BUG 必须调整用例 | **达成** | §7.3 前红后绿 + 封闭清单 + `UNPROTECTED_FIX` 显式登记 |
| 其他后台测试下线删除 | **达成** | §9.2 逐条 disposition；保留编译/OpenAPI/ArchUnit/源码机械门（职责不同，正确） |
| 便宜 | **基本达成** | 复用既有 remote lane 基建、既有计量、既有 inventory；无时延平台、无 test seed。主要成本是逐 operation 六字段，属需求固有、不可自动生成 |

**UI 与交互**：`NOT_APPLICABLE`。本设计为后台工程能力，不引入、不修改任何用户可见界面或 Journey 操作，设计已正确声明 `userVisibleJourney: NOT_APPLICABLE_BACKEND_ENGINEERING_CAPABILITY`。

---

## 5. 收口条件

两条 M 与两条 S 修复后可直接转 **GO**，不需要重开 DESIGN cycle、不需要更换 reviewer、不需要重置 hash：

1. M-01：加 known-cost 校准 scenario + 第 21 族 red mutation + 限定「下降直接接受」的前提；
2. M-02：设计中写明 ALL 是常态（附模块分布表），lane 数按 full mode 满足 per-edit 预期反推，保留「绝不缩面」；
3. S-01：固化 owner → 模块根显式映射表，未登记 fail-closed，并把 provider 根钉在 owner 模块 test 树；
4. S-02：枚举 consumer disposition 值并绑定必需证据。

四条均在 Codex 既有批准边界内可自主修复，**无需 Dexter 产品裁决**。

---

## 6. 授权边界

- 本结论仅为**静态 implementation-facing DESIGN review**，覆盖详设、granularity manifest、package input、design authorization、decision、project memory 与四个 skill 落点。
- **本 review 不授权实施、不授权任何动态运行**。设计包当前未实施、未运行任何动态环境，我亦未运行。
- 未执行也未授权 Testcontainers、DEV、L2、reset、seed、浏览器、UAT、部署、手工 SQL 或 Git。
- 本 `NO-GO` 不构成对 `backend-acceptance` 方向的否定；四项修复完成后即具备 GO 条件，届时按 Dexter 已记录的条件授权激活单一 implementation package，连续完成 BA-U01→U06，再交唯一一次外部 IMPLEMENTATION review。
- 静态 review 结论不代表任何动态、业务、performance 或 cleanup 成功。
