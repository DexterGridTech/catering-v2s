# RP-12 classification independent review input

`REVIEW_TARGET=IMPLEMENTATION`  
`REVIEW_CYCLE_ID=WHOLE-ENGINEERING-FIRST-PACKAGE-20260805-RP12-CLASSIFICATION`  
`REVIEW_ROUND_LIMIT=2`  
`reviewerKind=INDEPENDENT_SUBAGENT`

请先盲审真实当前源码，再读取作者 intake。复核对象为：

- `doc/evidence/platform/2026-08-05-v2s-whole-engineering-first-package-rp12-classification.json`
- 生产 Java `apps/backend/catering-business-server/**/src/main/java/**/*.java`（排除 `src/test`）
- 独立 SQL 反例 inventory（不得把 SQL literal 混入 Java 分母）

必须独立重扫并证明：

1. exact double-quoted token 分母为 `477 occurrences / 320 matching lines / 32 files`；
2. 每个 artifact path:line 的当前源码回读一致；每个源文件 SHA-256 与 artifact 一致；
3. 每个 exact token occurrence 都有 ordinal、columnStart、token、set、owner、generated、normative source 与 mapping evidence；混合行不能只靠 row-level sets；
4. 五集合规范源遵循 D3：service-node 由 OpenAPI component/codegen，组织树/audit entityType/business entity/extension host 由各 owner；同名值的反例不得全局替换；
5. `BusinessEntityService` 的 `nodes.requireNode(..., "PROJECT")` 只归组织树，line 228 三个 `STORE` occurrence 的三类语义逐个核对；
6. SQL 11 occurrences / 8 lines 另行记录，不改变 Java 分母；
7. 只读执行；不运行 DEV/UAT/HTTP/L2、seed/reset 或 Git。

输出必须声明 `REVIEW_ROUND=1|2`、`REVIEW_ROUND_LIMIT=2`、`reviewerKind=INDEPENDENT_SUBAGENT`、盲审声明、GO/NO-GO 及 `M/S/N`。Round2 后硬停止，不得第三轮。

