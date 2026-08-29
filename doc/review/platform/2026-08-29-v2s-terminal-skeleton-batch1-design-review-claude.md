# TER 骨架批一 · 详设与实施计划 · Claude 独立评审

| 字段 | 值 |
|---|---|
| 评审对象 | `doc/plans/platform/2026-08-29-v2s-terminal-skeleton-implementation-design-codex.md`（526 行）· `doc/plans/platform/2026-08-29-v2s-terminal-skeleton-implementation-plan-codex.md`（480 行） |
| 会话出处 | fresh、v2s-rooted、只读（除本交付文件） |
| 结论 | **NO-GO** |
| 计数 | **M=2 · S=3 · N=2** |

⚠️ **两条 M 中的第一条，根因在我自己写的需求**，不是详设引入的。详设忠实复现了需求里的矛盾。

---

## 1 · 独立复算与实跑（先于读作者结论）

| # | 项目 | 我的独立结果 | 与材料是否一致 |
|---|---|---|---|
| 1 | 规格 22 节点 → 批一投影 | 节点 14、assembly 闭包（含自身）14、无孤儿；批二 22/22 | **一致** |
| 2 | `verify.mjs` tuple 形状 | `staticCommands` 为 `[label, command, args, successMarkers]`，`runStaticCommand` 在 stdout+stderr 查 marker；`runtimeCommands` 三元组、`remote` 默认 false | **一致** |
| 3 | `create-expo-module` 的 `--source` | `-s, --source <source_dir>` 存在（`--help` 实读） | **一致** |
| 4 | `expo-module-template@57.0.1` | 存在（`npm view` exit 0） | **一致** |
| 5 | `expo-template-blank-typescript@57.0.18` 的 raw 依赖 | `expo ~57.0.16` · `react-native 0.86.2` · `react 19.2.3` | **一致** |
| 6 | 带版本的 `--template` spec | `create-expo-app@4.0.0 ... --template expo-template-blank-typescript@57.0.18 --no-agents-md --no-install` **exit 0**，产物依赖等于该 template 的 raw 值 | **一致**（固定生效） |
| 7 | `--no-agents-md` 效果 | `AGENTS.md`/`CLAUDE.md`/`.claude` 未生成；**`.git` 仍生成**；另有 `LICENSE` | 详设已覆盖 `.git`，**未覆盖 `LICENSE`**（见 N-1） |
| 8 | Turbo filter 语义 | 多 `--filter` 取并集、`!` 从并集扣除、接受目录 glob、`--dry=json` 含 `package`/`task` | **一致** |

**我自己的一次错误更正**：初次用 `npm view expo-module-template versions --json` 取尾部 8 项，
切片起点恰为 `57.0.4`，我据此判定 `57.0.1` 不存在。**该结论错误，已撤回** ——
截断输出不支持否定式全称命题。

---

## 2 · Major

### M-1 · bootstrap 的 13 条 import 与 assembly 的声明边不可同时满足

**事实类别**：仓内事实（两份材料的字节）+ 推论（两条规则联立）

**证据**

- 详设第 342–343 行：断言 1 要求「规格边 = `package.json` 声明 = **全部 `src/**/*.{ts,tsx}` 的静态 import**」，
  且明确「拒绝……未声明 import」。
- 详设第 68 行：只豁免 **本地 `./index`** 自引用（"只计入口可达集合，不计依赖边"）；
  **13 条 npm root import 未被豁免**。
- 需求第 336 行：assembly 的规格边是 8 条，投影到批一后 = **2 条**（`platform-console` + `persist-kv`）。
- 需求第 652 行：`skeletonBootstrap.ts` 必须 import **当前批次的每一个** TER 包 = 批一 **13 条**。

**可证伪失败条件**：实施到 CP-6 时，assembly 的 `src/**` 静态 import 集合为 13，
而投影规格边为 2 —— 断言 1 必红；若为满足断言 1 而把 bootstrap 收窄到 2 个 import，
断言 2（入口可达集合 = 14）必红。**两条断言在当前定义下互斥。**

**影响面**：CP-5、CP-6、CP-7 无法完成；这是整批唯一的"真实消费面"证明，塌掉则 M-2 级 false-green 复活。

**根因在需求，不在详设**：需求 §6.1 给 assembly 的是"最终装配关系"的 8 条，
§9.2 又要求 bootstrap 覆盖批次全集，两处我没有对齐。详设忠实复现了它。

