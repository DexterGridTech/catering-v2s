# `@catering-v2s/adapter-android-remote`

本包把 `RemoteControlPort` 转为 Android 自有 Window 的 LiveKit 视频轨道和触摸事件。本包是 adapter，不持有远程控制会话业务状态、终端凭证、服务地址配置或授权决策；调用者由 application composition 创建端口并注入 platform ports。

## 定位与职责

- `RemoteControlPort` 的接口、会话准入和对外状态由 `kernel/base/platform-ports` 与 `kernel/base/remote-control` 定义。
- LiveKit Room、track 发布、Window capture 与 Android 触摸派发属于本包。
- LiveKit 地址由 composition 从 `server-config` 读取后通过 `RemoteControlSessionInput.signalUrl` 传入；adapter 原样交给 SDK，不自行限制协议。本轮开发配置使用裸 `ws://`；正式配置按 `server-config` 支持的 `ws://`、`wss://`、`http://`、`https://` 使用，后两种的信令地址归一由当前 LiveKit SDK 处理。CBS token 只作为当前会话输入传入，不写入持久化或日志。
- 运营权限、目标终端选择、TDC 凭证和业务 command 不属于本包。

依赖方向为 `remote-control owner → RemoteControlPort ← Android adapter`。application composition 装配真实 Android 实现；Web 与不支持的运行环境使用各自的 unavailable port。

## 结构

```text
src/
├── createAndroidRemoteControlPort.ts  # LiveKit Room、屏幕轨道、输入和端口描述
├── dependencies.ts                    # TER 包依赖声明
├── index.ts                           # 公开导出
└── moduleName.ts                      # 机器可读包标识
android/
└── build.gradle                       # Android 原生模块构建依赖
expo-module.config.json                # Expo 原生模块登记
test/
└── remoteControlPort.test.ts           # 端口能力描述与配置地址原样传递
```

## 用法

```ts
import {createAndroidRemoteControlPort} from '@catering-v2s/adapter-android-remote';

const remoteControl = createAndroidRemoteControlPort({getLogger: () => platformPorts.logger});
```

composition 将 `remoteControl` 绑定到 `createPlatformPorts`。不要直接在 feature 或 integration 中创建本 adapter。

## 在这个包上迭代时

1. 先核对 `kernel/base/platform-ports/src/types/remoteControl.ts` 与 Android 原生模块的能力边界。
2. LiveKit 相关 API 必须按仓内实际解析版本及官方对应版本核实；本地能力变化需同步端口描述与 focused 测试。
3. 不在日志中写入 token 或原始 payload；仅记录会话标识、阶段和脱敏结果。
4. 运行 `yarn workspace @catering-v2s/adapter-android-remote typecheck` 与 `yarn workspace @catering-v2s/adapter-android-remote test`；真实 Window、媒体和触摸行为仍须通过获批的 Android 设备验证。
