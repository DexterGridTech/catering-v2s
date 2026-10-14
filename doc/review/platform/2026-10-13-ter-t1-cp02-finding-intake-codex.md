# TER T1 · CP-02 finding intake and disposition

Date: 2026-10-13  
Scope: CP-02 complete stage, including the two findings returned by the first fresh CP-02 reconciliation.  
Verdict type: author intake only; this is not an independent CP reconciliation or implementation GO.

## Basis reopened by the main agent

- Formal requirement: `doc/plans/platform/2026-10-13-ter-key-code-structure-t1-formal-requirements-codex.md`, R-08 through R-10.
- Design: `doc/plans/platform/2026-10-13-ter-key-code-structure-t1-implementation-design-codex.md`, §8.2–§8.3.
- Plan: `doc/plans/platform/2026-10-13-ter-key-code-structure-t1-implementation-plan-codex.md`, CP-02.
- Relevant project-memory route: `scripts/context/recall-memory --task-kind implementation --domain platform --consumer-face platform-admin --owner platform --impact architecture --trigger implementation`; kernel, deterministic-context-only, terminal coding standard pointer, terminal architecture rulings, and implementation source reread discipline were reopened. `doc/platform/terminal-coding-standard.md` TR-03/TR-09 was reread at the owning exception text.
- Reopened memory byte references: `project-memory/decisions/deterministic-context-only.md` SHA-256 `0137a797b55c18455b9f76ad2b9a54eb299e57f06c3afed5d1764c7f5fcefbca`; `project-memory/decisions/terminal-architecture-and-stack-rulings.md` SHA-256 `86dc3279e355d26c18d8b6227f01ac67b792b772cb7d83c3e815779d1d7fbc90`; `project-memory/operations/terminal-coding-standard.md` SHA-256 `a127b502d244c1c495255a91fefc461b6bec54f3f140fc09ac3ef536d22f7da7`; `project-memory/operations/implementation-source-reread-discipline.md` SHA-256 `25720c1b8c6f8f4f45cbd3cf07646f1644d8575246b1dee83e0df2348fa91ab0`.
- Source read before and after focused proof: State runtime and tests; Topology state-sync controller and tests; terminal-activation module/dependencies/package/test/README; both integration module and assembly paths and route tests.

## Finding dispositions

### CP02-SYNC-1 · Topology used raw business-slice identity

Classification: `CONFIRMED`.

The reviewer’s source observation was correct. Before the repair, `createTopologyStateSyncController` indexed `context.getState()` by each declared business slice name and used that raw slice object as its deduplication identity. That exceeded the intended boundary: R-09 and design §8.3 assign projection and its stable identity to State, while Topology may read its own topology state and consume State’s sync API.

Minimum repair: State caches one generated sync payload per registered slice and source-state reference. Repeated reads for an unchanged slice return the same payload reference; a new source reference produces a new payload. Topology now requests the payload first and uses that payload reference for the existing in-flight, queued, last-success, and deterministic-failure checks. A changed authoritative apply invalidates only that slice’s cached projection; no-op apply keeps it. Reset and dispose clear the short-lived cache. No revision counter, second cache, or topology-specific payload store was added.

Current locations: `apps/terminal/kernel/base/state/src/application/createStateRuntime.ts:112-186,211-213`; `apps/terminal/kernel/base/topology/src/application/createTopologyStateSyncController.ts:168-198`.

Focused proof:

- State stable-reference/change test: 1 passed, 49 skipped in `state/test/persistence.test.ts`.
- Topology deterministic failure/change test: 1 passed, 43 skipped in `topology/test/topology.test.ts`.
- State and Topology package typechecks: passed.

Smaller alternatives considered: using a new explicit revision API or returning raw slice identity would add API/state or preserve the ownership leak. Caching the existing approved projection is the smaller fit to the design.

### CP02-ACTIVATION-1 · The integration packages still owned activation routing

Classification: `CONFIRMED`.

The reviewer’s observation was correct. R-08 requires a generic UI presentation command to be handled by its UI owner package; the design and CP-02 narrow integration to application stage priority and dispatching the public owner command. Before the repair, both integrations defined the same `terminal-activation-route` actor and duplicated the mapping from route context to the activation part.

Minimum repair: `terminal-activation` now creates the route actor itself. It chooses from its own declared parts using the injected `surfaceForm` and the command route context, then idempotently issues the existing `showScreenCommand`. Both integrations retain their stage selector and now only dispatch `needToActivateTerminalCommand`. The package declares its actual runtime dependency on `ui-state`; no route registry or shared generic router was introduced.

Current locations: `apps/terminal/ui/base/terminal-activation/src/application/module.ts:11-63`; `src/dependencies.ts`; `package.json`; `README.md`; both `apps/terminal/ui/integration/*-console/src/application/module.ts` route-placement functions and assemblies.

