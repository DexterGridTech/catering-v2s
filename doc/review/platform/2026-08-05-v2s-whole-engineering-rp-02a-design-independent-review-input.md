# RP-02a DESIGN 独立盲审输入清单

```text
REVIEW_CYCLE_ID=WHOLE-ENGINEERING-RP-02A-DESIGN-20260805
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW=true
AUTHOR_MATERIAL_READ_BEFORE_VERDICT=false
```

## 盲审声明

独立 reviewer 必须先从业务问题与 owning source 重新推导预期行为、反例和更小替代，
再读取 Round 2 修订后的详设/manifest。不得先读取 author intake、Claude handoff 或任何作者 verdict；
不得以旧 Round 1/2 报告代替本 cycle 的 source-first 判断。若文件尚不存在，以当前仓根
source 与本清单为唯一输入并报告缺失。

## 必读原始问题与业务/标准输入（path + hash）

| path | sha256 | 必核查 |
| --- | --- | --- |
| `doc/review/platform/2026-08-05-v2s-whole-engineering-merged-review-claude.md` | `16b9991ca368eeaf8791271cbab7273cb7958d60d95e78ad1ac2513c4a5f0f3d` | §1.2 的 154/144/147、projectId、B2 根因与不派生 facts 修订 |
| `doc/review/platform/2026-08-05-v2s-whole-engineering-remediation-design-and-execution-plan-codex.md` | `50f1b3004566599971420320d95dd0e5db0f27a910a911332bc9b07cd6f83d62` | RP-02a/P0 范围、D4 不阻塞、静态与动态边界 |
| `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-dialectical-assessment.md` | `4627038d6fe5a803c07b8e4fabf3fb5590b93e1a60fa4f1c148eefcc35d610a8` | R5 task/owner/face/crosswalk 语义与冻结条件 |
| `doc/decisions/2026-07-25-v2s-design-governance-batch-1.md` | `c33ad1cca0c92e991884073040f797dddff303ff218ca1de7109e9c26ed67e7d` | Journey、前提链、非 UI unit 与详设准入 |
| `doc/decisions/2026-07-24-v2s-solution-reasonableness-review-policy.md` | `b30cc0d28d4d79034f10914a50c85f6bac9cc394f092dccbfdac21a62e1163e7` | simpler alternative、业务用户、反过度设计 |
| `contracts/policy/standards-coverage-matrix.json` | `b0519ea0e8691b204fc41f9a481665eaf381e067c1bf4f002b7913171476b149` | JOURNEY_INTERACTION_REVIEW、DELIVERY_PROCESS_REVIEW、R4_BOUNDARY_SEMANTICS_REVIEW |

## 必读 source-owned 代码/契约/证据输入（path + hash）

