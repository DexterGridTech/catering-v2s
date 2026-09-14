# TER terminal admin console implementation evidence

```text
REVIEW_TARGET=IMPLEMENTATION
EXECUTOR=MAIN_AGENT
EXECUTION_DATE=2026-09-12
AUTHORIZATION=source implementation, tests, necessary documentation, implementation evidence, and Dexter-authorized TER Web proof against the existing 8081 service
NOT_AUTHORIZED=additional Android/native runtime beyond prior recorded evidence, release build, backend DEV, seed, UAT, deployment, Git
IMPLEMENTATION_STATUS=SOURCE_AND_FOCUSED_REMEDIATION_COMPLETE_WITH_ANDROID_OPEN_BOUNDARIES
CODE_DESIGN_RECONCILIATION=MATCHED
INDEPENDENT_IMPLEMENTATION_REVIEW=NOT_RUN
VISUAL_ACCEPTANCE=NOT_RUN
```

本文是当前字节的实施证据记录，不是 design review 或 implementation review 的 GO，也不是 Web、Android、native、release 或 visual 验收。`FOCUSED_PASS` 只表示当前本地测试进程完成了对应行为；它不提升到其他证据档位。

## 1. 授权、恢复与边界

本次按仓库当前源码、`AGENTS.md`、`PLATFORM-BLUEPRINT.md`、选定 Roadmap 授权字段、六个 project-memory kernel、`scripts/README.md`、需求正本、Journey/IA/交互材料、详设和实施计划重新核对后实施。当前会话的直接 Dexter 授权覆盖本文件所列源码、测试和必要文档；Roadmap 中遗留的 `R3_IMPLEMENTATION_AUTHORIZED=false` 未被改写，也没有据此扩大范围。

实现范围保持需求 §11.3 的九步顺序：CP-01 形态来源、CP-02 系统键盘原子退役、CP-03 catalog/物理 host 来源与 layer 选择、CP-04 设备标识与口令、CP-05 调试态、CP-06 primitives、CP-07 承载态与动态生命周期、CP-08 admin-shell/生产注入、CP-09 证据收口。没有新增 backend、DB、migration、seed、transport gateway、第二 registry、第二 overlay stack 或第二 input pipeline。

本次源码 remediation 未新增启动或操作：Web、Android、DEV、seed、UAT、部署、native/Kotlin 运行、release build、视觉验收。历史 Android/native 结果只在后文明确标为历史档位；本次 Android/native 源码静态改动和已有 JS 测试不等于新的 Android/native 行为证据。

## 2. 首败与 last known good

最终包级复跑的首个失败是 sample-console typecheck：A-15 新增测试的
`apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx#findTextInput`
辅助类型漏声明读取的 `value`（TS2339）。生产代码和运行时测试没有因此失败。

最小修复是在同一测试辅助类型加入 `readonly value?: unknown`，随后：

- `yarn workspace @catering-v2s/ui-integration-sample-console typecheck`：exit 0；
- 同包 `test --run`：7 files / 33 tests，exit 0；
- 其余最终复跑中的包、静态门和行为门均以 exit 0 收口。

实施早期另有两类静态 first failure 已在进入后续 CP 前修复：platform-ports invariant 漏保留既有 `StateStorageWriteInput`，以及新增 render/ui-state public surface/依赖没有同步到当前静态门。修复的是 invariant、依赖声明和行为沙箱锚点，不是放宽门禁。行为 runner 输出的单项 `mutation_exit=1` 是故意破坏源码后应当变红的红夹具；每个 runner 最终都报告 baseline/红变异/cleanup PASS 并以 exit 0 退出，不应误读为业务失败。

## 3. 九步 stage proof 与三维 reconciliation

每个结果只在本实施范围内使用 `MATCHED` 或 `OPEN`。下表的 `MATCHED` 是主 agent 对需求、详设/IA/交互和已路由 memory 的当前字节对账，不替代 fresh 独立 implementation review。

| step | requirements ↔ design/IA ↔ memory 对账锚点 | 实际源码/测试锚点 | proof | reconciliation |
| --- | --- | --- | --- | --- |
| CP-01 | 需求 §3.1/CT-1/CT-2 ↔ 详设 CP-01 ↔ logical-canvas/display-context memory | `apps/terminal/ui/integration/sample-console/src/application/terminalSurfaces.ts#readTerminalSurfaces/parseTerminalSurfacePackage`; `.../assembly/assembly.tsx#createSurfaceForDisplayIndex`; dev-host `testExpoApp.tsx`; Android `App.tsx` | sample-console typecheck + 7 files/33 tests；dev-host 4 files/12 tests；静态 skeleton/readability | MATCHED |
| CP-02 | 需求 IN-1..IN-4/CT-3 ↔ 详设 CP-02 ↔ input/IME retirement memory | `ui/base/input` types/hooks/provider；`ui/base/primitives` props/vendor；`ui/base/render/foundations/surfaceHost.ts`；Android Kotlin snapshot/coordinator sources | input 10 files/49 tests；primitives 13 tests；render 10 files/44 tests；dual-screen 7 tests；静态可读性 | MATCHED（Kotlin truth-table 未运行，见 A-28） |
| CP-03 | 需求 CT-1/CT-2/CT-4/CT-5 ↔ 详设 catalog/host flow ↔ selector/display-context memory | `kernel/base/ui-state` catalog/module/actor；`render` `definePart/resolvePart/LayerStack/ScreenContainer/SurfaceRoot`；`surfaceHost.ts`; dev-host/Android adapter | ui-state 6 files/32 tests；render/adapter/dev-host/sample tests；ui-state/render/skeleton/display static | MATCHED |
| CP-04 | 需求 ID-1/ID-2/AC-2 ↔ 详设 device/password boundary ↔ device identity/privacy memory | `platform-ports` device types/normalizer/factory；Android JS/Kotlin device module；`admin-shell/foundations/adminPassword.ts`; sample assembly startup | platform-ports 5 files/18 passed + 1 skipped；Android device 2 tests；admin-shell 6 tests；sample identity focused test | MATCHED（Android persistence/permission runtime 未运行） |
| CP-05 | 需求 DBG-1..DBG-6 ↔ 详设 runtime facts ↔ debug/privacy memory | `render/src/types/runtimeFacts.ts`; `RenderProvider/RenderContext`; sample assembly runtime-facts diagnostic；`RuntimeSection` | runtime facts 9-row matrix in render suite；sample debug/password privacy focused test；runtime behavior 6 tests | MATCHED（release 未运行） |
| CP-06 | 需求 PR-1..PR-7/CT-7 ↔ 详设 primitives/token/list boundary ↔ frontend foundation/input memory | `primitives/src/types`, components, vendor slots, theme tokens, index；sample/member/staff consumers；Chinese README | primitives 13 tests/typecheck；readability static；primitives behavior baseline/red/cleanup；N-2 100-row proof | MATCHED |
| CP-07 | 需求 AC-3A/§3.3 ↔ 详设 loading/identity lifecycle ↔ logical-canvas/recovery memory | `SurfaceHostController/SurfaceRoot/SurfaceContext`; `bindSurfaceHostIdentity`; `AdminLayer` four-value effect; sample geometry-only and replacement fixtures | render loading/focus/lifecycle tests；sample dynamic and same-value snapshot tests | MATCHED（Web/Android lifecycle 未运行） |
| CP-08 | 需求 AC-3/AC-5/AC-6/AC-5.7 ↔ IA/Journey/admin contract ↔ admin UI ownership memory | `admin-shell` components/foundations/parts；`adminShellAssembly`; sample `createSampleDefinedParts`; real launcher/keypad/verify/tab/close/reopen | admin-shell 2 files/7 tests；sample 7 files/33 tests；production sample section through catalog | MATCHED（平台/display section 的完整 real-control path 仍在 A-21/A-22 partial） |
| CP-09 | 需求 §9/§11 ↔ 详设/实施计划证据矩阵 ↔ verification governance memory | static/behavior runners、本文 A matrix、计划 §13c | all listed runners exit 0；main-agent code↔design reconciliation | MATCHED；independent implementation review NOT_RUN/OPEN |

## 4. Code ↔ design reconciliation

当前改动的代码面按 capability owner 重新打开，不把聊天摘要、作者自报数量或 focused 文本当源码真相。以下是完整的 owner/consumer 锚点集合；每一行的结论只用 `MATCHED` 或 `OPEN`。

