SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# TER 骨架批一/批二 · implementation-facing 详设与实施收口

## 0 · 元数据、输入与授权边界

```text
PROGRAM_ID=V2S_W0_W4_EXECUTION
BUSINESS_SOURCE=doc/plans/platform/2026-08-29-v2s-terminal-skeleton-requirements-claude.md
RULE_SOURCE=doc/platform/terminal-coding-standard.md
ARCHITECTURE_SOURCE=project-memory/decisions/terminal-architecture-and-stack-rulings.md
BUILD_ORDER_SOURCE=project-memory/decisions/terminal-build-order-and-batches.md
JOURNEY_REFS=N/A（本批没有用户 Journey）
IA_REF=N/A（Dexter 已裁定纯工程骨架不需要 IA）
INTERACTION_REF=N/A（无用户可见交互设计）
AUTHORIZED=本详设与实施计划；批一 14 个包与批二 8 个包的骨架实施；CP-7 一次性 Android 模拟器验收
NOT_AUTHORIZED=任何包的能力实现；持续或自动化设备运行；真机；DEV；reset；seed；浏览器 L2；UAT；部署；仓库控制动作
IMPLEMENTATION_AUTHORITY=true
BATCH1_IMPLEMENTATION_AUTHORIZED_BY=DEXTER_2026_08_29
BATCH2_IMPLEMENTATION_AUTHORIZED_BY=DEXTER_2026_08_29
IMPLEMENTATION_ENTRY_REQUIRES=CLAUDE_TARGETED_RECHECK_GO
DEVICE_ACCEPTANCE_AUTHORIZED=CP7_ONE_TIME_ANDROID_EMULATOR_ONLY
FINAL_DEVICE_RECHECK_DIRECTED=DEXTER_2026_08_29
CURRENT_DELIVERY=批一与批二骨架已实施；本文件同时保留批一设计步骤与最终 22 包收口证据
```

Roadmap 是 program 授权记录；TER 本批的直接授权来自 Dexter 本会话。该授权不改变
Roadmap 中其他 R 的状态；批二已由 Dexter 同一授权直接开放，动态范围仍仅限 CP-7 一次性模拟器验收。

### 0.1 证据语言

- `VERIFIED`：本会话已从当前仓库字节或新鲜命令确认。
- `INFERENCE`：从已确认事实推出，但尚未在目标 14/22 包真实树上执行。
- `UNVERIFIED`：当前没有成功退出码或目标树还不存在。
- `UNVERIFIED_REQUIRES_EVIDENCE`：上游明确的实施阻断；临时实验不能替代指定落点的可复跑证据。
- `DEXTER_DECISION`：若执行到该分支，需要 Dexter 对供应链或范围作选择。

批一 CP-7 的模拟器证据先证明了当时 14 包投影下的 Gradle 构建、adapter autolinking、应用启动和
bootstrap 渲染。批二 CP-8 初始记录随后证明最终 22 包的静态关系、逐包 typecheck 与 Metro export；
在 Dexter 直接要求补齐最终证明后，最终 22 包树的模拟器复核又证明了 5/5 adapter autolinking、
Gradle/APK/Activity/JS main 启动与 22 个 bootstrap 名称渲染。两批都不得表述为 adapter Kotlin
能力可用、真机可运行或任何终端业务能力已实现。

## 1 · 真实目标与方案比较

### 1.1 这一批要解决的结构性问题

POC 已证明四层与大量包能承载终端能力，但其声明依赖并不等于真实 import。当前机器上，CLI 默认下载
路径没有取得成功闭包；显式传入官方 template source 并从 scratch 目录使用相对目标路径的 CP-0 probe
已取得 `latest` 原始脚手架成功闭包，但规范化后的 TER adapter 仍尚未形成实施证据。如果直接批量创建 22 个包，三重命名、workspace glob、包根解析、
Metro 可达性或原生模板任一判断错误，都会把同一个结构错误复制到整批；如果只写旁路常量和存在性门，
又可能全部判据通过而真实 package root 从未被消费者加载。

本批的真实目标因此是：先用 14 个包覆盖四层、两类手工包、两条官方脚手架路径、正式依赖与 devDep、
TypeScript 与 Metro 两个消费者边界，再把同一形态扩展到最终 22 包，并用分钟级证据证明这些关系真实成立。

### 1.2 方案比较

| 方案 | 结果 | 结论 |
|---|---|---|
| A · 一次创建最终 22 包，再统一修门 | 结构未知被复制，首个 adapter 或 workspace 形态错误会放大返工面。 | 拒绝。 |
| B · 每包自带 plannedKind/依赖清单/echo 测试 | 多处手写真相会漂移；旁路 import 不触达 package root 与 Metro；空包测试只能证明常量。 | 拒绝。 |
| C · 批一纵切片 + 单一规格 + 声明/源码事实派生 + 真实入口消费 | 14 包覆盖所有结构未知；规格只有一处，package.json 与 import 是可独立反证的运行事实；tsc 与 Metro 验证真实消费面。 | **采用。** |

我选了 C 而不是 A/B，因为它以最小包数暴露全部结构风险，同时没有引入每包清单、旁路 exports、
占位能力或第二套依赖图。

### 1.3 两个正本优先解释

1. `plannedKind` 只在 `apps/terminal/skeleton-graph.ts`。虽然需求 §8.3 的通用树展示了
   `application/moduleManifest.ts`，但规范正本 `TR-09` 的骨架例外明确说骨架期还没有该文件。
   因此批一所有包都只含元数据骨架；排除被仓内工具生成且由 `.gitignore` 覆盖的构建/缓存目录（例如 `.turbo/`）后，源骨架不创建 manifest、slice、actor、command 或占位 feature。
2. assembly 自身不能通过 npm 包名 import 自身，但需求要求 bootstrap import 当前批的每个 package root。
   因此 `skeletonBootstrap.ts` 用本地 `./index` import assembly 的 `src/index.ts`，并用 npm root import
   其余 13 包。这个本地 root import 只计入口可达集合，不计依赖边，避免制造 package self-dependency。

## 2 · CP 总览

| CP | 主题 | owner | 主要输出 | 依赖 |
|---|---|---|---|---|
| CP-0 | 官方脚手架与供应链 preflight | terminal tooling | create-expo-module 可复跑闭包、原始树、退出码、规范化规则 | 无 |
| CP-1 | workspace、TypeScript、Turbo 与 TER 聚合入口 | terminal tooling | 根工作区扩展、`turbo.json`、基础 tsconfig、聚合 scripts | CP-0 的命令形态已冻结；adapter 尚不落仓 |
| CP-2 | kernel 纵切片 | terminal kernel | 7 个纯 TS 包及真实依赖边 | CP-1 |
| CP-3 | UI 纵切片 | terminal ui | 5 个 RN/TS 库包及 devDep 边 | CP-2 |
| CP-4 | Android adapter 代表 | terminal adapter | `adapter.android.persist-kv` 官方骨架的规范化结果 | CP-0、CP-2 |
| CP-5 | assembly 与入口可达闭包 | terminal assembly | Expo app、package root、bootstrap、14 包可达集合；不跑设备 | CP-3、CP-4 |
| CP-6 | 六道静态门、脚手架卫生检查与两档 TER verifier | terminal tooling | 正负控制、`verify:static`、`verify`；尚不接仓级 verifier | CP-5 |
| CP-7 | 批一整体对账、TER 本地验收、一次性设备验收与最终仓级接线 | 主 agent + fresh 独立 reviewer | 14 包 exact-set、typecheck、Metro、模拟器 Gradle/autolinking/启动/14 名称、分钟级、未证明边界；全部绿后才写两个仓级 tuple | CP-0..6 |
| CP-8 | 批二八包落地与最终 22 包收口 | 主 agent + fresh 独立 reviewer | 8 个新增包、最终 22 包 exact-set、22/22 typecheck、Metro、TER-only verify、脚手架重跑与清理；不重复设备验收 | 批一验收与授权 |

## 3 · 横切机制对照表

