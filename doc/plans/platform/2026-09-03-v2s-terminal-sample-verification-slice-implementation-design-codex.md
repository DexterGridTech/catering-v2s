SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# TER sample 验证切片 implementation-facing 详设（v13 重做与 D-6 修订）

## 0. 元数据与授权

~~~text
BUSINESS_SOURCE=doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-requirements-claude.md
JOURNEY_REFS=SAMPLE-MEMBER-REGISTRATION；需求 §4.1、§6.2-§7.2、§9.2-§11.1
IA_REF=doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-ia-design-codex.md
INTERACTION_REF=doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-interaction-design-codex.md
AUTHORIZED=按 v13 写 IA、交互工件、implementation-facing 详设与实施计划
NOT_AUTHORIZED=任何源码/测试/依赖改动；DEV、seed、L2、UAT、部署、Git
IMPLEMENTATION_AUTHORITY=false
REVIEW_CYCLE_ID=2026-09-04-TER-SAMPLE-VERIFICATION-SLICE-DESIGN-03
REVIEW_TARGET=DESIGN
AUTHORING_REVIEW_STATUS=V13_S1_S2_REVISED_PENDING_INDEPENDENT_REVIEW
~~~

本详设按 v13 从空白重建，不继承 v11/v12 的六包图、精确依赖白名单、预挂载异步屏数协议、单 Provider 双 Surface 或已作废的 design OPEN。当前只授权写文档；D-6 的 carrier spike 另需 Dexter 授权。

## 1. 真实业务目标与方案比较

### 1.1 结构性问题

七个 TER 包虽然各自通过，但没有真实 runtime、ui-state module、catalog 和 render 的组合。继续用手搓 root、memory storage、unavailable device 会把“业务包拿不到 command、变量和实时屏数”隐藏成假绿；双屏启动和重启持久化也不会被验证。

本批以门店会员登记为真实旅途：店员登录，查看/录入会员，顾客在副屏确认后才写入 members。实施后必须回答需求 §1.1 的框架完整性、简单健壮性和开发加速问题；本详设不预先伪造这些观察结果。

### 1.2 方案比较

| 方案 | 结果 | 结论 |
| --- | --- | --- |
| A：sample-console 手搓 root、内存存储、不可用 device | happy path 可跑，但屏数和持久化永远未验证，且业务绕过真实接缝 | 拒绝：会产生假绿 |
| B：把 displayCount 写进 display-context slice，actor 读缓存，assembly 自己协调 mount | 违背 display-context 正式约束，缓存实时事实，Web/Android 形状不同 | 拒绝：owner 和事实地址错误 |
| C：单一 assembly；kernel/UI 各自 owner；Web 两 Provider；Android adapter 负责 D-6 约束下的双屏启动周边与 initialProps；三 adapter 实建 | 同一业务 actor 通过不同端口运行，并把 Web 和真机验证分段；carrier 本身不由文档假定 | **采用** |

我选了 C 而不是 A/B，因为 C 在正确 owner 补能力，不把完整 store、缓存或临时宿主形态当作最终设计。

### 1.3 明确不复活的形态

不建立装配层的 screen-mode helper，不建立 screen count slice，不建立 display event bridge，不新增 localWebServer/双机/热插拔；单机双屏、真实 device.getDisplayInfo、真实 persist-kv 属于本批。

## 2. 包图与运行时组合

### 2.1 交付角色全集

| 包 | 角色 | 处置 | 依赖方向 |
| --- | --- | --- | --- |
| kernel/feature/sample-staff-session | session owner、slice、actor | 新建 | contracts、state、runtime |
| kernel/feature/sample-member-registry | member owner、slice、selector、actor | 新建 | contracts、state、runtime |
| ui/feature/sample-staff-auth | 登录、notice、auth variables | 新建 | `ui-state`、`render`、`runtime`、`state`、`kernel/feature/sample-staff-session` |
| ui/feature/sample-member-desk | 列表、表单、副屏、desk variables | 新建 | `ui-state`、`render`、`runtime`、`display-context`、`state`、`kernel/feature/sample-staff-session`、`kernel/feature/sample-member-registry` |
| ui/integration/sample-console | 单一 assembly、catalog、test-expo | platform-console 改名 | sample features 与 base/runtime 能力 |
| assembly/android/sample-terminal | Android 端口表 | pos-desktop 改名 | 五个 adapter、platform-ports、sample-console |
| adapter/android/dual-screen | 双屏启动周边、displayId、initialProps（carrier 待 D-6） | 仅登记周边规格；D-6 收口后实建 | platform-ports、contracts |
| adapter/android/device | 真实 getDisplayInfo | 实建该方法 | platform-ports、contracts |
| adapter/android/persist-kv | Kotlin MMKV | 实建 | platform-ports、contracts |

