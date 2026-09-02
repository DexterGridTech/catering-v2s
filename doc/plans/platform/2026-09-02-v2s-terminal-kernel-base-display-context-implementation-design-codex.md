SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# V2S TER `kernel.base.display-context` 详细设计（Codex）

## 0 · 元数据与授权边界

```text
BUSINESS_SOURCE=doc/plans/platform/2026-09-01-v2s-terminal-kernel-base-display-context-requirements-claude.md@e29965294f465d139e920ac8aefad524e50a9716bd25a03838c81cf84e989684
JOURNEY_REFS=NOT_APPLICABLE_WITH_REASON：本批是 TER kernel 状态、命令与派生逻辑，无用户可见 Journey
IA_REF=NOT_APPLICABLE_WITH_REASON：本批不改变页面、导航、信息层级或可见文案
INTERACTION_REF=NOT_APPLICABLE_WITH_REASON：本批不实现 UI；未来确认交互须另走 TR-11 command
AUTHORIZED=按 Dexter 授权实施 DC-P0 到 DC-P5 与 TER-local 验收
NOT_AUTHORIZED=门缺陷整改单元 B 其余部分、workspace scoping、仓级 normal verify、native、Gradle、设备、DEV、seed、reset、browser L2、UAT、部署、数据操作
IMPLEMENTATION_AUTHORITY=true
```

准备阶段已按六维路由重开项目记忆。`scripts/memory/build-index` 的首轮失败暴露
`TER_EVENT_TO_COMMAND_ACTOR_PATTERN` 未进入 required inventory；依据 Dexter 已明确的“项目记忆有问题必须修复”，
已修唯一 owning inventory/sourceRefs 后复跑为：

```text
PROJECT_MEMORY=PASS
ENTRIES=75
KERNEL=6
ROUTED=69
```

本文的权威顺序是：冻结需求 → `doc/platform/terminal-coding-standard.md` TR-01/TR-03/TR-04/TR-09/TR-10/TR-11
→ 当前 owning source → 本设计。需求中的历史叙述不覆盖已裁定的 count-only `DisplayInfo`，也不覆盖本文明确消歧的两种失败域。

## 1 · 真实目标与方案比较

### 1.1 结构性问题

同一个 JS store 服务主、副两个 surface；设备又可能整体处于 MASTER 或 SLAVE。若把物理 surface、设备角色和
主副机角色压成一个可写 `displayMode`，任何写路径都可能把两块屏同时算成 SECONDARY，整机失去主屏。
本包必须把三类事实分开：

- `displayIndex`：每个 surface 的只读 props，永不入 store；
- `displayRole`：设备本地持久化的 CHIEF/VICE 选择；
- `instanceMode`：runtime 已有的 MASTER/SLAVE 状态。

不做本批会留下四个当前可达问题：命令可从受管副屏绕过；双屏设备可被整体切为 SLAVE；hydrate 可在任何 actor
之前恢复危险的 VICE；电源事件可在并发到达时乱序，使最终角色与最后物理事件相反。

### 1.2 方案比较

| 方案 | 结果 | 结论 |
|---|---|---|
| A. 照搬 POC，把 displayMode/displayCount/displayIndex 全放一个 slice | 物理事实和用户选择仍可互相覆盖；单 VM 双 surface 下两屏串值 | 拒绝 |
| B. 只建纯函数，不建命令、启动校验与端口桥 | 静态派生正确，但三条真实写路径仍能绕过；持久化 VICE 可在启动时直接进入 store | 拒绝 |
| C. `displayRole` 单字段 owner slice + per-surface 纯派生 + 三条写路径各自实时守卫 + TR-11 command | 用现有 state/runtime/ports，写路径唯一，可端到端证伪；只增加必需接缝 | **采用** |
| D. 为设备事件建通用 event bus/effect/callback 注册 | 重复 runtime command/actor，违反 TR-11，并扩大回调写能力 | 拒绝 |

我选 C 而不是 A/B/D，因为它以最少的新状态保留产品用意，同时把写入、事件和失败全部落回现有 owner command
体系；没有新增总线、可配置规则、运行期 schema 或兼容层。

### 1.3 S-6 与门缺陷整改单元 B 的定序裁定

