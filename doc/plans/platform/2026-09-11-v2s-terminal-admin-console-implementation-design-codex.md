# TER terminal admin console and primitives implementation-facing design

SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

## 0. Metadata and authorization boundary

```text
BUSINESS_SOURCE=doc/plans/platform/2026-09-11-v2s-terminal-admin-console-and-primitives-requirements-claude.md
JOURNEY_REFS=doc/decisions/2026-09-11-v2s-terminal-admin-console-journey-proposal-codex.md
IA_REF=doc/plans/platform/2026-09-11-v2s-terminal-admin-console-ia-design-codex.md
INTERACTION_REF=doc/plans/platform/2026-09-11-v2s-terminal-admin-console-ui-interaction-design-codex.md
AUTHORIZED=source implementation, tests, necessary documentation, and implementation evidence under current Dexter authorization; no runtime-tier expansion
NOT_AUTHORIZED=generated contract, migration, seed execution, build, Web, Android, native runtime, DEV, L2, UAT, deployment, Git
IMPLEMENTATION_AUTHORITY=true (current Dexter authorization)
DESIGN_STATUS=IMPLEMENTED_WITH_FOCUSED_STATIC_EVIDENCE; visual wireframe remains open
INDEPENDENT_DESIGN_REVIEW=ROUND_2_NO_GO_FINAL (6M/2S/2N after Dexter rulings)
HISTORICAL_REVIEW_STATUS=NO-GO (6M/2S/2N after Dexter rulings)
REMEDIATION_INTAKE=doc/review/platform/2026-09-11-v2s-terminal-admin-console-design-remediation-intake-codex.md
CURRENT_BYTES_AFTER_REMEDIATION=NOT_REVIEWED_BY_HISTORICAL_ROUND_2
CONSUMER_FACE=public (terminal-local operator surface; not a web admin face)
EVIDENCE_STATUS=IMPLEMENTATION_FOCUSED_STATIC; Web/Android/native/release/visual remain open
```

This document is the implementation-facing design record for the current authorized source work. The Journey,
IA, and interaction artifacts still retain their visual/product review boundary, and the historical design review
rounds closed as `NO-GO`; neither is a claim of implementation-review GO. Current source, focused, and static
results are recorded in the companion evidence document. Web, Android, native, release, and visual evidence are
separate and remain open. If Dexter later changes a wireframe or interaction, this design and its plan must be
reconciled before another implementation change.

## Canonical cross-document fact block

- `SURFACE_FORMS=laptop|mobile`.
- `ADMIN_SECTION_CONTAINER_KEY=admin.sections`.
- `ADMIN_LAYER_CONTAINER_KEYS=[]` is the explicit layer-only placement semantics.
- The final `UiCatalogEntry` exact-key set is `partKey`, `rendererKey`, `containerKeys`, `displayModes`, `workspaces`, `instanceModes`, `surfaceForm`, `title`, and `description`. `assertEntryKeys`, `canonicalEntry`, `definePart`, and all fixtures must agree on this set; no `adminSection`, `owner`, or order field is permitted.
- The section collection is selected from the same `UiCatalog.entries`, with exact matching on form, display mode, workspace, and instance mode; its order is the filtered entries' list order preserved by `createUiCatalog`. No `adminSection.order` field or second owner/order registry exists.
- Physical `displayIndex` is used only at the integration/dev-host boundary. The UI receives `surfaceForm` and `isHostPrimaryDisplay`; it does not index a host-source map.
- The Web dev-host exposes one `终端视角` radio group for the mutually exclusive laptop/mobile options when
  portrait is declared, and a `surface 宽度` range control from 30% to 100% of its measured preview
  content width. The selected percentage changes only the preview geometry/scale; logical surface sizes,
  assembly state, input coordinates, and the laptop `surfaceMode` single/dual radio-group semantics remain unchanged.
  The three host controls are rendered in their own centered row below the title/status row.
- `isHostPrimaryDisplay` is true only for physical index 0. Web test surfaces use the same index mapping: index 0 true, index 1 false.
- `SurfaceHostSnapshot` carries the frozen `isHostPrimaryDisplay` and `surfaceIdentity` facts. The integration keeps `displayIndex`, selects the host source by physical index, and derives the boolean once; `SurfaceRoot` transfers the snapshot fact into `SurfaceContext`. No independent prop, display-mode lookup, instance-mode lookup, or hard-coded Web value is allowed.
- Host-unready is an explicit loading state. `SurfaceHostController` renders a status indicator and no children; it does not alter the host gate.
- A surface identity replacement recomputes geometry and retains the existing `SurfaceRoot` React identity, all business content, and all business layers. The generic render lifecycle observes the new snapshot/geometry and blurs the replaced surface's active field. The identity-bound `AdminLayer` effect owns targeted cleanup: it captures the old `displayMode` in the effect closure and its cleanup callback dispatches the existing `ui-state` `closeLayer` command with the local `ADMIN_CONSOLE_LAYER_ID` when the full identity changes or the old-mode layer is unmounted by the current `LayerStack` selection. Admin authentication, selected section, and local admin scroll are discarded. `SurfaceRoot` never imports admin-shell identity constants; whole-root remount and `clearLayers` are forbidden.
- Shared identity constants are `ADMIN_CONSOLE_PART_KEY=admin.console`, `ADMIN_CONSOLE_LAYER_ID=admin.console.layer`, `ADMIN_CONSOLE_FOCUS_SCOPE_ID=admin.console`, and `ADMIN_SECTION_CONTAINER_KEY=admin.sections`.
- `createUiStateModule({surfaceForm})` initializes the `surfaceForm` slice once per assembly/module lifetime with `persistIntent=never` and `syncIntent=isolated`; there is no runtime setter. `selectSurfaceForm(root)` is the only read path used by admission and render context.
- Focus remains surface-level: `notifyFocusBoundary('suspend'|'restore')` is emitted only for 0→1 and 1→0 layer-count transitions. A separate active-layer focus-scope selection is allowed on every top-layer change; it is not a second suspension broadcast.
- All admin actions are read-only. A section navigation command returns a typed rejection and cannot change business content.

## 1. Real business goal and alternatives

### 1.1 Structural problem

The terminal currently has the raw capabilities needed for a diagnostic overlay in separate owners, but it lacks the contracts that make the overlay truthful across form, display, runtime, and loading states. The dangerous failure is not a missing button. It is a console that appears to work while selecting the wrong display source, treating a layer part as an invalid screen part, reading a DEV-only descriptor in a production package, re-enabling the system keyboard through one primitive caller, or proving itself with a private state setter instead of a user action.

Without this batch:

- a physical secondary display can be mistaken for the host because `displayMode` and physical index are conflated;
- the first catalog consumer cannot correctly select a layer part with `containerKeys=[]`;
- the admin list can drift from the production catalog or be “proven” by a test-only fixture;
- device identity and debug state remain unavailable or indistinguishable from build mode;
- the system keyboard retirement leaves a caller-dependent escape hatch;
- host-not-ready remains an empty view with no user-visible explanation;
- dynamic form/mode changes can keep stale geometry, focus, scroll, or authentication.

The user outcome is therefore a local, read-only, host-display diagnostic overlay whose behavior is derived from real assembly facts and the same catalog used by production rendering. It is not a new application, backend admin surface, or data-writing console.

### 1.2 Alternatives

| Option | Shape | Why it is rejected or adopted |
| --- | --- | --- |
| A. Hard-coded admin list and display-mode gate | Add an admin array and continue indexing sources by `DisplayMode` | Reject: duplicates the catalog, cannot prove injected production sections, and recreates the M-01 physical-index failure. |
| B. Generic navigation route plus native `TextInput` | Add a route/menu and suppress the keyboard at each caller with `showSoftInputOnFocus=false` | Reject: introduces a second navigation/input owner and leaves future primitive callers able to reopen the system keyboard. |
| C. Catalog projection + host-boundary physical index + existing LayerStack/InputController | Add only the missing dimensions/metadata, derive the host boolean once at the integration boundary, and compose the console from current render/input owners | **Adopt**: it closes the observed failure families with the fewest new owners and keeps the one catalog, one layer stack, one input pipeline, and one display derivation. |
| D. New terminal admin service/registry and persisted admin session | Move descriptors/sections into a separate admin model and persist selection/auth | Reject: over-engineers a read-only local diagnostic need, creates duplicate facts, and violates re-authentication/layer-local state requirements. |

I chose C rather than A/B/D because the real problem is missing transfer and selection semantics at existing owner boundaries, not the absence of another feature framework. C adds explicit facts where the current code loses them and leaves every other concern with its existing owner.

## 2. CP overview and fixed serial order

The CP names below are documentation/gate names only. Proposed runtime and test names use capability names, never these IDs.

