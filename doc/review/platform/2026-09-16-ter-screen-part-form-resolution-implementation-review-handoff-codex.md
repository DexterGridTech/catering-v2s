# TER screenPart 机型解析 · implementation review handoff

```text
REVIEW_TARGET=IMPLEMENTATION
HANDOFF_STATUS=READY_FOR_IMPLEMENTATION_REVIEW
IMPLEMENTATION_STATUS=IMPLEMENTED_PENDING_DEXTER_CLAUDE_REVIEW
CODE_DESIGN_RECONCILIATION=MATCHED
V1_OBSOLETE_SOURCE_CLEANUP=NOT_NEEDED
```

## 背景

TER screenPart 机型解析需求已定稿，implementation-facing 详设、IA 与实施计划已获 Dexter
授权实施。本轮按计划先完成机制批 A-0～A-4（typed failure/ready、hydration/prune、pre-filter
冲突与 R-10a 声明拆分），再在机制批全范围三维对账 `MATCHED` 后完成 admin 批 B-1～B-3
（双形态 renderer、铺满/master-detail/wrap、a11y/focus/README）。

当前源码、测试、README、invariant 与 A-0 静态基线修复已逐文件对账；96 个实现清单行全部
`MATCHED`，记录见 `doc/review/platform/2026-09-16-ter-screen-part-form-resolution-code-design-reconciliation-codex.md`。
本 handoff 只请求 implementation review，不把实现结果预报为 implementation GO、整体
acceptance GO、visual PASS、Web PASS 或 release acceptance PASS。

上一轮 implementation-facing 复评的 M-4、S-6、N-4 已分别真修复：撤回错误的 wallpaper
匿名 PRIMARY 空路径并改用诚实的 synthetic nullable fixture；U-4b 从文件级 diff 收窄为
具名既有用例实现/断言逐字不变；hydrated-container-not-renderable 使用对其他机型与已退役/
未知都成立的中性文案，未增加 metadata 通道。

## 评审目标

请独立从当前源码与真实 evidence 核验：

1. typed content/system/transition failure、content-ready 后的 R-16 时序、nullable
   `readyPartKey` 是否沿 render → console-assembly writer → 两个 integration 完整传递；
2. hydration/prune、optional default、pre-filter overlap、filtered catalog、R-10a
   八条 admin 输入与双形态四 key 分母是否按详设落地；
3. admin laptop master-detail、mobile wrap、fill/bounded/card、a11y/testID/focus/close
   owner 是否仍符合 IA 与既有 sample journey；
4. 生产路径是否没有第二个 catalog、ready、startup.complete、scroll、failure seam 或
   公共兼容层；A-0 的 DEV descriptor 是否仍仅为诊断；
5. U1–U15 的 focused/static、授权 Android release 冷启动与冻结旅途 evidence 是否只在
   能证明的档位使用，Web/独立视觉/总体 acceptance 的 OPEN 是否诚实；
6. release 双屏冷启动实际证据是否足够，及 S-3 对旧 `run-a9-runtime.mjs` 的最终判断是否
   有事实依据。

## 需阅读文件

请从 catering-v2s 仓库根打开：

