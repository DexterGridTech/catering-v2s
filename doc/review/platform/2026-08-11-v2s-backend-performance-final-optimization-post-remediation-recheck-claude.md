# 后端性能最终优化详设 —— Claude POST_REMEDIATION 独立复核

`VERDICT=GO`　`M=0`　`S=0`　`N=1`

**M-01、M-02、S-01、S-02 全部真实关闭**，且其中两处的收口质量高于我提出的最小修复。
**我上一轮的一处结论需要更正：我报的"5 条错锚点"实际是 4 条，其中 2 条是我判得过严；
而他们找到了 1 条我按方法结构上找不到的。** 详见 §1.1。

唯一的 N 是我上轮建议、本轮未采纳的一条 granularity 对称断言，属既有 checker 的通用弱点，不阻断。

**本 GO 仅覆盖静态设计。** 不授权创建 implementation package 之外的任何动作，
不授权 Testcontainers、DEV、reset、seed、L2/UAT、部署、手工 SQL/SSH，
**不构成任何性能数值成功声明**。

## 0. 会话出处与写入边界

续接会话，非 fresh v2s-rooted acceptance。本仓零写入（除本文件）。未执行任何动态动作。
本轮所有数字均由我从制品与源码独立复算。

---

## 1. M-01 —— **关闭，且更正我自己的上一轮结论**

### 1.1 5 条 vs 4 条：我错了两条，他们多找到一条

上一轮我报了 5 条错锚点。逐条对账后，**正确答案是 4 条**：

| operationId | 我的判定 | 复核后 |
|---|---|---|
| `createPlatformGroupWorkspace` | 错 | **确错**，已修为 `WorkspaceAdministrationService#create` |
| `transitionPlatformGroupWorkspaceStatus` | 错 | **确错**，已修为 `#transitionStatus` |
| `updatePlatformGroupWorkspaceDisplay` | 错 | **确错**，已修为 `#updateDisplay` |
| `initializeCommercialGroup` | 错 | **我判得过严**。edge 确实在已声明的 `PlatformWorkspaceCoordinator` API 字段上分发；接口→实现的解析按规则边界属 BPF-U01 的 ORIGIN/JOIN 分类，不是 `cur` 锚点的职责 |
| `stagePlatformAsset` | 错 | **我判得过严**。同理，edge 在已声明的 `PlatformAssetService` 字段上分发；重载→实现的解析同属后续分类 |
| **`transitionWorkspaceAccountStatus`** | **未发现** | **他们找到的**：旧锚点 `WorkspaceUserService#detail` → 重导 `WorkspaceAccountService#transitionStatusForPlatform` |

**最后一条恰好证实了我判 M 的核心理由**。我在上一轮写：
「我能发现这 5 条靠的是它们恰好没有 `@Transactional`；若抽取误取到另一个恰好带事务注解的方法，
我这套检查发现不了。」我独立验证了 `WorkspaceUserService#detail` **确实带 `@Transactional`**——
所以它落在我方法的结构性盲区里，只有确定性重导才能发现。
**这正是我当初要求给"差异条数"而不是"已修 5 行"的原因，该要求得到了回报。**

### 1.2 重导规则与全量复核

规则 `EDGE_DECLARED_OWNER_PROTOCOL_FIELD_CALL_V1` 写得精确：
取 edge 方法体内对**已注入的 `com.catering.v2s` owner/protocol API 或 application 字段**的调用，
由字段类型导出 `path#method`，并明令
「Never use the final arbitrary method reference in an argument expression」——直指病因。
三条拒绝规则含 `app/edge/**` 无效、owner/protocol 包外无效、
**歧义或缺失必须保持显式 GAP 而不得推断**。

我对修正后的 45 条做了全量复核：

| 复核项 | 结果 |
|---|---|
| 锚点落在 `app/edge/**` | **0** |
| 锚点文件不存在 | **0** |
| 锚点不在 owner/protocol 包内 | **0** |
| catalog 实际 sha256 == 声明的 `sha256AfterCorrection` | **相符** |

`summary` 自报 `mismatchCount: 4 / matchCount: 41 / derivedInAppEdge: 0`，与我复算一致。
三条 `requiredPermanentControls` 把重导、失配报告与 ORIGIN/JOIN 分类固化给 BPF-U01，
并明确「the cur dispatch anchor is never treated as runtime transaction proof」。

## 2. M-02 —— **关闭，强于我提出的最小修复**

