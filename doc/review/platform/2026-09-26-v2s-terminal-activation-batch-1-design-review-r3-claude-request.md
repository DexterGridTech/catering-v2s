# 终端激活与长连接 · 批次一详设 R3 复核请求

## 背景

Claude 的 R2 评审结论为 `NO-GO M/S/N=2/5/8`。Codex 主 agent 已逐条重开 owning source 与规范，完成 finding intake，并据此修订详设、实施计划、service-shape decision、共享 WebSocket protocol 及 D-18 IA/交互文件。Dexter 已裁决 R2-N2：未认证连接上限使用必填键，缺失或无效时 TDS 在 readiness 前启动失败。部署数值 N 仍须由未来实施期的实际主机容量测量确定。

本轮是评审交接，不表示出现新的独立 verdict。decision 仍为 `PROPOSED`；实现与动态验证尚未开始，现有文档没有把未运行的 proof 记为 PASS。

## 评审目标

请独立复核 R2 的 15 条 finding 是否已在详设与计划中得到准确、可执行且不过度设计的处置；特别检验 CP-05 前后静态验证闭环、TDS 进程/类路径边界、每个暴露面字面量的第五面反例、RFC 7692 在默认客户端报价下的实际协商与帧行为，以及 R2-N2 的配置裁决是否保持为必填键而不伪造部署容量数值。重新评估修订设计本身，不把作者 intake 当作前提结论。

## 需阅读文件

- `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md`：需求正本、D-34/D-37/D-38/D-39 及 R/V 判据。
- `doc/review/platform/2026-09-26-v2s-terminal-activation-batch-1-design-review-r2-claude.md`：R2 原始 `NO-GO M/S/N=2/5/8` 与每条 finding 的证据、影响和验收判据。
- `doc/review/platform/2026-09-26-v2s-terminal-activation-batch-1-r2-finding-intake-codex.md`：Codex 主 agent 的逐条事实分类、处置和 OPEN 边界；请独立挑战而非照抄。
- `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md`：当前批次一详设、协议、门清单和模板自检。
- `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-plan-codex.md`：当前实施顺序、CP-05 标定时序与受管执行边界。
- `doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md`：PROPOSED decision、服务形状、依赖边界与 supersede ledger。
- `contracts/protocol/terminal-connection-protocol.json`：共享 WebSocket frame、close、压缩及大小边界正本。
- `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md`：确认 decision 被接受前标准仍为 HTTP-only。
- `doc/plans/platform/2026-09-23-v2s-store-terminal-management-ia-codex.md` 与 `doc/plans/platform/2026-09-23-v2s-store-terminal-management-ui-interaction-design-codex.md`：R2-N7 对应的只读设备类型观测语义。
- `doc/decisions/templates/implementation-design-template.md`：R2-N6 模板覆盖判据。
- `tools/verify-gates/cli.mjs`、`tools/platform-boundary-gates/cli.mjs`、`scripts/generate/r5-edge-materialize.mjs`、`scripts/generate/edge-codegen.mjs`、`scripts/generate/edge-operation-projections.mjs`、`tools/verify-gates/verify.mjs` 与 `apps/backend/catering-business-server/src/test/java/architecture/BackendModuleBoundariesTest.java`：Q15、门顺序及 edge 隔离 owning source。

## 独立核验重点