**最小修复**：把 assembly 的规格边定义为「**同批次其余全部节点**」——
批一 13 条、批二 21 条。我已复算：闭包分别为 14 与 22，
**孤儿在构造上不可能**（不再依赖"必须直接依赖 transport 与 workflow"这条特例），
assembly 入度为 0 故无环，方向全部向下。需求 §6.1 与 §9.2 同步修订。

**为何更小的方案不足**：
① 只把 bootstrap 收窄到已声明的 2 个包 —— 入口可达集合变成 3，断言 2 失效，
   等于退回"expo export 只证明空白 App 能导出"，正是上一轮 M-2 已否决的 false-green；
② 只给 bootstrap 开一条门 3 豁免 —— 那会让 assembly 成为唯一"源码可以 import 未声明包"的洞，
   而 assembly 恰恰是唯一的闭包根，这个洞的代价最大。

---

### M-2 · 版本固定策略与 Dexter 本会话裁定冲突，且它自造了一道规范化步骤

**事实类别**：外部事实（实跑）+ `DEXTER_DECISION`（已裁）

**证据**

- 详设 CP-5 固定 `expo-template-blank-typescript@57.0.18`，并指出其 raw 为
  `expo ~57.0.16` / RN `0.86.2`，因此**追加一道"规范化到 `~57.0.18` / `0.86.3`"**的步骤；
  CP-3 的 UI peer/dev 版本又以这次解析结果为唯一外部输入 —— 级联三个 CP。
- 我实测 `create-expo-app@latest --template blank-typescript` 的产物是
  **`expo ~57.0.18` / `react-native 0.86.3` / `react 19.2.3` / `@types/react ~19.2.2` / `typescript ~6.0.3`**，
  **逐项等于需求 §3 的版本基线**。
- **Dexter 2026-08-29 本会话裁定：脚手架与模板一律用最新版，不固定到旧版。**

**可证伪失败条件**：用 latest 生成，产物依赖若不等于需求 §3 基线，则本条不成立。

**影响面**：CP-0 的 `--source` 固定模板机制、CP-3 的版本解析源、CP-5 的规范化步骤，三处都要改。

**最小修复**：CP-0 与 CP-5 改用 latest；**删除 CP-5 的版本规范化步骤**（latest 已直出目标值）；
CP-3 的 UI 版本源相应改为"从 latest 模板解析结果回填"。
需求 §3 的版本表由"手写基线"降级为"latest 的当时快照"，并注明以实际解析为准。

**为何更小的方案不足**：保留固定版本只会把"raw 与目标差两个补丁位"这个人造缺口一直带着，
而它带来的每一步规范化都是新的出错面；固定的收益（可复现）在 latest 直出目标值时不存在。

⚠️ 详设识别出 raw 与目标的差值这件事本身是**对的、有价值的**；
问题只在于它选择了"固定旧版 + 规范化"而不是"用 latest"。

---

## 3 · Significant

### S-1 · CP-7 引用的 filesystem checker 不在工具清单里

计划 §10.2 的验收表有一行「scaffold hygiene / filesystem checker / 无 nested git/agent/config；ignore 覆盖完整」，
但详设 CP-6 的 `tools/terminal-skeleton/` 只列了 `graph-model` · `check-static` · `check-static.test` ·
`verify-static` · `verify` 五个文件，**没有承载这条检查的落点**，也未说明它进 `verify:static` 还是 `verify`。

**影响**：需求判据 8/9（无嵌套 `.git`、ignore 覆盖）会退化成人工核对。
我已实测确认 `.git` 在 `--no-agents-md` 下**仍然生成**，这条不是理论风险。

**最小修复**：把它并入 `check-static.mjs` 作为第七项文件检查（不改六道门的计数语义，
在报告里单列），或新增一个工具并写进清单与两条入口之一。

### S-2 · CP-1 的 `.gitignore` 变更清单与需求 §5.4 不等

详设第 419 行的 `.gitignore` 变更只写了 `node_modules/`，
而需求 §5.4 要求覆盖 `.expo/` · `.turbo/` · `android/**/build/` · `.gradle/` ·
`*.apk|aab|keystore` · `.kotlin/`。仓根现有 `.gitignore` 实测只有
`.runtime/` · `node_modules/` · `build/` · `dist/` · `coverage/` · `*.log`。

**影响**：判据 9 直接不通过；且 Android 产物与签名文件失去忽略。

**最小修复**：CP-1 的变更清单逐项列全需求 §5.4 的条目。

### S-3 · 仓级接线时机：与后台 agent 并行执行时会阻断对方

**事实类别**：仓内事实 + 推论

