---
SKILL_USED=cs-writing-plans
title: v2s 到店点餐允许外部接入串行实施计划
status: DESIGN_ONLY_NOT_AUTHORIZED
createdAt: 2026-09-10
decisionOwner: Dexter
programId: V2S_W0_W4_EXECUTION
designRef: doc/plans/platform/2026-09-10-v2s-business-channel-dine-in-external-access-implementation-design-codex.md
journeyRef: doc/decisions/2026-09-10-v2s-business-channel-dine-in-external-access-journey-amendment.md
interactionRef: doc/decisions/2026-09-10-v2s-business-channel-dine-in-external-access-ui-interaction-design-codex.md
iaRef: doc/decisions/2026-09-10-v2s-business-channel-dine-in-external-access-ia-amendment-codex.md
implementationAuthority: false
---

# 到店点餐允许外部接入 · 串行实施计划

## 1. 目标与当前边界

目标是一次性闭合以下业务事实：`STORE + EXTERNAL + DINE_IN` 合法，`dineInForm=null` 且 provider 精确支持 `DINE_IN`；`PROJECT + EXTERNAL + DINE_IN` 继续 typed reject；门店经营渠道读取包含外部 DINE_IN；销售菜单仍只服务 `STORE + INTERNAL + DINE_IN/TAKEAWAY`。

本文件是 implementation-facing 计划，不是实施授权。当前有效边界：

```text
DESIGN_AUTHORITY=true
IMPLEMENTATION_AUTHORITY=false
NO_CODE/CONTRACT/MIGRATION/TEST/SEED/RESET/DEV/L2/UAT
```

实施获单独授权后，主 agent 才可按本计划写文件和执行受管命令；子 agent 只能做只读三维对账和对抗审查，不能写任何代码、测试、契约、迁移或 seed。

## 2. 实施总顺序

```text
CP-00 设计/原文/owner source 对账
  -> CP-01 source catalog + error catalog + descriptor
  -> CP-02 collaboration generated/read/provider/binding
  -> CP-03 business-channel policy + additive migration + generic store read
  -> CP-04 edge/OpenAPI/codegen
  -> CP-05 operations-admin UI/foundation/testId
  -> CP-06 focused proof + seed plan/executor + acceptance scenario code
  -> CP-07 全量静态/type/focused/backend acceptance/browser L2
  -> CP-08 受管 reset + DEV + seed（仅在明确授权后）
```

每个 CP 都是同一完整交付内的内部步骤。CP 结束前必须有：前读、精确修改、focused proof、同一输入的后读和 fresh 子 agent 三维对账；下一 CP 不得在当前 CP 对账 OPEN 时开始。

## 3. 通用逐点纪律

### 3.1 每个实际变更点的前读

开始写某一行/符号前，主 agent 必须重新读取：

1. 对应原始需求与 Journey amendment；
2. 对应 UI/IA/implementation design 条目；
3. 六维 `scripts/context/recall-memory` 命中的全部相关 memory 原文；
4. 该点 owning source 与可复用实现；
5. 适用 coding standard/foundation/acceptance standard；
6. 该点当前工作区字节和已有用户改动。

前读必须回答“要保护的业务事实、owner、输入/输出、失败和不变事实是什么”，不能用总览阅读代替。

### 3.2 focused proof 与后读

写完一个 CP 的每个逻辑变更组后，先跑能证伪该变更的最低 proof；再用同一组前读材料回读源码和 proof：

- policy/label/纯映射：focused unit/static test；
- migration/owner/授权/回读：真实 backend acceptance 或 integration test；
- provider/edge contract：source/schema/generator/typecheck；
- UI 渲染和动作：focused component/static test；
- 浏览器真实动作：受管 browser L2。

后读须记录 `MATCHED` 或 `OPEN`；`OPEN` 的点必须修复并重新做 focused proof，不得留到最终全量测试。

### 3.3 步骤级独立对账

每个 CP 完成后召集 fresh independent subagent，输入该 CP 的需求、详设、IA/interaction、相关 memory 和当前源码，逐条核对行为、形态、动作、位置、文案、状态、失败/恢复、可访问性、数据来源和失效边界。发现偏移时主 agent 修复，子 agent 复查；不把阶段对账合并成最后一次总览。

