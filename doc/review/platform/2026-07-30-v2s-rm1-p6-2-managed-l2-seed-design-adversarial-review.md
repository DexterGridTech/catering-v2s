---
title: RM1 P6-2 managed isolated L2 seed design independent adversarial review
REVIEW_CYCLE_ID: RM1-P6-2-L2-SEED-DESIGN-20260730
REVIEW_ROUND: 2
REVIEW_ROUND_LIMIT: 2
ROUND_FINAL_DECISION: SELF_DECIDED
REVIEW_TARGET: DESIGN
reviewerKind: INDEPENDENT_SUBAGENT
reviewerStance: BLIND_FALSIFICATION_FIRST
scopeTrigger: Dexter authorized managed isolated L2 plus seed, without reset
---

# RM1 P6-2 managed isolated L2 seed design independent adversarial review

## 1. Verdict

`GO` for **static implementation-facing design admission only**: `M=0 / S=2 /
N=1`.

This verdict does not authorize a dynamic run by itself, does not make the
historical full R5 seed executable, and does not close P6-2.  The following
implementation still has to retain a run-scoped manifest, actual phase/log
readback, separate `BUSINESS` and `CLEANUP` outcomes, nine real browser cases,
and a fresh `REVIEW_TARGET=IMPLEMENTATION` cycle after the Dexter-authorized
scope extension.

## 2. Independent input inventory and blind-review declaration

I reopened the following source bytes before comparing the author remediation.
Round 1 was a blind falsification of the originally created design bytes; round
2 was a directed falsification of the repaired design.  No dynamic command was
run and no implementation source was modified by this reviewer.

