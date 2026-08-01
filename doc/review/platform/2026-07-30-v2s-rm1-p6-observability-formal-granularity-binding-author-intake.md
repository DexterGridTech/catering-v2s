# RM1 P6-1 formal granularity-gate binding — author finding intake after independent Round 1

## Scope and method

This intake is for `RM1-P6-U01-FORMAL-GRANULARITY-BINDING-DESIGN-20260730`, Round 1 only. The independent verdict is `NO_GO (M=3, S=0, N=0)` at `doc/review/platform/2026-07-30-v2s-rm1-p6-observability-formal-granularity-binding-review-round1.json`. Each item below was independently reopened against its owning source and a counterexample boundary before any design change. This author intake is not an independent verdict and grants no implementation authority.

## Dispositions

| Finding | Disposition | Independent source reopening and counterexample | Root repair |
| --- | --- | --- | --- |
| `RM1-P6-U01-DESIGN-R1-M-001` | `CONFIRMED` | `tools/implementation-design-granularity/cli.mjs` `validateUnitSourceCompliance` calls `validateD1OwningSourceSet` only for D1, while D2--D6 only require non-empty field shape and non-empty `owningSourceSet`. No `readBoundFile` or `requireUniqueAnchor` is reached for those five entries. A stale D2 SHA or nonexistent D5 source is therefore not rejected by that branch. | Keep one production checker and extend it to reopen every D2--D6 source, verify real SHA, enforce finite `md:` / `json:` selectors and compare normalized owning-source sets. Add red fixtures for each failure family. |
| `RM1-P6-U01-DESIGN-R1-M-002` | `CONFIRMED` | `contracts/policy/frontend-asset-carryover-manifest.json` has top-level `surfaces` and `pageDesignKeySurfaceCrosswalk`; it has no top-level `pageDesignKeys`. The counterexample is the previous prose selector, which could not identify a real JSON location. | Bind the actual pair `json:/surfaces,json:/pageDesignKeySurfaceCrosswalk`; require every JSON pointer to resolve to a non-empty source value. |
| `RM1-P6-U01-DESIGN-R1-M-003` | `CONFIRMED` | The plan contains `## 1. Business purpose, Dexter intent and scope` both as its heading and as an explanatory literal in §2.2. The current checker correctly returns `UNIT_SOURCE_RM1P6-FORMAL-GRANULARITY-U01_1_ANCHOR_NOT_UNIQUE:2`. | Bind approved assertions to the unique sentence selector `md:P6-1 exists so an unauthenticated person can safely authenticate or recover access`; retain the plan heading only as prose. |

## Generalized prevention set

The problem family is **declared-but-not-reopened formal evidence**: a gate can validate a stronger D1 route while silently treating other declared denominators as metadata. The finite applicable denominator is every non-D1 source binding in an implementation-facing design manifest; D1 retains its own dynamic route recomputation. The minimal prevention is not a new policy engine: existing checker source reopening, finite selector grammar, normalized owning-source equality and red fixtures for missing/stale/ambiguous bindings. A text scanner, a manifest-field self-test or a second relaxed checker is explicitly excluded.

## Resulting design delta and final-review boundary

The formal design now adds the existing checker as a later implementation surface, defines `md:` and `json:` selector semantics, corrects the no-UI source selector and replaces the repeated approved-source anchor. The formal manifest remains `implementationAuthority=false`; CP-U11 is still document-only. Round 2 may verify only these targeted corrections, the true D1 set, no-UI scope and no authority expansion. It is the final allowed independent design round for this cycle.

## Final Round 2 post-remediation disposition

`RM1-P6-U01-DESIGN-R2-M-001` is `CONFIRMED`. The raw plan contains both `## 3. Prohibited pseudo-fixes` and `## 4. Required future implementation proof` twice: once as normative section headings and once as copied literals in the D2--D6 explanatory list. That violates the exact-once `md:` grammar defined by the same design. The smallest repair is not to relax the grammar: bind D3 and D4 to the two new unique normative invariant sentences directly under their respective sections. The repaired manifest remains design-only and does not claim the future D2--D6 checker implementation already exists.

This is a `POST_REMEDIATION_V1` disposition after the cycle's final independent Codex round. The immutable reviewed bytes remain the Round 2 manifest and verdict; current repaired bytes are explicitly unreviewed by an adversarial subagent and require Claude recheck. No third Codex independent review is created.
