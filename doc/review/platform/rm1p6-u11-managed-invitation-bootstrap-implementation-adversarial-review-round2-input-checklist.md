# RM1P6-U11 managed invitation bootstrap — implementation adversarial review round 2 input checklist

`REVIEW_CYCLE_ID=RM1P6-U11-MANAGED-INVITATION-BOOTSTRAP`  
`REVIEW_TARGET=IMPLEMENTATION`  
`REVIEW_ROUND=2` / `REVIEW_ROUND_LIMIT=2`  
`reviewerKind=INDEPENDENT_SUBAGENT`  
`ROUND_FINAL_DECISION=SELF_DECIDED`

| Required input | Path / command | SHA-256 or result | Read/result |
| --- | --- | --- | --- |
| Entry chain | `AGENTS.md`; `PLATFORM-BLUEPRINT.md`; `CLAUDE.md` | `cf6cbf6b…`; `d9d061ef…`; `8b12b36e…` | READ_FULL |
| Current Roadmap and authority | registry → Roadmap `CURRENT_*` | registry `f3e232d2…`; Roadmap `d2490f50…`; `CURRENT_STEP=RM1-P6-3`, P6 authorization present | READ_FULL |
| All kernels | `project-memory/kernel/01`–`06` | index hashes `f8add1ef…`, `45a26072…`, `f01d8e4e…`, `1f6d9efb…`, `d0d75e54…`, `5c52b17a…` | READ_ALL |
| Six-dimension recall | `scripts/context/recall-memory --task-kind review --domain platform --consumer-face backend --owner platform --impact governance --trigger task-start` | deterministic route completed | RUN; every returned routed file reopened |
| Routed review memory | deterministic-context, independent-review, business corpus/read policy, incremental hook; applicable verification source | current kernel/index-bound bytes | READ_FULL |
| Business/interaction authority | IA01, G-05/G-07/G-10 and their non-inference boundary | current source reopened | READ_FULL |
| U11 current design/evidence | U11 design, implementation amendment, problem family, package input, CP-U11 package input, bootstrap baseline, delivery manifest, current disposition | design inputs reopened; disposition `3627831f…`; delivery manifest `f0daf308…` | READ_FULL |
| Current production bytes | root OpenAPI `bb0534ea…`; Gradle `4b109baa…`; bootstrap `8ee0de2d…`; focused test `856430b…`; fixture `21b52513…`; retained owner/public sources | current bytes | READ_FULL |
| Mandatory repair evidence | disposition independently recomputed (`ruleCount=32`, `rowCount=32`, 32 unique rule IDs); each row source hash rehashed | no drift output | PASS |
| Fresh static controls | `standards-coverage --phase R5`; `openapi-contracts`; compliance `static-scan`; `validate-delta-receipts` | PASS/RULES=150; PASS; PASS/RULES=32; PASS (`PACKAGE_ID=RM1P6-JOINT-REMOTE-L2-U11`) | RUN |
| Correct focused proof | `gradle --project-dir . :apps:backend:catering-business-server:test --tests com.catering.v2s.app.bootstrap.ManagedInvitationBootstrapTest --rerun-tasks --no-daemon` | `BUILD SUCCESSFUL`; 24 tasks executed | RUN/PASS |
| Round 1 material | Round 1 checklist and artifact | checklist `9822e389…`; artifact `3a48472e…` | READ_AFTER_INDEPENDENT_VERDICT |

## Pointwise counterexample checks

1. The bootstrap is `WebApplicationType.NONE`; its only business calls are `WorkspaceAdministrationService.requireEnabled` followed by `WorkspaceInvitationService.create` with one `AssignmentIntent`. Direct source scan found no controller mapping, OpenAPI exposure, JDBC/SQL, `DataSource`, `EntityManager`, or statement API.
2. The focused test writes an output, reads its POSIX mode as exactly `rw-------`, and separately supplies a pre-existing output path that `Input.from` rejects. The implementation uses an owner-only temporary file and a move without replacement.
3. Root `edge.openapi.yaml` contains zero retired `/api/platform/...invitation` pointers. The fixture has seven effective managed-bootstrap consumers: three direct pre-helper calls, three `createCompletedTargetAssignment` invocations, and the public invitation; each then continues via retained `/api/public/invitations/...` flow. The one remaining legacy platform fixture route is `scripts/test/r5-platform-admin-l2-fixture-seed.mjs` and remains explicitly outside this joint-U11 denominator.

## Blind-review declaration

This fresh independent reviewer first reopened the current authority, design and production bytes, tried to falsify the two Round-1 repairs, and formed the static-to-L2 verdict before reading the Round-1 checklist, artifact, or author disposition narrative. Static success and the focused test were not treated as L2, business, or cleanup evidence.
