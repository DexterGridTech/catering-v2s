---
title: TER 本机更新阶段 A 交互候选
status: PROPOSED_FOR_DEXTER_CLAUDE_REVIEW
---

# 本机更新交互

## 1. 工件元数据

JOURNEY_DECISION=doc/decisions/2026-10-06-ter-local-update-journey-claude.md；BUSINESS_REQUIREMENT_SOURCE=doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md §20.3。
BUSINESS_PROBLEM=设备需要真实安装或加载更新而不能丢失业务数据。
BUSINESS_USER_OR_OWNER=终端使用者/本机更新 owner；CURRENT_TASK=固定目标的本机更新。
SUCCESS_OUTCOME=实际版本正确且启动可确认；UI_BEARING=true；SKILL_USED=cs-spec-to-plan。
DEXTER_WIREFRAME_REVIEW=ACCEPTED（2026-10-06，Dexter“界面内容我都确认”）；DEXTER_HIFI_REVIEW=NOT_REQUIRED；CONSUMER_FACE=terminal（TER 例外，不冒称 public 后台）。

### 1.1 UI 详设强制标准

以下三个面的界面内容已由 Dexter 确认。实现期 source/control 注册与 UI/设备行为仍 NOT_RUN，界面接受不授予实施或运行权限。
### 1.2 管理后台交互一致性引用

UPDATE-INSTALL/BOOT/FAILURE 的 §3-K-1～10 均 N/A_WITH_REASON：本阶段没有管理后台，分别由 OS 或 TER 原生启动层承载。

## 2. Interaction map

| 顺序/前提 | screen/用户目的 | 可见/操作 | owner readback | 成功去向 | 失败/退出 |
| --- | --- | --- | --- | --- | --- |
| prepared+flush成功，OS需确认 | INSTALL；确认更新 | 系统安装按钮/取消；系统要求时来源设置 | action/session+实际包/权限 | BOOT | 取消/ENDED_NOT_INSTALLED回WAITING_USER；下一呈现新action/session；仍存不可判定/读回失败保留UNKNOWN；权限未授不跳过 |
| actual APK已达或HOT selection受理 | BOOT；恢复业务 | 既有加载呈现，无按钮 | 当前context boot/PRIMARY/hydration | 原业务面 | T/未确认按兼容条件一次恢复 |
| 目标未启动且无安全恢复 | FAILURE；了解未完成 | 只读提示 | native failed identity，非JS伪selector | 保留诊断，等待未来合法新工件 | 不提供手工重试/清标记/APK回退 |

HOT 直接走同一个 BOOT 确认流程。N/M 的 TER 提醒与判闲面不在 A。

## 3. v2 对应页面盘点

NO_V2_COUNTERPART：范围是 Android 系统安装 UI 及本仓现有 native loading，而非后台页面。
静态基线来自本仓 `TerminalNativeLoadingRegistry.kt`/`nativeLoadingCapability.ts`；OS 安装面外部官方 API 见详设附录。
没有引入 Heritage 页面资产，也没有 runtime/build fallback。

## 4. 低保真线框与逐面声明

### Screen: UPDATE-INSTALL

CONSUMER_FACE=terminal；UI_SURFACE=Android 系统原生安装面。
HOST_AND_ENTRY=PackageInstaller STATUS_PENDING_USER_ACTION 返回的系统 Intent，由当前 foreground host 打开。
ACTOR=终端使用者；BUSINESS_SCENARIO=准备完成后系统要求确认；BUSINESS_GOAL=安装批准的完整更新。
USER_VISIBLE_COPY=系统提供应用名称、安装确认/取消；以下仅是语义示意，逐字内容不由 TER 指定。
TECHNICAL_BOUNDARY=applicationId/signing/sessionId；FOUNDATION_PRIMITIVE=NONE_WITH_REASON:非后台，OS 自有界面。
CONTAINER_LAYOUT=OS viewport 和滚动行为，不绘制 sibling TER shell，不加嵌套表单。

```text
┌──── 系统安装面（语义示意）────┐
│ 应用名称                    │
│ 安装此更新？                │
│          取消      安装     │
└─────────────────────────────┘
```

控件 roster：OS 安装/取消，无 TER TestId；driver 的 Android adapter 以系统包+display 的语义资源定位并读取状态，用最新automation R-10的系统UI uiautomator窄例外获得真实bounds再input，注明例外；不用裸坐标替代定位。
系统“允许此来源安装”设置面仅由系统提供；若需要该前提，driver 明确建立并读回，不能以安装结果代替权限证明。
输入依赖：无文本输入；安装以 prepared identity/系统授权为前提；取消不清理活跃 installer 文件。

### Screen: UPDATE-BOOT

CONSUMER_FACE=terminal；UI_SURFACE=PRIMARY 原生启动加载层。
HOST_AND_ENTRY=既有 Activity/nativeLoading gate + 每次 JS boot 的 update protection。
ACTOR=终端使用者；BUSINESS_SCENARIO=冷启动或更新后 reload；BUSINESS_GOAL=恢复原业务画面。
USER_VISIBLE_COPY=沿用现有启动加载呈现，不新增版本/技术文字。
TECHNICAL_BOUNDARY=bootToken/publication identity/hydration；FOUNDATION_PRIMITIVE=NONE_WITH_REASON:现有 TER native gate，无后台 foundation 依赖。
CONTAINER_LAYOUT=沿用全屏加载层，仅 PRIMARY 能确认；SECONDARY 复用同一 boot，不另启等待任务。

