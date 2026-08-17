---
id: pitfalls.machine-gate-test-api-false-positive
status: active
layer: routed
taskKinds: ["implementation", "testing", "review"]
domains: ["platform", "backend"]
consumerFaces: ["all"]
owners: ["platform", "backend"]
impacts: ["evidence", "governance"]
triggers: ["implementation", "failure"]
assertions: ["PRODUCTION_GATE_SCOPE_MUST_EXCLUDE_TEST_SEAMS", "TEST_API_TYPES_MUST_NOT_BE_PRODUCTION_FINDINGS", "PRODUCTION_NEGATIVE_CONTROL_MUST_REMAIN"]
sourceRefs: ["apps/backend/catering-business-server/modules/foundation/src/test/java/com/catering/v2s/platform/foundation/persistence/AdvisoryLockTest.java", "tools/verify-gates/cli.mjs"]
---
# Machine gate test-API false positive

- `PRODUCTION_GATE_SCOPE_MUST_EXCLUDE_TEST_SEAMS`: a gate whose assertion is about production business source must define its source denominator so test-only seams are not treated as production implementation.
- `TEST_API_TYPES_MUST_NOT_BE_PRODUCTION_FINDINGS`: a test double may need a framework-mandated type such as `List<Map<String,Object>>` to override a JDBC API; that type alone is not evidence of an untyped production row or command.
- `PRODUCTION_NEGATIVE_CONTROL_MUST_REMAIN`: narrowing the denominator must not make a real production `Map<String,Object>` implementation pass; the gate still needs a semantic production red control.
- Root cause: `tools/verify-gates/cli.mjs` scans all Java files under business modules, including `src/test`, with a raw `Map<String,Object>` prohibition. The `AdvisoryLockTest` recording `JdbcTemplate` override therefore fails `R4_DATABASE_UNTYPED_ROW_OR_COMMAND` even though the production code does not use an untyped row or command.
- Minimum remedy: separate production sources from test sources for this assertion, or use a narrowly justified test seam allowlist; retain a real production negative control and do not weaken the production rule globally.
- Applicability: static gates whose semantic target is production Java. Counterexample: if the gate explicitly targets test fixtures as well, the fixture must be judged by a test-specific rule rather than the production row/command rule.
- Known uncovered counterexample: 收窄后，写在 test 目录里、但实际被生产代码调用的工具类不再被这道门覆盖。
