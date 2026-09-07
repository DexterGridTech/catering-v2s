# TER terminal input CP-6 code-to-design reconciliation

```text
CP=CP-6
REVIEW_TARGET=IMPLEMENTATION
IMPLEMENTATION_AUTHORITY=true
RECONCILIATION_KIND=CODE_TO_DESIGN
RECONCILIATION_STATUS=PASS
CODE_TO_DESIGN_RECONCILIATION=MATCHED
WEB_RUNTIME=NOT_RUN_BY_AUTHORITY
ANDROID_RUNTIME=NOT_RUN_BY_AUTHORITY
```

## 1. Gate and scope

This is the separate CP-6 gate required by implementation-design §13c and implementation-plan
§9. It is not the CP-5 three-dimensional reconciliation. The scope is every implementable source,
public-surface, test, README, invariant and evidence anchor named by the approved design/plan;
the table is not a sample.

The user clarification is applied directly: the input package does not own or require App
orientation locks. The code is reconciled against a local `InputSurfaceFrame` measurement and the
existing `imeInset` fact only. No orientation, Presentation topology, host/VM/process, device
policy or Kiosk change is expected in this table.

Each row has one of the only two allowed conclusions: `MATCHED` or `OPEN`. A behavior row is
matched by an observable focused test or a valid runtime boundary, not by a call count, a prop
value, a mock callback, or a transform-before-layout number. Dynamic rows are matched only for
their explicit deferred boundary; they are not runtime PASS.

## 2. Source-anchor ledger

