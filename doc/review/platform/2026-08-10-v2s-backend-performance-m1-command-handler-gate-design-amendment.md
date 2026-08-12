---
programId: BACKEND_PERFORMANCE_FINAL_CLOSURE
deliveryUnit: SQL_M1_COMMAND_FIRST_BATCH
status: POST_REMEDIATION_V3_AWAITING_CLAUDE_RECHECK
reviewBinding: ROUND2_FINAL_POST_REMEDIATION_V3
scope: all registry-bound commands; 68 workspace-owner commands are the M1 implementation slice
---

# SQL-M1 command topology and universal-gate amendment

## Purpose and verified starting point

The measured command cost is structurally shared: the 68 operations-admin
`OWNER_COMMAND` rows with `REQUIRED` and `WORKSPACE_EXECUTION_CONTEXT` all pay the
same workspace session, scope and authorization stack before their owner command starts.
The first batch is limited to that shared shape: owner-local fact consolidation, one
command `REQUIRED` transaction and command-local readback.  It does not bring forward
the second-batch, operation-specific `EXISTS`/CTE validation rewrite.

An HTTP controller cannot be that transaction origin: approved architecture requires the
initiating application handler to open `REQUIRED` and the edge only decodes/maps.  The
registry declares a concrete adapter for each M1 operation, but the corresponding
business-server source files are present for `0/68`.  Catalog's current 26-command path
is not an exception: its controller uses a generic `Map`/`ObjectNode`/`Function` helper
and its coordinator branches by token operation ID.  Both forms contradict this batch's
typed one-operation requirement and are migration targets.

## Universal command profile denominator

The universal denominator is every `mode = COMMAND` row in
`contracts/registry/operation-handler-bindings.json`: 113 current rows, all `REQUIRED`.
The closed current profile partition is:

| Profile tuple | Count | Enforcement mode |
| --- | ---: | --- |
| `operations-admin / WORKSPACE_EXECUTION_CONTEXT / OWNER_COMMAND / REQUIRED` | 68 | `WORKSPACE_OWNER_COMMAND`: exact M1 runtime execution matrix, typed handler and in-transaction workspace facts. |
| `operations-admin / WORKSPACE_PROTOCOL_CONTEXT / PROTOCOL / REQUIRED` | 7 | `WORKSPACE_PROTOCOL`: named protocol entry; no workspace-owner grant or selected-node inference. |
| `platform-admin / PLATFORM_COMMAND_CONTEXT / OWNER_COMMAND / REQUIRED` | 20 | `PLATFORM_OWNER_COMMAND`: named platform-owner entry and platform context origin; it must never be treated as a workspace command. |
| `platform-admin / PLATFORM_COMMAND_CONTEXT / PROTOCOL / REQUIRED` | 9 | `PLATFORM_PROTOCOL`: named platform protocol entry. |
| `public / PUBLIC_PROTOCOL_CONTEXT / PROTOCOL / REQUIRED` | 9 | `PUBLIC_PROTOCOL`: named public protocol entry and no authenticated-owner context. |

The new owned input
`contracts/registry/backend-performance-command-enforcement-profiles.json` declares exactly
these tuples, their permitted context origin, boundary kind and enforcement mode.  The gate
derives all command rows each time, requires exactly one profile for every row, and fails
closed for a new or retagged tuple.  The 45 non-M1 rows are not exempt: only the M1-specific
workspace-grant assertions are `NOT_APPLICABLE_WITH_REASON`; each remains checked against
its own protocol/platform topology.

`contracts/registry/backend-performance-command-topology-matrix.json` is the complementary
**113-row** source of actual topology.  Its rows have set equality with all command registry rows.
Every row names its real edge class/method, context-origin class/method, transaction-owning command
entry, owner/protocol public API, actual HTTP method/path joined from its owning route registry, and
source anchors.  A workspace-owner row references its detailed M1 execution-matrix row; every other
row states the exact profile-specific
`NOT_APPLICABLE_WITH_REASON` for workspace grant/readback assertions.  Thus a future command with
an already-known tuple still fails until it has a concrete topology row; a profile is never a
substitute for an actual endpoint-to-entry chain.

