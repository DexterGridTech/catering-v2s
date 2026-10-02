---
id: decisions.v2s-terminal-activation-batch-3-amendment-proposal
title: v2s terminal activation batch 3 service-shape amendment proposal
type: decision
status: ACCEPTED
scope: terminal activation batch 3 design
owners: [product, platform]
createdAt: 2026-10-02
acceptedAt: 2026-10-02
acceptedBy: Dexter
implementationAuthority: false
supersedes:
  - doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md#6.3-batch-ownership
  - doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md#8-history-storage-amendment
source:
  - doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md#R-12
  - doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md#R-6.5-R-6.7
  - doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md#R-7.2-R-7.3
design: doc/plans/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-design-codex.md
---

# v2s terminal activation batch 3 service-shape amendment proposal

## 1. State

Dexter accepted this bounded amendment on 2026-10-02 as part of the batch-3 implementation assignment. It records existing requirements and Dexter's prior clarification that Doris runs on the remote host from the Apache-published image; it adds no product semantics. Implementation authority is separately granted by the current batch-3 assignment and remains limited to its stated scope.

## 2. Accepted bounded decision

1. Batch 3 owns only cross-node session replacement/reconciliation and Doris connection-history persistence. Topic synchronization remains out of scope. Three TDS instances and two HAProxy entries already belong to batch 2; this amendment does not rebuild them.
2. TDS writes connected, disconnected-with-reason and per-heartbeat RTT events to Doris. Business binding/audit history remains in PostgreSQL and is never mirrored to Doris.
3. PostgreSQL terminal_connection.latest_state.session_sequence remains the ordering authority. Session open updates the row and emits a typed PostgreSQL LISTEN/NOTIFY wake-up in the same transaction. The event is ephemeral; after listener reconnect, TDS reconciles tracked local sessions against PostgreSQL latest state.
4. Doris is mandatory in DEV and backend-acceptance. The DEV instance is a resident Docker container on the same remote host as PostgreSQL and HAProxy, using Apache's published apache/doris:all-in-one-4.1.3 image with remote-host persistent data directories. It is managed by the existing remote lifecycle; no local Doris, external cloud service, mirror/proxy, Doris tunnel, or direct node exposure is added.
5. Each backend-acceptance run creates one isolated Doris Testcontainers instance on the same remote Docker daemon/host as the acceptance PostgreSQL and TDS processes. The run removes only its owned container/volumes; the daemon image cache remains available to later runs. The first cold image pull and later cache hits are reported separately.
6. Doris write failure never enters the WebSocket, heartbeat, HTTP activation/cancellation, or PostgreSQL binding-history path. A bounded in-memory queue and one TDS-owned worker apply finite retries and observable drops. No MQ, generic outbox, durable replay queue, or poller is introduced.
7. Reset keeps the resident DEV Doris container and schema, clears the history table, and proves zero readback. Backend-acceptance removes its run-scoped Doris container/volumes. Neither lifecycle deletes the remote Docker image cache.
8. No statistics API, page, query product, retention policy, Doris high-availability topology, or production deployment is authorized by this amendment.

## 3. Exact supersede and disposition chain

| Existing source | Exact disposition |
|---|---|
| doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md §6.3 | Replace the line assigning topic synchronization to batch 3. Preserve the statement that batch 3 owns cross-node coordination and Doris; clarify that batch 3 implements only cross-node session replacement and recovery reconciliation, while topic synchronization remains deferred. |
| Same decision §8 | Retain the 2026-10-01 history-storage ruling. Add the runtime isolation and remote image/lifecycle details in §2 above; do not revive business binding history in Doris. |
| doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md §3.1 and §3.9 | Preserve one business deployable, one PostgreSQL business database, one Flyway history and no generic broker/outbox. Record Doris only as the named TDS telemetry/history store and PostgreSQL LISTEN/NOTIFY only as the existing narrow wake-up. |
| doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md §3.12 | Add the named Doris history schema/remote runner to batch 3 reset and acceptance cleanup; do not change frontend generated slices or HTTP exposure faces. |
| doc/decisions/2026-07-25-v2s-backend-app-layout-and-tdp-placeholder.md | Preserve the already accepted TDS auxiliary runtime disposition. Doris does not create another application, TDP, deployable, or owner module. |
| doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md R-6.5–R-6.7, R-7.2–R-7.3, R-12–R-14, V-B1/V-B9/V-S7/V-S13/V-E1/V-E3 | No requirement text is changed. The implementation design maps these rows to implementation and evidence. |

## 4. Governance source inventory and synchronization

The following current governance sources are synchronized to this accepted amendment; applicability is bounded to Doris/cross-node behavior:

| Path or anchor | Disposition |
|---|---|
| AGENTS.md TDS/environment section | Synchronized: named Doris telemetry store, remote-only placement, run ownership, image-cache retention and task-scoped reset/seed conditions. |
| PLATFORM-BLUEPRINT.md topology/data boundary | Synchronized: Doris is TDS history telemetry only; PostgreSQL remains business DB and sole Flyway history. |
| doc/platform/README.md runtime boundary | Synchronized: batch-3 ownership includes cross-node replacement/reconciliation and remote Doris history. |
| scripts/README.md DEV/reset/acceptance entries | Synchronized: remote resident DEV Doris, per-run acceptance container, cache retention, ordered reset/readback and cleanup. |
| doc/platform/foundation-charter.md §1-A/§2-D | Synchronized: named Doris telemetry exception; preserved PostgreSQL business DB, no MQ/outbox/persistent queue/polling. |
| project-memory/kernel/02-service-shape-and-owner.md | Synchronized: narrow Doris exception without changing business owner or migration ownership. |
| project-memory/decisions/distributed-topology-is-not-current.md | Synchronized: NO_MQ_OUTBOX_TDP retained; bounded best-effort Doris telemetry and PG wake-up only. |
| project-memory/decisions/terminal-build-order-and-batches.md | NOT_APPLICABLE_WITH_REASON: this is the independent TER foundation/package build order and contains no v2s terminal activation batch-3 schedule; editing it would cross task scope. |
| doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md | Synchronized: run-scoped Doris readback is not a BUSINESS HTTP scenario or operation identity; cleanup remains separate. |
| scripts/dev/r5-dev-runner.mjs, scripts/dev/r5-reset.mjs | Add only manifest-bound remote Doris start/readiness/schema/reset/readback controls. Keep Docker ports loopback-only and do not manage the registry cache as a run resource. |
| scripts/test/r5-remote-testcontainers.mjs and backend-acceptance lifecycle | Use the existing remote daemon and cleanup inventory; record the image digest and Doris container identity per run. Do not start a local Docker fallback. |
| contracts/policy/*, edge generation, operation budget, admin UI, TER packages and seed business plans | N/A: no HTTP route, consumer face, generated client, business operation, UI, TER behavior or seeded business fact is added. The Doris DDL is operational SQL under scripts/dev/doris/, not a contract or PostgreSQL migration. |

## 5. Preserved rules

This accepted amendment does not change owner sovereignty, the business module COMMAND DAG, one PostgreSQL/Flyway boundary, R-7.3's no-polling rule, credential privacy, TDS's lack of business writes, or the existing three-node/two-entry batch-2 topology. Dexter accepted the bounded amendment on 2026-10-02. The current task separately grants scoped implementation authority; this decision does not authorize L2, UAT, production deployment or work outside batch 3.