骨架节点由 22 增到 27：增加四个 sample feature 节点、一个可复用 Web 开发宿主节点，三个既有 adapter 骨架转真实交付角色。交付角色九个，不是新增九个图节点。

UI feature 的依赖表必须写到真实包名，不能用 `kernel` 泛称掩盖边：两个 feature 使用 `state.StateJsonValue` 贯通组装描述/props 的类型契约，并分别消费自己的 kernel owner 命令、结果与 selector；`sample-member-desk` 直接消费 `display-context` 的屏数读取契约，`sample-staff-auth` 不直接消费该包。public requestId 与 request 观察由 render 的 `dispatchWithRequestId`、`useTrackedRequest`、`useRequestInFlight` 单点承担，feature 不再直接 import `contracts`。实现后的 `package.json`、依赖图与 import 必须逐项与此表对账，不能以“kernel 能力”作为替代证据。

### 2.2 方向规则

允许且仅允许的方向是 kernel ← ui、kernel ← adapter、kernel ← assembly、ui ← assembly、adapter ← assembly。反向由 P-5a 机械门拒绝；同层关系由 P-5b 的 J-1/J-2/J-3 review，不称为架构原则。

### 2.3 单一 assembly

sample-console 唯一公共入口：

~~~ts
createSampleAssembly(input: {
  platformPorts: PlatformPorts
  persistenceKey?: string
}): Promise<SampleAssembly>

type SampleAssembly = Readonly<{
  runtime: Runtime
  createSurface(displayMode: DisplayMode): ReactElement
}>
~~~

闭包一次性持有 runtime、冻结的 ui catalog、renderer catalog、stateSource、dispatchCommand 和绑定当前 UiStateModule 实例的 selectUiVariable reader。调用方不能拆成多个 factory。

input.modules 的九项是 contracts descriptor、platform-ports descriptor、state descriptor、display-context、ui-state、两个 kernel feature、两个 ui feature。createRuntime 自动加入 kernel.base.runtime，最终十项。createRuntime 构造阶段完成依赖校验，缺 descriptor 不推迟到 start。

### 2.4 v13 依赖收口：sample-terminal 不增加 display-context 边

v13 已将 D-B 与 §2.5.4／§6.8 对齐：`sample-terminal` 只依赖五个 adapter、`platform-ports`、`sample-console`，共七条；不增加 `display-context`。D-B 的「装配层多知道一个 display-context 无所谓」立场保留为背景，但其原前提「宿主必须 await 查屏数」已因屏数经启动参数送达而作废，因此不再是本批依赖。

Android 屏身份由 dual-screen adapter 的 Kotlin launch options／JS 启动 props 送达，assembly 不判断屏数。这里的 `initialProps` 是需求对 JS 侧归一化输入的称呼；实现时需对齐当前注册组件入口的真实 props 接缝，不凭 POC 的独立进程或独立 React 实例形态推断 carrier。D-6 只阻塞单 VM／单 store／多 Root Surface 的具体承载与 native 接线；不得添加无消费者的依赖来消除已收口的数字。

## 3. CP 总览

| CP | 主题 | owner | 输出 | 依赖 |
| --- | --- | --- | --- | --- |
| CP-0 | v13/IA/交互/记忆/owning source 复读 | 主 agent | 事实分母与变更清单 | 无 |
| CP-1 | workspace globs 与 layering checker | governance | 两类 glob、真实 checker、skeleton 接线 | CP-0 |
| CP-2 | sample-console/sample-terminal 全量 rename | package owners | 活动文件、工具、图、清单、入口统一 | CP-0 |
| CP-3 | render、display-context、ui-state 接缝 | framework owners | W-7、W-9、W-11 | CP-0 |
| CP-4 | 两个 kernel feature | kernel owners | slice、command、actor、selector、descriptor | CP-1 |
| CP-5 | 两个 ui feature | ui owners | parts、variables、module、actors | CP-3、CP-4 |
| CP-6 | sample-console 与 Web 外壳 | integration owner | assembly、catalog、双 Provider、test-expo | CP-2、CP-5 |
| CP-7 | dual-screen/device/persist-kv | adapter owners | 三个真实 adapter；dual-screen carrier 另受 D-6 闸门 | CP-1、CP-3 |
| CP-8 | sample-terminal 端口与 native 接线 | assembly owner | 端口表、入口；native 双屏接线在 D-6 收口后完成 | 非 native 子项：CP-2、CP-6、CP-7 的 device/persist-kv；native 子项另需 D-6 resolved |
| CP-9 | Web 第一段 | validation owner | 场景、S/P、Web 持久化 evidence | CP-6 |
| CP-10 | 真机第二段 | validation owner | S-27/S-28/S-29 与双屏复验 | CP-9、CP-8 native wiring completed、D-6 resolved、受管真机授权 |
| CP-11 | 全批三维对账与交付 | 主 agent + fresh reviewer | 需求/设计/记忆/源码/证据读回 | CP-10 |