| 机制 | ① 现成能力/规范 | ② 如何验证 | ③ 无现成时的形态 | ④ 本批适用全集 |
|---|---|---|---|---|
| 读侧节点授权 | N/A：无 HTTP、session 或业务数据读取。 | 静态确认没有相关契约/源码。 | N/A。 | 14 个骨架包。 |
| 写授权与 grant 复核 | N/A：无业务 command。 | 静态确认无 command/owner API。 | N/A。 | 14 个骨架包。 |
| 跨 owner 写与事务 | N/A：没有后端 owner 或数据库。 | 静态确认无跨 owner 写。 | N/A。 | 14 个骨架包。 |
| 集合形态与分页 | N/A：没有业务集合接口；图数组是构建规格，不是业务集合。 | 图门 exact-set。 | 规格用只读 literal，不引入分页抽象。 | 22 个规格节点、批一投影 14 个、当前投影 22 个。 |
| 缓存失效 / 改完刷新什么 | N/A：没有缓存或数据获取。 | 静态确认无 query/cache。 | N/A。 | 14 个骨架包。 |
| RTK 数据读取与加载判定 | N/A：TER 已裁定不使用 RTK Query，且本批无 UI 数据读取。 | 静态确认无 RTK Query。 | N/A。 | 全批。 |
| 同一事实只有一个住址 | `doc/platform/terminal-coding-standard.md` §0、`TR-09`；需求 §9.1。 | 图门分别从 spec、package.json、全部 TS import 派生后比对；包内零 `plannedKind`。 | 规格只声明期望；声明与源码事实不回写规格。 | 22 个 spec 节点；批一 14 个包。 |
| 失败可见且原因不得改写 | `TR-02` 的同类判据；`tools/verify-gates/verify.mjs` 的 first-failure 形态。 | 故意使子步骤失败，入口 exit 非 0 且不打印对应 PASS marker。 | 失败输出 `TERMINAL_* =FAIL` 与首败 label，不把解析/打包失败改写成“未知”。 | scaffold probe、static、typecheck、filter、export 五段。 |
| owner 错误到 HTTP 的映射与注册处 | N/A：无 HTTP。 | 静态确认无 route/problem advice。 | N/A。 | 全批。 |
| 幂等键构成与重放语义 | N/A：无写请求。 | 静态确认无请求。 | N/A。 | 全批。 |
| 该用生成物的地方不得手搓字符串 | 官方 `create-expo-module@latest`、`expo-module-template@latest`、`create-expo-app@latest`；Expo module skill。 | 每次先解析并记录当时的精确 CLI/template 版本、命令、原始树和退出码；原生配置必须来自原始树。 | `latest` 是选择策略，精确版本是该次运行证据；原生 Gradle/config 不手写。 | adapter 1、assembly 1。 |
| 日志落点与脱敏字段 | `AGENTS.md` 日志硬约束；本批没有敏感业务数据。 | 每个入口打印阶段与首败 label；scratch 路径、CLI 版本、exit code、cleanup 分开记录。 | 不输出 token、账号或原始 payload。 | CP-0、CP-6、CP-7 命令。 |
| 迁移回填与可逆性 | N/A：无数据库、Flyway 或持久化事实。 | 静态确认无 migration。 | N/A。 | 全批。 |
| 前端共享行为 | N/A：不建管理后台，也不实现 TER 交互组件。 | 静态确认不改 `apps/frontend/*`、`admin-ui-foundation`。 | N/A。 | 全批。 |
| 候选/下拉数据源 | N/A：无业务 UI。 | 静态确认无数据源。 | N/A。 | 全批。 |
| 编码与名称呈现 | TER 三重命名正本 §2；`moduleName` 为命名源。 | 路径、moduleName、npm name 三向推导；bootstrap 只呈现 moduleName 诊断列表。 | 不新增显示名称或业务文案。 | 22 个规格节点、批一 14 包。 |
| 会同时坏的东西是否已声明为原子组 | 需求 §9/§10；`project-memory/practices/gate-four-pieces.md`。 | 同一轮同时比较 spec、workspace census、manifest、源码 import、入口可达、tsc 与 export。 | “图规格 + 三个事实消费者 + 两档入口”作为一个原子组。 | CP-1、CP-5、CP-6、CP-7。 |

## 4 · 每个 CP 的门控与实现形态

### CP-0 · 解除 `create-expo-module` 阻断

**候选命令族**（`latest` 是 Dexter 裁定的输入策略；精确解析版本只记录为该次 probe 的证据，
不回写成文档固定输入。CP-0 已用该命令族取得原始脚手架闭包；这只解除 module 原始生成阻断，
不得据此跳过 CP-4 adapter 入仓规范化）：

```sh
yarn config get npmMinimalAgeGate
TER_SCRATCH="$(mktemp -d)"
TER_MODULE_TEMPLATE_VERSION="$(npm view expo-module-template@latest version)"
npm view create-expo-module@latest version
npx create-expo-module@latest --version
npm pack expo-module-template@latest --pack-destination "$TER_SCRATCH"
tar -xzf "$TER_SCRATCH/expo-module-template-$TER_MODULE_TEMPLATE_VERSION.tgz" -C "$TER_SCRATCH"
(
  cd "$TER_SCRATCH"
  EXPO_NONINTERACTIVE=1 EXPO_NO_TELEMETRY=1 YARN_NODE_LINKER=node-modules \
    npx create-expo-module@latest adapter-android-persist-kv \
    --source "$TER_SCRATCH/package" \
    --no-example --platform android --package-manager yarn \
    --name TerminalPersistKv \
    --package com.catering.v2s.terminal.adapter.android.persistkv \
    --description "Catering V2S terminal Android persist KV adapter" \
    --license MIT --module-version 0.0.0 --author-name "Catering V2S" \
    --author-email "terminal@example.invalid" --author-url "" --repo ""
)
```

`--source` 不是本仓自制模板：它显式传入本次从 `expo-module-template@latest` 解析并打包的官方 source。
文档不钉旧版；精确版本只作为该次运行的可追溯证据。本机不传 source 时曾复现“找不到 versioned
template -> 隐式 fallback -> `TS2688` jest type definition 缺失”；该隐式路径不得作为实施入口。
调用必须从 scratch 目录执行并把目标写成相对路径：CLI 使用 `INIT_CWD` 作为基准再执行
`path.join(INIT_CWD, target)`。从仓根传绝对目标会把目标重写到仓内并让 Yarn 把它识别为仓根工作区外目录，
本机已取得该首败；因此上面的 subshell 形态是可复跑命令，不是排版偏好。

- **可证伪失败条件**：CLI 非 0；目标路径与参数不一致；产生未授权的 iOS/web native 结构；没有
  `package.json`、`expo-module.config.json` 或 Android Gradle/Kotlin 主 source set；无法记录 cleanup。
  模板自带的 `example` 不是 CP-0 失败条件，必须记录并在 CP-4 规范化时删除。
- **不变量**：非 local、Android only、无账号、无仓内落盘、原始输出先保存再规范化。
- **FORBID**：从 POC/其他工程复制 native 目录；把失败后的半成品当成功；把临时供应链设置写入仓库；
  用旧快照、手工 lockfile 或替代 package manager 伪造 latest 证据。
- **替代路径**：
  1. 若 registry 无法取得已解析 template，重试前先诊断 registry/network/cache 边界；不得改用隐式 fallback。
  2. 同一次解析得到的官方 CLI + 官方模板仍取不到 exit 0 时，批一保持 `BLOCKED_CREATE_EXPO_MODULE`；
     不建 adapter，CP-4 及以后停止。
  3. Dexter 已裁定“什么最新装什么”，本次允许以进程级 `YARN_NPM_MINIMAL_AGE_GATE=0` 解除
     npm 发布时间隔离；该设置只用于本次受控 install，不写入 `.yarnrc.yml`，并须在 evidence 记录命令、
     环境变量、解析版本与退出码。不得借此改变 latest 选择策略或改用另一 package manager。
- **比例验证**：只做一份代表 adapter 的 scratch scaffold；不创建五份，也不编译 Gradle/Kotlin。

