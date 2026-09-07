# TER Terminal 输入承载形态与虚拟键盘 v2 详设/计划独立审查记录

```text
REVIEW_CYCLE_ID=TERMINAL_INPUT_V2_DESIGN_2026-09-06
REVIEW_TARGET=DESIGN
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
READ_ONLY=true
IMPLEMENTATION_AUTHORITY=false
```

## 1. 输入与边界

本记录对应以下仓根相对路径：

- `doc/plans/platform/2026-09-06-v2s-terminal-input-surface-form-requirements-codex.md`
- `doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-v2-codex.md`
- `doc/plans/platform/2026-09-06-v2s-terminal-input-surface-and-keyboard-implementation-design-codex.md`
- `doc/plans/platform/2026-09-06-v2s-terminal-input-surface-and-keyboard-implementation-plan-codex.md`
- `doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-requirements-claude.md`
- `doc/plans/platform/2026-09-05-v2s-terminal-input-requirements-claude.md`
- 相关 `SurfaceRoot`、`LayerStack`、input、sample、dev-host 与 Android handler/package/device
  源码及 templates、项目记忆路由命中项。

两轮均由 fresh 独立子 agent 只读执行；作者会话没有把自己的预读当作独立 verdict。
本轮没有源码、依赖、Android/Web、DEV、seed、UAT、部署或设备策略实施。

## 2. 第 1 轮

```text
REVIEW_ROUND=1
VERDICT=NO-GO
M=3
S=1
N=0
```

发现的主要问题是阶段三维对账执行者边界、判据正本输入清单不全、Android lifecycle
路径/签名表述不准确，以及 design-time testID 对账指针过窄。作者逐项重开 owning source
后修订了详设和计划：fresh agent 负责每个阶段与全批的最终 `MATCHED/OPEN`，补入
`S-30..S-39` 与 `PF-1..PF-8` 正本，核准 Expo 57 的 `ApplicationLifecycleListener`/
`Package.createApplicationLifecycleListeners(Context)`/`onConfigurationChanged(Configuration)`
接缝，补正 testID 设计时对账边界。

## 3. 第 2 轮（最终独立轮次）

```text
REVIEW_ROUND=2
ROUND_FINAL_DECISION=SELF_DECIDED
INDEPENDENT_VERDICT_BEFORE_DISPOSITION=NO-GO
M=1
S=0
N=0
```

唯一 finding 为 `PARTIALLY_CONFIRMED`：`S-38` 虽在 metadata 和判据正本引用中出现，
但没有进入详设验收表与 CP-3/CP-4/CP-5 的可执行分母。该 finding 的证据来自
`doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-requirements-claude.md`
第 9.2 节：顾客输年龄时店员撤回必须同时证明副屏回 `customer-welcome`、顾客随后确认
不产生登记、store 无年龄残留。

### 3.1 处置

作者已按最小修法更新：

- 详设 §11 增加独立 `S-38` 验收/红向量行，列出三个 business oracle；
- 计划 CP-3 的 sample 业务门明确纳入完整 `S-30..S-39`，并把 `S-38` 的三条 oracle
  设为缺一即 `OPEN`；
- 计划 CP-4 的红向量分档增加 `S-38`，要求真实双屏 actor/controlled sample interaction
  观察三条结果；
- 计划 CP-5 的全批三维对账分母明确包含完整 `S-30..S-39`，并逐项列出 `S-38` 三条 oracle。

作者对修订后的当前 bytes 做了静态 `rg`/上下文复核，确认上述四处均已落位；该复核
不是第三轮独立审查。按独立审查轮次上限，不再召集第三轮，也不把作者处置写成新的
independent `GO` verdict。

## 4. 当前交付状态

```text
DESIGN_AND_PLAN_WRITING=COMPLETE
ROUND_2_FINDING_DISPOSITION=CLOSED_BY_MAIN_AGENT_AFTER_FINAL_REVIEW
THIRD_INDEPENDENT_ROUND=NOT_PERFORMED_BY_REVIEW_LIMIT
IMPLEMENTATION_AUTHORITY=false
IMPLEMENTATION=NOT_STARTED
ANDROID_WEB_RUNTIME=NOT_RUN
```

交付给 Dexter 与 Claude 时，必须以最新详设/计划 bytes 为输入，并保留上述独立 verdict
与处置边界；后续若需实现，仍需单独实施授权。
