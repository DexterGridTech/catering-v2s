# TER screenPart 机型解析 · B batch whole reconciliation

```text
REVIEW_TARGET=WHOLE_BATCH_RECONCILIATION
REVIEWER_KIND=INDEPENDENT_SUBAGENT
READ_ONLY=true
VERDICT=MATCHED
```

## Scope

Fresh reviewer Jason independently re-read the current requirements, implementation-facing
design, IA/plan references, terminal standards/memory boundary, CP evidence, and current
production source/tests after CP-5a's AST and owner-boundary repairs. No source, test, or
documentation file was modified and no dynamic runner was executed by the reviewer.

## Three-dimensional reconciliation

### Requirements and design

- B-1 keeps the shared `AdminLayer` as the zero-argument authentication/close/focus owner;
  `AdminShell` remains the existing `onClose` compatibility wrapper. The hook keeps raw
  requested selection and does not read `surfaceForm`; form-specific shells own fallback.
- B-2 gives the shared root a fill layout, removes the old LayerStack centering/padding,
  makes laptop master-detail and mobile wrap/single-content layout explicit, and gives the
  seven remaining floating cards their own centered bounded frame. Four section roots keep
  bounded content ownership.
- B-3 keeps public/admin testID/focus owners, exposes real host roles/labels/selected state,
  uses the shared primitive heading's polite live announcement, and keeps form-specific
  renderers private. The plan's B whole reconciliation is before any dynamic run.

### Current source and focused evidence

- `apps/terminal/ui/base/admin-shell/src/hooks/useAdminSections.ts` and
  `test/adminSectionsStructure.test.ts` implement and red-test the no-`surfaceForm` hook
  boundary across the local relative import closure.
- `apps/terminal/ui/base/admin-shell/src/parts/parts.ts` and `test/parts.test.ts` have four
  laptop/mobile sibling pairs with disjoint forms, unique renderer keys, and normalized
  field/binding equality including `layerTier` and `layerGuard`.
- `apps/terminal/ui/base/render/src/components/LayerStack.tsx` and
  `test/renderSurface.test.tsx` keep absolute full-bleed stack/layer wrappers and reject
  restoration of `alignItems`, `justifyContent`, or `padding` on either wrapper.
- `apps/terminal/ui/base/admin-shell/src/components/AdminShellLaptop.tsx` and
  `AdminShellMobile.tsx` contain the row master-detail and wrap/single-content paths.
- `apps/terminal/ui/base/primitives/src/components/PrimitiveHeading.tsx`, the real
  `Pressable` host assertions in `sampleAssembly.test.tsx`, and the CP-5c evidence cover
  header/live-region, button/tablist/tab, label, selected state, and existing focus/back
  ownership.
- `apps/terminal/ui/base/admin-shell/src/index.ts` and its invariant/public-surface test
  keep private renderer/frame orchestration out of the public surface.

## Findings

```text
M=0
S=0
N=0
```

No current-source M/S/N blocker was found for the B batch. The earlier Bohr OPEN finding
about U-12 being only defined is closed by the current AST test and its real production
mutation evidence in
`doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution-cp5a-execution-codex.md`.
The earlier Descartes report used an invalid prompt criterion (“AdminShell public zero-arg”);
the current source and requirements identify `AdminLayer` as that owner, and the current
Hooke CP-5a record confirms the boundary.

## Evidence boundary

This is a static/focused three-dimensional reconciliation only. It does not claim native,
Android, Web, visual, release, or cleanup PASS. The CP-5b/CP-5c evidence correctly keeps
those tiers OPEN, and the authorized dynamic runs must be collected after this record.
