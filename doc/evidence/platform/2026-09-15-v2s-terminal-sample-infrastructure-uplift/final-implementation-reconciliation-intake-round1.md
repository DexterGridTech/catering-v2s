# TER sample infrastructure uplift · final implementation reconciliation intake

REVIEW_TARGET=IMPLEMENTATION
REVIEW_STATUS=OPEN_FOR_REVIEW
VERDICT=NO-GO_FOR_ACCEPTANCE_PENDING_CLAUDE
CURRENT_REQUIREMENTS_SHA256_PREFIX=40dcb600ca75
REVIEWER_KIND=INDEPENDENT_SUBAGENT

## 1. 当前来源与独立复核

本记录是动态证据增加后的当前 intake，不回写或伪造历史记录。以下两名 fresh
independent subagent 只读审查了当前源码、需求、详设、计划和 evidence，主 agent 没有
代替他们下 verdict：

| reviewer | agent id | 结论摘要 |
| --- | --- | --- |
| Nietzsche | `01a0a37b-a150-7c21-9f6a-56c03431bbee` | `NO-GO`，建议 1M/4S/4N；B0 full sample2、U1–U13 总账、U10/U13 全矩阵仍未闭合 |
| Aristotle | `01a0a37b-a1cf-7553-a61b-f223cea7a1a9` | `NO-GO_REQUEST_CHANGES`，建议 0M/4S/2N；确认 R-S7 unavailable 传播边界、旧 failure evidence 未绑定当前 APK、evidence 记录过时等问题 |
| Banach | `01a0a38a-44cd-7411-81bc-264296fc92d0` | `NO-GO`，建议 2M/3S/3N；确认源码传播链闭合，但整体 acceptance、当前 implementation handoff 与 source→APK 的 run-scoped build binding 仍有边界 |

两份原始子 agent 输出由本轮会话保留；本文件只做路径化 intake，不把建议 severity 合并
成新的作者 verdict。Aristotle 指出的 R-S7 native unavailable 问题已完成最小源码修复并
通过 focused/Kotlin 复验；Banach 返回后已补当前 implementation handoff。Banach 的“当前
handoff 不存在”已由 `doc/review/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift-implementation-review-request-codex.md`
提供可审对象，但不等于 Claude 已复核；其余 open 项目仍如实保留。

## 2. 最新源码修复与证据

R-S7 已在 native registry 保存 `Unavailable` 事件，而不是以 `null` 让 JS 永久 pending：

- `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt`
  在 display manager、surface selection、primary host/component 不可用和读取异常时
  `markUnavailable`，并以 generation 去重；成功 ready 会清除 unavailable marker。
- `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenModule.kt`
  暴露 `event(surfaceKey)` 的 ready/unavailable 结果。
- `apps/terminal/adapter/android/dual-screen/src/implementations/surfaceHost.ts`
  初始 promise 直接消费 native event，不把 unavailable 伪装成 available/pending。
- focused 命令：`yarn --cwd apps/terminal/adapter/android/dual-screen typecheck && yarn --cwd apps/terminal/adapter/android/dual-screen test --runInBand`，9 tests PASS；
  native 命令：`./gradlew :catering-v2s-adapter-android-dual-screen:test --no-daemon --console=plain`，`BUILD SUCCESSFUL`。

当前两个 release APK 已串行重建并通过 production bundle scan；随后 U8 runner 用
`--skip-build` 安装并记录这些 APK 的 sha256/bytes/mtime。故 device evidence 对 APK 文件
绑定成立，但 runner manifest 的 `build=SKIPPED_BY_EXPLICIT_OPTION` 使“同一 run 内从
当前源码构建到设备”的 source→APK 链仍是 supporting，不冒充 run-scoped build receipt：

| APK | sha256 | bytes |
| --- | --- | ---: |
| `apps/terminal/assembly/android/sample-terminal/android/app/build/outputs/apk/release/app-release.apk` | `54a819d0b7ac3f6b1a7dc64b0c63ec0244aa445871f31e2f18c6151895cf654a` | 87910889 |
| `apps/terminal/assembly/android/sample-wallpaper-terminal/android/app/build/outputs/apk/release/app-release.apk` | `5d2a8e53d57e3fdec4645754c5054fc748bf95bd56c5b7f9fe0789f881e4b702` | 88320445 |