每个 CP 完成后先做步骤级三维对账，再进入下一 CP；全部 CP 后再做一次全批对账。不存在旧分区先迁、再补泛型的中间态。

CP-7 的 device 与 persist-kv 子项可以按其自身前置推进；dual-screen 子项只能记录六项承载周边规格，不能选择 carrier 或开始 native 接线，直到 D-6 的真机 spike 已获单独授权并证明单 VM／单 store／多 surface。CP-8 的端口表与入口子项可按其自身前置推进；其 native 双屏接线子项必须保持在 D-6 收口之后，不得用前者的完成替代后者。

## 4. Framework 设计

### 4.1 display-context

在 apps/terminal/kernel/base/display-context/src/foundations/displayDevice.ts 的现有实现上公开 readDisplayInfo、DisplayInfoRead、resolveSecondarySurfaceAvailable。DisplayInfoRead 三态为 valid、unavailable、malformed；纯函数四分支只有 valid 且 displayCount >= 2 为 true，其余为 false。

公共契约只承诺分类与 unknown-to-single，不把当前 private displayDeviceTimeoutMs=1000 升为公共数值契约。若必须公开时间上限，停下来交 Dexter。

每次相关 actor 命令都实时 await readDisplayInfo，再调用纯函数；不缓存、不加 slice、不加 command。宿主挂载决策另读一次，不能复用 actor 读数。

### 4.2 render

RenderProvider 的 stateSource 为窄只读三件套：

~~~ts
{
  getStatus: () => RuntimeStatus
  getState: () => Root
  subscribe: (listener: () => void) => () => void
}
~~~

另注入窄 dispatchCommand 和 module-bound selectUiVariable；不暴露/调用 getStore、store.dispatch、dispatchAction、useDispatch，
也不从 runtime import 完整 `Runtime`／`createRuntime`。Provider 的 root 类型保持本地结构类型，不能以 Runtime 类型别名穿透 toolkit 边界。
公共面由原 16 收口为 21：`useDispatchCommand`、`useUiVariable` 以及 render 单点 request helpers `dispatchWithRequestId`、`useRequestInFlight`、`useTrackedRequest` 均纳入 exact set；更新 index、README、invariants 和对应 red vector。

getSnapshot 先读 status；非 started 不调 getState，返回本 Provider 稳定的 unavailable snapshot；started 才读 root；相同 status/root 引用返回相同 snapshot。useUiStateSelector 缓存键含 root 引用与 selector 身份，selector 必须是 root 纯函数。每个 Provider 的 reader、snapshot cache、diagnostic Map 都由实例级 memo 产生。

### 4.3 ui-state reader

不改 ui-state。createUiStateModule 已按 declaration identity 校验注册事实，并在 state value 不存在时返回 declaration default。sample-console 只绑定 module 实例的方法注入 render；不得用 state key 是否存在替代注册校验。

### 4.4 catalog/layer

definePart 输出 partKey、rendererKey、binding，精确三键；自有 layerTier 省略物化 standard，自有 undefined 拒绝。UiCatalogEntry 的 ownKeys 精确集合保留，containerKeys 可空，displayModes/workspaces/instanceModes 非空。layerTier 只在 render；integration/assembly 不保存具体 partKey。

## 5. Kernel feature

### 5.1 staff session

slice：

~~~ts
{ status: 'anonymous' | 'authenticated'; operatorName: string | null }
~~~

owner-only、isolated。bootstrapSessionCommand 为 internal；loginCommand/logoutCommand 为 public；领域结果拆成 loginSucceededCommand、loginFailedCommand、logoutSucceededCommand、sessionRestoredAuthenticatedCommand、sessionRestoredAnonymousCommand。install 派 bootstrap 时生成 requestId，因为 bootstrap actor 会派 public 子命令。登录失败不写 authenticated，request 失败；成功才写 session。

### 5.2 member registry

slice：

~~~ts
{ members: readonly Member[]; pending: { name: string; phone: string } | null }
~~~

owner-only、isolated。submitMemberCommand、confirmMemberCommand、rejectMemberCommand 为 public；对应 memberPendingCommand、memberConfirmedCommand、memberRejectedCommand 为领域事件命令。confirm 无 pending 抛错；memberId/registeredAt 只能 actor 生成。

