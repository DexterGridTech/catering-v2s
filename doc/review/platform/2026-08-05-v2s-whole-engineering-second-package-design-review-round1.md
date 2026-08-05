# Whole-engineering second package — independent DESIGN adversarial review (Round 1)

REVIEW_TARGET=DESIGN  
REVIEW_CYCLE_ID=WHOLE-ENGINEERING-SECOND-PACKAGE-20260805  
REVIEW_ROUND=1  
REVIEW_ROUND_LIMIT=2  
reviewerKind=INDEPENDENT_SUBAGENT  
ROUND_FINAL_DECISION=NOT_APPLICABLE_ROUND_1

## Blind declaration

I independently reopened the required entry chain, IA04, D1–D7 rulings, RP-07/RP-08/RP-10/RP-11 rows, the
second-package implementation design, delivery manifest and active package, then checked the current owner,
contract/generated, foundation and managed-runner sources. I formed this verdict before reading any author
disposition, self-review or Claude review artifact. No production source was changed and no DEV/UAT/HTTP/L2,
seed/reset or Git operation was performed. The only command-level controls run were read-only context recall and
`scripts/check/standards-coverage --phase RM1-P6-3`, which returned `STANDARDS_COVERAGE=PASS` (`PHASE=R5`).

## Verdict

**NO-GO — M=4, S=1, N=0.** The package shape is directionally bounded, but the current design does not yet
provide a finite, auditable trust-consumer denominator, a finite RP-08 Drawer denominator, a production-bound
RP-11 cleanup red proof, or an exact business-evidence oracle. These are design blockers; this is not an
implementation/runtime/business/cleanup PASS.

## Findings

### M-01 — RP-10 trust-source denominator omits direct self-hash consumers

**Status: CONFIRMED.** D2 requires the repository allowlist to be the sole remote-host trust source and the
design says “all existing consumers” must use the resolver/readback. The manifest `RUNTIME_RUNNER` denominator
lists only `r5-dev-environment`, `r5-dev-runner`, `http-diagnostic-runner`, and `r5-joint-remote-l2`; it omits
current direct self-hash/default-hash consumers in `r5-reset.mjs`, `r5-joint-remote-l2.mjs`,
`http-diagnostic-runner.mjs`, `terminal-fixture-state.mjs`, `r5-remote-testcontainers.mjs`, and
`r5-seed-bootstrap.mjs` (and the policy file itself is not in any six-source denominator). Current source contains
`sha256(host)`, `hostHash ?? sha256(host)`, or equivalent checks in those files. A future implementation can
make the listed files green while an omitted path still accepts attacker-supplied host+hash, so set equality
cannot prove D2 closure.

**Minimal repair:** freeze a finite discovery list of every remote-host consumer and the normative
`contracts/policy/r5-remote-host-allowlist.json`, assign each an owning source/change surface, and require a
red mutation for every remaining input-derived expected fingerprint. Do not broaden trust to an external config
or grant reset/seed authority merely to edit these validators.

### M-02 — RP-08 “all form Drawers” has no finite source denominator

**Status: CONFIRMED.** IA04 and the design require every operations form Drawer to bind the same `submitting`
truth across mask, icon, keyboard, `onClose/requestClose` and footer cancel. The manifest’s `FOCUSED_PROOF`
contains an application directory and an architecture-test directory, but no enumerated Drawer file set or
predicate/oracle. The current operations app has separate form Drawers for organization, business entities,
stores, contracts, workspace invitations and password change; the brand authorization Drawer additionally keeps
a local `submitting` state while `useDrawerFormLifecycle` remains unsynchronized. A broad directory is not a
finite denominator and changed-path receipt equality cannot show that no form Drawer was missed or that a
non-form Modal was not accidentally changed.

**Minimal repair:** record an exact, current `FORM_DRAWER` inventory (path, owner operation, required foundation
primitives and each close entry point), explicitly exclude detail Drawers/status Modals/public invitation
surfaces, and add per-file focused red/green assertions. The brand Drawer must be bound to the foundation
submission state or an explicitly documented synchronized adapter.

### M-03 — RP-11 red proof is not bound to the production runner path

**Status: CONFIRMED.** The design promises that a leader-dead/child-alive mutation makes cleanup FAIL, but the
manifest only names a future helper self-test and generic “managed local L2 cleanup report”. It does not name a
production-path fixture that starts a runner-owned child, kills the leader, and proves the runner’s actual
manifest/cleanup evaluator rejects a non-empty tree. Current `r5-dev-runner` tracks leader PIDs/start tokens and
uses process-group termination; helper-only tests could pass while an actual runner still reports PASS after a
child escapes. The package therefore lacks the required real red mutation on the production cleanup path.

