---
title: v2s 外部协作与经营渠道 UI 交互设计
status: ACCEPTED_TEXTUAL_DESCRIPTION
createdAt: 2026-08-19
governanceRef: doc/decisions/2026-07-25-v2s-design-governance-batch-1.md
implementationAuthority: true
---

# 交互工件：外部协作与经营渠道

```text
JOURNEY_DECISION_PLATFORM=doc/decisions/2026-08-19-v2s-external-collaboration-platform-configuration-journey.md#journey-裁决外部协作配置
JOURNEY_DECISION_OPERATIONS=doc/decisions/2026-08-19-v2s-business-channel-management-journey.md#journey-裁决经营渠道管理
BUSINESS_REQUIREMENT_SOURCE=doc/review/platform/2026-08-18-v2s-external-collaboration-and-business-channel-spec-claude.md
BUSINESS_USER_OR_OWNER=运维管理员；商场运营方；店铺运营方；collaboration owner；business-channel owner
UI_BEARING=true
SKILL_USED=NONE
DEXTER_WIREFRAME_REVIEW=ACCEPTED_TEXTUAL_DESCRIPTION
DEXTER_HIFI_REVIEW=NOT_REQUIRED
CONSUMER_FACES=platform-admin + operations-admin
IMPLEMENTATION_AUTHORITY=true
```

本工件只定义 user task、信息层级、状态和 owner readback。它不把页面可见性当授权，也不把 C-01/C-02/C-04/C-08/C-09 当成已定契约；C-03 已按规格收口为集团空间内唯一编码。所有技术字段均为实现边界，不作为用户文案。

## 1.1 两个页面与交互地图

| 顺序 | 前提                       | route / screen                                        | 用户目的                     | 可见信息与可操作项                               | server/owner readback                       | 成功去向           | 失败/退出恢复                          |
| ---- | -------------------------- | ----------------------------------------------------- | ---------------------------- | ------------------------------------------------ | ------------------------------------------- | ------------------ | -------------------------------------- |
| 1    | 已选集团空间               | `platform-admin` / `external-collaboration` / P1      | 识别外部系统和接入档案       | 树、名称、启用状态、展开/选择                    | collaboration bounded tree                  | 打开 P2/P3         | 保持树选中态，显示 typed problem       |
| 2    | 选中外部系统               | P2 系统详情                                           | 查看能力与启停               | 名称、编码、目录标记、能力属性、启停             | external_system contract + enablement state | 继续管理系统状态   | 状态失败不改变旧 readback              |
| 3    | 选中接入档案               | P3 档案详情                                           | 查看业务范围、认证方式和绑定 | 详情 Tab、绑定关系 Tab                           | provider_profile + enablement state         | P4 或 P6           | 保持 Tab 与查询身份                    |
| 4    | 选中绑定 Tab               | P4 绑定列表                                           | 搜索/分页绑定                | 业务名称、节点名称、业务范围、外部主体编号、状态 | collaboration Page                          | 打开 P5/P6         | 查询错误不覆盖上一份当前结果           |
| 5    | 选中绑定首列               | P5 绑定详情                                           | 核对绑定事实和授权状态       | 详情抽屉、只读状态、删除/解绑入口（按认证方式）  | owner detail                                | 关闭或进入 P6      | overlay lock，关闭后恢复 P4            |
| 6    | 有权且认证允许             | P6 绑定表单                                           | 建立或修改主体映射           | 节点类型、节点、外部主体编号（按认证类型显示）   | owner command + readback                    | 回到 P4 并精确刷新 | 保留用户输入；typed problem 映射到字段 |
| 7    | 已进入项目上下文           | `operations-admin` / `project-business-channels` / O1 | 管理项目模板和项目渠道       | 上模板下渠道、状态、编码、绑定状态               | business-channel Page/Detail                | 打开 O2/O3/O4      | 当前列表保持，失败不重置上下文         |
| 8    | 项目主体或门店主体条件已选 | O2 模板表单                                           | 定义四维模板                 | 接入类型、经营主体、订单类型、到店形式、外部档案 | owner validation + candidate bounded        | 回到模板列表       | 清理下游值并保留上游选择               |
| 9    | 选中项目/门店渠道          | O3/O5 列表                                            | 建立任意多条渠道实例         | 渠道编码、名称、模板、状态、绑定状态             | business-channel Page                       | 打开 O4/绑定表单   | 查询/命令失败保持列表                  |
| 10   | 选中渠道首列               | O4 详情                                               | 核对四维、绑定和状态         | 详情抽屉、编辑/停用/绑定动作（按 owner scope）   | owner detail                                | 关闭或进入表单     | 关闭抽屉不丢列表 query identity        |

