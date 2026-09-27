package com.catering.v2s.app.edge.terminal;

/** Secret-free HTTP rejection for a malformed or invalid terminal credential. */
public final class TerminalDeviceCredentialProblem extends RuntimeException {
    public TerminalDeviceCredentialProblem() {
        super("TERMINAL_BINDING_CREDENTIAL_INVALID");
    }
}
