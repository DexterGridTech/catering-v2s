# Whole-engineering second package — independent DESIGN adversarial review (Round 2 final)

REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=WHOLE-ENGINEERING-SECOND-PACKAGE-20260805
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED

## Blind and final-round declaration

I independently reopened the mandatory entry chain, the IA04 and D1–D7 sources, the RP-07/RP-08/RP-10/RP-11
design rows, and the current second-package plan, delivery manifest, active package, and relevant owner,
generated, foundation, and managed-runner sources. I then reopened the Round 1 artifact and checked each
disposition against the current bytes. No production source, contract, manifest, runtime, seed/reset, or Git
operation was performed. `scripts/context/agent-context health` returned `STATUS=PASS`, and
`scripts/check/standards-coverage --phase RM1-P6-3` returned `STANDARDS_COVERAGE=PASS` (`PHASE=R5`).

This is the second and final independent round for this DESIGN cycle. I did not treat the Round 1 verdict,
future evidence paths, or implementation authority as proof of implementation, business, or cleanup success.

## 用户任务

业务用户需要在 IA04 总公司详情 Drawer 中按品牌名称或编码查找 owner 返回的候选，并逐项添加/移除授权，
同时不让任何 operations 表单在提交中被关闭；受管运行还必须只信任已批准的远端主机并证明完整进程树清理。

## Dexter 立场

Dexter 的边界是一个原子第二包、保留 platform-admin/operations-admin 与 owner 主权、禁止数据库/migration、
seed/reset、UAT/远端应用浏览器和 Git 扩权；本轮只判断设计是否足以进入实现，不把静态设计 GO 当作运行 GO。

## 替代方案

较小的替代是只改 adapter、只切 `maskClosable`、只测 helper 或继续从 host 自哈希；均不选，因为会遗漏 owner
契约、Esc/图标/取消入口、生产 runner 子进程逃逸或攻击者 host+hash 反例。泛化搜索/lifecycle 框架也不选，
其复杂度和 owner 边界代价超过本包收益。

## 方案合理性

问题、方案、代价与收益匹配：RP-07 由 OpenAPI→owner→generated→adapter 闭环，RP-08 复用 foundation，
RP-10 以仓内 allowlist 取代重言式自证，RP-11 以 runner 自身 evaluator 做真实 red mutation；六类证据分母
保持可审计，且不引入新服务、数据库或隐含运行授权。

## UI 与交互

APPLICABLE：IA04 的 Journey、Drawer 入口、候选搜索、逐项命令、提交中关闭阻断和失败/完成恢复均在设计中；
操作来自批准用户任务，owner 返回候选和 fresh detail 是事实来源，不由接口形状或旧页面推导更优路径。

## 审查意见复核

Round 1 的 M-01/M-02/M-03/M-04/S-01 均逐条重开 owning source、当前 plan/manifest/active package 与相关源码，
状态分别为 `CONFIRMED_CLOSED`。反例边界已检查：host+hash 攻击配对、非表单 Drawer、leader-dead/child-alive、
uppercase/trimmed query、客户端分页 union；当前没有残留 finding。已比较更小修复的成本并拒绝过度设计，
不需要比已选方案更大的修复或第三轮审查。

## 闭环核验

设计闭环核验了 owner、contract/generated、foundation、runtime runner、business/cleanup 双分账、禁止面和
输入 hash。业务与 cleanup 仍是 `PENDING`，实现前必须重新读取生产源码、执行 focused/red proof，并建立
`REVIEW_TARGET=IMPLEMENTATION` 的新独立 cycle。

## 结论

VERDICT=GO

## Verdict

**GO — M=0, S=0, N=0 (design only).**

The current design closes all Round 1 design blockers with finite, reviewable denominators and an implementable
evidence shape. It does not upgrade `businessStatus` or `cleanupStatus` from `PENDING`, and it does not authorize
a third DESIGN round. Implementation must reopen production sources and obtain a new `REVIEW_TARGET=IMPLEMENTATION`
cycle plus fresh business/cleanup evidence.

## Round 1 disposition verification