S-6 在逻辑上是 display-context 的**硬前置**，但不等待整个门缺陷整改单元 B。实施时从该单元的 D-5
抽出一个窄的 `DC-P0` runtime 前置，并把 D-5 标记为 `SUPERSEDED_BY_TR11_DISPLAY_CONTEXT_P0`：

1. D-5 原 action-returning effect 方案不得实施；
2. `DC-P0` 只迁移 runtime 的角色变化接缝与模块资源登记，不带入 D-6…D-24 或 workspace；
3. 门缺陷单元 B 后续开工时以 `DC-P0` 后字节重建 baseline，不再实现 D-5；
4. `DC-P0` 未收口，display-context CP-2 不得开始。

这比“等整个单元 B”更小，也比另保留一套 effect 再迁移少一次返工。

## 2 · CP 总览

| CP | 主题 | 主要输出 | 依赖 |
|---|---|---|---|
| DC-P0 | runtime TR-11 前置 | post-commit role-changed command、request-ledger consumer、module resource registration | 当前 runtime |
| DC-P1 | platform-ports 合约 | count-only `DisplayInfo`、`getDisplayInfo`、默认不可用与 invariant/type tests | DC-P0 可并行，进入 P2 前均须绿 |
| DC-P2 | 包形态与状态基础 | 第四条 workspace 边、moduleKind、17 exports、单字段 slice、纯函数与 selector | P0+P1 |
| DC-P3 | command/actor/启动校验 | 四个本包 command、五个 actor、三条 VICE 写路径 | P2 |
| DC-P4 | 电源桥与生命周期 | 播种、去重、串行队列、typed 诊断、幂等释放 | P3 |
| DC-P5 | 四门、README/HANDOFF、TER-local 验收 | checker、red vectors、test owner 10/REAL5/NO5、证据 | P4 |

实施授权后，每个 CP focused proof 后、下一个 CP 前须由 fresh 独立子 agent 做需求/详设/项目记忆三维对账；
全部 CP 后、整体测试前再做一次全范围对账。

## 3 · 横切机制对照表

| 机制 | ① 现成能力/规范 | ② 可执行观察 | ③ 无现成时的固定形态 | ④ 本批全集 |
|---|---|---|---|---|
| 读侧节点授权 | state `StateRoot` + TR-03 | focused：唯一 selector 只读本包 slice | 缺 slice/非法值 fail closed 抛程序员错误 | `selectDisplayRole` |
| 写授权与 grant 复核 | TR-01/TR-11；runtime `defineCommand/defineActor/onCommand` | actor tests 观察 command result、最终 slice、端口调用 | 所有业务写只在五个 actor；桥/install 不裸 dispatch | 手切 role、切 instance、power、startup、runtime role changed |
| 跨 owner 写与事务 | runtime public command → internal command | 两跳测试：requestId/routeContext 继承，失败不写 runtime role | 无 DB 事务；每条 command 独立留 lifecycle | switch-instance 两跳；post-commit role event |
| 集合形态与分页 | N/A：单对象、无集合 | N/A | N/A | 无 |
| 缓存失效 / 改完刷新什么 | Redux store + selector | 写后 selector 立即读新值 | 不建第二份 cache；bridge 只缓存最后电源源值 | displayRole、lastPowerSource |
| RTK 数据读取与加载判定 | N/A：非 RTK Query/UI | N/A | N/A | 无 |
| 同一事实只有一个住址 | slice=`displayRole`；props=`displayIndex`；port=`displayCount` | static + focused：slice 精确字段只有 displayRole | displayMode/workspace 只派生、不存 | 三类事实及两个派生值 |
| 失败可见且原因不得改写 | platform `PortResult`；contracts `createAppError`；logger | failed/unavailable/timed-out/malformed 各断言 typed key/reason | command 拒绝与启动纠正分域，不能共用“都不写”句子 | 三次 getDisplayInfo、subscribe/unsubscribe、child command |
| owner 错误到 HTTP 的映射与注册处 | N/A：无 HTTP | N/A | N/A | 无 |
| 幂等键构成与重放语义 | command runtime lifecycle | bridge seed/dedupe/burst test | 本包不自造幂等 registry；按接收顺序串行 command | power bridge |
| 该用生成物的地方不得手搓字符串 | moduleName + defineCommand | static：command/name/slice 均由模块常量派生 | 错误 key 与日志 event 为本包具名常量 | 4 commands、1 slice、5 actors |
| 日志落点与脱敏字段 | AGENTS 日志硬约束；`platformPorts.logger.scope` | focused：断言 category/event/status/reason/capability，且无 raw payload | 只记录闭集、count、status、commandId；不记录敏感字段 | port/subscribe/unsubscribe/child command/persistence failure |
| 迁移回填与可逆性 | kind TR-09；field persistence | 两 runtime 共享 storage 重启测试 | 无历史数据迁移；错误恢复值在启动 actor 纠正 | moduleKind、displayRole |
| 前端共享行为 | N/A：无 UI | N/A | N/A | 无 |
| 候选/下拉数据源 | N/A | N/A | N/A | 无 |
| 编码与名称呈现 | TR-10 中文 README | review：CHIEF/VICE/PRIMARY/SECONDARY 含义不互换 | UI 文案不在本包 | README/HANDOFF |
| 会同时坏的东西是否已声明为原子组 | 本文 §4/§9a | 每组同 CP focused + red | runtime role command；port method；包依赖三处；test owner 接线分别原子 | P0、P1、P2、P5 四组 |

