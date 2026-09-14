# TER terminal admin console and primitives implementation plan

SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

## 0. Metadata and authorization

```text
BUSINESS_SOURCE=doc/plans/platform/2026-09-11-v2s-terminal-admin-console-and-primitives-requirements-claude.md
DESIGN_SOURCE=doc/plans/platform/2026-09-11-v2s-terminal-admin-console-implementation-design-codex.md
JOURNEY_SOURCE=doc/decisions/2026-09-11-v2s-terminal-admin-console-journey-proposal-codex.md
IA_SOURCE=doc/plans/platform/2026-09-11-v2s-terminal-admin-console-ia-design-codex.md
INTERACTION_SOURCE=doc/plans/platform/2026-09-11-v2s-terminal-admin-console-ui-interaction-design-codex.md
AUTHORIZED=source implementation, tests, and implementation evidence within this plan; no runtime-tier expansion
NOT_AUTHORIZED=generated contract, migration, seed, build, Web, Android, native runtime, DEV, L2, UAT, deployment, Git
IMPLEMENTATION_AUTHORITY=true (current Dexter authorization)
PLAN_STATUS=IMPLEMENTATION_COMPLETED_WITH_SEPARATE_RUNTIME_AND_REVIEW_OPEN_ITEMS
INDEPENDENT_DESIGN_REVIEW=ROUND_2_NO_GO_FINAL (6M/2S/2N after Dexter rulings)
HISTORICAL_REVIEW_STATUS=NO-GO; revised bytes are not covered by historical round 2
REMEDIATION_INTAKE=doc/review/platform/2026-09-11-v2s-terminal-admin-console-design-remediation-intake-codex.md
CONSUMER_FACE=public (terminal-local operator surface; not a web admin face)
CODE_DESIGN_RECONCILIATION=MATCHED (main-agent current-byte reconciliation; see implementation evidence)
EVIDENCE_STATUS=IMPLEMENTATION_FOCUSED_STATIC
```

This document is the serial implementation plan and current implementation record. It does not authorize
generated contracts, migrations, seed, Web/Android/native runtime, DEV, L2, UAT, deployment, or Git actions.
Implementation and focused/static evidence are recorded separately from Web, Android, native, release, and
visual evidence; a plan line is not itself proof.

## 1. Real goal and alternatives

The batch must make a local read-only terminal diagnostic overlay truthful and usable across laptop/mobile form, physical display, canvas mode, host readiness, input ownership, device identity, debug state, and catalog registration. The important outcome is one consistent source of facts and one existing owner for each behavior; a visually complete shell built on stale or guessed facts is a failure.

The selected architecture is the catalog projection + physical-index integration boundary + existing LayerStack/InputController approach described in the detailed design. It is chosen over:

- a hard-coded admin section array, because it would not prove the production registration path and would duplicate `UiCatalog`;
- a route/menu plus native input, because it creates another navigation/input owner and caller-dependent system-keyboard suppression;
- a separate admin service/registry with persisted session, because the current need is local, read-only diagnostics and persistence would violate re-authentication and layer-local state.

The smaller solution is to add only the missing dimensions, facts, vendor slots, and shell-local state at their current owners. Section ordering comes from the filtered single catalog list; no admin metadata/order object is added. No backend route, database shape, transport gateway, second registry, second overlay stack, second input pipeline, or `DialogSurface` is part of this plan.

## 2. Ordered CP/step table

The order below is fixed by the requirements' §11.3. Each step stops at its own proof and three-dimensional reconciliation; later steps cannot absorb an earlier `OPEN`.

| Step | Layer | Owner/source area | Output | Must follow | Must precede |
| --- | --- | --- | --- | --- | --- |
| 1 / CP-01 | shape source | terminal surface parser, sample integration, dev-host, Android app input | explicit `surfaceForm`, portrait PRIMARY-only declaration, grouped surface creation retaining physical index | none | all contract work |
| 2 / CP-02 | atomic contract | input, primitives, vendor, render snapshot | system keyboard retired; input/render/primitive public contract synchronized | step 1 | step 3 |
| 3 / CP-03 | contract / pre-probe | catalog, render, display-context, integration | form/layer selector semantics and physical host flow | step 2; CT-2 source first | capability and consumer work |
| 4 / CP-04 | capability | platform ports, Android adapter/module, assembly, admin pure function | one startup identity read and synchronous password verifier | step 3 | debug fact |
| 5 / CP-05 | capability | runtime/assembly/render context | explicit packaging/startup debug fact | step 4 | primitives |
| 6 / CP-06 | foundations | vendor/primitives/theme and existing control consumers | complete required primitives and semantic tokens | step 5 | loading/dynamic work |
| 7 / CP-07 | foundation add-on | render host, SurfaceRoot/SurfaceContext, input/layer lifecycle | explicit loading state and generic dynamic surface identity lifecycle; admin-specific cleanup is consumed in step 8 | step 6 | admin consumers |
| 8 / CP-08 | consumers | admin-shell, sample-console, same catalog | shell, three kernel sections, production injected sample section | step 7 | final proofs |
| 9 / CP-09 | closeout | test/static artifacts and fresh reviewers | all focused stage proofs, reconciliations, two review rounds | step 8 | Dexter/Claude review only after gates |

The focus pre-probe is part of step 3 and runs before admin-shell exists: one `InputProvider` plus one input-bearing layer exposes the existing surface-level focus boundary. The full A-15 path is after step 8, when the real admin layer exists. Steps 6–8 remain strictly serial.

## 3. Cross-cutting mechanism plan

The detailed design's §3 is the value source. The plan uses the same fixed rows and does not create a competing mechanism.

| 机制 | existing capability / exact source | planned observation | no-existing-capability shape | complete in-batch applicability |
| --- | --- | --- | --- | --- |
| read-side authorization | `apps/terminal/ui/base/render/src/contexts/RenderContext.ts#RenderContextValue`; `apps/terminal/ui/base/render/src/types/props.ts#RenderProviderProps` | static context/import check; focused section reads only frozen facts | match `RenderProvider` transfer and state-source read ownership | launcher, login, shell, four sections, display/port/runtime reads |
| write authorization/grant | `apps/terminal/kernel/base/ui-state/src/features/actors/contentActors.ts#createShowScreenActor/createOpenLayerActor`; `apps/terminal/kernel/base/ui-state/src/features/commands/openLayer.ts#openLayer` | static command imports; focused section navigation gets typed rejection | match owner command API, no direct state setter | open/close layer, local selection, transient cleanup |
| cross-owner writes/transaction | `AGENTS.md` owner/transaction boundary | static no HTTP/DB/mutation source | `N/A_WITH_REASON` no business write | all admin operations |
| collection/paging | `apps/terminal/kernel/base/ui-state/src/types/catalog.ts#UiCatalogEntry`; `apps/terminal/kernel/base/ui-state/src/foundations/catalog.ts#selectAvailableParts` | exact identity/filter focused test; list order is preserved; no second list | readonly frozen array, bounded four-entry initial collection; generic list hard ceiling 24 with 100-row transition proof | built-in three plus sample injection and future same-catalog additions |
| cache invalidation | `apps/terminal/kernel/base/ui-state/src/foundations/workspaceSlices.ts`; layers non-persisted | close/reopen and surface replacement focused test | match layer-local state and content persistence | auth, selection, password, focus, scroll, transient layers |
| RTK read/loading | frontend standard §3-B | static no RTK; host readiness from snapshot/geometry | `N/A_WITH_REASON` no HTTP/RTK | host loading and local section pending only |
| one address per fact | frontend standard §3-E; catalog foundation | static same catalog/source map; focused injection/index | match canonical catalog and SurfaceRoot context | dimensions, host/source, sections, device/debug, readiness |
| visible unchanged failures | frontend standard §3-D; SurfaceHostController | focused distinct typed loading/password/descriptor/nav states | match existing fallback/diagnostic shape | all local failures |
| host identity mismatch | `apps/terminal/ui/base/render/src/foundations/surfaceHost.ts#bindSurfaceHostIdentity` | focused primary/non-host fixture observes typed `surface.host-identity-rejected` while the canvas stays pending | preserve the distinction between ordinary not-ready and a contradictory physical host fact | host/source binding |
| owner-to-HTTP error map | backend standard §1-D/§2-B | static no route/problem registration | `N/A_WITH_REASON` no backend operation | no HTTP |
| idempotency/replay | frontend standard §3-G | static no mutation/idempotency key | `N/A_WITH_REASON` local non-business layer commands | all admin actions |
| generated strings | frontend standard §2-D; existing exports | static no OpenAPI/URL string; test IDs from one module | match source-of-truth exports | keys, IDs, typed local error codes |
| logs/masking | `AGENTS.md`; runtime startup logging | static forbidden-value scan; future focused log read | match structured runtime logger, boolean/source/availability only | startup debug/device diagnosis and typed render diagnostics |
| migration/backfill | migration rules | static no migration file | `N/A_WITH_REASON` in-memory only | all steps |
| shared frontend behavior | `libraries/frontend/admin-ui-foundation` plus terminal `LayerStack/InputController/vendor` | static applicability check; focused terminal owner tests | `N/A_WITH_REASON` web foundation does not own RN terminal surface | layer, list, form, scroll, loading |
| candidate/dropdown source | `apps/terminal/kernel/base/ui-state/src/foundations/catalog.ts#selectAvailableParts` | injected entry appears/disappears through selector | match exact dimension filter, including null layer placement | section options only |
| naming/presentation | `apps/terminal/ui/base/render/src/foundations/definePart.ts`; sample `#definedParts` | static unique keys/catalog fields; focused title from catalog | match frozen field copy-through; no admin order metadata | console, four sections, primitive labels |
| atomic groups | `foundation-charter.md#§5-C` | static CP-02 change set and no intermediate state | match package ownership and atomic contract change | keyboard/input/render IME retirement |