## 1.2 逐 screen 九维度

### Screen P1：外部系统接入配置树

```text
CONSUMER_FACE=platform-admin
UI_SURFACE=独立页面
HOST_AND_ENTRY=已认证 platform-admin 的集团空间工作区；路由 /platform/external-collaboration；集团空间由 WorkspaceScope 会话上下文提供；从运维侧边栏进入
ACTOR=运维管理员
BUSINESS_SCENARIO=已切换到指定集团空间，需要查看该空间的外部系统与接入档案
BUSINESS_GOAL=快速定位系统或接入档案，并查看其空间启用状态
USER_VISIBLE_COPY=外部系统接入配置；外部系统；接入档案；已启用；已停用；暂无外部系统
TECHNICAL_BOUNDARY=groupWorkspaceKey、externalSystemCode、providerCode、contract catalog 与 enablement state 不作为用户可见技术名
FOUNDATION_PRIMITIVE=WorkspaceScope, contextScopedQueryArgs, adminListState, useOverlayLock, testId, formatNameCode, NameCodeText
LAYOUT_GEOMETRY=platform-master-detail-page 内使用与组织概览一致的 platform-master-detail-layout；左侧 Card 承载“外部系统”标题、搜索与树，右侧详情承载区承载空态或系统/档案详情 Card；集团空间保持 WorkspaceScope 会话上下文，不重复放入页面内容。
```

```text
┌ 外部系统 ─────────────────┐  ┌ 外部系统详情 ─────────────────────┐
│ [搜索外部系统或接入档案]   │  │ 请选择一个外部系统或接入档案      │
│ 美团(MEITUAN)   已启用     │  │                                  │
│  ├ 外卖档案      已启用     │  │                                  │
│  └ 团购档案      已停用     │  │                                  │
│ 饿了么(ELEME)   已停用     │  │                                  │
└───────────────────────────┘  └──────────────────────────────────┘
```

### Screen P2：外部系统详情

```text
CONSUMER_FACE=platform-admin
UI_SURFACE=内容页右侧详情面板
HOST_AND_ENTRY=P1 选择外部系统；系统详情面板内提供启停控件
ACTOR=运维管理员
BUSINESS_SCENARIO=核对一个外部系统的契约能力和该空间是否开放
BUSINESS_GOAL=理解能力属性后控制空间启用，不把目录标记误当启用门槛
USER_VISIBLE_COPY=外部系统详情；系统名称；系统编码；适配器状态；能力分类；业务说明；当前空间状态；启用；停用；适配器尚未部署（仅信息标记）
TECHNICAL_BOUNDARY=contract descriptor、catalogStatus、enablement state、owner version
FOUNDATION_PRIMITIVE=Ant Design Table, adminWideDrawerSurfaceProps, useOverlayLock, testId, NameCodeText
```

```text
┌ 外部系统详情 ─────────────────────────────┐
│ 系统名称  美团                              │
│ 系统编码  MEITUAN                           │
│ 适配器状态 适配器尚未部署（信息标记）         │
│ 能力分类  外卖 / 团购 / 订单同步              │
│ 能力属性  ┌────────┬────────┬──────────────┐   │
│          │ 属性   │ 当前值 │ 说明         │   │
│          │ 团购商品映射方向 │ 外部映射到内部 │ 团购商品由外部映射到内部，还是由内部映射到外部 │
│          │ 菜单协作方向 │ — │ 只拉取外部菜单，还是支持将本地菜单推送到外部平台 │
│          └────────┴────────┴──────────────┘   │
│ 当前空间状态  [启用]                         │
│ [保存状态]                                  │
└────────────────────────────────────────────┘
```

### Screen P3：接入档案详情与绑定 Tab

```text
CONSUMER_FACE=platform-admin
UI_SURFACE=内容 Tab
HOST_AND_ENTRY=P1 选择接入档案；P3 默认打开“详情”Tab，可切换“绑定关系”Tab
ACTOR=运维管理员
BUSINESS_SCENARIO=核对一个 provider profile 的能力子集、可绑定节点和认证方式
BUSINESS_GOAL=知道可绑定什么、绑定需要什么操作，以及该档案是否对当前空间开放
USER_VISIBLE_COPY=接入档案详情；档案名称；档案编码；所属外部系统；支持的业务；可绑定的业务节点；认证方式；解绑方式；操作说明；绑定关系
TECHNICAL_BOUNDARY=businessScope、bindableNodeTypes、authenticationKind、unbindKind 是 owner/contract facts，enum literal 由业务标签映射
FOUNDATION_PRIMITIVE=DescriptorFieldRenderer, adminDrawerSurfaceProps, useDetailDrawer, useOverlayLock, testId, NameCodeText
```

