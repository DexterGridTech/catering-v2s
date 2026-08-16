package com.catering.v2s.organization.api;

import java.util.Map;
import java.util.UUID;

public record OrganizationEntityReadback(
        UUID id,
        String entityType,
        UUID workspaceUuid,
        String groupWorkspaceKey,
        String code,
        String name,
        String legalName,
        String creditCode,
        String status,
        long version,
        String alias,
        String remark,
        String notes,
        long extensionRuleRevision,
        long createdAt,
        long updatedAt,
        Map<String, String> extensionValues) {}
