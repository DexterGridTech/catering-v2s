---
title: RM1 实施详设独立评审（Claude）
reviewTarget: DESIGN
reviewCycleId: RM1-WHOLE-SCOPE-DESIGN-2026-07-28
verdict: NO-GO
findings: M=6 / S=2 / N=3
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅静态设计评审；不授权 contract、源码、migration、测试、脚本、DEV、seed/reset 或任何动态运行
createdAt: 2026-07-28
---

# RM1 实施详设独立评审

## 0. 结论

**NO-GO**，`M=6 / S=2 / N=3`。

其中 **M2、M3 是 Codex 自己 round-2 独立盲审已判 `CONFIRMED` 且未修复的 finding**
（`RM1-M-001`、`RM1-M-003`），作者以 `roundFinalDecision: SELF_DECIDED` /
`furtherCodexAdversarialRoundAllowed: false` 收口后移交。这个收口本身合规（两轮硬上限），
但**带着两条已确认的 M 交付，本评审不可能给 GO**。

**授权边界**：本评审只覆盖静态设计。不授权下一 Roadmap step、不授权实施、
不授权 contract / 源码 / migration / 测试 / 脚本 / DEV / seed / reset / 任何动态运行。

**会话出处**：fresh v2s-rooted 只读会话，非续接、非它仓。仓库零写入（本文件除外）。
所有数字用独立实现重算，未采信任何自报值。

---

## 1. 亲验记录（先于结论）

### 1.1 SHA-256 逐个复算

| 声明位置 | 声明值 | 实测 | 判定 |
| --- | --- | --- | --- |
| manifest 11 个 unit 的 `approvedSources[].sha256`（设计正文） | `221818527bfa4c49…` | `b2c18bb0dc3a3b11…` | **全部 MISMATCH（11/11）** |
| 同上 `APPROVED_ASSERTIONS` / `FORBIDDEN_PSEUDO_FIXES` / `DETAIL_DESIGN…` 的 `sourceSha256` | `221818527bfa4c49…` | `b2c18bb0dc3a3b11…` | **MISMATCH** |
| round-2 的 `manifestSha256` | `9f910c6decfc2b47…` | `9f910c6decfc2b47…` | OK |
| round-2 的 `reviewerInputChecklist.sha256` | `1910dbb3618c7ae1…` | `1910dbb3618c7ae1…` | OK |
| D1 的 `sourceSha256`（`project-memory/decisions/incremental-compliance-hook.md`） | `0e0179020433b894…` | `0e0179020433b894…` | OK |

### 1.2 分母与结构独立重算

- §4 执行表行数 = **57**（与声明一致）。
- manifest `deliveryUnits` = **11**；§1 拓扑的包 = **12**（P0/P3-A/P3-B/P3-C/P1/P2/P4/P5/P6/P3-D/P7/P8）。
- D1 绑定在 11 个 unit 上的 **distinct 值 = 1**（同一个单文件）。
- `owningSourceSet` 在 manifest 中出现 **0 次**（§8.1 要求"every delivery-unit … must carry `owningSourceSet[]`"）。
- `changeSurfaces` 中 `disposition:"create"` 却已存在的路径 = **17 处**。
- carry-over manifest 中 `brand-authorization` / `BrandAuthorization` 命中 = **0**。

---

## 2. 对四个指定核验点的直接回答

