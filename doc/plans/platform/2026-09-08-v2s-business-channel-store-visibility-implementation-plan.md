---
title: v2s 经营渠道模板门店可见范围串行实施计划
status: ACTIVE_IMPLEMENTATION_AUTHORIZED
createdAt: 2026-09-08
decisionOwner: Dexter
implementationAuthority: true
designRef: doc/plans/platform/2026-09-08-v2s-business-channel-store-visibility-implementation-design.md
journeyRef: doc/decisions/2026-09-08-v2s-business-channel-store-visibility-journey-amendment.md
iaRef: doc/decisions/2026-09-08-v2s-business-channel-store-visibility-ia.md
interactionRef: doc/decisions/2026-09-08-v2s-business-channel-store-visibility-ui-interaction.md
---

# 经营渠道模板门店可见范围 · 串行实施计划

## 1. 计划边界

~~~text
PLAN_KIND=IMPLEMENTATION_PLAN
PLAN_STATUS=ACTIVE_IMPLEMENTATION_AUTHORIZED
IMPLEMENTATION_AUTHORITY=true
CURRENT_TASK=IMPLEMENTATION
REVIEW_GATE=FRESH_INDEPENDENT_IMPLEMENTATION_REVIEW_THEN_CLAUDE_REVIEW
RUNTIME_STATUS=DEV/RESET/SEED/BACKEND_ACCEPTANCE/BROWSER_L2_NOT_RUN
~~~

本计划是当前已获 Dexter 授权的实施顺序。所有文件写入由主 agent 完成；独立 reviewer 只读审查并返回 finding；动态命令仍只能通过受管入口执行并分别报告 business 与 cleanup。

## 2. 实施前置裁决

以下形态已经由 Dexter 接受并固定；它们不是实施者可以重新解释的默认提案。Claude follow-up DESIGN review 已 `GO`（M=0/S=0/N=2），Dexter 已授权本计划进入实施：

| key | Dexter 已接受的形态 | 状态 |
| --- | --- | --- |
| D-BCV-02 | SELECTED 允许空集合；零集合是零候选，不是停用；项目侧和门店侧有空态/恢复路径 | DEXTER_ACCEPTED |
| D-BCV-03 | 关系行保留、不级联；列表 count 排除 VOIDED；只读详情 NON_VOIDED；编辑 Drawer ALL 并标注 VOIDED | DEXTER_ACCEPTED |
| D-BCV-04 | 保存整体替换最终 `visibleStoreRefs`，同一 CAS transaction 完成关系、scope、version、audit | DEXTER_ACCEPTED |
| D-BCV-05 | PROJECT wire 为 `storeVisibilityScope=null`、`visibleStoreRefs=[]` | DEXTER_ACCEPTED |
| D-BCV-06 | 同一个 visible-store operation 以 `storeStatusFilter=NON_VOIDED|ALL` 服务详情与编辑 | DEXTER_ACCEPTED |

`D-BCV-01` 已删除：ALL 是动态项目成员开关，不存在快照选项裁决。若 Dexter 后续实质改变任一已接受形态，必须先回写 Journey、IA、interaction、implementation design 和本计划，再开始下一 CP；不得在实现期口头解释替代文档。

## 3. 串行 CP 顺序与共同完成门

每个 CP 开始前重开对应 RECALL、原始需求、IA/interaction、implementation design 和 owning source；每个 CP 完成后做 focused proof，再由 fresh 独立子 agent 做当前步骤的三维对账，结论只允许 MATCHED/OPEN。出现 OPEN，主 agent 修复后交另一 fresh reviewer 复查，不得进入下一 CP。

### CP-00：需求、源码与决策输入冻结

范围：本批五份设计材料、既有 2026-08-19 business-channel Journey/IA/interaction/design/serial plan、六维 routed memory、当前 owner/contract/UI/foundation 源码。

动作：

1. 重跑 scripts/context/recall-memory --task-kind design --domain platform --consumer-face operations-admin --owner product --impact governance --trigger task-start，读取全部命中原文。
2. 用 scripts/context/recall-code --query 对 template table、candidate route、channel list、organization STORE candidate、foundation candidate/drawer/testId symbols 做 exact fixed-string 定位。
3. 回读本批 Journey/IA/interaction/design/plan；确认已接受的 D-BCV-02..06 ledger 与四条用户需求一致，并确认 D-BCV-01 已删除。

完成判据：没有未解释的 owner/consumer/scope/collection/状态冲突；如果有，结论为 OPEN 并停留在 CP-00。

### CP-01：契约 source 与数据库 migration

文件范围：

- contracts/openapi-source/business-channel.schemas.json；
- contracts/openapi-source/edge.openapi.json 的对应引用/operation（若当前 source 结构需要）；
- contracts/registry/operation-handler-bindings.json；
- apps/backend/catering-business-server/src/main/resources/db/migration/V20260908_000000_003__business_channel_template_store_visibility.sql；
- 仅由 generator 更新的 generated wire/TypeScript/bindings 文件。

