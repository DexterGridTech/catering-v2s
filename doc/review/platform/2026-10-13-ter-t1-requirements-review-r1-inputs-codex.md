# TER T1 正式需求 · R1 独立审查输入清单

REVIEW_CYCLE_ID=TER_T1_REQUIREMENTS_20261013
REVIEW_TARGET=DESIGN
DOCUMENT_KIND=FORMAL_REQUIREMENTS
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist=doc/review/platform/2026-10-13-ter-t1-requirements-review-r1-inputs-codex.md
reviewerContext=FRESH_V2S_ROOTED_READ_ONLY
reviewedObject=doc/plans/platform/2026-10-13-ter-key-code-structure-t1-formal-requirements-codex.md
reviewedObjectSha256=b6c2cb34bbe220938d2cf4bb744b336885042f9f98e94ff697662e2babe56023

## 1. 任务与只读边界

当前任务来自主 agent 提供的 Dexter 原始指派：生成 TER 重点代码结构 T1 优化的正式需求并完成对抗审查。本 reviewer 只评审正式需求的目标、范围、可达性、责任边界、验收语义与关键实现接缝，不作整批实施评审。

本轮允许纯读取命令与确定性 memory route。未新增、修改或删除文件；未运行测试、生成、编译、构建、verify、DEV、设备、Web、L2、UAT；未读取 .runtime；未执行 Git；未派生其他 agent。

## 2. 实际盲审顺序

1. 从仓根读取入口与 review skill。
2. 先读取讨论稿 §1、§11、§13.1 的原始需求、Dexter 答复及最终澄清。
3. 全文读取正式需求。
4. 回读规范、routed memory、模板与关键 owning source，独立形成 NO-GO / 0M/1S/0N。
5. 向主 agent 发出该独立初判及源码依据。
6. 此后才读取讨论稿剩余分析与源码盘点附件，对照作者材料；结论未改变。

blindReviewDeclaration=先从原始需求和当前源码形成独立 findings/verdict，再读取讨论稿剩余作者分析与盘点附件；未读取作者自审 verdict 或 finding disposition。
authorMaterialReadAfterIndependentVerdict=true

## 3. 入口与治理材料

| 输入 | 实际读取 | 结果 |
|---|---|---|
| AGENTS.md | 全文；会话同时提供执行边界原文 | READ_FULL |
| CLAUDE.md | 全文 | READ_FULL |
| PLATFORM-BLUEPRINT.md | 本仓架构、owner、生成、环境与授权边界 | READ_APPLICABLE |
| doc/platform/README.md | 全文 | READ_FULL |
| scripts/README.md | 任务恢复、TER 生成/执行、旧 runner 退役、review 与动态边界 | READ_APPLICABLE |
| .agents/skills/cs-review/SKILL.md | 全文 | READ_FULL |
| project-memory/index.md | 全文导航；全部六个 kernel 均打开 | READ_FULL |
| project-memory/decisions/deterministic-context-only.md | 全文 | READ_FULL |
| doc/platform/review-standard.md | 全文 | READ_FULL |
| doc/review/platform/independent-subagent-adversarial-review-input-checklist-template.md | 全文 | READ_FULL |
| doc/decisions/2026-07-24-v2s-verification-governance.md | 全文 | READ_FULL |
| doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md | 全文 | READ_FULL |
| project-memory/operations/verification-governance.md | 全文 | READ_FULL |
| doc/platform/third-party-library-usage-standard.md | 全文 | READ_FULL |

## 4. 六维 route 与原文

执行命令：

scripts/memory/query --task-kind design --domain platform --consumer-face operations-admin --owner platform --impact architecture --trigger task-start

查询结果仅作路径导航；未当作原文证明。全部 26 个命中原文已读取，较大组合输出发生截断后，使用分块读取补回任务适用正文：

