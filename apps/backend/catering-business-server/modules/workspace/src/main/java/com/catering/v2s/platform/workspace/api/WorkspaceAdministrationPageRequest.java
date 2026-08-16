package com.catering.v2s.platform.workspace.api;

/** Closed query vocabulary for the platform workspace management task. */
public record WorkspaceAdministrationPageRequest(
        String name,
        String groupWorkspaceKey,
        String operationsTitle,
        String status,
        long page,
        long pageSize,
        String sortKey,
        String sortDirection) {
    public WorkspaceAdministrationPageRequest {
        name = optional(name, 120);
        groupWorkspaceKey = optional(groupWorkspaceKey, 64);
        operationsTitle = optional(operationsTitle, 120);
        if (status != null && !"ENABLED".equals(status) && !"DISABLED".equals(status))
            throw new IllegalArgumentException("invalid workspace status");
        if (page < 1 || pageSize < 1 || pageSize > 100) throw new IllegalArgumentException("invalid pagination");
        if (!"NAME".equals(sortKey) && !"WORKSPACE_KEY".equals(sortKey) && !"UPDATED_AT".equals(sortKey))
            throw new IllegalArgumentException("invalid workspace sort key");
        if (!"ASC".equals(sortDirection) && !"DESC".equals(sortDirection))
            throw new IllegalArgumentException("invalid workspace sort direction");
        try {
            Math.multiplyExact(page - 1, pageSize);
        } catch (ArithmeticException failure) {
            throw new IllegalArgumentException("invalid pagination", failure);
        }
    }

    public long offset() {
        return Math.multiplyExact(page - 1, pageSize);
    }

    private static String optional(String value, int maxLength) {
        if (value == null || value.isBlank()) return null;
        String trimmed = value.trim();
        if (trimmed.length() > maxLength) throw new IllegalArgumentException("invalid workspace filter");
        return trimmed;
    }
}
