# TER 骨架批一 CP-5 · 实现与阻断状态 · Claude 独立复核

| 字段 | 值 |
|---|---|
| `REVIEW_TARGET` | `IMPLEMENTATION` |
| `SCOPE` | `TER_BATCH1_CP5_BLOCKED_RECHECK` |
| 结论 | **GO** —— 入口闭包已真修复；CP-5 保持未完成是**正确归因**，非结构缺陷 |
| 计数 | **M=0 · S=1 · N=1** |
| 会话 | fresh、v2s-rooted、只读（除本交付文件） |

---

## 1 · 入口闭包：已真修复

**我先怀疑它没修好，读了实现之后撤回。**

初判：`src/index.ts` 第 2 行 `export {...} from './dependencies'`，而 `skeletonBootstrap.ts`
又 `import ... from './index'` —— 看起来入口链可经 `./index → ./dependencies` 够到全部 13 个 root，
绕过 bootstrap 自己那 13 条，构成与上次同类的 false-green。

**该判断错误，已撤回。** `tools/terminal-skeleton/check-static.mjs` 第 112–158 行
的 `runAssemblyEntryReachability` **不做传递遍历**：

- 只断言 `index.ts` 运行时 import `./App`、`App.tsx` 运行时 import `./src/skeletonBootstrap`；
- 随后**只读 `skeletonBootstrap.ts` 自身**的 import 声明；
- 断言其相对 import **恰好等于 `['./index']`**（第 131 行）；
- workspace import 必须是 **root**（拒绝深层路径，第 141 行）、必须是**运行时** import
  （拒绝 type-only，第 144 行）；整文件**拒绝动态 `import(` / `require(`**（第 125 行）；
  并拒绝任何意外外部 import（第 152 行）；
- `reachable = [assemblyModuleName, ...importedModules]`（第 157 行）——
  **仅由 bootstrap 的 13 条构成**，`dependencies.ts` 的 import 进不了这个集合。

⇒ 删掉 bootstrap 任一条 import，`assertEqualSet` 必红。
⇒ 删掉 App→bootstrap 的 import，第 122 行 `assertRuntimeImport` 必红。
⇒ 六类 false-green 手法（type-only、动态 import/require、深层路径、非 workspace root、
自引用、旁路文件）**逐条被显式拒绝**。

`CP5_ENTRY_IMPORT_SHAPE=PASS` 是**合理的静态结论**。

### exact-set 我逐条比对（不采信报告）

| 来源 | 内容 |
|---|---|
| `skeletonBootstrap.ts` | 13 条 `@catering-v2s/*` root + 1 条本地 `./index` |
| `src/dependencies.ts` | 同样 13 条（无 `./index` —— 自身不是依赖，正确） |
| `package.json` `dependencies` | 同样 13 条 `workspace:*` + expo/expo-status-bar/react/react-native |

**三者完全一致**；14 个包减去 assembly 自身正好是这 13 个。
`src/index.ts` 不回引 `skeletonBootstrap`，**不成环**。
`App.tsx` 以 `skeletonModuleNames.join('\n')` 实际渲染，不是未使用值。

---

## 2 · 全集扫描（不只 `pos-desktop`）

对**全部 14 个包**逐包机械检查，结果：

| 检查项 | 覆盖 | 违规 |
|---|---|---|
| `src/moduleName.ts` 存在且**零 import** | 14 | **0** |
| `src/dependencies.ts` 的 `@catering-v2s/*` import 集合 = `package.json` 的（deps ∪ devDeps） | 14 | **0** |
| 脚手架残留（`.git` / `AGENTS.md` / `CLAUDE.md` / `.claude` / `LICENSE`） | 14 | **0** |
| `private: true` · `exports` 只有 `"."` → `./src/index.ts` | 14 | **0** |

`yarn workspaces list --json` 实测：总计 19，`apps/terminal` 前缀 15，
其中聚合包 1、**叶子包 14** —— 与批一分母一致，无 `example/` 混入。

---

## 3 · 静态通过与 CP-5 完成的边界：归因正确

