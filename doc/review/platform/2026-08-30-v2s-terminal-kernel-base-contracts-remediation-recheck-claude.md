# TER `kernel.base.contracts` 需求修订定向复核

REVIEW_CYCLE_ID=TER_KERNEL_BASE_CONTRACTS_REQUIREMENTS_DESIGN_2026_08_30
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=1/5/2
L1_ENGINEERING=1 个 M、5 个 S、2 个 N；原三条 M 的主体修订成立，但消费者负类型夹具未闭合到真实 typecheck，且仍有规则、来源与事实表的可执行性缺口
L2_USER_VISIBLE=NOT_APPLICABLE（本包无 UI-bearing Journey）
L3_UNVERIFIED=NOT_APPLICABLE（无 UI；工程动态项列在“未核到的部分”）
SAME_ROOT_SCAN=contracts 当前骨架 typecheck 配置与全部 F-1…F-4 夹具要求已对账；T-1…T-9 全集已对账；C-4b 三种禁形与两条红夹具已对账；5 个 adapter manifest、执行规格与版本来源已对账；POC 18 个 package-level importer 已枚举，platform-ports 行逐文件复核
DESIGN_GAPS=消费者类型夹具没有指定进入哪个 tsc 项目；C-4b 没有指定双重 as cast 的扫描面与红夹具；adapter 的 expo install 没有指定 --dev/参数/lockfile 边界；contracts 需求与骨架需求对 adapter 版本源存在冲突
EVIDENCE_TIER=仓内需求、规范、项目记忆、当前 TER 骨架与 POC 源码的静态核验；npm 官方 registry 与本地 Expo CLI help 的外部只读核验；当前 contracts skeleton typecheck exit 0 与 tsc showConfig；未实施 contracts、未运行 contracts 测试/真实 adapter expo install

## 背景

Dexter 要求对 `kernel.base.contracts` 需求修订做第二轮定向复核。该包是 TER 22 包依赖图的唯一零依赖根；本批目标是从 POC 中只保留跨包共享词汇，并为 TR-05、时间副作用、消费者编译闭包及 5 个 adapter 的开发依赖建立可证伪边界。本轮只读当前需求与规范，不创建或修改 contracts 源码，不把作者的处置结论当作证据。

## 评审目标

以“找出它为什么仍可能不成立”为立场，逐项复核上一轮 M/S/N 的处置是否真的关闭，并主动寻找新的 false-green 路径，重点检查：

1. F-1…F-4 是否被真实 TypeScript 编译消费，而不只是文件存在；
2. `createAppError` 例外与 T-7 是否逐字一致；
3. C-4b 是否真的覆盖 TR-05 的 `Record`、`any` 与双重 `as` cast；
4. adapter devDeps 的来源、命令和允许写入面是否与骨架需求、项目记忆及当前 Dexter 裁定一致；
5. §3.2 的 POC 消费事实是否准确，尤其是 `platform-ports`；
6. 需求中的表格、证据档位与当前可执行结构是否仍有低成本但会误导实施者的缺口。

## 需阅读文件

- `doc/plans/platform/2026-08-29-v2s-terminal-kernel-base-contracts-requirements-claude.md`：当前需求；
- `doc/plans/platform/2026-08-29-v2s-terminal-skeleton-requirements-claude.md`：adapter 版本源与 latest 策略；
- `doc/platform/terminal-coding-standard.md`：TR-05/TR-06 正本；
- `apps/terminal/kernel/base/contracts/tsconfig.json`、`package.json`：当前骨架的实际 typecheck 闭包；
- `apps/terminal/skeleton-graph.ts`：当前 TER 依赖事实；
- `apps/terminal/adapter/android/*/package.json`：5 个 adapter 的当前 devDeps；
- `../newPOSv1/1-kernel/1.1-base/contracts/`：POC contracts 与 TR-05 命中；
- `../newPOSv1/1-kernel/1.1-base/platform-ports/`：§3.2 消费事实；
- `project-memory/decisions/terminal-architecture-and-stack-rulings.md` 与 `project-memory/decisions/terminal-build-order-and-batches.md`：TER 版本策略与建设边界；
- `doc/platform/review-standard.md`、`.agents/skills/cs-review/SKILL.md`：本轮动作与结论格式。

