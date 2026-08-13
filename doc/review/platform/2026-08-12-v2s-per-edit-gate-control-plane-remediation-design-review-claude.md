# per-edit 门控制面自锁整改详设评审（Claude 独立 DESIGN review）

- 结论：**GO**　**M=0　S=1　N=1**
- 评审对象：`doc/plans/platform/2026-08-12-v2s-per-edit-gate-control-plane-remediation-implementation-design-codex.md`（275 行，`ceb4b5e7cf470175…`）
- 权威需求：`doc/review/platform/2026-08-12-v2s-per-edit-gate-deadlock-remediation-requirements-claude.md`
- 会话出处：fresh v2s-rooted 会话，本文件为唯一写入。未运行 Testcontainers / DEV / L2 / reset / seed / 浏览器；仅执行只读检索与两条只读 `compliance-control` 命令。
- 亲验声明：不采信详设任何自报数字。六 archetype 集合、映射命令的存在性与可执行位、self-test 路径、分母条数均由我独立重算。

---

## 1. 四层根因的闭合判断

### P0 · 首次 exact bridge 与 durable bootstrap —— **闭合**

| 核验点 | 结果 |
|---|---|
| 鸡生蛋是否被诚实承认 | ✓ §3.1 明写"不存在完全由当前控制面内部安装其自身逃生口的方案"，且要求写进实施证据、**不得伪装为普通 package edit** |
| 是否不可再缩小 | ✓ **恰好两个 target**：closure（只同步 command hash）+ active package（激活唯一 control-plane 包）。少一个都解不开：不修 closure 则 `readActivePackage` 仍失败；不换 package 则无面可写 |
| 请求生成位置 | ✓ 仓外 `mktemp -d`——正确，因为仓库当前锁死时不能假设 request 写得进去 |
| 写入顺序与崩溃窗口 | ✓ **先 closure 后 active package**。我复核该推理成立：closure 修好后旧 active package（archetype `backend-source`，在六项之内）会**重新有效**，崩溃窗口只会回到旧的窄允许面，**不会扩大** |
| 是否可恢复 | ✓ 校验失败在**零写入**状态失败；replay 同一 request、覆盖已有 receipt 必红 |
| durable bootstrap 是否在健康时 fail-closed | ✓ §3.3 "hook 只在 `readActivePackage()` **精确失败为** `ACTIVE_PACKAGE_MANDATORY_PER_EDIT_GATE_INVALID` 时"才允许；健康、其他结构错误、普通源码写入、额外 argv 一律拒绝；§3.4 "active package 健康时调用必红" |
| 是否避免循环校验 | ✓ **"不得调用当前失败的 `mandatoryGateProfiles(root)`"**——这一条是关键，否则逃生口会撞它要逃的那个门 |
| 信任边界是否诚实 | ✓ "durable bootstrap 本身是纪律边界，不是抗特权攻击的安全边界" |

**未与既有 recovery 混淆**：§7.3 明确 `recover-active-package` 继续处理普通 malformed package、**不承担 mandatory gate hash drift**。这一点重要——我复核过既有 recovery 的 target 经 `validateActivePackageShape`（`cli.mjs:1249`）内部仍校验 mandatory gate，复用它会撞同一失败。

### P1 · 独立 ledger、结构化 FAIL、全 exit mode —— **闭合**

| 核验点 | 结果 |
|---|---|
| 分母是否 deltaState 派生 | ✓ §4.1 明写"changed-path 分母始终来自 `deltaState(root).changed`，**绝不从 receipt 或 ledger 反推**"——正是我需求 §4.1 要治的循环分母 |
| 删除 / 编辑 FAIL receipt 是否真红 | ✓ ledger 为 atomic no-replace 单事件文件 + `previousEntryHash`/`entryHash`/`head.json` 链；exit 第 4 步要求每个 POST 引用的 receipt 存在且 hash 相等 |
| trim 绕过是否堵住 | ✓ §4.3 normal 与 `TRIM_OBSERVATION_PATH_LIST_ONLY` **共用同一前置 validator**，七步顺序固定，业务字段校验排在最后 |
| 是否恢复退役机制 | ✓ 双重声明：§4.3"不以任何形式恢复退役的 `afterSha256AndReceiptExactSet`"；§7.3 retain 该退役标记 |
| 是否避免逐条覆盖逻辑 | ✓ "历史 FAIL 不要求被后续 PASS 覆盖……**最终态 gate 才决定能否发布**"——与我需求 §7.1 一致，避开了难写对且易被绕过的 supersession 判定 |
| FAIL receipt 结构 | ✓ 固定 key（`profileId` / `command` / `errorCode` / `exitStatus` / `signal` / `stdoutExcerpt` / `stderrExcerpt`），非 gate 失败保留同名 key 为 null；redaction 清单具体（secret/token/cookie/Authorization/手机号/登录名/IP/raw payload），UTF-8 2048 bytes 截断，`errorCode` 不含动态输出 |
| 覆盖面 | ✓ **"一旦 hookPost 已成功读取合法 pre 且确认 exact paths，之后任何 terminal failure"** 都写 FAIL——不止 mandatory gate 失败一种，闭合我需求 §4.6 的缺口 |
| 信任边界 | ✓ "全部锚点都在 `.runtime`，不承诺抵抗拥有仓库写权限的恶意一致重写。这是纪律/事故边界，不是安全边界" |

