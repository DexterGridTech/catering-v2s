# 批次三实施复核 finding intake

## Intake 结论

Claude fresh 实施复核原始结论：NO-GO，M/S/N=0/1/0。主 agent 重开需求 R-6.7/R-14、已接受 amendment、详设 CP-04/第三方依据、CP-04 owning source 与项目记忆后，认定唯一 finding CONFIRMED，无 Dexter 产品裁决。

### S-1 · resident Doris 复用时 writer 密码可能与 TDS 配置漂移

- 评审位置与判据：详设 doc/plans/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-design-codex.md:131-136；amendment doc/decisions/2026-10-02-v2s-terminal-activation-batch-3-amendment-proposal.md:33-36。Doris 为 DEV 必备遥测 store，writer 故障按业务约束隔离，但不能把没有写入的空结果冒充配置与服务正确。
- 原实现证据：scripts/dev/r5-dev-runner.mjs:1839-1845 会在本地 credential 文件缺键时生成并保存新密码；scripts/dev/r5-doris-resident.mjs:189-193 原先只运行 CREATE USER IF NOT EXISTS、GRANT、SHOW GRANTS，不会修改已有账号密码；ensure 后可在 :203 报 PASS。持久 Doris 容器可跨 DEV stop/start 存活，故仅确认容器、健康和 grant 不足以证明 TDS 注入的密码可登录。
- 反例与影响：持久容器保存旧 writer 密码时，本地 credential 文件被重建生成新密码，原实现仍会通过；TDS readiness 刻意不等待 Doris，因而每条连接历史都可能写失败而 DEV start 仍 PASS。
- 同根范围：本地受管 Doris credential 生成/持久化、resident ensure 与复用、传给 TDS 的环境变量及真实写入 readback。代理密码和终端激活凭证不在本 finding 范围。
- 最小修正：resident ensure 每次以当前受管 credential 中 writer 密码执行 ALTER USER ... IDENTIFIED BY ...，之后再做已有表级 grant readback；不新增密码 owner 或 credential 副本。官方 Apache Doris 4.1.3 源码 grammar DorisParser.g4 接受 ALTER USER 密码语法，AlterUserCommand.java/AlterUserInfo.java 将其映射为修改用户密码操作；详设已记录精确版本依据。
- 回归反例：scripts/dev/r5-doris-resident.test.mjs:196-219 预置 resident 已有 stale password；Docker mock 仅见 ALTER USER 才更新模拟密码，测试检查 SQL 中当前密码正确、adoption PASS 且密码未进入 stdout/stderr/命令日志。
- 实际证据：node --check 两个脚本通过；node --test scripts/dev/r5-doris-resident.test.mjs 为 5/5 PASS；node scripts/dev/r5-doris-resident-feasibility.mjs --self-test PASS。受管 DEV stop PASS；当前代码重新 start PASS，沿用同一 healthy Doris container/image/FE/BE volume identity；单场景 terminal.dev.lifecycle-and-compression BUSINESS=PASS、FIXTURE_CLEANUP=PASS、CLEANUP=PASS，Doris SQL readback 为 CONNECTED 2 行、HEARTBEAT_RTT 3 行、DISCONNECTED 2 行，证明当前注入密码可用于实际 TDS writer。
- 分类：CONFIRMED，已按最小方案修复；不需要 Dexter 裁决。

官方依据（Apache Doris 精确 4.1.3 标签）：

- https://github.com/apache/doris/blob/4.1.3/fe/fe-core/src/main/antlr4/org/apache/doris/nereids/DorisParser.g4
- https://github.com/apache/doris/blob/4.1.3/fe/fe-core/src/main/java/org/apache/doris/nereids/trees/plans/commands/AlterUserCommand.java
- https://github.com/apache/doris/blob/4.1.3/fe/fe-core/src/main/java/org/apache/doris/nereids/trees/plans/commands/info/AlterUserInfo.java
- https://doris.apache.org/docs/4.x/sql-manual/sql-statements/account-management/ALTER-USER/

### 执行中暴露的相邻根因 · Doris host preflight 使用了错误的现成资源 profile

- 分类：CONFIRMED；不是 Claude 原始 finding，不需要 Dexter 裁决。
- 首败：首次只读 node scripts/dev/r5-doris-resident-feasibility.mjs preflight 在远端调用前退出，工具输出为 R5_DORIS_HOST_PREFLIGHT_REFUSED=/.../scripts/env/check-runtime-resource-budget_FAILED；资源门先于 runId/manifest 创建，故该失败没有受管 run id 或 manifest。
- 根因证据：scripts/dev/r5-doris-resident-feasibility.mjs 的 mainPreflight 原调用 admin-validation-with-ter，该 profile 会计入当前受管 DEV 的本机 SSH tunnel 与两路 Vite PID；源代码已确认 resource gate 只有明确 TER 目录可排除。用于同类“DEV 已运行时预检”的现成 profile 是 ter-validation-with-dev，它只按精确 R5 manifest kind/path 排除该 DEV，其余进程仍参加预算。
- 修正与防回归：preflight 提取并使用 residentPreflightResourceArgs()，固定已有 ter-validation-with-dev profile；同文件 --self-test 加入 WRONG_PREFLIGHT_RESOURCE_PROFILE 红例。没有扩大排除路径或更改资源预算。
- focused 关闭证据：修复后 --self-test PASS；重新执行一次同一只读 preflight，run r5-doris-preflight-1790910965425-41042-2254380d-5630-455b-a427-ced568f113bd，status=PASS、cleanup=PASS_NO_REMOTE_MUTATION，核对 host boot id、PG 16.13、Doris image digest、持久容器/卷身份及 Testcontainers 零残留。

## 受影响范围与复核状态

- CP-01：资源/版本预检 renderer 与只读执行已变化，须 fresh reviewer 仅复查该 CP 受影响完整证据。
- CP-04：resident ensure、adoption fixture、DEV start 与 README/详设/计划已变化，须 fresh reviewer 复查 CP-04。
- 全批 6b 与 13c：仅重查 CP-01/CP-04、当前 DEV/Doris source-to-evidence 行，不重复无关 CP 的动态证明。
- 整批 REVIEW_TARGET=IMPLEMENTATION：原 fresh verdict NO-GO 已由 S-1 阻断。上述修复及差量复核完成后，必须由新的 fresh reviewer 重开最终需求、详设、真实生产源码、测试与当前行为证据；作者不得自判 GO。

业务与 cleanup 分开报告。旧全量 PASS、旧 resident feasibility、旧 seed/reset 结果只在各自字节和范围内有效；本 finding 的当前代码证明由文中列出的 focused、受管 DEV start 和 E1 run 提供。
