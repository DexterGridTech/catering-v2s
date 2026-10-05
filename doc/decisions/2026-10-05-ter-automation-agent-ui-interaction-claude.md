---
title: TER automation-agent 交互工件
status: PROPOSED
implementationAuthority: false
---

# TER automation-agent 交互工件

## 1. 工件元数据

JOURNEY_DECISION=`doc/decisions/2026-10-05-ter-automation-agent-journey-claude.md`（待确认）。
BUSINESS_REQUIREMENT_SOURCE=正式需求 R-04；BUSINESS_PROBLEM=管理员分辨是否装了启用自动化的构建。
BUSINESS_USER_OR_OWNER=现场管理员；CURRENT_TASK=查看构建事实；SUCCESS_OUTCOME=两项与实际构建输入一致。
UI_BEARING=true；SKILL_USED=cs-spec-to-plan、cs-writing-plans；DEXTER_WIREFRAME_REVIEW=UNSET；DEXTER_HIFI_REVIEW=NOT_REQUIRED。
CONSUMER_FACE=TER_LOCAL_ADMIN（现有模板的两个后台/public face 不适用，不新增 HTTP face）。

## 1.1 UI 详设强制标准

| 字段 | AA-ADMIN-MOBILE | AA-ADMIN-LAPTOP |
|---|---|---|
| CONSUMER_FACE | TER_LOCAL_ADMIN | TER_LOCAL_ADMIN |
| UI_SURFACE | 既有内容 Tab 中的事实字段 | 同左 |
| HOST_AND_ENTRY | AdminShellMobile→运行状态 | AdminShellLaptop→运行状态 |
| ACTOR | 现场管理员 | 现场管理员 |
| BUSINESS_SCENARIO | 查验自动化构建 | 同左 |
| BUSINESS_GOAL | 看出构建启用与地址 | 同左 |
| USER_VISIBLE_COPY | 自动化：已启用/未启用；连接地址：实际地址/— | 同左 |
| TECHNICAL_BOUNDARY | 构建常量；不显示令牌、连接即时状态 | 同左 |
| FOUNDATION_PRIMITIVE | NONE_WITH_REASON：TER 原生宿主；复用 admin-shell 的 PrimitiveFactGrid/PrimitiveText，admin-ui-foundation 的 DOM/Ant Design 生命周期不适配此只读原生字段 | 同左 |
| CONTAINER_LAYOUT | 沿用 RuntimeSectionMobile 的 PrimitiveScrollView；事实值换行，外框与 Tab 头不溢出；不新增滚动祖先 | 沿用 RuntimeSectionLaptop 的 PrimitiveScrollView；同一 FactGrid 标签列对齐，事实值换行；不新增滚动祖先 |

### 1.2 管理后台交互一致性引用

`doc/platform/frontend-coding-standard.md` §3-K-1..§3-K-10：两个后台的路由、Drawer、Modal、列表 CRUD 专属项均 N/A（本屏是 TER 既有 console 的只读行）；通用可访问性、文字状态与容器约束沿用 terminal-coding-standard。不得据此把 TER console 改成后台 shell。
Surface ownership：admin-shell 拥有呈现和常量 testID，assembly 提供构建事实，agent 拥有 WS 生命周期，没有新的事实 slice。
业务语言：用「自动化」「连接地址」，不新增商户、组织或权限概念；不显示 protocol/selector/command 内部表。
owner-definition 字段槽位 N/A：无定义驱动表单，也无 mutation。

## 2. Interaction map

既有唤起动作→既有管理员登录→运行状态 Tab→查看两行→既有关闭动作。没有新增点击或输入，不改变 admin 的恢复入口。

## 3. v2 对应页面盘点

本次新增是已裁定的 TER 自动化构建事实，不存在需要沿用的后台业务页面。基线是当前 `RuntimeSectionMobile.tsx` / `RuntimeSectionLaptop.tsx`；不读取 Heritage 作为运行依赖，不另画 admin 页面体系。

## 4. 低保真线框

### Screen: AA-ADMIN-MOBILE

```text
┌ 终端管理（现有）────────────────┐
│ [运行状态] …其他既有 Tab…       │
│ 运行状态                       │
│ [既有状态、环境、设备等事实]    │
│ 自动化       已启用            │
│ 连接地址     ws://localhost:…   │
│              长地址继续换行    │
│ [既有显示事实]                 │
└────────────────────────────────┘
```

### Screen: AA-ADMIN-LAPTOP

```text
┌ 终端管理（现有）──────────────────────────┐
│ [运行状态] …其他既有 Tab…                 │
│ 运行状态 / 既有摘要卡                     │
│ [既有运行事实]                           │
│ 自动化  已启用     连接地址  ws://…        │
│                              长值换行    │
│ [既有显示屏信息]                         │
└──────────────────────────────────────────┘
```

#### 自动化控件 testID 清单与 implementation-facing roster

| screen | 字段 | 类型/值源 | 常量源与新 ID | 动作节点 | 行为 |
|---|---|---|---|---|---|
| 两屏 | 自动化 | PrimitiveFactGrid 只读项 / assembly.enabled | `adminTestIds.automation.enabled`→`ui.base.admin-shell:runtime:automation-enabled` | 实际文本节点，不是 wrapper 冒充 | 无动作 |
| 两屏 | 连接地址 | PrimitiveFactGrid 只读项 / assembly.url | `adminTestIds.automation.address`→`ui.base.admin-shell:runtime:automation-address` | 实际文本节点 | 长值换行，无复制按钮 |

PrimitiveFactGrid新增可选item.valueTestID：本两行必填并挂value RnrText，现有item.testID保留在外框；adminTestIds.automation.enabled/address用于valueTestID。CP-05所有FactGrid调用点与转发props同品牌TestId/构造器迁移；组件proof分别断言外框和文本。
先用现有 ID 完成首个旅途，后由统一构造函数生成以上 ID；不保留旧别名。surface 在注册上下文里，不能拼到 ID 内。
输入依赖图、mutation 字段矩阵、主从集合、搜索与候选协议：全部 N/A，无输入、写操作、搜索或业务集合。

## 5. 状态与边界表

enabled=false：未启用/—。enabled=true：已启用/实际地址。网络断开、重连、错误令牌：这两项常量不变。畸形配置：静态拒绝，运行时不启动 agent，不伪造有效地址。

## 6. 逐操作任务合理性

仅复用已有开 Tab/关闭；拒绝新增开关、连接按钮、复制令牌或调试工作台，因为不服务 R-04 的辨识任务。

## 7. Face / owner 对齐矩阵

TER 本机 admin → admin-shell 呈现 → assembly 构建输入。HTTP/后台权限/mutation N/A。

## 8. Manifest B.4/B.5 命中对照

NOT_APPLICABLE_WITH_REASON：compliance-control 已退役，不恢复 manifest 分母。

## 9. 可选高保真静态 demo

NOT_REQUIRED：新增两条事实行，当前低保真工件供 Dexter 看图。

## 10. Dexter 看图结论

UNSET；本文件不声称 UI 已通过，也不授权实施。