**背景**：Dexter 确认当前 `apps/backend/**` 有另一个 Codex agent 正在实施
（实读 362 个已跟踪文件有改动，`business-channel`、`catalog` 均在动）。

**证据**

- 详设 CP-6 把 `['terminal-static', …, ['TERMINAL_STATIC=PASS']]` 加进仓级 `staticCommands`，
  且该 CP 位于批一内部。
- `tools/verify-gates/verify.mjs` 第 186–189 行：`runStatic` 在 **`--validate-only` 与 normal 两种模式下都会执行**，
  且第 182–183 行强制检查 marker。
- 批一途中 TER 必然是半成品：CP-1 时 14 个包一个都未建，图门的
  「节点数 = 当前投影」断言必红。

**可证伪失败条件**：CP-6 接线后、CP-7 完成前，任何人跑 `scripts/verify --validate-only`
都会以 `R5_VERIFY_STATIC_FIRST_FAILURE:terminal-static` 失败。

**影响面**：后台 agent 的验证被与它无关的原因阻断，且它无法自行修复。

**最小修复**：**把仓级接线移到批一的最后一步** —— CP-7 全部证据绿之后再写入两个 tuple，
写入后立即跑一次全仓 `scripts/verify --validate-only` 确认 marker 被检到。
CP-6 其余内容（六道门、两条 TER 命令、正负控制）不变。

**为何更小的方案不足**：让后台 agent 临时跳过某个门，等于让它自己维护一份例外；
而接线本身推迟一步是零成本的，两条 tuple 的写入不依赖 CP-6 的任何其他产物。

---

## 3b · 并行执行的共享面（评估结论，非 finding）

Dexter 已确认两个 Codex agent 并行执行。我核了实际共享面：

**仓内没有禁止并行实施的条款** —— 检索"并发/并行/同时/串行/独占/互斥"，
命中项全属其他语义（业务并发锁、已退役的 scenario lane 并行、报告间隔）。**无需放宽约束。**

**三个全仓静态门都不扫 `apps/terminal`**（已实读扫描根）：

- `code-layout` → `apps/backend/catering-business-server/src` · 两个 frontend `src`；
- `name-code-density` → 两个 frontend `src`；
- `format:check` → `apps/frontend/**` · `libraries/frontend/**`。

⇒ TER 新建 14 个包**不会**让后台 agent 的既有静态门变红。

**仍然共享的写入面**（知悉即可，当前不设窗口约束 —— Dexter 判断后台 agent 平时不用 yarn）：
仓根 `package.json`、`yarn.lock`、`node_modules` 树、`eslint.config.mjs`。
CP-1 的 `yarn install` 会重写整个 `node_modules`。

**Testcontainers 天然互斥**：`AGENTS.md` 要求远端运行前预检
`org.testcontainers=true` 容器/卷为空，残留即 cleanup FAIL。
批一不需要 Testcontainers，**故两个 agent 都不应跑全仓 `scripts/verify` 的 normal 模式** ——
TER 侧只跑自己的两条命令即可。

---

## 4 · Notes

### N-1 · `LICENSE` 未列入 assembly 的保留/删除表

实测 `create-expo-app@4.0.0` 产物含 `LICENSE`。详设 CP-5 的保留/删除清单未提它。
不影响任何判据，但 CP-4 的 adapter 表把 `LICENSE` 列进了删除项，两处不一致，实施时会犹豫。

### N-2 · CP-0 的证据落点目录存在性

`doc/evidence/platform/` **存在**（已实读）；`.runtime/` 已在仓根 `.gitignore` 首行。
两处落点成立，此条仅作确认，非缺陷。

---

## 5 · 我核过并确认成立的部分

规格单点与 22→14 投影、六道门与需求 §10 的对应、两条 verifier 与 `verify.mjs`
两档语义的接线（tuple 形状与 marker 契约逐字对得上）、Turbo 固定 filters 的语义、
`--source` 机制的有效性、CP-0 阻断状态保持为 `UNVERIFIED_REQUIRES_EVIDENCE` 未被提前解除、
`expo export` 的证明口径没有越界主张 native、
未证明边界（Gradle/Kotlin、22 包、Turbo 实际列表、verify 时长）全部诚实保留。

**方案合理性**：C 方案（纵切片 + 单一规格 + 声明/源码事实派生 + 真实入口消费）
相对 A/B 的取舍论证成立，我没有构造出更小且不损失反证能力的替代。
详设对 A/B 的拒绝理由与我独立推导的一致。

---

## 6 · 未核到

