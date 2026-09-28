# Terminal activation batch 1 · whole-batch 6b reconciliation r2

```text
REVIEW_TARGET=WHOLE_BATCH_6B_RECONCILIATION
STATUS=MATCHED
M/S/N=0/0/0
REVIEWER_KIND=FRESH_INDEPENDENT_SUBAGENT
REVIEWER=/root/batch1_6b_status_consistency_r2
SCOPE=REQUIREMENT+DESIGN/IA+PROJECT_MEMORY_STANDARDS+CURRENT_IMPLEMENTATION_SOURCE
SOURCE_SET_FILES=466
SOURCE_SET_SHA256=949a7d6d690183d2d75c15c1ab8c93f0b52b733aef6519461f11d93e1d1f0b19
SOURCE_SET_METHOD=the exact Node command below; sorted repo-relative paths, each framed as path NUL byte-length NUL raw-bytes NUL
DYNAMIC_PROOF=NOT_RUN_BY_REVIEW
```

## Deterministic source-set command

Run from the repository root. The set binds requirements, design/IA, current project-memory standards,
relevant production/test/generator/gate sources and the completed third-party API audit. Volatile
review/status outputs are deliberately excluded from this source identity to avoid self-referential
hashes; the reviewer must still read those records for gate-state consistency.

```sh
node <<'NODE'
const {execFileSync} = require('node:child_process');
const {readFileSync, statSync, existsSync} = require('node:fs');
const {createHash} = require('node:crypto');
const include = [
  'AGENTS.md', 'CLAUDE.md', 'PLATFORM-BLUEPRINT.md',
  'doc/platform/README.md', 'doc/platform/backend-coding-standard.md', 'doc/platform/frontend-coding-standard.md', 'doc/platform/terminal-coding-standard.md', 'doc/platform/implementation-task-template.md',
  'scripts/README.md', 'scripts/verify',
  'doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md',
  'doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md',
  'doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-plan-codex.md',
  'doc/plans/platform/2026-09-23-v2s-store-terminal-management-requirements-claude.md',
  'doc/plans/platform/2026-09-23-v2s-store-terminal-management-ia-codex.md',
  'doc/plans/platform/2026-09-23-v2s-store-terminal-management-ui-interaction-design-codex.md',
  'doc/plans/platform/2026-09-24-v2s-store-terminal-management-implementation-design-codex.md',
  'doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md',
  'doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md',
  'doc/decisions/2026-08-13-v2s-backend-acceptance-standard.md',
  'doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md',
  'doc/decisions/2026-07-24-v2s-verification-governance.md',
  'doc/review/platform/2026-09-28-v2s-terminal-activation-tds-third-party-usage-audit-codex.md',
  'scripts/test/backend-acceptance', 'scripts/test/backend-acceptance-structure.test.mjs',
  'scripts/test/r5-remote-testcontainers.mjs', 'scripts/test/r5-remote-testcontainers.test.mjs',
  'scripts/test/terminal-ws-wire-client.mjs', 'scripts/test/store-terminal-l2-admission.mjs', 'scripts/test/store-terminal-l2-admission.test.mjs',
  'scripts/dev/r5-dev-runner.mjs', 'scripts/dev/r5-dev-environment.mjs', 'scripts/dev/r5-remote-java.mjs',
  'scripts/env/tds-dev-capacity.json',
  'contracts/policy/store-terminal-l2-admission.json',
  'contracts/protocol/terminal-connection-protocol.json',
  'contracts/openapi/paths/terminal/activation.paths.json'
];
function rgFiles(roots) {
  const dirs = roots.filter(path => existsSync(path) && statSync(path).isDirectory());
  if (!dirs.length) return [];
  const out = execFileSync('rg', ['--files', ...dirs], {encoding: 'utf8'}).trim();
  return out ? out.split('\n').filter(Boolean) : [];
}
const files = new Set(include.filter(path => existsSync(path) && statSync(path).isFile()));
for (const path of rgFiles(['project-memory'])) files.add(path);
for (const path of rgFiles(['apps/backend/terminal-data-server'])) files.add(path);
for (const path of rgFiles(['apps/backend/catering-business-server/src/main/java', 'apps/backend/catering-business-server/src/test/java'])) {
  if (/Terminal|terminal|StoreTerminal|storeterminal|Acceptance|Tds/.test(path)) files.add(path);
}
for (const path of rgFiles(['apps/frontend/operations-admin/src/features/store-terminal'])) files.add(path);
for (const path of rgFiles(['contracts/openapi-source', 'contracts/openapi'])) {
  if (/terminal|Terminal|store-terminal|StoreTerminal|edge|operation|generated|binding|capability|heritage|runtime-environment|frontend-architecture/.test(path)) files.add(path);
}
for (const path of rgFiles(['contracts/registry/generated/operation-handler-bindings'])) files.add(path);
for (const path of rgFiles(['tools', 'scripts/check', 'scripts/generate', 'scripts/test', 'scripts/dev', 'scripts/env'])) {
  if (/terminal|Terminal|store-terminal|StoreTerminal|edge|operation|r5|verify|module|performance|openapi|generated|binding|capability|heritage|runtime-environment|frontend-architecture|backend-acceptance|test-health|tds-dev-capacity/.test(path)) files.add(path);
}
const sorted = [...files].filter(path => { try { return statSync(path).isFile(); } catch { return false; } }).sort();
const hash = createHash('sha256');
for (const path of sorted) {
  const bytes = readFileSync(path);
  hash.update(path); hash.update('\0'); hash.update(String(bytes.length)); hash.update('\0'); hash.update(bytes); hash.update('\0');
}
process.stdout.write(`COUNT=${sorted.length}\nSHA256=${hash.digest('hex')}\n`);
NODE
```

