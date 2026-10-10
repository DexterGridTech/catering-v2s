# TER 项目终端远程控制：需求讨论稿

日期：2026-10-10。作者：Claude。状态：DISCUSSION_DRAFT / DECISIONS_RECORDED / TECHNICAL_FEASIBILITY_OPEN。

本稿记录 Dexter 原始需求、当前仓内事实、官方资料核验及待决事项。当前只授权讨论、纯读取研究和本文写入；不授权实施、依赖安装、部署、设备/DEV 运行或改动阶段 C。不联系正在实施阶段 C 的 Codex。

## 1. Dexter 原始需求（逐字记录）

> codex现在正在对阶段C进行实施，我们不要打扰他。我们来一起讨论一个新的需求，你先全程记录为需求讨论稿。
>
> 我希望项目管理员可以在运营管理后台，当前项目终端信息那个列表里，增加一列当前终端TDP的连接状态。然后在详情抽屉右上角有个“远程控制”（终端不在线不可用）的功能。点击后，打开一个全屏的弹窗，进入远程控制状态。具体的流程和技术栈如下：
> 1，TER增加一个terminal/kernel/base/remote-control包，增加一个terminal/adapter/android/remote包，同时在terminal/kernel/base/platform-ports增加相应的适配器接口。需要引入@livekit/react-native和expo-livekit-screen-share依赖（具体详情需要你在https://docs.livekit.io/intro/overview/查询）
> 2，在远端部署LiveKit Server Go（docker-compose 一键部署）
> 3，在platform-admin中依赖@livekit/components-react
> 4，终端通过TDP连接CBS后，当项目管理员在运营管理后台使用远程控制功能时，通过CBS通过TDP向终端发送command，remote-control包接收后，连接LiveKit Server（需要通过统一serverConfig管理其地址）
> 5，终端与LiveKit Server连接后，运营管理后台的弹窗通过@livekit/components-react可查看终端的UI页面。command与连接顺序需要你自己按照官方用法设计。
> 6，项目管理员点击、拖动@livekit/components-react视频位置，会通过WebRTC 的 DataChannel 下发控制指令，实现远程控制。需要把相对坐标发给 RN避免分辨率差异。找到对应位置的 RN 组件，手动触发事件。（App 内点击，不需要无障碍权限）
> 7，终端有不同机型，mobile、laptop-单机单屏、laptop-单机双屏、laptop-双机配对双屏。laptop-单机双屏不使用 MediaProjection 抓副屏，直接在 RN/Kotlin 层拿到副屏 View 的画面帧（ImageReader 读取副屏 Surface），自己编码生成一路自定义视频轨道 B，publish 到同一个 LiveKit 房间。laptop-双机配对双屏，副机publish 到同一个 LiveKit 房间。Web 管理后台：订阅这个设备的两路视频轨道，页面并排渲染两个 video 组件。- Web 端点击主屏视频 → 下发`{type:"tap", screen:"main", x,y}`，Web 端点击副屏视频 → 下发`{type:"tap", screen:"secondary", x,y}`（仅示意，需要你仔细设计区分单机双屏和双击配对双屏的情况）
> 8，不做语音传输
> 9，一个终端只能同一时间被一个管理员远程控制。
>
> 以上是我的原始需求，请你对需求做记录，并在相应的第三方库的网站上寻找权威材料，做完整的需求与可行性分析，有问题或需要我决策的，分析完再一起问我

## 2. 当前研究边界

- 原始需求保留原文；后续裁决逐字记录在 §14，当前适用语义以该节和同步后的正文为准。
- LiveKit 官方资料证明上游能力，不证明本仓兼容性、装配、性能或运行通过。
- 新依赖尚未安装或解析，候选版本不写成实际 resolved version。
- 六项产品/路线答复已记录；技术 OPEN 不因接受路线而升级为运行通过。

## 3. 需求理解与当前结论

本需求解决的是：项目管理员无需到店，即可看到指定终端当前 TER 画面，并操作应用里的控件以协助排查和处理问题。连接状态让管理员先判断是否值得发起；远控会话把管理员、终端、屏幕和控制权绑定起来。

**静态分析结论：目标合理，LiveKit 可承载媒体与控制数据；已有 TDP 可承载发起/结束指令。但用户描述中的两处实现假设需要修正，Android 连续捕获和自定义轨道桥还不能写成已证明可行。** 本稿不是 DESIGN GO，也没有实施或运行授权。

| 分类 | 内容 |
| --- | --- |
| 已明确的产品目标 | operations-admin；新增远控权限；在线才能发起；全屏媒体工作区；TER 应用内点击/拖动/滚动及虚拟键盘；四种机型；双屏并排；不传音频；每终端单管理员；终端无提示/确认/遮罩；本地与远程同时可操作；断连手动重新发起 |
| 已有能力可复用 | CBS terminal-control 的在线 command 投递与结果；TDC 的接收/执行；Topology peer command；server-config 地址；双屏 Activity/Presentation Window；后台列表/Drawer/foundation |
| 官方支持的上游能力 | LiveKit Room、多 track、Web VideoTrack、数据消息/RPC；Android 自有 Window 的 PixelCopy 与正常 touch dispatch；Compose 自托管 |
| 不能直接成立的实现假设 | ImageReader 直接读取任意现有副屏 Surface；找到 RN 组件后手动 onPress 就等价点击/拖动；依赖已声明就代表 Expo/RN 兼容；只有 WSS 可达就代表 WebRTC 媒体可达 |
| 本期关键技术 OPEN | 精确依赖组合；Native capture → RN WebRTC track → LiveKit publication；双屏持续采集性能；真实触摸/窗口覆盖；目标网络与媒体释放 |

已裁决内容在正文明确标出；其余工程落点仍为建议。PixelCopy 与正常触摸分发路线已获接受，SDK/轨道桥、持续采集性能仍未验证。后续正式需求须沿用 §14 的原话与适用边界。

