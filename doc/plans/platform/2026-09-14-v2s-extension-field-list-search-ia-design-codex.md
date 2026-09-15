# IA 详设：扩展字段列表展示与类型化搜索

```text
IA_SCOPE=IA-EXT-01..IA-EXT-12
BUSINESS_SOURCE=doc/plans/platform/2026-09-14-v2s-extension-field-list-search-requirements.md#extension-field-business-source
JOURNEY_REFS=doc/decisions/2026-09-14-v2s-extension-field-list-search-journey.md#J-EXTENSION-FIELD-LIST-SEARCH
UI_INTERACTION_REF=doc/plans/platform/2026-09-14-v2s-extension-field-list-search-interaction-design-codex.md
IMPLEMENTATION_DESIGN_REF=doc/plans/platform/2026-09-14-v2s-extension-field-list-search-implementation-design-codex.md
DEXTER_WIREFRAME_REVIEW=CONFIRMED_2026-09-14
IMPLEMENTATION_AUTHORITY=true
RUNTIME_AUTHORITY=AUTHORIZED_R5_RUNTIME
RESET_DEV_SEED_AUTHORITY=AUTHORIZED_BY_DEXTER_2026-09-14
DESIGN_REVIEW=NO_GO_ROUND_2_FINDINGS_SELF_CLOSED
```

本 IA 只决定不可见但会改变行为的授权、集合、刷新、数据来源、失败和规模；用户可见形态以交互工件为准。两份文档中的同一事实必须逐字一致。

## 1. 共用信息架构规则

五类平面宿主 `BRAND`、`TENANT`、`HEAD_COMPANY`、`STORE`、`CONTRACT` 在 operations-admin 与 platform-admin 的十个平面消费面中，只有 `definition.status = ENABLED AND definition.listDisplay = true` 的字段成为固定动态列，只有 `definition.status = ENABLED AND definition.searchable = true` 的字段成为固定动态搜索项；动态列不排序，动态搜索与核心条件按 `AND` 由对应实体 owner 计算，`total/items/page` 来自同一结果集；列表 item 统一返回 raw `extensionValues`，定义版本来自对应 `ExtensionDefinition.revision`，不使用实体 `extensionRuleRevision` 代替。未携带 `extensionFilters` 或解码后为零元素数组（包括 `extensionFilters=[]`）均等价于无扩展条件，此时不发送 `definitionRevision`，owner 不做 revision 比对；只有非空扩展条件才要求并比较 revision。UI typed draft 保留 NUMBER/BOOLEAN 等类型语义，但 `ExtensionFilter.value` wire 对所有类型统一为 JSON string，由 owner 按 `type` 解码。

请求判定顺序固定为：授权/context → percent decode、JSON syntax、encoded length、顶层 array、item shape 和原始数组上限 → 空数组按无扩展条件走既有 Page，不读取或比较 `definitionRevision` → 非空缺失或不满足 `integer/int64/minimum=0` contract 的 `definitionRevision` 直接返回 typed invalid，且不读取 definition snapshot → 读取 snapshot、比较 revision → revision 相等后做 definition 语义校验并计算 Page。

组织架构树保持现状：运营管理后台和运维管理后台的组织架构树只保留现有的名称/编码搜索；树接口、树页面、树详情都不改。`COMMERCIAL_GROUP`、`REGION`、`PROJECT` 的 `listDisplay` 与 `searchable` 均显示“不适用”、不可编辑、不产生任何消费；候选选择器也不属于本需求。

这两个段落是需求、交互工件和 implementation-facing 详设的共用原文。树只在这里声明为非目标，不定义树扩展查询、树 revision、树快照、树错误码或树 acceptance。

## 2. IA-ID 全集与维度对账

