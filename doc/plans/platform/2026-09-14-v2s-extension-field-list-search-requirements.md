# v2s 扩展字段列表展示与类型化搜索需求

```text
DATE=2026-09-14
STATUS=REQUIREMENTS_REVISED_AFTER_CLAUDE_DESIGN_REVIEW_AND_DEXTER_SCOPE_RULING
BUSINESS_SOURCE=用户直接需求：扩展字段配置增加“是否列表展示”“是否可搜索”，并在所有有扩展字段的实体列表/搜索页生效
SCOPE=8 个 extension host 的配置；5 个平面实体在两个管理后台的 10 个列表/搜索面
IMPLEMENTATION_AUTHORITY=true
RUNTIME_AUTHORITY=AUTHORIZED_R5_RUNTIME
RESET_DEV_SEED_AUTHORITY=AUTHORIZED_BY_DEXTER_2026-09-14
```

<a id="extension-field-business-source"></a>

## 1. 文档定位与真实业务问题

本文是业务需求正本，不是接口详设、实施计划、代码变更或运行授权。浏览器截图只说明用户看到的配置表和经营租户列表位置；“经营租户列表”只是例子，不能缩小范围。范围以当前 v2s 源码、OpenAPI、owner 边界和本文件的宿主盘点为准。

当前平台管理员可以维护扩展字段的名称、类型、必填、启用、选项和顺序，实体 owner 也已经保存扩展值；但实体列表主要只展示核心字段，搜索也只提交核心条件。扩展值因此不能参与用户实际的查找和结果浏览。若由浏览器只过滤当前页，`total`、分页、权限范围和真实结果集会互相矛盾。

本需求的目标是让管理员在定义层独立配置两个消费开关，并让五类平面实体的列表与搜索由对应 owner 在同一授权和分页结果集内消费这些事实。

### 1.1 组织架构树保持现状

组织架构树保持现状：运营管理后台和运维管理后台的组织架构树只保留现有的名称/编码搜索；树接口、树页面、树详情都不改。`COMMERCIAL_GROUP`、`REGION`、`PROJECT` 的 `listDisplay` 与 `searchable` 均显示“不适用”、不可编辑、不产生任何消费；候选选择器也不属于本需求。

这段是 Dexter 2026-09-14 的明确范围裁决，必须原文同步出现在 IA、交互工件和 implementation-facing 详设中。树不属于本次动态列、动态搜索、定义 revision 恢复、树快照、树验收或树 seed 设计。

## 2. 业务目标与成功结果

1. 平台配置页覆盖八类宿主，并在字段配置表中展示“是否列表展示”“是否可搜索”两列。
2. 五类平面宿主——品牌、经营租户、总公司、门店、合同——在 operations-admin 和 platform-admin 的现有列表面各自消费当前定义：启用且 `listDisplay=true` 的字段成为固定动态列，启用且 `searchable=true` 的字段成为固定动态搜索项。
3. 搜索控件必须与 `TEXT`、`NUMBER`、`DATE`、`BOOLEAN`、`SELECT` 类型匹配；扩展条件和核心条件由 owner 以 `AND` 计算，`total/items/page` 来自同一结果集。
4. 动态列不增加排序能力，不改变既有核心列、核心筛选、状态、分页、权限、详情和动作。
5. 列表响应携带能够渲染当前页扩展值的原始事实；消费端按当前定义格式化，不逐行请求、不把扩展值镜像为另一份业务事实。
6. 定义变化、非法筛选、权限拒绝和读取失败都必须可见、可关联、可恢复，不得伪装为空结果或旧数据成功。

成功结果必须由 owner readback、HTTP contract、focused test 或后续受管验收证明；本文件的静态要求不构成运行通过。

## 3. 范围盘点

### 3.1 八类宿主全集

