# `kernel.feature.sample-wallpaper`

## 定位

这是 sample2 壁纸终端的四层演示 owner。它拥有本地已确认的 `wallpaperId`、可恢复的未确认
`pendingWallpaperId`，以及仅供双机 LMS 展示的 `hostConfirmedWallpaperId` 主机投影。
它不是 UI、图片资产、surface、display 或平台适配包。

## 作用

本包的运行时不读取 React、图片文件、surface、display、workspace 或平台端口，也不保存图片
bytes 或路径。`src/dependencies.ts` 对平台端口的 import 仅用于骨架图的
`devDependencyModuleNames` 声明，不进入 `dependencyModuleNames`，也不被运行时 module 使用。
UI 通过 selector 读取对应承载实例的确认值决定背景，通过自己的 actor 在确认前把用户操作转成 kernel 命令。

## 结构

- `src/features/slices/`：本地确认/待确认字段使用既有 owner-only field persistence；拓扑只同步主机确认值，SLAVE apply 保留本地确认和pending；
- `src/features/commands/`：公开选择与确认命令；
- `src/features/actors/`：闭合集合校验、pending 保护与 reducer action 派发；
- `src/selectors/`：读取本机确认、本机pending与当前主机确认投影；
- `src/application/`：声明 owner module；
- `terminal-invariants.json`：公共导出与测试 owner 的同步清单。

## 用法

业务 UI 使用 `selectWallpaperCommand` 先写入 pending，用户点击确认时再派发
`confirmWallpaperCommand`。无 pending 或 pending 已等于 confirmed 时，确认命令返回具名
`ERR_TER_SAMPLE_WALLPAPER_CONFIRM_WITHOUT_PENDING`，不会写 state 或派发子命令。

`WallpaperId` 是封闭集合 `none | w1 | w2 | w3`。非法外部 payload 在 owner 边界返回
`ERR_TER_SAMPLE_WALLPAPER_INVALID_ID`，不得以未分类异常替代。

单机 LMS 从 MASTER 同一 runtime 读取 `wallpaperId`；双机 LMS 从 SLAVE 当前peer同步得到的
`hostConfirmedWallpaperId` 读取主机背景。LSP 始终读取自己的 `wallpaperId`。主机投影不写入
SLAVE 的 `wallpaperId`，也不覆盖本机 `pendingWallpaperId`；主机确认投影未到时 selector 返回
`null`，不能伪装成目录默认项。

```ts
import {
  confirmWallpaperCommand,
  selectWallpaperCommand,
} from '@catering-v2s/kernel-feature-sample-wallpaper'

await runtime.dispatchCommand(selectWallpaperCommand, {wallpaperId: 'w2'})
await runtime.dispatchCommand(confirmWallpaperCommand, {})
```

## 在这个包上迭代时

新增字段或命令前先重开需求与详设，确认它仍是 kernel 事实而不是 UI 资产或布局知识；同步
`src/index.ts`、invariant、测试与本 README。不要在这里添加图片资产、React 组件或第二份
选择状态。
