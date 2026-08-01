---
title: RM1 P6-1 credential ingress and face isolation implementation adversarial review
reviewTarget: IMPLEMENTATION
reviewCycleId: RM1-P6-1-CREDENTIAL-INGRESS-AND-FACE-ISOLATION-IMPLEMENTATION
reviewRound: 2
reviewRoundLimit: 2
reviewerKind: INDEPENDENT_SUBAGENT
scope: RM1 P6-1 typed recovery-cookie ingress and platform/operations face-local session isolation
verdict: NO-GO
findings: M=1 / S=0 / N=1
createdAt: 2026-07-30
authorizationBoundary: Static read-only adversarial review only. It authorizes neither implementation changes nor dynamic execution, DEV, seed, reset, Roadmap/control-state changes, or repository-control actions.
---

# RM1 P6-1 credential ingress and face isolation — IMPLEMENTATION adversarial review

## 0. Independent-review metadata

- `REVIEW_CYCLE_ID=RM1-P6-1-CREDENTIAL-INGRESS-AND-FACE-ISOLATION-IMPLEMENTATION`
- `REVIEW_TARGET=IMPLEMENTATION`
- `REVIEW_ROUND=1`
- `REVIEW_ROUND_LIMIT=2`
- `reviewerKind=INDEPENDENT_SUBAGENT`
- **Blind declaration**: I first reopened the current production bytes, production/test controls, package inventory,
  and run evidence to try to falsify the five review assertions. I read the prior Claude finding and remediation
  design as required contextual input only after that source-first pass; no author verdict was adopted as a fact.

### Input checklist (path + SHA-256 at review time)

| Input | SHA-256 |
| --- | --- |
| `AGENTS.md` | `e4e3c9af4fb0dc46ce5403edadb6704d1d4a60dea186efc9cbe22dd62fddb347` |
| `PLATFORM-BLUEPRINT.md` | `29bcd8930f9ce75627ca32902f7fabc40c2c93c611e15db6a416cf7d8e3fab4d` |
| `doc/platform/README.md` | `809f9567df2048bfe40c254c6a613dae7535a6fdebb802f8a06b1e15ebd3687e` |
| `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` (`CURRENT_*`) | `5476287821b966d28fb024ac400de7a6e1a86ff61b76c26a4667dd404d31c938` |
| `project-memory/index.md` | `db1c079656221a38bf77cca0272b5b01c25660d8c563c49088b6f5256231568b` |
| all six `project-memory/kernel/*.md` | `f8add1ef…`, `45a26072…`, `f01d8e4e…`, `1f6d9efb…`, `d0d75e54…`, `5c52b17a…` |
| routed memory: deterministic context, independent review, business corpus, topology, read policy | `4c98ed79…`, `891fc8de…`, `51415f7d…`, `c578afa2…`, `04d93294…` |
| `scripts/README.md` / standards matrix | `194b7ee6…` / `7d390eb6…` |
| Claude P6-1 implementation review / remediation design | `efa7a18…` / `14bb675d…` |
| U14 manifest / package input / source disposition / focused proof | `11b44626…` / `61e7a0a4…` / `707e79e6…` / `e573d75c…` |
| reopened ingress, resolver, controller and owner sources | `68ccec70…`, `ec7aaa2b…`, `b26a9883…`, `8592daee…`, `9bd98df4…`, `f3e25d42…`, `f63c45dd…`, `c371b993…`, `ec49e509…`, `40a32df0…` |
| reopened tests, red fixtures and controls | `54babd50…`, `5b3fe9f0…`, `9e382f9f…`, `983016de…`, `4aaf810a…`, `7f9a8e7f…`, `dbe18bdd…` |
| managed-run manifest / remote result / control record | `7f1d0c23…` / `58338e3a…` / `634f90e2…` |

#### Expanded grouped-input mapping

- kernels: `01-workspace-and-roadmap=f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63`,
  `02-service-shape-and-owner=45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032`,
  `03-transaction-data-and-dependencies=f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44`,
  `04-contract-consumer-and-admin=1f6d9efbe0208f5b164d12effd4a4c4ab8f2c297b9b000462dc96820c3efa88d`,
  `05-evidence-runtime-and-git=d0d75e547400145ef7e764d735bc86e2fdaa5ea8a0b19ace213170b527d65a05`,
  `06-heritage-and-change=5c52b17aad29ba9d78e327ebe550a740d73f97402041c9f4d31c8df38615566c`.
