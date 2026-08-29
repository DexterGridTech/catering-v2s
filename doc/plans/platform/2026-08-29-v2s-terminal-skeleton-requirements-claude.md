# TER 骨架建设 · 需求文档

| 字段 | 值 |
|---|---|
| 交付单元 | **TER（`apps/terminal`）的工程骨架** |
| 性质 | 需求文档。详设与实施由 Codex 承担 |
| 范围 | **仅骨架**：目录、包、包名、依赖、配置、可验证的依赖链。**不含任何包的能力实现** |
| 规范正本 | `doc/platform/terminal-coding-standard.md` |
| 技术裁定（`T-1`…`T-13`） | `doc/review/platform/2026-08-28-newposv1-package-analysis-claude/00-ter-build-order-claude.md` ⚠️ 其中**批次划分与完成标准两节已被 2026-08-29 裁决取代**（该文件内已标注）；以本文 §6.2 与 §9 为准 |
| POC 台账 | `doc/review/platform/2026-08-27-v2s-terminal-poc-findings-ledger-claude.md` |

---

## 1 · 背景与边界

TER 是 `catering-v2s` 仓内的终端产品工程，面向商场 / 餐饮 POS 终端：多屏、多机、
在线主数据、热更新、运维自动化、与后台联动。设计输入是已完成的 POC `newPOSv1`
（仓外只读 Heritage，33 个工作区包），**不是复制粘贴，是按分析结论的重构**。

**本批只建地基（业务无关的包），按依赖关系建。** TCP / TDP / 权益 / 主数据 / 业务 UI
不创建 —— 它们编码的是协议与业务，对手方尚未定义，现在建等于猜。

**本批不做任何包的能力实现。** 包框架、包名、依赖关系、测试脚本要建好并能验证；
包内可以是空的。骨架立住之后，再一个包一个包细化。

---

## 2 · 环境与账号

### 2.1 装 Expo Skills，不装 Expo MCP

**Dexter 已在本机完成全局安装，本批不要重新安装。**

**preflight（只读）**：确认全局 skills 可见：

```sh
npx skills list --global --json
```

应能看到来源为 `expo/skills` 的条目。**看不到时才需要人工前置安装**
（`npx skills add expo/skills`）—— 那是环境缺失时的补救，不是本批的正常步骤。

**为什么用 skill**：它是本地指令文件，装完就在本机，不登录不联网，
且知道当前 SDK 下 NativeWind / RNR / Reanimated 的正确接线 —— 这几样手接最容易错。

**为什么不装 MCP**：Expo MCP 是远端托管服务（`https://mcp.expo.dev/mcp`），
**必须 OAuth 登录，无自托管模式，而 Dexter 没有 Expo 账号**。
它唯一不可替代的能力（按 `testID` 寻址 UI 元素）是 `ui.base.automation` 的职责，
本来就要自己交付。

⚠️ **不要用 `codex plugin add expo@openai-curated`** —— 它会顺带注册 MCP。skills CLI 只装 skill。

⚠️ skill 是开发便利，**不得进入任何 TER 包的 `dependencies`**。

### 2.2 本批全程不需要 Expo 账号

| 命令 | 账号 | 证据档位 |
|---|---|---|
| `npx create-expo-app@latest` | 否 | **已实测**（无 `~/.expo` 的机器上跑通，只生成匿名遥测 id） |
| `npx create-expo-module@latest` | **`UNVERIFIED`** | 两台机器均未取得成功退出码（§8.1 阻断项）；**不得借用没有成功闭包的运行来证明"不需要账号"** |
| `npx expo install` / `start` / `prebuild` / `run:android` | 否 | **推论**（均为本地命令），未逐条实测 |
| `eas build` / `eas submit` / EAS Workflows | **是** | 本批不使用 |

⚠️ **Android 构建走本地 Gradle，不走 EAS Build。**
Codex 不得引入任何需要登录的命令；某步若绕不开账号，**停下来说明**。

---

## 3 · 版本基线

⚠️ **脚手架与模板一律用 `latest`，不固定到旧版**（Dexter 2026-08-29 裁定）。
**下表是 `latest` 在 2026-08-29 的快照，不是要手写钉死的值** ——
以实施当时 `latest` 的实际解析结果为准，与下表不符时**以实际为准并说明**。

**为什么不固定**：实测 `create-expo-app@latest --template blank-typescript` 直接产出
`expo ~57.0.18` / `react-native 0.86.3`，**逐项等于下表**；
而固定到某个较旧的 template（如 `expo-template-blank-typescript@57.0.18`）产出的是
`~57.0.16` / `0.86.2`，反而要再加一道"规范化到目标版本"的步骤 ——
那是自造的缺口，每一步规范化都是新的出错面。

| 包 | 2026-08-29 的 `latest` 快照 |
|---|---|
| `expo` | `~57.0.18` |
| `react-native` | **`0.86.3`** |
| `react` / `react-dom` | `19.2.3` |
| `react-native-web` | `~0.21.0` |
| `react-native-reanimated` | `4.5.1` |
| `react-native-worklets` | `0.10.x` |
| `typescript` | `~6.0.3` |
| `@types/react` | `~19.2.2` |
| `vitest` | **`4.1.10`** |
| `turbo` | `2.10.12` |
| Yarn | `4.17.0` |
| Node | `>= 22` |

⚠️ **本批不写任何测试**（§9.2：每包的独立验证由 `typecheck` 承担），
所以本批**不引入 vitest**。上表钉 `4.1.10` 是给**将来**用的口径 ——
跟 v2s 主仓一致，不要照抄 POC 的 `3.2.4`，一个仓不该有两个 vitest 真相。
（`vitest.workspace.ts` 自 Vitest 3.2 起已废弃，届时用 `vitest.config.ts` 的 `test.projects`。）

**为什么快照里 RN 是 0.86.3 而不是 0.87**：SDK 57 的官方模板就锁在 0.86.3，
且 `react-native-reanimated@4.5.1` 的 peer 是 `"0.83 - 0.86"`，而 Reanimated 已裁定采纳（`T-12`）。
RN 0.87 需要 SDK 58。**这不是我们手工钉的，是 `latest` 自己的值。**

