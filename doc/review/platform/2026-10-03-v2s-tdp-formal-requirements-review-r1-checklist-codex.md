# TDP 正式需求 · Round 1 输入检查清单

由 `/root/tdp_formal_requirements_r1_fresh` 返回；主 agent 整理落盘，不把范围阅读改成全仓逐行声称。

```text
REVIEW_CYCLE_ID=TDP_DATA_CHANGE_REMOTE_OPERATIONS_REQUIREMENTS_2026-10-03
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
INPUT_READ_COMPLETE=本任务最小必要输入已按以下范围读取；未声明READ_ALL
AUTHOR_MATERIAL_READ=false
READ_ONLY=true
DYNAMIC_EXECUTION=NOT_RUN
FILE_WRITE=NONE
```

## 入口、授权与目标

已读AGENTS.md、CLAUDE.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md、scripts/README.md全文（大输出分段补读）；parent prompt中的Dexter授权/原始输入；目标全文及§10原话；cs-review skill、review-standard、index及全部kernel。开始/结束目标hash均为`bd36b68c7aff83ac1ce5eb54ac9f1920c9b9aa3bc92e49e8ff2a2aa8572999ec`。

独立结论前后未读当前讨论稿、作者review/intake/attemptlog。原始输入由prompt及目标§10提供，这是盲审隔离，不是假装已读讨论分析。

## 六维路由与原文

实际执行：

```text
scripts/context/recall-memory --task-kind review --domain platform --consumer-face backend --owner platform --impact architecture --trigger review
scripts/context/recall-memory --task-kind review --domain backend --consumer-face backend --owner backend --impact transaction --trigger review
```

长stdout在65,536字节附近截断，已读取routing-vocabulary及required-inventory，按相同六维/all匹配核全路径。
平台33项、后台14项、union34项：6 kernel、28 routed。以下原文已读；corpus按命中节阅读。

```text
project-memory/kernel/01-workspace-and-authorization.md
project-memory/kernel/02-service-shape-and-owner.md
project-memory/kernel/03-transaction-data-and-dependencies.md
project-memory/kernel/04-contract-consumer-and-admin.md
project-memory/kernel/05-evidence-runtime-and-git.md
project-memory/kernel/06-heritage-and-change.md
project-memory/decisions/confirmed-business-language-corpus.md
project-memory/decisions/deterministic-context-only.md
project-memory/decisions/distributed-topology-is-not-current.md
project-memory/decisions/http-crud-efficiency-design-redlines.md
project-memory/decisions/independent-subagent-adversarial-review.md
project-memory/decisions/owner-read-model-and-lifecycle-standard.md
project-memory/operations/business-corpus-adoption-and-read-policy.md
project-memory/operations/business-corpus-parked-domain-intake.md
project-memory/operations/backend-readability-refactor.md
project-memory/operations/implementation-source-reread-discipline.md
project-memory/pitfalls/browser-route-data-scope-drift.md
project-memory/pitfalls/designing-from-conversation-not-system.md
project-memory/pitfalls/invisible-dimension-drifts-at-implementation.md
project-memory/pitfalls/platform-detail-reverse-inference.md
project-memory/pitfalls/review-checked-existence-not-rendering.md
project-memory/practices/backend-capability-lookup.md
project-memory/practices/collection-boundary-modes.md
project-memory/practices/failure-condition-names-the-wrong-shape.md
project-memory/practices/insert-as-claim-ownership.md
project-memory/practices/ordering-only-for-consumer-facing.md
project-memory/practices/read-model-granularity.md
project-memory/practices/set-interaction-not-n-times-single.md
project-memory/operations/terminal-coding-standard.md
project-memory/decisions/terminal-architecture-and-stack-rulings.md
project-memory/decisions/terminal-build-order-and-batches.md
project-memory/pitfalls/generated-output-and-static-gate-drift.md
project-memory/practices/ter-input-and-virtual-keyboard-usage.md
project-memory/practices/third-party-library-official-source-verification.md
```

另读operations/verification-governance，不冒充上述route新增命中。

