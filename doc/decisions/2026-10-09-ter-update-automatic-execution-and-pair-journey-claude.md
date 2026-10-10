# TER 更新阶段 C：自动执行与主副机 Journey

## 1. 元数据与授权

- JOURNEY_ID=TER-UPDATE-AUTOMATIC-EXECUTION
- SKILL_USED=NONE；DECISION_OWNER=Dexter；UI_BEARING=true。
- CORPUS_VERSION=project-memory/decisions/confirmed-business-language-corpus.md（当前原文；本轮不修改）。
- STATUS=PROPOSED
- BUSINESS_SOURCE=`doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md` R-06～R-15、§20.5；R-15 以 2026-10-07 后续裁决为准。
- AUTHOR_SESSION=续接作者会话；本稿不是独立 review。
- IMPLEMENTATION_AUTHORITY=false；DEXTER_IA_REVIEW=ACCEPTED@2026-10-09；DEXTER_WIREFRAME_REVIEW=ACCEPTED_IA_CONTENT@2026-10-09。
- Dexter 本轮允许基于尚在实施的 B 编写 C 设计供评审，不授权 C 实施/运行。新增安装邀请的IA内容已获Dexter确认，真实呈现仍NOT_RUN；详设是可评审草案，不是可开工定稿。
- Dexter 2026-10-10 增加职责划分：project-basic 拥有项目/大区/商业集团资料及项目版本规则，承接原 store-basic 组织链和 terminal-update 规则链；feature 选业务候选后发送 terminal-update 公开 local command，由其 actor 最终比较、固定和执行。本机提示交互不变。本次新增职责范围的独立审查与已关闭的旧 C cycle 分开记录，不改旧 verdict。
- Dexter 同日明确顺序：store-basic取得并保存具体门店资料后发自己的storeBasicInformationLoadedCommand；store自己的actor收到它后加载合同/服务点等其余门店资料，project的actor收到同一个command后加载项目/大区/集团，再加载规则。两下游互不等待；广播聚合不是启动store其余资料的前提。晚装只经store公开initialize请其重发当前成功command，不从selector直接首查项目。

- 本轮直接输入：共享凭证提案（PROPOSED）及Dexter“CBS仅凭证鉴权、所有改动纳入C”裁决；正式正本未同步，本差量doc-only、实现/运行NOT_RUN，与已有C实施授权分别记录于详设§0。

## 2. 用户任务与完整旅途

| 任务 | 角色/情境 | 用户动作与业务结果 | owner 与观察 |
| --- | --- | --- | --- |
| 发布项目目标 | 运营管理员已有版本管理权限 | 在 B 既有页面新建、启用规则；终端自动取得完整项目规则 | CBS terminal-update；规则创建时间不随启停改变 |
| 自动更新本机 | 正在使用终端的店员；无另一个更新管理页 | project-basic 取得资料/规则后选适用候选，发送本机 update command；其 actor 核验实际版本并固定、下载；HOT 立即或连续 M 分钟无点击后重载；FULL 下载后邀请安装 | project-basic 数据与业务候选；terminal-update 实际比较及执行，不以目标冒充运行版本 |
| 安装确认与稍后 | FULL 可安装且本机前台 | 点击“安装”；由系统决定静默/确认/权限设置。点击“稍后”或系统取消继续等待，N 分钟后可再次邀请 | 同一个固定任务；不手工重试、不重建未知 installer |
| 两屏协同 | 单机双屏 | 两屏共用一次选择、一个任务；任一屏点击重设同一 M，安装邀请只在本机物理 PRIMARY | Runtime isolated 点击事实；SECONDARY 不重复弹窗 |
| 主副独立 | 同 App 主副已配对，可能处于不同版本 | 主机 project-basic 同步组织资料与全项目规则；副机业务投影就绪后由本机feature发update command；TDC另同步并保存同一plain credential，各机本机TDC直接CBS下载/更新。副机不连接 TDS、不独立激活或上报版本 | project-basic record 投影共享；update 全 isolated，任务/点击/实际版本/路径独立 |
| 断链与版本错开 | 双机失联或 topology 协议不兼容 | 既有业务遮罩阻断业务，本机 admin 可取消配对/换地址；未固定候选不执行；已固定任务不被撤换 | 业务恢复由既有 integration/topology；更新不创建第二业务路由 |
| 查看结果 | 运营管理员 | B 既有同页右 Tab 查询启用门店下启用终端；详情查看实际版本、最新报告及按任务历史 | 主机 CBS HTTP 报告；副机仅本地可读，无服务端副机对象 |

