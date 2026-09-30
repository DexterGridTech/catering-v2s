# 批次二详设与实施计划 · 独立 DESIGN Round 2 输入清单

```text
REVIEW_CYCLE_ID=TERMINAL-ACTIVATION-BATCH-2-DESIGN-2026-09-30
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
TARGET_DESIGN_SHA256=91ce9a3c044481391dbc2c1ffc1e15b2eed2c4f280ebd57318dad315fc75d3df
TARGET_PLAN_SHA256=15a8b9c303b860452326f7d4973dfabaa3130d878bc847c9698973afb5d89a01
CHECKLIST_STATUS=REVIEWER_VERDICT_AND_POST_VERDICT_AUDIT_RECORDED_WITH_DISCLOSED_GAPS
```

Reviewer 已在 verdict 前核对目标摘要、按证伪立场审查当前详设/计划与 owning sources，再形成 findings、verdict；Round 1 处置材料在初始判断后用于定向对照。以下补录 reviewer 实际报告以及 verdict 后的留痕审计；`EXECUTED_NOT_RECORDED` 是真实记录缺项，不能推成已打开。不得运行 build、test、generation、`scripts/verify`、DEV/Testcontainers、reset、seed、L2、UAT 或部署。

## 必需输入与本轮须回报的实际记录

