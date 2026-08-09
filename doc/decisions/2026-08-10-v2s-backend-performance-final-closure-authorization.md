# Backend-performance final-closure authorization

## Decision

Dexter authorized the remaining backend-performance program on 2026-08-10 through final managed
dynamic acceptance. The authority is serial and is recorded as three packages rather than expanding the
closed static BP-U05 package:

implementationAuthority: false

1. `BACKEND-PERFORMANCE-FINAL-DESIGN-20260810` defines exact BP-U06 retirement and snapshot-workload
   surfaces. It has no production or runtime authority.
2. `BACKEND-PERFORMANCE-FINAL-IMPLEMENTATION-20260810` may implement only the approved exact surfaces
   after fresh DESIGN review and Claude design recheck.
3. `BACKEND-PERFORMANCE-FINAL-DYNAMIC-ACCEPTANCE-20260810` may run one isolated managed workload only
   after static implementation admission. It has minimal fixture preparation authority and no reset.

RM1-P6-3 is paused, not closed. It shares runner, tunnel, remote non-production database/object-storage
capacity, and `.runtime` ownership with this work, so no joint execution or evidence reuse is allowed.

## Completion truth

Static source admission is not a numeric performance result. The final acceptance may report optimization
success only when one final-run immutable snapshot supplies the exact request/database tuples, component
accounting and cap evidence required by BP-U05/BP-U07. `business=PASS` and `cleanup=PASS` are independent
requirements. BP-U06 is closed only when the old `app/application` layout, legacy String operation dispatch
and root result artifact are absent from current repository bytes, not merely unused.

## Boundaries

- Preserve owner-local typed facts, response contracts, typed failures, CAS/readback and command/read
  separation.
- Do not use cross-schema DML, a generic query bus, a Map/reflection/string dispatcher, cache reuse across
  requests, controller measurement wrappers, or a fake measured status.
- The managed workload runs application processes locally through the approved tunnel and isolated remote
  middleware only. It is technical verification, not DEV product acceptance, browser L2, UAT or deployment.
- Reset stays forbidden because it is unnecessary for an isolated final-run namespace.

## Required independent review

The design package needs a fresh `REVIEW_TARGET=DESIGN` independent review cycle (two rounds maximum) and
a Claude design recheck before implementation. After static implementation and dynamic evidence, a distinct
fresh `REVIEW_TARGET=IMPLEMENTATION` independent review cycle and Claude final review are required.
