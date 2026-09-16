# TER screenPart 机型解析 · CP-1 execution evidence

```text
SCOPE=CP-1
STEP= A-1 typed failure 与 render ready
AUTHORIZATION=DEXTER_DIRECT_IMPLEMENTATION_AUTHORIZATION
SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787
STEP_STATUS=AWAITING_INDEPENDENT_THREE_DIMENSIONAL_RECONCILIATION
```

## Owning source changed

- `apps/terminal/ui/base/render/src/types/props.ts`
- `apps/terminal/ui/base/render/src/index.ts`
- `apps/terminal/ui/base/render/src/components/resolvePart.ts`
- `apps/terminal/ui/base/render/src/components/ScreenContainer.tsx`
- `apps/terminal/ui/base/render/src/components/ScreenReadyBoundary.tsx`
- `apps/terminal/ui/base/render/src/components/LayerStack.tsx`
- `apps/terminal/ui/base/render/src/foundations/diagnostics.ts`
- `apps/terminal/ui/base/render/test/renderSurface.test.tsx`

The change keeps failure category on the typed value, splits `runtime-unavailable` into
`runtime-not-started`, `runtime-start-failed`, and `surface-host-unavailable`, renders content
failures with visible location text, and lets the target physical PRIMARY report a nullable
`readyPartKey` plus `contentFailure`. System failure pages remain restricted to the target
PRIMARY; transition failures remain neutral and do not report ready.

## Commands and raw results

### First failure

Command:

```text
yarn workspace @catering-v2s/ui-base-render typecheck
```

First output:

```text
src/components/ScreenContainer.tsx(88,15): error TS2322: Type 'SystemFailureReason | "runtime-not-started"' is not assignable to type 'SystemFailureReason | undefined'.
  Type '"runtime-not-started"' is not assignable to type 'SystemFailureReason | undefined'.
src/components/ScreenContainer.tsx(106,20): error TS18048: 'catalogContext' is possibly 'undefined'.
test/renderSurface.test.tsx(1146,34): error TS2339: Property 'partKey' does not exist on type 'Readonly<{ readonly surfaceKey: "PRIMARY"; readonly displayIndex: 0; readonly displayMode: DisplayMode; readonly containerKey: string; readonly readyPartKey: string | null; readonly contentFailure: ContentFailureReason | null; }>'.
```

Broken boundary: the render public type had moved to the new union, while one ScreenContainer
branch and one focused test still treated transition/nullable input as the old system/string shape.

### Focused repair and results

The minimal repair separated the status branches, explicitly narrowed the post-root catalog
context, and migrated the named test callback to `readyPartKey`.

```text
COMMAND=yarn workspace @catering-v2s/ui-base-render typecheck
RESULT=PASS
OUTPUT=(empty)

COMMAND=yarn workspace @catering-v2s/ui-base-render test
FIRST_POST_TYPECHECK_RESULT=FAIL
RESULT_AFTER_REPAIR=PASS
TEST_FILES=12 passed
TESTS=68 passed
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-base-render
```

The intermediate focused failure was an old expectation that an empty PRIMARY container should
show the system startup page, plus the old transition testID. The owning requirement now treats
an empty container as visible content failure, so the test was updated to assert visible
`页面找不到`, no system page, and the new `runtime-not-started` transition ID.

The focused suite includes the independent sequence test
`keeps a content failure ready before a later system failure uses the runtime variant`. It first
lays out a visible `container-empty` content failure and records `{readyPartKey:null,
contentFailure:'container-empty'}`, then removes the renderer binding without remounting the
Provider and observes the runtime failure variant. A second pre-ready missing-renderer fixture
asserts the startup failure variant.

## Evidence status

```text
STATIC=PASS_FOR_CP1_TYPECHECK
FOCUSED=PASS_FOR_CP1_RENDER_TESTS_12_FILES_74_TESTS
NATIVE=OPEN_NOT_RUN
ANDROID=OPEN_NOT_RUN
WEB=OPEN_NOT_RUN
VISUAL=OPEN_NOT_RUN
RELEASE=OPEN_NOT_RUN
CLEANUP=NOT_APPLICABLE
STEP_LEVEL_THREE_DIMENSIONAL_RECONCILIATION=MATCHED
INDEPENDENT_RECONCILIATION=MATCHED
INDEPENDENT_RECONCILIATION_RECORD=doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp1-three-dimensional-reconciliation-beauvoir.md
INDEPENDENT_RECONCILIATION_REVIEWER=01a0a932-afba-7c00-8548-4aa212622141
```