## 3a. UI/testID admission before any future L2 work

```text
UI_DESIGN_REVIEW=OPEN
TESTID_REVIEW=OPEN
L2_SCRIPT_ADMISSION=BLOCKED
```

The UI is present in the design scope, but L2 execution is not authorized and no accepted visual review exists. Before any L2 spec or binding is written, the main agent must reopen the requirements, Journey, IA, interaction artifact, frontend standard, current UI source, and actual consumers of `libraries/frontend/admin-ui-foundation`; then complete every row below with a real node and fresh independent review. Proposed test IDs are capability names and must live in the one source module.

| action | real control | owning source | test-ID source | node requirement | focused/static gate | current result |
| --- | --- | --- | --- | --- | --- | --- |
| invoke | logical gesture observed on business-content ancestor | `apps/terminal/ui/base/admin-shell/src/components/AdminLauncher.tsx#AdminLauncher` | `apps/terminal/ui/base/admin-shell/src/foundations/adminTestIds.ts#adminTestIds.launcher` | stable plain `View` observes bubbled `onTouchEnd`; no own `Pressable`/responder negotiation/consuming handler | logical-coordinate gate + real descendant control + launcher focused test | MATCHED: focused |
| enter digit | shared virtual-keyboard buttons | `apps/terminal/ui/base/input/src/components/VirtualKeyboard.tsx#VirtualKeyboard` | `ui.base.input:virtual-keyboard:text-<n>` | actual input-owner button | sample-console focused test | MATCHED: focused |
| delete | shared virtual-keyboard backspace | `VirtualKeyboard` | `ui.base.input:virtual-keyboard:backspace` | actual input-owner button | input focused test | MATCHED: focused |
| verify | verify button | `AdminLogin` | `adminTestIds.verify` | actual button | login focused test | MATCHED: focused |
| close | close button | `AdminLogin`/`AdminShell` | `adminTestIds.close` | actual button | close/reopen focused test | MATCHED: focused |
| select sections | tab/segment option anchor | `apps/terminal/ui/base/admin-shell/src/components/AdminSectionNavigation.tsx#AdminSectionNavigation` | `adminTestIds.sections.*` | visible option/action node | sample-console focused test | MATCHED: focused for runtime/sample; implementation for platform/display |
| observe loading | loading View/Spinner | `apps/terminal/ui/base/render/src/components/SurfaceHostController.tsx#SurfaceHostController` | `ui-base-render:surface-host-loading-indicator` | stable loading node | render loading focused test | MATCHED: focused |

Any missing row keeps L2 blocked. Role, label, text, index, CSS/XPath, wrapper, or direct state setter cannot replace the real node.

## 4. Detailed serial steps

### Step 1 — shape source and grouped surfaces

#### Pre-read and source inventory

Reopen:

- requirements §3.1, CT-1, CT-2;
- `apps/terminal/ui/integration/sample-console/src/application/terminalSurfaces.ts#parseTerminalSurfacePackage`;
- `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx#SampleAssembly/createSurfaceForDisplayIndex/createSampleAssembly`;
- `apps/terminal/ui/integration/sample-console/test-expo/App.tsx#TestExpoAssembly`;
- `apps/terminal/ui/base/dev-host/src/components/testExpoApp.tsx#TestExpoAssembly`;
- `apps/terminal/assembly/android/sample-terminal/App.tsx#SampleTerminalApp`;
- the current terminal surface JSON/package declarations.

#### Planned changes

1. Add a non-empty `surfaceForm`/`SurfaceForm` declaration at the terminal-surface source. Do not infer form from width or a UI label.
2. Make portrait declarations accept PRIMARY only and reject any SECONDARY entry. Keep landscape as the two-display form.
3. Replace display-mode-only creation at the integration/dev-host boundary with a capability-named input carrying the physical `displayIndex`. Preserve the index until the assembly selects the host source and derives `isHostPrimaryDisplay`.
4. Keep canvas selection by `displayMode`. The physical source map and canvas map must be distinct values.
5. Make Android app startup take explicit direction/form input rather than hard-code it. This is an input contract change only; no Android run occurs now.
6. Add the Web dev-host's `laptop`/`mobile` view radio group when a portrait declaration exists. A changed selection is written to the `surfaceForm` URL parameter and reloads the Web page so the next assembly starts once with the selected form; the existing laptop-only `surfaceMode` is presented as one radio group with mutually exclusive single/dual options and remains an in-runtime SECONDARY mount selector. Render the width range, view radio, and surface-mode radio as one centered row below the title/status row.
7. Add a Web-only `surface 宽度` range control in the existing host header. Clamp it to 30%–100% of the measured preview content width and feed that selected width into the existing uniform-ratio geometry calculation; do not change logical surface declarations, assembly state, input coordinates, or Android behavior.

#### Gate

- red: a portrait package containing secondary parses successfully, or a source lookup is keyed by `displayMode`.
- invariant: index 0 is host, index 1 is non-host; portrait has no secondary; both form and index are transferred from one declaration/boundary.
- proof: static parser/source-key/AST checks plus focused parser/assembly tests later; no Web/Android result in this task.
- reconciliation: requirements §3/CT-1/CT-2 ↔ design §7/§9b ↔ routed memory display-context/logical-canvas constraints; only `MATCHED` may open step 2.

### Step 2 — atomic system keyboard retirement

#### Pre-read and source inventory

Reopen:

- `apps/terminal/ui/base/input/src/types/types.ts#KeyboardKind/InputFieldOptions/InputFieldResult/InputController`;
- `apps/terminal/ui/base/input/src/hooks/useInputField.ts#useInputField`;
- `apps/terminal/ui/base/input/src/hooks/useInputFocusController.ts#useInputFocusController`;
- `apps/terminal/ui/base/input/src/components/InputProvider.tsx#InputProvider`;
- `apps/terminal/ui/base/primitives/src/types/types.ts#PrimitiveInputProps`;
- `apps/terminal/ui/base/primitives/src/components/PrimitiveInput.tsx#PrimitiveInput`;
- `apps/terminal/ui/base/primitives/src/vendor/slots.tsx#RnrTextInput`;
- render snapshot/IME symbols and Android IME coordination source/tests.

#### Planned changes — one atomic group

