package com.catering.v2s.terminalbinding.api;

/** Typed target outcome mapped by audit-read to the existing operations-audit HTTP problem family. */
public final class TerminalBindingAuditReadException extends RuntimeException {
    public enum Kind {
        NOT_FOUND,
        NOT_AUTHORIZED
    }

    private final Kind kind;

    public TerminalBindingAuditReadException(Kind kind) {
        super("terminal-binding audit target is not readable");
        this.kind = kind;
    }

    public Kind kind() {
        return kind;
    }
}