The fresh independent reconciliation found three concrete gaps before CP-1 could close. The
owning render diagnostics and focused fixtures were then minimally repaired: content diagnostics
now carry the required container/form context, `incompatible-catalog-entry` has a real
content-ready test, and a real SECONDARY physical-surface system-failure fixture asserts no
startup page and no splash hide. The repair was re-run with:

```text
COMMAND=yarn workspace @catering-v2s/ui-base-render typecheck
RESULT=PASS

COMMAND=yarn workspace @catering-v2s/ui-base-render test
RESULT=PASS
TEST_FILES=12 passed
TESTS=70 passed
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-base-render
```

The second fresh reconciliation record was read before the latest minimal repairs and remains as
historical `OPEN` evidence. After those repairs, Beauvoir independently re-read the current
source and evidence and returned `CP-1=MATCHED`. The repairs include an explicit
`container-empty` diagnostic with `partKey:null`, a SECONDARY content-failure no-ready/no-hide
fixture, a hostless no-native-ready fixture used as the Web/preview boundary proxy, and a
missing-catalog content-ready fixture.
The restored source was re-verified after the mutations with:

```text
COMMAND=yarn workspace @catering-v2s/ui-base-render typecheck
RESULT=PASS
OUTPUT=(empty)

COMMAND=yarn workspace @catering-v2s/ui-base-render test
RESULT=PASS
TEST_FILES=12 passed
TESTS=74 passed
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-base-render
```

### Real production red mutations

Each mutation was applied only long enough to run the owning focused suite, and the production
source was restored immediately after the failure. The output below is the raw failure summary;
the restored-source PASS is recorded above.

```text
MUTATION=missing-catalog-entry category changed from content to system in resolvePart.ts
COMMAND=yarn workspace @catering-v2s/ui-base-render test
RESULT=FAIL
FAILED_TEST=render surface hosts > treats a missing catalog entry as visible content failure and PRIMARY readiness
FAILURE=expected '终端内容暂不可用' to contain '页面找不到'
EXIT_CODE=1

MUTATION=runtime-not-started changed to system/runtime-start-failed in ScreenContainer.tsx
COMMAND=yarn workspace @catering-v2s/ui-base-render test
RESULT=FAIL
FAILED_TEST=render surface hosts > keeps transition and content failures as distinct typed fallback facts
FAILURE=expected fallback:runtime-not-started but received fallback:runtime-start-failed
EXIT_CODE=1

MUTATION=RenderProvider readiness latch changed from setHasPrimarySurfaceReady(true) to false
COMMAND=yarn workspace @catering-v2s/ui-base-render test
RESULT=FAIL
FAILED_TEST=render surface hosts > keeps a content failure ready before a later system failure uses the runtime variant
FAILURE=testID not found: ui.base.render:runtime-failure
EXIT_CODE=1
```

The mutations prove that the named category, transition, and R-16 sequence assertions are
behavioral rather than string-only checks. The fresh independent reconciliation record
`doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp1-three-dimensional-reconciliation-beauvoir.md`
returned `CP-1=MATCHED`; A-2 is now unblocked.

This evidence does not claim overall implementation acceptance or any native/Web/visual/release
result.

## Post-batch reconciliation amendment

机制批全范围三维对账在
`doc/review/platform/2026-09-16-ter-screen-part-form-resolution-mechanism-batch-reconciliation-fermat-open.md`
发现：`ScreenContainer` 的 resolved content-failure 分支曾把有 placement identity 的
content failure 传成 `partKey=null`。这不是 CP-1 当时分类/可见性 focused 结果失败，而是
跨 ready payload 的身份完整性缺口。主 agent 已按 owning source 将该分支改为传递
`resolution.failure.partKey`，只保留 `container-empty` 的 null 语义；render focused
重验结果如下：

```text
COMMAND=yarn workspace @catering-v2s/ui-base-render typecheck
RESULT=PASS
OUTPUT=(empty)

COMMAND=yarn workspace @catering-v2s/ui-base-render test
RESULT=PASS
TEST_FILES=13 passed
TESTS=76 passed
```

后续 A 批复核必须再次确认该身份沿 console-assembly writer 与两个 integration payload
保持；该 amendment 不把 CP-1 历史证据改写为全批通过。