成功证据落点设计为
`doc/evidence/platform/terminal-skeleton/batch-1/create-expo-module-closure-codex.md`；原始长日志放
`.runtime/terminal-skeleton/scaffold-probe/`，报告只记录命令、版本、树、首败/成功、exit code 与 cleanup。

同一 CP 还要建立以精确 template 版本为键的 UI/assembly 版本证据单元：用 CP-5 的
`create-expo-app@latest --template blank-typescript --no-install` 在 scratch 生成 app，保存模板 raw
`package.json`，并把模板已提供的 `expo`、`expo-status-bar`、`react`、`react-native`、`typescript`、
`@types/react` 记为集合 A 的权威值。模板未自带的 `react-dom`、`react-native-web`、
`react-native-reanimated`、`react-native-worklets`、NativeWind、Tailwind CSS 与 React Native Reusables
归集合 B，只有在同一个 scratch app 中由本地 Expo CLI 执行无手写版本的 `npx expo install` 后，才把解析值
写入证据单元。集合 A 已解析而集合 B 失败时写 `TEMPLATE_MANIFEST_SOURCE=RESOLVED`、
`UI_EXPO_SDK_MAPPING=BLOCKED`、`UI_VERSION_SOURCE=PARTIAL`；不消费集合 B 的 CP-3 空骨架可以继续，任何
声明或源码消费集合 B 的包仍然停止。template 版本发生滚动时必须 A/B 一起重取，不能把旧 A 与新 B 拼成一份
证据。需求 §3 的表只是快照，不得冒充本次解析结果。

app probe 同时记录 `npm view create-expo-app@latest version` 与
`npm view expo-template-blank-typescript@latest version`；它们是当次外部事实，不成为下次运行的固定输入。

当前 fresh latest 为 SDK 57 / RN 0.86.3；需求 §3、§13 与 active architecture memory 已统一为
「实施时取 latest，快照仅供比对」，因此当前不存在 source policy conflict。若后续 latest 漂移，重新
运行 CP-0 并把实际解析值写入本次 evidence；不得把旧快照重新钉成输入。

### CP-1 · 根工作区、Turbo 与聚合入口

**修改全集**：`package.json`、`yarn.lock`（只由 Yarn 生成）、`.gitignore`、`eslint.config.mjs`、
新建 `turbo.json`、覆盖 `apps/terminal/package.json`，新增 `apps/terminal/tsconfig.base.json`、
`apps/terminal/tsconfig.json`、`apps/terminal/skeleton-graph.ts`，以及四个明确为空边界的 README。

根 `.gitignore` 在现有条目上逐项追加：`.expo/`、`.turbo/`、`**/android/build/`、
`**/android/app/build/`、`**/android/.gradle/`、`*.apk`、`*.aab`、`*.keystore`、`**/.kotlin/`。
`**/` 是为了覆盖 TER 深层 package 下的 Android/Kotlin 产物；这是一组未来文件系统检查输入，不在本轮改根文件。

根 workspaces 只增加精确层级 glob：

```json
[
  "apps/terminal",
  "apps/terminal/kernel/base/*",
  "apps/terminal/ui/base/*",
  "apps/terminal/ui/integration/*",
  "apps/terminal/adapter/android/*",
  "apps/terminal/assembly/android/*"
]
```

不使用 `apps/terminal/**`。文件系统 package census 与 Yarn workspace 列表都必须等于当前投影，
从而同时抓住“目录里有 package.json 但未入 workspace”和“example 被误吸入”两种错误。

`turbo.json` 的 `typecheck` 使用 `dependsOn: ["^typecheck"]` 且不缓存输出；`test`/`lint`/`clean`
只建立编排任务，不进入批一验收。TER 聚合包的四个同名脚本都固定使用
`turbo run <task> --filter='./apps/terminal/**' --filter='!@catering-v2s/terminal'`；`verify:static` 与
`verify` 不交给 Turbo。实现时对 typecheck 用同一 filters 加 `--dry=json`，断言 task owner 正好是当前投影的 leaf 包（批一 14、最终 22）、
聚合包与 `apps/frontend/*`/`libraries/frontend/*` 均为零。这里没有实施时再选择的分支。

四个聚合脚本的最终 dry-run 预期固定如下；dry-run 只验编排集合，不执行 test/lint/clean：

| task | 最终 task owner exact-set | 批一执行语义 |
|---|---|---|
| typecheck | 当前投影的全部 leaf 包（最终 22） | `verify` 实际执行，22 个全绿 |
| test | 5 个 Android adapter leaf（最终 22 投影） | 只 dry-run；脚手架 test 保留但本批不跑 |
| lint | 空集合 | 只证明聚合入口不会越界；不声称 leaf lint 已建立 |
| clean | 空集合 | 只证明聚合入口不会越界；本批无生成物 clean task |

四者都必须：dry-run exit 0、聚合包零任务、frontend/library 零任务、无递归。typecheck 的阶段分母随 CP
固定为 CP-1=0、CP-2=7、CP-3=12、CP-4=13、CP-5/6=14、CP-8=22；不得在中间 CP 提前声称最终 22 已证明。

- **失败条件**：深 glob；前端任务出现在 dry-run；聚合 typecheck 自递归；文件系统 census 与 Yarn 列表不等；
  `plannedKind` 出现在包内。
- **FORBID**：第二 workspace 根、第二 ESLint/Prettier 配置、手改 yarn.lock。

### CP-2/3 · 手工包的唯一最小形态

所有 kernel/ui 包共享：

```text
<pkg>/
  package.json
  tsconfig.json
  src/moduleName.ts
  src/dependencies.ts
  src/index.ts
```

不创建空目录占位、`test/`、`application/`、`features/`、manifest 或 slice。每个 package root 的 exports
只保留 `.` 并直指 `./src/index.ts`。内部依赖用 `workspace:*`；`dependencies.ts` 将正式与 dev 依赖
分成 `dependencyModuleNames`、`devDependencyModuleNames` 两个只读数组，但两类都从依赖包真实根入口取
`moduleName` 值。`src/index.ts` re-export 三个元数据符号。

kernel 为纯 TS，零 Expo/RN/React。UI 的 React/RN 由 assembly 提供单实例，因此列在 peerDependencies，
同时在 devDependencies 放 typecheck 所需版本。集合 A 的版本解析以本次 `create-expo-app@latest` 精确
template raw manifest 为唯一外部输入；集合 B 只有在同一 scratch 的成功 `expo install` 结果存在时才可写入
UI manifests。不从需求快照或记忆手填版本。scratch 先安装模板已经声明的 Expo，再运行 Expo CLI；不需要
人为写一个 SDK bootstrap 版本。

### CP-4 · adapter 规范化

adapter 的外部依赖版本源与 UI/assembly 分开：adapter 保留本次
`expo-module-template@latest` raw manifest 的官方 module 工具链版本；需求 §3 的 app template 集合 A/B
只约束 UI 与 assembly，不能把 app template 的 React Native 版本强套到 adapter。

只在 CP-0 exit 0 后把 scratch 原始树规范化到 `apps/terminal/adapter/android/persist-kv`。

| 类别 | 保留 | 删除/改写 |
|---|---|---|
| native 结构 | `android/`、`expo-module.config.json`、Gradle 配置、最小 Kotlin Module 注册类；CP-7 一次性 `expo run:android` 证明该注册形态在本仓布局下被 Gradle/autolinking 消费，并保存生成 registry/package list 或等价 Gradle 输出核对 `com.catering.v2s.terminal.adapter.android.persistkv.TerminalPersistKvModule` | apple/web/example；模板 sample Function/Event/View 与行为测试；所有生成 build 产物 |
| JS 公开面 | `src/moduleName.ts`、`src/dependencies.ts`、`src/index.ts` | 模板 sample API；build 目录入口 |
| package metadata | `private:true`、`type:module`、主入口 exports、`typecheck`、脚手架 test script 及其实际调用的 `internal/module_scripts/test.js`/`util.js`、必要 Jest 配置、Expo peer/dev 依赖、`platform-ports` 的 `workspace:*` 依赖 | version/description/repository/publish/files；`build`、`prepare`、`open:*`；lockfile、node_modules |
| repo 继承 | 仓根 ESLint/Prettier/ignore | 嵌套 `.git`、agent 指令、`.claude`、局部 lint/prettier 配置、package-local `LICENSE` |

