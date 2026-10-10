# TER 应用内远程控制：外部评审最小处置

## 0. 来源与范围

Dexter 指派：“内容仅供参考，只考虑90%的核心主流程，切勿过度设计”。本文件是作者亲自核验、取舍与文档修订记录，不是新的独立 review。

```text
AUTHOR_ROLE=Claude / MAIN_AGENT
SOURCE_REVIEW=doc/review/platform/2026-10-10-ter-remote-control-requirements-external-review-claude.md
SOURCE_VERDICT=NO-GO 0M/1S/4N
SOURCE_REVIEWED_SHA256=4fa449bfc45adb6c64ae229ad09bf3a01ac23550e0d070a3611c11fc49cd1730
CURRENT_FORMAL_SHA256=16e4c8474310caad0f6acfeafb34bfd8b74445b6d86f4eee1304e79b47b10ca7
CURRENT_DISCUSSION_SHA256=432268c032e1570e8d12f41930949fc1ecff0c3f971c67d7550efe939856a03e
INDEPENDENT_VERDICT_ON_CURRENT_BYTES=NONE
EVIDENCE=STATIC_DOCUMENT_AND_OWNING_SOURCE_READBACK
IMPLEMENTATION_AND_DYNAMIC=NOT_RUN
```

旧 verdict 保留旧字节边界；不重开旧 cycle、不新增内部 review。改动仅为正式需求、讨论稿和作者处置记录；没有修改源码、规范、记忆、依赖或阶段 C，也没有联系在途 Codex、读取 .runtime 或执行动态运行。

## 1. 逐项核验与处置

| 输入 | 主 agent 分类 | 作者处置 / 当前正式稿位置 | 事实、取舍及反例边界 | Dexter 决策 |
| --- | --- | --- | --- | --- |
| S-1 LiveKit 地址双来源 | CONFIRMED | CLOSED；R-07:165、R-18:343–345、V-13:395 | 原话要求统一 server-config。终端 grant 删除 url，browser grant:164 保留。CBS 用自身配置签名，不再宣称校验未提交的终端 URL。各可达地址可以不同，但须到同一服务；错误配置按启动失败结束，不加服务地址证明机制 | 否，忠实原话 |
| N-1 在线 freshness 来源 | CONFIRMED（来源缺口）；必要性属于设计推论 | CLOSED；R-01:92–99、V-01:383 | TerminalControlPersistence.java:35–41,85–96 只有未断开查询；V20260926_000000_000__terminal_binding_owner.sql:141–175 无 H/W；TdsWebSocketHandler.java:249–255 已处理超时关闭。复用当前投递判定，列表与发起同源。节点异常退出未写断开可能暂显在线，点击后失败/超时，不为此增加 schema 或跨 TDS 配置查询 | 否，按本轮主流程简化裁决 |
| N-2 副机独立租约确认 | CONFIRMED（可删除的重复机制）；退出充分性为设计推论 | CLOSED；R-08:195、R-17:329–335、V-12:394 | 删除副机周期确认 command、初始/续租 peer 请求与时钟折算。主机仍续 CBS 租约；副机按 peer stop、配对/必要 participant 断连或 controller watchdog 退出。主机 CBS 不可达时主动结束/离房，使副机结束；不能承诺零延迟物理断连判断。不加第二失败账本、补偿循环 | 否 |
| N-3 两层输入授权握手 | PARTIALLY_CONFIRMED：旧竞态真实，但由额外授权消费步骤引入；不是天然必须保留 | CLOSED；R-09:207、R-13:264–271、R-14:279–291、R-16:315 | 改为端点先完成本机输入映射，再声明 SCREEN_READY。即使 slave 声明先到 browser、后到 MASTER，第一个输入也已具备端点接收条件；无需 CONTROL_OPEN/CONTROL_READY、ACK.readyStreams。browser 必须收齐全部画面才能操作；现有 KEEPALIVE 触发重发当前声明，覆盖晚入房。几何变化拒绝旧 stream，仅重建映射/声明；不再加第二几何计时器。六类消息的方向、字段与 V-03/V-08/V-10 同步 | 否 |
| N-4 CBS 服务端依赖遗漏 | CONFIRMED | CLOSED（依赖方向补齐，版本仍 OPEN）；R-19:351–353、T-01:409、来源:418 | 后端 build.gradle/版本目录搜索没有既有 JWT/LiveKit 依赖。LiveKit 官方 JVM SDK 提供 Java token/Room API 示例，选择 io.livekit:livekit-server 的既有能力，不自写签名/HTTP client。未安装/解析，不钉主分支示例版本为本仓版本；选定精确版本及 Java 调用/RoomService proof 留在 T-01 | 否 |

