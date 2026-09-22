# TER UI 业务包可读性与基础能力归位 · implementation-facing 详设

SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

BUSINESS_SOURCE=doc/plans/platform/2026-09-22-ter-ui-business-readability-requirements-codex.md
JOURNEY_REFS=doc/plans/platform/2026-09-05-v2s-terminal-sample-interaction-design-claude.md;doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-requirements-claude.md
IA_REF=doc/plans/platform/2026-09-22-ter-ui-business-readability-ia-reconciliation-codex.md;doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-ia-design-codex.md
INTERACTION_REF=doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-interaction-design-codex.md;doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-implementation-design-codex.md
AUTHORIZED=只形成 implementation-facing 详设与实施计划；不实施源码、不改测试/依赖/脚本/构建产物、不启动任何 runtime
NOT_AUTHORIZED=生产代码、测试、依赖、脚本、generated output、package invariant 的实际修改；DEV、Web、Metro、Android/native/device、L2、UAT、Git
IMPLEMENTATION_AUTHORITY=false
DESIGN_REVIEW_CYCLE_ID=TER_UI_BUSINESS_READABILITY_20260922
DESIGN_REVIEW_TARGET=DESIGN
DESIGN_REVIEW_ROUND_LIMIT=2
DESIGN_STATUS=READY_FOR_IMPLEMENTATION_REVIEW

## 0. 当前阶段与不变量

本详设只把已接受需求变成可执行的代码设计和验证计划。当前工作区不进入实施。
14 个 feature logical part、28 个 laptop/mobile renderer、14 个旧兼容壳、3 个真正
共用组件，以及两个 integration 的重复 surface parser/startup-ready/state-sync 机制是
本批静态分母。它们来自当前源码，不把历史文档中的旧计数当作权威。

可见事实的唯一输入是 IA_REF 和 INTERACTION_REF。重构不新增视觉设计，不改变：

- 任何 IA-ID/preservation record 的 surface、partKey、mode、文案、testID、动作或失败呈现；
- laptop/mobile 的布局差异；
- auth 清密码、member peer-intent/草稿/竞态、wallpaper 写入阶段和 rejection policy；
- integration 的 placement、app theme、package.json surface 配置、wallpaper asset、业务 command/part owner；
- admin-shell、kernel、assembly/android、keyboard、power、登录语义和 topology 语义。

本详设只改变组件入口的可读性、共享请求生命周期的机械骨架、已有 SystemFailureNotice
的呈现复用、part sibling 注册的类型安全，以及两个 integration 中确实重复且无业务知识
的辅助机制。

## 1. 真实目标与方案比较

### 1.1 不处理的结构性后果

如果只把文件改名而不删除旧入口，读者仍会从无后缀 wrapper 进入默认 laptop，无法知道
真正 production renderer；如果只拆 renderer 而保留九个/两个聚合 hook，业务行为仍埋在
大文件中；如果只在 feature 内消除重复，surface parser 和 integration startup/sync
样板仍有两份来源；如果把业务差异一并抽进 base，base 会反向知道 sample 的 command、
wallpaper、member 或文案，下一次修改将更难定位。

### 1.2 方案比较

| 方案 | 结果 | 结论 |
| --- | --- | --- |
| A：只搬到 laptop/mobile 目录，保留 wrapper、聚合 hook 和 integration 重复代码 | 文件入口更直观，但旧代码继续可调用，业务机制和 parser 仍重复 | 拒绝，因为没有满足“旧代码不得有残留”和“业务包写得越少越好” |
| B：建立一个通用页面/表单/actor 大工厂，用配置替换三包 JSX 与业务差异 | 行数可能下降，但 base 会知道业务状态、失败阶段、command 和 part 语义；差异变成隐式配置 | 拒绝，因为会把业务规则迁入反向依赖的 schema，且无法保持 failure/rejection 差异 |
| C：目录归位 + 一职责 hook + typed part pair + 只抽已证明的 base 机制 + 负向残留扫描 | production 入口只有显式 laptop/mobile；行为仍由 feature hook/actor 拥有；base 只拥有无业务机制 | 采用 |

我选了 C 而不是 A/B，因为它同时满足 Dexter 的查找路径、双端显式 UI、共用一份
业务行为和旧代码清理要求，且每个抽取点都有至少两个当前消费者；未证实的候选留在业务
包，不为减少几行代码制造新抽象。

## 2. CP 总览

| CP | 主题 | owner | 主要输出 | 依赖 |
| --- | --- | --- | --- | --- |
| CP-0 | 源码/规格冻结与变更分母 | 主 agent；只读 reviewer | 逐文件清单、IA/需求/记忆三维对账基线、旧代码删除 ledger | 本详设、IA、需求 |
| CP-1 | feature 组件目录与 hook 拆分 | 三个 feature package | laptop/mobile/common 目录；单职责 hook/types/foundation；旧 wrapper/聚合文件删除 | CP-0 |
| CP-2 | render base 机械能力与 system notice | ui-base-render | definePartPair、tracked command runner、可配置呈现的 SystemFailureNotice 及 focused tests | CP-0 |
| CP-3 | feature parts、业务行为和 public surface 收口 | 三个 feature package | typed sibling registration、wallpaper catalog 单一住址、无旧 alias/旧导出 | CP-1、CP-2 |
| CP-4 | integration 基础机制归位 | ui-base-console-assembly + 两个 integration | shared surface parser/startup-ready/state-sync；package-specific adapter 只保留业务配置 | CP-0 |
| CP-5 | 文档、测试、负向扫描与全批对账 | 主 agent | README/invariant/test/import 同步；静态/typecheck/focused；逐代码与详设对账记录 | CP-1 至 CP-4 |

CP-1 至 CP-4 每一步结束、进入下一步前都必须有 fresh 独立子 agent 的三维
MATCHED/OPEN 对账。全部完成后再做一次全批三维对账，最后才允许整体测试。任何旧代码
负向扫描命中都为 OPEN，不得以新代码已可用抵销。

## 3. 横切机制对照表

