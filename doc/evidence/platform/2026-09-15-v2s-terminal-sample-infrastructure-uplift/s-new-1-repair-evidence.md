# S-NEW-1 修复证据

DATE=2026-09-15
REVIEW_FINDING=S-NEW-1
STATUS=FOCUSED_MATCHED;FULL_DYNAMIC_OPEN
SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

## Finding 与边界

fresh CP2 记录 `cp2-stage-reconciliation-round5-current.md` 指出：assembly rejection 分支仍
在 `apps/terminal/assembly/base/android/src/components/AndroidTerminalApp.tsx` 自绘
`assembly.base.android:startup-failure`，并用 `assembly-failure` 收起 splash；这不满足需求
R-S7 与详设对 render-owned failure page、固定 testID、alert role 和统一
`startup-failure` 的要求。该 finding 是源码/设计偏差，不是产品裁决；release、设备和 cleanup
仍不由本记录关闭。

## 根因与首败

1. 主 Codex 将 failure UI 提取到
   `apps/terminal/ui/base/render/src/components/ScreenReadyBoundary.tsx` 的
   `StandaloneStartupFailurePage`。它不要求 `RenderProvider`/`SurfaceRoot`，复用正常
   `StartupFailurePage` 的固定 testID、文案与 `accessibilityRole="alert"`；只在传入的物理
   `displayIndex` 命中 capability 的 PRIMARY target 时调用
   `hideOnce('startup-failure')`。
2. 两个 App 通过 required `renderFailurePage({reason, displayIndex})` typed callback 注入该
   render-owned page；`assembly/base/android` 不再拥有 failure UI，也不再单独调用 hide。
   两个 App 的显式 package/graph/dependencies 声明一并增加 `ui.base.render`，避免转移到未声明
   的传递依赖。
3. 首次修复后的 `node tools/terminal-skeleton/verify-static.mjs` 在
   `TERMINAL_SKELETON_MODEL_TEST` 首先失败：

   ```text
   AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
   'PASS' !== 'FAIL'
   at tools/terminal-skeleton/check-static.test.mjs:283:10
   ```

   该 mutation 删除 App 的旧精确导入文本，但生产 import 已增加
   `nativeLoadingLogger`，所以 import 未被删除，red fixture 实际没有注入缺失平台接线。
   这不是生产源码的静态失败。修复为在
   `tools/terminal-skeleton/check-static.test.mjs:277` 按该相对模块路径移除整行 import：

   ```js
   appSource.replace(/^import .* from '\.\/src\/assembly\/platformPorts'\n/m, '')
   ```

   保留该首败、根因和 broken boundary；未用延长 timeout 或改写成 PASS。

## 修复后 focused 结果

命令均从仓库根执行：

> 本节的 render `66 tests` 是 S-NEW-1 修复阶段、S-1 的 `container-empty` 用例加入之前的
> 历史命令记录；它只保留当时的修复轨迹，不代表当前 render 测试分母。S-1 修复后的当前
> 分母与重跑结果见 `s-1-r-s7-terminal-failure-repair-evidence.md`，为 12 files / 67 tests。

| 命令 | 结果 |
| --- | --- |
| `node tools/terminal-skeleton/check-static.test.mjs` | exit 0；`TERMINAL_SKELETON_MODEL_TEST=PASS`，全部既有 red vectors 均输出预期 FAIL/green control PASS |
| `node tools/terminal-skeleton/verify-static.mjs` | exit 0；`TERMINAL_STATIC=PASS`，包含 graph、triple naming、direction、declaration、runtime、TR-01、kernel independence 与 scaffold hygiene |
| `yarn --cwd apps/terminal/ui/base/render test` | 历史记录：exit 0；12 files / 66 tests PASS；含新增 standalone failure page 两个形态用例（不作为当前分母） |
| `yarn --cwd apps/terminal/assembly/android/sample-terminal typecheck` | exit 0 |
| `yarn --cwd apps/terminal/assembly/android/sample-wallpaper-terminal typecheck` | exit 0 |
| `yarn install --immutable --mode=skip-build` | exit 0；只保留既有 YN0002/YN0086 peer warnings，lock 无需修改 |

## 当前源码核对

- `apps/terminal/assembly/base/android/src/components/AndroidTerminalApp.tsx`：failure 分支
  只调用 required `renderFailurePage`；loading fallback 仍是正常等待 UI。
- `apps/terminal/ui/base/render/src/components/ScreenReadyBoundary.tsx`：standalone 与
  context-connected failure page 共享同一个 view；standalone PRIMARY/SECONDARY 行为有测试。
- `apps/terminal/assembly/android/sample-terminal/App.tsx` 与
  `apps/terminal/assembly/android/sample-wallpaper-terminal/App.tsx`：均注入 render-owned
  page，未添加 adapter、业务 state 或 splash 调用。
- 两个 App 的 `package.json`、`src/dependencies.ts`、`apps/terminal/skeleton-graph.ts` 与
  `yarn.lock`：均包含该真实 `ui.base.render` runtime dependency。

## 尚未关闭

本证据只关闭 S-NEW-1 的 source/focused 边界。CP2 fresh 对账、whole-scope 与 code↔design
必须重做；release/native/Android/device、U8、U10、U13、Web（如执行）及 cleanup 仍 OPEN。
