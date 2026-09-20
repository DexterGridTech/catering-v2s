# TER Admin console 非登录区 implementation-facing 详设

```text
DESIGN_STATUS=READY_FOR_REVIEW_WITH_ADMISSION_BLOCKERS
REVIEW_TARGET=DESIGN
IA_ACCEPTANCE=DEXTER_CONFIRMED_2026-09-20
BUSINESS_SOURCE=doc/plans/platform/2026-09-19-ter-admin-console-non-login-requirements-codex.md
JOURNEY_REFS=doc/plans/platform/2026-09-19-ter-admin-console-non-login-requirements-codex.md#3-用户旅途分析;#4-需求条目;#5-业务语义与事实边界;#7-后续IA详设必须回答的问题;#8-需求级验收性质
IA_REF=doc/plans/platform/2026-09-19-ter-admin-console-non-login-ia-frame-inventory-codex.md;doc/plans/platform/2026-09-19-ter-admin-console-non-login-ia-high-fidelity-codex.md
INTERACTION_REF=doc/plans/platform/2026-09-19-ter-admin-console-non-login-requirements-codex.md#3-用户旅途分析
AUTHORIZED=编写本批非登录区 implementation-facing 详设、实施计划与 Claude review handoff
NOT_AUTHORIZED=修改源码、修改测试、修改依赖、构建、Web/Metro/Android/device/DEV/L2/UAT、reset/seed/deploy、release、Git
IMPLEMENTATION_AUTHORITY=false
INDEPENDENT_DESIGN_REVIEW=COMPLETED_FINDINGS_OPEN_REVIEWED_BY_FRESH_SUBAGENT
ADMISSION_BLOCKERS=DISPLAY_FACTS_OWNER;TOPOLOGY_PAGE_AVAILABILITY_AND_DIRECT_PAIR_OWNER;MASTER_UNPAIR_GUARD
```

本文件是 IA 的实现翻译，不另造第二套视觉或用户旅途正本。frame inventory 是用户旅途、可见内容、状态、文案和动作的语义正本；high-fidelity IA 是同一 IA-ID 的位置、尺寸、形状、颜色、图标、字体和视觉 token 正本；本文件只冻结 owner、数据传递、组件公共面、订阅边界、失败形态、代码落点和实施顺序。任何与 IA-ID、用户文案、状态数量、角色动作或 current/non-current surface 边界冲突的实现，必须先修设计/IA，不得由实施者择一。

## 0. 设计输入、事实与授权边界

### 0.1 本批真正解决的问题

当前 Admin console 把四个内部 part 直接当作用户页面：`runtime` 与 `display-context` 重复暴露，平台端口按平面列表展示，拓扑页把资格、身份、地址、服务、配对和底层失败混在一起。用户因此无法在最短路径回答三件事：

1. 哪些平台能力可用，哪些不可用，问题属于哪一类；
2. 当前终端运行是否正常，以及主屏/副屏各自是什么状态；
3. 当前机器是否能做双机拓扑、自己应选择主机还是副机、下一步是什么。

本批把用户面收口为三个页面，同时保留内部 part/catalog 的兼容结构：平台端口、运行状态、双机拓扑。它不改变 feature 页面、不改变 runtime/kernel/topology 的既有业务语义，不把 raw slice 变成 UI API。

### 0.2 当前源码中已经确认的事实

| 事实 | 当前 owning source | 对本设计的影响 |
| --- | --- | --- |
| 内部仍有 `runtime` 与 `display-context` 两组 laptop/mobile parts | `apps/terminal/ui/base/admin-shell/src/parts/parts.ts` | 不能靠删除 part 改造用户导航；必须建立 user page registry，把两组事实合并为一个运行状态 page。 |
| 当前手机导航是可换行 tab 集合 | `apps/terminal/ui/base/admin-shell/src/components/AdminSectionNavigation.tsx` | 必须替换为一个固定在 header 下方、纵向页面内唯一的真实下拉 selector；不能继续把 tab 换行。 |
| `PrimitiveSelect` 当前按 press 循环下一个 option，`expanded` 固定为 `false` | `apps/terminal/ui/base/primitives/src/components/PrimitiveForms.tsx`、`src/types/types.ts` | 不把它伪称为 dropdown；新增 `PrimitiveDropdownSelect`，保留 `PrimitiveSelect` 旧语义。 |
| `RenderRuntimeFacts.platformPortCapabilities` 已提供能力单位快照 | `apps/terminal/ui/base/render/src/types/runtimeFacts.ts`、`apps/terminal/kernel/base/platform-ports/src/types/platformPorts.ts` | 端口摘要在 admin-shell 做纯 presentation projection；每个 capability 或一个 synthetic undeclared unit 是一个分母单位。 |
| `DisplayInfo`/`DisplayInfoRead` 公开面只有 `displayCount` | `apps/terminal/kernel/base/platform-ports/src/types/device.ts`、`apps/terminal/kernel/base/display-context/src/foundations/displayDevice.ts` | IA 要求的逐 surface 逻辑/物理尺寸不能由当前 UI 推导；必须有 display-facts owner，否则 CP-0 停。 |
| Android adapter 已在日志中记录更丰富的显示值，但 public port 丢弃它们 | `apps/terminal/adapter/android/device/android/src/main/java/com/catering/v2s/terminal/adapter/android/device/TerminalDeviceModule.kt` | 日志不是 UI 数据源；不得直接读日志、复制 current surface 或补算另一块屏。 |
| topology capability 有 snapshot、operation eligibility、query、pair、unpair、host enable，但没有 page-level availability，且 pair 需要 identity | `apps/terminal/kernel/base/contracts/src/types/topology.ts`、`apps/terminal/kernel/base/topology/src/foundations/createTopologyAdminCapability.ts` | 必须增加 owner 级 page gate 与 direct-pair capability，UI 不可用 representative operation reason 拼整页 gate。 |
| 主机解绑资格允许但 actor 前置读取错误字段 | `apps/terminal/kernel/base/topology/src/foundations/evaluateTopologyOperation.ts`、`apps/terminal/kernel/base/topology/src/features/actors/actors.ts`、`apps/terminal/kernel/base/topology/src/selectors/selectTopologyFacts.ts` | `selectTopologyFacts` 在 MASTER+peerIdentity 时可得 paired，但 unpair actor 当前只检查 `masterLocator`；CP-0/CP-1 必须先修正为 paired 事实并验证清理集合，否则 IA-24/25/26 不可达。 |
| `switch-role` 在 union 中但没有 capability command，evaluator 也没有专门分支 | `apps/terminal/kernel/base/contracts/src/types/topology.ts`、`evaluateTopologyOperation.ts` | 不画 switch-role 按钮；该值在 action matrix 中标为资格-only，直到 owner 有真实 command。 |
| 两个 integration 各自拥有 theme/global.css 与 Tailwind mapping | `apps/terminal/ui/integration/sample-console/theme/global.css`、`sample-wallpaper-console/theme/global.css` 及各自 `tailwind.config.cjs` | shared primitive/admin-shell 只消费 semantic token；两个 integration 同时提供 token，数值差异由主题 owner 决定。 |
| Android 两个 app 的 Tailwind 配置继承 `assembly/base/android/config/index.cjs` 的 `sharedColors` | `apps/terminal/assembly/android/sample-terminal/tailwind.config.cjs`、`sample-wallpaper-terminal/tailwind.config.cjs`、`apps/terminal/assembly/base/android/config/index.cjs` | admin token 的实现分母必须包含两份 global.css、两份 integration Tailwind 和 Android sharedColors；不能只改 integration 就宣称 Android 完整。 |

