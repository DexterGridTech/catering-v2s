# TER automation-agent 当前源码复评 finding intake（R2）

日期：2026-10-06。责任人：Codex 主 agent。范围：只核验本轮 Claude 静态复评的 S-1、N-1、N-2，并在既有 automation-agent 批次实施授权内修复确认项。未启动测试、构建、verify、DEV、Expo Web、Android、VM、reset/seed、L2、UAT 或部署；未读取 `.runtime/`。

## 核验输入

- `doc/review/platform/2026-10-06-ter-automation-agent-source-static-rereview-claude.md`
- `doc/plans/platform/2026-10-05-ter-automation-agent-formal-requirements-claude.md`：R-05、R-13
- `doc/plans/platform/2026-10-05-ter-automation-agent-implementation-design-claude.md`：§4.2、§9a.2
- owning source 与直接测试：`tools/terminal-automation/src/runner.ts`、Android journey suites、`journeyFailureDiagnostics.ts`、`journeyUiPort.ts`、`virtualKeyboardInput.ts`、`apps/terminal/ui/base/automation-agent/src/application/runtimeRequestHandler.ts` 及各自测试
- 适用边界：`project-memory/operations/claude-review-finding-intake.md`、`project-memory/operations/terminal-coding-standard.md`、`project-memory/operations/test-closed-loop.md`

## Finding disposition

### S-1 — Android device cleanup 不能由“未看到失败”推成 PASS

**分类：CONFIRMED。** R-13 要求受管设备资源回收；详设 §9a.2 要求设备/reverse 按受控身份清理。原 runner 将 stdout/stderr 共用 marker tail，且只在看到失败标记时判失败，所以交错输出可遮蔽失败标记；child 被中断、没有执行完 suite `afterAll` 时，也可能因未出现失败文本而被判 PASS。

**最小修正：已完成。** `tools/terminal-automation/src/runner.ts:49-50,80-92,620-623,738-775` 为 stdout 和 stderr 分别保留 marker tail；只有看到显式 `TERMINAL_AUTOMATION_DEVICE_CLEANUP_COMPLETE` 才能判设备 cleanup PASS。`TERMINAL_AUTOMATION_DEVICE_CLEANUP_FAILED` 优先于完成标记；无完成/失败标记时记 `UNKNOWN`、manifest 记录 unknown，整体 cleanup 失败。四个实际 Android suite 的 `afterAll` 仅在全部自身清理成功后输出完成标记：

- `tools/terminal-automation/journeys/sampleConsole.android.test.ts:205-206`
- `tools/terminal-automation/journeys/agentCapabilities.android.test.ts:172-173`
- `tools/terminal-automation/journeys/geometry.android.test.ts:223-224`
- `tools/terminal-automation/journeys/f4Performance.android.test.ts:562-563`

直接反例测试已补在 `tools/terminal-automation/test/runner.test.ts`：跨 stdout/stderr 交错的分片失败标记仍失败；缺完成标记为 UNKNOWN；显式完成为 PASS；失败覆盖完成。**测试未运行。**

**边界：**没有新增父进程设备恢复、按端口清理或未知资源处理；父进程仍只清理 manifest 拥有的进程与 APK build 目录。Android adapter/设备运行不在本轮证明范围。

### N-1 — selector 推送诊断形状及表单步骤定位

**分类：CONFIRMED。** R-13 要求失败报告保留最后相关推送与失败步骤。Runtime selector event 的真实 body 是 `subscriptionId/sequence/valueState/value|reason`；旧投影只识别 request/journal 形状，会丢弃实际 selector 推送。`enterFormValues` 原先将多个 testID 拼成逗号串，超过诊断白名单字符集后会退化为 `journey.step.unclassified`。

**最小修正：已完成。** `tools/terminal-automation/src/journeyFailureDiagnostics.ts:24-56` 接受真实 selector event，只投影安全的 subscriptionId、sequence、JSON/NON_JSON 状态及受控 reason 类别，不保存 `value` 或原始 reason 正文。`tools/terminal-automation/src/virtualKeyboardInput.ts:39-43,59-64` 在逐字段输入前提供步骤回调；`tools/terminal-automation/src/journeyUiPort.ts:13-14,36-42` 为每个字段记录单独的安全标识，非法标识使用字段序号，不再拼接列表。

直接反例测试已补：`tools/terminal-automation/test/journeyFailureDiagnostics.test.ts` 送入真实 selector event 并断言保存元数据、不泄漏 selector value；`tools/terminal-automation/test/journeyUiPort.test.ts` 断言安全 testID 与逗号字段分别得到可定位步骤。**测试未运行。** 截图遮蔽不可用时继续记录 `NOT_SAVED_REDACTION_UNAVAILABLE`，不保存原始截图。

### N-2 — selector 数组的 accessor 与自定义 prototype

**分类：CONFIRMED（静态边界缺口；未认定为当前业务 selector 已发生故障）。** R-05 要求返回值可 JSON 化且不得静默改写。旧数组路径直接读 `value[index]` 并允许自定义数组 prototype；getter 可在校验与 JSON.stringify 间返回不同值，继承的 `toJSON` 也可重写数组正文。当前已注册 selector 是否会返回这些形态未由本轮运行证明。

**最小修正：已完成。** `apps/terminal/ui/base/automation-agent/src/application/runtimeRequestHandler.ts:96-103,132-136` 对数组索引使用 own property descriptor，拒绝 accessor 且不执行 getter；数组 prototype 必须是原生 `Array.prototype`，否则返回受控 `NON_PLAIN_ARRAY`。普通数组仍由原有路径处理，无新增 serializer。

直接反例测试已补在 `apps/terminal/ui/base/automation-agent/test/runtimeRequestHandler.test.ts`：索引 getter 不得运行且结果为 NON_JSON；带继承 `toJSON` 的自定义数组 prototype 被拒绝且 `toJSON` 不得运行；原有普通数组 JSON 正例保留。**测试未运行。**

## 当前证据与剩余项

- 本记录是主 agent 的 source-level finding intake 和修复说明，不是独立 reviewer verdict。
- 三项 finding 的静态问题均已修正并有对应测试源码；源码、测试源码存在不代表测试通过。
- 当前字节上的测试、编译、构建、verify 与全部动态运行：`NOT_RUN`。不得沿用历史证据为本轮修正背书。
- Claude 原 `NO-GO, M/S/N=0/1/2` 对应其评审快照；本 intake 不改写该 verdict，也不宣称修订后 `GO`。请按当前字节独立复评。
