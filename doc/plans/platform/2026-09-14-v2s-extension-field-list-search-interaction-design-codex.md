# 扩展字段列表展示与类型化搜索交互设计

```text
JOURNEY_DECISION=doc/decisions/2026-09-14-v2s-extension-field-list-search-journey.md
BUSINESS_REQUIREMENT_SOURCE=doc/plans/platform/2026-09-14-v2s-extension-field-list-search-requirements.md
BUSINESS_PROBLEM=扩展字段目前只能在详情或录入事实中出现，无法被列表用户稳定识别、筛选和对账；配置语义也没有传递到消费面
BUSINESS_USER_OR_OWNER=platform-admin 平台管理员；operations-admin 运营管理员；各实体 owner 负责过滤、分页和授权事实
CURRENT_TASK=完成五项 finding 修复、round 2 独立 DESIGN 复审与最小文档收口；按 Dexter 授权执行实施与受管验证
SUCCESS_OUTCOME=八类宿主中五类平面实体的十个列表消费面能够从同一份 definition 事实派生固定动态列和类型化搜索；组织架构树完全保持现状
UI_BEARING=true
SKILL_USED=cs-spec-to-plan@repo; cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0
DEXTER_WIREFRAME_REVIEW=CONFIRMED_2026-09-14
DEXTER_HIFI_REVIEW=NOT_REQUIRED
CONSUMER_FACE=platform-admin | operations-admin
IMPLEMENTATION_AUTHORITY=true
RUNTIME_AUTHORITY=AUTHORIZED_R5_RUNTIME
RESET_DEV_SEED_AUTHORITY=AUTHORIZED_BY_DEXTER_2026-09-14
DESIGN_REVIEW=NO_GO_ROUND_2_FINDINGS_SELF_CLOSED
L2_SCRIPT_ADMISSION=BLOCKED
INDEPENDENT_UI_REVIEW=OPEN_NOT_RUN
```

本工件冻结用户可见的形态、动作、位置、文案、状态、恢复、焦点、testId 责任和数据来源；low-fi/视觉 IA 已获 Dexter 2026-09-14 确认，生产代码、契约、迁移、seed source 和受管 DEV/reset/seed 已由当前任务授权，browser L2、UAT 和部署仍不在授权内。

## 1. 共用平面交互规则

五类平面宿主 `BRAND`、`TENANT`、`HEAD_COMPANY`、`STORE`、`CONTRACT` 在 operations-admin 与 platform-admin 的十个平面消费面中，只有 `definition.status = ENABLED AND definition.listDisplay = true` 的字段成为固定动态列，只有 `definition.status = ENABLED AND definition.searchable = true` 的字段成为固定动态搜索项；动态列不排序，动态搜索与核心条件按 `AND` 由对应实体 owner 计算，`total/items/page` 来自同一结果集；列表 item 统一返回 raw `extensionValues`，定义版本来自对应 `ExtensionDefinition.revision`，不使用实体 `extensionRuleRevision` 代替。未携带 `extensionFilters` 或解码后为零元素数组（包括 `extensionFilters=[]`）均等价于无扩展条件，此时不发送 `definitionRevision`，owner 不做 revision 比对；只有非空扩展条件才要求并比较 revision。

组织架构树保持现状：运营管理后台和运维管理后台的组织架构树只保留现有的名称/编码搜索；树接口、树页面、树详情都不改。`COMMERCIAL_GROUP`、`REGION`、`PROJECT` 的 `listDisplay` 与 `searchable` 均显示“不适用”、不可编辑、不产生任何消费；候选选择器也不属于本需求。

交互顺序固定为：读取宿主 catalog → 读取当前宿主 definition → 按 definition 形成配置或消费控件 → 读取一次带 raw `extensionValues` 的 Page。提交 list query 时先完成 percent decode、JSON syntax、encoded length、顶层 array、item shape 和原始数组上限判断；`extensionFilters=[]` 按无扩展条件处理，不能仅因参数语法存在而发送或比较 `definitionRevision`；非空条件缺失或不满足 `integer/int64/minimum=0` 的 revision 直接显示 typed invalid，不读取 definition snapshot；revision 比对通过后才做 definition 语义校验。UI typed draft 可使用数字/布尔值，但 wire `ExtensionFilter.value` 统一为按 type 编码的 JSON string。任何动态 field 都不能通过逐行 detail 请求补齐；定义失败、列表失败、候选失败不能被改写成成功空列表。

