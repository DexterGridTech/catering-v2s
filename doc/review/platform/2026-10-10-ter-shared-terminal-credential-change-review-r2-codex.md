# TER 主副机共享终端凭证需求变更稿：独立设计复核 R2

REVIEW_CYCLE_ID=TER_SHARED_TERMINAL_CREDENTIAL_CHANGE_2026-10-10  
REVIEW_TARGET=DESIGN  
REVIEW_ROUND=2  
REVIEW_ROUND_LIMIT=2  
reviewerKind=INDEPENDENT_SUBAGENT  
blindReviewDeclaration=先独立重开需求、详设、IA 与 owning source 形成判断，再读取 R1 report/intake 对照  
authorMaterialReadAfterIndependentVerdict=true  
ROUND_FINAL_DECISION=SELF_DECIDED  
VERDICT=GO  
M/S/N=0/0/0  
EVIDENCE_TIER=当前仓库字节静态核对  
IMPLEMENTATION=NOT_RUN  
RUNTIME/TEST/BUILD/VERIFY/DEV/L2/UAT/CLEANUP=NOT_RUN

## 输入与范围

复核对象：`doc/plans/platform/2026-10-10-ter-shared-terminal-credential-requirements-change-proposal-codex.md`。Reviewer 独立重开正式 TER 更新需求、阶段 C 详设/计划、Journey/IA、TDC credential/state-sync、CBS credential verification 与 Android persistence source，形成判断后才读取 R1 report/intake。未修改文件，未执行生成、编译、测试、verify 或动态环境。

本轮是 `TER_SHARED_TERMINAL_CREDENTIAL_CHANGE_2026-10-10` cycle 的第二轮，也是最后一轮。`ROUND_FINAL_DECISION=SELF_DECIDED`；不再召开第三轮内部 DESIGN review。此 verdict 仅针对需求变更稿，不是 Claude 修订后的阶段 C 详设/计划 verdict，不是正式需求接受，也不是实施或动态 PASS。

## 独立结论

`GO`，`M/S/N=0/0/0`。提案可交 Claude 作为阶段 C 详设和计划修订输入。

Reviewer 核实：

- 用户要求被准确表达为：MASTER 激活建立同一 terminal credential，通过配对同步明文 credential state；SLAVE 以该 credential 直接请求 CBS，不逐项依赖 MASTER grant。
- 投影范围只有 credential，不把 activation、TDS session、PING/PONG、topic pending、更新任务、actual version 或报告队列一起复制。
- 明文要求覆盖配对 payload 与 Android 本地 credential persistence；同时保留现有日志脱敏边界，不扩为加密 envelope 或访问控制框架。
- 区分 MASTER→SLAVE grant relay 与 CBS 对下载 API 签发的短期 download grant。
- CBS 操作全集与 generated catalog 一致：九个 `terminalRead*` 和 `issueTerminalUpdateArtifactDownloadGrant` 在提案中为两端直连；`activateTerminal` 为 MASTER bootstrap；`submitTerminalUpdateReport` 按 R-15 保持 MASTER-only；`cancelTerminalActivation` 被显式留待 Stage C 修订时对照撤销与双端同步闭包决定。
- 使用共享 credential 内的 MASTER binding `deviceId`，不替换为副机物理 deviceId、不新增第二 binding；保留副机不连接 TDS 的现行 Stage C 范围。
- R1 唯一 N finding（R-13/R-15 误引）已在提案第 52、89 行修正；九个 `terminalRead*` 列表无重复。

## 剩余 OPEN

- `cancelTerminalActivation` 是否允许 SLAVE 发起，应由 Claude 在修订 Stage C 文档时明确取消激活、撤销通知与配对 credential 清理的闭包；作者提案准确保留此项，不阻碍将提案交由 Claude修订。
- 物理 MASTER/SLAVE 来源区分和副机上报本机版本均未被本次输入要求；如后续提出，需分别处理设备来源需求和 R-15 的 MASTER-only 报告语义。

