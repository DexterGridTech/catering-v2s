# TER 自动化代理

## 定位

`@catering-v2s/ui-base-automation-agent` 是 TER 的工具包（`moduleKind = 'toolkit'`），为显式启用自动化的 application build 提供受约束的 WebSocket 会话、Runtime selector/command 观察和 UI 节点控制接缝。它不拥有业务 slice，不保存业务状态，不提供任意代码执行或完整 Runtime 状态导出。

本包位于 `apps/terminal/ui/base`，依赖 `kernel/base` 与 `ui/base` 能力；sample application 按构建配置选择是否安装。`tools/terminal-automation` 是仓内 driver，消费本包的固定协议与受控入口。

## 作用边界

- 自动化连接、固定 wire schema、Runtime 请求路由与节点注册/操作属于本包。
- selector 与 command 必须通过 Runtime 已公开的 selector、command 通道；不得增加业务旁路、任意 selector/state dump、eval 或脚本执行入口。
- 业务 Journey、夹具、场景断言和受管进程生命周期属于 `tools/terminal-automation`，不是本包职责。
- 未经受管构建配置启用时不建立自动化连接；远端连接使用 `wss`，仅 loopback 可使用 `ws`，token 不进入 URL、日志或错误正文。

## 目录结构

```text
src/
  application/   Runtime module 装配与协议请求处理
  foundations/
    protocol/    固定 v1 envelope、消息体 schema 与配置解析
    registry/    UI 节点、布局测量和实际交互事件登记
  dependencies.ts  本模块的 Runtime 依赖声明
  index.ts         本包唯一公开入口
  moduleName.ts    moduleName 与 moduleKind
test/              协议、module 和节点 registry focused tests
```

## 用法

通过本包公开入口创建 Runtime module；应用装配负责传入其受管 build 配置：

```ts
import {createAutomationAgentModule} from '@catering-v2s/ui-base-automation-agent';
import {createAutomationNodeRegistry} from '@catering-v2s/ui-base-automation-agent';

const automationAgent = createAutomationAgentModule({
  appName: 'sample-console',
  buildVersion: 'managed-build',
  config: {enabled: true, url: 'ws://127.0.0.1:4321/automation', sessionToken: managedToken},
  deviceIdentity: {available: true, deviceId: managedDeviceId},
  nodeRegistry: createAutomationNodeRegistry(),
});
```

driver 只可发送已定义的 Runtime 请求，例如 `selector.read`、`selector.subscribe`、`command.dispatch` 和受控 `controls.*`；协议体由本包与 driver 共用的 schema 验证。

## 在这个包上迭代时

新增消息必须同时更新 `foundations/protocol` 的严格 schema、driver 共用解析和反例测试；新增 Runtime 行为须沿现有 Runtime selector/command API 实现，不得增加业务 slice 或平台端口。新增导出时同步 `terminal-invariants.json` 的 `publicExports`。改动后运行本包 tests、typecheck、lint，并按受影响的完整 CP 做静态对账；只在受管 runner 明确选择对应 suite 时才启动 Expo 或 Android，不从普通 package test 隐式启动环境。