| Input | Round 1 SHA-256 | Round 2 SHA-256 |
| --- | --- | --- |
| `doc/evidence/platform/rm1/p6/rm1p6-u02-managed-l2-seed-and-runner-design.md` | `7707e6f0ae502465af1497b78f970e54115767d789736ae55250486f2bed002c` | `cdbbacc940fe11c05c60eb00a38a282dc7228b12ff5e229acb7c941ce83e59ca` |
| `contracts/policy/affected-l2-registry.json` | `e518ec0546d91d92c0e8b15099ac5cda6c78dc75c35d4646949b0c058455eb4d` | `e518ec0546d91d92c0e8b15099ac5cda6c78dc75c35d4646949b0c058455eb4d` |
| `scripts/dev/r5-dev-runner.mjs` | `c4f97ca2930ff48cf82074fd5fe19c16bbce746587db22e072c90cff9c0bc37a` | `c4f97ca2930ff48cf82074fd5fe19c16bbce746587db22e072c90cff9c0bc37a` |
| `scripts/dev/r5-dev-environment.mjs` | `f5da86350429b19d1f21bb3b271cefc37e174226046102997a4aeaec126299f8` | `f5da86350429b19d1f21bb3b271cefc37e174226046102997a4aeaec126299f8` |
| `scripts/dev/r5-seed-bootstrap.mjs` | `245cf218456dc849ad0baa691307c25f0f5aa26135a8794f6ad739ad652b2dc9` | `245cf218456dc849ad0baa691307c25f0f5aa26135a8794f6ad739ad652b2dc9` |
| `apps/backend/catering-business-server/src/main/resources/application.yaml` | `0ad669ec0c2bfedbeac00ff7918bc4276c569412856a14814bde0fb41c0938d4` | `0ad669ec0c2bfedbeac00ff7918bc4276c569412856a14814bde0fb41c0938d4` |
| `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceInvitationService.java` | `6919ee7c9c3b2a3c31f31579db729d3627b84ae056a8ab9c6e07404db0449bb6` | `6919ee7c9c3b2a3c31f31579db729d3627b84ae056a8ab9c6e07404db0449bb6` |
| `contracts/openapi/paths/platform-admin/group-workspace-management.paths.yaml` | `a7a3ff9ae40dc37e21bbb321b91afff9f81177640b8d3edeec32fd3e10586107` | `a7a3ff9ae40dc37e21bbb321b91afff9f81177640b8d3edeec32fd3e10586107` |
| `contracts/openapi/paths/platform-admin/commercial-group.paths.yaml` | `30aebcc28c9fb052d76017c301ab9521c0c7d11f42190328a203799fcfa7d373` | `30aebcc28c9fb052d76017c301ab9521c0c7d11f42190328a203799fcfa7d373` |
| `contracts/openapi/paths/platform-admin/workspace-access.paths.yaml` | `efda9f6e4e563bd84238b53a5a17286dd0a767034c09457c46d1c9c7846d512b` | `efda9f6e4e563bd84238b53a5a17286dd0a767034c09457c46d1c9c7846d512b` |
| `contracts/openapi/paths/platform-admin/role-management.paths.yaml` | `509c419bab127259757772b3ecf82bfd5a0b285df6ae7204a014dbdf57b817ff` | `509c419bab127259757772b3ecf82bfd5a0b285df6ae7204a014dbdf57b817ff` |
| `contracts/openapi/paths/platform-admin/extension-definition.paths.yaml` | `d191187a6cda1ad25fe8996e7ee052c598a8fe1858311c5e315bb8ebf1d508ec` | `d191187a6cda1ad25fe8996e7ee052c598a8fe1858311c5e315bb8ebf1d508ec` |
| `contracts/openapi/paths/public/invitation-acceptance.paths.yaml` | `8c8960425450f55148bac8df8eb8a6082176c24695b87048d06cc29144e0cc5e` | `8c8960425450f55148bac8df8eb8a6082176c24695b87048d06cc29144e0cc5e` |
| `contracts/openapi/paths/operations-admin/workspace-auth.paths.yaml` | `9a454d47429be7bc3a80f86ef9b7fa8a42526eccc81b0da3c1cd65267c5b692b` | `9a454d47429be7bc3a80f86ef9b7fa8a42526eccc81b0da3c1cd65267c5b692b` |
| `contracts/openapi/paths/operations-admin/{organization-hierarchy,brand-management,tenant-management,head-company-management,store-management,contract-management}.paths.yaml` | `a5aec0c0ddcf871d6d58c9f582cd9d8312de363f2b71a83a51a093a9c666b027;7552a618a656ac4c77afc0661bbb804b64ea8ea7f799a5a3b6e1363abdb08319;3aa365396a249cf037062dd0481f436182baaf25024c8e657879a6b0f19acd63;1a9d1c85a1f2f3c1d3d6c267651f8eeb543aaf7f9ae2446b8e6915e8133f7f12;c29dfe739ac702ceb306e5f63426f891d5f3e75ca402f5262073a2127cec7462;af7a65f2252af1047c439c88e08e176ec27cac207d2de43b2218d703ee4f54d6` | same as round 1 |
| `apps/frontend/platform-admin/src/tests/l2/{authentication,workspace-management,workspace-overview,platform-admin-management,organization-overview,contract-overview,role-management,workspace-account-management,extension-field-management}.spec.ts` | `c7c92806dc9905d1539fb7fe1df87b242bc77cd03cc562988ee8d82450ea7a30;84c4d52cc0c094094e9aca684c84cec11457e1b4bc5f81bb18d937d5c2d194e9;45f503d7d4c9168ee30369ffc030f59d40ebeffecc5ad420f3f0673ab789a298;076876303d66a014dbe36515c13a4571d4e1c6fe686177bd51238f19c8ea7353;995364366035e22276a3b308ff926fcfeb5ebb40aa086aa96592f4c42bf4cc93;7fcc3195cd07bf69368f2c70d70a4ca4472aa0b677bb9fc1437af73cefbb86c6;9f8af86234efa4f8e4931c401d08e768610cd57a12cc69ead886bec80d92850e;a9339817e15f0e0de55d6f6e1a1a8afae18f4809a9867fc13a0abdc42a1e948a;f84d059f9bed5dca162dad19f00160ca7e3cc64dcc5e725d82ef1cf98a3af966` | same as round 1 |
| `apps/frontend/platform-admin/src/tests/l2/platformL2.ts` | `d9dabcb583be30a226be88c0baf83882148b981bd8e1ebcf300c713568ac88c8` | `d9dabcb583be30a226be88c0baf83882148b981bd8e1ebcf300c713568ac88c8` |

The first-round design byte hash above is retained by the compliant pre/post
hook receipt.  The unchanged-source hashes were rechecked in round 2.  This is
not a test result or a claim that the proposed runner has executed.

## 3. Round-1 finding dispositions, independently verified