The main agent's read-only enumeration returned `COUNT=466` and the aggregate digest in the header.
The fresh reviewer must independently run or reconstruct this exact enumeration and confirm its
count/digest before using it as the reconciliation identity.

## Verdict

Fresh reviewer `/root/batch1_6b_status_consistency_r2` independently reproduced the source set as
466 files with SHA-256
`949a7d6d690183d2d75c15c1ab8c93f0b52b733aef6519461f11d93e1d1f0b19` and returned
`WHOLE_BATCH_6B_RECONCILIATION=MATCHED`, `M/S/N=0/0/0`. CP-03/04 were reconciled as part of the
whole batch, as Dexter directed; neither received a standalone review.

The reviewer initially cited the older CP-05 r6 record. Main-agent source readback found that record
predated the 09:01 preflight fix; the reviewer followed up read-only, corrected the citation to the
current CP-05 r2 report, and confirmed the 6b verdict remains MATCHED. The digest is unchanged
because review-output records are explicitly outside this source-set identity.

## Per-CP disposition and evidence

- **CP-01 MATCHED:** the R3 repair record closes the authorized design-input reconciliation at
  `doc/review/platform/2026-09-26-v2s-terminal-activation-batch-1-r3-repair-record-codex.md:14,35-57`.
- **CP-02 MATCHED:** `doc/review/platform/2026-09-27-v2s-terminal-activation-batch-1-cp02-reconciliation-codex.md:3-11,25-33,60-64`.
- **CP-03 MATCHED:** activation remains public with no authorization at
  `contracts/openapi/paths/terminal/activation.paths.json:9-18,33,79`; the controller has no session
  or permission dependency at
  `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/terminal/TerminalActivationController.java:15-31`.
- **CP-04 MATCHED:** required TDS limits are in
  `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/config/TdsRuntimeSettings.java:6-19,28-64,89-107`;
  authentication/session and actor replacement ordering are covered in
  `TdsWebSocketHandler.java:88-169` and `TdsTerminalSessionActors.java:254-380`;
  PMD boundaries are in `TdsPmdOfferGate.java:54-95` and `TdsBoundedPmdDecoder.java:40-176`.
- **CP-05 MATCHED:** current full-stage report is
  `doc/review/platform/2026-09-28-v2s-terminal-activation-batch-1-cp05-reconciliation-r2-codex.md:3-19,21-49`;
  the current 6c preflight evidence repair and 37 focused runner tests are included.
- **CP-06 MATCHED:** `doc/review/platform/2026-09-28-v2s-terminal-activation-batch-1-cp06-reconciliation-codex.md:3-24,73-81,100-114`.

- The 296-operation identity denominator is confirmed by
  `contracts/policy/backend-performance-operation-counts.json:1-14` and
  `contracts/registry/generated/operation-handler-bindings/index.json:1-20`.
- The ordinary pre-calibration stop remains expected, not a green baseline: implementation plan
  `:134-140`; current execution status; and the 6c record's pre-calibration section.
- The TDS third-party audit remains an implementation constraint and explicitly does not establish
  runtime behavior: `doc/review/platform/2026-09-28-v2s-terminal-activation-tds-third-party-usage-audit-codex.md:3-10,14-24,38-66,118-125`.

## Evidence boundary

The reviewer ran only the read-only source-set hash command and static source/document inspection.
It ran no tests, builds, verify gates, SSH, tunnels, remote resource queries, DEV/TDS, backend
acceptance, Browser L2, reset, seed, or UAT. A separate 6c admission is still required before the
first current-byte managed run; this verdict does not claim dynamic proof.

## Required decision

Independently reconcile every CP-01..CP-06 requirement/design/IA/memory/source row. CP-03 and CP-04
have no separate stage review by Dexter's direction; include their full scope here. Read the source
and required memories before prior review outcomes. Verify that pending/current status is consistent
across the execution status, CP-06 record, dynamic-front admission and 6c admission. The older
`2026-09-28-v2s-terminal-activation-batch-1-6b-reconciliation-codex.md` is explicitly historical.

Return `WHOLE_BATCH_6B_RECONCILIATION=MATCHED|OPEN`, `M/S/N`, per-CP disposition, repo paths and
line evidence, reproduced source-set count/hash, and `NOT_COVERED` dynamic boundaries. Do not run
tests, builds, verify, SSH, tunnels, managed services, backend acceptance, Browser L2, reset or seed.
The main agent alone records the final verdict and proceeds only on `MATCHED`.
