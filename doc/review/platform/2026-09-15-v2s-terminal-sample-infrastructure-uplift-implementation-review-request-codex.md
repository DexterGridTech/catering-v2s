# TER sample 基础设施上收 base · implementation review 交接（当前源码）

REVIEW_KIND=IMPLEMENTATION_REVIEW_HANDOFF
REVIEW_TARGET=IMPLEMENTATION
REVIEW_STATUS=OPEN_FOR_CLAUDE_REVIEW
SOURCE_REQUIREMENTS_SHA256_PREFIX=628d84c09c47
IMPLEMENTATION_AUTHORITY=DEXTER_ONE_TIME_AUTHORIZED
CURRENT_RECONCILIATION=MAIN_AGENT_MATCHED_WITH_OPEN_EVIDENCE_BOUNDARIES
REVIEW_FALLBACK=MAIN_AGENT_AFTER_REPEATED_SUBAGENT_FAILURE
NOT_AUTHORIZED=本请求不授权新增或修改源码/测试/依赖/脚本/构建产物，不授权 Git 或把 supporting evidence 改写为 acceptance GO

## 背景

当前需求稿是 v3.7，sha256 前缀为 `628d84c09c47`。Dexter 已授予本批一次性 implementation
授权，Codex 已完成详设/计划对应的源码实施、静态与 focused 验证、release 构建、release
手机/双屏冷启动观察、sample1/sample2 冻结旅途、picker 真实 runtime 注入，以及抽 base 后
空壳文件的线下移出。旧文件没有用空壳保留来满足门；清理逐路径记录在
`doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/obsolete-file-cleanup-round2.md`。

当前交付仍不是整体 implementation acceptance GO。静态与 focused 当前为 PASS，native/
Android/release 为 supporting PASS，当前受管 runner 的 cleanup 为 PASS；Web、visual、完整
sample2 B0/A1–A9/F-A、完整 U10/U13/PF 矩阵及 Claude 的最终 implementation verdict 仍为
OPEN。请不要把局部动态证据升级为完整 acceptance。

本轮不再追加新的对抗式子 agent：此前 fresh 子 agent 多次因运行时停滞、错误路径或未完成
输入读取而失败，已保留真实状态、首败、broken boundary 和原因；在当前任务授权下由主 agent
完成同范围 reconciliation，并明确标注为 `MAIN_AGENT_FALLBACK`，不冒充独立 reviewer。现有
CP 级和步骤级独立对账仍保留在 evidence 中。

## 评审目标

请基于当前源码、需求 v3.7、详设、计划和真实 evidence 作 implementation review，回答：

1. B0–B4 的实现是否逐项满足 owning source 中的需求、详设和批次约束，特别是 base/adapter
   边界、single shared admin console、single startup writer、run identity、ready/failure
   生命周期和 picker 两跳派发；
2. U1–U13 的执行体、绿色路径、真实 red mutation 和语义断言是否成立，逐条区分常驻门、
   focused proof、native/Android supporting、release supporting 与尚未覆盖的 acceptance；
3. release 手机/双屏冷启动是否真实证明 splash 在 ready 前存在、ready 后收起，且错误 PRIMARY
   在启动期显示失败页、无 ready/complete；
4. sample1 的 partKey/layerId/testID 冻结标识与 sample2 的选择、确认、pending、重启恢复是否
   被当前旅途证据正确验证，是否存在把单条旅途外推成 B0/U10/PF 全闭合的问题；
5. 三类步骤对账、全范围主 agent fallback 对账、逐代码与详设对账、首败/历史 supersession
   和 cleanup 记录是否自洽；
6. `run-a9-runtime.mjs` 的实际复跑是否足以支持 S-3 升级为专用 release 双形态 runner，且
   新 runner 不是仅改名；
7. 抽 base 后移出两个空壳 adapter 是否有真实 entry/import/registry/test/native build
   consumer census，且没有误移仍有 owner 的文件。

## 需阅读文件

请从仓库根开始，按以下顺序读取：

- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、Roadmap 授权、
  `project-memory/index.md` 与命中的项目记忆、`scripts/README.md`；
- `doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-requirements-claude.md`：
  v3.7 需求、R-E1/R-E2/R-S1/R-S7/R-E4、U1–U13、B0–B4 前置和固定裁决；
