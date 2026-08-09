---

REVIEW_CYCLE_ID=OVERALL_PHASE_4_U05_CLEAN_IMPLEMENTATION_20260809
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
reviewerKind=INDEPENDENT_SUBAGENT
REVIEW_CYCLE_ID: OVERALL_PHASE_4_U05_CLEAN_IMPLEMENTATION_20260809
REVIEW_TARGET: IMPLEMENTATION
REVIEW_ROUND: 2
REVIEW_ROUND_LIMIT: 2
ROUND_FINAL_DECISION: SELF_DECIDED
reviewerKind: INDEPENDENT_SUBAGENT
status: FINAL_ROUND_2
---

# BP-U05 clean implementation adversarial review — Round 2

## Blind-review declaration and input binding

This final-round verdict re-opened current production bytes, tests, policy/generator and package
authority independently. It was formed before any author disposition. Round 1 is an archived reviewer
verdict, not implementation evidence.

| Input | SHA-256 |
| --- | --- |
| `AGENTS.md` | `4d64bfb2bb435326a13c2ccb7955dbbbef621259030693e64db3cbf6a0bd9fda` |
| `PLATFORM-BLUEPRINT.md` | `38d6138be17a514ded4188f8f71555c480eb3582abcb4f265ffa757792d9b039` |
| `doc/evidence/platform/2026-08-09-v2s-backend-performance-phase4-u05-clean-implementation-package-input.json` | `1199fae0b39019ae9285e483f733dfb51d91c555dcc8de4f5e0cee1fb11e2da8` |
| `doc/decisions/2026-08-09-v2s-backend-performance-phase4-owner-projection-rebaseline.md` | `cd475e35288e9ebdafd3380d7756e27daeab0f17fdcf15e193cf92e9c8b30759` |
| `doc/plans/platform/2026-08-08-v2s-backend-performance-refactor-implementation-design-codex.md` | `79ecbd69629f764529aa647cafa9efeea12f0cfe4a34a9904d87027b161c6f69` |
| `contracts/registry/task-read-surface-policy.json` | `a1f54fc79621ab204f6c6921fe8b4142cd6e1f420325c730bacc22d589bd6617` |
| `scripts/generate/task-read-surface-policy.mjs` | `888db8289f17ce6f3f9e1e6a31e7a101298d12f45b70002344758eed8d08a9be` |

## Round 1 directed rechecks

1. **Operations audit repair confirmed.** UUID parsing and the 1..100 page bounds now occur before
   `reads.read`, and the focused test asserts that invalid input never reaches the reader.
   - `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/audit/OperationsAuditHistoryController.java:34-64`
   - `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/edge/operations/audit/OperationsAuditHistoryControllerTest.java:35-43`
2. **The executable workspace-key regression is confirmed.**
   - `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/edge/platform/audit/PlatformAuditHistoryControllerTest.java:60-66`
3. **Platform audit test stubs now name `readPlatformAuditProjection`, but do not prove invocation.**
   The test accepts a null default result and asserts only `workspaces.requireEnabled`; a mutation that
   bypasses or redirects the workspace-IAM projection can still pass.
   - `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/application/audit/PlatformAuditHistoryTaskReadServiceTest.java:51-62`
   - `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/application/audit/PlatformAuditHistoryTaskReadServiceTest.java:88-99`

## Final findings

`M=1 / S=2 / N=2` — **NO-GO.** This is the hard stop for the cycle; no Round 3 is permitted.

### M-01 — the implementation-facing design evidence fails its own current-byte binding

The required `implementation-design-granularity` invocation fails with
`UNIT_SOURCE_BP-U05_1_HASH_DRIFT`. The manifest's delivery-unit source hash is
`cd5db...`, whereas its top-level design binding and current design file are `79ec...`.
Consequently it cannot establish the required source denominator for the current implementation.