| # | 问题 | 回答 |
| --- | --- | --- |
| 1 | P3-B 是否已完全取消固定"20 写端点"分母 | **否**。§1.3 与 §5 确立了 snapshot exact set，但 §4 的 `P-D0` 行 exit assertion 仍写 `all 20 writes deny precisely`。作者自己的 round-2 已 CONFIRMED。见 **M2** |
| 2 | D1 是否覆盖每 unit 完整 routed hit set；D5 是否为 UI unit 绑定 carry-over + 已接受 Journey/interaction | **均否**。D1 在 11 个 unit 上是同一个单文件；D5 对 U09/U10 只有 carry-over manifest，且 U10 的 R-24 授权 UI **根本不在该 manifest 内**。见 **M3 / M4** |
| 3 | P0 对 owning-source set 的既有 checker 扩展是否足以 fail-closed、且不新增门类别 | **不新增门类别成立**（扩展 `implementation-design-granularity` + `compliance-control`）；**fail-closed 不成立**——被校验的数据结构 `owningSourceSet[]` 在 manifest 里不存在，扩展无对象可校。见 **M3** |
| 4 | UI amendment 的接受 / hash re-freeze / 后续 review-cycle 规则是否不会让 P6/P3-D 假绿 | **会**。§7.1 的"re-freeze 后 undergo the next allowed independent review round"与 `reviewRoundLimit=2` / `furtherCodexAdversarialRoundAllowed=false` 直接冲突，构成"改 hash 重置 cycle"的通路。见 **M5** |

---

## 3. Findings

### M1 ｜冻结输入未冻结：manifest 声明的设计 hash 与实际字节全部不符

**仓内事实**：manifest 的 11 个 `approvedSources[].sha256` 与三处 `sourceSha256` 一致声明设计正文为
`221818527bfa4c49061c866a894f691a35142880629488e4cbb9ed379d0ce109`；
本会话对 `doc/plans/platform/2026-07-28-v2s-rm1-restructure-and-remediation-implementation-design-and-plan.md`
复算得 `b2c18bb0dc3a3b11…`。**11/11 不匹配。**

**为什么是 M**：`granularity` 与 `compliance-control` 的整条对账链以 `sourceSha256` 为锚。
锚点失配意味着 (a) 我评审的字节与作者冻结时的字节不是同一份，(b) 任何"selector 命中"结论都无法复现，
(c) 该 manifest 今天跑 checker 即应红。这是"冻结即审"的地基，不是格式问题。

**推论 vs 事实的区分**：hash 不符是**仓内事实**；成因（设计在冻结后被编辑 / hash 从未真实计算）是**推论**，
本评审无法区分，也不需要区分——两种成因的处置相同。

**修复**：重算全部 hash 并重冻；在 P0 的 checker 扩展里把 `sourceSha256` 失配列为具名红，
并配红变异（改设计正文一个字节，manifest 未同步则必须红）。
**为什么不是更小方案**：只改 hash 而不加校验，下次仍会漂移；这条正是 P0 存在的理由。

---

### M2 ｜P-D0 仍以硬编码 `20` 作为 exit 判据（作者 round-2 已 CONFIRMED，未修）

**仓内事实**：§4 第 `P-D0` 行 `exit assertion` = `all 20 writes deny precisely`。
与 §1.3「本计划不使用"20"或其他手写计数作为完成判据」、
§5「不用手写 M/S 编号、旧"原 6 处"或当前计数作性能分母」**同文件内自相矛盾**。

**为什么严重**：R-24 使 operations 面净 +1（退役 1 个 `PUT`、新增 `POST`/`DELETE`），
R-5 退役 5 个 platform invitation op、P-N1 新增 2 个 OTP op。
`20` 这个数在 P3-B 完成时**必然已经不成立**；用它做 exit 等于用一个已知过期的分母宣告闭合——
与 ST-7（硬编码分母）同族，而 ST-7 正是本轮 P0 要消除的东西。

**修复**：把该行 exit 换成
「post-P3-B `mutating-operation-inventory.json` snapshot 的 exact set 中，
每个 entry 均有 requirement id / first-scope resolver / owner recheck / red fixture 绑定；
`added`/`retired`/`unchanged` 三集合完全分类，`unclassified` 为空」。
计数只作为 snapshot 的可复算输出出现，不作判据。

---

### M3 ｜D1 在 11 个 unit 上退化为同一个单文件；§8.1 承诺的 `owningSourceSet[]` 不存在

