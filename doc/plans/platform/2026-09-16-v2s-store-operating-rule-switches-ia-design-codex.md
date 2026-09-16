# 门店经营规则开关 · 信息架构与状态设计

`STATUS=IMPLEMENTATION_IN_PROGRESS`  
`IA_SCOPE=IA-SOS-01,IA-SOS-02,IA-SOS-03`  
`BUSINESS_SOURCE=doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-requirements-claude.md`  
`JOURNEY_REF=doc/decisions/2026-09-16-v2s-store-operating-rule-switches-journey-codex.md`  
`UI_INTERACTION_REF=doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-interaction-design-codex.md`  
`IMPLEMENTATION_DESIGN_REF=doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-implementation-design-codex.md`  
`DEXTER_WIREFRAME_REVIEW=CONFIRMED`  
`IMPLEMENTATION_AUTHORITY=true`  
`BROWSER_L2=NOT_AUTHORIZED`

## 1. IA-SOS-01：门店经营规则编辑

| 维度 | 设计 |
| --- | --- |
| 容器 | 既有 `StoreEditDrawer`，不是新增页面/详情 Drawer/独立能力总览。 |
| 数据来源 | Store owner readback 中的 `operatingRuleSwitches` + generated rule catalog；前者是值，后者是树、类型、默认值、中文标签与父关系。 |
| 用户可见事实 | 12 条规则的中文标签、层级、当前值、不可编辑原因。 |
| 不可见控制 | 当前 Store ref、expectedVersion、内容派生 idempotency、rule catalog hash/revision、Drawer dirty/submitting 生命周期。 |
| 写入边界 | 现有 create/update Store command；资料、扩展字段、规则同一请求、同一 owner transaction 和 readback。 |
| 读取失败 | 不显示猜测的默认规则；显示当前 Drawer 内可见错误、禁止保存，可重新打开/重试既有 Store detail 读路径。 |
| 写失败 | 保持 Drawer、输入与 server feedback；不把 403/409/422 改称网络错误。 |

### 信息层级

1. 既有门店基础资料与扩展字段保持原序。
2. 二级标题“经营规则”是一个独立可理解的事实组，紧随已有信息后。
3. 两棵根按 generated display order 排列；子项只用缩进显示层级，不增加 Cards、Tabs、Collapse 或状态角标。
4. 字段 label 是中文业务名；存储 key、catalog hash、动态审计 key 不进入普通用户可见 UI。

### 编辑状态机

| 状态 | 进入条件 | 可见/可操作 | 退出 |
| --- | --- | --- | --- |
| `READING` | 打开/切换 Store 时 owner read 尚未稳定 | 既有 Drawer loading；不渲染旧 Store 的规则 | 成功→`READY`，失败→`READ_FAILED` |
| `READY` | current Store + rule catalog 有效 | 根项可编辑；子项按 applicable 启用 | 任一编辑→`DIRTY`，关闭→既有 requestClose |
| `DIRTY` | 任一基础/扩展/规则字段变化 | 保存可用；三种关闭路径走相同 dirty 确认 | 保存→`SUBMITTING`，放弃→关闭 |
| `SUBMITTING` | 发送既有 update command | 所有 close truth 与重复保存锁定 | 成功→关闭/readback；失败→`DIRTY` |
| `READ_FAILED` | Store/rule catalog 不可读或不合法 | 显示可见错误；不可保存 | 重读成功→`READY` |

没有“父 false 时清空子值”的状态转移；那会破坏 R-4.3。

## 2. IA-SOS-02：三个门店经营页面的 capability gate

| 维度 | 设计 |
| --- | --- |
| hosts | `PG-CATALOG-STORE-ITEMS`、`PG-INVENTORY-STORE-STATUS`、`PG-SALES-MENU-STORE`。 |
| 决策事实 | 当前全局选择器产生的 `queryContext.scopeRef` 指向的 Store-target `getOperationsOrganizationStoreOperatingRule` readback 的 `operatingRuleSwitches`，由 generated catalog 计算 `catalogManagementEnabled` effective 值；请求显式传 `storeId`。该选择可由 GROUP/REGION/PROJECT/STORE assignment 用户产生，服务端以 STORE target 重新复核可见范围。 |
| 单一住址 | 每个 page host 只消费同一个 `getOperationsOrganizationStoreOperatingRule` RTK query；不将 rule state 镜像到 Redux/组件 state，`scopeRef` 不能只作为缓存键。 |
| 不可替代后端 | 页面 gate 只避免误导性 UI 和无用 list read；52 条 mutation 的授权仍由 backend owner gate 决定。 |
| shared component | `OperationsStoreCatalogManagementDisabledSurface`（`apps/frontend/operations-admin/src/app/components/OperationsStoreCatalogManagementDisabledSurface.tsx`）是三个 host 的单一业务 surface；scope 缺失继续由既有 `OperationsRequiredScopeSurface` 处理。 |

