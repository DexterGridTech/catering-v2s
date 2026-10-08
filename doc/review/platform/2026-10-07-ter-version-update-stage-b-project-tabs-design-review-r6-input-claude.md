# 阶段 B 追加第 6 轮 fresh DESIGN 输入

REVIEW_CYCLE_ID=ter-version-update-stage-b-project-tabs-20261007
REVIEW_TARGET=DESIGN
REVIEW_ROUND=6
REVIEW_ROUND_LIMIT=6
DEFAULT_REVIEW_ROUND_LIMIT=2
ADDITIONAL_REVIEW_INDEX=2
EXTENSION_NUMBER=2
ROUND_EXTENSION_AUTHORITY=DEXTER_EXPLICIT_SESSION
ROUND_EXTENSION_QUOTE=如果第四轮还是NO GO，并且也是你确认的真问题，可以再增加两轮
reviewerKind=INDEPENDENT_SUBAGENT

追加两轮是直接授权的轮次例外；保留同一cycle及R1/R2历史，不虚构范围改变。本轮 reviewer 为 fresh、fork none、只读，先完整原需求/规范/当前源码，再六设计工件，独立证伪并给原始 verdict 后才可看作者 intake。主agent唯一写入。不读取 .runtime，不运行生成、编译、测试、verify、环境或数据操作。

## 最小输入（全部原文，不能只读作者摘录）

1. AGENTS.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md、scripts/README.md、CLAUDE.md。
2. project-memory/index.md 全部kernel、deterministic-context-only及六维design/platform/backend/frontend-platform/architecture/task-start命中原文；评审按对应有效路由补充当前消费面。
3. 本仓 cs-spec-to-plan/cs-review skill、review-standard、implementation-task-template、backend/frontend/terminal coding standards、third-party标准、四design templates、独立review治理。
4. 正式需求 `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md` 与 `2026-10-04-ter-version-and-js-apk-update-requirements-discussion-claude.md`。
5. A当前详设/计划/附件、canonical `contracts/terminal/terminal-update-artifact.schema.json`、builder、UpdatePort types、update owner/actor/selector/provider/native实际版本/prepare源码。当前未验收，不请求运行evidence。
6. B同日期三decision：`doc/decisions/2026-10-07-ter-update-supply-and-version-report-{journey,ia,ui-interaction}-claude.md`。
7. B同日期三plan：`doc/plans/platform/2026-10-07-ter-version-update-stage-b-{implementation-design,implementation-plan,source-and-api-appendix}-claude.md`。
8. asset当前stage/storage/publiccontroller、operations读写授权与scope/cap、TDS topic/session/principal/HTTP、TDC HTTP/ready/消息、store-basic loaded与topic范式、当前automation/adminL2入口/foundation真实消费者。

先需求/规范/当前source形成自己的合理性判断，再读B作者方案。先证伪产生findings/verdict，最后才可读历史/作者intake。追加审查仍先形成独立判断，最后才可读旧报告/intake；A旧review不作结论。

## 审查问题

- B是否忠于供给与观察，未偷做C自动/主副、未影响Codex A实施？A依赖是否条件化且不靠mock解除？
- 用户任务/两后台scope/读写权限/两个内容页内全部交互及每操作、UI/testID/分页/候选来源是否真实、简单且可达？大致IA已由Dexter确认；不等于真实UI动态验证。
- FULL/HOT实际解析/同版本冲突/私有asset、有限资源/工具依赖/官方版本与静态OPEN是否可信？
- 集合与snapshot锁/首次空/同time/分页乱序/当前周期gate，是否符合TDP原始time而非发明逻辑版本？
- download transientgrant及sourceprovider授权/撤权/固定task是否最小且不泄露凭证？
- report当前session/sequence/ACK/DB失败/unknown/旧binding/离线laststate是否闭合，未新增流水？
- CP/focused/全批6b/动态准入/整体验收/13c是否循环？UI先于L2scripts；TER唯一agent/先Web后Android；admin唯一L2；seed真实source/role/授权是否明确？
- V全部本阶段子断言是否点名scenario/执行面，计划不是PASS；查更小替代与同根矛盾。

## 输出

