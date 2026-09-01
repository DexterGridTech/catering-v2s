# TER 骨架批一 + 批二 · 实施独立复核（静态）

| 字段 | 值 |
|---|---|
| `REVIEW_TARGET` | `IMPLEMENTATION` |
| 范围 | 批一 14 包 + 批二 8 包 = 22 child workspace 的骨架实施 |
| 方法 | **纯静态**：逐文件读源码与配置，对照需求/详设/规范正本核。运行类结论**只引用 Codex 证据文件的记录**，不自行执行 |
| 结论 | **GO** |
| 计数 | **M=0 · S=1 · N=2**（原 `DEXTER_DECISION=1` 已由 Dexter 裁定，降级为状态登记） |

---

## 1 · 静态已证（我逐文件读过，给出可复核的位置）

### 1.1 22 包 census 与三重命名 —— `CONFIRMED`

按 `apps/terminal/<层>/<分类>/<包>/package.json` 逐个读取，**22 个 child workspace**。
对每一个独立推导「目录路径 → moduleName → npm 包名」并与文件内容比对：

| 检查 | 覆盖 | 违规 |
|---|---|---|
| npm 名 = `@catering-v2s/` + 目录路径连字符化 | 22 | **0** |
| `src/moduleName.ts` 的字面量 = 目录路径点分化 | 22 | **0** |
| `src/moduleName.ts` **零 import/export-from** | 22 | **0** |
| `private: true` | 22 | **0** |
| `exports` **恰好** `{".": "./src/index.ts"}`（root-only，无通配、无子路径） | 22 | **0** |
| 包内 `node_modules` 目录 | 22 | **0** |
| 脚手架残留（`.git` / `AGENTS.md` / `CLAUDE.md` / `.claude` / `LICENSE`） | 22 | **0** |
| 包内出现 `plannedKind` 字面量（应只在规格文件） | 22 | **0** |

⇒ `plannedKind` **单点来源成立**，与规范正本 `TR-09` 骨架阶段例外一致。

### 1.2 图性质 —— `CONFIRMED`

从 `apps/terminal/skeleton-graph.ts` 独立解析并复算（不采信任何报告数字）：

- 规格节点 **22**；`batch:1` **14** 个、`batch:2` **8** 个；
- `activeSkeletonBatch = 2`（第 1 行）；
- `assembly.android.pos-desktop` 正式边 **21**、dev 边 **0**；
- 从 assembly 出发的传递闭包（含自身）= **22**，**不可达节点 0**；
- **环 0**、**自环 0**、按 kernel < ui < adapter < assembly 的**层级反向边 0**。

### 1.3 三处 exact-set —— `CONFIRMED`

对全部 22 个包，逐包比对**三份独立陈述**：

1. `skeleton-graph.ts` 的 `dependencies` / `devDependencies`；
2. 该包 `package.json` 的 `@catering-v2s/*`（deps 与 devDeps 分别）；
3. 该包 `src/dependencies.ts` 的 `@catering-v2s/*` import 集合。

**三处不一致：0**。

### 1.4 真实消费链 —— `CONFIRMED`

逐文件读 `apps/terminal/assembly/android/pos-desktop/`：

- `index.ts` 第 3 行 `import App from './App'`；
- `App.tsx` 第 3 行 `import {skeletonModuleNames} from './src/skeletonBootstrap'`，
  且第 7 行以 `skeletonModuleNames.join('\n')` **实际渲染**（不是未使用值）；
- `src/skeletonBootstrap.ts`：**21 条 `@catering-v2s/*` root import** + **1 条本地 `./index`**；
  **零动态 `import(` / `require(`**；
- `src/index.ts` 只 re-export `./moduleName` 与 `./dependencies`，**不回引 bootstrap，无环**。

⇒ 入口可达集合 = 21 + assembly 自身 = **22**，与当前批次投影一致。

### 1.5 检查器实现 —— `CONFIRMED`

读 `tools/terminal-skeleton/check-static.mjs` 第 112–158 行的
`runAssemblyEntryReachability`，**逐条确认它的拒绝分支**：

