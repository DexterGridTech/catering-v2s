# TER remote-control DESIGN Round 2 输入清单

REVIEW_CYCLE_ID=TER_REMOTE_CONTROL_DESIGN_2026-10-10
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT

## Dexter 原文与边界
“请根据需求文档，按照项目规范完成详设和实施计划的编写，需要细致到实施agent能够最小自由发挥的程度。写完后完成几轮对抗性review，直至go了之后，给我和另一个Claude做reivew。”
“内容仅供参考，只考虑90%的核心主流程，切勿过度设计。”
本次只写设计文档；源代码/依赖/生成/构建/测试/verify/DEV/设备/L2/reset/seed/部署未授权。IA看图UNSET，T前置技术proof OPEN；交付草案不是冻结实施输入，不要求本轮动态。

## 必须回读的最小输入
先尝试证伪对象，独立形成findings与verdict，才可阅读作者自审/intake；先不读R1 report或作者intake，独立审完当前六文件形成候选verdict后，再阅读R1 report/intake核对六项关闭，不把作者分类作结论。
| 输入 | 路径/动作 | reviewer实际结果（回报中填写） |
| --- | --- | --- |
| 入口 | AGENTS.md、CLAUDE.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md、scripts/README.md | 待读 |
| 全kernel/确定性 | project-memory/index.md的全部kernel；project-memory/decisions/deterministic-context-only.md | 待读 |
| 六维路由 | scripts/memory/query --task-kind design --domain platform --consumer-face operations-admin --owner platform --impact architecture --trigger task-start；全部命中原文与适用source refs | 待读 |
| Corpus | confirmed-business-language-corpus检索运营/项目/门店/终端/主副，记录命中与禁推 | 待读 |
| 需求全文 | doc/plans/platform/2026-10-10-ter-remote-control-formal-requirements-claude.md及discussion原话/最新调整 | 待读 |
| 模板/规范 | 四份doc/decisions/templates；implementation-task-template、review-standard、frontend/backend/terminal/third-party/foundation规范、verification-governance、independent review治理 | 待读 |
| decisions导航 | 查看doc/decisions标题与全部本任务适用decision原文 | 待读 |
| 真实source | 下列六工件引用的scope/auth/current query/TDC/peer/ports/Window/automation/foundation，按问题重开 | 待读 |
| 逐点实施留痕 | N/A本轮没有实现及focused运行，不能找本轮不存在的implementation日志 | 不适用 |

## 被审对象全文及SHA-256
- `doc/decisions/2026-10-10-ter-remote-control-ia-claude.md`：`45629570d53cf1d3a243db993f64ff731d388c3c4f4633f105bfe8483eb8a923`
- `doc/decisions/2026-10-10-ter-remote-control-journey-claude.md`：`87fdf43bf7e8ec6833e9938bdf022808f23345ae8942e128b5236fc7b357115c`
- `doc/decisions/2026-10-10-ter-remote-control-ui-interaction-claude.md`：`b1555e6fcfdc6c26fb5249861f3019d279f39ec0421efed8349e7bf9d5211ac8`
- `doc/plans/platform/2026-10-10-ter-remote-control-implementation-design-claude.md`：`2667675c89f8ef76afa46e6228a8df27ff767aaef7d002e5f71913a8d4006de4`
- `doc/plans/platform/2026-10-10-ter-remote-control-implementation-plan-claude.md`：`8cb4484c8f6747bcd1e92da317c07076302b90349020e32ace3ac0ddff2fd4fa`
- `doc/plans/platform/2026-10-10-ter-remote-control-source-and-api-appendix-claude.md`：`7a87e8db88993c289cdd92ac77094bf7a2708ea6b21b801ae9dc860b063111d9`

## 独立核验任务
真实用户能从现有项目终端Tab/Drawer协助看与正常输入吗？六HTTP/六Data消息、owner唯一性、与现有生成/认证/peer和Window能力是否对得上？T前置CP冻结及UI草案/授权标注是否诚实？独占/lease/late response和清理反例、seed角色、脚本/资源/L2分母、CP→6b→动态→13c有无循环？四模板槽位与互文是否完整一致？只报告实际成立缺口，不为罕见恶意输入/保密需求增加框架。

输出精确GO/NO-GO；仅静态合格且剩未验证UI/技术时GO_WITH_UNVERIFIED_UI。M/S/N、每finding相对路径精确行号/事实推论/影响/最小修正/Dexter裁决；方案合理性、模板覆盖、设计缺口、未验证层次，采用review-standard固定块。返回完整报告文字，禁止写文件；主agent保存其原文。

## 第二轮附加治理
本cycle第二轮、上限2；本轮结束必须记录ROUND_FINAL_DECISION=SELF_DECIDED，不召集第三轮。重点仍为完整设计合理性、四模板覆盖、真实scope/owner和可执行链；六旧finding是候选定位不预设closed。
在形成当前独立判断后可读：doc/review/platform/2026-10-10-ter-remote-control-design-review-r1-codex.md、doc/review/platform/2026-10-10-ter-remote-control-design-review-intake-codex.md。回报独立verdict和六项CLOSED/PARTIALLY/OPEN表。子agent只读，返回完整报告由主agent保存。