| owner area | current source anchors | design/IA obligation and consumer | result |
| --- | --- | --- | --- |
| terminal shape/integration | `sample-console/src/application/terminalSurfaces.ts#parseTerminalSurfacePackage`; `sample-console/src/assembly/assembly.tsx#SampleAssembly`; `dev-host/src/components/testExpoApp.tsx`; `assembly/android/sample-terminal/App.tsx` | declaration owns `surfaceForm`; physical index survives integration; canvas remains display-mode keyed; portrait rejects SECONDARY | MATCHED |
| UI-state catalog | `kernel/base/ui-state/src/types/catalog.ts#UiCatalogEntry`; `foundations/catalog.ts#createUiCatalog/selectAvailableParts/isUiCatalogEntryAvailable`; `createUiStateModule.ts`; `contentActors.ts#createOpenLayerActor` | exact nine catalog fields; layer-only `containerKeys=[]`; one state-derived form source; typed no-write admission rejection | MATCHED |
| render catalog | `ui/base/render/src/foundations/definePart.ts`; `components/resolvePart.ts`, `LayerStack.tsx`, `ScreenContainer.tsx` | catalog and renderer halves stay separate; shared availability predicate is render defense only; no admin metadata in catalog | MATCHED |
| physical host transfer | `render/src/foundations/surfaceHost.ts#bindSurfaceHostIdentity`; `SurfaceRoot.tsx`; `SurfaceContext.ts`; dev-host `webSurfaceHost.ts`; Android adapter/Kotlin snapshot | `isHostPrimaryDisplay` comes from physical index; frozen identity is `{surfaceKey,displayIndex,surfaceForm,displayMode}`; identity comparison is four scalar values | MATCHED |
| input retirement | `ui/base/input/src/types/types.ts`; `useInputField.ts`; `useInputFocusController.ts`; `InputProvider.tsx`; primitives `PrimitiveInput.tsx`/`vendor/slots.tsx`; render/Android IME sources | one virtual keyboard owner; nullable native ref; public `showSoftInputOnFocus` absent; system IME contract removed as one atomic group | MATCHED |
| device/runtime facts | `platform-ports/src/types/device.ts`; `normalizeDeviceIdentity.ts`; `createPlatformPorts.ts`; Android device module; `sample-console/src/assembly/assembly.tsx` | one startup `getDeviceInfo` read per assembly; synchronous pure derivation; capability status is method-level; debug can be enabled independently of `__DEV__`/environment mode | MATCHED |
| primitives/vendor/theme | `primitives/src/index.ts`, `types/types.ts`, `components/*`, `vendor/slots.tsx`, `theme/tokens.ts`, `foundations/toneClassName.ts` | required bounded primitive set, semantic tone matrix, vendor-only RN/SVG values, fixed list bound 24, no overlay/input owner | MATCHED |
| admin shell identity/focus | `admin-shell/src/foundations/adminIdentity.ts`; `components/AdminLayer.tsx`; `AdminLauncher.tsx`; `AdminLogin.tsx`; `AdminShell.tsx` | local admin constants; existing closeLayer command; four scalar effect deps; effect-closure previous-mode cleanup; ancestor touch observer with logical coordinate conversion; admin focus scope; real controls | MATCHED |
| admin catalog/production injection | `admin-shell/src/parts/parts.ts`; `adminShellAssembly`; `sample-console/src/assembly/assembly.tsx#createSampleDefinedParts` | one catalog projection; three built-in read-only sections; one production sample title-only section; no second registry/list | MATCHED |
| loading/dynamic proof | `SurfaceHostController.tsx`; `surfaceHost.ts#bindSurfaceHostIdentity`; `sampleAssembly.test.tsx` geometry/replacement/focus/host-rejection/in-flight/persistence tests | explicit loading indicator with no children before readiness; contradictory physical host fact is typed/logged; same-value snapshot preserves admin; identity replacement removes only admin and recomputes geometry | MATCHED |
| package/invariant/tools | `skeleton-graph.ts`; package manifests; terminal invariants; terminal static/behavior runners | graph and package edges exact; invariant/public surface synchronized; red mutations remain real and cleanup is separate | MATCHED |
| documentation | implementation design/IA/plan; `admin-shell/README.md`; this evidence file | implementation status and evidence tiers are distinct; Chinese README gives定位、作用、结构、用法与迭代指引 | MATCHED |

Unrelated dirty backend files and unrelated documents visible in `git status` were preserved and are not part of this TER implementation reconciliation. No Git operation was requested or performed.

## 5. Fresh command evidence

“Fresh” below means a new main-agent command/test process in this task. It does not mean a fresh independent subagent review.

### Package typecheck/test

| package | command result |
| --- | --- |
| `@catering-v2s/kernel-base-ui-state` | typecheck PASS; 6 files / 32 tests PASS |
| `@catering-v2s/kernel-base-platform-ports` | typecheck PASS; 5 files / 18 passed + 1 skipped PASS |
| `@catering-v2s/ui-base-input` | typecheck PASS; 10 files / 49 tests PASS |
| `@catering-v2s/ui-base-primitives` | typecheck PASS; 1 file / 13 tests PASS |
| `@catering-v2s/ui-base-render` | typecheck PASS; 10 files / 46 tests PASS |
| `@catering-v2s/ui-base-admin-shell` | typecheck PASS; 2 files / 7 tests PASS |
| `@catering-v2s/ui-base-dev-host` | typecheck PASS; 4 files / 12 tests PASS |
| `@catering-v2s/ui-integration-sample-console` | typecheck PASS; 7 files / 33 tests PASS |
| `@catering-v2s/adapter-android-device` | typecheck PASS; 1 file / 2 tests PASS |
| `@catering-v2s/adapter-android-dual-screen` | typecheck PASS; 1 file / 7 tests PASS |
| `@catering-v2s/assembly-android-sample-terminal` | typecheck PASS; Android runtime not run |
| `@catering-v2s/ui-feature-sample-member-desk` | typecheck PASS |
| `@catering-v2s/ui-feature-sample-staff-auth` | typecheck PASS |

### Static gates

| command | result |
| --- | --- |
| `node tools/terminal-skeleton/check-static.mjs` | PASS: graph, naming, dependency completeness, reducer boundary, scaffold hygiene |
| `node tools/terminal-readability/check-static.mjs` | PASS: TR-R02..TR-R07 |
| `node tools/terminal-display-context/check-static.mjs` | PASS: 4 gates + support |
| `node tools/terminal-platform-ports/check-static.mjs` | PASS: 4 gates + support |
| `node tools/terminal-contracts/check-static.mjs` | PASS: 4 gates + support |
| `node tools/terminal-runtime/check-static.mjs` | PASS: 5 gates + support |
| `node tools/terminal-state/check-static.mjs` | PASS: 4 gates + support |
| `node tools/terminal-ui-state/check-static.mjs` | PASS: 8 gates + support |
| `node tools/terminal-ui-render/check-static.mjs` | PASS: 7 gates + support |

### Focused behavior gates

| command | result and cleanup |
| --- | --- |
| `node tools/terminal-display-context/check-behavior.mjs` | baseline PASS; intentional secondary-surface red mutation PASS; cleanup PASS; process exit 0 |
| `node tools/terminal-runtime/check-behavior.mjs` | baseline PASS (6 tests); four intentional red mutations PASS; cleanup PASS; process exit 0 |
| `node tools/terminal-ui-state/check-behavior.mjs` | baseline PASS (13 tests); all catalog/state red mutations PASS; cleanup PASS; process exit 0 |
| `node tools/terminal-ui-render/check-behavior.mjs` | baseline PASS (44 tests); 26 red vectors PASS; cleanup PASS; process exit 0 |
| `node tools/terminal-ui-primitives/check-behavior.mjs` | baseline PASS; theme-token red mutation PASS; cleanup PASS; process exit 0 |

## 6. A-1..A-59 actual execution matrix

Status definitions: `FOCUSED_PASS` means the named local focused scenario ran; `STATIC_PASS` means the current source/static proof ran; `PARTIALLY_EXECUTED` means only the listed local portion ran and another requirement half remains open; `NOT_RUN` means no evidence was collected for that requirement half. No row below is promoted across evidence tiers.

