# 阶段 C DESIGN 独立审查输入

REVIEW_CYCLE_ID=ter-version-update-stage-c-design-2026-10-09
REVIEW_TARGET=DESIGN
ORIGINAL_REVIEW_ROUND_LIMIT=2
REVIEW_ROUND_LIMIT=4
ROUND_EXTENSION_AUTHORITY=DEXTER_EXPLICIT_SESSION

## 当前指派

Dexter要求参考Codex在途B实施与B详设，编写C详设和计划，再交Dexter与另一个Claude。仅文档授权，不改B/source、不运行测试/build/verify/DEV/device/reset/seed。原需求C覆盖自动/N-M/主副独立；B当前未accepted，只是源码截面。Dexter已确认IA及当前低保真邀请内容，真实UI仍NOT_RUN。Dexter追加明确只做常见主流程，两个不同样本App不能配对；保留同App原身份检查/业务。此裁决覆盖需求R-07旧句；不修改需求正本、不新建cycle。reviewer只读，不写任何文件，不读.runtime。主agent写review交付。

## 最小输入清单

- AGENTS.md、CLAUDE.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md、scripts/README.md。
- project-memory/index.md全部kernel原文、project-memory/decisions/deterministic-context-only.md。
- 六维路由 scripts/context/recall-memory --task-kind design --domain platform --consumer-face operations-admin --owner platform --impact governance --trigger implementation，全部命中原文及适用sourceRefs；仅memory路由可执行，其余只读取。
- 正式需求 doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md；讨论稿 2026-10-04-ter-version-and-js-apk-update-requirements-discussion-claude.md（用户裁决）；A三设计文件前缀2026-10-06-ter-version-update-stage-a-；B三设计文件前缀2026-10-07-ter-version-update-stage-b-。
- 被审完整六份：doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-{journey,ia,ui-interaction}-claude.md；doc/plans/platform/2026-10-09-ter-version-update-stage-c-{implementation-design,implementation-plan,source-and-api-appendix}-claude.md。全读，不只检查一表。
- doc/decisions/templates/{journey-decision,ia-design,ui-interaction-design,implementation-design}-template.md；doc/platform/{implementation-task-template,review-standard,terminal-coding-standard,frontend-coding-standard,third-party-library-usage-standard}.md；doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md、doc/decisions/2026-07-24-v2s-verification-governance.md。
- 相关decision标题检索；corpus搜索规则/版本/项目/门店/主副等，重开confirmed-business-language-corpus。
- owning source：update actor/types/slice/module/selectors/commands；runtime module/lifecycle/state；render SurfaceRoot/LayerStack/primitives；topology pairByHost/HELLO/controller/codec/selector；TDCgrant/report命令actor；两integration assembly；platformports update/default；AndroidUpdateRuntime/Module/Preparer；automation runner/managedRun/currentjourneys/API/skill；B ownerapi/service/persistence/edge/generated/currentcanonicals；r5-full seedfixture契约。附件§2精确路径。
- 修改前后双读仅本设计文档：原需求/来源及真实source→设计字段，文档NOT_RUN不得要求动态proof；实施期逐点双读是未来义务，本轮不虚构。

## 盲审声明

先以“找出它为什么不成立”为立场独立形成findings/verdict，再读作者自评或intake（本轮未提供任何intake）。报告REVIEW_ROUND=1或2、reviewerKind=INDEPENDENT_SUBAGENT、fresh与阅读清单；R2另ROUND_FINAL_DECISION=SELF_DECIDED。不得独立改文件。评审方案合理性、模板覆盖、源码可实施性、产品待决与UIUNVERIFIED；每finding精确路径/行号、性质、反例、影响、最小修正、Dexterdecision。

## 原 Round 2 定向输入与停止（历史指派，后被明确追加授权覆盖）

同 cycle REVIEW_ROUND=2、ROUND_FINAL_DECISION=SELF_DECIDED。完整重读当前六份与需求；对应规范/当前真实接缝为最小输入，A/B owning 大文件只须覆盖本次调用链，不声称读无关行。先独立形成 verdict，然后才对照 R1 与 intake；不要继承其分类。重点：R-09 S3确认不占执行名额、同App配对/VICE本机PRIMARY层、FULL单APK与HOT清单不同来源、known pending-user N恢复同session、实际primitive/canonical/原子组、普通容量沿既有门不扩预算、后台B/TERrunner所有权。极端归档、新跨App和缺动态证据不是finding；但主流程真实失效仍可报告。本轮后硬停止，作者自行处置不召第三轮。

## Dexter 明确追加两轮（R3 / R4）

原R1/R2及其限额、冻结SHA、独立NO-GO保留，原cycle不换名。Dexter新原话：“IA确认。请再多两轮对抗性review后再移交另一个Claude做review”。这项直接会话指派覆盖本cycle默认两轮上限，REVIEW_ROUND=3|4、REVIEW_ROUND_LIMIT=4；R4写ROUND_FINAL_DECISION=SELF_DECIDED，仅reviewer给独立结论，作者仅做后续intake，不代写GO。此为明确例外，不推为其他cycle的新规范，R4后不再自行追加。

本轮IA内容已确认（含当前低保真邀请），不是真实UI动态PASS。授权仍只有C设计文档及review记录；不修改需求正本、A/B、规范、记忆、源码或依赖，不测试/生成/build/verify/运行环境，不读取.runtime。仍只做常见主流程、同App配对，不扩大到极端归档、容量平台、跨App业务。

R3/R4先完整独立阅读本清单所有适用原文和当前六文/owning source，先独立verdict、再看历史报告/intake；本清单仅指定范围，不提供作者处置结论。R3广度证伪，R4核验修订及同根反例。每轮只读、主agent落盘报告。A/B最新源变化须亲读，有关接口仍OPEN且不声称已验收；不得仅因动态未运行列finding。
