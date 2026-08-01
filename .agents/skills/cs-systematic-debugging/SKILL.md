---
name: cs-systematic-debugging
description: Investigate an authorized catering-v2s implementation failure before proposing a fix.
---

# cs-systematic-debugging

Authority boundary: `AGENTS.md`, current implementation authorization, local scripts and
project-memory win over the frozen vendor source. This adapter applies only during explicitly
authorized implementation or verification; it never makes a design, runtime, reset/seed, Git or
deployment action authorized.

Before any fix, preserve and reopen the first failure signal, reproduce it where authorized,
trace the relevant owner boundary and compare a working local reference. State a single
hypothesis, use the smallest evidence-producing test/change, and verify the result. Dynamic
work must use the repository's managed scripts; report business result separately from cleanup.
After two equivalent failed attempts, perform boundary/root-cause analysis before another trial.

Before changing code for a user-reported symptom, describe the generic failure mode, enumerate the
finite denominator, search every same-root sibling, and record counterexamples. Reconcile every
confirmed finding to one durable prevention destination. Do not optimize for the named line while
the same root cause remains elsewhere.

After confirming a failure and its fix, generalize it before closure: record the reusable failure
pattern, root-cause layer, finite applicability denominator, counterexample boundary, and smallest
reusable remedy. Route it to project-memory, an existing mechanically admitted control with a real
production red mutation, an explicit review checklist, or a justified
`NOT_APPLICABLE_WITH_REASON`. A repaired symptom without a prevention disposition remains open.

Any debugging record starts with:

```text
SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787
```

Frozen vendor reference:
`.agents/skills/vendor/superpowers-6.2.0/systematic-debugging/VENDOR-SKILL.md`
at SHA-256 `808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787`.
