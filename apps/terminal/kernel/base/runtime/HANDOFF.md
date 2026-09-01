# kernel.base.runtime Unit A HANDOFF

## CP-A0 入口核验

CP-A0 的有限定向核验已完成，`BLOCKING_OPEN=0`。本记录只保存当前源码核验结果；需求与评审文档保持不变。

- contracts：runtime 使用 contracts 的 ID 工厂（尤其 `createRuntimeInstanceId`）、`createAppError`/`isAppError`，以及 `AppModule` 的 `kind`、依赖、commands、actors、slices 描述。`packageVersion` 与 `protocolVersion` 仍为可选。
- platform-ports：`PlatformPorts` 十键均为必填；runtime 将 `logger`、`persistKv`、`persistSecure` 分别映射到 state 的 logger、`plainStorage`、`protectedStorage`。logger 是同步 typed result API；storage 八个方法均为异步 typed result，批量方法不提供 per-key 状态。
- state：`CreateStateRuntimeInput` 的十字段与详设一致。`createStateRuntime` 是异步 factory，hydrate 完成后才暴露 store；runtime 不重复 hydrate。`getStore`/`getState` 返回 Redux 原生根；模块和 actor context 在 store 建成后可读。reset 只能经 `getResetActor().handleResetCommand()`；isolated slice 的入站同步返回 typed `SYNC_NOT_DECLARED`。

## 三包全量重扫

contracts、platform-ports、state 的 fresh 只读重扫均已完成，当前未发现推翻 Unit A 前提的事实。重扫是静态证据，不等价于 typecheck、test、TER-local verify 或 runtime 行为 PASS。

### CP-A0 修复后独立重扫

在 CP-A4 收口前，fresh `reviewerKind=INDEPENDENT_SUBAGENT` 对当前最新字节重新执行了三包全量
只读重扫，结论为 `REVIEW_TARGET=IMPLEMENTATION / SCOPE=CP-A0_THREE_PACKAGE_FULL_RESCAN_AFTER_FIX /
VERDICT=GO / M=0 S=0 N=0`。独立证据正文见
`doc/evidence/platform/2026-09-01-v2s-terminal-runtime-cp-a0-three-package-full-rescan-codex.md`。

重扫同时关闭了前一版发现的 runtime 未声明 RTK 直接 import：runtime `src` 现在全量只 import
contracts/platform-ports/state，RTK 类型通过既有 `types/runtime.ts` 的 root-private state bridge
承接；runtime package.json、skeleton graph 与 root exports 均未漂移。contracts、platform-ports、state
的 CP-A0 目标消费闭包、isolated sync 拒绝、reset actor 与 Unit B 隔离均逐项有当前源码引用。
该证据仍只属于静态/包级证明，不升级为设备、native、DEV、seed/reset、browser L2、UAT、deploy
或 Unit B 行为证明。

## CP-A1 证据

CP-A1 已完成 contracts 公共面收缩、runtime 类型与纯 foundations、runtime package test 与 static checker 闭包。

CP-A1 fresh 独立对账首轮发现 `2M/1S/1N`，已在 CP-A1 范围闭合：

- M-1 `cloneStateJsonValue` 对合法 JSON `__proto__` 键的保真问题：对象克隆改为 null-prototype + `Object.defineProperty`，保留 root 与 nested `__proto__` 为 own enumerable data property，并补测试覆盖字节计算。
- M-2 actor mount 可伪造问题：`onCommand` 产物增加私有 brand 与 command definition identity，actor registry 与 runtime mount 都校验 factory brand 与 definition identity，static red fixture 覆盖删除 brand。
- S-1 类型负夹具不足：`public-surface.typecheck.ts` 补齐 payload brand、字符串 `onCommand`、handler payload mismatch、伪造 handler、跨命令 payload mismatch 等 `@ts-expect-error` 夹具，并由 `tsconfig` 编译 test 目录。
- N-1 graph kind source：当前实现以 `createInternalRuntimeModule.ts` 的真实 owner kind 作为 runtime plannedKind 移除后的 realized kind 来源；不改需求或评审文件。

- contracts public exports：`69`，由 TypeScript checker 直接读取 `apps/terminal/kernel/base/contracts/src/index.ts` 复算。
- runtime public exports：`57`（CP-A1 历史快照；已被文末 Dexter 决策 C 的 `58` 项当前口径取代），由 TypeScript checker 直接读取 `apps/terminal/kernel/base/runtime/src/index.ts` 复算。
- `yarn workspace @catering-v2s/kernel-base-runtime typecheck`：exit 0。
- `yarn workspace @catering-v2s/kernel-base-runtime test`：10 files / 41 tests PASS，打印 `TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-runtime`。
- `node tools/terminal-runtime/check-static.test.mjs`：打印 `RUNTIME_MODEL_CLEANUP=PASS` 与 `TERMINAL_RUNTIME_STATIC_MODEL_TEST=PASS`。
- `node tools/terminal-runtime/check-static.mjs`：`RUNTIME_RULE_GATES=4`、`RUNTIME_SUPPORT_CHECKS=1`、四道规则与 public support 全部 PASS，打印 `TERMINAL_RUNTIME_STATIC=PASS`。
- `node tools/terminal-skeleton/check-static.mjs`：六道 skeleton 规则与 scaffold hygiene 全部 PASS。

### CP-A1 修复后独立复核

CP-A1 的 fresh 独立三维复核（对照需求、详设、项目规范与当前源码）结论为
`REVIEW_TARGET=IMPLEMENTATION / SCOPE=CP-A1 / VERDICT=GO / M=0 S=0 N=0`。

