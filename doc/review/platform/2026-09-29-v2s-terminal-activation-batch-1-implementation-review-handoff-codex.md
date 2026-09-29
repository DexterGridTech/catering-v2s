# 阶段一实现 · Claude 静态 Review 交接

## 背景

《终端激活与长连接》最新受管验收 `r5-tc-1790697767533-50846` 于 `2026-09-29T16:02:47Z` 至 `2026-09-29T16:13:45Z` 运行：backend-acceptance 198/198、TDS CONTRACT 49/49、V-S14 9/9、operation identity 296/296、`UNCLASSIFIED_SQL=0`，business 与 cleanup 均 PASS；TDS readiness/pre-stop RSS 为 229,132/257,448 KiB（512 MiB 预算）。本轮 `scripts/verify --validate-only` 为 48/48 PASS；数据库构造诊断另有 2,279 项 `OPEN_UNTIL_CAPTURE_OR_REVIEW`，未使该门失败。Browser L2、完整 seed dry-run 与早前 6b MATCHED 记录均对应较早字节，本轮未重跑，不作为当前字节证据。13c 独立对账仍为 OPEN；按 Dexter 指示不再扩写对账，现将实现直接交 Claude 静态 review，并保留 OPEN 状态。当前字节本轮没有运行 Browser L2、reset、DEV readiness 或 seed。

现在请 Claude 对阶段一的实现做独立静态代码 review。本轮另完成测试脚本与用例专项复核，记录在 `doc/review/platform/2026-09-30-v2s-terminal-activation-batch-1-test-script-review-codex.md`：未关闭项为 `M/S/N=0/0/2`，两项均为非阻断建议；focused Node 测试 95/95、`scripts/verify --validate-only` 48/48 与最新受管验收均通过。不要把 `--validate-only` 的结果表述成未带参数的完整 `scripts/verify` 运行。阶段一受管验收、静态验证与尚未当前字节重跑的 L2/seed 证据分别判断。

## 评审目标

请求按 `REVIEW_TARGET=IMPLEMENTATION` 静态检查批次一实现是否符合需求、详设、IA、交互工件和治理约束；独立判断实现方案是否合理，不能只确认“按详设实现”。逐项核验生产代码、测试与运行脚本之间的字段、时序、owner、协议和边界是否一致；指出详设没有可执行判据的问题为 `DESIGN_GAPS`。

范围仅为批次一：门店终端设备类型只读、terminal-binding owner 与迁移、终端激活/取消激活/读回/审计、终端凭证认证、单节点 TDS、WebSocket 协议与压缩、共享协议、相关生成/验证门、DEV、backend-acceptance 与六个门店终端 L2 场景。批次二 TER 客户端包/接口生成和批次三多节点/Doris 不在本次评审范围。

## 需阅读文件

- `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md`：需求正本，含 D-37～D-43 的产品裁决。
- `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md`：批准的阶段一详设与判据。
- `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-plan-codex.md`：阶段、实现范围与动态验证计划。
- `doc/plans/platform/2026-09-23-v2s-store-terminal-management-ia-codex.md`：门店终端 IA。
- `doc/plans/platform/2026-09-23-v2s-store-terminal-management-ui-interaction-design-codex.md`：门店终端交互工件。
- `doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md`：批准 Journey 与用户任务边界。
- `doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md`：已接受的业务后端与独立 TDS 服务形态。
- `contracts/protocol/terminal-connection-protocol.json`：设备与 TDS 共享协议。
- `doc/review/platform/2026-09-27-v2s-terminal-activation-batch-1-execution-status-codex.md`：动态验收、已知默认 verify 失败和证据边界。
- `doc/review/platform/2026-09-28-v2s-terminal-activation-batch-1-6b-reconciliation-r5-codex.md`：已完成的整批 6b 三维对账记录。
- `doc/review/platform/2026-09-29-v2s-terminal-activation-batch-1-projection-binding-reconciliation-codex.md`：近期生成闭环与绑定核验记录。
- `doc/review/platform/2026-09-29-v2s-terminal-activation-batch-1-code-design-reconciliation-codex.md`：13c 对账记录；当前独立结论 OPEN，须与本轮 Claude review 分开判断。
- `doc/review/platform/2026-09-30-v2s-terminal-activation-batch-1-test-script-review-codex.md`：测试客户端、结构断言、日志隔离与当前运行结果的专项复核。
- `doc/review/platform/2026-09-28-v2s-terminal-activation-batch-1-l2-admission-review-r3-codex.md`：当前 L2 准入记录。
- `doc/review/platform/2026-09-27-v2s-terminal-activation-batch-1-dynamic-front-admission-codex.md`：动态前置准入与受管运行证据索引。
- `doc/review/platform/2026-09-26-v2s-terminal-activation-batch-1-r3-repair-record-codex.md`：第 3 轮七项 finding 修复记录。
- `apps/backend/catering-business-server/modules/terminal-binding/`、`apps/backend/catering-business-server/modules/store-terminal/`、`apps/backend/terminal-data-server/`：阶段一后端 owner 与 TDS 实现及测试。
- `apps/frontend/operations-admin/`：门店终端管理页实现与测试；核验设备类型只读和激活/取消激活交互。
- `scripts/test/` 与 `scripts/backend-acceptance/`：阶段一相关验收客户端、场景和结构门；按详设追踪其实际生产入口与断言。
- `doc/platform/implementation-task-template.md`：适用的实施与验收纪律。