⚠️ **动工前重新验证 npm age gate（外部时效事实，`UNVERIFIED`）。**
当前机器 Yarn 4.17.0 的默认 `npmMinimalAgeGate=1440`，
直接安装会得到 `YN0016: expo@npm:~57.0.18: All versions satisfying "~57.0.18" are quarantined`。
**本文不写任何绕过方式** —— 供应链保护的取舍归 Dexter；
实施前请重新验证当时的实际情况并回报。

⚠️ **`npx expo install` 只在装了 `expo` 的包里可用。**
它会先读本包的 Expo SDK 版本，**包内没有 `expo` 就直接报错退出**
（`Cannot determine the project's Expo SDK version because the module 'expo' is not installed'`）。

⇒ 分工：
- **`ui/**` · `adapter/**` · `assembly/**`**：走 `npx expo install`，不手写版本；
- **`kernel/**`（9 个，零 Expo）**：`expo install` 用不了，**按本表手写版本**。
  这不违反上一条 —— 它们本来就不装任何 Expo/RN 依赖。

---

## 4 · 目录结构与命名

```text
apps/terminal/
  package.json                      ← TER 聚合入口（§5.2，现有占位文件直接覆盖）
  skeleton-graph.ts                 ← 依赖图的唯一真相（§9.1）
  tsconfig.base.json

  kernel/base/
    contracts/                      kernel.base.contracts
    platform-ports/                 kernel.base.platform-ports
    state/                          kernel.base.state
    runtime/                        kernel.base.runtime
    transport/                      kernel.base.transport
    display-context/                kernel.base.display-context
    workflow/                       kernel.base.workflow
    ui-state/                       kernel.base.ui-state
    test-support/                   kernel.base.test-support
  kernel/feature/                   ← 空目录 + README

  ui/base/
    render/                         ui.base.render
    automation/                     ui.base.automation
    primitives/                     ui.base.primitives
    input/                          ui.base.input
    admin-shell/                    ui.base.admin-shell
    test-support/                   ui.base.test-support
  ui/feature/                       ← 空目录 + README
  ui/integration/
    platform-console/               ui.integration.platform-console

  adapter/android/
    persist-kv/                     adapter.android.persist-kv
    device/                         adapter.android.device
    app-control/                    adapter.android.app-control
    logger/                         adapter.android.logger
    dual-screen/                    adapter.android.dual-screen
  adapter/electron/                 ← 空目录 + README

  assembly/android/
    pos-desktop/                    assembly.android.pos-desktop
  assembly/electron/                ← 空目录 + README
```

⚠️ **`turbo.json` 不在这里，在 v2s 仓根** —— turbo 要求配置位于 workspace 根（§5.3）。

### 4.1 三重命名（强制）

```
目录路径     kernel/base/contracts
moduleName   kernel.base.contracts                  ← 路径用「.」连接
npm 包名     @catering-v2s/kernel-base-contracts    ← moduleName 用「-」连接 + scope
```

三者必须互相可推导。包名**禁止**出现版本号（`-v2`）与框架名（`rn84`）——
**理由**：版本与框架会变，包名不该跟着变；POC 33 个包里 11 个栽在这里。

### 4.2 三条易错点

1. **`ui-state` 属于 `kernel/base`，不是 `ui/`。**
   它是 screen / overlay / uiVariable 的 **React-free 状态协议**，渲染在 `ui/base/render`。
2. **`ui/integration` 不是测试包，是真实的 UI 与业务整合层。**
   "能在 Expo Web 上跑"是加在它身上的约束，不是它的目的。它**不得依赖 `adapter/**`**。
3. **`adapter/android` 与 `assembly/android` 是平台目录，不是包**，包在下面再一层。
   **理由**：一个平台下会有多个兄弟组装包（`pos-desktop` / 将来的 `pos-handheld` / `kds`），
   平台目录这一级就是给它们留的位置。全仓统一 `<层>/<分类>/<包>` 三级，无例外。

### 4.3 空目录

`kernel/feature` · `ui/feature` · `adapter/electron` · `assembly/electron` 各放一份
`README.md` 写明边界（本阶段不提供 runtime / 能力实现 / 构建产物）。

⛔ **空目录里不得放"将来可能用得上"的代码。**

---

## 5 · 根配置

### 5.1 v2s 仓根 workspaces 扩展

TER 的所有包必须被 Yarn 4 识别为工作区成员。**不新建第二个 workspace 根**
（Yarn 不支持嵌套 workspace root）。

⚠️ **两条事实先说清，免得防错方向**（Yarn 4.17.0 实测）：
① Yarn 只把**含 `package.json` 的目录**当工作区成员 —— `kernel/feature` 这类空目录自动忽略；
② `adapter/android/*` 这样的**单段通配吸不到 `adapter/android/<pkg>/example/`**，
   因为 `*` 只匹配一层路径段。

⇒ **在 §4 的三级布局下，逐层通配是安全的。**
真正要防的是**深度通配**（如 `apps/terminal/**`），它会把 `example/` 吸进来。

**判据**：`yarn workspaces list --json` 的输出，**过滤 `apps/terminal/` 前缀后
恰好等于当前批次分母** —— 批 1 = 14，批 2 完成后 = 22。
⚠️ 未过滤的输出包含仓根与既有三个前端包，**不可能**等于 14 或 22。

### 5.2 `apps/terminal/package.json`

现有的 `apps/terminal/package.json`（`name: "nextpos"`）是 Dexter 早先放的**占位文件**，
**直接整份覆盖即可**，不必保留其中任何字段。

TER 的**聚合入口**，不是 workspace 根。

- `name`: `@catering-v2s/terminal`，`private: true`，**去掉 `version` 与 `description`**
- **不含任何运行时 `dependencies`** —— 依赖属于各包自己
- `scripts` 提供 `typecheck` / `test` / `lint` / `clean`，经 turbo 过滤到 TER 的包

⚠️ **脚本名用 `typecheck`（一个词），与 v2s 主仓一致** —— 主仓
`libraries/frontend/admin-ui-foundation` 与 `apps/frontend/*` 都是这个名字。

⚠️ **库包不提供 `build`。** 主仓的 `admin-ui-foundation` 就没有 ——
它的 `exports` 直指 `./src/*.ts`，没有产物要生成。
TER 的 kernel / ui / adapter 同理。**只有 `assembly`（是个 app）才有 `build`。**

