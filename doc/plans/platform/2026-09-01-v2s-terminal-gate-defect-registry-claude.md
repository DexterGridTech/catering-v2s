# TER 门与约束 · 缺陷登记与验收判据（Claude）

| 字段 | 值 |
|---|---|
| 由来 | Dexter 2026-09-01：「约束的太死了，使得真正的合理的功能已经无法正常调用了，需要想着怎么绕开架构了」⇒ 要求在**单一真相**前提下**只约束坏行为** |
| 分工 | 本文给**缺陷事实**与**验收判据**（做完之后什么必须红、什么必须绿）。**判据怎么实现、红夹具怎么写，是 Codex 的事**；本文不给实现方案 |
| 写入边界 | `tools/`、`skeleton-graph.ts`、`apps/terminal/**`、标准正文均在本会话写入边界之外 |
| 证据 | 全部为本轮静态读取的仓内事实。**未运行任何构建、测试或安装命令** —— 文中所有「今天绿 / 今天红」都是**读码得出的行为预测，未执行** |

## Dexter 裁定（本文据此写成）

| # | 裁定 |
|---|---|
| ① | role effect「频率很低，用最简单的方式」；入参**不得出现 dispatch 调用点，保留读状态** |
| ② | workspace scoping「**要建，而且要充分测试**」，**其消费者就是测试** |
| ③ | `kind` 正本「按最合理、最长期的方案，不考虑沉没成本」 |
| ④ | **22 节点不是 Dexter 的裁定** |
| ⑤ | **`restart-positive` 静态门退役**，改由行为门承担 |
| ⑥ | 一稿，不拆 |
| ⑦ | ~~`applyAuthoritativeSync` / `createFullSyncPayload` 从 `state` 公开面摘掉，由 runtime 内部持有~~ ⚠️ **已被 ⑪ 取代，作废** |
| ⑧ | 公开面名单**从工具移进包内**，工具只核对「包内声明 == 实际导出」（D-8） |
| ⑨ | `flushMode` 维度**登记为不覆盖**，进 `HANDOFF.md`，不补测试 |
| ⑩ | scoped dispatcher **不知道 slice 注册表**（照 POC），不加未注册校验 |
| ⑪ | **靠软性规范解决可见性调用问题，不要靠硬性约束** —— 越硬越复杂，属过度设计。**取代 ⑦**（D-9） |
| ⑫ | **整批与 `display-context` 解耦** —— 该包需求尚未定稿，不得作为门整改的组织轴（§1、§6） |
| ⑬ | **D-5 移出阻塞批**，标为顺序优先（§6、D-5） |

## Codex 第一轮评审处置记录

`REVIEW_CYCLE_ID=TER_GATE_DEFECT_REGISTRY_2026_09_01` · `REVIEW_ROUND=1` ·
Codex verdict `NO-GO`（M=2 S=5 N=1）。Codex **实跑了本文作者跑不了的全部变异**，
这是本轮质量提升的主要来源。逐条处置如下：

| Codex finding | 处置 | 落在哪 |
|---|---|---|
| **M-1** 五道「无 finding」门中四道有已复现缺陷，另漏一条依赖门漏洞 | `CONFIRMED` | 新增 **D-20…D-24**（§3.5）；§0 的「5 道没有 finding」改写为「20/21 道有 finding」 |
| M-1 附带：`default-import-allowlist` 不是缺陷 | `REJECTED_WITH_EVIDENCE`（接受 Codex 的举证） | §0 写明它是唯一确认无 finding 的门，理由是 platform-ports 已批准设计的既有边界 |
| **M-2** D-7「结果真被消费」不是可执行判据 | `CONFIRMED` | D-7 判据 7 收窄为「不得直接丢弃」，五态处置交 behavior tests |
| **S-1** D-6 接管用例是两条不是一条 | `CONFIRMED` | D-6 判据 3 改为复数行为形状绑定，并录入 Codex 实跑结果 |
| **S-2** D-5「能修改状态」无法机械判断 | `CONFIRMED` | D-5 判据 1 改为「确定的只读 exact shape」或「明确的 capability 类型来源」 |
| **S-3** D-11 识别不了未来未知平台包 | `CONFIRMED` | D-11 判据 4 改为 owning source 分类 + fail closed |
| **S-4** D-12 的四条「保持红」不足 | `CONFIRMED` | D-12 判据 3 改为固定可执行 AST corpus（六类），并明确更深数据流不由机器门证明 |
| **S-5** 「61 个成员/键名」不成立 | `CONFIRMED` | D-8 定义计量单位后**求值**重算：12 表 / 312 导出名 / 457 标量；并写明 exact-set 不证明导出合法性 |
| **N-1** POC 绝对路径不可复现 | `CONFIRMED` | 全文改为「本仓同父目录下的 newPOSv1」 |

⚠️ **一处跨条目的连带修订**：Codex S-4 指出「另用夹具之外的第 N 种形态抽查」是**不可重复**的判据。
本文原有三处此类措辞（D-2 判据 1、D-3 判据 2、D-7 判据 1），**已全部替换为固定夹具集**，
并把这一条写进 §0.1 的禁用形态。

⚠️ **两条 UNVERIFIED 由 Codex 实跑解除**（vitest `passWithNoTests` 默认退出 1；D-6 变异后为 2 红），
见 §7。

---

## Codex 第二轮定向复核处置记录（cycle 收口）

`REVIEW_ROUND=2` · `REVIEW_ROUND_LIMIT=2` · Codex verdict `NO-GO`（M=2 S=3 N=0）·
`ROUND_FINAL_DECISION=SELF_DECIDED`。**五条全部 `CONFIRMED`，无驳回。**
本轮 Codex 再次实跑了作者跑不了的变异，两条 Major 都推翻了作者的静态判断。

| Codex finding | 处置 | 落点 |
|---|---|---|
| **M-1** D-22 没有冻结「关键消费字段」的初始分母 | `CONFIRMED` | D-22 补入**本轮 AST 扫描建立的 22 处消费字段 × 9 个闭集 union** 的初始分母表，并要求门同时拒绝缺失/多出/退化三种漂移；owning source 按裁定⑧ 不得只住在门工具里 |
| **M-2** D-24 漏 `ImportTypeNode`，且该形态已在生产源码中活跃 | `CONFIRMED` | D-24 的语法分母补齐五类；作者独立复扫确认 **15 处、其中 10 处在生产 `src/`**；「潜伏洞」说法收窄为只对 export-from 成立 |
| **S-1** 「固定夹具集」仍可按样例硬编码（D-7 / D-12 / D-20） | `CONFIRMED` | D-7 判定绑定解析后的 `StateStoragePort` 类型；D-12 corpus 改为 vocabulary × AST 形态矩阵；D-20 收窄为有限局部形态，helper/对象字段/多跳标 `UNENFORCEABLE_BY_MACHINE` |
| **S-2** D-5 只收窄类型，不保证运行时对象不带 dispatch | `CONFIRMED`，但**处置已于 2026-09-01 撤销** | 原补「只读 facade + 运行时 keys 断言」，经 Dexter 质疑「我们没做权限管理，怎么冒出个写 capability」后撤回 —— `TR-01` 的门本就逐包扫全部 22 个包，effect 里的 dispatch 必红。详见 D-5 |
| **S-3** D-8 同节保留两组冲突数字 | `CONFIRMED` | 删除手写的旧「同族」表，只保留求值结果；写明 `expectedKinds` 不是独立 exact-set 表 |

⚠️ **一条贯穿三轮的教训，已写进 §0.1**：本文先后三次向静态门索取它原理上给不出的语义结论
（「返回值真被消费」「任意函数能否修改状态」「识别未来未知平台包」「普遍识别分步类型擦除」），
而作者自己正是以同一理由主张退役 `restart-positive`。
⇒ 本稿引入 **`UNENFORCEABLE_BY_MACHINE`** 这一显式档位：
判据只写机器能证的有限形态，其余明确交独立语义 review，并在规则反例栏写明边界。

⚠️ **`SELF_DECIDED` 收口说明**：两轮硬上限已达到，不再发起第三轮，也不通过更换 reviewer、
模型、文件名或局部拆分重置 cycle。本文以本次修订收口，进入详设与实施计划阶段。
仍为 `UNVERIFIED_REQUIRES_EVIDENCE` 的四项列在 §7，须由详设与实施阶段的实跑闭合。

---

---

## 0 · 走查范围（诚实登记，不宣称完整）

五个工具共 **23 条 `RULE_NAMES` 条目 + 5 个 support check**；
`tr05-named-boundary` 出现在三个工具里共用同一实现 ⇒ **去重后 21 道门**。

| 工具 | rule gates |
|---|---|
| `terminal-skeleton` | `graph-comparison` · `triple-naming` · `dependency-direction` · `dependency-declaration-completeness` · `tr01-reducer-boundary` · `kernel-platform-independence` |
| `terminal-contracts` | `zero-adapter-capability` · `tr05-named-boundary` · `runtime-id-prefix-exact-set` · `closed-literal-unions` |
| `terminal-platform-ports` | `tr05-named-boundary` · `required-port-shape` · `default-import-allowlist` · `platform-identifier-boundary` |
| `terminal-runtime` | `context-exact-set` · `command-mount-shape` · `owner-kind` · `restart-positive` · `ledger-record-shape` |
| `terminal-state` | `toolkit-zero-slice` · `tr05-named-boundary` · `storage-result-consumed` · `no-storage-clear` |

