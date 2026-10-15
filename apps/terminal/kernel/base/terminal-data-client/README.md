# `kernel.base.terminal-data-client` · 终端业务客户端 owner

## 定位

本包独占终端凭证、激活与取消激活 command、TDS 业务协议，以及激活、连接、延时、订阅、展示投影和 HTTP 上下文 selectors。

## 作用

本包消费生成的 terminal HTTP operation，通过注入的 transport command facade 发出不透明 HTTP/WS 请求；transport 不解释 TDS 业务帧或凭证。

## 结构

`src/moduleName.ts`、`src/dependencies.ts` 与 `src/index.ts` 声明包边界；`src/generated/terminalApi.ts` 由本仓 OpenAPI 生成策略产生，禁止手改。`src/features/actors/terminalDataClientActor.ts` 保持唯一 actor 与装配入口；`features/actors/shared/installCredentialCommands.ts`、`installConnectionCommands.ts`、`installTerminalTopicCommands.ts`、`installRemoteOperationCommands.ts` 和 `installTerminalHttpCommands.ts` 分别登记本 owner 的命令处理器，`createTerminalDataClientSession.ts` 共同持有同一连接周期资源。纯 wire parser 留在 `src/foundations/parseTerminalConnectionMessage.ts`。

## 用法

激活、在线/离线取消激活、建连、断连均通过本包公开 command，由 owner actor 执行。凭证、待完成激活重试、HTTP operation 语义和 TDS 业务协议只由本包持有；待完成激活的秘密仅在当前 JS runtime 内存中供同一操作重试，runtime 重启即清除；最终凭证由本包以明文持久化，并在主机持久化成功后作为同一凭证事实按 MASTER→SLAVE 同步。副机不独立生成或改变该凭证，不独立激活或建立 TDS 连接，但可经本机 TDC 直接请求 CBS。凭证秘密不由任何 selector 返回。业务协议消息和 socket 回调先转为本包内部 command，actor 才能更新 state。

公开 selectors：

- `selectActivationState`：读取激活摘要。
- `selectConnectionState`：读取连接状态及当前连接身份。
- `selectConnectionLatency`：读取最新 RTT 与有限时间窗内的样本。
- `selectTerminalTopicSubscriptions`：读取 TDC 持有的订阅记录，供业务 feature 协调其订阅意图。
- `selectTerminalClientStatusProjection`：读取给终端状态界面使用的有限展示投影。
- `selectTerminalHttpContext`：按服务名读取当前凭证、binding、实例角色和服务配置版本组成的请求上下文；HTTP owner 用它判断请求资格，不读取凭证秘密。

以上 selector 不返回 credentialSecret、激活码或完整 wire 请求。`terminal-data-client.status-projection` slice只从本包 owner selector生成展示所需的激活摘要、连接摘要、最新RTT和sourceNodeId；以plain owner persistence缓存并按MASTER→SLAVE同步。该展示投影不含deviceId、credential、pending activation、激活码或RTT历史，不用于业务资格。副机状态页仅显示sourceNodeId匹配当前peer的缓存；current peer的projection revision未apply时标为“上次主机状态（待同步）”，无匹配缓存时显示等待，不显示“未激活”。

装配层注入生成凭证的安全随机源、业务服务名、通用 transport command、版本和时钟。本包 actor 使用生成的 HTTP operation client，并经 transport 通用 HTTP command 执行；HTTP schema 和业务错误码不交给 transport。需要构造已认证 HTTP 请求上下文时，本包通过 `selectServerConfigServiceContext` 只读取当前服务的 `selectedSpace` 与 `serviceRevision`，不读取 server-config state、持久化内容、地址或代理配置。地址、代理及实际网络选择由 composition 注入 transport network adapter；TDC 仍是请求凭证与业务 owner。

```ts
import {createRequestId} from '@catering-v2s/kernel-base-contracts'
import {connectTerminalCommand, selectConnectionState} from '@catering-v2s/kernel-base-terminal-data-client'

await runtime.dispatchCommand(connectTerminalCommand, Object.freeze({}), {requestId: createRequestId()})
const connection = selectConnectionState(runtime.getState())
```

`runtime` 是已装配本包并完成初始化的 Runtime；调用方请求 owner 建连并读取连接状态，不直接创建 socket。

## 在这个包上迭代时

先读批次二详设 CP-03、R-9/R-10 与 TR-09～TR-11；新增命令、selector 或协议行为时同步公开导出、不变量、测试和 README。

```sh
yarn workspace @catering-v2s/kernel-base-terminal-data-client typecheck
yarn workspace @catering-v2s/kernel-base-terminal-data-client test
yarn workspace @catering-v2s/kernel-base-terminal-data-client lint
```
