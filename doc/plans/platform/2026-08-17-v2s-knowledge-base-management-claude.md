> ⛔ **SUPERSEDED — 待清理**
>
> `SUPERSEDED_BY: doc/plans/platform/2026-08-17-v2s-agent-enablement-and-gate-triage-claude.md`
> `SUPERSEDED_AT: 2026-08-17`
> `SAFE_TO_DELETE: YES`
>
> **为什么不能引用**:本文的**目标设定是错的** —— 它优化「系统自洽」,
> 而 Dexter 裁定的正确目标是「提高实施 agent 一次做对的概率」。结论按错目标推出。
> 此外本文多处结论已被一轮独立盲审推翻(真红门数、`capability-invariants` 红因、
> 「0 条真缺陷」等),后继文件已更正。
>
> **四块唯一内容已全部并入后继文件**:①入口链三份不一致 → §3
> ②545 份评审流水无目的地 → §8.1 ③住址表 → §8.1 ④退役三件套 → §8.2。
> **本文已可整体删除。**

# v2s 项目知识库管理 · 诊断 · 分析 · 目标 · 方案

- 作者:Claude(独立评审侧)
- 日期:2026-08-17
- 状态:`PROPOSED` —— 待 Dexter 裁决,**未获授权实施任何一条**
- 会话出处:fresh v2s-rooted 会话

---

## 0 · 证据纪律(先声明,再看结论)

**本文档只采信我在本会话内亲手打开源码或跑命令看到的事实。**

本轮曾派六路只读普查 agent。它们的报告**只用来决定去哪里看**,
凡我没有复核的,一律不进本文档,也不作为任何结论的依据 —— 自报数字不是证据,
无论报的人是谁。

这条纪律当场就有回报:普查报称「`scripts/check/gate-0` 无任何入口调用」,
我复核时发现 `scripts/run/platform-commercial-group-skeleton` 第 48 行正在调它,
**该断言为假**。若照单全收,本文档会把一道被真实调用的红门写成孤儿门,
并据此给出错误处置。

我自己的第一次测量也翻了车:我用 `bash` 跑 `rp12-final-state`(它是 node 脚本),
又把 `query-boundaries` 的一行信息输出当成失败标识,
于是误判两道门为红。改用正确解释器并按失败标识判定后修正——
**两处误判都不在下文,下文是修正后的测量。**

全文所有数字均为我本人实测。凡我未测的量(例如「全仓一共有多少条不同的规则」),
明确写「未知」,不估算、不引用他人估算。

---

## 1 · 问题诊断(全部亲验)

### 1.1 一个测量说明全部问题

| 实测项 | 数值 |
|---|---|
| `scripts/check/` 下的检查脚本 | **41** |
| `scripts/verify` 实际执行的 check | **15** |
| 我逐个跑出来的红门 | **7** |
| 这 7 道红门中,位于那 15 道执行清单内的 | **0** |

**`verify` 跑的 15 道,我抽验全绿;红的 7 道,一道都不在 `verify` 里。**

这不是巧合,是结构:**没有任何机制要求「一道门要么被执行,要么被显式声明不执行」**,
于是门可以红着而无人知道,而 `verify` 的全绿是被**选择**出来的。

七道红门(逐条为我本人运行输出):

| 门 | 失败标识 |
|---|---|
| `security-boundaries` | `R4_GATE=FAIL; REASON=R5_SECURITY_ASSET_PREFIX_NOT_CONFIGURED` |
| `capability-invariants` | `P3_A_TYPED_OWNER_EXCEPTION_SET_DRIFT`(新增 owner 异常无 typed handler 映射) |
| `authority-source-ledger` | `P1_LEDGER_ROW_INVALID:ST-11` |
| `rp12-final-state` | `RP12_FINAL_STATE=FAIL` |
| `handoff-debt` | `HANDOFF_ROW_COUNT_INVALID` |
| `protable-compact.mjs` | `PROTABLE_COMPACT_FAIL:instances=15:missing=1` |
| `gate-0` | `R3_PRODUCTION_APP_SOURCE_NOT_EMPTY` |

⚠️ **其中 `security-boundaries` 最重**:它守 face↔resolver 一一绑定、
controller 不得 `@CookieValue` 旁路、`EdgeContextVerifier` 的 HmacSHA256 签名。
**整个安全边界层既是红的,也不被任何聚合入口执行。**

