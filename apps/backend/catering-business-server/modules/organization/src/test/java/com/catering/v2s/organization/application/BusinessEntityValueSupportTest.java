package com.catering.v2s.organization.application;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.catering.v2s.audit.contract.AuditValueState;
import com.catering.v2s.extension.api.ExtensionDefinitionReadback;
import com.catering.v2s.extension.api.ExtensionSubmission;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class BusinessEntityValueSupportTest {
    private static final ExtensionDefinitionReadback DEFINITION = new ExtensionDefinitionReadback(
            "workspace",
            "STORE",
            1,
            1,
            List.of(
                    new ExtensionDefinitionReadback.Field(
                            "displayName", "显示名称", "TEXT", false, List.of(), "ENABLED", 1, null),
                    new ExtensionDefinitionReadback.Field(
                            "creditLimit", "信用额度", "NUMBER", false, List.of(), "ENABLED", 2, null),
                    new ExtensionDefinitionReadback.Field(
                            "enabled", "是否启用", "BOOLEAN", false, List.of(), "ENABLED", 3, null)),
            "ENABLED",
            List.of());

    @Test
    void emitsTypedLabelsAndExplicitClearState() {
        OrganizationEntityReadback before = entity(Map.of(
                "displayName", "\"旧名称\"",
                "creditLimit", "100.00",
                "enabled", "true"));
        OrganizationEntityReadback after = entity(Map.of(
                "displayName", "\"\"",
                "creditLimit", "101.50"));

        var changes = BusinessEntityValueSupport.extensionChanges(
                before,
                after,
                DEFINITION,
                new ExtensionSubmission(List.of(
                        ExtensionSubmission.ExtensionFieldValue.clear("enabled"),
                        new ExtensionSubmission.ExtensionFieldValue("displayName", "\"\"", ExtensionSubmission.Mode.SET),
                        new ExtensionSubmission.ExtensionFieldValue("creditLimit", "101.50", ExtensionSubmission.Mode.SET))));

        assertEquals(3, changes.size());
        assertEquals("显示名称", changes.get(0).fieldLabelSnapshot());
        assertEquals("旧名称", changes.get(0).beforeValue());
        assertEquals("", changes.get(0).afterValue());
        assertEquals(AuditValueState.VALUE, changes.get(0).afterState());
        assertEquals("101.5", changes.get(1).afterValue());
        assertEquals(AuditValueState.CLEARED, changes.get(2).afterState());
        assertEquals(AuditValueState.VALUE, changes.get(2).beforeState());
    }

    @Test
    void createLeavesUnsubmittedFieldsMissing() {
        var changes = BusinessEntityValueSupport.extensionChanges(
                null,
                entity(Map.of("displayName", "\"新名称\"")),
                DEFINITION,
                new ExtensionSubmission(List.of(
                        new ExtensionSubmission.ExtensionFieldValue("displayName", "\"新名称\"", ExtensionSubmission.Mode.SET))));

        assertEquals(1, changes.size());
        assertEquals(AuditValueState.MISSING, changes.get(0).beforeState());
        assertEquals(AuditValueState.VALUE, changes.get(0).afterState());
    }

    private static OrganizationEntityReadback entity(Map<String, String> extensionValues) {
        return new OrganizationEntityReadback(
                UUID.randomUUID(),
                "STORE",
                UUID.randomUUID(),
                "workspace",
                "code",
                "name",
                null,
                null,
                "ENABLED",
                1,
                null,
                null,
                null,
                1,
                1,
                1,
                extensionValues);
    }
}
