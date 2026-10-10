---
title: TER 应用内远程控制 Journey
status: PROPOSED_FOR_DEXTER_CLAUDE_REVIEW
---
# TER 应用内远程控制 Journey

## 1. 裁决元数据
JOURNEY_ID=TER_REMOTE_CONTROL；STATUS=PROPOSED；DECISION_OWNER=Dexter；UI_BEARING=true。
BUSINESS_SOURCE=doc/plans/platform/2026-10-10-ter-remote-control-formal-requirements-claude.md；CORPUS_VERSION=project-memory/decisions/confirmed-business-language-corpus.md；SKILL_USED=cs-spec-to-plan。
DEXTER_WIREFRAME_REVIEW=UNSET；IMPLEMENTATION_AUTHORITY=false。
本次 Dexter 明确要求完整设计包，故提供可评审的技术设计草案；看图及需求 §12.1 技术前置未关闭前，不作为冻结实施输入。

## 2. 用户任务与成功结果
项目管理员不在现场，需要看见指定门店终端的当前应用画面，并用正常点击、拖动、滚动和应用虚拟键盘帮助现场操作。成功是两端显示一致，操作走原业务控件和原 command，关闭后没有遗留远程按压、视频轨道或独占。
操作人先在运营管理后台现有“项目终端版本”内容页右侧“终端更新状态”Tab 查询门店终端；打开终端详情，在“操作→远程控制”发起。后台打开全屏工作区，等待所需全部屏幕，才接受输入；结束或断连后手动重新发起。终端不显示新增提示，不打断本地输入。
失败后仍成立：没有现场授权弹窗；没有自动恢复；副机不成为独立 CBS 终端；普通业务继续使用原 owner。会话结束与本机资源释放结果分别可见。

## 3. 逐 actor 前提链
| 前提 | 对谁 | 需要什么事实 | 来源类型 | 产生/确认位置 | 来源证据 | 未满足时的行为 |
| --- | --- | --- | --- | --- | --- | --- |
| 运营身份 | 项目管理员 | 有效运营会话与当前项目 | ESTABLISHED_SOURCE | 现有登录与项目切换 | operations-admin/src/app；WorkspaceCapabilityScopeResolver | 原登录/无权处理 |
| 远控权限 | 项目管理员 | PROJECT 范围 CONTROL_PROJECT_TERMINAL | IN_SCOPE_PRODUCED | 本批 canonical IAM 与 seed 角色 | 详设 §3/§10b | 不出现可执行动作；HTTP 403 |
| 终端资料 | 项目管理员 | 当前项目启用门店的启用终端 | ESTABLISHED_SOURCE | 既有报告列表与详情 | ProjectTerminalUpdatePage、TerminalUpdateReportOwnerService | 空态或原详情拒绝 |
| 在线资格 | MASTER | 有效绑定与 PG latest session | ESTABLISHED_SOURCE | terminal-binding、terminal-control | TerminalControlPersistence.readActiveBinding/readOnlineSession | 不发离线补发指令 |
| 共享凭证 | MASTER/SLAVE | 阶段 C 收口后的 TDC credential owner | ESTABLISHED_SOURCE | 阶段 C 最终源码准入 | 详设 CP-01；当前阶段 C 尚在实施 | 未收口不开始本批实施 |
| 两屏来源 | 终端扩展 | 同 App 配对身份或同机两个自有 Window | ESTABLISHED_SOURCE | topology/dual-screen | selectTopologyFacts、TerminalSurfaceHostRegistry | 拒绝错误拓扑，不伪造副机 |
| 媒体服务 | 全部参与方 | 同一受信远端主机的 LiveKit、可达 DNS/TLS/RTC | IN_SCOPE_PRODUCED | 本批受管 Compose 与部署接线；具体主机沿用 DEV | 详设 §10b.6；附件 §5 | 在 CP-01 读回配置；无域名/开放端口则报告具体部署输入缺口，不臆造可用服务 |

## 4. 任务边界、非目标与禁推
只操作 TER 自有应用 Window。无音频、录屏、摄像头、系统桌面、无障碍、输入历史、排队接管、重连恢复、协同输入引擎或新终端列表。
不要把 DISPATCHED 解释成业务完成，不把旧 ONLINE 解释成永远可连接，不把 LiveKit JWT 当终端凭证。不把另一个管理员或 Tab 的授权复用到当前会话。主副共享 credential 不代表副机独立连接 TDS。

## 5. Corpus 命中与冲突
| 术语/关系 | 现行 corpus 来源 | 本 Journey 如何使用 | 冲突/未知 | Dexter 裁决是否必要 |
| --- | --- | --- | --- | --- |
| 运营管理后台/运维管理后台 | confirmed-business-language-corpus；AGENTS | 本期只改 operations-admin | 无 | 否 |
| 项目/门店/终端 | corpus 组织关系；正式需求 R-01 | 服务端解析项目下启用门店与终端 | 不用客户端 ref 推权限 | 否 |
| 主机/副机，主屏/副屏 | terminal-coding-standard §4；需求 §1 | instance 角色与视频 screen 分开 | LMS/LSP 是业务内容，不是第二条 CBS 身份 | 否 |
| 读取/写授权 | corpus G-05A；Blueprint GET边界 | 列表/详情/session GET沿原read scope；3运营POST与续约复核live写授权 | 页面/读取不推写权，写capability不收窄GET | 否 |
| 远程控制 | 本需求 §0.3 | 应用内看画面和正常触摸 | 不改为远程调试台 | 已裁定 |

## 6. UI 适用性与后续工件
IA=doc/decisions/2026-10-10-ter-remote-control-ia-claude.md；INTERACTION=doc/decisions/2026-10-10-ter-remote-control-ui-interaction-claude.md。只新增一项列表状态、一项详情动作、一个全屏工作区；不是三个新内容页。终端 UI 不新增任何面。
### 6.1 管理后台交互一致性
业务overlay上限=1：原终端详情Drawer与全屏远控Modal、规则/审计等业务Drawer同层互斥。点击远控时先在当前Drawer执行start并显示菜单loading，HTTP拒绝留在Drawer显示原因；成功且当前context/terminal/本次意图仍有效后，调用原详情关闭cleanup（取消detail/history代次、清详情与分页），关闭Drawer，再打开STARTING Modal。remote请求代次与原detail代次分离，不能因该正常关闭丢掉成功start，也不mirror详情slice；过期start成功只结束它自己的session，不打开工作区。
Modal maskClosable=false；初始焦点放标题或关闭按钮，不自动把键盘焦点交给视频。关闭按钮与Esc走同一workspace owner的禁输入/CANCEL/end/Room cleanup；结束只在原Modal呈现ENDED，重新发起也复用该Modal，不开结果或确认弹层。退出后焦点返回当前项目列表的terminalUpdateTestIds.reportOpen(terminalRef)终端名称Button；原行/项目已失效则返回当前终端更新状态Tab查询Button（reportQuerySubmit），若已离开该页交现有router目标页焦点处理，不聚焦已销毁菜单、不自动重开Drawer。复用原useOverlayLock/close生命周期，不新造dirty或overlay stack。

逐面引用 doc/platform/frontend-coding-standard.md §3-K-1..§3-K-10；列表/Drawer 沿用现成容器；全屏 Modal 是需求 R-02 已指定承载形态，但具体线框仍待 Dexter 确认。无额外 dirty 或关闭 guard。

## 7. Dexter 裁决
产品功能取需求 §0.3 的原话；本包线框 UNSET，技术 T-01～T-04 OPEN。允许本次文档编写和静态评审；未授权实施、依赖、任何运行或部署。
