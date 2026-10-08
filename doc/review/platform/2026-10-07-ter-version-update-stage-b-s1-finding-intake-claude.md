# TER 阶段 B · 外部复评 S-1 专项 intake

```text
ACTION=AUTHOR_FINDING_INTAKE_AND_DOCUMENT_REPAIR
INPUT_REVIEW=doc/review/platform/2026-10-07-ter-version-update-stage-b-design-recheck-claude.md
INPUT_VERDICT=NO-GO
INPUT_M/S/N=0/1/6
AUTHORIZED_SCOPE=S-1_ONLY
CLASSIFICATION=CONFIRMED
CLOSURE=CLOSED_DOC
CURRENT_INDEPENDENT_VERDICT=NOT_ISSUED
IMPLEMENTATION_AUTHORITY=false
CYCLE_STATE=CLOSED_NOT_REOPENED
EVIDENCE_TIER=STATIC_DOCUMENT_AND_SOURCE_READBACK
ALL_IMPLEMENTATION_AND_DYNAMIC=NOT_RUN
```

## 1 · 原话与处置结论

Dexter：“只看S的问题，如果是真问题就修改”。本轮主agent亲自核验S-1，未委派finding处置，未处理六项N。外部review只作入口，旧NO-GO对应其冻结字节，不改写为GO。文档问题关闭不是独立复评结论；若只剩适用UI未验证，仍须由独立reviewer按规范给GO_WITH_UNVERIFIED_UI，作者不能代判。

S-1成立：原D§8.5把非成功一律保留重送，再按最小sequence选唯一请求；409报告冲突或422校验失败会持续占队首。以为有心跳/单飞就可靠的前提不成立，后续合法报告无法发送。暂停类终端停用409更不能与报告冲突409按HTTP数字合并。

## 2 · 事实到来源与反例

| 所需事实 | 当前仓内来源/设计判据 | 核验与适用边界 |
| --- | --- | --- |
| 最小序号与无限保留能形成阻塞 | 输入review§5 S-1；修改前D§8.5、P CP-04、I§4.1 | 设计推论：拒绝项内容不变则409/422不变，心跳再次选同项；不用动态失败才承认设计缺口 |
| 终端停用与无效凭证是权威拒绝 | apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/terminal/TerminalDataReadProblem.java:43–53；modules/terminal-binding/src/main/java/com/catering/v2s/terminalbinding/api/TerminalCredentialVerificationApi.java:13–19 | STORE_TERMINAL_DISABLED/409，TERMINAL_BINDING_CREDENTIAL_INVALID/403；不由update包删除TDC凭证 |
| terminal读取错误闭集 | doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json:440–448；contracts/openapi/paths/terminal/data-read.paths.json:20–27 | 现有七码；新report拟复用，加RESULT_UNKNOWN与报告identity冲突，不凭review中的简写发明另一拼法 |
| RESULT_UNKNOWN实际状态 | apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/problem/ContractProblemAdvice.java:808–815 | 既有owner receipt-corrupt映射PLATFORM_COMMON_RESULT_UNKNOWN/500，本次表按500；服务不可用503另列。没有运行或部署证明 |

同根范围是report选择、HTTP结果映射、receipt消费、IA拒绝说明、CP-04测试及附件恢复场景。snapshot有限重读、grant/content的A有限重取、heartbeat广播拒绝日志仅作边界核对；未因S-1改它们或处理N项。

## 3 · 最小修正与防再犯

通用失败模式：排序重试队列把确定性拒绝当通信暂败，队首长期占位。根因层为业务owner对typed结果的消费。有限适用范围为本批报告提交及未来明确接入该标准的业务actor；不据此造中央队列/调度器。

