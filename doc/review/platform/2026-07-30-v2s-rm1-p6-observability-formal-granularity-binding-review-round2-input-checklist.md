# RM1 P6-1 formal granularity-gate binding — independent design review input checklist (round 2)

## Final-round identity and authorization boundary

- `REVIEW_TARGET=DESIGN`
- `REVIEW_CYCLE_ID=RM1-P6-U01-FORMAL-GRANULARITY-BINDING-DESIGN-20260730`
- `REVIEW_ROUND=2`; `REVIEW_ROUND_LIMIT=2`; this is the hard final Codex independent-review round.
- reviewer kind: `INDEPENDENT_SUBAGENT`; form findings before reading the author intake. After the independent verdict, use the intake only to test whether its claims are supported.
- This reviews the amended **design**. It does not authorize or require implementation during review. Current checker source has not yet been changed: the admissible question is whether the detailed design now makes that required future production-gate change exact, bounded and testable, without misrepresenting current checker coverage.

## Hash-bound input

| Input | SHA-256 | Required purpose |
| --- | --- | --- |
| `doc/plans/platform/2026-07-30-v2s-rm1-p6-observability-formal-granularity-binding-design.md` | `5bbcc6864e8d25f8fef66f048546ec8fa015d28942cb08821c66bc0ff1f45735` | amended technical design and finite selector grammar |
| `doc/review/platform/2026-07-30-v2s-rm1-p6-observability-formal-granularity-binding-manifest.json` | `7e45b05f15003f5e019ec9a6886e15078428472cb776d8e8492db863647ea15b` | amended formal manifest |
| `doc/review/platform/2026-07-30-v2s-rm1-p6-observability-formal-granularity-binding-review-round1.json` | `bc6b87e8665dfbca96512d26347146f661571a5b73d9af35b72a665d04ce3026` | prior independent verdict; do not copy its conclusion |
| `doc/review/platform/2026-07-30-v2s-rm1-p6-observability-formal-granularity-binding-author-intake.md` | `57938548d1e3c4329bde3eb5aa883523887d9f0b485ad7885b430e8d22befa14` | read only after blind verdict, to challenge disposition claims |
| `tools/implementation-design-granularity/cli.mjs` | `b58042387875e9b0cc7691104943317157e912bfa20d54491a2257890b772e3e` | reopen present checker and distinguish present behavior from specified future change |
| `scripts/check/implementation-design-granularity` | `e99619ee45d81a3faa2be229699c8619f7394d5d9a019c749e363ff112a8ca43` | execute production checker and self-test |
| `project-memory/index.json` plus manifest memory route | current bytes | recompute D1 exact set |
| `contracts/policy/frontend-asset-carryover-manifest.json` | `6b531d3bba676f5cc24e3121f482f7920abfe0b4c476081c1ce0478a17ee3974` | verify `json:/surfaces,json:/pageDesignKeySurfaceCrosswalk` resolves |
| `contracts/policy/standards-coverage-matrix.json` | `7d390eb692b627d876cdbfe34d03c140ce4f8450333c2d7618c849ced2fb55b3` | verify `json:/rules` resolves and R5 standard denominator remains current |

## Targeted falsification

1. Verify all three Round 1 M repairs from raw source, including uniqueness of the newly chosen approved-source sentence and existence/non-emptiness of both no-UI JSON pointers.
2. Try counterexamples against the specified finite selector grammar: comma split/order, invalid RFC 6901 pointer, duplicate/missing Markdown literal, stale source hash, absent source and arbitrary owning-source entry. Determine whether the design directs the existing checker to reject each one through real red fixtures.
3. Distinguish honestly between current checker behavior and future implementation criteria. A design `GO` cannot claim D2--D6 are already enforced in current source; a `NO_GO` needs a design incompleteness, not merely that future approved implementation work is not yet performed.
4. Recompute D1 exact set. Confirm future change surfaces include only the existing checker plus runner/foundation/edge/tests/root OpenAPI/capability invariant, and no UI/database/generated hand edit/DEV/seed/reset/Roadmap scope.
5. Run the existing production checker against the amended manifest and this Round 2 review JSON, and run its self-test. Report the exact result. The ordinary gate result proves only present schema admission; it does not replace future red fixtures specified by the design.

## Required output

Write only `doc/review/platform/2026-07-30-v2s-rm1-p6-observability-formal-granularity-binding-review-round2.json` in the complete production `implementation-design-adversarial-review` JSON schema. It must be `reviewRound=2`, `reviewRoundLimit=2`, `roundFinalDecision=SELF_DECIDED`, `furtherCodexAdversarialRoundAllowed=false`, `reviewerKind=INDEPENDENT_SUBAGENT`, checklist path/current SHA, blind declaration, current manifest SHA, complete findings/unit verdict/solution reasonableness/conclusion and exact `M/S/N` count. Do not implement any source change.