全部 CP 完成、进入整体测试前，再召集一次 fresh 子 agent 做整批三维对账；另有本 cycle 的 `REVIEW_TARGET=IMPLEMENTATION` fresh adversarial review，不由作者会话代替。

## 4. CP-00：设计冻结和实现 admission

**前读**：

- `doc/decisions/2026-09-10-v2s-business-channel-dine-in-external-access-journey-amendment.md`
- `doc/decisions/2026-09-10-v2s-business-channel-dine-in-external-access-ui-interaction-design-codex.md`
- `doc/decisions/2026-09-10-v2s-business-channel-dine-in-external-access-ia-amendment-codex.md`
- `doc/plans/platform/2026-09-10-v2s-business-channel-dine-in-external-access-implementation-design-codex.md`
- 原始需求变更分析与 Dexter D-01/D-02/D-04 裁决

**动作**：确认外部 DINE_IN 不展示/不提交 POS/QR/KIOSK；确认 D-02 只 STORE；确认 D-04 的 platform closure 不含外部菜单；确认 provider descriptor 是真实 capability 资料而非 TAKEAWAY alias；冻结 testId roster 和 O5 两种读取。

**失败条件**：文档仍把外部 DINE_IN 写成必须有 dineInForm；PROJECT 外部 DINE_IN 未定义拒绝；O5 继续把 SALES_MENU 结果当全部渠道；provider code/capability 来源不明却声称已可用。

**proof/后读**：静态交叉对账；IA/UI/design 的关键句逐字比对；结果 `MATCHED` 后才进入 CP-01。无生产文件修改。

## 5. CP-01：catalog source、error source 与 descriptor

**写入范围**：

- `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json`
- `doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json`
- `contracts/collaboration/external-platform-catalog.schema.json`
- `contracts/collaboration/external-platform-catalog.json`
- `contracts/openapi-source/collaboration.schemas.json`
- `contracts/openapi-source/business-channel.schemas.json`

**动作**：

1. 在 capability closed set 加入 `DINE_IN`，保留既有能力，不把 TAKEAWAY 重命名或复用；
2. 从 active error set 退役 `DINE_IN_MUST_BE_INTERNAL`，加入 `PROJECT_DINE_IN_EXTERNAL_NOT_ALLOWED`；
3. 声明固定的门店自有点单小程序 provider descriptor：`STORE_OWNED_MINI_PROGRAM_DINE_IN`、system capability/provider scope 为 `DINE_IN`、bindable node 只含 `STORE`、`authenticationKind=EXTERNAL_GRANT`、`unbindKind=LOCAL_ONLY`、`catalogStatus=PLANNED`；workspace enablement 必须由既有 owner command 设为 `ENABLED`；
4. source schema 保持 `dineInForm` nullable，不加 menu 字段、不加 provider-specific POS/QR/KIOSK 字段；
5. 运行 materialize/codegen 前的 schema/source validation。

**可证伪条件**：仅改 generated 产物时重新生成会恢复旧 error；provider scope 包含 DINE_IN 但 system capability 不含 DINE_IN；DINE_IN 不在 generated closed set；固定 descriptor 缺 provider/system displayName、attributeValues、catalogStatus、authenticationKind、unbindKind 或 STORE bindability。

**focused proof**（获授权后）：catalog/schema validator、source generator check、error closed-set static test。保留一个 red mutation：删除 source DINE_IN 或恢复 old error 必须失败。

**后读**：以 CP-00 同一原文逐项复核 source catalog、descriptor、错误语义；`MATCHED` 后由 fresh 子 agent 做 CP-01 三维对账。

## 6. CP-02：collaboration provider 与 binding

**写入范围**：

- `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CheckedInCollaborationCatalogSource.java`
- `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CollaborationOwnerService.java`
- `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CollaborationBindingPolicy.java`
- `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/api/CollaborationReadback.java`
- generated collaboration Java/TS：只通过 generator 更新

**动作**：

1. 让 checked-in catalog/runtime closed set 识别 DINE_IN；
2. provider candidate 接收 DINE_IN，并以 provider scope、workspace enablement 和 STORE bindability 过滤；
3. binding policy 对 DINE_IN 做 exact scope check，并验证固定 provider 的 `EXTERNAL_GRANT + LOCAL_ONLY` 既有闭集语义；不新增外部 adapter/revocation 调用；
4. 保持 provider/status/version/owner binding 的 owner 主权与已有事务、CAS、日志脱敏；
5. 不新增外部菜单 API 或适配器调用。