### P2 · 六 archetype exact partition —— **闭合**

**我独立复算**：`contracts/policy/mandatory-per-edit-gate-command-closure.json` 现有 `compatiblePackageArchetypes` 恰为设计所列六项（`backend-performance-static` / `backend-source` / `control-plane` / `design-only` / `frontend-source` / `runner-evidence`），当前 `profiles` 仅 1 条。

| 核验点 | 结果 |
|---|---|
| 是否第二套事实 | ✓ **升级既有 closure，不新建平行 catalog**；三个新增 adapter"只能调用上表已有 owning checker/CLI，输出所调用控制的真实 marker"，且 adapter 自身有漏调用/假 marker 红变异 |
| 映射是否相关 | ✓ 逐项检查合理：`backend-source`→`backend-boundaries`、`frontend-source`→`frontend-architecture`、`backend-performance-static` 保留 SQL merge gate。**我核过这三个命令均存在且有可执行位** |
| 新增命令 | ✓ `per-edit-control-plane` / `per-edit-design-context` / `per-edit-runner-evidence` **均不存在**，与"新增"声明一致 |
| 一对一 | ✓ 单值 `packageArchetype`，删除多对多数组；validator 先对六项全集 exact equality，再验每 archetype 恰一 profile |
| final exit 新鲜重跑 | ✓ 同一 `runMandatoryPerEditGate(root, packageState, {phase:"FINAL_EXIT"})`，receipt 记 `executionPhase`，**"不能接受旧 PASS"** |
| 顺序安全 | ✓ **旧兼容数组的删除与新 schema 在同一原子 edit 内完成，"不出现无人看守窗口"**——闭合我需求 §5.4 |

### P3 · source-anchor 有限 disposition 与加法优先 —— **闭合**

| 核验点 | 结果 |
|---|---|
| 分母有限可复算 | ✓ 对进入 P2 时 hash-bound 的 gate 建 ledger；分母定义明确（直接读 production `.java/.ts/.mjs` bytes 后用 `includes`/regex/固定 signature 判断实现写法的条件），**排除 JSON/OpenAPI 结构化字段检查与 self-test 的错误码检查**；checker 双向 exact，少项/虚报/`PENDING` 必红 |
| 三分法是否会误删实现纪律 | ✓ **`RETAIN_SOURCE_DISCIPLINE` 显式点名 canonicalJson family**："跨 owner canonicalJson 消费必须 `readTree → data object assertion → typed treeToValue` 且不接受空值……保留源码锚点和真变异，**承认其重构脆性；不得为整洁而删除**"，并规定它**默认**进入该类，除非先存在等价行为测试并证明同族全覆盖 |
| 是否防信任转移 | ✓ **"generator 与其单一输出不算双源"**——正是我需求 §6 的双源对账要求 |
| 加法优先 | ✓ 逐项严格顺序 `freeze denominator → add replacement → mutate independent source/behavior → observe exact red code → remove old anchor → rerun green`；先删锚点、单源自证、删 retained discipline 均必红 |

---

## 2. 其余核验

- **文件面**：`create` / `update` / `retain` / `delete` 四分，**`delete` 不预先批准删除任何生产/测试/fixture/历史 receipt 文件**，P3 只允许删已闭合且验红的旧文本断言语句。**禁止目录通配**。
- **六类 exit 分母**：详设 §8 与 manifest `sourceComplianceDenominators` **逐条一一对应**（`AUTHORITY_REQUIREMENT` / `BOOTSTRAP_CONTROL_SURFACE` / `ENTRY_LEDGER_RECEIPT` / `ARCHETYPE_PROFILE_PARTITION` / `SOURCE_ANCHOR_DISPOSITION` / `PREVENTION_AND_HANDOFF`），任一缺 source/hash/anchor/owner/disposition/red proof 或出现 `PENDING` 即 exit fail-closed。
- **串行顺序**：五个 unit `PEG-CP-U01…U05`，明确"`cli.mjs`、closure、active package、SQL gate、ledger/exit validator 是共享控制根，必须由主 agent 串行落地并逐点回读"，且**不得把四个阶段拆为四次设计或四次外部 review**。
- **治理**：`implementationAuthority: false`（详设 frontmatter 与 manifest 双处）；`reviewException` 显式记录 Dexter 的对抗审查豁免并声明 `doesNotGrantImplementationAuthority`；**未伪造 subagent verdict**。
- **§11 禁止伪修复清单**：八条，逐条对应真实退化路径（只改 hash、只扩 surface、永久关 hook、FAIL 不落 receipt、从 receipt 反推分母、trim 提前 PASS、恢复退役机制、复用旧 final receipt、先删锚点、以 static PASS 宣称动态成功）。这一节质量很高。

