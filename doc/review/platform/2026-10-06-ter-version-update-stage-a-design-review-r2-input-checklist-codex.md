# 阶段 A DESIGN R2 输入清单

REVIEW_CYCLE_ID=TER-UPDATE-A-DESIGN-20261006
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewer=/root/update_design_r2
ROUND_FINAL_DECISION=SELF_DECIDED

主agent转录独立reviewer返回的读取记录。仓根catering-v2s，fresh只读；未写文件、运行仓库脚本/生成/编译/测试/verify/DEV/设备，未读.runtime或运行evidence，未联系在途Codex。
顺序：入口/记忆/规范/模板→原需求讨论/六目标→当前source/官方API→冻结finding/verdict/SHA→R1/intake对照。R1 checklist只作导航；早期检索曾显示intake路由/hash元数据，未使用其findings。冻结后作者通知规范前置修订，一次补充定位也显示修订；不构成修后独立review，不改变冻结结论。

## 冻结六文件

| 文件 | SHA256 |
| --- | --- |
| `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md` | `74ae1fc6315c450839420eb799dfce3df6d7cf521beb0b112eddcaae3b12ab24` |
| `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-plan-claude.md` | `f32d308ec97bb6ecc934ab63cd3977836c903286cb6ffbd55c62af08652c2f92` |
| `doc/plans/platform/2026-10-06-ter-version-update-stage-a-source-and-api-appendix-claude.md` | `760529efaefbc43ba61bf00f9d403ed98453b6b4bf7bb43a8d5081dc68e698af` |
| `doc/decisions/2026-10-06-ter-local-update-journey-claude.md` | `12573920fd97b4c4ec5a67516a748f3e973d0dd435ae028b83b6ecfe9d337faa` |
| `doc/decisions/2026-10-06-ter-local-update-ia-claude.md` | `ed422efd4a13e1e131b570cd976d7af9ac23f4a382888b243144d6eb5df06025` |
| `doc/decisions/2026-10-06-ter-local-update-ui-interaction-claude.md` | `61a4e6692893f23275c0e51c3912f69109d2539ee25c153d1e23b7e215c357f7` |

## 执行入口

AGENTS.md、CLAUDE.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md、scripts/README.md全文已读；.agents/skills/cs-review/SKILL.md、cs-memory-recall/SKILL.md全文已读并应用；project-memory/index.md与deterministic-context-only全文已读。全局memory仅导航，断言重新打开本仓source。
实际六维导航：task-kind=design，domain=platform，consumer-face=backend，owner=frontend-platform，impact=architecture，trigger=task-start。未执行query；backend只是当前词汇导航，不新增后台范围。

## 全部22篇路由原文（均全文已读）

- `project-memory/decisions/confirmed-business-language-corpus.md`。
- `project-memory/decisions/http-crud-efficiency-design-redlines.md`。
- `project-memory/decisions/owner-read-model-and-lifecycle-standard.md`。
- `project-memory/kernel/01-workspace-and-authorization.md`。
- `project-memory/kernel/02-service-shape-and-owner.md`。
- `project-memory/kernel/03-transaction-data-and-dependencies.md`。
- `project-memory/kernel/04-contract-consumer-and-admin.md`。
- `project-memory/kernel/05-evidence-runtime-and-git.md`。
- `project-memory/kernel/06-heritage-and-change.md`。
- `project-memory/operations/business-corpus-adoption-and-read-policy.md`。
- `project-memory/operations/business-corpus-parked-domain-intake.md`。
- `project-memory/pitfalls/designing-from-conversation-not-system.md`。
- `project-memory/pitfalls/invisible-dimension-drifts-at-implementation.md`。
- `project-memory/pitfalls/platform-detail-reverse-inference.md`。
- `project-memory/practices/backend-acceptance-route-fixture-oracle-integrity.md`。
- `project-memory/practices/collection-boundary-modes.md`。
- `project-memory/practices/ordering-only-for-consumer-facing.md`。
- `project-memory/operations/terminal-coding-standard.md`。
- `project-memory/decisions/terminal-architecture-and-stack-rulings.md`。
- `project-memory/decisions/terminal-build-order-and-batches.md`。
- `project-memory/practices/ter-input-and-virtual-keyboard-usage.md`。
- `project-memory/practices/third-party-library-official-source-verification.md`。