| 手法 | 被谁拒绝 |
|---|---|
| type-only import 冒充运行时 | 第 144 行「workspace imports must be runtime imports」 |
| 动态 `import(` / `require(` | 第 125 行整文件正则拒绝 |
| 深层路径（非 package root） | 第 141 行「non-root workspace import」 |
| 旁路文件掩盖（如经 `dependencies.ts`） | **不做传递遍历** —— `reachable` 仅由 bootstrap 自身 import 构成（第 157 行） |
| 相对 import 夹带 | 第 131 行断言相对 import **恰好等于 `['./index']`** |
| 意外外部 import | 第 152 行 |

⇒ 删 bootstrap 任一条 import 或删 App→bootstrap 的 import，**必然变红**。
`CP5_ENTRY_IMPORT_SHAPE` 的静态结论**成立**。

### 1.6 adapter native 形态 —— `CONFIRMED`

逐个读 5 个 `adapter/android/*`：

| adapter | Kotlin 文件 | Module 类 | `ios/` | `example/` | `test` 脚本 |
|---|---|---|---|---|---|
| persist-kv | 1 | `TerminalPersistKvModule` | 无 | 无 | 有 |
| device | 1 | `TerminalDeviceModule` | 无 | 无 | 有 |
| app-control | 1 | `TerminalAppControlModule` | 无 | 无 | 有 |
| logger | 1 | `TerminalLoggerModule` | 无 | 无 | 有 |
| dual-screen | 1 | `TerminalDualScreenModule` | 无 | 无 | 有 |

**全仓恰好 5 个 `test` 脚本**，全部属于 adapter ——
与证据里 `TURBO_DRY_TEST=...5_EXECUTABLE_DRY_RUN_ONLY` 的分母**自洽**。
每个 adapter **只有一个最小 Module 注册类**，未见能力实现。

---

## 2 · 测试已证（引用 Codex 证据文件的记录，非我执行）

来源：`doc/evidence/platform/terminal-skeleton/batch-2/cp8-batch2-skeleton-codex.md`
与 `.runtime/terminal-skeleton/batch-2/*.log`。

| 主张 | 记录 |
|---|---|
| 静态门 | `STATIC=PASS`，`STATIC_RULE_GATES=6`、`STATIC_SUPPORT_CHECKS=1`；`check-static-post-cleanup.log` 六道 `RULE_*=PASS` + `SCAFFOLD_HYGIENE=PASS`，`CHECK_STATIC_POST_CLEANUP_EXIT=0` |
| 逐包类型 | `TYPECHECK=22_OF_22_PASS`；`typecheck-all-per-package.log` 的 `TYPECHECK_ALL_EXIT=0` |
| Turbo 过滤 | `ter-verify.log`：typecheck packages=22 tasks=22 executable=**22**；test executable=**5**；lint=**0**；clean=**0** |
| Metro | `METRO_EXPORT=PASS_647_MODULES` |
| 收口 | `TER_VERIFY=PASS`、`TER_VERIFY_CLEANUP=PASS`、`VERIFY_TEST=PASS` |
| 脚手架重跑 | `SCAFFOLD_NATIVE_RERUN=4_OF_4_EXIT_0`、`SCAFFOLD_NATIVE_DIFF_FILES=0`（逐 target 记录 `EXIT=0` 与 `NATIVE_DIFF_FILES=0`）、`SCRATCH_CLEANUP=PASS` |
| 包内依赖目录 | `PACKAGE_LOCAL_NODE_MODULES=ABSENT`（我静态复核为 0，一致） |

**批一设备证据**（`batch-1/cp7-android-device-codex.md`）：
`CP7_DEVICE_STEP=PASS`；Gradle `BUILD SUCCESSFUL in 7s`；autolinking 解析 exit 0；
应用启动 PASS；bootstrap 渲染 PASS（**明写「exactly these 14 visible names」**）。

⚠️ 该文件第 13–15 行**自行限定**：只覆盖 **batch-1 投影**，
明确排除 port behavior、batch 2 与业务行为。**边界表述正确，无越界。**

---

## 3 · Findings

