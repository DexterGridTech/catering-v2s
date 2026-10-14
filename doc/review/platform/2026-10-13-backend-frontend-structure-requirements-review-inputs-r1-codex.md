# 前后台结构正式需求 R1 · readonly reviewer 真实输入清单

由主agent保存 `/root/bf_requirements_blind_r1` 返回的输入记录。`reviewerKind=INDEPENDENT_SUBAGENT`；fresh、无写入、无运行、未读作者intake。盲审声明与独立结论见同名review-r1。不是作者对自身材料的独立证明。

## 指派

reviewer prompt包含Dexter原始分析任务及最新“需要我确认的内容全部按你的建议，然后根据分析稿生成正式需求文档，并完成对抗性review，直至go”原话、五项建议来源和文档/静态边界。检查对象全文SHA为`c8603b2a33ac69fb67c12da12059f7609f898eeb7595d9f3d1ed5b40542f1c13`。

## READ_FULL（reviewer 实际声明）

- AGENTS.md、CLAUDE.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md。
- project-memory/index.md与全部六kernel。
- .agents/skills/cs-memory-recall/SKILL.md、cs-review/SKILL.md及独立input-checklist模板。
- 对象、来源分析稿、TER T1正式需求全文；review-standard、third-party-library-usage-standard、operations.verification-governance；2026-07-24验证治理与2026-07-25独立review治理。
- 相关决定全文（补全reviewer所报标题的实际路径，仅展开导航，不扩阅读声明）：`doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md`、`2026-07-24-v2s-solution-reasonableness-review-policy.md`、`2026-07-25-v2s-confirmed-business-corpus-memory-adoption.md`、`2026-07-25-v2s-frontend-foundation-consumption-rule.md`、`2026-08-10-v2s-m1-extension-submission-and-command-readback-decision.md`、`2026-09-25-v2s-roadmap-mechanism-retirement.md`、`2026-07-29-v2s-observability-and-acceptance-standard.md`（后六个亦在doc/decisions/）。
- 2026-10-10-ter-remote-control-{journey,ia,ui-interaction}-claude.md。

## READ_APPLICABLE_ORIGINAL_SECTIONS

- scripts/README：入口/生成/verify、review、Runtime边界；backend规范§1-C/D/H/I、§2-0/A–I、R-READ01–10；frontend§2-A/B、§3-A–F、§3-K、§4；foundation owner/事务/消费面、集合/复用/重复/抽象/证据/控制权；实施模板CP/6b/动态前准入/日志两轮/逐代码。
- 四模板章节全集枚举、适用性/必填形态与完成条件；未授权具体UI/详设槽位N/A见报告。
- carryover-manifest B4/B5、base-1需求§0–1、catalog识别制作需求§0/UI体验§4.2.2/workbench Journey/IA/interaction VIEW/EDIT/制作/懒加载。
- 2026-10-07-ter-update-supply-and-version-report Journey/IA/UI的规则/报告列表详情、分页/失败/dirty/焦点/裁定；没有重新审整个旧设计包。
- doc/decisions根目录全部MD标题已列出，未将历史授权当本轮授权。

## 确定性 memory

实际两条六维路由：`design/backend/backend/backend/architecture/task-start`；`design/admin-ui/operations-admin/frontend-platform/architecture/task-start`。去重27项全部重开，不以路由输出代替原文。

`project-memory/`下命中：

```text
decisions/confirmed-business-language-corpus.md
decisions/deterministic-context-only.md
decisions/http-crud-efficiency-design-redlines.md
decisions/independent-subagent-adversarial-review.md
decisions/owner-read-model-and-lifecycle-standard.md
kernel/01-workspace-and-authorization.md
kernel/02-service-shape-and-owner.md
kernel/03-transaction-data-and-dependencies.md
kernel/04-contract-consumer-and-admin.md
kernel/05-evidence-runtime-and-git.md
kernel/06-heritage-and-change.md
operations/business-corpus-adoption-and-read-policy.md
operations/business-corpus-parked-domain-intake.md
operations/backend-readability-refactor.md
operations/execution-economics-and-failure-family-closure.md
pitfalls/designing-from-conversation-not-system.md
pitfalls/invisible-dimension-drifts-at-implementation.md
pitfalls/platform-detail-reverse-inference.md
practices/backend-acceptance-route-fixture-oracle-integrity.md
practices/backend-capability-lookup.md
practices/collection-boundary-modes.md
practices/ordering-only-for-consumer-facing.md
practices/third-party-library-official-source-verification.md
practices/drawer-form-lifecycle.md
practices/frontend-capability-lookup.md
practices/ui-visible-business-language-and-dynamic-aggregate-layout.md
practices/detail-drawer-action-menu.md
```

applicable sourceRefs重开以上正本、交互及实际源码。历史性能运行/旧review/不作为本轮行为声称的build gate未重新验收，不提升其权威。
corpus检索：商品、制作信息、制作变化、主数据、页面准入、动作能力、合同、双后台、菜单；命中G02–05/05A、G08–12、CIPG01的完整相关原文/禁推，非NO_CORPUS_ENTRY_MATCHED。

## 实际源码范围

当前小文件全文或相关方法段，非1134个文件全分支审计：

- TDS Protocol全文、codec合法集合、validBoundTopic、repository readTime与topic canonical。
- CBS asset两materialize；catalog Item构造/promotion/详情tabs/草稿/制作差异，Workbench差异、ValueSupport、Copy构造与Owner直接构造；IAM WorkspaceOperationsCommandApi全文。
- organizationExtensionValues、ExtensionSubmissionWireMapper、ExtensionSubmission全文；十Drawer提交分支、organization/store/business-entity/contract canonical/generated对象字段。
- 更新Page独立请求/loadRules/start/stale-end/关闭；remote Workspace props/parser/资源，remote canonical/generator renderContract。
- OperationsApp菜单filter、pageRegistry；PlatformReadPage既有guard/SalesMenu readmodel正例。
- foundation asyncGeneration/lifecycleLabels全文、usePageQuery identity、Drawer lifecycle/overlay/detailActionMenu接缝。

逐点实施双读：N/A，本轮无实施变更。作者自审/intake：未读，`authorMaterialReadAfterIndependentVerdict=false`。生成、测试、动态与cleanup均未执行。