保留的 Kotlin 只提供最小 Android Module 注册；CP-4 不单独运行 Gradle，CP-7 的一次性 `expo run:android`
才证明本仓布局下 Gradle 构建、autolinking（含生成注册结果）、应用启动和 bootstrap 渲染。该命令不证明任何 Kotlin 能力或
持久化行为可用，因本批没有能力实现。若删 sample 后最小 Module 注册类的必要语法不明确，回到 CP-0
原始模板核对，不自行发明。

### CP-5 · assembly、bootstrap 与入口可达集合

assembly 由实施当时的 `create-expo-app@latest` 与它解析到的 `blank-typescript` 最新模板产生，使用
`--no-agents-md --no-install`。CLI/template 的精确解析版本与原始 manifest 都进入证据；不在文档钉旧版，
也不增加“把旧模板依赖规范化到目标版本”的步骤。命令为：

```sh
EXPO_NONINTERACTIVE=1 EXPO_NO_TELEMETRY=1 \
  npx create-expo-app@latest <scratch>/pos-desktop \
  --template blank-typescript \
  --no-agents-md --no-install
```

保留 app.json、assets、Expo/RN runtime dependencies 与 `start/android/ios/web`；删除嵌套仓库元数据、
package-local `LICENSE`、安装产物与局部规范；新增主入口 exports、typecheck、export/verify 所需脚本以及
`src` 元数据文件。

入口形态：

```text
index.ts
  -> App.tsx
       -> ./src/skeletonBootstrap.ts
            -> ./index                      # assembly 自身 src/index.ts package root
            -> 其余 13 个 @catering-v2s/* package root
```

assembly 的 `package.json.dependencies` 与 `src/dependencies.ts` 都声明/import 当前批其余 13 个 package
root；这 13 条与 bootstrap 的 13 条 npm root import 是同一个 direct-dependency exact-set，不是门豁免。
`skeletonBootstrap.ts` 只收集并导出 moduleName，不创建 runtime、port、slice 或 native 调用。
`App.tsx` 把 14 个 moduleName 渲染为简单诊断文本，保证 bundler 不能把整条链当未使用值消除。

图门用 TypeScript AST 从 App 与 bootstrap 的静态 import 派生集合：bootstrap 的本地 assembly 根 +
21 个 npm 根 = 22（批一投影时为 13 个 npm 根 = 14）；
动态 import、require 拼接、路径 alias 与自包 npm import 一律拒绝。Metro 证明只限此集合可被打包。

CP-5 本身不运行 `expo run:android`，以保持 assembly 建设与 Metro 快速闭包可重复；设备步骤只在 CP-7
本地闭合后执行一次，单独计时和留证，不进入 `verify`，也不建立设备自动化基建。

### CP-6 · 图门、六道门与 verifier

`skeleton-graph.ts` 的具体最小形状：

```ts
export const activeSkeletonBatch = 2 as const

export const skeletonGraph = {
  'kernel.base.contracts': {
    batch: 1,
    plannedKind: 'toolkit',
    dependencies: [],
    devDependencies: [],
  },
  'kernel.base.platform-ports': {
    batch: 1,
    plannedKind: 'toolkit',
    dependencies: ['kernel.base.contracts'],
    devDependencies: [],
  },
  // 其余 20 个节点逐项列全
} as const
```

规格不存 `path` 或 npm name；检查器只从 moduleName 派生二者，避免三重命名在规格内又复制一遍。
完整 22 节点和最终边从需求 §6.1 原样转录。当前投影规则是：保留 `batch <= activeSkeletonBatch`
的节点，并从其正式/dev 边中滤去尚未到批的目标；批一 package.json 只声明投影后的边。

完整 literal 的逐项值如下，实施时不得用省略号：

| moduleName | batch | plannedKind | dependencies | devDependencies |
|---|---:|---|---|---|
| `kernel.base.contracts` | 1 | toolkit | — | — |
| `kernel.base.platform-ports` | 1 | toolkit | `kernel.base.contracts` | — |
| `kernel.base.state` | 1 | toolkit | `kernel.base.contracts`, `kernel.base.platform-ports` | — |
| `kernel.base.runtime` | 1 | owner | `kernel.base.contracts`, `kernel.base.platform-ports`, `kernel.base.state` | — |
| `kernel.base.transport` | 2 | owner | `kernel.base.contracts`, `kernel.base.platform-ports`, `kernel.base.state`, `kernel.base.runtime` | — |
| `kernel.base.display-context` | 1 | owner | `kernel.base.contracts`, `kernel.base.state`, `kernel.base.runtime` | — |
| `kernel.base.workflow` | 2 | owner | `kernel.base.contracts`, `kernel.base.platform-ports`, `kernel.base.state`, `kernel.base.runtime` | — |
| `kernel.base.ui-state` | 1 | owner | `kernel.base.contracts`, `kernel.base.platform-ports`, `kernel.base.state`, `kernel.base.runtime`, `kernel.base.display-context` | — |
| `kernel.base.test-support` | 1 | toolkit | — | `kernel.base.contracts`, `kernel.base.platform-ports`, `kernel.base.state`, `kernel.base.runtime` |
| `ui.base.render` | 1 | toolkit | `kernel.base.platform-ports`, `kernel.base.runtime`, `kernel.base.ui-state` | — |
| `ui.base.automation` | 1 | owner | `kernel.base.platform-ports`, `kernel.base.runtime`, `kernel.base.ui-state` | — |
| `ui.base.primitives` | 1 | toolkit | `ui.base.automation` | — |
| `ui.base.input` | 2 | owner | `kernel.base.platform-ports`, `kernel.base.runtime`, `kernel.base.state`, `ui.base.render`, `ui.base.primitives` | — |
| `ui.base.admin-shell` | 2 | owner | `kernel.base.platform-ports`, `kernel.base.runtime`, `kernel.base.state`, `ui.base.render`, `ui.base.primitives`, `kernel.base.ui-state` | — |
| `ui.base.test-support` | 1 | toolkit | — | `ui.base.render`, `ui.base.automation`, `kernel.base.test-support` |
| `ui.integration.platform-console` | 1 | toolkit | `kernel.base.contracts`, `kernel.base.platform-ports`, `kernel.base.state`, `kernel.base.runtime`, `kernel.base.display-context`, `kernel.base.ui-state`, `ui.base.render`, `ui.base.automation`, `ui.base.primitives`, `ui.base.input`, `ui.base.admin-shell` | `ui.base.test-support` |
| `adapter.android.persist-kv` | 1 | toolkit | `kernel.base.platform-ports` | — |
| `adapter.android.device` | 2 | toolkit | `kernel.base.platform-ports` | — |
| `adapter.android.app-control` | 2 | toolkit | `kernel.base.platform-ports` | — |
| `adapter.android.logger` | 2 | toolkit | `kernel.base.platform-ports` | — |
| `adapter.android.dual-screen` | 2 | toolkit | `kernel.base.platform-ports` | — |
| `assembly.android.pos-desktop` | 1 | toolkit | **其余 21 个 moduleName 全部**：`kernel.base.contracts`, `kernel.base.platform-ports`, `kernel.base.state`, `kernel.base.runtime`, `kernel.base.transport`, `kernel.base.display-context`, `kernel.base.workflow`, `kernel.base.ui-state`, `kernel.base.test-support`, `ui.base.render`, `ui.base.automation`, `ui.base.primitives`, `ui.base.input`, `ui.base.admin-shell`, `ui.base.test-support`, `ui.integration.platform-console`, `adapter.android.persist-kv`, `adapter.android.device`, `adapter.android.app-control`, `adapter.android.logger`, `adapter.android.dual-screen` | — |

assembly 这一行仍是普通 literal，不引入动态规则或第二张图。投影过滤 batch 2 节点后，批一得到其余
13 个节点；批二得到其余 21 个节点。两批 assembly 都把这些边写入正式 `dependencies`，不放入
`devDependencies`。

检查器落在 `tools/terminal-skeleton/`：

