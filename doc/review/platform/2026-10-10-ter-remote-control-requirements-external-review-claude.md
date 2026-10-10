# TER 应用内远程控制正式需求：外部独立静态评审（Claude）

## 0 · 结论块

```text
REVIEW_TARGET=DESIGN（正式需求）
ACTION_1_VARIANT=1-B 文档提取＋owning source 静态读回
REVIEWED_SHA256=4fa449bfc45adb6c64ae229ad09bf3a01ac23550e0d070a3611c11fc49cd1730（本轮亲算）
VERDICT=NO-GO
M/S/N=0/1/4
L1_ENGINEERING=STATIC_ONLY；复用路径与源码基本一致，见 §4
L2_USER_VISIBLE=需求语义层；列表状态见 N-1，其余 UI 待 IA
L3_UNVERIFIED=非空，见 §6（即使 S-1 关闭，也只能给 GO_WITH_UNVERIFIED_UI）
SAME_ROOT_SCAN=每条 finding 内列出
DESIGN_GAPS=2，见 §7
TEMPLATE_COVERAGE=需求工件；Journey/IA/UI/详设模板 NOT_APPLICABLE，后续工件逐节适用
EVIDENCE_TIER=SOURCE_ONLY_STATIC_REQUIREMENTS_REVIEW
reviewerKind=EXTERNAL_CLAUDE
```

S-1 是需求内部两处对同一事实的说法互相矛盾，而且其中一种读法违背 Dexter 原话第 4 条，修正只需改一个单元格。4 条 N 都是 Dexter 要求检查的“不必要复杂度”或依赖清单缺口，不阻断 GO。S-1 关闭后，按规范应为 GO_WITH_UNVERIFIED_UI。

## 1 · 会话来源与独立性

- **非 fresh**：本会话是续接会话，前面做过 TER 版本更新 B/C 阶段的外部评审。本会话没有起草本需求。
- **非盲审**：R3 报告与作者 intake 在上一次尝试中，与正式稿同批读过。本轮重新逐段读完正式稿全文（430 行），并亲读下文引用的源码，结论基于这些读回，但不能声称盲审。
- **废弃旧文件**：上一次尝试误写了 `2026-10-11-ter-remote-control-requirements-r4-review-claude.md`。该文件的来源声明有误，并且照抄了 R3 的结论，已由本文件替代并删除。
- **读取边界**：未读取 `.runtime/`。

## 2 · 方案合理性

**方向正确，复用面选得准。**
- CBS terminal-control 已有在线投递，并按当前 binding 和 TDS session 钉目标（`TerminalControlPersistence.java` 的 `READ_ONLINE_SESSION`，以及 `TerminalControlOwnerService.java:55–75`）。
- TDC 已有 REMOTE_COMMAND 执行与持久化回报：`terminalDataClientActor.ts:681–804`；回执确认后释放，见 `:2076–2093`。
- topology peer 通道已有 SLAVE→MASTER 先例：`sample-member-registry/.../actors.ts:95–103` 用 `{target:'peer'}` 把副机命令发给主机。
- Runtime request ledger 不持久、不同步：`requestLedger.ts:151–152`。
- server-config 服务名是通用的，可承载 `livekit`。
- admin-ui-foundation 已导出 `AdminDetailActionMenu` 与 `useOverlayLock`：`libraries/frontend/admin-ui-foundation/src/index.ts:51,82`。
- 媒体交给 LiveKit，Android 只补 Window 采样、轨道和正常 MotionEvent，没有自写编解码器，没有 MediaProjection，也没有 Accessibility。

**四拓扑闭集成立。** topology 规定“双机拓扑要求本机只有一个物理屏”（`evaluateTopologyOperation.ts:47–59`），所以配对时两机各一屏，不会出现三屏组合。MOBILE_SINGLE、LAPTOP_SINGLE、LAPTOP_DUAL、LAPTOP_PAIRED 四种已经穷尽。

**复杂度偏高的地方集中在存活与握手。** 同一会话同时有四类存活或就绪机制：CBS 30s 租约（MASTER 每 10s 续约）、副机每 10s 向 MASTER 确认的有效期、controller 每 5s 的 KEEPALIVE/ACK，以及 CONTROL_OPEN/CONTROL_READY 加 readyStreams 的授权消费确认。其中两类可以删掉而不损失主流程行为，见 N-2、N-3。

## 3 · Findings

### S-1 · 终端连接 LiveKit 的地址有两个来源，其一违背“统一 serverConfig 管理地址”（CONFIRMED）

