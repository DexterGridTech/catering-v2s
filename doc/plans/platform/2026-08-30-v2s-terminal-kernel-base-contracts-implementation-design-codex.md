# TER `kernel.base.contracts` · implementation-facing 详设

## 0 · 元数据、输入与授权边界

```text
PROGRAM_ID=V2S_W0_W4_EXECUTION
BUSINESS_SOURCE=doc/plans/platform/2026-08-29-v2s-terminal-kernel-base-contracts-requirements-claude.md
RULE_SOURCE=doc/platform/terminal-coding-standard.md
ARCHITECTURE_SOURCE=project-memory/decisions/terminal-architecture-and-stack-rulings.md
BUILD_ORDER_SOURCE=project-memory/decisions/terminal-build-order-and-batches.md
JOURNEY_REFS=NOT_APPLICABLE（零依赖共享类型/纯函数包，无用户 Journey）
IA_REF=NOT_APPLICABLE（Dexter 已裁定本批无用户可见界面或交互，不产出 IA）
INTERACTION_REF=NOT_APPLICABLE（无界面、焦点、导航或用户操作）
AUTHORIZED=本详设、实施计划与 kernel.base.contracts 实施；为一键测试所需的五个 adapter devDependencies 与 test runner 收口；TER-local 验证
NOT_AUTHORIZED=其余 21 包能力实现；Kotlin 能力；设备运行；仓级 normal verify；DEV；reset；seed；浏览器 L2；UAT；部署；EAS；仓库控制动作
IMPLEMENTATION_AUTHORITY=true
AUTHORIZED_BY=DEXTER_2026_08_30
REVIEW_CYCLE_ID=TER_KERNEL_BASE_CONTRACTS_DESIGN_20260830
```

Roadmap 仅记录 program 授权；当前具体任务与边界以 Dexter 本会话直接授权为准。本批只给既有骨架包填共享语言，
不会把 `UNVERIFIED_TER_NEED` 升格为已冻结运行时契约。

## 1 · 真实目标与方案比较

### 1.1 结构性问题

`contracts` 是 22 包依赖图唯一零依赖根。照搬 POC 会把跨节点协议、展示 helper、无 reader 的 metadata、
`Record<string, unknown>` 与 `any` 一起放进全仓编译面；只建一组能自测的类型又会出现“本包测试绿、
消费者从未编译公开面”的假完成。本批必须用最小公开面同时关掉三类风险：根包出边、类型边界退化和测试未进入
真实 TER 验证入口。

### 1.2 方案比较

| 方案 | 结果 | 结论 |
|---|---|---|
| A · 逐文件搬 POC，再删明显跨节点类型 | 保留无 reader metadata、通配导出、版本假常量和不安全泛型；根包继续变重。 | 拒绝。 |
| B · 只建 ID/错误，等消费者出现再补全部其余组 | 违背已 GO 的七组范围，也无法为后续 `platform-ports`/runtime 提供同一语言。 | 拒绝。 |
| C · 从七组语义反推精确符号，删除无证字段，用泛型/具名擦除收紧边界，并以公开入口编译夹具和 exact-set 门反证 | 覆盖当前批准范围，公开面可枚举，未冻结组有明确失效边界。 | **采用。** |

我选择 C，因为它既不把 POC 当规格，也不把已批准的共享语言推迟；每一个公开符号都有来源、消费者类别与
反证手段。

### 1.3 已知未冻结边界

- 参数协议、定义工厂、模块描述符、request 生命周期维持 `UNVERIFIED_TER_NEED`。
- 组 5 与组 6 在 runtime 落地前不视为冻结契约；runtime 可要求修改字段。
- metadata 六处当前没有字段级 reader，全部删除；未来出现具名 writer/reader 时重新设计，不预留开放洞。
- `CommandRouteContext` 仅本机路由，未经序列化与兼容性审查不得进入 wire protocol。
- `RequestLifecycleSnapshotEnvelope` 与其他 topology/state-sync/projection/command envelope 一并推迟。
- `create-expo-module` 完整安装闭包仍是 `UNVERIFIED_REQUIRES_EVIDENCE`，本批不重跑脚手架。

## 2 · CP 总览

| CP | 主题 | owner | 主要输出 | 依赖 |
|---|---|---|---|---|
| CP-1 | 共享语言、公开面与消费者编译夹具 | contracts | 七组类型/纯函数、精确导出、T-1…T-9、F-1…F-4、typecheck 反向控制 | 设计 GO |
| CP-2 | contracts 静态门与 TER-local 接线 | terminal tooling | C-2/C-4b/C-5/C-6 四门、exact-export support check、正负控制、TER verify 真跑 test | CP-1 |
| CP-3 | 五个 adapter 测试与 SDK 57 devDeps 收口 | terminal adapters/tooling | ESM test runner、明确零测试 marker、三类版本证据、Yarn 生成 lockfile | CP-2 |
| CP-4 | 全范围三维对账与验收 | 主 agent + fresh reviewer | exact exports、真实测试包数 1、五个零测试包、TER-local static/typecheck/test/export、实施证据 | CP-1…3 |

每个 CP focused proof 后、下一个 CP 前，使用 fresh 独立子 agent 逐项比较需求、本文/计划、项目记忆与当前源码；
发现偏移由主 agent 修复，再由另一 fresh reviewer 复核。CP-4 测试前另做一次全范围三维对账。

## 3 · 横切机制对照表

