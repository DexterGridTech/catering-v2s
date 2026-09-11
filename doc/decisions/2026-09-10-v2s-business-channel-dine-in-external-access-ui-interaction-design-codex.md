---
title: v2s 到店点餐允许外部接入 UI interaction design amendment
status: PROPOSED_FOR_DESIGN_REVIEW
createdAt: 2026-09-10
decisionOwner: Dexter
programId: V2S_W0_W4_EXECUTION
journeyRef: doc/decisions/2026-09-10-v2s-business-channel-dine-in-external-access-journey-amendment.md
iaRef: doc/decisions/2026-09-10-v2s-business-channel-dine-in-external-access-ia-amendment-codex.md
implementationAuthority: false
DEXTER_WIREFRAME_REVIEW: UNSET
---

# 到店点餐允许外部接入 · UI interaction design amendment

## 0. 适用范围与不可变业务语义

本工件只修改既有 `operations-admin` 的 O2 模板、O5 门店经营渠道及 O4 渠道详情呈现；不创建新 Journey，不把外部系统的菜单搬进本平台。

用户要表达的是“门店自有小程序可以承载到店消费”。在本平台，外部 `DINE_IN` 的可见业务信息是“外部接入 + 到店点餐 + 外部档案”，不是某一种内部终端形式。外部 `DINE_IN` 永远不显示、不选择、不提交 `POS`、`QR` 或 `KIOSK`。

```text
UI_DESIGN_REVIEW=OPEN
TESTID_REVIEW=OPEN
L2_SCRIPT_ADMISSION=BLOCKED
IMPLEMENTATION_AUTHORITY=false
```

## 1. 信息层次与容器

### 1.1 O2 模板 Drawer

模板 Drawer 使用既有 `BusinessChannelTemplateDrawer` 及 `adminWideDrawerSurfaceProps`，内容按用户决策顺序分为四段：

1. **基本信息**：模板名称、模板编码；编码创建后只读。
2. **经营范围**：经营主体、订单类型；经营主体为 `STORE` 时才出现门店可见范围。
3. **接入方式**：内部接入/外部接入。该段解释渠道由本平台还是外部系统承载。
4. **承载配置**：内部 `DINE_IN` 显示到店点餐形式；外部接入显示外部接入档案。`EXTERNAL + DINE_IN` 显示只读说明，不显示内部形式控件。

表单 footer 只保留“取消”“保存”；不在表单中增加外部菜单、POS/QR/KIOSK 映射或“自动创建菜单”开关。

### 1.2 O2 条件交互

| 当前条件 | 用户看见的控件 | 可提交事实 | 说明 |
| --- | --- | --- | --- |
| `STORE + INTERNAL + DINE_IN` | `到店点餐形式` Select：POS、扫码、自助机 | `dineInForm=POS|QR|KIOSK`，`providerCode=null` | 内部点餐终端，沿用既有语义 |
| `STORE + EXTERNAL + DINE_IN` | `外部接入档案` Select；只读 Info：“外部系统不使用 POS、扫码或自助机点餐形式” | `dineInForm=null`，`providerCode` 为 DINE_IN provider | 例如门店自己的小程序；不建立本平台销售菜单 |
| `STORE + INTERNAL + TAKEAWAY/GROUP_BUY` | 无 `到店点餐形式`；内部无 provider | `dineInForm=null`，`providerCode=null` | 沿用既有语义 |
| `STORE + EXTERNAL + TAKEAWAY/GROUP_BUY` | 外部接入档案 Select | `dineInForm=null`，provider 按订单能力 | 沿用既有 provider 能力过滤 |
| `PROJECT + DINE_IN` | 外部接入选项不可用，并显示：“项目级到店点餐仅支持内部接入” | 外部组合不允许提交 | 服务器仍必须再次拒绝 |

字段变化遵循“上游清理下游”：

- `operatorKind` 从 `STORE` 变为 `PROJECT`：清空门店可见范围及门店列表；若当前是外部 `DINE_IN`，清空 provider，并将接入方式恢复为内部；
- `orderKind` 离开 `DINE_IN`：清空 `dineInForm`；
- `orderKind` 变为 `DINE_IN` 且接入类型为 `INTERNAL`：要求重新选择内部形式；若 `EXTERNAL`：保持外部，隐藏形式控件并触发 DINE_IN provider 读取；
- `accessKind` 从 `EXTERNAL` 变为 `INTERNAL`：清空 provider；若为 `DINE_IN`，显示且要求内部形式；
- `accessKind` 从 `INTERNAL` 变为 `EXTERNAL`：清空 `dineInForm`；若 `PROJECT + DINE_IN`，不允许进入可保存的外部状态；
- 任一下游 provider 查询尚未完成、失败或返回空集时，不允许保存外部模板。

### 1.3 外部 provider 选择

外部档案读取必须带明确能力：

