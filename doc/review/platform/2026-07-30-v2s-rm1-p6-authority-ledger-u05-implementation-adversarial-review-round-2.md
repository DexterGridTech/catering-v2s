---
title: RM1 P6 authority-ledger U05 implementation adversarial review round 2
status: COMPLETE
reviewerKind: INDEPENDENT_SUBAGENT
reviewRound: 2
---

# RM1 P6 authority-ledger U05 implementation adversarial review — Round 2

REVIEW_CYCLE_ID=RM1P6-AUTHORITY-LEDGER-U05-IMPLEMENTATION
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
reviewerKind=INDEPENDENT_SUBAGENT

## Blind declaration and bounded input

This is a fresh v2s-rooted independent targeted review. Before this verdict, the
reviewer did not open Round 1, any author disposition, or any prior U05 review.
The review tried to falsify the narrow claim that the current implementation
reconciles only the P6-owned selected rows without converting known external debt
into a full-ledger or business conclusion.

Mandatory entry/source checklist (path@sha256):

- `AGENTS.md@e4e3c9af4fb0dc46ce5403edadb6704d1d4a60dea186efc9cbe22dd62fddb347`
- `CLAUDE.md@8b12b36e0c852f3a55f40f29d3d21101b9acb113b969ff5f8a9c2152c2aec50f`
- `PLATFORM-BLUEPRINT.md@29bcd8930f9ce75627ca32902f7fabc40c2c93c611e15db6a416cf7d8e3fab4d`
- `doc/platform/README.md@809f9567df2048bfe40c254c6a613dae7535a6fdebb802f8a06b1e15ebd3687e`
- `doc/platform/roadmap-program-registry.json@f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8`
- `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md@dde1ef52a134bcb4134ce5b1c42886576a58853bae2593b8b0bb35ad38b8a2cd`
- `project-memory/decisions/deterministic-context-only.md@4c98ed79b0c8e4694893a29ed977fd2eccea6c1562f2d62f32c06dcbb5ac7e20`
- `contracts/policy/standards-coverage-matrix.json@7d390eb692b627d876cdbfe34d03c140ce4f8450333c2d7618c849ced2fb55b3`
- `doc/evidence/platform/rm1/p6/rm1p6-authority-ledger-u05-implementation-amendment.md@387c0309fa48a7ef6ad7cd81964e60e3e1dc047e3f220ffbc07f45551d44f11a`
- `doc/evidence/platform/rm1/p6/rm1p6-authority-ledger-u05-problem-family.json@be5fee23d773916e3c760b59a66af0e646d91ef3f2ab4302fa18f07d3d1a4591`
- `doc/evidence/platform/rm1/p6/rm1p6-authority-ledger-u05-package-input.json@51fa2f4f87d615319714b8c0216521ead85ab3c5f689b172fb83a7e898b0385a`
- `doc/evidence/platform/rm1/p6/rm1p6-authority-ledger-u05-source-compliance-disposition.json@919118b973e0f5643bb453fdc081b912277a04a2f2539be44d113dd43d6e8ca2`
- `doc/evidence/platform/rm1/p6/rm1-u09-implementation-design-granularity-manifest.json@8e7a3c0b345697b7aa0b1e633711e1f90a2b96a05923382dfdc4435e435ca1bb` (unit selector only)
- `doc/evidence/platform/rm1/p1/authority-ledger.json@6d97e7a09e5b65aec2fd6de0e05016a1a9341fc032860c99177a08fb7dafafa5` (ST-2/ST-3/ST-8/ST-9/ST-11 selectors only)
- `doc/evidence/platform/rm1/p6/rm1p6-u02-ui-ia-implementation-baseline.json@e84c690704796bdc08a3f2e47279de42a1117648794446de2be187fe0f43c225`
- `tools/authority-source-ledger/cli.mjs@90ab968ac6b6b5f0db3748fd1f2a49c50b423d0e81c6b251757809e11c70d059`

The six-dimension recall route was `review/platform/platform-admin/platform/evidence/review`.
All returned kernels and routed project-memory records were reopened before the
targeted sources; the route does not enlarge this verdict's approved surface.

## Independent falsification results

## 用户任务

业务用户不直接操作本 package；其间接任务是让平台管理员之后看到的受控功能不被过期
authority 元数据错误阻断。平台治理维护者据此需让 ledger 如实反映现行受控来源，同时
不以修复 P1/P5 外部债务或伪造业务完成来换取绿色结果。

## Dexter 立场

Dexter 已授权 P6 实施，但授权不扩大为全局 ledger、P1/P5 债务、UI 或动态验收；因此
可接受的结果必须保留外部债务并如实陈述静态证据边界。

## 替代方案

替代方案 A 是恢复 ST-3 旧 catalog/page shape，因会反向修改 U04/P1 事实而拒绝。替代
方案 B 是等待 P5 的 ST-9 cache policy，因不影响 U05 当前-tree hash/path 分母而拒绝。

