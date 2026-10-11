# TER 应用内远程控制完整设计包：外部独立静态评审（Claude）

## 0 · 结论块

```text
REVIEW_TARGET=DESIGN（Journey/IA/UI-interaction/implementation-design/plan/source-and-api-appendix 六工件当前字节）
ACTION_1_VARIANT=1-B 文档提取＋owning source 静态读回
VERDICT=NO-GO
M/S/N=0/1/2
L1_ENGINEERING=STATIC_ONLY；复用链与源码一致，仅列表在线判定不可实现（S-1）
L2_USER_VISIBLE=NOT_RUN；三交互面线框 UNSET，IA/UI/详设三处文案与弹层规则一致
L3_UNVERIFIED=非空（§6）；S-1 关闭后只能给 GO_WITH_UNVERIFIED_UI
SAME_ROOT_SCAN=逐条见 finding
DESIGN_GAPS=1（§7）
TEMPLATE_COVERAGE=§5
EVIDENCE_TIER=SOURCE_ONLY_STATIC_DESIGN_REVIEW
reviewerKind=EXTERNAL_CLAUDE
```

S-1 只需改一个判定口径。两条 N 是一致性说明，不阻断 GO。T-01（原生帧导入 RN WebRTC 轨道尚无已核实的公开 API）在设计中如实标为 OPEN，并设为 CP-01 阻断项，这是正确的处置，不算 finding。

## 1 · 会话来源与独立性

本会话不是 fresh。它在续接会话中进行，之前评审过本专项的正式需求，结论是 NO-GO 0/1/4，当时的 S-1、N-1～N-4 已全部落入当前需求字节。本会话没有参与起草本设计包。

阅读顺序：先读需求和六份工件，再读 owning source，形成全部 finding 之后，才读 R1、R2 和两份 intake。六份工件的 SHA 与 intake-r2 §5 一致（本轮亲自计算），正式需求当前 SHA 前缀为 16e4c847…。本轮未读取 `.runtime/`。

## 2 · 方案合理性

方案真正解决了“看到并通过原控件协助操作”这一任务：
- 入口复用现有“终端更新状态”Tab 与详情 Drawer，只新增一个全屏 Modal。
- CBS 复用 terminal-control 的在线投递，在同一事务里登记 session（详设 §6.1）。
- TER 端沿用 base command/actor/selector；TDC 只新增两个具名认证 POST command（§8.2）。
- 配对场景沿用 `target:'peer'` 的 join/stop。仓内已有副机→主机的先例：`kernel/feature/sample-member-registry/src/features/actors/actors.ts:95–103`。
- 原生侧只给 dual-screen 唯一的 Window registry 加一个窄的 public 借用接缝。`TerminalSurfaceHostRegistry` 目前是 `internal object`，Entry 中持有 `ownerWindow`（`TerminalDualScreenActivityHandler.kt:288,530–533`），所以确实需要新增 public 接缝，设计 §8.1 已明说。
- 输入走正常的 `dispatchTouchEvent`。

上一轮需求评审提出的简化都已采纳，设计因此比需求初稿明显更简单：
- 不新增 H/W freshness；
- 副机不再持有租约；
- 去掉 CONTROL_OPEN/READY，消息从 8 类减为 6 类；
- 终端 grant 不带 URL；
- 明确 CBS 使用官方 JVM SDK。

剩余复杂度都有实际用途：
- CBS 30s 租约：在 MASTER 与浏览器同时消失时回收占用；
- KEEPALIVE：浏览器崩溃时让端点在 15s 内停止，同时触发 SCREEN_READY 重发，以覆盖浏览器晚加入；
- 有界输入队列与 3s 回执：防止输入无限堆积。

这些都没有扩张成通用平台。start 命令不占用 TDC 根命令 60s 的预算（计划 §5 第 3 项）。这一点我对照过源码：TDC 在 `transport-event` 命令里同步等待远程命令（`terminalDataClientActor.ts:2060–2075`），超时会作废 TDP 连接（`:245–259`）。设计的处理正确。

## 3 · Findings

### S-1 · 列表“在线 / 状态待确认”的判定依赖 PG 中不存在的列，且设计同时禁止改动连接事实（CONFIRMED）

**位置**
- 详设 §6.3 L113：“只有当前绑定对应 device 与 generation 能确认 PG session 时才 ONLINE；冲突 UNCONFIRMED”。
- 计划 CP-02 L43：“当前 binding/current session/device 关系”。
- 详设 §10b.3 L232：UNCONFIRMED 用 fixture 或合法动作“制造”。
- 附件 §3a L118：`RC_CONNECTION_UNCONFIRMED`“当前 PG 在线身份无法完整确认”。
- 上游正式需求 R-01 L94。