动作与形态：

- 增加闭集 ALL_PROJECT_STORES、SELECTED_PROJECT_STORES；PROJECT 使用 null/empty 组合并由 owner 交叉校验。
- create 传初始 visibleStoreRefs；update 传 desired scope 与最终 `visibleStoreRefs`；数组不因 schema 通过而免除 owner 重复校验，空数组在 SELECTED 下合法。
- migration 先加列、回填既有 STORE 为 ALL，再加 cross-field CHECK、关系表、template FK 与 candidate/visible-store 查询索引；不加跨 owner organization FK，不添加关系 count 触发器。
- 新 visible-store Page operation 必须有唯一 operationId、handler binding、consumer；没有消费者时删掉该 operation，而不是保留空壳。

验证：

- 用仓库既有契约生成命令按 scripts/README.md 执行 --write --check 等精确入口；检查 source/generated 无漂移。
- migration integration test 证明旧模板 backfill、PROJECT null、关系 FK/index、非法 scope/owner 组合被拒。
- 任何 generated 输出不得手工编辑；不要运行 retired implementation-design-granularity/compliance-control。

失败恢复：契约或 migration 任何不一致都不进入 CP-02；保持未生成/未迁移状态，由主 agent 修复 source 后重新生成。

### CP-02：business-channel owner command/read

文件范围：

- apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/api/BusinessChannelCommandApi.java；
- apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/api/BusinessChannelReadApi.java；
- apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/api/BusinessChannelOwnerApi.java；
- apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/api/BusinessChannelReadback.java；
- apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelPolicy.java；
- apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelOwnerService.java；
- apps/backend/catering-business-server/modules/business-channel/src/test/ 下对应 owner unit/contract tests。

动作与形态：

1. 先在 policy 做 scope cross-field、duplicate 校验；不能在 controller 或前端各复制一份独立语义。对 BusinessChannelOwnerApi 做只读 source 对账确认其既有 sales-menu facts 不变，不新增 visibility 方法。
2. create/update 继续使用既有 receipt、@Transactional、template lock/CAS、audit 和 authoritative DB readback；canonical request 纳入 scope 和排序后的最终 `visibleStoreRefs`。
3. 使用显式 organization task-shaped read 校验 store 属于模板 project/workspace；不写 organization schema、不保存名称/状态快照到关系表。
4. update 计算 final set：PROJECT null/empty；ALL 清理关系；SELECTED 直接替换为最终 `visibleStoreRefs`，允许空集合；关系、scope、version、audit 一次提交，保存不因 VOIDED ref 拒绝。
5. visible-store Page 返回 storeRef、storeName、storeCode、storeStatus；不返回 raw-only row；PROJECT/foreign template 按 owner scope 拒绝。
6. createChannel 锁/重读 template，在同一个 REQUIRED transaction 校验当前 visibility；channel list/detail SQL 保持不加 visibility predicate。

验证：

- policy unit tests 覆盖两个 enum、PROJECT null、空 partial 合法、重复、foreign store 与 VOIDED ref 可保存。
- owner contract tests 覆盖 version/idempotency/rollback、candidate ALL/EXISTS、channel stale rejection、existing channel retention。
- focused static/source review 检查 update 路径没有任何 channel write/visibility cascade。

失败恢复：若关系写成功但 scope/version/audit 或 channel 读出现不一致，立即停止，读取 transaction/log/DB first failure；不靠重试掩盖 partial-write 边界。

### CP-03：edge operation 与 generated byte flow

文件范围：

- apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/businesschannel/OperationsBusinessChannelController.java；
- apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/businesschannel/BusinessChannelWireMapper.java；
- apps/backend/catering-business-server/src/main/java/com/catering/v2s/business/channel/application/operations/CreateOperationsBusinessChannelOperation.java；
- apps/backend/catering-business-server/src/main/java/com/catering/v2s/business/channel/application/operations/CreateOperationsBusinessChannelTemplateOperation.java；
- apps/backend/catering-business-server/src/main/java/com/catering/v2s/business/channel/application/operations/UpdateOperationsBusinessChannelOperation.java；
- apps/backend/catering-business-server/src/main/java/com/catering/v2s/business/channel/application/operations/UpdateOperationsBusinessChannelTemplateOperation.java；
- apps/backend/catering-business-server/src/main/java/com/catering/v2s/business/channel/application/operations/TransitionOperationsBusinessChannelStatusOperation.java；
- apps/backend/catering-business-server/src/main/java/com/catering/v2s/business/channel/application/operations/TransitionOperationsBusinessChannelTemplateStatusOperation.java；
- contracts registry/source 与所有 generator 产物。

