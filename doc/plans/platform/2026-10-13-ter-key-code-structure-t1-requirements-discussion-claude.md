# TER 重点代码结构 T1 优化 · 需求讨论分析稿

日期：2026-10-13。状态：`DISCUSSION / NOT_APPROVED_FOR_IMPLEMENTATION`。

本稿记录 Dexter 的原始需求，并以当前源码分析候选边界。不是正式需求、详设或实施授权；不修改开发规范、项目记忆或生产源码。Codex 在途工作不因本稿被暂停或扩大。所有新增能力、编译、测试、生成、verify、DEV、设备与 cleanup 均为 `NOT_RUN`。

## 1 · 原始需求（逐字记录）

> 我们现在开一轮新的需求“TER重点代码结构T1优化”，我说一下我发现的问题，然后你开一个需求讨论稿，记录我原始的需求，然后对需求加以分析、讨论和建议。同时阅读/Users/dexter/Documents/workspace/idea/_old_ 和/Users/dexter/Documents/workspace/idea/newPOSv1之前做POC时候的代码，仅供参考。T1优化的核心目的是让TER代码更加清晰，权责边界更加明确。后续让人可以更方便的维护。不需要考虑包结构重构的成本，我只要最优最长远的方案。
>
> 1，XXX/src/features/actors/中，我不希望就用一个actors.ts把所有actor都丢进去，我希望每个actor一个文件，然后把公用的方法抽出来。XXX/src/features/slices/、XXX/src/selectors/也是一样，还有其他哪些可以适用的，你再想想
>
> 2，XXX/src/foundations/errors.ts,不是每个包都有，是真的不需要？还是各个包并没有按要求把错误抽出来。请全面盘点
>
> 3，还有terminal/kernel/base/contracts/src/foundations/definition.ts，我看好像没有什么包使用，是真的不需要？还是各个包并没有按要求把参数抽出来。请全面盘点
>
> 4，除了error和definition，还有哪些既定的机制没有被良好应用的，请全面盘点
>
> 5，XXX/src/features/commands/commands.ts，像commands，确实是一个文件即可声明包内所有的commands，不需要单独的目标，类似的还有XXX/src/parts/parts.ts，这类是否可以统一放在一个声明目录下？还有其他哪些可以适用的，你再想想
>
> 6，请仔细读一下terminal/ui/integration/sample-console/src/assembly/assembly.tsx，请你仔细分析createIntegrationAssembly的职责边界，比如在其中定义stateSyncSlices我觉得就是不合适的，因为每个包是否应该被sync，应该是在包内自己声明的，在assembly中只要把它加载了，应该就自然会被识别为sync，然后被纳入到topology中。这只是我举的一个例子，我的核心思想是每个包的定义、声明、行为都要自闭环，不要放到外面再去组装。createIntegrationAssembly应该简化，简化到只声明要加载什么包，以及包内自己无法获得，需要外部传入的变量。还有其他哪些可以适用的，你再想想
>
> 7，XXX/src/assembly中的代码，为什么要写死tdsEntryOneUrl、tdsEntryTwoUrl这类的变量？有几个URL不是固定的呀，也许有一个，也许有十个，它取决于后台服务的运行情况，dev、uat、生产都是不同的，为什么要把这种写死在代码里呢？我们之前说在package.json中定义，就是为了满足不同环境的情况。这是个错误的代码模式，请你仔细分析和判断这类模式下还有哪些其他的错误。
>
> 8，全面盘点TER下的所有代码
> 8.1，对每个包的每个代码逻辑进行分析，分析这个包的职责是什么，它关心什么，这段逻辑是否应该属于这个包，是否有更好归属。
> 8.2，是否存在多真相的场景，能够常量化能够引用的地方还在使用裸字符串，能够参数化统一调整的地方还在用裸数字，等等。
>
> 这是我要整改的全部内容方向，请先生成需求讨论分析稿，然后问我问题

## 2 · 为什么做、判断什么

T1 要解决的是：维护者打开一个包，能找到该包的行为、状态、公开读取、声明和外部依赖；修改该包能力时，不必猜测还要去哪个 App 补登记或复制相同判断。文件拆小只是手段，最终判据是事实住址唯一、调用链直接、生命周期和错误边界清楚。

建议以长期结构为目标，允许删除旧内部 API、搬迁文件和重新划分包；不因搬迁成本保留旧方案。仍须比较结构本身的复杂度：两个调用点相似，不自动证明需要一个新包；一个文件很长，不自动证明应拆成多个 actor。

本轮明确保留业务语义：command 驱动 actor 写状态，跨包 selector 读取，单机双屏共享 Runtime/store，副机无独立 TDS 连接，TDC 唯一凭证 owner，project-basic/store-basic 的业务事实边界。结构优化不借机恢复 event bus、全局 store、第二执行引擎或额外业务入口。

### 2.1 · 静态覆盖与限制

已枚举 `apps/terminal` 的 40 个 package.json：39 个功能 workspace 加一个根脚本聚合包。已检查各包的结构、声明机制使用位置，并重点重开 Runtime/State 注册、两个 integration、配置消费链、错误归一化、TDC/更新/拓扑及业务 feature 的责任接缝。两份旧仓仅作为组织方式参考。

配套的 [源码结构盘点](2026-10-13-ter-key-code-structure-t1-source-inventory-claude.json) 保存当前各包代码文件、路径、行数、摘要、定义机制命中位置和 README 路径，便于展开后续逐逻辑复核。共枚举 1,229 个代码/配置文件，分别标出 implementation、generated、vendor、test、configuration；排除 node_modules、build、dist 等安装/构建目录及 .runtime/.cache，不使用运行证据作源码判断。初次机械扫描混入的 4 个临时输出文件已从最终附件排除。它是此次分析附件，不是新增 gate、准入台账或运行证明。机械命中只表明出现了相应文本，不等于该机制被正确消费。