- `doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-design-codex.md`：
  D-1–D-14、D-8/D-9、R-S7、U8/U13、执行体、failure seam 和设计处置；
- `doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-plan-codex.md`：
  B1–B4 落点、CP 门、三类对账顺序、动态步骤和当前交付索引；
- `doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/u1-u13-current-red-green-20260915.md`：
  U1–U13 当前 red/green 汇总；
- `doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/release-build-current-source-20260915.md`：
  当前两个 release APK 的构建结果、字节数和 sha256；
- `doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/u8-release-cold-start-current-source-rerun-20260915.md`：
  两 App、手机/双屏正常冷启动的当前记录式证据；
- `doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/u8-release-wrong-primary-current-source-rerun-20260915.md`：
  两 App、双屏 wrong-primary 失败注入、失败页、splash 和 cleanup；
- `doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/sample1-frozen-current-source-normal-20260915.md`：
  sample1 当前 release 手机/双屏冻结旅途；
- `doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/sample2-frozen-current-source-normal-20260915.md`：
  sample2 当前手机/双屏选择、确认、pending、冷重启恢复旅途；
- `doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/u13-runtime-evidence.md`：
  picker 真实 kernel actor/UI 与测试注入的 16 个 focused tests；
- `doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/obsolete-file-cleanup-round2.md`：
  旧 adapter 空壳及其 retain/delete census；
- `doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/static-current-reverification-round2.md`、
  `startup-diagnostics-current-round2.md`、`u8-focused-current-round2.md`、
  `s-new-1-repair-evidence.md`、`s-1-r-s7-terminal-failure-repair-evidence.md`：当前静态、诊断、
  U8、render failure 和 native unavailable 边界结果；
- `doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/whole-scope-reconciliation-main-agent-fallback-round14.md`、
  `code-design-reconciliation-main-agent-current-round15.md`：当前主 agent fallback 与代码/详设对账；
- `doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/cp-b0-3d-reconciliation-round-current-plato.md`、
  `cp-b1-3d-reconciliation-round-current-aquinas.md`、
  `cp-b2-3d-reconciliation-round-current-euler.md`、
  `cp-b3-3d-reconciliation-round-current-socrates.md`、
  `cp-b4-3d-reconciliation-round-current-hubble.md`、
  `runner-step-reconciliation-round6-nash.md`、`runner-step-reconciliation-round7-feynman.md`、
  `runner-step-reconciliation-round8-parfit.md`、`runner-step-reconciliation-round9-mendel-mcclintock.md`、
  `runner-step-reconciliation-round10-avicenna.md`：现有步骤/批次三维对账；
- `doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/s3-run-a9-current-20260915.md`、
  `a9-runtime-first-failure-repair.md`、`s3-run-a9-probe.md`：旧 runner 当前复跑首败和 S-3 判断；
- `apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx`、
  `apps/terminal/ui/base/console-assembly/src/foundations/startupDiagnosticsWriter.ts`、
  `apps/terminal/kernel/base/platform-ports/src/foundations/createPlatformPorts.ts`、
  `apps/terminal/ui/base/render/src/components/ScreenContainer.tsx`、
  `apps/terminal/ui/base/render/src/components/ScreenReadyBoundary.tsx`：single writer、ready、
  failure page 和 platform sink；
- `apps/terminal/ui/feature/sample-wallpaper-picker/src/features/actors/actors.ts`、
  `apps/terminal/ui/feature/sample-wallpaper-picker/src/components/WallpaperPicker.tsx`、
  `apps/terminal/ui/base/feature-assembly/src/index.ts`：picker 两跳派发和 feature owner；
- `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt`、
  `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenModule.kt`、
  `apps/terminal/assembly/android/sample-terminal/android/app/src/main/java/com/anonymous/sampleterminal/MainActivity.kt`、
  `apps/terminal/assembly/android/sample-wallpaper-terminal/android/app/src/main/java/com/catering/v2s/terminal/samplewallpaper/MainActivity.kt`、
  `apps/terminal/assembly/base/android/android/src/main/java/com/catering/v2s/terminal/assembly/base/android/TerminalNativeLoadingRegistry.kt`：
  native unavailable/terminal failure 与 splash gate；
