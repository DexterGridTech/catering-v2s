---
title: RM1 P6-2 U04 管理后台目录真相迁移独立实施对抗审查 Round 2
REVIEW_CYCLE_ID: RM1P6-ADMIN-CATALOG-TRUTH-IMPLEMENTATION-20260730
REVIEW_TARGET: IMPLEMENTATION
REVIEW_ROUND: 2
REVIEW_ROUND_LIMIT: 2
reviewerKind: INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION: SELF_DECIDED
scope: RM1P6-ADMIN-CATALOG-TRUTH-U04 static catalog/generator/generated-output/role-home migration only
verdict: GO
findings: M=0 / S=0 / N=1
createdAt: 2026-07-30
---

# RM1 P6-2 U04 管理后台目录真相迁移独立实施对抗审查 Round 2

REVIEW_CYCLE_ID=RM1P6-ADMIN-CATALOG-TRUTH-IMPLEMENTATION-20260730
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED

## 用户任务

业务用户要让 PAGE、ACTION、group 与 ROLE_HOME 关系由同一静态目录投影，避免后台角色配置、导航与首页出现局部真相。

## Dexter 立场

Dexter 授权的只是 U04 static-only catalog/generator/generated-output/role-home 迁移；不扩大至 operations feature、运行环境、L2 或动态业务结果。

## 替代方案

替代是只修标题并保留 tuple/map 和手写 homepage，或把动态 owner facts 并入 catalog；前者不消除多源关系，后者越界，故不选。

## 方案合理性

问题是静态关系真相分裂；受限 node projection 的收益是同源可审计投影，复杂度低于维护平行映射，且不以 catalog 代替 owner。

## UI 与交互

NOT_APPLICABLE：无 UI、无交互和无 `.tsx` 变更；理由是本 package 禁止该范围，静态生成物不能代替 Journey 或用户行为验收。

## 审查意见复核

NOT_APPLICABLE：未收到作者 finding disposition，且 reviewer 不代写 intake；本轮只记录 independently CONFIRMED 的 N-01 source debt 及其适用边界和更小 owner-side remedy。

## 实施代码核验

已重开实际源码和 generated Java/TypeScript。fresh codegen 测试/self-test、capability control 和 R5 standards coverage 已运行；没有动态业务用户行为或 Journey 运行，业务结果明确不适用。

## 闭环核验

U04 static source 无 M/S；authority ledger 仍有外部 P6 evidence debt，不能伪称 PASS，package-exit 仍须由作者用独立 evidence 关闭。

## 结论

VERDICT=GO

`REVIEW_CYCLE_ID=RM1P6-ADMIN-CATALOG-TRUTH-IMPLEMENTATION-20260730`
`REVIEW_TARGET=IMPLEMENTATION`
`REVIEW_ROUND=2`
`REVIEW_ROUND_LIMIT=2`
`reviewerKind=INDEPENDENT_SUBAGENT`
`ROUND_FINAL_DECISION=SELF_DECIDED`

## Identity and blind-review declaration

Fresh independent subagent verdict from the `catering-v2s` root. The review re-opened the model §5, U04 amendment/input/manifest, current catalog/generator/self-test, static controls, current generated TypeScript and Java outputs before using Round 1 only as the targeted comparison. No author finding disposition or package-exit exists or was written here.

`BLIND_REVIEW_DECLARATION=I tried to falsify the static node model and its owner boundary from production source and fresh control output; Round 1 was not treated as authority.`

`authorMaterialReadAfterIndependentVerdict=true`: the required amendment/input/manifest are scope sources, not an author verdict; no author disposition was read. This artifact is the sole reviewer write and does not contain author intake.

The business task is one auditable static PAGE/ACTION/group/ROLE_HOME relation source for platform and operations administrators. Keeping title-only edits and the handwritten home switch would retain multiple truths; importing current grants, candidates, visible entities, or request decisions into catalog would cross owner boundaries. The constrained node projection remains proportionate for this static-only package. UI/Journey is `NOT_APPLICABLE_STATIC_ONLY`: no `.tsx`, router behavior, managed runtime, L2, or dynamic business result was reviewed.

## Targeted verification

### ROLE_HOME workspaceRequirement red mutation — PASS