⚠️ `capability-invariants` 那条不是治理问题,是**真缺陷**:
未被映射的 owner 异常会漏成通用 500,而不是 typed problem。

⚠️ `gate-0` 被 `scripts/run/platform-commercial-group-skeleton` 第 48 行调用。
它要求 `apps/` 为空,而 Gate 0 早已通过 —— 它现在**只能红**,
但它有调用方,所以不是孤儿,是一条**结构性永久红**的活门。

**已验证为绿**:`database-boundaries` · `query-boundaries` · `admin-boundaries` ·
`flyway-layout` · `code-layout` · `retirement` · `logging-boundaries` · `backend-boundaries`。

### 1.2 台账自身无人校验

`contracts/policy/r4-gate-catalog.json` 引用 `scripts/check/database-operation-budget`,
该文件**不存在**(功能已改名为 `query-boundaries`)。
**没有任何检查器校验这份 catalog**,所以这处漂移可以永久存在。

### 1.3 召回层有一个设计级盲区

`tools/project-memory/cli.mjs` **零 `readdir`**;`build` 的唯一数据来源是
`required-inventory.json` 的逐条 path。因此「磁盘上有、清单里没有」
**在设计上不可检测**。

本轮开始时:磁盘 37 个条目、登记 25 个、**12 个飘在体系外**,
其中 9 个 `status: active`,包含 Codex 前一日实际需要引用的
`catalog-code-rule-invention` —— 他是直接翻文件读到的,`query` 检索不到。

(该缺口本轮已补齐:现 44 文件 / 40 登记,`status: active` 未登记数为 0。
**但产生它的机制没有改变**,下一次照样漂。)

### 1.4 规则只活在门里

抽验 8 个失败标识,在规范类文档(`doc/` 排除 review 与 evidence、
`AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md`、`HANDOFF.md`、`project-memory/`)中的命中数:

**7 条零命中**:`R5_FRONTEND_DIRECT_TRANSPORT` · `R5_EDGE_ROUTE_LITERAL` ·
`R5_FLYWAY_TEST_LOCATION_RESOLUTION_INVALID` · `R5_RUNTIME_ENVIRONMENT_KEYS_POLICY_INVALID` ·
`REPOSITORY_ROOT_DIRECTORY_NOT_ALLOWED` · `R4_BACKEND_LOMBOK_FORBIDDEN` ·
`R4_DATABASE_SELECT_STAR_COMPATIBILITY_SET_DRIFT`

**1 条有覆盖**:`R4_DATABASE_UNINJECTED_BUSINESS_TIME`

⛔ 这是**抽样**,不是全集。「一共有多少条规则只活在门里」——**我没有测,数值未知**。
但 8 抽 7 零命中,足以支撑「这类规则大量存在」这一条,不足以支撑任何精确数字。

### 1.5 两处对同一件事给出相反指令

| # | 冲突 |
|---|---|
| C-1 | `doc/platform/frontend-coding-standard.md` 第 284 行裁定设值类操作用**内容派生键** `hash(operationId+payload)`;`tools/verify-gates/cli.mjs` 第 88 行要求同一语句内必须出现 `lifecycle.getIdempotencyKey()`,否则 fail。**照规范正本实施,门必红。** |
| C-2 | `doc/platform/active-document-index.json` 中 `standards-coverage-matrix` 的 `role` 仍是 `ACTIVE_ENFORCEMENT_TRACE`,而 `CLAUDE.md` 明写它属于已退役的 compliance-control |
| C-3 | `PLATFORM-BLUEPRINT.md` 第 54、57 行:「只验证 `getPublicInvitationView`」「197 个 provider 是未来待办目录」;`CLAUDE.md` 与 `AGENTS.md`:「18 条真实场景」「196 个 provider 已下线删除」。BLUEPRINT 是会话必读入口 |
| C-4 | `doc/platform/foundation-charter.md` §6-B「禁止句不是唯一合法门形态」vs `frontend-coding-standard.md` §1-0「门只写禁止句」——**两份都是我写的** |

`protable-compact` 那道红门也是同一形态:
`doc/decisions/2026-08-05-v2s-dual-admin-protable-compact-standard.md` 第 9 行写分母 13,
门实测 15 个实例。