`BPF-U01` 首先改 `tools/compliance-control/cli.mjs`，我逐条对照我提的三点要求：

| 我的要求 | 设计落点 |
|---|---|
| 所有包必填 | 「every active package, including design-only, control-plane, source, runner and **future-package templates**, must carry `mandatoryPerEditGate`」；**`runMandatoryPerEditGate` must no longer silently return on absence**——正是我找到的 `if (!gate) return;` 漏洞 |
| 闭集保持封闭，增删改需独立评审 | 「Adding, removing or changing an entry is a **separate control-plane change that requires a fresh independent review** whose reviewed command/hash/profile is **stored in that closure**; a normal feature package may not make that change」——**比我要求的更强**，评审绑定被存进闭集 |
| 模板兼容、避免误伤无关包 | 有限兼容矩阵覆盖当前包与五类未来创建模板原型 |

两处它做得比我想得更细：

1. **包字段改为不可变 gate profile ID，而非任意命令**，经新建的
   `contracts/policy/mandatory-per-edit-gate-command-closure.json` 解析，
   且「cannot embed arguments, substitute a weaker checker, or append a command」——
   把"用弱门满足必填"这条路彻底堵死，这比单纯"必填"精确。
2. **给"所有包"划了有限实现分母**：明说不是「all JSON that happens to name a package」，
   而是五个具名构造锚点（`readActivePackage`、`readActivePackageRecoveryRequest`、
   `activePackageRecoverySelfTest`、`mandatoryPerEditGateSelfTest`、`edge-codegen.mjs#selfTest`）。
   这是防止一条治理改动无边界扩散的正确做法。
   另有「Historical inactive package bytes are not retroactively activated」，避免回溯打断既有证据。

五条红变异齐备：缺字段、未登记命令/profile、argv/hash 变更、缺失或非 GO 的评审绑定、不兼容原型。

**surface 已补齐**（这是上轮的结构缺口）：
`tools/compliance-control/cli.mjs` 为 `update`、
`contracts/policy/mandatory-per-edit-gate-command-closure.json` 为 `create`。
`scripts/verify` 未纳入——**这是正确的**，Dexter 裁决采纳方案②，
verify 按 Codex 说明只作可选的常规汇总，不是强制机制。

**loader-once 的诚实限定成立**：`:87` 明写
「The design does **not** claim that the fact-load-once checker runs at edit time」；
`:442-444`「This is intentionally a **retrospective runtime control**. Static admission proves
… that every operation declares its loader set; it cannot prove one execution path only …」。
与 Dexter 裁决的"静态准入 + 运行时回溯"双层事实一致，没有把回溯说成预防。

## 3. S-01 —— **关闭（且我上轮的检查方式再次过严）**

两个核心新建物现在**各出现两次**：`BPF-U01` 声明 `create`、`BPF-U04` 声明 `update`。

我最初把它当作重复条目，核对后确认**这是正确的**：串行多单元包里，
U01 建、U04 再扩，按单元分别声明比给一个净处置更精确，且时序自洽
（U01 时文件不存在 → `create` 成立；U04 时已存在 → `update` 成立）。
原问题（`update` 指向不存在文件且全包无 `create`）已消除。

surface 由 34 增至 **42**（create 13 / update 28 / retain 1）。

## 4. S-02 —— **关闭，五个既有门逐个具名处置**

| 既有门 | 处置 |
|---|---|
| `database-operation-budget` | 把重复的 performance-shape 职责**退役并折叠**进新形态门，且先保留兼容性 |
| `backend-performance-gate-dispositions` | 更新其有限台账与闭集，**登记** source-inventory、shape、fact-load-once 三个新控制 |
| `authority-source-ledger` | 重开并修复/退役无效的 `ST-11` 行；本设计**不把它当作门消费** |
| `backend-performance-read-budget` | BPF-U05 用五个真实 revoke 入口替换失效锚点，并证明丢成员即红 |
| `backend-performance-final-fixture-catalog` | BPF-U06 先调和 196 源契约与其红 fixture，再进 Testcontainers |

另两个绿门 `canonical-performance-ledger` 与 `backend-performance-command-baselines`
明确「remain consulted, passing neighbouring controls; they are **not silently repurposed as shape authority**」
——这一句很重要，防止把邻近绿门借来充当形态权威。

## 5. 其余核验项