| finding | current disposition | verification in current bytes |
| --- | --- | --- |
| M-01 RP-10 trust-source denominator | `CONFIRMED_CLOSED` | The design names the normative allowlist and the eight remote-host consumers (`r5-dev-environment`, `r5-reset`, `r5-dev-runner`, `http-diagnostic-runner`, `r5-seed-bootstrap`, `terminal-fixture-state`, `r5-joint-remote-l2`, `r5-remote-testcontainers`) as a finite production denominator; the manifest repeats the exact list and the allowlist. It prohibits input-derived fingerprints and requires valid/unknown/wrong/attacker-pair/rotation red-green cases. Focused tests are evidence consumers, not an unbounded trust-source escape hatch. |
| M-02 RP-08 Drawer denominator | `CONFIRMED_CLOSED` | The plan and manifest enumerate exactly 14 `FORM_DRAWER` paths, state the required mask/icon/Esc/`onClose`/`requestClose`/footer-cancel bindings, and explicitly exclude detail Drawers, status Modals, result surfaces, and public invitation surfaces. The brand Drawer local submitting flag is removed; `useDrawerFormLifecycle.submitting` is the sole close truth. |
| M-03 RP-11 cleanup red proof | `CONFIRMED_CLOSED` | The manifest binds a production-path `scripts/dev/r5-dev-runner.mjs --self-test` fixture. Its synthetic owned root/child marks the leader dead while the child survives, runs the same runner cleanup evaluator, requires `cleanup=FAIL` while business remains independently visible, and retains first-failure, last-known-good, and broken-boundary evidence. |
| M-04 IA04 owner-readback oracle | `CONFIRMED_CLOSED` | The design keeps owner-returned candidates and one-at-a-time add/remove commands. The business denominator requires name-only, code-only, uppercase/trimmed, no-match, one paged request, fresh owner detail after both add and remove, stale/denied owner re-check, and unknown-outcome replay/readback. This is explicit business evidence, separate from static generated-wire and cleanup evidence. |
| S-01 RP-07 normalization | `CONFIRMED_CLOSED` | The canonical operand is explicitly `q = lower(trim(queryText))`, blank becomes null, and the owner predicate is lower-cased name/code OR matching. Focused proof includes uppercase/trimmed name and code cases, plus no-match and page boundary. |

## Focused current-byte checks

### M-01 — finite RP-10 trust set

`RUNTIME_RUNNER` is an exact 11-entry denominator: the normative
`contracts/policy/r5-remote-host-allowlist.json`, `r5-remote-host-trust.mjs`,
`managed-process-tree.mjs`, and the eight named remote-host consumers. The active package exposes the same
production change surfaces, while the focused-proof denominator carries the helper red cases. The design's
wording “plus their focused tests” does not enlarge the trust-source set: tests exercise the listed consumers;
they do not become an alternate host/fingerprint authority. No residual direct self-hash consumer is omitted
from the listed production set based on the current source scan.

### M-02 — exact FORM_DRAWER set and lifecycle truth

The 14 paths in the plan and manifest are an exact form-only set. A current operations `*Drawer.tsx` scan shows
the remaining Drawer files are detail/read-only or fixed-result surfaces and are covered by the explicit
exclusions. The selected shape binds all close entry points to foundation `submitting`; the separate foundation
submission helper is used only for idempotency and is not a second submitting state.

### M-03 — production runner cleanup mutation

The design is not merely a helper unit test: the red mutation is named on `r5-dev-runner --self-test` and is
required to pass through the runner's cleanup evaluator with manifest process identity and log boundary fields.
The design also preserves the no-port/no-process-name ownership rule and business/cleanup separation.

### M-04 — IA04 business oracle

The oracle is finite and owner-centered: candidate search is owner-returned, one request is observable, and each
command is followed by fresh owner detail. The stale/denied re-check plus unknown-outcome replay/readback covers
the command idempotency/recovery boundary without introducing a client-side union or a second owner.

### S-01 — normalization

The design freezes both sides of the normalization contract: query operand lower-casing and whitespace trimming,
with blank-to-null behavior, and focused uppercase/trimmed cases. Tenant and head-company semantics remain outside
this change, as required.