## 独立核验重点

我先按动作 1-B 提取了当前文档中的自相矛盾与无出处具体执行条件：`test/` 类型夹具没有被绑定到 `tsc` 项目；C-4b 的扫描面列了三种禁形但只给了两条红夹具；`npx expo install` 没有给出 `--dev`、参数集合与 lockfile 处理；adapter 的版本源在 contracts 需求与骨架需求中不一致；§3.2 将 `platform-ports` 的多个类型 import 错写成“只有 nowTimestampMs”。随后用当前骨架、POC 全集、规范正本和 npm/Expo 只读命令逐条核验。

## 期望结论

本轮必须给出明确 `GO` 或 `NO-GO`，并统计 `M/S/N`。每条 finding 都要有状态分类、精确节号、当前字节证据、失败后果、最小修复、较小替代为何不足及同族全集扫描；外部事实与未运行的动态闭包不得升级为已证实现。

## 原 finding 处置复核

### 已关闭（REJECTED_WITH_EVIDENCE）

- 原 M-1：`formatTimestampMs` 已从进包清单移除，§4.1 明确其为 UI 展示 helper；POC 生产调用点确为两个 UI supports，kernel 侧无生产调用。
- 原 M-2：POC `src` 精确扫描为 17 个 `Record<string, unknown>` 与 1 个 `any`；排除 projection 2 处与 command envelope 2 处后，13+1 的逐文件清单已补齐，`TransportRequestContext.metadata` 与 `listDefinitions` 泛型约束已列入，虚构的 `ConfigSpace.metadata` 已删除。
- 原 S-1：§3 已拆成 TER 图边、POC 符号消费、TER 需求判断三档，并给四组未来需求标 `UNVERIFIED_TER_NEED`；`CommandRouteContext` 已明确 local-only 与序列化边界。
- 原 S-2：C-4b 已进入 §8.4 判据 7，判据表现为 C-2/C-4b/C-5/C-6 四道门，且要求真实树绿与正负控制。
- 原 N-1：C-6 已改为“以下七处闭集”。
- 原 N-2：`CommandRouteContext` 的 local-only / wire boundary 已写在 §4.2。

### 部分关闭（仍有残余 finding）

- 原 M-3：TR-06 正本和 C-7 已点名 `createAppError`，但 T-7 仍只排除 `nowTimestampMs` 与 ID 生成，未排除 `createAppError`。
- 原 S-3：F-1…F-4 已写入 §8.3b/§8.4，但没有规定 `test/` 类型夹具进入哪个 `tsconfig` 或哪个 `tsc --noEmit` 命令。
- 原 S-4：cwd、顺序、停机与证据字段已写入，但版本来源与执行命令仍与骨架需求冲突，且命令缺少保存到 `devDependencies` 的明确参数。
- 原 N-3：adapter provenance 仍写“本轮未解包 tarball”，与本轮可取得的 npm tarball 元数据及此前 scratch 观察不一致；完整 install closure 仍未证明，但两者应分开记录。

## M findings

### M-1 · F-2/F-4 负类型夹具没有进入任何真实 typecheck 闭包（CONFIRMED）

**位置**：需求 §8.3b F-1…F-4（约第 495–519 行）、§8.4 判据 4b（约第 529 行）、§7 `test/` 结构；当前 `apps/terminal/kernel/base/contracts/tsconfig.json` 与 `package.json`。

**事实与证据**：需求要求新增 `test/` 下的“消费者编译夹具”，并以 `@ts-expect-error` 证明 F-2 branded ID 与 F-4 泛型收窄。但当前 contracts skeleton 的真实 typecheck 是：

