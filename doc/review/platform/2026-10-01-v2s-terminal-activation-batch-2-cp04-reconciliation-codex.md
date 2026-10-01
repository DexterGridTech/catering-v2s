# 终端激活与长连接 · 批次二 CP-04 对账

日期：2026-10-01。当前状态：`CP04_RECONCILIATION=MATCHED`，`M/S/N=0/0/0`。fresh 独立只读 reviewer：`/root/cp04_current_bytes_recheck`。本记录只覆盖 CP-04 的需求、详设/计划、项目记忆规范与当前源码/focused proof 对账；不声称批次 6b、远端动态验收或最终实施 review 已通过。

## 阶段范围

CP-04 实现 TDS 默认/可配置 node ID、readiness health 与优雅下线；闭合 V-S1、V-S9、V-S15、V-E6 对应的配置、验收入口和 focused proof。详设与计划均明确 CP-04 只完成阶段实现和 focused proof；整批受管动态验收、cleanup、13c 与最终 `REVIEW_TARGET=IMPLEMENTATION` 属于 CP-06 退出后的批次级收口。

## Finding intake 与处置

CP-04 首轮 fresh 对账发现一项确认的异步日志排序过度断言。V-S15 把 readiness diagnostic marker、admission-refused 与 drain-started 的文件位置当成跨阶段顺序证据；前者与后两者分别由不同异步日志任务写入，不能据 bounded-elastic scheduler 推断文本 FIFO。进一步同根扫描发现 V-S9 也要求 drain-started 与另一个异步任务写出的 drain-completed 按文件位置排序。

最小修复只调整验收 oracle 和对应详设/计划：

- V-S15 以真实 HTTP readiness 首次观察到非 `UP` 的时间为起点，断言到拒新/排空日志阶段标记之间已经过配置等待时间；只对同一日志任务发出的 `admission_refused → drain_started` 检查相对顺序。
- V-S9 只检查同任务内 `admission_refused → drain_started` 顺序；完成标记只检查存在，并由真实会话关闭 readback 与 TDS 进程退出核实 drain 完成，不断言跨任务日志的文本先后。
- 生产 readiness/drain 行为与诊断日志保留。`scripts/test/backend-acceptance-structure.test.mjs` 防止恢复跨任务排序断言，并绑定 HTTP elapsed proof。

分类：`CONFIRMED`（验收 oracle 对异步日志的顺序假设不受源码保证）。未发现产品/Journey 歧义，也未改变业务关停顺序。

## 当前 focused proof

- `node --test scripts/test/backend-acceptance-structure.test.mjs scripts/test/r5-remote-testcontainers.test.mjs scripts/test/terminal-ws-wire-client.test.mjs`：latest current-byte proof 103 passed，0 failed；输出 `.runtime/review/terminal-activation-batch-2-cp04/backend-acceptance-structure-r6.log`，SHA-256 `6610ac45ca0769641ee3b7b497024aef07439db2ac2dca2daec68e7f2b5cf9d9`。
- `./gradlew --offline :apps:backend:terminal-data-server:test --tests 'com.catering.v2s.terminaldataserver.session.TdsGracefulShutdownLifecycleTest' --rerun-tasks :apps:backend:catering-business-server:compileTestJava`：`BUILD SUCCESSFUL`，33 tasks executed；输出 `.runtime/review/terminal-activation-batch-2-cp04/gradle-focused-r5.log`，SHA-256 `193b026cf93846c3d3c999274f1b2f68aa5e1b4683ee8732612d823d0b350ce6`。
- `.runtime/review/terminal-activation-batch-2-cp04/current-source-sha256.txt` 对 26 个列明文件执行 `shasum -a 256 -c`，26/26 `OK`。明细也保存在 `cp04-focused-proof.md`。

以上只属本地 focused/结构测试与编译证据；真实 V-S9/V-S15 backend-acceptance、受管 TDS、DEV、HAProxy 与 cleanup 尚未运行，保持 `NOT_RUN`。

## Fresh 独立 verdict

Reviewer `/root/cp04_reconcile_final` 对后续 V-S9 finding 修复后的完整 CP-04 独立复核，返回 `CP04_RECONCILIATION=MATCHED`、`M/S/N=0/0/0`。其核验确认 V-S9 真实要求 captured log 中拒新先于 drain-started、生产两标记在一个 enqueue task 中、没有对跨任务 completion marker 强断序；还核对 V-S15 formatter-tolerant bounded matcher、26/26 当前源摘要和 CP-06/整批收口边界。Reviewer 未运行命令或动态环境；该 verdict 不替代全批 6b 或动态证据。

该 verdict 后，官方 `spotlessApply` 仅重排 `TerminalConnectionContractScenarios.java` 的 V-S9 `assertTrue` 参数换行，未改断言语义；因此上述 `MATCHED` 与此前 26 项摘要不再绑定当前源码字节，现标为历史 verdict，等待新的 current-byte 复核。

## 动态状态

当前字节上的最新运行：无受管运行；动态验收尚未启动。

