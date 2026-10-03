# TDP 正式需求 · Round 2 实际输入检查清单

```text
REVIEW_CYCLE_ID=TDP_DATA_CHANGE_REMOTE_OPERATIONS_REQUIREMENTS_2026-10-03
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
INPUT_READ_COMPLETE=本任务最小必要输入按以下真实范围已读；不声称全仓READ_ALL
AUTHOR_MATERIAL_READ_AFTER_INDEPENDENT_VERDICT=true
READ_ONLY=true
FILE_WRITE=NONE
DYNAMIC_EXECUTION=NOT_RUN
ROUND_FINAL_DECISION=SELF_DECIDED
```

## 1 · 入口、原始输入与冻结边界

实际全文读取（输出截断均按分段补读）：

- `AGENTS.md` 1—108；`CLAUDE.md` 1—109。
- `PLATFORM-BLUEPRINT.md` 1—86；`doc/platform/README.md` 1—25；`scripts/README.md` 1—317。
- `project-memory/index.md`全文及其六个kernel全文，见下列路径。
- `.agents/skills/cs-review/SKILL.md` 1—85；只用仓内skill，没有用全局同名替代。
- `doc/platform/review-standard.md` 1—218；固定block按§1动作5、命名按§5。
- 目标`doc/plans/platform/2026-10-03-v2s-tdp-data-change-and-remote-operations-formal-requirements-claude.md` 1—417，包括§10逐条原话。
- parent prompt提供的Dexter授权及完整业务原输入；本轮原始授权为“请整理并生成正式的需求文档并完成两次对抗性review”。不由仓内状态推导实施授权。

输入、独立结论前与结束目标SHA256：
`dd930a330c1e84e53f19e708a8c92956ff9043b1c5a0d50dd9c405f182193fbb`。

先独立阅读/反例核验并通过send_message锁定GO、0/0/1及V13时间措辞N，之后才读指定R1材料。未读本期`requirements-discussion-claude`作者分析，也未读失效attempt档案。目标自身§10是原话输入；目标§8是待审需求，不是作者自评替代品。

## 2 · 两条六维路由及全文命中

实际执行：

```text
scripts/context/recall-memory --task-kind review --domain platform --consumer-face backend --owner platform --impact architecture --trigger review
scripts/context/recall-memory --task-kind review --domain backend --consumer-face backend --owner backend --impact transaction --trigger review
```

platform长stdout在约65,536字节处被工具截断；未写临时文件。读取`project-memory/routing-vocabulary.json`及`project-memory/required-inventory.json`，用只读Python在内存按各route字段“all或精确值”逐项复算，并重新打开全部命中原文。platform=33、backend=13、union=34；6 kernel+28 routed。backend的独有命中为insert-as-claim-ownership，其余属于platform并集。该计数由本轮独立复算，未继承R1 checklist旧14计数。

以下34文件全文已读，长文件用分段补齐；sourceRefs按适用范围在§3登记：

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

另读`project-memory/operations/verification-governance.md`全文；它不冒充上述route命中。

## 3 · Corpus检索与sourceRefs适用处置

实际`rg`检索集团/集团空间/组织/项目/大区/门店/启停/合同；读取confirmed-business-language-corpus全文，特别核验G01—G10及全部不得推导。G04锁定项目+实际经营租户+品牌；G09当前生效衍生状态不等于本期ACTIVE valid范围；商业集团与集团空间/组织节点分开。服务点同步与terminal-control无专门corpus条目：NO_CORPUS_ENTRY_MATCHED，按本轮Dexter输入及既有业务source判断，不从SQL推新command。

适用current来源及范围：

- `doc/platform/foundation-charter.md` 1—630全文。
- `doc/platform/backend-coding-standard.md` 1—523全文。
- `doc/platform/third-party-library-usage-standard.md` 1—20全文；本轮无新增第三方运行行为主张，实际版本与官方依据仍是后续详设义务。
- `doc/platform/implementation-task-template.md` 1—325全文。
- `doc/platform/terminal-coding-standard.md`按heading边界读TR01—04（52—194）、TR08—09（286—412）、TR11（446—498）、TR16（667—713）、owner/selector/sync §4-D（906—942）和§4-F（1012—1071）；未声称1205行全文已读。
- 四模板全文：Journey 1—78、IA 1—170、UI interaction 1—439、implementation design 1—406；逐节适用性见report表。

适用历史sourceRefs仅按当前任务重开：

