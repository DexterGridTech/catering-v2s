# TER terminal admin console UI and interaction design

`SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0`

## 0. Metadata and authority

- `DOCUMENT_KIND=IMPLEMENTATION_FACING_UI_INTERACTION_DESIGN`
- `SOURCE_REQUIREMENTS=doc/plans/platform/2026-09-11-v2s-terminal-admin-console-and-primitives-requirements-claude.md`
- `SOURCE_IA=doc/plans/platform/2026-09-11-v2s-terminal-admin-console-ia-design-codex.md`
- `SOURCE_JOURNEY=doc/decisions/2026-09-11-v2s-terminal-admin-console-journey-proposal-codex.md`
- `DESIGN_STATUS=IMPLEMENTED_WITH_VISUAL_AND_RUNTIME_EVIDENCE_OPEN`
- `DEXTER_WIREFRAME_REVIEW=UNSET`
- `IMPLEMENTATION_AUTHORITY=true (current Dexter authorization; runtime tiers remain separately bounded)`
- `CONSUMER_FACE=public (terminal-local operator surface; not a web admin face)`
- `INDEPENDENT_DESIGN_REVIEW=ROUND_2_NO_GO_FINAL (6M/2S/2N after Dexter rulings)`
- `REMEDIATION_INTAKE=doc/review/platform/2026-09-11-v2s-terminal-admin-console-design-remediation-intake-codex.md`
- `CURRENT_BYTES_AFTER_REMEDIATION=NOT_REVIEWED_BY_HISTORICAL_ROUND_2`
- `SEARCH_CAPABILITY_DENOMINATOR=N/A_WITH_REASON`
- `V2_COUNTERPART_DENOMINATOR=N/A_WITH_REASON`
- `EVIDENCE_STATUS=IMPLEMENTATION_FOCUSED_STATIC; visual/Web/Android/native/release remain open`

This artifact specifies the observable interaction and accessibility contract required before implementation. It is not a visual acceptance result. All copy and exact geometry below is `DRAFT_TERMINAL_COPY`/`DRAFT_LAYOUT` until Dexter decides the wireframe.

## 1. Shared interaction rules

The following block is normative across the IA, detailed design, and implementation plan:

- `SURFACE_FORMS=laptop|mobile`.
- `ADMIN_SECTION_CONTAINER_KEY=admin.sections`.
- `ADMIN_LAYER_CONTAINER_KEYS=[]` is the explicit layer-only placement semantics.
- `ADMIN_CONSOLE_PART_KEY=admin.console`, `ADMIN_CONSOLE_LAYER_ID=admin.console.layer`, `ADMIN_CONSOLE_FOCUS_SCOPE_ID=admin.console`, and `ADMIN_SECTION_CONTAINER_KEY=admin.sections` are defined once by `admin-shell`; `partKey` is not a substitute for `layerId`.
- The assembly initializes `surfaceForm` once in the non-persisted `ui-state` slice. `selectSurfaceForm(root)` is the only form fact consumed by admission and render context; no separate `SurfaceRootProps.surfaceForm` source is allowed.
- The section collection is selected from the same `UiCatalog.entries`, with exact matching on form, display mode, workspace, and instance mode; its order is the filtered entries' list order preserved by `createUiCatalog`. No `adminSection.order` field or second registry exists.
- Physical `displayIndex` is used only at the integration/dev-host boundary. The UI receives `surfaceForm` and `isHostPrimaryDisplay`; it does not index a host-source map.
- `isHostPrimaryDisplay` is true only for physical index 0. Web test surfaces use the same index mapping: index 0 true, index 1 false.
- Host-unready is an explicit loading state. `SurfaceHostController` renders a status indicator and no children; it does not alter the host gate.
- A surface identity replacement recomputes geometry, retains all business content and business layers, blurs the replaced surface's active field, and closes only the targeted `ADMIN_CONSOLE_LAYER_ID` in the previous surface `displayMode`. Admin authentication, selected section, and local admin scroll are discarded. The existing React surface identity is preserved; whole-root remount and `clearLayers` are forbidden.
- All admin actions are read-only. A section navigation command returns a typed rejection and cannot change business content.
- Native-less virtual input uses the existing `InputController`: a nullable native ref is optional, `activateFocusScope(scopeId)` is the only scope API, and virtual focus/complete succeed without a native ref while native focus is attempted only when a ref exists.

## 1.1 Per-screen implementation-facing declaration

`CONSUMER_FACE=public` is used here only because the repository interaction template has the enum
`platform-admin|operations-admin|public`. This is a terminal-local operator surface, not a network
public page, backend public session, or either web admin application. `APPLICATION_AFFILIATION=independent
terminal capability` applies to every screen below.

The seven screens below are separately declared because the template forbids one screen from mixing a
layer, content frame, loading state, or section surface. All visual values are `DRAFT_LAYOUT` until Dexter
reviews the wireframe.

### Screen `admin-loading`