## 4 · 精确类型、状态与公开面

### 4.1 根公开面：17 项

```text
DisplayContextEligibility
DisplayMode
DisplayRole
DisplayRoleChangeReasonCode
createDisplayContextModule
dependencyModuleNames
devDependencyModuleNames
getDisplayRoleChangeEligibility
getSwitchInstanceModeEligibility
moduleName
powerStatusChangedCommand
resolvePowerRoleTarget
resolveSurfaceDisplayMode
resolveWorkspace
selectDisplayRole
switchDisplayRoleCommand
switchInstanceModeCommand
```

`moduleKind` 只从 `src/moduleName.ts` 导出供 graph-model 解析，不从根导出。startup command、action、slice、
actor、bridge、错误定义和 timeout 常量全部私有。

### 4.2 类型

```ts
export type DisplayRole = 'CHIEF' | 'VICE'
export type DisplayMode = 'PRIMARY' | 'SECONDARY'

export type DisplayRoleChangeReasonCode =
  | 'allowed'
  | 'master-instance'
  | 'managed-secondary'
  | 'missing-display-route'
  | 'multiple-physical-displays'

export type DisplayContextEligibility =
  | Readonly<{allowed: true; reasonCode: 'allowed'}>
  | Readonly<{
      allowed: false
      reasonCode: Exclude<DisplayRoleChangeReasonCode, 'allowed'>
    }>
```

需求草案只列了前四个 reason；`multiple-physical-displays` 是 v1 已裁定的 count guard 必需结果，
不是产品新语义。端口非 succeeded 与畸形数据不伪装成 eligibility：它们保留 `PortResult` 的 status/reason，
由 actor 转为本包 AppError/typed diagnostic。

### 4.3 slice

```text
name=kernel.base.display-context.display-role
state={displayRole:'CHIEF'|'VICE'}
persistIntent=owner-only
persistence=[field displayRole, protection plain, flushMode immediate]
syncIntent=isolated
```

reducer 只接受私有 `setDisplayRole` action；非法 payload 静默不写作为深度防御，但 actor 必须在发 action 前校验。
`selectDisplayRole` 对缺 slice 或非法值抛程序员错误，不用默认 CHIEF 掩盖模块装配缺失。

### 4.4 五个纯函数

```ts
resolveSurfaceDisplayMode({displayIndex: 0|1, displayRole, instanceMode}): DisplayMode
resolveWorkspace({instanceMode, displayRole}): 'MAIN'|'BRANCH'
getDisplayRoleChangeEligibility({currentRole, targetRole, instanceMode, routeDisplayMode, displayCount}): DisplayContextEligibility
getSwitchInstanceModeEligibility({targetMode, routeDisplayMode, displayCount}): DisplayContextEligibility
resolvePowerRoleTarget({powerSource, instanceMode, displayRole, displayCount}): DisplayRole | null
```

规则顺序固定：