| 机制 | ① 现成能力/规范（精确路径或符号） | ② 如何验证（最低档观察） | ③ 只有代码先例时新代码形态 | ④ 本批适用全集 |
| --- | --- | --- | --- | --- |
| 读侧节点授权 | N/A：本批是本地 terminal runtime，不新增 HTTP 读 operation；事实 owner 仍由既有 kernel selector 提供 | 静态搜索 feature 不直接读裸 slice/store；focused 检查 selector 输入仍相同 | 若新增 selector 适配，必须与既有 useUiStateSelector 调用同形，不得缓存 owner 事实 | member selector、pending selector、session variable、wallpaper confirmed/pending selector |
| 写授权与 grant 复核 | N/A：不新增 grant/HTTP 写 | 静态检查 command/actor/import 边界未改变；focused 保留原 command owner 测试 | 业务 action 仍由 feature command/actor 传给 kernel owner；base runner 不接触 owner facts | login、logout、member submit/confirm/reject/withdraw、wallpaper select/confirm、notice dismissal |
| 跨 owner 写与事务 | N/A：本批无数据库事务；不把 UI runner 冒充事务边界 | 静态检查 feature 不新增跨 kernel reducer/dispatchAction | 必须沿现有 command dispatch 边界，不在 base helper 拼接业务 command | 三个 feature 的所有 UI intent |
| 集合形态与分页 | 既有 IA §2.2：member list 为无分页的有限 sample 集合；其他 UI 均为固定/单值 | focused 造 0/1/many member 行并确认只有列表滚动；静态确认无分页/抽干循环 | 新 helper 不引入集合或分页；wallpaper options 来固定 catalog | member list、四个 wallpaper options、其余固定 message/单 pending |
| 缓存失效 / 改完刷新什么 | 既有 selector/runtime state：没有 RTK cache；修改后由 owner state 变更触发 selector 重读 | focused 检查成功 command 后 selector 读到 owner 新值，未受影响事实没有镜像 | runner 只 finish request，不拥有刷新；renderer 继续订阅 selector | member submit/confirm/reject/withdraw、wallpaper select/confirm、login/logout |
| RTK 数据读取与加载判定 | N/A：terminal UI 不使用 RTK/currentData/isFetching | 静态全批搜索 target packages 无 RTK import/currentData/isFetching | 不新增 RTK 兼容层 | 三个 feature、两个 integration |
| 同一事实只有一个住址 | 既有 IA 共用信息架构规则；kernel selectors 与 ui/base/input registry | 静态搜索无 feature 私有 member/pending/wallpaper mirror；focused 改 owner 值后 UI 更新 | hooks 只派 intent/读取 selector；pure catalog 只持有 labels/assets，不持有状态 | member/pending/session、wallpaper confirmed/pending、input drafts |
| 失败可见且原因不得改写 | ui-base-render SystemFailureNotice；既有 classifyRequestResult、D-14、IA 错误表 | focused 覆盖 completed/running/business-failure/system-failure/rejection；错误变异必须使断言变红 | base notice 只呈现传入安全文案；tracked runner 通过 outcome/rejection policy 回调 feature | auth notice/system notice、member registry/system notice、wallpaper system notice、所有五处 action runner |
| owner 错误到 HTTP 的映射与注册处 | N/A：本批无 HTTP problem；本地 actor failure 沿既有 feature observer | 静态确认没有新 HTTP mapping 或 typed problem | 不把本地 failure 转成 HTTP；业务映射继续由 feature copy/actor 负责 | auth、member、wallpaper 本地 failure |
| 幂等键构成与重放语义 | ui-base-render dispatchWithRequestId、useTrackedRequest、runtime requestId ledger | focused 检查同一次 requestId finish；旧 request 完成不清新 request；wallpaper actionInFlight 保留 | useTrackedCommand 只生成/传递/finish requestId，不改变 routeIntent；重放仍由 runtime owner 处理 | member logout/submit/decide、auth login、wallpaper select/confirm |
| 该用生成物的地方不得手搓字符串 | 既有 package public exports/invariants、commands、wallpaperPickerTestIds | focused/static 以真实 exports/test IDs 对比；新目录路径没有字符串逃生口 | partKey/command/testID 仍来自 owner source；base pair 只拼 rendererKey | 三个 parts、wallpaper test IDs、两个 integration public adapters |
| 日志落点与脱敏字段 | AGENTS.md observability；ui-base-render useDispatchCommand/render logger；console-assembly startupDiagnosticsWriter | 静态检查 base helper 不记录 payload/raw error/手机号/token；focused rejection 仍有结构化诊断 | startup helper 复制现有 logger 字段和 writer=ui.base.console-assembly；feature 继续决定 operation | 五处 UI action rejection、两个 startup-ready actor、surface parser 只抛安全 prefix |
| 迁移回填与可逆性 | N/A：无数据库、migration、seed、生成契约 | 静态确认本批无 migration/seed 文件或脚本变更 | 不添加兼容层或旧数据转换 | 全批 |
| 前端共享行为（Drawer/列表/表单生命周期） | ui/base/input InputScrollArea/useInputField/useInputSnapshot；ui-base-render request hooks | focused 确认表单输入、滚动祖先和 request busy 仍由既有能力提供 | 不把 input registry 或 layer dismissal 移到 base 新引擎 | member form、auth login、wallpaper picker |
| 管理后台交互一致性 | N/A：本批是 TER native UI，不是 frontend admin Drawer；IA/interaction 是适用正本 | static/focused 逐 IA record 对照位置、形态、行为和失败/恢复；不执行 L2 | 组件目录改变不得改变任何 IA preservation row | 15 sample IA-ID、5 wallpaper preservation record |
| 候选/下拉数据源 | N/A：无候选/下拉 API | 静态检查无新增异步选项加载 | wallpaper 四项只读 feature catalog | member/auth/wallpaper 三包 |
| 编码与名称呈现 | definePart、已有 parts 命名、frontend terminal coding standard TR-14 的本专项覆盖 | 静态扫描文件名、export、part variable；发现 Laptop/Mobile 后缀或旧 alias 即红 | 目录表达机型；component basename 只表达职责；pair 对象用 laptop/mobile 字段 | 14 feature logical parts + 2 integration laptop-only parts |
| 会同时坏的东西是否已声明为原子组 | implementation-design §9a 与 CP gates | 每个 CP 结束核对 pair files/hooks/parts/exports/tests/README 一起完成 | 目录迁移、hook import、part registration、public invariant 同一变更组 | 三 feature 各自；render base；console-assembly；两个 integration |

## 4. IA preservation 与实现边界

### 4.1 可见事实

所有 20 条 IA preservation record 的可见列以
doc/plans/platform/2026-09-22-ter-ui-business-readability-ia-reconciliation-codex.md
§3 为唯一重构对账输入。详设不复制另一套文案或尺寸；实施者必须逐条读该表和原 IA/
interaction。component 只改 import、文件路径、公共呈现承载和 hook 文件位置。

