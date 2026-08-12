---
reviewTarget: DESIGN
reviewCycleId: BACKEND_PERFORMANCE_M1_COMMAND_TOPOLOGY_DESIGN
reviewBinding: POST_REMEDIATION_V3
status: AWAITING_CLAUDE
---

# Claude review request — M1 command topology and universal gate

## Background and goal

Dexter requires the planned command-side M1 optimization to be implemented before existing unit
tests, managed reset, r5-full seed and catalog L2.  The gate must run after every M1 source or
existing-test edit and must reject both present and future command topology drift.  No runtime,
DEV, reset, seed, L2, Testcontainers, deployment, manual SQL/SSH or numeric SQL-success claim is
authorized by this review.

## Immutable independent-review history

| Record | SHA-256 | Result |
| --- | --- | --- |
| `implementation-review-round1.md` | `268d1655a39ae48f99127dc920b42848f3d5d76be302bd10dafdf41a934b5a6e` | NO-GO, M=3/S=1/N=1 |
| `implementation-review-round2.md` | `f3278b742b99461da435ea8db1cf3722e63a79d0a91aa6593d05a852494d9dce` | NO-GO, M=1/S=1/N=1; independent-round limit reached |

The current author remediation was not reviewed by either independent reviewer:

| Current input | SHA-256 |
| --- | --- |
| `command-handler-gate-design-amendment.md` | `506d617af5c7ca7c313b959d3ddc975e7f1db198ff770128200b59b1fd262a70` |
| `implementation-author-intake.md` | `901cecce4c18740dba9d744ad45cea89d0fa55fdfaf77ad387f8131beb721e19` |
| `implementation-package-input.json` | `635852cdf08c0c7ee02dabd9e6d00b89e72adf6a2ac3d5be3ade6795ddcb3648` |

## Requested verification

1. Confirm the full command denominator is 113 and profile partition is 68/7/20/9/9.
2. Confirm a profile alone is insufficient: the new 113-row topology matrix must bind every
   existing and future command to actual edge/context/transaction/owner-or-protocol sources.
3. Confirm the 68-row M1 execution matrix plus named generator, root source set and compile task
   closes the former missing-runtime-binding defect.
4. Confirm all 26 catalog-family M1 rows are migration targets, not an exception: no selected
   generic `Map`/`ObjectNode`/`Function`/operation-ID token dispatch remains.
5. Confirm non-M1 `NOT_APPLICABLE_WITH_REASON` applies only to workspace-owner assertions and does
   not exempt protocol/platform topology validation.
6. Confirm that non-mechanical matrix fields are source-anchored and that catalog's 26 M1 rows first
   receive generated backend Java DTOs from the existing P1/OpenAPI authority rather than schema-name
   substitution or generic JSON.
7. Confirm the package post-hook invokes the gate and its self-test proves failed gate => no post
   receipt, while the current count gate is not misrepresented as the new universal implementation.
8. Confirm no static result is presented as JDBC/transaction performance evidence; that requires a
   later fresh r5-full seed report.

## Required verdict and authorization boundary

Return `GO` or `NO-GO` with `M/S/N` findings.  A GO authorizes only static implementation of the
universal gate and M1 runtime topology, using existing tests only.  It does not authorize runtime,
DEV, reset, seed, L2, Testcontainers, deployment, direct SQL/SSH or performance-success claims.
