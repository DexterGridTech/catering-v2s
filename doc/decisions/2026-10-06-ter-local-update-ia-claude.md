---
title: TER 本机更新阶段 A IA
status: PROPOSED_FOR_DEXTER_CLAUDE_REVIEW
---

# TER 本机更新 IA

## 1 · 元数据

IA_SCOPE=UPDATE-INSTALL,UPDATE-BOOT,UPDATE-FAILURE。
BUSINESS_SOURCE=doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md；JOURNEY_REFS=doc/decisions/2026-10-06-ter-local-update-journey-claude.md。
UI_INTERACTION_REF=doc/decisions/2026-10-06-ter-local-update-ui-interaction-claude.md；IMPLEMENTATION_DESIGN_REF=doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md。
DEXTER_WIREFRAME_REVIEW=ACCEPTED（2026-10-06，三个面的界面内容）；IMPLEMENTATION_AUTHORITY=false。

## 2 · 逐面维度

| 维度 | UPDATE-INSTALL | UPDATE-BOOT | UPDATE-FAILURE |
| --- | --- | --- | --- |
| businessTask | 确认系统安装当前 FULL | 等待目标 JS 启动并恢复数据 | 知道本次无法安全启动 |
| actorAndScenario | 终端使用者，系统需确认 | 终端使用者，冷启动或受控 reload | 终端使用者，无获准恢复目标 |
| entryAndSurface | 系统 PackageInstaller 原生面，无 TER 路由 | 既有 PRIMARY 启动面；双屏同一 Host | 原生启动保护错误面，覆盖失败 PRIMARY |
| controlType | 系统安装/取消控件，由 OS 决定 | 既有加载状态，无新增按钮 | 只读提示，无重试/清标记按钮 |
| validationAndError | 取消继续等待；技术失败分类；未知先读回 | hide splash 不等于确认启动 | 不伪造 JS 成功，不回退 APK |
| accessibilityAndTestId | OS 控件无 TER TestId，以系统包+display+语义资源限定 | 现有 loading gate；新 boot 身份以 selector/native readback 观察 | 原生 Text 的 contentDescription=terminal-update-startup-failure，文字非纯颜色 |
| emptyLoadingErrorStates | 无 install session 不打开；pending 不叠面 | hydration 未完继续加载；错误页不确认 | 无恢复目标停止自动加载；提示联系管理员 |
| containerBehaviorUnderLoad | OS 控制布局；不画额外 TER 内容 | 原有全屏加载层 | PRIMARY viewport 内文字换行，无操作区，无第二滚动祖先 |
| interactionConsistency | §3-K 全部 N/A：非后台，是 OS 控件 | §3-K 全部 N/A：TER 原生加载 | §3-K 全部 N/A：TER 原生失败文本 |

### 2.2 不可见观察

| 维度 | UPDATE-INSTALL | UPDATE-BOOT | UPDATE-FAILURE | 最低证据档（计划） |
| --- | --- | --- | --- | --- |
| stateAndPermission | flush失败零apply；系统资格决定确认，权限不绕过 | 当前boot+PRIMARY+hydration才confirm；旧token拒绝 | 仅native确认无安全恢复目标显示；不借JS失败页确认 | owner focused+原生设备 |
| navigationAndRefresh | cancel/ENDED_NOT_INSTALLED保留task并回WAITING_USER；旧action不重commit；下次呈现新action/session受理；BUSY结束后重核，查询失败保持UNKNOWN | 同Activity reload新boot；secondary无第二确认 | 无按钮，无点击退出；未来合法新工件非失败包手工重试 | focused+同driver设备 |
| collectionShapeAndScale | 单task/single owned session；工件文件/字节有界 | 单candidate/deadline，同Host两surface | 一次获准恢复；失败identity非任务流水 | focused+native预算 |
| dataSourceAndCascade | 系统实际版本/action读回，不靠dispatch返回 | 当前APK身份→selection资格/复位→embedded asset或HOT file→context immutable boot→PRIMARY | 原生失败record，agent离线非成功 | native readback+真实资源 |
| forbiddenUI | 无手工更新页/重复TER安装按钮/后台看板 | 无强行隐藏splash冒确认/第二执行核 | 无失败包重试、清标记、APK回退按钮；无raw异常/地址/秘密 | 静态+automation |

