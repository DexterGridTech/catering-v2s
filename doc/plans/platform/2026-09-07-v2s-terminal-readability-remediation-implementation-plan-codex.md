SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# TER 可读性整改 · implementation plan

## 0. 元数据、当前授权与输入

```text
PROGRAM_ID=V2S_W0_W4_EXECUTION
BUSINESS_SOURCE=doc/plans/platform/2026-09-07-v2s-terminal-readability-remediation-requirements-claude.md
DESIGN_SOURCE=doc/plans/platform/2026-09-07-v2s-terminal-readability-remediation-implementation-design-codex.md
HISTORY_ONLY_SOURCE=doc/plans/platform/2026-09-07-v2s-terminal-readability-remediation-analysis-claude.md
RULE_SOURCE=doc/platform/terminal-coding-standard.md
TEMPLATE_SOURCE=doc/decisions/templates/implementation-design-template.md
MEMORY_SOURCES=project-memory/decisions/deterministic-context-only.md; project-memory/decisions/independent-subagent-adversarial-review.md; project-memory/operations/terminal-coding-standard.md; project-memory/decisions/terminal-architecture-and-stack-rulings.md; project-memory/decisions/terminal-build-order-and-batches.md
AUTHORIZED=详设与实施计划已获 Dexter 授权；设计 finding M-1/S-1/S-2 已由主 agent 按授权自闭合；进入 CP-0..CP-6 实施
NOT_AUTHORIZED=新增依赖、公共 platform-ports 契约、Android/Web 运行、生产 bundle、DEV、seed、UAT、部署或设备策略变更
IMPLEMENTATION_AUTHORITY=true
IMPLEMENTATION_CYCLE_ID=TER_READABILITY_IMPLEMENTATION_2026_09_07
REVIEW_CYCLE_ID=TER_READABILITY_DESIGN_2026_09_07
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
```

本文件是当前获授权实施的执行计划。主 agent 负责全部源码、测试、工具与文档写入；依赖、公共契约、
Android/Web 运行、生产 bundle、DEV、seed、UAT、部署及设备策略仍在本批非授权边界内。
Git 由 Dexter 控制，本计划不要求任何 Git 操作。

正式需求覆盖后三点：15 项闭合目录词表、7 条 TR-R01..TR-R07 规则、12 个包/35 个散文件归位、
3 个职责拆分、testing graph 隔离、7 组 dev-only startup 结构化事实。分析稿只作历史说明，
不得作为实现输入。既有编码规范仍是唯一规范正本；规则追加到
`doc/platform/terminal-coding-standard.md`，不创建第二份规范。

## 1. 目标、取舍与完成定义

### 1.1 实际问题

人类开发者需要从文件名、层名和隐含习惯推测职责；现有散文件没有统一住址，runtime 生产入口还
触达 `src/testing`。启动期的 module、slice、command、actor、port、part、surface 事实也没有
同一 run 的结构化关联。整改的硬边界是可读性和诊断，不改变业务 command、state、owner、UI 行为、
公共 platform-port 契约或测试断言语义。

### 1.2 推荐方案

采用详设中的 C 方案：先建立闭合 vocabulary/rule catalog/checker manifest，再按 kernel/base →
kernel/feature → ui/base → 其余层 → startup 的批次实施；L 规则用 TypeScript AST/graph checker，
R 规则由 fresh review 判断；启动事实由各 owner 直接写入同一 logger tracker，logger 只负责
`startupRunId`、`phase`、`sequence` 和终态。

拒绝三种替代：

- 只搬文件并靠感觉 review：不能阻止 graph、export 汇总块和目录回退。
- 建 hash/path/batch 基线：会复活已退役的 compliance-control 台账；本专题不需要它。
- 让 assembly 聚合七层事实：会扩大依赖面并违反 owner 事实主权；RD-12 明确禁止。

### 1.3 完成定义

实施阶段只有在以下条件全部满足时才可交付 Dexter/Claude 做实施后静态 review：

1. 15 项目录词表、7 条规则和 6 个 L checker 都有正式来源、精确算法、red fixture 和 negative control。
2. `TR-R07` 的 production graph 不可达 `src/testing`，且生产/test 共享 foundations 中的同一 registry。
3. 三处拆分均先完成职责→测试矩阵；矩阵中每行都有结果型 behavior oracle，缺口先补测试。
4. 7 组 startup 事实来自 owner 事实源，同一 `startupRunId`，有 `startup.complete`/`startup.failed`，
   `__DEV__=false` 真实 bundle 不保留 emitter。
5. 业务行为、公共契约、测试断言语义没有变化。
6. CP-0..CP-6 的 focused proof、每阶段三维对账、最终全批三维对账和单独的
   `逐代码与详设对账` 全部为 `MATCHED`；没有 OPEN。

## 2. 执行前置：每个变更点都双读

### 2.1 每个 CP 开始前