### 0.3 不重新打开的 IA 裁定

- laptop 与 mobile 都保留 panel/header/close；mobile 是竖屏单列，不是 laptop 的换行版。
- mobile 只有一个固定的下拉 selector；不出现第二个 selector，不出现横向 tab 集合。
- panel 内用户页是平台端口、运行状态、双机拓扑三页；内部 `runtime` 与 `display-context` 不再各自成为用户入口。
- topology tab 永远显示。mobile 只显示“当前功能不可用”和“mobile 形态不支持双机拓扑”，不显示角色、IP、配对、解绑或恢复动作。
- laptop 单屏才允许拓扑旅途；双物理屏显示“当前功能不可用”和“**双机拓扑要求本机只有一个物理屏**”。
- 主机入口是“开启主机服务”，副机入口是输入主机 IP 后“直接配对”；查询身份不是用户步骤。
- 主机和副机都可以主动解除配对；解绑完成后回到目标选择；不新增 `SLAVE-RECOVERY` 页面。
- current surface 显示权威逐 surface 事实；non-current surface 只显示存在性、主副角色和“该屏信息未提供”，不能补逻辑/物理尺寸、就绪或物理状态。
- surface 矩形按该 surface 的权威逻辑宽高比绘制；逻辑长/高写在矩形内，物理长/高写在矩形外；缺失数字位置写“未知”。

### 0.4 需求正本与已确认 IA 的一致口径

需求 R-9/J-2、frame inventory 与 high-fidelity IA 已按同一裁定收敛：当前 surface 显示权威逻辑/物理分辨率与就绪/可用状态；非当前 surface 只显示真实存在性、主/副角色和“该屏信息未提供”，不显示分辨率或就绪状态；任何 surface 都不得复制另一块的值。此前需求中的对称文字已在需求 §1.4 记录为文档漂移并修回。

IA 正本优先级固定为：frame inventory 负责语义字段、状态、文案、动作和旅途；high-fidelity IA 负责同一 IA-ID 的几何与视觉 token。两者如再冲突，必须先修 IA 并保持 CP-0/CP-3 `OPEN`，实施者不得自行择一。

## 1. 真实业务目标与方案比较

### 1.1 方案比较

| 方案 | 结果 | 结论 |
| --- | --- | --- |
| A. 继续把 catalog 中的四个 section 直接画成四个 tab，只换样式 | 实现小，但 runtime/display-context 重复、mobile 仍会产生过多 tab，用户要自行合并事实。 | 拒绝：不满足 R-1/R-8，也违背已确认 IA。 |
| B. Admin shell 直接订阅 topology/display/private slice，自行算 gate、角色和 display 事实 | 页面看起来可以快速闭环，但 raw state、owner 判定和 UI 会出现三份逻辑，副机/双屏/掉线时会漂移。 | 拒绝：违反 R-12/R-16/TR-03，且无法证明事实来源。 |
| C. Admin shell 建立三页 registry；页面只消费 owner read model/capability；shared primitives 提供视觉组合 | 保留内部 part/catalog 兼容面，用户页聚合明确；owner 仍决定资格、状态和动作；laptop/mobile 共享语义而各自布局。 | **采用。** |
| D. 两个 integration 各复制一套 admin shell | 能局部调样式，但导航、拓扑动作、错误语言、订阅和 testID 会分叉。 | 拒绝：违反共享 admin-shell 与 R-5。 |

我选了 C 而不是 A/B/D，因为它把“用户页面聚合”放在 admin-shell，把“事实与动作资格”留在既有 owner，把“视觉重复”放在 primitives/theme；这条边界同时覆盖两个 integration、两种形态和后续 feature part 注入。

### 1.2 逐事实的替代方案

#### Display facts

| 方案 | 结论 |
| --- | --- |
| 从 `SurfaceContextValue` 当前值复制出第二块 surface | 拒绝；没有第二块权威事实，直接违反 R-9/R-20。 |
| 从 Android log、density 或逻辑尺寸推算 physical size | 拒绝；日志不是 public owner，逻辑尺寸不能代替物理尺寸。 |
| 由 display-context owner 暴露逐 surface `DisplayFactsReadModel`，adapter 在边界补齐权威字段 | **采用，但必须在 CP-0 证明 public owner 可安全扩展；未闭合则停机。** |

#### Topology page gate/direct pair

| 方案 | 结论 |
| --- | --- |
| UI 读取 `getOperationEligibility('query-host')` 或 `pair` 的 reason 作为整页 gate | 拒绝；operation-level 条件不能代表 page-level capability，且副机/重连状态会误折叠页面。 |
| UI 读取 raw `TopologyFacts` 自己拼 `mobile`/`displayCount`/`paired` 布尔 | 拒绝；R-12 已禁止 UI 重组资格。 |
| topology owner 暴露 `getPageAvailability()` 和 `pairByHost({host})`，UI 只消费 typed outcome | **采用；这是直接配对且不暴露 identity-query 的最小 owner 变化。** |

## 2. CP 总览

| CP | 主题 | owner | 主要输出 | 依赖 |
| --- | --- | --- | --- | --- |
| CP-0 | 来源、公共面与 blocker admission | 主 agent + display/topology owner | 事实分母、现有消费者清单、owner contract decision、停止/继续判定 | 需求、IA、memory、当前源码 |
| CP-1 | owner read model/capability 公共面 | display-context、topology、render/console assembly | 逐 surface display facts、topology page availability、direct pair contract；若 owner 不能闭合则停在 CP-0 | CP-0 MATCHED |
| CP-2 | shared primitives、semantic recipes、两个 integration theme | ui.base.primitives、sample integrations | dropdown selector、ratio/disclosure/surface-map primitives、admin tokens | CP-0；CP-1 仅在需要 read model 类型传播时 |
| CP-3 | panel frame、三页 registry、订阅与端口/运行状态页面 | ui.base.admin-shell | laptop/mobile shell、三页 user navigation、ports aggregate、runtime+display aggregate | CP-2 |
| CP-4 | topology consumer 与全量 action/state frames | ui.base.admin-shell + topology capability consumer | gate、role choice、host/slave states、direct pair、unpair、failure/recovery | CP-1、CP-3 |
| CP-5 | focused/static 与未来 visual/native/device proof | 主 agent | 代码/详设/IA 对账、测试与后续设备证据清单 | CP-2–CP-4；本次未授权执行 |

CP-1 是硬 admission gate。当前源码尚未提供 display facts 与 topology page-level availability/direct-pair 的公共面，因此本详设允许写出精确 contract 和停机条件，但不把它们伪装成“已有能力”。

## 3. 横切机制对照表

