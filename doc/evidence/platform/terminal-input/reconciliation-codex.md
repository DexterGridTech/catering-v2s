# TER terminal input 全批逐代码—详设对账

> HISTORICAL_RECORD=true：本记录对应 2026-09-06 的 CP-0..CP-3 实施状态；2026-09-07
> Web 宿主缩放修复后的当前对账见 `doc/evidence/platform/terminal-input/reconciliation-web-surface-scale-2026-09-07.md`。
> 本文件的历史 PASS 不覆盖后续宿主代码变更，也不替代当前记录。

```text
REVIEW_CYCLE_ID=TERMINAL_INPUT_CP0_CP3_IMPLEMENTATION_2026-09-06
REVIEW_TARGET=IMPLEMENTATION
RECONCILIATION_SCOPE=CP-0..CP-3
CODE_TO_DESIGN_RECONCILIATION=PASS
CODE_SET_REOPENED=2026-09-06
RECONCILIATION_REVISION=2026-09-06-review-remediation
```

这不是 diff 摘要，也不是用 typecheck/测试替代语义检查。主 agent 按实施计划 §9.1 的固定
代码全集重新枚举并按 §9.2 的十一维逐行对照详设、冻结需求、交互设计和适用项目记忆。
当前枚举数量为：input `15` 个 src 文件、render `24` 个 src 文件、primitives `7` 个 src 文件、
sample-console `6` 个 src 文件、dual-screen Android `5` 个 Kotlin/Java 文件、member-desk `20` 个
src 文件、member-registry `10` 个 src 文件；另外逐项纳入各组 package/config、README、invariants、
dependencies、tests 与新增 evidence。

## 逐代码对账

每一行均为 `design anchor → code anchor → proof output → result`；`MATCHED` 是唯一当前允许的
收口值，未把模型红向量当成生产树失败。

### input package

| 维度 | design anchor | code anchor | proof output | result |
|---|---|---|---|---|
| behavior | 详设 §5/§6/§7.2 | `InputProvider`、`useInputField`、`VirtualKeyboard`、`useInputSnapshot` | input 32/32；CP3 Android age/phone path；owner 首击 focused regression | MATCHED |
| shape | 详设 §5、§7.2、§12.3 | `InputSurfaceFrame`、`InputKeyboardState`、snapshot types | input/primitives typecheck PASS；render tree focused | MATCHED |
| actions | 计划 §9.2 actions；详设 INPUT-EDIT-MODEL | `VirtualKeyboard` key handler、`complete` 分支 | complete transition focused PASS；无 per-key command | MATCHED |
| relationships | 详设 §12.1 | input imports primitives/render，不反向 import feature/kernel/adapter | layering/skeleton real static PASS | MATCHED |
| placement | 详设 §7.3、§7.4 | `InputScrollArea`、`measureInWindow`/`scrollTo`、dock sibling | scroll geometry tests PASS；Android secondary bounds | MATCHED |
| user-visible copy | 交互设计 §4/§10 | input 只渲染通用键盘文案，业务文案留 feature | sample focused PASS；input public README | MATCHED |
| limits | 详设 §7.2 CAPACITY-DESIGN | `calculateKeyboardHeight`、`MAX_KEYBOARD_HEIGHT`、ratio dock | formula tests PASS；Android `361/359` split | MATCHED |
| state/control | 详设 §6 snapshot/registry | `FieldRecord.valueRef`、sync capture、token unregister | provider/snapshot/unmount tests PASS | MATCHED |
| failure/recovery | 详设 §4.3、§7.3、§7.4 | native blur boundary、too-small guard、layer suspend/restore | native-blur regression PASS；S-39 focused PASS | MATCHED |
| accessibility/focus | 详设 LAYER-FOCUS-BOUNDARY、KEYBOARD-OWNER-EXCLUSION | `blurField`、focus callbacks、testID path | 受控 native focus/blur harness 观察 virtual→system 首击保持、system→virtual dismiss 与 secondary age focused；去掉 virtual→system owner guard 的 red mutation 失败 | MATCHED |
| data/invalidation | 详设 §6.1/§6.2 | registry ref snapshot、registration token、no React closure read | snapshot atomicity tests PASS | MATCHED |

## 2026-09-06 review remediation

