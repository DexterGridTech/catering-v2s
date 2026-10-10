---
title: TER 应用内远程控制 IA
status: PROPOSED_FOR_DEXTER_CLAUDE_REVIEW
---
# TER 应用内远程控制 IA

## 1. 元数据
IA_SCOPE=REMOTE-LIST,REMOTE-DETAIL,REMOTE-WORKSPACE；BUSINESS_SOURCE=doc/plans/platform/2026-10-10-ter-remote-control-formal-requirements-claude.md；JOURNEY_REFS=doc/decisions/2026-10-10-ter-remote-control-journey-claude.md；UI_INTERACTION_REF=doc/decisions/2026-10-10-ter-remote-control-ui-interaction-claude.md；IMPLEMENTATION_DESIGN_REF=doc/plans/platform/2026-10-10-ter-remote-control-implementation-design-claude.md。
DEXTER_WIREFRAME_REVIEW=UNSET；IMPLEMENTATION_AUTHORITY=false。三项为既有内容 Tab、既有 Drawer、一个新 Modal 的交互面。

## 2. 维度
### 2.1 可见维度
| 维度 | REMOTE-LIST | REMOTE-DETAIL | REMOTE-WORKSPACE |
| --- | --- | --- | --- |
| businessTask | 找到可协助的终端 | 对指定终端发起协助 | 看画面并正常操作应用 |
| actorAndScenario | 当前项目管理员查询门店终端 | 有远控权限的管理员 | 发起会话的同一管理员/Tab |
| entryAndSurface | 原项目终端版本页右侧终端更新状态 Tab | 原终端可点击名称打开 Drawer | Drawer“操作→远程控制”打开全屏 Modal |
| controlType | ProTable、既有查询/分页，新增连接状态 Tag | AdminDetailActionMenu 一项动作；原报告/历史不动 | Modal、两个 VideoTrack 容器、状态文本、结束/关闭/重新发起 Button |
| validationAndError | 四种状态带文字；读取失败禁旧动作 | 非在线禁用给理由；点击 CBS 拒绝显示准确提示 | STARTING 无输入；ACTIVE 全部画面就绪才能输入；ENDED 显示原因 |
| accessibilityAndTestId | 状态不只颜色；沿用终端名称入口 | 菜单键盘可达；禁用理由可阅读 | 每屏 label；结束与关闭键盘可达；焦点圈；指针区域不模拟按钮 |
| emptyLoadingErrorStates | 复用既有空态/加载/错误；不另建空表 | 上下文变化清旧详情；失败不保留可执行旧目标 | 连接中显示占位；没有全屏就绪不输入；失败保留结束文字，不保留可点旧帧 |
| containerBehaviorUnderLoad | 原列宽与分页，不客户端 slice；长状态换行 | 原 adminDrawerSurfaceProps，正文单段滚动 | 满视口；标题/按钮不滚；中间媒体区唯一滚动；窄窗上下排列；视频黑边不接收DOWN |
| interactionConsistency | §3-K-1..10：原列表/分页/空态形态 | §3-K-1..10：原详情标题/动作菜单；非编辑无需保存 | §3-K-1..10：全屏承载为已指定形态；未增加表单和生命周期颜色 |

### 2.2 不可见维度与可执行观察
| 维度 | 观察、档位与适用面 |
| --- | --- |
| stateAndPermission | backend-acceptance：无 CONTROL_PROJECT_TERMINAL 者3个运营POST拒绝；GET沿session/context/页面/角色PROJECT读取范围及本session发起账号、terminal归属，不附写capability、不含token。撤销写权后原读scope仍有效可读本次结束事实；其他项目/发起者不能领grant；重复start前仍live授权；列表读取保留原读权限 |
| navigationAndRefresh | 组件 focused：关闭/项目变更先禁输入并结束当前 session；只刷新当前终端的列表/Drawer，规则 Tab 不发重取；晚到旧 session 响应不覆盖新目标 |
| collectionShapeAndScale | backend-acceptance：终端列表沿原 cursor/page 契约；50+1 个终端跨页；每页连接事实为一次集合 join，无逐终端 SQL；工作区固定1或2屏，与终端数量无关 |
| dataSourceAndCascade | focused：binding、TDP session、配置 revision、Window 或配对改变，各自结束原会话；新手动发起重建身份；描述登记后不可更换 peer |
| forbiddenUI | 静态/组件：无音频、录像、终端新增指示、参数输入、system control、占用常驻列、自动恢复按钮；可搜索无 token 渲染/持久化 |

