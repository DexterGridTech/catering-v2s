# TDP · CP-04 focused proof

```text
TASK=TDP data-change and remote-operations
CP=CP-04
SCOPE=TDC topic command, subscription selector/state, ready/reconnect and ACK
EVIDENCE=local package typecheck, package tests, package lint, protocol generator check
```

## Proof outputs

| Command | Result | Observed output |
| --- | --- | --- |
| `yarn workspace @catering-v2s/kernel-base-terminal-data-client typecheck` | PASS | Completed with exit code 0 as the first command in the chained verification. |
| `yarn workspace @catering-v2s/kernel-base-terminal-data-client test` | PASS | `TERMINAL_PACKAGE_TEST_MODE=PASS ... files=8 tests=40 allowedDevSkips=0`; `TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS`. |
| `yarn workspace @catering-v2s/kernel-base-terminal-data-client lint` | PASS | `expectedFiles=14 actualFiles=14 errors=0 warnings=0`. |
| `node scripts/generate/terminal-connection-protocol.mjs --check` | PASS | `TDP_PROTOCOL_CHECK=PASS FILES=2 TOPICS=11`. |
| `node scripts/generate/terminal-connection-protocol.mjs --self-test` | PASS | `TDP_PROTOCOL_SELF_TEST=PASS`, including root escape, absolute path, symlink escape, message closure and secret-rendering red proofs. |

The package test suite includes assertions for independent same-topic subscribers and per-subscriber unsubscribe, rejection of an unsupported topic key, acceptance only of the latest matching notification, accepted-time persistence across runtime restart, and resending the saved accepted time after reconnect rather than an older initialization time. Tests also assert that a generated subscription identity uses canonical UUID wire shape.

## Preserved first failure and root cause

The first package run after adding the TDC topic path failed in three checks. One expectation used lexicographic sorting for numeric accepted times. The substantive failure was that the TDC used `createRequestId()` (`req_…`) as a `subscriptionId`, while the shared protocol and TDS codec require canonical UUIDs. The invalid ID prevented valid topic notifications from matching the active subscription. The first run also exposed the expected TDC module command list needing the four newly registered topic commands.

The correction uses the existing Web Crypto `crypto.randomUUID()` primitive for wire subscription identities, returns a typed command failure if UUID generation is unavailable, aligns UUID validation with TDS's canonical `UUID.fromString(...).toString()` check, and exports the topic-key closed set from the protocol generator for runtime input validation. No request ID, credential identity, transport ownership, or TDS protocol rule was changed. The numeric assertion now sorts numerically, and the module command catalog assertion includes the four registered topic commands.

## Scope limits

These are local package/static generator proofs. They do not prove feature consumer behavior, complete CBS→TDS→TDC→feature delivery, Expo Web behavior, adapter behavior, DEV, remote operations, backend acceptance, or whole-batch 6b. Those remain assigned to later CPs or batch-level validation and are not claimed as PASS here.
