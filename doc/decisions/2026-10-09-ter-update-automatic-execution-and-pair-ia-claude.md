# TER 更新阶段 C：IA

## 1. 元数据

IA_SCOPE=INSTALL-INVITATION（一个邀请，两种宽度）；REUSE=A 系统安装/设置/原生错误、B 两后台包/规则/报告。
BUSINESS_SOURCE=正式需求 R-11/12/15、§20.5；JOURNEY_REFS=同日期 automatic-execution-and-pair Journey。
UI_INTERACTION_REF=同日期 UI 工件；IMPLEMENTATION_DESIGN_REF=同日期 stage-c implementation-design。
DEXTER_IA_REVIEW=ACCEPTED@2026-10-09；DEXTER_WIREFRAME_REVIEW=ACCEPTED_IA_CONTENT@2026-10-09；IMPLEMENTATION_AUTHORITY=false；STATUS=IA_CONTENT_ACCEPTED_PENDING_DESIGN_REVIEW。

2026-10-10 职责追加：project-basic拥有项目/大区/商业集团及项目规则；store-basic保留门店业务；terminal-update actor接收feature公开local command后办理本机更新。此搬移不增加页面/控件，已确认邀请保持原样，当前源码尚未搬移。

## 2. 逐面维度

### 2.1 可见维度

| 维度 | INSTALL-INVITATION |
| --- | --- |
| businessTask | 下载完成后邀请用户完成固定 FULL；可稍后，不重选目标 |
| actorAndScenario | 使用本机的店员；不需升级管理权限，不改变系统 installer 授权 |
| entryAndSurface | 无路由；本机物理 PRIMARY 的 既有 alert tier 的 local-primary 提示层，mobile/laptop 响应式；不投影到主/副另一机，不在 SECONDARY 弹第二份 |
| controlType | PrimitiveContainer、PrimitiveHeading、PrimitiveText、PrimitiveScrollView、PrimitiveButton。两个动作“稍后”“安装”；busy 后禁重复安装，非表单、无筛选/分页 |
| validationAndError | task/action/boot 不匹配关闭旧邀请，不做旧点击；平台无法呈现或未知保留等待；技术失败显示现有错误信息，不能给“重试坏包” |
| accessibilityAndTestId | Dialog 语义、标题关联、焦点先给“稍后”、按钮可键盘操作；状态用文字；TestId 在实际按钮，不在 wrapper |
| emptyLoadingErrorStates | 不存在待安装任务时零邀请；读 actual/action 未完成不提示；失败不假造“已更新”。原业务内容不因读失败清空 |
| containerBehaviorUnderLoad | 与 UI CONTAINER_LAYOUT 一致：正文可滚，标题和动作不溢出视口；长版本换行，技术错误用有限原因码；无长列表 |
| interactionConsistency | TER primitives/ui-state/render；管理后台 §3-K 不适用于本机提示；B 后台 UI 保持已确认标准。不能新建非标准后台弹窗 |

### 2.2 不可见维度（未来观察，不是运行结果）

| 维度 | 最低可证伪观察 |
| --- | --- |
| stateAndPermission | [owner focused] 伪造 taskId/actionId/boot 点击零 native；副机调用 report 被拒，下载只对当前 paired MAIN 发 command |
| navigationAndRefresh | [组件] “稍后”只关闭本次邀请并记录下次 N，不换业务页面；回前台先 actual/action readback 再提醒；旧邀请不能覆盖新任务 |
| collectionShapeAndScale | [focused] 每机器最多一个邀请；单机两屏组件同时挂载也只物理 PRIMARY 可呈现；规则完整集合保留 B 字节预算，邀请不抽干规则列表 |
| dataSourceAndCascade | [focused] store具体门店flush→自身storeBasicInformationLoadedCommand→两个owner listener：store加载合同/服务点，project加载组织再规则；两下游互不等待→feature候选command→update actor。晚装由store重发当前成功command；副机用project-basic两个record投影及当前connection/entry身份资格，失败entry为tombstone，零业务资料HTTP/TDP。本机update selector提供task/actual/presentation，投影不改task/点击/actual；失联未固定资格失效但固定目标不换 |
| forbiddenUI | [静态/组件] 无手工重试、坏包清标记、规则选择、停止固定任务、凭证/grant/本地路径或副机报告入口 |

## 3. 权限、来源与资源模型

TER 无管理后台 capability。安装用户授权由 Android 系统决定；本机提示的可见资格不是授予静默安装权限。CBS 查询/下载沿 B 当前激活主机及项目/门店/工件授权；副机借当前 MAIN 获取临时下载 grant，不得到 credential/deviceSecret，不在 CBS 注册对象。

提示跟随本机 fixed task，而非 MAIN UI 投影。副机在充电显示 LMS 时，该机器物理 PRIMARY 仍承载它自己的升级邀请，不能沿 MAIN 的业务层投影显示主机更新。既有 admin 恢复入口始终可用。

## 4. 正常/等待/失败

| 状态 | 用户观察 | owner 行为 |
| --- | --- | --- |
| prepared FULL＋可呈现 | 安装邀请 | 两动作只操纵本次邀请；安装调用已有 pending-user 恢复同 session；结束后可新 action 的原语 |
| 稍后/系统取消 | 业务界面继续；N 后再邀请 | waiting-user，不标坏包，不手工重试 |
| 已知 pending-user／安装中／UNKNOWN | 已知待用户且确认可恢复可按 N 邀请；正在显示/安装不叠；UNKNOWN 仅回读 | exact Intent 恢复零 commit；仅 ended-not-installed 用户确认后可新 session |
| 后台/系统确认中 | 不出现第二弹窗 | 到期只留 due，前台 readback 后最多一邀请 |
| HOT idle | 不增加必须点击的更新页面 | lastClick＋M 单截止 timer；到期 flush 成功才 apply |
| 技术失败 | 已有错误/最近状态可读 | 保留真实 actual、failedArtifactIds；无自动坏包重入 |
| pair 不兼容 | 既有配对遮罩，本机 admin 可进入 | 禁双机业务/新候选；不伪同步其他 App 业务 |

## 5. 跨文档与继承

规则创建时间排序、FULL 后内嵌启动、固定后不抢占、N/M、main-only 报告以详设 §8 为准；控件文案/容器以 UI §1/4 为唯一源；TestIds 以附件 §5 为唯一表。B 包库与两 Tab 详情原封复用，不将 C 写成第三个后台内容页。

## 6. 完成块

Dexter 2026-10-09 已裁定只允许同 App 配对；不同 App 拒绝，不新增业务模式。全部维度已填写；IA内容已确认，真实UI仍NOT_RUN，A/B 使用范围待 CP-01 核实。所有组件、真实行为、可访问性、F/W/Android/pair/cleanup 为 NOT_RUN。执行面采用 console 真机双屏＋wallpaper mobile 虚拟机＋每 App 同 App 双虚拟机配对（共4设备run）；非adapter两integration Web在前，配对adapter例外按详设§10b.6.1，13c在后。不同App检查只静态/既有focused，无额外设备用例。新增网络接缝属于driver实现计划，不改变已确认邀请控件。本稿只关闭IA内容确认前提，不解除A/B、独立review或执行授权准入。