| ID | actual status | current evidence / boundary |
| --- | --- | --- |
| A-1 | PARTIALLY_EXECUTED | sample real primary launcher and physical non-host absence; no single component test covering both gate inputs |
| A-2 | NOT_RUN | Android primary/secondary device gesture path not authorized/run |
| A-3 | FOCUSED_PASS | `admin-shell/test/adminLauncher.test.ts` constants, bounds, expiry, five-press window |
| A-4 | PARTIALLY_EXECUTED | focused production assembly proves non-equal enlarged/reduced host scales and logical inside/outside points; Android real host-window action remains OPEN |
| A-5 | FOCUSED_PASS | `sampleAssembly.test.tsx#cleans only admin state...` opens admin while business layer exists |
| A-5A | FOCUSED_PASS | production assembly places a real `sample.auth.login:submit` descendant under the plain `AdminLauncher` observer; invalid credentials reach the real business action before the five-touch threshold, and the five logical touches still open admin |
| A-6 | PARTIALLY_EXECUTED | `AdminLogin` one string/native-less numeric field plus real keypad; no dedicated tree-count assertion |
| A-7 | PARTIALLY_EXECUTED | password pure vectors and three-hour window ran; full UI max-length/backspace/error path not separately run |
| A-8 | PARTIALLY_EXECUTED | fallback/debug path and pure rejection ran; clock-error versus wrong-password UI focused case not separately run |
| A-9 | PARTIALLY_EXECUTED | sample logger capture proves no password in JS events; native Log/Android half not run |
| A-10 | FOCUSED_PASS | real close then launcher reopen returns to `AdminLogin` |
| A-11 | PARTIALLY_EXECUTED | AdminShell source and real shell render ran; exact five direct-member set not separately asserted |
| A-12 | PARTIALLY_EXECUTED | typed section command rejection and real section switch ran; complete context-type matrix not separately run |
| A-13 | PARTIALLY_EXECUTED | layer-only catalog entry/static path and local render ran; physical root measurement/outside click Android half not run |
| A-14 | FOCUSED_PASS | production assembly holds `getDisplayInfo` after startup, opens admin while `submitMemberCommand` is in flight, then releases it; command completes and business screen/layer remain alongside admin |
| A-15 | FOCUSED_PASS | real business input focus → launcher → native-less admin field/key → blocked business focus → close → restored business focus |
| A-16 | FOCUSED_PASS | recording `persistKv`/`persistSecure` wrappers observe post-open/section writes; serialized values contain neither `admin.console` nor `sample.console.admin-test` |
| A-17 | STATIC_PASS | admin-shell source placement/import scan and readability gate |
| A-18 | FOCUSED_PASS | the real `sample.console.admin-test` defined part is rendered by the mobile production assembly and the same catalog projection excludes it when the production entry is omitted; no fixture list is used |
| A-19 | PARTIALLY_EXECUTED | immutable exact catalog/definePart tests and red mutations ran; full registration-order adversary is not a standalone focused test |
| A-20 | FOCUSED_PASS | mobile production assembly renders the injected section; laptop production assembly rejects the same layer part with `ERR_TER_UI_STATE_LAYER_PART_UNAVAILABLE` before state write |
| A-21 | PARTIALLY_EXECUTED | runtime/sample section real navigation and source-backed section implementations exist; platform/display real navigation not separately run |
| A-22 | PARTIALLY_EXECUTED | method-level descriptor source and platform-port factory tests ran; unavailable-row section rendering was not separately injected/focused |
| A-23 | STATIC_PASS | section components have read-only source shape and no write-command imports; package/static checks pass |
| A-24 | PARTIALLY_EXECUTED | Android adapter source/JS tests, no new-permission/static source path checked; reboot/data-clear Android runtime not run |
| A-25 | FOCUSED_PASS | two fake identities, pure derivation/fallback vectors, and exactly-once-per-assembly `getDeviceInfo` test |
| A-26 | PARTIALLY_EXECUTED | unknown fallback and known rejection pure tests plus local console path; Web preview not run |
| A-27 | STATIC_PASS | system branch/public IME fields/file removal and static package checks; Kotlin runtime not run |
| A-28 | NOT_RUN | Kotlin before/after IME truth-table test exists but was not executed |
| A-29 | PARTIALLY_EXECUTED | public `showSoftInputOnFocus` absence and vendor fixed false statically/tested; real-device no-popup half not run |
| A-30 | NOT_RUN | scaled geometry/scroll threshold requires Android/native runtime |
| A-31 | FOCUSED_PASS | input suite native-less field receives virtual owner/key; integrated admin path also passes |
| A-32 | STATIC_PASS | readability/vendor import and primitive behavior gates pass |
| A-33 | STATIC_PASS | changed package README/invariant checks pass; admin-shell Chinese README present |
| A-34 | PARTIALLY_EXECUTED | semantic token source and primitive tests pass; no separate exhaustive twelve-token static runner |
| A-35 | STATIC_PASS | token-only color/source checks and readability gate pass |
| A-36 | FOCUSED_PASS | primitive disabled/busy callback and accessibility behavior suite passes |
| A-37 | FOCUSED_PASS | 100-row list scroll-transition test asserts full data, tail reachability and max 24 mounted |
| A-38 | STATIC_PASS | both legacy `controls.tsx` files removed and imports resolve to base primitives; readability pass |
| A-39 | STATIC_PASS | primitive host/global/platform-probe static rule passes |
| A-40 | PARTIALLY_EXECUTED | non-empty SVG path/render focused test and no-overlay static path; Web/Android render not run |
| A-41 | FOCUSED_PASS | terminal surface parser and assembly tests cover landscape groups, portrait rejection, declaration-derived form |
| A-42 | STATIC_PASS | Android App takes explicit form/direction input; Android runtime not run |
| A-43 | STATIC_PASS | catalog/definePart exact field tests and current production part inventory pass |
| A-44 | STATIC_PASS | physical-index host bool source chain and render/skeleton static gates pass |
| A-45 | STATIC_PASS | invariants, graph, dependency, device capability expectation, and SVG package static checks pass |
| A-46 | NOT_RUN | no laptop/mobile mounted-shell visual/member-set proof; visual/Web are not authorized |
| A-47 | PARTIALLY_EXECUTED | runtime facts matrix and local debug render pass; release bundle half not run |
| A-48 | PARTIALLY_EXECUTED | single runtime-facts source and non-admin `RuntimeSection` consumer are in source/tests; full consumer scan is static only |
| A-49 | PARTIALLY_EXECUTED | default-off/priority/frozen facts tests pass; no separate whole-repo write-path adversary |
| A-50 | FOCUSED_PASS | startup runtime-facts diagnostic includes debug source/enabled state |
| A-51 | PARTIALLY_EXECUTED | local logger serialization excludes displayed fallback password; native/release log surface not run |
| A-52 | PARTIALLY_EXECUTED | one assembly-owned `surfaceForm` slice/selector and consumer wiring pass; no standalone duplicate-source mutation |
| A-53 | FOCUSED_PASS | VICE + SLAVE local transition preserves host source/geometry behavior and removes admin correctly |
| A-54 | PARTIALLY_EXECUTED | real runtime section switch changes rendered content and hides sample; two-way back-and-forth not separately asserted |
| A-55 | FOCUSED_PASS | real close removes layer, business focus restores, real reopen returns login |
| A-56 | PARTIALLY_EXECUTED | production `definedParts` injects unique sample entry and selector removal hides it; no second mounted-shell removal case |
| A-57 | PARTIALLY_EXECUTED | dynamic replacement, previous-mode cleanup, business retention and same-value geometry snapshot pass; scroll-position oracle not separately asserted |
| A-58 | FOCUSED_PASS | render surface pending state exposes `ui-base-render:surface-host-loading-indicator` and suppresses children until ready |
| A-59 | PARTIALLY_EXECUTED | dev-host source/index mapping is statically and locally tested; Web runtime execution not authorized/run |

### N-2

`N-2=FOCUSED_PASS` in `apps/terminal/ui/base/primitives/test/primitives.test.tsx`: 100 records remain in the data source; scroll offsets are sampled across transitions; first and last rows are reachable; rendered rows never exceed 24. This is only a focused bounded-list proof. It is not a performance-headroom, Web, Android, native, release, or visual result.

## 7. Evidence-tier closeout

| tier | current result | what it does not prove |
| --- | --- | --- |
| static | PASS for listed static commands | no runtime behavior, device geometry, visual quality or release packaging |
| focused | PASS for listed local package/behavior tests; A matrix keeps partial rows explicit | no Web/Android/native/release/visual equivalence |
| Web | NOT_RUN / not authorized | no Web host bool, Web SVG, Web preview login or L2 proof |
| Android | NOT_RUN / not authorized | no dual-display, IME, scaled geometry, permission, persistence or real-device proof |
| native | NOT_RUN | no Kotlin execution or native Log proof |
| release | NOT_RUN | no production bundle debug/privacy proof |
| visual | NOT_RUN | no Dexter wireframe comparison or visual acceptance |
| cleanup | PASS for local test `finally`/`releaseRuntimeForTest` and behavior-runner temp cleanup | no managed DEV/Web/Android process cleanup was attempted or proved |
| freshness | new main-agent command/test processes; no independent subagent | does not satisfy the separate fresh independent implementation review gate |

## 8. Open boundaries and handoff

1. `INDEPENDENT_IMPLEMENTATION_REVIEW=NOT_RUN` remains open. This evidence file must not be presented as that review or as its replacement.
2. A-2/A-4/A-28/A-30 and other Android/native rows remain open because the current authorization explicitly excluded Android/native runtime. A-46/A-59 Web rows remain open for the same reason. Release and visual remain open.
3. Partial A rows are intentionally not upgraded to PASS by source existence, focused success, welcome text, prior review, arithmetic, or plan text.
4. The next implementation-review package must reopen current source and this evidence, then use a fresh independent adversarial reviewer. It must not claim an overall GO from this document.
5. No source, test, dependency, document, process, seed, deployment, or Git action outside the stated implementation authorization was performed.

## 9. Current dynamic-evidence addendum (Dexter authorization, 2026-09-12)

本节是对上文历史实施记录的追加，不改写其当时的授权元数据，也不把本节结果升级为 implementation review 或整体验收。Dexter 在本任务中直接授权完成动态证据收集；本节只记录实际运行过的档位和仍然 OPEN 的边界。

```text
DYNAMIC_AUTHORIZATION=DEXTER_CURRENT_MESSAGE_2026-09-12
DYNAMIC_EXECUTOR=MAIN_AGENT
DYNAMIC_SCOPE=focused, Android debug runtime with Metro, Android UI actions, native Kotlin unit test
DYNAMIC_NOT_RUN=Web, release runtime, visual verdict, DEV, seed, UAT, deployment
SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787
SOURCE_OR_TEST_FIXES_IN_THIS_ADDENDUM=NONE
OVERALL_ACCEPTANCE=OPEN_NOT_CLAIMED
```

### 9.1 Fresh focused results

以下仍是本机 focused 证据，不是 Web、Android、native、release 或 visual PASS。每个 runner 都保留了自己的日志，预期红变异的 `mutation_exit=1` 不被当作业务失败。

| run | 实际结果 | 证据 |
| --- | --- | --- |
| display-context | baseline PASS；secondary red mutation PASS；cleanup PASS | `.runtime/terminal-admin-console/dynamic-20260912T011827Z/display-context.log` |
| runtime | baseline PASS（6 tests）；4 个红变异均 PASS；cleanup PASS | `.runtime/terminal-admin-console/dynamic-20260912T011832Z/runtime.log` |
| ui-state | catalog/state baseline PASS；红变异 PASS；cleanup PASS | `.runtime/terminal-admin-console/dynamic-20260912T011842Z/ui-state.log` |
| ui-render | baseline PASS（44 tests）；26 个红向量均 PASS；cleanup PASS | `.runtime/terminal-admin-console/dynamic-20260912T011900Z/ui-render.log` |
| ui-primitives | baseline PASS；theme-token red mutation PASS；cleanup PASS | `.runtime/terminal-admin-console/dynamic-20260912T011947Z/ui-primitives.log` |
| terminal package | `yarn --cwd apps/terminal test` exit 0；Turborepo 21/21 successful | `.runtime/terminal-admin-console/dynamic-20260912T011958Z/terminal-package-tests.log` |

