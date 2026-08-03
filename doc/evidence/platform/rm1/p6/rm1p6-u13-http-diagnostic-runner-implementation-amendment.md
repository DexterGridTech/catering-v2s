---
title: RM1 U13 local HTTP diagnostic runner implementation amendment
status: IMPLEMENTATION_AUTHORIZED
packageId: RM1P6-HTTP-DIAGNOSTIC-RUNNER-U13
sourceDesign: doc/evidence/platform/rm1/p6/rm1p6-u13-all-http-crud-efficiency-remediation-design.md
---

# Purpose and immediate correction

The real server completion event field is `routeTemplate`; C03's unit fixture used `path`. Before an
actual run, the report must accept only the server event shape and convert it at the report boundary to
the generated registry `path` identity. This is a genuine contract mismatch found by source reread, not
a test-only rename.

The same package creates a dedicated managed HTTP diagnostic runner. It starts only the local Spring
Boot backend and its local tunnel to one isolated remote non-production database/object-storage namespace.
It never starts a frontend, Vite, Playwright, remote application process, Seed or reset. It writes a
run-scoped manifest, local process identity/log readback, report and local/remote cleanup evidence.

# Runner boundary

- One 147-route declaration is loaded from the generated registry and C04 facts. Calls are later executed
  only with values established through approved owner commands and in-memory secret handles.
- The runner itself does not use direct SQL or cross-schema DML. It fails closed on a missing/mismatched
  server event and emits no response body, credential, OTP, grant, cookie, authorization, identity,
  raw payload, SQL or bind data.
- The runner reports only HTTP diagnostic coverage and cleanup. It never emits browser-L2 or business
  result fields, and it makes no benchmark/latency claim.

# Focused proof

Prove the real `routeTemplate` event contract, missing/mismatched completion failure, zero DB-count
validity, local-backend-only runner surface, remote-process/frontends/Seed rejection and secret-redaction
logic. Dynamic execution is a later explicit phase after its real scenario client is complete.