**仓内事实**：11 个 delivery unit 的
`sourceComplianceDenominators.PROJECT_MEMORY_ASSERTION_OCCURRENCES` 的 distinct 值 = **1**，
均为 `project-memory/decisions/incremental-compliance-hook.md`，selector 亦相同。
而 §2 定义 D1 = 「`project-memory` 路由命中原文」，§8.1 进一步要求
「D1 is every routed `project-memory` hit reopened for the unit; the incremental-hook memory is
one member, never the full denominator」。
**`owningSourceSet` 在整个 manifest 中出现 0 次。**

**为什么是 M（不是 S）**：这不是"少写了几条"，而是**分母塌成常量**。
P2（结构重组）、P4（性能）、P6（UI）三个包路由命中的 memory 显然不同，
现在它们共用同一个分母，意味着任一包都可以在**遗漏其真正治理来源**的情况下机械 PASS。
这正是 §8.1 自己描述的失败模式，而 manifest 就是它的实例。

**与 Focus 3 的关系**：P0 的 checker 扩展要求「exact path+hash+selector equality rather than
accepting one non-empty summary path」——但被校验的字段不存在，**扩展没有对象可校，无法 fail-closed**。
故 Focus 3 的"fail-closed"回答为否，根因即本条。

**修复**：先在 manifest 为每个 unit 落 `owningSourceSet[]`（逐条 path+hash+selector），
再让 P0 的扩展对它做 exact set equality；红变异按 §8.1 已写的四类（删一个 routed member、
替换无关 path、漏一个 governing interaction、UI unit 谎报 N/A）逐一验红。
**顺序不能反**：先有数据再有校验，否则 P0 会以"零分母"绿。

---

### M4 ｜U10 的 D5 绑定到一个不治理该 surface 的来源

**仓内事实**：`RM1-U10`（P3-D，R-24 品牌授权 UI）的
`OWNED_SURFACE_AND_PAGE_KEYS.sourcePath` = `contracts/policy/frontend-asset-carryover-manifest.json`。
本会话在该 manifest 中检索 `brand-authorization` / `BrandAuthorization` 命中 = **0**。

**为什么严重**：carry-over manifest 是 **R5 既有资产的沿用登记**。
R-24 的单项增删授权列表是**本轮新造的行为**（本评审 Roadmap 已登记
`INTENTIONAL_DIVERGENCE_FROM_V2`），它按定义不可能在沿用清单里。
把 D5 绑到它，等于宣称"该 surface 的 owning source 已声明"，而实际上
**真正治理它的来源（`RM1-IA-03` 的已接受 wireframe / state table）尚不存在**。
U09（P6）同理：D5 只有 carry-over manifest，缺 `RM1-IA-01`/`IA-02`。

这与 §7.1 自己的 `BLOCKED_FOR_INTERACTION_ACCEPTANCE` 相矛盾——
一个被声明为"阻塞待接受"的 unit，其 D5 却已被填成 `APPLICABLE` 且 `missingEntryFails=true`，
形式上可通过。

**修复**：U09/U10 的 D5 必须是 `owningSourceSet[]`，成员至少包含
(a) carry-over manifest（仅对确有沿用的 surface）、(b) 对应 IA 工件的 path+hash+anchor。
IA 工件不存在时，该 unit 的 D5 状态应为**阻塞态而非 `APPLICABLE`**，
且 checker 必须能区分"阻塞"与"已闭合"。

---

### M5 ｜§7.1 的 re-freeze 规则给出了"改 hash 重置 cycle"的通路

**仓内事实**：§7.1 —「Upon Dexter acceptance, the affected design section and manifest unit must be
re-frozen with artifact path+hash+unique anchor, then undergo **the next allowed independent review round**」。
而 round-2 工件声明 `reviewRoundLimit: 2`、`roundFinalDecision: "SELF_DECIDED"`、
`furtherCodexAdversarialRoundAllowed: false`。

**冲突**：本 cycle 内**不存在** "next allowed round"。于是只有两种落地方式，都不可接受：
1. **开新 cycle** —— 但 CLAUDE.md 明令「不得用换 reviewer、**改 hash**、局部修订重置 cycle」，
   而这里恰恰是"接受 amendment → re-freeze hash → 新 cycle"；