### 9.2 Native test：真实失败，未修复

Android dual-screen native unit test 已实际执行，不再保持历史的 `NOT_RUN` 口径：

```text
./gradlew --no-daemon :catering-v2s-adapter-android-dual-screen:testDebugUnitTest \
  --tests 'com.catering.v2s.terminal.adapter.android.dualscreen.TerminalSurfaceHostActivityHandlerTest'
RESULT=FAILED
TESTS=9_COMPLETED_1_FAILED
```

证据在 `apps/terminal/assembly/android/sample-terminal/android/.runtime/terminal-admin-console/android-20260912T012058Z/dual-screen-native-test.log`。失败项是 `TerminalSurfaceHostActivityHandlerTest.kt:78` 的 `reuses stable bounds for unchanged owner and unchanged host size`。当前源码的 `shouldReuseStableHostContext` 在 `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt:124-140` 同时比较宽和高；失败测试传入的高度与 stable snapshot 高度不同，测试名/期望与“unchanged host size”不一致。这个是当前字节支持的静态根因诊断，不是把实现自动判为正确，也没有在本任务中修改测试或源码。

该首败按 systematic-debugging 规则保留；此前已通过的测试 setup/其余 8 个完成项是 native 侧的 last known good，当前 native evidence status 为 `OPEN_FAILED`。没有以 typecheck、JS focused 或 Android 启动成功替代这个失败。

### 9.3 Android debug/双屏动态结果

#### 构建、安装与启动边界

- `./gradlew --no-daemon :app:assembleDebug` 实际成功，日志为 `apps/terminal/assembly/android/sample-terminal/android/.runtime/terminal-admin-console/android-20260912T012058Z/gradle-assemble-debug.log`，结果 `BUILD SUCCESSFUL`；随后安装到已识别的 `emulator-5554` 成功。
- 首次 Android 启动的 first failure 是 debug app 无法连接 `localhost:8081` 的 Metro，日志为 `.runtime/terminal-admin-console/android-runtime-20260912T012215Z/logcat.txt`。失败前已经取得 `am start -W`、进程身份和 native display/surface snapshot；这就是该次尝试的 last known good，不能归因于双屏源码失败。
- 仅针对这个已确认的启动前置条件，用同一受控运行启动 Metro，`http://127.0.0.1:8081/status` 返回 `packager-status:running`，再重启 app。Metro 与 Android 的证据分别在 `.runtime/terminal-admin-console/android-metro-20260912T014000Z/metro.log` 和 `.runtime/terminal-admin-console/android-runtime-20260912T014000Z/`。

#### 启动与双屏证据

Metro retry 中，当前 APK 成功加载 JS bundle，日志出现 `startup.complete`、`secondary-start-completed`、primary/secondary surface snapshot 与 layout：

- logical display 0 / primary：2560×1600 px，hardware density 320，render density 320；
- logical display 2 / secondary presentation：1280×720 px，hardware density 213，RN render density 仍为 320；
- primary canvas declaration：1280×800；secondary 的实际 presentation bounds：1280×720；
- Android logcat 和 SurfaceFlinger PNG：`primary-sf.png`、`secondary-sf.png`，以及后续 `primary-after-launcher.png`。

这些证明了本次 debug bundle 的双屏 surface 建立、物理显示测量和 bundle 启动；它们不证明全部 Android 业务验收或视觉验收。

#### 真实 UI actions

- 在 primary 上以真实点击完成五次 launcher 手势，hierarchy 出现 `terminal.admin:login`、`terminal.admin:password:*`、`terminal.admin:verify` 和 `terminal.admin:close`；结果保存在 `primary-after-launcher.xml`/`primary-after-launcher.png`。
- 真实点击 `terminal.admin:close` 后，`primary-after-close.xml` 只剩会员面（`已登记会员, 打开终端管理`），admin layer 不再存在；再次五击 launcher 后，`primary-after-reopen.xml` 再次出现登录层且六个口令位都是未填写。这一段可作为 Android 的关闭/再次打开动态证据，不能扩写为已认证。
- 两次认证复验均经真实虚拟键盘和真实 `验证` 控件：一次保留了完整入账后的 `primary-local-after-verify.xml`/PNG，一次保留了 UTC 假设的 `primary-after-utc-verify.xml`。两次都显示 `terminal.admin:login:error` 的“口令不正确”。第二次之前还按每一位读取 hierarchy 的已填写位数，确认最终六位确实入账；仍没有继续穷举口令，也没有记录原始设备标识或口令。
- 因认证未闭合，admin-shell 内的四个 section、导航后的内容变化、认证后关闭和认证后再次打开均为 `OPEN`；没有用欢迎文本、登录层出现或截图存在代替这些行为证明。

#### Android runtime finding / business boundary

本次 logcat 同时真实记录了 `state.persistence.hydrate.failure`、`state.persistence.failure` 和 `ui-state.content.persistence-failed`，原因是 `persistSecure.listKeys: adapter not injected`；该错误也以诊断条出现在 primary hierarchy/截图中。它说明当前 sample-console Android 运行的 protected storage adapter 尚未注入，导致 UI 内容持久化业务边界未闭合。该项为 `ANDROID_BUSINESS=OPEN`，没有清数据、seed 或擅自替换 adapter。

### 9.4 Cleanup

业务与 cleanup 分开收口：

- exact package `com.anonymous.sampleterminal` 经 `am force-stop` 停止，随后 `pidof` 无输出且 exit 1；
- 已移除本次明确建立的 `adb reverse tcp:8081`，`adb reverse --list` 为空；
- Metro 通过本次受控 PTY 会话发送 Ctrl-C 停止；随后 `curl http://127.0.0.1:8081/status` 失败，证明 8081 不再监听；PTY 返回的非零结果是 SIGINT 的会话结束状态，不被误报为业务测试失败；
- `scripts/env/check-runtime-resource-budget .runtime` 最终返回 `LIVE_MANAGED_PROCESSES=0`、`MANAGED_RSS_MB=0`、`STATUS=PASS`。

本次 Android app、Metro、reverse 和资源 cleanup 为 `PASS`。未停止或触碰未知 PID、未知端口进程，也没有清理用户既有运行环境。

### 9.5 Current evidence-tier status and A-matrix delta

| tier | current dynamic status | precise boundary |
| --- | --- | --- |
| static | PASS as recorded above | no runtime or visual promotion |
| focused | PASS; cleanup PASS | local only |
| Android | `PARTIAL_OPEN` | bundle/surface/launcher/login/close/reopen observed；认证、section 行为、protected persistence 未闭合 |
| native | `OPEN_FAILED` | 9 native tests completed, 1 failed at the named test line |
| Web | `NOT_RUN_OPEN` | current TER task has no approved Web runner/evidence path |
| release | `NOT_RUN_OPEN` | no release runtime/bundle proof collected |
| visual | `NOT_RUN_OPEN` | screenshots are raw artifacts, no visual verdict or wireframe comparison |
| cleanup | PASS | app, Metro, reverse and managed resource budget verified |

动态结果对 A-matrix 的增量只收窄边界，不重写原表的历史状态：

- `A-1/A-3`：Android primary launcher 的真实五击与 admin login 出现已观察；非 host/手势隔离未证明。
- `A-6/A-7/A-8`：native-less input、真实 keypad、六位边界和错误反馈已观察；认证成功、时钟错误 UI 与完整失败恢复未闭合。
- `A-10/A-55`：Android 真实关闭、admin layer 消失、再次打开回到空登录态已观察；不包含认证后路径。
- `A-11/A-21/A-54/A-56`：因认证未闭合，shell section 导航和四个生产 catalog section 的 Android mounted consumer 仍为 OPEN。
- `A-28`：不再是未运行，而是 `OPEN_FAILED`；native truth-table 需要先处置上述测试期望/实现边界后重跑。
- `A-29/A-30/A-46/A-59` 及 release/visual 相关项仍按各自证据档位保持 OPEN，不能用本次 debug screenshot 或 focused 结果替代。

结论：本附录完成了当前授权下的动态证据收集与 cleanup，但不是 GO；当前 Android 业务与 native 两条明确 OPEN/失败边界必须在后续获得相应修复/授权后重新验证。没有进行源码、测试、依赖、seed、UAT、部署或 Git 修改。

## 10. Current dynamic-evidence closure after root-cause repairs (Dexter authorization, 2026-09-12)

本节是本轮同一动态授权的后续追加，保留 §9 的 first failure 与历史边界；它不把 focused、Android debug、native 或 raw screenshot 提升为 Web、release 或 visual 验收，也不替代独立 implementation review。主 agent 是唯一写入者；所有 UI 验证均经真实 Android 控件动作完成。

```text
DYNAMIC_AUTHORIZATION=DEXTER_CURRENT_MESSAGE_2026-09-12
DYNAMIC_EXECUTOR=MAIN_AGENT
DYNAMIC_SCOPE=focused, Android debug runtime with Metro, Android UI actions, native Kotlin unit test
DYNAMIC_NOT_RUN=Web, release runtime, visual verdict, DEV, seed, UAT, deployment
SOURCE_OR_TEST_FIXES_IN_THIS_ADDENDUM=YES
OVERALL_ACCEPTANCE=OPEN_NOT_CLAIMED
```

### 10.1 首败、根因与最小修复