FULL→HOT 必须 FULL→新 APK 内嵌 JS 启动/读回→固定 HOT（仍服从 M）→新 JS 确认。S1 FULL→S2 HOT→S3 确认旧结果可选一条新规则；S3 确认不占执行名额。既有 task.bootId 表示执行 boot，确认保留旧值；不增加第二字段或账本。不能把两个阶段压成一次启动，不能预下载 HOT 后跳过内嵌启动。

## 3. 前提来源与合法路径

| 前提 | 对谁 | 必要事实 | 来源类型（三选一） | 产生/确认位置 | 来源证据（仓根文件＋锚点） | 未满足时 |
| --- | --- | --- | --- | --- | --- | --- |
| A 安装/加载/boot | 本机店员/update owner | 真实安装/加载能力，出口待核实 | ESTABLISHED_SOURCE | 已批准A设计；实施出口仍OPEN | doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md#8；C附件§2 owning source | C开工BLOCKED，不造native成功 |
| B 包/规则/授权/报告 | 运维/运营/update owner | 合法包、创建时间/启用规则、HTTP报告 | ESTABLISHED_SOURCE | B设计来源已建立，B实现验收仍OPEN | doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md#8；C详设§0.1 | 待B出口，不另造后台 |
| 运维写身份 | 运维管理员 | 已登录同集团空间、有包维护资格 | ESTABLISHED_SOURCE | B既有运维session/managed account reader | B详设§15.2/§10b；C详设§10b.3 | 缺权限拒绝，不能用运营session代替 |
| 运营写身份 | 运营管理员 | r5-account-multi-role，GROUP任职＋PROJECT节点，MANAGE_PROJECT_TERMINAL_VERSION与页面权限 | ESTABLISHED_SOURCE | B合法账号/session/capability链 | B详设§15.2；apps/frontend/operations-admin/src/features/terminal-update/ui/ProjectTerminalUpdatePage.tsx；C详设§10b.3 | STORE上下文不能写项目规则；拒绝越权 |
| 终端/门店前提 | 主机/副机 feature | MAIN TDC active/current store；BRANCH当前非秘密门店投影 | ESTABLISHED_SOURCE | TDC/store-basic/topology公开selectors；当前周期门店flush或当前connection投影资格 | C附件§2/§2.1；C详设§8.0/8.6 | 不用hydrated数据冒充当前加载；副机不独立激活 |
| 项目组织与版本规则 | 本机 project-basic | 当前具体门店成功command、组织路径与完整规则/hash，分开于门店正文和本机task | IN_SCOPE_PRODUCED | C CP-01：store具体资料flush→自身成功command；store和project两个listener分别加载门店其余资料与组织/规则；候选selector桥→feature actor→update公开command | C详设§8.0/8.1；附件§2.1 | 门店失败零下游首查；组织失败不挡store合同/服务点；不循环依赖；失败entry投影tombstone，已fixed目标保持 |
| 同App双机更新 | 已配对两机 | 原同module/protocol资格、本机版本、project-basic组织/规则投影、已保存共享TDC credential和直接CBS grant | IN_SCOPE_PRODUCED | C CP-04，project-basic record＋TDC credential-only record/flush，副机本机TDC CBS command；升级请求始终local | C详设§8.6–8.7；当前topology pairByHost/HELLO见附件§2 | 不同App拒绝；原本机admin恢复 |
| 验收设备/配对通路 | 验收操作者 | console 真机双屏、wallpaper mobile 虚拟机；每 App 两安卓虚拟机配对，共4设备run；API≥29、显式serial；run-owned forward/reverse | IN_SCOPE_PRODUCED | C CP-01能力准入、CP-05 driver 接线；非adapter两integration Web在前 | C详设§10b.6/10b.6.1、计划§10 | 能力缺口停CP-01，不换方案/减分母；本轮Claude不执行；review无阻断后按Dexter委托由Codex继续C |
| DEV/fixture | 验收操作者 | r5-full既有账号/终端key与受管入口 | ESTABLISHED_SOURCE | 未来另获动态授权后按B最终入口取数据 | doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json#stableFixtures；C详设§10b | 无本轮reset/seed/DEV权限，不能隐含执行 |
| 新邀请线框 | 本机店员/Dexter | 本机PRIMARY两个动作及显示时机已确认 | EXTERNAL_PREREQUISITE_DEXTER_DECISION | 本包UI§4；Dexter本轮确认IA内容，未证明真实呈现 | doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-ui-interaction-claude.md#4 | IA内容前提已确认；实施仍须设计review和单独授权 |