⚠️ **21 道门中 20 道有 finding。**
前一版称「5 道没有 finding」，**Codex 第一轮实跑推翻了其中 4 道**（见 §3.5 的 D-20…D-23，
每条都有 Codex 在 scratch 副本上跑出的变异结果）。
唯一确认没有 finding 的是 **`default-import-allowlist`** ——
Codex 举证 platform-ports 已批准设计明确要求生产依赖仅为 `contracts`、
并把 type-only 外部依赖列作红夹具，当前严格行为属既有设计边界（`REJECTED_WITH_EVIDENCE`）。
另有 **`dependency-declaration-completeness`** 被补出一个本文原先未登记的漏洞（D-24）。

⚠️ **不在上表、但能整体掀翻工具的抛出点**：`graph-model.mjs` 的 `readSkeletonSpec` 校验位于
`check-static.mjs:432` 的 try/catch **之外**（逐门 try 在 `:444`）；四个工具的 `if (!indexSourceFile) throw` 同理。
⇒ `skeleton-graph.ts` 畸形时，**所有门连一行结果都打不出来**，而不是报一个具名 gate FAIL。

⚠️ **本文不宣称已穷举。** 三轮独立盲审共补进 20 余条本文原先漏登记的缺陷，
其中数条与我已登记的**同文件、同函数族**。同类缺陷仍可能有剩余。

## 0.1 · 判据写法（三轮盲审后的唯一存活形态）

前两稿的判据被独立盲审构造出 36 种绕过。**幸存的全部是同一种形态**：

> **行为式 + 自带反例：做 X ⇒ 必须红；删掉 Y ⇒ 必须转绿。**

以下形态**全部被绕过过，本稿不再使用**：
「grep 可证某字面量消失」（搬到隔壁文件即可）· 计数式（`!== 22` 改 `!== 23`）·
点名单一逃逸形态（改一处即满足）· 「验收须回答……」（作文题）·
只要求「今天红的变绿 / 今天绿的变红」而**不要求原有真阳性保持红**（允许净倒退）·
🔴 **「另用夹具之外的第 N 种形态抽查」**——Codex 指出这是**不可重复**的判据，
两个人抽到的形态不同、结论就不同，无法作为收口依据。
本稿已把三处此类措辞（D-2、D-3、D-7）全部替换为**固定的可执行夹具集**。

---

## 1 · 阻塞「下一个 owner 包」的缺陷

⚠️ 本节标题原为「阻塞 display-context」，已按 §6 的裁定改写；这四条与具体是哪个包无关。

### D-1 · `graph-model.mjs` 的 kind 解析硬编码到单个包

**位置**：`tools/terminal-skeleton/graph-model.mjs:64-77`

**仓内事实**：`if (moduleName !== 'kernel.base.runtime') return null;` + runtime 专用路径字面量。
`:92-98` 二选一硬约束：两者皆有 ⇒ 抛；皆无 ⇒ 抛。
`skeleton-graph.ts:22-26` 确认 runtime 条目**无 `plannedKind`**，完全靠此函数返回 `'owner'`。

**误伤机制**：`TR-09` 骨架例外要求包落下第一个真实 slice 时移除 `plannedKind`。
第二个包照做 ⇒ 返回 `null` ⇒ 皆无 ⇒ **抛**。`readSkeletonSpec` 被 skeleton 全部 6 门与 `verify.mjs` 共用
⇒ **整套门与 verify 一起塌**。

⚠️ **两处附带**：匹配正则**无 `^` 锚定、无 `/m`**、首个匹配即返回
⇒ 注释 `// kind: 'owner' as const` 能压过下方真实的 `kind: 'toolkit' as const`
（对照 `check-static.mjs:135-137` 的 `readPackageModuleName` 是 `^` 锚定 + `/m`，**同仓两种严格度**）；
`return null` 是**失败开放**。

**验收判据**：
1. 🔴 **验收态必须存在第二个已落 kind 正本的包**（scratchpad 夹具或 display-context 本体），并对它跑判据 2-4。
   ⚠️ 今天仓内**只有 1 个包有 `features/slices`、21 个有 `plannedKind`**
   ⇒ 不造第二个包，下面三条全部 vacuously true，验收等于没做；
2. 对第二个包：落 kind 正本并移除其 `plannedKind` ⇒ **全门绿**；再给它同时留 `plannedKind` ⇒ **必红**；
   再把 kind 正本删掉、`plannedKind` 也不加回 ⇒ **必红**；
3. 对第二个包：包内已有真实 slice、把 kind 正本改名或移位 ⇒ **必红**（今天是静默退回 `plannedKind`）；
4. 在第二个包真实 `kind` 声明**上方**加一行取值不同的注释 ⇒ **必须取真实值**；
5. 🔴 **反搬家**：把解析逻辑移到任何其它文件后，判据 1-4 **必须仍然全部成立** ——
   验收以行为为准，不以「某文件里没有字面量」为准。

**波及**：skeleton 全部 6 门 + `verify.mjs`。

---

### D-2 · `kind` 正本三处不一致，检查器里三处 runtime 身份硬编码

**位置**：`graph-model.mjs:64-77`、`tools/terminal-runtime/check-static.mjs:483-503` 与 `:294-311`

**仓内事实** —— 三个东西都叫 manifest：

| | 是什么 | kind 字面量 |
|---|---|---|
| `TR-09` 规则说的 | 「每个包在 manifest 声明 `kind`」 | 概念 |
| `runtime/src/application/moduleManifest.ts:8` | 实为 `describeRuntimeModule(module)`，通用描述符工厂 | ❌ 无 |
| `runtime/src/application/createInternalRuntimeModule.ts:43` | runtime 内部模块工厂 | ✅ `kind: 'owner' as const` |

**三处 runtime 身份硬编码**：
1. `graph-model.mjs:65` 模块名 + 路径字面量；
2. `check-static.mjs:487` `stringProperty(returned,'kind',...) !== 'owner'`；
   ⚠️ `stringProperty:298-307` **只接受字符串字面量或 `moduleName` 模板**，标识符初始化器落进 `throw`；
   ⚠️ `check-static.mjs:500` 还要求 `moduleManifest.ts` 文本 `includes('kind: module.kind')`；
3. 🔴 **`stringProperty:305` 无条件执行 `value += 'kernel.base.runtime'`** ——
   任何包用 `${moduleName}` 模板都返回 runtime 的模块名。**不报错，静默给错值。**

**更便宜的正本住址（供 Codex 取舍，非指定实现）**：`src/moduleName.ts`
—— 22 个包今天都有；门已在解析它；工厂已在 import 它。

**验收判据**：
1. **kind 必须走符号解析，不得走文本代理。** 三条红夹具：
   ① 工厂内新增同名局部常量遮蔽 import（`const moduleKind = 'toolkit'`）⇒ **必红**；
   ② 从非正本文件 import 同名常量 ⇒ **必红**；
   ③ 固定夹具集还须覆盖：命名空间 import 后取属性、经中间常量再 import、以及从 barrel 文件转出；
2. **`stringProperty` 必须按被检查的包解析** —— 存在一条以**非 runtime 包名**调用、
   期望值不等于 `kernel.base.runtime` 的红夹具；把 `:305` 的无条件替换改回来 ⇒ 该夹具必须变绿；
3. 对第二个包（D-1 判据 1 的那个）：把它的 kind 从 `owner` 改成 `toolkit` 而 slice 不动 ⇒ **必红**；
4. `package.json` 携带 `kind`/`plannedKind` ⇒ 必红（`triple-naming:277-279` 已有，不得因迁移失效）。

---

### D-3 · `tr01-reducer-boundary`：作用域按包、探针按名字

**位置**：`tools/terminal-skeleton/check-static.mjs:336-351`

**仓内事实**：`allowed = new Set(['kernel.base.runtime','kernel.base.state'])`，逐包扫 `src/`，
命中 `/\bdispatchAction\s*\(|\bstore\.dispatch\s*\(|\buseDispatch\s*\(/` 且不在白名单 ⇒ 红。
扫的是 **raw text**（注释与字符串会误红）。`TR-01` 原文（`:49-53`）是**路径级** `features/actors/**` + 包级白名单。

**误伤面 = 7 个 owner 包**（本轮亲验 `plannedKind:'owner'` 计数，`skeleton-graph.ts:27/33/39/45/74/86/98`）：
`transport` · `display-context` · `workflow` · `ui-state` · **`ui.base.automation`** · **`ui.base.input`** · **`ui.base.admin-shell`**。

**dispatch 形态写入点全集 = 9 处**（两条独立扫描交叉确认，三路盲审复现一致）：

| 门的正则命中（5） | |
|---|---|
| `runtime/src/features/actors/setRuntimeInstanceModeActor.ts:47` | ✅ actors |
| `runtime/src/features/actors/cleanupRequestLedgerActor.ts:66` | ✅ actors |
| `runtime/src/application/createRequestLedgerRoleEffect.ts:12` | ❌ 见 D-5 |
| `state/src/foundations/createStateRuntime.ts:190` · `:251` | ❌ **dispatch 的唯一实现，必然入例外表** |

| 门抓不到、行为同类（4） | 形态 |
|---|---|
| `runtime/src/foundations/createCommandDispatcher.ts:208` | `getStore().dispatch(createUpsert...)` |
| `runtime/src/foundations/createCommandDispatcher.ts:615` | `dispatchAction: (a) => getStore().dispatch(a)` |
| `runtime/src/application/createRuntime.ts:304` | `return stateRuntime.getStore().dispatch(action)` |
| `state/src/supports/workspace.ts:73` | `input.dispatch({...})` |

⚠️ `collectSourceFiles` 只走 `src/`，**`test/**` 完全不在门内**。

**「什么算 actor 文件」的定义**（本文给定，消除判据冲突）：
位于 `features/actors/**` **且**导出 `ActorDefinition`（或含 `defineActor(` 与 `onCommand(`）。
仅满足路径不构成豁免。