| failure / boundary | 证据与根因 | 最小修复与同档复验 |
| --- | --- | --- |
| native dual-screen unit test | `TerminalSurfaceHostActivityHandlerTest` 的“unchanged host size”夹具把高度写成 `1200`，而生产 `shouldReuseStableHostContext` 以 stable width/height 与当前 host size 比较；失败是测试夹具与测试名自相矛盾，不是生产比较逻辑已被证明错误。 | 只把测试夹具高度修正为与 stable snapshot 一致的 `1600`，生产代码不动；同一 `:catering-v2s-adapter-android-dual-screen:testDebugUnitTest --tests ...TerminalSurfaceHostActivityHandlerTest` 复跑，`BUILD SUCCESSFUL`。日志：`apps/terminal/assembly/android/sample-terminal/android/.runtime/terminal-admin-console/native-20260912T120000Z/dual-screen-native-test.log`。 |
| Android native property update | 首次真实退出动作后，Android logcat 报 `Unsupported AccessibilityRole value: textbox` / `Invalid accessibility role value: textbox`，边界在 `apps/terminal/ui/base/primitives/src/components/PrimitiveInput.tsx` 的公共 primitive → RN Android `TextInput` 属性更新；`RnrTextInputProps` 的宽字符串类型不能证明目标平台接受该值。 | 去掉不受 RN 0.86 Android 支持的 `accessibilityRole="textbox"`，同时收窄 `apps/terminal/ui/base/primitives/src/vendor/slots.tsx` 的包装类型，并在 `apps/terminal/ui/base/primitives/test/primitives.test.tsx` 固定该 prop 不再下传。`primitives` focused `13/13 PASS`，重启 Android 后新 logcat 不再出现该异常；日志：`.runtime/terminal-admin-console/android-20260912T122000Z/primitives-focused.log` 与 `logcat-after-restart-fix.txt`。 |
| 认证观测失败 | 早期尝试一度被 LogBox 诊断层截住底排虚拟键，且在布局重排前复用了旧 `验证` 坐标；另一次 clean-source 尝试的最后一个真实数字没有落入。六位显示与按钮状态因此不能单独证明值序列正确。 | 按当前 UI hierarchy 的 bounds 逐次动作，真实点击已知 `Dismiss` 后再输入；每位读取 filled-count，最后用当前运行时同一 identity/clock 计算出的值走真实 `验证`。随后在 debug 开关撤回后的 clean bundle 再完成同一认证。认证成功 XML：`.runtime/terminal-admin-console/android-20260912T130000Z/admin-clean-final-auth.xml`。 |

上述认证诊断期间，`persistSecure` 仍按 assembly 的既有边界使用 unavailable default；logcat 的 `persistSecure.listKeys: adapter not injected` / `ui-state.content.persistence-failed` 是已记录的 protected-storage 能力缺失诊断，不通过注入明文存储或静默 catch 修复，也没有把它误报成 admin authentication failure。admin console 只读认证/导航路径在该边界下可继续工作；全局持久化能力仍不是本节的 PASS。

### 10.2 Focused 与 native 复验

| 档位 | 实际结果 | 证据 |
| --- | --- | --- |
| focused: primitives | `13/13 PASS`，包含 Android 不支持 role 不再下传的断言 | `.runtime/terminal-admin-console/android-20260912T122000Z/primitives-focused.log` |
| focused: admin-shell | `2 files / 6 tests PASS` | `.runtime/terminal-admin-console/android-20260912T122000Z/admin-shell-focused-final.log` |
| focused: sample-console | `7 files / 27 tests PASS` | `.runtime/terminal-admin-console/android-20260912T122000Z/sample-console-focused-final.log` |
| native Kotlin | `TerminalSurfaceHostActivityHandlerTest` 在夹具修复后 `BUILD SUCCESSFUL` | `apps/terminal/assembly/android/sample-terminal/android/.runtime/terminal-admin-console/native-20260912T120000Z/dual-screen-native-test.log` |
| Android debug build | `:app:assembleDebug` `BUILD SUCCESSFUL` | `apps/terminal/assembly/android/sample-terminal/android/.runtime/terminal-admin-console/android-20260912T122000Z/assemble-debug.log` |

### 10.3 Clean-source Android business path

APK/Metro 启动、双屏 surface 建立和 primary 的真实控件路径均实际执行。调试口令显示只用于同一 run 的校准诊断；每次诊断后已从 `apps/terminal/assembly/android/sample-terminal/src/assembly/platformPorts.ts` 撤回 `startupDebugMode` 临时输入，并以 clean bundle 重启确认 `DEBUG_PASSWORD_EXPOSED=0`。

| 场景 | 实际动作与断言 | 结果与证据档位 |
| --- | --- | --- |
| launcher → login | primary 真实五击 launcher；hierarchy 出现 `terminal.admin:login`、六个 password cell、`terminal.admin:verify` 与 `terminal.admin:close` | Android debug，PASS；`.runtime/terminal-admin-console/android-20260912T130000Z/admin-clean-final-login-no-logbox.xml` |
| login → authenticated shell | 真实虚拟键盘逐位输入、读取六位 filled-count、点击真实 `验证`；不调用内部 setter | clean Android debug，`CLEAN_SOURCE_AUTH=PASS`；`.runtime/terminal-admin-console/android-20260912T130000Z/admin-clean-final-auth.xml` / `.png` |
| production section navigation | 真实点击 `terminal.admin:section:sample-console`、`runtime`、`display-context`、`platform-ports`；每次 hierarchy 同时显示对应 selected button 与对应 production content testID。 | clean Android debug，PASS；`admin-clean-final-nav-sample.xml`、`admin-clean-final-nav-runtime.xml`、`admin-clean-final-nav-display-context.xml`、`admin-clean-final-nav-platform-ports.xml` |
| sample-console injection | `sample.console.admin-test` 真实出现在 admin shell 内容区，显示标题/空内容占位；没有第二份夹具 registry 或硬编码 section 列表 | clean Android debug，PASS；`admin-clean-final-nav-sample.xml` |
| close | 从认证后的 shell 真实点击 `terminal.admin:close`；hierarchy 不再含 `terminal.admin:login`、`terminal.admin:shell` 或 admin navigation，业务 `sample.auth.login` 保留 | clean Android debug，PASS；`.runtime/terminal-admin-console/android-20260912T130000Z/admin-clean-final-close.xml` |
| reopen | 再次真实五击 launcher；重新出现 login，未出现 shell，六个 password cell 全为 `○`，认证态未保留 | clean Android debug，PASS；`.runtime/terminal-admin-console/android-20260912T130000Z/admin-clean-final-reopen.xml` / `.png` |

这些 PNG 是原始 Android screenshot artifact，未做 wireframe/视觉相似度裁决；因此不构成 visual PASS。当前运行所见的 primary surface 是 2560×1600 physical frame、sample canvas declaration 1280×800；本节没有把它扩写成双屏 geometry、IME、真机或 release 证明。

### 10.4 A-matrix 动态增量与证据分档

- `A-1/A-3`：clean Android primary 五击 launcher 与登录层出现已 PASS；非 host 手势隔离、第二显示触控仍未跑。
- `A-6/A-7/A-8`：clean Android 真实 native-less keypad、六位边界、验证成功、错误反馈均已观察；时钟错误分支与全部失败恢复仍未单独执行。
- `A-10/A-55`：认证后的真实关闭和再次打开回空登录态在 clean Android 已 PASS；业务层/输入恢复的更广泛矩阵仍以 focused/static 证据为边界。
- `A-11/A-21/A-54/A-56`：四个 section 真实 navigation 与生产 `sample.console.admin-test` content 在 clean Android 已 PASS；不升级为视觉或 Web 证据。
- `A-18/A-20`：本节证明 sample section 由 production `definedParts` 进入同一 catalog 并在 mounted shell 真实可见；mobile-only 形态仍未在 Android 执行。
- `A-28`：native Kotlin focused test 已从历史失败修复至 PASS；这仍不是 Android 真机 IME truth-table 行为证明。
- `A-29/A-30/A-46/A-59` 以及 release/visual 相关项保持各自 OPEN；clean Android debug 不能替代这些档位。
- `N-2` 仍为 focused bounded-list PASS（100 rows / max 24 mounted）；没有新增性能、Web、Android、native、release 或 visual 结论。

| tier | 本轮最终口径 | 精确边界 |
| --- | --- | --- |
| static | PASS as previously recorded；本轮 source/test diff 已按 owning source 回读 | 不证明运行时全量或视觉 |
| focused | PASS；admin-shell、sample-console、primitives 与 native Kotlin 修复后均有新鲜结果 | 本机 focused，不外推 Web/Android/release |
| Android | `PARTIAL_PASS_WITH_OPEN_BOUNDARIES` | clean debug primary 的认证、四节导航、close/reopen PASS；双显示用户手势、scaled geometry、IME/no-popup、权限/数据清理、真机与 protected persistence 仍 OPEN |
| native | `PASS_FOR_NAMED_KOTLIN_UNIT_TEST` | 仅 named unit test；不外推 native device 或 Android IME |
| Web | `NOT_RUN_OPEN` | 本轮未启动 Web |
| release | `NOT_RUN_OPEN` | 未构建/运行 release runtime |
| visual | `NOT_RUN_OPEN` | raw PNG 未做视觉 verdict |
| cleanup | PASS | clean Android app、adb reverse、Metro 与 managed resource budget 均已再次核验 |

### 10.5 Final cleanup

最后一轮 clean-source run 的 cleanup 证据：