最后一次通过：CP-04 本地 focused Node/Gradle 证明，2026-10-01；当前 CP-04 源码字节；不适用受管资源 cleanup。

## Finding reopen/repair history

`/root/cp04_current_reconcile` 曾返回 `OPEN`，`M/S/N=0/1/0`：V-S9 等待两个 marker 存在，却缺少与计划 §4 CP-04 一致的 `admission_refused → drain_started` 顺序断言。主 agent 确认 production 在一个 `TdsAsyncLog.enqueue` task 内按该顺序记录两个 marker，V-S9 补充断言与 `V-S9_ADMISSION_DRAIN_LOG_ORDER_INVALID`，structure suite 添加对应源码 guard。`drain_completed` 仍只查存在，完成由连接关闭 readback 与受管 TDS process exit 验收，不增加跨任务日志顺序假设。

修复后的首次 Node run 暴露已有 V-S15 matcher 对格式化换行过度敏感（要求 `withdrawalElapsedMillis >=` 同行）。主 agent将 matcher 改为允许操作符周围 Java 空白且保留 180 字符闭合边界；同一 focused suite 的首次失败留在 `backend-acceptance-structure-r5.log`，修复后 `r6` 为 103/103 PASS。TDS lifecycle unit test 用 `--rerun-tasks` 真正执行后通过，避免接受 up-to-date 的旧证明。最新 fresh reviewer `/root/cp04_reconcile_final` 重开完整 CP-04 后返回 MATCHED。全部都属于 local focused proof；本轮未声称 managed dynamic PASS。

## 后续格式化后的当前字节证明

- `spotlessApply` 只改变 `TerminalConnectionContractScenarios.java` 的格式；现行 26 文件清单 `.runtime/review/terminal-activation-batch-2-cp04/current-source-sha256.txt` 重新绑定当前字节，`shasum -a 256 -c` 为 26/26 `OK`，清单 SHA-256 `838e60ef3eae6a8505890b241a166649426d99264c2c32134fb9b1dbb7dd10b9`。
- `node --test scripts/test/backend-acceptance-structure.test.mjs scripts/test/r5-remote-testcontainers.test.mjs scripts/test/terminal-ws-wire-client.test.mjs`：103/103 PASS；`.runtime/review/terminal-activation-batch-2-cp04/backend-acceptance-structure-r7.log`，SHA-256 `5e36e4ffaec56e426fefa6e817c56bb21c9c652183233903ac09f29b570706b6`。
- `./gradlew --offline :apps:backend:terminal-data-server:test --tests 'com.catering.v2s.terminaldataserver.session.TdsGracefulShutdownLifecycleTest' --rerun-tasks :apps:backend:catering-business-server:compileTestJava`：`BUILD SUCCESSFUL`，33 actionable tasks executed；`.runtime/review/terminal-activation-batch-2-cp04/gradle-focused-r6.log`，SHA-256 `206323b0df408a0e55b9b85bc0a48bd4cdfd63fef0f940aecc7f271093d8ff8e`。
- `./gradlew --offline :apps:backend:catering-business-server:spotlessCheck`：`BUILD SUCCESSFUL`；`.runtime/review/terminal-activation-batch-2-cp04/spotless-focused-r7.log`，SHA-256 `d2c5909eb9d26da22f35ca74a3eb601d049570c1d35e8f1da817ec60f080a822`。
- 当前 CP-06 `scripts/verify --validate-only` r6：`PASS`, `EXECUTED=49/49`, `CLEANUP=NOT_APPLICABLE_STATIC_ONLY`; run `ter-local-static-66911-1790810769241`; log `.runtime/review/terminal-activation-batch-2-cp06/scripts-verify-validate-only-r6.log`, SHA-256 `38f2523dfa7c6b3b7d49c7029179d01deb3b3bdb6dd156f9f5a6482e6f00c4a4`.

以上是当前字节上的 focused/static proof，不是 CP-04 新的独立三维 verdict；CP-04 在 fresh reviewer 完成前保持 `OPEN`。受管 V-S9/V-S15 与整批动态仍 `NOT_RUN`。

## 最新 current-byte 独立三维复核

Fresh reviewer `/root/cp04_current_bytes_recheck` 按原需求、详设/计划、项目规范、生产 owner 与 acceptance oracle 独立重开完整 CP-04，返回 `CP04_RECONCILIATION=MATCHED`、`M/S/N=0/0/0`。Reviewer 确认：V-S9/V-S15 的 admission-refused→drain-started 断言限定于同一 `TdsAsyncLog.enqueue`；readiness elapsed 由真实 HTTP 观测核验；completion 不以跨异步任务日志位置推断，而由会话关闭 readback 与进程退出证明；26 文件当前摘要 26/26 有效。Reviewer 未运行测试或受管环境。

该 MATCHED 只关闭 CP-04 阶段三维对账。受管 V-S9/V-S15、DEV、HAProxy 与 cleanup 仍 `NOT_RUN`，待整批 6b 后的动态阶段执行。