1. Delete the system-keyboard owner and branch from `apps/terminal/ui/base/input/src/types/types.ts` (`KeyboardKind`, keyboard-owner state) and from every consumer found by a fresh symbol inventory.
2. Extend the existing input registration/result only with the smallest capability-named native-less path: nullable native ref plus `focusScopeId` (default `business`). Freeze the virtual branch as `inputRef: RefObject<TextInput | null> | null`, preserve the existing keyboard-kind/layout/max-length requirements, and add `InputController.activateFocusScope(scopeId)` as the sole scope transition API. Preserve `InputController` and virtual keyboard state as the sole owner; do not add a second keyboard service.
3. Make `apps/terminal/ui/base/input/src/hooks/useInputField.ts#useInputField` return the virtual-input result for the admin password field without a native `TextInput`; its one string remains the only password state. A successful virtual focus sets active virtual keyboard state even when the native ref is null; native `.focus()` is attempted only if a ref exists. `complete` follows the same rule and must not silently convert virtual focus to a failed action.
4. Remove `showSoftInputOnFocus` from `apps/terminal/ui/base/primitives/src/types/types.ts#PrimitiveInputProps`, `PrimitiveInput`, public exports, and all caller props.
5. Move the fixed system-keyboard suppression into `apps/terminal/ui/base/primitives/src/vendor/slots.tsx#RnrTextInput`; vendor owns the platform branch and fixed value. A caller-level `false` snapshot is not an acceptance substitute.
6. Remove the complete render-side and Android IME contract set in the same atomic group: `SurfaceHostImeSnapshot`, `calculateSurfaceHostImeInset`, `SurfaceHostImeContext`, `SurfaceHostController` IME consumption, Android adapter `snapshot.ime` parsing, Kotlin `TerminalSurfaceHostSnapshot.imeVisible`/`imeBottomLogicalBeforeCanvasScale`, `TerminalImeInsetsCoordinator`, and IME event/module fields. Retain only virtual keyboard metrics, `InputScrollArea`, `viewportAlreadyShrunk`, and the capability-named focus/scroll inputs required by the non-IME path.
7. Update `apps/terminal/ui/base/input`, `apps/terminal/ui/base/render`, and `apps/terminal/ui/base/primitives` structure snapshots, public exports, README/invariant surfaces, and focused truth-table fixtures together. No intermediate state may be accepted or used by a later step.
8. Expose one shared `InputKeyboard` presenter with `keyboardPlacement: 'surface' | 'field'`. `surface` is mounted once by `InputSurfaceFrame`; `field` is mounted by the consuming card/field layout. Both placements must use the same provider, owner, controller, renderer, and value state; a placement mismatch renders nothing. Do not expose `VirtualKeyboard` as a feature-level alternative or require per-mode keyboard handlers, dimensions, focus logic, or value state.

#### Focus pre-probe before admin shell

Before step 3 starts, render the smallest existing `InputProvider` plus one input-bearing layer and run the focus transition probe. It must show one surface suspend on 0→1, no second suspend on 1→2, and restore on 1→0. If it is red, stop before catalog consumer work.

The pre-probe is not an admin-shell visual or Android proof. It only proves the surface-level boundary and must also assert that a top `admin.console` scope can receive a native-less virtual focus while the surface-level suspension flag remains true; business scope is rejected while it is not topmost.

#### Gate

- red: any public suppression prop/system owner/IME snapshot field remains, or native-less focus creates a second keyboard implementation.
- invariant: virtual input is the only keyboard owner; vendor is the only value import/branch point; render snapshot is synchronized.
- proof: static exact-key/import checks and a focused before/after predicate truth-table. Compare the actual `imeVisible=true/false` input rows before retirement with the post-retirement `imeVisible=false` set; do not use a constant geometry equality as proof. Native/Android proof is future.
- reconciliation: requirements §6/CT-3/CT-6 ↔ design CP-02 and input matrix ↔ memory keyboard/input rules; only `MATCHED` opens step 3.

### Step 3 — catalog, layer semantics, and physical host gate

#### Pre-read and source inventory

Reopen:

- `apps/terminal/kernel/base/ui-state/src/types/catalog.ts#UiCatalogEntry/UiCatalogContext`;
- `apps/terminal/kernel/base/ui-state/src/foundations/catalog.ts#createUiCatalog/selectAvailableParts/assertEntryKeys`;
- `apps/terminal/ui/base/render/src/foundations/definePart.ts#definePart`;
- `apps/terminal/ui/base/render/src/components/resolvePart.ts#resolvePart`;
- `LayerStack.tsx#LayerStack`, `ScreenContainer.tsx#ScreenContainer`, `SurfaceRoot.tsx#SurfaceRoot`;
- `apps/terminal/ui/base/render/src/contexts/SurfaceContext.ts#SurfaceContextValue`;
- display-context derivation and current sample assembly.

#### Planned changes

1. Add required `SurfaceForm` to the catalog context and every entry. Keep the catalog entry's exact-key shape free of `AdminSectionMetadata` and order fields; `admin.sections` in `containerKeys` identifies section placement and the filtered `UiCatalog.entries` list order is the only section order. Update `definePart`, `approvedEntryKeys`, `assertEntryKeys`, `canonicalEntry`, and every current fixture/call site atomically.
2. Define the layer placement predicate at the command owner: `containerKey=null` means a layer-only selection and requires `entry.containerKeys.length===0`; a non-null container requires exact non-empty container match. All four dimensions must match in both cases.
3. Make `createUiStateModule` initialize one assembly-owned `surfaceForm` slice with `persistIntent=never` and `syncIntent=isolated`, expose `selectSurfaceForm(root)`, and pass its immutable catalog/state-derived context into `apps/terminal/kernel/base/ui-state/src/features/actors/contentActors.ts#createOpenLayerActor`. Before dispatching the existing `openLayer` reducer, that actor calls the shared predicate with `containerKey=null`; an unavailable entry returns typed `layer-part-unavailable` and performs no state write. `LayerStack`/`resolvePart` use the same predicate only as render-time defense. There is no separate React-only form prop or open-layer payload form field.
4. Reuse one shared availability predicate in `selectAvailableParts`, the command admission actor, `ScreenContainer`, `LayerStack`, and `resolvePart` fallback. Do not add a second selector or registry.
5. Have `RenderProvider`/`SurfaceRoot` read `surfaceForm` through `selectSurfaceForm(root)` from the same `ui-state` source and transfer it with the frozen `isHostPrimaryDisplay` into `SurfaceContext` and `SurfaceHostSnapshot`. The bool is derived once from physical `displayIndex` at the integration boundary; it is not derived from display mode or instance mode.
6. Make the integration source lookup use `surfaceHostSourcesByDisplayIndex`, with `SurfaceHostSnapshot.surfaceIdentity` retaining `{surfaceKey, displayIndex, surfaceForm, displayMode}`. Keep the canvas group lookup by `displayMode`; these maps must not be collapsed.
7. Ensure `LayerStack` performs the compatibility filter before resolving a layer, while the actor remains the admission owner. A late fallback remains a defensive guard, not the primary state invariant.
8. Update every current `definePart` call site found by a fresh AST/search inventory. Do not trust the requirement's old call-site count; freeze the actual current set before edits and include test factories.

#### Gate and pre-probe

- red: a layer entry with `containerKeys=[]` is rejected at `openLayer`, a mobile-only section renders on laptop, host bool follows `displayMode`, or source selection follows mode.
- invariant: one catalog/source of dimensions; layer semantics are explicit at command admission; index 0/1 chain remains intact through snapshot and SurfaceContext.
- proof: static/AST call-chain and focused catalog/index/state-admission tests, including the no-state-write rejection; Web/Android not executed now.
- reconciliation: requirements CT-1/CT-2/CT-4/AC-0 ↔ design §7/§9b ↔ memory logical-canvas/selector rules; no `OPEN` advances.

### Step 4 — device identity and authentication pure functions

#### Pre-read and source inventory

Reopen:

- `apps/terminal/kernel/base/platform-ports/src/types/device.ts#DeviceInfo/DevicePort`;
- `apps/terminal/kernel/base/platform-ports/src/foundations/createPlatformPorts.ts#describePlatformPortCapabilities/createPlatformPorts`;
- Android adapter `apps/terminal/adapter/android/device/src/implementations/androidDevice.ts#createAndroidDevicePort`;
- `apps/terminal/adapter/android/device/android/src/main/java/com/catering/v2s/terminal/adapter/android/device/TerminalDeviceModule.kt`;
- `apps/terminal/ui/base/admin-shell/src/foundations/adminPassword.ts#deriveAdminPassword/verifyAdminPassword` (new design anchor);
- the POC derivation source named by the discussion document; if it cannot be reopened, stop and do not invent a replacement formula.

#### Planned changes

