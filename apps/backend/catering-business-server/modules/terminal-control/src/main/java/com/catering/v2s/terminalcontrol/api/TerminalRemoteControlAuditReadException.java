package com.catering.v2s.terminalcontrol.api;

public final class TerminalRemoteControlAuditReadException extends RuntimeException {
    private static final long serialVersionUID = 1L;
    private final Kind kind;

    public TerminalRemoteControlAuditReadException(Kind kind) {
        super(kind.name());
        this.kind = kind;
    }

    public Kind kind() { return kind; }

    public enum Kind { NOT_FOUND, NOT_AUTHORIZED }
}