Focused proof:

- Terminal activation package test: 3 passed.
- Console activation route test: 1 passed, 46 skipped.
- Wallpaper-console activation route test: 1 passed, 23 skipped.
- Terminal activation and both integration package typechecks: passed.
- The console route test was extended to issue the same activation intent again after each of MMP/LMP/LMS/LSP routes, then assert the MAIN content slice reference is unchanged; the focused rerun passed (1 passed, 46 skipped). The console integration typecheck was rerun after that test-only change and exited 0.
- Static scan found `terminal-activation-route` only in the terminal-activation package and found no `state[declaration.name]` in the Topology controller.

Smaller alternatives considered: keeping the actor in both integrations or moving only the mapping helper would preserve duplicate behavior ownership. Deriving the choice from this package’s actual part declarations removes both copies without a new API.

## Readback and evidence boundary

After the focused proofs, the main agent reread R-08/R-09, design §8.2–§8.3, CP-02, TR-03/TR-09, and the changed source and tests. The current formal requirement SHA remains `b92a34101871a53341b334d02235bd301e03ebbebe840d39438302e21712443e`; detailed design SHA is `276e0421b550b255234e4cec12c4f6ba79ecc3f37f1517dd2eb917d25bed03e7`; plan SHA is `37f08f6b674f11d00f698c4e41c376e32a301006da389749a2d919107c4e2fca`.

## Memory-route failure discovered during reconciliation

The fresh CP-02 reviewer initially returned `OPEN` only because the six-dimensional memory command stopped at an exact assertion-anchor mismatch in `project-memory/required-inventory.json`. The owning test had been renamed when the Topology proof was changed to assert State projection identity, but its registered exact-line anchor had not been updated. This is the same-root maintenance obligation described in `project-memory/pitfalls/line-number-as-anchor.md`.

Minimum repair: updated that one canonical `required-inventory.json` anchor to the current full test declaration, then regenerated the derived index. Current test declaration: `apps/terminal/kernel/base/topology/test/topology.test.ts:816`; current required-inventory SHA-256 `7580738d39964d6f1a746088ff71659d87457b01ea08723816c2da742e9d1099`; derived `project-memory/index.json` SHA-256 `fe7776017e2a79601a9ef8cb29b857cd09bfdf3ab5fee6662d551aff1a451eac`.

Actual route used after correction: `scripts/context/recall-memory --task-kind review --domain platform --consumer-face platform-admin --owner platform --impact architecture --trigger review`; result `PROJECT_MEMORY=PASS`, with the current six-dimensional route and routed source refs. `scripts/memory/build-index` and `scripts/memory/build-index --check` both returned `PROJECT_MEMORY=PASS`, `ENTRIES=85`, `KERNEL=6`, `ROUTED=79`. A fresh independent CP-02 reviewer must re-open this corrected route and reconcile the complete stage before CP-03 begins.

This repair changes only the memory assertion anchor/index; it does not upgrade the earlier reviewer `OPEN` or the author intake into an independent `MATCHED`. No dynamic, Expo Web, Android, DEV, reset/seed, or full verify run was performed for this intake.

## CP-02 finding from the next fresh reconciliation

### CP02-UI-FACTORY-1 · Old UI forwarding factory still had live consumers

Classification: `CONFIRMED`.

The fresh reviewer found that the CP-02 requirement to remove the old forwarding path after migration had not been completed. `createFeatureAssemblyModule` and its type remained public, and the member-desk, staff-auth, and wallpaper-picker modules still called it. This left the retired UI-only wrapper and its forwarding export active after the generic `createUiRuntimeModule` had been introduced.

Minimum repair: migrated those three feature modules to `createUiRuntimeModule`; removed `createFeatureAssemblyModule` and its input type, file and barrel export; updated the feature-assembly test, README and `terminal-invariants.json`. No new assembly layer or registry was added.

Focused proof and same-root checks:

- `@catering-v2s/ui-base-feature-assembly` typecheck passed; its focused test passed (2/2).
- `@catering-v2s/ui-feature-sample-member-desk`, `@catering-v2s/ui-feature-sample-staff-auth` and `@catering-v2s/ui-feature-sample-wallpaper-picker` typechecks passed.
- `@catering-v2s/ui-integration-sample-console` and `@catering-v2s/ui-integration-sample-wallpaper-console` typechecks passed.
- The console real-assembly contribution test passed (1 passed, 46 skipped) after replacing its assumptions about cross-surface collection order and a fixed total count with identity-based assertions. The test helper merges catalog entries from laptop and mobile assemblies; that aggregate order/count is not the behavior required by R-08. It now checks that every package-owned part appears unchanged and that the named integration contributions retain exact metadata.
- The wallpaper-console contribution test passed (1 passed, 23 skipped), covering distinct primary laptop/mobile parts and laptop-only secondary parts.
- `rg` over `apps/terminal` and `project-memory` found no remaining `createFeatureAssemblyModule`, `CreateFeatureAssemblyModuleInput` or old feature-module wrapper names. `scripts/memory/build-index --check` passed with 85 entries, 6 kernel and 79 routed memories.