```text
APP_PID_AFTER_PRESENT=false
REVERSE_AFTER=none
APP_REVERSE_CLEANUP=PASS
METRO_PORT_8081_LISTENER=none
RESOURCE_BUDGET_CHECK_RC=0
LIVE_MANAGED_PROCESSES=0
MANAGED_RSS_MB=0
STATUS=PASS
```

日志：`.runtime/terminal-admin-console/android-20260912T130000Z/android-cleanup-final.log`、`.runtime/terminal-admin-console/android-20260912T130000Z/metro-cleanup.log`、`.runtime/terminal-admin-console/android-20260912T130000Z/resource-budget-final.log`。未停止未知 PID、未知端口进程，未执行 Web、DEV、seed、UAT、部署或 release/visual 验收。

结论：本轮授权的 dynamic business path、native named test 与 cleanup 已在修复后闭合；历史首败已保留并有根因修复和同档复验。TER admin console 的整体 implementation acceptance 仍保持 OPEN，原因是证据档位边界（Web、真机/未覆盖 Android 子项、release、visual）和独立 implementation review 仍未被本节替代。

## 11. Current implementation-review remediation (Dexter authorization, 2026-09-12)

本节记录上一份独立 implementation review 指出的 M-01、S-01、S-02、A-5A/A-4、A-14、A-16 和三条 note 的当前字节修复与同档复验。它覆盖本次修复后的源码，不回写历史首败；本节的 focused 结果不升级为 Android、Web、native device、release 或 visual 验收，也不替代下一轮独立 implementation review。

```text
REMEDIATION_AUTHORIZATION=DEXTER_CURRENT_MESSAGE_2026-09-12
REMEDIATION_EXECUTOR=MAIN_AGENT
REMEDIATION_SCOPE=source, focused tests, static checks, evidence/design/plan synchronization, latest S-01/N-01/N-02 follow-up
REMEDIATION_NOT_RUN=Web, new Android/native runtime, release, DEV, seed, UAT, deployment, visual verdict
REMEDIATION_REVIEWER=not this main-agent run; Claude independent review remains required
```

### 11.1 首败、根因、最小修复与同档结果

| finding / source anchor | 原失败 | 最小修复 | 当前结果与档位 |
| --- | --- | --- | --- |
| M-01 — `sample-console/src/assembly/assembly.tsx#sampleAdminTestPart` | sample section 与 laptop/mobile 形态没有真实区分；旧测试会把全开声明当作通过 | 只把真实 production `sample.console.admin-test` 的 `surfaceForm` 收窄为 `['mobile']`；不新增 registry/fixture | laptop production assembly 对同一 part 的 `openLayer` 在写入前返回 `ERR_TER_UI_STATE_LAYER_PART_UNAVAILABLE` 且层为空；mobile production assembly 经同一 catalog 渲染 section；`FOCUSED_PASS` |
| S-01 — `render/src/foundations/surfaceHost.ts#bindSurfaceHostIdentity` | 物理 host bit 与绑定 display index 矛盾时静默返回 null，和普通未就绪无法区分 | 增加冻结 typed `SurfaceHostIdentityRejection` 回调；sample integration 用现有 logger 记录原因/索引/期望值，不记录原始标识 | render focused mismatch test 收到一次 typed rejection；sample production assembly 同时保持 loading、无 canvas/launcher，并记录 `surface.host-identity-rejected`；`FOCUSED_PASS` |
| S-02 / A-5A — `admin-shell/src/components/AdminLauncher.tsx#AdminLauncher` | 独立不可见 `Pressable`/绝对覆盖层会消费业务区触摸；POC 原始宿主坐标还会在缩放画布上误判 | 将观察器改为包住 business content 的普通 `View`，不声明 press responder/消费回调；窗口页坐标经 `logicalPointFromWindow` 和宿主/画布比例换算后再进入纯 tracker | 真实 `sample.auth.login:submit` 在五击阈值前收到 invalid-credentials 动作并显示业务 notice；同一 wrapper 下五次逻辑触摸仍打开 admin；`FOCUSED_PASS` |
| A-4 — `admin-shell/src/foundations/adminLauncher.ts#logicalPointFromWindow` + sample assembly | 没有证明窗口像素框与逻辑画布框不同的 inside/outside 两向判定 | 固定生产装配坐标：canvas 1280×800 配 host 2560×1200（scaleX=2、scaleY=1.5）先以逻辑 (95,100) 验证拒绝，再以 (95,95) 验证命中；另以 host 640×400 的 (100,100) 验证缩小宿主拒绝 | 非等比组件路径实际覆盖两轴；错误复制 `scaleY=host.width/canvas.width` 的变异在 outside-y 断言处真实失败；恢复后 sample focused 通过；真实 Android 窗口动作仍 OPEN |
| A-14 — `sample-console/test/sampleAssembly.test.tsx` | admin 打开可能卸载/取消在途业务 command | 在 assembly 启动后的第二次 `getDisplayInfo` 读取上加测试 gate；admin 真实五击期间保持业务 command 在途，释放后检查完整业务结果与 state | `submitMemberCommand` 在 admin login 已出现时仍完成；`sample.desk.member-list` 与 `sample.desk.waiting-confirm` 及 admin layer 同时保留；`FOCUSED_PASS` |
| A-16 — `sample-console/test/sampleAssembly.test.tsx#createRecordingStorage` | 未直接观察持久化容器，无法排除 admin layer/selected section 被写入 | 仅在测试中包住既有 `persistKv`/`persistSecure`，不改生产持久化 owner；真实打开/选择 section 后读取写入值 | 当前写入存在且所有序列化值均不含 `admin.console` 或 `sample.console.admin-test`；`FOCUSED_PASS` |
| N-01 — `admin-shell/src/components/AdminLayer.tsx#useEffect` | 计划曾允许依赖不冻结的 previous-mode ref 形态 | 用 effect closure 直接捕获旧 `displayMode`；仍覆盖同态 identity 变化和旧 mode 子树卸载，仍调用既有 `closeLayer` | replacement/unmount 与同值 snapshot 的现有 focused 路径全绿；`STATIC + FOCUSED_PASS` |
| N-02 — `render/src/foundations/definePart.ts#definePart` | `surfaceForm` 直接保留输入数组引用，后续调用者可静默改 catalog | 与其他声明数组一致，`Object.freeze([...input.surfaceForm])` | catalog test 先修改输入数组仍保持冻结副本；`FOCUSED_PASS` |
| N-03 — `input/src/foundations/focusScope.ts#BUSINESS_FOCUS_SCOPE_ID` | `'business'` 在 input/admin-shell 多处重复，后续 scope 改名可漂移 | 从 input owner 导出唯一常量，替换同根消费点；无第二 scope owner | `rg` 只剩定义点和导入使用点；input/admin-shell focused/typecheck 通过；`STATIC + FOCUSED_PASS` |
| latest S-01 — `admin-shell/src/components/AdminLauncher.tsx#coordinateSpaceOf` + `sample-console/test/sampleAssembly.test.tsx` | 组件级测试只用等比宿主，宽度复制到 `scaleY` 的生产变异可以静默通过 | 保留正确的逐轴生产推导；在同一组件级 production assembly 先用非等比 host 的 `(95,100)` outside-y，再用 `(95,95)` inside，证明错误轴会红 | 坏变异首轮因只有 inside 点仍全绿；补 outside-y 后 1 assertion 真实失败（期望 0、实际 3 个 login）；恢复后 7 files/33 tests PASS；`FOCUSED_PASS + mutation RED` |
| latest N-01 — `sample-console/src/assembly/assembly.tsx#createSampleAssembly` + Android `platformPorts.ts#createSampleTerminalAssembly` | App、wrapper、assembly 三层各自默认 `laptop`，存在未来单点修改漂移 | 保留最外层 `App.tsx` 默认；把 wrapper/assembly 的 `surfaceForm` 改为必填并由调用者显式传递 | sample-console/Android typecheck PASS；所有当前 production/test call sites 均显式传值；`STATIC + FOCUSED_PASS` |
| latest N-02 — `sample-console/test/sampleAssembly.test.tsx#pressLauncher` | 辅助函数先调用生产坐标转换又丢弃结果，形成死代码与潜在同义反复 | 删除死调用；仅对实际传给 `onTouchEnd` 的 page 坐标做有限性断言，坐标仍由独立 canvas transform 反推 | sample-console 7 files/33 tests PASS；`STATIC + FOCUSED_PASS` |

### 11.2 当前新鲜命令结果

本节命令均为本轮新的 main-agent 进程；没有把历史 Android log 或既往 review 当作本轮 focused 结果。

本轮 remediation 的 first failure 是 sample-console typecheck：新增 A-15 集成夹具的
`findTextInput` 辅助类型没有声明读取的 `value`，触发 TS2339。该失败只发生在测试辅助类型层，
未被改写成生产行为失败；加入
`readonly value?: unknown` 后同包 typecheck/test 通过。这个修复后的四包复跑与静态骨架门是
本轮 remediation 的 last known good：sample-console 7 files/33 tests、admin-shell 2 files/7
tests、render 10 files/46 tests、input 10 files/49 tests，均 exit 0；扩展回归的 ui-state、
platform-ports、primitives、dev-host 与 skeleton static 也均 exit 0。此前中间运行暴露的
launcher 丢失 children、业务提交 notice 未出现和 wrapper remount 焦点丢失，均已分别完成根因
修复并包含在上述最终结果内，不应被压缩成“第一次就全绿”。

