# 门店经营规则开关 · 交互设计

`STATUS=IMPLEMENTATION_IN_PROGRESS`  
`JOURNEY_REF=doc/decisions/2026-09-16-v2s-store-operating-rule-switches-journey-codex.md#j-sos-01--门店经营规则开关`  
`REQUIREMENTS_REF=doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-requirements-claude.md`  
`DEXTER_WIREFRAME_REVIEW=CONFIRMED`  
`IMPLEMENTATION_AUTHORITY=true`  
`UI_EVIDENCE=STATIC_MARKUP_AND_FOCUSED_ONLY_FUTURE; BROWSER_L2=NOT_AUTHORIZED`

## 1. 全局交互约束

本稿不另写前端规范，逐字适用 [frontend-coding-standard.md](frontend-coding-standard.md) §3-K。尤其是：既有对象详情仍以唯一“操作”菜单进入编辑；编辑失败不关闭 Drawer、不丢输入且保留服务端原因；保存是一次提交全部本批变更；关闭、Esc、遮罩共用既有 dirty 判定；所有实际可操作节点从 app 的 `*TestIds.ts` 唯一源取得 testId。

本稿是已获 Dexter 视觉 IA 确认的低保真文字线框。它冻结行为、位置、层级、可见文案和失败恢复，不主张像素、颜色或未批准的新页面。

## 2. Screen 声明

| screen id | parent / entry | business task | 主要动作 | 状态 | 证据边界 |
| --- | --- | --- | --- | --- | --- |
| `OPS-SOS-01` | `PG-ORG-STORE-MANAGE` → StoreDetailDrawer 的“操作”→“编辑” | 有编辑权限的人配置既有门店能力 | 改规则、保存/取消 | existing Drawer 的受控扩展 | 静态/未来 focused；视觉与生命周期 L2 待授权 |
| `OPS-SOS-02` | `PG-CATALOG-STORE-ITEMS` | 判断门店商品能力未开通时的可理解状态 | 无写动作；不读列表 | 共享嵌入式 surface | 静态/未来 focused；L2 待授权 |
| `OPS-SOS-03` | `PG-INVENTORY-STORE-STATUS` | 同上 | 无写动作；不读列表 | 共享嵌入式 surface | 静态/未来 focused；L2 待授权 |
| `OPS-SOS-04` | `PG-SALES-MENU-STORE` | 同上 | 无写动作；不读列表 | 共享嵌入式 surface | 静态/未来 focused；L2 待授权 |
| `OPS-SOS-05` | operations-admin 既有操作历史 Modal | 读出本次/历史变更的字段和值状态 | 打开/关闭既有历史 Modal | 只读展示更新 | 静态/未来 focused；L2 待授权 |
| `PLT-SOS-01` | platform-admin 既有操作历史 Modal | 同上 | 打开/关闭既有历史 Modal | 只读展示更新 | 静态/未来 focused；L2 待授权 |

`OPS-SOS-02` 至 `OPS-SOS-04` 是同一个组件的三个 host，不是三个实现。platform-admin 只消费审计展示；它不是规则配置入口。

## 3. OPS-SOS-01：门店编辑 Drawer

### 3.1 位置、层级和线框

在既有基础资料与扩展字段之后增加二级分组“经营规则”。不增加 Tabs、Collapse 或嵌套 Drawer；原因是这是同一 Store 的同一次 CAS 保存，分拆会引入第二份脏状态和第二个提交边界。

```text
┌ 门店名称 · 编辑门店 ─────────────────────────────── [关闭] ┐
│ [既有基础资料与扩展字段，形态保持]                            │
│                                                               │
│ 经营规则                                                       │
│ ─────────────────────────────────────────────────────────── │
│ 商品、库存和菜单管理     [ 开关 ]                             │
│   外部商品、库存、菜单同步 [ 开关 ]                           │
│     开放平台开发者编码  [______________]                     │
│   预约管理               [ 开关 ]                            │
│     预约定金             [ 开关 ]                            │
│   排队叫号               [ 开关 ]                            │
│   桌台管理               [ 开关 ]                            │
│     桌台状态             [ 开关 ]                            │
│       桌台等叫           [ 开关 ]                            │
│       宴会订单           [ 开关 ]                            │
│   取餐叫号               [ 开关 ]                            │
│ 应收管理                 [ 开关 ]                            │
│                                                               │
│                                         [取消] [保存]         │
└───────────────────────────────────────────────────────────────┘
```