```text
$ yarn workspace @catering-v2s/kernel-base-contracts typecheck
TYPECHECK_EXIT=0

$ yarn --cwd apps/terminal/kernel/base/contracts exec tsc --project tsconfig.json --showConfig
"files": [
  "./src/dependencies.ts",
  "./src/index.ts",
  "./src/moduleName.ts"
],
"include": ["src/**/*.ts"]
```

也就是说，需求指定的 `test/**/*.ts` 默认不在当前 `tsc` 项目内。Vitest/一般转译器不会执行 TypeScript 类型检查，`@ts-expect-error` 甚至可以作为未被消费的文本存在。

**可复现 false-green**：实现者创建了含错误类型和 `@ts-expect-error` 的 F-2/F-4 文件，但不更新 `tsconfig` 或 typecheck 命令；`yarn workspace ... typecheck` 仍对空骨架的 3 个 src 文件返回 0，`vitest` 只转译并运行正向运行时测试，全部 §8.4 可见门仍可被报告为通过，消费者契约并未经过编译器。

**后果**：上一轮要堵住的“根契约写错但全绿”路径仍成立。F-1/F-3 的正向构造和 F-2/F-4 的负向约束都没有证据闭包，§8.4 只检查“文件存在”就会退化成装饰性验收。

**最小修复**：在需求中固定一个真实入口，例如新增 `tsconfig.test.json`（include `src/**/*.ts` 与 `test/**/*.ts`，或以项目引用方式消费同一 public entry），并把 `typecheck` 明确接成 `tsc --project tsconfig.test.json --noEmit`；验收必须展示 F-1…F-4 被该命令消费，未使用的 `@ts-expect-error` 应使命令失败。也可以把 fixture 放进当前 `tsconfig` 的 include，但必须明确这种更小路径。

**更小替代不足**：只在 §8.4 写“F-1…F-4 文件存在”或只运行 Vitest 不能证明类型错误被编译器检查；把 `@ts-expect-error` 当作文本 grep 也不能证明它绑定到真实 API。

**同族扫描**：F-1/F-2/F-3/F-4 四项全部检查；当前 package 的唯一 typecheck script 与 tsconfig 全部检查，未发现任何第二个 test typecheck 入口。

## S findings

### S-1 · T-7 没有同步 `createAppError` 的正本例外（PARTIALLY_CONFIRMED）

**位置**：需求 §5 C-7（约第 199 行）、§8.3 T-7/T-8（约第 488–489 行）；规范正本 `doc/platform/terminal-coding-standard.md` TR-06 例外（约第 217–228 行）。

**事实与证据**：正本现在允许两类：① `nowTimestampMs` 与 ID 生成；② 直接派生且具有固有语义的构造器，目前点名 `createAppError`。需求 C-7 已引用这条正本；但 T-7 仍是“除 `nowTimestampMs` 与 ID 生成外，同输入两次调用结果全等”，没有 `createAppError` 这一例外或“固定 fake clock 后比较”的执行条件。T-8 只单独证明 `createdAt` 的精确 fake-clock 值，不能替 T-7 改写范围。

**后果**：实现者必须猜 T-7 是排除 `createAppError`、在 fake clock 下调用，还是把它算入全等集合；若把 T-7 机械应用于真实时间的 `createAppError`，同输入两次调用会因 `createdAt` 不同而失败。

**最小修复**：把 T-7 改为“除 `nowTimestampMs`、ID 生成与 `createAppError` 外……”；或明写 T-7 仅覆盖其它 foundations，`createAppError` 由 T-8 在 fake clock 下单独证明。两处必须与 TR-06 的两类例外逐字一致。

**更小替代不足**：只依赖“C-7 引用正本”仍把一个可执行测试判据留在歧义中；只保留 T-8 不能说明其它 foundation 的确定性范围。

**同族扫描**：T-1…T-9 全部复核；仅 T-7 未同步第二类例外，T-8 已有精确时间控制。

### S-2 · C-4b 宣称禁止双重 `as`，但扫描面与正向/反向控制都没有覆盖它（CONFIRMED）

**位置**：需求 §5 C-4b（约第 196 行）、§8.4 判据 7（约第 533 行）；规范正本 TR-05（约第 165–184 行）。

