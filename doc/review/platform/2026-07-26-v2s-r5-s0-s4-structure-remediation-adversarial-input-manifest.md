# R5 S0-S4 结构整改 IMPLEMENTATION 盲审：输入清单

```text
REVIEW_CYCLE_ID=R5-IMPLEMENTATION-STRUCTURE-REMEDIATION-CHECKPOINT
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
route=task-kind=review,domain=platform,consumer-face=backend,owner=platform,impact=architecture,trigger=task-start
```

## 盲审声明

本轮在形成 findings 与 verdict 前未读取作者 self-review、finding-intake、Claude review request/handoff；尤其未读取 `*structure-remediation-review-request.md`。本文件仅记录独立输入与复核动作。

## 入口、当前授权与规则

| path | sha256 | read purpose |
| --- | --- | --- |
| `AGENTS.md` | `5d6f1508a45bf738b79b675fecf8c7e9a7323b9bde30cfa67e14289e5c3ef617` | execution/red lines |
| `CLAUDE.md` | `da3213ab7a75431198ac0d645d7de49b9705b07a27397a2e568d439ea4f66ca1` | independent-review discipline |
| `doc/platform/roadmap-program-registry.json` | `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` | selected `V2S_W0_W4_EXECUTION` |
| `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `0ddef32f51eca3f2dca20d913ea1b6296ce0983822464cf0227a96577b87d22f` | `CURRENT_STEP=R5`; `R5_IMPLEMENTATION_AUTHORIZED=true` |
| `doc/decisions/2026-07-26-v2s-r5-whole-scope-implementation-authorization.md` | `d6b18134f8b5298950b67916b03d96d4531c3033cee7400b88abb8b999becf12` | R5 implementation scope |
| `contracts/policy/standards-coverage-matrix.json` | `6a9f7a700d1b4dbbf3e6fb910a1a291f95d61777c70120e7ae049c4b415101c5` | applicable review checklist |
| `doc/decisions/2026-07-24-v2s-verification-governance.md` | `c9632a65f9eac7678a4be919d980894e3f1e71e5e2e1ddce70ea3c7091d829dc` | L1/L2/L3/business/cleanup rule |
| `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` | `95b79f7c74a3f867e9fdfef6b9f0d63d9e51e50cb08abc905056307d9423d508` | blind round rule |

## project-memory：全部 kernel 与六维命中原文

六维 query 返回并逐项打开以下原文；同时回读其 `sourceRefs` 的 owning decision/roadmap heading。

| path | sha256 |
| --- | --- |
| `project-memory/kernel/01-workspace-and-roadmap.md` | `f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63` |
| `project-memory/kernel/02-service-shape-and-owner.md` | `45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032` |
| `project-memory/kernel/03-transaction-data-and-dependencies.md` | `f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44` |
| `project-memory/kernel/04-contract-consumer-and-admin.md` | `1f6d9efbe0208f5b164d12effd4a4c4ab8f2c297b9b000462dc96820c3efa88d` |
| `project-memory/kernel/05-evidence-runtime-and-git.md` | `101a8d9952efff6bd217488c2444616e19af43a75413619055f9b0590e1a20a8` |
| `project-memory/kernel/06-heritage-and-change.md` | `5c52b17aad29ba9d78e327ebe550a740d73f97402041c9f4d31c8df38615566c` |
| `project-memory/decisions/deterministic-context-only.md` | `4c98ed79b0c8e4694893a29ed977fd2eccea6c1562f2d62f32c06dcbb5ac7e20` |
| `project-memory/decisions/independent-subagent-adversarial-review.md` | `891fc8de061560796dc682c5749d73a5d47029592fca197f09f032e3018b4daf` |
| `project-memory/decisions/confirmed-business-language-corpus.md` | `51415f7d3b024967b10d89414534deb16c1c09e5eced2883f3573d98891b4503` |
| `project-memory/operations/business-corpus-adoption-and-read-policy.md` | `04d9329413131e369e8c1ea841f172d4c295f953b07b9768a0e597405fd28353` |
| `project-memory/operations/business-corpus-parked-domain-intake.md` | `739473d09701aba15332c6de72f1f1965b7b5048732fd60d3b97c7934febee9e` |

`sourceRefs` readback: `doc/decisions/2026-07-24-v2s-r1-authorization.md@a2216874062892229424cc9f8c2bc478d110795b4876433782c6d22a2e78b615`; `doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md@ebc8cc3affe6446979359194a64a50df9a693dc32cef0e97687caaee31ecd568`; `doc/decisions/2026-07-24-v2s-solution-reasonableness-review-policy.md@b30cc0d28d4d79034f10914a50c85f6bac9cc394f092dccbfdac21a62e1163e7`; `doc/decisions/2026-07-25-v2s-confirmed-business-corpus-memory-adoption.md@eb8772599be4ec7c9c111c074946f0ff22ce7b73c54ba29bc17e72131eb3849b`; `doc/heritage/frozen/catering-all-v2/project-memory/decisions/logging-and-debugging-foundation-standard.md@597a87741247b7abf600486087539d614f501e7b53ff031a635f387213b2e03b`; `doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md@84037f1c81ae17ce51ee488723f5e230b4fe3f76c16e690c58c96606793e6c69`.

## 业务语料命中

检索词：`账号`、`角色`、`任职`、`邀请`、`页面准入`、`动作能力`、`合同`、`门店`、`集团空间`、`运营后台`。已打开 corpus 的完整 `G-01/G-03/G-05/G-07/G-08/G-09/G-10` 条目；未将该语料错误当作实现授权。

## R5 被审对象、冻结设计与当日相关决策

| path | sha256 |
| --- | --- |
| `doc/review/platform/2026-07-26-v2s-r5-code-structure-retrospective-and-remediation-plan.md` | `306c596fd65798c2dcd854a78f92769997e5ed1ce7c451a8b2b4cf7cd2b3c8f7` |
| `doc/plans/platform/2026-07-25-v2s-r5-whole-scope-implementation-design.md` | `a3668ac5502735adb2b452fb94ef0b5c55f423078607cc78da1bb78baa0aa014` |
| `doc/review/platform/2026-07-25-v2s-r5-whole-scope-design-granularity-manifest.json` | `b4e605505bbd2535de07a900f929077b59f3a396af7c1aa6621bf8be912633b8` |
| `doc/decisions/2026-07-25-v2s-r5-whole-scope-journey-decision.md` | `dfa67547e3bda2b8703e8227cd463d65ad8211d09526eeed01c5b45a08e51324` |
| `doc/decisions/2026-07-25-v2s-r5-whole-scope-interaction-design.md` | `5ae243d823cca0bd00570bdc351769661ebdcb7b88cfb8cae41b7324e754ab1e` |
| `doc/decisions/2026-07-26-v2s-post-remediation-review-binding-governance.md` | `c75cb5de7646c69a7aa30771ff1b2644cc1e329bdcd61f0fc98f339812b4b130` |
| `doc/decisions/2026-07-26-v2s-r5-claude-review-five-point-resolution.md` | `e0c311365393a9ac06bdebdda7b76063aff55d3135f15b323c2a15c4cffc42b0` |
| `doc/decisions/2026-07-26-v2s-r5-whole-scope-design-final-acceptance.md` | `06ef5e0d9d366384f535d19d5023d88c882f683f4197b6a3ec63a366d577e95f` |
| `doc/evidence/platform/2026-07-26-v2s-r5-code-structure-s0-baseline.md` | `240b8abc18dfcfa2e2b7ebaf0d74533e46aed10bbf71aaaa4dada2b5b6badc29` |
| `doc/evidence/platform/r5-u01-edge-placement-resolution.json` | `2574316ad27f1b57adbf706e217c9cd07dd3e6149bf7d1d26194cb1253d0b11a` |

## 生产门与复跑

| path | sha256 | fresh result |
| --- | --- | --- |
| `scripts/check/code-layout` | `c55c091ed0435193b689184878d88da0313e3334fd483ab2dd50b7063b01edab` | production PASS; self-test PASS |
| `scripts/check/frontend-architecture` | `876d13ca056efbcc58ab860023bd7118518ff44add6d8fbb9c5a9b38c79cde94` | production PASS; self-test PASS |
| `scripts/check/security-boundaries` | `cf9236b7b32e5fd48670019b07742410fc79ba0b203671664dad4b6b3dd92f9e` | production PASS; self-test **FAIL** |
| `tools/verify-gates/cli.mjs` | `203881d748a4b3f966d8d7a0dafa66a387a268596da9fa54d5006ad982545021` | backend/traceability/openapi production+self-test PASS; `affected-l2` production FAIL because mapped target files are absent; its self-test also stops at that real denominator failure |

Static-only reruns: backend `compileJava` PASS; both admin app unit tests and production builds PASS. No DEV, seed, reset, Testcontainers, server, browser, or remote environment was started.
