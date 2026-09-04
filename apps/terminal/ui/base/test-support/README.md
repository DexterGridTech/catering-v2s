# `@catering-v2s/ui-base-test-support`

## 定位

本包是 TER UI integration 的 Expo Web 开发测试宿主。它只提供业务无关的宿主能力：
Web 端口、真实 Web Storage、可切换单屏／双屏的 surface canvas、运行时状态摘要、启动日志
与切换按钮。它不创建业务 runtime，不拥有 catalog，不读取业务 state，也不导入任何具体
integration 或 feature 包。

业务包通过一次 `createTestExpoApp` 配置注入 assembly、固定的 `terminalSurfaces` 与运行时状态
读取器；宿主随后用同一个 assembly 创建一棵或两棵 surface。这样每个 `ui/integration` 包只需
保留自己的 Expo 入口适配层，宿主框架可以复用而不会把业务词汇下沉到 base。

## 公共面

- `createTestExpoApp`：创建可复用的 Expo Web 开发宿主。
- `createWebPlatformPorts`、`createWebDevicePort`：按宿主的 `surfaceMode` 提供 Web 端口与
  1／2 屏设备读数。
- `createWebStateStoragePort`：在真实 Web Storage 上提供带 namespace 的 `StateStoragePort`。
- `SurfaceMode`、`TerminalSurfaces` 与 `TestExpo*` 类型：约束宿主配置、assembly 与状态接缝。
- `moduleName`、`dependencyModuleNames`、`devDependencyModuleNames`：TER 包图元数据。

## 用法

```tsx
import {createTestExpoApp} from '@catering-v2s/ui-base-test-support'
import {createSampleAssembly, terminalSurfaces} from '../src'

export default createTestExpoApp({
  appName: 'sample-console',
  title: '真实业务画布',
  terminalSurfaces,
  createAssembly: createSampleAssembly,
  getRuntimeStatus: assembly => assembly.runtime.status,
})
```

注入的 `createAssembly` 必须返回带 `createSurface(displayMode)` 的一次性 assembly；宿主不会
要求调用方传入 store，也不会把 store、dispatch 或完整 runtime 暴露给业务 UI。宿主的 Web
Storage namespace 由 `appName` 隔离，`surfaceMode` 只存在于宿主内部，切换时复用原 assembly。

## 结构与限制

- `src/testExpoApp.tsx`：通用宿主、状态摘要、canvas、单／双屏切换与样式。
- `src/webPlatform.ts`：Web `DevicePort` 与十项 `PlatformPorts` 绑定。
- `src/webStorage.ts`：真实 `Storage` 的 `StateStoragePort` 适配。

本轮使用裸 React Native 控件，不引入 NativeWind、React Native Reusables 或 automation
backend；automation 的可寻址挂点仍由宿主控件路径保留，未来接入 backend 时业务组件无需改写。
不要把具体业务 part、业务变量、命令或屏幕语义加入本包。出现业务重复时，先在真实 feature
中看见重复，再判断是否能下沉为不含业务词汇的 base 能力。

## 迭代指引

新增 integration 只应增加自己的薄入口与配置，并用 focused test 验证其真实 assembly 接线。
若变更宿主行为，必须同步本包公共面、`terminal-invariants.json` 与本 README；若需要真实
浏览器自动化、NativeWind、RNR 或 Android 双屏承载，应进入对应 CP 与独立授权边界，不在此
包中偷偷扩大范围。
