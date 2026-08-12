# Final managed lifecycle adapter design —— Claude POST_REMEDIATION_V1 定向复核

`VERDICT=GO`　`M=0`　`S=0`　`N=1`

**M-01 已真正关闭，且改得比我要求的更严。** S-01 的"原件不可恢复"我用三条独立路径复核，
结论与作者声明一致；披露措辞也没有把作者转写冒充独立原件。
唯一的 N 是一个可伪造的 stdout 摘要被写成了有效性条件，属措辞问题，不阻断。

**本 GO 仅允许创建独立的 final-adapter 静态 implementation package。**
不授权动态环境、DEV、reset、seed、L2/UAT、部署、手工 SSH/SQL、RM1/R5 runtime 复用，
**也不代表任何 SQL 数值优化成功**。

## 0. 会话出处与写入边界

续接会话，非 fresh v2s-rooted acceptance。本仓零写入（除本文件）。
所有 hash、分母、路径存在性均本会话独立复算。

**本轮我做了一次只读的 git 对象核验**（见 §2），用于验证"原件不可恢复"这一事实主张。
这是只读复核，不涉及任何仓库控制动作，也不以任何仓库操作为前置。

---

## 1. M-01 关闭核验 —— **真关闭，且强于我的最小修复**

上一轮的 M-01 是：设计要求动态准入绑定 `afterSha256AndReceiptExactSet=PASS`，
而该字段在 trim 模式下被工具硬性要求为 `NOT_USED_RETIRED_BY_DEXTER_DECISION`，
于是它要么永不成立、要么只能靠一句无据断言写出来。

**当前设计（intake `:103–116`）的措辞我逐句对照了工具语义**：

| 设计要求 | 工具 trim 分支实际校验 | 一致 |
|---|---|---|
| `staticProofStatus=PASS` | `exit.staticProofStatus === "PASS"` 是进入 trim 分支的条件 | ✓ |
| `exitMode=TRIM_OBSERVATION_PATH_LIST_ONLY` | 同上 | ✓ |
| `changedPaths` 非空且唯一 | `requireUniqueEntries(...)` + `PACKAGE_EXIT_CHANGED_PATHS_EMPTY` | ✓ |
| 每条都在该静态包的批准面内 | `for (…) if (!allowed(packageState, entryPath)) throw UNAUTHORIZED_CHANGED_PATH` | ✓ |

**设计声称的强度恰好等于工具能证明的强度，没有多说一分。**

更进一步，设计现在写着：

> The derived admission predicate is `changedPathsWithinApprovedSurface=PASS` …
> It proves an approved-surface subset, **not** after-hash equality or receipt-set equality;
> the admission record **must not contain or claim** `afterSha256AndReceiptExactSet=PASS`.

我的最小修复只要求"改名并写明是子集关系"。
**这里额外加了一条主动禁令**——admission record 不得包含或声称那个退役断言。
这正是我在 N-02 里建议的"禁止出现"方向，作者在本包能管的范围内先落了一半。
`minimalSeedAuthority` 不是别名这句也保留了。

红例保留：缺 validation evidence/exit、review binding 被改、policy digest 陈旧。

---

## 2. 原 Round 2 Markdown 不可恢复 —— **披露充分，且我独立证实**

### 2.1 披露措辞

`round2.md` 现在带：

```
originalMarkdownTranscript: {
  availability: "UNRECOVERABLE",
  expectedSha256: "7cc6220f…",
  structuralSynopsis: "AUTHOR_CREATED_AFTER_LOSS_NOT_INDEPENDENT_ORIGINAL",
  recoveryEvidence: "…-final-adapter-design-author-intake.md"
}
```

`structuralSynopsis` 的取值**逐字写明了"作者在丢失后创建、不是独立原件"**——
没有把 JSON 冒充成独立产出。author-intake `:18` 另有一行
`Round-2 report retention | CONFIRMED_UNRECOVERABLE`，
`:32–34` 明确"当前字节在定向修复后未经独立审查"、"唯一被允许的下一步是 fresh Claude design recheck"。
`recoveryEvidence` 指向的文件确实存在且内容对得上。

### 2.2 我的独立证实（三条路径，全部零命中）

我没有采信"已跨工作区与 git 搜索"这句话，自己跑了：

| 路径 | 结果 |
|---|---|
| 工作区全文件逐个复算 sha256 | **零命中**（上一轮已做） |
| `round2.md` 该路径的提交历史 | **零条**——原件从未进入过 git，只在工作区被覆盖 |
| 悬空对象：**679 个 dangling blob** 逐个 `cat-file` 后复算 | **零命中** |

**三条独立路径一致，`UNRECOVERABLE` 属实。** 作者声明与事实相符。

### 2.3 残余与前向规则（不构成 finding）