- `doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md`：需求正本、R/U/D 与 Dexter 裁决；
- `doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-implementation-design-codex.md`：implementation-facing 详设、D-1～D-15、U-1～U-15；
- `doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-ia-design-codex.md`：IA-01～IA-06、focus/a11y/失败恢复边界；
- `doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-implementation-plan-codex.md`：A/B 批次、CP 门、验证顺序与当前执行状态；
- `doc/review/platform/2026-09-16-ter-screen-part-form-resolution-code-design-reconciliation-codex.md`：96 个实际实现清单行的逐文件对账；
- `doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution-static-focused-codex.md`：静态首败、根因修复、最新 `verify:static` 与 focused 重验；
- `doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution/dynamic-release-and-frozen-journeys-codex.md`：四场 release U8 与四场 sample1/sample2 冻结旅途结果；
- `doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution/cleanup.md`：v1 作废源核查、运行资源归属与 cleanup；
- `doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution-cp1-execution-codex.md`：render/category/ready focused 与实际 red mutation；
- `doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution-cp2-execution-codex.md`：hydration/default/writer focused、首败与最小修复；
- `doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution-cp3-execution-codex.md`：pre-filter/filter/cross-form focused；
- `doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution-cp4-execution-codex.md`：R-10a 同组件 sibling 分母与零回归基线；
- `doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution-cp5a-execution-codex.md`、`doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution-cp5b-execution-codex.md`、`doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution-cp5c-execution-codex.md`：admin renderer、布局、a11y/focus/README focused；
- `doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp1-three-dimensional-reconciliation-beauvoir.md`、`doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp2-three-dimensional-reconciliation-euler.md`、`doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp4-three-dimensional-reconciliation-anscombe.md`、`doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp5a-three-dimensional-reconciliation-hooke.md`、`doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp5b-three-dimensional-reconciliation-planck.md`、`doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp5c-three-dimensional-reconciliation-pascal.md`：fresh 步骤级三维对账；
- `doc/review/platform/2026-09-16-ter-screen-part-form-resolution-mechanism-batch-reconciliation-gibbs.md`、`doc/review/platform/2026-09-16-ter-screen-part-form-resolution-b-batch-reconciliation-jason.md`：A/B 全批三维对账；
- `doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp3-three-dimensional-reconciliation-main-fallback.md`：CP-3 fresh reviewer 重复无响应后的主 agent 兜底，明确不是 fresh verdict；
- `doc/review/platform/2026-09-16-ter-screen-part-form-resolution-post-fix-startup-readiness-ports-reconciliation-codex.md`：release 首败后实际 binding predicate 的修复复核；
- `doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/s3-run-a9-current-20260915.md` 与 `doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/a9-runtime-first-failure-repair.md`：S-3 旧 A9 runner 当前复跑首败、cleanup 与升级判断；
- `tools/terminal-sample2/run-u8-release-cold-start.mjs`、`tools/terminal-sample2/run-sample1-frozen-journey.mjs`、`tools/terminal-sample2/run-sample2-frozen-journey.mjs`：当前 release/frozen record-only runner；
- 关键 owning source：`apps/terminal/ui/base/render/src/components/resolvePart.ts`、`apps/terminal/ui/base/render/src/components/ScreenContainer.tsx`、`apps/terminal/ui/base/render/src/components/ScreenReadyBoundary.tsx`、`apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx`、`apps/terminal/kernel/base/ui-state/src/features/actors/contentActors.ts`、`apps/terminal/ui/base/admin-shell/src/parts/parts.ts`、`apps/terminal/ui/base/admin-shell/src/hooks/useAdminSections.ts` 及 reconciliation 中的完整文件清单。

## 独立核验重点

### 1. Fresh 三维对账与实施顺序

当前 fresh 记录与边界如下：

| 范围 | 独立记录 | 结论 |
|---|---|---|
| CP-1 | `...cp1-three-dimensional-reconciliation-beauvoir.md` | `MATCHED` |
| CP-2 | `...cp2-three-dimensional-reconciliation-euler.md` | `MATCHED` |
| CP-3 | `...cp3-three-dimensional-reconciliation-main-fallback.md` | `MAIN_AGENT_FALLBACK_MATCHED_FOR_CP3_SCOPE`；fresh 工具连续失败，未冒充 fresh |
| CP-4 | `...cp4-three-dimensional-reconciliation-anscombe.md` | `MATCHED` |
| CP-5a | `...cp5a-three-dimensional-reconciliation-hooke.md` | `MATCHED` |
| CP-5b | `...cp5b-three-dimensional-reconciliation-planck.md` | `MATCHED` |
| CP-5c | `...cp5c-three-dimensional-reconciliation-pascal.md` | `MATCHED` |
| A whole batch | `...mechanism-batch-reconciliation-gibbs.md` | `MATCHED`；Fermat 的历史 OPEN 保留 |
| B whole batch | `...b-batch-reconciliation-jason.md` | `MATCHED`；Bohr 的历史 OPEN 保留 |
| post-fix ports | `...post-fix-startup-readiness-ports-reconciliation-codex.md` | `MATCHED` |

