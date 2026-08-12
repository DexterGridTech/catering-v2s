# BP static remediation — independent implementation review, Round 2

```text
REVIEW_CYCLE_ID=BACKEND_PERFORMANCE_NO_GO_REMEDIATION_IMPLEMENTATION_20260811
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
SCOPE=static-only verification of the Round-1 N-01 typed-cause remedy
```

## Independence, authority, and blind declaration

`blindReviewDeclaration`: The user required this replacement reviewer to open the
Round-1 review first.  I treated it solely as an untrusted problem charter, then
independently derived the source denominator from current catalog parse/serialization
catch sites and formed the verdict from current bytes.  I did not read an author
self-assessment, disposition, package-exit claim, or dynamic evidence as proof.

`authorMaterialReadAfterIndependentVerdict=NOT_APPLICABLE`: no author material was
provided or opened; the required Round-1 artifact is a prior independent review, not
an author disposition.  This report does not reuse its conclusion.

Authority was static-only.  I did not start Testcontainers, L2, DEV, reset, seed,
UAT, deployment, a managed runner, or any production process, and did not change
production code.  The sole write is this review artifact.  The current Roadmap still
declares `CURRENT_STEP=BACKEND_PERFORMANCE_FINAL_CLOSURE`; this review neither closes
that step nor authorizes its dynamic stages.

## Reviewer input checklist (read and SHA-256 verified)

| Path | SHA-256 |
| --- | --- |
| `AGENTS.md` | `4d64bfb2bb435326a13c2ccb7955dbbbef621259030693e64db3cbf6a0bd9fda` |
| `CLAUDE.md` | `8b12b36e0c852f3a55f40f29d3d21101b9acb113b969ff5f8a9c2152c2aec50f` |
| `PLATFORM-BLUEPRINT.md` | `38d6138be17a514ded4188f8f71555c480eb3582abcb4f265ffa757792d9b039` |
| `doc/platform/roadmap-program-registry.json` | `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` |
| `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `bb4ecd2e0979545e52bb779dbaf01ba855ea12084ea0ef32374b20bb3d3a838b` |
| `project-memory/kernel/01-workspace-and-roadmap.md` | `f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63` |
| `project-memory/kernel/02-service-shape-and-owner.md` | `45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032` |
| `project-memory/kernel/03-transaction-data-and-dependencies.md` | `f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44` |
| `project-memory/kernel/04-contract-consumer-and-admin.md` | `1f6d9efbe0208f5b164d12effd4a4c4ab8f2c297b9b000462dc96820c3efa88d` |
| `project-memory/kernel/05-evidence-runtime-and-git.md` | `f5e219652484338467f0fc03be2bd02d96e09a4a27b812308200673ef720c736` |
| `project-memory/kernel/06-heritage-and-change.md` | `5c52b17aad29ba9d78e327ebe550a740d73f97402041c9f4d31c8df38615566c` |
| `project-memory/decisions/deterministic-context-only.md` | `4c98ed79b0c8e4694893a29ed977fd2eccea6c1562f2d62f32c06dcbb5ac7e20` |
| `project-memory/decisions/independent-subagent-adversarial-review.md` | `891fc8de061560796dc682c5749d73a5d47029592fca197f09f032e3018b4daf` |
| `project-memory/decisions/http-crud-efficiency-design-redlines.md` | `8c9b3d87089abf7989745f0bdfbba5c695e3bd8427c3f9dc9b4f592229255997` |
| `project-memory/operations/verification-governance.md` | `e424bf923f1368381b26ef0e22a379a5cdd7bc8b7de887cc2c4e78250f2e0f18` |
| `project-memory/operations/phase-retrospective-and-systemic-repair.md` | `aa217082dd2dd9500ff3ce59258be46190c5941afe5cd813967c0773657e12ba` |
| `project-memory/decisions/incremental-compliance-hook.md` | `a75469c7eb945b35f06d95cead2e11c368cc4a47dca851f32652556546985f81` |
| `project-memory/operations/implementation-source-reread-discipline.md` | `6944ae47f0e059a52e75096b17620a3c43852e52a9b44e69737554ac646293ce` |
| `project-memory/decisions/confirmed-business-language-corpus.md` | `3dba1c80579d4a0eca281efd59d27fbfb20aa86572648f8e36c83a68a603b4f3` |
| `project-memory/operations/business-corpus-adoption-and-read-policy.md` | `d362c4f78c5fc0cb1225a7a4465f82ebbd0c41b886535d69b9f698ea162cd7a9` |
| `contracts/policy/standards-coverage-matrix.json` | `130abbd843c3d76b44848d82e60c061bc78fcf3c587f3eb2c8f584c57294b261` |
| `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` | `108ba9050ed256c6e41a3e53e3af4c761706c4dc8fe697de9540fc649f5af6d3` |
| `doc/decisions/2026-07-24-v2s-verification-governance.md` | `6dceb7fe8fac8a9ac4df5c650204f225f079451218dd5fcbd6f573c68692f0f5` |
| `doc/review/platform/2026-08-11-v2s-backend-performance-no-go-remediation-implementation-review-round1-codex.md` | `1ed8bb5d651e7a37168af78162b3183adfd647f83e9cd534ac0bb38082e5182d` |
| `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java` | `90493e07606449d656a4642e26b8aca1ec46840df8238ea94a083dac41fae7ff` |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/catalog/application/SaveOperationsCatalogItemOperation.java` | `283ed52991d5f2442a45cd5714a6f9eed3b15a6cf3b3891c9cade0884bc3c4a4` |
| `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/api/CatalogOwnerApi.java` | `0367e1b1e7af85e1b67280cf0475d77f56e17f8410efcfacb4fc693fb9d3e4eb` |
| `scripts/test/catalog-inventory-query-envelope.test.mjs` | `7a1e19041b2e0bc67ca97858cd95b11bd6af97470401e619eb7e9be8364f84e0` |