```text
graph-model.mjs             # TS AST/JSON/census 解析与纯校验函数
check-static.mjs            # 对真实树执行六道规则门 + 1 项 scaffold hygiene 文件检查
check-static.test.mjs       # 在 mktemp 副本做规则门/卫生检查红变异，并以真实树作绿控制
verify-static.mjs           # test + real check，最后打印 TERMINAL_STATIC=PASS
verify.mjs                  # static -> turbo dry/task-list -> typecheck -> expo export -> exact-path cleanup，最后打印 TERMINAL_VERIFY=PASS
verify.test.mjs             # 受控失败子进程验证首败与 marker 缺席
```

Turbo dry-run 的 raw `tasks` 可能为没有脚本的包返回
`command="<NONEXISTENT>"`。检查器仍核对这些条目的 task 名、TER 目录与聚合包排除，
但只把 `command !== "<NONEXISTENT>"` 的 owner 纳入计划表的 executable exact-set；
因此不会把 Turbo 的占位描述误报成真实 task，也不会让新增/缺失脚本静默通过。

图门的两条主断言：

1. `project(spec, activeBatch)` 的节点、正式边、dev 边，与文件系统 package census、Yarn workspace、
   package.json 内部声明、全部 `src/**/*.{ts,tsx}` 的静态 `import`（含 `import type`）逐项相等；拒绝 cycle、
   self-edge、孤儿、多余节点、deep import 和未声明 import。assembly 的正式声明与源码 import 都必须是
当前批其余节点 exact-set（最终 21；批一投影 13）；它作为唯一闭包根的传递闭包必须等于当前分母（最终 22；批一 14）。
2. 从真实 Expo entry 派生的 TER package-root 集合，必须等于同一当前投影；assembly 自身由
   `skeletonBootstrap.ts` 的本地 `./index` 计入，其余包由该文件的 npm root import 计入。

六道规则门仍按需求 §10，不扩充成 9 条 TER 全规范门。`TR-01` 在真实树是诚实空过；报告单独写
`TR01_EFFECTIVE_CALL_SITES=0`，不计为行为已生效。

`scaffold hygiene` 是第七项**文件检查**，不是第七道 TER 规则门。它在真实树机械检查两组事实：

1. 按当前投影从 skeleton graph 派生每个 adapter/assembly package leaf 的真实根目录，在这些根内没有嵌套
   `.git/`、`AGENTS.md`、`CLAUDE.md`、`.claude/`、局部 lint/prettier 配置、package-local `LICENSE`；
2. 根 `.gitignore` 含需求 §5.4 的完整覆盖：`.expo/`、`.turbo/`、嵌套 Android 的 `build/`、
   `app/build/`、`.gradle/`、`*.apk`、`*.aab`、`*.keystore` 与 `.kotlin/`。

测试副本分别加入嵌套元数据、移除一条必需 ignore 规则，必须只得到 `SCAFFOLD_HYGIENE=FAIL`；真实树打印
`SCAFFOLD_HYGIENE=PASS`。报告固定区分 `RULE_GATES=6` 与 `SUPPORT_CHECKS=1`，不改变六道门计数。

`verify:static` 只有六道规则门与 hygiene 的正负/真实树控制全部绿后才打印 `TERMINAL_STATIC=PASS`。
CP-6 只建成并运行 TER 自己的 `verify:static` 与 `verify`，**不修改**仓级
`tools/verify-gates/verify.mjs`。TER 两个入口自身用子进程失败探针证明：任一步非 0 时不打印自己的 PASS
marker。`verify` 启动前若 assembly 已有 `.expo/` 或 `dist/` 则 fail closed；本次 export 拥有的两条精确路径
无论 export 成功或失败都 cleanup，cleanup 失败时不得打印 `TERMINAL_VERIFY=PASS`。这样半成品 TER 不会提前
进入其他并行工作的仓级静态分母。

### CP-7 · 批一闭合、最终仓级接线与批二判断点（历史步骤）

CP-7 分三步且顺序不可交换：

1. **本地闭合**：14 包 exact-set；四层非空；六道规则门与一项 hygiene 检查的绿/红控制；Turbo 任务列表
   只有 TER；14 包逐包 typecheck；入口集合 exact-set；assembly Android export；两条 TER 入口分钟级；
   scaffold 原始闭包 exit 0；未证明边界准确记录。此步不运行设备命令。任何一项失败都保持批一未完成，且不得接仓级 verifier。
2. **一次性设备验收**：只有第 1 步全部绿后，在 Android 模拟器上于 assembly 执行
   `npx expo run:android`，单独记录命令、开始/结束时间、Gradle 构建结果、应用启动日志、`adb` 设备身份、
   屏幕截图与 14 个 moduleName 的可见文本，证据落在
   `doc/evidence/platform/terminal-skeleton/batch-1/cp7-android-device-codex.md`。该文件是 CP-7 设备附录，不与 CP-5 assembly 结构证据混用。除开始/结束时间、adb 设备身份、Gradle 结果、启动日志、截图与 14 个 moduleName 外，必须保存 autolinking 生成 registry/package list 或等价 Gradle 输出的路径、原始片段与上述完整 Module 类名断言。若命令自动生成 assembly 的
   `android/` 或其他 build 产物，先记录生成事实，验收后只清理本次命令拥有的生成物并复核 hygiene；不得删除
   CP-4 adapter 的 `android/` source。该步不进入 `verify`、不建立设备自动化基建，也不运行真机；
   失败时保留首败并保持批一未完成。它只证明本仓布局下的 Gradle/autolinking/启动/bootstrap 渲染，不证明
   adapter 的 Kotlin 能力或任何业务行为。
3. **最终接线**：只有第 1、2 步全部绿后，才在 `tools/verify-gates/verify.mjs` 写入：

```js
// staticCommands
['terminal-static', 'yarn', ['workspace', '@catering-v2s/terminal', 'run', 'verify:static'],
 ['TERMINAL_STATIC=PASS']]

// runtimeCommands；现有 runner 不检查 marker
['terminal-verify', 'yarn', ['workspace', '@catering-v2s/terminal', 'run', 'verify']]
```

同步更新 `scripts/test/standards-enforcement-verify.test.mjs` 与 execution catalog test，断言两个 tuple 的分类、
参数与 static marker；再运行一次 `scripts/verify --validate-only`，确认仓级 runner 实际调用
`terminal-static` 并检到 marker。**不运行**仓级 normal `scripts/verify`，因为它包含本批未授权的远端和既有
runtime commands；runtime tuple 在本批只由 focused catalog test 与 TER 自己的 `verify` 证明形状和行为。

批二不会由脚本自动开启。该历史步骤的批一条件已经由 Dexter 授权与批一证据满足；
批二实施和最终收口见下方 CP-8。由于 Dexter 明确要求 TER 专用验证，本轮没有完成授权的仓级
`scripts/verify`（包括 `--validate-only`）；后续文案扫描曾因 shell quoting 失误触发一次事故性
静态首败，记录在 CP-8 证据中且不作为验收证据。仓级 tuple 的源码形状由 focused 代码测试保留，
不把未完成授权验收的仓级入口表述成已执行证据。

### CP-8 · 批二八包落地与最终 22 包收口（实施记录）

CP-8 在批一验收通过及 Dexter 直接授权后完成，顺序如下：

1. 新增 `kernel.base.transport`、`kernel.base.workflow`、`ui.base.input`、
   `ui.base.admin-shell` 与四个 Android adapter（`device`、`app-control`、`logger`、
   `dual-screen`），每包按需求的手工/官方脚手架规范化表落地；没有能力、command、slice、
   持久化或端口行为实现。
2. 将 UI integration 的正式依赖接到两个新 UI root；将 assembly 的正式依赖、
   `dependencies.ts` 和 `skeletonBootstrap.ts` 同步到当前投影的其余 21 个 package root，
   并把 `activeSkeletonBatch` 设为 2。入口继续通过真实 `App.tsx` 渲染全部 22 个
   `moduleName`，不是旁路常量。
