package com.catering.v2s.audit.contract;

import java.util.Objects;
import java.util.UUID;

/** Host authorization has completed before this value reaches an owner task reader. */
public record AuditReadScope(UUID workspaceUuid, String groupWorkspaceKey) {
    public AuditReadScope {
        groupWorkspaceKey = Objects.requireNonNullElse(groupWorkspaceKey, "").trim();
        if (workspaceUuid == null || groupWorkspaceKey.isEmpty() || groupWorkspaceKey.length() > 128) throw new IllegalArgumentException("audit read scope is invalid");
    }
}
