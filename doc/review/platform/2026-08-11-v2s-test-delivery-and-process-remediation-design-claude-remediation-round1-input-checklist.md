# 测试健康闭环整改 Claude finding remediation DESIGN round-1 输入清单

`REVIEW_TARGET=DESIGN`  
`REVIEW_CYCLE_ID=TEST_DELIVERY_PROCESS_REMEDIATION_DESIGN_CLAUDE_REMEDIATION_20260811`  
`REVIEW_ROUND=1 / REVIEW_ROUND_LIMIT=2`  
`SCOPE=Claude M-01 plus N-01/N-02 only`

Fresh reviewer 必须在 verdict 前重开以下固定来源，先证伪后才读取 author intake；不得执行动态环境或修改任何 source/test/runner/contract/active package。

- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、selected Roadmap CURRENT、`scripts/README.md`、`project-memory/decisions/deterministic-context-only.md`、`contracts/policy/standards-coverage-matrix.json`。
- `doc/review/platform/2026-08-11-v2s-test-closed-loop-implementation-design-review-claude.md`：Claude M/N 的权威输入。
- current design、authorization、Claude-remediation manifest。
- `scripts/check/standards-coverage`、catalog、`tools/verify-gates/verify.mjs`：全 17-ref exact set、kind-specific fields、child-only executeActive/root/selector separation。
- `scripts/test/backend-performance-final-acceptance.mjs`、`scripts/test/backend-performance-testcontainers-196.mjs`：statementId nullish canonical source。

必查：43 ACTIVE rules 的 source-derived 17-ref full set（root=1、child=15、selector=1）未被缩窄；root no command 而 child/selector command/markers 必填；missing root、extra ref、child command missing、selector command missing、root command、unknown kind、subset admission 都是真红；rootRunId 使用 `crypto.randomUUID()`，path collision 在 child 前 typed reject/no overwrite；database canonical 写明 `statementId ?? ""` 且 missing-field byte-equivalence red test。静态 DESIGN 不等于任何 implementation、dynamic、business、cleanup、performance、Testcontainers、DEV、L2、seed、reset、browser、UAT 或部署成功。
