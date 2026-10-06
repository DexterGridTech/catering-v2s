# TER automation-agent CP-04 当前字节对账输入

## 范围与权威判据

CP-04「旧 ID 主旅途与 application 执行面」，依据正式需求 R-17、详设 §4.4 与实施计划 §6，以及 2026-10-06 Dexter 收敛的“两个 sample 主旅途、integration Expo Web 后对应 Android application，并在 console 同一 Runtime 验证一个 TDP DEV-DATA-01 selector 场景”执行范围。主旅途之外场景仍记 `NOT_RUN`。

## 当前字节 focused proof

完整记录见 [`2026-10-06-ter-automation-agent-cp-04-proof.log`](2026-10-06-ter-automation-agent-cp-04-proof.log)。2026-10-06 18:36 KST：

| 执行 | 实际结果 |
|---|---|
| `yarn workspace @catering-v2s/kernel-base-terminal-data-client test` | 8 files / 54 tests PASS，PROD，exit 0 |
| `node --test scripts/dev/r5-managed-terminal-binding-readback.test.mjs` | 3 tests PASS，exit 0 |

较早的 CP-04 log 另记录 operations fixture focused suite 4 files / 13 tests PASS。上列 proof 证明 owner fixture 与 managed binding parser 的 focused 行为，不代替 Web/Android 主旅途或 TDP selector 动态场景；这些结果须从当前 manifest-bound run 记录核实。

## 独立阶段判定

## Fresh 独立阶段复查请求（当前待 reviewer）

上一次 fresh verdict 为 `OPEN`，原因仅为主旅途 manifest 早于当前 journey 字节。之后没有改变 CP-04 被测源；受管入口已对当前字节重新完成 Web console、Web wallpaper、Android console、Android wallpaper 四个主旅途，console 两平台均包含真实 `DEV-DATA-01` selector 变化。各 manifest `business=PASS`、`cleanup=PASS`，首败已在 proof log 保留，定位根因是 runner 查询的 dev-host surface 定位标识前缀错误；修复与 focused proof 也列在同一 proof log。

请 fresh reviewer 复核上述当前字节 manifest/log 与 owner 前缀实现，并给出本 CP 结论；作者不自判 MATCHED。

## Fresh 独立阶段结论

- Reviewer：`/root/cp04_reconcile`，fresh、只读；未运行命令。
- 结论：`CP-04=OPEN`。
- reviewer 确认新增本地 focused proof 只覆盖 TDC owner/parser 与 managed binding readback，不足以替代 CP-04 要求的当前字节 Expo Web、Android application 主旅途及 console TDP selector 场景。
- `.runtime/terminal-automation/` 中现有 Web/Android 旅途均有 PASS/PASS manifest，但审查发现相关旅途源文件 mtime 晚于这些运行；故不作为当前 CP-04 PASS。
- 最小关闭动作：依计划顺序先运行当前字节 console/web 与 wallpaper/web，再分别运行对应 Android application 同一主旅途，并在 console 两平台会话中核实 TDP selector 数据变化；每次 business/cleanup 独立 PASS 后再让 fresh reviewer 复核本 CP。
- 该 OPEN 是动态证据陈旧，不是已确认的生产逻辑缺陷；不升级为未授权 Android 专项或全量 DEV-DATA 验收。

## 当前字节 fresh 复核结论 — 2026-10-06

- Reviewer：`/root/cp04_current_byte_reconcile`，fresh、只读；没有运行命令或修改文件。
- 结论：`CP-04=MATCHED`。
- reviewer 核验了 R-17、详设 §4.4、计划 CP-04 顺序、shared fixture、四个当前字节受管 manifest、Web→Android 顺序、两个 console 的 TDP DEV-DATA-01 selector/readback/restore、runner prefix owner 与 focused test。
- 四个 run 均 `business=PASS`、`cleanup=PASS`、`firstFailure=null`，源码更新时间早于运行时间；之前的陈旧证据 OPEN 已关闭。
- F-1 几何专项、F-2 reload/reverse/dual isolation 与非主旅途场景仍为 `NOT_RUN`，属于本次明确排除范围，不计为 CP-04 OPEN。

### 全批 6b 发现后的差量复查（2026-10-06）

- `/root/ter_automation_6b_final` 指出原 Web console `age=37` 主旅途运行后 `sampleConsole.test.ts` 有后续修改，因此不能沿用该运行作为当前字节证据。
- 仅补跑受影响场景：`node ./scripts/test/terminal-automation.mjs --phase journey --platform web --shape mobile --sample console --case normal --age 37`。
- 新 run：`c32f4ee9-e7e5-4c77-a73f-3af21e4ed58d`；manifest `firstFailure=null`、`business=PASS`、`cleanup=PASS`；同会话 `DEV-DATA-01` selector 证明 revision 21→22 并完成原值恢复。详见同目录 `2026-10-06-ter-automation-agent-cp-04-proof.log`。
- 本次只补充受影响的动态证据，没有新增 CP-04 生产代码变化；请 fresh 全批 6b reviewer 复核此差量后给出全批 verdict。

## 6b 差量后的 CP-04 复查

- reviewer：`/root/ter_automation_cp04_delta`，fresh、只读；未运行命令。
- 结论：`CP-04=MATCHED`。
- 6b intake 删除的只是旅途完成后重复检查 PRIMARY surface 的一行硬编码断言；执行前仍由 `prepareWebJourneySurface` 对同一 owner 节点作可见性与拓扑检查。没有改变激活、业务输入/点击、request/selector、fixture 或 cleanup 路径。
- reviewer 复核当前共享 owner/helper、旧失败与根因、四条对应运行及 console TDP selector/readback/restore；四次受管运行不受该删除影响。