| 宿主 | 业务名称 | 当前业务事实 | 本需求消费 |
| --- | --- | --- | --- |
| `BRAND` | 品牌 | 运营品牌表单/详情/列表扩展值 | 配置 + operations/platform 平面动态列与搜索 |
| `TENANT` | 经营租户 | 运营经营租户表单/详情/列表扩展值 | 配置 + operations/platform 平面动态列与搜索 |
| `HEAD_COMPANY` | 总公司 | 运营总公司表单/详情/列表扩展值 | 配置 + operations/platform 平面动态列与搜索 |
| `STORE` | 门店 | 门店表单/详情/列表扩展值 | 配置 + operations/platform 平面动态列与搜索 |
| `CONTRACT` | 合同 | 合同表单/详情/列表扩展值 | 配置 + operations/platform 平面动态列与搜索 |
| `COMMERCIAL_GROUP` | 商业集团 | 组织树根部/集团事实 | 配置；两个开关均“不适用”，无消费 |
| `REGION` | 大区 | 组织架构节点事实 | 配置；两个开关均“不适用”，无消费 |
| `PROJECT` | 项目 | 组织架构节点事实 | 配置；两个开关均“不适用”，无消费 |

### 3.2 十个平面消费面与七个目标列表 operation

| consumer face | 平面页面 | 宿主 | operationId |
| --- | --- | --- | --- |
| `operations-admin` | 品牌列表 | `BRAND` | `getOperationsOrganizationBrands` |
| `operations-admin` | 经营租户列表 | `TENANT` | `getOperationsOrganizationTenants` |
| `operations-admin` | 总公司列表 | `HEAD_COMPANY` | `getOperationsOrganizationHeadCompanies` |
| `operations-admin` | 门店列表 | `STORE` | `getOperationsOrganizationStores` |
| `operations-admin` | 合同列表 | `CONTRACT` | `getOperationsContracts` |
| `platform-admin` | 组织概览品牌 Tab | `BRAND` | `getPlatformOrganizationOverviewPage` |
| `platform-admin` | 组织概览经营租户 Tab | `TENANT` | `getPlatformOrganizationOverviewPage` |
| `platform-admin` | 组织概览总公司 Tab | `HEAD_COMPANY` | `getPlatformOrganizationOverviewPage` |
| `platform-admin` | 组织概览门店 Tab | `STORE` | `getPlatformOrganizationOverviewPage` |
| `platform-admin` | 合同概览 | `CONTRACT` | `getPlatformContractOverviewPage` |

分母是 10 个页面面、7 个 operation，而不是 9 个 operation。平台组织概览的 query identity 是 `category + type`，四个 Tab 共用一个 operation；不能按页面数虚构 operation。

### 3.3 配置 screen 与定义读取

配置 UI 只有两个 screen：扩展字段配置内容页和字段编辑 Drawer。配置页通过 `getExtensionEntityCatalog` 选择八类宿主，并通过现有定义读取/替换链读取和保存当前宿主定义。五类 flat operations 的业务定义读取来源由现有 contract 固定为：

| 读取用途 | operationId | 关键响应事实 |
| --- | --- | --- |
| operations 品牌/经营租户/总公司 | `getOperationsOrganizationBusinessEntityExtensionDefinition`，`entityType` 分别为 `BRAND/TENANT/HEAD_COMPANY` | `ExtensionDefinition.revision`、`definitions[]` |
| operations 门店 | `getOperationsOrganizationStoreExtensionDefinition` | `ExtensionDefinition.revision`、`definitions[]` |
| operations 合同 | `getOperationsContractExtensionDefinition` | `ExtensionDefinition.revision`、`definitions[]` |
| platform 配置及 platform 五类平面消费 | `getExtensionDefinition`，path `entityType` | `ExtensionDefinition.revision`、`definitions[]` |

组织树的既有 definition operation 仍可被配置页读取八类定义，但不因此获得树消费授权或树页面改造范围。

候选下拉、Autocomplete、关系选择器、邀请目标选择、目录复制源选择不属于实体列表/搜索页；它们不计入动态列/动态搜索分母，也不因本需求改造。合同列表本身仍在分母内，既有经营租户核心筛选仍保留。

### 3.4 当前源码基线

| 事实 | 当前来源 |
| --- | --- |
| 八类宿主 | `apps/backend/catering-business-server/modules/extension/.../ExtensionHostTypes.java#VALUES` |
| 定义 field 当前 shape | `ExtensionDefinitionReadback.Field`：key、label、type、required、options、status、displayOrder、displaySuffix |
| operations 列表扩展值 | 现有 list item raw `extensionValues` |
| platform 列表扩展值 | 当前 schema 使用 `extensionFields`，且 organization/contract list controller 存在空数组路径；本需求要求统一修订为 raw `extensionValues` |
| 配置授权 | `ExtensionDefinitionService#replaceDraft` 使用 `platformAuthorization.requireEnabledPlatformAdministrator(actor)` |
| 树现状 | 两个后台只保留当前名称/编码搜索；本需求不修改树接口、页面或详情 |

