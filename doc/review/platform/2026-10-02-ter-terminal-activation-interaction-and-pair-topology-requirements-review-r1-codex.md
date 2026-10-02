# TER 激活交互与双机拓扑正式需求 · 第一轮独立对抗审查

## 元数据与 verdict

- REVIEW_CYCLE_ID：TER_ACTIVATION_INTERACTION_PAIR_TOPOLOGY_REQUIREMENTS_2026-10-02
- REVIEW_TARGET：DESIGN
- REVIEW_ROUND：1
- REVIEW_ROUND_LIMIT：2
- reviewerKind：INDEPENDENT_SUBAGENT
- ACTION_1_VARIANT：1-B
- reviewerInputChecklist：doc/review/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-requirements-review-r1-input-codex.md
- 被审对象：doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-formal-requirements-codex.md
- 被审 SHA-256：43c8c0b56fe009b42512fddbf2513e339483dc7f5daafee49998c4e044c78dfb
- VERDICT：GO_WITH_UNVERIFIED_UI
- M/S/N：0M / 0S / 0N
- L1_ENGINEERING：STATIC_REQUIREMENTS_RECONCILIATION；需求归属、现有能力与必要差量已静态核对；未证明实现符合需求。
- L2_USER_VISIBLE：NOT_RUN；未运行 Web、Android、VM 或用户操作。
- L3_UNVERIFIED：UI 呈现、设备 adapter、实际持久化/同步、HTTP/代理、打包与四拓扑运行均未验证。
- SAME_ROOT_SCAN：COMPLETED_STATIC；范围见下文。
- DESIGN_GAPS：DG-01～DG-05；均为本稿明确保留的后续详设事项，不计入当前 finding。
- TEMPLATE_COVERAGE：正式需求阶段适用内容有覆盖；未来 Journey/交互/IA/实施工件逐节 N/A，详见输入清单。
- EVIDENCE_TIER：STATIC_SOURCE + DEXTER_RULINGS；无动态证据。
- authorMaterialReadAfterIndependentVerdict：false
- 本轮只完成需求审查，不授予后续详设、实施或运行权限。

## 独立结论

未找到足以证伪本正式需求的阻断反例，也未确认需要修改正式稿的 M/S/N finding。

产品输入先从讨论稿 §9.1～§9.14 的原话和 §0/§7 的已裁条款恢复，再对照被审对象与真实 owning sources。未读取讨论稿 §8/§10 的作者静态结论；被审稿 §12 仅作为源码导航，其事实重新查证。

正式稿忠实保留了本轮最新裁决：四面术语以终端规范 §4-E 为准；激活唯一输入为 8 位数字；服务 URL 前缀承载集团空间；公开取消命令保留 Dexter 指定的 `cancelTerminaActivationCommand` 拼写；代理密码普通字符串明文存储并同步；副机两个 admin tab 只读；副机可独立业务 HTTP，但没有本机激活/TDS 资格；内置 `serverSpaces` 来自 package 声明；业务 command 与 selector 为唯一公开通路。没有借旧 standalone/slave 术语撤销最新裁决。

原始激活需求中的凭证无效与已取消激活区别、取消后保留 server-config、配置变化不自动替消费者重连，以及生成器拥有契约描述等边界，与本稿没有发现冲突。集团空间、门店和店员语义保持原 owner 边界；sample member 没有被提升为已获批准的正式会员领域。

## 可落实性与同根反例核查

1. **角色、内容与资格不是同一个状态。** 被审对象 R-01、R-03、R-10～R-13 区分本机角色、LMS 内容、主机资格投影、缓存和当前同步就绪。已激活但 socket 暂断仍不能直接成为副机；退配中间 MASTER、repairPending 或 flush 失败不能放行业务。这些约束覆盖启动、配对、取消、恢复和异步完成，不只覆盖一个按钮。

2. **同步可达不等于业务就绪。** 当前 topology/state 已有 authoritative apply 与修订机制，但没有可直接当作本专项“主机信息完整且属于当前连接”的统一就绪事实。被审对象第 263～297 行明确要求当前主机身份、连接与应用修订相符，缓存不授予本机 active。accepted 先到、旧投影迟到、换主机和主机离线期间取消/登出均进入 V-17，没有把当前能力冒充完成。