主 agent 必须重新打开该 CP 的最小材料，不以本计划的摘要代替原文：

| 输入 | 用途 |
|---|---|
| 正式需求对应章节 | 目标、非目标、批次、RD 判据 |
| 本详设对应小节 | path、symbol、字段、AST、失败行为 |
| `doc/platform/terminal-coding-standard.md` | 既有 TR、§5/§6 的边界 |
| `project-memory/decisions/deterministic-context-only.md` | 上下文和证据边界 |
| `project-memory/decisions/independent-subagent-adversarial-review.md` | fresh reviewer、两轮上限 |
| `project-memory/operations/terminal-coding-standard.md` | TER 目录与分层规则 |
| `project-memory/decisions/terminal-architecture-and-stack-rulings.md` | owner、公共面、平台边界 |
| 该 CP owning source 与 owner tests | 当前 bytes、符号和可观察行为 |

源码定位只用 `rg`、`scripts/context/recall-code`、编译器和真实 source；搜索输出只是 locator，
不能当成语义证据。变更写入前记录 source symbol、当前 import/export、行为 oracle；focused proof 后
用同一批原文重读新源码和证据，确认 owner、行为、失败/恢复和公共面没有漂移。

### 2.2 全局禁止项

- 不用行数上限替代职责判定；不把 TR-R01 做成 checker。
- 不用关键词、正则、调用计数、mock callback、prop 值或 transform 前逻辑尺寸证明行为。
- 不扩展 `PlatformPortBindings`、`CreatePlatformPortsInput`、`PlatformPorts` 或 `LogContext`。
- 不用 `Dimensions`、`useWindowDimensions`、`window`、`Platform.OS`、`terminalSurfaces` 或别的
  surface 测量推断 input frame；measured frame 只能来自真实接收 pointer 的 `InputSurfaceFrame`。
- 不添加 fallback、兼容层、runtime `environmentMode` flag 或跨层 startup aggregator。
- 不恢复 hash-chain、compliance-control、package entry/exit、source 分母台账等退役控制面。
- 不把静态 red fixture、typecheck 或 focused test 写成 Web/Android 真机或 DEV 已验事实。

## 3. CP 与批次依赖图

| CP | 对应批次 | 主要工作 | 前置 | 独立退出门 |
|---|---|---|---|---|
| CP-0 | 批 0 | 规范章节、rule catalog、checker manifest、checker fixtures 的契约 | DESIGN GO | 文档逐条可对账；L 门仍不启用 |
| CP-1 | 批 1 | kernel/base 归位、testing registry 拆分、dispatcher/state/InputProvider 职责矩阵与拆分 | CP-0；矩阵先完成 | focused proof + fresh 3D MATCHED；单独完整 review |
| CP-2 | 批 2 | kernel/feature 12 项散文件归位 | CP-1 | focused proof + fresh 3D MATCHED |
| CP-3 | 批 3 | ui/base 归位、InputProvider 拆分、createElement 实例整改 | CP-2 | focused proof + fresh 3D MATCHED |
| CP-4 | 批 4 | 其余 ui/feature、integration、adapter、assembly；启用所有 L 门 | CP-3 | 6 个 L 门真实全绿 + fresh 3D MATCHED |
| CP-5 | 批 5 | per-port descriptor、7 组 startup 事实、surface measurement、终态、生产 DCE | CP-4 | focused proof；真实 bundle 证据独立记录 |
| CP-6 | 全批收口 | 阶段/全批三维对账、逐代码与详设对账、交付 brief | CP-0..5 | 只有全 `MATCHED` 才能交付 |

批 1 独立进行完整 review，不与批 2–4 合并。批 5 最后进行，因为它依赖最终路径、最终 catalog
和最终测量 seam。任何阶段 OPEN 都停止，不启动下一 CP。

## 4. CP-0：规则与机器门契约

### 4.1 变更范围

未来取得实施授权后，主 agent 才能修改：

- `doc/platform/terminal-coding-standard.md`：并入 15 项 vocabulary、TR-R01..TR-R07、每条反例和
  L/R 档位；不重写既有 TR-01..TR-12，不恢复 500 行硬顶。
- `tools/terminal-readability/rule-catalog.json`：严格 7 行两列 `ruleId`/`tier`，不含路径、hash、
  owner、批次或 checker 字段。
- `tools/terminal-readability/checker-manifest.json`：严格 6 个 L rule entry，含 `ruleId`、`checkerId`、
  `enabled`；批 0 为 `false`，批 4 一次改为 `true`。
- `tools/terminal-readability/check-static.mjs`：统一 AST resolver、真实树扫描、catalog/manifest 反查、
  graph checker；不按 export 集合猜可达性。
- `tools/terminal-readability/check-static.test.mjs`：每个 L 规则至少一组 red/negative control，
  加 RD-7/RD-9/RD-11/RD-12/RD-13/RD-14 的模型夹具。
