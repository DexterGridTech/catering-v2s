# CP-0 static baseline repair evidence

`REVIEW_TARGET=IMPLEMENTATION_STAGE_RECONCILIATION`

## First-failure chain

The fresh CP-0/CP-1 reviews first found TR-R04 at `apps/terminal/ui/feature/sample-wallpaper-picker/src/components/WallpaperPicker.tsx:86-92`: `runAction` had five positional parameters. The main agent changed the execution input to one object parameter. Picker focused tests and typecheck then passed.

The next full-baseline run exposed a stale platform-ports public-shape oracle: `PlatformPorts` had gained the optional `startupRunId` identity member, while the checker incorrectly reused `portKeys` for `PlatformPortBindings` and `PlatformPorts`. The checker now reads separate `platformPortsKeys` and `platformPortsOptionalKeys` invariant fields; the binding port set remains unchanged. Platform-ports checker/model, package tests and typecheck passed.

The following full-baseline run exposed a stale ui-state public-surface invariant after adding the layer persistence behavior. The implementation retained the existing ui-state boundary by using the closed persistence union inline in `LayerEntry`; the invalid public alias was removed. ui-state checker/model, package tests and typecheck passed.

The following full-baseline run exposed stale render public-surface inventory for the newly implemented ready/failure/notice and availability exports. The render invariant was updated to enumerate the actual public source surface. Render checker/model passed.

No failure was relabeled. Each finding was fixed at its owning source/invariant boundary and re-run before continuing.

## Current replay

Command:

```text
node tools/terminal-skeleton/verify-static.mjs
```

Result:

```text
READABILITY_STATIC=PASS
RULE_GRAPH_COMPARISON=PASS
RULE_TRIPLE_NAMING=PASS
RULE_DEPENDENCY_DIRECTION=PASS
RULE_DEPENDENCY_DECLARATION_COMPLETENESS=PASS
RULE_RUNTIME_DEPENDENCY_CONTRACT=PASS
RULE_TR01_REDUCER_BOUNDARY=PASS
RULE_KERNEL_PLATFORM_INDEPENDENCE=PASS
SCAFFOLD_HYGIENE=PASS
TERMINAL_CONTRACTS_STATIC=PASS
TERMINAL_PLATFORM_PORTS_STATIC=PASS
TERMINAL_STATE_STATIC=PASS
TERMINAL_RUNTIME_STATIC=PASS
TERMINAL_DISPLAY_CONTEXT_STATIC=PASS
TERMINAL_UI_STATE_STATIC=PASS
TERMINAL_RENDER_STATIC=PASS
TERMINAL_LAYERING=PASS
TERMINAL_STATIC=PASS
```

The verifier run took 1m25s and exited 0. The model/red suites reported cleanup PASS and their red mutations remained red; the current real static tree remained green. This is static evidence only, not Android/release/Web/UAT or implementation acceptance.

## Focused commands after repair

```text
node tools/terminal-platform-ports/check-static.mjs                         PASS
node tools/terminal-platform-ports/check-static.test.mjs                     PASS
yarn workspace @catering-v2s/kernel-base-platform-ports test --run          PASS (18 passed, 1 skipped)
yarn workspace @catering-v2s/kernel-base-platform-ports typecheck            PASS
node tools/terminal-ui-state/check-static.mjs                                PASS
node tools/terminal-ui-state/check-static.test.mjs                            PASS
yarn workspace @catering-v2s/kernel-base-ui-state test --run                 PASS (39 passed)
yarn workspace @catering-v2s/kernel-base-ui-state typecheck                   PASS
node tools/terminal-ui-render/check-static.mjs                               PASS
node tools/terminal-ui-render/check-static.test.mjs                           PASS
yarn workspace @catering-v2s/ui-feature-sample-wallpaper-picker test --run   PASS (14 passed)
yarn workspace @catering-v2s/ui-feature-sample-wallpaper-picker typecheck     PASS
```

