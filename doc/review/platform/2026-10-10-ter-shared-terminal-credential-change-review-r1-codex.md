# TER 主副机共享终端凭证需求变更稿：独立设计复核 R1

REVIEW_CYCLE_ID=TER_SHARED_TERMINAL_CREDENTIAL_CHANGE_2026-10-10  
REVIEW_TARGET=DESIGN  
REVIEW_ROUND=1  
REVIEW_ROUND_LIMIT=2  
reviewerKind=INDEPENDENT_SUBAGENT  
VERDICT=GO  
M/S/N=0/0/1  
EVIDENCE_TIER=当前文档与源码静态核对

## 输入与盲审声明

本轮只读输入：

- `AGENTS.md`、`CLAUDE.md` 与独立审查治理规范；
- `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md`；
- 阶段 C 详设、计划、Journey、IA 与 UI 交互文档；
- TDC credential 类型、slice/actor、CBS 凭证核验及 Android persistence owning source；
- `doc/plans/platform/2026-10-10-ter-shared-terminal-credential-requirements-change-proposal-codex.md`。

Reviewer 先独立重开需求、治理边界和 owning source 形成判断，再阅读作者提案。Reviewer 未修改文件，未执行生成、编译、测试、verify、DEV 或设备验证。该轮评审对象是修正前提案字节；下述唯一 finding 已由主 agent 在 R2 前修复，R1 verdict 不冒充修订字节的 verdict。

## 总体判断

提案准确表达 Dexter 的新产品输入：MASTER 建立一份 terminal credential，配对后向同 App SLAVE 同步同一 credential state；SLAVE 以此身份直接调用 CBS；不为每次业务请求向 MASTER 获取中转 grant。提案没有把副机改成独立激活主体、第二 CBS binding 或 TDS 节点，也区分了 MASTER peer grant 中转与 CBS 签发的短期下载 grant。

“不得加密”按原话覆盖 TDC credential 的本地持久化和配对 state payload，不只覆盖新增传输信封；提案据此提出离开 Android `protected`/MMKV crypt-key store。提案同时保留凭证不写日志等既有诊断脱敏约束，未将其混为加密。

## Finding

### N-1：主机版本报告需求引用编号写错

- 分类：`CONFIRMED`，非阻断文档注记。
- 提案位置：第 52、89 行将 `submitTerminalUpdateReport` 的 MASTER-only 边界称为 R-13。
- 正本依据：正式需求 `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md` 第 224、236、321 行；主机实际版本、最近报告与授权范围属于 R-15。阶段 C 详设第 18 行也将该后续裁决归为 R-15。
- 最小修正：将两处 R-13 更正为 R-15；保留“副机是否报告”未在本提案中扩大，若产品要求改变再由 Dexter 裁定。
- 影响：引用精度，不改变建议的行为边界。

## 残余设计边界

- `cancelTerminalActivation` 是否可由 SLAVE 发起，需 Claude 在修订阶段 C 设计时对照取消激活与撤销通知闭包给出明确结论；作者已将其标为待明确项，不能用删除 `isHostRuntime` 检查代替核验。
- 本轮提案保留 R-15 的 MASTER-only 报告约束。副机本机版本与“最后主机版本”的关系若要改变，属于产品语义变更，不由实现推断。
- 本轮不证明 credential state-sync 或明文持久化已实现；全部实现和运行均 `NOT_RUN`。