| CP | Layer / subject | Owner | Main output | Dependency |
| --- | --- | --- | --- | --- |
| CP-01 | form declaration and grouped surface creation | sample-console integration + dev-host | form-aware surface input and portrait rule | none; first |
| CP-02 | system keyboard atomic retirement | input + primitives/vendor + render | virtual-only input and no public suppression prop | CP-01; cannot overlap contract edits |
| CP-03 | catalog/display/layer contract | ui-state + render + display-context + integration | form-aware selector, layer semantics, physical host flow | CP-02; CT-2 source fix before first CT-4 consumer |
| CP-04 | device identity | Android device owner + assembly + admin pure functions | one startup read, pure derivation, unknown fallback | CP-03 |
| CP-05 | debug runtime fact | runtime/assembly + render context | explicit packaging/startup source with priority | CP-04 |
| CP-06 | primitives/vendor and semantic tokens | primitives + vendor + sample-console theme | required primitive surface and centralized vendor behavior | CP-03; after capability contracts |
| CP-07 | host loading and dynamic surface replacement | render + input + ui-state | explicit loading state and dynamic geometry/lifecycle rule | CP-06 |
| CP-08 | admin shell and catalog-backed sections | admin-shell + sample-console | local auth, shell, three kernel sections, no navigation escape | CP-07 |
| CP-09 | focused proof and final reconciliations | main agent + fresh independent reviewers | stage proofs, all-criteria matrix, design review package | CP-08; after implementation only |

The plan is serial after each CP gate. CP-01's form declaration is first. CP-02 is one atomic group and cannot be interleaved with later contract work. The focus pre-probe is a CP-03 entry probe; the full focus assertion is after CP-08/step 8. No CP authorizes execution in the current task.

## 3. Cross-cutting mechanism comparison

The fixed rows from `doc/decisions/templates/implementation-design-template.md` are all retained. This batch is a terminal React Native/read-only batch with no backend HTTP operation, database mutation, seed, or RTK query; those rows are `N/A` with an explicit reason.

| 机制 | ① 现成能力/规范 | ② 可执行验证（最低档） | ③ 代码先例及新代码必须匹配形态 | ④ 本批适用全集 |
| --- | --- | --- | --- | --- |
| 读侧节点授权 | `apps/terminal/ui/base/render/src/contexts/RenderContext.ts#RenderContextValue`; `apps/terminal/ui/base/render/src/types/props.ts#RenderProviderProps`; requirements AC3/AC6 | static: every admin section receives only frozen runtime facts/catalog/context; focused: section cannot dispatch navigation | match `RenderProvider` context transfer and `selectScreen` read ownership; no section imports a feature state owner | admin launcher, login, four section renderers, display summary, port/runtime reads |
| 写授权与 grant 复核 | `apps/terminal/kernel/base/ui-state/src/features/actors/contentActors.ts#createShowScreenActor/createOpenLayerActor`; no backend grant in this batch | static: search admin package imports and command calls; focused: navigation boundary returns typed rejection | match existing actor/command API; no direct state-slice setter from UI | opening/closing admin layer, section selection local state, transient-layer replacement |
| 跨 owner 写与事务 | `AGENTS.md` one business deployable/owner rule; no cross-domain business write | static: no HTTP, DB, migration, or business mutation path appears in changed-file set | N/A: no cross-owner business write; UI state commands remain with `ui-state` | all admin operations and dynamic layer cleanup |
| 集合形态与分页 | `apps/terminal/kernel/base/ui-state/src/types/catalog.ts#UiCatalogEntry`; `selectAvailableParts` | static/focused: current four entries are returned exactly once in filtered catalog list order; no client-side duplicate list; a generic list mounts at most 24 rows with 16 visible plus four-item overscan per side | match catalog's readonly/frozen array conventions and `assertClosedArray`; no pagination for bounded four-item batch; virtualization is not truncation | built-in three sections + `sample.console.admin-test`; all future admin entries use same projection |
| 缓存失效 / 改完刷新什么 | `apps/terminal/kernel/base/ui-state/src/foundations/workspaceSlices.ts` persistence boundary; layers are non-persisted | focused: close/reopen produces a fresh unauthenticated layer; surface replacement closes only the admin layer and recomputes geometry | match existing content persistence/layer non-persistence; do not add auth/section persistence or broad `clearLayers` | admin auth, selected section, password, local scroll, focus, transient layers |
| **RTK 数据读取与加载判定** (`currentData` / `isFetching`) | `doc/platform/frontend-coding-standard.md#§3-B` | static: no RTK import/query exists; loading is observed from `SurfaceHostSnapshot` and section fact source | N/A: no HTTP/RTK in terminal admin; use current `SurfaceHostController` null-snapshot branch | host loading; optional section fact-unavailable row |
| **同一事实只有一个住址** | `doc/platform/frontend-coding-standard.md#§3-E`; `apps/terminal/kernel/base/ui-state/src/foundations/catalog.ts` | static: section keys are derived from `UiCatalog.entries`; host sources use one physical-index map; focused injection/removal changes the same catalog result | match canonical catalog construction and `SurfaceRoot` context; no second admin registry or mirrored admin state | form, display dimensions, host bool/source, section list, device/debug facts, layer readiness |
| **失败可见且原因不得改写** | `doc/platform/frontend-coding-standard.md#§3-D`; `apps/terminal/ui/base/render/src/components/SurfaceHostController.tsx` | focused: loading, invalid password, unknown identity, unavailable descriptor, rejected navigation each produces its own testable state | match current typed fallback/diagnostic patterns; never map `not-host` to host loading or descriptor-unavailable to disabled aggregate | host loading, password/clock/identity, catalog/section, navigation boundary |
| owner 错误到 HTTP 的映射与注册处 | `doc/platform/backend-coding-standard.md#§1-D/§2-B` | static: `rg`/AST check finds no HTTP route or typed-problem registration in the batch | N/A: no server/HTTP owner or consumer | all admin reads/actions are local |
| 幂等键构成与重放语义 | `doc/platform/frontend-coding-standard.md#§3-G`; no write operation | static: no mutation hook/HTTP request/idempotency key in changed paths | N/A: local layer open/close is not a business command and is not replayed remotely | all admin interactions |
| **该用生成物的地方不得手搓字符串** | `doc/platform/frontend-coding-standard.md#§2-D`; existing `apps/terminal/ui/base/render/src/types/props.ts` | static: no OpenAPI/URL/contract string is added; test IDs come from one capability test-ID module | match existing source-of-truth exports; generated API is not applicable | test IDs, catalog keys, renderer keys, typed local error codes |
| 日志落点与脱敏字段 | `AGENTS.md` observability/privacy hard constraints; `apps/terminal/kernel/base/runtime/src/createRuntime.ts#startup logging` | static: no password/device raw ID/token/IP/raw payload logging; focused future run reads structured startup diagnostic | match runtime logger event shape and redaction conventions; debug source logs only boolean/source/availability | assembly startup device/debug diagnostic, typed render diagnostics, rejected command diagnostic |
| 迁移回填与可逆性 | `N/A_WITH_REASON:implementation-design-template.md §10; no persisted schema change` | static: changed-file set has no migration; plan §10 is N/A | N/A: admin/session/catalog metadata is in-memory code, no DB row shape changes | all CPs |
| 前端共享行为(Drawer/列表/表单生命周期) | `libraries/frontend/admin-ui-foundation` exists for web admin apps; terminal owners are `apps/terminal/ui/base/*` | static: verify no applicable RN consumer in the foundation; focused terminal proof uses current `LayerStack`, `InputController`, and vendor slots | N/A_WITH_REASON: the web foundation does not own this RN surface; do not duplicate its behavior into a second terminal foundation | admin layer, keypad, section collection, scroll, loading |
| 候选/下拉数据源 | `apps/terminal/kernel/base/ui-state/src/foundations/catalog.ts#selectAvailableParts` | focused/static: section options change when the injected catalog entry is removed; no hard-coded options | match catalog selector's exact dimension matching and frozen arrays | admin section navigation options only; no server candidate list |
| 编码与名称呈现 | `apps/terminal/ui/base/render/src/foundations/definePart.ts`; existing sample defined parts in `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx#definedParts` | static: every part has unique `partKey`/`rendererKey`, title/description and catalog fields; focused: visible heading comes from selected catalog entry | match `definePart` copy-through/frozen fields and existing sample part naming; no Journey IDs in code names | console layer, four section parts, primitive labels, typed UI copy |
| **会同时坏的东西是否已声明为原子组** | `doc/platform/foundation-charter.md#§5-C`; requirements keyboard retirement CT-3/CT-6 | static: one atomic CP-02 change list includes input type/result, primitive public props, vendor wrapper, render snapshot; no intermediate acceptance state | match existing layered package ownership and all-or-nothing contract updates | system-keyboard retirement, public prop removal, render IME field removal |

## 3a. L2 script development pre-check

```text
UI_DESIGN_REVIEW=OPEN
TESTID_REVIEW=OPEN
L2_SCRIPT_ADMISSION=BLOCKED
```

L2 is not authorized in this task. The table is the future L2 admission boundary, not a visual acceptance
claim. The current focused tests exercise the real controls listed below; a future L2 binding still requires
separate visual/product review and fresh independent admission. The capability-owned test-ID module is
`src/foundations/adminTestIds.ts`; shared keypad IDs remain owned by `ui.base.input`.