- contracts exact export 的疑问经当前 TypeScript checker 与手写 expected 清单复算为 `69/69`，并由 `node tools/terminal-contracts/check-static.mjs` 的 `TERMINAL_CONTRACTS_STATIC=PASS` 复证；不存在 68/69 漂移。
- `RuntimeModule.roleChangeEffects` 是模块声明级受控 seam；`createRuntime` 在构造 internal runtime module 前按输入模块顺序收集并注入，后续 Unit B 可注册清旧 ledger effect 而无需修改 A 的角色 actor。
- `ActorExecutionRecord` 与 `CommandExecutionObservation` 的正常、peer、gateway-missing、depth 与异常降级记录均由 lifecycle emitter 内部构造/推进；dispatcher 不再拥有 record 或 observation fallback 对象构造。
- 修复后的 focused proof：runtime/contracts typecheck 均 exit 0；runtime 10 files / 41 tests PASS；runtime static、contracts static、skeleton static 及各自 model test 全部 PASS。
- 该复核仍不证明 DEV、设备、Gradle、native、浏览器 L2、UAT 或部署；runtime 包 README 与最终 CP-A4 收口仍未完成。

## CP-A2 证据（模块装配与命令挂载）

CP-A2 已完成当前详设要求的模块装配、命令声明与内部模块挂载收敛；本段只记录已执行的
focused proof，不把它提前表述为独立三维复核结论。

- `AppModule.commands[].name` 按 owning module 的完整命令名保存并对拍（例如
  `kernel.base.runtime.initialize`），不再在 runtime、manifest 或测试夹具中把裸名重新拼前缀。
- `validateModuleShape` 直接以 `command.name` 查找 `CommandDefinition.commandName`；
  `describeRuntimeModule` 直接导出完整 command name；内部 runtime module 的两个命令也以完整名声明。
- CP-A1 的 role-change effect seam、四阶段生命周期、模块拓扑排序与门面/context 的分域
  `getState` 形态保持不变；CP-A2 没有新增公开导出、依赖出边或 Unit B 实现。
- focused proof：
  - `yarn workspace @catering-v2s/kernel-base-runtime typecheck`：exit 0；
  - `yarn workspace @catering-v2s/kernel-base-runtime test`：10 files / 41 tests PASS，
    `TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-runtime`；
  - `node tools/terminal-runtime/check-static.test.mjs`：
    `RUNTIME_MODEL_CLEANUP=PASS`、`TERMINAL_RUNTIME_STATIC_MODEL_TEST=PASS`；
  - `node tools/terminal-runtime/check-static.mjs`：`RUNTIME_RULE_GATES=4`、
    `RUNTIME_SUPPORT_CHECKS=1`、四道规则与 public support 全部 PASS，
    `TERMINAL_RUNTIME_STATIC=PASS`；
  - `node tools/terminal-skeleton/check-static.test.mjs` 与 `check-static.mjs`：
    skeleton model、六道规则与 scaffold hygiene 全部 PASS。
- module-system focused test 新增了完整命令名描述断言及裸命令描述拒绝断言；其余既有
  lifecycle、role、visibility、dispatch、peer、reset 与 actor-result 测试均保持在 41 条分母内。

CP-A2 的 fresh 独立三维复核正在进行；在取得其结论前，不将本段 focused proof 记为 CP-A2
完成或 GO。需求、评审文件与仓级 normal verify 语义均未修改。

### CP-A2 fresh 独立三维复核

CP-A2 的 fresh 独立三维复核结论为 `REVIEW_TARGET=IMPLEMENTATION / SCOPE=CP-A2 /
VERDICT=GO / M=0 S=0 N=0`。复核者只读重开当前源码、冻结详设、需求与项目规范，
未运行仓级 normal verify、未实现 Unit B，也未采信本 HANDOFF 自述。

- 复核确认 owning `AppModule.commands[].name`、`CommandDefinition.commandName`、
  internal runtime module 与 `describeRuntimeModule` 均使用完整命令名，裸名声明会被拒绝。
- 复核确认模块拓扑与四阶段启动顺序、created/starting 门面状态边界、模块/actor context
  的 store 直连、owner kind 及 graph plannedKind 移除均与详设一致。
- 复核确认 role slice 的 isolated + owner-only 持久化、role effect 先于字段写入，
  并确认不会新增公开导出、出边或 Unit B 实现。
- 复核复跑并确认 runtime typecheck、41 条测试、runtime model/static、skeleton
  model/static 与 `tools/terminal-skeleton/verify-static.mjs` 均通过；其余未证明边界
  仍保持原有声明。

## CP-A3 证据（dispatcher、peer、事实点与 reset）

CP-A3 的 focused proof 已完成。当前源码逐项满足详设中 dispatcher、peer gateway、
生命周期 emitter、timeout、journal 与 reset 的实现形态；本段不把静态结构扫描升级为
“唯一事实点已被机器证明”。

- `createCommandDispatcher` 将本地 actor 以 `Promise.all` 并行执行、按声明顺序收集结果，
  peer 通过已安装 gateway 携带 request/command/parent/route 上下文；gateway 缺失、
  peer 失败和 timeout 均返回 typed actor record。
- actor 与 peer timeout 只收敛当前 dispatch 的 typed 终态并清理本次 timer，未取消
  handler 或其已发出的 port/dispatch 副作用；迟到完成/错误经 emitter 追加 late journal event。
- `createLifecycleEmitter` 是 `ActorExecutionRecord` 与 `CommandExecutionObservation`
  的唯一生产函数所在模块；dispatcher 只消费 emitter 结果，三条合法路径（local actor、
  peer、gateway-missing）均经同一入口；journal 与 observer 失败只写降级日志，不向
  dispatch 边界抛出。
