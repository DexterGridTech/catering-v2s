---
title: TER 应用内远程控制交互设计
status: PROPOSED_FOR_DEXTER_CLAUDE_REVIEW
---
# TER 应用内远程控制交互设计

## 1. 元数据
JOURNEY_REFS=doc/decisions/2026-10-10-ter-remote-control-journey-claude.md；IA_REF=doc/decisions/2026-10-10-ter-remote-control-ia-claude.md；BUSINESS_SOURCE=doc/plans/platform/2026-10-10-ter-remote-control-formal-requirements-claude.md；BUSINESS_PROBLEM=远处管理员协助现场操作；BUSINESS_USER_OR_OWNER=项目管理员；CURRENT_TASK=选择终端并应用内远程控制；SUCCESS_OUTCOME=看到原画面、正常操作、结束后释放；UI_BEARING=true；SKILL_USED=cs-spec-to-plan；CONSUMER_FACE=operations-admin。
DEXTER_WIREFRAME_REVIEW=UNSET；DEXTER_HIFI_REVIEW=NOT_REQUIRED。终端屏幕不新增 UI。

## 1.1 UI 详设强制声明
| 项 | REMOTE-LIST | REMOTE-DETAIL | REMOTE-WORKSPACE |
| --- | --- | --- | --- |
| CONSUMER_FACE | operations-admin | operations-admin | operations-admin |
| UI_SURFACE | 内容 Tab | Drawer | Modal |
| HOST_AND_ENTRY | ProjectTerminalUpdatePage右Tab | 原终端详情 | 详情操作→远程控制 |
| ACTOR | 项目管理员 | 有远控权的项目管理员 | 本会话发起者 |
| BUSINESS_SCENARIO | 门店终端查询 | 查看单终端 | 在线协助现场 |
| BUSINESS_GOAL | 识别在线终端 | 发起远控 | 看与操作，结束 |
| USER_VISIBLE_COPY | 门店、终端、终端版本、最新升级报告状态、连接状态；未激活/离线/状态待确认/在线 | 原详情标题；操作、远程控制；终端未激活/终端离线/连接状态待确认 | 远程控制 · 〈门店名〉 / 〈终端名〉；主屏、副屏；正在连接终端；结束远程控制；关闭；重新发起 |
| TECHNICAL_BOUNDARY | PG最新连接事实 | 新PROJECT capability | session/endpoint/stream/track；不显示技术身份 |
| FOUNDATION_PRIMITIVE | CursorPagination、usePageQuery、createRefreshSignal、testId | useDetailDrawer、adminDrawerSurfaceProps、AdminDetailActionMenu、useOverlayLock、testId | useOverlayLock、createAsyncGenerationGuard、testId；无现成全屏媒体容器，用antd Modal呈现领域内容 |
| CONTAINER_LAYOUT | 原ProTable列与分页；只表体滚动，不加第二祖先滚动 | 原Drawer宽高，header不滚，正文单段滚动 | Modal外框100vw×100dvh、top=0、margin=0，标题/按钮固定；媒体区min-height:0独立overflow:auto；≥960px两等宽列，<960px一列；每slot视频object-fit:contain，不溢出视口 |

## 1.2 管理后台一致性
| screen | §3-K适用 | 承载形态例外 | 逐控件观察 |
| --- | --- | --- | --- |
| REMOTE-LIST | doc/platform/frontend-coding-standard.md §3-K-1..§3-K-10 | NONE | 原查询、列表、分页，状态文字+Tag；首列/原可点击终端名保持现状，不改既有表格治理 |
| REMOTE-DETAIL | 同上§3-K-1..10 | NONE | 原对象标题 · 终端更新状态详情；动作进AdminDetailActionMenu，不extra堆按钮；无dirty表单 |
| REMOTE-WORKSPACE | 同上§3-K-1..10 | 需求R-02明确全屏Modal，尚待具体线框确认 | 普通按钮，禁用输入解释；结束反馈与键盘关闭；状态不用五种业务生命周期颜色；不引入会议工具栏 |