SystemFailureNotice 的扩展只能承接现有 laptop/mobile 的 root padding、card width、
actions direction 等呈现值；不能把业务 operation/phase 或“laptop/mobile”判断放入
base。WallpaperBackground 不迁入 base，仍由 feature 作为 SurfaceRoot children 提供。

### 4.2 不可见事实

所有 20 条记录的 stateAndPermission、navigationAndRefresh、collectionShapeAndScale、
dataSourceAndCascade、forbiddenUI 以 IA reconciliation §4 和对应既有正本为准。重构只允许
让这些事实更容易定位，不允许新增 cache、mirror、auto module scan、screen-count
条件或 fallback。

## 5. Base API 详设

### 5.1 ui-base-render：typed sibling part factory

修改：

- apps/terminal/ui/base/render/src/foundations/definePart.ts
- apps/terminal/ui/base/render/src/index.ts
- apps/terminal/ui/base/render/terminal-invariants.json
- apps/terminal/ui/base/render/test/catalog.test.ts 或新增同 owner focused test

新增 public capability definePartPair，保持 definePart 原行为不变。其输入使用
definePart 当前的全部 catalog fields（除 component、rendererKey、surfaceForm），另加：

- components.laptop: ComponentType<TProps>
- components.mobile: ComponentType<TProps>

输出是 frozen 的 {laptop: DefinedPart<TProps>, mobile: DefinedPart<TProps>}。两半分别
调用同一个 definePart；只在 factory 内生成 rendererKey 为 partKey.laptop 和
partKey.mobile，并分别传 surfaceForm=[laptop]、[mobile]。title、description、
containerKeys、displayModes、workspaces、instanceModes、layerTier、layerGuard 必须在
两半逐字相等，仍由 definePart 的 typed catalog/renderer binding 处理。

该 helper 不接受 optional component，不自动生成单端，不创建 registry，不改变
createRendererCatalog、selectPartsForSurfaceForm 或 layer guard。integration 的
sample.wallpaper-console.waiting/welcome 仍直接使用 definePart，因为它们合法地只有
laptop renderer。

可证伪 focused 条件：

1. 修改公共 title/guard 只改一半时测试红；
2. laptop/mobile rendererKey 或 surfaceForm 重复时测试红；
3. 组件 props 类型不匹配时 typecheck 红；
4. 返回对象或 catalog 数组被写入时与 definePart 同样保持 frozen。

### 5.2 ui-base-render：tracked command runner

新增：

- apps/terminal/ui/base/render/src/hooks/useTrackedCommand.ts
- apps/terminal/ui/base/render/src/index.ts
- apps/terminal/ui/base/render/terminal-invariants.json
- apps/terminal/ui/base/render/test/requestSupport.test.ts 或同 owner focused test

新增 hook 复用既有 useTrackedRequest、useRequestInFlight、dispatchWithRequestId、
classifyRequestResult，不替代它们。它返回 requestInFlight 和 run。run 的精确输入固定为：

run({definition: CommandDefinition<TPayload>, payload: TPayload, routeIntent?,
onOutcome?, onRejected?, rejectionPolicy})

其中 definition 直接复用 apps/terminal/kernel/base/runtime/src/types/command.ts 的
现有 CommandDefinition，不新增 execute 或 requestLabel 字段。若需要结构化诊断标签，
只能作为独立的中性 diagnosticsLabel 传入 runner，不能混入 command definition。
onOutcome(result, outcome) 由 feature 处理 business/system outcome；onRejected(error)
由 feature 观察 dispatch rejection；rejectionPolicy 只能是 RETHROW 或 CONSUME。

run 的固定机械顺序是：busy 直接返回；start 一个 requestId；派发同一 requestId；
按 classifyRequestResult 结果在非 running 时 finish；调用 onOutcome；返回原
CommandDispatchResult。dispatch rejection 必须 finish、调用 onRejected，然后按 policy
重新抛出或返回 undefined。helper 不捕获并改写 onOutcome 的业务语义，不清除输入，不
决定 routeIntent、operation、phase 或 feature copy。

消费者保持差异：

- sample-staff-auth login：business-failure 增加 passcodeResetKey；system/rejection
  观察 auth system notice；rejection RETHROW；
- sample-member-desk logout/submit/decide：system/rejection 观察 desk notice，routeIntent
  和 operation 仍由各 hook 决定；rejection RETHROW；
- sample-wallpaper-picker runAction：保留 actionInFlight ref；onOutcome 从原 result
  提取 before-write/after-write；rejection 观察 unknown-write-phase，policy CONSUME。

可证伪 focused 条件覆盖 completed、running、business-failure、system-failure、Promise
rejection、busy、旧 request 完成不清新 request、RETHROW/CONSUME 两种 policy；任一断言
只看 testID 不足以通过。

### 5.3 ui-base-render：SystemFailureNotice 有限呈现参数

修改：

- apps/terminal/ui/base/render/src/components/SystemFailureNotice.tsx
- apps/terminal/ui/base/render/src/index.ts
- apps/terminal/ui/base/render/terminal-invariants.json
- apps/terminal/ui/base/render/test/renderProps.test.tsx 或新 focused test

保留现有 title/message/dismissLabel/children、testID 命名、PrimitiveCenter、
PrimitiveContainer、PrimitiveHeading、PrimitiveText、PrimitiveActions、
PrimitiveButton 的结构和安全默认值。新增的 public type 固定为：

SystemFailureNoticePresentation = Readonly<{
  readonly rootStyle?: StyleProp<ViewStyle>
  readonly cardStyle?: StyleProp<ViewStyle>
  readonly actionsOrientation?: 'row' | 'column'
  readonly dismissButtonStyle?: StyleProp<ViewStyle>
}>

SystemFailureNoticeProps 只增加 presentation?: SystemFailureNoticePresentation。StyleProp
与 ViewStyle 直接复用现有 react-native/primitive 类型；不增加任意 props spread、
actionsStyle、token override、children-owned layout 或可变的 presentation map。base 不识别
sample、operation、phase、feature、laptop 或 mobile。

三个 feature 的六个 system notice renderer 仍是六个显式文件；每个只负责调用自己的
hook、计算自己的安全 message/props，并传入当前字节已经体现的 laptop/mobile
presentation。业务确认层不迁移到 SystemFailureNotice。

六个 renderer 的静态 presentation profile 冻结如下：