| ID | Round-1 result | Round-2 disposition evidence |
| --- | --- | --- |
| M1 — OTP did not exist on the described path | `CONFIRMED` | Design §2 now confines `CATERING_OTP_DEBUG_CODE_EXPOSURE=true` to this isolated L2 start, uses only the one send-OTP response, fails closed on an absent response code, and forbids OTP persistence. This matches `application.yaml`’s false default and `WorkspaceInvitationService#sendPublicOtp`, whose returned debug code is conditional on that configuration. |
| M2 — existing DB could be reused and global emptiness could not be proven without forbidden SQL | `CONFIRMED` | Design §2 now requires a generated namespace/runtime directory and requires the modified managed provision step to return `freshDatabase=true` only when it creates the requested database. It refuses an already-existing database before process or owner HTTP activity; it does not add ordinary-fact SQL. This is the smallest valid repair to current `r5-dev-environment.mjs` default namespace and `r5-dev-runner.mjs` create-if-absent behavior. |
| S1 — password wrongly claimed to be readback/public fixture data | `CONFIRMED` | Design §4 separates a readback-only redacted fixture JSON from the one-shot private child-process credential environment and expressly forbids recording a password or password hash. |
| S2 — no observable readiness/first-failure boundary | `CONFIRMED` | Design §4 now requires a bounded readiness phase before bootstrap/seed, owned PID-tree and log checks, elapsed phase output, bounded last-log readback, and managed stop on first failure. This matches the observability decision’s process/manifest/log requirements. |
| N1 — no frozen independent-review inputs | `CONFIRMED` | Design §8 requires a path-plus-hash inventory; this review supplies the two-round immutable inventory above. |

## 4. Residual findings

### S1 — scoped OTP exposure must be enforced against ambient environment inheritance

`scripts/dev/r5-dev-runner.mjs` currently forms the backend child environment as
`{...process.env, ...entry.env}`.  Therefore an ambient
`CATERING_OTP_DEBUG_CODE_EXPOSURE=true` would also reach an ordinary `scripts/dev/start`
invocation, contrary to the design’s statement that all starts other than the
isolated L2 run retain false.

This does not invalidate the proposed L2 fixture: a minimal r5-runner update can
force the effective value to `false` by default, accept a purpose-specific
isolated-L2 flag only from `scripts/test/r5-platform-admin-l2.mjs`, and record
only the boolean scope classification.  It is nevertheless security-sensitive
and must be implemented with a focused positive/red proof before dynamic
acceptance.  It is a `S`, not an `M`, because the design names the desired
scope, no production/public environment is authorized, and the correction is
local to the already declared runner source denominator.

### S2 — unique database/runtime isolation does not yet serialize the fixed local ports

The current runner fixes the SSH local forwards at `25432`/`29000`, launches the
business server at its default port, and both Vite configs use strict fixed
ports (`5174` and `5175`).  A second independent runtime directory would avoid
a manifest collision but not a local-port collision.  The revised design’s
readiness phase will fail before owner HTTP activity, so this is fail-closed,
but the implementation must add an explicit managed-run admission check/global
lock (or purpose-bound dynamic port map) before starting processes.  It must
not kill by port.  This remains `S`: it is an availability/diagnostic gap, not
a route for business-fact mixing or reset.

### N1 — role page-access keys remain intentionally minimal but must be explicit in code

`WorkspaceRoleCreateRequest` requires a non-null `pageAccessKeys` array, while
the seed’s owner-command chain uses capabilities directly.  The current owner
validator permits an empty compatible array, so this is not a contract blocker.
The implementation should still write the chosen array explicitly (normally
`[]`) and log only its count; it must not invent page access from capability
names.

## 5. Boundary recheck

- The active P6-2 registry denominator has nine real platform-admin browser
  files; static or unit proof remains non-substitutable.
- The fixture creates the workspace account/assignment through the public
  invitation lifecycle and uses the commercial-group command readback as its
  target reference.  It does not directly write ordinary facts or assignments.
- P6-3 remains `PENDING_FUTURE_UNIT`: no P6-3 UI, browser case, or acceptance
  claim is pulled into this delivery unit.
- `scripts/dev/reset`, database deletion, port killing, hidden IDs in fixture
  output, cookies, OTP, passwords, grants and raw payload logging remain
  excluded.

## 6. Required implementation-review focus

The fresh post-implementation reviewer must reopen real script bytes and dynamic
evidence to verify: unique fresh DB refusal before commands, protected OTP scope
and absent-code red, private credential non-persistence, port-admission
behavior, all nine browser cases, actual log/manifest readback, and separate
business/cleanup PASS.  A design `GO` cannot substitute any of these proofs.