- reset 请求只由 actor context 排队至 root command，runtime reset 顺序为持久层 reset、
  state 重建、initialize；重复 reason 与 reset 期间请求分别生成 ignored journal 事件。
- focused proof：
  - `/Users/dexter/Documents/workspace/idea/catering-v2s/node_modules/.bin/vitest run`
    （cwd=`apps/terminal/kernel/base/runtime`，仅 `dispatch.test.ts`、`actorResult.test.ts`、
    `peerGateway.test.ts`、`lifecycle.test.ts`、`reset.test.ts`）：5 files / 18 tests PASS；
  - `yarn workspace @catering-v2s/kernel-base-runtime typecheck`：exit 0；
  - `yarn workspace @catering-v2s/kernel-base-runtime test`：10 files / 41 tests PASS，
    `TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-runtime`；
  - `node tools/terminal-runtime/check-static.test.mjs`：
    `RUNTIME_MODEL_CLEANUP=PASS`、`TERMINAL_RUNTIME_STATIC_MODEL_TEST=PASS`；
  - `node tools/terminal-runtime/check-static.mjs`：4 rule gates + 1 support 全部 PASS，
    `TERMINAL_RUNTIME_STATIC=PASS`。
- 一次错误的 focused 命令 `yarn workspace ... test --run <paths>` 被 Yarn 当作未知
  workspace script 参数而退出；随后以 package-local Vitest 直接指定五个测试文件复跑成功。
  该命令形态错误不改变源码或测试结果，作为首败记录保留。

### CP-A3 fresh 独立三维复核

CP-A3 首轮 fresh 复核发现的角色 lifecycle journal、peer timeout late event 与 TR-10 README
三项问题已逐一修复并重新取得独立结论：`REVIEW_TARGET=IMPLEMENTATION / SCOPE=CP-A3 /
VERDICT=GO / M=0 S=0 N=0`。复核者重新读取当前源码、需求、详设与项目规范，并确认：

- local actor、gateway-missing 与 installed peer 三条路径均经同一 lifecycle emitter；
  actor 并行结果顺序、peer 上下文继承、本地 timeout 的 late completion/error journal 均有
  当前源码与测试支撑；
- role actor 的 requested/changed 两跳现在由 dispatcher 通过同一 emitter 产出，测试已断言
  `previousMode/nextMode/commandName`；
- peer 在本地 timeout 后会观察最终 settlement 并追加 `actor.late-completed` 或
  `actor.late-error`，不改写已终结的 timed-out record；
- reset 仍为 actor-only、root completion 后执行，顺序为 state reset → hooks → initialize，
  重复 reason 与 reset 期间请求保留 ignored journal 事件；
- 中文 `README.md` 已补齐 TR-10 定位/作用/结构/用法/迭代边界与 A/B、timeout、reset、
  routeContext、角色审计欠账，未引入 Unit B；
- runtime typecheck、41 条测试、CP-A3 focused 22 条测试、runtime static/model 均通过。

该复核仍明确未证明设备、native/Gradle、DEV、seed/reset 运行环境、浏览器 L2、UAT、部署或
Unit B request ledger；A 期 peer running 观察仍按详设人工源码审查边界处理。需求、评审文件与
仓级 normal verify 语义均未修改。

## CP-A4 证据（TER-local 验收与工具接线）

CP-A4 已完成。TER-local 的测试 owner 固定为 9 个：contracts、platform-ports、state、runtime
四个 `REAL_TESTS` owner，加上五个 adapter 的 `NO_TEST` owner；marker 对账为
`REAL=4`、`NO_TEST=5`，不得用缺少测试文件冒充通过。

- `node tools/terminal-skeleton/verify.test.mjs`：exit 0，打印
  `TERMINAL_VERIFY_MARKER_MODEL_TEST=PASS`。
- `node tools/terminal-skeleton/verify-static.mjs`：exit 0；skeleton 六道规则与
  scaffold hygiene、contracts/platform-ports/state/runtime 各自 model/static 全部 PASS，
  最终打印 `TERMINAL_STATIC=PASS`。
- `yarn workspace @catering-v2s/terminal verify:static`：exit 0，复用同一静态闭包并打印
  `TERMINAL_STATIC=PASS`。
- `yarn workspace @catering-v2s/terminal verify`：exit 0。Turbo dry-run 为
  `typecheck=22`、`test=9`、`lint=0`、`clean=0`；22/22 typecheck、9/9 test 成功；
  marker 对账打印 `TERMINAL_TEST_MARKERS=PASS real=4 noTests=5`；assembly 的 Expo export
  输出 `Android Bundled ... (701 modules)`、`Exported: dist`，随后打印
  `TERMINAL_VERIFY_CLEANUP=PASS` 与 `TERMINAL_VERIFY=PASS`。
- `tools/terminal-skeleton/verify.mjs` 的 test marker 分母已固定为 9，REAL 分母固定为 4，
  并保留正向/反向 fixture：缺 runtime 或多余 owner 命中 `package mismatch`，错误 kind
  命中对应 owner 的定向错误；`verify.test.mjs` 原有单 marker 的 count-mismatch fixture
  内容保持不变。
- `verify-static.mjs` 已接入 runtime model/static 两项；runtime README 已按 TR-10 补齐
  定位、结构、用法、生命周期、失败与恢复、Unit A/B 边界及迭代约束。

