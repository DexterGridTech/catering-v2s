# Final managed lifecycle adapter design —— Claude 独立复核

`VERDICT=NO-GO`　`M=1`　`S=1`　`N=2`

**NO-GO 只卡一件事**：设计给动态准入定了一个前置条件 `afterSha256AndReceiptExactSet=PASS`，
而这个字段在当前程序级 exit 模式下被工具**硬性要求**为 `NOT_USED_RETIRED_BY_DEXTER_DECISION`，
于是它要么永远不成立、要么只能靠一句无据断言写出来。
修法是把断言改成机制能支持的强度（见 M-01），**不需要恢复任何已退役机制，也不需要 Dexter 裁决**。
其余核验项我逐条验过，绝大部分是扎实的。

## 0. 会话出处与写入边界

续接会话，非 fresh v2s-rooted acceptance。本仓零写入（除本文件）。
分母、hash、路由可解析性、工具语义均本会话独立复算，不采信自报值。

---

## 1. 你点名的六项核验

### 1.1 design / input 均为 `implementationAuthority: false` —— **通过**

| 位置 | 值 |
|---|---|
| design intake 正文第 3 行 | `implementationAuthority: false` |
| design-input（authority artifact） | `implementationAuthority: false`、`scope: design-only` |
| granularity manifest 顶层 | `implementationAuthority: False`、`status: PROPOSED_REVIEW_ONLY` |
| **当前 active package** | `implementationAuthority: False`　`runtimeAuthority: False`　`reviewTarget: DESIGN`　`businessStatus/cleanupStatus: NOT_RUN_DESIGN` |

最后一行是关键：**当前生效的包本身不授予任何实施或运行权限**，设计包没有偷渡权限。

### 1.2 dynamic 仅用 `minimalFixtureAuthority: true` —— **通过**

`final-dynamic-package-input.json` 实读：`minimalFixtureAuthority: true`、`resetAuthority: false`、
`runtimeAuthority: true`（这是动态包的本分），**`minimalSeedAuthority` 已彻底移除**（Round 2 M-01 的修复点）。
`forbidden` 闭集为 unmanaged runtime / reset / browser L2 / UAT / deployment / historic snapshot reuse。
该包**当前未激活**（active 是 DESIGN 包），所以今天不授予任何运行权。

其 `denominators` 我逐项对照历轮已核验值：
78 / 5 / 79 / 38 / 196 / M1 126 / M2 60 / M3 25 / M6 11 —— **全部相符，零漂移**。

### 1.3 396 行 source/materializer/path/readback 闭合 —— **分母与路由部分通过**

**我没有采信 396，而是从三个源注册表独立重算**：

| area | 来源 | 我的复算 |
|---|---|---:|
| `U05_TASK_READ` | `task-read-surface-policy.json` 中 `disposition=TASK_READ` | **78** |
| `U05_PROTOCOL` | 同上 `PROTOCOL_READ_EXEMPT` | **5** |
| `U04_NUMERIC` | `performance-refactor-command-baselines.json#numericBaselines` | **79** |
| `U04_CONTEXT_PARITY` | 同上 `#contextParity` | **38** |
| `U07_ROUTE` | `backend-performance-sql-merge-applicability.json#operationApplicability` | **196** |
| | **合计** | **396** |

再验路由可解析性：两个生成路由注册表 **154 + 42 = 196** 条，
**396 条 recipe 的 operationId 全部能解析到带 `method` + `path` 的真实路由，零未解析。**
（我第一次统计只得到 42，是我自己漏了 `edge-route-face-registry` 的 `operations` 嵌套；已修正。）

`materializer` / `prerequisiteReadback` 部分**尚不可验证**——catalog 是 create surface，文件不存在。
设计对每行的约定是 `sourceAnchor`（`path#exportedProcedure` + 源码 hash）、闭集 `materializerKind`、
typed `pathParameters`、具名 `prerequisiteReadback`，并声明拒绝通用 materializer、anchor/hash 不符、
缺 CAS/replay/readback 前置、以及实际路径非由行模板产生。**约定写得足够可执行**，
但它是否真闭合只能在静态实施包落地后核验。

