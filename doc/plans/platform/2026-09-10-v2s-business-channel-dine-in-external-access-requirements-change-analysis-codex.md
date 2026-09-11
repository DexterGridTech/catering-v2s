# v2s 经营渠道“到店点餐允许外部接入”需求变更分析（Codex）

```text
DOCUMENT_KIND=REQUIREMENT_CHANGE_ANALYSIS
REQUIREMENT_CHANGE_ID=BC-20260910-DINE-IN-EXTERNAL
PROGRAM_ID=V2S_W0_W4_EXECUTION
REVIEW_TARGET=DESIGN
STATUS=SUPERSEDED_BY_IMPLEMENTATION_FACING_DESIGN
INDEPENDENT_SUBAGENT_REVIEW=GO_WITH_UNVERIFIED_UI
INDEPENDENT_REVIEW_CYCLE_ID=BC-20260910-DINE-IN-EXTERNAL-DESIGN
INDEPENDENT_REVIEW_ROUND_FINAL=2
IMPLEMENTATION_AUTHORITY=false
RUNTIME_EXECUTION=NOT_RUN
DECISION_OWNER=Dexter
SOURCE_OF_TRUTH=current repository bytes + original requirement + accepted design/decision documents
SUPERSEDING_DESIGN=doc/plans/platform/2026-09-10-v2s-business-channel-dine-in-external-access-implementation-design-codex.md
```

## 0. Dexter 裁决后的文档地位

本分析第 1 至第 10 节记录 D-01、D-02、D-04 裁决前的影响分析和当时的最小解释，其中关于“DINE_IN 仍必须有 `dineInForm`”“规则默认同时适用于 PROJECT/STORE”以及“尚未决定 provider”的句子是历史分析，不再是当前需求正本。Dexter 已作出以下覆盖性裁决：

- `STORE + EXTERNAL + DINE_IN` 合法，`dineInForm=null`，外部系统不使用 POS/QR/KIOSK；
- 新规则仅适用于 STORE，`PROJECT + EXTERNAL + DINE_IN` 继续拒绝；
- 本批形成完整 platform closure，但外部系统不建立本平台销售菜单；销售菜单仍只接受 `STORE + INTERNAL + DINE_IN/TAKEAWAY`。

当前实现方向、验收矩阵和 UI 语义以 [Journey amendment](../../decisions/2026-09-10-v2s-business-channel-dine-in-external-access-journey-amendment.md)、[IA amendment](../../decisions/2026-09-10-v2s-business-channel-dine-in-external-access-ia-amendment-codex.md)、[UI interaction amendment](../../decisions/2026-09-10-v2s-business-channel-dine-in-external-access-ui-interaction-design-codex.md) 和 [implementation-facing design](./2026-09-10-v2s-business-channel-dine-in-external-access-implementation-design-codex.md) 为准。本补充不改变本文件的历史 review 记录，也不授权实施。

## 1. 结论摘要

本次需求变更的最小正确含义是：经营渠道模板和由模板创建的渠道实例不再因为 `orderKind=DINE_IN` 而被强制限制为 `accessKind=INTERNAL`。`DINE_IN` 仍必须选择一个 `dineInForm`；`EXTERNAL` 仍必须选择已启用、并且业务范围明确包含 `DINE_IN` 的外部 provider；`INTERNAL` 仍不得携带 provider。

门店销售菜单的资格逻辑保持不变，仍然只接受：

```text
target_node_type = STORE
target_node_ref = 当前门店
target_store 存在
template.access_kind = INTERNAL
template.operator_kind = STORE
template.order_kind in (DINE_IN, TAKEAWAY)
```

因此，外部 `DINE_IN` 是合法的经营渠道类型，但不是销售菜单可维护渠道；它既不能出现在销售菜单候选列表，也不能绕过 owner 的直接资格复核。该变化不回收、不删除、不改写已有渠道或已有销售菜单事实。