仅导出 selectMembers(root) 与 selectPendingMember(root)。UI 只经 selector 跨包读，不裸读字符串 slice。

## 6. UI feature

### 6.1 共同组装描述

两个 ui/feature 各导出：

~~~ts
{
  parts: readonly DefinePartResult[]
  variables: readonly UiVariableDeclaration[]
  createModule: (input: UiFeatureModuleInput) => RuntimeModule
}
~~~

auth variables：sample.login.operator-name 为 owner-only，sample.login.passcode 为 never。desk variables：sample.member.name、sample.member.phone 均为 never。kernel 不声明 uiVariable。

### 6.2 staff auth

parts：sample.auth.login 使用 main、PRIMARY；sample.auth.notice 使用空 containerKeys、PRIMARY、alert。登录部件经 useUiVariable 和 useDispatchCommand 工作；auth actor 监听 loginFailed、loginSucceeded、logoutSucceeded、sessionRestoredAuthenticated/Anonymous；notice actor 只监听本包 authNoticeDismissedCommand。reasonCode 从 event 显式透传到 notice props。

### 6.3 member desk

parts：member-list、member-form 使用 main/PRIMARY；waiting-confirm 使用空 containerKeys/PRIMARY/standard；registry-notice 使用空 containerKeys/PRIMARY/alert；customer-welcome 使用 main/SECONDARY；customer-member 使用 main/PRIMARY+SECONDARY，props 只有 mode=preview|confirm。

desk actor 监听领域事件和本包呈现命令；需要屏数差异时实时读取 display-context 三件套。部件不按屏数分支、不决定显示屏、不生成业务 id。confirm/reject 为两个独立 public command。

## 7. Integration、host 与 adapter

### 7.1 sample-console

一次 assembly 收集两个 UI feature 的 parts/variables，真实调用 createUiCatalog，创建 renderer catalog、ui-state module、display-context 和四个 sample module，再创建并启动 runtime。createSurface(displayMode) 从闭包取得所有依赖，resolve 时 status 已 started。

`sample-console/test-expo/App.tsx` 只保留本包配置适配：把 `createSampleAssembly`、`terminalSurfaces`
与运行时状态 reader 注入 `ui.base.dev-host` 的 `createTestExpoApp`。通用宿主由
`apps/terminal/ui/base/dev-host/src/testExpoApp.tsx` 持有：`surfaceMode` 状态、由该状态返回
1/2 的 DevicePort、按状态挂一/两棵树、`terminalSurfaces` canvas、切换按钮、Web 真实持久化、
状态摘要与启动日志。一个 React root 下两个兄弟 RenderProvider；每实例 reader/reporter 独立；
切换不重建 runtime。`ui.base.dev-host` 同时提供可复用的 Web PlatformPorts 与真实
`StateStoragePort` 适配，宿主不导入任何 sample 业务包。

terminalSurfaces 只在 sample-console/package.json 声明：

~~~json
{
  "terminalSurfaces": {
    "layout": "column",
    "scaleToFit": true,
    "surfaces": {
      "PRIMARY": { "width": 1920, "height": 1080 },
      "SECONDARY": { "width": 1024, "height": 600 }
    }
  }
}
~~~

库侧读取自身配置并导出 typed const，通用宿主不二次解析；Android 不读该字段。外层 flex 只
负责排布，surface 保持声明的固定逻辑尺寸，内部业务部件自行使用 primitives 的相对布局。

### 7.2 sample-terminal

只保留一张端口表：logger 为 console binding；persistKv 为 persist-kv；device 为 device；其余 persistSecure、appControl、script、connector、hotUpdate、logUpload、topologyHost 均按 v13 绑定 unavailable port，其中 `topologyHost=unavailableTopologyHostPort`。dual-screen adapter 只负责本批单机双屏启动周边、initialProps/display facts，不实现或绑定 TopologyHostPort。assembly 不判断屏数、不读尺寸、不写 bootstrap、不依赖 display-context。

### 7.3 dual-screen/device/persist-kv

dual-screen 的 carrier 未由本详设选择，登记为 D-6 `OPEN-DUALSCREEN-SINGLE-VM-CARRIER`，必须经过一次另行授权的真机 spike。carrier 无论最终形态如何，都必须同时满足以下六项周边规格：

