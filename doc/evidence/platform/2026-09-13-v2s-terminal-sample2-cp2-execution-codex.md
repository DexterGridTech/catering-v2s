# TER sample2 壁纸终端 CP-2 执行证据

- `RUN_ID`: `ter-sample2-cp2-20260913-01`
- `SCOPE`: `kernel.feature.sample-wallpaper` owner slice、选择/确认命令、typed failure、持久化
  descriptor、骨架图与静态依赖门；不启动后台 DEV，不执行 seed、UAT、部署或数据操作。
- `STATUS`: `MATCHED`
- `EXECUTED_AT`: `2026-09-13`

## 实施与首败

先建立 CP-2 的真实测试夹具与 package/graph 原子声明，并故意保持 `src/index.ts` 缺失；第一次
Vitest 运行以 `Cannot find module '../src/index'` 红退出，证明测试不是空跑。补入最小 owner 实现
后，第一轮行为测试又因新包 vitest 配置遗漏仓内 platform-ports 所需的 `__DEV__` 定义而失败；
按既有 owner 测试配置补入 `define: {__DEV__: 'false'}`。

随后两条零写入断言把 runtime 的 request-ledger 更新误计入 owner state：失败输出显示 ledger
确实会因每次命令建立审计记录而变化。根因不是 wallpaper reducer 写入，而是断言范围过宽；修正为
只比较 `sample-wallpaper.selection` 的两个业务字段，并保留 journal 子命令断言。修正后行为测试
全部通过。

骨架门首轮因 `src/moduleName.ts` 少行尾分号而在 `triple-naming` 失败；按现有 owner 包的
精确声明修复。骨架红控首轮又发现 `ui.base.render` 的 mutation 只是重复设置现有依赖、字节未变，
因此不能证明门会红；将靶点改为图中未声明的 `kernel.base.transport` 后，红控恢复有效。

## 当前源码闭环

- `WallpaperId` 封闭为 `none | w1 | w2 | w3`；slice 默认 `wallpaperId='none'`，
  `pendingWallpaperId` 缺省；两个字段各自使用既有 owner-only field persistence descriptor。
- `selectWallpaperCommand` 的 actor 先在 owner 边界校验运行时 payload，非法 id 抛
  `ERR_TER_SAMPLE_WALLPAPER_INVALID_ID`，校验前不派 reducer action。
- `confirmWallpaperCommand` 只有在 pending 存在且不同于 confirmed 时写入 confirmed 并删除
  pending；无 pending 或相等时抛 `ERR_TER_SAMPLE_WALLPAPER_CONFIRM_WITHOUT_PENDING`，不写
  wallpaper slice、不派子命令。
- 运行时 module 只声明并使用 contracts/runtime/state；`src/dependencies.ts` 对
  platform-ports 的 import 只用于导出骨架图的 `devDependencyModuleNames` 元数据，不能形成
  runtime `dependencies` 或 module 依赖。图片、React、surface/display/workspace 与平台端口
  没有进入运行时行为。

## 实际命令结果

| 检查 | 命令 | 结果 | 原始记录 |
|---|---|---|---|
| owner typecheck | `yarn --cwd apps/terminal/kernel/feature/sample-wallpaper typecheck` | exit `0` | `/tmp/ter-sample2-cp2-typecheck-final6.log` |
| owner focused tests | `yarn --cwd apps/terminal/kernel/feature/sample-wallpaper test` | exit `0`; 2 files、8 tests passed | `/tmp/ter-sample2-cp2-test-final6.log` |
| skeleton static gates | `node tools/terminal-skeleton/check-static.mjs` | exit `0`; six rule gates + scaffold hygiene PASS | `/tmp/ter-sample2-cp2-skeleton-final3.log` |
| skeleton model/red controls | `node tools/terminal-skeleton/check-static.test.mjs` | exit `0`; `TERMINAL_SKELETON_MODEL_TEST=PASS` | `/tmp/ter-sample2-cp2-skeleton-test-final5.log` |
| package invariants | `node tools/terminal-shared/package-invariants.test.mjs` | exit `0`; `TERMINAL_PACKAGE_INVARIANT_MODEL_TEST=PASS` | `/tmp/ter-sample2-cp2-package-invariants-final3.log` |

## 真实红变异

将 `confirmPending` 临时变更为同时保留 `pendingWallpaperId` 后，既有 confirm focused 用例
以 `expected undefined / received "w2"` 失败退出（`/tmp/ter-sample2-cp2-confirm-pending-red.log`）。
随后已恢复正确 reducer 实现，并再次取得上表 8/8 通过。变异没有留在生产字节中。

将 `terminal-invariants.json` 临时删除 `selectWallpaperId` 后，新增的 TypeScript public-surface
checker 以 exact-set mismatch 失败退出（`/tmp/ter-sample2-cp2-public-surface-red.log`）；恢复
invariant 后，public-surface 与 owner focused tests 均重新通过。该变异没有留在生产字节中。

## 当前边界

CP-2 只证明 kernel owner 语义与静态边界；picker actor 的 effective no-op、图片来源/渲染、
ui-state layers、Web/Android、主副屏视觉和重启现场留在后续 CP。未使用后台 DEV、seed、UAT、
部署或数据操作。

## 步骤级独立对账

- `reviewerKind`: `INDEPENDENT_SUBAGENT`
- `reviewerId`: `01a09a7e-1ae0-7b22-8417-f0a471ad6b5d`
- `CP2_STEP_VERDICT`: `MATCHED`
- 对账范围：当前需求正本、CP-2 详设与计划、terminal-coding-standard、sample-wallpaper
  当前源码/测试/README/invariants、skeleton graph 与 skeleton/package gates、上述执行日志。
- 对账结论：owner state 字段与持久化、选择/确认及 typed failure、失败零业务写入、runtime 与
  dev metadata 依赖边界、package/graph/module 元数据、公共导出 exact-set、README 和证据档位
  均 MATCHED；未发现需要在 CP-2 范围内继续修复的 OPEN。
- 证据边界：typecheck 日志自身没有 stdout/stderr，不能单独作为内容证明，但命令退出码为 `0`；
  新增导出变异未另存一份红日志，exact-set checker 的当前源码覆盖新增/删除集合，已有删除
  `selectWallpaperId` 的红日志作为实际变异证据。上述边界不升级后续档位。