## 1.2.1 Mutation字段事实（没有新业务资料编辑表单）
FORM_MUTATION_DENOMINATOR=发起start、领取controller-grant、结束end、重新发起new start、视频单指POINTER。每variant复用下列事实来源；无隐藏input伪造scope，没有为本包增加另一个表单。
| command事实 | 控件/分类 | 原始来源 | request唯一取值 | 校验与owner复核 | 失败恢复 |
| --- | --- | --- | --- | --- | --- |
| projectRef/terminalRef | 原终端标题；HIDDEN_OWNER_FACT（start/grant/end/read路径） | R-01/06，当前context＋latest detail | context.projectRef/当前detail.terminalRef，不取旧row构造授权 | CBS终端→store→project和当前role scope | 旧context禁用/清详情，重读后新发起 |
| requestId | 不显示；HIDDEN_OWNER_FACT（start/restart） | R-06 | 手动意图生成UUID；同次网络未知仅复用该id | auth先于同target幂等；重发起新id | 不自动创建第二session |
| sessionId | 不显示；HIDDEN_OWNER_FACT（grant/end/POINTER） | R-07 start响应 | 当前会话；与path/envelope一致 | CBS/remote actor当前identity | 旧响应不提交后继会话 |
| reason | 结束/关闭按钮；HIDDEN_OWNER_FACT（end） | R-07 | end→ADMIN_ENDED；close/navigation→WORKSPACE_CLOSED；不让用户输入 | CBS有限闭集、当前发起者/写grant | 本地先禁输入/清理；CBS写失败按既定lease结束 |
| endpointId/screen/streamId | 主屏/副屏标签；HIDDEN_OWNER_FACT（POINTER） | R-10/14 | 当前description＋已接受SCREEN_READY和实际track匹配 | native当前window/stream，SDK实际sender | 未ready/几何变化禁旧输入，不自行猜目标 |
| gestureId/phase/u/v/seq | video PointerEvent；EDITABLE仅正常手势坐标 | R-13/15 | 当前pointer连续单gesture、内容矩形归一、全sender seq | codec/actor/native边界、gesture/mapping一致 | offbounds/冲突CANCEL；无结果结束，不补发输入 |
| token/url | 不显示；HIDDEN_OWNER_FACT（connect能力） | R-07 controller grant | HTTP响应仅给当前SDKRoom闭包，不入用户command正文/state | CBS签发当前identity；TERURL只server-config | 失败结束本次，不新增秘密输入 |

## 1.3 原查询的搜索分母与控件依赖（保留原业务行为）
SEARCH_CAPABILITY_DENOMINATOR：REMOTE-LIST=APPLICABLE，查当前项目终端；REMOTE-DETAIL=NOT_APPLICABLE_WITH_REASON（只读最新详情和既有历史分页，本批无新增搜索）；REMOTE-WORKSPACE=NOT_APPLICABLE_WITH_REASON（仅当前会话媒体/输入，非对象查找）。新增连接状态列不成为筛选项，升级报告状态/接收时间保持原search:false。
真实source：ProjectTerminalUpdatePage#reportColumns（609起）、useOrganizationCandidates、TerminalUpdateReportPersistence#page/#addNameFilter/#addJsonFilter。五条件均经现有getOperationsProjectTerminalVersionPage服务端过滤；原opaque cursor由全部applied filters+context固定身份，无total时不捏造页数。
| screen/业务对象/任务 | 条件文案 | 匹配语义/控件 | 值或候选唯一来源 | 依赖、清理和重读 | request/owner核验 | 合适性与排除替代 | 缺口/本批处置 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| LIST/终端/找到现场设备 | 终端 | 名称不区分大小写contains；原Input | 用户填写queryText；owner SQL strpos(lower(terminal_name),lower(?)) | 当前PROJECT；显式查询才更新applied，reset清空/pager；context变更清旧结果 | 原page queryText＋启用store/terminal项目scope | 不把已加载行过滤当搜索 | 原source具备，保留 |
| LIST/门店/缩小设备范围 | 门店 | searchable Select；storeRef精确 | useOrganizationCandidates→getOperationsOrganizationCandidates，subjectType=STORE，projectId=currentProject；items.id/name/code | 原open tab、debounced query/page及onPopupScroll加载；项目变化取消旧候选、清已选store和cursor | 服务端候选及page精确storeRef，scope最终由owner核 | 不从当前终端rows拼本地门店候选 | 原consumer/owner adapter保留，不新候选API |
| LIST/终端/定位APK版本 | 实际 APK | exact string；原Input | 用户currentApkVersion | PROJECT/applied filters；查询/重置清cursor | owner actual->>'apkVersion'精确相等 | 无受批版本词表，不新造Select | 保留 |
| LIST/终端/定位JS版本 | 实际 JS | exact string；原Input | 用户currentJsVersion | 同上，五条件互不作为上下游 | owner actual->>'jsVersion'精确相等 | 不做数字大小排序/范围猜测 | 保留 |
| LIST/终端/定位兼容环境 | Runtime | exact string；原Input | 用户runtimeVersion | 同上 | owner actual->>'runtimeVersion'精确相等 | 不把SDK/runtime推新业务类型 | 保留 |