1. 主 Activity 创建时调用启动器；`displays.size < 2` 直接 return；
2. 选择 `displayId != DEFAULT_DISPLAY` 的目标屏；
3. 已有副屏实例时幂等 return，启动失败回滚已请求标记并允许后续重试；
4. Kotlin 同步读取并传递 `displayIndex`（主屏 0、副屏 1）与实际 `displayCount`；
5. 主屏与副屏使用同一已注册组件，`registerRootComponent`／`AppRegistry` 注册保持同步、一行不改；
6. 不引入 `localWebServer` 或其他 port 来承载本项。

POC 的 `android:process=:secondary` 与自建 React 实例均被否定，不得照抄；同进程 Presentation 只有在复用同一 ReactHost／ReactSurface 且实证单 VM／单 store 时才可作为候选。若 spike 证明当前 Expo/RN 只能第二 VM、独立进程、独立 store 或独立 React 实例，停止并交 Dexter，不得自行降级继续。

device 只实现真实 DevicePort.getDisplayInfo。异常/超时/坏形状由 readDisplayInfo 分类。

persist-kv 在 Kotlin 使用 `com.tencent:mmkv` 提供的 MMKV，按 persistenceKey 隔离。v13 没有冻结具体版本；CP-7 实施前必须从当前 Android Gradle/version catalog 与官方兼容性资料解析并记录实际版本，无法证明兼容时停止交 Dexter，不得预先硬编码或另钉一个未经批准的版本。StateStoragePort 只有字符串边界；用版本化类型 envelope 区分 null、boolean、number、string、object，以及 null 与字符串 "null"；禁止 String(value)，不加 JS MMKV。

## 8. 横切机制对照表

| 机制 | ① 现成能力/规范 | ② 可执行观察与最低档 | ③ 无现成时形态 | ④ 本批全集 |
| --- | --- | --- | --- | --- |
| 读侧节点授权 | TR-03、owner selectors、stateSource | static 搜索无裸 slice；focused selector 返回真实 members | owner 纯 selector | members/pending、runtime root |
| 写授权与 grant 复核 | TR-01/TR-02、Runtime command actor | focused：部件只调用窄 dispatch，失败不成功 | owner actor 承接 public command | login/logout/submit/confirm/reject |
| 跨 owner 写与事务 | 单 store command/event；无 DB | focused：跨包只经领域 event | N/A：无 DB 事务 | staff→ui、registry→ui |
| 集合形态与分页 | Redux members slice | focused 覆盖空、多行、长列表 | readonly array，无分页 | members |
| 缓存失效/改完刷新 | Runtime.subscribe/useSyncExternalStore | focused 两 Provider 同时更新 | store subscription，无 query cache | session/members/pending/variables/surfaces |
| RTK 数据读取与加载判定 | render request selector | focused loading 与重复点击 | N/A：无 Query currentData/isFetching | login/submit |
| 同一事实只有一个住址 | 两个 owner slice、四变量、catalog | static/focused 不复制 members/文案 | 沿用各 owner | session、members、variables、catalog |
| 失败可见且原因不得改写 | TR-02、reasonCode、两诊断族 | focused reason 可见，raw error 不出现 | 类型族分离 | auth/registry/render |
| owner 错误到 HTTP 映射与注册处 | N/A：无 HTTP | N/A | N/A | 全部 sample |
| 幂等键与重放 | Runtime requestId、createRequestId | focused public 缺 id 抛错，launcher 重复无第二实例 | requestId 是 ledger identity | public commands/bootstrap/launcher |
| 生成物不得手搓字符串 | defineCommand/definePart/package exports | static + red mutation | 使用 creator/typed config | commands/parts/module/config |
| 日志与脱敏 | AGENTS.md；注入 logger | static/focused 不记录 password/token/raw payload | logger 字段白名单 | auth/registry/render/native |
| 迁移回填与可逆性 | StateStoragePort/MMKV envelope | focused kill/reopen 与五类值 | 无 DB migration；版本 envelope | persist-kv |
| 前端共享行为 | render Provider/SurfaceRoot | static 不在 feature 重造 provider/store | 复用 render hooks | six sample packages |
| 候选/下拉数据源 | N/A：无候选 | N/A | N/A | 全部 sample |
| 编码与名称呈现 | IA/交互工件、catalog/variables | static 文案不进 state/action/persist | 声明处保存文案 | login/notice/member |
| 同时坏的东西是否原子组 | 单一 assembly、charter §5-C | static change surface + focused assembly | 单一闭包、CP 原子 | rename/framework/sample/adapters |

## 9. 声明—传递—消费矩阵

