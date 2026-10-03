# Terminal activation UI

This package owns the reusable activation form, read-only activation guide, and local admin status section. It exposes one `needToActivateTerminalCommand`; each integration owns the route actor because only the composing app knows its registered screen catalog and current route context.

`ActivationCodeForm` reads the selected service space through the server-config selector and sends the eight-digit activation code through `activateTerminalCommand`. Cancellation uses the currently selected service space through the terminal-data-client command. A rejected cancellation keeps the client credential and is shown as a rejection; the UI does not fall back to the credential's former space.

MMP and LMP own activation input. LMS and LSP are read-only guidance surfaces. LMS is registered only for a laptop `MAIN` secondary display on either the local `MASTER` runtime or the paired `SLAVE` runtime; LSP is the laptop `BRANCH` primary surface on `SLAVE`. The paired LMS activation projection is connected by the topology owner in the later projection step, not by reading the local credential slice.

The admin status part reads the terminal-data-client selectors on the local runtime. Only a `MASTER` with an active local credential can issue cancellation. `CommandDispatchResult.status=completed` is not treated as business cancellation success; the actor result must report `CANCELLED` or `ALREADY_CANCELLED`.

Run the package checks from this directory with `yarn typecheck` and `yarn test`.
