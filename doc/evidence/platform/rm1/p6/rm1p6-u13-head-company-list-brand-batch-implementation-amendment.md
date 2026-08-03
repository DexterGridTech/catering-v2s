---
title: RM1 U13 head-company list authorized-brand batch read
status: IMPLEMENTATION_AUTHORIZED
---

`getOperationsOrganizationHeadCompanies` is a paged operations-admin task.  Its current edge
mapping invokes `BusinessEntityService.authorizedBrands` for every head-company row; each call
rechecks one head company before reading its brands.  This is the second confirmed instance of
`PF-HTTP-EFF-02`, not a permission shortcut.

Add a narrow organization-owner task read accepting the already bounded page's distinct head-company
IDs plus the session workspace/key.  It performs one workspace/key-constrained query, groups returned
brands by requested head-company ID, and returns an empty list for a requested head company without
authorizations.  The edge maps the owner result only.  The single-object `authorizedBrands` method
remains authoritative for detail/create/update/status readbacks and continues to enforce its
single-object existence semantics.

The repair must not introduce cross-owner reads, edge-side brand querying, an unbounded replacement
for the organization page, or a weakening of workspace/key/status predicates.  Focused proof covers
one, twenty and fifty row pages and asserts one batch owner invocation with zero per-row calls.