一个无法消除的残余是：granularity 门仍把这份**作者创建**的 JSON 当作 Round 2 制品消费
（`reviewerKind: INDEPENDENT_SUBAGENT` 仍在其中）。
这不是可修复项——原件确已灭失，重跑一轮又会触碰两轮硬上限。
现状是"如实标注 + 交由 Claude 复核"，我认为这是丢失既成事实后唯一诚实的处置。

**前向规则应固定下来**：今后任何格式转写一律**新增不覆盖**，原件必须与转写并存。
这一条已在 author-intake 里以"唯一被允许的下一步"形式部分体现，建议在流程文档里写死。

---

## 3. 你点名的其余核验

### 3.1 `implementationAuthority: false` 与 dynamic 权限 —— **通过**

| 位置 | 值 |
|---|---|
| design intake 正文 | `implementationAuthority: false` |
| authority input（**已按上轮 N-01 改名为 `.md`**） | `implementationAuthority: false`、`scope: design-only` |
| granularity manifest | `implementationAuthority: False`、`status: PROPOSED_REVIEW_ONLY` |
| **active package** | `implementationAuthority: False`　`runtimeAuthority: False`　`businessStatus: NOT_RUN_DESIGN` |

manifest 的 `authorization.path` 已同步指向 `.md`，**门复跑仍 `PASS`**——
改名没有把门弄坏（该门是按文本正则匹配 `implementationAuthority: false`，与扩展名无关）。

dynamic input：`minimalFixtureAuthority: true`、`resetAuthority: false`、
`runtimeAuthority: true`（动态包本分），**全文不含 `minimalSeedAuthority`**（我按字符串实查）。
该包**未激活**，今天不授予任何运行权。

### 3.2 396 与嵌套 Testcontainers —— **通过，无漂移**

396 我再次从三个源注册表独立重算：
`78 / 5 / 79 / 38 / 196`，合计 **396**，与上一轮完全一致。
每行仍绑 `sourceAnchor`（`path#exportedProcedure` + 源码 hash）、闭集 `materializerKind`、
typed `pathParameters`、具名 `prerequisiteReadback`；拒绝通用 materializer、anchor/hash 不符、
缺 CAS/replay/readback 前置、实际路径非由行模板产生。

嵌套 Testcontainers 段（`:123–126`）逐字未变：
固定 allowlisted focused Gradle task、adapter-owned nested runtime path、
parent final-run id、已验证 remote-host fingerprint、child manifest 绑定上述字段与
phase/heartbeat/log 证据、**`business=PASS` 且 `cleanup=PASS`**，由 final admission 解析；
四条红例（默认 `.runtime/r5`、foreign parent、alternate task、child cleanup 失败）保留。

### 3.3 POST_REMEDIATION_V1 未新增任何东西 —— **通过**

- surface：**16 条**（update 8 / create 8），逐条 stat：**create 8 条全 absent、update 8 条全 present，16/16 准确**，与上一轮同数
- 分母：396 不变；dynamic input 的 78/5/79/38/196/126/60/25/11 不变
- 权限：`implementationAuthority: False` 未变；active package `runtimeAuthority: False`
- **动态执行零痕迹**：`.runtime/backend-performance/` 不存在，无任何 final run 目录

hash 逐位复算：`reviewSha256` 声明 `95a0e765…` = 实际 `95a0e765…` ✓；
intake 声明 `6676085e…` = 实际 `6676085e…` ✓。
`currentBytesNotReviewedByAdversarialReviewer: true`、`claudeRecheckRequired: true`、
`implementationAuthority: False` 均如实保留。

`implementation-design-granularity` 复跑：**`PASS`**，`REVIEW_ROUND=2`，
`REVIEW_BINDING_MODE=DECLARED_POST_REMEDIATION_AWAITING_CLAUDE`，
`VERDICT=NO_GO`——**绑定的 Round 2 原始 NO_GO 仍被如实保留，没有被改写成 GO。**

---

## 4. Finding

### N-01｜把一个可伪造的 stdout 摘要写成了"有效性条件"

**证据**：intake `:107` 要求 admission 绑定
「a static-package-time successful `validate-package-exit` trim-observation result and its
**stdout/log digest**」，`:112–113` 进一步说该 predicate
「**is valid only when bound to that successful CLI evidence**」。

但 trim 分支的 stdout 是四行确定性文本：

```
PACKAGE_EXIT=PASS
PACKAGE_ID=<id>
CHANGED=<n>
MODE=TRIM_OBSERVATION_PATH_LIST_ONLY
```

**任何人都能写出这四行并对它取摘要**，它没有任何防篡改性，也不证明 CLI 真的跑过。
把它写成"有效性条件"，强度与它实际能提供的保证不匹配——
这与 M-01 本身是同一类措辞问题，只是量级小得多。