| renderer | rootStyle | cardStyle | actionsOrientation | dismissButtonStyle |
| --- | --- | --- | --- | --- |
| member DeskSystemNoticeLaptop | flex:1、minHeight:0、padding:24 | width:'100%'、maxWidth:720 | row | 未提供 |
| member DeskSystemNoticeMobile | flex:1、minHeight:0、padding:16、alignItems:'stretch' | width:'100%' | column | width:'100%' |
| auth AuthSystemNoticeLaptop | flex:1、minHeight:0、padding:24 | width:'100%'、maxWidth:720 | row | 未提供 |
| auth AuthSystemNoticeMobile | flex:1、minHeight:0、padding:16、alignItems:'stretch' | width:'100%' | column | width:'100%' |
| wallpaper WallpaperSystemNoticeLaptop | flex:1、minHeight:0、padding:24 | width:'100%'、maxWidth:720 | row | 未提供 |
| wallpaper WallpaperSystemNoticeMobile | flex:1、minHeight:0、padding:16、alignItems:'stretch' | width:'100%' | column | width:'100%' |

可证伪条件是：六个 renderer 的可见 testID/文案/动作不变，profile 各字段与当前源码
逐项相等；去掉 presentation 时 base 默认行为仍与现有 default consumer 相同；base props
不出现 operation/phase/feature 字段。

### 5.4 ui-base-console-assembly：surface declarations

新增：

- apps/terminal/ui/base/console-assembly/src/foundations/terminalSurfaces.ts
- apps/terminal/ui/base/console-assembly/src/index.ts
- apps/terminal/ui/base/console-assembly/terminal-invariants.json
- apps/terminal/ui/base/console-assembly/test/terminalSurfaces.test.ts

base 拥有纯类型和 parser/selector：

- SurfaceSize、SurfaceOrientation、SurfaceDeclarations、PortraitSurfaceDeclarations、
  TerminalSurfaces；
- surfaceFormForOrientation；
- readTerminalSurfaces(value, {errorPrefix})；
- getSurfaceDeclarations(surfaces, surfaceForm)。

parser 保持当前两个 integration 的事实：landscape 必须有 PRIMARY/SECONDARY 正尺寸；
portrait 可省略，存在时只能有 PRIMARY；所有 width/height 必须为 finite 且大于零；
返回的每层对象 frozen；errorPrefix 只由 integration 传入，base 不知道 sample 名称。

每个 integration 的 application/terminalSurfaces.ts 保留 package.json 读取、
terminalSurfaces 常量和本包 errorPrefix 的薄 adapter，并 re-export base 类型/纯函数；
不得继续保留 isRecord、positiveFinite、readSurfaceSize、readSurfaceDeclarations、
readPortraitSurfaceDeclarations 的第二份实现。assembly 继续从本包 adapter 读取，
不要把 package.json import 搬入 base。

### 5.5 ui-base-console-assembly：startup-ready 和 state-sync

新增：

- apps/terminal/ui/base/console-assembly/src/foundations/startupReady.ts
- apps/terminal/ui/base/console-assembly/src/foundations/stateSyncSlices.ts
- apps/terminal/ui/base/console-assembly/src/index.ts
- 对应 console-assembly focused tests

startup helper 提供：

- StartupReadyPayload，字段固定为 surfaceKey=PRIMARY、displayIndex=0、
  readyPartKey:string|null、contentFailure:ContentFailureReason|null；
- createStartupReadyPayload(RenderSurfaceReadyInput)，只做字段映射；
- createStartupReadyActor({moduleName, command, message})，复用两个 integration 当前
  logger category/event/data/writer 形态，message 由 integration 提供。

command definition、moduleName、moduleKind、placement actor、appName 和命令 owner 仍留在
integration。base helper 不拼接 sample command、不选择 module、不接受 raw payload。

state-sync helper 接收 integration 显式传入的 RuntimeModule/stateSlices 集合，只过滤
syncIntent=isolated，并返回现有 name/syncIntent 形状。sample-console 仍显式传
uiStateModule + memberRegistryModule；sample-wallpaper-console 仍只传 uiStateModule。
helper 不扫描 runtime modules、不自动加入任何 feature、不 dedupe/排序改变现有语义。

## 6. Feature 详设

### 6.1 sample-member-desk

目标路径：

- 新建 components/laptop/MemberList.tsx、MemberForm.tsx、CustomerMember.tsx、
  CustomerWelcome.tsx、WaitingConfirm.tsx、RegistryNotice.tsx、DiscardConfirm.tsx、
  WithdrawConfirm.tsx、DeskSystemNotice.tsx；
- 新建 components/mobile/ 同名九个文件；
- 保留 components/MemberRow.tsx；
- 删除 components 根目录的九个无后缀兼容壳和十八个旧后缀文件；
- 删除 hooks/useMemberDesk.ts；
- 新建 hooks/useMemberList.ts、useMemberForm.ts、useCustomerMember.ts、
  useCustomerWelcome.ts、useWaitingConfirm.ts、useRegistryNotice.ts、
  useDiscardConfirm.ts、useWithdrawConfirm.ts、useDeskSystemNotice.ts；
- 新建 types/customerMember.ts，保存 CustomerMemberMode；
- 新建 foundations/registryNoticeCopy.ts，保存 registryNoticeMessage；
- 修改所有 renderer import 使用单职责 hook/types/foundation；
- 修改 parts/parts.ts 使用 definePartPair 的 pair 对象，不再有 createFormPart、
  ComponentType<any>、memberListPart 等默认 laptop alias。

九个 hook 的 selector、input field、request route、command、system-failure operation、
业务文案和返回 shape 按原文件逐函数搬运；不将 hook 返回 JSX，不把 mode/topology 判断
放进 renderer。useCustomerWelcome 的 layout logger 保留在该 hook 文件。useCustomerMember
的 confirm/reject/handBack 与 pending 竞态不由 runner 或 base 重写。

parts.ts 每个 logical part 只写一次公共 catalog metadata，显式传
components: {laptop: Laptop.MemberList, mobile: Mobile.MemberList}，展开 pair.laptop/
pair.mobile 进入 28 项 parts 数组。layerDismissals 以 pair.laptop.catalogEntry.partKey
作为唯一 partKey lookup，不导出默认 laptop 对象。

### 6.2 sample-staff-auth

目标路径：