3. 用显式 `--source` 的 `create-expo-module@latest` 从当次
   `expo-module-template@latest` source 在 scratch 逐个重跑四个新增 adapter；四次 exit 0，
   native diff 均为 0，原始树、hash、命令、日志和 cleanup 见
   `doc/evidence/platform/terminal-skeleton/batch-2/cp8-batch2-skeleton-codex.md` 指向的
   `.runtime/terminal-skeleton/batch-2/scaffold-rerun/`。
4. TER-only 验收顺序为静态/模型门、Turbo dry-run、22 包 typecheck 与 assembly Expo export。
   最终实测为 22/22 typecheck、test dry-run executable=5（仅脚手架 test 形状，不执行）、
   lint/clean executable=0、Metro 647 modules、`TERMINAL_VERIFY_CLEANUP=PASS`、
   `TERMINAL_VERIFY=PASS`，总耗时 20 秒；逐包退出码与完整输出在
   `.runtime/terminal-skeleton/batch-2/typecheck-all-per-package.log` 和 `ter-verify.log`。
5. CP-8 初始实施记录保留批一 CP-7 的 14 包设备证据边界；随后按 Dexter 的最终证明要求，
   在最终 22 包树上补做一次独立模拟器复核。该复核的 Gradle/autolinking/启动/bootstrap
   结果见 `doc/evidence/platform/terminal-skeleton/batch-2/cp8-batch2-skeleton-codex.md` 的
   final-device addendum；它不升级 Kotlin 能力或任何终端业务能力，二者仍为 `UNVERIFIED`。

CP-8 完成后的可审计结果为：

```text
BATCH1_SKELETON=PASS
BATCH2_SKELETON=PASS
FINAL_TER_PACKAGE_COUNT=22
FINAL_TER_TYPECHECK=22_OF_22
FINAL_TER_METRO=647_MODULES
TER_VERIFY=PASS
TER_ROOT_VERIFY_AUTHORIZED_RUN=NOT_PERFORMED
TER_ROOT_VERIFY_ACCIDENTAL_ATTEMPT=STATIC_FIRST_FAIL_NOT_EVIDENCE
```

## 5 · operation / path / face / 集合形态

N/A：本批不新增 HTTP operation、consumer face 或业务集合。`skeletonGraph` 是有限构建规格，最终固定 22 节点，
当前投影已为 22 节点；它不是运行时业务数据，不进入 contract。

## 6 · 跨 owner 写矩阵

N/A：本批没有后端 owner、数据库写或事务。TER 包依赖只是编译/装配关系，不是业务 owner 调用。

## 7 · 声明—传递—消费矩阵

| fact | declaration | transfer | consumption | proof |
|---|---|---|---|---|
| 当前批次 | `activeSkeletonBatch` | checker 投影 | census、图、bootstrap、验收分母 | 最终 22 exact-set（批一阶段为 14）；改成错误批次红 |
| 包身份 | graph 的 moduleName key | 路径与 npm name 由 checker 派生 | package.json、moduleName.ts | 三重命名门 |
| plannedKind | graph 节点唯一声明 | 不传入包 | 仅设计/report | 包内出现 plannedKind 红；不得称已生效 |
| 正式/dev 依赖 | graph 两个数组 | package.json 类别；dependencies.ts 根 import | TS/Turbo/Metro | 图 exact-set + tsc + export |
| 入口可达集合 | 当前投影 | App local root + bootstrap npm roots | Metro | AST exact-set + export |
| static marker | `verify-static.mjs` 成功尾部 | CP-7 本地与设备验收全绿后才接 `staticCommands` stdout | 仓级 validate-only | 缺 marker或失败仍打印 PASS 均红；半成品期仓级零 tuple |
| full marker | `verify.mjs` 成功尾部 | runtime tuple stdout | 人工/TER 独立验收 | 任一子步骤失败时 marker 缺席 |

## 8 · 业务规则 → owner 判定点

N/A：没有业务规则或 owner command。适用的是工程规则 `TR-01`…`TR-09`；本批只实现需求 §10 明确到期的
六道静态门，其余在首个真实能力 slice 到期。

## 9 · owner API 与消费者清单

N/A：本批不声明任何 owner API。公开根只导出 `moduleName`、`dependencyModuleNames`、
`devDependencyModuleNames` 三项骨架元数据；它们的消费者是图检查、assembly bootstrap 与打包器。

## 9a · 实施前全链同步变更清单

| 变更事实 | 契约/生成源/生成物 | 后端 owner/edge/migration | 前端 model/surface/state | focused/静态/HTTP/L2 | fixture/seed | 结论 |
|---|---|---|---|---|---|---|
| 22 节点规格、批一投影 14 | `skeleton-graph.ts` 唯一规格；无生成物 | N/A：无后端 | assembly 仅诊断呈现 moduleName | static + tsc + Metro；HTTP/L2 N/A | N/A | 同步修改 spec/checker/bootstrap |
| 三重命名 | moduleName key 派生 path/npm | N/A | 14 package roots | static | N/A | checker 派生，不复制映射表 |
| dependency/devDependency | spec + package.json + TS imports | N/A | package consumers | static + tsc + Metro | N/A | 三方逐项比对 |
| 两档 verifier | `tools/terminal-skeleton/*`、`tools/verify-gates/verify.mjs` | N/A | N/A | TER 本地入口先验；CP-7 最后接 static/runtime-command；无 DEV | N/A | 半成品期零仓级 tuple，本地全绿后原子接线 |
| Expo 原生脚手架形态 | 官方 CLI/template | CP-7 一次性模拟器运行 | adapter/assembly package root | scaffold exit/tree + Metro；CP-7 证明 Gradle/autolinking/启动；Kotlin 能力仍 UNVERIFIED | N/A | 原始树后逐项规范化 |

## 9b · 变更定位锚点

| 文件 | 唯一锚点 |
|---|---|
| `package.json` | `"workspaces": [`、`"devDependencies": {` |
| `.gitignore` | `node_modules/`；其后逐项追加 `.expo/`、`.turbo/`、`**/android/build/`、`**/android/app/build/`、`**/android/.gradle/`、`*.apk`、`*.aab`、`*.keystore`、`**/.kotlin/` |
| `eslint.config.mjs` | `export default [` |
| `tools/verify-gates/verify.mjs` | `const staticCommands = Object.freeze([`、`const runtimeCommands = [` |
| `scripts/test/standards-enforcement-verify.test.mjs` | `verify.staticCommands`、`verify.runtimeCommands` |
| `apps/terminal/package.json` | 整份占位文件按需求覆盖，不做局部锚点编辑 |

## 10 · 数据迁移

N/A：无数据库与历史数据，不创建 Flyway。

## 10b · seed 数据

N/A：本批不改变业务事实形状、没有 TER seed owner，也不授权 reset/seed。现有后端 seed 与 fixture 不消费
TER 构建规格，因此无需修改；这是明确反例，不是“无影响”占位。

## 11 · 验收场景设计

| scenario id | owner 文件 | fixture | request/action | oracle |
|---|---|---|---|---|
| `terminal-skeleton-static-real-tree` | `tools/terminal-skeleton/check-static.test.mjs` | 批一真实树 | 执行六门 | 六门全绿、TR01 调用点为 0 |
| `terminal-skeleton-static-red-controls` | 同上 | mktemp 副本逐门单一变异 | 逐个执行 gate | 每个对应 gate 非 0，真实树仍绿 |
| `terminal-skeleton-type-resolution` | TER `verify.mjs` | 当前投影 workspace 包（最终 22） | Turbo 拓扑 typecheck | 任务 exact-set 且全部 exit 0 |
| `terminal-skeleton-entry-bundle` | TER `verify.mjs` | App/Bootstrap 真实入口 | Expo Android export | 可达集合 exact-set 且 Metro exit 0（最终 647 modules） |
| `terminal-skeleton-device-acceptance` | CP-7 人工验收记录 | Android 模拟器 + assembly | `npx expo run:android` | **批一历史一次性证据**：Gradle 构建；autolinking 生成结果含 `com.catering.v2s.terminal.adapter.android.persistkv.TerminalPersistKvModule`；应用启动；屏上出现 14 个 moduleName；截图/日志/adb 身份与生成结果路径留证 |
| `terminal-skeleton-final-device-recheck` | CP-8 final-device evidence addendum | Android 模拟器 `emulator-5554` + final assembly | `npx expo run:android --no-install --device Pixel_Tablet` | 最终 22 包树：Gradle BUILD SUCCESSFUL；5/5 adapter autolinking；APK 安装与 Activity 启动；JS main 无 fatal/JS error；屏上 22/22 moduleName；截图、UI hierarchy、adb 身份、生成物清理留证；不代表 Kotlin 或业务能力 |
| `terminal-skeleton-marker-failure` | Node focused tests | 子命令受控失败 | 调用两条入口 | 失败入口不打印自己的 PASS marker |
| `terminal-skeleton-scaffold-hygiene` | `tools/terminal-skeleton/check-static.test.mjs` | 真实树 + mktemp 文件副本 | 加嵌套元数据；删一条 ignore 规则 | 单列 `SCAFFOLD_HYGIENE` 红/绿，不改变 `RULE_GATES=6` |

