# Current static re-verification after B0 wording correction

DATE=2026-09-15
OWNER=main Codex
SCOPE=terminal skeleton baseline and real red-mutation suite after correcting the R-E6 documentation wording
BOUNDARY=Static only; no Web, Metro, DEV, Android, device, seed, UAT, deploy, or Git.

## Commands

```sh
node tools/terminal-skeleton/check-static.mjs
node tools/terminal-skeleton/check-static.test.mjs
```

The baseline checker exited `0` with:

```text
RULE_GRAPH_COMPARISON=PASS
RULE_TRIPLE_NAMING=PASS
RULE_DEPENDENCY_DIRECTION=PASS
RULE_DEPENDENCY_DECLARATION_COMPLETENESS=PASS
RULE_RUNTIME_DEPENDENCY_CONTRACT=PASS
RULE_TR01_REDUCER_BOUNDARY=PASS
RULE_KERNEL_PLATFORM_INDEPENDENCE=PASS
SCAFFOLD_HYGIENE=PASS
```

The mutation suite exited `0`. It produced the expected red controls, including:

```text
TERMINAL_SKELETON_RED_RUNTIME_DESCRIPTOR_OPTIONAL=FAIL
TERMINAL_SKELETON_RED_RUNTIME_DESCRIPTOR_SPREAD=FAIL
TERMINAL_SKELETON_RED_RUNTIME_WHOLE_ARRAY_FACTORY=FAIL
TERMINAL_SKELETON_RED_BASE_CROSS_PLATFORM_ADAPTER=FAIL
TERMINAL_SKELETON_MODEL_TEST=PASS
```

The complete command output is the tool output for this evidence run; the existing
`cp1-static-red-evidence.md` records the full mutation vector and the fixture restoration
boundary. The source tree after the run still has the legitimate picker
`ui.base.test-support` dev edge and no picker `kernel-base-platform-ports` declaration. This
run therefore supports the corrected interpretation of R-E6; it does not close sample2 frozen
acceptance, native, Android, release, Web, visual, U10/U13, or cleanup evidence.

`FIRST_FAILURE`: none in this static run.
`LAST_KNOWN_GOOD`: both commands exit `0` with the expected red mutations.
`BROKEN_BOUNDARY`: static graph/package/source checks do not prove full sample2 acceptance or
current APK/device behavior.