### DEXTER_DECISION-1 · 仓级两个 tuple 已接线但接线本身从未验证，风险落在后台 agent

**静态事实**：

- `tools/verify-gates/verify.mjs` 第 40–42 行：`terminal-static` 已在 **`staticCommands`**，
  marker 为 `['TERMINAL_STATIC=PASS']`；
- 同文件第 160 行：`terminal-verify` 已在 **`runtimeCommands`**；
- 同文件 `runStatic`（第 186–189 行）在 **`--validate-only` 与 normal 两种模式下都执行**，
  `runStaticCommand`（第 176–184 行）**强制检查 marker**，缺失即
  `R5_VERIFY_STATIC_MARKER_MISSING`；
- 批二证据第 210 行：`UNVERIFIED_REQUIRES_EVIDENCE=root scripts/verify --validate-only green`。

**后果**：从接线那一刻起，**任何人跑仓级 `scripts/verify --validate-only` 都会连带执行
TER 的 `verify:static`**。该组合从未被验证过。若它在仓级 runner 下失败或 marker 未被捕获，
**后台 `apps/backend` 的实施 agent 会被一个与它无关、且它无法修复的原因阻断**。

**为什么是 `DEXTER_DECISION` 而不是 finding**：详设 CP-7 原本要求「写入后立即跑一次全仓
`--validate-only` 确认 marker 被检到」；**Dexter 后续裁定本轮只跑 TER-local verify、
不跑仓级 verify**，该步骤因此是**被裁定豁免**，不是 Codex 漏做。
但豁免**没有消除风险**，只是把它推到了下一次有人跑仓级 verify 的时刻。

**候选项，请 Dexter 选**：

1. 授权由 Codex 跑一次仓级 `scripts/verify --validate-only`，只为确认这两条 tuple 的
   marker 契约成立（不跑 normal 模式，不触发远端与 Testcontainers）；
2. 在确认之前，先把两条 tuple 从 `verify.mjs` 撤出，等验证通过再接回；
3. 接受该风险，并明确告知后台 agent：若 `--validate-only` 因 `terminal-static` 失败，
   由 Codex 处理而非它自己排查。

**Dexter 2026-08-29 裁定：选 3 的变体 —— 先忽略仓级 verify。**
理由是后台 `apps/backend` 的 Codex agent 仍在实施中，此刻不宜跑仓级入口。
**TER 的验收面只到 TER-local `verify` 与 `verify:static`。**

⇒ 本条**不再是 TER 的待办**，从 finding 降级为**状态登记**：
两条 tuple 仍在 `verify.mjs` 中且未经仓级验证；
后台 agent 若在 `--validate-only` 上遇到 `terminal-static` 相关失败，由 Codex 处理。
何时补跑那一次 `--validate-only`，由 Dexter 在后台 agent 收口后另行安排。

### S-1 · 批二 4 个 adapter 的 autolinking 只有推论支撑，不得写成已证明 —— `PARTIALLY_CONFIRMED`

**静态事实**：批一设备证据只验证了 **1 个** adapter（`persist-kv`）在本仓布局下的
autolinking 发现；批二新增 4 个 adapter 后，Android 侧的自动链接清单从 1 项变为 **5 项**，
而批二**没有重跑设备**（证据第 42–44 行明写不重跑 Gradle 与模拟器）。

`NATIVE_DIFF_FILES=0` 证明的是：每个新 adapter 的 native 文件与**同版本官方脚手架现场重跑
的产物逐字节一致**。这是很强的形态证据，但它证明的是**单个包的形状**，
**不是 5 个模块共存时 autolinking 仍能全部发现**。

**当前无缺陷**：证据第 208–211 行已把
`batch-two Android/Gradle/autolinking/device behavior` 标为 `UNVERIFIED_REQUIRES_EVIDENCE`，
表述是诚实的。

**最小修复**：**只需在收口表述上守住** —— 任何"骨架已建成"的说法都不得隐含
"5 个 adapter 的 autolinking 已验证"。若将来要关掉这条，一次批二设备运行即可，
但**本批不需要**（超出授权）。