- routed memory: `deterministic-context-only=4c98ed79b0c8e4694893a29ed977fd2eccea6c1562f2d62f32c06dcbb5ac7e20`,
  `independent-subagent-adversarial-review=891fc8de061560796dc682c5749d73a5d47029592fca197f09f032e3018b4daf`,
  `confirmed-business-language-corpus=51415f7d3b024967b10d89414534deb16c1c09e5eced2883f3573d98891b4503`,
  `distributed-topology-is-not-current=c578afa258d1a7cb610aa87f8a80f5693f0477cfebd0795c8a5c863633c7664e`,
  `business-corpus-adoption-and-read-policy=04d9329413131e369e8c1ea841f172d4c295f953b07b9768a0e597405fd28353`.
- actual sources: `EdgeRequestContext=68ccec705b30393072966703b1a5a6398a16611b23b2f47b3b748de19bbf1bce`,
  `EdgeRequestContextArgumentResolver=ec7aaa2bc58e1c95f76d673f5f0d7d1cf9a69b784af47deed2ef4d8588118545`,
  `PlatformSessionCookie=b26a9883b319fb034b3669ca8beed34a272ca478eaf67eab4ac8e96d2ac5c607`,
  `PlatformSessionResolver=8592daee840af80fa8ccbed3678ec7ea32b7d25e09e6b22ca121f77b52e32074`,
  `OperationsSessionCookie=9bd98df4e798eda49abd156acb4c92fed8b4229a51235c2b77ac4dba4f0bc2b0`,
  `OperationsSessionResolver=f3e25d426ae6197c9692f40ffdfbee4e902154de63b0accf1ce81fd21b899f3d`,
  `PlatformAuthenticationController=f63c45dd503583aa2bf1f4bed9f3e8a5e525deed4b9b932a2524ef9fcd73fb85`,
  `OperationsPasswordRecoveryController=c371b9937e2280793769a6f44d649082fff0ecc8fdde4676673859aa35d0909e`,
  `PlatformAuthenticationService=ec49e509fc59faacd1b72e7cfea8f3b81cc48cc405b96dcada9d879fdfa4f844`,
  `WorkspacePasswordRecoveryService=40a32df08a5538ab125f81b50ea75d894bb57adb9761c8f0104c0ebdb5dfe5e5`.
- tests and controls: `BackendModuleBoundariesTest=54babd50122c21abddd390e01a9257294c23a120215655bbce804ec3faefee58`,
  `OperationsDependsOnPlatformSessionFixture=5b3fe9f0c0857936f24ebadba9dff1d8041ab621ec82f9b1822628da0ea14274`,
  `PlatformDependsOnOperationsSessionFixture=9e382f9fb82ac0f53571cb70d39afaada9be906b1923d4705288dbfa9984f3ec`,
  `PlatformAuthenticationServiceTest=983016de978af22b2e471a382a155c885cb53bc8bb36980f7e01e29e7e7a5b16`,
  `WorkspacePasswordRecoveryServiceTest=4aaf810ad3aed73a8eff21ead104fe262138a25a53a19521370ce75f61fd0771`,
  `tools/code-layout/cli.mjs=7f9a8e7fa0b3041dd70de1024d9005377ff9a6cd7fc6bcaa4cfe0158d54562dc`,
  `tools/verify-gates/cli.mjs=dbe18bdd02d4926734a39a3705c5de06fb4629cacd009f74f360785f74e02b30`.
- run evidence: `run-manifest=7f1d0c23dddd1311cabab5d29e6d75b8a5c6a9943799e59751855a338bd89f7e`,
  `remote-result=58338e3a71fad3a2eca0c189d00174a1180082e2a8df5fd27456a7b6b396abd0`,
  `control=634f90e21dbf794a95e1cdbf85793b66cb86e6bceb262fec9a2453c2ce63dbaf`.

`scripts/context/recall-memory --task-kind implementation --domain backend --consumer-face backend --owner platform --impact architecture --trigger review`
was run; every returned kernel and routed memory source above was reopened. `scripts/check/standards-coverage --phase R5` is
`PASS (RULES=150)`.

## 1. What the source independently proves

### 1.1 Credential ingress and no current raw-value log escape — confirmed

The full production-Java scan found **zero** `@CookieValue` bindings. The only production `getCookies()` calls
are `EdgeRequestContextArgumentResolver:44-45`; it converts exactly the two session cookies and three recovery
cookies into opaque types. Controller recovery methods receive `EdgeRequestContext` and pass only
`platformRecoveryFlow()`, `operationsRecoveryFlow()`, or `operationsRecoveryGrant()` to the owner command.

The two session cookie wrappers and all three recovery credential wrappers have private `value`, package-private
`rawValue()`, and a redacted `toString()`. Full production consumer scanning found raw reads only at the correct
face-local resolver or the owning IAM service. No production diagnostic/logger consumer of these credential types
was found. This confirms the requested controller-visible secrecy property for current bytes.

### 1.2 Face-local resolver isolation — confirmed