| case/action | user control/action | UI owning source | proposed `*TestIds.ts` source | actual action node | future binding | focused/static proof | fresh independent review | conclusion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| host invocation | logical gesture/press observed on business content | `apps/terminal/ui/base/admin-shell/src/components/AdminLauncher.tsx#AdminLauncher` | `apps/terminal/ui/base/admin-shell/src/foundations/adminTestIds.ts#adminTestIds.launcher` | plain business-content ancestor `View` observes bubbled Web `onClick` or native `onTouchEnd`; exactly one branch is attached, with no `Pressable`, responder negotiation, opacity, absolute overlay, or consuming press handler | future capability binding | `sample-console/test/sampleAssembly.test.tsx` + static gate + Web event-layer proof | focused/Web | L2 OPEN |
| keypad entry | press digit | `apps/terminal/ui/base/input/src/components/VirtualKeyboard.tsx#VirtualKeyboard` | `ui.base.input:virtual-keyboard:text-<n>` | input-owner button | future capability binding | `sample-console/test/sampleAssembly.test.tsx` + input test | focused | L2 OPEN |
| delete | press delete | `apps/terminal/ui/base/input/src/components/VirtualKeyboard.tsx#VirtualKeyboard` | `ui.base.input:virtual-keyboard:backspace` | input-owner button | future capability binding | input focused test | focused | L2 OPEN |
| verify | press verify | `apps/terminal/ui/base/admin-shell/src/components/AdminLogin.tsx#AdminLogin` | `adminTestIds.verify` | actual button | future capability binding | `sample-console/test/sampleAssembly.test.tsx` | focused | L2 OPEN |
| close | press close | `apps/terminal/ui/base/admin-shell/src/components/AdminLogin.tsx#AdminLogin`, `apps/terminal/ui/base/admin-shell/src/components/AdminShell.tsx#AdminShell` | `adminTestIds.close` | actual button | future capability binding | `sample-console/test/sampleAssembly.test.tsx` | focused | L2 OPEN |
| platform section | press real tab/segment | `apps/terminal/ui/base/admin-shell/src/components/AdminSectionNavigation.tsx#AdminSectionNavigation` | `adminTestIds.sections.platformPorts` | option anchor/button | future capability binding | admin-shell/sample focused tests | focused/static | L2 OPEN |
| runtime section | press real tab/segment | `apps/terminal/ui/base/admin-shell/src/components/AdminSectionNavigation.tsx#AdminSectionNavigation` | `adminTestIds.sections.runtime` | option anchor/button | future capability binding | `sample-console/test/sampleAssembly.test.tsx` | focused | L2 OPEN |
| display section | press real tab/segment | `apps/terminal/ui/base/admin-shell/src/components/AdminSectionNavigation.tsx#AdminSectionNavigation` | `adminTestIds.sections.displayContext` | option anchor/button | future capability binding | admin-shell/sample focused tests | focused/static | L2 OPEN |
| sample section | press real tab/segment | `apps/terminal/ui/base/admin-shell/src/components/AdminSectionNavigation.tsx#AdminSectionNavigation` | `adminTestIds.sections.sampleConsole` | option anchor/button | future capability binding | `sample-console/test/sampleAssembly.test.tsx` | focused | L2 OPEN |
| host loading | observation only | `apps/terminal/ui/base/render/src/components/SurfaceHostController.tsx#SurfaceHostController` | `ui-base-render:surface-host-loading-indicator` | loading `View`/Spinner tree | no L2 action | render loading focused test | focused | L2 OPEN |

The future L2 admission cannot set `PASS` until each row has a real action node, a unique constant source,
and fresh independent review. Current focused/static status is not L2 or visual PASS. No wrapper, text, role,
index, or direct state setter may substitute for an action node.

## 4. CP gates

Every CP gate below has a red shape, invariant, forbidden shape, proportional proof, design-reason, and recall
list. CP-01 through CP-08 have now been implemented under the current authorization; their actual command
results and evidence tiers are recorded in the companion evidence document. CP-09's independent implementation
review remains open.

### CP-01 — form and grouped surface source

- `RECALL`: requirements §3; `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx#SampleAssembly/createSurfaceForDisplayIndex`; `apps/terminal/ui/integration/sample-console/src/application/terminalSurfaces.ts#parseTerminalSurfacePackage`; `apps/terminal/ui/base/dev-host/src/components/testExpoApp.tsx#TestExpoAssembly`; `apps/terminal/assembly/android/sample-terminal/App.tsx`.
- red shape: a portrait package containing a `SECONDARY` surface, or a surface created with only `displayMode` and no physical display input.
- invariant: portrait has PRIMARY-only surface declarations; landscape may have PRIMARY/SECONDARY; group startup creates the declared form's surfaces; the display index remains available for source lookup and host derivation.
- forbid: selecting a host source with `surfaceHostSources[displayMode]`, deriving form from a label in the UI, or silently accepting portrait secondary.
- proof: static parser/assembly tests at the package/assembly boundary; no runtime required for the design task.
- shape reason: preserving the index at the boundary is smaller than adding an index to every UI component and prevents the same fact from being re-derived in multiple owners.

### CP-02 — atomic system keyboard retirement

- `RECALL`: requirements §6 and CT-3/CT-6; `apps/terminal/ui/base/input/src/types/types.ts`; `useInputField.ts`; `InputController`; `apps/terminal/ui/base/primitives/src/types/types.ts#PrimitiveInputProps`; `apps/terminal/ui/base/primitives/src/components/PrimitiveInput.tsx`; `apps/terminal/ui/base/primitives/src/vendor/slots.tsx`; render IME snapshot symbols.
- red shape: any public primitive prop or render snapshot still exposes `showSoftInputOnFocus`, or a native-less input attempts `inputRef.current.focus()` as its only focus behavior.
- invariant: the public primitive props have no suppression escape hatch; vendor owns the fixed false value; password entry uses one virtual string and existing `InputController`/`InputProvider` ownership; render CT-3 is removed in the same atomic group.
- exact retirement set: remove `KeyboardKind='system'`, the `InputFieldOptions` system branch, system-owner branches in `useInputField`/`useInputFocusController`/`InputProvider`/`InputSurfaceFrame`, the public `PrimitiveInputProps.showSoftInputOnFocus` and its `PrimitiveInput` forwarding, `SurfaceHostImeSnapshot`, `calculateSurfaceHostImeInset`, `SurfaceHostImeContext`, render `ime`/`imeInset` fields and their exports, plus Android adapter/Kotlin IME inset collection/event fields (`imeVisible`, `imeBottomLogicalBeforeCanvasScale`, and the `TerminalImeInsetsCoordinator` path). The virtual keyboard's own frame metrics, `InputScrollArea` scroll-into-view, and `viewportAlreadyShrunk` path remain.
- focus extension: add an optional capability-named `focusScopeId` to input registration/options (default `business`); native-less fields use a null native ref and call the existing controller for focus/blur, never a second keyboard owner.
- native-less field contract: freeze `InputFieldOptions`, `InputFieldRegistration`, and `InputFieldResult` so the virtual branch accepts `inputRef: RefObject<TextInput | null> | null`, preserves `keyboardKind='virtual'` and its layout/max-length requirements, and returns the same virtual snapshot/input props plus `focus`, `blur`, and `complete` callbacks. `InputController.activateFocusScope(scopeId)` is the only scope transition API. A successful virtual focus sets active keyboard state even when the native ref is null; native focus is attempted only when a ref exists. `complete` follows the same rule and must not silently turn a virtual focus into a failed action.
- geometry oracle: for every existing Android `imeVisible` reuse/branch predicate, record the complete pre-retirement truth table over `imeVisible=true|false` and its other inputs; after retirement the `imeVisible=false` rows must match exactly, while the `true` rows are unreachable because system IME is removed. This is a Kotlin focused/static set comparison, not a claim that “before/after measurement is equal” for an impossible true row.
- forbid: per-caller `false` snapshots as the only control, second input pipeline, native field fallback, or leaving render IME fields after input/primitives retirement.
- proof: static exact-key/type checks, focused input controller truth-table, native snapshot focused test; no Android run now.
- shape reason: one vendor suppression point protects future primitive callers, while native-less input changes only nullable ref/registration behavior and keeps the existing virtual keyboard owner.

### CP-03 — dimensions, layer semantics, and physical host flow

- `RECALL`: `apps/terminal/kernel/base/ui-state/src/types/catalog.ts`; `apps/terminal/kernel/base/ui-state/src/foundations/catalog.ts`; `apps/terminal/ui/base/render/src/components/resolvePart.ts`; `apps/terminal/ui/base/render/src/components/LayerStack.tsx`; `apps/terminal/ui/base/render/src/components/ScreenContainer.tsx`; `apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx`; `apps/terminal/ui/base/render/src/contexts/SurfaceContext.ts`; display derivation symbols; sample assembly.
- red shape: `selectAvailableParts` rejects `containerKeys=[]` layer entries, `resolvePart` renders an incompatible part, host sources are indexed by display mode, or `isHostPrimaryDisplay` is hard-coded/derived from mode.
- invariant: context includes form; layer placement uses null/empty-container semantics; all four dimensions are exact; physical index derives both source selection and host bool at integration, while canvas remains mode-selected.
- transfer contract: `SurfaceHostSnapshot` carries `isHostPrimaryDisplay` and `surfaceIdentity`; the integration source map is keyed by physical `displayIndex`, and `SurfaceRoot` passes the frozen values into `SurfaceContext`. A Web test source receives the same index input; it may not synthesize the boolean from `displayMode`.
- admission owner: `createUiStateModule` supplies its immutable catalog and its assembly-initialized `surfaceForm` slice to `createOpenLayerActor`; before dispatching the existing `openLayer` reducer, that actor evaluates the shared availability predicate with `containerKey=null` and the current state-derived context, returning a typed `layer-part-unavailable` rejection before any state write. `selectSurfaceForm(root)` is also the form source passed into `RenderContext`/`SurfaceContext`, so admission and render cannot diverge. `LayerStack`/`resolvePart` retain the same predicate as render-time defense, not the admission owner.
- forbid: a second selector/registry, `instanceMode` as host proof, or a SurfaceContext bool populated with a constant.
- proof: static/AST call-chain checks and focused catalog/display tests using two physical indices and a layer entry with empty containers.
- shape reason: fix the selector contract before adding the first layer consumer; otherwise a consumer can never be both semantically correct and available.

