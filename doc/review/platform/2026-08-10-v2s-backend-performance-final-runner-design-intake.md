# BACKEND-PERFORMANCE-FINAL-RUNNER-IMPLEMENTATION intake

## Source reopen and problem family

I re-opened the final runner, final workload, final snapshot admission, the final design, the
historical HTTP diagnostic runner, the R5 DEV runner, and the remote Testcontainers runner.  The
problem is not a malformed callback at one call site: the final package presents an executable
name, while its only execution API accepts seven caller-supplied callbacks and the CLI rejects
`--run`.  The workload similarly requires a caller-supplied fixture materializer.  Consequently
the claimed final dynamic path has no owned lifecycle, fixture contract, or evidence producer.

## Confirmed finite sibling scan

| Candidate boundary | Result | Why it cannot be silently reused |
|---|---|---|
| `scripts/dev/http-diagnostic-runner.mjs` | rejected | Its public CLI is fixed to `rm1-http-diagnostic-local-runtime`, `.runtime/rm1/http-diagnostic`, RM1 headers and four RM1 workloads. It exports no parameterized start/stop adapter. |
| `scripts/dev/r5-dev-runner.mjs` | rejected | It is the persistent DEV/seed runner and couples R5 credentials, seed reporting, fixed ports and `.runtime/r5`; it is not an isolated final-performance lifecycle. |
| `scripts/test/r5-remote-testcontainers.mjs` | reusable only as its existing focused Testcontainers command | It owns a remote Gradle/Testcontainers technical run, not the local application/tunnel/fixture/workload lifecycle. |

## Smallest missing contract

Before a final dynamic package can be created, an approved managed adapter must expose all of the
following as a single owned boundary:

1. accept a final plan with a unique final run root and policy/implementation digests;
2. perform resource preflight, remote Testcontainers command, local application+tunnel startup,
   isolated namespace/object-prefix creation, and exact owned cleanup;
3. create source-bound private fixture state for all 396 final recipes, then materialize each
   typed request without generic route/body inference;
4. pass the final run ID, HMAC key and final-only measurement mode to the server and return the
   five canonical evidence paths; and
5. create the immutable snapshot only after workload completion, then report independent business
   and cleanup status.

Neither available runner exposes that contract.  Implementing it in this correction package
would require inventing SSH/process/remote database/object-storage lifecycle code or modifying
the existing runner's public surface, both outside this package's allowed paths and the instruction
to reuse a repository-managed boundary.

## Decision

`CONFIRMED`: this correction package must not turn callback injection into an unreviewed second
runner. The existing static helper tests are valid only as unit tests; they are not dynamic
readiness evidence. The final dynamic acceptance remains blocked on the explicit managed-adapter
contract above. No runtime command was executed and no runtime status is upgraded.