3. **PRIMARY 副机命令不能靠 peer-intent 猜目标。** 当前 `resolveCommandTarget.ts` 的 PRIMARY peer-intent 保持本地；现有 sample registry 只有一个 pending。被审对象第 226～234 行明确要求 LSP 到主机 registry 的 peer target、两端独立过程和精确操作身份，并规定回包丢失不能盲目重发。没有通过副机新增第二个事实 owner 回避问题。

4. **断链遮罩与本地 admin 必须分别落实。** 当前 admin launcher/layer close 存在 peer 路径；MAIN 写归属仍在主机。被审对象第 263～275 行及第 323～334 行要求本地打开、认证、退配、换 host、关闭，同时保持全部业务屏幕、弹层与输入阻断，不放宽 MAIN 业务归属。此处是明确差量，不能据当前旧源码报本稿遗漏。

5. **command 完成/timeout 与 owner 提交资格不能混同。** 当前 runtime dispatcher 的超时不会自动取消已经执行的 handler。配置、角色、取消或 reset 后迟到完成仍是必须由 owning actor 判定的提交边界。被审对象 R-04、R-10、R-12 及 V-04/V-10/V-18 已明确覆盖，没有依赖组件隐藏或一个路由 effect 保证正确性。

6. **URL、内置 defaults、有效配置与保存结果分别核对。** 当前 generated API 是 canonical 完整路径；DEV Node HTTP helper 对根相对路径的组合不能证明新前缀语义。当前 config 密码 protected/isolated，composition 尚未完成 serverSpaces 接线。被审对象 R-06～R-08 与 V-03/V-06～V-08 明确要求生成投影、adapter 消费、package 注入、完整代理密码和保存失败 readback，未声称已经实现。

7. **独立壁纸与共享会员有不同事实住址。** 当前 wallpaper 本机 owner 可以复用；会员仍由主机 registry 拥有。被审对象 R-09a/R-09b 不把主机 wallpaper 投影覆盖副机本地值，也不将共享列表等同于共享待确认过程。

有限同根扫描覆盖四类内容、两个 integration、两个 admin tab、两个 sample 工作台、当前激活/取消/配对/重连/reset 链，以及配置、生成器和 adapter 的 URL 接缝。未扩展为后台 SQL、旧 member 正式域或本轮未获授权的生产化建设。

## 方案合理性

复用现有输入、render、admin 承载、state/topology 同步和本机业务 owner，增加有限场景入口与必要接线，是可进入后续设计的最小方向。

只给旧 sample 页面增加一个 activation wrapper 或副机只读缓存，虽然文件变动更少，仍无法满足独立 LMP/LSP 页面、两端 pending、本地 admin 与迟到状态资格约束。相反，建立通用路由引擎、第二套 store/provider 或副机会员事实 owner，会扩大复杂度并偏离本轮裁决。正式稿第 338～345 行对 helper 的限制合理，没有擅自冻结新的通用框架。

## 非阻断 DESIGN_GAPS

以下是后续获授权详设的必要接缝，不是当前实现缺陷，也不是要求本轮另写详设。

| 编号 | 正式稿位置 | 当前事实与后续最小闭包 | 是否需 Dexter |
| --- | --- | --- | --- |
| DG-01 | 第 293～297 行；V-08 | 当前 terminal 生成目标只有激活/取消，二者都不能作为副机业务 HTTP。需在详设列出真实获准 operation、请求身份、owner command/selector 和 adapter 证明；不能借配对、URL 或主机凭证获得授权。现有输入尚未证明该接缝可直接实施。 | 若必须新增业务身份或接口，需 Dexter；本稿已明确此边界。 |
| DG-02 | 第 263～297 行；V-17 | 明确当前主机身份、连接代次、所需同步字段/修订的 ready 判据，以及迟到投影和缓存失效处理。优先复用既有 state/topology，不增加新同步协议框架。 | 正常内部设计无需；若改变用户可用条件则需。 |
| DG-03 | R-04/R-05/R-10/R-12；V-04/V-18 | 将激活、取消、配置变化、角色变化、reset 与迟到完成逐链落到 owner 提交守卫和失败 readback。运行超时本身不能替代守卫。 | 正常内部设计无需。 |
| DG-04 | 第 263～275、323～334 行；V-15/V-16 | 本地 admin 的打开/认证/关闭/输入焦点与完整业务遮罩分别接线；保留 MAIN/BRANCH 归属。现有 peer 路径不能直接当作符合要求。 | 正常内部设计无需。 |
| DG-05 | 第 350～379、401～407 行 | 后续冻结 Journey、控件、IA、command/selector 接线、执行面、真实 VM identity 和 adapter 反例；先 Web 后设备，business/cleanup 分列。 | 详设和动态运行仍需对应授权。 |