### CP-04 — device identity and fallback authentication

- `RECALL`: `apps/terminal/kernel/base/platform-ports/src/types/device.ts`; Android adapter/module; `createPlatformPorts.ts`; requirements ID-2/AC2.
- red shape: assembly calls `getDeviceInfo` per login, password derivation is async/port-owned, or known identity accepts `123456`.
- invariant: assembly awaits the existing port exactly once per declared lifecycle (`createSampleAssembly`/one assembly instance), passes parsed identity to a synchronous pure function, and uses unknown-only fallback.
- lifecycle: the identity read is one `await ports.device.getDeviceInfo(...)` during `createSampleAssembly`; the resolved normalized value is captured in that assembly's frozen runtime facts. `AdminLogin` receives the fact and never calls the port. “Once” is per assembly instance, not per login, render, or password attempt.
- POC formula freeze: the upstream discussion records the external POC reference for human traceback only; the implementation must not depend on that absolute path because the formula is fully inlined here. The design input is: local `YYYYMMDDHH` from `getFullYear/getMonth/getDate/getHours`, `seed = deviceId + formatHour(date)`, UTF-16 code-unit loop `hash = (hash * 131 + seed.charCodeAt(index)) >>> 0` from zero, `numeric = \`${hash}${seed.length * 97}\``, and `numeric.slice(-6).padStart(6, '0')`; verification checks local hours `-1, 0, +1`. Read-only vectors for `localDate=2026-09-10` and local hours 09/10/11/12 are `DEVICE-001 → 211940/431940/441940/451940`; `DEVICE-002` at local hour 10 → `201940`. The test must construct local time explicitly; these are source-reopened vectors, not runtime evidence.
- forbid: DevicePort interface rewrite, permission request, raw ID/password logs, or a second cache/state owner.
- proof: static call-count/type checks and focused pure-function test with two fake IDs, unknown path, clock window, and restart/data-clear fixture design; Android native proof is future.
- shape reason: a single startup read is the smallest lifecycle that avoids repeated I/O; pure derivation makes the security rule falsifiable without coupling the UI to async ports.

### CP-05 — explicit production-capable debug fact

- `RECALL`: `apps/terminal/kernel/base/runtime/src/types/runtime.ts`; `createRuntime.ts`; `apps/terminal/assembly/android/sample-terminal/App.tsx`; sample assembly platform/runtime setup.
- red shape: debug is read from `__DEV__`, all sources are hard-coded DEV, or no production package can report debug on.
- invariant: packaging and startup sources are explicit, priority is deterministic, default is off, startup false is meaningful, and no admin mutation/persistence is added.
- resolver contract: `DebugModeSource = 'startup' | 'packaging' | 'default'`; `resolveDebugMode({startup, packaging})` chooses startup whenever it is defined, including `false`, otherwise packaging whenever it is defined, otherwise `{enabled:false, source:'default'}`. The complete matrix is: `(undefined,undefined)→off/default`, `(undefined,true)→on/packaging`, `(undefined,false)→off/packaging`, `(true,undefined)→on/startup`, `(true,true)→on/startup`, `(true,false)→on/startup`, `(false,undefined)→off/startup`, `(false,true)→off/startup`, `(false,false)→off/startup`.
- forbid: EnvironmentMode as a substitute, remote toggle, hidden `__DEV__` branch that removes the path, or logging secrets.
- proof: static source-branch check plus focused pure priority matrix in a production-mode fixture; release proof is future.
- shape reason: two immutable startup sources are sufficient for packaging and launch configuration; a new settings service would be a second owner.

### CP-06 — vendor primitives and semantic design tokens

- `RECALL`: primitives index/types/components; `vendor/slots.tsx`; `apps/terminal/ui/integration/sample-console/src/features/*/controls.tsx`; frontend coding standard; foundation charter.
- red shape: a required primitive is missing, a component imports React Native value APIs outside vendor, a literal status color is introduced, or `DialogSurface`/second overlay is created.
- invariant: required primitives are exported, value imports and RNW branching are centralized in vendor, interactive state/a11y props are complete, colors use semantic tokens, and existing controls migrate to composition.
- forbid: per-app reimplementation of vendor wrappers or direct `react-native` value import in primitive consumers.
- proof: static import/exports/token checks and focused primitive behavior/a11y tests; no visual Web/Android proof now.
- shape reason: a thin complete primitive surface reduces future caller drift without requiring per-component consumers; vendor centralization closes the actual keyboard/platform branch risk.

### CP-07 — loading and dynamic surface replacement

- `RECALL`: `SurfaceHostController.tsx`; `foundations/surfaceHost.ts`; `SurfaceRoot.tsx`; `SurfaceContext.ts`; `LayerStack.tsx`; `InputProvider.tsx`; the later `admin-shell/AdminLayer.tsx` consumer; requirements AC3A/AC4/AC5.
- red shape: pending host renders empty content with no indicator, children render behind pending geometry, or a display/form change keeps stale transform/admin auth/focus/scroll.
- identity contract: `SurfaceIdentity = {surfaceKey, displayIndex, surfaceForm, displayMode}` is frozen, but identity comparison is by the values of exactly those four fields, never by the identity object's reference and never by geometry-only snapshot identity. A new identity token exists only when at least one of the four values changes, and it triggers the replacement effect even when `displayMode` is unchanged. A new snapshot whose four identity values are unchanged must not close or reset `AdminLayer`. Preserve the existing `SurfaceRoot` React identity; do not key/remount the whole root and do not use a mount-time display-mode-only source cache.
- lifecycle contract: the generic render path first observes the new snapshot/geometry and blurs the replaced surface's active field without knowing any admin identity. Because the current `LayerStack` selects layers from `selectLayers(snapshot.root, displayMode)`, a display-mode change may unmount the old `AdminLayer` before it can observe the new context. Therefore `admin-shell/AdminLayer` must use an identity-bound effect whose cleanup callback captures the old `displayMode` in the effect closure and dispatches the existing `closeLayer` owner command with its local exact `ADMIN_CONSOLE_LAYER_ID`; the same cleanup runs before re-setup for an in-place identity change. `LayerStack` then removes only that admin layer and its local auth/selection/scroll state; an already-removed ordinary-close cleanup is idempotent and must not touch business layers. The path retains all business content and business layers. No render→admin-shell import, literal admin layer ID in render, or `clearLayers` all-layer action is allowed.
- focus contract: `FocusBoundaryState` has `surfaceSuspended`, `activeLayerScopeId`, and the last focus target per scope. `notifyFocusBoundary('suspend'|'restore')` remains count-based and is called only at 0→1/1→0. `LayerStack` calls `activateFocusScope(scopeId)` for each top-layer change without emitting another suspension event; `preflightFocusTarget` rejects a field whose scope is not the active top scope, but allows the active admin scope while the surface is suspended. The 1→2 transition switches from the business scope to `admin.console`; 2→1 restores the captured business target; 1→0 restores the surface target once.
- invariant: loading node has explicit label/spinner and no children; geometry recomputes from current snapshot/form; surface replacement preserves business content and business layer entries while discarding only admin-local state.
- forbid: treating loading as host denial, fail-open children, or using a cached display-mode source after the identity changes.
- proof: focused script-driven geometry/loading/dynamic tests; Web/Android evidence is future and separately named.
- shape reason: the generic SurfaceRoot/LayerStack boundary remains reusable and does not absorb an admin-only identity. The self-contained AdminLayer identity effect and its unmount cleanup reuse the existing context and `ui-state` command, keep the constants in their owner package, and cover the actual mode-based child unmount without adding a callback prop or a second overlay stack. They prevent a broad `clearLayers` call, a hard-coded cross-package literal, or a wrong-mode no-op.

### CP-08 — shell, sections, and injected production consumer