- `doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md` Part B.1—B.4（131—206）、B.6（225—235）、D.7/D.8（325—347）。通用owner/事务/身份/状态/日志原则与current正本共同核；旧outbox/polling、控制面及admin UI具体实现不覆盖当前明确限制。
- `doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md` §0/0.1/0.2（7—48）、§1.2—1.5（71—108）、§3/3.0/3.1/3.2至绑定例（222—290）。同事实读取/owner聚合/锁定关系/三态/各维度事实适用；不扩成base-1实施任务。
- `doc/review/platform/2026-08-28-newposv1-package-analysis-claude/00-ter-build-order-claude.md` §2三批/机制协议界线（49—120）、§4B.9 command→actor及规范比较（565—603）；当前TER stack/selector/sync/script规则以terminal-coding正本为准，旧批次不作本期准入。
- `doc/plans/platform/2026-08-29-v2s-terminal-skeleton-requirements-claude.md` §11（765—785）历史延后/非目标边界；本期已有TDS/TDC当前源码及新授权，不继承旧“对手方缺位”状态。
- `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md` R2/R3（118—160）、R9（294—327）及transportR10（327—398）；激活身份、取消仅server-config保留、MASTER连接和transport责任适用。未读其作者历史分析为本期结论依据。
- `doc/heritage/frozen/catering-all-v2/project-memory/decisions/logging-and-debugging-foundation-standard.md`全文；只作受管运行/诊断与日志约束，不执行动态。

不适用sourceRefs，未用它们授权新工作：

- CIPG四工件：`doc/plans/platform/2026-08-23-v2s-catalog-identification-production-guidance-formal-requirements-codex.md`、`2026-08-23-v2s-catalog-library-ui-experience-formal-requirements-codex.md`、`2026-08-23-v2s-catalog-library-workbench-ia-design-codex.md`、`2026-08-23-v2s-catalog-library-workbench-interaction-design-codex.md`：无本期商品字段/页面/制作操作；仅corpus禁推仍读。
- `doc/decisions/2026-08-10-v2s-m1-extension-submission-and-command-readback-decision.md`、`2026-08-12-v2s-public-invitation-resumption-state-machine.md`；`doc/evidence/platform/rm1/p6/rm1p6-extension-hosts-u26-implementation-amendment.md`、`rm1p6-u13-all-http-crud-efficiency-remediation-design.md`：本期不修改M1/邀请/旧CRUD分母；通用生成/owner/readback原则已从active标准核。
- `doc/plans/platform/2026-08-22-v2s-backend-performance-remediation-implementation-design-codex.md`及`doc/review/platform/2026-08-16-v2s-backend-standards-conformance-review-claude.md`、`2026-08-22-v2s-backend-performance-remediation-design-review-claude.md`、`2026-08-22-v2s-backend-performance-root-cause-analysis-claude.md`：本期不做旧性能重构，不继承历史分母或性能PASS。
- `doc/review/platform/2026-08-18-v2s-external-collaboration-and-business-channel-spec-claude.md`：无collaboration/channel业务写入；topic候选不等于接入。
- `doc/plans/platform/2026-08-18-v2s-unified-list-pagination-implementation-design-codex.md`及`doc/platform/frontend-coding-standard.md` UI专节：无admin页面/列表/表单实施；topic全集/一致快照约束不借分页页面设计替代。
- `doc/review/platform/2026-08-13-v2s-compliance-control-retirement-decision-claude.md`：本轮没有控制面实施；退役红线已由当前AGENTS/CLAUDE/kernel/roadmap decision直接完整核实，不恢复旧台账。
- TER输入/虚拟键盘材料的UI/native专节：本期无输入控件或adapter行为，TR16的未来Web-first义务仍保留。

## 4 · Decision实际标题盘点与全文阅读

实际`rg -n '^# ' doc/decisions/*.md`列目录实际标题；只读Python复算顶层124个.md，123有一级标题；无一级标题的是`doc/decisions/2026-08-05-v2s-rp-02a-implementation-activation.md`。不是从作者索引选择。无关标题不复制成新规则。

选择依据为业务deployable/owner、agent边界、终端身份与transport/跨节点例外、review/verification/logging/批次原子交付，另以store规则及服务点已有业务范围作反例核查。相关全文已读：

```text
doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md
doc/decisions/2026-07-24-v2s-solution-reasonableness-review-policy.md
doc/decisions/2026-07-24-v2s-verification-governance.md
doc/decisions/2026-07-25-v2s-agent-coordination-and-control-boundary.md
doc/decisions/2026-07-25-v2s-confirmed-business-corpus-memory-adoption.md
doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md
doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md
doc/decisions/2026-09-16-v2s-store-operating-rule-switches-journey-codex.md
doc/decisions/2026-09-17-v2s-store-service-point-qr-journey-codex.md
doc/decisions/2026-09-25-v2s-roadmap-mechanism-retirement.md
doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md
doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md
doc/decisions/2026-10-02-v2s-terminal-activation-batch-3-amendment-proposal.md
```

第二轮SELF_DECIDED以independent governance当前明确条款为准，由reviewer在own报告内写；不让旧kernel/README“作者自行收口”表述代替独立verdict。正式需求不是implementation-facing设计，故不强造IA、CP或seed设计。

## 5 · 真实源码读取范围

先`rg --files`定位，再读取下列当前文件；长source是范围阅读，不宣称全仓生产源码逐行读取。