| 用户可见控件 | 控件/搜索方式 | owner候选或初始值 | 上游与可用条件 | 级联清理/重载 | 可选项约束 | loading/empty/failed | 提交owner再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 终端/实际APK/实际JS/Runtime | 上表四个Input | 原表单初始空值/当前用户值 | 无字段间依赖；依赖有效PROJECT context | 显式查询五条件整体提交；reset全部清空；context清旧结果、cursor、可执行详情 | 沿原query长度/格式contract，无新增字段 | 原ProTable加载/空/错误；错误不保留旧目标供远控 | 原page scope/五谓词/cursor身份 |
| 门店 | 原searchable Select | 上表owner-returned STORE候选；初始未选 | 有效PROJECT、reports Tab open；不依赖另四文本字段 | 变化后query提交才applied；PROJECT变清选值、候选、cursor与详情 | 仅接口返回当前project STORE ref | 原helper loading/empty/error，不伪枚举 | candidate owner及page再次核scope/store归属 |
| 视频指针 | 当前video PointerEvent，不是业务资料表单 | 当前SCREEN_READY/实际track＋手势 | ACTIVE、全部required画面ready、当前geometry/stream | 几何/断链/结束立即CANCEL并失效旧gesture | normalized u/v；黑边不DOWN，单指 | NOT_READY禁输入；失败结束 | remote actor/native当前mapping/身份；原控件own business command |

## 1.4 弹层互斥与焦点生命周期
业务overlay上限=1：原终端详情Drawer与全屏远控Modal、规则/审计等业务Drawer同层互斥。点击远控时先在当前Drawer执行start并显示菜单loading，HTTP拒绝留在Drawer显示原因；成功且当前context/terminal/本次意图仍有效后，调用原详情关闭cleanup（取消detail/history代次、清详情与分页），关闭Drawer，再打开STARTING Modal。remote请求代次与原detail代次分离，不能因该正常关闭丢掉成功start，也不mirror详情slice；过期start成功只结束它自己的session，不打开工作区。
Modal maskClosable=false；初始焦点放标题或关闭按钮，不自动把键盘焦点交给视频。关闭按钮与Esc走同一workspace owner的禁输入/CANCEL/end/Room cleanup；结束只在原Modal呈现ENDED，重新发起也复用该Modal，不开结果或确认弹层。退出后焦点返回当前项目列表的terminalUpdateTestIds.reportOpen(terminalRef)终端名称Button；原行/项目已失效则返回当前终端更新状态Tab查询Button（reportQuerySubmit），若已离开该页交现有router目标页焦点处理，不聚焦已销毁菜单、不自动重开Drawer。复用原useOverlayLock/close生命周期，不新造dirty或overlay stack。

## 2. Interaction map
| 起点 | 动作 | 去向 | 请求/行为 | 数据影响 |
| --- | --- | --- | --- | --- |
| 原终端Tab | 查询/点终端名称 | 原Drawer | 原page/detail查询+连接事实 | 无写 |
| Drawer | 操作→远程控制 | start成功后先关Drawer，再开工作区STARTING | 拒绝留原Drawer；成功后最多30s状态等待再grant | CBS独占+TDP在线command；业务overlay上限1 |
| 工作区ACTIVE | 点击/拖动主或副屏 | 原位 | 指向目标endpoint的POINTER | 正常TER控件自己的command |
| 工作区 | 结束/关闭 | ENDED/退出 | 本地先禁输入、CANCEL、end HTTP、Room disconnect | 释放当前独占/媒体 |
| ENDED | 重新发起 | 新STARTING | 新request/session；复核当前在线和权限 | 不恢复旧流 |

## 3. Heritage 与当前来源盘点
该功能在冻结Heritage中没有现成LiveKit远控页面，不能搬运不存在的页面。当前列表/Drawer必须显式复用本仓ProjectTerminalUpdatePage和foundation，只有工作区是新领域面。实施CP-01再次核对冻结asset manifest，若发现真正同任务页面，按搬运优先原则调整基线，不连接Heritage runtime。

