SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# V2S TER 门缺陷整改与 workspace scoping 详细设计（Codex）

## 0. 元数据、目标与授权边界

```text
BUSINESS_SOURCE=doc/plans/platform/2026-09-01-v2s-terminal-gate-defect-registry-claude.md §1-§3.5, §5
JOURNEY_REFS=NOT_APPLICABLE_WITH_REASON：本批整改 TER 工程门与 kernel.base.state 的纯工程能力，无用户可见 Journey
IA_REF=NOT_APPLICABLE_WITH_REASON：不新增页面、导航、surface 或信息层级
INTERACTION_REF=NOT_APPLICABLE_WITH_REASON：不改变终端用户交互
AUTHORIZED=详设与实施计划；Dexter 已授权仅实施单元 A（D-8、D-1…D-4）及其 TER-local 验收
NOT_AUTHORIZED=单元 B、D-5…D-24/workspace scoping、display-context、native/Gradle/设备、DEV/seed/reset/browser L2/UAT/deploy 或仓级 normal verify
IMPLEMENTATION_AUTHORITY=UNIT_A_ONLY
```

真实目标不是“让 20 道门更聪明”，而是把现有门从“冻结合法演进或靠名字猜语义”改成三类右尺寸证明：

1. 编译器/AST 能完全证明的结构事实，由机器作 exact、fail-closed 判定；
2. 真实行为由 focused tests 接管，尤其是重启恢复、PortResult 处置与 role effect 的运行时能力；
3. 数据流与方案语义超出有限 AST 能力时，明确标 `UNENFORCEABLE_BY_MACHINE`，交 fresh 独立语义 review，不建设全程序数据流分析器。

本批覆盖 D-1…D-14、D-20…D-24 与 workspace scoping。D-15…D-19 明确不实施；D-24 只为未来 D-16 留唯一收集器接口，不提前改变依赖边的 owning source。

## 0.1 实施前必须采用的回源修正

缺陷登记是实施输入，不是不可质疑的机器正本。独立复算得到四处必须在本设计中纠正或收窄的口径：

| 项 | 当前登记口径 | 本设计采用的真实分母/结论 | 处置 |
|---|---|---|---|
| D-22 | 19 处消费字段、8 个闭集 union | **迁移当刻为 22 处消费字段、9 个具名闭集 union**；补入 `PersistIntent` 的两个真实 direct consumer，并更正 `DefineErrorInput`、`RequestLifecycleSnapshot` 符号 | 以 §2.2 的 22×9 为迁移 baseline；后续按 invariant delta 演进；`PersistIntent` 只作闭集漂移防线，不宣称它单独证明 D-6 行为 |
| D-13b | 只改 `skeleton-graph.ts` 增删节点，tools/tests 零改动即全绿 | 只改图而不建/删 package 时，现役 package census 正确行为必须红 | 收窄为“图与对应 package 身份完成一次合法增删，tools/tests 零代码改动即绿” |
| D-7 | storage 有五态；`clear` 必须存在与 state 禁用互斥 | `StateStoragePort` 返回四态 `succeeded/failed/timed-out/unavailable`；全量声明 `clear` 与 state 按 namespace 禁用 `clear` 可以同时成立 | 不删端口、不为 state 开例外；只修类型来源判定与直接丢弃检查 |

另有一个文本勘误：缺陷登记 §7 仍写“D-8 的 312/61 计数”，其中 `61` 已被同文 §3 的权威表废止。实施只认 `12 / 312 / 25 / 120 / 457`，不认 `61`。

这些修正均不改变产品/Journey；它们必须作为 Claude DESIGN review 的定向核验点。

## 0.2 第一轮 DESIGN review 的结构处置

本节只处置 Dexter 已下的三条裁定与本轮已交付的两条结构建议；尚未提供全文的其它 findings 不在本次修订中预判。

| 输入 | 分类 | 处置 |
|---|---|---|
| D-9 不建可见性机制 | `DEXTER_DECISION` | 删除 sync companion、unique-consumer 门、相关 red 与技术停机；`createStateRuntime`、`StateRuntime`、`getStore/getState` 形状不变；只在 TR-09 写消费边界并进语义 checklist |
| 整批与 display-context 解耦 | `DEXTER_DECISION` | 组织轴改为“阻塞下一个 owner 包”；删除 `DISPLAY_CONTEXT_*` marker、前置与 owning requirement 停机条款 |
| D-5 移出阻塞批 | `DEXTER_DECISION` | D-1…D-4 才是下一 owner 包阻塞；D-5 进入后续能力单元，理由仅为避免二次迁移并减少一项 D-3 例外 |
| G0 数字会被合法变更作废 | `CONFIRMED` | D-8 invariant 迁移提前到单元 A 首个写入 CP；绝对数只用于迁移当刻双读零差，之后每次合法变更记录 delta，不再作为完成信号或停机常量 |
| 整批过大，应切小 | `PARTIALLY_CONFIRMED` | 实施交付切成独立单元 A/B，各自冻结、验收并进入独立 `REVIEW_TARGET=IMPLEMENTATION` cycle；本次 DESIGN 按 Dexter 明示仍进入原 cycle 的 ROUND=2，不重置设计 cycle |
| 删除步骤级独立对账 | `REJECTED_WITH_EVIDENCE` | `AGENTS.md` 仍把每个批准 CP 后 fresh 三维对账与整批对账列为硬约束；切小不能取消它。通过减少 CP 数和限定每次对账为当前 CP 分母控制成本，不把它扩成重复整批 review |

单元 A 只交付 D-8 名单迁移基础与 D-1…D-4；单元 B 在 A 的 implementation review 收口后重新冻结当前 invariant，再交付 D-5…D-14、D-20…D-24 与 workspace scoping。两单元之间不得同时实施或用 B 的合法变化污染 A 的迁移基线。

## 1. 问题与方案比较

| 方案 | 优点 | 失败点 | 结论 |
|---|---|---|---|
| A. 按 D-1…D-24 各写一段新正则 | 修改快 | 继续复制名单、变量名与文本代理；固定夹具之外立刻失效 | 拒绝 |
| B. 删除全部严格门，只靠 review | 不再误伤合法功能 | 会丢失编译器本可精确证明的结构回归，review 负担线性增长 | 拒绝 |
| C. 建全程序数据流分析与 capability system | 理论覆盖最广 | 当前一人+两 AI 阶段明显过重，仍无法证明业务处置语义 | 拒绝 |
| D. 小型共享 AST 基础 + 包内 invariants + focused behavior + review checklist | 保留机械检出力，合法功能只改 owning package；语义不冒充 machine PASS | 需要一次集中迁移与较多 red corpus | **采用** |

方案 D 只抽四个真正重复的基础：TypeScript symbol 解析、工作区依赖语法收集、跨工具平台词表、包内 invariants 读取。各门仍保留自己的单一职责，禁止造一个“万能 gate engine”。

## 2. 冻结分母

### 2.1 D-8 迁移输入

当前 12 张独立 exact-set 表经求值为：