**位置**
- R-07 L161：终端授权 `grants[]` 含 `url`。
- R-18 L341：server-config 的 `livekit` 服务向 TER 提供信令 URL，副机只读主机配置；切换服务空间、endpoint 或 revision 时结束会话。
- R-18 L343：“CBS 签发 Room token 前核对所用媒体服务与当前配置的受信目标一致”。

**事实**
- Dexter 原话第 4 条：“连接 LiveKit Server（需要通过统一 serverConfig 管理其地址）”（讨论稿 L15）。
- 讨论稿 L256 写的是“CBS/browser 与 TER 可以拥有各自可达 endpoint，但必须指向同一服务”。
- R-07 的终端登记输入是 `{sessionId,topologyKind,peerIdentity}`（L161），不带终端当前配置的 LiveKit 地址。因此 L343 要求 CBS 核对“当前配置”，对终端一侧无从执行。

**反例**：实施者按 R-07 让 TER 使用 CBS 返回的 `url`。在设备通过 adb reverse 或局域网地址访问服务的环境里，CBS 视角的地址对设备不可达，启动在 30s 后以 START_TIMEOUT 结束。同时 server-config 的 `livekit` 项成为死配置，R-18 的“配置变化结束会话”也失去意义。反过来按 R-18 实施，则 grant 的 `url` 成了无人消费的字段。

**影响**：两种读法会实现出不同的连接行为，其中一种直接违背 Dexter 原话。

**最小修正**：
- 终端 `grants[]` 删除 `url`，TER 和副机只用 server-config 的 `livekit`。
- 浏览器授权保留 `url`。
- L343 改为：CBS 只用自身配置的受信 LiveKit 服务签名；终端连到错误服务时，token 校验失败，按 START_FAILED 结束。不需要 CBS 核对终端配置。

**同根**：description、grants、server-config、浏览器授权四处涉及地址的字段已全部核对，只有终端 grant 的 `url` 重复。

**需 Dexter 裁决**：否，按原话即可定。

### N-1 · 列表“在线”判定新增按会话读取 TDS 心跳参数的新鲜度公式，CBS 当前没有这项数据（CONFIRMED，可简化）

**位置**：R-01 L88–95。ONLINE 要求 `DB now − lastActivityAt ≤ H + W`，H/W 必须取“该会话实际 TDS 配置”，未知时返回 UNCONFIRMED，详设必须闭合来源。

**事实**
- `terminal_connection.latest_state`（`V20260926_000000_000__terminal_binding_owner.sql:141–175`）没有 H/W 列。
- CBS 现有在线判定只看 `disconnected_at_epoch_millis IS NULL`（`TerminalControlPersistence.java` 的 `READ_ONLINE_SESSION`）。
- TDS 在心跳超时时会主动关闭连接并写入断开事实：`TdsWebSocketHandler.java:253` `close(connection,"HEARTBEAT_TIMEOUT")`，close_reason 闭集含 HEARTBEAT_TIMEOUT。

**推论**：新鲜度公式只在 TDS 节点崩溃、来不及写断开事实时才有作用，这属于少见情况。为它闭合来源，要么让 TDS 写入新列（跨 deployable 的 schema 和写入改动，不在本需求列出的范围内），要么所有行长期显示“状态待确认”，远控入口不可点。

**最小修正**：ONLINE 复用 terminal-control 已有的投递判定，即当前有效 binding 精确匹配 latest_state 且未断开；UNCONFIRMED 只用于身份不匹配。删除 H/W 公式。TDS 崩溃残留的“在线”，点击后按 START_TIMEOUT 结束，结果可解释。

**同根**：R-01 列表与 R-06 发起准入两处“在线”已对照。建议二者使用同一判定，避免列表显示在线、发起却被拒，或者反过来。

**需 Dexter 裁决**：否。这是简化，只是不再显示“观察超期”这一子情形。

### N-2 · 副机向 MASTER 每 10s 确认有效期的命令可以删除（CONFIRMED，可简化）

**位置**：R-08 L191 `confirmRemoteControlLeaseCommand`；R-17 L331–333 的副机有效期来源与 t0 折算。

**推论**：副机的停止已经由四个现有信号覆盖，不需要它自己持有 CBS 租约剩余期：
1. MASTER 经 peer 发 stop（R-08 L189）；
2. 配对断链即结束整会话（R-10 L220）；
3. 15s 内没有收到 controller 的 KEEPALIVE 即终止（R-16 L313）；
4. 任一必要 participant 断开即终止（R-16 L317）。