- `RECALL`: admin-shell package/index/dependencies; catalog/definePart; sample assembly; `contentActors`; `LayerStack`; input controller; interaction/IA artifacts.
- red shape: shell imports sample features, section options come from a hard-coded list, sample section exists only in a fixture, login state survives close, or a section can navigate the business screen.
- invariant: one catalog projection supplies four current section entries; `admin-shell` owns the console layer plus the three built-in section parts/renderers, and `sample-console` injects the title-only sample section through its production `definedParts`; auth/selection/scroll are layer-local; section command boundary rejects navigation; layer open/close use existing UI-state commands.
- production injection: `admin-shell` exports one `adminShellAssembly` containing the layer-only `admin.console` part and the three built-in section parts/renderers. `sample-console` merges that assembly first, then its feature parts, then the title-only `sample.console.admin-test` entry through its normal `definedParts` registration. A focused test first observes that real entry through the same catalog, then rebuilds the same production assembly without that entry and observes its disappearance; no parallel fixture part or hard-coded section array is accepted.
- identity constants: `ADMIN_CONSOLE_PART_KEY='admin.console'`, `ADMIN_CONSOLE_LAYER_ID='admin.console.layer'`, `ADMIN_CONSOLE_FOCUS_SCOPE_ID='admin.console'`, and `ADMIN_SECTION_CONTAINER_KEY='admin.sections'` are defined once in `admin-shell`. Open and ordinary close use the exact layer ID; the `AdminLayer` identity-bound effect consumes that local constant, captures the old surface `displayMode` in its effect closure, and its cleanup callback dispatches replacement cleanup both for an in-place identity change and for the old-mode child unmount caused by `LayerStack`. `SurfaceRoot` stays generic and has no admin-shell import or copied literal. After replacement, the focused oracle asserts that this admin layer count is zero while business layer IDs and their owning content state are unchanged.
- focus behavior: the admin layer declares `focusScopeId='admin.console'`; business layers default to `business`. `LayerStack` changes the active scope on top-layer changes, while `InputProvider` continues to emit surface suspend/restore only on count boundaries. The real-control A-15 path is business layer → launcher → admin virtual field/key → close → restored business focus.
- list bound: `PrimitiveList` uses fixed-height rows with `visibleWindow=16`, `overscanBefore=4`, `overscanAfter=4`, and a hard `maxMounted=24`; the focused fixture has 100 records, samples after each scroll transition, and asserts the first/last requested records remain reachable, no truncation occurs, and no more than 24 rows are mounted. The implementation proof is `N-2=FOCUSED_PASS`; it does not claim performance headroom or visual acceptance. The four section options remain a bounded navigation projection and do not create a second list owner.
- forbid: second registry/overlay/navigation/input owner, direct state setters in focused proof, or admin write commands.
- proof: focused real-control tests for launcher, keypad, verify, section switch, close/reopen, injection/removal; static dependency/import checks.
- shape reason: the existing layer stack and command API already own transient content; a local shell state is enough for ephemeral auth/selection and avoids persistence.

### CP-09 — reconciliation and review gates

- `RECALL`: this design §§3, 7, 9a, 13b; plan §13c; `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`.
- red shape: an implementation line is not mapped to design, an OPEN is called MATCHED, or static/focused proof is reported as Web/Android/release/visual PASS.
- invariant: each stage has focused proof and three-dimensional reconciliation; final plan has exhaustive code↔design reconciliation with only `MATCHED`/`OPEN`; two fresh review rounds run before delivery, round two is final SELF_DECIDED.
- forbid: sampling changed lines, author-only blind review, or automatic authority from any prior review.
- proof: document/static checks now; future review artifacts and evidence session records later.
- shape reason: this is a governance gate proportional to the user's explicit evidence requirement, not a new runtime mechanism.

## 5. Operation / path / face / collection

This batch has no backend HTTP operation and no consumer face. The table is intentionally present to distinguish “no route” from an omitted design.

| 业务意图 | operationId | method/path | consumer face | 集合形态 | 预期规模与增长驱动 |
| --- | --- | --- | --- | --- | --- |
| local admin layer open/close | `N/A_WITH_REASON` | `N/A_WITH_REASON:local ui-state command, no HTTP` | `N/A` | one transient layer per surface | max one admin layer; growth is surface lifecycle, not records |
| local section projection | `N/A_WITH_REASON` | `N/A_WITH_REASON:UiCatalog in memory` | `N/A` | current four readonly entries, one frozen array | bounded initial set; additions are catalog parts, no pagination |
| port/runtime/display read | `N/A_WITH_REASON` | `N/A_WITH_REASON:assembly-owned facts and existing stateSource` | `N/A` | fixed method/field rows | grows only when owning capability contract changes |

## 6. Cross-owner write matrix

| policy | first owner command | second owner command | transaction | rollback fact |
| --- | --- | --- | --- | --- |
| admin reads and local overlay | `N/A_WITH_REASON:read-only UI` | `N/A` | `N/A_WITH_REASON:no business transaction` | close removes transient layer; business content is unchanged |
| section selection | `N/A_WITH_REASON:admin local state` | `N/A` | `N/A` | selecting another entry replaces local selection only |
| surface replacement | `admin-shell/AdminLayer` invokes the existing `ui-state` transient-layer cleanup command with its previous `displayMode` and local exact layer ID | existing render/input lifecycle hooks observe the new identity, geometry, and focus boundary | `N/A` | business content remains; admin/auth/focus/scroll are discarded |

No row introduces a cross-schema or cross-owner business write. If a future implementation attempts to add one, it is out of this design and must stop for a new decision.

## 7. Declaration → transfer → consumption matrix

| fact | declaration | transfer | consumption | proof |
| --- | --- | --- | --- | --- |
| surface form | terminal-surface package parser and `SurfaceCreationInput` in `apps/terminal/ui/integration/sample-console/src/application/terminalSurfaces.ts` | assembly initializes the `ui-state` surface-form slice; `selectSurfaceForm(root)` feeds catalog admission and `RenderContext`/`SurfaceContext` | catalog selector, canvas/source selection, admin section visibility | static parser + focused form matrix |
| Web dev-host view selection | `terminalSurfaces.orientations` plus the host's configured default `surfaceForm` | the header control writes `surfaceForm=laptop|mobile` to the Web URL and reloads the preview page; the next assembly receives one explicit form | host header selection and the form-aware canvas group; no runtime setter or second same-page runtime | focused host form lifecycle test + Web event/manual proof when authorized |
| Web dev-host surface width | measured preview content rect plus a 30%–100% range selection | host multiplies the measured content width by the selected percentage before calling the existing preview geometry function | preview scale/rendered width only; logical surface declarations, input coordinates, and assembly state are unchanged | focused 30%/100% control and geometry test + Web visual/manual proof when authorized |
| physical display index | `SurfaceCreationInput.displayIndex` at integration/dev-host | sample assembly/dev-host retains index; source map keyed by index; UI receives only derived bool/form | host source lookup and `isHostPrimaryDisplay` | static call chain + focused index 0/1 |
| display mode | `resolveSurfaceDisplayMode(SurfaceDisplayModeInput)` | integration computes mode; `SurfaceRootProps.displayMode`; `UiCatalogContext.displayMode` | canvas group and catalog filter | static selector + focused mode matrix |
| host boolean | `isHostPrimaryDisplay = displayIndex === 0` in assembly boundary | passed as a frozen render fact; Web test host uses same boundary | launcher render gate and display-context section | static “no hard-code” + focused two-index |
| host source | `surfaceHostSourcesByDisplayIndex` input | assembly selects by physical index before passing `source` | `SurfaceHostController` geometry/loading | static source-key check + focused source identity |
| layer placement semantics | `UiCatalogEntry.containerKeys=[]` for layer-only; null selector placement | `selectAvailableParts(catalog,null,context)` and `LayerStack` available-set | admin console layer part and all layer placements | focused empty-container red fixture |
| section projection | `UiCatalogEntry.containerKeys` plus existing dimension fields | one `UiCatalog.entries` frozen array → projection selector | admin shell tabs and renderer lookup | injection/removal focused test; list order is source order |
| workspace/instance visibility | existing `UiCatalogContext` fields | SurfaceRoot/render context to selector | screen/layer/section availability | focused dimension matrix |
| host readiness | `SurfaceHostSnapshot`/geometry result | SurfaceHostController receives nullable source snapshot | loading node vs canvas children | focused loading test |
| host identity rejection | physical-index binding at `bindSurfaceHostIdentity` | typed `SurfaceHostIdentityRejection` callback reaches the integration logger without exposing raw identifiers | distinguish identity mismatch from an ordinary not-ready snapshot | focused mismatch diagnostic test |
| device identity | existing `DeviceInfo.deviceId` slot; native adapter result | assembly awaits once → `TerminalDeviceIdentity` frozen runtime fact → render context/admin pure verifier | password derivation and runtime section availability | static call count + focused fake IDs |
| current-hour password input | local time boundary in `adminPassword.ts` | login passes current hour to pure function | known/unknown/fallback verification | truth-table focused test |
| debug state | packaging source + Android startup prop | assembly `resolveDebugMode` → frozen runtime fact → render context/runtime section/logger | visible runtime row and startup diagnostic | focused source-priority matrix |
| port capability state | adapter/default/web binding descriptors per method | platform-ports factory → frozen descriptor snapshot → runtime facts/admin section | method-level rows including unavailable | static non-DEV source + focused descriptor fixture |
| keyboard owner | `InputController`/`InputProvider` state | input hook result → virtual keyboard; vendor wrapper fixed false | password keypad and field focus | focused input truth table + static prop absence |
| primitive visual state | semantic token map and primitive props | primitive wrapper → vendor slot/style | admin shell, sample controls, existing control migration | static tokens/imports + focused component states |
| admin authentication | local `AdminLayer` state | launcher command opens fresh layer; close/unmount discards | login vs shell subtree | focused real controls |
| selected section | local shell state | catalog projection → selected part key | navigation selected state and renderer | focused real tab press |
| section navigation authority | section command boundary | render context gives typed rejecting wrapper | attempted `showScreen`/`openLayer` remains rejected | focused rejection test |
| business content | existing `UiStateSource` content slice | unchanged through admin layer/surface replacement | `ScreenContainer`/business render | focused before/after equality |
| collection shape | IA/interaction: current four-entry frozen list | catalog selector returns readonly entries; shell does not slice into a second list | tabs/list and empty state | static/focused exact identity |
| authorization enforcement point | host bool + fresh local password verifier | integration/render context + AdminLayer login | launcher visibility and shell mounting | focused non-host/invalid password |
| cache invalidation | no auth/section cache; layer non-persisted | close/surface replacement unmounts local state | next open starts login | focused close/reopen |
| admin identity and replacement cleanup | `admin-shell/src/foundations/adminIdentity.ts` plus `AdminLayer` | no identity constant crosses into render; `AdminLayer` binds an effect to `SurfaceContext.surfaceIdentity`, compares exactly the four identity field values rather than the object reference, captures the old `displayMode` in the effect closure, and its cleanup calls the existing `ui-state` close command for both in-place identity changes and old-mode unmount | exact transient admin-layer removal on replacement; same-value geometry/snapshot updates preserve admin state | static no reverse graph edge or render literal + focused previous-mode/unmount close and same-value snapshot survival |
| error mapping | local typed error union in render/admin shell | owner returns code → shell/section presentation mapping | distinct loading/password/descriptor/nav states | focused typed-state matrix |
| logging/masking | privacy rule: no password/raw ID/token/cookie/IP/payload | assembly/runtime logger gets boolean/source/availability only | diagnostic sink; UI gets redacted labels | static log search + future focused log read |