## Corpus与适用sourceRefs

检索集团/集团空间/项目/大区/门店/启用停用/合同，读G-01—G-10相关原文及不得推导边界。
服务点topic及terminal-control没有对应已确认语料：NO_CORPUS_ENTRY_MATCHED，按本轮Dexter和既有service-point需求判断。
不把集团空间当商业集团、不猜GROUP节点、不把日期经营衍生状态当valid范围。不扩读无关CIPG字段成新要求。

适用原文已读：

- carryover-manifest-claude Part B.1—B.6/G/H，历史控制面以现行decision为准。
- base-1 requirements §0/0.1/0.2、§1.1—1.7、§3/3.0/3.1/3.2及适用矩阵。
- terminal-skeleton requirements §1/§7适用职责。
- newposv1 package analysis 00-ter-build-order §4B.10 T-1—T-13、T-5、§4B.11 X-08。
- terminal-activation-and-connection requirements D-21、R-7、R-9及transport边界。
- 冻结logging-and-debugging-foundation-standard全文、compliance-control-retirement decision全文。
- 下列current规范与decision是对应route的当前owning sources。

历史public invitation、M1回填、CIPG四工件、旧HTTP预算分析、UI分页及外部collaboration/channel专项没有本期对应动作/字段/页面/性能改造；不作本期产品依据，不扩读无关详设全文。通用规则已从current规范、charter与memory原文读取。

## Decision盘点与全文阅读

只读Python列举doc/decisions/*.md并提取实际首个#标题：124文件，1无一级标题。
选择依据：部署、agent控制、terminal身份/拓扑、Doris例外、review/verification及原子交付，未继承作者索引结论。
相关全文：

```text
doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md
doc/decisions/2026-07-24-v2s-solution-reasonableness-review-policy.md
doc/decisions/2026-07-24-v2s-verification-governance.md
doc/decisions/2026-07-25-v2s-agent-coordination-and-control-boundary.md
doc/decisions/2026-07-25-v2s-confirmed-business-corpus-memory-adoption.md
doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md
doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md
doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md
doc/decisions/2026-09-08-v2s-managed-browser-l2-remote-backend-topology.md
doc/decisions/2026-09-25-v2s-roadmap-mechanism-retirement.md
doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md
doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md
doc/decisions/2026-10-02-v2s-terminal-activation-batch-3-amendment-proposal.md
```

review governance第二轮SELF_DECIDED由reviewer写，优先旧kernel/README表述。本轮不写第二轮字段。

## 标准、模板与源码

全文读foundation-charter、backend-coding-standard、third-party-library-usage-standard、implementation-task-template及四模板。
terminal-coding-standard读TR01—04、TR08、TR09、TR11、TR16、owner/sync/selector及§4-F；未冒全文READ_ALL。
四模板逐节N/A表见report，不豁免下一设计阶段。

独立定位读取：

- terminal-connection-protocol、terminal-client-generation policy全文。
- TDC types/client、公开selector、commands、module factory及actor的秘密/激活/ready与事件command接线。
- runtime execution/module/requestLedger types、slice、两种request selector、actor dispatcher、createRuntime注册dispatch/订阅/生命周期。
- sample-member-registry slice全文。
- CBS SystemTimeProvider全文；organization ServicePointService目录/batch/candidates/创建更新状态排序/readback/scope/time方法、CommercialGroupLookup/两readback、OwnerApi、组织/门店关系SQL。
- contract两SQL全文及StoreContractReadback全文。
- TDS BindingRevocationListener、ConnectionStateRepository、WebSocketConnection全文。
- S-1另补既有service-point正式需求、IA排序/归属规则、交互只读区域原文；不是本期作者材料。

实施逐点前后读：NOT_APPLICABLE_WITH_REASON，本轮没有源码实施/CP/focused proof。
新动态V01—24均NOT_RUN。没有写临时文件、修改目标或执行Git/动态命令。
长输出截断和zsh未匹配glob按分段/rg--files定位补读，没有以截断冒称材料不存在或读取完成。