- `contracts/protocol/terminal-connection-protocol.json` 1—100；`contracts/policy/terminal-client-generation.json` 1—18全文。
- `apps/terminal/kernel/base/terminal-data-client/src/types/client.ts`全文；`features/commands/terminalDataClientCommands.ts`、两公开`selectors/*.ts`、`application/createTerminalDataClientModule.ts`全文。`features/actors/terminalDataClientActor.ts`搜索全文件接线，读80—132、310—355、470—539、628—706、745—789：MASTER、secret owner、激活保存/连接、ready及取消激活事件边界。
- `apps/terminal/kernel/base/runtime/src/types/execution.ts`、`types/module.ts`、`types/requestLedger.ts`、`features/slices/requestLedger.ts`、`selectors/readRequestLedgerState.ts`、`selectors/selectRequestExecutionView.ts`、`selectors/selectRequestExecutionViews.ts`全文。`foundations/createCommandActorDispatcher.ts`读175—231、264—416；`application/createRuntime.ts`读108—150、285—359、455—496，并全文件检索注册/订阅/reset/dispatch。观察普通result与late事件不同、ledger never均有真实行依据。
- `apps/terminal/kernel/feature/sample-member-registry/src/features/slices/slice.ts`全文：owner-only持久与master-to-slave同步样例。
- `apps/backend/catering-business-server/modules/foundation/src/main/java/com/catering/v2s/platform/foundation/time/SystemTimeProvider.java`全文：原始epochMillis来源，不假定人工单调。
- organization API目录：`OrganizationOwnerApi.java`、`CommercialGroupLookup.java`、`OrganizationNodeReadback.java`、`CommercialGroupReadback.java`、`StoreOperatingRuleReadback.java`、`StoreServicePointOwnerApi.java`全文。
- `organization/application/StoreService.java`读129—160、541—607，并全文件定位project/规则/time/update；确认owner project一致与规则根JSON同次store更新时间。
- `organization/application/OrganizationHierarchyService.java`全文件定位parent/update，读875—950：parent相等才允许update。
- `organization/application/StoreServicePointService.java`全文件定位公开方法/status/area/time，读76—126、225—299、638—724、768—812；目录过滤、point更新归属、原区域排序、业务时间与详情来源。未把method名“move”或SQL列当业务授权。
- edge `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsStoreProfileController.java` 1—140；`OperationsStoreManagementController.java` 49—59、232—279；`OperationsOrganizationHierarchyController.java` 193—257；generated `wire/OrganizationStoreUpdateRequest.java`全文。真实wire/edge/owner联合证伪store改项目。
- `apps/backend/catering-business-server/modules/store-contract/src/main/java/com/catering/v2s/contract/application/persistence/ContractCommandServiceSql.java` 1—92、`ContractTaskReadServiceSql.java` 1—151、`api/StoreContractReadback.java`全文；ACTIVE/INVALID与日期view区别、store_id不可由现有update更改，现readback缺原始time需后续terminal读取闭合。
- `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/websocket/TdsWebSocketConnection.java` 1—168全文；`state/TdsConnectionStateRepository.java`读1—141并全文件定位公开session/heartbeat/disconnect方法；`session/TdsBindingRevocationListener.java`全文件定位监听/恢复/事件、读143—198。PG只当前连接事实/通知唤醒、当前socket发送非持久确认由代码结构核验；未对第三方库实际运行作PASS主张。

上述路径均本仓当前字节。没有用heritage运行/build fallback，没有调用生成器或编译器来填补本轮静态结论。

## 6 · 后读作者材料与差异

独立结论已锁定后全文读取：

```text
doc/review/platform/2026-10-03-v2s-tdp-formal-requirements-review-r1-report-codex.md
doc/review/platform/2026-10-03-v2s-tdp-formal-requirements-review-r1-checklist-codex.md
doc/review/platform/2026-10-03-v2s-tdp-formal-requirements-review-intake-codex.md
```

r1旧hash为`bd36b68c7aff83ac1ce5eb54ac9f1920c9b9aa3bc92e49e8ff2a2aa8572999ec`，不与R2混用。R1阻断/两个N修复与当前独立源码结论一致；R1同根中以SQL可写推Store项目可变的局部前提不成立，作者intake对此证伪有公开wire/controller/owner依据。比较后GO、0/0/1不变，未增加第三轮。

## 7 · 真实完成及禁止越界核对

- 已静态核全部R01—20、V01—24；report逐条记录反例及后续OPEN。
- 三个已识别失败模式的有限防再犯反例已核：SQL/move名称不代表业务可变；当前非目标不升通用类别禁令；普通内存观察不证明持久或late-result。另核独立topic身份不等于独立业务时钟。
- UI分母为空，四模板逐节N/A表已由reviewer完成；不替后续详设豁免。
- 实施逐点前后双读/CP/focused-proof/全批三维=N/A：没有本批源码实施，不乱套实施gates。
- 动态V01—24、生成/编译/构建/测试/verify/DEV/reset/seed/L2/UAT/部署=NOT_RUN。
- FILE_WRITE=NONE，包括临时文件；未执行Git，未创建动态资源。cleanup=N/A，无business/cleanup PASS主张。
- 工具stdout截断、zsh未匹配目录glob及错误猜测旧decision文件名均通过rg定位/分段补读纠正；不把工具错误当材料不存在，也未用等待、timeout或重试替代诊断。