1. **R2-M1 / CP-05 标定**：按计划复演逻辑顺序。标定前普通 `scripts/verify --validate-only` 首败应如何记录；`IDENTITY_ONLY` 模式能证明哪些门与红夹具；预算依赖夹具是否明确延后到三份 all-operation CP-05 报告之后；标定进入条件是否不依赖一个做不到的全绿基线。Q5 必须命中 `edge-codegen.mjs` 中大小写不同的 `Cp05`。
2. **R2-M2 / acceptance harness**：验证方案确为独立 TDS 进程；业务 `testRuntimeClasspath` 与 TDS `runtimeClasspath` 的版本约束没有串用；TDS 显式 REACTIVE；业务/TDS ArchUnit 导入范围分离；Node/undici 客户端、BlockHound、全局 tracker sink 和两个业务上下文互不污染。当前没有运行期依赖图或 harness evidence，不能据设计文字宣称已证实。
3. **R2-S1 / Q15 完整性**：原样复跑详设 Q15，确认仅 6 个字面量命中且逐处都有处置。对 `verify-gates`、`contract-face`、`r5-edge-materialize`、`edge-codegen` 和 `edge-operation-projections` 分别核验未知第五面反例确实会触发写明的精确 marker 和 verify 模式；不能只改已有面计数而仍接受未知值。检查 terminal edge 包是否进入 peer-edge ArchUnit 规则。方案行不是已运行的 fixture 证据。
4. **R2-S2/S3 / 压缩**：独立查核三个 PMCE 报价形态的应答参数、raw-Netty 原始请求头 gate 的真实挂载点、unsupported `deflate-frame` 的单独/混合报价、压缩 AUTHENTICATE 首帧的处理、未协商 RSV1/控制帧 RSV1 的 1002 和解压溢出的 1009。确认共享协议闭集与 V-S14 的断言说的是同一件事；区分 WebSocket opcode PING/PONG 与 JSON PING/PONG data frames。
5. **R2-S4/S5、N1/N2**：错误码是否仍在 R-1.4 闭集中；摘要唯一冲突是否只使用现有 owner invariant；`ActivationCandidate` 是否由 terminal-binding 拥有；TDS runtimeClasspath 排除集是否覆盖传递依赖；551 KiB 估算、1 MiB logical cap 及部署 N 公式是否量纲清楚。确认 N2 必填键裁决已采纳，但 N 没有被臆造为固定数字，且首次受管 TDS 启动前必须实测、记录。
6. **R2-N3..N8 与回归项**：decision supersedes 是否只取代精确锚点、仍为 PROPOSED；acceptance standard 是否仍 HTTP-only；D-34 reset/seed 是进入条件而不是另要授权；计划与详设都列四个具名 worker；模板 §3a/§4/§10b.6/§12/§14 是否真符合要求；IA/交互是否均有 E01 只读 testId；运营取消错误顺序是否只保留 requireStore 先行的 403。顺便确认 R-1.6 与 D-38 的判定顺序没有回归。

仓内文档与源码是本轮静态对象；依赖解析、红夹具、compression frame 行为、acceptance 场景和资源容量都尚未执行。请明确区分 `CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE / UNVERIFIED_REQUIRES_EVIDENCE / DEXTER_DECISION`，不要把待实施 proof 升级为已通过事实。

## 期望结论

请给出明确 `GO` 或 `NO-GO` 与 `M/S/N` 数量。每条 finding 写精确文件与行号、性质（仓内事实、外部事实、推论或需 Dexter 裁决）、证据、影响、最小可验收修正和是否需要 Dexter 裁决。原始 R2 的 `NO-GO M/S/N=2/5/8` 只作为历史结论，不能当作本轮结论。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请独立复核《终端激活与长连接》批次一详设与实施计划的 R3 修订稿。

