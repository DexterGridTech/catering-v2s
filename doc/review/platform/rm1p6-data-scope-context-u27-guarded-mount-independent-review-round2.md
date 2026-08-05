# RM1P6 U27 guarded-mount independent implementation review — round 2

`REVIEW_CYCLE_ID=RM1P6-DATA-SCOPE-CONTEXT-U27-IMPLEMENTATION`  
`REVIEW_TARGET=IMPLEMENTATION`  
`REVIEW_ROUND=2`  
`REVIEW_ROUND_LIMIT=2`  
`ROUND_FINAL_DECISION=SELF_DECIDED`  
`reviewerKind=INDEPENDENT_SUBAGENT`

## Scope and independent-review declaration

This is the final permitted round for the current implementation review cycle.
It reopens the active U27 authority, current production source, current focused
and L2 source, catalog denominator, and package evidence. It reviews the
repaired guarded-mount lifecycle only; it does not authorize a product change,
runtime operation, seed, reset, UAT, or code change.

Blind declaration: before assessing dispositions, the reviewer formed the
challenge model from the authoritative inputs and current source: (1) a scoped
page must not mount any child before its exact required scope is complete, (2)
the guard must be tied to the same session entry that provides query arguments,
and (3) a catalog-wide static proof cannot substitute for a fresh browser and
cleanup receipt. The coordinator's statement that the bounded source update was
ready was treated as task routing only. No author disposition or prior review
artifact was used as evidence for this verdict.

## Reviewer input checklist

The following is the immutable round input list. SHA-256 values were reread
immediately before this review was written.

| Input | SHA-256 |
|---|---|
| `AGENTS.md` | `4d64bfb2bb435326a13c2ccb7955dbbbef621259030693e64db3cbf6a0bd9fda` |
| `PLATFORM-BLUEPRINT.md` | `3b90bd602eb682c4718d6c51f399501c34f804cddd96da82d59495e60b115a8d` |
| `CLAUDE.md` | `8b12b36e0c852f3a55f40f29d3d21101b9acb113b969ff5f8a9c2152c2aec50f` |
| `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `d2490f5038f02ad40b19150a377a2188f313350d965460c3a07ab4c1c3f4eb73` |
| `doc/evidence/platform/rm1/p6/rm1p6-data-scope-context-u27-package-input.json` | `a8a6fac36b3f6b7fa0d04365088a47dfb7d88ec01a1e1d275572533b2e629c0b` |
| `doc/evidence/platform/rm1/p6/rm1p6-data-scope-context-u27-implementation-amendment.md` | `e9371778028886f502223c8b3f94dae08ba8a3e9413482f7f602854fb098ee09` |
| `doc/evidence/platform/rm1/p6/rm1p6-data-scope-context-u27-problem-family.json` | `303a3498f111c851a9f886fe288490964f09115df1582e855cf71dfd1539bcbc` |
| `doc/evidence/platform/rm1/p6/rm1p6-data-scope-context-u27-package-exit.json` | `4203797c9c6b00e005b587a66fe3009c85fdbd40e08270cce07cddf5c1b65e70` |
| `doc/review/platform/rm1p6-data-scope-context-u27-delivery-manifest.json` | `3567611a8e932b6757632aefeec342c0d8314cf2cb2312605ed21d64a1a187bb` |
| `contracts/catalog/admin-catalog.json` | `36978594129bf1d08772050d8443e56c45269c1fbf6f1f34636f3417c6a44ff1` |
| `apps/frontend/operations-admin/src/app/OperationsApp.tsx` | `9219c31a083322fa227fb4b23e4e68af10bea20180768e8d0e3f1f092320201e` |
| `apps/frontend/operations-admin/src/app/components/OperationsRequiredScopeSurface.tsx` | `0916546af91364968ab1c32e4e85db8644923bba712d0cb1e20cab63b4a58394` |
| `apps/frontend/operations-admin/src/app/components/OperationsDataScopeContextBar.tsx` | `613eda9dc9ad7aae0ffa7774d2adab7adcd353cef10dea0874a414ce04e715c0` |
| `apps/frontend/operations-admin/src/app/components/OperationsRequiredScopeSurface.test.tsx` | `a3e5250d3978220fd6524d6a977747bf4b1225349f7e61f57b9550b133199a0d` |
| `apps/frontend/operations-admin/src/tests/l2/store-management.spec.ts` | `3d4db26ae23f621d6112d08f9c8677eb4602011d2709229f1c99386c91e00d15` |
| `apps/frontend/operations-admin/src/tests/l2/contract-management.spec.ts` | `170f685631df425c9b6dc1885691a9f84506f01ed472d2f7e35aaba0bfa5d818` |
| `apps/frontend/operations-admin/src/tests/l2/store-profile.spec.ts` | `c6e97441fbd2798653c07ce208589d0d7d9fcf68bf5e245ac9c0a14873c88994` |
| `apps/frontend/operations-admin/src/tests/l2/user-management.spec.ts` | `dbb8aa0958bcf5322e572ecfe1d97617bae982908ee288b7093122a8df2b7d0a` |
| `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` | `108ba9050ed256c6e41a3e53e3af4c761706c4dc8fe697de9540fc649f5af6d3` |
| `doc/review/platform/independent-subagent-adversarial-review-input-checklist-template.md` | `0ef12f041bae6b4411bb4b4b3f15f2860796b31f3dab5894738fdd17441b63fe` |
| `project-memory/decisions/deterministic-context-only.md` | `4c98ed79b0c8e4694893a29ed977fd2eccea6c1562f2d62f32c06dcbb5ac7e20` |
| `project-memory/decisions/independent-subagent-adversarial-review.md` | `891fc8de061560796dc682c5749d73a5d47029592fca197f09f032e3018b4daf` |
| `project-memory/operations/verification-governance.md` | `e424bf923f1368381b26ef0e22a379a5cdd7bc8b7de887cc2c4e78250f2e0f18` |
| `project-memory/operations/implementation-source-reread-discipline.md` | `6944ae47f0e059a52e75096b17620a3c43852e52a9b44e69737554ac646293ce` |
| `project-memory/decisions/incremental-compliance-hook.md` | `a75469c7eb945b35f06d95cead2e11c368cc4a47dca851f32652556546985f81` |

`reviewerInputChecklist=INLINE:doc/review/platform/rm1p6-data-scope-context-u27-guarded-mount-independent-review-round2.md#reviewer-input-checklist`.

