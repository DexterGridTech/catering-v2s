# CP3/CP4 focused repair evidence (current source)

## First failures retained

The first fresh D-12 typecheck failed in the newly added table test because Vitest's
`it.each` overload inferred each readonly tuple as a string argument. The production
classifier was not changed. The test was rewritten as explicitly typed cases with one
focused test per tuple; the same test then passed.

The first fresh run of the shared render behavior runner also failed at a stale mutation
anchor in `tools/terminal-ui-render/check-behavior.mjs`. `resolvePartWithStatus` now returns
a `PartResolution` object, so the old mutation searched for a direct `RenderFallback` return
that no longer exists. The runner was repaired to mutate the current `node` fields for the
missing-renderer and invalid-props branches. No production source was changed for this
tooling failure.

## Current focused controls

Commands run against the current source:

```sh
yarn workspace @catering-v2s/ui-base-render typecheck
yarn workspace @catering-v2s/ui-base-render test --run
node tools/terminal-ui-render/check-behavior.mjs
node tools/terminal-sample2/check-behavior.mjs
```

Observed results:

- render typecheck: exit 0;
- render package tests: 11 files / 64 tests, `TERMINAL_PACKAGE_TEST=PASS`;
- render behavior: baseline 64 tests, 26 red mutation vectors, and cleanup all PASS;
- sample2 behavior: kernel/picker/integration/primitives baselines, all current red/admission
  mutations, restored baselines, and cleanup all PASS;
- D-12 now has an exact current-table focused test at
  `apps/terminal/ui/base/render/test/requestOutcome.test.ts`, covering completed/running,
  all nine kernel categories, empty errors, mixed business/system errors, unknown category,
  and null actor errors.

These results are focused/static/red evidence only. They do not claim U10/U13 full journey,
release, Web, visual, or implementation-review acceptance.

## Boundary

The independent CP3/CP4 review that preceded this repair reported: shared console assembly
source/package shape matched; D-12 exact-table proof was missing; U13 full PF-01--PF-10 was
not closed; and release bundle/device proof remained open. Those findings are retained as
inputs. A new fresh post-repair stage reconciliation is required before dynamic execution.

## D-14 repair

The fresh code/design review found that generic `LayerStack` backdrop and Android back
dispatched `kernel.base.ui-state.close-layer` directly, while each system notice button used
its feature command. The minimal repair keeps the physical affordance in base render and
passes a feature-owned `layerDismissals` map from each integration. The three feature maps
call the same helper used by their notice button, so the actor remains the single owner of
the close transition:

- `apps/terminal/ui/base/render/src/types/props.ts` — `RenderLayerDismissal` capability;
- `apps/terminal/ui/base/render/src/components/LayerStack.tsx` — mapped intent for backdrop/back,
  generic `closeLayerCommand` only when no feature mapping exists;
- `apps/terminal/ui/feature/sample-staff-auth/src/foundations/systemFailureDismissal.ts`;
- `apps/terminal/ui/feature/sample-member-desk/src/foundations/systemFailureDismissal.ts`;
- `apps/terminal/ui/feature/sample-wallpaper-picker/src/foundations/systemFailureDismissal.ts`;
- each feature `parts.ts`/`assembly.ts` — owner map;
- both integration assemblies — shared map passed into `createConsoleAssembly`.

Focused proof after the repair:

```text
yarn workspace @catering-v2s/ui-base-render test --run
  Test Files 11 passed; Tests 64 passed
yarn workspace @catering-v2s/ui-feature-sample-staff-auth test --run
  Test Files 1 passed; Tests 7 passed
yarn workspace @catering-v2s/ui-feature-sample-member-desk test --run
  Test Files 1 passed; Tests 24 passed
yarn workspace @catering-v2s/ui-feature-sample-wallpaper-picker test --run
  Test Files 3 passed; Tests 14 passed
yarn workspace @catering-v2s/ui-integration-sample-console test --run
  Test Files 7 passed; Tests 35 passed
yarn workspace @catering-v2s/ui-integration-sample-wallpaper-console test --run
  Test Files 4 passed; Tests 13 passed
```

The render test `lets dismissible guards close through backdrop and Android back` supplies a
feature-owned callback and observes `ui.feature.test.dismiss-layer` for both physical paths;
the decisive guard test still observes no dispatch. This is focused evidence, not U13
runtime/device acceptance.

## Static model replay

`node tools/terminal-skeleton/check-static.mjs` returned all seven rule gates plus
`SCAFFOLD_HYGIENE=PASS`. The separately replayed mutation model test returned exit 0 and
`TERMINAL_SKELETON_MODEL_TEST=PASS`, including root workspace enumeration, all D-1 import
forms, runtime subset/array drift, adapter direction, TR-01 and cleanup vectors. Its real
mutation output is retained in the command log; it is not evidence of native/release/runtime
acceptance.