Claude 的实施静态 review 指出一条真实焦点行为缺口、一条测试证明缺口和一条机制文字偏差。
主 agent 重新打开 owning source 后只做最小闭合：

| finding | owning source | 修复 | red proof | 当前结论 |
|---|---|---|---|---|
| M-1 virtual→system 首击可能被全局 dismiss 吞掉 | `apps/terminal/ui/base/input/src/components/InputProvider.tsx` 第 126 至 130 行 | owner 切换仍先经过 `none`，但只在旧 owner 为 `system` 时调用 `Keyboard.dismiss()`；virtual→system 的目标 system input 已收到 focus 后不再被 blur | 去掉 `previous.owner === 'system'` 守卫后，受控 native focus/blur 测试在目标 system focus 断言处失败；恢复后 input 32/32 PASS | MATCHED |
| M-2 owner 测试曾只调用 props 回调 | `apps/terminal/ui/base/input/test/provider.test.tsx` 第 19 至 81、204 至 251 行 | 用受控 native focus harness 建立 active node、旧节点 blur、`Keyboard.dismiss()` 导致 active node blur 的链；同时断言两方向的实际 focus 保持与 owner/dock | 受控去掉生产守卫的 mutation 使首击 system 节点失焦并失败；调用计数不再是唯一证明 | MATCHED |
| N-1 §6.1 的同步机制表述过时 | `doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-design-codex.md` 第 421 至 428 行 | 改为 `editStateRef` 先写、`setEditState` 调度、registry refs 同步写入；snapshot 只读 registry refs，不依赖 setState 调用先后 | input typecheck PASS；input 32/32 PASS | MATCHED |
| 副屏 IME 口径仍需可复核事实 | `doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-plan-codex.md` 第 108 至 121 行 | CP-0 明写 WindowManager display policy/普通应用权限边界、本产品有意不开启；hidden 只作为 `FIRST_FAILURE`/事实边界，不增加 adb/权限/兼容层 | CP-0 原始 hidden evidence 与虚拟键盘回写 evidence 分开保留 | MATCHED |

### render seam

| 维度 | design anchor | code anchor | proof output | result |
|---|---|---|---|---|
| behavior | 详设 §4.1、§4.3 | `SurfaceRoot` content/provider/dock frame | render 37/37 | MATCHED |
| shape | 详设 ONE_FRAME_RENDER_PROP | `SurfaceRoot` renderContentFrame；`SurfaceFocusBoundaryContext` | render tree focused PASS | MATCHED |
| actions | 详设 §4.3 | `LayerStack` suspend/restore event order | layer transition focused PASS | MATCHED |
| relationships | 详设 §12.1 | render ↛ input；context 仅传 suspend/restore | layering P-5A/P-5C/P-5D/P-10 PASS | MATCHED |
| placement | 详设 §4.1 | LayerStack 在 content frame 内，dock 为 sibling contract | render static public/shape PASS | MATCHED |
| user-visible copy | 需求/交互 design owner 表 | render 不持业务文案 | sample-console focused PASS | MATCHED |
| limits | 详设 frame seam 无业务尺寸分支 | render props 只承载 seam 与 surface contract | typecheck/static PASS | MATCHED |
| state/control | 详设 §4.3 | layer opening 先 suspend；closing 等实际 focus restore | layer focused PASS | MATCHED |
| failure/recovery | 详设 LAYER-FOCUS-BOUNDARY | restore 失败不伪造 keyboard owner | input provider tests PASS | MATCHED |
| accessibility/focus | 详设 §4.3 | focus boundary listener 与 native focus owner | render focused PASS | MATCHED |
| data/invalidation | 详设 §4.1 | frame 不复制业务 state、不读取 input package | layering/static PASS | MATCHED |

### primitive contract