**没有宣称所有文件的每一条业务分支都已经完成语义审计。** 目前全包结构覆盖与热点调用链核验已完成，完整逐逻辑审查应作为正式 T1 的明确工作内容；不能用一份目录清单冒充该审查。生成物、第三方 vendor、手写实现、测试、原生桥与构建配置应分别归因，不能把生成文件的重复字面量当成手写多真相。

## 3 · 文件组织：行为分文件，声明可集中

### 3.1 · 当前事实

一个文件声明多个 actor 的实例包括：

| 路径（均在 apps/terminal 下） | 本轮文本盘点 | 讨论结论 |
|---|---:|---|
| kernel/base/ui-state/src/features/actors/contentActors.ts | 6 个 defineActor | 按 screen/layer 等实际责任分文件 |
| kernel/base/ui-state/src/features/actors/variableActors.ts | 2 个 | 按变量责任分文件 |
| kernel/feature/sample-member-registry/src/features/actors/actors.ts | 4 个 | 各 actor 具名文件，共用纯判定提取 |
| kernel/feature/sample-staff-session/src/features/actors/actors.ts | 3 个 | 各 actor 具名文件 |
| ui/feature/sample-member-desk/src/features/actors/actors.ts | 7 个 | 路由、确认、恢复等 actor 各自定位 |
| ui/feature/sample-staff-auth/src/features/actors/actors.ts | 4 个 | 各 actor 具名文件 |
| ui/feature/sample-wallpaper-picker/src/features/actors/actors.ts | 2 个 | 各 actor 具名文件 |
| 两个 ui/integration 的 src/application/module.ts | 各 2 个 | actor 实现离开 application；module 只组装 |

display-context 和 runtime 已有按 actor 具名分文件的正例，可复用现有表达方式。

另一方面，`terminalDataClientActor.ts`、`terminalUpdateActor.ts`、`remoteControlActor.ts` 和 topology/project-basic/store-basic 的大 actor 文件，主要问题并不是“一文件多个 defineActor”，而是一个 actor 内混合很多 handlers、异步资源和辅助规则。仅改文件名不会改善维护性。

### 3.2 · 建议要求

1. 一个 actor 定义一个文件，文件名表达能力，如 `activationActor.ts`、`connectionActor.ts`；不再使用内容杂糅的 `actors.ts`。同一 actor 可处理同一责任下的多条 command，不机械变成“一 command 一 actor”。
2. 一个 slice 定义一个文件，状态类型、初始化、reducer、持久化/同步 descriptor 保持可沿同一 owner 追踪。不能把 slice 的 descriptor 搬到 integration。
3. 一个公开 selector 定义一个文件，内部纯派生可以按明确责任共享；不建混写注册器和读取器的 `selectors/index.ts`。
4. hooks、components、contexts、原生能力类同样按具名责任分文件；沿用现有一 hook 一文件。一个组件文件可保留只为该组件服务的小私有子组件，不制造大量单行包装文件。
5. 多处实际复用、且无副作用的规则放在本包 foundations；触达网络、平台、store 或资源生命周期的对象不能因“公用”就塞进 foundations。它们留在 actor 所属责任，或端口 implementations 中。
6. 大 actor 拆分前先标明 command handler、状态写点、定时器/连接/队列的唯一 owner、共享生命周期和并发顺序。不能拆出两套连接控制器、两份 pending 或两份 boot 事实。

### 3.3 · 候选目录

Dexter 已确认采用 `declarations/` 作为静态声明住址，替代散落的声明目录；不是另建一个注册中心：

```text
src/
  index.ts                         # 显式公共入口，无实现
  moduleName.ts                    # 包身份正本
  dependencies.ts                  # 依赖声明
  declarations/
    commands.ts                    # 本包 commands 集中定义
    errors.ts                      # 本包可识别的领域/能力错误
    parameters.ts                  # 本包具名策略参数与默认值
    parts.tsx                      # UI 包的 part 声明及 renderer 引用
    variables.ts                   # UI 变量定义；不执行状态更新
  features/
    actors/<capability>Actor.ts     # 一定义一文件
    slices/<fact>Slice.ts           # 一状态定义一文件
  selectors/select<Fact>.ts         # 一公开读取一文件
  foundations/<pureCapability>.ts   # 纯规则与纯工厂
  implementations/<port>.ts         # 有副作用的端口实现
  application/createModule.ts      # 汇总本包真实定义
  types/                           # 纯类型，不放运行时对象
```

这是已确认的 T1 需求输入，尚不是已同步的规范或实施授权。当前规范 `doc/platform/terminal-coding-standard.md:1172–1197` 的闭合目录词表不允许 declarations，commands 与 parts 也有现行住址。正式 T1 须同步规范、结构检查器、生成器、包导出和文档，禁止只移动代码造成规则互相冲突。本轮不修改这些正本。

不是每包都要有上述全部文件；无本包错误/参数/part 的包不建空文件。generated、theme、vendor 等保留各自用途。普通工具常量按纯能力就近放置，不把所有字符串、样式和算法常数堆进一个总 constants.ts。

## 4 · errors 与 definition：有真实缺口，也有已退役机制

### 4.1 · 已确认的现状

`kernel/base/contracts/src/foundations/definition.ts:30–68` 已有 `createModuleErrorFactory`、`createModuleParameterFactory` 和 `listDefinitions`。实际错误创建、模板插值、AppError 检查在 `foundations/errorTemplate.ts:27–109`；contracts 自身并没有 `foundations/errors.ts`，不应按不存在的路径猜测机制。

当前生产 error factory 消费者是 5 个包：ui-state、sample-member-registry、sample-staff-session、sample-wallpaper、UI/sample-wallpaper-picker。当前生产 parameter factory 与 listDefinitions 消费者未发现。`contracts/types/module.ts:32–33` 仍有 errorDefinitions/parameterDefinitions，但 Runtime 未发现消费这两个字段的闭环。

definition 的 parameter 指带默认值/值类型的**具名配置参数**，不是 command payload、HTTP 参数或函数实参；不能要求将所有请求字段塞进 definition。

