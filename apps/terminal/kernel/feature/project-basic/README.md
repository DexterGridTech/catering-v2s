# `kernel.feature.project-basic`

`project-basic` owns the terminal's project, region, commercial-group path and project terminal-update rule snapshot. It starts only after `store-basic` has persisted the concrete store fact and broadcast `storeBasicInformationLoadedCommand`; it then reads the organization path, subscribes to its three owner topics, and loads project update rules. Store contracts, operating rules, areas and service points remain owned by `store-basic`.

The feature exposes read-only selectors for the persisted path, readiness, topic status, rule snapshot and the current application/store candidate. It chooses at most one eligible candidate from the ready rule snapshot. The feature actor passes that candidate through `requestTerminalUpdateCommand`; `kernel.base.terminal-update` rechecks current context and owns actual-version comparison, fixed-task persistence and execution. The base package does not read or store the project rule collection.

The owner-only slice persists the organization path and complete ready rule snapshot and projects those two records from MASTER to SLAVE. Runtime readiness and topic diagnostics remain local. Candidate selection requires a flushed store and organization path, a ready snapshot with matching context and collection hash, and an exact application/store match.

Focused coverage is in `test/projectBasic.test.ts`: the store-ready handoff, owner reads and subscriptions, candidate isolation by application, and the fixed candidate sent to the update command.
