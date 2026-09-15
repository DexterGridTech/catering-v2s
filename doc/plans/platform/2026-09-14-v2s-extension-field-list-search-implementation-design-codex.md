SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# implementation-facing 详设：扩展字段列表展示与类型化搜索

```text
BUSINESS_SOURCE=doc/plans/platform/2026-09-14-v2s-extension-field-list-search-requirements.md#extension-field-business-source
JOURNEY_REFS=doc/decisions/2026-09-14-v2s-extension-field-list-search-journey.md#J-EXTENSION-FIELD-LIST-SEARCH
IA_REF=doc/plans/platform/2026-09-14-v2s-extension-field-list-search-ia-design-codex.md
INTERACTION_REF=doc/plans/platform/2026-09-14-v2s-extension-field-list-search-interaction-design-codex.md
AUTHORIZED=按 Dexter 2026-09-14 直接授权执行本详设 P0-P9、生产代码/契约/测试/seed source，以及完成后受管 reset/DEV/seed
NOT_AUTHORIZED=浏览器 L2、UAT、部署、Git
IMPLEMENTATION_AUTHORITY=true
RUNTIME_AUTHORITY=AUTHORIZED_R5_RUNTIME
RESET_DEV_SEED_AUTHORITY=AUTHORIZED_BY_DEXTER_2026-09-14
CURRENT_SESSION_AUTHORITY=IMPLEMENTATION_AND_MANAGED_RUNTIME_DIRECTIVE
DESIGN_STATUS=ACCEPTED_FOR_IMPLEMENTATION
INDEPENDENT_DESIGN_REVIEW=NO_GO_ROUND_2_FINDINGS_SELF_CLOSED
```

本文是当前实施的约束正本。主 agent 负责全部文件写入、受管执行和证据；P0-P9 生产代码、契约、测试、seed source 以及 P8 受管 reset/DEV/seed 均在 Dexter 当前直接授权内。browser L2、UAT、部署和 Git 不在本批授权内；Roadmap 只提供既有 R5 授权字段，不能扩展本任务边界。

## 0. 需求正本与非目标

五类平面宿主 `BRAND`、`TENANT`、`HEAD_COMPANY`、`STORE`、`CONTRACT` 在 operations-admin 与 platform-admin 的十个平面消费面中，只有 `definition.status = ENABLED AND definition.listDisplay = true` 的字段成为固定动态列，只有 `definition.status = ENABLED AND definition.searchable = true` 的字段成为固定动态搜索项；动态列不排序，动态搜索与核心条件按 `AND` 由对应实体 owner 计算，`total/items/page` 来自同一结果集；列表 item 统一返回 raw `extensionValues`，定义版本来自对应 `ExtensionDefinition.revision`，不使用实体 `extensionRuleRevision` 代替。

组织架构树保持现状：运营管理后台和运维管理后台的组织架构树只保留现有的名称/编码搜索；树接口、树页面、树详情都不改。`COMMERCIAL_GROUP`、`REGION`、`PROJECT` 的 `listDisplay` 与 `searchable` 均显示“不适用”、不可编辑、不产生任何消费；候选选择器也不属于本需求。

本批固定分母为 8 个 host、12 个 screen（2 个配置面 + 10 个平面列表）、7 个平面 list operation。树不是 screen、operation、seed、acceptance 或实现步骤；任何旧文档中的树扩展列、树扩展搜索、树 revision、树快照、树错误码、树 scenario 和“9 operations”均应删除或标记为历史非目标。五类 host 的配置 definition read 仍是定义来源，但不计入 7 个列表 operation。

## 1. 真实业务目标与方案比较

### 1.1 结构性问题

扩展字段定义已经由 extension owner 持有，实体 owner 也持有 `extension_values`，但定义的“是否列表展示/是否可搜索”尚未形成从配置、契约、owner 查询到两个后台列表的单一事实链。若只在经营租户列表补一处 UI，会继续产生以下根因：

- 前端只筛当前页，`total`、分页和权限边界不再代表同一集合；
- 每个列表自行解释 TEXT/NUMBER/DATE/BOOLEAN/SELECT，搜索结果不一致；
- platform 旧 `extensionFields[{name,value:string}]`、operations raw `extensionValues` 形成两套 wire/formatter；
- definition revision 漂移时旧控件和旧结果被当作成功；
- definition 读取、筛选条件和 5 张实体表的成本没有与每个 operation 分开测量；
- seed 仍把新增字段物化成 TEXT，导致 NUMBER/BOOLEAN/DATE 或缺 key 在 `reset + seed` 时才失败。

### 1.2 方案比较

| 方案 | 结果 | 结论 |
| --- | --- | --- |
| A：每个页面读 definition 后在当前页本地筛选，并按行补 detail | 改动小，但分页 total 错误、逐行请求、权限边界和类型语义分叉 | 拒绝：没有修 owner 集合事实 |
| B：每个 host 建一套专用动态列接口、参数和 read model | 可以表达需求，但复制 5 类 owner、10 个列表和多套 formatter，维护面随字段类型线性扩大 | 拒绝：超过当前需求，且违反同一事实只有一个住址 |
| C：definition owner 发布 snapshot；7 个平面 owner 在同一 Page 查询中接收受限 typed filter 并返回 raw values + definition revision；前端从同一 definition 生成控件/列 | 保留 owner、真实 Page、既有授权和 foundation；只补当前契约/查询缺口，可测量每 operation 成本 | **采用** |

我选了 C 而不是 A/B，因为它把定义、集合、值和页面状态分别放回各自 owner，不引入 MQ/read model/逐行请求，并能同时证明 `AND`、total/page、授权、类型和 revision recovery。

## 2. CP 总览

| CP | 主题 | owner | 主要输出 | 依赖 |
| --- | --- | --- | --- | --- |
| `CP-EXT-01` | definition flags、适用矩阵、配置 readback | extension/platform | 两个独立 flag、8 host catalog、revision/version/审计一致 | requirements、IA、interaction、现有 replace |
| `CP-EXT-02` | 7 个平面 operation 的 typed filter 与 Page 投影 | organization / contract / platform edge | `extensionFilters`、definitionRevision、raw values、server-side AND | `CP-EXT-01`、OpenAPI/codegen |
| `CP-EXT-03` | 共享 formatter、foundation、两个 app 的动态 UI | frontend foundation / platform-admin / operations-admin | 类型控件、固定动态列、错误恢复、稳定 testId | `CP-EXT-01..02`、interaction |
| `CP-EXT-04` | 5 表规模/索引/预算、seed 与 acceptance | backend owners / scripts | EXPLAIN 计划、每 operation budget decisionRef、可执行 fixture/seed | `CP-EXT-01..03` |
| `CP-EXT-05` | 三维对账与交付复核 | 主 Codex + fresh 独立只读 reviewer | step/whole-scope/逐代码对账 | `CP-EXT-01..04` |

## 3. 横切机制对照表（固定 17 行）

