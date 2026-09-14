# TER sample2 壁纸终端 CP-4 执行证据

- `RUN_ID`: `ter-sample2-cp4-20260913-01`
- `SCOPE`: 仅实现并验证 `ui.feature.sample-wallpaper-picker` 的资产、picker、background、交互 actor、part、assembly、公共导出及骨架同步；未修改 integration、assembly Android、现有 App 的运行入口。
- `STATUS`: `MATCHED`
- `EXECUTED_AT`: `2026-09-13 20:45-21:01 +09:00`
- `AUTHORITY`: Dexter 已授权按详设与实施计划进入实施；未使用后台 DEV、seed、UAT、部署或 Git。

## 首败与根因修复

1. 首次 typecheck/test 因新增 workspace 尚未进入 Yarn install-state，真实首败是 Yarn `Package ... not found in the project`，记录于 `/tmp/ter-sample2-cp4-typecheck-first.log` 与 `/tmp/ter-sample2-cp4-test-first.log`。执行一次根级 `yarn install` 后工作区注册成功；该安装只登记现有 workspace 与 workspace 依赖，输出中的既有 peer warning 未被当作业务通过。
2. 第二次 typecheck 真实报告三处 JPG `TS2307`；原因是继承的 TS 配置带显式 `files`，未被 source graph import 的 ambient declaration 没进入 program。修复为 `src/assets.ts` 显式 reference 本包 `src/assets.d.ts`，声明只导出 RN 可接受的 numeric static asset reference；`/tmp/ter-sample2-cp4-typecheck-fourth.log` 保留了修复前失败。
3. 首次 skeleton static 因 `src/moduleName.ts` 缺少检查器要求的语句结束格式失败；补齐 literal export 形态后重跑通过。首败记录于 `/tmp/ter-sample2-cp4-skeleton-static.log`。

## 实际执行结果

| 检查 | 实际边界 | 结果 | 原始记录 |
| --- | --- | --- | --- |
| picker TypeScript | `yarn --cwd apps/terminal/ui/feature/sample-wallpaper-picker typecheck` | exit `0` | `/tmp/ter-sample2-cp4-picker-typecheck-final2.log` |
| picker focused | `yarn --cwd apps/terminal/ui/feature/sample-wallpaper-picker test` | 2 files / 8 tests，exit `0` | `/tmp/ter-sample2-cp4-picker-test-final2.log` |
| picker focused red control + cleanup | `node tools/terminal-ui-sample-wallpaper-picker/check-behavior.mjs` | baseline、`w2` source mutation red、restore cleanup 全部 `PASS` | `/tmp/ter-sample2-cp4-picker-behavior-final.log` |
| workspace package invariants | `node tools/terminal-shared/package-invariants.test.mjs` | exit `0` | `/tmp/ter-sample2-cp4-picker-package-invariants-final2.log` |
| skeleton static | `node tools/terminal-skeleton/check-static.mjs` | 6 rule gates + scaffold hygiene 全部 `PASS` | `/tmp/ter-sample2-cp4-skeleton-static-final2.log` |
| skeleton red controls | `node tools/terminal-skeleton/check-static.test.mjs` | 3 real red controls、1 non-redux green control、model test 全部 `PASS` | `/tmp/ter-sample2-cp4-skeleton-test-final3.log` |

focused 用例实际覆盖：单一 assembly/part；生产 `assetsById` 与三张 JPG 的独立直接导入 oracle；四个真实 radio；`pending ?? confirmed`
选中态；confirm enabled 派生；confirmed-only background；`none` 无图；UI command 经过
`dispatchWithRequestId`；相同 effective 选项与 disabled confirm 不产生 kernel change command（组件层
仍会产生一个 UI intent，由 picker actor 将其收敛为零 kernel command）；picker actor 只向 kernel dispatch
select/confirm，不使用本地 reducer/action；将 `w2` production source
置空的真实变异会使 focused test 失败，恢复后重新通过。上述 focused 证据只说明
该测试边界内的行为，不能外推 integration、Metro、Web、Android、native、release 或 visual。

## 资产记录

| id | path | dimensions | bytes | SHA-256 |
| --- | --- | ---: | ---: | --- |
| w1 | `apps/terminal/ui/feature/sample-wallpaper-picker/assets/w1.jpg` | 1280×853 | 48202 | 62b0e442964cab657bfa5e7013b8218afe92d3e6eb944740ec40693957afee4c |
| w2 | `apps/terminal/ui/feature/sample-wallpaper-picker/assets/w2.jpg` | 1280×853 | 231276 | d0886dae3c12648e2b1ab24367884126ed4c6f4cfe8661b419a132817a6fe734 |
| w3 | `apps/terminal/ui/feature/sample-wallpaper-picker/assets/w3.jpg` | 1280×851 | 147656 | d851c09ecb633c4ba2c1714e41a22f55f2d2af82fcb75ce3fc4081e23bd19d9b |

来源、许可证与下载 URL 已写入 picker 中文 README；资产只存在 picker 包，没有复制到 integration 或 assembly。

## 骨架与公共边界

- `apps/terminal/skeleton-graph.ts` 新增 `ui.feature.sample-wallpaper-picker`，batch=2，依赖声明与 package metadata 对齐；总节点数由 28 更新为 29。
- `tools/terminal-skeleton/check-static.mjs` 与 `check-static.test.mjs` 同批更新为 29 节点/29 个 batch-two 节点；CP-4 未把 graph 同步拖到 CP-8。
- `terminal-invariants.json.publicExports` 与 `src/index.ts` 通过 TypeScript module-symbol exact-set test；公共面包含 `WallpaperPicker`、`WallpaperBackground`、`assetsById`、交互命令、assembly、part 与类型导出。
- picker 使用 `PrimitiveRadio`、`PrimitiveImage`、`PrimitiveButton` 和 `PrimitiveContainer(layout='transparent')`，未修改 `ui.base.render`，未新增第二套 registry、state 或图片解析机制。

## 未执行档位

CP-4 尚未执行 integration、Metro、Web、Android、native、release、视觉或双屏运行验证；这些属于
后续 CP 的输入。CP-4 必须先取得 fresh 步骤级三维独立对账，再可标记 `MATCHED` 并进入 CP-5。

## 独立步骤对账

`REVIEW_CYCLE_ID=TER-SAMPLE2-IMPLEMENTATION-20260913`
`REVIEW_TARGET=IMPLEMENTATION`
`REVIEW_ROUND=2`
`REVIEW_ROUND_LIMIT=2`
`reviewerKind=INDEPENDENT_SUBAGENT`
`ROUND_FINAL_DECISION=SELF_DECIDED`

- reviewer：Curie（agent `01a09aa5-a108-7033-a6d0-167f86a534a3`）
- 输入：需求正本、详设、实施计划、规范、项目记忆与 CP-4 当前源码/日志
- 初轮发现的独立 oracle 缺口已由主 agent 修复：focused 测试直接导入三张 JPG 作为期望值，并以
  `w2` source 置空的真实变异确认会红；恢复后 cleanup 复绿。
- 第二轮 verdict：源码、测试、静态门与证据边界均核对通过；其唯一日志可见性 gap 已在同一日志路径
  写入真实命令退出码 `PICKER_TYPECHECK_EXIT=0`，Curie 完成窄范围 post-remediation factual recheck，
  `POST_REMEDIATION_EVIDENCE_CHECK=CONFIRMED`。
- `CP4_STEP_VERDICT`: `MATCHED`
