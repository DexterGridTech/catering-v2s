# Dual-admin ProTable compact implementation review input

- `REVIEW_CYCLE_ID`: `DUAL-ADMIN-PROTABLE-COMPACT-20260805`
- `REVIEW_TARGET`: `IMPLEMENTATION`
- `REVIEW_ROUND`: `1`
- `REVIEW_ROUND_LIMIT`: `2`
- `reviewerKind`: `INDEPENDENT_SUBAGENT`
- `scope`: 13 production ProTable instances in the two admin apps, the compact standard, its checker, and focused/exit evidence.

## Required input checklist

| Required input | Repository-relative path / command | SHA-256 or command output | Read / result |
| --- | --- | --- | --- |
| AGENTS | `AGENTS.md` | `4d64bfb2bb435326a13c2ccb7955dbbbef621259030693e64db3cbf6a0bd9fda` | `READ` |
| Claude entry | `CLAUDE.md` | `8b12b36e0c852f3a55f40f29d3d21101b9acb113b969ff5f8a9c2152c2aec50f` | `READ` |
| Blueprint | `PLATFORM-BLUEPRINT.md` | `3b90bd602eb682c4718d6c51f399501c34f804cddd96da82d59495e60b115a8d` | `READ` |
| Current Roadmap | `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` + `CURRENT_*` | `d2490f5038f02ad40b19150a377a2188f313350d965460c3a07ab4c1c3f4eb73` | `READ_CURRENT` |
| All kernel | `project-memory/kernel/*.md` | `sha256sum project-memory/kernel/*.md` at review time | `READ_ALL` |
| Six-dimension route | `scripts/context/recall-memory --task-kind review --domain platform --consumer-face platform-admin --owner platform --impact governance --trigger task-start`; `... --consumer-face operations-admin --owner platform ...` | both command outputs retained by reviewer | `RUN` |
| Standards matrix | `contracts/policy/standards-coverage-matrix.json` | `80aa25c1d87c8d3e53443619475b133eb377e463141aa67b87e9f587d0dfa460` | `READ_CHECKLIST` |
| Verification governance | `doc/decisions/2026-07-24-v2s-verification-governance.md` | `c9632a65f9eac7678a4be919d980894e3f1e71e5e2e1ddce70ea3c7091d829dc` | `READ` |
| Active package | `.runtime/compliance-control/active-package.json` | `3c3abbe5c48703032aa6dc04f92b301b9bb7bf4eb15f77aaac18c901274b2aa3` | `READ_FULL` |
| Design | `doc/plans/platform/2026-08-05-v2s-dual-admin-protable-compact-implementation-design.md` | `74cbf0394df0be0c160522bf6980f570f5989142b981dd986ae43aa02476ba7c` | `READ_FULL` |
| Checker | `scripts/check/protable-compact.mjs` | `b0a03bd9a38e82df572f2fffbfa3275de826f91571cd97ea2607cedf54ed142f` | `READ_FULL` |
| Focused proof | `doc/review/platform/2026-08-05-v2s-dual-admin-protable-compact-focused-proof.json` | `885c38226cde8d8d1221cc00fb73d1d8c99a8f4aa3c4a5e772a6cd81e1e172` | `READ_FULL` |
| Exit evidence | `doc/evidence/platform/2026-08-05-v2s-dual-admin-protable-compact-exit.json` | `2fa944a668e6b495b337c4ac48d84c985e1c501b9659fa4513a5f9e295a6b155` | `READ_FULL` |
| Source denominator | `apps/frontend/platform-admin/src/features/**/ui/*.tsx`; `apps/frontend/operations-admin/src/features/**/ui/*.tsx` | `node scripts/check/protable-compact.mjs` output | `READ_FULL` |
| Existing memory anchor | `project-memory/operations/phase-retrospective-and-systemic-repair.md` (`STANDARD_CRUD_LIST_MUST_USE_PROTABLE_QUERYFILTER_AND_OWNER_SORT`) | reviewer reopens source | `READ` |
| Applicable decisions | `doc/decisions/` title listing plus relevant UI/AntD decisions | reviewer reopens source | `TITLES_REVIEWED` |

### Production source list

`platform-admin`: `ExtensionsPage.tsx`, `PlatformReadPage.tsx` (2 instances), `AdministratorsPage.tsx`, `AccountsPage.tsx`, `PlatformInvitationPanel.tsx`, `RolesPage.tsx`, `WorkspaceManagementPage.tsx`.

`operations-admin`: `BusinessEntityManagementPage.tsx`, `ContractManagementPage.tsx`, `StoreManagementPage.tsx`, `WorkspaceInvitationPanel.tsx`, `WorkspaceUserPage.tsx`.

## Blind-review declaration

`I received this checklist in a fresh subagent context, tried to falsify the reviewed implementation, and wrote my findings and verdict before reading or relying on author self-review or finding dispositions. I treated every missing or substituted pointwise source reread, source denominator row, or red mutation as a finding; a general preparation pass, static result, or later L2 did not substitute for it.`