| 机制 | ① 现成能力/规范（精确位置） | ② 可证伪观察与档位 | ③ 无现成能力时的形态 | ④ 本批适用全集 |
| --- | --- | --- | --- | --- |
| 读侧节点授权 | `doc/platform/backend-coding-standard.md` 授权判别式；各 list controller 的现有 workspace/project read guard；`ExtensionDefinitionService#requireDefinition` | `[static]` 7 list route 先过原 owner/edge guard；`[acceptance]` 越权 workspace/project 不返回扩展值 | authorization → definition snapshot → owner query；不能前端补查或扩大 scope | 7 list reads、5 类 definition reads |
| 写授权与 grant 复核 | `ExtensionDefinitionService#replaceDraft` → `requireEnabledPlatformAdministrator(actor)`；现有 `expectedVersion` | `[static]` replace 只有平台启用管理员；`[focused]` 未登录、停用平台管理员、operations session 均拒绝 | 只有 definition owner 整组 replace；消费端无 write path | definition replace；7 list reads 为 N/A |
| 跨 owner 写与事务 | `ExtensionDefinitionPersistence#updateDefinition`、现有 revision/audit 写边界 | `[focused]` invalid/conflict 后 definition、revision、audit 不出现部分提交 | 本批不写实体 owner；definition replace 复用同一事务和 CAS | definition replace |
| 集合形态与分页 | 7 个现有 Page operation；foundation `usePageQuery`/`adminListState` | `[acceptance]` pageSize=1 且有多条时，第二页和 total 仍来自同一过滤集合 | owner server-side Page；前端不 slice、不按当前页过滤 | 7 flat Page |
| 缓存失效 / 改完刷新什么 | `useDrawerFormLifecycle`、`useSubmissionLifecycle`、foundation `usePageQuery`；现有 `ExtensionsPage#reloadCurrent` | `[focused]` 保存只重读当前 host definition；stale 最多一次 definition bypass-cache + 当前 list 重取 | query identity 含 workspace/host/category/filter/revision；同版本重拒绝即停止 | 2 config screen、10 flat screen |
| **RTK 数据读取与加载判定** (`currentData` / `isFetching`) | `doc/platform/frontend-coding-standard.md §3-B`；各 app RTK generated query | `[focused]` 参数变化时旧 `currentData` 不当新成功；`isFetching` 明确重取态 | 分离初始加载、重取、错误和成功；不能以 `isLoading=false` 报成功 | 12 screens 的 definition/list reads |
| **同一事实只有一个住址** | `frontend-coding-standard.md §3-E`；definition owner、owner Page、foundation query cache | `[static]` 控件/列只从 definition；值只从 Page raw values；无 local server mirror | local state 只保存 filter draft/query identity，不复制 definition/value | flags、typed fields、raw values、revision |
| **失败可见且原因不得改写** | `frontend-coding-standard.md §3-D`；现有 transport problem conversion 与 error surface | `[focused]` invalid/stale/auth/list error 都可见；400 不变空成功 | 保留 typed problem 和 correlation；不 fallback 文本、旧成功或空 Page | 7 list、definition read/replace、12 screens |
| owner 错误到 HTTP 的映射与注册处 | 活动 `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json` 的 `errorSets` + `operationErrorAugmentations` + 可选 `operationErrorSelectionRules`；code ownership/metadata 由 `doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json` 提供；`r5-edge-materialize.mjs` → `EdgeProblemCode.java`/`ContractProblemAdvice`/generated mapping | `[static]` 七个目标 operation 各自 closed set 含两个新增 code，materialized path `x-error-codes`、generated enum、advice 和两个 face mapping 一致 | owner exception → edge typed problem → generated client → UI；不改全局 `AUTHZ_READ`，不发明 `OperationsApiProblem` | `EXTENSION_DEFINITION_REVISION_STALE`、`EXTENSION_FILTER_INVALID` 及既有 code |
| 幂等键构成与重放语义 | `ExtensionDefinitionService#replaceDraft` 现有 `Idempotency-Key`/receipt；`frontend-coding-standard.md §3-G` | `[focused]` 同 key+同 body 得同一 readback；同 key+不同 body 被拒绝；read 不伪造幂等 key | 仅 definition replace 发送幂等事实；filter/list 是 read | definition replace |
| **该用生成物的地方不得手搓字符串** | `contracts/openapi` → edge codegen；`apps/frontend/*/src/app/api/generated`；generated RTK request | `[static]` parameter/schema/problem/model 可从 source diff 追到 generated；UI 不拼 URL/HTTP 类型 | OpenAPI 唯一 HTTP source；logical filter serializer 只序列化 generated logical type | 7 list paths、definition paths、generated model/request |
| 日志落点与脱敏字段 | `AGENTS.md` observability hard constraint；`doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md` | `[acceptance]` 日志有 run/phase/operation/identity/query shape/count；检索无 raw value/token | 记录 fieldKey/type/revision hash/条件数量/结果计数/错误分类；不记录 raw payload | 7 list、definition replace、受管 acceptance/seed |
| 迁移回填与可逆性 | `V20260726_160000_000__extension_and_role_json_storage_alignment.sql`；当前 JSONB persistence | `[static]` 确认 flags 在 definition JSONB 中，不制造伪迁移；若新增索引有 additive SQL | 清库 seed 直接新形状；索引迁移 additive、无 runtime DDL；不回填实体旧值 | extension definition JSONB、5 表 index |
| 前端共享行为(Drawer/列表/表单生命周期) | `libraries/frontend/admin-ui-foundation/src/index.ts`：`useDrawerFormLifecycle`、`useSubmissionLifecycle`、`useAsyncGenerationGuard`、`useOverlayLock`、`usePageQuery`、`adminWideDrawerSurfaceProps` | `[static/focused]` 两 app 只接 foundation；保存、重取、错误和唯一滚动区有 focused 断言 | foundation 未覆盖的仅是业务 definition/filter mapping，必须有唯一 capability 名称和理由 | 2 config、10 flat |
| 候选/下拉数据源 | 现有 `useOrganizationCandidates`、合同候选 query；definition `options` | `[static]` dynamic filter 不调用 candidates；合同核心 tenant/store/project 条件仍走原 owner | SELECT 动态 options 唯一来自当前 definition；候选只服务关系字段 | 5 平面 host；候选页面为 N/A 反例 |
| 编码与名称呈现 | foundation `NameCodeText`、`EllipsisTooltip`；现有各 list column definitions | `[focused]` 长值截断+tooltip；核心名称/编码仍使用既有显示和排序 | field label/value 不替代核心名称/编码；技术 key/revision 仅日志/边界 | 10 flat、2 config |
| **会同时坏的东西是否已声明为原子组** | `doc/platform/foundation-charter.md §5-C`；本详设 §12 | `[static]` flags、filter/page wire、UI/seed 每组都有 contract/owner/app/test/fixture 来源 | 任一组中 contract/owner/generated/UI/test/seed 未同步则整组 OPEN | `CP-EXT-01..04` 及每个 operation budget |

## 3a. UI/testId 前置复核

