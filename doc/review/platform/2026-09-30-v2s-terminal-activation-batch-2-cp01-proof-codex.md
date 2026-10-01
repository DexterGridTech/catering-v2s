# 终端激活与长连接 · 批次二 CP-01 focused proof 记录

## 范围

本记录为 CP-01 当前字节的 focused proof。它不构成 CP-01 独立三维对账结论，不替代 CP-02～CP-06、整批 6b、整体动态验收或最终 implementation review。所有输出日志在当前工作区 `.runtime/review/terminal-activation-batch-2-cp01/`；文件摘要用于识别本次输出。

CP-01 文档修订后核对的治理事实：批次二 DEV 使用三个独立 TDS 节点和两个 HAProxy WebSocket 入口，节点端口不经 tunnel；浏览器 L2 继续按其独立规范和授权执行。本批无 L2 action，§3a 仍为 N/A。实际 reset-only、seed-only 或组合动作必须先取得当前字节完整 `r5-full` seed dry-run PASS，reset 时先于 reset；无 reset/seed 的 backend-acceptance/DEV 不等待虚构的 seed dry-run 或空分母准入。CP-06 的阶段对账在 CP-06 工作与 focused proof 后完成；其后的批次级 6b、整体动态验收、cleanup、13c 与 final implementation review 不属于 CP-06 退出条件。

## 当前字节运行证据

| 执行入口 | 实际结果 | 关键输出 | 输出文件 |
|---|---|---|---|
| `scripts/verify --validate-only` | 2026-09-30 13:57:29–14:01:37 UTC（4m08s）；PASS，exit 0；`EXECUTED=49/49`；`CLEANUP=NOT_APPLICABLE_STATIC_ONLY` | `R5_VERIFY_VALIDATE_ONLY=PASS`；`TERMINAL_CLIENT_API_SELF_TEST=PASS` 及 zero/duplicate/wrong-face/target/drift/root/symlink 红例；`R5_EDGE_MATERIALIZE_SELF_TEST=PASS`；`R5_EDGE_MATERIALIZE_CHECK=PASS`、`OPERATIONS=238`；`R5_OPENAPI_CONTRACTS=PASS`；`TERMINAL_SKELETON_MODEL_TEST=PASS`；`TERMINAL_STATIC=PASS` | `verify-validate-only.log`，SHA-256 `bd80b16d767b65163cdaefac03b29d89917209dd27be81cfc2d8b5e96af844d1` |
| `node --test scripts/test/terminal-client-generation.test.mjs scripts/test/edge-codegen-terminal-unknown-fields.test.mjs` | 2026-09-30 14:01:57 UTC；PASS，2 tests / 2 passed / 0 failed；60.844 ms | 两个 terminal request 的 unknown-field/duplicate 生成行为与 TER exact-two operation 生成检查通过 | `focused-node-tests.log`，SHA-256 `5e4c462b7f136dd71a30e047117fcba4d92687d41e5124e3ce5a3a1a8c4760a1` |
| `node scripts/test/test-health-entry-runner.mjs --node` | 2026-09-30 14:02:58–14:03:00 UTC；PASS，54/54 个已登记 Node test files；exit 0 | `THCL_NODE_TEST_ENTRY=PASS`、`DISCOVERED_TEST_FILES=54`、`EXECUTED_TEST_FILES=54` | `thcl04-node-tests.log`，SHA-256 `2ef985f25c162774cae43aa544b5e2d53e1d48f5150d3398f975b0a832297901` |

`TERMINAL_STATIC` 内部 run id：`ter-local-static-66719-1790776762313`；其中 `verify-static.finish` 在日志中标记 `outcome=PASS`。`scripts/verify --validate-only` 本身不输出稳定 run id；对应进程 PID 为 62384，完整 stdout/stderr 由上表日志和摘要绑定。受管 DEV、backend-acceptance、Testcontainers、reset、seed、L2 与业务运行均未在本记录所列命令中启动；本记录不声称这些动态结果通过。

## 对 CP-01 证明的边界

- `scripts/verify --validate-only` 的 `49/49` 证明当前静态验证目录实际执行并通过；日志中的 red fixture `FAIL` 行是预期负例，所属测试随后给出 `PASS`，不能解释为 verify 失败。
- `R5_EDGE_MATERIALIZE_CHECK` 与 `R5_OPENAPI_CONTRACTS` 是仓内 verify 入口输出；它们只证明本次 static run 的物化与 OpenAPI/edge-codegen 检查通过，不证明运行时行为或批次级业务验收。
- `THCL-04-node-tests` 全集与两项精确 focused test 均已保存实际输出；本批后续代码变化若影响这些测试，仍应在对应阶段与整体验收按计划重验。
- CP-01 是否 `MATCHED` 由 fresh reviewer 独立判定；本记录不代替三维对账。
