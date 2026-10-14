# `@catering-v2s/adapter-android-update`

本包是 TER 的 Android `UpdatePort` 适配器，属于 adapter，不拥有更新任务、版本规则或业务状态。它依赖 `@catering-v2s/kernel-base-platform-ports` 定义的端口契约，由 composition 创建并注入；terminal-update owner 决定何时读取设备事实、下载工件和执行更新。

## 定位与职责

- 只有把 `UpdatePort` 能力翻译为 Android 原生更新模块调用、并把原生结果转换为 typed `PortResult` 的代码才属于本包。
- 更新候选、任务固定、N/M 调度、持久化和报告归属 terminal-update；当前网络地址与代理由 composition 提供，本包不读取 server-config 的 state 或持久层。
- Expo 模块实现 Android 原生安装、工件准备、启动确认及前后台呈现观察；业务规则不放入 Kotlin adapter。

依赖方向为 `terminal-update → UpdatePort ← adapter-android-update`，应用装配层创建端口并将其交给 owner。该包没有被 TER feature 直接依赖的业务 API。

## 结构

- `src/index.ts`：只重导出包元数据、`createAndroidAppControlPort` 与 `createAndroidUpdatePort`。
- `src/implementations/androidUpdatePort.ts`：连接 React Native 生命周期观察、UpdatePort 与 Expo 原生模块。
- `src/implementations/androidAppControl.ts`：连接既有 Android AppControl 能力。
- `src/dependencies.ts`：声明端口契约依赖。
- `android/`：实现原生下载、摘要校验、安装、启动确认和受控资源释放。
- `test/`：验证公开端口映射、参数传递及失败结果。
- `expo-module.config.json`：登记 Expo Android module。

## 用法

Composition 从本包创建实际端口，再按本包导出的公开符号将其注入更新模块：

```ts
import {createAndroidUpdatePort} from '@catering-v2s/adapter-android-update';

const updatePort = createAndroidUpdatePort();
```

本包 public entry 是 `.` → `./src/index.ts`；调用者使用根导出，不导入 `src/` 深路径。
包根公开面与 `terminal-invariants.json.publicExports` 一致：`moduleName`、
`dependencyModuleNames`、`devDependencyModuleNames`、
`createAndroidAppControlPort` 与 `createAndroidUpdatePort`；原生 binding 和端口实现留在
`src/implementations/`。

## 在这个包上迭代时

1. 先核对 `UpdatePort` 与 `UpdateFacts` 等类型，业务语义只能由 platform-ports/terminal-update owner 定义。
2. 核对 `expo-module.config.json`、Kotlin 原生模块名与 JS binding 一致，并为新增端口能力补充 typed 成功/失败映射测试。
3. 运行 `yarn workspace @catering-v2s/adapter-android-update typecheck` 和 `yarn workspace @catering-v2s/adapter-android-update test`；涉及原生编译时按批准的受管 Android 流程验证。
4. 下载 URL 必须来自 composition 提供的当前地址；不得在本包读取 server-config、保存业务任务或记录敏感凭证。