## 8. Business rule → owner decision points

The requirements' rules are named by their current criterion/contract anchors. They are not runtime names.

| 规则 | owner 判定点 |
| --- | --- |
| AC0 layer vs section | `apps/terminal/kernel/base/ui-state/src/foundations/catalog.ts#selectAvailableParts`; render `LayerStack`/`ScreenContainer` placement call |
| AC1 gesture | `apps/terminal/ui/base/admin-shell/src/foundations/adminLauncher.ts#trackAdminGesture` |
| AC2 auth/fallback/window | `apps/terminal/ui/base/admin-shell/src/foundations/adminPassword.ts#verifyAdminPassword` |
| AC3 shell/actions | `apps/terminal/ui/base/admin-shell/src/components/AdminShell.tsx` and `AdminLayer.tsx` |
| AC3A host loading | `apps/terminal/ui/base/render/src/components/SurfaceHostController.tsx` |
| AC4 overlay/isolation | `AdminLayer.tsx` + `apps/terminal/kernel/base/ui-state` transient layer owner + `InputController` |
| AC5 shell/catalog/registration | `apps/terminal/ui/base/admin-shell` parts + `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx#definedParts` |
| AC6 sections/capabilities | three section renderers + platform-ports descriptor source |
| shape declaration | `apps/terminal/ui/integration/sample-console/src/application/terminalSurfaces.ts#parseTerminalSurfacePackage` |
| CT-1/CT-2/CT-3 | display integration/context, display selectors, render context/SurfaceRoot |
| CT-4/CT-5/CT-6 | catalog selector/definePart, input/primitives/vendor |
| CT-7/CT-8 | runtime facts and sample assembly integration |
| ID-1/ID-2/ID-3/ID-4 | Android device module/adapter, assembly, pure admin verifier |
| DBG-1/DBG-2/DBG-3/DBG-4 | runtime facts source and AdminRuntimeSection |
| PR-1..PR-7 | primitives/vendor/tokens and migrated existing controls |
| A-1..A-59 | plan §11 criterion matrix; each has one owning proof path and red mutation |

There are no omitted business-rule rows; rules without independent dynamic evidence are represented as design/static obligations, not silently promoted to runtime PASS.

## 9. Owner APIs and consumers

Every proposed behavior API has a named production consumer or an explicit focused proof consumer. The full primitive surface is the deliberate Dexter exception: required primitives may be completed without a first business caller, with A-36 behavior/accessibility proof as the stated safety net.

| owner API/symbol | exact consumer |
| --- | --- |
| `selectAvailableParts(catalog, containerKey, context)` extended layer/form semantics | `apps/terminal/ui/base/render/src/components/ScreenContainer.tsx`, `apps/terminal/ui/base/render/src/components/LayerStack.tsx`, `apps/terminal/ui/base/admin-shell/src/foundations/adminSectionSelection.ts` |
| `isAvailablePart(entry, placement, context)` or equivalent shared predicate | `apps/terminal/ui/base/render/src/components/resolvePart.ts`, `apps/terminal/ui/base/render/src/components/ScreenContainer.tsx`, `apps/terminal/ui/base/render/src/components/LayerStack.tsx` |
| `SurfaceCreationInput`, `createSampleAssembly({surfaceForm})`, and `createSurfaceForDisplayIndex` | `apps/terminal/ui/integration/sample-console/test-expo/App.tsx`, `apps/terminal/ui/base/dev-host/src/components/testExpoApp.tsx#TestExpoAssembly`, Android sample assembly; the outer App may default laptop, inner assembly boundaries require the explicit form |
| `SurfaceHostSnapshot.isHostPrimaryDisplay/surfaceIdentity` plus state-derived `SurfaceContext.surfaceForm/isHostPrimaryDisplay` | source/integration transfer, `apps/terminal/ui/base/admin-shell` launcher, display section, catalog/render context |
| `ADMIN_CONSOLE_*` identity constants and replacement cleanup | `apps/terminal/ui/base/admin-shell/src/foundations/adminIdentity.ts` | `AdminLayer` consumes its own constants and binds cleanup to `SurfaceContext.surfaceIdentity`; the cleanup closure retains the old `displayMode` even when `LayerStack` unmounts the old-mode child; only the existing `ui-state` command crosses the owner boundary; no `render → admin-shell` edge | `AdminLayer.tsx` exact previous-mode/unmount cleanup effect; `SurfaceRoot` remains generic |
| `RenderRuntimeFacts` | RenderProvider/RenderContext, AdminRuntimeSection, AdminPlatformPortsSection, AdminDisplayContextSection |
| `deriveAdminPassword` / `verifyAdminPassword` | AdminLogin and focused pure tests |
| `resolveDebugMode` | sample assembly startup and runtime section focused tests |
| public `PlatformPortCapabilitySnapshot` plus `describePlatformPortCapabilities(ports)` | platform-ports factory/adapters/defaults/Web binding, assembly runtime facts, `AdminPlatformPortsSection`; available in every build and method-level |
| native-less `InputFieldOptions`/`InputFieldResult` with `focusScopeId` behavior | AdminLogin virtual field and existing input focused tests |
| vendor `RnrTextInput` fixed suppression and slots | PrimitiveInput and all current/new primitives |
| `adminTestIds` | `apps/terminal/ui/base/admin-shell` launcher/login/shell tests and future L2 bindings |
| admin section projection/command boundary | AdminShell and all four section renderers |
| loading test IDs/Spinner | SurfaceHostController and loading focused test |

No `installPeerDispatchGateway` or transport API is added: it has no production consumer and is outside this batch.

## 9a. Full synchronized change matrix

The implementation plan must reopen this matrix before editing and after each stage. `N/A` means the counterexample is real: the changed fact has no backend/DB/seed/HTTP consumer in this batch.

| 变更事实 | 契约/唯一源/生成物 | 后端 owner/edge/migration | 前端 model/surface/state | focused/static/HTTP/L2 | fixture/seed/executor | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| `surfaceForm` | terminal-surface parser + `UiCatalogEntry` | N/A: no backend shape | SurfaceRoot/Context/catalog | static + focused form matrix | no seed; focused package fixture | synchronized source + consumer |
| physical index/host bool | `SurfaceCreationInput` + `SurfaceHostSnapshot.isHostPrimaryDisplay/surfaceIdentity` + assembly derivation | N/A | integration source map + SurfaceRoot/SurfaceContext fact | static + focused two-index | no seed | synchronized source + consumer |
| display-mode canvas selection | display derivation and canvas group | N/A | SurfaceRoot/host source | static + focused dynamic switch | no seed | synchronized |
| layer-only selection | catalog type/selector + `createOpenLayerActor` admission | N/A | LayerStack/resolvePart render defense | static + focused red empty-container | no seed | synchronized |
| admin section projection | `UiCatalogEntry.containerKeys` with `admin.sections` plus ordered catalog entries | N/A | catalog projection/AdminShell | static + focused injection/removal | sample production part, no seed | synchronized; no admin metadata/order key |
| host loading | host snapshot/geometry | N/A | SurfaceHostController/Spinner | static + focused | no seed | synchronized |
| device ID | existing DeviceInfo slot + Android adapter result | N/A | assembly runtime fact/admin password | static + focused; Android future | no seed | synchronized |
| debug fact | startup/packaging source | N/A | assembly/runtime facts/admin display | static + focused; release future | no seed | synchronized |
| keyboard retirement | input/primitives/render contracts | N/A | InputField + vendor + render snapshot | static + focused; native future | no seed | atomic synchronized group |
| primitive exports/tokens | primitives index/types/vendor/theme | N/A | admin shell + existing controls | static + focused; visual future | no seed | synchronized |
| capability descriptor | public `PlatformPortCapabilitySnapshot` + `describePlatformPortCapabilities` | N/A | assembly fact/admin port section | static + focused non-DEV descriptor | no seed | synchronized |
| admin auth/selection lifetime | layer-local component state | N/A | AdminLayer/AdminShell | focused real controls | no seed | synchronized |
| dynamic surface lifecycle | generic SurfaceRoot/SurfaceContext/LayerStack/InputController plus `admin-shell/AdminLayer` identity effect and frozen `SurfaceIdentity` | N/A | targeted previous-mode admin close, business retention, focus-scope switch, geometry/scroll | focused script-driven; Web/Android future | no seed | synchronized; N-2 list proof is `FOCUSED_PASS` without visual/headroom claim |
| section command boundary | admin shell local wrapper | N/A | AdminSectionRenderContext | focused navigation rejection | no seed | synchronized |
| test IDs | `adminTestIds.ts` single source | N/A | real controls | static + focused; L2 future | no seed | synchronized |