`create-expo-module` 的完整成功闭包（阻断项，按设计本就留给 CP-0）；
Android Gradle/Kotlin；真实 14/22 包的 typecheck 与 Metro；
Turbo 在真实树上的任务列表；两条 verify 的实际时长；
npm age gate 的当时状态。

---

## 7 · 结论与授权边界

**NO-GO**，M=2 · S=3 · N=2。

M-1 是阻断项：两条主断言在当前定义下互斥，CP-5/CP-6 无法完成。
其根因在需求，需与详设一并修订。
M-2 需按 Dexter 已作的裁定改写三个 CP。

本评审是**静态评审**。它不授权批一实施、不授权批二、不授权任何包能力实现、
不授权 Gradle/Kotlin 构建、真机、DEV、seed、浏览器 L2、UAT、部署或 EAS。
两条 M 修订并复核后方可作为实施输入。

---

# 定向复核（2026-08-29，第二次）

| 字段 | 值 |
|---|---|
| 对象 | 上述 7 条 finding 的修订闭合 + 修订是否引入新矛盾 |
| 结论 | **GO** |
| 计数 | **M=0 · S=0 · N=1** |
| 性质 | 原 verdict 的定向复核，不是第三轮内部审查 |

**我不采信 intake 的处置结论，逐条从当前正本与新鲜命令重建基线。**

## 一 · 七条闭合核验

| finding | 判定 | 我核到的证据 |
|---|---|---|
| **M-1** assembly 声明边与 bootstrap 互斥 | **闭合** | 详设第 346 行规格边为「其余 21 个」literal 全列；第 349–350 行明写批一投影 13、批二 21、**两批都写入正式 `dependencies`**；第 284–285 行明写 `package.json` / `dependencies.ts` / bootstrap 的 13 条**是同一 direct-dependency exact-set，不是门豁免**；第 69 行本地 `./index` 只计入口可达、不计依赖边。我独立复算：批一节点 14、assembly 直接边 13、闭包 14、孤儿无、环无、反向无；批二 22/21/22。 |
| **M-2** 版本固定与 latest 裁定冲突 | **闭合** | CP-0/CP-5 全部改为 `create-expo-module@latest` + 显式 `expo-module-template@latest` pack source、`create-expo-app@latest --template blank-typescript --no-agents-md --no-install`；详设第 98 行明写「`latest` 是选择策略，精确版本是该次运行证据」；旧模板的版本规范化步骤已删除。 |
| **S-1** hygiene checker 无落点 | **闭合** | 落在 `check-static.mjs`，作为**第七项文件检查**单列 `SCAFFOLD_HYGIENE`；正负控制齐（加嵌套元数据 / 删一条 ignore 规则 → 只红 hygiene）；报告固定 `RULE_GATES=6` 与 `SUPPORT_CHECKS=1`；`verify:static` **要求六道门与 hygiene 全绿才打印** `TERMINAL_STATIC=PASS`。 |
| **S-2** `.gitignore` 覆盖不全 | **闭合** | 详设第 177–178 行与计划第 156–157 行逐项列出 `.expo/` · `.turbo/` · `**/android/build/` · `**/android/app/build/` · `**/android/.gradle/` · `*.apk` · `*.aab` · `*.keystore` · `**/.kotlin/`，与需求 §5.4 逐项对应。 |
| **S-3** 仓级接线过早 | **闭合** | CP-6 明写「尚不接仓级 verifier」；CP-7 本地全绿后才写两个 tuple，随后只跑 `scripts/verify --validate-only`，并**明写不运行仓级 normal**（含本批未授权的远端 runtime commands）。 |
| **N-1** LICENSE 两类不一致 | **闭合** | adapter 与 assembly **均**明确删除 package-local `LICENSE`（详设第 251/271/377 行、计划第 307/356/401 行），并进 hygiene 检查项。 |
| **N-2** 证据落点 | **闭合** | 无多余变更。 |

## 二 · 点 9（Codex 自查发现）已由我修订 owning source

**冲突属实**：需求 §13 原文「RN 固定 `0.86.3`，不要顺手升最新」与
`project-memory/decisions/terminal-architecture-and-stack-rulings.md` 的
`TER_STACK_RULINGS_T1_T13`「Expo SDK 57 + **RN 0.86.3**」，与需求 §3 的 actual-latest 策略互斥。
**当前数值相同不能掩盖策略冲突** —— 这个判断我认同。

**已修订**（本轮授权范围内）：
- 需求 §13 第 3 条改为「版本取实施当时 `latest` 模板与 Expo CLI 的实际解析结果；§3 的表是快照不是钉死值」；
- 架构记忆改为「RN 版本取实施当时 `latest` 官方模板的解析结果，不手工钉死；2026-08-29 快照为 0.86.3」；
- `scripts/memory/build-index` → `PROJECT_MEMORY=PASS / ENTRIES=75 / KERNEL=6 / ROUTED=69`。