### 2.1.1 容器负载分工
IA 决定固定屏数与排序主→副；交互工件决定容器、唯一滚动与视频 letterbox。两者不通过增加截断分页来逃避普通两个屏幕。

## 3. 共用规则
业务overlay上限=1：原终端详情Drawer与全屏远控Modal、规则/审计等业务Drawer同层互斥。点击远控时先在当前Drawer执行start并显示菜单loading，HTTP拒绝留在Drawer显示原因；成功且当前context/terminal/本次意图仍有效后，调用原详情关闭cleanup（取消detail/history代次、清详情与分页），关闭Drawer，再打开STARTING Modal。remote请求代次与原detail代次分离，不能因该正常关闭丢掉成功start，也不mirror详情slice；过期start成功只结束它自己的session，不打开工作区。
Modal maskClosable=false；初始焦点放标题或关闭按钮，不自动把键盘焦点交给视频。关闭按钮与Esc走同一workspace owner的禁输入/CANCEL/end/Room cleanup；结束只在原Modal呈现ENDED，重新发起也复用该Modal，不开结果或确认弹层。退出后焦点返回当前项目列表的terminalUpdateTestIds.reportOpen(terminalRef)终端名称Button；原行/项目已失效则返回当前终端更新状态Tab查询Button（reportQuerySubmit），若已离开该页交现有router目标页焦点处理，不聚焦已销毁菜单、不自动重开Drawer。复用原useOverlayLock/close生命周期，不新造dirty或overlay stack。

唯一远控权属于本 session controllerIdentity，而非“同管理员所有 Tab”。HTTP 权限仍是服务端事实。浏览器不 mirror 终端业务 state，媒体/描述只保留当前会话内存。列表连接事实时间为 observedAt/evaluatedAt，不称“绝对实时”。

## 4. 错误语义与界面映射
拒绝、结束、输入原因闭集取需求 R-20；全量中文映射见交互 §5，不另造 error enum。授权拒绝用现有 typed problem 呈现；占用点击后显示“当前机器已经受控”。启动失败显示“连接失败，请重新发起”；断连显示“连接已断开，请重新发起”。释放失败保留“远程控制已结束，资源释放失败”，不能以关闭 Modal 掩盖。

## 5. 交叉对账
| 事实 | IA | 交互 | 详设 |
| --- | --- | --- | --- |
| 在线 | 原项目终端报告 Tab，加四态 | LIST 文案 | PG 集合读取，不加超时公式 |
| 权限 | PROJECT 范围 CONTROL_PROJECT_TERMINAL | DETAIL 动作可见/禁用 | 3运营POST每次写grant；1GET按原read scope＋本session发起者，不附写capability |
| 两屏 | 冻结描述main/secondary，不按到达顺序 | WORKSPACE 两媒体槽 | stream/endpoint/trackSid 校验 |
| 结束 | 无自动恢复，先禁输入 | 原位结束原因与手动再发起 | 三方清理+MASTER有限lease |
| 刷新 | 当前终端列表和详情 | 不刷规则 Tab | 用原刷新生命周期及请求代次 |

## 6. 完成判定
模板槽位已填写，仅静态文档完成；DEXTER_WIREFRAME_REVIEW=UNSET，T-01～T-04 OPEN，所有实现和运行 NOT_RUN。未以设计表格代替独立审查或 UI 接受。