本批有 12 个 UI-bearing screen，但没有 L2 执行授权。Dexter 已确认交互工件的视觉 IA、low-fi 形态和用户文案；实现阶段仍由主 agent 建立 app `*TestIds.ts` 唯一源，最后由 fresh 独立只读 reviewer 对真实动作节点复核。当前保持：

```text
UI_DESIGN_REVIEW=CONFIRMED_2026-09-14
TESTID_REVIEW=OPEN
L2_SCRIPT_ADMISSION=BLOCKED
```

| case/action | UI owning source | app `*TestIds.ts` 唯一源 | 真实节点 | 最低验证 | 当前 |
| --- | --- | --- | --- | --- | --- |
| 宿主选择、配置表、打开编辑 | `ExtensionFieldManagementPage.tsx` / `ExtensionsPage.tsx` | platform extension testId source（实现阶段新增） | MenuItem/Button 本体 | static + focused | OPEN |
| 两个 flag Select 与 Drawer 保存/取消/重试 | `ExtensionDefinitionEditDrawer.tsx` | platform extension testId source | Select option、Button 本体 | static + focused | OPEN |
| operations 五类 dynamic search/column | `BusinessEntityManagementPage.tsx`、`StoreManagementPage.tsx`、`ContractManagementPage.tsx` | operations extension list testId source | Input/InputNumber/DatePicker/Select/表头真实节点 | static + focused | OPEN |
| platform 组织/合同 dynamic search/column | `PlatformReadPage.tsx` 及 owning presentation | platform extension testId source | Tab、控件、表格真实节点 | static + focused | OPEN |
| 合同项目先决条件、分页、错误重试 | `ContractManagementPage.tsx` 及各 list owner | app-specific constants | 真实 Select/Pagination/Button | static + focused | OPEN |

testId 必须包含 host，动态字段使用 stable `fieldKey`；Drawer draft 使用 existing key 或一次生成的 stable draft identity，绝不能使用 index。L2 binding 只能消费该常量，不能用 role/label/placeholder/text/index/CSS/XPath 或散写 `data-testid` 补缺。

## 4. 每个 CP 的门控

| CP | 可证伪失败条件 | 不变量 | FORBID | 最低验证 | 当前 |
| --- | --- | --- | --- | --- | --- |
| `CP-EXT-01` | readback 缺 flag、N/A 可编辑、历史字段丢值、conflict 部分写入 | 8 host 适用矩阵、revision、audit 和字段 order 同一 owner 事实 | 把 N/A 当 false、局部写 definition、复制 app-local definition | extension focused + HTTP acceptance | OPEN |
| `CP-EXT-02` | 任一 list 只筛当前页、total 错、跨 host 串字段、无 revision 或 raw values | 7 operation 均 server-side AND；Page 同一集合；owner 复核 scope/type/status | 逐行 detail、客户端分页/筛选、静默文本 fallback | owner focused + backend acceptance + logs | OPEN |
| `CP-EXT-03` | 控件类型错误、dynamic 列可排序、foundation 未接入、错误丢失、testId 不稳定 | 12 screen 状态/容器/焦点/文案与交互工件一致 | 第二套 formatter/lifecycle、技术 metadata UI、树改动 | static/focused + Dexter visual + fresh review | OPEN |
| `CP-EXT-04` | 100k 计划缺失、index 无 EXPLAIN/写成本、budget 无独立 decisionRef、seed 旧形状 | 五表规模和每 operation 成本可测；seed definition→values→change 可执行 | runtime DDL、每 key expression index、删业务事实降预算、reset/seed 当前执行 | static + measured acceptance after authorization | OPEN |
| `CP-EXT-05` | §12 缺链、步骤 OPEN 未复核、整批只汇总不重读 | 每个变更点前后双读，step/whole/逐代码均 MATCHED | 用历史 verdict、handoff checker、静态绿代替 fresh review | fresh independent read-only review + main reconciliation | OPEN |

形态理由：C 的 owner Page、definition snapshot 和 foundation 组合正好覆盖本批真实缺口；不把树、read model、通用 outbox、MQ、逐行详情或第二个注册表带进来。

## 5. operation / path / face / 集合形态

每个 route 保持一个 `x-consumer-faces`；下表的样本数仅是现有 calibration 基线，不是规模上界。七个列表均必须以每个 workspace/project 作用域不超过 100,000 行为设计上界，且在 100k 证明计划中使用真实 core scope 条件。

| 业务意图 | operationId | method/path | face | 集合形态与规模 | definition source / raw wire |
| --- | --- | --- | --- | --- | --- |
| 品牌列表 | `getOperationsOrganizationBrands` | `GET /api/operations/group-workspaces/{groupWorkspaceKey}/organization/brands` | operations-admin | `Page<BrandListItem>`；workspace scope ≤100k；基线 8 | `getOperationsOrganizationBusinessEntityExtensionDefinition`；item raw `extensionValues` |
| 经营租户列表 | `getOperationsOrganizationTenants` | `GET /api/operations/group-workspaces/{groupWorkspaceKey}/organization/tenants` | operations-admin | `Page<TenantListItem>`；workspace scope ≤100k；基线 8 | 同上 |
| 总公司列表 | `getOperationsOrganizationHeadCompanies` | `GET /api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies` | operations-admin | `Page<HeadCompanyListItem>`；workspace scope ≤100k；基线 8 | 同上 |
| 门店列表 | `getOperationsOrganizationStores` | `GET /api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores` | operations-admin | `Page<StoreListItem>`；workspace scope ≤100k；基线 13 | `getOperationsOrganizationStoreExtensionDefinition`；raw `extensionValues` |
| 合同列表 | `getOperationsContracts` | `GET /api/operations/group-workspaces/{groupWorkspaceKey}/contracts` | operations-admin | `Page<ContractListItem>`；有效 project scope ≤100k；基线 8 | `getOperationsContractExtensionDefinition`；raw `extensionValues` |
| 平台组织概览平面列表 | `getPlatformOrganizationOverviewPage` | `GET /api/platform/group-workspaces/{groupWorkspaceKey}/organization-overview` | platform-admin | `Page<OrganizationOverviewItem>`；每 Tab scope ≤100k；基线 6；identity=`category+type` | `getExtensionDefinition(entityType)`；raw `extensionValues` |
| 平台合同概览 | `getPlatformContractOverviewPage` | `GET /api/platform/group-workspaces/{groupWorkspaceKey}/contract-overview` | platform-admin | `Page<ContractOverviewItem>`；workspace/project scope ≤100k；基线 6 | `getExtensionDefinition(CONTRACT)`；raw `extensionValues` |

不把 8 host 误写为 8 个 list operation；`COMMERCIAL_GROUP`、`REGION`、`PROJECT` 只在 config catalog/definition 适用矩阵中出现，所有列表消费均为 N/A。

## 6. Contract、owner、wire 与 typed filter

### 6.1 Definition wire

现有 `ExtensionDefinitionReadback.Field` 的 tuple 为 `(fieldKey,label,fieldType,required,options,status,displayOrder,displaySuffix)`，实现阶段需要在 contract source 和 owner readback 中增加：

```text
listDisplay: boolean | null
searchable: boolean | null
```

