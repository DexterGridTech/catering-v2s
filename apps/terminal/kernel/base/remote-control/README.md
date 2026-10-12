# Remote Control

本包是终端应用内远控的业务 owner，负责远控 command、actor、ephemeral state 与 selector。它协调 CBS/TDC 授权、当前 topology/display 资格和 `RemoteControlPort`，但不拥有 LiveKit SDK、Android Window、服务地址配置或组织业务数据。

DataChannel 协议的唯一输入为仓内 `contracts/protocol/terminal-remote-control-protocol.json`。`scripts/generate/terminal-remote-control-protocol.mjs` 生成本包 `src/generated/terminalRemoteControlProtocol.ts` 的消息闭集与 value types；不要手改生成文件，也不要把触摸内容写入持久化状态或日志。

LiveKit 地址由 composition 从 server-config selector 读取后传给 adapter。当前 DEV 联调使用裸 HTTP/WS 与直接 UDP 媒体；本包和 adapter 接受 server-config 当前配置，不把 HTTP/WS 固定为唯一允许的正式 scheme。