- `tools/terminal-sample2/run-a9-runtime.mjs`、`tools/terminal-sample2/run-u8-release-cold-start.mjs`、
  `tools/terminal-sample2/run-sample1-frozen-journey.mjs`、`tools/terminal-sample2/run-sample2-frozen-journey.mjs`、
  `tools/terminal-sample2/check-u8-focused.mjs`、`tools/terminal-sample2/check-startup-diagnostics.mjs`、
  `tools/terminal-sample2/check-native-projection.mjs`、`tools/terminal-skeleton/check-static.mjs`：
  当前执行体与 red mutation。

## 独立核验重点

1. 重新核对当前 requirements sha 与两个 APK binding。当前 release APK 为：
   `apps/terminal/assembly/android/sample-terminal/android/app/build/outputs/apk/release/app-release.apk`
   （87,920,433 bytes，sha256 `e985891e23872a7ff68af44e93b1b6d7629df375e6759a16c83a3b67d9f8c94`），
   `apps/terminal/assembly/android/sample-wallpaper-terminal/android/app/build/outputs/apk/release/app-release.apk`
   （88,329,713 bytes，sha256 `0388b6f77b49841104cdd867103ceb641326b66279bc32af62f0e6021e8045dd`）。
   以 raw `result.json`、APK binding、logcat、SurfaceFlinger/UI、screenshots 和 manifest cleanup
   互相核对，不以摘要单独作结论。
2. U1–U13 当前 red/green 实际结果为：U1 PASS（graph red/mutation）；U2 PASS（真实缺失
   runtime dependency）；U3 PASS（诊断 baseline、surface、run-id、duplicate red）；U4 PASS
   （缺 complete 仍由 oracle 失败）；U5 PASS（AST/base boundary 与挪文件 red）；U6 PASS
   （native projection、applicationId collision red、release build）；U7 PASS（asset/projection
   red）；U8 PASS（focused red、2 App×mobile/dual normal 与 wrong-primary）；U9 PASS（integration
   focused/typecheck/admin console）；U10 PASS（当前 sample1/sample2 手机/双屏正常冻结旅途，非
   full B0）；U11 PASS（semantic graph/AST）；U12 PASS（projection red）；U13 PASS（16 个真实
   runtime injection focused tests，PF 全矩阵仍 OPEN）。请逐条确认 PASS 的边界没有外推。
3. R-S7 的正常时序必须同时看到 ready 前 splash、首个真实 RN 内容、ready candidate、
   startup.complete/ready-hide 顺序和 settled splash hidden；wrong-primary 必须看到启动期
   `ui.base.render:startup-failure`、标题“终端启动失败”、说明“请重启终端，如仍失败请联系管理员”，
   不出现 ready/complete，并确认 SECONDARY 不显示全屏失败页。
4. S-3 必须区分旧 `run-a9-runtime.mjs` 的历史 PASS、当前实际 stale-anchor/secondary
   readback timeout（`logBytes=0`）首败与新 release runner 的必要性。实际证据支持的结论是旧
   runner 不能驱动 release 双屏冷启动/splash 时序，故采用 `run-u8-release-cold-start.mjs`，
   不是把旧脚本改名。
5. 重点查 single writer：`console-assembly` 生成随机 `startupRunId` 并写 complete；
   platform-ports 只作 sink、采用调用方 id；六组完成、PRIMARY declared/measured、PRIMARY
   真实 part ready 缺一不写 complete；`__DEV__` focused logger 覆盖调用方 id 的行为不能被
   release 证据掩盖。
6. 重点查 picker：真实 kernel actor 先写，后置测试 actor 在同一命令抛错；写入相位由 actor
   回读结果确定；写入前/写入后、选择/确认 reject 的 state、pending 保留和已确认壁纸不变均须
   与 U13 focused 结果一致，且生产包没有可调试注入面。
7. 重点查清理和证据边界：历史“未运行/OPEN”记录只能由新文件明确 supersede，不能静默改写；
   `obsolete-file-cleanup-round2.md` 必须支持两个空壳包移出是安全的，同时不能把仍有 consumer
   的 device/dual-screen/persist-kv adapter 或原生 asset 当作废弃物。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并报告 `M`、`S`、`N` 数量。每条 finding 请包含：

- `CONFIRMED` / `PARTIALLY_CONFIRMED` / `REJECTED_WITH_EVIDENCE` /
  `UNVERIFIED_REQUIRES_EVIDENCE` / `DEXTER_DECISION`；
