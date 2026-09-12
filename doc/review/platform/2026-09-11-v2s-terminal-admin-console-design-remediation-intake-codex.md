# TER terminal admin console design remediation intake

`REVIEW_TARGET=DESIGN_AND_IMPLEMENTATION_PLAN`
`REVIEW_CYCLE_ID=TERMINAL_ADMIN_CONSOLE_DESIGN_20260911`
`REVIEW_ROUND=REMEDIATION_INTAKE`
`REVIEW_ROUND_LIMIT=2`
`reviewerKind=AUTHOR_INTAKE`
`HISTORICAL_ROUND_2=NO-GO (6M/2S/2N after Dexter rulings)`
`REMEDIATION_STATUS=REVISED_WITH_OPEN_REQUIREMENTS_RECONCILIATION`
`IMPLEMENTATION_AUTHORITY=false`
`EVIDENCE_STATUS=STATIC_SOURCE_AND_DOCUMENT_REOPEN_ONLY`

## 1. Purpose and boundary

This file records the author's remediation intake after the independent Claude
review attached to the current task. It is not a new independent verdict and
does not convert the historical round-2 `NO-GO` into `GO`. The five design
artifacts were reopened against current repository bytes and the owning source;
the attached review was treated as a list of claims to falsify, not as proof.

The work covered only the Journey proposal, IA, UI interaction design, detailed
design, and implementation plan. No source, test, dependency, runtime, Web,
Android, DEV, seed, UAT, or deployment action was authorized or performed.

The two post-review Dexter rulings are treated as resolved product inputs:

1. A dynamic surface replacement retains all business content and business
   layers. It closes only the targeted transient `admin.console` layer; the
   kernel state remains the recovery source. The admin layer is the sole
   targeted exception because authentication is transient under AC-4.
2. Section order is the order of the filtered entries in the single catalog
   list. There is no separate order key. The design does not introduce a
   second registry or a duplicate owner/order metadata object.

## 2. Independent source checks completed

The following current owning symbols were reopened before editing:

- `apps/terminal/kernel/base/ui-state/src/types/catalog.ts#UiCatalogEntry`
  currently has eight explicit fields and no `surfaceForm` or admin metadata.
- `apps/terminal/kernel/base/ui-state/src/foundations/catalog.ts#assertEntryKeys`
  requires the exact eight-key shape, `canonicalEntry` reconstructs those same
  eight fields, and `createUiCatalog` preserves input array order.
- `apps/terminal/ui/base/render/src/foundations/definePart.ts#definePart`
  also constructs the eight-field catalog entry explicitly.
- `apps/terminal/kernel/base/ui-state/src/features/actors/contentActors.ts`
  derives workspace from state and currently has no catalog admission or
  surface-form input in the open-layer payload.
- `apps/terminal/kernel/base/ui-state/src/application/createUiStateModule.ts`
  owns the UI-state module and is the smallest existing owner for a
  non-persisted assembly surface-form fact.
- `apps/terminal/kernel/base/ui-state/src/types/content.ts#LayerEntry` and
  `features/commands/closeLayer.ts` keep `layerId` separate from `partKey`; a
  close operation can silently no-op when the layer ID is wrong or absent.
- `apps/terminal/ui/base/input/src/types/types.ts` and
  `hooks/useInputFocusController.ts` allow an optional native ref and currently
  silently skip native focus when it is null.
- `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx`
  currently derives `displayMode` from physical index but indexes host sources
  by display mode and registers only feature parts.
- `apps/terminal/ui/base/dev-host/src/components/testExpoApp.tsx` currently
  creates test surfaces by display mode.
- `apps/terminal/skeleton-graph.ts`, the relevant package manifests, and
  `tools/terminal-skeleton/check-static.mjs` compare graph edges with declared
  package dependencies; planned new edges must be recorded in all three places.

## 3. Finding-by-finding disposition