```text
CONSUMER_FACE=public (terminal-local operator surface; not a web public page)
UI_SURFACE=独立页面（host loading surface inside the existing terminal surface host）
HOST_AND_ENTRY=SurfaceHostController null/incomplete snapshot branch; no user open control
ACTOR=终端操作员
BUSINESS_SCENARIO=终端画布正在等待 host snapshot/geometry
BUSINESS_GOAL=知道画布仍在准备，而不是看到一个无解释的空白
USER_VISIBLE_COPY=标题：终端画布；状态：正在准备终端画布；无按钮；无失败文案默认值
TECHNICAL_BOUNDARY=SurfaceHostSnapshot readiness and geometry; children must not render in this state
FOUNDATION_PRIMITIVE=NONE_WITH_REASON: libraries/frontend/admin-ui-foundation has no applicable React Native terminal host export; use terminal primitives/render owner
CONTAINER_LAYOUT=outer width/height are SurfaceHostGeometry.logicalWidth/logicalHeight (laptop 1280×800 or mobile 360×800 declaration); outer host never exceeds that canvas; no scroll; spinner and status label centered by the existing host frame
```

Low-fidelity wireframe:

```text
┌──────────────────────── canvas logical size ────────────────────────┐
│                                                                     │
│                         [ spinner ]                                 │
│                   正在准备终端画布                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Screen `admin-login`

```text
CONSUMER_FACE=public (terminal-local operator surface; not a web public page)
UI_SURFACE=内容页（admin layer content; not a modal/Drawer）
HOST_AND_ENTRY=AdminLauncher real Pressable on isHostPrimaryDisplay; fresh admin layer; reopen after close
ACTOR=终端操作员
BUSINESS_SCENARIO=操作员在 host display 通过隐藏手势进入本机只读诊断
BUSINESS_GOAL=输入六位动态口令并进入诊断外壳，或明确知道为何不能进入
USER_VISIBLE_COPY=标题：终端管理；说明：请输入六位动态口令；六格掩码；验证；关闭；错误：口令不正确/无法读取设备时间/设备标识不可用
TECHNICAL_BOUNDARY=known/unknown identity, current local hour, pure verifier, no raw device ID/password/log payload
FOUNDATION_PRIMITIVE=NONE_WITH_REASON: terminal-local RN layer uses apps/terminal/ui/base/primitives and ui/base/input; the web admin foundation does not own this surface
CONTAINER_LAYOUT=admin layer root equals current SurfaceHostGeometry canvas; card width comes from the existing primitive container/card layout token and is clamped within the logical canvas; only the card content uses InputScrollArea if the 360×800 form exceeds height; root has no second scroll owner; keypad columns and action row share card insets
```

Low-fidelity wireframe:

```text
┌──────────────────────── 终端管理 ────────────────────────┐
│ 请输入六位动态口令                                         │
│       [•] [•] [•] [ ] [ ] [ ]                              │
│                                                           │
│       [1] [2] [3]                                         │
│       [4] [5] [6]                                         │
│       [7] [8] [9]                                         │
│       [删] [0]                                             │
│                                                           │
│  [口令不正确 / status]                 [验证] [关闭]       │
└───────────────────────────────────────────────────────────┘
```

### Screen `admin-console`

```text
CONSUMER_FACE=public (terminal-local operator surface; not a web public page)
UI_SURFACE=内容页（authenticated admin layer）
HOST_AND_ENTRY=AdminLogin successful real verify Pressable; shell mounts inside admin.console layer part
ACTOR=终端操作员
BUSINESS_SCENARIO=操作员已通过本次打开的本地动态口令
BUSINESS_GOAL=在不离开业务画布的情况下查看只读诊断 section
USER_VISIBLE_COPY=标题：终端管理；context labels：形态/画布/主承载显示；section titles from the selected catalog entry's title；关闭；空态：暂无可用诊断节
TECHNICAL_BOUNDARY=UiCatalog projection, renderer catalog, readonly command boundary, local selected part
FOUNDATION_PRIMITIVE=NONE_WITH_REASON: terminal layer/card/list lifecycle is owned by terminal render/input/primitives, not libraries/frontend/admin-ui-foundation
CONTAINER_LAYOUT=admin layer root equals logical canvas; shell header and section navigation stay inside root without horizontal overflow; section content has the one vertical scroll owner; navigation collection is bounded to four current entries and does not scroll independently; content/list may virtualize within that owner
```

Low-fidelity wireframe:

```text
┌──────────────────────── 终端管理 ────────────────────────┐
│ 形态: laptop  画布: PRIMARY  主承载显示: 是       [关闭] │
├───────────────────────────────────────────────────────────┤
│ [平台端口] [运行状态] [显示上下文] [示例节]              │
├───────────────────────────────────────────────────────────┤
│                                                           │
│                 <selected section content>                │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### Screen `admin-section-platform-ports`

