# TDP CP-06 focused proof

日期：2026-10-05

## 范围与边界

本记录覆盖 CP-06「terminal-control 在线远程执行与结果回传」的阶段内 focused proof。它不是整批 `6b`、整批动态验收、DEV / Expo Web 结果或最终 `REVIEW_TARGET=IMPLEMENTATION` verdict。动态验收仅覆盖本记录列出的受管场景；不据此声称所有 §11a 判据已经通过。

## Claude 外部 finding intake

主 agent 重开了需求、详设、计划、项目 finding-intake 规范及对应 owning source，并寻找反例。处置如下：

| Finding | 主 agent 分类 | 处置及边界 |
| --- | --- | --- |
| S-1 SQL 权限与阶段顺序 | `CONFIRMED` | 已把 terminal-control schema/function 授权和正反权限验证放在 CP-06 对象建立之后；CP-03 对尚不存在对象 fail closed，不把缺对象说成权限拒绝。修订见详设 §5.1a、§12 与计划 CP-03/06。 |
| S-2 GET 错误契约与生成源 | `REJECTED_WITH_EVIDENCE` | 当前 canonical/materialize/codegen 链已有所需的 422/503 状态投影；历史 catalog 的 `target:null` 不由生成器读取，不作为新增契约源。未修改生成物或错误码正本。 |
| S-3 peer 迟到结果观察/释放 | `CONFIRMED` | 已沿用 request-scoped handoff，显式携带同一 `requestId`/`commandId` 及有限剩余期限；普通 timeout 返回 UNKNOWN，期限内的迟到结果可被已登记 observer 观察，超期释放且不重派；不增加 peer ledger。 |
| S-4 peer 结果投影与超界行为 | `CONFIRMED` | 发送方校验完整序列化 envelope，接收方校验完整 wire schema；不截断、不伪成功，无法表示时安全留为 UNKNOWN 并回传 typed codec failure。没有新增 TDC map 字节配额。 |
| N-1 表格列数 | `REJECTED_WITH_EVIDENCE` | 复核当前两张表的真实列数后，表格与 intake 陈述一致；不新增分母或场景。 |

详见 [外部评审 intake r5](2026-10-05-v2s-tdp-external-claude-review-intake-r5-codex.md)。这些是作者核验记录，不替代独立整批 verdict。

## 当前 focused proof

| 范围 | 当前字节证据 | 结果与限制 |
| --- | --- | --- |
| TDC/Runtime 迟到结果与记录状态 | `yarn workspace @catering-v2s/kernel-base-terminal-data-client typecheck && yarn workspace @catering-v2s/kernel-base-terminal-data-client test` | 当前字节 PASS，52/52，8 files，0 skip。覆盖重复operation不redispatch、身份冲突拒绝、持久化失败不dispatch、ACK失败保留事实、64项上限拒绝且不逐出、重连UNKNOWN不重派、迟到结果更新、配置变更与root reset清理后的迟到结果不复活；仅focused package proof。 |
| Topology peer result | `yarn workspace @catering-v2s/kernel-base-topology typecheck && yarn workspace @catering-v2s/kernel-base-topology test` | PASS，43/43。包含显式 requestId 传递、真实 transfer callback 结果返回及过期后不通知 observer。 |
| Runtime 结果 handoff | 本轮前已执行的 Runtime 两模式 focused test 记录：103/103（每模式）；详设 §9 handoff 当前实现及其测试作为 owning source | PASS，沿用现有未受后续修改影响的 focused 结果；不是 peer wire、数据库或 DEV 证据。 |
| terminal-control owner | `V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY PATH="/usr/local/bin:/opt/homebrew/bin:$PATH" ./gradlew --no-daemon --rerun-tasks :apps/backend/catering-business-server:modules:terminal-control:test :apps/backend/catering-business-server:compileTestJava` | 当前字节 PASS，owner 7/7，Gradle BUILD SUCCESSFUL；显式本机 Node 路径供无daemon Gradle使用。覆盖首次intent INSERT失败typed refusal且不通知、operation读失败typed unavailable、report持久化失败不返回ACK；未执行数据库验收。 |
| TDS模块与报告写失败不ACK | `node scripts/test/r5-remote-testcontainers.mjs :apps/backend:terminal-data-server:test`，run `r5-tc-1791130073190-42933` | 当前字节 PASS，远端`compileTestJava`和`test`任务均执行；新增handler focused test经真实REMOTE_REPORT解码及报告owner调用，owner写入失败时无`REMOTE_REPORT_ACK`且连接以`SERVER_ERROR`收口。Testcontainers容器/卷、远端进程/工作区 cleanup PASS。它不是CBS业务验收。 |
| 真实 CBS/TDS/PG 远程命令合同与终态不回退 | `scripts/test/backend-acceptance --operation storeTerminalActivationBusinessPrecedence --topology-preflight --tds-contract-scenario terminal.connection.remote-command`，当前字节 run `r5-tc-1791130381492-50744` | 选中业务场景1/1，`CONTRACT=PASS`、`BUSINESS=PASS`、`DB_OPERATIONS=7`；远程command真实执行一次并读回`COMPLETED/helloWorld`。wire client在三个持久阶段后又真实发送时间较早的`STARTED`报告，TDS接受并ACK；owner权威读回仍为`COMPLETED`且结果未变。TDS contract artifact 3/3，含remote-command及另两项既有合同；不把合同总数混称为业务场景数。manifest记录Testcontainers容器/卷、远端进程/工作区、TDS进程cleanup均PASS；运行前DEV不在运行，无stop/restore。 |

受管 run manifest：`.runtime/r5/evidence/remote-testcontainers/r5-tc-1791130381492-50744/run-manifest.json`；摘要、原始 TDS contract/client/业务结果日志与 classpath 报告归档在同一目录。远端运行开始 `2026-10-04T16:13:01.493Z`、结束 `2026-10-04T16:16:12.913Z`（UTC）。

## 阶段状态

- CP-06 focused proof：以上表格所列范围 PASS；动态证明覆盖远端真实 PostgreSQL、CBS HTTP 业务操作及 TDS WebSocket 远程 command，不覆盖 DEV / Expo Web。
- CP-06 阶段三维对账：fresh 独立 reviewer `/root/tdp_cp06_reconciliation_fresh` 判定 `MATCHED`；其核对范围包括需求、详设、计划、适用记忆规范、当前实现/测试及最新 run `r5-tc-1791130381492-50744`。未发现 CP-06 `OPEN`。该阶段 verdict 不代表整批 `6b` 或整批实施 verdict。
- 当前全量 `scripts/verify`、批次全目录 acceptance/calibration、DEV、Expo Web、全批 `6b`、13c 与最终独立实现 review 均未由本记录证明，保持 `NOT_RUN`，除非后续独立运行证据另行记录。
