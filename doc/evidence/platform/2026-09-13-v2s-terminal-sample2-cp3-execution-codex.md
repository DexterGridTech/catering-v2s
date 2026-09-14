# TER sample2 壁纸终端 CP-3 执行证据

- `RUN_ID`: `ter-sample2-cp3-20260913-01`
- `SCOPE`: `kernel/base/ui-state` 的 content layers 独立持久化、四格还原、结构诊断、安装期
  catalog membership 清理、旧存档兼容、既有 U-7/content 测试反向修订与 ui-state 行为红变异；
  不启动后台 DEV，不执行 seed、UAT、部署或数据操作。
- `STATUS`: `MATCHED`
- `EXECUTED_AT`: `2026-09-13`

## 实施与首败

CP-3 先把层恢复场景写入既有 acceptance/content 测试。首轮测试以 6 个预期失败退出，证明
现有实现确实不会持久化 layers；实现后首轮还暴露了测试夹具复用 persisted `SLAVE` mode 导致
检查了错误 workspace，已修正夹具的显式 mode 切换，未改变生产逻辑。

实现完成后，`tools/terminal-ui-state/check-behavior.mjs` 的既有 U-7 red mutation 首次没有
变红：它仍然改写旧的 `containers` 解析路径，而 U-7 已改为断言独立的 layers descriptor。
这是门自身的过时靶点，不是把结果记为通过；已将 mutation 锚定到
`layers: parseLayerEntries(...)` 并重新运行，U7 变异真实失败退出，随后 cleanup PASS。

## 当前源码闭环

- `workspaceSlices.ts` 保留 `containers` record descriptor，新增独立 `layers` record descriptor；
  两者都由 MAIN/BRANCH 的 `createContentStateRegistrations` 注册，`storageKeyPrefix` 分别为
  `containers` 与 `layers`，不改变 containers 的旧格式。
- `isValidOpenedAt` 是写入 payload、serializer 和 hydration parser 共用的单一校验函数，要求
  finite、positive、integer；合法行保留原顺序，props 经过 JSON-safe 校验、clone 与 freeze。
- hydration parser 对非法行逐条丢弃并记录 `ui-state-hydration` 诊断；同一 displayMode 的
  duplicate `layerId` 保留先出现者并记录诊断；旧存档缺少 layers entry 时使用空数组并保留
  containers。
- module instance 自己拥有结构诊断队列；`install` 先 drain 结构诊断到 logger，再 dispatch
  internal `pruneHydratedLayersCommand`。该 actor 显式遍历 `MAIN/BRANCH × PRIMARY/SECONDARY`，
  只按 catalog membership 删除 unknown part；仍在 catalog 但当前 surface/display/workspace/
  instance 不可用的 layer 不删除，变化时复用 `completeUiStateWrite` flush。
- internal prune command 只从 `features/commands` 组装，未从 package root public surface 导出；
  未新增第二份 registry、第二份 section list 或 React/import 到 kernel owner。
- `ui-state/README.md` 已说明两个 prefix、旧档兼容、结构诊断字段、membership prune、
  known-but-currently-unavailable 保留和业务 props 上下文由 feature 自行负责的边界。

## 实际命令结果

| 检查 | 命令 | 结果 | 原始记录 |
|---|---|---|---|
| owner typecheck | `yarn --cwd apps/terminal/kernel/base/ui-state typecheck` | exit `0` | `/tmp/ter-sample2-cp3-typecheck-readme-final.log` |
| owner focused tests | `yarn --cwd apps/terminal/kernel/base/ui-state test` | exit `0`; 6 files、38 tests passed | `/tmp/ter-sample2-cp3-tests-readme-final.log` |
| ui-state static gates | `node tools/terminal-ui-state/check-static.mjs` | exit `0`; 8 rule gates + support PASS | `/tmp/ter-sample2-cp3-ui-state-static-readme-final.log` |
| ui-state static red model | `node tools/terminal-ui-state/check-static.test.mjs` | exit `0`; `TERMINAL_UI_STATE_STATIC_MODEL_TEST=PASS` | `/tmp/ter-sample2-cp3-ui-state-static-test-readme-final.log` |
| ui-state behavior baseline/mutations | `node tools/terminal-ui-state/check-behavior.mjs` | exit `0`; baseline PASS、U7 red mutation PASS、cleanup PASS | `/tmp/ter-sample2-cp3-ui-state-behavior-readme-final.log` |
| package invariants | `node tools/terminal-shared/package-invariants.test.mjs` | exit `0`; `TERMINAL_PACKAGE_INVARIANT_MODEL_TEST=PASS` | `/tmp/ter-sample2-cp3-package-invariants-readme-final.log` |

## 真实红变异

1. 将生产 `serializeLayerEntries` 临时改为只写空的 PRIMARY/SECONDARY 数组，
   `/tmp/ter-sample2-cp3-layers-persistence-red.log` 以 5 个失败退出：U-7、restart、四格恢复、
   unknown prune 保留已知层、known-unavailable 保留等断言均能发现层丢失。源码随后恢复；恢复后的
   38/38 输出在 `/tmp/ter-sample2-cp3-tests-after-persistence-red-revert.log`。
2. 将行为 harness 的 U7 临时 mutation 改为 `layers: []`，
   `/tmp/ter-sample2-cp3-ui-state-behavior-readme-final.log` 中记录
   `UI_STATE_BEHAVIOR_RED_U7=PASS mutation_exit=1`；生产文件未由 mutation 留下修改。

## 步骤级独立对账

- `reviewerKind`: `INDEPENDENT_SUBAGENT`
- `reviewerId`: `01a09a8f-f0ae-71b1-ac49-d00ec48dcbad`
- `CP3_STEP_VERDICT`: `MATCHED`
- 对账范围：当前需求正本 §3.6/§3.6.1b/§3.6.1c、CP-3 详设 §3.3.1-§3.3.4、实施计划 CP-3、
  `doc/platform/terminal-coding-standard.md`、相关 project-memory、ui-state 当前 source/test/
  README/public surface、上述静态/行为/包级输出。
- 三维对账：需求、详设/计划、规范与 project-memory 逐条 MATCHED；reviewer 主动以
  `layers: []` 构造了持久化缺失反例，行为 harness 实际弄红。
- reviewer 未发现 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`UNVERIFIED_REQUIRES_EVIDENCE` 或
  `DEXTER_DECISION` finding。

## 证据边界与清理

本 CP 只证明当前 source、typecheck、focused/package tests、ui-state static/behavior mutation
和 README/设计对账；未运行 Web、Android、native、设备、视觉、release、DEV、seed、UAT 或部署。
不存在由本 CP 创建的受管长运行进程；行为 harness 的临时副本与测试临时数据均已清理。