2. **不开新 round，直接解除 `BLOCKED_FOR_INTERACTION_ACCEPTANCE`** ——
   则 P6/P3-D 的新增交互设计**从未经过独立对抗审查**即进入实施。

**这不是措辞瑕疵**：M2/M3 两条 M 目前挂在 U02/U03 与全部 11 个 unit 上。
若 amendment 接受可触发"新 cycle"，这两条 M 就可能被当作"上一 cycle 的历史结论"而不再承接——
这正是 P6/P3-D 假绿的具体路径。

**修复（须写死，缺一不可）**：
1. 新 cycle **只覆盖 amendment 工件本身与其绑定的 unit 段落**，不得触及其余 unit；
2. 新 cycle **不清除**本 cycle 的未闭合 finding；未闭合 M 必须以显式条目结转到新 cycle 的输入分母，
   并可机械对账（与 P8 的 transfer manifest 同形）；
3. re-freeze 只允许**新增**（amendment path+hash+anchor），不得借机重算已冻结段落的 hash——
   否则与 M1 的成因混同、无法区分正当 re-freeze 与漂移。

---

### M6 ｜P2 缺两条最可能翻车的判据：正分母断言与 Flyway 相对路径

**仓内事实**：设计正文与 manifest 中检索
`98`、`Flyway`、`../../`、`walk(` 的命中均为 **0**。
RM1-P2 的 exit 只有「eight-form set equality 在 `repo \ E` 为零；active docs/contract policy 不可排除；
`affected-l2` 以新布局重跑」。

**为什么是 M**：候选 Roadmap 的 P2-5 判据 3 与 4 是本次搬迁**唯一**能抓住两类静默失败的控制：

- **门静默变空**：`walk()`（`tools/verify-gates/cli.mjs`）与 `walkFiles()`
  （`tools/module-dependency-registry/check.mjs:93`）对不存在路径**返回 `[]`**。
  搬迁后 `SOURCE_TASK_READ_UNDECLARED`（整个跨 owner 直读强制层）与 6 个 `R4_BACKEND_*`/`R4_DATABASE_*`
  会**对空文件列表迭代并报绿**。唯一的解药是**正分母断言**（逐模块文件数，合计 98，任一为 0 即 FAIL）。
- **DB 集成测试失效**：8 个测试文件的
  `.locations("filesystem:../../../apps/backend/…/db/migration")` 中 `../../../` 是按
  `libraries/backend/<m>` 深度算的；新路径下正确前缀是 `../../`。不改则**全部 DB 集成测试找不到 migration**
  ——而那正是用来证明搬迁安全的测试。

设计把这两条整体遗漏，等于 P2 通过后**无法区分"边界仍生效"与"边界已被路径字符串关掉"**。

**修复**：把候选 Roadmap 的 P2-5 判据 3、4、5、6 原样纳入 P2 的 exit：
正分母断言（98 / 逐模块计数）、8 个 Flyway 前缀、`cli.mjs:613` 红变异 fixture 的落点、
`budget()` 扫描范围静默变宽的显式处置。

---

### S1 ｜11 个 delivery unit 覆盖 12 个包，P7 与 P8 被合并

**事实**：`RM1-U11 = "P7/P8 closure"`。而 §1 拓扑、§6 完成判定表都把 P7、P8 当作**两个独立包**、
各有 predecessor / first action / stop condition。

**风险**：granularity checker 以 delivery unit 为粒度做 changed-path set equality。
两个包共用一个 unit，意味着 **P7 的 exit 与 P8 的 exit 无法被独立门控**——
P8（本轮变更面复核 + transfer manifest）可以借 P7 的 changed-path 通过，反之亦然。
这与"包级串行、上一包 exit 真绿才开下一包"直接冲突。

**修复**：拆成 `RM1-U11`（P7）与 `RM1-U12`（P8），各自独立 `approvedAssertions` 与
`sourceComplianceDenominators`。

---

### S2 ｜`changeSurfaces` 有 17 处 `disposition:"create"` 指向已存在路径