```text
PUBLIC_EXPORTS=312（contracts 69 + platform-ports 124 + state 56 + runtime 63）
OTHER_TABLE_KEYS=25
OTHER_TABLE_MEMBERS=120
TOTAL_SCALARS=457
```

`runLedgerRecordShape` 的 13 个内联成员不计入 12 张表，但同批迁移。上述数字只用于**单元 A 的 D-8 迁移当刻**证明旧表与新 invariant 双读零差，不是未来功能上限，也不是单元 B 的停机常量。

迁移完成后：

- workspace scoping 合法新增一个 state root export 时，只记录 state 与总公开面的 `+1` delta；
- D-5 把 `previousMode/nextMode` 两个内联字面量改绑 `RuntimeInstanceMode` 时，只记录 consumer bindings 的 `+2` delta；
- 单元 B 的 baseline 从当时 package invariants 求值，不继续期待 `312` 或 `22`；
- 中央工具不得保留迁移总数断言，合法变更只改 owning package invariant 与源码。

### 2.2 D-22 的 22 个消费绑定与 9 个具名 union

| 具名 union | 消费绑定 |
|---|---|
| `AppModuleKind` | `contracts: AppModule.kind`；`runtime: RuntimeModuleDescriptor.kind` |
| `ErrorCategory` | `contracts: ErrorDefinition.category`；`AppError.category`；`DefineErrorInput.category` |
| `ErrorSeverity` | `contracts: ErrorDefinition.severity`；`AppError.severity`；`DefineErrorInput.severity` |
| `ParameterValueType` | `contracts: ParameterDefinition.valueType` |
| `RequestLifecycleStatus` | `contracts: RequestLifecycleSnapshot.status`；`runtime: RequestExecutionView.status` |
| `CommandLifecycleStatus` | `contracts: RequestCommandSnapshot.status` |
| `RuntimeInstanceMode` | `runtime: RuntimeInstanceModeState.instanceMode`、role action/selector/effect 的四处绑定，共 5 处 |
| `WorkspaceKey` | `state: WorkspaceRouteContext.workspace`；`WorkspaceStateKeys` 的 MAIN/BRANCH 两成员，共 3 处 |
| `PersistIntent` | `state: StateRuntimeSliceRegistration.persistIntent`；`state: RegisteredStateRuntimeSlice.persistIntent` |

合计 `2+3+3+1+2+1+5+3+2=22`。这是 D-8 迁移当刻的 baseline。`PersistIntent` 只覆盖两个真实 direct consumer；同值的 inline union 不冒充命名 consumer，也不把 D-6 的行为接管归因到这条静态绑定。D-5 实施后 `RuntimeRoleChangeEffect.previousMode/nextMode` 改用 `RuntimeInstanceMode`，预期产生 `+2` delta；单元 B 不以 22 为硬常量。三条 `CommandRouteContext` inline literal union 继续由 literal-union exact-set 管，不混进迁移当刻的具名 consumer baseline。

选择这 9 个 union 是有限的风险分母，而不是四个包内全部 33 个闭集 union：它们要么已经跨包出现在公开 record/descriptor/member 上，要么存在已证实的跨步骤后果（`PersistIntent` 会改变 D-6 的退役变异输入）。其余 24 个 union 仅是包内实现状态、单一端口/结果枚举，或没有当前跨包消费与本批变更后果；把它们纳入会把内部重构错误伪装成公共契约漂移，并扩大 invariant 维护面。若后续出现新的跨包 consumer 或具体连带后果，按 owning package invariant 增量登记，不把 33 个全集做成可派生门。

`PersistIntent` 必须保留在迁移分母：它不是把 33 个 union 全部纳入的理由，而是唯一已有直接证据会改变 D-6 退役变异结果的跨步绑定。其它 24 个 union 在本单元没有这种已证实的连带后果，也没有跨包公开消费，因此不进入 A 的 invariant；其后若出现新的 consumer，先更新 owning invariant 与 focused red corpus，再由 review 判断是否属于当前分母。

### 2.3 D-24 语法分母

统一依赖收集器必须覆盖：

1. `ImportDeclaration`，含 `import type`；
2. `ExportDeclaration`，含 `export type`；
3. `ImportTypeNode`；
4. 字面量 `require()`；
5. 字面量动态 `import()`。

当前 `ImportTypeNode` 为 15 处，其中生产 `src/` 10 处；当前工作区 package 的 `export-from` 为 0。非字面量 `require/import()` 不进入“已覆盖”主张；若实施期间出现，按 §13 停机，不能静默忽略。

type-only 分类固定如下：生产 `src/**` 或 package 入口中的 type-only 边落 `dependencies`；只存在于 `test/**`、`vitest.config.*` 或 test-only 支撑中的 type-only 边落 `devDependencies`；同一 package 同时有 production 与 test 边时 `dependencies` 胜出且不得重复声明。

### 2.4 其余已核分母

- TR-01 当前生产写入点 9 处；单元 A 收口时受控 exception 为 6 处，单元 B 完成 D-5 后 role-effect 写点退出并降为 5 处。
- D-6 行为接管当前有两条独立形状，位于 runtime `foundations.test.ts` 与 `requestLedgerCleanup.test.ts`。
- workspace 当前 9 条 throw 路径、1 条泛化 `toThrow`、0 条真实 store 连接用例、0 个生产调用点；其普通 `input.dispatch` 不属于 Redux Store dispatch，也不进入 TR-01 exception。
- D-8、D-22、D-24 的初始分母须在单元 A 的 CP-A0 用 AST/求值脚本重新打印；单元 B 再从迁移后的 invariant 建立新鲜 baseline，本文数字不替代任一时点输出。

## 3. 共享基础与唯一住址

### 3.1 `tools/terminal-shared/` 只新增四个窄模块

| 模块 | 唯一职责 | 明确不做 |
|---|---|---|
| `typescript-analysis.mjs` | 创建 terminal TS Program、resolve alias、定位 package public symbol、识别 symbol origin | 不做跨函数全程序数据流 |
| `package-invariants.mjs` | 读取并 schema-validate 四个 package-local invariant JSON；提供 order-independent set/map compare | 不从源码反向生成 expected |
| `platform-vocabulary.mjs` | package root 分类、node builtin 裁定、forbidden capability vocabulary 与适用 AST shape | 不按未知 npm 名猜平台属性；未知分类 fail closed |
| `workspace-dependency-collector.mjs` | 返回五类语法的 workspace edge、runtime/type-only 与 source class | 不改变 D-16 的 graph ownership |

不得把四个模块合成“terminal-gate-framework”；任一门只消费它需要的函数。

### 3.2 package-local invariant 是名单唯一 owner

四个已实现 kernel package 根新增 `terminal-invariants.json`。它不进 Metro 生产入口，不从 package root export：