1. Implement native `getDeviceInfo` in the existing Android module using the existing `DeviceInfo.deviceId` slot and no runtime permission. Keep raw native details out of UI/logs; return the accepted stable/redacted ID shape.
2. Make the Android adapter map that result to a real method-level capability descriptor. Keep other methods unavailable where they are unavailable; do not describe the whole port as one boolean.
3. Add public `PlatformPortCapability`/`PlatformPortCapabilitySnapshot` types in `apps/terminal/kernel/base/platform-ports/src/types/platformPorts.ts` and public `describePlatformPortCapabilities(ports)` in `apps/terminal/kernel/base/platform-ports/src/foundations/createPlatformPorts.ts`. Every binding (Android, Web, and default) supplies descriptor data in every build; each method carries `state` and `source`, and the descriptor is the platform section's read input.
4. In assembly startup, await the existing `getDeviceInfo` exactly once per `createSampleAssembly`/assembly instance. Store only a frozen normalized availability/value fact for the render context. Do not change `DevicePort` to synchronous; the lifecycle boundary is one assembly instance, not every render or login.
5. Use the external POC only as a human traceback recorded by the upstream discussion; no absolute filesystem path is an implementation dependency. Implement synchronous `deriveAdminPassword`/`verifyAdminPassword` with the exact formula: local `YYYYMMDDHH` using `getFullYear/getMonth/getDate/getHours`, `seed=deviceId+formatHour(date)`, UTF-16 code-unit loop `hash=(hash*131+seed.charCodeAt(index))>>>0` from zero, `numeric=\`${hash}${seed.length*97}\``, `numeric.slice(-6).padStart(6,'0')`, and local hour offsets `[-1,0,1]`. The pure function accepts parsed identity/current-hour input and enforces the unknown-only `123456` fallback. For `localDate=2026-09-10`, freeze vectors `DEVICE-001` at local hours 09/10/11/12 → `211940/431940/441940/451940` and `DEVICE-002` at local hour 10 → `201940` in the focused fixture; construct local time explicitly. These are source-reopened vectors, not runtime evidence.
6. Do not log raw device ID or password. Log only availability/source/fallback-used diagnostics according to the existing structured logger.

#### Gate

- red: two IDs produce the same hard-coded result, login invokes the port, known identity accepts fallback, a method descriptor disappears in a non-DEV build, or a permission/second port is added.
- invariant: one startup await per assembly, pure verifier, existing port contract, public method-level descriptors, and distinct unknown/known branches.
- proof: static call-count/type/privacy/non-DEV descriptor checks and focused fake-ID/truth-table tests; Android/native/restart/data-clear proof is future.
- reconciliation: requirements ID-1/ID-2/AC-2 ↔ design CP-04 ↔ memory device identity/privacy rules; no `OPEN` advances.

### Step 5 — explicit debug runtime fact

#### Pre-read and source inventory

Reopen:

- `apps/terminal/kernel/base/runtime/src/types/runtime.ts#RuntimeStateInput/Runtime`;
- `apps/terminal/kernel/base/runtime/src/createRuntime.ts#startup logging`;
- `apps/terminal/assembly/android/sample-terminal/App.tsx#SampleTerminalApp`;
- sample assembly runtime/platform setup and `apps/terminal/ui/base/render/src/contexts/RenderContext.ts#RenderContextValue`.

#### Planned changes

1. Define a narrow frozen `RenderRuntimeFacts` value containing `environmentMode`, `debugMode`, identity availability, and capability snapshot; do not expose setters.
2. Accept explicit packaging and startup debug sources at the assembly boundary. Freeze `DebugModeSource = 'startup' | 'packaging' | 'default'`; `resolveDebugMode({startup, packaging})` chooses startup whenever it is defined, including `false`, otherwise packaging whenever it is defined, otherwise `{enabled:false, source:'default'}`. The complete input/output matrix is: `(undefined,undefined)→off/default`, `(undefined,true)→on/packaging`, `(undefined,false)→off/packaging`, `(true,undefined)→on/startup`, `(true,true)→on/startup`, `(true,false)→on/startup`, `(false,undefined)→off/startup`, `(false,true)→off/startup`, `(false,false)→off/startup`.
3. Pass the same fact into RenderContext so a non-admin consumer can read it; do not make `admin-shell` the only source or consumer.
4. Add a structured startup diagnostic with only boolean/source/availability fields. The fact path is not removed by production dead-code gating.
5. Render the runtime section's state from the fact and existing `stateSource.getStatus()`. No switch or persistence is introduced.

#### Gate

- red: `__DEV__`/`EnvironmentMode` is the debug fact, all sources are hard-coded DEV, or production cannot express debug on.
- invariant: one immutable source resolution, explicit startup-over-packaging priority, default off, no mutation, no secrets.
- proof: static source-branch check and focused production-mode nine-row priority matrix; release proof is future.
- reconciliation: requirements DBG-1..DBG-6/CT-7 ↔ design CP-05 ↔ memory runtime/observability rules.

### Step 6 — vendor, primitives, semantic tokens, and existing consumer migration

#### Pre-read and source inventory

Reopen:

- `apps/terminal/ui/base/primitives/src/index.ts`;
- `apps/terminal/ui/base/primitives/src/types/types.ts`;
- existing primitive components;
- `apps/terminal/ui/base/primitives/src/vendor/slots.tsx`;
- `apps/terminal/ui/feature/sample-member-desk/src/components/controls.tsx`;
- `apps/terminal/ui/feature/sample-staff-auth/src/components/controls.tsx`;
- frontend coding standard and foundation charter;
- all current primitive imports/value imports and theme sources.

#### Planned changes

1. Keep all React Native value imports and RNW branching in vendor slots. Add only the needed `VirtualizedList`, `ActivityIndicator`, SVG/icon, and existing wrapper sources. No component-layer platform/host-size probe.
2. Export the exact required bounded primitive set through `apps/terminal/ui/base/primitives/src/index.ts`: `Text`, `Heading`, `Label`, `CodeBlock`; `Container`, `Card`, `Divider`, `Stack`, `Grid`, `Center`; `Button`, `Input`, `CodeInput`, `Checkbox`, `Radio`, `Switch`, `Select`, `Textarea`, `FormField`; `Spinner`, `InlineAlert`, `EmptyState`, `Progress`, `Skeleton`; `Badge`, `KeyValueRow`, `StatusRow`, virtualized `List`, `Table`, `Tabs`, `SegmentedControl`; and the existing `Status`, `Actions`, `ScrollView` with the required updates. Do not add any PR-7 excluded overlay/date/media component.
3. Give each interactive primitive explicit role, label, disabled/pressed/selected/busy behavior. Busy/disabled actions must not invoke callbacks. `PrimitiveList` uses fixed-height rows with `visibleWindow=16`, `overscanBefore=4`, `overscanAfter=4`, and a hard `maxMounted=24`; the 100-record focused fixture samples after every scroll transition, exposes the first and last records without truncation, and never mounts more than 24 rows. The implementation proof is `N-2=FOCUSED_PASS`; it is bounded virtualization, not a shortened data array, and does not claim performance headroom or visual acceptance.
4. Add the semantic token matrix in the sample-console theme/global source and consume token names only. Remove literal colors and duplicate inline status styling from primitives/admin consumers.
5. Replace existing local `controls.tsx` declarations and `DialogSurface` usages with existing/new primitives composed as card + heading + content + actions. Use `InputScrollArea` for input-owned scrolling; do not add a second scroll/input/overlay owner.
6. Add/update README and terminal invariant/public export files for every changed package. README content must include positioning, purpose, structure, and usage; invariant/export changes match actual exports.
7. Retire any current primitive `react-native` value import outside vendor. Type-only imports remain allowed.
8. In the foundation graph/package pass, record the already-required owner edges `render → ui.base.primitives` (for host Spinner) and `admin-shell → kernel.base.display-context` / `admin-shell → ui.base.input` without adding any admin consumer implementation. Keep `sample-console → admin-shell` for step 8, when the production consumer is actually merged. Update `apps/terminal/skeleton-graph.ts`, the relevant manifests, and the exact-edge/acyclicity inventory together; no graph-check bypass is allowed.

#### Gate

- red: required primitive missing, literal color/value import remains, a primitive owns keyboard avoidance, or `DialogSurface`/overlay host appears.
- invariant: vendor-only platform slots, semantic tokens, complete a11y/disabled/busy behavior, existing consumers use base exports, and the list bound is observable.
- proof: static exports/import/token/README checks and focused primitive behavior tests; Web/Android visual proof is future.
- reconciliation: requirements PR-1..PR-7/CT-6/CT-7 ↔ design CP-06 ↔ memory frontend foundation/terminal input rules.

### Step 7 — host loading and dynamic surface lifecycle

#### Pre-read and source inventory

Reopen:

- `apps/terminal/ui/base/render/src/components/SurfaceHostController.tsx#SurfaceHostController`;
- `apps/terminal/ui/base/render/src/foundations/surfaceHost.ts#SurfaceHostSnapshot/calculateSurfaceHostGeometry`;
- `SurfaceRoot.tsx#SurfaceRoot`, `SurfaceContext.ts`, `LayerStack.tsx#LayerStack`;
- `apps/terminal/ui/base/input/src/components/InputProvider.tsx#InputProvider`;
- current layer/content persistence selectors and sample test-expo surface transitions.

#### Planned changes