这些是工程验收，不是 backend-acceptance 场景；不新增 provider、HTTP fixture 或浏览器测试。

## 12 · 未决项与证据状态

| 项目 | 当前状态 | 本批允许 | 本批禁止 |
|---|---|---|---|
| create-expo-module 完整闭包 | `RESOLVED_BY_CP0_EVIDENCE`：显式 latest 官方 source 在 scratch 以相对目标路径 exit 0；原始树、退出码、cleanup 已记录 | CP-4 仍须按规范化表证明入仓形态；不把 scratch 成功升级为 adapter 已完成 | 把 scratch 探针升级为入仓完成、猜模板、使用隐式 fallback |
| create-expo-module 入仓规范化闭包 | `VERIFIED`：批一 persist-kv 与批二四个 adapter 均完成规范化；四个批二 native scratch diff=0 | 保留官方 native 形态，继续由 hygiene 与静态门约束 | 把 scratch 成功升级为能力实现 |
| npm age gate | `DEXTER_DECISION`：Dexter 2026-08-29 裁定“什么最新装什么”；age gate 不再构成等待阻断 | 仅以进程级 `YARN_NPM_MINIMAL_AGE_GATE=0` 运行本次 latest 解析/install，记录覆盖与退出码；仓库配置不变 | 把临时覆盖写入 `.yarnrc.yml`、改用旧快照或替代 package manager |
| Android Gradle 与 autolinking | `VERIFIED`：最终 22 包模拟器复核的 Gradle 输出列出并编译 5 个 TER adapter，APK 安装/Activity 启动成功；UI 与 logcat 证据见 final-device addendum | 仅主张本仓布局下最终树的 Gradle、autolinking、启动与 bootstrap 渲染；不升级为 Kotlin/业务能力 | 把设备成功升级为 Kotlin 能力、业务行为或真机证据 |
| Kotlin 能力 | `UNVERIFIED`：只有最小 Module 注册类，没有能力实现 | 保留官方注册形态；设备验收通过后仍不升级为能力可用 | 把 Gradle 编译/启动升级为 Kotlin 能力验证 |
| 真实 22 包 typecheck/Metro | `VERIFIED`：TER-only verify 22/22 typecheck、Expo export 647 modules | 保持“Metro 可打包入口可达集合”边界，不升级为设备或能力行为 | 在未读日志时声称设备或能力完成 |
| Turbo 实际任务列表 | `VERIFIED`：TER-only verify dry-run 为 22/22/22，test executable=5，lint/clean=0 | 继续只执行 TER filters，保持 frontend/library/aggregate 排除 | 推测 filter 不触发 frontend |
| 两条 verify 实际时长 | `VERIFIED`：本次完整 TER verify 20 秒，marker 与 cleanup 分离 | 保持秒/分钟级观测，异常先读日志 | 未测即称分钟级 |
| UI 依赖版本源 | `VERIFIED`：latest template raw manifest 与同一次 install 解析值用于 assembly/UI；进程级 age-gate 仅本次运行覆盖 | template 滚动时 A/B 一起重取；证据见 CP-8 runtime 记录 | 把 raw manifest 当成集合 B 的 expo install 成功、抄旧快照、改用另一 package manager |
| latest 与固定栈的 owning source | `RESOLVED_AT_SOURCE`：需求 §3、§13 与 active architecture memory 统一为实施时 latest；2026-08-29 快照为 SDK 57/RN 0.86.3 | 每次 latest 漂移重新解析并记录实际值；不把快照当输入 | 以旧快照钉死版本，或以数值巧合掩盖策略改变 |
| test-support 生产可达性 | `OPEN_FUTURE_DECISION`：批一的两个 test-support 只有空骨架；一旦获得真实 test-only 内容，「不得进生产 bundle」与“bootstrap 导入批次每个包”会再次互斥 | 当前保持批次全量入口断言；取得真实内容时重新裁定，入口可达分母改为批次集合减去 test-support | 提前缩小批一分母，或把真实 test-only 内容打入生产 bundle |

## 13 · 停机条件

遇到任一条件立即停下并保留首败：

1. 实施期显式传入当时 latest 官方 source 的 `create-expo-module` 复跑无法取得 exit 0，或实际树缺 Android/metadata 主结构；
2. latest 解析或 install 在已获 Dexter 授权的进程级 age-gate 覆盖下仍失败，且根因不是已记录的 registry/cache/lockfile 边界；
3. 实际脚手架与本详设的保留/删除表不符，无法在不手写 native 结构下规范化；
4. Turbo dry-run 包含 `apps/frontend/*` 或聚合包产生递归；
5. UI 手工包无法在“集合 A raw manifest + React 单实例”下独立 typecheck，或某包在集合 B 映射成功前声明/消费集合 B；
6. 需求与规范正本出现新的不可同时满足项；
7. 任一修复需要包能力、DEV、seed、L2、UAT 或部署。
8. 重新解析的 latest 与 owning source 的「latest 优先」策略无法同时满足，或实际 latest 需要另一个
   未获 Dexter 裁决的供应链/版本策略；不得用旧快照或手工 pin 掩盖。

上游数字和 finding 都是待验证输入；真实 package/workspace/task 列表与可复跑输出优先。

## 13b · 实施节奏与三维对账

每个 CP 写入前重开：需求对应节、本文对应 CP、TER 三条 routed memory 与 owning source、当前待改源码。
focused proof 后用同一组原文回读。进入下一 CP 前，由 fresh 独立子 agent 对当前 CP 做：

- 需求：目标、明确不做、14/22 分母；
- 详设：文件形态、依赖、失败条件、证据档位；
- 项目记忆：正本单一性、四层、批次、真实 import 与骨架完成标准。

逐项写 `MATCHED` / `OPEN`；任何 `OPEN` 先修复并由新的 fresh reviewer 复核。CP-0..6 全部结束后、
整体测试前，再做一次跨 CP 全批对账；它不替代最终 `REVIEW_TARGET=IMPLEMENTATION` 独立 review。

## 14 · 交付前自查

| 检查 | 本详设结论 |
|---|---|
| §3 固定行 | 全部保留；N/A 都给出本批反例边界。 |
| §3 ④ 全集 | 以最终 22 规格节点、批一 14 包、批二新增 8 包或明确命令段列全。 |
| §7 跨层机制 | graph、依赖、入口与 marker 均写 declaration/transfer/consumption/proof。 |
| IA 对账 | N/A，Dexter 明确裁定无 IA。 |
| seed 全集 | N/A，现有后端 seed 不消费 TER 规格。 |
| 计数 | 最终规格 22；批一 14 = kernel 7 + ui 5 + adapter 1 + assembly 1；批二新增 8。 |
| 证据档位 | static、tsc、Metro 与 CP-7 一次性模拟器运行分开；设备运行可升级 Gradle/autolinking/启动/bootstrap 渲染，Kotlin 能力、DEV/L2/UAT 均不升级。 |
| 独立设计复核 | 内部 R1 `NO-GO 0/3/1`、R2 `NO-GO 0/1/0` 已封盘；Claude CP-5 `IMPLEMENTATION` 定向复核为 `GO 0/1/1`；批二实施收口见 CP-8，等待新的整批 `IMPLEMENTATION` review。 |

