package com.catering.v2s.app.edge.operations.organization;

import com.catering.v2s.app.edge.generated.wire.Brand;
import com.catering.v2s.app.edge.generated.wire.BusinessEntityStatus;
import com.catering.v2s.app.edge.generated.wire.HeadCompany;
import com.catering.v2s.app.edge.generated.wire.HeadCompanyAuthorizedBrandsItem;
import com.catering.v2s.app.edge.generated.wire.Tenant;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

/** Maps organization-owner readbacks and generated request values without leaking edge DTOs into the owner. */
final class BusinessEntityWireMapper {
    private static final ObjectMapper JSON = new ObjectMapper();

    private BusinessEntityWireMapper() {}

    static Brand brand(OrganizationEntityReadback value) {
        return new Brand(
                value.id().toString(),
                value.groupWorkspaceKey(),
                value.code(),
                value.name(),
                value.alias(),
                value.remark(),
                extensionValues(value),
                value.extensionRuleRevision(),
                status(value),
                value.version(),
                value.createdAt(),
                value.updatedAt());
    }

    static Tenant tenant(OrganizationEntityReadback value) {
        return new Tenant(
                value.id().toString(),
                value.groupWorkspaceKey(),
                value.code(),
                value.name(),
                value.legalName(),
                value.creditCode(),
                value.remark(),
                extensionValues(value),
                value.extensionRuleRevision(),
                status(value),
                value.version(),
                value.createdAt(),
                value.updatedAt());
    }

    static HeadCompany headCompany(
            OrganizationEntityReadback value, List<OrganizationEntityReadback> authorizedBrands) {
        List<HeadCompanyAuthorizedBrandsItem> brands = authorizedBrands.stream()
                .map(brand -> new HeadCompanyAuthorizedBrandsItem(
                        brand.id().toString(), brand.code(), brand.name(), status(brand)))
                .toList();
        return new HeadCompany(
                value.id().toString(),
                value.groupWorkspaceKey(),
                value.code(),
                value.name(),
                value.legalName(),
                value.creditCode(),
                value.remark(),
                brands,
                extensionValues(value),
                value.extensionRuleRevision(),
                status(value),
                value.version(),
                value.createdAt(),
                value.updatedAt());
    }

    static HeadCompany headCompanySummary(OrganizationEntityReadback value) {
        return new HeadCompany(
                value.id().toString(),
                value.groupWorkspaceKey(),
                value.code(),
                value.name(),
                value.legalName(),
                value.creditCode(),
                value.remark(),
                List.of(),
                extensionValues(value),
                value.extensionRuleRevision(),
                status(value),
                value.version(),
                value.createdAt(),
                value.updatedAt());
    }

    static Map<String, String> requestValues(JsonNode values) {
        if (values == null || values.isNull()) return Map.of();
        if (!values.isObject()) throw new IllegalArgumentException("extension values must be a JSON object");
        Map<String, String> result = new LinkedHashMap<>();
        values.properties().forEach(entry -> {
            try {
                result.put(entry.getKey(), JSON.writeValueAsString(entry.getValue()));
            } catch (Exception exception) {
                throw new IllegalArgumentException("extension value is not JSON serializable", exception);
            }
        });
        return Map.copyOf(result);
    }

    private static BusinessEntityStatus status(OrganizationEntityReadback value) {
        return BusinessEntityStatus.valueOf(value.status());
    }

    static JsonNode extensionValues(OrganizationEntityReadback value) {
        ObjectNode result = JSON.createObjectNode();
        value.extensionValues().forEach((key, encodedValue) -> {
            try {
                JsonNode node = JSON.readTree(encodedValue);
                result.set(key, node);
            } catch (Exception exception) {
                throw new IllegalStateException("owner extension value is not JSON", exception);
            }
        });
        return result;
    }
}