⚠️ **lint 复用仓根的 `eslint.config.mjs`，不新建第二套。**
仓根已有 `eslint@9.39.5` · `eslint-plugin-react-hooks@7.0.1` · `prettier@3.9.6`。
TER 需要的额外规则以 flat config 的形式**追加到仓根配置**，
`react-hooks` 从第一天就设 `error`（§11）。
⚠️ 脚手架会生成自己的 `eslint.config.cjs` / `.prettierrc`（§8.1）——**删掉，改为继承仓根**。

### 5.3 turbo（`T-13`）

**`turbo.json` 放 v2s 仓根**（turbo 要求配置位于 workspace 根），
任务覆盖 `typecheck` / `test` / `lint` / `clean`（`build` 只有 assembly 有）；
`typecheck` 声明 `dependsOn: ["^typecheck"]`；
**TER 的任务必须能被过滤器单独跑，不牵动 `apps/frontend/*`。**

**为什么现在就引**：turbo 是**底座的一部分**（Dexter 裁定）。
底座是别的东西都压在上面的那层 —— 编排器既然最终要用 turbo，
就该从第 1 个包开始在，而不是等 22 个包建完再回填 22 份脚本约定。

⚠️ **turbo 与 `scripts/verify` 是两个不同的东西。**
turbo 编排**包级任务**；`tools/verify-gates/verify.mjs` 跑**门**。

**TER 提供两条命令，分别对应仓级 verifier 的两档语义。**

⚠️ **不能用"一条总入口"抹掉这两档。** `tools/verify-gates/verify.mjs` 的实际行为是：
`runStatic` 在**两种模式下都会跑**并强制检查 marker；`--validate-only` 在静态之后即返回；
`runtimeCommands` **只在 normal 模式跑，且不检查 marker**。
把"静态门 + typecheck + export"的总入口塞进 `staticCommands`，
会让 `--validate-only` 去跑 typecheck 与打包，破坏 static-only 语义；
塞进 `runtimeCommands`，TER 的静态门就进不了 `--validate-only`，marker 也无人检查。

- **`verify:static`** —— **只**跑 §10 的六道文件门；进仓级 `staticCommands`；
  全绿才打印 `TERMINAL_STATIC=PASS`。
- **`verify`** —— 先复用 `verify:static`，再跑
  `turbo run typecheck --filter='./apps/terminal/**'`，再跑 assembly 的 `expo export`；
  进仓级 `runtimeCommands`；全绿才打印 `TERMINAL_VERIFY=PASS`。

⚠️ 两条都必须**失败时不打印 marker** —— 无条件打印 marker 的检查是假绿。
⚠️ 六道门**不逐条摊进** `verify.mjs` 的表，仓级只各挂一个条目。
⚠️ TER 的任务不得触发 `apps/frontend/*` 的任何任务。

### 5.4 git 与 ignore

**TER 的代码由 v2s 仓统一管理，不允许任何嵌套 git 仓库。**
脚手架产生的 `.git/` 一律删除（§8.1）。

**ignore 必须覆盖 RN / Expo / Android 的产物**，仓根现有 `.gitignore` 只有
`node_modules/` · `build/` · `dist/` · `coverage/` · `*.log`，**不够**。
至少要补上：

```
.expo/                      # Expo 本地状态
.turbo/                     # turbo 缓存
android/build/              # Gradle 产物
android/app/build/
android/.gradle/
*.apk  *.aab  *.keystore    # 构建产物与签名文件
.kotlin/
```

⚠️ **签名文件绝不能进 git。**
⚠️ 逐包创建后立即比对新产物与忽略规则 —— 不要等 22 个包建完再补。
⚠️ 这是**文件系统层面的机械检查**（§12.2 判据 8/9）；
仓库控制动作与仓库状态**不是本批的完成条件**。

### 5.5 TypeScript

`apps/terminal/tsconfig.base.json` 作为各包 `tsconfig.json` 的 `extends` 基底；
`strict` · `isolatedModules` · `moduleResolution: bundler`；
**每个包一个 `tsconfig.json`**，`typecheck` 可逐包独立运行。

---

## 6 · 包清单与依赖

### 6.1 依赖表（**最终形态**；分批见 §6.2）

⚠️ 下表是**两批完成后**的最终图。批 1 只含 §6.2 列出的 14 个包，
其**边也相应收窄**（例如批 1 的 `integration` 不依赖 `input`/`admin-shell`，
批 1 的 `assembly` 不依赖 `transport`/`workflow` —— 它们在批 2）。

⚠️ **骨架期各包声明 `plannedKind`，不声明 `kind`。**
`TR-09` 要求 `owner` 必须真拥有至少一个 slice，而本批不做任何能力实现 ——
造占位 slice 去满足门，就是让包**声称**自己已是 owner 而它不是。
规范正本已建立骨架阶段例外（`doc/platform/terminal-coding-standard.md` 的
`TR-09` · 骨架阶段例外）：`kind` 门只对声明了 `kind` 的包生效，
包落下第一个真实 slice 时 `plannedKind` 转正。

⚠️ **`plannedKind` 只写在 `skeleton-graph.ts` 里，包内不复制。**
骨架期的包还没有 `application/moduleManifest.ts`；往包里再塞一份就是第二处会漂移的陈述。
下表是规格文件的可读渲染。

⚠️ `plannedKind` 是**设计意图**，不是已达成状态 —— 不得表述成"owner/toolkit 划分已生效"。

| 包 | 工作区内依赖 | `plannedKind` |
|---|---|---|
| `kernel.base.contracts` | 无 | toolkit |
| `kernel.base.platform-ports` | contracts | toolkit |
| `kernel.base.state` | contracts · platform-ports | toolkit |
| `kernel.base.runtime` | contracts · platform-ports · state | owner |
| `kernel.base.transport` | contracts · platform-ports · state · runtime | owner |
| `kernel.base.display-context` | contracts · state · runtime | owner |
| `kernel.base.workflow` | contracts · platform-ports · state · runtime | owner |
| `kernel.base.ui-state` | contracts · platform-ports · state · runtime · display-context | owner |
| `kernel.base.test-support` | *(dev)* contracts · platform-ports · state · runtime | toolkit |
| `ui.base.render` | platform-ports · runtime · ui-state | toolkit |
| `ui.base.automation` | platform-ports · runtime · ui-state | owner |
| `ui.base.primitives` | automation | toolkit |
| `ui.base.input` | platform-ports · runtime · state · render · primitives | owner |
| `ui.base.admin-shell` | platform-ports · runtime · state · render · primitives · ui-state | owner |
| `ui.base.test-support` | *(dev)* render · automation · kernel.base.test-support | toolkit |
| `ui.integration.platform-console` | contracts · platform-ports · state · runtime · display-context · ui-state · render · automation · primitives · input · admin-shell ／ *(dev)* ui.base.test-support | toolkit |
| `adapter.android.*`（5 个） | platform-ports | toolkit |
| `assembly.android.pos-desktop` | **同批次其余全部节点**（批 1 = 13 条，批 2 = 21 条） | toolkit |