没有“功能建设中”“已支持/未支持”标签、商品数量上限或面向门店用户的能力总览。开关顺序、缩进和禁用关系由生成 catalog 的 `parentKey` 唯一驱动；前端不得手写第二棵树。

### 3.2 控件、可见性与文案

| 条目 | 控件 | 可编辑规则 | 必填/帮助 | testId 形态 |
| --- | --- | --- | --- | --- |
| 11 个 BOOLEAN | Ant Design Switch | `applicable(key)=true` 时可编辑；根项一直可编辑 | 无伪必填；后代禁用时显示“请先开启上级功能” | `storeManagementTestIds.operatingRule(key)`，挂到真实 Switch |
| `openPlatformDeveloperCode` | 复用既有 Drawer Form 的 Input 列宽 | 父 `externalCatalogSyncEnabled` applicable 时可编辑 | 非必填，空串为默认值；不承诺外部编码校验；视觉确认后才能冻结尺寸 | `storeManagementTestIds.operatingRule('openPlatformDeveloperCode')`，挂到真实 Input |
| 保存 | 既有主 Button | 非 submitting 时可触发全表单提交 | 无额外确认；该操作可通过后续编辑逆转 | `storeManagementTestIds.editSubmit`，挂到真实 Button |
| 取消/关闭 | 既有路径 | 无脏数据关闭；有脏数据走既有确认 | 不另造第二个 close truth | `storeManagementTestIds.editCancel`，挂到真实 Button |

禁用表示“该项的父能力当前未生效”，不是“数据被清空”或“功能未建设”。父项重新打开后，后代显示此前存储值。Switch 仍以 `false` 初始呈现缺失 BOOLEAN；STRING 缺失呈现空字符串，不能把 null 当成表单值。

### 3.3 提交、成功与失败

- 保存将既有可编辑资料、扩展字段提交和 `operatingRuleSwitches` 一起提交；保留当前 `expectedVersion` 和设置类请求的内容派生幂等键。规则改变是设值类，不为每次点击保存任意新铸 key。
- 成功：沿用既有原子保存成功反馈和关闭规则，父详情必须从 owner readback 显示最新 Store；不凭本地乐观拼接伪造规则事实。
- 请求根形态、未知 key、缺少 required key 或 JSON 类型错误由 OpenAPI/Jackson schema 在 owner 之前拒绝，返回既有 contract validation 的 400；编辑 Drawer 保留可保留的输入并显示既有契约校验反馈，不承诺首项聚焦。通过 schema 的请求若仍违反 owner 才能判断的语义/声明不变量，才返回 `ORGANIZATION_STORE_OPERATING_RULES_INVALID`（422）；problem 带 rule key 时，经营规则分组聚焦第一个非法项。父 false、子 true 是合法组合，不得作为 422。
- `ORGANIZATION_STORE_VERSION_CONFLICT`：沿用既有版本冲突恢复；不可静默覆盖其他用户的规则改动。
- definition/store 读失败：Drawer 不猜默认状态，显示当前任务内可见错误并阻止保存；这是 fail-closed，不能把读失败显示成“所有功能已关闭”。

## 4. OPS-SOS-02/03/04：一个共享的未开通 surface

共享组件仅承载**当前已解析到 Store 且规则 effective=false**的业务状态。文案固定为：

```text
功能尚未开启，需项目对门店授权
```

它替换页面原列表区域和其“新建/编辑”等业务动作区；不得发起任何列表读取请求、不得显示伪可用的新建按钮，也不提供“去开通”链接（当前用户未必有门店编辑权限，且 Dexter 已裁定不做能力总览）。scope 尚未选择继续使用既有 `OperationsRequiredScopeSurface`，不能将二者合并；定义/显式 Store detail 读取失败显示“暂时无法获取门店经营规则，请重试。”并阻断业务子树，不能误显示“未开启”。

