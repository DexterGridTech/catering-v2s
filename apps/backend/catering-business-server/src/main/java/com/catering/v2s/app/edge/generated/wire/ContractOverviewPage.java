// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record ContractOverviewPage(
    ContractOverviewPageMetadata metadata,
    java.util.List<ContractOverviewItem> items,
    String itemsSourceStatus,
    Long itemsAsOf,
    java.util.List<String> itemsUnresolved,
    java.util.List<ContractOverviewPageFilterOptionsItem> filterOptions,
    java.util.List<String> phaseOptions,
    String filterOptionsSourceStatus,
    Long filterOptionsAsOf,
    java.util.List<String> filterOptionsUnresolved
) {}