| # | repository path and unique symbol anchor | approved design / requirement | current code observation | evidence anchor | result |
| ---: | --- | --- | --- | --- | --- |
| 1 | `apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx#InputSurfaceFrame` | design §4.1–§4.2; FORM-1..FORM-5 | root `View` owns `onLayout`, local metrics, `InputProvider`, content and keyboard sibling; no public size prop | CP-1 focused evidence; input tests | MATCHED |
| 2 | `apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx#handleSurfaceLayout` | design §4.2; FORM-R3/R4/R5 | width/height come from the root layout event; invalid/first-frame state is not replaced with a default | `keyboardHeight.test.ts`, provider first-frame test | MATCHED |
| 3 | `apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx#InputSurfaceFrameContents` | design §4.1/§6.3; S-37/S-39 | content `Pressable` and virtual keyboard are siblings; unsupported notice is visible; virtual dock is gated by ready/supported | provider/frame focused tests | MATCHED |
| 4 | `apps/terminal/ui/base/input/src/components/InputProvider.tsx#InputProvider` | design §4.1–§4.7; §7/§8 | provider owns local keyboard state, capacity, registry and focus boundary; receives only local metrics and `imeInset` | input typecheck/tests; CP-1/CP-2 evidence | MATCHED |
| 5 | `apps/terminal/ui/base/input/src/components/InputProvider.tsx#commitKeyboardState` | design §4.5; owner transition rules | owner and active field commit together with revision; no second keyboard owner state | provider tests | MATCHED |
| 6 | `apps/terminal/ui/base/input/src/components/InputProvider.tsx#registerField` | design §5.2/§7; snapshot registration | live field controller and registry token are created together; token is not put in actor snapshot | `snapshot.test.ts`, provider tests | MATCHED |
| 7 | `apps/terminal/ui/base/input/src/components/InputProvider.tsx#unregisterField` | design §5.2; stale-unmount rule | token-aware unregister clears only its own field and active/blocked state; stale token cannot remove replacement | `snapshot.test.ts`, provider cleanup tests | MATCHED |
| 8 | `apps/terminal/ui/base/input/src/components/InputProvider.tsx#updateValue` | design §5.2; PF-1/PF-2/PF-3 | edit value is synchronously written to live registry without command dispatch | `provider.test.tsx`, `snapshot.test.ts` | MATCHED |
| 9 | `apps/terminal/ui/base/input/src/components/InputProvider.tsx#updateSelection` | design §5.2; input snapshot selection contract | selection is normalized and stored in the live registry | `snapshot.test.ts`, edit tests | MATCHED |
| 10 | `apps/terminal/ui/base/input/src/components/InputProvider.tsx#updateFieldConfig` | design §5.1/§4.4 | keyboard kind/layout/maxLength update only for the current registration token | provider tests and typecheck | MATCHED |
| 11 | `apps/terminal/ui/base/input/src/components/InputProvider.tsx#preflightFocusTarget` | design §4.5; KEY-R8; N-1 programmatic path | capacity is checked before focus; system→virtual dismisses the old system owner; state passes through none; target focus is not dismissed | real-focus provider harness; CP-2 evidence | MATCHED |
| 12 | `apps/terminal/ui/base/input/src/components/InputProvider.tsx#handleFocus` | design §4.5; KEY-R8 | native focus commits the target owner only after capacity check; unsupported virtual target is blurred and blocked | real-focus provider harness | MATCHED |
| 13 | `apps/terminal/ui/base/input/src/components/InputProvider.tsx#handleBlur` | design §4.5; stale-blur rule | virtual native blur is ignored when it is the deliberate no-IME side effect; stale blur cannot clear a newly committed target | real-focus provider harness | MATCHED |
| 14 | `apps/terminal/ui/base/input/src/components/InputProvider.tsx#blurField` | design §4.5/§6.3 | explicit field blur clears only current owner and dismisses system IME when system owns it | provider tests | MATCHED |
| 15 | `apps/terminal/ui/base/input/src/components/InputProvider.tsx#dismissActiveField` | design §4.1/§6.3; click non-input area | surface content press clears blocked/active state, dismisses system owner and blurs current input | provider/frame tests | MATCHED |
| 16 | `apps/terminal/ui/base/input/src/components/InputProvider.tsx#focusField` | design §5.2; programmatic focus | programmatic focus goes through the same preflight as pointer focus | provider focus-next test | MATCHED |
| 17 | `apps/terminal/ui/base/input/src/components/InputProvider.tsx#completeField` | design §4.5/§5.2; KEY-R8 | next field is found from live registration order, preflight runs before focus, last field is close-only | provider complete/focus-next tests | MATCHED |
| 18 | `apps/terminal/ui/base/input/src/components/InputProvider.tsx#captureInputSnapshot` | design §5.2; PF-3/PF-4 | capture is synchronous and actor-facing; no await/DOM read/token leak | `snapshot.test.ts`, sample submit tests | MATCHED |
| 19 | `apps/terminal/ui/base/input/src/components/InputProvider.tsx#handleKeyboardKey` | design §4.4/§5.2; PF-1/PF-3 | only virtual owner accepts key events; edit result updates presentation and routes complete/close-only | edit/provider/keyboard tests | MATCHED |
| 20 | `apps/terminal/ui/base/input/src/components/InputProvider.tsx#resize cleanup effect` | design §4.2/§6.3; FORM-5/S-39 | virtual owner is blocked and cleared when metrics become unmeasured/unsupported; value and snapshot remain | resize unsupported tests | MATCHED |
| 21 | `apps/terminal/ui/base/input/src/hooks/useInputField.ts#useInputField` | design §5.1–§5.2; PF-1/PF-2 | field edit state, input ref, registry token and controller callbacks are kept per field | input typecheck/tests | MATCHED |
| 22 | `apps/terminal/ui/base/input/src/hooks/useInputField.ts#onPressIn` | design §4.5; KEY-R8/N-1 | pointer focus calls shared preflight before native focus and stops surface press propagation | real focus test; CP-2 evidence | MATCHED |
| 23 | `apps/terminal/ui/base/input/src/hooks/useInputField.ts#onFocus/onBlur` | design §4.5; owner commit/guard | native events delegate to provider; blur guard remains owner-aware | real focus harness | MATCHED |
| 24 | `apps/terminal/ui/base/input/src/hooks/useInputField.ts#complete` | design §5.2; KEY-R8 | complete delegates to provider, which owns focus-next/close-only semantics | provider complete tests | MATCHED |
| 25 | `apps/terminal/ui/base/input/src/hooks/useInputField.ts#inputProps` | design §5.1; system/virtual contract | virtual fields disable system IME and expose selection; system fields retain native IME; no layout on system type | `inputFieldOptions.test.ts`, provider tests | MATCHED |
| 26 | `apps/terminal/ui/base/input/src/components/InputScrollArea.tsx#InputScrollArea` | design §4.6/§7; S-36/S-37 | shared scroll ancestor is provided through context and uses the same PrimitiveScrollView | scroll-area tests | MATCHED |
| 27 | `apps/terminal/ui/base/input/src/components/InputScrollArea.tsx#ensureVisible` | design §4.6; S-36; no double subtraction | measures input and viewport, passes `viewportAlreadyShrunk=true`, no-ops without refs, scrolls only when needed | `scrollIntoView.test.ts`, `scrollArea.test.tsx` | MATCHED |
| 28 | `apps/terminal/ui/base/input/src/model/keyboardHeight.ts#LocalFrameMetrics` | design §4.2; FORM local measurement | internal frame type carries width/height/ready/orientation; it is not a public surface-size bridge | input typecheck and source scan | MATCHED |
| 29 | `apps/terminal/ui/base/input/src/model/keyboardHeight.ts#calculateVirtualKeyboardMetrics` | design §4.3; KEY-R4/R5/R6; S-39 | exact height/ratio/content/width/axis formulas produce unmeasured and unsupported states before supported | `keyboardHeight.test.ts` | MATCHED |
| 30 | `apps/terminal/ui/base/input/src/model/keyboardHeight.ts#geometry constants` | design §4.3; dense-token留白 | constants include 360, 208, 270, 320, .5, 48, 8, 9, 3, 32, 2, 8 as approved | `keyboardHeight.test.ts`; CP-2 evidence | MATCHED |
| 31 | `apps/terminal/ui/base/input/src/model/keyboardLayout.ts#getKeyboardLayout` | design §4.4; KEY-R3/R4/R7 | full/alpha/numeric/financial row data is the single layout source with stable key IDs and dense/standard modes | `virtualKeyboard.test.tsx`, layout tests | MATCHED |
| 32 | `apps/terminal/ui/base/input/src/components/VirtualKeyboard.tsx#VirtualKeyboard` | design §4.4; KEY-R7; PF-1 | row/zone renderer uses PrimitiveButton, stable region/key test IDs, exact key variant and no business props | `virtualKeyboard.test.tsx`, primitives tests | MATCHED |
| 33 | `apps/terminal/ui/base/input/src/model/snapshot.ts#createInputRegistry` | design §5.2/§7; atomic snapshot | live map registers by field ID/token, updates value/selection, ignores stale unregister and captures frozen snapshot synchronously | `snapshot.test.ts` | MATCHED |
| 34 | `apps/terminal/ui/base/input/src/model/editText.ts#applyKeyboardKey` | design §4.4/§5.2; maxLength/edit semantics | text/action/shift/caps/complete behavior uses the same maxLength for virtual editing | `editText.test.ts` | MATCHED |
| 35 | `apps/terminal/ui/base/input/src/types.ts#InputFieldOptions` | design §5.1; public contract | discriminated union forbids layout on system fields and requires layout for virtual fields; maxLength is optional | `inputFieldOptions.test.ts`, typecheck | MATCHED |
| 36 | `apps/terminal/ui/base/input/src/index.ts#public exports` | design §5/§10; public surface deletion | exports frame/provider/keyboard/hooks and input types but not `InputSurfaceSize` or `surfaceSize` | invariants and typecheck | MATCHED |
| 37 | `apps/terminal/ui/base/input/README.md#local measurement and keyboard contract` | design §4.2/§4.3/§5; maintenance boundary | README describes local frame measurement, four layouts, public surface and no host geometry inference | CP-4 source/evidence review | MATCHED |
| 38 | `apps/terminal/ui/base/input/terminal-invariants.json#public exports` | design §5/§10 | invariant public list agrees with current index and no removed size type | `node tools/terminal-skeleton/verify-static.mjs` | MATCHED |
| 39 | `apps/terminal/ui/base/primitives/src/theme/tokens.ts#baseTokens.keyboard*` | design §4.4/§5.1; visual key tokens | keyboard key/action tokens are centralized; no feature `className` or copied token path | primitives static/behavior gate | MATCHED |
| 40 | `apps/terminal/ui/base/primitives/src/components.tsx#PrimitiveButton` | design §5.1; approved additive presentation variant | `default/key/key-action` only changes presentation token/text; testID/onPress/accessibility path remains shared | primitives typecheck/tests; model mutation evidence | MATCHED |
| 41 | `apps/terminal/ui/base/primitives/src/components.tsx#PrimitiveInput` | design §5.1/§11.3; existing public contract plus maxLength | native input remains the automation-bearing node and accepts the approved input props | primitives tests and package typecheck | MATCHED |
| 42 | `apps/terminal/ui/base/primitives/src/components.tsx#PrimitiveScrollView` | design §4.6/§5.1; controlled scroll owner | scroll ref/measure/scroll callback remains the base primitive path; feature does not import raw ScrollView | render/input tests and layering gate | MATCHED |
| 43 | `apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx#SurfaceRoot` | design §4.1/§8; frame seam | `renderContentFrame={({content}) => ...}` remains the sole assembly seam; render does not import input | render tests; sample assembly tests | MATCHED |
| 44 | `apps/terminal/ui/base/render/src/components/LayerStack.tsx#LayerStack` | design §4.5; layer focus owner | existing focus save/suspend/restore order is consumed via boundary context, not duplicated in input | render tests; CP-2 evidence | MATCHED |
| 45 | `apps/terminal/ui/base/render/src/contexts/SurfaceFocusBoundaryContext.tsx#SurfaceFocusBoundaryContext` | design §4.5; render/input dependency direction | context exposes only suspend/restore phases; it does not import input or expose activeFieldId | render typecheck/tests | MATCHED |
| 46 | `apps/terminal/ui/feature/sample-member-desk/src/components/MemberForm.tsx#MemberForm` | design §5.3/§6.1; KEY-R3/R9; PF-3/PF-5 | name/phone business fields remain; alpha/financial probes are registry-only with fixed labels, IDs and cleanup | `memberDesk.test.tsx`; CP-3/CP-4 evidence | MATCHED |
| 47 | `apps/terminal/ui/feature/sample-member-desk/src/components/MemberForm.tsx#submit/cancel reads` | design §5.2/§5.3; sample-only boundary | submit/cancel explicitly read name/phone; probes do not enter Member, PendingMember, command, dirty or confirmation | focused submit/cancel tests; consumer search | MATCHED |
| 48 | `apps/terminal/ui/feature/sample-member-desk/src/components/CustomerMember.tsx#age field` | design §6.1/§7; S-30..S-39 | age is optional virtual numeric with maxLength 3; it is local until confirm and uses existing action nodes | member desk tests; sample assembly tests | MATCHED |
| 49 | `apps/terminal/ui/feature/sample-member-desk/src/features/actors/actors.ts#confirm/reject/withdraw actors` | design §6/§8; S-32..S-35/S-38 | confirm reads normalized age only for live pending; reject/withdraw and late confirm leave no age residue | `memberDesk.test.tsx`, `sampleAssembly.test.tsx` | MATCHED |
| 50 | `apps/terminal/ui/integration/sample-console/src/assembly.tsx#SurfaceInputFrame` | design §4.1/§4.7/§10; FORM-R2 | assembly composes SurfaceRoot/InputSurfaceFrame and transfers existing `imeInset`; static terminal dimensions are not input props | `sampleAssembly.test.tsx`; CP-3 evidence | MATCHED |
| 51 | `apps/terminal/ui/integration/sample-console/src/assembly.tsx#createSurfaceForDisplayIndex` | design §4.7/§8; topology boundary | existing display selection remains assembly/carrier concern; input receives local layout, not display mode/dimensions | sample console typecheck/tests; CP-0 evidence | MATCHED |
| 52 | `apps/terminal/ui/base/dev-host/src/testExpoApp.tsx#SurfaceCanvas` | design §4.8/§6.2; FORM-R5 | surface boxes use responsive untransformed styles; baseline metadata remains display/header fixture data | dev-host tests; CP-3 evidence | MATCHED |
| 53 | `apps/terminal/ui/base/dev-host/src/testExpoApp.tsx#surfaceStyle` | design §4.8; Web pointer boundary | width/flex/aspectRatio/minWidth/flexShrink styles do not create logical-canvas scale transform | source scan/static tests | MATCHED |
| 54 | `apps/terminal/ui/base/input/test/provider.test.tsx#real focus harness` | design §4.5/§11; KEY-R8 | test constructs focusable nodes and observes first pointer focus, target owner and programmatic focus-next; it does not hand-call callbacks as sole oracle | CP-2 evidence; 44 input tests | MATCHED |
| 55 | `apps/terminal/ui/base/input/test/keyboardHeight.test.ts#capacity and formula cases` | design §4.3; KEY-R4/R5/R6; S-39 | tests cover unmeasured, width, height, horizontal and supported outcomes with exact constants | CP-1/CP-2 evidence | MATCHED |
| 56 | `apps/terminal/ui/base/input/test/virtualKeyboard.test.tsx#layout/region/key tests` | design §4.4; KEY-R3/R7 | tests cover four layouts, region IDs, stable key IDs and complete behavior | CP-2 evidence | MATCHED |
| 57 | `apps/terminal/ui/base/input/test/scrollArea.test.tsx#InputScrollArea fixtures` | design §4.6; S-36/S-37 | tests use a real frame wrapper and verify scroll owner/no-ancestor behavior; no double subtraction formula substitution | CP-2/CP-3 evidence | MATCHED |
| 58 | `apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx#S-38 oracles` | design §6/§11; S-38 | test observes secondary welcome, subsequent confirm no registration and no age residue together | CP-3 evidence | MATCHED |
| 59 | `apps/terminal/ui/feature/sample-member-desk/test/memberDesk.test.tsx#S-30..S-37/S-39` | design §6/§11; S-30..S-37/S-39 | fixtures cover customer age modes, layout probes, shrink/scroll/actions and narrow unsupported recovery | CP-3 evidence | MATCHED |
| 60 | `apps/terminal/ui/base/input/src/dependencies.ts#dependency surface` | design §5/§13; no business/topology import | dependency surface remains base-only and does not import feature, command or display topology | package typecheck/static gates | MATCHED |
| 61 | `apps/terminal/ui/base/input/terminal-invariants.json#input invariants` | design §10/§13c; public/test synchronization | invariant entries are synchronized with source public face and test contract | skeleton static gate | MATCHED |
| 62 | `apps/terminal/ui/base/input/README.md#implementation boundary` | design §4.7/§12/§13; handoff maintenance | README records local measurement, imeInset boundary, sample-only probes and deferred runtime claims | source review; CP-4 evidence | MATCHED |
| 63 | `doc/evidence/platform/2026-09-07-v2s-terminal-input-cp0-boundary-audit-codex.md#CP0` | plan §3; implementation boundary | CP-0 records input-only scope and no orientation/topology/device-policy changes | evidence file | MATCHED |
| 64 | `doc/evidence/platform/2026-09-07-v2s-terminal-input-cp1-focused-and-reconciliation-codex.md#CP1_RECONCILIATION` | plan §4; local measurement/capacity | CP-1 fresh independent result is PASS with 10 matched rows | evidence file | MATCHED |
| 65 | `doc/evidence/platform/2026-09-07-v2s-terminal-input-cp2-focused-and-reconciliation-codex.md#CP2_RECONCILIATION` | plan §5; keyboard/focus/scroll | CP-2 fresh independent result is PASS with 15 matched rows | evidence file | MATCHED |
| 66 | `doc/evidence/platform/2026-09-07-v2s-terminal-input-cp3-focused-and-reconciliation-codex.md#CP3_RECONCILIATION` | plan §6; sample/Web structure | CP-3 fresh independent result is PASS with 6 matched rows; browser dynamic remains deferred | evidence file | MATCHED |
| 67 | `doc/evidence/platform/2026-09-07-v2s-terminal-input-cp4-focused-and-static-codex.md#CP4_RECONCILIATION` | plan §7; focused/static/red vectors | CP-4 final fresh independent result is PASS with 12 matched rows and separated model red vectors | evidence file | MATCHED |
| 68 | `doc/evidence/platform/2026-09-07-v2s-terminal-input-cp5-whole-batch-reconciliation-codex.md#CP5_RECONCILIATION` | plan §8; whole-batch gate | CP-5 final fresh independent result is PASS with 76 matched and 0 open; dynamic boundaries remain deferred | evidence file | MATCHED |

