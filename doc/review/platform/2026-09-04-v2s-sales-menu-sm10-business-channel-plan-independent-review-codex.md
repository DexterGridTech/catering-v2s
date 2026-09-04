# SM-10 BusinessChannel seed plan independent review

REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=2026-09-04-sales-menu-sm10-business-channel-plan-microstep
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ACTION_1_VARIANT=1-A code extraction
VERDICT=GO
M/S/N=0/0/0

## Blind review declaration

This is a fresh, adversarial, read-only review of the current bytes of
`scripts/dev/external-collaboration-business-channel-seed-plan.mjs`. I formed
the findings below from the plan, its declared static validator, and the
required design/memory inputs before reading any author disposition. I did not
modify implementation, start DEV/Testcontainers/L2/UAT, run reset/seed, or
perform repository-control actions. The only write made by this review is this
artifact.

Scope is deliberately limited to the completed static BusinessChannel **plan**
microstep. It does not review the future HTTP materializer, parent r5-full
composition, sales-menu seed plan, or any dynamic evidence.

## Input checklist

Read inputs:

- `AGENTS.md` — repository entry, independent-step reconciliation, owner and
  dynamic-evidence boundaries.
- `PLATFORM-BLUEPRINT.md` — owner sovereignty, no direct cross-owner writes,
  static closure before dynamic verification, and reset/seed boundary.
- `doc/platform/README.md`, `doc/platform/roadmap-program-registry.json`, and
  `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` — the active
  program and authorization source; Dexter's direct review assignment is the
  scope for this review.
- `project-memory/decisions/deterministic-context-only.md` — deterministic
  source-first review discipline.
- all six `project-memory/kernel/*.md` files from `project-memory/index.md`.
- `project-memory/decisions/independent-subagent-adversarial-review.md` and
  `project-memory/operations/verification-governance.md` — fresh blind review
  and severity rules.
- `project-memory/operations/test-closed-loop.md`,
  `project-memory/operations/execution-economics-and-failure-family-closure.md`,
  `project-memory/operations/dev-command-separation.md`, and
  `project-memory/decisions/r5-full-seed-report-api-db-accounting.md` — static
  versus dynamic evidence, denominator, seed and cleanup rules.
- `project-memory/decisions/owner-read-model-and-lifecycle-standard.md` and
  `project-memory/decisions/confirmed-business-language-corpus.md` §G-11 —
  owner facts and the sales collection/channel boundary.
- `doc/platform/review-standard.md` and `.agents/skills/cs-review/SKILL.md`.
- `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md`
  §§10b and 12.
- `contracts/collaboration/external-platform-catalog.json`, consumed as the
  plan's read-only input.
- `scripts/dev/external-collaboration-business-channel-seed-plan.mjs`.

Memory route executed:

```text
scripts/context/recall-memory --task-kind review --domain backend \
  --consumer-face operations-admin --owner backend --impact evidence \
  --trigger review
```

Relevant current-byte hashes:

```text
AGENTS.md                                                        5caa9b1724eb678dfe5ebb48a96a8290ae8747d36920c072fdc404fa9009dcc6
project-memory/decisions/deterministic-context-only.md          c65c6aafd38d34c9ec937ad793a3d7dcf99bdda9ae3e407731b4eaf786170263
doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md da52ac8d9abc456476464e041c2789b48f2de4d98463a71c7fa4737ed3c1046f
contracts/collaboration/external-platform-catalog.json          7d08da4116dacd12a4e62c8a2d691b451e5a54dfb5b6c00d116e91311d80be44
scripts/dev/external-collaboration-business-channel-seed-plan.mjs f14592a0a489811c10554549fd94609d43743483423cf0fb3dfe3fb85b51c08c
```

## Adversarial starting hypotheses

1. The new DINE_IN data may still be only a template, which would reproduce the
   earlier false-green prerequisite.
2. The sales-menu eligible set may admit an EXTERNAL, PROJECT, disabled, or
   GROUP_BUY form through a weak filter.
3. A negative form may have been silently removed while adding the two positive
   channels.
4. The static plan may conceal new product semantics, a direct database path,
   or a seed-to-L2 runtime coupling.