⚠️ **`assembly` 依赖同批次的每一个包，不是只依赖它"装配"的那几个。**

**为什么**：assembly 的 `skeletonBootstrap.ts` 必须 import 当前批次的每一个包
（§9.2 第 3 条 —— 否则入口可达集合不等于批次包集合，Metro 就没真消费它们）。
源码 import 了就必须声明（§10 的依赖声明完整门），所以声明边**必然**是批次全集。
把规格边写成更小的子集，会让"声明完整门"与"入口可达断言"**互斥**，两者不可能同时绿。

⇒ 这条同时消掉了原先"assembly 必须直接依赖 transport 与 workflow 否则成孤儿"的特例：
依赖全集之后，**孤儿在构造上不可能**。

⚠️ **`ui.base.render` 不依赖 `primitives`**，理由见 §7.1。

⚠️ **`test-support` 依赖谁，谁将来就不能 devDep 它。**
本批只有 `ui.base.test-support → kernel.base.test-support` 一条边，不成环；
但将来 kernel 各包要 devDep `kernel.base.test-support` 写测试时，
**只要它反过来依赖了那个包就成环，turbo 会直接拒绝**。
⚠️ **但本批 `test-support` 的依赖以上表为准，不得自行取"最小集合"** ——
去掉 `ui.base.test-support → kernel.base.test-support` 这条边，
`kernel.base.test-support` 立刻失联，闭包掉到 21，判据直接失败。
环的问题留到包级细化时连同 test-support 的真实形态一起解。

⚠️ **`adapter/**` 只依赖 `platform-ports`**，不反向依赖 kernel 其它包、不依赖任何 ui 包。

### 6.2 分两批建，**批 1 验收通过后才开批 2**

**为什么分批**：§5.1（workspaces 通配形态）、§8.1（脚手架产物如何落进本仓布局）
这些**结构性未知在第一个包身上就会暴露**。一次建 5 个 adapter，
等于把同一个未知的返工面放大 5 倍。

**判据**：**批 1 必须覆盖全部结构性未知；批 2 只做已验证形态的复制。**

#### 批 1 · 纵切片（14 个）

```text
contracts → platform-ports → state → runtime → display-context → ui-state
  → render → automation → primitives
  → kernel.base.test-support ／ ui.base.test-support
  → adapter/android/persist-kv        （create-expo-module 路径）
  → ui/integration/platform-console
  → assembly/android/pos-desktop      （create-expo-app 路径）
```

它覆盖的结构性未知：

| 未知 | 批 1 里的代表 |
|---|---|
| 四层俱全能否在本仓布局下跑通 | kernel 7 · ui 5 · adapter 1 · assembly 1 |
| `owner` 与 `toolkit` 两种包形态 | owner 4（runtime / display-context / ui-state / automation）· toolkit 10 |
| **devDep 边计入 `dependencies.ts` 与闭包**（本方案的关键约定） | **8 条 devDep 边** —— 两个 `test-support` 必须在批 1，否则这个机制一条都验不到 |
| `create-expo-module` 产物如何落进三级布局 | `adapter.android.persist-kv` |
| `create-expo-app` 产物如何落进三级布局 + Metro 解析 | `assembly.android.pos-desktop` |
| 手工建的两类（kernel 纯 TS / ui RN 库包） | 各有代表 |
| workspaces 通配形态、`.git` 清理、ignore 基线 | 全部在批 1 暴露 |

#### 批 2 · 复制已验证形态（8 个）

```text
transport · workflow                      （形态同 display-context）
input · admin-shell                       （形态同 automation）
adapter/android/{device,app-control,logger,dual-screen}   （形态同 persist-kv）
```

⚠️ 批 2 只在批 1 全部判据通过后开始。若批 1 暴露出与本文不符的结构问题，
**先改本文再开批 2**，不要一边复制一边改形态。

### 6.3 依赖必须声明完整

源码里每一个 `@catering-v2s/*` import，必须在本包 `package.json` 有对应声明。
**理由**：Yarn 的 hoist 会让未声明的包照样解析得到 —— POC 33 个包里 8 个栽在这里，
所以"能跑"不能证明"依赖声明对"。

### 6.4 外部依赖基线

| 层 | 允许 | 禁止 |
|---|---|---|
| `kernel/**` | 纯 TS 运行时库（`@reduxjs/toolkit` 等） | **`expo*` · `react-native*` · `react` · `react-dom`**（§10 有门） |
| `ui/**` | `react` · `react-native` · `react-native-web` · `expo` · NativeWind · RNR · Reanimated + Worklets | 原生模块（属 adapter 层） |
| `adapter/android/**` | expo-module 脚手架带的那套 + 各自原生依赖 | 任何 `@catering-v2s/*`，除 `platform-ports` |
| `assembly/android/pos-desktop` | expo app 脚手架带的那套 | —— |

⚠️ **kernel 零 React 是要守住的性质，不是"目前用不上"。**
它是 kernel 能在 node 里被直接验证的前提，也是将来能被 Electron / node 侧工具复用的前提。
一旦渗进去，退回来的成本极高。

⚠️ **`react` / `react-native` 在 `ui/**` 各包声明为 `peerDependencies`**，
由 assembly 或 web 入口提供唯一实例 —— 多副本 React 会在运行时炸。

---

## 7 · 职责边界

### 7.1 `render` / `primitives` / 组装层