## 独立核验重点

1. 按 R-1 至 R-12、V-B、V-S 逐条映射实现、真实 HTTP/WebSocket 验收和 focused tests；确认激活重试、D-40 已结束绑定的 deviceId 规则、D-38 代次摘要、并发锁、审计和事务语义没有被测试替身或 DTO 字段错配掩盖。
2. 核验 store-terminal 与 terminal-binding 的 owner 边界、命令调用和迁移；确认业务终端激活端点不被权限限制，TDS 仅依赖允许的窄 API。
3. 核验 TDS 首帧凭证认证、未知 JSON 字段忽略、消息大小和压缩后大小上界、RFC 7692 压缩、会话替换、通知监听/重连、10 秒停库恢复、优雅停机与状态写入时序。将测试客户端发出的实际字段与服务端 codec/handler逐一对齐。
4. 核验终端类型编辑态确实只读；R-12 新暴露面对应的生成器、投影、门、红夹具、业务 app 和 TDS 边界没有漏接或死分支。
5. 核验 D-41：生成、检查、测试、构建与运行时输入均限于本仓；数据文件路径、符号链接和哈希校验没有重新引入外部项目依赖。
6. 核验真实验收拓扑：两个业务后端上下文、单独 TDS 进程、共享数据库/run 身份、实际 HTTP/WebSocket、故障注入边界、日志和 cleanup 断言是否与详设一致；动态 PASS 只作为证据，不代替源码判断。
7. 对所有 findings 标明详设判据和实现位置。若判据缺失或相互冲突，写入 `DESIGN_GAPS`，不要让实现侧猜产品语义。
8. 测试专项复核及当前证据见 `doc/review/platform/2026-09-30-v2s-terminal-activation-batch-1-test-script-review-codex.md`。当前 `scripts/verify --validate-only` 48/48 PASS，受管 acceptance `r5-tc-1790697767533-50846` business/cleanup PASS；L2、seed dry-run 与早前 6b 记录不是本轮当前字节证据。13c 仍 OPEN，不得写成 MATCHED。

## 期望结论

请给明确 `GO` 或 `NO-GO`，并报 `M/S/N` 数量。每条 finding 写明详设位置、实现/测试位置及行号，分类事实或推论，说明影响、最小可验收修正和是否需要 Dexter 裁决；详设缺少判据的列入 `DESIGN_GAPS`。本轮为静态 review，不要求或授权再次运行动态验收。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对《终端激活与长连接》批次一实现做一次独立静态代码 review。