---

## 3. Findings

### S-01｜§7.2 update 列表含两个不存在的文件路径

- **owning source**：`doc/plans/platform/2026-08-12-v2s-per-edit-gate-control-plane-remediation-implementation-design-codex.md` §7.2
- **事实**：`scripts/check/mandatory-per-edit-gate-self-test` 与 `scripts/check/active-package-recovery-self-test` **均不存在**；我在 `scripts/`、`contracts/` 下全量检索**零引用**。二者实为 `tools/compliance-control/cli.mjs` 的**子命令**（我实测 `node tools/compliance-control/cli.mjs mandatory-per-edit-gate-self-test` 可运行并输出 `MANDATORY_PER_EDIT_GATE_SELF_TEST=PASS`）。设计中"（若为 wrapper 则保持 wrapper）"的对冲措辞显示作者对此不确定。
- **影响 unit / 分母**：`PEG-CP-U01`（P0-B1 的 active package exact surface）与 `PREVENTION_AND_HANDOFF` 分母。
- **根因**：把 CLI 子命令当成了独立脚本文件。
- **为什么这在本设计里不是小事**：P0 的全部安全性建立在"**逐文件 exact list、禁止目录通配**"（§3.2）与"少/多/替换任一 target 必红"（§3.4）之上。允许面里若含两条**永不存在**的路径，exact-set 断言要么必然失败、要么被迫放宽——而放宽正是 §11 第一条禁止的形态。
- **反例**：实施者按 §7.2 去找这两个文件，找不到，于是**新建**两个 `scripts/check/*` wrapper。这就凭空多出两个入口，且与"三个新增 adapter"的清单不符，`BOOTSTRAP_CONTROL_SURFACE` 分母对不上。
- **最小修复**：§7.2 删除这两条路径；改写为「两个 self-test 是 `tools/compliance-control/cli.mjs` 的子命令，其变更已由该文件的 update 覆盖」。若确需 production current-state health check 有独立 `scripts/check/*` 入口，则它属于 **`create`** 而非 `update`，并须逐条列入 active package exact surface 与 `BOOTSTRAP_CONTROL_SURFACE` 分母。
- **是否需 Dexter 产品裁决**：否。

### N-01｜P0-B0 的外部执行者未定名

§3.2 规定了 request 的生成位置、绑定内容、校验顺序与失败语义，但**未指明"外部 bridge"由什么执行**——一次性脚本、手工命令序列，还是 CLI 的特殊分支（若是后者则又回到锁死的仓内）。

考虑到这是**仅此一次的外部 trust anchor**，其执行形态直接决定可审计性。建议在实施前补一句：执行者形态、其字节是否需在事后连同 request 一并归档、以及它**不得**留在仓内成为常驻入口。

**是否需 Dexter 产品裁决**：否，属实施细节，但应在 P0 开始前定死。

---

## 4. 方案合理性

- **问题对不对**：对。四层根因与权威需求的 P0–P3 逐项对应，无夹带。
- **方案优不优**：优。三处判断我认为高于我需求所要求的水准——**closure 先写的崩溃窗口分析**（回到旧窄面而非扩大）、**"不得调用当前失败的 `mandatoryGateProfiles`"**（避免逃生口撞它要逃的门）、**兼容数组删除与新 schema 同一原子 edit**（消除无人看守窗口）。
- **代价配不配**：配。P2 复用既有 closure 与既有 checker，只加三个薄 adapter；P1 的 ledger 是文件级 append，无新基建。
- **过度工程**：未见。P3 的三分法有明确入口规则且不代替逐行 ledger。
- **最大风险**：S-01 的文件面不精确落在 P0 的 exact surface 上，而 P0 的安全性正建立在 exact 之上。修复只需改两行。

---

## 5. 授权边界

- 本结论仅覆盖**静态 implementation-facing DESIGN**：详设、granularity manifest、design 授权记录，以及 `tools/compliance-control/cli.mjs`、`contracts/policy/mandatory-per-edit-gate-command-closure.json`、`scripts/check/backend-performance-sql-merge-coverage` 等 owning source 的只读核验。
- **GO 只表示可等待 Dexter 后续明确 implementation authority**，再以一个 package 按 P0→P1→P2→P3 串行实施。
- **不授权**当前实施、Testcontainers、DEV、L2、reset、seed、浏览器、UAT、部署或手工 SQL。
- **不代表**动态、业务、cleanup 或性能成功。
- `S-01` 与 `N-01` 均在 Codex 既有批准边界内可自主修复；**无需 Dexter 产品裁决项**。