| 维度 | design anchor | code anchor | proof output | result |
|---|---|---|---|---|
| behavior | 详设 §5.1 | `PrimitiveInput`、`PrimitiveScrollView` | primitives 7/7 | MATCHED |
| shape | 既有公共面 + 四个 input prop | `components.tsx`、`index.ts`、invariants、README | exact-set static PASS | MATCHED |
| actions | 详设 PrimitiveInput focus seam | ref/focus/blur/maxLength/selection pass-through | primitive focused/typecheck PASS | MATCHED |
| relationships | 详设 RNR copy-in、无 inputMode | primitives 内部实现，不引入 input package | layering/static PASS | MATCHED |
| placement | 详设 §5.1 | ScrollView width full，供 InputScrollArea 测量/滚动 | Android secondary width/content bounds | MATCHED |
| user-visible copy | primitives props 仅呈现 | `accessibilityLabel`/role/children 不含业务字段 | public exact-set PASS | MATCHED |
| limits | maxLength 是通用可选 prop；不暴露 inputMode | `PrimitiveInputProps.maxLength` | age 4 presses → 3 chars | MATCHED |
| state/control | primitive 不持业务 state | component wrappers only | focused primitive tests PASS | MATCHED |
| failure/recovery | testID 必经、ref seam 不可旁路 | `assertTestID`、ref forwarding | public/static PASS | MATCHED |
| accessibility/focus | 详设 focus seam | testID/ref/accessibility props 透传 | primitives focused PASS | MATCHED |
| data/invalidation | 详设 primitive 不知道 age/field | no domain import/prop | layering/static PASS | MATCHED |

### integration assembly

| 维度 | design anchor | code anchor | proof output | result |
|---|---|---|---|---|
| behavior | 详设 §4.2、§7 | `assembly.tsx` surface creation and shared assembly | sample-console 13/13 | MATCHED |
| shape | SurfaceRoot → InputSurfaceFrame | `createSurface` frame render prop | Android primary/secondary tree | MATCHED |
| actions | 计划 CP-3 | surface-level host actions only; input key not business dispatch | sample focused/static PASS | MATCHED |
| relationships | 详设 §12.1 | assembly consumes input; feature remains owner of business | skeleton/layering PASS | MATCHED |
| placement | 需求 §7.1、详设 §4.2 | keyboard follows surface carrying input; primary/secondary declarations | Android display 0/2 evidence | MATCHED |
| user-visible copy | 交互 design | assembly adds no duplicate business copy | sample focused PASS | MATCHED |
| limits | `terminalSurfaces.ts` declarations | PRIMARY/SECONDARY declared dimensions; Web fixed logical canvas | static + Android bounds | MATCHED |
| state/control | 详设 snapshot owner split | assembly shares runtime/store but not edit draft | sample actor tests PASS | MATCHED |
| failure/recovery | 详设 adapter/input boundary | unavailable ports are diagnosed separately; no silent success | Web/Android logs reported separately | MATCHED |
| accessibility/focus | 详设 frame seam | surface roots and input frame remain addressable | Android UI tree/test IDs | MATCHED |
| data/invalidation | 详设 §12.3 | surface size from terminalSurfaces; snapshot from input registry | static + focused PASS | MATCHED |

### Android IME owner

| 维度 | design anchor | code anchor | proof output | result |
|---|---|---|---|---|
| behavior | 详设 §8、CP-0 | `TerminalImeInsetsCoordinator` primary listener | CP0 primary inset evidence; Gradle PASS | MATCHED |
| shape | IME source contract | adapter source exposes visible/bottomLogical only | adapter typecheck/build PASS | MATCHED |
| actions | 详设 CP-0 | attach/detach lifecycle; Presentation does not own system IME | Android logs/window dump | MATCHED |
| relationships | 详设 §12.1 | adapter → frame source；input 不 import Android | layering/static PASS | MATCHED |
| placement | 详设 primary-only owner | primary window consumes IME inset; secondary input frame owns virtual dock | `mDisplayId=0 InputMethod`; display2 virtual tree | MATCHED |
| user-visible copy | adapter no business UI | non-sensitive structured diagnostics only | logs contain no input text | MATCHED |
| limits | logical inset conversion | `bottomLogical` uses host density boundary | CP0 `visible/bottomLogical` evidence | MATCHED |
| state/control | adapter listener lifecycle | no shared business state mutation | Android build/runtime PASS | MATCHED |
| failure/recovery | CP-0 stop/cleanup | listener detach and no Presentation IME assumption | window/input-method evidence | MATCHED |
| accessibility/focus | secondary field focus allowed, system IME not promised | Presentation receives focus; virtual buttons addressable | display2 UI tree focused=true | MATCHED |
| data/invalidation | window/display identity only | no raw text/payload logging | CP0/CP3 evidence and README | MATCHED |

### member feature