请确认步骤级对账、A/B 全批对账、最终逐代码对账没有互相替代，并确认 CP-3 fallback 的
真实状态被正确标注。项目规则允许在同一对账任务连续多次失败、主 agent 接管同一范围时继续
推进，但禁止将主 agent 结果称为 fresh independent verdict。

### 2. 命令与结果

#### static/focused

```text
yarn --cwd apps/terminal verify:static
RUN_ID=ter-local-static-52662-1789555282698
RESULT=PASS
READABILITY_MODEL=PASS
READABILITY_STATIC=PASS
TERMINAL_SKELETON_MODEL_TEST=PASS
TERMINAL_SKELETON_STATIC=PASS
TERMINAL_CONTRACTS_STATIC=PASS
TERMINAL_PLATFORM_PORTS_STATIC=PASS
TERMINAL_STATE_STATIC=PASS
TERMINAL_RUNTIME_STATIC=PASS
TERMINAL_DISPLAY_CONTEXT_STATIC=PASS
TERMINAL_UI_STATE_STATIC=PASS
TERMINAL_RENDER_STATIC=PASS
TERMINAL_LAYERING=PASS
TERMINAL_STATIC=PASS
```

当前 focused/typecheck 结果：

| 包/入口 | typecheck | test |
|---|---|---|
| `@catering-v2s/kernel-base-ui-state` | PASS | 6 files / 40 tests PASS |
| `@catering-v2s/ui-base-render` | PASS | 13 files / 76 tests PASS |
| `@catering-v2s/ui-base-console-assembly` | PASS | 2 files / 7 tests PASS |
| `@catering-v2s/ui-base-admin-shell` | PASS | 7 files / 16 tests PASS |
| `@catering-v2s/ui-base-primitives` | PASS | 1 file / 16 tests PASS |
| `@catering-v2s/ui-integration-sample-console` | PASS | 8 files / 38 tests PASS |
| `@catering-v2s/ui-integration-sample-wallpaper-console` | PASS | 4 files / 16 tests PASS |
| `node tools/terminal-ui-state/check-static.mjs` | — | PASS |
| `node tools/terminal-ui-render/check-static.test.mjs` | — | PASS |
| 两个 Android assembly package typecheck | PASS | — |

对应 CP evidence 保留了每次首败、最后已知成功、broken boundary、owning source 与最小修复。

#### release Android 冷启动与冻结旅途

当前 release APK：

| App | APK | bytes | SHA-256 |
|---|---|---:|---|
| sample-terminal | `apps/terminal/assembly/android/sample-terminal/android/app/build/outputs/apk/release/app-release.apk` | 88,537,001 | `e2360e5a4827bbcd86c8a1914904470915c58ffe01fd906491ae2f31e558e39c` |
| sample-wallpaper-terminal | `apps/terminal/assembly/android/sample-wallpaper-terminal/android/app/build/outputs/apk/release/app-release.apk` | 88,946,033 | `e87b9b2097de31225999c5edbdf76cd84cfcfe85e6e78206171f51e00a18c8c7` |

两个 APK 均以 `./gradlew assembleRelease --rerun-tasks --no-daemon --console=plain` 重建；
对应 build log 与安装 APK binding 位于 U8 evidence 目录。授权 runner 在 `emulator-5556`
手机形态与 `emulator-5554` 双屏形态运行：

- sample-terminal mobile/dual：`business=PASS`、`cleanup=PASS`；
- sample-wallpaper-terminal mobile/dual：`business=PASS`、`cleanup=PASS`；
- dual PRIMARY 为 2560×1600，SECONDARY 为 1280×720；mobile PRIMARY 为 720×1280；
- 四场结果的 `startup-order` 都有 `firstContentObservedAfterReadyCandidate=true`、
  `firstContentObservedAfterReadyHidden=true`、`provenReadyAfterRenderOwnedContent=true`、
  `settledSplashHidden=true`；logcat 保留 `startup.ready-candidate → startup.complete →
  startup.ready-hidden` 顺序及首个 RN 内容观察。