| Finding | Status after source reopen | Disposition in revised artifacts |
| --- | --- | --- |
| M-1 catalog `surfaceForm` / exact-key / canonical drop | `CONFIRMED` | Make `surfaceForm` required; update `UiCatalogEntry`, `DefinePartCatalogFields`, approved keys, exact-key assertion, canonical reconstruction, and every catalog fixture atomically. Remove optional admin metadata. |
| M-2 admission owner lacks `surfaceForm` | `CONFIRMED` | Use the existing `ui-state` module as the owner: initialize one non-persisted, isolated `surfaceForm` slice per assembly; expose a read selector; admission and render context read that selector. Do not add a parallel React-only source or open-layer payload field. |
| M-3 remount versus business-layer retention | `CONFIRMED` | Remove whole-`SurfaceRoot` key/remount language. Preserve React identity and use one lifecycle/effect keyed by the full surface identity. Retain business state and close only the targeted admin layer. |
| M-4 admin cleanup has no authoritative layer ID | `CONFIRMED` | Freeze and reuse `ADMIN_CONSOLE_PART_KEY`, `ADMIN_CONSOLE_LAYER_ID`, `ADMIN_CONSOLE_FOCUS_SCOPE_ID`, and `ADMIN_SECTION_CONTAINER_KEY`; close by the prior surface's display mode plus exact layer ID. Add an assertion that the admin layer count is zero after replacement. |
| M-5 business-layer retention | `DEXTER_DECISION` | Resolved by Dexter's ruling; all five artifacts now state the retention rule and its admin-only exception. |
| M-6 native-less input shape and null-ref behavior | `CONFIRMED` | Freeze field options/registration/result and `activateFocusScope(scopeId)` behavior. A null native ref is not a failed virtual focus; optional native focus is attempted only when a ref exists. Pre-probe and A-15 use the same controller API. |
| M-7 built-in sections have no production part/renderer owner | `CONFIRMED` | Require `admin-shell` to export one assembly containing the console layer and three built-in section entries/renderers. `sample-console` merges it, then its title-only production section, through the same catalog. |
| S-1 password vectors omit date | `CONFIRMED` | Add `localDate=2026-09-10` and local-time construction to the vectors; the external POC is a human traceback only because the formula is fully inlined. |
| S-2 graph/package edges absent | `CONFIRMED` | Add exact `render → primitives`, `admin-shell → display-context`, `admin-shell → input`, and `sample-console → admin-shell` edges to the graph, manifests, and static comparison inventory. |
| N-1 order-key tie-break | `SUPERSEDED_BY_DEXTER_DECISION` | No order key remains; filtered catalog list order is the sole ordering rule. |
| N-2 `maxMounted=24` headroom | `UNVERIFIED_REQUIRES_EVIDENCE` | Keep 24 as the hard ceiling for this batch. Require a focused 100-row scroll-transition fixture to prove completeness and the bound; do not change the number without failing evidence. |
| N-3 absolute external POC path | `CONFIRMED` | Remove the absolute path from implementation instructions. Keep only a repo-relative discussion reference and the complete inline formula/vectors. |

## 4. Remaining OPEN items

1. The current requirements text at
   `doc/plans/platform/2026-09-11-v2s-terminal-admin-console-and-primitives-requirements-claude.md:523`
   still names `owner` and an order key in A-19. The design follows Dexter's
   later ruling and removes the order key, but this intake does not silently
   rewrite the Claude-authored requirements. The requirements owner must
   reconcile that literal before design acceptance; otherwise this remains a
   requirements/design contradiction, not an implementation detail.
2. The historical round-2 reviewer did not review the revised bytes. This
   remediation intake is not a third review round. A new design review cycle or
   Dexter's explicit review disposition is required before any `GO` claim.
3. All focused, Web, Android, native, release, and visual evidence remains
   unrun. `N-2` is intentionally still evidence-open, and no static or focused
   plan row is evidence of runtime behavior.
4. Implementation authority remains false. This file authorizes neither
   source changes nor execution.

## 5. Smallest-change rationale

The repairs stay at existing owners: catalog shape at catalog/`definePart`, the
single assembly fact at `ui-state`, lifecycle at `SurfaceRoot` plus existing
`LayerStack`/`InputController`, built-in registration at `admin-shell`, and
dependency truth at the skeleton graph/manifests. A second registry, remounting
root, admin-specific layer stack, new input pipeline, or new owner would make
the review findings harder to falsify and would exceed the current stage.

The one intentional cost is that all required primitives remain in scope even
when a given primitive has no first business consumer. That is the recorded
Dexter trade-off; A-36 behavior/accessibility checks and the focused consumer
proof are the safety net, not a claim that every primitive contract is already
validated by a real product use.
