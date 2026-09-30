# 终端激活与长连接 · 批次二详设/计划 Claude 评审交接

## 背景

批次二详设与实施计划已按 Dexter 授权编写。独立 DESIGN cycle `TERMINAL-ACTIVATION-BATCH-2-DESIGN-2026-09-30` Round 1 为 `NO-GO, M/S/N=1/0/0`；唯一 finding 是已接受 Journey 第 48、54 行对凭证持久化住址的冲突表述，以及初稿误将 Journey 纳入实施修改全集。作者已确认并从批次范围移除 Journey/decision 写入，保留来源漂移记录和 CP-01 写入前的 owner/Dexter 处理门。Round 2 独立 reviewer 给出 `GO, M/S/N=0/0/0, ROUND_FINAL_DECISION=SELF_DECIDED`。本次交接请求 Claude 再独立评审设计与计划，不代表实施授权。

## 评审目标

独立判断批次二技术方案是否简单、可维护且能按当前源码落地；核验需求到 owner、命令/selectors、state 保留、Node 注入式 HTTP/WebSocket 代理与 PMD、TDS readiness/node shutdown、受管 DEV topology、acceptance channel 和 Batch 2/3 边界是否一致。特别判断 Journey 凭证住址 source drift 的处理是否清楚且不会使实施者越权修改 accepted source。

## 需阅读文件

- `doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-design-codex.md`：批次二方案、模块/接口、验证证据和未决边界。
- `doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-plan-codex.md`：按 CP 分阶段的修改全集、focused proof、进入条件和收口。
- `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md`：需求正本与 D-37～D-51 裁决；按原阅读顺序。
- `doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md`：已接受用户/设备 Journey，尤其第 48、54 行凭证住址来源漂移。
- `doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md`：批次归属、D-16、服务边界与 R-12 同步范围。
- `contracts/protocol/terminal-connection-protocol.json`：设备与 TDS 共享协议。
- `doc/review/platform/2026-09-30-v2s-terminal-activation-batch-2-design-review-r1-codex.md`：Round 1 独立 finding 与作者处置。
- `doc/review/platform/2026-09-30-v2s-terminal-activation-batch-2-design-review-r2-codex.md`：Round 2 独立结论、DR1 关闭状态及其边界。
- `doc/review/platform/2026-09-30-v2s-terminal-activation-batch-2-design-review-r2-input-checklist-codex.md`：Round 2 reviewer 实际输入清单与留痕限制。
- `doc/platform/third-party-library-usage-standard.md`：第三方精确版本与官方依据核验规范。
- `doc/platform/terminal-coding-standard.md`：TER transport、state 与 device 端边界。
- `doc/platform/implementation-task-template.md`：未来 CP 与实施验收组织方式。

## 独立核验重点

- `server-config` 是否确为本期 Batch 2；`terminal-data-client/state` 是否是唯一终端凭证持久身份 owner，server-config 是否只保留环境/服务覆盖配置与受保护代理信息。
- 激活、取消激活是否经 `terminal-data-client` command→actor；激活态、连接态、连接延迟是否由专门 selectors 读取，并有实际使用路径与测试。
- state reset 是否只按 R-9.6 精确保留 server-config，不构成第二 credential store。
- Node 注入式 client 的 standalone Undici 与 Node bundled Undici 是否明确区分；实际版本/API、ProxyAgent dispatcher、PMD 协商与解压上界是否有精确版本的一手官方依据；是否确实由系统代理处理 TCP/TLS 而没有自写 CONNECT。
- TDS Actuator readiness、可配置 nodeId、先摘除再 drain 的时序，三实例/两 HAProxy 入口的受管拓扑与 manifest 证据是否匹配 V-S15/V-E6；不把 batch 3 的 Doris/跨节点 takeover/topic sync 放进来。
- `V-B15` 是否仍为 acceptance scenario key 而不是 HTTP operation identity；`V-S9/V-S15` 是否在对应执行面和通道可运行；验收场景的 `CONTRACT`、`BUSINESS`、`TOPOLOGY_PREFLIGHT` 是否彼此隔离。
- D-41 仓库内输入闭包与 root/symlink escape 红例是否进入生成/检查器门。
- 对 R1 finding `DR1` 的处理是否足以关闭越权修改：若 Journey 仍冲突，是否明确先由 Journey owner 修订或 Dexter 裁定，不由本批实施者自行改 accepted source，也不引入第二凭证库。

目前没有动态证据；本任务的 build、test、generation、scripts/verify、DEV、Testcontainers、reset、seed、L2、UAT 与部署均未获授权，也未执行。

## 期望结论

请明确给出 `GO` 或 `NO-GO` 与 `M/S/N`。每条 finding 写明仓库相对路径和准确行号、事实/推论/产品判断、影响、可验收的最小修正以及是否需要 Dexter 裁决。若某判据只是未来动态验证，应指出详设中的具体可执行证据，不要将计划描述写成已通过事实。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请独立评审《终端激活与长连接》批次二详设与实施计划。

背景：批次二详设与实施计划已按 Dexter 授权完成。独立 DESIGN cycle Round 1 为 NO-GO，M/S/N=1/0/0；唯一 finding 指出 Journey 第 48、54 行的凭证持久化住址冲突和初稿误将 accepted Journey 放入实施修改全集。作者已移除该写入承诺，保留来源漂移与 CP-01 前置处理门。fresh 独立 reviewer 的 Round 2 最终结论为 GO，M/S/N=0/0/0，ROUND_FINAL_DECISION=SELF_DECIDED。请你从原始需求和当前源码独立判断，不沿用上述结论。

目标：核验批次二架构、状态所有权、命令与 selectors、代理/压缩客户端、TDS readiness 与受管拓扑、场景证据和批次边界是否合理且可执行。

请从 catering-v2s 仓库根阅读：
- `doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-design-codex.md`：批次二详设全文；
- `doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-plan-codex.md`：批次二实施计划全文；
- `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md`：需求正本及裁决；
- `doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md` 与 `doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md`：已接受 Journey 与服务形态；
- `contracts/protocol/terminal-connection-protocol.json`：共享 TDS/TER 协议；
- `doc/platform/third-party-library-usage-standard.md`、`doc/platform/terminal-coding-standard.md`、`doc/platform/implementation-task-template.md`：第三方依据、TER 边界及实施阶段要求。

请重点独立核验：`server-config` 配置保留与 `terminal-data-client/state` 唯一凭证住址；激活/取消激活 command→actor 与状态 selectors；Undici exact-version WebSocket/ProxyAgent/PMD 行为及系统代理边界；TDS readiness/nodeId/先摘除再 drain；三 TDS/双 HAProxy 受管 DEV 拓扑；V-B15、V-S9、V-S15 的执行面和证据通道；D-41 仓内路径闭包；R1 DR1 来源漂移处置；批次三排除项。

烦请给出明确 `GO` 或 `NO-GO` 与 `M/S/N`。每条 finding 请写准确路径与行号、性质、证据、影响、最小可验收修正及是否需要 Dexter 裁决，并区分静态设计与未执行的动态验证。

授权边界：本次只请求批次二详设与实施计划的独立静态评审。GO/NO-GO 不授权源码实现、依赖/锁文件修改、构建、测试、生成、scripts/verify、DEV、Testcontainers、reset、seed、L2、UAT、部署或批次三。谢谢。
```