## 4. 两个配置开关

### 4.1 逻辑字段与适用矩阵

定义 field 增加两个逻辑槽位：`listDisplay`、`searchable`。wire 使用 nullable boolean：平面宿主返回 `true/false`；三个树宿主返回 `null` 表示“不适用”。不适用不是可编辑的 `false`，也不能消费为列或搜索项。

| 宿主 | `listDisplay` | `searchable` |
| --- | --- | --- |
| `BRAND/TENANT/HEAD_COMPANY/STORE/CONTRACT` | 适用、可编辑、默认 `false` | 适用、可编辑、默认 `false` |
| `COMMERCIAL_GROUP/REGION/PROJECT` | `null`、表格显示“不适用”、不可编辑 | `null`、表格显示“不适用”、不可编辑 |

历史 definition 缺少新属性时，五类 flat host 归一为 `false/false`，三个树 host 归一为 `null/null`；不把缺失解释成 `true`。保存非适用槽位的非空值时，owner 必须拒绝整组保存并返回结构化错误。

两个开关完全独立：允许一个字段 `searchable=true` 且 `listDisplay=false`；不允许实现者把可搜索自动推导为列表展示，或反过来推导。

### 4.2 配置表

字段表固定列顺序：

```text
字段名称｜字段类型｜是否列表展示｜是否可搜索｜是否必填｜是否启用｜选项
```

- flat host 的两个单元格显示“是/否”；三个树 host 均显示“不适用”。
- 不适用状态不可编辑，不能显示为空白、禁用的“否”或隐藏列。
- 字段停用不隐藏两个已保存配置；停用字段不参与任何平面动态列/搜索，重新启用后按已保存配置恢复。
- 无选项显示“—”；`SELECT` 显示当前选项摘要。
- 仍是一个宿主的一份完整字段配置，不新增独立的列表配置页面。

### 4.3 编辑 Drawer

- flat host 每个 field card 增加两个独立 Select，标签为“是否列表展示”“是否可搜索”，选项为“是”“否”。
- 三个树 host 两个槽位均只读显示“不适用”，不渲染可编辑控件。
- field type、field key、required、status、options、displayOrder 继续遵循既有规则；field key 仍由 owner 生成，用户不输入。
- 两个配置与既有字段事实随整组 replace 原子保存，沿用 `expectedVersion`、`Idempotency-Key`、已启用平台管理员校验、receipt 和权威 readback。
- 保存失败不得部分落库；只改变消费规则，不删除或改写实体已有 `extensionValues`。
- 现有字段类型不可改；新字段仍只允许 `TEXT/NUMBER/DATE/BOOLEAN/SELECT`。

## 5. 平面动态列表

### 5.1 动态列准入与顺序

五类 flat host 的每个列表面，只有：

```text
definition.status = ENABLED AND definition.listDisplay = true
```

的 field 成为固定动态列。

- 动态列固定可见，不进入列设置器，不提供排序箭头，不生成扩展排序参数。
- 既有核心业务列顺序不变；动态列接在实体现有业务列之后、状态/更新时间等系统列之前。
- 动态列按 `displayOrder` 升序，同序按稳定 `fieldKey` 兜底。
- 动态列标签取当前 definition `label`；field key/type/status/options 不作为用户可见文案。
- 当前实体没有 key、值为 `null` 或空值显示“—”。已移除或停用的 field 不生成列；历史值不得由客户端猜测映射。

### 5.2 列表值 wire 与格式化

七个列表 operation 的 list item 统一返回 raw `extensionValues: object`。platform 现有 `extensionFields[{name,value}]` 形状不再作为本需求的目标 wire；列表/详情共用 item schema 的连带消费者必须在详设 §9a 中同步处理。

页面使用同一 host 的当前定义读取 `definitions[]` 解释 raw values。前端只做面向用户的格式化，不改写 owner 事实：