未发现需要现在重新讨论的用户产品语义。DG-01 的接口/身份可能触发后续产品或权限裁决；本轮不代替 Dexter 选择，也不取消已经明确的副机业务 HTTP 能力。

## 证据边界与收口

V-01～V-20 当前全部 NOT_RUN。未运行测试、构建、verify、生成、DEV、reset/seed、L2、VM 或 UAT；没有网络探针和 Git 操作，没有写入文件。

本轮结论仅表示正式需求在已读适用输入下可进入后续获授权设计。没有证明 UI 可用、实现匹配、设备 adapter 可用或四拓扑交付完成。本轮适用必要输入无 OPEN；按领域/阶段判定为 N/A 的来源在输入清单逐项说明。

## 首轮归档补充：盲审、固定 verdict 与执行边界

- REVIEW_CYCLE_ID=TER_ACTIVATION_INTERACTION_PAIR_TOPOLOGY_REQUIREMENTS_2026-10-02
- REVIEW_ROUND=1
- REVIEW_ROUND_LIMIT=2
- reviewerKind=INDEPENDENT_SUBAGENT
- blindReviewDeclaration=本人先独立读取产品原话、适用规范、项目记忆和 owning sources，以证伪立场形成首轮 findings/verdict；未读取讨论稿 §8/§10 的作者静态结论、作者处置材料或其他 reviewer 结果。本补充仅修复本人首轮产物格式与输入记录，不重开审查、不改变冻结对象或既有结论。
- authorMaterialReadAfterIndependentVerdict=false
- targetSha256=43c8c0b56fe009b42512fddbf2513e339483dc7f5daafee49998c4e044c78dfb

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0M / 0S / 0N
L1_ENGINEERING=PASS（仅正式需求阶段适用约束的静态核对；不表示实现或动态验证通过）
L2_USER_VISIBLE=NOT_RUN
L3_UNVERIFIED=Web/Android/VM 页面、设备 adapter、实际持久化与同步、HTTP/代理、打包及四拓扑运行
SAME_ROOT_SCAN=COMPLETED_STATIC；范围见首轮正文
DESIGN_GAPS=未确认正本缺少判据；正文 DG-01～DG-05 是已明确预留的后续详设接缝，不是本轮新增 finding
TEMPLATE_COVERAGE=四份模板逐节对照见首轮输入清单；适用项有，未来工件或退役项 NOT_APPLICABLE
EVIDENCE_TIER=STATIC_SOURCE + DEXTER_RULINGS；无动态证据
```

### 补读与适用性记录

`doc/decisions/2026-07-25-v2s-agent-coordination-and-control-boundary.md`：此前首轮清单未记录该文件实际阅读，不追认已读。本次已只读补齐全文，读取完成时间为 **2026-10-02 12:39:11 UTC（Asia/Seoul 21:39:11）**，范围包括规范性原文、六条强制执行条款及文档作者边界。

补读确认任务只能依据 Dexter 当次明确授权推进，仓库控制动作不构成审查前置条件。其约束与已执行的只读审查一致，不影响本人既有 GO_WITH_UNVERIFIED_UI、0M/0S/0N 结论；文档作者边界不授予本 reviewer 写入权限。

- `doc/platform/frontend-coding-standard.md`：NOT_READ / NOT_APPLICABLE。本对象是 TER 正式需求，没有 frontend 管理后台实现；TER 专用正本为已读的 `doc/platform/terminal-coding-standard.md`。未来若涉及管理后台或对应共享前端能力，再重新判断其适用性。
- `doc/platform/backend-coding-standard.md`：NOT_READ / NOT_APPLICABLE。本轮不审后台实现、SQL 或 DB 预算；TER command/selector、配置、拓扑及 UI 边界使用 TER 专用规范。服务形态与 owner 红线已读 Blueprint、charter 和相关 decision。未来新增后台接口/身份须重新适用后台规范与授权。

### 实际权限与动作

本 reviewer 仅获只读审查及报告返回权限，没有文件写入、详设编写、实施或动态运行权限。本次只读取协作边界原文、核对 review-standard 固定格式并读取当前时间；未读取作者处置或其他审查结果，未修改任何文件、冻结对象或工作区，未执行构建、测试、verify、生成、运行、DEV、reset/seed、L2、UAT、网络探针或 Git 操作。