```text
┌──────── PRIMARY ────────────┐
│        现有启动加载         │
└─────────────────────────────┘
```

控件 roster：无用户动作；确认来源是现有 integration assembly 的 PRIMARY real-ready，须绑定当前 boot 且必要 hydration 成功。
失败页也能隐藏 splash，但绝不发送成功确认。已隐藏的 Activity 发生 reload 仍有新保护期限。

### Screen: UPDATE-FAILURE

CONSUMER_FACE=terminal；UI_SURFACE=原生启动保护错误面。
HOST_AND_ENTRY=不能恢复到获准同 native 且可读的成功发布时，由 native gate 显示。
ACTOR=终端使用者；BUSINESS_SCENARIO=目标不能启动且无安全恢复目标；BUSINESS_GOAL=知道无法继续及联系管理员。
USER_VISIBLE_COPY=更新未能启动，请联系管理员。
TECHNICAL_BOUNDARY=原生原因码，技术详情只在脱敏诊断；FOUNDATION_PRIMITIVE=NONE_WITH_REASON:JS 无法安全启动，只能由原生承载。
CONTAINER_LAYOUT=PRIMARY viewport 内居中文本，长文换行，不产生横向滚动，无第二滚动容器。

```text
┌──────── PRIMARY ────────────┐
│ 更新未能启动，请联系管理员  │
└─────────────────────────────┘
```

控件 roster：只读 Text；native contentDescription=`terminal-update-startup-failure`；无手工重试或清标记按钮。
无法向 automation-agent 报 selector 时由同一 driver Android readback/屏幕查询验证，不能用“agent 离线”判成功。

## 5. 状态、边界与恢复

| 面/状态 | 状态owner/输入 | 用户可见 | 退出/边界 |
| --- | --- | --- | --- |
| INSTALL waiting/cancel/unknown | update currentTask + native action/session | 系统要求时显示安装/设置；无第二TER按钮 | cancel/确证session消失未安装保持WAITING_USER，旧action不重commit；下次新action/session邀请；BUSY占用结束重核有出口，读回失败不当消失；技术失败终态 |
| BOOT loading/ready/unconfirmed | native immutable context boot + PRIMARY/hydration | 现有loading；成功进入原业务 | hide失败页不confirm；旧context不确认新boot；有界一次恢复 |
| FAILURE no-safe-recovery | native boot/failed publication record | 明确只读文本 | 无手工重试、APK降级或清坏包标记；新合法目标另行处理 |

此处没有字段表单、搜索、候选、分页或列表排序，逐项N/A_WITH_REASON：三个面是OS确认与TER原生启动呈现。未知归属installer不能为了退出清文件。

## 6. 可见操作合理性

| 操作/观察 | 需求来源/用户目的 | 最小入口与owner | 不新增的入口 |
| --- | --- | --- | --- |
| 安装/取消 | R10/11；用户确认系统安装，可取消 | OS控件；实际installer事实 | 无TER重复确认/手工重试页 |
| 允许来源（系统要求时） | R11企业分发系统资格 | OS设置窗口；权限读回 | 无TER伪权限开关 |
| 等待PRIMARY启动/只读失败 | R13/14；恢复业务或知道失败 | native gate；真实boot/恢复判据 | 无每屏独立任务、坏包重试按钮 |

## 7. Face与surface ownership 自检

| screen | 可见项 | owner | 文案槽位完整 | 状态 |
| --- | --- | --- | --- | --- |
| UPDATE-INSTALL | 应用名、系统确认、取消 | Android 系统 | 是，系统文案不锁死 | 待设备验证 |
| UPDATE-BOOT | 现有加载 | TER native gate | 是，无新文案 | 待设备验证 |
| UPDATE-FAILURE | 失败提示 | TER update native gate | 是 | 内容已由 Dexter 确认；设备显示 NOT_RUN |

## 8. 工件与核验状态

旧manifest/evidence分母控制面N/A_WITH_REASON：已退役，不新建控制台账；详设§3a有限action映射仍必须执行。

## 9. 高保真

NOT_REQUIRED：A无自建更新页面，系统布局不由TER设计；现有loading与新增原生只读Text由低保真内容确认即可。三个面的内容接受状态为ACCEPTED，动态显示仍NOT_RUN。

## 10. 看图与证据

所有新增行为=NOT_RUN；L3_UNVERIFIED=安装确认、reload 加载/双屏、原生失败面。
只有安装面是真实点击，必须用 automation-agent driver 的 Android adapter；直接 command 只触发最终 owner 能力，不冒充点击。
UI_CONTENT=ACCEPTED；系统安装/来源设置、启动加载、原生失败文本三个面均已确认；UI/设备行为=NOT_RUN。不授权实现、测试、DEV、设备或数据操作。

### 逐操作状态/控制面

INSTALL安装/取消/来源开关三动作分别由OS持有，等待/取消/ENDED_NOT_INSTALLED/未知/权限变化后的真实事实通过readAction/readFacts；无TER表单字段，无搜索/候选/分页（N/A_WITH_REASON）。
BOOT的PRIMARY成功/hydration/错误hide、FAILURE的只读Text均为观察，不把语义command伪称点击。详设§3a逐case/control表及两App/driver/manifest控制面是本工件的自动化绑定清单；所有当前proof=NOT_RUN。
安装、来源设置与原生启动失败文本三类不在 React 树内的界面可使用同 driver 内 uiautomator 窄例外（失败文本仅定位/读取），报告注明；TER React 节点仍走 agent，加载状态按原生事实/selector 观察，不恢复旧 UiAutomator 旅途或通用旁路。