| 包 | 定位 | **不得拥有的知识** |
|---|---|---|
| `kernel.base.ui-state` | overlay / screen 的状态协议 | React；任何外观 |
| `ui.base.render` | 宿主 + 注册表 + part 定义 API：按**类别**挑出该渲染的 overlay，按 key 解析组件 | **任何具体 part 的 key**；任何外观 |
| `ui.base.primitives` | 外观（NativeWind + RNR），纯展示，动作经 props 回调 | **直接**依赖 runtime；自己执行注册 |
| 组装层（integration / assembly） | 把 primitives 的组件注册成 part | —— |

⇒ **`render` 与 `primitives` 互不依赖**，由组装层拼起来。

⚠️ `primitives` 依赖 `automation`（组件要能被自动化寻址），而 `automation` 依赖 `runtime` ——
所以传递上够得到 runtime。**约束是"不直接依赖、不自己调"**，不是"传递不可达"。

**为什么是这个划分**：**真实场景中 alert 一定是自定义组件**，
所以渲染宿主不能持有任何具体外观 —— 它一旦知道"默认 alert 长什么样"，
自定义就变成了替换而不是注册。POC 在这里的具体缺陷见台账 `FIX-34` / `FIX-35`，
**包级精细化设计时再取用，本批不处理**。

⚠️ **fallback 的定位是「诊断兜底」，不是「可用外观」** ——
一个做得能看的默认 alert 会挤掉真正的注册，最后线上跑的是兜底件。

### 7.2 不建 `host-runtime` 中间层 —— **永久不建**

接线放在组装包（`pos-desktop`）里。

**为什么**：
1. **组装包的职责本来就是组装。** 把组装再往下抽一层，组装包的职责就空了。
2. **有第二个组装包也不抽。** 两个组装包装的东西本来就不同，这正是它们分开的原因，
   不构成重复。
3. **expo module 让组装更容易了。** POC 的 host 是裸 RN 时代的产物 ——
   那时 native 接线要手写才值得抽一层，autolinking 接管后这个理由消失。

⚠️ 第二个组装包出现时一定会有人提"抽个公共层"。
**判据不是"看起来重复"，而是"抽出去之后组装包还剩什么职责"** —— 答案是没有。

### 7.3 adapter 拆 5 个独立 expo module

**一个 module 只负责一个 native 功能**：
`persist-kv` · `device` · `app-control` · `logger` · `dual-screen`。

- 每个 module **自带**自己的接口定义、事件名、错误码，**不建共享包**；
- 每个 module **自带**自己的 Kotlin 测试 source set，只测自己那一个能力。

**为什么**：专注单一领域的实现与测试。POC 把九种能力放在一个 `adapter-lib` 里、
测试混在同一个 source set，加一个能力就动全量。

### 7.4 workflow 引擎属于底座，本批就建

`kernel.base.workflow`，**owner**（POC 有 3 个 slice：definitions / observations / queue）。

**为什么现在建**：它是底座的一部分，不是业务 —— 引擎本身不知道任何业务语义，
业务是它执行的**定义**。底座缺了它，后面每个用到编排的包都要各自造一遍。

**本批建什么**：包骨架与依赖，按 §9 验依赖链。引擎实现属包级细化。

⚠️ **`workflowRemoteDefinitionActor` 那条 actor 本批不建。**
**理由**：POC 里 workflow 只有它和 `moduleManifest` 依赖 `tdp-sync`（已逐文件核过），
而 tdp-sync 的协议对手方尚未定义。**引擎内核不需要这条边** ——
去掉它 workflow 照样成立，加回来也只是加一个 actor。

⚠️ **这不是限制远端下发脚本的能力。** 脚本源必须支持运行期从远端下发，
这是 workflow 存在的意义之一；本批只是没有承载它的传输层。

⚠️ POC 里 `scriptRuntime.ts` 与 `connectorRuntime.ts` 对 `platform-ports` 用的是
**`import type`**（编译期擦除，无运行时边），所以 POC 标成 devDep **不算错**。
TER 里仍标成 `dependency` —— **理由**：TER 的 workflow 引擎要**调用**端口执行任务，
不只是引用类型。

⚠️ **`import type` 是否算"import"，本文统一口径**：算。
§10 的「依赖声明完整」门与 §9.1 的 `dependencies.ts` 都把它计入，
`dependencies` 或 `devDependencies` 任一处有声明即满足。

**留给包级设计的一个待裁**：POC 用 `rxjs` 做进展观察（4 个文件）。
是否保留 Observable 这条路是台账 `FIX-23`，**本批不需要决定** —— 骨架里没有实现。

---

## 8 · 包的创建方式

### 8.1 `adapter/**` · `assembly/**` —— 走官方脚手架

`adapter/**` 与 `assembly/**` 涉及原生工程结构（Gradle、manifest、autolinking、
expo-module 配置），**必须由官方脚手架产出**：

| 层 | 命令 | 证据档位 |
|---|---|---|
| `adapter/android/*` | `npx create-expo-module@latest`（**非 local**） | ⚠️ **`UNVERIFIED`**，见下 |
| `assembly/android/pos-desktop` | `npx create-expo-app@latest <path> --template blank-typescript --no-agents-md --no-install` | 已实测（2026-08-29，exit 0） |

⚠️ **两条都用 `latest`，不要固定到具体版本**（§3）。
`--no-agents-md` 已实测有效（不再生成 `AGENTS.md` / `CLAUDE.md` / `.claude/`），
但 **`.git` 与 `LICENSE` 仍会生成**，按下面的清理表处理。

🔴 **`create-expo-module` 在两台机器上都未取得可复跑的成功闭包，这是实施阻断项。**

- Claude 侧（2026-08-29）：跑出了产物树，但进程超时转后台后被终止，**从未取得退出码**。
  此前文档写"已实测"是**过度声称，现予撤回**。
- Codex 侧（2026-08-29，Node v24.13.0 / Yarn 4.17.0 / npx 11.11.0，CLI 解析为 `57.0.1`）：
  默认 standalone 路径未找到 SDK 57 模板并回退 latest；example prebuild 到 CocoaPods 阶段
  以 `spawn pod ENOENT` 失败；`--no-example --platform android --package-manager yarn`
  路径同样未取得完整闭包。

⇒ **动工前先解决这一条**，产出：可复跑的精确命令、解析到的 CLI 版本、原始产物树、退出码，
以及从原始产物规范化为 TER 三级布局的**逐项规则**。
**在此之前不要开始建 adapter 包**；若始终跑不通，作为阻断项回报，不要自行猜测落盘结构。