### 1.6 入口链三份互不一致

| 入口 | 内容 |
|---|---|
| `AGENTS.md` 第 6–8 行 | 含 `doc/platform/README.md`、`project-memory/index.md` 全部 kernel、**`scripts/memory/query` 六维路由**、`scripts/README.md` |
| `.codex/hooks.json` → `session-start` 第 7–12 行 | ENTRY_1..6,**缺 `doc/platform/README.md`,缺六维路由那一步** |
| `CLAUDE.md` 第 39–40 行 | 只有 `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、registry —— **整个 project-memory 缺失** |

按 hook 执行的会话会漏读两项;按 `CLAUDE.md` 执行的会话完全不读项目记忆。

### 1.7 复发信号存在,但没有目的地

`doc/review/platform/` 下 **545** 份文件中,**4 份**包含作者自述的复发用语
(「犯过三次」/「第二次同类错误」/「连续第三轮」/「已经写过一次」)。

⛔ 「这 545 份里有多少条长期知识」——**我没有测,数值未知**。
但作者**已经注意到自己在复发**且写了下来,这一条是实测的。

### 1.8 我没有测的量(明确列出,不得被引用为依据)

- 全仓不同规则的总数
- `doc/decisions/`(80 份)里长期规则的条数
- 只活在门里的规则的**精确**条数
- 545 份评审里可复用教训的条数
- 各库之间的重复度

---

## 2 · 分析

### 2.1 接缝分母(自建)

一条规则要真正生效,必须依次穿过若干层;每两个相邻层之间是一个**接缝**。
按 §1 观察到的库穷举相邻关系:

| # | 接缝 | 必须成立的命题 | 有无覆盖漂移检测 | 实测反证 |
|---|---|---|---|---|
| S1 | 裁决 → 规范 | 裁决定的约束,规范正本里有对应写法 | **无** | C-3、protable 13↔15 |
| S2 | 规范 → 门 | 每条规范要么有判据,要么显式标「只能 review」 | **无** | C-1 |
| S3 | 各库 → 召回层 | 实施者用六维路由能捞到 | **无** | §1.3 的 12 个 |
| S4 | 门 → 执行清单 | 每道门要么被执行,要么显式标不执行 | **无** | §1.1 的 7/0 |
| S5 | 各库 → 入口链 | 会话开始时真的被读到 | **无** | §1.6 |

**5 个接缝,0 个有覆盖漂移检测。** 每一个都有实测反证。

唯一接近的是 `scripts/check/project-memory`,但它验的是**已登记条目与其文件是否一致**
(identity / assertion / anchor 逐行存在),**不验该登记的有没有登记**——
这正是 §1.3 的成因。

### 2.2 根因

**每一层都对「自己内部一致」负责,没有任何一层对「我和邻居是否一致」负责。**

- `project-memory` 校验自己的条目 ✅,不校验自己是否覆盖了该覆盖的 ❌
- 门校验代码 ✅,不校验自己是否被执行 ❌
- 规范内部自洽 ✅,不校验是否与门一致 ❌
- `r4-gate-catalog` 是台账 ✅,无人校验台账自己 ❌

**而知识恰恰活在接缝上**:一条规则只有在「裁决 → 规范 → 门 → 召回」四处同时成立时才是真的。
§1 的每一条观察都是接缝故障,**没有一条**是某一层内部的故障。

### 2.3 两个二阶原因

**写入自由,退出无人做。** 追加一份 decision、一道门、一份评审都是一个动作;
退役需要同时动 N 处,而**没人知道 N 是多少**。门这一层甚至完全没有退役路径 ——
`gate-0` 就是活证据:它有调用方、永久红、没人能说清怎么让它体面地消失。

**评审流水与知识库共用一个心智模型。** 545 份评审与长期知识长得一样、
住在同一棵 `doc/` 树下。复发信号(§1.7)因此没有目的地。

### 2.4 为什么先做这个,而不是先统一编码规范

统一规范必须回答「这条该写在哪、由谁强制、与现有的冲突了怎么办」。
在 S2 无检测、C-1 这类矛盾无法被发现的前提下,统一动作只会产出**第二真相源**。

这不是假设,本轮已经发生:我昨天写的 `foundation-charter.md` 就是又开了一个平行库,
它与 `frontend-coding-standard.md` 当场产生了 C-4;
而我同一天写的「动笔前查五处」规则里**漏了 `project-memory/`**。

---

## 3 · 愿景目标

⛔ 「知识库整洁」不可证伪,不作为目标。下列每条配检验方式与**我实测的**当前值。

| # | 目标 | 检验方式 | 当前实测 |
|---|---|---|---|
| G1 | 不存在「红着但不被执行」的门 | `scripts/check/*`(41)= 执行清单 ∪ 显式标注不执行 | **7 道红,0 道在执行清单内** |
| G2 | 台账不指向不存在的东西 | catalog 引用的每个脚本必须存在 | **1 处漂移** |
| G3 | 召回层覆盖度不静默漂移 | 磁盘 `status: active` ⊆ 登记清单 | 本轮归零,**机制未建** |
| G4 | 不存在只活在门里的规则 | 失败标识 ⊆ 文档提及 | **8 抽 7 零命中** |
| G5 | 不存在两处相反指令 | 已知冲突逐条归零 | **4 处 + protable 分母** |
| G6 | 入口链只有一份 | 三处清单逐项相同 | **三处互不相同** |
| G7 | 退役是可完成、可验收的动作 | 挑一条已退役项核三个动作 | `gate-0` 失败 |

**反例栏(上表全绿而目标未达成的情形)**:
G4 只证明失败码在文档里出现过,不证明**说的是同一件事** —— C-1 那种矛盾能同时满足 G4 与 G5 的机械检查;
G1 只证明门被执行,不证明它**守对了命题**。这两条的语义部分只能靠 review,**不得伪装成 checker**。

---

## 4 · 解决方案

### 4.1 三道接缝对账 `[已定]` —— 唯一新增的机器件

每道十几行、秒级、只读元数据。

**对账一 · 门的执行清单(S4)** —— 直接对应 G1,优先级最高

- 不变量:`scripts/check/*` 全集 = `verify` 执行清单 ∪ 台账中显式标 `UNWIRED_BY_DECISION`(带理由)的集合
- 红夹具:新增一个既不在 `verify`、也未标注的 check 脚本 ⇒ 必须变红(在 scratchpad 拷贝上真跑)
- 负控制:标了 `UNWIRED_BY_DECISION` 且写了理由的 ⇒ 必须放行
- 反例栏:一道被执行但逻辑恒真的假门,它看不出来 —— 那是 review 的事,已知未覆盖

**对账二 · 台账自校验(§1.2)**

- 不变量:`r4-gate-catalog.json` 引用的每个脚本必须存在
- 红夹具:把某条改成不存在的路径 ⇒ 必须变红
- 负控制:全部存在时放行
- 反例栏:脚本存在但内容与台账描述不符,看不出来

**对账三 · 召回层覆盖度(S3)**

- 不变量:`project-memory/` 下 `status: active` 的文件集合 ⊆ `required-inventory.json` 的 path 集合
- 红夹具:放一个 `status: active` 的未登记 .md ⇒ 必须变红
- 负控制:放一个 `status: retired` 的未登记 .md ⇒ 必须放行(墓碑按设计在体系外)
- 反例栏:登记了但内容与标题不符,看不出来

`[已定 · 本轮不执行]` **对账四 · 门↔文档配对(S2)**:每个失败标识在某份规范或记忆中至少被提到一次。
推迟的理由:它必须先等 §1.4 的**全集**被测出来,否则第一天就是大面积红,
会逼出「为过门而塞文档」。先做前三道,把全集测清楚再上。

### 4.2 住址表 `[已定]`

| 知识种类 | 唯一住址 | 生命周期 |
|---|---|---|
| 裁决:为什么这样定 + 什么事实能推翻它 | `doc/decisions/` | append-only + supersede 链 |
| 规范:代码该怎么写 | 两份 coding standard | 可改,单一正本 |
| 失败模式 | `project-memory/pitfalls/` | 可 retire,留墓碑 |
| 好做法 | `project-memory/practices/` | 同上 |
| 机器判据 | `scripts/check/` · `tools/` | **必须有退役路径(当前没有)** |
| 当前状态与授权 | Roadmap registry | 唯一 active owner |
| 欠账 | `HANDOFF.md` | 关闭只追加 `closedBy`,不删行 |
| 一次性结论 | `doc/review/platform/` | **是流水,不是库** |

⚠️ 除最后一行外,本表是对**现状的追认**,不是新规定 —— 它们本来就这么用,只是没写下来。
最后一行是唯一改变:把评审产物明确定性为流水。

### 4.3 成对规则 `[已定]`

一条规范落地时必须同时具备:①正本文字(住址按 4.2) ②机器判据,或显式标注
`REVIEW_ONLY:<为什么判据需要理解上下文>`。

在成对约束下,C-1 那种矛盾**不可能产生** —— 写规范时必须同时看到它的门。

### 4.4 退役三件套 `[已定]`

退役 = 三个动作,缺一不算:①原处标 `retired` 留墓碑 ②所有指针改指墓碑
③**如果它有门,门一起退役或改判**。第 3 条当前完全缺失。

### 4.5 入口链归一 `[已定]`

三处清单收敛成一份,其余两处只做指针。`AGENTS.md` 内部关于
`index.md`「是必读上下文」还是「只是生成导航」的自相矛盾一并裁掉。

### 4.6 评审流水怎么捞 `[未定]` —— **需 Dexter 裁决**

| 候选 | 做法 | 风险 |
|---|---|---|
| A | 每轮评审结束时作者提名 0–2 条 | 靠自觉,会漏 |
| B | 定期全量回捞 | 545 份且增长,不可持续 |
| C | 只在「同一教训第二次出现」时登记 | 要能发现「第二次」 |
| D | 不捞,导致一次真实返工时才升级 | 反应式,先付一次代价 |

**推荐 C + D**:触发条件是作者在 intake 时声明「这条我以前犯过」。
理由是**信号已经存在**——§1.7 实测有 4 份评审里作者亲手写了复发用语。
作者是注意到了的,缺的只是目的地。C 把已有信号接上目的地,零新增观察成本;D 兜住 C 漏的。
明确不推荐 B。

---

## 5 · 明确不做 `[已定]`

⛔ 本方案**不得**长成 2026-08-13 刚退役的那套 compliance-control:

- 不建 evidence 台账、package entry/exit、receipt、hash-chain、admission
- 不新增任何 Pre/Post hook
- 不建覆盖率百分比指标
- 不要求任何现有文档批量迁移

**本质区别**:那套东西**闸住工作**(没有 receipt 就不许写代码);
本方案**不闸任何实施步骤**,三道对账只读元数据、秒级,失败只说明「某处漂了」。
而且它**净删除**:`gate-0`、失效的 catalog 指向、以及 7 道红门中该退役的,都在这一轮出清。

**右尺寸自查**:三道对账合计约五十行;住址表、成对规则、退役三件套是文字,零基建;
入口链归一是删重复。**总代价约一天量级**,
对价是一道无人执行的红着的安全门、一处真缺陷(未映射异常)、4 处相反指令、一处永久漂移的台账。

---

## 6 · 建议执行顺序 `[已定]`

**先做 4.1 的三道对账,再做其余。**

对账一上线,4.2–4.4 的违反会**自己浮出来**,不需要先做一轮全仓整理;
反过来先整理再建对账,整理完当天就重新开始漂 —— §1.3 已经演示过一次。

顺序:三道对账 → 出清死门与失效指向 → 修 7 道红门 → 入口链归一 →
住址表与退役三件套落文 → 4.6 按裁决执行 → 测 §1.4 全集后再决定对账四。

---

## 7 · 待 Dexter 裁决

| # | 事项 | 我的推荐 |
|---|---|---|
| Q1 | 整体方向是否成立 | —— |
| Q2 | 4.6 取哪个候选 | C + D |
| Q3 | C-1 幂等键:规范正本对,还是门对 | **需你定,我无产品依据** |
| Q4 | `security-boundaries` 是否接进 `verify`(接了当前就是红的) | 接,并先修 asset prefix |
| Q5 | `gate-0`:删除,还是改为带 `--post-gate-0` | 删除;它有调用方,删时要一并改 `scripts/run/platform-commercial-group-skeleton` |
| Q6 | C-3 BLUEPRINT 的 backend-acceptance 口径以哪份为准 | 以 `AGENTS.md`/`CLAUDE.md` 为准,改 BLUEPRINT |

⛔ **本文档不授权任何实施。** 待 Q1 裁决后再拆实施计划。