| 类型 | 列表显示 |
| --- | --- |
| `TEXT` | 原文；空值“—” |
| `NUMBER` | 数值展示；按定义 `displaySuffix` 追加后缀 |
| `DATE` | 与现有详情一致的日期格式 |
| `BOOLEAN` | `true` 显示“是”，`false` 显示“否” |
| `SELECT` | 当前保存的选项字符串；历史非空字符串原样显示 |

`SELECT` 当前 `options` 是字符串数组，一个字符串同时是持久化值、显示文本和当前匹配身份；本需求不引入稳定 option key/label 分离。

### 5.3 结果集、权限与请求边界

- 扩展值必须随 owner 的分页读取批量返回；禁止按列表行请求扩展值。
- 核心条件、扩展条件、既有 workspace/project/tenant/organization 范围在 owner 侧共同计算；`total`、`items`、`page` 属于同一过滤集合。
- 前端不得对平面当前页本地过滤，不得抽干多页再本地分页，不得以详情接口拼列表。
- 当前用户权限范围和既有核心排序保持不变；动态列只改变结果投影，不扩大授权范围。
- 定义、值、分页或映射失败必须清空不可信结果并显示可识别错误和重试，不得显示旧数据作为新成功。

### 5.4 规模与成本输入

每个平面列表按单一 workspace/project 作用域不超过 100,000 条实体记录设计；增长驱动是该作用域内的业务主数据数量，不是管理员动态 field key 数量。implementation-facing 详设必须逐表写明：

1. `organization.brand`、`organization.tenant`、`organization.head_company`、`organization.store`、`contract.store_contract` 的 `extension_values` 读取与 scope 条件；
2. `SELECT/NUMBER/DATE/BOOLEAN` 等值匹配与 `TEXT` 包含匹配的索引或扫描方式；
3. 组合 workspace/project 条件在 100,000 条下的 `EXPLAIN (ANALYZE, BUFFERS)` 判据；
4. 索引建立、更新/插入写放大、存储和维护代价；
5. 七个 operation 的预算增量、测量与拒绝的更大替代方案。

现有 calibration 中七个 operation 的 `FIXED` 最大 DB operation count 是 8、8、8、13、8、6、6；它们是调用次数基线，不是数据规模、延迟或 JSONB 扫描通过结论。

## 6. 平面类型化搜索

### 6.1 动态搜索项准入

五类 flat host 的每个列表面，只有：

```text
definition.status = ENABLED AND definition.searchable = true
```

的 field 生成固定搜索项。动态搜索项放在既有核心搜索项之后，按 `displayOrder`/`fieldKey` 排序；未填写不参与查询。search-only field 允许存在，不强制产生列表列。

### 6.2 控件与匹配语义

| 类型 | 控件 | UI typed draft value | `ExtensionFilter.value` wire value | owner 匹配 |
| --- | --- | --- | --- | --- |
| `TEXT` | 文本输入框 | 非空字符串 | JSON string，原值编码后传输 | trim 后、locale-neutral lower-case、不区分大小写的 contains；SQL `%`、`_` 和 escape 字符必须转义 |
| `NUMBER` | 数字输入控件 | 数字 | JSON string，例如 `"12.5"` | 按数值精确相等；不按字符串、不做范围或模糊匹配 |
| `DATE` | 日期选择器 | `YYYY-MM-DD` 日期值 | JSON string，例如 `"2026-09-14"` | ISO local date 精确相等；非法日期拒绝 |
| `BOOLEAN` | 三态 Select | `true/false`，未选为 absent | JSON string，值为 `"true"` 或 `"false"` | 精确相等；“全部”不生成条件 |
| `SELECT` | 单选 Select | 当前 options 中的字符串 | JSON string，使用当前 option value | 当前 definition options 字符串精确相等；已移除选项不能搜索命中 |

UI 控件保留类型化草稿值，但 wire 上的 `ExtensionFilter.value` 对五种类型统一为 JSON string；owner 只在共享 parser 中按 `type` 解码、校验和建立谓词。该区分是唯一 serializer/parser 的契约，不允许由各页面自行决定 NUMBER/BOOLEAN 的 JSON 原生表示。

搜索控件必须与类型匹配，不能把所有扩展字段降级为文本框。数字范围、日期范围、多选、全文分词不在本需求中。

### 6.3 组合条件与 HTTP 形态