| 机制 | 现成能力/规范 | 可证伪观察 | 本批形态 | 适用全集 |
|---|---|---|---|---|
| 读侧节点授权、写授权、跨 owner 写与事务 | N/A：无 HTTP、owner command、数据库。 | 全批源码无 route/command/store。 | N/A。 | contracts 与测试工具。 |
| 集合形态与分页 | N/A：无业务集合；`listDefinitions` 是内存对象值集合。 | 类型保持 `T[keyof T]`，不引入 cursor/page。 | 只读数组。 | `listDefinitions`。 |
| 缓存失效、RTK、共享前端行为、候选数据源 | N/A：无 UI/远端数据。 | 不出现 React/RN/Expo/RTK import。 | N/A。 | 全包。 |
| 同一事实只有一个住址 | 需求 §4/§7；TR-05/TR-09。 | `src/index.ts` module symbol 与本文 exact-set 双向相等；拒绝 `export *`。 | 类型在 `types/`，纯函数在 `foundations/`，不建第二出口。 | 公开符号全集。 |
| 失败可见且原因不改写 | AGENTS 日志要求；现有 TER verifier 首败形态。 | 子门失败时 exit 非 0 且不打印对应 PASS marker。 | `CONTRACT_RULE_GATES=4` 与目标 gate 名；test 区分 REAL/NO_TEST_FILES。 | 四门、类型反控、六个 test task。 |
| 生成物不得手搓 | Yarn lockfile；Expo SDK-aware install。 | 每包记录 cwd/CLI/命令/exit/manifest diff；lockfile 只由 Yarn 生成。 | 集合 A 读同批 template raw；第三类由逐包 `expo install --dev` 解析。 | 五个 adapter。 |
| 日志与脱敏 | `AGENTS.md`。 | 保存首败、stdout/stderr、exit 与 cleanup；不记录 token/账号/raw payload。 | `.runtime/terminal-contracts/` 原始日志，doc evidence 摘要。 | install、门、TER-local verify。 |
| 迁移、seed、HTTP 映射、幂等 | N/A：无后端或持久化。 | 不改 backend/migration/seed。 | N/A。 | 全批。 |
| 编码与名称呈现 | TR-09；既有 `moduleName.ts`。 | 三个骨架符号不变，包名/路径不改。 | `moduleName` 仍为 `kernel.base.contracts`。 | 包根。 |
| 原子组 | 需求 §8；gate-four-pieces memory。 | 真实树绿、每门定向红、类型负夹具去注释变红、TER test 真执行。 | 公开面 + typecheck + runtime tests + static gates + aggregator 为一个闭包。 | CP-1…4。 |

其余模板机制（operation/path/face、跨 owner 写、迁移、seed、浏览器验收）整组 `NOT_APPLICABLE`：本批没有
HTTP、数据库、业务状态或用户界面，强行展开只会制造无执行落点的表格。

## 4 · 精确公开面

`src/index.ts` 只能逐项显式导出下列 **74 个**符号，不允许 `export *`。三个骨架元数据是原有消费链输入；
其余按七组列出。实现中若精确计数因 TypeScript 的 type/value 同名规则不同，以 symbol 名 exact-set 为准，
不得靠调整分母放过新增或遗漏。

### 4.1 骨架元数据（3）

`moduleName`、`dependencyModuleNames`、`devDependencyModuleNames`。

### 4.2 ID 与时间（23）

类型：`TimestampMs`、`RuntimeInstanceId`、`RequestId`、`CommandId`、`SessionId`、`NodeId`、
`ConnectionId`、`EnvelopeId`、`DispatchId`、`ProjectionId`、`RuntimeIdKind`。

值/函数：`runtimeIdPrefixes`、`createRuntimeId`、`createRuntimeInstanceId`、`createRequestId`、
`createCommandId`、`createSessionId`、`createNodeId`、`createConnectionId`、`createEnvelopeId`、
`createDispatchId`、`createProjectionId`、`nowTimestampMs`。

`createRuntimeId` 用 kind 到 brand 的私有映射/重载，禁止复刻 POC 的
`createRuntimeId<TId extends string>('command')` 任意指定返回 brand 漏洞。`INTERNAL_REQUEST_ID` 不导出：
它是 runtime 内部策略且绕过前缀表。

### 4.3 错误协议（14）

`ErrorCategory`、`ErrorSeverity`、`ErrorDefinition`、`ErrorTemplateValue`、`ErrorTemplateArguments`、
`RenderedErrorTemplate`、`AppError`、`ErrorCatalogEntry`、`ResolvedErrorView`、`CreateAppErrorContext`、
`CreateAppErrorInput`、`renderErrorTemplate`、`createAppError`、`isAppError`。

`ErrorTemplateValue` 只允许 `string | number | boolean | bigint | null | undefined`；
`ErrorTemplateArguments` 是 key 开放但 value 有界的只读字典。`RenderedErrorTemplate` 返回
`message` 与 `missingKeys`。`AppError` 必有 `templateMissingKeys`（完整渲染时为空数组），使缺参事实可沿错误对象
继续被观测。`isAppError` 对每个必需字段做真实结构校验，不以单字段冒充完整 guard。

### 4.4 参数协议（5）

`ParameterValueType`、`ParameterDefinition`、`ParameterCatalogEntry`、`ResolvedParameter`、
`ParameterDescriptor`。

`ParameterDefinition<T>` 的 `validate` 形态为 `(value: unknown) => value is T`，使具体定义可以安全擦除成
`ParameterDescriptor`/`ParameterDefinition<unknown>`；不得用 `any`。T-6 在本包只证明三个 source 可构造且
`catalog-fallback` 与 `default` 是不同判别值；“远端非法值如何被解析”为未来 resolver 行为，本批不得以
test-owned helper 冒充生产能力。

### 4.5 定义工厂（7）

`DefineErrorInput`、`DefineParameterInput`、`ModuleErrorFactory`、`ModuleParameterFactory`、
`createModuleErrorFactory`、`createModuleParameterFactory`、`listDefinitions`。

所有 exported function 的参数与返回具名；`listDefinitions<T extends object>` 保留
`readonly T[keyof T][]`，不退化成 `readonly object[]`。

