# BP-U05 clean implementation｜Cycle 3 Round 1 作者处置

`REVIEW_CYCLE_ID=OVERALL_PHASE_4_U05_CLEAN_IMPLEMENTATION_REVIEW_3_20260809`  
`REVIEW_TARGET=IMPLEMENTATION`  
`AUTHOR_INTAKE_AFTER_INDEPENDENT_ROUND=1`

## 用户任务与阶段意图

BP-U05 要把 78 条 task-read 收敛在有限的 owner-local typed reader 边界，同时诚实保留未授权动态工作负载下的 `BLOCKED_UNMEASURED`。Dexter 已授权本 fresh review cycle；BP-U06、运行环境和 SQL 数值成功仍严格排除。

## Round 1 finding disposition

| Finding | Disposition | 当前证据与最小处置 |
|---|---|---|
| rebaseline manifest POST_REMEDIATION binding invalid | `REJECTED_WITH_EVIDENCE` | Round 1 报告引用的旧 SHA 已失效。当前 `scripts/check/implementation-design-granularity --manifest doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-rebaseline-design-granularity-manifest.json --review doc/review/platform/2026-08-09-v2s-backend-performance-phase4-owner-projection-rebaseline-design-review-round2.md` 返回 PASS，且 review SHA `cb55d66ae20f3c7ba53e670c3309a7f9efd8bb8cee7a02c2cc4d296adfadd9b0` 与声明相等。前序修复把 design/policy SHA 及六个已存在 surface 的 `create` 状态同步为 current bytes；没有放宽 post-remediation 模式。 |
| two audit edges accept `Long.MAX_VALUE, 1` | `CONFIRMED` | 原因是只依赖 `Math.addExact`，边界等于 `Long.MAX_VALUE` 不会溢出。两个 `validPage` 现在拒绝 `offset >= Long.MAX_VALUE - pageSize`，所以 page-size 1 与 2 都在 reader 前转为 `InvalidEdgeRequestException`。同根两个 edge 一并修复。 |
| operations audit proof supplies null assignment/visible facts | `CONFIRMED` | test 现显式设定 `assignmentNodeType=STORE` 与 immutable visible-facts mock，并对六个 organization variants 及 contract variant verify exact scope, fact, target, page, pageSize；`verifyNoMoreInteractions` 保持。 |

## 反例、替代与范围

- 不选以 `Math.addExact` 作为唯一上界判定：它漏掉 end-exclusive 页边界恰等于 `Long.MAX_VALUE` 的反例。
- 不选通过新增全局 pagination helper 来关闭：两个现有 private helpers 是完整有限适用面，局部同根修复避免超出 BP-U05。
- 不选以 aggregate owner call count 代替事实参数验证：它无法发现 assignment/visible facts 被误丢弃。
- 所有受影响路径均已有 Pre/Post receipt；`compileTestJava` 已通过。由于 `runtimeAuthority=false`，没有运行受管 Testcontainers，不能将 compile-only 说成动态业务验收。

## Round 2 定向核验请求

fresh 独立 reviewer 只核验：

1. 两份 granularity binding 的 current command；
2. 两 audit edge 的 `Long.MAX_VALUE`/1 和 /2 reader-before-reject source/test contract；
3. nine-variant operations audit 传递 exact non-null authorization/visibility inputs 且无额外 owner read；
4. BP-U06、runtime、SQL performance success 均未进入。

Round 2 是本 cycle 的最终轮，必须 `ROUND_FINAL_DECISION=SELF_DECIDED`。