Readback: formal requirement R-08; design §8.2; plan CP-02; the three owner modules; feature-assembly barrel, README, invariants and test; both integration contribution tests. The package contributions are still returned by their owners and collected from explicitly loaded modules. The old forwarding assembly no longer has a source, export or consumer.

An independent fresh CP-02 reconciliation is still required. The earlier `OPEN` remains the independent result until that review completes. No Expo Web, Android, DEV, reset/seed, L2, UAT or dynamic run was performed.

## CP-02 findings from the next fresh reconciliation

The next fresh reviewer returned `OPEN` on three coverage gaps. I reopened the current requirement R-08/R-09, design §8.2–§8.3 and §11a V-09/V-11, CP-02 plan step 5, and the owning actor, State, Render, and integration-assembly sources before deciding disposition.

### CP02-UI-DISMISS-1 · MAIN/BRANCH dismissal lacked a close-and-preserve proof

Classification: `CONFIRMED`.

Before this repair, `memberDesk.test.tsx` verified the notice button dispatch and the MAIN/BRANCH keyed mapping, while `renderSurface.test.tsx` verified that backdrop and Android back invoked a dismissal callback that deliberately rejected. Neither proved that the member-desk owner closed its actual layer or left pending/member data intact. This was a real gap against design §8.2 and plan CP-02 step 5, not just a missing test name.

Minimum repair: extend the existing owner test in `apps/terminal/ui/feature/sample-member-desk/test/memberDesk.test.tsx:1630-1696` for both MAIN and BRANCH runtime modes. It opens the corresponding owner part, dispatches the existing owner dismissal command, then asserts the layer is gone and the registry slice reference is unchanged. The existing button dispatch test and keyed MAIN/BRANCH mapping test remain. Add a direct Render-layer path test in `apps/terminal/ui/base/render/test/layerStack.test.tsx:159-221` for backdrop and Android back; the owner test covers the actual command effect, so no new dismissal abstraction was added.

Focused proof: member-desk file `3 passed, 35 skipped`; render LayerStack file `2 passed, 6 skipped`; both package typechecks passed.

### CP02-SYNC-REGISTRATION-1 · V-11 qualification coverage was incomplete

Classification: `CONFIRMED`.

The reviewer’s missing-file observation was not sufficient by itself. I verified the semantics: the existing `persistence.test.ts` covered one registered `master-to-slave` slice and skipped unknown/isolated payload creation, but did not prove both directions, qualification derived only from the registrations in the current State runtime, or unknown/isolated authoritative-apply skips. There was no `syncRegistration.test.ts` at the planned path.

Minimum repair: added `apps/terminal/kernel/base/state/test/syncRegistration.test.ts:31-82`, using the real State runtime and registrations. It verifies both sync directions appear from registered slices, isolated is excluded, unknown/isolated full-payload and apply paths skip with their typed reasons, and an omitted registration in a separate runtime does not remain eligible. `testSupport.ts` now lets the same existing fixture choose its declared direction; it adds no production API or whitelist.

Focused proof: State registration plus descriptor tests `12 passed`; State package typecheck passed.

### CP02-MODULE-BUNDLE-1 · No complete package add/remove bundle proof

Classification: `CONFIRMED`.

The existing `runtimeOwner.test.ts` changed the part key across a failed-runtime retry, and `moduleContributions.test.ts` rejected duplicate parts/dismissal keys. Neither proved that an explicitly loaded package contributes its Runtime command/actor/selector/state and UI part/variable/dismissal as one bundle, nor that omitting the package from replacement removes all of those contributions.

Minimum repair: extended `apps/terminal/ui/base/integration-assembly/test/moduleContributions.test.ts:207-282` with one concrete optional module. The load case checks its Runtime descriptor, state, selector, command execution and UI contributions. The failed-install replacement case omits the package and verifies the new Runtime has no state/actor/selector/command registration and the new UI bundle has no part/variable/dismissal. Existing duplicate-key tests remain unchanged; no registry or package-discovery layer was added.

Focused proof: integration-assembly file `4 passed`; package typecheck passed.

## CP-01 delta discovered by an overly broad focused invocation

