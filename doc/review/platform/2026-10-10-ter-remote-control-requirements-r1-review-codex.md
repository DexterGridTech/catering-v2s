# 正式需求独立对抗审查 R1

主 agent 转录独立 reviewer `/root/remote_requirement_review_r1` 的报告。独立结论仅对应下列 SHA；后续追加裁决和作者修订另见 intake，不改写该 verdict。

```text
REVIEW_CYCLE_ID=TER_REMOTE_CONTROL_REQUIREMENTS_2026-10-10
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ACTION_1_VARIANT=1-B 文档提取
reviewerInputChecklist=doc/review/platform/2026-10-10-ter-remote-control-requirements-r1-input-checklist-codex.md
blindReviewDeclaration=先独立形成 findings/verdict，未读取作者 intake 或自审结论
authorMaterialReadAfterIndependentVerdict=false
BLIND_REVIEW=true
AUTHOR_INTAKE_READ=false
REVIEWED_SHA256=82c110e82592064e355aca88e1b54a872fe9f955c28344dbc8b00967e9eff82e
VERDICT=NO-GO
M/S/N=0/4/1
L1_ENGINEERING=findings S1/S2/S3/S4；静态需求及源码复核，无动态证据
L2_USER_VISIBLE=findings S3/N1；其余产品语义静态对账，实际页面和终端行为 NOT_RUN
L3_UNVERIFIED=状态展示、权限入口、全屏一/两路画面、四拓扑、点击拖动滚动及虚拟键盘、本地并行操作、断连释放与手动重发均未动态验证
SAME_ROOT_SCAN=见下文完整分母
DESIGN_GAPS=S1/S2/S3/S4；另 review-standard verdict 字面冲突见末项
TEMPLATE_COVERAGE=四模板均为后续 Journey/IA/UI/详设产物，本轮逐节 NOT_APPLICABLE_WITH_REASON
EVIDENCE_TIER=READ_ONLY_STATIC_REQUIREMENTS_AND_SOURCE_REVIEW；官方通用行为查证；全部运行 NOT_RUN
```

本轮以证伪为起点形成 findings/verdict，没有读取作者 intake、自审结论或继承前轮 verdict。被审对象为 `doc/plans/platform/2026-10-10-ter-remote-control-formal-requirements-claude.md` 全文 1–397 行；原始意图及逐字裁决以 discussion §1、§14 和当前会话为准。

## S1：统一发送者规则排除了协议自身必需的端点间消息

位置：正式需求 L242；同根 L250、258、284。

状态：CONFIRMED（文档事实）；Dexter 决策：不需要。

L242 规定“端点只接受 CBS 授权的 controller”，同时又规定 slave 接受 MASTER 内部控制。L250 却要求 slave 的 SCREEN_READY 发给 MASTER；L258 要求 MASTER 的 CONTROL_READY 发给 slave；L284 要求实际端点发出的 SESSION_END 结束全会话。MASTER、slave 都是 endpoint，统一接收规则至少排除了 slave→MASTER SCREEN_READY，endpoint→endpoint SESSION_END 也没有一致例外。

反例：正常 paired 启动，slave 发布 secondary 后发送 SCREEN_READY，MASTER 因 sender 不是 controller 而丢弃，两屏不能一起就绪。实现者只能自行突破一条规则或实现不能启动的流程。

最小修复：增加有限 type/sender/receiver/destination/当前身份矩阵。SCREEN_READY 允许 endpoint→controller/MASTER；CONTROL_READY 允许 MASTER→controller/slave；SESSION_END 允许本会话实际必要成员→实际成员；POINTER 仍只能 controller→精确端点。MASTER 本地就绪不建自发网络环路，陌生 sender/session 静默丢弃。不新增消息总线或角色框架。

## S2：可信 manifest 是握手前提，但封闭 HTTP 输出没有交付它

位置：正式需求 L146、150–154；同根 L142、171、175、187、202、256、258。

状态：CONFIRMED（文档字段缺口）；Dexter 决策：不需要。

R-07 声明能力/字段闭集，但发起仅输出 expectedScreens，controller grant 仅给自己的 participant identity，terminal grant 只有文字。expectedScreens 仅是槽位数组，不是 endpoint/participant 映射。消费者却要求核对 CBS manifest、endpointIdentity、主副归属和完整映射。CBS“由实际就绪拓扑解析”的来源也没有闭合。

反例：browser 收到 SCREEN_READY 后，只有 SDK sender，没有可信的 screen→endpointId→participantIdentity 映射；不能确定 sender 和 MASTER 定向对象。使用消息自报填补会违背“不能自行改变主副归属”。

最小修复：定义本能力最多两屏的可信会话描述及其通过认证响应交付的路径，包含 session/room/controller、MASTER endpointId/participantIdentity、screen 的固定归属、可信拓扑 owner 来源、terminal/slave grant 形状和 readyScreens 类型。trackSid/streamId 仍由授权端点生成，不需 CBS 预知。不另造 manifest registry。本项合并 CBS 拓扑来源、可信描述和 grant 缺口。

## S3：ACTIVE 几何重建缺少握手期限和续约规则

位置：正式需求 L212、258、260；同根 L154、189、296、298、300、328。

状态：CONFIRMED（状态规则未闭合）；Dexter 决策：不需要。

ACTIVE Window/几何变化要生成 streamId、禁止全部输入、重复握手，但重发只限初始 STARTING 期限，CBS 又禁止状态回退且仅全部端点就绪才续约。

