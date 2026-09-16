# J-SOS-01 · 门店经营规则开关

`JOURNEY_ID=J-SOS-01`  
`STATUS=IMPLEMENTATION_IN_PROGRESS`  
`SKILL_USED=NONE`  
`DECISION_OWNER=Dexter`  
`UI_BEARING=true`  
`CORPUS_VERSION=project-memory/decisions/confirmed-business-language-corpus.md (current source required before implementation)`  
`CONSUMER_FACES=operations-admin,platform-admin`  
`DEXTER_WIREFRAME_REVIEW=CONFIRMED`  
`IMPLEMENTATION_AUTHORITY=true`  
`EVIDENCE_TIER=IMPLEMENTATION_IN_PROGRESS`

## 1. 要解决的真实问题

集团、大区或项目范围内有门店资料编辑权限的人，需要在**既有门店编辑 Drawer** 中决定门店具备哪些经营能力；门店实际经营者不应能自己为门店开通能力。当前只有“商品、库存和菜单管理”有真实消费者：如果该能力未开通，门店商品、库存和销售菜单页面不能误让用户读取列表或发起写入；已经存在的数据不能因关闭开关而被删除。

本 Journey 不建设详细规则层。商品、库存、菜单既有管理界面仍是详细规则层；终端、本地第二套“已开通能力”总览、商品数量上限和功能建设状态标注均不在范围。

## 2. 前置条件与入口

| 维度 | 结论 |
| --- | --- |
| Actor | 已被授予 `BC-ORG-STORE-EDIT` 的 GROUP、REGION 或 PROJECT 用户；STORE 层角色不是合法 actor。 |
| 入口 | operations-admin 当前项目的“门店管理”列表，点击门店名称打开既有详情 Drawer，在唯一“操作”菜单选择“编辑”。 |
| 目标事实 | 既有 Store；新建门店也可带默认开关创建，但不另造配置入口。 |
| 权限依据 | `contracts/catalog/admin-catalog.json` 的 `BC-ORG-STORE-EDIT` 与既有 `WorkspaceRoleService.validateCatalogs`；不是前端隐藏按钮。 |
| 退出 | 保存后关闭编辑 Drawer，详情/后续 owner readback 显示最新门店资料；取消或关闭有脏数据时遵守既有 Drawer 生命周期。 |

### 2.1 逐 actor 前提链

| 前提 | 对谁 | 需要什么事实 | 来源类型 | 产生/确认位置 | 来源证据 | 未满足时的行为 |
| --- | --- | --- | --- | --- | --- | --- |
| 身份 | 集团/大区/项目的运营后台用户 | 已认证 operations session | ESTABLISHED_SOURCE | 既有 workspace-session | `contracts/openapi/paths/operations-admin/workspace-session.paths.json` | 既有 authentication required。 |
| 访问资格 | 同上 | 已有 `BC-ORG-STORE-EDIT` 及有效 grant | ESTABLISHED_SOURCE | 既有 role catalog + Store command edge | `contracts/catalog/admin-catalog.json:1181-1193`; `WorkspaceRoleService.validateCatalogs` | 既有 access denied；不以隐藏控件代替。 |
| 入口数据 | 同上 | 当前 project scope 中已有 Store | ESTABLISHED_SOURCE | `StoreManagementPage` 列表→详情→编辑 | `apps/frontend/operations-admin/src/features/store-management/ui/StoreManagementPage.tsx` | 保持现有空态/required-scope，不凭空创建 Store。 |
| 业务数据 | 已选择 Store 的业务用户（GROUP/REGION/PROJECT/STORE assignment） | 当前已选 Store 的显式 Store-target operating-rule owner read | ESTABLISHED_SOURCE | `getOperationsOrganizationStoreOperatingRule` | `contracts/openapi/paths/operations-admin/store-operating-rule.paths.json`；`OperationsStoreOperatingRuleController` | required-scope 或 operating-rule read failed surface；不读业务列表。 |
| 规则默认/树 | 配置者和消费者 | 12 条闭集 declaration | IN_SCOPE_PRODUCED | 本批 catalog generator（未来） | requirement §3.1；详设 §3 | 本期仍为设计输入，未实施时不得呈现为功能存在。 |

