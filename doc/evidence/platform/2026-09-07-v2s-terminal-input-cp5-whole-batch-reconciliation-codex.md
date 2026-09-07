# TER terminal input CP-5 whole-batch reconciliation

```text
CP=CP-5
REVIEW_TARGET=IMPLEMENTATION
IMPLEMENTATION_AUTHORITY=true
EVIDENCE_TIER=STATIC_FOCUSED_THREE_DIMENSIONAL
CP5_RECONCILIATION=PASS
WEB_RUNTIME=NOT_RUN_BY_AUTHORITY
ANDROID_RUNTIME=NOT_RUN_BY_AUTHORITY
APP_ORIENTATION_SCOPE=OUT_OF_SCOPE_INPUT_LOCAL_MEASUREMENT_ONLY
```

## 1. Scope and evidence boundary

This is a new whole-batch reconciliation. It is not a concatenation of CP-0 through CP-4
records. The main agent reopened the two v2 requirements, the sample verification source of
truth, the approved design and implementation plan, the current source/test anchors, and the
required project-memory routes before recording the rows below.

The current user clarification is applied as a scope boundary: this batch does not decide or
change whether the host app is locked to landscape. Input chooses its presentation from the
local frame measured by `InputSurfaceFrame`; Android orientation, Presentation topology, device
policy, host/VM/process and Kiosk policy remain outside the input package.

`MATCHED` below means the current source/evidence is aligned at the static or focused level named
by the row. It does not promote an unrun Web or Android observation to runtime PASS. Rows whose
owning evidence is explicitly dynamic remain `MATCHED (runtime deferred)` only when the design
and evidence correctly preserve that boundary; they are not claimed as executed.

## 2. Requirements-to-design-to-source ledger

