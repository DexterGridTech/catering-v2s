# TER 骨架最终 22 包设备证据 · implementation 独立复核请求

REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=TER_SKELETON_FINAL_DEVICE_IMPLEMENTATION_20260829
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
AUTHOR_VERDICT=NOT_PREJUDGED

## 背景

TER 骨架批一 14 个包与批二新增 8 个包已经落地，最终为 22 个 child workspace。此前的
implementation review（`doc/review/platform/2026-08-29-v2s-terminal-skeleton-batch1-batch2-implementation-review-claude.md`）
在纯静态范围给出 `GO · M=0 · S=1 · N=2`，并指出批二四个新增 adapter 尚无设备证据。

Dexter 随后要求补齐「除仓级 `scripts/verify` 外，凡可直接证明的 TER 边界」。因此在最终 22
包树上新增了一次人工 Android 模拟器运行。该运行不是能力实现：adapter 仍只有最小 Kotlin
Module 注册类；本轮仍不运行仓级 verifier、DEV、L2、UAT、部署或任何业务能力测试。

请不要采信作者的状态总结或旧 review verdict；从当前源码、当前 evidence 和必要的可复跑
TER-local 命令重新判断。本文件只请求独立复核，不是 Codex 的 GO/NO-GO 结论。

## 评审目标

请证伪式确认最终 22 包 assembly 的以下边界是否真实成立：

1. `npx expo run:android --no-install --device Pixel_Tablet` 是否在指定模拟器上成功完成 Gradle
   构建、Expo module autolinking、APK 安装、Activity 启动和 JS main 执行；
2. Expo 输出中的 5 个 TER adapter 是否全部被发现，而不是把批一旧的单 adapter 证据扩展过来；
3. `adb` 前台 Activity、目标 PID、UI hierarchy 与截图是否共同证明 bootstrap 实际渲染 22/22
   个 `moduleName`；
4. Expo CLI 在证据采集后由 Ctrl-C 退出（exit 130）是否被诚实区分为受控停止，而非被写成构建失败或成功退出；
5. 生成的 `android/`、`.expo/`、Turbo cache 是否只在本次运行拥有、可恢复移出，最终 TER 源树是否无 package-local residue；
6. 设备证据的主张边界是否仍只到 Gradle/autolinking/启动/bootstrap 渲染，未越界为 Kotlin/native
   能力、持久化、command、slice、端口、双屏或任何业务行为；仓级 `scripts/verify` 未运行是否仍清楚标为未证明而非 TER 失败。

## 需阅读文件

请从 catering-v2s 仓库根阅读：

- `AGENTS.md`：执行边界、日志、独立对账与结束闸门；
- `PLATFORM-BLUEPRINT.md`：平台与 TER 层次边界；
- `project-memory/decisions/deterministic-context-only.md`：证据确定性要求；
- `project-memory/decisions/terminal-architecture-and-stack-rulings.md`：TER 包与原生形态裁定；
- `project-memory/decisions/terminal-build-order-and-batches.md`：批次与设备验收边界；
- `doc/platform/terminal-coding-standard.md`：TR-01 至 TR-09 及骨架例外；
- `doc/plans/platform/2026-08-29-v2s-terminal-skeleton-requirements-claude.md`：需求正本；
- `doc/plans/platform/2026-08-29-v2s-terminal-skeleton-implementation-design-codex.md`：详设与当前收口；
- `doc/plans/platform/2026-08-29-v2s-terminal-skeleton-implementation-plan-codex.md`：实施计划、验证入口与边界；
- `apps/terminal/skeleton-graph.ts`、`apps/terminal/package.json`、根 `package.json`、`turbo.json`、`.gitignore`：规格、workspace、Turbo 与生成物边界；
- `apps/terminal/assembly/android/pos-desktop/index.ts`、`App.tsx`、`src/skeletonBootstrap.ts`、`src/moduleName.ts`：真实入口与渲染；
- `apps/terminal/assembly/android/pos-desktop/package.json` 与 `src/dependencies.ts`：assembly 正式依赖；
- `apps/terminal/adapter/android/{persist-kv,device,app-control,logger,dual-screen}`：Expo config、Android source 与最小 Kotlin Module；
- `tools/terminal-skeleton/`：静态、图、marker 与 TER-local verify 实现；
- `doc/evidence/platform/terminal-skeleton/batch-1/cp7-android-device-codex.md`：批一 14 包设备历史证据；
- `doc/evidence/platform/terminal-skeleton/batch-2/cp8-batch2-skeleton-codex.md`：批二及最终设备 addendum；
- `doc/review/platform/2026-08-29-v2s-terminal-skeleton-batch1-batch2-implementation-review-claude.md`：旧静态 review，仅作为待证伪输入。