**Minimal repair:** add a bounded production-runner red fixture (or an equivalent runner integration test) whose
manifest contains root PID/start token/PGID and child identities, then assert `cleanup=FAIL` with
`business=PASS` preserved when the child survives. The proof must read the run-scoped log/manifest and retain
first-failure, last-known-good and broken-boundary fields; no port/name heuristic may be used.

### M-04 — Business evidence does not state the owner-readback oracle

**Status: CONFIRMED.** IA04 requires one-at-a-time add/remove owner commands and replacing visible membership
with fresh owner detail readback. The design’s dynamic predicate says “brand authorization behavior pass”, while
`BUSINESS_EVIDENCE` is only a generic path plus “managed local L2 report and red/green journey assertions”. It
does not require the L2/business artifact to prove the owner candidate predicate, a single request (no client
union), command idempotency/replay handling, owner authorization re-check, and post-command detail readback for
both add and remove. Static adapter tests cannot substitute for the package’s claimed business evidence.

**Minimal repair:** define a finite business oracle with explicit IA04 steps and expected owner facts: name-only,
code-only, uppercase/trimmed and no-match searches; exactly one paged request; add and remove each followed by
fresh owner detail; stale/denied and unknown-outcome recovery. Keep this evidence separate from cleanup and from
static generated-wire proof.

### S-01 — RP-07 query normalization is underspecified

**Status: PARTIALLY_CONFIRMED.** The design states “trimmed `queryText`” and predicates `lower(name)`/`lower(code)`
against `queryText`, but does not state that the query operand is lower-cased (or use a case-insensitive operator).
The current owner helper lower-cases filters, so this may be preserved by a careful implementation, but the
design’s focused proof names only name/code/no-match/page-boundary and can pass lowercase fixtures while uppercase
input silently fails.

**Minimal repair:** freeze `q = lower(trim(queryText))`, define blank as null, and add uppercase name/code cases to
the focused oracle. Do not change tenant/head-company semantics or add a second request.

## Positive checks / no additional finding

- IA04 correctly keeps `platform-admin`/`operations-admin` separate and makes brand authorization a total-company
  detail Drawer with owner-returned candidates and one-at-a-time add/remove commands.
- The RP-07 owner/edge/generated chain is the correct layer ownership direction; the current edge delegates brand
  page semantics to `BusinessEntityService` rather than introducing a second frontend search implementation.
- The design explicitly forbids database/migration changes, seed/reset execution, UAT/remote app/browser
  execution and Git operations; these boundaries remain unchanged by this verdict.
- `businessStatus` and `cleanupStatus` remain `PENDING` in the manifest, which is honest at design-review time;
  neither static proof nor this review upgrades them.

## Required input paths and SHA-256

The following are the exact mandatory inputs read for this round. Hashes are the bytes read in this worktree.