平面五类 host 使用 `false/false` 默认值且可编辑；`REGION`/`PROJECT` 等 tree/non-flat host 的两个值均为 `null`，显示“不适用”且不可编辑。`status != ENABLED` 的 definition 不消费；flag 仍必须作为完整 definition 事实保存和回读。`ExtensionDefinition.revision` 是唯一 definition version，不用实体 `extensionRuleRevision` 替代。

### 6.2 Query parameter encoding

七个 list operation 共享同一逻辑结构，但不能把逻辑对象直接声明成 OpenAPI `content` 参数并同时依赖 `schema`。每个 operation 都必须注册以下两个 query parameter；`required=false` 是 wire contract，非空扩展条件时由 owner 施加条件性必填：

```yaml
- name: extensionFilters
  in: query
  required: false
  schema:
    $ref: '#/components/schemas/ExtensionFilterQuery'
- name: definitionRevision
  in: query
  required: false
  schema:
    type: integer
    format: int64
    minimum: 0
```

共享 logical/wire component 只定义一次；`ExtensionFieldType` 是新增的 shared enum component，`ExtensionFilterQuery` 是 scalar wire component，二者都必须进入 active edge catalog 的 component baseline。由于 Heritage source hash-locked 且只读，active catalog 的 `componentOverrides.ExtensionDefinition` 与 `componentOverrides.ExtensionDefinitionUpdateRequest` 必须把两个 definition `type` 属性的 inline enum 替换为真实 `$ref` 到 `ExtensionFieldType`，不能修改 Heritage 原文。七个 operation 的 query parameter 在 active catalog 以 symbolic `schema.ref = ExtensionFilterQuery` 引用；materializer 必须输出真实 OpenAPI `$ref`。

```json
{
  "ExtensionFilter": {
    "type": "object",
    "required": ["fieldKey", "type", "value"],
    "properties": {
      "fieldKey": {"type": "string"},
      "type": {"$ref": "#/components/schemas/ExtensionFieldType"},
      "value": {"type": "string", "description": "按声明的 type 编码后的 wire value"}
    },
    "additionalProperties": false
  }
}
```

另新增：

```json
{
  "ExtensionFieldType": {
    "type": "string",
    "enum": ["TEXT", "NUMBER", "DATE", "BOOLEAN", "SELECT"]
  },
  "ExtensionFilterQuery": {
    "type": "string",
    "description": "Percent-encoded JSON array of ExtensionFilter objects",
    "x-v2s-logical-schema": {
      "type": "array",
      "items": {"$ref": "#/components/schemas/ExtensionFilter"}
    }
  }
}
```

`ExtensionFilter.value` 的 wire 类型固定为 `string`；UI typed draft 的 NUMBER/BOOLEAN 等原生类型只存在于控件状态，serializer 先使用 generated logical `ExtensionFilter[]` 按声明的 `type` 编码，parser 在 owner 边界按同一 `type` 解码和校验。`ExtensionFilterQuery` 的 `$ref` 使 scalar parameter 与 logical component 进入 `edge-codegen` 的 reachable closure；`x-v2s-logical-schema` 中的 `$ref` 使 `ExtensionFilter` 和 `ExtensionFieldType` 继续进入 generated chain。不得在任一 app 手写第二套 DTO、enum 或 URL 编码。

`extensionFilters` 的 JSON 数组由唯一 serializer/parser capability 负责。owner 先做 percent decode、JSON syntax、encoded length、顶层 array、item shape 和原始数组上限校验；非法输入无论是否携带 stale revision 均直接返回 `400 EXTENSION_FILTER_INVALID`，不读取 definition snapshot。未携带参数或解码后为零元素数组（包括 `extensionFilters=[]`）等价于没有扩展条件，此时不发送 `definitionRevision`，owner 不读取或比较 revision。只有非空数组才要求满足 `integer/int64/minimum=0` 的 `definitionRevision`；缺失返回 `reason=DEFINITION_REVISION_REQUIRED`，不合约的值返回 `reason=DEFINITION_REVISION_INVALID`，二者均在 definition snapshot 前返回 typed invalid。通过后才读取当前 snapshot、比较 revision，并在 revision 相等后按当前 enabled + searchable 字段数校验语义 `maxConditions`、未知 key、重复 key、disabled/not-searchable/type/options 等。

### 6.3 Owner validation 与问题码

每个 list owner 的判定顺序固定为：授权/scope → raw query decode/shape/length/原始数组上限 → 空数组无扩展条件直接走既有 Page；非空缺失或非法 `definitionRevision` 先返回 typed invalid → 读取当前 definition snapshot → 比较 revision，过期先返回 stale → revision 相等后全量校验所有 filters → 同一 owner query 计算 core+extension AND Page。该顺序禁止以 stale revision 掩盖 malformed filter，也禁止以 definition 读取替代前置 wire 校验。

- client `definitionRevision != current revision`：一次返回 `409 EXTENSION_DEFINITION_REVISION_STALE`，payload 至少含 current revision 和可重读标识；edge 映射使用仓内实际 `EdgeProblemCode.java`、`ContractProblemAdvice` 与 error registry 生成链。
- revision 相等但任意 filter unknown/disabled/not searchable/type mismatch/options mismatch/shape mismatch/duplicate：一次汇总返回 `400 EXTENSION_FILTER_INVALID`，payload 逐条包含 field identity、reason code 和 expected type；不执行部分过滤，不返回空成功。
- 既有 definition invalid、authorization、not found 等 code 沿活动 edge catalog 的 `errorSets` + `operationErrorAugmentations` + 可选 `operationErrorSelectionRules` 解析，再由 `r5-edge-materialize.mjs` 写入 path `x-error-codes`；disposition catalog 只提供两个新增 code 的 ownership/metadata，最终进入 `EdgeProblemCode.java`、`ContractProblemAdvice` 和两个 consumer face generated mapping；不创建不存在的 `OperationsApiProblem`。
- `AUTHZ_READ` 不包含两个新增 code。普通业务读接口的 closed error set 采用 operation-scoped augmentation；实现时在 active edge catalog 为 `getOperationsOrganizationBrands`、`getOperationsOrganizationTenants`、`getOperationsOrganizationHeadCompanies`、`getOperationsOrganizationStores`、`getOperationsContracts`、`getPlatformOrganizationOverviewPage`、`getPlatformContractOverviewPage` 各登记 `[EXTENSION_DEFINITION_REVISION_STALE, EXTENSION_FILTER_INVALID]`，不把两个 code 泛化加入 `AUTHZ_READ`。focused proof 必须逐 operation 检查 materialized `x-error-codes` 与 generated closure。
- platform-admin 的 authorization 文案以“启用的平台管理员”为准；operations session、未登录和已停用平台管理员均被拒绝。错误日志不写 raw filter value。

同一页面只允许一次 stale recovery：绕过缓存读取 definition，清理失效动态条件、保留核心条件、回第一页并重发一次；同 revision 再次 stale/invalid 则停在可见错误和手动重试，不轮询或盲重试。