**事实（本会话逐条 `os.path.exists` 验证）**：包括
`tools/compliance-control/cli.mjs`、`eslint.config.mjs`、`scripts/check`、
`libraries/backend/organization`、`libraries/backend/workspace-iam`、
`apps/backend/catering-business-server`、`apps/frontend/platform-admin`、
`apps/frontend/operations-admin`、`doc/decisions` 等。

**风险**：目录类路径下 `create` 或许意指"在其下新建"，但 `tools/compliance-control/cli.mjs`
与 `eslint.config.mjs` 是**具体已存在文件**。`disposition` 是 changed-path 对账的输入语义；
`create` 与 `update` 混淆会让"新增式演进 vs 就地改写"这条边界无法机械判定，
而这条边界正是 §1.1「新增式演进、不以历史 receipt 替代 actual-file 对账」所依赖的。

**修复**：`disposition` 取值域显式定义（`create` 仅用于当前不存在的路径），
并在 P0 的 checker 扩展中加一条机械校验：`create` 且路径已存在 → 具名红。

---

### N1 ｜§4 表格列数不一致，`deferred reason` 列不渲染

表头 7 列（`issueId | unit | owning paths | concrete action | red mutation | exit assertion | deferred reason`），
分隔行只有 **6** 列。GFM 下第 7 列被丢弃。57 行中 `P-C4`、`P-N1`、`P-U3`、`P-U4` 四行确有
`deferred reason` 内容，当前渲染不可见。R-27 要求的正是七列，形式上未成立。

### N2 ｜Roadmap 若干具名落点在设计中不可机械核

`104`、`phaseOrder` / `--phase RM1`、`verify.mjs:19` 的硬编码 `--phase R5`、
`deferredUntilPhase`、`roadmap-program-registry` 的 RM 系列注册、
`PublicInvitationController.java:33` 的第三个 `testCode` 调用点，在设计正文与 manifest 中命中均为 0。
其中部分由缩写覆盖（A4/A5 隐含 104；"contract/codegen/controller 三重闭合"隐含第三调用点），
**语义上可接受**，但作为 exit 断言不可机械核。建议在对应包的 exit 中具名。

### N3 ｜作者 round-2 的 `blindReviewDeclaration` 无法由本评审复核

声明「round-1 material was read only after that source-first verdict work」属**流程自陈**，
本评审只能核到 `reviewerKind=INDEPENDENT_SUBAGENT`、`authorMaterialReadAfterIndependentVerdict=true`
两个字段存在，**无法独立验证其为真**。标记 `UNVERIFIED`，不作为 finding，仅登记边界。

---

## 4. 方案合理性（先于闭环正确）

### 4.1 问题对不对

**对。** 设计 §1.2 的四个收敛点——授权不由页面参数决定、R-24 是单项命令、可见性不泄露、
性能分母不是手写清单——**正是用户与 Dexter 立场上真正要解决的问题**，
不是"精确地做 1+1"。特别是第三条（撤销 Problem 只投影 actor 可见 blocker、
不含 total / `hasAdditional` / `canRevoke`）是作者**自己发现并收紧**的，
超出了候选 Roadmap 的要求——这是正向的，登记为优点。

### 4.2 方案优不优

**总体优，两处需要辩护未给出：**

- **`mutating-operation-inventory.json` 作为新增 generator**：合理。替代方案是"扩展现有
  `edge-route-face-registry.json`"——后者已含 `operationId/method/path/consumerFaces/owner`，
  只缺 `x-required-capability`。作者未论证为何新建一份而非扩展既有生成物。
  按 T-1（能少写一行绝不多写），**这个取舍必须显式**。目前 `UNVERIFIED`。
- **P4-A 的 scanner**：设计给了 roots / identity / classification / exclusion / schema，
  并要求"向 production root 注入一条 query edge 必须使 derived set 变化"——
  这条自证性要求很好。但候选 Roadmap 已裁决 **E-0' = 运行时查询计数预算**为主控制、
  静态门不做；设计把 scanner 提为一等公民而未说明与 E-0' 的主从关系。
  若 scanner 成为主判据，等于回到被否决的静态代理路线。**需明确 scanner 只产 ledger（分母），
  判据仍是运行时计数。**

