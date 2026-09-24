# TER 虚拟键盘优化执行复盘评审请求

## 背景

这是对 TER 虚拟键盘优化已授权实施过程的复盘，不是产品实现交付，也不代表视觉或验收通过。Dexter 已要求停止继续尝试，原 implementation goal 已暂停。当前代码有静态/focused 改动，CP-0 至 CP-3 的步骤证据记录为 MATCHED；CP-4 动态未闭合：双屏与 mobile 的 Android 应用在 launch 后未能稳定读回进程，19 个 IA 帧没有截图或用户可见验证，最近 mobile run `cleanup=NOT_RUN`。Codex 已将完整执行时间线、已证实/未证实项、偏差与修复建议写入复盘报告，请 Claude 独立证伪，不要沿用历史 verdict。

## 评审目标

请核对复盘是否忠实描述：CP-0..CP-4 实际状态；受管 Android run 的 first failure / last known good / broken boundary / business / visual / cleanup；runner 自身假失败与应用进程消失之间的区别；哪些根因仍未知；是否存在继续尝试前应停止的 failure-family/cleanup 边界；以及建议的根因修复方向是否过度扩大 runner、错误归因给产品代码或漏掉安全的更小诊断路径。

特别判断复盘是否正面承认了方法偏差：执行期间测试和诊断 runner 的进度持续增加，但产品层真实可见分母仍为 0/19；CP-4 汇总证据未及时反映最新 mobile run/runner delta；首个 run 的嵌套 `firstFailure.brokenBoundary` 与顶层 `brokenBoundary` 不一致；部分命令/build log 只保存在 `.runtime`；当前复盘是否给出了可信而不过度确定的说明。若证据不足，请明确指出待补的确切字段/文件；不要推断 app crash、系统杀进程、VM 资源不足或键盘规格不可达。

## 需阅读文件

- `doc/review/platform/2026-09-24-ter-virtual-keyboard-optimization-execution-retrospective-codex.md`：本次复盘主报告及 Codex 自我核验项。
- `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-formal-requirements-codex.md`：用户目标、裁定与边界。
- `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-ia-design-codex.md`：19 帧、键位和视觉判据。
- `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-implementation-design-codex.md` 与 `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-implementation-plan-codex.md`：方案契约、CP 门与最终交付条件。
- `doc/evidence/platform/2026-09-23-ter-virtual-keyboard-optimization-cp0-source-reconciliation-codex.md`、`doc/evidence/platform/2026-09-23-ter-virtual-keyboard-optimization-cp1-codex.md`、`doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization-cp2-codex.md`、`doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization-cp3-codex.md`：阶段性源/测试/独立对账证据。
- `doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization-cp4-reconciliation-codex.md`：CP-4 截至 §19 的静态与动态问题时间线；注意报告晚于 §19 的事实可能尚未回写。
- `doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization/android/` 下 `tervk-20260924-063057`、`tervk-20260924-064800`、`tervk-20260924-recovery01`、`tervk-20260924-recovery02`、`tervk-20260924-mobile-diagnostic01` 的 `run-manifest.json`、`events.jsonl` 与可用的 `logs/commands.jsonl`：首败、实际命令摘要、阶段状态与 cleanup。
- 补充运行日志（只读）：`.runtime/ter-virtual-keyboard-android/tervk-20260924-063057/logs/commands.jsonl` 与 `.runtime/ter-virtual-keyboard-android/tervk-20260924-064800/logs/build-sample-terminal.log`、`build-sample-wallpaper-terminal.log`；这些文件没有完整复制到 `doc/evidence`。
- `scripts/test/ter-virtual-keyboard-android.mjs` 与 `scripts/test/ter-virtual-keyboard-android.test.mjs`：runner 当前失败分类/diagnostic helper 及 focused oracle；只读检查，不要运行。
- `project-memory/pitfalls/log-first-failure-retry.md` 与 `project-memory/operations/execution-economics-and-failure-family-closure.md`：失败重试、failure family、执行成本和动态前置原则。

## 独立核验重点

- 19 帧分母是否完整，报告是否明确说明 5 个 run 均无 controlled harness capture、没有视觉帧 PASS。
- CP-0 至 CP-3 的 MATCHED 仅是阶段级静态/focused 结论；CP-4 的旧 MATCHED 是否因后续代码/运行增量而不再代表最新全批。
- `VK_ANDROID_DEVICE_NOT_ONLINE` 是空格/tabs parser 缺陷，不是 VM 离线；`VK_ANDROID_BUILD_ARTIFACT_NOT_REFRESHED` 是 mtime oracle 假失败，不是 Gradle/build 失败。两者不能和用户代码 runtime failure 混为一类。
- `VK_ANDROID_REMOTE_LAUNCH_OWNERSHIP_UNRESOLVED` 的直接事实是 start 返回成功、目标进程 ownership 未能读回；从现有 evidence 是否只能判 app exit/root cause 未知，而不能宣称 app crash 或键盘 bug。
- delayed logcat 的 0 bytes 能否支持“旧证据不足”，而非“没有错误”；mobile 的 `overlayOutcome=ATTACHED` 与后来 `PROCESS_ABSENT` 是否被报告正确区分。
- 最新 mobile run `cleanup=NOT_RUN` 是否明确保持 OPEN；报告有无把 `ownedRemoteProcesses=[]` 错当 cleanup PASS。
- 有无证据支持“runner 诊断工作吞噬用户可见进度”的结论；failure-family freeze、继续第二 app/另一形态的判断是否公平且未过度归责。
- 报告建议是否做到先不 launch、先解决当前 exact run cleanup/诊断，随后仅做一项能区分明确假设的诊断，再回到 19 帧业务/视觉交付；是否有更小、安全的 root-cause 修复方向。
- 分开评定 static、focused、Android/native/device、visual、business、cleanup；不要把 reviewer 或 test PASS 提升为 UI PASS。

