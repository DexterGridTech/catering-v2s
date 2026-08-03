---
title: RM1 P6 CP-U14 managed reset transport correction
packageId: RM1P6-CP-U14
status: IMPLEMENTATION_AUTHORIZED_BY_DEXTER
---

# RM1 P6 CP-U14 managed reset transport correction

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

## Root cause and bounded remedy

The first failure `R5_DEV_RESET_COMMAND_FAILED:psql` was caused by `r5-reset.mjs` inventing a local administrator execution plane. The working sibling denominator is `r5-dev-runner.mjs` remote provision and `r5-seed-bootstrap.mjs`: both use the existing hash-bound non-production SSH host and remote `catering-postgres` container. The correction is confined to reset transport; it does not alter U13, seed ownership, application runtime topology, browser L2, UAT or product behavior.

## Required execution

`r5-reset.mjs` must revalidate namespace, exact derived database, remote host hash and non-production host marker. It must never read or print an administrator URL, administrator username or administrator password, and must not execute local `psql`, local Docker, raw manual SQL or a temporary tunnel. After explicit confirmation it writes a 0600 reset manifest/event log, verifies any current DEV through the r5 runner manifest and start tokens, and delegates only that owned run to the existing runner stop command. It then uses `ssh -o BatchMode=yes` to invoke the remote `docker exec catering-postgres psql -U catering -d postgres` management plane in this exact order: terminate connections, drop the one derived namespace database, read back that it is absent. It never creates a database; `scripts/dev/start` reuses its existing remote provision path to create it.

## Proof and exclusions

The focused proof must demonstrate red rejection for host hash mismatch, production-like host, illegal database name, failed remote execution and failed absence readback. A dynamic reset is business PASS only when the remote absence readback passes; cleanup is separately PASS only when no reset-owned persistent process remains. A seed refusal `OWNER_COMMAND_EXECUTOR_NOT_IMPLEMENTED` remains an honest downstream controlled block, not a reason to add direct SQL.
