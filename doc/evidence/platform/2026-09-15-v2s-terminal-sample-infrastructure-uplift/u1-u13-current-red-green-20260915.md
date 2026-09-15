# U1–U13 当前执行体与红夹具总账

DATE=2026-09-15
OWNER=main Codex
BOUNDARY=当前源码串行执行；红夹具均在 finally 恢复；不把单项 PASS 外推为整体 acceptance

| U | 实际执行体/红夹具 | 当前实际结果 | 仍未覆盖的边界 |
| --- | --- | --- | --- |
| U1 | `node tools/terminal-skeleton/check-static.test.mjs`；optional、descriptor spread、whole-array factory、dependency-array drift、root workspace、base graph red mutations | `TERMINAL_SKELETON_MODEL_TEST=PASS`；各红 mutation 均按预期 `FAIL`，mutation cleanup PASS | 完整 runtime entry acceptance 仍由评审方决定 |
| U2 | 五个 runtime dependency factory 与真实可取消 display-context module；缺失 required module/optional/whole-array 夹具 | current focused/static PASS；真正缺失 dependency 仍返回 missing-required error，夹具 cleanup PASS | 非本批其他 runtime module 组合未扩展 |
| U3 | startup writer/sink、双 assembly、navigation remount、重复 writer red | `TERMINAL_STARTUP_DIAGNOSTICS_BASELINE=PASS`；surface identity、run-id propagation、duplicate guard red 均 PASS | 没有把 sink 解析当作 writer；完整生产 HMR/老 run 由 review 再查 |
| U4 | early/duplicate/missing complete、old run、single-client oracle | startup diagnostics baseline 与 duplicate/surface/run-id red 均 PASS；缺 complete 仍按 oracle failure | 未新增生产 failure event，resolver pre-event 保持显式边界 |
| U5 | value/type/re-export/dynamic/require/import-equals/relative/root-config、base→feature/App 与 cross-platform adapter red | static checker 7 gates 全 PASS；每类 AST/base boundary red 均命中；`SCAFFOLD_HYGIENE=PASS` | 不替代源码语义 review |
| U6 | app.json/Gradle/Manifest/Kotlin package/applicationId 两 App identity 及撞号 red；release build | native projection red suite PASS；两个 release APK `BUILD SUCCESSFUL` 且 bundle scan PASS | 不把文件 hash 投影成视觉 PASS |
| U7 | referenced/orphan/native asset/README/theme/resource closure red | sample2 behavior asset red vectors、native asset projection 与 cleanup PASS | 完整业务 asset journey 仍分开 |
| U8 | `tools/terminal-sample2/check-u8-focused.mjs`；release record-only normal 与 wrong-primary dual | focused baseline/no-prevent/no-ready red PASS；当前 APK 的 2 App×mobile/dual normal `PASS/PASS`，wrong-primary dual `PASS/PASS`，cleanup 全 PASS | runtime failure variant 尚未形成独立设备矩阵；Web/visual 不在本次 |
| U9 | 两 integration focused tests、shared adminShell catalog/openLayer/input、launcher/admin parts red | console/integration focused/typecheck PASS；共享 admin console red/source controls PASS | 不替代全量 UI/visual review |
| U10 | current APK sample1/sample2 frozen journey runner，mobile/dual normal，PRIMARY/SECONDARY partKey/state/cold restart | sample1 当前 source mobile/dual `PASS/PASS`；sample2 当前 source mobile/dual `PASS/PASS`；APK binding 均与当前 build 一致 | sample2 既有完整 A1–A9/F-A acceptance 和全部失败分支未在本表冒充已闭合 |
| U11 | D-1 semantic source/package/graph checker 与全部 AST/root/test/cross-edge red | static full graph/layering/base boundary PASS；red mutation cleanup PASS | 动态模块入口语义由 review 复核 |
| U12 | closed six-file projection、native projection、private config/generated d.ts/red drift | projection baseline、app identity/config/resource/red cleanup PASS | 不把同 hash 推出视觉一致 |
| U13 | `test/pickerSystemFailure.test.ts` 真实 kernel runtime child injection；select/confirm write-before/after、resolved/rejected、readback | picker package `3 files / 16 tests PASS`；真实 child result/readback、pending/confirmed 与四条核心文案断言通过；test-only injection token production scan/red cleanup PASS | PF-06/PF-07/PF-09/PF-10 完整设备/冷重启矩阵仍由外部 review 决定 |

## 统一首败与清理

- 并发 mutation runner 首败是共享源码 mutation race，不是产品行为；见
  `static-focused-parallel-mutation-first-failure-20260915.md`。之后严格串行重跑通过；
- U8 focused 首次 hygiene 首败是 Vitest cache 未在 `finally` 清理；修复后
  `SCAFFOLD_HYGIENE=PASS`、cache absence PASS；见 `scaffold-hygiene-first-failure.md`；
- 旧 A9 探针首败是旧 mutation anchor 后的 SECONDARY readback timeout 且 logBytes=0，
  cleanup 状态独立保留；因此 S-3 结论是升级到新的 release cold-start runner。