```text
DINE_IN  -> capabilityClass=DINE_IN
TAKEAWAY -> capabilityClass=TAKEAWAY
GROUP_BUY -> capabilityClass=GROUP_BUY
```

不得在 `DINE_IN` 下省略 `capabilityClass`，不得将 TAKEAWAY 候选作为兜底。候选必须同时满足：当前 workspace 已启用、provider 的 `businessScope` 包含目标能力、provider 可绑定 `STORE`。未知 closed-set 值在 UI 上禁用并显示“当前接入档案信息不完整”，不允许保存。
provider 的业务范围 label 由 readback machine code 经 operations-admin 既有 `collaborationCodeLabels.ts` + `closedCodeLabel` 转换；本批只补 `DINE_IN`，不新增第二份 enum-label 字典或要求不存在的 displayNames。

状态分三类处理：

- 加载中：Select 保持 disabled，显示“正在读取可用的外部接入档案”；
- 空集：显示“当前没有可用的外部到店点餐接入档案”，保存按钮仍可见但提交时阻断，并提示“请选择可用的外部接入档案”；
- 读取失败：显示 Alert“外部接入档案读取失败，请重试”和真实 Retry 按钮；保留其它表单输入，不把失败伪装成空集。

### 1.4 O5 门店经营渠道页

O5 分成两个独立事实区：

- **门店可接入经营渠道模板**：读取项目维护且当前门店可见的 `STORE` 模板。有效外部 `DINE_IN` 模板可以出现在这里；表格保留模板名称、编码、接入类型、订单类型。
- **门店主体经营渠道**：读取该门店全部渠道（含外部 `DINE_IN`），允许进入渠道详情。该区域使用通用业务渠道读取语义，不再把 `SALES_MENU` 资格过滤结果当作全部渠道。

销售菜单页面仍使用 `usage=SALES_MENU` 的独立读取：只显示 `STORE + INTERNAL + DINE_IN/TAKEAWAY`，外部 `DINE_IN` 不出现在菜单候选、菜单创建或菜单详情资格结果中。页面之间不互相借用已过滤的集合。

### 1.5 O4 渠道详情

外部 `DINE_IN` 详情按“身份 → 承载 → 状态”展示：

1. 渠道名称/编码、来源模板；
2. 接入类型“外部接入”、经营主体“门店”、订单类型“到店点餐”；
3. 外部接入档案名称及绑定状态；
4. 到店点餐形式显示“外部系统不使用 POS、扫码或自助机点餐形式”；
5. 销售菜单显示“外部渠道不在本平台销售菜单范围内”；
6. 渠道状态、绑定状态和停用原因。

详情不得把空的 `dineInForm` 渲染成“未设置”，因为这会暗示用户漏选内部形式；必须使用上述业务说明。不得显示 provider 的 token、authorization reference、原始 payload 或机器 enum 作为用户文案。

## 2. 交互状态、错误和恢复

| 状态/问题 | 可见处理 | 恢复动作 |
| --- | --- | --- |
| `PROJECT + EXTERNAL + DINE_IN` | 外部接入选项置灰，旁边显示项目级限制说明 | 改为 STORE 或 INTERNAL；仍接受服务端 typed reject |
| `PROJECT_DINE_IN_EXTERNAL_NOT_ALLOWED` | 指向经营主体/接入方式：“项目级到店点餐仅支持内部接入” | 保留其它输入，调整经营主体或接入方式 |
| `DINE_IN_FORM_MISMATCH` | 指向到店点餐形式：“外部到店点餐不使用内部点餐形式”或“内部到店点餐请选择一种形式” | 清理不兼容字段后重新选择 |
| `BUSINESS_SCOPE_EXCEEDED` | 指向外部接入档案，说明该档案不支持当前订单类型 | 重新选择同能力 provider |
| `PROVIDER_NOT_ENABLED` / `CATALOG_NOT_FOUND` | 显示档案不可用，保留表单 | 重读候选；不能把其它能力当替代 |
| `VERSION_CONFLICT` | 关闭旧编辑态，读取最新模板，提示“模板已被更新，请重新确认后保存” | 用户重新确认，不自动覆盖 |
| provider 读取失败 | Alert + Retry；不清空已输入字段 | Retry 后重新选择 |
| 外部渠道无有效 binding | 详情显示“未完成接入”及绑定状态 | 进入既有 binding 授权路径；不提供手工“设为有效” |

## 3. 可访问性与 testId roster

所有新增或迁移的 testId 只在 `apps/frontend/operations-admin/src/app/automation/businessChannelTemplateTestIds.ts` 定义一次；组件只能从该常量源消费。动态 key 的参数是稳定业务身份 `providerCode`，不得使用行号、label、placeholder、CSS、XPath 或数组索引。testId 挂在真实动作节点；状态节点只用于状态断言，不作为动作替代。

