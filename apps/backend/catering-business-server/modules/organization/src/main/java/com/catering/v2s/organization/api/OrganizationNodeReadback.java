package com.catering.v2s.organization.api;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record OrganizationNodeReadback(
    UUID id,
    UUID workspaceUuid,
    String groupWorkspaceKey,
    UUID parentId,
    String nodeType,
    String code,
    String name,
    String notes,
    String status,
    long version,
    long createdAtEpochMillis,
    long updatedAtEpochMillis,
    List<String> phaseNames,
    Map<String, String> extensionValues,
    long extensionRuleRevision
) {
    public OrganizationNodeReadback(UUID id, UUID workspaceUuid, String groupWorkspaceKey, UUID parentId, String nodeType, String code, String name, String notes, String status, long version, long createdAtEpochMillis, long updatedAtEpochMillis, List<String> phaseNames) {
        this(id, workspaceUuid, groupWorkspaceKey, parentId, nodeType, code, name, notes, status, version, createdAtEpochMillis, updatedAtEpochMillis, phaseNames, Map.of(), 0L);
    }
}