⛔ **不接受照着别的工程抄原生工程目录。**

⚠️ **`ui/**` 手工建，不走脚手架。**
**理由**：Expo **没有**面向"纯 RN/TS 库包"的脚手架 ——
`create-expo-module` 产出的是带 Kotlin/Swift + Gradle 的原生模块，
`create-expo-app` 产出的是 app，两者都不是库。
`ui/**` 是库包，形态与 `libraries/frontend/admin-ui-foundation` 同类，按 §8.3 手写。
用 `npx expo install` 装它的 RN / NativeWind / RNR / Reanimated 依赖。

创建后必须：① 调整为 §4.1 的三重命名；② 用 `npx expo install` 对齐 §3 版本基线；
③ 记录实际用的路径与命令。

**脚手架产物必须清理的四样**（前两样已实跑确认）：

1. **`.git/`** —— `create-expo-app` 会在产物里初始化**自己的 git 仓库**。
   **必须删掉。** TER 的代码归 v2s 仓统一管理，不接受嵌套 / 独立仓。
   ⚠️ 逐包创建后**立即检查有没有 `.git`**，不要等 22 个包建完再找。
2. **`AGENTS.md` · `CLAUDE.md` · `.claude/`** —— 嵌套的 agent 指令文件会与仓根约定
   形成两套真相。**必须删掉。**
   （`create-expo-app` 有 `--no-agents-md` 可一次性跳过生成，优先用它。）
3. **`eslint.config.cjs` · `.prettierrc`** —— 改为继承仓根配置（§5.2）。
4. **`LICENSE`** —— 两条脚手架都会生成；TER 各包不单独持有 license。**删除。**
5. `ios/` 与 `example/`（`create-expo-module` 产物）—— TER 只做 Android，
   保留与否由 Codex 决定并说明；**但 `example/` 若保留，必须确认它不进工作区**（§5.1）。

⚠️ **`create-expo-module` 必须用非 local 形态。**
**理由**：`expo-module-template-local` 的模板文件清单里**没有 `$package.json`**
（`$` 前缀才是生成到目标的文件，非 local 模板有这一项）——
**local module 不产出 `package.json`**，因此它当不了 Yarn 工作区成员、
拿不到 `@catering-v2s/*` 包名、也进不了 assembly 的依赖表。

### 8.2 `kernel/**` · `ui/**` —— 手工建

`kernel/**` 是纯 TS 包（零 Expo / RN / React，见 §6.4）；
`ui/**` 是 RN 库包（有 React/RN 依赖，但没有原生工程）。**两者都没有官方脚手架可用。**

### 8.3 最小骨架

⚠️ **下表是 `kernel/**` 与 `ui/**` 的形态。**
`adapter/**` 与 `assembly/**` **保留脚手架产出的结构**，只在其上补
`src/moduleName.ts` 与 `src/dependencies.ts`。

**脚手架带来的 scripts 逐类定死**（不得因为"脚手架生成了"就当成已验收能力）：

- **`adapter/**`**：必须可运行 `typecheck`；脚手架自带的 `test`（jest / jest-expo）
  **保留但本批不跑**，供将来原生模块测试用；脚手架的 `build` **删除**（§5.2 库包不提供 build）。
- **`assembly`**：必须可运行 `typecheck` 与 `expo export`（§9.2 第 3 条）；
  `start` / `android` / `ios` / `web` 保留但本批不跑。
- **`kernel/**` · `ui/**`**：只需 `typecheck`。

⚠️ **本批没有任何包需要 `test` 脚本** —— 每包的独立验证由 `typecheck` 承担（§9.2 第 2 条）。

```text
<pkg>/
  package.json          name / private / scripts(typecheck) / dependencies
                        exports: 只有主入口（**不开旁路子路径**，§9.1）
  tsconfig.json         extends ../../../tsconfig.base.json   ← 三级结构使深度统一
  src/
    moduleName.ts       export const moduleName = '...'   ← 零 import
    dependencies.ts     从依赖包的**真实主入口** import（§9.1）
    index.ts            公开面：至少 re-export moduleName 与 dependencyModuleNames
    application/        createModule.ts · moduleManifest.ts（owner 包）
    features/{commands,actors,slices}/
    foundations/  selectors/  supports/  types/
  test/
```

⚠️ **`assembly` 另需 `src/skeletonBootstrap.ts`**，并保证
`index.ts → App.tsx → skeletonBootstrap.ts` 这条**真实生产入口链**可达它（§9.2 第 3 条）。

- `toolkit` 包可省略 `features/` 与 `application/`；
- **空目录不留空文件占位。**

⚠️ **不建 `src/generated/packageVersion.ts`。**
**理由**：POC 那个文件的内容就是 `export const packageVersion = '0.0.1'`，**没有生成器** ——
手写一个放在 `generated/` 下，标签就是假的。真需要版本常量时，连生成器一起做。

---

## 9 · 骨架验收：真实解析闭包

### 9.0 要证明什么

**骨架只证明结构接通，不证明任何包的能力。**

⚠️ 早先设计的「每包 echo 一个旁路子路径常量」**已废弃**。
**为什么**：它只 import 零依赖的 `moduleName` 子路径，**碰不到 package root、
碰不到原生模块、碰不到 Metro 与 assembly 的真实解析边界** ——
22 个包可以全绿，而 package root 没有真实导出、Metro 根本消费不了工作区包。
那证明的是一套自洽的旁路元数据，不是骨架接通。

### 9.1 规格与运行事实分开

| | 是什么 | 谁维护 |
|---|---|---|
| `apps/terminal/skeleton-graph.ts` | **规格**：包清单、`batch`、期望依赖、`plannedKind`（**唯一载体**，包内不复制） | 手写，这是设计 |
| 各包 `package.json` 的 `@catering-v2s/*` | **声明** | 手写 |
| 各包 `src/dependencies.ts` | **源码事实**：从依赖包的**真实主入口** import | 手写 |
| 依赖图 | **派生**，由检查脚本从上面两项读出 | **脚本派生，不手工维护** |

⚠️ **`skeleton-graph.ts` 是唯一规格。** §6.1 的表是它的可读渲染，冲突以文件为准。