| 机制 | ① 现成能力/规范 | ② 如何验证 | ③ 无现成时的形态 | ④ 本批适用全集 |
| --- | --- | --- | --- | --- |
| 读侧节点授权 | `AdminSectionRenderContext`、`useRenderContext`、`useUiStateSelector`；`terminal-coding-standard.md` TR-03/TR-15 | 静态 import/read-path 检查；focused red mutation 用 raw root selector 替代窄 selector | read model 只由 owner 暴露；admin-shell 不 import private slice | ports/runtime/display/topology/page status |
| 写授权与 grant 复核 | `TopologyAdminCapability`、`AdminSectionCommandBoundary` | focused action matrix：每个按钮只调用 capability/command boundary | 新 `pairByHost` 由 topology owner 复核形态、角色、paired、地址和协议 | host enable/disable、pair、unpair |
| 跨 owner 写与事务 | 本批无数据库/HTTP owner write；topology capability 自带 command dispatch | static 证明 UI 没有 actor/slice/transport import；focused 检查 command 次数 | N/A；不得新增 UI side effect store | topology actions |
| 集合形态与分页 | 内存有限集合；`PrimitiveList`/controlled disclosure | focused 证明 unit 分母守恒、分类有限展开、无客户端分页伪造 | port units 为 flat finite list，category rows 为固定五类；不得使用无限滚动 | port capabilities、surface ≤2、topology single state |
| 缓存失效 / 改完刷新什么 | topology snapshot selector 与 render context identity | focused command 完成后 read model 重新读取；不维护镜像 facts | owner command result 是反馈，不是第二份长期 state | topology actions、panel status |
| RTK 数据读取与加载判定 | N/A；TER admin 不使用 RTK Query | static 标记 N/A | 继续使用 runtime status/read model，不引入 RTK | 全部 |
| 同一事实只有一个住址 | topology owner snapshot/page model；display-facts owner；`RenderRuntimeFacts` 只保存 immutable diagnostics | static 检查页面不复制 source；focused mutate raw facts 入口应失败 | 新 presentation model 只能是纯 projection，不持久化事实 | port/display/topology/panel |
| 失败可见且原因不得改写 | `TopologyFailureReasonCode`/`topologyReasonMessages`、typed owner read model | focused 各 reason 渲染状态灯+文字+下一步；未知 reason fail closed | 新 page reason 必须 typed、带稳定用户文案，不能在 component 维护散落 map | topology、panel、display missing |
| owner 错误到 HTTP 的映射与注册处 | N/A；不新增 HTTP edge | static N/A | N/A；UI 不创建 endpoint | 全部 |
| 幂等键构成与重放语义 | topology capability 内部 `requestId`/command dispatch | static 证明 UI 不生成第二套 request id；focused 重复点击只触发一次 | 若 owner API 新增 direct pair，仍由 capability 生成 requestId | topology actions |
| 该用生成物的地方不得手搓字符串 | 无 generated API | static N/A | N/A | 全部 |
| 日志落点与脱敏字段 | `AGENTS.md` observability；现有 admin logger events | focused/source readback 检查 action start/complete/fail；日志不得有 password、raw IP、token、payload | UI 日志只记 page/action/status/reasonCode；地址只在屏幕呈现，不入日志 | topology actions、navigation |
| 迁移回填与可逆性 | N/A；不改数据库 | static N/A | N/A | 全部 |
| 前端共享行为(Drawer/列表/表单生命周期) | 本批使用 `ui.base.primitives`；无 web Drawer | static primitive ownership；focused selector/disclosure lifecycle | primitive controlled，page owner 保持展开选择；不在 primitive 保存业务事实 | panel/navigation/ports |
| 管理后台交互一致性 | IA frame inventory/high-fidelity；登录框既有 theme/geometry；R-3/R-4/R-17/R-18 | 每个 IA-ID 对照 testID、文案、位置、形态、状态、动作；设备视觉后续单独验 | 详设新增元素必须先新增 IA-ID，不得“实现时顺手加” | IA-01–IA-29、IA-32 |
| 候选/下拉数据源 | catalog page registry；host IP 是用户输入 | focused selector options=三页；topology host input 不查询候选 | `PrimitiveDropdownSelect` 只消费 registry options；不提供远端身份下拉 | mobile selector、topology IP |
| 编码与名称呈现 | `admin-shell` page spec 与 topology typed mapping | static 检查 internal enum 不直出；focused unknown/error fallback | 内部 `MASTER/SLAVE/CHIEF/VICE/TOPOLOGY_*` 通过单一 mapper 转中文 | all pages |
| 会同时坏的东西是否已声明为原子组 | 本详设 §9a/§13c；charter §5-C | 对账表逐组核对 contract→render→test/theme | owner public surface、primitive public surface、page registry、theme aliases 必须同批 | CP-1–CP-4 |

### 3.1 订阅边界

| 页面 | 只订阅的事实 | equality/identity | 明确不订阅 |
| --- | --- | --- | --- |
| platform ports | `runtimeFacts.platformPortCapabilities` | assembly 已冻结数组；纯 `buildPortOverview` 只在该值变化时新建 projection | topology/display slices、全 root state |
| runtime | runtime status、immutable runtime facts、display-facts read model、当前 surface identity | owner read model stable identity；surface projection 按 `surfaceKey` memoized | topology payload/peer slice、端口细节 |
| topology | topology page availability、topology snapshot、capability identity、当前输入/operation local state | selector 使用现有 equality；page availability 与 snapshot 分开 | display raw slice、platform raw ports |
| panel/header | runtime status、page registry identity、panel status projection | stable page registry constant；status pure projection | 每个页面的全部细节 |

全 root subscription、每次通知构造等价对象、让 ports 页面订阅 topology 或让 topology 页面订阅 display raw state，均是红变异，不得以“功能结果一样”收口。

## 3a. L2/控件前置复核

```text
UI_DESIGN_REVIEW=PASS:IA accepted by Dexter on 2026-09-20; implementation-facing design remains review-pending
TESTID_REVIEW=OPEN_UNTIL_IMPLEMENTATION:IDs frozen below, actual nodes and *TestIds source require focused/static proof
L2_SCRIPT_ADMISSION=BLOCKED:本批未授权 L2；实现后必须先完成 UI/testId 对账
```

本批没有 L2 实施授权，不创建脚本。实现期必须把动作 testID 挂在真实动作节点，而不是外层卡片：

| case/action | 控件与动作 | owning source（计划落点） | 稳定 testID |
| --- | --- | --- | --- |
| 页面切换 | laptop nav item / mobile dropdown option | `ui/base/admin-shell` page registry/navigation | `terminal.admin:page:${pageKey}` |
| 关闭 panel | header close button | `AdminShellFrame` | `terminal.admin:close` |
| 端口展开 | category disclosure row | `PlatformPortsSection` | `terminal.admin:ports:category:${categoryKey}` |
| topology host | host start/stop button | `TopologySection` | `terminal.admin:topology:host-action` |
| topology direct pair | IP input + pair button | `TopologySection` + capability | `terminal.admin:topology:host-ip`, `terminal.admin:topology:pair` |
| topology unpair | unpair button | `TopologySection` | `terminal.admin:topology:unpair` |

## 4. 页面模型、公共面与状态机

### 4.1 User page registry

内部 catalog 不变；用户面使用一个常量 registry：

```ts
type AdminPageKey = 'platform-ports' | 'runtime' | 'topology'

type AdminPageSpec = Readonly<{
  readonly key: AdminPageKey
  readonly title: string
  readonly sourcePartKeys: readonly string[]
  readonly rendererKey: string
}>
```

固定映射：

| `AdminPageKey` | 用户标题 | 现有 source part | 用户 renderer |
| --- | --- | --- | --- |
| `platform-ports` | 平台端口 | `admin.console.platform-ports` | 新 ports overview renderer |
| `runtime` | 运行状态 | `admin.console.runtime`, `admin.console.display-context` | 新 runtime/display aggregate renderer |
| `topology` | 双机拓扑 | `admin.console.topology` | topology renderer |