The first State command also ran all of `persistence.test.ts` and exposed its existing P-3d identity assertion: `expect(runtime.dispose()).toBe(disposal)` failed. The test and design §5/CP-01 require idempotent State disposal. The owning scheduler already returned one shared cached `disposePromise`, but `createStateRuntime.ts` wrapped it in a new `async` Promise on every call, breaking that existing contract.

Classification: `CONFIRMED`.

Minimum repair: `apps/terminal/kernel/base/state/src/application/createStateRuntime.ts:130-133` now clears the short-lived sync cache and returns `flushScheduler.dispose()` directly. This restores the scheduler’s existing same-Promise idempotency without a new state or wrapper. The unrelated disposal check now passes; CP-01’s prior `MATCHED` remains a historical result, and a fresh CP-01 delta review is required for this one affected lifecycle path.

Focused proof after repair: State focused set `4 passed, 58 skipped`; State package typecheck passed. The initial failure was preserved and traced to the async wrapper; it was not silently dropped.

## Current byte evidence and remaining gates

- CP-02 focused tests after the State disposal correction: State `4 passed, 58 skipped`; member desk `3 passed, 35 skipped`; Render `2 passed, 6 skipped`; integration assembly `4 passed`. Typechecks for all four packages passed.
- The first newly authored LayerStack attempt failed because it called `setStatus` on a fixture whose status is already `started`; corrected the test to match the existing fixture. The first module-bundle attempt omitted a public command request ID and over-specified the wrapped error text; corrected the proof to supply the required ID and assert registration absence plus rejection. All final focused results above are from the corrected current bytes.
- No Expo Web, Android, DEV, backend acceptance, reset/seed, L2, UAT, or dynamic run was performed.
- `CP-01` needs fresh delta reconciliation for the State disposal behavior. `CP-02` needs fresh complete-stage three-dimensional reconciliation. Do not enter CP-03 until both applicable results are `MATCHED`.

## Fresh reconciliation follow-up: CP-01 delta and CP-02 orphan dismissal

### CP-01 State disposal delta

Classification: `CONFIRMED`, repaired; fresh delta reconciliation returned `MATCHED`.

The independent reviewer verified `createStateRuntime.ts:129-133` returns the scheduler's cached `disposePromise` directly after clearing the in-memory sync-payload cache. `createPersistenceFlushScheduler.ts:107-113` owns idempotent timer cancellation, listener unsubscribe and pending-flush wait; Runtime registers this asynchronous cleanup through its existing resource registry. The exact-identity assertion remains in `persistence.test.ts:277-300`. This closes only the touched State disposal path; the previously matched, unaffected CP-01 scope is reused.

### CP02-UI-ORPHAN-DISMISSAL-1 · Dismissal key was not owned by the declaring module

Classification: `CONFIRMED`, repaired; fresh complete CP-02 reconciliation is in progress.

The fresh full-stage reviewer found `createUiRuntimeModule` froze `layerDismissals` without checking that each key named a part declared by that same module. Integration collection rejected duplicate keys but could admit an orphan key. Current production owners happened to use matching keys, so this was a mechanism/acceptance gap rather than an observed production screen failure. This is confirmed against R-08 and design §8.2/V-09's package self-ownership and no-orphan requirements.

Minimum repair: `apps/terminal/ui/base/feature-assembly/src/foundations/createUiRuntimeModule.ts:4-15` now checks dismissal keys against the module's own `presentationContributions.parts[].catalogEntry.partKey` and fails at the owning factory. `apps/terminal/ui/base/feature-assembly/test/featureAssembly.test.ts:46-67` proves a matching package-owned dismissal remains accepted and an orphan is rejected. `apps/terminal/ui/base/integration-assembly/test/moduleContributions.test.ts:71-120,221-228` gives the duplicate collector test valid owning parts on disjoint surfaces, retaining the duplicate-key assertion instead of relying on an invalid orphan fixture.

Focused proof on current bytes: feature-assembly package test `3 passed`; integration-assembly package test `24 passed`; both package typechecks passed. The four earlier CP-02 focused package proofs remain current because these additional edits only touch feature-assembly and integration-assembly. No dynamic execution was performed.

## Current reconciliation gate

- CP-01 State dispose delta: fresh independent `MATCHED` (exact scope above).
- CP-02 complete stage after the orphan-dismissal repair: fresh independent `MATCHED`. The reviewer rechecked the new local key-to-owned-part validation, valid duplicate-dismissal collector fixture, complete add/remove bundle proof, prior UI/sync/activation/config ownership and old-factory retirement; no CP-02 `OPEN` remains. Tests and typechecks are execution evidence from the main agent, not from this static reviewer.
- CP-03 may proceed. This `MATCHED` is stage reconciliation only and does not stand in for CP-03, batch 6b, dynamic validation or delivery-time reconciliation.
