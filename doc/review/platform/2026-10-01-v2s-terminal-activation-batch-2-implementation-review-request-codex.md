# 终端激活与长连接·批次二实施静态评审请求

## 背景

批次二详设与实施计划已按 Dexter 的三包职责裁决完成实现。CP-01～CP-06 阶段对账、整批 6b 与实施后的 fresh 独立对抗复核均已完成；批次二最后修正的 transport actor 命令失败处理与异步资源释放也有 focused proof。最终非生产 reset→DEV start→完整 `r5-full` seed 已通过，DEV 保留供 Dexter review。

本次运行证据与当前/历史边界见 13c 记录。根默认 `scripts/verify` 仍只有 `INTERRUPTED/NO_VERDICT`，不作为 PASS；当前字节 `scripts/verify --validate-only` 为 49/49 PASS。按 Dexter 最新要求，不重复最后差异未影响的验收；历史 run 仍按原执行范围标注。

## 评审目标

请从用户、业务不变量和代码边界出发，对批次二做整批 `REVIEW_TARGET=IMPLEMENTATION` 独立静态评审：核实实际生产实现是否满足原始需求与已接受设计，批次二三包职责与依赖方向是否正确，TER Node 与 TDS 协议/错误处理是否一致，资源释放失败是否会传到受管 cleanup，生成物是否只有明确的 canonical producer，以及当前运行证据是否准确覆盖其声明范围。重点验证合理性与真实用户行为，不以“按详设实现”替代独立判断。

## 需阅读文件

- `AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md`：治理、执行和架构边界。
- `doc/platform/README.md`、`scripts/README.md`、`doc/platform/review-standard.md`、`doc/platform/implementation-task-template.md`、`doc/platform/third-party-library-usage-standard.md`、`doc/platform/terminal-coding-standard.md`：当前适用规范。
- `project-memory/decisions/deterministic-context-only.md` 与 `project-memory/index.md` 的 kernel，以及六维路由命中的原文：当前项目约束与 owner 事实。
- `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md`：批次二原始需求与裁决。
- `doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md`、`doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md`：Journey 和已接受服务形态。
- `doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-design-codex.md`、`doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-plan-codex.md`：本批批准实现与验收判据。
- `contracts/protocol/terminal-connection-protocol.json`、`contracts/openapi-source/terminal-binding.schemas.json`、`contracts/policy/terminal-client-generation.json`：共享协议与两条生成输入链。
- `doc/review/platform/2026-10-01-v2s-terminal-activation-batch-2-13c-codex.md`：逐代码对账、finding intake、当前与历史证据边界。
- `doc/review/platform/2026-10-01-v2s-terminal-activation-batch-2-cp06-proof-codex.md`、`doc/review/platform/2026-10-01-v2s-terminal-activation-batch-2-6b-reconciliation-codex.md`：CP-06 与整批 6b 对账证据。
- `apps/terminal/kernel/base/server-config/`、`apps/terminal/kernel/base/transport/`、`apps/terminal/kernel/base/terminal-data-client/`、`apps/terminal/kernel/base/runtime/`：TER 配置、通用 transport、TDS client owner 与异步资源生命周期实现。
- `apps/backend/catering-business-server/`、`apps/backend/terminal-data-server/`：terminal-binding HTTP owner、TDS WebSocket 实现与验收场景。
- `scripts/generate/r5-edge-materialize.mjs`、`scripts/generate/edge-codegen.mjs`、`scripts/generate/terminal-client-api.mjs`、`apps/terminal/kernel/base/terminal-data-client/src/generated/terminalApi.ts`：HTTP 与 TER client 生成链。
- `scripts/test/terminal-client-dev-acceptance.mjs`、`apps/terminal/kernel/base/terminal-data-client/acceptance/`、`.runtime/r5/reset/r5-reset-a924adeb-484a-474c-83a8-b4fdb0c63ebb/run-manifest.json`、`.runtime/r5/seed/complete/complete-seed-c4948030-2371-4a6e-96c2-7899d9d916d4/seed-report.json`：当前 Node 场景与最终 reset/seed 证据。

## 独立核验重点