`admin.console` 仍是 layer frame，不是一个第四 tab；`admin.console.power-confirmation` 仍是 alert layer，不进入 selector。feature part 继续由既有 feature assembly 自己注册，不由本批重写；本批 user page registry 不把 feature part 变成非业务 tab，也不改 feature renderer。

### 4.2 Panel frame

实现只允许使用 IA 已存在的 frame 元素：header、title、overall status、close、laptop nav 或 mobile dropdown、content、empty/loading/error card。header status 的数据由 shell 接收 `AdminPanelStatus`，不能在 `AdminShellFrame` 读取 raw state。

```ts
type AdminPanelStatus = Readonly<{
  readonly tone: 'ok' | 'warn' | 'error' | 'neutral'
  readonly label: string
}>
```

状态显示始终是颜色+文字。`loading`、`empty`、`error` 都保留 panel header/close/navigation；不能因为 content 不可用而隐藏 topology tab。mobile 内容顺序固定为 header → 一个 dropdown selector → page content；laptop 为 header → nav/content row。

### 4.3 Platform ports projection

以 `runtimeFacts.platformPortCapabilities` 展开为 `PortUnit[]`：

```ts
type PortUnitState = 'available' | 'unavailable' | 'undeclared'
type PortUnit = Readonly<{
  readonly unitKey: string
  readonly port: string
  readonly capability: string | null
  readonly state: PortUnitState
  readonly source: string | null
  readonly category: 'logs' | 'device' | 'system' | 'connection' | 'release'
}>
```

规则：有 descriptor 且有 capability 时一 capability 一 unit；缺 descriptor 或空 capabilities 时一 port 一 synthetic `undeclared` unit；不重复计数。分类冻结为五类：

| category | 用户名 | 当前 port 映射 |
| --- | --- | --- |
| `logs` | 日志与诊断 | `logger`, `logUpload` |
| `device` | 设备与显示 | `device` |
| `system` | 系统与存储 | `appControl`, `persistKv`, `persistSecure` |
| `connection` | 连接与拓扑 | `connector`, `topologyHost` |
| `release` | 脚本与更新 | `script`, `hotUpdate` |

缺少归类的新增 port 不得落入“其它”而隐藏；纯函数返回 `unmapped` 并让 focused test 变红，先更新设计/分类表。页面只展示摘要、比例条、五个分类 disclosure；展开后展示该 category 的有限 units、名称、状态、来源/原因。视觉稿示例中的数字不是冻结常量，真实总数由 unit projection 得到。

### 4.4 Runtime/display aggregate

定义 owner 侧的最小 read model（名称是设计 contract，不代表当前已存在）：

```ts
type DisplayFactsReadModel = Readonly<{
  readonly status: 'ready' | 'loading' | 'unavailable' | 'malformed'
  readonly physicalDisplayCount: number | null
  readonly currentSurfaceKey: 'PRIMARY' | 'SECONDARY' | null
  readonly surfaces: readonly Readonly<{
    readonly surfaceKey: 'PRIMARY' | 'SECONDARY'
    readonly displayIndex: number
    readonly present: boolean
    readonly role: 'primary' | 'secondary' | 'unknown'
    readonly logicalSize: Readonly<{readonly width: number; readonly height: number}> | null
    readonly physicalSize: Readonly<{readonly width: number; readonly height: number}> | null
    readonly readiness: 'ready' | 'loading' | 'unavailable' | 'unknown'
  }>[]
}>
```

owner 必须保证 `surfaces` 是真实实际 surface 集合，不是把 current surface 复制成两个对象。presentation projection 再应用 IA 不对称：current surface 可显示 logical/physical/status；non-current 只显示 `present`、role 和“该屏信息未提供”。如果 physical size 为 null，current surface 的长边/高边数字位置写“未知”。surface-map primitive 接收已经投影好的 `SurfaceMapModel`，自己不访问 selector。

矩形宽高比使用该 surface 的权威 `logicalSize.width / logicalSize.height`；不得用固定卡片比例。mobile 的正常模型只允许一块实际 surface；`physicalDisplayCount > 1`、surface 集合超出支持范围或 owner malformed，进入明确的 display facts unavailable/error，不伪造副屏。

### 4.5 Topology owner contract 与用户动作

设计要求 topology capability 增加：

```ts
type TopologyPageAvailability = Readonly<{
  readonly available: boolean
  readonly reasonCode: TopologyFailureReasonCode
}>

type TopologyAdminCapability = Readonly<{
  readonly getSnapshot: () => TopologyFacts | undefined
  readonly getPageAvailability: () => TopologyPageAvailability
  readonly getOperationEligibility: (operation: TopologyOperation) => TopologyOperationEligibility
  readonly pairByHost: (input: Readonly<{readonly host: string}>) => Promise<TopologyAdminCommandResult>
  readonly unpair: () => Promise<TopologyAdminCommandResult>
  readonly setHostEnabled: (enabled: boolean) => Promise<TopologyAdminCommandResult>
}>
```

`queryMasterIdentity`/old `pair(locator)` 是否保留在内部 public surface，要在 CP-0 做全仓 consumer scan；如果仅由 admin section 使用，则替换为 `pairByHost`，不保留无人调用的 public method。`pairByHost` 内部可以查询身份，但查询不是 UI state/action；owner 在同一 command boundary 必须逐项完成并可读回证明：

1. 规范化并校验 host/端口输入，不能把用户输入直接拼成 locator；
2. 在既有 identity/protocol path 内查询对端 identity，校验 integration `moduleName`，stale identity 必须按 typed failure 结束；
3. 校验当前本机仍为 `MASTER` + `CHIEF`、尚未配对、单主单副占位未被占用；这些前置不能由 UI 重复推导；
4. 由 owner 构造完整 locator，在一次 command boundary 内写入 locator/peer identity、切换 `SLAVE`/`VICE` 并启动连接；
5. 任一阶段失败都必须按 phase 返回 typed reason，并验证 locator、peer identity、instance mode、display role 与 repair-pending 的回滚或保留语义；不得留下“看起来已配对”的半状态；
6. 成功与失败都必须有 readback，供 `pairing`、`pair-error` 和后续 `paired/reconnecting` projection 消费。上述每项都要有 focused red mutation，不能只测 `pairByHost` 被调用。

解绑有一个当前源码 blocker：`selectTopologyFacts` 在 MASTER 且 `peerIdentity` 存在时把 `paired` 判为真，但 `unpair` actor 当前只检查 `masterLocator`；因此主机侧资格可用而 actor 会先抛 `Topology is not paired`。owner contract 必须以 typed `paired` 事实作为解绑前置，而不是把 `masterLocator` 当作所有角色的通用 locator 前置；成功后必须清除 `masterLocator`、`peerIdentity` 和 `peerReachable`，并 read back 到 role choice。把守卫恢复成只检查 `masterLocator` 的红变异必须使 MASTER unpair focused test 变红；在该 blocker 关闭前，`IA-24`、`IA-25`、`IA-26` 只可作为已设计但不可实施的状态。

