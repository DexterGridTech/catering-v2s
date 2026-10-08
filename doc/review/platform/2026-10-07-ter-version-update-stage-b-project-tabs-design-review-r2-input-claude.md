# 阶段 B 独立 DESIGN 输入清单

REVIEW_CYCLE_ID=ter-version-update-stage-b-project-tabs-20261007
REVIEW_TARGET=DESIGN
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT

授权：Dexter允许A尚未完全验收时起草B；后续补充要求“用户交互IA需要给我确认”。本cycle只静态审查候审设计，禁止将草案、A当前源码或历史GO当实施/运行准入。外部Claude另由Dexter转交；内部最多两轮，不以修订重置。

## 最小输入（全部原文，不能只读作者摘录）

1. AGENTS.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md、scripts/README.md、CLAUDE.md。
2. project-memory/index.md 全部kernel、deterministic-context-only及六维design/platform/backend/frontend-platform/architecture/task-start命中原文；评审按对应有效路由补充当前消费面。
3. 本仓 cs-spec-to-plan/cs-review skill、review-standard、implementation-task-template、backend/frontend/terminal coding standards、third-party标准、四design templates、独立review治理。
4. 正式需求 `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md` 与 `2026-10-04-ter-version-and-js-apk-update-requirements-discussion-claude.md`。
5. A当前详设/计划/附件、canonical `contracts/terminal/terminal-update-artifact.schema.json`、builder、UpdatePort types、update owner/actor/selector/provider/native实际版本/prepare源码。当前未验收，不请求运行evidence。
6. B同日期三decision：`doc/decisions/2026-10-07-ter-update-supply-and-version-report-{journey,ia,ui-interaction}-claude.md`。
7. B同日期三plan：`doc/plans/platform/2026-10-07-ter-version-update-stage-b-{implementation-design,implementation-plan,source-and-api-appendix}-claude.md`。
8. asset当前stage/storage/publiccontroller、operations读写授权与scope/cap、TDS topic/session/principal/HTTP、TDC HTTP/ready/消息、store-basic loaded与topic范式、当前automation/adminL2入口/foundation真实消费者。

先需求/规范/当前source形成自己的合理性判断，再读B作者方案。先证伪产生findings/verdict，最后才可读历史/作者intake。R2先独立形成判断后可读R1/intake；A旧review不作结论。

## 审查问题

- B是否忠于供给与观察，未偷做C自动/主副、未影响Codex A实施？A依赖是否条件化且不靠mock解除？
- 用户任务/两后台scope/读写权限/两个内容页内全部交互及每操作、UI/testID/分页/候选来源是否真实、简单且可达？IA/交互仍需Dexter单独确认。
- FULL/HOT实际解析/同版本冲突/私有asset、有限资源/工具依赖/官方版本与静态OPEN是否可信？
- 集合与snapshot锁/首次空/同time/分页乱序/当前周期gate，是否符合TDP原始time而非发明逻辑版本？
- download transientgrant及sourceprovider授权/撤权/固定task是否最小且不泄露凭证？
- report当前session/sequence/ACK/DB失败/unknown/旧binding/离线laststate是否闭合，未新增流水？
- CP/focused/全批6b/动态准入/整体验收/13c是否循环？UI先于L2scripts；TER唯一agent/先Web后Android；admin唯一L2；seed真实source/role/授权是否明确？
- V全部本阶段子断言是否点名scenario/执行面，计划不是PASS；查更小替代与同根矛盾。

## 输出

只读，不写任何文件、不运行生成/测试/构建/verify或动态；必要rg/sed/nl/哈希读取与memory query允许。仅报告文本由主agent逐字归档。
明确GO/NO-GO（允许已知UI未运行GO_WITH_UNVERIFIED_UI）、M/S/N；每finding精确path/line、事实或推论、影响、最小可验收修正、Dexter裁决否；缺设计判据单列DESIGN_GAPS。列输入实际读取、静态事实、OPEN/NOT_RUN与合理性，不能为缺动态evidence单列设计缺陷。

## 本次实质范围变化与旧cycle边界

