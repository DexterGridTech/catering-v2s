# TER 版本更新阶段 C · 整批 review finding intake

日期：2026-10-11。输入为 `doc/review/platform/2026-10-11-ter-version-update-stage-c-final-implementation-review-claude.md`，其原始结论为 `NO-GO，M/S/N=0/4/3`。以下由主 agent 重开需求、详设、计划和 owning source 后形成，供修复差量复核；不代表整批新 verdict，也不替代 13c。

本次范围仅覆盖该 review 的 S-1～S-4、N-1～N-3。未重跑未受影响的设备矩阵、backend-acceptance、CP、6b 或 13c；没有执行 DEV、Expo Web、Android、VM、reset/seed、L2、UAT 或部署。

## Findings

### S-1 · Web HTTP 正文错误沿用 WebSocket 64 KiB 上界

- **Disposition：`CONFIRMED`，已修复。**
- **依据：** 阶段 C 详设 §8.1 将 HTTP decoded 单页上界定为 1,048,576 字节，快照总上界另为 8,388,608 字节；WebSocket 单消息 65,536 字节独立适用。Web adapter 之前把 HTTP response 也限制到 65,536 字节。
- **反例：** 70,000 字节、合法的 HTTP 页面超过 WS 边界但低于 HTTP 页面边界。旧 Web adapter 会拒绝，而 Android HTTP adapter 与 `project-basic` 页面校验允许该页面。
- **最小修正：** `apps/terminal/ui/base/integration-assembly/src/foundations/createBrowserTransportNetworkAdapter.ts` 使用独立的 1 MiB 有界流式读取；超过上界取消 reader 并返回 `BROWSER_HTTP_RESPONSE_TOO_LARGE`。WebSocket 路径未改。`apps/terminal/ui/base/integration-assembly/test/createBrowserTransportNetworkAdapter.test.ts` 覆盖 70,000 字节成功及 1 MiB+1 拒绝。
- **当前证明：** `yarn workspace @catering-v2s/ui-base-integration-assembly test`，7 files / 21 tests PASS（适用改动的 package focused suite）。本轮没有 Web 动态证明。
- **剩余：** Expo Web 的真实 adapter 行为未运行，保持 `NOT_RUN`。

### S-2 · 副机配对断链阻断已固定任务的 grant/恢复

- **Disposition：`CONFIRMED`，已修复。**
- **依据：** 阶段 C 详设 §8.6.3 区分新候选和已经固定的任务：候选必须满足当前投影 readiness；普通配对断链不应撤销仍匹配当前本地 binding/credential 的固定任务。显式解绑、binding 或来源身份变化仍须拒绝。
- **源码事实与反例：** `apps/terminal/kernel/feature/project-basic/src/selectors/selectors.ts` 的候选上下文要求主副投影 ready。已固定任务的 FULL/HOT grant 及 fixed 恢复入口之前复用了该 reader；MASTER 普通离线后 SLAVE 的投影 readiness 变 false，即使本地激活身份与固定任务仍匹配也会拒绝 grant。
- **最小修正：** 增加 `selectProjectFixedTerminalUpdateContextFacts`，复用同一上下文校验，只允许固定任务路径忽略“peer projection ready”这一项；仍要求 peer 身份是 MASTER、当前 binding 与 TDC activation 身份一致、组织路径和已加载规则快照属于同一上下文。候选 selector 保持严格。两套 assembly 只把此 reader 传给 `terminal-update`；其 actor 仅在固定任务 grant 前后使用它，未建立第二套缓存或恢复队列。
- **当前证明：** `projectBasic.test.ts` 覆盖在线资格、离线固定资格、解除配对及 credential/binding 不匹配拒绝；`terminalUpdate.test.ts` 覆盖 strict reader 为 null 时 fixed task 仍继续 grant。`yarn workspace @catering-v2s/kernel-feature-project-basic test` 为 2 files / 13 tests PASS；`yarn workspace @catering-v2s/kernel-base-terminal-update test` 为 3 files / 57 tests PASS；两套 sample assembly 的接线已静态读回。
- **剩余：** 无双机断链动态证明；本轮保持 `NOT_RUN`。

### S-3 · 运营页没有展示 `actual.unknownReason`