## 9b. Change anchors (symbols, not line numbers)

The following anchors are intended to be unique in their target file. The implementation must count/search each anchor before editing; line numbers are deliberately omitted.

| path | unique anchor | intended change |
| --- | --- | --- |
| `apps/terminal/ui/integration/sample-console/src/application/terminalSurfaces.ts` | `parseTerminalSurfacePackage` | enforce portrait PRIMARY-only and return form-aware group |
| `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx` | `createSurfaceForDisplayIndex` | retain physical index, derive bool/form, index source map physically, await device info once |
| same | `createSampleAssembly` | add runtime facts/part injection and group-aware surface creation; require the caller-provided `surfaceForm` with no inner fallback |
| `apps/terminal/ui/integration/sample-console/test-expo/App.tsx` | `createSurface(displayMode` | switch host to display-index input |
| `apps/terminal/ui/base/dev-host/src/components/testExpoApp.tsx` | `createTestExpoApp` / `SurfaceFormSwitcher` / `SurfaceModeRadio` / `SurfaceRadioOption` / `SurfaceWidthControl` | expose one laptop/mobile radio group when portrait is declared; provide one laptop-only radio group for mutually exclusive single/dual surface mounting; provide a 30%–100% surface-width range control over measured preview width; preserve logical sizes, accept a valid `surfaceForm` URL selection, and reload the Web page so the next assembly starts with one explicit form; keep index 0/1 and explicit Web host bool |
| `apps/terminal/kernel/base/ui-state/src/types/catalog.ts` | `UiCatalogEntry` | add required `surfaceForm`; keep the exact catalog shape free of admin metadata/order fields; add form to context |
| `apps/terminal/kernel/base/ui-state/src/foundations/catalog.ts` | `selectAvailableParts` / `assertEntryKeys` / `canonicalEntry` | layer/null semantics, form filter, exact-key validation, and required-field canonical preservation |
| `apps/terminal/kernel/base/ui-state/src/application/createUiStateModule.ts` | `createUiStateModule` | initialize one assembly-owned `surfaceForm` slice with `persistIntent=never`, `syncIntent=isolated`, and expose `selectSurfaceForm`; admission and render use this selector |
| `apps/terminal/ui/base/render/src/foundations/definePart.ts` | `DefinePartCatalogFields` / `definePart` | require and copy through `surfaceForm` with the same exact catalog shape |
| `apps/terminal/ui/base/render/src/components/resolvePart.ts` | `resolvePart` | pass context and final availability guard |
| `apps/terminal/ui/base/render/src/components/LayerStack.tsx` | `selectLayers` call | select compatible layer entries and context |
| `apps/terminal/ui/base/render/src/components/ScreenContainer.tsx` | `selectScreen` call | pass complete context and availability |
| `apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx` | `SurfaceRoot` props/context | read form through the state selector, transfer host facts, observe generic identity/geometry and blur the replaced surface without importing admin-shell or closing an admin layer |
| `apps/terminal/ui/base/render/src/contexts/SurfaceContext.ts` | `SurfaceContextValue` | form/host bool and frozen `surfaceIdentity` from the same state/snapshot source |
| `apps/terminal/ui/base/render/src/components/SurfaceHostController.tsx` | null snapshot branch | explicit loading Spinner, no children |
| `apps/terminal/ui/base/render/src/foundations/surfaceHost.ts` | `SurfaceHostSnapshot` / `bindSurfaceHostIdentity` | add frozen `isHostPrimaryDisplay` and `surfaceIdentity`; retain readiness/geometry contract without render-side system-IME fields; report a typed physical-host mismatch to the integration callback |
| `apps/terminal/ui/base/render/src/types/props.ts` | `SurfaceRootProps` / `RenderProviderProps` | host/runtime facts only; `surfaceForm` is read from the `ui-state` selector and is not a separate React-only form prop |
| `apps/terminal/ui/base/render/src/contexts/RenderContext.ts` | `RenderContextValue` | frozen runtime facts |
| `apps/terminal/ui/base/admin-shell/src/foundations/adminIdentity.ts` | `ADMIN_CONSOLE_PART_KEY` / `ADMIN_CONSOLE_LAYER_ID` / `ADMIN_CONSOLE_FOCUS_SCOPE_ID` / `ADMIN_SECTION_CONTAINER_KEY` | define the four identity/placement constants once |
| `apps/terminal/ui/base/admin-shell/src/components/AdminLayer.tsx` | `AdminLayer` identity-bound effect | read `SurfaceContext.surfaceIdentity`, capture the old `displayMode` in the effect closure, and dispatch exact admin cleanup from effect cleanup for in-place identity changes and old-mode unmounts; keep the constants inside admin-shell |
| `apps/terminal/ui/base/admin-shell/src/foundations/adminLauncher.ts` | `logicalPointFromWindow` / `trackAdminGesture` | convert window page coordinates to logical canvas coordinates before applying the 96-unit gate; keep the tracker pure and reusable |
| `apps/terminal/ui/base/admin-shell/src/index.ts` | `adminShellAssembly` | export the console layer plus three built-in section parts/renderers; re-export the shared identity constants |
| `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx` | `definedParts` / `createSampleAssembly` | merge `adminShellAssembly`, feature parts, and the title-only sample section through one catalog |
| `apps/terminal/skeleton-graph.ts` | `ui.base.render` / `ui.base.admin-shell` / `ui.integration.sample-console` | record render→primitives, the existing admin-shell→render plus admin-shell→display-context/input edges, and sample-console→admin-shell; reject any reverse render→admin-shell edge |
| corresponding `package.json` files | `dependencies` / `plannedDependencies` | keep package declarations exactly equal to the updated skeleton graph |
| `tools/terminal-skeleton/check-static.mjs` | graph/package comparison | retain exact-edge and acyclicity checks for the new imports; no verifier bypass |
| `apps/terminal/ui/base/input/src/types/types.ts` | `InputFieldOptions` / `InputFieldResult` / `InputFieldRegistration` | nullable native ref, native-less field option, and `focusScopeId` |
| `apps/terminal/ui/base/input/src/hooks/useInputField.ts` | `useInputField` | virtual-only/native-less registration and result |
| `apps/terminal/ui/base/input/src/hooks/useInputFocusController.ts` | `focusField`/`blurField`/`notifyFocusBoundary` | null-ref path uses virtual controller without native focus; active top-layer scope gates business/admin focus |
| `apps/terminal/ui/base/primitives/src/types/types.ts` | `PrimitiveInputProps` | remove public keyboard suppression prop; add required semantic states |
| `apps/terminal/ui/base/primitives/src/components/PrimitiveInput.tsx` | `PrimitiveInput` | vendor-only wrapper and no caller suppression prop |
| `apps/terminal/ui/base/primitives/src/vendor/slots.tsx` | RN value imports/wrapper exports | centralize platform branch, Spinner/list/SVG slots, fixed keyboard suppression |
| `apps/terminal/ui/base/primitives/src/index.ts` | export list | full required primitive exports |
| `apps/terminal/kernel/base/platform-ports/src/types/platformPorts.ts` | `PlatformPortCapability` / `PlatformPortCapabilitySnapshot` | public method-level capability snapshot type without changing the port object shape |
| `apps/terminal/kernel/base/platform-ports/src/foundations/createPlatformPorts.ts` | `describePlatformPortCapabilities` / `createPlatformPorts` | descriptor available outside `__DEV__`; public reader is the production section's input |
| `apps/terminal/adapter/android/device/android/src/main/java/com/catering/v2s/terminal/adapter/android/device/TerminalDeviceModule.kt` | module device-info export | Android ID/device info without permission |
| `apps/terminal/adapter/android/device/src/implementations/androidDevice.ts` | `createAndroidDevicePort` | real getDeviceInfo and descriptor |
| `apps/terminal/ui/base/dev-host/src/implementations/webPlatform.ts` | `createWebPlatformPorts` | explicit unavailable device method descriptors |
| `apps/terminal/kernel/base/runtime/src/types/runtime.ts` | `RuntimeStateInput` / runtime fact transfer | immutable debug/startup fact contract |
| `apps/terminal/assembly/android/sample-terminal/App.tsx` | `SampleTerminalApp` props | explicit startup debug/form input |
| `apps/terminal/ui/base/admin-shell/src/index.ts` | module exports | stable admin-shell capability exports |
| `apps/terminal/ui/base/admin-shell/src/dependencies.ts` | dependency list | add only required render/input/ui-state/catalog dependencies |
| `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx` | `definedParts` | include production sample admin section in same catalog |
| `apps/terminal/ui/integration/sample-console/src/features/*/controls.tsx` | `DialogSurface`/literal status imports | compose existing primitives and semantic tokens |

## 10. Data migration

| migration | change | backfill | unique recovery fact | rollback |
| --- | --- | --- | --- | --- |
| `N/A_WITH_REASON` | no DB/schema/persisted admin state is introduced | `N/A` | all new facts are in-memory code contracts or existing DeviceInfo slot | source-level revert is Dexter-controlled; no data rollback exists |

## 10b. Seed design

### 10b.1 Affected seed file complete set

| seed file | why affected | treatment |
| --- | --- | --- |
| `N/A_WITH_REASON: this batch creates no business data, account, catalog database row, or backend state` | the sample section is an in-memory `UiCatalog` part, not a seed object; admin auth is local and read-only | no seed file, no executor, no reset/seed/start action |

### 10b.2 New feature and old adjustment