```text
CONSUMER_FACE=public (terminal-local operator surface; not a web public page)
UI_SURFACE=内容 Tab（section content, selected by shell navigation）
HOST_AND_ENTRY=AdminSectionNavigation selects the catalog entry with rendererKey platform-ports
ACTOR=终端操作员
BUSINESS_SCENARIO=操作员需要知道各平台端口方法是否由 default/adapter/web 提供
BUSINESS_GOAL=按方法看到真实 state/source，不把部分注入误读成端口整体可用
USER_VISIBLE_COPY=标题：平台端口；列：能力/状态/来源；状态：可用/不可用/未提供；无动作
TECHNICAL_BOUNDARY=method-level PortDescriptorCapability; no raw binding object
FOUNDATION_PRIMITIVE=NONE_WITH_REASON: terminal readonly rows use terminal primitives; web admin foundation is not the owner
CONTAINER_LAYOUT=shell root canvas; one section-content vertical scroll owner for rows; table/list width is clamped to content frame; method label/state/source columns share a fixed token grid and do not create a second scroll ancestor
```

Low-fidelity wireframe:

```text
┌────────────── 平台端口 ──────────────┐
│ 能力             状态       来源       │
│ getDeviceInfo    可用       adapter    │
│ getDisplayInfo   可用       adapter    │
│ ...              不可用     default    │
└───────────────────────────────────────┘
```

### Screen `admin-section-runtime`

```text
CONSUMER_FACE=public (terminal-local operator surface; not a web public page)
UI_SURFACE=内容 Tab（section content, selected by shell navigation）
HOST_AND_ENTRY=AdminSectionNavigation selects rendererKey runtime
ACTOR=终端操作员
BUSINESS_SCENARIO=操作员核对运行时、调试态和设备标识可用性
BUSINESS_GOAL=看到不可变启动事实和当前状态，不能从 admin 页面改写它们
USER_VISIBLE_COPY=标题：运行状态；字段：运行状态/环境/调试态/设备标识；调试态：开启/关闭；标识：可用/不可用
TECHNICAL_BOUNDARY=RuntimeStateSource status and frozen RenderRuntimeFacts; no raw identity/password
FOUNDATION_PRIMITIVE=NONE_WITH_REASON: terminal readonly key-value rows use terminal primitives; no web foundation lifecycle applies
CONTAINER_LAYOUT=shell root canvas; one section-content vertical scroll owner for key/value rows; no horizontal overflow; labels and values align to the same semantic row grid
```

Low-fidelity wireframe:

```text
┌────────────── 运行状态 ──────────────┐
│ 运行状态              <value>         │
│ 环境                  <value>         │
│ 调试态                开启/关闭       │
│ 设备标识              可用/不可用     │
└───────────────────────────────────────┘
```

### Screen `admin-section-display-context`

```text
CONSUMER_FACE=public (terminal-local operator surface; not a web public page)
UI_SURFACE=内容 Tab（section content, selected by shell navigation）
HOST_AND_ENTRY=AdminSectionNavigation selects rendererKey display-context
ACTOR=终端操作员
BUSINESS_SCENARIO=操作员核对形态、画布模式、角色、实例模式和主承载显示事实
BUSINESS_GOAL=看清 canvas displayMode 与 physical-host boolean 的区别
USER_VISIBLE_COPY=标题：显示上下文；字段：形态/画布模式/显示角色/实例模式/主承载显示/承载状态；加载：正在准备终端画布
TECHNICAL_BOUNDARY=SurfaceHostSnapshot.isHostPrimaryDisplay and SurfaceContext, display selectors, readiness/geometry
FOUNDATION_PRIMITIVE=NONE_WITH_REASON: terminal context rows are owned by terminal render/primitives; web admin foundation is inapplicable
CONTAINER_LAYOUT=shell root canvas; one section-content vertical scroll owner; context labels and values align in a two-column grid; loading row occupies the same content frame and does not add a second scroll owner
```

Low-fidelity wireframe:

```text
┌────────────── 显示上下文 ────────────┐
│ 形态                  laptop           │
│ 画布模式              PRIMARY          │
│ 显示角色              CHIEF            │
│ 实例模式              MASTER           │
│ 主承载显示            是               │
│ 承载状态              ready/loading    │
└───────────────────────────────────────┘
```

### Screen `admin-section-sample`

```text
CONSUMER_FACE=public (terminal-local operator surface; not a web public page)
UI_SURFACE=内容 Tab（title-only production injected section）
HOST_AND_ENTRY=AdminSectionNavigation discovers sample.console.admin-test from the same catalog projection
ACTOR=终端操作员
BUSINESS_SCENARIO=操作员验证业务包可以通过生产注册通道提供 admin section
BUSINESS_GOAL=看到该 section 的标题占位，同时确认没有伪造内容
USER_VISIBLE_COPY=标题：示例诊断；内容：无；无按钮
TECHNICAL_BOUNDARY=sample-console definedPart/renderer identity and the shared `UiCatalog.entries` registration path; no admin metadata registry
FOUNDATION_PRIMITIVE=NONE_WITH_REASON: title-only terminal section has no web-admin foundation lifecycle to reuse
CONTAINER_LAYOUT=shell root canvas; one content frame, no inner scrolling because content is intentionally empty; title baseline aligns with other section headings
```

Low-fidelity wireframe:

