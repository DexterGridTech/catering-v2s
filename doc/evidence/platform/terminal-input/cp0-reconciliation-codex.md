# CP-0 逐项三维对账

```text
REVIEW_CYCLE_ID=TERMINAL-INPUT-IMPLEMENTATION-2026-09-06
STEP=CP-0
RECONCILIATION_TARGET=CP-0 production source + run evidence
RECONCILIATION_STATUS=PASS
```

本记录逐项重开冻结需求、输入详设/实施计划、相关项目记忆约束与当前源码/运行证据。
`MATCHED` 是本步骤的唯一闭合值；运行证据与模型/源码证据分开记录。

| 项 | 需求正本 | 详设/计划 | 当前源码与证据 | 结论 |
|---|---|---|---|---|
| PRIMARY system IME | 主屏中文字段可用系统 IME；副屏不是系统 IME 承载面 | 主 Activity `Type.ime()` snapshot 由 adapter 提供；Presentation 不消费系统 IME | `TerminalImeInsetsCoordinator` 只在 primary Activity 创建；最新 run 的 primary `visible=true bottomPx=736` | MATCHED |
| SECONDARY virtual input | 副屏年龄必须走 virtual keyboard | CP-0 只证明不依赖 IME 的虚拟按键回写/提交，不能把它升级成 Presentation IME | 临时 direct RN probe 通过 display 2 的 `showSoftInputOnFocus=false` 目标、两次虚拟按键 length 1/2、提交 length 2；产品边界写入证据 | MATCHED |
| 同一 carrier | 不得第二 host/VM/process/store | 同一 ReactHost + ReactSurface；不改 assembly/bootstrap | `display-snapshot-read`、两个 root、同一应用 PID；无第二 host/React instance 变体 | MATCHED |
| lifecycle ownership | inset listener 必须随 Activity detach/destroy 移除 | primary callbacks 在 primary 生命周期内持有；primary destroy 后与 secondary cleanup 一并归零 | `ensureLifecycleCallbacks` 在 primary delegate 路径注册；idle 条件同时要求 primary null、secondary null、launch false；destroy detach；adapter Gradle 编译 PASS | MATCHED |
| failure boundary | Presentation system IME 失败需保留原始事实，不冒充成功 | 当前产品接受 SECONDARY system IME 非能力；virtual path 单独取证 | 原始 Presentation failure 保留在 `cp0-android-probe-codex.md` §2-3；最新 run 的 `dumpsys.txt` 明确 hidden system IME 是预期边界 | MATCHED |
| temporary probe cleanup | 探路代码不得进入实现交付 | probe 运行后恢复 production App，再进入后续 CP | `rg` 扫 sample-terminal 的 `cp0-probe/ProbeSurface/Virtual 7/Virtual 8/virtual-typed` 为 0；应用 PID 与 8081 owned process 均为空 | MATCHED |
| evidence separation | 编译、静态、运行、cleanup 不得混写 | CP-0 需 run-scoped manifest、命令、日志、dumpsys、build 与 cleanup | `doc/evidence/platform/terminal-input/runs/TERMINAL-INPUT-CP0-ANDROID-VIRTUAL-PROBE-2026-09-06T04-44-29/` 五件工件分开保存 | MATCHED |

独立 CP-0 round 2 在 run artifact 补齐前曾报告证据路径 OPEN；主 agent 已按 finding 重新取证并以当前目录复核。该记录不把旧摘要直接升级为运行证据。
