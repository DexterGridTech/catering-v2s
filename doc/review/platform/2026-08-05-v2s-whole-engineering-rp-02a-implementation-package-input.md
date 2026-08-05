# RP-02a-U01 implementation package input

`REVIEW_TARGET=IMPLEMENTATION`

This package is the static implementation of the accepted RP-02a design. Re-open the business
source, the implementation design, the accepted Claude design review, the active package, and all
six denominator classes in `...-implementation-delivery-manifest.json` before judging any byte.

Required checks:

1. registry, placement, materialized catalog and facts are exact sets with 154 rows and face counts
   50/92/12;
2. projection identity preserves R24 error/component metadata and P3C concrete query metadata;
3. four create bodies omit `projectId`, five unsupported operations omit it from query, the one
   current overview query and three contract-declared query operations remain explicit allowlists,
   and `PROJECT_SCOPE`/`SCOPED_STORE_FACTS` retain project identity;
4. RM1 counts derive from the loaded registry and recovery is exactly start/send/verify/complete;
5. N1/N2 are resolved without widening scope; no contract, runtime, business or cleanup claim is
   inferred from static PASS;
6. every changed file has a non-empty hook pre/post receipt and package-exit set equality.

The independent reviewer must inspect production source and focused tests before reading any author
intake, form a falsification-oriented verdict, and stop after the second review round. No runtime,
HTTP, browser L2, seed/reset or Git action is authorized by this input.