| IA-ID | `businessTask` / `actorAndScenario` | `entryAndSurface` / `controlType` | `validationAndError` / `accessibilityAndTestId` | `emptyLoadingErrorStates` / `containerBehaviorUnderLoad` |
| --- | --- | --- | --- | --- |
| `IA-EXT-01` | 平台管理员选择宿主并查看字段配置 | `/platform/extension-fields` 内容页；左宿主菜单+右配置表；表格列含两个新状态 | catalog/definition read error 可见；菜单、表格、重试均键盘可达；`extensionConfigTestIds` | 空态“暂未配置字段”；加载只显示 loading；失败清空右侧；右表唯一滚动，操作区不溢出 |
| `IA-EXT-02` | 平台管理员编辑并保存完整 definition | 同路由右侧 Drawer；field card 两个独立 Select；tree host 两槽位只读 N/A | invalid/conflict 不丢草稿；真实 Select/Button 节点使用 stable draft testId；焦点回到 Drawer | 保存中禁止重复提交；失败保留草稿；卡片区唯一滚动，底部取消/保存固定 |
| `IA-EXT-03` | 运营管理员按扩展字段查品牌 | 运营品牌列表；品牌现有核心搜索只有名称；动态控件追加在核心条件之后 | 400/stale 显示业务错误并可重试；键盘可达；host+field testId | 空态必须是“当前结果域暂无记录”；列表区唯一滚动，动态列不撑宽 |
| `IA-EXT-04` | 运营管理员按扩展字段查经营租户 | 运营经营租户列表；名称/编码/法人公司/统一代码等现有核心条件保持 | 同平面 typed error/recovery；stable host+field testId | 空态沿现有 BusinessEntityManagementPage；loading/error 不保留旧成功；表格区唯一滚动 |
| `IA-EXT-05` | 运营管理员按扩展字段查总公司 | 运营总公司列表；核心条件保持；动态控件/列只属 `HEAD_COMPANY` | owner invalid/stale 可见；焦点不跳离搜索表单；stable host+field testId | 沿现有业务实体空态；长 label/value 截断并提示，不撑宽表头 |
| `IA-EXT-06` | 运营管理员按扩展字段查门店 | 运营门店列表；名称/编码/品牌/租户/总公司等既有关系展示保持 | 错误只影响门店 list query；候选关系错误不被当作列表空态；stable host+field testId | 空态“暂无门店”；动态列在业务列后、状态前；表格区唯一滚动 |
| `IA-EXT-07` | 运营管理员按扩展字段查合同 | 必须先选择项目；合同列表核心字段为合同编号、分期、起止日期，既有 tenant/store 候选保持 | 未选项目不发 list；extension invalid 与候选失败分开；stable host+field testId | 未选项目“请先选择项目”，有项目无结果“暂无合同”；搜索和分页不溢出 |
| `IA-EXT-08` | 平台管理员在组织概览品牌 Tab 只读查品牌 | `/platform/organization-overview`；query identity 是 `category + type`；动态控件/列 | platform read/auth error 可见；无运营动作；dynamic testId 包含 host，避免 Tab 同挂重名 | 空态使用 `暂无${tab.label}`；当前 Tab 只显示自己的 loading/error；表格区唯一滚动 |
| `IA-EXT-09` | 平台管理员在经营租户 Tab 只读查租户 | 同组织概览 Tab；`category=BUSINESS_ENTITY,type=TENANT` | 同平台 flat rule；Tab 切换保持 query identity；stable host+field testId | 空态 `暂无经营租户`；不显示 technical revision；动态列不排序 |
| `IA-EXT-10` | 平台管理员在总公司 Tab 只读查总公司 | 同组织概览 Tab；`category=BUSINESS_ENTITY,type=HEAD_COMPANY` | 只读无写按钮；definition/list failure 可见且只失效当前 Tab | 空态 `暂无总公司`；loading/error 不借用其他 Tab 数据；唯一表格滚动 |
| `IA-EXT-11` | 平台管理员在门店 Tab 只读查门店 | 同组织概览 Tab；`category=STORE,type=STORE` | selected workspace read boundary 由 owner/edge 复核；动态 testId 含 host | 空态 `暂无门店`；动态列和核心列对齐；长值省略提示 |
| `IA-EXT-12` | 平台管理员在合同概览只读查合同 | `/platform/contract-overview`；核心搜索为合同编号、门店、分期、经营租户、货号、状态 | 不显示运营写动作；contract owner invalid/stale 可见；host+field testId | 空态“暂无合同”；动态列不改变只读动作区；表格唯一滚动 |