重要原始裁决位于 `doc/review/platform/2026-08-28-newposv1-package-analysis-claude/00-ter-build-order-claude.md:491–518`：Dexter 已取消从 store 动态读 parameter/error catalog，要求各包自己定义，以免数字和字符串散落。因此零 parameter factory 消费是待整理的静态定义采用问题，不是应该重建动态 catalog 的证据。

### 4.2 · 为什么仅看 errors.ts 文件存在与否不够

| 错误来源 | 建议住址/处理 | 不应做的事 |
|---|---|---|
| 本包可预期的业务拒绝、输入校验、资格不足 | 本包 declarations/errors.ts；保持具名 code/category，actor 返回已有 AppError/result 通路 | 全部抛普通 Error 后让 Runtime 变成 SYSTEM |
| 本包内部不可满足的程序不变量 | 可保留 Error，由 Runtime 兜底并留下诊断 | 假装是用户业务拒绝 |
| CBS canonical typed problem | generated/API error 类型保留服务端身份，由消费 owner 映射本地行为 | 再手写另一份 CBS 错误闭集 |
| 平台端口 unavailable/native 失败 | platform-ports 定义能力结果，adapter 映射原生错误 | adapter 建第二套业务错误协议 |
| 纯 renderer/类型包，无可拒绝能力 | 可以不声明包级业务错误 | 为满足文件数量建空 errors.ts |

源码反例：server-config 的用户配置拒绝在 `serverConfigActor.ts:28–30,63–81` 使用普通 Error；Runtime `normalizeRuntimeError.ts:40–66` 将其归 SYSTEM，render 的 `requestOutcome.ts:5–17` 按 system-failure 呈现。这至少要求重新区分“用户可以改正的配置错误”与“程序故障”。sample-staff-session 在已有错误机制外仍有 malformed payload/active guard 普通 Error，需按触发方核对，不能一概算程序员错误。

同族盘点还包括 display-context 的 `displayErrors.ts`、Runtime 多个文件手写的 error definition、topology actor 内构造 AppError，以及 adapter 的 PortResult 映射。目标是定义来源唯一和消费正确，不是强制所有包都依赖错误工厂。

contracts README 的 `{commandName}` 与实际 `${commandName}` 插值语法不一致；文档示例也属于本专项的修正范围，不能留下“有统一机制、示例却引导错误用法”的情况。

### 4.3 · 参数与常量的建议边界

Dexter 已确认本包的超时、重试间隔、队列/分页策略等可独立调整的默认值统一采用具名静态 ParameterDefinition，复用现有工厂；无需动态配置 UI、远端参数 catalog 或 fallback 层。decode/validate 等只在存在真实外部输入时使用，不为纯常量建立完整解析链。

协议固定上限、错误码、topic key、operation identity 从相应 canonical/generated 或 owning definition 引用；不要把它们包装成可任意调节的参数。数组下标 0、数值比较 1、毫秒单位换算等可读的算法常量不因出现数字就必须抽取。

`errorDefinitions/parameterDefinitions` 的 metadata 若没有实际消费者，应证明用途后派生，或删除无用公开面；不因类型上有字段就补一套运行期注册功能。

### 4.4 · 所有包的错误机制分类

以下是采用情况分类，不是全部代码缺陷结论。包含“进一步逐拒绝分支核对”的项目，不得凭缺少 errors.ts 直接判违规。

| 包组/包 | 当前类型 | 应核对的缺口 |
|---|---|---|
| contracts | 错误机制提供者 | 模板示例与实现同步，无需自建业务错误目录 |
| platform-ports | 已有 PortResult/unavailable | 保持能力错误，不与 AppError 重复 |
| state | 已有 PersistenceFailure 和声明校验 | 存储失败与构造期不变量分开 |
| runtime | 手写 AppError 定义 | 集中具名定义，公共归一化保持兜底 |
| display-context | 手写 displayErrors | 复用工厂/单源，无需第二协议 |
| topology | 手写 AppError＋普通 Error | 用户 locator 校验与系统不变量分开 |
| ui-state | 已用工厂，定义在 actor 内 | 收回声明目录；payload 拒绝分类 |
| transport | typed 事件＋普通 Error | 网络/配置/协议失败逐分支确认真实消费 |
| server-config | 用户拒绝多用普通 Error | 存在 §4.2 所述 SYSTEM 归类反例 |
| terminal-data-client | typed HTTP 拒绝、状态 reason、普通 Error | 保留生成错误身份；分清 parser 与可预期拒绝 |
| terminal-update | owner 状态、PortResult、invalid(code) | 任务拒绝/平台失败/程序不变量分开 |
| remote-control | 解析结果、状态、普通 Error | 会话结束/业务拒绝/清理失败各走既有合法通路 |
| sample-staff-session | 工厂已用 | 同包 payload/active guard 尚有普通 Error |
| sample-member-registry | 工厂已用 | active-session guard 分类需核对 |
| sample-wallpaper | 工厂已用 | active-session guard 分类需核对 |
| store-basic、project-basic | typed readiness/topic reason | HTTP、持久化、业务拒绝不混为一类 |
| render | 消费 Runtime requestOutcome | 不复制业务定义；构造错误不冒充业务拒绝 |
| primitives、input | 控件/Provider 使用契约错误 | 无需为其自建业务 error catalog |
| admin-shell | 消费各 owner 状态/错误 | 每个 section 的错误反馈与原类别一致 |
| terminal-activation | 消费 TDC 事实 | 激活错误仍归 TDC，不复制 |
| automation-agent | 独立协议 typed failure/Zod | 协议错误与执行 owner AppError 分开 |
| dev-host | PortResult 与宿主构造检查 | 无需复制业务 errors |
| feature-assembly | 模块输入形状检查 | 不为了统一文件新增业务 errors |
| integration-assembly | catalog/part 构造检查及 adapter 错误 | 核对 browser transport 的 typed 边界 |
| sample-staff-auth、sample-member-desk | 消费 kernel owner 结果 | 保持领域身份，只有自身呈现拒绝才本包定义 |
| sample-wallpaper-picker | error 工厂已用 | UI 子 command 错误映射及普通 Error 分类 |
| 两个 integration | 装配/应用路由拒绝 | 不能重定义 kernel/UI feature 业务错误 |
| Android device、dual-screen、persist-kv、remote、update | native/wire 结果→PortResult | 统一适配器边界，不建领域错误目录 |
| application/base/android、两个 Android App | 构造配置检查 | 不建立业务 errors；配置解析的错误责任明确 |
| TER 聚合包 | 无运行时业务代码 | 不需要 errors/parameters |