| requirement item | approved design / plan | current code or evidence anchor | memory / standard anchor | result |
| --- | --- | --- | --- | --- |
| FORM-1 landscape single-surface local geometry | design §4.1–§4.3; plan CP-1/CP-3 | `apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx#InputSurfaceFrame`; `keyboardHeight.ts#calculateVirtualKeyboardMetrics`; CP-1/CP-3 evidence | terminal architecture/stack; source reread discipline | MATCHED |
| FORM-2 landscape dual-surface independent local geometry | design §4.1–§4.2, §6.1, §11; plan CP-3 | two frame instances consume their own `onLayout`; sample matrix tests; CP-3 evidence | terminal architecture/stack; deterministic context | MATCHED (runtime deferred) |
| FORM-3 portrait single-surface behavior | design §4.2, §6.1, §8; plan CP-3 | portrait frame fixtures in `apps/terminal/ui/feature/sample-member-desk/test/memberDesk.test.tsx`; no input orientation/topology source | terminal architecture/stack; no-device-sniffing rule | MATCHED (runtime deferred) |
| FORM-4 Web resize recomputes local geometry | design §4.2, §4.8; plan CP-3/CP-4 | `apps/terminal/ui/base/dev-host/src/testExpoApp.tsx#SurfaceCanvas` uses responsive untransformed boxes; local-frame tests; browser proof explicitly deferred | rendering/pointer verification pitfall | MATCHED (browser runtime deferred) |
| FORM-5 first frame is unmeasured | design §4.2; plan CP-1 red vector | `InputSurfaceFrame#handleSurfaceLayout`, `InputProvider`; first-frame provider tests; CP-1 evidence | source reread discipline | MATCHED |
| FORM-R1 do not restore app landscape lock | design §4.7, §13 stop boundary; plan CP-0/CP-3 | no orientation edits in this batch; CP-0 boundary audit | deterministic context; terminal architecture/stack | MATCHED |
| FORM-R2 do not pass package.json dimensions | design §1.2, §4.1, §10; plan CP-1/CP-3 | `sample-console/src/assembly.tsx` passes existing `imeInset` only; static source scan | source reread discipline | MATCHED |
| FORM-R3 do not use Dimensions or host window size | design §1.2, §4.2, §13 | input source scan: `Dimensions`, `useWindowDimensions`, `window.innerWidth` have 0 matches; root `onLayout` is used | deterministic context; terminal coding standard | MATCHED |
| FORM-R4 no default baseline before first layout | design §4.2; plan CP-1 | provider/frame first-frame test and no default geometry path | review-checked-existence-not-rendering | MATCHED |
| FORM-R5 no transform-before-hit-area proof | design §4.8; plan CP-3/CP-4 | `SurfaceCanvas` responsive styles contain no logical-canvas transform; CP-4 evidence preserves browser rect as deferred | review-checked-existence-not-rendering | MATCHED (browser runtime deferred) |
| FORM-R6 no hidden secondary surface created by input | design §4.7, §8; plan CP-0/CP-3 | input source has no `PRIMARY`/`SECONDARY`/display topology symbols; no topology code changed | terminal architecture/stack | MATCHED |
| KEY-R1 local frame replaces static surfaceSize | design §1.2, §4.1–§4.3; plan CP-1 | `InputSurfaceFrame#handleSurfaceLayout`; `InputSurfaceSize` not exported; CP-1 evidence | source reread discipline | MATCHED |
| KEY-R2 no Dimensions/device classification | design §1.2, §4.2, §13; plan CP-1 | forbidden-source scan in input production source returned 0 matches for the listed environment APIs | deterministic context | MATCHED |
| KEY-R3 retain alpha/financial sample-only consumers | design §5.3, §6.1, §11; plan CP-3 | `MemberForm#MemberForm` declares `keyboard-alpha-probe` and `keyboard-financial-probe`; focused tests cover numeric→alpha→financial; CP-3/CP-4 evidence | terminal architecture/stack; frontend/input coding | MATCHED |
| KEY-R4 dense full/alpha horizontal token | design §4.3–§4.4; plan CP-2 | `keyboardHeight.ts` has `DENSE_KEY_MIN_WIDTH=32`, `DENSE_COLUMN_GAP=2`; `keyboardLayout.ts` max 10 dense columns; layout tests | terminal coding standard; focus/performance pitfalls | MATCHED |
| KEY-R5 capacity checks both axes | design §4.3, §6.3; plan CP-1/CP-2 | `calculateVirtualKeyboardMetrics` returns width/height/axis capacity; narrow width and height tests | review-checked-existence-not-rendering | MATCHED |
| KEY-R6 no keyboard on first frame | design §4.2; plan CP-1 | `InputSurfaceFrame` gates `VirtualKeyboard` on ready/supported metrics; first-frame test | source reread discipline | MATCHED |
| KEY-R7 stable region/key testIDs | design §4.4, §11; plan CP-2 | `VirtualKeyboard#VirtualKeyboard` derives stable key IDs from `keyboardLayout.ts`; region/key focused tests | frontend/input coding; accessibility/testability | MATCHED |
| KEY-R8 real focus and programmatic focus-next observe owner behavior | design §4.5, §11; plan CP-2 | `useInputField#useInputField` preflight; provider real-focus harness covers pointer and focus-next; CP-2 evidence | review-checked-existence-not-rendering; independent review | MATCHED |
| KEY-R9 probes never enter business payload/state | design §5.3, §6.1, §7; plan CP-3 | `MemberForm` submit/cancel reads name/phone explicitly; probe submit and consumer-search tests; S-38 tests unchanged | terminal architecture/stack; source reread discipline | MATCHED |
| PF-1 key component render protection | requirements §6; design §11; plan CP-4 | focused input/keyboard tests and render structure; no PF-7 runtime claim | focus/performance pitfalls; frontend/input coding | MATCHED (architecture/focused evidence) |
| PF-2 only focused field render protection | requirements §6; design §5/§11; plan CP-4 | local registry/controller separation and focused tests; no frame-time claim | focus/performance pitfalls | MATCHED (architecture/focused evidence) |
| PF-3 no command dispatch during edit | design §5.3, §7; plan CP-3/CP-4 | probe edits do not call sample commands; submit-boundary tests | terminal architecture/stack | MATCHED |
| PF-4 one command per submit | design §5.2, §6; plan CP-3/CP-4 | fixed field reads and focused submit tests; command owner unchanged | source reread discipline | MATCHED |
| PF-5 cancel leaves business variables unchanged | design §5.3, §6; plan CP-3/CP-4 | MemberForm cancel/cleanup tests; probes are registry-only | frontend/input coding | MATCHED |
| PF-6 animation work stays off key JS path | requirements §6; design §11; plan CP-4 | architecture has no animation work in key handler; no latency claim | focus/performance pitfalls | MATCHED (architecture evidence) |
| PF-7 rapid typing observation | requirements §6; design §11; plan §7.2 | not run or authorized; CP-4 evidence records the boundary | deterministic context; runtime evidence standard | MATCHED (runtime deferred) |
| PF-8 no synchronous heavy key-path work | requirements §6; design §5/§11; plan §7.1 | focused/static source review of key path; no PF-7 substitution | focus/performance pitfalls | MATCHED (static evidence) |
| S-30 dual-screen age uses numeric virtual keyboard | sample verification §9.2; design §6/§11; plan CP-3 | `memberDesk.test.tsx` age/customer fixture and `CustomerMember`; CP-3 evidence | terminal architecture/stack | MATCHED (runtime deferred) |
| S-31 single-surface handheld age uses numeric virtual keyboard | sample verification §9.2; design §6/§11; plan CP-3 | handheld-confirm fixture and same `CustomerMember` field path | terminal architecture/stack | MATCHED |
| S-32 empty age confirms with empty age | sample verification §9.2; design §5/§6; plan CP-3 | `sampleAssembly.test.tsx` and existing confirm path; no age required guard added | source reread discipline | MATCHED |
| S-33 entered age becomes Member.age | sample verification §9.2; design §5/§6; plan CP-3 | confirm actor age normalization and focused sample test | terminal architecture/stack | MATCHED |
| S-34 editing age is not readable from PRIMARY | sample verification §9.2; design §5.2/§7; plan CP-3 | snapshot remains surface-local; sample focused test observes no PRIMARY read | deterministic context | MATCHED |
| S-35 reject discards age | sample verification §9.2; design §5.2/§6; plan CP-3 | reject path test and no business-store age write | source reread discipline | MATCHED |
| S-36 age field complete visible after keyboard/shrink/scroll | sample verification §9.2; design §4.3, §4.6, §11; plan CP-2/CP-3 | `InputScrollArea#ensureVisible`, local geometry/scroll tests; physical/browser result deferred | review-checked-existence-not-rendering | MATCHED (focused evidence; runtime deferred) |
| S-37 confirm/reject/hand-back remain actionable | sample verification §9.2; design §4.1, §6.3, §11; plan CP-3 | same-surface action tests and frame/content shrink assertions | review-checked-existence-not-rendering | MATCHED (focused evidence) |
| S-38 withdrawal race has three business oracles | sample verification §9.2; design §5.3, §6, §11; plan CP-3 | `sampleAssembly.test.tsx` observes secondary welcome, later confirm no registration, no age residue | terminal architecture/stack; source reread discipline | MATCHED |
| S-39 unsupported narrow frame has no dead focus | sample verification §9.2; design §4.2/§4.3/§6.3; plan CP-1/CP-3 | narrow frame test observes no virtual dock, visible recovery/actions, optional age semantics | review-checked-existence-not-rendering | MATCHED |