`TopologyOperation` union 的内部覆盖表：`query-host` 保留为 direct-pair 的 owner 内部 identity/protocol 步骤，归类为 `internal-only/资格执行细节`，不生成 IA-ID、按钮或独立状态；`pair` 由 `pairByHost` 替代 admin-facing 调用；`unpair` 覆盖 MASTER/SLAVE 两侧；`enable-host` 覆盖主机服务开关；`switch-role` 当前没有 command，归类为 `non-executable/资格-only`，不得渲染按钮。CP-0 必须确认 `queryMasterIdentity` 与旧 `pair(locator)` 的其它消费者后才能退休或保留兼容面。

用户 action matrix：

| 用户状态 | 主机动作 | 副机动作 | 不显示 |
| --- | --- | --- | --- |
| 可用且未配对 | 开启主机服务 | 输入主机 IP、直接配对 | 查询身份、switch-role |
| 主机服务 starting | 显示进行中，禁止重入 | N/A | 其它角色卡片 |
| 主机服务 ready | 显示本机 IP、等待副机、关闭主机服务 | N/A | 配对表单 |
| 主机服务 error | 重试开启、返回目标选择 | N/A | raw hostErrorCode |
| 副机 pairing | N/A | 显示目标 IP 摘要、禁止重入 | 查询按钮 |
| pair error | N/A | 保留输入、直接重试、返回目标选择 | identity details |
| paired reachable | 解除配对；host service 次级生命周期 | 解除配对 | 目标选择、查询身份 |
| paired reconnecting | 保留已配对语义，解除配对 | 保留已配对语义，解除配对 | “已解除配对” |
| unpairing | progress；完成回目标选择 | progress；完成回目标选择 | 重复按钮 |
| mobile | gate only | gate only | 所有 topology action |

page gate 只有 `available=false` 时才渲染 IA-16/17 的单一 gate card。gate card 只显示结论和 reason；不得渲染 identity/address/host/paired/payload。operation eligibility 只用于动作卡 disabled/reason，不得升级为 page gate。

### 4.6 逐帧实现分母

下表是 implementation、逐代码与详设对账以及后续视觉/设备证据的完整 IA 分母。每个 ID 都必须有对应 renderer/fixture/testID；不能以“同类页面”代替缺失帧。`IA-30`（副机恢复页）和 `IA-31`（通用恢复页）已由产品旅途删除，不是生产分母；`IA-32` 是跨 tab 的 laptop 双屏对照素材，不新增生产页面。

| IA-ID | frame name | owner/形态 | 必须可见或必须不可见 |
| --- | --- | --- | --- |
| IA-01 | `PANEL-L-NORMAL` | admin-shell / laptop | header、状态、关闭、侧栏、内容边界 |
| IA-02 | `PANEL-M-NORMAL` | admin-shell / mobile | header、状态、关闭、唯一顶部 dropdown、单列内容 |
| IA-03 | `PANEL-L-EMPTY` | admin-shell / laptop | 保留 shell/navigation；内容空态；不隐藏 topology |
| IA-04 | `PANEL-M-EMPTY` | admin-shell / mobile | 保留 shell/dropdown；内容空态；无横向 tab |
| IA-05 | `PANEL-L-LOADING` | admin-shell / laptop | loading 状态与可读文字；关闭入口仍可达 |
| IA-06 | `PANEL-M-LOADING` | admin-shell / mobile | loading 状态与单列布局；dropdown 不重复 |
| IA-07 | `PANEL-L-ERROR` | admin-shell / laptop | error 状态、原因、恢复入口；不吞掉 panel chrome |
| IA-08 | `PANEL-M-ERROR` | admin-shell / mobile | error 状态、原因、恢复入口；不横向溢出 |
| IA-09 | `PORTS-L-OVERVIEW` | ports / laptop | 总数、三段 ratio bar、五类收起行 |
| IA-10 | `PORTS-M-OVERVIEW` | ports / mobile | 同一单位事实；单列 summary、ratio、五类行 |
| IA-11 | `PORTS-L-CATEGORY-EXPANDED` | ports / laptop | 一类展开的有限明细；其他类仍收起 |
| IA-12 | `PORTS-M-CATEGORY-EXPANDED` | ports / mobile | 一类展开的有限明细；不出现第二层横向滚动 |
| IA-13 | `RUNTIME-L-SINGLE-SURFACE` | runtime aggregate / laptop | 总体状态、屏数、一块真实 surface map |
| IA-14 | `RUNTIME-M-SINGLE-SURFACE` | runtime aggregate / mobile | 竖屏单列、一块真实 surface map、唯一 dropdown；当输入事实声称多 surface、超出支持范围或 malformed 时复用同一 frame 的 `display-facts-error` 变体，显示 typed 异常/未提供原因，不生成第二块矩形 |
| IA-15 | `RUNTIME-L-DUAL-SURFACE` | runtime aggregate / laptop | 主/副两块真实 surface、各自比例与字段边界 |
| IA-16 | `TOPOLOGY-L-UNAVAILABLE` | topology / laptop | 单一不可用结论+原因；不显示身份/地址/配对/服务/payload |
| IA-17 | `TOPOLOGY-M-UNAVAILABLE` | topology / mobile | 单一不可用结论+mobile原因；无角色/IP/配对操作 |
| IA-18 | `TOPOLOGY-L-ROLE-CHOICE` | topology / laptop | 主机服务 card、副机 IP 直接配对 card；无 query button |
| IA-19 | `TOPOLOGY-L-HOST-STARTING` | topology / laptop | 主机启动中、busy、禁止重复提交 |
| IA-20 | `TOPOLOGY-L-HOST-READY` | topology / laptop | 本机 IP、等待副机、关闭主机服务 |
| IA-21 | `TOPOLOGY-L-HOST-ERROR` | topology / laptop | typed failure、重试开启、返回目标选择 |
| IA-22 | `TOPOLOGY-L-PAIRING` | topology / laptop | IP 摘要、配对进行中、禁止重复提交 |
| IA-23 | `TOPOLOGY-L-PAIR-ERROR` | topology / laptop | 保留输入、直接重试、返回目标选择 |
| IA-24 | `TOPOLOGY-L-MASTER-PAIRED-REACHABLE` | topology / laptop | 主机已配对可达、对端摘要、解除配对 |
| IA-25 | `TOPOLOGY-L-MASTER-PAIRED-RECONNECTING` | topology / laptop | 保留已配对语义、重连状态、解除配对 |
| IA-26 | `TOPOLOGY-L-UNPAIRING-MASTER` | topology / laptop | 主机解绑 busy；完成回目标选择 |
| IA-27 | `TOPOLOGY-L-SLAVE-PAIRED-REACHABLE` | topology / laptop | 副机已配对可达、对端摘要、解除配对 |
| IA-28 | `TOPOLOGY-L-SLAVE-PAIRED-RECONNECTING` | topology / laptop | 保留已配对语义、重连状态、解除配对 |
| IA-29 | `TOPOLOGY-L-UNPAIRING-SLAVE` | topology / laptop | 副机解绑 busy；完成回目标选择 |
| IA-32 | `CROSS-TAB-L-DUAL-PHYSICAL` | cross-tab artifact / laptop | 与 IA-15 对照真实双屏；不新增页面或动作 |

## 5. 代码落点与依赖方向

### 5.1 Shared primitives