- project-memory/decisions/confirmed-business-language-corpus.md
- project-memory/decisions/deterministic-context-only.md
- project-memory/decisions/http-crud-efficiency-design-redlines.md
- project-memory/decisions/independent-subagent-adversarial-review.md
- project-memory/decisions/owner-read-model-and-lifecycle-standard.md
- project-memory/kernel/04-contract-consumer-and-admin.md
- project-memory/kernel/05-evidence-runtime-and-git.md
- project-memory/kernel/06-heritage-and-change.md
- project-memory/kernel/02-service-shape-and-owner.md
- project-memory/kernel/03-transaction-data-and-dependencies.md
- project-memory/kernel/01-workspace-and-authorization.md
- project-memory/operations/business-corpus-adoption-and-read-policy.md
- project-memory/operations/business-corpus-parked-domain-intake.md
- project-memory/operations/execution-economics-and-failure-family-closure.md
- project-memory/pitfalls/designing-from-conversation-not-system.md
- project-memory/pitfalls/invisible-dimension-drifts-at-implementation.md
- project-memory/pitfalls/platform-detail-reverse-inference.md
- project-memory/practices/backend-capability-lookup.md
- project-memory/practices/collection-boundary-modes.md
- project-memory/practices/module-call-boundary-ownership.md
- project-memory/practices/ordering-only-for-consumer-facing.md
- project-memory/operations/terminal-coding-standard.md
- project-memory/decisions/terminal-architecture-and-stack-rulings.md
- project-memory/decisions/terminal-build-order-and-batches.md
- project-memory/practices/ter-input-and-virtual-keyboard-usage.md
- project-memory/practices/third-party-library-official-source-verification.md

### 4.1 Applicable sourceRefs

已回读任务适用的 owning source：

- AGENTS.md、PLATFORM-BLUEPRINT.md。
- doc/platform/review-standard.md。
- doc/platform/terminal-coding-standard.md：TR-01/02/03/04/06/09/10/11/12/16/17、命名与依赖、主副机与 TDP/credential、目录词表和可读性条款。
- doc/platform/foundation-charter.md：已有能力优先、owner、单一事实、不要预建框架、分母与反例、文档状态、授权和产品判断边界。
- doc/platform/third-party-library-usage-standard.md。
- doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md。
- doc/decisions/2026-07-24-v2s-solution-reasonableness-review-policy.md。
- doc/decisions/2026-07-25-v2s-confirmed-business-corpus-memory-adoption.md。
- doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md。
- doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md，含 2026-10-10 TEST_CHAIN_PREFLIGHT 与 2026-10-12 调试日志修订。
- doc/decisions/2026-09-25-v2s-roadmap-mechanism-retirement.md。
- 四份设计模板全文。
- doc/review/platform/2026-08-28-newposv1-package-analysis-claude/00-ter-build-order-claude.md：真实依赖、端口默认、启动层输入、三重命名、静态 error/parameter、同仓治理、pair 与技术栈裁决适用段。

以下 sourceRef 不作为本轮需求缺陷判据：

| sourceRef 组 | N/A 理由 |
|---|---|
| 后台 CRUD/DB 性能的 RM1/P6、2026-08-22 性能需求/详设/历史 review、build.gradle.kts、tools/verify-gates/verify.mjs | 本轮不改后台 operation、SQL、事务、预算，也不宣称性能或机器门通过；通用 owner/生成/证据原则由当前正本核验 |
| extension submission、public invitation state machine、external collaboration 历史材料 | 本需求不变更这些业务或协议；不能由历史案例扩充 T1 |
| CIPG 商品识别/制作、商品库 UI/IA 的 sourceRefs | 当前只引用 corpus 边界，没有新增商品事实、制作、列表或表单行为 |
| 2026-08-27 base-1 原始业务需求 | 当前不改变门店/合同生命周期；其现行语义由 canonical corpus 和当前 terminal 正本约束 |
| 2026-08-29 skeleton 旧建设顺序/验收范围 | 当前 T1 不重新交付骨架，不继承旧建设数量或旧动态授权 |
| 冻结 logging 原文、carryover manifest、旧 compliance retirement 执行清单 | 当前适用内容通过 deterministic-context-only、现行日志决定与 AGENTS 重开；不恢复已退役准入/字段脱敏或台账 |
| doc/platform/implementation-task-template.md 的实际 CP/6b、L2/seed 执行准入产物 | 属未来详设/实施义务；正式需求不需提前产生实施结果或当前运行证明 |
| 后端/双后台控件编码细则 | 当前不新增 backend 或 antd screen；TER 适用的同一事实、失败、生成与 review 原则以 terminal 正本及 charter 核验 |

## 5. Corpus 搜索

检索词干：门店、合同、项目、组织、集团空间、角色、URL、凭证、启用、停用。

命中并读取 G-01、G-02、G-03/G-04、G-05、G-08/G-09、G-10 及其不得推导边界。

核验结果：

- 空集团空间不推出集团/组织/账号自动存在。
- 门店、总公司不因组织路径调用被改为组织树节点。
- 门店启停、合同有效性、终端资格不能互推。
- URL 定位集团空间，不构成认证/授权或默认空间回退。
- T1 未新增这些业务事实，未将 parked domain 变为实施范围。
- 本轮发现的 reset/credential 问题取判据于 terminal 现行正本和生产路径，不从 corpus 猜产品行为。

## 6. Decisions 目录