每行均是独立 screen face；`IA-EXT-03`、`04`、`05` 虽共用当前 React 页面组件，仍按三个业务 host 独立声明，不能用“业务实体”合并其来源和文案。

## 3. `SEARCH_CAPABILITY_DENOMINATOR`

动态搜索项的来源不是前端自行猜测，而是下表的 definition operation response `definitions[]`；core search controls 仍由各自列表 source 保持。

| flat screen group | definition operationId | response field | list operation/query identity | 动态条件传递 |
| --- | --- | --- | --- | --- |
| operations brand/tenant/head | `getOperationsOrganizationBusinessEntityExtensionDefinition` | `revision`, `definitions[]` | 对应三项 operations list operation | `{fieldKey,type,value}` + `definitionRevision` |
| operations store | `getOperationsOrganizationStoreExtensionDefinition` | `revision`, `definitions[]` | `getOperationsOrganizationStores` | 同上 |
| operations contract | `getOperationsContractExtensionDefinition` | `revision`, `definitions[]` | `getOperationsContracts`，先选 project | 同上 |
| platform organization brand/tenant/head/store | `getExtensionDefinition` path `entityType` | `revision`, `definitions[]` | `getPlatformOrganizationOverviewPage`，`category + type` | 同上 |
| platform contract | `getExtensionDefinition` path `CONTRACT` | `revision`, `definitions[]` | `getPlatformContractOverviewPage` | 同上 |

动态 field 的值来源只能是当前 definition response；`fieldKey` 是身份，`label` 只用于显示，`type/options/status/listDisplay/searchable/displayOrder/displaySuffix` 都从同一 response 读取。普通无扩展条件 list 不因每行值而调用 definition/value endpoint；动态列使用页面已读的 definition 和 page raw values。`extensionFilters=[]` 与未携带参数同属普通无扩展条件 list。

## 4. 表单控件依赖图

| screen | 可见控件 | 上游依赖与可用条件 | 变更后的清理/重载 | 提交时 owner 再核验 |
| --- | --- | --- | --- | --- |
| `IA-EXT-01` | 宿主菜单 | catalog read 成功 | 切换 host 清理旧 definition/table，不沿用旧列 | selected workspace、host、definition revision |
| `IA-EXT-02` | 两个 flag Select、类型/必填/启用/选项等 field controls | 当前 definition read 成功；N/A host 的 flags 不可编辑 | type/option 既有级联不变；编辑结束后用最新 readback 替换 table | expectedVersion、host applicability、field uniqueness/type/options/status |
| `IA-EXT-03..06` | 核心 Input/Select + dynamic typed controls | definition read 成功且 field enabled/searchable；BOOLEAN 需三态 | definition drift 后清 dynamic invalid values，保留核心条件并回第一页 | fieldKey/type/value/status/searchable/options/current revision |
| `IA-EXT-07` | 项目上下文、tenant/store candidate、核心合同条件 + dynamic controls | 先有 project；候选仍走既有 candidate owner | project 改变按现有规则清理相关核心候选；不清理为动态字段身份 | project/tenant candidate scope、extension filter snapshot |
| `IA-EXT-08..11` | Tab-specific core controls + dynamic typed controls | Tab 的 `category + type` identity 与 selected workspace 有效 | 切 Tab 只重取当前 Tab；definition drift 只清当前 Tab dynamic conditions | platform read, category/type, fieldKey/type/value/revision |
| `IA-EXT-12` | 合同编号/门店/分期/租户/货号/状态 + dynamic controls | platform selected workspace read 有效 | 只刷新 contract query；候选加载错误不能变成“暂无合同” | category-independent contract read scope、extension snapshot |

## 5. Drawer 整组替换字段事实矩阵