- 核心条件和每个非空扩展条件按 `AND` 组合；多个扩展 field 之间也按 `AND`。
- 条件身份只使用稳定 `fieldKey` 和声明的 `type`，不使用中文 `label`。
- HTTP query 增加 `extensionFilters`，以一个 `schema: {type: string}` 的 query parameter 承载 percent-encoded JSON array；OpenAPI 参数不得同时写 `content` 与 `schema`，也不得依赖未被 codegen 支持的 `style/explode` 组合。
- 逻辑 payload 由共享 `ExtensionFilter[]` 定义，每项是 `{fieldKey,type,value}`；`ExtensionFieldType` 是共享 enum component，`ExtensionFilterQuery` 是承载 percent-encoded JSON 的 scalar component。定义详设必须指定 component、编码/解码唯一位置和从 operation parameter 到 generated logical type 的 reachable chain。
- 七个目标 list operation 均增加以下两个 query parameter；`definitionRevision` 在 OpenAPI wire 层保持 `required=false`，非空扩展条件时由业务校验条件性必填：

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

- 未携带 `extensionFilters` 或解码后为零元素数组（包括语法上存在的 `extensionFilters=[]`）均等价于没有扩展条件：可省略 `definitionRevision`，owner 不触发 revision 比对；只有解码后至少一个条件时才要求并比较由定义读取产生的 `ExtensionDefinition.revision`。
- 条件数上限不是固定 20，而是当前启用且可搜索字段数；同时设置由 contract 决定的 encoded query 长度上限。重复 `fieldKey` 拒绝。

## 7. 定义 revision、wire 一致性与错误

### 7.1 revision 来源

定义 revision 唯一来自 extension owner 的 `ExtensionDefinition.revision`；实体 item 上既有的 `extensionRuleRevision` 只表示实体写入时采用的规则版本，不能替代当前 definition revision。

页面以对应 definition operation 的 `revision` 建动态列、动态搜索和 filter 请求。带扩展条件的列表由 owner 在同一当前 definition snapshot 上比对并在 page metadata 回显 `definitionRevision`；无扩展条件的列表不为渲染 raw values 额外发起逐行定义/值请求，页面使用当前 definition readback。

### 7.2 校验顺序与 typed problem

owner 校验顺序固定为：授权和 context → percent decode/JSON syntax/encoded length/top-level array/item shape/原始数组上限校验 → 若未携带或解码后数组为空则按无扩展条件读取 Page（不要求、不读取或比较 `definitionRevision`）→ 若数组非空且缺失或不满足 `definitionRevision` 的 `integer/int64/minimum=0` contract，则立即返回 `400 EXTENSION_FILTER_INVALID`（reason=`DEFINITION_REVISION_REQUIRED` 或 `DEFINITION_REVISION_INVALID`，不读取 definition snapshot）→ 读取当前 definition snapshot → 先比较 `definitionRevision`，不一致返回 stale → revision 相等后校验 enabled/searchable/type/options/duplicate 等定义语义并一次性聚合 invalid → 计算同一 owner 的 AND Page。当前 definition 中 enabled + searchable 字段数的上限在 snapshot 读取后校验；malformed/长度/shape/原始数组上限不因携带 stale revision 而先读 definition。

| 业务情况 | HTTP | code | payload 最低事实 |
| --- | --- | --- | --- |
| 客户端 revision 过期 | 409 | `EXTENSION_DEFINITION_REVISION_STALE`（新增注册项） | `errorCode`、用户可读 `title/detail`、`currentDefinitionRevision` |
| JSON 非法、未知 key、停用、不可搜索、type 不符、SELECT 选项非法、重复 key、非法值 | 400 | `EXTENSION_FILTER_INVALID`（新增注册项） | `errorCode`、`title/detail`、所有无效 `fieldKey` 及原因 |
| 未登录、已停用平台管理员、operations session 访问 platform 配置 | 沿用现有授权/认证 code | 现有 registry code | 现有 problem shape，不泄漏 raw request |

revision 不一致时只返回一个 stale problem，不继续返回条件错误；revision 相等时所有非法条件聚合成一个 invalid problem，不静默忽略、不返回部分过滤结果。两个新增 code 的唯一注册正本是 `doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json`；普通业务读 operation 的 closed error set 由活动 `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json` 的 `errorSets` + `operationErrorAugmentations` + 可选 `operationErrorSelectionRules` 解析，七个目标 operation 各自 augmentation 两个新增 code，不扩大 `AUTHZ_READ`；generated enum 和 `ContractProblemAdvice` 是派生/映射位置；不创建 `OperationsApiProblem`。