反例：会话运行三分钟后旋转，一条 READY 丢失。初始期限已过、不能回到 STARTING，又没有新期限或续约语义；实现者需自行补写路径。[LiveKit 官方](https://docs.livekit.io/transport/data/packets/) 的 reliable 是有限重试 best-effort，发送成功不能证明必达。

最小修复：区分 CBS ACTIVE 与本地屏幕就绪；几何重建不新建业务 session，定义不超过当前授权的有限期限、子阶段重发条件、期间续约条件，禁止无限延长。到期按既有结束码结束；全部屏幕重新授权前禁输入。不新建持久状态或恢复框架。

## S4：错误和主动取消没有完整可编码的回执规则

位置：正式需求 L240、242、244、276、278；同根 L222、270、284、333–334。

状态：CONFIRMED（wire contract 缺口）；Dexter 决策：不需要。

未知 v/type、已授权 sender 畸形消息和重复 seq 要返回有限错误，但闭集只有 INPUT_RESULT，其 forSeq/gestureId 未必能从非法帧取得。端点因本地冲突或10秒超时主动取消，未定义 forSeq 的引用和 browser 清理。

反例：缺 gestureId 的 POINTER 或未知 type 无法构造合法回执；端点主动取消后 browser 仍保持活动 gesture。

最小修复：未知协议用 v1 SESSION_END{reason:UNSUPPORTED_PROTOCOL}；可关联的合法 POINTER 用 INPUT_RESULT；无法关联的畸形帧明确丢弃/计数或既有终止。DUPLICATE 仅用于可关联输入，不产生回执循环。主动取消引用已接受 DOWN seq 并发 CANCELLED，browser 清理同 gesture。不新增通用 ERROR/RPC。

## N1：CONTROL_READY 的跨接收者到达顺序可能丢失首个输入

位置：正式需求 L187、258、270、282。

状态：CONFIRMED（接收完成判据缺口）；竞态后果为静态推论；Dexter 决策：不需要。

browser 收到 CONTROL_READY 后开放输入，slave 也须收到自己的授权集合；不同发送者/recipient 的消息不能以 reliable 推导先后。browser 先点 secondary 时 slave 可能仍 NOT_READY。安全拒绝正确，但正常第一下失效。

最小修复：复用 KEEPALIVE_ACK.readyStreams 作为“端点已消费本次输入授权”的判据，而不只是媒体存在；或明确 NOT_READY 后等待反馈。不要重发可能已执行的点击或另建多阶段通用协议。

## 同根扫描

| 根问题 | 完整分母及结果 |
| --- | --- |
| S1 | 8类消息：SCREEN_READY、CONTROL_READY、SESSION_END 缺端点间例外；其余5类正常方向一致；MASTER 本地无需回环 |
| S2 | 6个 HTTP 能力全部核对；前5项涉及描述/消费者，结束不需新增 manifest；TDP、peer、四拓扑和握手同核，不重复立 finding |
| S3 | 初始启动、ACTIVE重建、断连、主动结束、手动新发起5路径；其余4条明确，重建缺口 |
| S4 | 未知v/type、畸形、重复seq、输入冲突、自动取消、browser取消、正常回执、结束8路径；不可关联错误和主动取消缺规则 |
| 旧会话释放 | 旧start/stop/ready、迟到HTTP/ACK、新session前native替换、slave停止、watchdog、租约、Room移除；未发现需新增持久恢复或扫描的同根问题 |
| 秘密记录 | TDC map、Runtime ledger、peer参数/结果、隔离slice、配置/日志；稿承认复制风险并列T01，不把OPEN要求为本轮运行 |

## 合理性、模板与未验证

CBS terminal-control、TDP、topology peer、Window owner 和输入 owner 的复用方向成立。LiveKit 承担媒体，Android 补自有 Window/native 输入接缝，不需系统远程桌面或生产化调试 agent。T01–T04 的兼容、frame桥、普通界面、输入、网络和释放需后续证明，OPEN 不构成本轮运行要求，也不是已实现能力。

4096bytes、128字符、1/2屏、1280px/15fps、30move/s、64队列、3秒回执、10秒手势、5/15秒心跳、30秒启动/租约及10秒续约都是文档工程选值/初始目标，不是实测SLO。S3审查的是有限路径是否闭合。

四模板逐节 NOT_APPLICABLE_WITH_REASON：当前仅授权正式需求，未来 Journey/IA/UI/详设未授权为本次交付物。Journey §1–7；IA元数据、维度/几何、共享/错误/对账/完成；UI §1–10及admin/Heritage/线框/TestId/控件与候选；详设 §0–14及CP/横切/owner/迁移seed/oracle/双读和对账。没有把未来工件不存在列缺项。

静态核对：全部裁决、后台/权限、点击才提示占用、无音频、无感、主副同会话、断连全结束/手动重发、同时输入和owner。测试已证：无。实际状态、入口、布局、四拓扑视频/输入、重建/超时/释放均 NOT_RUN。

`review-standard.md:L172` 与 skill 的字面“L3非空只能 GO_WITH_UNVERIFIED_UI”无法表达实质S+UI未运行。本轮保持 NO-GO，不降为条件GO；治理缺口记录、不改正本。四S关闭后静态结果最多 GO_WITH_UNVERIFIED_UI，不授权运行。