**事实与证据**：C-4b 的扫描面只列出 `src/**` 下 exported 接口/type alias 成员、函数签名参数/返回值、泛型约束 `extends` 右侧；红夹具只要求两条：恢复 `Record<string, unknown>`，恢复 `extends Record<string, unknown>`。TR-05 同时明确禁止双重 `as` cast，但需求没有说明扫描函数体中的双重断言，也没有为它配置红夹具。

**可复现 false-green**：在一个 exported foundation function 的函数体中写 `return input as unknown as Target`，其公开参数/返回值仍使用具名类型；若实现的 C-4b 按需求列出的声明/签名面扫描，两条现有红夹具仍通过，真实树也通过，TR-05 的双重 cast 禁止却被违反。

**后果**：C-4b 不能证明它声称的三种禁形，判据 7 仍可能在硬规则已违反时显示全绿。

**最小修复**：在需求中明确双重 `as` 的扫描范围（至少 `src/**/*.ts` 中 exported 方法的实现体，或按 TR-05 规定的整个本包公开边界），并加入一条把合法实现改成 `as unknown as` 的红夹具；正向控制必须证明真实树无该形态。

**更小替代不足**：只增加文字“同时禁止双重 cast”不改变门行为；只 grep 类型声明永远看不到函数体中的断言。

**同族扫描**：C-4b 的三类禁形全部复核；`Record`、泛型约束各有红夹具，双重 `as` 缺失。

### S-3 · adapter 版本源与骨架需求冲突（CONFIRMED；当前会话已有 Dexter 选择）

**位置**：contracts 需求 §8.1（约第 419–433 行）；骨架需求 §3.3（约第 131–135 行、§8.1 约第 581–585 行）；项目记忆 `terminal-architecture-and-stack-rulings.md` 的 `TER_STACK_RULINGS_T1_T13`。

**事实与证据**：骨架需求把 adapter 明确列为独立例外：Expo/RN/Jest 等外部开发依赖以 `expo-module-template@latest` 的 raw manifest 为源，不消费 app template 集合 A/B，不得把 app template 版本表套到 adapter。contracts 需求却要求 5 个 adapter 走 `npx expo install`，并把 `expo ~57.0.18`、`react-native 0.86.3`、`jest-expo ~57.0.5`、`babel-preset-expo ~57.0.9`、`@types/react ~19.2.2` 写成预期结果；这些正是 app template/SDK57 对齐口径。

当前 TER 5 个 adapter 的 devDeps 完全相同，均仍是 `jest-expo ~55.0.9`、`babel-preset-expo ~55.0.8`、`react-native 0.82.1`、`expo ^57.0.17`、`@types/react ~19.1.1`。此前 scratch 的 `create-expo-module` 生成观察也得到同一混合形态。故两份材料不是同一策略的不同表述，而是对同一写入面给了两个来源。

**后果**：执行者无法同时满足“以 module-template raw manifest 为源且不得套 app template”与“用 Expo SDK57 解析把 RN/Jest 对齐到 app template 值”。若按 contracts 需求修改，仍会违反骨架需求；若按骨架需求保留，contracts 的 5b 与“一键测全”目标又可能失败。

**最小修复**：以本会话 Dexter 已明确的“5 个 adapter devDeps 对齐到 SDK57”作为当前选择，给骨架需求加一条明确的 supersession/adapter test-toolchain 例外：native/template 形态仍以 `expo-module-template` 为源，测试开发依赖可按 SDK57 的 `expo install --dev` 解析；同时删除“不得把 app template 版本表误套到 adapter”的绝对句，或改为仅限制 native 依赖。若该会话裁定不覆盖骨架需求，则反向删除 contracts 的 SDK57 对齐要求；两者不能并存。

**需 Dexter 裁决**：若不把本会话“5 个 adapter 对齐 SDK57”视为已覆盖骨架需求，必须在“保留 module-template raw devDeps”与“允许 SDK57 test-toolchain 对齐”之间选一项。当前直接指派已给出后者，但 owning 文档仍未同步。