- `tools/terminal-skeleton/verify-static.mjs`：新增 readability model-test/real-static 两个既有静态序列
  子步骤；CP-0 至 CP-3 只验证 catalog/manifest/fixture 契约，CP-4 才因 manifest 全部 enabled 而验证
  整棵真实树。不能只单独运行新工具而漏掉默认 terminal static entry。

生产规则的源码分母为 `apps/terminal/**/src/**` 的 TS/TSX 源文件，包含 `src/testing/**`；排除生成树、
依赖、package 外的 `test/**` 与 checker fixture。只有 TR-R07 的 graph 分母从 package `src/index.ts` 出发，
不把测试入口当 production entry。TR-R06 以 27 个 package `src/` 根为分母，并分三层判定：根 direct
children 的文件只允许 `index.ts`、`moduleName.ts`、`dependencies.ts`，目录只允许 15 项词表；若存在
`src/features/`，其 direct children 只允许 `actors`、`commands`、`slices`、`variables`；`features/` 更深层
不受本规则目录名约束。
TR-R03 只有迁移后的 `apps/terminal/ui/base/render/src/components/resolvePart.ts` allowlist；不得扩大。

### 4.2 七条 checker 的实现顺序

先实现模型夹具，再接真实树；两者必须调用同一个 `CHECKERS[checkerId]`。每条 checker 都输出
`path | symbol/AST node | ruleId | reason`，没有结果型证明的 R 规则不得进入 manifest。

| rule | 实现与失败观察 |
|---|---|
| TR-R01 | 只登记 R；模型 mutation 把两个职责合回同一函数，fresh review 必须能指出职责边界消失；不得由 checker 判断。 |
| TR-R02 | 对非 `index.ts` SourceFile 访问 `ExportDeclaration`；无 `moduleSpecifier` 的 local export block 失败，定义处 export 和带 module specifier 的 re-export 合法；fixture 覆盖文件末尾/中间 local export 与合法 index/re-export。 |
| TR-R03 | TypeChecker 解析 `react` named/namespace `createElement` symbol，别名同样命中；非 allowlist TSX red，JSX、普通函数、唯一 allowlist negative。 |
| TR-R04 | 访问有 body 的 function/method/constructor/accessor，`parameters.length > 3` 失败；解构/rest 各算一项，overload/type signature 排除。 |
| TR-R05 | 每个 function-like visitor 从 depth=0 开始；进入 `if`、`for`、`for-in`、`for-of`、`while`、`switch`、`try` 加一；catch/finally/case 不另加；nested function 重置；depth>3 失败，三元和短路不计。 |
| TR-R06 | 三层判定：枚举每个 package `src` 根 direct children；根文件只准 3 个法定名、根目录必须属于 15 项词表；若存在 `src/features/`，其 direct children 只准 `actors`、`commands`、`slices`、`variables`；`features/` 更深层不受本规则目录名约束，生成/测试树排除。 |
| TR-R07 | 从每个 package `src/index.ts` 做 TypeScript runtime value import/export resolve，检查运行时可达文件；到同包 `src/testing/**` 失败，foundations 共享合法；type-only import/export 只解析语法、不计 runtime reachability；测试入口不作为 production entry。 |

### 4.3 CP-0 退出观察

只运行文档/模型层的静态检查；不要在本轮执行。实施时的退出条件：

1. catalog 解析出 7 个唯一 ruleId，tier 与需求一致。
2. RD-11 反查每个 L rule 都有 manifest entry；RD-9 反查 R rule 不在 manifest。
3. 每个 L rule 的 red fixture 非零失败、negative control 零失败；TR-R05 的 4 层、3 层、三元/短路
   夹具分别证明 AST 计数定义。
4. RD-7 的动态 category fixture 仍因真实 graph edge 红；不能靠搜索 `startup.` 通过。

CP-0 完成后，fresh reviewer 做一次阶段三维对账；任何 OPEN 留在 CP-0，不能进入 CP-1。

## 5. CP-1：kernel/base 与责任矩阵优先

### 5.1 先建职责→测试矩阵

新增工作文档：
`doc/plans/platform/2026-09-07-v2s-terminal-readability-remediation-responsibility-test-matrix-codex.md`。
它不是 hash/evidence 台账，只是拆分前的可读性工作文档。固定字段：

```text
ownerSource | symbolOrTransition | responsibilityFactFromSource | testFile | testNameOrOracle | preObservation | postObservation | gapAction
```

分母由 owning source 完整 AST、所有 private/exported symbol、状态字段、side-effect transition、
error/result discriminant，以及该 owner 全部 tests 反推。不得照抄需求中的示例项数。每一行都必须有
返回值、状态快照、持久化内容、订阅通知、真实焦点/内容或可见错误等结果型 oracle；只有“函数被调用一次”
不算 oracle。没有 oracle 的职责先补 focused test，补测不得改变原断言语义；矩阵闭合后才能拆。

至少核对以下三个 owning source 和测试族：

