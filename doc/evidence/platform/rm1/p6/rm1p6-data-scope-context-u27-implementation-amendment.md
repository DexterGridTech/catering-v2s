# U27 operations data-scope context supersession

## Dexter-authorized current product decision

Dexter requires the operations-admin data-node selector to be page-driven and to retain four user selections in Redux: region, project, store and head company. The selector is not an authorization source. Workspace-IAM remains the only source of role-constrained candidates and every owner still rechecks the resolved current target before a protected read or write.

The organization branch is region → project → store. Head company is a separate IAM branch and must not be inserted into the organization tree.

### Original requirement preserved

1. Selector visibility and visible rows follow the current content tab's required data-node type; Redux retains region, project, store and head-company selections.
2. REGION pages show only “大区：<名称(编码)>” or “大区：-”.
3. PROJECT pages show region and project on two rows.
4. STORE pages show region, project and store on three rows.
5. HEAD_COMPANY pages show only “总公司：<名称(编码)>”.
6. Group roles may choose all descendants; region roles fix region; project roles fix region/project; store roles fix all three; head-company roles fix head company.
7. Group roles may choose every head company; head-company roles may choose only their own.
8. An explicit upstream choice clears its descendants; an unchanged selection remains available across tabs in the same Redux session.
9. Every scoped content page has a shared first-row context component showing the required current scope or a precise left-sider selection prompt.
10. Store management and store-contract management are project-context CRUD pages: remove their project filter and bind list/create behavior to the owner-rechecked selected project.

## Scoped selector UX acceptance repair

The owner-confirmed scope protocol remains unchanged. The selector is a local draft surface until the user explicitly confirms the final scope required by the active tab. Selecting a higher organization level clears its lower draft levels; cancelling, Escape, or clicking outside discards every draft and leaves the owner-confirmed Redux context unchanged.

The user-facing selector and shared first-row context may only name the final required scope: 大区、项目、门店 or 总公司. Generic user-facing “数据节点” wording is forbidden on these surfaces. The fixed left-sider trigger must make the management range discoverable, render only the rows required by the active tab, and identify its action as range selection. The shared context bar is the only content-page prompt when a scope is missing; scoped child pages must skip their query but must not repeat a second missing-scope alert.

## Scoped content readiness guard

Every catalog page whose `requiredDataNodeType` is not `NONE` is mounted through one operations-admin shell surface. Redux retains the owner-confirmed four-selection mirror for app-wide selection continuity, but the guard and the first-row text read the current `WorkspaceSessionEntry.scopeContext` passed by the shell. This makes readiness atomically tied to the entry whose role, context version and query arguments are currently rendered; it cannot briefly mount a new role/page from a prior Redux value before a mirror `useEffect` runs. The guard requires the complete hierarchy for the active type: REGION=region, PROJECT=region+project, STORE=region+project+store, HEAD_COMPANY=head company. Until ready, the surface renders the existing exact prompt and a non-interactive gray skeleton instead of mounting business content; this prevents forms, tabs, actions and their page-level effects from becoming interactive before selection. The left-sider selector remains outside the guarded surface, so it is always available to recover the missing selection. The guard is UX/lifecycle only and neither authorizes reads nor replaces the owner recheck.

## Remote candidate Select protocol repair

Every operations-admin Select that drives a remote candidate query must use the Ant Design protocol shape showSearch, filterOption=false, and a top-level onSearch. showSearch is a boolean accessibility/display flag; it is not a configuration object. Nesting filterOption or onSearch under it silently leaves the control on its local filtering path and disconnects the remote query callback.

The confirmed denominator is the 13 remote-candidate controls in the workspace invitation/create and user filters, contract create and list filters, store create/edit forms, and head-company brand authorization drawer. Each retains its existing generated-owner candidate endpoint, selected-value retention, and pagination callback; this repair changes only the control-to-query wiring. The data-scope selector is an explicit counterexample: it filters the owner-returned in-memory role candidates locally and must not gain remote search behavior.

The focused proof must reject the invalid nested showSearch configuration form across the operations-admin source denominator and positively require the top-level remote-search protocol for every listed candidate control.

## Exact supersession

This package supersedes only the conflicting current-implementation portions of:

- `doc/decisions/2026-07-28-v2s-rm1-ia-02-operation-context-interaction.md#IA02-OPERATIONS-DATA-SCOPE`: one selected data node, three-type-only selector and final-node-only session representation.
- `doc/decisions/2026-07-29-v2s-rm1-ia-04-operations-organization-and-contract-interaction.md#IA04-STORE-PAGE` and contract-page project-filter language.
- corresponding `contracts/catalog/admin-catalog.json` requirements that leave HEAD_COMPANY as NONE or make store management STORE-scoped.

The old sources remain immutable historical evidence. Their owner-returned candidates, final server recheck, failure preservation, app-owned shell and separation of read range from write capability remain current constraints.