本次 follow-up 另保留一条故意变异的失败链。第一次把
`AdminLauncher.tsx#coordinateSpaceOf` 的 `scaleY` 暂时改成
`host.width / canvas.width` 时，旧的组件 fixture 只有非等比 host 下的 inside 点，
因此 7 files/33 tests 仍全绿；这不是通过，而是证明红夹具还不够。随后在同一生产 assembly
加入 `(95,100)` 的 outside-y 点后，第二次执行同一坏变异于 `sampleAssembly.test.tsx:328`
失败：期望 login 数为 0，实际为 3（1 file failed、1 test failed、32 passed）。恢复为
`host.height / canvas.height` 后，sample-console 复跑回到 7 files/33 tests PASS；这条
mutation RED→restore PASS 是 S-01 的可证伪证据，不是 Android 或视觉证据。

```text
13:17:28  yarn workspace @catering-v2s/ui-base-admin-shell typecheck && test
          typecheck=PASS, 2 files / 7 tests PASS
13:17:29  yarn workspace @catering-v2s/ui-base-render typecheck && test
          typecheck=PASS, 10 files / 46 tests PASS
13:17:28  yarn workspace @catering-v2s/ui-base-input typecheck && test
          typecheck=PASS, 10 files / 49 tests PASS
13:17:29  yarn workspace @catering-v2s/ui-integration-sample-console typecheck && test
          typecheck=PASS, 7 files / 33 tests PASS
13:13:23  kernel-base-ui-state typecheck/test=PASS, 6 files / 32 tests
13:13:23  kernel-base-platform-ports typecheck/test=PASS, 5 files / 18 passed + 1 skipped
13:13:23  ui-base-primitives typecheck/test=PASS, 1 file / 13 tests
13:13:23  ui-base-dev-host typecheck/test=PASS, 4 files / 12 tests
13:13:23  node tools/terminal-skeleton/check-static.mjs=PASS
13:39:14  baseline sample-console test run=PASS, 7 files / 33 tests
13:39:23  baseline admin-shell test run=PASS, 2 files / 7 tests
13:40:40  intentional bad mutation (`scaleY=host.width/canvas.width`)=RED at sampleAssembly.test.tsx:328; 1 failed / 32 passed
13:40:52  restored `scaleY=host.height/canvas.height`; sample-console test=PASS, 7 files / 33 tests
13:41:05  follow-up typechecks=PASS: sample-console, admin-shell, Android sample-terminal
```

### 11.3 当前 evidence 分档与下一轮边界

| 档位 | 当前修复结果 | 尚未证明 |
| --- | --- | --- |
| static | `PASS`；source、exports、invariants、dependency graph、README 与当前 test source 已回读 | 运行时平台行为、视觉质量 |
| focused | `PASS`；本节九项修复和本地回归均有新鲜结果，cleanup 由各测试 `finally`/`releaseRuntimeForTest` 完成 | 不外推为 Web/Android/native/release/visual |
| Android | 历史 §9/§10 的 `PARTIAL_PASS_WITH_OPEN_BOUNDARIES` 保持原口径；本节未启动 Android | scaled real-window A-4、第二 display 手势、IME/no-popup、真机/权限/protected persistence 等仍 OPEN |
| native | 历史命名 Kotlin 单测结果按 §10 保留；本节未新增 native run | 不外推为 native device/Android 行为 |
| Web | `NOT_RUN_OPEN` | Web host bool/geometry/SVG/L2 |
| release | `NOT_RUN_OPEN` | PROD bundle debug/privacy/keyboard proof |
| visual | `NOT_RUN_OPEN` | wireframe 对照与视觉 verdict |
| cleanup | `PASS_FOR_FOCUSED_RUNS` | 没有启动新的受管外部 runtime，因此没有新的外部进程 cleanup |

当前 remediation 的结论是：上述实现性 findings 已在当前源码中修复，并由 static/focused 同档证据闭合；整体 implementation acceptance 仍不是 GO，下一步需要 fresh 独立 implementation review 重新打开当前源码与本节证据。`CODE_DESIGN_RECONCILIATION` 的 current-byte 状态为 `MATCHED`；它不替代独立 reviewer 的 GO/NO-GO。

## 12. Shared keyboard placement API and current TER dynamic recheck (Dexter authorization, 2026-09-12)

本节记录用户追加的通用键盘呈现要求及其当前字节复验。两种呈现方式不是两套输入实现：
业务只选择 placement，字段 owner、provider、controller、键盘 renderer、按键动作与字符串状态保持同一份。
本节不把 focused、DOM/UI hierarchy 或截图升级为像素级 visual PASS。

    DYNAMIC_AUTHORIZATION=DEXTER_CURRENT_CONVERSATION
    DYNAMIC_EXECUTOR=MAIN_AGENT
    DYNAMIC_SCOPE=TER-only Web laptop/mobile, TER-only Android laptop, focused, static
    DYNAMIC_NOT_RUN=backend DEV, seed, UAT, deployment, release, visual verdict
    OVERALL_ACCEPTANCE=OPEN_NOT_CLAIMED

### 12.1 当前公共契约

| 业务选择 | 字段配置 | presenter 挂载点 | 尺寸/行为责任 |
| --- | --- | --- | --- |
| 独立弹出 | 省略 keyboardPlacement，默认 surface | InputSurfaceFrame 自动挂载一次 InputKeyboard placement=surface | surface frame 自己测量，业务不传尺寸、不写按键处理 |
| 非独立、局部呈现 | keyboardPlacement: field | 业务卡片/字段布局挂载一次同一个 InputKeyboard placement=field | presenter 自动测量局部父级宽度，业务不维护第二份值/焦点/键盘 |

实现锚点：

- apps/terminal/ui/base/input/src/components/InputKeyboard.tsx#InputKeyboard 是唯一业务键盘呈现入口；
- apps/terminal/ui/base/input/src/types/types.ts#InputKeyboardPlacement 与 InputKeyboardProps 是公共选择面；
- InputSurfaceFrame 只负责 surface placement，AdminLogin 只选择 field placement；
- placement 不一致时 presenter 返回空，不会同时出现 dock 与局部键盘；
- VirtualKeyboard 仍是 presenter 内部 renderer，业务 feature 不得直接拼接第二套键盘；
- src/index.ts、terminal-invariants.json、input README 与 implementation plan 的 keyboard 行已同步。

### 12.2 当前 focused/static 复验

当前字节重新执行：

    ui-base-input: typecheck PASS; 10 test files / 50 tests PASS
    ui-base-admin-shell: typecheck PASS; 2 test files / 8 tests PASS
    ui-integration-sample-console: typecheck PASS; 7 test files / 34 tests PASS
    tools/terminal-skeleton/check-static.mjs: PASS

input focused test 直接分别挂载 surface 与 field placement，均只得到一个
ui.base.input:virtual-keyboard；field placement 还用父级宽度 480 的 layout 回调验证了局部宽度重算。
这些结果证明公共 presenter 的 owner/rendering 形状，不证明 Android/Web 的全部视觉或设备行为。

### 12.3 Web 当前字节复验

TER Web 使用本地 sample-console Expo Web，独立 Playwright headed session；没有启动后台 DEV。

| 形态 | 真实动作 | 结果 |
| --- | --- | --- |
| laptop | 店员真实登录 → launcher 自身边缘位置五次真实 click → 真实六个虚拟键 → 真实验证按钮 | 登录层出现且键盘数量为 1；六位填满后进入 admin shell，验证后键盘数量为 0；PASS_FOR_BEHAVIOR |
| mobile | 临时只把 test-expo 入口显式设为 surfaceForm='mobile'，完成同一真实五击/六键/验证，随后删除临时行并 reload 回 laptop | 手持屏显示 360 × 800；登录框与局部键盘均出现且键盘数量为 1；六位填满后进入 shell；PASS_FOR_BEHAVIOR |

本次 Web 几何观测中，laptop 登录框与 keyboard 都是同一 login subtree 的局部 field
placement；mobile 也由同一 presenter 根据局部父级宽度布局，没有第二个 keyboard owner。
DOM bounding boxes 仅是当前窗口的运行时观测，不是批准 wireframe 下的逐像素视觉 verdict。

Web 事件层有一条已处理的 automation 首败：对 launcher 中心调用 locator click 会命中业务子节点，
五次动作不达 launcher 阈值；改为 launcher 自身边缘位置后五次真实 click 成功。该失败是事件目标定位，
不是把 product failure 改写为 PASS。当前 Web console 仍报告既有 persistSecure unavailable/default
诊断；它是 TER Web 的 protected-storage port 边界，未通过注入或静默 catch 掩盖。

### 12.4 Android laptop 当前字节复验

Android 使用 TER 独立 Metro/Pixel Tablet emulator（2560 × 1600）；没有启动 backend DEV。
为取得当前时间窗口的诊断向量，曾临时打开既有 debug 观测开关，随后已删除并以 clean source 重启。
debug hierarchy 只作校准，不作验收证据；clean hierarchy 明确没有
terminal.admin:debug-password。

产物目录：
apps/terminal/assembly/android/sample-terminal/android/.runtime/terminal-admin-console/android-20260912T172200Z/

| 场景 | 当前 clean 结果 | 证据 |
| --- | --- | --- |
| launcher → login | physical primary 坐标五击后出现真实 terminal.admin:login，六位 native-less field 与同一 ui.base.input:virtual-keyboard 均在 hierarchy | clean-login.xml |
| 六键输入 | 逐位用真实 Android keypad 控件输入，CLEAN_FILLED_COUNT=6，VERIFY_ENABLED=true | clean-input.xml |
| 认证 | 真实点击当前 clean verify 后 login 消失、terminal.admin:shell 出现，DEBUG_PASSWORD_EXPOSED_AFTER=0 | clean-auth.xml |
| 四节导航 | 真实点击 platform-ports/runtime/display-context/sample-console；每个 tab selected=true，对应内容文本存在 | nav-platform-ports.xml、nav-runtime.xml、nav-display-context.xml、nav-sample-console.xml |
| 关闭与再次打开 | 真实 close 后 login/shell 均消失；再次五击重新出现 login，且 debug password 不可见 | clean-closed.xml、clean-reopen.xml |

