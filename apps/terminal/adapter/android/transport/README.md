# `@catering-v2s/adapter-android-transport`

本包把 `TransportNetworkAdapter` 转为 Android HTTP 与 WebSocket 通信。业务协议、连接选择和重试由 transport owner 决定；本包只执行传入的地址、代理与超时配置。

这是 adapter toolkit，直接依赖 `kernel-base-platform-ports`，由 `application/base/android` 创建并注入；它不被业务 feature 直接调用。

## 结构

- `src/implementations/androidTransportNetworkAdapter.ts`：适配 Android 原生网络模块并映射网络结果。
- `android/.../TerminalNetworkModule.kt`：执行 OkHttp 请求与 socket 生命周期。
- `expo-module.config.json`：登记 `TerminalNetwork` 原生模块。
- `test/` 与 Kotlin tests：验证 bridge 输入、失败映射和请求 body 行为。

App composition 创建本包 adapter 并交给通用 transport；本包不读取 server-config，不保存业务状态，也不解析 TDS 消息。

## 用法

Android application 把 composition 已选出的 snapshot reader 交给 adapter factory，再由既有 transport 注入：

```ts
const transportNetworkAdapterFactory = readSnapshot => createAndroidTransportNetworkAdapter(readSnapshot)
```

这是 `application/base/android/src/implementations/androidPlatformBinding.ts` 使用本包公开工厂的实际形态；adapter 不自行选择服务地址或代理。

## 在这个包上迭代时

新增网络能力时保持配置从 composition 传入，并同步 public export、Expo module 登记与实际消费者测试；不在 adapter 添加业务 URL 或协议解析。修改后运行 `yarn workspace @catering-v2s/adapter-android-transport typecheck`、`test`、`lint`；原生 bridge 行为通过受管 Android module runner 与批准设备场景验证。
