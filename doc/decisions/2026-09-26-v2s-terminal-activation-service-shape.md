---
id: decisions.v2s-terminal-activation-service-shape
title: v2s terminal activation and TDS service shape
type: decision
status: ACCEPTED
scope: terminal activation batch 1
owners: [product, platform]
createdAt: 2026-09-26
acceptedAt: 2026-09-26
acceptedBy: Dexter
implementationAuthority: true
supersedes:
  - doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md#31-部署拓扑
  - doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md#38-一份依赖登记三类边
  - doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md#39-单体内部事件禁令
  - doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md#310-边缘安全面与-openapi-face
  - doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md#312-前端与工程证据
source: doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md#R-12
design: doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md
---

# v2s terminal activation and TDS service shape

## 1. State and authority

Dexter accepted this batch-1 implementation shape on 2026-09-26 under requirements D-4, D-33 and D-34. The `implementationAuthority=true` metadata records that original batch-1 authorization. Requirement D-44 later assigned the three-instance DEV deployment and two HAProxy WebSocket entries to batch 2; that deployment topology does not add cross-node session coordination, which remains batch 3 with Doris. Dexter's 2026-09-30 instruction separately authorizes the current batch-2 design remediation, implementation and validation. Read this decision together with those later scoped rulings; this paragraph does not extend the original batch-1 authorization.

## 2. Decision

Keep all HTTP operations in `catering-business-server`. Add a `terminal-binding` owner module under `apps/backend/catering-business-server/modules/terminal-binding` for binding generation, credential digests, terminal binding changes, and binding audit. Keep terminal configuration, activation-code ownership, immutable device type, and terminal lifecycle in `store-terminal`. Add a thin application-edge coordinator that calls the `store-terminal` and `terminal-binding` public command APIs inside one `REQUIRED` transaction. Neither owner imports the other owner's implementation or repository.

Keep terminal-data-server as a separately managed deployable for WebSocket session, heartbeat, and latest connection state. Its only business API dependency is terminal-binding API, exposing its owner-owned ActivationCandidate and credential verification only. terminal-binding may depend on audit-model, execution-context and foundation, plus JDBC/JSON libraries; it must not depend on organization, extension, platform-admin-iam, catalog, asset or store-terminal. TDS runtimeClasspath excludes the business app and those prohibited modules, Flyway, seed and object-storage artifacts. Its isolated dependency override uses Reactor BOM 2025.0.7; the selected TDS graph contains Reactor Netty 1.3.7, Reactor Core 3.8.7 and Netty 4.2.18.Final. The BOM manages Reactor Pool 1.2.7, but the current TDS runtime/test graphs do not select that artifact and TDS imports no Reactor Pool API. No TDS-only override applies to the business app or acceptance JVM. Netty published GHSA-2g37-3h88-55hc for unbounded unauthenticated HTTP/1.1 pipelining growth in WebSocketServerExtensionHandler, lists 4.2.18.Final as patched, and this implementation uses that patched release. Managed Gradle dependency reports must prove both graphs. Dexter resolved R2-N2: V2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS is a required decimal integer in 1..2,147,483,647; missing, malformed, non-positive, or out-of-range values fail TDS startup before readiness. The deployed numeric value N remains open until host capacity is measured and recorded in the implementation plan. The backend-acceptance JVM contains only two business contexts; TDS runs as a separately managed production process with its own runtimeClasspath and explicit WebApplicationType.REACTIVE. Business ArchUnit scans business production outputs only; TDS ArchUnit scans TDS only. The WebSocket client runs in a separate Node/undici process. TDS has no command dependency on store-terminal, organization, catalog or asset, no Flyway lifecycle and no object-storage configuration. The business app remains the sole Flyway runner for both apps against shared PostgreSQL.

The exact dependency shape is:

