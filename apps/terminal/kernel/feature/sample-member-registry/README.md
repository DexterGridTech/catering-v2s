# Sample member registry

This owner module contains the sample member-registration state and command
protocol. It owns pending registrations and committed members, and it knows
nothing about UI parts, containers, display modes, or presentation.

The confirm path is deliberately customer-mediated: it commits a pending
registration only after the public confirm command. Reject emits its
result-specific public command but retains the pending entry so the UI can
offer retry with the original member data. Withdraw/abandon clears the pending
entry and emits its own result-specific public command. If a competing command
arrives after pending has already been cleared, the owner treats it as an
idempotent no-op and emits no result event.