当前发现一个必须在实施前由产品/能力 owner 明确的前置缺口：checked-in external platform catalog 尚未声明任何 `DINE_IN` capability，当前 provider 也没有 `DINE_IN` business scope。只删除旧的内部接入限制会得到“策略表面允许、provider 候选为空、创建/绑定仍被 `BUSINESS_SCOPE_EXCEEDED` 拒绝”的半成品，而不是可用的外部到店点餐。因此，在实施授权前必须指定一个真实外部系统/provider，或明确本阶段仅解除规则并暂不提供可选 provider。禁止把 `TAKEAWAY` 作为 DINE_IN 的别名，也禁止绕过 provider 的能力边界。

本文件是需求变更影响分析，不是实现设计，不授权修改代码、契约、迁移、测试、seed、reset、DEV、backend acceptance、browser L2 或 UAT。

## 2. 原规则、新规则与解释边界

### 2.1 原规则

当前业务策略把接入方式和订单类型耦合：`DINE_IN` 只能是 `INTERNAL`，否则 owner 返回 `DINE_IN_MUST_BE_INTERNAL`。这个限制存在于模板创建校验，渠道创建还会重新读取模板并复核 provider/模板事实。数据库也用 CHECK 约束了 `DINE_IN` 必须为 `INTERNAL`。

### 2.2 新规则

需求变更将旧耦合改为以下闭集规则：

| 组合 | 模板/渠道结论 | 必要条件 | 销售菜单结论 |
| --- | --- | --- | --- |
| `INTERNAL + DINE_IN` | 允许 | `dineInForm ∈ POS/QR/KIOSK`，provider 为空 | 允许，前提是 STORE owner |
| `INTERNAL + TAKEAWAY` | 允许 | `dineInForm` 为空，provider 为空 | 允许，前提是 STORE owner |
| `EXTERNAL + DINE_IN` | 目标是允许 | `dineInForm` 必填；provider 已启用且 `businessScope` 含 `DINE_IN` | 明确不允许 |
| `EXTERNAL + TAKEAWAY` | 现有规则继续允许 | provider 已启用且 `businessScope` 含 `TAKEAWAY` | 明确不允许 |
| `EXTERNAL + GROUP_BUY` | 现有规则继续允许 | provider 已启用且 `businessScope` 含 `GROUP_BUY` | 明确不允许 |
| `PROJECT + 任一外部订单类型` | 按经营渠道规则允许 | provider 与订单类型能力匹配 | 明确不允许，销售菜单只认 STORE |

表中“允许”只表示经营渠道 owner 的业务类型规则允许，不替代权限、project scope、provider enablement、binding、状态或其他既有校验。

### 2.3 采用的最小解释与待确认项

本分析按当前 owner policy 的维度采用最小解释：解除的是 `accessKind` 与 `DINE_IN` 的全局耦合，适用于 `PROJECT` 和 `STORE` 模板；销售菜单仍只看 STORE 的 INTERNAL 渠道。若 Dexter 的真实意图仅允许 STORE 外部 DINE_IN，必须在实施前明确收窄，否则同一 policy 会出现未声明的 operator-specific 例外。

“可以是外部接入”还必须区分两层：

1. 业务模型允许该组合；
2. 至少有一个 checked-in provider 能声明并承载该能力。

第 1 层可以由解除旧策略完成，第 2 层目前尚未由仓内 capability source 证明，不能从需求文字推断 provider 名称、认证流程、菜单同步方向或到店点餐形式的外部语义。

## 3. 当前字节核验事实

以下行号是本次分析读取当前仓库字节时的定位锚点；进入实施时必须重新读取，不把本表替代为实现期事实。