U8 当前结果路径：

- `doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution/u8-release-cold-start-post-fix/`：sample-terminal 当前 mobile/dual 结果；
- `doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution/u8-release-wallpaper-post-fix/`：sample-wallpaper-terminal 当前 mobile/dual 结果。

冻结旅途：

- sample1 mobile/dual：`doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution/sample1-frozen/mobile-normal/`、`dual-normal/`；
- sample2 mobile/dual：`doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution/sample2-frozen/mobile/`、`dual/`。

所有四场冻结旅途均保留当前 APK binding，断言既有 partKey/layerId/testID、业务 state、
认证/待确认冷重启恢复和 cleanup。它们不是 Web、visual 或总体 acceptance 证据。

### 3. 首败与根因修复

当前动态首败不是被重跑掩盖的：第一次联合 U8 的 wallpaper release APK 在
`StartupCompletionPrerequisitesMissing:group.ports` 失败；broken boundary 是
`consoleAssembly` 把 DEV-only port descriptor completion 当成 release readiness prerequisite。
主 agent 按 owning source 改为十个实际 `PlatformPorts` binding presence 检查，保留 descriptor
为 DEV 诊断；focused `descriptor-free` fixture、最新 static 与重新构建的 wallpaper release
U8 均通过，首败与当前结果分目录保留。详见 static-focused、dynamic 和 post-fix reconciliation。

### 4. S-3 旧 runner 判断

旧 `tools/terminal-sample2/run-a9-runtime.mjs` 的当前源码复跑真实首败为
`A9 mutated SECONDARY surface readback: timed out; logBytes=0`，runner 原始结果
`business=NOT_RUN`、`cleanup=FAIL`；其 owned app/reverse/Metro 后续单独清理为 PASS，不能改写
原始结果。源码与实验均证明它只有 Metro、单 serial、mutation-driven mobile SECONDARY 观察，
不能承担 release、双屏、首个 RN 内容、splash 时序或 failure-page 证据。因此按已定裁定④升级
为当前 `tools/terminal-sample2/run-u8-release-cold-start.mjs` record-only runner；当前 U8
已实际驱动两个 release APK 的 mobile/dual 冷启动，不新建第三个 runner。

### 5. U1–U15 focused 与 red fixture 状态

下面区分“当前 focused/静态行为已匹配”和“红夹具是否实际应用过”。`DEFINED_NOT_APPLIED`
不冒充真实 red；`UNENFORCEABLE_BY_MACHINE` 只表示需求本来要求 review-only。