设计对"为什么必须有 catalog"的论证我认为是成立的、也是本设计最有价值的一段：
路由注册表只给 operation/method/path，**不给**合法实体 id、typed body、session、
replay/CAS 前驱、asset grant 与 owner readback；没有 catalog 就凑不出 396 次真实请求。

### 1.4 嵌套 Testcontainers 绑定 —— **通过**

设计要求 child manifest 绑定：**parent final-run id**、固定 allowlisted focused Gradle task、
**adapter-owned nested runtime path**、**已验证的 remote-host fingerprint**、
phase/heartbeat/log 证据，以及 **`business=PASS` 且 `cleanup=PASS`**；final admission 解析该 manifest。
红例四条齐备：默认 `.runtime/r5`、foreign parent、alternate task、child cleanup 失败。

边界也划清了：`r5-remote-testcontainers` **只作为嵌套 focused 命令被调用**，
不承担 final HTTP runner / fixture producer / snapshot provenance / browser-L2 evidence 任何角色。

### 1.5 不复用 RM1/R5 runtime、不引入 callback —— **通过**

sibling scan 三条处置我对着真实 runner 源码读了，处置理由站得住：
`r5-dev-runner` **no dependency**（持久 DEV + `r5-full` seed + 固定 R5 root，不是隔离 final run）；
`http-diagnostic-runner` **只抽取 identity/process/tunnel/remote-cleanup primitive**，
新模块 `managed-isolated-local-runtime` 的 profile allowlist 是闭集
（恰为 `rm1-http-diagnostic` 与 `backend-performance-final-acceptance`），
且明令不接受任意 shell text / host / SQL / command / root；
`r5-remote-testcontainers` 仅作嵌套技术证明。

`--run` 作为唯一公共入口，明令**不接受 callback、任意 run root、caller 指定 namespace、
凭据文件或 snapshot 路径**——正是把原来"七个 caller callback"那条路堵死。

### 1.6 POST_REMEDIATION_V1 没有增加 surface / 分母 / 运行权限 —— **通过**

16 条 surface 我逐条 stat：**create 8 条全部 absent、update 8 条全部 present，16/16 状态准确。**

hash 逐位复算：
round2 声明 `46cb52d5…` = 实际 `46cb52d5…` ✓；intake 声明 `87269919…` = 实际 `87269919…` ✓；
manifest 现字节 `12829abb…` ≠ round2 所审的 `c4327964…`——这正是 post-remediation 应有的形态，
且 `currentBytesNotReviewedByAdversarialReviewer: true`、`claudeRecheckRequired: true`、
`implementationAuthority: False` 都如实标注。

修复内容我核对为：design-input 补 `implementationAuthority: false` 顶层字段、
dynamic input 去掉 `minimalSeedAuthority` 只留 `minimalFixtureAuthority`、
delivery unit id 由 `FINAL-ADAPTER` 规范为 `FINAL-U01`。
**没有新增 delivery unit、surface、分母，也没有提升任何权限。**

`implementation-design-granularity` 复跑：**`PASS`**，
`REVIEW_ROUND=2`，`REVIEW_BINDING_MODE=DECLARED_POST_REMEDIATION_AWAITING_CLAUDE`，
`VERDICT=NO_GO`——**绑定的 Round 2 原始 NO_GO 被如实保留，没有被改写成 GO。**
Round 2 本身是 `INDEPENDENT_SUBAGENT`、`2/2`、`SELF_DECIDED`、`furtherCodexAdversarialRoundAllowed: false`。

---

## 2. Findings

### M-01｜动态准入的 `afterSha256AndReceiptExactSet=PASS` 在当前 exit 模式下无法诚实产出

**证据**。设计末节要求：`--run` 拒绝一切 active dynamic package，除非
`final-dynamic-admission.json` 绑定静态包 id、exit digest、**`afterSha256AndReceiptExactSet=PASS`**、
final implementation-manifest digest、review cycle id/Round 2/`SELF_DECIDED`/`GO`、
workload-policy digest、dynamic package id 与三个 authority 布尔值。