- 新建 components/laptop/StaffLogin.tsx、AuthNotice.tsx、AuthSystemNotice.tsx；
- 新建 components/mobile/ 同名三个文件；
- 保留 components/StaffLoginPasscodeInput.tsx；
- 删除 components 根目录的三个无后缀兼容壳和六个旧后缀文件；
- 删除 hooks/useAuthNotices.ts；
- 新建 hooks/useAuthNotice.ts、useAuthSystemNotice.ts；
- 新建 types/authNotice.ts、types/authSystemNotice.ts；
- 将 authNoticeMessage 放入 foundations/authNoticeCopy.ts；
- useStaffLogin.ts 改用 ui-base-render 的 useTrackedCommand，保留 passcodeResetKey、business
  failure 清理、system/rejection 观察和 RETHROW；
- parts.ts 改用 typed pair，删除 loginPart、noticePart、systemNoticePart alias。

AuthNotice/AuthSystemNotice 的 props type 从 types 文件显式导入；renderer 不再通过无后缀
壳进入 laptop。登录 UI 仍使用 StaffLoginPasscodeInput、ui/base/input 和现有 virtual
keyboard 语义，不因可读性重构改 keyboard。

### 6.3 sample-wallpaper-picker

目标路径：

- 新建 components/laptop/WallpaperPicker.tsx、WallpaperSystemNotice.tsx；
- 新建 components/mobile/ 同名两个文件；
- 保留 components/WallpaperBackground.tsx；
- 删除 components 根目录的 WallpaperPicker.tsx、WallpaperSystemNotice.tsx 两个兼容壳
  及两个旧后缀 renderer；
- 原地重写 hooks/useWallpaperPicker.ts，使其只包含单一 picker hook；这不是保留旧聚合
  实现，也不是新增第二个同名入口；
- 新建 hooks/useWallpaperSystemNotice.ts、foundations/wallpaperSystemCopy.ts；
- 新建 foundations/wallpaperCatalog.ts，唯一拥有 wallpaperIds、wallpaperLabels；
- WallpaperBackground 改从 wallpaperCatalog 读取 label，assetsById 仍由 assets.ts 拥有；
- parts.ts 改用 typed pair，删除 wallpaperPickerPart、systemNoticePart 默认 laptop alias；
- src/index.ts 删除 WallpaperPicker、WallpaperPickerLaptop、WallpaperPickerMobile、
  WallpaperSystemNotice 这四个模糊/机型导出，只保留 WallpaperBackground 和 assembly/
  command/module/parts 等明确 public surface。

useWallpaperPicker 保留 actionInFlight、effective、canConfirm、runAction、phaseFromActorResult
的现有语义；useWallpaperSystemNotice 和 wallpaperSystemMessage 分开文件，但 operation/
phase 仍来自 feature commands。WallpaperBackground 不迁 base、不变成 part。

## 7. Integration 详设

### 7.1 sample-console

修改：

- application/terminalSurfaces.ts：只保留 packageJson 读取、errorPrefix=sample-console、
  terminalSurfaces 常量和 base re-export；
- application/module.ts：删除本地 createStartupReadyActor，使用
  createStartupReadyActor({moduleName, command: startupReadyCommand, message: 原有 message})；
- assembly/assembly.tsx：使用 base createStartupReadyPayload 和 selectStateSyncSlices，
  仍显式传 uiStateModule + memberRegistryModule；不改变 parts、placement、topology、
  appName、surface declaration、theme 或 persistence；
- index.ts：保持现有 public export 名称，通过 adapter re-export base 类型/函数；
- README：写明 parser/startup/sync mechanism owner 与 integration adapter 边界；
- test/terminalSurfaces.test.ts：将 parser 的完整红/绿分母移到 base test，integration
  只测试 package.json 默认值、errorPrefix adapter 和 public export；
- 相关 assembly/module tests：保留 member registry sync slice 进入，isolated slice 不进入。

### 7.2 sample-wallpaper-console

修改：

- application/terminalSurfaces.ts、application/module.ts、assembly/assembly.tsx、index.ts、
  README、tests：与 sample-console 使用同一 base mechanism；
- assembly 只把 uiStateModule 传给 selectStateSyncSlices，保持 wallpaper isolated slice
  不被加入；
- src/components/WaitingLaptop.tsx 移为 src/components/laptop/Waiting.tsx；
- src/components/WelcomeLaptop.tsx 移为 src/components/laptop/Welcome.tsx；
- src/parts/parts.ts 更新为 laptop/Waiting 和 laptop/Welcome，仍直接 definePart；
- 不新建 mobile/Waiting.tsx 或 mobile/Welcome.tsx，不把 SECONDARY part 伪造成 mobile
  可达。

旧设计文档曾基于早期源码写过“parser 只存在一处”。当前字节显示两个 integration 各有
一份完整 parser；本详设以当前源码为准，采用“base 纯 parser + 两个 package adapter”
的最小修法。adapter 保留是为了让 package.json、错误前缀和 public API 仍归 integration，
不是保留第二份机制。

## 8. owner API 与消费者清单

| owner API / capability | 精确 owner | 当前/计划消费者 |
| --- | --- | --- |
| definePart | ui-base-render/src/foundations/definePart.ts | admin-shell、sample-console admin test part、wallpaper-console laptop-only parts、new definePartPair |
| definePartPair | ui-base-render/src/foundations/definePart.ts | sample-member-desk parts、sample-staff-auth parts、sample-wallpaper-picker parts |
| useTrackedCommand | ui-base-render/src/hooks/useTrackedCommand.ts | member useMemberList/useMemberForm/useCustomerMember、auth useStaffLogin、wallpaper useWallpaperPicker |
| SystemFailureNotice | ui-base-render/src/components/SystemFailureNotice.tsx | six feature system-notice renderers；其他现有 consumers 继续使用默认 presentation |
| readTerminalSurfaces/getSurfaceDeclarations/surfaceFormForOrientation | ui-base-console-assembly/src/foundations/terminalSurfaces.ts | 两个 integration adapters、两套 terminalSurfaces tests、两个 assembly |
| createStartupReadyActor/createStartupReadyPayload | ui-base-console-assembly/src/foundations/startupReady.ts | 两个 integration application/module.ts、两个 assembly ready payload |
| selectStateSyncSlices | ui-base-console-assembly/src/foundations/stateSyncSlices.ts | 两个 integration assembly.tsx，输入模块集合不同 |
| wallpaperCatalog | sample-wallpaper-picker/src/foundations/wallpaperCatalog.ts | WallpaperPicker laptop/mobile、WallpaperBackground、wallpaper hook |