| 当前事实 | owning source | 当前行为 | 判定 |
| --- | --- | --- | --- |
| `DINE_IN` 被强制要求 `INTERNAL` | `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelPolicy.java:30-66`，`validateTemplate` | 第 40-42 行抛出 `DINE_IN_MUST_BE_INTERNAL`；第 43-65 行再校验 form、provider 和 provider scope | `CONFIRMED`，本批需求变更直接命中 |
| 模板创建调用统一 policy | `.../BusinessChannelOwnerService.java:632-647`，`createTemplate` | 创建前调用 `validateTemplate`，随后才处理模板持久化 | `CONFIRMED`，不能只修 UI |
| 渠道创建重新读取模板并复核 provider | `.../BusinessChannelOwnerService.java:936-955`，`createChannel` | 外部模板重新读 collaboration tree，并进入 `validateTemplateProvider` 与 target 校验 | `CONFIRMED`，不能只放开模板创建 |
| 数据库 CHECK 也要求 DINE_IN 为 INTERNAL | `apps/backend/catering-business-server/src/main/resources/db/migration/V20260819_230000_001__business_channel_owner.sql:21-28` | `ck_business_channel_template_dine_in_form` 把 `access_kind='INTERNAL'` 写入 CHECK | `CONFIRMED`，需要新增 additive migration |
| 销售菜单候选只认 STORE + INTERNAL + DINE_IN/TAKEAWAY | `.../BusinessChannelOwnerService.java:355-420`，`listSalesMenuEligibleChannels` | SQL 同时约束 target store、模板 access/operator/order | `CONFIRMED`，本次不得放宽 |
| 销售菜单直接资格复核同样只认内部门店渠道 | `.../BusinessChannelOwnerService.java:425-439`，`requireSalesMenuChannel` | 直接读取条件与候选 SQL 一致 | `CONFIRMED`，外部 DINE_IN 不得绕过 |
| 归属检查与菜单资格检查分离 | `.../BusinessChannelOwnerService.java:442-456`，`salesMenuChannelBelongsToStore` | 只证明持久化渠道归属于门店，不把归属当作菜单资格 | `CONFIRMED`，保持失败审计/回读边界 |
| 前端把 DINE_IN 外部接入禁用 | `apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelTemplateDrawer.tsx:312-317,327-332` | 切换到 DINE_IN 时强制 `INTERNAL` 并清 provider；EXTERNAL Radio 在 DINE_IN 时 disabled | `CONFIRMED`，需在实现期同步改 UI |
| 前端对 DINE_IN 不查询 provider capability | `.../BusinessChannelTemplateDrawer.tsx:178-187` | `capabilityClass` 只给 TAKEAWAY/GROUP_BUY，DINE_IN 传 undefined | `CONFIRMED`，provider source 若扩展必须传 DINE_IN |
| DINE_IN form 在 EXTERNAL 时被禁用 | `.../BusinessChannelTemplateDrawer.tsx:457-464` | 表单显示但 `accessKind=EXTERNAL` 时不可选 | `CONFIRMED`，新规则下必须能选择并校验 |
| 当前外部 catalog 无 DINE_IN capability | `contracts/collaboration/external-platform-catalog.json:3-49,76-106` | MEITUAN/ELEME 只有 GROUP_BUY、TAKEAWAY（另有配送能力）；provider scope 无 DINE_IN | `CONFIRMED`，是实施前置缺口 |
| catalog schema 闭集无 DINE_IN | `contracts/collaboration/external-platform-catalog.schema.json:13-16` | `capabilityClass` enum 没有 DINE_IN | `CONFIRMED` |
| runtime source 闭集无 DINE_IN | `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CheckedInCollaborationCatalogSource.java:29-36` | `CAPABILITY_CLASSES` 没有 DINE_IN | `CONFIRMED` |
| provider 候选按 businessScope 过滤 | `.../collaboration/application/CollaborationOwnerService.java:148-161` | `listEnabledProviderProfiles` 只有在 provider scope 包含查询 capability 时返回 | `CONFIRMED` |
| binding owner 要求 capability 在 provider scope 内 | `.../collaboration/application/CollaborationBindingPolicy.java:17-43` | 外部授权 binding 不满足 scope 时返回 `BUSINESS_SCOPE_EXCEEDED` | `CONFIRMED` |
| active contract 已有四个业务维度字段 | `contracts/openapi-source/business-channel.schemas.json:4-80` | `accessKind`、`operatorKind`、`orderKind`、`dineInForm`、`providerCode` 均已存在，闭集也已有 EXTERNAL/DINE_IN | `CONFIRMED`，核心 business-channel request 不需新增字段 |
| active contract/反馈仍声明旧错误码 | `contracts/openapi/paths/operations-admin/business-channel.paths.json:599-607,1418-1424`；`apps/frontend/operations-admin/src/app/api/operationsProblemFeedback.ts:49-53`；generated edge enum | 模板/渠道 create 错误清单和反馈仍包含 `DINE_IN_MUST_BE_INTERNAL` | `CONFIRMED`，实施时需移除 active 语义，历史材料不回写 |
| active generator source 仍生成旧错误码 | `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json:570-603`；`doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json:150-170`；`scripts/generate/r5-edge-materialize.mjs:11-15,340-394`；`scripts/generate/edge-codegen.mjs:17-24` | materialized OpenAPI、Java/TS generated closed set 由两个 catalog 和生成器产出；只改生成物会在下一次生成时复活旧错误 | `CONFIRMED`，实施时必须先改 source catalog，再物化/生成并检查产物 |
| policy unit test 固化旧预期 | `apps/backend/catering-business-server/modules/business-channel/src/test/java/com/catering/v2s/businesschannel/application/BusinessChannelPolicyTest.java:12-33` | 测试要求 EXTERNAL+DINE_IN 返回旧错误 | `CONFIRMED`，未来需改为正向/负向新矩阵 |
| seed plan 的 DINE_IN 仍全部 INTERNAL | `scripts/dev/external-collaboration-business-channel-seed-plan.mjs:486-496,547-549` | 校验三种 form 全为 INTERNAL；红夹具要求外部化 DINE_IN 被拒 | `CONFIRMED`，未来需随 capability 决策更新 |

