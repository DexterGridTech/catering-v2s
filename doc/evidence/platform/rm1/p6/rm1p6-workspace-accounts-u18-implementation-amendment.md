---
packageId: RM1P6-WORKSPACE-ACCOUNTS-U18
reviewTarget: DESIGN
authorizationBoundary: Dexter authorized the complete platform workspace account and permanent invitation-centre closure, including owner, migration, contract, generated client, platform edge, platform-admin UI and DEV proof. No UAT claim, new workspace capability, public invitation protocol, raw client transport or direct SQL command is authorized.
---

# Platform workspace accounts and permanent invitation centre

## Why and source readback

The user task is a platform governance closure, not a page-field adjustment. IA01 section 13 and IA03 section 14 supersede historical invitation retirement: PLATFORM-WORKSPACE-ACCOUNTS permanently retains 账号 and 邀请 tabs. The account tab retrieves owner facts for multi-assignment identities; the invitation tab remains the cross-node governance face and does not replace operations-admin target-scoped screens.

Current sources prove the gap: AccountsPage disables ProTable search and joins assignment strings; WorkspaceUserService.pageForPlatform joins role assignments and has no same-assignment type/ref predicate; the edge maps last login as absent; WorkspaceAuthenticationService.createRawSession has no append-only authentication fact.

## Implementation contract

1. Add a workspace-IAM owned append-only successful-authentication table with account/workspace/key/time only and a workspace/key/account/time-desc index. createRawSession writes it in the owner transaction after success; no credential, token, OTP, IP or user-agent is retained. Page IDs and projection use the same set-based latest-auth aggregate with account-id tie-break; detail reads at most ten records ordered time-desc then id-desc without per-account reads.
2. Add serviceNodeType and opaque organizationRef account query fields. WorkspaceUserService uses one correlated EXISTS over a single role_assignment for type, ref and selected role together; count and page IDs share the identical predicate. Accounts use owner candidate selects: type enables searchable organization and type-scoped searchable role; changing type clears both downstream selections. IDs stay bounded and current set-based hydration stays N+1 free.
3. Add LAST_LOGIN_AT to the platform sort enum. Owner sorting permits display name, login name, last login and update time only, with stable account-id pagination tie-break.
4. Project account mobile as an explicitly named plain field only for this authenticated platform account read. Invitation/public projections remain masked. UI does not render internal id, revision or candidate ref.
5. Edge preserves platform session and enabled-workspace checks before forwarding all filters. Under the current capability-invariant model, platform task reads are authenticated by the edge resolver and enabled-workspace gate, while the registry denominator is mutation-only; therefore account list/detail add neither registry requirements nor workspace capability mappings. This is verified by the invariant's rejection of read-operation registry extras. No direct SQL is added.
6. AccountsPage uses normal ProTable search/QueryFilter with independent account tab values, page, sort and expansion. Type change clears organization; candidate data is owner-backed. Invitation tab retains independent state. The app-owned explicit workspace selection survives passive route/page refreshes; it is reconciled against the enabled owner list only after an owner-changing refresh, so a chosen scope is never lost merely by entering PLATFORM-WORKSPACE-ACCOUNTS.
7. Dexter 2026-08-03 supersedes only the account-table presentation: columns are exactly 姓名、手机号、登录账号、状态、任职机构 / 业务角色、最后登录时间、更新时间. Each assignment is one line in the combined TD, with the typed organization path first and its role name second; no joined text and no cross-assignment pairing. Only owner-backed scalar columns sort.
8. Name click calls useDetailDrawer().openLoading before read. Drawer contains plain mobile, login time, assignment table and latest-ten authentication history with empty state. Latest detail is the only action source for CAS/idempotency/readback.
9. Invitation panel retains generated RTK/client and adds type, path and creation time. Its permanent list filter and create form both use type to opaque ref to role owner-backed searchable selects; owner creation rejects mixed target types or refs before persistence, list filtering uses one invitation assignment intent for type/ref/selected role, and upstream changes clear downstream state. No token/candidate ref/revision renders.
10. Account and invitation presentation reads resolve persisted assignment/intention paths through a bounded organization-owner display API that includes disabled facts. It is distinct from the existing enabled-only authorization/task-path API: disabled or stale targets never become candidates, session scope, command authority or capability grants, but one historical assignment must not turn a whole platform list into a 404.
11. The permanent invitation tab uses the same Card-header pattern as platform administrator management: its task description and 发出邀请 action are in the first row, with the independent ProTable query below. Rows render a labelled link to the existing owner-issued `invitationPageUrl`, never its token. Pagination retains its requested page whenever no sorter is active; only actual sorting, filtering, or reset returns to page one.

## Rejected alternatives

Client filtering/sorting makes false governance results. A role join permits type from one assignment and ref from another. Invitation/audit/updatedAt is not authentication history. A platform capability key wrongly puts platform super-admin authorization into workspace capability model.

## Test contract and evidence boundary

redFirst true. Owner tests cover same-assignment/account and same-intent/invitation type/ref/role counterexample rejection, count/page parity, no duplicate multi-assignment account, same-time ordering, history descending/ten/empty, indexed set-based latest-auth read and sensitive-column absence. Edge tests cover parameter forwarding, platform session/disabled workspace rejection, declared platform authorization/no capability and real last-login. UI tests cover ProTable submit/reset, isolated tabs, type clearing organization and role, candidate request, multi-line cells, skeleton, ten history and invitation columns/cascade. A purpose-bound managed platform L2 additionally proves the generated account and invitation filter requests, immediate Drawer loading state, owner detail presentation and command readback against a fresh isolated namespace. Static gates are not DEV/L2/UAT proof. DEV uses only running local apps and managed middleware; L2/UAT are separately unclaimed.