## 4. 当前仓内事实与复用落点

读取截面为本次研究期间的当前源码。Codex 正在修改阶段 C，以下位置是导航；以后详设必须重新打开实际 owning source，不依赖本稿冻结其实现。

| 事实 | 仓根相对路径与位置 | 对本需求的含义 |
| --- | --- | --- |
| 存在门店级终端管理入口 | `contracts/catalog/admin-catalog.json:897–934`；`apps/frontend/operations-admin/src/features/store-terminal/model/useStoreTerminalReadModel.ts:27–62` | 是 STORE 范围，不能称为项目全体终端列表 |
| 存在项目级“终端更新状态”Tab、列表与详情 | `apps/frontend/operations-admin/src/features/terminal-update/ui/ProjectTerminalUpdatePage.tsx:83–95,609–672,782–844,974–1017` | 最贴近原话；建议复用这里，不新造第三个终端列表，具体入口待确认 |
| 项目列表从终端事实出发，不限于已有报告 | `apps/backend/catering-business-server/modules/terminal-update/src/main/java/com/catering/v2s/terminalupdate/application/persistence/TerminalUpdateReportPersistence.java:107–121` | 包含本项目启用门店的启用终端；未激活/未上报也可能在列表中 |
| 项目读按真实 context、路径和角色范围判断 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/terminalupdate/OperationsTerminalUpdateReadController.java:96–119,176–192` | 读取准入不能代替新增远控写权限 |
| CBS 已有在线 command owner | `apps/backend/catering-business-server/modules/terminal-control/src/main/java/com/catering/v2s/terminalcontrol/api/TerminalControlOwnerApi.java:10–17,28–66`；`application/TerminalControlOwnerService.java:35–74` | 复用 `invokeOnline/readOperation/claimOnlineOperation/acceptTerminalReport`，不新建远程 operation 平台 |
| 数据库 claim 复核 session/sequence/binding | `apps/backend/catering-business-server/src/main/resources/db/migration/V20261004_020000_000__terminal_control_online_operations.sql:40–79` | 发起必须绑定当前激活代次与连接身份，不只相信前端的“在线” |
| TDC 接到 command 后走本地 Runtime | `apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts:681–752` | start/stop 可进入新 remote-control actor；TDC 不承担屏幕控制业务 |
| PG latest_state 是连接当前事实 | `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/state/TdsConnectionStateRepository.java:24–78` | 不用 Doris 历史推导当前在线 |
| 断开写入是异步、有失败保留路径 | `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/state/TdsConnectionStateWriter.java:62–65,102–129` | “未写断开”可能是旧事实，不应直接承诺一定可控制 |
| 当前在线候选只检查未断开 | `apps/backend/catering-business-server/modules/terminal-control/src/main/java/com/catering/v2s/terminalcontrol/persistence/TerminalControlPersistence.java:35–41` | 复用现有在线投递判定；节点未写断开的残余由发起失败/超时解释，不新增 freshness 数据源 |
| 双机 peer command 已存在 | `apps/terminal/kernel/base/topology/src/application/createTopologyPeerCommandController.ts:464–474,489–503,555–570` | 主机可以发 command 让副机加入 Room；副机仍不连 TDS、不独立激活 |
| server-config 有多地址与 selector | `apps/terminal/kernel/base/server-config/src/types/serverConfig.ts:7–20,36–46,85–90`；`src/selectors/selectServerConfiguration.ts:49–68` | LiveKit endpoint 应在同 owner 中配置；HTTP proxy 不等于 RTC 网络支持 |
| PlatformPorts 暂无 remote port | `apps/terminal/kernel/base/platform-ports/src/types/platformPorts.ts:36–62` | 需新增强类型端口与默认 unavailable 实例；本轮不实施 |
| 同机副屏是独立 Presentation Window | `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt:733–780,990–1029` | 副屏真实承载已存在，不应重建第二渲染树 |
| 已有 Window 身份/几何 registry | 同文件 `:288–449`，`TerminalSurfaceHostRegistry` | 目前只记录 Window/snapshot，未提供像素采集或生产触摸 API；可扩接现有 owner，而非复制窗口表 |
| 自动化 semantic act 只有有限动作 | `apps/terminal/ui/base/automation-agent/src/foundations/protocol/controls.ts:21`；`src/foundations/registry/createAutomationNodeRegistry.ts:157`；`apps/terminal/ui/base/primitives/src/foundations/nativeSlots.tsx:176–223` | 手动 callback 不是完整手势；生产远控不能直接启用 debug agent |
| 当前 RN lock 为 0.86.3 | `yarn.lock:12269`；Android application manifests 声明 Expo `~57.0.18` / RN `0.86.3` | 已知源码/锁截面，不是新增 LiveKit 兼容或运行证明 |

适用约束：本次已恢复 `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、全部 kernel 与六维命中的项目记忆原文。业务语料关注 G-01 集团空间、G-03 组织关系、G-05A 授权范围、G-07 角色；规则以 `project-memory/decisions/confirmed-business-language-corpus.md` 及其来源为准。TER 包方向/command-selector/端口/多屏/调试剔除按 `doc/platform/terminal-coding-standard.md` 的 TR-03、TR-05、TR-08、TR-11、TR-16、§4-E/§4-F；后台入口与容器按前端规范及 foundation。本文不是新规范正本。

## 5. 上游核验与依赖建议

### 5.1 SDK 与指定插件