## 4. 影响面分类

### 4.1 必须在实施期变更

1. **Business-channel owner policy**：删除只负责旧耦合的拒绝分支；保留 DINE_IN form 必填、非 DINE_IN form 为空、内部无 provider、外部 provider 必填且 enabled、provider `businessScope` 精确匹配等校验。
2. **数据库 schema**：不得修改已执行 migration；新增一个后续 Flyway migration，删除旧的 `ck_business_channel_template_dine_in_form` 并增加不依赖 `access_kind` 的 CHECK：DINE_IN 必须是 POS/QR/KIOSK，非 DINE_IN 必须为 NULL。已有数据无需重写，实施前应由 acceptance 证明 migration 对现存合法数据无破坏。
3. **外部 capability source**：只有在 Dexter 指定真实 provider/system 后，才能把 `DINE_IN` 加入 catalog schema、catalog 数据、runtime closed set、provider business scope、binding/candidate contract 与生成链。新增能力必须由 provider 所属 external system 声明，且 provider scope 必须是该系统能力的子集。
4. **active business-channel contract/error surface**：核心 template/channel request 不增加字段；但 create operation 的错误清单、generated closed set、前端错误反馈必须不再把永不触发的 `DINE_IN_MUST_BE_INTERNAL` 当作 active 失败。该清理的 source of truth 是 `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json` 与 `doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json`，由 `scripts/generate/r5-edge-materialize.mjs` 和 `scripts/generate/edge-codegen.mjs` 重新物化/生成；不能只删 materialized OpenAPI、generated Java/TS 或前端反馈中的字符串。是否将错误码从 runtime enum 完全删除，需与生成链的闭集策略一并决定。
5. **operations-admin 模板 Drawer**：DINE_IN 不再切换时强制 INTERNAL；EXTERNAL 对 DINE_IN 可选；DINE_IN form 对两种 access kind 都可选且必填；EXTERNAL provider 查询必须带 `DINE_IN` capability；provider 无候选、未启用、scope 不匹配仍显示可解释的失败/空态，不能让用户保存一个之后必然失败的组合。
6. **测试与 seed**：policy unit/owner acceptance、migration/数据库约束、provider candidate/binding、template/channel create、销售菜单候选负向、前端 L2 与 seed fixture 必须同时更新。测试必须证明的是业务事实和无部分写入，不是只证明 HTTP 2xx。