| 维度 | design anchor | code anchor | proof output | result |
|---|---|---|---|---|
| behavior | sample §4.5、交互 design §4/§10 | `MemberForm`、`CustomerMember`、actors | member-desk 17/17 | MATCHED |
| shape | 详设 §10 | feature-local components + input hooks; nine parts | source/parts/IA comparison | MATCHED |
| actions | sample S-30…S-39 | submit/confirm/reject/withdraw/retry/abandon actors | sample/member focused PASS | MATCHED |
| relationships | J-1、详设 §10 | no feature↔feature import; owner commands through public API | skeleton/layering PASS | MATCHED |
| placement | §7.1、双/单屏 branch owner | customer age on SECONDARY only when present; handheld on PRIMARY | Android display2 + actor tests | MATCHED |
| user-visible copy | interaction design screen/layer matrix | source component texts/testIDs | focused UI tree and tests | MATCHED |
| limits | age maxLength 3; optional | `CustomerMember` passes `maxLength=3` | age maxLength dynamic + focused | MATCHED |
| state/control | age edit not store; pending owner unchanged | `useInputSnapshot` at confirm; actor reads PendingMember | S-32…S-35 focused | MATCHED |
| failure/recovery | requestOutcome five-state; withdraw race | `running` leaves request loading; failure notice/recovery actors | requestOutcome + member tests PASS | MATCHED |
| accessibility/focus | testID matrix + keyboard focus | field/action IDs, scroll ancestor, hand-back | Android UI tree and focused tests | MATCHED |
| data/invalidation | sample §4.5.3 | age read/normalize only; no generated age; late commands no-op | registry/member tests + README | MATCHED |

### registry owner

| 维度 | design anchor | code anchor | proof output | result |
|---|---|---|---|---|
| behavior | sample §4.5.3 | `confirmMemberCommand`/reject/withdraw actors | registry 9/9 | MATCHED |
| shape | optional `Member.age` and payload | owner types/commands/reducer | registry typecheck/test PASS | MATCHED |
| actions | submit/confirm owner boundary | member desk dispatches public commands only | focused actor/store tests | MATCHED |
| relationships | owner sovereignty | no UI imports into kernel; no feature state copy | skeleton/static PASS | MATCHED |
| placement | business owner not UI surface | no screen/layer/display logic in registry | source/README review | MATCHED |
| user-visible copy | owner has no UI copy | result events only | source review | MATCHED |
| limits | age optional, no actor-generated value | normalize input only; no extra age range | age focused + typecheck | MATCHED |
| state/control | PendingMember/reducer unchanged in forbidden ways | reject retains pending; abandon/withdraw clears | 9/9 + README corrected | MATCHED |
| failure/recovery | first-wins/idempotent late command | competing command after clear is no-op | registry focused | MATCHED |
| accessibility/focus | not applicable to kernel owner | no focus/testID UI concern; command result is consumed by feature | N/A with owner boundary | MATCHED |
| data/invalidation | age source is user payload | no generated age/registeredAt substitution | focused actor/store tests | MATCHED |

## Overall proof separation

```text
FOCUSED_AND_TYPECHECK=PASS
ANDROID_BUILD=PASS
ANDROID_BUSINESS=PASS (双屏模拟器)
ANDROID_CLEANUP=PASS
WEB_BUNDLER_AND_HTTP=PASS
WEB_BROWSER_AUTOMATION=NOT_RUN_BY_AUTHORIZATION
MODEL_RED_VECTORS=FAIL_BY_DESIGN (门抓住变异，不是生产树失败)
REAL_STATIC_TREE=PASS
S-12_WEB_REFRESH=UNVERIFIED_REQUIRES_EVIDENCE
S-26_BROWSER_RESIZE=UNVERIFIED_REQUIRES_EVIDENCE
```

Android/Web 进程已停止且 cleanup PASS。CP-3 fresh round-2 独立审查已按两轮上限完成；其唯一
S finding 已由主 agent 修复并复验，剩余逐项结果为 `MATCHED`。因此本记录的
`CODE_TO_DESIGN_RECONCILIATION=PASS`，并允许生成 review brief。独立审查者的 round-2
最终结果与主 agent 修复说明见 `doc/review/platform/2026-09-06-v2s-terminal-input-implementation-review-brief-codex.md`。