**验收判据**：
1. 任意包（含今天不在白名单的 7 个 owner 包）的合格 actor 文件内正常写状态 ⇒ 绿；
2. 🔴 **判据必须能识别被调用符号的来源，不得枚举句法形态。** 红夹具至少四类，**全部必红**：
   `const d = context.dispatchAction; d(a)` · `const {dispatchAction: d} = context; d(a)` ·
   `context['dispatchAction'](a)` · 把 `context.dispatchAction` 当实参传给同文件 helper；
   固定夹具集还须覆盖：`window`/`globalThis` 上取到同名函数后调用、经一跳别名常量传递、
   以及 `export {dispatchAction} from` 形态的转出。
   ⚠️ **更深的数据流不由机器门证明** —— 超出该固定夹具集的形态交独立语义 review；
3. **假阳性方向**：`foundations/` 里一行注释 `// dispatchAction(` 或字符串 `'dispatchAction('` ⇒ **必须绿**（今天必红）；
4. `features/actors/helpers.ts`（路径合格但不导出 `ActorDefinition`）内写状态 ⇒ **必红**；
5. `dispatchCommand` 在任何位置 ⇒ 绿；
6. **例外表**：每条附不可机械满足的理由分类；本批收口时冻结条目数，此后新增须单独裁定。
   ⚠️ 「表 = 跑一遍判据的命中集」是循环判据，不接受；
7. `test/**` 是否纳入门内须显式裁决并写明理由，不得默认沿用现状。

⚠️ 落地必然要改 `TR-01` 正文的白名单那句（`terminal-coding-standard.md:53`）并新建例外表正文。

---

### D-4 · `verify.mjs` 的冻结集，且 marker 的 kind 是常量

**位置**：`tools/terminal-skeleton/verify.mjs:19-34`、`:66-75`、`:73`、`:97-109`、`:110-117`

**仓内事实**：
- `terminalTestOwners` 9 个包名、`terminalRealTestOwners` 4 个；四个差集任一非空即抛；
- ⚠️ **更近的墙**：`terminalRealTestOwners` 只含 4 个 kernel 包
  ⇒ **给 5 个 adapter 中任何一个写第一个真实测试 ⇒ verify 红**。现行门**禁止既有 adapter 长出测试**；
- ⚠️ **同一文件还有四段硬编码包名断言**（`:97-109`）：
  `if (!real.includes(contractsPackageName) …) throw`，platformPorts / state / runtime 各一段；
- ⚠️ **marker 两种出处**：四个 kernel 包 test script 打印的 `kind=REAL_TESTS` 是 `node -e` 里的**常量字面量**；
  五个 adapter 走 `internal/module_scripts/test.js` 的 `discoverTests()` 扫文件树；
- ⚠️ `:73` 令 `lint` / `clean` 的期望 owner 集**恒为空** ⇒ **任何 TER 包不得拥有 lint 或 clean 脚本**；
- ⚠️ `:66-75` 的 `batch` 参数对 `'test'` 是**死参数**。

**验收判据**：
1. 新增一个包并给它 `test` script ⇒ **零工具改动，全绿**；
2. 给任一 adapter 写第一个真实测试 ⇒ 绿（今天必红）；
3. 🔴 **删掉 `verify.mjs` 里任何一处包名依赖后，判据 1-2 必须仍然成立** ——
   包括 `:97-109` 那四段。⚠️ 只删两个数组、留下四段断言，不算满足；
4. 🔴 **kind 必须由观测计算**：把某 kernel 包的 test script 换成**只打印 marker、不运行任何测试**的 `node -e`
   ⇒ **必须红**。⚠️ 「把测试文件全删 ⇒ 必红」**不是有效反例** —— 红会来自 vitest 退出码，与 marker 出处无关；
5. 期望侧与 marker 的来源必须分别写明、不得同源，并给出「两侧同时改动才能骗过门」的反例；
6. `passWithNoTests` 的取值显式化。**UNVERIFIED**：其默认值本轮未实测；
7. `lint`/`clean` 恒空期望集：给任一 TER 包加 `"lint": "eslint ."` ⇒ 今天必红。
   **须解除该冻结**（登记为有意约束的分支不接受 —— 那是写一句话、零行为改动）。

⚠️ 附带：`state/package.json` 的 test 脚本硬编码 `../../../../../node_modules/.bin/vitest`，另三个用裸 `vitest`。

---

### D-5 · role change effect 里出现 dispatch 调用点（Dexter 裁定①：最简单的方式）

**位置**：`runtime/src/types/module.ts:26-31, 84`、`features/actors/setRuntimeInstanceModeActor.ts:41-48`、
`application/createRuntime.ts:212-215`、`application/createRequestLedgerRoleEffect.ts:8-15`

**仓内事实**：入参含 `context: ActorExecutionContext`（actor 自己 handler 的 context）
⇒ effect 拿到 `dispatchAction` / `dispatchCommand` / `requestApplicationReset` / `flushPersistence` 全套。
`RuntimeModule.roleChangeEffects` 是公开字段，`index.ts:52` 已导出。
调用在 actor handler 内：`for` 循环逐个 `await effect(...)`，**然后**才写角色 slice。

**顺序是承重的**：必须先清旧角色那半 ledger 再翻角色。
⇒ **「改发 command」路线否决** —— 那是另一次命令执行，会开出「角色已 SLAVE、MASTER 那半 ledger 还留着无主记录」的窗口。

⚠️ **本条不阻塞任何包**（前一版称其阻塞 display-context，已按 §6 撤销）。
`RuntimeModule.roleChangeEffects` 今天就是公开字段、`index.ts:52` 已导出，任何包现在即可注册 effect。
先做它的真实理由是**顺序优先：避免落地后二次迁移**，且它使 D-3 的例外表少一条。

⚠️ **一处上游文档的矛盾，登记但不作为本批前置**：display-context 需求 `:128-130`（正文规范段，
带论证）与 `:542`（评审日志行）都写着
「per-surface 公式加第三输入 `instanceMode`；**不采用** role-change effect 重置的修法」——
那是我在 Dexter 裁定**之前**写的。两者其实是两件事，**都要**：
- **公式吃 `instanceMode`**（结构）：残留的 `displayRole` **算不出坏状态**，即使重置失败；
- **切换时重置**（Dexter 裁定）：**存储里那个值不再是谎**。
一个「永远算不出坏状态但存着错值」的持久化设备状态，是会在后续咬人的。需求 `:542` 须据此更正。

⚠️ **两条支撑事实更正**：
- **不是「零下游消费者」**：`test/roleAndRoute.test.ts:91` `:123` `:160` 三处返回 `void` 的 effect **必须同步改**；
  `test/requestLedgerCleanup.test.ts:293` 返回 `never`，可不动；
- runtime **不依赖 `@reduxjs/toolkit`**；仓内现成类型是 `types/runtime.ts:25` 的 `RuntimeUnknownAction`。

**验收判据**：

⚠️ **本节判据已于 2026-09-01 大幅简化。** 前一版要求「按构造移除写能力」「调用点构造只读 facade」
「behavior test 观察运行时 keys」——那是在一个**没有权限管理的系统上造一个微型权限系统**。
Dexter 质疑「我们都没有做权限管理，怎么突然冒出个写 capability」后核实：
**`capability` 在规范正本里零命中**，`TR-01` 从来没用过这个词；
仓内已有的 `capability` 指的是**平台能力可用性**（`CapabilityUnavailableReason` 一类），
是「这个设施存不存在」，不是「谁被允许」。该词是本文作者带进来的（原有 6 处），已清除。

**`TR-01` 实际管的是一条源码位置规则：`dispatch` 调用可以出现在源码树的哪里。**
而 `runTr01Boundary` **逐包遍历全部 22 个包**，role effect 位于 `application/` 或消费者自己的包、
不在 `features/actors/**` ⇒ 它只要调 `dispatchAction`，门就红，必须加一条可见可评审的例外。
⇒ **门已经给了保证，facade 是叠在上面的第二套机制，删除。**

1. 🔴 **effect 改为返回 `readonly RuntimeUnknownAction[]`，由 actor 在写角色 slice 之前逐条 dispatch。**
   ⇒ `createRequestLedgerRoleEffect.ts:12` 的 dispatch 消失，
   runtime invariant 的 `role-effect-transition` 例外行随之删除（例外数再减一）。
   ⚠️ 入参保留 `context`（含读能力）不变；**不构造 facade、不做递归 exact shape、不断言运行时 keys**；
2. **任何第三方 effect 若在自己包里调 `dispatchAction`** ⇒ `TR-01` 门必红（今天已成立，作回归锚）；
3. ⚠️ 本条不再需要类型层保证 —— 盲审提的「宽度子类型使类型收窄形同虚设」随之失效，因为**不靠类型收窄**；
4. 🔴 **顺序有独立断言**：必须存在一条用例能观测到 effect 产出的写入落在角色 slice 写入之前；
   **把两者顺序对调 ⇒ 该用例必红**。⚠️ 「现有测试仍绿」不算判据；
5. 三处测试 effect 改造后，`roleAndRoute.test.ts:160`（命令超时后角色迁移仍进 journal）须仍验证同一行为；
6. **一处行为收窄须写明**：现行 effect N 的 dispatch 先落 store、effect N+1 才运行；
   改成「收齐再逐条 dispatch」后 effect 之间不再互相可见。今天只有一个 effect，无实际影响，但要登记。

⚠️ 唯一实现 `createRequestLedgerRoleEffect.ts:9-11` 今天只用 `previousMode`。

---

## 2 · 现役失效的门

### D-6 · `restart-positive` 静态门 —— **退役**（Dexter 裁定⑤）

**位置**：`tools/terminal-runtime/check-static.mjs:505-524`