**同族全集扫描**：5 个 adapter 逐个核过 native 形态与 Module 类，**5/5 一致**；
差异只在"是否经历过设备运行"这一维，且只有 `persist-kv` 经历过。

### N-1 · `type: module` 的风险已被运行证据关闭

我上一轮（CP-5 复核）提的 S-1 是：`type: module` 与 `exports` 是规范化新增、模板原本没有、
且未经 Metro 与 prebuild 验证，会混淆 CP-7 的失败归因。

**现已关闭**：批一设备证据记录 Gradle `BUILD SUCCESSFUL`、autolinking exit 0、应用启动、
bootstrap 渲染四项全 PASS；批二记录 `METRO_EXPORT=PASS_647_MODULES`。
⇒ 该组合**在 Metro 与 Gradle 两侧都已实际走通**，不再需要诊断顺序预案。

### N-2 · 22/22 typecheck 的信号强度应如实描述

各包 `src/index.ts` 只 re-export `moduleName` 与 `dependencies`，包内无实质实现。
因此 `tsc` 实际校验的是**跨包解析与类型可达**，**不是任何业务类型正确性**。

这与骨架目标一致，**不是缺陷**；但收口表述应说"22 个包的跨包类型解析通过"，
不要简写成"22 个包类型检查通过"，后者会被读成包内类型已被检验。

---

## 4 · 无人验证的边界（必须保留 `UNVERIFIED_REQUIRES_EVIDENCE`）

| 项 | 状态 |
|---|---|
| 仓级 `scripts/verify --validate-only` 跑绿 | `UNVERIFIED_REQUIRES_EVIDENCE` —— **本轮按 Dexter 裁定不追**，另行安排 |
| 批二 Android / Gradle / autolinking / 设备行为 | `UNVERIFIED_REQUIRES_EVIDENCE` |
| Kotlin 能力与 adapter 业务能力 | `UNVERIFIED_REQUIRES_EVIDENCE` —— 本批只有最小注册类 |
| 双屏、杀进程重启、端口行为、command / slice / 持久化 | 本批**不做**，非未验证而是不在范围 |
| 仓级 normal `scripts/verify` | 本轮**禁止运行**，未验证 |

---

## 5 · 核验覆盖声明

**我静态核过的**：22 个包的 `package.json`、`src/moduleName.ts`、`src/dependencies.ts`、
`src/index.ts`；assembly 的 `index.ts` / `App.tsx` / `src/skeletonBootstrap.ts`；
5 个 adapter 的 Android 目录结构与 Kotlin 类；`apps/terminal/skeleton-graph.ts`（独立解析复算）；
`tools/terminal-skeleton/check-static.mjs` 的入口可达实现；`tools/verify-gates/verify.mjs`
的两档语义与两条 tuple；`turbo.json`；批一与批二两份 evidence 及四份 runtime 日志。

**我没有核的**：`tools/terminal-skeleton/` 其余四个工具文件的逐行实现
（只核了 `check-static.mjs` 的入口可达段与 `graph-model.mjs` 的投影段）；
四个新 adapter 的 Kotlin 源码逐行内容（只核了类名、文件数与目录形态）；
Gradle 配置的逐行内容。

**我没有运行任何命令** —— 运行类结论全部引自 Codex 的 evidence 与 runtime 日志。

---

## 6 · 结论与授权边界

**GO** · M=0 · S=1 · N=2。

22 包 census、图性质、三处 exact-set、真实消费链、检查器的六类拒绝分支、
adapter native 形态与 5/5 test 分母，**逐项静态核实成立**。
未发现"所有门都绿但骨架未建成"的可用路径。
Codex 的证据边界表述诚实，未见越界主张。

S-1 是收口表述纪律，不阻断。原 `DEXTER_DECISION-1` 已裁定：先忽略仓级 verify，
TER 的验收面只到 TER-local，两条 tuple 的仓级验证另行安排。

本复核**只评审 TER 骨架批一 + 批二的实施是否完成**。
不授权批三、任何终端能力实现、Kotlin 能力、批二设备重跑、双屏、杀进程重启、
DEV、reset、seed、浏览器 L2、UAT、部署、EAS 或任何仓库控制动作。