1. Replace the pending empty View with a stable loading View/Spinner/label node. While snapshot/geometry is unavailable, children are not rendered. This state does not affect the host gate and is not a fail-open/fail-closed decision.
2. Recompute the host geometry and canvas transform from the current frozen `SurfaceIdentity={surfaceKey, displayIndex, surfaceForm, displayMode}` and snapshot; do not cache a display-mode-only source at mount. The lifecycle trigger compares the values of exactly `surfaceKey`, `displayIndex`, `surfaceForm`, and `displayMode`, never the identity object's reference; a geometry-only or same-content snapshot with all four values unchanged is not an identity replacement and must not close or reset `AdminLayer`.
3. On surface identity replacement, preserve the existing `SurfaceRoot` React identity and run only the generic render lifecycle: observe the new snapshot/geometry, blur the replaced surface's active field, update the context, and do not import admin-shell or copy an admin layer ID. Because `LayerStack` selects `selectLayers(snapshot.root, displayMode)`, a display-mode change can unmount the old `AdminLayer` before it observes the new context; the step-8 `admin-shell/AdminLayer` consumer therefore binds cleanup to the full identity effect and its unmount cleanup, using the effect closure's old `displayMode` and local `ADMIN_CONSOLE_LAYER_ID` to dispatch the existing `ui-state` owner command. `LayerStack` removes only that admin layer and its local auth/selection/scroll state; an ordinary-close cleanup is idempotent and must not touch business layers. Retain all business content and business layers in their owners. Do not call the current clear-all `clearLayers` operation or introduce an admin-specific overlay stack or whole-root remount.
4. Ensure focus restore/suspend remains surface-level and count-based. `notifyFocusBoundary` fires only on 0→1 and 1→0; `LayerStack` changes the active scope on 1→2/2→1 without another surface suspend/restore event. The full path will be tested with one business layer plus admin after step 8, using `ADMIN_CONSOLE_FOCUS_SCOPE_ID='admin.console'` and the exact native-less input contract.
5. Keep current canvas selection by `displayMode` while source selection remains physical-index based; switching identity must independently observe geometry, admin presence, focus, and scroll.

#### Gate

- red: pending host is blank/no label, children render behind it, the generic dynamic switch keeps stale geometry/focus/scroll or remounts the whole root, render imports/copies an admin identity, or the old-mode `AdminLayer` unmounts without dispatching exact cleanup. The admin-layer close remains a step-8 consumer gate.
- invariant: explicit loading; no gate semantic change; generic render preserves the root and business content/layers, while the later AdminLayer removes only the exact previous-mode admin layer and its local state.
- proof: focused script-driven loading/dynamic/focus tests later; Web/Android evidence remains separate and unavailable now.
- reconciliation: requirements AC3A/AC4/§3.3 ↔ design CP-07 ↔ memory logical canvas/runtime evidence boundaries.

### Step 8 — admin-shell, sections, and sample production consumer

#### Pre-read and source inventory

Reopen:

- `apps/terminal/ui/base/admin-shell/package.json`, `src/index.ts`, `src/dependencies.ts`;
- catalog/definePart/render/layer APIs from step 3;
- input APIs from step 2 and primitive exports from step 6;
- `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx#definedParts/createSampleAssembly`;
- existing feature parts and the sample assembly focused test;
- `SurfaceContext`/`SurfaceIdentity` contract from step 7, including the no-reverse-import boundary;
- the Journey/IA/interaction artifacts, including every proposed test ID.

#### Planned changes

1. Add capability-named admin-shell components and foundations:
   - `src/foundations/adminLauncher.ts#trackAdminGesture`;
   - `src/foundations/adminPassword.ts#deriveAdminPassword/verifyAdminPassword`;
   - `src/foundations/adminIdentity.ts#ADMIN_CONSOLE_PART_KEY/ADMIN_CONSOLE_LAYER_ID/ADMIN_CONSOLE_FOCUS_SCOPE_ID/ADMIN_SECTION_CONTAINER_KEY`;
   - `src/foundations/adminSectionSelection.ts#selectAdminSections/createAdminSectionCommandBoundary`;
   - `src/components/AdminLauncher.tsx`;
   - `src/components/AdminLayer.tsx`;
   - `src/components/AdminLogin.tsx`;
   - `src/components/AdminShell.tsx`;
   - `src/components/AdminSectionNavigation.tsx`;
   - `src/components/sections/PlatformPortsSection.tsx`;
   - `src/components/sections/RuntimeSection.tsx`;
   - `src/components/sections/DisplayContextSection.tsx`;
   - `src/foundations/adminTestIds.ts` (admin-owned nodes only; shared keypad IDs remain owned by `ui.base.input`).
2. Define one layer-only `admin.console` part with `containerKeys=[]`; launcher appears only on `isHostPrimaryDisplay` and opens this part through the existing UI-state command. Freeze `ADMIN_CONSOLE_PART_KEY='admin.console'`, `ADMIN_CONSOLE_LAYER_ID='admin.console.layer'`, `ADMIN_CONSOLE_FOCUS_SCOPE_ID='admin.console'`, and `ADMIN_SECTION_CONTAINER_KEY='admin.sections'` once in `src/foundations/adminIdentity.ts`; open, focus, renderer lookup, ordinary close, and replacement cleanup use the matching local constant rather than assuming `partKey` is a `layerId`. `AdminLayer` binds cleanup to the full `SurfaceContext` identity, captures the old `displayMode` in the effect closure, and dispatches the existing `closeLayer` owner command from effect cleanup both for in-place identity changes and for the old-mode unmount caused by `LayerStack`. An ordinary-close cleanup is idempotent. `SurfaceRoot` does not import admin-shell or contain a copied admin literal.
3. Export one `adminShellAssembly` containing the console layer plus the three built-in section parts/renderers. Define section entries with the fixed `admin.sections` container key, required `surfaceForm`, and existing dimensions only; the shell discovers them from the same `UiCatalog.entries` projection in list order and resolves renderers by the same catalog entry. There is no owner/order metadata object.
4. Keep login/auth/selected part/section scroll in the layer-local component state. Close unmounts it; reopen enters login. No persistence container receives these values.
5. Give `AdminSectionRenderContext` read-only facts and a navigation-rejecting command boundary. `showScreen` and `openLayer` attempts return typed rejection and do not alter business content.
6. Render the platform section from method-level descriptors, the runtime section from `stateSource` plus frozen runtime facts, and display section from `SurfaceContext`/host readiness. No hard-coded diagnostic values.
7. Merge `adminShellAssembly` first in `sample-console`, then feature parts, then add the title-only, mobile-only `sample.console.admin-test` entry/renderer as a real production `definedParts` registration. It has one unique part identity, is included in the same catalog, and is the exact object used by injection/removal proof; no test-only list, hard-coded section array, or second registry may stand in for it.
8. Make the Web dev-host use the same capability-named input as integration: replace `createSurface(displayMode)` in `apps/terminal/ui/base/dev-host/src/components/testExpoApp.tsx#TestExpoAssembly` with `createSurface({displayIndex, displayMode, surfaceForm, ...})`, call it distinctly for index 0 and index 1, and pass the index through to the host/source chain. Web must not synthesize host status from `displayMode`.
9. Verify the foundation edges introduced in step 6 and add the production-consumer edge `sample-console → admin-shell` now that `adminShellAssembly` is merged. Keep the existing `admin-shell → render` edge and the required `admin-shell → display-context/input` edges synchronized in `apps/terminal/skeleton-graph.ts`, the corresponding `package.json` files (`dependencies`/`plannedDependencies` as applicable), and the exact-edge/acyclicity inventory in `tools/terminal-skeleton/check-static.mjs`; do not add the reverse `render → admin-shell` edge. Admin-shell must not import `ui/feature`, and no graph-check bypass is permitted.

#### Gate

- red: section list is hard-coded, sample section is fixture-only, login persists, shell imports feature code, or a section navigates/mutates.
- invariant: four current catalog entries including the production-injected sample section, one layer stack, one input path, one catalog projection, method-level read-only data, and index-distinct Web creation.
- proof: static dependency/source checks plus focused real launcher/keypad/verify/tab/close/reopen/injection/navigation-rejection tests; the injection test must use the production assembly's sample part and catalog removal, not a fixture-only list.
- reconciliation: requirements AC0/AC2–AC6/CT-5/CT-6 ↔ design CP-08 and IA/interaction ↔ memory admin/read-only/owner rules.

#### Full focus assertion after step 8

Open one business layer first, then invoke admin through the real launcher. Assert business input cannot focus, admin virtual input can focus and receives a key, business value is unchanged, and after close the business focus controller restores. This is the A-15 gate and cannot be substituted by the step-3 pre-probe. Every action must use the real owner testID: `adminTestIds` for admin-owned controls and the existing `ui.base.input:virtual-keyboard:*` IDs for shared keypad controls; direct state setters are forbidden.

### Step 9 — proofs, independent reviews, and delivery gates