```text
┌ 接入档案：美团外卖 ─────────────────────────────────────┐
│ [详情] [绑定关系]                                      │
│ 档案名称      美团外卖                                 │
│ 支持的业务    外卖                                     │
│ 可绑定的业务节点  项目、门店                           │
│ 认证方式      需要外部平台授权                         │
│ 解绑方式      需外部平台解除授权                       │
│ 当前空间状态  [已启用]                                 │
│ [停用]                                               │
└──────────────────────────────────────────────────────┘
```

### Screen P4：绑定关系列表

```text
CONSUMER_FACE=platform-admin
UI_SURFACE=内容 Tab 内的标准分页表格
HOST_AND_ENTRY=P3 的“绑定关系”Tab；按 providerCode 和当前 groupWorkspaceKey 查询
ACTOR=运维管理员
BUSINESS_SCENARIO=在一个接入档案下核对当前集团空间的全部外部主体绑定
BUSINESS_GOAL=用业务名称和节点名称找出绑定，分页浏览全部结果
USER_VISIBLE_COPY=绑定关系；搜索绑定名称；绑定名称；绑定节点；业务；外部主体编号；状态；查看详情；新建绑定（仅启用且允许维护的档案）
TECHNICAL_BOUNDARY=Page query 的 page/pageSize/total、bindingRef、nodeRef、authorizationRef 不作为用户文案
FOUNDATION_PRIMITIVE=usePageQuery, createPageQueryIdentity, contextScopedQueryArgs, adminListState, useDetailDrawer, adminDrawerSurfaceProps, NameCodeText, testId
```

```text
┌ 绑定关系 ───────────────────────────────────────────────────┐
│ [搜索绑定名称] [查询] [重置]                  [新建绑定]     │
│ 绑定名称 │ 绑定节点 │ 业务 │ 外部主体编号 │ 状态             │
│ 海底捞外卖 │ 万象城项目 │ 外卖 │ MT-001 │ 有效              │
│ 饿了么外卖 │ 万象城门店 │ 外卖 │ EL-001 │ 待授权            │
│                             ‹ 1 2 › 共 2 条               │
└───────────────────────────────────────────────────────────┘
```

`新建绑定` 仅在当前 provider profile 已启用且 `authenticationKind` 为 `INTERNAL_MAPPING` 或 `NO_MAPPING` 时显示；`EXTERNAL_GRANT` 绑定在 platform 面只保留详情与删除/解绑相关操作。

### Screen P5：绑定详情抽屉

```text
CONSUMER_FACE=platform-admin
UI_SURFACE=Drawer
HOST_AND_ENTRY=P4 点击“绑定名称”；使用当前行的 bindingRef 读取最新详情
ACTOR=运维管理员
BUSINESS_SCENARIO=查看一条绑定的业务身份、节点、状态和授权治理信号
BUSINESS_GOAL=核对事实并按认证方式执行允许的维护动作
USER_VISIBLE_COPY=绑定详情；绑定名称；绑定节点类型；绑定节点；业务；外部主体编号；状态；绑定时间；状态更新时间；授权状态说明；编辑；删除绑定；申请解除授权；关闭
TECHNICAL_BOUNDARY=不显示 nodeRef UUID、authorizationRef、token、credential 或 raw callback payload
FOUNDATION_PRIMITIVE=useDetailDrawer, adminWideDrawerSurfaceProps, useOverlayLock, useDrawerFormLifecycle, testId, NameCodeText
```

```text
┌ 绑定详情 ───────────────────────────────┐
│ 绑定名称        海底捞外卖                │
│ 绑定节点        万象城项目                │
│ 业务            外卖                      │
│ 外部主体编号    MT-001                    │
│ 状态            有效                      │
│ 授权状态说明    已完成外部授权             │
│ [编辑] [删除绑定] [关闭]                 │
└─────────────────────────────────────────┘
```

### Screen P6：绑定新建/编辑抽屉

```text
CONSUMER_FACE=platform-admin
UI_SURFACE=Drawer
HOST_AND_ENTRY=P4 的“新建绑定”或 P5 的“编辑”；platform 面仅对启用且认证方式允许的非外部授权 binding 打开；`EXTERNAL_GRANT` 只提供删除/解绑相关入口
ACTOR=运维管理员
BUSINESS_SCENARIO=为当前 provider profile 建立非外部授权的系统节点与外部主体映射，或修正可编辑映射；外部授权 binding 由运营渠道授权流程建立后回读
BUSINESS_GOAL=先选档案允许的节点类型，再选节点；`INTERNAL_MAPPING` 必须填写外部主体编号，`NO_MAPPING` 不填写；platform 面不承载 `EXTERNAL_GRANT` 新建
USER_VISIBLE_COPY=新建绑定；编辑绑定；绑定节点类型；绑定节点；外部主体编号；外部授权完成后自动回填；保存；取消
TECHNICAL_BOUNDARY=owner grant、expectedVersion、authenticationKind、nodeRef、authorizationRef 不显示
FOUNDATION_PRIMITIVE=usePlatformOrganizationCandidates, adminDrawerSurfaceProps, useDrawerFormLifecycle, useDirtyFormLock, useOverlayLock, testId, NameCodeText
```