**同族扫描**：5/5 adapter manifest 的 devDeps、peerDependencies、dependencies 均检查；5 个值完全相同，冲突适用于全集而非单包。

### S-4 · `expo install` 没有可复跑的参数与 devDependencies/lockfile 闭包（CONFIRMED）

**位置**：contracts 需求 §8.1（约第 432–444 行）。

**事实与证据**：需求写“版本不要手写，走 `npx expo install`”，并规定 cwd、顺序、停机和记录 cwd/确切命令，但没有给出要传的包名、`--dev`/`--fix` 形态、是否按包逐次执行、或命令可能触及 root `yarn.lock` 时如何判定允许写入面。当前本地 Expo CLI help 为：

```text
EXPO_LOCAL_HELP_EXIT=0
Usage: $ npx expo install
Options:
  --check  Check which installed packages need to be updated
  --dev    Save the dependencies as devDependencies
  --fix    Automatically update any invalid package versions
  --yarn / --npm / --pnpm / --bun
```

不传 `--dev` 默认并不承诺把指定包写入 `devDependencies`；不传包名与 `--fix` 也无法区分“修正现有全部依赖”还是“安装表中五个包”。而需求又把 `dependencies`、`peerDependencies`、native 与 Gradle 列为不可写，没有对 lockfile 说明。

**后果**：不同执行者可以得到不同 package.json section、不同 lockfile 变化和不同解析结果；“只改 devDependencies”与“官方命令”不能由当前文字同时复现。

**最小修复**：写死一个命令算法，例如每个 adapter 在自身 cwd 运行 `npx expo install --dev <明确包集合>`（或明确 `--fix --dev` 是否允许），说明 `expo` 本身是否在集合内、root lockfile 是否允许变化及其记录/回滚边界；任何非零退出仍 fail closed。实际输出必须包含最终 section 与 lockfile diff。

**更小替代不足**：只要求“记录确切命令”是事后证据，不是事前执行规范；只写目标版本又违反“不手写版本”。

**同族扫描**：5 个 adapter 的命令目标、写入面和失败规则全部复核；缺口是共同规则，不是某个 adapter 漏写。

### S-5 · §3.2 将 `platform-ports` 的实际消费错误写成“只有 nowTimestampMs”（CONFIRMED）

**位置**：需求 §3.2 表格（约第 82–90 行）。

**事实与证据**：当前表格写：`platform-ports | 只有 nowTimestampMs —— 不是错误协议`。POC 源码 `../newPOSv1/1-kernel/1.1-base/platform-ports/src/types/logging.ts:1-8` 实际从 contracts 导入类型 `CommandId`、`ConnectionId`、`NodeId`、`RequestId`、`SessionId`、`TimestampMs`；`src/foundations/logger.ts:1` 另导入运行时 `nowTimestampMs`。测试 `test/scenarios/platform-ports.spec.ts:2` 还导入 `createCommandId` 与 `createRequestId`。这些是实质符号消费，不能被“只有”概括掉。

**后果**：§3.2 被用作导出取舍的事实依据时，会错误地把 ID 类型消费标成不存在；虽然 §3.3 最终把 ID/时间标成 `CONFIRMED`，但这条表的外部事实已经不可信，也可能掩盖未来 platform-ports 所需的类型边界。

**最小修复**：把该行拆成“运行时 import：`nowTimestampMs`；生产 type import：六个 ID/时间类型；测试 import：`createCommandId`/`createRequestId`”，并为 18 个 POC package-level importer 明确“列出全部”或“列出与本批直接相关的符号”两种口径，不能同时写“已逐处核”又用“只有”省略实际符号。

**更小替代不足**：只删掉“只有”仍不告诉读者哪些类型被消费；只依赖 §3.3 的推论表不能修正 §3.2 的外部事实。

**同族扫描**：POC 18/18 package-level importer 已枚举；本 finding 的错误行是 `platform-ports`，其余表行未据此推导为完整清单。

## N findings

### N-1 · §4.1 的七组 Markdown 表被移除说明打断（CONFIRMED）

