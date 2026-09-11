---
title: v2s 到店点餐允许外部接入 Journey amendment
status: PROPOSED_FOR_DESIGN_REVIEW
createdAt: 2026-09-10
decisionOwner: Dexter
programId: V2S_W0_W4_EXECUTION
journeyRef: doc/decisions/2026-08-19-v2s-business-channel-management-journey.md
reviewTarget: DESIGN
reviewCycleId: BC-20260910-DINE-IN-EXTERNAL-IMPLEMENTATION-DESIGN
implementationAuthority: false
---

# 到店点餐允许外部接入 · Journey amendment

## 0. 文档地位与授权边界

本文件是既有 `BUSINESS_CHANNEL_MANAGEMENT` Journey 的增量 amendment，不创建新的 Journey、页面、权限面或业务 owner。它只收口 `DINE_IN` 与 `accessKind` 的规则变化，以及该变化对已有项目/门店渠道管理和销售菜单边界的影响。

本文件的当前授权是：

```text
DESIGN_AUTHORITY=true
IMPLEMENTATION_FACING_DESIGN_AUTHORITY=true
IMPLEMENTATION_AUTHORITY=false
CONTRACT/MIGRATION/TEST/SEED/RESET/DEV/L2/UAT_AUTHORITY=false
```

当前设计 authority 以 Dexter 在会话中给出的三项裁决为准；Roadmap 授权字段不替代本次直接授权边界。上游需求变更分析中的“默认同时适用于 PROJECT 与 STORE”只保留为历史分析输入，已被本文件的 D-02 裁决收窄。

## 1. 真实业务目标

项目运营者需要为门店建立一条由门店自有小程序等外部系统承载的到店消费经营渠道。例如，瑞幸门店自己的小程序相对于购物中心平台就是外部系统；顾客可以在该小程序完成到店点单，但该外部系统不使用平台内部的 POS、扫码或自助机点餐形式。

平台必须能够：

1. 在 `STORE` 经营主体下创建、读取和维护 `EXTERNAL + DINE_IN` 模板及渠道；
2. 让外部 provider 通过已有 collaboration/provider/binding 闭包表达 `DINE_IN` 能力；
3. 保持销售菜单 owner 的业务含义不变：只有门店内部的到店点餐和外卖渠道可以配置本平台销售菜单；
4. 让外部到店渠道出现在门店经营渠道管理事实中，但不进入销售菜单候选、菜单创建或菜单直接资格复核；
5. 不改写已经存在的模板、渠道、绑定或销售菜单事实。

“外部系统不需要建立菜单，只有内部系统才要”在本 Journey 中的精确定义是：本平台 `sales-menu` owner 不为外部渠道建立或维护销售菜单；外部系统自身的菜单、商品和订单数据不在本批建模，也不由本平台菜单页面承载。

## 2. Dexter 已作出的产品裁决

### D-01：外部系统与点餐形式

门店自己的小程序相对于购物中心是外部系统；外部系统可以承载门店到店消费。外部 `DINE_IN` 与其他外部订单类型一样，不使用平台内部的 `POS`、`QR`、`KIOSK` 点餐形式，因此 `dineInForm` 必须为 `null`，表单不得展示可选择的内部点餐形式。

该裁决不允许以下替代解释：

- 不得把外部系统映射为 `INTERNAL`；
- 不得把 `TAKEAWAY` 当作外部 `DINE_IN` 的别名；
- 不得为外部 `DINE_IN` 伪造 POS、QR 或 KIOSK provider capability；
- 不得因为平台不维护外部菜单，就拒绝建立外部经营渠道本身。

### D-02：适用经营主体

本次放开只适用于 `STORE` 模板和 `STORE` 渠道。`PROJECT + EXTERNAL + DINE_IN` 仍然拒绝；`PROJECT + INTERNAL + DINE_IN` 继续要求 `POS/QR/KIOSK`，但项目主体渠道本身仍不属于销售菜单候选。

### D-04：完整可用闭包与菜单边界

本批形成完整可用的模型、契约、provider capability、owner policy、binding、UI、seed 与 acceptance 闭包。外部系统不建立本平台销售菜单；销售菜单逻辑只继续服务 `STORE + INTERNAL + (DINE_IN|TAKEAWAY)`。