没有调用者的新 public method 不写入 implementation；任何实现后零调用者的新增能力必须
删除，不得用“未来可能复用”保留。

## 9. 跨层声明—传递—消费矩阵

| fact / mechanism | declaration | transfer | consumption | proof |
| --- | --- | --- | --- | --- |
| renderer pair | parts.ts 的公共 metadata + components.laptop/mobile | definePartPair 输出两个 catalogEntry/rendererBinding，parts 数组传给 assembly | renderer catalog 按 surfaceForm 选一个 sibling | focused 比较两半 metadata 相等、rendererKey/form 正确；任意一半漂移变红 |
| component props | 各 component 文件的真实 props/interface | parts.ts 由 ComponentType<TProps> 进入 rendererBinding | selected renderer 收到同一 props shape，mode 仍由 actor/part props 提供 | typecheck + renderer focused |
| request lifecycle | feature hook 的 definition/payload/routeIntent、feature callbacks | useTrackedCommand 传 requestId、outcome、rejection policy | hook 决定 system/business message、rethrow/consume、clear input | request focused 覆盖五类 result 与两类 rejection |
| system failure presentation | feature renderer 的安全 title/message/dismiss 与 presentation | SystemFailureNotice 只传中性 presentation/style | base 渲染既有 testID/children/actions；dismiss 回 feature hook | component tree/props focused；raw error mutation 必须红 |
| surface collection shape | package.json 的 terminalSurfaces | adapter 传 unknown + errorPrefix 到 base parser，再把 typed value 传 assembly | assembly 按 surfaceForm 取 landscape 或 PRIMARY-only portrait | base parser focused + integration default/public tests |
| authorization enforcement point | N/A：本地 owner command/actor 边界 | feature dispatch command 到 kernel owner | kernel owner 继续最终复核，base 不作业务判断 | static imports + existing feature focused tests |
| cache invalidation | N/A：runtime selector subscription | command 结果写 owner state，tracked runner 只 finish | useUiStateSelector/useUiVariable 重新读取同一事实 | focused owner state readback |
| error mapping | feature command result/rejection 与 IA/D-14 categories | useTrackedCommand 传原 result/error 给 feature callback | auth/member/wallpaper feature copy/notice 消费 | focused outcome matrix + static forbidden raw error |
| logging/masking | useDispatchCommand/logger、startup helper message/appName | rejection logger 和 startup actor 传安全 fields | render diagnostics/console startup logs；不传 payload/phone/token/raw error | static field scan + existing logger focused |
| startup-ready shape | base StartupReadyPayload | integration command definition/assembly mapper 使用 base mapper | integration owner actor 使用 base logger helper | typecheck + module focused |
| sync slice shape | integration 显式模块集合 | selectStateSyncSlices 过滤 isolated，保留 name/syncIntent | createTopologyModule.stateSyncSlices | focused sample-console/member inclusion 和 wallpaper isolation |
| wallpaper business catalog | feature foundations/wallpaperCatalog | hook/background/renderer import 同一 module | radio labels/accessibility/background labels | static one-address scan + focused public behavior |

## 10. 实施前全链同步变更清单

| 变更事实 | 契约 / 生成源 / 生成物 | 后端 owner / edge / migration | 前端 model / surface / state | focused / static / HTTP / L2 测试 | fixture / seed | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| renderer 文件路径与命名 | 无 generated source；parts.ts 是 registration source | N/A | 3 feature components、2 integration laptop-only components、parts imports、README | feature renderer tests、adminLayout path assertions、negative scan | N/A | 同步修改 |
| hook 文件边界 | 无 generated source；既有 hook exports 是 source | N/A | 9 member + 3 auth + 2 wallpaper hook files/types/foundations | feature focused imports/behavior tests、no aggregate-hook scan | N/A | 同步修改并删除旧 aggregate |
| typed part pair | ui-base-render definePart/definePartPair | N/A | 14 logical feature parts -> 28 bindings；layer dismissals | base definePartPair focused、feature part/assembly tests | N/A | 同步修改 |
| system notice presentation | ui-base-render public type | N/A | six system notice renderers | base component focused + six feature render tests | N/A | 同步修改 |
| request lifecycle | ui-base-render useTrackedCommand | N/A | member/auth/wallpaper action hooks | base outcome/rejection tests + existing feature behavior tests | N/A | 同步修改 |
| wallpaper labels/ids | assets.ts owns assets; wallpaperCatalog owns labels/ids | N/A | picker laptop/mobile/background/accessibility | wallpaper focused + duplicate label scan | N/A | 同步修改 |
| terminal surface parser | base terminalSurfaces.ts owns generic parser; package.json owns values | N/A | two integration adapters, assemblies, public exports | base parser focused + two integration adapter tests | N/A | 同步修改 |
| startup-ready | base startupReady.ts owns shared mapping/log shape; integration command owns identity | N/A | two application/module.ts and two assembly ready mappers | console-assembly and integration module tests | N/A | 同步修改 |
| topology sync selection | integration module list is sole selection source; base filter is mechanism | N/A | sample-console includes member registry; wallpaper only ui state | two assembly focused tests; isolated red mutation | N/A | 同步修改 |
| public surface/invariants | terminal-invariants.json reflects real src/index exports | N/A | render, console-assembly, wallpaper feature/integration indexes | public-surface tests and static invariant check | N/A | 同步修改 |
| README/source references | README is documentation, not source | N/A | five package README and adminLayout test file paths | static path/old-token scan | N/A | 同步修改 |

## 11. 每个 CP 的门控

### CP-0

- 可证伪失败：分母漏掉任一 paired renderer、wrapper、aggregate hook、duplicate parser、
  duplicate startup actor 或 duplicate state-sync reduce。
- 不变量：每一项都有 exact path、owner、consumer、删除/保留决定和 IA preservation record。
- FORBID：先写代码再补清单；把历史文档计数当当前 source；扩展到 admin-shell/kernel/
  assembly/android。
- 验证：静态 full-tree rg/find 记录结果；独立 reviewer 给每个同根族 MATCHED/OPEN。
- RECALL：需求稿 §3–7、IA reconciliation 全部 §2–6、existing IA §2.1/2.2、
  wallpaper requirements §3.2–3.4、D-14、frontend terminal standard TR-12/13/14/15。

### CP-1

