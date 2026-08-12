// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record OrganizationStoreCreateRequest(
    String brandId,
    String tenantId,
    String headCompanyId,
    String code,
    String name,
    String notes,
    java.util.List<OrganizationStoreCreateRequestExtensionValuesItem> extensionValues
) {}