## 2. UI 规范与共享能力

### 2.1 容器和已有 foundation

所有新动态行为必须接入既有 `libraries/frontend/admin-ui-foundation` 能力，不能在两个 app 复制 Drawer、列表、overlay、HTTP、生命周期或观测 primitive。适用现成符号为：

| 行为 | 唯一现成能力/规范 | 本交互中的使用方式 |
| --- | --- | --- |
| 页面查询、列表分页、条件上下文 | `libraries/frontend/admin-ui-foundation/src/list`；`adminListState`、`usePageQuery`、`contextScopedQueryArgs` | 列表 total/items/page 全部来自 owner Page；客户端不 slice、不从旧 data 拼接动态列 |
| Drawer 表单提交 | `useDrawerFormLifecycle`、`useSubmissionLifecycle`、`useAsyncGenerationGuard` | 打开、保存、失败保留草稿、保存后 authoritative readback 与关闭/焦点恢复沿现成生命周期 |
| Overlay 锁和 Drawer surface | `useOverlayLock`、`adminWideDrawerSurfaceProps` | Drawer 内滚动、底部操作区固定，禁止新建第二套遮罩/焦点锁 |
| testId 生成 | foundation `testId`；各 app 自己的 `*TestIds.ts` | 动态字段使用 host + fieldKey；真实 Button/Select/MenuItem/input 节点绑定，不使用 wrapper 代替 |
| 文本呈现 | `NameCodeText`、`EllipsisTooltip` | 核心名称/编码和长扩展值沿现有组件；扩展值不把 technical metadata 显示给用户 |

### 2.2 视觉与容器边界

- 配置表保留现有左宿主选择、右侧字段表和“编辑字段”入口；固定列顺序为“字段名称｜字段类型｜是否列表展示｜是否可搜索｜是否必填｜是否启用｜选项”，新增两列紧跟“字段类型”之后、位于“是否必填”之前。表头和字段卡片使用完全相同的业务称谓。
- 平面列表保留现有核心搜索条件、查询/重置/收起和分页；动态搜索条件追加在核心搜索条件之后，动态列追加在现有业务列之后、状态或操作列之前。动态列固定显示但没有排序箭头、排序 action 或隐含排序请求。
- 动态条件按照 definition `fieldType` 选择控件：`TEXT` 为文本输入；`NUMBER` 为数字输入；`DATE` 为日期控件；`BOOLEAN` 为三态选择（未筛选/是/否）；`SELECT` 为当前 options 的单选选择。控件不能退化成统一文本框。
- loading 只覆盖当前 definition/list 事实；definition 新版本到达时清掉失效动态条件并回到第一页；保留可继续提交的核心条件。错误显示现有业务错误文案或 typed problem 的用户文案，不能显示空成功。
- 单页面只有一个主要可滚动的列表/卡片内容区；表头、搜索操作区、Drawer 底部取消/保存区不随内容溢出。长 label/value 省略并可通过 tooltip 查看，不撑宽列。

## 3. 控件依赖与状态图

```text
selected workspace / project
          │
          ▼
     host catalog ──失败──> 现有业务错误 + 重试
          │
          ▼
  definition(revision, definitions[])
       │          │
       │          └── enabled + searchable ──> typed search controls
       │                                          │
       └── enabled + listDisplay ──> fixed dynamic columns
                                                  │
       core conditions ──────────────────────────┤
       project/candidate context ─────────────────┤
                                                  ▼
          owner list Page(raw extensionValues, page, total)
                         │
             stale revision ──> one uncached definition read
                         │              │
                         │              └── equal after retry -> typed stale error
                         └── invalid filter -> one typed invalid error
```

| 条件 | 可见变化 | 清理/重载 | owner 再核验 |
| --- | --- | --- | --- |
| 宿主切换 | 切换左侧菜单或当前 Tab | 清掉旧 definition、动态控件、动态列和动态条件，再读新宿主 | selected workspace、host、enabled definition |
| definition read 成功 | 生成适用 flags、动态列和 typed controls | 不逐行读取 value；由下一次 list Page 带 raw values | revision、status、type、options、listDisplay/searchable |
| project 改变 | 合同候选和合同列表沿既有上下文刷新 | 依既有规则清理候选；动态 field 身份不变 | project、tenant/store scope、revision |
| definition revision 改变 | 当前页面提示动态筛选已失效并回到第一页 | 最多一次 bypass-cache definition read；清理仅动态条件 | client revision 与 current revision |
| list query failure | 清空不可信旧结果并显示错误/重试 | 不保留旧成功结果冒充当前查询 | owner scope、全部 core + extension 条件 |