- 可证伪失败：任一 feature 旧 wrapper、旧后缀 renderer、useMemberDesk/useAuthNotices
  仍存在，或新 renderer import 仍指向旧聚合 hook。integration laptop component old
  basename 属于 CP-4 的 integration 命名清理门，不提前计入 CP-1。
- 不变量：每个 renderer basename 只表达职责；laptop/mobile 目录显式；common 仅保留
  MemberRow、StaffLoginPasscodeInput、WallpaperBackground；hook 一文件一职责。
- FORBID：兼容壳、默认 laptop alias、Platform.OS/窗口宽度替换整套 UI、创建 mobile
  SECONDARY wallpaper console part。
- 验证：typecheck 前先静态 negative scan；feature focused render tests 必须导入新路径。
- RECALL：IA reconciliation §3–5、requirements R-1/R-2/R-5、各 feature README/parts/
  hook/component owning source。

### CP-2

- 可证伪失败：pair metadata 不同、runner busy/finish/rejection policy 错误、或 base notice
  传 raw error/operation/phase。
- 不变量：新 base 能力不识别 feature；旧 definePart/dispatchWithRequestId/
  classifyRequestResult 行为不变；presentation 只中性。
- FORBID：新 registry、全能 UI schema、统一 catch 抹平业务差异、改现有 admin renderer。
- 验证：base focused tests 使用真实 red mutation：故意删一半 metadata、跳过 finish、
  反转 policy、传入 raw field 时都必须红。
- RECALL：definePart.ts、requestOutcome.ts、dispatchWithRequestId.ts、useRequest.ts、
  useDispatchCommand.ts、SystemFailureNotice.tsx、render public invariant。

### CP-3

- 可证伪失败：parts 数量/partKey/rendererKey/surfaceForm/guard 改变，或 wallpaper labels
  有第二住址。
- 不变量：14 个 logical feature parts 仍展开 28 个 sibling；所有 layer guard 和
  dismissal 仍绑定原 partKey；业务行为差异由 hook 保留。
- FORBID：删除 feature 业务 copy/actor、把 wallpaper background 放 base、保留旧 index
  兼容导出、将短 dismissal binding 伪装成 base engine。
- 验证：parts focused 对比 catalog/renderer binding；feature behavior tests 覆盖
  auth/member/wallpaper 业务分流；negative scan 确认旧 alias/label zero。
- RECALL：三包 parts、commands/actors、systemFailureDismissal、现有 feature tests、IA
  preserve rows。

### CP-4

- 可证伪失败：integration 仍有第二份 parser/actor/reduce，或 shared helper 自动扫描
  modules 改变 sync 分母。
- 不变量：package.json values/errorPrefix/command identity/explicit module list/placement/
  theme/persistence 都留 integration；base 只承接无业务机制。
- FORBID：base import integration package.json、base 认识 sample command/wallpaper/
  member 名称、把 isolated 自动加入、制造 mobile SECONDARY。
- 验证：base parser focused 覆盖完整 invalid shape/positive finite/portrait SECONDARY；
  integration focused 覆盖两个不同 explicit module lists 和 public exports。
- RECALL：两个 terminalSurfaces.ts、两个 module.ts、两个 assembly.tsx、console-assembly
  existing types/README、旧 surface authority design 与当前 bytes 的冲突记录。

### CP-5

- 可证伪失败：任何旧路径仍能被生产或测试 import；README/invariant 与真实 exports 不同；
  逐代码对账不是逐行而是抽样。
- 不变量：源码、测试、依赖、README、invariant、base exports 同一口径；无 code/build/runtime
  产物残留；所有 CP 独立对账为 MATCHED。
- FORBID：用 typecheck 代替视觉/行为结论；把静态重构 PASS 写成 runtime/UI 验收 PASS；
  扩展到 Web/Android/device/Metro/DEV/L2/UAT。
- 验证：静态 scan → package typecheck → focused tests → 全批三维对账 → 逐代码与详设对账。
- RECALL：本详设全部条款、IA reconciliation 全部表、requirements 全部 acceptance/forbid、
  project-memory 命中规范。

## 12. 验收场景设计（本批不新增 HTTP）

本批没有 backend HTTP operation、database、migration、seed 或 backend-acceptance scenario；
因此 implementation-design 模板中的 HTTP/DB/seed 场景为 N/A_WITH_REASON。下面是本地 UI/
runtime focused scenario，不是业务验收替代品：

| scenario id（能力命名） | owner 文件 | identity | fixture | request | businessOracle |
| --- | --- | --- | --- | --- | --- |
| typed-part-pair-preserves-catalog | ui-base-render definePartPair test | laptop/mobile components with distinct render identities | 两个不同 props-compatible renderer + shared metadata | 生成 pair、比较两个 catalog/binding、尝试 mutation | 两半 shared catalog fields、layerTier/Guard 相同；rendererKey/form 唯一；返回 frozen |
| tracked-command-outcome-matrix | ui-base-render request support test | synthetic CommandDefinition and real CommandDispatchResult shapes | completed/running/business/system/rejection、旧/新 request ids | run with RETHROW and CONSUME | running 不 finish；terminal finish once；system callback收到原 result；rejection policy 不错 |
| system-notice-presentation-preserves-copy | ui-base-render/component tests + six feature render tests | existing feature testID/message/dismiss | laptop/mobile presentation profiles and safe messages | render, inspect props/tree, press dismiss | visible copy/testID/action unchanged；base tree无 raw error/feature fields |
| feature-pair-registration | three feature parts tests | 14 logical feature part keys | all current component pair imports | build parts and select surface forms | 28 sibling binding exactly one per form；没有 wrapper/alias |
| wallpaper-catalog-single-address | wallpaper feature tests/static scan | none/w1/w2/w3 | assetsById + catalog | render picker/background and inspect labels/source | labels/accessibility all来自同一 feature catalog；pending不改background |
| surface-parser-preserves-declarations | console-assembly parser test | package-free unknown values + both adapters | valid, missing, non-positive, NaN, portrait SECONDARY | parse/get declarations/orientation | exact frozen shape and error boundaries preserved |
| integration-sync-selection | two integration assembly tests | explicit module arrays | ui state, member registry, isolated wallpaper slice | call selectStateSyncSlices | sample-console includes intended member and ui slices; wallpaper excludes isolated and does not auto-add |

每个 focused scenario 必须有真实 red mutation；测试名称、退出码或 testID 存在本身不是
businessOracle。

## 13. 未决项与停机条件