无行属于 EXTERNAL_PREREQUISITE_DEXTER_DECISION；但低保真视觉确认仍为本 Journey 实施前的 Dexter 入口闸门。

## 3. 用户路径

1. 用户从“门店管理”进入一个已存在门店的详情 Drawer，使用详情 Drawer 的“操作”菜单打开编辑 Drawer。
2. 编辑 Drawer 在既有门店资料字段之后展示“经营规则”分组和全部 12 个配置。字段按照唯一声明的两棵树缩进；开关未标记“建设中”。
3. 用户关闭某个父 BOOLEAN 时，后代控件立即禁用但其已存值继续保留；重新打开父项后原值可继续编辑。这里不得照搬新建 Drawer 的候选级联清空。
4. 用户保存时，门店资料、扩展字段和经营规则通过同一个现有 update 请求、同一 expectedVersion 和同一幂等语义提交。失败时编辑 Drawer 保持打开，字段和服务端原因保持可见。
5. 此后门店在“门店商品管理 / 门店库存管理 / 门店销售菜单”操作时，页面先以当前 `queryContext.scopeRef` 作为 `storeId`，读取专用 `getOperationsOrganizationStoreOperatingRule` 的 Store-target 规则事实：能力未开通时渲染统一未开通 surface 且不发列表读；能力开通时按原路径工作。服务端以 `resolveTaskScope(session, STORE, storeId)` 复核目标 Store：GROUP/REGION/PROJECT 沿祖先路径可读，STORE 仅可读自身；不能把 `scopeRef` 仅当缓存键。所有对应 STORE mutation 仍由后端 gate 决定，前端不能成为授权边界。
6. 操作历史在既有平台与运营审计面展示逐字段差异、字段当时的中文标签和可辨别的空值状态；不新建审计页面或查询接口。

## 4. 冻结业务树

两棵根、11 个 BOOLEAN、1 个 STRING、最大深度四层；缺失存储值以声明默认值解释：BOOLEAN 为 `false`，STRING 为**空字符串**（不是 JSON null）。所有键必须按以下顺序和关系来自单一声明：

```text
商品、库存和菜单管理 catalogManagementEnabled
├─ 外部商品、库存、菜单同步 externalCatalogSyncEnabled
│  └─ 开放平台开发者编码 openPlatformDeveloperCode
├─ 预约管理 reservationEnabled
│  └─ 预约定金 reservationDepositEnabled
├─ 排队叫号 queueCallEnabled
├─ 桌台管理 tableManagementEnabled
│  └─ 桌台状态 tableStatusEnabled
│     ├─ 桌台等叫 tableWaitCallEnabled
│     └─ 宴会订单 banquetOrderEnabled
└─ 取餐叫号 pickupCallEnabled
应收管理 receivableEnabled
```

`applicable(key)` 只有所有 BOOLEAN 祖先的 effective 值均为 true 时才为 true；BOOLEAN 的 `effective(key)=applicable(key) && stored-or-default(key)`。STRING 不是能力开关：仅在父项 applicable 时可编辑，空串是默认事实。父项关闭不抹除后代存储值。

## 4.1 Corpus 命中与冲突

| 术语/关系 | 现行 corpus / 裁决来源 | 本 Journey 的使用 | 冲突/未知 | Dexter 裁决是否必要 |
| --- | --- | --- | --- | --- |
| 运维管理后台 / 运营管理后台 | `AGENTS.md` 术语红线 | Store 配置在 operations-admin；platform-admin 只读 audit | 无 | 否 |
| 门店经营规则是开关层 | requirement §1、§3 | 只存能力开关；不吸收商品/库存/菜单详细规则 | 无 | 否 |
| 商品、库存、菜单真实消费者 | requirement §3.3、§6 | 仅 catalogManagementEnabled 被消费 | 无 | 否 |
| 门店编辑权限 | requirement §5.1 | 复用现有能力，不新建权限 | 无 | 否 |
| 开放平台开发者编码 | requirement §11 | 当前为 STRING，不把 provider profile 当作选择实体 | 是否存在权威 collaboration entity 仍未证实 | 若要改为候选，必要 |
| 四实体审计范围 | requirement §7.3 | 按共享支撑一并纳入 | 是需求推论，不是直接原话 | 若要收窄，必要 |