**门分两半**：
- **前半（`:506-513`）**：三条 descriptor 文本断言，是真判据。
  ⚠️ 其中**只有 `persistIntent` 一条有红夹具**（`check-static.test.mjs:142-149`）；
  `kind:'field'` 与 `stateKey:'instanceMode'` 两条**无红夹具**；
- **后半（`:514-523`）**：恢复用例存在性启发式 ——
  `createRuntime(` `>=2` 且 `/instanceMode|instance-mode/` 且 `/plainStorage|shared|Map/`。

**后半双向都错**（本轮实测，两路盲审复现一致）：

| 文件 | `createRuntime(` | 命中第三条子句的真实原因 | 含重启恢复用例 |
|---|---|---|---|
| `foundations.test.ts` | 2 | — | ✅ |
| `requestLedgerLifecycle.test.ts` | 8 | `new Map(` | ❌ |
| `roleAndRoute.test.ts` | 5 | `plainStorage:` | ❌ |

- **假阳性**：两个零重启用例的文件能满足门；
- **假阴性**：真正符合 `TR-04` 正反双断言的 `requestLedgerCleanup.test.ts:346-372`
  因用 `runtimeWith(...)` 辅助函数、`createRuntime(` 只出现一次而**被排除**。
- 🔴 **判据与规则反相关：把好测试 DRY 掉，它就在门面前隐身。**
- ⚠️ 合成红夹具（`check-static.test.mjs:64-76`）**从未被 `.find()` 选中**（`foundations.test.ts` 排序在前且已满足），
  是死重量。结论「断言存在性这一维从未被红夹具检查」仍成立。

**退役依据**：`CLAUDE.md` 明写「不得用关键词/字段匹配把语义伪装成 checker」；
任何替代的形态判据（如「同一用例内两次构造 + 同一 storage 端口」）**同样会被一次 DRY 重构击穿**；
静态门原理上也判不了「断言方向是否正确」。

**验收判据**：
1. `:514-523` 的启发式删除，前半段三条 descriptor 断言保留且其**现有红夹具仍红**；
   ⚠️ `kind:'field'` 与 `stateKey` 两条今天无红夹具，**须补齐**；
   ⚠️ `RUNTIME_RULE_NAMES` 5→4 后，保留的前半段**挂到哪个门名下须写明**；
2. 🔴 **行为门接管的证据 —— 变异必须是「合法地取消持久化」**：
   把 `runtimeInstanceMode.ts` 的 `persistIntent` 改成 `'never'` **并删除 `persistence` 数组**
   ⇒ `turbo run test` **必须红**。**这条必须实跑。**
   ⚠️ **不得用「改 `persistIntent` 但保留 `persistence` 数组」的变异** ——
   `defineStateRuntimeSlice.ts:64-68` 会在**模块求值期**抛（`never forbids persistence`），
   导致 runtime 包每个 import `../src/index` 的测试文件全红，**无法区分「行为门接管了」与「行为门根本不存在」**；
3. 🔴 **接管证据必须钉到行为形状（复数）**：
   **令该变异变红的每一个失败，都必须属于**
   「构造两个 runtime、共享同一 storage 端口、断言第二个 runtime 启动后 `instanceMode` 恢复为持久化值」这一形状；
   **停用全部此类独立恢复用例后，该变异必须转绿**。
   ⚠️ 不得绑定「唯一一条用例」——**Codex 实跑证实是两条**（见下），只停用其中一条变异仍红。
   ⚠️ 一条 `expect(...stateSlices).toContainEqual({persistIntent:'owner-only'})` 形状断言也能让变异变红，
   但行为覆盖为零 —— 「每一个失败都必须属于该形状」把它排除；

   ✅ **Codex 第一轮已实跑，结论：行为门确实接管得住。**
   变异后 `D6_MUTATION_EXIT=1`，PASS=74 / FAIL=2，两条失败均为 `expected SLAVE, received MASTER` ——
   `test/foundations.test.ts:166` 与 `test/requestLedgerCleanup.test.ts:368`，两条都是上述行为形状；
   两条同时停用后 `PASS`（74 passed / 2 skipped）。⇒ **退役安全。**
4. 变异 `stateKey` ⇒ 必红（类型是 `keyof TState & string`，`tsc` 必红）；
5. ⚠️ **`flushMode` 维度不在覆盖内**（Dexter 裁定⑨）。
   仓内事实：`flushPersistence` 不传 `selection`，而跳过条件是 `selection === 'immediate' && flushMode === 'debounced'`
   ⇒ 默认路径下 debounced 照样落盘，把 `immediate` 改成 `debounced` **今天不会红**。
   这是**既有空白，非退役新增**。进 `HANDOFF.md`；
6. **`TR-04` 正文的「门」条款须同步改写**（它写的就是这条被退役的启发式），
   并把 `TR-04` 补进 D-18 的「已确认完全无实现」名单。

---

### D-7 · `terminal-state` 的判据按**变量命名**开门，三处独立拷贝

**位置**：`tools/terminal-state/check-static.mjs:220-225`、`:272`、`:185-206`、`:237`、`:243`

**仓内事实**：`isStorageCall` 用 `/(?:storage|Storage|port|Port)/` 匹配**接收者表达式文本**。
⚠️ **`runNoStorageClear:272` 自己内联了同一条正则**，不调用 `isStorageCall` —— **两份独立拷贝**。
⚠️ **第三处同类**：`toolkit-zero-slice:185-187` 靠标识符名 `createSlice`；
`:204-206` 靠 `declaration.getText()` 的三个 substring。

**两个方向都错**：
- **假阴性**：`const kv = ports.persistKv; await kv.write(...)` ⇒ 今天绿；
- **假阳性**：`transportPort.clear()`、`reportPorts.remove(id)` 等**非存储**调用 ⇒ 今天必红
  （`transport` 内含 `port`）。

⚠️ **节点形态也漏**：`:237` 只认 `await` 的 ExpressionStatement、`:243` 只认 VoidExpression
⇒ 裸表达式语句 `this.#storagePorts[k].write({...})` 两个分支都不匹配。

⚠️ **一处自相矛盾**：`required-port-shape`（`terminal-platform-ports:230`）要求 `StateStoragePort.clear`
**必须存在且非可选**（`platform-ports/src/types/storage.ts:21`，`defaults/processMemoryStorage.ts:49` 有真实实现），
而 `no-storage-clear` 禁止 state 包内任何 `clear` 调用
⇒ **一个被门强制存在、又被门强制零调用者的能力。**

**验收判据**：
1. 🔴 **假阴性**：`const kv = ports.persistKv; await kv.write(...)` 结果被丢弃 ⇒ 必红；
   `const kv = ports.persistKv; kv.clear({...})` ⇒ 必红。
   🔴 **判定必须绑定解析后的 `StateStoragePort` 接收者类型（或目标方法的来源），不得按变量名判定。**
   ⚠️ **固定夹具集只是 red corpus，不是语义来源**（Codex 第二轮 S-1）——
   前一版写「须含 `kv` / `box` / `sink` 三个名字」，实施者把这三个名字加进正则即可全红，
   而换成 `vault.write` 原缺陷仍在。夹具用来证伪，判据用类型；
2. 🔴 **假阳性**：`reportPorts.remove(id)`、`transportPort.clear()` ⇒ **必须绿**（今天必红）；
3. 🔴 **保持红**：今天已被正确抓到的真阳性（`persistenceEngine.ts` 的 7 处存储调用）**改造后必须仍红**；
4. 节点形态：裸表达式语句 `port.write({...})`、`storage.write(k,v).catch(() => {})` ⇒ 必红；
   ⚠️ `.catch(e => logger.error(e))`（非空 handler）⇒ **必须绿**；
5. 🔴 **两个门必须调用同一个判定函数**：删掉该函数 ⇒ **两道门同时红**（今天只红一道）；
6. `toolkit-zero-slice` 同步改造：`import * as rtk` + `rtk.createSlice(...)` ⇒ 必红；
   ⚠️ 注释在 declaration **跨度之内**（如多行初始化器内部）含 `defineStateRuntimeSlice(` ⇒ **必须绿**
   （写在声明上方的注释今天就不会误红，`getText()` 不含前导 trivia —— 那样的夹具是恒真的）；
7. 🔴 **机器门的职责收窄为「存储结果不得直接丢弃」，不承担「失败已被处理」的语义证明**（Codex M-2）。
   前一版要求判据升级到「返回值真被消费」，**那不是可执行判据** ——
   `const result = await ports.persistKv.write(input); Boolean(result);`
   只要检查「变量是否被引用过」就能通过，而 `failed` / `timed-out` / `unavailable` 仍未被分支处理。
   实施者要么自行发明数据流分析（当前阶段明显过重），要么把「变量被读过」冒充「失败已处理」（假绿）。
   ⇒ **五态处置由 focused behavior tests 证明，不由静态门证明。**
   ⚠️ 这与 D-6 退役是同一条教训：**不要向静态门索取它原理上给不出的语义结论。**
   门名与判据不一致的问题据此消解 —— 门要证的就是「不得直接丢弃」；
8. `clear` 的矛盾须裁决：或解除 `required-port-shape` 的强制存在，或给 `no-storage-clear` 开明确例外。

---

## 3 · 名单型判据

### D-8 · 公开面 exact-set 冻结 312 个导出名（Dexter 裁定⑧：名单移进包内）

**仓内事实**（node 求值精确计数）：

⚠️ **本节只保留一份权威数字表，见下方求值结果。**
前一版在此处另有一张手写的「同族」表（`expectedLiteralUnions` 9、`expectedPortMethods` 6、`expectedKinds` 1），
与下方求值结果自相矛盾，**已删除**（Codex 第二轮 S-3）——
实施者若能在同一节任选一段数字自称符合文档，验收分母就再次失去唯一口径，
而那正是本次登记要治理的病。
⚠️ `expectedKinds` 是从其它结构派生的值，**不是独立的 `Object.freeze` exact-set 表**，不计入下表的 12 张。

