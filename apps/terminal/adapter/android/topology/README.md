# `@catering-v2s/adapter-android-topology`

本包把 `TopologyHostPort` 与 `TopologyPeerChannel` 接到 Android 原生 socket host 和配对 WebSocket channel。拓扑状态、角色和配对命令由 topology owner 持有，本包只提供端口实现。

这是 adapter toolkit，直接依赖 `kernel-base-platform-ports`，由 `application/base/android` 装配；它不是 topology 业务 owner。

## 结构

- `src/implementations/nativeTopology.ts`：映射 Expo 原生结果、host 操作及 peer channel 生命周期。
- `android/.../TerminalTopologyHostModule.kt`：向 JS 发布 host connection/frame 事件。
- `android/.../TerminalTopologyHostRegistry.kt` 与 `TerminalTopologyServer.kt`：拥有本机 host/server 与 peer socket 生命周期。
- `expo-module.config.json`：登记 `TerminalTopologyHost` 模块。
- `android/src/test/`：验证 server、关闭行为及锁顺序。

App composition 创建两个端口并注入 platform ports/runtime；本包不保存配对业务事实，不持有终端凭证，不依赖其他 adapter。

## 用法

Android application 在 platform binding 中创建 host 与 peer 实现，再分别注入 topology host port 和 topology peer channel：

```ts
const topologyHost = createAndroidTopologyHostPort(() => platformLogger)
const topologyPeerChannel = createAndroidTopologyPeerChannel()
```

这两项对应本包 `src/index.ts` 的公开工厂；配对状态和 command 仍由 `kernel-base-topology` 持有。

## 在这个包上迭代时

保持 TS port 与 `TerminalTopologyHost` 原生 bridge 对应，不把角色、配对状态或凭证移入 adapter。修改后运行 `yarn workspace @catering-v2s/adapter-android-topology typecheck`、`test`、`lint`；原生生命周期变更还须使用受管 Android module runner 验证本包 alias 与 cleanup。