参数工厂当前全部生产调用为零，覆盖的是上述 39 功能包，而不是抽样几个包。使用静态工厂不必增加 module parameterDefinitions 字段消费；直接引用 owner 参数的默认值即可，是否还有必要保留这两个 module metadata 字段须按真实消费者决定。

另有三种“参数”必须明确分开：ParameterDefinition 是策略配置；SelectorParameterSchema 是自动化按名求值的输入 schema，已实际消费；command payload 的类型 brand 不等于运行期校验。`runtime/types/command.ts:53–71` 和 `defineCommand.ts:34` 没有 payload decoder；`validateSelectorArguments.ts:33–47` 则有真实校验。T1 应核对外部 wire/command 入口的现有校验，不借参数统一增建所有 command 的通用 schema 引擎。

## 5 · 包自闭环与 createIntegrationAssembly 的边界

### 5.1 · 同步名单：已可证实是第二份 owner 声明

完整链路：

- state `src/types/slice.ts:27–35,48–57` 已在 registration 声明同步资格/方向。
- Runtime `src/types/module.ts:91–100` 接收 stateSlices；`createRuntime.ts:412–423` 汇总交给唯一 StateRuntime。
- StateRuntime `src/types/runtime.ts:53–62` 已有 getSlices。
- console `assembly.tsx:231–239`、wallpaper `:218–226` 又各手写 stateSyncSlices。
- integration-assembly `foundations/stateSyncSlices.ts:11–17` 过滤外部名单。
- topology `createTopologyModule.ts:56–59,281–282` 再接收名单，controller 用它决定参与同步。

owner 已声明 sync，加载模块后仍可能因遗漏外部登记而不参与同步。建议复用 Runtime/State 的注册集合，经窄的只读 context 暴露给 topology，在生命周期中消费；删除 integration 的手写白名单。topology 不 import 业务 feature，不按文件扫描或 package.json 自动加载模块，不建立第二个 registry。

**可同步全集与业务就绪依赖不同。** 两 integration `application/module.ts:51–57` / `:50–56` 的 required projections 是当前业务恢复条件；不能机械替换为“等待全部 sync”。如果某行为必须等门店/项目/凭证投影，该行为 owner 自己声明其前提，Runtime 不猜业务准入。

### 5.2 · 其他同根住址问题

| 当前现象 | 源码线索 | 建议归属及限制 |
|---|---|---|
| update 当前候选重算、binding 与固定 target 相等判断在两个 assembly 重复 | console assembly:207–214；wallpaper:194–201 | project-basic 公共 selector/纯资格判定；terminal-update 继续用注入 provider，base 不反向依赖 feature |
| 激活 command 在 activation 包声明，通用屏幕映射/route actor 却靠每个 integration 补齐 | activation application/module.ts:7–19、parts/parts.tsx:40–82；两个 integration module | 核对产品 routing 后将通用激活呈现 actor 收回 activation；integration 保留激活→登录→业务的应用阶段选择 |
| staff 屏幕映射在 integration 又复写 | integration module:176–181；staff-auth actors:37–66 | 由 staff-auth command 自身完成幂等呈现，避免 integration 猜具体 partKey |
| 模块同时写描述 commands/actors/slices 与实际 definitions | RuntimeModule/AppModule；server-config/TDC/update module | 从 concrete definitions 派生 metadata；保留归属、brand、重复与 visibility 检查 |
| 版本默认值在一个 assembly 内不同 | console assembly:140 的 dev、:193 的 1.0.0 | 应用实际身份由运行入口唯一输入，消费者共同引用；不以相互无关的 fallback 掩盖缺失 |
| admin sections/variables/layer dismissals 需由应用手动合并 | 两 assembly 的 parts、variables、layerDismissals 输入 | 将已有包的声明纳入模块能力贡献；是否提供某 section/part 仍由 owning UI 包定义 |

`ui/base/feature-assembly/src/foundations/createFeatureAssemblyModule.ts:19–47` 已从实际定义派生 module 描述，是可复用正例。若提升为通用 Runtime 工厂，能力放在 runtime 所属层；不能让 kernel 依赖 ui.base。

### 5.3 · 不能因“自闭环”而错误下沉的内容

assembly 仍必须知道加载哪些模块、应用主题/surface 和外部输入。保留 platformPorts、native loading、真实 App/version、持久化 namespace、package.json defaults、peerChannel、实际 network adapter、受控测试 provider。

应用业务阶段顺序归 integration 的具名 actor，不塞进通用 createIntegrationAssembly，也不让 activation/staff/member 各自决定整机业务优先级。每个 UI 包负责自己的呈现 command 与 parts；integration 只发该公开 command。

跨 owner 资格可能造成依赖环：TDC 已依赖 topology，不能把 topology.canPair 的 TDC 条件硬搬进 topology，形成反向依赖。应核对共同资格事实的实际 owner，再选择窄 selector/provider；provider 本身不是越界，provider 内重新实现对方业务判断才是问题。

createIntegrationAssembly 内建立 Runtime、绑定 StateSource/RenderProvider、合并已加载声明、创建 surface 等仍是合法基础设施实现。所谓“只声明包和外部变量”，指应用调用方的输入简化，不是要求通用工厂消失或让 kernel 接管 React 渲染。

## 6 · 环境地址：固定数量不是长期模型

