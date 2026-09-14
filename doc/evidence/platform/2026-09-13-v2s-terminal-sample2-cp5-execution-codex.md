# TER sample2 壁纸终端 CP-5 执行证据

- `RUN_ID`: `ter-sample2-cp5-20260913-01`
- `SCOPE`: 实现并验证 `ui.integration.sample-wallpaper-console` 的 placement、双屏/单屏
  surface 声明、透明背景接线、等待/欢迎 part、红色主题、integration dev-host consumer、
  skeleton/layering 同步；同时修复本 CP 聚合静态门暴露的既有 TER 规则根因。未进入 CP-7
  sample2 Android assembly 的最终入口运行。
- `STATUS`: `MATCHED`
- `EXECUTED_AT`: `2026-09-13 21:01-22:06 +09:00`
- `AUTHORITY`: Dexter 已授权按详设与实施计划进入实施；未使用后台 DEV、seed、UAT、部署或 Git。

## 首败与根因修复

1. CP-5 初次独立步骤审查发现 `tools/terminal-skeleton/verify.test.mjs` 的
   `realTestPackages/noTestPackages` 仍是旧分母，并且详设把 `ui.base.dev-host` 写在 picker
   的 devDependencies、integration 写成空集合。主 agent 重新按当前 package、graph、source
   import census 修正了分母与详设文字。首轮 finding 的当前字节核验记录在独立审查结果中。
2. 修正分母后，聚合 skeleton verify 首败移到 `tools/terminal-readability` 的 RD-6：13 个
   descriptor attach site 未受 `__DEV__` 保护，Android persist-kv descriptor 还带有未许可的
   `mode` 字段、动态 capability map 与不可静态识别的 port 表达。根因修复为：所有 descriptor
   sidecar 仅在 `__DEV__` 下 attach；Android persist-kv 只保留规范允许的 `port` 与静态冻结
   capability entries，生产 storage method 与 mode routing 不变。首败原始记录：
   `/tmp/ter-sample2-cp5-verify-static-first-failure.log`。
3. RD-6 修复后，完整 verify 暴露既有 `workspaceSlices.ts` 两个四参函数、
   `contentActors.ts` 一处四层控制嵌套，以及 picker source root 的三个非法文件。根因修复为
   两个 ui-state helper 改为职责对象参数、hydration prune 先筛 unknown layers 后逐项 dispatch，
   picker 的图片映射/测试 ID/声明分别移动到合法 `foundations/` 与 `types/` 目录，并同步所有
   import、README、详设、计划和测试 reference。修复前日志：
   `/tmp/ter-sample2-cp5-skeleton-verify-model-after-rd6.log`。

## 实际执行结果

| 检查 | 实际边界 | 结果 | 原始记录 |
| --- | --- | --- | --- |
| picker TypeScript | `yarn workspace @catering-v2s/ui-feature-sample-wallpaper-picker typecheck` | exit `0` | `/tmp/ter-sample2-cp5-picker-typecheck-after-layout-final.log` |
| picker focused | `yarn workspace @catering-v2s/ui-feature-sample-wallpaper-picker test` | 2 files / 8 tests，exit `0` | `/tmp/ter-sample2-cp5-picker-test-after-layout-final.log` |
| integration TypeScript | `yarn workspace @catering-v2s/ui-integration-sample-wallpaper-console typecheck` | exit `0` | `/tmp/ter-sample2-cp5-integration-typecheck-after-layout-final.log` |
| integration focused | `yarn workspace @catering-v2s/ui-integration-sample-wallpaper-console test` | 4 files / 9 tests，exit `0` | `/tmp/ter-sample2-cp5-integration-test-after-layout-final.log` |
| dev-host TypeScript | `yarn workspace @catering-v2s/ui-base-dev-host typecheck` | exit `0` | `/tmp/ter-sample2-cp5-dev-host-typecheck-after-layout-final.log` |
| dev-host focused | `yarn workspace @catering-v2s/ui-base-dev-host test` | 4 files / 13 tests，exit `0` | `/tmp/ter-sample2-cp5-dev-host-test-after-layout-final.log` |
| ui-state regression | `yarn workspace @catering-v2s/kernel-base-ui-state typecheck` + `test` | typecheck exit `0`；6 files / 38 tests，exit `0` | `/tmp/ter-sample2-cp3-ui-state-typecheck-after-layout-final.log`；`/tmp/ter-sample2-cp3-ui-state-test-after-layout-final.log` |
| readability model/static | `node tools/terminal-readability/check-static.test.mjs` + `check-static.mjs` | 六项规则与模型全部 `PASS` | `/tmp/ter-sample2-readability-model-after-layout-final.log`；`/tmp/ter-sample2-readability-static-after-layout-final.log` |
| skeleton static | `node tools/terminal-skeleton/check-static.mjs` | graph、命名、依赖、TR-01、platform independence、scaffold hygiene 全部 `PASS` | `/tmp/ter-sample2-cp5-skeleton-static-after-layout-final.log` |
| skeleton aggregate model | `node tools/terminal-skeleton/verify.test.mjs` | `TERMINAL_VERIFY_MARKER_MODEL_TEST=PASS`，exit `0` | `/tmp/ter-sample2-cp5-skeleton-verify-after-layout-final.log` |
| layering static | `node tools/terminal-layering/check-static.mjs` | 四项规则全部 `PASS` | `/tmp/ter-sample2-cp5-layering-static-after-layout-final.log` |
| layering model/red controls | `node tools/terminal-layering/check-static.test.mjs` | red mutation 均按预期为 `FAIL`，allowed controls、cleanup、model 全部 `PASS` | `/tmp/ter-sample2-cp5-layering-test-after-layout-final.log` |
| package invariant model | `node tools/terminal-shared/package-invariants.test.mjs` | `TERMINAL_PACKAGE_INVARIANT_MODEL_TEST=PASS` | `/tmp/ter-sample2-cp5-package-invariants-model-after-layout-final.log` |