| fact | declaration | transfer | consumption | proof |
| --- | --- | --- | --- | --- |
| displayMode | createSurface、part displayModes | Provider/SurfaceRoot 与 placement 显式传递 | render selector、actor target | S-1/S-4/S-6/S-11/S-16、P-9 |
| container 准入 | UiCatalogEntry.containerKeys | definePart→createUiCatalog→selectAvailableParts | main 过滤，空仅 layer | S-14/S-15 |
| 屏数 | DevicePort→readDisplayInfo | Android/test-expo binding→actor | resolveSecondarySurfaceAvailable | S-13a/b/S-16/S-17/S-18/S-27/S-28 |
| runtime status/root | Runtime.status/getState/subscribe | stateSource→Provider | snapshot status gate | S-14/S-24 |
| variable registration | UI declaration→ui-state registry | module reader→Provider | useUiVariable default/value | S-5/S-8/S-19 |
| session/member facts | owner slices→events | kernel→UI actor | list/form/customer | S-2/S-3/S-6/S-7a/S-11/S-22 |
| failure reason | owner event payload | event→notice props | reasonCode mapping | S-2/S-7b/S-14 |
| request identity | createRequestId | control/install→dispatcher | ledger loading/failure | S-20/S-22/S-23/P-11 |
| logical sizes | sample-console package.json | typed const→test-expo | canvas/layout/scale | S-26/P-14 |
| initialProps | Kotlin LaunchOptionsFactory | D-6 carrier→same registered component | display identity | S-27；D-6 收口后 |
| persisted type | persist-kv envelope | StateStoragePort string→MMKV | restart readback | S-12/S-29 |
| diagnostics | logger + two diagnostic families | resolve→reporter | runtime vs part | S-14/S-24 |

## 10. 业务规则与 owner 判定

| 规则 | 判定点 |
| --- | --- |
| 登录成功才认证 | staff-session login actor |
| 登录失败不改 session | login actor failure branch |
| pending 未确认不入 members | registry submit/confirm actor |
| 无 pending confirm 抛错 | registry confirm actor |
| 结果必须拆命令 | command creators and event actors |
| 业务 id 只能 owner 生成 | registry confirm actor |
| layer-only 不入 main | ui-state selectAvailableParts |
| 屏数未知单屏 | display-context pure function |
| public 命令带 requestId | visible dispatch points/install exception |
| logout 两个 mode 清层 | authNav 与 deskNav |
| 双 Provider 独立且共享 store | test-expo harness |
| 五类值重启保持类型 | persist-kv envelope |

## 11. owner API 与消费者

| API | 消费者 |
| --- | --- |
| selectMembers/selectPendingMember | sample-member-desk list/customer parts |
| readDisplayInfo/resolveSecondarySurfaceAvailable | desk actors、test-expo mount、display focused tests |
| useUiStateSelector | sample UI parts |
| useUiVariable | auth login、desk form/customer |
| useDispatchCommand | login/logout/add/submit/confirm/reject/dismiss controls |
| createSampleAssembly | sample-terminal 与 test-expo |
| SampleAssembly.createSurface | test-expo 与 registered Android component |
| terminalSurfaces typed const | test-expo |
| dual-screen launcher | sample-terminal native host |
| device getDisplayInfo | sample-terminal device binding |
| persist-kv StateStoragePort | sample-terminal persistKv binding |

不存在只声明不消费的本批 API。

## 12. 全链同步变更清单

| 事实 | 唯一源/契约 | 消费者 | 测试与配置 | 结论 |
| --- | --- | --- | --- | --- |
| 两个 rename | workspaces、package/app/module、graph、tools、invariants、bootstrap | package imports/runner | 新旧名静态扫描、typecheck | 全量同步；历史 docs 不改 |
| feature globs | root workspaces | verify/runner | workspace resolution | 同批修改 |
| render 16→21 | index、README、invariants | sample UI hooks 与 request helpers | public exact-set + focused red | 同批修改 |
| display-context 17→20 | index、README、invariants | actors/device | public exact-set + focused red | 同批修改 |
| ui-state reader | createUiStateModule identity registry | integration injection | S-19 no owner source change | 复用，不改 |
| kernel/UI facts | feature declarations | catalog/runtime/actors | unit/integration S/P | 同批新增 |
| terminalSurfaces | sample-console package.json | typed const/test-expo | S-26/P-14 | 同步 |
| Web persistence | test-expo StateStoragePort | S-12 | refresh fixture | 真实实现，非 Map |
| three Android adapters | adapter contracts/Kotlin | sample-terminal | S-27/S-28/S-29 | 真机专属分别验 |
| layering checker | tools/terminal-layering + skeleton verifier | 27 nodes/sample sources | model/red vectors | 与 sample 同批，不建空壳 |
| test collection | sample-console vitest/tsconfig/script/invariants | runner | ts/tsx collection | 新建接线 |