**我独立复核的当前 latest**（不采信 intake）：
`expo-template-blank-typescript@latest` = **57.0.20**，其 deps 为
`expo ~57.0.18` · `react-native 0.86.3` · `react 19.2.3`；
`create-expo-module@latest` = **57.0.1**；`expo-module-template@latest` = **57.0.9**。

## 三 · 攻击修订引入的新矛盾

| 攻击面 | 结果 |
|---|---|
| assembly 依赖全集是否破坏依赖方向门 | **否**。assembly → 全部均为向下；入度 0 故无环。 |
| typecheck 阶段分母 0/7/12/13/14 是否仍成立 | **成立**。7 kernel + 5 ui（render/automation/primitives/ui test-support/integration）+ 1 adapter + 1 assembly = 14。 |
| assembly 把两个 `test-support` 声明为正式 `dependencies` 是否与规格的 dev 语义冲突 | 详设第 349–350 行已显式裁定写入正式 `dependencies`，规格表 assembly 的 devDeps 列为「—」，**内部自洽**。但见 N-1。 |
| 三份材料的跨文档 `§` 引用 | **零悬空**。详设中指向需求的 9 处（§2.2/§5.3/§5.4/§6.1/§8.1/§8.3/§9.1/§9.2/§12.2）我逐个在需求正本中核到。 |
| 八项 `UNVERIFIED` 是否仍诚实 | **是**。`create-expo-module` 完整闭包仍为 `UNVERIFIED_REQUIRES_EVIDENCE` 未被提前解除；Gradle/Kotlin、22 包、Turbo 真实列表、verify 时长、age gate 全部保留。 |

## 四 · N-1（新增，不阻断）

**`test-support` 进入 assembly 的正式生产依赖，将来会与入口可达断言再次冲突。**

**事实**：入口可达断言要求 bootstrap import 批次**每一个**包，因此
`kernel.base.test-support` 与 `ui.base.test-support` 必须被 assembly 正式依赖并被 Metro 打包。

**当前无害**：批一这两个包是空骨架，打进 bundle 没有实际内容。

**将来会咬**：这两个包一旦获得真实的 test-only 内容，
「不得进生产 bundle」与「bootstrap 必须 import 每一个包」就是同一形状的互斥 ——
与本轮 M-1 同源。

**最小修复**：现在只需**登记**，不需设计。建议在详设 §12 未决项表加一行：
「test-support 获得真实内容时，入口可达断言的分母改为『批次集合减去 test-support』，
届时重新裁定」。**不建议现在就改分母** —— 批一没有可证伪的触发条件，提前改是为想象中的未来付费。

## 五 · 我实跑的命令与退出码

- `npm view expo-template-blank-typescript@latest version` → `57.0.20`，exit 0
- `npm pack expo-template-blank-typescript@latest` + 解包读 `package.json` → 上述 deps，exit 0
- `npm view create-expo-module@latest version` → `57.0.1`，exit 0
- `npm view expo-module-template@latest version` → `57.0.9`，exit 0
- `./scripts/memory/build-index` → `PROJECT_MEMORY=PASS`，exit 0
- 依赖图独立复算（批一/批二的节点、闭包、孤儿、环、层级方向）→ 全部符合

**scratch 已清理，仓内本轮只写：本评审文件、需求 §13、架构记忆、`required-inventory` 索引产物。**

## 六 · 未核到

`create-expo-module` 的完整成功闭包（阻断项，按设计留给 CP-0）；Android Gradle/Kotlin；
真实 14/22 包的 typecheck 与 Metro；Turbo 在真实树上的任务列表；两条 verify 的实际时长；
实施当时的 npm age gate 状态。

## 七 · 结论与授权边界

**GO** · M=0 · S=0 · N=1。

七条原 finding 全部闭合；点 9 的 owning source 冲突已同步；未发现修订引入的新阻断矛盾。
N-1 是登记项，不阻断。

本 GO **只表示**这两份详设与实施计划可作为 Dexter 已授权的批一实施输入。
**不授权**批二、任何包能力实现、Android Gradle/Kotlin 构建、真机、
仓级 normal `scripts/verify`、DEV、reset、seed、浏览器 L2、UAT、部署或 EAS。
`create-expo-module` 的阻断项**未解除** —— CP-0 未取得可复跑闭包前不得开建 adapter 包。
