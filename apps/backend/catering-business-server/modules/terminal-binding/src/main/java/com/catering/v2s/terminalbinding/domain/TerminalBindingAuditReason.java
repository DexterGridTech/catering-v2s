package com.catering.v2s.terminalbinding.domain;

/** Closed reason set persisted for terminal-binding audit events and ended binding snapshots. */
public enum TerminalBindingAuditReason {
    ACTIVATED,
    REACTIVATED,
    DEVICE_CANCELLED,
    OPERATIONS_CANCELLED,
    TERMINAL_VOIDED
}
