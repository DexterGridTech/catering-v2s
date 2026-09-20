# `@catering-v2s/ui-integration-sample-console`

## 定位

本包是 TER sample 的唯一组装入口，同时提供一个只用于开发验证的 Expo Web 工程入口。
库侧负责把真实的 runtime、ui-state、两张 catalog、四个 sample feature 和只读 render 接缝
装配到同一个 `SampleAssembly`；通用的开发宿主、Web 端口、surface canvas 与启动日志由
`@catering-v2s/ui-base-dev-host` 提供。

本包不拥有业务事实或具体 renderer，不感知 `surfaceMode`，也不构造 platform port。
它拥有自己的可移除 integration runtime module，并通过 `ui.base.console-assembly` 接入启动
诊断写入；base module descriptor 不再由本包私藏或伪造。

## 结构

- `src/assembly/assembly.tsx`：唯一的 `createSampleAssembly` 组装入口，以及按物理屏序创建 surface 的
  `createSurfaceForDisplayIndex` 入口；一次性闭包持有 runtime 与 catalog。
- `src/application/module.ts`：sample-console 自己拥有的可移除运行期模块声明。
- `src/application/terminalSurfaces.ts`：读取本包 `package.json` 的固定逻辑 surface 配置并导出 typed 常量。
- `theme/`：本应用的 NativeWind/Tailwind 语义色 token；主题属于 integration app，不抽到共享包。
- `app.json` 与 `assets/favicon.png`：仅供本包 Expo Web 预览消费的浏览器标题图标配置；不声明
  App application icon，也不改变 App 内 UI 图标。
- `test-expo/App.tsx`：把本包的 assembly、surface 配置与运行时状态 reader 注入通用宿主的薄入口。
- `test/`：Vitest focused test，包含 `.ts` 与 `.tsx`，跨包组装走真实调用链。

## 公共面

- `moduleName`、`moduleKind`、`dependencyModuleNames`、`devDependencyModuleNames`：包图元数据；
  `createSampleConsoleModule` 是该 integration 的运行期模块工厂。
- `createSampleAssembly`、`SampleAssembly`：唯一的真实组装入口及其返回契约；
  `createSampleDefinedParts` 是测试/装配对账使用的定义部件工厂，不能替代 assembly 入口。
- `createSurfaceForDisplayIndex`：接收一个既有 `SampleAssembly` 与 `0 | 1` 的物理屏序，
  从该 assembly 的 runtime 读取 display role 与 instance mode，统一调用
  `display-context.resolveSurfaceDisplayMode` 后再委托给该 assembly 的 `createSurface`。
- `terminalSurfaces`：由本包 `package.json` 读取并校验后的固定逻辑 surface 配置；
  `PortraitSurfaceDeclarations`、`SurfaceCreationInput`、`SurfaceDeclarations`、`SurfaceForm`、
  `SurfaceOrientation`、`SurfaceSize`、`TerminalSurfaces` 是其 typed 契约。

## 用法

库消费者只通过 `createSampleAssembly({platformPorts, surfaceForm, persistenceKey?})` 取得已启动的
`SampleAssembly`。按物理屏挂载时使用
`createSurfaceForDisplayIndex(assembly, displayIndex)`；该入口保证 displayMode 的推导回到
`display-context` owner，不在 assembly consumer 内复制 `PRIMARY`/`SECONDARY` 映射。底层
`assembly.createSurface({displayIndex, displayMode, surfaceForm})` 仍是通用宿主按已确定模式挂载
surface 的闭包入口。
`persistenceKey` 仅用于测试隔离；生产端口由 assembly 的消费者注入。
调用方可通过可选的 `terminalSurfaces` 整份覆盖本包默认配置；未传入时使用本包 `package.json`，而具体形态仍由本包按 `surfaceForm` 选择。
本包 `package.json` 的 `showAdminPassword` 控制 admin 登录提示旁是否显示当前动态口令；调用方显式传入的值优先。
本 integration 注入的 `moduleName` 是 topology 配对身份的一部分；只允许相同 integration 的另一节点配对，
不使用 assembly 包名替代它。跨机内容由主机写入 MAIN 后按声明的 sync 方向投影，副机不在 feature actor 中本地重放主机的副屏命令。

本包通过同一个 shared admin console assembly 接入 topology capability；其 SECONDARY/SLAVE allowlist
只有 `customer-welcome` 与 `customer-member`，其余 sample member parts 保持 PRIMARY/MASTER 约束，
不在 integration 侧复制 admin catalog。topology tab 在 mobile 仍恒显；不支持的操作通过禁用控件和可读原因表达，
不通过隐藏 tab 表达机型限制。

admin console 的 laptop/mobile 版式与导航语义由 `ui.base.admin-shell` 的 form-specific renderer 负责：laptop
使用 master-detail，mobile 使用可换行 tablist；内容标题通过 polite live region 宣布，焦点 scope 的关闭/恢复仍由既有 terminal layer 管线负责。

主题 token 由 `theme/global.css` 声明、由 `tailwind.config.cjs` 映射为语义 class；
`ui/base/primitives` 只消费这些语义 class，不反向 import 应用主题。新增应用时复制自己的
`theme/`，不要建立共享 theme 包或 `ui/theme` 层。

Expo Web 的入口是根 `index.js`，它注册 `test-expo/App`；通用宿主读取传入的 `terminalSurfaces`，
不在第二处解析 `package.json`。surface 保持声明的固定逻辑尺寸；承载层负责把画布映射到
实际 content rect，业务部件仍只使用 primitives 的相对布局。Web dev-host 提供 laptop/mobile
视角 radio group：选择后通过 `surfaceForm` URL 参数重新加载页面，`test-expo/App` 仍只向同一个
`createSampleAssembly` 显式传入一次选定形态；这不是第二套 assembly 或运行时热切换路径。
`surfaceMode` 仍只负责 laptop 下的单屏／双屏挂载，宿主以一个「屏幕模式」radio group 提供互斥选择。
Native 不读取这份 Web 预览配置。
同一宿主头部的 `surface 宽度` range 控件将预览画布设置为当前 content rect 的 30%–100%，
只改变 Web 预览缩放，不改变 `terminalSurfaces` 的逻辑尺寸或业务 assembly。
宽度 range、视角 radio 与屏幕模式 radio 在标题/状态摘要下方的独立居中控制行中显示。

直接打开 `http://localhost:8081/?surfaceForm=laptop` 或
`http://localhost:8081/?surfaceForm=mobile` 也可以选择预览视角；mobile 使用
`terminalSurfaces.orientations.portrait.PRIMARY`，不挂载 SECONDARY。该选择只属于 TER 的
Expo Web 开发宿主，与后台 DEV 环境无关。

## 迭代指引

先在真实 feature 旅途中看见重复，再判断是否下沉到已有 base toolkit；不要预先为假设的
业务形态扩展本包。任何需要 adapter、Android 双屏承载、浏览器自动化或 automation backend
的变化，必须进入对应的后续 CP 与授权边界，不在此处用开发外壳绕过。

虚拟键盘的中性色与 focus token 也由本 integration 提供；shared primitives 只消费同名 `keyboard-*` 语义 token，因此本应用可以保持自己的 focus 色而不把应用色下沉到 base。
