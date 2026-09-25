# sample-wallpaper-terminal 应用资产

本目录只保留由 `app.json` 的应用图标与 Web favicon 配置实际消费的资源，也不把未被
`app.json` 引用的 splash 资产计入本清单。Android 开机画面资源另见
`../android/native-resource-registry.json`，两套登记不能相互替代。

本次图标底稿是仓内 `doc/assets/ter-terminal-brand/` 的品牌化衍生，源自 Tabler Icons
v3.46.0 的 `cpu` 轮廓：[原始图标](https://github.com/tabler/tabler-icons/blob/v3.46.0/icons/outline/cpu.svg)，
[MIT License](https://github.com/tabler/tabler-icons/blob/v3.46.0/LICENSE)，取得日期
为 2026-09-16。资源只用于浏览器 favicon、Android 启动器和 Android 开机画面，不是
App 内 UI 图标。

| relative path | owner | consumer | reason | dimensions | sha256 |
| --- | --- | --- | --- | ---: | --- |
| `icon.png` | app-config | `app.json:expo.icon` | Android/Web application icon | 1024×1024 | `83a7346c663e923c9e09727fdf5cc313121ad51046454a94f068b51be8fee4b7` |
| `android-icon-foreground.png` | app-config | `app.json:expo.android.adaptiveIcon.foregroundImage` | Android adaptive foreground | 512×512 | `251f5cff3f6113a7a991d69ab893af135347b634ed8bc76d91c9c8f8847cd2cc` |
| `android-icon-background.png` | app-config | `app.json:expo.android.adaptiveIcon.backgroundImage` | Android adaptive background | 512×512 | `65c2b71130db47b3037e61c48d6dacb1bf21309db7f58250894da3bbabeb11d1` |
| `android-icon-monochrome.png` | app-config | `app.json:expo.android.adaptiveIcon.monochromeImage` | Android adaptive monochrome | 432×432 | `de6b3b65eb48fbf2eec8ea47eb7c6ea2509745c824717d18f09c121badede983` |
| `favicon.png` | app-config | `app.json:expo.web.favicon` | Web favicon | 48×48 | `b3ac22293b37bd4283ed8c54f0c130e97ed7ce19fc64a574a58bef38549d1720` |