### 4.3 代价配不配

**基本配，一处偏重**：§2 的六类 source 分母 + §8.1 的 `owningSourceSet[]` 是本设计最重的新增机制。
它解决的是真问题（包 exit 假绿），且**不新建门类别**（扩展既有 checker），符合当前阶段标尺。
但它今天**只有承诺、没有数据**（M3），处在最坏状态：成本已经承诺、收益一分未得。
建议 P0 内**先落数据再落校验**，避免这个机制本身变成下一个"声明即完成"。

---

## 5. UI 与交互强制自问

| 自问 | 回答 |
| --- | --- |
| 该操作是否来自用户明确要求 / 批准 Journey | **部分否**。P-U3、P-U4、平台 OTP 登录、邀请 UI 退役、R-24 授权列表五项均为行为/交互变更，设计已正确识别并要求 `RM1-IA-01/02/03` 由 Dexter 一次看图接受。**这是对的做法。** 但 U09/U10 的 D5 已填 `APPLICABLE`（M4），形式上与"尚未接受"矛盾 |
| 用户在此时这样操作是否合逻辑 | R-24 单项增删：**合逻辑**。用户心智是"加一个/取消一个"，不是"重填名单"。P3-D 的列表 + 单选添加 + 逐行取消是更短更自然的路径 |
| 是否有更短、更自然、更少选择的路径 | 未发现更短路径。撤销被阻断时展示具体门店，比泛化文案显著更好 |
| 不合理之处的来源 | 现存不合理（多选批量替换）来自**旧契约形态**（只有整集合 `PUT`），不是产品语义未裁决。设计已从契约层根治 |
| 是否存在需 Dexter 裁决的歧义 | **有，且设计已正确挂起**：三个 IA 工件未产出前，U09/U10 不得实现。本评审同意该处置，但要求 D5 状态与之一致（M4） |

**`NOT_APPLICABLE` 不适用**——本设计确含 UI 面。

---

## 6. manifest Part B / Part C / Part D 对照

### Part B（B.1–B.6）

| 条目 | 命中 | 判定 |
| --- | --- | --- |
| B.1 单元边界与 owner | §3 逐包 + manifest 11 unit | **部分**——11 unit vs 12 包（S1） |
| B.2 orderedChain / 依赖与串行边界 | manifest `orderedChain`、`dependencyAndSerialBoundaries`；§1 拓扑；§6 表 | 命中 |
| B.3 数据演进 | manifest `dataEvolution`；§3 P3-B additive migration / FK / receipt identity | 命中 |
| B.4 UI 与术语 | manifest `uiAndTerms`；§7 IA bundle | **部分**——D5 绑定不成立（M4） |
| B.5 证据与红变异 | manifest `evidence`；§4 `red mutation` 列 | 命中 |
| B.6 禁止伪修复 | §5；manifest `forbiddenPseudoFixes` | 命中 |

### Part C 规范性条款

| 条款组 | 设计落点 | 判定 |
| --- | --- | --- |
| 单一可部署件 / 无 MQ·outbox·TDP·内部 client | §1「以下不在 RM1」 | 命中 |
| owner schema 与跨 owner 只走声明端口 | §3 P3-C「不直读 organization schema」、P4-B「禁止跨 schema direct read」 | 命中 |
| `x-consumer-faces` 为暴露唯一真相 | §1.2、§1.3、A1/A2 | 命中 |
| 幂等与 expectedVersion | §3 P3-B receipt linearization protocol（四步） | 命中，且强于候选 Roadmap |
| 契约先行、不手改生成物 | §5 | 命中 |
| 两轮硬上限与 cycle 不可重置 | §7.1 / §8 | **NOT_MET**（M5） |
| 冻结输入以 hash 锚定 | manifest `sourceSha256` | **NOT_MET**（M1） |

### Part D 章节级命中对照