```text
catering-business-server edge coordinator
  ├─ COMMAND ─> store-terminal public API
  ├─ COMMAND ─> terminal-binding public API
  └─ existing owner APIs ─> organization / workspace as required

store-terminal
  └─ existing command dependencies ─> organization, catalog, audit-model, foundation
  └─ TASK_READ SQL ─> terminal_binding.latest_binding (terminal detail projection only)

terminal-binding owner
  ├─ COMMAND API + owner schema ─> its own binding and audit facts
  └─ TASK_READ SQL ─> platform_workspace.group_workspace,
                      organization.store, store_terminal.terminal

terminal-data-server
  └─ runtime read API ─> terminal-binding credential verification
     (plus WebFlux/JDBC/PostgreSQL libraries; no business command imports)
```

`COMMAND` edges must remain acyclic. The `TASK_READ` edges are separately registered, SELECT-only task joins and grant no command, write, lock, or transaction authority. The activation coordinator obtains the terminal lock through `StoreTerminalOwnerApi` before calling the binding owner; the terminal status transition and activation therefore serialize on the same owner row. The TDS verifier may read status at authentication time but never applies later status changes to an established connection, preserving D-21.

## 3. Persistence and transaction ownership

- The business app owns the single Flyway history. Its additive migrations create `terminal_binding.latest_binding`, `terminal_binding.audit_event`, and `terminal_connection.latest_state`; TDS does not run migrations.
- `latest_binding` is one bounded row per terminal. It holds the latest generation, SHA-256 digest of the 32-byte device secret, active device id only while bound, activation/end timestamps and end reason, plus the most recently ended generation/digest needed by R-1.6 when a newer generation is active. It retains no unbounded connection history and no ended device id. Binding generation is monotone and allocated under the terminal row lock.
- `latest_binding` has a tenant-safe composite FK to `store_terminal.terminal(workspace_uuid, group_workspace_key, terminal_ref)`. The referenced key is unique; the FK is immediate, with no cross-owner cascade. No reverse FK is added.
- `latest_state` is one latest connection row per terminal, ordered by a PostgreSQL sequence rather than node time. Writes compare the current session id/order; stale heartbeat and disconnect writes are no-ops. Online is derived from the database-timestamped last activity plus configured timeout; it is not represented by a durable boolean.
- Each owner writes its audit row in the same `REQUIRED` transaction as its binding change. A transaction that fails before commit writes neither state nor notification. `pg_notify('terminal_binding_events', ...)` is issued in the same transaction and contains only protocol version, terminal ref, and revoked generation.
- The generation table/row retains only data required by R-2.2, R-4.7 and R-1.6. Credentials, raw request bodies, activation codes and device ids are excluded from audit, idempotency receipts, logs and diagnostics. `device_id` is nullable and is cleared when a binding ends.

The task read for `getOperationsStoreTerminal` adds the exact three-field binding view to the existing detail query with a `LEFT JOIN` on the tenant-safe key: inactive is `{status}`, active is `{status, activatedAt, generation}`. It must not select the digest or device id. This preserves the existing operation budget ceiling of 11; no budget increase is authorized by this design.

## 4. Audit actor and reader

Use the existing `audit-model` writer contract and owner-owned audit table pattern. Add the entity type `TERMINAL_BINDING`; add a typed audit-read task in `audit-read` backed by a narrow read API from `terminal-binding`. Device-originated events use actor type `TERMINAL_DEVICE`, null actor id, and the fixed display snapshot `终端设备`; this is the smallest truthful actor representation that does not substitute `terminalRef` for a physical device or leak `deviceId`. Extend `AuditActor`'s null-id rule only for `SYSTEM` and `TERMINAL_DEVICE`. Operations actors continue to use the current trusted actor snapshot. Audit actions cover initial activation, same-device reactivation, device cancellation, operations cancellation, and void-triggered unbinding; none records credential, activation code or raw device id.

## 5. Terminal edge and shared protocol location

