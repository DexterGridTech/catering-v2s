# TER 更新正式需求 · R1 输入清单

来源：`/root/ter_update_formal_r1` 结束时返回的真实已读范围，主agent归档；不是主agent代读或作者verdict。`reviewerKind=INDEPENDENT_SUBAGENT`，cycle/round见同名report。正式输入SHA `3a7fa3cb70aeadeeab5c6a8866a7fe8f46b792e3661f813de68d5a59994545b4`。正式稿284行、讨论稿638行全文已读并补截断段。

## 1. 核心输入（已读）

AGENTS（会话完整原文＋回读仓内相关段）、CLAUDE、PLATFORM-BLUEPRINT、doc/platform/README、scripts/README、project-memory/index；全部六kernel：01-workspace-and-authorization、02-service-shape-and-owner、03-transaction-data-and-dependencies、04-contract-consumer-and-admin、05-evidence-runtime-and-git、06-heritage-and-change；cs-review、review-standard、verification-governance memory及2026-07-24 decision、2026-07-25 independent review治理。

Dexter原文：“那请生产完整的需求文档并且完成两轮对抗性review”。只静态需求及review，无实现/运行/联系Codex。reviewer未写文件，未读.runtime，未运行动态或Git。

## 2. 六维路由（原文已读）

`scripts/memory/query --task-kind design --domain platform --consumer-face backend --owner platform --impact architecture --trigger review`；亲算30 refs，六kernel＋以下24篇：

```text
project-memory/decisions/confirmed-business-language-corpus.md
project-memory/decisions/deterministic-context-only.md
project-memory/decisions/distributed-topology-is-not-current.md
project-memory/decisions/http-crud-efficiency-design-redlines.md
project-memory/decisions/independent-subagent-adversarial-review.md
project-memory/decisions/owner-read-model-and-lifecycle-standard.md
project-memory/operations/business-corpus-adoption-and-read-policy.md
project-memory/operations/business-corpus-parked-domain-intake.md
project-memory/operations/backend-readability-refactor.md
project-memory/pitfalls/browser-route-data-scope-drift.md
project-memory/pitfalls/designing-from-conversation-not-system.md
project-memory/pitfalls/invisible-dimension-drifts-at-implementation.md
project-memory/pitfalls/platform-detail-reverse-inference.md
project-memory/practices/backend-capability-lookup.md
project-memory/practices/collection-boundary-modes.md
project-memory/practices/failure-condition-names-the-wrong-shape.md
project-memory/practices/ordering-only-for-consumer-facing.md
project-memory/practices/read-model-granularity.md
project-memory/practices/set-interaction-not-n-times-single.md
project-memory/operations/terminal-coding-standard.md
project-memory/decisions/terminal-architecture-and-stack-rulings.md
project-memory/decisions/terminal-build-order-and-batches.md
project-memory/practices/ter-input-and-virtual-keyboard-usage.md
project-memory/practices/third-party-library-official-source-verification.md
```

## 3. decision/规范与 sourceRefs

128个`doc/decisions/**/*.md`标题逐项列出；不宣称128篇全文已读。以下相关decision全文已读（路径前缀均`doc/decisions/`）：

```text
2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md
2026-07-24-v2s-solution-reasonableness-review-policy.md
2026-07-24-v2s-verification-governance.md
2026-07-25-v2s-agent-coordination-and-control-boundary.md
2026-07-25-v2s-confirmed-business-corpus-memory-adoption.md
2026-07-25-v2s-design-governance-batch-1.md
2026-07-25-v2s-design-governance-batch-1-5.md
2026-07-25-v2s-frontend-asset-carry-over-first.md
2026-07-25-v2s-frontend-foundation-consumption-rule.md
2026-07-25-v2s-independent-subagent-adversarial-review-governance.md
2026-07-27-v2s-identified-finding-generalization-and-prevention.md
2026-07-29-v2s-observability-and-acceptance-standard.md
2026-09-25-v2s-roadmap-mechanism-retirement.md
2026-09-26-v2s-terminal-activation-service-shape.md
2026-09-28-ter-third-party-usage-remediation.md
2026-10-02-ter-terminal-activation-interaction-pair-topology-journey-codex.md
2026-10-02-v2s-terminal-activation-batch-3-amendment-proposal.md
```

| SourceRef | 已读适用范围（不冒称全文） |
| --- | --- |
| carryover manifest | B.1/B.6/D.7/D.8授权、性能、上下文、日志 |
| base-1 requirements | §1.1～1.7、§3/3.1结构化事实/生命周期 |
| terminal activation requirements | §11.20 D-44/D-45，当前accepted拓扑另读decision |
| TER build-order 原材料 | §4B.1/7/9b/10/11 |
| terminal skeleton requirements | §6.2/3/4、§9.0～2，骨架不证明能力 |
| compliance retirement | 全文；不复活旧台账 |
| foundation-charter | owner/授权、集合、KISS/复用、分母、声称、变更/产品禁反推适用章 |
| backend-coding-standard | §2-A～2-I |
| frontend-coding-standard | §3-D/E/F/K-1～10 |
| terminal-coding-standard | TR-01～09/11/16/17，§2/3/4-D/E/F适用原文 |
| third-party-library-usage-standard | 全文 |
| implementation-task-template | 设计三列、可证伪、双读/授权、证据档位适用段 |
| frozen logging standard | 全文；运行规则仅后续边界 |

