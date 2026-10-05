---
title: TER automation-agent IA
status: PROPOSED
implementationAuthority: false
---

# TER automation-agent IA

## 1 · 元数据

IA_SCOPE=AA-ADMIN-MOBILE,AA-ADMIN-LAPTOP。
BUSINESS_SOURCE=`doc/plans/platform/2026-10-05-ter-automation-agent-formal-requirements-claude.md#R-04`。
JOURNEY_REFS=`doc/decisions/2026-10-05-ter-automation-agent-journey-claude.md`（PROPOSED）。
UI_INTERACTION_REF=`doc/decisions/2026-10-05-ter-automation-agent-ui-interaction-claude.md`。
IMPLEMENTATION_DESIGN_REF=`doc/plans/platform/2026-10-05-ter-automation-agent-implementation-design-claude.md`。
DEXTER_WIREFRAME_REVIEW=UNSET；IMPLEMENTATION_AUTHORITY=false。

## 2 · 维度

下表每行两个 screen 都适用；差异只在已有 RuntimeSectionMobile/RuntimeSectionLaptop 的排版，不创建第三套屏幕。

| 维度 | AA-ADMIN-MOBILE | AA-ADMIN-LAPTOP |
|---|---|---|
| businessTask | 看出本构建是否启用自动化及地址 | 同左 |
| actorAndScenario | 管理员排查自动化构建 | 同左 |
| entryAndSurface | admin-shell「运行状态」既有内容 Tab；MMP | 同 Tab；LMP/LMS/LSP 中能打开本机 admin 的 surface |
| controlType | 只读事实两行，复用 PrimitiveFactGrid | 同左，沿用既有 columns |
| validationAndError | 构建配置校验失败不产生半真状态行；沿用启动失败路径，无新网络错误弹窗 | 同左 |
| accessibilityAndTestId | 文字「自动化：已启用/未启用」「连接地址：地址/—」；常量源 adminTestIds.automation | 同左 |
| emptyLoadingErrorStates | 没有异步加载/空列表；未启用地址为「—」 | 同左 |
| containerBehaviorUnderLoad | 沿用现有 scroll；长 URL 换行不撑宽，Tab 头/外框不溢出；不新增滚动祖先 | 同左 |
| interactionConsistency | TER 规范适用；admin-web §3-K-1..10 容器专属项 N/A，见交互 §1.2 | 同左 |
| stateAndPermission | [focused] 未授权 admin 时不能借新行打开 console；行没有 mutation；[静态] 只读 assembly 构建输入 | 同左 |
| navigationAndRefresh | [focused] 开/关 WS、重连时这两行不变化；没有实时连接状态，关闭 admin 不关 agent | 同左 |
| collectionShapeAndScale | Bounded：恰好两项构建事实，不分页、不发 HTTP | 同左 |
| dataSourceAndCascade | [focused] application/integration package.json→assembly→admin context；HOT 换 bundle 后按新配置重新创建 Runtime | 同左 |
| forbiddenUI | 没有开关按钮、令牌、实时 WS 状态、raw payload、能力分级 | 同左 |

## 3 · 共用信息架构规则

两行定位使用 FactGrid item.valueTestID，挂实际 value 文本；item 外框 ID 不冒充文本，见详设§4.3。
自动化连接和 UI 状态行同源；admin-shell 不依赖 automation-agent，不读其连接内部对象。
显示地址与连接使用同一个已校验值；配置 URL 禁止 userinfo/令牌 query。任意原始 IP 不落日志，console 地址按需求可见，截图落盘先遮蔽。

## 4 · 错误语义与界面映射

| problem | HTTP | 触发 | 处理 |
|---|---|---|---|
| AUTOMATION_CONFIG_INVALID | N/A | 坏构建参数 | 打包/静态检查拒绝；若运行时收到坏值，日志只记原因码，不启动 agent |
| AUTOMATION_CONNECTION_FAILED | N/A | WS 不可达 | driver/启动日志可观察；业务和这两项常量不变，无新用户弹窗 |

## 5 · 交叉对账

位置、两条文案、只读、地址同源、长地址换行、唯一滚动祖先与交互工件一致。当前只有静态提案，不是渲染 PASS。

## 6 · 完成判定

DEXTER_WIREFRAME_REVIEW=UNSET；运行与 UI proof=NOT_RUN。外部 reviewer 核对位置、边界和模板覆盖后，Dexter 再确认线框。
