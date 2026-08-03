---
title: RM1 U13 complete source-bound HTTP diagnostic workload
status: IMPLEMENTATION_AUTHORIZED
---

The existing C09 executor proves only one real request and correctly reports the remaining 146 tuples
as deferred. This package closes that runtime denominator without reclassifying a transport-level
401/404/422 as a CRUD observation.

Each generated registry tuple has exactly one source-bound executable scenario. A positive case first
creates its smallest required facts through the owning module's published command API in the isolated
diagnostic namespace, then calls the public HTTP face and retains its required owner readback. A
rejected case must pass the face's authentication and request-shape boundary and reach its documented
owner validation; its typed 4xx is the oracle. Cookies, credentials, OTPs, grants and raw response
bodies remain in memory/private `0600` runtime files and are discarded by cleanup.

The workload groups shared setup by owner and lifecycle only; it does not synthesize an endpoint
specific SQL fixture, cross-schema DML, edge-side owner facts, or a generic request generator that
guesses bodies. Every emitted call is correlated with exactly one server completion event. The report
may describe operation identity, owner, outcome, duration and database-operation extrema only.

Run classification is HTTP diagnostic integration: local managed backend plus remote non-production
middleware tunnel, isolated database/object namespace, manifest/log readback and both local/remote
cleanup. It is neither Seed, browser L2, UAT, performance benchmark nor business PASS. A failure keeps
the first failure and cleanup evidence; no retry happens before log and boundary diagnosis.