Android 运行期间曾有三类诊断输入：冷启动 host snapshot 到达而 JS 首帧仍停 loading 的时序首败、
错误使用物理坐标导致手势不在逻辑 96×96 区域、以及旧/错误动态口令。后两者已用当前 hierarchy
bounds 与当前时间窗口向量纠正；首类成功重启后恢复。它们均保留在本目录的历史 log/XML 中，不能被压成
“第一次即通过”。

### 12.5 证据档位与 cleanup

| 档位 | 当前口径 | 边界 |
| --- | --- | --- |
| static | PASS | 当前源码、公共 exports、invariants、README、计划矩阵与临时开关撤回均已回读 |
| focused | PASS | input/admin-shell/sample-console 与骨架静态门有新鲜结果 |
| Web | PASS_FOR_BEHAVIOR_WITHOUT_VISUAL | laptop/mobile 真实事件与认证通过；protected persistence 仍是 default unavailable 诊断，未做 visual verdict |
| Android | PARTIAL_PASS_WITH_OPEN_BOUNDARIES | 当前 clean laptop 的真实登录、键盘、认证、四节导航、关闭重开通过；第二显示触控、IME/no-popup、权限/数据清理、真机与 protected persistence 仍 OPEN |
| native | PASS_FOR_NAMED_KOTLIN_UNIT_TEST | 仅既有命名单测，不外推 Android IME/device |
| release | NOT_RUN_OPEN | 未执行 release bundle |
| visual | NOT_RUN_OPEN | 没有 Dexter 批准的 raster/wireframe reference；DOM/XML/PNG 不构成逐像素 PASS |
| cleanup | PASS_FOR_ANDROID; Web 服务按用户体验要求保留 | Android app、reverse 与本次 Android Metro 已按精确 owner 清理；TER Web Expo 进程保留在 8081，未停止未知进程 |

### 12.6 dev-host laptop/mobile 视角选择（当前 focused/static）

本轮把视角选择放在 TER 的 Expo Web dev-host 页面框架，而不是业务 assembly 内。宿主读取
`?surfaceForm=laptop|mobile` 作为启动选择；页面头部在存在 portrait 声明时显示一个包含两个可测
radio option 的视角 group，
切换后写入 URL 并用页面 reload 让下一次 assembly 从头以新形态初始化。无浏览器的 focused 回退
路径只用于验证宿主生命周期，会在内存中重建 fake assembly；生产 Web 路径不会在同一页面叠加第二个
runtime。laptop 的 `surfaceMode` 单屏／双屏 radio group 保持独立，mobile 不显示 SECONDARY 控件。

当前 owning source：

- `apps/terminal/ui/base/dev-host/src/components/testExpoApp.tsx#SurfaceFormSwitcher`：视角控件、URL
  读取/重启、有效形态回退、laptop/mobile surface group 选择；
- `apps/terminal/ui/base/dev-host/test/testExpoApp.test.tsx`：声明两种形态，执行真实 Pressable
  动作，断言 assembly 收到 `laptop` 后收到 `mobile`、PRIMARY 重建为 `360×800`、mobile 没有
  SECONDARY，且原有单屏／双屏生命周期不被改变；
- 两个 README、IA §3.8、implementation design §7 与 plan Step 1 已同步该契约；`SurfaceFormSwitcher`
  与 `SurfaceModeRadio` 共用 `SurfaceRadioOption`，每个选项输出 `role=radio` 与 `aria-checked`。

本轮命令与结果：

    yarn workspace @catering-v2s/ui-base-dev-host typecheck && test
    PASS: 4 test files / 13 tests
    yarn workspace @catering-v2s/ui-integration-sample-console typecheck && test
    PASS: 7 test files / 34 tests

首次 focused 失败是测试断言把 mobile 不挂载 SECONDARY 的生命周期期望写成了 `1/1`；日志和失败
边界表明生产实现已按 portrait PRIMARY-only 渲染，修正断言为 `0/0` 后同一测试进程复验通过。
这不是逐像素视觉证据；本节 focused/static 结果对应的 Web 真实读回见 §12.8。本轮没有启动或停止
TER Web 服务，Web 只复用了现有 `http://localhost:8081/`；没有运行 Android、release 或 visual 验收。

### 12.7 dev-host surface 宽度控制（当前 focused/static）

页面头部新增 `surface 宽度` range 控件，取值为当前 preview content rect 的 30%–100%，步长为
1%。控件只把测量宽度乘以百分比后交给现有 `calculateSurfacePreviewGeometry`；逻辑 surface 的
`width/height`、assembly/runtime、surfaceForm、输入坐标与 laptop 单/双屏语义均不变。

当前 owning source：

- `apps/terminal/ui/base/dev-host/src/components/testExpoApp.tsx#SurfaceWidthControl`：range 控件、
  30/100 边界、百分比文本、ARIA 值与状态接线；
- `apps/terminal/ui/base/dev-host/src/components/testExpoApp.tsx#SurfaceCanvas`：把当前测得的
  preview 宽度按比例传入既有几何函数，保留统一比例和滚动承载；
- `apps/terminal/ui/base/dev-host/src/foundations/surfacePreview.ts#SurfacePreviewPolicy`：当前策略名
  为 `width-selective-preserve-ratio`；IA、详设、实施计划与两个 README 已同步。

focused 断言覆盖：range 的 `min=30`、`max=100`、`step=1`；选择 30% 后 rendered stage 宽度为
当前 preview 宽度的 30%、统一缩放随之变化、逻辑 PRIMARY 仍为 `1920×1080`；恢复 100% 后既有
单双屏与缩放测试继续通过。最新 dev-host 结果为 4 个测试文件/13 个测试 PASS，sample-console
为 7 个测试文件/34 个测试 PASS。

本节包含通过独立 headed Playwright 会话对现有 TER Web `8081` 服务的真实 DOM/键盘/点击读回，
但不是逐像素 visual PASS；本轮没有重新启动 Web 服务，也未运行 Android、release 或 visual 验收。
此前尝试读取用户当前已打开的 TER Web tab 时，CUA kernel 连续两次在 30 秒处超时并自动 reset；
随后使用独立 Playwright 会话取得了可用证据，CUA 工具失败不解释为产品失败。

当前 source safety scan：

    Android platformPorts.ts startupDebugMode=true: 0
    Web test-expo App.tsx hard-coded mobile override: 0 (view selection is host-owned)
    runtime source constrainToParent API: 0
    backend DEV/seed/UAT/deployment: not started

### 12.8 dev-host radio control row（当前 focused/Web）

本轮将标题旁原先分散的状态 pill、切换按钮与视角 segmented buttons 收敛为两个 radio group，并把
宽度 range、视角 radio、屏幕模式 radio 从标题/状态行拆到下方独立的居中 toolbar row。屏幕模式
radio 仍只在 laptop 出现；选择 `双屏模式` 只挂载 SECONDARY，选择 `单屏模式` 只卸载 SECONDARY；
视角 radio 仍通过 URL reload 选择 laptop/mobile。

当前 owning source：

- `apps/terminal/ui/base/dev-host/src/components/testExpoApp.tsx#SurfaceRadioOption`：统一的 radio option
  输出、选中态、`role=radio` 与 `aria-checked`；
- `...#SurfaceFormSwitcher` / `...#SurfaceModeRadio`：两个互斥 group 的标签、选项与现有动作接线；
- `...#createTestExpoApp`：标题/状态 top row 与独立居中 toolbar row 的布局。

新鲜 focused 结果：dev-host typecheck + 4 files/13 tests PASS；sample-console typecheck + 7 files/34
tests PASS；`check-static.mjs` PASS；`git diff --check` PASS。

新鲜 Web 结果（独立 headed Playwright，使用已运行的 TER `8081`，未启动后台 DEV）：

- snapshot 读到「终端视角」下 `laptop 视角`/`mobile 视角` 两个 `radio`，以及「屏幕模式」下
  `单屏模式`/`双屏模式` 两个 `radio`；初始 `laptop`、`单屏模式` 为 checked；
- DOM 几何读回：viewport `1200×918`；标题/状态行 `top=24,bottom=64`；控制行
  `top=78,bottom=116`，`left=28,width=1144`；宽度、视角、屏幕三个 group 的 y 均为 `78/79`，
  三者总宽含间距为 `768.48`，相对 toolbar 的剩余空间左右各约 `187.76`，符合居中；
- 点击 `双屏模式` 后 snapshot 读到 `双屏模式 [checked]` 与 `SURFACES 2 个 Root`；再点击
  `单屏模式` 后读到 `单屏模式 [checked]` 与 `SURFACES 1 个 Root`；
- `aria-checked=true/false` 与选中项同步。该结果是 Web 行为与布局几何证据，不是视觉或像素级验收。

结论：通用键盘呈现方法、dev-host surface 宽度控制、两个 radio group 与标题下独立居中控制行已落地并记录在 README；当前 TER 行为分档复验已完成，但整体
implementation acceptance 仍不能写成完整 GO。visual/release、Android 未覆盖子项和 protected
persistence 等 OPEN 边界必须按各自档位继续关闭，不能由本节的 focused、Web 行为或 Android
hierarchy 结果替代。
