# RM1 P6-1 formal granularity-gate binding — independent design review input checklist (round 1)

## Review identity and blind-review instruction

- `REVIEW_TARGET=DESIGN`
- `REVIEW_CYCLE_ID=RM1-P6-U01-FORMAL-GRANULARITY-BINDING-DESIGN-20260730`
- `REVIEW_ROUND=1`; `REVIEW_ROUND_LIMIT=2`
- reviewer kind: `INDEPENDENT_SUBAGENT`
- First reopen the source/contract/checker evidence below and form falsification findings. Do not read author intake (none exists yet) or accept any earlier observability-extension verdict as evidence for this material new scope.
- This is design-only. No source implementation, dynamic run, DEV, seed/reset, generated output, UI behavior or Roadmap state is authorized.

## Required input, all paths repository-relative and hash-bound

| Input | SHA-256 | Why it is required |
| --- | --- | --- |
| `doc/plans/platform/2026-07-30-v2s-rm1-p6-observability-formal-granularity-binding-design.md` | `5e39c7e8c77693395b601edb5c369af7b51fd2ea767d48c4fe930b422f014a79` | business problem, rejected smaller alternative, binding intent and future proof |
| `doc/review/platform/2026-07-30-v2s-rm1-p6-observability-formal-granularity-binding-manifest.json` | `TO_BE_BOUND_BY_REVIEWER_FROM_CURRENT_BYTES` | formal artifact to falsify; record the current SHA in the review verdict |
| `doc/decisions/2026-07-28-v2s-rm1-implementation-facing-design-authorization.md` | `441a8855412d29b41dd2e3356fc43430686f3166b727b707aa340e288a033bd3` | confirms the only authorization is design-only |
| `tools/implementation-design-granularity/cli.mjs` | `b58042387875e9b0cc7691104943317157e912bfa20d54491a2257890b772e3e` | actual production manifest/review validator, including D1 dynamic exact-set logic |
| `scripts/check/implementation-design-granularity` | `e99619ee45d81a3faa2be229699c8619f7394d5d9a019c749e363ff112a8ca43` | production checker entrypoint |
| `project-memory/index.json` plus the six-dimensional route in the manifest | current bytes | independently recompute the D1 owning-source exact set; do not trust copied lists |
| `project-memory/decisions/deterministic-context-only.md` | `4c98ed79b0c8e4694893a29ed977fd2eccea6c1562f2d62f32c06dcbb5ac7e20` | deterministic source reopening requirement |
| `project-memory/decisions/incremental-compliance-hook.md` | `0e0179020433b8948287f02b061cb1a7c456048b3cfeac0b8fc68a60e83af94d` | pre/post receipt and set-equality boundary |
| `contracts/policy/frontend-asset-carryover-manifest.json` | `6b531d3bba676f5cc24e3121f482f7920abfe0b4c476081c1ce0478a17ee3974` | verifies the declared no-UI scope rather than silently omitting UI evidence |
| `contracts/policy/standards-coverage-matrix.json` | `7d390eb692b627d876cdbfe34d03c140ce4f8450333c2d7618c849ced2fb55b3` | R5 standards denominator |
| `doc/review/platform/2026-07-29-v2s-rm1-p6-observability-extension-independent-design-review-round1.json` and `...round2.json` | historical bytes | context only; they cannot be substituted for this new review cycle |

## Mandatory falsification checks

1. Run the actual production checker against the formal manifest and your review JSON. Verify its red fixtures separately; do not treat an author-provided PASS as proof.
2. Recompute `PROJECT_MEMORY_ASSERTION_OCCURRENCES` from `project-memory/index.json` and the six route dimensions. Require ordered path/hash/selector equality, not subset containment.
3. Verify all six source denominators have non-pending applicability, exact hash, existing unique anchor/selector and an owning-source set. Find counterexamples to the stated anchors.
4. Verify the unit is genuinely no-UI/no-data, while the future implementation surfaces are complete for managed runner, shared backend foundation, edge integration/tests, root OpenAPI projection and capability invariant. Reject missing or invented surfaces.
5. Compare the chosen production-schema solution with the smaller alternative (prose-only or relaxed checker), and test whether it changes product behavior or accidentally grants implementation authority.
6. Check the future proof statements are production-path controls: all 22 public security operations, secret-safe exactly-one terminal event, remote durable control record/heartbeat/log-read/PID reaping, and 35 root target references / 35 target paths / 40 operations. Reject source-string or scanner-only substitutes.

## Required review artifact shape

Write only `doc/review/platform/2026-07-30-v2s-rm1-p6-observability-formal-granularity-binding-review-round1.json`. It must conform to `implementation-design-adversarial-review`: `reviewTarget=DESIGN`, `reviewRound=1`, `reviewRoundLimit=2`, `reviewerKind=INDEPENDENT_SUBAGENT`, this checklist path+current hash, blind-review declaration, `authorMaterialReadAfterIndependentVerdict=true`, manifest SHA from current bytes, all unit verdicts, linked findings, solution reasonableness and exact `M/S/N` conclusion counts. A `GO` cannot have `M` or `S`.
