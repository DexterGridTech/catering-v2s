---
title: R3-C01 商业集团显式初始化交互设计
status: DEXTER_WIREFRAME_ACCEPTED
createdAt: 2026-07-25
programId: V2S_W0_W4_EXECUTION
decisionOwner: Dexter
implementationAuthority: false
---

# 交互工件：R3-C01 商业集团显式初始化

> 这是供 Dexter 看低保真线框的交互工件，不是页面实现、路由契约、接口契约或数据模型设计。
> 认证方式未裁决，因此线框从“系统服务提供者已获得 platform-admin 访问”开始；不凭空新增登录页。

## 1. 工件元数据

```text
JOURNEY_DECISION=doc/decisions/2026-07-25-v2s-r3-r6-journey-inventory-acceptance-and-c01-interaction-authorization.md#2. Dexter 接受与产品裁决
JOURNEY_CARD=doc/decisions/2026-07-25-v2s-r3-c01-commercial-group-initialization-journey-inventory.md#2. 用户任务与成功结果
UI_BEARING=true
SKILL_USED=cs-brainstorming@4a54a4858b99807f3155ed1614b2f116e35ea5c1b788e793f565dd837fd3891f
HERITAGE_BASELINE_POLICY=doc/decisions/2026-07-25-v2s-frontend-asset-carry-over-first.md
DEXTER_WIREFRAME_REVIEW=ACCEPTED; includes the appendix operations R3 static boundary screen
DEXTER_HIFI_REVIEW=NOT_REQUIRED
CONSUMER_FACE=platform-admin
```

## 2. Interaction map