## 4. Drawer 配置交互

### 4.1 字段卡片

每个字段卡片仍以“字段 1/字段 2 …”展示并支持拖拽排序。平面宿主的每张卡片增加两个独立 Select：

| 控件 | 平面宿主 | 树宿主 | 默认值 | 行为 |
| --- | --- | --- | --- | --- |
| 是否列表展示 | 可编辑布尔 Select | 显示“不适用”，禁用 | 新增/历史字段 `false`；树为 `null` | 只决定固定动态列，不决定是否可搜索 |
| 是否可搜索 | 可编辑布尔 Select | 显示“不适用”，禁用 | 新增/历史字段 `false`；树为 `null` | 只决定固定动态搜索，不决定是否列表展示 |

两项彼此独立：可以仅列表展示、仅可搜索、两者均开或均关。`status != ENABLED` 的字段即使 flag 为 true 也不消费；保存时仍完整回传，owner 负责校验组合。非适用宿主提交非空布尔值必须得到 typed validation error，不能静默转换为 false。

### 4.2 Drawer 隐藏事实矩阵

以下事实不在 UI 显示，但必须作为同一表单提交的隐藏请求事实，不能由 index、label 或当前时间临时推导：

| 隐藏事实 | 来源 | 提交/回读规则 | 失败恢复 |
| --- | --- | --- | --- |
| existing field key | 当前 definition readback | 原 key 不变 | 失败不生成替代 key |
| new field key/draft identity | owner 或 stable draft identity | 一次生成，Drawer 生命周期内不变 | 生成失败不提交 |
| expectedVersion | 当前 `ExtensionDefinition.revision` | 作为 CAS 事实提交 | 冲突保留草稿 |
| Idempotency-Key | `useSubmissionLifecycle`/现有请求生命周期 | 每次逻辑提交一次，重试沿既有幂等语义 | 不产生重复 definition 写入 |
| receipt/readback | replace response 后 authoritative definition read | 保存成功后重新读取当前 host | readback 失败不能报成功 |

真实提交按钮和取消按钮必须各有 app `*TestIds.ts` 常量，testId 挂在真实动作节点；动态卡片不能使用 `${index}` 作为稳定身份。

## 5. 十二维页面交互清单

页面编号是交互和文档标识，不进入 runtime、测试 package/class 或文件名。

| Screen | 页面/宿主 | 核心条件保留 | 动态控件/列位置 | 空态与关键状态 |
| --- | --- | --- | --- | --- |
| `IA-EXT-01` | `platform-admin /platform/extension-fields` 配置表 | 宿主菜单 | 配置表新增两列 | 空配置“暂未配置字段”；catalog/definition 错误显示“暂时无法获取业务对象”/“暂时无法获取${selected.displayName}字段配置” |
| `IA-EXT-02` | 同页编辑字段 Drawer | 既有字段类型、必填、启用、选项、排序 | 两个独立 flag Select；树宿主两项为禁用“不适用” | 保存中禁止重复提交；失败保留草稿；取消/保存固定在底部 |
| `IA-EXT-03` | `operations-admin` 品牌列表 `BRAND` | 现有名称搜索 | dynamic controls 追加核心条件后；dynamic columns 追加业务列后 | 空态“当前结果域暂无记录”；仅名称是现有核心查询 |
| `IA-EXT-04` | 经营租户列表 `TENANT` | 名称、编码、法人公司、统一代码、状态等现有条件 | 同上；不改变核心列 | 沿现有业务实体空态“当前结果域暂无记录” |
| `IA-EXT-05` | 总公司列表 `HEAD_COMPANY` | 现有业务实体核心条件 | 同上；只消费 `HEAD_COMPANY` definition | 长值省略+tooltip；不扩展为树查询 |
| `IA-EXT-06` | 门店列表 `STORE` | 门店名称、编码、品牌、经营租户、总公司等 | dynamic columns 在业务列后、状态前 | 空态“暂无门店”；候选错误与空列表分开 |
| `IA-EXT-07` | 合同列表 `CONTRACT` | 合同编号、门店、分期、经营租户、货号、项目、起止日期等 | 先选择项目；dynamic controls/columns 只在有效 project context 后出现/消费 | 未选项目“请先选择项目”；有项目无结果“暂无合同”；不显示“合同名称” |
| `IA-EXT-08` | `platform-admin` 组织概览品牌 Tab | query identity `category + type` | 当前 Tab 的 dynamic controls/columns | 空态 `暂无${tab.label}`；只读 |
| `IA-EXT-09` | 组织概览经营租户 Tab `TENANT` | 同平台组织核心查询 | `category=BUSINESS_ENTITY,type=TENANT` | 空态“暂无经营租户”；Tab 切换不串数据 |
| `IA-EXT-10` | 组织概览总公司 Tab `HEAD_COMPANY` | 同平台组织核心查询 | `category=BUSINESS_ENTITY,type=HEAD_COMPANY` | 空态“暂无总公司”；只失效当前 Tab |
| `IA-EXT-11` | 组织概览门店 Tab `STORE` | 同平台组织核心查询 | `category=STORE,type=STORE` | 空态“暂无门店”；长值省略+tooltip |
| `IA-EXT-12` | `platform-admin` 合同概览 `CONTRACT` | 合同编号、门店、分期、经营租户、货号、项目、起止日期、状态等 | dynamic controls/columns 只加入合同概览 | 空态“暂无合同”；不出现运营写动作 |