All four hypotheses are rejected by the current source facts below; no finding
remains in this microstep.

## Action 1-A: extracted current-source facts

This is a declarative seed plan and has no UI-rendered output. The extracted
implementation facts are therefore its actual plan members, relationships, and
validator behavior:

1. `entities.templates` and `entities.channels` are distinct arrays
   (`external-collaboration-business-channel-seed-plan.mjs:65-75`). The three
   DINE_IN templates are not counted as channels.
2. The plan has seven actual channel members. Its exact expected member list is
   `expectedChannels`, and `validate` requires the channel count, unique codes,
   and every member's name, owner, order kind, access kind, status, template and
   binding relation to match (`:234-319`, `:342-368`).
3. The two required positive channel instances are actual `channels[]` entries:
   `CHANNEL-STORE-INTERNAL-DINE-IN-POS` and
   `CHANNEL-STORE-INTERNAL-TAKEAWAY`. Both are STORE-owned, INTERNAL, ENABLED,
   and use DINE_IN/TAKEAWAY respectively (`:116-139`). Each has both an owner
   relation and a channel-to-template relation (`:189-192`).
4. Eligibility is derived from actual `channels[]`, not templates: STORE +
   INTERNAL + ENABLED + `{DINE_IN, TAKEAWAY}`. The validator requires its exact
   sorted result to be only the two positive members (`:376-377`).
5. The remaining five actual channels form the exact negative denominator:
   two STORE EXTERNAL TAKEAWAY members (`:77-100`), one STORE EXTERNAL GROUP_BUY
   member (`:103-114`), one STORE INTERNAL DISABLED TAKEAWAY member
   (`:142-152`), and one PROJECT INTERNAL ENABLED TAKEAWAY member (`:155-165`).
   Their count/literals are protected by the exact member loop and explicit
   negative checks (`:343-368`, `:378-381`).
6. The plan declares `STATIC_PLAN_ONLY`, `DECLARATIVE_INPUTS_ONLY`,
   `noDirectDatabaseWrites: true`, `noRuntimeExecution: true`, and a read-only
   catalog input (`:202-215`, `:321-326`). Source scanning found no SQL/JDBC,
   HTTP/fetch, process spawning, browser/Playwright, or L2 import/call path.
   The only imports are Node crypto/fs/path/url used to validate static input.
7. The inline self-test executes the plan validator and 16 red mutations,
   including channel count/literal/owner/template/binding changes, internal
   becoming external, loss of disabled/project negatives, and loss of the
   enabled internal takeaway (`:396-427`).

## Three-dimensional reconciliation

| Required sales-menu seed precondition | Detailed-design criterion | Current source proof | Result |
| --- | --- | --- | --- |
| A template is not a channel | §10b.1 identifies the preexisting failure precisely: STORE INTERNAL DINE_IN template alone is insufficient; actual INTERNAL DINE_IN/TAKEAWAY instances are required. | Separate arrays; the two positive entries are concrete `channels[]` members with `CHANNEL_TEMPLATE` and `OWNER_NODE` edges. The validator builds eligibility from `channels`, not `templates`. | MATCHED |
| Exact eligible set | §10b.3 requires eligible enabled INTERNAL DINE_IN and eligible enabled INTERNAL TAKEAWAY, with INTERNAL/EXTERNAL explicitly separated. | The filter is `STORE ∧ INTERNAL ∧ ENABLED ∧ (DINE_IN ∨ TAKEAWAY)` and its exact member set is asserted as DINE_IN-POS plus INTERNAL-TAKEAWAY. | MATCHED |
| PROJECT INTERNAL remains negative | §10b.3 retains project-level forms as negative. | `CHANNEL-PROJECT-INTERNAL-TAKEAWAY` is an actual PROJECT channel; the STORE predicate excludes it and the validator requires its presence. | MATCHED |
| STORE GROUP_BUY remains negative | §10b.3 retains other order kinds as negative. | One STORE GROUP_BUY actual channel is retained; `GROUP_BUY` is outside the eligibility order-kind set and its exact count is asserted. | MATCHED |
| EXTERNAL TAKEAWAY remains negative | §10b.1 prohibits renaming EXTERNAL TAKEAWAY to pretend it is INTERNAL; §10b.3 requires no INTERNAL/EXTERNAL mixing. | Both original STORE EXTERNAL TAKEAWAY actual channels remain; eligibility requires INTERNAL and the validator requires exactly two STORE EXTERNAL TAKEAWAY negatives. | MATCHED |
| Disabled INTERNAL TAKEAWAY remains negative | §10b.2/10b.3 require enabled/disabled branches. | The distinct disabled actual channel remains; eligibility requires ENABLED and the validator requires the disabled negative. | MATCHED |
| No new semantic, direct-DB, or seed-L2 coupling | §10b.1 keeps this owner plan separate from sales-menu; §10b.4 and §12 prohibit unapproved dynamic work and unrelated semantics. | This file only declares/validates business-channel prerequisites. It neither creates a new operation nor accesses a database/network/browser; it contains no L2 dependency. It does not add POS/QR/KIOSK action semantics, UNKNOWN persistence, terminal/TDP behavior, or a sales-menu-side copy of channel facts. | MATCHED |

