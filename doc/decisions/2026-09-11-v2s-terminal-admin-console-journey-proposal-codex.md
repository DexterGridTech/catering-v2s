# TER terminal admin console Journey proposal

`SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0`

## 0. Status and authority

- `DOCUMENT_KIND=JOURNEY_PROPOSAL`
- `JOURNEY_ID=TERMINAL_ADMIN_CONSOLE` (documentation-only; it must not enter runtime, test, package, class, or file names)
- `STATUS=PROPOSED`
- `DESIGN_STATUS=BLOCKED_FOR_DEXTER_WIREFRAME_REVIEW`
- `IMPLEMENTATION_AUTHORITY=false`
- `REVIEW_TARGET=DESIGN`
- `REVIEW_CYCLE_ID=TERMINAL_ADMIN_CONSOLE_DESIGN_20260911`
- `INDEPENDENT_REVIEW_ROUND=ROUND_2_NO_GO_FINAL (6M/2S/2N after Dexter rulings)`
- `REMEDIATION_INTAKE=doc/review/platform/2026-09-11-v2s-terminal-admin-console-design-remediation-intake-codex.md`
- `CURRENT_BYTES_AFTER_REMEDIATION=NOT_REVIEWED_BY_HISTORICAL_ROUND_2`
- `EVIDENCE_STATUS=DESIGN_ONLY`

This document turns the accepted requirements into a reviewable Journey proposal. It does not approve the Journey, freeze visual wording, authorize implementation, or claim any Web, Android, native, release, or visual acceptance evidence. The requirements document remains the product source; this proposal is an implementation-facing input awaiting Dexter's wireframe/interaction decision and the required fresh independent design reviews.

## 1. User problem

The terminal operator needs a local, read-only diagnostic console that can be opened on the host display without changing business content or requiring a second registry, a second input pipeline, or a backend write capability. The operator must be able to:

1. invoke the console from the accepted host-display gesture;
2. authenticate again for every open;
3. inspect the same catalog-backed admin sections that the terminal assembly actually registers;
4. switch between sections without leaving the console;
5. close the console and prove that reopening returns to authentication rather than to the previous section;
6. inspect device identity availability, runtime/debug state, platform-port capability state, and display context without mutating them;
7. see an explicit loading state while the host surface is not ready; and
8. keep the business surface running while the overlay is open or closed.

## 2. Actor, entry, and exit

### Actor

`TerminalOperator` is the person holding the terminal. No backend account, remote session, or server-side permission is introduced by this batch. The local physical-display gate and the local password derivation are the only access checks in this Journey.

### Entry preconditions

- The assembly has created a surface for a physical display index.
- The integration boundary retains the physical `displayIndex`, derives `displayMode` and `isHostPrimaryDisplay` from that index and current display context, and initializes the assembly's single non-persisted `surfaceForm` fact in `ui-state`. Render and admission read that same state fact; they do not receive a second React-only form value.
- The host surface may still be loading. Loading is rendered, not treated as an authorization result.
- The admin catalog entries, including the sample-console injected section, are from the one `UiCatalog` used by the assembly.

### Entry action

The operator performs the host-display gesture on the stable launcher node. The launcher exists only when `isHostPrimaryDisplay === true`; it is not a hidden global command and does not accept a secondary-display invocation.

### Exit actions

- `Close` removes the admin layer and discards the local authentication and selected-section state.
- A surface identity replacement retains all business content and business layers in their owners, blurs the replaced surface's active field, and closes only the targeted transient admin layer. The close uses the replaced surface's previous `displayMode` and the exact `ADMIN_CONSOLE_LAYER_ID`; the admin console is not silently reopened when a surface returns to the previous display mode.
- Failed authentication stays on the login screen and exposes a typed, non-sensitive error state.

## 3. Journey sequence

| Node | User-visible operation | State transition | Required invariant | Evidence target |
| --- | --- | --- | --- | --- |
| J-01 | Invoke host launcher | no layer → admin layer in unauthenticated state | only the physical host display can open it | focused script-driven |
| J-02 | Enter six-digit password using visible keypad | login draft changes | one local string is the source of truth; no native system keyboard | focused |
| J-03 | Verify | unauthenticated → authenticated or typed error | known identity rejects `123456`; unknown identity accepts only the fallback `123456` | focused + static pure-function |
| J-04 | Inspect default section | authenticated → first available section | section list is a projection of the same catalog, filtered by all declared dimensions | focused |
| J-05 | Switch section | selected section A → selected section B | visible content really changes; no navigation command escapes the section context | focused |
| J-06 | Close | authenticated admin layer → no admin layer | no selected section or auth state is persisted | focused |
| J-07 | Invoke again | no layer → unauthenticated admin layer | reopening always returns to login, not to the previous section | focused |
| J-08 | Observe host loading | pending host snapshot → explicit loading UI | children do not render while geometry is unavailable; this is not fail-open/fail-closed gating | focused + static |
| J-09 | Change surface identity | display/form identity A → B | geometry is recomputed; admin is closed; focus and local scroll are not incorrectly carried across surfaces | focused script-driven |

