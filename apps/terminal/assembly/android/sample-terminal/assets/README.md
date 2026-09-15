# sample-terminal 应用资产

本目录只保留由 `app.json` 的应用图标与 Web favicon 配置实际消费的资源。Android 开机画面
图标不从这里读取；它由 `android/app/src/main/res/drawable-*/splashscreen_logo.png` 的
原生资源链提供，并在 `android/native-resource-registry.json` 中登记。新增资产必须同时
更新 `app.json` 或原生资源登记及其尺寸、来源和 hash，不能留下未消费的孤立文件。原生
资源登记独立于本表，但两者共同构成该 App 的完整资产投影。

| relative path | owner | consumer | reason | dimensions | sha256 |
| --- | --- | --- | --- | ---: | --- |
| `icon.png` | app-config | `app.json:expo.icon` | Android/Web application icon | 1024×1024 | `119462bb78eb240a65c869fc067ee599639b3cb5a41953f25c07b17d2a8c7e0f` |
| `android-icon-foreground.png` | app-config | `app.json:expo.android.adaptiveIcon.foregroundImage` | Android adaptive foreground | 512×512 | `9e3d0315a33c6799de601dd34cd8bf8cc3a8d16f3bf75592baec2ceb7240b391` |
| `android-icon-background.png` | app-config | `app.json:expo.android.adaptiveIcon.backgroundImage` | Android adaptive background | 512×512 | `fb139c2dee362ebf2070e23b96da6fc0d43f8492de38b8af1fd7223e19b5861d` |
| `android-icon-monochrome.png` | app-config | `app.json:expo.android.adaptiveIcon.monochromeImage` | Android adaptive monochrome | 432×432 | `6371fc2c12e33ad2215a86c281db3d682a81bebe7c957a842c13b8bf00cceb83` |
| `favicon.png` | app-config | `app.json:expo.web.favicon` | Web favicon | 48×48 | `a4e030697a7571b3e95d31860e4da55d2f98e5e861e2b55e414f45a8556828ba` |
