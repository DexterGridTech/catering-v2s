# V2S 销售菜单 SM-06～SM-12 正式交付与验证证据

~~~yaml
status: IMPLEMENTATION_DELIVERY_COMPLETE_CLAUDE_REVIEW_PENDING
scope: SM-06..SM-12
reviewCycleId: SALES-MENU-SM06-SM12-IMPLEMENTATION-20260905
sourceBinding: apps/backend-and-apps/frontend-only
dynamicRunId: l2-1788537303752-6068-0e2f3771-704f-4f00-a538-8746276dcd43
backendAcceptanceRunId: r5-tc-1788513077533-56187
seedRunId: complete-seed-4ef512cf-e50a-4c51-80d2-f911c38bf69a
independentImplementationReview: AUTHOR_CLOSED_AFTER_FINAL_FINDING_REPAIR
~~~

## 1. 范围、授权与证据等级

本证据覆盖销售菜单正式阶段 SM-06～SM-12：共享 foundation 与页面实现、前端交互与读模型、L2 生成链与执行器、浏览器 L2、seed 代码与完整 seed、managed reset/seed 证据、全批对账及 implementation review handoff。

本轮依据 Dexter 对“完成销售菜单整体 SM-06～SM-12 全部交付”的直接授权执行。永久 source binding 的根目录范围仅为 apps/backend 与 apps/frontend；apps/terminal、TDP runtime、UAT、部署、切流和页面可见性对账不在本交付范围内。根据仓库固定布局，apps/backend 全量 binding 会包含 apps/backend/terminal-data-server 的 README/build.gradle.kts 等空占位文件，但本批没有新增或验证 TDP runtime、契约、数据库、migration、seed 或业务代码。页面可见性对账按 Dexter 已明确排除，不作为阻断项。

证据等级严格分开：源码/生成物静态事实、编译与静态测试、真实 HTTP/Testcontainers、浏览器 L2、managed seed 和 cleanup 分别记录，不以其中任一层替代另一层。

## 2. 阶段交付状态

| 阶段 | 当前交付事实 | 证据状态 |
| --- | --- | --- |
| SM-06 | foundation AdminImageCollectionEditor、operations-admin route/model/read-model/commands、Drawer surface 与 cursor/readiness substrate 已实现；原阶段证据保留。 | PASS（静态、focused、受管 L2 支持） |
| SM-07 | 单页 IA、草稿/前台/操作记录读模型、菜单/分区/商品/媒体/发布交互、失败恢复和 scope 行为已实现，并通过前端静态/类型/架构验证。 | PASS（源码与静态证据；动态支持见 SM-09） |
| SM-08 | P1 blueprint、18-case/31-operation 分母、locator binding、fixture、timing、activation candidate 与同一 browser-l2 runner 生成链已闭合。 | PASS（生成链与静态验证；动态支持见 SM-09） |
| SM-09 | 最新受管浏览器 L2 运行 18/18，business 与 cleanup 均 PASS，join 完整，31 条目标 operation 有实际执行映射。 | PASS（真实浏览器 L2/HTTP/cleanup） |
| SM-10 | seed 父子阶段顺序、owner readback、BusinessChannel 前置数据、SalesMenu 数据与 15 个目标 acceptance scenario 的源码分母已闭合。 | PASS（静态与 backend acceptance 支持） |
| SM-11 | r5-full parent 按受管顺序完成 reset/seed 依赖链；各阶段 business PASS，cleanup 保留 DEV 状态。 | PASS（managed seed） |
| SM-12 | 31 operations、19 commands、38 owner rules、15 target acceptance scenarios、18 L2 cases、11 维实现对账及业务/cleanup 分离证据已汇总；独立 review 两轮 finding 已完成处置。 | PASS（作者按 review 两轮上限收口；Claude review handoff 待外部评审） |

## 3. 当前分母与唯一来源