### 6.1 · 当前实现与同根影响

两 Android application 的 `assembly/managedServerSpaces.ts:5–9,43–96`，两 integration 的 `test-expo/App.tsx` 均使用 One/Two 字段及地址名映射，要求恰好替换两条。其调用者扩展到 platformPorts、automation 的 runner/androidDevice、多个 Journey、DEV environment 与 TDC acceptance。

但 contracts 的 TransportServerConfig 已是 servers/addresses 数组。server-config `validateServerConfigDefaults.ts:14–24` 另有限制 1～4 条；旧激活交互正式需求也曾保留该限制。因此 T1 不能只删 One/Two 接口，却仍让十条地址被 owner 拒绝。

当前 DEV 有两个受管 HAProxy 是环境拓扑事实，不是所有终端环境必须恰有两个地址的产品规则。

### 6.2 · 建议模型

每个运行入口的 package.json.serverSpaces 是其内置配置来源；server-config 负责校验、选择、覆盖、持久化与同步。DEV/UAT/生产可以不同，四个入口的 defaults 可分别不同，不把它们强行合并成跨 App 全局真相。

用具名集合传入服务和地址（serverName/addressName/baseUrl/timeoutMs 等实际字段），公共纯 resolver 验证并按名称匹配；禁止 One/Two、按位置猜映射、残留未替换的 DEV 地址、硬写某个集团路径或落入未声明的默认地址。transport 消费完整地址集合并负责既有轮转。

Dexter 已确认取消业务层固定地址数量上限，使数量随当前配置变化；不得以另设未经确认的技术预算恢复 4 条或其他固定数量限制。当前受管 DEV 仍为两个入口，端口所有权、loopback/boot 身份等校验继续保留。

本稿**不建议新增服务发现系统**；“按环境配置地址”与“终端实时发现后台节点”是不同需求。除非 Dexter 另行要求，T1 只闭合 package.json→外部注入→server-config→transport 的任意长度集合。

## 7 · 逐包职责盘点与优化落点

下表覆盖当前 39 个功能包。路径省略 `apps/terminal/`。这是源代码责任分析，不继承 README 的历史完成状态；列中“核对”是 T1 应闭合的实际检查，不是已经确认该包全部存在缺陷。

| 包 | 唯一职责与应保留内容 | T1 分析/落点 |
|---|---|---|
| kernel/base/contracts | 共享词汇、纯构造器、协议类型 | error/parameter 静态工厂；移除无消费者描述候选；不收各业务内部类型 |
| kernel/base/platform-ports | 平台接口和 typed unavailable | 端口能力/默认值单源；核对 README 端口数量与现有 update/remote 接口；日志政策不另立一套 |
| kernel/base/state | 按 descriptor 执行持久化/同步/reset | 没有业务 slice；已有注册视图复用；大 persistence engine 按编码、存储、生命周期分责任 |
| kernel/base/runtime | command/actor/selector 注册、执行与 request 生命周期 | 元数据派生；结果/error/late-result 同一闭包；不建第二错误或参数 catalog |
| kernel/base/display-context | 显示角色和只读派生 | 单 actor/selector 组织正例；设备事实不复制；displayErrors 统一定义住址 |
| kernel/base/ui-state | screen/layer/variable 状态协议与 catalog | React-free；多 actor 与 workspaceSlices 按责任拆；package UI 声明自然注册 |
| kernel/base/server-config | 服务配置和代理的校验/选择/持久化/同步 | addresses 任意长度；用户错误分类；参数集中；不持凭证、连接重试 |
| kernel/base/transport | HTTP/WS 连接、轮转和重试机制 | 不解释 TDP 业务帧；计时、队列、地址策略统一参数；保持唯一连接 owner |
| kernel/base/topology | 配对、peer 资格/可达性、同步协调 | 消费 State 注册全集；actor 与网络资源责任分开；不重定义 feature 状态 |
| kernel/base/terminal-data-client | 凭证、激活、TDP 协议与基础 HTTP command | 大 actor 分离 HTTP、激活、连接、topic、remote-result 责任时保持唯一凭证/连接事实；生成 API 不手写 |
| kernel/base/terminal-update | 本机固定任务、版本资格、执行、报告 | 不拥有项目规则；大 actor 将纯比较/报告分类提取，boot/task 持久事实只有一份 |
| kernel/base/remote-control | 远控会话 command/actor/state | 不拥有 LiveKit/Android 实现或组织数据；生命周期和 CBS/TDC 接缝具名 |
| kernel/feature/store-basic | 门店/经营规则/合同/服务点资料与订阅 | 门店成功 command→自身其它加载；集合/详情差量具名；不拿项目/集团事实回来 |
| kernel/feature/project-basic | 项目/大区/集团资料、项目规则候选 | 监听门店成功后加载；候选资格 selector；不执行原生更新 |
| kernel/feature/sample-staff-session | 店员身份与登录/登出事实 | 3 actor 分文件；业务拒绝统一；不含 UI 路由/中文文案 |
| kernel/feature/sample-member-registry | 成员、pending、确认提交事实 | 4 actor 分文件；operation identity 判定共享；不含 surface/part |
| kernel/feature/sample-wallpaper | 本机确认/待确认壁纸事实与主机投影 | 对应 slice/selector 分文件；不持资源 URI 或图片 renderer |
| ui/base/primitives | 语义控件和真实节点接缝 | types、native slots、TestId 共用；不成为业务或自动化 owner |
| ui/base/input | 草稿、字段注册、选择与虚拟键盘 | InputSurfaceFrame 按渲染/布局责任拆；无第二业务 state，无各 feature 重造焦点/键盘 |
| ui/base/render | 只读状态到 UI 渲染树 | ScreenReadyBoundary、layer lifecycle 清晰；不发业务 reducer 或持业务事实 |
| ui/base/admin-shell | 本机 admin 入口、section 和呈现 | registry/大拓扑 section 按责任拆；配置、激活、更新状态消费各 owner；不复制权限/事实 |
| ui/base/terminal-activation | 激活呈现、readonly 引导、admin 状态 section | command 自带通用呈现 actor 候选；仍依 TDC 执行激活 |
| ui/base/automation-agent | 显式构建启用的自动化 UI/Runtime 桥 | 协议与 selector/request 观察分责任；生产剔除，不另造业务操作机制 |
| ui/base/dev-host | Expo Web 开发宿主和 Web ports | 大 testExpoApp 分宿主控件/画布/诊断；不拥有业务 Runtime、规则或 part |
| ui/base/feature-assembly | UI feature 定义汇总工具 | 派生 metadata 的正例；通用 Runtime部分下沉候选，不建额外注册层 |
| ui/base/integration-assembly | 通用 Runtime/Render/surface 装配 | 消费包内声明；不实现业务路由、同步资格或候选判断 |
| ui/feature/sample-staff-auth | 登录表单、提示与呈现 actor | 分 actor，parts/commands 集中；不重写 staff-session 资格 |
| ui/feature/sample-member-desk | 列表/表单/顾客确认呈现 | 7 actor 分文件；UI流程共享但 LMP/LSP 页面独立；pending 只消费 registry |
| ui/feature/sample-wallpaper-picker | 壁纸选择呈现和资源映射 | 2 actor 分文件；资源归 owning UI，状态归 kernel feature |
| ui/integration/sample-console | 加载模块、应用阶段路由、主题/surface | 删除包外事实名单；应用路由单 actor；版本身份一份 |
| ui/integration/sample-wallpaper-console | 壁纸 App 装配和阶段路由 | 同族优化，不合并不同 App 身份和业务页面 |
| adapter/android/device | Android 设备只读事实到 DevicePort | 不缓存另一份屏幕/角色状态；native 错误映射 PortResult |
| adapter/android/dual-screen | 同 ReactHost/VM 的双屏 carrier | ActivityHandler 按 native 显示生命周期拆责任；不引入第二 JS VM |
| adapter/android/persist-kv | 不透明字符串本地存取 | plain/protected 实现无业务字段知识；TDC 明文凭证策略不由 adapter 另猜 |
| adapter/android/update | 工件准备、系统安装、原生 boot/入口事实 | Runtime/Preparer 按 native action/loader/install 分责任；不再存业务任务账本 |
| adapter/android/remote | LiveKit、Window 帧与原生输入 | SDK/capture/input 分责任；不持授权、server config 或终端凭证 |
| application/base/android | 共用 native binding/loading 装配 | 核对当前真实职责；不升级为被退役的 host-runtime；不吞业务策略 |
| application/android/sample-terminal | Android console 入口/身份/平台注入 | package defaults、APK metadata 唯一；删除 One/Two resolver 副本 |
| application/android/sample-wallpaper-terminal | Android wallpaper 入口/身份/平台注入 | 同上，共享纯适配逻辑；保持不同 App 独立身份 |

