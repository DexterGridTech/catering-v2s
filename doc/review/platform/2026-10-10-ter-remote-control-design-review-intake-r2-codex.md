# TER 应用内远程控制 DESIGN R2 作者处置与收口

REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=TER_REMOTE_CONTROL_DESIGN_2026-10-10
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
reviewerKind=AUTHOR_INTAKE
AUTHOR_CLOSEOUT=GO_WITH_UNVERIFIED_UI
CURRENT_BYTES_INDEPENDENT_VERDICT=NONE
IMPLEMENTATION_AUTHORITY=false
EVIDENCE_TIER=STATIC_DOCUMENT_SOURCE_READBACK

## 1. 原始结论与边界
独立R1为NO-GO 0M/2S/4N，独立R2为NO-GO 0M/2S/3N；原报告及SHA均保留。R2确认R1六项在设计声明层CLOSED。作者亲自重开当前source/正本，下面五项成立并作最小文档修复；作者收口只表达已知静态缺口已补、草案可交外部复评，不是独立GO，不证明SDK桥/生成/实现/运行可行。
本cycle不再召集R3。此次新增全链日志+两轮测试前审查是Dexter新的永久执行要求，未来实施时落实；当前无测试链路实现，本次文档两轮不计作TEST_CHAIN_PREFLIGHT。

## 2. 逐项辩证处置
| 输入 | classification | 当前设计状态 | 修订精确位置 | 亲自核验、有限全集与同根扫描 | 更小替代/裁决 |
| --- | --- | --- | --- | --- | --- |
| R2-S01 | CONFIRMED | CLOSED | `doc/plans/platform/2026-10-10-ter-remote-control-source-and-api-appendix-claude.md:83`；`doc/plans/platform/2026-10-10-ter-remote-control-implementation-design-claude.md:96` | 重开catalog errorSets/augmentation及ContractProblemAdvice的credential403、unknown500、dependency503；逐六op基础/完整增补与优先级固定，不将认证mode当errorSet，不将会话reason当wire code。其余五op与原两GET已逐一核对。 | 只补既有catalog/factory内的计划值，不创建新错误框架；无需Dexter新裁决。 |
| R2-S02 | CONFIRMED | CLOSED | `doc/decisions/2026-10-10-ter-remote-control-ui-interaction-claude.md:61`；`doc/decisions/2026-10-10-ter-remote-control-journey-claude.md:45`；`doc/plans/platform/2026-10-10-ter-remote-control-implementation-plan-claude.md:62` | 重开原Drawer onClose和前端正本§3-K-2；拒绝留Drawer，start成功且意图仍有效后先调用旧详情cleanup，再开Modal；叠层1、同层互斥、Esc同一路径，焦点归列表终端/查询。其余关闭、结束、重发、离页、换项目五路径已核对。 | 不用保留Drawer例外、新dirty guard或overlay stack；无需Dexter新裁决，具体线框仍UNSET。 |
| R2-N01 | CONFIRMED | CLOSED | `doc/decisions/2026-10-10-ter-remote-control-ui-interaction-claude.md:44`；`doc/decisions/2026-10-10-ter-remote-control-ui-interaction-claude.md:152` | 重开reportColumns、useOrganizationCandidates及owner page/addNameFilter/addJsonFilter；五原条件的匹配、候选/依赖/cursor明确，新增connection不变筛选。三个surface及全部表列操作已核对。 | 仅补模板互文与逐操作表，不重做原搜索或新增候选API。 |
| R2-N02 | CONFIRMED | CLOSED | `doc/plans/platform/2026-10-10-ter-remote-control-implementation-design-claude.md:224`；`doc/plans/platform/2026-10-10-ter-remote-control-source-and-api-appendix-claude.md:52` | 重开TerminalControlPersistence:44/53/65/150；两精确表名均修为online_operation，通用自然语言remote operation与TDC remoteOperations map未改。其余成员已逐一检查。 | 名称修正，不新迁移、兼容表或别名。 |
| R2-N03 | CONFIRMED | CLOSED | `doc/decisions/2026-10-10-ter-remote-control-ui-interaction-claude.md:20`；`doc/decisions/2026-10-10-ter-remote-control-ui-interaction-claude.md:139` | 需求109指定“正在连接终端”；三处可见copy统一。NOT_READY为409暂不可领grant，STARTING为session状态，未合并枚举。其余R20中文已逐一核对。 | 沿正本修字，不改产品语义。 |

“CLOSED”仅对应设计内容，新增源码、generated contract、挂载、真实用户行为仍NOT_RUN。没有把reviewer建议当新权威；以上修法均已有source或模板判据，不新增产品流程。