### 4.6 模块描述符（7）

`AppModuleKind`、`AppModuleDependency`、`AppModuleCommandDescriptor`、`AppModuleActorDescriptor`、
`AppModuleMiddlewareDescriptor`、`AppModuleSliceDescriptor`、`AppModule`。

`AppModule.kind` 为 `'owner' | 'toolkit'`；`packageVersion?` 与 `protocolVersion?` 均可选；
`parameterDefinitions` 用 `readonly ParameterDescriptor[]`。本组是 `UNVERIFIED_TER_NEED`，runtime 可改字段。

### 4.7 request 生命周期（7）

`CommandLifecycleStatus`、`RequestLifecycleStatus`、`CommandResultPatch`、`CommandResultSnapshot`、
`RequestCommandSnapshot`、`RequestLifecycleSnapshot`、`CommandRouteContext`。

`CommandResultPatch` 虽未出现在需求 §4.1 的枚举句中，但被 §6.4 明确纳入本批 TR-05 分母，且属于同一
request result 共享词汇，因此显式列入，不静默遗漏。前三个 result 字段用同一 `TResult extends object`
泛型，并由 `RequestLifecycleSnapshot<TResult>` 传到内部数组。`CommandRouteContext` 只保留已有语义读者的
`workspace?`、`instanceMode?`，删除 `sessionId`、`routeTags` 与 `metadata`；前者已有 request 外层字段，
后两者无字段级 reader。本组未冻结且 local-only。

### 4.8 transport 配置（8）

`TransportRequestContext`、`TransportServerAddress`、`TransportServerDefinition`、
`TransportServerConfigSpace`、`TransportServerConfig`、`TransportServerAddressOverride`、
`TransportServerOverride`、`ResolveTransportServerConfigOptions`。

六处 metadata 全部不进公开面；`baseUrlOverrides` 与 `serverOverrides` 可用 precise-valued
`Readonly<Record<string, string | TransportServerOverride>>` 的各自具体形态，C-4b 只禁
`Record<string, unknown>`，不把有界映射误判为开放洞。

### 4.9 明确排除/推迟

不导出：`formatTimestampMs`、五个通用 validator、`INTERNAL_REQUEST_ID`、版本常量、所有 wire envelope、
topology/compatibility/state-sync/projection、任何 `protocol/` 二次出口、空 application/features/selectors/hooks/supports。

### 4.10 为什么是共享词汇

| 组 | 共享性与已知消费者类别 | 失效边界 |
|---|---|---|
| 骨架元数据 | assembly、图门和依赖元数据必须用同一包身份。 | 不承载业务能力。 |
| ID/时间 | platform-ports logging 已实际消费 6 种 ID/时间；request/runtime/transport 共用关联标识。 | ID 不作鉴权凭据；否则重审随机强度。 |
| 错误协议 | transport runtime 已实际消费；所有模块定义/呈现错误需同一来源与严重度语言。 | 不规定 UI 展示。 |
| 参数协议/工厂 | 任意模块声明参数的共同语言；当前 TER 需求未验证。 | 未来 workflow/runtime 可改字段。 |
| 模块描述符 | 所有模块向 runtime 声明自身的共同语言。 | runtime 尚空，未冻结。 |
| request 生命周期 | actor/runtime/transport 对同一请求与 command 状态需同名。 | 未冻结；wire envelope 不在本批。 |
| transport 配置 | transport 与 assembly 对 server/address 配置形状必须一致。 | 地址值由启动层注入；无 native/network 实现。 |

### 4.11 C-4 · 逐 export 共享词汇审查表

`状态` 描述 TER 当前证据，不把 POC 使用自动升格；`覆盖` 是本批最低可证伪观察，不替代性质 review。