- 受影响 operation：31 = 30 个 SalesMenu 新增 operation + 1 个既有 BusinessChannel operation 修改；唯一生成 registry 为 contracts/registry/generated/operation-handler-bindings/，L2 blueprint 的 operation coverage 与详设 §5/§11.1a 对齐。
- command：19 个；由当前 SalesMenu operation binding/contract 生成物及 backend owner command 实现共同证明。
- owner rules：38 个；权威分母来自 doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md 的 SM-01～SM-38 设计表。该计数不以 problem()、assertion 或 HTTP 请求数量替代。
- backend acceptance target：15 个，精确为 SalesMenuAcceptanceScenarios.java 的 13 个销售菜单场景、BusinessChannelAcceptanceScenarios.java 的 1 个 business-channel.sales-menu-eligible-cursor 场景，以及 AssetAcceptanceScenarios.java 的 1 个 asset.sales-menu-image-lifecycle 场景；全仓 99 个 acceptance source scenario 不是本批分母。
- browser L2：18 个 case，来自 contracts/policy/sales-menu-l2-case-blueprint.json；当前 blueprint 还精确包含 236 个声明控件条目、68 个 case-used unique control key，locator binding 为 78 个 control key。
- UI：UI-01～UI-31；由需求/IA/交互设计、SalesMenuPage.static.test.ts、blueprint case/action 与受管 L2 join 共同核对。

## 4. SM-06～SM-08 静态与前端实现

已核对的主要 owning source：

- apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.tsx
- apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuTaskSurfaces.tsx
- apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuCandidateDrawer.tsx
- apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuItemDetailDrawer.tsx
- apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuItemEditorDrawer.tsx
- apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuItemMediaEditor.tsx
- apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuManagerDrawer.tsx
- apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPublishDrawer.tsx
- apps/frontend/operations-admin/src/features/sales-menu/model/useSalesMenuReadModel.ts
- apps/frontend/operations-admin/src/features/sales-menu/salesMenuTestIds.ts
- libraries/frontend/admin-ui-foundation/

实现对账确认：

- foundation 的 Drawer lifecycle、overlay/dirty-form lock、media editor、cursor stack 与 CursorPagination 已复用；没有在 app 内另造同一共享能力。
- 页面维持单一 STORE scope；草稿、前台、操作记录使用独立 cursor/read model；动态行操作使用业务身份，不使用 index 作为身份。
- salesMenuTestIds.ts 的稳定常量挂在真实动作节点；候选 checkbox、Radio、Upload native input、Drawer/Modal action、分页及动态 MenuItem 均进入 blueprint 控件分母。
- currentData、失败 Alert/重试、发布预览、媒体 stage/release、手动售罄/恢复、copy boundary、菜单多启用和非空分区删除等业务语义已沿 owning source 对账。
- BusinessChannel owner fixture 与 readback 覆盖 STORE/INTERNAL 的 DINE_IN、TAKEAWAY，并排除 PROJECT、GROUP_BUY、EXTERNAL；没有把库存可售事实写入销售菜单持久化模型。

已执行并保留的静态/编译证据包括：

~~~
SALES_MENU_P1=PASS; CASES=18; OPERATIONS=31
BP_U02_BINDING_WRITE_CHECK=PASS; JSON_FILES=15; JAVA_FILES=15; FILES=30
browser-l2-runtime.test.mjs: 65/65 PASS
SALES_MENU_SEED_PLAN_SELF_TEST=PASS; MENUS=21; PRIMARY_ITEMS=21
sales-menu-seed-executor.test.mjs: 7/7 PASS
sales-menu-seed-plan.test.mjs: 2/2 PASS
external-collaboration-business-channel-seed-executor.test.mjs: 5/5 PASS
r5-complete-seed-executor.test.mjs: 6/6 PASS
R5_COMPLETE_SEED_DRY_RUN=PASS; COMPONENTS=4; SOURCE_ITEMS=73; CREATED_ITEMS=72; EXCLUDED_ITEMS=1; MEDIA=34
scripts/verify --validate-only: PASS
backend architecture tests: 15/15 PASS
PMD/Spotless/typecheck/frontend architecture: PASS
~~~