| owner | 必须从 source 反推的事实 |
|---|---|
| `apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts::createCommandDispatcher` | definition/request 校验、budget、actor result、journal/ledger、timeout/late completion、peer gateway、reset、resource/cleanup、lifecycle |
| `apps/terminal/kernel/base/state/src/foundations/persistenceEngine.ts::PersistenceEngine` 与 `hydrateStateRuntime` | descriptor/encoding、storage/migration、grouping、hydrate、debounce/queue/health、flush/immediate、result/failure、remove/reset |
| `apps/terminal/ui/base/input/src/components/InputProvider.tsx::InputProvider` | registration/token、edit/value/selection、owner/focus/blur、keyboard dispatch、boundary suspend/restore、snapshot/next-field、capacity/visibility |

矩阵表尾写 `DENOMINATOR_SOURCE=owning source AST + all owner tests`，并写每个 owner 的行数；行数只用于
核对，不是拆分判据。

### 5.2 production/testing graph 拆分

在 `apps/terminal/kernel/base/runtime/src/foundations/` 新增：

- `runtimeResourceAccessorRegistry.ts`：一个 module-level `WeakMap<Runtime, RuntimeResourceRegistry>`、
  production register 与同 registry 的内部读取/释放原语。
- `runtimeStateSyncAccessorRegistry.ts`：一个 module-level `WeakMap<Runtime, () => StateRuntime | undefined>`、
  production register 与同 registry 的内部读取原语。

`apps/terminal/kernel/base/runtime/src/application/createRuntime.ts` 只从 foundations import 两个 register。
`apps/terminal/kernel/base/runtime/src/testing/releaseRuntimeForTest.ts` 和
`runtimeStateSyncForTest.ts` 只从 foundations 读取同一 registry，不再声明 WeakMap/register。
包内测试可以深路径进入 `src/testing`；跨包测试只能走 `./testing` 子路径；判据仅检查 production graph
是否可达 `src/testing/**`。

执行入口：`node tools/terminal-readability/check-static.mjs --rule TR-R07`。graph resolver 复用
`tools/terminal-shared/typescript-analysis.mjs` 的 TypeScript resolution 方式，不执行 factory、不按 root
export 猜测。red fixture 是 production entry 直接 import `src/testing/startupDiagnostics.ts`；negative
control 是 production 只 import foundations registry。

`RD-12` 的 CP-5/CP-6 观察复用 `collectProductionImportGraph`：最终 graph 中 kernel importer 到 ui target
的 edge 集合必须为空；同时扫描 `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx`
的 raw import specifier，禁止指向 runtime/render 的内部路径（公共 package root import 允许）。kernel→ui
package 层级方向由既有规范 §2-C 的 checker 承接，RD-12 只补 assembly 反向读取内部结构这一半，不建立
hash/path baseline。

### 5.3 kernel/base 散文件归位与职责拆分

先完成矩阵和缺口测试，再执行：

- `apps/terminal/kernel/base/state/src/supports/`→`foundations/`，只改 import/export。
- runtime testing registry 按 §5.2 拆开。
- `createCommandDispatcher` 按已闭合矩阵拆为职责清晰的 foundations 单元，保留输入、结果、状态和日志
  语义；`persistenceEngine` 与 `hydrateStateRuntime` 同理。
- 不将生产 stop/dispose 能力从 `releaseRuntimeForTest.ts` 顺手升级；该欠账独立登记，不属于本专题。

### 5.4 CP-1 证明与停止条件

实施时只在矩阵闭合后做路径迁移和拆分。focused proof 至少包含：

- 原 owner tests 全部通过，且 before/after 观察记录来自结果而非调用计数；
- `check-static --rule TR-R07` 的真实 graph 与红夹具；
- kernel/base package typecheck/lint/test 和既有 static sequence；
- production `src/testing` reachability 结果与 shared-foundations 单 registry 结果。

任一职责没有 oracle、production graph 仍到 testing、拆分改变 state/command/result，或需要公共契约扩展，
立即停止 CP-1并报告首败。

CP-1 独立 fresh review 必须读矩阵、source、tests 和 diff；未 `MATCHED` 不得开始 CP-2。

## 6. CP-2：kernel/feature 归位

严格按 12 个散文件分母处理两个 kernel feature 包，不新增目录词表之外的目录：

- `apps/terminal/kernel/feature/sample-member-registry`：`commands.ts`→`features/commands/`，
  `slice.ts`→`features/slices/`，`selectors.ts`→`selectors/`，`types.ts`→`types/`，
  `errors.ts`→`foundations/`，`module.ts`→`application/`。
- `apps/terminal/kernel/feature/sample-staff-session`：同一 6 类归位。