## 3 · 共用信息架构规则

一个主屏启动确认触发一次；LMS 不是独立更新 owner。双机本机事实和规则同步归 C，此 IA 不承诺副机本轮行为。
安装界面不保证 OS 的逐字文案或显示哪个按钮；原生 adapter 必须返回需用户动作事实，不替 OS 做静默承诺。

## 4 · 错误语义与界面映射

DOWNLOAD_FAILED/INVALID_ARTIFACT/PERSISTENCE_FAILED：owner 最近状态，保留现有业务面；A 不新增业务弹窗。
USER_CANCELLED/ENDED_NOT_INSTALLED：WAITING_USER；INSTALL_UNKNOWN/BUSY_UNKNOWN：UNKNOWN，按事件读回且占用结束后有出口；BOOT_FAILED_WITHOUT_RECOVERY：UPDATE-FAILURE。
恢复成功只描述实际恢复发布，原目标仍失败；BOOT_CONFIRMED 后普通业务失败不触发本面。

| 全部错误族（详设typed原因） | 归属/呈现 | 后继 |
| --- | --- | --- |
| 版本/身份/兼容/来源拒绝；坏包标记；冲突target | owner recentStatus安全原因；业务面不变 | 无下载/apply；仅未来合法新target可接受 |
| 网络/空间/ZIP路径、摘要、文件/字节预算错误 | owner准备失败；保留业务面 | 有限网络重试按详设；技术终态不手工重试 |
| 持久化/flush失败 | owner状态与安全日志；零提交 | 不触发INSTALL/BOOT |
| pending user action/来源权限未获准/明确用户取消 | INSTALL系统面或系统设置；owner WAITING | 保留固定目标，不标坏；N提醒归C |
| installer明确技术失败/不确定ABORT/ENDED_NOT_INSTALLED/BUSY_UNKNOWN | owner失败、UNKNOWN或WAITING_USER分别呈现；不暴露系统原异常 | session仍存不可判定/查询失败保持UNKNOWN；确证消失未安装或busy占用结束后未安装回WAITING_USER，下次新action/session邀请；技术失败终态，禁止重复旧commit |
| HOT加载异常/未确认超期/进程中断 | native判据→获准恢复或FAILURE | 不回退APK；一次恢复也失败时停自动加载 |
| 清理/退订/原生读回失败 | owner安全日志及UNKNOWN/cleanup失败 | 不宣称成功；保留仍被引用或未知归属资源 |

## 5 · 交叉对账

三个面与 Journey、交互与详设 §3a/§8/§11a 一一对应。OS 文案为系统行为而非业务词库内容。
新增布局、contentDescription 均是计划；没有 UI 测试或动态证明。

| IA面 | Journey任务/前提 | UI承载 | 详设/验收闭包 |
| --- | --- | --- | --- |
| INSTALL | §2使用者确认；§3系统权限/签名 | INSTALL+来源设置前置变体 | §8.7 session协议；update.install-result/interruption |
| BOOT | §2恢复业务；§3 PRIMARY/hydration | BOOT，两个surface同Host | §8.7不可变boot；update.boot-guard/offline-assets/compatibility |
| FAILURE | §4不安全恢复不继续 | FAILURE只读Text | §8.7一次恢复；update.rollback/cleanup |

## 6 · 完成判定

DEXTER_WIREFRAME_REVIEW=ACCEPTED；UI/设备行为=NOT_RUN。本文件不赋予实现/运行权限，最低FULL API仍待Dexter选择。