ESTABLISHED_SOURCE 说明原始设计/已有来源可定位，**不声称A/B已验收**；相关出口仍在C实施准入逐项核实。初始起草只授权草案；当前Codex的阶段C委托见详设§0，本会话Claude仍只写文档。

## 4. 边界、非目标与禁推

范围是 C project-basic组织/规则数据归属、公开command→update actor、N/M、project-basic投影和全链收敛。feature→base单向依赖；store-basic不反向依赖project-basic，base不import feature；integration只装配纯selector身份复核，不编排业务。固定task.target保留已接受执行事实，不是第二规则缓存。不增加包库/规则编辑、用途维度、灰度、等待上限、任务看板、手工重试、管理员撤回固定任务、通用恢复框架、第二任务账本、后台闹钟或系统级输入监控。

固定后停用/新规则不抢占；无期限等待可能一直挡住后续规则，这是已接受产品后果。权限失效不等于允许越权继续下载。已准备的本机任务依当前固定执行/平台事实续接，不把断链推成失败或取消。

## 5. Corpus 来源与冲突

| 术语/关系 | 来源 | 使用/未知 |
| --- | --- | --- |
| 运维管理后台 / 运营管理后台 | confirmed-business-language-corpus G-01/G-02、AGENTS | 前者包库，后者项目规则和报告；不互换 |
| 项目→门店→终端 | 同 corpus、B Journey | 未把更新范围反推新的组织关系；仅 ENABLED 门店/终端的报告展示 |
| TDP/TDS/TDC | terminal-coding-standard §4-F | 两机TDC以同一credential直调CBS，TDS仅主机通知；CBS不按deviceId鉴权；不新增报告 WS 帧 |
| MAIN/BRANCH、MASTER/SLAVE、PRIMARY/SECONDARY | terminal-coding-standard §4-E、topology 源码 | 不把业务 LMP/LMS/LSP 当物理屏幕/本机身份 |
| FULL/HOT、N/M | 正式需求 R-06/11/12，B 后续裁决 | N/M 管理 UI 分钟、API 秒；固定后仍同策略 |
| 历史报告 | 正式需求 R-15 后续裁决 | 覆盖 §20.5 中旧“无历史”措辞；每任务一行，不建状态流水 |

## 6. UI 适用性与工件

UI_BEARING=true，新增本机安装邀请；原生 installer/Settings/失败文本沿 A 工件。IA、UI 同前缀 `2026-10-09-ter-update-automatic-execution-and-pair-`。两后台不新增页面、Drawer 或按钮，复用 B 的已确认承载形态、foundation 与 TestIds。TER 邀请复用 ui-state/render/primitives，不套用管理后台 AntD Drawer。

## 7. Dexter 裁决与完成条件

已有语义取自正式需求；本稿未新增等待上限/主动降级/副机上报。Dexter本轮确认IA内容及其“安装 / 稍后”设计；真实用户可见呈现未运行。Dexter 2026-10-09 已明确不同 App 不可配对，覆盖 R-07 旧句且本轮不改需求正本。外部 Claude 已评旧 SHA 为 GO_WITH_UNVERIFIED_UI 0M/0S/5N，本次按其输入作作者修订，不新增内部轮次，不继承为当前字节 verdict。A/B 出口、C 设计 review、新 UI 确认和单独实施/动态授权共同构成后续准入；本次只允许文档交付。