1. Run each step's focused/static proof only under the current implementation authorization; Web/Android/native/release/visual remain separate tiers.
2. After each step, record three-dimensional reconciliation (`MATCHED`/`OPEN`) before opening the next step.
3. After step 8, run the fresh whole-batch three-dimensional reconciliation before overall tests.
4. Prepare the independent design review with the companion minimum input list. The reviewer must not read author self-review first and must take “find why this does not hold” as the stance.
5. Exactly two fresh independent design review rounds were run for this historical design cycle. Round 1 was `NO-GO (10M/2S/0N)` and is archived at `doc/review/platform/2026-09-11-v2s-terminal-admin-console-design-independent-review-round-1-codex.md`; its post-verdict intake is `doc/review/platform/2026-09-11-v2s-terminal-admin-console-design-round-1-intake-codex.md`. Round 2 was the final `SELF_DECIDED` review and is archived at `doc/review/platform/2026-09-11-v2s-terminal-admin-console-design-independent-review-round-2-codex.md` with `NO-GO (6M/2S/2N after Dexter rulings)`. The revised bytes are not covered by that report; no third round is permitted in this historical cycle.
6. This current task carries Dexter's implementation authorization. It does not grant Web/Android/native/release/visual execution or replace the required independent implementation review.

## 5. Owner API / consumer and zero-caller guard

The planned API set is the smallest set with a named consumer. Before implementation, each row must be checked against current bytes; any zero-caller proposal is removed rather than left as “future support”.

| API/symbol | owner | planned consumers |
| --- | --- | --- |
| `selectAvailableParts` with form/null-layer semantics | UI state catalog | ScreenContainer, LayerStack, resolvePart guard, admin section projection, command-owner admission predicate |
| shared availability predicate | UI state/render contract | screen/layer admission and fallback |
| `SurfaceCreationInput` / index-based surface creation | sample integration/dev-host | sample assembly, test-expo, Android app entry |
| `SurfaceModeRadio` / selected single-dual mode | dev-host | `surfaceMode` state and SECONDARY mount only; no assembly rebuild or logical-size consumer |
| `SurfaceWidthControl` / selected preview-width input | dev-host | `SurfaceCanvas` geometry only; no assembly/runtime or logical-size consumer |
| `SurfaceHostSnapshot.isHostPrimaryDisplay/surfaceIdentity` plus state-derived `SurfaceContext.surfaceForm/isHostPrimaryDisplay/surfaceIdentity` | render/integration | launcher, display section, render/catalog context, physical source chain, AdminLayer cleanup effect |
| `ADMIN_CONSOLE_*` identity constants and replacement cleanup | admin-shell | `AdminLayer` compares `surfaceKey`, `displayIndex`, `surfaceForm`, and `displayMode` by value rather than by identity-object reference, retains the previous `displayMode`, and dispatches exact cleanup through the existing `ui-state` command for in-place replacement and old-mode child unmounts; a same-value geometry/snapshot update leaves admin state intact; no `render → admin-shell` import |
| `RenderRuntimeFacts` | assembly/render context | runtime/port/display sections and non-admin diagnostic consumer |
| `deriveAdminPassword/verifyAdminPassword` | admin-shell pure foundation | AdminLogin plus focused tests |
| `resolveDebugMode` | assembly/runtime fact resolver | startup assembly and runtime section |
| public `PlatformPortCapabilitySnapshot` plus `describePlatformPortCapabilities(ports)` | platform-ports factory/adapters/defaults/Web binding | assembly and platform section in every build |
| native-less input option/result | input | AdminLogin and input focused tests |
| shared `InputKeyboard` presenter and `keyboardPlacement` | input | `InputSurfaceFrame` for `surface`; any local field/card consumer for `field`; same `InputProvider` owner/controller/renderer |
| vendor slots | primitives/vendor | PrimitiveInput/list/spinner/SVG and all primitive consumers |
| `adminTestIds` | admin-shell | real controls and future L2 bindings |
| section projection/command boundary | admin-shell | AdminShell and all four section renderers |
| host loading test IDs | render | SurfaceHostController/loading proof |

`installPeerDispatchGateway` remains out of scope and is not added because the current transport/runtime gateway has no production consumer in this batch.

## 6. Full synchronized change matrix to reopen before and after edits

| fact | contract/source | backend/edge/migration | frontend model/surface/state | focused/static/HTTP/L2 | fixture/seed/executor | plan result |
| --- | --- | --- | --- | --- | --- | --- |
| form | surface parser + `UiCatalogEntry` | N/A no backend | SurfaceRoot/Context/catalog | static + focused | package fixture, no seed | sync |
| Web preview width | `SurfaceWidthControl` 30%–100% + existing `calculateSurfacePreviewGeometry` | N/A | selected CSS preview width/scale only; logical surface and assembly state unchanged | static + focused control/geometry; Web visual later | no seed | synchronized |
| physical index/host bool | `SurfaceCreationInput` + `SurfaceHostSnapshot.isHostPrimaryDisplay/surfaceIdentity` + assembly derivation | N/A | source map + SurfaceRoot/SurfaceContext fact | static + focused two-index | two-index fixture | synchronized source + consumer |
| display mode/canvas | display derivation | N/A | SurfaceRoot/host | static + focused dynamic | no seed | sync |
| layer-only semantics | catalog selector + `createOpenLayerActor` admission | N/A | LayerStack/resolvePart render defense | static + focused red/no-state-write | catalog fixture | synchronized |
| admin section projection | `UiCatalogEntry.containerKeys` plus required dimensions | N/A | AdminShell | static + focused injection | production sample part | sync; list order only, no metadata/order key |
| loading | snapshot/geometry | N/A | host controller | static + focused | null/usable fixture | sync |
| device ID | existing DeviceInfo + adapter/module | N/A | assembly fact/password | static + focused; Android later | fake IDs, no seed | sync |
| debug | packaging/startup source | N/A | runtime fact/context | static + focused; release later | source matrix | sync |
| keyboard | input/primitives/render contract, including shared `InputKeyboard` placement selection | N/A | InputField/InputKeyboard/vendor/snapshot | static + focused; native later | surface dock + field-local placement fixture | atomic sync; one presenter, two placement modes |
| primitives/tokens | primitive exports/theme | N/A | admin/existing controls | static + focused; visual later | no seed | sync |
| capability descriptors | public `PlatformPortCapabilitySnapshot` + `describePlatformPortCapabilities` | N/A | runtime fact/port section | static + focused non-DEV | descriptor fixture | synchronized |
| auth/selection lifetime | layer-local state | N/A | AdminLayer/Shell | focused real controls | no seed | sync |
| dynamic lifecycle | generic SurfaceRoot/SurfaceContext/LayerStack/InputController plus `admin-shell/AdminLayer` identity effect and frozen `SurfaceIdentity` | N/A | effect-closure previous-mode exact admin close, same-value snapshot survival, business retention, focus-scope switch, geometry/scroll | focused; Web/Android later | surface transition fixture | synchronized; N-2 list bound is `FOCUSED_PASS` with no visual/headroom claim |
| navigation boundary | admin shell wrapper | N/A | section context | focused rejection | fake section only | sync |
| test IDs | one `adminTestIds.ts` | N/A | real nodes | static + focused; L2 later | no seed | sync |

After implementation, this matrix must be re-run from current source, not copied from this plan. A cell that says “no impact” without the concrete counterexample is `OPEN`.

## 7. Requirement coverage and criterion proof roster

The following is an independently enumerated roster of the current requirement criterion IDs. It is a plan for proof ownership, not proof. Every row must have a concrete red mutation and the lowest valid evidence tier; no static/focused row may be reported as Web/Android/native/release/visual PASS. A-19 follows the reconciled requirements text: no independent owner/order metadata exists, and filtered single-catalog list order is the rule.

