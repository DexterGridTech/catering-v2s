# BP static remediation — Codex independent implementation review, round 1

```text
REVIEW_CYCLE_ID=BACKEND_PERFORMANCE_NO_GO_REMEDIATION_IMPLEMENTATION_20260811
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
SCOPE=static-only remediation of M-01, S-01, S-02, S-03, N-01 and N-02
```

## Independence and boundary

`blindReviewDeclaration`: The reviewer treated the user-required Claude recheck as an
untrusted problem charter, independently enumerated current source/contract/generator/test/control
denominators, and formed the source verdict before opening the author static package-exit claim.
No author assertion, reported count, or historical PASS was accepted as proof.
`authorMaterialReadAfterIndependentVerdict=true`: the package-exit was read only afterwards to
compare its claims with the independently derived result.

This is a fresh v2s-rooted, static-only review. It did not start Testcontainers, L2, DEV,
reset, seed, UAT, deployment, or a managed runner, and it did not alter production code.
It does not authorize any dynamic step. The reviewed non-UI maintenance task remains bounded by
`BACKEND_PERFORMANCE_FINAL_CLOSURE` and the BPF-U01..U06 static package.

## Exact inputs read and SHA-256 verified

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
| `project-memory/decisions/confirmed-business-language-corpus.md` | `3dba1c80579d4a0eca281efd59d27fbfb20aa86572648f8e36c83a68a603b4f3` |
| `project-memory/operations/business-corpus-adoption-and-read-policy.md` | `d362c4f78c5fc0cb1225a7a4465f82ebbd0c41b886535d69b9f698ea162cd7a9` |
| `project-memory/operations/business-corpus-parked-domain-intake.md` | `739473d09701aba15332c6de72f1f1965b7b5048732fd60d3b97c7934febee9e` |
| `project-memory/decisions/incremental-compliance-hook.md` | `a75469c7eb945b35f06d95cead2e11c368cc4a47dca851f32652556546985f81` |
| `contracts/policy/standards-coverage-matrix.json` | `130abbd843c3d76b44848d82e60c061bc78fcf3c587f3eb2c8f584c57294b261` |
| `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` | `108ba9050ed256c6e41a3e53e3af4c761706c4dc8fe697de9540fc649f5af6d3` |
| `doc/decisions/2026-07-24-v2s-verification-governance.md` | `6dceb7fe8fac8a9ac4df5c650204f225f079451218dd5fcbd6f573c68692f0f5` |
| `doc/decisions/2026-08-08-v2s-backend-performance-refactor-design-authorization.md` | `0595e3679cfc355a82098a5925a55bebe82b234693b6320113894d1f2db0f7a0` |
| `doc/review/platform/2026-08-11-v2s-backend-performance-no-go-remediation-recheck-claude.md` | `ea8c4672032e2cacd4af2e4599deb114eba8d0cbae21cb823d70e2a6e90d2e79` |
| `doc/evidence/platform/2026-08-11-v2s-backend-performance-final-optimization-static-implementation-package-input.json` | `110aa923b660c995ab391eb3f31d38b7a7d0305018e79e65b40dad5f9e7041bb` |
| `contracts/policy/mandatory-per-edit-gate-command-closure.json` | `e01a09d9e2de8d198131d8d62f2b96015c01c7fdd6a0ba885e3eb776cf29185b` |
| `.runtime/compliance-control/active-package.json` | `5b722929dc5485ebc4fc34eb684e04c62d0a996991c712b7879dbea6d525df56` |
| `tools/compliance-control/cli.mjs` | `5b1206512ae18bf62b7b143633527d7ca72eb1d8a21b1518fb620b15cb393a51` |
| `scripts/check/backend-performance-sql-merge-coverage` | `01e90285b3cefce3bc53f583e449ec90ca764a6d3c4ac2def9c6fdf3d53aff4c` |
| `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java` | `4756c02f246f4986274ba59ca0e3916ad5f1e79b60b89d57b3caa1aeff5e2e8a` |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/catalog/application/SaveOperationsCatalogItemOperation.java` | `378231dad1227ae63cb66bc06628fc84e790d4537f239cb08fd1f8a245361f4a` |
| `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java` | `00e9694f1c0d7ea9596828691fda2a8e76db78aba3e6fec096ae9b5e58fe4882` |
| `apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts` | `602af751a38c71900035e096639dda8c0ce17ccda76e39549195bc8075db5c25` |
| `scripts/generate/catalog-inventory-p3-frontend.mjs` | `81b3be09c391de23e3d516bd33fe08190b22c150d648356acec3018920364ece` |
| `scripts/test/catalog-inventory-query-envelope.test.mjs` | `19ac764320a07866f2b75cb08bdd6a942d0234c01de2137d2054e6b69c733717` |
| `scripts/test/backend-performance-testcontainers-196-remote-workload.mjs` | `ad50cf27fe7991cf00abf2766be331ed23b16169a68ccf34a03cc66910674928` |
| `apps/backend/catering-business-server/src/test/java/dynamic/BackendPerformanceTestcontainers196Test.java` | `62007f1b45d955086ab410e873fdf97585c9338a04f8bf35ec7be6c52c4e8676` |

The six-dimensional recall route was `review/platform/backend/platform/governance/task-start`.
The applicable business-corpus entries were G-11/G-12 (catalog and inventory); this technical
review did not infer any new business capability, owner, or Journey from them. The full
`doc/decisions/` title inventory was also independently listed; the three listed decisions were
the only ones applicable to this static remediation.

## Independent evidence and counterexample attempts

| Finding family | Finite denominator and independent result |
| --- | --- |
| M-01 canonical cross-owner readbacks | The production control enumerates seven copy-preflight consumers plus two catalog-save readbacks. `CatalogInventoryCoordinator` now parses the envelope, binds `data` to `InventoryTargetEnsureReadback`, rejects blank `targetRef`, and persists only the typed value at `:528-532`, `:599-614`; the exact-set guard is `scripts/check/backend-performance-sql-merge-coverage:548-583`. Attempts represented by non-object data, whole-envelope binding, `readValue`, and empty-string fallback are rejected by the control. **Closed.** |
| S-01 strict query envelopes | Contract-derived GET denominator is **16**. The frontend generator routes every GET to `CatalogQueryEnvelope<T>` at `scripts/generate/catalog-inventory-p3-frontend.mjs:59`; generated wire declares all 16 as strict at `catalog-inventory-edge.ts:128-169`. The regression test independently asserts 16/16 at `scripts/test/catalog-inventory-query-envelope.test.mjs:15-47`. **Closed.** |
| S-02 production consumers | Finite consumer denominator is six catalog-management GET consumer files. `CatalogWorkbenchPage` now decodes generated types without widening casts at `:138-145` and `:291`; the six-source required/forbidden matrix is asserted at `catalog-inventory-query-envelope.test.mjs:61-75`. **Closed.** |
| S-03 cleanup ownership | The workload now honestly declares `NOT_OWNED_BY_WORKLOAD` and `TESTCONTAINERS_AND_MANAGED_RUNNER` at `backend-performance-testcontainers-196-remote-workload.mjs:23-24,256-263`. The Java Testcontainers test asserts exactly that at `BackendPerformanceTestcontainers196Test.java:176-185`; it no longer claims a Java cleanup hook it does not own. **Closed.** |
| N-01 manifest revision naming | Owner output writes `manifestRevision` at `CatalogOwnerService.java:1227-1235`; the generated payload has that distinct field at `catalog-inventory-edge.ts:78`. Contract, read model, OpenAPI, generated type, and producer are independently cross-checked at `catalog-inventory-query-envelope.test.mjs:85-105`. **Closed.** |
| BPF package admission | The active BPF package declares an allowed `backend-performance-static` archetype and the only approved profile. `tools/compliance-control/cli.mjs:921-964` verifies profile/archetype/command hash, and `:2523-2536` runs it after an admitted edit before issuing the receipt. Profile binding points to the immutable command hash above. **No admission bypass found.** |

Fresh static execution results: `standards-coverage --phase BACKEND_PERFORMANCE_FINAL_CLOSURE=PASS`;
canonical/readback coverage PASS with `M1_CROSS_OWNER_CANONICAL_READBACKS=9`;
BPF standards registration PASS; BPF command binding PASS (`113` commands, `68` M1);
static 196 reconciliation PASS (`196` operations, `14` scenarios, `10` loaders);
compliance static scan PASS in `BACKEND_PERFORMANCE_STATIC_ADMISSION`; and all eight
`catalog-inventory-query-envelope` Node tests PASS. No dynamic process was invoked.

## Finding

### N-01 — typed-cause family has two remaining direct readback translators

- **Status:** `CONFIRMED`.
- **Evidence and finite denominator:** A source scan of the ten direct catalog parser/serializer
  `catch (Exception …) -> CatalogOwnerApi.Problem` boundaries finds eight that preserve their
  cause and two that do not. The omissions are
  `apps/backend/catering-business-server/src/main/java/com/catering/v2s/catalog/application/SaveOperationsCatalogItemOperation.java:44-45`
  and
  `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java:449-450`.
  The current regression test calls its restricted set “every allowed” boundary at
  `scripts/test/catalog-inventory-query-envelope.test.mjs:107-125`, but it excludes both paths.
- **Impact:** Both paths remain fail-closed with `RESULT_UNKNOWN`; no owner fact, transaction,
  response, or authorization is accepted incorrectly. Their lost causes, however, remove the
  parser/serialization diagnosis needed to distinguish malformed owner readback from mapper
  drift, recreating the operational cost targeted by original N-02.
- **Smallest fix:** Pass `failure` to the existing four-argument `CatalogOwnerApi.Problem`
  constructor at both sites, then extend the existing test's finite boundary array to require the
  two new cause-preserving calls. Do not alter the typed code/status/message, owner boundary, or
  public response shape.
- **Why not higher severity:** The two paths do not downgrade failure to success or persist a
  default; they only lose diagnostics. The same operation's other canonical readback validation
  is still fail-closed.

## Verdict and authorization boundary

**GO — M=0, S=0, N=1.** M-01, S-01, S-02, S-03, and N-01 are closed on current bytes; N-02 is
only partially closed by the non-blocking cause-preservation omission above. This verdict is
limited to static remediation and static controls. It does not authorize Testcontainers, L2,
reset, DEV, seed, UAT, deployment, numerical performance claims, or a final dynamic
implementation closure.