```text
┌ 新建绑定 ───────────────────────────────────────┐
│ 绑定节点类型  [选择允许的节点类型 ▼]             │
│ 绑定节点      [先选择节点类型后搜索 ▼]           │
│ 外部主体编号  [INTERNAL_MAPPING 输入；NO_MAPPING 不显示] │
│ 说明：EXTERNAL_GRANT 由运营渠道授权流程创建并回读   │
│                         [取消] [保存]             │
└─────────────────────────────────────────────────┘
```

### Screen O1：项目经营渠道管理

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=独立页面
HOST_AND_ENTRY=已选项目数据节点的运营管理后台；浏览器路由 /operations/:groupWorkspaceKey/business-channels/project，项目 ref 由 WorkspaceScope/queryContext 提供；owner API 仍使用 projectRef 并在 edge 重验
ACTOR=商场运营方
BUSINESS_SCENARIO=为项目定义渠道模板，并建立项目主体的任意多条渠道实例
BUSINESS_GOAL=在一个上下文内先维护模板，再维护项目渠道，不跨到门店主体
USER_VISIBLE_COPY=项目经营渠道管理；经营渠道模板；项目主体经营渠道；新建模板；新建渠道；模板名称；模板编码；接入类型；经营主体；订单类型；到店点餐形式；渠道名称；渠道编码；状态；绑定状态
TECHNICAL_BOUNDARY=projectRef、OperationsOwnerScopeGrant、templateRef、bindingRef、stopReasons
FOUNDATION_PRIMITIVE=WorkspaceScope, contextScopedQueryArgs, usePageQuery, adminListState, useDetailDrawer, adminDrawerSurfaceProps, useOverlayLock, NameCodeText, testId
```

```text
┌ 项目经营渠道管理 ──────────────────────────────────────────┐
│ 项目：万象城                                             │
│ 经营渠道模板                                 [新建模板]   │
│ 模板名称 │ 模板编码 │ 接入类型 │ 经营主体 │ 订单类型 │ 状态 │
│ 美团外卖 │ TPL-001 │ 外部 │ 项目 │ 外卖 │ 已启用 │
│ 项目主体经营渠道                              [新建渠道]  │
│ 渠道名称 │ 渠道编码 │ 来源模板 │ 状态 │ 绑定状态          │
│ 海底捞外卖 │ P-001 │ 美团外卖 │ 生效 │ 有效               │
└──────────────────────────────────────────────────────────┘
```

模板表格首列只进入只读“渠道模板详情” Drawer；详情 Drawer 展示四维事实与外部接入档案，启用模板提供“编辑”进入 O2 独立表单 Drawer，停用/启用也只在详情 Drawer 承载。表格不直接打开编辑表单，也不放置模板状态命令列。

### Screen O1-T：渠道模板详情抽屉

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=标准只读详情 Drawer
HOST_AND_ENTRY=O1 模板表格首列；按 templateRef 读取最新模板事实
ACTOR=商场运营方
BUSINESS_SCENARIO=核对模板四维、外部接入档案和当前状态
BUSINESS_GOAL=先读懂模板事实，再按状态进入编辑或启停动作
USER_VISIBLE_COPY=渠道模板详情；模板名称；模板编码；接入类型；经营主体；订单类型；到店点餐形式；外部接入档案；状态；编辑；停用；启用；关闭
TECHNICAL_BOUNDARY=不显示 providerCode、templateRef、expectedVersion 或原始 enum
FOUNDATION_PRIMITIVE=useDetailDrawer, adminDetailDescriptionsProps, adminDrawerSurfaceProps, useOverlayLock, testId
```

```text
┌ 渠道模板详情 ───────────────────────────────┐
│ 模板名称      美团外卖                       │
│ 模板编码      TPL-001                        │
│ 接入类型      外部                           │
│ 经营主体      项目                           │
│ 订单类型      外卖                           │
│ 状态          已启用                         │
│ [编辑] [停用] [关闭]                         │
└─────────────────────────────────────────────┘
```