```text
┌────────────── 示例诊断 ──────────────┐
│                                      │
│              （空内容）              │
│                                      │
└───────────────────────────────────────┘
```

## 1.2 Surface ownership roster

| screen id | declared UI_SURFACE | visible-element denominator | every element belongs to this surface | every copy has a visible position | conclusion |
| --- | --- | --- | --- | --- | --- |
| `admin-loading` | 独立页面 | title, spinner, status | yes | yes | `REVISE_PENDING_DEXTER` |
| `admin-login` | 内容页 | title, instruction, six cells, keypad, verify, close, error | yes | yes | `REVISE_PENDING_DEXTER` |
| `admin-console` | 内容页 | header, context, four section options, content frame, close | yes | yes | `REVISE_PENDING_DEXTER` |
| `admin-section-platform-ports` | 内容 Tab | heading, method rows | yes | yes | `REVISE_PENDING_DEXTER` |
| `admin-section-runtime` | 内容 Tab | heading, key/value rows | yes | yes | `REVISE_PENDING_DEXTER` |
| `admin-section-display-context` | 内容 Tab | heading, context rows | yes | yes | `REVISE_PENDING_DEXTER` |
| `admin-section-sample` | 内容 Tab | title, empty content | yes | yes | `REVISE_PENDING_DEXTER` |

## 1.3 v2 counterpart inventory

`SEARCH_RANGE=doc/heritage/registry.json terminal entries; all-v2 terminal admin-console screen registry and
static screen paths named by the discussion document; no matching frozen terminal admin screen was found in the
current source inventory.` This is a design inventory statement, not a runtime fallback.

| screen id | relation | all-v2 Heritage path@SHA-256 | static baseline | difference/reason |
| --- | --- | --- | --- | --- |
| `admin-loading` | `NO_V2_COUNTERPART` | `PENDING_HERITAGE_REGISTRATION` | no existing terminal admin host screen | new explicit host loading requirement |
| `admin-login` | `NO_V2_COUNTERPART` | `PENDING_HERITAGE_REGISTRATION` | no frozen terminal admin login screen | local gesture/password requirement |
| `admin-console` | `NO_V2_COUNTERPART` | `PENDING_HERITAGE_REGISTRATION` | no frozen terminal admin shell screen | new catalog-backed diagnostic shell |
| `admin-section-platform-ports` | `NO_V2_COUNTERPART` | `PENDING_HERITAGE_REGISTRATION` | no frozen counterpart | terminal kernel capability read |
| `admin-section-runtime` | `NO_V2_COUNTERPART` | `PENDING_HERITAGE_REGISTRATION` | no frozen counterpart | explicit runtime/debug fact |
| `admin-section-display-context` | `NO_V2_COUNTERPART` | `PENDING_HERITAGE_REGISTRATION` | no frozen counterpart | physical host/canvas distinction |
| `admin-section-sample` | `NO_V2_COUNTERPART` | `PENDING_HERITAGE_REGISTRATION` | no frozen counterpart | this batch's production registration proof |

## 1.4 L2/automation and implementation-facing control roster

L2/Web execution is not authorized in this implementation task. The roster is nevertheless complete for the
proposed user actions and observable states. Admin-owned IDs live in
`apps/terminal/ui/base/admin-shell/src/foundations/adminTestIds.ts`; the shared virtual keyboard keeps its
capability-owned IDs in `ui.base.input`. No future script may use text/index/wrapper locators.

| screen | user action/case | actual control/node | testID constant | wrapper/native distinction | focused/static proof | current conclusion |
| --- | --- | --- | --- | --- | --- | --- |
| `admin-login` | invoke gesture | `AdminLauncher.tsx#AdminLauncher` Pressable | `adminTestIds.launcher` | actual Pressable | sample-console focused test | `MATCHED: focused` |
| `admin-login` | digit 0–9 | `VirtualKeyboard.tsx#VirtualKeyboard` shared key `PrimitiveButton` | `ui.base.input:virtual-keyboard:text-<n>` | actual shared input-owner button | sample-console focused test | `MATCHED: focused` |
| `admin-login` | delete | `VirtualKeyboard.tsx#VirtualKeyboard` shared backspace `PrimitiveButton` | `ui.base.input:virtual-keyboard:backspace` | actual shared input-owner button | input focused test | `MATCHED: focused` |
| `admin-login` | verify | `AdminLogin.tsx#AdminLogin` verify Pressable | `adminTestIds.verify` | actual button | sample-console focused test | `MATCHED: focused` |
| `admin-login`/`admin-console` | close | `AdminLogin.tsx#AdminLogin` or `AdminShell.tsx#AdminShell` close Pressable | `adminTestIds.close` | actual button | sample-console focused test | `MATCHED: focused` |
| `admin-console` | platform tab | `AdminSectionNavigation.tsx#AdminSectionNavigation` option anchor | `adminTestIds.sections.platformPorts` | actual `PrimitivePressOption` | implementation present; not separately exercised | `MATCHED: implementation` |
| `admin-console` | runtime tab | same | `adminTestIds.sections.runtime` | actual `PrimitivePressOption` | sample-console focused test | `MATCHED: focused` |
| `admin-console` | display tab | same | `adminTestIds.sections.displayContext` | actual `PrimitivePressOption` | implementation present; not separately exercised | `MATCHED: implementation` |
| `admin-console` | sample tab | same | `adminTestIds.sections.sampleConsole` | actual `PrimitivePressOption` | sample-console focused test | `MATCHED: focused` |
| `admin-loading` | observe state | `SurfaceHostController.tsx#SurfaceHostController` loading View/Spinner | `ui-base-render:surface-host-loading-indicator` | actual host state node | render focused test | `MATCHED: focused` |