**位置**：需求 §4.1（约第 112–137 行）。

**事实**：第 1 组表行后插入了 `formatTimestampMs` 移除说明、证据和边界，随后第 2–7 组才继续使用 `| ... |` 行。渲染后它们属于两个表/普通段落，而不是一张连续七行表。

**后果**：人读仍可理解，但任何按表格解析导出组、数量或证据的工具会在第 1 组后断开；C-8 的精确导出清单对账也更易漏行。

**最小修复**：把移除说明移到表格前或表格后，保持七组连续；不要改变已正确的移除结论。

### N-2 · adapter provenance 末句仍与已取得的 tarball 证据不一致（PARTIALLY_CONFIRMED）

**位置**：需求 §8.1（约第 467–470 行）。

**事实与证据**：本轮只读命令 `npm pack --dry-run expo-module-template@latest --json` exit 0，返回 `expo-module-template@57.0.9`、`entryCount=91`，并包含 `package.json`、Android、iOS、module scripts 与模板源文件；`npm view expo-template-blank-typescript@latest ... --json` exit 0，返回 template `57.0.20` 及 raw manifest。需求仍写“模板生成物内容需解包 tarball 才能确认，本轮未做”。完整 `create-expo-module` install closure 仍未被证明，但 tarball 元数据已不再是“未做任何核验”。

**后果**：实施者会把“模板静态 provenance 已核”与“完整脚手架 install closure 未核”混为一个 UNVERIFIED，重复做已完成的探针或错误地认为来源完全未知。

**最小修复**：拆成两档：① template tarball/package-source 静态证据（已核，记录版本与命令）；② create-expo-module 生成后 package manifest 与依赖安装闭包（仍 `UNVERIFIED_REQUIRES_EVIDENCE`，保留 EALLOWSCRIPTS 首败）。

## 已核到的命令与实际输出

### 仓内静态/编译入口

```text
$ yarn workspace @catering-v2s/kernel-base-contracts typecheck
TYPECHECK_EXIT=0

$ yarn --cwd apps/terminal/kernel/base/contracts exec tsc --project tsconfig.json --showConfig
"files": ["./src/dependencies.ts", "./src/index.ts", "./src/moduleName.ts"]
"include": ["src/**/*.ts"]
```

这只证明当前骨架的三文件 source typecheck，不证明需求新增的 F-1…F-4。

### POC TR-05 计数与消费面

```text
SRC_RECORD=17
SRC_ANY=1
ALL_RECORD=17
ALL_ANY=2
```

`ALL_ANY=2` 的第二处是 POC 测试文件中的 `as any`；需求的 C-4b 扫描面是 `src/**`，因此 in-scope source 计数 17+1 是对的，但“全包”一词需要注明扫描范围。

`platform-ports/src/types/logging.ts` 的生产 type import 为 `CommandId, ConnectionId, NodeId, RequestId, SessionId, TimestampMs`，另有 `nowTimestampMs` runtime import；测试还 import `createCommandId/createRequestId`。

### 外部只读元数据与 CLI help

```text
$ NO_UPDATE_NOTIFIER=true npm_config_update_notifier=false npm view expo-template-blank-typescript@latest version dependencies devDependencies --json
NPM_VIEW_EXIT=0
version=57.0.20
dependencies.expo=~57.0.18
dependencies.react-native=0.86.3
devDependencies.@types/react=~19.2.2
devDependencies.typescript=~6.0.3

$ NO_UPDATE_NOTIFIER=true npm_config_update_notifier=false npm pack --dry-run expo-module-template@latest --json
NPM_PACK_EXIT=0
id=expo-module-template@57.0.9
entryCount=91

$ (assembly cwd) node ../../../node_modules/expo/bin/cli install --help
EXPO_LOCAL_HELP_EXIT=0
--dev Save the dependencies as devDependencies
--fix Automatically update any invalid package versions
```

另有此前 scratch `create-expo-module@latest` 运行：模板下载/生成成功，但内置 install 以 `EALLOWSCRIPTS` exit 1 结束；本轮没有把该部分升级为完整闭包证据。

