# Frozen journey runners：fresh 独立三维对账（round 3）

`REVIEW_TARGET=IMPLEMENTATION`

`REVIEW_CYCLE_ID=TER-SAMPLE-INFRA-IMPLEMENTATION-2026-09-15`

`ACTION_1_VARIANT=1-A`

`REVIEWER_KIND=INDEPENDENT_SUBAGENT`

`SUBAGENT_THREAD_ID=01a0a48d-2f0a-7c81-9b81-cccff2fa0b63`

`READ_ONLY=true`

`STEP_RECONCILIATION=OPEN`

`DYNAMIC_VERIFICATION=NOT_ALLOWED_YET`

`M/S/N=3/3/2`

`VERDICT=NO-GO`

## 输入

- `AGENTS.md`
- `PLATFORM-BLUEPRINT.md`
- `doc/platform/README.md`
- 选定 Roadmap 授权字段
- `project-memory/index.md` 及本任务路由命中的项目记忆
- `scripts/README.md`
- `doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-requirements-claude.md`
- `doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-design-codex.md`
- `doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-plan-codex.md`
- 当前源码：`tools/terminal-sample2/run-sample1-frozen-journey.mjs`、`tools/terminal-sample2/run-sample2-frozen-journey.mjs` 及其 owning sample1/sample2 UI、Android、display/surface 依赖

## 独立结论（主 agent 未代写）

已确认当前 `uiautomator dump --windows` 的显式 `<display id>` 选择方式，旧的“只读焦点屏”finding 已被当前源码拒绝；当前 sample1 secondary tap 已从目标树读取 enabled 且有界节点，PRIMARY→SECONDARY 顺序与 per-state inventory 已匹配，sample2 也沿用锁存的 secondary display id。

仍未匹配的最小问题如下：

1. `M-1 CONFIRMED`：logical/SF pairing 的完整身份与每状态锁定不足；当时源码只比 logical secondary name 与 SF virtual name，未锁定 SF primary/virtual 的全部可用 identity/resolution，也未对所有 secondary action 完整复核。
2. `M-2 PARTIALLY_CONFIRMED`：当前 `--windows` 逻辑尚无该源码版本的新动态记录；此前 PASS 早于当前 patch，须重跑并保存每个目标 display 的 raw windows 与 fragment。
3. `M-3 CONFIRMED`：sample2 的业务 oracle 只检查 selected/expected state 与 background presence，未证明实际背景 asset identity；尤其不能以 `backgroundPresent` 证明 w1/w2/w3 的具体资产。
4. `S-1 CONFIRMED`：`--skip-install` 当时允许 stale APK，缺少 local APK 与设备已安装 APK 的 digest/size/binding。
5. `S-2 CONFIRMED`：失败分支只保存 logcat/window/activity，缺少失败时 primary/secondary 的 raw UI tree、fragment 与 display/surface inventory。
6. `S-3 CONFIRMED`：adb 调用丢失 action label，缺少结构化 command/status/stderr/log-path 记录。
7. `N-1 CONFIRMED`：sample2 picker scroll 当时使用固定屏幕坐标，未由真实 scroll 节点边界导出。
8. `N-2 CONFIRMED`：当时允许额外的非 PRESENTATION logical display，未按 mobile/dual 形态 fail closed。

## 对账限制

该记录只表示 fresh reviewer 在本轮源码对账时的结论，不能外推为动态、Android、release、Web、visual、cleanup 或 implementation acceptance PASS。当前主 agent 随后已按 finding 逐项修改源码，修改后的 MATCHED 结论必须由新的 fresh 独立对账产生；在此之前不得开始动态运行。