| package | 拥有的 section |
|---|---|
| contracts | `publicExports`、`runtimeIdPrefixes`、literal unions、具名 closed unions 与本包 consumer bindings |
| platform-ports | `publicExports`、`portKeys`、`portMethods` |
| state | `publicExports`、closed-union bindings、workspace axis symbols |
| runtime | `publicExports`、module/actor context members、internal commands/definitions、ledger record exact shape、closed-union bindings、TR-01 exceptions、`owned` |

每个文件含 `schemaVersion: 1`。工具只能读取、校验和比较，不得内置这些名单副本。新增合法功能时改源码与 owning package invariant；缺任一侧或多任一侧都红。

对类型成员，invariant 记录 semantic declaration id、`readonly`、`optional` 与 normalized checker type；不得记录脆弱行号。D-23 必须从 `src/index.ts` 的 public symbol 出发解析真实声明，排序更早的同名诱饵不进入分母。

### 3.3 platform vocabulary 的 fail-closed 方式

specifier 先归一到 package root：scoped 包取前两段、unscoped 包取第一段、`node:` 单列。每个 root 在唯一 vocabulary 中分类；未知 external root 红。三个门各声明允许/禁止的 category 子集：

- kernel independence 禁 Expo/React Native/UI/native capability；
- contracts 另禁 `fs/path/os/child_process`；
- platform-ports 在 `src/defaults/**` 保留已批准 Node 默认实现边界，其他位置按其规则禁用。

`@reduxjs/toolkit/query` 归一为 `@reduxjs/toolkit`，不会因子路径误红。新增外部依赖先分类并做独立 review；机器不猜“未来未知包是否平台包”。

## 4. 阻塞下一个 owner 包的 D-1…D-4

### 4.1 D-1/D-2：kind 的单一正本与符号解析

已实现 owner 包在 `src/moduleName.ts` 同时导出：

```ts
export const moduleName = 'kernel.base.runtime' as const
export const moduleKind = 'owner' as const
```

未落真实 slice 的包继续只在 `skeleton-graph.ts` 声明 `plannedKind`。`graph-model` 对每包执行：

1. 用路径规则定位 package，但用 TS AST 读取 `src/moduleName.ts` 的导出 symbol；
2. 若 `features/slices/**` 中存在解析到 state `defineStateRuntimeSlice` 的调用，则 `moduleKind` 必须存在且 `plannedKind` 必须删除；
3. 无真实 slice时恰好允许 `plannedKind` 或 `moduleKind` 一处；两处并存、两处皆无均红；
4. runtime internal module 的 `kind` expression 必须沿 alias 链解析到本包 `moduleKind` symbol，不能是相同文本的局部常量。

namespace import、中间常量、barrel export 可用，只要最终 symbol origin 是 `src/moduleName.ts`；shadow、非正本同名常量、注释与 raw regex 均无效。`stringProperty` 删除伪通用的 runtime 常量替换，调用者必须显式传入当前 package binding。

D-1/D-2 共用一套第二包 scratch fixture；不创建任何第二个 owner 包的生产 slice。fixture 同时覆盖 kind 已落、计划值并存、两者皆无、正本移位、相反注释、owner/toolkit 与 slice 不一致。

### 4.2 D-3：TR-01 改为 symbol-origin + 有限例外

合格 actor 同时满足：路径在 `features/actors/**`，且 AST/类型上导出 `ActorDefinition` 或包含解析到 runtime `defineActor` 与 `onCommand` 的组合。任何包的合格 actor 都可写 owner state。

门识别的 dispatch 写入表达式以 symbol origin 为准，覆盖直接调用、别名、解构、element access、同文件 helper 实参和一跳 alias；Redux `Store`/Toolkit `EnhancedStore` 的 `dispatch` 通过接收者类型识别，非 Redux 对象的同名方法不误红；`window/globalThis` 的同名函数也不因名字误红。注释、字符串、仅路径为 actors 的 helper 不获豁免。

单元 A 的 exception 由 package invariant 显式拥有：

1. state `createStateRuntime` 内两个 store 实现点；
2. runtime dispatcher 的事实写入与 actor-context dispatch bridge 两点；
3. runtime `createRuntime` 的 lifecycle dispatch bridge；
4. runtime request-ledger role effect；该项仅在单元 A 暂存，单元 B 完成 D-5 后必须删除。

单元 A 收口时分母为 6；D-5 完成后 request-ledger role effect 必须从 exception 消失，届时分母降为 5。exception 每项固定 `declarationId + dispatchExpression + reasonCategory`，缺理由/路径漂移/新增命中均红；每个完整四元组必须恰好消费一个真实调用点，声明但零命中或调用超出已声明次数均红，不得从当前扫描命中自动生成。

`test/**` 明确不进生产写入门。更深 helper、对象字段、多跳与跨文件高阶回调由 §10 checklist 审查。

TR-01 正文在本次单元 A 实施时同步改成：actor 资格按路径+定义双条件；state/runtime 的必要内部写点为具名例外；dispatch 例外只允许写在已登记的目标声明体内，不能靠 actor 文件导出另一个 dispatch wrapper 绕过；新增例外须回正本裁定。

### 4.3 D-4：动态 task owner 与可观测 test kind

`expectedTaskOwners(task,batch)` 从当前投影 package 的 `package.json.scripts[task]` 派生：

- `typecheck` 仍要求投影全集；
- `test/lint/clean` 只取真实声明者；
- batch 必须真实过滤 graph，传 1 与 2 得到不同集合；
- 删除 frozen owner arrays、四段 kernel 身份断言和 lint/clean 恒空特判。

测试脚本只允许两种 owned runner family：

1. kernel Vitest runner：中央 `run-vitest-package.mjs`；
2. Expo module/Jest runner：现有 `internal/module_scripts/test.js`，经统一 marker contract 适配。

runner 以文件发现和测试进程退出状态计算 `REAL_TESTS/NO_TEST_FILES`；package script 不得自己 echo kind。零测试显式成功并打印 `NO_TEST_FILES`；REAL 只有测试进程成功且发现数大于零才打印。`passWithNoTests` 在 Vitest config/runner 显式为 false，不依赖默认值。marker 缺失、重复、package 错、runner family 未知均红。

每个 package invariant 另含 `owned`：`test` 明确为 `ABSENT`、`REAL_TESTS` 或 `NO_TEST_FILES`，`lint/clean` 为 `ABSENT` 或 `OWNED`。工具同时对拍 package.json script、invariant owned 值与 approved runner 的真实 file-discovery/exit marker；删除 runtime `test` script 或清空 runtime 测试目录不得让它从分母消失，必须与 invariant 不一致而红。新增 package/test/lint/clean 只改 package 自己及其 owning invariant，工具零名单改动。若当前 Vitest/Jest 不能提供稳定的机器可读发现结果，实施必须停机，不能解析人类 summary。

`owned` 是 D-4 的唯一归属事实载体：verify 不再维护中心 `terminalTestOwners`、`terminalRealTestOwners` 或按包写死的身份断言。每个投影包的 `owned.test.kind` 必须同时与 package script 的存在/runner 及实际 marker 的 `kind`、`package` 双向相等；删除脚本和清空测试目录分别必须命中 owned 对拍。这样“包是否应该有测试”仍留在 invariant/语义 review，而“已声明 owner 是否真的执行并产出相应 marker”由机器闭合。

