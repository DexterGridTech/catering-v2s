# TER 第三方库整改详设与计划：独立盲审第 1 轮处置

```text
REVIEW_CYCLE_ID=TER-THIRD-PARTY-REMEDIATION-DESIGN-V3-3-2026-09-28
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
VERDICT=NO-GO
M/S/N=2/2/0
```

## Findings 及处置

| Finding | Intake | 源码事实与最小处置 | 结果 |
|---|---|---|---|
| M-1 TP-A7 的 VM 心跳 oracle 不可执行 | `CONFIRMED` | `TerminalTopologyServer.startHeartbeat()` 发 NanoWSD control ping，`WebSocket.onPong()` 更新内部心跳；`kernel/base/transport` 同时发送 JSON `type=ping`，其 pong 由 transport session 消费。旧设计没有定义从生产双端读取两类 heartbeat、非 heartbeat text-frame、连接变化的观测契约。现已把两类 heartbeat 分开计数，按单调时钟记录每个端点的 connection event/counters；不记录 payload，并要求 focused 变异能对非 heartbeat text-frame、重连及缺失 close reason 判红。两类 heartbeat 都增长、非 heartbeat text-frame 为零、无 open/close 变化及配对仍存续才可通过。 |
| M-2 topology runner 会清除设备数据 | `CONFIRMED` | `tools/terminal-topology/run-dual-device.mjs:coldLaunch` 当前在 `am force-stop` 后调用 `pm clear`，与本批未授权清数据冲突。CP-A 现要求先移除该调用，静态/ focused 调用图断言 stage-1 不含 `pm clear`、`pm uninstall -k` 或等价擦除；只允许通过产品路径准备初态，不能假设新装或重建 VM 已授权；无法准备时保持 OPEN，cleanup 只 force-stop 本 run 拥有的进程。 |
| S-1 TP-A8 Journey 分母不全 | `CONFIRMED` | `runMemberJourney` 已有 18 个 `observe`/`progress` 标签，旧文档未列出全集。详设与计划现冻结逐项标签，并要求 focused exact-set 测试，任何新增、改名、漏记即红。 |
| S-2 JVM 真 socket 及线程判据不够明确 | `CONFIRMED` | 旧判据没有具体生产入口、socket 交互、参数来源与线程回收身份。现明确经 `TerminalTopologyHostRegistry.start` 建真 loopback WebSocket，读取生产 JSON 心跳间隔/超时；生产配置 idle 3×timeout、需求指定短帧/半开/20 cycles；以 thread ID 和 NanoHTTPD/NanoWSD stack 或 heartbeat thread 名做前后 census，`Registry.stop` 后在 timeout+interval 内回到基线，禁止 fake socket/clock/Registry 替代。 |

## 用户补充：设备身份

Dexter 补充虚拟机可能删除重建、ADB serial 会变化。已在详设与计划中将 serial 定义为每次运行重新发现的可变连接句柄：运行前查询 `adb devices -l`，再以 AVD 名/物理设备属性和实时 display shape 唯一绑定角色；发现值显式传入 runner 并写入本 run manifest。不得写入默认 serial、按编号/列表次序猜设备，发现歧义或 serial 变更即 fail closed。设计中出现旧 serial 仅用于标明它是不可继承的历史观察，不可作为目标配置。

## 轮次状态

Round 1 的四项 finding 已以 owning source 回读并纳入设计/计划修订。进入本 cycle 最后一轮 fresh 定向审查；Round 2 后按治理规则硬停止，不派第三轮。本文记录处置，不是整批设计 GO，也不授权实施。
