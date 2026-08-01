# Dexter rule: original business-requirement traceability

Date: 2026-07-28

Dexter requires every later implementation-facing detailed-design unit to cite its original business requirement (path plus unique anchor) and state the business problem, user task, owner facts, non-goals and authorization boundary it protects. Before a first source write, the implementation agent must reopen that requirement, the approved detailed design and owning source, then confirm the business context rather than inferring a task from code shape or method names.

If those sources differ or are incomplete, the agent must stop the unit and request Dexter's decision. This record is P4 governance evidence only; P4's baseline predates global AGENTS/project-memory surfaces, so global promotion must be performed as the next dedicated governance package rather than fabricate an `ABSENT -> existing` receipt in RM1-U07.