| 判据 | 当前可执行结果 | red fixture 实际状态 | 证据 |
|---|---|---|---|
| U-1 | `MATCHED`：两 integration real assembly 的 form filter/section 集合 | `DEFINED_NOT_APPLIED`：allParts identity 变异未留在源码 | CP-3/CP-4 |
| U-2 | `MATCHED`：真实 sibling pre-filter overlap 对两形态拒绝 | `DEFINED_NOT_APPLIED`：生产源码未留 overlap 变异；test-local overlap fixture 已执行 | CP-3/CP-4 |
| U-3 | `MATCHED`：caller 只按 partKey，当前 renderer catalog 不含另一形态 | `DEFINED_NOT_APPLIED` | CP-4/CP-5a |
| U-4a | `MATCHED`：content failure 可见、带 key/form/container diagnostic | `RED_EXECUTED`：missing-catalog category 改为 system 后 focused test 红，已恢复 | CP-1 |
| U-4b | `MATCHED`：具名旧用例实现/断言不变，LayerStack 直接行为测试补足 | `DEFINED_NOT_APPLIED` 的 LayerStack availability 变异；现有层/持久化回归真实执行 | CP-1/CP-3 |
| U-5 | `MATCHED_FOR_FOCUSED`；像素可见/未裁剪仍 D-13 OPEN | `RED_EXECUTED`：content/system 错分支在 CP-1 红 | CP-1、dynamic |
| U-5b | `MATCHED`：content-ready 后再 system failure 使用运行期 testID | `RED_EXECUTED`：清零 readiness latch 后时序测试红，已恢复 | CP-1 |
| U-6 | `MATCHED`：invalid/non-renderable prune、nullable synthetic fixture、default 不写表 | `RED_EXECUTED`：移除 guard/prune 导致 3 条 hydration focused 回归红 | CP-2/static-focused |
| U-7 | `MATCHED_FOR_FOCUSED_AND_NORMAL_JOURNEYS`；异常设备路径不冒充 visual | `DEFINED_NOT_APPLIED` | CP-2、dynamic |
| U-7b | `MATCHED`：A-3 后真实 cross-form hydrated record prune/render-tree recheck | `DEFINED_NOT_APPLIED`；绕过 recheck 的路径未留在源码 | CP-3 |
| U-8 | `MATCHED_REVIEW_ONLY_AND_FOCUSED`：basename/registration source 可核 | `UNENFORCEABLE_BY_MACHINE`；不建命名机器门 | CP-5c、reconciliation |
| U-9 | `MATCHED_FOR_STRUCTURE`; visual full-screen/no-mask OPEN | `RED_EXECUTED`：LayerStack center/padding、root card/maxWidth 等 mutation 红 | CP-5b |
| U-10 | `MATCHED_FOR_STRUCTURE`; true same-screen/未裁剪 visual OPEN | `RED_EXECUTED`：root maxWidth/structure mutation 红 | CP-5b |
| U-11 | `MATCHED_FOR_FOCUSED_SELECTION`; 360×640 每入口视觉/触摸 OPEN | `RED_EXECUTED`：selected binding/role mutation 红 | CP-5c |
| U-12 | `MATCHED`：hook behavior + package-closure AST 禁止 surfaceForm read | `RED_EXECUTED`：加入 hook surfaceForm read 后 AST/behavior 红，已恢复 | CP-5a |
| U-13 | `MATCHED`：两 integration、两形态 real assembly 与冻结 identity | `DEFINED_NOT_APPLIED`；错误分母未留在源码 | CP-3/CP-4/CP-5c |
| U-14 | `MATCHED`：未过滤八条 admin input 与四条当前 form projection 分离 | `DEFINED_NOT_APPLIED`：删 input fixture 未留在源码 | CP-3/CP-4 |
| U-15 | `MATCHED`：四组 normalized catalog fields + binding tier/guard、renderer 唯一 | `DEFINED_NOT_APPLIED`：漏 guard/重复 renderer 变异未留在源码 | CP-4/CP-5a |

### 6. 证据档位

```text
STATIC=PASS
FOCUSED=PASS
NATIVE=PASS_FOR_AUTHORIZED_EMULATOR_OBSERVATIONS
ANDROID=PASS_FOR_RELEASE_APK_COLD_START_AND_FROZEN_JOURNEY_STATE
RELEASE=PASS_FOR_U8_COLD_START_AND_RECORD_ONLY_JOURNEYS; NOT_OVERALL_RELEASE_ACCEPTANCE
WEB=OPEN_NOT_RUN
VISUAL=OPEN; screenshots/measurements exist, no independent visual verdict
CLEANUP=PASS_FOR_ALL_CURRENT_U8_AND_FROZEN_RUNS
```

请勿把 release emulator 的启动时序证据扩大为真实物理硬件或视觉铺满结论；也请勿把旧
`u8-release-cold-start-post-fix/result.json` 中保留的首败 aggregate 当成当前 wallpaper
结果，当前 wallpaper 结果在 `u8-release-wallpaper-post-fix/`。

### 7. v1 作废文件与 cleanup

`doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution/cleanup.md` 记录了从仓根
搜索 v1/obsolete/deprecated 与当前 admin source consumer 的结果：没有具体存在的 v1 源文件可
安全删除；相似命名的 `AdminShell`、`AdminSectionNavigation`、form-specific renderer 仍有
live/public/compatibility owner。因此：