**公开导出名合计 312（本轮 node 求值，Codex 独立复算一致）。**

⚠️ **「61 个成员/键名」作废**（Codex S-5）。前一版那个数字是**从盲审报告里抄的，我没自己数**。

**本轮定义计量单位后重算**（对每个 `Object.freeze(...)` 块**求值**得出，不用正则计数）：

| 计量单位 | 数 |
|---|---|
| 独立 exact-set 表 | **12** |
| `expectedPublicExports` 导出名 | **312**（69 + 124 + 56 + 63） |
| 其余表的键 | **25** |
| 其余表的成员 | **120** |
| 标量名总计 | **457** |

⚠️ 逐表：`expectedRuntimeIdPrefixes` 9 键/9 成员 · `expectedLiteralUnions` **7 键/28 成员** ·
`expectedPortKeys` 10 · `expectedPortMethods` **9 键/47 成员** ·
`expectedModuleContextMembers` 9 · `expectedActorContextMembers` 11 ·
`expectedInternalCommands(+Definitions)` 3+3。
⚠️ `runLedgerRecordShape` 的 13 个成员是**内联 `assertExactNames`**，不在 `expected*` 常量里，未计入上表。

⚠️ **两次数错的教训**：`expectedLiteralUnions` 我先用正则数出 4 键（漏了三个**带引号的键**
`'CommandRouteContext.workspace'` 一类），Codex 报的 7 是对的。
`expectedPortMethods` 我抄了盲审的 6，实际是 `Object.freeze({...})` 对象、9 键 47 成员。
⇒ **结构计数一律求值，不用正则；任何未经自己复算的数字不得写进文档。**

🔴 **加一个合法的公开导出，必须改门工具。** 这是「真正合理的功能已经无法正常调用」的最大实例。

⚠️ 我在前一稿写过「公开面精确集是名单没错的地方，它不随包数增长」——
**那个判断我没验证过就下了**。它不随包数增长，但**随功能增长**，而功能增长是常态。

**Dexter 裁定⑧**：名单从工具移进包内（如 `src/publicSurface.ts`），工具只核对「包内声明 == 实际导出」。
⇒ 全部检出力保留（名单还在、漂移仍红），住址从工具搬进包，且解除「工具知道 22 个包内部细节」的耦合。

**验收判据**：
1. 给任一包新增一个合法公开导出 ⇒ **零工具改动**；
2. 🔴 包内声明与实际导出**任一侧单独改动** ⇒ **必红**（双向）；
3. 🔴 **保底负控制**：**删掉或停用公开面门本身不算满足**。
   ⚠️ **但 exact-set 只证明「包内声明 == 实际导出」，不证明「导出是合法的」**（Codex S-5）——
   名单搬进包内后，**同时**加入非法导出与对应列表项，exact-set 必然绿；
   再硬编码拒绝某个示例名（如 `setAnySlice`）也只是点名，不构成一般性合法性证明。
   ⇒ **导出合法性由 `TR-09` 等包级规则 + 类型夹具 + 行为测试证明**（见 D-9 判据 3），
   不得让 exact-set 承担它无法证明的语义责任。本条判据据此只保留「门不得被删」这一项；
4. `expectedPortMethods` / `expectedRuntimeIdPrefixes` / `expectedLiteralUnions` /
   `runLedgerRecordShape` 的内联成员表**同批处理**（同一病灶，见 §0）。

---

### D-9 · `TR-09` 边界第 4 条被 `state` 公开面直接违反（Dexter 裁定⑪ 取代 ⑦：只写软规范，不建机制）

**位置**：`state/src/index.ts:62,64`、`state/src/types/runtime.ts:65-80`

**仓内事实**：公开导出的 `StateRuntime` 接口上有：
```
getStore(): EnhancedStore<StateRoot>          ← 规则明文允许
getState(): StateRoot                          ← 规则明文允许
createFullSyncPayload(sliceName: string)      ← 按名读任意 slice
applyAuthoritativeSync(sliceName: string, payload)  ← 按名写任意 slice
```

`TR-09` 边界第 4 条：「**不得导出「写任意 slice」的 API**；读侧不得导出**为读取具名他包 slice 提供的便捷访问器**」，
并专门澄清 `getStore()`/`getState()` 是允许的，**禁的是在这之上再加一层具名便捷入口**（`readSlice(name)` 一类）。

⇒ 后两个方法**逐字就是规则点名的形状**，而且对全部 22 个包可见。
规则同时有**同步写侧例外**，但那覆盖的是「state 内部做这件事」，不是「把这个能力导出」。
今天两者并存而无人发现，是因为**没有任何门检查边界第 4 条**。

⚠️ **裁定⑦ 已被 Dexter 2026-09-01 的后续裁定取代，本节据此重写。**

原裁定⑦「两个方法从公开 `StateRuntime` 上摘掉，由 runtime 内部持有」**作废**。
新裁定原话：「**靠软性规范解决可见性调用问题，不要靠硬性约束，越高越复杂，过度设计**」。

⇒ **本条不建任何机制。** 明确**不做**：companion（`createStateRuntime` 返回 `runtimeSync`）·
runtime 包内自持 · unique-consumer 门 · 类型层不可达 · 任何 machine red fixture ·
public-surface 伪证明。`createStateRuntime` / `StateRuntime` / `getStore` / `getState` 的**现有形状一字不动**。

⚠️ 作者一并撤回自己提过的「runtime 包内自持」建议 —— 那仍是为可见性问题做结构改动，同样过度。

**处置（软边界）**：
1. `TR-09` 正文新增且只新增一条消费规范：`createFullSyncPayload` 与 `applyAuthoritativeSync`
   是 state 的同步基础设施，仅允许 `kernel.base.runtime` 与 transport 同步路径消费，其它业务包不得直接调用；
2. 该条进 `UNENFORCEABLE_BY_MACHINE` 表与 review checklist：
   搜这两个方法及同义 wrapper 的全部生产调用，逐一确认只在 runtime/transport 同步路径；
3. `getStore` / `getState` **不计违规** —— `terminal-coding-standard.md:335-340` 明文允许它们
   （Redux 根结构上藏不住，React 绑定与 owner selector 必需）。
   要收它须另立 React 绑定设计题并由 Dexter 裁定，不在本批；
4. 相关的技术性停机条件（原以 root export / subpath / deep import 判定）随之删除。

⚠️ **仍然为真、但不再由机器承担的事实**：`TR-09` 边界第 4 条今天**无任何门执行**，
其规则原文指定的读侧执行机制是 `TR-03` 的门，而 `TR-03` **零实现**（见 D-18）。
⇒ 这一条明确交语义 review，不作为本批的机器判据。

⚠️ **一条我前一稿挂错的**：我曾把这条挂在 `runtime/src/testing/` 上。亲验 `runtime/package.json` 的 `exports`
只有 `"."`、`src/index.ts` 对 `testing`/`ForTest` 零命中 ⇒ **那两个文件根本没被导出**。
它们的真实缺陷是另一件事，严重度低得多，见 D-14。

---

### D-10 · `assembly` 可达性门硬编码模块名且失败开放

**位置**：`check-static.mjs:152-153`、`:244-245`

**仓内事实**：`const assemblyModuleName = 'assembly.android.pos-desktop'; if (!projected[assemblyModuleName]) return;`
`:244-245` 同形。⇒ 该节点缺席时，入口可达性门与依赖闭包门**一起静默消失**。

⚠️ **前一稿的失败条件写错了**：`runGraphComparison:210-213` 的包普查
`assertEqualSet('active TER package census', actualNames, expectedNames)` 跑在这两处**之前**，
actual 侧来自目录扫描 ⇒ **只改图里的节点名今天就红**。
真正的触发条件是**图节点 + 目录 + package name 一致改名**：普查相等，两处双双静默跳过。

**验收判据**：
1. 🔴 图节点 + 目录 + package name **一致改名**后 ⇒ 入口可达性断言**必须仍然执行**。
   证据：同时植入一个必失败的入口断言，观察它是否被报出来；
2. 图中有 0 个或 ≥2 个 assembly 节点时的行为须明确（红，或明确支持多 assembly）；
3. 🔴 **统一失败开放**：`check-static.mjs` 共 4 处把节点移出分母的静默丢弃
   （`:153 return`、`:211 filter(Boolean)`、`:215-216 if (!entry) continue`、`:245 if (assembly)`）
   —— **每一处都必须改成抛出，并逐处配红夹具**。

---

### D-11 · 三份互不覆盖的「平台 import」名单

**位置**：`check-static.mjs:379,386`、`terminal-contracts:58`、`terminal-platform-ports:79`

**仓内事实**：同一概念三份名单，覆盖面互不相同。
`kernel-platform-independence` 用 `/^(?:expo|react|react-native|react-dom)(?:-|$)/`
⇒ **`@expo/vector-icons` 以 `@` 开头不匹配，今天绿**。

⚠️ 两处前一稿写得不准：contracts 的 `forbiddenImportPattern` 抓不到 `react-dom`；
`@expo/vector-icons` 在 `kernel.base.platform-ports` **今天就红**（该包自己的 `platform-identifier-boundary` 含 `@expo`）
—— 判据 1 须限定到 `kernel-platform-independence` 这道门。

**验收判据**：
1. `@expo/vector-icons` 在 `kernel-platform-independence` 覆盖的包内 ⇒ **必红**（今天绿）；
2. 🔴 **保持红**：今天已被三份名单正确抓到的每一个真阳性，改造后**必须仍红**（逐条配夹具）。
   ⚠️ 缺这条就允许净倒退；