## 3. U1–U13 当前红夹具与结果总账

`PASS` 只表示该行列出的执行体和范围；`PARTIAL/OPEN` 不得被解释成整体验收。

| 判据 | 实际红夹具/控制 | 当前结果与边界 |
| --- | --- | --- |
| U1 | `node tools/terminal-skeleton/check-static.test.mjs`；optional/spread/runtime subset/dependency-array/base-graph 红变异 | `TERMINAL_SKELETON_MODEL_TEST=PASS`；当前 static/red 范围 PASS，未推出整批 runtime acceptance |
| U2 | CP1 static red evidence 中的 missing-required-module、runtime-subset 和 dependency-array 变异；真实可取消 runtime module focused path | focused/static PASS；完整 resolver/entry 运行总账仍 OPEN |
| U3 | sample-console 两 assembly/外部 injected id regression；startup writer/real boundary focused tests | focused PASS；release logger/writer identity 只按当前运行环境解释，完整 exactly-once acceptance OPEN |
| U4 | duplicate/early/missing startup completion 的 focused oracle 与 navigation-remount regression | focused/static supporting PASS；完整 old-run/first-write/failed-path acceptance OPEN |
| U5 | `check-static.test.mjs` 的 value/type/re-export/dynamic/require/import-equals/relative/root-config 及 base→feature red vectors | red vectors PASS，`TERMINAL_STATIC=PASS`；不替代全批 fresh review |
| U6 | native identity projection、两个 Android `assembleRelease --rerun-tasks`、两个 `check-production-bundle.mjs` | 两 APK build 与 bundle scan PASS；完整外部安装/冷启动语义由 U8 记录，不外推到 U10 |
| U7 | sample2 behavior control 的 referenced/orphan/asset/theme red vectors与 native asset registry projection | `SAMPLE2_RED_MUTATION_CLEANUP=PASS`，static/native supporting PASS；完整 A2d/A7 asset journey OPEN |
| U8 | `tools/terminal-sample2/run-u8-release-cold-start.mjs --skip-build`；正常四 profile及两 App 的 `wrong-primary-display` 注入 | `u8-release-cold-start-current-rerun-04/` 与两个 `u8-release-failure-*-current/` 均 `business=PASS`、`cleanup=PASS`、APK binding 当前；仅关闭 U8 runner 范围 |
| U9 | 两 integration focused tests、shared admin-shell/catalog/openLayer/input 及 console-owned red review | focused/source PASS；未形成 Web 或整批 UI acceptance |
| U10 | sample1 当前 release 手机/双屏正常、失败恢复、age=37/empty 记录；sample2 当前 release 手机/双屏正常冻结旅途记录 | record-only supporting PASS/PASS；sample2 A1–A9 全量、Web、visual、全部 F-A、完整 U10 acceptance OPEN |
| U11 | D-1 semantic source/package/graph checker 与 all AST form/root/test/cross-edge red vectors | static checker PASS；动态/独立最终对账仍 OPEN |
| U12 | closed projection checker、native projection test、six-file/private-config/generated-d.ts red mutations | static/focused PASS；冷重启全量投影 acceptance OPEN |
| U13 | `apps/terminal/ui/feature/sample-wallpaper-picker` 真实 kernel runtime injection，select/confirm before/after write；16 tests | `TERMINAL_PACKAGE_TEST=PASS`，真实 child result/readback focused PASS；PF-06/PF-07/PF-09/PF-10、冷重启/手机双屏完整矩阵 OPEN |

## 4. U8、S-3 和失败诊断

已实际执行旧先例：`tools/terminal-sample2/run-a9-runtime.mjs`。历史目录中的旧运行是
`PASS/PASS`，但当前字节复跑先因过时 mutation anchor 首败；修复 anchor 后在
`A9 mutated SECONDARY surface readback` 超时、`logBytes=0` 首败，结果为
`business=NOT_RUN`、`cleanup=FAIL`，并已按精确拥有关系完成受控清理。见：

`doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/a9-runtime-current-rerun-01/`