| 输入 | 路径/命令 | Round 2 必须报告 |
|---|---|---|
| Codex 与 Claude 执行入口 | `AGENTS.md`、`CLAUDE.md` 全文 | 实读确认及本轮授权/边界摘要 |
| 当前任务指派 | 本轮 reviewer prompt 所附 Dexter 指派、原始 Batch 2 设计授权与新增要求 | 按路径/原文定位已读及边界 |
| kernels | `find project-memory/kernel -maxdepth 1 -type f -name '*.md' -print \| sort` | 完整文件清单及逐份读取确认 |
| 六维 recall | `scripts/context/recall-memory --task-kind design --domain platform --consumer-face backend --owner platform --impact architecture --trigger task-start` | 实际命令、所有 `id/path`、每项 applicable `sourceRefs/assertionSources`、逐个来源读回状态；不得只报数量 |
| business corpus | `rg -n '终端\|terminal\|激活\|取消激活\|凭证\|设备\|连接\|长连接\|server-config\|terminal-data-client\|WebSocket\|代理' project-memory/decisions/confirmed-business-language-corpus.md` | 实际命令与完整命中；每项正/负边界；存在词干命中时不写 `NO_CORPUS_ENTRY_MATCHED` |
| 当前审核对象 | `doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-design-codex.md`、`doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-plan-codex.md` | 先自行计算 SHA-256 并与头部一致；全文实际读完 |
| 需求 | `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md` | 依原指派先 §0–§10、§12、§13，再 §11；列出适用条款 |
| Journey / service-shape | `doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md`、`doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md` | 全文读取；核实 Journey 48/54 与 R-9.3/R-9.6/D-16 的现行字节及当前设计的 source-drift 门槛；不得改这两个源文件 |
| decision 全目录 inventory | `find doc/decisions -maxdepth 1 -type f -name '*.md' -print | sort` | 在 verdict 前列出完整标题全集、总数及 relevance 选择依据；对所有相关 accepted decisions 逐份全文读取并列路径，特别核实治理、agent 协作、verification、batching/roadmap、backend-acceptance、terminal shape、third-party 相关决定 |
| 四份模板 | `doc/decisions/templates/journey-decision-template.md`、`ui-interaction-design-template.md`、`ia-design-template.md`、`implementation-design-template.md` | 对每份逐节列 `PRESENT` / `MISSING` / `NOT_APPLICABLE_WITH_REASON`；Journey 作为已接受输入适用，不能因本批不重写而省略来源冲突判断 |
| 适用规范 | `PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、`doc/platform/review-standard.md`、`doc/platform/implementation-task-template.md`、`doc/platform/terminal-coding-standard.md` TR-09–TR-16、`doc/platform/third-party-library-usage-standard.md`、`doc/platform/backend-coding-standard.md`、`doc/platform/foundation-charter.md`、`scripts/README.md`、`doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md` | 逐条列出已读路径、适用条款与 target docs 落点 |
| 批次一边界 | Batch 1 design/plan、最新实现 review 与 final review 产物 | 列实际路径以及每项支撑的 Batch 2/3 边界 |
| 共享协议 | `contracts/protocol/terminal-connection-protocol.json` | 全文读取，列其对 Batch 2 的约束 |
| TER / backend / TDS 现有源码 | 生成 policy/edge generator/generated DTO；`terminal-data-client`、`server-config`、transport/state/platform-ports；TDS settings/lifecycle/Actuator/build; backend-acceptance scenario factory/catalog/selector；DEV/Testcontainers runners | 逐个列实际打开路径与设计落点；不得以路径族代替逐文件记录 |
| 第三方精确版本 | 当前解析锁文件与 Node、Undici、Spring Boot、HAProxy 提议版本；官方文档/源码 | 每个行为声称对应实际解析版本、官方精确 tag/version URL、支持 claim；无法确认则标 `UNVERIFIED` |
| 动态证据边界 | 本轮 DESIGN 范围 | 明确本轮没有 build/test/generation/verify/DEV/Testcontainers/reset/seed/L2/UAT/deploy |

## 定向核验

Round 1 指出的 source-drift 风险仅在独立扫描并形成初步判断后用于定向复查。须验证：

1. 详设和计划是否完全移除对 accepted Journey/decision 的写入；是否明确 current Dexter assignment + R-9.3/R-9.6/D-16 的唯一身份 owner；若 Journey 仍冲突，是否在进入 CP-01 写入前要求 owner 修订或 Dexter 裁定；是否没有因此偷偷加入第二凭证库。
2. `server-config` 本批恢复、terminal-data-client/state 的唯一保留范围、activation/cancel 经 command、独立 selectors（激活、连接、延迟）及对应测试路径是否可执行。
3. 本批唯一注入式 Node PMD 证明、系统代理、不自写 CONNECT、独立 Undici 与 Node bundled Undici 的版本/dispatch 边界是否与 exact-version 官方依据一致。
4. D-41 仓库内输入限制、V-B15/V-S9/V-S15 的验证面与 Batch 2 DEV topology、所有 Batch 2/3 边界是否前后一致；不得授权/纳入 Batch 3。

## 固定结论块

Reviewer 必须先给独立初始 verdict 与 `GO/NO-GO`、`M/S/N`、逐条 finding/证据/最小判据、同族全集、`DESIGN_GAPS`，再读取 Round 1 处置记录并写作者 disposition 对比。Round 2 必须另外给 `ROUND_FINAL_DECISION=SELF_DECIDED`；这是本 cycle 最后一轮，不得召集 Round 3。结论应明确是对设计/计划的静态审查，不是实施授权或动态证据。

## Round 2 reviewer 实际结果与审计补录

REVIEWER=/root/batch2_design_review_r2_final
VERDICT=GO
M/S/N=0/0/0
ROUND_FINAL_DECISION=SELF_DECIDED
REVIEWER_INITIAL_VERDICT=GO
REVIEWER_FINAL_VERDICT=GO
DESIGN_GAPS=none
DYNAMIC_EXECUTION=NOT_AUTHORIZED_NOT_RUN

Reviewer 报告先从证伪立场审阅目标文档与 owning sources，形成初始判断后才读取 Round 1 处置作定向对照。初始和对照后的结论均为 GO，无 finding。本轮为该 DESIGN cycle 最后一轮。

### A. doc/decisions 完整 inventory

Reviewer 报告 verdict 前已执行 find doc/decisions -maxdepth 1 -type f -name '*.md' -print | sort 并检查完整 120 条标题全集。原始 stdout 未单独归档；以下由主 agent 对当前文件字节按同一目录顺序重建，供查阅，不冒充 reviewer 原始 stdout。

当前重建数量：120。

1. 2026-07-24-v2s-execution-roadmap-r0-acceptance.md | catering-v2s W0-W4 执行 Roadmap R0 接受决定
2. 2026-07-24-v2s-r1-authorization.md | catering-v2s Roadmap R1 实施授权
3. 2026-07-24-v2s-r2-acceptance.md | catering-v2s R2 fresh session acceptance 接受决定
4. 2026-07-24-v2s-r3-specialized-design-authorization.md | catering-v2s R3 专项设计授权
5. 2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md | v2s 采用单业务部署单元、模块化领域边界与单库多 schema
6. 2026-07-24-v2s-solution-reasonableness-review-policy.md | catering-v2s 方案合理性优先评审策略
7. 2026-07-24-v2s-verification-governance.md | 验证工作的通用规则
8. 2026-07-25-v2s-agent-coordination-and-control-boundary.md | catering-v2s AI 协作与控制边界
9. 2026-07-25-v2s-backend-app-layout-and-tdp-placeholder.md | Backend app layout and terminal-data-server placeholder
10. 2026-07-25-v2s-confirmed-business-corpus-memory-adoption.md | 已确认业务语料纳入项目记忆裁决
11. 2026-07-25-v2s-design-governance-batch-1-5.md | 设计法治第一批增补（Batch 1.5）
12. 2026-07-25-v2s-design-governance-batch-1.md | 设计法治第一批：Journey 裁决与交互工件治理
13. 2026-07-25-v2s-frontend-asset-carry-over-first.md | 前端资产搬运优先（carry-over-first）
14. 2026-07-25-v2s-frontend-foundation-consumption-rule.md | v2s 后续 UI 功能必须优先消费 shared admin-ui-foundation
15. 2026-07-25-v2s-independent-subagent-adversarial-review-governance.md | 独立子 agent 对抗性 review 治理修订
16. 2026-07-25-v2s-r3-c01-commercial-group-initialization-interaction.md | 交互工件：R3-C01 商业集团显式初始化
17. 2026-07-25-v2s-r3-c01-commercial-group-initialization-journey-inventory.md | Journey 裁决：R3-C01 为既有集团空间显式初始化商业集团
18. 2026-07-25-v2s-r3-c02-operations-real-login-rejected-inventory.md | Journey 裁决：R3-C02 运营用户真实进入运营管理后台
19. 2026-07-25-v2s-r3-hash-evidence-checkpoint.md | R3 hash evidence checkpoint
20. 2026-07-25-v2s-r3-implementation-acceptance.md | R3 implementation acceptance and closure
21. 2026-07-25-v2s-r3-j02-commercial-group-initialization-selection.md | R3-J02：为既有集团空间显式初始化商业集团
22. 2026-07-25-v2s-r3-r6-journey-inventory-acceptance-and-c01-interaction-authorization.md | Batch 2 Journey inventory 接受与 R3-C01 交互设计授权
23. 2026-07-25-v2s-r3-r6-journey-inventory.md | R3–R6 未完成范围 Journey inventory
24. 2026-07-25-v2s-r3-whole-scope-design-acceptance.md | R3 全范围 implementation-facing 详设接受
25. 2026-07-25-v2s-r4-design-acceptance-and-implementation-authorization.md | R4 whole-scope design acceptance and implementation authorization
26. 2026-07-25-v2s-r4-design-authorization.md | R4 implementation-facing design authorization
27. 2026-07-25-v2s-r4-first-independent-review-input-checklist-exemption.md | R4 首个独立对抗审查输入清单字段豁免
28. 2026-07-25-v2s-r4-implementation-acceptance.md | R4 implementation acceptance and migration-gates closure
29. 2026-07-25-v2s-r5-scope-and-method-decisions.md | R5 范围、批次方法与契约基线裁决
30. 2026-07-25-v2s-r5-whole-scope-design-authorization.md | R5 全范围 implementation-facing design 精确授权
31. 2026-07-25-v2s-r5-whole-scope-interaction-design.md | R5 全范围 UI 交互设计与 carry-over-first 线框
32. 2026-07-25-v2s-r5-whole-scope-journey-decision.md | R5 全范围 Journey 裁决
33. 2026-07-25-v2s-roadmap-r-unit-atomic-delivery-rule.md | v2s 每个 Roadmap R 的一次性设计实施复核规则
34. 2026-07-26-v2s-post-remediation-review-binding-governance.md | design review post-remediation 绑定治理修订
35. 2026-07-26-v2s-r5-claude-review-five-point-resolution.md | R5 Claude 设计评审五项裁决
36. 2026-07-26-v2s-r5-operation-history-interaction-design.md | 交互工件：R5-AUDIT 操作历史
37. 2026-07-26-v2s-r5-operation-history-journey-decision.md | Journey 裁决：R5-AUDIT 操作历史
38. 2026-07-26-v2s-r5-revised-design-authorization.md | R5 修订详设授权
39. 2026-07-26-v2s-r5-revised-design-final-acceptance.md | R5 修订 implementation-facing design 最终接受
40. 2026-07-26-v2s-r5-revised-whole-scope-implementation-authorization.md | R5 修订全范围 implementation 精确授权
41. 2026-07-26-v2s-r5-whole-scope-design-final-acceptance.md | R5 全范围 implementation-facing design 最终接受
42. 2026-07-26-v2s-r5-whole-scope-implementation-authorization.md | R5 全范围 implementation 精确授权
43. 2026-07-27-v2s-identified-finding-generalization-and-prevention.md | 已识别问题的通用化与防再犯裁决
44. 2026-07-27-v2s-r5-compliance-remediation-delegated-decisions.md | R5 合规整改七项委托裁决
45. 2026-07-27-v2s-r5-compliance-remediation-design-authorization.md | R5 合规整改 Roadmap 与详设编制授权
46. 2026-07-27-v2s-r5-compliance-remediation-implementation-authorization.md | R5 合规整改 implementation 精确授权
47. 2026-07-27-v2s-r5-cr00-deterministic-generated-index-disposition.md | R5 CR00 确定性生成索引 receipt 处置
48. 2026-07-28-v2s-rm1-ia-01-platform-otp-and-invitation-interaction.md | RM1 IA-01：平台 OTP 与邀请入口交互详设
49. 2026-07-28-v2s-rm1-ia-02-operation-context-interaction.md | RM1 IA-02：运营上下文与平台集团空间交互详设
50. 2026-07-28-v2s-rm1-implementation-facing-design-authorization.md | RM1 implementation-facing design authorization
51. 2026-07-29-v2s-observability-and-acceptance-standard.md | 日志、诊断与执行验收强制标准
52. 2026-07-29-v2s-rm1-ia-03-platform-governance-and-self-service-interaction.md | IA-03 平台治理与本人安全交互
53. 2026-07-29-v2s-rm1-ia-04-operations-organization-and-contract-interaction.md | IA-04 运营组织、经营实体、门店与合同交互
54. 2026-07-29-v2s-rm1-ia-05-operations-users-recovery-and-home-interaction.md | IA-05 运营用户、公开恢复、本人安全与首页路由交互
55. 2026-07-29-v2s-rm1-p6-interaction-preparation-and-refreeze-design.md | RM1 P6：交互接受前的严格详设准备与 re-freeze 设计
56. 2026-07-30-v2s-admin-catalog-semantic-copy-model.md | 管理后台目录的单一关系真相模型
57. 2026-08-03-v2s-extension-hosts-commercial-group-region-project.md | Extension hosts: commercial group, region and project
58. 2026-08-03-v2s-extension-hosts-ui-interaction.md | UI interaction: extension hosts for commercial group, region and project
59. 2026-08-04-v2s-workspace-credential-reset-state.md | workspace-IAM 管理员重置凭据与强制改密状态
60. 2026-08-05-v2s-dual-admin-name-code-density-standard.md | 双后台名称（编号）展示规范
61. 2026-08-05-v2s-dual-admin-protable-compact-standard.md | 双后台 ProTable 紧凑密度规范
62. 2026-08-05-v2s-rp-02a-contract-consumer-recovery.md | RP-02a 同源契约消费者恢复 Journey 绑定
63. 2026-08-05-v2s-rp-02a-implementation-activation.md | （无一级标题）
64. 2026-08-05-v2s-rp-02a-implementation-authorization.md | RP-02a implementation authority binding
65. 2026-08-05-v2s-whole-engineering-d1-d7-rulings-claude.md | D1–D7 裁决与后续两批范围
66. 2026-08-08-v2s-backend-performance-refactor-design-authorization.md | 后台性能重构详设授权与非 UI 技术任务裁决
67. 2026-08-08-v2s-catalog-category-reference-interaction.md | Catalog category-management interaction change
68. 2026-08-08-v2s-catalog-inventory-scope-specific-write-capabilities.md | Catalog / inventory scope-specific write capabilities
69. 2026-08-08-v2s-catalog-reference-model-and-category-user-task.md | Catalog reference model and category-management user-task decision
70. 2026-08-09-v2s-backend-performance-phase3-to-phase4-rebaseline.md | 后端性能重构：第三阶段到第四阶段的读侧重划
71. 2026-08-09-v2s-backend-performance-phase4-owner-projection-rebaseline.md | BP-U05 owner-projection 预算上限重基线
72. 2026-08-09-v2s-backend-performance-phase4-read-budget-rebaseline.md | BP-U05 跨 owner task-read 预算重基线
73. 2026-08-10-v2s-backend-performance-final-closure-authorization.md | Backend-performance final-closure authorization
74. 2026-08-10-v2s-m1-extension-submission-and-command-readback-decision.md | M1 extension submission and command readback decision
75. 2026-08-11-v2s-routine-runtime-command-classification.md | Routine managed runtime command classification
76. 2026-08-12-v2s-complete-dev-seed-composition.md | 完整 DEV Seed 组合
77. 2026-08-12-v2s-public-invitation-resumption-state-machine.md | Public invitation resumption state machine
78. 2026-08-13-v2s-backend-acceptance-standard.md | SUPERSEDED — 2026-08-14 Dexter 裁定：provider/registry 是待办目录，不是 scenario 实现；当前唯一目标是 getPublicInvitationView 的真实 HTTP CONTRACT/BUSINESS 断言与信息性 DB 调用数。
79. 2026-08-14-v2s-backend-acceptance-business-scenario-standard.md | Backend acceptance 真实业务场景扩展规范
80. 2026-08-17-v2s-catalog-metadata-central-modal.md | 商品元数据统一维护弹窗
81. 2026-08-19-v2s-business-channel-management-journey.md | Journey 裁决：经营渠道管理
82. 2026-08-19-v2s-external-collaboration-and-business-channel-ia.md | 外部协作与经营渠道 · IA 详设
83. 2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md | 交互工件：外部协作与经营渠道
84. 2026-08-19-v2s-external-collaboration-platform-configuration-journey.md | Journey 裁决：外部协作配置
85. 2026-08-20-v2s-catalog-attribute-and-order-option-library-ia.md | IA：商品属性库、点单选项库与两步新建
86. 2026-08-20-v2s-catalog-attribute-and-order-option-library-journey.md | Journey 裁决：CATALOG_LIBRARY_CONFIGURATION 商品属性库、点单选项库与两步新建
87. 2026-08-20-v2s-catalog-attribute-and-order-option-library-ui-interaction.md | 交互工件：CATALOG_LIBRARY_CONFIGURATION 商品属性库、点单选项库与两步新建
88. 2026-08-21-v2s-catalog-unit-model-ia.md | 商品计量、销售单位与库存单位优化 · IA 详设
89. 2026-08-21-v2s-catalog-unit-model-journey.md | Journey 裁决：J-UNIT-001 商品计量单位维护与使用
90. 2026-08-21-v2s-catalog-unit-model-ui-interaction.md | 交互工件：UNIT-MODEL 商品计量单位、销售单位与库存单位
91. 2026-08-22-v2s-backend-performance-batch-outcome-journey.md | Journey 裁决：J-BPR-001 看清批量商品状态处理结果
92. 2026-08-22-v2s-backend-performance-batch-outcome-ui-interaction.md | 交互工件：J-BPR-001 看清批量商品状态处理结果
93. 2026-08-22-v2s-catalog-inventory-bom-configuration-journey.md | Journey 裁决：J-CIB-001 按商品结构配置库存扣减方式
94. 2026-08-22-v2s-catalog-inventory-bom-configuration-ui-interaction.md | 交互工件：J-CIB-001 按商品结构配置库存扣减方式
95. 2026-08-23-v2s-catalog-identification-production-guidance-journey.md | Journey 裁决：J-CIPG-001 维护商品识别与制作差异
96. 2026-08-23-v2s-catalog-identification-production-guidance-ui-interaction.md | 交互工件：J-CIPG-001 维护商品识别与制作差异
97. 2026-08-23-v2s-catalog-library-workbench-journey.md | Journey 裁决：J-CATUI-001 商品库唯一工作区
98. 2026-08-30-v2s-catalog-item-editor-transient-draft-close-discard.md | 商品编辑抽屉：内存草稿、dirty guard、整单一次提交
99. 2026-08-30-v2s-catalog-item-void-bom-reference-journey-amendment.md | 商品作废的 BOM 引用语义：J-CIB-001 Journey / UI / IA 修订草案
100. 2026-09-07-v2s-sales-menu-target-selection-availability-journey-amendment.md | Journey 裁决：R5-SM-TARGET-SELECTION-AVAILABILITY 销售项目标选择与细粒度沽清
101. 2026-09-08-v2s-business-channel-store-visibility-ia.md | 经营渠道模板门店可见范围 · IA 详设
102. 2026-09-08-v2s-business-channel-store-visibility-journey-amendment.md | Journey 修订：经营渠道模板的门店可见范围
103. 2026-09-08-v2s-business-channel-store-visibility-ui-interaction.md | 经营渠道模板门店可见范围 · UI 交互设计
104. 2026-09-08-v2s-managed-browser-l2-remote-backend-topology.md | 背景
105. 2026-09-08-v2s-sales-menu-published-image-snapshot-amendment.md | 销售菜单发布态商品图片快照补充
106. 2026-09-08-v2s-sales-menu-target-selection-availability-contract-source-drift.md | 销售菜单目标选择契约源演进记录
107. 2026-09-10-v2s-business-channel-dine-in-external-access-ia-amendment-codex.md | 到店点餐允许外部接入 · IA amendment
108. 2026-09-10-v2s-business-channel-dine-in-external-access-journey-amendment.md | 到店点餐允许外部接入 · Journey amendment
109. 2026-09-10-v2s-business-channel-dine-in-external-access-ui-interaction-design-codex.md | 到店点餐允许外部接入 · UI interaction design amendment
110. 2026-09-11-v2s-terminal-admin-console-journey-proposal-codex.md | TER terminal admin console Journey proposal
111. 2026-09-14-v2s-extension-field-list-search-journey.md | Journey 裁决：J-EXTENSION-FIELD-LIST-SEARCH 扩展字段列表展示与类型化搜索
112. 2026-09-16-v2s-store-operating-rule-switches-journey-codex.md | J-SOS-01 · 门店经营规则开关
113. 2026-09-17-v2s-store-service-point-qr-journey-codex.md | Journey 裁决：J-SPQ-01 门店桌台与二维码管理
114. 2026-09-21-v2s-catalog-inventory-p2-retirement.md | catalog-inventory-p2 退役登记
115. 2026-09-25-v2s-roadmap-mechanism-retirement.md | v2s Roadmap 机制退役与 Dexter 会话授权决定
116. 2026-09-25-v2s-store-terminal-cp05-baseline-293.md | 门店终端 CP-05 三次运行基线选择
117. 2026-09-26-v2s-terminal-activation-and-connection-journey.md | Journey 裁决：TERMINAL-ACTIVATION-AND-CONNECTION 终端激活与连接
118. 2026-09-26-v2s-terminal-activation-service-shape.md | v2s terminal activation and single-node TDS service shape
119. 2026-09-28-ter-third-party-usage-remediation.md | TER 第三方库用法整改裁决记录
120. 2026-09-29-v2s-terminal-activation-cp05-baseline-296.md | 终端激活与长连接批次一 CP-05 当前操作基线


### B. 六维 recall 的 25 个 id/path

Reviewer 报告 verdict 前执行了清单顶部的 recall 命令并审阅 25 个命中项。原始 stdout 与若干 sourceRefs/assertionSources 未完整留存；缺项如实标记，不能将路由执行夸大为来源全文阅读。

| id | path | sourceRefs/assertionSources 留存 |
| --- | --- | --- |
| decisions.confirmed-business-language-corpus | project-memory/decisions/confirmed-business-language-corpus.md | 2026-07-25 corpus adoption; 2026-08-23 catalog guidance/formal requirements/UI/IA/interaction docs，完整路径见上方 R1 reviewer sourceRefs 索引 |
| decisions.deterministic-context-only | project-memory/decisions/deterministic-context-only.md | 2026-09-25 roadmap retirement; 2026-07-24 carry-over manifest; 2026-08-13 compliance retirement review |
| decisions.http-crud-efficiency-design-redlines | project-memory/decisions/http-crud-efficiency-design-redlines.md | PLATFORM-BLUEPRINT; 2026-08-10 extension source; public invitation source; RM1 evidence; backend coding/implementation template; performance reviews；完整列表 EXECUTED_NOT_RECORDED |
| decisions.independent-subagent-adversarial-review | project-memory/decisions/independent-subagent-adversarial-review.md | 2026-07-25 independent review governance; review-standard |
| decisions.owner-read-model-and-lifecycle-standard | project-memory/decisions/owner-read-model-and-lifecycle-standard.md | base-1 requirements source；准确路径 EXECUTED_NOT_RECORDED |
| kernel.contract-admin | project-memory/kernel/04-contract-consumer-and-admin.md | kernel source itself; READ_BEFORE_FINAL_VERDICT |
| kernel.evidence-runtime | project-memory/kernel/05-evidence-runtime-and-git.md | kernel source itself; READ_BEFORE_FINAL_VERDICT |
| kernel.heritage-change | project-memory/kernel/06-heritage-and-change.md | kernel source itself; READ_BEFORE_FINAL_VERDICT |
| kernel.service-owner | project-memory/kernel/02-service-shape-and-owner.md | kernel source itself; READ_BEFORE_FINAL_VERDICT |
| kernel.transaction-data | project-memory/kernel/03-transaction-data-and-dependencies.md | kernel source itself; READ_BEFORE_FINAL_VERDICT |
| kernel.workspace-authorization | project-memory/kernel/01-workspace-and-authorization.md | kernel source itself; READ_BEFORE_FINAL_VERDICT |
| operations.business-corpus-adoption-and-read-policy | project-memory/operations/business-corpus-adoption-and-read-policy.md | exact sourceRefs EXECUTED_NOT_RECORDED |
| operations.business-corpus-parked-domain-intake | project-memory/operations/business-corpus-parked-domain-intake.md | exact sourceRefs EXECUTED_NOT_RECORDED |
| operations.backend-readability-refactor | project-memory/operations/backend-readability-refactor.md | exact sourceRefs EXECUTED_NOT_RECORDED |
| pitfalls.designing-from-conversation-not-system | project-memory/pitfalls/designing-from-conversation-not-system.md | exact sourceRefs EXECUTED_NOT_RECORDED |
| pitfalls.invisible-dimension-drifts-at-implementation | project-memory/pitfalls/invisible-dimension-drifts-at-implementation.md | exact sourceRefs EXECUTED_NOT_RECORDED |
| pitfalls.platform-detail-reverse-inference | project-memory/pitfalls/platform-detail-reverse-inference.md | exact sourceRefs EXECUTED_NOT_RECORDED |
| practices.backend-capability-lookup | project-memory/practices/backend-capability-lookup.md | exact sourceRefs EXECUTED_NOT_RECORDED |
| practices.collection-boundary-modes | project-memory/practices/collection-boundary-modes.md | exact sourceRefs EXECUTED_NOT_RECORDED |
| practices.ordering-only-for-consumer-facing | project-memory/practices/ordering-only-for-consumer-facing.md | exact sourceRefs EXECUTED_NOT_RECORDED |
| operations.terminal-coding-standard | project-memory/operations/terminal-coding-standard.md | exact sourceRefs EXECUTED_NOT_RECORDED |
| decisions.terminal-architecture-and-stack-rulings | project-memory/decisions/terminal-architecture-and-stack-rulings.md | exact sourceRefs EXECUTED_NOT_RECORDED |
| decisions.terminal-build-order-and-batches | project-memory/decisions/terminal-build-order-and-batches.md | exact sourceRefs EXECUTED_NOT_RECORDED |
| practices.ter-input-and-virtual-keyboard-usage | project-memory/practices/ter-input-and-virtual-keyboard-usage.md | exact sourceRefs EXECUTED_NOT_RECORDED |
| practices.third-party-library-official-source-verification | project-memory/practices/third-party-library-official-source-verification.md | exact sourceRefs EXECUTED_NOT_RECORDED |

Reviewer 报告 6 个 kernel 均在 verdict 前全文读取。catalog/UI 专项 sourceRefs 的逐份全文状态 UNKNOWN/NOT_RECORDED。可留存的完整 sourceRefs 清单见 Round 1 checklist；R2 未记录的路径仍保持 EXECUTED_NOT_RECORDED。

### C. Business corpus 检索

Reviewer 报告在 verdict 前运行：
rg -n '终端|terminal|激活|取消激活|凭证|设备|连接|长连接|server-config|terminal-data-client|WebSocket|代理' project-memory/decisions/confirmed-business-language-corpus.md

唯一命中为第 262 行，属于不得从识别码推导扫码枪、标签秤、设备协议或销售解析入口的负面边界；不是本需求正向业务语料。存在词干命中，因此没有报告 NO_CORPUS_ENTRY_MATCHED。

### D. Verdict 前全文打开的 relevant decisions

- doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md
- doc/decisions/2026-07-24-v2s-solution-reasonableness-review-policy.md
- doc/decisions/2026-07-24-v2s-verification-governance.md
- doc/decisions/2026-07-25-v2s-agent-coordination-and-control-boundary.md
- doc/decisions/2026-07-25-v2s-backend-app-layout-and-tdp-placeholder.md
- doc/decisions/2026-07-25-v2s-confirmed-business-corpus-memory-adoption.md
- doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md
- doc/decisions/2026-07-25-v2s-frontend-asset-carry-over-first.md
- doc/decisions/2026-07-25-v2s-frontend-foundation-consumption-rule.md
- doc/decisions/2026-07-25-v2s-roadmap-r-unit-atomic-delivery-rule.md
- doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md
- doc/decisions/2026-08-11-v2s-routine-runtime-command-classification.md
- doc/decisions/2026-08-12-v2s-complete-dev-seed-composition.md
- doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md
- doc/decisions/2026-09-08-v2s-managed-browser-l2-remote-backend-topology.md
- doc/decisions/2026-09-25-v2s-roadmap-mechanism-retirement.md
- doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md
- doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md
- doc/decisions/2026-09-28-ter-third-party-usage-remediation.md
- doc/decisions/2026-09-29-v2s-terminal-activation-cp05-baseline-296.md

### E. 四份模板覆盖

| 模板 | verdict 前 reviewer 结果 |
| --- | --- |
| implementation-design-template.md | PRESENT：授权、问题/方案、RECALL、CP、第三方、准入、验收映射、对账、动态/资源/log/cleanup、交付及自查均有落点 |
| journey-decision-template.md | PRESENT_AS_INPUT_WITH_SOURCE_DRIFT_HANDLED；48/54 冲突已记录；本批不改 Journey |
| ui-interaction-design-template.md | NOT_APPLICABLE_WITH_REASON；无新 UI action/control/testId/L2，保留既有 Expo Web smoke/read-only |
| ia-design-template.md | NOT_APPLICABLE_WITH_REASON；无新页面/route/navigation；若实现新增须停下重定范围 |

### F. Owning-source 阅读与补正状态

Reviewer verdict 前报告打开 requirements、Journey/service-shape、共享 protocol、OpenAPI terminal activation path、edge-codegen、L2 admission policy；TER transport/platform-ports/state 源；TDS build/config/settings/lifecycle/session actor/test；backend-acceptance 场景/process/catalog/test；backend-acceptance 与远端 Testcontainers/DEV runners；package/yarn/Gradle 解析上下文。逐文件路径见上方必需输入及 R1 reviewer checklist 的对应源文件列表。

最初误探四个 terminaldata package 路径均 MISSING，随后修正并打开 terminaldataserver package 的实际 TDS 文件；错误路径未作为证据。准确状态与路径组已由 reviewer 补报。

### G. 官方第三方资料与未记录限制

- Node.js 22.23.3 release（bundled Undici 6.28.1）: https://nodejs.org/en/blog/release/v22.23.3
- Undici 8.11.2 engine: https://github.com/nodejs/undici/blob/v8.11.2/package.json
- WebSocket dispatcher: https://github.com/nodejs/undici/blob/v8.11.2/docs/docs/api/WebSocket.md
- ProxyAgent API/lifecycle: https://github.com/nodejs/undici/blob/v8.11.2/docs/docs/api/ProxyAgent.md
- PMD negotiation source: https://github.com/nodejs/undici/blob/v8.11.2/lib/web/websocket/connection.js
- Inflated payload enforcement source: https://github.com/nodejs/undici/blob/v8.11.2/lib/web/websocket/permessage-deflate.js
- Security advisory context: https://github.com/nodejs/undici/security/advisories/GHSA-3wwx-pv8p-q78v
- Spring Boot 4.1 ReadinessState: https://docs.spring.io/spring-boot/4.1/api/java/org/springframework/boot/availability/ReadinessState.html
- Spring Boot 4.1 readiness indicator: https://docs.spring.io/spring-boot/4.1/api/java/org/springframework/boot/health/application/ReadinessStateHealthIndicator.html
- Spring Boot 4.1 WebFlux actuator package: https://docs.spring.io/spring-boot/4.1/api/java/org/springframework/boot/webflux/actuate/endpoint/web/package-summary.html
- HAProxy 3.4 source: https://www.haproxy.org/download/3.4/src/
- HAProxy 3.4 configuration manual: https://docs.haproxy.org/3.4/configuration.html
- Docker Official Image: https://hub.docker.com/_/haproxy/

Patch-specific Spring Boot 4.1.0 and HAProxy 3.4.6 pages, complete raw recall stdout, and several exact sourceRefs are EXECUTED_NOT_RECORDED. Actual Gradle resolutions, Actuator behavior, and HAProxy image digest remain CP-04/CP-05 proof items, not PASS claims.

### H. Verdict 后审计边界

POST_VERDICT_AUDIT_ONLY=true
NEW_REVIEW=false
NEW_FINDING=false
VERDICT_CHANGED=false

Verdict 后仅整理 120-title inventory、recall/sourceRefs、模板摘要、owning-source 路径与 official URL/claim，未重审或改变 verdict。
