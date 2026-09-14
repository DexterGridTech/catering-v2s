# TER terminal admin console IA design

`SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0`

## 0. Metadata and authority

- `DOCUMENT_KIND=IMPLEMENTATION_FACING_IA`
- `SOURCE_REQUIREMENTS=doc/plans/platform/2026-09-11-v2s-terminal-admin-console-and-primitives-requirements-claude.md`
- `SOURCE_JOURNEY=doc/decisions/2026-09-11-v2s-terminal-admin-console-journey-proposal-codex.md`
- `DESIGN_STATUS=IMPLEMENTED_WITH_FOCUSED_STATIC_EVIDENCE; visual wireframe remains open`
- `IMPLEMENTATION_AUTHORITY=true (current Dexter authorization; runtime tiers remain separately bounded)`
- `REVIEW_TARGET=DESIGN`
- `INDEPENDENT_REVIEW=ROUND_2_NO_GO_FINAL (6M/2S/2N after Dexter rulings)`
- `REMEDIATION_INTAKE=doc/review/platform/2026-09-11-v2s-terminal-admin-console-design-remediation-intake-codex.md`
- `CURRENT_BYTES_AFTER_REMEDIATION=NOT_REVIEWED_BY_HISTORICAL_ROUND_2`
- `CONSUMER_FACE=public (terminal-local operator surface; not a web admin face)`
- `EVIDENCE_STATUS=IMPLEMENTATION_FOCUSED_STATIC; Web/Android/native/release/visual remain open`

This is the implementation-facing information architecture used by the current authorized source work. Its
focused/static implementation evidence is recorded separately; it is not Web, Android, native, release, or
visual acceptance. Visible copy, exact spacing, and final visual hierarchy remain subject to Dexter's wireframe
and interaction decision.

## 1. Shared executable dimensions

These dimensions must be observable from the implementation and must not be inferred from labels or screenshots:

| Dimension | Allowed values | Source | Observation |
| --- | --- | --- | --- |
| physical display | `0` or `1` in the integration boundary | `SurfaceCreationInput.displayIndex` | source lookup and host-source lookup use the same index |
| display mode | `PRIMARY` or `SECONDARY` | `resolveSurfaceDisplayMode` | canvas selection uses this value |
| surface form | `laptop` or `mobile` | terminal-surface declaration/orientation, initialized once in the assembly's non-persisted `ui-state` slice | catalog admission and render context read the same selector |
| host status | boolean | `isHostPrimaryDisplay = displayIndex === 0` | launcher exists only for `true`; Web test host supplies the same mapping |
| workspace | existing runtime workspace | `UiCatalogContext` | exact catalog filter |
| instance mode | existing runtime instance mode | `UiCatalogContext` | exact catalog filter; never substitutes for physical host status |
| host readiness | `ready` or `loading` | `SurfaceHostSnapshot` and geometry calculation | loading component renders without children |
| authentication | `unauthenticated` or `authenticated` | admin layer-local state | close and surface replacement reset it |
| selected section | current catalog part key or `none` | admin shell local state | not persisted and not reconstructed from a hard-coded list |

Canonical cross-document rules:

- `SURFACE_FORMS=laptop|mobile`.
- `ADMIN_SECTION_CONTAINER_KEY=admin.sections`.
- `ADMIN_LAYER_CONTAINER_KEYS=[]` means layer-only; it is not an invalid empty screen placement.
- `ADMIN_CONSOLE_PART_KEY=admin.console`, `ADMIN_CONSOLE_LAYER_ID=admin.console.layer`, and `ADMIN_CONSOLE_FOCUS_SCOPE_ID=admin.console` are single constants owned by `admin-shell`; `partKey` and `layerId` are different identities.
- The assembly initializes `surfaceForm` once in the non-persisted `ui-state` slice. `selectSurfaceForm(root)` is the shared source for admission and render context; a separately passed React form prop is forbidden.
- The TER Web dev-host exposes `laptop` and `mobile` view controls only when the terminal declaration has a portrait group. Selecting a different view writes `surfaceForm` to the Web URL and reloads the preview page; the next assembly initializes the selected form once. This is a host restart path, not an in-runtime `surfaceForm` setter or a second runtime.
- A part is available only when its `containerKeys` match the requested placement semantics and its `surfaceForm`, `displayMode`, `workspace`, and `instanceMode` all match the context.
- Physical display index remains at the integration/dev-host boundary. `SurfaceHostSnapshot` carries frozen `isHostPrimaryDisplay` and `surfaceIdentity`; source selection and host derivation both originate from physical `displayIndex`, while canvas selection remains `displayMode` based. UI context receives the frozen fact and does not index host sources.
- A surface identity replacement recomputes geometry, retains all business content and business layers, blurs the replaced surface's active field, and closes only the targeted transient admin layer. The close uses the previous surface `displayMode` and exact `ADMIN_CONSOLE_LAYER_ID`; admin authentication, selected section, and local admin scroll are discarded. Whole-root remount and `clearLayers` are forbidden.
- Focus suspension remains surface-level and count-based. The active top-layer focus scope may change on 1→2/2→1 without another suspend/restore event; business fields use `business`, and the admin layer uses `admin.console`.
- Host-unready is a render loading state, not a fail-open or fail-closed gate. `SurfaceHostController` renders a loading indicator and no children.

