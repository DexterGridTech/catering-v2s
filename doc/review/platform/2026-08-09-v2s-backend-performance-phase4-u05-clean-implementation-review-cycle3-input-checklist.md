# BP-U05 clean implementation Cycle 3｜独立实施审查输入清单

`REVIEW_TARGET=IMPLEMENTATION`  
`REVIEW_CYCLE_ID=OVERALL_PHASE_4_U05_CLEAN_IMPLEMENTATION_REVIEW_3_20260809`  
`REVIEW_ROUND=1` / `REVIEW_ROUND_LIMIT=2`

## 独立性与授权

- Reviewer 必须是 fresh `INDEPENDENT_SUBAGENT`，先以证伪为目标重开当前生产源码、测试、控制和证据，再读取作者处置；不得沿用 Cycle 2 的 verdict。
- Dexter 于 2026-08-09 明确授权本 fresh implementation review；包输入哈希：`e28d65c82c35c4406f55ac6b79eadc1419fa915d52d5cc9e3efcf940e00750fc`。
- 范围仅为 BP-U05 clean package 当前字节。BP-U06、DEV、reset、seed、L2、UAT、部署与 SQL 数值成功声明均排除。

## 必读输入（路径与当前 SHA-256）

1. `doc/evidence/platform/2026-08-09-v2s-backend-performance-phase4-u05-clean-implementation-package-input.json` — `e28d65c82c35c4406f55ac6b79eadc1419fa915d52d5cc9e3efcf940e00750fc`
2. `doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-rebaseline-design-granularity-manifest.json` — `39364fb98a0455dcdd0c6c1da0518287ae988bb0226f8dd61d7b4d188367d276`
3. `doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-remaining-owner-projection-design-granularity-manifest.json` — `a8318ee59746f9f40f28d56a43536f8c664ac52c106c1dda121f09f2ffd9d604`
4. `doc/plans/platform/2026-08-08-v2s-backend-performance-refactor-implementation-design-codex.md` — `79ecbd69629f764529aa647cafa9efeea12f0cfe4a34a9904d87027b161c6f69`
5. `contracts/registry/task-read-surface-policy.json` — `a1f54fc79621ab204f6c6921fe8b4142cd6e1f420325c730bacc22d589bd6617`
6. `scripts/generate/task-read-surface-policy.mjs` — `888db8289f17ce6f3f9e1e6a31e7a101298d12f45b70002344758eed8d08a9be`
7. Cycle 2 independent artifacts: `...clean-implementation-review-cycle2-round1.md` and `...cycle2-round2.md`; verify their M/S dispositions from source rather than trusting them.

## 必须证伪的实现面

1. 78 task-read rows remain owner-local typed boundaries; no operationId dispatch, global query bus, command-to-task-reader call, cross-schema DML or BP-U06 retirement.
2. Re-run both granularity commands against the two manifests and their bound design reviews; a stale hash or incorrect create/update disposition is a finding.
3. Reopen the two audit controllers: `Long.MAX_VALUE` with page sizes 1 and 2 must fail with the typed invalid request before either owner reader is invoked.
4. Reopen all focused owner-reader tests. In particular, the nine operations-audit variants must verify their exact named owner/target/page arguments and no extra owner calls; workspace page/detail, IAM summary, and organization initialization tests must prove their finite owner-stage boundary.
5. Re-run compilation, read-budget check/self-test, SQL merge check/self-test and R5 standards coverage. Confirm the three status lines remain `BLOCKED_UNMEASURED`, not a performance success.
6. Inspect package scope and receipts. Dynamic tests must be reported as unrun because `runtimeAuthority=false`, never bypassed.

## Required verdict format

State `GO` or `NO_GO`, enumerate `M/S/N`, attach exact path/line/evidence, declare a blind-review statement, and retain the fixed cycle/round metadata. Round 2, if needed, is final and must set `ROUND_FINAL_DECISION=SELF_DECIDED`.
