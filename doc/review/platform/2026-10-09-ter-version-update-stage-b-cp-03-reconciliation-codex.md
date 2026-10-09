# TER 阶段 B CP-03 证据与对账

## 结论

- **CP-03 三维静态对账：MATCHED**。Fresh 只读 reviewer `/root/cp03_final_reconcile` 在详设 topic 名修正后复核了需求、详设/计划、适用规范和当前源码。
- **CP-03 运行退出条件：PASS**。此前 reviewer 未定位 `compileJava` 证据；主 agent 复核受管验收运行档案后确认同一 run 已完成 CBS `compileJava`、CBS acceptance 与 TDS topic CONTRACT。
- 本记录只关闭 CP-03；不替代全批 6b、整体验收或最终逐代码 13c。

## 本轮文档差量

详设 §8.3 原写 `PROJECT_TERMINAL_UPDATE_RULES`，与需求协议字面量、canonical protocol、TDS parser/repository、验收场景及真实 TDS CONTRACT 不一致。主 agent 将其改为 `TERMINAL_UPDATE_RULES`。全仓 CP-03 相关来源复查未发现该旧字面量的其他当前消费者。

## 三维对账依据

- 需求及协议：`contracts/protocol/terminal-connection-protocol.json:137-140` 将 `TERMINAL_UPDATE_RULES` 纳入 topic 闭集。
- 详设：`doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md:293` 已与需求一致。
- 生产链：`TerminalConnectionFrameCodec`、`TdsTerminalSessionActors` 与 `TdsTerminalTopicRepository` 接受并路由该 topic；owner function 使用 bound workspace/group/store/project 参数。
- 权限与部署：migration 中函数按最小权限定义；受管 DEV 与 acceptance principal 均配置 schema/function 权限，且直接权限测试拒绝无权表访问。
- 业务实现：规则 owner 在项目锁内处理创建/状态变更、审计、topic 时间更新与通知；快照分页、竞态、下载 grant 和绑定复核均有当前 acceptance 场景源码。
- 生成绑定：两个 operations-admin 规则命令有 canonical registry 与 M1 生成绑定。

## 当前运行证据

- 受管 run：`r5-tc-1791500347876-98627`，时间 `2026-10-08T22:59:07.876Z` 至 `2026-10-08T23:01:56.233Z`。
- 场景：`storeTerminalActivationBusinessPrecedence`，并运行 `terminal.connection.topic.terminal-update-rules`。
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1791500347876-98627/run-manifest.json` 记录 `business=PASS`、`tdsContract=PASS`、TDS contract 3/3、远端 TDS `REACTIVE`，Testcontainers、TDS process 与 runner cleanup 均 `PASS`。
- 同目录 `gradle.log` 第 151 行记录 `:apps:backend:catering-business-server:compileJava`，第 201 行为 acceptance test，第 211 行 `BUILD SUCCESSFUL`。因此无需重跑 CP-03 编译。
- `tds-contract-result.jsonl.gz` 记录 `terminal.connection.topic.terminal-update-rules` 通过，消息包含 `SESSION_READY` 与 `TOPIC_CHANGED`。
- 更早的失败 run `r5-tc-1791499071353-68299`、`r5-tc-1791499454753-75782` 暴露 codec whitelist 漏项；加入 topic key 与 focused codec test 后，上述受管验收首次复验通过。首败保留，不将其改写为 PASS。

## 证据边界

CP-03 acceptance 的所有具体业务分支并未在上述单场景运行中逐一执行；它们仍按计划的批次级整体验收关闭。此处的 PASS 只表示计划规定的 CP-03 focused proof 与静态阶段对账完成，不声称整个 CP 的所有场景已动态执行，也不声称全批完成。
