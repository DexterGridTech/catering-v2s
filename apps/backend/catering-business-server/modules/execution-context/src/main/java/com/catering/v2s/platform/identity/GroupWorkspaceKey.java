package com.catering.v2s.platform.identity;

/** Canonical character-level rule for group-workspace URL and command keys. */
public final class GroupWorkspaceKey {
    private GroupWorkspaceKey() {}

    public static boolean isValid(String value) {
        return value != null && value.matches("[A-Za-z0-9][A-Za-z0-9_-]{0,63}");
    }
}