我**亲自跑了**只读检查：

```
TERMINAL_SKELETON_MODEL_TEST=PASS          exit 0
RULE_GATES=6  SUPPORT_CHECKS=1
RULE_GRAPH_COMPARISON=PASS
RULE_TRIPLE_NAMING=PASS
RULE_DEPENDENCY_DIRECTION=PASS
RULE_DEPENDENCY_DECLARATION_COMPLETENESS=PASS
RULE_TR01_REDUCER_BOUNDARY=PASS
RULE_KERNEL_PLATFORM_INDEPENDENCE=PASS
SCAFFOLD_HYGIENE=PASS                       exit 0
```

与需求 §10、详设 CP-6 的 `RULE_GATES=6` / `SUPPORT_CHECKS=1` 口径一致。

CP-5 证据文件**没有**把 static pass 表述成 install / typecheck / Metro 已过 ——
第 30 行明写 "The installation and Metro checks are not reported as passed"，
`CP5_NATIVE_BUILD=UNVERIFIED`，并单列 "Remaining UNVERIFIED boundaries"。

⇒ **CP-5 保持 NO-GO 仅由 install / typecheck / export 未闭合导致，不存在结构性入口缺陷。**

---

## 4 · age gate 与 lockfile

> 🔴 **`SUPERSEDED_BY_DEXTER_2026_08_29`**
>
> Dexter 已裁定：**不再因 npm 发布时间隔离而等待，什么最新装什么。**
> 本节关于「等待隔离期解除」「解除顺序」的结论**不再适用**，
> `npmMinimalAgeGate` 不再是 CP-5 的阻断项。
> 以下内容保留为复核当时的事实记录。

### 4.1 复核当时的事实（我核过，不采信旧 evidence）

- `yarn config get npmMinimalAgeGate` → **1440**
- 当前 UTC **2026-08-29T07:16:40Z**；`expo@57.0.18` 发布于 **2026-08-28T10:48:19Z**
  ⇒ 已过 **1228 分钟 / 阈值 1440**，**仍在隔离期**，预计 **2026-08-29T10:48:19Z** 解除
- `yarn.lock` 中 `expo@npm:~57.0.18` 命中 **0**、`expo-status-bar@npm:~57.0.1` 命中 **0**
  ⇒ 「age gate 解除后不能直接假定 immutable install 会通过」这个判断**成立**

**计划的解除顺序成立且不含绕过**：先重新解析当时 latest 模板与 Expo CLI 版本证据 →
执行正常 Yarn install 生成/更新 lockfile → 最后原样执行 immutable install。
未发现降低 gate、设置 bypass、手改 lockfile 或替换 package manager 的迹象。

⚠️ 正常 install 本身在 10:48Z 前同样会被 gate 挡住 —— 顺序正确，**只能等**。

---

## 5 · 设备验收边界：三处一致

计划第 471–493 行的 CP-7 步骤同时要求：Gradle 构建成功 · autolinking 生成结果含
`com.catering.v2s.terminal.adapter.android.persistkv.TerminalPersistKvModule` ·
应用启动 · 屏上 14 个 moduleName；保留 autolinking 生成结果来源路径与原始片段、
adb 设备身份、启动日志、截图、生成前后树并清理本次生成物；**不进入 `verify`**。

边界纪律正确：第 479 行明写"成功只能升级 Gradle/autolinking/启动/bootstrap 渲染边界"；
第 401 行明写 `expo export` "只报告 Metro 可打包入口可达集合，不报告 Gradle/autolinking/启动"；
详设第 36 行把骨架成功限定为"结构、类型解析和入口可达 Metro 打包"。
CP-5 明确不执行 prebuild 或 `run:android`（计划第 355 行）。

---

## 6 · S-1 · `type: module` 与 `exports` 是规范化新增、无论证、且会混淆 CP-7 的失败归因

**仓内事实**：全部 14 个包的 `package.json` 都有 `"type": "module"`，
assembly 另有 `"main": "index.ts"` 与 `"exports": {".": "./src/index.ts"}`。