### 7.3 页面恢复

收到 stale 或定义漂移问题时，平面页面只自动做一次强制绕缓存 definition reread，取得不低于 problem 中 `currentDefinitionRevision` 的权威定义；重建控件和列，清除失效扩展条件，保留仍有效的核心条件，回到第 1 页并提示“筛选条件已按最新字段配置更新”。同一 revision 再次拒绝时停止自动恢复，显示结构化错误和手动重试，不循环提交旧请求。

## 8. 配置和实体状态规则

1. 新字段和历史缺 flag 的 flat definition 按 `false/false`；三类树 definition 按 `null/null`。
2. 停用 field 立即从 flat 动态列和搜索项消失，实体 values 保留；重新启用后按已保存开关恢复。
3. 改 label/order 只改变下一次 read 的展示 label/顺序，不改变 field key/value。
4. 改 SELECT options 中字符串，按移除旧字符串并新增新字符串处理；不迁移历史值。历史非空值在当前动态列原样显示，但不能被当前 SELECT 搜索命中。
5. 删除 definition 不删除实体 JSON 中历史 key；历史 key 不消费。
6. 本需求不改变实体创建、编辑、详情的既有扩展值写入语义、核心生命周期或 owner 权限。

## 9. Owner、权限与可观测失败

- extension owner 维护 definitions；organization/contract owner 维护各自实体 list facts、scope、filter 和 page。跨模块只调用公开能力，不直写别的 schema。
- 配置写权限是已启用平台管理员；未登录、已停用平台管理员、operations session 访问 platform 配置均拒绝。平台列表仍是只读，不获得运营写动作。
- owner 先校验既有 workspace/project/tenant/organization 范围，再计算扩展过滤；扩展条件不得扩大数据范围。
- 日志必须具备 run/correlation/request/operation 阶段和脱敏结构；不得记录 password、hash、OTP、token、cookie、Authorization、手机号、登录名、raw IP 或 raw payload。
- definition read、list read、filter parse、typed problem、恢复和最终结果必须能关联；错误不得被空结果或旧缓存覆盖。

## 10. 验收标准

### 10.1 配置面

- 八类 host 均可在配置表查看两个列；五类 flat 显示是/否，三类 tree 显示不适用且不可编辑。
- flat 历史/新字段默认 false/false；tree 缺失字段 readback 为 null/null。
- 两个开关可独立保存；整组 replace 原子、并发冲突、Idempotency-Key、receipt、启用平台管理员校验和权威 readback 保持成立。
- 非适用槽位提交非 null 会被 typed problem 拒绝且不部分保存。

### 10.2 五类 flat 的十个消费面

对 §3.2 全部 10 个面逐一验收：

- `listDisplay=true` 且 enabled 的 field 成为固定列，类型值正确、空值为“—”、无扩展排序；
- `searchable=true` 且 enabled 的 field 成为类型匹配的固定搜索项；
- search-only 不生成列；两个开关不互相推导；
- 核心条件+一个/多个扩展条件的 `total/items/page` 与 owner 集合一致，第二页仍正确；
- platform item 使用 raw `extensionValues` 与 definition readback 格式化，不能由详情接口逐行补齐；
- 既有核心列、核心候选、排序、权限、动作、合同先选项目前提保持不变；
- 不同 host 或相同 label/key 不串用 definition/value。

### 10.3 负向、恢复和成本

- 未知/停用/不可搜索/type 错误/非法 SELECT/重复 key/非法 JSON 均为一次 400 invalid；revision 过期先为一次 409 stale 并带当前 revision。
- stale 只自动恢复一次，绕缓存重读、清失效扩展条件、保留核心条件、回第一页；同 revision 再拒绝停止并提供手动重试。
- 无按行 extension HTTP/DB 请求；业务结果、DB operation/budget 与 cleanup 证据分开判读。
- 五张表在不超过 100,000 条/作用域下的查询计划、buffers、执行时间、写入代价和七个 operation 预算测量按详设逐项记录；不能把 8/8/8/13/8/6/6 当作规模或性能 PASS。

