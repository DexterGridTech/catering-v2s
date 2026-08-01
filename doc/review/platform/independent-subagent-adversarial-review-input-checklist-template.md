# Independent subagent adversarial review input checklist

Use one immutable copy per review round. The reviewer prompt must reproduce this checklist
explicitly and say: “first try to falsify the reviewed design/implementation; form findings and
verdict before reading author self-review or dispositions.”

| Required input | Repository-relative path / command | SHA-256 or command output | Read / result |
| --- | --- | --- | --- |
| AGENTS | `AGENTS.md` | `<sha256>` | `READ` |
| Claude entry | `CLAUDE.md` | `<sha256>` | `READ` |
| Current Roadmap | `<registry-selected-roadmap>` + `CURRENT_*` | `<sha256>` | `READ` |
| Exact authorization | `<decision/path>` | `<sha256>` | `READ` |
| All kernel | `project-memory/kernel/*.md` | `<path@sha256 each>` | `READ_ALL` |
| Six-dimension route | `scripts/context/recall-memory <six flags>` | `<full command/output hash>` | `RUN` |
| Every routed hit | `<path@sha256 each>` | `<sha256>` | `READ_ALL` |
| Applicable source refs | `<path + literal heading>` | `<sha256>` | `READ_ALL` |
| Per-change prewrite reread | `<change point: IA/original requirement + every routed memory/owning source + applicable detail design/constraints + reusable source>` | `<path@sha256 each>` | `READ_FOR_EACH_CHANGE` |
| Per-change post-proof reread | `<same pointwise input, resulting source and focused proof>` | `<path@sha256 or proof output each>` | `REVIEWED_FOR_EACH_CHANGE` |
| Corpus search | `<search terms>` | `<matched G-xx or NO_CORPUS_ENTRY_MATCHED>` | `READ` |
| Reviewed object | `<path>` | `<sha256>` | `READ_FULL` |
| Upstream frozen inputs | `<Journey/interaction/manifest paths>` | `<path@sha256 each>` | `READ_ALL` |
| All decisions | `doc/decisions/` full-directory title list + relevant paths | `<listing hash + path@sha256>` | `TITLES_REVIEWED` |
| Standards matrix | `contracts/policy/standards-coverage-matrix.json` | `<sha256>` | `READ_CHECKLIST` |
| Verification governance | `doc/decisions/2026-07-24-v2s-verification-governance.md` | `<sha256>` | `READ` |

## Blind-review declaration

`I received this checklist in a fresh subagent context, tried to falsify the reviewed object, and
wrote my findings and verdict before reading the author self-review or author finding disposition.`
`I also treated every missing or substituted per-change prewrite/post-proof reread as a finding; a
general preparation pass, static result, or later L2 did not substitute for pointwise source review.`