组件的唯一 app 内位置由详设确定为 `apps/frontend/operations-admin/src/app/components/OperationsStoreCatalogManagementDisabledSurface.tsx`；它是跨三个 feature host 共享的 app-local 领域组件，不是 foundation：foundation 当前没有这种领域语义，放在 app 层可避免 feature 私有 UI 互相依赖；泛化会制造未验证抽象。

每个 host 统一处理以下状态：

| 状态 | 列表请求 | 可见内容 | 业务子树 |
| --- | --- | --- | --- |
| 规则 loading | 不发 | 既有 loading 语义 | 不挂载 |
| rule read 失败 | 不发 | “暂时无法获取门店经营规则，请重试。” + 真正重试动作 | 不挂载 |
| effective=false | 不发 | 固定未开通文案 | 不挂载 |
| effective=true | 按原有查询 | 原有页面 | 挂载 |
| 后端 command 返回 capability disabled | 已有编辑面保持；显示服务端原因映射 | “功能尚未开启，需项目对门店授权” | 不将失败改成网络错误 |

## 5. OPS-SOS-05 / PLT-SOS-01：审计展示

审计历史仍是既有 Modal。每条新差异显示 `fieldLabelSnapshot`；没有快照的旧记录，先查既有固定字段，仍无法识别时显示“字段（`fieldKey`）”，不得退化为笼统“字段变更”。经营规则从本批开始总写 snapshot，platform-admin 不消费 operations 的 generated rule catalog；扩展字段后来改名或删除时，新历史行仍显示事件时标签。

新格式值渲染：

| state | 用户可见文字 | value |
| --- | --- | --- |
| `MISSING` | 未填写 | 无 |
| `NULL` | 空值 | 无 |
| `CLEARED` | 已清空 | 无 |
| `VALUE` 且空串 | 空字符串 | `""` |
| `VALUE` 且非空 | 原值 | 显示归一化文本；尾随“已截断”即表示被截断 |
| legacy 无 state | 历史记录未区分空值状态 | 保留可得标量，不能虚构四种语义 |

该 Modal 的行不是动作控件；它继续使用现有关闭行为。平台、运营两个实现共同消费 generated `AuditValueState` 类型，但各自在本 app 的 audit-history feature 以穷尽 typed switch 渲染，并用同一组 fixture 断言同一用户可见输出；不新增跨 app rendering helper，避免把空串再次用 `value || '—'` 吞掉。

## 6. 视觉确认与浏览器边界

Dexter 已确认本稿低保真视觉 IA。实现阶段仍必须在每个可操作节点完成 testId 对账。浏览器 L2 需要单独授权，届时证明：禁用状态、三种 host 不发列表请求、脏 Drawer 三条关闭路径、焦点恢复、错误可见帧和层叠行为；本稿的静态声明不能代替这些用户行为证据。

## 7. 模板元数据与 interaction map

```text
JOURNEY_DECISION=doc/decisions/2026-09-16-v2s-store-operating-rule-switches-journey-codex.md#j-sos-01--门店经营规则开关
BUSINESS_REQUIREMENT_SOURCE=doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-requirements-claude.md#3-开关定义与关系
BUSINESS_PROBLEM=门店能力由配置者决定但当前没有可保存、不可绕过的能力事实
BUSINESS_USER_OR_OWNER=有门店编辑权限的集团、大区、项目用户；Store owner
CURRENT_TASK=配置门店经营规则，或在门店经营页面准确理解能力未开通
SUCCESS_OUTCOME=规则由 owner readback 持久化；未开通时不读取列表且后端拒绝写入
UI_BEARING=true
SKILL_USED=NONE
DEXTER_WIREFRAME_REVIEW=CONFIRMED
DEXTER_HIFI_REVIEW=NOT_REQUIRED
CONSUMER_FACE=operations-admin,platform-admin
```

