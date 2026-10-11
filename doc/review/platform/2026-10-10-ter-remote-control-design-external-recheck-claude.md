# TER 应用内远程控制完整设计包：外部独立静态复评（Claude）

## 0 · 结论块

```text
REVIEW_TARGET=DESIGN（正式需求＋六工件当前字节；外部复评，不是内部第三轮）
ACTION_1_VARIANT=1-B 文档提取＋owning source 静态读回
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/1
L1_ENGINEERING=STATIC_ONLY；三态与在线投递判定同源，身份保护保留
L2_USER_VISIBLE=NOT_RUN；三交互面看图 UNSET；文案三态在 Journey/IA/UI/详设/附件一致
L3_UNVERIFIED=非空（§6）
SAME_ROOT_SCAN=逐项见 §2、§3
DESIGN_GAPS=1（§7）
EVIDENCE_TIER=SOURCE_ONLY_STATIC_DESIGN_REVIEW
reviewerKind=EXTERNAL_CLAUDE
```

本轮实算 SHA-256（前 16 位）：

| 文件 | SHA 前缀 |
| --- | --- |
| 需求 | ba2d4c8dda775875 |
| Journey | 78eead15fb165a87 |
| IA | 27960c9a2559579b |
| UI | 7ad8a0773254ff2a |
| 详设 | 544d71e8b9d0b951 |
| 计划 | 56c7845058721cae |
| 附件 | a504db11ceb8140b |

剩下的一条 N 是正式需求 V-01 中的旧四态措辞，不影响实施路径；修一个单元格即可。

## 1 · 会话来源与独立性

- 本会话不是 fresh。上一轮外部评审（NO-GO 0/1/2）和更早的需求评审也是我做的，因此这次是对自己 finding 的复核，独立性弱于 fresh reviewer。
- 本轮先读需求、六工件和 owning source，形成判断后才读作者 intake。intake 只用于定位。
- 本轮未读取 `.runtime/`。

## 2 · 三项修订核验

| 项 | 结论 | 依据 |
| --- | --- | --- |
| S-1 三态 | CLOSED | 见 §2.1 |
| N-1 浏览器归属 | CLOSED | 见 §2.2 |
| N-2 释放失败范围 | CLOSED | 见 §2.3 |

### 2.1 S-1

**判定口径与源码一致。**
- `latest_state` 的主键是 (workspace_uuid, group_workspace_key, terminal_ref)，迁移文件 `V20260926_000000_000__terminal_binding_owner.sql` 第 154 行附近，每个终端一行。因此列表 join 是 1:1 集合读取，不存在 N+1。
- 需求 R-01 L93–95 与详设 §6.3 L114 的判定，正好是 `TerminalControlPersistence.readActiveBinding` 加上 `READ_ONLINE_SESSION` 的组合。`READ_ONLINE_SESSION` 在 L35–41，条件为 `disconnected_at_epoch_millis IS NULL`。
- `observedAt` 取 `last_activity_at_epoch_millis`，该列存在。

**身份保护没有被削弱。**
- `claim_online_operation`（`V20261004_020000_000__terminal_control_online_operations.sql` L60–78）仍按 binding.generation 与 session 的 node/id/sequence 精确复核，`accept_terminal_report` 也一样。
- 详设 L114 写明“start 仍捕获 generation 与 PG node/session/sequence，既有 claim 复核各自权威表”。
- 附件 §3a 保留了 `RC_IDENTITY_CONFLICT`，覆盖固定 binding、启动 TDP 目标和 description/peer 的变化。
- 旧 PG 暂时显示在线的限制在需求 L97 和详设 L115 都有保留。

**同根扫描。** 以下位置均已是三态，没有 UNCONFIRMED 残留：
- 需求 R-01、R-02 L103、R-20 L367；
- Journey L24、IA L49、UI L20/L128–148；
- 详设 L84/L114/L215/L234、计划 L13/L43/L66；
- 附件 §3a L94（start 增补集）、L116–118、L123 判定顺序、L169、L227。

`fixture` 只用可合法产生的事实：未激活或已取消、ACTIVE 但未建连或已断开、真实激活后 TDS ready（详设 L234）。SQL 读取失败按 503 处理，不算第四态。

唯一的例外见 N-1。

### 2.2 N-1