### Screen O2：渠道模板表单抽屉

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Drawer
HOST_AND_ENTRY=O1 的“新建模板”或模板详情的编辑动作；目标固定为项目
ACTOR=商场运营方
BUSINESS_SCENARIO=按四维级联定义一个项目可复用的经营入口
BUSINESS_GOAL=依次选择接入类型、经营主体、订单类型和到店点餐形式；外部时选择当前空间开放的档案
USER_VISIBLE_COPY=新建渠道模板；编辑渠道模板；模板名称；模板编码；接入类型；内部；外部；经营主体；项目；门店；订单类型；到店；外卖；团购；到店点餐形式；POS；扫码；自助机；外部接入档案；认证方式；可绑定业务节点；保存；取消
TECHNICAL_BOUNDARY=providerCode、capabilityClass、enablement_state、expectedVersion、grant 不显示
FOUNDATION_PRIMITIVE=useOrganizationCandidates, DescriptorFieldRenderer, adminDrawerSurfaceProps, useDrawerFormLifecycle, useDirtyFormLock, useOverlayLock, testId, NameCodeText；只读详情使用 O1-T 的 adminDetailDescriptionsProps
```

```text
┌ 新建渠道模板 ───────────────────────────────────┐
│ 模板名称       [输入]                            │
│ 模板编码       [创建时输入；编辑时只读]            │
│ 接入类型       (内部) (外部)                     │
│ 经营主体       [项目 ▼]                          │
│ 订单类型       [外卖 ▼]                          │
│ 到店点餐形式   [仅到店时出现 ▼]                  │
│ 外部接入档案   [按业务筛选 ▼]                    │
│ 认证方式       需要外部授权（只读说明）           │
│ 可绑定业务节点 项目、门店（只读说明）             │
│                         [取消] [保存]             │
└─────────────────────────────────────────────────┘
```

### Screen O3：项目经营渠道列表

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=内容页下半区的标准分页表格
HOST_AND_ENTRY=O1 的“项目主体经营渠道”区；主实体为项目渠道实例
ACTOR=商场运营方
BUSINESS_SCENARIO=查看或维护项目主体渠道，必要时为同一模板新增另一经营入口
BUSINESS_GOAL=看到稳定渠道编码、名称、模板、状态和绑定状态，并从详情进入动作
USER_VISIBLE_COPY=项目主体经营渠道；渠道名称；渠道编码；来源模板；状态；绑定状态；查看详情；新建渠道
TECHNICAL_BOUNDARY=Page query、channelRef、bindingRef、stopReasons、grant
FOUNDATION_PRIMITIVE=usePageQuery, createPageQueryIdentity, contextScopedQueryArgs, adminListState, useDetailDrawer, useOverlayLock, NameCodeText, testId
```

```text
┌ 项目主体经营渠道 ───────────────────────────┐
│ [搜索渠道名称或编码] [查询] [重置] [新建渠道] │
│ 渠道名称 │ 渠道编码 │ 来源模板 │ 状态 │ 绑定状态 │
│ 海底捞盖饭 │ P-001 │ 美团外卖 │ 生效 │ 有效       │
│ 海底捞冒菜 │ P-002 │ 美团外卖 │ 草稿 │ 待授权     │
└─────────────────────────────────────────────┘
```

### Screen O4：经营渠道详情抽屉

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Drawer
HOST_AND_ENTRY=O3 或 O5 点击首列渠道名称；按 channelRef 读取最新详情
ACTOR=商场运营方或店铺运营方
BUSINESS_SCENARIO=核对渠道四维、模板、绑定和当前生效/停用原因
BUSINESS_GOAL=在业务语境中理解渠道当前为何可用、草稿或置灰，并进入允许的编辑/绑定动作
USER_VISIBLE_COPY=经营渠道详情；渠道名称；渠道编码；来源模板；接入类型；经营主体；订单类型；到店点餐形式；外部主体编号；业务；状态；停用原因；编辑；维护绑定；停用；关闭
TECHNICAL_BOUNDARY=stopReasons 映射成业务文案；不显示 UUID、原始 enum、authorizationRef 或 token
FOUNDATION_PRIMITIVE=useDetailDrawer, adminDetailDescriptionsProps, adminDrawerSurfaceProps, useOverlayLock, NameCodeText, testId；编辑动作关闭详情后打开独立编辑表单 Drawer
```

```text
┌ 经营渠道详情 ────────────────────────────┐
│ 渠道名称      海底捞外卖                  │
│ 渠道编码      P-001                       │
│ 来源模板      美团外卖                   │
│ 经营主体      项目                         │
│ 订单类型      外卖                         │
│ 绑定状态      有效                         │
│ 状态          生效                         │
│ [编辑] [维护绑定] [停用] [关闭]            │
└─────────────────────────────────────────┘
```

O4 的“编辑”不在详情内容区域内嵌表单；它关闭只读详情 Drawer 后打开独立“编辑经营渠道”表单 Drawer。表单只承载允许修改的渠道名称与保存/取消，不把只读四维事实伪装成可编辑字段。

### Screen O5：门店经营渠道列表

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=独立页面
HOST_AND_ENTRY=已选门店数据节点的运营管理后台；浏览器路由 /operations/:groupWorkspaceKey/business-channels/store，门店 ref 由 WorkspaceScope/queryContext 提供；owner API 仍使用 storeRef 并在 edge 重验
ACTOR=店铺运营方
BUSINESS_SCENARIO=在一个门店上下文中选择项目维护的门店主体模板并维护门店渠道
BUSINESS_GOAL=只看到上级项目维护、经营主体为门店且有效的模板；可创建多条门店渠道
USER_VISIBLE_COPY=门店经营渠道管理；门店；门店可接入经营渠道模板；门店主体经营渠道；模板名称；模板编码；接入类型；订单类型；来源模板；渠道名称；渠道编码；状态；绑定状态；新建渠道；查看详情
TECHNICAL_BOUNDARY=storeRef、projectRef、role scope、grant、templateRef、bindingRef
FOUNDATION_PRIMITIVE=WorkspaceScope, contextScopedQueryArgs, usePageQuery, adminListState, useDetailDrawer, useOverlayLock, NameCodeText, testId
```