写入前逐文件读取 package `src/index.ts`、dependencies、owner tests 与所有 import；写入后逐文件
重读 export surface 和测试 import。只允许路径变化，禁止改 command/slice/actor/state payload。
实施 proof：两个 package typecheck/test、`check-static --rule TR-R06` 的目录闭合结果、相关 static gate、
CP-2 三维对账。任何 export 数量或业务断言语义变化均为 OPEN。

## 7. CP-3：ui/base、InputProvider 与 JSX/React 例外

### 7.1 归位

- `apps/terminal/ui/base/input/src/context.ts`→`contexts/context.ts`，`types.ts`→`types/types.ts`。
- `model/`→`foundations/`；所有 InputProvider/InputSurfaceFrame 对 `keyboardHeight`、edit、snapshot、
  scroll 的路径改为 foundations；首帧 `frameMetrics=null` 语义不变。
- `apps/terminal/ui/base/dev-host/src/testExpoApp.tsx`→`components/`，`surfacePreview.ts`→`foundations/`，
  `webPlatform.ts`/`webStorage.ts`→`implementations/`。
- `apps/terminal/ui/base/primitives/src/rnr/`→`vendor/`；`components.tsx` 的类型→`types/`，24 个控件
  一控件一文件进入 `components/`，导出集合不变。
- `apps/terminal/ui/base/render/src/foundations/resolvePart.ts`→`components/resolvePart.ts`；它是唯一
  `createElement` allowlist，直接产出 ReactNode。其余 4 个真实 `createElement` 实例改为 JSX 等价树，
  保持 props/provider/content 关系。

### 7.2 InputProvider 按职责拆分

只有 §5.1 矩阵闭合并经 CP-1 对账后，才能拆
`apps/terminal/ui/base/input/src/components/InputProvider.tsx::InputProvider`。拆分只改变内部单元边界，
不改变：system/virtual owner 互斥、两向经 none、首击焦点、surface shrink、focus scroll、snapshot
提交、键盘反馈和字段可见性。每个拆出单元都有结果型 oracle；调用次数不能作为完成条件。

### 7.3 CP-3 proof

执行 input/render/primitives/dev-host focused tests、ui/base typecheck/lint/test、TR-R03/R06 fixtures，
并做 focused behavior comparison：真实 render tree、焦点/owner、keyboard content、surface shrink、
snapshot/result 与路径变更前观察相同。Web transform 前尺寸不算 hit target 证据；本阶段不声称 Web pointer 已验。
CP-3 fresh 三维对账 MATCHED 后方可 CP-4。

## 8. CP-4：剩余归位与启用 L 门

### 8.1 剩余归位

- `apps/terminal/ui/feature/sample-member-desk`：`assembly.ts`→`assembly/`，`commands.ts`→`features/commands/`，
  `module.ts`→`application/`，`parts.ts`→`parts/`。
- `apps/terminal/ui/feature/sample-staff-auth`：同类归位，并 `variables.ts`→`features/variables/variables.ts`。
- `apps/terminal/ui/integration/sample-console`：`assembly.tsx`→`assembly/assembly.tsx`，
  `baseModuleDescriptors.ts`→`application/`，`terminalSurfaces.ts`→`application/`。后者读取/校验
  package metadata，设计已定死，不再留“纯类型则进 types”分支。
- `apps/terminal/adapter/android/device`、`dual-screen`、`persist-kv` 的真实平台文件→`implementations/`。
- `apps/terminal/assembly/android/sample-terminal/src/platformPorts.ts`→`assembly/platformPorts.ts`。

目录表完整后，才把 `checker-manifest.json` 六个 `enabled` 从 false 一次改为 true。RD-11 反查所有
L rule，RD-9 反查 R rule 不在 manifest；不得只跑登记项。

### 8.2 CP-4 proof

运行仓库定义的 terminal static sequence（其中 `tools/terminal-skeleton/verify-static.mjs` 已接入
readability model-test/real-static 两个子步骤）、`check-static` 全规则、受影响 packages 的
`yarn --cwd apps/terminal typecheck`、`test`、`lint`，并保存真实输出。若测试命令实际触发需要额外权限或
运行环境，停在授权边界报告，不把预期结果写成 PASS。CP-4 fresh 3D review 逐条看 vocabulary、TR-R02/3/4/5/6/7、
公共面和 RD-10，全部 `MATCHED` 后方可 CP-5。

## 9. CP-5：startup 事实、descriptor 与 dev-only DCE

### 9.1 startup tracker 与日志语义

在 `apps/terminal/kernel/base/platform-ports/src/foundations/createPlatformPorts.ts` 内保持 private
tracker：一次 `createPlatformPorts` 在 `__DEV__` 分支生成格式为
`terminal-startup-${nowTimestampMs()}-${processLocalCounter}` 的 `startupRunId`，sequence 从 1 开始；
`createLogger`、`scope`、`withContext` 共享 tracker。所有 startup `data` 带 `startupRunId`、`phase`、
`sequence`，继续通过 `sanitizeLogEvent`，不扩展 `LogContext`、`LoggerPort` 或三种 `PlatformPorts`
公共类型。只有 sink/console 返回 succeeded 的 group event 才登记到 tracker；sink failure 不推进
complete。complete 使用 guarded terminal write，不参与 group 计数；owner 写 failed 后 tracker 拒绝
automatic complete。