**为什么只是 N 且不阻断**：真正承重的条件在紧邻的下一句——
设计要求被采纳的静态 exit **本身**必须满足 `staticProofStatus=PASS`、
`exitMode=TRIM_OBSERVATION_PATH_LIST_ONLY`、`changedPaths` 非空唯一且逐条在批准面内。
这是 `--run` 从**一手制品**（exit 文件 + 批准面状态）**重新推导**，不可伪造。
**安全属性由重推导承担，stdout 摘要只是陪衬。**

**有限适用面**：admission 记录的一个字段与一句描述。不影响分母、surface、权限或任何现有声称。

**最小修复（二选一）**：
① 删掉 stdout/log digest——`--run` 能重推导的东西不需要再存一份摘要；
② 保留但改写措辞：明确它是**provenance 记录而非防篡改证据**，
并把有效性条件明确归于"对 exit 与批准面的重新推导"。
不改任何数值或 surface。

**是否需要 Dexter 裁决**：不需要。

---

## 5. 上一轮其余 finding 的状态

| 上一轮 | 状态 |
|---|---|
| **M-01** 准入要求不可能诚实存在的 receipt/hash equality | **关闭**（§1，且加了主动禁令） |
| **S-01** 独立 Round 2 原件被覆盖、SHA 无法核验 | **关闭为诚实披露**（§2，三条路径独立证实不可恢复；残余不可修复但已如实标注） |
| **N-01** `design-input.json` 不是 JSON | **关闭**（已改名 `.md`，manifest 同步，门仍 PASS） |
| **N-02** 退役词汇应改为"禁止出现" | **本包内已落一半**（admission 明令不得包含该断言）；`compliance-control` 侧的程序级改动**仍未做**，按上轮意见它不应并入本 design-only 包，请单独处理或登记 `HANDOFF.md` |

---

## 6. 方案合理性

本轮只改措辞与文件名，**不改语义**：分母、surface、权限、动态范围我逐项复算，一律未动。
M-01 的修法取的是最便宜的一条（改断言强度而非恢复已退役机制），
与 Dexter 当初以"80% 准备换 20% 产出"退役该机制的判断一致，没有借修复把基建请回来。

上一轮我提过又收回的拆包建议，本轮不再重提：396 一次打包合理，规模无异议。

**UI 与交互**：`NOT_APPLICABLE`。本包只涉及 runner / adapter / fixture / 契约与门脚本，
不触碰任何 HTTP 契约、页面或用户可见操作。

---

## 7. 结论

**GO**（M=0，S=0，N=1）。

**M-01 是真关闭，而且强于我提的最小修复。** 我逐句对照了设计措辞与
`tools/compliance-control/cli.mjs` 的 trim 分支：四项要求与工具实际校验一一对应，
声称强度不多不少；此外还主动加了"admission record 不得包含或声称
`afterSha256AndReceiptExactSet=PASS`"这条禁令，方向与我上轮 N-02 一致。

**"原件不可恢复"我没有采信，自己验了三条路径**：工作区逐文件复算、
该路径的提交历史（零条，原件从未进过 git）、**679 个悬空 blob 逐个复算**——**全部零命中**。
披露措辞把 JSON 明确标为 `AUTHOR_CREATED_AFTER_LOSS_NOT_INDEPENDENT_ORIGINAL`，
没有冒充独立原件。残余（门仍消费这份作者创建的制品）不可修复，但已如实可见；
前向规则应固定为"转写一律新增不覆盖"。

396 重算仍是 78/5/79/38/196，嵌套 Testcontainers 的 parent/task/host/child business+cleanup
绑定与四条红例逐字未变。16 条 surface 状态 16/16 准确。两个 hash 逐位相符。
POST_REMEDIATION **没有新增 surface、分母、权限或动态执行**——
`.runtime/backend-performance/` 不存在，active package 两个 authority 仍为 False。
granularity 门 PASS 且绑定的 Round 2 `NO_GO` 未被改写。上轮 N-01 的 `.md` 改名没有弄坏门。

唯一的 N 是把一个四行、可伪造的 stdout 摘要写成了"有效性条件"——
安全属性其实由紧邻那句"对 exit 与批准面重新推导"承担，删掉或改写措辞即可。

**授权边界**：本 GO 仅允许创建独立的 final-adapter **静态** implementation package。
不授权动态环境、DEV、reset、seed、L2/UAT、部署、手工 SSH/SQL、RM1/R5 runtime 复用、
仓库控制，**也不构成任何 SQL 数值优化成功声明**——最终动态验收尚未运行，
`BP_U05_READ_BUDGET_STATUS` 与 `BP_U07_SQL_MERGE_SUCCESS` 仍为 `BLOCKED_UNMEASURED`。
