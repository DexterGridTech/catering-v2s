# TER UI 业务可读性 CP-2 implementation independent review

REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=TER-UI-BUSINESS-READABILITY-2026-09-22
REVIEW_ROUND=N
reviewerKind=INDEPENDENT_SUBAGENT
INPUTS=CP-2 requirements/IA/design/plan/evidence；ui-base-render source/tests；member/auth/wallpaper six system-notice renderers/tests

## Round 1 finding intake

两名 fresh 独立 reviewer 对 CP-2 初始实现分别给出：

- `CP2_GATE=GO_WITH_UNVERIFIED_UI`、`M/S/N=0/0/0`：base pair/runner/notice 机械能力与当前 focused proof 已通过；
- `CP2_GATE=NO-GO`、`M/S/N=0/1/0`：确认详设 §5.3 和 §10 表格要求六个 feature system-notice renderer 真正消费 `SystemFailureNotice` 并有六个 feature render proof，而初始源码仍直接使用 primitives。

该 finding 经逐条回源确认属于当前 CP-2 正本，不是 CP-3 可延期项：详设 §5.3 明确写出六个 renderer、profile 和可证伪条件，§10 第 440 行明确要求 six feature render tests。因此按更严格结论处置，不以另一份 GO 抵销。

## Repair

- member `DeskSystemNotice` laptop/mobile、staff `AuthSystemNotice` laptop/mobile、wallpaper `WallpaperSystemNotice` laptop/mobile 全部改为调用 `SystemFailureNotice`。
- laptop 逐项传 `rootStyle={flex:1,minHeight:0,padding:24}`、`cardStyle={width:'100%',maxWidth:720}`、`actionsOrientation='row'`，不传 dismiss style。
- mobile 逐项传 `rootStyle={flex:1,minHeight:0,padding:16,alignItems:'stretch'}`、`cardStyle={width:'100%'}`、`actionsOrientation='column'`、`dismissButtonStyle={{width:'100%'}}`。
- feature hook、dismiss command、wallpaper `operation/phase` 到安全 message 的映射均保留在 feature；base 未接收 raw operation/phase/feature 字段。
- 三包 focused tests 新增六个 profile 的 root/card/actions/dismiss 断言，同时保留 testID、默认 copy、alert role、wallpaper message 断言。

## Fresh re-review after repair

两名 fresh 独立 reviewer 均完成只读复审，结论一致：

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A
VERDICT=GO_WITH_UNVERIFIED_UI
CP2_GATE=GO
M/S/N=0/0/0
EVIDENCE_TIER=static-source + typecheck/LSP + focused package tests + recorded red mutations
L2_USER_VISIBLE=PASS_STATIC_FOCUSED
L3_UNVERIFIED=Web/Android/native/device/visual/L2/dynamic/cleanup
DESIGN_GAPS=NONE
```

## API refinement re-review

在前一轮六 renderer finding 修复后，主 agent 将 `TrackedCommand` 收口为不绑定单一 payload
的 generic `run<TPayload>`，以便 CP-3 的同一 feature hook 精确使用多个现有 command definition。
该 refinement 重新交给两名 fresh 独立只读 reviewer；两份 verdict 均为：

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A
VERDICT=GO_WITH_UNVERIFIED_UI
CP2_GATE=GO
M/S/N=0/0/0
L1_ENGINEERING=PASS
L2_USER_VISIBLE=PASS_FOCUSED_FOR_SYSTEM_NOTICE_PROFILES
L3_UNVERIFIED=Web/Android/native/device/visual/L2/dynamic/cleanup
DESIGN_GAPS=空
```

复核确认 generic runner 保持 `CommandDefinition<TPayload>`/`payload: TPayload` 精确关系，未引入
`any`、cast、fallback、`execute` 或 `requestLabel`；same-tick、running→terminal、stale request、
RETHROW/CONSUME、pair metadata/layer guard、六 renderer profile 和 raw-field negative proof 均仍成立。
当前 base 15 files/96 tests、三包 feature tests/typecheck 均通过。

独立复核确认：六个 renderer 全部直接 import/call `SystemFailureNotice`；六个 profile、testID、默认 copy、dismiss hook、wallpaper phase message 与 base raw-field边界均与正本一致；同根 6/6 renderer、base pair/runner/notice tests 和三包 render tests 均检查通过。

## Focused evidence

- `yarn workspace @catering-v2s/ui-base-render typecheck`：PASS。
- `yarn workspace @catering-v2s/ui-feature-sample-member-desk typecheck`：PASS。
- `yarn workspace @catering-v2s/ui-feature-sample-staff-auth typecheck`：PASS。
- `yarn workspace @catering-v2s/ui-feature-sample-wallpaper-picker typecheck`：PASS。
- base render：15 files / 96 tests PASS。
- member：28/28 PASS；staff：9/9 PASS；wallpaper：16/16 PASS。
- red mutation evidence：`doc/evidence/platform/2026-09-23-ter-ui-business-readability-cp2-red-mutations-codex.md`，已恢复。

CP2_GATE=GO

## Async observer refinement re-review

两名 fresh 独立 reviewer 对最后一次 async observer refinement 均给出：

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A
VERDICT=GO_WITH_UNVERIFIED_UI
CP2_GATE=GO
M/S/N=0/0/0
L1_ENGINEERING=PASS
L2_USER_VISIBLE=PASS_STATIC_FOCUSED_FOR_SYSTEM_NOTICE_PROFILES
L3_UNVERIFIED=Web/Android/native/device/visual/L2/dynamic/cleanup
DESIGN_GAPS=NONE
```

复核确认 `onOutcome`/`onRejected` 的 PromiseLike observer 会被 runner 等待；RETHROW 保留原 dispatch
error，CONSUME 保留消费语义且不被 observer error 改写。五处 feature runner consumer、14 logical
pair/28 bindings、六 renderer 和全部 CP-2 negative proof 均通过同根扫描。CP-2 至此允许进入 CP-3。
