package com.catering.v2s.app.configuration;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.app.edge.generated.wire.OrganizationOverviewCategory;
import com.catering.v2s.app.edge.generated.wire.OrganizationOverviewItem;
import com.catering.v2s.app.edge.generated.wire.OrganizationOverviewItemExtensionFieldsItem;
import com.catering.v2s.app.edge.generated.wire.OrganizationOverviewSource;
import com.catering.v2s.app.edge.generated.wire.OrganizationOverviewStatus;
import com.catering.v2s.app.edge.generated.wire.OrganizationOverviewType;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter;

class OrganizationOverviewWireSerializationConfigurationTest {
    @Test
    void hierarchyWireKeepsLegacyExtensionFieldsWhileFlatWireCarriesRawValues() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        OrganizationOverviewWireSerializationConfiguration.configure(mapper);

        OrganizationOverviewItem hierarchy = item(
                OrganizationOverviewCategory.HIERARCHY,
                OrganizationOverviewType.REGION,
                List.of(new OrganizationOverviewItemExtensionFieldsItem("区域等级", "A")),
                null,
                null);
        String hierarchyWire = mapper.writeValueAsString(hierarchy);

        assertTrue(hierarchyWire.contains("extensionFields"));
        assertFalse(hierarchyWire.contains("extensionValues"));
        assertFalse(hierarchyWire.contains("extensionRuleRevision"));

        tools.jackson.databind.node.ObjectNode raw = new tools.jackson.databind.ObjectMapper().createObjectNode();
        raw.put("brandLevel", "A");
        OrganizationOverviewItem flat =
                item(OrganizationOverviewCategory.BUSINESS_ENTITY, OrganizationOverviewType.BRAND, null, raw, 4L);
        String flatWire = mapper.writeValueAsString(flat);

        assertTrue(flatWire.contains("extensionValues"));
        assertTrue(flatWire.contains("brandLevel"));
        assertTrue(flatWire.contains("extensionRuleRevision"));
        assertFalse(flatWire.contains("extensionFields"));
    }

    @Test
    void jackson3HttpMapperAppliesProjectionRulesToOverviewRoots() throws Exception {
        JacksonJsonHttpMessageConverter converter = new JacksonJsonHttpMessageConverter();
        OrganizationOverviewWireSerializationConfiguration.configure(converter);

        var mapper = converter.getMappersForType(OrganizationOverviewItem.class).get(MediaType.APPLICATION_JSON);
        assertTrue(mapper.writeValueAsString(item(
                        OrganizationOverviewCategory.HIERARCHY,
                        OrganizationOverviewType.REGION,
                        List.of(new OrganizationOverviewItemExtensionFieldsItem("区域等级", "A")),
                        null,
                        null))
                .contains("extensionFields"));
        String flatWire = mapper.writeValueAsString(item(
                OrganizationOverviewCategory.BUSINESS_ENTITY,
                OrganizationOverviewType.BRAND,
                null,
                new tools.jackson.databind.ObjectMapper().createObjectNode().put("brandLevel", "A"),
                4L));
        assertTrue(flatWire.contains("extensionValues"));
        assertFalse(flatWire.contains("extensionFields"));
    }

    @Test
    void lifecycleWirePreservesVoidedStatus() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        OrganizationOverviewWireSerializationConfiguration.configure(mapper);

        String wire = mapper.writeValueAsString(item(
                OrganizationOverviewStatus.VOIDED,
                OrganizationOverviewCategory.HIERARCHY,
                OrganizationOverviewType.REGION,
                List.of(),
                null,
                null));

        assertTrue(wire.contains("\"status\":\"VOIDED\""));
    }

    private static OrganizationOverviewItem item(
            OrganizationOverviewCategory category,
            OrganizationOverviewType type,
            List<OrganizationOverviewItemExtensionFieldsItem> extensionFields,
            tools.jackson.databind.JsonNode extensionValues,
            Long extensionRuleRevision) {
        return item(
                OrganizationOverviewStatus.ENABLED,
                category,
                type,
                extensionFields,
                extensionValues,
                extensionRuleRevision);
    }

    private static OrganizationOverviewItem item(
            OrganizationOverviewStatus status,
            OrganizationOverviewCategory category,
            OrganizationOverviewType type,
            List<OrganizationOverviewItemExtensionFieldsItem> extensionFields,
            tools.jackson.databind.JsonNode extensionValues,
            Long extensionRuleRevision) {
        return new OrganizationOverviewItem(
                "id",
                "workspace",
                category,
                type,
                "CODE",
                "Name",
                List.of(),
                status,
                OrganizationOverviewSource.MANUAL,
                1L,
                2L,
                3L,
                null,
                null,
                null,
                null,
                null,
                List.of(),
                null,
                null,
                null,
                extensionFields,
                extensionValues,
                extensionRuleRevision);
    }
}