**外部事实**：我实拉解包核过 `expo-template-blank-typescript@latest` 的原始 manifest ——
**它只有 `main: "index.ts"`，既无 `type` 也无 `exports`**。这两项是规范化时**新增**的。

**论证缺失**：详设第 267 行与计划第 269 行只把它们列为"统一形态"的保留/新增项，
**没有给出为什么 Expo app 需要 `type: module`**。库包只有 `.ts` 文件，
`type` 字段对它们近乎惰性；而 RN/Metro 工具链是 CJS 取向的。

**影响面**：这是**未验证组合**，而能验证它的两步（`expo export`、`expo run:android`）
恰恰都还没跑。一旦 CP-5 的 export 或 CP-7 的 `run:android` 失败，
**失败原因会与"autolinking 在本仓三级嵌套布局下能否被发现"混淆** ——
而后者正是新增设备验收要回答的那个问题。

**最小修复（不要求现在改动）**：在计划里**预先写死一条诊断顺序** ——
若 `expo export` 或 `expo run:android` 失败，**第一步先在 scratch 副本上移除 assembly 的
`type: module` 与 `exports` 复跑**，以区分「规范化引入的」与「布局固有的」，
再进入 autolinking 排查。这样一次失败就能分离两个变量，不必来回试。

**为何不建议现在就删**：目前没有任何证据表明它已经坏了；
无证据的预防性改动同样是把两个变量搅在一起。

---

## 7 · N-1 · 检查器只断言 App 对 bootstrap 的 import，不断言其被**使用**

`check-static.mjs` 第 122 行只做 `assertRuntimeImport`。
若将来有人把 `skeletonModuleNames` 从 render 里移走而保留 import，静态检查仍绿。

**当前无害**：`App.tsx` 确实以 `.join('\n')` 渲染，且 CP-7 的"屏上出现 14 个 moduleName"
从运行侧覆盖了这一点。端到端是闭合的，故记为 note。

---

## 8 · 我实跑的命令与退出码

- `node tools/terminal-skeleton/check-static.test.mjs` → `TERMINAL_SKELETON_MODEL_TEST=PASS`，exit 0
- `node tools/terminal-skeleton/check-static.mjs` → 六道门 + hygiene 全 PASS，exit 0
- `yarn workspaces list --json` → 19 / TER 15 / 叶子 14，exit 0
- `yarn config get npmMinimalAgeGate` → `1440`，exit 0
- 14 包全集机械扫描（moduleName 零 import、依赖 exact-set、脚手架残留）→ 违规 0
- `yarn.lock` 两个 selector 命中数 → 均为 0

**仓内本轮只写本评审文件。**

---

## 9 · 未核到

`create-expo-module` 完整闭包（CP-0 范围，本轮未重跑）；workspace install（age gate 未解除）；
assembly 的真实 `tsc` 与 `expo export`；Android Gradle / Kotlin / autolinking / 模拟器运行；
两条 verify 的实际时长；批二的 22 包。

---

## 10 · 结论与授权边界

**GO** · M=0 · S=1 · N=1。

入口闭包的 false-green 已真修复，六类绕过手法逐条被拒；三处 exact-set 一致；
全集 14/14 干净；CP-5 保持未完成是正确归因，非结构缺陷；
age gate 与 lockfile 的解除顺序成立且不含绕过。

S-1 是**归因保护**，不阻断实施 —— 请在跑 export / `run:android` 之前把诊断顺序写进计划。

本 GO **只表示** CP-5 的当前实现与阻断归因成立、可按计划等待 age gate 后继续。
**不授权**批二、任何包能力实现、降低或绕过 age gate、手改 lockfile、更换 package manager、
仓级 normal `scripts/verify`、DEV、reset、seed、浏览器 L2、UAT、部署或 EAS。
CP-7 的设备验收成功后，主张边界只能升级到 Gradle / autolinking / 启动 / bootstrap 渲染，
**不得升级为 Kotlin 能力或 adapter 业务能力**。