## Recheck results

### Prior M1 — incomplete scope could expose child content

**Disposition: CONFIRMED_FIXED_SOURCE_ONLY.** `OperationsApp` now passes the
current `entry.scopeContext` directly to `OperationsRequiredScopeSurface`.
The surface renders the common prompt plus one non-interactive placeholder and
does not mount `children` unless `isOperationsScopeComplete` is true. Its
focused rendered test proves missing PROJECT content has no child and complete
content does. The L2 sources for store and contract management now assert the
missing prompt and gated placeholder and assert their business page has count
zero before selection.

### Prior M2 — guard could read a stale Redux mirror during entry change

**Disposition: CONFIRMED_FIXED_SOURCE.** The relevant guard and first-row
context now consume the prop from the same `WorkspaceSessionEntry` used for the
active role, `contextVersion`, and query arguments. The Redux mirror remains
for selection continuity but is no longer a readiness input; its later effect
cannot cause a newly selected entry to mount a prior entry's child page.

### Prior M3 — required independent implementation review evidence absent

**Disposition: CONFIRMED_FIXED.** This artifact supplies the required second
and final independent-subagent verdict with an input checklist and explicit
round limit. It is not itself proof that the changed L2 has run.

### Catalog denominator and preselection coverage

**Disposition: CONFIRMED.** The focused rendered test enumerates the current
seven non-NONE catalog entries exactly: two PROJECT pages, one REGION page, one
additional PROJECT user page, one HEAD_COMPANY page, and two STORE pages. It
also proves a NONE page mounts without scope. The two dynamically exercised
PROJECT pages now contain preselection prompt, gated-placeholder, and absent
child assertions before selection.

## Findings (M/S/N)

### M

- **M-01 — current L2 business and cleanup evidence is absent for the repaired assertions.** The package exit only cites the earlier named `17/17` run while the current store/contract L2 files now contain new preselection assertions. It provides neither a run-scoped manifest/log nor a source-hash-bound result showing those updated assertions executed, and therefore cannot prove the new behavior or current cleanup. This violates the delivery manifest's completion requirement for separate L2 business and cleanup evidence. Re-run the authorized affected local L2 through its managed entrypoint and record the current source/run relationship, business result, and cleanup result before closure.

### S

- **S-01 — dynamic negative coverage is narrow relative to the catalog denominator.** The catalog-wide rendered component test is strong and covers all seven scoped keys, but browser preselection assertions currently exercise only the two PROJECT routes. REGION, HEAD_COMPANY, and STORE have no corresponding preselection/child-absence browser assertion; `store-profile.spec.ts` also retains stale wording that says an unscoped read is rejected, whereas the repaired lifecycle intentionally prevents the child and its read from mounting. Add at least one representative L2 negative assertion for each remaining required type and correct that comment when the M-01 run is prepared.

### N

- **N-01 — no authorization regression found.** The guard remains a
  lifecycle/UX decision only. The amendment and source keep candidate and
  protected-operation authorization with their owners; this review found no
  client-side authorization substitution.

## Final verdict

**NO-GO.** The two source defects under review are repaired, but M-01 leaves
the current modified L2 assertions without fresh business and cleanup evidence.
After that managed run and the bounded S-01 coverage correction, the next
decision is Dexter's package-evidence acceptance; this review cycle is closed
and must not be reopened for a third review round.