1. `resolveSurfaceDisplayMode`：`displayIndex===1` 优先 SECONDARY；否则 `VICE && SLAVE` 为 SECONDARY；其余 PRIMARY。
2. `resolveWorkspace`：仅 `SLAVE+CHIEF` 为 BRANCH，其余 MAIN。
3. 任何目标 VICE/SLAVE：先缺 route，再 secondary，再 multi-display；display-role 额外拒 MASTER。
4. VICE→CHIEF 在 SLAVE 允许；目标模式 MASTER 的 instance 切换仍拒 secondary route。
5. power：仅 SLAVE 且 count===1；external+CHIEF→VICE，battery+VICE→CHIEF；unknown/其余返回 null。

## 5 · 跨包前置设计

### 5.1 runtime post-commit command（取代 D-5）

新增 root export `runtimeInstanceModeChangedCommand`，同时删除 `RuntimeRoleChangeEffect` root export，
runtime 公开面保持 63。command 属 runtime、`internal/local/allowNoActor:false`，payload 在定义文件内具名但不 root export：

```ts
type RuntimeInstanceModeChangedPayload = Readonly<{
  previousMode: RuntimeInstanceMode
  nextMode: RuntimeInstanceMode
}>
```

固定顺序：校验 payload → 读 previous → 幂等直接返回 → 记录 requested → 写 runtime role slice → 记录 changed
→ `await` 派发 changed child command → 检查 child status → 返回 `changed:true`。changed child 使用包内私有
5 秒 timeout，严格短于父 set-mode 的 60 秒默认预算；因此慢消费者以独立 `timed-out` lifecycle/ledger
结果结束，父 actor 仍能在角色已提交后返回 `changed:true`。该 5 秒是 post-commit 通知的内部失败预算，
不是对业务命令的延迟承诺。

child 非 completed 时不回滚已经提交的 role，也不把父命令谎报为“没改”；它有独立 lifecycle/ledger，父 actor
另写结构化诊断。unexpected reject 同样被捕获并诊断，父结果仍只陈述 role commit。README 必须写明这不是跨 slice 原子事务。

request-ledger 不再是 effect；runtime 内部 actor 监听同一 changed command并清 `previousMode` half。
display-context 的 `RoleChangedActor` 是第二个消费者。禁止并发监听原始 set-mode command。

由于父 command started 在旧 half、child 在新 half，ledger upsert 必须令 request `startedAt` 取已有与新 observation
的最小值。focused case 必须证明新 half 最终含父子链、root 仍是父命令、旧 half 已清。

### 5.2 模块资源登记

`RuntimeModuleContext` 从 9 项增至 10 项：

```ts
registerResource(cleanup: () => void): () => void
```

它只是把 `createRuntimeLifecycle` 已持有的 registry 转交给模块，不新建 registry、不建 production shutdown。
电源桥需要一个**模块实例级、可幂等撤销**的登记点；因此采用新增 `registerResource`，而不是把
`install` 返回值加宽为 cleanup。后者表面少一个 context 成员，却会把 cleanup 的所有权变成 install
调用方的隐式约定：当前 `RuntimeModule.install` 返回值没有生命周期消费点，runtime 也没有 stop/dispose
路径去统一调用它，测试 release 仍需另造一套“收集 install 返回值”的机制，既不能覆盖多个资源，也不能保证
模块卸载与 runtime registry 同一顺序。`registerResource` 直接复用已有 registry，保持唯一资源所有权，
是本阶段较小的可执行方案。

runtime invariant 与 public type fixture 同步。电源桥注册的同步 cleanup 会立即使本地 bridge inactive，并调用
async `unsubscribePowerStatus`；Promise 必须带 success/non-succeeded/reject 三支处理，禁止 unhandled rejection。
`PortResult.status === 'timed-out'` 与 `failed`、`unavailable` 一样进入非 succeeded 诊断分支，必须保留原始
status/reason/capability，不得压成 generic failure。test-only release 只证明调用已发起及本地资源失活，
不升格为 native unsubscribe 完成证明。

### 5.3 platform-ports

```ts
export interface DisplayInfo { readonly displayCount: number }

interface DevicePort {
  getDisplayInfo(input: DeviceCall): Promise<PortResult<DisplayInfo>>
}
```

`displayCount` 是已连接物理屏数，含内置物理屏，不含虚拟屏和投屏；合法值为有限正整数 `>=1`。
TypeScript 的 `number` 不证明合法范围，三个 actor 都必须运行期验证。