Model §5(3) prohibits `workspaceRequirement` on ROLE_HOME. In the actual generator the ROLE_HOME branch rejects `pageAccess` **or** `workspaceRequirement !== undefined` with `R5_ADMIN_CATALOG_ROLE_HOME_INVALID`. The production self-test injects `workspaceRequirement: "REQUIRED"` into `HOME-GROUP` in a scratch copy and fresh `scripts/check/edge-codegen --self-test` reports `R5_ADMIN_CATALOG_ROLE_HOME_WORKSPACE_REQUIREMENT_RED` and PASS.

The rule only validates static shape. It reads no organization entity, session grant, visibility candidate, selected scope, or request authorization. The five actual ROLE_HOME nodes are operations nodes with `pageAccessManaged:false`; only platform generated pages contain `workspaceRequirement`; Java derives `homePageForRoleNodeType` from static role-home keys. Thus the mutation rejects the model-prohibited shape without broadening into dynamic owner facts.

### Round-1 M-01 controls — source-proven external debt, not hidden U04 PASS

`node tools/capability-invariants/cli.mjs check` now PASSes with `EXACT_SET=88`; the former frozen-count drift is absent from the current tree.

`node tools/authority-source-ledger/cli.mjs check` still fails exactly as `P1_LEDGER_CONSUMER_MISSING:apps/frontend/operations-admin/src/features/workspace-membership/ui/WorkspaceInvitationPanel.tsx`. The owning control defines ST-11 as `closurePackage=P6`, with carry-over `focusedEvidence` authority and generator relation `NONE`; its ledger consumer denominator still names that missing operations feature path. U04 explicitly excludes operations `.tsx` behavior. This is therefore an explicit P6 authority-evidence/consumer-inventory debt, not a catalog/generator/generated-output failure and not an authority-check PASS that U04 may claim. It must remain recorded with its fail output and owner disposition.

## Independent source/output result

- The catalog contains only metadata plus `nodes`: PAGE=25, ACTION=34, NAVIGATION_GROUP=4, ACTION_GROUP=4; pages split into platform BUSINESS=8, operations ROLE_HOME=5, operations BUSINESS=12.
- Generator discriminator is mutually exclusive: ROLE_HOME rejects `pageAccess` and `workspaceRequirement`; operations BUSINESS requires its access shape and rejects platform field; platform BUSINESS rejects operations authorization/experience fields and requires workspace requirement.
- Both generated catalog outputs preserve this division; `WorkspaceAuthorizationCatalog` has five generated role-home relations and `WorkspaceAuthenticationService.homePage` only delegates to the generated lookup. Dynamic `enterable(...)` and organization description dispatch remain outside catalog authority.
- Fresh controls: `scripts/check/edge-codegen` PASS (243); `scripts/check/edge-codegen --self-test` PASS including cross-face ACTION, purpose-pair, duplicate-navigation, role-home access and workspaceRequirement red controls; capability invariants PASS; `scripts/check/standards-coverage --phase R5` PASS (150). The authority ledger failure above remains explicitly non-PASS external evidence debt.

## Finding

### N-01 — P6 authority ledger consumer denominator debt

**CONFIRMED, N; not U04 static-source M/S.** The missing ST-11 consumer is outside the U04-permitted feature behavior and must not be silently converted into U04 PASS. The smallest remedy is the ledger owner’s finite consumer-inventory correction, not moving dynamic feature/owner facts into catalog. If later evidence omits this failure or claims it as U04 business evidence, reopen closure.

No new M or S remains in actual U04 static source.

## Verdict

**GO (M=0 / S=0 / N=1), only for U04 static implementation-source review.** This does not certify package-exit, authority-ledger PASS, business PASS, cleanup PASS, or L2. `business=NOT_PERFORMED_STATIC_ONLY`; `cleanup=NOT_PERFORMED_NO_MANAGED_RUNTIME`; `L2=NOT_PERFORMED`. This is the hard final independent round; do not open a third round for this cycle. The author alone performs subsequent evidence/disposition work under the existing SELF_DECIDED rule.

## Reviewer input checklist: path + SHA-256

