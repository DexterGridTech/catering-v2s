# `@catering-v2s/ui-integration-sample-wallpaper-console`

## 定位与职责

本包是 TER sample2 壁纸终端的 integration owner：把既有店员会话、店员认证、壁纸选择器和
本包的主/副屏占位 part 组装为一个 runtime、一个 state store、一个 `UiCatalog` 和一个
`RenderProvider`。它只负责 placement、surface 创建、画布声明和应用主题。

本包不拥有壁纸状态、图片 registry、通用 primitives、第二套背景层、第二套 catalog 或
第二条打开路径；壁纸状态由 `kernel.feature.sample-wallpaper` 拥有，图片与 picker 由
`ui.feature.sample-wallpaper-picker` 拥有，surface host 与 Android 形态由 adapter/assembly
拥有。未来依赖它的 Android assembly 是 `assembly.android.sample-wallpaper-terminal`。

## 结构与公共面

- `src/assembly/assembly.tsx`：`createSampleWallpaperConsoleAssembly` 与
  `createSurfaceForDisplayIndex`，创建单一 runtime/store/catalog，并在两个 laptop surface
  都放置同一个 `WallpaperBackground`。
- `src/application/terminalSurfaces.ts`：从本包 `package.json` 读取并校验逻辑画布；laptop 为
  `1280×800` / `960×540`，mobile 只有 `PRIMARY 360×640`。
- `src/features/actors/actors.ts`：唯一 placement owner。登录或恢复认证时显示主屏 picker、
  副屏 welcome；匿名或登出时显示副屏 waiting（副屏不可用时不派发）。
- `src/parts/parts.ts` 与 `src/components/`：副屏 waiting/welcome 两个透明 section part。
- `theme/`：本应用的 19 个语义 token；action 使用红色，error 仍是错误语义。
- `app.json` 与 `assets/favicon.png`：仅供本包 Expo Web 预览消费的浏览器标题图标配置；不声明
  App application icon，也不改变 App 内 UI 图标。
- `test-expo/App.tsx`：仅把本包 assembly 接入通用 TER dev-host；不是生产 runtime 的第二入口。

公共导出包括 `createSampleWallpaperConsoleAssembly`、`createSurfaceForDisplayIndex`、
`WallpaperConsoleAssembly`、`createSampleWallpaperConsoleModule`、`parts`、
`waitingPart`、`welcomePart`、`terminalSurfaces` 及 module/dependency 元数据。具体导出集合
由 `terminal-invariants.json` 与 `test/publicSurface.test.ts` 共同锁定。

## 用法

```ts
const assembly = await createSampleWallpaperConsoleAssembly({
  platformPorts,
  surfaceForm: 'laptop',
})
const primary = createSurfaceForDisplayIndex(assembly, 0)
const secondary = createSurfaceForDisplayIndex(assembly, 1)
```

调用方可通过可选的 `terminalSurfaces` 整份覆盖本包默认配置；未传入时使用本包 `package.json`，而具体形态仍由本包按 `surfaceForm` 选择。

`displayIndex` 只选择物理 host source；`displayMode` 由 display-context 统一推导并决定画布
与 catalog placement。mobile 只创建主屏，不调用副屏入口。Web 预览由 dev-host 通过 URL
选择 `laptop` 或 `mobile`，选择后重启 surface；这与后台 DEV 无关，也不把 Web 形态冒充 Android
形态。宽度滑块只改变 dev-host 的预览比例，不改变逻辑画布尺寸。

## 失败、加载与恢复边界

- host snapshot 未就绪时沿用 render 的 loading 语义，children 不应抢先渲染；host identity
  不匹配记录脱敏诊断并拒绝该 host。
- runtime 启动前只解析一次设备标识；platform port 的失败由既有 typed port 结果处理，
  本包不伪造设备事实。
- 未确认的选择只改变 picker 的 pending 显示，背景只读 confirmed；确认后两屏从同一个
  selector 读取新壁纸。
- `none` 不渲染图片；未知资产不会被伪造为可渲染 source。state/ui-state 的旧存档、浮层
  恢复与未知 part 丢弃遵循对应 owner 的契约。
- mobile 没有 SECONDARY；副屏 waiting/welcome 只对 laptop 的 SECONDARY catalog 可用。

## 迭代指引

添加壁纸时，先在 picker 的 `WallpaperId`、静态 `assetsById`、资产类型声明、直接 import
oracle、label/testID 和 focused/red test 中同步；不要在本包再建图片表。添加 section 时，
在本包用 `definePart` 注册一个唯一 `partKey`，由 placement actor 通过同一个 `UiCatalog`
选择；不要建立第二个 section registry。

Android 形态迭代应在 `adapter/android/dual-screen` 的形态判定与 launch option 契约中完成，
再由 assembly 显式传入 `surfaceForm`；不要在本包按屏幕宽度自行判定。任何新 UI 应继续使用
primitives、既有 LayerStack/Input 管线和 command/actor 写路径，不得直接调用 state setter、
新增背景 stack、图片 seam、overlay 或隐藏的第二打开路径。