手动重试走同一恢复流程，下界取自最近一次 stale 响应，由页面持有。历史 field key 保留规则：已分配的 `field_N` 删除后不得被后续 definition 重用；审计记录上线之前删除的 key 不在保留范围内。

## 7. 类型语义、formatter 与查询谓词

### 7.1 唯一 formatter

foundation 当前没有 extension formatter。实现阶段新增一个能力命名的唯一 formatter（建议 `libraries/frontend/admin-ui-foundation/src/extension/formatTypedExtensionValue.ts`，最终锚点以实现前源码复核为准），由 operations-admin 和 platform-admin 共同消费；definition 字典只由各自 app 的 generated/read model 提供。formatter 输出用户可见字符串，不接收 raw server payload 以外的第二份状态。

| type | 搜索值与匹配 | 列显示 |
| --- | --- | --- |
| `TEXT` | trim；locale-neutral lower-case contains；`%`、`_`、escape 字符按字面转义 | 原值字符串，长值 `EllipsisTooltip` |
| `NUMBER` | UI typed draft 为数字；wire `value` 为 JSON string，owner 按数字解析后精确相等；非法/NaN/Infinity invalid | 按既有数字呈现，不以字符串 contains |
| `DATE` | ISO date，按自然日精确相等；时区归一化规则在 owner helper 单测固定 | 既有日期格式 |
| `BOOLEAN` | UI typed draft 为 true/false；wire `value` 为 `"true"`/`"false"`，owner 按布尔解析后精确相等；UI 三态未筛选不发 filter | 是/否；空值显示既有 empty 表示 |
| `SELECT` | 当前 definition options 中的精确值；失效 option invalid | 当前 option label/value 映射 |

### 7.2 唯一 owner/SQL predicate

后端不得在五个 owner 各自拼一套 predicate。实现阶段必须先在当前模块复用或新增一个能力命名的共享 capability（例如 `ExtensionFilterPredicateBuilder`，不是流程/Journey 名），并由所有 flat owner 调用；Java/SQL 只在该 capability 中完成：

- JSONB key existence/type validation 与 exact equality；
- TEXT contains 的 trim/case/escape；
- NUMBER/DATE/BOOLEAN/SELECT 的 typed equality；
- current definition status/searchable/options 校验与 invalid reason；
- core workspace/project predicates 与 extension predicate 的 AND 合并。

SQL 中 `%`、`_` 和 escape 字符必须明确 escape，不能将用户文本直接作为 LIKE pattern。字符串规范化必须与 formatter 的可复现测试共享同一语义，但不能把前端结果当作 owner 判定。

## 8. 100k、五表索引与查询计划

### 8.1 真实表全集

以下五张表的 `extension_values JSONB NOT NULL DEFAULT '{}'::jsonb` 是本批数据库设计全集：

```text
organization.brand
organization.tenant
organization.head_company
organization.store
contract.store_contract
```

每个 workspace/project flat scope ≤100,000 行；增长驱动是实体主数据行数，不是 field key 数量。不能通过限制可配置字段数、删扩展值或降低 owner 复核来“满足预算”。

### 8.2 查询候选与 index/scan 选择

| 类型 | 首选候选 | 判定/替代 | 禁止 |
| --- | --- | --- | --- |
| SELECT/NUMBER/DATE/BOOLEAN | 按 key/value 的 JSONB exact predicate；候选使用每表通用 `GIN (extension_values jsonb_path_ops)` | 以真实 core scope + 100k 的 `EXPLAIN ANALYZE BUFFERS` 判断是否保留；若选择 scoped scan，必须记录理由 | 每个 runtime field key 建 expression index |
| TEXT contains | 先验证 core scope 下的 bounded scan；若 100k 计划不可接受，再评估每表一个通用 `lower(extension_values::text) gin_trgm_ops` 候选并做 JSONB exact recheck | 仍需 `EXPLAIN ANALYZE BUFFERS`、命中率、排序/分页与写成本；不能只凭 index 存在即 PASS | 每 key expression index、无 recheck 的 trigram 假命中 |

若实际采用通用 GIN/trigram，Flyway 只做 additive migration，参考 `apps/backend/catering-business-server/src/main/resources/db/migration/V20260815_020000_000__catalog_item_short_name_column.sql` 的 `pg_trgm`/`btree_gin` 能力；绝不在 runtime 创建 DDL。若 100k bounded scan 已满足测量目标，则不新增 TEXT index，保留查询计划证据。

### 8.3 计划与写成本证明

每张表、每个 relevant operation 至少准备：空扩展值、一个 searchable equality、一个 TEXT contains、多个 AND 条件、未命中、跨 page 五组 EXPLAIN；使用真实 workspace/project 条件、`EXPLAIN ANALYZE BUFFERS`、实际 pageSize 和 `total/items/page`。记录：

- planner 是否先使用 workspace/project scope，再用 JSONB/trigram 或 bounded scan；
- 过滤后 total 与 page items 是否同一集合；
- false positive JSONB recheck 数量；
- index 写放大（每次 `extension_values` 更新要维护的通用 GIN/trigram index 数、写耗时和 storage）；
- 读取与更新的 p95/最大观测，以及无 index 的替代成本。

不能用当前 8/13/6 条 DB operation 样本代替 100k scale proof；scale、DB operation count 和业务事实是三个不同维度。

## 9. 七个 operation 的 budget delegation

校准中的 8/8/8/13/8/6/6 是七个 operation 的 DB operation count FIXED baseline，不是规模上界，也不是实施后测量。若实现引入 definition read，至少会触发 definition status + definition persistence 事实；下表的 `to` 仅是待测 provisional ceiling，不是已测事实。每一条 operation 必须单独形成 decisionRef，不得 grouped。

| operation | current fixed from | decisionRef | authority | provisional to | measuredMax | 三次测量要求 | 状态 |
| --- | ---: | --- | --- | ---: | --- | --- | --- |
| `getOperationsOrganizationBrands` | 8 | `DECISION_EXT_FILTER_BUDGET_BRANDS_20260914` | `IMPLEMENTATION_AGENT` | 10（未测） | `UNMEASURED` | from=8 / to=10 / measuredMax=3 次真实运行最大值 | `OPEN_UNTIL_MEASURED_AND_AUTHORIZED` |
| `getOperationsOrganizationTenants` | 8 | `DECISION_EXT_FILTER_BUDGET_TENANTS_20260914` | `IMPLEMENTATION_AGENT` | 10（未测） | `UNMEASURED` | 同上 | `OPEN_UNTIL_MEASURED_AND_AUTHORIZED` |
| `getOperationsOrganizationHeadCompanies` | 8 | `DECISION_EXT_FILTER_BUDGET_HEAD_COMPANIES_20260914` | `IMPLEMENTATION_AGENT` | 10（未测） | `UNMEASURED` | 同上 | `OPEN_UNTIL_MEASURED_AND_AUTHORIZED` |
| `getOperationsOrganizationStores` | 13 | `DECISION_EXT_FILTER_BUDGET_STORES_20260914` | `IMPLEMENTATION_AGENT` | 15（未测） | `UNMEASURED` | 同上 | `OPEN_UNTIL_MEASURED_AND_AUTHORIZED` |
| `getOperationsContracts` | 8 | `DECISION_EXT_FILTER_BUDGET_CONTRACTS_20260914` | `IMPLEMENTATION_AGENT` | 10（未测） | `UNMEASURED` | 同上 | `OPEN_UNTIL_MEASURED_AND_AUTHORIZED` |
| `getPlatformOrganizationOverviewPage` | 6 | `DECISION_EXT_FILTER_BUDGET_PLATFORM_ORG_20260914` | `IMPLEMENTATION_AGENT` | 8（未测） | `UNMEASURED` | 同上 | `OPEN_UNTIL_MEASURED_AND_AUTHORIZED` |
| `getPlatformContractOverviewPage` | 6 | `DECISION_EXT_FILTER_BUDGET_PLATFORM_CONTRACT_20260914` | `IMPLEMENTATION_AGENT` | 8（未测） | `UNMEASURED` | 同上 | `OPEN_UNTIL_MEASURED_AND_AUTHORIZED` |

