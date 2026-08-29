# TER 骨架批一/批二 · 实施计划与收口记录

## 0 · 计划状态与边界

本计划执行
`doc/plans/platform/2026-08-29-v2s-terminal-skeleton-implementation-design-codex.md`，覆盖批一 14 个包及
批一验收通过后直接继续的批二 8 个包。批一与批二均已按 Dexter 授权实施；本文件同时保留建设顺序与
真实收口证据。

```text
PLAN_SCOPE=BATCH_1_14_THEN_BATCH_2_8_PACKAGES
IMPLEMENTATION_STATUS=READY_FOR_INDEPENDENT_IMPLEMENTATION_REVIEW
FINAL_TER_PACKAGE_COUNT=22
IMPLEMENTATION_AUTHORIZED_BY=DEXTER_2026_08_29
IMPLEMENTATION_ENTRY_REQUIRES=CLAUDE_TARGETED_RECHECK_GO
BATCH_2_AUTHORIZED=true
CAPABILITY_IMPLEMENTATION_AUTHORIZED=false
DYNAMIC_RUNTIME_AUTHORIZED=CP7_ONE_TIME_ANDROID_EMULATOR_ONLY
```

明确禁止：任何 command/actor/slice/port 行为、真机、持续或自动化设备运行、DEV、reset、seed、
浏览器 L2、UAT、部署、EAS 与仓库控制动作。批一 CP-7 仅允许一次 Android 模拟器 `expo run:android`
验收，用于 Gradle/autolinking/启动/bootstrap 渲染证明，不进入任何 verify。

## 1 · 当前基线与实施前事实

| 项 | 当前事实 | 实施含义 |
|---|---|---|
| TER 目录 | 只有 `apps/terminal/package.json` 占位，name=`nextpos` | CP-1 整份覆盖，不继承字段。 |
| 根 workspace | 只有 `apps/frontend/*` 与 `libraries/frontend/*` | 加精确 TER globs，不建嵌套 workspace。 |
| Turbo | 根无 `turbo.json`，根 package 未声明 turbo | CP-1 建 root task graph，并 dry-run 亲验。 |
| verifier | `staticCommands` 检 marker；`runtimeCommands` 不检 marker | 两条 TER 入口分别接线，不混成一条。 |
| Expo skills | `npx skills list --global --json` 可见 `source=expo/skills` | 不安装、不注册 Expo MCP。 |
| create-expo-module | `VERIFIED`；批一 persist-kv 与批二四个 adapter 均以显式 latest 官方 source 取得 exit 0，原始树、退出码、native diff 与 cleanup 已记录 | 保留官方 native 形态；不把 scratch 成功升级为能力实现。 |
| 隐式 module template 路径 | 不传 source 时曾 fallback，并以 `TS2688` 缺 Jest type 失败 | 禁止隐式 download/fallback；显式 pack 当时 latest 官方 source。 |
| npm age gate | 当前配置可能为 `npmMinimalAgeGate=1440`；Dexter 2026-08-29 已裁定不再等待 | 仅使用进程级 `YARN_NPM_MINIMAL_AGE_GATE=0` 处理本次 latest install，记录覆盖；不写仓库配置。 |

## 2 · 批一 14 包的精确分母与顺序（历史建设步骤）

| 顺序 | path | npm name | plannedKind | 当前批正式依赖 | 当前批 devDep | 创建方式 |
|---:|---|---|---|---|---|---|
| 1 | `kernel/base/contracts` | `@catering-v2s/kernel-base-contracts` | toolkit | — | — | 手工 |
| 2 | `kernel/base/platform-ports` | `@catering-v2s/kernel-base-platform-ports` | toolkit | contracts | — | 手工 |
| 3 | `kernel/base/state` | `@catering-v2s/kernel-base-state` | toolkit | contracts, platform-ports | — | 手工 |
| 4 | `kernel/base/runtime` | `@catering-v2s/kernel-base-runtime` | owner | contracts, platform-ports, state | — | 手工 |
| 5 | `kernel/base/display-context` | `@catering-v2s/kernel-base-display-context` | owner | contracts, state, runtime | — | 手工 |
| 6 | `kernel/base/ui-state` | `@catering-v2s/kernel-base-ui-state` | owner | contracts, platform-ports, state, runtime, display-context | — | 手工 |
| 7 | `kernel/base/test-support` | `@catering-v2s/kernel-base-test-support` | toolkit | — | contracts, platform-ports, state, runtime | 手工 |
| 8 | `ui/base/render` | `@catering-v2s/ui-base-render` | toolkit | platform-ports, runtime, ui-state | — | 手工 RN/TS 库 |
| 9 | `ui/base/automation` | `@catering-v2s/ui-base-automation` | owner | platform-ports, runtime, ui-state | — | 手工 RN/TS 库 |
| 10 | `ui/base/primitives` | `@catering-v2s/ui-base-primitives` | toolkit | automation | — | 手工 RN/TS 库 |
| 11 | `ui/base/test-support` | `@catering-v2s/ui-base-test-support` | toolkit | — | render, automation, kernel test-support | 手工 RN/TS 库 |
| 12 | `adapter/android/persist-kv` | `@catering-v2s/adapter-android-persist-kv` | toolkit | platform-ports | — | 官方 Expo module |
| 13 | `ui/integration/platform-console` | `@catering-v2s/ui-integration-platform-console` | toolkit | contracts, platform-ports, state, runtime, display-context, ui-state, render, automation, primitives | ui test-support | 手工 RN/TS 库 |
| 14 | `assembly/android/pos-desktop` | `@catering-v2s/assembly-android-pos-desktop` | toolkit | **批一其余 13 包全部**：contracts, platform-ports, state, runtime, display-context, ui-state, kernel test-support, render, automation, primitives, ui test-support, integration, persist-kv | — | 官方 Expo app |