platform-ports invariant：public 124→125，DevicePort methods 5→6。默认实现精确返回
`unavailable/device/getDisplayInfo/ADAPTER_NOT_INJECTED`。checker 已双读 invariant，无需改 checker 本体。

## 6 · 命令、actor 与三条 VICE 写路径

### 6.1 模块形态

- 本包自有 command 4：三个 root command + 私有 `validateHydratedDisplayRoleCommand`。
- actor 5：switch-display-role、switch-instance-mode、power-status、validate-hydrated-role、runtime-role-changed。
- slice 1：display-role。
- module factory 声明 `kind:'owner'`、精确 dependencies、commands/definitions、actors/definitions、slice/registration、install。

### 6.2 实时屏数调用

私有常量 `displayDeviceTimeoutMs=1000`，同时用于 get/subscribe/unsubscribe；不扩 factory 配置。
`1000ms` 是**私有实现预算，不是产品、端口或架构契约**：目的只是在 runtime startup/install 内把设备调用变成
有界等待，默认 unavailable 实现会立即返回；当前没有 Android adapter 延迟证据可把某个数值升格为事实。
测试只断言三类调用统一使用同一个私有具名预算，不断言“1000 是业务真理”；原生实现出现实测证据时可在不改公开面
的前提下调整该常量。

| 路径 | 调用点 | non-succeeded | 畸形 succeeded | count>1 |
|---|---|---|---|---|
| switchDisplayRole → VICE | actor handle 内，判 route 后、写前 | AppError，状态不写 | AppError，状态不写 | eligibility reject，状态不写 |
| powerStatusChanged（任何 source/当前 role） | actor handle 内，每条命令新调；target 只能在拿到 count 后计算 | typed no-change + logger | typed no-change + logger | typed no-change |
| hydrate 恢复 VICE | startup actor handle 内 | 写 CHIEF + typed diagnostic | 写 CHIEF + diagnostic | 写 CHIEF + diagnostic |

需求中“三种情况一律不改状态”只适用于运行期命令两路；startup 的安全方向已裁定为 CHIEF，不能套用该句。

### 6.3 public command 语义

`switchDisplayRoleCommand` payload `{displayRole}`。目标 VICE 才实时读端口；CHIEF 不需要设备屏数。
rejected 分支抛本包 AppError，使 command status 为 error。成功/idempotent actor result 均含
`changed/previousRole/currentRole/persistenceStatus`。

`switchInstanceModeCommand` payload `{instanceMode}`。actor 先做 route/count 准入，再派 runtime internal
`setRuntimeInstanceModeCommand`，options 固定继承父 requestId、routeContext，parentCommandId=当前 commandId、target=local。
这个**提交前**的第一跳 child 非 completed 时父 command error；不得把 runtime internal command 改 public。
它与上文已提交 role 后的 `instance-mode-changed` child 失败语义不同，后者只记录诊断而不改写父结果。

`powerStatusChangedCommand` payload `{powerSource:'external'|'battery'|'unknown'}`，internal。无变化是“事件已处理、
业务未切换”，actor result 显式 `changed:false` 与 reason，不冒充角色已变。

### 6.4 startup validation

runtime 当前顺序为 hydrate/create store → create dispatcher/actor registry → `runInstall` → initialize → started。
因此 `createDisplayContextModule.install` 固定：

1. `await context.dispatchCommand(validateHydratedDisplayRoleCommand,{})`；
2. 若 command 非 completed，install 失败，runtime 不得 started；
3. 校验完成后才安装电源订阅，避免事件与恢复态竞争。

startup actor 当前 CHIEF 时不调端口；当前 VICE 时实时调端口。单屏保留；多屏、畸形、非 succeeded 改 CHIEF，
记录 typed diagnostic。发生写入后 `await context.flushPersistence()`；失败不回滚内存安全值，actor result 与日志写明
`persistenceStatus:'failed'`，使下次启动继续纠正。启动测试必须悬起 port Promise，证明 `runtime.start()` 未先 resolve。

### 6.5 runtime role changed actor

监听 runtime-owned changed command。只有 `previousMode!==nextMode` 时把 displayRole 重置 CHIEF；幂等返回不写。
它不监听原始 set-mode，且 runtime 拒绝/幂等时 changed command 不发。