新增动态证据位于：

- `.runtime/terminal-skeleton/batch-2/device-final/final-device-acceptance.log`；
- `.runtime/terminal-skeleton/batch-2/device-final/expo-run-android-final.log`；
- `.runtime/terminal-skeleton/batch-2/device-final/runtime-assertions.log`；
- `.runtime/terminal-skeleton/batch-2/device-final/ui.xml`、`module-names-expected.log`、`module-names-rendered.log`、`screen.png`；
- `.runtime/terminal-skeleton/batch-2/device-final/logcat-app-pid.log`、`logcat-app-assertion.log`；
- `.runtime/terminal-skeleton/batch-2/device-final/cleanup.log`、`ter-generated-residue-after-verify.log`、`ter-verify-post-device.log`。

## 独立核验重点

请从当前文件与证据逐条重算并报告：

1. 模拟器身份只应是 `emulator-5554 / Pixel_Tablet / SDK 35`，不得把同时连接的实体设备当目标；
2. 原始 Expo 输出是否同时包含 `BUILD SUCCESSFUL`、5 个完整 adapter 名称、`app-debug.apk` 安装、
   `com.anonymous.posdesktop/.MainActivity` 打开、`Android Bundled` 和 761 modules；
3. `ui.xml` 的单一 TextView 文本是否与 22 个当前 `src/moduleName.ts` 字面量 exact-set 相等，
   `APP_PID_LOG` 是否无目标进程 fatal/JS error；区分无关模拟器平台 warning 与目标进程错误；
4. final-device 的清理路径是否可恢复，assembly 源树是否无 `android/`、`.expo/`、`dist` 和 package-local
   `.turbo`/`node_modules`；TER-only verify 是否 exit 0 且 `TERMINAL_VERIFY_CLEANUP=PASS`；
5. 读取当前 Kotlin 源码，反证设备启动没有实现任何 native capability；确认 root `scripts/verify` 的
   未执行状态没有被错误写为 PASS；
6. 扫描详设、计划、CP8 evidence 中是否仍有把「批二设备未执行」当当前状态、把 647 与 761 混为一个
   Metro 数字、把受控 exit 130 当失败、或把 22/22 typecheck 当业务正确性的表述矛盾。

若发现问题，请给出 owning source、可复现失败条件、影响、同族扫描结果、最小修复和更小替代为何不足，
并分类 `CONFIRMED` / `PARTIALLY_CONFIRMED` / `REJECTED_WITH_EVIDENCE` /
`UNVERIFIED_REQUIRES_EVIDENCE` / `DEXTER_DECISION`。

## 期望结论

请给出明确的 `GO` 或 `NO-GO`，以及 `M` / `S` / `N` 数量。每条 finding 必须包含精确仓根相对路径与行号/节号、
事实与证据、后果、最小修复、同族扫描、静态/类型/Metro/设备/Kotlin/能力的分层边界，并明确是否需要
Dexter 产品、范围或授权裁决。若无 finding，也要明确列出已核与未核，不用“看起来一致”。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助对 TER 骨架最终 22 包设备证据做独立 IMPLEMENTATION 复核。

背景：TER 批一 14 个包与批二 8 个包已落地，最终为 22 个 child workspace。此前纯静态 implementation review 给出 GO（M=0、S=1、N=2），其中 S-1 是「批二四个新增 adapter 尚无设备证据」的主张边界提醒。Dexter 随后要求补齐除仓级 scripts/verify 外可直接证明的边界，因此在最终 22 包树上新增了一次人工 Android 模拟器运行。adapter 仍只有最小 Kotlin Module 注册类，本轮不实现任何终端能力，也不运行仓级 scripts/verify、DEV、L2、UAT、部署或业务能力测试。请不要采信作者总结或旧 verdict，从当前源码与证据重新判断。