| symbol | 组 | 为什么必须是共享词汇 | 已知/未来消费者类别 | 状态 | 覆盖 |
|---|---|---|---|---|---|
| `moduleName` | 骨架 | 包身份被图、assembly 与依赖元数据共同读取。 | 当前 10 个图消费者、assembly | CONFIRMED | 骨架六门/入口可达 |
| `dependencyModuleNames` | 骨架 | 正式依赖声明与源码 import 必须同名。 | 图门、tooling | CONFIRMED | 骨架依赖 exact-set |
| `devDependencyModuleNames` | 骨架 | dev 边必须与正式边分开表达。 | 图门、test-support | CONFIRMED | 骨架依赖 exact-set |
| `TimestampMs` | ID/时间 | logging、request、error、catalog 对毫秒时间需同一单位。 | POC platform-ports/runtime/transport | CONFIRMED | F-3/T-8 |
| `RuntimeInstanceId` | ID/时间 | runtime 实例关联标识不能与其他 ID 串用。 | future runtime | CONFIRMED | T-1/T-2/T-9 |
| `RequestId` | ID/时间 | request、logging、transport 共同关联一次请求。 | POC platform-ports/runtime/transport | CONFIRMED | F-2/T-1 |
| `CommandId` | ID/时间 | command 与 request ledger/logging 共同关联。 | POC platform-ports/runtime | CONFIRMED | F-2/T-1 |
| `SessionId` | ID/时间 | request/transport/logging 对会话需同一 brand。 | POC platform-ports/runtime/transport | CONFIRMED | T-1/T-2 |
| `NodeId` | ID/时间 | request/transport/logging 对节点需同一 brand。 | POC platform-ports/runtime/transport | CONFIRMED | T-1/T-2 |
| `ConnectionId` | ID/时间 | transport connection 与 logging 需同一 brand。 | POC platform-ports/transport | CONFIRMED | T-1/T-2 |
| `EnvelopeId` | ID/时间 | 未来 wire envelope 需要与其他 ID 隔离的共享 brand。 | future transport/topology | CONFIRMED | T-1/T-2 |
| `DispatchId` | ID/时间 | dispatch 关联标识跨 runtime/diagnostic 使用。 | future runtime | CONFIRMED | T-1/T-2 |
| `ProjectionId` | ID/时间 | 未来投影关联标识不能退化为裸 string。 | future projection/runtime | CONFIRMED | T-1/T-2 |
| `RuntimeIdKind` | ID/时间 | 所有 ID 生成入口共享同一九值闭集。 | ID factories/tooling | CONFIRMED | C-5 |
| `runtimeIdPrefixes` | ID/时间 | kind 与可诊断前缀只有一张表。 | ID factories/tests | CONFIRMED | C-5/T-2 |
| `createRuntimeId` | ID/时间 | 通用生成入口保证 kind 决定 brand。 | runtime/request/transport producers | CONFIRMED | F-4/T-1 |
| `createRuntimeInstanceId` | ID/时间 | runtime producer 需要精确 brand 的便利入口。 | future runtime | CONFIRMED | T-1/T-9 |
| `createRequestId` | ID/时间 | request producer 不应手拼前缀。 | POC platform-ports tests/runtime | CONFIRMED | T-1/T-9 |
| `createCommandId` | ID/时间 | command producer 不应手拼前缀。 | POC platform-ports tests/runtime | CONFIRMED | T-1/T-9 |
| `createSessionId` | ID/时间 | session producer 不应手拼前缀。 | future runtime/transport | CONFIRMED | T-1/T-9 |
| `createNodeId` | ID/时间 | node producer 不应手拼前缀。 | future runtime/transport | CONFIRMED | T-1/T-9 |
| `createConnectionId` | ID/时间 | connection producer 不应手拼前缀。 | future transport | CONFIRMED | T-1/T-9 |
| `createEnvelopeId` | ID/时间 | wire producer 不应手拼前缀。 | future transport/topology | CONFIRMED | T-1/T-9 |
| `createDispatchId` | ID/时间 | dispatch producer 不应手拼前缀。 | future runtime | CONFIRMED | T-1/T-9 |
| `createProjectionId` | ID/时间 | projection producer 不应手拼前缀。 | future projection/runtime | CONFIRMED | T-1/T-9 |
| `nowTimestampMs` | ID/时间 | logging/error/request 对当前毫秒时间采用同一类型入口。 | POC platform-ports/error factory | CONFIRMED | T-8/TR-06 |
| `ErrorCategory` | 错误 | 所有模块和呈现层必须共享九类错误语义。 | transport runtime、future modules/UI | CONFIRMED | C-6/F-3 |
| `ErrorSeverity` | 错误 | 所有模块和呈现层必须共享四级严重度。 | transport runtime、future modules/UI | CONFIRMED | C-6/F-3 |
| `ErrorDefinition` | 错误 | 模块定义错误与 resolver/runtime 读取需同一形状。 | POC transport runtime、future modules | CONFIRMED | T-5/F-3 |
| `ErrorTemplateValue` | 错误 | 模板 writer 与 renderer 必须共享可展示值域。 | module error producers/renderer | CONFIRMED | F-4/C-4b |
| `ErrorTemplateArguments` | 错误 | 每模块 placeholder key 可变，但 value 边界必须共享。 | module error producers/renderer | CONFIRMED | F-4/C-4b |
| `RenderedErrorTemplate` | 错误 | renderer 与 createAppError 对 message/missingKeys 需同一结果。 | error factory/diagnostic caller | CONFIRMED | T-3 |
| `AppError` | 错误 | transport/runtime/UI 对已实例化错误需同一结构。 | POC transport runtime、future UI | CONFIRMED | T-4/F-3 |
| `ErrorCatalogEntry` | 错误 | catalog 与 resolver/UI 必须共享模板来源事实。 | future catalog/runtime/UI | CONFIRMED | C-6/F-3 |
| `ResolvedErrorView` | 错误 | resolver 与 UI 必须共享最终文案来源事实。 | future runtime/UI | CONFIRMED | C-6/F-3 |
| `CreateAppErrorContext` | 错误 | 错误 producer 与 factory 共享可关联上下文字段。 | transport/runtime command producers | CONFIRMED | F-3/T-8 |
| `CreateAppErrorInput` | 错误 | producer 与 factory 共享 args/context/details 输入边界。 | transport/runtime command producers | CONFIRMED | F-4 |
| `renderErrorTemplate` | 错误 | 所有模块错误模板必须用同一缺参规则。 | createAppError、future catalog resolver | CONFIRMED | T-3/T-7 |
| `createAppError` | 错误 | 所有模块构造错误必须统一 code/time/context/missingKeys。 | POC transport runtime、future modules | CONFIRMED | T-8/F-4 |
| `isAppError` | 错误 | 跨包边界识别 AppError 必须用同一 guard。 | transport/runtime/UI guards | CONFIRMED | T-4/T-7 |
| `ParameterValueType` | 参数 | 模块定义与未来 resolver 必须共享四值参数类型。 | future workflow/runtime | UNVERIFIED_TER_NEED | C-6/F-3 |
| `ParameterDefinition` | 参数 | 任意模块声明参数时需要同一泛型边界。 | future workflow/modules/runtime | UNVERIFIED_TER_NEED | F-3/F-4 |
| `ParameterCatalogEntry` | 参数 | future catalog 与 resolver 需共享 raw/source/time 形状。 | future runtime/transport | UNVERIFIED_TER_NEED | C-6/F-3 |
| `ResolvedParameter` | 参数 | future resolver 与调用模块需共享 value/source/valid 结果。 | future runtime/workflow | UNVERIFIED_TER_NEED | C-6/T-6/F-3 |
| `ParameterDescriptor` | 参数 | AppModule 需要不含 any 的安全擦除视图。 | future runtime manifest reader | UNVERIFIED_TER_NEED | F-1/C-4b |
| `DefineErrorInput` | 定义工厂 | 模块 writer 与 error factory 共享不含派生 key 的输入。 | future modules | UNVERIFIED_TER_NEED | T-5/C-4b |
| `DefineParameterInput` | 定义工厂 | 模块 writer 与 parameter factory 共享泛型输入。 | future modules/workflow | UNVERIFIED_TER_NEED | T-5/F-4 |
| `ModuleErrorFactory` | 定义工厂 | factory 返回的 callable contract 必须具名供模块使用。 | future modules | UNVERIFIED_TER_NEED | T-5/C-4b |
| `ModuleParameterFactory` | 定义工厂 | 四类 parameter builder 必须作为同一具名能力暴露。 | future modules/workflow | UNVERIFIED_TER_NEED | T-5/F-4 |
| `createModuleErrorFactory` | 定义工厂 | 模块不得自行拼错误 key。 | future modules | UNVERIFIED_TER_NEED | T-5/T-7 |
| `createModuleParameterFactory` | 定义工厂 | 模块不得自行拼参数 key/type。 | future modules/workflow | UNVERIFIED_TER_NEED | T-5/T-7 |
| `listDefinitions` | 定义工厂 | registry/runtime 对定义对象取值需保留 value union。 | future runtime/workflow | UNVERIFIED_TER_NEED | F-4/T-7 |
| `AppModuleKind` | 模块 | TR-09 owner/toolkit 最终状态需统一闭集。 | future runtime/所有 manifest writers | UNVERIFIED_TER_NEED | F-1/C-6-review |
| `AppModuleDependency` | 模块 | manifest writer 与 runtime 装配器需共享依赖形状。 | future modules/runtime | UNVERIFIED_TER_NEED | F-1 |
| `AppModuleCommandDescriptor` | 模块 | module 与 runtime 对 command 暴露面需同名。 | future modules/runtime | UNVERIFIED_TER_NEED | F-1 |
| `AppModuleActorDescriptor` | 模块 | module 与 runtime 对 actor 注册需同名。 | future modules/runtime | UNVERIFIED_TER_NEED | F-1 |
| `AppModuleMiddlewareDescriptor` | 模块 | module 与 runtime 对 middleware/priority 需同名。 | future modules/runtime | UNVERIFIED_TER_NEED | F-1 |
| `AppModuleSliceDescriptor` | 模块 | TR-09 slice 所有权与 persist intent 需同名。 | future owner modules/runtime | UNVERIFIED_TER_NEED | F-1 |
| `AppModule` | 模块 | 所有模块声明与 runtime 装配必须共享根描述符。 | future all modules/runtime | UNVERIFIED_TER_NEED | F-1 |
| `CommandLifecycleStatus` | request | runtime/actor/ledger 对 command 状态必须共享六态。 | future runtime/workflow | UNVERIFIED_TER_NEED | F-3 |
| `RequestLifecycleStatus` | request | runtime/ledger/UI 对 request 状态必须共享三态。 | future runtime/UI | UNVERIFIED_TER_NEED | F-3 |
| `CommandResultPatch` | request | command producer 与 ledger 对增量结果需同一泛型形状；来源为需求 §6.4。 | future runtime/transport | UNVERIFIED_TER_NEED | F-4/C-4b |
| `CommandResultSnapshot` | request | ledger 与 consumer 对最终 result/error 需同一泛型形状。 | future runtime/UI | UNVERIFIED_TER_NEED | F-3/F-4 |
| `RequestCommandSnapshot` | request | runtime/ledger 对每个 command 快照需同一字段。 | future runtime/UI | UNVERIFIED_TER_NEED | F-3/F-4 |
| `RequestLifecycleSnapshot` | request | runtime 与 selector/UI 对本机 request ledger 需同一聚合形状。 | future runtime/UI | UNVERIFIED_TER_NEED | F-3 |
| `CommandRouteContext` | request | state/runtime 的本机 workspace/instanceMode 路由需同一形状。 | POC state-runtime；future TER runtime/state | UNVERIFIED_TER_NEED · LOCAL_ONLY | F-3 + serialization review boundary |
| `TransportRequestContext` | transport | port/transport/logging 对 request IDs 上下文需同一形状。 | POC transport/runtime/logging | CONFIRMED | F-3/C-4b |
| `TransportServerAddress` | transport | assembly config writer 与 transport reader 需共享 address。 | POC transport runtime、future assembly | CONFIRMED | F-3 |
| `TransportServerDefinition` | transport | config writer 与 transport reader 需共享 server/address 集合。 | POC transport runtime、future assembly | CONFIRMED | F-3 |
| `TransportServerConfigSpace` | transport | 多环境配置 writer/reader 需共享 space/server 集合。 | POC transport runtime、future assembly | CONFIRMED | F-3 |
| `TransportServerConfig` | transport | 启动层与 transport runtime 需共享选中空间。 | POC transport runtime、future assembly | CONFIRMED | F-3 |
| `TransportServerAddressOverride` | transport | 启动 override 与 resolver 需共享 address override。 | POC transport runtime、future assembly | CONFIRMED | F-3/C-4b |
| `TransportServerOverride` | transport | 启动 override 与 resolver 需共享 server override。 | POC transport runtime、future assembly | CONFIRMED | F-3/C-4b |
| `ResolveTransportServerConfigOptions` | transport | assembly/runtime 调用 resolver 时需共享选择与 override 输入。 | POC transport runtime、future assembly | CONFIRMED | F-3 |