**事实**
- `terminal_connection.latest_state`（`apps/backend/catering-business-server/src/main/resources/db/migration/V20260926_000000_000__terminal_binding_owner.sql:141–175`）只有 node/session/sequence/时间/close_reason，没有 binding generation，也没有 device。
- 现有在线判定是 `TerminalControlPersistence.readActiveBinding`（ACTIVE binding）加 `READ_ONLINE_SESSION`（`disconnected_at_epoch_millis IS NULL`），不比对 generation 或 device。
- TDS 在心跳超时、取消激活、凭证失效时，会写断开事实并带上 close_reason。
- 与此同时，详设 §10 L224 写明“不修改 binding/connection 事实定义，TDS 没有新增表权限需求”。

**反例**：实施者按 §6.3 实现时，查不到可比对的 generation/device。要么所有行都无法确认，全部显示“状态待确认”，远控入口全部不可点；要么越界给 TDS 写入的 latest_state 加列和迁移，这又违反 §10。UNCONFIRMED 的 acceptance fixture 也无法用合法动作制造。

**影响**：列表核心状态和发起准入的判定，按原文没有合法的实现方式。

**最小修正**：
- ONLINE 定为“当前 ACTIVE binding，且 latest_state 存在、未断开”，与 `invokeOnline` 的现有判定完全一致。
- 删除 UNCONFIRMED、CONNECTION_UNCONFIRMED、`RC_CONNECTION_UNCONFIRMED`，以及它们的中文映射和 fixture 场景。这一改动要同步需求 R-01、R-20 与附件 §3a。
- 如果作者能指出一个当前已有的、可观察的“身份冲突”事实，就保留这个状态，并写明具体的列和 SQL。

**同根**：涉及连接判定的有 6 处：列表 page/detail、start 准入、错误闭集、UI 文案、seed/fixture。我已逐一核对，都依赖同一个不存在的事实。

**需 Dexter 裁决**：否。这个状态在当前事实下本来就无法产生。

### N-1 · DEV/设备主 run 中浏览器由谁拥有，附件有两种说法（CONFIRMED）

**位置**
- 附件 §7 L238：“browser 端真实 operations UI click 与 video pointer 由现有浏览器 L2 能力承担（复用 browser-l2 生命周期和 Playwright 库）”。
- 附件 §7 L239：DEV 多端 Journey 使用“已启动 DEV＋media resident＋本机 operations Vite，而不能冒充每 run 隔离 browser L2”。
- 计划 CP-05 L74：“两个 managed lifecycle 由父 owned children 接线”。

**事实**：B 现行做法（B 详设 §15.2a，`tools/terminal-automation/journeys/terminalUpdateSupplyUi.ts:145–293`）是：terminal-automation 父 run 自己 `chromium.launch` 并拥有 browser/context，DEV 的 Vite/tunnel 只是借用。browser-l2 runtime 会自起隔离的 DB/TDS 栈。

**反例**：如果实施者照 L238 字面在 DEV 设备 run 里调用 browser-l2 生命周期，就会多起一套隔离栈，或者两个 runner 互相嵌套。这正是阶段 C R3 S-01 记录过的同类冲突。

**最小修正**：L238 改为两句。
- 隔离 L2 用 browser-l2 runtime；
- DEV/设备 run 由 terminal-automation 父 run 直接用 Playwright 创建并回收 browser/context，复用 §4b 的同一组 binding，只借用 DEV 的 Vite/tunnel。

计划 L74 也同步改为这一说法。

**需 Dexter 裁决**：否。

### N-2 · “资源释放失败”在后台工作区显示的是谁的资源，没有写明（PARTIALLY_CONFIRMED）

**位置**
- IA §4 L44、UI §5 L150：“远程控制已结束，资源释放失败”。
- 需求 R-17：释放失败单独可见。
- 附件 §3 L79：report body 为 `{sessionId,state,reason,readyScreens}`。

**推论**：终端侧的 capture、track、Window 释放结果没有任何回传后台的字段。MASTER 结束后也不再续报。浏览器只能知道自己的 Room 与 track 清理结果。

**反例**：实施者为了显示终端的释放失败，可能给 report 增加 cleanup 字段，或者在 ENDED 之后再追加一次上报，相当于新增协议。

**最小修正**：写明后台文案只覆盖浏览器本地的 Room/track 清理结果。终端侧的释放结果通过 TER 的 `selectRemoteControlStatus.cleanup` 与结构化日志可见，由 automation 断言，不回传 CBS。

**需 Dexter 裁决**：否。

## 4 · 重点项逐条结论

