# `@catering-v2s/adapter-android-device`

本包把 Android 的只读设备观测接到 `DevicePort`。本批只实现
`getDisplayInfo`：Kotlin 在调用时从 application context 读取 `DisplayManager.getDisplays()`，
同步生成可序列化的 typed result；JS binding 只映射结果，不缓存屏数、不轮询、不重试、
不把 `Display` 对象泄漏到 kernel。

其余五个 `DevicePort` 能力复用 `platform-ports` 的 typed unavailable 实现。这样本包的
真实能力集合是精确的，未实现的设备能力不会被假成功或裸异常掩盖。native bridge 异常
转换为 `DEVICE_DISPLAY_INFO_BRIDGE_FAILED`，不把原始异常文本送入业务日志。

`malformed` 是 `display-context` 对 `DevicePort` 成功值的边界分类。真实 Android 的
`displays.size` 是有效整数，因此 malformed 由 focused test 的替身 `DevicePort` 构造；
这不冒充真实设备路径已覆盖坏 payload。

结构：

- `src/androidDevice.ts`：lazy native binding 与完整 `DevicePort` 组合；
- `android/.../TerminalDeviceModule.kt`：Expo `AsyncFunction` 与 `DisplayManager`；
- `test/androidDevice.test.ts`：成功、桥失败及五个 unavailable 能力的 typed proof。

迭代指引：新增设备能力前先在 `platform-ports` 定义端口语义，再由 Android adapter
实现对应能力并为 unavailable、失败、malformed（若适用）补 focused proof；不要在本包
缓存设备事实或创建与 kernel 不同的端口契约。
