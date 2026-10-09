package com.catering.v2s.terminalupdate.api;

/** Typed owner outcome for a rule audit target outside the caller's readable project facts. */
public final class TerminalUpdateRuleAuditReadException extends RuntimeException {
    public enum Kind { NOT_FOUND, NOT_AUTHORIZED }

    private final Kind kind;

    public TerminalUpdateRuleAuditReadException(Kind kind) {
        super("terminal-update rule audit target is not readable");
        this.kind = kind;
    }

    public Kind kind() { return kind; }
}
