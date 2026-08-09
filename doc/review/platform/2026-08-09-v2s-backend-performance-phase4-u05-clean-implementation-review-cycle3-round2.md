REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=OVERALL_PHASE_4_U05_CLEAN_IMPLEMENTATION_REVIEW_3_20260809
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist={path=doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-clean-implementation-review-cycle3-input-checklist.md,sha256=e8b569ee3ea15a693ddf52172681ba8479c23a87e1e40105665ed134cfb589bd}
blindReviewDeclaration=Fresh independent Round 2 reopened the current package input, manifests, production source, focused-test source and controlling checks to disprove each Cycle 3 Round 1 finding before reading the author intake; current command and source bytes control this verdict.
authorMaterialReadAfterIndependentVerdict=true

# BP-U05 clean implementation｜Cycle 3 / Round 2 final independent adversarial review

## 用户任务

业务用户需要 audit HTTP readback 在有限 owner-local typed reader 边界内稳定运行：非法超大分页必须得到 typed invalid-request，而不能将溢出送入 owner reader。BP-U05 同时必须诚实维持未测量状态，不能把静态 source closure 宣称为性能成功。

## Dexter 立场

Dexter 授权本 fresh Cycle 3 的最终 Round 2，只重验 Cycle 3 Round 1 的两份 granularity binding、两个 audit edge 的最大分页边界、九变体 owner 参数以及范围诚实性。BP-U06、DEV、reset、seed、L2、UAT、部署和任何 SQL 数值成功均不在本轮授权内。

## 替代方案

可以只接受作者 intake 或只看两个新测试断言；不选，因为它们都不能替代 current manifest command 与生产路径的反证。也可以为分页创建全局 helper；不选，因为两个 private `validPage` 是当前有限同根分母，局部一致的 checked-end 边界以更小成本保留既有 HTTP 行为和 BP-U05 范围。

## 方案合理性

问题的根因是 exclusive page end 恰等于 `Long.MAX_VALUE` 时，乘法不溢出但 owner reader 不应接收这个不可表示的页窗。两个 edge 在 reader 调用前以 `offset >= Long.MAX_VALUE - pageSize` 拒绝，覆盖 `Long.MAX_VALUE × 1` 与 `× 2`，是比扩大抽象或改变 owner API 更小的方案。九个 sealed query variant 仍保持固定实体类型与命名 owner；focused proof 以 exact scope/facts/target/page/pageSize 和 no-extra interaction 把授权事实丢失的反例变为可见失败。

## UI 与交互

NOT_APPLICABLE：理由：本轮没有 UI、Journey、页面或文案变化。审查的是既有 audit HTTP 参数的 typed failure；它不新增用户操作路径，也不改变 `platform-admin` 与 `operations-admin` 的独立边界。

## 实施代码核验

已重开 current production 源码、focused-test 源码和静态 command evidence；未运行动态测试，因为 package 的 `runtimeAuthority=false`，因此没有把编译、测试或静态 evidence 误报为动态业务结果。

1. 两条 required binding command 都返回 `IMPLEMENTATION_DESIGN_GRANULARITY=PASS`：
   - `scripts/check/implementation-design-granularity --manifest doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-rebaseline-design-granularity-manifest.json --review doc/review/platform/2026-08-09-v2s-backend-performance-phase4-owner-projection-rebaseline-design-review-round2.md`，并诚实输出 `REVIEW_BINDING_MODE=DECLARED_POST_REMEDIATION_AWAITING_CLAUDE`；
   - 同一 command 对 `...u05-remaining-owner-projection-design-granularity-manifest.json` 与 `...u05-remaining-owner-projection-design-review-round2.md` 也 PASS，且同样是 `DECLARED_POST_REMEDIATION_AWAITING_CLAUDE`，不是 performance 或 runtime success。