## 13. 验收设计

每条 active S 与机械 P 都必须有能使对应行为或门失败的 red mutation。业务行为与生产源码约束改生产源码且不改夹具；纯静态 AST 模型门（本轮 P-5d，覆盖 ui/feature、ui/base/dev-host 与 ui/integration/sample-console）在一次性临时夹具上变异，证明 detector 能识别真实语法形态，当前生产树清洁另行证明，不能把两类证据合并。每条先 baseline control，再确认 focused test 收集数非零，最后 control 绿/negative 红；临时夹具由测试负责清理。P-5b/P-7/P-8/P-9 的 review 不由机器门代替。

### 13.1 S 分母

实际为 31 条：S-1 至 S-6；S-7a/S-7b；S-8/S-9/S-10/S-11/S-12；S-13a/S-13b；S-14 至 S-23；S-24 至 S-29。关键映射如下：

| 组 | proof |
| --- | --- |
| S-1…S-9 | 真实场景 1–9；S-9 先制造两个 displayMode 的残留 layer |
| S-10/S-11 | 真实 assembly/runtime/ui-state/catalog/selectScreen，禁止 mock |
| S-12 | Web refresh 与 Android kill/reopen，必须真实持久化 |
| S-13a/b | 十个 binding 的全 unavailable 单屏矩阵与仅 device=2 双屏矩阵，不能合并 |
| S-14…S-19 | 五 fallback、三 layer-only part、屏数纯函数、module reader identity |
| S-20…S-23 | dispatch/requestId、selector identity、TR-02、loading/in-flight |
| S-24…S-26 | 两 Provider、Web shell toggle、logical surface size/layout |
| S-27…S-29 | 只在真机验证 D-6 carrier、真实 device、MMKV；S-27 另验同一 JS VM／store |

### 13.2 P 分母

P-1、P-3、P-4、P-5a、P-5b、P-5c、P-7、P-8、P-9、P-10、P-11、P-12、P-13、P-14 为 active；P-2 已撤回，P-6 因无事件桥 N/A。P-5a 是方向门，P-5b/P-7/P-8/P-9 是 review，不得混报。

### 13.3 跨包真实性

S-10/S-11/S-19 真实调用 createSampleAssembly、createRuntime、ui-state module、两个 catalog 与 selector。只 mock ui-state 或 runtime，或 mutation 只让 ui-state 测试红而 sample-console 不红，都判调用链未成立。

### 13.4 operation / path / face / collection

本批不是 HTTP/API 交付，不新增 operationId、method/path、x-consumer-faces 或后端集合接口。为防止把无 HTTP 误读成漏填，按模板完整记录：

| 业务意图 | operationId | method/path | consumer face | 集合形态 | 预期规模与增长驱动 |
| --- | --- | --- | --- | --- | --- |
| 门店会员登记 sample | N/A_WITH_REASON | N/A_WITH_REASON：单一 runtime/store 内存旅途，无 HTTP | public terminal sample | members 为 readonly array；无分页 | acceptance 至少覆盖空、两条及长列表；增长由确认成功事件驱动 |
| runtime command | N/A_WITH_REASON | N/A_WITH_REASON：Runtime command 不映射 HTTP | public terminal sample | request ledger 为单 request 记录 | 每个 public command 一个 requestId；由旅途动作增长 |

### 13.5 跨 owner 写矩阵

本批没有数据库事务；跨 owner 事实通过 command/event 边界传递，不由 UI 直接写 slice。

| policy | 第一个 owner command | 第二个 owner command | 事务 | 失败时回滚事实 |
| --- | --- | --- | --- | --- |
| 认证 | loginCommand → staff-session actor | loginSucceeded/loginFailed event → UI actor | N/A：单 Redux dispatch，不是 DB 事务 | 失败不写 authenticated，request 标 failed |
| 会员登记 | submitMemberCommand → registry actor | memberPending event → desk actor | N/A：单 Redux dispatch | submit 失败不写 pending |
| 顾客确认 | confirmMemberCommand → registry actor | memberConfirmed event → desk actor | N/A：单 Redux dispatch | 无 pending 抛错，members/pending 不变 |
| 顾客拒绝 | rejectMemberCommand → registry actor | memberRejected event → desk actor | N/A：单 Redux dispatch | 不写 members，pending 清理由 owner 定义 |

### 13.6 验收场景四要素

下表是 implementation-design-template 的四要素分母；行为断言必须读真实字段或副作用，不能以 exit code 或 response.ok 代替。