```text
┌ 门店经营渠道管理 ───────────────────────────────────────┐
│ 门店：万象城海底捞                                      │
│ 门店可接入经营渠道模板                                    │
│ 模板名称 │ 模板编码 │ 接入类型 │ 订单类型                  │
│ 餐饮 POS │ STORE-POS │ 内部接入 │ 到店点餐                  │
│ 门店主体经营渠道                              [新建渠道]  │
│ 渠道名称 │ 渠道编码 │ 来源模板 │ 状态 │ 绑定状态          │
│ 海底捞盖饭 │ S-001 │ 项目外卖模板 │ 生效 │ 有效               │
│ 海底捞冒菜 │ S-002 │ 项目外卖模板 │ 草稿 │ 待授权             │
└────────────────────────────────────────────────────────┘
```

候选模板表只由 owner 返回“上级项目 + `operatorKind=STORE` + `status=ENABLED`”的有效门店模板，因此不显示重复的状态列；停用模板仍在项目模板主列表与详情中保留。

## 1.3 v2 对应页面盘点

本批没有在当前 Heritage registry 中登记的 all-v2 外部协作/经营渠道对应页面。检索范围为 all-v2 前端 feature、route、catalog 与旧需求中 `BusinessChannel`/`ProviderConfig`/`Binding` 相关路径；旧需求只包含已作废的预置七条渠道和旧三级结构，不能作为本批运行时摹本。故按“无对应页”处理，不伪造 path@hash，也不作为 runtime/build fallback。

| screen id | 对应关系            | all-v2 Heritage path@SHA-256    | 静态基线 / 摹本标注 | 差异及原因                                     |
| --------- | ------------------- | ------------------------------- | ------------------- | ---------------------------------------------- |
| P1-P6     | `NO_V2_COUNTERPART` | `PENDING_HERITAGE_REGISTRATION` | 新画低保真线框      | 本批能力分类、空间启停、binding 脱钩均为新裁定 |
| O1-O5     | `NO_V2_COUNTERPART` | `PENDING_HERITAGE_REGISTRATION` | 新画低保真线框      | 旧预置模板与单一渠道结论已由 E-09/E-10 作废    |

现有 v2s 样板只作为结构复用依据，不是 Heritage fallback：

- 树 + 右侧详情：`apps/frontend/platform-admin/src/features/organization-contract-overview/ui/PlatformReadPage.tsx`
- 列表 + 详情/状态：`apps/frontend/platform-admin/src/features/workspace-management/ui/WorkspaceManagementPage.tsx`
- 运营列表/Drawer：`apps/frontend/operations-admin/src/features/workspace-user/ui/WorkspaceUserPage.tsx`

## 1.4 搜索与候选分母

