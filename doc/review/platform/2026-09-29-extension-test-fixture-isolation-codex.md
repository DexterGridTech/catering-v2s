SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

# Extension Test Fixture Isolation

## Finding and finite scope

The first module run, `r5-tc-1790631503369-22989`, executed 21 tests and failed 3; cleanup passed. Its JUnit evidence is under `.runtime/r5/evidence/remote-testcontainers/r5-tc-1790631503369-22989/test-results/`. Two initial-state/revision assertions shared one mutable workspace created in `@BeforeAll`; PostgreSQL persisted changes between test methods. The third assertion expected eight management host types although the current catalog includes `SERVICE_POINT` as the ninth. No production behavior was defective.

The sibling scan of the extension module found only `ExtensionDefinitionServiceTest` using this mutable database scope; `ExtensionFilterQueryTest` is a pure unit-test class. The repair is limited to that class.

## Repair

`ExtensionDefinitionServiceTest` now creates a unique workspace UUID and group workspace key in `@BeforeEach`; each mutating or initial-state test therefore owns its database scope. The platform management count assertion now expects nine, matching the explicit host-type list.

The shared rule is recorded as `TESTCONTAINERS_MUTABLE_FIXTURES_MUST_BE_METHOD_SCOPED` in `project-memory/operations/test-closed-loop.md`, with its assertion source and test source registered in `project-memory/required-inventory.json` and generated into the memory index. Its scope is mutable database fixtures sharing an owner key across test methods; pure unit tests, immutable reads, and independently keyed rows are counterexamples.

## Verification

- `scripts/memory/build-index`: PASS, 85 entries.
- `scripts/check/project-memory`: PASS, including assertion-omission, TDS assertion, source-substitution, and alias red controls.
- Focused managed remote Testcontainers run `r5-tc-1790632145706-45917`: `ExtensionDefinitionServiceTest` 16 tests, 0 failures, 0 errors, 0 skipped; remote process, workspace, container, and volume cleanup all PASS.
- In the initial module run, the sibling `ExtensionFilterQueryTest` had 5 tests, 0 failures. The production source was unchanged between runs.
- `@BeforeEach` semantics were checked against the resolved JUnit Jupiter 5.11.4 official API: https://docs.junit.org/5.11.4/api/org.junit.jupiter.api/org/junit/jupiter/api/BeforeEach.html