- **Disposition：`CONFIRMED`，已修复。**
- **依据：** 需求 R-15 要求实际版本未知时给出原因；当前报告 schema 和 CBS controller 已保存有限原因值。
- **源码事实与反例：** `ProjectTerminalUpdatePage.tsx` 之前只展示 `actual.apkVersion`、`actual.jsVersion` 与任务 `recent.reason`。`READBACK_UNAVAILABLE` 等实际版本读取原因可能已保存，但 UI 仍只显示“未知”，任务原因不能替代它。
- **最小修正：** 新增纯 formatter `terminalUpdateActualUnknownReasonLabel`，仅映射 canonical 的 `READBACK_UNAVAILABLE`、`NOT_INSTALLED`、`MISMATCH`、`OTHER`；最新详情与历史报告分别读取 `actual.unknownReason`。未知值及 null 不伪造原因；列表保持简洁。
- **当前证明：** formatter focused test 覆盖四种值及 null/未知值；`ProjectTerminalUpdatePage.tsx` 最新详情和历史行的属性绑定已静态读回。定向 formatter test 2 tests PASS，operations-admin typecheck PASS。本轮没有浏览器 UI 动态证明。
- **剩余：** UI 动态渲染 `NOT_RUN`。

### S-4 · Android diagnostics 读取失败不进入父 runner 判定

- **Disposition：`CONFIRMED`，已修复。**
- **依据：** 阶段 C 详设 §8.8 要求 diagnostics 与 business、cleanup 分开记录；diagnostics 不可用应使运行诊断结果失败并返回非零，但不能改写业务或 cleanup 事实。
- **源码事实与反例：** Android 主/副机的 runtime/native-update 日志读取失败之前只输出 `LOG_NOT_AVAILABLE`，父 runner 只看 business、cleanup 和 DEV diagnostics；因而缺少设备日志的 run 仍可能得到零退出码。全量读 adb 输出也会受子进程输出上限影响。
- **最小修正：** 四个来源以 runId、role、source、status 和脱敏 code 输出；logcat 读取限定最近 200 行及 512 KiB。`runner.ts` 只读本次 `runner.log` 最后 1 MiB，逐项检查所需来源、缺失、不可用及重复；manifest 独立记录 `diagnostics`，最终 exit code 同时判定诊断与原有 business/cleanup。diagnostics 读取发生在 cleanup 后，诊断失败不会跳过 cleanup。
- **当前证明：** `runner.test.ts` 覆盖受限尾读取、pair 缺失来源导致 diagnostics FAIL/非零，并断言 business 与 cleanup 的输入事实仍为 PASS；`androidDevice.test.ts` 覆盖 `-t 200` 与 512 KiB 参数。`yarn workspace @catering-v2s/terminal-automation test test/runner.test.ts test/androidDevice.test.ts` 为 2 files / 76 tests PASS；之后 runner 注册差量只重跑 `runner.test.ts`，最终 1 file / 50 tests PASS。
- **剩余：** 未重跑 Android 双机 run；历史六个设备 run 的 business 与 runner cleanup 仍按原归档 PASS，诊断缺口未升级为 business failure，也没有宣称修复后设备 diagnostics PASS。

### N-1 · 旧 automation case 仍携带失效的 command payload

- **Disposition：`CONFIRMED`，已通过关闭旧 runner 的 implemented 承诺处置。**
- **源码事实：** 旧 Web/Android case 源码仍在 `tools/terminal-automation/journeys/update.test.ts` 与 `update.android.test.ts` 中以 `{selectionContext}` 调用请求 command；当前 command payload 已是 `{target}`。这些旧 case 在 runner 的 `implementedUpdateCases` 中曾被登记为可运行。当前阶段 C 详设 §9a.5 的真实主 Journey 是 `update.supply-chain` 与 `update.pair`，且通过 project-basic 自动提供完整 target。
- **最小修正：** runner 的当前实现集合只保留 Web `update.artifacts` 和 Android `update.supply-chain`/`update.pair`；失效旧 case 不再被声明为 implemented，runner 在资源预检前 fail closed。未将旧用例改造成新验收路径，也没有扩大旧场景范围。旧测试源码保留作历史定位，不作为当前可运行的 runner 契约。
- **当前证明：** `runner.test.ts` 断言旧 case 返回未实现、两条 Stage C 主 Journey 保持可运行；最终 50/50 PASS。
- **剩余：** 旧测试源码中的调用仍未改写或删除；后续若重新批准这些 case，须先同步 payload 和完整 target 来源。本轮不把它们列入当前 Stage C 的可运行验收。

