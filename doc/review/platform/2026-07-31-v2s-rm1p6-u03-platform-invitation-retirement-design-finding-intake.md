---
reviewCycleId: RM1P6-U03-PLATFORM-RETIREMENT-DESIGN
reviewRound: 1
reviewRoundLimit: 2
authorMaterialReadAfterIndependentVerdict: true
---

# Round-1 finding intake

This is an author disposition, not an independent verdict. Each finding was reopened against the owning source and counterexamples before the corrected material below was written.

| Finding | Disposition | Root-cause / counterexample check | Corrective material |
| --- | --- | --- | --- |
| M1 package-exit denominator absent | CONFIRMED | The shared U03 manifest was modified by later packages and cannot honestly provide a new U03 receipt chain. Reclassifying those receipts would be false; a new package baseline is the smaller truthful alternative. | Added `rm1p6-u07-platform-invitation-retirement-manifest.json`, exact surfaces, six source denominators, execution binding, amendment and successor admission. U07 starts from a new baseline and does not repair or hide U03 history. |
| M2 L2 bootstrap non-executable | CONFIRMED | `r5-remote-testcontainers.mjs` is an isolated Gradle/Testcontainers runner; `r5-platform-admin-l2.mjs` is local DEV/browser. They do not share database or token lifecycle. A guessed `WebApplicationType.NONE` main/stdout bridge would therefore be a false design. | Split the static retirement from a future remote managed-L2 package. The current design names the exact owner API and rejects platform HTTP/SQL, but declares no launcher, runtime proof or L2 result. |
| S1 invented generator inputs | CONFIRMED | The actual catalog has `scenarioIds` per operation, three real `operationErrorAugmentations`, and no `scenarioCrosswalk`; `edge-codegen.mjs` additionally reads placement, error catalog, admin catalog, carry-over manifest and face OpenAPI. | Replaced the false input claim with the exact five operation and three augmentation closure plus all real generator inputs; output remains controlled-receipt-derived. |
| S2 IA03 refreeze incomplete | CONFIRMED | IA03 alone is not the only binding: physical contract, final roster and U02 baseline also bind the account consumer. | U07 exact surface denominator includes IA03, physical contract, final roster, U02 baseline and U09 design link; baseline declares retained AccountsPage and retired consumer paths. |
| S3 audit retained boundary unproved | CONFIRMED | `PlatformAuditHistoryController` carries account/role and invitation paths together; operations audit is a different retained face. | U07 declares platform controller as an update (not delete), retains platform account/role and operations/public counterexamples, and requires focused proof before exit. |
| N1 R5 standards phase | CONFIRMED | U03 binding explicitly selects `R5`; `RM1P6-U03` is not a standards matrix phase. | U07 execution binding uses `standardsPhase: R5`; fresh coverage is required before implementation admission. |

## Scope decision

The corrected object is static platform invitation face retirement only. This is not a reduction of the user-facing journey: it removes a duplicate, unapproved platform path while retaining the approved operations/public path. It is a serial boundary because the existing two remote/local runners prove that an L2 bootstrap cannot truthfully be implemented as a convenience adaptation. No dynamic test, business PASS or cleanup PASS is claimed here.

## Inputs for round two

- Corrected design: `doc/plans/platform/2026-07-31-v2s-rm1-p6-3-platform-invitation-retirement-and-managed-l2-bootstrap-design.md`
- New package manifest: `doc/evidence/platform/rm1/p6/rm1p6-u07-platform-invitation-retirement-manifest.json`
- Execution binding/amendment/problem family: same directory, prefix `rm1p6-u07-platform-invitation-retirement-`
- Round-one blind verdict: `doc/review/platform/2026-07-31-v2s-rm1p6-u03-platform-invitation-retirement-design-review-round1.md`

The round-two reviewer must independently reopen IA01/IA03, physical/roster/baseline, actual platform/operations/public consumers, generator inputs, active U03/U07 admission mechanics and remote runner facts; it must test whether this serial split hides an unresolved static dependency or incorrectly claims an L2 solution.
