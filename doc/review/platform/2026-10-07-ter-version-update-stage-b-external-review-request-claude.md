# 阶段 B 设计包：Dexter 转交 Claude 的独立评审请求

## 背景

A仍由Codex实施验收；B仅文档设计。当前后台任务与大致IA已确认。R3/R4、条件授权的R5已完成独立review，R6创建被平台thread limit拒绝，未执行。R5唯一确认项已最小修订，最终字节无独立GO；不能用作者intake推导通过。完整历史与工具状态均保留。

## 评审目标

请独立核验完整B方案、四模板、真实source及KISS、契约与owner、失败与并发、脚本/seed及验收可执行顺序。先原始材料再作者方案，最后历史intake。

## 需阅读文件

完整仓根相对路径及用途见下面可复制话术；最终六工件摘要见末表。R6工具记录不是review报告。

## 独立核验重点

两个内容页与PROJECT双Tab、标准控件；A工程前置；私有工件与16逐op合同；grant锁/报告有限恢复；前端呈现结构化事实；currentboot完整snapshot；真实seed/执行面及API→adminL2→另授权seed→TER顺序。所有实现/运行为OPEN或NOT_RUN。

## 期望结论

独立GO/NO-GO与M/S/N；只剩UI未验证则GO_WITH_UNVERIFIED_UI。精确path/line、事实/推论、反例影响、最低修正、Dexter裁决否；合理性/模板覆盖/DESIGN_GAPS/未验证分列。

## 可直接复制给 Claude 的话术