### 4.2 明确保持不变

1. 销售菜单 owner API、候选 SQL、`requireSalesMenuChannel` 的 STORE + INTERNAL + DINE_IN/TAKEAWAY 判定不改。
2. 销售菜单的 target selection、SKU/option subset、SKU price、库存自动不可售、销售项人工沽清、SKU/选项值人工沽清、publication snapshot 和前台菜单展示逻辑不因本变更扩展。
3. 外部 DINE_IN 不得因“门店属于项目”或“渠道归属于门店”而成为菜单候选；归属回读不是资格回读。
4. 既有 external TAKEAWAY/GROUP_BUY 的 provider、binding、channel 与菜单排除语义不改变；既有 internal DINE_IN/TAKEAWAY 继续可用于菜单。
5. 既有模板和渠道的四维事实保持不可变；不做历史模板自动转换、不回收已有渠道、不删除已有菜单或 publication。
6. 既有权限、workspace/project scope、owner command API、idempotency、CAS、audit、transaction 与 readback 语义不扩张；本变更不新增 owner、operation、route 或权限。
7. 不新增通用 capability DSL、映射表、MQ/outbox、跨 owner FK 或菜单兼容层。

### 4.3 条件影响与不应误改的范围

| 领域 | 需要什么 | 不应做什么 |
| --- | --- | --- |
| provider catalog | 为真实支持者声明 DINE_IN，并保持 provider scope 子集约束 | 不把 TAKEAWAY 当 DINE_IN，不伪造 provider 能力 |
| 菜单 owner | 继续只暴露内部门店到店/外卖 | 不为外部 DINE_IN 新增菜单入口、不修改销售菜单 API |
| store channel candidate | 若模板是可用的 STORE provider 模板，沿用现有模板候选读取 | 不在门店候选层偷偷过滤成菜单资格；binding/provider 由其 owner 复核 |
| UI | O2 模板创建/编辑显示正确的 capability 选择和错误 | 不新增字段，不复制 foundation Drawer/form 行为 |
| 历史文档 | 新分析/后续 amendment 取代 active 旧语义 | 不篡改历史 review verdict/evidence |

## 5. 外部 DINE_IN 的能力闭包

### 5.1 当前为何不能只删 policy 分支

当前 owner 路径是：模板外部接入 → provider candidate/读取 → template owner 校验 provider scope → 渠道创建重新读取 provider → 外部 binding 按 capability 校验。当前 catalog、schema、runtime closed set 都没有 `DINE_IN`，所以即使模板 policy 不再抛 `DINE_IN_MUST_BE_INTERNAL`，也会出现以下不闭合状态：

```text
UI 可能选择 EXTERNAL+DINE_IN
        ↓
provider candidate 不按 DINE_IN 返回，或者没有任何候选
        ↓
直接 HTTP create 缺 provider / scope 不匹配
        ↓
BUSINESS_SCOPE_EXCEEDED 或空候选
```

这不是可接受的“先放开再说”，因为用户要求的是规则变更后的可用外部接入，而不是一个只能产生失败的组合。

### 5.2 推荐能力方案

在 Dexter 指定真实外部系统与 provider 后，采用现有 capability 边界的最小扩展：

1. external system capabilities 增加 `DINE_IN`，使用真实中文显示名与必要属性；
2. 对应 provider 的 `businessScope` 增加 `DINE_IN`，前提是该 provider 业务确实承载到店点餐；
3. catalog schema、OpenAPI source/generated capability enums、candidate query enum、runtime closed set 同步生成/校验；
4. binding 的 `capabilityClass` 使用 `DINE_IN`，不复用 `TAKEAWAY`；
5. provider 候选以 `DINE_IN` 查询，最终 owner 再以 provider readback 复核；
6. sales-menu owner 继续把外部 DINE_IN 排除。