- `terminal-data-client` 是否独占终端凭证、激活/取消 command、TDS 业务协议、PING/PONG 与状态 selectors；`server-config` 是否唯一拥有地址和代理配置及秘密；`transport` 是否只处理通用通信可靠性、重连和连接生命周期。
- 真实生成链是否从 canonical OpenAPI source 经 materialize、edge-codegen 与 TER client generator 闭合，未知字段仅对获批 terminal 请求放宽。
- timer/actor dispatch 失败是否 fail closed；remote WebSocket close 与 runtime cleanup 是否共用 awaitable dispose；任何 close/dispose rejection 是否会让 cleanup 失败而非伪 PASS。
- 实际运行与历史 evidence 是否被准确区分：当前 transport/client focused tests、managed E1、49/49 `--validate-only`、当前 reset→DEV→完整 seed 都有单独 run 结果；根默认 `scripts/verify` 是 `INTERRUPTED/NO_VERDICT`，不能写成 PASS。
- 逐代码对账是否覆盖全部新增生产入口、消费者、生成物和 producer；是否存在遗漏的零调用符号、错误依赖或超出批次二范围的实现。

本次复核是静态 review。请勿运行测试、构建、verify、DEV、reset、seed、L2、UAT 或部署；动态证据已在 13c 中按 run id 与状态如实列出。

## 期望结论

请给出明确的 `GO` 或 `NO-GO` 与 `M/S/N`。每条 finding 请提供详设条款及实际源码位置、事实性质、影响、最小可验收修正与是否需要 Dexter 产品裁决。历史运行或未执行的默认 root verify 不得升级成 PASS。

## 可直接复制给 Claude 的话术

```text
您好 Claude，请对《终端激活与长连接》批次二实施做一轮整批独立静态 review。

背景：批次二已按接受的详设与计划完成实现；CP-01～CP-06 阶段对账和整批 6b 已 MATCHED，fresh 独立 implementation review 为 GO（M/S/N=0/0/1）。最后的 transport timer command failure 与 async disposal findings 已修复，并有当前字节 focused tests 和 managed E1 证明。最终非生产 reset→DEV start→完整 r5-full seed 均 PASS，DEV 保留供 Dexter review。13c 逐代码对账和验证边界见下列文件。

目标：请独立检查真实生产实现、业务用户行为和证据闭包；不要因为实现符合详设而豁免方案合理性审查。

请从 catering-v2s 仓根阅读：
- AGENTS.md、CLAUDE.md、PLATFORM-BLUEPRINT.md：仓库红线与执行边界；
- doc/platform/README.md、scripts/README.md、review/implementation/third-party/terminal 规范与 deterministic-context-only memory：适用治理；
- doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md：原始需求和裁决；
- doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md 与 doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md：获批 Journey 与服务边界；
- doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-design-codex.md 与 doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-plan-codex.md：详设与判据；
- contracts/protocol/terminal-connection-protocol.json、contracts/openapi-source/terminal-binding.schemas.json、contracts/policy/terminal-client-generation.json：共享协议与生成输入；
- doc/review/platform/2026-10-01-v2s-terminal-activation-batch-2-13c-codex.md、doc/review/platform/2026-10-01-v2s-terminal-activation-batch-2-cp06-proof-codex.md、doc/review/platform/2026-10-01-v2s-terminal-activation-batch-2-6b-reconciliation-codex.md：逐代码、CP-06、6b 与最新证据边界；
- apps/terminal/kernel/base/server-config/、transport/、terminal-data-client/、runtime/：TER 配置、通信、业务协议 client 和释放生命周期；
- apps/backend/catering-business-server/、apps/backend/terminal-data-server/：后端激活与 TDS；
- scripts/generate/ 与 scripts/test/terminal-client-dev-acceptance.mjs：生成和受管 Node 验收入口；
- .runtime/r5/reset/r5-reset-a924adeb-484a-474c-83a8-b4fdb0c63ebb/run-manifest.json 与 .runtime/r5/seed/complete/complete-seed-c4948030-2371-4a6e-96c2-7899d9d916d4/seed-report.json：最终 reset 和完整 seed 运行证据。

请重点核验三包职责、凭证唯一 owner、command/selector 路径、TDS 协议与客户端字段对应、生成源闭环、重连与 ready/invalid 时序、失败可见的异步资源释放、所有新增生产符号调用链、逐代码与详设对账，以及当前/历史动态证据的边界。根默认 scripts/verify 当前只有 INTERRUPTED/NO_VERDICT；本字节 scripts/verify --validate-only 为 49/49 PASS；请勿将二者混为一谈。

请给出 GO 或 NO-GO 与 M/S/N。每条 finding 写明详设和实现的准确位置、性质、影响、最小可验收修正、是否需要 Dexter 裁决；对证据不足项请明确标为 OPEN/未验证。

授权边界：本请求只授权静态 review，不授权修改代码或文档，不授权运行构建、测试、verify、DEV、reset、seed、L2、UAT 或部署。谢谢。
```
