# TER terminal brand asset source

这些源文件只为 TER terminal 的浏览器 favicon、Android 启动器图标和 Android 开机画面
logo 生成资源；它们不是 App 内 UI 图标，业务 `src/` 不得引用本目录。

视觉底稿采用 Tabler Icons v3.46.0 的 `cpu` 轮廓，并在仓内做了颜色、比例和背景的品牌化
衍生：

- 原始图标：[Tabler `cpu.svg`](https://github.com/tabler/tabler-icons/blob/v3.46.0/icons/outline/cpu.svg)
- 许可：[MIT License](https://github.com/tabler/tabler-icons/blob/v3.46.0/LICENSE)
- 取得日期：2026-09-16
- 衍生方式：保留 CPU 轮廓语义，使用深海军蓝背景、电光青/蓝描边与 Android adaptive
  的透明前景、背景、单色三层分别渲染；不包含文字、用户数据或第三方品牌。

`icon.svg` 用于完整方形应用图标，`mark.svg` 用于透明 adaptive foreground 与 Android
splash logo，`background.svg` 用于 adaptive background，`monochrome.svg` 用于 Android
单色图标。生成后的 PNG/WebP 文件必须由各自消费方的资源登记记录尺寸和 SHA-256。