| screen      | `SEARCH_CAPABILITY_DENOMINATOR` | 业务对象与必要性                                               | 查询/候选来源                                                                       |
| ----------- | ------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| P1          | `APPLICABLE`                    | 找系统/档案；树内本地业务名称搜索                              | bounded contract tree                                                               |
| P4          | `APPLICABLE`                    | 找当前 provider 下绑定；需要远程 Page                          | collaboration owner Page，业务名称/节点名称                                         |
| P6          | `APPLICABLE`                    | 找允许绑定的组织节点；需要先选类型                             | `usePlatformOrganizationCandidates` + `candidateUsage=EXTERNAL_BINDING`（待扩枚举） |
| O1/O3/O5    | `APPLICABLE`                    | 找模板/渠道；需要远程 Page                                     | business-channel owner Page；名称/编码为主实体搜索                                  |
| O2          | `APPLICABLE`                    | 找开放的外部档案；按能力分类 bounded                           | collaboration read candidate，启用状态过滤，`PLANNED` 不过滤                        |
| P2/P3/P5/O4 | `NOT_APPLICABLE_WITH_REASON`    | 详情以稳定 ID 取一个 owner aggregate，不把详情内数组伪造成列表 | Detail operation                                                                    |

## 1.5 表单控件依赖与状态边界

| 用户可见控件                    | 控件形态/搜索方式                     | owner 候选或初始值来源                                                                     | 上游依赖与清理                                         | loading/empty/failed                                | 提交时 owner 再核验                                  |
| ------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------ | --------------------------------------------------- | ---------------------------------------------------- |
| P6 绑定节点类型（仅非外部授权） | searchable Select                     | provider profile `bindableNodeTypes`                                                       | 变更后清空绑定节点；只列档案允许的类型                 | 无候选时说明“该档案暂无可绑定业务节点”              | `NODE_TYPE_NOT_BINDABLE`                             |
| P6 绑定节点                     | searchable Select + scroll accumulate | `usePlatformOrganizationCandidates`，集团/大区/项目来自组织树；总公司/门店来自 tenant side | 必须先选类型；类型变化清空节点                         | 复用 hook loading/empty/error                       | owner 重新检查 workspace、node type、node ref        |
| P6 外部主体编号                 | Input / readonly                      | `INTERNAL_MAPPING` 用户输入；`NO_MAPPING` 无控件；`EXTERNAL_GRANT` 仅在运营授权详情回读    | 认证类型变化时清理不可用值                             | platform 不承载外部授权创建，运营侧显示授权状态说明 | `EXTERNAL_OWNER_ID_MISMATCH`                         |
| O2 接入类型                     | Radio                                 | 用户选择                                                                                   | 由内部变外部时清理外部档案；外部变内部清理 provider    | 无                                                  | BR-06/07/08 typed problem                            |
| O2 经营主体                     | Select                                | 页面固定项目，门店模板只在上级项目定义                                                     | 变更主体时清理可能不兼容的候选/节点                    | 无                                                  | owner target recheck                                 |
| O2 订单类型                     | Select                                | 业务固定四维枚举                                                                           | 变为非到店清空到店点餐形式；变为外卖/团购重查 provider | 无                                                  | `ORDER_KIND_MISMATCH` / `DINE_IN_FORM_MISMATCH`      |
| O2 到店点餐形式                 | Select                                | 仅 DINE_IN 可用                                                                            | 非 DINE_IN 隐藏并提交空值                              | 无                                                  | `DINE_IN_MUST_BE_INTERNAL` / `DINE_IN_FORM_MISMATCH` |
| O2 外部接入档案                 | bounded searchable Select             | 当前空间已启用 provider；`PLANNED` 仅显示信息标记                                          | 上游四维或能力分类变化时清空并重查                     | `PLANNED` 不作为 disabled；未启用不进候选           | `PROVIDER_NOT_ENABLED`                               |
| O3/O5 渠道名称                  | Input                                 | 用户输入                                                                                   | 不改变 templateRef/bindingRef                          | 保留输入                                            | owner 重新读模板、节点和版本                         |
| O3/O5 绑定                      | Drawer/Detail entry                   | collaboration binding candidates                                                           | 更换模板或节点时清理旧 binding                         | 失败保持渠道草稿/原状态                             | `BINDING_NOT_EFFECTIVE`                              |

## 1.6 只读/编辑状态与禁止 UI

| 对象状态/认证                     | 允许看到                     | 允许操作                                  | 明确禁止                                                                 |
| --------------------------------- | ---------------------------- | ----------------------------------------- | ------------------------------------------------------------------------ |
| 系统/档案停用                     | 仍在树、列表和详情可读，置灰 | 仅允许恢复（若 owner 允许）               | 隐藏、删除、编辑下游事实                                                 |
| 模板/渠道停用                     | 仍在列表、详情可读，置灰     | 不可编辑；按状态命令恢复/停用             | 删除按钮、保存停用对象                                                   |
| `EXTERNAL_GRANT` platform binding | 认证说明、授权状态           | 仅详情与删除/解绑相关操作；待授权状态只读 | 新建、编辑、外部主体编号输入、手工“标记已授权”                           |
| `NO_MAPPING`                      | 映射说明                     | 创建即有效                                | 外部主体编号输入框                                                       |
| `REQUIRES_ADAPTER_UNBIND`         | 授权状态与解绑说明           | 只走协议入口；精确分支受 C-04 约束        | 主程序拼 URL/签名、解析原始载荷                                          |
| 任何页面                          | 业务名称和编码               | 业务操作                                  | token、credential、`authorizationRef` 值、`nodeRef` UUID、原始枚举字面量 |
| operations-admin                  | 渠道及其对应绑定             | 两个渠道写 capability 范围内的写入        | 非渠道绑定管理入口、读 capability                                        |

