# `@catering-v2s/ui-base-dev-host`

## 定位

本包是 TER UI integration 在 Expo Web 开发期使用的业务无关宿主。它负责把集成层注入的
assembly、运行时状态读取器与 Web 平台端口接到一个可切换 laptop／mobile 视角、单屏／双屏的宿主页面；标题与状态摘要位于上方，三个宿主控制组在其下方独立居中一行；它不拥有
业务 runtime、catalog、业务 state、业务命令或具体 part。测试类型直接由
`kernel.base.platform-ports` 提供，宿主包不承载测试支撑实现。

## 作用

- `createTestExpoApp`：创建可复用的 Expo Web 宿主，使用同一 assembly 生成一棵或两棵 surface。
- `createWebPlatformPorts`、`createWebDevicePort`：提供 Web 开发期的 DevicePort 与其余端口绑定。
- `createWebStateStoragePort`：在真实 Web Storage 上提供隔离 namespace 的 StateStoragePort。
- 宿主内部保留 `surfaceMode`，由 laptop-only 的单一 radio group 选择单屏或双屏；它只控制
  SECONDARY surface 的挂载，不重建 runtime 或 PRIMARY。
- 宿主在声明提供 portrait surface 时显示一个包含互斥 `laptop`／`mobile` 选项的视角 radio group。Web 选择会把
  `surfaceForm` 写入当前 URL 并重新加载页面，让下一次 assembly 从选定形态启动；这不是
  runtime 内的热切换，也不新增 surfaceForm setter。没有 portrait 声明时不显示 mobile 选择。

## 公共面与结构

公共面只包含宿主工厂、平台适配工厂、宿主配置类型和 TER 模块图元数据。`src/components/testExpoApp.tsx`
持有宿主生命周期、状态摘要、surface canvas 与切换；`src/implementations/webPlatform.ts` 绑定 Web 端口；
`src/implementations/webStorage.ts` 负责真实 Web Storage 的 namespace 与失败诊断；`test/` 由本包拥有宿主自身
的 focused tests。

宿主只通过 `TestExpoAssembly.createSurface({displayIndex, displayMode, surfaceForm})` 接收业务 surface，调用方不传入 store，
本包也不向业务 UI 暴露 store、dispatch 或完整 runtime。surface 使用 `terminalSurfaces` 声明的
固定逻辑尺寸；Web 宿主由自己的承载层决定如何把一棵或两棵固定画布呈现到 preview content
rect。Web 预览采用 `width-selective-preserve-ratio`：以 preview content rect 的宽度乘以当前
surface 宽度比例（30%–100%）再除以 logical stage 宽度作为唯一 uniform scale，比例保持；可视
高度不参与缩放，超高由宿主可滚动内容区承载。不得使用 uniform contain 或 browser 非等比 stretch。surface 本身不使用
flex/aspectRatio 偷换画布声明；input 仍在 surface 的逻辑坐标系内自行测量，宿主不会把缩放倍率
传回 input。Native 不读取这份 Web 预览配置。

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
`persistKv` namespace；默认 `persistSecure` 保持 unavailable，不把明文 Web Storage 冒充安全存储。
需要让依赖双后端的 preview runtime 在浏览器里完成 legacy probe 时，集成包可以显式传入
`webPlatformOptions.protectedStorage: createProcessMemoryStateStoragePort()`；这只是本页进程内的
非持久 protected seam，不提供安全性，也不会把 protected 数据写进 Web Storage。automation backend
尚未接入，但宿主的可寻址挂点保留为必经路径，未来接入时业务包无需改写。

### Web 视角切换

`createTestExpoApp` 的 `surfaceForm` 选项是没有 URL 选择时的默认值，仍要求集成层把形态显式
传给 `createAssembly`。当 `terminalSurfaces.orientations.portrait` 存在时，页面头部的「视角」
radio group 提供互斥的 `laptop` 与 `mobile` 选项：`laptop` 使用 landscape 的 PRIMARY／SECONDARY，
`mobile` 使用 portrait 的 PRIMARY-only 声明。切换后页面以 `?surfaceForm=laptop` 或
`?surfaceForm=mobile` 重启；因此 runtime、catalog 和 form slice 都只在一次 assembly 启动中
初始化，切换不会在旧 runtime 上叠加第二个 runtime。直接打开带该参数的 URL 也会选择对应视角；
不支持的值或未声明 portrait 时回到默认形态。

`surfaceMode` 是另一项独立控制：它只在 laptop 中显示为一个「屏幕模式」radio group，包含互斥的
「单屏模式」和「双屏模式」选项；选择只在当前 runtime 内挂载或卸载 SECONDARY，不会重启 assembly。
它与视角选择互不替代：视角仍通过 URL reload 选择 laptop/mobile，radio 只决定 laptop 是否挂载客显。
宽度 range、视角 radio 和屏幕模式 radio 共用标题下方的独立居中控制行，不与标题节点共用布局容器。

## 迭代指引

新增宿主行为必须同步公共面、`terminal-invariants.json`、测试与本 README。新增 integration
只应增加自己的薄入口与 assembly 配置；不要把业务 part、变量、命令、屏幕判断或布局尺寸
下沉到本包。需要 NativeWind、React Native Reusables、automation backend、真实浏览器自动化
或 Android 双屏承载时，必须进入对应的独立授权范围。
