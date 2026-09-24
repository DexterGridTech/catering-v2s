---
name: cs-review
description: Run any catering-v2s review — implementation closeout, independent blind review, design review, or experience-problem retrospective — against the repository review standard.
---

# cs-review

Use this for **every** review action: implementation closeout, independent adversarial/blind review,
design review, remediation recheck, and experience-problem retrospectives. If a request mentions
reviewing, rechecking, verifying a delivery, or judging `GO`/`NO-GO`, start here.

## Authority and single source of truth

The review standard is `doc/platform/review-standard.md`. It defines **actions only**.

**Judgment criteria never live in the review standard and never live in this skill.** Read them from
their single home, in this order — the more specific one wins, and any conflict between them is
itself a finding:

1. this batch's IA, interaction artifact and implementation-facing design;
2. `doc/decisions/templates/` — the four templates define what a design document must itself
   contain; for a design review these carry most of the criteria;
3. `doc/platform/frontend-coding-standard.md` and `doc/platform/backend-coding-standard.md`;
4. `doc/platform/foundation-charter.md`;
5. `project-memory/` (routed pitfalls, practices, decisions, business corpus).

Severity grading (`M` / `S` / `N`) follows
`project-memory/operations/verification-governance.md`.

`AGENTS.md`, the current Roadmap authorization and Dexter's session instructions outrank all of the
above. Git is always Dexter's; a review never creates a branch, commits, or advances implementation.

## Required actions

Perform all five actions in `doc/platform/review-standard.md` §1 and reproduce its §5 verdict block
verbatim. A UI-bearing review that omits the `L2_USER_VISIBLE` line is invalid and must be redone.

1. **Declare `REVIEW_TARGET` first, then extract** — it selects which action 1 you run.
   With code present (`IMPLEMENTATION`, `EXPERIENCE_RETROSPECTIVE`) run **1-A** and extract rendered
   facts from source: reading source tells you what exists, not what renders, so extract first and
   judge second. With only design documents (`DESIGN`) run **1-B** and extract the template sections
   that are missing, the facts that contradict each other across documents, and every concrete bound,
   threshold or enum value that no document decided.
   **An empty extraction is never a pass** — it means the wrong variant was chosen or the inputs are
   incomplete. Stop and say so.
2. **Reconcile against this batch's design documents** — table columns and first-column entry,
   header action placement, tab ownership, form fields and validation messages, long Chinese strings
   against `USER_VISIBLE_COPY`, and frontend-authored enum copy. A mismatch is a finding; a fact the
   IA never declared is a design gap, not a pass.
3. **Same-root scan** — enumerate the complete in-batch set for every finding and judge each member.
   State "the remaining N were checked". Fixing only the named instance is the failure this action exists to prevent.
4. **Unverified inventory** — split user-visible facts into statically proven, test proven, and
   verified by nobody. Name the third group in the words a product owner can act on.
5. **Verdict shape** — `L3_UNVERIFIED` non-empty forces `GO_WITH_UNVERIFIED_UI`, never a bare `GO`.

## Evidence discipline

Run the gates and read the sources yourself; never inherit a self-reported number, an earlier
verdict, or a review document's claim of coverage. Declare the evidence tier honestly and never
promote a lower tier — a static check, a module test, and a real HTTP acceptance run are different
claims. When the original failing behaviour can no longer be reproduced from current sources, record
`UNVERIFIED_REQUIRES_EVIDENCE` rather than guessing what the old implementation did.

For a TER (`apps/terminal`) implementation or retrospective review, check `TR-16` in
`doc/platform/terminal-coding-standard.md`: a non-adapter feature verified only on a VM or device, only on
Web, or on the two ends with different scenario lists is a finding, and a parity claim needs the
side-by-side scenario evidence and the Web-before-device ordering on the same bytes that `TR-16` requires.

Findings are hypotheses until the owning source is reopened. Classify each as `CONFIRMED`,
`PARTIALLY_CONFIRMED`, `REJECTED_WITH_EVIDENCE`, `UNVERIFIED_REQUIRES_EVIDENCE`, or
`DEXTER_DECISION`, and withdraw your own finding when the source refutes it.

## Boundaries

Deliver review files under `doc/review/platform/`. External Claude files use `-claude`; Codex-authored
files, including Codex-dispatched independent-subagent reviews and author intake/reconciliation, use
`-codex`. Independence is declared inside the file through `reviewerKind` and the review-governance
metadata, not through the suffix; historical files are not renamed. Treat every other path as read-only
unless Dexter authorises otherwise in session. Do not run reset, seed, DEV restart, L2, UAT, deployment,
or any Git action. A review verdict authorises nothing beyond the review itself. The naming owner is
`doc/platform/review-standard.md` §5.

When a needed criterion has no home in any standard, record it as a design gap for the design side to
add to the owning standard. **Never invent the rule inside the review** — a rule with no canonical
home cannot be read next round, yet gets cited as precedent. That is how standards scatter.