只有同时满足以下双重准入，实施 agent 才能在实施授权后提出逐 operation 放宽：

1. 三次测量证明没有删除/合并/弱化业务事实、owner 复核、事务、幂等、并发锁、typed problem、审计或 authoritative readback；
2. 证明已实际复用通用 definition read、predicate、formatter、foundation 和 generated 能力，不存在可消除的重复读取或 fan-out。

每个 decisionRef 必须写 from/to/measuredMax、三次运行的证据路径、被拒替代方案及成本（不加预算、缓存/预取、按行补读、专用 index/read model 等）并保留 red mutation。未获授权的上调保持 OPEN；预算不能用于 field 数量、operation 身份/数量、契约/模型或未决产品语义。

## 10. 声明—传递—消费矩阵

| fact | declaration | transfer | consumption | proof |
| --- | --- | --- | --- | --- |
| 两个 flag 与适用性 | requirements/IA；`ExtensionDefinition` schema | definition readback `definitions[]` + revision | config table/Drawer；flat dynamic column/search | contract focused + readback HTTP |
| raw extension value | 5 表 `extension_values` 与 owner Page 规则 | 7 list response `extensionValues` | 10 flat list row/formatter | owner HTTP + frontend focused |
| definition revision | `ExtensionDefinition.revision` | list request `definitionRevision` / response metadata | owner stale check、一次 recovery | HTTP problem + focused |
| typed filter | logical `ExtensionFilter` component | scalar query `extensionFilters` JSON string | owner parser/predicate；前端 typed controls | codegen/static + owner HTTP |
| collection shape | IA `collectionShapeAndScale` | Page request/page response | server total/items/page，客户端无 slice | acceptance pageSize=1 |
| authorization | current owner/edge guards | edge method/owner call | scope-clamped Page and definition | static + authorization acceptance |
| error mapping | error registry + typed code | `EdgeProblemCode.java`/`ContractProblemAdvice`/generated mapping | visible error/retry，不变空成功 | static + focused/HTTP |
| refresh/recovery | IA navigation/recovery | foundation invalidation/readback calls | current host/Tab/flat query only | focused state test |
| formatter semantics | foundation formatter contract | generated model/raw value → formatter | column text and form display | shared formatter tests |
| budget/scale | §8/§9 per operation | EXPLAIN/log/decisionRef | no unapproved ceiling claim | measured acceptance |
| logs/privacy | observability standard | managed run events | stage/operation/count/error only | log inspection |

## 11. owner API 与消费者清单

以下是 implementation-facing 的能力 API 设计；每个声明都有消费者，不新增零调用者 command。

| owner/capability | 消费者（精确路径/符号） |
| --- | --- |
| `ExtensionDefinitionService#readDefinition` / 现有 `getExtensionDefinition` mapping | `ExtensionsPage.tsx`、operations definition hooks、`PlatformReadPage.tsx`、`getExtensionDefinition` generated client |
| `ExtensionDefinitionService#replaceDraft` | `ExtensionDefinitionEditDrawer.tsx` 的唯一保存动作 |
| planned shared `ExtensionFilterParser`/`ExtensionFilterPredicateBuilder` | 7 list owner query：organization brand/tenant/head/store、contract、platform organization/contract |
| planned shared typed extension formatter | operations 三类页面、store、contract、platform organization/contract list surfaces |
| 7 list owner Page read methods | 对应 7 个 generated operation 及页面 query hook |
| definition revision stale/invalid problem mapping | 7 edge routes、两 app transport/error surfaces |

## 12. §9a 实施前全链同步变更清单

这是实施前必须建立并实施后用同一清单回读的完整分母；未列出的消费只有在找到反例后才可补 `N/A`。

| 变更事实 | 契约/唯一生成源/生成物 | 后端 owner/edge/migration | 前端 model/surface/state | focused/static/HTTP/L2 测试 | fixture/seed/executor | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| `listDisplay`、`searchable` 两 flag | `contracts/openapi/components/extension/extension.schemas.json`；generated definition models | `ExtensionDefinitionReadback.Field`、`ExtensionDefinitionService`、`ExtensionDefinitionPersistence`；无实体值迁移 | `ExtensionFieldManagementPage.tsx`/`ExtensionsPage.tsx`、Drawer、配置表 | extension focused、OpenAPI/codegen checks；L2 N/A 当前未授权 | `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json`、executor、seed plan | 同步修改 + generated 派生 |
| definition source/revision | 7 个 list 对应 definition operations；generated read models | operations/platform definition edge 与 owner status/read | 10 flat surfaces 的 query identity、dynamic controls | `OrganizationOverviewPresentation.test.ts`、`OrganizationOverviewFilters.test.ts` 及各 list tests | definition fixture/readback assertions | 同步修改 |
| raw `extensionValues` list wire | 7 list path response schema/generated Page models | organization/contract owner mapping；platform edge 不再保留不一致的 `extensionFields` 旁路 | operations raw values；`PlatformReadPage.tsx`、presentation/model | 7 owner HTTP + platform presentation/filter focused | r5 fixture values、executor value mapping | 同步修改，必要时 generated 派生 |
| `ExtensionFieldType`、`ExtensionFilter` + `ExtensionFilterQuery` | active edge catalog component baseline、7 path parameter symbolic `$ref`；materialized OpenAPI；generated request/logical types | shared parser/predicate；7 owner edge/controller；无第二 serializer | 两 app query arg builder、typed controls | codegen reachable/schema focused + parser/predicate + HTTP invalid cases | fixture includes each type/invalid/duplicate/empty array | 同步修改 |
| `definitionRevision` stale | path parameter/response/problem registry；generated problem | owner revision compare；`EdgeProblemCode.java`、`ContractProblemAdvice` | once-only recovery state；visible stale error | HTTP 409 + frontend recovery focused | revision-changing fixture/seed sequence | 同步修改 |
| `EXTENSION_FILTER_INVALID` | error registry → generated enum/mapping | owner invalid aggregation | invalid control/error summary | HTTP 400 all-invalid aggregation + UI focused | invalid shape/type/options cases | 同步修改 |
| typed formatter/predicate semantics | no existing extension formatter；planned unique foundation capability | planned shared Java/SQL capability | both apps consume same formatter；no local duplicate | shared formatter + owner predicate tests | all five field types, `%/_`、empty/null | 新增唯一能力 + 同步测试 |
| five table index/100k proof | additive Flyway source only if measurement selects index | `organization.brand/tenant/head_company/store`、`contract.store_contract` | no UI state change | EXPLAIN ANALYZE BUFFERS + write-cost evidence | over-100k acceptance fixture separate from seed | measurement first；migration only if justified |
| platform list/detail consumers | existing generated models and `PlatformReadPage.tsx` | `PlatformOrganizationOverviewController`/`PlatformContractOverviewController` mappings | `OrganizationOverviewDetailDrawer.tsx`、`ContractOverviewDetailDrawer.tsx`、`PlatformReadPage.tsx`、`HeadCompanyBrandAuthorizationActionAdapter.ts` | `OrganizationOverviewPresentation.test.ts`、`OrganizationOverviewFilters.test.ts`、`platform-read-boundary.test.mjs` | platform fixture/readback | 同步修改或明确 N/A 反例 |
| generated/edge catalogs | `apps/frontend/*/src/app/api/generated`；`contracts/registry/operation-handler-bindings.json`；`edge-route-face-registry.json` | actual edge operation binding and problem registration | generated RTK hooks only | static catalog/codegen checks | no seed consumer; N/A with reason | generated 派生 |
| dynamic testId/stable draft | app `*TestIds.ts` unique sources | no backend change | 12 screens/actions and dynamic field key | focused/static UI test; L2 blocked until review | no seed consumer; N/A with reason | 同步修改 |
| seed definition/value order | r5 fixture JSON、`scripts/dev/owner-command-seed-executor.mjs`、`scripts/dev/r5-seed-plan.mjs`、`doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json` | owner command request shape | no UI state | seed static tests/test-health registration if assertions change | executor/profile `r5-full.json` | 同步修改 |