`startup.surfaces` 由 `Map<displayMode, {declared, measured}>` 追踪，不是单一 category：assembly 在
每个实际创建的 `SurfaceInputFrame(displayMode)` 前，才用该 displayMode 的 package baseline 登记 declared；
这不是把所有静态 surface metadata 预登记成已创建 surface。真实 `InputSurfaceFrame.onLayout` callback
才登记同一 displayMode 的 measured；至少一个同 key pair 完成前 surfaces 不满足终态条件，measured 先到则
pending，同 key 重复 layout 去重，后续实际 surface 只补事件，不重新 complete。

自动终态规则：六组 `startup.modules/slices/commands/actors/ports/parts` 加上 surfaces 的 declared+
measured 必需事实都成功写入后才写 `startup.complete`；任一 owner 启动失败在同一 logger 写 `startup.failed`，失败后禁止 complete。终态
仍走既有 sink/console 结果；日志内容不得含密码、手机号、token、cookie、Authorization、raw payload/IP。

### 9.2 port descriptor

在 `createPlatformPorts.ts` 内定义不导出的 `Symbol.for('catering-v2s.platform-ports.descriptor')`
reader。当前计划中的 attach sites 是以下精确位置：
`apps/terminal/kernel/base/platform-ports/src/defaults/logger.ts::consoleLoggerBinding`；
`apps/terminal/kernel/base/platform-ports/src/defaults/unavailableAppControl.ts::unavailableAppControlPort`、
`unavailableConnector.ts::unavailableConnectorPort`、`unavailableDevice.ts::unavailableDevicePort`、
`unavailableHotUpdate.ts::unavailableHotUpdatePort`、`unavailableLogUpload.ts::unavailableLogUploadPort`、
`unavailablePersistSecure.ts::unavailablePersistSecurePort`、`unavailableScript.ts::unavailableScriptPort`、
`unavailableTopologyHost.ts::unavailableTopologyHostPort`；
`apps/terminal/kernel/base/platform-ports/src/defaults/processMemoryStorage.ts::createProcessMemoryStateStoragePort`；以及迁移后的
`adapter/android/device/src/implementations/androidDevice.ts::createAndroidDevicePort`、
`adapter/android/persist-kv/src/implementations/androidPersistKv.ts::createAndroidPersistKvPort`、
`ui/base/dev-host/src/implementations/webPlatform.ts::createWebDevicePort`、
`ui/base/dev-host/src/implementations/webStorage.ts::createWebStateStoragePort`。Android 当前旧路径分别是
`src/androidDevice.ts`、`src/androidPersistKv.ts`，Web 当前旧路径分别是 `src/webPlatform.ts`、
`src/webStorage.ts`。其中前 1 个是 logger singleton、随后 8 个是 unavailable singleton、再后 1 个是
state-storage factory，最后 4 个是 Android/Web factory，共 14 个真实 attach 位置；checker fixture 另列，
不计入真实分母。singleton 必须在定义处按原有 freeze 语义附加，factory 必须在 returned binding freeze 前附加。
每个位置在 `__DEV__` 分支给自己的 returned binding 加非枚举、不可写、冻结 sidecar；sidecar 只有 port、capability、
`state: real|unavailable`、`source: default|adapter|web|fixture`。
`createPlatformPorts` 只 Reflect.get，不调用 capability，不与 defaults 做 identity 比较；缺失 descriptor
在 DEV 是 `descriptorStatus: 'missing-descriptor'` 并让 focused test 红，不能另造 `unknown` 状态；TEST/PROD
不读取。partial-real 必须逐 capability
表达，例如 Android device 的 `getDisplayInfo=real`、其余 unavailable。公共三类型绝不加 provenance 字段。

`createPlatformPorts` 组装 root 后、return 前发唯一 `startup.ports`；它是 ports owner，assembly 不读取私有
结构。这只是在 `__DEV__` 下增加一次诊断写入，不引入 registry/`seal()`，不改变十个 binding 和冻结 root
的返回语义；TEST/PROD 不执行。descriptor capability 分母从当前公开 interface 逐条反推；任何接口形状
不匹配停机交 Dexter。

跨包 sidecar 不增加 public export：每个已列 factory attach site 使用唯一
`Symbol.for('catering-v2s.platform-ports.descriptor')` 协议；`check-static.mjs` 额外扫描 key、字段、
enumerable/frozen 形态，错误 key 与缺 capability 的 fixtures 必须红。不得在 adapter/dev-host 自造第二
个 symbol、改变 source/state 枚举或把 descriptor 塞进三个公共 PlatformPorts 类型。

### 9.3 runtime/render/surface owner

