# CP-05 focused proof record

- Run ID: `TER-CP05-FP-20261002T223117Z`
- Started: `2026-10-02T22:31:17Z`
- Completed: `2026-10-02T22:31:54Z`
- Execution: local package-owned test/typecheck/lint commands only; not Expo Web, VM, adapter, DEV, or V-01..V-20.
- Current source fingerprint: `89866d9fca4564c4a0be0e24fd40f89dba431be8f3f0163afe31ac4fd0785768` (SHA-256 of the sorted path+SHA-256 stream for `*.ts`/`*.tsx` under the five CP-05 source/test roots listed below).
- Full terminal output: `doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-cp05-focused-proof-codex.log`.

## Commands and results

Each command was `yarn workspace <package> test`, `typecheck`, or `lint`; each exit code and actual terminal output is in the log above.

| Package | Tests | Typecheck | Lint |
| --- | ---: | --- | --- |
| `@catering-v2s/kernel-feature-sample-member-registry` | 1 file / 13 tests PASS | exit 0 | 10/10 files, 0 errors, 0 warnings |
| `@catering-v2s/ui-feature-sample-member-desk` | 2 files / 36 tests PASS | exit 0 | 45/45 files, 0 errors, 0 warnings |
| `@catering-v2s/ui-feature-sample-staff-auth` | 2 files / 14 tests PASS | exit 0 | 28/28 files, 0 errors, 0 warnings |
| `@catering-v2s/ui-feature-sample-wallpaper-picker` | 3 files / 20 tests PASS | exit 0 | 27/27 files, 0 errors, 0 warnings |
| `@catering-v2s/ui-integration-sample-wallpaper-console` | 5 files / 30 tests PASS | exit 0 | 10/10 files, 0 errors, 0 warnings |
| **Total** | **13 files / 113 tests PASS** | **5/5 exit 0** | **5/5 exit 0** |

## Evidence boundary

These focused package checks cover CP-05 owner/UI/composition behavior, including host and branch pending isolation, current-peer member projection handling, the LSP read-only staff guide and independent member/wallpaper surfaces, host wallpaper projection, and MMP/LMP logout wiring. They do not prove rendered Expo Web behavior, any VM topology, adapter behavior, the complete V-01..V-20 scenario matrix, or cleanup of managed runtime resources. Those remain `NOT_RUN` and are reserved for the authorized later dynamic phase.
