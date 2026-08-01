// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record OrganizationOverviewPage(
    OrganizationOverviewPageMetadata metadata,
    java.util.List<OrganizationOverviewItem> items,
    String itemsSourceStatus,
    Long itemsAsOf,
    java.util.List<String> itemsUnresolved,
    java.util.List<OrganizationOverviewPageFilterOptionsItem> filterOptions,
    String filterOptionsSourceStatus,
    Long filterOptionsAsOf,
    java.util.List<String> filterOptionsUnresolved
) {}