LiveKit 官方 Expo 入门要求 RN SDK、LiveKit WebRTC fork、官方 Expo plugin、WebRTC config plugin 和 `livekit-client`；Expo Go 不兼容，需 native development build。引入原生依赖后也需要新的 APK/FULL 基线，不能仅靠现有 HOT 加入 native 能力。[官方 Expo 入门](https://docs.livekit.io/transport/sdk-platforms/expo/)

| 候选 | 本次公开上游核验 | 当前仓内状态 |
| --- | --- | --- |
| `@livekit/react-native` | 精确发布 tag `3.0.0`；peer WebRTC `^144.2.0`、client `^2.20.0`，Node ≥20 | 未安装/未解析，兼容 OPEN |
| `@livekit/components-react` | 精确 tag `2.9.24`；React/ReactDOM ≥18 | 未安装/未解析 |
| `@livekit/react-native-expo-plugin` | 主分支 package `1.0.3`；Android 可配置 screen-share service | 主分支依据，不是锁定版本证明 |
| `expo-livekit-screen-share` | 维护方 package `0.2.1`，MIT；RN SDK ≥2 / Expo ≥51 | 存在，但不是 LiveKit 官方维护；不能据宽 peer 认定本仓兼容 |
| Go LiveKit Server | 公开发布页可见 `v1.13.9` | 尚未选定部署版本/digest |

版本来源：[RN 3.0.0 package](https://raw.githubusercontent.com/livekit/client-sdk-react-native/@livekit%2Freact-native@3.0.0/package.json)、[Components 2.9.24 package](https://raw.githubusercontent.com/livekit/components-js/@livekit%2Fcomponents-react@2.9.24/packages/react/package.json)、[官方 Expo plugin package](https://raw.githubusercontent.com/livekit/client-sdk-react-native-expo-plugin/main/package.json)、[指定插件维护方 package](https://raw.githubusercontent.com/arekkubaczkowski/expo-livekit-screen-share/main/package.json)、[Server releases](https://github.com/livekit/livekit/releases)。这些是候选核验，不是“必须升级到最新”。详设应按实际选定版本重新核对锁和官方源码。

指定插件的 Android 描述主要是添加 foreground service 权限/配置；官方 plugin 已有 `enableScreenShareService`，RN SDK 也有标准屏幕共享路径。[指定插件 README](https://github.com/arekkubaczkowski/expo-livekit-screen-share#android)、[官方 plugin 配置](https://github.com/livekit/client-sdk-react-native-expo-plugin#configure-appjson)、[RN screen-share 说明](https://github.com/livekit/client-sdk-react-native#screenshare)

**Dexter 已明确：该插件仅供参考，不强制引入；核心要求是有成熟能力就复用，不重复造轮子。** 优先使用官方 SDK/plugin 及仓内能力；只有已核实缺口才写必要的 Android capture/input/bridge 适配，不自建编码器、WebRTC 协议或控件寻址框架。候选是否需要仍由实际选定版本与用途决定，而非把所有插件一起安装。

### 5.2 多轨与自定义捕获接缝

LiveKit 允许一个 participant 发布多条 track；Web 可用多个 `VideoTrack` 按 `trackRef` 呈现。因此同机双屏不需要两个 Room 或两个管理员连接。[Room/participant/track 模型](https://docs.livekit.io/intro/basics/rooms-participants-tracks/)、[VideoTrack](https://docs.livekit.io/reference/components/react/component/videotrack/)

`livekit-client v2.20.1` 的 `publishTrack` 接受 `LocalTrack | MediaStreamTrack`；screen-share helper 按 source 查已有 publication，不能通过连续调用开关就宣称产生两块屏的独立轨道。[精确 client 源码](https://raw.githubusercontent.com/livekit/client-sdk-js/v2.20.1/src/room/participant/LocalParticipant.ts)

LiveKit WebRTC fork 的上游主分支有 `createVideoTrack/registerTrack/createStream` 原生接点，但**还没有取得并证明本仓将采用的精确 WebRTC 版本桥接路径**。任意 Kotlin VideoTrack 不能直接当成 JS MediaStreamTrack。RN 3.0.0 还更改了 Android WebRTC namespace；后续不得复制旧示例导入。[上游主分支 WebRTCModule](https://raw.githubusercontent.com/livekit/react-native-webrtc/master/android/src/main/java/com/oney/WebRTCModule/WebRTCModule.java)、[RN 发布说明](https://github.com/livekit/client-sdk-react-native/releases)

结论：自定义 capture → SDK track 的桥是本专项最大技术前置之一，标 `OPEN`。优先复用 SDK 的编码、拥塞控制和 track 发布；不先自写编码/传输协议，也不同时引入 RN Room 与另一套 Kotlin Room 来绕过桥接问题。

### 5.3 DataChannel 与 RPC 的实际保证

LiveKit reliable data 按序并有限重传，仍是 best effort；断线接收方收不到当时消息，服务器不缓冲。可靠 payload 最大 15 KiB；可按 participant identity 定向发送。[Data packets](https://docs.livekit.io/transport/data/packets/)

RPC 可返回接收方处理结果或错误；超时只表示调用方没得到结果，不能推出没有执行。[RPC](https://docs.livekit.io/transport/data/rpc/)

**建议本期先用一条可靠数据路径，合并过密的 move，保留完整 down/move/up/cancel，避免可靠/有损两套乱序协调。** 回执只表示本地接收/拒绝/分发结果，不冒充业务已完成；普通点击后的实际页面变化仍从视频观察。断线不补发旧触摸，不把输入流放进 TDP 持久 operation 队列。

## 6. 捕获与控制：修正两处技术假设

### 6.1 ImageReader 不能旁读现有副屏

`ImageReader.getSurface()` 给 producer 一个输出目标；producer 必须主动往它写 buffer，reader 才能读。它不是任意现有 Surface 的读取器。[Android ImageReader](https://developer.android.com/reference/android/media/ImageReader#getSurface())

当前 RN `ReactSurface.view` 是 ReactRootView 系统的 View，不等于可旁读的 Android Surface。精确 `v0.86.3` 源码可核实这个区别：[ReactSurfaceImpl](https://raw.githubusercontent.com/facebook/react-native/v0.86.3/packages/react-native/ReactAndroid/src/main/java/com/facebook/react/runtime/ReactSurfaceImpl.kt)、[ReactSurfaceView](https://raw.githubusercontent.com/facebook/react-native/v0.86.3/packages/react-native/ReactAndroid/src/main/java/com/facebook/react/runtime/ReactSurfaceView.kt)。

不建议为此再把副屏渲染一次到 offscreen/virtual display；那会引入第二渲染链，还要证明与顾客眼前的物理副屏相同。

### 6.2 已接受的捕获路线与历史对比

| 候选 | 能力与成本 | 本期判断 |
| --- | --- | --- |
| 主屏走官方 MediaProjection，副屏 PixelCopy 自定义 track | 主屏 SDK 标准路径较直接；需要 Android 屏幕共享授权/foreground service；两种捕获源与边界不同 | 历史比较项，未选用；不能满足本轮新增的终端无感要求，不作为 fallback |
| 主屏和副屏都 PixelCopy 自有 Window | Activity/Presentation 分别采样；不使用 MediaProjection；范围限定 TER 自有画面；共享 capture/track 机制 | **Dexter 已接受的研究路线**；持续采样性能和 bridge 仍 OPEN |

Android API26 起提供 `PixelCopy.request(Window, Rect, Bitmap, ...)`，可复制已绘制 Window 的 buffer，支持裁剪/缩放。PixelCopy 一次成功不证明持续实时视频；也不会自动把系统栏、系统 IME、其他应用、独立 Dialog/Popup Window 或独立 SurfaceView 合成进当前源 Window。[PixelCopy](https://developer.android.com/reference/android/view/PixelCopy)、[SurfaceView](https://developer.android.com/reference/android/view/SurfaceView)

MediaProjection 是另一种显示捕获授权路径；Android 要求用户同意，较新 API 对每次会话的授权和 foreground service 有明确约束。[Android MediaProjection](https://developer.android.com/media/grow/media-projection) 当前已选择自有 Window 路线；不采用会弹出本机共享确认的 MediaProjection，也不以绕过系统授权达成“无感”。

### 6.3 不通过手动 onPress 模拟完整触摸

直接调用 RN callback 不能忠实覆盖遮挡命中、Pressability、ScrollView 父级拦截、拖动取消、TextInput 焦点等行为。RN 的正常触摸是 responder/dispatcher 流程，不是简单的组件坐标查找。[Pressability v0.86.3](https://raw.githubusercontent.com/facebook/react-native/v0.86.3/packages/react-native/Libraries/Pressability/Pressability.js)

**已接受的路线：Web 的操作进入 remote-control command/actor，由 Android remote port 在主线程向对应 Activity/Presentation 分发普通 MotionEvent。** tap 是 DOWN→UP，drag 是 DOWN→MOVE*→UP，断链/窗口变更是 CANCEL；由 Android/RN 的正常命中和业务 handler 决定实际动作，不新增一套控件注册、语义 callback 或自动化 socket。[Activity.dispatchTouchEvent](https://developer.android.com/reference/android/app/Activity#dispatchTouchEvent(android.view.MotionEvent))、[Presentation](https://developer.android.com/reference/android/app/Presentation)、[RN ReactRootView v0.86.3](https://raw.githubusercontent.com/facebook/react-native/v0.86.3/packages/react-native/ReactAndroid/src/main/java/com/facebook/react/ReactRootView.java)

这是**源码支持的可行性推论**，不是设备证明。它仅操作本进程拥有的 Window，不具备系统级输入注入能力。原生安装框、Android 设置、其他应用不会因此可操作。当前 TER 虚拟键盘在本应用 surface 内，原则上可沿同一视频/触摸路径操作；准确覆盖仍需目标设备验证。

### 6.4 性能与窗口边界

采样应保持少量可复用 buffer、最多一个 in-flight copy，慢消费者丢旧帧，不无限积压。帧数据留在 native/SDK，不逐帧经 JS JSON/base64 传输。捕获频率、分辨率和编码参数由后续测量选择，不在讨论稿虚构 SLA。

1280×720 RGBA 单帧约 3.69 MB，30 fps 两屏仅像素读回即约 221 MB/s，尚不含格式转换/复制/编码；这是算术提示，不是性能实测。后续最小 proof 应看画面可用性、端到端延迟、UI 卡顿、CPU/native 内存及 stop 后释放。不得为了指标先引入截图 diff、独立编码器或第二渲染树。

独立应用 Dialog/Popup、系统 IME、特殊 native 视频层是否进入画面与触摸分母，要明确列出；不能用主 Window 的成功推导全部屏幕成功。

## 7. 职责与依赖建议

| 位置 | 负责 | 复用与边界 |
| --- | --- | --- |
| CBS `terminal-control` | 远控会话、管理员独占、当前 binding/session 准入、Room 身份及 token 签发；start/stop 操作记录 | 复用现有在线 operation 和 IAM/组织 grant、审计；不新建第二远程指令 owner |
| TDS/TDC | 已有 TDP command 投递、执行结果与连接 selector | 不承载屏幕帧，不成为 WebRTC relay；TDC 仍是终端凭证唯一 owner |
| `kernel/base/remote-control` | 自己的 command、actor、会话状态/selector；start、stop、媒体事件、输入准入与错误呈现事实 | 不依赖 React/LiveKit/native 类、不放项目业务实体；跨包只发 command/读 selector |
| `kernel/base/platform-ports` | 强类型 RemoteControlPort 能力、结果与默认 unavailable | 公开形状不暴露 Room/VideoTrack/Bitmap/Activity；不扩成任意系统输入口 |
| `adapter/android/remote` | LiveKit SDK 装配、capture/track、Window 内触摸和媒体资源释放 | SDK/native 细节留此层；事件转换成 owner command，不以业务 callback/event bus 替代 actor |
| 现有双屏/Window owner | 提供当前应用真实 Window 身份与生命周期接缝 | remote adapter 不自行建立平行显示表，也不修改业务布局 |
| `server-config` | LiveKit 连接地址及既有配置路径 | composition 把解析配置交给 adapter；无 server API secret、无 Room token 长期配置 |
| `topology` | 主机把 join/stop command 发给当前配对副机 | 不传视频；副机仅凭本会话授权连接 LiveKit，不连 TDS、不变独立终端 |
| `operations-admin` | 列表状态、详情动作、全屏工作区、视频与 PointerEvent、失败/结束反馈 | LiveKit React 组件加既有 foundation；不复制 overlay lock/列表生命周期 |
| application/integration | 端口和模块装配、就绪事件接缝 | 不写远控会话业务，不引入第二 SDK 连接 owner |

remote-control 的运行会话建议是本机 ephemeral、sync isolated 状态；重启/reload 后不从持久化自动恢复旧控制权。主机向副机发送的是当前会话的明确 command，不投影 SDK/native handles 或整份控制状态。视频帧始终留在 native/SDK；只有生命周期、错误与控制消息进入 command/actor 路径。

Dexter 已确认原文 `platform-admin` 是笔误，应为运营管理后台，仓内目录为 `operations-admin`。React 媒体组件在该 app 接入；运维后台不新增本期远控面。

LiveKit 是新增的媒体基础设施，不拥有业务数据库/Flyway。未来设计/实施授权要具名说明它与现有远端受管运行、网络、预算、cleanup 的关系；本讨论不把部署一句话变成部署授权。

## 8. 端到端链路建议

### 8.1 发起与就绪

1. 管理员在当前项目终端列表查看连接事实，打开终端详情；动作通过现有 `AdminDetailActionMenu` 的“操作→远程控制”进入。无远控写权限、未激活或已知离线时不可发起。**占用提示只在管理员点击远程控制后出现**；不增加列表占用列、抽屉常驻占用提示或提前按占用禁用按钮。
2. CBS 以真实运营 session、项目/门店/终端范围和具名远控写 capability 准入，复核当前有效 binding 与连接；原子占用该终端的控制会话。第二个发起请求不能靠 UI 禁用避免争用。
3. CBS 创建本次 Room/session 身份，再调用既有 terminal-control 在线投递 start command。原指派简称“连接 CBS”，真实链路是 TER 的 TDC↔TDS 长连接，CBS 经 PostgreSQL owner 路径投递。
4. start command 只携带必要会话引用和身份；终端 remote-control actor 复核当前激活/拓扑/运行资格，取得短期 Room 授权，通过 RemoteControlPort 加入 LiveKit。**终端无需确认，不显示提示、标识、遮罩或新增结束控件，不切换原业务页面。** 浏览器可同时加入并显示“正在连接”，不必等待每个步骤串行结束。
5. 同机双屏发布两条 track；双机主机通过 peer command 让当前配对副机加入同一个 Room 并发布其画面。每条 track 显式绑定屏幕槽位与机器身份。
6. 收到目标 track 并完成端点/画面几何就绪后，对相应 video 开启操作。TDP command 返回成功只证明该 command 的实际结果，不自动等于画面已就绪。双机配对远控须两屏就绪后进入可操作状态；任一屏未能连接则在后台显示失败并结束本次会话，不降级为单屏远控。

Room token 由 CBS 签发，server secret 只在受信服务端。**不把 JWT 写进 server-config、同步的业务 slice、持久 remoteOperations payload/result、日志或审计。** token 交付必须通过真实认证的短期授权路径，且核查 Runtime journal/command result 的实际去向；只用“内存里取一次”描述而未核查通路，不算闭合。token 如何经现有 command/request 与 transport 安全交给 port，是详设落点，不在这里另造凭证系统。

浏览器的 Room 权限建议仅订阅视频并发送控制数据；终端只发布本次会话的屏幕视频及必要数据回执，均不采集麦克风、摄像头或屏幕音频。token 的 source grant 必须与自定义 track 的实际标记对齐，不能先猜 source。终端还要校验数据发送者是本会话指定管理员 participant，Room 成员身份不自动等于控制权。

### 8.2 会话结束与独占

单管理员独占保持原需求；建议计入同一 CBS 终端及其当前配对扩展，同一账号第二 Tab 不形成第二会话。Dexter 明确只在点击远程控制时提示“当前机器已经受控”；CBS 以原子准入拒绝第二会话，不依靠列表显示来保证互斥。本期不排队、不抢占、不转交。

建议关闭全屏工作区、管理员主动结束、终端退出/重启、激活失效或 TDP 会话失效时结束远控。**Dexter 已裁决断连后必须由管理员手动重新点击发起；不自动恢复远控，也不恢复旧控制权或回放旧点击。双机配对时，无论主屏还是副屏断连，都结束整个远控会话。** 两屏均停止远程输入，取消当前远程手势，停止本会话的采集/发布，释放占用；运营后台显示会话已结束及断连原因。主副配对断链同样使本次会话结束，不保留主屏继续控制的降级分支。网络或配对恢复后，仍须管理员手动重新发起；终端本地业务操作不因远控结束而锁定。

正常结束既要清业务占用，也要停止 capture/track、取消当前手势并释放 Room/native 资源；SDK disconnect 成功不能代替本地释放成功。对浏览器崩溃/网络丢失，使用有限会话有效期和连接事件作最终回收依据。详设须核实并处置 SDK 自动重连行为，保证已判定断连后不能偷偷恢复画面控制；只保留检测和释放，不建自动恢复或持久输入队列。

**自托管 LiveKit 的 kick/权限变更不会撤销已有 token，token 到期也不等于已连接参与者立即断开。** 因此结束必须由终端当前会话/授权状态拒绝旧输入；新会话使用新的 Room/session 身份。不能仅以“踢掉管理员”或“JWT 很短”证明独占。[官方 token lifecycle/revocation](https://docs.livekit.io/frontends/reference/tokens-grants/)

### 8.3 最小留存建议

复用当前 operation/标准审计保存发起人、终端、时间、结束原因和成功/失败事实。媒体和逐触摸数据不做长期记录；本期不录屏、不传音频、不新增点击轨迹库。是否增加远控会话历史页面属于后续需求，不为当前功能先建看板。

## 9. 四种机型的画面和输入路由

| 机型 | TER 内容 | LiveKit 发布者/轨道建议 | 后台显示与输入目标 |
| --- | --- | --- | --- |
| mobile | MMP：master + primary | 一个本机 participant、一条主屏 track | 一块视频，路由到本机主 Window |
| laptop 单机单屏 | LMP：master + primary | 一个本机 participant、一条主屏 track | 同上 |
| laptop 单机双屏 | LMP / LMS：master + primary / secondary | 一个本机 participant、两条独立 track | 主/副视频并排；均发给同一机器，再按 screen 槽位选择 Activity/Presentation |
| laptop 双机配对双屏 | 主机 LMP；副机按已确认供电切换显示 LMS 或 LSP | 主机、当前配对副机各一个 participant、各一条 track；同 Room | 主/副视频并排；副屏输入直接定向其 Room participant，但仍受主机控制会话与配对身份限制 |

双机副机即使显示 LSP，仍是主机扩展，不成为 CBS/TDS 独立终端，不上报独立激活身份。LiveKit 需要识别技术 participant，但不能据此给副机建立第二个 CBS terminal/binding。

逻辑“主屏/副屏”只是在本控制会话中的稳定槽位；不能直接等同 `ui-state master/slave`、PRIMARY/SECONDARY 或 Android displayId。双机副机物理屏通常是自己的 primary，业务呈现却可能是 LMS；显式映射避免把副机输入发到主机副屏。

配对副机短期 Room 授权通过主机和既有 peer command 获取，不能广播同步到所有 slice。主机不代传副机视频，副机自己发给 LiveKit；没有视频经 TDP/Topology 传输的新增大流量路径。

## 10. 相对坐标与手势协议建议

不预先定详细 wire schema，但必须绑定以下事实：本次控制会话、目标 participant、屏幕槽位/track、当前 Window generation、画面几何版本、手势身份及序号。只发送 `{screen,x,y}` 不足以在双机、旋转、重建窗口时保证命中正确目标。

1. 浏览器以 video 实际内容矩形计算 `u/v∈[0,1]`，排除 `object-fit: contain` 的黑边；DOM 控件、屏幕标签和工具栏不是视频内容。
2. Android 按这条 track 对应的 crop、旋转和 Window 物理像素换算；不把 RN dp、CSS px、物理 px 混为一套，不使用主屏 density 去算副屏。
3. 坐标越界、旧画面几何、旧 participant/会话、目标窗口不存在时拒绝，不回退到另一块屏。
4. 单 pointer 主流程支持 tap 和 drag/scroll；按下后浏览器使用 pointer capture，指针出视频或工作区关闭时发送 cancel。move 合并但不能丢掉终止边界。
5. SDK 的媒体生命周期、收到的控制消息与输入结果转换成 remote-control 的 command；actor 是准入与 slice 唯一写者，公开读取只走 selector。像素帧不经 command 广播或 JS state。
6. 实际触摸分发不是业务绕过：仍由被点击控件自己的 command/actor 处理业务。不开任意 selector/脚本调用面来替代远控。

相对坐标计算是明确的工程工作，并非 LiveKit VideoTrack 自动提供的能力。现有 `tools/terminal-automation/src/androidWindow.ts:109` 的窗口偏移/逐屏 density 是可读参考，driver 的 adb 输入不是生产远控实现。

Dexter 已确认本期点击、单指拖动/滚动及点击 TER 自有虚拟键盘；不新增通用远端文本注入/剪贴板。双指缩放、系统按钮、文件传输、跨应用控制不因“远程控制”一词自动进入范围。

**本地与远程可以同时操作。** 不锁定本地输入、不加业务遮罩或抢占提示；也不把先前“本地输入优先”建议写成排斥远控的产品规则。同时可操作不等于两路手势能任意拼成一个 MotionEvent 流：适配器需保留各自手势身份，以正常输入顺序处理同一 Window 的事件；发生真实手势冲突时只做必要的取消/收束，不能冻结整个本地或远程会话。具体最小处理须由真实 RN/native 调用链和后续 focused proof 确认，不新增多用户协同引擎。

## 11. 状态列、页面、权限建议

### 11.1 TDP 连接状态

激活状态、TDP 当前连接事实、远控会话状态是三个维度，不能压成一个布尔。列表接口按当前 binding 关联 PG latest_state，以集合型任务 join/batch read 返回必要身份、最后心跳和断开事实，不逐终端 N+1 读取，不给页面复制一张在线表。

建议状态列显示“在线 / 离线 / 状态待确认”，未激活终端则提示“未激活，尚无连接”；同时有最新观察时间。后端不存一个合并状态；占用事实由发起命令准入核验，本期不在列表/详情提前呈现。已知断开是离线，无断开但心跳超过可解释期限为待确认/不可发起；期限应依据现有 ping/pong 与写回节奏，而非随意填一个秒数。最终中文与阈值待详设。

列表可以采用现有查询/刷新能力。本期不为这一列先建立新的浏览器推送/轮询平台；若 Dexter 要求实时自动变更，再明确刷新方式与时效。点击入口时必须服务端再次核验；即使列表显示在线，节点异常/网络丢失也可能使启动失败或结果未知。

### 11.2 入口与全屏工作区

建议仅扩现有项目 Tab：状态列；详情右上角操作菜单项“远程控制”；全屏工作区含终端/门店、连接提示、主/副屏标签、结束/关闭和错误原因。点击发起被拒绝时才显示“当前机器已经受控”。未就绪视频不能继续发送输入，不使用会议示例中的麦克风、摄像头和聊天工具栏。

列表、分页、详情 Drawer、动作菜单、错误与 overlay lock 复用 `libraries/frontend/admin-ui-foundation`。全屏是本需求指定的媒体工作区，应在未来 IA 中明确为具名 surface；不因普通编辑 Modal 的尺寸规范偷偷改成小弹窗，也不复制第二套 shell 锁。

### 11.3 权限

Dexter 已裁决新增远程控制权限，只有获得权限的人能使用此功能。建议以具名 PROJECT 写 capability（名称留待契约设计）落实，授予允许远控的项目运营角色；复用现有 IAM grant 和组织 target 复核。角色能读列表不等于能操作终端，规则管理 capability 和门店编辑 capability 也不能自动借用。

控制准入至少同时核验：当前运营账号/任职/角色、项目范围、终端归属、有效激活和当前连接、独占会话。不能由请求体项目 ID、前端 disabled 或 Room token 自行推出授权。只读状态列继续遵守现有 read scope，不给 GET 附加写 capability。

终端交互已裁决为无感：不做本机确认、提示、遮罩或新增退出入口；本地正常业务、输入和已有管理入口保持可操作。授权与开始/结束反馈在运营管理后台完成。

## 12. 地址、部署与网络

server-config 新增 LiveKit 服务 endpoint，走既有 defaults/serverSpaces、主机配置和副机只读投影；它不是 CBS 激活 URL 的后缀，也不包含 room/token/secret。CBS/browser 与 TER 可以拥有各自可达 endpoint，但必须指向同一受信服务与对应 Room，不允许客户端任意换服务器。

官方 self-host VM 方案可生成 Docker Compose 与 LiveKit/Caddy/Redis 配置；受信证书、DNS、ICE/TURN 地址/端口仍须配置，不能把“一键部署”理解为不需要网络条件。[官方 Compose/VM](https://docs.livekit.io/transport/self-hosting/vm/)

WebRTC 还需要实际媒体网络。官方列出 ICE TCP 7881、UDP 范围或 UDP mux，以及可选 TURN UDP/TLS；TLS 证书与 TURN advertised 地址必须符合目标环境。[官方部署](https://docs.livekit.io/transport/self-hosting/deployment/)、[端口/防火墙](https://docs.livekit.io/transport/self-hosting/ports-firewall/)

现有 Java HTTP/WebSocket tunnel 与 HTTP proxy 不证明这些媒体通路可达。建议本期只做单实例辅助媒体服务，使用官方支持的 TURN 选项处理实际网络阻断；不先建多区域/HA/录制/Ingress/Egress。具体主机、域名、端口和受管资源所有权在未来部署设计中确认，当前未部署。

## 13. 后续最小可行性与验收内容（仅计划）

### 13.1 应先证明的三件事

| 前置 | 最小证明目标 | 当前 |
| --- | --- | --- |
| SDK/轨道接缝 | 当前 Expo/RN 的实际锁定组合；自有 Window 一路 frame 能经准确 native bridge 发布并在 Web 显示 | OPEN / NOT_RUN |
| 双屏和输入 | Activity、Presentation 各自画面正确；主/副屏 tap 与滚动命中正常；capture 和 input 绑定同一 Window；无语音 | OPEN / NOT_RUN |
| 真实网络与释放 | 浏览器/终端/副机到远端 LiveKit 可连；结束后 track/capture/手势/会话占用释放 | OPEN / NOT_RUN |

前置失败要定位 SDK、capture、bridge 或网络边界，不能用第二渲染树、启用生产 automation-agent、adb/无障碍或另一个会议 SDK 作为静默 fallback。

### 13.2 业务主流程场景

以下是需求讨论中的后续验收建议，不授权运行，不把场景表当已通过证据。

| 场景 | 必须能观察的结果 |
| --- | --- |
| 状态和准入 | 在线/未激活/离线/旧心跳显示有区分；离线不可发起；伪造其他项目 terminalRef 被 owner 拒绝 |
| mobile / laptop 单屏 | 浏览器看到本机 TER，点按钮、滚列表、点虚拟键盘；由真实业务 selector/readback确认动作而非只看发送成功 |
| 单机双屏 | 同 Room 两 track；不同 density/尺寸、video 黑边下分别命中正确 Window，无主副串屏 |
| 双机配对 | 主/副分别 publish；副机不连 TDS；LMS/LSP 供电确认切换后目标仍正确；两屏就绪后可控制；分别断开主屏、副屏或配对链路，均结束整个会话并停止两屏远程输入；恢复连接不自动重入，须手动重新发起 |
| 权限与终端无感 | 有远控权限才能发起；终端不弹确认、不显示远控提示/遮罩、不跳转业务页；原业务可继续操作 |
| 独占 | 两管理员/同账号两 Tab 同时点击发起仅一会话成功；失败者点击后收到“当前机器已经受控”；列表/抽屉不提前呈现占用 |
| 本地/远程同时操作 | 两端各能点击、滚动和使用虚拟键盘，不锁本地；同一 Window 的手势冲突有正常收束而非卡死或永久禁用 |
| 结束/普通断链 | 关闭、网络断开、终端重启/取消激活后停止输入；网络恢复不自动恢复远控；管理员手动重发起才获得新会话；无旧手势重放；本次资源完成 cleanup |
| 已知不可控界面 | Android 系统安装/设置不被误称应用内可控；独立 Window 的覆盖范围有明确实际结果 |

非 adapter 状态/command/路由行为按 TR-16 先在 integration Expo Web；真实捕获与 Android input 是 adapter 行为，需要设备验证，不能由 Web mock证明。自动化复用当前 `tools/terminal-automation`/skill，不复活旧 runner。受管端口、媒体服务及设备资源都要记录本 run 所有权与 business/cleanup，但本轮没有读取运行 evidence。

## 14. Dexter 六项答复与当前适用语义

### 14.1 原话逐字追加（2026-10-10）

> 1，是笔误，应该是operation admin
> 2，接受，在TER应用内
> 3，expo-livekit-screen-share是我在其他地方看到的，供你参考，我的核心诉求是有轮子就用，不要自己造
> 4，增加远程控制权限，有权限的人才能使用这个功能。终端无感，不做任何变化。
> 5，只有点击远程控制的时候，才提示当前机器已经受控。断连后，需要手动重新发起
> 6，确认。本地和远程都可以同时操作

后续断连边界裁决：

> 双机配对时，某一个屏断连？结束会话，重新发起

### 14.2 处置与边界

| ID | 当前语义 | 状态与正文落点 |
| --- | --- | --- |
| D-1 | 后台为运营管理后台，仓内为 `operations-admin`；原 `platform-admin` 是笔误 | 后台名称 CLOSED，§7/§11；具体项目 Tab 仍按 §4 现有来源作为入口建议，后续 IA 点名确认，不把此次更名当逐屏 IA 已接受 |
| D-2 | 接受自有 Window PixelCopy + 正常触摸分发路线，仅 TER 应用内 | 路线 CLOSED，§6；性能、bridge、窗口覆盖仍 OPEN/NOT_RUN |
| D-3 | 指定插件是参考，成熟轮子优先，不重复实现已有能力 | CLOSED，§5.1；实际依赖选型及精确兼容性仍须核验 |
| D-4 | 新增远控权限；有权限的人可用；终端无感，不新增提示/确认/遮罩或退出控件 | CLOSED，§8.1/§11.3；capability 标识与 IAM 契约由详设落实，不默认所有项目角色都有权限 |
| D-5 | 点击时才提示占用；断连后手动重新发起，旧会话不自动恢复；双机配对任一屏断连均结束整个会话 | CLOSED，§8.1/§8.2/§13.2；没有主屏继续控制或副屏自动恢复的分支 |
| D-6 | 点击/单指拖动/滚动及虚拟键盘；本地与远程同时可操作 | CLOSED，§10；不采用全局输入互斥或本地优先的产品模式，必要的单次手势收束仍须源码/运行核验 |

上述答复不授权实现或运行，也不把 SDK/API 存在当成本仓能力已验证。技术 OPEN 由后续获授权的最小可行性证明解决。

## 15. 本轮完成与证据边界

- 完成：原始需求逐字记录；当前 repo/规范/记忆纯读取；三路只读源代码与官方资料研究；本稿归纳与待决问题。
- 未做：源码、规范、项目记忆、依赖或阶段 C 修改；未联系 Codex；未安装/解析新增依赖；未生成、编译、测试、verify、DEV、Web、设备、部署或数据操作；未读取 `.runtime/`。
- 新能力的兼容性、UI、所有运行与 cleanup 均为 `OPEN / NOT_RUN`。子 agent 的研究结论不是 fresh DESIGN review verdict；本轮不宣称需求已经正式批准。
- 已追加：Dexter 六项答复及正文同根修正，删除与终端无感、手动重发起、同时操作相冲突的当前建议；原话和官方比较依据保留。
- 已追加断连边界：双机配对任一屏断连均结束整个会话，取消两屏远程手势并释放本会话资源；网络恢复后必须手动重新发起。同步修正启动、结束及验收场景。
- 后续：具体页面/控件在 IA 中确认；技术可行性仍为 OPEN。只有后续明确授权才能进入正式需求、详设、实施或可行性运行。


## 16. 外部评审后的核心主流程收敛（2026-10-10）

Dexter 原话：

> 内容仅供参考，只考虑90%的核心主流程，切勿过度设计

该裁决之后，当前实现输入以正式需求对应条款为准；前文研究建议和已有 review 仍保留原字节来源，不能作为恢复已撤回机制的理由。

- TER/副机只用 server-config 的 livekit 地址；CBS 的终端 grant 不带 url。browser grant 保留其可达 url；各地址指向同一媒体服务。地址错误走启动失败，不让 CBS 再验证终端 URL。
- 在线列复用 PG 当前连接与 terminal-control 已有准入。删除按会话获取 TDS H/W 与 freshness 公式；节点未写断开时不承诺实时在线，点击后的失败可解释。
- MASTER 保留 CBS 租约/续约以释放独占。副机只沿当前 peer join/stop、配对连接、controller 心跳和必要 participant 存活退出，不加周期租约确认 command/时钟折算。
- 输入准备先在端点本机完成，再发 SCREEN_READY。browser 收齐全部预期声明与可显示画面才开放输入；不需要 CONTROL_OPEN/CONTROL_READY 或 ACK.readyStreams。六类消息足够；已有 KEEPALIVE 可触发重发当前画面声明，覆盖 browser 晚入房，不另建恢复循环。
- PixelCopy/普通 MotionEvent 和 SDK 轨道仍是核心接缝。几何变化只更新本机映射/stream 与声明，不加第二几何计时器；旧坐标必须拒绝。双屏/双机全部画面可见、任一断连结束整会话、本地同时操作等已裁决行为保留。
- CBS token/RoomService 使用官方 JVM SDK io.livekit:livekit-server。官方仓库提供 Java 示例与 Maven 方向；实际版本、解析图及本仓兼容仍由 T-01 核验，不自写 JWT 或另开微服务。[官方 SDK](https://github.com/livekit/server-sdk-kotlin)
- 同根清理旧副机“不领取主机凭证”措辞：沿阶段 C 的 TDC 共享凭证 owner，CBS credential-only 认证；本专项只交付当前 LiveKit grant，不新建凭证系统或放宽副机 TDS 资格。阶段 C 最终源码仍待详设重开。

全部变更为需求文档处置；未修改阶段 C、源码、规范、项目记忆或依赖，未联系 Codex。T-01～T-04 OPEN，UI/全部实现、运行及 cleanup NOT_RUN。作者未为修订字节签发独立 GO，未新增 review 轮次。