## 5 · TR-05 十三处 `Record` + 一处 `any` 的逐项处置

| 位置 | 选择 | 具体形态与理由 |
|---|---|---|
| `AppError.args` | A | `AppError<TArgs extends ErrorTemplateArguments>`；每个错误调用点的 placeholder 集合确定。 |
| `CreateAppErrorInput.args` | A | 与 `AppError` 传递同一 `TArgs`，传错 value 类型编译失败。 |
| `renderErrorTemplate(args)` | A | 同一 `TArgs`，值域限定为可展示 primitive，返回 `RenderedErrorTemplate`。 |
| `CommandResultPatch.result` | A | `CommandResultPatch<TResult extends object>`；每个 command 的 result 确定。 |
| `CommandResultSnapshot.result` | A | 与 request snapshot 传递同一 `TResult`。 |
| `RequestCommandSnapshot.result` | A | 与 request lifecycle 传递同一 `TResult`。 |
| `listDefinitions` 约束 | A | `TDefinitions extends object`，返回保留 `TDefinitions[keyof TDefinitions]`。 |
| `CommandRouteContext.metadata` | B · 删除 | 无字段级 reader；不能回答“谁读”，保留会在根包制造开放洞。 |
| `TransportRequestContext.metadata` | B · 删除 | POC 只透传/日志展开，无 key reader。 |
| `TransportServerAddress.metadata` | B · 删除 | POC 只 clone/merge，无 key reader。 |
| `TransportServerDefinition.metadata` | B · 删除 | 同上。 |
| `TransportServerAddressOverride.metadata` | B · 删除 | 同上。 |
| `TransportServerOverride.metadata` | B · 删除 | 同上。 |
| `AppModule.parameterDefinitions<any>` | B | `readonly ParameterDescriptor[]`；通过 unknown 输入 type guard 安全擦除，绝不保留 `any`。 |