| Path | SHA-256 |
| --- | --- |
| `AGENTS.md` | `e4e3c9af4fb0dc46ce5403edadb6704d1d4a60dea186efc9cbe22dd62fddb347` |
| `CLAUDE.md` | `8b12b36e0c852f3a55f40f29d3d21101b9acb113b969ff5f8a9c2152c2aec50f` |
| `PLATFORM-BLUEPRINT.md` | `29bcd8930f9ce75627ca32902f7fabc40c2c93c611e15db6a416cf7d8e3fab4d` |
| `doc/platform/{README.md,roadmap-program-registry.json}` | `809f9567df2048bfe40c254c6a613dae7535a6fdebb802f8a06b1e15ebd3687e`; `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` |
| `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `dde1ef52a134bcb4134ce5b1c42886576a58853bae2593b8b0bb35ad38b8a2cd` |
| `project-memory/{kernel/01-workspace-and-roadmap.md,kernel/02-service-shape-and-owner.md,kernel/03-transaction-data-and-dependencies.md,kernel/04-contract-consumer-and-admin.md,kernel/05-evidence-runtime-and-git.md,kernel/06-heritage-and-change.md}` | `f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63`; `45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032`; `f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44`; `1f6d9efbe0208f5b164d12effd4a4c4ab8f2c297b9b000462dc96820c3efa88d`; `d0d75e547400145ef7e764d735bc86e2fdaa5ea8a0b19ace213170b527d65a05`; `5c52b17aad29ba9d78e327ebe550a740d73f97402041c9f4d31c8df38615566c` |
| `project-memory/decisions/{deterministic-context-only,independent-subagent-adversarial-review}.md` | `4c98ed79b0c8e4694893a29ed977fd2eccea6c1562f2d62f32c06dcbb5ac7e20`; `891fc8de061560796dc682c5749d73a5d47029592fca197f09f032e3018b4daf` |
| `contracts/policy/standards-coverage-matrix.json` | `7d390eb692b627d876cdbfe34d03c140ce4f8450333c2d7618c849ced2fb55b3` |
| `doc/decisions/2026-07-30-v2s-admin-catalog-semantic-copy-model.md` | `b566700d188dabc6cf5a02d474c66ff9a74b0ef7798a4388337e1ad15d11ea8c` |
| `doc/evidence/platform/rm1/p6/rm1p6-u04-admin-catalog-truth-{implementation-amendment.md,package-input.json}` | `fafb31b1d815b66af2652c14df10771e4375c445fb7924ddb10b47969ea188e3`; `a07d3eafd43c860e6a1dac77fa5e147c6433e51ba944a7a5fc781b2156698abe` |
| `doc/evidence/platform/rm1/p6/rm1-u09-implementation-design-granularity-manifest.json` | `506eba4f054d001c7cfa49bee07701c42d6dd5cc00f67dcedba20891545886ce` |
| `doc/review/platform/2026-07-30-v2s-rm1-p6-admin-catalog-truth-implementation-adversarial-review.md` | `07521745cfc3b64a130289969eed3ea549fec1a2ae8bde28a4c7ae0c35261f43` |
| `contracts/catalog/admin-catalog.json`; `scripts/generate/edge-codegen.mjs` | `ce13179496deb134e8f017dbce9582c36915f2bada371c8aa437ffbe7389e190`; `1d83fae0dc41d3860c491cbf5c1a44bd814e6403206f789d7222932e8f2928d6` |
| generated platform/operations catalog | `ddcd3d146663a51f491219548d6579ee4a34734a5af261c8aa6032a8d7f4dffb`; `2262cdcc6dd9d3091614145fd5b40fc87d054035153db897ca840aa8dc0b3015` |
| `WorkspaceAuthorizationCatalog.java`; `WorkspaceAuthenticationService.java` | `235d64fa9d4c66495865f9402827236e3aa14bdb2f060d1d38b0115af2a58ef3`; `66efa01f8387d003aa4b301535884c392ab5306240d05163f944289f2161b44c` |
| `tools/{capability-invariants,authority-source-ledger}/cli.mjs`; `doc/evidence/platform/rm1/p1/authority-ledger.json` | `b8aa74a87168271686c60138574afa91c3be65f86a31f8a25559446dd3db6ce8`; `3ef4e3b7e0d7e375cf8bf83a4079aa383504d32362cebd74bcbb6db295cb5142`; `79ae398aab56a219ac7c993a37df0b933fcbc27d1306ba632ed18f6170b347e1` |

Memory route executed: `review/platform/platform-admin/platform/governance/task-start`; all kernel and matched routed originals were reopened. `NO_CORPUS_ENTRY_MATCHED` for `admin catalog`, `ROLE_HOME`, and `workspaceRequirement`; catalog semantics are controlled by the U04 decision rather than inferred from business corpus.