这些输出只证明 TER-local 静态门、跨包 typecheck、真实测试 owner、Metro/Expo JS export
与 cleanup；不证明 native、Gradle、设备、autolinking、DEV、seed、reset 运行环境、浏览器
L2、UAT、部署或 Unit B。仓级 normal `scripts/verify` 语义未修改且未运行。

## CP-A4 修复：actor 所属模块边界

最终全范围复核发现一条真实的注册边界缺口：`RuntimeModule.actorDefinitions` 原先可以携带
`moduleName` 与承载模块不同的 `ActorDefinition`，导致 actor registry 与 module descriptor
使用 actor 自报身份，存在伪造 `kernel.base.runtime.peer-dispatch` 合成身份的路径。

按最小修复收敛：

- `createRuntime` 的 `validateActorMounts` 在 brand 校验后拒绝
  `actor.moduleName !== module.moduleName`；
- `createActorRegistry` 的内部模块形状显式带 `moduleName`，在直接 registry 入口重复执行同一
  ownership 校验，避免绕过 `createRuntime`；
- `moduleSystem.test.ts` 增加承载模块不一致的负例；同时增加“subscriber 模块的 actor 处理
  owner 模块的 command definition”正例，保留跨模块命令订阅语义，不把 command owner 与 actor
  carrier 混为一谈。

修复后 focused proof：runtime typecheck exit 0；10 个测试文件、41 条测试 PASS；
`RUNTIME_RULE_*` 四门与 support、`TERMINAL_RUNTIME_STATIC`、`TERMINAL_STATIC`、
`TERMINAL_VERIFY_MARKER_MODEL_TEST` 均 PASS。

## 最终全范围三维对账

`REVIEW_TARGET=IMPLEMENTATION`  
`SCOPE=TER_RUNTIME_UNIT_A_POSTFIX`  
`reviewerKind=INDEPENDENT_SUBAGENT`  
`VERDICT=GO`  
`M/S/N=0/0/0`

fresh 独立 verifier 重新打开需求、详设、项目规范、当前源码与新鲜输出，确认：

- actor ownership 在 `createRuntime` 与 `createActorRegistry` 两条入口都 fail-closed；
- 模块 B 的 actor 仍可挂载模块 A 的 `CommandDefinition`，合法跨模块订阅未被误杀；
- runtime 公开面与 Unit B 边界未漂移，未提前实现 request ledger、selector 或同步账本；
- `contracts=69`、`runtime=57`（最终全范围对账时的历史快照；已被文末 Dexter 决策 C 的 `58` 项当前口径取代），runtime 10 files/41 tests，TER owner 为 9、REAL 为 4、
  NO_TEST 为 5；
- `yarn workspace @catering-v2s/terminal verify` 新鲜 exit 0，22/22 typecheck、9/9 test、
  `TERMINAL_TEST_MARKERS=PASS real=4 noTests=5`、assembly Expo export 701 modules、
  `TERMINAL_VERIFY_CLEANUP=PASS`、`TERMINAL_VERIFY=PASS`；
- 未发现“所有门绿但 Unit A 未建成”的新路径。

本次最终对账没有修改需求正本、评审文件、仓级 normal verify 语义或项目记忆；没有运行仓级
normal verify、Unit B、native/Gradle/设备、DEV、seed/reset、浏览器 L2、UAT 或部署。

## 欠账与边界

- A 只实现 runtime 骨架与本单元约定；不得开始 Unit B 的 request ledger、selector 聚合或协议补全。
- `internal` 是命令语义，不是 caller 权限；角色变更的业务留痕只在内存 journal，**不能跨重启保留**。
- actor timeout 不取消 handler 或其 port/dispatch 副作用；迟到结果只追加 late journal event。
- routeContext 在 A 中只作为进程内 opaque 值搬运；wire 形状与入站解码由 transport 负责。
- state 的 `getSlices` 返回 opaque registrations；runtime 保留自己的 module descriptor，不从 state 反推 persistence/sync 语义。
- role slice 使用 isolated + owner-only persistence；后续若需要跨节点 role 同步或跨重启业务审计，必须由后续 owner 另行设计。
- static/typecheck/export 只能证明相应范围，不能升级为 native、Gradle、设备、DEV、seed、reset、浏览器 L2、UAT 或部署证明。

## Post-review remediation (当前字节)

实施 review 指出的 M-1、S-1 至 S-6 与 N-1 至 N-6 已在本包范围内逐项修复；本节是
修复后的当前状态，不改写上面的历史 CP 记录：

- lifecycle emitter 增加 `releaseCommand`，dispatcher 在命令终结（含 reset 失败路径）时释放
  observation 与 actor record；迟到完成/失败保持 standalone journal 事件，不回写已释放记录。
- actor context 与 module context 的 `subscribeState` 都登记到 test resource registry，显式取消
  仍可用且 `releaseRuntimeForTest` 会统一释放；本包不新增生产 shutdown API。
- 通用 dispatcher 不再 import role feature/selector；role actor 通过内部 signal seam 产出
  `role.change-requested`/`role.changed`，不重复读取角色 slice。
- fallback 聚合复用 `aggregateCommandStatus`；深度拒绝使用固定
  `kernel.base.runtime.depth-rejected`；emitter error projection 在闭包内读取 `sessionId`。
- `RuntimeRoleChangeEffect` 与 `RegisteredCommandDefinition` 各自只有一个内部正本；本轮当时未新增
  runtime root export，公开面为 57。该历史状态已被文末 Dexter 决策 C 取代：现在只公开
  `RuntimeRoleChangeEffect`，`RuntimeRoleChangeSignal` 仍保持内部，公开面为 58。