根 `apps/terminal/package.json` 只汇总 workspace 和脚本，不是第 40 个业务 module。

测试和 runner 属于相应能力的验证工具，不决定业务事实。旧 runner 不因 T1 复活；固定地址输入、手写 operation/string、跨 App 接缝须同步唯一 automation driver 的当前消费者。TER 之外涉及的生成器和 DEV runner 只作为真实影响面，未来实施是否改动应在详设列清，不能以“只改包结构”漏掉编译或生产者。

## 8 · 其他未充分复用机制与多真相盘点

| 问题族 | 当前证据/候选 | 建议处理 |
|---|---|---|
| owner sync 声明重复登记 | §5 的完整 source 链 | 从现有 State registration 消费，不加新 registry |
| concrete definitions 与 descriptors 双写 | AppModule/RuntimeModule；feature-assembly 已派生 | 一份实际声明，metadata 派生 |
| package 能力须外部补 actor | activation/UI part 与 integration 重复映射 | 通用包自己具备完整呈现行为；应用只决定何时调用 |
| 参数工厂闲置、策略数字散落 | definition 消费为零；Runtime/Transport/update 的默认值 | 分类为参数、协议常量、算法量，owner 内集中 |
| AppError 与普通 Error 混用 | §4 的用户拒绝→SYSTEM 链 | 保留正确拒绝类别；不要只增加 errors.ts 却不改消费 |
| 协议 key/operation/topic 等裸字符串 | canonical→generated 已存在 | 用 generated/具名 definition；适配器的外部边界字符串不被盲目替换 |
| runtime/app/version/namespace 等身份默认值不同 | console assembly 默认值实例 | 来源由运行入口提供，消费者共同引用；不逐处猜 fallback |
| 公共根入口与实现混写 | adapter/android/update/src/index.ts:1–100 既公开类型又实现 native/invoke/URL 解析 | 实现归 implementations，纯 URL 判定归 foundations；根 index 只保留显式公开边界 |
| 固定显示/网络实例数泛化成永久模型 | 双 TDS slots；下标、service/address 名 | 区分产品固定双屏与配置可变地址，不把所有数字都泛化 |
| 日志统一端口与旧脱敏策略并存 | platform-ports/createPlatformPorts.ts:94、sensitiveData.ts:36–90 | 对照最新日志正本逐边界核对；不为 T1 新造日志系统；本稿不宣布所有脱敏均应删 |
| README/公开API/gate 仍描述旧形态 | contracts 模板示例；部分 package职责摘要 | 和真实定义一次同步；不将 terminal-invariants 变成运行配置 |

逐逻辑盘点应记录每段能力的输入、输出、状态写入、跨包读写、资源生命周期、真实消费者及更合适住址。生成物从生产者修，测试夹具保留合法独立输入；裸字符串数量不直接变成缺陷数量，函数长度不直接变成拆包理由。

建议重点搜索同根族：moduleName/command/actor/slice/part 身份拼接；MASTER/SLAVE、MAIN/BRANCH、PRIMARY/SECONDARY 与机型的不同维度；timeout/retry/limit/interval 单位；同一资源的停止/释放/迟到结果；默认网络配置与实际选择；UI part 与 integration 路由分母。每个族均从定义和两个真实消费者核对，不按词义猜责任。