| 设计章节 | 对应候选 Roadmap / 清单条目 | 判定 |
| --- | --- | --- |
| §1.3 P3 唯一分母 | R-30 顺序、A1–A5 分层 | 命中，但 §4 `P-D0` 行反向覆盖（M2） |
| §2 六类 source 分母 | R-27 七列可验收映射 | **部分**（M3） |
| §3 P0 | Roadmap P0（含 `DEFERRED` 残留分支删除、phaseOrder、verify.mjs） | **部分**（N2） |
| §3 P3-A/B/C | A1/A2/A3 分层、adapter、白名单结构化字段、FK | 命中；FK 与 unknown-result 均落到位 |
| §3 P1 | R-29 七 ID ledger | 命中（`ST-2/3/4/6/8/9/11` 正确） |
| §3 P2 | R-23 冻结分母 + 结构重组 | **部分**（M6） |
| §3 P4 | E-0' 运行时预算 + P-E9 枚举 | **部分**（§4.2 主从关系未明） |
| §3 P5 / P6 | ST-9 / ST-2·6·11 实作归属 | 命中 |
| §3 P3-D | 四条 exit + 契约 diff 为空 | 命中 |
| §3 P7 | `InvitationsPage` 已正确移出 P7 | 命中 |
| §3 P8 | 三个 canonical debtId + 四类红 | 命中（ID 拼写与清单一致） |
| §7 UI decision queue | R-26 边界、IA 工件 | **部分**（M5、M4） |
| §8.1 D1/D5 契约 | R-27 | **NOT_MET**（M3） |

---

## 7. 已确认成立的部分（不得在整改中回退）

1. **P3-B 的 receipt/FK linearization protocol（四步）** —— 以 `(workspace_uuid, idempotency_key)`
   唯一约束作线性化点、duplicate-key race 后按 request hash 分流、
   明令禁止「`SELECT … FOR UPDATE` 锁一个不存在的行」。**强于候选 Roadmap 的要求**，
   且直接对应 P-D3 的并发缺陷。
2. **隐藏引用不下发** —— readback 仅 `authorizedAtEpochMillis`；撤销 Problem 最多 20 个
   **当前 actor 可见**的 `{id,code,name}`，无 total / `hasAdditional` / `canRevoke`；
   无可见 blocker 时退化为同一 generic typed conflict、UI 不预禁用。
   这条比候选 Roadmap 的"白名单结构化字段"更严，**堵住了侧信道**。
3. **P4-A scanner 的自证性要求** —— "向 production root 注入一条 query edge 必须使 derived set 变化"，
   证明 scanner 不是在校验自己写出的列表。
4. **P1 的七 ID 集合拼写正确**（`ST-2/3/4/6/8/9/11`），ST-7 归 P0，未复现上一轮的 `ST-1`/`ST-5` 错误。
5. **P8 的三个 canonical debtId 拼写与清单完全一致**，四类红变异齐备，
   且措辞守住「只能声明 artifact ready，不得称 RM2 已接收」。

---

## 8. 处置与再评审条件

M1–M6 全部为**仓内可机械修复**，不涉及产品语义，按既有批准边界交 Codex 自主修复，
**不构成再授权门槛**。其中：

- **M5 需要 Dexter 一句裁决**：新 cycle 的边界规则（只覆盖 amendment 工件、不清除未闭合 finding、
  re-freeze 只允许新增）是否照本评审 §3-M5 的三条写死。这涉及评审治理规则本身，标 `DEXTER_DECISION`。
- 其余 M/S/N 由 Codex 直接修。

**再评审条件**：M1（hash 重冻 + 校验）、M2（去掉 `20`）、M3（`owningSourceSet[]` 落数据）、
M4（U09/U10 的 D5 阻塞态）、M6（P2 补两条判据）闭合后，可发起下一轮设计评审。
**M1 未闭合前，任何"selector 命中"结论都不可复现，评审无法进行。**

**本评审不授权**：下一 Roadmap step、implementation、contract 变更、源码、migration、
测试、脚本、DEV、seed/reset、任何动态运行。