`IA-EXT-03`、`IA-EXT-04`、`IA-EXT-05` 即使复用同一个 React 页面，也保持独立的 host、definition source、query owner、空态和 testId 维度；不能用“业务实体列表”合并它们的交互事实。

## 6. 搜索控件与数据线框

### 6.1 operations-admin 平面列表

```text
┌──────────────────── 核心搜索条件（现有） ────────────────────┐
│ 名称/编码/关系/项目/状态 ...                                  │
├────────────── 动态条件（按 definition.displayOrder） ─────────┤
│ 文本 Input │ 数字 InputNumber │ 日期 DatePicker │ 三态 Boolean │ Select │
├──────────────────────────────────────────────────────────────┤
│ 查询  重置  收起                                               │
└──────────────────────────────────────────────────────────────┘
┌──────────────────────── owner Page ──────────────────────────┐
│ 核心业务列 │ 动态列（无排序） │ 状态 │ 操作                      │
│ item.extensionValues[fieldKey] -> foundation formatter        │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 platform-admin 只读列表

```text
workspace + Tab(category,type)
          │
          ├─ getExtensionDefinition(entityType) -> definition controls
          └─ getPlatform...Page -> core + dynamic query -> Page(raw values)

动态列只读、无排序；详情 Drawer 若展示扩展字段，读取已有 detail/readback 事实，不能由列表逐行补请求。
```

### 6.3 合同项目前置

合同 operations 列表在 project 未选择时只呈现“请先选择项目”，不发合同 list request；项目选定后核心候选和动态搜索才进入可用状态。项目切换不改变 `CONTRACT` definition 的 field identity，但会重置合同 Page、分页和受项目影响的候选条件。

## 7. 反馈、错误与可访问性

| 情形 | 用户反馈 | 焦点/恢复 | 禁止行为 |
| --- | --- | --- | --- |
| 配置初始加载 | 当前内容区 loading | 保留宿主菜单焦点 | 不先显示旧 host 的字段 |
| definition 读取失败 | “暂时无法获取…字段配置”+重试 | 重试按钮可键盘触达 | 不显示空配置当成功 |
| typed filter 无效 | 定位失效条件，显示“筛选条件无效”及原因 | 焦点回到失效控件或错误摘要 | 不把 400 当空 Page |
| definition revision 过期 | 一次 definition 重读；清理失效 dynamic 条件并提示 | 保留核心条件，焦点留在搜索区域 | 不无限自动重试 |
| 保存冲突/校验失败 | 错误显示在 Drawer 内，草稿保留 | 焦点回到首个错误控件 | 不关闭 Drawer、不丢 draft |
| list/候选读取失败 | 现有业务错误+重试 | 当前页面错误可读 | 不借用其他 Tab/候选的空态 |
| 无权限/未登录/停用管理员 | owner/edge typed authorization error | 错误摘要可读 | 不显示“暂无数据” |

错误文案不泄漏 `fieldKey`、revision、owner、token、raw payload 或权限内部细节；技术日志也不得记录密码、OTP、token、cookie、Authorization、手机号、登录名、原始 IP 或 raw payload。

## 8. `SEARCH_CAPABILITY_DENOMINATOR` 与 definition 来源

动态控件的唯一来源是同一宿主 definition operation 返回的 `revision`、`definitions[]`；列表 item 的值唯一来源是对应 list operation 返回的 raw `extensionValues`。具体分母如下：

| 页面 | definition operationId/response | list operation/query identity | 动态请求事实 |
| --- | --- | --- | --- |
| operations brand/tenant/head | `getOperationsOrganizationBusinessEntityExtensionDefinition` / `revision,definitions[]` | 各自 `getOperationsOrganizationBrands/Tenants/HeadCompanies` | `fieldKey,type,value,definitionRevision` |
| operations store | `getOperationsOrganizationStoreExtensionDefinition` / `revision,definitions[]` | `getOperationsOrganizationStores` | 同上 |
| operations contract | `getOperationsContractExtensionDefinition` / `revision,definitions[]` | `getOperationsContracts` + project | 同上 |
| platform organization brand/tenant/head/store | `getExtensionDefinition(entityType)` / `revision,definitions[]` | `getPlatformOrganizationOverviewPage` + `category,type` | 同上 |
| platform contract | `getExtensionDefinition(CONTRACT)` / `revision,definitions[]` | `getPlatformContractOverviewPage` | 同上 |

definition operation 不为每一行调用；任何详情 drawer 的扩展字段展示沿其既有 detail source。若旧 platform list wire 使用 `extensionFields[{name,value:string}]`，实施阶段必须在 §9a 中对照当前 edge schema、generated model、controller mapping 和前端消费者，统一为本需求定义的 raw wire 或记录具有证据的转换边界，不能默默保留第二套 formatter。

## 9. testId 与 L2 前置表

### 9.1 唯一源

计划由主 agent 在实现授权后新增并由各 app 消费：

| app | 计划唯一文件 | 计划常量/身份 | 绑定规则 |
| --- | --- | --- | --- |
| platform-admin | `apps/frontend/platform-admin/src/app/automation/extensionTestIds.ts` | config host、definition table、Drawer、platform host/tab、dynamic field | `${host}:${fieldKey}` 或 `${host}:${tab}:${fieldKey}`；动作节点直接绑定 |
| operations-admin | `apps/frontend/operations-admin/src/app/automation/extensionListTestIds.ts` | operations host、dynamic search、dynamic column、project prerequisite | `${host}:${fieldKey}`；合同追加 project identity |

名称以实现时现有 app automation 目录和 `*TestIds.ts` 约定为准，但必须保持“能力命名、每 app 一个唯一常量源”。不得在 JSX/测试中散写 `data-testid`，不得用 role、label、placeholder、text、index、CSS、XPath 代替。

### 9.2 逐控件前置复核

| case/action | 控件 | owning source | testId | 真实节点 | focused/static proof | fresh 独立复核 | 当前结论 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 选择宿主/Tab | MenuItem/Tab | 配置页/PlatformReadPage | app `*TestIds.ts` | 可点击真实节点 | 待实现 | OPEN_NOT_RUN | OPEN |
| 打开编辑 | Button | ExtensionFieldManagementPage | 常量 | Button 本体 | 待实现 | OPEN_NOT_RUN | OPEN |
| 编辑两个 flag | Select option | Drawer field card | stable draft + flag key | option/真实输入节点 | 待实现 | OPEN_NOT_RUN | OPEN |
| 查询/重置/收起 | Button | 各 list page | host-specific constants | Button 本体 | 待实现 | OPEN_NOT_RUN | OPEN |
| 动态搜索 | Input/InputNumber/DatePicker/Select | 各 host list | host+fieldKey | 实际控件节点 | 待实现 | OPEN_NOT_RUN | OPEN |
| 选择项目 | Select | ContractManagementPage | contract project constant | 真实 Select | 待实现 | OPEN_NOT_RUN | OPEN |
| 分页 | Pagination control | 各 Page | host-specific page constant | 真实分页节点 | 待实现 | OPEN_NOT_RUN | OPEN |
| Drawer 保存/取消/重试 | Button | Drawer/error surface | stable constants | Button 本体 | 待实现 | OPEN_NOT_RUN | OPEN |

`L2_SCRIPT_ADMISSION` 在全部控件拥有稳定业务身份、focused/static proof 和 fresh 独立复核之前保持 `BLOCKED`；本轮没有 browser L2 运行授权，也没有实现 testId 或脚本。

## 10. all-v2 线框基线审计

以下七个 all-v2 对应页面是静态线框参考，不代表可直接复制其旧扩展字段语义，也不代表 heritage registry 已登记；hash 为当前已复核字节：

| 页面 | 当前 SHA-256 | 本交互用途 | 状态 |
| --- | --- | --- | --- |
| `apps/frontend/platform-admin/src/features/extension-field-management/ui/ExtensionFieldManagementPage.tsx` | `4d23ecd15dcfe641c38c3292076c1ebb452f309fb36a4e1d59c9729ee554cc4e` | 配置表/Drawer 线框 | `PENDING_HERITAGE_REGISTRATION` |
| `apps/frontend/operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx` | `ce3ff54d22af79f5e973c42cfa8040199b1feb4d11f0dae03464fc417340276f` | 品牌/租户/总公司列表线框 | `PENDING_HERITAGE_REGISTRATION` |
| `apps/frontend/operations-admin/src/features/store-management/ui/StoreManagementPage.tsx` | `4a4d270aefd097cd6f842327439c56180af396c63c642300997fb553e5d292a5` | 门店列表线框 | `PENDING_HERITAGE_REGISTRATION` |
| `apps/frontend/operations-admin/src/features/contract-management/ui/ContractManagementPage.tsx` | `7bd2bd086555904ba4a33c9350a7af8fb28a220f2bff5b1e54efacffc5a6c3e3` | 合同项目先决条件/列表线框 | `PENDING_HERITAGE_REGISTRATION` |
| `apps/frontend/platform-admin/src/features/organization-overview/ui/OrganizationOverviewPage.tsx` | `72f5ab9beb8f9eb58b1f44effcaaad924d7fcd2dba00e96b93ad21b43c408829` | 平台组织 Tab 线框 | `PENDING_HERITAGE_REGISTRATION` |
| `apps/frontend/platform-admin/src/features/contract-overview/ui/ContractOverviewPage.tsx` | `932784738052ab15f1733900b6d47e29718e0334b8f3e0a32fac8b76f363dfe0` | 平台合同列表线框 | `PENDING_HERITAGE_REGISTRATION` |
| `apps/frontend/operations-admin/src/features/organization-hierarchy/ui/OrganizationHierarchyPage.tsx` | `116c878d01954e1642df7a6c2b5b7fc4524cefd0da7aa01e3b83c942e96d2626` | 仅作树非目标审计，不能产生变更 | `NOT_IN_SCREEN_DENOMINATOR` |

七个路径当前不在 `doc/heritage/registry.json`，因此状态不能写成“已登记”；树页面保留为审计反例，不是本需求 screen。

## 11. 交互交付前检查

实施授权前必须满足：

1. 需求、Journey、IA、交互和 implementation-facing 详设中的平面/树共用段落逐字一致。
2. 12 个 screen、10 个平面消费面、7 个 list operation 和 `SEARCH_CAPABILITY_DENOMINATOR` 全部一一对应。
3. definition source、raw list wire、revision、typed filter、HTTP problem、5 张 `extension_values` 表、索引与预算委托在交互和详设中一致。
4. Drawer 隐藏 `expectedVersion`、`Idempotency-Key`、receipt/readback 与动态字段 stable identity 已在测试/§9a 分母中出现。
5. `OrganizationOverviewDetailDrawer.tsx`、`ContractOverviewDetailDrawer.tsx`、`PlatformReadPage.tsx`、`HeadCompanyBrandAuthorizationActionAdapter.ts`、`platform-read-boundary.test.mjs`、`edge-route-face-registry.json`、`operation-handler-bindings.json` 作为 platform 消费影响面已在 implementation-facing 详设中点名；所有前端 focused tests 至少包括 `OrganizationOverviewPresentation.test.ts` 与 `OrganizationOverviewFilters.test.ts`。
6. round 2 fresh 独立只读 DESIGN review 已完成；S-R2-1 与 N-1 已按 author intake 最小修复闭合，不把 `NO-GO` 报告改写成 `GO`，实施准入来自 Dexter 直接授权和 finding 自闭合。

```text
INTERACTION_SCOPE=2 config screens + 10 flat screens; 7 list operations; tree unchanged
UI_DESIGN_REVIEW=CONFIRMED_2026-09-14
TESTID_REVIEW=OPEN
L2_SCRIPT_ADMISSION=BLOCKED
DEXTER_WIREFRAME_REVIEW=CONFIRMED_2026-09-14
INDEPENDENT_UI_REVIEW=OPEN_NOT_RUN
INTERACTION_STATUS=REVISED_PENDING_INDEPENDENT_DESIGN_REVIEW
```