表中的短名只为可读性；`skeleton-graph.ts` 必须写完整 moduleName。batch 2 目标在规格中存在，但当前投影
滤掉未到批节点及其边，所以批一阶段 integration 不声明 input/admin-shell，assembly 不声明
transport/workflow/其余四个 adapter；批一仍声明当前批其余 13 个节点。最终 graph 中 assembly 的正式依赖
是其余 21 个节点，批一投影后才得到这 13 条。

批二新增 8 个最终叶子为：

```text
kernel/base/transport
kernel/base/workflow
ui/base/input
ui/base/admin-shell
adapter/android/device
adapter/android/app-control
adapter/android/logger
adapter/android/dual-screen
```

批二完成后 `activeSkeletonBatch=2`，最终 workspace/census、graph、bootstrap 与 assembly 依赖分母为 22/21。

## 3 · CP-0：先取得可复跑官方 module 闭包

### 3.1 Preflight

从仓根记录：

```sh
npx skills list --global --json
node -v
yarn -v
npx --version
npm view create-expo-module@latest version
npm view expo-module-template@latest version
npx create-expo-module@latest --version
npm view create-expo-app@latest version
npm view expo-template-blank-typescript@latest version
yarn config get npmMinimalAgeGate
```

判据：Expo skill 全局可见；Node >=22；Yarn 4.17.0；CLI/template 的当时 latest 解析版本与 age gate 值被记录。

### 3.2 显式传入当时 latest 官方模板并在 scratch 生成