Register the terminal face as a fourth consumer face in the edge catalog. Batch 1 owns the HTTP operations and auth declaration, not TER generation. The terminal face has no page; its edge record uses `pageKey=null`, a real catalog `scenarioIds` entry, and the existing `focusedTestId` contract, never a fabricated admin page or UI test id. The two device operations use the credential in an `Authorization: Terminal <credential>` header where applicable. Activation is unauthenticated; device cancellation uses terminal credential authentication. Neither uses generic idempotency replay. Both device operations declare `x-safe-retryable=true`: an activation retry is recognized by the credential-secret digest, and repeating device cancellation after binding end returns `已取消激活` without another mutation. The retry field is forbidden outside the `terminal` face. The operations cancellation remains a normal `operations-admin` command with an idempotency key and expected binding generation.

The single WebSocket endpoint is `GET /tdp/{groupWorkspaceKey}/ws`; the single WebSocket protocol definition is `contracts/protocol/terminal-connection-protocol.json`. TDS loads it as a classpath resource copied from that source; batch 2's TypeScript client consumes/generated-types from that same source. TDS negotiates RFC 7692 `permessage-deflate` only, with no-context takeover and a 65,536-byte frame, decompression-output and complete-message ceiling; overflow closes `1009 / MESSAGE_TOO_BIG`. Invalid WebSocket framing, including RSV1 without negotiated compression, closes `1002 / PROTOCOL_ERROR`. Other extension tokens are removed before negotiation. No second Java or TypeScript list of frame names or close reasons is authoritative. `scripts/verify` checks protocol closed sets and Java/TypeScript projections for drift.

## 6. Supersede ledger

This ledger is intentionally local. The front-matter supersedes list points only to decision-document section anchors; it does not claim to replace AGENTS.md, platform standards, project-memory assertions, acceptance standards, seed policy or the terminal standard. Table line numbers identify the batch-1 synchronization locations as originally recorded, not guaranteed current offsets. The table records that synchronization and the narrow later D-44 topology clarification; it does not itself authorize edits. The current Dexter instruction authorizes the batch-2 implementation and its scoped governance updates; apply local edits only in the named owning sources and preserve unrelated rules.

### 6.1 Decision anchors

The 2026-07-24 root ADR is a hash-bound local frozen asset. Keep its file bytes and both heritage hash pins unchanged. This accepted decision carries the exact anchor-level supersede effects below; synchronize current governance sources without editing that frozen artifact.

| Existing decision source and exact location | Local disposition after this decision is accepted | Exact effect and preserved rule |
|---|---|---|
| doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md, §3.1 heading at line 48 and deployable/TDP clauses at lines 60–64 | Supersede only the prohibition on an auxiliary TDS runtime and the statement that no terminal-data runtime exists in the current denominator | Keep exactly one business deployable, one PostgreSQL database and one business Flyway runner. Add the narrow terminal-data-server WebSocket runtime. TDS is not TDP and does not authorize MQ, outbox, Redis, Doris, topic sync, or a second business data owner. |
| Same root decision, §3.8 lines 139–147 | Supersede only the dependency-registry node set as needed for the new terminal-binding business module and its explicit edges | Register terminal-binding with owner-scoped COMMAND and TASK_READ edges. Keep COMMAND DAG acyclic; keep TASK_READ SELECT-only with no command/import, transaction, lock, write or FK authority. TDS is a separate app, not a business module-registry node. |
| Same root decision, §3.9 lines 149–156 | Add one named TDS wake-up use to the closed AFTER_COMMIT transport set | PostgreSQL LISTEN/NOTIFY is a same-transaction binding-revocation wake-up consumed by TDS. It is not an event bus, generic outbox, durable queue, polling loop, or business-state writer. All other event/listener prohibitions remain. |
| Same root decision, §3.10 lines 158–167 | Supersede the exact consumer-face closure from three HTTP modes to the four registered faces | Add terminal face and terminal credential transport auth. Activation remains public/no-session; device cancellation is terminal-credential/no-session; no user session/page grant is inferred. The terminal face has no frontend slice in batch 1; count it in the server registry, and generate its TER slice in batch 2. |
| Same root decision, §3.12 lines 182–193 | Reword only the generated-face comparison during the batch transition | Batch 1 closes operation contract, Java registry and current consumer projections while separately counting terminal face with no TER slice. Batch 2 adds the TER client projection; the eventual generated union closes against the server route registry. Preserve independent admin apps, shared-foundation restrictions and the verify evidence limits. |
| doc/decisions/2026-07-25-v2s-backend-app-layout-and-tdp-placeholder.md, the body paragraph that states terminal-data-server is an empty placeholder with no runtime | This accepted decision supersedes only that named paragraph; no front-matter link to the whole file or H1 is used | terminal-data-server becomes the approved auxiliary WebSocket runtime, still distinct from TDP. Preserve sole business Flyway ownership, no TDP, topic sync, seed, independent schema history or additional business deployable. |