若真实 provider 尚未确定，建议本轮设计 review 只批准“语义解耦和影响范围”，把 provider capability 作为 `DEXTER_DECISION_REQUIRED`，暂不把任何现有 provider 擅自改成 DINE_IN。

### 5.3 不采纳的替代方案

| 方案 | 结论 | 原因 |
| --- | --- | --- |
| 只删除 `DINE_IN_MUST_BE_INTERNAL` | 不采纳 | provider candidate、binding 和 catalog 闭包仍失败，用户无法真实使用 |
| EXTERNAL+DINE_IN 直接按 TAKEAWAY 查询/绑定 | 不采纳 | 改变 capability 事实，掩盖外部系统差异，破坏 owner 能力边界 |
| 让 DINE_IN 外部模板不需要 provider | 不采纳 | `EXTERNAL` 的 provider 语义被绕过，渠道无法表达外部归属/绑定 |
| 复制一套“外部堂食 provider”旁路模型 | 不采纳 | 新增 owner/模型/operation，超出变更范围；现有 capability/binding 已足够承载 |
| 在销售菜单层兼容外部 DINE_IN | 不采纳 | 直接违反“门店销售菜单逻辑不变”和现有菜单 owner 判据 |

## 6. 数据、契约、owner 与迁移影响

### 6.1 数据模型

现有 `business_channel_template` 已有 `access_kind`、`order_kind`、`dine_in_form`、`provider_code`，数据形态足以表达新组合。核心表不需要新列，不需要新关系表，也不需要数据回填。变化只是在数据库 CHECK 中移除错误的跨字段耦合，同时继续保持 provider/access 的独立约束。

新增 migration 必须是 additive：

```text
DROP ck_business_channel_template_dine_in_form
ADD  CHECK(
       (order_kind = DINE_IN AND dine_in_form IN (POS, QR, KIOSK))
       OR
       (order_kind <> DINE_IN AND dine_in_form IS NULL)
     )
```

上面是约束语义，不是实施代码；真实 migration 名称、时间戳和 migration test 留到实施授权后决定。不能直接改写已执行的 `V20260819_230000_001`。

### 6.2 Contract

`BusinessChannelTemplateCreateRequest`/`UpdateRequest` 的核心字段已经存在，故本变更不应新增请求字段或新 operation。需要检查并按生成链同步的部分是：

- collaboration capability class 的闭集 enum 是否增加 `DINE_IN`；
- provider candidate query 的 capability 参数是否支持 `DINE_IN`；
- binding create/readback 的 capability enum 是否支持 `DINE_IN`；
- business-channel create/template 的 `x-error-codes` 和 generated error enum 是否移除旧的 active error；
- 前端 generated source 是否重新生成，而不是手工维护一个局部 enum；
- R5 edge contract implementation catalog 与 error-code disposition catalog 是否先完成 source 级更新，再运行 materializer/codegen，避免 generated 输出回生旧闭集。

契约变化只在 provider capability 决策成立时发生；核心 business-channel 请求形状保持不变。

### 6.3 Owner 边界

- business-channel owner 负责模板/渠道的四维规则、模板与 provider 的一致性、渠道创建时的再次校验。
- collaboration owner 负责外部系统 capability、provider enablement、provider business scope 和 binding capability。
- sales-menu owner 只负责销售菜单可维护渠道的资格投影与复核，继续排除外部渠道。
- 前端只消费 owner edge 的候选和 typed problem，不在页面自行推导 provider 能力或菜单资格。

跨 owner 只通过既有公开 read/command API；不新增跨 schema FK，不把 read edge 变成写权限。

## 7. UI/UX 影响

本需求的 UI 变化集中在 operations-admin 的 O2 “渠道模板新建/编辑” Drawer，不新增页面或新的交互 Journey。当前 Drawer 已使用项目现有 foundation；实现时应继续复用该 Drawer、表单、错误反馈和 query primitive，不在 app 内复制 foundation 能力。