完整闭包的 provider 前提是：checked-in collaboration catalog 必须存在一个“门店自有点单小程序” provider profile，其 system capability 与 provider `businessScope` 都包含 `DINE_IN`，且 provider 明确可绑定 `STORE`。本批固定使用以下平台 provider profile 形态：`externalSystemCode=STORE_OWNED_MINI_PROGRAM`、`providerCode=STORE_OWNED_MINI_PROGRAM_DINE_IN`、`authenticationKind=EXTERNAL_GRANT`、`unbindKind=LOCAL_ONLY`、`catalogStatus=PLANNED`；workspace 通过既有 owner command 将该 provider enablement 设为 `ENABLED`。这些值沿用当前已存在的 external-grant/local-only 闭集语义，不新增认证或解绑状态；`PLANNED` 仍按现行约定只是目录信息，不阻断候选，外部授权/绑定状态沿用既有 pending/callback 语义。本批不实现外部系统网络适配器、外部菜单同步或外部撤销调用；“完整可用闭包”指本平台可以完整配置、保存、创建和回读该 STORE 外部 DINE_IN 渠道，不声称瑞幸等具体第三方已有 adapter。没有满足该 descriptor 的 provider 时，候选必须为空并 fail closed，不能借用其他能力。

## 3. 规则矩阵

| 经营主体 | 接入类型 | 订单类型 | `dineInForm` | provider | 本平台渠道 | 销售菜单 |
| --- | --- | --- | --- | --- | --- | --- |
| `STORE` | `INTERNAL` | `DINE_IN` | 必须是 `POS/QR/KIOSK` | 必须为空 | 允许，创建后按既有内部渠道语义生效 | 允许 |
| `STORE` | `EXTERNAL` | `DINE_IN` | 必须为空；不显示内部形式 | 必须是启用且 `businessScope` 含 `DINE_IN` 的真实 provider | 允许；绑定语义沿用外部渠道 | 禁止，不进入菜单候选 |
| `STORE` | `INTERNAL` | `TAKEAWAY` | 必须为空 | 必须为空 | 允许 | 允许 |
| `STORE` | `EXTERNAL` | `TAKEAWAY` | 必须为空 | 必须是启用且 `businessScope` 含 `TAKEAWAY` 的 provider | 允许 | 禁止 |
| `STORE` | `EXTERNAL` | `GROUP_BUY` | 必须为空 | 必须是启用且 `businessScope` 含 `GROUP_BUY` 的 provider | 允许 | 禁止 |
| `PROJECT` | `INTERNAL` | `DINE_IN` | 必须是 `POS/QR/KIOSK` | 必须为空 | 允许，按既有项目渠道语义 | 禁止 |
| `PROJECT` | `EXTERNAL` | `DINE_IN` | 必须为空，但组合整体拒绝 | 不进入 provider 选择 | 拒绝，返回项目主体专用 typed problem | 禁止 |
| `PROJECT` | 其他既有组合 | 既有组合 | 沿用原规则 | 沿用原规则 | 行为不变 | 行为不变 |

`DINE_IN` 的“必须有形式”仅适用于内部接入。外部 `DINE_IN` 的业务身份由 `providerCode + provider.businessScope=DINE_IN` 表达，不能用 `dineInForm` 填充。

## 4. Journey 影响面

### O2：渠道模板新建/编辑

- 创建 `STORE + EXTERNAL + DINE_IN` 时，接入类型可选外部接入；外部 provider 候选按 `DINE_IN` 能力读取。
- 外部 `DINE_IN` 不出现“到店点餐形式”选择控件；显示一条解释性只读信息：“外部系统不使用 POS、扫码或自助机点餐形式”。
- 创建 `STORE + INTERNAL + DINE_IN` 仍出现必填的 POS/扫码/自助机选择。
- 当经营主体为 `PROJECT` 且订单类型为 `DINE_IN` 时，外部接入不可选；服务端仍必须返回 typed reject，不能只依赖前端置灰。
- 上游字段变化必须清理不再适用的 `providerCode` 或 `dineInForm`，不得保留 stale value。

### O3/O4：项目渠道列表与详情

