# RM1P6-U11-MANAGED-INVITATION-BOOTSTRAP implementation adversarial review — Round 1 input checklist

`REVIEW_CYCLE_ID=RM1P6-U11-MANAGED-INVITATION-BOOTSTRAP`  
`REVIEW_TARGET=IMPLEMENTATION`  
`REVIEW_ROUND=1` / `REVIEW_ROUND_LIMIT=2`  
`reviewerKind=INDEPENDENT_SUBAGENT`

| Required input | Path / command | SHA-256 or result | Read/result |
| --- | --- | --- | --- |
| Entry and collaboration | `AGENTS.md`, `CLAUDE.md`, `PLATFORM-BLUEPRINT.md` | `cf6cbf6b…`, `8b12b36e…`, `d9d061ef…` | READ_FULL |
| Current Roadmap | `doc/platform/roadmap-program-registry.json` → `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md#CURRENT_*` | Roadmap `d2490f50…`; `CURRENT_STEP=RM1-P6-3`, authorization true | READ_FULL |
| Exact authorization | Roadmap lines 132–151 and Dexter P6 standing authorization in `AGENTS.md` | same roadmap hash | READ_FULL |
| All kernel | `project-memory/kernel/01`–`06` | `f8add1ef…`, `45a26072…`, `f01d8e4e…`, `1f6d9efb…`, `d0d75e54…`, `5c52b17a…` | READ_ALL |
| Six-dimension route | `scripts/context/recall-memory --task-kind review --domain platform --consumer-face backend --owner platform --impact governance --trigger task-start` | returned kernel plus routed review/governance evidence refs | RUN; every pertinent routed hit reopened |
| Routed memory | `deterministic-context-only`, `independent-subagent-adversarial-review`, `incremental-compliance-hook`, `implementation-source-reread-discipline`, `phase-retrospective-and-systemic-repair`, `verification-governance` | `4c98ed79…`, `891fc8de…`, `0e017902…`, `82bcb60c…`, `fc36fa76…`, `0e786e55…` | READ_FULL |
| Corpus search | terms `invitation workspace operations platform public` against promoted corpus | `G-05/G-07/G-10` | READ; no inference beyond their stated business boundary |
| IA/original business | `doc/decisions/2026-07-28-v2s-rm1-ia-01-platform-otp-and-invitation-interaction.md` | current source reopened fully | READ_FULL; IA01 §§1–2/4 public + target-specific invite boundary applied |
| Current detailed design | `doc/evidence/platform/rm1/p6/rm1p6-u11-joint-remote-l2-design.md`, `...implementation-amendment.md`, problem family, package input, bootstrap baseline addendum, delivery manifest | `6ebaba41…`, `15823d98…`, `5d0540f0…`, `97f4c591…`, current baseline, `f0daf308…` | READ_FULL |
| Current production implementation | root OpenAPI, U11 fixture, backend Gradle task, bootstrap Java, focused test, retained public/operations controller and `WorkspaceInvitationService` | `bb0534ea…`, `21b52513…`, `4b109baa…`, `8ee0de2d…`, `f0a15847…` | READ_FULL |
| Pre/post receipt record | U11 hook event set for root OpenAPI, Gradle, bootstrap class/test and fixture; `validate-delta-receipts` | actual receipt invocation paths; `INCREMENTAL_RECEIPT_COVERAGE=PASS` | READ/RUN |
| Current disposition / package evidence | `rm1p6-u11-joint-remote-l2-source-compliance-disposition.json` | `25683cef…`; manifest/amendment rows bind obsolete hashes | READ_FULL; finding M-01 |
| Standards and verification | `contracts/policy/standards-coverage-matrix.json`; `scripts/check/standards-coverage --phase R5`; verification governance | matrix `7f59478c…`; PASS/RULES=150 | READ_CHECKLIST/RUN |
| Decisions inventory | full `doc/decisions` title list | `e4047a33…` | TITLES_REVIEWED; relevant IA01, review governance, verification, observability reopened |

## Pointwise re-read performed

1. **Retired root OpenAPI refs:** IA01 retirement boundary + U11 amendment/problem family + root `edge.openapi.yaml` + operations/public counterexample paths + `scripts/check/openapi-contracts`; the four retired platform refs are absent while the retained operations/public paths remain.
2. **Non-web owner bootstrap:** IA01 target-specific/public flow + U11 design/amendment + memory owner/secret rules + `ManagedInvitationBootstrap`, `WorkspaceAdministrationService.requireEnabled`, `WorkspaceInvitationService.create`/`requireEnterable`, Gradle JavaExec and focused test; no controller/OpenAPI/direct SQL was found, but the proof does not assert private-output mode/cleanup.
3. **Fixture replacement:** U11 design/problem family + current fixture + root OpenAPI route scan + runner cleanup source; seven joint consumers call the bootstrap and continue the public flow, while one separately owned legacy platform-only fixture remains explicitly disclosed and is outside this L2 denominator.
4. **Evidence binding:** active package/addendum/package input/delivery manifest/disposition plus fresh static controls; receipts are present, but disposition source hashes are stale after the current design/amendment changes.

## Blind-review declaration

I received this checklist in a fresh subagent context, tried to falsify the reviewed implementation, and wrote my findings and verdict before reading any author self-review or author finding disposition. I also treated missing or substituted per-change prewrite/post-proof reread as a finding; a general preparation pass, static result, or later L2 did not substitute for pointwise source review.
