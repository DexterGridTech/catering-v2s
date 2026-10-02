# 批次三实施结果最终复评请求 · S-1/S-2 修复后

## 背景

批次三整批独立静态复评发现 S-1（PG open 成功后的权威读回失败没有排断开待写）与 S-2（Java `HttpRequest.timeout` 未覆盖响应体停顿）。主 agent 重开需求、详设、owner 源码、测试及 Java 21.0.11+9 OpenJDK 官方源码后确认两项成立，并在原批准批次范围内最小修复。受影响 focused proof 已通过；fresh 独立整批 `REVIEW_TARGET=IMPLEMENTATION` reviewer 给出 `GO`、`M/S/N=0/0/0`。本材料请 Dexter 转 Claude 作交付复评，不把作者或独立 reviewer 的结论当作 Claude 的结论。

## 评审目标

独立核验批次三整批实现当前字节是否满足需求与详设，尤其确认本轮两项缺陷已闭合、受影响测试和运行证据准确，未把历史全量 PASS 扩大成修复后全量 PASS。无需重复已有效且未受影响的动态验证。

## 需阅读文件

- `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md`：原始需求及批次三验收判据。
- `doc/decisions/2026-10-02-v2s-terminal-activation-batch-3-amendment-proposal.md`：已接受的 Doris 边界。
- `doc/plans/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-design-codex.md` 与 `doc/plans/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-plan-codex.md`：当前详设、计划及 S-1/S-2 修订。
- `doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-final-findings-intake-codex.md`：两项 finding 的 intake、根因、修复、失败历史、证据边界及独立 verdict。
- `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/session/TdsTerminalSessionActors.java`、`.../history/TdsDorisStreamLoadClient.java`：受影响生产逻辑。
- `apps/backend/terminal-data-server/src/test/java/com/catering/v2s/terminaldataserver/session/TdsTerminalSessionActorsTest.java`、`.../state/TdsConnectionStateRepositoryPostgresIntegrationTest.java`、`.../history/TdsDorisStreamLoadClientTest.java`：candidate readback 异常、旧 identity 防覆盖、完整 HTTP 响应体停顿及取消测试。
- `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/state/TdsConnectionStateWriter.java` 与 `.../history/TdsConnectionHistoryWriter.java`：断开持久化 callback、队列和 Doris 重试调用链。
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1790922784201-75675/run-manifest.json` 及其日志/XML：本轮最终 focused Doris HTTP proof 与 cleanup。
- `.runtime/r5/run-manifest.json`、`.runtime/r5/readiness-77212.jsonl`：最新受管 DEV start、进程身份和 readiness。
- `doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-delivery-codex.md`、`.../2026-10-02-v2s-terminal-activation-batch-3-6b-codex.md`、`.../2026-10-02-v2s-terminal-activation-batch-3-13c-codex.md`：批次既有交付、全批对账及逐代码对账边界。

## 独立核验重点

1. S-1：`repository.open` 已提交而 `readCurrentSession` 失败时，候选是否只关闭自身、以精确 identity 进入现有 `queueDisconnect`、不发送 SESSION_READY/CONNECTED、不连带关闭 previous active，并且只在写入完成 callback 后释放 tracked permit；较旧 identity 的迟到断开不得覆盖新 sequence。
2. S-2：按远端 DEV 实际 Java 21.0.11 对应的 OpenJDK `jdk-21.0.11+9` 依据核对总 deadline 是否真实覆盖 send、响应头及有界完整 body；超时是否取消原 future/exchange、返回既有 `REQUEST_TIMEOUT`，并让 writer 可继续后续 batch。核对同版本官方源码引用及 focused 测试，不依赖仅有响应头前 timeout 的旧测试。
3. 核对已有 writer 有界队列、重试次数、稳定 label/payload 与本次取消路径一致；不要求新增恢复框架。
4. 审核当前 focused run `r5-tc-1790922784201-75675`（`TdsDorisStreamLoadClientTest` 4/4、business=N/A、cleanup PASS）以及 S-1 测试所在先前 run 的类级结果；不得将先前整体 FAIL 重述为 PASS。
5. 核对 DEV start `r5-dev-1790922860937-77212-d6aee404-6382-43b0-804f-b9becf3f5c3c` readiness/受管身份；DEV 是有意保留的环境，不与临时测试 cleanup 混为一谈。未重跑 reset/seed。
6. 历史 `scripts/verify` 和 full backend-acceptance 未因本轮两个窄修复重跑；审查中按其原运行字节、范围与拓扑报告，不得升级为本轮 current-byte aggregate PASS。L2、UAT、生产部署、生产 HA 与长期容量验证仍未执行。

## 期望结论

请给出明确 `GO` 或 `NO-GO` 与 `M/S/N`。每条 finding 请列详设判据、当前生产源码/测试/证据的仓库相对路径与行号、影响、最小可验收修正及是否需要 Dexter 产品裁决；详设缺少判据时单列 `DESIGN_GAPS`。区分当前字节静态结论、focused 动态结果与历史整批证据。

## 可直接复制给 Claude 的话术

```text
您好 Claude，请对《终端激活与长连接》批次三实施当前字节做最终复评。