- 附件 §7 L237 与计划 CP-05 L74 已改为：隔离 L2 走 browser-l2 runtime；DEV/设备 run 由 terminal-automation 父 run 用 Playwright 创建并回收 browser/context，只借用 Vite/tunnel，不调用隔离生命周期，也不另起 DB/TDS。
- 附件 L192 已同步。这个口径与 `terminalUpdateSupplyUi.ts` 现状一致：L411 `chromium.launch`、L413 `newContext`、L738 `browser.close`。
- 作者 intake 引用的 `:349/:351` 已和当前字节不符，这个文件正被阶段 C 并行修改。设计正文按 symbol 引用，不受影响；实施前仍按 symbol 重开即可。

### 2.3 N-2

- UI L149–151、IA L44、Journey L16、详设 L112/L196 一致：后台只显示浏览器本地 Room/track 的清理失败；TER 端的 capture/track/Window 清理结果留在 `selectRemoteControlStatus.cleanup`（需求 R-20 L373 已要求 selector 提供释放状态）和结构化日志，由 automation 断言。
- 不扩 report body，ENDED 后不追加上报，也不建清理框架。
- 详设 L196 写明“不以 ENDED 掩盖”，所以 CBS ENDED 不会被当作释放成功。
- 需求 R-17 L325 只要求“释放失败单独可见”，没有指定在后台可见，按端点可见即满足。

## 3 · Finding

### N-1 · 正式需求 V-01 仍写“身份冲突”和“四类状态”（CONFIRMED）

**位置**：`doc/plans/platform/2026-10-10-ter-remote-control-formal-requirements-claude.md:383`，V-01 原文为“项目列表：未激活、已断开、身份冲突、当前未断开会话 | 四类状态/时间正确”。

**事实**：Dexter 已裁决只保留三态（需求 L24），R-01 L93–95 也只定义三态；V-01 是这次同步漏掉的一处。六工件的 V-01 场景（详设 L84 `remote.online`“三态”，附件 L227）已是三态。

**影响**：实施或验收的人照 V-01 准备场景时，会去找一个“身份冲突”fixture，而当前事实下造不出来，可能为此造数据或判失败。不影响设计路径。

**最小修正**：V-01 改为“未激活、ACTIVE 未建连或已断开、当前未断开会话 | 三类状态/时间正确”，其余不变。

**需 Dexter 裁决**：否，已被 L24 的裁决覆盖，属于纯同步。

## 4 · 方案合理性

方案能简单地解决“看到画面、并通过原控件协助操作”的问题。
- 入口复用现有 Tab/Drawer，只新增一个全屏 Modal。
- CBS 复用 terminal-control 在线投递。
- TER 侧沿用 base command/actor/selector、TDC 两个具名 POST、`target:'peer'`，以及 dual-screen 的窄接缝。
- 本轮三项修订都在“删机制”：删掉一个造不出来的状态，统一使用一个浏览器 owner，不新增回传字段。没有引入新的 owner、command 或框架，也没有越过 TDS 的表边界。

## 5 · 相邻条款与职责复核

- R-02 L103 的禁用条件与三态一致。
- 附件 L123 start 判定顺序为：激活→PG 离线→重放→回收过期→占用，与 `invokeOnline` 现有判定同源。
- 我没有发现修订把逻辑挪进 integration/composition，也没有在 GET 上附加写 capability。

## 6 · 未验证项

| 项 | 状态 |
| --- | --- |
| T-01：原生帧导入 RN WebRTC 公开桥、精确 SDK/JVM 依赖图 | OPEN，CP-01 阻断 |
| T-02～T-04 | OPEN |
| 阶段 C 最终出口 | OPEN |
| 三交互面看图 | UNSET |
| 全部实现、依赖解析、生成、编译、测试、verify、Web、设备、DEV、seed、cleanup | NOT_RUN |
| LiveKit 官方行为 | 本轮仍无法访问官方文档，沿用作者引用 |

用产品负责人能直接核对的话说，以下几件事还没有人看过：
- 后台能否看到连续画面；
- 点击、拖动、键盘能否生效，现场能否同时操作；
- 双屏、双机的点击位置是否准确；
- 断网后两屏是否都停，能否手动重新发起。

## 7 · DESIGN_GAPS

`verification-governance` 仍没有 M/S/N 定义。本文沿用前两轮口径：S 表示没有合法的实现路径，或会造成功能缺陷；N 表示一致性或说明问题。这个口径需要 Dexter 确认。

## 8 · 授权声明

本文是外部静态复评，只新写了本文件。不授权实施、需求/设计/规范/记忆/源码/依赖修改或任何动态运行，不涉及 Codex 在途的阶段 C。GO_WITH_UNVERIFIED_UI 只表示静态上没有阻断，不是 UI 或技术通过。