无 readiness 时生成物恢复为 FRAMEWORK_ONLY 是受设计约束的日常基线；执行时由同一 run 的 readiness manifest 生成 INCREMENTAL active case set，不手改 committed profile，也不把 framework-only 基线当成动态运行结果。

## 5. SM-09 浏览器 L2 与 operation join

受管 run：

~~~
runId=l2-1788537303752-6068-0e2f3771-704f-4f00-a538-8746276dcd43
topology=LOCAL_SPRING_LOCAL_VITE_LOCAL_PLAYWRIGHT_REMOTE_DB_ASSET_TUNNEL
discovered=18
selected=18
results=18
notRunCaseIds=[]
business=PASS
cleanup=PASS
firstFailure=null
lastKnownGood=L2_18_CASES_PASS
brokenBoundary=null
~~~

同一 run 的 l2-join-artifact.json：

~~~
joinStatus=COMPLETE
httpCompletionCount=285
backendCompletionCount=734
interceptedCompletionCount=4
declaredControlKeyCount=236
declaredActionCount=18
actualControlKeyCount=68
missingDeclaredControlKeyCount=0
unexpectedTouchedControlKeyCount=0
invalidCaseScopedEventCount=0
每个 case: result=passed, caseComplete=true, joinStatus=COMPLETE
每个 case: missingBackendCompletionCount=0, missingDbSectionCount=0,
           unexpectedTouchedControlKeys=[], networkConformanceError=null,
           browserRuntimeErrorCount=0
~~~

31-row operation 反向对账来自同一 run 的 HTTP/backend completion 与 L2 action join：

~~~
expectedOperations=31
observedExpectedOperations=31
missing=[]
~~~

这表示 operation 不是只在文档或 route 壳中出现，而是在 backend completion event 和浏览器动作 join 中都有真实证据。getOperationsCatalogNavigation、getPublicAssetContent 等 supporting operation 不替代、不稀释 31 条目标 operation。失败恢复场景内声明的 409/404 是已通过 oracle 的业务负向分支，不按“所有 HTTP 必须 2xx”误判。

原始产物：

- .runtime/browser-l2/l2-1788537303752-6068-0e2f3771-704f-4f00-a538-8746276dcd43/readiness-manifest.json
- .runtime/browser-l2/l2-1788537303752-6068-0e2f3771-704f-4f00-a538-8746276dcd43/l2-execution-manifest.json
- .runtime/browser-l2/l2-1788537303752-6068-0e2f3771-704f-4f00-a538-8746276dcd43/l2-join-artifact.json
- .runtime/browser-l2/l2-1788537303752-6068-0e2f3771-704f-4f00-a538-8746276dcd43/l2-cleanup-manifest.json
- .runtime/browser-l2/l2-1788537303752-6068-0e2f3771-704f-4f00-a538-8746276dcd43/playwright-results.json

## 6. SM-10～SM-11 backend acceptance、seed 与 cleanup

### 6.1 目标 acceptance scenario

最新受管 backend acceptance/Testcontainers run：

~~~
runId=r5-tc-1788513077533-56187
status=PASS
business=PASS
cleanup.status=PASS
firstFailure=null
lastKnownGood=CLEANUP
brokenBoundary=null
measurementEvidence.status=PASS
measurementEvidence.verificationMode=ACCEPTANCE
measurementEvidence.operationSet.expected=268
measurementEvidence.operationSet.observed=268
missing=[]
extra=[]
drift=[]
~~~

该 run 是全仓 backend acceptance 运行；从同一 backend-acceptance-result.jsonl.gz 按本批 15 个 source scenario 精确提取的目标结果如下：