- 精确仓库相对路径、行号、影响面和可复现命令或反例；
- 最小修复建议，以及是否需要 Dexter 的产品/范围/设计裁决。

结论必须分别列出 static、focused、native、Android、release、Web、visual、cleanup 和整体
implementation acceptance；当前 Web、visual、完整 sample2 B0/A1–A9/F-A、PF 全矩阵没有证据，
不得写成 PASS。主 agent fallback 对账可以作为当前任务的有效 reconciliation 记录，但不能被描述
为 fresh 独立 reviewer verdict。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助独立复核 TER sample 基础设施上收 base 的当前 implementation。

背景：需求稿当前为 v3.7，sha256 前缀为 628d84c09c47。Dexter 已一次性授权 Codex 完成详设/计划对应的源码实施和获准的动态验证。当前已完成 shared console/base、native splash/ready/failure、feature skeleton、picker 两跳派发、静态/focused/native supporting、release 构建与冷启动记录、sample1/sample2 冻结旅途，以及抽 base 后两个空壳 adapter 的线下移出。当前不是整体 implementation acceptance GO：完整 sample2 B0/A1–A9/F-A、完整 U10/U13/PF、Web、visual 和最终 Claude verdict 仍保持 OPEN。

本轮不再追加新的对抗式子 agent。此前 fresh 子 agent 因运行时停滞、错误路径或未完成输入读取而失败的真实状态、首败、broken boundary 和原因已保存在 evidence；主 agent fallback 记录为 doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/whole-scope-reconciliation-main-agent-fallback-round14.md，代码与详设对账为 doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/code-design-reconciliation-main-agent-current-round15.md。该记录不冒充 fresh reviewer verdict；请直接重开当前源码和 evidence 作你的 implementation review。

评审目标：判断实现是否逐项满足 v3.7 需求、详设和 B1–B4 计划，重点核验 R-S7 unavailable→failure page、R-E1 adapter 边界、shared admin console/single writer/run identity、picker 两跳写入前/后失败分类、U1–U13 红夹具和语义证据、release 手机/双屏 splash 时序与 wrong-primary failure page、sample1/sample2 冻结旅途、步骤/批次/整体 reconciliation，以及废弃文件线下处理。必须区分 static、focused、native、Android、release、Web、visual、cleanup 和整体 acceptance，不得把 supporting evidence 外推为 PASS。

请从仓库根阅读：
- AGENTS.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md、project-memory/index.md、scripts/README.md；
- doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-requirements-claude.md（v3.7 需求、固定裁决、U1–U13、B0–B4）；
- doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-design-codex.md（D-1–D-14、D-8/D-9、U8/U13）；
- doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-plan-codex.md（B1–B4、CP 门、测试和当前交付索引）；
- doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/u1-u13-current-red-green-20260915.md；
- doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/release-build-current-source-20260915.md；
- doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/u8-release-cold-start-current-source-rerun-20260915.md；
- doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/u8-release-wrong-primary-current-source-rerun-20260915.md；
- doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/sample1-frozen-current-source-normal-20260915.md；
- doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/sample2-frozen-current-source-normal-20260915.md；
- doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/u13-runtime-evidence.md；
- doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/obsolete-file-cleanup-round2.md；
- doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/static-current-reverification-round2.md、startup-diagnostics-current-round2.md、u8-focused-current-round2.md、s-new-1-repair-evidence.md、s-1-r-s7-terminal-failure-repair-evidence.md；
- doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/cp-b0-3d-reconciliation-round-current-plato.md、cp-b1-3d-reconciliation-round-current-aquinas.md、cp-b2-3d-reconciliation-round-current-euler.md、cp-b3-3d-reconciliation-round-current-socrates.md、cp-b4-3d-reconciliation-round-current-hubble.md、runner-step-reconciliation-round6-nash.md、runner-step-reconciliation-round7-feynman.md、runner-step-reconciliation-round8-parfit.md、runner-step-reconciliation-round9-mendel-mcclintock.md、runner-step-reconciliation-round10-avicenna.md；
- doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/s3-run-a9-current-20260915.md、a9-runtime-first-failure-repair.md、s3-run-a9-probe.md；
- apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx、apps/terminal/ui/base/console-assembly/src/foundations/startupDiagnosticsWriter.ts、apps/terminal/kernel/base/platform-ports/src/foundations/createPlatformPorts.ts、apps/terminal/ui/base/render/src/components/ScreenContainer.tsx、apps/terminal/ui/base/render/src/components/ScreenReadyBoundary.tsx；
- apps/terminal/ui/feature/sample-wallpaper-picker/src/features/actors/actors.ts、apps/terminal/ui/feature/sample-wallpaper-picker/src/components/WallpaperPicker.tsx、apps/terminal/ui/base/feature-assembly/src/index.ts；
- apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt、apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenModule.kt、apps/terminal/assembly/android/sample-terminal/android/app/src/main/java/com/anonymous/sampleterminal/MainActivity.kt、apps/terminal/assembly/android/sample-wallpaper-terminal/android/app/src/main/java/com/catering/v2s/terminal/samplewallpaper/MainActivity.kt、apps/terminal/assembly/base/android/android/src/main/java/com/catering/v2s/terminal/assembly/base/android/TerminalNativeLoadingRegistry.kt；
- tools/terminal-sample2/run-a9-runtime.mjs、tools/terminal-sample2/run-u8-release-cold-start.mjs、tools/terminal-sample2/run-sample1-frozen-journey.mjs、tools/terminal-sample2/run-sample2-frozen-journey.mjs、tools/terminal-sample2/check-u8-focused.mjs、tools/terminal-sample2/check-startup-diagnostics.mjs、tools/terminal-sample2/check-native-projection.mjs、tools/terminal-skeleton/check-static.mjs。

