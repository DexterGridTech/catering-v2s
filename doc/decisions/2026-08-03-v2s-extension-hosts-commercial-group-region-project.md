# Extension hosts: commercial group, region and project

## Dexter-authorized scope

Dexter has extended the extension-field capability from the established five hosts to
`COMMERCIAL_GROUP`, `REGION`, and `PROJECT`. This is a complete host addition, not a
platform-admin category-only change: each host needs a definition, a typed value store,
owner validation in its command transaction, owner readback, generated edge contract,
form rendering, and detail rendering.

## User task and smallest viable design

Platform administrators configure definitions before entering business data. Operations
administrators create or update a region/project with those values and inspect the
persisted values in the organization tree. A commercial-group definition is configured
before the existing commercial-group initialization form; that form writes values and the
operations hierarchy root reads them back. This retains the one-time group initialization
lifecycle rather than inventing a second group-management capability.

The rejected alternative is three page-local field schemas or an untyped client-side map.
It duplicates type/required/disabled semantics and permits a detail surface to drift from
the owner. The existing `ExtensionDefinition` and JSON value model is reused instead.

## Owner and transaction boundary

- `organization.commercial_group` remains the commercial-group owner. Its initialization
  command validates `COMMERCIAL_GROUP` values against `ExtensionDefinitionLookup` and
  persists them in its required transaction.
- `organization.organization_node` remains the region/project owner. Create/update
  validate `REGION` or `PROJECT` values and persist them with its existing receipt/CAS
  transaction.
- No edge owns validation or writes extension values directly. Each command returns owner
  readback including values and rule revision.

## UI interaction

The operations organization-tree screen uses one generated definition request parameterized
by host type and one reusable dynamic-field renderer/serializer/detail mapper. Forms are
disabled until their definition is available; failed definition loads are explicit rather
than falling back to an invented schema. Platform's existing initialization Drawer uses
the same definition model for `COMMERCIAL_GROUP`.

## Seed and verification

The formal owner-command seed defines and writes representative values for all three hosts,
then asserts their owner readbacks. DEV verification ends with managed `reset -> start ->
seed`; business and cleanup remain separate.

## Prevention

Failure pattern: adding a configurable host without its durable value host and owner
readback. Denominator: every `ExtensionEntityType` value. Counterexample: a definition
may intentionally be empty, but it still has a durable owner value surface. Remedy:
owner/contract/UI tests enumerate the whole host set and require the three new hosts.