| 顺序 | 前提 | route / 屏幕 | 用户目的 | 可见信息与可操作项 | server/owner readback | 成功去向 | 失败/退出恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 部署期已给系统服务提供者 platform-admin 身份与访问资格 | **认证边界（非 C-01 屏幕）** | 获得平台访问 | 本工件不设计 credential、登录表单、session 失败文案 | 非本 Journey；不能用前端推断 | 进入全局“集团空间管理” | 无访问资格时不开始 C-01；不得创建默认/测试账号 |
| 1 | 已有可访问的集团空间 | [集团空间管理](#screen-workspace-list) | 找到目标集团空间，先判断是否已初始化 | 名称、集团空间编码、商业集团状态；按名称/编码筛选；点击名称查看详情 | 集团空间事实及“未初始化/已初始化”状态由后续 owner 读模型判定 | 打开右侧详情 Drawer | 无结果显示空态；无合格空间不提供初始化替代入口 |
| 2 | 已选且未初始化的集团空间 | [集团空间详情：未初始化](#screen-workspace-detail-uninitialized) | 核对目标，发起唯一一次显式初始化 | 右侧 Drawer 内的只读空间名称/编码、未初始化状态、说明；“初始化商业集团” | 后续 owner 再次确认该空间尚未初始化 | 详情 Drawer 关闭后打开初始化 Drawer | 已初始化/无访问时不打开表单，改显示当前事实或拒绝 |
| 3 | 目标仍未初始化 | [初始化商业集团抽屉](#screen-commercial-group-initialize-drawer) | 独立录入商业集团名称与编码并提交 | 只读空间上下文；名称、编码；取消、初始化 | 后续 command 创建后必须 readback 唯一商业集团 | 抽屉关闭，返回详情成功态 | 校验/冲突保留安全草稿；未知结果先查询，不盲目重提 |
| 4 | owner readback 显示恰有一个商业集团 | [集团空间详情：已初始化](#screen-workspace-detail-initialized) | 确认真实结果及边界 | 独立录入的商业集团名称/编码；成功反馈；不产生任何下游对象的说明 | 详情读回唯一商业集团 | 本 Journey 结束 | 刷新失败展示失败态，不展示旧值为新结果 |
| 5 | 使用者到达 operations-admin 独立 app route | [R3 operations 边界页](#appendix-screen-operations-r3-boundary) | 明确本阶段没有运营业务或登录能力，避免将独立 app 误解为已可使用 | “本阶段未开放运营业务”及返回/离开入口；没有账号、登录、session 或业务菜单 | 无 business endpoint、无 current-session、无 owner 业务 readback | 留在边界页或离开 | 不渲染伪 dashboard、默认账号、登录表单或错误诊断 |

**认证边界。** C-01 的批准前提是“部署期外部受控身份与访问资格”，不是“已定义某种登录表单”。
凭证类型、登录 route、session 生命周期和失效交互均未获本 Journey 授权；它们需要独立的批准
Journey 或后续 implementation-facing design 才能物化。此边界不妨碍审看 C-01 的业务操作顺序，
但阻断任何声称“C-01 已闭环真实登录”的结论。

## 3. v2 对应页面盘点

以下来源均为 `PENDING_HERITAGE_REGISTRATION`：已按精确 path/hash 回读 all-v2 只读 source，
现在仅作为静态审看基线；未进入实现搬运、runtime/build fallback 或 v2s app。C-01 的对应关系
按“系统服务提供者管理既有集团空间并显式初始化商业集团”的用户任务判定，不按同名组件猜测。

| screen id | 对应关系 | all-v2 Heritage path@SHA-256 | 静态基线 / 摹本标注 | 差异及原因（新裁决/新范围/质量修复/未裁决不得继承） |
| --- | --- | --- | --- | --- |
| `workspace-list` | `EXACT_COUNTERPART` | `all-v2 apps/frontend/platform-admin/src/features/workspace-management/ui/WorkspaceManagementPage.tsx@0af9be8c884de227c28b875f4e41626f6a20d932b43e4ab6064289e7cbfe63dc` | [Screen: workspace-list](#screen-workspace-list)，摹自 v2 `ProTable` 列表/筛选/名称详情入口 | 保留既有列表骨架与“商业集团”列；C-01 不授权新建空间、启停、运营端入口，故在线框中只标为既有非 C-01 区域，不作为可操作项（新范围） |
| `workspace-detail-uninitialized` | `EXACT_COUNTERPART` | `all-v2 apps/frontend/platform-admin/src/features/workspace-management/ui/WorkspaceDetailDrawer.tsx@f573ca9c02e3fc80cd35ee5e6e9b43933fa7579d87a79ac3c2a09a683e24852a` | [Screen: workspace-detail-uninitialized](#screen-workspace-detail-uninitialized)，摹自 v2 右侧详情 Drawer | 保留抽屉、只读空间事实与“初始化商业集团”主操作；补空态合法、字段独立与禁推说明（新裁决 G-01）；编辑/启停不属于 C-01（新范围） |
| `commercial-group-initialize-drawer` | `EXACT_COUNTERPART` | `all-v2 apps/frontend/platform-admin/src/features/workspace-management/ui/CommercialGroupInitializationDrawer.tsx@3b40a5fdfe5cdcfa90bbc7f80944485acd9e47772893e77bf2d39ec32da85c6c` | [Screen: commercial-group-initialize-drawer](#screen-commercial-group-initialize-drawer)，摹自 v2 `DrawerForm` | 保留右侧短 Drawer、编码/名称独立输入、取消/初始化、提交禁用与失败保留草稿；增加只读目标空间和“商业集团”字段限定（新裁决 G-01）；不继承旧 endpoint、idempotency、反馈组件实现（未裁决不得继承） |
| `workspace-detail-initialized` | `EXACT_COUNTERPART` | `all-v2 apps/frontend/platform-admin/src/features/workspace-management/ui/WorkspaceDetailDrawer.tsx@f573ca9c02e3fc80cd35ee5e6e9b43933fa7579d87a79ac3c2a09a683e24852a` | [Screen: workspace-detail-initialized](#screen-workspace-detail-initialized)，摹自同一 v2 详情 Drawer 的已初始化字段区 | 保留 readback 后的详情载体和集团编码/名称展示；补“未创建下游对象”及不提供解绑/替换/重建（新裁决 G-01） |

## 4. 低保真线框

### Screen: workspace-list

```text
┌──────────────────────────── 摹自 all-v2 WorkspaceManagementPage ────────────────────────────┐
│ 集团空间管理                                             [+ 新建集团空间]〔既有 v2，非 C-01〕│
├────────────────────────────────────────────────────────────────────────────────────────────┤
│ 集团空间名称 [____________]  编码 [____________]  运营后台标题 [____________]  状态 [全部∨] │
│                                                        [查询] [重置]                         │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│ 集团空间名称（链接）│ 编码       │ Logo │ 运营后台标题 │ 运营后台地址 │ 商业集团 │ 状态 │更新时间│
│ ────────────────────────────────────────────────────────────────────────────────────────── │
│ 华东餐饮运营空间    │ east-food  │ —    │ 华东运营后台 │ 打开运营后台 │ 未初始化 │启用 │…     │
│ 华南餐饮运营空间    │ south-food │ —    │ 华南运营后台 │ 打开运营后台 │ 华南集团 │启用 │…     │
│                                                                                              │
│ 暂无集团空间 / 无匹配结果：不创建默认空间；不把空态解释成可初始化资格。                       │
│                                                      分页：< 1 2 … >                         │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

摹自 `all-v2 apps/frontend/platform-admin/src/features/workspace-management/ui/WorkspaceManagementPage.tsx`
`@0af9be8c884de227c28b875f4e41626f6a20d932b43e4ab6064289e7cbfe63dc`。列表不直接放“初始化”
按钮：初始化会建立不可由本范围替换/解绑的商业集团根，用户应先进入详情核对空间。名称是唯一
C-01 入口；“新建集团空间、运营后台地址、状态操作”保留为静态基线中的既有 v2 信息，但不在
C-01 中获操作授权（新范围）。

### Screen: workspace-detail-uninitialized

```text
                            ┌──────── 摹自 all-v2 WorkspaceDetailDrawer ────────┐
                            │ [×] 集团空间详情       [初始化商业集团]            │
                            │                          [编辑] [停用]〔非 C-01〕 │
                            ├───────────────────────────────────────────────────┤
                            │ 集团空间名称        华东餐饮运营空间               │
                            │ 集团空间编码        east-food                       │
                            │ 运营管理后台标题    华东运营后台                    │
                            │ Logo / 备注 / 状态  — / — / 已启用                  │
                            │                                                       │
                            │ 商业集团状态        尚未初始化                       │
                            │ 此空间可以为空。商业集团名称和编码将在下一步单独录入，│
                            │ 不借用、复制或回写本空间字段。                       │
                            │                                                       │
                            │ 版本 / 创建时间 / 更新时间                            │
                            └───────────────────────────────────────────────────┘
```

摹自 `all-v2 apps/frontend/platform-admin/src/features/workspace-management/ui/WorkspaceDetailDrawer.tsx`
`@f573ca9c02e3fc80cd35ee5e6e9b43933fa7579d87a79ac3c2a09a683e24852a`。与 v2 基线相比，空态
说明和字段独立性来自 G-01（新裁决）；编辑/启停是原页面已有行为但非 C-01 范围，不能因同屏存在
而被本 Journey 设计或实现化。

### Screen: commercial-group-initialize-drawer

```text
                            ┌────── 摹自 all-v2 CommercialGroupInitializationDrawer ──────┐
                            │ 初始化商业集团                                                │
                            ├──────────────────────────────────────────────────────────────┤
                            │ 目标集团空间（只读） 华东餐饮运营空间 · east-food              │
                            │                                                              │
                            │ 商业集团编码  [请输入商业集团编码 _________________________] │
                            │ 商业集团名称  [请输入商业集团名称 _________________________] │
                            │                                                              │
                            │ 名称与编码为商业集团自身信息；不会沿用集团空间字段。         │
                            │                                                              │
                            ├──────────────────────────────────────────────────────────────┤
                            │                                    [取消] [初始化]          │
                            └──────────────────────────────────────────────────────────────┘
```

摹自 `all-v2 apps/frontend/platform-admin/src/features/workspace-management/ui/CommercialGroupInitializationDrawer.tsx`
`@3b40a5fdfe5cdcfa90bbc7f80944485acd9e47772893e77bf2d39ec32da85c6c`。v2 基线已有编码/名称
独立输入、取消/提交、提交禁用与失败保留草稿；本线框仅补目标空间只读上下文和“商业集团”字段
限定（新裁决 G-01）。不继承旧 endpoint、idempotency、反馈组件或实现细节（未裁决不得继承）。
不增加第二个泛化确认弹窗：详情核对和两项独立输入已提供全部决策信息；再加一次无新信息确认
只增加摩擦。提交期间全表单禁用、按钮 loading，抽屉不能关闭。

### Screen: workspace-detail-initialized

```text
                            ┌──────── 摹自 all-v2 WorkspaceDetailDrawer ────────┐
                            │ [×] 集团空间详情                                    │
                            ├───────────────────────────────────────────────────┤
                            │ 集团空间名称        华东餐饮运营空间               │
                            │ 集团空间编码        east-food                       │
                            │ 运营管理后台标题    华东运营后台                    │
                            │ Logo / 备注 / 状态  — / — / 已启用                  │
                            │                                                       │
                            │ 商业集团状态        已初始化                         │
                            │ 商业集团编码        east-fnb-group                   │
                            │ 商业集团名称        华东餐饮商业集团                 │
                            │                                                       │
                            │ 已建立本空间唯一的商业集团；未创建组织树、账号、角色、│
                            │ 任职或门店。                                          │
                            └───────────────────────────────────────────────────┘
```

摹自 `all-v2 apps/frontend/platform-admin/src/features/workspace-management/ui/WorkspaceDetailDrawer.tsx`
`@f573ca9c02e3fc80cd35ee5e6e9b43933fa7579d87a79ac3c2a09a683e24852a`。v2 基线已显示集团编码/名称；
本线框增加 readback 的业务结果与禁推说明（新裁决 G-01）。初始化成功后以 owner readback 填充
该 Drawer 的已初始化字段，而非只以一个泛化 toast 宣称成功（质量修复）。解绑、替换、重建均为
待裁决，不以“编辑商业集团”按钮暗示其存在。

### Appendix Screen: operations-r3-boundary

```text
┌──────────────────────────── operations-admin ────────────────────────────┐
│                                                                            │
│                         运营管理后台                                      │
│                                                                            │
│                    本阶段未开放运营业务                                  │
│                                                                            │
│  当前仅验证 platform-admin 与 operations-admin 是两个独立应用。            │
│  本页不提供运营用户登录、账号、当前会话、业务菜单或业务数据。              │
│                                                                            │
│                            [返回入口]                                    │
└────────────────────────────────────────────────────────────────────────────┘
```

这是一张用户可见的纯静态边界页，不是新增业务 Journey，也不是登录页。它的唯一任务是让到达
operations-admin route 的人知道“独立 app”不等于“运营业务已开放”，从而避免空白页、伪 dashboard
或登录控件制造错误预期。它不请求 business endpoint，不产生 session，也不显示内部错误或“诊断”。
本页不对应 all-v2 业务页面：R3-C02 已明确删除运营用户真实登录，故按 carry-over-first 的“无对应页
才新画”规则新画；Dexter 于 2026-07-25 接受本附录线框。

## 5. 状态与边界表

| 屏幕/动作 | initial/loading | validation | submitting | success | conflict/denied | timeout/unknown | owner/face 边界 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 集团空间列表 | 初次加载仅显示 loading；查询只更新当前结果 | 名称/编码筛选不构成授权判断 | 不适用 | 显示 owner 返回的当前状态 | 无访问时拒绝；无结果为空态 | 列表失败显示加载失败，可重试 | 仅 platform-admin；后续 owner 决定哪些空间可见 |
| 未初始化详情 | 先读取空间与初始化事实 | 不适用 | 不适用 | 显示“尚未初始化”才出现主按钮 | 已初始化时改为已初始化详情；无访问拒绝 | 读取不确定时显示失败，不用缓存冒充最新状态 | 前端不能凭列表旧状态放行 |
| 初始化抽屉 | 打开时上下文只读，不计 dirty | 两字段为空或后端返回字段问题时就地提示；格式规则尚未裁决，不伪造 | 表单禁用、单次提交、不可关闭 | command 后先 owner readback；抽屉完全关闭后反馈成功 | `COMMERCIAL_GROUP_ALREADY_INITIALIZED`：保留草稿并提示当前事实已变化，提供“查看当前商业集团”；拒绝时保留安全草稿 | 不知道是否成功时，先查询详情；若已初始化则不重提，若仍未初始化才由用户重新提交 | command/readback 的 owner、幂等与错误 contract 仍待 implementation-facing design；UI 不自行裁决 |
| 已初始化详情 | 读取结果 | 不适用 | 不适用 | 显示唯一商业集团且结束 Journey | 无访问拒绝 | 查询失败不把旧详情称为本次成功 | 不能由前端推导唯一性，也不得提供解绑/替换 |
| R3 operations 边界页 | 静态说明，不请求 business data | 不适用 | 不适用 | 不适用 | 不适用 | 不适用 | 独立 app route；无登录、session、业务 endpoint 或 owner readback |

## 6. 逐操作任务合理性

| 操作 | 批准 Journey 来源 | 用户为何此时操作 | 是否有更短路径 | 不选替代的理由 | 约束归因（产品/owner/contract/旧文档） | Dexter 裁决是否必要 |
| --- | --- | --- | --- | --- | --- |
| 按名称/编码筛选空间 | C-01 卡片 §2、§3 | 受控平台人员可能面对多个已有空间，先定位目标 | 直接 URL 输入编码 | `groupWorkspaceKey` 的 URL 语义属于 operations，不是平台授权或本页入口；显示名亦不得反查授权 | G-01、G-10；后续 owner 决定可见空间 | 否 |
| 点击名称看详情 | C-01 卡片 §4 | 在创建不可替换/解绑的根前核对空间事实 | 在列表行直接初始化 | 多一步读取能降低选错空间，且不会增加虚构确认环节 | G-01 的解绑/替换未定义；Heritage 仅作交互参考 | 否 |
| 从详情打开初始化抽屉 | C-01 卡片 §2 | 仅对当前明确、尚未初始化的空间执行一次初始化 | 全页直接编辑 | 初始化是单一短表单；抽屉保留上下文、避免离开详情，也符合遗产 form 生命周期参考 | C-01 已授权；具体组件/route 未授权 | 否 |
| 独立录入名称与编码 | C-01 卡片 §2、G-01 | 商业集团有自己的名称和编码 | 自动带入或复制空间字段 | 自动带入会把两个实体偷换为同一事实，违反明确禁推 | Dexter 已裁决 G-01 | 否 |
| 提交后 owner readback | C-01 卡片 §2 | 用户需要确认“恰有一个”及其实际名称/编码 | 前端乐观成功 toast | 并发/超时下前端无法证明唯一结果；readback 才可关闭表单 | owner/contract 细节待后续设计；读回要求已裁决 | 否 |
| 冲突后查看当前商业集团 | C-01 卡片 §2、§4 | 另一个操作已完成时，用户应回到真实现状 | 自动再次提交、继续编辑或提示失败后无出口 | 自动重提可能创造重复意图；无出口让用户无法核实结果 | `COMMERCIAL_GROUP_ALREADY_INITIALIZED` 已裁决；导航细节属本交互设计 | 否 |

## 7. Face / owner 对齐矩阵

| 屏幕/动作 | consumer face | 页面准入 | server operation | owner readback / command | 不可由前端替代的判定 |
| --- | --- | --- | --- | --- | --- |
| 列表、详情 | `platform-admin` | 部署期外部受控系统服务提供者；精确 session/route 未设计 | 读取可访问集团空间与初始化状态 | **TBD：implementation-facing design 指定 owner/read model** | 身份、访问资格、空间可见性、是否初始化 |
| 初始化入口展示 | `platform-admin` | 同上 | 读取目标空间是否尚未初始化 | **TBD：owner factual read** | “尚未初始化”不能从客户端缓存或 URL 推断 |
| 初始化提交 | `platform-admin` | 同上 | 显式初始化商业集团 | **TBD：owner command；成功后 owner readback** | 每空间至多一个、并发冲突、独立字段写入、审计/幂等 |
| 成功/冲突后的详情 | `platform-admin` | 同上 | 读取唯一商业集团或当前状态 | **TBD：owner factual read** | 是否成功、是否已有集团、是否可以继续操作 |

`operations-admin` 没有任何 C-01 页面、session 或角色入口；双 app 独立性不等于 C-01 需要
设计 operations 交互，也不等于运营用户已能登录。

## 8. Manifest B.4/B.5 命中对照

这是人工出处对照，不是语义 checker。以下 Heritage 只提供成熟管理后台的交互约束参考；
逐屏静态基线和未来搬运纪律另见 §3 与
`doc/decisions/2026-07-25-v2s-frontend-asset-carry-over-first.md`。两者都不导入 Heritage runtime、
owner 或 all-v2 产品真相。

| manifest 条文 | 本 Journey 的命中或不适用理由 | 遵循方式 / 待 Dexter 裁决 | Heritage 原文（冻结路径@hash） |
| --- | --- | --- | --- |
| B.4.N01–N04 | 命中 platform-admin app-owned chrome、page registry 与页面准入边界 | 只声明 `platform-admin` face；实际 registry/route/session 留 implementation-facing design，绝不复用 operations runtime | `doc/heritage/frozen/catering-all-v2/project-memory/decisions/admin-consumer-chrome-rules.md@98bb944a029e41caa84b95517bf021c0e4809e1725c5ad532e84e685131ddd1f`; `doc/heritage/frozen/catering-all-v2/project-memory/decisions/admin-page-catalog-navigation-and-access-owner-boundary.md@2604180320cbdc473e80da5b056867e05c1a8e720658df0dc1ca39b5d1ca983b` |
| B.4.N15 | 命中两 app 独立性 | 仅 platform-admin 承载本 Journey；operations 不被画成登录闭环 | `doc/heritage/frozen/catering-all-v2/project-memory/decisions/admin-consumer-chrome-rules.md@98bb944a029e41caa84b95517bf021c0e4809e1725c5ad532e84e685131ddd1f` |
| B.5.N01–N03 | 命中全局列表→详情→单一初始化任务的导航与信息层级 | 默认全局“集团空间管理”；详情/抽屉打开时不操作 shell；具体 tabs/route 待后续设计 | `doc/heritage/frozen/catering-all-v2/project-memory/decisions/platform-admin-menu-tabs-and-workspace-context.md@fc5585aa0ce198614b0f5223edf88dd458eeef91796d6b3fc3732dec6d9d12af`; `doc/heritage/frozen/catering-all-v2/project-memory/decisions/admin-page-catalog-navigation-and-access-owner-boundary.md@2604180320cbdc473e80da5b056867e05c1a8e720658df0dc1ca39b5d1ca983b` |
| B.5.N08 | 命中短 mutation form 的反馈与恢复 | 提交后 readback、成功关闭后反馈；失败保留安全草稿；超时先查询 | `doc/heritage/frozen/catering-all-v2/project-memory/decisions/admin-drawer-form-lifecycle-and-feedback-standard.md@0154be1d75078d6996d3a6edbaf3c1f6457a96e0760875296762dfea06bf435f` |
| B.5.N10 | 命中用户可理解的任务与状态语言 | 使用“集团空间 / 商业集团 / 尚未初始化”，不用 technical owner/tenant/root 作为页面词 | `doc/heritage/frozen/catering-all-v2/project-memory/decisions/business-user-facing-language-standard.md@087b537d57c1839315f886bc9e3bb294ed10ed719b53b590e39cadfa9374b6bb`; corpus G-01/G-03 |

## 9. 可选：高保真静态 demo

`NOT_USED`。这是常规列表、详情和短表单；低保真线框已足够审看任务顺序、独立字段和状态边界。
没有创建 mockup，也没有 app 对静态 demo 的引用。

## 10. Dexter 看图结论

- 看图日期：`2026-07-25`
- 低保真线框结论：`ACCEPTED`（含 `operations-r3-boundary` 静态边界页附录）
- 高保真 demo 结论：`NOT_REQUIRED`
- 修改意见/已接受的操作顺序：`Dexter 接受 carry-over-first 回补后的四张 C-01 线框及 operations R3 静态边界页附录；列表 → 详情 Drawer → 初始化 Drawer → owner readback 详情的顺序保持。`
- 允许进入 implementation-facing design：`是；仅 C-01 详设，仍不授权实现、代码搬运、contract/DB/app/DEV/runtime/seed/reset/Git。`
