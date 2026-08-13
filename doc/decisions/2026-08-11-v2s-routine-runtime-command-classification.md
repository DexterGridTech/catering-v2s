---
id: 2026-08-11-v2s-routine-runtime-command-classification
status: accepted
owner: Dexter
scope: runtime-command-classification
---

# Routine managed runtime command classification

## Decision

Focused Testcontainers is a routine, independently invokable managed test. A requested run
derives its denominator and contract from the current authoritative source inputs at execution
time. It must not require an active implementation package, BPF/static predecessor, package
input/admission, design or implementation review, or a historical report as a launch
precondition.

Managed DEV start/restart, explicit reset, and explicit `r5-full` seed are likewise operational
commands rather than continuations of an implementation package. Reset and seed remain separate
destructive operations and require their own explicit authorization and existing managed
entrypoints. A request sequence may impose an operational order; for the current delivery that
order is Testcontainers business and cleanup PASS, then reset, managed DEV start, then seed.
Browser L2 is excluded.

For this operational entry, `r5-full` means the complete DEV experience composition, not just the
base owner fixture: it runs `owner-command` followed by `catalog-inventory`, validates one managed
DEV run across both component receipts, and writes a composite report that links rather than merges
their per-owner API/database reports. The catalog/inventory loader remains an internal component;
there is no public partial seed profile. This does not make reset/start implicit or combine their
destructive responsibilities with seed.

## Boundaries retained

This decision does not permit local Docker, manual SSH, manual SQL, a remote application or
browser runner, UAT, deployment, implicit seed, or an unsafe retry. Every managed run keeps its
resource preflight, trusted-host boundary, run-scoped manifest and logs, first-failure diagnosis,
separate business/cleanup status, and owned-resource cleanup.

If a run reveals a confirmed source or runner defect, repair the finite problem family in the
smallest authorized source scope, preserve the first-failure evidence, and rerun the routine
command. The repair scope is not a prerequisite package for the command itself.

## Testcontainers discovery and visible execution contract

The normal whole-suite command is `scripts/test/r5-remote-testcontainers.mjs --all`. It derives
its current finite target set from each Java test source declaring `@Testcontainers`, mapping a
root or module source path to its owning Gradle `:test` task and fully-qualified class selector.
The set is recomputed for every invocation and runs through exactly three isolated remote Docker
daemon lanes. Each lane is serial and initializes one lane workspace once; the initial sorted target
set is divided as evenly as possible (22 is 7/7/8). A lane that completes its initial queue takes an
unstarted member from the longest remaining lane queue, deterministically, so an available lane does
not idle. A lane stops at its own first failure; the other lanes keep running and the parent reports
all lane first failures. All three Engine IDs must be distinct. A fresh `--all` run executes the
entire current set even if an earlier run passed individual targets. There is no fixed interface
count or hand-maintained allowlist to update. Invalid source shape, a duplicate derived task/selector,
shared Engine ID, or incomplete target execution is fail-closed. `--discover` provides the same set
read-only. BPF's 196-row workload remains its own exact contract, not the denominator for this general
runner.

Before execution, the same annotated source set also derives every literal or declared image reference.
The managed warmup first verifies or pulls a missing image once through the default daemon, then imports
that exact cached image into every isolated daemon. Cached images never cause another registry request.
An image expression the parser cannot prove is rejected before a lane begins; there is no second manual
image allowlist to drift from the test source.

Every focused and whole-suite run must print and persist start time, phase, heartbeat, elapsed
time, current/total member when applicable, final business and cleanup status, evidence path and
first failure. Progress output is evidence, not a reason to extend timeouts or retry a failure.

Testcontainers Gradle tasks are external-state observations and must execute fresh for the
current invocation. The build configuration disables only up-to-date and build-cache reuse for
Docker-backed `Test` tasks; compilation and dependency preparation may still reuse their caches.
The managed runner reads the target Gradle log and rejects `FROM-CACHE`, `UP-TO-DATE`, `NO-SOURCE`,
`SKIPPED`, or a missing target task line as `TESTCONTAINERS_TARGET_NOT_EXECUTED`, before accepting
business evidence. The task match is token-exact: a similarly named task such as `testClasses`
cannot satisfy the `test` target. A cached or skipped task is therefore a runner failure, never a
business PASS or a reason to retry blindly.