```sh
TER_SCRATCH="$(mktemp -d)"
TER_MODULE_TEMPLATE_VERSION="$(npm view expo-module-template@latest version)"
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

目标参数必须是 scratch cwd 下的相对路径。`create-expo-module` 以 `INIT_CWD` 为基准执行
`path.join(INIT_CWD, target)`；从仓根传绝对目标会把目录重写到仓内，随后 Yarn 报 workspace root
边界错误。本机 CP-0 已分别保存该首败与上述相对目标的成功闭包。

实施时保存：完整命令、CLI/template 版本、stdout/stderr、exit code、原始 `find` 树、原始 package.json、
`expo-module.config.json`、Android source set、npm age gate 值、cleanup 结果。原始长输出只放
`.runtime/terminal-skeleton/scaffold-probe/`，摘要写
`doc/evidence/platform/terminal-skeleton/batch-1/create-expo-module-closure-codex.md`。

### 3.3 阻断与替代

1. 显式 latest source 入口 exit 0：`SCAFFOLD_RAW=PASS`，进入 CP-1；
2. registry/network/cache 失败：先定位该边界，再按本次解析 source 重试，不改用隐式 fallback；
3. 同次解析的官方 CLI/template 仍失败：`SCAFFOLD_RAW=BLOCKED`，不创建 adapter/assembly，不进入 CP-4；
4. workspace install 因 npm age gate 失败：使用进程级 `YARN_NPM_MINIMAL_AGE_GATE=0` 重跑，覆盖不写入仓库，
   并把命令、环境变量、版本和退出码写入 evidence；不得改用旧快照或另一 package manager。

每次 probe 清理自己的精确 scratch；`SCAFFOLD_RAW` 与 `SCRATCH_CLEANUP` 分开报告。

### 3.4 UI/assembly 的 Expo 版本解析源

CP-3 早于 assembly 入仓，但 UI 不能凭快照手写 Expo 兼容版本。CP-0 因此再建一份不会进入 workspace 的
latest assembly scratch：执行 §8 的 `create-expo-app@latest --template blank-typescript --no-install`，保存
CLI/template 精确版本与原始 package.json。模板已提供的 `expo`、`expo-status-bar`、`react`、`react-native`、
`typescript`、`@types/react` 组成集合 A，直接以 raw manifest 为源；只有模板未提供的 UI 专有集合 B 才在该
scratch app 内由 Expo CLI 补解析：

```sh
(
  cd "$TER_APP_SCRATCH/pos-desktop"
  YARN_NODE_LINKER=node-modules yarn install
  npx expo install react-dom react-native-web \
    react-native-reanimated react-native-worklets
)
```

保存命令、template 版本键、集合 A raw 值、集合 B 解析前后 `package.json`、解析版本、exit code 与 cleanup；
CP-3 的 UI peer/devDependencies 和 CP-5 assembly manifest 只消费该证据单元的精确值。`latest` 是选择策略，
精确值是该次证据；不抄需求快照、不加旧模板版本规范化步骤。集合 A 已解析而集合 B 非 0 时写
`TEMPLATE_MANIFEST_SOURCE=RESOLVED`、`UI_EXPO_SDK_MAPPING=BLOCKED`、`UI_VERSION_SOURCE=PARTIAL`；不消费集合 B
的 CP-3 空骨架可继续，声明或源码消费集合 B 的步骤必须停下。

若 peer conflict 或 Expo CLI 使集合 B 解析非 0，保留首败并维持
`UI_EXPO_SDK_MAPPING=BLOCKED`；不得把 requirements 表直接改写成“已由 expo install 验证”。
本次允许的 age-gate 进程级覆盖不得写入 `.yarnrc.yml`，也不得改变 latest 版本选择策略。

当前 fresh latest 为 SDK 57/RN 0.86.3；需求 §3、§13 与 active architecture memory 已统一为实施时
latest 优先、快照只作比对。后续 latest 漂移时重新解析并记录实际值，不把旧快照钉为输入。

`adapter/**` 是版本源例外：它的 Expo/RN/Jest 等外部开发依赖属于
`expo-module-template@latest` 自己的官方脚手架工具链，CP-4 只保留这套 raw manifest 形态并统一
TER 所需的 TypeScript 版本；它不消费 app template 的集合 A，也不在本批消费集合 B。

## 4 · CP-1：根配置、规格与工具空框

### 4.1 文件变更

1. 根 `package.json`
   - 保留既有 frontend workspaces；追加设计 §4 的 6 条精确 TER workspace；
   - 根 devDependencies 增加实施当时解析的 `turbo@latest`，以及 CP-0 latest app manifest 解析出的 TypeScript；
     2026-08-29 的 `2.10.12` / `~6.0.3` 仅是快照，不手写成永续输入；
   - 不新增嵌套 package manager 配置。
2. `yarn.lock`
   - 只由根 `yarn install` 更新；禁止手写。
3. 根 `turbo.json`
   - `typecheck.dependsOn=["^typecheck"]`；
   - `test`、`lint`、`clean` 只定义 task，不进入批一 verify；
   - `clean.cache=false`，其他任务无声明产物时不伪造 outputs。
4. 根 `.gitignore`
   - 逐项增加 `.expo/`、`.turbo/`、`**/android/build/`、`**/android/app/build/`、
     `**/android/.gradle/`、`*.apk`、`*.aab`、`*.keystore`、`**/.kotlin/`；
   - `**/` 保证规则覆盖 TER 深层 package，不只覆盖仓根下不存在的 `android/`。
5. 根 `eslint.config.mjs`
   - 扩大 TS/TSX files 到 `apps/terminal/**/src`；复用现有 React Hooks error；
   - 不新建局部 config。
6. `apps/terminal/package.json`
   - 整份覆盖为 `@catering-v2s/terminal`、private、无 version/description/runtime deps；
   - scripts：`typecheck`、`test`、`lint`、`clean` 为 Turbo 聚合入口，另有 `verify:static`、`verify`；
   - `typecheck`、`test`、`lint`、`clean` 都精确为
     `turbo run <task> --filter='./apps/terminal/**' --filter='!@catering-v2s/terminal'`，其中 `<task>` 换成脚本同名；
   - Turbo 聚合脚本不得成为它自己所编排的同名 task。
7. 新建 `apps/terminal/tsconfig.base.json`、`tsconfig.json`、`skeleton-graph.ts`；
8. 新建 `kernel/feature`、`ui/feature`、`adapter/electron`、`assembly/electron` 的边界 README。
9. 新建 `tools/terminal-skeleton/` 五个工具文件的最小 CLI/test 入口，包含六道规则门与单列的
   `scaffold hygiene` 文件检查，先不声称门通过。

### 4.2 `skeleton-graph.ts`

按详设 §4/CP-6 的字段和 22 行表完整录入：

```ts
export const activeSkeletonBatch = 2 as const
export const skeletonGraph = {
  '<full.module.name>': {
    batch: 1,
    plannedKind: 'toolkit',
    dependencies: [] as const,
    devDependencies: [] as const,
  },
  // 实际文件不得有占位或省略行
} as const
```

不存 path/npmName，不在包内复制 plannedKind，不把 plannedKind 说成 kind。

### 4.3 Turbo filter 的实现与证明

固定运行：

```sh
yarn turbo run typecheck \
  --filter='./apps/terminal/**' \
  --filter='!@catering-v2s/terminal' \
  --dry=json
