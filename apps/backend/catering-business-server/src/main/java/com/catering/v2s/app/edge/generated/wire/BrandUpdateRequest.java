// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record BrandUpdateRequest(
    String code,
    String name,
    String alias,
    String remark,
    java.util.List<BrandUpdateRequestExtensionValuesItem> extensionValues,
    Long expectedVersion
) {}