```text
Dexter 转交：

您好 Claude，烦请对《TER 版本定义、完整更新与热更新》阶段 B 完整设计包做独立静态 DESIGN 评审。

背景：Dexter允许在阶段A尚未完全验收时先起草B，未授权B实施。已确认后台职责及大致IA：运维管理后台只管理更新包和版本；运营管理后台同一项目内容页左“更新规则”、右“终端更新状态”，覆盖当前项目全部门店终端（含NO_REPORT）。两个后台各新增一个内容页，九个交互ID只是页内Tab/Drawer/Modal；全部复用现有标准控件容器。正式需求R-15旧双后台报告表述被本次明确裁定覆盖，需求正本本轮只读，未来实施需最小来源同步。

同一内部cycle保留历史结论，Dexter先追加R3/R4，又在R4 NO-GO且主agent亲验真问题后追加R5/R6。R4原始NO-GO 0M/1S/0N的验收顺序问题已确认并修订；没有通过改名重置cycle。R5原始结论为NO-GO、0M/1S/0N，唯一候选标题职责问题经主agent亲验后已最小修订。R6 input已经冻结，但直接创建和一次委托创建fresh reviewer均被工具以agent thread limit reached拒绝，因此R6未执行、没有verdict；最终字节尚无独立GO。原始结论与摘要保留，不以作者自审或外部review冒充缺失的R6。本次是Dexter转交外部review，不重开内部cycle，不继承作者状态或旧verdict。

目标：请先从原需求、当前裁定、项目规范和真实owning source推导预期，再审查完整设计包；确认需求闭包、方案简单性、owner/契约/失败边界、四模板内容及测试和seed可执行性。最后再读作者intake，不把它当独立证明。

请从 catering-v2s 仓库根阅读：
- AGENTS.md、CLAUDE.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md、scripts/README.md；project-memory/index.md全部kernel、deterministic-context-only及六维命中原文。
- doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md：需求正本。
- doc/plans/platform/2026-10-04-ter-version-and-js-apk-update-requirements-discussion-claude.md：裁定来源。
- doc/decisions/2026-10-07-ter-update-supply-and-version-report-journey-claude.md：用户任务与最新裁定。
- doc/decisions/2026-10-07-ter-update-supply-and-version-report-ia-claude.md：后台、页面、控件、权限及不可见行为。
- doc/decisions/2026-10-07-ter-update-supply-and-version-report-ui-interaction-claude.md：线框、逐输入/动作与恢复。
- doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md：完整方案、调用链、判据和测试/seed。
- doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-plan-claude.md：CP、准入、验收和交付顺序。
- doc/plans/platform/2026-10-07-ter-version-update-stage-b-source-and-api-appendix-claude.md：源码定位、逐operation合同、normal预算、V映射和完整输入分母。
- doc/decisions/templates/下Journey、IA、UI、implementation-design四模板；doc/platform/implementation-task-template.md、review-standard.md、backend/frontend/terminal-coding-standard.md、third-party-library-usage-standard.md、foundation-charter.md；doc/decisions/2026-07-24-v2s-verification-governance.md。
- 当前阶段A设计/产物schema/builder/update owner/UpdatePort/native/provider、CBS asset与IAM/organization、TDS/TDC、store-basic、foundation后台消费者、最新automation-agent/admin L2和seed源码，按附件精确路径重开；A当前源码不等于已验收。
- 最后读doc/review/platform/2026-10-07-ter-version-update-stage-b-project-tabs-design-review-r5-codex.md、doc/review/platform/2026-10-07-ter-version-update-stage-b-project-tabs-design-review-r6-input-claude.md、doc/review/platform/2026-10-07-ter-version-update-stage-b-project-tabs-design-review-r6-tool-status-claude.md及doc/review/platform/2026-10-07-ter-version-update-stage-b-design-review-intake-claude.md。对应冻结摘要和原始结论保留，最终六工件摘要见本交审文件。

请重点独立核验：
1. 四模板逐槽的实际内容；两个内容页、运营双Tab、PROJECT读与写cap分离、NO_REPORT分母、标准查询/列表/分页/Drawer和唯一dirty；逐输入、hidden事实、visible action、TestId与source是否一致。
2. A真实格式/actual交接前置；FULL/HOT配对与publication/ZIP身份、私有asset、16项HTTP的逐输入/错误/caller/app事务与完整DB计数、canonical生成到JSON/binary真实消费；预算是假设，未冒充测量。
3. topic范围锁、完整多页snapshot、原始时间、当前boot STORE/PROJECT各HTTP与flush门；grant发行先binding锁后count/insert且旧有效授权不被新发行撤销；report current session/sequence、持久ACK、跨ready同内容最多一次自恢复；不新增调度、流水或恢复框架。
4. 测试脚本和完整seed：四真实工件、八规则、角色cap、稳定key/hash、COUNT_KEYS/父子报告/完整dry-run；CP→全批6b→准入→API闭环→独立后台L2闭环→明确授权的DEV reset/start/当前完整seed→TER Web→同清单Android→13c/实施review。准入不等于业务通过，dry-run不等于真实seed；未授权前置不能旁路。
5. B只供给与观察，C自动/双机不进入；仅最新TER automation-agent，后台用自身受管L2，不复用跨层运行事实。不重复未受B影响且已MATCHED的A对账，但真实受影响接口须差量回归。

请给明确GO或NO-GO与M/S/N；已知阻断关闭且UI仍未验证时给GO_WITH_UNVERIFIED_UI。每条finding列精确相对路径/行号、事实或推论、反例/影响、最小可验收修正及是否需Dexter裁决；单列方案合理性、TEMPLATE_COVERAGE、DESIGN_GAPS、已核实与未验证项。

证据边界：大致IA已由Dexter确认；目前只有设计文档与只读静态审查。阶段A最终交接、依赖实际解析、生成/编译/测试/verify、HTTP/PG/Minio、组件、DEV/Web/Android、后台L2、reset/seed与cleanup均OPEN/NOT_RUN，计划与历史结果不是当前PASS。

授权边界：本次仅请静态评审B设计包及相关源码，可在doc/review/platform/下写一份以-claude结尾的评审文件；不修改需求/规范/项目记忆、A或生产源码/依赖，不执行生成、构建、测试、verify、DEV、Web、Android/设备、reset/seed、L2/UAT、部署或C。本结论不授权实施。谢谢。
```

HANDOFF_STRUCTURE_CHECK=PASS（scripts/check/claude-review-handoff --file；仅文档结构，不是测试/verify或动态证明）。

## 最终候审六工件 SHA-256

对应R5处置后/R6创建尝试的最终字节；R6未执行，摘要不是独立GO。

| 仓根相对路径 | SHA-256 |
| --- | --- |
| doc/decisions/2026-10-07-ter-update-supply-and-version-report-journey-claude.md | 4832f2fab31f6688ab6594a714f504a068202afa43b8816e767b8fffe4b64f34 |
| doc/decisions/2026-10-07-ter-update-supply-and-version-report-ia-claude.md | 846297d93393fc8213dff4b31ee6b433cfa805feab5120678a70438aa43a446f |
| doc/decisions/2026-10-07-ter-update-supply-and-version-report-ui-interaction-claude.md | a7d603e506404b317acb911c09a75de47df66968ab401ccea4f150ee4cddc4bd |
| doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md | e076785342290eb78959d0501300aab01a0f322b7c13133fc0677afffc408220 |
| doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-plan-claude.md | 11949c7f2f847d7ed4c8f249dcc732ba7259707e1da4dc3d17883f96cbb84bb4 |
| doc/plans/platform/2026-10-07-ter-version-update-stage-b-source-and-api-appendix-claude.md | 8bd1071b4439d9d92dbbae92a319c6fb75111ee146a5e402e3ca0bc35d0eaee2 |
