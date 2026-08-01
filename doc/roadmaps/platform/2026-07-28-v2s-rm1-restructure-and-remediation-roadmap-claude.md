---
title: v2s RM1 结构重组与整改 Roadmap（候选，Claude 起草）
status: PREPARED_NON_AUTHORITATIVE
createdAt: 2026-07-28
programId: V2S_W0_W4_EXECUTION
roadmapId: RM1-RESTRUCTURE-AND-REMEDIATION
stateOwnerNote: 本件不是状态 owner。唯一状态 owner 仍是 doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md
implementationAuthority: false
runtimeAuthority: false
seedResetAuthority: false
inputDenominator: doc/review/platform/2026-07-28-v2s-r6-problem-inventory-claude.md
supersedes: doc/roadmaps/platform/2026-07-28-v2s-r6-restructure-and-remediation-roadmap-claude.md
---

# v2s RM1 结构重组与整改 Roadmap（候选）

## 0. 状态、标识与用途

**标识说明**：前一稿用 `R6`，但现行 Roadmap 第 243 行已把 **R6 定义为「W4：全量复验、移交与 v2s 收口」**，
同一 program 内 R6 有两个定义 —— 正是本件自称最高原则的"单一真相"违反。故改用 **`RM1`**
（Remediation 1），与 R0–R6 的步序标识不冲突，也不占用 `--phase` 的既有词表。

**状态 owner**：本件 `PREPARED_NON_AUTHORITATIVE`，**不写 `CURRENT_*`**。
唯一状态 owner 仍是 `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`。
Dexter 接受本件时，需在那份文件里把 R5 的终态措辞写定（当前是
`R5_COMPLIANCE_REMEDIATION_IMPLEMENTATION_IN_PROGRESS`）——**这一步由 Dexter 决定措辞，本件不代写。**

**唯一输入分母**：`doc/review/platform/2026-07-28-v2s-r6-problem-inventory-claude.md`（已按第一轮盲审更正）。
Codex 据本 Roadmap 产出详设；清单里每条问题必须在某包有归属或有显式 `NOT_APPLICABLE` + 理由。

**standards matrix**：`contracts/policy/standards-coverage-matrix.json` 当前 phase 分布为
R2:**17** / R3:38 / R4:82 / R5:13，合计 **150**（先前稿写 R2:18/合计 151 是作者错误），**无 RM1 行**。P-0 必须补齐，否则 `standards-coverage --phase RM1`
会拿到空分母，与 `PHASE_DUE_FAILS` 冲突。

## 0b. Dexter 设计原则（必须固化进 project-memory 与设计标准）

> **Dexter 2026-07-28 指令**：把这些原则放进 Roadmap，并由 Codex 加到项目记忆与设计标准里。
> 它们不是本轮一次性约束，是**长期判据**——此后每一份详设、每一次评审都以它们为尺。

### 0b.1 十条通用设计原则

> **这些是通用工程原则，不是本项目的具体裁决。** 项目专属的判决（照 v2 不照 v4、
> 后端不判 pageKey 等）在 §1 的 R-1…R-17 裁决表里，**不要混进原则**。
> 判例列只用于说明原则怎么用，判例本身会随项目变，原则不变。

| # | 通用原则 | 判例（说明用法，非原则本身） |
| --- | --- | --- |
| **T-0** | **单一真相，职责清晰**：一件事只在一处判断。**最高优先级**，与其他原则冲突时以它为准 | 同一个可选性曾在后端、前端、提交校验三处各判一次 |
| **T-1** | **简单、高效、健壮；能少写一行代码绝不多写**：新建任何组件前，先证明"现有的不够用" | 修授权时发现所需方法早已存在只是没被调用 |
| **T-2** | **参照既有实现时，对齐的是能力与行为，不是实现形式**：参照系的行数、分支结构、技术选型都不是要对齐的东西 | 同一套错误分级语义，在有 typed 枚举的一侧可以用表驱动写得更短 |
| **T-3** | **代码治理严谨，业务设计不过度**：门、边界、证据从严；数据模型取简 | 一组不需要单独查询与授权的 key，用 JSON 列装即可，不建关联表 |
| **T-4** | **选参照系以架构同构为准，不以版本新旧为准**：形状可比才可借鉴；不同构的实现只能作为"有没有想到某个能力"的补充来源 | 微服务时代的实现不适合作单体的架构形状参照 |
| **T-5** | **职责按事实归属划分，不按调用方便划分**：谁拥有这个事实，谁判断；不让任一层感知另一层的概念 | 授权判断只能用授权事实作输入，不能用界面概念作输入 |
| **T-6** | **共享区要有第二个消费者才建，不预留**：抽象的成立前提是复用真实发生 | 一个只有单一消费者的"共享层"，其存在理由是历史惯性而非当前需要 |
| **T-7** | **不做投机性优化**：未被真实度量证明必要的优化不做 | 未经真实查询与执行计划证明的索引不加 |
| **T-8** | **边界纯度优先于局部接线简度**：省一次调用不足以换取事实归属的模糊 | 不为少写一个 reader 而让协调方复制他人拥有的事实 |
| **T-9** | **分母完备性靠机械枚举，不靠人判断**：凡"这就是全部范围"类结论，必须由机械枚举产出并交叉复算 | 人工清单反复漏项，而枚举脚本不会 |
| **T-10** | **历史垃圾必须删，不留"以后可能有用"** | 零引用的实现、被取代的产物、名不副实的目录 |
| **T-11** | **不接受"最后统一验证"；控制必须能被真实变异打红**：过程中每写一部分即核一次；自测的 baseline 必须是未经改写的当前树，不得有任何自我豁免 | 改写被测源码以制造通过的基线，等于自测永不反映真相 |
| **T-12** | **每个问题的修复必须先有能证伪它的测试**：见 §0c | 修复前不红的测试，证明不了修复有效 |

### 0b.2 固化工作项（归 RM1-P0）

Codex 必须完成，**不是可选**：

1. **写入 project-memory**。建议归位：T-0/T-5 → `kernel/04-contract-consumer-and-admin.md`；
   T-6/T-8 → `kernel/02-service-shape-and-owner.md`；T-1/T-2/T-3/T-7 → 新建或并入
   `decisions/` 下的设计标准条目；T-9/T-11 → `operations/verification-governance.md`；
   T-4 → `decisions/` 参照系条目；T-10 → `kernel/06-heritage-and-change.md`
2. **同步 `project-memory/required-inventory.json`**。当前 assertion occurrence 为 **78 / unique 76**（第三轮盲审按 `required-inventory.json` 独立重算的工作树实测值；
   先前稿的 71/69 既非磁盘态亦非 git 态，已作废。**Codex 必须自行重算再动手**），
   新增后分母会变——**必须同步更新 inventory 并复跑 `scripts/check/project-memory`**，
   否则该门会红。注意 inventory 是冻结分母，**新增文件会被门拒绝**，优先写入既有文件
3. **写入设计标准**：`AGENTS.md` 与 `CLAUDE.md` 的评审判据段落，以及
   `.agents/skills/cs-writing-plans/SKILL.md`、`cs-spec-to-plan/SKILL.md` 的详设生成约束
4. **接入既有门**：这些原则里可机械判定的部分（T-0 的"**唯一 authority source + 每个消费者可机械追溯到它**"——
   **注意：不是"出现次数=1"，该形态已由 R-29 废除**；T-5 的"后端无 pageKey"、
   T-11 的"self-test 无自我豁免"）应并入既有 checker，**不新建门类别**

## 1. 前一条 Roadmap 的处置（R-2）

CR00–CR08 那条整改 Roadmap **就地终止**。

- **已完成的代码保留，不回滚**。清单 §13 列出的成果是真实产出，本轮不得回退
- **未闭合项全部并入本 Roadmap**
- CR00–CR06 的 package-exit receipt 作为历史记录保留，**但不再作为"已验证"的依据**
  —— CR05/CR06 无 compile/test receipt、无红变异产物
- 与 P-1 的关系：结构重组只移动目录与 package 坐标（方案 B），**不改任何 SQL、方法签名或 registry 边**，
  **不推翻已完成的代码**，两者不矛盾。（先前稿的"不改包名"已撤回，理由见 RM1-P2-3）

## 2. 为什么顺序是"先修仪表，再动结构"

> 前一稿把 P0（单一真相）与 P1（结构）排在门真实化之前。第一轮盲审指出这与本件自己的论证
> 自相矛盾，作者采纳。**当前 4 个门是真红**：

| 红门 | 根因 | 修复成本 |
| --- | --- | --- |
| `logging-boundaries` | `WorkspaceLoginRateLimitService.java:21` 等 3 处硬编码 HMAC 密钥 —— **红因先前写错**：生产构造器（`:20`）**已经**是 `@Value("${workspace-iam.rate-limit-hmac-secret:}")` 且空值即 `IllegalStateException`；硬编码只在**包内测试专用构造器**（`:21`）里。故修法不是"配置化"，而是**删掉/改造测试专用构造器**（测试改用显式传密钥），或把门收紧为"只扫生产可达构造器" | 删测试构造器，非配置化 |
| `database-operation-budget` | `ExtensionCommandReceiptService` 的无效 `FOR UPDATE` | 1 行换 advisory lock |
| `affected-l2` | 18 个 spec 不存在 + 12/30 path 脱节；且 `cli.mjs:433` 的 `surfaces.length < 24` 是硬编码分母 | 分母改为门外锚定；保留全部 registry surface，并以 `DEFERRED` 的到期红机制记录既有 L2 欠账 |
| `production-conformity` | `platform-boundary-gates/cli.mjs:141` 硬编码 13 个 migration（磁盘 18） | 改为动态派生 |

在仪表失灵时先做全仓路径迁移，等于"不知道自己有没有弄坏"。而修好这 4 个红门的成本很低。
**故第一顺位是 P0 门真实化。** 但"仪表先修"不等于"结构先搬"——见 §3 的顺序修订。

## 3. 包与严格串行拓扑

> **顺序已修订（Codex 2026-07-28 指出，Claude 采纳并决策）。包 ID 全部不变，只改执行次序**
> ——重编号会打断两份文档里的全部交叉引用。

```
P0  →  P3-A/B/C  →  P1  →  P2  →  P4  →  P5  →  P6  →  P3-D  →  P7  →  P8
门     后端安全     ledger  结构   效率   前端   UI    授权UI   死码  复核
```

**为什么把 P3 的后端切片提到 P1/P2 之前**（原顺序是 P0→P1→P2→P3）：

1. **技术上没有前置关系**。P3 的安全修复与 P2 的目录搬迁 + 98 文件 package 重命名之间
   不存在依赖，把安全排在搬迁之后是纯粹的排序错误。
2. **代价不对等**。当前 20 个业务写端点**零能力校验**（P-D0，任何有效工作区会话可越权写）。
   让这个洞等一次全仓搬迁做完，风险敞口与收益完全不匹配。
3. **反向更省**。搬迁是纯机械移动，不关心目录里装什么代码；先搬后修则要求 P3
   在刚变动过的全新路径上工作，风险更高。

**P3-D（品牌授权改单项增删）拆到 P6 之后**：它的后端与契约部分随 P3-A/B/C 一起做，
但前端部分（抽屉改列表、逐行取消、单选添加）依赖 P6 的 UI 基建，故前端切片排在 P6 后。

