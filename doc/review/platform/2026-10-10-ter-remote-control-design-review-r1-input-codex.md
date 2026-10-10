# TER remote-control DESIGN Round 1 输入清单

REVIEW_CYCLE_ID=TER_REMOTE_CONTROL_DESIGN_2026-10-10
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT

## Dexter 原文与边界
“请根据需求文档，按照项目规范完成详设和实施计划的编写，需要细致到实施agent能够最小自由发挥的程度。写完后完成几轮对抗性review，直至go了之后，给我和另一个Claude做reivew。”
“内容仅供参考，只考虑90%的核心主流程，切勿过度设计。”
本次只写设计文档；源代码/依赖/生成/构建/测试/verify/DEV/设备/L2/reset/seed/部署未授权。IA看图UNSET，T前置技术proof OPEN；交付草案不是冻结实施输入，不要求本轮动态。

## 必须回读的最小输入
先尝试证伪对象，独立形成findings与verdict，才可阅读作者自审/intake；本轮不给作者intake。
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
- `doc/decisions/2026-10-10-ter-remote-control-ia-claude.md`：`357417a5f26a2eb340cdc05c94e578e36cbf2e279d54e7a8508004bb7b518c47`
- `doc/decisions/2026-10-10-ter-remote-control-journey-claude.md`：`a8968e9981a5584db018c012df3df6ccc5c1b44f4bd282cf50873215cd3cba8d`
- `doc/decisions/2026-10-10-ter-remote-control-ui-interaction-claude.md`：`48affebcf93c7cefd3bab49b82d4dbd54591744c48639dc8f2268fed99e78222`
- `doc/plans/platform/2026-10-10-ter-remote-control-implementation-design-claude.md`：`a328b187969473cdaf85007f02bcb204a9e0ca87c4b7ab9667f291fee4f6dd97`
- `doc/plans/platform/2026-10-10-ter-remote-control-implementation-plan-claude.md`：`a526e3a0f5f0cb684e8507e4af3d811b6fd8012074692f448fe44fa3facac420`
- `doc/plans/platform/2026-10-10-ter-remote-control-source-and-api-appendix-claude.md`：`3a7fff20d1159fa89eacf4e4e39ebefc3875e9fdfaf751206a1fdcc01f5c701e`

## 独立核验任务
真实用户能从现有项目终端Tab/Drawer协助看与正常输入吗？六HTTP/六Data消息、owner唯一性、与现有生成/认证/peer和Window能力是否对得上？T前置CP冻结及UI草案/授权标注是否诚实？独占/lease/late response和清理反例、seed角色、脚本/资源/L2分母、CP→6b→动态→13c有无循环？四模板槽位与互文是否完整一致？只报告实际成立缺口，不为罕见恶意输入/保密需求增加框架。

输出精确GO/NO-GO；仅静态合格且剩未验证UI/技术时GO_WITH_UNVERIFIED_UI。M/S/N、每finding相对路径精确行号/事实推论/影响/最小修正/Dexter裁决；方案合理性、模板覆盖、设计缺口、未验证层次，采用review-standard固定块。返回完整报告文字，禁止写文件；主agent保存其原文。