## 1.7 Mutation fact matrix 摘要

| variant                                    | 用户可见事实                             | 变更分类                                | hidden owner fact                                           | 失败恢复                    |
| ------------------------------------------ | ---------------------------------------- | --------------------------------------- | ----------------------------------------------------------- | --------------------------- |
| create platform binding / INTERNAL_MAPPING | 节点类型、节点、外部主体编号             | `EDITABLE`                              | workspace、provider、authenticationKind、idempotency、grant | 表单保留；typed field error |
| create operations binding / EXTERNAL_GRANT | 渠道节点、业务线；外部主体编号为授权结果 | `EDITABLE` + `HIDDEN_OWNER_FACT`        | callback correlation、opaque authorization ref              | 保持待授权，不伪造有效      |
| create platform binding / NO_MAPPING       | 节点类型、节点；无主体编号               | `EDITABLE`                              | provider contract、default effective status                 | owner readback 成功后关闭   |
| create/update template                     | 模板名称、模板编码、四维、外部档案       | `EDITABLE`；模板编码与四维创建后 `FIXED_READONLY` | target PROJECT、expectedVersion、grant                  | 旧模板保持不变              |
| create/update channel                      | 名称、模板、节点/绑定                    | `EDITABLE` / `FIXED_READONLY`           | channelCode、templateRef、bindingRef、grant                 | owner readback；冲突回详情  |
| status mutation                            | 当前状态、目标状态、确认对象             | `FIXED_READONLY`                        | version、stopReasons、actor                                 | 状态不变，刷新最新详情      |

## 1.8 Per-operation reasonableness

- 选择树/Tab/详情抽屉，是因为运维任务先识别契约对象再看空间状态；单一大表会把系统定义、档案定义和运行绑定混为一张表。
- 项目页“模板在上、渠道在下”，是因为运营者先定义可复用入口再落地实例；拆成两个页面会丢失当前项目上下文。
- 门店页只展示项目维护的门店主体模板，是因为模板 owner 在项目；复制模板到门店会制造第二个真相源。
- binding 使用独立 Drawer，不内嵌到渠道表格行，是因为一条 binding 可被非渠道消费者复用，且授权状态需要独立 readback。
- `templateCode` 与 `channelCode` 都作为独立可见列，是因为 G-05B 要求真实业务编码单列；模板编码按项目判重、渠道编码按集团空间判重，创建后不可修改。

## 1.9 Face/owner matrix

| 行为                 | consumer face    | edge            | owner                            | capability                             | 读取范围                |
| -------------------- | ---------------- | --------------- | -------------------------------- | -------------------------------------- | ----------------------- |
| 系统/档案读          | platform-admin   | platform edge   | collaboration read               | 无 capability                          | 当前集团空间            |
| 系统/档案启停        | platform-admin   | platform edge   | collaboration command            | 无 capability；session + owner recheck | 当前集团空间            |
| 非渠道 binding 维护  | platform-admin   | platform edge   | collaboration command            | 无 capability；session + owner recheck | binding node/workspace  |
| 渠道/对应 binding 写 | operations-admin | operations edge | business-channel + collaboration | 项目渠道编辑或门店渠道编辑             | PROJECT/STORE target    |
| 渠道读/模板读        | operations-admin | operations edge | business-channel read            | 不用 capability                        | session role node scope |
| 适配器回填           | adapter face     | adapter edge    | collaboration command            | adapter identity                       | binding owner node      |

## 1.10 视觉 review 结论

```text
DEXTER_WIREFRAME_REVIEW=ACCEPTED_TEXTUAL_DESCRIPTION
DEXTER_HIFI_REVIEW=NOT_REQUIRED
UI_ADMISSION=ACCEPTED_TEXTUAL_DESCRIPTION
IMPLEMENTATION_AUTHORITY=true
```

低保真文字线框已覆盖十一个 surface；Dexter 已于 2026-08-19 裁定按文字描述实施，不再等待另行视觉 review。该裁定只确认 surface/文案/路径按已接受 Journey 落地，不改变本批已收口的 owner、E-33 或 capability 边界。