| scenario id | owner 文件/符号 | identity | fixture | request | businessOracle |
| --- | --- | --- | --- | --- | --- |
| S-1…S-9 | sample-console integration behavior test | session state、surface placement、layer roster | 真实 assembly、匿名/认证/双屏 device binding | login/add/submit/confirm/reject/logout commands | screen/layer 的真实 part placement、session、members/pending |
| S-10/S-11 | sample-console assembly test | runtime.status 与 module descriptor/真实 selectScreen | 九项 input.modules、两 catalog、真实 ui-state | createSampleAssembly + showScreen | started、descriptor 全集、placement 字段 |
| S-12 | sample-console persistence test；adapter persistence test | persistenceKey 与 refresh/kill-reopen | Web 真实 storage；Android MMKV | 写入 owner facts 后重启 | members/operator-name 保留；passcode/登记变量消失 |
| S-13a/S-13b | sample-console display matrix test | 十 binding 组合 | 全 unavailable/memory；仅 device=2 | 创建 assembly 后执行对应旅途 | single/dual 分支与不崩降级 |
| S-14…S-19 | render/display-context/ui-state integration tests | fallback key、partKey、DisplayInfoRead、declaration identity | 坏 catalog、坏 props、四态 device、default-only/forged declaration | resolve/render/read | 五种 distinct fallback、四分支结果、reader identity |
| S-20…S-23 | render/sample-console behavior tests | requestId、selector identity、ledger status | public command 控件与 pending request | dispatch command / selector update | actor 承接、failed ledger、引用缓存、无重复 request |
| S-24…S-26 | render/sample-console Web tests | Provider identity、shell state、logical surface config | 一个 React root、两个 Provider、resize/toggle | store change / shell toggle | 两侧重渲染、订阅回收、runtime/member 保留、尺寸比 |
| S-27…S-29 | dual-screen/device/persist-kv tests | displayId、initial props、MMKV namespace | 真机单/双屏、kill/reopen、五类值 | launcher/device/storage operations | surface 数量/目标屏、真实 displayCount、同一 JS VM／store、类型不变 |

### 13.7 数据迁移与 seed 设计

| 迁移 | 加/改什么 | 旧行回填取什么值 | 为什么唯一 | 可否回滚 |
| --- | --- | --- | --- | --- |
| PostgreSQL migration | N/A：本批无数据库 | N/A | 无 server schema | N/A |
| MMKV envelope version | 新 adapter 的存储格式 | 不对旧数据库回填；本批 clean namespace | v13 明确采用新的 string-only adapter 边界，不能猜旧值 | 只允许按版本明确拒读/清理；不得加 raw-string fallback |

seed 全集：

| seed 文件 | 本批为什么受影响 | 处置 |
| --- | --- | --- |
| N/A | acceptance sample 自带 fixture，不提供 DEV 业务种子 | 不创建、不执行 seed；不把 fixture 写进别域 seed plan |

### 13.8 证据边界

源码/文档静态检查可证明目录、依赖方向、public exact set、禁止字面量与 test collection 配置；focused test 可证明 selector、command、catalog、Provider 和 envelope 的行为；Web acceptance 不能证明 Android launchDisplayId、真实 getDisplayInfo 或 MMKV；真机 acceptance 不能代替 Web shell toggle。三类 evidence 分开交付。

## 14. UI/L2、迁移、seed 与停机

~~~text
UI_DESIGN_REVIEW=NOT_APPLICABLE_WITH_REASON:本批只写设计，不创建 L2
TESTID_REVIEW=NOT_APPLICABLE_WITH_REASON:交互工件列出 testID，但真实动作节点尚未实施
L2_SCRIPT_ADMISSION=BLOCKED
~~~

本批无 HTTP、PostgreSQL migration 或 DEV seed；acceptance fixture 与 seed 不混淆，reset/seed 不授权。Web persistence 与 Android MMKV 分别在对应段验证。

必须停机的情况：需要恢复旧白名单、需要 screen count slice/event bridge、D-6 未收口、spike 只能形成第二 VM/独立进程/独立 store/独立 React 实例，或 Presentation 无法复用同一 ReactHost／ReactSurface、公共接缝与需求不容、S-10/S-11 只能 mock、或需要决定 flex/absolute 等未决产品语义。D-2/D-3/D-4 是已登记非阻塞欠账，不因它们暂停详设。

## 15. 完成状态

~~~text
DESIGN_STATUS=READY_FOR_INDEPENDENT_STATIC_REVIEW
IMPLEMENTATION_AUTHORITY=false
~~~

详设完成后必须由 fresh independent subagent 按本 cycle 先盲审；作者只做辩证 intake，不代写 reviewer verdict。实施后再以 IMPLEMENTATION review 重开真实源码与业务 evidence。
