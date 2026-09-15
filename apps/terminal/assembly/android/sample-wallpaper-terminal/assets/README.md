# sample-wallpaper-terminal 应用资产

这五张 PNG 是从仓内现有 `apps/terminal/assembly/android/sample-terminal/assets/` 的同名
应用脚手架资产复制而来；本包不引入外部图片，也不把未被 `app.json` 引用的 splash 资产
计入本清单。来源与许可口径为仓库现有脚手架资产的项目许可，若后续替换为外部资产，必须
在此文件补充原始 URL、许可名称、取得日期、尺寸与新 hash 后才能进入构建。Android 开机
画面资源另见 `../android/native-resource-registry.json`，两套登记不能相互替代。

| relative path | owner | consumer | reason | dimensions | sha256 |
| --- | --- | --- | --- | ---: | --- |
| `icon.png` | app-config | `app.json:expo.icon` | Android/Web application icon | 1024×1024 | `119462bb78eb240a65c869fc067ee599639b3cb5a41953f25c07b17d2a8c7e0f` |
| `android-icon-foreground.png` | app-config | `app.json:expo.android.adaptiveIcon.foregroundImage` | Android adaptive foreground | 512×512 | `9e3d0315a33c6799de601dd34cd8bf8cc3a8d16f3bf75592baec2ceb7240b391` |
| `android-icon-background.png` | app-config | `app.json:expo.android.adaptiveIcon.backgroundImage` | Android adaptive background | 512×512 | `fb139c2dee362ebf2070e23b96da6fc0d43f8492de38b8af1fd7223e19b5861d` |
| `android-icon-monochrome.png` | app-config | `app.json:expo.android.adaptiveIcon.monochromeImage` | Android adaptive monochrome | 432×432 | `6371fc2c12e33ad2215a86c281db3d682a81bebe7c957a842c13b8bf00cceb83` |
| `favicon.png` | app-config | `app.json:expo.web.favicon` | Web favicon | 48×48 | `a4e030697a7571b3e95d31860e4da55d2f98e5e861e2b55e414f45a8556828ba` |