| path | sha256 |
| --- | --- |
| `AGENTS.md` | `4d64bfb2bb435326a13c2ccb7955dbbbef621259030693e64db3cbf6a0bd9fda` |
| `PLATFORM-BLUEPRINT.md` | `3b90bd602eb682c4718d6c51f399501c34f804cddd96da82d59495e60b115a8d` |
| `doc/platform/roadmap-program-registry.json` | `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` |
| `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `d2490f5038f02ad40b19150a377a2188f313350d965460c3a07ab4c1c3f4eb73` |
| `project-memory/index.md` | `3d0f2cf3fcc52a474871cd3d3dea599f590f4267e2cffedf642336080b69e74b` |
| `project-memory/decisions/deterministic-context-only.md` | `4c98ed79b0c8e4694893a29ed977fd2eccea6c1562f2d62f32c06dcbb5ac7e20` |
| `project-memory/operations/implementation-source-reread-discipline.md` | `6944ae47f0e059a52e75096b17620a3c43852e52a9b44e69737554ac646293ce` |
| `project-memory/operations/verification-governance.md` | `e424bf923f1368381b26ef0e22a379a5cdd7bc8b7de887cc2c4e78250f2e0f18` |
| `project-memory/operations/dev-command-separation.md` | `d75229d34422aa70ae1f7506c09633aa9444147932983de3197c5b093414897e` |
| `project-memory/kernel/01-workspace-and-roadmap.md` | `f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63` |
| `project-memory/kernel/02-service-shape-and-owner.md` | `45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032` |
| `project-memory/kernel/03-transaction-data-and-dependencies.md` | `f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44` |
| `project-memory/kernel/04-contract-consumer-and-admin.md` | `1f6d9efbe0208f5b164d12effd4a4c4ab8f2c297b9b000462dc96820c3efa88d` |
| `project-memory/kernel/05-evidence-runtime-and-git.md` | `f5e219652484338467f0fc03be2bd02d96e09a4a27b812308200673ef720c736` |
| `project-memory/kernel/06-heritage-and-change.md` | `5c52b17aad29ba9d78e327ebe550a740d73f97402041c9f4d31c8df38615566c` |
| `doc/decisions/2026-07-29-v2s-rm1-ia-04-operations-organization-and-contract-interaction.md` | `416d4c9d385bacdcd7abd164d1d9ae7e6478738fb9c15411ad0673d616d90663` |
| `doc/decisions/2026-08-05-v2s-whole-engineering-d1-d7-rulings-claude.md` | `ebdc56933034980c4798cc0082a1716bf1d9aa7b59a1b9774950307c8f9e9242` |
| `doc/review/platform/2026-08-05-v2s-whole-engineering-remediation-design-and-execution-plan-codex.md` | `50f1b3004566599971420320d95dd0e5db0f27a910a911332bc9b07cd6f83d62` |
| `doc/plans/platform/2026-08-05-v2s-whole-engineering-second-package-implementation-design.md` | `864a4c322ffa27466debc0948d318e30272674e5e5b3d64780b240cb349ae4cc` |
| `doc/review/platform/2026-08-05-v2s-whole-engineering-second-package-delivery-manifest.json` | `d9868430ab553bac76cacc997e54a423791ba4816e2f3e806d9c6dec117af867` |
| `.runtime/compliance-control/active-package.json` | `e92c9799f49d146a6850e80eb836d4c739d28ce159fd5b2eb54159dfce0a42a5` |
| `doc/review/platform/2026-08-05-v2s-whole-engineering-second-package-design-review-input.md` | `76e694ba31ff3bbecd5e80a44fc36534aed20e7b9709af6b7466c4b07f09ae56` |

## Additional source reopens (current bytes)

| path | sha256 |
| --- | --- |
| `contracts/openapi/paths/operations-admin/brand-management.paths.yaml` | `973ed608d025a77f70eb12dbeca210832f84e5a8d1956fbb8ee9d5aca7308bad` |
| `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/BusinessEntityService.java` | `da6e182ffeefefa50cf22b7e2384cd71cbb4904e6c8c49fbb05abd52f57cd06e` |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsBusinessEntityController.java` | `1400b101baafa9bb1f69a6efeab11dff4a314b96e663579546b4c4fc3d86b94e` |
| `apps/frontend/operations-admin/src/features/business-entity-management/application/HeadCompanyBrandAuthorizationActionAdapter.ts` | `4bddb27633c744c9456471a6ce43ccf11e89debc3d2d08bc7e2315e0df7270c5` |
| `apps/frontend/operations-admin/src/features/business-entity-management/ui/HeadCompanyBrandAuthorizationDrawer.tsx` | `5714f90d6308aaf05a8585e3f493ced0bc33b17f85362bf34a3ec953651904dc` |
| `libraries/frontend/admin-ui-foundation/src/behavior/useDrawerFormLifecycle.ts` | `96a7419261a192a595b40f94c93a005266500b7a961ff988e49451d5102f0589` |
| `scripts/dev/r5-dev-environment.mjs` | `ea7ca67f46aaf6274e9876345aee36aad31cd7ea3e97d33fdf240a42db3c383b` |
| `scripts/dev/r5-reset.mjs` | `eb887eb2cf8cdefdc502e0ccc0f347b755cdf846cdca4c1ce538c4022df684ac` |
| `scripts/dev/r5-dev-runner.mjs` | `d610620f8f875b54868ccdc1259da2262bbde3bb87cfdb87da5ff1aa7ac4e559` |
| `scripts/dev/http-diagnostic-runner.mjs` | `9529d1c8dabfc05542a6eb8f242127fd73d52201b1ea825ead7c7be45f7cd124` |
| `scripts/dev/terminal-fixture-state.mjs` | `49f9d7177778bd77a157b1afaa50d7b8d2781fdeccf83130f787608fd3599832` |
| `scripts/test/r5-joint-remote-l2.mjs` | `6a6560be30f62e6d7bc4c3801e9450bbc04ee3258847cb4027701dcc3129232a` |
| `scripts/test/r5-remote-testcontainers.mjs` | `eddac7f2db2dc582a51855dd838210d4bd0a966020759774ff6df37764400aa5` |
| `scripts/dev/r5-seed-bootstrap.mjs` | `92c852a921072cb5c80ffba3492341c3dd8e78c95cd12eb98433c21ddeac519a` |

The planned future files `contracts/policy/r5-remote-host-allowlist.json`,
`scripts/dev/r5-remote-host-trust.mjs`, and `scripts/dev/managed-process-tree.mjs` had no current bytes at
review time; they are therefore not falsely given a source hash.
