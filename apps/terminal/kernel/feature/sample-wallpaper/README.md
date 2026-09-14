# `@catering-v2s/kernel-feature-sample-wallpaper`

这是 sample2 壁纸终端的四层演示 owner。它只拥有壁纸选择事实：已确认的
`wallpaperId`、可恢复的未确认 `pendingWallpaperId`、对应 slice、命令与 actor。

本包的运行时不读取 React、图片文件、surface、display、workspace 或平台端口，也不保存图片
bytes 或路径。`src/dependencies.ts` 对平台端口的 import 仅用于骨架图的
`devDependencyModuleNames` 声明，不进入 `dependencyModuleNames`，也不被运行时 module 使用。
UI 通过 selector 读取已确认值决定背景，通过自己的 actor 在确认前把用户操作转成 kernel 命令。

## 公共用法

业务 UI 使用 `selectWallpaperCommand` 先写入 pending，用户点击确认时再派发
`confirmWallpaperCommand`。无 pending 或 pending 已等于 confirmed 时，确认命令返回具名
`ERR_TER_SAMPLE_WALLPAPER_CONFIRM_WITHOUT_PENDING`，不会写 state 或派发子命令。

`WallpaperId` 是封闭集合 `none | w1 | w2 | w3`。非法外部 payload 在 owner 边界返回
`ERR_TER_SAMPLE_WALLPAPER_INVALID_ID`，不得以未分类异常替代。

## 结构与迭代

- `src/features/slices/`：只保存选择事实，两个字段均使用既有 owner-only field persistence；
- `src/features/commands/`：公开选择与确认命令；
- `src/features/actors/`：闭合集合校验、pending 保护与 reducer action 派发；
- `src/selectors/`：读取已确认与未确认值；
- `src/application/`：声明 owner module；
- `terminal-invariants.json`：公共导出与测试 owner 的同步清单。

新增字段或命令前先重开需求与详设，确认它仍是 kernel 事实而不是 UI 资产或布局知识；同步
`src/index.ts`、invariant、测试与本 README。不要在这里添加图片资产、React 组件或第二份
选择状态。