### 4.4 阻塞出口

D-1…D-4 的 model tests、focused behavior、真实树 static/typecheck/test 同时绿后，只形成：

```text
NEXT_OWNER_PACKAGE_GATE_BLOCKERS=PASS
```

它表达的事实与具体下一个包无关：第二个包可按 TR-09 从 planned 转为 realized kind；任意 owner 包的合格 actor 可写自己的状态；新 package 或既有 adapter 长出真实测试时 verify 分母可自行演进。它不授权任何下一个包实施。

单元 A 的出口不包含 D-5 或 D-6。B2 退役 `restart-positive` 时必须额外复跑 A2 的 owned 对拍：把任一 D-6 接管用例移除或停用，行为门必须红且其余 owned/marker 关系仍保持可诊断；不得把 D-6 退役造成的行为缺口误归因给 D-4 的 runner 迁移。

## 5. workspace scoping 能力

### 5.1 API 形态

只新增一个纯改写原语，不搬 POC 的三轴工厂：

```ts
export const createWorkspaceScopedAction = (
  action: UnknownAction,
  routeContext: WorkspaceRouteContext,
): UnknownAction
```

它复用现有 `requireWorkspaceRouteContext` 与 `requireActionType`，把 `slice/action` 改为
`slice.${workspace}/action`，保留 action 的其余字段。`createWorkspaceActionDispatcher` 只负责持有 dispatch，
其返回函数必须调用 `createWorkspaceScopedAction` 后再 dispatch，不保留第二份字符串改写。

`createWorkspaceScopedAction` 从 state package root 导出，state `publicExports` 由 56 合法增长到 57；D-8 的 package invariant 同步更新，中央工具不改 public 名单。

本批不新增 instanceMode/displayMode axis，不把 workspace 塞进 runtime context，不校验目标 slice 是否已注册。只注册 MAIN 而路由 BRANCH 的静默丢写风险写进 README；workspace scoping 属单元 B，`toWorkspaceStateDescriptors` 必须接收 RTK `Slice` 并断言 `slice.name === workspaceKey`，双 workspace 真实 store 隔离属于 B1，不在单元 A 实施。

### 5.2 行为闭包

真实 store 用例必须：

1. 用 `toWorkspaceStateDescriptors` 创建 MAIN/BRANCH registration；
2. 用现有 RTK `createStateRuntime` 构造真实 store，不用 `vi.fn` 代替 reducer；
3. 对同一 base action 分别经 MAIN/BRANCH dispatcher 派发；
4. 每次只允许目标 slice 改变，另一份引用和值都不变。

10 条 throw 路径各有独立用例并断言精确错误 message，其中新增 `Slice.name` 与 workspace key 不等时报错；非法 workspace 与非字符串 baseName 用最窄的 `as unknown as` 仅在 test 触达。无斜杠、首位斜杠、末位斜杠三类 action type 分开断言。删除任一 throw 时必须恰有对应测试红；不得读源文本或数 throw。名字检查必须验证传入 RTK `Slice.name`，不得检查函数刚生成的字符串。

D-3 不将 `workspace.ts` 的普通 `input.dispatch` 登记为 exception；它接收调用方注入的函数但不是 Redux Store dispatch。未来首个生产消费者仍需接受独立的 TR-01 位置语义复核。

## 6. D-5…D-7：顺序优先、行为接管与静态结构

### 6.1 D-5：role effect 变成纯读输入、返回 action

D-5 不阻塞任何新包；`RuntimeModule.roleChangeEffects` 已是公开字段。它排在单元 B 前部只是为了在后续消费者出现前完成一次迁移，并让 D-3 的受控例外少一项。

```ts
type RuntimeRoleChangeEffect = (input: Readonly<{
  previousMode: RuntimeInstanceMode
  nextMode: RuntimeInstanceMode
  context: ActorExecutionContext
}>) => readonly RuntimeUnknownAction[] | Promise<readonly RuntimeUnknownAction[]>
```

effect 保留现有 `context` 入参，但不得在自身包直接调用 `dispatchAction`；它只返回 action 数组。actor 在唯一调用点按 effect 顺序 await 收齐 action arrays，再按 effect/action 顺序 dispatch，最后写 role slice。request-ledger effect 改为返回 clear action；未来消费者遵循同一 action-return 接缝。TR-01 对任何第三方 effect 的直接 `dispatchAction` 调用继续判红，不以类型收窄或运行时 facade 作为第二套权限机制。

这保留“清旧 owner 状态在角色翻转之前”，同时取消 effect N 写入被 effect N+1 读取的旧行为。该变化写进 README/HANDOFF；当前仅一个生产 effect。

行为测试必须证明 action 先于 role state 生效，并覆盖第三方 effect 直接调用 `dispatchAction` 的 TR-01 回归红夹具。两个 mode 字段绑定 `RuntimeInstanceMode`，作为 invariant consumer baseline 的合法 `+2` delta。

### 6.2 D-6 单独退役 `restart-positive`

不可逆步骤固定为：

1. 在 scratch 中把 runtime instance-mode descriptor 的 `persistIntent` 合法改为 `never`，同时删除 persistence 数组；
2. 运行 runtime tests，全部失败必须属于“两 runtime 共享同一 storage，第二个恢复持久化 instanceMode”的行为形状；
3. 在 scratch 同时停用全部该形状用例，变异必须转绿；当前分母为两条，不能只停一条；
4. 恢复真实树后才删除静态 test-source heuristic。

descriptor 的 `kind:'field'`、`stateKey:'instanceMode'`、`persistIntent:'owner-only'` 三条结构断言并入现有 `owner-kind` 门；为前两条补 red fixture。`RUNTIME_RULE_NAMES` 由 5 变 4，不另造一个伪行为门。若变异在模块求值期炸、失败不是指定行为、停掉两条仍红或真实树不能恢复全绿，立即停止，保留现役门。

### 6.3 D-7 绑定 `StateStoragePort` symbol

state checker 建一次 TS Program，`collectStateStoragePortCalls` 按目标方法声明来源识别调用；receiver type 只作补充，不按变量文本。`storage-result-consumed` 与 `no-storage-clear` 必须调用同一收集函数。

机器只判断“Promise/PortResult 是否直接丢弃”：

| 形态 | 判定 |
|---|---|
| `await port.write()` expression statement | 红 |
| `port.write()` 裸 expression | 红 |
| `void port.write()` | 红 |
| `.catch(() => {})` | 红 |
| `.catch(error => logger.error(...))` | 绿（只证明接住，不证明处置正确） |
| return、赋值、传入明确消费者 | 绿（语义由 behavior test） |

`no-storage-clear` 对解析到 `StateStoragePort.clear` 的调用始终红；`reportPorts.remove`、`transportPort.clear` 绿。`StateStoragePort.clear` 继续由 platform-ports 声明，state 仍按 namespace 使用 list/remove，二者不冲突。