## 15 · 独立审查 R1 intake

| finding | 主 agent 裁决 | owning evidence | 最小处置 |
|---|---|---|---|
| S-1 module 证据过度升级 | `PARTIALLY_CONFIRMED`：R1 当时的 scratch exit 0 不是完整 CP-0 证据；后续 CP-0 audit rerun 已取得 command/status/raw tree/cleanup | 需求 §2.2/§8.1；CP-0 evidence | R1 的降级处置已被后续 `RESOLVED_BY_CP0_EVIDENCE` 取代；adapter 入仓仍等 CP-4 规范化 proof |
| S-2 app 使用 moving latest | `CONFIRMED_AT_R1` | fresh `create-expo-app@4.0.0 --help`、npm exact template 查询与 scratch exit 0 | 当时采用固定 CLI/template；**已被后续 Dexter 2026-08-29 “一律 latest”裁定取代**，仅保留为历史 intake |
| S-3 Turbo exclusion 留给实施者 | `CONFIRMED` | 需求 §5.3；Turbo 2.10.12 CLI filter 形状 | 永久增加 `!@catering-v2s/terminal` filter；批一历史 dry-run exact-set 为 14，最终投影为 22，不保留条件分支 |
| N-1 模板 key 被改名 | `CONFIRMED` | implementation design template §0 | 历史处置曾恢复 `IMPLEMENTATION_AUTHORITY=false`；现已由 Dexter 2026-08-29 批一/批二实施授权覆盖，当前元数据为 `true` |
| 自查：bootstrap 没有亲自 import assembly root | `CONFIRMED` | 需求 §9.2 明确 bootstrap import 当前批每个 root | bootstrap 用本地 `./index` import assembly root，13 个 npm root import 其余包；本地 self root 不算依赖边 |

R1 原始 verdict 见
`doc/review/platform/2026-08-29-v2s-terminal-skeleton-batch1-design-independent-review-codex.md`。

### 15.1 R2 intake 与最终自决

R2 唯一 S-1 为 `CONFIRMED`：四个聚合脚本都有固定命令，但只有 typecheck 写了 task-set 判据。
最小修复采用 reviewer 的 B：保留需求要求的四个入口，给出 final exact-set 与阶段 typecheck 分母；
test/lint/clean 只做 dry-run，不进入本批执行。R2 原始 verdict 见
`doc/review/platform/2026-08-29-v2s-terminal-skeleton-batch1-design-independent-review-r2-codex.md`。

```text
REVIEW_CYCLE_ID=TER_SKELETON_BATCH1_DESIGN_20260829
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
FINAL_SELF_DECISION=GO_FOR_CLAUDE_REVIEW
OPEN_INTERNAL_FINDINGS=0
```

这个 GO 只表示两份设计材料已达到交给 Claude 独立评审的条件；不代表 Claude 已 GO，也不启动包实施。

### 15.2 Claude `NO-GO 2/3/2` intake

Claude 原始 verdict 见
`doc/review/platform/2026-08-29-v2s-terminal-skeleton-batch1-design-review-claude.md`。作者逐条重开当前需求、
真实 verifier、根 ignore 与 fresh Expo 探针后处置如下：

| finding | 分类 | owning evidence | 最小处置 |
|---|---|---|---|
| M-1 assembly 声明边与 bootstrap import 互斥 | `CONFIRMED` | 需求 §6.1/§9.2 已同步为同批次全集 | graph 最终 literal 改为其余 21；批一投影 13；package.json、dependencies.ts、bootstrap 三者 exact-set |
| M-2 固定旧 scaffold/template | `DEXTER_DECISION` + `CONFIRMED_EXTERNAL_FACT` | 需求 §3/§8.1；fresh latest app exit 0 | CP-0/CP-5 改 latest、记录当次解析版本；删除旧模板版本规范化；CP-3 消费 latest scratch 结果 |
| S-1 hygiene checker 无落点 | `CONFIRMED` | 需求 §5.4/§12.2；原 CP-6 工具表 | 并入 `check-static.mjs` 为第七项文件检查；报告 6 个 rule gates + 1 个 support check |
| S-2 ignore 清单不完整 | `CONFIRMED` | 根 `.gitignore` 当前 6 行；需求 §5.4 | CP-1 与锚点逐项列出 Expo/Turbo/Android/Gradle/signing/Kotlin 规则 |
| S-3 仓级 tuple 接线过早 | `CONFIRMED` | `tools/verify-gates/verify.mjs` 两档都会先跑 static | CP-6 仅建 TER 入口；CP-7 本地全绿后最后接两个 tuple，并只跑仓级 validate-only |
| N-1 LICENSE 两类不一致 | `CONFIRMED` | 需求 §8.1；fresh app/module template 都含 LICENSE | adapter 与 assembly 的 package-local LICENSE 均明确删除 |
| N-2 evidence/runtime 落点 | `CONFIRMED_NO_CHANGE` | `doc/evidence/platform/` 存在；根 `.gitignore` 已含 `.runtime/` | 无修改 |

```text
CLAUDE_REVIEW_VERDICT=GO
CLAUDE_REVIEW_M_S_N=0/0/0
CLAUDE_FINDINGS_DISPOSITIONED=7/7
POST_REMEDIATION_STATUS=CP5_IMPLEMENTATION_GO_AND_DEXTER_BATCH1_BATCH2_AUTHORIZED
BATCH1_IMPLEMENTATION_STARTED=true
```

内部 review cycle 已到两轮上限；本节是外部 finding intake 与文档修订记录，不是第三轮内部 verdict。

## 16 · 批一/批二实施最终收口（2026-08-29）

本节是实施后的当前状态，优先于本文中描述批一中间 checkpoint 的历史数字；它不改变需求的
“只建骨架、不实现能力”边界。

```text
IMPLEMENTATION_STATUS=READY_FOR_INDEPENDENT_IMPLEMENTATION_REVIEW
BATCH1_SKELETON=PASS
BATCH2_SKELETON=PASS
FINAL_TER_PACKAGE_COUNT=22
FINAL_TER_TYPECHECK=22_OF_22_PASS
FINAL_TER_METRO=PASS_647_MODULES
TER_VERIFY=PASS_20_SECONDS
TER_VERIFY_CLEANUP=PASS
FINAL_ANDROID_DEVICE=PASS
FINAL_GRADLE_BUILD=PASS
FINAL_AUTOLINKED_ADAPTERS=5_OF_5
FINAL_APP_START=PASS
FINAL_BOOTSTRAP_RENDER=22_OF_22
FINAL_ANDROID_GENERATED_CLEANUP=PASS
TER_ROOT_VERIFY_AUTHORIZED_RUN=NOT_PERFORMED
TER_ROOT_VERIFY_ACCIDENTAL_ATTEMPT=STATIC_FIRST_FAIL_NOT_EVIDENCE
```

这里的 `FINAL_TER_TYPECHECK=22_OF_22_PASS` 只表示 22 个包根及其声明的跨包 import 可解析并编译，
是跨包类型解析证据，不是终端业务类型或 adapter 能力正确性的证明。

批二的逐包形态、真实命令、退出码、Metro 输出、脚手架重跑和清理证据集中在
`doc/evidence/platform/terminal-skeleton/batch-2/cp8-batch2-skeleton-codex.md`。该证据与
批一 CP-7 模拟器附录分开；在 CP-8 初始记录之后，已补做一次最终 22 包树的模拟器运行，
其 Gradle、5/5 adapter autolinking、APK 安装、Activity 启动、JS main 执行与 22 个
`moduleName` 渲染证据见该 evidence 的「Final 22-package Android emulator acceptance addendum」。

当前仍未证明或未授权的边界：Kotlin 能力、任何 adapter/terminal 业务能力、双屏/杀进程恢复、
DEV、reset、seed、浏览器 L2、UAT、部署、EAS，以及仓级 `scripts/verify` 的授权验收。TER-only
`verify` 已按 Dexter 指令完成；root tuple 源码仍保留，但本轮没有把未完成授权验收的仓级入口写成运行证据。