3. 三个门的判据必须共用**一份词表**，各自声明取用哪个子集、子集边界写明理由。
   ⚠️ 强行合成一份必然对至少一个门过强 —— contracts 还禁 `fs/path/os/child_process`，
   platform-ports 必须允许它自己 `src/defaults/**` 的形态；
4. ⚠️ **不得主张「无需新增分类信息即可识别未来未知包」**（Codex S-3）。
   一份共享正则能覆盖现有全部红夹具与 `@expo/vector-icons`，
   但未来出现 `@shopify/react-native-skia` 时仍会绿 —— **只靠 npm 名称无法可靠判断任意未知包是不是平台包。**
   ⇒ 判据改为：**平台包分类维护在一个 owning source 里，三个门复用；
   新增依赖若不在允许分类中 ⇒ fail closed（红）。**
   ⚠️ 「非声明依赖的非相对 import 一律红」**过强** —— 会误伤子路径 import（`@reduxjs/toolkit/query`）
   与 `node:` 内建；须取 import specifier 的**包名前缀**比对，并对 `node:` 显式裁决。

---

### D-12 · 标识符名单既过紧又过松

**位置**：`terminal-contracts:41-56`（14 项）+ `:129-131`；`terminal-platform-ports:66-77`（**10 项**）+ `:332-335`

**仓内事实**：遍历全 AST，任何 `ts.isIdentifier` 且名字在集合内即抛 —— **包括属性名、参数名、类型成员名**。
⇒ contracts 里写 `interface X { readonly process: string }` **必红**（PropertySignature.name 是 Identifier）；
而 `globalThis['fetch']()`（ElementAccess + StringLiteral，无同名 Identifier）**不红**。

**验收判据**：
1. `interface X { readonly process: string }` 在 contracts 内 ⇒ **必须绿**（今天必红）；
2. `globalThis['fetch']()` ⇒ **必须红**（今天绿）；
3. 🔴 **保持红（本条最关键）**：须固定一份**可执行 AST corpus**，改造后逐条必红。
   ⚠️ 前一版只列四种形态，**Codex 证明不够**：跳过名字位 + 特判 `globalThis['fetch']`
   即可满足全部旧判据，而 `window['localStorage']`、`const g = globalThis; g.fetch()`、
   `export ... from` / `require` 重新变绿。
   🔴 **corpus 必须由「owning forbidden-vocabulary × 每个词适用的 AST 形态」生成或显式列成矩阵**，
   不能是几个孤立样例（Codex 第二轮 S-1）——
   前一版只围绕 `fetch` 举例，实施者可只对 `fetch` 做特殊处理，
   而 `NativeModules` / `TurboModuleRegistry` / `localStorage` 等**既有禁止能力**在部分形态重新变绿。
   AST 形态轴至少六类：裸调用 · 属性访问 · element access · **一跳 alias** · 解构 · **import/export-from/require**；
   词表轴是 contracts 的 14 项与 platform-ports 的 10 项，来自同一份 owning vocabulary。
   ⚠️ **更深的数据流明确不由机器门证明**，标为 `UNENFORCEABLE_BY_MACHINE`，
   交独立语义 review，并在规则反例栏写明这条边界。
   ⚠️ 缺这条会允许一个**净倒退**的实现通过验收：只要在 visit 里跳过一切「名字位」标识符，
   判据 1 绿、判据 2 加个 ElementAccess 分支即红 —— 而 `PropertyAccessExpression.name` 同样在名字位，
   于是 `globalThis.fetch()` / `window.localStorage` **从今天的真阳性变成绿**，门比现在更弱。

---

### D-13 · 其余名单型判据

| # | 位置 | 事实 | 验收判据 |
|---|---|---|---|
| a | `check-static.mjs:277-279` | 2-B 版本/框架黑名单抓不到标准自己点名的 POC 包名 **`host-runtime-rn84`**（`-rn` 后无数字；不含 `expo\|react-native`）；`-v2`/`-v3` 能抓 | 包名含 `rn84` / `reactnative` / `rn-84` ⇒ 必红；今天能抓的 `-v2`/`-v3` **必须仍红** |
| b | `check-static.mjs:282-283`（另 `check-static.test.mjs:23,25` 两份拷贝） | `!== 22` 硬编码，且塞在**命名门** `runTripleNaming` 内。⚠️ **Dexter 裁定④：22 不是他的裁定** | 🔴 **在 `skeleton-graph.ts` 增删一个节点后，`tools/terminal-skeleton/**` 及其测试零改动即全绿。** 这条同时封死「搬到别的文件」与「改成 `0x16`/`2*11`」两种绕法。该断言不得留在命名门里 |
| c | `check-static.mjs:83-88` + `:211` | 包普查按**目录深度 3** 过滤，深度 ≠3 的 `package.json` 静默不进分母 | 并入 D-10 判据 3（统一失败开放） |
| d | `verify.mjs:66-75` | `batch` 对 `'test'` 是死参数 ⇒ `expectedTaskOwners('test', 1)` 会返回 4 个 batch-2 adapter | 传入不同 `batch` 必须产出不同 owner 集，否则删掉该参数 |

---

### D-14 · `src/testing/` 被生产工厂无条件注册

**位置**：`runtime/src/testing/` 两个文件、`application/createRuntime.ts:443-444`

**仓内事实**：两个文件在生产 `src/` 下，`createRuntime` **无条件**执行
`registerRuntimeTestResources(...)` 与 `registerRuntimeStateSyncForTest(...)`，
以 WeakMap 键住 runtime 对象长期持有一个全 slice 写入访问器。

⚠️ **它们没有被导出**（`runtime/package.json` 的 `exports` 只有 `"."`，`src/index.ts` 零命中，
文件注释也写着 deliberately absent from the package root exports）。
⇒ 缺陷是**无条件注册**，不是「导出」。D-9 才是「导出」那一条。

**验收判据**：
1. 该注册改为条件式，且**条件在生产路径恒假可静态证明**（判定形式须写明：`__DEV__`？构建期常量？谁来证）；
2. 或：生产构建产物中不得含 `registerRuntimeStateSyncForTest` / `releaseRuntimeForTest` 符号（对产物 grep 可证）；
   ⚠️ **不得钉 `applyAuthoritativeSync`** —— 它是 `kernel-base-state` 的生产 API（`types/runtime.ts:75`、
   `createStateRuntime.ts:225`），永远在产物里，钉它的判据任何正确实现都满足不了；
3. 既有测试对这两个接缝的使用必须仍可用。

---

### 3.5 · Codex 第一轮实跑补登记（D-20 … D-24）

⚠️ 以下五条**全部由 Codex 在 scratch 副本上跑出变异结果**，不是静态推论。
前四条推翻了本文前一版「这 5 道门没有 finding」的说法。

#### D-20 · `tr05-named-boundary` 同时过宽与假绿

**Codex 实跑**：`TR05_SEQUENTIAL_DOUBLE_CAST_CURRENT=PASS`（绿 = 逃逸成立）。

- **过宽**：在**不属于包根公开面**的内部 export 类型里用 `Record<string, unknown>` ⇒ 误红；
- **假绿**：把双重擦除拆成两个语句（先 `as unknown` 存进变量，再从变量恢复为具体类型）⇒ 门绿。

**验收判据**：
1. 内部（非包根公开面）类型使用 `Record<string, unknown>` ⇒ **必须绿**；包根公开面上用 ⇒ 必红；
2. 🔴 **判据收窄为有限、明确的局部 AST 形态**，不得写成「能普遍识别分步类型擦除」（Codex 第二轮 S-1）。
   本批机器门只证：相邻语句内经**单个中间常量**的 `as unknown` 再还原 ⇒ **必红**；受控 alias 同形态一并覆盖。
   ⚠️ Codex 补的反例证明全称判据做不到 ——
   `const erase = <T>(v: T): unknown => v; export const restored = erase({value:'ok'}) as {readonly value: string};`
   contracts checker 仍 `exit 0`。
   ⇒ **helper 函数、对象字段承载、多跳传递三类明确标为 `UNENFORCEABLE_BY_MACHINE`**，
   进 review checklist，不在本批建设数据流分析（当前阶段代价不相称）；
3. 今天已被正确抓到的真阳性**必须仍红**。

#### D-21 · `runtime-id-prefix-exact-set` 有顺序假红

**Codex 实跑**：`RUNTIME_ID_PREFIX_REORDER_CURRENT=FAIL`（红 = 假红成立）。

只交换 `runtimeIdPrefixes` 两项的**声明顺序**，键与值完全不变，门仍红 ——
因为比较走的是对象插入顺序下的 `JSON.stringify`。

**验收判据**：
1. 仅交换声明顺序、键值不变 ⇒ **必须绿**；
2. 改任一键或任一值 ⇒ **必红**；
3. 须补 factory 到 brand 的类型夹具（今天只比字符串，不验类型关联）。

#### D-22 · `closed-literal-unions` 不约束消费字段

**Codex 实跑**：`CLOSED_LITERAL_APPMODULEKIND_TO_STRING_CURRENT=PASS`（绿 = 逃逸成立）。

把 `AppModuleKind` 的**消费类型**退化成 `string`，被点名的 union **定义**仍保留
⇒ contracts 四道门与 support **全绿**。⇒ 门只看定义，不看谁在用。

**初始分母（本轮作者用 TS AST 扫 `kernel/base/**/src` 建立，共 22 处、9 个闭集 union；含 `PersistIntent` 两个 direct consumer）**：