包级串行，上一包 exit 真绿才开始下一包。包内按文件或 capability 小步串行。

每包只有两种控制状态：`ACTIVE_RED_VERIFIED` 或 `OUT_OF_SCOPE_THIS_PACKAGE`（写明 owning package）。
**禁止 `PENDING`。**

**baseline-red 处置规则**（前一稿缺失，盲审 M8 指出）：P-0 的入口 baseline 允许存在已知红门，
但必须逐条登记 owning fix；**P-0 之后任何包的入口 baseline 必须全绿**。

### P3 与 P6 的契约时序规则（Codex 指出的冲突，已采纳）

P3 要为全操作面建立 `x-required-capability` 声明，而 P6 会**删 5 个旧邀请 operation、
加 2 个 OTP operation**——P3 无法先宣称"全量操作面已闭合"再允许 P6 改分母。

**裁决（Claude）：P6 的 exit 只负责重跑其拥有的 A4/A5；P3-D 在不改契约的前提下重跑 A1–A5。**

**该"全量契约不变量"必须是确定分母、单一入口的 checker，且断言按包分层（Codex 三轮指出，已采纳）**

> **三轮否证**：二轮版本把"5 个 invitation 已退役、2 个 OTP 已存在"写进 P3 的断言，
> 而这两件事在 **P6** 才发生——checker 在 P3 exit 永远变不绿，与"截至 P3 时点"自相矛盾。

**统一入口**（由 P3-A 建立，各包只挑属于自己的断言）：
从 `contracts/openapi/` 的 `x-consumer-faces` **动态派生**当前 operations 写面，不手工列举。

| 断言 | 由哪个包的 exit 负责 |
| --- | --- |
| A1 当前 operations 写面**每项恰有一个** `x-required-capability`（缺/多各有具名红） | **P3-A** |
| A2 server catalog（`WorkspaceAuthorizationCatalog`）与前端常量（`generatedAdminCatalog.ts`）**同源一致** | **P3-A** |
| A3 旧 `PUT .../brand-authorizations` 计数 = 0；`POST` + `DELETE` 存在且**精确绑定 `BC-ORG-HEAD-COMPANY-BRAND`** | **P3-B** |
| A4 5 个 platform-face invitation operation 计数 = 0；2 个 OTP operation 已纳入且满足 A1 | **P6** |
| A5 最终 face 分母 = **104**（36 / 57 / 11） | **P6** |
| 重跑 A1–A5 全绿，**且本包不再改变契约** | **P3-D** |

**红变异**：删掉任一写 operation 的 `x-required-capability`，或给某个加第二个 → A1 必须红并指名；
把旧 `PUT` 加回契约 → A3 必须红。

P3 的 exit 措辞固定为「**截至 P3 时点**的 operations 写面已闭合（A1+A2+A3）」，
不得表述为"全量操作面已闭合"。

### R-26 的边界（Codex 指出，已采纳）

可以 `DEFERRED to RM2` 的**只有既有的、行为尚未稳定的 legacy L2**（那 18 个）。
**RM1 本轮改写出来的新行为——P3/P3-D/P5/P6 的每一处——必须在当包配测试契约，不得借 RM2 延后。**
不写死这条，「详设必须有测试用例」会被 `DEFERRED` 架空。

### 红变异的执行节奏（Codex 建议，已采纳）

红变异必须真实，但**不应每次日常 `verify` 都重跑全部 scratchpad 变异**（会把分钟级入口拖垮）。
分两档：

- **控制发生变化时**（新增/修改门、改判据、改分母）：执行完整红证据，进 receipt。
- **日常分钟级入口**：只验证控制**仍被引用**且**输出有效**，不重跑变异。

### 四个过程闸口（承接 R-16）

1. **文件级增量合规**：写后对本次改变的文件立即静态核对。纯静态，不需要 gradle/docker
2. **测试前全量扫描**：两层且都要绿——source-derived aggregate + 从 gate catalog 动态解析的独立静态门
   （aggregate 的 PASS **不得覆盖**独立门的 FAIL）
3. **红先于绿**：`--self-test` 的 baseline 必须是**未经改写的当前树**（P-C1 的直接教训）
4. **包级 exit receipt**：`actualChangedPaths` 由**工作树独立枚举**，与非空 `incrementalChecks`
   做 exact set equality；缺/多/空/越界各有具名红

---

## 3b. 可验收映射表（原"全覆盖对账表"已升级）

> **Codex 2026-07-28 指出并被采纳**：原表只有「问题 → 包名」，那是**包名映射不是可验收映射**。
> "表格看起来全覆盖"不等于分母可做 set-equality。**本节格式已升级为七列。**

**每一条必须固定为：**

```
issueId → delivery unit → owning paths → concrete action → red mutation → exit assertion → deferred reason(若有)
```

> **R-27 尚未闭环（Codex 二轮指出，如实标注）**：§3b.1 当前仍是**三列包映射**。
> 这是设计如此——后三列由详设填写——但**不得据此宣称 R-27 已完成**。
> R-27 的闭环判据是：详设首项产出 57 条**逐行七列**，且 §3b.4 新补的 8 项
> **进入各 owning package 的 scope 与 exit**，而不是停在归属表里。

**这是 Codex 详设的第一个交付物，不是 Claude 代填。** Claude 只给出包归属与必须覆盖的条目集合；
`concrete action` / `red mutation` / `exit assertion` 三列由 Codex 在详设中逐行填写，
**填不出来的条目必须显式标 `DEFERRED` 或 `NOT_APPLICABLE_WITH_REASON` 并给理由**，不得留空。

### 3b.1 条目集合与包归属（Claude 侧的分母，57 条）

| 条目 | 归属包 | 备注 |
| --- | --- | --- |
| P-C1 P-C2 P-C5 P-X6 | **P0** | self-test 自我豁免、被引用门可打红、`pageRegistry` 可达性断言、三个伪门降级。**P-C5 先前零覆盖，现明确落 P0** |
| P-C3 | **P0**（第一次）+ **P2**（重组后第二次） | `affected-l2` 分母与布局脱节，两次修正各自登记 |
| P-X2 P-X5 ST-7 | P0 | 硬编码密钥/分母 |
| P-D0 P-D0b P-D0c P-D1 P-D2 P-D3 P-D4 P-D5 P-D6 P-N1 P-R7 P-X1 P-X4 | **P3-A/B/C** | 安全（**已提前到 P1/P2 之前**）。P-R7 先前 P3 范围清单漏列，现补入 |
| R-24 后端+契约 | **P3-B** | 品牌授权单项增删的 API 与 owner 侧 |
| P-B1 P-B2 | P3 | 邀请状态闭集、门店启停 |
| **ST-3 ST-4 ST-8** | **P1** | 由 P1 直接关闭 |
| **ST-9** | **P1 登记，实作归 P5** | exit assertion 写在 P5 |
| **ST-2 ST-6 ST-11** | **P1 登记，实作归 P6** | exit assertion 写在 P6 |
| **ST-7** | **P0** | 不进 P1 ledger，由 P0 receipt 独立关闭 |

> **7-ID 集合固定为 `ST-2 / ST-3 / ST-4 / ST-6 / ST-8 / ST-9 / ST-11`**（Codex 四轮指出，已改）。
> 先前稿写的 **ST-1 与 ST-5 不存在**——清单 §11 的成立集合是 `ST-2/3/4/6/7/8/9/11` 共 8 条，
> 减去归 P0 的 ST-7 恰为上述 7 条。写错编号会直接造成 P1 假绿。
> **P1 / P5 / P6 / P8 四处必须引用同一个 7-ID 集合，不得各写各的。**
| P-A1 P-Q6 | P2 | 结构重组；`business-page/model.ts` 位置错随之挪 |
| P-A2 | — | **作废**，不产生工作项 |
| P-E1 P-E2 P-E3 P-E5 P-E6 P-E7 P-E8 **P-E9** P-R8 | **P4** | 效率。**P4 的真实分母以 P-E9 的枚举集合为准（M1–M13 + S1–S5 + 原 6 处）** |
| P-E4 P-Q2 P-Q3 P-Q4 P-Q9 P-R1 P-R2 P-R3 P-R4 P-R5 P-R6 P-X3 | **P5** | 前端架构。P-R6 先前零覆盖，现补入 |
| P-Q1 P-Q5 P-Q7 P-U1 P-U2 P-U3 P-U4 P-U5 | **P6** | UI 与 v2 吸收 |
| R-24 前端 | **P3-D（排在 P6 后）** | 抽屉改列表，依赖 P6 的 UI 基建 |
| P-Q8 P-X7 P-X8 | **P7** | `expandPath()` 两份重复 + 两份 `tsconfig.json` 零差异、`JSON.parse` 解析 `.yaml`、`EdgeContextVerifier` 死代码。**后两条先前零覆盖，现补入并要求 P7 写出具体整改动作** |
| P-C4 | **P8**（`HISTORICAL_EVIDENCE_DEBT`，**仍在 57 条内**） | concrete action = 产出 transfer manifest；exit = 三个 canonical debtId 的 exact set equality。三个 ID 见清单 P-C4 条目 |

**去重说明**：`P-X9` 与 `P-Q9` 是同一个 `eslint-plugin-react-hooks` 缺失，合并计一条。
59 个 `P-*` 标签 − 作废的 `P-A2` − 该重复 = **57**（Codex 独立复算一致）。

### 3b.2 P1 改为跨包 ledger（Codex 指出的假绿，已采纳）

**原设计缺陷**：P1 排在 P5/P6 之前，却要求 ST-2/ST-6/ST-11/ST-9 满足"某语义出现次数=1"，
而这四条的实作分别在 P6 与 P5。**只能产生假绿或永久阻塞。**

**修订**：

- **P1 的 ledger 覆盖且仅覆盖这 7 个 ID**：
  **`ST-2 / ST-3 / ST-4 / ST-6 / ST-8 / ST-9 / ST-11`**。
  ST-7（硬编码分母）是 **P0 的产出，由 P0 receipt 独立关闭**，不进 ledger。
  （清单 §11 成立集合 = `ST-2/3/4/6/7/8/9/11` 共 8 条，减 ST-7 = 7 条。
  先前稿写的 ST-1、ST-5 **不存在**，是作者编号错误，已由 Codex 四轮指出。）
  P8 把 P0 receipt 与 P1 ledger **合并对账**，断言两者并集恰为 8 条、无缺无重。
- **P1 的产出是一份"单一权威 ledger"**——逐条声明：这个语义的 **authority source 是哪一个**、
  合法消费者有哪些、消费者如何可追溯到 authority。P1 的 exit 是 ledger 完整且每条有 authority，
  **不是"仓内出现次数=1"**。
- ST-2/ST-6/ST-9/ST-11 的**实际关闭**由 P5/P6 各自负责，其 exit assertion 写在那两包里。
- **P8 复核 ledger 与实际状态一致。**

**同时废除"出现次数=1"作为泛化机器门**（Codex 建议，采纳）：它分不清唯一权威源与合法的
generated consumer / type / UI 使用点，容易诱导删除正确代码。
改为：**一个 authority source + 每个消费者可机械追溯到它**。

### 3b.3 P-C4 的历史证据债不由 RM1 修（Codex 指出，已采纳）

