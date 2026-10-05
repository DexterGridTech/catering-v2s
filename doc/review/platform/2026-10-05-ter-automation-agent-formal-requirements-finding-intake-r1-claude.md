# TER automation-agent 正式需求 · R1 finding 作者 intake

```text
REVIEW_CYCLE_ID=TER_AUTOMATION_AGENT_FORMAL_REQUIREMENTS_2026-10-05
INTAKE_OF=doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-review-r1-claude.md
R1_REVIEWED_SHA256=2fdd117499093a6dcf81ce827c42e1dbf032497da36f268db5adc5e2cca012fb
REVISED_OBJECT_SHA256=d96589865d83f6a31bebf0b994811e98371f19a7ff04cc84338096ae253cd982
AUTHOR=Claude（作者会话，续接会话）
NATURE=作者辩证 intake 与处置，不是独立 verdict
```

逐条重开了 owning source 后处置。“作者复核”一列写的是作者本人重开的来源，不是照抄评审的结论。

| # | 作者复核 | 结论 | 处置（修订后位置） |
|---|---|---|---|
| M-1 | 重开 `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-plan-codex.md`：第 10 行 `IMPLEMENTATION_AUTHORITY=true`，第 12 行 `ALL_DYNAMIC_STATUS=IN_PROGRESS`，第 172、194、223、267、273 行复用待删 runner；`ter-admin-display-web.mjs` 最后修改于今天 11:18 | CONFIRMED | 已处置。§7 D-1 默认 R-14、R-16 在该批动态收口后执行，该批新增 runner 并入删除清单；R-14、R-16 指向 §8；§8 第 4、7 步写入前置条件。排序如需改为并行，由 Dexter 决定 |
| M-2 | 重开 `scripts/test/ter-virtual-keyboard-android.mjs` 头部的受管入口说明，以及 AGENTS.md 受管运行条款 | CONFIRMED | 已处置。R-13 增加受管运行要求，并要求列出生命周期能力怎么迁移；§6 改为“受管生命周期迁移，不是净删除”；V-13 增加 manifest 与 cleanup 断言 |
| S-1 | 重开 `display-context/src/foundations/displayDevice.ts:28-36`（只有 displayIndex）与 `platform-ports/src/types/device.ts:30`（有 displayId） | CONFIRMED | 已处置。R-09 改为两种来源二选一，并写明不新增端口或 getter；R-11 运行信息改成逐项注明来源的表；R-01 增加“不新增端口” |
| S-2 | 重开 `admin-shell/src/foundations/adminSectionSelection.ts:80`：签名是 `(catalog, context)`，不读 state | CONFIRMED | 已处置。R-05 增加“公开 selector”的定义与排除项，推荐登记由定义派生，门按定义判定；原 F-3 移为详设输入 |
| S-3 | 重开 `runtime/src/types/command.ts`：没有 payload schema | CONFIRMED | 已处置。按评审推荐的较小方案：R-07 删除“参数非法”，异常转为明确的拒绝推送；§5 非目标增加“不新增 payload 校验” |
| S-4 | 对照 CLAUDE.md 的 UI 自问与 journey 模板 §6 | CONFIRMED | 已处置。R-04 第 4 条标为 `UI_BEARING=true`，只限这一处，详设补交 IA 与交互工件；V-04 增加“与交互工件一致” |
| S-5 | `ls scripts/test/`：存在 `ter-admin-display-android.mjs`、`ter-admin-display-web-stage.mjs`、`ter-persist-kv-prechange-android.mjs` 等 | CONFIRMED | 已处置。R-16 增加判别式、不删项与补全后的清单；TR-04 的重启证明进入场景清单 |
| S-6 | 重开 `sample-terminal/App.tsx:10,18-19`（harness 无条件挂载）与 `SystemFailureBoundary.tsx:20-26` | CONFIRMED。说明：`EXPO_PUBLIC_*` 在构建期内联，开关是构建期常量，但代码仍进产物，结论不变 | 已处置。R-15 改写为现状加处置：`ter-vk` 随 R-16 删除，`ter-failure` 登记 HANDOFF；V-15 标注“门自测”档位 |
| S-7 | 重开 `run-sample1-frozen-journey.mjs:39-45`：双屏可用的 case 是 normal、reject-retry、abandon、withdraw、render-smoke | CONFIRMED（case 差异）；开机首屏与 DEV 依赖为 UNVERIFIED | 已处置。R-17 改为以冻结 runner 的双屏 case 集合为分母，补前提链表；单屏 case 进入待重写清单 |
| S-8 | 键由 PrimitiveButton 渲染是本会话早先读源码确认的事实；Rive 草案 Dexter 已说“需求删了吧，不改了” | 部分采纳 | 已处置。R-08 写入当前事实，删掉条件分支，§4-C 例外随本专项改写；与 Rive 草案的关系写入 §7 I-2。草案当前不生效，不需要 Dexter 另行排序 |
| S-9 | 对照 AGENTS.md 日志条款与 Dexter 的 D4 原话 | DEXTER_DECISION | 列入 §7 D-2，推荐 (a)。R-05 的敏感值说明指向 D-2 |
| S-10 | 文档内核对 | CONFIRMED | 已处置。R-08 增加按下事件及触点坐标；F-1 判据改为按触点坐标判断，容差 N 由详设给出依据；F-4 改为可证伪；F-3 移出；§8 写明 F 闸在前、破坏性步骤在后 |
| S-11 | 重开 `testExpoApp.tsx:465、480` | CONFIRMED | 已处置。R-10 增加“Web locator 按 surface 限定”；R-03 与 R-02 写明无 adb 时 Android 只能用 agent 侧能力 |
| S-12 | 按评审 grep 的规模（本人未逐一复数） | DEXTER_DECISION | 列入 §7 D-3，推荐切两批；§8 按批内顺序给出 CP 序列 |
| N-1 | 重开 `verify.test.mjs:149` 与 `check-static.mjs:645-650` | CONFIRMED | R-01 改指测试中的固定计数 |
| N-2 | 推论成立 | 采纳 | R-04 写明令牌与地址各自防住什么；R-15 写明 TR-08 的反例在该例外下被接受 |
| N-3 | 重开 `selectTerminalDataClientState.ts:17-37` | CONFIRMED | R-05 改为“若某个已登记 selector 返回敏感值则原样返回”；§6 措辞同步 |
| N-4 | 推论成立 | 采纳 | R-12 增加后果说明，§6 列入需 Dexter 知悉的代价 |
| N-5 | 对照讨论稿 §5.6、§8 K7、§10 | CONFIRMED | HOT 下发：写入 §5 非目标并指向更新专项；非 React 界面：写入 R-10 末条；Appium：写入 §3 停止条件，由 Dexter 决定 |
| N-6 | 推论成立 | 采纳 | R-06 写明经 runtime 按名求值接口访问；耗时上限作为判据；V-06 改为源码断言 |
| N-7 | 文档内核对 | 采纳 | R-08 改为“对使用方注册零改动”；R-05、R-14 的门写明接入静态检查流程；R-14 的门写明满足建门三问 |

## 需 Dexter 裁定（不阻塞 R2 盲审）

- D-1：R-14、R-16 与在途激活批的先后。本需求已写入默认方案，如需改为并行须由 Dexter 决定。
- D-2：D4 是否覆盖 driver 落盘的产物。
- D-3：是否切成两批。

## 未采纳

无。S-8 只采纳了事实部分；“两份键盘需求谁先”这一问不成立，因为 Rive 草案当前不生效（§7 I-2）。