1. **External-debt honesty — PASS.** The amendment and the selected U05 manifest
   both explicitly retain `ST-3` as the P1 / U04 catalog-control current-shape
   debt and `ST-9` as P5 debt. They do not propose restoring the obsolete page
   shape, changing a trace/pattern, or absorbing either debt into U05.
2. **Finite implementation proof — PASS.** Fresh `check-rows ST-2,ST-8,ST-11`
   passed. It is a selected-row result only; it is not relabelled as a full
   ledger result. Fresh `self-test-rows` passed and its invalid selected-row
   red mutation passed, demonstrating the production selected-row validator
   rejects an invalid row.
3. **Full-ledger counterexample — PASS as a boundary check.** Fresh full `check`
   failed with `P1_LEDGER_ROW_INVALID:ST-3`. This is expected evidence that the
   selected proof cannot mask P1 debt. The review found no claim that the full
   ledger or global self-test is presently PASS.
4. **No UI/runtime overclaim — PASS.** U05 is metadata/checker-only. The U09 unit
   excludes UI source, the 38-screen IA completion, DEV, seed, reset, L2 and
   dynamic business validation. Its business and cleanup obligations are
   `NOT_REQUIRED_CONTROL_ONLY`; this verdict asserts neither business PASS nor
   dynamic/L2 evidence.

## Commands and fresh results

```text
node tools/authority-source-ledger/cli.mjs check
P1_AUTHORITY_SOURCE_LEDGER=FAIL
REASON=P1_LEDGER_ROW_INVALID:ST-3

node tools/authority-source-ledger/cli.mjs check-rows ST-2,ST-8,ST-11
P1_AUTHORITY_SOURCE_LEDGER_ROWS=PASS
IDS=ST-11,ST-2,ST-8

node tools/authority-source-ledger/cli.mjs self-test-rows
P1_LEDGER_SELECTED_ROWS_SELF_TEST=PASS
P1_LEDGER_SELECTED_ROW_RED=PASS
CLEANUP=PASS

scripts/check/standards-coverage --phase R5
STANDARDS_COVERAGE=PASS
PHASE=R5
RULES=150
```

No full-ledger self-test result is asserted: the full check is already blocked
by the independently observed ST-3 external debt. No managed runtime was
started, so dynamic business and runtime-cleanup evidence are not available
and are not claimed.

## Solution reasonableness

The smallest adequate solution is reconciliation of the finite P6-owned rows
plus a selected-row validator with a real red mutation. Restoring obsolete UI
or catalog shape merely to satisfy ST-3 would be a larger, owner-incoherent
change; making U05 wait for P5 cache policy would conflate unrelated owner
packages. This package does not introduce a user operation, so UI task/path
comparison is `NOT_APPLICABLE`, not evidence of UI acceptance.

## 方案合理性

结论：通过。有限 row reconciliation 加 production selected-row red control 正好解决问题；
两种替代都会扩大 owner/步骤边界，收益不足以抵消阶段成本。

## UI 与交互

NOT_APPLICABLE：理由是该 package 明确禁止 UI consumer、页面、router、文案或交互变更；U02 IA
baseline 仅作为后续 L2 前置事实而非本次 UI 验收。

## 审查意见复核

NOT_APPLICABLE：理由是本轮在不读取 Round 1 或作者 disposition 的盲审条件下，未收到作者 finding。
已重开 owning amendment、manifest unit、ledger selectors 和 fresh command output；没有把任何此前 finding 当成既定结论。

## 实施代码核验

核验 production 源码 `tools/authority-source-ledger/cli.mjs` 的 fresh selected-row 测试 evidence 与
`self-test-rows` 输出：ST-2/ST-8/ST-11 PASS，非法 selected row 的 red mutation PASS；full
check 对 ST-3 仍 FAIL，未被 selected path 遮蔽。业务用户行为与 Journey 业务结果在本 static-only
package 中不适用，未被测试 evidence 冒充。

## 闭环核验

U05 的静态有限分母闭环；P1 ST-3、P5 ST-9、38-screen IA、L2 与动态业务/cleanup 均未进入
该闭环，仍按各自 owner/步骤处理。

## 结论

VERDICT=GO

**GO — narrow static U05 implementation-review verdict: 0 M / 0 S / 2 N.**

- N1: Full ledger remains `NO_GO` while `ST-3` P1/U04 catalog-control shape debt
  remains; this review does not permit a global ledger PASS claim.
- N2: `ST-9` remains P5 successor debt; U05's selected-row red proof and static
  evidence do not constitute L2, dynamic business, 38-screen IA, or P6-2
  aggregate closure.

Authorization boundary: this independent verdict accepts only the described
static U05 scope. It does not authorize UI changes, a new package, P5/P1 debt
repair, DEV, seed, reset, runtime, L2, dynamic business completion, aggregate
P6 closure, or any repository-control action.