## M1 runtime execution denominator

The M1 selection is exactly:

```
face = operations-admin
mode = COMMAND
commandBoundary = OWNER_COMMAND
transactionMode = REQUIRED
contextKind = WORKSPACE_EXECUTION_CONTEXT
```

The present denominator is 68: workspace-IAM 20, organization 19, catalog 17, inventory
4, fulfillment-production 3, store-contract 3 and asset 2.  This is observed, not a
hard-coded allowlist: a future matching row automatically requires an execution-matrix row.

`contracts/registry/backend-performance-m1-command-execution-matrix.json` is the unique
68-row runtime input.  Every row declares its exact registry operation ID and adapter FQCN,
physical adapter source path, edge class/method, actual decoded edge request and response
DTOs, explicit server-only arguments, context requirement/token policy, resolver variant,
typed owner API, response/readback mode (`OWNER_READBACK` or `NO_CONTENT`) and source
anchors for non-generated authorization facts.  No requirement, node type, capability,
request shape or owner API may be inferred from a route, naming convention, body or
operation-ID branch.

The matrix authoring tool may pre-populate only registry, route-registry and capability-projection
facts, and must mark every non-mechanical field `UNRESOLVED_REQUIRES_SOURCE`.  A validator rejects
that value: explicit edge method, actual Java DTO, authorization target-selection rule, resolver
variant, owner invocation and response producer must each be source-anchored.  This prevents a
source-name guess from becoming a security or ownership rule.

Resolver selection is owner-specific. `resolveCatalog` is a catalog-family resolver only: it
selects STORE/HEAD_COMPANY data nodes and retains organization-owned catalog brand/copy judgment.
It is invalid for the other 42 M1 operations. Those operations begin with the existing immutable
`WorkspaceCommandAuthorizationFacts` projection from one fresh workspace-IAM load. Their concrete
owner-local handler then performs its declared organization, contract or workspace-IAM target/grant
judgment. A generic all-owner target resolver, operation-ID branch, callback or request map is
forbidden. P1-generated DTOs close the edge transport type only; catalog, inventory and production
handlers may call an owner only after a module-owned typed public command API has been declared and
implemented for that exact operation.

The remaining typed-owner boundary is a closed source-backed set, not a reason to weaken the
adapter. It has 17 unique operations and 23 finding incidences: 14 generated-wire descriptive
extension payloads currently cross into owner `Map` inputs, and 9 HTTP response compositions need
an owner-native readback. The owner exposes a named module-native command record and named
readback; the adapter maps only explicit wire fields and server facts. For a head-company response,
authorized brands remain organization-owned. For a store response, organization detail and the
contract's derived status are composed inside the same REQUIRED transaction through declared typed
owner APIs. For a contract response, the contract owner produces its full task view before the
transaction exits. P1 wire DTOs never enter a module, no adapter produces a `Map`/`ObjectNode`,
and owner facts/replay order remain local.

### F10 decided typed-boundary form

`ExtensionSubmission(List<ExtensionFieldValue>)` is the only public dynamic-extension input.  An
entry has `fieldKey`, canonical JSON-text `valueJson`, and explicit `SET` or `CLEAR` mode.  Omission
means no submission.  `CLEAR` is never encoded by Java `null` or literal JSON text `"null"`; a
`SET` value is interpreted and validated only by the extension owner against the current definition.
The definition revision remains owner-generated persistence/readback evidence, never a request CAS.

Head-company, Store and Contract responses retain their existing HTTP shapes.  A head-company
typed owner readback includes its organization-owned authorized brands.  For every Store operation,
the one-operation composition producer stays in the same `REQUIRED` transaction and must reuse the
existing `StoreWireMapper.store(ownerReadback, organizationDetail, contractDerivedStatus)` signature;
it may request only declared typed organization and contract readbacks and may not create a mapper,
JDBC/repository query, convenience BFF or copied contract state.  Contract supplies its own complete
task view before the transaction exits.  Moving any of these reads to a subsequent GET is forbidden:
it changes the HTTP journey and repays the full command context stack.