## Scope and authority guard

The current plan and active package continue to forbid database/migration changes, seed/reset execution,
UAT or remote application/browser execution, and Git operations. `businessStatus` and `cleanupStatus` remain
`PENDING`; no dynamic PASS is claimed here. The next required action is implementation under the existing bounded
package, followed by fresh implementation review and separate business/cleanup evidence.

## Required input paths and SHA-256

The hashes below are the exact bytes read in this worktree for this final round.

| path | sha256 |
| --- | --- |
| `AGENTS.md` | `4d64bfb2bb435326a13c2ccb7955dbbbef621259030693e64db3cbf6a0bd9fda` |
| `PLATFORM-BLUEPRINT.md` | `3b90bd602eb682c4718d6c51f399501c34f804cddd96da82d59495e60b115a8d` |
| `doc/platform/roadmap-program-registry.json` | `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` |
| `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `d2490f5038f02ad40b19150a377a2188f313350d965460c3a07ab4c1c3f4eb73` |
| `project-memory/index.md` | `3d0f2cf3fcc52a474871cd3d3dea599f590f4267e2cffedf642336080b69e74b` |
| `scripts/README.md` | `64b5def5f1d04c2ac1fdec71b9c20e8642bc23c33c204c58b62a78a3dd6df106` |
| `project-memory/kernel/01-workspace-and-roadmap.md` | `f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63` |
| `project-memory/kernel/02-service-shape-and-owner.md` | `45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032` |
| `project-memory/kernel/03-transaction-data-and-dependencies.md` | `f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44` |
| `project-memory/kernel/04-contract-consumer-and-admin.md` | `1f6d9efbe0208f5b164d12effd4a4c4ab8f2c297b9b000462dc96820c3efa88d` |
| `project-memory/kernel/05-evidence-runtime-and-git.md` | `f5e219652484338467f0fc03be2bd02d96e09a4a27b812308200673ef720c736` |
| `project-memory/kernel/06-heritage-and-change.md` | `5c52b17aad29ba9d78e327ebe550a740d73f97402041c9f4d31c8df38615566c` |
| `project-memory/decisions/deterministic-context-only.md` | `4c98ed79b0c8e4694893a29ed977fd2eccea6c1562f2d62f32c06dcbb5ac7e20` |
| `project-memory/decisions/independent-subagent-adversarial-review.md` | `891fc8de061560796dc682c5749d73a5d47029592fca197f09f032e3018b4daf` |
| `project-memory/decisions/confirmed-business-language-corpus.md` | `3dba1c80579d4a0eca281efd59d27fbfb20aa86572648f8e36c83a68a603b4f3` |
| `project-memory/operations/business-corpus-adoption-and-read-policy.md` | `d362c4f78c5fc0cb1225a7a4465f82ebbd0c41b886535d69b9f698ea162cd7a9` |
| `project-memory/operations/business-corpus-parked-domain-intake.md` | `739473d09701aba15332c6de72f1f1965b7b5048732fd60d3b97c7934febee9e` |
| `project-memory/decisions/incremental-compliance-hook.md` | `a75469c7eb945b35f06d95cead2e11c368cc4a47dca851f32652556546985f81` |
| `project-memory/operations/implementation-source-reread-discipline.md` | `6944ae47f0e059a52e75096b17620a3c43852e52a9b44e69737554ac646293ce` |
| `project-memory/operations/verification-governance.md` | `e424bf923f1368381b26ef0e22a379a5cdd7bc8b7de887cc2c4e78250f2e0f18` |
| `project-memory/operations/dev-command-separation.md` | `d75229d34422aa70ae1f7506c09633aa9444147932983de3197c5b093414897e` |
| `doc/decisions/2026-07-29-v2s-rm1-ia-04-operations-organization-and-contract-interaction.md` | `416d4c9d385bacdcd7abd164d1d9ae7e6478738fb9c15411ad0673d616d90663` |
| `doc/decisions/2026-08-05-v2s-whole-engineering-d1-d7-rulings-claude.md` | `ebdc56933034980c4798cc0082a1716bf1d9aa7b59a1b9774950307c8f9e9242` |
| `doc/review/platform/2026-08-05-v2s-whole-engineering-remediation-design-and-execution-plan-codex.md` | `50f1b3004566599971420320d95dd0e5db0f27a910a911332bc9b07cd6f83d62` |
| `doc/review/platform/2026-08-05-v2s-whole-engineering-second-package-design-review-input.md` | `76e694ba31ff3bbecd5e80a44fc36534aed20e7b9709af6b7466c4b07f09ae56` |
| `doc/review/platform/2026-08-05-v2s-whole-engineering-second-package-design-review-round1.md` | `f4c57443c3dccaf67655391f8d8a77060a2e9d73a68447e6f64b6790f71aaee3` |
| `doc/plans/platform/2026-08-05-v2s-whole-engineering-second-package-implementation-design.md` | `1ff44d644894b786d34269694b15f97da10dee4ef0ffebabd3f0d78efb90ee9c` |
| `doc/review/platform/2026-08-05-v2s-whole-engineering-second-package-delivery-manifest.json` | `b04fa4a79e7376c19abcd2205e6a234cb57a982ef4aa59c4cddf3b13d9ec2bbd` |
| `.runtime/compliance-control/active-package.json` | `5fcb3ff30c64230c6b3136f955c4c18fd33d16b132e9edaf5349c46cfcf4a55c` |

## Additional current-source reopens and SHA-256

| path | sha256 |
| --- | --- |
| `contracts/openapi/paths/operations-admin/brand-management.paths.yaml` | `973ed608d025a77f70eb12dbeca210832f84e5a8d1956fbb8ee9d5aca7308bad` |
| `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/BusinessEntityService.java` | `da6e182ffeefefa50cf22b7e2384cd71cbb4904e6c8c49fbb05abd52f57cd06e` |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsBusinessEntityController.java` | `ed87dc1c413fde749d91dae6aea721a5f0b907e7c75b55d9428ba0468f1ed90f` |
| `apps/frontend/operations-admin/src/features/business-entity-management/application/HeadCompanyBrandAuthorizationActionAdapter.ts` | `c67bece4e76f32e11edbde825d161f2bd521c6531c8d625110c2550cf5aba1c3` |
| `apps/frontend/operations-admin/src/features/business-entity-management/ui/HeadCompanyBrandAuthorizationDrawer.tsx` | `f50982e55b1e04f3014d5e7166b42bd3423b1af714c5e8a3a89c8a5fbd2f422b` |
| `libraries/frontend/admin-ui-foundation/src/behavior/useDrawerFormLifecycle.ts` | `96a7419261a192a595b40f94c93a005266500b7a961ff988e49451d5102f0589` |
| `scripts/dev/r5-dev-environment.mjs` | `9e610f8956bb7a55236eb28e1ce8d5cbe49b9549b08cc53ceb49570c9ed44334` |
| `scripts/dev/r5-reset.mjs` | `9df0982cf0adc5c0d18560e42180b6e0f854853276f88890c7490680386aabe0` |
| `scripts/dev/r5-dev-runner.mjs` | `06db4f9253a703ca772bac6232fd3d18e55d054ab105bb9a586a80b2b6a3201a` |
| `scripts/dev/http-diagnostic-runner.mjs` | `e52b7b26fccb8d77d30f856c889cae5e8aa56753c3aec954de2c85485b5d2685` |
| `scripts/dev/r5-seed-bootstrap.mjs` | `27b6f339d345eb947555d9e34860472d6289325e6d819f8bed53e8b1420c8cd6` |
| `scripts/dev/terminal-fixture-state.mjs` | `4d1f7f8aed30b42b5703ab1ba09c0b9f457ca2cbe3e38067759687770a7761af` |
| `scripts/test/r5-joint-remote-l2.mjs` | `4196a41d3cf8ae56cfe731b15780c9feb1301f7a6662170b08b93ed023ffcaa0` |
| `scripts/test/r5-remote-testcontainers.mjs` | `054360b323d4305c18145868a1c9d4a045c3be8e2d114809c1075bf1261b0c8d` |