- `apps/terminal/kernel/base/runtime/src/application/createRuntime.ts::createRuntime` 在既有 descriptors/
  actorRegistry 边界写 `startup.modules/slices/commands/actors`，只在 `__DEV__` 分支读现有 arrays/maps。
- `apps/terminal/ui/base/render/src/components/RenderProvider.tsx::RenderProvider` 在已有 effect 中一次性从
  `uiCatalog.entries` 与 `rendererCatalog.resolve` 写 `startup.parts`；不扩展 RendererCatalog、不反推组件树。
- `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx::SurfaceInputFrame` 写 declared
  surface；事实源是 `application/terminalSurfaces.ts` 的 package metadata baseline，只用于日志，不能下传 input。
- `apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx::handleSurfaceLayout` 是 measured owner，
  由真实 pointer View 的 `onLayout` 产生 `LocalFrameMetrics`；新增 `onMeasuredFrame` 回调，同尺寸去重。
  wrapper 接收 `displayMode` 和同一 logger，只转发 measured event，不测量、不读取 preview viewport。

首帧未测量时不发 measured event，原有 `frameMetrics=null` 和不渲染 keyboard 行为保持。`imeInset` bridge 保持。
`dev-host/src/components/testExpoApp.tsx` 仍只测 preview canvas transform，不冒充 measured frame。

### 9.4 CP-5 proof 与 DCE

focused proof 分开写：

1. logger tracker：同 logger/scoped logger 共享 runId/sequence，七组完结触发 complete，失败不 complete；
2. descriptor：default unavailable、Android device partial-real、Android persist-kv real、Web device partial-real、
   Web persist-kv real；无方法调用、无 identity 比较、无公共面扩展；
3. surface：declared 与 measured 字段来源不同，首帧无 measured，尺寸变化来自真实 onLayout callback；
4. runtime/render：facts 与 owner source 对齐；无跨层 aggregator；
5. 先用 `tools/terminal-readability/vitest.dev.config.ts` 运行上述四个 startup 专测入口，确认
   `__DEV__='true'` 分支实际产生事件；再用 `vitest.prod.config.ts` 对同一入口集合确认
   `__DEV__='false'` 不产生 startup event。两个 config 必须在 import 前用 Vite define 注入常量，
   不改 `tools/terminal-shared/react-native-vitest.setup.cjs`，不以 `environmentMode`、临时 global 或
   字符串搜索代替执行证据；
6. `__DEV__=false` 的真实 Expo/Metro production export 删除 startup emitter。模型 graph fixture 只是
   RD-7 静态证据，不替代真实 bundle；未获运行授权前不得执行此项。

`__DEV__` 的 TypeScript ambient 唯一落点是 `apps/terminal/terminal-env.d.ts`，内容仅为
`declare const __DEV__: boolean`；`apps/terminal/tsconfig.base.json` 的 `files` 纳入它，保证
platform-ports/runtime/render/input 的 package typecheck 解析同一声明。它不进入共享 RN setup、不写
`global.__DEV__`，也不允许 package-local 重复声明；运行时仍只能由 Vitest/Expo/Metro compile-time define
提供值。实施时若 tsconfig inheritance 不能覆盖四个目标 package，CP-5 停机，不得临场新造第二个 ambient
入口或退回 `environmentMode`。

仍未取证的 Android 真启动、副屏真实输入、Web 真实 pointer、四种布局真实视觉结果必须分别标为
`NOT_RUN/NOT_VERIFIED`，不得从 static/focused 证据升级成 PASS。

## 10. CP-6：收口闸门

### 10.1 阶段三维对账

每个 CP focused proof 后、下一 CP 开始前，由 fresh 独立子 agent 只读对账：需求、详设/计划、项目记忆与
owning source 三维逐条比较行为、形态、动作、关系、位置、文案、限制、状态/控制、失败/恢复、可访问性/焦点、
数据来源/失效边界。结论只有 `MATCHED` 或 `OPEN`；OPEN 必须主 agent 根因修复并由 fresh agent 复查。

### 10.2 全批三维对账

CP-5 完成后、整体测试前重新从头走全批，不把阶段结论简单相加；特别复核批次搬移后路径、公共面、测试
分母、startup owner 和非目标边界。它与阶段对账、代码/详设对账都不同。

### 10.3 逐代码与详设对账（显式交付步骤）

由主 agent 执行，fresh 子 agent 只读盲审。范围是本详设每一条源码锚点，不抽样，包含：

- 每个移动/改名源文件及其最终 import/export；
- 15 项目录词表与根文件约束；
- 7 个 rule AST/graph checker、catalog/manifest 反查、fixtures；
- 三处职责拆分及矩阵每一行；
- runtime/testing registry 的共享 foundations 和 production reachability；
- startup tracker、descriptor、7 组 owner、surface callback、DCE；
- 所有新增/删除公共面、测试、README/invariant 同步点。