`FORM_MUTATION_DENOMINATOR=EXTENSION_DEFINITION_REPLACE_ONE_HOST`；N/A host 仍是一个 replace variant，两个 flag 必须显式记录为 N/A。

| 事实 | 用户可见文案/控件 | 分类 | 原始业务来源 | request 取值与唯一来源 | owner 复核 | 冲突/失败恢复 |
| --- | --- | --- | --- | --- | --- | --- |
| 当前 host | 宿主名称 | `FIXED_READONLY` | catalog selection | 当前 catalog row | host 属于八类 enum | 不切换旧 Drawer |
| existing field key | 不显示 | `HIDDEN_OWNER_FACT` | definition readback | current field key | stable/unique | 失败保留草稿，不生成替代 key |
| new field key | 不显示 | `HIDDEN_OWNER_FACT` | owner key generator | owner-generated once per draft | uniqueness | 生成失败不提交 |
| field label | 字段名称 | `EDITABLE` | definition field | form value | non-empty/length | validation visible |
| field type | 字段类型/已固定 | `FIXED_READONLY` existing; `EDITABLE` new | current definition rule | existing readback or new allowed enum | type/options/value semantics | invalid whole replace |
| `listDisplay` | 是否列表展示 | `CONDITIONAL_EDITABLE` | requirement applicability matrix | flat boolean; tree `null` | N/A non-null rejected | preserve draft, no partial write |
| `searchable` | 是否可搜索 | `CONDITIONAL_EDITABLE` | requirement applicability matrix | flat boolean; tree `null` | N/A non-null rejected | same |
| required/status/options/order/suffix | existing labels | `EDITABLE`/`FIXED_READONLY` per current source | ExtensionDefinitionService normalize | existing form source | current extension owner rules | current validation/conflict |
| expected version | 不显示 | `HIDDEN_OWNER_FACT` | readback `revision` | latest definition read | CAS | existing version conflict |
| Idempotency-Key | 不显示 | `HIDDEN_OWNER_FACT` | foundation/request lifecycle | one submission key | duplicate/replay semantics | typed idempotency error |
| receipt/readback | 不显示 | `HIDDEN_OWNER_FACT` | replace result | owner response + authoritative reread | version/value/flags | failure remains visible |

## 6. 不可见维度的可执行观察

| IA-ID | `stateAndPermission` | `navigationAndRefresh` | `collectionShapeAndScale` | `dataSourceAndCascade` | `forbiddenUI` |
| --- | --- | --- | --- | --- | --- |
| `IA-EXT-01..02` | `[acceptance]` 未登录、已停用平台管理员、operations session 调用 platform definition 均被拒绝；`[static]` replace 调用 `requireEnabledPlatformAdministrator` | save success 只重读当前 host definition/catalog summary；其他 host/flat lists 不因配置保存自动补请求 | `Bounded`；8 host catalog + 一个 definition，不分页；上界来自 `ExtensionEntityType` enum/现有 catalog contract | catalog→definition→Drawer；切 host 清旧 local view，不清实体 values | 不显示 technical revision/owner/scope/token |
| `IA-EXT-03..06` | `[acceptance]` 运营 session 只能读取当前 workspace/project owner 集合；扩展条件不扩大范围 | definition change 只失效当前 list query；stale 后最多一次强制 definition read；核心条件保留 | `Page`；每个 workspace/project flat list <=100,000 rows；增长驱动是实体主数据，不是 field key；`total` 取 server page | definition operation→dynamic controls；list owner→raw extensionValues；无逐行请求 | 不显示 fieldKey/type/revision/owner/scope，不显示动态排序 |
| `IA-EXT-07` | `[acceptance]` 未选项目不发合同 list；tenant/store candidate 与 contract list scope 各自由 owner 复核 | project 变化沿既有核心级联清理候选；dynamic stale 不清 tenantId/project | `Page`，同 flat 上界；合同 list 只在 project context 有效时读 | project→candidate/query context；extension filter 与 tenantId 同一 contract owner query | 不写“合同名称”；不把 candidate failure 显示成空结果 |
| `IA-EXT-08..11` | `[acceptance]` platform read + selected enabled workspace 只读；operations session 不得取得 platform definition/list | Tab query identity 是 `category + type`；只失效当前 Tab query；不触发其他 Tab/详情 | `Page`；单 Tab 作用域 <=100,000；四 Tab 共一个 operation，不能按 Tab 加 operation | `getExtensionDefinition(entityType)`→controls；platform owner projection→raw values | 不出现编辑/作废/保存、technical fields、动态 sort |
| `IA-EXT-12` | `[acceptance]` platform contract read 只返回 selected workspace 授权合同 | 只重取 contract overview query；详情不是列表补数入口 | `Page`；合同表作用域 <=100,000；page total/items 同集合 | contract definition→controls；contract list raw values→formatter | 不出现合同名称、运营写动作、逐行 detail request |

