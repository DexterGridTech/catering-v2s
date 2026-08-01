---
name: cs-brainstorming
description: Generate bounded alternatives and counterexamples before a catering-v2s Journey decision.
---

# cs-brainstorming

Authority boundary: `AGENTS.md`, approved Dexter decisions, project-memory, corpus and the
Journey template are authoritative. This adapter overrides its frozen vendor source on conflict.
It neither writes implementation nor advances a Journey automatically. Git is always Dexter's.

Use only **before** drafting a Journey decision, after the required context/memory routes have
been reopened. Produce alternatives, counterexamples, actor/data-prerequisite risks and the
smallest recommended scope. Do not ask questions mechanically: unresolved product semantics go
to Dexter as explicit decisions.

The sole endpoint is a Journey decision-template draft for Dexter:

```text
SKILL_USED=cs-brainstorming@4a54a4858b99807f3155ed1614b2f116e35ea5c1b788e793f565dd837fd3891f
```

Complete the template's task, success result, three-way prerequisite chain, non-goals, forbidden
inferences and corpus mapping. A draft remains `PROPOSED_FOR_DEXTER`; it does not authorize UI,
implementation-facing design, contract, DB, DEV, runtime, seed/reset or Git.

Frozen vendor reference:
`.agents/skills/vendor/superpowers-6.2.0/brainstorming/VENDOR-SKILL.md`
at SHA-256 `4a54a4858b99807f3155ed1614b2f116e35ea5c1b788e793f565dd837fd3891f`.
