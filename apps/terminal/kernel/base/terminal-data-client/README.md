# `kernel.base.terminal-data-client` · 终端业务客户端 owner

## 定位

本包独占终端凭证、激活与取消激活 command、TDS 业务协议和激活/连接/延时 selectors。

## 作用

本包消费生成的 terminal HTTP operation，通过注入的 transport command facade 发出不透明 HTTP/WS 请求；transport 不解释 TDS 业务帧或凭证。

## 结构

`src/moduleName.ts`、`src/dependencies.ts` 与 `src/index.ts` 声明包边界；`src/generated/terminalApi.ts` 由本仓 OpenAPI 生成策略产生，禁止手改。

## 用法

激活、在线/离线取消激活、建连、断连均通过本包公开 command，由 owner actor 执行。凭证、待完成激活重试、HTTP operation 语义和 TDS 业务协议只由本包持有；待完成激活的秘密仅在当前 JS runtime 的内存中供同一操作重试，runtime 重启即清除，成功建立的最终凭证才进入受保护持久化；凭证字段不由任何 selector 返回。业务协议消息和 socket 回调先转为本包内部 command，actor 才能更新 state。

`selectActivationState`、`selectConnectionState`、`selectConnectionLatency`分别只读激活身份摘要、通用连接状态和RTT样本，不返回credentialSecret、激活码或完整wire请求。额外的`terminal-data-client.status-projection` slice只从这些owner selector生成展示所需的激活摘要、连接摘要、最新RTT和sourceNodeId；以plain owner persistence缓存并按MASTER→SLAVE同步。原始client slice仍为isolated；投影不含deviceId、credential、pending activation、激活码或RTT历史，不用于业务资格。副机状态页仅显示sourceNodeId匹配当前peer的缓存；current peer的projection revision未apply时标为“上次主机状态（待同步）”，无匹配缓存时显示等待，不显示“未激活”。

装配层注入生成凭证的安全随机源、业务服务名、通用transport command facade、版本和时钟；本包在actor内使用生成的HTTP operation client，并经transport的通用HTTP command执行，不把HTTP schema或业务错误码交给transport。地址/代理快照由composition注入transport network adapter，client不读取server-config selector、state或storage。

## 在这个包上迭代时

先读批次二详设 CP-03、R-9/R-10 与 TR-09～TR-11；新增命令、selector 或协议行为时同步公开导出、不变量、测试和 README。
