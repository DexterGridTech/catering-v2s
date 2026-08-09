---
reviewCycleId: OVERALL_PHASE_4_U05_REMAINING_OWNER_PROJECTIONS_DESIGN_20260809
reviewRound: 1
reviewRoundLimit: 2
reviewTarget: DESIGN
reviewerKind: INDEPENDENT_SUBAGENT
authorMaterialExcludedUntilVerdict: true
---

# BP-U05 remaining owner-projection independent blind-review input checklist | Round 1

## Blind-review instruction

I received this checklist in a fresh subagent context and first tried to falsify the reviewed
design. I formed findings and a verdict before reading any author self-review or finding
disposition. No current-cycle author intake was provided, so none was read. General preparation,
static gate output, or future L2 cannot substitute for a pointwise source review.

## Required inputs reopened

| Required input | Repository-relative path / command | SHA-256 or output | Result |
| --- | --- | --- | --- |
| AGENTS | `AGENTS.md` | `4d64bfb2bb435326a13c2ccb7955dbbbef621259030693e64db3cbf6a0bd9fda` | READ |
| Claude entry | `CLAUDE.md` | `8b12b36e0c852f3a55f40f29d3d21101b9acb113b969ff5f8a9c2152c2aec50f` | READ |
| Blueprint | `PLATFORM-BLUEPRINT.md` | `38d6138be17a514ded4188f8f71555c480eb3582abcb4f265ffa757792d9b039` | READ |
| Program registry | `doc/platform/roadmap-program-registry.json` | `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` | READ; selected `V2S_W0_W4_EXECUTION` |
| Current Roadmap and `CURRENT_*` | `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `d2490f5038f02ad40b19150a377a2188f313350d965460c3a07ab4c1c3f4eb73` | READ |
| Exact design authorization | `doc/decisions/2026-08-09-v2s-backend-performance-phase3-to-phase4-rebaseline.md` | `ea4640a9138f03e0b01f6a0c99c8feed5104cff609bcf4e97e6823bf47ffb6aa` | READ; design-only, excludes BP-U06/runtime |
| Technical-task authority | `doc/decisions/2026-08-08-v2s-backend-performance-refactor-design-authorization.md` | `0595e3679cfc355a82098a5925a55bebe82b234693b6320113894d1f2db0f7a0` | READ |
| All kernel | `project-memory/kernel/01-workspace-and-roadmap.md`, `02-service-shape-and-owner.md`, `03-transaction-data-and-dependencies.md`, `04-contract-consumer-and-admin.md`, `05-evidence-runtime-and-git.md`, `06-heritage-and-change.md` | `f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63`; `45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032`; `f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44`; `1f6d9efbe0208f5b164d12effd4a4c4ab8f2c297b9b000462dc96820c3efa88d`; `f5e219652484338467f0fc03be2bd02d96e09a4a27b812308200673ef720c736`; `5c52b17aad29ba9d78e327ebe550a740d73f97402041c9f4d31c8df38615566c` | READ_ALL |
| Six-dimension route requested | `scripts/context/recall-memory --task-kind design --domain backend --consumer-face operations-admin --owner backend --impact evidence --trigger design-review` | `PROJECT_MEMORY=FAIL; unknown route trigger=design-review` | FAIL_CLOSED; no source inferred |
| Legal six-dimension route | `scripts/context/recall-memory --task-kind design --domain backend --consumer-face operations-admin --owner backend --impact evidence --trigger review` | 14 refs returned; route recorded below | RUN |
| Routed hit | `project-memory/decisions/deterministic-context-only.md` | `4c98ed79b0c8e4694893a29ed977fd2eccea6c1562f2d62f32c06dcbb5ac7e20` | READ |
| Routed hit | `project-memory/decisions/independent-subagent-adversarial-review.md` | `891fc8de061560796dc682c5749d73a5d47029592fca197f09f032e3018b4daf` | READ |
| Routed hit | `project-memory/decisions/http-crud-efficiency-design-redlines.md` | `80efcb002dde542c9cbcc08f19b0cec62f20e66c54d6d581650809ef8f33c876` | READ |
| Routed hit | `project-memory/operations/verification-governance.md` | `e424bf923f1368381b26ef0e22a379a5cdd7bc8b7de887cc2c4e78250f2e0f18` | READ |
| Routed hit | `project-memory/decisions/confirmed-business-language-corpus.md` | `3dba1c80579d4a0eca281efd59d27fbfb20aa86572648f8e36c83a68a603b4f3` | READ |
| Routed hit | `project-memory/operations/business-corpus-adoption-and-read-policy.md` | `d362c4f78c5fc0cb1225a7a4465f82ebbd0c41b886535d69b9f698ea162cd7a9` | READ |
| Routed hit | `project-memory/operations/business-corpus-parked-domain-intake.md` | `739473d09701aba15332c6de72f1f1965b7b5048732fd60d3b97c7934febee9e` | READ |
| Routed hit | `project-memory/decisions/incremental-compliance-hook.md` | `a75469c7eb945b35f06d95cead2e11c368cc4a47dca851f32652556546985f81` | READ |
| Applicable sources | `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`; `doc/decisions/2026-07-24-v2s-verification-governance.md`; `PLATFORM-BLUEPRINT.md#HTTP CRUD efficiency`; phase3-to-phase4 and phase4 owner/read-budget rebaselines | hashes: `108ba9050ed256c6e41a3e53e3af4c761706c4dc8fe697de9540fc649f5af6d3`; `6dceb7fe8fac8a9ac4df5c650204f225f079451218dd5fcbd6f573c68692f0f5`; blueprint above; `ea4640…b6aa`; `cd475e35288e9ebdafd3380d7756e27daeab0f17fdcf15e193cf92e9c8b30759`; `2cc48970b2ec0d9bf9e970da8b1e09ac51f5ccce6d433916cb2ccdfe473728c1` | READ headings |
| Corpus search | `backend performance`, `task read`, `owner projection`, `audit`, `SQL-M1`, `SQL-M2` | `NO_CORPUS_ENTRY_MATCHED` for a non-UI technical-maintenance task | READ |
| Reviewed object | `doc/plans/platform/2026-08-08-v2s-backend-performance-refactor-implementation-design-codex.md#BP-U05` | `b9e30e65cb951214b43943dbc0c848b8b2f416a3273c72c2f063b2a9bd8622eb` | READ_FULL |
| Granularity manifest | `doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-remaining-owner-projection-design-granularity-manifest.json` | `a6cda9291dc3615ac1354751975abc27acc112fc4a1417e8766b9287afe18b32` | READ_FULL |
| Policy truth | `contracts/registry/task-read-surface-policy.json` | `da2b0e894d364c79093dd56128737fbd3a60509fe5c12ea9142f7265e57066c1` | READ_AND_RECOMPUTED |
| Policy generator/checker | `scripts/generate/task-read-surface-policy.mjs`; `scripts/check/backend-performance-read-budget` | `bfbb782796911df726559efc7a592b085ae37e2a6ea6c92e9efddf50cca631c1`; `36bbd1c56027d2c4b9a83654aaacb2f12d49157a45783be82d93ea9a8c5d656a` | READ; static self-test PASS |
| Real edge sources | Operations/platform audit and platform-workspace controllers | `fd06286dc78f1695e6b2d265ba15ed560555bf185f845892012749fcbd551e30`; `4b170073ef04e4795bcd9c2698f1125d9565aed0d614a3de647c3c24ae67615c`; `5e12922df755cd2016e0a31cbff80e014524e0557ed517e74d9f2fe139427c36` | READ |
| Existing owner readers | Contract, organization and extension readers | `67ebd62bdb4830c13799846ee720e74b0dfeb84218b2f304f48631f9c96fd371`; `40db30a14bb37cef46bfd4948f3b22a6c819384a7d3124514be96bac3d522398`; `345b3fc9722b6a8f9bdecd4270318f0ef0b7311c47644303cf2bfebdb3a0c009` | READ |
| All decisions | `find doc/decisions -maxdepth 1 -type f -name '*.md' -print | sort | xargs rg -n '^title:|^# '` | output SHA-256 `de6d98d8661b7ed7f6495c864dce8c520a02ba37cab05ad1877cb493c49aeed8` | TITLES_REVIEWED; relevant decisions opened |
| Standards matrix | `contracts/policy/standards-coverage-matrix.json` | `3ccb1f7c1913e86a36fc6f39e3b1155478654a3cf41e5531d9bcbb79be2825a8` | READ_CHECKLIST |
| Standards coverage | `scripts/check/standards-coverage --phase RM1-P6-3` | `PASS; PHASE=R5; RULES=150` | RUN |
| Design-to-byte experiment | `rg --files` + exact-symbol recall of proposed audit/task-reader types and all three required edge callers | current source lacks proposed readers; existing controllers retain legacy owner calls; no implementation byte exists to compare | NOT_APPLICABLE_TO_DESIGN_BYTES; used as falsification evidence |
| Prewrite/post-proof reread | implementation change points | no implementation is authorized or present in this review scope | NOT_APPLICABLE; cannot be substituted if implementation begins |
| Author material | current-cycle self-review/intake/disposition | none supplied; none read before verdict | ABSENT |

## Independent derivations before author material

- Policy arithmetic independently resolves to 83 GET rows, 78 task reads, 65 `TASK_READER`, and
  13 `NOT_YET_TASK_READER`. The 13 are the eight existing reader-admission operations plus
  organization detail, operations audit, platform audit, and two platform group-workspace reads.
- The ten closed cap exceptions are five accepted account/invitation two-owner rows plus five
  remaining-owner-projection rows. Every declared owner segment is limited to one logical statement;
  neither the cap nor a static gate is a numerical performance-success claim.
- Operations audit has the exact nine target types; platform audit has the seven closed branches,
  with `PLATFORM_ADMIN` ungated and `GROUP_WORKSPACE` as the sole two-owner branch.
- U05 needs the audit and platform-workspace edge callers to hand typed input to the new readers.
  Those real source files are not included in the current manifest change surface. The policy also
  names a nonexistent `modules/audit/.../PlatformAuditHistoryTaskReadService.java`, while the
  rebaseline fixes the intended location as `src/main/java/.../app/application/audit/...`.
- U05 is a design-only technical maintenance delivery. BP-U06 retirement, schema/DML, dynamic
  workload, measured SQL success, DEV, seed/reset, L2 and UAT are explicit counterexamples.