| 目标场景 | CONTRACT | BUSINESS | STATUS |
| --- | --- | --- | --- |
| sales-menu.store-scope-and-channel-eligibility | PASS | PASS | PASS |
| sales-menu.collection-lifecycle-and-multi-activation | PASS | PASS | PASS |
| sales-menu.copy-current-draft-boundary | PASS | PASS | PASS |
| sales-menu.ordered-sections-and-items | PASS | PASS | PASS |
| sales-menu.shape-specific-sale-definition | PASS | PASS | PASS |
| sales-menu.display-media-owner-transaction | PASS | PASS | PASS |
| sales-menu.publish-frozen-effective-view | PASS | PASS | PASS |
| sales-menu.publish-blockers | PASS | PASS | PASS |
| sales-menu.inventory-availability-matrix | PASS | PASS | PASS |
| sales-menu.manual-sale-status-and-restore | PASS | PASS | PASS |
| sales-menu.operation-record-cursor | PASS | PASS | PASS |
| sales-menu.command-idempotency-and-cas | PASS | PASS | PASS |
| sales-menu.generated-route-contract | PASS | PASS | PASS |
| business-channel.sales-menu-eligible-cursor | PASS | PASS | PASS |
| asset.sales-menu-image-lifecycle | PASS | PASS | PASS |

目标 15 个场景不是用全仓 99 个 scenario 总数替代；全仓 run 的 business/cleanup 与目标行的逐场景结果分别保留。

### 6.2 完整 seed

r5-full parent：

~~~
runId=complete-seed-4ef512cf-e50a-4c51-80d2-f911c38bf69a
profile=r5-full
business=PASS
cleanup=PASS_PRESERVED_DEV_STATE
firstFailure=null
stageOrder=owner-command -> external-collaboration-business-channel -> catalog-inventory -> sales-menu
~~~

四个 parent stage 均完成；业务与清理分开记录。组件摘要：

| stage | business | cleanup | duration |
| --- | --- | --- | ---: |
| owner-command | PASS | PASS_NO_PERSISTENT_SEED_PROCESS | 22,971 ms |
| external-collaboration-business-channel | PASS | PASS_PRESERVED_DEV_STATE | 5,804 ms |
| catalog-inventory | PASS | PASS_PRESERVED_DEV_STATE | 193,808 ms |
| sales-menu | PASS | PASS_PRESERVED_DEV_STATE | 41,827 ms |

SalesMenu child report .runtime/r5/seed/sales-menu/sales-menu-seed-0533d518-6b1f-4a89-8548-0bd7bc537281/seed-report.json 记录：

~~~
parentSeedRunId=complete-seed-4ef512cf-e50a-4c51-80d2-f911c38bf69a
stageId=sales-menu
business=PASS
cleanup=PASS_PRESERVED_DEV_STATE
firstFailure=null
noDirectDatabaseWrites=true
apiCallCount=237
reportedApiCallCount=237
unmatchedHttpEvents=[]
unmatchedDatabaseEvents=[]
nonApiStageIds=[]
endpointGroupCount=26
~~~

seed 通过 owner command/readback 和 API 执行链建立 21 个 menu、21 个 primary item、6 个库存可用性对象及媒体/菜单/操作记录相关事实；不把 SalesMenu seed 误报为 UAT 或生产数据准备。

## 7. 11 维实现对账

作者在写入本证据前重新对读需求、IA、交互设计、implementation design/plan、命中项目记忆与 owning source；以下是当前源码/生成物/动态产物的对账结果。正式 independent implementation review 仍单独记录，不由本表替代。