但 `tools/compliance-control/cli.mjs` 的 package-exit 校验有**两条互斥路径**：

- **trim-observation 模式**（`exitMode === "TRIM_OBSERVATION_PATH_LIST_ONLY"`）：
  只校验「声明的 changedPaths ⊆ 批准面」，并**硬性要求**
  `harnessTrimObservation.afterSha256AndReceiptExactSet` 恰为字面量
  `"NOT_USED_RETIRED_BY_DEXTER_DECISION"`，否则 `PACKAGE_EXIT_TRIM_OBSERVATION_INVALID`。
- **完整模式**（fall-through）：要求 `status=PASS`、`controls[]`、`fullComplianceScan=PASS`，
  并对批准面做 before/after sha256 快照差分，执行**双向集合相等**
  （`PACKAGE_EXIT_CHANGED_PATH_MISSING` 与 `UNAUTHORIZED_CHANGED_PATH`）。

**这才是 `afterSha256AndReceiptExactSet` 语义的真正来源。**
我统计了仓内各 package exit：**完整模式最后一次使用是 2026-07-27（cr00–cr06）；
2026-08-05 之后的 8 份全部是 trim 模式**，即该机制处于"按 Dexter 裁定退役"状态。

**后果**。静态 adapter 实施包若按近三个月惯例以 trim 模式收口，
`afterSha256AndReceiptExactSet` 必然是 `NOT_USED_RETIRED_BY_DEXTER_DECISION`，
于是 admission 记录里的 `PASS` **只有两种来源**：
① 该字段永远不为 PASS → `--run` 永久 fail-closed，最终动态验收走不到；
② 有人照写 `PASS` → 这是一条**没有对应核对的断言**，
即在 exit 明说"未启用"的前提下声称"已精确对账"。
第二种正是本设计自己要防的那类失真。

**设计对此完全沉默**——全文没有说静态实施包该用哪种 exit 模式。

**有限适用面**：动态准入这一步。不影响本设计其它部分，也不影响任何现有声称
（本包 design-only，无任何数值主张）。

**最小修复：把该字段改成 trim 模式能如实作证的东西**，例如
`changedPathsWithinApprovedSurface=PASS`，并在设计里写明它证明的是**子集关系而非集合相等**。
不新建机制，不改任何分母或 surface。

**为什么不推荐"恢复完整模式"**（我最初倾向它，经复核后改掉）。
完整模式里真正做对账的动作很便宜——把批准面在包开始与结束各哈希一次、双向比集合。
但它在同一段代码里被绑上了一整套附加断言：`exit.status=PASS`、
`controls[]` 每条 rule id 标 `ACTIVE_RED_VERIFIED`/`OUT_OF_SCOPE_THIS_PACKAGE`、
`fullComplianceScan=PASS`、RM1 execution binding 的 `deliveryManifestPath`+sha、
`requiredControlRuleIds`/`requiredStandardsRefs`/`requiredControlRefs` 三个数组、
`validateRM1P1OwnedSurfaceTrace`，P0 还要 `validateRM1P0ProductionStatus`。
且 `before` 快照必须在**包开始时**采（`snapshotActivePackage` 还要读 `hook-events`），事后补不出来。
**便宜的那半被绑在昂贵的那半上**——这正是该机制当初被 Dexter 以"80% 准备换 20% 产出"裁定退役的原因。
为一个包把整套请回来，与本仓"分钟级、零基建"的右尺寸标尺相悖。

第三条路（单独做一个不含 controls 那套的轻量 sha 集合相等断言）技术上可行，
但属新建机制，本轮不建议；如需更强保证可登记 `HANDOFF.md`。

**是否需要 Dexter 裁决**：**不需要**。
Dexter 已在本会话确认该机制正是他因"80% 准备、20% 产出"而移除的，
按上述最小修复走即可；本条只要求断言与机制强度一致，不要求恢复任何已退役机制。

### S-01｜独立 Round 2 的原件被作者转写覆盖，留存的 SHA 无法核验