| 顺序 | 前提 | route / 屏幕 | 用户目的 | 可见信息与操作 | server/owner readback | 成功去向 | 失败/退出恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 已有 Store + BC-ORG-STORE-EDIT | 门店管理详情 → 编辑 Drawer | 配置经营能力 | 12 项树、保存、取消 | Store update/readback | 关闭编辑面，详情刷新 | 保留输入/现有 dirty close |
| 2 | 当前 scope 为 Store | 三个门店经营内容页 | 开始既有商品/库存/菜单任务 | loading、规则失败、未开通或原页面 | 显式 Store detail | effective true 挂原页面 | failed/false 均不读列表 |
| 3 | 已有 Store audit event | 既有操作历史 Modal | 看懂改了什么 | 字段标签、before/after 状态和值 | 既有 audit history read | 保持 Modal | 既有关闭/读取失败 |

## 8. 逐 screen 强制声明

### Screen: OPS-SOS-01

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Drawer
HOST_AND_ENTRY=/operations/:groupWorkspaceKey/organization/stores；StoreDetailDrawer 的“操作”菜单点击“编辑”，已有 Store 才可进入
ACTOR=有门店编辑权限的集团、大区、项目用户
BUSINESS_SCENARIO=用户在当前项目确认某门店应具备哪些经营能力
BUSINESS_GOAL=保存一组可恢复的经营开关及开发者编码
USER_VISIBLE_COPY=经营规则；商品、库存和菜单管理；外部商品、库存、菜单同步；开放平台开发者编码；预约管理；预约定金；排队叫号；桌台管理；桌台状态；桌台等叫；宴会订单；取餐叫号；应收管理；请先开启上级功能；取消；保存
TECHNICAL_BOUNDARY=expectedVersion、idempotency、rule key、source hash、grant、definition revision 不显示
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps,useDrawerFormLifecycle,useOverlayLock,testId
CONTAINER_LAYOUT=复用 adminDrawerSurfaceProps 的既有 Drawer 尺寸；Drawer 外框、header 和 footer 不得超视口；唯一滚动容器是 Drawer body；既有 Form label 与控件列保持左对齐，层级仅用内容缩进
```

### Screen: OPS-SOS-02

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=内容页内嵌状态面
HOST_AND_ENTRY=/operations/:groupWorkspaceKey/catalog/store-items；当前 session scope 已解析为 Store
ACTOR=门店商品管理用户
BUSINESS_SCENARIO=用户进入门店商品管理，但门店商品、库存和菜单管理未开通
BUSINESS_GOAL=准确理解不能在此页面操作的业务原因
USER_VISIBLE_COPY=功能尚未开启，需项目对门店授权；暂时无法获取门店经营规则，请重试。
TECHNICAL_BOUNDARY=显式 Store detail request、effective calculation、list skip 不显示
FOUNDATION_PRIMITIVE=adminListState
CONTAINER_LAYOUT=只替换内容页既有列表 body；页面 shell/header/侧栏不属于本 screen；外框和现有内容操作区不得横向溢出；页面原唯一内容滚动容器保持；空态在原列表区居中对齐
```

### Screen: OPS-SOS-03

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=内容页内嵌状态面
HOST_AND_ENTRY=/operations/:groupWorkspaceKey/catalog/store-inventory；当前 session scope 已解析为 Store
ACTOR=门店库存管理用户
BUSINESS_SCENARIO=用户进入门店库存管理，但能力未开通
BUSINESS_GOAL=准确理解不能在此页面操作的业务原因
USER_VISIBLE_COPY=功能尚未开启，需项目对门店授权；暂时无法获取门店经营规则，请重试。
TECHNICAL_BOUNDARY=显式 Store detail request、effective calculation、list skip 不显示
FOUNDATION_PRIMITIVE=adminListState
CONTAINER_LAYOUT=同 OPS-SOS-02；只占原库存列表/操作区，保持既有单一内容滚动容器和对齐
```

### Screen: OPS-SOS-04

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=内容页内嵌状态面
HOST_AND_ENTRY=/operations/:groupWorkspaceKey/catalog/sales-menus；当前 session scope 已解析为 Store
ACTOR=门店销售菜单管理用户
BUSINESS_SCENARIO=用户进入门店销售菜单管理，但能力未开通
BUSINESS_GOAL=准确理解不能在此页面操作的业务原因
USER_VISIBLE_COPY=功能尚未开启，需项目对门店授权；暂时无法获取门店经营规则，请重试。
TECHNICAL_BOUNDARY=显式 Store detail request、effective calculation、list skip 不显示
FOUNDATION_PRIMITIVE=adminListState
CONTAINER_LAYOUT=同 OPS-SOS-02；只占原菜单内容区，保持既有单一内容滚动容器和对齐
```

