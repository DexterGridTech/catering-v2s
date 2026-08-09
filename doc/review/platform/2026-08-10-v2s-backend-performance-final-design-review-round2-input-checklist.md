# Backend-performance final-closure design Round 2 input checklist

`REVIEW_TARGET=DESIGN`  
`REVIEW_CYCLE_ID=BACKEND_PERFORMANCE_FINAL_CLOSURE_DESIGN_20260810`  
`REVIEW_ROUND=2` / `REVIEW_ROUND_LIMIT=2`

## Required current bindings

1. Manifest `doc/review/platform/2026-08-10-v2s-backend-performance-final-design-granularity-manifest.json` — `852f441e02a44e30cacfa4456c71fa49592d10becc2ee533a218c0cddee42c6a`
2. Design plan `doc/plans/platform/2026-08-08-v2s-backend-performance-refactor-implementation-design-codex.md` — `e945d5ea2d6d46d76b68314d0d03cf97f4bf22f46a01dea619c99a758f9772d5`
3. Route map `doc/evidence/platform/2026-08-10-v2s-backend-performance-final-catalog-route-binding-map.json` — `fe14a4aa227078dd6aef16c52e327237a4cabc7e347410a5ecc37c02d771b5bb`
4. Round 1 verdict `doc/review/platform/2026-08-10-v2s-backend-performance-final-design-review-round1.md` — `1b3aa1422fe1c84a3a2e852ba271521775789e31f3c8fdc467b24f5fc4400381`
5. Author intake `doc/review/platform/2026-08-10-v2s-backend-performance-final-design-author-intake.md` — read after independent source falsification.

## Directed falsification

1. Prove the proposed audit-read dependency graph contains no `app` import; ensure only the controller
   creates the edge-private read fact and the reader receives `PlatformSessionReadback`.
2. Recompute the 42 route map against generated registry. Remove/duplicate one binding or change one token
   in scratch reasoning: the planned source gate must reject it before old sources are deleted.
3. Try final admission with a syntactically valid historic R5 snapshot: the frozen runner kind and two
   final-byte digests must make it ineligible.
4. Confirm manifest declares `implementationAuthority=false` and design package has no runtime authority.

## Required verdict

Fresh `INDEPENDENT_SUBAGENT`; blind falsification before author material; set
`ROUND_FINAL_DECISION=SELF_DECIDED` and `furtherCodexAdversarialRoundAllowed=false`. State GO/NO-GO with M/S/N.