### 7.1 目标交互

1. 选择订单类型 `DINE_IN` 后保留 `dineInForm`，不再强制把接入类型切回 INTERNAL。
2. 选择 `EXTERNAL + DINE_IN` 时，显示并启用外部接入档案，查询参数为 `capabilityClass=DINE_IN`；provider 显示名称、认证/绑定说明和当前可用状态由 owner readback 提供。
3. `DINE_IN` 的 POS/扫码/自助机选择对 INTERNAL 与 EXTERNAL 语义一致，都必填；切换到非 DINE_IN 时清除 `dineInForm`。
4. 切换为 INTERNAL 时清除 provider；切换为 EXTERNAL 时要求 provider，不将 provider 作为隐藏 stale value 保留。
5. 没有支持 DINE_IN 的 provider 时，显示“当前没有可用的外部到店点餐接入档案”类业务空态，并阻止保存；不能把空候选伪装为成功，也不能建议用户选择 TAKEAWAY。
6. 模板列表、模板详情、项目/门店渠道列表不因本变更新增“销售菜单资格”列；销售菜单页仍只显示内部门店到店/外卖渠道。

### 7.2 可访问性与测试控件边界

本轮是需求变更分析，不定义新的 testId roster，也不授权写 UI。进入 implementation-facing 详设时必须重新盘点 O2 真实动作节点：接入类型、订单类型、到店点餐形式、provider、保存、错误/空态；每个新或变更的动作都应有唯一 `*TestIds.ts` 键并绑定真实控件，不得用 label、CSS、XPath、Modal wrapper 或等待替代。

## 8. 未来验收与证据计划（本轮未执行）

以下是实施后必须覆盖的判据，不是当前已完成的测试结果，也不是当前授权下要运行的命令。

### 8.1 正向闭包

1. 指定 provider 能返回 `DINE_IN` capability；provider candidate 按 DINE_IN 查询仅返回符合 workspace enablement 的档案。
2. `EXTERNAL + DINE_IN + POS/QR/KIOSK` 在有对应能力的情况下可创建模板；owner readback 的四维/provider 事实正确。
3. 该模板可按既有渠道 create/binding 流程建立合法渠道，binding capability 为 `DINE_IN`，owner readback 与审计事实一致。
4. INTERNAL DINE_IN 与 INTERNAL TAKEAWAY 仍可创建/读回，并仍进入销售菜单候选。

### 8.2 负向与边界闭包

1. EXTERNAL+DINE_IN 缺 provider、provider 未启用、provider scope 不含 DINE_IN 时，返回 typed problem，且无模板/渠道/binding 部分写入。
2. provider 只支持 TAKEAWAY 时，EXTERNAL+DINE_IN 必须拒绝；不得按别名成功。
3. EXTERNAL+DINE_IN 的所有目标门店/项目规则仍按既有 owner scope、target 和 binding policy 执行。
4. 外部 DINE_IN 在销售菜单 candidate GET 中不存在；直接 `requireSalesMenuChannel` 被拒；`salesMenuChannelBelongsToStore` 仍仅用于归属/失败审计，不被误判为菜单资格。
5. project-level DINE_IN（internal/external）都不能成为销售菜单目标；既有 external TAKEAWAY/GROUP_BUY 也仍不能成为目标。
6. 现有菜单、publication、manual availability、inventory availability、target selection、价格和详情 readback 无变化。
7. migration 在干净数据库和已有合法数据上均成功；失败事务不留下半写入模板/渠道/binding。

### 8.3 运行证据边界

未来 backend acceptance 必须是真实 HTTP + 真实远端容器/数据库的全量 suite，区分 `CONTRACT`、`BUSINESS` 与 cleanup；不能用 focused 单场景拼出全量 PASS。browser L2 必须采用远端 Spring/DB/asset、本机 Vite/Playwright、HTTP/asset-only tunnel 的受管拓扑；不得启动本地 Spring、PostgreSQL tunnel、远端 Vite 或远端浏览器。本轮 `RUNTIME_EXECUTION=NOT_RUN`，不启动 DEV、不 reset、不 seed。