## Same-root scan

The complete scoped denominator is the seven `expectedChannels` members; each
was checked against the current plan entry and validator:

1. `CHANNEL-STORE-TAKEAWAY-MEITUAN` — retained EXTERNAL TAKEAWAY negative.
2. `CHANNEL-STORE-TAKEAWAY-ELEME` — retained EXTERNAL TAKEAWAY negative.
3. `CHANNEL-STORE-GROUP-BUY-MEITUAN` — retained STORE GROUP_BUY negative.
4. `CHANNEL-STORE-INTERNAL-DINE-IN-POS` — required eligible positive.
5. `CHANNEL-STORE-INTERNAL-TAKEAWAY` — required eligible positive.
6. `CHANNEL-STORE-INTERNAL-TAKEAWAY-DISABLED` — retained disabled negative.
7. `CHANNEL-PROJECT-INTERNAL-TAKEAWAY` — retained PROJECT-level negative.

The remaining zero members are unreviewed. The validator makes the denominator
closed: it requires exactly seven unique channel codes and independently checks
the eligible subset and all four negative categories. The additional DINE_IN
templates POS/QR/KIOSK are also checked as templates only; only POS is an
actual channel, which is consistent with the required distinction.

## Static proof and evidence boundary

Executed read-only static proof:

```text
node scripts/dev/external-collaboration-business-channel-seed-plan.mjs --self-test
EXTERNAL_COLLABORATION_BUSINESS_CHANNEL_SEED_PLAN_SELF_TEST=PASS SCENARIOS=14 RED_CASES=16
```

This is static source/validator proof only. It does **not** prove:

- a future business-channel generated-HTTP executor can materialize these
  declarations and obtain owner readback;
- r5-full parent composition, run-scoped report correlation, or child/parent
  cleanup;
- any reset/seed execution, DEV, Testcontainers, browser L2, or UAT result.

Those are outside this review's user-visible scope and remain
`NOT_RUN_AWAITING_SEPARATE_AUTHORIZATION`; they are not promoted by this GO.

## Findings and verdict

No M/S/N findings in the requested static-plan scope.

## Verdict block

REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A code extraction
VERDICT=GO
M/S/N=0/0/0
L1_ENGINEERING=PASS; exact plan members, relation topology, static authority flags, and red-mutation validator match the scoped design requirements
L2_USER_VISIBLE=NOT_APPLICABLE_TO_DECLARATIVE_SEED_PLAN_SCOPE
L3_UNVERIFIED=空 for user-visible output; generated-HTTP materialization, r5 composition, dynamic seed, business and cleanup evidence are explicitly NOT_RUN and out of scope
SAME_ROOT_SCAN=PASS; all seven actual channel members plus the three DINE_IN templates were checked, with zero remaining actual channel members
DESIGN_GAPS=空
EVIDENCE_TIER=STATIC_SOURCE_AND_INLINE_RED_MUTATION_SELF_TEST_ONLY; NO_DYNAMIC_RUNTIME_EVIDENCE