这证明旧 runner 只能做 Metro/debug/mobile/source-mutation supporting probe，不能驱动
release 双屏冷启动；因此采用新建的
`tools/terminal-sample2/run-u8-release-cold-start.mjs`，不是仅改名。当前新 runner 的
正常四 profile 与两 App failure injection 都绑定上表新 APK，并记录 mobile/dual 的
window、SurfaceFlinger、logcat、UI、splash timeline、failure page 和 cleanup。

一次并发重建还在 resource verification / Kotlin incremental cache 处出现
`Storage already registered`；该首败见
`release-rebuild-concurrency-first-failure.md`。剩余构建持续到 Metro/native/APK 的进程
被保留并成功完成，随后两个 App 串行重建成功。并发首败不被改写为源码失败，也不被用作
动态 PASS。

## 5. first failure / broken boundary / last known good

- `FIRST_FAILURE`：动态早期是旧 A9 anchor 失配，anchor 修复后的真实首败是 secondary
  readback 超时且无日志；随后并发 release build 的首败是共享缓存竞争。R-S7 的 native
  unavailable null 传播曾是源码边界问题，现已修复并 focused/Kotlin PASS。
- `BROKEN_BOUNDARY`：当前源码与 focused/native/U8 局部行为已可复核，但 B0 要求的
  sample2 frozen/full acceptance、Web/visual、全量 A1–A9/F-A、完整 U10/U13/PF 矩阵、
  final whole/code-design reconciliation 和 Claude implementation verdict 仍未闭合。
- `LAST_KNOWN_GOOD`：当前 `TERMINAL_STATIC=PASS`、listed package focused tests、两个
  release APK bundle scan、U8 四 profile normal/failure `PASS/PASS`、sample1 record-only
  release runs 与 U13 16-test real runtime injection 均可由当前目录复跑；这些不构成整批 GO。

## 6. reconciliation 记录的时间语义

以下记录是动态前的 snapshot，保留其历史首败，不删除、不改写：

- `whole-scope-reconciliation-round4-current.md` 当时正确记录“无 U8 运行记录”；后来的
  `u8-release-*current*` 只 supersede 该句的时间状态，不把 whole-scope 变成 MATCHED。
- `code-design-reconciliation-round6-current.md` 当时正确记录 U8/U10/U13 动态 OPEN；后续
  当前运行 supersede 了部分 U8/U10 supporting 状态，但没有关闭它列出的完整 acceptance
  边界。

CP0–CP4、全批 whole-scope、code↔design 与本轮 Nietzsche/Aristotle 的路径和结论均应由
Claude 直接重开；本记录不是作者自报的 GO，也不是 Claude review 的替代。

## 7. 抽 base 后旧文件线下处理

`obsolete-file-cleanup.md` 是当前 source-first census。结论是：没有安全依据删除仍被
entry/import/registry/test/native build 消费的源文件；以下文件明确 `保留`：两个
integration assembly/module、sample2 wallpaper Waiting/Welcome/parts/placement actor、
shared startupDiagnosticsWriter、三个 feature module/assembly，以及两个 App 的 native
resource 输入。它们分别仍承载薄 adapter、feature owner、native projection 或真实
runtime consumer，不是被 shared base 取代的重复物。

`apps/terminal/assembly/android/sample-terminal/assets/splash-icon.png` 在当前字节已不存在，
因此记录为“已处置/无需二次删除”，不声称本轮又删除了一次。`.expo/.turbo/dist/Android
build` 是生成物，不当作 source deletion target；本轮动态目录也只属于 evidence。

当前最新动态引用已更新为 `u8-release-cold-start-current-rerun-04/` 和两个 current
failure 目录；不确定的未来候选必须先做 entry/import/registry/test census，再由主 agent
逐个决定。不存在可恢复性不明的批量删除。

## 8. 当前停止条件

当前应交 Dexter 与 Claude 做 implementation review，但交接结论必须是：

1. `GO/NO-GO` 与 `M/S/N` 由 Claude/Dexter 依当前源码和 evidence 重新裁决；
2. 现有 supporting evidence 不得升级为 sample2 B0 acceptance、Web PASS、visual PASS、
   release PASS 或整批 implementation GO；
3. 若要求整体 acceptance GO，先补 B0/sample2 full、Web/visual、PF/U10 全矩阵和最终
   fresh reconciliation；任何失败按 first failure → 根因修复 → focused 重验处理。
