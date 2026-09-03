# Render DESIGN round-2 S-1 repair note

REVIEW_CYCLE_ID=2026-09-03-TER-UI-BASE-RENDER-DESIGN-01  
REVIEW_TARGET=DESIGN  
FORMAL_REVIEW_ROUND=2/2  
AUTHOR_ACTION=POST_ROUND2_S1_REPAIR  
FORMAL_REVIEW_STATUS=UNREVIEWED_AFTER_ROUND2  
IMPLEMENTATION_AUTHORITY=false

## Scope

The round-2 independent review confirmed one S finding: the design stated that an own
`layerTier: undefined` input is invalid while omission defaults to `standard`, but the
T/R matrix did not bind that distinction to an independent oracle and production red vector.
This note records the post-verdict repair. It does not rewrite the historical independent
review and does not claim that the round-2 reviewer saw the revised bytes.

## Repair

The detailed design now requires a paired focused proof:

1. An omitted `layerTier` control input produces a binding whose materialized tier is
   `standard`.
2. A runtime fixture with an observable own `layerTier` key whose value is `undefined`
   synchronously throws an error that identifies `layerTier`; it must not produce a binding.

The test must preserve the own key, for example with `Object.defineProperty`. The production
red vector changes the `definePart` input-shape branch so that explicit `undefined` is coalesced
to `standard` or its rejection branch is removed. The negative case must then fail while the
omission control remains green.

The T-9b row, R-11 row, CP1 gate, CP1 implementation step, CP4 mutation list, and full-batch
reconciliation checklist now carry the same requirement.

## Current artifacts

- `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md`
  sha256=`23a3b7826ccfbbf786ca01911ce169fed6a68833ef444e705208cfd4538e7fb2`
- `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-plan-codex.md`
  sha256=`f929c585fa3a8e10323e013775b7e11b9c80e12a9a91c00360d64ccb736d981c`

文档格式检查无新增空白错误。No render source, test, dependency, runtime, S-6, DEV, seed,
L2, UAT, or deployment change was made by this repair.

## Next review boundary

This is not a third formal adversarial round. A future authorized review must use a new/current
input checklist and independently verify the two cases, the field-level error oracle, and the
production mutation. Render implementation remains unauthorized until the repair is reviewed.
