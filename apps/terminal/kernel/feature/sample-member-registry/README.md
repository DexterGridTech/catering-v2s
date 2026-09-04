# Sample member registry

This owner module contains the sample member-registration state and command
protocol. It owns pending registrations and committed members, and it knows
nothing about UI parts, containers, display modes, or presentation.

The confirm path is deliberately customer-mediated: it commits a pending
registration only after the public confirm command, while the reject path
clears the pending entry and emits a result-specific public command.