`toolkit-zero-slice` 同步改为 symbol origin：RTK direct/namespace `createSlice` 均红，注释/字符串不参与；descriptor export 通过 checker type 判定，不读 declaration text。

四态 behavior tests 分别证明：succeeded 推进 cache/health、failed 保留 dirty、timed-out 保留 timeout 事实、unavailable 对 protected fail closed 且不降级 plain。机器门不得声称这些语义已由“变量被读过”证明。

## 7. 跨单元 invariant：A 迁移 D-8，B 扩展 D-20…D-23

### 7.1 D-8 public/invariant 对拍

本节实现属于单元 A 的首个写入 CP，必须先于 D-1…D-4 及全部合法 public/consumer 变更。工具从 package root 的 `src/index.ts` 取得实际 public symbols，再与 `terminal-invariants.json.publicExports` 双向 exact compare。其它 8 张表与 ledger inline shape 分别从 owning package manifest 读取；中央 checker 中不得保留 312 个名字或对应成员副本。

迁移前必须先以 TypeChecker 逐行解析 §2.2 的 22 个 sourceFile/declarationId/member 绑定，任一符号不存在或解析不到预期 union 即停止，禁止把错误名字写进 invariant。迁移验证必须证明 12 张原表、312 exports、25 keys、120 members、457 scalars 与 9/22 consumer bindings 零丢失；迁移完成后删掉一次性总数硬断言，避免制造新冻结墙。

单侧改 `src/index.ts` 或 manifest 都红；两侧同时加合法 export 时 exact-set 绿，但“是否该导出”仍由 TR-09、类型/行为证据与 review 判断，不冒充机器结论。D-4 的 `owned` 不计入 D-8 的 12 张 legacy 表，单元 A2 作为 schema delta 单独对拍。

### 7.2 D-20 TR-05

类型边界扫描入口改为两个包 `src/index.ts` 的 public symbols，沿 alias 解析真实类型；内部未 root-export 的 `Record<string, unknown>` 不再误红。cast 语法扫描仍覆盖全部 `src`。

新增的有限局部形态只有：同一 block、相邻语句、一个中间 `const`，先 `as unknown`/`as any` 再恢复具体类型；受控一跳 alias 同形。直接双 cast 的既有真阳性继续红。

helper 函数、对象字段、多跳与跨文件传播明确不建数据流分析，进入 §10 review checklist。

### 7.3 D-21 runtime ID prefix

prefix 对拍先把 object 转成按 key 排序的 `[key,value]`，分别比较 key exact-set、mapping 与 value uniqueness。只交换声明顺序绿；改 key/value 红。

contracts type fixture 逐 factory 断言返回正确 brand，并以 `@ts-expect-error` 证明不同 ID brand 不可互传。字符串表正确不再被当成 brand 关联已证明。

### 7.4 D-22 从迁移 baseline 派生消费绑定

9 个具名 closed union 的定义由其 owner package manifest 声明 exact literals；迁移当刻的 22 个 consumer row 由消费 package manifest 声明 `sourceFile + declarationId + member + expectedSymbol`，同一 manifest 另声明本包 `closedUnionConsumerCount`，只用于拒绝“删掉一行 row 后分母静默变小”的漂移。checker 用 TypeChecker 解析成员 type symbol，不比较 raw type text。后续合法新增/删除通过 invariant delta 进入当前分母，checker 不内置 22；`PersistIntent` 只登记 `StateRuntimeSliceRegistration.persistIntent` 与 `RegisteredStateRuntimeSlice.persistIntent`，不把同值 inline union 当作第三个 consumer。

机器同时拒绝：

- inventory row 缺失或删行后数量不一致；
- 虚构/多余 row；
- member type 不再解析到 expected union；
- protected union 定义成员漂移。

迁移时 22 个 consumer row 各有独立 mutation 到 `string`；`RequestCommandSnapshot.status` 与两个 `PersistIntent` row 必须包含在 corpus。D-5 产生的两行新 consumer 在其 CP 同步加入 corpus。新增真实 direct consumer 未登记红；新增业务上是否应该绑定某 union 由 review 决定。

### 7.5 D-23 ledger record shape

checker 从 runtime `src/index.ts` 的 package public symbol 解析 `RequestExecutionRecord` 与相关 record；manifest 记录 member、resolved type、readonly、optional。排序更早的同名 type 不影响结果。

固定 red：member 缺失、`workspace` 放宽 `string`、readonly 删除、optional 改动。诱饵声明 fixture 应绿且仍核真实 public symbol。类型比较优先 symbol identity；literal/array/nullable 走结构正规化，不只用文件排序或裸字符串打印。

## 8. D-9/D-14：软性消费边界与测试接缝

### 8.1 D-9 只立软性消费规范，不建可见性机制

Dexter 裁定不为 TypeScript 可见性问题建设 companion、friend-module 模拟、unique-consumer 门或 runtime 包内副本。以下公开形状保持现状：

```ts
type StateRuntime = Readonly<{
  getStore(): EnhancedStore<StateRoot>
  getState(): StateRoot
  createFullSyncPayload(sliceName: string): StateSyncPayload
  applyAuthoritativeSync(sliceName: string, payload: StateSyncPayload): void
  // 其余既有成员保持
}>
```

`createStateRuntime` 的返回形状不改；`getStore/getState` 不收窄。TR-09 正文新增且只新增一条消费规范：

> `createFullSyncPayload` 与 `applyAuthoritativeSync` 是 state 同步基础设施，仅允许 kernel.base.runtime 与 transport 同步路径消费；其它业务包不得直接调用。`getStore/getState` 继续按 TR-09 既有例外允许。

本条明确标 `UNENFORCEABLE_BY_MACHINE`。review checklist 固定为：

1. 全量搜索两方法生产调用点，逐一确认 owner 仅为 runtime 或 transport 同步路径；
2. 任一其它业务包直接调用即 finding，不因公开类型允许而放行；
3. 新增同义 helper、wrapper、callback 或深层路径时按语义判断，不用函数名黑名单冒充一般性证明；
4. `getStore/getState` 不计违规，除非后续另立 React 绑定与 selector 设计题并由 Dexter 裁定；
5. exact public-surface 只证明声明与实际一致，不得把“同时加入非法 API 和 invariant 后仍绿”记成 D-9 已机器闭合。

本条实施只修改 TR-09/README/HANDOFF 与独立 review checklist，不修改 state/runtime 生产源码，不新增机器门或 red mutation。既有同步行为测试照常作为能力未回退证据，但不把它们表述成可见性证明。

### 8.2 D-14 production factory 不再 import testing

结构固定为：

- `createRuntimeCore(input, internalHooks?)` 只接通用 hook，不 import `src/testing/**`；
- root `createRuntime` 调 core 时不传 hooks；
- `src/testing/createRuntimeForTest.ts` 调 core 并注入 resource release 与既有 StateRuntime sync test seam；
- 仅需 seam 的 tests 改用 test factory；普通 behavior tests 继续用 root factory。