## 9. 实施前决策清单

| ID | 决策问题 | 当前状态 | 推荐处理 |
| --- | --- | --- | --- |
| D-01 | 哪一个真实 external system/provider 支持 DINE_IN？支持哪些 `dineInForm`？ | `DEXTER_DECISION_REQUIRED` | 指定 provider 后才更新 catalog/capability/seed；默认不改现有 MEITUAN/ELEME |
| D-02 | 新规则是否同时适用于 PROJECT 与 STORE 模板？ | `ASSUMED_MINIMAL_INTERPRETATION` | 若无收窄要求，沿用 policy 的全局解耦；若仅 STORE，需明确写入产品规则和验收矩阵 |
| D-03 | `DINE_IN_MUST_BE_INTERNAL` 是否从 active error closed set/runtime enum 删除？ | `RECOMMEND_REMOVE_ACTIVE_SEMANTICS` | 删除 active contract/feedback/generated 语义；历史 review/evidence 原样保留 |
| D-04 | 外部 DINE_IN 是否必须在本批形成可选 provider，还是仅先解耦模型规则？ | `DEXTER_DECISION_REQUIRED` | 建议不接受“可保存但永远无 provider”的半闭包；要么指定能力并实现闭包，要么明确延期并不声称可用 |

## 10. 实施顺序建议（不构成实施授权）

若 D-01/D-02/D-04 明确且形成 implementation-facing 详设，建议按以下顺序实施：

1. 先更新需求/决策与 active 设计中的旧规则，明确 provider capability 与销售菜单“不变”边界；
2. 扩展 capability source/schema/契约生成输入（若 D-01 需要），使 provider candidate/binding 有真实 DINE_IN 闭包；
3. 从两个 R5 source catalog 移除/退役旧错误的 active operation 语义，然后运行 materializer/codegen；
4. 新增 additive migration 替换 DINE_IN form CHECK；
5. 修改 business-channel owner policy/创建复核，保留所有其他校验；
6. 更新 operations-admin Drawer 与唯一 TestIds/L2 action 绑定；
7. 更新 unit/acceptance/seed/L2，加入外部 DINE_IN 正负路径与菜单排除路径；
8. 逐 CP 做需求、详设、memory 规范三维双读与 focused proof；全部 CP 完成后做整批三维对账；
9. 通过 fresh independent implementation review、Claude implementation review、全量 backend acceptance、browser L2 后，才可按另行授权执行 reset/DEV/seed。

## 11. Review 边界

本文件当前 `STATUS=PENDING_CLAUDE_DESIGN_REVIEW_AND_DEXTER_DECISION`。独立子 agent 的两轮 DESIGN review 已完成；仍请 Claude 与 Dexter 审查以下问题：

- 是否正确区分“外部 DINE_IN 经营渠道合法”与“外部 DINE_IN 可进入销售菜单”两个事实；
- 是否发现并完整覆盖了 policy、DB CHECK、capability source、provider candidate/binding、契约生成、前端 O2、seed/acceptance 的同根影响；
- 是否在没有真实 provider 决策时拒绝虚构能力；
- 是否避免为销售菜单增加外部渠道、菜单新语义、owner、operation 或模型；
- 是否保留了已有模板/渠道/菜单事实和错误恢复边界；
- 是否存在更小且更可靠的变更，或本分析遗漏的跨 owner/契约/用户可见风险。

要求 review 输出 `GO`/`GO_WITH_UNVERIFIED_UI`/`NO-GO` 与 `M/S/N`，并区分 `L1_ENGINEERING`、`L2_USER_VISIBLE`、`L3_UNVERIFIED`。未有运行证据的内容必须标记 `UNVERIFIED_REQUIRES_EVIDENCE`，不得将本分析、截图、旧 PASS 或静态文档当作动态验收。