明确反例：组织架构树的 listDisplay/searchable 消费、树 extension filter、树 snapshot、树 errors、树 scenarios 和树 seed 不在本表，因为 Dexter 已明确树接口/页面/详情不改且三类 host 为 N/A；这不是遗漏。

## 13. 变更定位与 migration

实施时所有定位使用目标文件内唯一语义锚点，不用易漂移行号。当前预计锚点包括：

- `extension.schemas.json` 中 `ExtensionDefinition`/`ExtensionDefinitionUpdateRequest` 的 `definitions.items`；
- `ExtensionDefinitionReadback.Field` 的 record/constructor 以及 `ExtensionDefinitionService` 的 normalize/read/replace；
- 7 个 operation path 文件中各自 operationId 对应的 GET 参数和 response；
- owner list query 组装 Page 的现有方法；
- `PlatformReadPage.tsx` 组织/合同 list response mapping 和 detail drawer imports；
- `ExtensionFieldManagementPage.tsx`/`ExtensionsPage.tsx` 的 table columns 与 Drawer field card；
- foundation `src/index.ts` 的 exports 与现有 list/Drawer hooks；
- `r5-seed-plan.mjs` 的 definition/value plan registration 和 executor test fixture；scripts runner 为 `scripts/test/test-health-entry-runner.mjs`。

| migration | 加/改什么 | 旧行回填 | 可逆性 |
| --- | --- | --- | --- |
| definition flags | 默认沿当前 JSONB definition normalize，新增 JSON properties，不创建 runtime DDL | 老 definition 缺 flag：平面 `false/false`；树 `null/null` 仅在读模型适用矩阵中使用 | 清库 seed 直接新形状；owner 可回读旧 JSON 缺字段，不删除 values |
| generic equality index（若测量证明需要） | 每张相关表 additive `GIN (extension_values jsonb_path_ops)`，具体 migration 在实现前由 EXPLAIN 选择 | 无旧业务行回填 | additive；可单独 down/forward 由 Flyway policy 决定，不在 runtime rollback |
| generic TEXT trigram index（若测量证明需要） | 每表最多一个通用 lower JSONB text 候选，精确 JSONB recheck | 无旧业务值转换 | additive；若 scan 已满足则不建 |

不允许 per-key expression index，不允许把 index 建表放到 Java runtime，不允许以迁移掩盖未决定的 `%/_`/trim/case/type 语义。migration 的最终文件只有在 implementation authority 和 measured evidence 到位后才能写入。

## 14. seed 设计（不执行）

### 14.1 受影响全集

| seed 文件 | 受影响原因 | 处置 |
| --- | --- | --- |
| `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json` | definition/values/expected counts 需要新增两个 flag、五种 type、N/A/状态边界 | 同步 definition、value、count、revision 断言 |
| `scripts/dev/owner-command-seed-executor.mjs` | 当前 executor 硬编码 TEXT/required/options/status，且 `resolveExtensionValues` 要求每 key | 根据 fixture 的 field type/flags/options 物化；缺 key/null 规则显式化 |
| `scripts/dev/r5-seed-plan.mjs` | 当前 plan 校验纯中文字符串和既有 shape | 改为可执行的 NUMBER/BOOLEAN/DATE/SELECT 值，不把类型值塞入中文字符串 |
| `scripts/dev/profiles/r5-full.json` | profile expectedCounts/注册的 seed shape 受影响 | 更新 expected counts 和新边界分支 |
| `scripts/test/test-health-entry-runner.mjs`（若注册或断言变更） | seed/executor static test registration 需要同步 | 只在实际 registration/assertion 变化时更新，保持 runner 失败可诊断 |
| executor focused test（当前 owner command seed executor test 路径） | 旧断言假设 TEXT/required/options empty | 覆盖五种 type、flags、N/A、disabled/null/missing/SELECT history |

### 14.2 物化顺序与覆盖

1. 先写 8 host 的 definition：五类平面、`COMMERCIAL_GROUP`/`REGION`/`PROJECT` N/A；覆盖 both-off、list-only、search-only、both-on、disabled、empty definition。
2. 再写实体 values：五张表分别覆盖 TEXT、NUMBER、DATE、BOOLEAN、SELECT，以及 empty/null/missing、旧 SELECT option、特殊字符 `%`/`_`、跨页数据。
3. 再写 definition change/revision fixture：先得到 page，再改变 definition revision，使 stale recovery 和失效 option/type 有可复现实例。
4. 对合同先写 project context，再写 tenant/store/core facts 和 extension values；未选 project 只属于 UI/acceptance，不让 seed 造非法 contract request。

seed 不产生树消费数据，不写候选选择器的动态扩展字段，不在另一个 domain plan 中塞入本域事实。seed static test 必须与 seed shape 同批更新；本节只设计，不执行 `reset`、`seed` 或 `start`。

## 15. 验收场景设计

场景名称使用能力命名，全部落在已有 domain scenario 文件，不新增 provider/registry 壳。后端 oracle 只判断真实 HTTP 业务事实；浏览器 drift recovery 属于 frontend focused test，不塞进 backend acceptance。