2. 两个 edge 都先解析 session，再在其唯一 reader 调用前执行相同的 checked end-bound：Operations [controller](../../../apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/audit/OperationsAuditHistoryController.java#L36) 的 reader 在 L38、验证在 L61-L72；Platform [controller](../../../apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/audit/PlatformAuditHistoryController.java#L32) 的 reader 在 L34、验证在 L66-L75。`offset >= Long.MAX_VALUE - pageSize` 因而对 page=`Long.MAX_VALUE`、size=1 和 size=2 均抛 `InvalidEdgeRequestException`，且两份 source-focused tests 对两种 size 都 `verifyNoInteractions(reads)`：[operations test](../../../apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/edge/operations/audit/OperationsAuditHistoryControllerTest.java#L36) 与 [platform test](../../../apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/edge/platform/audit/PlatformAuditHistoryControllerTest.java#L68)。
3. [OperationsAuditTaskReadService](../../../apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/application/audit/OperationsAuditTaskReadService.java#L35) 是 nine-type sealed switch：2 个 workspace-IAM、6 个 organization、1 个 contract 分支。其 focused proof 构造非空 `assignmentNodeType=STORE` 和 `visibleFacts`，逐条 `same/eq` 验证 target、page=1、pageSize=20、scope 与 facts，并以 `verifyNoMoreInteractions` 拒绝额外 owner 调用：[test](../../../apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/application/audit/OperationsAuditTaskReadServiceTest.java#L29)。
4. `scripts/check/backend-performance-read-budget --check` PASS（83 GET / 78 task-read / 5 exemption、9 audit types、`BP_U05_READ_BUDGET_STATUS=BLOCKED_UNMEASURED`）；`scripts/check/backend-performance-sql-merge-coverage` PASS 且 `BP_U07_SQL_MERGE_SUCCESS=BLOCKED_UNMEASURED`；`scripts/check/standards-coverage --phase RM1-P6-3` PASS（phase alias R5）。package input 仍明确排除 BP-U06 和 runtime，禁止 `operationId dispatch`、跨 schema DML、command-to-task-reader 与 SQL numeric success：[package input](../../evidence/platform/2026-08-09-v2s-backend-performance-phase4-u05-clean-implementation-package-input.json)。这些 output 只证明静态治理和 source 状态，未构成业务用户的动态 performance success。

## 审查意见复核

- `U05-C3-R1-M-01 REJECTED_WITH_EVIDENCE`：独立重跑两条指定 granularity command 均 PASS。适用边界是两个 current manifest 与各自 bound Round 2 design review；反例是旧 SHA 或错误 review path，会由 command fail closed。更小处置仅是让 current binding 成为审查依据，不扩大到 BP-U06 或重写 control。
- `U05-C3-R1-M-02 CONFIRMED_REMEDIATED`：源码与 tests 都证明两个 controller 对 size 1/2 的 `Long.MAX_VALUE` 在 owner reader 前得到 typed rejection。反例是仅依赖 `Math.multiplyExact` 或仅覆盖 size 2，都会漏掉 end 恰等于 `Long.MAX_VALUE` 的 size-1 边界。更小修复是当前两个 private validator 的同根检查。
- `U05-C3-R1-S-01 CONFIRMED_REMEDIATED`：重新打开 source/test 后，六个 organization variant 均携带非空 assignment/visibility facts，contract 变体携带非空 visibility facts，workspace-IAM 两变体传递 exact facts；所有九个 target/page 值均显式验证且 no-extra owner call 仍受约束。适用边界是 operations-audit nine-variant reader，不把该证明泛化为其他 owner projection tests；以 aggregate call count 代替参数验证仍是反例。更小修复是已有 focused test 的精确 matcher，不新增 dispatch abstraction。

作者 intake 在上述独立结论形成后才被读取；其三个 disposition 与 current source/command 一致，但没有替代本轮 source reopen。

## 闭环核验

Round 1 的两个 M 和一个 S 已分别由 current command 与当前 production/test source 关闭；本轮没有新增 finding。动态 business/cleanup evidence 没有运行、也没有被本轮宣称为 PASS：这是 package 的明确 runtime exclusion，而非遗留 M/S。Cycle 3 已达 Round 2/2 hard stop，`ROUND_FINAL_DECISION=SELF_DECIDED`，不得以本范围另开第三轮。

## 结论

`VERDICT=GO`

`M=0 / S=0 / N=4`

N-01 granularity binding 的 PASS 仍是 `DECLARED_POST_REMEDIATION_AWAITING_CLAUDE`；N-02 两个 maximum-page counterexample 均在 reader 前失败；N-03 nine-variant exact owner argument/no-extra proof 通过 source audit；N-04 BP-U06/runtime/performance-success scope 无漂移且 status 仍为 `BLOCKED_UNMEASURED`。本 GO 只关闭 Cycle 3 Round 2 指定静态 implementation-review findings，不授予 runtime、动态 business/cleanup、BP-U06 或 SQL performance-success authority。
