# TER 更新需求与 A/B/C · R1 reviewer 输入清单

来源：fresh `/root/update_staged_requirements_r1` 的实际已读声明及同轮勘误，主 agent 归档；不是主 agent 代读或 author verdict。cycle=`TER_UPDATE_STAGED_REQUIREMENTS_ABC_2026-10-05`，round=1，limit=2，reviewerKind=INDEPENDENT_SUBAGENT。原始结论、SHA、授权、历史导航暴露与勘误见同名 report。

## 1. 完整入口、规范与模板

```text
AGENTS.md
CLAUDE.md
PLATFORM-BLUEPRINT.md
doc/platform/README.md
scripts/README.md
.agents/skills/cs-review/SKILL.md
project-memory/index.md
doc/platform/review-standard.md
doc/platform/terminal-coding-standard.md
doc/platform/third-party-library-usage-standard.md
doc/platform/implementation-task-template.md
doc/platform/frontend-coding-standard.md
doc/platform/backend-coding-standard.md
doc/platform/foundation-charter.md
doc/decisions/templates/journey-decision-template.md
doc/decisions/templates/ia-design-template.md
doc/decisions/templates/ui-interaction-design-template.md
doc/decisions/templates/implementation-design-template.md
doc/plans/platform/2026-10-04-ter-version-and-js-apk-update-requirements-discussion-claude.md
doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md
```

Dexter 本次原话与前次新增 A/B/C 范围原话通过 reviewer prompt 提供，归档于 report §0。无实施/动态授权，不联系 Codex。

## 2. 六维路由与全部原文

实际执行 `scripts/memory/query --task-kind design --domain platform --consumer-face backend --owner platform --impact architecture --trigger review`。30 个命中原文完整读取：