## 9 · 两份 POC：借鉴组织思想，不继承旧运行机制

参考源在本仓根之外，当前请求明确允许只读分析。后续 build/test/generator 不得读取这些外部文件；无需把 POC 搬成 vendor 或 runtime fallback。

| 参考源 | 可借鉴 | 不能继承 |
|---|---|---|
| _old_/1-kernel/1.2-modules/user-base/src/features/actors/user.ts:27–146、slices/user.ts:10–33 | 具名 actor/slice 文件、owner 自描述 | 全局 store、any、演示登录规则 |
| _old_/1-kernel/1.2-modules/pay-base/src/selectors/selectPaymentRequest.ts:7–20 | 一 selector 一文件 | 跨 owner 直接读 slice |
| newPOSv1/1-kernel/1.1-base/contracts/src/foundations/definition.ts:24–80 | moduleName 派生 error/parameter 身份 | 再造 definition registry/dynamic catalog |
| newPOSv1/1-kernel/1.1-base/ui-runtime-v2/src/supports/errors.ts、parameters.ts | 包内集中声明 | supports 旧目录不是当前规范授权 |
| newPOSv1/1-kernel/1.1-base/runtime-shell-v2/src/supports/moduleDsl.ts:70–94 | 实际定义派生 metadata | 无收益的 DSL wrapper 与两层描述 |
| newPOSv1/1-kernel/1.1-base/ui-runtime-v2/src/selectors/index.ts:22–144 | 作为混写注册/selector 的反例 | 不能称 POC 已全部单文件、完全自闭环 |

两 POC 未找到 `src/declarations/`，本稿目录建议是新的组织选择。当前 Runtime 已具备同步模块注册能力，应从现有实现收口，不照搬旧 runtime-shell。POC 第二 JS 进程、host-runtime、event/effect 旁路及动态参数目录均不恢复。

参考代码本轮由只读分析者定位并计算内容摘要；附件保留代表源定位。没有跑 POC，也没有全量逐行审旧仓。

## 10 · 建议的 T1 交付边界（待讨论）

建议把 T1 定义为一次完整结构整改，而不是只改 actors 文件名：

1. 全包逐逻辑责任审查，确定保留、移动、合并、删除和共享落点。
2. 统一静态 declarations 与具名行为文件；错误/参数分类准确；清理无消费者机制。
3. 包内 Runtime/UI 能力声明自闭环；assembly 不再补 owner 白名单或复制规则。
4. 环境地址从 package.json 到受管入口/配置/transport 采用同一可变集合模型；清除同根 One/Two 模式。
5. 业务事实、协议身份、App 身份、具名策略默认值均有明确正本；重构规范、生成器、结构门、README 和现有测试随实现同步。

验收以真实既有行为保持、owner 接缝正确和维护可定位为准；复用现有 typecheck/test/唯一 automation driver，不为 T1 建语义万能 AST 门或第二份合规控制面。具体动态范围在正式需求与详设中再确定，不在讨论阶段承诺运行 PASS。

## 11 · 本轮问题与 Dexter 裁决

在讨论稿形成后集中询问了以下三项，Dexter 均已回复。下面只记录需求输入；未改规范、正式历史需求或源码。

| 问题 | Dexter 回复原文 | 收敛结果 |
|---|---|---|
| Q-1 是否采用统一 declarations 目录 | 采用 declarations 目录（推荐） | commands/errors/parameters/parts/UI variables 集中声明；actor/slice/selector 仍按具名责任分文件 |
| Q-2 可独立调整的策略默认值如何统一 | 统一静态 ParameterDefinition（推荐） | 使用现有静态参数机制；协议固定值/算法常量保持 owner 常量；不恢复动态 catalog |
| Q-3 是否取消旧需求 1～4 地址限制 | 取消固定数量上限（推荐） | 输入和消费均按实际配置集合；保留当前 DEV 两入口，不增加服务发现或部署节点 |

剩余内容仍是本稿建议，尤其是具体包拆分、统一 module factory 的 API 和 UI 声明的收口形状，尚须通过正式需求/详设明确。无需为这些内部实现选型逐项追问产品；先以现有依赖方向、职责单源和更少机制推导，再让 Dexter 审阅完整方案。

## 12 · 原始需求回读

| 原始方向 | 本稿落点 |
|---|---|
| 1 单 actor/slice/selector 与共享方法 | §3、§7；补充大单 actor 的责任问题 |
| 2 errors 全面盘点 | §4、§7、源码附件；按能力而非文件存在分类 |
| 3 definition/parameters 全面盘点 | §4；区分静态参数与已退役动态 catalog |
| 4 既定机制采用 | §5、§8；不为未用字段补无需求框架 |
| 5 集中声明目录 | §3.3、Q-1；现规范冲突已列明 |
| 6 包自闭环/assembly 简化 | §5；同步全集与业务就绪集合分开 |
| 7 配置数量与环境输入 | §6、Q-3；同根生产者/消费者列明 |
| 8 所有包/逻辑/多真相 | §2.1、§7、§8、源码附件；不冒充每分支已审完 |
| 补充：外部 API 包内声明与使用 | §13；不改变 transport 的 owner 定位，跨包仍只经 command/selector |

本轮结果是需求讨论输入，没有 GO/NO-GO 实施 verdict；不授权 Codex 按本稿动源码。确认讨论输入后，正式需求才能把上述建议变成明确义务。

## 13 · 补充需求：外部 API 的声明与调用归使用包

### 13.1 · Dexter 原话与澄清（逐字记录）

> 还漏了一个很重要的内容我忘了说，你加上去并分析，在old POC工程中，每个包如果需要范围后端的http 或 ws API，这个API是在包内生成和声明的。不是统一生成到transport包中，transport是业务无关的纯toolkit包，而且这个API只能被包内使用，包外是不能访问的。这个用意你能理解么？

