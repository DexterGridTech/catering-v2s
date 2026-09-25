# Independent subagent adversarial review input checklist

Use one copy per review round. The reviewer prompt must reproduce this checklist explicitly and say:
“first try to falsify the reviewed design/implementation; form findings and verdict before reading
author self-review or dispositions.”

| Required input | Path, command, or session input | Read / result |
| --- | --- | --- |
| Codex entry | `AGENTS.md` | `READ` |
| Claude entry | `CLAUDE.md` | `READ` |
| Current assignment and authorization | Dexter's explicit assignment included in the reviewer prompt | `READ` |
| All kernels | `project-memory/kernel/*.md` | `READ_ALL` |
| Six-dimension route | `scripts/context/recall-memory <six flags>` | `RUN` |
| Every routed hit and applicable source ref | `<repository-relative paths and headings>` | `READ_ALL` |
| Per-change prewrite reread, when applicable | `<original requirement + routed memory/owning source + applicable design/constraints + reusable source>` | `READ_FOR_EACH_CHANGE` |
| Per-change post-proof reread, when applicable | `<same pointwise input, resulting source and focused proof>` | `REVIEWED_FOR_EACH_CHANGE` |
| Corpus search | `<search terms>` | `<matched entry or NO_CORPUS_ENTRY_MATCHED>` |
| Reviewed object | `<path>` | `READ_FULL` |
| Applicable source inputs | `<original requirement, accepted design, interaction inputs>` | `READ_ALL` |
| Relevant decisions | `doc/decisions/` title list plus applicable decisions | `TITLES_REVIEWED` |
| Applicable standards | `<design template, domain standard, review standard, verification governance>` | `READ` |

## Blind-review declaration

`I received this checklist in a fresh subagent context, tried to falsify the reviewed object, and
wrote my findings and verdict before reading the author self-review or author finding disposition.`
`I also treated every missing or substituted per-change prewrite/post-proof reread as a finding; a
general preparation pass, static result, or later L2 did not substitute for pointwise source review.`
