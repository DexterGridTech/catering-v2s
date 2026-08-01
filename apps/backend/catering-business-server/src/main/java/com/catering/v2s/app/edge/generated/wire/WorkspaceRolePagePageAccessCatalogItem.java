// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceRolePagePageAccessCatalogItem(
    String pageDesignKey,
    String title,
    String menuGroup,
    Long menuOrder,
    String requiredDataNodeType,
    java.util.List<ServiceNodeType> eligibleOrganizationTypes
) {}