随后 Dexter 明确澄清，以下内容限定本次要求的准确边界：

> 可能我的描述不准确，我并不是想修改transport，也不是挑战它的owner角色，我只是希望访问外部的API是在各个包内自己声明使用的，A包不应该能直接调用B包的API，只能通过command和selector

**本项不修改 transport 的 owner 定位，不要求取消其通用传输 command、资源生命周期或既有通信机制。** 作者此前将补充要求扩展为 transport 应改 toolkit 的解读已经撤回，不作为 T1 输入。

### 13.2 · 用意与明确要求

一个包应封装自己的外部依赖：它知道请求哪个后端 operation、怎样构造业务输入、怎样解释业务响应及失败，最终如何更新自己的事实。包外只知道该包公开的业务能力与状态，无需知道其后端路径、wire DTO 或 API client。

因此，B 的外部 API client 是 B 的内部实现，不是 B 的跨包公共业务入口。A 应发 B 的 command，由 B 的 actor 完成请求、校验和状态提交；A 用 B 的 selector 读取其公开事实。直接调用 B 的 API 即使经过了同一个 HTTP adapter，也会绕过 B 的行为边界，造成并发、资格、状态和失败处置由 A 再实现一遍。

需求边界如下：

1. 使用外部 HTTP/WS API 的包，自行声明所需 operation 与契约消费范围，生成物落在该包内部 `src/generated/`；手写的声明/绑定可放在已确认的 `src/declarations/` 中。具体文件命名留给详设，不能另建手写契约真相。
2. API client、请求构造、业务响应解码和内部 wire 类型不从包根作为可调用 API 导出；包外不得通过 deep import 绕过。包的公开业务类型仍可按 command/selector 的需要声明，不等于公开其网络 client。
3. 业务提交和业务读取触发仍通过 command→actor；selector 只读本包状态/派生结果，不在求值时请求网络。
4. transport 保留业务无关的传输能力，接收调用者准备的通用请求/帧；不承担门店、项目、合同、更新规则等业务 API 的目录或响应解释。
5. TDC 仍唯一持有终端凭证、激活行为和 TDP 协议能力；其自身使用的激活/取消及 TDP 协议 API 归 TDC。其他业务包的 API 不因为需要终端认证就全部归 TDC。
6. 公共认证、配置选择、HTTP 完成事件、取消/超时和日志关联应复用现有能力。不得让各包为 API 私有化复制凭证 state、fetch 实现或重连框架。认证与 transport 接线的最小形状在详设中确定，不在本稿另造通用请求引擎。
7. WS 契约归协议/业务消费 owner，不意味着每个包都建立一条连接。TDP 的 topic 订阅、广播与连接仍沿用 TDC；包内 API 声明不能使副机取得 TDS 连接。

### 13.3 · 当前源码的实际偏差与复用依据

当前业务 API 并非生成到 transport，而是集中生成到 TDC：

- `contracts/policy/terminal-client-generation.json` 仅有一个 target，输出为 `apps/terminal/kernel/base/terminal-data-client/src/generated/terminalApi.ts`，包含门店/合同/服务点/项目规则/更新报告/远控等 operations。
- TDC `src/index.ts:57` 使用 `export * from './generated/terminalApi'`，使整份生成 API 成为包根公开面。
- store-basic `src/features/actors/actors.ts:5–24,37–45,110–120` 从 TDC 导入业务 wire/result 类型，并用 `readTerminalDataCommand` 读取门店/合同等业务数据。
- TDC `src/types/client.ts:153–161` 以所有 terminalRead operation 构造统一读取 payload；actor `terminalDataClientActor.ts:1139` 起识别具体 operation，并处理部分业务 path 输入。

按本次补充输入，T1 应拆清“业务 API 契约归属”与“认证/传输机制归属”，不能只把文件搬到 feature，却继续依赖 TDC 的全业务 operation 目录。也不能仅去掉 export 后，改由 composition 将同一份业务 client 注入所有包。

建议的归属：门店/合同/服务点 API 由 store-basic 消费；项目/组织路径和版本规则 API 由 project-basic 消费；更新 grant/报告 API 由 terminal-update 消费；远控登记/报告 API 由 remote-control 消费；激活/取消 API 由 TDC 消费。逐 operation 的实际分配须以当前调用者和 owner 事实核对，不按接口前缀猜责任。

已有 `scripts/generate/terminal-client-api.mjs:164–192,657–681` 支持多个 target 和仓内输出路径校验。优先调整现有生成策略，保留 canonical→generator→package-private client 的单源链；不为每包另写一个生成器，也不复制手写 schema。生成器的现行分配约束、契约覆盖与各包实际消费者必须一起核对。

### 13.4 · POC 参考边界与验收反例

旧 POC 确有包内 endpoint 声明：`_old_/1-kernel/1.2-modules/mixc-user-login/src/supports/http-services.ts:27` 起，以及 `newPOSv1/1-kernel/1.2-business/benefit-session/src/foundations/httpService.ts:36` 起。可借鉴其业务 endpoint 归使用包的组织思想。

但这些样本也曾从包根公开 service：旧 mixc-user-login 的 index 导出 HttpServices，newPOS benefit-session 的 index 导出 createBenefitSessionHttpService。因此不能把旧 POC 的实际代码说成已经完全满足“包外不可访问”，也不能凭这些手写 endpoint 样本宣称全部 API 都由生成器生成。**T1 的私有边界以 Dexter 本轮明确要求为准，旧代码仅作参考。**

正式 T1 至少须确认：B 的 actor 能使用 B 的生成 API；A 不能从 B 的包根或 deep path 取得该 client；A 发 B 的 command 能完成原业务行为，selector 可观察结果；生成代码仍来自唯一 canonical；公共认证/传输只保留一套。无需为此新增跨包 API 代理、全局业务 API registry 或动态服务发现。

本项已纳入 T1 讨论输入，不构成修改 transport 定位、当前在途源码或正式历史需求的授权。
