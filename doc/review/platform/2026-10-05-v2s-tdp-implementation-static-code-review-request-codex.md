## 背景

《TDP 数据变化通知与远程运维》批次实施已进入代码 review。主 agent 已按转交 finding 完成当前获准范围内的最小代码修正，并补充本地 Java compile 与相关终端包级 typecheck/test。随后一次针对 Runtime/Topology 的只读独立复核指出 peer late error actor results 未交给 late observer、Topology 错误投影把 message 写成 code；主 agent 已核实并修复，增加对应测试。当前交审请基于最新代码重新独立判断，不继承历史 GO/MATCHED 或作者 disposition。Dexter 最新要求仍是只做静态代码 review，不要求补充运行证据。

本轮代码变化重点包括：终端集合/精确详情走 owner task read；TDS 集合缺行与时间倒退规则；terminal-control 当前 binding 与跨 session 报告校验；Runtime peer 实际结果透传及 TTL 消费期限；Topology request 内多 actor 聚合和连接身份保护；TDC 清理后的迟到结果拒写与聚合；typed REGION/PROJECT 创建通知。详见主 agent 的 finding intake：`doc/review/platform/2026-10-05-v2s-tdp-code-review-finding-intake-codex.md`。该记录只说明作者处置和局部编译/测试，不替代本轮独立 review。

## 评审目标

只审查当前字节中的生产代码和直接相关测试/生成脚本源码，判断其相对正式需求和已批准详设是否正确、边界清楚、实现简单、高效、健壮。需求与详设仅作为理解代码行为的判据；本轮不评审文档写法或设计文档一致性。

**禁止要求或核对任何 evidence**：不运行命令，不查看或索取 run ID、日志、manifest、报告、截图、DEV 状态、远端状态、数据库读回或历史验收材料；不因缺少这些材料提出 finding 或阻断代码 review。编译和包级测试的说明只用于界定已知修改范围，不是 review 的输入门槛。

## 需阅读文件

- `doc/plans/platform/2026-10-03-v2s-tdp-data-change-and-remote-operations-formal-requirements-claude.md`：只用作代码行为的正式需求依据。
- `doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-design-codex.md`：只用作代码落点与预期边界依据。
- `apps/backend/catering-business-server/modules/organization/src/main/`：组织、门店、区域及其 terminal topic 时间/cache owner 实现。
- `apps/backend/catering-business-server/modules/store-contract/src/main/`：合同 owner 时间/cache 与精确 topic 查询实现。
- `apps/backend/catering-business-server/modules/terminal-control/src/main/`：远程操作意图、认领、结果写入及主动查询 owner 实现。
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/terminal/`：终端激活和 terminal data read 的 edge/controller 映射。
- `apps/backend/catering-business-server/src/main/resources/db/migration/`：本批新增的 owner 时间/cache、terminal-control 与授权 SQL migration。
- `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/`：TDS 协议、认证/会话、topic 读取、PostgreSQL 唤醒/claim/report、写入与 WebSocket 生命周期。
- `apps/terminal/kernel/base/terminal-data-client/src/`：TDC 激活、HTTP read、TDS 协议、订阅/接受通知、remote operation 持久记录与 Runtime 接线。
- `apps/terminal/kernel/base/runtime/src/`、`apps/terminal/kernel/base/topology/src/`：本地/peer command result 透传与 request-scoped late result handoff。
- `apps/terminal/kernel/feature/store-basic/src/`：单一 store-basic feature 的 domain state、命令、actor、selector、读取和集合差量订阅。
- `scripts/generate/terminal-connection-protocol.mjs`、`contracts/protocol/terminal-connection-protocol.json`：协议生成器及其唯一声明输入；只用于静态检查生成/消费边界。
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/`、`apps/backend/terminal-data-server/src/test/`、`apps/terminal/kernel/base/{terminal-data-client,runtime,topology}/test/`、`apps/terminal/kernel/feature/store-basic/test/`：对应生产路径的测试源码，只检查断言与调用链，不运行测试或检查运行产物。
- `scripts/test/ter-admin-display-web.mjs`、`scripts/test/ter-admin-display-web-contract.mjs` 及其测试：只检查验收代码是否实际驱动、观测预期请求与业务状态，不运行脚本或读取其运行 evidence。

## 独立核验重点