## 4. Screens and states

The detailed IA and interaction artifacts define the following screens. They are proposal-state artifacts and use `DRAFT_TERMINAL_COPY` until Dexter approves wording and layout.

| Screen | Purpose | Entry | Exit | Mandatory states |
| --- | --- | --- | --- | --- |
| `admin-loading` | show that the host surface is not ready | surface host snapshot absent or incomplete | snapshot becomes usable | loading; no children |
| `admin-login` | collect the local password | launcher opened or console reopened | verify, close, or surface replacement | empty; partial; six digits; invalid; unknown identity; clock unavailable |
| `admin-console` | host-sized read-only admin shell | successful verification | close or surface replacement | authenticated; catalog empty; section unavailable |
| `admin-section-platform-ports` | show method-level capability descriptors | selected by projection | select another section or close | adapter/default/web source; unavailable method |
| `admin-section-runtime` | show immutable runtime/debug facts and state status | selected by projection | select another section or close | debug off/on; startup facts unavailable |
| `admin-section-display-context` | show display role/mode/form/host status | selected by projection | select another section or close | primary/secondary; host/non-host; host loading |
| `admin-section-sample` | prove a production package can register a section | selected by same catalog projection | select another section or close | title-only placeholder; empty content |

## 5. Scope and non-goals

In scope:

- physical-index-to-host-source data flow at the integration boundary;
- `surfaceForm` as a catalog and rendering dimension, with one assembly-owned `ui-state` selector shared by admission and render context;
- layer-only part selection semantics for `containerKeys=[]`;
- one catalog-backed admin-section projection;
- local re-authentication and read-only diagnostics;
- device identity read/derivation contract;
- runtime debug fact with explicit source priority;
- system-keyboard retirement and virtual-keyboard-only password entry;
- loading UI, dynamic canvas switching, and focused interaction probes;
- the sample-console production consumer section.

Out of scope:

- admin writes, commands that mutate business data, or server-side authorization;
- a second part registry, overlay stack, input pipeline, or navigation system;
- `DialogSurface`; cards and headings remain composed from existing primitives;
- backend HTTP, database, migration, seed, polling, or transport gateway work;
- Web, Android, native, release, UAT, DEV, or deployment execution in this design task;
- claiming complete visual parity from static or focused evidence.

## 6. Interaction principles

1. The console is an overlay over the current surface, not a replacement application.
2. The launcher is a real control node and the login keypad, section tabs, close control, and reopen path are all exercised through real control actions in focused proof.
3. The console reads the same catalog the package uses to render; no hard-coded admin list is permitted.
4. Section renderers receive read-only data and a command boundary that rejects navigation commands.
5. Password entry is a virtual-keyboard interaction with one string state. The system keyboard is not a fallback.
6. A missing host snapshot has a visible loading state and renders no children. It is not a display-gate result.
7. A display/form change recomputes geometry and closes only the transient admin layer. Business content and business layers remain in kernel owners; admin authentication, selection, local scroll, and replaced-surface focus do not cross the identity boundary.

## 7. Product decisions that remain explicit

The requirements supply the scope and non-negotiable behavior. The following are design choices made visible for Dexter rather than smuggled into implementation:

- `admin.sections` is the fixed container key for section parts.
- `admin.console` is a layer-only part with an empty `containerKeys` array.
- section ordering is the relative order of the filtered entries in the single `UiCatalog.entries` list. `createUiCatalog` preserves that order; there is no `adminSection.order` field or second owner/order registry.
- existing dimension fields plus `surfaceForm` are the section visibility declaration; a second visibility registry is not created.
- a surface identity replacement retains all business content and business layers, blurs the replaced surface's active field, and closes only `ADMIN_CONSOLE_LAYER_ID` in the previous surface display-mode state. Admin authentication, selected section, local admin scroll, and replaced-surface focus are discarded. This is the smallest targeted lifecycle rule consistent with Dexter's ruling; whole-root remount and `clearLayers` are forbidden.
- The shared constants are `ADMIN_CONSOLE_PART_KEY=admin.console`, `ADMIN_CONSOLE_LAYER_ID=admin.console.layer`, `ADMIN_CONSOLE_FOCUS_SCOPE_ID=admin.console`, and `ADMIN_SECTION_CONTAINER_KEY=admin.sections`.
- the sample section is mobile-form-visible, title-only, and contributed by `sample-console`'s production assembly; “owned” is provenance/documentation here, not an `owner` field in the catalog entry. It is a real registered part, not a test-only fixture.

## 8. Acceptance boundary

This proposal can be sent to a fresh independent design reviewer only after the design bundle is complete. The required review prompt must ask the reviewer to find why the design does not satisfy the requirements, must provide the minimum input list, and must not preload the author's self-review or prior verdict. Two review rounds are required; round two is final and `SELF_DECIDED`. Neither review substitutes for Dexter's product/visual decision. Until those gates close, the Journey remains `PROPOSED` and implementation remains unauthorized.
