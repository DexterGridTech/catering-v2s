# 抽 base 后作废文件清理审计

## 结论

本轮对抽出的 `ui.base.console-assembly`、`ui.base.feature-assembly` 及两个
integration adapter 做了 source-first census。没有把仍由 package entry、Android App、
真实 module 或 part registry 消费的 adapter/feature 文件误删。确认的孤儿 splash 资产
`apps/terminal/assembly/android/sample-terminal/assets/splash-icon.png` 当前已经不存在，
因此没有再次删除；两个 App 的真实 native splash 输入仍是 Android `res/drawable-*/splashscreen_logo.png`，
并由 `styles.xml`、registry 和 release APK 路径消费。

## 逐项对账

| 候选范围 | 当前事实 | 处置 |
| --- | --- | --- |
| `ui/integration/sample-console/src/assembly/assembly.tsx` | Android `sample-terminal/src/assembly/platformPorts.ts` 与 package `src/index.ts` 直接消费；仍保留 sample-console 自有 part、surface、theme/config 和 module wiring | 保留；这是薄 adapter，不是旧 shared assembly |
| `ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx` | Android `sample-wallpaper-terminal/src/assembly/platformPorts.ts`、package entry 和 focused tests 直接消费；仍保留 wallpaper background、secondary parts 和 surface config | 保留；这是薄 adapter，不是旧 shared assembly |
| 两个 integration 的 `src/application/module.ts` | 各自 startup/placement runtime module 由 assembly 创建，且从 public entry 导出 | 保留；不能因共享 console 壳而移除 integration owner module |
| `sample-wallpaper-console/src/components/Waiting.tsx`、`Welcome.tsx`、`src/parts/parts.ts` | `parts.ts` 直接导入两个 component，assembly/index/test 直接消费 waiting/welcome parts | 保留；仍是 sample2 secondary frozen identity 的 owner |
| `sample-wallpaper-console/src/features/actors/actors.ts` | integration module 直接创建 placement actor，负责登录/恢复/退出的 secondary placement | 保留；不是 shared base 逻辑 |
| `ui/base/console-assembly/src/foundations/startupDiagnosticsWriter.ts` | shared `consoleAssembly.tsx` 生产 import、public index 和 writer focused test 均消费 | 保留；这是抽取后的唯一 writer owner |
| 三个 `ui/feature/*/src/application/module.ts` 与 `src/assembly/assembly.ts` | 三个 feature 各由 `ui.base.feature-assembly` 复用结构，但仍保留自身 commands、actors、parts、identity；各自 entry/assembly/测试消费 | 保留；这是需求 B4 的 owner adapter，不是重复 shared implementation |
| `sample-terminal/assets/splash-icon.png` | `find` 与 `rg` 均未发现该文件；`app.json` 无 splash 配置，native styles/registry/APK 使用 `splashscreen_logo` | 已处置/无需二次删除 |
| `.expo/`、`.turbo/`、`dist/`、Android `build/` | 动态、Metro、Turbo、Gradle 产生物，不是 runtime source；U8 与其他 evidence 引用其输出时按 evidence 目录保存 | 不作为源码清理对象；source census 和静态门显式排除，受管 runtime 只按 manifest cleanup 处理 |

## 可复现核验

从仓库根运行以下只读命令可复核上述结论：

```text
rg -n "createSampleAssembly|createSampleWallpaperConsoleAssembly|createSampleConsoleModule|createSampleWallpaperConsoleModule|WallpaperConsoleWaiting|WallpaperConsoleWelcome|createWallpaperConsolePlacementActor|createStartupDiagnosticsWriter" apps/terminal --glob '!**/.expo/**' --glob '!**/dist/**' --glob '!**/.turbo/**' --glob '!**/build/**'
rg -n "splash-icon|splashscreen_logo|windowSplashScreenAnimatedIcon" apps/terminal/assembly/android/sample-terminal apps/terminal/assembly/android/sample-wallpaper-terminal --glob '!**/build/**' --glob '!**/dist/**' --glob '!**/.expo/**' --glob '!**/.turbo/**'
find apps/terminal/assembly/android/sample-terminal/assets -maxdepth 1 -type f -print
find apps/terminal/assembly/android/sample-wallpaper-terminal/assets -maxdepth 1 -type f -print
```

前两条的正向命中分别落在 package entry/Android App/薄 adapter/真实 parts 或 native
styles/registry；`splash-icon.png` 不在两个 assets 列表中。没有安全依据删除任何仍被
owning source 消费的文件。若后续 source census 出现同名旧实现，必须先证明无 entry、
import、registry、测试或 evidence consumer，再由主 agent 以可审计变更处理。

## 本轮动态后的复核

后续 U8、U10、U13 证据只增加了 record-only runner 与 evidence 文件，没有产生新的
“旧 source 已被 shared base 取代”的事实。当前可引用的动态记录为：

- `u8-release-cold-start-current-rerun-04/`（最新串行重建 APK 的 hash binding、release mobile/dual 冷启动）
  以及 `u8-release-failure-sample-terminal-current/`、
  `u8-release-failure-sample-wallpaper-terminal-current/`（同一批 APK 的 R-S7 failure
  injection 与双屏目标 surface 记录）；`rerun-03/` 保留为较早的 binding 记录，不再称作当前；
  和对应 `*-apk-binding.json`；
- `sample1-frozen-journey-evidence.md` 及其列出的 mobile/dual 正常、失败恢复和空年龄
  run 目录；
- `u13-runtime-evidence.md`；
- `device-settings-and-cleanup.md`。

这些记录没有授权删除 source。`splash-icon.png` 在 census 时已不存在，属于“无需二次
删除”，不是本轮误删。若后续出现新的候选，仍必须先做 entry/import/registry/test
consumer census；不确定的文件保留并说明理由。

## 证据边界

这是 cleanup/source census 记录，不把“没有可删 source 文件”误报成 release、Web、
U10/U13 或整批 implementation acceptance PASS。U8 release 的 business/cleanup 证据
见 `u8-release-cold-start-current-rerun-04/`、其 APK binding 文件、两个 current failure
目录与 `u8-release-first-failure-repair.md`。当前 source cleanup 仍无安全可删文件；动态
目录只作为 evidence，不改变 source retain/delete 决策。