原写"由 P8 补齐或显式标欠账"是含糊的，且**P8 不可能补造历史 red proof**——
CR05/CR06 当时没跑，事后造出来的不是证据。

**改为**：P-C4 统一标 **`HISTORICAL_EVIDENCE_DEBT`**。
**它仍在 57 条分母内**（Codex 四轮指出先前表述前后矛盾，已定）——
P-C4 是清单条目、必须被交代，只是它的 `concrete action` 是"产出 transfer manifest"而非"修"，
`exit assertion` 是三个 canonical debtId 的 exact set equality。57 不变，不另立并列分母。

> **机械化方式（Codex 二轮指出"P8 尚不能机械证明已结转"，已采纳）**：
> **现在不创建 RM2**（RM2 是否存在取决于 RM1 的结果，提前创建就是凭空造分母）。
> 改为：**P8 产出一份三行、可机读的 transfer manifest**，例如
> `doc/evidence/platform/<date>-rm1-p8-historical-evidence-debt-transfer.json`，
> 每行含 `debtId / 事实描述 / 为何 RM1 不修 / 承接方 = RM2`。
> **约束写在 manifest 自身与 R-25 里**：任何 RM(n+1) 的输入分母校验**必须要求该 manifest 为强制子集**，
> 缺一条即下一轮分母不完整。
> **"三行 + schema 有效"不够（Codex 三轮指出，已采纳）**：任意三条假记录都能通过。
> 改为 **exact set equality**：
> 期望集合是清单 P-C4 条目定义的**三个 canonical debtId**（权威拼写，不得改写或另起别名）：
> `HED-1-CR05-CR06-COMPILE-TEST-RECEIPT`、`HED-2-ACTIVE-RED-VERIFIED-NO-MUTATION-ARTIFACT`、
> `HED-3-SURFACE-21-OF-22-ZERO-L2`。manifest 的 `debtId` 集合必须与之**完全相等**。
> **红变异四类，逐一验证**：缺项 / 重复或未知 `debtId` / 承接方非 `RM2` / 字段失真，各必须红并指名。
> **措辞约束**：P8 只能声明「**transfer artifact 已准备**」，
> **不得宣称「RM2 已接收」**——RM2 此刻还不存在。

### 3b.4 从 Codex 诊断合并时漏掉的条目（现补入并给归属）

Codex 2026-07-27 那份诊断里的以下事项在合并时被 Claude 漏掉，现登记：

| 条目 | 归属包 |
| --- | --- |
| 商业集团初始化 replay 重复追加审计、缺 owner task-read 合并 | **P3-B** |
| seed executor 固定失败、资产 fixture 缺失 | **P7** |
| seed 仍依赖 `PROPOSED_REVIEW_ONLY` 的旧 fixture contract | **P7** |
| 审计 UI 的 `actionSummary` 展示技术动作而非业务语义 | **P6** |
| foundation 的 overlay lock / `onDiagnosticEvent` lifecycle 接线（现清单只覆盖 dirty guard） | **P5** |
| dev/test runner 的日志脱敏、stdout/stderr、远端目标绑定 | **P0** |
| 现行 Roadmap 的 `CURRENT_*` 与"R5 已叫停"不一致 | **P0 前置，见 §3c** |
| 旧 104/38/55/11 证据分母的适用范围与替代关系登记 | **P8**（只登记，不重写历史证据） |

**已由 Codex 主动退役、不再作为活跃问题**：「资产写侧拒绝视频」——
`PlatformAssetService` 当前已允许 `video/mp4`，代码状态已取代该诊断。

## 3c. P0 的两个前置（必须在 P0 开工前完成）

**一、状态 owner 必须先更新（Dexter 的动作，Claude 不代写）。**
现行 `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` 仍显示 R5 正在实施且已授权。
不先处理，新会话可能据此恢复旧实施——这是治理漏洞不是文档瑕疵。
需要把 R5 标为 halted/superseded，并写明 RM1 的 phase ownership。**措辞由 Dexter 定。**

**二、RM 系列的注册必须提到 P0（Codex 指出依赖方向倒置，已采纳）。**
原稿把 `roadmap-program-registry.json` 的 RM 系列注册放在 P8，而 P0 就要用 `--phase RM1`。
**注册移入 P0，且必须在 `phaseOrder` 加 `["RM1", 5.5]` 之前完成。**


---

## RM1-P0 ｜门真实化（含造成红的生产缺陷）

**范围**：

- 删除 `prepareSelfTestClean()`（P-C1）；baseline 改为未改写的当前树，baseline 不绿即 FAIL。
  **注**：盲审实测 `budget --self-test` 仍 FAIL（该函数改的是 `PlatformAuthenticationService`，
  真红在 `ExtensionCommandReceiptService`），故是"3 个 action 里 2 个被伪绿"，不是全部