| union | 消费字段（仓根相对路径） |
|---|---|
| `AppModuleKind` | `contracts/src/types/module.ts:27` · `runtime/src/types/module.ts:95` |
| `ErrorCategory` | `contracts/src/foundations/definition.ts:14` · `contracts/src/types/error.ts:23` · `:39` |
| `ErrorSeverity` | `contracts/src/foundations/definition.ts:15` · `contracts/src/types/error.ts:24` · `:40` |
| `ParameterValueType` | `contracts/src/types/parameter.ts:7` |
| `RequestLifecycleStatus` | `contracts/src/types/request.ts:52` · `runtime/src/types/requestLedger.ts:37` |
| `RuntimeInstanceMode` | `runtime/src/features/slices/runtimeInstanceMode.ts:9` · `:17` · `runtime/src/types/role.ts:7` · `:12` · `:13` |
| `WorkspaceKey` | `state/src/types/workspace.ts:12` · `:22` · `:23` |

⚠️ **这份分母是本轮静态扫描的结果，从未执行过，交付前须由 Codex 独立复算并冻结。**
⚠️ 扫描口径是「属性声明的类型文本命中具名 union」。
`CommandRouteContext` 的 `workspace` / `instanceMode` / `displayMode` 是**内联字面量 union**，
已被 `expectedLiteralUnions` 的定义侧直接覆盖，不在上表。
⚠️ **`AppModuleKind` 不在 `expectedLiteralUnions` 里** —— 而 Codex 变异的正是它。
⇒ 「受保护的闭集 union 集合」本身也要冻结，不能只取 `expectedLiteralUnions` 的 7 个。

**验收判据**：
1. 任一上表消费字段的类型从闭合 union 退化成 `string` ⇒ **必红**。
   ⚠️ **22 处逐条配夹具** —— 只登记 `AppModule.kind` 一处不算满足（Codex M-1 的绕过构造）；
2. union 定义本身被改动 ⇒ 必红（今天已成立，作回归锚）；
3. 🔴 **门必须同时拒绝三种漂移**：清单成员**缺失**、清单**多出**成员、以及消费字段**类型退化**；
4. 🔴 **清单须有单一 owning source**。⚠️ 按 Dexter 裁定⑧（名单移进包内），
   它**不得只住在门工具里**；确切路径由详设裁定，本文不指定实现。
   新增、删除或变更成员的维护责任须在详设里写明归属。

#### D-23 · `ledger-record-shape` 只核成员名，且可能取错声明

**Codex 实跑**：`LEDGER_WORKSPACE_TO_STRING_CURRENT=PASS`（绿 = 逃逸成立）。

把 `RequestExecutionRecord.workspace` 改成 `string` ⇒ runtime 五道门与 support **全绿**。
⚠️ `findTypeDeclaration` 还会取**文件排序下的第一个同名声明**，不保证它就是包公开面的真实声明。

**验收判据**：
1. 任一成员的**类型**被放宽（如具名 union → `string`）⇒ **必红**；成员的**可选性**或 `readonly` 被改 ⇒ 必红；
2. 类型须从 **package public symbol** 取，不得靠文件排序取第一个同名声明 ——
   夹具：在排序更靠前的文件里放一个同名诱饵声明 ⇒ 门必须仍然核到真实那个；
3. 今天已被正确抓到的成员名缺失**必须仍红**。

#### D-24 · 依赖收集器漏 export-from（本文原先未登记）

**位置**：`tools/terminal-skeleton/graph-model.mjs:207-222`

**仓内事实**（本轮亲验）：`collectStaticImportDeclarations` 只 `filter(ts.isImportDeclaration)`
⇒ **`ExportDeclaration` 不收**。于是

```
export {moduleName} from '@catering-v2s/kernel-base-contracts';
```

**已经消费了一个工作区包，而依赖门看不见这条边**。字面量 `require` 与动态 `import()` 同样不收。

🔴 **还漏一类，而且它已经是活形态**（Codex 第二轮 M-2，本轮作者独立复扫确认）：

```
type Probe = import('@catering-v2s/kernel-base-contracts').TimestampMs
```

这是 TypeScript 的 **`ImportTypeNode`**，既不是 `ImportDeclaration`、也不是 `ExportDeclaration`、
也不是动态 `import()` 的 `CallExpression`。
本轮 AST 全量扫描：`apps/terminal` 下引用工作区包的 `ImportTypeNode` 共 **15 处，其中 10 处在生产 `src/`**
（`runtime` 的 `foundations/createCommandDispatcher.ts:80,81,88,116` ·
`foundations/createRuntimeLifecycle.ts:20` · `types/execution.ts:52` · `types/peer.ts:17` ·
`types/runtime.ts:68,72,77`）。
这些引用今天对应的依赖恰好都已在 `package.json` 里声明，所以**暂无现成错误边**；
但语法形态已经是活的。

⚠️ **「潜伏洞」这个说法只对 export-from 成立** —— 本轮搜 `export ... from '@catering-v2s/`
在 `apps/terminal` 下零命中（各包 `index.ts` 的 `export ... from './dependencies'` 是相对路径，不受影响）。
`ImportTypeNode` 不是潜伏的，是已经在用的。

**验收判据**：
1. 在任一包加一行 `export {x} from '@catering-v2s/<另一个包>';` 而**不**在图与 `package.json` 里声明该依赖
   ⇒ **必红**（今天绿）；
2. 声明了该依赖之后 ⇒ 绿；
3. 🔴 **依赖语法分母至少覆盖五类**，逐类配夹具：
   ① `ImportDeclaration`（**含 `import type`**）· ② `ExportDeclaration`（**含 `export type`**）·
   ③ **`ImportTypeNode`** · ④ 字面量 `require('@catering-v2s/...')` · ⑤ 动态 `import('@catering-v2s/...')`。
   ⚠️ 只补 ②④⑤ 而不处理 ③ **不算满足** —— 那正是 Codex 的绕过构造，而 ③ 在生产源码里已有 10 处；
4. 今天已被 `ImportDeclaration` 正确抓到的真阳性**必须仍红**；
5. 🔴 **type-only 边的分类规则须写明**：type-only 依赖在 `package.json` 里落
   `dependencies` 还是 `devDependencies`，须给出确定规则，不得留给实施者猜。

⚠️ **本条波及 D-16**：边集若按 D-16 改成「唯一住址落 `package.json`、方向/无环/闭包读真实边」，
「真实边」的收集器就是这个函数 —— 漏 export-from 会让整个新方案的地基漏。

---

## 4 · 结构性登记（本批不处置）

### D-15 · `dependencies.ts` × 22 是仪式代码

全仓反查 `dependencyModuleNames`：除各包 `index.ts` 转出、四个工具的 `expectedPublicExports` 名单、
两份 `public-surface.typecheck.ts` 与一处工具夹具外，**零真实消费者**。
唯一存在理由是让 `check-static.mjs:242` 变绿。
⚠️ **连带**：任何「给某包加一条依赖」的处方都要在这里加一行仪式性 import —— 即再生产一次同类物。

### D-16 · 依赖边集有两处住址

边集同时住在 `skeleton-graph.ts` 与各包 `package.json`，靠 `:218-227` + `:242` 的三方相等维持。

**独立盲审构造、我认为对的方案**：删掉 `:218-227`，**保留 `:242`**，
`skeleton-graph.ts` 只留 `batch`（与过渡期 `plannedKind`），边集唯一住址落 `package.json`，
方向/无环/闭包全部改读真实边。**净删除。**

**为什么本批不做**：`:184-185` 与 `:244-255` 两道可达性/闭包门的 expected 侧就是图里枚举的边，
是一次独立的工具重构。⚠️ **越晚越贵** —— 要迁的正是 18 个壳包的 `dependencies.ts`，不宜长期挂账。

⚠️ **两条前稿错误一并更正**：
- 用「孤儿包保护」当否决理由是错的 —— `:185` 的 actual 侧是 `skeletonBootstrap.ts:1-21` 的 import 列表，
  那 21 个 import **只贡献 `moduleName` 字符串**给一段渲染成 `<Text>` 的文本
  ⇒ 该门今天是**一跳枚举，不是可达性计算**；
- 「层序 + 向下免枚举」**整条作废**：`layerFor:286-288` 只切四个粗层；
  `runDependencyDirection:295` kernel→kernel **本就不抛**
  （**`display-context → platform-ports` 一直合法**，三文件四行即可）；免枚举会打掉 `:185` 与 `:244-255`。

### D-17 · kernel 层内无分层约束

`layerFor:286-288` 只切四个粗层；`:295-306` 对 `kernel.*` 只禁出层
⇒ **8 个 kernel 包之间可任意互依**。应与 D-16 一并处理。

### D-18 · 规则与门的覆盖缺口

`tools/` 全域搜十条规则号：只有 `TR-01`（1 次）与 `TR-05`（6 次）被引用。
⚠️ 「零命中」= 没有**引用规则号**，**不等于**无门。

**已确认完全无实现**：`TR-03` 的 `getState()[` 判据 · `TR-04`（退役后，见 D-6 判据 6）·
`TR-06` 的「`foundations/**` 不得 import store/transport 实现」半条 · `TR-07` · `TR-08` ·
`TR-09` 的 slice 名前缀检查与「零消费者的包报出来」 · `TR-10` 的 README 存在性。

⇒ 进 `HANDOFF.md`，**不作为任何交付的前置**。
⚠️ 任何「本次整改净减少判据数量」的说法，部分成立的原因是**十条规则里有七条从未落过门**。

### D-19 · `flushMode` 维度零覆盖（Dexter 裁定⑨：登记不覆盖）

见 D-6 判据 5。进 `HANDOFF.md`。

---

## 5 · workspace scoping 能力建设（Dexter 裁定②⑩）

### 5.1 POC 的形态（`本仓同父目录下的 newPOSv1`，本轮亲验）

