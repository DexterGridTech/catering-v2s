# TER automation-agent 正式需求 · R2 finding 作者 intake 与收口自审

```text
REVIEW_CYCLE_ID=TER_AUTOMATION_AGENT_FORMAL_REQUIREMENTS_2026-10-05
INTAKE_OF=doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-review-r2-claude.md
R2_REVIEWED_SHA256=d96589865d83f6a31bebf0b994811e98371f19a7ff04cc84338096ae253cd982
R2_VERDICT=GO_WITH_UNVERIFIED_UI，0M/4S/13N，ROUND_FINAL_DECISION=SELF_DECIDED（由 R2 独立 reviewer 写入）
REVISED_OBJECT_SHA256=8106743a79f155f83baa92cf3fa1d57b5a6e703482781d215d40789a4c6dce74
AUTHOR=Claude（作者会话，续接会话）
NATURE=作者 intake、修订与一致性自审。不是独立 verdict，不重开 cycle
```

R2 是本 cycle 的最后一轮。R2 之后的修订只把 R2 指出的问题落到文本，没有新的独立 verdict。

## 1. R2 finding 处置

| # | 作者复核 | 处置 |
|---|---|---|
| S-A | 计数复核：`ter-admin-display-web.mjs` 有 20 行、`ter-virtual-keyboard-android.mjs` 有 17 行含 `ui.base.input:virtual-keyboard:`（按行计数，评审按次数计为 27 与 28，结论相同）。注册表按 testID 字符串寻址，不依赖格式 | §8 重排：首个旅途先在现有 testID 上两端通过（第 4 步），再做 testID 重建并用同一旅途回归（第 5 步），删除 runner 放在最后。D-3(b) 的批 A 改为“不改任何 testID”；D-3(a) 须写明接受超量复核的理由 |
| S-B | 文档内逻辑成立 | F-4 拆成两条：F-4a 用 focused 测试与 Web 静态页对比，不依赖 agent；F-4b 在设备上测开销。§8 第 3 步改为证明 F-4a 与 F-4b |
| S-C | 重开 `AdminLauncher.tsx:36-57`：`measuredScaleX = windowMeasurement.width / canvas.width`，即把 `measureInWindow` 当作已含缩放 | R-09 只规定输出契约，换算链交详设按 RN 版本核实后写定，并列出仓内先例与 TR-17 反例 |
| S-D | 重开 `implementation-task-template.md:211-217`：“动态前整体准入”只约束 L2、reset、seed | §3 增加“进入条件”：F 闸是 CP 内的动态 focused proof，在该 CP 对账 MATCHED 后运行；6b 只约束最终两端验收；若需要 DEV 与 seed，四项完整适用 |
| N-a | 采纳 | R-07 补上命令预算超限与 runtime 未启动；“任何异常都转为拒绝推送”；V-07 同步 |
| N-b | 采纳 | R-07 写明 journal 属运行时元数据；`selectRequestExecutionView` 须经按名求值 |
| N-c | 采纳更小方案 | R-04 的状态行只显示构建期常量（是否启用、地址），不显示实时连接状态，agent 不必为此拥有 slice |
| N-d | 采纳 | §5 写明“HOT 下发开关打开的 bundle 等于远端打开开关”；§7 I-3：实施时登记 HANDOFF，是否转入版本更新专项由 Dexter 决定。作者不改另一会话的文档 |
| N-e | 部分采纳 | §0.2 逐字收录“需求删了吧，不改了”；§7 I-2 写明草案文件仍在、没有撤回标记，是删除还是标注撤回待 Dexter 确认。本次没有改动该草案 |
| N-f | 采纳 | R-15 增加 T-12 记忆条目同步与 platform-ports README 的理由改写；V-15 同步 |
| N-g | 采纳 | §0.2 增加 `NO_CORPUS_ENTRY_MATCHED`（含检索词）与禁推三条 |
| N-h | 重开 `ter-virtual-keyboard-android.mjs:5795-5800`：同时有 `logicalDisplayId` 与 `surfaceFlingerId` | R-09 写明每块屏两个 id，推荐由 driver 侧取得；R-11 与 R-13 同步 |
| N-i | 采纳 | “harness 已删除”从 V-15 移到 V-16 |
| N-j | 采纳 | R-15 写明本专项各 CP 的对账以 Dexter 的 TR-08 例外裁定为准 |
| N-k | 采纳 | D-2 写明“裁定前按 (a) 执行” |
| N-l | 采纳 | §6 列入 `wss` 证书校验的取舍，标为 UNVERIFIED |
| N-m | 采纳 | R-01 增加 `publicExports` 同步；R-05 写明门的分母可复用它 |

## 2. 收口自审：上下文冲突与一致性

按 Dexter 的指派，最后由作者对全文做一次上下文冲突与一致性自审。下面是自审发现的问题，都已在本版修订：

| # | 发现 | 修订 |
|---|---|---|
| C-1 | R-14 把 `ui.base.input:` 列为待废弃前缀，可它本身就是 input 包的点分 moduleName，符合新格式。原文与新格式自相矛盾 | 改为只列不符合格式的前缀；`ui.base.input:` 保留前缀，其后各段仍按新格式重建 |
| C-2 | §1 术语写“每个包登记”，R-05 写“拥有 state selector 的 runtime 模块登记”。与 Dexter 原话“每个包都需要在runtime中登记selector”的关系没有交代 | §1 与 R-05 统一为“凡有 state selector 的包都登记”，并写明这是对原话的理解：没有 state selector 的包，没有可登记的内容 |
| C-3 | R-04 写“令牌随 package.json 分发，由 Dexter 知悉并接受”。Dexter 没有就这一点表态，属于把推论写成了裁定 | 改为“这是连接参数写在 package.json 的直接后果，须由 Dexter 知悉” |
| C-4 | R-08 要求注册表记录节点所属 surface，但 primitives 没有任何依赖（`apps/terminal/skeleton-graph.ts` 中 `ui.base.primitives` 的 dependencies 为空），而 render 依赖 primitives。primitives 自己拿不到 surface | R-08 写明 surface 归属的获得方式由详设定，例如由 render 的 surface 承载边界向接缝提供上下文 |
| C-5 | §8 D-3(b) 的批 A 漏掉了 TR-08 例外修订。可是批 A 就会把 agent 装进所有构建，必须同时有这项修订 | 批 A 包含第 6 步中除 testID 相关修订以外的部分；批 B 包含 testID 相关修订，以及按新 testID 更新 skill |

在文档之外、无法由本文件自行消除的上下文冲突：

- 讨论稿 `doc/plans/platform/2026-10-05-ter-ui-automation-requirements-discussion-claude.md` 保留了讨论过程中的旧表述，例如 F-3、单一 displayId 等。本文件 §0.2 已声明有出入时以正式需求为准，讨论稿不再修订。
- Rive 软键盘需求草案仍在仓内，没有撤回标记（§7 I-2）。
- TER 版本更新专项没有记录 HOT 下发与 automation 开关的关系（§7 I-3）。
- 在途的终端激活交互与双机拓扑批次正在使用待删的 runner 与旧 testID。本文件以 D-1 的默认顺序避开冲突，但实际排期由 Dexter 决定。

## 3. 仍待 Dexter 裁定

- D-1：R-14、R-16 与在途批次的先后。已有默认方案。
- D-2：D4 是否覆盖 driver 落盘的产物。裁定前按 (a) 执行。
- D-3：维持一批，还是切两批（推荐切两批）。
- I-2：Rive 草案文件是删除还是标注撤回。
- I-3：HOT 与开关的问题是否转入版本更新专项。