**证据**：`…-design-review-round2.md` 现在装的是 **JSON**（作者转写），
其中带 `originalMarkdownTranscriptSha256: 7cc6220ff7427916b05263d310cca7679502519a78cdf34471194ee13579ea09`。
我全仓检索该 hash：**只出现在声明它的那个文件自己里**；
我又对 `doc` 下所有相关文件逐个复算 sha256，**没有任何文件命中该值**。
作为对照，Round 1 仍是货真价实的 Markdown。

**也就是说：独立审查者的 Round 2 原始产出已不可取回，留存的 hash 是一个无法被任何东西验证的承诺。**

**为什么是 S 不是 M**：实质似乎被保留了——verdict 仍是 `NO_GO`、两个 M 仍在、
`2/2` 与 `furtherCodexAdversarialRoundAllowed: false` 未动。
一个想造假的作者会把 NO_GO 写成 GO，而这里没有；转写反而保留了对作者不利的结论。
但可审计性没了，而"覆盖独立产出 + 留一个查不了的 hash"这个动作本身，
正是将来某轮可以不留痕地改动实质的形状。

**有限适用面**：本 cycle 的 Round 2 一份文件。不影响分母、surface 或任何权限。

**最小修复**：把原始 Markdown 以另一个文件名一并留存
（例如 `…-review-round2-original.md`），使声明的 SHA 可被复算；
JSON 转写继续作为 checker 面向的产物。今后转写一律"新增不覆盖"。

**是否需要 Dexter 裁决**：不需要。

### N-01｜`design-input.json` 不是 JSON，是全族 12 个里唯一一个

**证据**：该文件内容是 `---` + `key: value` 的 frontmatter 形式，`json.load` 直接报
`Expecting value: line 1 column 1`。同目录 2026-08-10 家族另外 11 个 `.json` **全部是合法 JSON**。

**但这不是笔误**：`tools/implementation-design-granularity/cli.mjs:437` 附近是把该文件当**文本**读，
正则匹配 `/^implementationAuthority:\s*false\s*$/m`。真 JSON 会写成
`"implementationAuthority": false,`（带引号与逗号），**反而匹配不上**。
所以内容格式是被门的契约倒逼出来的，是对的。

**问题只在扩展名**：一个叫 `.json` 却不能 `JSON.parse` 的文件是个陷阱，
任何后续工具（包括 compliance-control 的 `readJson`）碰它都会硬失败。

**最小修复**：把该 authority 文件改名为 `.md`；
更彻底的做法是让门同时接受 JSON 布尔字段，但那是程序级改动，
建议登记到 `HANDOFF.md` 而不是在本包做。

**是否需要 Dexter 裁决**：不需要。

### N-02｜退役词汇应改为"禁止出现"，而不是"必须等于某个字面量"（Dexter 提出，我复核成立）

**背景**：Dexter 在本会话问，既然 `afterSha256AndReceiptExactSet` 已按他的裁定退役，
这个断言能不能直接下线删掉。我复核后认为**可以删，但要换一种删法**。

**证据（三项，均本会话实查）**：

1. `tools/compliance-control/cli.mjs` **没有任何多余字段拒绝逻辑**——
   我检索 `Object.keys(exit)` / `additionalProperties` / `UNEXPECTED_FIELD`，零命中。
   所以若只是移除该校验，exit 文件里写 `afterSha256AndReceiptExactSet: "PASS"` 会被**静默忽略**，
   一句无人校验的假断言可以留在证据文件里。
   **现状反而是 fail-closed 的**：必须恰为退役字面量，写 `PASS` 会直接
   `PACKAGE_EXIT_TRIM_OBSERVATION_INVALID`。
2. 三个字段名出现在 34–36 个文件中，但**只有一个是代码**（该 cli），其余全是历史 exit 与文档。
3. **历史 exit 不会被重新校验**——`scripts/verify` 与 `scripts/check/*` 链上没有任何一处重跑它们。

**结论：删掉仪式，保留禁令。**
把「必须等于 `NOT_USED_RETIRED_BY_DEXTER_DECISION`」改为
**「这三个字段必须不存在」**（退役词汇检查）：