The root ADR's §3.7 one-database/one-Flyway clauses at lines 125–137 are preserved, not superseded. The COMMAND/TASK_READ rules, owner sovereignty, and database boundaries are preserved except for the explicitly named new owner and edges above. No front-matter entry means that an entire file or unrelated section is replaced.

### 6.2 Governance source cross-reference and exact local disposition

| Owning source and exact current location | Batch-1 synchronization and remaining implementation disposition |
|---|---|
| AGENTS.md lines 44, 48 and 56; line 83 | Preserve one business deployable, one database, one Flyway history, no MQ/outbox/TDP and remote Java/DB placement. The placeholder sentence and remote tunnel boundary are synchronized. D-44 permits three independent TDS DEV instances behind two HAProxy WebSocket entries; node ports remain remote-loopback-only and cross-node session coordination remains batch 3. Line 83 distinguishes business HTTP scenarios from protocol-only WebSocket CONTRACT. Keep no PostgreSQL tunnel, no local Java, DEV/seed/reset and acceptance boundaries. |
| PLATFORM-BLUEPRINT.md lines 5–7, 47–51 and 55–63 | Preserve one business app, one DB, one Flyway, no TDP/MQ/outbox and managed remote execution. State the D-44 three-instance DEV topology and two managed HAProxy WebSocket entries without implying cross-node session coordination; business owner rules remain unchanged. |
| doc/platform/README.md lines 18–20 | Preserve current delivery topology and the prohibition on future TDP. Clarify the approved auxiliary TDS runtime and D-44 DEV topology; it is not a new business owner or business deployable. |
| scripts/README.md lines 3, 70–89, 127–129, 178–190 | Preserve unique backend-acceptance entry and scenario ownership. The placeholder sentence and target remote topology are synchronized, including TDS readiness/process/port/manifest/cleanup fields. Batch-2 DEV has three TDS instances behind two HAProxy WS entries; PostgreSQL remains remote-only. `r5-dev-runner.mjs` implementation and runtime proof are assigned to CP-05 in the batch-2 plan. |
| doc/platform/foundation-charter.md §1-A lines 27–34 and §2-D lines 250–254 | Preserve ONE_BUSINESS_DEPLOYABLE, ONE_DB_MULTI_SCHEMA, ONE_FLYWAY_HISTORY and the bans on normal polling, MQ and generic outbox. TDS remains an auxiliary transport runtime, not a second business deployable; LISTEN/NOTIFY is only the specified transactional wake-up. |
| HANDOFF.md | Explicitly excluded by Dexter's current instruction: do not read or modify this file in batch 2. No HANDOFF content is used as an implementation source or authority. |
| project-memory/kernel/02-service-shape-and-owner.md lines 14–18 and project-memory/required-inventory.json lines 965–973 | Keep ONE_BUSINESS_DEPLOYABLE and its required assertion intact. TDS is an auxiliary non-business app and is not counted as a second business deployable. |
| project-memory/decisions/distributed-topology-is-not-current.md lines 14–18 and project-memory/required-inventory.json lines 203–211 | Keep NO_MQ_OUTBOX_TDP, NO_INTERNAL_OPENAPI_CLIENT and NO_DISTRIBUTED_DEFAULTS assertions. D-44's explicitly approved TDS deployment topology is allowed; it does not revive a broker, outbox, durable queue, internal client, cross-node session coordination or topic sync. |
| doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json line 55 | Keep tdp=FORBIDDEN. The batch adds no TDS identity, binding or credential to DEV seed. |
| doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md lines 14–29, 35–61 and 84–89 | The active standard now adds the separately managed TDS WebSocket CONTRACT boundary and Java scenario-id executor, while keeping BackendAcceptanceTest.java as the sole shared lifecycle entry and store-terminal scenarios as the business owner group. |
| doc/platform/terminal-coding-standard.md TR-09 exception, lines 325–373 | Do not broaden the kernel.base.state exception. D-16 requires server-config to return in batch 2 and be retained on reset. Batch 2 must state that retained-state boundary in its own owning design and update the TR-09 server-config exception text there; the kernel.base.state exception remains unchanged. |
| scripts/dev/r5-dev-runner.mjs lines 702–720, 791–899 | Extend the managed topology, identity-bound start/stop/readiness, and tunnel allowlist for three TDS processes and two HAProxy WebSocket entries. Replace manifest topology value HTTP_AND_ASSET_ONLY with an explicit TDS-aware value and preserve exact process identity, source/run manifest, remote logs, readiness and cleanup. No local TDS, database tunnel or unmanaged port-based cleanup. |