背景：整批复评此前发现 S-1（PG open 成功而 latest readback 失败时漏记候选断开）及 S-2（Doris Stream Load 的 10 秒请求期限没有覆盖响应体停顿）。Codex 主 agent 逐项重开需求、详设、owning source、测试与 Java 21.0.11+9 OpenJDK 官方源码，确认两项成立并完成最小修复。受影响 focused proof 已通过；fresh 独立整批 REVIEW_TARGET=IMPLEMENTATION reviewer 的只读 verdict 为 GO，M/S/N=0/0/0。请独立判断，不继承该 verdict，也不要求重跑未受影响的全量运行。

目标：复核批次三实现仍满足需求与详设，重点检验 S-1/S-2 修复、失败及边界路径、测试断言与当前运行证据；同时确认报告没有把历史整批 PASS 说成本轮修复后的全量 PASS。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md：R-6.1～R-6.6、R-7.3 与批次三需求；
- doc/decisions/2026-10-02-v2s-terminal-activation-batch-3-amendment-proposal.md：Doris 已接受边界；
- doc/plans/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-design-codex.md、doc/plans/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-plan-codex.md：当前详设与计划；
- doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-final-findings-intake-codex.md：本轮 finding intake、修复与证据边界；
- apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/session/TdsTerminalSessionActors.java、apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/state/TdsConnectionStateWriter.java、apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/history/TdsDorisStreamLoadClient.java、apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/history/TdsConnectionHistoryWriter.java：两条 owning path 与现有 writer；
- apps/backend/terminal-data-server/src/test/java/com/catering/v2s/terminaldataserver/session/TdsTerminalSessionActorsTest.java、apps/backend/terminal-data-server/src/test/java/com/catering/v2s/terminaldataserver/state/TdsConnectionStateRepositoryPostgresIntegrationTest.java、apps/backend/terminal-data-server/src/test/java/com/catering/v2s/terminaldataserver/history/TdsDorisStreamLoadClientTest.java：确定性反例及 focused tests；
- .runtime/r5/evidence/remote-testcontainers/r5-tc-1790922784201-75675/run-manifest.json 与关联日志/XML：当前 S-2 focused run；.runtime/r5/run-manifest.json 与 .runtime/r5/readiness-77212.jsonl：最新受管 DEV start；
- doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-delivery-codex.md、doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-6b-codex.md、doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-13c-codex.md：此前批次证据与对账范围。

请重点核验：
1. `readCurrentSession` 在 PG open 后失败时，candidate 是否只关闭自身并以精确 identity 排入现有断开队列；SESSION_READY/CONNECTED 是否不发生，previous active 是否保持，tracked permit 是否等待 persisted callback，旧 identity 是否不能覆盖较新 sequence。
2. Java 21.0.11 / OpenJDK `jdk-21.0.11+9` 下，Doris load deadline 是否覆盖发送、响应头与完整有界响应体，超时是否取消原 exchange 并让有限 writer 可继续；检查官方版本源码依据与真实 header 后 body stall 测试。
3. focused run `r5-tc-1790922784201-75675` 中 Doris 测试类 4/4、business=N/A、cleanup PASS；较早 run 因前版 S-2 断言失败，S-1 类级通过不得升级成整 run PASS。
4. DEV manifest/readiness 的身份及有意保留状态；未重跑 reset/seed。历史全量 `scripts/verify` 与 backend-acceptance 不得升级成本轮 current-byte 全量 PASS。L2、UAT、生产部署、生产 HA 与长期容量仍为未执行范围。

请给出明确 GO 或 NO-GO 与 M/S/N。每条 finding 请列详设判据、当前源码/测试/证据的仓库相对路径和行号、影响、最小可验收修正及是否需 Dexter 产品裁决；详设缺判据时单列 DESIGN_GAPS。只做静态复评，不运行动态验证。

授权边界：本次请评审批次三实施当前字节和已留存证据；不授权新增实施、动态运行、L2、UAT、生产部署、生产 HA 或长期容量验证。谢谢。
```