- 缺失角色 slice 的 selector fail closed；slice 名只由
  `runtimeInstanceModeSliceName` 定义；command declaration 与 commandDefinitions 做双向闭合校验。
- command.completed 在异常的 unresolved/running 状态下保留 observed `running`，不伪造 `error`；
  actor/peer timer 使用同步初始化的 definite assignment，移除不可达的 undefined 分支。

新增回归覆盖：emitter release 与 late journal、固定 depth actorKey、actor/module subscription
释放、缺失 role slice、缺失 command definition、reset 失败后的 root chain 清理，以及 unresolved
command completion 的 journal 状态。当前 runtime 测试为 10 files / 49 tests。

修复后新鲜 focused proof：

- `yarn workspace @catering-v2s/kernel-base-runtime typecheck`：exit 0；
- `yarn workspace @catering-v2s/kernel-base-runtime test`：10 files / 49 tests PASS，打印
  `TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-runtime`；
- `node tools/terminal-runtime/check-static.test.mjs`：
  `RUNTIME_MODEL_CLEANUP=PASS`、`TERMINAL_RUNTIME_STATIC_MODEL_TEST=PASS`；
- `node tools/terminal-runtime/check-static.mjs`：4 rule gates + 1 support 全部 PASS，
  `TERMINAL_RUNTIME_STATIC=PASS`；
- `node tools/terminal-contracts/check-static.mjs`：contracts 69 exact，
  `TERMINAL_CONTRACTS_STATIC=PASS`；
- `yarn workspace @catering-v2s/terminal verify:static`：TER 全部静态门 PASS，
  `TERMINAL_STATIC=PASS`；
- `yarn workspace @catering-v2s/terminal verify`：22/22 typecheck、9/9 test，
  `TERMINAL_TEST_MARKERS=PASS real=4 noTests=5`，assembly Expo export 701 modules，
  `TERMINAL_VERIFY_CLEANUP=PASS`、`TERMINAL_VERIFY=PASS`。

这些输出只证明本包与 TER-local 的静态、类型、测试、marker 和 Metro/Expo JS export 边界；
不证明 native、Gradle、autolinking、设备、DEV、seed、reset 运行环境、浏览器 L2、UAT、部署或
Unit B。历史 CP 段落中的 41 tests 是修复前快照，当前收口数字以本节 49 tests 为准。

## Post-review follow-up (当前字节)

复核后的再次回读发现三条迟到/诊断边界，均已在既有 runtime 范围内闭合：

- role actor 超时后，`activeRoleContexts` 已释放时仍由 actor 携带的固定内部命令身份重建
  `LifecycleCommandContext`，`role.changed` 继续作为 standalone journal event 写入，不丢迟到事实。
- command chain 已释放后才到达的 actor `requestApplicationReset` 直接忽略，不创建无人消费的
  `pendingResetByRoot`；新增测试证明随后命令不会误触发 reset。
- lifecycle 诊断失败路径使用 platform-ports logger 的 `withContext` 派生命令上下文，动态读取
  `sessionId` 并保留 command/node 关联；dispatcher 合成 AppError 同步带 sessionId。

新增回归：late role transition、late reset orphan、logger command context；runtime 当前为
10 个测试文件、51 条测试。最新 focused proof：`yarn workspace @catering-v2s/kernel-base-runtime
typecheck` 与 `test` 均 exit 0；后续 TER-local static/verify 将以本节 51 tests 和最新源码重跑。
这些修复在该历史节点不改变 runtime 公开面（57；已被文末 Dexter 决策 C 的 58 项当前口径取代）、contracts 公开面（69）、Unit B 边界或仓级 normal verify
语义；仍不证明 native、Gradle、设备、DEV、seed/reset 运行环境、浏览器 L2、UAT 或部署。

## Post-review verification (最新新鲜输出)

针对上述 follow-up 修补重新运行并读取了当前输出：

- `yarn workspace @catering-v2s/kernel-base-runtime typecheck`：exit 0。
- `yarn workspace @catering-v2s/kernel-base-runtime test`：exit 0；10 个测试文件、51 条测试
  全部 PASS，打印 `TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-runtime`。
- `node tools/terminal-runtime/check-static.test.mjs`：exit 0，打印
  `RUNTIME_MODEL_CLEANUP=PASS`、`TERMINAL_RUNTIME_STATIC_MODEL_TEST=PASS`。
- `node tools/terminal-runtime/check-static.mjs`：exit 0；`RUNTIME_RULE_GATES=4`、
  `RUNTIME_SUPPORT_CHECKS=1`，context/mount/owner/restart/export 全部 PASS，打印
  `TERMINAL_RUNTIME_STATIC=PASS`。
- `yarn workspace @catering-v2s/terminal verify:static`：exit 0，TER 全部静态/模型门 PASS，
  打印 `TERMINAL_STATIC=PASS`。
- `yarn workspace @catering-v2s/terminal verify`：exit 0；Turbo `typecheck=22/22`、
  `test=9/9`，marker `TERMINAL_TEST_MARKERS=PASS real=4 noTests=5`；assembly Metro
  `Android Bundled ... (701 modules)`、`Exported: dist`，随后打印
  `TERMINAL_VERIFY_CLEANUP=PASS`、`TERMINAL_VERIFY=PASS`。

本轮没有运行仓级 normal `scripts/verify`，也没有运行 native/Gradle/设备、DEV、seed、reset
环境、浏览器 L2、UAT 或部署。TER-local 绿只证明当前静态、类型、测试、marker 与 JS export
闭包；不升级为 native、设备或 Unit B 证明。

## Post-review final verification (2026-08-31 21:42 KST)

