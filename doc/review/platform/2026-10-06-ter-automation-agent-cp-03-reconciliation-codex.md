# TER automation-agent CP-03 证据补录与对账

## 范围与状态

- CP：CP-03「全集装配、admin 与 F-4」；判据以实施详设 §4.3、计划 CP-03 为准。
- 上一次 fresh 复核：`OPEN`。复核者未发现代码或行为缺口；指出 package test/typecheck 没有可留存 transcript，且 F-4 manifest 没有当前源码身份绑定。
- 本记录补齐本地 focused proof 的原始命令输出，并补充可复算的当前 CP-03 源码快照摘要与 F-4 输入范围核对。作者不在此自判 CP-03 `MATCHED`，须由 fresh reviewer 复核本完整 CP 后给出结论。

## 当前 focused proof

命令及完整输出见同目录 [`2026-10-06-ter-automation-agent-cp-03-proof.log`](2026-10-06-ter-automation-agent-cp-03-proof.log)。2026-10-06 08:20 KST 顺序执行，均退出码 0：

| 命令 | 实际结果 |
|---|---|
| `yarn workspace @catering-v2s/ui-integration-sample-console test` | PROD，10 files / 66 tests，PASS |
| `yarn workspace @catering-v2s/ui-integration-sample-wallpaper-console test` | PROD，6 files / 36 tests，PASS；包含新增 wallpaper 关闭态装配断言 |
| `yarn workspace @catering-v2s/ui-base-integration-assembly test` | PROD，7 files / 20 tests，PASS |
| `yarn workspace @catering-v2s/ui-base-admin-shell test` | PROD，19 files / 67 tests，PASS |
| `yarn workspace @catering-v2s/ui-integration-sample-console typecheck` | PASS，退出码 0 |
| `yarn workspace @catering-v2s/ui-integration-sample-wallpaper-console typecheck` | PASS，退出码 0 |
| `yarn workspace @catering-v2s/application-android-sample-terminal typecheck` | PASS，退出码 0 |
| `yarn workspace @catering-v2s/application-android-sample-wallpaper-terminal typecheck` | PASS，退出码 0 |

Wallpaper focused test 位于 `apps/terminal/ui/integration/sample-wallpaper-console/test/sample2Assembly.test.tsx`，断言 Runtime 恰有一个 automation-agent descriptor、默认关闭、出现 `connection.disabled` 且不出现 `connection.opened`。这补的是计划指定的 package-owned 装配证明；没有复制 sample-console 的整套测试。

## F-4 受管运行证据

本次未重跑 F-4。沿用现有、且 CP-03 相关实现未变的受管证据：

| 面 | run id | Business / cleanup | 直接结果 |
|---|---|---|---|
| Expo Web F-4a | `6e1b2dd7-44e2-432f-8e65-02338553db2f` | PASS / PASS | `TERMINAL_AUTOMATION_F4A_PASS width=1280 height=720 maskedRows=2 differingPixels=0` |
| Android mobile F-4b | `d173417b-91bf-4601-ba00-56674d82320e` | PASS / PASS | 查询 P95 2.629 ms / max 3.807 ms；flush P95 1.179 ms / max 2.084 ms；128 subscriptions；cleanup 后 0 |
| Android dual F-4b | `4c82ebe9-5b28-445f-b32b-e595969964b0` | PASS / PASS | 查询 P95 4.723 ms / max 6.558 ms；flush P95 1.280 ms / max 1.848 ms；128 subscriptions；cleanup 后 0 |

Android dual 的实际执行路径已按显示形态区分：dual/laptop 从 `terminal.admin:section:runtime` 进入 Runtime 页，mobile 使用下拉菜单；同名节点按 `surface=PRIMARY` 定位，失败时记录实际匹配 surface。该修正遵循详设要求操作真实节点和按 surface 消歧，没有增造页面行为。Android mobile 与 dual 的性能结果来自不同 manifest；不以 Web 或单屏代替双屏。

F-4 manifest 原始记录没有当时的源码树 hash，因此这里不声称 run 是由当前全仓字节 hash 绑定。可核对的边界是：F-4 Web 输入文件 `tools/terminal-automation/journeys/f4Visual.test.ts`、`apps/terminal/ui/integration/sample-console/test-expo/App.tsx`，以及 Android dual 输入 `tools/terminal-automation/journeys/f4Performance.android.test.ts`、`apps/terminal/application/android/sample-terminal/android/app/build.gradle`，其当前字节摘要与文件修改时间记录如下；相关输入均早于对应 run。F-4 之后新增的 CP-03 代码证明是 wallpaper assembly 单测，未改 F-4 执行代码或被测 sample-terminal 页面。每个摘要仅绑定列出的文件，不冒充运行时 manifest 身份。

| 文件 | SHA-256 | 修改时间（KST） |
|---|---|---|
| `tools/terminal-automation/journeys/f4Visual.test.ts` | `40618eb3fe36d7ca34b9aed94fad17f2fc8534f8696dc05526f4e85391913189` | 2026-10-06 05:02 |
| `apps/terminal/ui/integration/sample-console/test-expo/App.tsx` | `a1f63f924bfb8e700eb64bb995aac61520bb40c812df4bf4eb8a8a65845dadfc` | 2026-10-06 02:16 |
| `tools/terminal-automation/journeys/f4Performance.android.test.ts` | `60faa002378bc43fa4393fcaf2c695ac5ce39fd6f8fd00cbcb259bcc44718747` | 2026-10-06 07:59 |
| `apps/terminal/application/android/sample-terminal/android/app/build.gradle` | `52c08efebc73658d70217f62454b0ee56e01ba886f29ee15b1c2bede15f0946a` | 2026-10-06 03:29 |

