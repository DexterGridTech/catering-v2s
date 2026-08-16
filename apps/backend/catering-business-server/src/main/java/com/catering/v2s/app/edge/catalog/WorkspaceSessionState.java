package com.catering.v2s.app.edge.catalog;

/** Closed UI session-state projection; owner authorization remains authoritative. */
public enum WorkspaceSessionState {
    AUTHENTICATED,
    NONE;

    public String wire() {
        return name();
    }
}