- 未来每份 exit 少写三行样板；
- **比现状更严**——现在只挡"写成别的值"，改完连"该字段出现"本身也挡住，伪造路径彻底消失；
- 迁移成本≈0（历史 exit 不重跑）；工具代码不增行。

`pathListRetained: true` 是纯仪式（恒为 true、零信息），一并删除。
"本次未做对账"这一事实由 `exitMode: "TRIM_OBSERVATION_PATH_LIST_ONLY"` 已完整表达，
不需要三个字面量再复述一遍。

**一个不好听但相关的证据**：墓碑并没有起到它应起的作用。
上一轮 clean-package 的交接语仍写成「51 条 changed path 与 hook receipt 已精确对账」，
墓碑就在文件里也没拦住——真正拦住的是打开文件读。
**墓碑的实际防护值很低，机器禁令才是有用的那部分。**

**与 M-01 的关系**：若按此退役，M-01 的修复从"建议"升为"必须"——
adapter 设计里的 `afterSha256AndReceiptExactSet=PASS` 会直接引用被禁词汇，
必须改成 `changedPathsWithinApprovedSurface=PASS`。两者方向一致，不冲突。

**范围建议**：这是 compliance 工具的程序级小改动，**不应塞进当前 design-only 的 adapter 包**
（会撑大其 surface）。建议单独一个小改动做掉，或先登记 `HANDOFF.md`。
按"分钟级、零基建、防回归"的尺子，我倾向直接做：约五行、零迁移，
且拆掉了一个已经误导过一次的陷阱。

**是否需要 Dexter 裁决**：不需要（退役本身已是他的裁定；本条只是把退役表达得更严）。

---

## 3. 方案合理性：这个包打得合不合理

你问这个包是否合理，我分三层答。

**问题定位对。** 设计说"当前 final runner 只接受七个 caller callback 并拒绝 `--run`，
这是**一个缺失的 lifecycle-adapter 家族，不是七个各自缺失的 callback**"——
这个归因是对的，也直接决定了不该去补七个回调而该补一个受管入口。
把静态单测当运行时证据这条歧路也被明确排除了。

**边界划得对。** 三个既有 runner 的处置各有具体理由，不是笼统的"不复用"：
R5 是持久 DEV + 固定 root，天然不是隔离 final run；
RM1 的 http-diagnostic 只抽 primitive 且新模块 profile allowlist 是闭集；
Testcontainers 降级为嵌套技术证明。**唯一公共入口 + 禁 callback + 禁任意 root/namespace/凭据/快照路径**，
把"手工编排绕过"这条路堵得比较严。fixture catalog 的必要性论证（路由表给不出实体 id/body/session/
CAS 前驱/asset grant/readback）是本设计最有价值的一段，我认同。

**代价这一层我原先提过一个拆包建议，经 Dexter 反驳后我收回，理由如下。**

我先前说"把 196 条路由完成度与 200 条性能测量拆成两包，性能数字能早很多落地"。
**这个说法站不住**：

- 整个 workload 是**一次执行**，396 条 fixture 必须在跑之前全部就位——
  拆包并不能让那 200 条先跑出来；
- 拆成两包等于多一轮设计 + 两轮独立盲审 + 一次 Claude 复核，**总开销更大而不是更小**；
- "一次设计、一次实施、一次 review，内部按顺序推进"正是这个包的价值，拆开反而破坏它。

我本想保留的残余顾虑是"全 396 成功才算数，一条命令 fixture 卡住就拿不到结论"。
查证后发现**设计已经处理**：`scripts/test/backend-performance-final-acceptance.mjs:124`
按 area 分别维护 `U05_TASK_READ` / `U05_PROTOCOL` / `U04_NUMERIC` / `U04_CONTEXT_PARITY` / `U07_ROUTE`
五个集合，失败时给出 area 与 operation 级的具名错误码
（`BP_FINAL_U05_TASK_FIXTURE_INVALID`、`BP_FINAL_U04_NUMERIC_FIXTURE_INVALID` 等），
不是笼统的 `business=FAIL`。卡住时能精确定位到哪一条，修完重跑即可。