## 期望结论

请针对复盘报告给出明确 `GO` 或 `NO-GO`，并独立给出 `M/S/N`。每项 finding 标出精确文件/章节或 manifest 路径、影响、最小修订建议、确定性分类（`CONFIRMED` / `PARTIALLY_CONFIRMED` / `REJECTED_WITH_EVIDENCE` / `UNVERIFIED_REQUIRES_EVIDENCE` / `DEXTER_DECISION`）。若你认为复盘遗漏了关键证据，请指出具体缺项以及为什么会改变根因判断。请勿把该复盘评审 verdict 解释成原实施目标验收通过或继续实施的授权。

建议按 `doc/platform/review-standard.md` §5 交回以下证据分档：`REVIEW_TARGET=EXPERIENCE_RETROSPECTIVE`、`ACTION_1_VARIANT=1-A`、`L1_ENGINEERING`、`L2_USER_VISIBLE`、`L3_UNVERIFIED`、`SAME_ROOT_SCAN`、`DESIGN_GAPS`、`EVIDENCE_TIER`。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请独立评审《TER 虚拟键盘优化执行复盘》。

背景：Dexter 已要求停止继续尝试；原虚拟键盘 implementation goal 目前暂停、未完成。CP-0..CP-3 有步骤级 MATCHED 记录，CP-4 Android 动态启动未闭合，19 个 IA 帧尚无画面验证，最近 mobile run cleanup=NOT_RUN。请只评审复盘诊断和证据口径，不沿用此前设计或实施 verdict。
目标：判断复盘是否准确区分了 runner 假失败、真实应用进程消失和未知根因；是否完整记录阶段、first failure/LKG/broken boundary、业务/视觉/cleanup；方法偏差与整体根因修复方向是否有证据且不过度扩张。

请从 catering-v2s 仓库根阅读：
- `doc/review/platform/2026-09-24-ter-virtual-keyboard-optimization-execution-retrospective-codex.md`：复盘主报告；
- `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-formal-requirements-codex.md`、`doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-ia-design-codex.md`、`doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-implementation-design-codex.md`、`doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-implementation-plan-codex.md`：需求、19 帧分母、实现契约与门；
- `doc/evidence/platform/2026-09-23-ter-virtual-keyboard-optimization-cp0-source-reconciliation-codex.md`、`doc/evidence/platform/2026-09-23-ter-virtual-keyboard-optimization-cp1-codex.md`、`doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization-cp2-codex.md`、`doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization-cp3-codex.md`、`doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization-cp4-reconciliation-codex.md`：CP 证据及最新记录边界；
- `doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization/android/tervk-20260924-063057/`、`.../tervk-20260924-064800/`、`.../tervk-20260924-recovery01/`、`.../tervk-20260924-recovery02/`、`.../tervk-20260924-mobile-diagnostic01/`：逐 run manifest、events 与可用命令日志；
- `scripts/test/ter-virtual-keyboard-android.mjs`、`scripts/test/ter-virtual-keyboard-android.test.mjs`：只读核对当前 runner 失败边界；
- `project-memory/pitfalls/log-first-failure-retry.md`、`project-memory/operations/execution-economics-and-failure-family-closure.md`：失败调查与停止同根重试规范。

请重点核验：19 帧是否确实 0 captured/visual PASS；CP-4 旧 MATCHED 是否覆盖不到后续字节；parser 与 mtime 是 runner 缺陷，而 launch `PROCESS_ABSENT` 根因仍未知；首 run 顶层/嵌套边界字段与运行/证据日志副本是否被如实说明；latest mobile cleanup 是否仍 OPEN；是否在同一失败族未闭合时继续了过多 app 启动/诊断改动；建议的下一步是否先 cleanup/同 run 有界诊断、禁止盲目再 launch，并在根因明确后回到真实 UI 帧核验。

请给出明确 `GO` 或 `NO-GO` 与独立 `M/S/N`，每项 finding 附证据位置、影响、最小修订及确定性分类；并按 `REVIEW_TARGET=EXPERIENCE_RETROSPECTIVE` 提供 L1/L2/L3 未验证项和证据分档。若某事实无法从当前字节确认，请标为 `UNVERIFIED_REQUIRES_EVIDENCE`，不要推测 app crash、系统杀进程、VM 资源不足或规格不可达。

授权边界：本次仅审阅复盘报告；不授权修改源码/测试、运行构建/测试、使用 GUI/computer use、访问或启动/清理虚拟机、重试设备、截图或宣称实施验收通过。原 implementation goal 仍保持暂停，是否恢复由 Dexter 后续明确决定。谢谢。
```