最小解保持原pending map，只补同slice的sendPaused与一份latestDeliveryFailure摘要：
- ACCEPTED/SUPERSEDED须匹配binding/task/report/sequence，清原项并flush；旧结果不得删新项。
- 网络/timeout/结果未知/503及无typed problem的5xx保留原identity等有效PONG。
- 报告冲突409、校验422等该项终态拒绝移出发送集合；存一份有限原因摘要并公开selector/脱敏日志可读，下一PONG可发后项。
- 当前凭证/授权拒绝暂停全部report发送；同配置重连或重启不恢复，绑定/配置改变按原规则清旧pending/pause，不改签旧任务、不清他人凭证。
- 非法回执/未知协议拒绝不冒充commit成功，旧上下文回包忽略。
- 删除与摘要/pause落盘失败可见，不承诺存储不可写时跨重启仍保证排除；当前Runtime不得再选已拒绝项。不加失败正文第二队列、后台新UI或人工重试。

比较更小方案：只删除被拒项会丢可见原因；只留日志不能在hydration后保持发送暂停；增加每报告失败历史/新调度中心则过度。两项同slice附属事实足以满足当前闭包，失败摘要不覆盖A执行状态，不进入CBS canonical报告正文。

防再犯落点是D唯一结果表和既有report.recovery/CP-04 focused计划：409不阻塞后一任务、422不阻塞observation、停用/凭证拒绝经多PONG与重启/重连不重发；两种receipt、迟到/新同task隔离、flush失败及配置/绑定清理反例。只增加未来测试义务，未写或执行测试。

| 文件 | S-1修订位置 |
| --- | --- |
| doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md | §8.5 L295提交结果表、L307摘要/selector、L309持久失败边界、§11a report.recovery L383 |
| doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-plan-claude.md | CP-04第2项 L84：分类/两个附属字段/三条反例 |
| doc/plans/platform/2026-10-07-ter-version-update-stage-b-source-and-api-appendix-claude.md | §11.2 submit行 L254、report.recovery L490、§19.1 L534：错误闭集/receipt分类引用 |
| doc/decisions/2026-10-07-ter-update-supply-and-version-report-ia-claude.md | §4.1 L154–155：凭证暂停与报告identity冲突退出发送集合 |

## 4 · 未处理与授权边界

N-1～N-6未作处置或修改，不宣称整包无矛盾。Journey、UI、需求正本SHA未变化；旧评审/旧intake与review request均保留历史字节声明，当前新摘要以下表为准。

只写上述四份设计文档及本intake。未改标准/记忆/源码/测试/依赖/阶段A，未联系在途Codex，未读取.runtime，未运行生成、编译、测试、verify、DEV、HTTP、Web、设备、reset/seed、L2/UAT或部署。纯读取与文档结构读回不是动态证据。不重开独立cycle，不新增独立GO。

## 5 · 当前完整包摘要

| 文件 | SHA-256 | 本次 |
| --- | --- | --- |
| `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md` | `114e2f42251afd431e665544d2a54fc71238861e85f1616a257404c4eb3cb002` | S-1文档修订 |
| `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-plan-claude.md` | `ff0843ee1649c2df59566cef0a7613d1e143248b522c29f831c7c848d9142c09` | S-1文档修订 |
| `doc/plans/platform/2026-10-07-ter-version-update-stage-b-source-and-api-appendix-claude.md` | `ba62514a629e1e9a14ce31093ccbc1f0a3ab62ee0615ef682c7ebef23e54dcbd` | S-1文档修订 |
| `doc/decisions/2026-10-07-ter-update-supply-and-version-report-ia-claude.md` | `9558c37955b311327354fa4584c99523b86a4d15e956e235c66aa42db5817dd6` | S-1文档修订 |
| `doc/decisions/2026-10-07-ter-update-supply-and-version-report-journey-claude.md` | `89803db2849b18c48f515640c53088f90ca05f645beec8732b6f62cb92676d09` | 未修改 |
| `doc/decisions/2026-10-07-ter-update-supply-and-version-report-ui-interaction-claude.md` | `2528d5845609ce307669f452c68a297fb37fbe381c43c6629e2cda98e9677cdf` | 未修改 |
| `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md` | `f4ae511b8691710f772f191f073bba6c3939f1afc533933b583eee0495983c22` | 未修改 |
