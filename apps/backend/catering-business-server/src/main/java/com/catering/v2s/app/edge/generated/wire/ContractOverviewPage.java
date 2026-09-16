// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record ContractOverviewPage(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "metadata", required = true) ContractOverviewPageMetadata metadata,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "items", required = true) java.util.List<ContractOverviewItem> items,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "itemsSourceStatus", required = true) String itemsSourceStatus,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "itemsAsOf", required = true) Long itemsAsOf,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "itemsUnresolved", required = true) java.util.List<String> itemsUnresolved,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "filterOptions", required = true) java.util.List<ContractOverviewPageFilterOptionsItem> filterOptions,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "filterOptionsSourceStatus", required = true) String filterOptionsSourceStatus,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "filterOptionsAsOf", required = true) Long filterOptionsAsOf,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "filterOptionsUnresolved", required = true) java.util.List<String> filterOptionsUnresolved
) {}