| path | sha256 | 必核查 |
| --- | --- | --- |
| `apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json` | `1f7900fb24b930dfb41fd5c73659a094c75f7e4e827de1ecd2e763596d7e2824` | 154 route-face tuples、50/92/12 |
| `doc/evidence/platform/r5-u01-edge-placement-resolution.json` | `251d54c685f299d12410378d0664b79ce15476d79dca35dbfea9f45a92d21b27` | source-backed 154 placement |
| `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json` | `81d7c84aa77c0f0787b3fc7fea6407d79995dde391105e9ac5616bf9b3eff723` | 121 catalog、generic→scoped 差异、crosswalk invariants |
| `contracts/openapi/paths/platform-admin/workspace-access.paths.yaml` | `51b3555a774e208e604aac91a064d228216c4ed17b7edba78c123c98f7ae6d2f` | platform invitation operations |
| `contracts/openapi/paths/operations-admin/store-management.paths.yaml` | `b008219b6332db0f95a11ee51f3c4b34eb3fcbd366711ac4499662bae51931f6` | operations candidates/store body |
| `contracts/openapi/paths/operations-admin/contract-management.paths.yaml` | `f4797339e35680f48f5a3668dc9746e8de6c0deb83bb6235d27263ac03509e2a` | operations contract list/candidates/extension query metadata |
| `contracts/openapi/paths/operations-admin/organization-hierarchy.paths.yaml` | `21745fbfd08d06240b42ff2ca69e9c8a3b471d0d518273b4d78b7ddca9a5ba93` | hierarchy extension/commercial group |
| `contracts/openapi/paths/platform-admin/contract-overview.paths.yaml` | `b82dc1df4fc37cb8cc9b4f7f506cc164c4d916edde1077a9d79f6d0150f5def7` | platform candidate operation |
| `contracts/openapi/paths/platform-admin/organization-overview.paths.yaml` | `75083b869a70268071ffe4f01b555da931ef84b15c50df497e4376557ff0aa8a` | platform overview projectId query metadata |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/workspaceiam/PlatformWorkspaceInvitationController.java` | `03960ce36be86c32940fbafc3b602ca13bf50b84a0b09e594c8b540ef29d0b86` | owner calls/readbacks for six platform facts |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsOrganizationCandidateController.java` | `cfd4184afe3f638d09f317274de91f3498eac2a42d6686c6d3ac392e22635fe7` | operations candidate owner path |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsOrganizationHierarchyController.java` | `4d4e37679dc643fee7651f5095371958948203c552dcd7fe92df86b5eae54515` | extension/commercial-group command owner path |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/organization/PlatformOrganizationOverviewController.java` | `909e8e6877cf57e14b0843e8f9d5243c2e391303dc2c6b6e059f189dc961f633` | platform candidate owner path |
| `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceInvitationService.java` | `4b13df723e4dfb9e7227775ba4fb986157cafc34254f54008e7d78d7b2846374` | invitation command/read owner |
| `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceUserService.java` | `721a707241a807157e5a07465dbb3603deeb658d6df1b9e5f3060f9b0f018e93` | candidate owner/read model |
| `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/StoreCandidateTaskReadService.java` | `504928362a2edccdc61374ca8aca7b6a2a39356c83bc2796f1855a7c7f0eb0a4` | project/candidate query semantics |
| `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationCommandService.java` | `883027c130d7ebf2286978acd7cabac826808371cca331b8aef5e87adab1561b` | commercial-group owner command |
| `apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/application/ExtensionDefinitionService.java` | `09b0f08a126193b885b6b5cb91719729bffb4fe5c948b8e599867b3c961e0b7d` | extension definition owner |

## Round 2 修订核验输入

Round 1 report: doc/review/platform/2026-08-05-v2s-whole-engineering-rp-02a-design-independent-review-round1.md
sha256=8a0407c8ab26e2b8c183612862b5d75ba13c4857c75ef9b4e36a89f3e90498e0

Round 2 must challenge the materialized source catalog identity projection, R24 error
augmentation, P3C query/component metadata, concrete scope operation paths, the corrected
OperationsOrganizationExtensionController hierarchyDefinition owner, the unique source anchor,
the exact four forbidden projectId body sites, the finite allowed project scope set, and the
154-row semantic crosswalk schema. ID arithmetic alone is insufficient. No implementation,
runtime, seed/reset, HTTP, browser L2 or Git action is authorized by this input.

## 必读当前详设输入

独立 reviewer 在形成 verdict 前必须读取但不得先读作者 intake：

- `doc/decisions/2026-08-05-v2s-rp-02a-contract-consumer-recovery.md`（Journey 绑定）
- `doc/plans/platform/2026-08-05-v2s-whole-engineering-rp-02a-implementation-design.md`（详设）
- `doc/review/platform/2026-08-05-v2s-whole-engineering-rp-02a-design-granularity-manifest.json`（分母/边界）

审查必须逐条验证：业务问题适配性、154/144/121 crosswalk 是否合理、10 条 fact 是否确实需要手写、
generic→scoped catalog 替换是否过度或遗漏、projectId body/query/read 边界、recovery 四步与 invitation
七步是否被清晰区分、D4/RP-02b 是否被错误提前、静态/动态 business-cleanup 声明是否诚实、以及每个
source denominator/approved source/forbidden pseudo-fix/discriminator 是否有 owning evidence。

## 输出约束

Reviewer 必须创建本 cycle 的 Round 2 独立报告 doc/review/platform/2026-08-05-v2s-whole-engineering-rp-02a-design-independent-review-round2.md，包含：

- `kind=implementation-design-adversarial-review`、`reviewTarget=DESIGN`、`reviewerKind=INDEPENDENT_SUBAGENT`；
- REVIEW_CYCLE_ID、REVIEW_ROUND=2、REVIEW_ROUND_LIMIT=2、ROUND_FINAL_DECISION=SELF_DECIDED；
- source-first blind declaration、逐 finding 的 M/S/N、证据/风险/处置建议、unit verdict、severity counts；
- 至少一个更简单替代及成本比较；
- 结论的 `GO`/`NO_GO`、授权边界，并明确 round 2 是否仍允许。
