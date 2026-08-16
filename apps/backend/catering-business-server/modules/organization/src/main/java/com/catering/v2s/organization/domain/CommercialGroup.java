package com.catering.v2s.organization.domain;

import java.util.Objects;

public record CommercialGroup(
        long id,
        String groupWorkspaceKey,
        long groupWorkspaceId,
        String code,
        String name,
        long revision,
        String createdByPlatformSubject) {
    public CommercialGroup {
        Objects.requireNonNull(groupWorkspaceKey, "groupWorkspaceKey");
        Objects.requireNonNull(code, "code");
        Objects.requireNonNull(name, "name");
        Objects.requireNonNull(createdByPlatformSubject, "createdByPlatformSubject");
    }
}
