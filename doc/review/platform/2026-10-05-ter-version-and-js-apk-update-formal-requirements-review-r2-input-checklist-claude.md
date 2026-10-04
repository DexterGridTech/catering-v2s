# TER 更新正式需求 · R2 输入清单

来自 `/root/ter_update_formal_r2` 完成时返回的真实范围，主agent归档，不由主agent代读。cycle/round/SHA见同名report；正式288行、讨论638行全文，初次截断均补读。只读，无文件写入/动态/.runtime/Git。

## A. 全文输入

AGENTS、CLAUDE、PLATFORM-BLUEPRINT、doc/platform/README、scripts/README、project-memory/index及全部六kernel、cs-review、review-standard。四模板journey-decision/ia-design/ui-interaction-design/implementation-design全文逐节，适用性见report§5。

全文标准：terminal-coding、frontend-coding、backend-coding、foundation-charter、third-party-library-usage、implementation-task-template及project-memory/operations/verification-governance。

相关decision全文（前缀`doc/decisions/`）：

```text
2026-07-24-v2s-verification-governance.md
2026-07-24-v2s-solution-reasonableness-review-policy.md
2026-07-25-v2s-independent-subagent-adversarial-review-governance.md
2026-07-25-v2s-agent-coordination-and-control-boundary.md
2026-07-25-v2s-confirmed-business-corpus-memory-adoption.md
2026-07-25-v2s-design-governance-batch-1.md
2026-07-25-v2s-design-governance-batch-1-5.md
2026-07-25-v2s-frontend-asset-carry-over-first.md
2026-07-25-v2s-frontend-foundation-consumption-rule.md
2026-09-25-v2s-roadmap-mechanism-retirement.md
2026-09-26-v2s-terminal-activation-service-shape.md
2026-09-28-ter-third-party-usage-remediation.md
2026-10-02-v2s-terminal-activation-batch-3-amendment-proposal.md
```

另全文读`doc/review/platform/2026-08-13-v2s-compliance-control-retirement-decision-claude.md`。扫描`doc/decisions/*.md` H1标题定位，不声称全体decision全文读取。

## B. 六维路由原文

只读query：`scripts/memory/query --task-kind design --domain platform --consumer-face backend --owner platform --impact architecture --trigger review`。30项，六kernel及24篇全部原文，截断补读：

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

## C. sourceRef部分/N/A

| 材料 | 真实范围 |
| --- | --- |
| 2026-07-24 single-deployable service-shape | §1–3服务/owner/事务/读/数据/事件/edge/前端边界部分；窄supersede另核验 |
| 2026-07-24 cross-generation-business-corpus-draft | G-01～05部分；商品/库存不重裁 |
| 2026-08-27 base-1 requirements | §0/1及§3/3.1事实/生命周期部分；历史实施清单N/A |
| 2026-08-28-newposv1-package-analysis-claude/00-ter-build-order | §4B.1/4B.2/4B.10部分；端口/Web/stack适用，旧建设状态非现状证明 |
| 2026-09-25 activation requirements | D-51全文，其他标题/命中导航；绑定/连接边界以现行标准/accepted shape/本稿核验 |
| 2026-08-29 terminal-skeleton requirements | 仅标题；骨架旧验收N/A，不依其状态结论 |
| 2026-07-24 carryover-manifest | 仅标题；旧控制面/复算N/A，现行charter/模板/退役已读 |
| catalog/BOM/商品/制作IA交互 | N/A，不改相应业务 |
| M1扩展/邀请/RM1性能及旧后台review | N/A，无相应修改/效率声称，通用规范当前重开 |
| 2026-08-18 external-collaboration spec | N/A，产品不在范围；通用禁反推memory已读 |

不冒称上述部分材料全文；本期后续设计义务没有以N/A跳过。

## D. 真实源码范围

全文：两application package.json/app.json/MainApplication；platform-ports types/hotUpdate/appControl；application/base/android androidPlatform/nativeLoadingCapability；TerminalAppControlModule/TerminalNetworkModule/TerminalNativeLoadingRegistry（截断补读）；ScreenReadyBoundary；Runtime createRuntimeLifecycle/createStateSubscription；sample-member-registry module；createTopologyStateSyncController；ui/base/input README；已安装ExpoReactHostFactory、RN DefaultReactHost/JSBundleLoader。

部分（完整仓根路径以正式稿§16及report§3定位）：

| 来源 | 范围 |
| --- | --- |
| 两application android/app/build.gradle | bundle/工具、release/debug、版本/签名/Hermes依赖相关段；不冒称全文 |
| integrationAssembly.tsx | 560–650及readiness/subscription导航 |
| runtime createRuntime.ts | 275–310及订阅/生命周期导航 |
| state createStateRuntime.ts | 135–200 |
| state persistenceEngine.ts | 300–450及queue/flush导航 |
| state types/slice.ts | 45–80 |
| PlatformAssetService.java | 1115–1166及stage/类型命中 |
| RN ReactHostImpl.kt | 1140–1190及reload/loadJSBundle导航 |
| Expo/RN package.json | 版本字段；未执行native解析 |

## E. 结论后读取与边界

作者intake：独立verdict后全文1–25；R1report仅20–52及finding/标题导航，不声称全文；R1checklist未读。各hash快照和顺序见report。

未读.runtime；新功能动态/生成/编译/测试/verify/环境全部NOT_RUN；reviewer写入0。第二轮独立reviewer给出SELF_DECIDED最终综合，禁止第三轮。