动作与形态：

- create/update body 只做 wire parsing、session scope 和 grant envelope；owner 再复核 locked aggregate。
- visible-store route 只允许项目模板管理 read scope；同一个 visible-store operation 以 `NON_VOIDED|ALL` filter 服务只读详情/编辑 Drawer；门店候选除了 project/store pair 外，必须显式读取并要求 target store `status=ENABLED`；store channel create 使用 owner final check。
- x-consumer-faces、operationId、handler、wire request/response、route path 一一对账；不把 Journey ID 放入 runtime/package/class/file name。

验证：

- generated chain check 和 source-to-handler binding check；确认不编辑 generated file。
- edge focused tests 检查 foreign project/store 不泄漏、typed problem 映射、同一 operation 只绑定一个 owner path。
- HTTP acceptance 仍推迟到 CP-07，静态/compile 不写成 backend business PASS。

### CP-04：operations-admin UI 与 foundation 对接

文件范围：

- apps/frontend/operations-admin/src/features/business-channel/ui/ProjectBusinessChannelPage.tsx；
- apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelTemplateDrawer.tsx；
- apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelTemplateStorePickerModal.tsx；
- apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelTemplateDetailDrawer.tsx；
- apps/frontend/operations-admin/src/features/business-channel/ui/StoreBusinessChannelPage.tsx；
- apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelCreateDrawer.tsx；
- apps/frontend/operations-admin/src/features/business-channel/application/queries.ts 与 apps/frontend/operations-admin/src/features/business-channel/model/businessChannelCodeLabels.ts；
- apps/frontend/operations-admin/src/app/automation/businessChannelTemplateTestIds.ts；
- 必要的 operations-admin focused tests。

动作与形态：

1. 先按 interaction §3.3 完整控件清单实现：范围摘要、scope Radio group/options、添加门店、独立 picker Modal、候选搜索/滚动/Checkbox、候选读取重试、Modal 取消/确定、selected row remove、VOIDED 标注、visible-store read retry/page、候选表/新建入口、template Select、save/cancel；只读/分页项仅在真实渲染时计入。
2. 复用 adminDrawerSurfaceProps、useDrawerFormLifecycle、useSubmissionLifecycle、useOverlayLock、useCursorCandidates、collectCursorPages、useDetailDrawer、AdminDetailActionMenu、NameCodeText 和 refresh signal；picker Modal 只在 app 层组合 Ant Design Modal/Checkbox，不在 foundation 复制共享 overlay 行为。
3. 新 TestId 只在 businessChannelTemplateTestIds.ts 定义，挂真实动作节点；`COMPOSITE_OPTION_ANCHOR` 仅允许 Radio.Group 组合锚点，L2 点击 option-level Radio；迁移新控件的 inline literal，禁止用 label/role/placeholder/index/CSS/XPath。
4. O5 模板表只展示模板名称、模板编码、接入类型、订单类型并只消费 owner candidate；项目模板门店可见范围不在门店消费面展示；O5 existing channel list/detail 不因 scope 移除而过滤。
5. stale visibility typed problem 保留页面上下文、刷新候选、保持 Drawer 草稿；不显示“渠道已停用”伪状态。

验证：

- UI focused/static proof 先核对 O5 不展示项目模板门店可见范围、O1/Drawer/详情仍正确显示或编辑 scope、Drawer/Modal 信息层次、Modal 搜索/Checkbox 临时集合、取消不回写、确定回写最终集合、VOIDED 全量读回与标注、zero-visible copy、focus/close guard、refresh 和 TestId uniqueness。
- fresh independent UI/IA 对账在任何 L2 spec 或 runner 改动前完成；未通过 UI_DESIGN_REVIEW/TESTID_REVIEW/L2 admission 不写 L2。
- operations-admin typecheck/既有 focused test 只证明静态/compile 层，不冒充 browser L2。

### CP-05：seed 与 acceptance 设计落地

文件范围：

- apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BusinessChannelAcceptanceScenarios.java；
- apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceScenarioCatalog.java 仅在 discovery 需要时核对，不增加通用 registry/provider 壳；
- scripts/dev/external-collaboration-business-channel-seed-plan.mjs；
- scripts/dev/external-collaboration-business-channel-seed-executor.mjs；
- scripts/dev/external-collaboration-business-channel-seed-executor.test.mjs；
- doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json；
- scripts/dev/r5-complete-seed-executor.mjs、scripts/dev/r5-complete-seed-executor.test.mjs 与 scripts/dev/profiles/r5-full.json（仅依赖对账，按 implementation design §15.1 判定是否修改）；

动作与形态：