在补充 reset late-arrival 诊断上下文后，按当前字节重新执行：

- `yarn workspace @catering-v2s/kernel-base-runtime typecheck`：exit 0。
- `yarn workspace @catering-v2s/kernel-base-runtime test`：exit 0；10 个测试文件、51 条测试
  全部 PASS，打印 `TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-runtime`。
- `node tools/terminal-runtime/check-static.test.mjs`：exit 0，
  `RUNTIME_MODEL_CLEANUP=PASS`、`TERMINAL_RUNTIME_STATIC_MODEL_TEST=PASS`。
- `node tools/terminal-runtime/check-static.mjs`：exit 0；4 个 rule gate 与 1 个 support
  全部 PASS，打印 `TERMINAL_RUNTIME_STATIC=PASS`。
- `yarn workspace @catering-v2s/terminal verify`：exit 0；22/22 typecheck、9/9 test，
  `TERMINAL_TEST_MARKERS=PASS real=4 noTests=5`，assembly Metro `Android Bundled ... (701 modules)`，
  `Exported: dist`，随后 `TERMINAL_VERIFY_CLEANUP=PASS`、`TERMINAL_VERIFY=PASS`。

本次只更新运行时命令级 logger 的 late-reset 诊断路径，不改变公开面、Unit B 边界或仓级
normal verify 语义。上述输出仍不证明 native、Gradle、autolinking、设备、DEV、seed/reset
运行环境、浏览器 L2、UAT 或部署。

## Post-review round-2 remediation (2026-08-31)

第二轮 IMPLEMENTATION review 的 M-2 已闭合：`setRuntimeInstanceModeActor` 在读取 payload 后
先通过内部 `isRuntimeInstanceMode` 校验 `MASTER | SLAVE` 闭集；非法字符串在任何
`role.change-requested`、role effect 或 `dispatchAction` 之前抛出，dispatcher 将其归一化为
`error`。reducer 仍保留同一 type guard 作为深度防御，但不再承担唯一校验职责。

新增回归用例验证字符串命令名入口传入非法 `instanceMode` 时：命令状态为 `error`、角色仍为
`MASTER`、effects 调用次数为 0，且 journal 没有 `role.change-requested` 或 `role.changed`。
N-6 的声明→definition 反向校验保持在 `createRuntime.validateModuleShape`，已有反向缺失
definition 用例继续覆盖。

S-7 在本历史节点未擅自扩展公开面：`RuntimeRoleChangeEffect` 与 `RuntimeRoleChangeSignal` 当时均为
runtime 内部类型，root exports 为 57，等待 Dexter 裁决。该裁决现已作出并由文末决策 C 收口：
只把 `RuntimeRoleChangeEffect` 加入 root exports，`RuntimeRoleChangeSignal` 继续保持内部，公开面为 58。

本轮新鲜验证：

- `yarn workspace @catering-v2s/kernel-base-runtime typecheck`：exit 0。
- `yarn workspace @catering-v2s/kernel-base-runtime test`：exit 0；10 个测试文件、52 条测试
  全部 PASS，打印 `TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-runtime`。
- `node tools/terminal-runtime/check-static.test.mjs`：exit 0，
  `RUNTIME_MODEL_CLEANUP=PASS`、`TERMINAL_RUNTIME_STATIC_MODEL_TEST=PASS`。
- `node tools/terminal-runtime/check-static.mjs`：exit 0；4 个 rule gate 与 1 个 support
  全部 PASS，打印 `TERMINAL_RUNTIME_STATIC=PASS`。
- `node tools/terminal-contracts/check-static.mjs`：exit 0；4 个 rule gate 与 1 个 support
  全部 PASS，打印 `TERMINAL_CONTRACTS_STATIC=PASS`，contracts 公开面仍为 69。
- `yarn workspace @catering-v2s/terminal verify:static`：exit 0，打印 `TERMINAL_STATIC=PASS`。
- `yarn workspace @catering-v2s/terminal verify`：exit 0；22/22 typecheck、9/9 test，
  `TERMINAL_TEST_MARKERS=PASS real=4 noTests=5`；assembly Metro `Android Bundled ... (702 modules)`、
  `Exported: dist`，随后 `TERMINAL_VERIFY_CLEANUP=PASS`、`TERMINAL_VERIFY=PASS`。

本轮仍未运行仓级 normal verify、Unit B、native/Gradle/设备、DEV、seed/reset 运行环境、浏览器
L2、UAT 或部署；702 modules 与此前 701 的差异只记录为当前最新 bundle 计数，不改变证明边界。

## Post-review notes N-7/N-8 (2026-08-31)

N-7 已在类型层闭合：`RuntimeModule.commandDefinitions` 现在保留
`commandDefinitionBrand` 私有 brand（brand 值不进入 runtime root export），因此手写的未注册
definition 在 `RuntimeModule` 类型检查阶段即被拒绝；`public-surface.typecheck.ts` 的负夹具覆盖了
缺少该 brand 的对象。运行期 `validateModuleShape` 仍保留 brand 检查，作为第二道防线。

N-8 已在内部信号层闭合：`RuntimeRoleChangeSignal` 携带受约束的
`visibility: 'internal'` 与 `allowNoActor: false`，迟到 signal 的 fallback lifecycle context
直接使用 signal 字段，不再在 dispatcher 中重复硬编码。`RuntimeRoleChangeSignal` 当前仍是 runtime
内部类型；文末 Dexter 决策 C 仅公开 `RuntimeRoleChangeEffect`，因此当前 root exports 为 58。

