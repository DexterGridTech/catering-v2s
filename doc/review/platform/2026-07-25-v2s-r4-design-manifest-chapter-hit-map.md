---
title: R4 design manifest Part B-D chapter hit map
status: PROPOSED_REVIEW_ONLY
createdAt: 2026-07-25
designManifest: doc/review/platform/2026-07-25-v2s-r4-design-granularity-manifest.json
---

# R4 design manifest Part B-D chapter hit map

This is the chapter-level companion required for any Claude review of R4
implementation-facing design. The normative text remains in the frozen
Heritage manifest and the rule denominator remains in
`contracts/policy/standards-coverage-matrix.json`; this file only maps the
R4 design locations and gives explicit N/A reasons.

## Part B

| Chapter | Rule denominator | R4 design hit | Applicability |
|---|---|---|---|
| B.1 授权与会话安全 | B.1.N01–N17 | R4-U03, R4-U07; §2/U03 forged edge, face closed set, app separation | Applicable as regression/security gate; no new account or session product |
| B.2 数据与事务 | B.2.N01–N15 | R4-U02, R4-U04; §3 owner/transaction and clean DB negatives | Applicable to existing production shape; no new business mutation |
| B.3 后端结构 | B.3.N01–N12 | R4-U02, R4-U07; ArchUnit, API boundary, coordinator/listener rules | Applicable |
| B.4 前端架构与状态 | B.4.N01–N20 | R4-U03, R4-U05; app/foundation direction and generated closure | Applicable as current R3 regression; future UI design must first compare all-v2 counterparts and consume foundation before app-local duplication |
| B.5 交互与信息架构 | B.5.N01–N15 | R4-U05; trace current accepted C-01 evidence and terminology | No new UI-bearing Journey; future UI must record all-v2 `CARRY / ADAPT / NOT_CARRIED` disposition before a new wireframe is created |
| B.6 性能 | B.6.N01–N06 | R4-U04, R4-U07; DB count/query and minute-scale verify | Applicable |

## Part C normative pattern groups

| Group | R4 design hit | Applicability |
|---|---|---|
| owner command, idempotency and transaction | R4-U02/U04; §3 | Applicable for validator and real negative tests; no new command |
| OpenAPI route-face and generated closure | R4-U03/U05; §2/U05 | Applicable |
| frontend foundation, locator and architecture tests | R4-U03/U05 | Applicable to boundary regression; foundation remains wire-agnostic and unconsumed until a later UI feature |
| run-managed, red fixtures and verify entry | R4-U06/U07/U08; §4 | Applicable |
| projection/outbox/repair and multi-step credential flow | no R4 design hit | NOT_APPLICABLE: R4 adds no asynchronous business boundary, credential flow or projection |
| media two-step staging/claim | no R4 design hit | NOT_APPLICABLE: no media Journey or asset mutation is in R4 |

## Part D chapter-level map

| Chapter | R4 design hit | Applicability |
|---|---|---|
| D.1 目录与布局 | R4-U02/U03; manifest `partD.D.1-layout` | Applicable; TDP placeholder remains empty |
| D.2 契约治理 | R4-U05; manifest `partD.D.2-contract-governance` | Applicable |
| D.3 门纪律 | R4-U01/U07; §0.1, §4 | Applicable |
| D.4 文档治理 | R4-U01/U08; manifest `partD.D.4-document-governance` | Applicable to source/hash/evidence ownership |
| D.5 流程右尺寸化 | R4-U01/U07/U08; §0.1, §4 | Applicable; no ceremony or CI platform is added |
| D.6 技术栈与依赖白名单 | R4-U02/U04/U05 | Applicable as dependency and version gate; exact new versions require a separate spike decision |
| D.7 AI-first 底座 | R4-U01/U07 | Applicable to deterministic entry and provider-free checks |
| D.8 日志与诊断 | R4-U06/U07 | Applicable |

## Review boundary

The map proves coverage of the design review packet, not implementation. It
does not turn a Part B/C/D hit into a business requirement, a new Journey, or
an R4 implementation authorization.
