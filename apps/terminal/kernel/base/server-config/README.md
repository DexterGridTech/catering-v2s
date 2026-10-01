# `kernel.base.server-config` · 服务连接配置 owner

## 定位

本包拥有服务地址、代理配置及其持久化；终端连接配置只能经本包命令更新，由组合层向 transport adapter 提供有效配置。

## 作用

server-config 不保存终端凭证，也不负责连接重试或 TDS 业务协议。凭证、激活和取消激活动作归 `terminal-data-client`；通信机制归 `transport`。

## 配置与命令

组合层通过 `createServerConfigModule(defaults)` 注入不可变 defaults。defaults 按环境列出服务地址及可选 HTTP proxy；地址覆盖按服务全量写入，必须给每个地址提供唯一名称、完整 URL 与正 timeout。环境切换、设置/清除服务覆盖、恢复全部 defaults 都经本包 command。非法配置整次拒绝，不部分写入。

`selectServerConfiguration` 返回当前与默认配置、覆盖服务列表及 `passwordConfigured`，不返回密码。网络 adapter 专用入口位于包子路径 `@catering-v2s/kernel-base-server-config/network-adapter`；仅组合层可将其 `resolveServerNetworkSnapshot(state, defaults, serverName)` 注入 transport 的网络 provider。terminal-data-client 不消费这个快照。

代理密码只允许通过 `persistSecure` 保存；设置命令可明确设置新密码、沿用已设置密码或移除认证。普通 selector、日志与错误不包含原文。覆盖代理是完整服务设置，不继承 defaults 的代理密码。

本包的 `server-config.configuration` slice 声明 D-16 的 reset 保留。state runtime 只保留其持久化字段/记录；`serviceRevisions` 等易失值回到初始状态。

## 用法

组合层通过 network-adapter 子路径注入配置 resolver；不得绕过 owner 直接读取持久库。除组合层的网络 adapter 外，其它 consumer 使用脱敏 selector。

## 在这个包上迭代时

先读批次二详设 CP-02、R-11 与 TR-09，再扩展 owner 命令/selector 和 state 声明；地址与代理秘密按日志规范脱敏。