生产 resource registry 从 `src/testing/releaseRuntimeForTest.ts` 移到 foundations，名字与职责改为 runtime 生命周期资源，不再把生产能力叫 test resource。

runtime support check 从 `src/index.ts` 做静态 import reachability：生产 closure 不得达到 `src/testing/**`。红夹具在 public wrapper import/register test seam；`createRuntimeForTest` 的 release 与 sync 能力仍绿。TER-local Expo export 后对 bundle 搜 `registerRuntimeStateSyncForTest`、`releaseRuntimeForTest`、`createRuntimeForTest` 必须零命中；不搜索 state 的生产 `applyAuthoritativeSync`。

## 9. D-10…D-13 与 D-24

### 9.1 D-10 assembly 与 census fail closed

assembly root 由 projected graph 中 `moduleName` 第一段为 `assembly` 的节点派生；当前只支持恰好一个，0 或大于 1 红。入口可达与闭包共用该 root。

四个 silent drop 全改显式错误：missing assembly、目录不能映射三段 moduleName、expected package entry 缺失、assembly census 缺失。图+目录+package identity 一致改名后仍执行入口断言；0/2 assembly 与四处 drop 各有独立 fixture。

### 9.2 D-11/D-12 单一词表、不同门子集

D-11 走 §3.3 package classification。D-12 走 `forbiddenVocabulary × applicableAstShapes` 固定矩阵，至少覆盖 bare call、property access、element access、一跳 alias、destructure、import/export-from/require。

声明/name 位置不算 capability use，因此 `interface X { process: string }` 绿；`globalThis['fetch']()`、`globalThis.fetch()`、`const g=globalThis; g.fetch()`、`window.localStorage` 与 NativeModules/TurboModuleRegistry 的适用形态红。更深 helper/对象字段/多跳交 review。

### 9.3 D-13 四个收口

- legacy package name policy 覆盖 `rn84/reactnative/rn-84/-v2/-v3`，不藏在 triple-naming regex；
- 删除 22/14 常量；完成一次 graph+package 的合法增删时 tools/tests 零代码改动；只改 graph 仍由 census 正确报红；
- census 枚举 `apps/terminal/**/package.json` 后显式验证三段布局，深度异常不 filter 掉；
- task owner 的 batch 参数真实投影；若删除 batch 语义则连参数一起删，不留死参数。

### 9.4 D-24 唯一依赖收集器

`workspace-dependency-collector.mjs` 输出：

```ts
type CollectedReference = Readonly<{
  specifier: string
  packageRoot: string
  edgeKind: 'runtime' | 'type-only'
  syntaxKind: 'import' | 'export' | 'import-type' | 'require' | 'dynamic-import'
  filePath: string
  line: number
}>
```

稳定公开函数只有：

```text
collectModuleReferences(filePath)
collectWorkspaceDependencyEdges(packageDirectory, packageScope)
```

同 package 同时出现 runtime/type-only 时 runtime 胜；生产 type-only 落 dependencies，test-only 落 devDependencies。workspace deep path 先归一 root，再由 root-only 规则拒绝。五类语法逐类未声明红、声明后绿；既有 ImportDeclaration 真阳性保持红，15 个 ImportTypeNode 的真树保持绿。

未来 D-16 只能消费 `collectWorkspaceDependencyEdges`，不得另写 parser。本批不改变 skeleton graph/package.json 两处边的现有 ownership。

## 10. 机器证明边界与独立语义 review

### 10.1 可由机器完整证明的部分

只有以下结论允许报告为 machine PASS：

- public symbol、具名成员、literal set、package identity、task script 与依赖引用的有限 AST exact-set；
- symbol origin、receiver type、import reachability 与本设计明列的局部 alias/cast 形态；
- focused test 真正执行后观察到的行为；
- package-local invariant 与当前真实声明的双向一致；
- 固定 red corpus 中每个 mutation 只击穿其目标规则、其余规则仍 PASS。

机器输出必须使用“规则名 + 当前分母 + PASS/FAIL”，不得把结构门写成“架构正确”“语义已生效”或“未来写法均被禁止”。

### 10.2 `UNENFORCEABLE_BY_MACHINE` 清单

| 范围 | 机器为何原理上不足 | fresh 独立 review checklist |
|---|---|---|
| D-1/D-2 kind 的业务正确性 | AST 只能证明单一 owner 与引用关系，不能判断包究竟应该是 owner/toolkit | 逐包核职责、真实 slice owner、`plannedKind` 转正时机；构造“声明一致但职责错”的反例 |
| D-3 多跳写 dispatch 表达式 | 有限 AST 不建跨文件全程序数据流 | 搜 helper 参数、对象字段、高阶回调、跨文件 alias；从每个 store dispatch 反向追到 actor/具名例外 |
| D-4 某 package 是否应有 test/lint/clean | script 存在只能证明声明，不证明应该声明 | 从真实能力与风险判断测试 owner；零测试包是否确实只有骨架 |
| D-6 重启行为是否足以取代现役 heuristic | 机器可证变异与恢复，不能判断产品是否接受退役后的覆盖边界 | 逐条核两种接管用例、删任一用例是否红、退役后是否仍保留业务所需重启事实；不得用 marker 存在替代行为 review |
| D-5 role effect 返回 action 的业务顺序 | test 可证当前顺序，不能判断未来 effect 间业务依赖 | 核 effect 是否需要读取上一 effect 写入结果；若需要，停止并重新裁定接口 |
| workspace scoping 的生产适用面 | 本批零生产消费者，机器只能证明 helper 行为 | 首个消费者出现时核其为 actor、两 workspace descriptors 均注册、silent drop 风险已处理 |
| D-7 PortResult 的完整处置语义 | “值被消费”不等于失败/超时/不可用处理正确 | 对每个调用点逐态读失败恢复、health、log、retry/baseline 影响 |
| D-8 合法新增 export 是否值得共享 | exact-set 只证明双方一致 | 每个新 export 回答谁写、谁读、为何不是包内类型；违反 TR-09 即 finding |
| D-9 同步基础设施消费边界 | Dexter 裁定只用软规范；公开 TypeScript 成员无法在不加复杂机制时限制调用方 | 搜 `createFullSyncPayload/applyAuthoritativeSync` 及同义 wrapper 的全部生产调用；逐一确认只在 runtime/transport 同步路径；`getStore/getState` 明确排除 |
| D-11 外部 package 的真实能力类别 | 名字不能证明能力；未知只能 fail closed | 新依赖回官方文档与源码，判平台/IO/UI/native 能力后再录 vocabulary |
| D-12 多跳平台能力 | 固定 corpus 不覆盖任意数据流 | 搜 helper/object field/跨文件 alias；发现后先判断有限形态可否纳入，否则保留 review finding |
| D-13 合法新增 package 的架构价值 | 图与目录一致不等于包应存在 | 核层级、职责、依赖方向、闭包根与是否重复造包 |
| D-14 test seam 的语义泄漏 | import closure 能证明字节可达，不能穷尽运行期反射/字符串协议 | 读 production factory、bundle symbol、公共返回面，确认 test hook 无用户可达入口 |
| D-20 跨函数双 cast | 本批明确只做有限局部形态 | 全 `src` 搜 helper 参数、对象字段、多跳/跨文件 cast；不可把未命中称全局证明 |
| D-22 consumer 应否绑定某 union | checker 只能核已声明绑定 | 新增/删除消费者时从业务语义复核 inventory，而非只同步 JSON |
| D-23 record shape 是否仍代表共享事实 | 类型 exact 不能判断字段是否仍是跨包事实而非实现偶然 | 逐字段回源消费者、owner 与失效边界；同名诱饵与 symbol 解析结果分开核 |
| D-24 非字面量模块加载 | 静态 collector 无法可靠解析运行期 specifier | 出现非字面量 require/import 立即 STOP；不得以漏收集的绿结果收口 |