- `code-layout --self-test` 三处 `mkdtempSync()` 空目录改为仓库拷贝
- `standards-coverage` 增加"被引用门必须能被打红"（P-C2）；**先证明能拒绝 `exit 0` 桩再算数**
- **修 4 个红门的生产缺陷本身**（P-X2、P-D3）。`logging` 这一项必须**两件事一起做**，
  否则是假绿（第三轮盲审用正则微测证明）：
  1. 把两处 test-only 密钥移出 main 源码——`WorkspaceLoginRateLimitService:21`
     与 `PlatformAuthenticationService:55`（**全仓同类站点共 2 处，先前稿写 3 处是错的**）。
     注意 `:21` **不能直接删**：它被 main 源码里 `WorkspaceAuthenticationService.java:34` 的
     public 6 参构造器调用（生产装配走 `:35-36` 的 11 参 `@Autowired` 路径，故不构成生产泄漏，
     但"只在包内测试隔离"的说法不准确）。
  2. **同时收紧门本身**。`cli.mjs:419-425` 是逐行正则
     `/(?:password|otp|token|authorization|secret)\s*[=:]\s*["'`][^"'`]+/i`，
     **只匹配赋值形态**。盲审实测：把 `:21` 改写成 `PlatformAuthenticationService:55` 已在用的
     **位置实参**写法，**密钥一字不改，门就绿了**。门对 2 个结构相同的站点红 1 漏 1。
     只做第 1 步得到的是一个仍漏 `:55`、可被平凡绕过的绿门。
     **红变异**：把密钥以实参形态写回，门必须红。
- 
  `legacy-test-source` 两处生产可达重载去掉（SOURCE 维度当前被塌成单桶）、
  extension/asset 换 advisory lock
- **ST-7 硬编码分母改派生**。先前稿写"三处"且含清单里不存在的 `database-boundaries 的旧 15`，
  已作废。以清单 §11 ST-7 的枚举为准，并注意 **106 被两个不相干的分母共用**
  （106 个错误码 vs 106 个 operation = 39+56+11），
  `verify-gates/cli.mjs:218/336/397`、`platform-boundary-gates/cli.mjs:81`、`edge-codegen.mjs:130`
  **不是同一族**，修好一个不满足另一个，必须逐个指明它派生自哪个分母
- `affected-l2-registry.json` 的 `paths` 修正（**先修一次，P-2 重组后再修一次**——
  这是方案 B 无法避免的两次，故在两包各登记一次，不留隐性依赖）
- `database-boundaries` 补 `bytea|base64|object_key|bucket_name` 扫描（现为零实现）
- `security-boundaries` 从"类名在文件里出现"收紧到"handler 方法体内出现调用"
- 另三个伪门降级（P-X6）：`traceability`/`terminology` 的 `regex.test(docA+docB)`、
  `retirement` 的两 grep —— 按矩阵 schema 改 `UNENFORCEABLE_BY_MACHINE` + `reviewChecklistRef`
- 补 `gradlew` + wrapper；`verify.mjs` 改 `./gradlew`，删本机 colima 绝对路径，
  走仓内已有的 `r5-remote-testcontainers.mjs`；cleanup 移入 `finally`
- `provider-free-context` 的 skill 分母订正（蓝图"五个"→ 8）
- 补 `standards-coverage-matrix.json` 的 RM1 phase 行
- **`scripts/check/standards-coverage:10-16` 的 `phaseOrder` Map 加 RM1**（当前 `--phase RM1` 直接
  `UNKNOWN_PHASE` 硬失败，即整个 RM1 无法跑 phase 门）。
  该 Map 用于 `enforcementPhase <= phase → PLANNED_ENFORCEMENT_OVERDUE` 的序比较，
  故序号必须反映真实先后：RM1 在 R5 之后、R6（全量复验与移交收口）之前。
  **改法（第三轮盲审改正，比作者原建议更小）**：`phaseOrder` 的值只参与 `<=` 数值比较，
  不要求整数也不要求连续，故**只加一行 `["RM1", 5.5]`，不动 R6**。
  作者原建议的"R6 从 6 改 7"是不必要的重编号，会引入跨文件一致性义务
  （`CLAUDE.md:75` 的 `--phase <R2|R3|R4|R5|R6>` 词表、`scripts/README.md:50`）。

  > **必须同时改，否则整个改动不生效**：`tools/verify-gates/verify.mjs:19` 硬编码
  > `['U12-standards', 'scripts/check/standards-coverage', ['--phase', 'R5']]`。
  > 只加 `phaseOrder` 条目，`scripts/verify` 永远还是跑 R5，**RM1 分支一次都不会执行**。

  > **诚实披露**：`phaseOrder` 的序号比较（`:271` `PLANNED_ENFORCEMENT_OVERDUE`）
  > **当前是死代码**——矩阵 150 条规则**全部是 `ACTIVE`，`PLANNED` 一条都没有**，
  > 且 `enforcementPhase` 取值只有 R2/R3/R4/R5，没有 R6 也没有 RM1。
  > 所以本项的真实作用只是**打开 `--phase RM1` 的入口**，判定分支在 RM1 期间仍不可达。
  > 不得把它算作"一道生效的门"。
  > 另：`PHASE_DUE_FAILS` **不是 checker 的失败码**，它是 project-memory 的 assertion key，
  > 先前稿把二者并列是范畴错误。

  同步修正：`CLAUDE.md:75` 的 phase 词表、`scripts/README.md:50` 示例、
  矩阵自身的 `currentPhase: "R2"` / `roadmapStep: "R2"`（早已与 R5/R6 现实脱节且无人校验）。
- **`affected-l2`（Dexter 已裁决：标 `DEFERRED`；作者原"删 surface"建议已被第三轮盲审否决）**

  > **红因先前写错**：实跑失败码是
  > `R5_AFFECTED_L2_TARGET_MISSING:apps/frontend/operations-admin/src/tests/l2/authentication.spec.ts`
  > （`cli.mjs:441` 的 `assertFile`），**18 个 spec 文件不存在**。
  > `surfaces.length` 实测 = **25**，`25 < 24` 为 false，那句硬编码**当前是绿的、不是红因**。
  >
  > **作者原建议会制造新假绿**：被守护的表达式本身就是 `surfaces.length < 24`；
  > 把 `24` 改成"从 registry 派生"即 `x < x`，**恒 false、门永不触发**。
  > 叠加"只留有 spec 的 surface"就是 registry 由文件系统派生、再拿去校验文件系统。

  **四条，缺一不可：**

  1. **18 条标 `DEFERRED` + 强制到期 phase**（Dexter 2026-07-28 裁决）。
     registry 每条加 `deferredUntilPhase`，`assertFile` 见 `DEFERRED` 则跳过；
     **一旦当前 phase ≥ `deferredUntilPhase` 而 spec 仍不存在，门自动转红并指名该文件**。
     本批统一 `deferredUntilPhase: "RM2"`。
     理由：RM1 的 P3-D/P5/P6 正要大改前端与交互，现在写的 L2 改完即作废；
     测试应在被测行为稳定后写。**依 R-25（RM 是系列），"到期"有真实落点，不是空头承诺。**
     **红变异**：把 phaseOrder 调到 RM2 跑一次，18 条必须全红。
  2. **不删 surface**。登记面是外部锚定的事实，缺测试不等于该功能不存在。
  3. **保留下界，只换分母来源**：把魔数 `24` 锚到**门之外**的真实产物——
     `closure.r5FrontendSurfaceCount`（实测 = 22，已被 `cli.mjs:435` 独立校验），
     或在 registry 增 `expectedSurfaceCount` 并与冻结 Roadmap 的 surface 清单对账。
     **下界本身必须留**——它是唯一一道防 registry 被截断后仍走 `ALL_R5_L2` 兜底"正常通过"的控制。
  4. **修 `prepareSelfTestClean`（`cli.mjs:452-457`）**：它当前为每个缺失 target 写入
     `"// self-test fixture only\n"` 空壳，**self-test 自己造绿而生产态是红的**——
     与 P-C1 同族的假绿。红控制必须来自变异 registry，不是变异文件系统。
     **禁止以任何形式生成空壳 spec。**
  5. **删除已裁决 `DEFERRED` 后仍残留的候选分支**（Codex 四轮指出，已加）：
     `prepareSelfTestClean` 与 registry 处理逻辑里任何"缺 target 就造壳 / 就降级 / 就跳过"的旁路，
     在 `DEFERRED` 机制落地后**必须删除**，不得与新机制并存——两套处置并存本身就是假绿温床。

  另记：`affected-l2` 相关的势有 **6 个互不对账**：21（实际绑定 distinct `targetPath`）/
  22（`r5FrontendSurfaceCount`）/ 23（distinct tests）/ 24（门里的魔数）/ 25（`surfaces.length`）/
  30（`paths`，其中 12 条指向不存在路径）。P0 必须给出一张显式映射表，不得只修其中一个。
  **`paths` 的 12 条脱节在 P2 搬迁后需要第二次修正**，已在 P2-7 登记。

**完成判据**：4 个红门全绿且**红因已在代码侧消除**（不是改门迁就）；每条修复的门有真实变异红证明；
把任一被引用门换成 `exit 0`，`standards-coverage` 必须红；`scripts/verify` 本机可完整跑完。

---

## RM1-P1 ｜单一真相收敛（清单 §11 的 8 条 ST（其中 ST-7 归 P-0，本包做 7 条））

> 原稿 12 条中 ST-1、ST-5 事实被证伪，ST-10 误用，ST-12 升为 P-D0。**本包只做成立的 7 条。**

**范围**：ST-2（错误文案，与 P-6 的 R-3 合并做）、ST-3（页面标题归 catalog）、
ST-4（**遍历有序 `platformPages` 数组，不新增 `menuOrder` 字段**）、ST-6（`fieldLabels` 单一来源）、
ST-8（affected-l2 布局真相）、ST-9（写后刷新收敛为一种，随 P-5 落地）、ST-11（写能力归位，随 P-6）。

**完成判据（R-29 重写）**：P1 的产出是**单一权威 ledger**——逐条声明该语义的
**唯一 authority source**、合法消费者清单、以及每个消费者**可机械追溯到 authority** 的路径。
exit = ledger 完整且每条有 authority。
**不是"仓内出现次数=1"**：该判据分不清唯一权威源与合法的 generated consumer / type / UI 使用点，
会诱导删除正确代码，已由 R-29 废除。
ST-2/ST-6/ST-9/ST-11 的**实际关闭**由 P5/P6 各自负责（exit assertion 写在那两包），P8 对账。

**注**：ST-7 已在 P-0；ST-1/ST-5 删除的理由见清单 §14 —— `workspaceRequirement` 与
`dataNodeCandidates` **已端到端存在**，真实缺口只是前端 Shell 未消费，属 P-5/P-6。

---

## RM1-P2 ｜结构重组（R-1，方案 B）

**范围**：**10 个** Gradle 子项目从 `libraries/backend/` 搬到
`apps/backend/catering-business-server/modules/`，保留子项目边界，**顶层不再有 `libraries/`**。
（先前稿写"9 个"是错的：9 是 `catering-business-server` 的**直接依赖数**，
`audit-contract` 由各模块传递依赖，未被 app 直接依赖。全仓 Gradle 子项目共 **12** 个 = 2 app + 10 module。）

### P2-1 逐项搬迁表（唯一权威映射，Codex 不得自行增删）

| # | 现路径 | 新路径 | 新 Gradle 坐标 | java 数 | 改名 |
| --- | --- | --- | --- | --- | --- |
| 1 | `libraries/backend/platform-foundation` | `…/modules/foundation` | `:apps:backend:catering-business-server:modules:foundation` | 3 | 去 `platform-` 前缀 |
| 2 | `libraries/backend/platform-access` | `…/modules/execution-context` | `…:modules:execution-context` | 3 | 按内容改名 |
| 3 | `libraries/backend/audit-contract` | `…/modules/audit-model` | `…:modules:audit-model` | 8 | 去 `contract` 歧义 |
| 4 | `libraries/backend/extension` | `…/modules/extension` | `…:modules:extension` | 6 | 不变 |
| 5 | `libraries/backend/platform-asset` | `…/modules/asset` | `…:modules:asset` | 5 | 去 `platform-` 前缀 |
| 6 | `libraries/backend/platform-iam` | `…/modules/platform-admin-iam` | `…:modules:platform-admin-iam` | 5 | 前缀改为指代运维后台 |
| 7 | `libraries/backend/organization` | `…/modules/organization` | `…:modules:organization` | 26 | 不变 |
| 8 | `libraries/backend/contract` | `…/modules/store-contract` | `…:modules:store-contract` | 7 | **必改**（见 P2-3） |
| 9 | `libraries/backend/platform-workspace` | `…/modules/workspace` | `…:modules:workspace` | 15 | 去 `platform-` 前缀 |
| 10 | `libraries/backend/workspace-iam` | `…/modules/workspace-iam` | `…:modules:workspace-iam` | 20 | 不变 |

`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/`
（`bootstrap` 2、`configuration` 2、`edge` 255）**原地不动**。
`apps/backend/terminal-data-server/` 当前 **0 个 java 文件**（只有 `README.md` + `build.gradle.kts`），保持不动。

### P2-2 依赖分层（从现有 `build.gradle.kts` 实测得出，非新增约束）

| 层 | 模块 | 只允许依赖 |
| --- | --- | --- |
| L0 | `foundation`、`audit-model`、`execution-context` | 无（三者均零 `project(...)` 依赖） |
| L1 | `extension`、`asset`、`platform-admin-iam` | L0 |
| L2 | `organization` | L0、L1（实测依赖 `extension`） |
| L3 | `store-contract`、`workspace` | L0–L2（实测依赖 `organization`） |
| L4 | `workspace-iam` | L0–L3（实测依赖 `workspace`） |

现有依赖图**已无环且恰好落在这 5 层**，故本表是把既成事实显式化，**不改任何 `build.gradle.kts` 的依赖内容**，
只改坐标字符串。规则：只能向下依赖，**同层之间不得互相依赖**——由 Gradle 编译期保证，不新建门。

### P2-3 三处改名的理由（不是审美，是现有命名的实际缺陷）

1. **`contract` → `store-contract`**：它是**门店合同业务域**
   （`StoreContractReadback`、`ContractCommandService`、`BusinessDateProvider`），
   却与仓库根 `contracts/`（OpenAPI 契约）撞名。此撞名已实际造成误读（作者本人误判过一次）。
2. **`audit-contract` → `audit-model`**：8 个纯 record、零依赖，是数据形状不是契约，同受 `contract` 一词污染。
3. **`platform-` 前缀一词两义**：`platform-foundation`/`platform-access` 指**平台层**，
   `platform-iam`/`platform-workspace`/`platform-asset` 指**运维管理后台的业务**。
   新命名里平台层不带前缀；`platform-admin-iam` 保留前缀是因为它确实指"运维管理后台"这个具体后台。

**Java package 同步对齐**（`com.catering.v2s.platform.workspace` → `com.catering.v2s.workspace` 等）。
理由：6 个 `XxxBoundary.java` 标记类、ArchUnit 规则、
`module-dependency-registry.json` 的 `commandApiPackages` **全部按 package 判定**；
不对齐就会留下"目录说 A、package 说 B"的第二套真相（违反 R-5 单一真相）。
这是 98 个文件的机械重命名，`commandApiPackages` 9 条同步更新。

### P2-3b `Membership` → `User` 全量改名（R-23，与模块改名同批做）

**理由不是审美**：契约层已有 10 处说 `Users`（5 个 pageDesignKey `PgIam*Users` + 5 个
routeSegment `access/*-users`），只有 service/controller/wire/feature 一层说 `Membership`
——这是 R-5 单一真相违反。且 `会员` 一词必须留给将来真实的顾客会员业务（R-23，Dexter 裁决）。

**改动面 —— 分母必须先冻结再动手（Codex 2026-07-28 指出，采纳）**：
先前稿的"292 处 / 36 文件"已作废；清单侧写的"55 文件 / 383 处"与"代码侧 23/202"也**不是可复现口径**。
**P2-3b 的第一个动作是产出一份《rename 分母冻结说明》**，显式声明：
搜索根、大小写变体（`Membership`/`membership`/`MEMBERSHIP`/`Member`）、
是否含生成物、是否含 `doc/evidence` 与 `doc/plans` 历史材料、是否含 `.sql` 注释。
冻结后再重算，**该数字与冻结说明一起进 receipt**，此后以它为唯一分母。
在此之前任何"共 N 处"的表述都不得作为 exit 判据。

| 层 | 现 → 新 |
| --- | --- |
| service | `WorkspaceMembershipService` → `WorkspaceUserTaskReadService`（5 方法全 `readOnly`，合仓内 `*TaskReadService` 约定） |
| operationId | `getOperationsWorkspaceMembership` → `getOperationsWorkspaceUsers` |
| operationId | `getOperationsWorkspaceMembershipAccount` → `getOperationsWorkspaceUser` |
| operationId | `revokeOperationsWorkspaceMembershipAssignment` → `revokeOperationsWorkspaceUserAssignment` |
| schema | `WorkspaceMembershipPage` → `WorkspaceUserPage` |
| schema | `WorkspaceMembershipRevoke{Request,Result}` → `WorkspaceUserAssignmentRevoke{Request,Result}` |
| 错误码 ×4 | `WORKSPACE_IAM_MEMBERSHIP_*` → `WORKSPACE_IAM_USER_*` |
| controller | `OperationsWorkspaceMembershipController` → `OperationsWorkspaceUserController` |
| 前端 | `features/workspace-membership/` → `features/workspace-users/`；`WorkspaceMembershipPage.tsx` → `WorkspaceUsersPage.tsx` |

**`WorkspaceAccountService` 不改名**——它是 `workspace_iam.workspace_account` 表的 owner，与表名一致是对的。

**顺序（契约驱动，不得反）**：先改 `contracts/openapi/` → regenerate → wire type 与前端 generated client 随之产出。
**不得手改 generated 文件**，否则下次生成即回退。

**判据（Codex 二轮指出原判据不完整，已重写）**：

先前只查 `membership`，与本节自己要求"必须纳入 `Member`"矛盾。**冻结清单与 set-equality 必须同时覆盖**：

| 必须纳入冻结清单的形态 | 说明 |
| --- | --- |
| `Membership` / `membership` / `MEMBERSHIP` | 原口径 |
| `Member` / `WorkspaceMember*` | 3 个 wire 类型 + schema，47 处引用 |
| `.member()` 方法与 `.Member` record | 领域层 |
| HTTP URL 路径 | `/membership`、`/membership/accounts/{id}`、`/membership/assignments/{id}/revoke` |
| generated names | `EdgeProblemCode`、wire 类名、`*-edge.ts`、`edge-route-face-registry.json` |
| **活跃** carry-over manifest | `contracts/policy/frontend-asset-carryover-manifest.json` 的 `targetPath` / `generatedSlice` / `focusedEvidence` |
| route / L2 / architecture 引用 | `pageRegistry.tsx`、`static-boundary.test.mjs`（按**文件路径**读，改目录即 ENOENT） |
| 错误码生成权威 | `doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json`（**在 `doc/plans` 下但是活跃输入，不属"历史材料"**） |

**"历史材料不改"与"全仓 grep = 0"必须用同一个搜索边界**（Codex 指出，先前是两个口径）：
冻结说明里显式列出排除路径集合 `E`，此后
`grep` 判据固定表述为「**在 `全仓 \ E` 范围内，上表全部形态的命中数 = 0**」，
且 `E` **必须逐条给排除理由**——`doc/evidence`、`doc/review` 的历史 receipt 可排除；
`doc/plans` 的错误码 catalog、`contracts/policy` 的 carry-over manifest **不得排除**。

**无新增 migration**（已亲验：DB 里 `membership` 仅出现在一行 SQL 注释，表名列名一处没有；
`member` 单独出现亦为 0）。

### P2-4 明确不做

- **不改任何 SQL**（见完成判据 3）
- **不改任何方法签名、不改 registry 的边**（23 条边一条不增不减）。
  > **限定例外（Codex 三轮指出与 R-23 冲突，已明确）**：R-23 的重命名族
  > ——`.member()` → `.user()`、`.Member` record、`WorkspaceMember*` wire 类型、
  > `WorkspaceMembershipService` → `WorkspaceUserTaskReadService`——**是本禁令的显式例外**。
  > 该禁令的本意是"P2 不做语义变更"，而 R-23 的签名变化是**纯重命名、无行为改变**，
  > 且已由 P2-3b 的冻结分母与 set-equality 约束。实现者遇到两条同级要求时以本例外为准。
- **不预留顶层共享区**。只有当 TDP **真的需要**某模块、**且有代码为证**时才提取到顶层；
  今天 TDP 有 0 行代码，任何"为 TDP 预留"都是无证据猜测。
  届时的提取只是一次 `settings.gradle.kts` 路径修改，成本与今天预留相同——
  预留唯一多出来的是从现在到那天为止所有人的理解成本。
  **已否方案**：保留薄的顶层 `platform/backend/` 只放 L0 三个模块（14 个 class）——为 14 个 class
  维持一个顶层目录 + 一层构建坐标，代价大于收益。
- **不新建 ArchUnit 门**（Gradle 编译期强制已足够）

- **61 处**路径引用同步（实测：`*.gradle.kts` 冒号坐标 46 + `libraries/backend` 路径字符串 15/6 文件；
  先前稿的 60 已作废——算术不闭合，且 `scripts/README.md` 与 `verify-gates/verify.mjs` 实为 0 命中，
  真正的 9 处在 `verify-gates/cli.mjs`）（`r5-remote-testcontainers.mjs`
  + `scripts/README.md`）
- `module-dependency-registry.json` 补登 `foundation`（现名 `platform-foundation`）——
  它是 10 个模块里**唯一未登记在 `modules` 数组**的一个（实测 registry `modules` 仅 9 条）；
  `check.mjs:80-111` 的 `SOURCE_TASK_READ_UNDECLARED` **扩分母到新路径**（否则对账门静默失覆盖）
- `code-layout`/`backend-boundaries` allowlist 同步；`affected-l2-registry.json` 第二次修正
- 活文档与布局 decision 更新；**历史 review/evidence 36 个文件不追溯改写**
- 清 `libraries/backend/*/build/` 与 `.gradle/`

**Gradle 可行性**（作者已核，Codex 需复验）：`settings.gradle.kts` 用
`include(":libraries:backend:organization")` 声明，Gradle **默认按项目路径推导目录**。
故方案 B 的实际改法是：`include(...)` 路径与全部 `project(":libraries:backend:X")` 引用同步改名，
**源码目录随之搬迁**；package 按 P2-3 同步对齐（先前稿的"包名不变"已撤回）。**注意 P2-3 的 98 文件 package 重命名不在这 61 处之内**，是独立工作量。

**一个 Codex 必须决定并说明的细节**：新项目路径有两种取法——

| 取法 | 项目路径 | 含义 |
| --- | --- | --- |
| 嵌套在 app 下 | `:apps:backend:catering-business-server:modules:organization` | 语义最准（这些模块属于该 app）；但使 app 成为**有子项目的父项目**，个别 Gradle 插件对此行为不同，需实测 |
| 与两个 app 平级 | `:apps:backend:modules:organization` | 层级更常规；但"modules"又变成一个**面向未来 TDP 的共享区**，与 T-6 冲突 |

**作者倾向第一种**（语义准，且不预留共享区）；若实测有插件阻碍，改第二种并在 receipt 中记录实测原因。
**不得在未实测的情况下默认第二种。**

### P2-5 完成判据（第三轮盲审后重写）

> **盲审否证了原判据 3**：「SQL 字面量哈希前后一致」对纯目录移动是**同义反复**——
> SQL 里只有表名/schema 名，`git mv` + package 改名**不可能**改动它，哈希天然稳定，
> 判据无区分力，且抓不到下面任何一种真实翻车。此外本仓 SQL 大量拼接
> （`ContractTaskReadService.java:91-94` 用 `"SELECT COUNT(*)" + from + where` 组装），
> "SQL 字面量"不是良定义集合；而真正承载 schema 真相的 19 个 `.sql` migration 根本不在 `.java` 里。
> **原判据 3 作废。**

**这次搬迁最可能翻车的地方，盲审已定位为两波：**

**第一波（吵闹、易修）**——`BackendModuleBoundariesTest.java:91-92` 是
`assertTrue(Files.exists(root.resolve("libraries/backend/platform-workspace")))` 这样的**正向断言**，
搬迁后 `Files.exists` 返回 false、**assertTrue 大声失败**。
（先前稿说它会"静默假绿"是**错的**，方向恰好相反——它是少数几个能正确拦住迁移的控制之一。）
`cli.mjs` 里基于 `read(...)` 的行同样抛 ENOENT。这些几分钟就修完。

**第二波（安静、致命）**——把吵闹的修完之后，套件报绿，而下列门正在**对空文件列表迭代**：
`walk()`（`cli.mjs`）与 `walkFiles()`（`check.mjs:93`）对不存在的路径**返回 `[]`**，
`check.mjs:93` 的 `path.join(root, "libraries/backend", module.moduleKey, "src/main")` 搬迁后指向虚空。
就此静默失效的门：`SOURCE_TASK_READ_UNDECLARED` / `SOURCE_SCHEMA_OBJECT_DYNAMIC`
（**整个跨 owner 直读强制层**）、`R4_DATABASE_UNTYPED_ROW_OR_COMMAND`、
`R4_DATABASE_UNINJECTED_BUSINESS_TIME`、`R4_BACKEND_DOMAIN_FRAMEWORK_DEPENDENCY`、
`R4_BACKEND_CROSS_MODULE_INTERNAL_IMPORT`、`R4_BACKEND_DOMAIN_TRANSPORT_DEPENDENCY`、
`R4_BACKEND_WRITE_PATH_EXTERNAL_OR_EVENT_CHAIN`。

**判据：**

1. `libraries/` 目录**不存在**（`test ! -d libraries`）。
2. 全仓 grep `:libraries:` 与 `libraries/backend` = 0，**含**
   `BackendModuleBoundariesTest.java:91-92`、`check.mjs:93`、
   `cli.mjs:214/267/355/361/372/374/448/452/613`、
   `scripts/generate/edge-codegen.mjs:25`、`contracts/policy/affected-l2-registry.json:7`。
3. **【替代原 SQL 哈希，直击第二波】正分母断言**：搬迁后对每个模块的新 `src/main`
   跑 `walk()`/`walkFiles()`，**必须返回非零且等于预期计数**——
   逐模块：foundation 3、execution-context 3、audit-model 8、extension 6、asset 5、
   platform-admin-iam 5、organization 26、store-contract 7、workspace 15、workspace-iam 20，**合计 98**。
   任一为 0 即 FAIL。这是唯一能抓住"门静默变空"的判据。
4. **8 个测试文件的 Flyway 相对路径必须同步改**（盲审发现，先前稿完全遗漏）：
   `.locations("filesystem:../../../apps/backend/catering-business-server/src/main/resources/db/migration")`
   中的 `../../../` 是按 `libraries/backend/<m>` 这个深度算的；
   新路径 `apps/backend/catering-business-server/modules/<m>` 下正确前缀是 `../../`。
   涉及 `OrganizationOwnerServiceTest`、`ContractCommandServiceTest`、`ExtensionDefinitionServiceTest`、
   `PlatformAuthenticationServiceTest`、`WorkspaceRoleServiceTest`、`WorkspaceInvitationPublicFlowTest`、
   `PlatformAssetServiceTest` 等。**不改则全部 DB 集成测试找不到 migration 而失败**
   ——而那正是你要用来证明搬迁安全的测试。
5. **`cli.mjs:613` 的红变异 fixture 写入 `libraries/backend/organization/…`**，
   搬迁后该变异落在**分母之外**，即"证明门能变红"的自测本身失效。必须同步改并重证。
6. **`budget()`（`cli.mjs:361`）的扫描范围会静默变宽**：它同时扫 `libraries/backend` 与 `appRoot`；
   模块搬进 `appRoot` 后，原本只覆盖 edge 代码的门会顺带覆盖 98 个模块源文件。
   必须显式决定是收窄还是接受，并在 receipt 记录。
7. `module-dependency-registry.json` 的 23 条边一条不增不减；`commandApiPackages` 9 条与新 package
   一一对上（机械对账）。
8. 编译期边界仍生效：**红变异**——在 `foundation/build.gradle.kts` 加一条对 `organization` 的依赖，
   Gradle 必须报循环依赖或编译失败。仅"跑绿"不算数。

> **注**：先前稿的"Gradle 子项目数 = 12（数 `settings.gradle.kts` 的 include 行数）"是**同义反复**
> （数自己文件的行再断言等于 12，永不可能红），已删。
> 另更正：`include(":a:b:c")` 会**物化中间容器项目**，实际子项目数是 12+4=**16**，搬迁后 12+3=**15**；
> 且根 `build.gradle.kts` 的 `subprojects { apply(plugin="java") }` 会把 java 插件与 toolchain
> 施加到这些无源码的容器项目上。

### P2-6 Gradle 项目路径的两种取法（Codex 必须实测后决定并记录）

| 取法 | 项目路径 | 含义 |
| --- | --- | --- |
| 嵌套在 app 下 | `:apps:backend:catering-business-server:modules:organization` | 语义最准；但使 app 成为**有子项目的父项目**，个别 Gradle 插件行为不同，需实测 |
| 与两个 app 平级 | `:apps:backend:modules:organization` | 层级更常规；但 `modules` 又变成**面向未来 TDP 的共享区**，与 P2-4 冲突 |

**作者倾向第一种**（语义准，且不预留共享区）。若实测有插件阻碍，改第二种并在 receipt 中记录**实测原因**。
**不得在未实测的情况下默认第二种。**

### P2-7 连带路径引用同步

`*.gradle.kts` 46 处冒号坐标 + `libraries/backend` 路径字符串 15 处/6 文件 = **61**
（第三轮盲审实测；先前稿的"60"算术不闭合，且 `scripts/README.md` 与 `verify-gates/verify.mjs` 实为 **0 命中**，
真正的 9 处在 `verify-gates/cli.mjs`）、`r5-remote-testcontainers.mjs`、
`code-layout`/`backend-boundaries` allowlist、`affected-l2-registry.json`、
活文档与布局 decision。**历史 review/evidence 36 个文件不追溯改写。**
清 `libraries/backend/*/build/` 与 `.gradle/`。

---

## RM1-P3 ｜安全

**范围**（P-D0 排首位）：

> **本包按 R-20 重写**：运营端授权模型 = **读校验范围、写校验范围 + 能力**，且必须有**统一处理入口**。
> P-D0 与 P-D0c 是**两条独立工作项**（第二轮盲审 M1：`...ForTarget` 只覆盖 5 个 IAM 页，
> 覆盖不了 20 个业务端点）。

**P3-A ｜统一授权入口 + 三层范围模型（R-20 第 6 条 / R-22，先做，后面两条都依赖它）**

> R-21（`x-scope-anchor`）**已撤回**。锚点声明是"查完再过滤"形状的产物；
> 改为**范围在查询构造时注入**后，锚点不再是需要单独声明的量。契约只新增 R-19 一个 `x-` 扩展。

```
edge 层统一入口（拦截器或共享 helper，只此一处）：
  1. 解析 session（已有：角色节点 + 写 capability + 可见数据节点）
  2. 范围：由 session 角色节点算出管理子树，在查询构造时注入 —— 不是查完再过滤
  3. 若 operation 声明 x-required-capability → 精确成员判定，禁前缀匹配   ← 只有写有
```

**三层范围模型（R-22，本包的核心形状）**：

| 层 | 落点 | 安全语义 | 失败 |
|---|---|---|---|
| ①授权范围 | 契约矩阵 `nodeType × resourceType` → 生成前后端常量 | 唯一安全边界 | 403 |
| ②场景过滤 | candidate 端点的**可选**查询参数 | 无 | 不适用，不传即全量 |
| ③领域不变量 | organization owner 的写入校验，对所有调用方一致 | 无（与身份无关） | 业务错误码 |

矩阵进 `contracts/`，值域 `SELECTABLE/FIXED/HIDDEN/FORBIDDEN`，**格子无条件**。
矩阵是静态的，随生成常量发到前端即可，**响应体不回传 `selectorPolicy`**
（v4 每次 context 都回传，v2s 少这一层运行时传输）。
前端拿 `FIXED` 锁字段自动填、拿 `SELECTABLE` 给搜索框。
后端全程只认 nodeType 与 capability，**不认 pageKey**（R-13/R-17）。

**必配的红变异**（这三处是最容易被实现时糊在一起的）：
1. 让第二层参数参与授权判定 → 必须红
2. 让第二层返回 403 → 必须红
3. 写入端范围校验查了第二层而非第一层 → 必须红

契约新增一个 `x-` 扩展（R-19）+ 一张矩阵，generator 产出到 server 侧与前端常量。
**这是本包全部的新增成本**，换掉的是 20+ 个端点各自手写授权。
门可机械检查「每个写 operation 必须声明能力」「矩阵格子无条件」。

**P3-B ｜20 个业务写端点接入统一入口**（原 P-D0）：不再自行校验，只在契约声明 `x-required-capability`。
连带补齐 R-22 的缺口：
- **第一层**：建店/改店写入端复用第一层可见集合做范围校验（当前缺）。
- **第二层**：`StoreCandidateTaskReadService` 的 `heads` 查询补可选过滤参数，
  消费 `organization.head_company_brand_authorization`（当前缺）。**不传参即全量，永不 403。**
- **第三层（R-24 裁决后重写）**：Dexter 已裁决「是的，这个是业务事实」。
  **Java 侧三条写路径已全部实现**（`BusinessEntityService.java:157` 建店、`:184` 改店、
  `:209-210` 反向改授权，判定在 `:341` 的 `authorized(...)`）——先前稿写"无第三层校验"是作者错误。
  真实缺口只有 DB 侧无约束。**因 R-24 退役了整集合替换，delete-all-reinsert 消失，
  外键零改造代价可直接加，且不需要 `DEFERRABLE`**：

```sql
ALTER TABLE organization.store
  ADD CONSTRAINT fk_store_head_company_brand_authorized
  FOREIGN KEY (head_company_id, brand_id)
  REFERENCES organization.head_company_brand_authorization (head_company_id, brand_id);
```

  `head_company_id` 可空 + 默认 `MATCH SIMPLE` 跳过 NULL，恰等价现有 Java 的 `!= null` 前置。
  Java 侧三处保留（给业务错误码而非裸约束违反），DB 约束是兜底。
  **必做**：补两条 focused test —— 盲审确认那三处手写条件**目前无任何测试指名**。
  **前置动作**：先跑对账查询数已存在的违反行，不为 0 先报 Dexter，**不得自行清洗数据**。

**P3-B（本包内）｜品牌授权单项增删的契约 + 后端 + 数据库（R-24）**

> **切分（本次 doc-only 修订后唯一有效）**：先前把三层写成"一起改"与顶层顺序矛盾，
> 且会让 P3-B 依赖一个尚未发生的前提。现明确切开：
> **P3-B = 契约 / owner command / FK / migration / 后端测试 / 非视觉 action adapter 与其状态机测试；
> P3-D = 仅最终视觉结构、adapter 绑定与 UI/L2**。
> FK 的前提「整集合替换已退役」由 **P3-B 自己达成**，不依赖 P3-D。

契约：
```
退役  PUT    .../head-companies/{headCompanyId}/brand-authorizations
新增  POST   .../head-companies/{headCompanyId}/brand-authorizations              body {brandId}
新增  DELETE .../head-companies/{headCompanyId}/brand-authorizations/{brandId}
```

后端：删 `replaceHeadCompanyBrandAuthorizations` 的 delete-all-reinsert（`BusinessEntityService:211-215`），
改为单行 `INSERT`/`DELETE`。撤销时的反向守护由"集合差值"改为**精确到该品牌**——
错误必须保留“该品牌仍被引用、不可撤销”的业务事实；仅可列出**执行 actor 当前可见范围内**的门店标识，
不可见门店不返回标识、数量或可反推数量的信息。
**不动 `head_company.version`、不要 `expectedVersion`**：授权按子资源处理，
单行加/删幂等可判定（重复添加 → 幂等 `204`；删不存在 → `404`）。

**最终视觉 UI 不在本包**；但为避免旧 `PUT` 退役后功能断裂，P3-B 必须实现下述非视觉
`HeadCompanyBrandAuthorizationActionAdapter` 及其状态机/transport-focused tests。P3-D 只绑定和复用它。

### P3-B 到 P3-D 之间的过渡态：**逐次动作 adapter**（Codex 三轮否掉了作者原方案，已采纳其替代）

> **作者原写"最小适配、逐项提交"被否证**：Codex 读作"保留多选 Drawer、点保存后循环 POST/DELETE"，
> 这个读法是对的——原文没排除它。该形态**在 UI 层复刻整集合替换语义**，并引入三类硬问题：
> ①一个 Drawer 操作复用同一幂等键，第二条不同 request hash 会冲突；
> ②多条命令的部分成功、失败停止、重试、最终 owner readback 全部未定义；
> ③"该品牌仍被具体门店使用"的错误在 P6 之前会被当前 transport 丢成固定泛化文案，用户看不到关键信息。
> **禁止批量 diff adapter。**

过渡态必须是**逐次动作**。**P3-B 是唯一 owner**（Codex 四轮指出 P3-B/P3-D 职责重叠，已定）：

### `HeadCompanyBrandAuthorizationActionAdapter` —— 归 P3-B 独占

P3-B 拥有该 adapter 的**全部**：单项命令、幂等键生命周期、unknown-result 处置、
typed error 映射、以及全部 focused test。**P3-D 只能复用它**，不得再实现一份。

**规格：**

- **没有"保存整个多选集合"这个动作**；每一次选择 / 取消各自建立一个逻辑命令身份
  `{method, workspace, headCompanyId, brandId, idempotencyKey}`。正常路径只发送一次 HTTP request；
  结果未知时只能以**相同 method/path/body/key**重放，绝不新建 key 或第二个逻辑命令。
- `POST` / `DELETE` 的成功与同 key 重放均返回**不可变的 `204` action acknowledgement**；adapter 随后
  另发 fresh owner GET 取得当前 UI readback。controller 不得把 receipt 反序列化后再用当前授权集合重组为
  原命令 response，因此中间写入不会改变重放语义。
- **失败处置分两类**（Codex 四轮指出原写"失败即本地回滚"遗漏未知结果，已改）：
  - **确定失败**（不属于任何 `*_RESULT_UNKNOWN` 的 typed error）：只回滚该次本地动作，不继续后续动作。
  - **结果未知**（网络中断、超时，或 `*_RESULT_UNKNOWN` typed error）：**禁止直接本地回滚**。先 owner
    readback；若 readback 再失败，保留原逻辑命令身份并只允许重试 readback 或同 key 重放，不得发新命令。
    readback 成功后按事实完成，或在未提交时同 key 重放；仍无法判定则明确呈现“结果未知”并停止后续动作。
- `POST` / `DELETE` **精确绑定现有 `BC-ORG-HEAD-COMPANY-BRAND`**，不新建 capability。
- **P3-B 同步更新旧 `PUT` 的静态测试**，并配 focused testContract。

### 被阻断门店的展示：需要**专用白名单结构化字段**，不是"读 raw detail"

> **Codex 四轮否证成立**：当前 Problem 禁止额外字段，后端又只产生泛化校验错误。
> 先前写的"安全展示被阻断的门店标识、不透传 raw detail"**两头堵、无法实现**。

**改为：P3-B 定义一个专用的、白名单化的结构化响应字段**（契约变更由 P3-B 拥有）：

- 后端在撤销被阻断时，不再抛泛化 `OrganizationValidationException`，
  而是以 `ORGANIZATION_HEAD_COMPANY_BRAND_AUTHORIZATION_IN_USE` 产出 closed optional Problem 字段
  `brandAuthorizationBlockers: { visibleStores: [{id, code, name}], hasAdditionalVisibleStores }`。
  `visibleStores` 只含执行 actor 按当前范围可见的引用门店，**最多 20 条（OpenAPI
  `maxItems: 20`）**；`hasAdditionalVisibleStores` 当且仅当该 actor 可见的阻断门店超过 20 条时为
  `true`。不可见门店不返回标识、数量，也不得影响该 boolean；因此该字段不泄露隐藏引用的存在或数量。
  全部引用门店仍构成领域不变量并阻断撤销。
- 该字段必须显式加入 Problem schema（`additionalProperties: false` 保持），全部错误响应统一
  `application/problem+json`；codegen 生成 typed wire，`OperationsTransport` 必须原样保留该 typed field。
- **bridge 只消费该字段**，不读 `detail` 文本，也不做字符串解析。
- **红变异**：移除该字段、将 `maxItems` 改离 20、改回 `application/json`、或让 transport 丢弃该字段，
  撤销被阻断的 contract/transport-focused tests 都必须红；边界 fixture 必须证明 20 条可见门店时
  `hasAdditionalVisibleStores=false`，21 条可见门店时仅返回前 20 条且该值为 `true`，任意不可见门店均不改变
  payload。

此过渡态须在 P3-B receipt 中登记为 `TRANSITIONAL_UNTIL_P3D`。

### P3-B 必须同时冻结 readback 字段（否则 P3-D 无法完成）

> **Codex 四轮指出**：最终列表要显示授权时间与使用情况，而现有
> `HeadCompanyAuthorizedBrandsItem` 只有 `(id, code, name, status)`（实测确认），
> P3-D 在"不改契约"前提下**做不出来**。

**P3-B 一并冻结** `HeadCompanyAuthorizedBrandsItem` 的新增字段：
`authorizedAtEpochMillis`（改单项后第一次为真）与 `referencingStoreCount`。前端由
`referencingStoreCount === 0` 派生 `canRevoke`，不在 wire 中复制第二份真相。契约与后端在 P3-B 落地，
**P3-D 只消费、不改契约**。

### 子包顺序写死

**`P3-A exit → P3-B exit → P3-C exit`**，串行，不得并行或跳序。


**与 v2 的差异**：v2 `BusinessEntityManagementPage.tsx:530` 同样是多选批量替换。
本项登记为 `INTENTIONAL_DIVERGENCE_FROM_V2`，理由为 R-22 展开列出的四条业务缺陷；
依 T-2 与 UI 自问成立。**v2 对照复核不得判为漏抄。**

**完成判据**：契约里 `replaceOperations...BrandAuthorizations` 不存在；adapter 的全部语义与 tests
在 P3-B（P3-D 不重复）；撤销在用品牌的 typed Problem 只含 actor-visible blocker 标识且 transport 保留它；
同 key replay 在中间授权变化后仍是同一 `204` acknowledgement；连续两次添加同一品牌不产生重复行且第二次
确定为幂等 `204`；`authorized_at_epoch_millis` 在只增不改的场景下**不变**（red：改回全删全插则该断言失败）。


**P3-C ｜5 个 `PG-IAM-*` 端点拆掉 pageKey 推导链**（原 P-D0c）：
  **不得复用现有 `allow(...)`** —— 它正是 R-17 要消除的形状（用客户端可控的 `pageDesignKey`
  同时推导"需要什么能力"与"操作哪类节点"，两者同源因而无法交叉验证）。
  正确形状：目标类型从 DB 实体取（`assignmentId` → `role_assignment.service_node_type`），
  再用 `WorkspaceAuthorizationCatalog:135` **已存在但未被使用**的
  `requiredUserManagementCapabilityForTarget(targetType, action)` 推能力，
  最后做精确集合成员判定。**全程不碰 pageKey，不新建服务、不新建门、不改 catalog。**
  连带删除：契约 `operations-admin/workspace-access.paths.yaml` 的 `pageDesignKey` 请求参数、
  4 个 controller 的该参数、`WorkspaceAuditAuthorizationService:128` 的 `requiredPageKey` 判断。
  抄 v2 的约束：能力判定必须精确集合成员，**禁止前缀匹配**
- **P-D0b** `platform_admin` 补 `mobile_normalized` + 唯一约束（P-N1 的前置）
- **P-X1** command receipt 加 workspace 列进主键（**不能照抄 v2** —— v2 靠服务隔离）
- **P-B1** `ck_invitation_status` 闭集补齐；**P-B2** 门店启停 `"STORE"` 特判
- **P-D1** 邀请令牌不入 receipt + 对称 DB CHECK（Dexter 已裁决：要链接就 `reissue`，不复活旧令牌）
- **P-D2** Problem advice 补 403 分组 + typed 兜底；组织节点补 `DuplicateKeyException` 捕获
- **P-D4** 资产回滚只删本次新建；**P-D5** MinIO 移出事务 + 超时
- **P-D6** 重置限流前置、登录 OTP 补 SOURCE 维度、OTP subject 改 `account.id()`、存在性 oracle。
  **另含 `testCode` 的删除动作（Codex 二轮指出原稿只更正了数字、没给动作，已补）**：
  从 **3 个 controller 调用点**与 **3 个 generated wire record** 中移除该字段：

  | 类型 | 位置 |
  | --- | --- |
  | controller | `OperationsCatalogAuthenticationController` |
  | controller | `PublicWorkspacePasswordResetController` |
  | **controller（三轮补入）** | **`PublicInvitationController.java:33`** —— 以三参数构造 `new PublicInvitationOtpSendResponse(verificationId, expiresAt, null)`。**契约删字段 + codegen 后此处直接编译失败**，先前稿只写"2 个 controller"会漏 |
  | wire record | `PublicInvitationOtpSendResponse` / `WorkspaceOtpSendResponse` / `WorkspacePasswordResetOtpSendResponse` |

  wire 侧**必须改契约再 regenerate，不得手改生成物**。
  **三重闭合（Codex 三轮要求，已采纳）**：
  ①OpenAPI **negative contract**——断言全部 OTP 响应 schema 无 `testCode` 属性；
  ②**codegen drift** 为零；
  ③**后端编译 + 测试**通过（这一条正是能抓住 `PublicInvitationController` 漏改的那道）。
  **红变异**：把该属性加回任一 schema 并 regenerate，①必须红；
  只改契约不改 controller，③必须红。
  DEV 固定 OTP 的可测性改由 P7 的 DEV issuer 承担，不经生产响应体
- **P-X4** `UUID.fromString` 保护；**P-X5** 去掉 dev bucket 前缀硬编码

**完成判据**：每条 focused test 并**证明修复前为红**。P-B1/P-B2 必须端到端红→绿。

---

## RM1-P4 ｜效率（R-11）

**范围**：P-E1 补 7 条已被真实查询证明必需的索引（**不做投机性索引**）；
P-E3 角色 JSON 改 Java 侧解析 + `session()` 请求作用域缓存；
P-E4 `useDrawerFormLifecycle` 加 `useMemo`（一处修三处循环）；P-E5 其余列表批量化与分页上限。

**P4-A ｜先立运行时查询预算，再改代码**（原"红线 E-0"已作废，见下）

> **E-0 作废（第三轮盲审 + Codex 双方独立指出）**：
> 「`RowMapper`/`ResultSetExtractor` lambda 内不得出现 `jdbc.`」在约 24 个真实站点里只能抓到 **3 个**，
> **提出它所依据的 6 个发现一个都抓不到**（全部经由 `path()`/`nodePath()`/`require()` 等具名方法）；
> 漏掉 `RowCallbackHandler`（最重的无界站点 `OrganizationVisibilityService:78/:91` 正是这一类）；
> 对 stream/loop 形态结构性失明；且与"把 `nodePath()` 放回去必须红"的夹具自相矛盾。
> **不得扩成泛化语法门**（Codex 建议，采纳）。

**替换为 E-0'：运行时每读路径 SQL 计数预算，分母是 P-E9 的有限枚举集合。**

`OrganizationOwnerServiceTest.java:25-35` 已在跑真实 `PostgreSQLContainer` + Flyway +
手工构造的 `JdbcTemplate(new DriverManagerDataSource(...))`。把该 `DataSource` 包一层计数委托
（约 40 行、零新依赖），对每条读路径在固定 fixture 规模下断言 SQL 条数：

```
assertQueryCount("users.page", () -> users.page(ws, key, "STORE", null, 1, 20, 1L)) <= budget
```

**分母是 P-E9 已枚举的 call-path 集合（M1–M13 + S1–S5 + 原 6 处），逐项 red→green 关闭**，
不做泛化语法推断。三问全过：纯机械（比两个整数）、可复现、有真红变异（把 `path(...)` 塞回 mapper 计数必变），
且对间接调用、跨模块端口、`RowCallbackHandler`、stream 形态一视同仁。

**P4-B ｜一个批量路径解析实现，替换全部四处调用点**：

| 处 | 位置 | 现状 |
| --- | --- | --- |
| P-E6 | `WorkspaceMembershipService:44,51` | `page()` ≈ `4 + P×(4+A×(1..2))`，P=100/A=3 → **约 1000 条** |
| P-E7 | `OrganizationOverviewTaskReadService:26-28,32,57,64-73` | `detail()` 拉全类目；`nodePath()` 是 `while` 逐层单查 |
| P-E8 | `OrganizationAssignmentCandidateService:44,56` | 候选列表逐行递归 CTE，外层无 `LIMIT` |
| 同形 | `WorkspaceInvitationService:418-419` | 同上 |
| 同形 | `WorkspaceAccountService:24` | `list()` 的 RowMapper 内调 `require(...)`，`require()` 自己发查询 → `1 + N` |

**同时消除一处单一真相违反**：`OrganizationOverviewTaskReadService:64-73` 的循环版 `nodePath()`
与 `OrganizationHierarchyService:214-222` 的递归 CTE 版**做同一件事**，慢的那套还在被调用。
删循环版，统一到 CTE 版并扩展为对 `IN (...)` 一次性求解。

**完成判据**：
1. E-0' 查询计数预算存在，且对 P-E9 枚举集合逐项有 red→green 证明；
2. `WorkspaceMembershipService.page()` 实测 **≤6 条固定查询，且与 P、A 无关**
   （用查询计数器跑 P=1 与 P=100 两次，条数必须相同）；
3. `OrganizationOverviewTaskReadService.detail()` 实测 **1 条**；
4. 其余每个列表给出"改前/改后查询次数"实测对照，**不用 EXPLAIN 猜**。

---

## RM1-P5 ｜前端架构（R-4）

**范围**：RTK 改真 `build.query` + tag；一次解决四件事——workspace 切换扇出、
`WorkspaceScope` 重复拉取、写后重拉（19 处）、401 的 `resetApiState`；
platform 会话恢复（接 `getCurrentPlatformSession`）；401 统一拦截；
Error Boundary；失败态不再永久 loading（18 处 `loading={!x}`）；换页失败保留上一成功页；
generation guard；`contextScopedQueryArgs` 两处恒等调用删除；`queryContext` 加 `useMemo`；
**P-X9 装 `eslint-plugin-react-hooks`**（P-E4 的无限循环正是它能拦的）；
P-X3 platform 侧 `throw problem(error)` 改抛 `Error`。

**本包必须给出的 ST exit assertion（R-29 / Codex 三轮：P1 只登记，实作在此）**：
`ST-9`（7-ID 集合成员）的实际关闭在本包，exit 必须写明「authority source 是哪一个、
每个消费者如何机械追溯到它」，**不得用"出现次数=1"**。
P1 ledger 里该条的状态由本包的 exit 置为 closed。

**Shell 侧消费已存在的 catalog 字段**（清单 §14 更正后的真实缺口）：
`workspaceRequirement` 已在 catalog 与 `pageRegistry.tsx:31-32`，Shell 需接**菜单置灰 + 导航拦截 + 切换扇出**。

---

## RM1-P6 ｜UI 与 v2 吸收

**范围**：R-3 Problem 文案（**能力形状照 v2，实现用表驱动**——v2s 有 typed `EdgeProblemCode` 106 个）；
R-7/P-U3 两个集团空间页写能力归位 + 总览改选中制；
R-12/P-U4 切换器（右上角常驻不整页接管 + 左下角 `menuFooterRender` + **按已存在的
`requiredDataNodeType` 裁深度** + dirtyGuard + 侧栏收起隐藏）；
R-9 `maskClosable: true` + `requestClose` + platform 编辑 Drawer 补 dirty guard；
R-8 ProTable 按 surface 定；R-10 五个 `HOME-*` 照 v2；
P-U5 扩展字段通电、`RolesPage` 创建角色一步到位；
R-5 删 `InvitationsPage` + 5 个 operation 退役；
**P-N1 平台管理员手机验证码登录**（`INTENTIONAL_DIVERGENCE_FROM_V2`，
复用 `platform_login_rate_limit_bucket`、新建精简 `platform_iam.otp_grant`、
三条设计约束见清单 §10b）。

**分母**：**104 = 36 platform + 57 operations + 11 public**（先前稿写 103 是作者错误，漏算 R-24 使 operations 面净 +1；
实测基线 faceCounts = 39/56/11 = 106）。**退役与新增都依赖 P-0 的 ST-7 先完成。**

**数据范围切换器的形态**（Cascader vs Select）：候选已带 `ancestorPath`，
现为 `Select` + `ancestorPath.join(' / ')`。按倾向 0b 取轻解——**先加深度裁剪，
形态是否升级为 Cascader 视实际层级深度再定**，不预先重写。

---

**本包必须给出的 ST exit assertion（R-29 / Codex 三轮：P1 只登记，实作在此）**：
**本包 exit 还必须继承重跑（Codex 四轮要求，已加）**：
「**所有 OTP response schema 无 `testCode`**」——该断言在 P3 建立，
但 P6 会新增 2 个 OTP operation，**必须在本包 exit 重跑一次**，否则新增的两个可能带着该字段进来。

`ST-2`、`ST-6`、`ST-11`（7-ID 集合成员）的实际关闭在本包，每条 exit 必须写明
「authority source 是哪一个、每个消费者如何机械追溯到它」，**不得用"出现次数=1"**。
P1 ledger 里这三条的状态由本包的 exit 置为 closed。

---

## RM1-P3-D ｜品牌授权最终 UI（排在 P6 之后）

> **本包不产生任何新行为**（Codex 四轮要求"唯一行为实现、退出条件、复用约束"，已定）。
> 命令语义、幂等键生命周期、unknown-result 处置、typed error 映射、action acknowledgement
> **全部由 P3-B 的 `HeadCompanyBrandAuthorizationActionAdapter` 拥有**；
> 契约字段（`authorizedAtEpochMillis` + `referencingStoreCount`）也已由 P3-B 冻结。

**范围（只有三件）**：

1. **复用 adapter**，把过渡态的逐次动作 UI **替换视觉结构**为最终形态——
   已授权品牌**列表**（每行：品牌 / 授权时间 / 使用情况「N 个门店在用」/「取消授权」，
   在用时禁用；仅有 actor-visible blocker 时展示其标识），上方「添加授权」为**单选**品牌搜索框。
2. **补 L2**。
3. 复用 P6 已建成的 UI 基建（列表、Drawer surface、typed error 展示桥），不新建。

**明令禁止**：改命令语义、改契约、另实现一份 adapter、引入"保存整个集合"。

**exit assertion（至少这四条）**：

1. 契约中 `PUT .../brand-authorizations` 计数 = **0**；
2. 前端**不存在"保存整个集合"的提交路径**（静态断言：无批量提交入口）；
3. 每一次用户动作恰有**一个逻辑命令身份**；正常路径恰发一次 HTTP request，结果未知只允许以同 key
   重放原 request（focused test 分别断言正常与恢复路径）；
4. 每次 `204` acknowledgement 后以 fresh owner readback 更新（断言 readback 被调用且视图取自 readback）。

外加：重跑 §3 的 A1–A5 全绿，且**本包未改变契约**（契约 diff 为空）。

---

## RM1-P7 ｜死代码与 seed

**范围**：清单 §12 确认成立的 **1 项**（`proLayoutNavTheme`）删除
——原表 9 项中 6 项已被证伪，不得作为工作项。

> **`InvitationsPage.tsx` 已移出 P7（Codex 二轮指出双重归属，已采纳）**：
> P6 会删除该页面并退役 5 个 platform-face invitation operation（R-5）。
> **由 P6 独占**；P7 若仍列它，就无法对一个已被删除的文件形成诚实 exit。
> P7 只处理剩余 dead-code 与 seed。
seed executor、DEV 固定 OTP issuer、fixture 升为正式 profile；
R-14 数据量（品牌/租户/总公司各 ≥25，门店/合同各 ≥30，平台侧各 ≥55，`cg-boreal` 补完整分支，
角色与账号补中文名，实体名不写测试用途）；真实图片 fixture；reset/stop 的 readback 与 cleanup。

**依赖**：数据量目标依赖 P-4 服务端分页与 P-5 tag 化。

---

## RM1-P8 ｜**本轮变更面**整体复核（不是全范围）

> **Dexter 裁决（2026-07-28）**：「RM1 做完之后，如果不符合预期还会有 RM2、RM3 这样的整改轮次」。
> 即 **RM1 不是最后一轮**，RM 是一个**系列**。这决定了 P8 的分母与产出。

### P8 的分母：本轮变更面，不含历史成果

P8 **不复核** R2–R4 的历史成果——那是 R6 的事。P8 的分母恰好是两样东西的并集：

1. §3b 全覆盖对账表里的 **57 条**问题（去重后）——逐条应答"已修 / 显式欠账 / `NOT_APPLICABLE` + 理由"；
2. P0–P7 实际 changed-path 的并集（由工作树独立枚举，非自报）。

另有一个不可省略的跨包对账：P8 必须验证 **P0 receipt 的 `ST-7`** 与 **P1 ledger 的
`{ST-2, ST-3, ST-4, ST-6, ST-8, ST-9, ST-11}`** 并集恰为 §11 的 8 条，且无缺无重。

**先前稿写"全范围实施复核"是措辞错误，已改。** 若 RM 是系列，每轮都做全仓复核，成本会失控。

### P8 存在的理由：跨包叠加效应

逐包 exit receipt 只证明**该包自己**绿。RM1 同时动了目录结构（P2）、授权模型（P3）、
N+1（P4）、前端架构（P5）、UI（P6）——**五件事各自绿不等于合起来对**。
这是逐包验收省不掉的部分，也是 P8 唯一不可替代的价值。

### P8 的产出：一个供 Dexter 判定"要不要 RM2"的结论

P8 不只是 GO/NO-GO。它必须输出**三张表**，作为 Dexter 决定是否开 RM2 的输入：

| 表 | 内容 |
| --- | --- |
| 已闭合 | 57 条里本轮真正修完并有红变异证明的 |
| **显式欠账（结转 RM2）** | 本轮未做的，**逐条带 owning 原因与建议轮次**——**不得静默消失** |
| 本轮新发现 | 实施过程中冒出的新问题，直接构成 RM2 的输入分母 |

> **这一条是 CR00–CR08 的直接教训**：上一轮 Roadmap 就地终止时，"未闭合项全部并入本 Roadmap"
> 是靠人工重述完成的。RM 系列必须把结转做成**机械对账**：
> RM(n) 的欠账表 = RM(n+1) 问题清单的强制子集，缺一条即 RM(n+1) 的分母不完整。

### P8 **不替代** R6

R6 = 「W4：全量复验、移交与 v2s 收口」，包含 **移交**——`HANDOFF.md` 欠账清理、
交接文档、正式团队上手所需物料。**RM 系列的任何一轮都不覆盖这些。**
Roadmap 里必须明写，免得将来有人以为整改做完即可移交。

### RM 系列的标识与序号（现在就定，避免重演 R6 撞名）

R6 撞名的成因是**没有人登记标识**。RM 系列现在就登记：

- 在 `doc/platform/roadmap-program-registry.json` 注册 `RM` 系列，声明它与 R0–R6 步序**并行且不冲突**；
- `standards-coverage` 的 `phaseOrder` 用**小数**插位：`["RM1", 5.5]`，后续 `RM2` = 5.6、`RM3` = 5.7。
  这正是第三轮盲审建议采用小数而非重编号 R6 的额外理由——**RM 是系列，重编号会重复付费**。

### 执行方式

fresh 独立子 agent 两轮上限 → Claude review → Dexter acceptance。
作者会话不得自审自判（CLAUDE.md 强制）。

## 4. 完成定义

1. **P0–P8** 每包 exit 真绿且顺序无跨越（先前稿写 P0–P7，与 §3 拓扑的 9 个包不符）
2. 清单 §11 的 8 条 ST 由 **P0 receipt 的 ST-7** 与 **P1 ledger 的 7-ID 集合**构成；每条都有唯一
   authority source 与可追溯消费者；ST-2/6/9/11 的实际关闭在 P5/P6 有 exit assertion；P8 对两者并集
   做无缺无重对账。
   **（R-29：不再用"出现次数=1"）**
3. 冻结分母（32 scenario / 22 surface / 25 pageDesignKey / 7 owner schema）不漂移；
   operation 分母修订到 **104** 并同步 face closure
4. 清单 §13"已知正面事实"全部未回退（**§13 已按盲审更正 3 条，以更正后为准**）
5. DEV business 与 cleanup 均 PASS
6. `HANDOFF.md` 只承载 Dexter 明确裁掉或后置的事项

## 5. 需 Dexter 裁决

| # | 事项 | 阻断包 |
| --- | --- | --- |
| D-1 | 现行 Roadmap 里 R5 的终态措辞（本件不代写 `CURRENT_*`） | 接受本件时 |

> 前一稿的"Java 包名形状"与"106 减 5 的算术"两条已按盲审 N7 撤回——前者随方案 B 消失，
> 后者是算术不是产品决定。"邀请链接是否需重新获取"已由 Dexter 裁决（不复活，要就 `reissue`）。

## 6. 授权边界

候选件，不授权 implementation、业务源码、契约、migration、测试、脚本、构建、DEV、数据库、
远端运行或 seed/reset。Dexter 接受后仍需另行给出 implementation exact authorization，且只能从 P0 开始。