## 3. Consumer matrix and public-boundary reconciliation

| matrix item | design / plan | current source/evidence | result |
| --- | --- | --- | --- |
| landscape PRIMARY staff-auth full | keyboard redesign §9.1; design §6.1; plan CP-3 | `sample-staff-auth` uses full virtual fields; package test/typecheck PASS | MATCHED |
| landscape PRIMARY member-form numeric/alpha/financial | keyboard redesign §9.1; design §5.3/§6.1 | `MemberForm` has phone numeric plus two registry-only probes; focused actual edit path | MATCHED |
| landscape SECONDARY customer-member numeric age | keyboard redesign §9.1; design §6.1 | `CustomerMember` age field is numeric and is tested on secondary fixture | MATCHED (runtime deferred) |
| portrait PRIMARY staff-auth full | keyboard redesign §9.1; design §6.1 | portrait sample fixture keeps staff auth on local primary frame; no app orientation code changed | MATCHED (runtime deferred) |
| portrait PRIMARY member-form numeric/alpha/financial | keyboard redesign §9.1; design §6.1 | portrait fixture covers all three fields; same MemberForm code path | MATCHED |
| portrait PRIMARY handheld-confirm numeric age | keyboard redesign §9.1; design §6.1 | handheld fixture uses same CustomerMember age path | MATCHED |
| no alpha/financial SECONDARY consumer | keyboard redesign §9.1; design §5.3 | probe declarations are inside MemberForm; no CustomerMember/secondary probe | MATCHED |
| no public static-size bridge | surface requirements §5/§7; design §5/§10 | `input/src/index.ts`, `types.ts`, invariants, assembly bridge; `InputSurfaceSize` is not exported | MATCHED |
| imeInset remains a platform fact | design §4.7/§7/§13; plan CP-0 | assembly passes existing `imeInset`; no input-owned Android orientation/topology change | MATCHED |
| no input feature/business/topology import | design §1.2/§4.7/§13; plan CP-0/CP-1 | production input source scan returned 0 matches for feature/command/display-mode forbidden terms | MATCHED |
| no `className` in feature production source | approved visual design boundary; plan CP-2/CP-4 | static gate `P_5D_UI_FEATURE_NATIVE_ELEMENTS=PASS`; feature source scan | MATCHED |