| 新/既有能力 | 设计结论 | 责任边界 |
| --- | --- | --- |
| `PrimitiveContainer` | 复用现有 `layout="card"`, `bounded`, `elevated`；不升级默认 card | 不持页面事实；`elevated` 只由 admin panel card 显式传入 |
| `PrimitiveDropdownSelect` | 新增真实展开/收起 selector；不改变现有循环式 `PrimitiveSelect` | controlled `value/open/options/onValueChange`; 不持 page selection source |
| `PrimitiveRatioBar` | 新增多 segment ratio bar | 校验非负、total 与 segment sum；不负责 port semantics |
| `PrimitiveDisclosure` | 新增 controlled disclosure row | 只呈现 expanded/pressed/chevron；展开 state 由 ports section 持有 |
| `PrimitiveSurfaceMap` | 新增 surface rectangle/labels | 只消费 presentation model；宽高比、unknown label、current/non-current 字段由 owner projection 决定 |
| `PrimitiveStatus`/`PrimitiveBadge`/`PrimitiveButton`/`PrimitiveInput` | 复用并补 admin semantic recipes | 不复制 topology/ports 业务文案 |
| `PrimitiveIcon` | 仅扩充通用 `chevron-down`, `chevron-right`, `monitor`, `server`, `link`, `blocked`, `refresh` 等确有 IA 使用的图标 | 不把 `MASTER/SLAVE` 或 port 名称写入 primitive |

### 5.2 Theme token contract

两个 integration 各自新增同名 CSS variable 与 Tailwind mapping；Android 两个 app 通过 `apps/terminal/assembly/base/android/config/index.cjs` 的 `sharedColors` 继承同名 mapping；值由 integration 自己决定，base 不写 RGB：

| semantic token | 用途 | 默认接入现有语义 |
| --- | --- | --- |
| `color-admin-shell-surface/foreground/muted/border` | panel header/nav | 各 integration 的既有 login/shell 主题族 |
| `color-admin-content-surface/foreground/muted/border` | content area/cards | `surface`, `foreground`, `muted-foreground`, `border` |
| `color-admin-inset` | ratio/disclosure/surface missing | `surface-inset` |
| `color-admin-action/action-foreground/focus` | selected page/action/focus | `action`, `action-foreground`, `focus` |
| `color-admin-surface-current/admin-surface-noncurrent` | current/non-current map | integration surface family |
| existing `ok-*`, `warn-*`, `error-*`, `info-*` | status dot/text/background/border | 不新造同义状态族 |

token alias 的完整分母是：两个 integration `theme/global.css`、两个 integration `tailwind.config.cjs`、Android shared `apps/terminal/assembly/base/android/config/index.cjs` 的 `sharedColors`，以及 `assembly/base/android/test/keyboardThemeConfig.test.ts` 所属的公共配置契约测试。实现期 focused/static 必须检查五处 mapping 的同名 key、Android 两个 app 的继承结果和 config test；只改 integration、不改 sharedColors 的红变异必须变红。颜色可读性和最终 geometry 必须在后续 visual/device evidence 中独立观察，不能以 token 存在代替视觉 PASS。

## 6. Cross-owner write matrix

本批没有数据库写入、HTTP CRUD 或 migration。所有 write 都是 UI → narrow capability → topology owner command：

| UI 意图 | 首个 owner command | 第二个 owner command | 事务/回滚事实 |
| --- | --- | --- | --- |
| 开启主机服务 | `TopologyAdminCapability.setHostEnabled(true)` | topology host lifecycle command | owner 以 desired/actual 对账；UI 只等待 typed result/read model |
| 关闭主机服务 | `setHostEnabled(false)` | topology host lifecycle command | 关闭完成后 owner 状态回到 role choice；失败保留 host facts |
| 直接配对 | `pairByHost({host})` | owner 内部 identity/locator/command path | owner 原子复核身份与 locator；UI 不写 locator，不存 identity |
| 解除配对 | `unpair()` | topology unpair command | owner 负责解绑顺序；UI 完成后回 role choice |
| 端口/显示读取 | 无 write | N/A | immutable read model；不复制到 UI store |

## 7. 声明—传递—消费矩阵

| fact | declaration | transfer | consumption | proof |
| --- | --- | --- | --- | --- |
| port capability unit | platform-port descriptor snapshot | `RenderRuntimeFacts.platformPortCapabilities` | `buildPortOverview` → summary/category/detail | unit sum red mutation |
| display facts | display-context owner `DisplayFactsReadModel` | render context/admin section context | runtime aggregate → `PrimitiveSurfaceMap` | no duplicate/current-copy mutation |
| topology page availability | topology owner capability | `AdminSectionRenderContext.topologyCapability` | topology page gate only | UI raw-facts/operation-reason red mutation |
| topology snapshot | topology slice selector owner | capability `getSnapshot`/selector binding | status cards/action state | stale/reconnect preservation test |
| direct pair result | topology command result | capability `pairByHost` promise | pair progress/error/recovery | query-button mutation |
| page registry | admin-shell constant | laptop nav/mobile dropdown/content resolver | three user pages | hidden runtime/display duplicate red mutation |
| status language | central pure mapper | projection to `PrimitiveStatus`/badge | all pages | unknown internal enum red mutation |
| semantic colors | integration global.css + Tailwind | class/token consumption | primitives/admin-shell | missing mapping red mutation |
| selector identity | `useUiStateSelector` / stable render context | section hook | one page rerender scope | unrelated slice red mutation |
| log metadata | logger owner | action start/complete/fail | no user raw payload | forbidden field static scan |

## 8. 业务规则 → owner 判定点

| 规则 | owner 判定点 |
| --- | --- |
| R-1 三页 user navigation | admin-shell page registry；内部 part 数量不直接决定 user tab 数量 |
| R-2 登录/业务不变 | AdminLayer/input/auth owner；本批不改 |
| R-3 panel hierarchy | AdminShellFrame 与 page layout primitives |
| R-4 laptop/mobile 差异 | `AdminShellLaptop`/`AdminShellMobile` layout owner；不以 CSS wrap 冒充 mobile |
| R-5 shared primitive/theme | primitives public surface + 两 integration theme |
| R-6 unit denominator | `buildPortUnits` pure projection |
| R-7 five category mapping | admin-shell category map；未知 port fail closed |
| R-8 runtime/display merge | runtime aggregate renderer + display-facts owner |
| R-9 all real surfaces | display-facts owner；surface-map projection不推导 |
| R-10 language/aspect ratio | display projection + `PrimitiveSurfaceMap` |
| R-11 status hierarchy | pure status mapper + panel/page renderers |
| R-12 page gate | topology owner `getPageAvailability` |
| R-13 role/action split | topology owner facts/eligibility + page action matrix |
| R-14 topology journey | topology capability command surface + UI state machine |
| R-15 failure language | typed reason mapper；UI 不维护第二份 reason enum |
| R-16 data/owner boundary | public context/capability import graph |
| R-17 reachability | shell scroll/container geometry |
| R-18 disclosure/feedback | controlled local UI state + async operation state |
| R-19 subscription | section selector/equality map |
| R-20 honest data/evidence | display owner fields nullable + no inferred fallback |

## 9. Owner API 与消费者清单

