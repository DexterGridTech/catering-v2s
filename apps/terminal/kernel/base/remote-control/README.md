# `kernel.base.remote-control` · 终端应用内远控 owner

## 定位与作用

本包拥有远控会话 command、actor、ephemeral state 与 selectors。actor 复核 CBS/TDC 授权、当前 topology/display 资格，并编排注入的 `RemoteControlPort`。LiveKit SDK、Android Window 和服务配置事实分别属于 adapter 与 server-config；本包读取 server-config 的公开 selector，并解释远控使用的 LiveKit 地址及配置身份。

DataChannel 协议的唯一输入是 `contracts/protocol/terminal-remote-control-protocol.json`；`scripts/generate/terminal-remote-control-protocol.mjs` 生成 `src/generated/terminalRemoteControlProtocol.ts` 的消息闭集与 value types。不要手改生成文件，也不要把触摸内容写入持久状态或日志。

## 结构

- `src/declarations/commands.ts`：公开 start/join/stop command 与内部 port-event command。
- `src/features/actors/remoteControlActor.ts`：拥有唯一会话/fence 生命周期、端口准备、报告、lease、停止清理及 actor 装配；不保留匿名 command 大段实现。
- `src/features/actors/shared/createRemoteControlSession.ts`：该 owner 的单一 Runtime session，保存序列、手势、fence、定时器和串行执行队列；不创建第二业务状态源。
- `src/features/actors/shared/installRemoteSessionCommands.ts`：注册并执行 MASTER start 与 stop command。
- `src/features/actors/shared/installRemotePeerCommands.ts`：注册并执行 SLAVE join command，重用 actor 注入的 fence/endpoint 能力。
- `src/features/actors/shared/installRemotePortEvents.ts`：处理唯一 port-event command，将 port、状态、协议数据交回 actor 的同一会话资源。
- `src/foundations/parseRemoteControlMessage.ts`：纯协议消息解析与结构校验；消息处理和业务决策仍由 actor 执行。
- `src/features/actors/shared/createOwnerHttpClient.ts`：本包私有的生成 HTTP client 执行器。
- `src/features/slices/remoteControl.ts`：会话状态。
- `src/foundations/readRemoteControlState.ts`：selectors 共用的纯状态读取校验。
- `src/selectors/selectRemoteControlStatus.ts`、`src/selectors/selectRemoteControlScreen.ts`：分别读取会话状态和单屏就绪事实。
- `src/application/createRemoteControlModule.ts`：注册 actor、slice、selector 与 port 事件资源。
- `src/generated/terminalApi.ts`：由 `scripts/generate/terminal-client-api.mjs` 按 remote-control owner policy 生成的内部 API；不从根 barrel 导出。
- `src/generated/terminalRemoteControlProtocol.ts`：由仓内 DataChannel 协议生成。

## 用法与边界

调用方通过根 barrel 使用 `startRemoteControlCommand`、`joinRemoteControlCommand`、`stopRemoteControlCommand`、`selectRemoteControlStatus` 和 `selectRemoteControlScreen`。模块装配注入 `topologyModuleName`、`RemoteControlPort` 与本 App 的 `serverSpaces` 环境输入；本包通过 server-config 的公开 selector 解析当前 LiveKit 地址和配置身份。

以下 factory 接线与两个 integration assembly 中的实际调用一致：

```ts
import {createRemoteControlModule} from '@catering-v2s/kernel-base-remote-control'

const remoteControlModule = createRemoteControlModule({
  topologyModuleName: integrationModuleName,
  port: platformPorts.remoteControl,
  serverSpaces,
})
```

`integrationModuleName`、`platformPorts` 与 `serverSpaces` 由 composition 提供；composition 不解释 LiveKit 地址或配置身份。业务调用方只使用本包 command/selector。

CBS 请求由本包内部生成 client 发起；它通过 TDC 的 `selectTerminalHttpContext` 和 `executeTerminalHttpCommand` 取得已认证请求能力。TDC 负责凭证与通用 HTTP 传输，不持有远控 API 目录；调用方也不得绕过本包 actor 直接访问该私有 API。transport 只承载网络请求，不解释远控业务。

模块安装时注册 actor dispose、state 订阅和 port-event 订阅的释放函数；结束、环境失效或 port 失败由 actor 使用同一 session 更新会话状态并执行现有 port 清理。扩展远控行为时，更新本包 command/selector、owner 测试及对应生成源，不在 integration 或 transport 复制业务规则。

当前 DEV 联调使用裸 HTTP/WS 与直接 UDP 媒体；本包和 adapter 接受 server-config 当前配置，不把 HTTP/WS 固定为正式环境唯一允许的 scheme。

## 在这个包上迭代时

修改 DataChannel 消息时先改 `contracts/protocol/terminal-remote-control-protocol.json`，再运行对应生成器；不得手改 generated 文件。新增远控业务仍经本包 command 和 actor，由本包 selector 读结果；只在协议或 owner HTTP policy 需要变化时更新相应 canonical 输入、生成输出及本包测试。资源变更须继续由模块注册可释放的订阅/actor资源，不把业务准入搬进 adapter、transport 或 integration。

```sh
yarn workspace @catering-v2s/kernel-base-remote-control typecheck
yarn workspace @catering-v2s/kernel-base-remote-control test
yarn workspace @catering-v2s/kernel-base-remote-control lint
```