背景：最新受管 acceptance `r5-tc-1790697767533-50846` 为 198/198 业务场景、TDS CONTRACT 49/49、V-S14 9/9、operation identity 296/296、`UNCLASSIFIED_SQL=0`，business 与 cleanup 均 PASS；TDS readiness/pre-stop RSS 为 229,132/257,448 KiB（512 MiB 预算）。`scripts/verify --validate-only` 为 48/48 PASS；这不是未带参数的完整 `scripts/verify` 结果。测试脚本与用例专项复核记录为 `doc/review/platform/2026-09-30-v2s-terminal-activation-batch-1-test-script-review-codex.md`。Browser L2、seed dry-run 与早前 6b MATCHED 对应较早字节，本轮未重跑。13c 当前仍 OPEN；按 Dexter 指示不再扩写，直接请求本轮独立实现 review。当前字节本轮没有运行 Browser L2、reset、DEV readiness 或 seed。

目标：按 REVIEW_TARGET=IMPLEMENTATION 独立判断阶段一实现是否符合需求、详设、IA、交互工件和项目治理，同时检查方案自身是否合理；逐项核对生产代码、测试客户端、验收脚本的字段、时序、owner、协议和故障路径。详设没有可执行判据的列入 DESIGN_GAPS。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md：需求正本与 D-37～D-43 裁决；
- doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md：阶段一详设与判据；
- doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-plan-codex.md：批次范围、阶段和验证；
- doc/plans/platform/2026-09-23-v2s-store-terminal-management-ia-codex.md 与 doc/plans/platform/2026-09-23-v2s-store-terminal-management-ui-interaction-design-codex.md：IA 与交互工件；
- doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md 与 doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md：用户任务与已接受服务边界；
- contracts/protocol/terminal-connection-protocol.json：终端连接共享协议；
- doc/review/platform/2026-09-27-v2s-terminal-activation-batch-1-execution-status-codex.md：既往运行证据与对应字节边界；
- doc/review/platform/2026-09-30-v2s-terminal-activation-batch-1-test-script-review-codex.md：本轮测试客户端、结构断言、日志隔离与动态结果的专项复核；
- doc/review/platform/2026-09-28-v2s-terminal-activation-batch-1-6b-reconciliation-r5-codex.md、doc/review/platform/2026-09-29-v2s-terminal-activation-batch-1-projection-binding-reconciliation-codex.md、doc/review/platform/2026-09-28-v2s-terminal-activation-batch-1-l2-admission-review-r3-codex.md、doc/review/platform/2026-09-27-v2s-terminal-activation-batch-1-dynamic-front-admission-codex.md 与 doc/review/platform/2026-09-26-v2s-terminal-activation-batch-1-r3-repair-record-codex.md：对账、准入和修复证据；
- doc/review/platform/2026-09-29-v2s-terminal-activation-batch-1-code-design-reconciliation-codex.md：13c 对账仍 OPEN；本轮按 Dexter 指示不继续扩写，需知悉其未 MATCHED；
- apps/backend/catering-business-server/modules/terminal-binding/、apps/backend/catering-business-server/modules/store-terminal/、apps/backend/terminal-data-server/：后端与 TDS 生产代码和测试；
- apps/frontend/operations-admin/、scripts/test/、scripts/backend-acceptance/：门店终端 UI、测试客户端与验收入口；
- doc/platform/implementation-task-template.md：实施与验收约束。

请重点核验：激活重试与 D-40/D-38、owner/事务/审计、终端类型只读、终端凭证认证、未知字段规则、TDS WebSocket 字段/时序/压缩和消息边界、通知与会话生命周期、V-S12/V-S14 故障路径、R-12 生成与验证门闭包、D-41 仓内依赖边界、真实验收拓扑以及日志/cleanup 证据。请结合测试专项复核记录，独立检查测试客户端字段与服务端处理是否一致、结构门是否真实覆盖其声称范围、per-marker 日志关联和清理断言是否可靠。请按详设逐项追到生产代码与测试，不要抽样；实现与详设不一致或详设无判据时分别指出。

烦请给出明确 GO 或 NO-GO，并报 M/S/N 数量。每条 finding 请提供详设位置、实现/测试仓库相对路径与行号、性质、影响、最小可验收修正、是否需要 Dexter 裁决；详设缺口列入 DESIGN_GAPS。

授权边界：本次只授权静态 review，不授权再次运行动态验收、修改代码、部署、DEV、reset、seed、L2、UAT，也不涉及批次二和批次三。谢谢。
```