| ID | owning proof path | minimum tier | red mutation / falsifier |
| --- | --- | --- | --- |
| A-1 | `adminLauncher.test.tsx` | focused | launcher node exists for false gate |
| A-2 | `sampleAssembly.test.tsx` + future device script | Android | gate forced true |
| A-3 | `adminLauncher.test.ts` | focused | gesture defaults changed/ignored |
| A-4 | `sampleAssembly.test.tsx` + `adminLauncher.test.ts` + future Android action | Android (focused precursor) | raw window coordinates are compared directly to 96 instead of being converted to logical canvas coordinates; the local proof covers a non-equal host `2560×1200` over canvas `1280×800` (`scaleX=2`, `scaleY=1.5`) with an outside-y then inside point, plus reduced-host outside coverage, while Android still must repeat the real host-window action |
| A-5 | `adminLauncher.test.tsx` | focused | existing layer blocks launcher |
| A-5A | `sampleAssembly.test.tsx` | focused | invisible launcher `Pressable`/absolute overlay consumes a real business control, or five bubbled touches do not open admin |
| A-6 | `adminPassword.test.tsx` | focused/static | six states/native inputs |
| A-7 | `adminPassword.test.ts` | focused | arbitrary hour accepted |
| A-8 | `adminPassword.test.tsx` | focused | clock and password share copy |
| A-9 | `privacy-static.test.mjs` + logger focused | static/focused | password reaches log argument |
| A-10 | `adminShell.test.tsx` | focused | close/reopen remains auth |
| A-11 | `adminShell.test.tsx` | focused | shell direct members differ |
| A-12 | `adminShell.test.tsx` + type check | static/focused | section navigation succeeds |
| A-13 | `adminShell.test.tsx` + host geometry | Android/static | layer has container/guard mismatch |
| A-14 | `sampleAssembly.test.tsx` | focused | in-flight business command is cancelled or its business screen/layer is lost when admin opens |
| A-15 | `adminFocus.test.tsx` | focused | admin outside focus suspension boundary |
| A-16 | `sampleAssembly.test.tsx` | focused | persisted storage contains `admin.console` or the selected admin section after real open/navigation |
| A-17 | `admin-shell-static.test.mjs` | static | feature import |
| A-18 | `sampleAssembly.test.tsx` | focused | production sample section is not the same `definedParts` entry consumed by the catalog, or a hard-coded list keeps it visible after the real entry is removed |
| A-19 | `catalog.test.ts` | static/focused | catalog entries are mutable, a second section list appears, or filtered section order differs from the single catalog list order; an independent owner/order field or module-level mutable binding appears |
| A-20 | `sampleAssembly.test.tsx` | focused | mobile-only production section renders on laptop or is not observable on mobile through the real shell |
| A-21 | section focused tests | focused | hard-coded/non-kernel section |
| A-22 | `platformPorts.test.tsx` | focused | port-level aggregate or DEV-only source |
| A-23 | section type/static test | static | section exposes write command |
| A-24 | `adminPassword.test.ts` + Android/static | static/focused; Android later | startup-generated ID/permission/second port |
| A-25 | `adminPassword.test.ts` + assembly static | static/focused | verifier calls the port, ignores the parsed identity, or two fake IDs do not produce distinct derived results; assembly reads the port more than once per assembly |
| A-26 | `adminPassword.test.tsx` + Web future | focused/Web later | unconditional fallback |
| A-27 | `keyboard-retirement-static.test.mjs` + native future | static | system branch/IME file remains |
| A-28 | `inputKeyboardTruthTable.test.ts` | focused | before/after sets differ |
| A-29 | `primitives-props-static.test.mjs` + Android future | static | public suppression prop returns |
| A-30 | `inputGeometry.test.tsx` + Android future | Android later | mixed coordinate scroll |
| A-31 | `nativeLessInput.test.tsx` | focused | private second keyboard |
| A-32 | `primitives-static.test.mjs` | static | RN value import outside vendor |
| A-33 | README/static check | static | required README section absent |
| A-34 | `semanticTokens.test.mjs` | static | missing/duplicate token matrix |
| A-35 | `semanticTokens.test.mjs` | static | literal/internal color |
| A-36 | `primitiveStates.test.tsx` | focused | disabled/busy callback or a11y gap |
| A-37 | `virtualizedList.test.tsx` | focused | full render/truncation instead of virtualization |
| A-38 | `controls-import-static.test.mjs` | static | local duplicate control remains |
| A-39 | `primitives-static.test.mjs` | static | host/global/platform probe in primitive |
| A-40 | `svgPrimitive.test.tsx` + Web/Android future | static/focused; Web/Android later | empty/icon system/overlay host |
| A-41 | `terminalSurfaces.test.ts` + assembly focused | static/focused | width-derived form or wrong group |
| A-42 | Android App source static | static | direction hard-coded |
| A-43 | `catalog.test.ts` + define-part inventory | static | all forms open / missed call site |
| A-44 | `displayHostFlow.static.mjs` | static | mode/instance-derived host bool |
| A-45 | invariants/static/device expectation check | static | dependency/export/static expectation drift |
| A-46 | `adminShell.form.test.tsx` + Web future | focused/Web later | mobile layout loses shell members |
| A-47 | `debugRuntimeFacts.test.ts` + release future | focused; release later | debug tied to DEV/env mode |
| A-48 | `debugRuntimeFacts.test.ts` + static consumer scan | static/focused | only admin reads or second source |
| A-49 | `debugRuntimeFacts.test.ts` | static/focused | mutable toggle/persistence |
| A-50 | startup diagnostic focused test | focused | debug omitted from diagnostic |
| A-51 | debug/privacy focused test | focused | password logged |
| A-52 | form-source static/focused test | static/focused | second form source |
| A-53 | `sampleAssembly.test.tsx` + host-loading future | focused; Android later | VICE+SLAVE one-display pending/wrong source |
| A-54 | `adminShell.test.tsx` | focused | tab highlight changes while the rendered section content does not |
| A-55 | `adminShell.test.tsx` | focused | close does not remove the exact admin layer, or a real launcher reopen bypasses the login state |
| A-56 | `sampleAssembly.test.tsx` | focused | sample section is shell-owned, fixture-only, or remains visible after removal from the production assembly catalog |
| A-57 | `surfaceLifecycle.test.tsx` + future Web/Android script | focused; Web/Android later | cached canvas/auth/focus/scroll, wrong previous-mode close, old-mode `AdminLayer` unmount without cleanup, whole-root remount, business layer/content loss, or geometry-only/same-content snapshot cleanup when all four identity values are unchanged; assert exact admin layer count zero and unchanged business layer IDs/state for replacement, and assert admin layer plus auth/selection/scroll remain unchanged with no replacement close for the same-value snapshot |
| A-58 | `SurfaceHostController.test.tsx` | focused | blank pending View |
| A-59 | `testExpoApp.test.tsx` + Web future | focused/Web later | both Web surfaces same host bool |

### 7.1 Requirement-family enumeration

The plan covers the current source's requirement families rather than trusting the author's coverage count: shape/source declarations; AC-0 through AC-6 including AC-3A; ID-1/ID-2; IN-1 through IN-4; PR-1 through PR-7; CT-1 through CT-8; DBG-1 through DBG-6; and §3.3 dynamic canvas. The parked §9.2 items remain design/document obligations and are not silently dropped: AC-2.1, AC-3.6, AC-3A.3, AC-6.6, ID-2.2, PR-4.1, PR-6.3, §3.1.3, §3.1.8, and DBG-4.1. Each is explicitly represented in the Journey, IA, design gates, or review gate. `AC-4.5` and `CT-7` retain the falsifiable A-16/A-33 treatment.

## 8. Evidence matrix and execution boundary

The authorized source implementation and focused/static proofs have run. This matrix is deliberately not a
runtime or visual acceptance claim; the per-criterion execution matrix, command output, and current source
anchors are recorded in `doc/evidence/platform/2026-09-12-v2s-terminal-admin-console-implementation-evidence-codex.md`.

| tier | planned proof | current status | fresh requirement |
| --- | --- | --- | --- |
| static | exact symbols/imports/exports, catalog/source-chain, no forbidden props/logs, README/invariants | PASS for executed static gates | fresh main-agent command processes; not independent review |
| focused | real control actions, pure functions, catalog injection, loading, focus, dynamic switch, dev-host form selection fallback | PASS for executed focused suites; per-criterion partial/not-run rows remain explicit | fresh main-agent test processes; no direct setters |
| Web | dev-host index 0/1 host bool and geometry/form surface | NOT_AUTHORIZED | separate Web session |
| Android | dual-display source/host/IME/device ID/geometry | NOT_AUTHORIZED | separate Android session |
| native | Kotlin module/adapter and render snapshot | NOT_AUTHORIZED | separate native session |
| release | production debug source and public keyboard prop absence | NOT_AUTHORIZED | release build/session |
| visual | Dexter wireframe and final visual review | UNSET | Dexter decision, never inferred from text/focused |
| requirements reconciliation | A-19 now states no independent owner/order metadata and uses filtered single-catalog list order | MATCHED | future three-dimensional reconciliation must reopen the current requirements bytes |
| N-2 list bound | 100-row scroll-transition proof with `maxMounted=24` | FOCUSED_PASS | fresh primitive focused test; no headroom/visual claim |

All future dynamic runs must use the repository's governed runner and preserve first failure, last known good, broken boundary, business result, and cleanup separately. This design task does not start or stop any process and does not authorize DEV/seed/UAT/deployment.