目标：请证伪式核验 `npx expo run:android --no-install --device Pixel_Tablet` 是否真实证明最终树的 Gradle 构建、5/5 Expo module autolinking、APK 安装、Activity 启动、JS main 执行与 bootstrap 22/22 moduleName 渲染；确认 Ctrl-C 后 exit 130 是证据采集完成后的受控停止；确认生成物只被本次运行拥有并已可恢复移出；确认设备成功没有越界为 Kotlin/native 或业务能力；确认 root scripts/verify 的授权验收未完成且事故性静态首败未被误写成 PASS。

请从 catering-v2s 仓库根阅读：
- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`：执行边界与架构；
- `project-memory/decisions/deterministic-context-only.md`、`project-memory/decisions/terminal-architecture-and-stack-rulings.md`、`project-memory/decisions/terminal-build-order-and-batches.md`：证据与 TER 批次裁定；
- `doc/platform/terminal-coding-standard.md`：TER 正本；
- `doc/plans/platform/2026-08-29-v2s-terminal-skeleton-requirements-claude.md`、`doc/plans/platform/2026-08-29-v2s-terminal-skeleton-implementation-design-codex.md`、`doc/plans/platform/2026-08-29-v2s-terminal-skeleton-implementation-plan-codex.md`：需求、详设与计划；
- `apps/terminal/skeleton-graph.ts`、assembly 的 `index.ts`/`App.tsx`/`src/skeletonBootstrap.ts`/`src/moduleName.ts`/`package.json`/`src/dependencies.ts`：22 包规格、入口与正式边；
- 五个 `apps/terminal/adapter/android/*` 的 Expo config、Android source 与 Kotlin Module：最小原生形态；
- `tools/terminal-skeleton/`：TER-local 静态/verify 实现；
- `doc/evidence/platform/terminal-skeleton/batch-1/cp7-android-device-codex.md` 与 `doc/evidence/platform/terminal-skeleton/batch-2/cp8-batch2-skeleton-codex.md`：历史 14 包与当前最终证据；
- `.runtime/terminal-skeleton/batch-2/device-final/` 下 `final-device-acceptance.log`、`expo-run-android-final.log`、`runtime-assertions.log`、`ui.xml`、`module-names-expected.log`、`module-names-rendered.log`、`screen.png`、`logcat-app-assertion.log`、`cleanup.log`、`ter-verify-post-device.log`、`ter-generated-residue-after-verify.log`：新增运行原始证据。

请重点核验：模拟器 serial/model/SDK；原始输出中的 BUILD SUCCESSFUL、5 个 adapter autolinking、APK 安装、MainActivity 打开、Android Bundled 761 modules；UI hierarchy 与当前 22 个 moduleName 的 exact-set；目标 PID 无 fatal/JS error（区分平台 warning）；生成 android/.expo/Turbo 的可恢复清理；TER-only verify exit 0 与 cleanup PASS；以及 Kotlin 能力、业务能力、root scripts/verify 授权验收未完成且事故性静态首败不构成 PASS 的边界。另请扫描文档是否把旧的「批二未跑设备」、647/761 两个不同入口的 Metro 数字、受控 exit 130 或 22/22 typecheck 语义写错。

请给出明确 `GO` 或 `NO-GO`，并统计 `M` / `S` / `N`。每条 finding 请写精确路径/行号或节号、事实与证据、失败条件、后果、最小修复、更小替代为何不足、同族扫描及分类（`CONFIRMED` / `PARTIALLY_CONFIRMED` / `REJECTED_WITH_EVIDENCE` / `UNVERIFIED_REQUIRES_EVIDENCE` / `DEXTER_DECISION`）。请分层列出静态、类型、Metro、设备、Kotlin 与业务能力证据；无 finding 也要列明已核与未核。

授权边界：本轮只评审 TER 最终 22 包骨架及其新增一次性设备证据；不授权批三、任何终端能力实现、Kotlin 能力测试、双屏、杀进程重启、DEV、reset、seed、浏览器 L2、UAT、部署、EAS、仓级 scripts/verify 或任何 Git 操作。谢谢。
```

交付前执行：

```bash
scripts/check/claude-review-handoff --file doc/review/platform/2026-08-29-v2s-terminal-skeleton-final-device-implementation-review-request-codex.md
```