逐代码对账的 RD 标签锚点固定如下，避免只靠读者把散文归并回判据：

| RD | 计划锚点 |
|---|---|
| RD-1 | §4.2 的 TR-R06 三层目录分母与 features 四项固定子目录 |
| RD-2 | §5.2 的 production graph 不可达 `src/testing/**` |
| RD-3 | 墓碑行，仅记录已删除的 500 行硬顶，不参与判定 |
| RD-4 | §4.2 的 TR-R03 allowlist 与 CP-3 的 createElement 迁移 |
| RD-5 | §9.3 的七组 startup owner 与事实源 |
| RD-6 | §9.2 的 per-capability real/unavailable descriptor |
| RD-7 | §4.3 的 dynamic-category graph fixture 与 CP-5 的真实 DCE |
| RD-8 | §4.2/CP-0 的 6 个 L checker red/negative control |
| RD-9 | §4.2/CP-0 的 R 不进 manifest mutation |
| RD-10 | §6 的职责→测试矩阵及拆分前后 behavior oracle |
| RD-11 | §8.1 末尾从 catalog 反查并一次开启全部 L 门 |
| RD-12 | §5.2 的 `collectProductionImportGraph` 分层观察 |
| RD-13 | §6 的 owning source 职责分母与拆分前置 |
| RD-14 | §9.3 的 declared/measured 双 owner 链路 |
| RD-15 | §9.1 的 shared runId、sequence 与 complete/failed 终态 |

记录固定字段：

```text
file | symbol | design clause | code observation | MATCHED/OPEN
```

结论只能是 `MATCHED` 或 `OPEN`。任何 OPEN 未闭合时，交付状态必须是：

```text
IMPLEMENTATION_NOT_READY
DELIVERY_TO_DEXTER_AND_CLAUDE=BLOCKED
```

不能以三维对账、编译、测试、调用次数或静态字符串搜索替代它。只有全量 `MATCHED` 才能生成实施后
review brief；本轮设计/计划交付不声称实施完成。

## 11. 评审安排与证据格式

本轮设计/计划由 fresh 独立子 agent 做 `REVIEW_TARGET=DESIGN` 盲审：

```text
REVIEW_CYCLE_ID=TER_READABILITY_DESIGN_2026_09_07
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
```

reviewer 先读正式需求、既有规范、当前 owning source，再读本详设/计划；只读、不改文件、不运行改变环境
的命令。第一轮 findings 由主 agent 逐条重开 source/需求并修文档，第二轮为定向独立复核且是本 cycle
最后一轮；不得第三轮。第二轮须声明 `ROUND_FINAL_DECISION=SELF_DECIDED`，作者对第二轮后仍可执行的
文档闭合动作负责，但不得把作者闭合写成独立 reviewer 的 GO。

review finding 固定包含：`M/S/N`、状态标签（`CONFIRMED`、`PARTIALLY_CONFIRMED`、
`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE`、`DEXTER_DECISION`）、仓根相对路径、
“第 X 行”、失败场景、影响面、最小修复、是否需要 Dexter 裁决。静态事实不能写成 focused/Web/Android/DEV PASS。

## 12. 当前工作结束条件与交付 brief

本轮结束时交付：

1. `doc/plans/platform/2026-09-07-v2s-terminal-readability-remediation-implementation-design-codex.md`；
2. 本文件；
3. fresh 独立设计 review 的只读报告与主 agent 的处置结果；
4. 可复制给 Dexter/Claude 的中文 brief，明确 `REVIEW_TARGET=DESIGN`、`GO/NO-GO`、`M/S/N`、输入路径、
   授权边界和“未授权实施”。

如果 review 后仍有未闭 M/S，不能写 GO；如果只有 N，仍必须如实列出。DESIGN GO 只代表详设/计划可进入
下一轮实施授权评审，不代表源码、编译、测试、bundle、DEV、Android/Web 或 UAT 已完成。

## 13. 计划自检

```text
SCOPE=docs only now; implementation authority false
BATCHES=0 -> kernel/base -> kernel/feature -> ui/base -> remaining layers -> startup -> closeout
PRECONDITION=responsibility-to-test matrix before all three execution-boundary splits
RULES=7 catalog rows; 6 L checkers; TR-R01 review only; TR-R05 exact AST depth
GRAPH=production cannot reach src/testing; foundations registry shared once
PORTS=internal non-enumerable descriptor; no probing/identity/public contract extension
SURFACES=declared package baseline != measured InputSurfaceFrame onLayout fact
STARTUP=seven owner groups; shared runId/sequence; complete/failed; __DEV__ DCE
PROOF=focused evidence separated from Web/Android/DEV; behavior not structure-only
RECONCILIATION=stage/whole 3D plus separate full code/design reconciliation
DELIVERY=any OPEN => IMPLEMENTATION_NOT_READY and DELIVERY_TO_DEXTER_AND_CLAUDE=BLOCKED
```
