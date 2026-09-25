---
id: operations.business-corpus-parked-domain-intake
status: active
layer: routed
taskKinds: ["design","review"]
domains: ["all"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["all"]
triggers: ["task-start","review"]
assertions: ["BUSINESS_CORPUS_GRILL_ONLY_BY_DEXTER_PROGRESS","BUSINESS_CORPUS_G01_G12_ACCEPTED"]
sourceRefs: ["doc/decisions/2026-07-25-v2s-confirmed-business-corpus-memory-adoption.md"]
---

# Business corpus parked domain intake

## Status

All entries below are `PARKED_UNVERIFIED`: they are questions plus sources, not product facts,
implementation backlog work. Grill resumes only when Dexter explicitly starts it based
on development progress. There is no automatic trigger, schedule or generic “complete V6 22
domains” initiative.

## 08–22 future domains

| Domain | Parked scope | Primary source |
| --- | --- | --- |
| 08–10 | Customer/member identity, benefit ledger, marketing benefit and loyalty | V6 domains 08–10 |
| 11–14 | Orders, payment, fulfillment/production, settlement/reconciliation | V6 domains 11–14 |
| 15–18 | Business channels, external collaboration, terminal data/control plane | V6 domains 15–18 |
| 19–22 | Analytics, operations governance, print rules, on-site service | V6 domains 19–22 |

## 01–07 unconfirmed residuals

| Domain | Parked question; no inferred answer | Primary source |
| --- | --- | --- |
| 02 organization | `StoreOperationType`: entity versus enum; `OrgScope`: business purpose, boundary and relation to authorization | V6 02 |
| 03 commercial relations | Beyond the accepted light Store lease: project management/party relations, contracted-space lines, Store marketing participation agreement and accepted-benefit-type lines | V6 03 |
| 01–07 cross-domain | Any residual concept that conflicts with G-01–G-12 or lacks an accepted business definition | V6 terminology table and the relevant formal domain document |

## Dexter-started recovery protocol

When Dexter starts a specific parked domain, read this entry, the V6 terminology table, that formal
domain document and applicable all-v2 current decisions. Use v4/v1 only as explanatory evidence.
Prepare a reviewer-sized question batch, number each new question G-13 onward, and include business
language, relation, counterexample, source and `已共识/待裁决` status. Dexter decides each question;
then obtain Claude review and Dexter acceptance before adding a new canonical entry. Do not silently
turn a technical identifier, old implementation or this parked table into an answer.