当前 CP-03 源码快照复算：对以下路径内的普通文件按仓根相对路径排序，逐文件将「相对路径、NUL、原始字节、NUL」送入 SHA-256；目录名 `node_modules`、`.expo`、`.turbo`、`.runtime`、`build`、`dist`、`.gradle`、`.cxx`、`coverage` 不遍历。路径集合：

```text
apps/terminal/ui/base/automation-agent
apps/terminal/ui/base/integration-assembly
apps/terminal/ui/base/admin-shell
apps/terminal/ui/base/primitives
apps/terminal/ui/base/render
apps/terminal/ui/integration/sample-console
apps/terminal/ui/integration/sample-wallpaper-console
apps/terminal/application/android/sample-terminal
apps/terminal/application/android/sample-wallpaper-terminal
tools/terminal-automation
scripts/test/terminal-automation.mjs
yarn.lock
```

复算输出：`FILES=516`，`SHA256=c72377f19606ad3b2e1695a891bd83b3d7f465eed32d8af7c4bf5a33328819bd`。这只是 CP-03 当前字节的范围摘要，供 reviewer 复核；不是新增 gate、运行 manifest 或治理控制面。

## 结论边界

- F-4 Web、Android mobile、Android dual 的历史受管 run 均保持各自原始 run 身份和 Business/cleanup 结果；本轮没有重新运行受管 UI。
- 本记录新增的测试与类型检查均为本轮实际命令输出，不以口头摘要代替。
- 本记录中的 CP-03 `MATCHED` 是下方 fresh reviewer 的独立结论，不是作者自判。

## Fresh 独立对账结果

- reviewer：`/root/cp03_evidence_recheck`（fresh、只读）。
- 结论：`CP-03=MATCHED`。
- reviewer 核实 transcript 八项命令全部退出码 0；两条 integration 分别有 package-owned 装配测试；两 Android application 配置传递与 typecheck 对上；admin 值 ID 在实际文本节点；三个 F-4 的独立 manifest、业务和 cleanup 及当前输入边界吻合；当前范围摘要与复算一致。
- reviewer 说明 F-4 历史 manifest 没有整棵源码树摘要，但当前记录没有将 F-4 夸大为 manifest-bound 全仓字节证明，而是精确列出其输入文件摘要/时间与后续 wallpaper-only focused test。因此此项不再阻断 CP-03。
- 此结论只覆盖 CP-03，不覆盖 CP-04～CP-06、全批 6b、13c 或最终实施审查。

## F-4a 当前字节差量与复核状态

之后的 fresh 全批 6b reviewer 指出 F-4a 的 `f4Visual.test.ts` 在历史 F-4a run 后又有修改，要求当前字节重跑。旧的 F-4a 结论不再代表当前 runner 字节；上节历史结论保留为历史记录。

- 首次当前字节运行 `2866c59b-42d5-4fac-908b-05cbecee9683`：`VITEST_EXIT_1`，Business FAIL，cleanup PASS。日志显示 `getByTestId('terminal.admin:launcher')` 的 boundingBox 超时 30 秒。
- 根因：runner 硬编码了已退役的 AdminShell testId 字面值；R-14 后实际标识由 AdminShell owner 的 `adminTestIds` 导出。扫描到同族旧值还存在 F-4b 与 geometry runner，因此一并改为消费 owner 导出，不只修单个 F-4a locator。
- 修复后 `yarn workspace @catering-v2s/terminal-automation test`（33 files/149 tests）、driver typecheck 与 AdminShell typecheck 均 PASS；新增的 `@catering-v2s/ui-base-admin-shell/test-ids` 是包内公开窄子路径，未增加第三方依赖。
- 相同 focused 命令 `node ./scripts/test/terminal-automation.mjs --phase f4 --platform web --shape mobile` 的复验 run `be56cf2e-02fb-4540-9a87-47c7f5ca7f13`：manifest `firstFailure=null`、Business PASS、cleanup PASS；日志为 `TERMINAL_AUTOMATION_F4A_PASS width=1280 height=720 maskedRows=2 differingPixels=0`。
- 这次共享 runner 引用修复使历史 F-4b/geometry run 不再作为当前字节证明。本次只执行了 F-4a Web focused proof；Android F-4b 与 geometry 受管运行仍标记为历史证据，当前字节动态状态为 NOT_RUN。
- 本文件更新后须由 fresh reviewer 对 CP-03 受影响范围作差量复核；在该复核前，CP-03 状态为 OPEN，作者不自判 MATCHED。

### Fresh CP-03 差量复核结论

- reviewer：`/root/cp03_delta_review`，fresh、只读。
- 结论：`CP-03 delta=MATCHED`。
- reviewer 核对了失败与复验 run manifest/log、当前 AdminShell `adminTestIds` 导出、四个 runner 的同根改动，以及设计/计划中 F-4 的动态范围。F-4a 当前字节 proof PASS/PASS；F-4b/geometry 本次未运行，按当前批准范围如实保留 `NOT_RUN`，未冒充当前 PASS。
- 此结论仅关闭 CP-03 受影响差量，不替代批次级 6b、最终动态清单、13c 或整批 IMPLEMENTATION review。