## 7 · 电源桥

私有 bridge closure 持有：

```text
lastPowerSource: 'external'|'battery'|'unknown'|null
subscriptionId: string|null
active: boolean
dispatchTail: Promise<void>
unregisterResource: (()=>void)|null
```

安装：startup validation 完成 → subscribe。首事件只写 last；同值 return；跃迁先更新 last，再把 command 追加到
`dispatchTail`。必须串行，避免 external→battery 快速连续时两个 actor同时读到旧 role，最终错误停在 VICE。
listener 是 void 签名，因此 Promise 由 tail 显式 catch 并结构化记录，禁止 `void` 丢失异常。

subscribe 非 succeeded：install 仍成功，不存 id、不派命令，记录 status/reason/capability。成功后保存 id并登记 cleanup。
cleanup 先 `active=false`、原子取空 id、清本地引用；无 id幂等 return；有 id只调用一次 unsubscribe，并处理所有结果。
release 后新 event 与尚未开始的 queued task均跳过。已开始的 command 不声称可取消。

## 8 · 四道门、测试与 red fixtures

### 8.1 四道门

新建 `tools/terminal-display-context/check-static.mjs` 与 `.test.mjs`：

| rule | 真实树判据 | 定向 red mutation |
|---|---|---|
| `display-context-public-surface` | root exports 精确 17 | 加 unexpected root export；只本门 FAIL |
| `display-context-owner-kind` | moduleKind symbol 为 owner、1 slice、slice name 归 moduleName | 改 moduleKind 为 toolkit；只本门 FAIL |
| `display-context-restart-positive` | invariant required test id 在测试 AST 中存在 | 删除/改名跨 runtime 正向 case；只本门 FAIL |
| `display-context-no-display-index-in-slice` | DisplayRoleState 与 initial state 精确只有 displayRole | 加 displayIndex；只本门 FAIL |

第三门只证行为用例没有从分母消失，不能表述为重启行为 machine PASS；真正行为由 vitest 证明。

### 8.2 focused tests：固定 55 条

| 组 | 数量 | 必须覆盖 |
|---|---:|---|
| D 派生 | 8 | §2.3 七行 + MASTER/VICE 坏状态 |
| W workspace | 4 | 2×2 穷举 |
| E eligibility | 9 | display 5；instance route/count 4 |
| P power pure | 5 | external、battery、unknown、MASTER、multi-display |
| A actors | 14 | switchRole 4；switchInstance 4；power 3；roleChanged 3 |
| B bridge/install | 8 | seed、dedupe、transition、burst order、unavailable/rejected subscribe、onError、release（含 failed/timed-out/unavailable/rejected unsubscribe）、idempotent release |
| R restart/sync | 5 | 单屏保 VICE、双屏/invalid/unavailable纠 CHIEF、isolated sync skipped |
| T type/module | 2 | public surface typecheck；4 commands/5 actors/1 slice exact |

每条有正断言和反断言，不以“不抛”作业务 oracle。actor cases 同时观察端口次数、command status/actor result、最终 slice。

### 8.3 关键行为 red controls

- 删除 surface 派生第三输入分支，D 组坏状态红；
- 三条 VICE 路径分别改为复用缓存 count，各自 focused case 红；
- startup dispatch 去掉 await，悬起 port case 红；
- bridge 去 seed、去 dedupe、去 tail，各自对应 case 红；
- unavailable 被当成 count<=1，switch/startup 两域各自红；
- role changed 改为监听原 set command，“runtime 拒绝不重置”红；
- module 不登记 `registerResource`，或 test-only release 重复执行 cleanup，resource release case 红；
- 持久写不 await flush，两 runtime共享 storage case红。

### 8.4 TER-local 接线

display invariant `owned.test` 从 ABSENT 改 REAL_TESTS；package test 用共享 runner，vitest
`passWithNoTests:false`，tsconfig 覆盖 test。`verify-static` 注册 checker model+real 两项；verify/test fixture 同步。
预期 test owners 从 9→10、REAL 4→5、NO_TEST 保持 5。仓级 normal verify 不运行、不改语义。

## 9 · operation/path/face/集合形态

本包无 HTTP path、consumer face 或分页集合。operationId 不进入 runtime 文件名；命令名全部能力命名。