**可证伪条件**：`capabilityClass=DINE_IN` 查询返回 TAKEAWAY provider；provider scope 不含 DINE_IN 仍可创建绑定；跨 workspace provider 可被读到；失败后留下 binding。

**focused proof**：collaboration policy/candidate/binding focused tests；之后真实 HTTP focused acceptance 场景 `collaboration.dine-in-capability-readback`、`collaboration.dine-in-provider-candidates`、`collaboration.dine-in-binding-scope`。

**后读**：同一需求/详设/owner source 逐点回读，确认没有将 `catalogStatus` 误作 enablement gate，确认错误和日志不泄露敏感值；fresh 子 agent CP-02 对账。

## 7. CP-03：business-channel policy、migration、通用门店读取

**写入范围**：

- `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelPolicy.java`
- `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelOwnerService.java`
- `apps/backend/catering-business-server/src/main/resources/db/migration/V20260910_000000_000__business_channel_dine_in_external_access.sql`（写前复核 Flyway 当前 head）
- `apps/backend/catering-business-server/src/test/java/database/*BusinessChannel*Migration*`
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BusinessChannelAcceptanceScenarios.java`

**动作**：

1. 按设计顺序改 `validateTemplate`：PROJECT 外部 DINE_IN 专用 reject；内部 DINE_IN 要求 POS/QR/KIOSK；外部 DINE_IN 要求 form null；非 DINE_IN form null；provider exact check；
2. template create/update、channel create revalidation 共用同一 policy；
3. 新增 additive migration：删除旧 CHECK、加新 CHECK；不改旧 migration、不回填数据；
4. 复用 owner `pageChannels` 为 O5 `BUSINESS_CHANNEL` 全部 store channel bounded read；不改变 `listSalesMenuEligibleChannels`/`requireSalesMenuChannel`；
5. 确保失败事务不新增模板/渠道/绑定，不改变已有 version。

**可证伪条件**：外部 DINE_IN form POS/QR/KIOSK 能写入；PROJECT 外部 DINE_IN 能写入；O5 全部渠道仍调用销售菜单 read；销售菜单 owner 只按 store ownership 而不按 INTERNAL/orderKind 复核。

**focused proof**：policy matrix unit tests；migration integration tests 覆盖 internal positive、external store null positive、external form negative、project external negative、non-DINE_IN form negative；owner focused tests；最后真实 HTTP focused acceptance。

**后读**：逐点复核 Java policy、SQL CHECK、owner read、sales-menu predicates、事务与 no-write oracle；fresh 子 agent CP-03 对账。

## 8. CP-04：edge、OpenAPI 与生成链

**写入范围**：

- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/businesschannel/OperationsBusinessChannelController.java`
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/businesschannel/BusinessChannelWireMapper.java`
- `contracts/openapi/paths/operations-admin/business-channel.paths.json`
- `contracts/openapi/edge.openapi.json`
- generated Java/TS 及 operations-admin API：仅生成器输出

**动作**：

1. 将既有 `getOperationsStoreBusinessChannels` 的 `usage` closed set 扩为 `BUSINESS_CHANNEL|SALES_MENU`；不新增 operation/permission；
2. `BUSINESS_CHANNEL` 分支只接受 sort 参数，调用 `pageChannels(STORE)`；带 cursor/pageSize 必须 typed invalid request，不得静默忽略；
3. `SALES_MENU` 分支保留当前固定 page size 20、cursor 和 sales-menu owner 调用；
4. 生成并 readback Java/TS wire，确保新 error/capability/usage 全链一致。

**可证伪条件**：O5 通用渠道请求仍被强制当成 SALES_MENU；SALES_MENU 请求落入 generic page；生成物仍含 old error；consumer face/owner module 漂移。

**focused proof**：OpenAPI parse/source catalog check、codegen check、Java compile、TS typecheck、edge controller focused test；真实 HTTP focused read separation。

**后读**：用同一 UI/IA/design 和 edge/source 清单复核参数、响应形态、授权点、usage 分支和错误；fresh 子 agent CP-04 对账。

## 9. CP-05：operations-admin UI 与 testId

**写入范围**：

- `apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelTemplateDrawer.tsx`
- `apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelTemplateDetailDrawer.tsx`
- `apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelList.tsx`
- `apps/frontend/operations-admin/src/features/business-channel/ui/StoreBusinessChannelPage.tsx`
- `apps/frontend/operations-admin/src/features/business-channel/application/queries.ts`
- `apps/frontend/operations-admin/src/features/business-channel/model/collaborationCodeLabels.ts`
- `apps/frontend/operations-admin/src/app/automation/businessChannelTemplateTestIds.ts`
- 对应 static/focused tests

**动作**：

1. 先将 inline testId 迁入唯一 `*TestIds.ts`，绑定真实动作节点和动态 providerCode；
2. provider capability mapping 改为 DINE_IN/TAKEAWAY/GROUP_BUY exact mapping，禁止 undefined fallback；
3. STORE external DINE_IN 隐藏 dineInForm，显示说明，发送 null；INTERNAL DINE_IN 保持形式选择；PROJECT DINE_IN 不提供外部可保存路径；
4. 完成 provider loading/empty/error/retry 的可见状态和保存阻断；
5. O5 全渠道 query 改用 `BUSINESS_CHANNEL`，sales-menu query 保持 `SALES_MENU`；
6. detail provider readback 传 DINE_IN；不显示 POS/QR/KIOSK、外部菜单或敏感值；
7. 只接入 foundation 已有 Drawer/lifecycle/overlay/generation/cursor/refresh/testId 能力，不复制实现。
8. provider businessScope/capability 的中文 label 只在既有 `collaborationCodeLabels.ts` 补齐 `DINE_IN`，继续由 generated type + `closedCodeLabel` 约束；不增加 contract displayNames 或第二份 enum-label map。

**可证伪条件**：外部 DINE_IN 仍显示或提交内部形式；DINE_IN provider query 不带 capability；provider 失败静默变空；O5 外部渠道消失；testId 散写/挂在 wrapper；L2 能用 label/text 替代 roster。

**focused proof**：testId uniqueness/static preflight、Drawer conditional rendering/provider query tests、O5 usage query test、typecheck/lint。L2 脚本 admission 只有在 roster 与 static proof PASS 后才开放。

**后读**：同一 UI interaction/IA/design 逐条核对文案、控件、位置、禁用/隐藏、错误/恢复、foundation、cache invalidation；fresh 子 agent CP-05 对账。

## 10. CP-06：seed 与 acceptance 实施

**写入范围**：

- `scripts/dev/external-collaboration-business-channel-seed-plan.mjs`
- `scripts/dev/external-collaboration-business-channel-seed-executor.mjs`
- 对应 `*.test.mjs`
- `CollaborationAcceptanceScenarios.java`
- `BusinessChannelAcceptanceScenarios.java`
- `SalesMenuAcceptanceScenarios.java` 的最小 sales-menu negative regression

**动作**：

1. 用独立 fixture namespace 创建两个 ENABLED 门店，并保留 DISABLED/VOIDED 负例；
2. 创建/启用固定 DINE_IN provider，建立 `STORE + EXTERNAL + DINE_IN` channel，`providerCode=STORE_OWNED_MINI_PROGRAM_DINE_IN` 且 `dineInForm=null`；
3. 保留 internal DINE_IN POS/QR/KIOSK、internal TAKEAWAY、external TAKEAWAY/GROUP_BUY；
4. 写正负 HTTP scenario，正向 provider 必须精确为固定 DINE_IN profile；另覆盖缺 provider 的 typed failure，所有负向都做 no-write/readback；
5. 更新 seed 自校验，撤退“全部 DINE_IN 必须 INTERNAL”旧断言；
6. 对每条新增/改动场景先 focused，再整个 acceptance suite；不能把 focused 串联当 full。

**可证伪条件**：seed 只用历史外部 provider；外部 DINE_IN form 被填 POS；SalesMenu acceptance 误把外部渠道当 eligible；scenario 只断状态码不断业务事实；旧 migration 前结果被复用。

**focused proof**：

```bash
scripts/test/backend-acceptance --operation <scenario-id>
```

所有代码/fixture/契约变更完成后才允许最后一次全量：

```bash
scripts/test/backend-acceptance --operation all
scripts/verify
```

每次受管运行都读取日志，分别报告 `CONTRACT`、`BUSINESS=REAL`、信息性 `DB_OPERATIONS` 和 cleanup；首败保留，第二次同 signal 前先诊断。

**后读**：用同一需求/详设/acceptance standard 对账 fixture、route identity、真实 HTTP、oracle、no-write 和报告；fresh 子 agent CP-06 对账。

## 11. CP-07：整体验证与 fresh implementation review

**进入条件**：CP-00～06 全部 `MATCHED`，UI roster/static admission PASS，所有源代码和 fixture 已稳定；仍未做 reset/seed/DEV。

**动作**：

1. 静态/source/codegen/typecheck/focused tests 全部运行；
2. fresh independent subagent 以 `REVIEW_TARGET=IMPLEMENTATION`、证伪立场重读 current production source、design 和真实 evidence；不得作者会话自审替代；
3. 该 review cycle 最多两轮；第二轮写 `ROUND_FINAL_DECISION=SELF_DECIDED`，不召集第三轮；
4. 运行完整 backend acceptance，且 run timestamp 晚于最后一个代码/契约/fixture 改动；
5. 在 backend full PASS 后，按无 HMR 受管拓扑运行 browser L2，验证 join COMPLETE、missing/unexpected=0、business/cleanup 分开；
6. UI L2 除 sales-menu regression 外，至少覆盖外部 DINE_IN 无 form、DINE_IN provider 精确查询、O5 全渠道可见与 sales-menu 排除。

**失败条件**：任何 full suite 早于最后改动；只存在 focused run；L2 仍使用旧本地 Spring/PostgreSQL tunnel 拓扑；cleanup 非 PASS；静态 claim 冒充 runtime business；无法可靠复算分母时猜数字。

**后读**：审查完整 delivery inventory，分别标注 static、backend business、L2 business、cleanup、未执行项；不建设 SHA-256 输入台账。

## 12. CP-08：受管 reset、DEV、seed（当前不执行）

只有 Dexter 另行明确授权后才执行：

1. 使用受管 `scripts/reset`，业务与 cleanup 分开报告；
2. 使用受管 `scripts/dev/start`，后端只走远端 Java，PostgreSQL/object storage 与 Java 同侧；本机只两个 Vite；start 不 seed；
3. 使用受管 seed 入口，按 workspace/project/stores/provider/template/channel/binding 顺序物化；
4. readback 证明两个 ENABLED 门店、DINE_IN provider、external DINE_IN null form、内部菜单渠道、销售菜单排除外部渠道；
5. 不启动远端 Vite/浏览器，不建 PostgreSQL tunnel，不按端口/命令名杀未知进程；
6. 记录 reset、DEV、seed 各自的 business 与 cleanup，任何 cleanup FAIL 都不能收口。

本阶段状态固定为 `NOT_AUTHORIZED_AND_NOT_RUN`。

## 13. 完成判据与未决边界

完成本计划不等于产品验收、UAT、部署或切流。实施交付只有在以下全部成立时才可提交 review：

- `STORE + EXTERNAL + DINE_IN` 真实创建/读取/绑定闭环，`dineInForm=null`；
- `PROJECT + EXTERNAL + DINE_IN` 候选/保存/直接 HTTP 均 fail closed 且无部分写入；
- O5 全渠道包含外部 DINE_IN，SalesMenu 查询/直调排除外部；
- DINE_IN capability、provider、error code、migration、generated wire、UI 和 seed source 全链一致；
- focused、静态、全量 backend acceptance、browser L2 business/cleanup 均分别有证据；
- fresh independent implementation review 完成且不被作者会话替代；
- 未授权的 reset/DEV/seed/UAT 不被误报已执行。

```text
PLAN_STATUS=DESIGN_ONLY_NOT_AUTHORIZED
IMPLEMENTATION_AUTHORITY=false
CURRENT_EXECUTION=NOT_STARTED
CURRENT_DYNAMIC_EVIDENCE=UNVERIFIED_REQUIRES_EVIDENCE
```