## 未核到的部分

- contracts 尚未实施，故未运行 F-1…F-4、T-1…T-9、C-2/C-4b/C-5/C-6 的真实门与红夹具；
- 未执行 5 个 adapter 的真实 `expo install`，未观察 package.json section 与 root lockfile 的实际写入；
- 未验证未来 platform-ports/runtime 对四组 `UNVERIFIED_TER_NEED` 的真实字段消费；
- 未验证 metadata 开放槽的未来 writer/reader 是否能被具名类型替代；
- 未运行 TER `verify`、仓级 `scripts/verify`、Metro、Gradle、设备或任何运行时业务能力；
- 未逐行重建 POC 的全部 150 个 importer 文件，只完成 18 个 package-level importer 枚举与本批直接相关消费核对。

## 结论

**NO-GO。** 原三条 M 的主体修订确实落字节，但 M-1 仍保留一条可复现的“负类型夹具存在但未被 tsc 消费”的 false-green 路径。S-1 至 S-5 会让规则范围、版本来源、官方命令和消费者事实在实施时需要猜或产生跨文档冲突；N-1/N-2 不单独阻断，但应在定稿时收口。

## 可直接复制给 Claude 的话术

```text
您好 Claude。以下是 Codex 对 `kernel.base.contracts` 需求修订的第二轮定向复核结果，请把它作为当前处置输入，不要把上一轮作者的“全部已处置”当作证据。

REVIEW_CYCLE_ID=TER_KERNEL_BASE_CONTRACTS_REQUIREMENTS_DESIGN_2026_08_30
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2/2
VERDICT=NO-GO
M/S/N=1/5/2

背景：
TER `kernel.base.contracts` 是 22 包依赖图的唯一零依赖根。本轮只复核需求文档与规范字节，不授权创建或修改 contracts 源码，不授权开始下游 package implementation。当前需求路径为 `doc/plans/platform/2026-08-29-v2s-terminal-kernel-base-contracts-requirements-claude.md`，规范正本为 `doc/platform/terminal-coding-standard.md`。

目标：
确认上一轮处置是否真正关闭了 contracts 的内容边界、TR-05、时间例外与消费者编译闭包，并找出仍可让验收全绿但交付物不可用的路径。

已确认关闭：
1. `formatTimestampMs` 已从 contracts 清单移除；
2. TR-05 in-scope inventory 已修为 13 个 `Record` + 1 个 `any`，并补齐 `TransportRequestContext.metadata` 与 `listDefinitions` 泛型约束；
3. §3 已拆为 TER 图边/POC 消费/TER 推论三档，`CommandRouteContext` 已写 local-only；
4. C-4b 已列入 §8.4 判据 7，C-6 数量已修为七处。

仍未闭合的 findings：

M-1（阻断，需求 §8.3b/§8.4；CONFIRMED）：F-1…F-4 被要求放在 `test/`，但当前 `apps/terminal/kernel/base/contracts/tsconfig.json` 只 include `src/**/*.ts`，唯一 typecheck 只编译 `src/dependencies.ts`、`src/index.ts`、`src/moduleName.ts`。我实跑 `yarn workspace @catering-v2s/kernel-base-contracts typecheck` 得 `TYPECHECK_EXIT=0`，`tsc --showConfig` 明确没有 test 文件。这样实现者可以创建 `@ts-expect-error` 的 F-2/F-4 而不接入任何 tsc，仍报告判据 4b 通过。最小修复：固定 `tsconfig.test.json` 或把 `test/**/*.ts` 纳入 typecheck，并把 F-1…F-4 绑定到实际 `tsc --noEmit` 命令；仅文件存在或 Vitest 转译不够。

S-1（需求 §8.3 T-7；PARTIALLY_CONFIRMED）：TR-06 正本与 C-7 已点名 `createAppError` 是第二类时间派生例外，但 T-7 仍只排除 `nowTimestampMs` 与 ID 生成。最小修复：T-7 明确排除 `createAppError`，或规定它只在 fake clock 下由 T-8 单独验证。

S-2（需求 §5 C-4b/§8.4；CONFIRMED）：C-4b 禁止 `Record`、`any`、双重 `as`，但扫描面只描述声明/签名/泛型约束，红夹具只有 Record 与泛型约束，没有双重 as。最小修复：定义双重 as 的实现体扫描面，并增加 `as unknown as` 红夹具与真实树绿控制。

S-3（contracts §8.1 vs skeleton §3.3；CONFIRMED）：骨架需求说 adapter devDeps 以 `expo-module-template@latest` raw manifest 为源且不得套 app template；contracts 需求却要求 5 个 adapter 通过 `npx expo install` 对齐 app template/SDK57 的 `expo ~57.0.18`、RN `0.86.3`、jest/babel 57。当前 5 个 adapter manifest 仍完全相同的混合值，scratch 生成观察也如此。当前会话已有 Dexter“5 个 adapter 对齐 SDK57”的直接选择，但 owning skeleton 文档尚未同步；若该选择不覆盖骨架文档，需要 Dexter 在两种版本源之间裁决。

S-4（contracts §8.1；CONFIRMED）：`npx expo install` 没有确切包参数、`--dev/--fix` 形态、逐包算法或 lockfile 允许写入边界。当前本地 CLI help 的 `--dev` 明确决定保存到 devDependencies，`--fix` 决定修正现有版本；不写死就会得到不同 package section/lockfile。最小修复：写死可复跑命令及写入/lockfile规则，仍保持非零即停。

S-5（需求 §3.2；CONFIRMED）：表格把 `platform-ports` 写成“只有 `nowTimestampMs`”。实际 POC `platform-ports/src/types/logging.ts` 还 type-import `CommandId`、`ConnectionId`、`NodeId`、`RequestId`、`SessionId`、`TimestampMs`，logger 另 runtime-import `nowTimestampMs`，测试还 import 两个 ID generator。最小修复：按 runtime/type/test 分列，并明确 18 个 package-level importer 的枚举口径。

N-1：§4.1 的 `formatTimestampMs` 移除说明插在第 1 组表行与第 2–7 组之间，Markdown 表被打断；把说明移到表前/后即可。

N-2：§8.1 仍写“本轮未解包 tarball”，但我实跑 `npm pack --dry-run expo-module-template@latest --json` 得 `NPM_PACK_EXIT=0`、`expo-module-template@57.0.9`、`entryCount=91`；应把 tarball 静态 provenance 与完整 create-expo-module install closure（仍因 `EALLOWSCRIPTS` exit 1 未证）分开标记。

关键命令输出：
- `yarn workspace @catering-v2s/kernel-base-contracts typecheck` → exit 0（只编译当前 skeleton src）；
- contracts `tsc --showConfig` → files 只有 3 个 src 文件，include 只有 `src/**/*.ts`；
- POC source 扫描 → `SRC_RECORD=17`, `SRC_ANY=1`; 全包另有测试中的 `as any`；
- `npm view expo-template-blank-typescript@latest ...` → `version=57.0.20`, Expo `~57.0.18`, RN `0.86.3`；
- `npm pack --dry-run expo-module-template@latest --json` → `expo-module-template@57.0.9`, 91 entries；
- 本地 Expo CLI `install --help` → exit 0，明确存在 `--dev` 与 `--fix`。

未核到：contracts 真正实施与 F/T/C 门运行、5 个 adapter 的真实 expo install/lockfile、未来 platform-ports/runtime 的语义消费、完整 importer 文件级复核、TER verify/Metro/Gradle/设备。

授权边界：
本轮仅提供设计复核结果。M-1 未关闭前不得把 contracts 需求交给实施者作为“无需猜测”的输入；不得创建或修改 contracts 源码、批二或任何终端能力；不得把静态 typecheck 当作真实消费者证明。若要继续，先修 owning 文档并对 M-1、S-1…S-5 做一次定向复核；本 cycle 已到第 2/2 轮，不再召集第三轮。
谢谢。
```