## 4. 三个交互面线框与 testId
### REMOTE-LIST：现有内容Tab内的列表（不是新页面）
```text
[现有门店/版本查询条件]                 [查询] [重置]
门店    终端(原详情入口)    终端版本    最新升级报告状态    连接状态
门店A   收银终端01          原版本      原报告              在线
                                            [原分页]
```
新增状态 testId见附件§4常量 onlineStatus(terminalRef)；原查询/表行/详情入口继续原terminalUpdateTestIds。
### REMOTE-DETAIL：原终端详情Drawer
```text
收银终端01 · 终端更新状态详情                   [操作 v] [关闭]
[原门店、终端、版本、最近升级报告与历史内容]
```
“操作”菜单包含“远程控制”，对应 start(terminalRef)。已知不可用禁用并说明；无权不呈现可执行项；占用只点击后反馈。
### REMOTE-WORKSPACE：一个全屏Modal的三种状态
```text
远程控制 · 门店A / 收银终端01                 [结束远程控制] [关闭]
正在连接终端
┌──────────────主屏──────────────┬──────────────副屏──────────────┐
│ 待连接 / 当前视频              │ 待连接 / 当前视频              │
│ 黑边不接受点击                 │ 黑边不接受点击                 │
└───────────────────────────────┴───────────────────────────────┘
[连接失败/断开/资源释放失败的中文结果]            [重新发起] [关闭]
```
单屏隐藏整个副屏slot；不占第二个空视频。ACTIVE隐藏连接中文和重新发起；ENDED保留静态结束提示，视频不能继续操作；不是另开结果Modal。线框最后一行是ENDED状态，非ACTIVE常驻提示。
控件detailActions、start、workArea、screen(main|secondary)、end、close、restart、status见附件§4唯一常量表。全屏外框/header永不超视口；窄窗媒体上下排列；只有媒体区允许滚动。收到几何改变，取消旧gesture并暂时关闭相应输入，重新声明+当前帧后恢复，不显示新业务遮罩。

### 4.1 实施控件roster与逐动作表
逐动作九列、L2 binding与测试控制文件唯一正文为附件§4a/§4b；本表只声明本交互面真实节点，不复制常量值。全部新增source、挂载与focused仍NOT_RUN，UI_DESIGN_REVIEW/TESTID_REVIEW=OPEN，不据线框标PASS。
| 控件键 | testId | 所在真实动作节点 | 是否COMPOSITE_OPTION_ANCHOR |
| --- | --- | --- | --- |
| reportsTab | terminalUpdateTestIds.reportsTabLabel | 原Tab label span | 是，已有同一Tab点击语义 |
| queryText/querySubmit/queryReset | terminalUpdateTestIds.reportQuery/reportQuerySubmit/reportQueryReset | Input真实input/两个Button；reset仅同值迁入常量 | 否 |
| previous/next | terminalUpdateTestIds.reportPagination派生两个后缀 | CursorPagination真实Button | 否 |
| openTerminal | terminalUpdateTestIds.reportOpen(terminalRef) | 原终端名称Button | 否 |
| online | remoteControlTestIds.onlineStatus(terminalRef) | Tag/文本，仅观察 | 否 |
| detailActions | remoteControlTestIds.detailActions(terminalRef) | 原terminal Drawer的AdminDetailActionMenu Button | 否 |
| start | remoteControlTestIds.start(terminalRef) | AdminDetailActionLabel真实菜单anchor | 是，foundation明确支持，不是祖先wrapper |
| main/secondary | remoteControlTestIds.screen(slot) | VideoTrack的真实video或精确同矩形输入层，CP04 focused固定一种 | 否 |
| end/close/restart | remoteControlTestIds.end/close/restart | 三个各自Button | 否 |
| status/workArea | remoteControlTestIds.status/workArea | 状态文本/媒体容器，仅观察 | 否 |

### Surface ownership roster
| surface | 可见成员 | 归属 | 文案位置 | 静态结论 |
| --- | --- | --- | --- | --- |
| LIST | 查询、表列、分页 | 原内容Tab | 列头与状态列 | 已声明，未渲染 |
| DETAIL | 标题、原详情、操作/关闭 | 原Drawer | header菜单 | 已声明，未渲染 |
| WORKSPACE | 标题、状态、媒体slot、结束/关闭/重发 | 当前Modal | header/媒体/ENDED区域 | 已声明，未渲染 |