- CBS 是业务事实与时间/cache 的唯一 owner；TDS 只使用获准的 owner SQL 读取/command，不直接读写 terminal-control owner 表；CBS 与 TDS 仅通过 PostgreSQL 投递，CBS 主动查询结果。
- 三种集合 topic 和八种精确 topic 的读取来源、binding scope、事务顺序及失败映射是否和需求一致。
- TDS 收到唤醒后按 identity 原子 claim；重复通知/认领不重复执行；实际结果 commit 后才 ACK TDC。
- TDC 的 remoteOperations map、阶段更新、ACK 后删除、清理后的迟到结果拒写与普通断线重连保留边界是否实现正确；没有多余字节预算、第二缓存或恢复框架。
- Runtime 本地/peer 实际结果是否沿现有 command-result 路径传递到精确 request handoff；迟到结果不伪造、不重派、不复活已删除项。
- store-basic 是否只维护自己的真实 owner 数据；完整集合、详情差量订阅、迟到投影和持久化边界是否可靠。
- generated contract / protocol 生产者与消费者是否匹配；测试与脚本源码是否对实际参数、字段、时序作出足够且不虚假的静态断言。
- 日志与错误映射是否泄露秘密、吞掉失败或模糊业务结果；资源/并发处理是否有不必要复杂度。

## 期望结论

请给出明确 `GO` 或 `NO-GO` 与 `M/S/N`。每条 finding 限于代码静态结论，给出生产/测试源码精确路径与行号、代码事实、业务影响、最小修正及是否需要 Dexter 裁决。不要提出证据补交、动态复跑或环境核验要求。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对《TDP 数据变化通知与远程运维》批次实施做一轮仅源码静态 review。

背景：Dexter 已要求停止本轮动态验证，并将实施代码交你审查。本轮不继承先前 GO/MATCHED；review 范围仅限当前代码。
目标：仅依据当前生产代码及直接相关测试/生成脚本源码，判断其是否符合正式需求与已批准详设，是否简单、高效、健壮。需求与详设仅作为代码行为判据，不评审文档一致性。

请从 catering-v2s 仓根阅读：
- `doc/plans/platform/2026-10-03-v2s-tdp-data-change-and-remote-operations-formal-requirements-claude.md`：代码行为的正式需求依据；
- `doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-design-codex.md`：代码预期边界；
- `apps/backend/catering-business-server/modules/organization/src/main/`、`modules/store-contract/src/main/`、`modules/terminal-control/src/main/`：CBS owner、topic 时间/cache 与远程操作；
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/terminal/` 与 `src/main/resources/db/migration/`：edge 映射和本批 SQL；
- `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/`：TDS 协议、session、topic、数据库唤醒/claim/report 与 WebSocket；
- `apps/terminal/kernel/base/terminal-data-client/src/`、`runtime/src/`、`topology/src/`：TDC、运行时结果 handoff 与 peer 透传；
- `apps/terminal/kernel/feature/store-basic/src/`：store-basic feature；
- `scripts/generate/terminal-connection-protocol.mjs`、`contracts/protocol/terminal-connection-protocol.json`：协议生成与消费边界；
- 上述 CBS/TDS/TDC/runtime/topology/store-basic 对应的 `src/test` 或 `test` 源码，以及 `scripts/test/ter-admin-display-web*.mjs` 及其测试源码：只静态检查测试代码的调用和断言。

请重点检查：owner 与包边界、CBS→PostgreSQL→TDS 的投递/claim/report、三种集合及八种精确 topic 的读取和scope、TDC remoteOperations map与ACK/清理/迟到结果、Runtime 本地/peer result handoff、store-basic 的集合/详情差量、生成物与消费者匹配，以及代码是否简单可靠、错误/日志是否正确脱敏。

本轮严格只做源码静态 review：不得运行测试、生成、构建、verify、DEV 或其他命令；不得索取或核对 run ID、日志、manifest、报告、截图、数据库读回、远端/DEV状态或任何运行 evidence。不得以缺少 evidence 作为 finding 或 review 阻断。测试源码可以阅读，但不要求实际执行。

请给出明确 `GO` 或 `NO-GO` 与 `M/S/N`。每条 finding 写明代码文件与行号、事实、影响、最小修正及是否需 Dexter 裁决；仅报告经源码支持的问题，不扩大需求或引入恢复框架。

作者处置记录新增两项已修代码问题：本地超时后 peer `error` 结果携带 actor results 时仍需交付给 late observer；Topology 错误投影应保留 typed error 的 `message`。请从当前源码自行重判；Runtime 有对应 late-error focused test，Topology 有 message wire assertion。内部窄复核另留一条非阻断覆盖注记，是否需要 wire late-error 集成场景请按代码与现有边界独立判断，不要求任何运行 evidence。

授权边界：本请求只授权你做当前代码的静态 review；不授权修改文件、运行任何命令或要求补交/复核 evidence。谢谢。
```
