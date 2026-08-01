# RM1 P6 表单详设修复：独立对抗审查第二轮输入清单

`REVIEW_CYCLE_ID=RM1-P6-FORM-REMEDIATION-20260729`  
`REVIEW_TARGET=DESIGN`  
`REVIEW_ROUND=2`  
`REVIEW_ROUND_LIMIT=2`  
`reviewerKind=INDEPENDENT_SUBAGENT`

本清单由 fresh reviewer 在形成 verdict 前完成。未读取 round-1 审查件、旧 audit、作者 remediation record、disposition 或 handoff；这些材料在本轮独立 verdict 前均不作为输入。

| 输入 | SHA-256 | 已读 | 本轮用途 |
| --- | --- | --- | --- |
| `AGENTS.md` | `f179f36d8aade8e4cb01def3637aef3a41dc031f79720c4fa13c1a58e3384414` | 是 | 授权、owner、审查与零实现边界 |
| `CLAUDE.md` | `8b12b36e0c852f3a55f40f29d3d21101b9acb113b969ff5f8a9c2152c2aec50f` | 是 | 方案合理性与独立审查纪律 |
| `doc/platform/roadmap-program-registry.json` | `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` | 是 | 显式 program/current Roadmap 解析 |
| `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `5476287821b966d28fb024ac400de7a6e1a86ff61b76c26a4667dd404d31c938` | 是 | Roadmap 权限边界 |
| `project-memory/kernel/01-workspace-and-roadmap.md` | `f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63` | 是 | kernel |
| `project-memory/kernel/02-service-shape-and-owner.md` | `45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032` | 是 | kernel |
| `project-memory/kernel/03-transaction-data-and-dependencies.md` | `f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44` | 是 | kernel |
| `project-memory/kernel/04-contract-consumer-and-admin.md` | `1f6d9efbe0208f5b164d12effd4a4c4ab8f2c297b9b000462dc96820c3efa88d` | 是 | kernel |
| `project-memory/kernel/05-evidence-runtime-and-git.md` | `101a8d9952efff6bd217488c2444616e19af43a75413619055f9b0590e1a20a8` | 是 | kernel |
| `project-memory/kernel/06-heritage-and-change.md` | `5c52b17aad29ba9d78e327ebe550a740d73f97402041c9f4d31c8df38615566c` | 是 | kernel |
| `project-memory/decisions/deterministic-context-only.md` | `4c98ed79b0c8e4694893a29ed977fd2eccea6c1562f2d62f32c06dcbb5ac7e20` | 是 | routed memory |
| `project-memory/decisions/confirmed-business-language-corpus.md` | `51415f7d3b024967b10d89414534deb16c1c09e5eced2883f3573d98891b4503` | 是 | G-01/G-02/G-04/G-05/G-07/G-09 边界 |
| `doc/decisions/2026-07-25-v2s-r5-whole-scope-journey-decision.md` | `dfa67547e3bda2b8703e8227cd463d65ad8211d09526eeed01c5b45a08e51324` | 是 | 原始业务任务与 32 场景分母 |
| `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` | `95b79f7c74a3f867e9fdfef6b9f0d63d9e51e50cb08abc905056307d9423d508` | 是 | fresh/盲审/两轮 hard stop |
| `doc/decisions/templates/ui-interaction-design-template.md` | `06cd21f15019a899d632fa19c48383532c6c03e1ff9e75e21c4d7bae862d5bb1` | 是 | 表单事实矩阵与 CandidateQuery 强制形状 |
| `doc/decisions/2026-07-28-v2s-rm1-ia-01-platform-otp-and-invitation-interaction.md` | `83cce372b073ede80b8e279b1f928fe1823596df3bf0b3be342122480daa994f` | 是 | IA01 被审对象 |
| `doc/decisions/2026-07-28-v2s-rm1-ia-02-operation-context-interaction.md` | `09aa841403a173d02ba6781155ba42bfcf9501c6e6202c6f78425d6b96995dda` | 是 | IA02 被审对象 |
| `doc/decisions/2026-07-29-v2s-rm1-ia-03-platform-governance-and-self-service-interaction.md` | `ca816ea97f4075d0e783fa079029e2d37be902d7e93789993a29ccb398d01a32` | 是 | IA03 被审对象 |
| `doc/decisions/2026-07-29-v2s-rm1-ia-04-operations-organization-and-contract-interaction.md` | `0e83fc3273186e1d6a0ddbb247a1297b8a32eb361a7d1e51385ee7d64fb66d4e` | 是 | IA04 被审对象 |
| `doc/evidence/platform/rm1/p6/rm1-u09-form-command-variant-ledger.md` | `88a0b62b6c892df4d8d5447e6e90e4fd6fae57f18258a7c9c70495d68354e894` | 是 | C/S/P 分母与 CandidateQuery proposal |
| `doc/evidence/platform/rm1/p6/rm1-u09-candidate-search-unification-problem-family.json` | `82522225925ef27d5af545666e298f4f270e574d88fa3dfd2087b95a79c0b32c` | 是 | 问题族分母与反例边界 |
| `contracts/openapi/components/workspace-iam/workspace-access.schemas.yaml` | `3cb49dcce34c73c196aea158e5ce866a03ca2686fbbac818d6621f7fc1831f65` | 是 | C08 public body 当前字段 |
| `contracts/openapi/paths/platform-admin/role-management.paths.yaml` | `77df72a85c1c21d02e370595dd293ee184d0e719d3d111bd6b1d9095c03ffd1d` | 是 | C07/C08/S03 public operation 边界 |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/workspaceiam/PlatformWorkspaceRoleController.java` | `f7efb19311512d25e02183c5275acee8925f53461500dbb6e66f62ec7761fd00` | 是 | C08 edge→owner 映射 |
| `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceRoleService.java` | `b254bf96d69b67f61fb7e368e4125ea608e2fbde1d3f809292139366a9884a0f` | 是 | C08 持久化与 S03 独立命令 |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/access/OperationsWorkspaceInvitationCandidateController.java` | `a16da1fc22c3adb10da8429646bdc203a56f7dd0c78c0cbbfd7139567efdeb57` | 是 | IA01 候选 query 的反例 |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/contract/OperationsContractController.java` | `4cffa3785ca9f93c9552490a87a79cfe77f1a7755577b23f15a754b85d921b93` | 是 | 合同 owner candidate adapter 反例 |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsStoreManagementController.java` | `ef3bd69df957d70c77d76b57b13a2998604249df4806b48b7820e89b7246a90e` | 是 | 门店 owner candidate adapter/GAP 反例 |

`doc/decisions/` 全目录 title 列表已独立检索；除上述直接相关 decision 以外，没有将无关历史 R3/R4/R5 author material 当作本轮事实输入。已执行两条六维 recall（operations-admin 与 platform-admin，`task-kind=review/domain=admin-ui/owner=product/impact=contract/trigger=task-start`），并打开返回的 kernel、`deterministic-context-only`、business corpus 与独立审查治理原文。`scripts/check/standards-coverage --phase R5` 在本轮 fresh PASS。