The mandatory gate therefore treats these as closed, generic rules across the 17/23 denominator:
public owner API signatures and adapters expose neither `Map` nor `JsonNode`/`ObjectNode` for
extension values; composition is one operation per producer and calls only declared typed readbacks;
and all affected wire responses retain their authoritative field shape.  The gate requires real
red mutations for each rule before F10 may leave `PENDING`.

## Required M1 per-operation runtime form

For every matrix row, its exact registry adapter FQCN is the only application handler.  There
is exactly one source file and exactly one public transaction entry.  It must:

1. carry `@Transactional(propagation = Propagation.REQUIRED)` on that concrete entry;
2. receive a typed invocation/request, never an operation-ID string, `Map`, `ObjectNode`,
   callback, service locator or generic request-facts bag;
3. resolve fresh workspace command facts as its first application action inside that transaction;
4. obtain organization/contract judgment only through the declared public typed owner API;
5. call the one declared owner command API, preserving receipt, grant/context and owner object
   recheck order; and
6. produce any declared command readback before the transaction ends.

The edge may decode the named request and pass only explicit credential/correlation/path/header
facts into its generated binding.  It may not resolve command context, start the transaction,
rebuild owner facts, construct `WorkspaceExecutionContext`, or dispatch by operation ID.

## Generated runtime binding and build closure

The current files under `contracts/registry/generated/operation-handler-bindings/java` are
contract artifacts, not runtime proof.  They are zero-field marker wire/context records and
no production source invokes them.  They are compiled incidentally through catalog's
`contracts` source set, but that does not make them executable wiring.

`scripts/generate/backend-performance-m1-command-execution-bindings.mjs` validates the 68-row
matrix against the canonical registry and emits one concrete, typed runtime binding method per
row to:

```
apps/backend/catering-business-server/build/generated/sources/
backend-performance-m1-command-execution/main/java
```

`apps/backend/catering-business-server/build.gradle.kts` registers that directory in main Java
and makes `compileJava` depend on the generator.  Generated files are build products, never a
second handwritten implementation surface.  Each method accepts its actual edge DTO and explicit
server facts, directly calls only its named adapter and contains no collection, reflection,
bean scan, string lookup, `Map`, `ObjectNode`, `Function` or callback bridge.

There is an explicit catalog-family prerequisite.  The 42 edge-face M1 request/response Java types
already exist under `app.edge.generated.wire`; catalog/inventory/production/asset's 26 contract wire
names presently exist only as OpenAPI components and their controller uses generic JSON.  The
implementation first extends `scripts/generate/catalog-inventory-p1.mjs`, from its existing
catalog-inventory OpenAPI/edge-contract authority, to emit the exact 26 backend request/response
Java DTOs into the business-server generated source set.  The M1 runtime-binding generator may not
substitute an OpenAPI schema name, `ObjectNode`, `Map` or a handwritten shadow DTO.  Its input hashes
must bind the P1 source, catalog OpenAPI root/components and generated DTO output before any of the
26 M1 runtime rows is admitted.

All 68 adapters are physically in the business-server composition source set while retaining
their registry owner-qualified application package.  This avoids the existing
workspace-IAM-to-organization reverse-dependency cycle and gives every M1 command one verified
composition transaction boundary.  Store-contract does not share that exact cycle, but the same
placement avoids a second runtime binding model.  These composition adapters hold no owner state,
repository, JDBC access or business rule; they only resolve context and call the declared owner API.
This is not a generic `app/application` layer because each class is one-operation only.

The resulting runtime chain is fixed:

```
edge endpoint -> generated typed runtime binding -> named adapter.transactionEntry
              -> REQUIRED transaction -> typed context resolver -> typed owner API -> response
```

## Universal mechanical gate