| scenario id | owner 文件 | identity/fixture | request | businessOracle |
| --- | --- | --- | --- | --- |
| `extension.definition-flags-owner-readback` | `ExtensionAcceptanceScenarios.java` | enabled platform admin；8 host definitions，平面/树 N/A | get/replace/readback definition | flags、N/A、revision、field order/options/status 与 authoritative readback 一致 |
| `extension.definition-authorization-isolation` | `ExtensionAcceptanceScenarios.java` | unauthenticated、disabled platform admin、operations session | read/replace definition | 全部按现有 typed authorization 拒绝，revision/value 不变 |
| `org.flat-extension-filter-server-side` | `OrganizationAcceptanceScenarios.java` | brand/tenant/head/store，每类 >1 page，五 types 和 special chars | 4 operations + core + `extensionFilters` + `definitionRevision` | total/items/page 来自同一 AND 集合；返回 raw values；不按当前页假筛 |
| `contract.flat-extension-filter-server-side` | `CommercialContractAcceptanceScenarios.java` | 有效 project、合同跨页、tenant/core + extension filter | `getOperationsContracts` | 未选 project 不发 list；选定 project 后 typed AND、tenant core scope、raw values 正确 |
| `org.platform-organization-extension-projection` | `OrganizationAcceptanceScenarios.java` | selected enabled workspace，四 category/type identity | `getPlatformOrganizationOverviewPage` | Tab identity 不串；只读授权；filter、Page、raw values、definition revision 正确 |
| `contract.platform-extension-projection` | `CommercialContractAcceptanceScenarios.java` | selected workspace/project contract data | `getPlatformContractOverviewPage` | 合同核心字段和 extension values/revision 正确；不出现运营写动作 |
| `extension.typed-filter-invalid-aggregate` | `ExtensionAcceptanceScenarios.java` | unknown/disabled/not-searchable/type/options/duplicate cases | revision equal + invalid array | 一次 400 汇总所有 invalid；不是空成功，不执行部分过滤 |
| `extension.definition-revision-stale` | `ExtensionAcceptanceScenarios.java` | current revision r1, request r0, then changed definition | stale list request | 一次 409 返回 current revision；旧 filter 不产生错误 Page；readback 后同 revision 可成功 |
| `extension.authorization-scope-isolation` | `OrganizationAcceptanceScenarios.java` | two workspace/project scopes | same dynamic filter under each identity | 只能看到授权实体和 raw values；定义/列表不扩大 scope |

每个 over-page 场景必须在真实 HTTP 中造出至少两页；断言不能只检查状态码、`response.ok`、无异常或 operation 名。将来执行使用受管入口：

```text
scripts/test/backend-acceptance --operation <operation>
scripts/test/backend-acceptance --operation all
```

实现阶段不提前执行这些命令；P8 在 P1-P7 与资源预检闭合后按当前授权通过受管入口执行，且必须按 business/cleanup 分离并保留 manifest、PID、日志和资源证据。

## 16. P7/P9 独立复核与对账

P7/P9 不由作者会话自证。实施阶段必须由 fresh 独立只读 subagent 读取当前需求、IA、交互、本文、实施计划、适用 coding standards、全部命中的 project-memory 和 owning source，以证伪立场逐点审查；主 agent 只能 intake finding、修复并重新请求 fresh 复查。Claude 的外部 review 不能替代该独立子 agent。

```text
INDEPENDENT_DESIGN_REVIEW=NO_GO_ROUND_2_FINDINGS_SELF_CLOSED
P7_REVIEWER=fresh independent read-only subagent; not main author
P9_REVIEWER=主 agent逐代码与详设对账，必要时由fresh independent reviewer复核
REVIEW_FINDING_STATUS=ROUND_2_S_N_CLOSED; P6_P7_P9_OPEN_UNTIL_CURRENT_SOURCE_EVIDENCE
```

### 16.1 逐代码与详设对账

实施完成后、整体测试前，以 §12 同一分母逐个变更行/符号回读：

- 两个 flag 独立、平面 false/tree null、enabled gate；
- 7 个 list owner server-side AND、Page total/items/page、raw values；
- 5 种控件/谓词、`%/_` escape、trim/case/numeric/date/select；
- definition source、revision、409/400、一次 recovery、同 revision stop；
- 五表 index/scan、100k plan、write cost、每 operation budget decisionRef；
- foundation imports、`currentData/isFetching`、stable testId、Drawer hidden facts；
- platform detail/list consumers、generated catalogs、acceptance/fixture/seed 全链；
- 日志脱敏、授权、候选反例、树不变和当前未授权边界。

记录格式只允许：

```text
MATCHED=<具体文件#唯一symbol/变更行 + 详设条款 + evidence>
OPEN=<具体文件#唯一symbol/变更行 + 偏差 + 根因 + 最小修复>
```

任一 `OPEN` 未闭环，结论必须是实施未就绪；不得把测试 green、handoff checker 或历史 Claude verdict 当作设计一致性证明。

## 17. 停止条件、状态与当前结论

以下任一情况立即停止当前步骤并保留 first failure：

1. 当前 source 与需求/IA/交互/本文的 owner、scope、collection shape、文案或类型语义冲突；
2. codegen 无法从 scalar `schema` 生成 `extensionFilters`，或问题码未进入真实 registry/advice/generated mapping；
3. 任一 list 只能靠前端当前页筛选、逐行 detail 或旧 `extensionFields` 旁路完成；
4. 100k EXPLAIN、TEXT scan/index recheck 或 write-cost 不能证明，或资源/DB operation budget 只能靠删业务事实满足；
5. seed 不能按 definition→values→revision change 物化五种 type 或旧 SELECT 边界；
6. foundation/testId/屏幕交互对账仍 OPEN，或出现 tree 代码/seed/scenario；
7. P6/P7/P9 的 fresh 独立 reviewer finding 尚未被主 agent 逐条验证/修复/复查；
8. 需要 browser L2、UAT、部署、Git 或产品/Journey 选择才能继续，或受管 reset/DEV/seed 未按本批授权与 manifest 边界执行。

当前审计状态：

```text
DESIGN_SCOPE=8 hosts; 12 screens; 10 flat consumers; 7 list operations; tree unchanged
DESIGN_REVIEW=NO_GO_ROUND_2_FINDINGS_SELF_CLOSED_ON_CURRENT_BYTES
DEXTER_WIREFRAME_REVIEW=CONFIRMED_2026-09-14
IMPLEMENTATION_AUTHORITY=true
RUNTIME_AUTHORITY=AUTHORIZED_R5_RUNTIME
RESET_DEV_SEED_AUTHORITY=AUTHORIZED_BY_DEXTER_2026-09-14
MIGRATION_AUTHORITY=AUTHORIZED_WITHIN_P1_P3_DESIGN
SEED_EXECUTION=AUTHORIZED_AFTER_P8_PRECONDITIONS
L2_SCRIPT_ADMISSION=BLOCKED
IMPLEMENTATION_READY=YES
```