Implementation-facing minimum roster:

| control key | testID | real action node | composite option exception |
| --- | --- | --- | --- |
| launcher | `terminal.admin:launcher` | `AdminLauncher` Pressable | no |
| digit buttons | `ui.base.input:virtual-keyboard:text-<n>` | shared input-owner digit Pressable | no |
| delete | `ui.base.input:virtual-keyboard:backspace` | shared input-owner backspace Pressable | no |
| verify | `terminal.admin:verify` | verify Pressable | no |
| close | `terminal.admin:close` | close Pressable | no |
| platform/runtime/display/sample section options | `adminTestIds.sections.*` | visible option anchor/button | only if SegmentedControl cannot expose option-level data; prove same click semantics |
| loading observation | `ui-base-render:surface-host-loading-indicator` | host loading View/Spinner tree | no action |

## 1.5 Input-bearing control dependency graph

| visible control | shape | owner/initial source | upstream dependency | cascade clear/reload | options | loading/empty/failure | owner recheck on action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| six-digit password | virtual `CodeInput`/native-less input model | operator keypad; identity fact from assembly | host ready, fresh layer, current-hour source | close/unmount clears string; surface replacement clears | digits only, max six | identity unknown uses fallback rule; clock unavailable is explicit | `verifyAdminPassword` checks parsed identity/hour synchronously |
| verify | Button | local password string | exactly six digits | failure keeps login state; success replaces with shell | disabled until six | invalid/clock error adjacent | pure function is final local decision |
| section option | Tabs/SegmentedControl option | same `UiCatalog.entries` projection | authenticated shell, matching dimensions | selected key replaced; section-local scroll resets | four current entries in filtered catalog list order | empty catalog/unavailable selection typed | command boundary rejects navigation |
| bounded diagnostic collection | virtualized `List` where a list is used | one collection owner | fixed-height rows; 16 visible + 4 overscan on each side | `N-2=FOCUSED_PASS` from the 100-record scroll-transition fixture; no performance-headroom or visual claim | no truncation; section navigation remains a four-entry projection | empty state is typed | list does not own navigation or persistence |

## 1.6 State boundary and operation denominator

| screen/action | initial/loading | validation | submitting | success | conflict/denied | timeout/unknown | owner/face boundary |
| --- | --- | --- | --- | --- | --- | --- | --- |
| launcher | node absent on non-host/loading | gesture area/time/count | no async submit | fresh layer/login | non-host has no node | host readiness remains loading | render context gate; terminal-local operator |
| verify | empty/partial | six digits and current-hour/identity rule | synchronous pure check | authenticated shell | typed invalid/clock | unknown identity uses only fallback | admin-shell pure owner |
| section select | first available/none | exact catalog dimensions | synchronous local selection | content testID/text changes | unavailable/rejected navigation | no remote timeout | same catalog + admin boundary |
| close | authenticated/login layer | no form validation | existing close command | layer absent/local state discarded | already closed is idempotent local UI | N/A | UI-state layer owner |
| surface replace | current surface | frozen `SurfaceIdentity` differs, even when `displayMode` is unchanged | one SurfaceRoot lifecycle effect/command | geometry updated; only the exact admin layer in the previous display-mode state closes; business content/layers remain; replaced-surface field blurs | admin/auth/selection/admin scroll discarded; React root identity remains | host snapshot may be loading | render/input/ui-state boundary |

| operation denominator | source | user reason | shorter path | why not chosen | attribution | Dexter decision |
| --- | --- | --- | --- | --- | --- | --- |
| hidden launcher gesture | requirements AC-1 / Journey proposal §2 | open local diagnostics without visible business navigation | visible menu/shortcut would be shorter | explicit hidden host gesture is the accepted entry and avoids a second route | product/Journey | no new decision |
| keypad digit/delete | requirements AC-2/IN-4 | satisfy keyboard retirement with one string | native TextInput is shorter to code | leaves system keyboard and caller escape hatch | product/input owner | shared `ui.base.input` virtual keyboard owns the real buttons |
| verify | requirements AC-2 | establish local authentication | auto-verify at six digits is shorter | explicit action gives typed error/retry point | product/interaction | wireframe may refine |
| section option | requirements AC-3/AC-6 | inspect four bounded diagnostic sections | route stack is longer | creates second navigation owner | product/architecture | wireframe may refine |
| close | requirements AC-3.4 | leave diagnostic overlay and reset auth | outside tap is shorter | full shell needs explicit, testable exit and outside tap is not reliable | product/LayerStack | no new decision |
| reopen | requirements AC-3.4/AC-2.7 | require fresh authentication | persist session is shorter | violates security/lifecycle requirement | product | no new decision |