| 维度 | 当前对账 | 证据类别 |
| --- | --- | --- |
| 行为 | 菜单、分区、商品、媒体、发布、启停、复制、恢复等行为与批准需求一致 | 源码 + acceptance + L2 |
| 形态/表单 | 单页工作台、Drawer/Modal、编辑器、列表与详情形态与 IA/交互一致 | 源码 + focused |
| 动作 | 31 operation、19 command 与用户动作/owner command 对齐 | contract + acceptance + L2 |
| 关系 | STORE scope、channel eligibility、menu-section-item、catalog/inventory/media 关系保持 owner 边界 | backend + frontend + seed readback |
| 位置 | operations-admin route 与既有模块/foundation surface 位置一致 | 源码 + 静态 |
| 用户可见文案 | 错误、空态、状态与销售菜单术语按批准材料实现 | 源码 + focused |
| 限制 | 分页、shape-specific sale definition、publish blocker、CAS/idempotency 与权限限制保留 | contract + acceptance + L2 |
| 状态/控制 | draft/published、manual sale status、activation、loading/failed/empty、dirty close 控制分离 | 源码 + acceptance + L2 |
| 失败/恢复 | typed problem、重试、冲突/非空删除/删除后读取等负向路径保留 | acceptance + L2 |
| 可访问性/焦点 | Drawer/Modal close、真实 action node、稳定 testId 与既有控件模式对齐 | 源码 + focused + L2 join |
| 数据源/失效边界 | currentData、cursor stack、RTK tag/invalidation 与 owner readback 边界对齐 | 源码 + acceptance + L2 |

页面 DEV 可见性不在上述结论的批准范围内，按 Dexter 裁定排除；该排除不等于宣称 DEV/UAT 可见性已验证。

## 8. 永久 source binding

L2 repository-byte-binding.json：

~~~
scope=apps-backend-and-apps-frontend-input-files-excluding-managed-runtime-and-build-output
includedDirectories=[apps/backend, apps/frontend]
fileCount=1459
byteCount=12564616
apps/terminal fileCount=0
outside apps/backend/apps/frontend fileCount=0
bindingDigest=f48164a73ff983f2e23e3321de3945a8793aebb148c3157d7c8e9778e5813a39
recomputedBytes=12564616
mismatchCount=0
~~~

绑定文件清单逐项重算后字节数与摘要一致；当前关键 SalesMenuPage.tsx、salesMenuTestIds.ts、sales-menu.spec.ts、SalesMenuPage.static.test.ts 均与绑定快照一致。该范围是永久约束，不因其他 agent 是否读写 terminal 或其他工程文件而扩大。

## 9. cleanup 与未宣称边界

cleanup 单独判定：

- backend Testcontainers run：cleanup.status=PASS，remote process/workspace、Testcontainers containers/volumes 均 PASS。
- browser L2：l2-cleanup-manifest.json 为 business=PASS、cleanup=PASS、cleanupErrors=[]。
- seed parent/children：cleanup=PASS_PRESERVED_DEV_STATE，明确是保留受管 DEV 状态的正常 seed cleanup 语义。
- 当前 .runtime/r5/run-manifest.json 不存在 active manifest；不据此推断或停止任何未被受管 manifest 明确拥有的进程。

本证据不宣称：

- UAT、部署、生产切流、终端/POS/扫码端或页面可见性完成；
- 生产环境 owner 逻辑已经被全产品验收；
- 历史 review 的 NO-GO 被回写或删除；
- FRAMEWORK_ONLY committed profile 本身等于 active browser run；active set 的证明来自同一 run readiness/execution/join artifacts。

## 10. 正式 implementation review 状态

本证据建立并已收口新的正式 review cycle：

~~~
REVIEW_CYCLE_ID=SALES-MENU-SM06-SM12-IMPLEMENTATION-20260905
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
status=AUTHOR_CLOSED_AFTER_FINAL_REVIEW_FINDING_REPAIR
~~~

独立 review 记录见 doc/review/platform/2026-09-05-v2s-sales-menu-sm06-sm12-implementation-review-codex.md：Round 1 为 NO-GO（0/2/1），Round 2 final 为 NO-GO（0/1/0），唯一剩余计划状态 finding 已由主 agent 修复；该 review cycle 已达到两轮上限，未伪称最后文档修复获得第三轮 reviewer GO。当前 evidence 按作者处置收口，Claude 的外部 review handoff 见 doc/review/platform/2026-09-05-v2s-sales-menu-sm06-sm12-implementation-review-request-claude.md。