Dexter原话：“PLATFORM-REPORT……和RULE-LIST是一个页面……左边……所有更新规则，右边……所有门店终端的更新状态”；随后明确：“运维管理后台，只定义终端的更新版本，运营后台才是规则与更新情况报告”。旧cycle的R1 NO-GO保留；旧R2在读材料期间因该实质Journey变化受控停止，VERDICT=NOT_ISSUED，不补写结论。新cycle严格因Dexter实质范围变更成立，不因作者措辞或hash改变重置。新范围按当前Journey裁定读取：运维无报告、运营项目同页左规则/右状态，旧正式R15双面报告消费规定被明确覆盖。

另请独立核验snapshot terminalRead命名与typed query分页/生成policy闭包；store-basic非持久STORE/PROJECT各flush身份状态及晚安装composition读取；附录§9逐动作DOM/control、隐形command参数表，不继承作者修订为已关闭。

REVIEW_ROUND=2

## 追加裁定与当前输入

Dexter：“所有的控件都要使用标准的查询、列表、分页、详情抽屉、编辑抽屉等现成控件容器，不得自己再发明”。当前两个内容页内全部交互以PROJECT-REPORT-DETAIL替代旧Card报告入口，状态列表首列名称进标准Drawer。详设第16个PROJECT detail GET，附录§9/10完整动作与标准容器来源。这个改动在新cycle第1轮开始之前，不消耗额外轮次。

## 最终R1补充输入

Dexter再次明确详设必须包括测试脚本/seed，并按项目详设要求查完整性；详设§15逐项稳定seed四工件/八规则/role/cap/COUNT_KEYS/父dryrun与脚本argv/fixture/清理，§3五列表及§3a OPEN/BLOCKED已补全。六设计工件下列SHA冻结，review按最终字节，旧摘要不作本轮结果。


## R2明确输入与硬停止

Dexter大致IA已确认，但没有实施或运行授权。R1为NO-GO 3M/4S/0N，仅旧字节。请独立读原需求/规范/source及完整当前六工件，先形成可证伪结论，再看R1/intake定向核验。重点：附件11 JSON/binary和16逐op合同/请求本地计数假设、handler事务；详设4/9a.1；附件12/13输入/fact/动作；14逐V；15seedtests；计划首次L2完整dryrun门。不得因为当前有表格而假称事实已通过，不为NOT_RUN单独finding。

本轮是同cycle第二轮，REVIEW_ROUND_LIMIT=2，ROUND_FINAL_DECISION=SELF_DECIDED；交原始verdict后硬停止，不自行第三轮。使用精简模板覆盖表说明确实读了规范各槽，不需重写全部规范。主agent唯一写入，reviewer报告文本我归档。

## 当前R2六工件冻结SHA

- `doc/decisions/2026-10-07-ter-update-supply-and-version-report-ia-claude.md`：`faca9c1d85eab76ffa0f1103b5bf0d78d03944d8980983ae4d200da682668363`
- `doc/decisions/2026-10-07-ter-update-supply-and-version-report-journey-claude.md`：`b3d3bb6523684a53504792546cb05da2412f9678da60fb062239cfee0ddbb8c7`
- `doc/decisions/2026-10-07-ter-update-supply-and-version-report-ui-interaction-claude.md`：`ae24877be3e0644e58be02a8edcf174f4e8988292d6a227338b263a8aa4ceb97`
- `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md`：`fe9fa9eb03a678d29bb5a896de6e02267d840375a39081468246ca8c8becd08e`
- `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-plan-claude.md`：`059ce673eaf88004ed771821790d60d5fd2202abd445c968675f5a1978c20c0a`
- `doc/plans/platform/2026-10-07-ter-version-update-stage-b-source-and-api-appendix-claude.md`：`eb74443e58c2f532e5ca8c2ca0293687b046a35caeeefed47a66f4954731ce96`

R1原始输入：doc/review/platform/2026-10-07-ter-version-update-stage-b-project-tabs-design-review-r1-codex.md。作者处置：doc/review/platform/2026-10-07-ter-version-update-stage-b-design-review-intake-claude.md，仅最后定向对照。