## 1.7 Face/owner alignment

| screen/action | consumer face | admission | server operation | owner readback/command | cannot be replaced by frontend |
| --- | --- | --- | --- | --- | --- |
| host launcher | terminal-local public template face | physical host bool | N/A no server | render context + `openLayer` owner | physical index/host fact |
| login verify | terminal-local public template face | fresh layer + six digits | N/A no server | admin pure verifier | identity/time rule |
| section list/content | terminal-local public template face | same catalog dimensions + auth | N/A no server | UiCatalog projection/render catalog | part availability and renderer identity |
| platform rows | terminal-local public template face | authenticated section | N/A no server | platform-ports descriptor snapshot | method-level state/source |
| runtime rows | terminal-local public template face | authenticated section | N/A no server | stateSource + runtime facts | startup debug/identity facts |
| display rows | terminal-local public template face | authenticated section | N/A no server | SurfaceHostSnapshot/SurfaceContext | physical host vs canvas mode |
| close/surface replacement | terminal-local public template face | existing layer owner | N/A no server | UI-state layer command + render lifecycle | non-persistence and focus/scroll cleanup |

## 1.8 Manifest and foundation cross-check

| manifest/foundation item | result |
| --- | --- |
| `B.4/B.5` web admin foundation exports | `NOT_APPLICABLE_WITH_REASON`: this is a terminal RN surface; exact terminal owners are listed per screen and no web foundation import is proposed |
| all-v2 static counterpart | `NO_V2_COUNTERPART` per §1.3; no runtime/build fallback |
| L2 binding | `BLOCKED`: no implementation, no accepted visual review, and no actual binding |
| high-fidelity demo | `NOT_REQUIRED`: low-fidelity structure is sufficient for this proposal; Dexter may request a separate static demo |

## 2. Screen interaction contracts

Each screen has the ten required fields: entry, visible information, primary action, secondary action, disabled state, loading state, error state, success state, focus/accessibility, and test observation.

### 2.1 Host loading

1. `entry`: the host snapshot or usable geometry is absent.
2. `visible information`: `DRAFT_TERMINAL_COPY` “正在准备终端画布” plus a spinner.
3. `primary action`: none; waiting is automatic.
4. `secondary action`: none.
5. `disabled state`: no admin control is actionable; business children are absent from the host subtree.
6. `loading state`: the screen itself is the loading state; `accessibilityState.busy=true`.
7. `error state`: a typed host failure, if an owner provides one, remains distinct from loading; no fail-open/fail-closed gate is invented here.
8. `success state`: the host controller replaces the loading node with the transformed canvas and children.
9. `focus/accessibility`: status role/live announcement; no focus trap and no password focus while children are absent.
10. `test observation`: find `ui-base-render:surface-host-loading-indicator`; assert no child business/admin node and then assert replacement after a usable snapshot.

### 2.2 Login

1. `entry`: real host launcher press, or a new admin layer after close; state starts unauthenticated.
2. `visible information`: title, six masked cells, numeric keypad, verify, close, and typed state/error.
3. `primary action`: `验证` after six digits; it calls the pure password verification boundary.
4. `secondary action`: `关闭`; it calls the layer close command and discards local state.
5. `disabled state`: verify disabled for fewer than six digits, while keypad remains enabled unless a typed clock/host error disables retry.
6. `loading state`: while device identity/current-hour data is being resolved at assembly startup, the layer is not opened; after assembly, verification is synchronous. A second port await is forbidden.
7. `error state`: `口令不正确`, `无法读取设备时间`, or a generic `设备标识不可用` status. No password, raw device ID, token, or raw payload is shown/logged.
8. `success state`: login content is replaced by the authenticated shell; the login field and keypad leave the tree.
9. `focus/accessibility`: keypad buttons are real accessible buttons; masked display has a label describing digit count, not the value; system keyboard is structurally suppressed.
10. `test observation`: use the launcher node, six or more actual keypad button nodes, actual verify button, actual close button; do not call a reducer/state setter directly.

### 2.3 Authenticated shell

1. `entry`: successful login control action.
2. `visible information`: shell title, current display context summary, section navigation, selected content, close.
3. `primary action`: selecting a section tab/segment; it changes the content frame.
4. `secondary action`: `关闭`.
5. `disabled state`: selected tab is disabled or marked selected; tabs unavailable under the current catalog context do not render.
6. `loading state`: section renderer may show a local read-only loading state only if its data owner reports pending; it must not replace the host loading state.
7. `error state`: empty catalog, section unavailable, or navigation rejected are typed and visible without changing the business screen.
8. `success state`: selected section's heading/content differs from the prior section and selected state moves to the new control.
9. `focus/accessibility`: section controls have stable labels and selected state; content heading is announced after selection; close remains reachable.
10. `test observation`: press an actual navigation control and compare content testID/text and selected state; inspect the navigation boundary rejection.