## 4. Design and plan coverage

| design/plan obligation | current source/evidence anchor | result |
| --- | --- | --- |
| design §4.1 frame tree and provider relationship | `InputSurfaceFrame#InputSurfaceFrame`; provider wraps content and keyboard sibling; CP-1 evidence | MATCHED |
| design §4.2 local `onLayout`, first-frame, resize | `InputSurfaceFrame#handleSurfaceLayout`; `InputProvider` metrics lifecycle; CP-1 tests | MATCHED |
| design §4.3 exact geometry constants/formula | `keyboardHeight.ts#calculateVirtualKeyboardMetrics`; geometry tests | MATCHED |
| design §4.4 four layouts, rows, stable key IDs, regions | `keyboardLayout.ts#getKeyboardLayout`; `VirtualKeyboard#VirtualKeyboard`; CP-2 tests | MATCHED |
| design §4.5 owner/preflight/LayerStack focus boundary | `InputProvider`; `useInputField`; `LayerStack`; focus boundary context; CP-2 tests | MATCHED |
| design §4.6 scroll after content shrink | `InputScrollArea#ensureVisible`; scroll fixtures and no-ancestor behavior | MATCHED |
| design §4.7 Android fact boundary | assembly `imeInset` bridge; CP-0 evidence; no orientation/topology edits | MATCHED |
| design §4.8 Web pointer subtree | `SurfaceCanvas` no-transform responsive styles; browser rect observation deferred | MATCHED (browser runtime deferred) |
| design §5 public API and snapshot boundary | `types.ts`, `index.ts`, `snapshot.ts`, invariants; package typecheck | MATCHED |
| design §6 IA/business matrix | MemberForm, StaffLogin, CustomerMember, focused consumer tests | MATCHED |
| design §7 declaration/transfer/consumption | local metrics, imeInset, owner, geometry, snapshot tables; current symbols | MATCHED |
| design §8 owner points | `InputSurfaceFrame`, provider, layout, scroll, MemberForm, existing carrier | MATCHED |
| design §9 owner API/consumer list | current symbol anchors and package tests | MATCHED |
| design §10 synchronized changes | source, tests, README, invariants and evidence updated in CP-1..CP-4 | MATCHED |
| design §11 acceptance/red vectors | CP-1..CP-4 focused tests, static/model red evidence; dynamic rows deferred | MATCHED |
| design §12 migration/seed/unresolved boundary | CP-4 evidence and design §12; no migration/seed introduced | MATCHED |
| design §13 stop conditions | CP-0 boundary audit, no app orientation/topology changes, no fallback | MATCHED |
| design §13b stage/whole three-dimensional reconciliation | this CP-5 ledger and fresh independent review gate | MATCHED (pending fresh review) |
| design §13c code↔design separate gate | reserved for CP-6; no CP-5 PASS claim for it | MATCHED (scheduled) |
| plan CP-0 boundary audit | `doc/evidence/platform/2026-09-07-v2s-terminal-input-cp0-boundary-audit-codex.md` | MATCHED |
| plan CP-1 local measurement/capacity | CP-1 evidence with fresh PASS | MATCHED |
| plan CP-2 keyboard/focus/scroll | CP-2 evidence with fresh PASS | MATCHED |
| plan CP-3 consumers/Web tree | CP-3 evidence with fresh PASS; browser runtime deferred | MATCHED |
| plan CP-4 focused/static/red vectors | CP-4 evidence `CP4_RECONCILIATION=PASS`, 8 package outputs and separated model red vectors | MATCHED |
| plan CP-5 fresh whole-batch review | this ledger requires a new independent read-only reviewer; status remains pending | MATCHED (pending fresh review) |
| plan CP-6 separate code↔design gate | not started; must be completed after CP-5 PASS | MATCHED (scheduled) |
| plan stop conditions and evidence tiers | current evidence explicitly separates static/focused, Web, Android, and model red vectors | MATCHED |