`FAIL` 出现在 layering 的红 mutation 行是夹具期望值：它表示变异后的非法 fixture 被规则
拒绝；同一日志末尾的 model test 与 cleanup 均为 `PASS`。这些静态/ focused 结果不外推
Metro、Web、native、Android、release 或视觉证据。

## 当前实现对账摘要

- integration 只有一个 production `UiCatalog` 和一个 placement actor；PRIMARY 在登录/恢复
  认证后显示 picker，SECONDARY 显示 welcome；匿名路径显示 waiting；两者均只读同一 confirmed
  wallpaper selector。
- wallpaper background 作为 `SurfaceRoot` child 放在 `ScreenContainer` 之前；picker、waiting、
  welcome 均使用 transparent container。**此处历史记录的 mobile `720×1280 PRIMARY` 已被
  2026-09-14 Dexter 指令 supersede；当前规则是所有 integration mobile surface `360×640`，
  不创建 SECONDARY，CP-7 必须以当前源码和新 evidence 为准。** laptop 声明 `1280×800 PRIMARY`
  与 `960×540 SECONDARY`。
- `ui.base.dev-host` 只属于 integration 的 devDependency，生产 dependency/source/graph 不含
  它；integration 的 `test-expo/App.tsx` 是唯一开发期 consumer。picker 的 devDependencies 为空。
- picker 实际 source root 为 `src/foundations/assets.ts`、
  `src/foundations/wallpaperPickerTestIds.ts` 与 `src/types/assets.d.ts`；三张 JPG 仍在 picker
  自己的 `assets/`，测试以独立直接 JPG import 作期望，未使用被测 `assetsById` 自证。
- skeleton 当前 package 分母包含 kernel wallpaper、picker、integration 与 dual-screen；
  no-test 分母仅保留既有 app-control/logger。layering integration census 按真实目录枚举，
  不硬编码 sample-console 或 sample2 名称。
- RD-6 的 `__DEV__` sidecar 修复只约束能力诊断 metadata；`describePlatformPortCapabilities`
  仍只读取 sidecar，storage/device/web 的实际端口方法与生产路由没有改写。

## 独立步骤对账

`REVIEW_CYCLE_ID=TER-SAMPLE2-IMPLEMENTATION-20260913`
`REVIEW_TARGET=IMPLEMENTATION`
`REVIEW_ROUND=2`
`REVIEW_ROUND_LIMIT=2`
`reviewerKind=INDEPENDENT_SUBAGENT`
`ROUND_FINAL_DECISION=SELF_DECIDED`

- reviewer：Volta（agent `01a09acb-8fa7-7f11-87bb-575d683eb61f`）。
- 初轮 finding：skeleton verify 分母过期；详设 graph/devDependency 与 source/package/plan 不一致。
- 主 agent 修复后，重新执行 CP-5 相关 typecheck、focused、readability、skeleton、layering 与
  invariant；再由 Volta 只读重开当前字节，确认分母、graph/package/source、详设 §6.2、测试
  declaration 路径一致，`POST_REMEDIATION_EVIDENCE_CHECK=CONFIRMED`。
- `CP5_STEP_VERDICT=MATCHED`。

## 未执行档位

CP-5 未执行 Web、Android、native、release、视觉或双屏运行验证；CP-6/CP-7 承担其后续
输入。CP-5 focused 只证明测试定义的 React/actor/source 边界，不证明真实 Metro、浏览器事件、
Android window、双屏壁纸可见性或像素验收。