```
state-runtime/src/supports/scope.ts:112   createScopedActionType(actionType, scope)     ← 纯函数
state-runtime/src/supports/scope.ts:120   createScopedDispatchAction(action, scope)     ← 纯函数，不持有 dispatch
state-runtime/src/supports/scope.ts:133   createAxisActionDispatcher(axis, ...)         ← 便利层
state-runtime/src/supports/scope.ts:150/158/166   workspace / instanceMode / displayMode
```
生产调用点**全部在 actor**（反查非 actor 生产调用点 = 0）。
workspace 由 `selectTopologyWorkspace(context.getState())` **当场从状态读**，不是推入 runtime context。
⚠️ POC 的 actor 调用点**不校验 workspace 对应的 slice 是否已注册** —— Dexter 裁定⑩：TER 照此，不加校验。

### 5.2 TER 现状

| | POC | TER |
|---|---|---|
| 纯改写原语 | ✅ `:120` | ❌ **没有** |
| 便利层 | ✅ 三个 axis | ⚠️ 只有 workspace（`state/src/supports/workspace.ts:60-77`） |

### 5.3 测试缺口（本轮亲验 `state/test/workspace.test.ts`）

`workspace.ts` 有 **9 条抛错路径**（`:20 :25 :35 :41 :52 :65 :84 :91 :97`），测试里 `toThrow` 只有 **1 条**。

🔴 **三个缺口**：
1. **改写器与 descriptor 生成器之间零连接测试。** `toWorkspaceStateDescriptors` 经
   `createWorkspaceStateKeys(baseName)` 产出 `orders.MAIN`/`orders.BRANCH`；
   而改写用例喂的是 `orders/nested/set-value → orders/nested.BRANCH/set-value` ——
   **这个 type 不对应该函数能生成的任何 slice**；
2. **全部用 `vi.fn()`，没有真 store。** 没有证据表明路由后的 action 会到达真实 reducer 并改变状态；
3. 🔴 **一条撒谎的用例标题**：`test/workspace.test.ts:32` 标题为
   `rejects missing workspace and invalid action types`，**函数体只断言了 invalid action type**。

### 5.4 验收判据

1. **纯改写原语与 dispatch 便利层分离**，改写规则可在不构造 store、不持有 dispatch 的情况下单测。
   🔴 **删掉纯原语 ⇒ 便利层必须编译不过**（证明它调用的是同一份逻辑，而不是自己留了一份）；
2. 🔴 **端到端连接用例（这是本能力的消费者，Dexter 裁定②）**：
   用 `toWorkspaceStateDescriptors` 注册 MAIN/BRANCH 两份 slice，构造**真实 store**，
   对同一个 action 分别路由到 MAIN 与 BRANCH ⇒ **只有对应那一份 slice 的状态改变，另一份不变**；
3. 🔴 **9 条抛错路径逐条变异**：删掉 `:20 :25 :35 :41 :52 :65 :84 :91 :97` 任一 `throw`
   ⇒ **必须有用例变红**。三条实施要求：
   ① 用例**必须断言错误消息**（删 `:20` 后控制流会落到 `:25` 仍然抛，泛化 `toThrow()` 不会变红）；
   ② `:25`（非法 workspace 值）与 `:52`（`baseName` 非字符串）TS 不可达，需 `as unknown as` 强转触达；
   ③ **禁止用读取源文本、统计 `throw` 次数的用例充数**；
4. 🔴 **删掉 `:19-23` 的 `throw` 后必须有用例变红**（今天：现有 4 条用例全绿）。
   ⚠️ 这条取代「标题必须与断言一致」—— 改标题就能满足的判据是无效的；
5. `requireActionType` 的三种斜杠边界（无斜杠、首位、末位）逐条覆盖；
6. **不加「slice 是否已注册」的校验**（Dexter 裁定⑩，照 POC）。
   ⚠️ 残余风险登记：只注册 MAIN 却路由到 BRANCH 会静默丢一次状态变更。
   风险有界，因为 `toWorkspaceStateDescriptors` 是**成对生成** MAIN/BRANCH 的；
7. **本批只建 `workspace` 一个 axis** —— 不得出现
   `createInstanceModeActionDispatcher` / `createDisplayModeActionDispatcher` 形态的 axis 变体
   （限定在 `state/src/supports/**` 内按**符号名**判定）。
   ⚠️ 不得写成「`instanceMode`/`displayMode` 不得出现在 TER」—— 这两个词在 TER 有 15 / 18 个合法文件，那样今天就红；
8. 所有生产调用点在合格 actor 文件内（与 D-3 判据同源，**不另立名单门**）。
   ⚠️ 今天生产调用点为 0（消费者是测试），本条在有第一个生产消费者之前恒真，属回归锚。
   ⚠️ `workspace.ts:73` 的 `input.dispatch({...})` 位于 `supports/`，
   在 D-3 改造后是否进例外表须一并裁决。

---

## 6 · 阻塞关系

⚠️ **本节已按 Dexter 2026-09-01 裁定重写。** 前一版把阻塞关系挂在 `display-context` 上，
这是错的框架 —— display-context 需求停在盲审 `NO-GO`、压着未处置 finding，Dexter 已明确「先不用了」。
**拿一个尚未定稿的包当整批门整改的组织轴不成立。** 本文不再以它为阻塞对象；
下游详设与计划中的 `DISPLAY_CONTEXT_*` marker、「G4 之前不允许开始 display-context」
与相关停机前置，均应据此删除。

**阻塞「下一个 owner 包」（不论是哪个）**：D-1 · D-2（kind 正本）· D-3（TR-01）· D-4（verify owners）

依据（亲验，与具体是哪个包无关）：
- **D-1 / D-2**：`graph-model.mjs` 的 kind 解析硬编码到 `kernel.base.runtime`。
  `TR-09` 骨架例外要求包落下第一个真实 slice 时移除 `plannedKind`
  ⇒ **任何第二个包**照做即「两者皆无 ⇒ 抛」，`readSkeletonSpec` 被 skeleton 六门与 `verify.mjs` 共用，整套一起塌；
- **D-3**：`tr01-reducer-boundary` 按包白名单 `{kernel.base.runtime, kernel.base.state}`
  ⇒ 图中 **7 个 `plannedKind:'owner'` 包**（`transport` · `display-context` · `workflow` · `ui-state` ·
  `ui.base.automation` · `ui.base.input` · `ui.base.admin-shell`）的 actor **全部必红**，
  而 actor 是本包唯一合法写路径；
- **D-4**：`verify.mjs` 的两个冻结集 ⇒ **任何新包**长出 `test` script 即 `extra` 非空；
  且 **5 个既有 adapter** 写第一个真实测试同样必红。

**不阻塞**：D-5（role effect）· D-6（退役，需实跑变异证据）· D-7 · D-8 · D-9 · D-10 · D-11 · D-12 · D-13 · D-14

⚠️ **D-5 已从阻塞列移出。** 前一版的阻塞论证是「display-context 需要 role change effect」，
但 `RuntimeModule.roleChangeEffects` 今天就是公开字段且已从 `index.ts:52` 导出 —— 任何包现在就能注册 effect。
先做 D-5 的真实理由是**顺序优先：避免落地后二次迁移**，不是阻塞。

**登记不处置**：D-15 + D-16（同一批）· D-17 · D-18 · D-19（后二者进 `HANDOFF.md`）

⚠️ **每一项都要配红夹具。** D-3 会改变现有唯一的 `TR-01` 夹具（`check-static.test.mjs:406-414`）语义；
D-4 会重写 `verify.test.mjs` 五处；D-6 的静态夹具要删、行为证据要实跑、前半段两条缺失夹具要补。

---

## 7 · 证据边界

- **仓内静态事实**：每处文件与行号均本轮打开读过。§0 门清单、D-3 的 9 处命中集、D-6 的三文件表、
  D-8 的 312/61 计数（node 求值）、D-18 的规则号搜索、§5.3 的测试缺口，均为本轮跑 grep/find/node 得出，
  且经三轮独立盲审复现一致。
- **外部事实**：§5.1 的 POC 在 `本仓同父目录下的 newPOSv1`（他仓），本轮亲验。
- **推论、未执行**：文中所有「今天绿 / 今天红」都是**读码得出的当前行为预测**，本轮未运行任何门。
- **已由 Codex 第一轮实跑解除的 UNVERIFIED**：
  ① vitest `passWithNoTests` —— 当前 Vitest 4.1.10 **零测试时退出 1**（`VITEST_EMPTY_DEFAULT_EXIT=1`），
  D-4 判据 4 的警告成立；显式写进配置仍有防漂移价值。
  ② D-6 变异后的实际颜色 —— 见 D-6 判据 3 的实跑结果。
- **仍为 UNVERIFIED**：整改后每个 red mutation 是否**只**击穿目标门；
  新共享 helper 是否会改变三个工具的其它行为；整改后真实树能否同时保持绿。
- **本文不授权**修改 `tools/`、`skeleton-graph.ts`、`apps/terminal/**` 或标准正文，也不授权下一 Roadmap step。

## 8 · 建议写进 `terminal-coding-standard` §0 的纪律

1. **凡要「绕开约束」，先亲验直接路线会不会红。** 打开那道门的判据源码，不是读文档、不是读自己上一轮的结论。
2. **设计期快照不得作为论据。** 引用一条边、一个名单、一个节点数去关闭 finding 之前，先确认它是裁定还是转录。
3. **判据必须查性质，不查实例。** 一条「加一个名字 / 改一个数字 / 把代码搬到隔壁文件」就能满足的判据，
   和它要修的名单型门是同一个病。
4. **放松型整改必须附「原有真阳性保持红」的夹具。** 只要求「今天红的变绿、今天绿的变红」的判据集，
   允许一个比现状更弱的实现通过验收。
5. **红夹具必须落在分母内。** 变异若被一条无关守卫在更早的阶段拦掉，那条夹具证明不了任何事。

⚠️ 五条全部来自本轮的真实事故，不是预防性条款。