## 2. Information hierarchy

```
Terminal surface
└── business content
    └── admin overlay (host display only)
        ├── login gate
        │   ├── title / explanatory text
        │   ├── six-cell password display
        │   ├── virtual numeric keypad
        │   ├── typed error/status
        │   └── close
        └── authenticated console
            ├── shell header / current surface context
            ├── section navigation
            │   ├── platform ports
            │   ├── runtime
            │   ├── display context
            │   └── sample-console placeholder section
            ├── selected section content
            └── close
```

The navigation collection is a projection of the same `UiCatalog.entries`, filtered by the catalog selector while preserving the catalog list order. The initial registered collection is four sections; it is bounded for this batch and does not require pagination. If a diagnostic collection grows, the shell uses the already planned virtualized/list primitive with fixed-height rows, `visibleWindow=16`, `overscanBefore=4`, `overscanAfter=4`, and `maxMounted=24`; a 100-record focused fixture must remain complete and must not be truncated. This does not create a second navigation model.

## 3. Screen IA contracts

### 3.1 `admin-loading`

- purpose: tell the operator that the canvas host is being prepared;
- visible hierarchy: status indicator → short status label;
- data: no catalog, child content, password, device ID, or diagnostic payload is shown;
- entry: host snapshot or usable geometry is absent;
- exit: host snapshot becomes usable, or the existing host error surface owns a typed failure;
- loading copy: `正在准备终端画布` (`DRAFT_TERMINAL_COPY`);
- stable observation: `ui-base-render:surface-host-loading-indicator` exists and its child content tree is absent;
- accessibility: status/live announcement, busy state, no actionable control;
- forbidden behavior: changing `isHostPrimaryDisplay`, accepting an admin gesture, or rendering children while loading.

### 3.2 `admin-login`

- purpose: authenticate every console opening locally;
- visible hierarchy: console title → six-cell display → keypad → primary verify control → typed error/status → close;
- data: one password string, identity availability state, current-hour derivation result;
- entry: launcher opens a fresh admin layer, or authenticated layer is reopened after close;
- exit: successful verify enters shell; failed verify remains; close removes layer;
- empty state: six blank cells and disabled verify;
- partial state: filled cells show masked digits; verify remains disabled until six digits;
- invalid state: typed `password-invalid`, clears or retains digits according to Dexter's final interaction decision, never logs input;
- unknown identity: only literal fallback `123456` is accepted; all other six-digit values fail;
- known identity: literal fallback `123456` is rejected, derived value is checked inside the current three-hour window;
- clock unavailable: typed `clock-unavailable`; no silent fallback to a time-independent password;
- interaction boundary: keypad buttons call the password state transition; direct state setters are not test actions.

### 3.3 `admin-console`

- purpose: provide a read-only shell around catalog-backed sections;
- visible hierarchy: header/title → surface context summary → section navigation → content frame → close;
- data: current `surfaceForm` from `selectSurfaceForm(root)`, `displayMode`, host status, selected section catalog entry, and read-only section model;
- entry: successful login only;
- exit: close or surface identity change;
- default selection: first available section in the filtered `UiCatalog.entries` list; `createUiCatalog` preserves list order and there is no section order key; if none, typed empty-catalog state;
- section navigation: selection updates the content frame and visible selected state; it does not navigate the business screen;
- close: removes the layer and discards auth/selection/section-local scroll;
- reopen: creates a new unauthenticated layer;
- forbidden behavior: section renderer calling `showScreen` or `openLayer` successfully; shell importing sample feature components.
- production ownership: `admin-shell` exports one assembly containing the console layer and the three built-in section parts/renderers; `sample-console` merges it and then contributes the title-only sample section. All four entries reach this screen through the same catalog construction.