| 项 | 结果 |
|---|---|
| 87 幂等 / 45 readback / 45 ORIGIN-JOIN | 均列为**实施前显式前置**（`:563` 「become explicit prerequisite work」、`:588` 逐项列名），非边实施边猜 |
| 机制 C 四项 | `:454-456` 齐备：(1) 具体被折判断、(2) 原可观察语义、(3) **可执行的失败反例**、(4) 证明保持的 source/readback/error 证据 |
| 196 exact-set 修订后未漂移 | registry 196 / command 113 / read 83 / ledger 196；并集==全集、交集 0、ledger==全集 |
| 动态顺序 | `:135-137` 固定为 静态 196 闭合 → 独立 IMPLEMENTATION review GO → 远端 Testcontainers 196/196 → 本机 managed L2 → 破坏性 reset → managed DEV start → r5-full seed 与同 basis 比较 |
| `implementation-design-granularity` | **PASS**，`REVIEW_BINDING_MODE=DECLARED_POST_REMEDIATION_AWAITING_CLAUDE`，绑定的 Round 2 `NO_GO` 未被改写 |
| design / authorization hash | **两个均复算相符** |
| post-remediation 声明 | `currentBytesNotReviewedByAdversarialReviewer: true`、`claudeRecheckRequired: true`、`implementationAuthority: False` |

## 6. Finding

### N-01｜granularity checker 仍不校验 `update` 路径必须存在（我上轮建议，本轮未采纳）

**证据**：`implementation-design-granularity` 有 `CREATE_PATH_ALREADY_EXISTS` 红夹具
（`create` 路径必须不存在），但没有对称的「`update` 路径必须已存在」断言。
上轮 S-01 之所以能带着两条错标通过，正是因为这个缺口。

**为什么只是 N 且不阻断**：本包的 S-01 已用另一种、且更精确的方式修好
（按单元 `create` + `update`），不依赖该断言；
且这是 checker 的通用弱点，不属本设计范围。

**最小修复**：给 `implementation-design-granularity` 补一条对称断言并配红变异。
**建议登记为独立小改动或 `HANDOFF.md` 欠账**，不要塞进本包——
本包已有 42 条 surface 与 6 个串行单元，不宜再扩。

**是否需要 Dexter 裁决**：不需要。

---

## 7. 结论

**GO**（M=0，S=0，N=1）。

**M-01 关闭，并纠正了我自己的错误**：正确的失配数是 **4 而非 5**——
`initializeCommercialGroup` 与 `stagePlatformAsset` 是我判得过严
（edge 确实在已声明的 owner/protocol API 字段上分发，接口/重载→实现属后续 ORIGIN/JOIN 分类）；
而他们找到了我按方法结构上找不到的 `transitionWorkspaceAccountStatus`
（旧锚点 `WorkspaceUserService#detail` **确实带 `@Transactional`**，正落在我的盲区）。
修正后 45 条我全量复核：`app/edge/**` 0 条、文件缺失 0 条、owner/protocol 包外 0 条，
catalog 实际 sha 与声明的修正后 sha 相符。

**M-02 关闭且强于我的最小修复**：`runMandatoryPerEditGate` 不再静默返回；
包字段改为不可变 profile ID 经闭集解析，堵死弱门替换；
闭集条目增删改需独立评审且评审绑定存进闭集；
并给"所有包"划了五个具名构造锚点的有限实现分母，避免治理改动无边界扩散。
`tools/compliance-control/cli.mjs` 与闭集文件均已进 surface。
loader-once 明确限定为回溯性运行时控制，未被表述为编辑期预防。

**S-01 关闭**（按单元 `create`+`update`，时序自洽，我最初的"重复条目"判断有误）；
**S-02 关闭**（五个既有门逐个具名处置，两个绿门明确不被改用作形态权威）。
87/45/45 三项均为实施前显式前置；机制 C 四项齐备含可执行失败反例；
196 exact-set 未漂移；动态顺序完整；granularity 门 PASS 且绑定 verdict 未被改写；两个 hash 相符。

唯一的 N 是 granularity checker 的对称断言未补，属既有 checker 通用弱点，建议另案处理。

**授权边界**：本 GO 允许按 Dexter 已给的授权创建独立静态 implementation package
并按 BPF-U01…U06 实施。
**不授权** Testcontainers、DEV、reset、seed、L2/UAT、部署、手工 SQL/SSH；
在静态实施与其独立 IMPLEMENTATION review 之前不得进入任何动态阶段；
**不构成任何 SQL 或事务性能数值成功声明**——收益仍只能等同口径 seed 前后对照。
