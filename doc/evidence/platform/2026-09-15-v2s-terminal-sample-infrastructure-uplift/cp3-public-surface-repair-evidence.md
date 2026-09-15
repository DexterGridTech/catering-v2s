# CP3 sample-console public-surface repair evidence

`REVIEW_TARGET=IMPLEMENTATION_SUPPORT_STAGE_RECONCILIATION`
`SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787`

## First finding

Fresh CP3 reviewer Descartes found that the current `sample-console` index
exported seven typed surface contracts and `createSampleDefinedParts`, while
`terminal-invariants.json` and the README public-surface section omitted them;
the package also lacked the invariant test already used by sample2.

## Repair

The invariant now enumerates the exact runtime and type exports returned by the
TypeScript checker. The README names the typed surface contract and clarifies
that `createSampleDefinedParts` is only a test/assembly-definition factory,
not a second production assembly entry. A real `publicSurface.test.ts` now
compares the TypeScript module export set with the invariant, including type
exports.

Owning files:

```text
apps/terminal/ui/integration/sample-console/src/index.ts
apps/terminal/ui/integration/sample-console/terminal-invariants.json
apps/terminal/ui/integration/sample-console/README.md
apps/terminal/ui/integration/sample-console/test/publicSurface.test.ts
```

## Focused re-verification

```text
yarn test       # apps/terminal/ui/integration/sample-console
Test Files  8 passed (8)
Tests       37 passed (37)
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-integration-sample-console

yarn typecheck  # apps/terminal/ui/integration/sample-console
exit 0
```

The CP3 stage still requires a new fresh independent read after this repair.
No dynamic, release, Web, Android, device, or cleanup evidence is claimed by
this record.
