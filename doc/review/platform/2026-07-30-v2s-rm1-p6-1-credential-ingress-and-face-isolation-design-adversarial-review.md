---
reviewTarget: DESIGN
reviewCycleId: RM1-P6-1-CREDENTIAL-INGRESS-AND-FACE-ISOLATION-DESIGN
reviewRound: 2
reviewRoundLimit: 2
reviewerKind: INDEPENDENT_SUBAGENT
roundFinalDecision: SELF_DECIDED
verdict: GO
---

# RM1 P6-1 credential ingress and face isolation independent design review

## Round 1 — NO-GO

The independent reviewer found three gaps: generated source-disposition bytes were invalid JSON; the design
claimed all backend production sources but used the 287 app-only denominator; and the face-isolation proof had
not specified two directional ArchUnit red fixtures.  No implementation was started.

## Author intake and revision

M1 was confirmed and the source-disposition was regenerated as valid 33-row JSON.  M2 was confirmed by a fresh
filesystem scan: 396 Java files across 11 `src/main/java` roots, so both problem-family and design use that exact
finite denominator.  S1 was confirmed: the revision names platform→operations-session and
operations→platform-session prohibitions, permits only non-secret `EdgeRequestContext`, and requires two import
fixtures that each make the Architecture rule red.  The smaller alternative of a shared resolver package was
rejected because it would not restore a compile-time face boundary.

## Round 2 — GO (hard stop)

The reviewer reopened the revised sources and verified valid source-disposition JSON (`33/33` rows), matching
manifest/amendment bindings, the 396/11 source denominator, and explicit bidirectional architecture red design.
`M=0 / S=0 / N=1`; N1 correctly records that the implementation must still add and execute the controls and
focused proof.  This is a design GO only; implementation evidence remains required.