### 状态优先级

优先级从高到低，避免把失败/空 scope 误写成“能力关闭”：

1. 无 Store scope：既有 required-scope surface，未发 Store detail/list。
2. 显式 Store detail/rule catalog loading：loading，未挂载业务列表/写面。
3. 显式 Store detail/rule catalog failed 或解析失败：失败反馈“暂时无法获取门店经营规则，请重试。”，真实重试只重取 Store detail；未挂载业务列表/写面。
4. effective=false：共享未开通 surface“功能尚未开启，需项目对门店授权”，未发**列表**请求。
5. effective=true：原始页面与查询/刷新/详情生命周期完整挂载。

`currentData` 用于参数可变的列表/详情；Store detail 的 `storeId` 来自当前已选 Store 的 `queryContext.scopeRef`，且 cache invalidation/reload 必须随 context version/Store 切换生效。页面刷新仍要订阅 Shell 的统一刷新信号：刷新 enabled surface 时重取原有读模型；刷新 disabled surface 时重取 Store detail，不得仅刷新标题。

## 3. IA-SOS-03：审计事件的字段与值

| 维度 | 新事件事实 | 旧事件回退 |
| --- | --- | --- |
| field identity | `fieldKey` + 可选 `fieldLabelSnapshot` | `fieldKey` |
| before / after | `state` + 可选 scalar value | 原三元组能取到的 scalar |
| 动态扩展字段 | write 时从当前 definition 获取标签快照 | 删除/改名后显示 key fallback，不伪造当时标签 |
| 固定规则字段 | generated rule catalog 的 label；write 时同样写快照 | `字段（key）` fallback；platform 不跨 app 消费 rule catalog |
| 空值 | MISSING / NULL / CLEARED / VALUE(empty string) 四种 | “历史记录未区分空值状态” |
| 截断 | 标量尾随“已截断” | 保持历史原值 |

两个管理后台均使用同一 generated edge type，但不跨 app import，也不虚构不存在的 foundation audit primitive。各自 audit-history feature 对四个 generated state 做穷尽 typed switch，并以详设 §5.4 的同一组 fixture 断言同一用户可见结果；不新增规则 label map、不继续 `value || '—'` 条件。

## 4. 错误与恢复契约

| 条件 | owner/edge 语义 | UI 呈现 | 可恢复动作 |
| --- | --- | --- | --- |
| 请求根形态、JSON schema unknown/missing/type 不合法 | 既有 contract validation，400（owner 前拒绝） | 保留输入并显示既有契约校验反馈；不承诺首项聚焦 | 修正输入后重存 |
| schema 已通过但 owner 语义/声明不变量不合法 | `ORGANIZATION_STORE_OPERATING_RULES_INVALID`，422 | 经营规则分组错误；problem 带 rule key 时聚焦第一个非法项 | 修正输入后重存 |
| Store CAS 过期 | 既有 `ORGANIZATION_STORE_VERSION_CONFLICT`，409 | 既有版本冲突处置 | 按既有流程重读/重新编辑 |
| STORE mutation 未开通 | `ORGANIZATION_STORE_CATALOG_MANAGEMENT_DISABLED`，403 | 业务文案“功能尚未开启，需项目对门店授权” | 无伪重试；待具备权限的人开通 |
| Store detail/rule read 失败 | 既有 transport/problem 语义 | “暂时无法获取门店经营规则，请重试。” | 真正 refetch Store detail |
| 原 capability/scope/lifecycle 拒绝 | 保留原 typed problem | 既有 mapping | 按原业务原因处理 |

新 capability code 不能复用 `SALES_MENU_STORE_DISABLED`：后者是既有销售菜单中 Store 生命周期 disabled 的不同事实。新 code 须进入 error-code catalog、generated enum、`ContractProblemAdvice`、两个 frontend feedback map，并加到映射中每条 52 个 mutation 的 OpenAPI `x-error-codes`；错误码 catalog 当前 operation 机制是全局 `errorSets + operationErrorAugmentations` 口径而非仅 OTP 白名单，详设据此冻结更新方式。