| 重点 | 结论 |
| --- | --- |
| 终端 Tab/Drawer 入口与全屏 Modal | 成立。报告详情 Drawer 在 `ProjectTerminalUpdatePage.tsx:974` 起，目前没有操作菜单，可加 `AdminDetailActionMenu`；`AdminDetailActionLabel` 已导出（foundation `index.ts:78`）。现有 TestId `reportOpen`、`reportQuerySubmit` 存在（`terminalUpdateTestIds.ts:39,50`）；reset 与分页字面量位于 page `:816,840`，迁入常量的方案准确 |
| 三个运营 POST 与纯 GET | 成立：三个 POST 都复核 live 写授权；GET 只核读 scope 加发起账号，不附写 capability，过期时只做导出、不写库 |
| PG 状态、六 HTTP、六 Data | 六 HTTP 与六 Data 一致；PG 状态见 S-1 |
| 错误闭集与判定先后 | 成立。AUTHZ_READ（5 项）、OWNER_COMMAND（10 项）与 catalog 原值一致；新的 `TERMINAL_REMOTE_CONTROL_COMMAND` 等于 TERMINAL_DATA_READ 加两项，与 B 的 TERMINAL_UPDATE_REPORT_WRITE 先例同形；`STORE_TERMINAL_DISABLED`、`TERMINAL_BINDING_CREDENTIAL_INVALID` 已在 disposition 登记。403 先于 404，live 授权先于 replay，顺序明确 |
| TDC 唯一认证 owner、command/selector、精准 peer、Window registry、触摸链 | 成立。当前阶段 C 源码会把 credential 同步给副机（`terminalDataClient.ts:60–70,314`），设计仍坚持由 MASTER 注册并转交 grant，副机不连 TDS，与正式需求 L224 一致 |
| 独占、租约、任一屏断连整体结束、本地并用 | 成立：partial unique 加 advisory lock，30s 租约，副机靠 pair、participant、KEEPALIVE 三重信号停止，冲突时只取消单个手势 |
| 控件、TestId、L2 文件、seed 角色、5 个交叉 run | 成立。§4a 的九列表与 §4b 控制面齐全，包括 P1、activation-candidate、execution、admission、spec，与 store-terminal L2 同形。`asg-multi-project`/`role-project`/`project-river` 在 seed 中存在，store-operating 属于 project-river，role-project 已有页面权限。5 个 run 覆盖了四种拓扑和两个 App。DEV run 的浏览器归属见 N-1 |
| CP→6b→动态→13c 顺序与日志先行 | 成立。observability 正本 L28 与实施任务模板已有 `TEST_CHAIN_PREFLIGHT`；设计 §3.2 与计划 §2.1 正确区分了本轮文档审查和未来的两轮源码审查 |
| 先关 Drawer 再开 Modal、叠层 1、焦点归还 | 成立。Journey、IA、UI、详设四处原文一致；`useOverlayLock` 打开期间会锁住 shell 导航（`overlayLock.tsx`），与“关闭即结束”的设计相容 |
| 原五个查询条件的模板覆盖 | 成立（UI §1.3），新连接列不作为筛选条件 |

## 5 · TEMPLATE_COVERAGE

| 模板 | 工件 | 覆盖 |
| --- | --- | --- |
| journey-decision | Journey | §1–§7 有，§6.1 弹层一致性有 |
| ia-design | IA | §1–§6 有；不可见维度有可执行观察 |
| ui-interaction | UI | §1、1.1、1.2、1.2.1、1.3、1.4、§2–§10 有；看图 UNSET |
| implementation-design | 详设、计划、附件 | §0–§14，含 3.1、3.2、3a、9a、9b、10b、11a、13b、13c 均有 |

## 6 · 未验证项

| 项 | 状态 |
| --- | --- |
| T-01：原生帧导入 RN WebRTC 轨道（无已核实的公开 API）、精确 SDK/JVM 依赖图 | OPEN，CP-01 阻断 |
| T-02：持续双 Window 捕获与释放 | OPEN |
| T-03：正常触摸、本地并用、坐标 | OPEN |
| T-04：ICE/TURN、断连事件、租约回收、部署 | OPEN |
| 阶段 C 最终出口（共享 credential、peer、双 VM 通路、driver） | OPEN |
| 三交互面线框 | UNSET |
| 全部实现、生成、编译、测试、verify、Web、设备、DEV、seed、cleanup | NOT_RUN |
| LiveKit 官方行为 | 本轮无法访问 docs.livekit.io，沿用作者引用 |

用产品负责人的话说，还没有人验证过：后台能否看到连续的终端画面；点击、拖动、虚拟键盘能否生效，现场是否可以同时操作；双屏、双机画面是否点得准；断网后两屏是否都停、能否手动重新发起；媒体服务的部署与清理。

## 7 · DESIGN_GAPS

`verification-governance` 仍没有 M/S/N 定义。本文口径：S 表示按原文实施没有合法实现路径或产生功能缺陷；N 表示一致性或说明问题。这一口径需要 Dexter 确认，本文不就地立规则。

## 8 · 与内部两轮对照

- R1（0/2/4）与 R2（0/2/3）的确认项，在当前字节中都有落点，intake-r2 的 SHA 与当前一致。
- S-1、N-1、N-2 两轮都未覆盖：R1/R2 没有核对 latest_state 的列，也没有对照 B 的父 run 浏览器归属。
- 作者的 SELF_DECIDED GO_WITH_UNVERIFIED_UI 不作为本轮证据。

## 9 · 授权声明

本文只是外部静态设计评审，只新写了本文件。不重开内部 cycle；不授权实施、规范/需求/记忆/依赖修改、生成、构建、测试、verify、DEV、reset/seed、Web/设备、L2、UAT 或部署；不涉及 Codex 在途的阶段 C。