## 需求、规范与sourceRefs

正式需求2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md及讨论稿2026-10-04-ter-version-and-js-apk-update-requirements-discussion-claude.md全文已读。
terminal-coding-standard、frontend-coding-standard、foundation-charter、third-party-library-usage-standard、review-standard、implementation-task-template全文已读。四模板（journey-decision、ia-design、ui-interaction-design、implementation-design）全文已读。
以下doc/decisions原文全文已读：2026-07-25-v2s-independent-subagent-adversarial-review-governance；2026-07-24-v2s-solution-reasonableness-review-policy；2026-07-24-v2s-verification-governance；2026-09-25-v2s-roadmap-mechanism-retirement；2026-07-25-v2s-agent-coordination-and-control-boundary；design-governance-batch-1与batch-1-5；frontend-asset-carry-over-first与frontend-foundation-consumption-rule；2026-07-27-v2s-identified-finding-generalization-and-prevention；2026-09-26-v2s-terminal-activation-service-shape；2026-07-29-v2s-observability-and-acceptance-standard（均.md）。冻结logging-and-debugging-foundation-standard原文全文已读，旧退役控制面不恢复。
Corpus本机更新/版本/APK/HOT/Hermes/installer/启动失败没有已确认业务条目命中，NO_CORPUS_ENTRY_MATCHED。未展开Corpus G1–G12原业务全文；不将门店/空间背景词当新增事实/授权。
backendCRUD/DB性能/邀请等不适用历史sourceRefs未展开；旧terminal skeleton/build-order只读适用架构/约束段，未全文重读历史安装/旧授权。退役冻结manifest/standards-coverage/compliance-control不读不复算。无关历史evidence和在途automation会话/运行证据未读。未读项不用于结论。

## 当前owning source核验

| 来源族 | 实际范围 |
| --- | --- |
| 旧HotUpdatePort | 类型、七方法unavailable、PlatformPorts/result/descriptor；apps/terminal全部hotUpdate消费搜索，Web/Android assembly、integration、projection/testSupport/diagnostics/测试 |
| state/reset | slice/persistence、createStateRuntime retain、defineStateRuntimeSlice校验、persistenceEngine flush/reset/namespace；server-config现行唯一例外；Runtime/TDC/topology三reset |
| Android | appControl reload、NativeLoadingRegistry全文、TSloading/assembly；两App MainApplication/Gradle/package/lazyHost/devsupport；Expo autolink Package接口 |
| PRIMARY | integrationAssembly.tsx:500–690，hydration/runtime.start/contentReady/测量/complete/failure |
| 已安装API | Expo57.0.18/core57.0.14/RN0.86.3 package与公开Host/currentContext/load源；Asset/RN资源解析；不冒称实际加载 |
| 自动化 | runner phase/CLI/DEVhook、managedRun/androidBuild/driver/server/managedActivation角色传递；agent README/protocol/runtimeRequestHandler/commands/selectors/session |
| OS例外 | automation正式需求R10仅系统install/settings的driver UiAutomator；不恢复旧TER旅途 |

大source仅相关owning区段及调用链，不宣称全部runner/测试/历史源码全文读取。
官方一手读取：Expo c3739f09b6a7620729ce7e305e88a2ec8bc79c3c ReactHostFactory；core c300d2cc60c9e684e64f48d9bc90ea18a571d01d ReactNativeHostHandler；RN v0.86.3 ReactHostImpl；Android PackageInstaller.SessionInfo。精确链接在附件。接口核验不代替native/资源/installer/compat proof。
独立冻结后全文读R1 report与intake，R2作者后置修订不纳入本轮关闭判断。

READ_ONLY=YES；FILE_WRITES=NONE；REPOSITORY_SCRIPT_EXECUTION=NONE；DYNAMIC_EXECUTION=NOT_RUN；RUNTIME_EVIDENCE_READ=NONE；AUTHOR_CONCLUSION_USED_BEFORE_INDEPENDENT_FREEZE=NO；FROZEN_VERDICT=NO-GO；FROZEN_M/S/N=0/1/0；R2_HARD_STOP=YES。