```text
OBSOLETE_V1_SOURCE_CLEANUP=NOT_NEEDED
DELETIONS_PERFORMED=NONE
UNKNOWN_PROCESS_ACTION=NONE
```

### 8. 重点处置记录

| finding | 结果 | 当前落点 |
|---|---|---|
| M-4 | 真修复 | design/plan 的默认与 PRIMARY owner 清单；U-6 使用 synthetic nullable fixture，不冒充当前匿名旅途 |
| S-6 | 真修复 | U-4b 具名用例逐字不变；`sampleAssembly.test.tsx` 其他计划内用例允许文件级 diff |
| N-4 | 真修复 | `contentActors.ts`/诊断使用中性 hydrated-container-not-renderable 文案，无 metadata 通道 |

## 期望结论

请给出明确的 `GO` 或 `NO-GO`，并报告 `M`（major）、`S`（significant）、`N`（note）数量。
每条 finding 请区分仓内源码事实、evidence 事实、推论和未证实假设，给出仓库相对路径与
精确行号/符号、影响面、最小修复建议及是否需要 Dexter 裁决；特别检查“缺陷真实发生时对应
判据是否会红”，不要只接受测试名或文档描述。若发现设计缺口而不是实现偏差，请标为
`DESIGN_GAP`；若发现仅 visual/Web 未执行，请保持对应证据档位 OPEN，不要升格为总体 NO-GO
或 PASS。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审 TER screenPart 机型解析本轮 implementation。

背景：TER screenPart 机型解析的 implementation-facing 详设、IA 与实施计划已获 Dexter 授权实施。主 agent 已完成机制批 A-0～A-4 与 admin 批 B-1～B-3，并在步骤级、A/B 全批三维对账之后完成逐代码与详设对账；逐代码对账 96 个实现清单行全部 MATCHED。上一轮 M-4、S-6、N-4 已真修复。本次只请求 REVIEW_TARGET=IMPLEMENTATION，不把当前结果预报为 implementation/acceptance GO。

目标：请从当前生产源码、focused/static evidence 与授权 Android release 冷启动/冻结旅途 evidence 独立核验 typed failure 与 ready 链、hydration/prune、pre-filter overlap、R-10a 八条 admin 输入、双形态 admin layout/a11y/focus、公共面与 owner 边界，以及 U-1～U-15 的执行体和证据档位。请特别检查每条判据在对应缺陷真实发生时是否会红；不要以测试名、退出码、作者自报数字或历史 review 代替源码/evidence。

请从仓库根阅读：
- doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md：需求正本与 Dexter 裁决；
- doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-implementation-design-codex.md：详设、D-1～D-15、U-1～U-15；
- doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-ia-design-codex.md：IA、a11y、focus、失败/恢复；
- doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-implementation-plan-codex.md：A/B 批次与门控；
- doc/review/platform/2026-09-16-ter-screen-part-form-resolution-code-design-reconciliation-codex.md：96 行逐代码与详设对账；
- doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution-static-focused-codex.md：最新 static/focused 与 group.ports 首败修复；
- doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution/dynamic-release-and-frozen-journeys-codex.md：release U8、双屏/手机与 sample1/sample2 冻结旅途；
- doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution/cleanup.md：v1 作废文件与 cleanup；
- doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp1-three-dimensional-reconciliation-beauvoir.md、doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp2-three-dimensional-reconciliation-euler.md、doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp4-three-dimensional-reconciliation-anscombe.md、doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp5a-three-dimensional-reconciliation-hooke.md、doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp5b-three-dimensional-reconciliation-planck.md、doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp5c-three-dimensional-reconciliation-pascal.md：fresh 步骤级对账；
- doc/review/platform/2026-09-16-ter-screen-part-form-resolution-mechanism-batch-reconciliation-gibbs.md、doc/review/platform/2026-09-16-ter-screen-part-form-resolution-b-batch-reconciliation-jason.md：A/B 全批对账；
- doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp3-three-dimensional-reconciliation-main-fallback.md：CP-3 主 agent 兜底边界，不是 fresh verdict；
- doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/s3-run-a9-current-20260915.md、doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/a9-runtime-first-failure-repair.md：旧 run-a9 当前复跑首败与 S-3 升级依据；
- tools/terminal-sample2/run-u8-release-cold-start.mjs、tools/terminal-sample2/run-sample1-frozen-journey.mjs、tools/terminal-sample2/run-sample2-frozen-journey.mjs：当前 release/frozen record-only runner；
- 关键源码：apps/terminal/ui/base/render/src/components/resolvePart.ts、apps/terminal/ui/base/render/src/components/ScreenContainer.tsx、apps/terminal/ui/base/render/src/components/ScreenReadyBoundary.tsx、apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx、apps/terminal/kernel/base/ui-state/src/features/actors/contentActors.ts、apps/terminal/ui/base/admin-shell/src/parts/parts.ts、apps/terminal/ui/base/admin-shell/src/hooks/useAdminSections.ts，以及逐代码对账列出的全部实现文件。