```text
project-memory/decisions/confirmed-business-language-corpus.md
project-memory/decisions/deterministic-context-only.md
project-memory/decisions/distributed-topology-is-not-current.md
project-memory/decisions/http-crud-efficiency-design-redlines.md
project-memory/decisions/independent-subagent-adversarial-review.md
project-memory/decisions/owner-read-model-and-lifecycle-standard.md
project-memory/kernel/01-workspace-and-authorization.md
project-memory/kernel/02-service-shape-and-owner.md
project-memory/kernel/03-transaction-data-and-dependencies.md
project-memory/kernel/04-contract-consumer-and-admin.md
project-memory/kernel/05-evidence-runtime-and-git.md
project-memory/kernel/06-heritage-and-change.md
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

额外完整读 `project-memory/operations/verification-governance.md`。Corpus 的空间集团、项目门店、平台/运营身份、读取范围与写 capability 分离命中 G-01/G-02/G-05A；不从 corpus 发明软件版本、更新策略或副机服务端对象，产品裁决来源为本专项原话。无未决 corpus 冲突。

## 3. 相关 decision 全文及适用 sourceRef

已列 doc/decisions 全目录文件/标题；不宣称无关正文全读。以下全文已读：

```text
doc/decisions/2026-07-24-v2s-verification-governance.md
doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md
doc/decisions/2026-07-24-v2s-solution-reasonableness-review-policy.md
doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md
doc/decisions/2026-07-25-v2s-confirmed-business-corpus-memory-adoption.md
doc/decisions/2026-07-25-v2s-frontend-foundation-consumption-rule.md
doc/decisions/2026-07-25-v2s-design-governance-batch-1.md
doc/decisions/2026-07-25-v2s-frontend-asset-carry-over-first.md
doc/decisions/2026-07-25-v2s-agent-coordination-and-control-boundary.md
doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md
doc/decisions/2026-09-25-v2s-roadmap-mechanism-retirement.md
doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md
doc/decisions/2026-10-02-v2s-terminal-activation-batch-3-amendment-proposal.md
```

| SourceRef | 实际已读范围与边界 |
| --- | --- |
| `doc/review/platform/2026-08-13-v2s-compliance-control-retirement-decision-claude.md` | 全文，适用治理，不是本轮作者 intake。 |
| `doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md` | B.1～B.6，129–235；D.1～D.5，268–302；D.8，341–348。只读适用语义，不复活 manifest/package/hash 准入。 |
| `doc/review/platform/2026-07-24-v2s-cross-generation-business-corpus-draft.md` | §7.1～7.5，554–619；§7.10，679–695。当前 G-05A 更新裁决优先。 |
| `doc/review/platform/2026-08-28-newposv1-package-analysis-claude/00-ter-build-order-claude.md` | 标题；§4 B0～3，212–322；B11/Q04，695–727；B10/T1～13，810–933。未宣称全文。 |
| `doc/plans/platform/2026-08-29-v2s-terminal-skeleton-requirements-claude.md` | 标题；§1/2，14–69。历史骨架不能授权或证明当前能力。 |

其他 catalog/CIPG、完整 RM1 evidence、外部协调、Base-1 特定实例 sourceRef 本次不修改其业务事实，未读正文、不作为证明；通用约束已读取路由原文、领域规范及 charter。

## 4. 真实源码范围（已纠正三条 native 路径）

全文读取：

```text
apps/terminal/kernel/base/platform-ports/src/types/hotUpdate.ts
apps/terminal/application/base/android/src/foundations/androidPlatform.ts
apps/terminal/application/base/android/src/foundations/nativeLoadingCapability.ts
apps/terminal/application/base/android/android/src/main/java/com/catering/v2s/terminal/application/base/android/TerminalAppControlModule.kt
apps/terminal/application/base/android/android/src/main/java/com/catering/v2s/terminal/application/base/android/TerminalNetworkModule.kt
apps/terminal/application/base/android/android/src/main/java/com/catering/v2s/terminal/application/base/android/TerminalNativeLoadingRegistry.kt
apps/terminal/kernel/base/runtime/src/foundations/createRuntimeLifecycle.ts
apps/terminal/kernel/base/runtime/src/foundations/createStateSubscription.ts
apps/terminal/kernel/base/state/src/foundations/createStateRuntime.ts
apps/terminal/kernel/base/state/src/foundations/persistenceHydration.ts
apps/terminal/kernel/feature/sample-member-registry/src/application/module.ts
apps/terminal/kernel/base/terminal-data-client/src/features/commands/terminalDataClientCommands.ts
apps/terminal/kernel/base/terminal-data-client/src/application/createTerminalDataClientModule.ts
contracts/protocol/terminal-connection-protocol.json
apps/terminal/kernel/feature/store-basic/src/application/module.ts
apps/terminal/kernel/feature/store-basic/src/selectors/selectors.ts
```

沿调用链读取的片段，不宣称整文件全文：

```text
apps/terminal/ui/base/integration-assembly/src/foundations/integrationAssembly.tsx:550–660
apps/terminal/ui/base/render/src/components/ScreenReadyBoundary.tsx:80–145,215–300
apps/terminal/kernel/base/runtime/src/application/createRuntime.ts:350–435
apps/terminal/kernel/base/runtime/src/types/module.ts:55–85
apps/terminal/kernel/base/state/src/foundations/persistenceEngine.ts:65–120,301–335,410–437
apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/application/PlatformAssetService.java:260–315,1090–1180
apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts:640–750,1010–1285
apps/terminal/kernel/base/terminal-data-client/src/types/client.ts:125–185
apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/terminal/TerminalDataReadController.java:95–210
apps/terminal/kernel/feature/store-basic/src/features/actors/actors.ts:75–160,175–305,560–610
```

三条旧不存在路径的声明已经撤回；同轮真实路径补读和输入存在性核对见 report §7。全文/片段区分及历史 registry 暴露均保留，不借压缩摘要补造读取证据。未读 .runtime 或旧 rollout。

## 5. 四模板逐节适用性（reviewer 原始判断）

“有”仅表示需求阶段对应内容已有；“N/A”不表示未来完整工件通过。四模板全文已读，没有本轮应适用而缺失的槽位。

| Journey 模板节 | 状态及依据 |
| --- | --- |
| §1 元数据 | N/A：不伪造未来 Journey ID/批准；当前授权见正式需求 §0。 |
| §2 用户任务与结果 | 有：§0、R-01～15、A/B/C 目标。 |
| §3 actor 前提链 | N/A：完整 Journey 留后续；阶段前置已有 §20.2。 |
| §4 边界/禁推 | 有：§0.1、R、§18/20。 |
| §5 Corpus | 有：§0.2 和最终产品裁决；无停车域扩张。 |
| §6 UI 与后续工件 | 有：§18、B 两后台设计义务。 |
| §6.1 后台交互一致性 | N/A：完整 screen 工件未来。 |
| §7 Dexter 裁决 | N/A：不冒称未来 Journey 已批准。 |

| IA 模板节 | 状态及依据 |
| --- | --- |
| 模板说明 | N/A：不是需求字段。 |
| §1 元数据 | N/A：无 IA-ID 工件。 |
| §2 维度总览 | N/A：未来逐 IA 维度。 |
| §2.1 可见维度 | N/A：当前目标不批准页面布局。 |
| §2.2 不可见维度 | N/A：精确 operation/观察/屏幕矩阵未来；范围/权限/owner 需求已有。 |
| §2.1.1 负载容器 | N/A：尚无线框。 |
| §3 共用 IA | N/A：后续工件；§18 不豁免规范。 |
| §4 错误界面映射 | N/A：全量 typed problem/屏幕未来；需求失败语义已有。 |
| §5 交叉对账 | N/A：无批准 IA/详设可对账。 |
| §6 完成判定 | N/A：不声称 IA 完成。 |

| UI 模板节或子槽位 | 状态及依据 |
| --- | --- |
| §1 元数据 | N/A：未来 UI 工件。 |
| §1.1 强制标准 | N/A：逐 screen 未来，§18 已绑定规范。 |
| §1.2 后台一致性 | N/A：B 完整工件。 |
| Surface ownership | N/A：尚无线框。 |
| 业务语言/动态明细 | N/A：无控件 roster。 |
| owner-definition 字段 | N/A：未来适用屏幕逐项核验。 |
| §2 interaction map | N/A：后续路径图。 |
| §3 v2 页面盘点 | N/A：后续设计先盘点，当前不授权搬运。 |
| §4 线框/Screen | N/A：未进入看图确认。 |
| testId、implementation roster | N/A：不在需求阶段编造控件身份。 |
| 表单依赖图、mutation 字段矩阵 | N/A：未来输入屏幕/操作逐字段设计。 |
| 主从集合布局 | N/A：未来适用屏幕。 |
| 搜索/候选选择/查询协议 | N/A：未来实际页面和 operation。 |
| §5 状态边界 | 有：等待/未知/失败/释放/N/M 语义；逐屏表未完成。 |
| §6 操作合理性 | 有：上传/新建/启停/只读/自动更新任务；控件路径未来。 |
| §7 face/owner | 有：R-04/05/08/15；逐屏矩阵未来。 |
| §8 旧 Manifest | N/A：已退役，不恢复旧准入。 |
| §9 demo | N/A：可选且未进入 UI 工件。 |
| §10 看图结论 | N/A：不冒称看图批准。 |

| 详设模板节或子槽位 | 状态及依据 |
| --- | --- |
| 收录尺度 | N/A：本轮非实施详设。 |
| §0 元数据/授权 | 有：§0/18/20.10，无实施/动态授权。 |
| §1 目标/方案比较 | 有：§0/20.9 含替代及反例。 |
| §2 CP 总览 | N/A：未来每阶段完整计划。 |
| §3 横切机制 | N/A：逐步骤矩阵未来；owner/flush/native 边界已有。 |
| 第三方 API/行为 | N/A：A 详设必须核实际版本/官方依据，当前不冒称 loader 可用。 |
| §3a L2/testId | N/A：未来适用实施/L2 工件。 |
| §4 CP 门控 | N/A：无实施 CP。 |
| §5 operation/path/face/集合 | N/A：B 精确契约未来。 |
| §6 跨 owner 写 | N/A：方法级矩阵未来，责任方向已有。 |
| §7 声明/传递/消费 | N/A：真实接口逐行落实未来。 |
| §8 规则判定点 | 有：R 和 §20.7；方法级位置未写完。 |
| §9 API/消费者 | N/A：不冻结七方法端口。 |
| §9a 全链同步变更 | N/A：未来实际变更；§20.6 明确消费者影响。 |
| §9b 变更定位 | N/A：未开始实施。 |
| §10 迁移 | N/A：无 migration 批准。 |
| §10b seed | N/A：当前无执行，未来按实际影响。 |
| §10b.1 全集 | N/A：同上。 |
| §10b.2 两类改动 | N/A：同上。 |
| §10b.3 覆盖 | N/A：同上。 |
| §10b.4 同步 | N/A：同上。 |
| §10b.5 边界 | N/A：同上。 |
| §10b.6 前提/角色 | N/A：同上，不推导动态授权。 |
| §11 场景 | 有：§17/20.8；真实 fixture/runner 未来。 |
| §11a 判据对照 | 有：R/V 子断言及最终闭合阶段，不是动态 PASS。 |
| §12 未决项 | 有：§16、A 工程准入及 B/C 准入。 |
| §13 停机条件 | 有：关键前置未证明不能进入后阶段或全专项通过。 |
| §13b 三维对账 | 有：§20.1/20.10 明确未来义务；未执行 MATCHED。 |
| 三个维度/两个时点/理由/边界 | N/A：尚无实施结果；模板说明未来适用。 |
| §13c 逐代码对账 | 有：未来交付义务明确，无本轮完成证据。 |
| 对详设写法反向要求 | N/A：未来逐项可执行判据。 |
| §14 自查 | 有：需求/覆盖/依赖/OPEN/证据；不是实施完成。 |

## 6. 归档自查与状态

主 agent 对 reviewer 原始结论、真实补读声明及所有本清单路径做存在性核查；不能用未读/错误路径证明能力，也不能把有未来义务写成当前工件 PASS。历史导航暴露与三项勘误不隐藏，见 report §7。最终 reviewer completed，主 agent 不以等待 timeout 中断正常读取；只读 review 无受管动态资源，cleanup N/A。