| 控件键 | testId | 真实动作/状态节点 | `COMPOSITE_OPTION_ANCHOR` |
| --- | --- | --- | --- |
| `templateForm` | `business-channel-template-form` | Drawer 内真实 `Form` | `false` |
| `accessKind` | `business-channel-template-access-kind` | 真实 `Radio.Group` | `false` |
| `accessKindInternal` | `business-channel-template-access-kind-internal` | 真实 `Radio` 选项 | `false` |
| `accessKindExternal` | `business-channel-template-access-kind-external` | 真实 `Radio` 选项 | `false` |
| `operatorKind` | `business-channel-template-operator-kind` | 真实 `Select` | `false` |
| `orderKind` | `business-channel-template-order-kind` | 真实 `Select` | `false` |
| `orderKindDineIn` | `business-channel-template-order-kind-dine-in` | 真实 Select option | `false` |
| `orderKindTakeaway` | `business-channel-template-order-kind-takeaway` | 真实 Select option | `false` |
| `orderKindGroupBuy` | `business-channel-template-order-kind-group-buy` | 真实 Select option | `false` |
| `dineInForm` | `business-channel-template-dine-in-form` | 真实 `Select`，仅 INTERNAL+DINE_IN | `false` |
| `dineInFormPos` | `business-channel-template-dine-in-form-pos` | 真实 Select option | `false` |
| `dineInFormQr` | `business-channel-template-dine-in-form-qr` | 真实 Select option | `false` |
| `dineInFormKiosk` | `business-channel-template-dine-in-form-kiosk` | 真实 Select option | `false` |
| `provider` | `business-channel-template-provider` | 真实 provider `Select` | `false` |
| `providerOption(providerCode)` | `business-channel-template-provider-option-${providerCode}` | 与该 providerCode 对应的真实 Select option | `false` |
| `providerEmpty` | `business-channel-template-provider-empty` | 空候选状态节点 | `false` |
| `providerReadProblem` | `business-channel-template-provider-read-problem` | Alert 状态节点 | `false` |
| `providerRetry` | `business-channel-template-provider-retry` | Alert 内真实 Retry `Button` | `false` |
| `externalDineInInfo` | `business-channel-template-external-dine-in-info` | 真实只读 `Alert/Info` 节点 | `false` |
| `submit` | `business-channel-template-submit` | Drawer footer 真实保存 `Button` | `false` |
| `cancel` | `business-channel-template-cancel` | Drawer footer 真实取消 `Button` | `false` |
| `storeTemplateCandidateTable` | `business-channel-store-template-candidate-table` | O5 真实 table region | `false` |
| `storeBusinessChannelList` | `business-channel-store-list` | O5 真实 table region | `false` |
| `externalDineInDetail` | `business-channel-external-dine-in-detail` | O4 详情真实 content region | `false` |

`Radio`、`Select option` 和 `Button` 均有可直接绑定的动作节点，本表不使用复合控件例外。若实现所用 Ant Design API 确实不能把动态键绑定到 option 节点，必须在实现前暂停 L2 admission，提供 focused/static 证据和重新评审；不得退回到 wrapper、文本或宽 locator。

## 4. Foundation 与组件边界

必须复用 `libraries/frontend/admin-ui-foundation/` 的既有能力：

- `adminWideDrawerSurfaceProps`：Drawer 宽度、footer 与容器行为；
- `useDrawerFormLifecycle`、`useDirtyFormLock`、`useOverlayLock`：打开/关闭、脏表单和遮罩锁；
- `useAsyncGenerationGuard`：provider/模板读取切换时防止旧响应覆盖新状态；
- `useRefreshVersion`、`createRefreshSignal`：保存成功后的精确列表失效；
- `collectCursorPages`：provider 与门店模板候选内部收集，不把 cursor 暴露成用户分页；
- `testId`：统一 testId 绑定；
- `closedCodeLabel`：只读 closed-set 值的中文呈现。

App 仍拥有业务字段、中文文案、路由和 generated API 调用；不得在 app 内重复实现 Drawer 生命周期、overlay lock、cursor collector、HTTP protocol 或通用错误生命周期。

## 5. 视觉/交互验收边界

实现后最低可见验收不是“页面打开”：

1. `STORE + EXTERNAL + DINE_IN` 页面只出现 DINE_IN provider，内部点餐形式控件不存在；
2. `STORE + INTERNAL + DINE_IN` 页面出现且只能选择 POS/QR/KIOSK；
3. `PROJECT + DINE_IN` 不可选择外部接入，并且直接 HTTP 仍被拒绝；
4. O5 门店渠道表能看到外部 DINE_IN，销售菜单页看不到它；
5. provider 加载、空集、失败、重试和保存阻断均有可见结果；
6. long provider name/code 换行或截断不撑破 Drawer，footer 始终在视口内，内容区滚动；
7. 关闭/取消/版本冲突后焦点回到触发点或 Drawer 标题，键盘可达，状态不只靠颜色。

本节只定义实现后的验证目标，不构成当前 DEV/L2 授权。