| 项目 | 状态 | 本批允许 | 本批禁止 |
| --- | --- | --- | --- |
| TR-14 对 component basename 包含 Laptop/Mobile 的仓内旧规则 | DEXTER 本专项覆盖，需求稿 R-6 已说明 | 目标 feature 和 wallpaper integration 按目录表达 | 不修改 base/admin-shell 全仓、不得恢复后缀兼容壳 |
| 既有 09-13 surface design 对 parser 重复的历史判断 | 以当前 bytes 重新核对，旧判断不再覆盖当前分母 | base parser + package adapters | base 读取 package.json；保留完整 duplicate parser |
| wallpaper integration laptop-only waiting/welcome | 已由既有 design 证明 mobile 无 SECONDARY | 移入 components/laptop，保留单端 definePart | 创建 mobile 伪 part、改变 displayMode/surfaceForm |
| SystemFailureNotice presentation shape | 已冻结为 rootStyle/cardStyle/actionsOrientation/dismissButtonStyle 四项 | 只在现有 primitive style 类型内传入六个冻结 profile | 新增 style system、任意 props spread 或改变视觉 token |

必须停并回 Dexter 的情况：

1. 需求/IA/interaction/当前源码三者对同一可见事实无法同时满足；
2. 为达到“旧代码不得残留”必须破坏另一个包的公开 contract，且没有当前消费者全集；
3. 发现 mobile/SECONDARY、keyboard、power、admin-shell 或 kernel owner 需要改变；
4. base helper 必须识别某个 sample 的业务 command、文案、资产或 partKey 才能工作；
5. 任意 reviewer finding 证明本计划仍把注册存在当作运行可达，或把 focused/static 说成动态/UI PASS。

## 14. 实施节奏与三维对账

每个 CP 完成后，进入下一个 CP 前由 fresh 独立子 agent 对本 CP 做逐条三维 review：

- 需求维：requirements 的真实目标、明确不做和旧代码不得残留；
- 详设/IA 维：本 CP 条款、owner、路径、IA preservation record、failure/visual facts；
- memory/规范维：六维命中 memory、frontend terminal standard、base owner boundary。

每条输出仅为 MATCHED 或 OPEN，并逐条写 first mismatch、owning path、smallest repair。
OPEN 必须由主 agent 根因修复后交另一 fresh agent 复查，不能带入下一 CP。

全部 CP 完成后再做一次全批三维对账；它重新逐条走完，不是阶段记录汇总。然后才能
进入 focused/typecheck，不能把测试作为发现设计偏离的手段。

## 15. 旧代码不得残留 ledger（实施计划必须逐项关闭）

以下是硬删除/负向扫描分母，任何一项命中均不得交付：

| 旧代码族 | 必须删除/归位 | 负向判据 |
| --- | --- | --- |
| 14 个 feature 无后缀兼容壳 | 删除三 feature components 根下的 14 个 wrapper 文件 | find 不再有这 14 个 basename；生产/测试无旧路径 import |
| 28 个 feature Laptop/Mobile 文件 | 移到 components/laptop 或 components/mobile，并改为职责 basename | target feature components 下所有 paired basename 不带 Laptop/Mobile；目录分布=9+9、3+3、2+2 |
| member 聚合 hook | 删除 hooks/useMemberDesk.ts，拆 9 个 hook | rg useMemberDesk 命中数=0（历史 doc review 可保留，不算生产/测试） |
| auth 聚合 hook | 删除 hooks/useAuthNotices.ts，拆 notice hooks/types/copy | rg useAuthNotices 命中数=0（历史文档除外） |
| parts local wrappers/aliases | 删除 createFormPart/createPart、ComponentType<any>、14 个默认 laptop alias | 三 feature parts 中上述 token 命中数=0 |
| wallpaper labels duplicate | WallpaperBackground 内 local wallpaperLabels 删除，统一从 wallpaperCatalog import | feature production 只允许一个 wallpaperLabels 定义 |
| integration surface parser duplicate | 两个 integration 只保留 package adapter，generic parser 只在 base 一份 | integration production 中 isRecord/positiveFinite/readSurface* helper 命中数=0 |
| startup-ready actor duplicate | 删除两个 integration local createStartupReadyActor | 两个 integration application/module.ts 中 local helper 命中数=0 |
| state-sync reduce duplicate | 删除两个 assembly 内 inline reduce，改调用 base helper | 两个 integration assembly 中 syncIntent !== isolated reduce 命中数=0 |
| integration laptop-only suffix | WaitingLaptop/WelcomeLaptop 移到 components/laptop/Waiting/Welcome | integration component filenames不再带 Laptop；不新增 mobile |
| 模糊 public component exports | 删除 wallpaper feature 的 WallpaperPicker/WallpaperPickerLaptop/WallpaperPickerMobile/WallpaperSystemNotice exports | index/invariant 不再声明这些符号；direct concrete path 由 parts/tests 使用 |

negative scan 必须排除历史 doc/review 记录后执行，并把排除规则写入结果；不能通过删除
历史记录或改字符串来制造零命中。

## 16. 交付前自查与证据档位

| 检查 | 判据 |
| --- | --- |
| §3 行完整 | 固定机制表 19 行均填写；N/A 有理由 |
| §9 mechanism rows | collection shape、authorization、cache invalidation、error mapping、logging/masking 均逐层具体 |
| §10 全链同步 | 每个事实列出源码、前端、测试和 N/A 反例；没有“无影响”空话 |
| IA ↔ 详设 | 20 条 preservation record 与本详设没有同一事实的冲突文字 |
| 计数自证 | 14 logical feature parts、28 paired renderers、14 wrappers、20 IA records 等数字有当前 source 搜索依据 |
| CP 阶段三维对账 | CP-0 至 CP-5 前一步完成后均有 fresh reviewer MATCHED |
| 全批三维对账 | 在整体测试前重新完成，结果只 MATCHED/OPEN |
| 旧代码 ledger | 所有删除项和负向 scan 均 MATCHED；任何残留为 OPEN |
| 逐代码与详设对账 | 实施计划中必须有显式步骤；逐所有 changed lines，结论只 MATCHED/OPEN；OPEN 不得交付人审 |
| 证据档位 | static、focused、Web、Android/native/device、visual、cleanup 分档；本设计阶段全部为未执行 |

本详设完成时的状态是 DESIGN_INPUT_READY_FOR_IMPLEMENTATION_REVIEW，不是
implementation authorization，也不是源码/测试/动态验证通过。