## 3. Evidence-tier separation

| evidence class | current conclusion |
| --- | --- |
| Typecheck, focused tests, static gates | Current CP-4 package outputs and gates are recorded as PASS in CP-4 evidence; CP-6 does not relabel them as runtime proof. |
| Model red vectors | Expected mutation failures are recorded separately from the unmutated production tree; they are not production failures. |
| Web runtime | Not run by authority; no browser rect, element-from-point or physical pointer claim. |
| Android runtime | Not run by authority; no secondary-surface, portrait-device, IME, DPI, vendor-ROM or real-POS claim. |
| PF-7 | Not run; PF-1..PF-6 do not justify the phrase “UI performance achieved”. |

## 4. Independent gate

```text
FRESH_INDEPENDENT_REVIEW_REQUIRED=true
REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=TERMINAL_INPUT_V2_IMPLEMENTATION_2026-09-07
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
CODE_TO_DESIGN_RECONCILIATION=MATCHED
MATCHED=68
OPEN=0
DELIVERY_TO_DEXTER_AND_CLAUDE=ALLOWED
```

## 5. Fresh independent verdict

```text
REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=TERMINAL_INPUT_V2_IMPLEMENTATION_2026-09-07
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
reviewerKind=INDEPENDENT_SUBAGENT
CODE_TO_DESIGN_RECONCILIATION=MATCHED
MATCHED=68
OPEN=0
DELIVERY_TO_DEXTER_AND_CLAUDE=ALLOWED
```

The fresh reviewer reopened all 68 ledger rows, the current source anchors, the approved
requirements/design/plan, CP-0 through CP-5 evidence and the required project-memory routes. No
row required an `OPEN` repair. The reviewer independently confirmed that CP-6 did not substitute
CP-5, and that App orientation locking is outside the input package boundary.

The reviewer retained the deferred evidence boundary: Web `getBoundingClientRect`/
`elementFromPoint`, Android/real-device and secondary-surface runtime, physical hit regions,
portrait-device behavior and PF-7 rapid typing were not run by authority. They are not represented
as runtime PASS, and PF-1..PF-6 are not represented as “UI performance achieved”.