## 10 · 跨 owner 写矩阵

| policy | 第一个 owner command | 第二个 owner command | 事务 | 失败事实 |
|---|---|---|---|---|
| 切 instanceMode | display public switch-instance | runtime internal set-instance-mode | 两条 command、无跨 slice原子事务 | 第一跳失败不发第二跳；第二跳失败由父 command error |
| role commit 后通知 | runtime set-instance-mode | runtime internal instance-mode-changed | post-commit，不回滚已提交 role | child 独立 error + 父诊断；父仍陈述 role 已提交 |
| 电源事件写 displayRole | display internal power-status-changed | N/A | 单 owner actor | no-change/port失败进入 typed result/诊断 |

## 11 · 声明—传递—消费矩阵

| fact | declaration | transfer | consumption | proof |
|---|---|---|---|---|
| displayIndex | Root Surface props，0\|1 | pure function input/routeContext投影 | `resolveSurfaceDisplayMode` | 8 cases；slice static exact |
| displayRole | owner slice | selector/纯函数 | surface mode/workspace/actors | actor+restart tests |
| displayCount | platform `DisplayInfo` | live PortResult | 三个 actor | call count + malformed tests |
| runtime role changed | runtime internal command | runtime dispatcher | ledger actor + display actor | post-commit parent/child case |
| power event | DevicePort callback | bridge→internal command | power actor | seed/dedupe/burst/end-state |
| typed failure | PortResult/AppError | command result/logger | caller/review | exact key/status/reason assertions |
| cleanup | runtime module resource registry | test-only release | unsubscribe port | one-call/idempotent tests |

## 12 · 规则 → owner 判定点

| 规则 | owner 判定点 |
|---|---|
| surface mode 三输入 | `resolveSurfaceDisplayMode` |
| workspace 组合 | `resolveWorkspace` |
| 手切 role 准入 | switch-display actor + eligibility pure function |
| 切 instance 准入 | switch-instance actor + eligibility pure function |
| power target | power actor + pure function |
| hydrate 安全 | startup actor |
| role flip reset | runtime changed command + RoleChangedActor |
| persistence/sync | display slice descriptor |

## 13 · owner API 与消费者

| API | 消费者 |
|---|---|
| three commands | 后续 UI/automation；power command 由私有 bridge |
| five pure functions | ui.base.render（后续）与本包 actors/tests |
| selectDisplayRole | 本包 actors与后续 UI |
| createDisplayContextModule | assembly/runtime module list |
| DisplayInfo/getDisplayInfo | display-context 三个 actor；当前唯一消费者 |
| runtimeInstanceModeChangedCommand | runtime ledger actor、display RoleChangedActor |

零调用者的 rich display 字段、selectDeviceDisplayMode、effect/callback 接缝全部不建。

## 13a · 实施前全链同步变更清单

| 事实 | 契约/唯一源 | owner/edge | UI | tests | fixture/seed | 结论 |
|---|---|---|---|---|---|---|
| role changed command | runtime command definition | runtime actor/ledger + display actor | N/A | runtime/display focused | N/A | 同步修改 |
| display count | platform device.ts | platform→display edge | N/A | platform/display focused | fake DevicePort | 同步修改 |
| displayRole | display slice | runtime module | future only | restart/actors | shared memory storage | 同步修改 |
| module kind/deps | moduleName+skeleton graph | package/dependencies.ts | N/A | graph/static | N/A | 同步修改 |
| test ownership | terminal-invariants | shared runner/verify-static | N/A | verify fixtures | N/A | 同步修改 |

## 13b · 变更定位与文件清单

所有定位使用唯一 symbol/JSON key，不使用行号。

**runtime 前置新增**：role changed command、request-ledger role actor。

**runtime 前置修改**：role actor、internal module、createRuntime、module types、lifecycle、test resource registry、index、
terminal invariant、role/ledger/lifecycle/type tests、README、HANDOFF；删除 request-ledger role effect。

**platform-ports 修改**：`types/device.ts`、unavailable device、index、invariant、default/type tests、README。

**display 新增**：types；slice；4 command files；5 actor files；derivation/eligibility；selector；power bridge；module factory；
7 test files；vitest config；README；HANDOFF。