## 5. 状态、边界与全量文案
| 原因集合（需求R-20全部成员） | 可见文案/处理 |
| --- | --- |
| PERMISSION_DENIED/AUTHORIZATION_INVALID | 无远程控制权限；服务端拒绝后停止，按原权限错误形态 |
| OUT_OF_SCOPE | 此终端不在当前项目可操作范围 |
| NOT_ACTIVATED/ACTIVATION_INVALID | 终端未激活或激活已失效 |
| TERMINAL_OFFLINE/TDP_DISCONNECTED | 终端离线，请重新发起 |
| CONNECTION_UNCONFIRMED | 连接状态待确认，请刷新后重试 |
| OCCUPIED | 当前机器已经受控 |
| IDENTITY_CONFLICT | 本次操作信息已改变，请重新发起 |
| SERVICE_UNAVAILABLE/START_FAILED | 连接失败，请重新发起 |
| UNSUPPORTED_TERMINAL | 当前终端不支持应用内远程控制 |
| NOT_READY | 正在连接终端（30s内；超时走下一项） |
| START_TIMEOUT | 连接超时，请重新发起 |
| ADMIN_ENDED/WORKSPACE_CLOSED | 远程控制已结束 |
| CONTROLLER_DISCONNECTED/SCREEN_DISCONNECTED/PAIR_DISCONNECTED | 连接已断开，请重新发起 |
| CONFIG_CHANGED/APP_RESTARTED/LEASE_EXPIRED | 终端连接条件已改变，请重新发起 |
| CAPTURE_FAILED | 无法获取应用画面，请重新发起 |
| INPUT_RESULT_UNKNOWN/INPUT_UNAVAILABLE | 无法确认操作结果，远程控制已结束 |
| UNSUPPORTED_PROTOCOL | 当前版本不支持远程控制，请更新后重新发起 |
| 输入 SESSION_ENDED/STALE_STREAM/WRONG_TARGET/INVALID_MESSAGE/OUT_OF_BOUNDS/INVALID_GESTURE/DUPLICATE | 不执行；旧输入/错目标不重发；诊断有限码，UI不逐move弹Toast |
| 输入 INPUT_CONFLICT/GESTURE_EXPIRED | 已取消本次拖动，请重新操作（单gesture反馈，非会话失败） |
| 输入 UNSUPPORTED_SURFACE | 当前界面不支持应用内远程控制；停止该面输入 |
| cleanup失败（资源事实，非协议新原因） | 远程控制已结束，资源释放失败；保留可见诊断 |

## 6. 逐操作任务合理性
| 操作 | Journey来源 | 此时为何操作 | 是否有更短路径 | 不选替代理由 | 约束归因 | Dexter裁决必要 |
| --- | --- | --- | --- | --- | --- | --- |
| 选择终端更新状态Tab | Journey§2/原版本报告任务 | 进入现有终端清单 | 已有入口最短 | 不另建远控目录 | 现有页面/需求R01 | 否 |
| 五条件填写/选择、查询 | Journey§2找到终端 | 按门店/版本缩小现有清单 | 无相同scope的更短合法来源 | 不新搜索、客户端筛选或反推scope | 原page与owner查询 | 否 |
| 重置 | 同上/原列表行为 | 返回当前项目全部合格终端 | 一个原Button | 不加全局刷新或新重置 | 原ProTable查询 | 否 |
| 上一页/下一页 | 同上 | 访问当前查询的其余终端 | 原CursorPagination | 不下载全量/捏造页数 | owner cursor | 否 |
| 终端名称→详情、关闭详情 | Journey§2/§6.1 | 核对当前目标，退出查看 | 原名称Button/Drawer close | 无行内远控/重复详情 | 原列表/Drawer规范 | 否 |
| 操作菜单→远程控制 | Journey§2/§6.1 | 对已核对且在线目标发起协助 | 当前详情动作最短 | 占用点击后判，不加排队接管 | R02/06及新写capability | 否 |
| 主/副屏点击拖动与虚拟键盘 | Journey§2正常协助 | 看画面后操作原业务 | 原视频区域正常pointer | 不用后台业务command/automation旁路 | R13～16、原feature owner | 否 |
| 结束远程控制 | Journey§2结束 | 停止帮助并释放会话，原位查看结果 | header常驻Button | 不开第二确认或结果Modal | R07/17 | 否 |
| 关闭/Esc | Journey§6.1 | 退出工作区，清理和归还焦点 | 同一个owner close | 不保留隐藏会话/第二dirtyguard | overlay与R17 | 否 |
| 重新发起 | Journey§2失败恢复 | 断连后主动取得新session | ENDED原Modal内Button | 禁止自动重连/重放输入 | Dexter裁决/R17 | 否 |


## 7. Face/owner
列表/详情由terminal-update既有读面+terminal-control显式连接join；start/read/grant/end由terminal-control；视频和pointer是当前会话领域内容；TER正常业务由原feature，不归remote-control。

## 8. 冻结与复用
Heritage只作来源盘点；不修改冻结资产，不引入外部fallback。foundation逐项复用列在§1.1，唯一新增容器是本域全屏媒体内容，不发布泛化video-shell框架。

## 9. 可选静态原型
N/A：本次ASCII低保真供Dexter确认，不另建可执行原型或假数据运行。

## 10. 看图与未验证
DEXTER_WIREFRAME_REVIEW=UNSET；真实列表、Modal、视频映射和触摸结果全部NOT_RUN。接受需求功能不等于接受这份线框；独立静态GO不等于UI通过。