## 5. 对应 UI 面与不适用面

| surface | 本批变化 | 交互理由 |
| --- | --- | --- |
| `PG-ORG-STORE-MANAGE` 的既有 StoreEditDrawer | 增加经营规则分组 | 配置入口与既有门店资料共用权限、并发与生命周期。 |
| `PG-CATALOG-STORE-ITEMS` | 能力未开通时以共享 surface 代替列表 | 不发列表请求；不单独造新页面。 |
| `PG-INVENTORY-STORE-STATUS` | 同上 | 同一能力事实、同一句业务解释。 |
| `PG-SALES-MENU-STORE` | 同上 | 同一能力事实、同一句业务解释。 |
| operations-admin / platform-admin 既有审计历史 | 正确显示动态字段标签和值状态 | 既有审计读出口即可承载，不另造页面。 |
| platform-admin 门店概览 | 不增加编辑入口 | 平台端现有门店面是只读概览；新建第二个配置入口会造成权限和事实双住址。 |
| 终端、门店能力总览 | 不适用 | Dexter 已裁定本期不接终端、也不做独立总览。 |

## 6. 交互与可访问性承诺

本 Journey 逐字适用 [frontend-coding-standard.md](../platform/frontend-coding-standard.md) §3-K：表单 label 在控件上方、根/子项依层级分组；可编辑项才出现交互控件；保存和取消位置及脏数据关闭路径沿用既有 `useDrawerFormLifecycle`；失败在当前 Drawer 里呈现且不改写服务端原因。对象详情入口继续满足 §3-K-10 的单一“操作”菜单，本批不把配置动作平铺回 header。

被禁用的子项仍以可读文字和当前保留值呈现，禁用语义通过原生控件 disabled 状态及说明“请先开启上级功能”表达，不能只用灰色传递信息。开关、字符串输入、保存、取消和统一未开通 surface 的容器都必须由 operations-admin 的 `*TestIds.ts` 提供真实触点 testId；审计为只读展示，不把行文本伪装成动作控件。

## 7. 证据与授权边界

本 Journey 依据当前需求正本、当前源码与静态盘点形成。Dexter 已确认低保真视觉 IA；Claude 第 2 轮独立 DESIGN review 后，M-01/N-01 已按当前字节修复并获得实施授权。

`AUTHORIZED=详设与实施计划修订 + production code | contract generation | migration | build | test | backend acceptance | reset | DEV | seed`  
`NOT_AUTHORIZED=browser L2 | UAT | deploy`

## 8. Dexter 裁决

- 裁决状态：已授权实施——低保真线框已确认，Claude 第 2 轮 DESIGN review 的 M-01/N-01 已修复；业务范围、12 项树、默认值、权限边界和审计裁决均来自当前需求正本，未在此重裁。
- 精确范围：既有 Store 编辑 Drawer、三个门店经营 host 的 capability surface、已有双端审计 history rendering、Store owner/contract/audit/gate/seed 的详设与计划。
- 已知前提：本批三个 consumer host 使用显式 `getOperationsOrganizationStoreOperatingRule` Store-target owner read，`storeId` 来自当前已选 Store；增加该 operation 后 current registry 270 行是 R-9.2 的分母。既有 `getOperationsStoreProfile` 与 Store-management detail 的历史调用者不在本批改动范围内。
- 未决项：开放平台开发者编码是否将来改为 collaboration 候选；四实体审计若要收窄必须回 Dexter。
- 后续允许动作：按实施计划 P1-P9 完成生产代码、契约生成、迁移、测试与 backend acceptance，随后受管 reset→DEV→seed；browser L2、UAT、deploy 仍需单独授权。