## 5. 数据量、刷新与可访问性

- rule catalog 固定 12 行，Drawer 不分页、不搜索；这一规模不需要通用 rule engine、虚拟列表或缓存层。
- audit 列表保持既有分页；新增 label/state 都是单条 audit event 内标量，不引入 audit join 或按行查 definition。
- update 成功只以 owner readback 更新当前 Store；Store detail 的 cache 通过现有 operation tag/统一 refresh 失效，不以手工 state 同步。
- root/child disabled 控件需要可见 label 与“请先开启上级功能”说明；不能仅凭颜色。用户可依 Tab 顺序到达启用控件，禁用控件不应成为无法解释的焦点陷阱。
- 详情 Drawer 的焦点、编辑 Drawer 的焦点归还和遮罩层级沿用 foundation `adminDrawerSurfaceProps`、`useDrawerFormLifecycle`、`useOverlayLock`；本批没有第二个弹层，故不引入新叠层上限。

## 6. IA 完整性核对

| 需求 | IA 落点 |
| --- | --- |
| 12 项、两根、深度 4、保留子值 | IA-SOS-01 信息层级/状态机 |
| 同一权限与同一次提交 | IA-SOS-01 数据/写入边界 |
| 三页不读列表的未开通状态 | IA-SOS-02 优先级 4 |
| 后端仍是真正授权 | IA-SOS-02 不可替代后端 |
| 逐字段审计、动态 key、rename/delete 历史 | IA-SOS-03 |
| 四种空与截断 | IA-SOS-03 表格 |
| 不造能力总览/新审计页/终端 | §1、§2、§3 的容器边界 |

本稿仅为设计核对输入；未执行组件测试、typecheck、codegen、migration、reset、DEV、seed 或浏览器 L2。

## 7. 每个 IA-ID 的模板维度

| IA-ID | businessTask | actorAndScenario | entryAndSurface | controlType |
| --- | --- | --- | --- | --- |
| IA-SOS-01 | 保存一组门店经营授权事实且不丢失下级配置 | 有编辑权限的集团/大区/项目用户编辑已有门店 | 门店管理→详情 Drawer“操作”→编辑 Drawer | 11 Switch、1 Input、现有保存/取消；编辑态禁用后代，详情态只读 |
| IA-SOS-02 | 在未开通时不误导地阻断商品/库存/菜单任务 | 已选择 Store 的经营用户（GROUP/REGION/PROJECT/STORE assignment）进入三页之一 | 三个既有内容页的列表 body | 无开关输入；Store detail loading、failed retry、disabled surface 或原业务页面 |
| IA-SOS-03 | 看懂一次资料/扩展/规则变更的前后语义 | 有审计查看权限用户打开既有历史 Modal | 既有 operations/platform audit-history Modal | 只读字段/前值/后值；无 mutation 控件 |

| IA-ID | validationAndError | accessibilityAndTestId | emptyLoadingErrorStates | containerBehaviorUnderLoad |
| --- | --- | --- | --- | --- |
| IA-SOS-01 | schema 400 与 owner 422 分层；后者在 problem 带 key 时聚焦首项；409 保留既有冲突；失败留稿 | Switch/Input 真实节点使用计划中的 apps/frontend/operations-admin/src/features/store-management/storeManagementTestIds.ts；disabled 加“请先开启上级功能”，不靠灰色 | Store/catalog read loading 不渲染旧规则；failed 禁止保存且显示原因 | 固定 12 行，Drawer body 单一滚动；developer code 复用现有 Form 控件列宽，视觉确认后才冻结尺寸；footer 不溢视口、labels 左对齐 |
| IA-SOS-02 | Store detail failed 显示“暂时无法获取门店经营规则，请重试。”；403 capability 显示业务文案 | retry 是真实 Button testId；静态文案非动作 | scope missing、loading、failed、false、true 按 §2 优先级互斥，旧列表不保留 | 一项嵌入式状态；无集合；页面既有单一滚动/操作区不溢视口 |
| IA-SOS-03 | audit read error 沿用既有反馈；unknown legacy 不伪造 | 只读文本非动作；Modal 既有关闭可键盘关闭 | audit pagination/loading/error 沿用既有；legacy 显示明确状态 | 分页 collection；长 value 换行或既有单元格截断策略必须在实现前与当前 Modal 对齐，header/footer 不溢视口 |