### 10.3 review 输出格式

每一项独立 review 必须给：`CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE / UNVERIFIED_REQUIRES_EVIDENCE / DEXTER_DECISION`、owning source、反例、最小修复及较小替代为何不足。不得用“固定 corpus 已绿”替代本节语义核验。

## 11. 判据与定向 red fixture 矩阵

所有 mutation 在 scratch 副本执行，真实仓字节在 mutation 前后 hash 相同。每个 fixture 都要同时断言目标规则 FAIL 与其余规则 PASS；只能说明具体目标被击穿，不能以“总命令非零”代替。

D-9 按 Dexter 裁定没有 machine red，不进入 red mutation 分母；其证据是 `DEXTER_DECISION + UNENFORCEABLE_BY_MACHINE` checklist。不得为了维持“一条缺陷一道门”的表面整齐重新造机制。

| ID | 真实树绿判据 | 定向 red mutation | 预期唯一失败 |
|---|---|---|---|
| D-1 | 真实 slice 包 `moduleKind` 与 graph 转正一致 | 第二包把 `moduleKind` 改成 `toolkit`，保留相反注释 | `package-kind-owner` |
| D-2 | runtime internal module kind resolve 到正本 symbol | 改为同值局部 `const moduleKind` | `module-kind-origin` |
| D-3 | 单元 A 生产 dispatch 均为 actor 或六项例外；B1/D-5 后为五项 | 在非 actor helper 经 alias 调真实 dispatch；或把 dispatch wrapper 导出到 actor handler 外 | `tr01-owner-write` |
| D-4 | task owner 由投影 scripts 派生，marker 来自 owned runner | scratch package 新增合法 `test` script 与真实测试文件，不改工具先红；runner 识别后绿；另把脚本改成只 echo marker | `task-owner-runner` |
| D-5 | effect 保留 context 入参、只返回 actions；actor 按 effect/action 顺序统一 dispatch | effect 内直接调用 `dispatchAction`，或改变 action/role-state 顺序 | `role-effect-dispatch`；TR-01 回归 red 与 action-order behavior test |
| D-6 | 两种独立重启形状证明 instanceMode 持久化 | 同时改 `persistIntent:'never'` 并删 persistence | 两个指定 behavior test 红；停掉二者才绿 |
| D-7 | storage call receiver resolve 正确，结果未直接丢弃 | alias `StateStoragePort.write` 后以 `void` 丢弃 | `storage-result-consumed`；其它门绿 |
| D-8 | package public/invariant 双向 exact | 只在 runtime root 多导出一个 symbol | `package-invariant-exact-set` |
| D-9 | TR-09/README/HANDOFF 明确两方法仅供 runtime/transport，当前生产调用点经独立 review 全量归属 | 在 review fixture 中假设业务包直接调用并要求 reviewer 判 finding；不建设机器 red | `UNENFORCEABLE_BY_MACHINE`，无 machine PASS |
| D-10 | 恰一 assembly 且四类缺失 fail closed | fixture 分别造 0/2 assembly、坏三段目录、缺 package entry、缺 census | `assembly-root-and-census` 对应 reason code |
| D-11 | package root vocabulary 分类完整 | production import 一个未分类 external root | `platform-vocabulary-unknown` |
| D-12 | 固定 vocabulary×AST corpus 六形态均抓取 | `globalThis['fetch']()` 经一跳 alias | `platform-capability-use` |
| D-13 | legacy、动态分母、三段 census、batch 投影均成立 | 增一组 graph+package 合法节点而工具零改应绿；只增 graph 必红；深四段 package 必红 | 各自 `legacy-name` / `package-census` / `task-projection` |
| D-14 | production closure 不达 testing，bundle 零 test seam symbol | public wrapper import `createRuntimeForTest` | `runtime-production-test-seam` |
| D-20 | public boundary Record 与全 src cast 合规 | root-export type 加 `Record<string, unknown>`；相邻 const 双 cast | `tr05-named-boundary` |
| D-21 | prefix key/mapping/unique 与 brand fixtures成立 | 只交换 object 顺序应绿；把 factory 返回 brand 改错 | `runtime-id-prefix-exact-set` 或 type fixture 红 |
| D-22 | 22 行均 resolve 到 9 个 union | 把 `RequestCommandSnapshot.status` 或任一 `PersistIntent` consumer 放宽为 `string` | `closed-union-consumer-binding` |
| D-23 | 真实 root symbol 的成员/type/readonly/optional exact | 在更早文件放同名诱饵应绿；删真实成员 readonly | `ledger-record-shape` |
| D-24 | 五类依赖语法全部进入同一 collector | fixture 用 `export type`、`import()`、`require()`、`import('x').T` 各造一条未声明边 | `workspace-dependency-declaration` |
| WS | pure transform 与真实 store 两 workspace 隔离 | 删除某一 throw；或让 BRANCH action 写 MAIN reducer | 对应 message test / store isolation test |

D-4 的“新增合法 test owner”分两拍：未加入 owned runner 前必须红，package 改为合法 runner 后工具零代码改动即绿。这样既证明动态发现，也不允许任意 marker script。

D-6 是唯一退役动作，除 §6.1 四步原始输出外不得执行删除；其它 fixture 全部是可恢复 scratch mutation。

## 12. 文件落点、单元所有权与职责

### 12.1 新增文件

| 路径 | 唯一职责 |
|---|---|
| `tools/terminal-shared/typescript-analysis.mjs` | TypeScript program、symbol origin 与 public symbol 解析 |
| `tools/terminal-shared/package-invariants.mjs` | package-local invariant schema 与比较 |
| `tools/terminal-shared/platform-vocabulary.mjs` | package/capability 分类唯一表 |
| `tools/terminal-shared/workspace-dependency-collector.mjs` | 五类依赖引用统一收集；未来 D-16 唯一接口 |
| `tools/terminal-shared/*.test.mjs` | 上述 helper 的固定 AST corpus，不承载 package-specific 名单 |
| 四个 kernel package 的 `terminal-invariants.json` | 各包 public/type/member/kind/exception 正本 |
| `tools/terminal-state/check-workspace-scoping.test.mjs` | 9 条错误与真实 store 隔离证明；若已有 state test owner可并入既有 test 文件而不新造 runner |
| `doc/evidence/platform/2026-09-01-v2s-terminal-gate-defect-remediation-codex.md` | 实施运行证据与四项 UNVERIFIED 的闭合结果 |