实际使用 Python 纯读取列出 doc/decisions/*.md 每个文件的 H1 标题，并查看四份 templates 的标题。

适用 decision 已打开：单业务部署/owner、方案合理性、验证治理、独立 reviewer、协作控制、corpus adoption、日志/验收、Roadmap 退役、terminal service-shape、TER 第三方用法整改。

现有激活、配对、更新 A/B/C、远控与 automation 的 UI/Journey 决定作为业务保真导航；本轮不重判其具体 UI，不以尚未生成 T1 详设为需求缺陷。对应现行责任、凭证、主副机和 reset 判据已在 terminal-coding-standard 重开。后续实际详设/实施须按影响面完整恢复这些业务输入。

## 7. 被审对象与后读作者材料

| 输入 | 读取范围 | 状态 |
|---|---|---|
| doc/plans/platform/2026-10-13-ter-key-code-structure-t1-formal-requirements-codex.md | 全文 1–262 | READ_FULL |
| doc/plans/platform/2026-10-13-ter-key-code-structure-t1-requirements-discussion-claude.md | §1/11/13.1 先读；独立初判后读其余全文 | READ_FULL_ORDERED |
| doc/plans/platform/2026-10-13-ter-key-code-structure-t1-source-inventory-claude.json | 解析元数据、40 个 package 导航及与关键源码的对应；不宣称逐分支语义审计 | READ_NAVIGATION_ONLY_AFTER_VERDICT |

旧 _old_/newPOSv1 的文件路径仅作原始材料中的参考来源。本轮无需调用外部 POC 才能判断正式需求；没有从旧 POC 推导当前行为或生成依赖。

## 8. 关键 owning source 接缝

下列是真实源码读取范围，不代表全 TER 实施审计：

- contracts：foundations/definition.ts、foundations/errorTemplate.ts、types/module.ts。
- runtime：types/module.ts、application/createRuntime.ts 的注册/校验/启动/State 汇总、application/moduleManifest.ts、foundations/defineCommand.ts、foundations/defineStateSelector.ts。
- state：types/slice.ts、foundations/createStateRuntime.ts 的注册/retain、foundations/createStateStore.ts、foundations/defineStateRuntimeSlice.ts 的 reset 默认、foundations/persistenceEngine.ts 的 reset 删除/失败/提交路径。
- ui/base/feature-assembly：createFeatureAssembly 与 createFeatureAssemblyModule。
- ui/base/integration-assembly：integrationAssembly 的 module/catalog/variables 接缝、stateSyncSlices。
- 两个 integration：application/module.ts 的 stage/required projections；assembly/assembly.tsx 的包加载、API/transport 注入、sync 白名单与 update provider。
- TDC：index.ts、types/client.ts、application/createTerminalDataClientModule.ts、generated client 公开链、terminalDataClientActor.ts 的请求执行/取消激活/reset、terminalDataClient.ts 的初值/persist/sync。
- store-basic/project-basic：application/module.ts 及真实 API/selector 消费定位。
- transport：moduleName.ts、application/createTransportModule.ts 的 owner/command gateway/资源接缝。
- contracts/policy/terminal-client-generation.json。
- scripts/generate/terminal-client-api.mjs 的 canonical 输入、targets、归属/路径检查、operation assignment、输出消费者；未执行生成器。
- server-config：validateServerConfigDefaults.ts。
- 两 Android App：assembly/managedServerSpaces.ts。
- 两 Web 入口：test-expo/App.tsx 的 One/Two、名称匹配、URL 和 defaults 消费。
- 唯一 terminal-automation 当前消费者的配置定位；未恢复旧 runner。

一次纯读取 rg 使用不存在的 shell glob，zsh 报无匹配；随后通过 rg --files 定位实际源码并读取。这不是动态运行或测试失败。

## 9. 四份模板逐节适用性

标记“有”表示正式需求承接了该节在需求阶段的义务；不表示已经产出详设或运行 proof。

### Journey 模板

| 节 | 判定 | 依据 |
|---|---|---|
| §1 元数据 | 有 | 正式稿 §0、DOCUMENT_KIND/授权 |
| §2 用户任务/成功 | 有 | §0.1 |
| §3 actor 前提链 | NOT_APPLICABLE | 结构需求不新增业务 actor/访问前提；既有行为保真留后续影响面设计 |
| §4 边界/非目标/禁推 | 有 | R-01、R-07～R-14 |
| §5 corpus | NOT_APPLICABLE 于新 Journey 工件；本 review 已核验命中边界 | 不新增业务 Journey 或 corpus 事实 |
| §6 UI/后续工件 | 有 | R-16/R-17、§7.3 |
| §6.1 双后台一致性 | NOT_APPLICABLE | 无 antd 后台 screen |
| §7 Dexter 裁决 | 有 | §0.2 已确认输入；未冒充实施授权 |

### IA 模板

| 节 | 判定 | 依据 |
|---|---|---|
| §1 IA 元数据 | NOT_APPLICABLE | 当前不是 IA |
| §2 可见/不可见维度 | NOT_APPLICABLE 于逐 IA 工件 | 无新页面；R-16/17 和 V 约束未来业务保真 |
| §2.1.1 满载容器 | NOT_APPLICABLE | 不设计新容器 |
| §3 共用 IA | NOT_APPLICABLE | 不重绘 IA |
| §4 全量错误/界面映射 | 有需求目标；具体映射属详设 | R-05/V-04 不改变完整业务来源 |
| §5 交叉对账 | 已执行需求与原始输入/规范对读 | S-1 为验收预期冲突 |
| §6 IA 完成判定 | NOT_APPLICABLE | 不宣称 IA 完成 |

### UI interaction 模板

| 节 | 判定 | 理由 |
|---|---|---|
| §1 元数据、§1.1、§1.2 | NOT_APPLICABLE | 无新增 screen/双后台控件 |
| surface ownership、业务文案、owner 字段槽位 | NOT_APPLICABLE | 不新增呈现 |
| §2 interaction map | NOT_APPLICABLE | 不改变 Journey |
| §3 v2 页面盘点 | NOT_APPLICABLE | 无新 UI-bearing Journey |
| §4 线框、控件 testId/roster、表单依赖/字段矩阵/主从集合、搜索 §1.3/1.3.1 | NOT_APPLICABLE | 当前正式需求不要求实现 UI 工件；未来受影响行为需回归设计 |
| §5 状态/边界、§6 操作合理性、§7 face/owner | NOT_APPLICABLE 于新工件 | R-01/16/17 明确保持原行为 |
| §8 Manifest B.4/B.5 | NOT_APPLICABLE | compliance-control 已退役，不恢复 |
| §9 高保真、§10 看图 | NOT_APPLICABLE | 未请求新画面 |

### Implementation-facing 模板

| 节 | 判定 | 理由/正式稿承接 |
|---|---|---|
| §0 授权 | 有 | §0.3 |
| §1 目标/比较 | 有需求目标；详设三方案表 NOT_APPLICABLE 于当前 | §0.1；本 review 独立比较替代 |
| §2 CP | NOT_APPLICABLE | 当前不是实施计划 |
| §3 横切机制、第三方依据 | 有需求约束；具体逐 CP 表属详设 | R-05～R-14/R-16 |
| §3a L2/testId | NOT_APPLICABLE 于当前运行准入 | 本轮无新增 UI/L2；未来按影响面适用 |
| §4 CP 门 | NOT_APPLICABLE | 无实施 CP |
| §5 operations、§6 跨 owner、§7 声明传递消费、§8 owner 判定、§9 API/消费者、§9a 同步、§9b 定位 | 有未来详设义务；具体矩阵 NOT_APPLICABLE 于当前 | R-02/07/08/09/11/14/16 |
| §10 迁移 | 有保真义务；具体方案属详设 | R-12/V-15；S-1 需澄清 |
| §10b 及 .1～.6 seed | NOT_APPLICABLE 于当前执行 | 不新增后台业务数据，不授权 reset/seed；未来影响面需判定 |
| §11 场景、§11a 判据对照 | 有需求阶段最低场景 | §6 V-01～18；具体 owner/入口/proof 绑定留详设 |
| §12 未决项 | 有 | §7.2 |
| §13 停机/动态日志前置 | 有 | R-16/17 |
| §13b 阶段/整体三维、§13c 逐代码 | 有未来义务；当前产物 NOT_APPLICABLE | R-17 |
| §14 交付自查 | 有正式需求来源/场景闭合；详设自查 NOT_APPLICABLE 于当前 | §8 |

## 10. 当前证据

STATIC_SOURCE_REVIEW=PERFORMED
COMPILE=NOT_RUN
TYPECHECK=NOT_RUN
TEST=NOT_RUN
CODEGEN=NOT_RUN
VERIFY=NOT_RUN
WEB=NOT_RUN
ANDROID_DEVICE=NOT_RUN
DEV=NOT_RUN
L2=NOT_RUN
UAT=NOT_RUN
RUNTIME_CLEANUP=NOT_APPLICABLE_NO_RESOURCE_STARTED

当前业务/cleanup 动态证明不是需求静态审查的完成条件；不据 NOT_RUN 给需求增加动态 finding。