- `doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-remaining-owner-projection-design-granularity-manifest.json:7-10`
- `doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-remaining-owner-projection-design-granularity-manifest.json:78-82`
- command: `scripts/check/implementation-design-granularity --manifest doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-remaining-owner-projection-design-granularity-manifest.json --review doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-remaining-owner-projection-design-review-round2.md`

The clean package exit honestly remains PENDING, but that does not repair the failed implementation
design evidence.

- `doc/evidence/platform/2026-08-09-v2s-backend-performance-phase4-u05-clean-implementation-package-exit.json:5-10`

### S-01 — both audit edges still admit overflowing pagination

Both edges now reject ordinary invalid UUIDs and bounds, but still accept
`page=Long.MAX_VALUE&pageSize=2`. Platform owner branches reach an unhandled
`Math.multiplyExact` overflow; operations owner branches use a wrapping `(page - 1) * pageSize` offset.
That is not a valid contract Problem response and can instead become an internal failure or a negative
database offset. This is the remaining validation family from Round 1 S-01.

- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/audit/OperationsAuditHistoryController.java:61-64`
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/audit/PlatformAuditHistoryController.java:66-68`
- `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceIamAuditHistoryService.java:51-53`
- `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceIamAuditHistoryService.java:115`
- `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationAuditHistoryService.java:107`
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/problem/ContractProblemAdvice.java:153-179`

Minimum repair: reject overflowing pagination at both edges before `reads.read`, and add
`Long.MAX_VALUE, 2` negative proof. Preserve branch-specific target formats (`GROUP_WORKSPACE` key and
extension type remain strings; do not impose a global UUID rule).

### S-02 — four required focused owner-reader proof surfaces are absent

The approved delivery surface declares focused create-tests for the operations audit reader, platform
workspace page/detail reader, workspace-IAM summary reader and organization initialization reader. None
exists. Existing controller mocks cannot prove each owner-local query's cap, typed failure or no-legacy
path behavior, and the manifest explicitly makes focused proof a precondition to deriving 78/0.

- `doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-remaining-owner-projection-design-granularity-manifest.json:111-128`
- `doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-remaining-owner-projection-design-granularity-manifest.json:135-145`

### N-01 — workspace-IAM projection proof remains non-discriminating

The renamed mocks in the parameterized test are insufficient because the return value is unasserted and
there is no `verify(...readPlatformAuditProjection(...))`/`verifyNoMoreInteractions`. Add exact owner
call verification per hosted variant; this is evidence hardening, not a generic test framework.

- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/application/audit/PlatformAuditHistoryTaskReadServiceTest.java:53-62`
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/application/audit/PlatformAuditHistoryTaskReadServiceTest.java:88-99`

### N-02 — the manifest's declared current deviation is stale

It says the policy reports `65 TASK_READER / 13 NOT_YET_TASK_READER`, contradicting the current policy
and clean package's `78 / 0`. This is non-blocking beside M-01, but makes the artifact unsuitable as a
current explanatory source until reconciled.

- `doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-remaining-owner-projection-design-granularity-manifest.json:99`
- `doc/evidence/platform/2026-08-09-v2s-backend-performance-phase4-u05-clean-implementation-package-input.json:11-18`

## Static and compilation evidence

- `node scripts/generate/task-read-surface-policy.mjs --check`: PASS; 83 GET / 78 task reads /
  5 protocol exemptions, 10 exact multi-owner exceptions, and `BP_U05_READ_BUDGET_STATUS=BLOCKED_UNMEASURED`.
- `scripts/check/backend-performance-read-budget --self-test`: PASS; 59 red fixtures.
- `scripts/check/backend-performance-sql-merge-coverage --self-test`: PASS; 19 red fixtures and
  `BP_U07_SQL_MERGE_SUCCESS=BLOCKED_UNMEASURED`.
- `gradle :apps:backend:catering-business-server:compileJava --no-daemon`: PASS.
- `gradle :apps:backend:catering-business-server:compileTestJava --no-daemon`: PASS.

These checks do not authorize runtime or numeric SQL success.

## Scope and truthfulness recheck

The package input continues to exclude BP-U06, DEV, reset, seed, L2, UAT and deployment. The binding
registry remains `DEFERRED_TO_BP_U06`; no dispatcher retirement/cutover was found. The clean package exit
remains PENDING with business and cleanup both `NOT_RUN_BLOCKED_UNMEASURED`.

## 用户任务

业务用户需要审计 GET 在 reader 前以契约化 ProblemResponse 拒绝非法 wire 输入，同时 BP-U05 clean
package 仅声称可证明的静态实施状态。范围是 78/83 task-read 转换，不包括 BP-U06 或动态执行。

## Dexter 立场

Dexter 授权本 cycle 进行 IMPLEMENTATION Round 2/2 独立定向盲审及 review artifact 写入；生产与
控制源码、runtime、DEV、seed、reset、L2、UAT 和 deployment 都不在本轮授权内。

## 替代方案

替代方案是分页溢出在 owner query 中统一捕获，也可以在两个 HTTP edge 用无溢出的上界判定预先
拒绝。后者保持 HTTP/Problem 语义在 edge、避免把损坏 offset 传入多 owner query，是更小且适用面明确
的修复；不选前者是基于该职责边界的明确取舍。不要为此改变 owner 的 not-found/denied 行为或强制
所有平台 target 使用 UUID。

## 方案合理性

问题是 Round 1 的普通 UUID/page 修补未覆盖溢出输入族；该修补是 PARTIALLY_CONFIRMED：它正确使普通
非法输入在 reader 前失败，但 `Long.MAX_VALUE,2` 是同一输入族的反例。方案的复杂度和代价很小：M-01
修复 manifest current-byte binding，S-02 补齐声明的 focused proof；收益是使 78/0 分母可核验，两者
均不能由已有 controller mock、编译或 policy PASS 代替。

## UI 与交互

NOT_APPLICABLE：理由是本轮仅复核后端 audit GET、owner projection 与静态证据；没有 UI-bearing Journey、
页面、interaction 或视觉取舍变更。

## 审查意见复核

Round 1 S-01 为 PARTIALLY_CONFIRMED：operations edge 已在 reader 前验证普通 UUID/page，workspace-key
case 也已成为 executable test；但 `Long.MAX_VALUE,2` 的反例在重开源码后仍成立。Round 1 N-01 为
PARTIALLY_CONFIRMED：测试已改用 `readPlatformAuditProjection` stub，却未 verify 该 owner call。Round 1
N-02 CONFIRMED_RESOLVED：workspace-key method 已有 `@Test`。证据是上述 production source 与 test 的
复核；适用边界是 hosted platform variants。更小修复是增 exact verify 与 overflow negative test，避免
过度设计。 本轮在形成 verdict 前未使用作者 disposition。

## 实施代码核验

已重新打开两个 audit edge、owner projection 算术、Problem advice、focused tests 的生产源码，以及 policy/
manifest 与 package input；运行 `compileJava` 和 `compileTestJava` 通过，83/78/5 policy、59-red read-budget self-test
和 19-red SQL self-test 也通过。业务用户行为仍是非法审计 GET 返回 ProblemResponse；没有启动 runtime，
这些静态/编译 evidence 不证明 SQL numeric success、business 或 cleanup。

## 闭环核验

BP-U06 zero-entry 仍成立：package input 排除 BP-U06，binding registry 保持 `DEFERRED_TO_BP_U06`；
状态表述保持 `BLOCKED_UNMEASURED`。但 design-granularity 当前命令因 hash drift FAIL，clean exit 为
PENDING，且 S-01/S-02 未关闭；不存在可审计的 package exit closure。

## 结论

VERDICT=NO_GO。M=1 / S=2 / N=2。REVIEW_ROUND=2 且 REVIEW_ROUND_LIMIT=2，
ROUND_FINAL_DECISION=SELF_DECIDED；此 cycle 硬停止，不得发起 Round 3。
