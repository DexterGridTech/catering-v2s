# sample-wallpaper-picker

## 定位

`ui.feature.sample-wallpaper-picker` 是 sample2 壁纸终端的交互 feature owner。它只负责
展示四个壁纸选项、把用户选择和确认动作交给 kernel 壁纸模块，并提供两个可复用的渲染
组件；它不拥有 wallpaper state、不创建第二个 registry，也不直接调用 reducer。

## 作用

本包把稳定的用户选择控件、confirmed/pending 的选中投影、确认动作和 wallpaper background
映射组织成可由 integration 组装的 parts 与真实运行期 module；业务事实、图片原始资源和
设备 surface 归属仍由各自 owner 保持。

## 结构

- `src/foundations/assets.ts`：唯一的静态 `assetsById` 映射；`none` 是合法的无壁纸值。
- `src/components/laptop/WallpaperPicker.tsx` 与 `src/components/mobile/WallpaperPicker.tsx`：
  两套布局分别从 ui-state selector 读取 confirmed/pending，使用 `pending ?? confirmed` 计算
  选中项；业务行为共用 `src/hooks/useWallpaperPicker.ts`，机型差异只留在 renderer。
- `src/foundations/wallpaperCatalogData.json` 与 `src/foundations/wallpaperCatalog.ts`：壁纸
  ID、用户可见标签及其类型化入口的唯一业务字典；catalog 会启动时校验 ID、标签和资产
  的集合一致，两套 picker 与 `WallpaperBackground` 均从 `wallpaperCatalog.ts` 读取，受管
  frozen-journey runner 通过工具 adapter 读取同一数据源。
- `src/components/WallpaperBackground.tsx`：只读取 confirmed `wallpaperId`，通过同一映射
  解析背景 source；`none` 或缺失 source 返回空节点。
- `src/features/actors` 与 `src/features/commands`：交互命令及其 actor。相同 effective
  值不会向 kernel 派发；不同选择只派发 kernel `selectWallpaperCommand`；确认只派发
  kernel `confirmWallpaperCommand`。
- `src/parts/parts.ts`：声明 PRIMARY/MAIN、laptop/mobile 可用的选择器 part。

## 用法

业务编排包应从 `sampleWallpaperPickerAssembly.parts` 合并 part，从同一个 assembly 取得
`createModule()` 返回的真实运行期模块，并在两个屏幕需要显示壁纸时使用 `WallpaperBackground`。
不要复制图片列表、wallpaper state 或打开第二条命令路径。picker 的四个稳定动作 testID 由
`wallpaperPickerTestIds` 与 `wallpaperOptionTestId` 提供。`wallpaperPickerTestIds.optionsScroll`
是承载选项与确认按钮的真实滚动节点；业务测试应通过该节点的滚动动作到达确认按钮，
不得依赖固定屏幕坐标或截断的按钮边缘。

```ts
import {sampleWallpaperPickerAssembly} from '@catering-v2s/ui-feature-sample-wallpaper-picker'

const module = sampleWallpaperPickerAssembly.createModule()
const pickerParts = sampleWallpaperPickerAssembly.parts
void module
void pickerParts
```

本包的图片来自 Unsplash，均通过静态 JPG import 打包。下载时使用的原始地址、许可证、
尺寸、字节数和 SHA-256 记录在本 README 的资产表中；图片只保存在本包，不复制到
integration 或 assembly。

| id | 原始 URL | 许可证 | 尺寸 | 字节数 | SHA-256 |
| --- | --- | --- | ---: | ---: | --- |
| w1 | https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1280&q=80 | Unsplash License (https://unsplash.com/license) | 1280×853 | 48202 | 62b0e442964cab657bfa5e7013b8218afe92d3e6eb944740ec40693957afee4c |
| w2 | https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1280&q=80 | Unsplash License (https://unsplash.com/license) | 1280×853 | 231276 | d0886dae3c12648e2b1ab24367884126ed4c6f4cfe8661b419a132817a6fe734 |
| w3 | https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1280&q=80 | Unsplash License (https://unsplash.com/license) | 1280×851 | 147656 | d851c09ecb633c4ba2c1714e41a22f55f2d2af82fcb75ce3fc4081e23bd19d9b |

## 在这个包上迭代时

新增壁纸必须先更新 `WallpaperId` 的 kernel 契约、该映射和真实来源记录，再补 UI 行为与
独立的 source/pixel 验证；不得用同一被测映射反向生成期望。修改公共导出时同步
`terminal-invariants.json` 并运行本包 typecheck、focused tests、package invariants 和
适用的 skeleton gate。图片解析或类型声明问题应修本包的 consumer-visible 边界，不应复制
资产或新增 bundler。
