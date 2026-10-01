# 批次二 CP-01 独立三维对账

## Verdict

`CP-01=MATCHED`。Reviewer：fresh 独立子 agent `/root/cp01_evidence_close`；本结论仅覆盖 CP-01，不是批次二整批实施 verdict。

## 对账范围与证据

- 计划 [CP-01][`doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-plan-codex.md:76-88`]：双既有 terminal operation、canonical → materialize → edge-codegen → TER 生成链、未知字段边界、验证门与治理同步。
- reset/seed 与 CP 边界：计划 `:154-161`；详设 `:203,210,485-491`。reset-only、seed-only、组合动作都需当前字节完整 seed dry-run PASS；reset 时先于 reset。无 reset/seed 的 backend-acceptance/DEV 不等待 dry-run 或空分母 admission。CP-06 之后单独 6b，随后动态验收和交付收口。
- TER 生成声明：`contracts/policy/terminal-client-generation.json:4-15`、`apps/terminal/kernel/base/terminal-data-client/src/generated/terminalApi.ts:30-39,59-86`；当前只含 `activateTerminal`、`cancelTerminalActivation`，生成物没有 import/fetch/socket 实现。
- 字段闭集：`contracts/openapi-source/terminal-binding.schemas.json:4-15,32-39,48-55`；两个 terminal request 是 `additionalProperties=true`，运营后台 cancellation request 仍 strict。生成 DTO 和 focused tests 覆盖未知子树与 duplicate member 行为。
- 门注册：`tools/verify-gates/verify.mjs:59-75,268`；terminal generator/materialize 与 Node suite 入口已注册。
- 当前 focused outputs：见 [CP-01 proof][`doc/review/platform/2026-09-30-v2s-terminal-activation-batch-2-cp01-proof-codex.md`] 及其日志 SHA-256。Reviewer 只读核验了 `.runtime/review/terminal-activation-batch-2-cp01/verify-validate-only.log` 的 `49/49`、terminal static/openapi/materialize markers，focused Node `2/2` 和 THCL Node `54/54`。
- D-44 当前拓扑同步：`AGENTS.md:49,58`、`PLATFORM-BLUEPRINT.md:9,51`、`scripts/README.md:145-146,205-216`、service-shape decision `:102-105` 均明确三 TDS DEV 节点、两个 HAProxy WebSocket 入口、节点端口不穿 tunnel；L2 走其独立标准和授权。

## Reviewer 边界

本轮 reviewer 未运行 verify、测试、生成器、构建、DEV、backend-acceptance、Testcontainers、reset、seed、L2 或浏览器。`validate-only`/focused test 结果属于主 agent 当前字节运行证据；它不证明动态行为。CP-02～CP-06、批次级 6b、整批动态验收、13c 与最终 implementation review 均未被本结论覆盖。
