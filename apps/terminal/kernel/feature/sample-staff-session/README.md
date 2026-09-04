# Sample staff session

This owner module contains the sample staff session state and command protocol.
It knows nothing about UI parts, containers, display modes, or presentation.

The module owns the session slice, validates the sample credentials, and emits
result-specific public commands for UI feature actors to consume. Its install
hook only dispatches the internal bootstrap command with a request id.