### 3.4 `admin-section-platform-ports`

- purpose: show port capability state by method, not one aggregate port boolean;
- visible hierarchy: section heading → method rows → state/source/detail values;
- data: read-only descriptors created by the platform-ports binding factory in all supported builds;
- expected rows: all methods of the relevant port, including unavailable methods;
- source values: `default`, `adapter`, `web`, or `fixture` only where the owning descriptor says so;
- non-DEV rule: the section must not depend on `__DEV__` logging or an absent DEV-only map;
- failure: descriptor unavailable is displayed as typed `capability-data-unavailable`, not guessed from method existence;
- no action: rows are not buttons and do not invoke ports.

### 3.5 `admin-section-runtime`

- purpose: show runtime status and immutable startup facts;
- visible hierarchy: section heading → runtime status → environment mode → debug state/source → device identity availability;
- data: `stateSource.getStatus()` plus frozen assembly-owned runtime facts;
- debug: must be able to show `on` in a production package; it is not `__DEV__` and is not a mutable admin switch;
- debug source: `startup` wins whenever explicitly defined, including `false`; otherwise `packaging` wins whenever defined; otherwise `default/off`. The complete nine-combination matrix is frozen in detailed design CP-05.
- device identity: show availability and a redacted/stable display form only; never show raw device ID, password input, token, or secret;
- failure: status unavailable is typed and visible without inventing a default;
- no action: all rows are read-only.

### 3.6 `admin-section-display-context`

- purpose: make display and host decisions observable;
- visible hierarchy: section heading → form/mode/role/instance rows → host status → geometry/readiness rows;
- data: `SurfaceHostSnapshot.isHostPrimaryDisplay`, frozen `surfaceIdentity`, SurfaceContext, display-context selectors, and host snapshot/geometry status;
- must show the distinction between `displayMode` used for canvas choice and `isHostPrimaryDisplay` used for the launcher gate;
- secondary display: host status is false even when display mode is otherwise valid;
- loading: host readiness remains loading and does not turn into a gate denial;
- no action: context cannot be changed from the section.

### 3.7 `admin-section-sample`

- purpose: prove that an application package can inject a real admin section through the production catalog registration path;
- visible hierarchy: section title only → empty content area;
- source: `sample-console`'s own `definedParts` entry and renderer, included in the same catalog construction as all other parts;
- identity: one unique part key/renderer key; A-18 removal and A-20 availability target this exact entry;
- no fixture shortcut: the focused test must discover the entry through catalog selection, not a hard-coded test array;
- no action: placeholder content is intentionally empty.

### 3.8 `dev-host-surface-form-control`

- scope: TER Expo Web development host only; it is not an admin-console section or a second launch path;
- position: in the existing host page header, below the title/status row; the width range, view radio, and
  laptop-only surface-mode radio are siblings in one independent, horizontally centered control row;
- visible controls: one `终端视角` radio group is present when the injected `terminalSurfaces` declares
  `orientations.portrait`; it contains mutually exclusive `laptop` and `mobile` options;
- selected state: the current form is exposed through each radio option's selected accessibility state and the
  header status; laptop uses landscape PRIMARY/SECONDARY declarations, mobile uses portrait PRIMARY-only;
- surface mode: laptop exposes one `屏幕模式` radio group with mutually exclusive `单屏模式` and `双屏模式`
  options; the selected radio state is the only visible mode status and selecting an option mounts or unmounts
  SECONDARY in the current runtime without rebuilding the assembly;
- surface width: the same header area exposes a native Web range control labelled `surface 宽度`, from
  30% through 100% of the measured preview content width, with the current percentage shown beside it;
  it changes preview scale only and never changes the declared logical surface dimensions;
- interaction: selecting the other form writes `surfaceForm=laptop|mobile` to the current Web URL and
  reloads the preview page, so the next assembly starts once with that form; it does not set a runtime
  form slice, create a second runtime in the same page, or hot-switch an existing assembly;
- separation: the `surfaceMode` radio group remains laptop-only and only mounts/unmounts SECONDARY within the
  current runtime; it is independent from the form selector;
- fallback: an absent/unknown URL value uses the configured default form, and a mobile request without a
  portrait declaration also falls back to that default.

## 4. Invisible IA and state contracts