- 项目级外部 `DINE_IN` 创建被拒；已有项目渠道读取、详情和绑定语义不因本批改写。
- 详情对外部 `DINE_IN` 显示外部接入、到店点餐、外部 provider 及“无内部点餐形式”的业务说明，不显示 `POS/QR/KIOSK` 值。

### O5：门店渠道管理

- 门店模板候选继续由门店可见范围、模板状态、`operatorKind=STORE` 和当前 owner policy 决定；有效的外部 `DINE_IN` 模板可以进入候选。
- 门店主体经营渠道读取必须是通用渠道事实读取，包含外部 `DINE_IN`；不得继续复用只服务销售菜单的 `usage=SALES_MENU` 查询。
- 同一 endpoint 的 `SALES_MENU` usage 仍专门返回内部门店到店点餐/外卖候选；门店经营渠道页与销售菜单页不得共享“资格已过滤”的结果作为全部渠道事实。

### 销售菜单边界

- `listSalesMenuEligibleChannels` 和 `requireSalesMenuChannel` 的 `STORE + INTERNAL + DINE_IN/TAKEAWAY` 谓词不放宽。
- 不新增外部菜单 API、菜单 owner 表、菜单 provider binding 或外部菜单同步。
- 外部 `DINE_IN` 可以在业务渠道详情中被看见，但在销售菜单候选、直接创建、菜单详情的 channel 资格复核中均被拒绝。

## 5. 不变量与历史事实

1. policy、数据库 CHECK、edge 和 owner create/update/readback 必须一致表达上述矩阵。
2. `PROJECT + EXTERNAL + DINE_IN` 的拒绝使用新的窄义 typed problem `PROJECT_DINE_IN_EXTERNAL_NOT_ALLOWED`；退役旧的全局语义 `DINE_IN_MUST_BE_INTERNAL`，不能继续以错误含义暴露。
3. `DINE_IN_FORM_MISMATCH` 继续拒绝外部 `DINE_IN` 携带 POS/QR/KIOSK、内部 `DINE_IN` 缺形式以及非 `DINE_IN` 携带形式。
4. 外部 provider 候选、模板保存、渠道创建和 binding 创建/回读都必须用 `DINE_IN` 精确能力；能力不在 catalog 或 provider 未启用时 fail closed。
5. 现有内部 `DINE_IN`、内部 `TAKEAWAY`、外部 `TAKEAWAY`、外部 `GROUP_BUY` 事实保持有效；既有外部渠道不因为菜单资格变化而被停用、删除或迁移。
6. 新增通用门店渠道读取只改变展示范围，不改变任何渠道状态或菜单事实；`SALES_MENU` 查询语义保持原样。

## 6. 需动态证明的业务事实

以下事实不是本文件的静态设计结论，实施后必须由真实 HTTP/数据库/浏览器证据证明：

- 外部 `DINE_IN` provider 能在候选、模板保存、渠道创建和绑定路径闭合；
- `dineInForm=null` 在保存、回读、编辑和数据库层保持为空；外部提交 POS/QR/KIOSK 被 typed reject；
- PROJECT 外部到店点餐从候选/保存/直接 HTTP 创建三条路径 fail closed；
- 门店通用渠道列表包含外部 `DINE_IN`，而销售菜单列表和菜单直调仍排除它；
- 版本冲突或 provider 失效不产生部分写入；
- 既有内部菜单渠道和现有外部渠道均保持原状态。

当前阶段不执行上述动态验证；`IMPLEMENTATION_AUTHORITY=false` 仍然有效。

## 7. 设计交付关系

本 amendment 由以下 implementation-facing 设计配套解释：

- UI interaction：`doc/decisions/2026-09-10-v2s-business-channel-dine-in-external-access-ui-interaction-design-codex.md`
- IA：`doc/decisions/2026-09-10-v2s-business-channel-dine-in-external-access-ia-amendment-codex.md`
- implementation design：`doc/plans/platform/2026-09-10-v2s-business-channel-dine-in-external-access-implementation-design-codex.md`
- implementation plan：`doc/plans/platform/2026-09-10-v2s-business-channel-dine-in-external-access-implementation-plan-codex.md`

四份文件必须逐字保持 `dineInForm`、provider 能力、PROJECT 限制、门店通用渠道读取和销售菜单边界一致；任何不一致都是设计 finding，不留给实施期自行解释。