| IA-ID | stateAndPermission（可执行观察） | navigationAndRefresh（可执行观察） | collectionShapeAndScale（可执行观察） | dataSourceAndCascade / forbiddenUI（可执行观察） |
| --- | --- | --- | --- | --- |
| IA-SOS-01 | [acceptance] STORE role 试图获得 BC-ORG-STORE-EDIT 被拒，GROUP/REGION/PROJECT 正向成功；[static] Store edge 保留 grant | [focused] update success 仅以 owner response 回填 Drawer/详情；失败不关闭 | Fixed 12；[static] catalog 输出恰 12，前端无分页/客户端 slice | data=Store owner readback+generated catalog；父 false 仅 disabled、不 clear；[static] 禁止 StoreEditDrawer 手写 parent/default relation |
| IA-SOS-02 | [acceptance] direct STORE mutation false 时 403；[static] 三 host gated before list | [focused] scope/context/shell refresh 触发 Store detail 读；false 不触发 list | Fixed one Store detail and existing server-paged business list；[static] false branch 不 mount list subtree | data=Store detail（storeId=scopeRef）；[static] 禁止复制三个 disabled 文案组件、禁止 global/local rule mirror |
| IA-SOS-03 | [acceptance] audit read 仍受既有 read authorization；[static] no new audit route | [focused] event read model changes only by existing query refetch | Existing paged audit collection；values max 2000 display chars after normalizer | data=AuditChangeJson label snapshot; [static] 禁止 value-or-dash renderer 或用户可见 raw enum |

## 8. 共用 IA 规则与错误全量映射

共用规则：规则 value 只来自 Store owner readback；parent/default/type 只来自 generated catalog；开启/关闭不删除业务数据；页面 UI gate 从不代替后端 gate；dynamic audit key 只从本次 definition 获取；用户可见文案不出现 rule key、owner、scope、schema、enum。

| problem code / 条件 | HTTP | 触发处 | 用户可见处理 |
| --- | --- | --- | --- |
| contract validation（根形态/unknown/missing/type） | 400 | Store create/update，owner 前 schema/binding | 保留输入，显示既有契约校验反馈，不承诺首项聚焦 |
| ORGANIZATION_STORE_OPERATING_RULES_INVALID | 422 | schema 已通过的 Store create/update owner 语义校验 | 经营规则分组错误；problem 带 rule key 时保留输入并聚焦首项 |
| ORGANIZATION_STORE_VERSION_CONFLICT | 409 | Store update | 既有版本冲突处置，不覆盖 |
| ORGANIZATION_STORE_CATALOG_MANAGEMENT_DISABLED | 403 | 52 STORE mutation | 功能尚未开启，需项目对门店授权 |
| Store detail/rule read failure | 既有 transport/problem | 三个 consumer host | 暂时无法获取门店经营规则，请重试。 |
| existing scope/auth/lifecycle problem | 既有 HTTP | Store 编辑及三 host | 既有准确反馈，不改写成网络错误 |

## 9. 交叉对账与完成判定

| 检查 | 结论 |
| --- | --- |
| IA ↔ interaction | 入口、surface、文案、容器和无能力总览边界相同；待独立 review 复核 |
| IA ↔ 详设 | catalog/Store detail/gate/audit state/error chain/seed 描述相同；待独立 review 复核 |
| IA-ID ↔ Journey | 3 个 IA-ID 都追到 J-SOS-01 的配置、消费者、审计步骤 |
| 计数自证 | IA_SCOPE 为 3，本文 §1-3 正好 3 个 IA-ID |

```text
IA_DIMENSIONS=IA-SOS-01,IA-SOS-02,IA-SOS-03；两组维度已声明
INVISIBLE_DIMENSIONS_AS_OBSERVATIONS=是（仅计划，未执行）
FORBIDDEN_UI=explicit
TYPED_PROBLEMS=3 new/explicit plus existing transport/scope family
CROSS_CHECK_WITH_DESIGN=PENDING_INDEPENDENT_REVIEW
DEXTER_WIREFRAME_REVIEW=CONFIRMED
IA_STATUS=IMPLEMENTATION_IN_PROGRESS; implementation authorized by Dexter
```