**display 修改**：package、tsconfig、index、moduleName、dependencies、invariant。

**仓内接线修改**：skeleton graph、yarn lock、new checker、verify-static、verify tests。

## 14 · 数据迁移、seed、验收边界

数据迁移：N/A。新 owner-only field 从无到有，旧安装无 key 时默认 CHIEF；不写兼容层。

seed：N/A。终端本地角色不是 DEV 业务 seed；不得借本批执行 reset/seed。

HTTP/browser/device acceptance：N/A。v1 只用 fake DevicePort + 两 runtime 内存 storage 闭环；不得宣称 Android、
Gradle、native subscription、生产 route 盖章或用户端到端已证明。

## 15 · 未决项与已知边界

| 项 | 状态 | 本批允许 | 本批禁止 |
|---|---|---|---|
| transport activation guard | UNVERIFIED_REQUIRES_EVIDENCE / deferred | HANDOFF 登记 | 替 transport 预造契约 |
| Android device adapter | 不在本批 | fake port 测 JS 链 | native/Gradle/设备主张 |
| routeContext 来源可信 | 后续 UI 接缝 | 测本包判定 | 宣称生产不可伪造 |
| batch1 VICE 跨重启 | 已知受 unavailable 纠 CHIEF | README/HANDOFF 诚实登记 | 伪装已支持 |
| role 变更留痕跨重启 | runtime journal 当前不持久 | HANDOFF 单列 | 宣称审计可跨重启 |
| 生产电源订阅释放路径 | 未提供 Runtime stop/dispose；生产依赖进程退出回收订阅 | HANDOFF 登记该欠账；test-only release 只证明本地失活与调用发起 | 不得宣称生产 unsubscribe 已完成；后续 teardown 设计须另行补齐 |
| async native unsubscribe 完成 | 未证明 | 证明调用发起与本地失活 | 升格为 native cleanup PASS |
| onApplicationReset | 本模块不定义；reset 已重建 state 且不重跑 runInstall，避免重复订阅 | README/HANDOFF 写死不新增对称重订阅钩子 | 不得借 reset 增加第二条订阅路径 |

没有待 Dexter 裁定的产品项。本文对需求的两点实施性修正是：补
`multiple-physical-displays` reason；把“命令失败不写”与“startup 失败纠 CHIEF”分域。二者均来自已裁定规则，不改变产品范围。

## 16 · 停机条件

命中任一条即停止实施并回报：

1. 仍准备保留/实现 `roleChangeEffects` 或 D-5 action-array effect；
2. 需要 runtime 依赖 display-context，或让 platform-ports 定义 command；
3. role changed command 在 runtime role 写入前派发；
4. 无真实 resource registration 却声称电源订阅可释放；
5. 需要新增依赖、公开导出或端口字段超出本文 exact set；
6. 任一 VICE 写路径无法在写前获得 fresh port result；
7. startup validation 不能位于 hydrate 后、initialize/started 前；
8. bridge 无法按接收顺序串行 transition；
9. red fixture 不红、同时红多门、或真实树不绿；
10. test owner 分母不是 10/REAL5/NO5；
11. 需要修改 transport/UI/adapter/native/assembly 生产源码；
12. 需要实施 deferred activation guard；
13. 需求、本文、项目记忆出现互斥且不能由 owning source消解。

## 17 · 人工 review checklist

- [ ] S-6 是否真正取代 D-5，而不是并存两套接缝。
- [ ] runtime role commit、journal、child command 的先后及失败语义是否诚实。
- [ ] 三条 VICE 写路径是否各自实时取 count；startup 是否单独纠 CHIEF。
- [ ] power bridge 是否 seed、dedupe、串行、release；无悬空 Promise。
- [ ] slice 是否只有 displayRole；displayIndex/displayCount/displayMode/workspace 无镜像。
- [ ] 17 exports、4 commands、5 actors、1 slice 是否 exact。
- [ ] typed diagnostic 是否保留 PortResult status/reason/capability，且无敏感 raw payload。
- [ ] required 55 tests 是否观察真实 actor/end state，而非只测纯函数。
- [ ] 四道门的机器主张是否没有越界成业务语义证明。
- [ ] README/HANDOFF 是否只登记 activation、native、route trust、batch1 restart 等真实欠账。