| Contract | Required observation | Failure meaning |
| --- | --- | --- |
| layer selection | a layer-only entry with `containerKeys=[]` is selectable with null layer placement and all dimensions match | selector incorrectly treats layer parts as invalid or ignores form |
| section selection | `selectAvailableParts(catalog,'admin.sections',context)` returns only entries whose `containerKeys` include the requested section key and whose form/display/workspace/instance dimensions match | second registry, admin metadata, or stale hard-coded section list |
| physical host | source map is indexed by `displayIndex`; the same index derives host bool | D-1/D-2 data-flow regression |
| Web host | test host creates index 0/1; bool is true/false respectively | Web hardcodes PRIMARY/host status |
| focus suspend | first layer transition 0→nonzero emits one surface suspend; adding another layer emits none | layer-count edge is wrong |
| focus scope | business field is rejected while `admin.console` is top scope; admin virtual field is accepted while the surface is suspended; 2→1 restores the business target | surface-level suspension was mistaken for per-layer permission |
| loading | pending host node has no rendered child subtree | loading state accidentally fail-opens |
| surface-form ownership | one `ui-state` slice is initialized once per assembly with `persistIntent=never` and `syncIntent=isolated`; `selectSurfaceForm(root)` feeds both admission and render context | React-only form prop or a second mutable source diverges |
| password | pure function receives parsed identity and current hour; port is awaited once at assembly start | async logic or port mutation leaks into UI |
| keyboard | no public primitive prop named `showSoftInputOnFocus`; vendor fixes system keyboard suppression | a new primitive can re-enable the system keyboard |
| navigation boundary | section command boundary returns typed rejection for navigation commands | section escapes read-only shell |
| close/reopen | actual close control removes layer; a fresh launcher creates login state | local auth/section state is persisted by accident |

## 5. Typed UI errors and recovery

| Code | Trigger | Visible state | Recovery |
| --- | --- | --- | --- |
| `admin-host-loading` | host geometry/snapshot absent | loading indicator, no children | wait for host readiness |
| `admin-not-host-display` | launcher requested on non-host display | no launcher; diagnostic-only state | use host display |
| `admin-password-incomplete` | verify before six digits | inline validation | enter six digits |
| `admin-password-invalid` | password fails current rule | inline error, no sensitive details | retry or close |
| `admin-clock-unavailable` | current-hour source unavailable | explicit error, no fallback derivation | restore clock/source, retry |
| `admin-device-identity-unavailable` | device ID cannot be resolved | runtime section shows unknown; login uses fallback rule | use `123456` only when identity is unknown |
| `admin-catalog-empty` | no available admin section | shell empty state with close | close; do not invent sections |
| `admin-section-unavailable` | selected key no longer matches current context | typed empty/error state; selection resets to first available | select another section |
| `admin-navigation-rejected` | section attempts screen/layer navigation | no content/navigation change; diagnostic result | remain read-only |
| `admin-surface-replaced` | display/form identity changes | overlay closes; business content remains | invoke and authenticate again on host |

## 6. Cross-check and non-goals

- No IA node writes business data, calls backend HTTP, or creates a database operation.
- No IA node owns a second overlay stack. `LayerStack` remains the render owner.
- No IA node owns a second input manager. `InputProvider`/`InputController` remain the input owner; the password section uses the existing virtual-keyboard path with a native-less field model.
- `DialogSurface` is intentionally absent. A card container plus heading and action primitives compose any needed grouping.
- The fixed admin container key and layer-only semantics are contract decisions, not visual labels.
- This IA does not claim a v2 visual counterpart. The required v2 inventory is `NOT_FOUND_IN_HERITAGE_REGISTRY` for this terminal admin surface; the design must therefore remain a proposal until Dexter approves its wireframe.

## 7. Evidence plan and current state

| Tier | Planned proof | Current status |
| --- | --- | --- |
| static | type/symbol/source checks for catalog, props, vendor, assembly, and no forbidden imports | implementation static PASS; command output is recorded in the companion evidence |
| focused | script-driven real control actions for login, switch, close/reopen, loading, injection, focus, and dynamic switch | implementation focused PASS for exercised scenarios; see evidence document |
| Web | test-expo host index 0/1 and surface geometry/host bool | not run; Web execution not authorized |
| Android | native device-info and dual-display surface/input behavior | not run; Android execution not authorized |
| native | Kotlin adapter/module tests and render snapshots | not run |
| release | production debug-source and keyboard structural checks | not run |

The focused/static rows were run in fresh test processes by the main agent; they are not fresh independent review
sessions. Web, Android, native, release, and visual rows remain open and must not be inferred from local tests or
text completeness.