## 7. 类型、错误与恢复规则

| type/problem | owner 判定 | 用户可见行为 | 最低证据档位 |
| --- | --- | --- | --- |
| TEXT | trim、locale-neutral lower-case、escaped contains；`%`、`_`、escape 字符均按字面处理 | 文本框；清空即不筛选 | owner focused + HTTP |
| NUMBER/DATE/BOOLEAN/SELECT | UI typed draft 为数字/ISO date/boolean/current option；wire `value` 统一 JSON string；owner 按 type exact | InputNumber/DatePicker/三态 Select/单选 Select | owner focused + HTTP |
| `EXTENSION_DEFINITION_REVISION_STALE` | client revision != current definition revision | 一次绕缓存 definition read；清失效动态条件；同 revision 再拒绝则手动重试 | HTTP + frontend focused |
| `EXTENSION_FILTER_INVALID` | unknown/disabled/not searchable/type/options/duplicate/shape invalid | 显示筛选无效并定位/清理失效项；不得空成功 | HTTP + frontend focused |
| definition/value/list read failure | owner/edge problem | 清空不可信旧结果，显示现有业务错误与重试 | static + focused/HTTP |

授权文案固定为“未登录、已停用的平台管理员、operations session 被拒绝”；不使用不存在的“平台配置读权限”或“写 capability”。

## 8. Cross-check 与当前状态

| 检查 | 判据 | 当前结论 |
| --- | --- | --- |
| IA ↔ requirements | 8 host、2 config、10 flat、7 operation、tree unchanged 与 N/A 矩阵一致 | `MATCHED_AS_DRAFT` |
| IA ↔ interaction | 12 个 screen、surface、核心文案、空态、容器规则逐字一致 | `MATCHED_FOR_IMPLEMENTATION` |
| IA ↔ implementation design | definition source、raw wire、revision、errors、五表、budget、seed、P7/P9 对齐 | `MATCHED_FOR_IMPLEMENTATION` |
| IA-ID count | `IA-EXT-01..IA-EXT-12` 共 12 个，2 config + 10 flat | `MATCHED` |
| UI visible | low-fi 已获 Dexter 视觉接受 | `CONFIRMED_2026-09-14` |
| independent review | round 2 fresh blind reviewer 已完成；S/N finding 已自闭合 | `SELF_CLOSED_AFTER_ROUND_2` |

```text
IA_DIMENSIONS=IA-EXT-01..IA-EXT-12;每个 ID 已填写可见与不可见维度
SEARCH_CAPABILITY_DENOMINATOR=explicit
FORM_MUTATION_DENOMINATOR=explicit
INVISIBLE_DIMENSIONS_AS_OBSERVATIONS=YES
FORBIDDEN_UI=explicit
TYPED_PROBLEMS=2 new filter codes + existing auth/version/read mappings
CROSS_CHECK_WITH_DESIGN=MATCHED_FOR_IMPLEMENTATION
DEXTER_WIREFRAME_REVIEW=CONFIRMED_2026-09-14
IA_STATUS=REVISED_PENDING_INDEPENDENT_DESIGN_REVIEW;不构成 implementation authorization
```