### 2.4 Platform ports section

1. `entry`: shell selection from the catalog projection.
2. `visible information`: one row per method; method state and descriptor source.
3. `primary action`: none; it is read-only.
4. `secondary action`: section navigation or close from the shell.
5. `disabled state`: rows are not controls; unavailable method state is not a disabled aggregate shell.
6. `loading state`: only if the descriptor source explicitly reports pending; no `__DEV__` log is treated as data.
7. `error state`: typed descriptor-unavailable row.
8. `success state`: real adapter/default/web descriptor rows render, including method-level `ADAPTER_NOT_INJECTED` states.
9. `focus/accessibility`: table/list row labels include method name, state, and source; no secret values.
10. `test observation`: inject distinct method-level descriptors and assert rows differ; run the non-DEV source path in static/focused proof.

### 2.5 Runtime section

1. `entry`: shell selection from the catalog projection.
2. `visible information`: runtime status, environment mode, debug state/source, identity availability.
3. `primary action`: none.
4. `secondary action`: shell navigation or close.
5. `disabled state`: facts are not switches; no admin toggle is rendered.
6. `loading state`: only a typed missing-fact row if the assembly source has not supplied a fact; no silent default.
7. `error state`: status/identity unavailable is explicit; password derivation remains governed by login state.
8. `success state`: `debugMode=on` is observable even for a production package when the startup/packaging source says so.
9. `focus/accessibility`: read-only values are grouped with headings and announced without exposing secrets.
10. `test observation`: construct production-mode facts with debug on/off and assert the displayed state follows the source priority.

### 2.6 Display context section

1. `entry`: shell selection from the catalog projection.
2. `visible information`: surface form, display mode, display role, instance mode, host bool, readiness/geometry summary.
3. `primary action`: none.
4. `secondary action`: shell navigation or close.
5. `disabled state`: all rows are read-only.
6. `loading state`: readiness row says loading while the host controller shows the loading screen.
7. `error state`: typed invalid/incomplete host snapshot; it must not be rewritten as `not host`.
8. `success state`: index 0 shows host true and index 1 shows host false while canvas mode is independently shown.
9. `focus/accessibility`: rows are labelled with the semantic distinction “主承载显示” versus “画布显示模式”.
10. `test observation`: create surfaces at both physical indices, inspect context values and source key selection; do not use `displayMode` as the host source key.

### 2.7 Sample injected section

1. `entry`: catalog projection discovers the sample-console entry.
2. `visible information`: section title only and an empty content frame.
3. `primary action`: none.
4. `secondary action`: shell navigation or close.
5. `disabled state`: no content controls.
6. `loading state`: not applicable to an empty placeholder; the shell may show its normal content frame.
7. `error state`: unavailable if the part fails dimension filtering; no hard-coded fallback section is allowed.
8. `success state`: the title is visible and the same part key can be removed from the catalog to make the section disappear.
9. `focus/accessibility`: heading has a level and the empty region has a meaningful label, without inventing content.
10. `test observation`: discover the entry through `UiCatalog.entries`, press the real tab, assert title/empty content, then rebuild without that entry and assert removal.

## 3. Controls and stable test IDs

Test IDs identify interaction surfaces, not Journey IDs. The exact strings are proposed and must be kept stable once Dexter approves the wireframe.

| Control | Proposed testID | Real action | Required assertion |
| --- | --- | --- | --- |
| host launcher | `terminal.admin:launcher` | press with logical gesture payload | admin layer opens unauthenticated only on host |
| keypad digit | `ui.base.input:virtual-keyboard:text-<0-9>` | press visible shared key | one password string changes |
| delete | `ui.base.input:virtual-keyboard:backspace` | press | last digit removed |
| verify | `terminal.admin:verify` | press | pure verification result drives login/error |
| close login/shell | `terminal.admin:close` | press | layer is removed and local state is discarded |
| platform section | `terminal.admin:section:platform-ports` | press tab/segment | platform content becomes visible |
| runtime section | `terminal.admin:section:runtime` | press tab/segment | runtime content becomes visible |
| display section | `terminal.admin:section:display-context` | press tab/segment | display content becomes visible |
| sample section | `terminal.admin:section:sample-console` | press tab/segment | title-only sample content becomes visible |
| content frame | `terminal.admin:content` | observation only | content testID/text changes after section press |
| loading host | `ui-base-render:surface-host-loading-indicator` | observation only | spinner visible and children absent |

Gesture tracking is a real launcher action with logical coordinates. The tracker rejects a gesture outside 96×96, before 1800 ms, or with fewer than five repetitions. A successful gesture is still subject to the physical host boolean; it cannot override it.

## 4. Interaction map