逐一推演：
- MASTER 失去 CBS 时，它自己会在租约到期后结束，并发出 stop 和 SESSION_END。
- MASTER 进程消失时，topology 与 LiveKit 两路都能观察到断开。
- 浏览器消失时，KEEPALIVE 停止，副机在 15s 后终止。

R2 S1 指出的“持续超过 30s 被误停”，根因是设计要求副机持有本地租约。去掉这项要求，问题本身就不存在。

**影响**：可以省掉一个 peer command、一条 10s 周期循环，以及副机侧的单调时钟折算（T-04 中相应的一块）。

**最小修正**：删除 R-08 L191 与 R-17 中的副机有效期条款，并写明“副机生命周期 = MASTER peer join 到 stop、配对连接、controller KEEPALIVE、participant 存活四者的交集”。MASTER 的 CBS 租约和续约保留。

**同根**：五条有效期路径都已核对（浏览器启动期限、MASTER 初始 HTTP、MASTER 续约、副机初始 peer、副机持续 peer）。只有后两条可删。

**需 Dexter 裁决**：否。

### N-3 · CONTROL_OPEN/CONTROL_READY 与 readyStreams 授权消费确认可能多余（PARTIALLY_CONFIRMED，推论）

**位置**：R-13 L263–264、R-14 L287–289、R-16 L313、R-09 第 5 步。

**推论**：输入安全已由两件事保证：
- CBS grant 加上 MASTER 发起的 peer join，确定了谁是本会话成员；
- 每个端点只接受 streamId 等于自己当前 stream 的 POINTER（R-15 L299），旧 stream 返回 STALE_STREAM。

MASTER 本来就会收到各端点的 SCREEN_READY（R-13 L262），可以据此直接标 ACTIVE 并报告 CBS。浏览器收齐 description 中各端点的 SCREEN_READY、对应画面可显示后，即可开放输入。几何变化时，端点发新的 SCREEN_READY，换一个新 streamId 即可。

**影响**：消息类型可以从 8 类减到 6 类，KEEPALIVE_ACK 回到纯存活用途，重握手只需重发 SCREEN_READY。

**最小修正**：作者给出一个具体反例，说明在简化方案下 POINTER 会被错误执行或丢失，则保留现有设计并在需求中写出这个反例；否则删除这两类消息和 readyStreams 语义。

**需 Dexter 裁决**：否。

### N-4 · CBS 签发 token 的服务端依赖没有进入依赖清单（CONFIRMED）

**位置**：R-19 L349–351 只列出 RN SDK、WebRTC fork、Expo plugin、livekit-client 和 `@livekit/components-react`；R-04 L121 要求 CBS 签发短期 grant；R-17 L325 要求 CBS 尽力移除 Room 成员。

**事实**：全仓后端 build.gradle 与版本目录中，没有任何 JWT 或 LiveKit 依赖（已 grep）。T-01 只覆盖终端侧 SDK 组合。

**影响**：CBS 侧会在详设阶段临时选一个 JWT 库或 LiveKit 服务端 SDK，绕过“有轮子就用”与第三方版本核实。

**最小修正**：在 R-19 写明 CBS 使用 LiveKit 官方服务端 SDK（token 签发与 RoomService），并纳入 T-01 的精确版本核实。如果“尽力移除成员”不值得引入 RoomService，就删除 R-17 L325 这一句。R-17 L335 已经承认 kick 不能独自撤销控制。

**需 Dexter 裁决**：否。

## 4 · 重点项逐条结论

| 重点 | 结论 |
| --- | --- |
| 运营项目列表与权限入口 | R-01 承载面是 `ProjectTerminalUpdatePage.tsx` 的“终端更新状态”Tab，详情 Drawer 在 L974 起，当前无操作菜单，可加 `AdminDetailActionMenu`。导航标题交 IA 确认是合理的。新 PROJECT capability 与读权限分离（R-03）。在线判定见 N-1 |
| 四拓扑屏幕/participant 归属 | 闭集成立（§2）。R-10 用显式 participantIdentity/trackSid/screen/endpointId/streamId 配对，不靠轨道顺序 |
| CBS→TDP→MASTER→副机→LiveKit 全链路 | 一致。注意 TDC 在 `transport-event` 命令内同步等待 REMOTE_COMMAND 执行（`terminalDataClientActor.ts:2060–2075`），该命令沿用默认 60s 超时（`runtime/src/types/limits.ts:16`）；超时会经 `dispatchBackgroundCommand` 作废 TDP 连接（`:245–259`）。所以 start 必须在登记和端口启动后尽快返回，不能等到 ACTIVE。R-08 L187 的语义与此相容，详设须写出 start 的超时上界 |
| R-07/R-08 描述、授权与 command 结果 | description 由主机 selector 登记、CBS 冻结，成立。根 start/stop 结果只含 `{sessionId,status,reason}`，所以 TDC 持久记录不带 token，成立。终端 grant 的 `url` 见 S-1 |
| R-13 八类消息、R-14～17 握手/坐标/触摸/断连/手动重发 | 方向矩阵自洽；坐标归一化、黑边、单手势、move 限速、3s 回执、10s 手势上限均有界；任一断连结束整会话、手动新发起，符合 Dexter 裁决 5 与追加裁决。握手可简化见 N-3 |
| MASTER 与副机有效期 | MASTER 租约与续约合理；副机有效期可删，见 N-2 |
| grant 不增私密通道或第二状态体系 | 成立：沿非持久 request ledger 与普通 peer command，没有 token store |
| 副机不连 TDS、不建独立终端 | 成立：R-07 L161、R-10 L220；TDC 凭证只在 MASTER |