The deterministic recall route was
`review/platform/backend/platform/governance/task-start`.  Catalog/inventory corpus
entries constrain terminology only here; no new actor, owner, Journey, contract, or
runtime authority was inferred.

## Independent static audit

### Finite denominator

I scanned all `catalog` Java sources under both the application app and the catalog
module for parser/serializer calls protected by an exception catch and for every
`CatalogOwnerApi.Problem` constructed with a caught cause.

- The complete direct caught-cause constructor denominator is **11**: six in
  `CatalogOwnerService`, four in `CatalogInventoryCoordinator`, and one in
  `SaveOperationsCatalogItemOperation`.
- One shared direct readback translator,
  `CopyPreflightWireShape.invalidReadback`, is line-wrapped and therefore outside
  that one-line scan; it is separately called by exactly two preflight operations.
  It preserves `failure` as the fourth constructor argument.  The full source
  denominator represented by the focused regression is therefore **12** distinct
  caught-cause translation sites.
- The readback-specific denominator is **four** direct translation exits:
  `CatalogInventoryCoordinator.parseLocalCopyJson` (`:440-451`),
  `CatalogInventoryCoordinator.parseCatalogSaveOwnerReadback` (`:599-614`),
  `SaveOperationsCatalogItemOperation.execute` (`:36-46`), and
  `CopyPreflightWireShape.invalidReadback` (`:130-132`).  The shared helper has two
  direct parser callers: `PreflightOperationsLocalCatalogCopyOperation:23-25` and
  `PreflightOperationsBrandCatalogCopyOperation:39-43`.

No parse/serialization exception translator in that finite source surface constructs
a three-argument `CatalogOwnerApi.Problem` after catching the underlying exception.
Validation-only `Problem` constructions and deliberate `Problem` rethrows are
counterexamples, not lost-cause translators.

### Round-1 remedy and cause preservation

The two former omissions are closed on current bytes:

1. `CatalogInventoryCoordinator:449-450` catches mapper parsing failure in the
   owner-copy readback path and now throws
   `new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "owner copy readback is invalid", failure)`.
2. `SaveOperationsCatalogItemOperation:44-45` catches request serialization or
   owner-readback deserialization failure and now throws
   `new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "catalog save readback is invalid", failure)`.

`CatalogOwnerApi.Problem` supplies the four-argument constructor and delegates with
`super(message, cause)` at `CatalogOwnerApi:206-209`; the source exception is thus
retained without changing code, status, owner boundary, transaction handling, or
public response shape.  The adjacent `CatalogOwnerApi.Problem` catch in each target
does not wrap an already typed failure.

### Regression evidence and adversarial checks

- Fresh `node --test scripts/test/catalog-inventory-query-envelope.test.mjs`:
  **PASS, 8/8**.  Its cause-preservation case enumerates the six owner, four
  coordinator, one save-operation, and one shared-helper source patterns.  In
  particular it requires both former N-01 paths with their caught `failure`.
- Fresh `scripts/check/standards-coverage --phase BACKEND_PERFORMANCE_FINAL_CLOSURE`:
  **PASS** (`PHASE=R5`, via the declared phase alias; `RULES=150`).
- Counterexample attempts: a three-argument replacement at either target would fail
  the focused source-pattern regression; omitting the fourth-argument constructor or
  changing `super(message, cause)` would also fail it.  The source scan further
  rejects the contrary claim that a remaining direct caught parse/serialization path
  loses its cause.

## Verdict

**GO — M=0, S=0, N=0.**  The Round-1 N-01 remedy is complete and proportionate: it
preserves diagnostic causality at the two missed owner-readback boundaries, and the
current finite source denominator plus focused regression cover the whole problem
family without changing behavior or adding a new generic mechanism.

This is only a Round-2 static implementation-review GO for this remedy.  It is not a
runtime, database, seed/reset, Testcontainers, DEV, L2, UAT, cleanup, business, or
performance-success verdict, and it does not authorize any next execution stage.