结果：`A=7`、`B=7`、`C=0`。metadata 的未来 writer/reader 仍为
`UNVERIFIED_REQUIRES_EVIDENCE`；出现具体 key 和 reader 后再增加具名字段，不为未来假设预留 index signature。

## 6 · CP 门控、测试与验证形态

### CP-1 · 源码、公开面、T/F 夹具

目录只新增：

```text
src/types/{ids,error,parameter,module,request,command,transport}.ts
src/foundations/{time,runtimeId,errorTemplate,definition}.ts
test/contracts.test.ts
test/public-surface.typecheck.ts
vitest.config.ts
```

现有 `moduleName.ts`、`dependencies.ts` 不改。`src/index.ts` 改为逐项显式 export。
`tsconfig.json` 用一个闭包包含 `src/**/*.ts`、`test/**/*.ts`、`vitest.config.ts`；
`test/public-surface.typecheck.ts` 不匹配 Vitest include，只由 tsc 编译。

`package.json` 保持 dependencies/peerDependencies 空或不存在，只新增：

```json
"test": "vitest run --config vitest.config.ts"
"vitest": "4.1.10"
```

T-1…T-9 的可执行形态：

| 断言 | 实现观察 |
|---|---|
| T-1/T-2/T-9 | 九个便利函数逐个核前缀；同 kind 连续生成至少 32 个均唯一；brand 互传在 F-2 编译失败。 |
| T-3 | 完整 args 得完整 message/空 missingKeys；缺参保留 `${key}` 且 missingKeys 精确含 key。 |
| T-4 | 合法 AppError 为 true；对每个必需字段分别删除后均 false。 |
| T-5 | error/parameter factory key 等于 `moduleName.localKey`；不同 module 同 localKey 不等。 |
| T-6 | 三个 `ResolvedParameter.source` literal 都可构造；`catalog-fallback !== default`。不声称 resolver 行为。 |
| T-7 | `renderErrorTemplate`、两类 definition factory、`listDefinitions`、`isAppError` 同输入两次深相等；排除正本点名副作用。 |
| T-8 | `vi.useFakeTimers` + `vi.setSystemTime` 后 `createAppError.createdAt` 精确等于固定毫秒。 |
| T-9 | 同 T-1 的 32 次集合检查，且每项前缀正确。 |

F-1…F-4 从 `@catering-v2s/kernel-base-contracts` 包根导入七组：

- F-1：`AppModule` 不给 `packageVersion` 可构造；
- F-2：`RequestId` 传给接收 `CommandId` 的函数，带 `@ts-expect-error`；
- F-3：构造 `RequestLifecycleSnapshot`、`CommandRouteContext`、`TransportServerConfig`、`AppError`、
  `ParameterDefinition` 的完整合法值，并引用其余组的公开符号；
- F-4：对 error args 三处、result 三处与 `listDefinitions` 各放一个错误类型的
  `@ts-expect-error` 或等价静态断言，证明 7 个 A 处置确实收窄。

4c 反控只操作 scratch：复制本包与 terminal base tsconfig，删除 F-2 一行 `@ts-expect-error`，运行仓内
`tsc --noEmit` 必须非 0；真实树随后必须再次 typecheck 绿。另用 `--listFilesOnly` 证明
`test/public-surface.typecheck.ts` 在编译面。scratch 必须 cleanup PASS。

### CP-2 · 四道门、support check 与 TER verifier

新增 `tools/terminal-contracts/check-static.mjs` 与 `check-static.test.mjs`，复用 TypeScript Compiler API，
不把 contracts 门混进骨架 `RULE_GATES=6`：

| 门 | 实现 | 定向红夹具 |
|---|---|---|
| C-2 | AST 扫 `contracts/src/**` 的 import/call/identifier，拒绝 fetch/XMLHttpRequest/storage/process/fs/native 模块；允许 Date/Math/crypto。 | 加 `fetch('/x')`。 |
| C-4b | AST 扫 exported interface/type/function 的成员、参数、返回、泛型约束；全 src 扫双重 assertion。 | 分别注入 `Record<string, unknown>`、泛型 extends、`as unknown as`。 |
| C-5 | 解析 `RuntimeIdKind` 与 `runtimeIdPrefixes` key 双向 exact-set，并核 value 唯一。 | 删除一个 prefix key。 |
| C-6 | TypeChecker 展开七个具名位置，核字面量集合 exact-set 与基数。 | 把 `ErrorCategory` 改成 `string`。 |