`scripts/check/backend-performance-sql-merge-coverage` becomes a registry-derived command-topology
gate and remains the active package's mandatory-per-edit command.  On every invocation it rebuilds
all 113 command rows, validates their exact profile, then applies the M1 execution-matrix rules to
every workspace-owner row:

| Invariant | Mechanical proof |
| --- | --- |
| Universal denominator | all command IDs equal profile coverage **and** topology-matrix coverage; unknown tuple, missing row or extra row fails. |
| M1 denominator | selected registry IDs equal matrix rows; missing or extra row fails. |
| One operation, one handler | FQCN, source path, class name and `OPERATION_ID` literal equal the exact matrix/binding operation; no shared selected handler. |
| Correct transaction origin | direct adapter entry is `REQUIRED`; selected edge source has no simple or fully-qualified transactional annotation. |
| Context inside transaction | direct entry's first application call is the typed resolver; edge legacy session/context methods are forbidden on the selected path. |
| Actual compiled chain | root build source set owns generated binding, generated method names its adapter, and edge invokes it rather than an old service path. |
| No generic escape hatch | selected path rejects operation-ID switches, `Map`, `ObjectNode`, `Function`, callback, service locator, marker binding imports, JDBC/repository/entity imports. |
| Owner sovereignty | handler invokes only its declared typed owner API and has no cross-schema data access. |
| Readback topology | `OWNER_READBACK` occurs before entry exit; `NO_CONTENT` has no synthetic task read. |
| Other command modes | every protocol/platform row resolves to its declared edge/context/transaction/owner topology; only its documented M1 assertion is not applicable. |

Real red mutations include: unknown future tuple; a future command with a known profile but no
topology row; future M1 binding without an execution-matrix row; two operation IDs sharing a
handler; wrong `OPERATION_ID`; a controller transaction annotation; context before entry;
`Map`/callback/direct JDBC; catalog generic dispatch; a non-M1 row moved to an incompatible
context/transaction origin; response readback after the entry; and source/registry denominator
drift.  The existing compliance-hook self-test proves a
failing mandatory gate prevents a post receipt.  Static proof never establishes JDBC-event savings
or Spring proxy behavior; the later existing seed report remains the only numerical evidence.

## Explicitly deferred and authorization boundary

## Host extension request revision drift (M1-F11)

The five extension hosts (Brand, Tenant, HeadCompany, Store and Contract) are a closed
10-operation create/update boundary. The authoritative interaction decision requires their
extension values to be validated against the current definition at owner submission time; a host
write request must not carry a definition revision. The finite implementation drift is eight
`expectedExtensionRuleRevision` request properties plus the Store-update
`extensionRuleRevision` synonym. The latter is a request-field spelling, not a reason to remove
the persisted/readback `extensionRuleRevision` fact.

The mandatory gate resolves the affected request schemas and generated request types, rejects
either field at every host write boundary, and reopens the ten owner anchors to require
current-definition validation plus persisted/readback revision. Its diagnostic must explain that
the correct pattern is owner-time validation and evidence retention, never an adapter-invented
definition CAS. It must also prove red cases for a reintroduced request field and for deleting
the owner validation anchor. Entity `expectedVersion` and the platform definition command's own
CAS are explicitly outside this denominator.

No runtime is added: the existing code generator owns the generated Java/TypeScript update, the
existing Store drawer stops sending the obsolete property, and two existing managed fixture
scripts stop carrying it. No fixture environment, runner, owner capability or product journey
changes.

Per-operation validation folding, `INSERT ... SELECT`, CTE or `RETURNING` rewrites are second-batch
work.  This amendment does not authorize a new test runner/environment, dynamic runtime, DEV,
reset, seed, L2, Testcontainers, deployment, direct SQL or a SQL-performance success claim.  Until
the static implementation, existing unit tests, authorized reset and new r5-full seed comparison
are complete, `BP_U07_SQL_MERGE_SUCCESS=BLOCKED_UNMEASURED` and
`BP_U07_SNAPSHOT=NOT_SUPPLIED_UNMEASURED` remain unchanged.