## 3. Dexter 2026-10-10新增要求落点
用户原话：“进入到动态测试之前，必须把整条测试链路加好调试日志，再做两轮对抗性review，查缺补漏确保没有低级错误，切勿不经思考的不断来回往复重跑”。
- `doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md:28`。
- `project-memory/operations/execution-economics-and-failure-family-closure.md:72`。
- `doc/decisions/templates/implementation-design-template.md:322`。
- `doc/platform/implementation-task-template.md:168`。
- `doc/plans/platform/2026-10-10-ter-remote-control-implementation-design-claude.md:65`。
- `doc/plans/platform/2026-10-10-ter-remote-control-implementation-plan-claude.md:23`。

记忆沿既有条目补充正文，并同步required-inventory中同条目的design/task-start/architecture路由和正本出处；未新增assertion或生成导航。机器不可充分判断语义，绑定明确review checklist；不建新台账/runner/日志框架。日志后两轮先检查整条实际链路，再核修复与同根；已核未变部分复用，不用两份空报告当PASS，CP内有限动态proof也先准备但不提前伪造CP MATCHED。

纯文档核对：记忆查询首报sourceRefs drift，读回正文与inventory后确认登记顺序错误；同步为排序唯一源后查询通过，并明确断言本次design/platform/architecture/task-start命中该记忆。话术结构检查CLAUDE_REVIEW_HANDOFF=PASS。二者只证明登记/文档交接，不是测试、动态日志或业务PASS；未运行全仓verify。

## 4. 防再犯与最小复用
- 认证mode、canonical errorSet、wire Problem、会话reason/Data reason分层；逐op错误集用既有基础∪有限增补；实现focused需覆盖每分支，不复制HTTP框架。
- 每个新surface声明上限、互斥、进入/退出和焦点；旧close cleanup只抽一次复用，async结果经当前意图保护。
- 复用原列表不等于省略搜索/操作分母；只写现成真实source语义，不借展示列创造筛选。
- 精确表名和公开源码symbol重开验证；不为文档笔误造source别名。
- copy沿需求闭集；相似文案不混合不同状态。
- 日志覆盖实际边界，不给value object/每帧加噪声；首败先读日志定位假设，下一次focused验证改动，不不断全量重跑。
防线绑定本包逐op/overlay/search/source/protocol及日志review checklist，以及未来既有focused/self-test入口；本次未运行，不能填测试PASS。

## 5. 当前六工件 SHA-256
| 文件 | SHA-256 |
| --- | --- |
| `doc/decisions/2026-10-10-ter-remote-control-journey-claude.md` | `04b6be48290476bcb8897e15590ab7d3d3a28915ad380d2a465f1b2fad8ed2e1` |
| `doc/decisions/2026-10-10-ter-remote-control-ia-claude.md` | `ae87b592d3285ca1c5bc00f3053002359f40c21eeb59f113f659078f60c3ae61` |
| `doc/decisions/2026-10-10-ter-remote-control-ui-interaction-claude.md` | `7c16701878262dacaf97902f49a3271e4cce4fb07a389b3c0d480e138af2910b` |
| `doc/plans/platform/2026-10-10-ter-remote-control-implementation-design-claude.md` | `44882dca5696d92d5c6b6e047a92cc968ac84944bf95a12b006bc54ce91d25af` |
| `doc/plans/platform/2026-10-10-ter-remote-control-implementation-plan-claude.md` | `5f2a373569e36d1dbaa5a85ddab55dc23f1a6872e2550eab4e2ad6d6bf47ec6a` |
| `doc/plans/platform/2026-10-10-ter-remote-control-source-and-api-appendix-claude.md` | `0cb504f7ef509b27324b5d827e3b5a1d31ac1b9c8ac07a8693ba6912904e0d6d` |

## 6. 未验证与交接
Dexter具体线框UNSET；T01～04、LiveKit native frame导入公开桥/双Window/普通输入、精确SDK/native解析及部署配置均OPEN。阶段C最终源码出口须实施前重开。全部新增实现、安装、生成、编译、测试、verify、DEV/Web/Android/设备/L2/seed/cleanup均NOT_RUN；本轮没有读取.runtime、改source或动态操作。
剩余不是作者已经掌握的可直接修复文档finding，而是外部独立复评、用户看图和未来获授权技术proof。两个S及三个N的作者修订不继承R2独立结论；外部Claude须重新读取当前六工件并自行判GO/NO-GO M/S/N。资料交接见同日external-design-review-request-codex.md。
