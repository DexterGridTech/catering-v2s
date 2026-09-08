# `@catering-v2s/ui-integration-sample-console`

## 定位

本包是 TER sample 的唯一组装入口，同时提供一个只用于开发验证的 Expo Web 工程入口。
库侧负责把真实的 runtime、ui-state、两张 catalog、四个 sample feature 和只读 render 接缝
装配到同一个 `SampleAssembly`；通用的开发宿主、Web 端口、surface canvas 与启动日志由
`@catering-v2s/ui-base-dev-host` 提供。

本包不拥有业务事实、业务命令或具体 renderer，不感知 `surfaceMode`，也不构造 platform port。
`sample-console` 内的三个 base module descriptor 是当前 base 包尚未提供正本工厂时的单一过渡位置。

## 结构

- `src/assembly/assembly.tsx`：唯一的 `createSampleAssembly` 组装入口，以及按物理屏序创建 surface 的
  `createSurfaceForDisplayIndex` 入口；一次性闭包持有 runtime 与 catalog。
- `src/application/baseModuleDescriptors.ts`：contracts、platform-ports、state 的一次性 descriptor 集合。
- `src/application/terminalSurfaces.ts`：读取本包 `package.json` 的固定逻辑 surface 配置并导出 typed 常量。
- `theme/`：本应用的 NativeWind/Tailwind 语义色 token；主题属于 integration app，不抽到共享包。
- `test-expo/App.tsx`：把本包的 assembly、surface 配置与运行时状态 reader 注入通用宿主的薄入口。
- `test/`：Vitest focused test，包含 `.ts` 与 `.tsx`，跨包组装走真实调用链。

## 公共面

- `moduleName`、`dependencyModuleNames`、`devDependencyModuleNames`：包图元数据。
- `createSampleAssembly`、`SampleAssembly`：唯一的真实组装入口及其返回契约。
- `createSurfaceForDisplayIndex`：接收一个既有 `SampleAssembly` 与 `0 | 1` 的物理屏序，
  从该 assembly 的 runtime 读取 display role 与 instance mode，统一调用
  `display-context.resolveSurfaceDisplayMode` 后再委托给该 assembly 的 `createSurface`。
- `terminalSurfaces`：由本包 `package.json` 读取并校验后的固定逻辑 surface 配置。

## 用法

库消费者只通过 `createSampleAssembly({platformPorts, persistenceKey?})` 取得已启动的
`SampleAssembly`。按物理屏挂载时使用
`createSurfaceForDisplayIndex(assembly, displayIndex)`；该入口保证 displayMode 的推导回到
`display-context` owner，不在 assembly consumer 内复制 `PRIMARY`/`SECONDARY` 映射。底层
`assembly.createSurface(displayMode)` 仍是通用宿主按已确定模式挂载 surface 的闭包入口。
`persistenceKey` 仅用于测试隔离；生产端口由 assembly 的消费者注入。

主题 token 由 `theme/global.css` 声明、由 `tailwind.config.cjs` 映射为语义 class；
`ui/base/primitives` 只消费这些语义 class，不反向 import 应用主题。新增应用时复制自己的
`theme/`，不要建立共享 theme 包或 `ui/theme` 层。

Expo Web 的入口是根 `index.js`，它注册 `test-expo/App`；通用宿主读取传入的 `terminalSurfaces`，
不在第二处解析 `package.json`。surface 保持声明的固定逻辑尺寸；承载层负责把画布映射到
实际 content rect，业务部件仍只使用 primitives 的相对布局。Web dev-host 的具体缩放
policy 当前待 Dexter 裁决，本文不把 `scaleToFit` 或任何 contain/stretch 方式写成有效契约。
Native 不读取这份 Web 预览配置。

## 迭代指引

先在真实 feature 旅途中看见重复，再判断是否下沉到已有 base toolkit；不要预先为假设的
业务形态扩展本包。任何需要 adapter、Android 双屏承载、浏览器自动化或 automation backend
的变化，必须进入对应的后续 CP 与授权边界，不在此处用开发外壳绕过。