```

CP-1 首次运行只验证命令可解析、聚合包与 frontend/library 零任务；此时 leaf package 尚未创建，
typecheck task exact-set 必须为空。后续每个 CP 用同一命令重跑，checker 从 JSON 派生 owner exact-set：

| checkpoint | typecheck task 数 |
|---|---:|
| CP-1 | 0 |
| CP-2 | 7 |
| CP-3 | 12 |
| CP-4 | 13 |
| CP-5 / CP-6 | 14 |
| CP-8 (final) | 22 |

最终四个聚合脚本分别执行 `--dry=json`，断言：

| task | 最终 task owner exact-set | 是否实际执行 task |
|---|---|---|
| typecheck | 最终 22 个 leaf package | 是，进入 TER `verify` |
| test | 最终 5 个 Android adapter leaf | 否；只 dry-run，脚手架 test 保留但不跑 |
| lint | 空集合 | 否；不得表述为 leaf lint 已建立 |
| clean | 空集合 | 否；本批没有 leaf clean task |

Turbo `--dry=json` may still emit a task object with `command="<NONEXISTENT>"`
for a package that has no script. These objects remain part of the raw report
and are checked for TER directory/aggregate hygiene, but they are not
executable task owners. The exact-set in the table is the set of task objects
whose command is not `<NONEXISTENT>`; adding or removing a real script changes
that set and must fail the verifier.

每一个 dry-run 都断言：

- 每个 task path 都在 `apps/terminal/` 下；
- `apps/frontend/*` 与 `libraries/frontend/*` 零任务；
- `@catering-v2s/terminal` 零任务；
- task owner 与上表 exact-set 相等且不重复。

不能在真实 dry-run 前写“filter 已证明”。如果上述固定命令不满足四条断言，CP-1 阻断并回到设计，
不在实施现场发明另一种 filter。阶段与最终任务列表、exit code 和耗时记入批一证据。

### 4.4 CP-1 证明

- package census 与 Yarn workspace 列表在零/逐步建包状态一致；
- 根 frontend workspaces 仍可列出；
- `turbo.json` 可解析；
- 规格 22 节点、batch1 投影 14、batch2/final 投影 22；
- 四个 README 不包含 runtime/能力代码；
- 当前 checkpoint 不执行全量 verify，因为包尚未齐。

完成后做 CP-1 三维对账；有 `OPEN` 不进 CP-2。

## 5 · CP-2：7 个 kernel 包

按表 1→7 逐包创建。每包只创建：

```text
package.json
tsconfig.json
src/moduleName.ts
src/dependencies.ts
src/index.ts
```

`package.json` 的统一形态：private、type module、exports 只有 `.` 指向 `src/index.ts`、scripts 只有
typecheck；正式/dev 工作区依赖用 `workspace:*`。无 version、build、test、manifest、application、features、
React、RN、Expo 或空目录占位。

每建一包立即执行：

1. 三重命名 checker；
2. 该包 `yarn workspace <name> typecheck`；
3. graph current projection 与已落仓前缀的 package/import 对账；
4. nested metadata/ignore 文件系统检查。

7 包完成后执行 kernel 零 Expo/RN/React 门的真实树绿控制与两条红变异；记录
`KERNEL_PACKAGES=7`。完成 CP-2 三维对账再进 UI。

## 6 · CP-3：5 个 UI 包

### 6.1 版本解析

UI 是手工 RN/TS 库，不单独运行 native/module app scaffold。版本来自 CP-0 对 latest app/template 的一次解析：

1. 只消费 CP-0 §3.4 以精确 template 版本为键的证据单元：集合 A 使用 raw manifest，集合 B 只有在成功的 scratch
   `expo install` 结果存在时才可声明；不在每个 UI 包重复运行；
2. assembly 保留运行时依赖，提供 React/RN/Expo 单实例；
3. UI 包把 React/RN 写入 peerDependencies，并以相同解析版本放入 devDependencies 供独立 typecheck；
4. Reanimated/Worklets/NativeWind/RNR 等集合 B 包本批没有源码消费点，不提前登记依赖，待首个真实 UI slice
   再按 T-12 安装；
5. 手工 UI 包在没有 Expo 时不能谎称 `expo install` 已自行解析 SDK；集合 A 使用 scratch 模板 raw manifest，
   集合 B 必须等同一 scratch 的 Expo CLI 映射成功。若 age gate 阻断则停止集合 B，不改 gate，也不拿需求快照回填。

### 6.2 创建顺序

`render` → `automation` → `primitives` → `ui.base.test-support` → `integration/platform-console`。

排除被仓内工具生成且由 `.gitignore` 覆盖的构建/缓存目录（例如 `.turbo/`）后，每包仍只有五个基础源文件；不创建 feature/manifest/真实 primitive。每建一包执行 package typecheck 和图对账。
重点断言：

- render 不依赖 primitives；
- primitives 只直接依赖 automation；
- integration 不依赖 adapter；
- ui test-support 的三条边在 devDependencies，且 `dependencies.ts` 通过 package root import；
- integration 的 ui test-support 边为 devDependency；
- 批二 input/admin-shell 尚未出现在 batch1 manifest/import。

完成 CP-3 三维对账，确认 devDep 机制已真实进 tsc 图，再进 CP-4。

## 7 · CP-4：规范化 `adapter.android.persist-kv`

### 7.1 原始树到目标树

从 CP-0 同命令生成新的、可追溯 scratch，不复用历史半成品。先保存原始树，再按详设 CP-4 表规范化：

- 保留 Android Gradle/manifest/Kotlin Module registration、`expo-module.config.json`、tsconfig；
- 删除 example/apple/web、sample Function/Event/View、sample tests/build、package-local `LICENSE`、安装产物与局部规范；
- 保留 generated test script 及其实际需要的 `internal/module_scripts/test.js`、`util.js`，但本批不运行；
- package root 改成仅导出 moduleName/dependency metadata 的 TS source；
- 删除 `build`/`prepare`/`open:*`，新增 typecheck；
- 添加且只添加 `platform-ports` 工作区正式依赖；外部 Expo module 工具链依赖沿用本次官方 module template raw manifest，
  不把 app template 集合 A 的版本表误套到 adapter；
- 不声明 kind；plannedKind 仍只在 graph。

### 7.2 CP-4 证明

- raw scaffold exit 0 与 cleanup PASS；
- 目标 tree 与保留/删除表逐项相等；
- 工作区只多 1，example 不进 workspace；
- adapter 的内部工作区依赖 exact-set=`platform-ports`；
- package root tsc 可解析；
- CP-4 本身不运行 Gradle；CP-7 一次性模拟器验收将单独证明该本仓布局下 Gradle 构建、autolinking、应用启动
  与 bootstrap 渲染。Kotlin 侧只有最小注册类，能力仍 `UNVERIFIED`，不把设备成功升级为能力验证。

完成 CP-4 三维对账再进 integration/assembly。

## 8 · CP-5：integration、assembly 与真实入口

integration 在 CP-3 创建完依赖后完成最终 package/import 对账。assembly 用：

```sh
EXPO_NONINTERACTIVE=1 EXPO_NO_TELEMETRY=1 \
  npx create-expo-app@latest <scratch>/pos-desktop \
  --template blank-typescript \
  --no-agents-md --no-install
```

latest 输入已由 fresh scratch 取得 exit 0；实施仍须重新保存当时 CLI/template 解析版本、原始 manifest、
原始树、exit code 与 cleanup，再规范化目录/metadata 入 `apps/terminal/assembly/android/pos-desktop`。
依赖版本直接采用 latest template 与同一 scratch Expo CLI 的解析结果，不再做旧模板版本规范化。
CP-5 不执行 prebuild 或 `run:android`；设备命令留到 CP-7 本地闭合后的单次 Android 模拟器验收，且不进入
任何 verify 入口或设备自动化基建。

CP-5 安装使用 Dexter 已授权的进程级 age-gate 覆盖；先按同一 latest/template 版本键重新核对集合 A/B 证据，
随后用正常 Yarn 安装生成当前 manifests 所需的 lockfile，最后原样复跑 immutable 安装作为闭包证明：

```sh
YARN_NPM_MINIMAL_AGE_GATE=0 YARN_NODE_LINKER=node-modules yarn install --mode=skip-build
YARN_NPM_MINIMAL_AGE_GATE=0 YARN_NODE_LINKER=node-modules yarn install --immutable --mode=skip-build
```

两条命令的 age-gate 覆盖均为进程级且不落盘。若 latest/template 已滚动，先同步同一证据单元中的 manifest 与版本，
再生成 lock；不得用旧 lock、离线诊断或替代 package manager 冒充 CP-5 成功。

若 `expo export` 或 CP-7 `expo run:android` 失败，先在 scratch 副本移除 assembly 的 `type: module` 与
`exports` 两项复跑，以区分规范化引入的问题和布局固有问题；该诊断只在 scratch 进行，不修改正式树，
完成分离后再进入 autolinking 排查。

### 8.1 assembly 最终结构

```text
package.json
app.json
assets/
tsconfig.json
index.ts
App.tsx
src/index.ts
src/moduleName.ts
src/dependencies.ts
src/skeletonBootstrap.ts
```

脚手架产生的 package-local `LICENSE` 必须删除，与 adapter 的规则一致；最终树中不得出现该文件。

`src/index.ts` 是 assembly package root；top-level `index.ts` 是 Expo entry。App 静态 import
`./src/skeletonBootstrap.ts`；bootstrap 用本地 `./index` import assembly root，并通过 13 个真实 npm
package root import 收集其余 moduleName。App 以 `<Text>` 列表消费 14 值，禁止只 `void` 或 type-only 引用。
assembly 的 `package.json.dependencies` 与 `src/dependencies.ts` 同时声明/import 这 13 个 package root；
三处 exact-set 必须相同，不能为 bootstrap 建依赖门豁免。

### 8.2 CP-5 证明

- 静态 AST 从真实 `index.ts → App.tsx → skeletonBootstrap.ts` 解析入口链，且 bootstrap 的本地 `./index` 加 13 个
  runtime workspace root exact-set=14；删任一 bootstrap import 或 App→bootstrap 边时图门红；
- assembly 正式依赖声明与 `dependencies.ts` import exact-set=批一其余 13 包；
- assembly 自身只有 bootstrap 到 `./index` 的本地 root import，无 npm self-import，也不计为依赖边；
- `yarn workspace @catering-v2s/assembly-android-pos-desktop typecheck` 通过；
- 在 assembly 包执行 `npx expo export --platform android`；保存 bundle module count、exit、耗时；
- 只报告 Metro 可打包入口可达集合，不报告 Gradle/autolinking/启动；后者留到 CP-7 的一次性设备验收。

完成 CP-5 三维对账再接总门。

## 9 · CP-6：六道门与两条验证入口

### 9.1 工具职责

| 文件 | 职责 | 不做什么 |
|---|---|---|
| `tools/terminal-skeleton/graph-model.mjs` | 用 TypeScript AST 与 JSON 派生 spec/current graph、workspace census、source imports、App reachability | 不改源码，不维护第二份包表 |
| `check-static.mjs` | 对真实树运行六道规则门，并单列第七项 `scaffold hygiene` 文件检查 | 不把 hygiene 计为 TER 规则门；不编译、不打包 |
| `check-static.test.mjs` | 复制必要树到 mktemp，逐门单一变异；另做 hygiene 的 nested-metadata/missing-ignore 反例；真实树作绿控制 | 不在仓内改红夹具 |
| `verify-static.mjs` | 先 focused gate tests，再真实树；成功尾部 marker | 不跑 typecheck/export |
| `verify.mjs` | static → Turbo dry task exact-set → typecheck → Expo export；清理本次 export 的 `.expo/` 与 `dist/` 后成功尾部 marker | 不跑 Gradle/DEV/L2；不删除预先存在的 export 产物 |
| `verify.test.mjs` | 用受控失败的子进程验证 `verify` 首败输出且不打印 full PASS marker | 不替代真实 `verify`，不执行设备/仓级 runtime |

### 9.2 六门红变异

1. 图比对：改 package.json 一边；另删 bootstrap 一个 import；
2. 三重命名：改 moduleName；
3. 依赖方向：kernel 加 UI 边；adapter 加 contracts 边；
4. 声明完整：源码 import 未声明 workspace root；
5. TR-01：在白名单外加 `dispatchAction`；
6. kernel 零 React：分别加 React manifest 依赖和源码 import。

每个变异只允许对应 gate 失败；真实树在同一次入口里必须绿。图算法另外拒绝 cycle/self-edge、孤儿、
deep import、未入 workspace package 和 workspace 中多余 package。

第七项文件检查单独输出 `SCAFFOLD_HYGIENE=PASS|FAIL`，机械检查：按当前投影从 skeleton graph 派生每个
adapter/assembly package leaf 的真实根目录，在这些根内检查无 nested `.git`、agent 文件、局部 lint/prettier
与 package-local `LICENSE`；根 `.gitignore` 含 CP-1 列出的 9 类规则。
测试副本分别加入一项 nested metadata、删除一项必需 ignore，必须转红。汇总固定打印
`RULE_GATES=6` 与 `SUPPORT_CHECKS=1`，不得写成“七道 TER 规则门”。

### 9.3 marker 契约

- `verify:static` 只有六道规则门与 hygiene 的正负控制和真实树都绿后打印 `TERMINAL_STATIC=PASS`；
- `verify` 复用 static，只有 dry-run、typecheck、export 全绿且本次 export 产物 cleanup 通过后打印 `TERMINAL_VERIFY=PASS`；
- `verify` 启动前若 assembly 已有 `.expo/` 或 `dist/`，必须 fail closed；本次运行拥有的两条精确路径无论 export 成功或失败都清理，cleanup 失败时不打印 full PASS marker；
- 子步骤失败时 exit 非 0，打印唯一首败 label，不打印本入口 PASS marker；
- `verify` 内部已成功的 static marker 可以存在，但不得出现 `TERMINAL_VERIFY=PASS`；
- focused 子进程测试覆盖“失败却打印 marker”的反例。

### 9.4 CP-6 只闭合 TER 本地入口

CP-6 不修改 `tools/verify-gates/verify.mjs`，避免半成品 TER 提前进入仓级 static 分母。新鲜运行：

```sh
yarn workspace @catering-v2s/terminal run verify:static
yarn workspace @catering-v2s/terminal run verify
```

第二条是 TER 独立全验证。CP-6 只记录这两条入口的 marker、首败与时长；仓级接线推迟到 CP-7 本地验收
全部绿以后。

完成 CP-6 三维对账后，进入整批对账而非直接宣告完成。

## 10 · CP-7：批一整体对账、设备验收与批二判断点

### 10.1 整体对账（批一历史步骤）

fresh 独立 subagent 重开需求、详设、三条 TER memory、批一 14 个真实 package root、所有工具与 fresh 输出，
重新比较：路径/名字、包数、batch、plannedKind、依赖类别、入口集合、marker、证据档位和明确不做。
这不是 CP review 汇总。任何 `OPEN` 由主 agent 修复，再由新的 fresh reviewer 定向复核。

### 10.1a 一次性 Android 模拟器验收

只有下方本地闭合表中的 workspace/static/Turbo/typecheck/reachability/Metro/full/hygiene 全部通过后，
才在 assembly 目录执行一次：

```sh
npx expo run:android
```

该命令只使用本机已有 Android 模拟器；单独记录开始/结束时间、Gradle 构建结果、adapter autolinking、
应用启动日志、`adb devices -l` 身份、屏幕截图以及 14 个 moduleName 的可见文本，证据落在
   `doc/evidence/platform/terminal-skeleton/batch-1/cp7-android-device-codex.md`（CP-7 设备附录，不并入 CP-5 assembly 结构证据）。除开始/结束时间、adb 设备身份、Gradle 结果、应用启动日志、截图与 14 个 moduleName 外，必须固定记录：autolinking 生成结果的来源路径、生成结果原始片段、`com.catering.v2s.terminal.adapter.android.persistkv.TerminalPersistKvModule` 断言、生成前/后树、由本次命令拥有的路径与清理后最终树。若命令自动生成 assembly 的
   `android/` 或其他 build 产物，先把生成事实写入证据，验收后只清理本次命令拥有的生成物并复核 hygiene；
不得删除 CP-4 adapter 的 `android/` source。设备步骤不进入 `verify`，不建立设备自动化基建，不运行真机。
失败要保留首败并停止在 CP-7；成功只能升级 Gradle/autolinking/启动/bootstrap 渲染边界，不能升级为
Kotlin 能力或任何业务行为可用。

### 10.2 批一 TER 本地验收命令与判据（历史分母）

| 检查 | 命令/来源 | 必须观察 |
|---|---|---|
| workspace | `yarn workspaces list --json` + filesystem census | 批一阶段 TER child package exact 14；无 nested package |
| static | TER `verify:static` | 六门 + 单列 hygiene 的 green/red controls；唯一 PASS marker；秒级 |
| Turbo tasks | 四个同名 task + 固定 filters 的 `--dry=json` | 批一历史为 typecheck=14、test=adapter 1、lint=0、clean=0；最终分母见 CP-8；四者均零 frontend/library/聚合包且无递归 |
| typecheck | `turbo run typecheck --filter='./apps/terminal/**' --filter='!@catering-v2s/terminal'` | 批一历史 task exact-set=14 且全部 exit 0；最终 22/22 见 CP-8 |
| reachability | graph gate | App reachable root exact 14 |
| Metro | assembly `expo export --platform android` | exit 0，范围仅入口可达集合 |
| full | TER `verify` | `TERMINAL_VERIFY=PASS` 仅末尾出现；记录总时长 |
| device | CP-7 一次性人工验收：assembly 内 `npx expo run:android`；证据落在 `doc/evidence/platform/terminal-skeleton/batch-1/cp7-android-device-codex.md` | Android 模拟器上 Gradle 构建成功；autolinking 生成结果含 `com.catering.v2s.terminal.adapter.android.persistkv.TerminalPersistKvModule`；应用启动；屏上出现 14 个 moduleName；单独计时，保存 adb 设备身份、启动日志、截图、生成结果路径与前后树，并清理本次生成物；不进入 `verify` |
| scaffold hygiene | `check-static.mjs` 的第七项文件检查 | 无 nested git/agent/config/LICENSE；ignore 覆盖完整；不改变六道门计数 |

本表全部绿之前，仓级 verifier 中不得出现任何 `terminal-*` tuple。

### 10.3 最后一步：仓级接线

只有 §10.1 全部 `MATCHED` 且 §10.2 全绿后，才执行以下写入：

- `tools/verify-gates/verify.mjs` 的 `staticCommands` 追加唯一 `terminal-static` tuple，并声明
  `TERMINAL_STATIC=PASS` marker；
- `runtimeCommands` 追加唯一 `terminal-verify` 三元组（省略 `remote`，即默认 false）；
- 六道规则门与 hygiene 都不逐项摊进仓级表；
- 同步更新 `scripts/test/standards-enforcement-verify.test.mjs` 与
  `scripts/test/standards-enforcement-execution-catalog.test.mjs`，静态断言两个 tuple 的分类、参数与 marker。

写入后可运行 focused catalog tests；但本轮 Dexter 已明确要求 TER-only 验证，因此不执行仓级：

```sh
scripts/verify --validate-only  # 本轮未执行：不属于 TER-only 授权
```

若未来取得仓级验证授权，才需要看到仓级 runner 实际调用 `terminal-static` 并检到 marker。不得运行仓级
normal `scripts/verify`：它含本批未授权的远端/既有 runtime commands。当前 `terminal-verify` 的真实行为
由 CP-8 的 TER 本地 `verify` 证明；本轮不把仓级 validate-only 的未执行状态伪装成通过。

### 10.4 必须保留的未证明边界

- Android Gradle/autolinking/应用启动/bootstrap 渲染：批一 CP-7 已有 14 包投影证据；批二新增四个 adapter 未重复设备运行，不能扩展该证明；
- Kotlin 能力仍未实现、未测试，仍为 `UNVERIFIED`；
- adapter native bridge 能力未实现；
- 没有 command、slice、port、持久化、双屏或自动化行为；
- 没有真机、浏览器、DEV、seed、L2、UAT 或部署证据；
- 批二新增 8 包已实施；真实 22 包 typecheck/Metro 已由 CP-8 TER-only verify 证明；
- `plannedKind` 没有转成 `kind`，owner/toolkit 归属尚未生效。

### 10.5 批二判断点

批一的 10.1/10.2 已闭合，批二按 Dexter 授权完成 CP-8 并由独立全范围对账确认后，形成：

```text
BATCH1_SKELETON=PASS
BATCH2_SKELETON=PASS
FINAL_TER_PACKAGE_COUNT=22
BATCH2_AUTHORIZED=true
```

批二不会由脚本自动开启；本轮已获 Dexter 直接授权并完成。若后续新增包暴露模板、依赖解析、Turbo filter
或 Metro 结构偏差，仍须先修改需求/详设并完成独立复核，不得边复制边修形态。

## 11 · 每步可验证产出清单

| CP | 最小产出 | 可失败证据 |
|---|---|---|
| 0 | latest official scaffold command/resolved versions/tree/exit/cleanup | 隐式 fallback red；显式 latest source green |
| 1 | root workspace/Turbo/spec/aggregator | census mismatch、frontend task 或 recursion red |
| 2 | 7 kernel roots | 每包 typecheck；React/Expo 两类 red |
| 3 | 5 UI roots及 devDep | 每包 typecheck；类别/方向漂移 red |
| 4 | 1 normalized adapter | raw-vs-final 清单；extra workspace/native guess red |
| 5 | assembly + 14 reachable roots | missing import red；Expo export green |
| 6 | 6 rule gates + 1 hygiene check + 2 TER markers；仓级零 tuple | 每门 mutation red；hygiene 反例 red；marker failure red |
| 7 | batch1 local evidence + one-time emulator acceptance + final root tuples + validate-only + review | 本地或设备未全绿即出现 tuple red；任一 OPEN/UNVERIFIED 升级即 NO-GO |
| 8 | batch2 8 roots + final 22-package graph/bootstrap + TER-only verify + scaffold rerun/cleanup | 22 census、exact-set、typecheck、Metro、hygiene 或 cleanup 任一失败即不收口 |

## 12 · 实施中不得猜的事项

1. `create-expo-module` 隐式 template 解析：已证会 fallback；必须解析并显式传入当时 latest 官方 source，记录精确版本；
2. Turbo directory filter 是否含聚合 workspace：必须 dry-run 读真实 task list；
3. UI 版本源：必须记录 latest app 原始 manifest、Expo CLI 解析结果与进程级 age-gate 覆盖，不抄需求快照；
4. scaffold scripts/内部 helper 的依赖：先从原始 package.json 与 script 调用链核对再删；
5. assembly 自身可达性：bootstrap 用本地 `./index` package root，不做 npm self-import；
6. Android Gradle/autolinking：只由 CP-7 一次性模拟器 `expo run:android` 证明，不用 Metro 成功替代；
7. Kotlin 能力：本批无能力实现；即使设备运行通过，也保持 `UNVERIFIED`；
8. 任何需求/模板不一致：停下并回报，不凭“常见 Expo 项目”补目录。
9. 重新解析的 latest 无法与 owning source 的 latest 优先策略同时满足，或需要未获裁决的供应链/版本策略：
   停止并回报，不用旧快照或手工 pin 掩盖。

## 13 · 设计评审与实施入口

内部 DESIGN review 两轮已封盘；Claude CP-5 `IMPLEMENTATION GO` 与 Dexter 最新授权共同允许批一完成后直接继续批二。
CP-7 一次性 Android 模拟器验收已单独授权，不改变其余边界。

## 14 · 批二实施最终收口（2026-08-29）

批二 8 个叶子已经落地，最终 TER workspace 为 22 个叶子。逐包 typecheck、静态规则与 hygiene、
Turbo dry-run、Expo export、marker failure control 和官方 adapter scaffold 重跑的完整证据见
`doc/evidence/platform/terminal-skeleton/batch-2/cp8-batch2-skeleton-codex.md`。

```text
BATCH1_SKELETON=PASS
BATCH2_SKELETON=PASS
FINAL_TER_PACKAGE_COUNT=22
FINAL_TER_TYPECHECK=22_OF_22_PASS
FINAL_TER_METRO=PASS_647_MODULES
TER_VERIFY=PASS_20_SECONDS
TER_VERIFY_CLEANUP=PASS
TER_ROOT_VERIFY=NOT_RUN_BY_DEXTER_TER_ONLY_AUTHORIZATION
```

本轮只运行 `yarn workspace @catering-v2s/terminal run verify` 及其 TER-local focused checks，
没有运行仓级 `scripts/verify`（normal 或 `--validate-only`）。仓级 tuple 的源码形状仍由实现保留，
但不把未执行的 root runner 写成证据。批一 CP-7 的一次性模拟器记录仍只覆盖 14 包投影；CP-8
没有重复设备运行，因此四个新增 adapter 的 Gradle/autolinking/启动、Kotlin 能力和所有业务能力继续
保持未证明/未授权。
