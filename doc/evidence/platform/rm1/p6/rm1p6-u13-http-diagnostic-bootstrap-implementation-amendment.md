---
title: RM1 U13 HTTP diagnostic first-platform-actor bootstrap implementation amendment
status: IMPLEMENTATION_AUTHORIZED
packageId: RM1P6-HTTP-DIAGNOSTIC-BOOTSTRAP-U13
sourceDesign: doc/evidence/platform/rm1/p6/rm1p6-u13-all-http-crud-efficiency-remediation-design.md
---

# Purpose

The 147-operation diagnostic must establish facts through owner commands, yet every existing
platform-admin creation route requires an already enabled platform administrator. The only empty-table
creator is the frozen Seed direct-SQL exception, which is not a legal diagnostic dependency.

# Minimal repair

Add a narrow non-HTTP `platform-iam.api` bootstrap command, implemented transactionally by the
platform IAM owner. It may create exactly one enabled diagnostic administrator only while the owner
has zero administrators. It returns only the existing safe administrator readback. It must not add an
OpenAPI path, controller, generated client, persistent bootstrap secret, default account, or automatic
application startup behavior.

The future managed diagnostic runner is the only intended caller. It supplies its generated credential
in memory and must dispose it after use; this package does not create that runner or execute DEV/seed/
reset/L2. Existing normal `createAdministrator` actor checks remain unchanged.

# Focused proof

Prove success from an empty owner state and rejection after one administrator exists. Prove that normal
administrator creation still rejects a missing/disabled actor. Verify the new interface is declared in
the owner API package and has no edge/OpenAPI consumer. Static/type tests may prove source behavior;
they are not HTTP coverage, performance, business or cleanup evidence.