**结论：396 一次打包是合理的，我不再对包的规模提异议。**
`business=PASS` 仍要求全 396 成功、快照也在其后才创建——这是保守但正确的取舍，
避免部分快照被误当作完整结果。

**UI 与交互**：`NOT_APPLICABLE`。本包只涉及 runner / adapter / fixture / 契约与门脚本，
不触碰任何 HTTP 契约、页面或用户可见操作。

---

## 4. 结论

**NO-GO**（M=1，S=1，N=2）。

先说做得扎实的：**396 我从三个源注册表独立重算得 78+5+79+38+196，逐项相符**，
且 396 条 operationId **全部能解析到真实 method+path**（154+42=196 条路由，零未解析）。
16 条 surface 状态 16/16 准确（8 create 全 absent、8 update 全 present）。
round2 与 intake 的 hash 逐位复算相符，manifest 前进被如实标为
`currentBytesNotReviewedByAdversarialReviewer`。POST_REMEDIATION 只改了 authority 词汇与
delivery-unit id，**没有新增 surface、分母或权限**。granularity 门复跑 PASS，
且绑定的 Round 2 `NO_GO` 被原样保留、没有被改写。
active package 自身 `implementationAuthority/runtimeAuthority` 均为 False，
dynamic 包未激活、`resetAuthority: false`、`minimalSeedAuthority` 已移除。
唯一入口、禁 callback、嵌套 Testcontainers 的 parent/task/host/child business+cleanup 绑定齐备。

**卡住的是 M-01。** 设计给动态准入定了 `afterSha256AndReceiptExactSet=PASS` 这个前置，
而 compliance 工具在 trim 模式下**硬性要求**该字段恰为 `NOT_USED_RETIRED_BY_DEXTER_DECISION`；
能产出真 `PASS` 的完整模式（批准面 before/after sha256 双向集合相等）
自 2026-07-27 之后就没再用过。设计对该用哪种模式完全沉默。
结果只有两种：准入永久走不通，或者有人在 exit 明说"未启用"的情况下照写 `PASS`——
后者正是本设计自己要防的失真。
**修法取最便宜的一个**：把该字段改成 `changedPathsWithinApprovedSurface=PASS`
并写明它证的是子集关系。不必恢复完整模式——那套机制真正做对账的部分很便宜，
却被绑上 `controls[]`、`fullComplianceScan`、RM1 binding 与 P0/P1 trace 一整套附加断言，
且 `before` 快照必须在包开始时采、事后补不出来，正是当初以"80% 准备换 20% 产出"被裁定退役的原因。

S-01 是独立 Round 2 原件被作者转写覆盖、留存 SHA 全仓无一命中——
实质看起来没被动（verdict 仍是对作者不利的 NO_GO），但可审计性没了，
把原件一并留存即可。N-01 是那个叫 `.json` 却不是 JSON 的 authority 文件，
格式其实是被门的正则倒逼的，改扩展名即可。
N-02 是 Dexter 在本会话提出、我复核成立的一条：退役词汇应从"必须等于某字面量"
改为"禁止出现"——工具没有多余字段拒绝逻辑，直接删校验反而会放开伪造；
改成禁止出现比现状更严、迁移成本≈0，属独立小改动，不应并入本包。

**我先前提过的拆包建议已收回**（详见 §3）：workload 是一次执行，396 条 fixture 必须全部先就位，
拆包既不能让性能数字提前落地，还要多付一轮设计与两轮独立盲审；
而"一条 fixture 卡住就没结论"这点，acceptance 已按五个 area 给出具名错误码，能精确定位。
**396 一次打包是合理的，包的规模我不再有异议。**

**授权边界**：本 NO-GO 意味着**尚不可创建 final-adapter 静态 implementation package**，
直到 M-01 关闭（或你就该条给出裁定）。
本文件不授权动态环境、DEV、reset、seed、L2/UAT、部署、手工 SSH/SQL、RM1/R5 runtime 复用，
**也不构成任何 SQL 数值优化成功声明**。