额外 support check 用 module symbol 比对 §4 的 74 名 exact-set，并拒绝任何 `export *`；做“删一个”和
“加一个”两种红控制。输出固定为 `CONTRACT_RULE_GATES=4`、`CONTRACT_SUPPORT_CHECKS=1`，不会把 exact
exports 冒充第五道业务规则门。

model test 每次复制最小临时树、只改变目标一处、断言目标门红而其余门/support 仍绿，最后删除临时树；
真实树四门与 support 全绿。`tools/terminal-skeleton/verify-static.mjs` 顺序运行骨架 model/real、contracts
model/real，全部成功才打印 `TERMINAL_STATIC=PASS`。

`tools/terminal-skeleton/verify.mjs` 必须把 test owner exact-set 改为 contracts + 五个 adapter（6 个），
并在 typecheck 后、Expo export 前真正执行 filtered `turbo run test`，不能只 dry-run。contracts 打印真实测试
marker；adapter 打印 NO_TEST_FILES marker。否则 TER verify 能在 contracts test 红时假绿。

### CP-3 · adapter devDeps 与零测试 runner

当前真实首败不是 Jest no tests，而是五包均声明 `type: module`，包内 `test.js`/`util.js` 却使用 CommonJS
`require`；本机 Node 24.13.0 运行 `persist-kv` runner 得 `ReferenceError: require is not defined`、exit 1。
因此先把这两个 package-local script 转成 ESM，再实现“有测试才启动 Jest；无测试打印
`TERMINAL_PACKAGE_TEST=PASS kind=NO_TEST_FILES package=<name>` 并 exit 0”。不使用
`--passWithNoTests`，避免测试发现配置坏时假绿。当前五包未声明 `testMatch`；若未来出现该配置，
输出 `UNSUPPORTED_TEST_MATCH` 并 fail closed，禁止静默把有效测试计为 `NO_TEST_FILES`。有限五份
脚手架脚本保持同形，不新增根级共享 runner。

版本来源与顺序：

1. 从同批 latest blank TypeScript template raw manifest 读取集合 A：`expo`、`react-native`、
   `@types/react`、`typescript`；与 assembly 当前证据对拍，若 latest 滚动则整个证据单元重取。
2. 在每个 adapter cwd 依次执行
   `npx expo install --yarn --dev jest-expo babel-preset-expo -- --mode=update-lockfile`；顺序固定
   `persist-kv → device → app-control → logger → dual-screen`。第一个成功且写入面核对正确后再继续。
3. 禁止裸 `expo install`、`--fix`、手写第三类版本或手改 lockfile；任一非 0 保存首败并停机。
4. 五包完成后从仓根统一运行一次 `yarn install` 做最终 convergence。

这里把写入面分两层：**语义写入面**只能是当前 adapter `package.json.devDependencies` 的五个目标值；
Expo/Yarn 可派生更新根 `yarn.lock`、`.yarn/install-state.gz` 与安装树，但不得改变另一个包 manifest、
dependencies、peerDependencies、native/Gradle/config。`--mode=update-lockfile` 用于避免五次完整 link，最终只做一次
安装；若 Expo CLI 不透传该 Yarn 参数，首包立即停机并记录，不现场换 package manager 或手填版本。

逐包记录 cwd、解析 CLI/SDK/template 精确版本、命令、stdout/stderr、exit、五项 before/after、非目标字段
exact-set、派生 lock diff。预期 `jest-expo ~57.0.5`、`babel-preset-expo ~57.0.9` 仅用于对账，实际以当次
Expo 解析为准；`jest ^29.7.0`、七个其他 devDeps 与 peer `*` 不动。

### CP-4 · 全范围验收

先做 fresh 全范围三维对账，再运行：

1. contracts package typecheck + 4c scratch 反控；
2. contracts Vitest T-1…T-9；
3. contracts static model/real；
4. `yarn workspace @catering-v2s/terminal verify:static`；
5. `yarn workspace @catering-v2s/terminal verify`，只用 TER-local 入口；
6. 单独核对 test task exact-set=6、真实测试包=1、NO_TEST_FILES=5；
7. 核对 skeleton 六门/入口可达仍绿，frontend task owner=0；
8. 读取新鲜日志，分开记录 business 与 scratch cleanup。

不运行仓级 normal `scripts/verify`、设备、Gradle、Kotlin、DEV、seed、L2、UAT。

## 7 · 声明—传递—消费矩阵

| fact | declaration | transfer | consumption | proof |
|---|---|---|---|---|
| branded ID | `types/ids.ts` | `src/index.ts` 显式 export | platform-ports/current future runtime | T-1/T-2/T-9、F-2、exact export |
| 模板缺参 | `RenderedErrorTemplate`、`AppError.templateMissingKeys` | `renderErrorTemplate` → `createAppError` | 错误调用方/未来 catalog resolver | T-3、F-3 |
| TR-05 泛型 | error/request/definition 的七个 A 位置 | 泛型参数贯穿父子 snapshot/factory | 公共入口消费者 | F-4、C-4b |
| metadata 不存在 | 六个接口明确无 metadata | 无 | 无 reader | exact exports/types review、同根搜索 |
| AppModule 版本可选 | `AppModule` | 公开入口 | future runtime | F-1 |
| source 闭集 | error/parameter type aliases | 公开入口 | future registry/runtime/UI | C-6、T-6 |
| test 执行集合 | terminal verifier 固定六 owner | Turbo filtered test | 1 real + 5 none | dry-run exact-set + actual markers |
| adapter SDK 版本 | template raw + Expo install | 五包 devDeps + Yarn lock | package test toolchain | per-package diff + one-click test |