## 5 · 静态核实（本轮亲读）

- 正式稿全文 L1–430；讨论稿原话 L9–21 与 L152、L180、L256。
- 源码：
  - `TerminalControlOwnerApi.java`、`TerminalControlPersistence.java`、`TerminalControlOwnerService.java`；
  - `terminal_connection.latest_state` 迁移、TDS 心跳超时关闭；
  - TDC `runRemoteCommand`、远程回报释放、后台命令作废连接；
  - Runtime 重入规则（`createCommandActorDispatcher.ts:102–110`，同 commandName 且同 actor 才算重入，所以 start→TDC HTTP 不冲突）；
  - request ledger 不持久；
  - topology peer gateway 与 SLAVE→MASTER 先例，topology facts 与“双机要求单屏”；
  - server-config 类型、platform-ports 现有端口集合（尚无 remote）；
  - `ProjectTerminalUpdatePage.tsx` 的详情 Drawer；foundation 的 `AdminDetailActionMenu` 与 `useOverlayLock`。
- 后端依赖：全仓无 JWT/LiveKit 库。

## 6 · 未验证项

| 项 | 状态 |
| --- | --- |
| LiveKit 官方行为（可靠数据 15KiB 上界、destinationIdentities、reconnecting 语义、token 撤销局限） | 本轮无法访问 docs.livekit.io，沿用作者引用，UNVERIFIED |
| T-01 SDK 组合与自定义轨道桥 | OPEN |
| T-02 持续双 Window 捕获、覆盖与释放 | OPEN |
| T-03 native 触摸、本地并用、坐标 | OPEN |
| T-04 ICE/TURN、断连事件、租约回收 | OPEN |
| V-01～V-15、IA/UI、实现、依赖解析、部署、cleanup | NOT_RUN |

用产品负责人的话说，以下事情还没有人验证过：
- 后台能否看到连续、清晰的终端画面；
- 点按钮、滚列表、敲虚拟键盘能否真实生效，现场人员同时操作时是否互不干扰；
- 双屏与双机时两块画面是否对得上、点得准；
- 断网后是否两屏都停、能否手动重新发起；
- 媒体服务的部署与清理。

## 7 · DESIGN_GAPS

1. `verification-governance.md` 仍然没有 M/S/N 定义。本文按以下口径分级：S 表示按原文实施会产生真实功能缺陷，或与 Dexter 原话冲突；N 表示简化或一致性问题。这个口径需要 Dexter 确认。
2. 规范里没有“一个会话最多保留几类存活机制”之类的判据，N-2、N-3 只能凭第一性原理判断。这一条只记录，不在评审里立规则。

## 8 · 与 R3/intake 对照

- R3 给出 GO_WITH_UNVERIFIED_UI 0/0/0。本轮差异如下：
  - S-1：R3 未比对 R-07 的终端 grant 与 R-18。
  - N-1：R3 未核对 latest_state 表结构。
  - N-4：依赖清单缺 CBS 侧条目。
  - N-2、N-3：本轮按 Dexter“不要过度设计”的要求复核时新增。
- intake 中 R1/R2 的 S 项在当前字节中均已有落点。但 R2 S1 的修法（副机有效期命令）本轮判为可删，见 N-2。

## 9 · 授权声明

本文是静态需求评审。新写本文件，删除了本会话上一次误写的评审文件，其余路径只读。本结论不授权详设定稿、实现、规范或记忆修改、依赖安装、生成、构建、测试、verify、DEV、reset/seed、Web/设备、L2、UAT 或部署，也不涉及 Codex 在途的阶段 C。