文件名在实施时可按现有目录惯例微调，但职责不可合并成万能门；任何需要新依赖、新 package 或新 graph edge 的调整均 STOP。

单元所有权固定：单元 A 创建 `typescript-analysis.mjs`、`package-invariants.mjs` 与四份 invariant 的最小完整能力；单元 B 只能扩展既有 schema/helper，不能创建第二份 parser、第二份 invariant owner 或另一个 public-surface 表。`platform-vocabulary.mjs` 与 `workspace-dependency-collector.mjs` 属单元 B。

### 12.2 修改文件族

| 文件族 | 变更 |
|---|---|
| `tools/terminal-skeleton/graph-model.mjs`、`check-static.mjs` 及 tests | D-1/D-2/D-4/D-10/D-13 与 package identity |
| `tools/terminal-contracts/**` | D-8、D-20、D-21、D-22 与 invariant 迁移 |
| `tools/terminal-platform-ports/**` | D-8、D-11、D-12 与共享 vocabulary |
| `tools/terminal-state/**` | D-6、D-7、D-8、workspace scoping 与 helper tests |
| `tools/terminal-runtime/**` | D-2/D-3/D-5/D-6/D-8/D-14/D-21/D-22/D-23 |
| `apps/terminal/kernel/base/state/src/**` | workspace primitive；D-9 不改生产源码 |
| `apps/terminal/kernel/base/runtime/src/**` | kind 正本、role effect、testing factory、TR-01 exception 收口；D-9 不改生产源码 |
| 四个 kernel package tests/config/package scripts | behavior/type fixtures 与 owned runner 接线 |
| `apps/terminal/skeleton-graph.ts` | 仅在 moduleKind 已转正而 plannedKind 尚残留时删该残留；不改边 ownership |
| `doc/platform/terminal-coding-standard.md` | 未来实施授权下只同步经证实的 TR-01/TR-05/TR-09 机器边界，不复制工具实现 |
| state/runtime 中文 README 与 HANDOFF | 能力边界、失败代价、review-only 部分与未来 D-16 collector 约束 |

### 12.3 不修改

- D-15…D-19 对应实现与欠账；
- 其余 18 个 TER package 的生产能力；
- 仓级 normal verify 的语义；
- adapter/native/Gradle/设备、DEV/seed/reset/browser L2/UAT/deploy；
- display-context 需求与生产源码；它们何时修订或实施与本批无关。

## 13. 实施停机条件与裁定

命中任一条立即停止当前 CP，保留首败与最后绿边界，不通过扩大 parser、放宽 exact-set 或删测试继续：

1. 单元 A 的 D-8 迁移当刻无法从旧表与新 invariant 双读得到零差，且不能定位到确定源码漂移；
2. 单元 B 开始时仍试图把迁移时的 312/20 当作当前硬常量，而不是从 invariant 求值当前 baseline；
3. D-24 五类语法出现非字面量 module specifier，或统一 collector 无法让三个现有工具保持既有真阳性；
4. D-4 现有 runner 无稳定机器可读的 test-file/exit 事实；
5. D-6 变异失败不是两类重启恢复行为、停掉二者仍红、或恢复真实树不能全绿；
6. D-5 发现现有效果依赖前一个 effect 已写 state，纯 action 返回会改变已批准产品行为；
7. workspace scoping 需要新增 axis、graph edge、生产消费者或注册状态检查；
8. 需要新依赖、新 package、新端口、新 public capability 或修改 D-15…D-19；
9. 任何 red mutation 不红、红错门、其余门同步红，或真实树无法恢复绿；
10. 需要改仓级 normal verify、运行 native/设备/DEV/seed/reset/browser L2/UAT/deploy。

本轮三条 `DEXTER_DECISION` 已全部落文；当前没有新的产品/Journey 裁决项。D-7、D-13b、D-22 属事实口径纠正。若 CP-A0 发现冻结输入已漂移，则按事实重新设计并交 Dexter，而不是把本文数字写死进门。

## 14. 步骤级、单元级与跨单元对账

每个实施 CP 的 focused proof 完成后、下一 CP 开始前，由 fresh 独立子 agent 用三维原文做证伪式对账：

1. 需求：缺陷登记对应 D 条目与 workspace §5；
2. 详设：本文对应章节及本 CP 文件/fixture 分母；
3. 项目记忆/规范：terminal coding standard、verification governance、terminal architecture/build-order routed memories。

逐项核行为、形态、动作、关系、位置、限制、状态/控制、失败/恢复、数据来源/失效边界，并检查前后双读留痕。发现偏移由主 agent 修复，再由新的 fresh agent 复查；步骤 review 不产出整批 GO/NO-GO。

单元 A 验收前做一次 A 全范围对账；A 的独立 implementation review 收口后才冻结单元 B。单元 B 验收前做一次 B 全范围对账；最终还要做一次跨单元对账，专门检查共享 helper 是否改变 A 的既有语义、package invariant 是否成为第二份功能正本、D-6 行为接管是否真实、D-24 是否被重复实现。任何一层都不能由 CP 对账摘要代替。

## 15. 交付与证明边界

实施证据分成单元 A、单元 B、跨单元三组，并逐项关闭缺陷登记 §7 的四项 `UNVERIFIED_REQUIRES_EVIDENCE`：

1. 每个 red mutation 目标门 FAIL、其余门 PASS 的原始输出；
2. 四个共享 helper 的 corpus 与三个既有 consumer 工具回归输出，证明无意外行为改变；
3. 整改后真实树的 package typecheck/test、TER-local `verify:static` 与 `verify` 同时绿；
4. D-20…D-24 的真实可执行输出与新鲜分母。

单元 A 单列 D-8 迁移当刻 census、D-1/D-2 第二包 fixture、D-3 exception=6、D-4 runner/owner。单元 B 单列 D-5 的 `exception -1 / consumer +2`、workspace 的 `public export +1`、D-6 mutation/behavior takeover、D-7 四态、D-22 当前动态分母、D-24 15/10/0、D-14 production closure/bundle symbol。D-9 只记录 `DEXTER_DECISION`、现有形状零漂移、无 companion/unique-consumer 门与独立 review checklist，不进入 red 分母。跨单元证据证明 B 扩展共享 helper 后 A 的门仍绿。

所有命令记录 cwd、精确 argv、exit code、关键 marker 与耗时；失败时不打印 PASS marker。

TER-local `verify` 的通过只证明静态、跨包类型/测试与 Metro 消费闭包，不证明 native、Gradle、设备、adapter 能力或用户 Journey。仓级 normal verify 不运行。

本设计已完成两轮 DESIGN review；Dexter 已授权单元 A 实施。单元 B 仍须在单元 A 的 IMPLEMENTATION review 收口后重新冻结并另行授权。