独立核验重点：
1. 确认 A/B 步骤级与全批 fresh 对账记录的边界；CP-3 是连续 fresh 工具失败后由主 agent 接管的 MAIN_AGENT_FALLBACK，不能被称为 fresh。
2. 复跑或核对 yarn --cwd apps/terminal verify:static 的 RUN_ID=ter-local-static-52662-1789555282698 及各 CP focused 结果；按 evidence 读取首败、broken boundary 和最小修复。
3. 核对两个 release APK 在 emulator-5556 mobile 与 emulator-5554 dual 的真实冷启动结果：sample-terminal 与 sample-wallpaper-terminal 各 mobile/dual 均 business=PASS、cleanup=PASS；dual PRIMARY=2560x1600、SECONDARY=1280x720；结果目录是 doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution/u8-release-cold-start-post-fix/ 与 u8-release-wallpaper-post-fix/。确认 logcat 与 startup-order 能区分 RN 内容出现、ready、startup.complete 和 splash hidden 的顺序，但不要把它升级成 visual 或总体 release acceptance。
4. 核对旧 tools/terminal-sample2/run-a9-runtime.mjs 的当前复跑首败 logBytes=0、business=NOT_RUN、cleanup=FAIL 及后续 owned cleanup；判断升级为 run-u8-release-cold-start.mjs 是否有充分源码与实验依据。
5. 逐条核对 U-1～U-15：当前 focused/static 是 MATCHED 的地方确认 owning source；red fixture 明确区分 RED_EXECUTED、DEFINED_NOT_APPLIED 与 UNENFORCEABLE_BY_MACHINE，不能把“定义了变异”写成“实际红过”。U-5/U-9/U-10/U-11 的视觉/像素/触摸未由结构测试冒充，Web=OPEN、VISUAL=OPEN。
6. 核对 M-4 的 staff-auth PRIMARY owner 事实、U-6 synthetic nullable fixture 的诚实边界、S-6 的具名用例粒度、N-4 的中性恢复文案；核对 v1 作废源 search 结论 NOT_NEEDED，不能为了过门删除 live/public compatibility 文件。

请给出明确 GO 或 NO-GO，并报告 M/S/N 数量。每条 finding 请区分仓内事实、evidence 事实、推论与尚缺证据的假设，给出仓库相对路径、精确行号或符号、影响面和最小修复建议；如属产品/Journey/范围裁决请单独标“需 Dexter 裁决”。如果只是 Web、独立视觉或未授权档位尚未执行，请保留 OPEN，不要把它写成 PASS 或无依据的整体结论。

授权边界：本次只请对已实施的 TER screenPart 范围做 REVIEW_TARGET=IMPLEMENTATION 代码、契约、行为与 evidence 复核。implementation review 的 GO/NO-GO 不等于视觉、Web、真实物理硬件、整体 acceptance 或部署通过；不得修改源码、测试、脚本、依赖、构建产物或证据，不得启动 Web、Metro、DEV、seed、UAT、部署或额外扩大范围。Git 全程由 Dexter 控制。谢谢。
```