本轮 N-7/N-8 focused proof：runtime typecheck exit 0；runtime test 10 files/52 tests PASS。
随后 runtime model/static、contracts static、`verify:static` 与 `verify` 均 exit 0；TER verify
报告 22/22 typecheck、9/9 test、`TERMINAL_TEST_MARKERS=PASS real=4 noTests=5`、assembly
Metro 702 modules、`TERMINAL_VERIFY_CLEANUP=PASS` 与 `TERMINAL_VERIFY=PASS`。
这些证据不扩张到 Unit B、native、Gradle、设备、仓级 normal verify 或其他未授权边界。

## Post-review round-3 dynamic verification (2026-08-31)

针对第三轮静态 IMPLEMENTATION review 要求的当前字节复跑，未修改需求、评审文件或仓级
`scripts/verify` 语义：

- `yarn workspace @catering-v2s/kernel-base-runtime typecheck`：exit 0；
- `yarn workspace @catering-v2s/kernel-base-runtime test`：exit 0；10 个测试文件、52 条测试
  全部 PASS，打印 `TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-runtime`；
- `node tools/terminal-runtime/check-static.test.mjs`：exit 0，打印
  `RUNTIME_MODEL_CLEANUP=PASS`、`TERMINAL_RUNTIME_STATIC_MODEL_TEST=PASS`；
- `node tools/terminal-runtime/check-static.mjs`：exit 0；4 个 rule gate 与 1 个 support
  全部 PASS，打印 `TERMINAL_RUNTIME_STATIC=PASS`；
- `node tools/terminal-contracts/check-static.mjs`：exit 0；4 个 rule gate 与 1 个 support
  全部 PASS，打印 `TERMINAL_CONTRACTS_STATIC=PASS`，contracts 公开面为 69；
- `yarn workspace @catering-v2s/terminal verify:static`：exit 0，打印 `TERMINAL_STATIC=PASS`；
- `yarn workspace @catering-v2s/terminal verify`：exit 0；22/22 typecheck、9/9 test，
  `TERMINAL_TEST_MARKERS=PASS real=4 noTests=5`，assembly Metro `Android Bundled ... (702 modules)`、
  `Exported: dist`，随后 `TERMINAL_VERIFY_CLEANUP=PASS` 与 `TERMINAL_VERIFY=PASS`。

本轮没有运行仓级 normal `scripts/verify`，也没有运行 Unit B、native/Gradle、设备、DEV、seed/reset
运行环境、浏览器 L2、UAT 或部署。上述通过只证明 TER-local 静态、类型、测试、marker 与 JS export
闭包；不升级为 native、设备、adapter 能力或跨重启证明。该段记录的是决策 C 前的历史状态；
S-7 已由 Dexter 决策 C 收口，不再是未决项，当前口径见下节。

## Dexter 决策 C 收口（当前唯一有效口径，2026-08-31）

Dexter 已裁定单元 B 可以直接命名角色切换 effect，但不得公开仅供 runtime 内部生命周期搬运的
signal。当前有效状态如下；上文所有 `57`、`S-7` 或“effect 仍为内部类型”的表述仅保留为发生时的
历史证据，均不得再作为实施输入：

- `RuntimeRoleChangeEffect` 从 `src/types/module.ts` 由 runtime root `src/index.ts` 正式导出；
- `RuntimeRoleChangeSignal` 继续保持包内私有，不进入 root exports；
- runtime public exports 的当前精确分母为 `58`，contracts public exports 仍为 `69`；
- static checker 的手写 `expectedPublicExports`、Unit A 详设 §4.1/§7.2/§9.1/§11/§14 与中文
  README 已同步到同一口径；
- Unit B 只能通过公开的 `RuntimeRoleChangeEffect` 注册“先清理旧角色拥有的 ledger、再写角色字段”
  的 effect，不得反向依赖或导出 `RuntimeRoleChangeSignal`。

本次决策 C 后的新鲜 focused proof：

- runtime 与 contracts AST 公开面复算分别为 `58/58` 与 `69/69`；
- `yarn workspace @catering-v2s/kernel-base-runtime typecheck`：exit 0；
- `yarn workspace @catering-v2s/kernel-base-runtime test`：10 个测试文件、52 条测试 PASS；
- runtime static 真实树、五个定向 red mutation model、contracts static 与 TER `verify:static` 全绿；
- TER-local `verify`：22/22 typecheck、9/9 test、`real=4 noTests=5`、Metro 702 modules，
  `TERMINAL_VERIFY_CLEANUP=PASS`、`TERMINAL_VERIFY=PASS`。

证明边界不变：这些结果不证明 Unit B、native、Gradle、autolinking、设备、DEV、seed/reset 运行环境、
浏览器 L2、UAT 或部署；仓级 normal `scripts/verify` 未运行，语义也未修改。

## Unit B implementation handoff（2026-09-01）

Unit B 已按冻结详设依次完成 CP-B0 至 CP-B4：CP-B0 回填 contracts、platform-ports、state 的真实消费
签名；CP-B1 收口 contracts 的 optional closed-union 门与反向夹具；CP-B2 建立 MASTER/SLAVE 两个
`persistIntent: 'never'` request-ledger slice、合并 selector 与 request budget；CP-B3 把唯一 lifecycle
observation 写入点、ledger write failure actor error 降级、role effect 与全量 sync test seam 接入真实 runtime；
CP-B4 增加内部 cleanup command/actor、按 retention/max-residence 的逐键淘汰、角色翻转清理、timer 及
跨 runtime 的 ledger 非持久化回归。

CP-B4 focused proof（当前字节）如下：