| owner API/read model | 消费者 | 当前状态 |
| --- | --- | --- |
| `RenderRuntimeFacts.platformPortCapabilities` | `PlatformPortsSection` projection | 已存在 |
| `DisplayFactsReadModel` | `RuntimeSection` aggregate | **需 CP-0/CP-1 owner closure** |
| `TopologyAdminCapability.getPageAvailability` | `TopologySection` page gate | **需 CP-0/CP-1 owner closure** |
| `TopologyAdminCapability.pairByHost` | `TopologySection` direct pair | **需 CP-0/CP-1 owner closure** |
| `TopologyAdminCapability.getSnapshot` | `TopologySection` paired/reconnect/host state | 已存在，但不用于整页资格重组 |
| `TopologyAdminCapability.getOperationEligibility` | 对应动作 enabled/reason | 已存在；不产生用户查询步骤 |
| `setHostEnabled`, `unpair` | host/slave action buttons | 已存在 |
| `AdminPageRegistry` | laptop nav/mobile dropdown/page resolver | 本批新增 admin-shell pure source |
| `buildPortOverview`, `projectRuntimeDisplay` | page renderers | 本批新增 pure projection |

任何 owner method 若最终没有真实消费者，必须从本批 contract 删除；不得因为“未来可能用”保留 query/command 噪音。

## 9a. 实施前全链同步变更清单

| 变更事实 | 契约/生成源 | owner/adapter | 前端 model/surface/state | focused/static | fixture/seed | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 三页 user registry | IA frame inventory + admin-shell part keys | `parts.ts` 保留；registry 新增 | shell/nav/content | page selection tests | N/A | 同步 registry、IDs、tests |
| mobile selector 为真实 dropdown | IA mobile frames | primitives | `AdminShellMobile` | primitive + shell tests | N/A | 新 primitive，不改旧 `PrimitiveSelect` |
| port unit denominator | platform descriptor source | `describePlatformPortCapabilities` 不变 | `buildPortUnits` | sum/category red tests | fixture capabilities inline | 同步 UI tests |
| five category mapping | 详设 §4.3 | admin-shell presentation owner | category rows | unmapped category red test | fixture new port | 同步 map/test |
| all-surface display facts | requirements §5.2/R-9 | display-context/device adapter | render context + runtime page | owner/public-surface tests | dual-display fixture | **CP-0 blocker；不得静默 N/A** |
| current/non-current projection | IA/requirements R-9 | admin-shell pure projector | `SurfaceMapModel` | missing non-current fields red test | single/dual facts | 同步 UI tests |
| topology page gate | requirements R-12 | topology owner capability | topology page | raw/operation bypass red test | mobile/dual/ready snapshots | **CP-0 blocker** |
| direct pair | requirements R-13/R-14 | topology command owner | host input/pair progress | no-query red test | pair success/failure | **CP-0 blocker** |
| topology action matrix | IA topology frames | capability eligibility/commands | host/slave render | role cross-action red tests | role snapshots | 同步 action tests |
| admin semantic tokens | IA high-fi token table | two integration themes | primitive class names | both theme mapping tests | N/A | CSS/Tailwind/test atomic group |
| surface/action icons | IA visual grammar | primitives icon registry | page/action components | icon public-surface tests | N/A | only used names |
| log privacy | AGENTS observability | logger call sites | action event data | forbidden-field static test | N/A | no raw IP/password/token/payload |

## 9b. 变更定位（锚点，不用行号）

- `apps/terminal/ui/base/admin-shell/src/parts/parts.ts`: `runtimePart`/`displayContextPart` definitions remain; add registry beside part assembly, not by deleting parts.
- `apps/terminal/ui/base/admin-shell/src/hooks/useAdminSections.ts`: replace raw selected part exposure at user boundary with page-key selection while retaining raw catalog compatibility helpers.
- `apps/terminal/ui/base/admin-shell/src/components/AdminShellLaptop.tsx` and `AdminShellMobile.tsx`: replace raw section navigation inputs with page registry and pass aggregate page contexts.
- `apps/terminal/ui/base/admin-shell/src/components/AdminSectionNavigation.tsx`: replace wrapping `PrimitiveGrid` tablist with the new dropdown primitive; no second selector.
- `apps/terminal/ui/base/admin-shell/src/components/AdminShellFrame.tsx`: add explicit status slot and preserve close/layer boundary.
- `apps/terminal/ui/base/admin-shell/src/components/sections/PlatformPortsSection*.tsx`: replace flat rows with pure unit projection + summary/ratio/category disclosure.
- `apps/terminal/ui/base/admin-shell/src/components/sections/RuntimeSection*.tsx` and `DisplayContextSection*.tsx`: compose one runtime page; do not make display-context a second user page.
- `apps/terminal/ui/base/admin-shell/src/components/sections/TopologySection*.tsx`: consume page availability/direct pair and the IA state machine; remove visible identity query.
- `apps/terminal/ui/base/primitives/src/components/`: add dropdown/ratio/disclosure/surface map only where no existing primitive provides the exact behavior.
- `apps/terminal/ui/base/primitives/src/types/types.ts`, `src/index.ts`, `src/theme/tokens.ts`, `terminal-invariants.json`, README/tests: keep public surface atomic.
- `apps/terminal/ui/integration/sample-console/theme/global.css`, `tailwind.config.cjs`, and wallpaper counterparts: add identical semantic keys with integration-owned values.
- display/topology contract files: only after CP-0 proves owner extension is authorized and required; otherwise stop.

## 10. 数据迁移与 seed

| 项目 | 处置 |
| --- | --- |
| 数据库迁移 | `N/A_WITH_REASON`：本批无数据库、HTTP persistence 或 schema 事实。 |
| seed | `N/A_WITH_REASON`：本批 UI read model/能力呈现不改变业务 seed；display/topology fixtures 属 focused tests，不是 seed。 |
| 运行时持久化 | `N/A_WITH_REASON`：UI 不持久化 page selection、port projection、surface facts 或 topology identity。 |

## 11. 验收场景设计（未来实施执行体）

本节只定义执行体，不代表本轮已运行。场景名按能力命名，不使用 Journey/R 编号作为源码、测试文件或类名。

| scenario | owner/source | fixture | business oracle | red mutation |
| --- | --- | --- | --- | --- |
| `admin-page-registry` | admin-shell page registry | runtime + display raw entries | user pages exactly ports/runtime/topology; no duplicate display page | expose raw display entry |
| `admin-mobile-dropdown` | `PrimitiveDropdownSelect` + mobile shell | three page options | one selector, vertical, selected page content changes | wrap tabs or second selector |
| `port-unit-conservation` | `buildPortUnits` | real/empty/missing descriptors | available+unavailable+undeclared equals total; category expansion preserves units | count ports, drop synthetic unit |
| `port-category-navigation` | ports section | one unavailable unit per category | summary→category→named reason path | render flat list only |
| `runtime-single-surface` | display facts owner + runtime page | one surface, missing physical | logical/physical/status/role in correct locations, unknown only when absent | copy current value to physical |
| `runtime-dual-surface` | display facts owner + projector | primary+secondary with unequal aspect ratios | two cards, correct ratios, non-current hides forbidden facts | render only current or add non-current resolution |
| `topology-page-gate` | topology capability | mobile, dual physical, single laptop | exact gate reason; no secondary data/actions | derive from pair eligibility/raw facts |
| `topology-role-choice` | topology section | unpaired master | host action and slave IP action differ | show same options or switch-role |
| `topology-direct-pair` | `pairByHost` capability | valid/invalid/occupied host | no query button; progress/error/retry with typed reason | query identity user step |
| `topology-host-lifecycle` | `setHostEnabled` | starting/running/error/stopping | ready shows local IP and close action; failure keeps reason | one-way enable only |
| `topology-unpair-both-roles` | `unpair` | paired master/slave | both roles can unpair; completion returns role choice | only master unpair |
| `topology-reconnect` | snapshot/read model | paired but unreachable | retains paired semantics and reconnecting status | fall back to unpaired |
| `selector-scope` | render selectors | unrelated slice mutation | inactive page does not rerender from unrelated state | use root selector/new equal object |
| `theme-token-symmetry` | two integration themes | both CSS/Tailwind maps | same keys, app-owned different values where approved | base hardcode/fixed color |
| `panel-failure-state` | shell lifecycle | empty/loading/error | header/close/nav preserved and content state visible | hide nav/close on error |