`PlatformSessionCookie`/`PlatformSessionResolver` now physically and declaratively reside in
`app.edge.platform.session`; the operations pair resides in `app.edge.operations.session`. The two raw accessors
are package-private. `BackendModuleBoundariesTest` carries both directional rules and two real imported red
fixtures: platform → operations session and operations → platform session. Therefore the old shared-package
counterexample is compile-time rejected in both directions.

### 1.3 Public owner API versus package-private raw overloads — confirmed, with a scope boundary

The public owner commands take the opaque credential types. The workspace `String rawFlow/rawGrant` compatibility
overloads are package-private; the platform owner has no public raw-flow recovery command. No edge caller can
select those overloads. The public `fromEdgeCookie` factories are necessarily callable by the sole servlet adapter,
but current production consumers show that adapter is their only external caller; this review found no controller
or public route manufacturing one from a request body/header. That is a current-byte result, not a claim that a
future controller could bypass the boundary without a new control change.

### 1.4 All production Java roots are covered — confirmed

I independently walked every `apps/backend/catering-business-server/**/src/main/java` tree, excluding build
outputs: **398 Java sources across 11 roots**, with **0** declaration/path mismatches. `tools/code-layout/cli.mjs`
uses the same dynamic all-backend walk and has a `JAVA_PACKAGE_PATH_MISMATCH` self-test. The denominator is not
hard-coded, so adding a valid source does not create a false failure; moving a source without its declared package
does create a real red result.

## 2. Material findings

### M1 — declared package-exit and receipt set are absent

**Classification: CONFIRMED.**

The authorized U14 manifest declares
`rm1p6-cp-u14-p6-1-credential-ingress-and-face-isolation-package-exit.json` as a required changed source and says
completion requires *all declared sources have receipts*. The manifest is still `ACTIVE_NOT_EXIT`. The declared
package-exit file does not exist, and a same-root scan finds no U14 receipt files. The source disposition itself
marks its applicable design assertions as requiring `PACKAGE_EXIT_ASSERTION` or
`EXACT_CHANGED_PATH_AND_RECEIPT_SET`.

Thus the 398-source package/path scan and focused log are useful partial evidence, but cannot establish mandatory
equality between actual changed paths and Pre/Post-hook receipt paths, nor bind the current source disposition to a
completed package. This is an implementation-completion blocker under both the manifest and repository hook/exit
rule; it is not a historical-manifest rewrite issue.

**Minimal closure:** generate the normal U14 receipt set and package exit, enumerate every actual changed path,
and make the two sets exactly equal. Do not synthesize a substitute list by hand or change the manifest to omit its
declared exit.

### M2 — the cited remote run does not execute either modified owner test suite

**Classification: CONFIRMED.**

The focused proof claims “focused owner/architecture proof” and points to managed run
`r5-tc-1785373690163-36061`, whose task is only
`:apps:backend:catering-business-server:test`. Its collected XML inventory has the architecture and edge test
suites, but contains neither `PlatformAuthenticationServiceTest` nor
`WorkspacePasswordRecoveryServiceTest`. Those two modified tests live in independent
`modules/platform-admin-iam` and `modules/workspace-iam` Gradle subprojects; neither module build file wires its
test task into the application test task.

This matters specifically to the typed owner command and package-private raw-overload claim: the application
suite compiles against module main jars, but does not execute the owner tests that exercise recovery flow/grant
behavior. The run manifest honestly proves its own business/cleanup result
(`remoteGradleStatus=0`, `reaped=true`, `CLEANUP=PASS`) and logged stall diagnosis; it is insufficient for the
broader focused-proof sentence and must not be represented as owner-test evidence.

**Minimal closure:** use the managed runner to execute the two exact module test tasks (with the application
architecture/edge suite retained as appropriate), preserve run-scoped manifests, log inspection and cleanup records,
and list the resulting owner reports in focused proof. Bind those evidence paths and hashes in the U14 package exit
required by M1. This is not a request for an ad-hoc retry or timeout increase.

## 3. Verdict and non-regression constraints

**NO-GO — M=2 / S=0 / N=0.**

The production implementation itself resolves the prior raw-controller-cookie and face-shared-package defects:
do not restore raw controller parameters, move both resolvers into a shared package, expose raw accessors, weaken
the two directional red tests, or alter recovery/OTP/cookie protocol behavior while closing evidence.

The blockers are completion/evidence defects, not a request to redesign the typed ingress model. After M1 and M2
are closed, this `IMPLEMENTATION` cycle has one remaining independent round available for targeted verification.

## 4. Authorization boundary

