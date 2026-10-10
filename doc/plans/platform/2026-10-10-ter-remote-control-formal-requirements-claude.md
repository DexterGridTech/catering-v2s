---
title: TER 应用内远程控制正式需求
status: PROPOSED_FORMAL_REQUIREMENTS
createdAt: 2026-10-10
author: Claude
implementationAuthority: false
reviewTarget: DESIGN
reviewCycleId: TER_REMOTE_CONTROL_REQUIREMENTS_2026-10-10
---

# TER 应用内远程控制正式需求

## 0. 目的、来源与授权

### 0.1 解决的问题

项目管理员不在现场时，需要查看指定终端正在运行的 TER 画面，并操作应用里的按钮、列表和虚拟键盘，协助现场人员处理问题。运营管理后台先显示终端的 TDP 连接事实，再提供具备独占控制权的远程工作区。终端现场人员仍可正常操作；远控不改变终端的业务页面，也不要求现场确认。

这不是 Android 系统远程桌面，也不是给后台开放任意 Runtime command/selector 的调试台。本期交付应用画面与正常输入，不交付录屏、音频、文件传输、剪贴板、系统设置控制、远程安装或任意脚本执行。

### 0.2 来源与优先级

- 原话、仓内源码导航及上游研究：`doc/plans/platform/2026-10-10-ter-remote-control-requirements-discussion-claude.md`，尤其 §1、§14。
- 本文是本专项正式需求稿；讨论稿保留历史推演。Dexter 后续明确裁决优先于本文。需求与当前源码不一致时，源码只是待改输入，不能反向取消需求。
- 治理：`AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、`scripts/README.md`；TER、前端、后台与第三方规范仍各有唯一正本。
- 项目语料适用集团空间、组织关系、项目授权范围、角色与终端的已有含义：`project-memory/decisions/confirmed-business-language-corpus.md` 的 G-01、G-03、G-05A、G-07。LiveKit participant 不是新增业务人员/终端/组织实体，不能从媒体身份反推业务授权。

### 0.3 Dexter 裁决逐字记录

> 1，是笔误，应该是operation admin
> 2，接受，在TER应用内
> 3，expo-livekit-screen-share是我在其他地方看到的，供你参考，我的核心诉求是有轮子就用，不要自己造
> 4，增加远程控制权限，有权限的人才能使用这个功能。终端无感，不做任何变化。
> 5，只有点击远程控制的时候，才提示当前机器已经受控。断连后，需要手动重新发起
> 6，确认。本地和远程都可以同时操作

> 双机配对时，某一个屏断连？结束会话，重新发起

本轮文档与评审授权：

> 如果没有其他问题，请生成正式的需求稿，将整个的链路，每个细节都描述清楚，包括控制协议的格式，都要在需求阶段定义清楚

> 写好之后需要做几轮对抗性review，直到Go了之后，就按照项目话术要求组织话术把正式需求文档给另一个Claude做review

后续架构与复杂度裁决：

> 一定要符合TER整体架构的用法，不得再自创一套用法

> 保密根本不是我的需求，请不要过度设计

本次外部评审处置裁决：

> 内容仅供参考，只考虑90%的核心主流程，切勿过度设计

落实方式：使用既有 command/actor、request 结果与 selector、topology peer command、platform-ports 和 adapter。入房授权是普通短期通信输入，不为它创建私密消费通路、秘密仓库、专用结果通道或第二状态体系。项目已有权限校验、日志脱敏及禁止秘密落入无关持久记录的规则仍适用。

对应语义：运营管理后台为 `operations-admin`；接受自有 Window 捕获及正常触摸分发路线；插件仅为参考；新增权限；终端无感；占用只在点击时反馈；断连不自动恢复；本地与远程同时可用；双机任一屏断连结束整会话。

### 0.4 当前授权边界

仅生成本需求、进行只读研究与独立静态需求 review、修正确认的文档问题并准备外部交审话术。不联系正在实施阶段 C 的 Codex，不改阶段 C、规范、记忆、生产源码、测试或依赖。不授权详设定稿、实施、依赖安装、生成、编译、测试、verify、DEV、reset/seed、Web/设备运行、L2、UAT 或部署。

正式需求的静态 GO 只表示需求可作为详设输入，不证明 PixelCopy 连续视频桥、SDK 兼容、真实触摸、网络或用户界面通过。技术前置见 §12；本轮全部运行为 NOT_RUN。

## 1. 术语和范围

| 术语 | 唯一定义 |
| --- | --- |
| CBS | `apps/backend/catering-business-server`，唯一业务 deployable |
| TDP | Terminal Data Platform，TDS + TDC；承载连接事实和本期发起/结束控制面，不承载视频和触摸流 |
| TDS / TDC | `apps/backend/terminal-data-server` / `apps/terminal/kernel/base/terminal-data-client` |
| 远控会话 | CBS 为一次管理员发起创建的控制权与资源生命周期，`sessionId` 每次发起均为新 UUID |
| 控制端 | 本次获准的 operations-admin 浏览器 participant；同账号另一个 Tab 也是另一个控制端 |
| 端点 | 发布 TER 画面的机器 participant；由 CBS 分配不包含 PII 的 `endpointId` |
| 屏幕槽位 | 本次会话的 `main` / `secondary`，不是 Android displayId、PRIMARY/SECONDARY 或 MASTER/SLAVE 的别名 |
| streamId | 一块实际可操作画面的代次 UUID；绑定 endpoint、槽位、当前 Window、发布轨道和坐标映射；其中任一改变就作废旧代次 |
| pointer | 本期一个远程单指手势；DOWN→MOVE*→UP，异常退出走 CANCEL |
| READY | 端点已准备好当前画面和输入映射，浏览器收齐全部预期画面声明并实际显示画面；不是 TDP command 的 COMPLETED |

本期覆盖两个当前 Android App 的四类拓扑。只允许同 App 双机配对；副机是主机扩展，没有独立 CBS terminal/binding，不连接 TDS。`mobile` 为 MMP；单机单屏为 LMP；同机双屏为 LMP+LMS；配对主机为 LMP，副机按现有供电确认切换为 LMS/LSP。本需求不改变该切换规则。

## 2. 用户可见要求

### R-01 项目终端列表和连接状态

扩展 operations-admin **现有项目终端列表**，不新建重复列表，不把 STORE 范围页面改称项目范围。当前最接近的承载面是 `ProjectTerminalUpdatePage.tsx` 的“终端更新状态”Tab；具体导航标题及其控件布局须在后续 IA 中点名提交 Dexter 确认。本期不改变原查询的项目、启用门店/终端范围、版本筛选、分页与报告内容。

新增“TDP 连接状态”列，其读模型定义如下，互相排斥，按表中顺序判断：

| 代码 | 显示 | 判定 |
| --- | --- | --- |
| NOT_ACTIVATED | 未激活 | 当前没有有效 binding |
| OFFLINE | 离线 | 当前 binding 没有会话，或该会话已有断开事实 |
| UNCONFIRMED | 状态待确认 | 当前 binding 与已知连接身份冲突，无法确认属于当前终端 |
| ONLINE | 在线 | 当前有效 binding 对应 PG 当前会话，且没有断开事实 |

连接权威为 PG latest-state，不是 Doris 历史或版本报告。列表与发起准入复用现有 terminal-control 的有效 binding 与未断开会话判定；TDS 已负责心跳超时关闭与断开写入。本期不增加心跳参数列、跨节点配置查询或另一套 freshness 算法。节点异常退出尚未写断开时，列表可能暂时仍显示在线；点击后按现有在线投递和30s启动期限得到失败结果，不承诺实时在线证明。

返回 `connectionStatus`、`observedAt`、`evaluatedAt`；未激活/无会话时 observedAt 可为 null。使用现有列表查询、刷新与分页能力；本期不增加常态轮询或后台推送平台。此状态是有时间边界的已观察事实，不保证点击后一定连接成功。

### R-02 入口与工作区

终端详情 Drawer 右上角使用现有 `AdminDetailActionMenu`：“操作→远程控制”。没有远控权限不提供可执行动作；已知 NOT_ACTIVATED/OFFLINE/UNCONFIRMED 时不可用并解释原因。ONLINE 时允许点击，CBS 再核验。占用不进入列表或 Drawer 常驻字段，不提前按占用禁用。

管理员点击时若已占用，显示“当前机器已经受控”。不展示占用者个人资料，不排队、不抢占、不转移会话。

接受发起后打开全屏媒体工作区，包含门店名、终端名、连接阶段、主/副屏标签、视频、结束/关闭和错误信息。单屏一块视频；双屏并排两块视频。采用 `@livekit/components-react` 的按轨道 VideoTrack；不搬入会议的麦克风、摄像头、聊天或录制工具栏。

STARTING 显示“正在连接终端”，禁止视频输入；ACTIVE 才可操作；结束后显示原因及“重新发起/关闭”。“重新发起”是新的明确点击、新 session，不是旧会话自动续接。关闭工作区、导航离开或切换项目应先终止本次远控，复用 foundation overlay lock/生命周期，不复制另一套导航锁。

### R-03 权限与终端无感

新增具名 PROJECT 写 capability `TERMINAL_REMOTE_CONTROL`（最终契约拼写须遵守现有 IAM 命名约定，不改其语义）。拥有列表读取权限不自动拥有远控权限。复用现有任职、运营 session、项目/门店/终端 scope 与 grant 判定，契约和两个后台能力目录不得混用。

CBS 在发起、授权领取和会话续约时重新核验当前授权与业务事实；被停用的用户/任职、权限撤销、失效激活均不能继续取得授权。权限变更在下一次续约或已接到失效事件时终止，不承诺跨网络瞬时撤销。

TER 不弹确认，不显示远控标识/遮罩，不增本机结束按钮，不跳页面，不禁本地输入。仅限 TER 应用自己的画面与输入；不使用 MediaProjection、本机 adb、Accessibility、系统输入注入或生产 automation-agent 控制面。

## 3. 职责与数据归属

### R-04 唯一 owner 和依赖方向

| owner / 位置 | 所有事实与动作 | 禁止承担 |
| --- | --- | --- |
| CBS 既有 `modules/terminal-control` | 当前远控会话、原子独占、授权复核、Room/participant 分配、短期 grant、发起/结束与标准审计 | 第二套通用 remote operation 平台，媒体数据库 |
| TDS / TDC | 既有在线 command 投递、执行与结果；TDC 唯一持有终端凭证，提供认证 HTTP 基础服务 | 视频/触摸转发、远控用户业务或第二凭证副本 |
| `kernel/base/remote-control` | command、actor、ephemeral slice、selectors；会话/屏幕资格、输入准入、媒体事件、结束状态 | React、LiveKit/Bitmap/Activity 类型、组织实体或 SDK Room 管理 |
| `kernel/base/platform-ports` | 强类型 RemoteControlPort 和 unavailable 默认实现 | 任意系统控制口、SDK 类型或业务权限规则 |
| `adapter/android/remote` | 自有 Window 捕获、SDK/轨道、坐标变换、正常触摸和本次 native 资源释放 | 任意业务 callback 寻址或第二业务 store |
| 既有 Window / dual-screen owner | 真实 Activity/Presentation 身份、几何与生命周期接缝 | 为远控再渲染一份业务 UI |
| server-config | 具名 LiveKit endpoint、serverSpaces/defaults 与主副投影 | JWT、Room 状态、LiveKit API secret |
| topology | 精确当前配对 join/stop/资格与有限 peer command | 视频转发、副机独立 TDS 会话 |
| operations-admin | 项目列表、Drawer 动作、媒体工作区、PointerEvent 与反馈 | 业务授权判断、原生输入或新会议平台 |
| composition / application | 注册 module、端口、配置 provider、事件→command 接缝 | 远控业务编排或第二 SDK 连接 owner |

跨包发业务指令一律 command，读业务事实一律 selector；adapter 的生命周期/控制消息转成 owner command。port 方法只承载真正的通信/native 能力，不在 kernel 暴露 callback/event bus 替代业务 command。像素帧属于 native/SDK 数据面，不经 command、slice 或 JS base64；SDK handles 也不入 state。

### R-05 留存与重启

CBS 使用当前 owner schema 与唯一 Flyway history。每次远控只保存一条会话的身份、发起人引用、起止时间、状态/原因及关联 start/stop operation；标准审计记录开始/结束。复用现有 operation 接收/执行事实，不重复记录每个输入事件，也不新建媒体/点击轨迹历史页。

TER remote-control slice 是 owner-only **ephemeral、sync isolated**；只含公开 session/端点/屏幕身份、阶段、状态码、序号与必要手势事实，无终端秘密、JWT、帧或 SDK handles。普通配对 state 同步不传播控制权；主机通过明确 peer command 使副机加入/结束。

进程退出、JS reload、角色变化或根 reset 后不恢复旧远控；hydrate 不产生 join。旧 TDC operation 的补报只是历史结果，不重新执行 start，也不把 COMPLETED 历史当作新控制授权。

## 4. 会话控制面：格式与链路

### R-06 身份与唯一占用

CBS 原子准入使用业务终端作为独占单位，覆盖其所有屏幕和当前配对扩展。按真实 group workspace/project/store/terminal、bindingGeneration、当前 TDS node/session/sequence 钉住目标；不以客户端传入的项目或 ONLINE 布尔代替复核。

一个浏览器发起意图带一个 UUID `requestId`。同 requestId、同身份重复提交只读回同一次 session；参数冲突拒绝；已结束的 requestId 不创建新 session。其他 requestId（包括同账号第二 Tab）在占用期间返回 OCCUPIED。重放前仍需重新验证当前账号/scope。不新增远控排队或抢占机制。

CBS 分配 `sessionId`、opaque `roomName`、`controllerIdentity`。CBS 不知道副机业务实体，也不预知终端当前显示拓扑：主机接到 start 后，从既有 topology/display selectors 读取本次实际拓扑和已接受 peer，再以 TDC 认证 HTTP 登记该拓扑；CBS 为本次媒体端点分配 `endpointId/participantIdentity` 并冻结描述。端点身份不用姓名、登录名、原始 deviceId/IP；slave 无独立 binding。每次重新发起使用新 Room/session。

### R-07 HTTP 行为契约

下表是需求级能力/字段闭集，后续 canonical OpenAPI 必须表达同等语义；URI/operationId 按本仓既有 edge 前缀和生成规则定稿，不在需求阶段凭空增第二套路由规范。

| 能力与调用者 | 输入 | 成功输出 | 关键拒绝 |
| --- | --- | --- | --- |
| 发起，运营 session | 路径 projectRef/terminalRef；正文 `{requestId}` | `{sessionId,state:"STARTING",roomName,controllerIdentity,description:null,startOperationId,deadlineAt}` | 无权限、scope 不匹配、未激活、离线/旧连接、占用、依赖不可用 |
| 读取本次状态，发起者运营 session | projectRef/terminalRef/sessionId | `{sessionId,state,reason,description,startedAt,endedAt}`；登记前 description=null | 其他项目/他人会话不得取得 grant/控制权 |
| 控制端授权，发起者运营 session | sessionId | `{url,roomName,participantIdentity,token,expiresAt,description}`；description 已冻结 | 非发起者/已结束/授权失效；拓扑尚未登记为 NOT_READY |
| 登记拓扑并领取终端授权，TDC 的 credential 认证 HTTP | `{sessionId,topologyKind,peerIdentity}`；peerIdentity 仅 paired 为当前已接受 peer，其他为 null；credential 确认 terminal/binding，MASTER 资格另由当前 TDP 发起目标与本机角色复核 | `{description,remainingLeaseMs,grants:[{endpointId,roomName,participantIdentity,token,expiresAt}]}`；同机恰一 grant，paired 恰两 grant；终端地址只取 server-config | binding/当前 TDP 发起目标不匹配、过期会话、重复登记内容冲突；不创建 slave 业务终端 |
| 状态/续约，MASTER 的认证 HTTP | `{sessionId,state,reason,readyScreens}`；state 为 STARTING/ACTIVE/ENDED；readyScreens 为当前授权屏幕的 `{endpointId,screen,streamId,trackSid}` 数组 | `{sessionId,state,reason,remainingLeaseMs}` | session/绑定/授权失效、非法状态回退、屏幕归属不符 |
| 结束，发起者运营 session | sessionId；`{reason:"ADMIN_ENDED"|"WORKSPACE_CLOSED"}` | 当前 ENDED 事实，可幂等读回 | scope/身份不匹配 |

`description` 是本 session 唯一非秘密描述：`{sessionId,roomName,controllerIdentity,topologyKind,masterEndpointId,endpoints:[{endpointId,participantIdentity}],screens:[{screen,endpointId}]}`。topologyKind 闭集为 `MOBILE_SINGLE|LAPTOP_SINGLE|LAPTOP_DUAL|LAPTOP_PAIRED`；前三类1个端点，paired为2个。screens 必须精确对应 R-10，main 属 masterEndpointId，secondary 属同机主端点或当前配对副端点。`expectedScreens` 是由 screens 得到的槽位集合，不再作为 CBS 发起前已知输入。不会凭媒体顺序确定主副；全篇只用 participantIdentity，不再另立 endpointIdentity 字段。登记后同描述重放幂等、不同描述拒绝；拓扑种类或 peer 改变结束本次 session，不改写冻结描述。

主机对其上报拓扑负责：开始和 peer join 前均读回实际 Window/角色/配对资格；副机收到普通 peer join 后再核验发起者是自己当前已接受 MASTER、同 App、当前配对连接及本 session 的 secondary 归属。CBS 只授权有效绑定主机的扩展，不从 peerIdentity 推导独立业务权限。trackSid/streamId 不由 CBS 预知，来自授权端点的 SCREEN_READY。

HTTP中的peerIdentity形状为 `{moduleName,nodeId}`，取自当前已接受 `TopologyIdentity` 的同名字段，不带地址/显示名称/凭证，不新增配对身份来源。Window数与机型从display/topology selectors读取，不允许caller任填paired后跳过本机复核。HTTP时间字段采用既有canonical timestamp表示；remainingLeaseMs是非负整数毫秒，request/session/endpoint/stream/gesture/probe IDs为规范UUID。

HTTP 读回不包含触摸/媒体。授权响应使用现有 HTTPS/HTTP协议能力、禁止缓存。token 是短期 SDK 输入，允许经既有 command/request 的非持久结果和当前 peer command 参数传递，不建立另一条业务通路。业务 Problem codes 采用 §10 闭集；各自状态码/优先级由 canonical 依现有 HTTP problem standard 定义，不能把网络失败伪装业务拒绝。结束与迟到续约按 session identity CAS，不得操作新会话。

终端认证复用阶段 C 收口后的 TDC credential command 与 generated CBS API。按 Dexter 已裁决的 CBS 仅校验凭证原则，不另以副机物理 deviceId 作凭证匹配条件；MASTER 发起资格由当前 TDP command envelope、本机角色与配对事实核验，TDS 身份边界不改变。remote-control 不自行拼认证 header、秘密或让用户输入；server-config LiveKit 地址不是 CBS HTTP prefix，不用业务后缀拼 LiveKit。阶段 C 尚在实施，详设须重开其最终源码，不把本条写成当前已实现。

### R-08 TDP 与 peer command

TDP 继续复用既有 REMOTE_COMMAND/operation envelope；不另建 WS 指令通道。需求指定领域命令名 `startRemoteControlCommand` / `stopRemoteControlCommand`；moduleName 派生全名按 TER 规范在详设确定。

start 参数只含非秘密事实：

```json
{"sessionId":"00000000-0000-4000-8000-000000000001","bindingGeneration":3,"targetSessionId":"current-tds-session"}
```

targetNode/session/sequence 的完整核对来源是既有可信 envelope/服务端当前事实；不要求浏览器传入。start 不带 CBS 尚不知道的 expectedScreens；实际就绪拓扑沿 R-07 的主机登记解析，不让管理员选择机器角色。

stop 参数：`{sessionId,reason}`，reason 使用 §10 的会话结束闭集。start/stop command result 只返回 `{sessionId,status,reason}`，无 token、媒体地址中的秘密或原始异常。start 在登记并启动本机 port 后尽快返回，不阻塞等待 ACTIVE/画面；后续 port 事件沿 command→actor 更新状态。COMPLETED 不代表浏览器已收到两路画面。

配对主机通过现有 peer command 定向当前副机，payload 为 `{description,grant}`，grant 只取该副 endpoint 对应项；沿原 command gateway 发给精确当前 peer。副机 actor 按 R-07 核验后调用本机 port，result 只回 `{sessionId,status,reason}`。角色/peer 变动后旧 join/stop 不能作用于新会话。

副机 join 在登记并启动本机 port 后先返回 STARTING，不在嵌套等待链中反向调用 MASTER。完成本机画面和输入准备后声明 SCREEN_READY。副机不维护独立 CBS 租约，也不周期请求 MASTER 确认有效期；其生命周期由当前 peer join/stop、配对连接、controller KEEPALIVE 和必要 participant 存活共同约束，任一失效结束整会话。

remote-control actor 使用现有 TDC 认证 HTTP command 取得 grant 的 request 结果，再调用 RemoteControlPort；这份短期结果允许进入现有 persistIntent=never、syncIntent=isolated 的 Runtime request ledger，按原生命周期收口。配对传递同样用既有 peer command，不加私密 channel、结果拦截框架或新 token store。TDC 终端凭证仍只由 TDC 构造和持有；grant 不是该凭证。

由 TDP 投递的 start/stop 根 command 参数与最终 actor result 不含 token，所以 TDC remoteOperations/CBS operation 持久记录不携带它。remote-control slice、普通主副 state 投影、server-config、日志和审计不保存 token。嵌套授权结果不混入根 start result；这一点使用现有 request/actor 聚合结构核验，不改变所有 Runtime command 的行为。

### R-09 从点击到可控制的完整顺序

1. 浏览器从原项目列表/详情点击；CBS 做权限/scope/binding/在线/独占原子准入，创建 STARTING session。数据库失败则不声称成功占用。
2. CBS 通过现有 owner SQL 投递 start operation。只在线投递、无离线补发。队列/投递失败结束本次尝试并返回可解释失败；超时未知不能误称未执行。
3. 主机接到 start 后用 selectors 复核角色、Window与当前 peer，登记实际拓扑并取得 description/grants；拒绝过期 start。浏览器在初始30s期限内复用状态查询，最多每2s一次、最多15次；description就绪后领取自己的 grant 并加入 Room。这个有限启动等待不是后台常态数据轮询，ACTIVE后不继续该查询。token 或超时失败结束本次尝试，不加入无限重试。
4. Android port 从既有 Window owner取得当前画面，开始 capture、创建 SDK track并发布。paired 时主机调用 peer join，副机独立向同一 LiveKit 发布；不代传副机视频。
5. 每个端点先完成本机输入映射与画面准备，再发 SCREEN_READY。MASTER 收齐预期端点声明并核实当前配对后标 ACTIVE、向 CBS 报告；浏览器独立收齐 description 对应的当前声明和可显示 track 后开放输入。无需另一次输入授权握手，也不以 CBS ACTIVE 或 TDP command 成功代替浏览器画面就绪。
6. 后续媒体直接 endpoint→LiveKit→browser；输入 browser→LiveKit DataChannel→目标 endpoint→本机 remote-control actor→RemoteControlPort→正常 TER 控件事件→控件原有业务 command/actor。CBS/TDP不参与逐触摸转发。
7. paired 两屏必须一起就绪；任一失败则结束整尝试，不只开放主屏。启动期限30s，从CBS发起计时；到期禁用/结束，拒绝迟到 READY，不偷偷延长成后台等待任务。
8. 管理员结束/关闭，或任一断连/身份失效：先本地禁止输入、CANCEL手势，再结束媒体及CBS会话。网络恢复无自动续接；新点击从第1步重来。

## 5. 拓扑、捕获与正常输入

### R-10 屏幕映射

| 拓扑 | 发布机器与轨道 | screen→实际输入目标 |
| --- | --- | --- |
| mobile / laptop 单屏 | 一个 endpoint、一个 participant、一 track | main→本机 Activity |
| laptop 单机双屏 | 一个 endpoint、一个 participant、两 track | main→Activity；secondary→当前 Presentation |
| 同 App 双机配对 | 主、副各一个 endpoint/participant、各一 track，同 Room | main→主机 Activity；secondary→副机自身 primary Activity |

participantIdentity、trackSid、screen、endpointId 和 streamId 显式配对，不能以轨道到达顺序、数组下标、track source 或Android displayId猜测。每个 endpoint只接受发给自己且匹配该screen的消息。

配对副机沿用阶段 C 的 TDC 共享凭证 owner 和配对机制；本专项不新建凭证传递、不连 TDS、不变为独立 terminal。LiveKit grant 是本次媒体会话输入，与 TDC 终端凭证不同。LMS/LSP 切换沿用原流程；若不改变 Window/映射，轨道仍指向副机同一物理屏；若改变，按 R-11 画面代次重建。配对断链、任一 publisher断连/永久 unpublish、预期屏消失或App退出，均结束整会话；不得降级为主屏继续操作。

### R-11 捕获与画面代次

主/副画面都采用已接受的 Android 自有 Window PixelCopy 路线，复用 Activity/Presentation，不用 ImageReader旁读任意Surface、不用第二渲染树、不用MediaProjection。LiveKit/WebRTC SDK承担编码/拥塞/发布，不自写编解码器或开第二套Kotlin Room绕过RN轨道桥。

每路只保留少量复用 native buffer、最多一个in-flight copy，慢帧丢弃而非积压；不逐帧JS/JSON/base64。起始适配目标为长边不超过1280px、15fps，按真实设备proof调整，不是已证明SLO；不同屏比例保持不变，不能为填满视频拉伸画面。

几何变化、Window替换、轨道替换都生成新 streamId。端点先 CANCEL 原手势、作废旧映射；新画面与输入映射就绪后再声明 SCREEN_READY。browser 观察到新代次/track 或画面暂不可用时，清除该 screen 的本地就绪，等全部当前画面可显示后恢复输入。端点无论 browser 是否已看到新声明，都拒绝旧 streamId，不再执行旧坐标。CBS 保持 ACTIVE，不增加重握手协议或第二几何计时器；MASTER 已知必要画面未就绪时暂停续约，沿现有剩余租约到期结束，capture/participant 失败按既有结束路径处理。source 映射固定为发布画面归一化坐标→对应 Window 物理像素，旋转在 capture 端归正，browser 不再猜旋转；旧 streamId 永远不重新有效。

覆盖分母必须包含当前TER通常使用的React业务页、滚动、admin层及`ui/base/input`虚拟键盘。系统安装/设置、系统IME、其他App不在可控范围。独立Dialog/Popup/SurfaceView不会因PixelCopy主Window成功就自动包含；详设应核查实际窗口清单，保证本期业务分母的实际画面/命中，无法覆盖的独立native面在后台显示“当前界面不支持应用内远程控制”并停止该面输入，不用不可见坐标继续操作。不得用该说明排除本期已要求的普通TER控件。

### R-12 本地与远程输入

port在Android主线程向准确的Activity/Presentation分发普通MotionEvent，走RN真实命中/responder/Pressability/ScrollView路径；不手动调用查到的onPress，不绕开原业务command。

本期只支持primary pointer的点击、按下—单指拖动/滚动—抬起、点击既有TER虚拟键盘。无远端字符串/剪贴板注入、双指缩放、系统按钮或跨App控制。鼠标滚轮不另建特殊滚动协议，可用拖动完成列表滚动。

本地与远程都可同时使用，不设全局输入锁、本地优先模式或终端遮罩。同一Window的真实手势相碰时，最小处理是取消正在冲突的远程手势、反馈INPUT_CONFLICT；本地按正常输入链继续，远端释放后可再次发起新手势。不融合两路pointer为伪造多指流，不冻结整个会话。具体native接缝须经T-03证明，不建协同输入引擎。

## 6. 协议公共规则

### R-13 控制数据通道与编码

媒体沿LiveKit视频轨道；本节控制协议沿同Room的`publishData`，topic固定 `ter.remote-control.v1`，reliable=true，destinationIdentities必须点名，不能给所有participant广播触摸。JSON UTF-8单条完整payload ≤4096 bytes（本期有限小消息足够，低于LiveKit可靠数据15KiB上界）；TDP仍保留自己的65536字节协议上界，二者不能混用。

消息为下表共同字段加对应body；无额外任意脚本/函数/commandName字段：

| 字段 | 类型/含义 |
| --- | --- |
| v | integer，固定1 |
| type | §7的闭集消息类型 |
| sessionId | CBS本次UUID |
| seq | 正安全整数；每个发送participant在本session全消息递增，不复用、不按屏幕各从1计数 |
| body | 与type对应的对象；不接受null/数组/NaN/Infinity/字符串数字 |

UUID为规范字符串；identity/trackSid使用LiveKit给定的非空字符串，长度≤128；未知字段允许忽略但已知字段严格验证。已授权sender的未知v/type不执行动作，使用本方v1编码的 SESSION_END{reason:"UNSUPPORTED_PROTOCOL"} 后结束，不增加通用ERROR消息。不把TDP已有的“未知类型忽略”规则复制到生产控制协议。

发送者从SDK实际participant元数据取得，不能相信body自报sender。按下表和冻结 description 核验，不能用“端点只接受controller”排除正常端点间画面声明。不同session、陌生sender消息静默丢弃并只记录脱敏计数，不能让无关消息终止合法会话。

| type | sender→receiver（destinationIdentities精确点名） | 当前身份条件 |
| --- | --- | --- |
| SCREEN_READY | endpoint→controller及MASTER；MASTER自己的screen为本地事实，不发给自己 | endpoint/participant拥有description里的该screen |
| POINTER | controller→该screen所属endpoint | 当前会话、controller身份、本机就绪和streamId匹配 |
| INPUT_RESULT | 被指向的endpoint→controller | 对应本endpoint接受/拒绝的输入 |
| KEEPALIVE | controller→每个endpoint | 当前controller |
| KEEPALIVE_ACK | endpoint→controller | 对应本endpoint收到的有效probe |
| SESSION_END | controller/MASTER/必要endpoint→其他实际成员 | description内实际成员；全会话终止，不发给陌生identity |

已授权sender的畸形帧：若能读出合法session/POINTER seq/gestureId，按INPUT_RESULT拒绝；无法建立合法输入关联则丢弃并计数，不拼造forSeq/gestureId、不回通用错误。若类型/版本本身不支持按上段结束。未通过完整校验的消息不推进最高seq，不打印raw payload。

seq≤该sender已接受最高值时不再分发输入，不重放业务动作；只对可关联的重复POINTER回DUPLICATE，其余重复消息丢弃，不为回执再产生回执。seq允许跳号（发送失败/move合并），不要求无限缓存缺口或补齐。所有等待、序号、手势表只存当前会话；禁止触摸持久化、断连补发或恢复旧seq。

## 7. v1消息格式与处理

### R-14 画面声明与就绪

SCREEN_READY，endpoint→controller和MASTER；同机MASTER本地直接形成owner事实，不给自己建网络环路：

```json
{"v":1,"type":"SCREEN_READY","sessionId":"00000000-0000-4000-8000-000000000001","seq":1,"body":{"endpointId":"00000000-0000-4000-8000-000000000002","screen":"secondary","streamId":"00000000-0000-4000-8000-000000000003","trackSid":"TR_example","widthPx":1280,"heightPx":720}}
```

widthPx/heightPx为已归正发布画面的正整数像素。端点内部保存其crop/Window映射，browser只按发布像素比计算内容矩形。CBS description给出的participantIdentity必须与SDKsender一致，SCREEN_READY不能自行改变主副归属。每screen恰一条当前有效track。

端点必须先把当前 session/controller、screen/streamId、Window 输入映射和 track 安装为本机事实，再发送 SCREEN_READY；声明后即能处理匹配的输入。浏览器收齐 description 的全部 screen 声明、SDK participant/track 对应且视频实际可显示后才开放输入。各端点不等待另一份网络输入授权。这样副机声明先到 browser、后到 MASTER 时，第一个合法输入仍可执行；不依赖跨接收者到达顺序。MASTER 的 ACTIVE 报告与浏览器本地就绪分别成立。

为覆盖 browser 晚加入或首条声明未收到，端点在收到已有 KEEPALIVE 时重发当前 SCREEN_READY，新的 seq、相同的当前 streamId，同时点名 controller 与 MASTER；不另建声明重试循环。browser 只能使用各 sender 最新有效声明，不能因 reliable 发送成功直接开放输入。初始就绪受30s启动期限约束；几何变化按 R-11 重建当前声明，CBS 不回退业务状态，不补发点击、不创建新 session。

### R-15 输入

POINTER，controller→准确endpoint participant：

```json
{"v":1,"type":"POINTER","sessionId":"00000000-0000-4000-8000-000000000001","seq":8,"body":{"endpointId":"00000000-0000-4000-8000-000000000002","screen":"secondary","streamId":"00000000-0000-4000-8000-000000000003","gestureId":"00000000-0000-4000-8000-000000000004","phase":"down","u":0.35,"v":0.62}}
```

phase=`down|move|up|cancel`；down/move/up必须携带有限number u/v∈[0,1]；cancel省略u/v。所有字段身份、本机会话仍有效且画面就绪、当前streamId和gestureId先核验，再调用port。一个控制端同一时间最多一个活动远程手势，不能在两屏同时DOWN；gestureId每次DOWN新UUID；move/up只接受该gesture；未知gesture不合成DOWN。DOWN成功后用同一native downTime，UP/CANCEL释放；窗口变化/会话结束也保证CANCEL。

浏览器在真实video的object-fit内容矩形内计算u/v，黑边不发DOWN；pointer capture保持drag连续。主键外/第二pointer不进入协议。指针离开内容矩形时发CANCEL，不钳制为另一控件点击；失焦、pointercancel、工作区关闭同样取消。move最多30条/s，只发送最新位置；DOWN/UP/CANCEL不合并，不被move占满队列。

端点据当前stream映射换算Window物理坐标；最后一像素边界按有效Window范围处理。CSS px只用于浏览器内容矩形，RN dp只用于其内部布局，不把它们直接作为native物理像素，不用主屏density替副屏计算。

INPUT_RESULT，endpoint→controller：`body={forSeq,gestureId,status,reason}`。status=`DISPATCHED|REJECTED|CANCELLED`；reason=null表示正常，其余为§10输入码。DOWN/UP/CANCEL和拒绝发送回执，正常move不逐条发回执。DISPATCHED只表示已走正常native事件分发，不证明控件业务完成；业务结果通过实际视频/真实业务selector在验收时确认。

等待输入边界回执上限3s；到期停止新输入并结束会话为INPUT_RESULT_UNKNOWN，不补发同一个DOWN/UP，不假定操作未执行。端点有界输入待处理容量64条，以每秒最多30个move为依据；满时优先丢尚未分发旧move并保留终止边界，仍无法容纳则CANCEL并结束INPUT_UNAVAILABLE，禁止无限排队。长期无UP/CANCEL的远程手势10s自动取消；这只是释放按压，不恢复远控，不新增长按业务。

端点因本地冲突、10s期限或Window变化主动取消时，INPUT_RESULT 的 forSeq 引用该gesture已接受的DOWN seq，status=CANCELLED，reason分别为INPUT_CONFLICT/GESTURE_EXPIRED/STALE_STREAM。browser收到匹配当前gesture的CANCELLED即释放本地pointer/活动gesture并停止后续move/up；旧gesture回执不能清新gesture。不要求补发可能已执行的输入。

### R-16 会话存活和结束消息

KEEPALIVE，controller 在入房并取得 description 后立即、随后每5s定向每个endpoint：`body={probeId}`，probeId为UUID；endpoint回 KEEPALIVE_ACK：`body={probeId}`，只确认当前会话存活，不承担输入授权消费确认。端点可同时按 R-14 重发自己的当前 SCREEN_READY；未就绪时不伪造声明。这不生成业务报告或重复 command。当前连接连续15s没有任一必要端点的匹配ACK，browser终止；endpoint连续15s无controller有效KEEPALIVE也终止。ACK必须是已发送未过期probe，陌生probe不能维持存活。保存的probe有限，仅最近一轮与上一轮，过期丢弃。

SESSION_END可由controller、MASTER或实际endpoint发送：`body={reason}`。只接受本session实际成员；任何必要端点发出结束都结束全会话。SESSION_END只是加速通知，不能依赖它一定送达；SDK disconnect/reconnecting事件、port错误、本地watchdog同样主动结束。

SDK一旦进入reconnecting或任一必要participant断开，本session立即终止，不等SDK自动恢复。网络回来了仍拒绝旧session/stream输入；手动重新发起才能入新Room。内部ICE路径正常切换但未出现会话断连不强制结束。

## 8. 资源、独占释放与有限会话租约

### R-17 结束与丢消息

结束顺序：先actor/native拒绝新输入→CANCEL远程手势→停止capture/track→离开Room并释放native资源→CBS写ENDED及标准审计/释放占用。后台即时禁输入并显示结束结果；释放失败单独可见，不以业务状态掩盖native资源未清理。迟到旧start/stop/ready/HTTP/ACK只能命中原session，不能覆盖新会话。

CBS的END应复用在线stop operation，并通过服务端Room管理尽力移除本次Room成员。成员离开、主动停止与本地释放结果各有身份关联；新session端点开始前必须确保本机上一会话已停止，不允许同时运行两套capture/control实例。副机停止也属于整会话释放。

浏览器崩溃、命令丢失或CBS暂不可达时，端点用本地15swatchdog和有限授权失效停止控制。CBS占用不能永久残留：使用30s有效会话租约，由MASTER在有效controller存活、全部必要端点就绪/未断连时每10s调用R-07状态/续约。初始未就绪只使用启动30s期限；ACTIVE画面重建沿 R-11 复用 MASTER 已有租约；已知未就绪时暂停续约，不增加长等待或副机期限。

续约复核发起人的有效权限、当前binding/session、会话未结束；已过期只能结束，不能续活。CBS不可写/拒绝续约时，当前会话不继续开放新输入。下一次发起在CBS事务内发现租约过期可收口旧记录，不建常态扫描/轮询/自动恢复框架。续约是当前远控的一次有界存活命令，不是跨模块数据补偿轮询。

MASTER 在 CBS 有效期到达、续约被拒或失败时停止本机控制，经现有 peer stop 与 SESSION_END 结束副机；副机同时独立监听配对/必要 participant 断开及15s controller watchdog。不能用晚到响应重新延长已结束会话，也不能按收到时再加30s把 MASTER 授权延长到 CBS 期限之外。副机不持有、计算或续租第二份 CBS 有效期；MASTER 消失时按既有配对/媒体断开退出，browser 消失时按 watchdog 退出。30/10/15s是本期释放的工程界限，可在详设凭明确网络/SDK依据一致调整，不是管理员可配的产品规则。

MASTER 的有效期来源不是 JWT expiresAt 或 KEEPALIVE：初始取 R-07 登记响应，随后取状态/续约响应。HTTP 发起前记录本机单调时刻 t0，本地截止不晚于 `t0 + remainingLeaseMs`；到达时已过截止则拒绝，不从接收时刻重算满期限。只保留本 session 的一个当前有效期请求；旧 request/session 结果无效，失败不扩大期限。clock/native 折算由 T-04 核实，不建租约账本；副机不走该计算。

自托管LiveKit的kick与JWT过期不能独自撤销控制。应用自己的当前session/stream/授权资格是输入准入；JWT用于入房，不能替代owner状态。结束后不重签旧Room token，不回放输入、不恢复旧控制权。

## 9. 配置、依赖、部署

### R-18 配置与媒体授权

server-config具名服务`livekit`按现有serverSpaces/package defaults/主机override提供信令URL；配对副机只读主机配置。composition将配置provider注入adapter，remote-control业务不直接读别包slice/persistence。切换服务空间、endpoint或revision结束当前会话，不迁移/重连。新增字段仍由现有server-config-panel通用能力呈现，不复制远控地址设置页。

TER 与配对副机连接地址只来自 server-config 的 livekit；终端 grant 不含 url。CBS 使用自身配置的 LiveKit 服务签发 token、管理 Room，browser 授权返回 browser 可达 url。CBS 不接收或校验终端 URL，不把服务端密钥用于客户端指定地址。各地址可以不同，但必须到同一媒体服务；终端配置错误导致连接/认证失败时按 START_FAILED 结束。server-side API、客户端信令及 ICE/TURN advertised 地址不可混为一个 HTTP prefix；HTTP proxy 不承诺 WebRTC UDP/TURN 代理。

LiveKit API secret只存受信服务端，token只在短期授权响应和当前SDK/native内存中。browser grant：本Roomjoin、订阅视频、发布控制数据，禁止发布音视频；endpoint grant：仅本Room的自有屏幕视频与控制回执，不采集摄像头/麦克风/音频、不赋Room admin/record权限。自定义track source须在精确SDK中核验后对齐source grant；不能默认SDK会阻止一个获屏幕授权端点发布任意数量的track，应用manifest也必须限制轨道归属。

### R-19 成熟依赖与Compose

优先官方RN SDK、LiveKit WebRTC fork、官方Expo plugin和必要livekit-client；operations-admin使用`@livekit/components-react`。CBS terminal-control 使用 LiveKit 官方 JVM 服务端 SDK `io.livekit:livekit-server` 签发 token 与调用 RoomService，不自写 JWT 签名或房间管理 HTTP client。`expo-livekit-screen-share`只是参考，不能重复加同作用plugin或为它强迫MediaProjection。new native能力需新的APK/FULL基线，不可能用HOT单独增加。

截至研究截面候选RN SDK3.0.0、Components2.9.24；尚未安装/解析。CBS JVM SDK 尚未安装/解析，官方仓库 Java 示例证明有可复用方向，不是本仓兼容证明。精确实际版本、服务端 Java/API 兼容、RN0.86.3/Expo57兼容、native namespace、track bridge和SDK断连语义由T-01核定，不能写latest、以peer范围当兼容证明。

Go LiveKit server部署在受信远端非生产主机，采用官方Docker Compose配置方式，固定版本/digest；必要Caddy/TURN等按官方最小单实例路径。交付具名配置/启动/停止/health接缝，现有managed runner登记媒体服务/端口与所有权。域名、可信TLS、ICE/TURN、防火墙由部署设计列出；JavaHTTP/WSS tunnel可达不代表媒体可达。不建生产HA、多区域、Ingress/Egress或录制。

本期不执行部署。后续实施授权必须明确媒体服务拓扑与资源预算；不把辅助媒体服务当第二业务deployable/数据库，不触及Codex在途阶段C运行资源。

## 10. 状态与失败闭集

### R-20 状态、原因、可观察性

CBS session state闭集`STARTING|ACTIVE|ENDED`；ENDED包含成功结束和失败原因。TER owner phase为`IDLE|STARTING|ACTIVE|STOPPING|ENDED`；STOPPING不允许输入，释放结束仍保留当前最后状态供selector读，下一新会话替换。不新增可自动恢复的SUSPENDED/RECONNECTING状态。

| 类别 | 有限码 | 用户/协议语义 |
| --- | --- | --- |
| 发起/授权拒绝 | PERMISSION_DENIED、OUT_OF_SCOPE、NOT_ACTIVATED、TERMINAL_OFFLINE、CONNECTION_UNCONFIRMED、OCCUPIED、IDENTITY_CONFLICT、SERVICE_UNAVAILABLE、UNSUPPORTED_TERMINAL、NOT_READY | 不授控制权；NOT_READY仅限启动时描述尚未就绪；OCCUPIED仅点击后显示规定文案；其他按真实Problem显示，不输出秘密 |
| 会话结束 | ADMIN_ENDED、WORKSPACE_CLOSED、START_TIMEOUT、START_FAILED、CONTROLLER_DISCONNECTED、SCREEN_DISCONNECTED、PAIR_DISCONNECTED、TDP_DISCONNECTED、ACTIVATION_INVALID、AUTHORIZATION_INVALID、CONFIG_CHANGED、APP_RESTARTED、LEASE_EXPIRED、CAPTURE_FAILED、INPUT_RESULT_UNKNOWN、INPUT_UNAVAILABLE、UNSUPPORTED_PROTOCOL | 全会话禁输入/释放；断连类手动新发起，不能重试旧触摸 |
| 输入拒绝/取消 | NOT_READY、SESSION_ENDED、STALE_STREAM、WRONG_TARGET、INVALID_MESSAGE、OUT_OF_BOUNDS、INVALID_GESTURE、DUPLICATE、INPUT_CONFLICT、GESTURE_EXPIRED、UNSUPPORTED_SURFACE | 不分发该输入；冲突/越界/手势过期只取消该手势，不永久禁正常输入；当前面不可用时禁该面输入并说明 |

跨网络最多声称“在检测到/有限期限到达后停止”，不能承诺瞬时物理断连感知。SDK正常网络切换与正式reconnecting须按精确版本解释。raw异常只归一到有限码和关联诊断，不写到协议/UI/audit。

selector至少提供本机session/phase、各screen就绪与stream事实、最后结束/输入错误、释放状态；不提供token、帧或第三方handle。操作产生的页面业务结果仍属于原业务owner，不复制到远控slice。

标准审计保存开始/结束、真实账号引用与终端引用；结构化日志用session/operation/endpoint引用、阶段/有限原因/资源数，不记录JWT/Authorization/credential/deviceId原值/IP/raw控制payload/虚拟键盘输入内容。媒体、截图、触摸正文不落盘；授权领取、native capture/track和释放边界有可关联诊断。

## 11. 必须验收的行为

测试源码、官方API存在、静态review都不等于运行PASS。以下是后续详设必须覆盖的最低清单，不是本轮运行授权。

| ID | 场景/动作 | 业务与边界断言 |
| --- | --- | --- |
| V-01 | 项目列表：未激活、已断开、身份冲突、当前未断开会话 | 四类状态/时间正确；列表与现有在线投递判定一致；保持原查询范围/分页，无逐行N+1；只ONLINE可点击 |
| V-02 | 权限/scope与重放 | 没权限/他项目/权限已撤销拒绝；同requestId只回原session；并发不同requestId仅一成功 |
| V-03 | 在线发起与画面就绪 | 主机selector登记→冻结description→定向grant/peer→本机准备→SCREEN_READY→browser全部画面可显示；browser晚入房可由KEEPALIVE取得声明；CBS不预知副机；READY到达倒序不丢首个操作；command成功未被误当画面ready |
| V-04 | mobile、laptop单屏 | 点击按钮、滚动列表、虚拟键盘真实产生现有业务结果，本地页面无远控提示/跳转 |
| V-05 | 同机双屏 | 同participant两轨；分别控制Activity/Presentation，不同尺寸/density与video黑边不串屏 |
| V-06 | 同App配对两屏 | 主副各轨同Room；slave无TDS/独立binding；LMS/LSP映射正确，两屏ready才可操作 |
| V-07 | 配对任一断连 | 分别断主、副、peer；全会话停止两屏输入/媒体，网络恢复不自动加入；手动新发起得到新identity |
| V-08 | 坐标/代次 | ACTIVE旋转/Window更换重建本机映射与声明；声明丢失复用KEEPALIVE重发；capture失败/MASTER现有租约到期结束；旧stream、错误endpoint、越界、黑边、旧seq不分发 |
| V-09 | 手势与本地共用 | 正常down/move/up/scroll；出界/失焦cancel；本地与远程均可用；真实冲突取消单手势且之后可用 |
| V-10 | 有界协议 | 6类消息方向正确；缺gesture等不可关联畸形不制造回执，未知协议SESSION_END；重复回执无循环；主动CANCEL关联DOWN并清browser；move合并、终止边界保留；回执未知不补发点击 |
| V-11 | 启动失败/迟到 | 缺屏/SDK失败/30s超时结束；迟到READY/start/授权不复活旧会话或覆盖新会话 |
| V-12 | 结束与释放 | 主机初始HTTP与持续超过30s的续约闭合，副机无独立租约且不误停；MASTER续约失败/消失、controller消失及配对断开均结束；未知/迟到有效期不续活；关闭、导航、崩溃、TDP断开、取消激活、重启、配置变化均停止；native资源与占用结束分别断言 |
| V-13 | 配置/授权 | host/slave只读server-config地址，终端grant无url，browser授权有自己的url；配置错误启动失败；grant沿现有command/request和peer，Runtime仅原非持久ledger；根start/result、TDC持久记录/同步state/log/audit不带token；低权限拒绝；无语音/摄像头/录制 |
| V-14 | 实际界面覆盖 | 普通TER业务、admin、虚拟键盘完整可见且命中；独立native/system面准确说明不可控，不误点击 |
| V-15 | 部署与真实网络 | browser/master/slave实际ICE/TURN可达；固定镜像/health/资源；媒体不经TDP；business与managed cleanup分别判断 |

非adapter行为先integration Expo Web，再同场景到Android application；真实PixelCopy/native输入是TR-16 adapter范围，必须Android proof。两个App、四拓扑的具体设备与场景分配在详设列出，不凭单App单屏成功推全矩阵。复用最新automation-driver和既有后台L2/backend-acceptance，不复活旧runner；真实远控输入仍必须由媒体工作区PointerEvent进入DataChannel，不能用测试command替代整条交互。

后续seed/fixture需具名项目/门店/终端/权限账户、在线/离线/占用/双屏peer前提；资源身份与首败/cleanup用现有managed能力。详情/动作/全屏surface/TestId要在IA/UI写清并给Dexter确认，本文件不是逐屏UI接受记录。

## 12. 技术前置、官方依据与合理性

### 12.1 详设必须先关闭的有限前置

| ID | 未证明的能力 | 关闭目标与失败边界 |
| --- | --- | --- |
| T-01 | 精确SDK组合、CBS JVM token/RoomService、自有native frame→RN WebRTC track→LiveKit | 锁定实际解析图/API与官方版本来源，证明实际capture/bridge。授权使用既有command/request和peer，不另立私密通路；不可行交Dexter，不引入双SDK Room |
| T-02 | 持续双Window捕获及普通界面覆盖/释放 | Activity/Presentation实际视频、图片/虚拟键盘/admin；buffer/CPU/native内存/延迟与结束释放。PixelCopy一次成功不够，独立Window清单不能漏 |
| T-03 | native触摸、本地并用、实际相对坐标 | 正常按钮/滚动/键盘、冲突cancel、窗口替换及主副目标；不靠直接onPress/adb/Accessibility替代 |
| T-04 | 网络、SDK断连与授权期限 | 实际WSS+ICE/TURN、准确重连事件、有限停止与占用回收；token过期不当撤销证明 |

当前全部OPEN/NOT_RUN。需求允许先写详设，但涉及这些行为的设计不能凭模型猜测冻结；获后续明确授权时，在对应CP内用最小proof解决，再进入依赖它的实现/整体验收。不把前置变成新增基建平台；失败不得暗自收窄四拓扑或终端无感目标。

### 12.2 官方材料与当前源码依据

- [LiveKit 官方 JVM server SDK](https://github.com/livekit/server-sdk-kotlin)：官方 Java 示例含 AccessToken 与服务端 Room API；只核实可复用方向，精确版本/依赖图与本仓 proof 留 T-01，不以主分支版本作已解析版本。
- [LiveKit Expo](https://docs.livekit.io/transport/sdk-platforms/expo/)：原生development build，不能使用Expo Go。尚无本仓新增依赖解析/兼容证明。
- [Room/participant/track](https://docs.livekit.io/intro/basics/rooms-participants-tracks/)、[React VideoTrack](https://docs.livekit.io/reference/components/react/component/videotrack/)：多track与按轨道渲染。两路真实自定义视频桥仍待T-01。
- [LiveKit Data packets](https://docs.livekit.io/transport/data/packets/)：reliable有序、有限重传，仍可能丢失且不离线缓存；可靠payload15KiB。本文采用有限小JSON，不声称exactly-once业务。
- [Token/grants](https://docs.livekit.io/frontends/reference/tokens-grants/)：grant隔离与自托管撤销局限；participant/room不放PII。短期token不替代应用会话终止。
- [Android PixelCopy](https://developer.android.com/reference/android/view/PixelCopy)、[Activity touch dispatch](https://developer.android.com/reference/android/app/Activity#dispatchTouchEvent(android.view.MotionEvent))、[Presentation](https://developer.android.com/reference/android/app/Presentation)：自有Window采样与应用内事件入口，非持续编码或全Window自动合成证明。
- [官方Compose/VM](https://docs.livekit.io/transport/self-hosting/vm/)、[端口/防火墙](https://docs.livekit.io/transport/self-hosting/ports-firewall/)：域名/TLS与RTC网络前提；不证明当前DEV部署或性能。
- 当前源码导航、候选精确tag和现有复用路径见讨论稿§4/§5；Codex仍在改阶段C，详设须重开当前字节。当前候选tag不是resolved version，上游主分支不是最终精确版本证明。

### 12.3 方案合理性与未决边界

选LiveKit承担成熟媒体能力，CBS/TDP复用既有命令owner，Android只补自有Window采样/轨道接缝和正常输入。相较再建WebRTC/编解码器、生产化automation-agent、系统远程桌面或另一套终端列表，边界更小且符合TER应用内/无感目标。

必要成本是自定义track bridge与真实双屏输入，不能以“轮子存在”抹掉；不为小概率输入建立通用恢复、持久触摸、协同多指、管理员排队/转交或跨App配对。租约/watchdog只服务断连释放与独占，不扩张为通用调度平台。

当前无待裁决的产品方案竞争。具体页面/权限控件与全屏布局在IA提交Dexter；T-01～T-04仍需官方版本/后续授权proof；本稿不宣称技术闭环已实现。独立需求review结论单列在review文件，不由本作者以文档自洽替代。