### N-2 · 规则 topic 初始水位设计与真实 response shape 不一致

- **Disposition：`CONFIRMED`，详设与计划已同步当前契约事实。**
- **源码事实：** `TerminalUpdateRuleSnapshotPage` 只有 `items`、`collectionHash`、`nextCursor`，没有可作为订阅 watermark 的更新时间。实现先登记规则 topic 且 `initialTimeEpochMillis=0`，然后读取完整分页并 flush；完整 HTTP 快照成为初始状态，后续通知按其自身身份/时间处理。
- **修正：** C 详设 §9a 与实施计划 CP-01/CP-03 统一为 subscribe-before-snapshot、首订阅从 0 开始；说明 0 是首次订阅起点而不是更新时间事实，并明确规则页没有更新时间字段。组织三个 exact topic 仍使用各自原始更新时间。
- **剩余：** 文档修正没有增加或改变运行时行为；未做动态通知验证。

### N-3 · `taskMatches=1` 可能被误读为全历史唯一

- **Disposition：`CONFIRMED`，已修复诊断语义。**
- **源码事实：** history helper 只在页内找到目标 task 就停止，因此 `taskMatches=1` 不能证明全历史唯一。
- **最小修正：** `terminalUpdateSupplyUi.ts` 将标记改为 `taskFound`，并保留 `matchingBusinessFacts` 为另一项实际读回计数；添加 request/correlation 与页首尾 sequence/time 诊断，不宣称全历史去重计数。
- **剩余：** 历史唯一性仍由服务端约束/当前业务断言负责；日志中的 `taskFound` 仅表示命中，不是唯一性证明。

## 验证和证据边界

当前字节上已观察到的定向结果：

- `yarn workspace @catering-v2s/ui-base-integration-assembly test`：7 files / 21 tests PASS。
- `yarn workspace @catering-v2s/kernel-feature-project-basic test`：2 files / 13 tests PASS。
- `yarn workspace @catering-v2s/kernel-base-terminal-update test`：3 files / 57 tests PASS。
- operations-admin formatter focused test：1 file / 2 tests PASS；`OperationsRequiredScopeSurface.test.tsx`：1 file / 3 tests PASS。
- terminal-automation `runner.test.ts`：1 file / 50 tests PASS（包含 N-1 更新后的最终运行）。Android diagnostics/device focused 组合在 N-1 变更前为 2 files / 76 tests PASS；S-4 对应源码与测试在之后未变。
- project-basic、terminal-update、operations-admin、terminal-automation typecheck PASS。
- integration-assembly typecheck 当前仍失败，错误位于本轮未改的 `src/foundations/integrationAssembly.tsx:401`、`test/partSelection.test.ts:34`、`test/runtimeOwner.test.ts:104`；未把失败包装为本轮代码 PASS，也未扩展范围修复这些非 finding 路径。
- operations-admin 原 package `test:unit` 调用执行了 65 个文件，其中目录范围分母测试因新增项目终端版本页面而失败；本轮同步其预期项后，仅对该受影响测试定向重跑，3 tests PASS。没有重跑该 package 全量。
- runner focused 曾先后暴露旧 managed-DEV case 断言；扫描并同步同一测试内所有旧 case 期望后，以相同 `runner.test.ts` proof 关闭至 50/50 PASS。第一次 project-basic proof 曾发现新 selector 未注册；补注册后该 package proof 2 files / 13 tests PASS。

**当前字节上的最新运行：** `OperationsRequiredScopeSurface.test.tsx` 定向 Vitest，1 file / 3 tests PASS；工具输出时间 2026-10-11 13:16:20。该结果不是浏览器动态验收。

**最后一次通过：** 同上；当前工作区字节一致。阶段 C 六个历史设备 run 的 business/runner cleanup 归档 PASS 仍是历史运行证据，不是本次修复后运行。

**NOT_RUN / OPEN：** Expo Web、Android/VM 设备行为、backend-acceptance、DEV、完整动态验收、默认或全仓 verify、reset/seed、L2、UAT；integration-assembly package typecheck 尚有上述非本次改动错误。受影响差量的 fresh 独立 review 尚待完成。