独立核验重点：
1. 当前两个 release APK 的 sha256/字节数和所有 U8 raw result binding 是否一致。sample-terminal 为 87920433 bytes、sha256 e985891e23872a7ff68af44e93b1b6d7629df375e6759a16c83a3b67d9f8c94；sample-wallpaper-terminal 为 88329713 bytes、sha256 0388b6f77b49841104cdd867103ceb641326b66279bc32af62f0e6021e8045dd。
2. U1–U13 当前 red/green：U1 PASS、U2 PASS、U3 PASS、U4 PASS、U5 PASS、U6 PASS、U7 PASS、U8 PASS、U9 PASS、U10 PASS（仅当前 sample1/sample2 冻结旅途，不等于 full B0）、U11 PASS、U12 PASS、U13 PASS（16 个 focused runtime injection；PF 全矩阵 OPEN）。请逐条核实真实夹具、输出和边界。
3. U8 正常路径要区分 ready 前 splash、首个真实 RN 内容、ready candidate、complete/ready-hide 顺序和 settled hidden；wrong-primary 要证明启动失败页的 testID、标题“终端启动失败”、说明“请重启终端，如仍失败请联系管理员”，且无 ready/complete。
4. S-3 要核对旧 run-a9 的历史 PASS、当前 stale-anchor/secondary readback timeout（logBytes=0）首败，以及新 run-u8-release-cold-start runner 确实支持 release 手机/双屏冷启动，而不是脚本改名。
5. 要核对 single writer、六组完成条件、PRIMARY declared/measured/真实 part ready、platform sink 只采用调用方 startupRunId，以及 __DEV__ focused logger 覆盖行为与 release 证据的差异。
6. 要核对 picker 真实 kernel actor 先写、后置测试 actor 抛错、actor 回读相位、写入前/写入后 state 与提示、pending/已确认壁纸不变，以及生产包没有调试注入 seam。
7. 要核对 CP/步骤/主 agent fallback/代码-详设对账和历史 supersession；核对 obsolete-file-cleanup-round2.md 的 entry/import/registry/test/native consumer census。

请给出 GO 或 NO-GO，并报告 M / S / N。每条 finding 写明 CONFIRMED、PARTIALLY_CONFIRMED、REJECTED_WITH_EVIDENCE、UNVERIFIED_REQUIRES_EVIDENCE 或 DEXTER_DECISION，给出精确仓库相对路径和行号、影响、可复现核验/反例、最小修复及是否需 Dexter 裁决。请分别报告 static、focused、native、Android、release、Web、visual、cleanup 和整体 implementation acceptance。

授权边界：这是只读 implementation review 请求，不授权修改源码、测试、依赖、脚本、构建产物或文档，不授权新的构建、Metro、Web、Android、设备、DEV、seed、UAT、部署或 Git 操作，也不授权把任何 supporting evidence 写成 acceptance GO。谢谢。
```