只读，不写任何文件、不运行生成/测试/构建/verify或动态；必要rg/sed/nl/哈希读取与memory query允许。仅报告文本由主agent逐字归档。
明确GO/NO-GO（允许已知UI未运行GO_WITH_UNVERIFIED_UI）、M/S/N；每finding精确path/line、事实或推论、影响、最小可验收修正、Dexter裁决否；缺设计判据单列DESIGN_GAPS。列输入实际读取、静态事实、OPEN/NOT_RUN与合理性，不能为缺动态evidence单列设计缺陷。


## 本轮明确产品裁定

- platform-admin只管理更新包/版本；operations-admin一个项目内容页，左更新规则Tab，右本项目所有门店终端状态Tab（含NO_REPORT），无运维报告页。
- 两个新内容页；九个IA ID是页内Tab/Drawer/Modal交互，不是九路由。大致IA已确认。
- 使用当前标准查询、列表、分页、详情/编辑Drawer等现成容器；不新造。
- 详设必须包括真实测试脚本与seed输入，并对照项目详设模板检查完整性。
- B供给与观察；C自动执行不进入B。A仍在Codex验收，允许起草B，不授权B实施或打扰Codex。

## 追加核验重点（不预设任何finding）

16项HTTP逐op输入/错误/调用者、当前app/application编排与module owner依赖、完整数据库计数（含连接事务）设计依据；全部输入/隐形事实来源、seed和真实runner argv；私有ZIP/签名和生成分界；scope锁、snapshot分页/current-boot gate、grant撤权和固定任务、report session/ACK；CP/6b/动态准入顺序。主动找反例及更小方案。NOT_RUN本身不是finding。


## 第二次直接授权与独立顺序

R4 fresh独立NO-GO 0/1/0，主agent亲验verification-governance§8及旧P§10/D§15.2，确认数据/验收顺序矛盾。Dexter条件授权已满足，保留同cycle续R5/R6，limit6、default2。R5第一轮完整盲审；R6第二轮定向核验并停止。不会追改旧verdict/旧limit，不授权实现或运行。

先完整原需求/规范/owning source及六工件形成独立原始finding/verdict，再且仅再读旧输入：
- doc/review/platform/2026-10-07-ter-version-update-stage-b-project-tabs-design-review-r5-codex.md
- doc/review/platform/2026-10-07-ter-version-update-stage-b-design-review-intake-claude.md
这些用于对照，不继承closure。主动检查完整方案、四模板、输入/错误/事务/并发/快照/报告/测试seed/实际runner/授权及更小替代。同根反例只报可支持问题，不把NOT_RUN本身列finding。

## 最后一轮收口

R6是第二次直接授权的第二轮，保留round6/limit6/default2，结束后硬停止交外部Claude，不再自行追加。请完整独立判断，不仅修复点；独立verdict形成后才读R5/intake，核对source与反例，不预设关闭。原始verdict只能由您出具；若已知阻断关闭而实际UI未验证，GO_WITH_UNVERIFIED_UI；最终元数据包括ROUND_FINAL_DECISION=SELF_DECIDED，但不把主agentintake当独立GO。全部动态/cleanup仍NOT_RUN。

## 当前冻结SHA-256

- `doc/decisions/2026-10-07-ter-update-supply-and-version-report-journey-claude.md`：`4832f2fab31f6688ab6594a714f504a068202afa43b8816e767b8fffe4b64f34`
- `doc/decisions/2026-10-07-ter-update-supply-and-version-report-ia-claude.md`：`846297d93393fc8213dff4b31ee6b433cfa805feab5120678a70438aa43a446f`
- `doc/decisions/2026-10-07-ter-update-supply-and-version-report-ui-interaction-claude.md`：`a7d603e506404b317acb911c09a75de47df66968ab401ccea4f150ee4cddc4bd`
- `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md`：`e076785342290eb78959d0501300aab01a0f322b7c13133fc0677afffc408220`
- `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-plan-claude.md`：`11949c7f2f847d7ed4c8f249dcc732ba7259707e1da4dc3d17883f96cbb84bb4`
- `doc/plans/platform/2026-10-07-ter-version-update-stage-b-source-and-api-appendix-claude.md`：`8bd1071b4439d9d92dbbae92a319c6fb75111ee146a5e402e3ca0bc35d0eaee2`