sourceRefs N/A：CIPG/catalog/BOM/单位规格及UI无本期业务事实修改；extension/invitation具体流程不适用；历史performance/RM1 evidence无本轮性能声称；外部协作业务流程不适用（通用禁反推已读charter）；旧roadmap不授权；Doris具体生命周期/其他CBS业务不改；日志标准所引旧spec/plan未用于新底座或运行证明，不冒称已读。

## 4. Corpus

confirmed-business-language-corpus全文已读。G-01/02及G-03/04/05/05A/05B/07/08/10：空间集团、项目门店、角色节点读范围/关联候选/写grant、生命周期与URL边界。不得从可读项目推导写能力；不得从corpus发明bundleVersion/本机admin/副机更新产品行为，后者依据本专项裁决。

## 5. 四模板全文已读，逐节适用性

“有”为正式需求承载目标事实，不宣称模板实例已交付。未列实现/逐屏参数均不是本阶段缺项：

| 模板逐节 | 判定与理由 |
| --- | --- |
| Journey §1 | 有：§0授权/元数据；正式Journey ID N/A |
| Journey §2 | 有：§0目标、R-02/04/05/11/15 actor任务 |
| Journey §3 | owner/资格前提已表达；逐actor正式前提链N/A，尚非Journey |
| Journey §4/5 | 有：范围禁推/corpus |
| Journey §6/6.1 | 有：后续UI义务；逐screen N/A |
| Journey §7 | 原话裁决有，正式Journey看图/实施批准N/A |
| IA §1 | 正式IA元数据N/A，未进入IA |
| IA §2.1/2.1.1 | 控件/容器/逐screen N/A；用户目标及失败结果已有需求 |
| IA §2.2 | 数据/权限/失败恢复与验收观察已有；IA维度逐行N/A |
| IA §3 | 需求边界有，逐IA-ID共用规则N/A |
| IA §4 | 需求失败有，逐HTTP/界面映射N/A |
| IA §5/6 | 工件交叉矩阵/IA完成状态N/A |
| UI §1/1.1/1.2 | 两后台/TER分工及后续义务有；逐screen声明 N/A |
| UI §2/3/4 | 正式interaction map、Heritage盘点、线框/testId/roster/控件依赖/字段/搜索子节N/A |
| UI §5/6 | 用户任务/策略及失败有；逐可见操作矩阵N/A |
| UI §7/8 | actor/owner边界有，逐screen及Heritage矩阵N/A |
| UI §9/10 | demo/看图 N/A |
| 详设 §0/1 | 授权/目标/最小替代已有；详设实例N/A |
| 详设 §2/4 | CP总览/门控N/A |
| 详设 §3/3a | 复用/第三方OPEN已有；横切 exact-set/控件准入N/A |
| 详设 §5/6/7/8/9/9a/9b | owner/行为需求已有；精确operation/跨写/传递/判定点/API/同步文件/锚点矩阵N/A |
| 详设 §10/10b各子节 | migration/seed全集与执行N/A，未授权实施 |
| 详设 §11/11a | 有R/V最低场景；fixture/runner/文件精确映射留详设 |
| 详设 §12/13 | 有工程OPEN/授权停机边界 |
| 详设 §13b/13c/14 | 实施对账/执行proof/交付自查N/A，本轮只需求 |

## 6. Owning source真实已读范围

路径相对`apps/terminal/`：platform-ports/types/hotUpdate及androidPlatform、nativeLoadingCapability、sample-member-registry module、createStateSubscription、runtimeInstanceMode全文；TerminalAppControlModule全文；TerminalNetworkModule限长UTF-8/代理实际段；nativeLoadingRegistry Activity gate及hide段；ScreenReadyBoundary failure/ready及integrationAssembly成功失败接线；SurfaceRoot/InputSurfaceFrame适用段；Runtime lifecycle/state runtime/persistence flush/hydration同步；topology state sync声明/方向/旧连接拒绝；两App package/app.json/Gradle输入与sample-terminal MainApplication全文。

CBS PlatformAssetController全文，PlatformAssetService MIME/suffix/限额/materialize及对象职责段；已安装ExpoReactHostFactory全文、RN JSBundleLoader file/asset段、ReactNativeHostHandler全文。具体完整路径由report/正式稿来源表定位，不声称新owner/native更新器已存在。

剩余OPEN：新UpdatePort/owner/native加载记录、nativeHermes/SDK解析、资源与真实installer/设备条件。全部动态NOT_RUN；没有从源码API存在推导能力PASS。