## 11. 不在本需求范围

- 不新增 extension host，不改变 owner、权限或实体创建/编辑/详情语义。
- 不修改两个后台组织架构树的接口、页面、详情、名称/编码搜索或树数据形态。
- 不让 `COMMERCIAL_GROUP`、`REGION`、`PROJECT` 产生任何动态列、动态搜索、树 revision、树快照或树验收消费。
- 不改造候选下拉、Autocomplete、关系选择器、邀请目标和目录复制源选择。
- 不新增独立扩展值管理页、专用 read model、稳定 option key/label 迁移、范围/全文/多选搜索，除非另立需求和授权。
- 不在当前任务修改生产代码、OpenAPI/generated、数据库迁移、测试/fixture/seed、脚本、依赖；不执行 DEV、reset、seed、backend acceptance、browser L2、UAT 或部署。

## 12. 后续详设必须回答的实现问题

implementation-facing 详设必须基于本需求而不是重新发明产品语义，至少给出：

1. 七个 flat operation 的 exact path、owner、请求/响应字段、definition source 与 `extensionValues`/`definitionRevision` 传递；
2. `ExtensionFieldType`、`ExtensionFilter` 与 `ExtensionFilterQuery` shared components，scalar query encoding、serializer/parser 唯一实现位置、active edge implementation catalog 的 parameter `$ref` 与 generated reachable chain；
3. 两个 typed problem 的 disposition registry、active operation augmentation、HTTP mapping、payload 与用户可见处理；
4. 五张表的 index/scan 方案、workspace/project 组合 query plan、`EXPLAIN (ANALYZE, BUFFERS)` 判据和 write cost；
5. 每个 operation 的独立 budget decisionRef、预计增量、from/to/measuredMax 三次测量字段、双重准入、被拒替代方案和 red mutation；
6. 五文件 seed 全集及 definition → value → definition change 顺序、五种类型和历史 SELECT 边界；
7. platform list/detail 全部消费者、`*TestIds.ts` 动态身份、foundation 唯一 formatter 和按步骤 fresh 独立对账。

## 13. 当前语义冻结与交叉同步

以下语义是本需求冻结内容，IA、交互工件、implementation design 和 plan 必须逐字同步：

- 8 个 host、10 个 flat screen face、2 个配置 screen、7 个 target list operation；树面零改动；
- 两个开关独立；flat 为 boolean，三个树 host 为 null/N/A；
- raw `extensionValues` 列表 wire；definition operation 的 `revision` 是定义版本；实体 `extensionRuleRevision` 不是定义版本；
- TEXT contains（转义 `%/_`）、NUMBER exact、DATE day exact、BOOLEAN tri-state exact、SELECT current string exact；
- 对结构合法且带 revision 的非空条件先做 stale 409 比对；malformed/长度/shape、缺失或非法 revision 先返回 invalid 400；revision 相等后再聚合定义语义非法条件；
- 五张表、100,000 条/作用域、现有 7 个 FIXED budget 只是调用次数基线；
- 组织架构树保持现状，候选控件排除。

## 14. 当前授权边界与状态

当前 Roadmap 的 R5 显式授权字段与 Dexter 2026-09-14 直接指派已允许本任务进入实施和后续受管 runtime；视觉 IA/low-fi 已由 Dexter 确认，round 2 独立 DESIGN 复审的两项 S/N finding 已按 `SELF_DECIDED` 最小修复闭合，且不再启动第三轮。当前实现授权成立，但动态证据仍须等 P1–P7 完成后按受管入口取得；不得把本文件状态解读为已有 runtime PASS。

```text
REQUIREMENTS_STATUS=REVISED_FOR_DEXTER_20260914_SCOPE_AND_CLAUDE_FINDINGS
SCREEN_DENOMINATOR=12
FLAT_SCREEN_DENOMINATOR=10
TARGET_LIST_OPERATION_DENOMINATOR=7
EXTENSION_HOST_DENOMINATOR=8
TREE_CONSUMPTION=UNCHANGED
IMPLEMENTATION_AUTHORITY=true
RUNTIME_AUTHORITY=AUTHORIZED_R5_RUNTIME
RESET_DEV_SEED_AUTHORITY=AUTHORIZED_BY_DEXTER_2026-09-14
```
