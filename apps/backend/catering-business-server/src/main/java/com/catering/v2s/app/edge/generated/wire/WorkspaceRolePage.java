// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceRolePage(
    java.util.List<WorkspaceRole> items,
    Long page,
    Long pageSize,
    Long total,
    WorkspaceRoleSortKey sort,
    SortDirection direction,
    java.util.List<WorkspaceRolePageCapabilityCatalogItem> capabilityCatalog,
    java.util.List<WorkspaceRolePagePageAccessCatalogItem> pageAccessCatalog
) {}
