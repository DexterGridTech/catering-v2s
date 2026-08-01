---
REVIEW_CYCLE_ID: RM1-U01-IMPLEMENTATION-20260728
REVIEW_TARGET: IMPLEMENTATION
REVIEW_ROUND: 1
REVIEW_ROUND_LIMIT: 2
reviewerKind: INDEPENDENT_SUBAGENT
verdict: GO
severity: M=0 / S=0 / N=0
authorizationBoundary: Read-only independent P0 review only; no production-source modification, DEV, seed, reset, migration, Roadmap-state action, or P2 aggregate execution is authorized by this artifact.
---

# RM1-U01 P0 independent implementation adversarial review — round 1

REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=RM1-U01-IMPLEMENTATION-20260728
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2

## Verdict

**GO — M=0 / S=0 / N=0.** The reviewed P0 current bytes close the Claude NO-GO
mechanism defects. P0 remains a control-first RM1 package; this verdict neither
advances P2 nor treats `scripts/verify` as P0 execution evidence.

## Independent-review record

`blindReviewDeclaration=I independently reopened current sources, package evidence,
and executable counterexamples to try to disprove P0 before accepting any prior
finding. The required Claude NO-GO and author re-open result were subsequently used
only as finding inputs; no conclusion was adopted without source evidence.`

`authorMaterialReadAfterIndependentVerdict=true` — the author re-open result below
was compared after the independent source checks, not substituted for them.

`reviewerInputChecklist` is embedded here because this is the single authorized
review artifact. All required files were read:

| path | SHA-256 |
| --- | --- |
| `AGENTS.md` | `f179f36d8aade8e4cb01def3637aef3a41dc031f79720c4fa13c1a58e3384414` |
| `project-memory/decisions/deterministic-context-only.md` | `4c98ed79b0c8e4694893a29ed977fd2eccea6c1562f2d62f32c06dcbb5ac7e20` |
| `contracts/policy/standards-coverage-matrix.json` | `6a9f7a700d1b4dbbf3e6fb910a1a291f95d61777c70120e7ae049c4b415101c5` |
| `doc/review/platform/2026-07-28-v2s-rm1-p0-implementation-review-claude.md` | `705bf83a7a0e05ef6920933d035b9f521b03002b07c5e0b249077e38fd8ce52e` |
| `doc/evidence/platform/rm1/p0/rm1-u01-package-input.json` | `bf00258ffb9b17cdef7a156bd0a500c1856cfefdf53d160736b8ef5e66e40072` |
| `doc/evidence/platform/rm1/p0/rm1-u01-package-exit.json` | `89566967570672f125fe10e150e4e191a7852b11112ce6d7482d5087f6bd8d34` |
| `doc/evidence/platform/rm1/p0/rm1-u01-control-evidence.json` | `ba7acb331c28eea18255b1edf98408918f32d3b799048f857b34f6678259e692` |
| `doc/evidence/platform/rm1/p0/rm1-u01-claude-no-go-intake.json` | `e0151c5e80923e30209796ef2ffe5c31a152a186d9b440dcefb39115b02fb7d2` |
| `scripts/run/rm1-p0-standards-execution` | `f76f9dd74b754afb4b6a0240c9d33ed0b00a30c68575f9cea11612059b380a10` |
| `tools/verify-gates/cli.mjs` | `8c1246e1246c06995290acc12e5c46a0a0c3506ca6bc84fdec86aed78d7960a1` |
| `tools/compliance-control/cli.mjs` | `b66dcdd083008d81a3f4d0af12f83e493539f7eee9f43bad3772c304bee47607` |
| `contracts/policy/affected-l2-registry.json` | `e64ada918384d905d6077da9e676e15be1e64e3d3d2d1fd104f64eb14ec99963` |
| `.runtime/managed-runs/rm1-p0-standards-20260728T070240Z-809/manifest.json` | `e10a221750061630b2563dcb52ce76a13410933f84c59699ece9c60e247cac1f` |

Route recall also read all project-memory kernel entries plus the routed deterministic
context and independent-review decisions. `NO_CORPUS_ENTRY_MATCHED` for this
control-only review (queries: `RM1`, `P0`, `affected-l2`, `DEFERRED`).

## Re-opened Claude NO-GO findings

