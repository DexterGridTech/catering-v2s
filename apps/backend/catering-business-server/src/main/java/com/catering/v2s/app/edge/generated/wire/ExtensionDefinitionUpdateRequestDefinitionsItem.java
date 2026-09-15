// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record ExtensionDefinitionUpdateRequestDefinitionsItem(
    String key,
    String label,
    ExtensionFieldType type,
    Boolean listDisplay,
    Boolean searchable,
    Boolean required,
    java.util.List<String> options,
    String status,
    Long displayOrder,
    String displaySuffix
) {}