## 8 · 实施前全链同步变更清单

| 变更事实 | 契约/唯一源/生成物 | backend | frontend | focused/静态/运行 | fixture/seed | 结论 |
|---|---|---|---|---|---|---|
| 七组共享语言 | contracts `src/**` / `src/index.ts` | N/A：无后端消费 | N/A：本批不改 UI | T/F、四门、typecheck | N/A：无数据 | 同步修改 contracts + tests + checker |
| 一键 test 真执行 | terminal package scripts / verifier | N/A | N/A | Turbo dry+actual | N/A | 同步修改 verifier 与 5 runner |
| adapter SDK devDeps | template raw、Expo install、Yarn lock | N/A | N/A | 逐包 probe + package tests | N/A | 五包 manifest + Yarn 派生生成物 |
| 公开面 exact-set | 本文 §4 + `src/index.ts` | N/A | N/A | module symbol support check | N/A | 唯一导出入口 |

## 9 · POC 显式差异

- `AppModule.packageVersion` 必填 → 可选；新增 `kind`，不建版本常量。
- `renderErrorTemplate` 缺参变空串 → 保留 `${key}` 并返回 missingKeys；AppError 携带该事实。
- 13 个 `Record<string, unknown>` + 1 个 `any` 按 §5 变为 A=7/B=7/C=0。
- POC 不安全的 caller-chosen `createRuntimeId<TId>` → kind 决定 brand。
- 删除 `INTERNAL_REQUEST_ID`、`formatTimestampMs`、五个通用 validator、所有跨节点 envelope 与空壳目录。
- `CommandRouteContext` 只保留本机已有 reader 的 workspace/instanceMode，明确 local-only。
- `RequestLifecycleSnapshotEnvelope` 随 wire protocol 推迟。
- POC test tsconfig 未接 package typecheck；TER 用唯一 tsconfig 真正编译 test。

## 10 · 未决项、停机条件与恢复

| 项 | 当前状态 | 本批处理 |
|---|---|---|
| 组 5/6 最终字段 | `UNVERIFIED_TER_NEED` | 实现批准的当前形态但不冻结；runtime 批复核。 |
| metadata future writer/reader | `UNVERIFIED_REQUIRES_EVIDENCE` | 当前删除；有具名读写者才重新设计。 |
| create-expo-module 完整安装 | `UNVERIFIED_REQUIRES_EVIDENCE`（EALLOWSCRIPTS） | 不重跑、不声称解除。 |
| 五 adapter 完整 install/lock resolution | `UNVERIFIED_REQUIRES_EVIDENCE` | CP-3 用真实命令、首败、Yarn 派生证据关闭或阻断。 |
| T-6 invalid remote resolver 行为 | `UNVERIFIED_TER_NEED` | 只证明 discriminant；未来 resolver owner 承担行为测试。 |

停机条件：设计独立审查 NO-GO；任一 CP 三维对账 OPEN；Expo install 非 0 或越过语义写入面；Yarn 供应链/
网络失败；真实树门/测试/typecheck 不绿；scratch cleanup 非 PASS。失败后保留首败，读取实际日志和写入 diff，
不得通过放宽门、passWithNoTests、手填版本、改 package manager 或延长等待冒充修复。

## 11 · 交付前自查

- [ ] IA/interaction 明确 `NOT_APPLICABLE` 且有理由。
- [ ] §4 exact-set 与真实 module symbols 双向相等，无 `export *`。
- [ ] TR-05 14 行逐处与源码/F-4/C-4b 对上，C=0。
- [ ] T-1…T-9、F-1…F-4、4c 反控均有新鲜证据。
- [ ] 四门每个定向红、其他门绿、真实树绿；support check 有增/删两种红。
- [ ] TER verify 真执行 test；真实测试包 1，明确零测试包 5。
- [ ] 五 adapter 只有批准的 devDeps/test runner 与 Yarn 派生面变化。
- [ ] 骨架六门、入口可达、22 包 typecheck 与 Metro 未回归。
- [ ] 组 5/6、metadata、脚手架闭包与 resolver 边界未被升格。
- [ ] 每 CP fresh 对账和全范围 fresh 对账完成；最终进入 `REVIEW_TARGET=IMPLEMENTATION` 独立审查。

## 12 · 独立设计审查 Round 1 intake

| finding | 分类 | owning-source 复核 | 处置 |
|---|---|---|---|
| M-1 · T-6 literal 假绿 | `CONFIRMED`（矛盾成立）；“在 contracts 新增 resolver”方案 `REJECTED_WITH_EVIDENCE` | 需求原 T-6 要求 invalid-remote 行为，但 §4.1 精确范围无 resolver；POC 行为 owner 是 `definition-registry`，TER 对应 owner 未落地；contracts §2.2 明确不是 runtime/tool 总集。 | 最小修复是同步需求 T-6 为本包实际拥有的 closed discriminant 判据，并新增 D-3；未来 resolver owner 以真实 invalid-remote 输入验行为。本批不得声称 resolver 已实现。 |
| S-1 · C-4 只有组级证据 | `CONFIRMED` | 需求 C-4 与交付物明确要求每个 export 回答；74 名中混有 CONFIRMED、support type、UNVERIFIED、local-only，组级说明确实掩盖差异。 | 新增 §4.11 的 74-row 表，逐项写共享性、消费者类别、证据档位与覆盖；机器 support 仍只做 exact-set，不冒充性质判断。 |

M-1 不需要新增产品语义：处置删除了一条当前 owner 无法履行的过度声称，没有把未来 resolver 归属提前钉死；
如果未来 runtime/workflow 设计选择不同 owner，以当批详设为准。