### Screen: OPS-SOS-05

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Modal
HOST_AND_ENTRY=现有 StoreDetailDrawer 的操作历史入口
ACTOR=可查看门店操作历史的运营用户
BUSINESS_SCENARIO=用户需要确认规则、备注或扩展字段修改的实际前后值
BUSINESS_GOAL=看见当时字段中文名称和不被混淆的空值含义
USER_VISIBLE_COPY=未填写；空值；已清空；空字符串；历史记录未区分空值状态；字段（fieldKey）
TECHNICAL_BOUNDARY=fieldLabelSnapshot、AuditValueState、legacy decoder 不显示为技术字段
FOUNDATION_PRIMITIVE=NONE_WITH_REASON:既有 audit history Modal 未消费 foundation Drawer/lifecycle primitive；本批不新增或替换其弹层外壳
CONTAINER_LAYOUT=沿用现有 Modal 宽度与唯一 body 滚动；header/footer 不超视口；字段、前值、后值三列沿用既有列对齐
```

### Screen: PLT-SOS-01

```text
CONSUMER_FACE=platform-admin
UI_SURFACE=Modal
HOST_AND_ENTRY=现有组织概览中的操作历史入口
ACTOR=可查看组织操作历史的平台用户
BUSINESS_SCENARIO=用户核对同一 Store 审计事实
BUSINESS_GOAL=与运营端一致地理解字段和前后状态
USER_VISIBLE_COPY=未填写；空值；已清空；空字符串；历史记录未区分空值状态；字段（fieldKey）
TECHNICAL_BOUNDARY=fieldLabelSnapshot、AuditValueState、legacy decoder 不显示为技术字段
FOUNDATION_PRIMITIVE=NONE_WITH_REASON:既有 audit history Modal 未消费 foundation Drawer/lifecycle primitive；本批不新增或替换其弹层外壳
CONTAINER_LAYOUT=沿用现有 Modal 宽度与唯一 body 滚动；header/footer 不超视口；字段、前值、后值三列沿用既有列对齐
```

## 9. surface ownership、Heritage 与 L2 前置

| screen | 线框可见元素分母 | 当前 surface owner | USER_VISIBLE_COPY 有位置 | 结论 |
| --- | --- | --- | --- | --- |
| OPS-SOS-01 | 分组标题、12 控件、说明、保存/取消 | 编辑 Drawer | 是 | REVISE_PENDING_DEXTER |
| OPS-SOS-02/03/04 | 未开通/读取失败文字、重试 | 各自内容页的列表 body | 是 | REVISE_PENDING_DEXTER |
| OPS-SOS-05/PLT-SOS-01 | 审计字段/状态/value 文本 | 各自历史 Modal | 是 | REVISE_PENDING_DEXTER |

| screen | 对应关系 | Heritage path / 检索范围 | 静态基线 | 差异理由 |
| --- | --- | --- | --- | --- |
| OPS-SOS-01 | PARTIAL_COUNTERPART | all-v2 StoreManagementPage@4a4d270aefd097cd6f842327439c56180af396c63c642300997fb553e5d292a5；现有 inventory 见 r5 carry-over inventory | 既有 Store 编辑形态；规则分组为新裁决 | 只扩展既有编辑面，不新造入口 |
| OPS-SOS-02/03/04 | NO_V2_COUNTERPART | 检索 frozen registry、r5 carry-over inventory 与当前 catalog/inventory/sales-menu screens | 新的 capability-disabled 分支 | 新业务能力开关，没有旧静态 counterpart |
| OPS-SOS-05/PLT-SOS-01 | PARTIAL_COUNTERPART | 两 app 当前 audit-history feature | 既有 audit Modal | 只加标签快照/空值显示，不改入口 |

L2/自动化前控件 roster：

| 用户动作 | 实际控件 | owning source | testId 唯一源 | 实际节点 | L2 binding | UI focused/static proof | 当前结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 改 BOOLEAN | Switch | StoreEditDrawer | `features/store-management/storeManagementTestIds.ts` 的 `operatingRule(key)` | Switch | 未授权 | future focused render | OPEN |
| 填 developer code | Input | StoreEditDrawer | 同一 source 的 `operatingRule('openPlatformDeveloperCode')` | Input | 未授权 | future focused render | OPEN |
| 保存/取消 | Button | StoreEditDrawer | 同一 source 的 `editSubmit`/`editCancel` | Button | 未授权 | existing lifecycle + future rule test | OPEN |
| 重试 rule read | Button | shared disabled surface | 同一 source 的 `catalogManagementDisabledRetry` | Button | 未授权 | future focused render | OPEN |

UI_DESIGN_REVIEW=NOT_APPLICABLE_WITH_REASON:当前只有设计文字工件，Dexter wireframe 为 UNSET，未授权 L2。  
TESTID_REVIEW=NOT_APPLICABLE_WITH_REASON:尚未有新增 UI 源码，不能把计划中的常量当作已绑定节点。  
L2_SCRIPT_ADMISSION=BLOCKED

## 10. OPS-SOS-01 表单依赖与 mutation 事实

| 用户可见控件 | 控件形态/初始值来源 | 上游依赖与可用条件 | 变更后的级联行为 | loading/failed | owner 再核验 |
| --- | --- | --- | --- | --- | --- |
| 商品、库存和菜单管理；应收管理 | Switch；Store resolved value/default false | 无上游；根项可编辑 | 不清理任何后代 | Store/rule read failed 时整个表单不可保存 | fixed key/type/default |
| 外部同步、预约、排队、桌台、取餐 | Switch；Store resolved value/default false | catalogManagementEnabled effective=true | parent false 后只 disabled，保留值 | 同上 | parent tree + type |
| 开发者编码 | Input；Store resolved value/default empty string | externalCatalogSyncEnabled applicable=true | parent false 后 disabled，保留文本 | 同上 | STRING type；不查候选 |
| 预约定金 | Switch | reservationEnabled applicable=true | parent false 后 disabled，保留值 | 同上 | parent tree + type |
| 桌台状态 | Switch | tableManagementEnabled applicable=true | parent false 后 disabled，保留值 | 同上 | parent tree + type |
| 桌台等叫、宴会订单 | Switch | tableStatusEnabled applicable=true | parent false 后 disabled，保留值 | 同上 | parent tree + type |

FORM_MUTATION_DENOMINATOR=2：Update existing Store（本 screen）与 Create Store（无本批新增 UI 控件，规则仅为 optional owner default/seed input）。

| command variant | request fact | 来源/控件 | required 与默认 | 失败/owner 复核 |
| --- | --- | --- | --- | --- |
| Update Store | name、headCompanyId、notes、extensionValues、extensionRuleRevision、expectedVersion | 既有 StoreEditDrawer | 保持既有 contract | 原有 relation/revision/CAS 复核 |
| Update Store | operatingRuleSwitches 完整 12 键 | OPS-SOS-01 generated catalog Form | required for update；所有 BOOLEAN default false，STRING default empty | schema key/type/tree/fullness 错误为 400；schema 通过后的 owner 语义错误为 422 |
| Create Store | brandId、tenantId、headCompanyId、code、name、extensionValues | 既有 StoreCreateDrawer | 保持既有 contract | 原有 create/relationship 复核 |
| Create Store | operatingRuleSwitches | 无本批 UI；seed/API optional full map | omitted means owner default empty object | 仅出现时 schema key/type/tree/fullness 错误为 400；schema 通过后的 owner 语义错误为 422 |

共享原子组为 Store 基础资料、扩展字段、operatingRuleSwitches、expectedVersion、idempotency、owner readback 与 audit；不得拆成第二个保存按钮或 mutation。