## 5. Required unverified runtime boundaries

The following remain unrun by authority and are deliberately not converted to production or
device PASS in this reconciliation:

- Web browser `getBoundingClientRect`/`elementFromPoint` and actual pointer hit regions.
- Android local frame layout, secondary-surface virtual input, portrait-device behavior and
  physical keyboard interaction.
- PF-7 rapid typing observation in Expo Web and on a real device. PF-1 through PF-6 are not
  sufficient to call UI performance achieved.
- Real POS hardware, vendor ROM behavior, physical DPI/resolution/performance, and any device
  orientation/topology claim.

The current clarification does not authorize changing those boundaries. It only confirms that
input must remain local-frame-driven and must not require the App to be orientation-unlocked.

## 6. Whole-batch verdict gate

```text
FRESH_INDEPENDENT_REVIEW_REQUIRED=true
REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=TERMINAL_INPUT_V2_IMPLEMENTATION_2026-09-07
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
CP5_RECONCILIATION=PASS
INDEPENDENT_MATCHED=76
INDEPENDENT_OPEN=0
CP6_ADMISSION=ALLOWED_FOR_CODE_TO_DESIGN_RECONCILIATION_ONLY
```

## 7. Fresh independent verdict

```text
REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=TERMINAL_INPUT_V2_IMPLEMENTATION_2026-09-07
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
CP5_RECONCILIATION=PASS
MATCHED=76
OPEN=0
CP6_ADMISSION=ALLOWED_FOR_CODE_TO_DESIGN_RECONCILIATION_ONLY
```

The fresh reviewer reopened the current source, the requirements, the approved design/plan, the
CP-0 through CP-4 evidence and the required memory routes. The reviewer confirmed the local
`onLayout` boundary, first-frame behavior, capacity formula, four layouts and test IDs, real
focus/preflight and focus-next paths, LayerStack boundary, snapshot/age/sample-only boundaries,
S-30..S-39 including all three S-38 oracles, the consumer matrix, and the no-orientation-change
input scope.

The reviewer recorded the following as deferred rather than implementation OPEN: browser
`getBoundingClientRect`/`elementFromPoint`, Android/real-device and secondary-surface runtime,
portrait-device behavior, physical hit regions, and PF-7 rapid typing. PF-1..PF-6 are not thereby
called UI-performance completion. These boundaries remain explicit for CP-6 and the delivery
brief.
