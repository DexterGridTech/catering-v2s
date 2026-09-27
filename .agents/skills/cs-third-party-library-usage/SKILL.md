---
name: cs-third-party-library-usage
description: Verify third-party library APIs and behavior against the exact resolved version before implementation or testing.
---

# cs-third-party-library-usage

Use this skill whenever design or implementation correctness depends on a third-party API,
default, limit, ordering, protocol behavior, threading rule, resource ownership or lifecycle.

1. Read `doc/platform/third-party-library-usage-standard.md` and the task's approved requirement,
   design and implementation step. Identify the actual behavior relied on, its owner and failure
   boundary.
2. Reopen the build definition and resolve the dependency on the relevant runtime or test
   classpath. Record group/artifact/version, BOM or override source, and whether the API is direct
   or transitive. A BOM-managed version is not an artifact selected into the graph unless an
   actual dependency path selects it. Regenerate dependency reports after relevant build bytes
   change; do not reuse stale generated reports. Do not use the declared version or latest release
   as a substitute.
3. Find official documentation, API reference, maintainer release notes, source, Javadoc or protocol
   specification for the resolved version. Check the page title/version and final redirect: `current`,
   `release`, minor-only and other aliases may show a newer patch than the resolved dependency. If the
   page is not demonstrably version-matched, use the exact official release tag or versioned source/
   Javadoc archive and record the artifact coordinate, version, path and API inspected. Check the exact
   overload, defaults, units, limits, exceptions, concurrency and lifecycle semantics the code relies
   on. Do not infer behavior from names, another library, another version or memory.
4. Compare every in-scope call site with that evidence. Enumerate the finite set of usages in
   production code, tests, runtime clients and behavior-bearing build/plugin configuration; search
   same-root siblings so the finding is not repaired at only one call site. State confirmed facts
   separately from inference and unresolved facts.
5. If behavior differs, make the smallest owner-correct change before running the dependent test or
   service. Update the design/plan and audit record if the chosen API, version or proof changed.
   If official evidence is insufficient, keep the affected point `OPEN`; use a minimal reproducible
   experiment on the current resolved version only when authorized.
6. After the audit and repair, run the planned focused proof at its approved execution boundary.
   Official documentation establishes library semantics, not the repository's wiring or business
   outcome; do not report those as verified without their own evidence.

The audit record should link the exact official sources, list the resolved versions and call-site
denominator, describe each confirmed correction, and distinguish static/source evidence, dependency
resolution, focused test, and managed-runtime evidence. Do not add tests for ordinary type references
that rely on no behavior specific to the library.