This review performed static source/evidence inspection and one static standards check only. It does **not**
authorize source, contract, generated-code, test, script, evidence, DEV, seed/reset, Roadmap/state, dynamic-run,
or repository-control changes. Any remediation requires active Dexter authorization and must keep business and
cleanup evidence separate.

## 5. Round 2 final verification — SELF_DECIDED

`ROUND_FINAL_DECISION=SELF_DECIDED`

This is the second and final permitted round of
`RM1-P6-1-CREDENTIAL-INGRESS-AND-FACE-ISOLATION-IMPLEMENTATION`. I reopened the U14 package exit,
package input/manifest/source disposition, all three run manifests, the focused-proof log and the production sources;
I also independently ran the two static controls below (no dynamic environment was started by this review):

```text
node tools/compliance-control/cli.mjs validate-package-exit \
  doc/evidence/platform/rm1/p6/rm1p6-cp-u14-p6-1-credential-ingress-and-face-isolation-package-exit.json
PACKAGE_EXIT=PASS
PACKAGE_ID=RM1P6-CP-U14-P6-1-CREDENTIAL-INGRESS-AND-FACE-ISOLATION
CHANGED=32
SOURCE_DISPOSITION_ROWS=33

node tools/compliance-control/cli.mjs write-channel-reconcile
WRITE_CHANNEL_RECONCILIATION=PASS
PACKAGE_ID=RM1P6-CP-U14-P6-1-CREDENTIAL-INGRESS-AND-FACE-ISOLATION
CHANGED=33
RECOVERED=0
```

### M1 disposition — CONFIRMED_AND_REMEDIATED

The formerly absent U14 package exit is present and carries `status=PASS`, 32 changed paths and the same 32
incremental checks. Its current source-disposition hash is exact. The package-exit validator reopens the actual
hook Pre/Post records and verifies all required source/disposition/dynamic-evidence conditions; it passed above.
The separate write-channel reconciliation also passed, so the effective receipt denominator is the managed
`.runtime/compliance-control/hook-events` record set, not an optional `receipts` JSON property in the exit file.

### M2 disposition — CONFIRMED_AND_REMEDIATED

The package exit now binds both exact owner-suite manifests and their current owner-source hashes:

| Owner task | Run ID | Report independently present | Business / cleanup |
| --- | --- | --- | --- |
| `:apps:backend:catering-business-server:modules:platform-admin-iam:test` | `r5-tc-1785374449592-50269` | `PlatformAuthenticationServiceTest`, 9 tests, 0 failures/errors | PASS / PASS, reaped=true, log inspection READ:4 |
| `:apps:backend:catering-business-server:modules:workspace-iam:test` | `r5-tc-1785374537917-52041` | `WorkspacePasswordRecoveryServiceTest`, 4 tests, 0 failures/errors | PASS / PASS, reaped=true, log inspection READ:6 |

Both manifests record no first failure, `lastKnownGood=CLEANUP`, no broken boundary, and a `sourceSha256` equal
to the P6-1 run set. The older focused-proof log correctly remains the application/edge-suite record; it is not the
canonical complete dynamic-evidence list. The package exit now is that canonical binding, so the original M2 is
closed without re-labelling the application suite as an owner-suite execution.

### N1 — evidence navigation remains split

The focused-proof log does not duplicate the two owner run IDs; they are listed in package-exit
`dynamicEvidence`. This is a navigation cost only: the package exit has exact paths/hashes, the manifests exist,
and both were independently reopened. It does not weaken the current evidence or misstate test execution.

### M3 — this final review update invalidated the already-written package-exit hash

**Classification: CONFIRMED.** The U14 exit correctly validated *before* this final review document was written.
However, this review document is itself one of the exit's `actualChangedPaths`. Its exit entry still carries the
round-1 hash `c005715a…`, while the current round-2 document has a new hook-recorded hash. A final immediate
revalidation therefore fails with:

```text
PACKAGE_EXIT=FAIL
REASON=PACKAGE_EXIT_CHANGED_PATH_HASH_DRIFT:
doc/review/platform/2026-07-30-v2s-rm1-p6-1-credential-ingress-and-face-isolation-implementation-adversarial-review.md
```

This is evidence-state drift, not a regression in the implementation, raw ingress, face isolation, or the two
owner suites. But package-exit equality is a hard completion condition, so current bytes cannot be declared closed.
The minimal, bounded closure is to regenerate the same U14 package exit with this round-2 review hash and rerun
`validate-package-exit` plus `write-channel-reconcile`; no source or test change is implied. Per this cycle's
two-round limit, that mechanical author-side evidence refresh must be self-decided and must not create a third
independent review round.

**Final verdict: NO-GO — M=1 / S=0 / N=1.** The original M1 and M2 are remediated and remain so; M3 is the
post-review package-exit binding drift above. This is the final independent-review round for the approved scope.