| From | User action | To | Data/owner | Rejected action |
| --- | --- | --- | --- | --- |
| host surface | gesture on launcher | fresh login layer | admin layer owner + local input state | secondary display has no launcher |
| login | keypad digit | updated masked six-cell state | admin shell local state | direct reducer/state setter is not an interaction |
| login | verify | shell or typed error | pure password function; no port await | fewer than six digits |
| login/shell | close | no admin layer | LayerStack/UI-state layer owner | auth state retained |
| shell | section control | different content | same catalog projection | business navigation command |
| section | attempted navigation dispatch | same section + typed rejection | admin command boundary | `showScreen`/`openLayer` succeeds |
| any surface | display/form identity change | business content with no admin overlay | SurfaceRoot/render lifecycle | admin/auth/focus/scroll silently retained |
| host pending | wait | host-ready content | SurfaceHostController | child tree renders behind loading |

## 5. Path reasonableness and ownership

### Launcher

The host gesture is a Dexter-required Journey entry, not a historical shortcut inferred from the POCs. A stable real node is needed because the terminal has no ordinary admin menu entry in the current scope. The node is owned by `admin-shell`; the physical gate is supplied by render context; layer creation is delegated to the existing UI-state command API. A shorter path would be a global keyboard shortcut or a navigation menu, but each would add a second entry path, be unsuitable for the restricted host-display requirement, or conflict with the requirement's explicit gesture. No such alternative is introduced.

### Login

A visible keypad plus one string is the shortest path that satisfies system-keyboard retirement and six-digit authentication. A native `TextInput` with `showSoftInputOnFocus=false` is not an acceptable replacement because it leaves a second input path and makes the keyboard contract dependent on each caller. A hidden text field is also not used; native-less input is a small extension to the existing `InputField`/`InputController` model.

### Section navigation

Tabs/segments are proposed because the current section collection is bounded to four and the operator must compare diagnostic sections without leaving the overlay. A separate screen stack, route, or nested navigation controller would be longer and would create an additional navigation owner. If Dexter's wireframe requires a drawer or vertical list, the same catalog projection and command boundary remain; only the presentation primitive changes.

### Close and reopen

Close is a persistent shell control because this is a full overlay and the operator must explicitly leave diagnostics. Reopening to login is a security and lifecycle requirement, not a navigation preference. Persisting the selection would be shorter to implement but violates the explicit re-authentication boundary.

### Dynamic canvas switch

The display/form switch is driven by the integration surface identity, not an admin control. Recomputing geometry and closing transient layers avoids stale transforms and stale authentication. Preserving business content is required; preserving admin focus/scroll would leak a local overlay across a replaced surface. The focused script must observe geometry, console presence, focus, and scroll independently.

## 6. Visual and accessibility contract

- Use semantic colors/tokens only; no literal status colors in business/admin components.
- Use the existing primitives and vendor slots. Do not add `DialogSurface`; compose a card container, heading, content, and actions.
- All interactive controls expose label, role, disabled/selected/busy state, and stable testID.
- Loading uses a status/spinner primitive with a visible label.
- Errors are adjacent to the control or section they describe and are not conveyed by color alone.
- Masked password cells expose count/state, not the password string.
- Text and controls use logical canvas coordinates and the same transformed surface frame as the host.
- Focus suspension is surface-level. A 0→nonzero layer transition emits one suspend event; opening another layer while layers already exist emits none; closing the last layer restores focus once.
- `showSoftInputOnFocus` is absent from primitive public props and fixed inside vendor implementation. Every password key action is virtual input.

## 7. Dexter visual/product conclusion

```text
LOW_FIDELITY_WIREFRAME=PROPOSED_ONLY
DEXTER_WIREFRAME_REVIEW=UNSET
HIGH_FIDELITY_VISUAL_REVIEW=NOT_REQUIRED_FOR_THIS_DRAFT
ALLOW_IMPLEMENTATION_FACING_VISUAL_BINDING=false
L2_USER_VISIBLE=BLOCKED
```

The ASCII wireframes above are a review input, not a visual acceptance result. Focused/static implementation
evidence is recorded separately; no Web, Android, native, release, or screenshot evidence is claimed. Dexter's
ruling to retain already-open business layers during surface identity replacement is recorded above. Future L2
bindings still require wireframe/product approval and a fresh independent admission review.

## 8. Evidence and review status

| Evidence | Required action | Status now | Fresh |
| --- | --- | --- | --- |
| static | inspect exact imports/props/symbols and catalog projection | implementation static PASS; see evidence document | fresh main-agent process |
| focused | script real launcher/keypad/verify/section/close/reopen actions | implementation focused PASS for exercised scenarios; see evidence document | fresh main-agent test processes |
| Web | index 0/1 host mapping and geometry | not run; explicit runtime exclusion | no session |
| Android | native ID, dual-display, IME, geometry | not run; explicit runtime exclusion | no session |
| native | Kotlin unit/snapshot proof | not run | no session |
| release | production debug source/keyboard absence | not run | no session |
| visual | Dexter wireframe and visual review | unset | no session |

Before any implementation handoff, this artifact and the IA must undergo two fresh independent design review rounds with the blind input list in the companion review request. A review GO cannot substitute for Dexter's visual/product decision.