背景：你的 R2 结论为 NO-GO，M/S/N=2/5/8。Codex 主 agent 已逐条重开 owning source 与规范并修订详设、计划、decision、共享 WebSocket protocol、IA/交互文件。Dexter 已裁决 R2-N2：未认证连接上限使用必填键，缺失或无效时 TDS 在 readiness 前启动失败；部署数值 N 仍须由实施期主机容量实测确定。decision 仍是 PROPOSED，本轮没有进入实现。
目标：请独立判断 R2 的 15 条 finding 是否都得到准确、可执行、不过度设计的文档处置，并重新评估修订方案本身；不要把 Codex intake 当作结论。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md：需求、D-34/D-37/D-38/D-39 与 R/V 判据；
- doc/review/platform/2026-09-26-v2s-terminal-activation-batch-1-design-review-r2-claude.md：上一轮 15 条 finding 及原始 NO-GO；
- doc/review/platform/2026-09-26-v2s-terminal-activation-batch-1-r2-finding-intake-codex.md：主 agent 对每条 finding 的核验与 OPEN 边界，请独立挑战；
- doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md：修订详设、共享协议、Q1-Q15 门清单；
- doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-plan-codex.md：修订计划及 CP-05/验证顺序；
- doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md：仍为 PROPOSED 的服务形状决策；
- contracts/protocol/terminal-connection-protocol.json：共享 WebSocket 协议正本；
- doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md：当前 HTTP-only acceptance 场景规范；
- doc/plans/platform/2026-09-23-v2s-store-terminal-management-ia-codex.md 与 doc/plans/platform/2026-09-23-v2s-store-terminal-management-ui-interaction-design-codex.md：E01 只读设备类型观测；
- doc/decisions/templates/implementation-design-template.md：详设模板；
- tools/verify-gates/cli.mjs、tools/platform-boundary-gates/cli.mjs、scripts/generate/r5-edge-materialize.mjs、scripts/generate/edge-codegen.mjs、scripts/generate/edge-operation-projections.mjs、tools/verify-gates/verify.mjs、apps/backend/catering-business-server/src/test/java/architecture/BackendModuleBoundariesTest.java：R2-S1/Q15 和 gate/ArchUnit owning source。

请重点复核：
1. CP-05 前普通 scripts/verify --validate-only 的预期首败、IDENTITY_ONLY 可证明范围、CP-05 后延迟 fixture 的补证顺序、标定前置条件，以及 Q5 是否捕获 edge-codegen.mjs 的 Cp05。
2. 独立 TDS 进程的两套 classpath 版本、REACTIVE app 类型、ArchUnit 扫描隔离、Node/undici 客户端隔离、双业务上下文的 tracker sink；这些目前都没有运行期 proof。
3. 原样复跑 Q15 六个命中；逐一确认第五个未知 face fixture 能在每个声明入口触发精确 marker 和 verify 模式；检查 terminal edge peer-dependency ArchUnit 规则。文档写了 fixture 不等于它已运行通过。
4. 三类 permessage-deflate 报价的应答参数、raw-Netty gate 挂载点、deflate-frame 单独/混合报价、压缩 AUTHENTICATE 首帧、未协商 RSV1/control RSV1 的 1002 与解压超限的 1009；核对共享协议正本和 V-S14 是否一致，并区分 WebSocket 控制帧与 JSON PING/PONG data frame。
5. R-1.4 错误闭集、摘要冲突码、ActivationCandidate owner、TDS 传递依赖排除、551 KiB/1 MiB 连接预算与 N 推导公式；确认 N2 必填键裁决已落实但没有臆造容量数值。
6. decision 的锚点取代范围与 PROPOSED 状态、acceptance standard 仍为 HTTP-only、D-34 reset/seed 进入条件、四个 worker、模板覆盖、E01 只读 TestId、运营取消 requireStore 的 403 顺序，并回归核对 R-1.6/D-38 顺序。

请区分 CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE / UNVERIFIED_REQUIRES_EVIDENCE / DEXTER_DECISION。结论请用 GO 或 NO-GO 与 M/S/N 数量；每条 finding 写明精确文件与行号、性质、证据、影响、最小可验收修正和是否需要 Dexter 裁决。不要把设计文字、静态核验或未执行的 fixture/runtime proof 写成通过。

授权边界：本轮只复核详设、计划与决策材料，不授权实现、构建、测试、scripts/verify、受管运行、DEV、Testcontainers、reset、seed、L2、UAT、部署、数据操作或把 PROPOSED decision 改为已接受。谢谢。
```