Visual/device evidence for IA geometry, theme contrast, focus/pressed behavior, surface rectangle aspect and real topology actions is a later CP-5 activity. It cannot be claimed from these focused scenarios.

## 12. 未决项处置

| 项目 | 当前状态 | 本批允许 | 本批禁止 |
| --- | --- | --- | --- |
| 逐 surface display facts public owner | `OPEN_BLOCKER`；当前 public `DisplayInfo` 只有 `displayCount` | 在 CP-0 复核最小 contract、owner、adapter/test 影响 | 从日志、current surface 或推导值伪造 |
| topology page-level availability | `OPEN_BLOCKER`；当前 capability 无 page API | 在 topology owner 设计 typed read model | UI 从 representative operation reason 拼 page gate |
| direct pair without visible identity query | `OPEN_BLOCKER`；当前 `pair` 需要 locator.identity | 在 topology owner 设计 `pairByHost` 并保留内部 identity resolution | 增加第二个用户步骤或 UI 自己造 identity |
| master unpair guard | `OPEN_BLOCKER`；`selectTopologyFacts` 的 MASTER+peerIdentity 可 paired，但 actor 当前只检查 masterLocator | owner 以 paired 事实作为解绑前置，成功清理 locator/peerIdentity/peerReachable 并 read back；补 red mutation | 让 UI 绕过 owner、只补第二条清除路径或把 MASTER 误判为未配对 |
| Android admin token mapping | `OPEN_UNTIL_IMPLEMENTATION`；sharedColors 当前没有本批 admin token | CP-2 同步两个 global.css、两个 integration Tailwind 和 sharedColors/config test | 只改 integration 就宣称 Android theme 完整 |
| feature part 是否继续出现在同一用户导航 | 本批不改 feature；base registry 只拥有三页 | 保持 feature assembly/renderer contract，另行 scope | 为了三页 IA 静默删除 feature catalog/renderer |
| visual/native/device evidence | `OPEN_NOT_AUTHORIZED` | 计划中登记执行体 | 用结构测试宣称 visual/device PASS |
| L2/testId actual-node proof | `OPEN_UNTIL_IMPLEMENTATION` | 实施后再做 | 现在创建/运行 L2 |

上述前三项不是可由 UI 详设自决的产品偷渡；如果 CP-0 不能在现有 approved owner 中闭合，实施必须停机并把事实、反例和最小替代交 Dexter。

## 13. 停机条件

1. 发现 display facts 需要改变既有 display/Android public contract，但没有当前授权：停在 CP-0，不读 Android log 代替 read model。
2. 发现 topology page gate 或 direct pair 只能通过 raw slice、代表性 operation 或第二套 UI command 实现：停在 CP-0，不扩大 admin-shell 权限。
3. 现有 `pair`/`queryMasterIdentity` 有其它真实消费者且不能安全收窄：停在 CP-0，保留 owner contract 事实并交最小兼容方案，不直接删除。
4. 主机解绑仍以 `masterLocator` 代替 typed `paired` 前置，或没有验证成功后清理三项事实并 read back：停在 CP-1，不进入 CP-2。
5. mobile 产生横向 tab、第二 selector、IP/pair/role action 或双屏 card：停回 IA 对账，不进入实施。
6. 任何 surface 的物理尺寸只能由逻辑尺寸、density 或另一 surface 推算：停机，呈现 `未知`/未提供，不补数据。
7. 新 primitive 需要 store、command、input controller、platform lifecycle 或 integration import：停机并退回 owner 设计。
8. Android admin token 未同时落在两个 integration global.css、两个 integration Tailwind 和 sharedColors/config test：停在 CP-2，不进入 page implementation。
9. 任何现有 feature/admin layer/认证/keyboard/power semantics 需要改变才能完成本批：停机，不扩大范围。

## 13b. 实施节奏与步骤级三维对账

每个 CP 的实际实施都必须按以下闭环：主 agent 先重开该 CP 的需求、IA、详设、terminal coding standard 与 memory；完成最小源码修改和 focused proof；再由 fresh 只读子 agent 按需求/详设/IA 与 memory 三维逐条证伪。三维对账逐点比较行为、形态、动作、关系、位置、文案、状态、失败/恢复、数据来源、订阅与 owner。任一项 `OPEN` 不得进入下一 CP。

全部 CP 完成后、整体测试/任何 Web/Android/device 动作之前，再做一次独立的全批三维对账；它不是 CP 对账汇总，必须重新从 IA frame inventory 和本文件逐 frame 检查。

## 13c. 明确的“逐代码与详设对账”交付门

实施结束时主 agent 使用 §9b 锚点和 §9a 分母逐项回读，不用行号，不接受“相关文件已改”作为结论：

| 对账组 | 代码范围 | 必须确认 | 结果格式 |
| --- | --- | --- | --- |
| public owner | display/topology/contracts/render | 每个新增字段/API有 declaration、transfer、consumer、failure owner；无零消费者 | `MATCHED`/`OPEN` |
| primitives | primitives types/index/component/token/invariant/tests | dropdown/ratio/disclosure/surface map 与 IA-ID 对应；无业务 state | `MATCHED`/`OPEN` |
| shell/pages | admin-shell parts/hooks/frame/navigation/sections/tests | 三页 mapping、四种 shell state、laptop/mobile、文案与 testID | `MATCHED`/`OPEN` |
| themes | 两个 global.css/tailwind/tests | semantic key 同步、值由 integration 拥有、无 base RGB | `MATCHED`/`OPEN` |
| topology | capability/section/tests | page gate、direct pair、主副动作、reconnect/unpair | `MATCHED`/`OPEN` |
| evidence | focused/static/visual/native/device | 证据档位不混写，未授权/未运行保持 OPEN | `MATCHED`/`OPEN` |

任何 `OPEN` 都把最终交付状态写成“实施未就绪”，不能用退出码、测试名、截图路径或文档字符串替代业务结论。

## 14. 详设完成检查

- [x] 三页 registry 不删除内部 part/catalog；runtime 与 display-context 只在用户面合并。
- [x] mobile selector 定义为真实 dropdown，而不是当前循环式 `PrimitiveSelect` 的误用。
- [x] ports unit denominator、五类映射、synthetic undeclared 与展开守恒已冻结。
- [x] runtime/display 的双屏、不对称字段、真实宽高比与未知值已冻结。
- [x] topology page gate、direct pair、主副动作、关闭/解绑回目标选择已冻结。
- [x] `switch-role` 未被伪造成可执行按钮。
- [x] shared primitive/theme owner、订阅边界、日志脱敏与 testID 计划已列出。
- [x] display facts/topology owner blocker 诚实保留，未把当前源码能力写成已具备。
- [x] 逐 CP 三维对账、全批三维对账、逐代码与详设对账均有明确执行体。
- [ ] independent design review：当前为 `OPEN_UNTIL_FRESH_REVIEW`，交 Claude 前必须保留该披露，不可改写为已完成。