- `yarn --cwd apps/terminal/kernel/base/runtime typecheck`：exit 0；
- `yarn --cwd apps/terminal/kernel/base/runtime test`：13 files / 76 tests PASS，并打印
  `TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-runtime`；
- `node tools/terminal-runtime/check-static.test.mjs`：`RUNTIME_MODEL_CLEANUP=PASS`、
  `TERMINAL_RUNTIME_STATIC_MODEL_TEST=PASS`；
- `node tools/terminal-runtime/check-static.mjs`：5 个 rule gate、1 个 support 全部 PASS，
  `TERMINAL_RUNTIME_STATIC=PASS`。

已覆盖的 Unit B 行为包括：本机/镜像/双侧 selector 与单侧状态裁定、合并 command budget、ledger 写入失败
的日志与 actor error 降级、role flip 先清旧 half 再写角色、effect 失败不改角色、cleanup 只删当前
写权一侧、terminal/retention/max-residence 规则、peer running 保留、peer 时钟偏差窗口、timer 注册
与 disposer、跨 runtime 重启后 ledger 不恢复。request ledger 不落盘，不建立 dedicated request wire、
接收方账本、latest-wins、逻辑时钟或 Unit C transport；跨机同步仍由 state/topology 的全量 sync 负责。

当前未证明或明确不在授权范围内的边界：state 的真实生产跨机 transport、Unit C、5 个 adapter 的 native
能力、Gradle/autolinking/设备、DEV、seed、reset 运行环境、浏览器 L2、UAT、部署与仓级 normal verify。
`UNVERIFIED_REQUIRES_EVIDENCE`：`state.applyAuthoritativeSync` 当前尚不校验 sync direction；runtime
自己的写路径遵守单写者，但 state 同步层是否强制单写者仍未被证明，不得将本包的单写者实现升级为
跨包同步层证明。
角色切换 journal 只在内存，不能跨重启；request ledger 的事实也不跨重启保留。若后续要改变任何一项，
必须先更新 owning design/requirements，并重新核对 role ownership、sync direction、retention 与 public
surface；不得把当前 TER-local 绿灯升级成上述边界的证明。

### Unit B final dynamic verification（2026-09-01）

全范围三维对账 `RECONCILIATION=MATCHED / OPEN_COUNT=0` 后，按当前字节复跑授权内闭包：runtime
typecheck exit 0；runtime 13 files / 76 tests PASS；runtime model/static 5 rule gates + support PASS；
contracts 与 platform-ports typecheck、model/static 均 PASS；TER `verify:static` 的 6 gates + support
PASS。TER-local `verify` 结果为 Turbo typecheck 22/22、test 9/9，
`TERMINAL_TEST_MARKERS=PASS real=4 noTests=5`，assembly Metro `Android Bundled ... (710 modules)`、
`Exported: dist`，随后 `TERMINAL_VERIFY_CLEANUP=PASS` 与 `TERMINAL_VERIFY=PASS`，exit 0。

本轮未运行仓级 normal `scripts/verify`，也未运行 native/Gradle/设备、DEV、seed、reset 运行环境、
浏览器 L2、UAT 或部署。`state.applyAuthoritativeSync` 的 sync direction 校验仍为
`UNVERIFIED_REQUIRES_EVIDENCE`；TER-local 绿灯不升级为跨包同步、native、设备或跨重启证明。

### Unit B post-implementation-review remediation（2026-09-01，当前有效）

Claude implementation review 的 1M/1S/2N 已闭合。以下内容取代上方历史段落中与当前行为冲突的
ledger failure 表述：`writeLedgerTransition` 将底层 store failure 投影为
`kernel.base.runtime.ledger_write_failed`；actor running/terminal 写账失败由
`emitActorRunning`/`emitActorTerminal` 收敛为该 actor 的 error record，命令仍返回聚合结果并保留
其它 actor result；普通 `command.started`/`command.completed` 等无 actor 槽位的写账失败由 dispatcher
`emit` 转成 typed rejection，不能继续返回 `completed`。`selectRequestExecutionView` 的 `results`
保留全部 actor slot，失败 actor 为 `null`；cleanup terminal status 使用 contracts 的闭集
`RequestLifecycleStatus` exhaustive switch；depth rejected observation 使用显式 narrowing，无
`depthRecord!` 非空断言。

本轮新鲜输出：runtime typecheck exit 0；runtime 13 files / 76 tests PASS；focused
`requestLedgerLifecycle` + `requestLedgerSelector` 2 files / 14 tests PASS；runtime static 5 rule
gates + support PASS；TER `verify:static` PASS；TER-local `verify` 22/22 typecheck、9/9 test、
`TERMINAL_TEST_MARKERS=PASS real=4 noTests=5`、Metro 710 modules、`TERMINAL_VERIFY_CLEANUP=PASS`、
`TERMINAL_VERIFY=PASS`。本轮 TER-local `verify` 首跑曾暴露 `requestLedgerLifecycle.test.ts`
父/子 command 顺序断言首败；冻结设计只承诺 `startedAt` + `commandId` 稳定排序，不承诺父子拓扑序，
已改为按 `commandName` 对拍 parent/child result 后复跑通过。

一次误用命令不计入证据：曾把 `--runInBand` 传给 package script，Vitest 本体通过但脚本末尾 Node
以 `bad option: --runInBand` exit 9；随后按原始 package script 重跑并 exit 0。

边界不变：未运行仓级 normal `scripts/verify`、native/Gradle/设备、DEV、seed/reset、浏览器 L2、
UAT 或部署；`state.applyAuthoritativeSync` 的 sync direction 仍为 `UNVERIFIED_REQUIRES_EVIDENCE`。
