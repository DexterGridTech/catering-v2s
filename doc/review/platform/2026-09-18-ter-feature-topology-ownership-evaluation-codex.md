# TER feature 端双屏/双机状态与命令归属独立评估

## 1. 评估范围与结论

**评估对象**：TER 当前 feature/integration 端在单机双屏、双机双屏，以及副机切换为主屏
（`SLAVE + PRIMARY → BRANCH`）时的状态 owner、UI 驱动链和用户操作命令归属。

**对照对象**：仓外两个历史 POC：`../_old_` 与 `../newPOSv1`。它们只作为机制事实的
对照来源，不是本仓运行时依赖，也不能替代当前 TER 的源码与 focused/设备证据。

**执行边界**：本轮只做静态源码与文档评估；未运行构建、测试、Web、Metro、Android、设备、
双机 runner 或部署命令。没有修改 production、test、script 或依赖代码；本轮只同步了终端设计
规范与项目记忆指针，并生成了本报告及 Claude review request。

**独立结论**：`NO-GO`。

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码事实提取
VERDICT=NO-GO
M/S/N=3/3/2
L1_ENGINEERING=NO-GO：双机 secondary 状态投影、wallpaper 配对单屏资格、SLAVE/PRIMARY/BRANCH 本地闭环均未被当前源码闭合。
L2_USER_VISIBLE=NO-GO：副屏内容、确认操作、以及副机脱离后主屏操作存在 owner 分裂或未闭合路径。
L3_UNVERIFIED=运行期结果、focused 行为、native/Android、双机、单机双屏、Web、visual/release、cleanup 均未在本轮验证。
SAME_ROOT_SCAN=已扫描所有 production SECONDARY placement owner、所有 BRANCH part 声明、六处 production contentActions 派发、topology state-sync/identity 入口、command target boundary、member feature 的副屏操作入口及两套 integration assembly；详见第 8 节。
DESIGN_GAPS=当前 TER 缺少 workspace 级“MAIN secondary projection / secondary action return / BRANCH local”统一契约；本报告提出该缺口，不能用现有 members-only sync 或事件重放替代，也不应为每个 feature 另造 projection vocabulary。
EVIDENCE_TIER=static source + POC source comparison；focused/native/Android/device/Web/visual/release/cleanup OPEN。
```

## 2. 必须成立的业务不变量

| 运行形态 | 副屏内容的事实 owner | 副屏用户操作的 owner | 主/副机 UI 与命令边界 |
|---|---|---|---|
| 单机双屏 | 同一个 JS store 中的主机 `MAIN` 内容 slice 的 `SECONDARY` 部分 | 主机 actor；单机时本地执行 | 主机 actor 写 state，secondary surface 只渲染该 state |
| 双机双屏 | 主机 `MAIN` 内容 slice 的 `SECONDARY` 部分，经批准的 `MAIN → SLAVE` 投影到副机 | 主机 actor；副机只上行意图/command | 副机 secondary 不自建业务事实，不靠收到拓扑事件重放 |
| 副机切主屏 | 副机 `BRANCH` workspace | 副机本地 actor | `SLAVE + PRIMARY` 不读取 `MAIN`，不把本地操作误路由回 peer |

这里的“主机”是相对副机的拓扑角色，不等同于“当前正在渲染 primary surface”。单机双屏
没有跨设备边界，但仍应保持同一 owner 语义：主机 actor 改 `MAIN`，两个 surface 通过
state 渲染。双机只是在这条 state 链上增加明确的 `MAIN → SLAVE` 投影。

这条不变量已经写入 `doc/platform/terminal-coding-standard.md` §4-D，并由
`project-memory/decisions/terminal-architecture-and-stack-rulings.md` 的
`TER_FEATURE_TOPOLOGY_OWNERSHIP` 指向正本。

## 3. POC 机制对照

### 3.1 `_old_`：owner 随设备角色分支

仓外 `_old_` 的下列源码体现了目标语义：

- `../_old_/2-ui/2.3-integrations/mixc-retail/src/features/actors/navigate.ts:16-25`
  按 `MASTER` 与 `SLAVE + BRANCH` 分开导航；它不是按“当前画面是第二块屏”决定 owner。
- 同文件 `:29-42` 在登录成功后按拓扑/工作区安排主屏与副屏的 UI。
- `../_old_/2-ui/2.3-integrations/mixc-retail/src/hooks/useDisplaySwitchConfirm.ts:19-29`
  用 command 处理显示切换确认，而不是让 surface 直接写业务状态。
- `../_old_/2-ui/2.3-integrations/mixc-retail/src/ui/screens/RootScreen.tsx:23-59`
  根据 `displayMode` 选择渲染 root；这解决渲染选择，不把它变成业务 owner。

旧 POC 中的 `workbenchSecondaryMonitor.ts` 是历史 effect-like 形态，不应照搬；本次采用的
语义依据是 owner 分支和状态/命令方向，而不是该文件的实现方式。

### 3.2 `newPOSv1`：slice descriptor 与 live master/branch 证据

`newPOSv1` 对这条不变量有更直接的状态协议表达：

- `../newPOSv1/1-kernel/1.1-base/ui-runtime-v2/src/features/slices/screenState.ts:13-16`
  明确 `main` 与 `branch` workspace；`:71-103` 给出 `MAIN` 的
  `master-to-slave` 与 `BRANCH` 的 `slave-to-master` sync intent。
- `../newPOSv1/1-kernel/1.1-base/ui-runtime-v2/test/scenarios/ui-runtime-v2-live-screen-master-to-slave.spec.ts:20-39`
  由 master dispatch，读取 slave 的 main state，证明“主机写、从机渲染”而不是“副机重放”。
- `../newPOSv1/1-kernel/1.1-base/ui-runtime-v2/test/scenarios/ui-runtime-v2-live-branch-screen-slave-to-master.spec.ts:20-47`
  证明副机处于 primary/branch 时走 branch 并由副机本地派发。
- `../newPOSv1/1-kernel/1.1-base/ui-runtime-v2/test/scenarios/ui-runtime-v2-live-overlay-master-to-slave.spec.ts:21-48`
  对 overlay 也保持同一个 master-to-slave 方向。
- `../newPOSv1/1-kernel/1.1-base/topology-runtime-v3/src/foundations/runtimeDerivation.ts:6-14`
  明确 `SLAVE + PRIMARY → BRANCH`。
- `../newPOSv1/2-ui/2.3-integration/catering-shell/src/supports/rootScreenRouter.ts:14-39` 与
  `../newPOSv1/2-ui/2.3-integration/catering-shell/src/ui/screens/RootScreen.tsx:41-52` 分别承担
  actor/root 的路由与 surface 渲染选择，职责没有混成“secondary surface 自己成为业务 owner”。

因此，两个 POC 的共同可复用原则是：workspace/拓扑角色决定 owner，displayMode 只决定
呈现 surface；跨机同步的是 owner state，不是“收到事件之后再 locally show 一遍”。

## 4. 当前 TER 已经正确的基础事实

以下部分方向正确，不应因本报告的 findings 被改坏：

1. `apps/terminal/kernel/base/display-context/src/foundations/displayDerivation.ts:5-14`
   由 `displayIndex`/角色推导 `displayMode` 与 `workspace`；`SLAVE + CHIEF` 推导 `BRANCH`。
2. `apps/terminal/kernel/base/ui-state/src/selectors/selectContent.ts:26-44`
   按明确的 `displayMode` 选择 screen/layers，且 workspace 由状态上下文解析，不需要把
   业务导航镜像复制到另一个 slice。
3. `apps/terminal/kernel/base/topology/src/application/createTopologyPeerCommandController.ts:154-163`
   接收跨机 command 后以 `target: 'local'`、`routeContext: null` 归一化执行，方向上能防止
   receiver 把收到的 command 再转发回 peer。
4. `apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts:468-510,567-579`
   已有统一 dispatch boundary；问题不是再造第二个 dispatcher，而是 feature payload 的
   workspace/owner 语义还没有在该边界上闭合。
5. `apps/terminal/kernel/base/topology/src/foundations/evaluateTopologyOperation.ts:49-75`
   已有“本机物理双屏，或 MASTER 已配对”的拓扑资格判定；它可以作为拓扑事实来源，但不能
   被 feature 中只表达物理屏数的 helper 取代。
6. `apps/terminal/kernel/base/display-context/src/foundations/displayDerivation.ts:64-66`
   的 `resolveSecondarySurfaceAvailable` 仍是物理屏数 helper。它有既有生产调用方和测试，
   本次评估不建议改变其物理语义。

## 5. 当前 TER 的关键偏差

### M-1：双机 secondary 让副机 actor 写了 MAIN，且没有闭合 state projection

**状态：`CONFIRMED`（静态源码事实）；运行期表现 `UNVERIFIED_REQUIRES_EVIDENCE`。**

**仓内事实**：

- `apps/terminal/kernel/base/ui-state/src/foundations/workspaceSlices.ts:244-246`
   同时建立 canonical、MAIN、BRANCH 内容 slice；`:574-588` 注册 MAIN/BRANCH descriptor。
- `apps/terminal/kernel/base/ui-state/src/foundations/workspaceSlices.ts:535-571`
  为这些 content descriptor 固定 `syncIntent: 'isolated'`；这进一步说明当前 content slice
  没有被声明为跨机 projection source。
- `apps/terminal/kernel/base/display-context/src/foundations/displayDerivation.ts:11-14`
  的 `resolveWorkspace` 只有 `SLAVE && CHIEF → BRANCH`，其余组合一律返回 `MAIN`。因此双机
  副屏的正常 `SLAVE + VICE` 处于 `MAIN`，不是 `BRANCH`。
- `apps/terminal/kernel/base/ui-state/src/features/actors/contentActors.ts:216-228`
  的 `dispatchContentAction` 按 `currentWorkspace(context)` 选内容 slice，再通过
  `createWorkspaceActionDispatcher` 写入；`:231-239` 的 `showScreenCommand` actor 也走这条路径。
- `apps/terminal/kernel/base/topology/src/application/createTopologyStateSyncController.ts:13,24-26,59-88`
  的 controller 只暴露 `sendMembersSnapshot`，并硬编码
  `kernel.feature.sample-member-registry.members`；它不是 generic 的 feature content projection。
- `apps/terminal/kernel/base/topology/src/application/createTopologyModule.ts:258-269`
  在 peer accepted 后触发 members snapshot；`:420-474` 虽可接收某个 state-full，当前发送
  入口没有把 sample UI 的 MAIN secondary content 纳入同步。
- `apps/terminal/ui/feature/sample-member-desk/src/features/actors/actors.ts:73-83`
  的 `show` 通过 `showScreen` 带 `displayMode` 派发；当主机已配对且请求 secondary 时，
  `apps/terminal/kernel/base/topology/src/foundations/resolveCommandTarget.ts:21-39`
  会把该 command 解析为 `peer`。接收侧虽在
  `apps/terminal/kernel/base/topology/src/application/createTopologyPeerCommandController.ts:154-163`
  归一为本地执行，但执行方已经变成副机 actor；结合前面的 `resolveWorkspace`，它写的是副机
  自己的 `MAIN` 内容 slice。这直接违反“MAIN 只能主机的 actor 执行 command 写入 slice”。
- `apps/terminal/ui/feature/sample-member-desk/src/features/actors/actors.ts:141-183`
  在 topology event/recovery 后，副机本地重新 show customer welcome/member secondary。
  其中 `:60-71` 的 `hasSecondarySurface` 还以 `paired && SLAVE && VICE` 做刻意的
  slave-local secondary 映射；这是事件后的本地重放，不是主机 MAIN 内容投影，也会把副机的
  业务画面重新变成一个独立事实。
- `apps/terminal/kernel/base/ui-state/src/features/actors/contentActors.ts:216-228,236,270,283,293,333,400`
  的 content 写入路径实际有六处：`showScreen`、`openLayer`、`closeLayer`、`clearLayers` 四处
  经过 `dispatchContentAction`，`createPruneHydratedContainersActor` 的 `removeScreen` 与
  `createPruneHydratedLayersActor` 的 `closeLayer` 两处直接 `dispatch(contentActions.*)`，绕过该
  seam。后两条仍由 `pruneHydratedContainersCommand`、`pruneHydratedLayersCommand`
  （`apps/terminal/kernel/base/ui-state/src/features/commands/index.ts:7-8`）驱动，属于
  “actor 执行 command 写 content slice”，不能被公共门的覆盖声明漏掉。
- `contentActors.ts:345-346,376-377` 当前对 prune 写死遍历 `['MAIN', 'BRANCH']` 与两个
  display mode；因此主机也会写 BRANCH，副机也会写 MAIN。这是除 peer command 与
  `sample-member-desk` slave-local fallback 之外的第三种 owner 违规路径，不是某一端偶然选错
  `currentWorkspace`。
- prune 的 owning 语义是水合后的持久化卫生：`resolvePart.ts:142-159` 会把当前 catalog 不兼容
  的条目报告为 `incompatible-catalog-entry` fallback，`LayerStack.tsx:114-119` 对不可用层也会
  跳过；没有 prune 不会直接造成白屏。它的职责是清理不可渲染的持久化死条目，不是替代投影。

**单机边界澄清**：这不是说 TER 的 content 写入机制本身错误。当前
`showScreenCommand → createShowScreenActor → dispatchContentAction → contentActions.showScreen`
确实按当前 workspace 写入对应内容 slice；单机双屏共享一个 store 时，主机 actor 写 MAIN 后由
两个 surface 渲染，方向本身合规。偏差只发生在跨机路由把执行 actor 换成副机，以及内容 slice
没有投影声明。

**为什么是 Major**：这不是单个组件样式或一个入口漏接，而是用户明确要求的双机 feature owner
边界未建立。只同步 members slice、或让 peer 直接执行一次 `showScreen(SECONDARY)`，无法保证
重连、恢复、主机业务状态变化与副机 render 始终同源。

**最小反例**：主机已配对、只有一块物理屏；主机 secondary `showScreen` 被路由给 peer，
副机 actor 在 `MAIN` 写入自己的 secondary content。此时两台机器各有一份 MAIN 事实，下一次
state hydrate/reconnect 或主机重写内容时，副机没有来自主机的权威 projection，表现会漂移。

**建议的最小收口**：以下事项必须同批完成，避免先设门后画面消失或投影后反复回写：

1. 先穷举并闭合六处 `contentActions.*` 写入：要么让 prune 两处也经同一
   `dispatchContentAction`，再在公共 seam 加 `MAIN/MASTER`、`BRANCH/SLAVE` 的 fail-closed
   归属门；要么保留独立 prune seam，但对六处逐一施加同一归属判定。不得只覆盖当前四处而声称
   “所有 content actor 写入已设门”，也不得为每个 feature 各建一套 owner 门。
2. 按 Dexter 已裁定的 prune 语义，主机只清理 `MAIN`，副机只清理 `BRANCH`；把
   `['MAIN', 'BRANCH']` 的无条件遍历改为按本机 `instanceMode` 选择一片。该裁定不是对 §4-D
   挖豁免口子，而是让 prune 作为 actor command 遵守同一写入归属规则。
3. 复用现有 `SyncIntent` 的 `master-to-slave`/`slave-to-master` 形态和已有
   `getEntries`/`applyEntries` 契约：content 的 MAIN descriptor 声明 `master-to-slave`，BRANCH
   descriptor 声明 `slave-to-master`；同步执行层根据已注册 descriptor 投影 content state，不能
   继续把 members slice 写死在 topology wire/base 中。feature 保留现有主机 actor 写 MAIN 的
   行为，不新增逐 feature projection contract。

4. 同时替换 `actors.ts:64-71` 的 slave-local secondary 映射，让副机只渲染主机投影结果。
   该建议不是本轮实施授权。

**投影边界**：`applyAuthoritativeSync` 走 `createStateStore.ts:11-12,23-34` 的独立
`APPLY_AUTHORITATIVE_SYNC` action，不经过 `contentActions.*`。归属门只约束“actor 执行 command
写 content slice”，不得拦截投影落地；把守卫写在过宽的 store/action 层会把合法 MAIN projection
一并挡掉。

### M-2：wallpaper integration 用物理屏数阻断了“已配对单屏主机的远端副屏”

**状态：`CONFIRMED`（源码事实）。**

`apps/terminal/ui/integration/sample-wallpaper-console/src/features/actors/actors.ts:24-41`
的 `showSecondaryIfAvailable` 读取设备显示信息，并只调用
`resolveSecondarySurfaceAvailable`；该 helper 在
`apps/terminal/kernel/base/display-context/src/foundations/displayDerivation.ts:64-66`
只按 `displayCount >= 2` 判断物理双屏。

但拓扑资格的正确事实在
`apps/terminal/kernel/base/topology/src/foundations/evaluateTopologyOperation.ts:49-56`
与 `apps/terminal/kernel/base/topology/src/selectors/selectTopologyFacts.ts:35-50`：
主机已配对副机时，即使本机 `displayCount === 1`，也有 topology secondary surface。

因此双机、单屏 laptop 主机的 wallpaper placement 会在尚未 dispatch secondary 前直接 return，
无法进入“主机驱动远端副屏”路径。现有
`apps/terminal/ui/integration/sample-wallpaper-console/src/parts/parts.ts:11-35`
确实声明了 waiting/welcome secondary parts，但 owner actor 的资格判断与声明不一致。
其 README `apps/terminal/ui/integration/sample-wallpaper-console/README.md:21-23`
只说明 placement owner 与副屏行为，`README.md:48-50` 才是 topology capability/allowlist 的说明；
两处文案都不能替代 actor 对 topology 资格的实际读取，具体偏差在上面的 actor 源码：它仍调用
只表达物理屏数的 helper。

同一“是否有可用副屏”语义当前存在三种实现：`sample-member-desk` 自己的
`hasSecondarySurface`（`actors.ts:60-71`）、wallpaper 的物理 helper，以及 topology 的
`hasTopologySecondarySurface`。这三者的语义不等价；整改时应保留物理 helper 的物理语义，
并把 feature/topology eligibility 收口到单一 topology 事实或操作级 evaluator，避免下一个
feature 再选错 owner。

**反例**：主机单屏 + 已配对副机；`displayCount=1` 时 helper 返回 false，副机没有 secondary
placement。若只增加一个第二块本地物理屏来验证，反而无法发现这个双机边界。

**最小收口**：不改物理 helper；wallpaper feature 的 placement owner 改为读取 topology
secondary eligibility（或 operation-level evaluator），并为“单屏主机 + paired slave”保留 focused
行为证明。本报告不指定具体 API 形状。

### M-3：副机切到 PRIMARY/BRANCH 后，sample feature 没有完整的本地 UI/command 闭环

**状态：`CONFIRMED`（源码结构事实）；具体运行画面 `UNVERIFIED_REQUIRES_EVIDENCE`。**

- `apps/terminal/kernel/base/display-context/src/foundations/displayDerivation.ts:11-14`
  已推导 `SLAVE + CHIEF → BRANCH`，这条基础机制正确。
- `apps/terminal/ui/feature/sample-member-desk/src/parts/parts.ts:22-119`
  的业务 parts 主要绑定 `mainWorkspace`；`:126-150` 的 customer secondary parts 仍然绑定
  `mainWorkspace` 且没有 branch owner；`:152-162` 的 parts 集合没有 feature 级 BRANCH 业务条目。
- 仓内对所有 terminal UI part 声明做了全树扫描：`BRANCH` 命中只在
  `apps/terminal/ui/base/admin-shell` 及 sample-console 测试 fixture，sample-member-desk、
  staff-auth、wallpaper picker/console 没有 production BRANCH business part。
- `apps/terminal/kernel/base/topology/src/foundations/resolveCommandTarget.ts:27-29`
  对 `routeIntent === 'peer-intent'` 只检查 `SLAVE && paired`，忽略了当前 `displayMode`、
  workspace 和操作 owner。因此副机已经切到 PRIMARY/BRANCH 时，feature 仍可能把 peer-intent
  命令发向主机，而不是由副机本地处理。
- 当前 `apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx:1227-1273`
  覆盖的是 master paired secondary command 路由到 peer；没有对等的 slave primary/branch
  local target 行为证明。

**反例**：副机从 detached secondary 变成 primary，渲染上下文已经是 BRANCH，但确认/导航仍带
`peer-intent`；当前 resolver 看到 `SLAVE && paired` 就返回 peer。用户在副机主屏上的本地操作
可能被送回主机，形成错误的业务 owner 或 receiver 归一后的循环/拒绝。

**最小收口**：每个支持 detached primary 的 feature 必须明确 BRANCH part 与本地 command owner；
不支持的 feature 必须有显式 unavailable/not-found catalog 结果，不能用 MAIN 空内容或 peer fallback
伪装支持。需补 focused local branch command 证明。

## 6. Significant findings

### S-1：当前同步证据只覆盖 members，不覆盖 workspace content projection

**状态：`CONFIRMED`。** `createTopologyStateSyncController` 的单一发送入口见
`apps/terminal/kernel/base/topology/src/application/createTopologyStateSyncController.ts:13,24-26,59-88`。
`apps/terminal/kernel/feature/sample-member-registry/src/features/slices/slice.ts:33-57`
确有 `master-to-slave` 的 members descriptor，但没有同等的 sample screen/overlay content
descriptor。`apps/terminal/kernel/base/contracts/src/types/topology.ts:193-205` 与
`apps/terminal/kernel/base/contracts/src/foundations/topologyWire.ts:171-187` 还把可传输的
`state-full-chunk` slice 固定为 members；`topology.test.ts:422-455` 证明 members transfer，
不证明 secondary UI content。

这不是要求“所有 slice 都双向同步”，也不是要求逐 feature 新造 projection vocabulary：
`SyncIntent` 已有 `isolated`、`master-to-slave`、`slave-to-master` 三个值，且
`StateRuntimeSyncDeclaration` 已要求非 isolated descriptor 提供 `sync`。当前缺口是 content
descriptor 仍为 isolated、wire/发送执行层仍只接受 members，以及没有 content projection 的行为
证据。最小方向是复用既有 workspace descriptor/sync contract，在 workspace 层一次覆盖 MAIN/BRANCH
全部 feature；不为每个 feature 建 projection descriptor 或 owner actor。

### S-2：`peer-intent` 的语义宽于“副屏操作回主机”

**状态：`CONFIRMED`。** `resolveCommandTarget.ts:27-29` 仅按 `SLAVE && paired` 返回 peer，
没有把 `PRIMARY/BRANCH` 排除。member feature 的 `CustomerMember.tsx:66-90`、`MemberForm.tsx:75-98`
与 `WithdrawConfirm.tsx:23-28` 都使用 `routeIntent:'peer-intent'`。

这使“副机 secondary 上的操作回主机”和“副机切主屏后的本地操作”共享同一意图标志，边界
无法由调用方正确表达。更小修法是沿现有 dispatch boundary 增加 workspace/operation 语义，
而不是为每个 command 建静态 peer 名单。

### S-3：topology base 与 wire contract 仍硬编码 sample members

**状态：`CONFIRMED`。** `createTopologyStateSyncController.ts:13`、
`createTopologyModule.ts:58`、`apps/terminal/kernel/base/contracts/src/types/topology.ts:193-197`
与 `apps/terminal/kernel/base/contracts/src/foundations/topologyWire.ts:171-187` 都把跨机 state
full 的 slice 固定为 `kernel.feature.sample-member-registry.members`。
这可以作为当前 sample 的临时已知投影，却不能承接“副屏 UI 内容由主机 state 驱动”的 framework
原则。更小方向不是逐 feature 新造 descriptor，而是让既有 workspace slice registration 的
`SyncIntent`/`sync` 进入通用 state projection 执行；topology 只执行已注册、方向合法的 descriptor，
不再把 members 字面量写进 base 与 wire contract。

## 7. Notes

### N-1：副机自建 MAIN 事实的根因是刻意保留的 slave-local fallback

**状态：`CONFIRMED`（代码事实）；结论是 M-1 的根因精度补充。**
`apps/terminal/ui/feature/sample-member-desk/src/features/actors/actors.ts:64-71` 的注释明确
保留“paired single-screen slave 将自己的物理屏映射为 SECONDARY”的 fallback；
`createTopologyModule.ts:266-267,351-383` 的两侧 `peer-accepted` 事件会触发该 feature actor，
使副机在 `paired && SLAVE && VICE` 时本地 show customer welcome。它与主机把 secondary show
command 路由给副机一样，都是副机 actor 写 MAIN 的两种违规路径；不能只删 recovery replay，
必须替换这条 slave-local 映射的 owner 设计。

`../_old_/2-ui/2.2-modules/mixc-workbench/src/features/epics/workbenchSecondaryMonitor.ts`
仍仅作为历史 effect-like 形态警示，不能作为 TER 实现模板；TER 继续遵守 `TR-11` 的
event → command → actor → dispatchAction 规则。

### N-2：现有 member-desk focused test 公共面先验失败，尚未重新执行

`apps/terminal/ui/feature/sample-member-desk/test/memberDesk.test.tsx:32-36` 从 kernel 包导入
`memberActions`，但 `apps/terminal/kernel/feature/sample-member-registry/src/features/slices/slice.ts:60`
只在内部导出，当前公共包入口没有该成员。已有历史 runtime log
`.runtime/ter-dual-machine-topology/2026-09-17/cp5/member-desk-recovery-typecheck.log`
记录了 `TS2305`。本轮没有重跑它，也没有借该日志宣布新的 focused 结论；实施前应先由 owning
package 修复或明确测试公共面，再建立上述 owner 行为测试。

## 8. 同根扫描与覆盖范围

本轮静态扫描覆盖以下全集，而不是只抽样用户点名文件：

1. `apps/terminal/**/src/**` 中 production `SECONDARY` placement/`showScreen` owner；
2. `apps/terminal/**/src/**` 中 production `BRANCH` workspace/part 声明；
3. `apps/terminal/kernel/base/topology/src/**` 的 state sync、peer receiver、target resolver、
   operation evaluator；
4. 两个 integration assembly 与它们的 feature actor；
5. member feature 的 secondary UI 操作入口及现有 focused tests；
6. 两个 POC 中的 workspace/sync/root-router/live-scenario 相关路径。
7. `contentActions.*` 的全仓 production 派发与 prune commands；`APPLY_AUTHORITATIVE_SYNC` 的独立
   state-store action；
8. `TopologyIdentity`、`createLocalIdentity`、两个 integration module name 与 assembly topology
   注入点；
9. `isUiCatalogEntryAvailable` 的 `instanceModes` 判定，以及两个 sample 的 SECONDARY part 声明。

未发现另一个 production `BRANCH` feature owner 可以关闭 M-3；未发现 topology state-sync 已经
发送 sample UI content 可以关闭 M-1/S-1；确认当前 topology identity 尚无 module name 字段，且
prune 仍无条件触碰两片。没有把测试 fixture 或 admin-shell 的 BRANCH part 冒充 sample feature
生产覆盖。

## 9. 建议的最小收口顺序（不是实施授权）

1. **先穷举六处 contentActions 派发并设归属门，再同批打开 projection**：四处现有
   `dispatchContentAction` 加上 prune 的两处直接 dispatch 都必须受同一 `MAIN/MASTER`、
   `BRANCH/SLAVE` 判定覆盖；不能只保护四处就声称 fail-closed。归属门不得包住
   `APPLY_AUTHORITATIVE_SYNC` 投影落地，否则会误挡合法 MAIN projection。
2. **按 Dexter 裁定收窄 prune 作用域**：主机只清 `MAIN`，副机只清 `BRANCH`；不能无条件遍历
   两片，也不能用豁免口子掩盖 actor command 的写入归属。
3. **再泛化现有 state transfer 执行**：由已注册 workspace descriptor 产生合法 projection，
   移除 members-only 的 topology base/wire 限制，不为每个 feature 添加独立 projection vocabulary。
4. **再闭合命令与 feature owner**：master secondary 的 command 才能 peer；slave primary/branch
   command 必须 local；替换 slave-local secondary fallback；wallpaper 的单屏 paired-master
   资格走 topology，统一三种副屏资格实现。
5. **最后补行为证据**：单机共享 store、双机 MAIN→SLAVE projection + secondary action return、
   detached SLAVE/PRIMARY branch local 三条分别验证；同时覆盖重连/恢复，不用一次成功的静态
   catalog 或截图替代状态与命令 oracle。

在上述三类行为没有闭合前，不建议进入“实现已符合双机双屏 feature 规范”的结论；本轮没有
授权修改源码、测试或运行环境。

## 10. 复核后新增的 Dexter 设计输入

以下不是本轮重新计数的 finding，而是 Dexter 已明确、详设必须承接的新增约束；当前源码只做了
静态核对，尚未按它们实施：

1. **同一个 APP 才能配对**：握手身份新增 integration 层 `moduleName`，取
   `ui.integration.sample-console` 或 `ui.integration.sample-wallpaper-console` 的 module name，
   不取 assembly module name。由 integration assembly 注入 topology module，在
   `createTopologyModule` 的 local identity 组装处进入 `TopologyIdentity`；两端不等即拒绝配对，
   复用既有封闭错误 union，用户文案应明确“主副机必须是同一个应用”。当前
   `apps/terminal/kernel/base/contracts/src/types/topology.ts:54-60` 的 `TopologyIdentity` 尚无该字段，
   `createTopologyModule.ts:83-91` 也尚未组装它。协议 parser 的精确 key 校验意味着这是有意的
   fail-closed 破坏性协议变更；版本不一致允许有损行为，不做版本协商。
2. **投影到副机的 SECONDARY part 必须允许 `SLAVE`**：catalog 可用性在
   `apps/terminal/kernel/base/ui-state/src/foundations/catalog.ts:151-158` 同时检查
   `instanceModes`。当前 sample-wallpaper-console 的 waiting/welcome 与 sample-member-desk 的
   customer-welcome/customer-member 已含 `MASTER`、`SLAVE`，但这是当前值而非机械保证；详设应在
   integration 装配期增加封闭检查，避免同 APP 投影后静默变成 incompatible-catalog fallback。
3. **版本有损的诊断**：同 module name 的不同构建仍可配对；若投影内容因 catalog 变更不可用，沿用
   现有 `incompatible-catalog-entry` 诊断路径，不改变降级语义，但详设应决定如何让诊断可区分版本
   差异与普通缺失，而不把版本协商或新恢复机制带入本批。

## 11. 处置状态与授权边界

- 本报告提出的 M/S/N 是静态评估 finding，不是实现授权，也不是 runtime/acceptance 结论。
- 已新增规范与项目记忆指针，属于用户明确要求的文档性固化；没有借此改变任何生产代码行为。
- `resolveSecondarySurfaceAvailable` 的物理语义、`SLAVE + PRIMARY → BRANCH` 的基础推导、
  receiver local normalization 与既有 `TR-11` command/actor 模式均不建议在没有 owning source
  证据的情况下回退。
- focused/native/Android/device/Web/visual/release/cleanup 均为 `OPEN`；下一轮 Claude review
  应先逐条重开源码，再决定是否需要 Dexter 对产品/Journey 范围作裁决。

## 12. 转交前自审与独立复核留痕

### Round 1：fresh 只读独立对抗审查

- reviewer：fresh 只读 critic，目标文件与源码从当前仓重新读取；未写文件，未运行构建、测试、
  设备或网络动作。
- 结果：`NO-GO` 维持；M-1/M-2/M-3、S-1/S-2/S-3、N-1/N-2 的核心判断均为
  `CONFIRMED` 或带明确运行期限制的 `CONFIRMED static`。
- finding：发现一个报告引用精度问题——README `:21-23` 是 placement 行为说明，topology
  capability 在 `:48-50`；已在本报告修正，未改变 M-2 结论或严重度。
- 规范反证：未发现 §4-D 与 TR-01、TR-11、TR-12、§4-A 冲突；仍要求 topology event 不成为
  feature 业务 UI 的第二事实源。

### Round 2：主 agent 定向一致性检查

- 回源重新打开 topology state-sync 全部 `sendStateFull` 命中、wire `state-full-chunk` 类型与
  parser、两个 sample actor、所有 production BRANCH part 命中、两个 POC 的 live scenario；
  没有把测试 fixture 或 admin-shell BRANCH part 算作 sample feature production 覆盖。
- 重新验证报告与交接的 M/S/N 数量、finding ID、路径、证据档位和授权边界一致；报告没有把
  static 推论写成 runtime PASS，也没有把历史 `.runtime` 日志升级为本轮 focused 结果。
- 修正并确认：M-1 补充 `ui-state` content descriptor 当前为 `syncIntent: 'isolated'`；
  S-3 补充 contracts type/parser 的 members-only 限制；M-2 修正 README 行号与语义描述。
- 本轮复核前的主 agent 自检没有穷举 `contentActions.*` 的六处生产派发；该缺口由 Claude 第二轮
  复核发现并已回写本报告 M-1。当前报告不再把 `dispatchContentAction` 四处误称为全部公共写入
  seam，也不再把 prune 描述成按 `currentWorkspace` 偶然选错。
- 生成前置检查：项目记忆 `scripts/memory/build-index --check` 通过；review request 的
  handoff checker 必须在本报告最终字节稳定后再次通过。

**自审结论**：报告结论仍为 `NO-GO, M/S/N=3/3/2`，可以转交 Claude 做独立 review；本轮
没有发现需要改动生产源码的授权，动态与用户可见证据仍保持 `OPEN`。

### Round 3：Claude review intake

- Claude 对本报告的复评结论为 `GO, M/S/N=0/1/2`：报告的三条 Major 均被独立回源确认，报告的
  `NO-GO 3/3/2` implementation 定性成立；本轮 `GO` 只表示评估报告可以作为整改基础，不表示
  代码、focused、native/Android、device、Web、visual/release 或 cleanup 已通过。
- 已接受并固化 Dexter 的精确写入归属措辞：`MAIN` 只能主机的 actor 执行 command 写入 slice；
  `BRANCH` 只能副机的 actor 执行 command 写入 slice。正本在 terminal coding standard §4-D，
  project-memory 仅保留指针与同文断言。
- 已按 S-1 收窄建议修正文档：不再把逐 feature projection descriptor 当作最小方案；整改顺序改为
  公共 content write seam 的 `MAIN/MASTER`、`BRANCH/SLAVE` fail-closed guard，加上复用现有
  `SyncIntent`/workspace descriptor 的 MAIN→SLAVE 与 BRANCH→MASTER projection，再处理 command
  与 feature owner。当前源码未因此被修改。
- 已补入 M-1 的精确事实链：`SLAVE + VICE` 解析为 `MAIN`，peer receiver 归一后由副机 actor
  写自己的 MAIN；并注明单机双屏共享 store 的既有写入机制本身不构成该跨机违规。
- 已补入 N-1 的精确根因：`sample-member-desk` 的 paired single-screen slave-local secondary
  fallback 与两侧 `peer-accepted` 触发的本地重放，是副机 actor 写 MAIN 的另一条路径；不能只删除
  一段 recovery replay。
- Claude 未重跑 production parts 全树扫描，也未读取报告第 8、9、11 节（本次修订后仍对应同根
  扫描、建议顺序与处置状态章节）；这些仍属于本报告主 agent 的静态核验留痕，不被 Claude 的
  复核结论升级为独立覆盖。

### Round 4：Claude 第二轮复核 intake

- Claude 复核结论为 `NO-GO, M/S/N=1/0/2`。该唯一 Major 已独立穷举 `contentActions.*` 的
  六个生产派发点，确认原先只在 `dispatchContentAction` 设门的修法漏掉 prune 两处；报告已改为
  六处全覆盖，并写明投影 `APPLY_AUTHORITATIVE_SYNC` 不经过该门。
- 已回写准确根因：prune 当前无条件同时写 MAIN 与 BRANCH，不是副机偶然按 `currentWorkspace`
  选错；它是第三条违反 workspace owner 的 actor-command 路径，并会与 MAIN projection 互相推翻。
- 已登记 Dexter 裁定：主机只 prune MAIN，副机只 prune BRANCH；同 APP 配对按 integration
  `moduleName`，身份字段由 integration 注入 topology；版本不协商但允许有损；被投影的 SECONDARY
  part 必须允许 SLAVE。上述新增设计输入尚未实施。
- 本轮覆盖边界保持诚实：Claude 未复跑 production parts 全树扫描，未重读
  `createTopologyPeerCommandController`；本轮仍只有 static 证据，focused/native/Android/device/Web/
  visual/release/cleanup 未宣称通过。