⚠️ **`dependencies.ts` 必须走真实主入口**，例如
`import {moduleName as contracts} from '@catering-v2s/kernel-base-contracts'`。
**不再开 `"./moduleName"` / `"./dependencies"` 子路径** —— 那是绕过 package root 的旁路，
正是 §9.0 废弃的东西。`exports` 只保留主入口。

### 9.2 三条检查，构成完整闭包

| # | 检查 | 证明了什么 | 命令 |
|---|---|---|---|
| 1 | **图比对** | 依赖图与设计一致：方向、闭包、无孤儿、无多余；`package.json` 与 `dependencies.ts` 与 spec 三者相符 | 一个脚本，读文件不编译，秒级 |
| 2 | **类型解析** | 每条依赖边**在 TS 层真解析得到**（因为 `dependencies.ts` 真 import 了主入口） | 逐包 `tsc --noEmit`，经 turbo 拓扑序 |
| 3 | **打包** | **Metro 真能打包 assembly 入口可达的那一批工作区包** | 在 assembly 跑 `npx expo export --platform android` |

⚠️ **第 3 条不碰打包器就抓不到的失败，只有它能抓；但它的证明范围严格限于"入口可达集合"。**

🔴 **`expo export` 单独成立不构成证据 —— 这条已被实证。**
Metro **只处理从真实入口可达的模块**。若 assembly 的 `index.ts → App.tsx` 没有真的
import 到 TER 的包，一个空白 App 照样导出成功（实测约 3.35 秒、580 modules），
而工作区包一个都没被碰过。同一探针中，把一个含无法解析 require 的 UI 包
**接进 App 之后**，`tsc` 仍然 exit 0，`expo export` 立刻 exit 1 ——
说明前两条检查也补不上这个缺口。

⇒ **必须补一个 skeleton bootstrap，且它必须从真实生产入口可达：**

- assembly 的 `index.ts → App.tsx` → `src/skeletonBootstrap.ts`；
- `skeletonBootstrap.ts` 沿**真实 package root** import **当前批次的每一个** TER 包，
  收集它们的 `moduleName` 并在屏上呈现（内容不重要，**可达性才是要证明的东西**）；
- §10 的图门为此**增加一条断言**：
  **从 App 入口可达的 TER package root 集合 = `skeleton-graph.ts` 当前批次的包集合。**

⚠️ **`expo export` 的证明口径只能写成"Metro 能打包这个入口可达集合"** ——
不得因为 assembly 能导出就声称"消费了全部工作区包"。

⚠️ **没有每包一条的 echo 测试。**
包内为空时，"每包一条断言"要么是 `expect(true)` 式占位，要么是手抄常量表 ——
两者都不构成证据。**每包的独立验证由第 2 条（逐包 `tsc`）承担**，它是真的。

### 9.3 不做的

启真机 · 装 APK · 启浏览器 · 任何 command / slice / 持久化 / 渲染 / 双屏 / 端口行为的验证 ·
原生模块的构建与原生测试。

⚠️ **`expo export` 成功 ≠ 原生模块可构建。** 本批**不主张** adapter 的原生侧已接通 ——
Kotlin 侧只要求 source set 形态存在，不要求编译或运行。
交付表述必须与此一致，不得把"22 个包都建好了"说成"22 个包都能用了"。

## 10 · 本批必须建成的门

**六道静态门，全是读文件不编译的秒级检查。**
`TR-01`…`TR-09` 是九条，其余随对应包细化时再建 —— 骨架里还没有它们能约束的东西。

| 门 | 断言 | 红夹具 |
|---|---|---|
| **图比对**（§9.2 第 1 条） | ①从各包 `package.json` 与 `dependencies.ts` **派生**出的依赖图，与 `skeleton-graph.ts` 规格逐项相符，闭包 = 当前批次包数、无孤儿无多余；②**从 assembly 的 App 入口可达的 TER package root 集合 = 规格的当前批次包集合** | ①改任一包 `package.json` 的一条工作区依赖，不改规格；②从 `skeletonBootstrap.ts` 删掉一个包的 import |
| 三重命名 | 路径 → `moduleName` → 包名 三者可互推；包名无版本号/框架名 | 改任一包的 `moduleName` 使其不匹配 |
| 依赖方向 | 按目录映射层级，`dependencies` 不得反向；且 `ui/integration` 不依赖 `adapter/**`、`adapter/**` 除 `platform-ports` 外不依赖任何 `@catering-v2s/*` | ①给 `kernel/base/<x>` 加对 `ui/base/<y>` 的依赖；②给某 adapter 包加对 `contracts` 的依赖 |
| 依赖声明完整 | 源码每个 `@catering-v2s/*` import（含 `import type`）在本包 `package.json` 有声明 | 源码 import 一个未声明的工作区包 |
| `TR-01` reducer 只能 actor 调用 | `dispatchAction`/`store.dispatch`/`useDispatch` 不得出现在 `features/actors/**` 之外（白名单：`kernel/base/runtime`、`kernel/base/state`） | 在**白名单之外**的某个文件加一行 `dispatchAction(...)` |
| `kernel/**` 零 Expo / RN / React | 各包 `dependencies` + `peerDependencies` 不含 `expo*` / `react-native*` / `react` / `react-dom`；源码不 import 之 | ①给任一 kernel 包加 `"react"` 依赖；②在某 kernel 源码加一行 `import 'react'` |

⚠️ **每道门必须同时通过正负控制**：红夹具变红 **且** 真实树上是绿的。
只验红夹具会放过"对一切都报红"的假门；只验真实树会放过"对一切都报绿"的空门。

⚠️ **`TR-01` 门本批是空过的** —— 骨架里零 `dispatchAction` 调用点，它约束不到任何东西。
交付时必须如实标注，**不得计入"六道门已生效"的语义**。

**落点**：六道进 §5.3 的 TER 验证入口，该入口再被仓级 `scripts/verify` 调用一次。

## 11 · 明确不做的