所有 CLOSED 仅表示作者最小文档处置完成，不代表独立 reviewer 已 GO 或实现验证通过。

## 2. 方案合理性与同根扫描

- 解决的是有权限的运营管理员查看并操作 TER 应用画面；四种拓扑、双屏、无感、本地同时操作、任一配对屏断开结束整会话及手动重新发起均保留。
- 只保留两种必要存活机制：主机 CBS 租约服务占用释放与授权复核；controller/endpoint watchdog 服务媒体连接失去存活。两者解决不同问题。删除副机租约和第二层输入授权消费确认，避免一件小功能维护四套循环/资格。
- 凭证 owner、现有 command/request/selector、peer command、平台端口、capture/输入 adapter 和成熟 SDK 边界保留；不生产化 automation-agent，不加自写编解码器、secret 通路、持久触摸、离线补发、常态轮询或通用恢复框架。
- 同根读取并修正地址的三个消费者（browser/MASTER/SLAVE）、六个 HTTP 能力、六类控制消息、四拓扑、启动/画面变化/断连/结束/新发起、V-01～V-15 和 T-01～T-04；其余成员逐一核对。正式稿没有残留已删除 command/type/readyStreams 的执行要求。历史 review/intake 的旧设计说明保留为历史，不改写旧 verdict。
- 顺带清除 R-07:177、R-10:224 对副机凭证的旧表达：沿 Dexter 最新阶段 C 共享 TDC credential/CBS credential-only 裁决；本专项不改阶段 C 正本/源码，阶段 C 最终实现是详设须重新读取的依赖。
- 不采纳外部 DESIGN_GAPS 中“最多几套存活机制”的新规范建议；按实际收益删机制即可，不为这次需求建立通用治理规则。M/S/N 的定义也不在本任务范围内扩写。

## 3. 官方材料与未验证项

[LiveKit 官方 JVM SDK](https://github.com/livekit/server-sdk-kotlin) 的 Java 示例具备 AccessToken 与 Room API，支持服务端 SDK 复用方向；[官方 data packets](https://docs.livekit.io/transport/data/packets/) 说明定向发送、可靠数据有限重传且不为未连接接收方缓存，因此晚加入仍需要当前声明重发。这是官方通用语义，不是本仓选定版本/依赖图或运行证明。原 Kotlin API reference 页面本次不可访问，未据此声称精确 API 已核验。

- T-01：实际客户端/服务端 SDK 解析组合、native 轨道桥、Java 调用及 RoomService，OPEN。
- T-02/T-03：真实双 Window 连续采样、普通控件/虚拟键盘输入、本地同时操作、释放，OPEN。
- T-04：真实 ICE/TURN、SDK 断连/watchdog 与 MASTER 租约，OPEN。
- 新能力、V-01～V-15、具体 IA/UI、部署、编译、测试、verify、DEV、Web/设备、L2、seed/reset、cleanup，NOT_RUN。

本轮不要求新增完整验证，也不把静态取舍写成 PASS；修订字节如需独立结论，由 Dexter 决定后续外部差量复核。