| finding | independent disposition | source evidence |
| --- | --- | --- |
| M1 — non-final runner failure could be swallowed | `REJECTED_WITH_EVIDENCE` | `scripts/run/rm1-p0-standards-execution:19-32` records each command's `PIPESTATUS[0]`, accumulates every nonzero result, and only reports `standardsExecution=PASS` if none failed. Its scratch self-test produced `RM1_P0_RUNNER_FIRST_FAILURE_RED=PASS`. |
| M2 — current L2 debt red made the P0 manifest false-green | `REJECTED_WITH_EVIDENCE` | The registry now contains the exact 18 legacy entries as `DEFERRED` until `RM2`; current RM1 production gate is PASS and `scripts/check/affected-l2 --phase RM2` independently fails with `R5_AFFECTED_L2_DEFERRED_EXPIRED`. |
| M3 — package exit omitted/refuted production control status | `REJECTED_WITH_EVIDENCE` | Manifest and exit have the exact five-entry `controlRefStatus`. `tools/compliance-control/cli.mjs:475-509` checks manifest hash, exact ref set, zero exit codes, business `NOT_APPLICABLE`, standardsExecution `PASS`, cleanup `PASS`, and status equality; `validate-package-exit` passed. |
| S1 — overloaded `business` state | `REJECTED_WITH_EVIDENCE` | Managed manifest now separates `business.status=NOT_APPLICABLE` from `standardsExecution.status=PASS`; the exit retains business `NOT_APPLICABLE`. |

## Candidate aggregate finding rejected after author re-open

**Classification: `REJECTED_WITH_EVIDENCE`.** I observed that
`tools/verify-gates/verify.mjs:19` invokes `scripts/check/affected-l2` without an
explicit phase, while `tools/verify-gates/cli.mjs:432-470` defaults the standalone
checker to RM1. This is not a P0 defect: P0 is the authorized RM1 package, and its
required P-C3 production evidence is exactly the RM1 run. The `deferredUntilPhase:
"RM2"` deadline is deliberately proven by the direct RM2 red invocation; P2 owns
the later aggregate and post-restructure P-C3 execution. Treating a future P2
aggregate's phase binding as a required P0 change would violate the approved serial
boundary and expand scope.

The author independently reopened the attempted aggregate run: it failed first in
the P2-owned `U02-flyway` step, with no Testcontainers started, and the result was
not used as P0 evidence. This is a valid scope boundary and does not alter the
direct RM2 expiry proof above.

## Checks executed

All actions were static, scratch self-tests, or read-only validators. No DEV, seed,
reset, migration, or dynamic business environment was run.

```text
scripts/check/standards-coverage --phase R5                           PASS (RULES=150)
scripts/run/rm1-p0-standards-execution --self-test                    PASS
scripts/check/affected-l2                                             PASS (PHASE=RM1)
scripts/check/affected-l2 --phase RM2                                 expected FAIL (DEFERRED_EXPIRED)
scripts/check/affected-l2 --self-test                                 PASS (missing/empty/expiry red fixtures)
node tools/compliance-control/cli.mjs rm1-p0-binding-self-test        PASS
node tools/compliance-control/cli.mjs rm1-p0-intake-recovery-self-test PASS
node tools/compliance-control/cli.mjs validate-package-exit <exit>    PASS
node tools/compliance-control/cli.mjs static-scan                     PASS
bash -n scripts/run/rm1-p0-standards-execution                        PASS
```

## Closure boundary

The GO is limited to P0 current bytes and the four re-opened findings. P3-A/P4,
P2-owned aggregate/Flyway work, user behavior, database/runtime actions, and any
successor package remain outside this review.

## 用户任务

业务用户不直接操作本 P0 control-only package；用户任务是让其后续验证不会把已失败的
控制误报为 PASS，并且只接受 RM1 已授权的控制证据。

## Dexter 立场

Dexter 的明确边界是 P0 独立 implementation 复核，不扩大到 P2、动态环境或业务变更。

## 替代方案

替代方案是把未来 P2 aggregate 的 phase 接线提前放入 P0；不选，因为它跨越 P0/P2 serial
边界。当前取舍是保留 P0 的 RM1 production proof 和 RM2 direct-red deadline proof。

## 方案合理性

问题是 P0 是否诚实地报告当前 RM1 控制状态；方案以逐命令退出码和 exact manifest/exit
状态闭合，收益是消除假绿，代价和复杂度限于现有控制。未来 aggregate 接线另属 P2，不能以
提前修改扩大 P0。

## UI 与交互

NOT_APPLICABLE：本审查不涉及 UI、用户操作或 Journey；它只验证静态控制与证据路径。

## 审查意见复核

M1–M3/S1 均为 `REJECTED_WITH_EVIDENCE`，见上方重开表。候选 aggregate finding 亦为
`REJECTED_WITH_EVIDENCE`：反例是 direct `--phase RM2` 的到期红；适用边界是 P0=RM1、
P2 才拥有 aggregate。证据为源码和实际复核输出；更小修复是后续 P2 按其范围接线，而非在
P0 引入过度设计或成本。

## 实施代码核验

已重开 runner、verify-gates 与 compliance-control 源码。执行的 scratch self-test、静态运行
和 manifest evidence 如上，均通过；没有业务用户行为或 Journey 被 P0 改动，业务结果为
NOT_APPLICABLE。

## 闭环核验

package-exit validator、静态扫描、R5 standards coverage、runner/affected-L2/self-test 均已
复核；cleanup 和 business 字段也在 managed manifest/exit 中独立闭合。

## 结论

VERDICT=GO