### 6.3 Batch ownership

R-12 is closed by batch. Batch 1 owns terminal-binding, business HTTP activation/cancellation, single-node TDS protocol and shared HTTP/WS contract. Batch 2 owns `server-config`, `terminal-data-client`, transport, state, DevicePort, TER API generation, TDS multi-instance deployment, node identity/readiness, and remove-before-drain routing; the historical `tcp-control`/`tdp-sync` activation and connection duties move to `terminal-data-client`, while topic synchronization stays deferred. Batch 3 owns cross-node session coordination, cross-node replacement/topic synchronization, and Doris. This decision keeps `server-config` in the current release under D-11; implementation remains in batch 2 under D-16 unless Dexter changes that assignment.

## 7. Boundaries

This decision does not introduce a general edge/BFF module, a second business deployable, message broker, outbox, Redis, periodic business-state polling, TDP, Doris, multi-node session coordination, a public dashboard, or a device UI. `server-config` is not deleted or cancelled; it remains an explicit batch-2 owner package per D-11/D-31.

## 8. Dexter 2026-10-01 history-storage amendment

Dexter ruled: “绑定历史不需要写Doris，数量很少，就在PostgreSQL里就好了，连接历史，需要写Doris，后面需要统计”. Binding history is owned and written by the business backend in PostgreSQL; use existing owner audit/persistence facts where sufficient rather than duplicate history. TDS writes connection, disconnection reasons and per-heartbeat round-trip history to Doris for future statistics. PostgreSQL retains latest connection state. This supersedes only the earlier requirement for both apps to write binding/connection history through a shared Doris writer. Bounded retry/discard applies to Doris connection history, not PostgreSQL binding history. Preserve owner transaction and audit guarantees.

This is a product storage-scope amendment for batch 3, not authorization to implement or run batch 3 now. Future statistics APIs/UI remain outside this amendment. Doris feasibility, managed DEV/acceptance lifecycle, reset coverage and cross-node session coordination remain required. The authoritative synchronized requirements are R-6.5/R-6.6 and V-B9 in the requirement source, with the dated ruling recorded in §11.25.
