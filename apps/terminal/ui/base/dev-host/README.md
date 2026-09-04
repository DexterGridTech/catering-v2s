# `@catering-v2s/ui-base-dev-host`

## 定位

本包是 TER UI integration 在 Expo Web 开发期使用的业务无关宿主。它负责把集成层注入的
assembly、运行时状态读取器与 Web 平台端口接到一个可切换单屏／双屏的宿主页面；它不拥有
业务 runtime、catalog、业务 state、业务命令或具体 part。`ui.base.test-support` 只保留包图
元数据骨架，不再承载宿主实现。

## 作用

- `createTestExpoApp`：创建可复用的 Expo Web 宿主，使用同一 assembly 生成一棵或两棵 surface。
- `createWebPlatformPorts`、`createWebDevicePort`：提供 Web 开发期的 DevicePort 与其余端口绑定。
- `createWebStateStoragePort`：在真实 Web Storage 上提供隔离 namespace 的 StateStoragePort。
- 宿主内部保留 `surfaceMode`，切换只控制 SECONDARY surface 的挂载，不重建 runtime 或 PRIMARY。

## 公共面与结构

公共面只包含宿主工厂、平台适配工厂、宿主配置类型和 TER 模块图元数据。`src/testExpoApp.tsx`
持有宿主生命周期、状态摘要、surface canvas 与切换；`src/webPlatform.ts` 绑定 Web 端口；
`src/webStorage.ts` 负责真实 Web Storage 的 namespace 与失败诊断；`test/` 由本包拥有宿主自身
的 focused tests。

宿主只通过 `TestExpoAssembly.createSurface(displayMode)` 接收业务 surface，调用方不传入 store，
本包也不向业务 UI 暴露 store、dispatch 或完整 runtime。surface 使用 `terminalSurfaces` 声明的
固定逻辑尺寸；外层可用 flex 排布，不能让 surface 本身跟随视口伸缩。

## 用法

```tsx
import {createTestExpoApp} from '@catering-v2s/ui-base-dev-host'
import {createSampleAssembly, terminalSurfaces} from '../src'

export default createTestExpoApp({
  appName: 'sample-console',
  title: '真实业务画布',
  terminalSurfaces,
  createAssembly: createSampleAssembly,
  getRuntimeStatus: assembly => assembly.runtime.status,
})
```

集成包只注入自己的 assembly 与配置。宿主的 Web Storage 使用真实 `localStorage`，普通状态使用
`persistKv` namespace；`persistSecure` 在 Web 开发环境保持 unavailable，不把明文 Web Storage
冒充安全存储。automation backend 尚未接入，但宿主的可寻址挂点保留为必经路径，未来接入时
业务包无需改写。

## 迭代指引

新增宿主行为必须同步公共面、`terminal-invariants.json`、测试与本 README。新增 integration
只应增加自己的薄入口与 assembly 配置；不要把业务 part、变量、命令、屏幕判断或布局尺寸
下沉到本包。需要 NativeWind、React Native Reusables、automation backend、真实浏览器自动化
或 Android 双屏承载时，必须进入对应的独立授权范围。