- New feature: `N/A_WITH_REASON`; no persisted object or environment fixture is required.
- Old feature adjustment: `N/A_WITH_REASON`; no existing seed shape is changed.
- Acceptance fixtures are not seed. Any focused catalog fixture must be built inside the focused test and must not be placed in a domain seed plan.

### 10b.3 Coverage and boundary

No seed branches exist to cover. `reset`, `seed`, `start`, and DEV are explicitly outside this task; this section does not authorize them.

## 11. Acceptance and focused scenario design

There is no backend HTTP route, so backend acceptance scenarios are `N/A_WITH_REASON`. The following are local focused/static scenario definitions; actual execution is recorded in `doc/evidence/platform/2026-09-12-v2s-terminal-admin-console-implementation-evidence-codex.md`. They are not Web/Android/release acceptance.

| scenario id | owner file | identity | fixture | request/action | business oracle |
| --- | --- | --- | --- | --- | --- |
| `surface-form-declaration` | `terminalSurfaces.test.ts` | parser module | portrait package with secondary; landscape two surfaces | parse both packages | portrait rejects secondary; landscape returns exact grouped surfaces |
| `physical-host-source-flow` | `sampleAssembly.test.tsx` | sample assembly | index 0/1, distinct source objects | create both surfaces | index 0 selects source 0 and host bool true; index 1 selects source 1 and host bool false; canvas mode remains independently derived |
| `layer-empty-container-selection` | `catalog.test.ts` | catalog selector | layer entry with `containerKeys=[]`, section entry with `admin.sections` | select layer and section contexts | layer is available only under layer semantics; section is not rendered as a screen; all dimensions filter exactly |
| `focus-transition-boundary` | `LayerStack.test.tsx` / input focused test | LayerStack/InputProvider | zero layers, then one, then two, then zero | open/close actual layer commands | one suspend on 0→1, none on 1→2, one restore on 1→0 |
| `device-identity-pure-derivation` | `adminPassword.test.ts` | pure helper | two IDs, unknown, hour boundaries | call pure verifier with parsed values | different known IDs produce different expected values; unknown accepts only fallback; known rejects fallback; three-hour window is explicit |
| `production-debug-source` | `runtimeFacts.test.ts` | assembly fact resolver | packaging/startup true/false combinations | resolve priority | production-mode debug true remains observable; default off; no mutable admin setter |
| `keyboard-retirement-shape` | `primitives.test.tsx` / input test | vendor/input | native-less and native registration cases | focus/password key action | public prop key absent; vendor fixed false; virtual value changes; no native keyboard path |
| `host-loading` | `SurfaceHostController.test.tsx` | render host | null/incomplete/usable snapshot | render states | loading node/spinner visible with no children, then children appear only after usable geometry |
| `dynamic-surface-replacement` | `surfaceLifecycle.test.tsx` | generic SurfaceRoot/SurfaceContext plus `admin-shell/AdminLayer` | business content + business layers + exact admin layer + focus/scroll | change physical index/form/mode, including LayerStack unmount of the old-mode child; separately emit a geometry-only/same-content snapshot with all four identity values unchanged | geometry recomputes; identity-bound `AdminLayer` cleanup dispatches exact `ADMIN_CONSOLE_LAYER_ID` in the previous display-mode state even when the old child unmounts; a same-value snapshot leaves the admin layer mounted with authentication/selection/scroll unchanged; business layer IDs/content state remain; auth/focus/admin scroll do not leak |
| `admin-real-controls` | `adminShell.test.tsx` | admin layer | catalog with three kernel + one sample entry | press launcher/keypad/verify/tab/close/reopen | shell opens through real control, content changes on tab, close removes layer, reopen returns login |
| `catalog-injected-section` | `sampleAssembly.test.tsx` | sample-console assembly | same production `definedParts` with/without sample entry | build each assembly | section appears/disappears through same catalog projection; no hard-coded list |
| `section-navigation-rejection` | `adminShell.test.tsx` | section command boundary | fake section attempts `showScreen` and `openLayer` | dispatch via section context | typed rejection; business screen/layer state unchanged |
| `port-method-capabilities` | `platformPorts.test.ts` / admin section test | platform ports factory | adapter with one real and one unavailable method | create descriptor snapshot/read section | rows show method-level state/source, including non-DEV source; no aggregate inference |

No scenario uses `response.ok`, a status-only assertion, a direct state setter, a hard-coded list, or a welcome-text-only assertion. Full visual acceptance remains a separate future evidence tier.

## 12. Undecided and blocked items

| item | current state | allowed now | forbidden now |
| --- | --- | --- | --- |
| Dexter wireframe/visual interaction decision | `OPEN` | review this Journey, IA, and interaction proposal | implementation or visual PASS claim |
| two fresh independent design review rounds | `ROUND_2_NO_GO_FINAL (6M/2S/2N after Dexter rulings)` | no third round in this cycle; revised bytes require a new review cycle before GO | author self-review counted as independent |
| exact test-ID string freeze | `OPEN` | use proposal IDs as review inputs | L2 binding or runtime assertions before review |
| detailed visual spacing/copy | `OPEN` | maintain draft copy/layout labels | silently treat draft as approved design |
| POC password hash exact byte formula | `SOURCE_REOPENED_AND_FROZEN_NO_RUNTIME_EVIDENCE` | focused implementation may use the exact formula/vectors in CP-04 | invent a replacement algorithm or claim runtime/source equivalence beyond the reopened POC |
| primitive list bound | `FOCUSED_PASS (N-2)` | retain hard ceiling 24 and preserve the 100-row scroll-transition proof | claim headroom or visual acceptance from the focused proof |
| Android native runtime proof | `OPEN_BY_AUTHORIZATION` | plan future native/Android evidence separately | run Android in this task |

The requirements owner has now reconciled A-19 with the Dexter ruling: no independent owner/order metadata is present, and filtered order is the single catalog list order. This is a source-alignment fact, not an execution or behavior proof.

These are review/authority gates, not permission to add a new product contract. The accepted requirements provide the behavioral shape; the exact POC derivation formula must be reopened before implementation if it is not already captured in a local authoritative source.

## 13. Stop conditions

Stop and return to Dexter if any of the following occurs:

- the wireframe changes launcher, login, section navigation, close/reopen, or dynamic-switch behavior;
- a design review identifies a second source of truth, a wrong owner, a hidden write, or a method/port capability conflation;
- a required current source symbol cannot be reopened or has drifted so the anchor is not unique;
- a focused proof needs Web, Android, native, release, DEV, seed, UAT, or deployment authority not present in the current task;
- a plan row would need a backend route, migration, seed, transport gateway, or permission change;
- any stage reconciliation is `OPEN`, any code↔design line is `OPEN`, or a reviewer is not fresh/independent;
- the POC password derivation source cannot be located and the design would otherwise invent a formula.

## 13b. Implementation rhythm and three-dimensional reconciliation

Every CP/step must finish its focused/static proof and a separate stage reconciliation before the next CP starts. The reconciliation has three dimensions:

| dimension | compare |
| --- | --- |
| requirements | business goal, accepted decisions, explicit exclusions, A/CT/ID/DBG/PR clauses |
| design/IA | this document plus IA/interaction artifacts, owner points, failure/recovery, test IDs |
| project memory | all six-dimension routed memory entries, frontend/input/render/display/admin constraints, and known failure patterns |

Each stage record contains only `MATCHED` or `OPEN`, lists the exact path/symbol checked, and stops on any `OPEN`. After all CPs, a fresh whole-batch three-dimensional reconciliation is performed before overall tests. It is not a summary of stage records.

## 13c. Required code ↔ design reconciliation (performed by the implementation plan)

The companion implementation plan must contain a dedicated delivery gate, not a closing note:

- scope: every changed production/test/source line in the implementation diff, not a sample;
- executor: main agent only, after all source changes and before any Dexter/Claude implementation review;
- compare: current code line/statement, this design anchor, IA/interaction requirement, owner/failure/a11y behavior;
- result vocabulary: only `MATCHED` or `OPEN`;
- gate: any `OPEN` means `IMPLEMENTATION_READY=false` and the work cannot be delivered for implementation review;
- evidence: the line-by-line record is delivered with the plan/review package;
- no Git operation is part of this gate.

## 14. Design self-check

| check | current result |
| --- | --- |
| fixed §3 row set retained | `MATCHED` in this document |
| all §3 applicable sets enumerated | `MATCHED` in the current-byte source/consumer inventory and companion evidence; future L2 bindings remain outside scope |
| IA/interaction facts word-for-word | `MATCHED` for shared dimension/lifecycle block; visual copy remains draft |
| seed complete set | `MATCHED=N/A_WITH_REASON` |
| no backend operation omitted | `MATCHED=N/A_WITH_REASON` |
| all 59 current criteria have plan rows | `MATCHED` in the requirements/plan matrix; actual execution and partial/not-run status are in the companion evidence |
| stage reconciliation defined | `MATCHED` |
| code↔design gate in plan | `MATCHED` in the companion evidence; independent implementation review remains NOT_RUN |
| evidence tiers separated | `MATCHED` |
| round-2 independent design review | `NO-GO (6M/2S/2N after Dexter rulings)`, final `SELF_DECIDED`; archived at `doc/review/platform/2026-09-11-v2s-terminal-admin-console-design-independent-review-round-2-codex.md`; revised bytes are not covered by that report |
| implementation authority | `true` under current Dexter authorization; no runtime-tier expansion |
