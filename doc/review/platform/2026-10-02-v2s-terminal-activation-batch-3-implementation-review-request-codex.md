# 批次三实施结果交 Claude 静态复评

## 背景

批次三实施、CP-01～CP-06、全批 6b、13c、适用动态验收及最终非生产 reset → DEV start → 完整 `r5-full` seed 已完成。首次 fresh 整批 IMPLEMENTATION review 的唯一 S-1 已由主 agent 核实并最小修复，受影响 CP 与 6b/13c 差量复核均 MATCHED；新的 fresh 整批 IMPLEMENTATION reviewer 给出 GO，M/S/N=0/0/0。之后只修正详设和交付报告中一个不存在的跨节点场景别名，生产源码、测试与已通过动态场景未变。

## 评审目标

请对当前字节的批次三整批实施做独立静态复核，重新判断方案与实际实现是否满足需求，并核验下列材料中的代码、契约、运行证据与边界是否一致。不要把作者的 CP MATCHED、动态 PASS 或既有独立 GO 当作本轮结论；它们是待核证据。本轮请求不要求重跑动态验证。

## 需阅读文件

- `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md`：批次三需求与验收判据。
- `doc/decisions/2026-10-02-v2s-terminal-activation-batch-3-amendment-proposal.md`：已接受的 Doris 与批次边界裁决。
- `doc/plans/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-design-codex.md`：当前详设、实现落点及 §11/§11a 验收映射。
- `doc/plans/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-plan-codex.md`：CP 顺序、执行边界与完成条件。
- `doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-delivery-codex.md`：当前逐项结果、运行证据与限制。
- `doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-review-intake-codex.md`：首轮 S-1 intake、根因、修复及 focused proof。
- `doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-cp01-codex.md` 至 `doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-cp06-codex.md`：完整 CP 阶段对账记录。
- `doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-6b-codex.md`、`doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-13c-codex.md`：全批三维对账及逐代码生产者/生成物映射。
- `doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-dynamic-admission-codex.md`：全批动态、reset、DEV start、seed 与 cleanup 的 run 证据。
- `doc/review/platform/2026-10-01-v2s-terminal-activation-batch-3-doris-feasibility-codex.md`、`doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-resident-feasibility-codex.md`：R-14 临时与 resident 可行性证据及边界。
- `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/history/TdsConnectionHistoryWriter.java`、`apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/history/TdsDorisStreamLoadClient.java`、`apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/session/TdsConnectionStateRepository.java`、`apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/session/TdsBindingRevocationListener.java`、`apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/session/TdsTerminalSessionActors.java`：Doris 隔离写入及 PG 权威跨节点会话逻辑。
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/TerminalConnectionContractScenarios.java`、`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/StoreTerminalAcceptanceScenarios.java`：真实 HTTP/TDS 场景、跨节点接管与取消断言。
- `scripts/dev/r5-doris-resident.mjs`、`scripts/dev/r5-doris-resident-feasibility.mjs`、`scripts/dev/r5-reset.mjs`、`scripts/dev/r5-dev-runner.mjs`、`scripts/dev/doris/connection-history.sql`：resident、预检、reset/DEV 生命周期与 operational DDL。
- `.runtime/r5/reset/r5-reset-f49ecc36-400c-4f21-8002-29181073e33a/run-manifest.json`、`.runtime/r5/run-manifest.json`、`.runtime/r5/seed/complete/complete-seed-16944083-6487-4df6-bde3-665522894b4e/run-manifest.json`、对应的 `seed-report.json`，以及 `.runtime/terminal-client-dev-acceptance/ter-client-dev-1790911220193-47729-9a7e19e4-55d9-4edf-a117-ee77c937ad44/manifest.json`：最终 reset、保留 DEV、seed 与 current-byte E1 记录。

## 独立核验重点

1. 重新核对 PG 业务事实权威、跨节点 latest session/sequence、通知仅作唤醒、监听恢复和“PG 提交后、本地登记前”竞态闭包；确认真实 HTTP 设备取消在 `terminal.connection.vs13.cross-node-recovery` 内的子断言有 `ACTIVATION_CANCELLED`、Doris断开记录及控制会话 PONG 证据，且没有继续引用不存在的 selector。
2. 核对 Doris 写入的队列/批量/超时/重试/丢弃、秘密字段排除、Stream Load 权限和 operational DDL；确认 Doris 故障不阻塞业务 owner 与主流程。
3. 核对 resident writer 密码每次按当前受管 credential 对账的 S-1 修复、红例、官方 Doris 4.1.3 依据、受管 preflight 资源 profile 与当前 manifest/readback 的连贯性。
4. 核对 CP-01～06、6b、13c 结论各自范围，以及历史完整 `scripts/verify` PASS 与 final localized repair 后 focused proof 的证据边界；不得升级成最终全量 aggregate PASS。
5. 核对最终顺序为 current-byte full seed dry-run → Doris 清空/readback 与 PG reset → 独立 DEV start/readiness → 完整 `r5-full` seed；业务结果、cleanup、最终保留 DEV 分开判断。
6. 未执行 L2、Android/Expo、UAT、生产部署、生产 HA 与长期容量验证；不要将它们或单次 feasibility 样本推成 PASS。

## 期望结论

请给出明确 `GO` 或 `NO-GO` 与 `M/S/N` 数量。每条 finding 请指出详设判据、精确生产实现/测试/脚本/证据位置、影响、最小可验收修正及是否需要 Dexter 产品裁决。若详设缺少判据，单列 `DESIGN_GAPS`。请区分当前字节的静态判断、已有动态证据与没有运行的范围。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对《终端激活与长连接》批次三实施结果做整批静态复评。

背景：批次三实施、CP-01～CP-06、全批 6b、13c、适用动态验收及最终非生产 reset → DEV start → 完整 r5-full seed 已完成。首轮 fresh 整批 IMPLEMENTATION review 的唯一 S-1 已经核实并修复；受影响 CP、6b、13c 差量复核均 MATCHED。新的 fresh 独立整批 IMPLEMENTATION reviewer 给出 GO，M/S/N=0/0/0。本次仅修正了详设与交付报告里一个不存在的跨节点场景别名，未改生产源码、测试或动态场景。请从当前字节独立重开需求、详设、生产源码、测试与实际运行证据形成判断，不继承作者或此前 reviewer 的结论。

目标：复核批次三真实实现、协议与 owner 边界、Doris 故障隔离、跨节点接管与 listener 恢复、R-14/R-6.7 与受管 DEV/reset/seed 生命周期，以及验收映射和证据限制。请特别核对 V-S5 的证据映射为 `terminal.connection.vs13.cross-node-recovery` 内的 `device-cancel-after-takeover` 子断言，而非独立场景；该动态 run 为 `r5-tc-1790896315855-42187`。

请从 catering-v2s 仓库根阅读：
- `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md`：批次三需求；
- `doc/decisions/2026-10-02-v2s-terminal-activation-batch-3-amendment-proposal.md`：已接受裁决；
- `doc/plans/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-design-codex.md` 与 `doc/plans/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-plan-codex.md`：当前详设与计划；
- `doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-delivery-codex.md`：最终交付；
- `doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-review-intake-codex.md`：finding intake；
- `doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-dynamic-admission-codex.md`：动态、reset/DEV/seed 与 cleanup 证据；
- `doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-cp01-codex.md`、`doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-cp02-codex.md`、`doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-cp03-codex.md`、`doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-cp04-codex.md`、`doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-cp05-codex.md`、`doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-cp06-codex.md`、`doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-6b-codex.md`、`doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-13c-codex.md`：阶段对账与全批 source-to-artifact 对账；
- `doc/review/platform/2026-10-01-v2s-terminal-activation-batch-3-doris-feasibility-codex.md` 与 `doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-resident-feasibility-codex.md`：R-14 feasibility 证据及边界；
- `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/history/TdsConnectionHistoryWriter.java`、`apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/history/TdsDorisStreamLoadClient.java`、`apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/session/TdsConnectionStateRepository.java`、`apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/session/TdsBindingRevocationListener.java`、`apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/session/TdsTerminalSessionActors.java`：Doris隔离写入及PG权威跨节点会话逻辑；
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/TerminalConnectionContractScenarios.java` 与 `StoreTerminalAcceptanceScenarios.java`：真实 HTTP/TDS 验收路径；
- `scripts/dev/r5-doris-resident.mjs`、`scripts/dev/r5-doris-resident-feasibility.mjs`、`scripts/dev/r5-reset.mjs`、`scripts/dev/r5-dev-runner.mjs`、`scripts/dev/doris/connection-history.sql`：受管运维实现与 DDL；
- `.runtime/r5/reset/r5-reset-f49ecc36-400c-4f21-8002-29181073e33a/run-manifest.json`、`.runtime/r5/run-manifest.json`、`.runtime/r5/seed/complete/complete-seed-16944083-6487-4df6-bde3-665522894b4e/run-manifest.json`、`.runtime/r5/seed/complete/complete-seed-16944083-6487-4df6-bde3-665522894b4e/seed-report.json`、`.runtime/terminal-client-dev-acceptance/ter-client-dev-1790911220193-47729-9a7e19e4-55d9-4edf-a117-ee77c937ad44/manifest.json`：最终 reset、保留 DEV、seed 与 current-byte E1 记录。

请重点独立核验：PG 是跨节点业务事实权威、Doris 只承载连接历史；Doris writer 有界且故障不阻塞业务；resident密码修复与实际写入证据一致；CP、6b、13c和当前动态证据的范围准确；历史全量 `scripts/verify` 与最终 focused proof 没有混称；reset、DEV start、完整 seed 和cleanup的真实身份/顺序；未运行范围没有被写成 PASS。

请给出明确 `GO` 或 `NO-GO` 与 `M/S/N`。每条 finding 请标出详设判据、源码/测试/脚本/证据的仓库相对路径和行号、影响、最小可验收修正及是否需要 Dexter 产品裁决；详设缺失的判据请列为 `DESIGN_GAPS`。不要运行本次交付外的动态验证。

授权边界：本次请做实施结果的独立静态复评。现有运行证据仅按各自 run/source/拓扑范围判断；不授权新增实施、L2、UAT、生产部署、生产HA或长期容量验证。谢谢。
```