## 9. Independent design-review package

The companion blind-review request must include, at minimum:

1. the current requirements document;
2. the discussion document and the exact POC paths it names, read-only;
3. this detailed design and the implementation plan;
4. the Journey, IA, and interaction artifacts;
5. `AGENTS.md`, `PLATFORM-BLUEPRINT.md`, relevant Roadmap authorization fields, frontend/terminal standards, foundation charter, and routed project-memory entries;
6. the owning source files/symbols listed in this plan's §9b and the latest static evidence, if any;
7. an explicit instruction to distrust author counts, prior verdicts, “covered/no dangling” claims, and any evidence tier upgrade;
8. an output format requiring `CONFIRMED`, `PARTIALLY_CONFIRMED`, `REJECTED_WITH_EVIDENCE`, `UNVERIFIED_REQUIRES_EVIDENCE`, or `DEXTER_DECISION`, path+unique symbol, failure scenario, impact, minimum fix, and Dexter-decision flag;
9. `REVIEW_ROUND=1|2`, `REVIEW_ROUND_LIMIT=2`, `reviewerKind=INDEPENDENT_SUBAGENT`; round 2 additionally declares `ROUND_FINAL_DECISION=SELF_DECIDED`.

The request was issued only after the design bundle was stable and did not include the author's own conclusion as a premise. Round 1 and the final round 2 are archived as independent `NO-GO` reports; no author self-review is counted as independent.

## 10. Failure-family prevention destinations

The current requirements and previous review history identify these reusable failure families. An implementation must close each at the indicated destination; a single-file repair is not enough.

| failure family | root class | finite sibling scan | counterexample | prevention destination |
| --- | --- | --- | --- | --- |
| display mode substituted for physical host | fact lost at integration boundary | all surface constructors/source maps/host gates/Web host | PRIMARY mode on physical index 1 | catalog/display static check + focused two-index proof |
| layer part treated as screen part | ambiguous empty-container contract | all selectors/resolve/render callers | `containerKeys=[]` layer | shared selector predicate + red focused fixture |
| DEV-only capability descriptor | observability mistaken for behavior | all adapters/default/web descriptor branches | PROD section has no rows | method-level descriptor contract + static non-DEV proof |
| system keyboard caller drift | enforcement at call site | all primitive/input/vendor imports/props | new caller omits false | vendor fixed wrapper + public prop exact scan |
| async fact in UI verifier | owner/lifecycle leakage | all `getDeviceInfo` call sites/password paths | login invokes port twice | startup call-count scan + pure-function test |
| debug equals build mode | source conflation | all `__DEV__`, environment, packaging/startup branches | PROD debug on cannot render | one source resolver + production matrix |
| test self-certifies injection | fixture not production path | all section arrays/catalog construction | test list contains absent part | same catalog production injection/removal proof |
| direct state-setter interaction proof | symptom-only focused test | all admin test actions | content changes without a control | testID/action-node matrix + real control focused proof |
| loading mistaken for gate | missing intermediate UI state | all pending host branches/children | empty View looks like denial | explicit Spinner/no-children focused proof |
| dynamic stale surface | mount-time cache/lifecycle ownership | all display/form/source/LayerStack/input transitions | mode changes but admin remains or old-mode AdminLayer unmounts without cleanup | generic SurfaceRoot/SurfaceContext proof plus AdminLayer identity-effect/unmount-cleanup proof + four independent observations |

If a new finding has a different root class, stop and add a new bounded row plus its proof destination before closing the step.

## 11. Three-dimensional reconciliation protocol

### Stage reconciliation

At the end of each step, before opening the next:

| field | required record |
| --- | --- |
| requirements dimension | every applicable clause/criterion for the step, exact path/anchor, result `MATCHED`/`OPEN` |
| design/IA dimension | corresponding design/IA/interaction rows, owner/failure/a11y/test ID, result `MATCHED`/`OPEN` |
| memory dimension | every six-dimensional routed memory entry relevant to the step and its prevention rule, result `MATCHED`/`OPEN` |
| gate | any `OPEN` blocks the next step; no GO/NO-GO is emitted by this reconciliation |

### Whole-batch reconciliation

After step 8 and before overall tests, repeat the entire three-dimensional comparison from scratch. It must detect cross-step drift such as the same fact having two shapes, a later package reintroducing a retired prop, or a consumer bypassing the catalog. It cannot be a summary of stage records.

## 12. Mandatory code ↔ design line-by-line reconciliation

This is a delivery step in the plan, not a final note.

### Preconditions

- all implementation changes are complete under a separate implementation authorization;
- all stage and whole-batch three-dimensional reconciliations are `MATCHED`;
- focused/static proof is collected at the proper tier;
- no Web/Android/native/release claim is borrowed from another tier.

### Scope and method

1. Enumerate every changed production/test/source line from the current bytes, including new files, deleted lines, changed exports, test IDs, README/invariant/fixture changes, and generated-source changes. The inventory is not a sample and is not derived from this plan's intended file list alone.
2. For each line/statement, record the exact design §/anchor, IA/interaction obligation, owner, failure/recovery behavior, and test/evidence path.
3. Compare the line against the current requirements and project-memory design constraints. For generated output, compare the generator/source rather than hand-edited output.
4. Use only `MATCHED` or `OPEN`. `PARTIAL`, `ASSUMED`, `N/A_WITHOUT_COUNTEREXAMPLE`, or “covered by test” are not conclusions.
5. Any `OPEN` blocks `IMPLEMENTATION_READY` and blocks Dexter/Claude implementation review. Repair and re-run the same reconciliation; do not waive it with runtime evidence.

### Record shape

```text
CODE_DESIGN_RECONCILIATION=NOT_RUN | MATCHED | OPEN
line=<absolute path>:<one line after implementation>
code_anchor=<unique symbol/statement>
design_anchor=<this document section/anchor>
ia_interaction=<exact artifact/anchor or N/A_WITH_REASON>
owner=<single owner>
failure_recovery=<typed failure and recovery>
proof=<static/focused/Web/Android/native/release path, or N/A_WITH_REASON>
result=MATCHED | OPEN
```

The current main-agent code↔design reconciliation is `MATCHED` for the enumerated in-scope changed
production/test/document lines. The exhaustive target inventory, anchor matrix, and evidence-tier boundary are
recorded in `doc/evidence/platform/2026-09-12-v2s-terminal-admin-console-implementation-evidence-codex.md`.
Independent implementation review is `NOT_RUN`; it is not replaced by this main-agent reconciliation.

## 13. Stop conditions and handoff boundary

Stop and return to Dexter when:

- the wireframe changes the launcher/login/navigation/close/dynamic-switch semantics;
- any requirement, design, IA, interaction, or memory dimension conflicts;
- a unique source anchor cannot be found or current bytes have drifted;
- the POC password formula cannot be reopened;
- a step reconciliation or code↔design line is `OPEN`;
- a proposed behavior API has no real consumer or focused proof consumer (the all-primitives scope remains the documented Dexter exception);
- a proof would require unauthorized Web/Android/native/release/DEV/seed/UAT/deployment execution;
- a reviewer is not fresh/independent or round 2 is not final `SELF_DECIDED`.

This plan is currently executable only within the direct implementation authorization recorded above. Future
visual/L2 work remains blocked until its own product decision and evidence authorization. A separate fresh
independent implementation review is still required before presenting an implementation-review package. This
plan never asks Dexter for Git actions and never treats repository control as an implementation gate.

## 14. Current self-check

| check | current result |
| --- | --- |
| fixed cross-cutting mechanism rows present | MATCHED in detailed design; plan carries same set |
| CP order matches requirements five layers | MATCHED: steps 1–8 are serial and focus pre-probe/A-15 are placed correctly |
| all current criterion IDs have a proof row | MATCHED for the current A-1..A-59 plan matrix; actual execution is separately marked per criterion in the evidence document |
| parked behavior obligations are retained | MATCHED in §7.1 |
| backend/HTTP/DB/migration/seed scope excluded with reason | MATCHED |
| source/owner/consumer anchors | MATCHED for the current in-scope source inventory; future L2 bindings remain OPEN |
| line-by-line code/design reconciliation | MATCHED in the companion evidence document; independent implementation review remains NOT_RUN |
| Web/Android/native/release evidence | NOT_AUTHORIZED/NOT_RUN |
| fresh independent design review | historical ROUND 2 final `NO-GO` (6M/2S/2N after Dexter rulings) archived; current repaired bytes are not reviewed by that round; no third round in the historical cycle |
| implementation authority | true under current Dexter authorization; no runtime-tier expansion |