| 项 | 为什么 |
|---|---|
| tcp-control / tdp-sync / terminal-log-upload | 编码的是协议，对手方尚未定义 |
| topology 的链路半边（pair link / state sync / request mirror） | 需要 host 对手方；本机双屏已改一个 store，不需要链路 |
| workflow 的**远端定义下发**（`workflowRemoteDefinitionActor`） | 它是 workflow 里**唯一**依赖 `tdp-sync` 的那条边；引擎内核不需要它。tdp-sync 出现后再接（§7.4） |
| 权益 / 主数据 / 业务 workbench / 产品 shell | 业务 |
| `adapter/web` | integration 属 ui 层，依赖 adapter 是反向依赖；web 上由端口默认实例覆盖 |
| mock server | 不带过来；后续直连 v2s 的两个后端 |
| `server-config` 独立包 | 形状在 `contracts`，地址值由启动层注入；dev 地址册归 `test-support` |
| React Compiler | `T-4` 已裁定。但 `eslint-plugin-react-hooks` 第一天就设 error |
| EAS Build / Submit / Workflows | 需要 Expo 账号；本批走本地 Gradle |
| Expo MCP Server | 远端托管 + 必须 OAuth；能力由 `ui.base.automation` 覆盖 |
| `host-runtime` 中间层 | **永久不建** —— 组装是组装包的职责（§7.2） |
| adapter 共享包（interfaces / 事件名 / 错误码） | 每个 module 自带自己的（§7.3） |
| 浏览器 / 真机测试基建 | 骨架只验解析闭包（§9.3） |
| 任何包的能力实现与能力验证 | 本批只建骨架 |

---

## 12 · 交付物与判据

### 12.1 交付物

1. v2s 仓根 workspaces 扩展 + 仓根 `turbo.json`；`apps/terminal/skeleton-graph.ts`（规格，§9.1）；
2. `apps/terminal/` 完整目录树（含空目录 README）；
3. **分两批交付**（§6.2）：批 1 的 14 个包，验收通过后批 2 的 8 个包，最终 22 个；
   每包含 §8.3 的最小骨架；
4. **`create-expo-module` 的可复跑闭包证据**（§8.1 的阻断项）：精确命令、CLI 解析版本、
   原始产物树、退出码、规范化为三级布局的逐项规则；
5. 六道门 + 每道门的**正负控制**记录（红夹具变红 + 真实树变绿）；
6. §9.2 三条检查的运行输出：图比对、逐包 `tsc`、assembly `expo export`；
7. 实施记录：每包的 `plannedKind`、派生出的真实依赖图、各包创建路径与命令、
   **与本文任何偏差的说明**、以及**本批未证明的事项清单**（至少含：原生模块未构建、
   无任何能力被验证）。

### 12.2 判据

⚠️ 每条判据都给了**可直接执行的命令**；命令本身不成立的判据是无效判据。

| # | 判据 | 命令 / 检查方式 | 不通过的表现 |
|---|---|---|---|
| 1 | 四个层都有内容，且**全链类型解析通过** | `turbo run typecheck --filter='./apps/terminal/**'` | 某层为空；或某条依赖边解析不到 |
| 2 | **assembly 能打包**，且**入口可达集合 = 当前批次包集合** | 在 assembly 包内 `npx expo export --platform android`，并由 §10 图门第 ② 条断言可达集合 | 打包失败；或打包成功但入口根本没 import 到 TER 的包（空白 App 也能导出） |
| 3 | 依赖图与规格逐项相符，闭包 = 当前批次包数（批 1 = 14，批 2 后 = 22），无孤儿无多余 | §10 图比对门 | 图漂移但各处自洽 |
| 4 | TER 的工作区成员**恰好等于当前批次包数** | `yarn workspaces list --json` 过滤 `apps/terminal/` 前缀后计数 | `example/` 或残留包混进来 |
| 5 | 六道门**正负控制都通过**（红夹具变红 + 真实树变绿） | §10 | 只验了红夹具；或某门在真实树上是红的 |
| 6 | TER 验证入口分钟级，且**不触发 `apps/frontend/*` 的任何任务** | `yarn workspace @catering-v2s/terminal run verify`，观察被执行的任务列表 | 波及既有前端 App |
| 7 | 该入口已被仓级 `scripts/verify` 调用 | 读 `tools/verify-gates/verify.mjs` 的条目 | 门建了但不进回归入口 ⇒ 防回归价值为零 |
| 8 | 全树**不存在嵌套的脚手架元数据**：无嵌套 `.git` 目录、无嵌套 `AGENTS.md`/`CLAUDE.md`/`.claude/`、无脚手架自带的 lint/prettier 配置 | 文件系统检查 | §8.1 的清理没做 |
| 9 | `.gitignore` 覆盖 §5.4 列出的全部条目 | 读文件比对 | 产物或依赖目录未被忽略 |

⚠️ **判据 4 必须过滤。** `yarn workspaces list` 的未过滤输出包含仓根与既有三个前端包，
不可能等于 14 或 22。

⚠️ **判据 8 / 9 只做文件系统层面的机械检查。**
仓库控制动作与仓库状态**不是本批的完成条件**，不得写成实施或验收前提。

## 13 · 给 Codex

1. **先读规范正本**：`doc/platform/terminal-coding-standard.md`。本文不复述规则，冲突时以正本为准。
2. **`skeleton-graph.ts` 是规格的唯一载体**，也是骨架期 `plannedKind` 的唯一载体 ——
   包内不再复制 `plannedKind`。
3. **依赖版本**：`ui/**` · `adapter/**` · `assembly/**` 走 `npx expo install`；
   **`kernel/**` 例外** —— 包内没有 `expo`，该命令用不了。
   **版本取实施当时 `latest` 模板与 Expo CLI 的实际解析结果**（§3）——
   §3 的表是 2026-08-29 快照，**不是要钉死的值**，与实际不符时以实际为准并说明。
4. **创建路径分两类**：`kernel/**` 与 `ui/**` **手工建**；
   `adapter/**` 与 `assembly/**` **走官方脚手架**，不抄目录。
5. **两条最容易被顺手违反的边界**：
   ① `kernel/**` 不装 Expo / RN / React；
   ② 骨架只验解析闭包，不下钻到任何包的能力。
6. **`create-expo-module` 是实施阻断项**（§8.1）—— 未取得可复跑闭包前不要开建 adapter 包。
7. **动工前重新验证一次 npm age gate**（§3）—— 它是外部时效事实，会随时间变化。
8. **遇到本文与实际不符**，**停下来说明，不要自行选一个做法继续**。
9. 开放点已标注（§5.1 workspaces 通配方式）；其余按规范正本推导，仍不明确的回 Dexter。