- 场景全部在 BusinessChannelAcceptanceScenarios.java 中以真实 HTTP + CONTRACT/BUSINESS oracle 编写。
- fixture 至少两家同项目 ENABLED store；保留 foreign store、disabled/voided template negative；不以单店或已创建 channel 代替 visibility relation。
- coverage 包含 ALL 两店候选、SELECTED 选中/未选中、SELECTED 空集合合法、create/update final-set replacement、duplicate/foreign/rollback、VOIDED relation read/retain/remove、DISABLED/VOIDED target candidate blocked、existing channel retained、stale create rejected、idempotency/CAS、visible-store Page。
- seed 顺序为组织事实 → owner template → owner relation → store channel → remove visibility → readback；另覆盖 VOIDED relation 的全量编辑读取、无关保存保留、主动剔除；start/restart 不 seed。

验证：

- 代码审查确保每个场景有身份、fixture、request、business oracle、失败后状态和清理说明。
- 场景发现不依赖已退役 provider/SPI/registry/package-exit 控制面。
- 动态执行必须在 CP-07 受管入口进行；本 CP 不执行。

### CP-06：逐代码与详设对账（交付前置门）

这是显式实施步骤，不是收尾备注。执行者为主 agent，审查者为 fresh independent subagent；范围是 CP-01 至 CP-05 的每一个变更点及其对应 production/source/generated/test/UI 文件。

对账表每行必须包含：

| 字段 | 内容 |
| --- | --- |
| source path/symbol | 当前真实文件与方法/组件/operation |
| Journey/IA/interaction anchor | BCV/IA-ID/屏幕/动作 |
| implementation design anchor | CP、机制、owner、collection、failure |
| actual behavior | 当前代码如何声明、传递、消费 |
| result | 只能为 MATCHED 或 OPEN |
| evidence | exact source line、focused proof 或静态输出 |

判据：行为、形态、动作、关系、位置、用户文案、限制、state/control、失败/恢复、可访问性/焦点、数据来源/失效边界均必须 MATCHED；任一 OPEN 立即停止，不进入 CP-07。不得以全量测试、L2、seed 或“按设计实现”替代这一步。

### CP-07：受管动态验证

动态验证已包含在当前 Roadmap/Dexter 授权内，但本计划不自动触发任何动态命令；只有当前任务明确要求时，才按下列受管边界执行：

- backend acceptance 使用 scripts/test/backend-acceptance --operation ...，先 focused 后 all；Spring/Java、PostgreSQL、对象存储在受信远端，本机不启 Spring/PostgreSQL tunnel；business 与 cleanup 分开。
- DEV 如存在且 manifest identity 匹配，依受管联动规则先 stop；Testcontainers/backend acceptance business 与 cleanup PASS 后，只有原来确有 DEV 才受管 start；start 不 seed。
- seed 只使用 scripts/dev/seed 受管入口；reset 只使用受管 reset；都不得按端口/命令/PID 猜测停止。
- browser L2 只有 UI/TestId/runner admission 完成后，按 readiness → same-run generation/binding → run；本批设计阶段不创建 runner。

未来证据必须分别报告：CONTRACT、BUSINESS、DB/运行期原子性、L2 business、seed business、每项 cleanup、未执行项。静态设计不能关闭运行期原子性。

## 4. 失败族与恢复纪律

| failureCategory | 第一次 | 第二次 |
| --- | --- | --- |
| contract/generated drift | 保留 first failure，回到 source/generator | 立即停止动态推进并做边界诊断 |
| owner visibility/candidate mismatch | 保存 request/response/log/DB 证据，回到 owner predicate | 停止该族，禁止换场景/延时重试 |
| transaction partial write | 保留 transaction/log/rollback/readback first failure | 停止全部后续业务运行，先关闭原子性缺口 |
| remote topology/readiness | 按受管 manifest/PID/log 诊断 | 不改成本地 Spring/PostgreSQL tunnel，不盲等 |
| UI TestId/action binding | 回到真实动作节点与唯一 source | 不写 L2 runner，先重新过 UI admission |

任何动态 run 超过 30 秒按既有 30 秒节奏汇报；非动态 reviewer/外部等待不超过 60 秒无进展。当前设计阶段无动态 run。

## 5. 交付闸门

本计划的实施收口必须满足以下条件：

1. Journey、IA、interaction、implementation design、plan 对同一 scope/集合/保留语义逐字一致。
2. D-BCV-01 已删除，D-BCV-02..06 均有明确 disposition；没有静默产品假设。
3. fresh independent DESIGN review 已完成且所有 M/S/N finding 已由主 agent 处置并获得必要复查；Claude review 是额外 review，不替代 independent review。
4. generated/compliance retired controls 未被恢复；当前动态均为 NOT_RUN。
5. CP-06 逐代码与详设对账为全 MATCHED；没有 OPEN。

以上条件不扩大当前 Dexter 已授予的范围；仍不包含 UAT、部署、切流或其他 owner。
