package com.catering.v2s.platform.receipt;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.organization.api.CommercialGroupReadback;
import com.catering.v2s.organization.api.OrganizationNodeReadback;
import com.catering.v2s.organization.application.CommercialGroupCommandReceiptService;
import com.catering.v2s.organization.application.OrganizationHierarchyCommandReceiptService;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.iam.application.PlatformAuthenticationService;
import com.catering.v2s.platform.iam.application.PlatformCommandReceiptService;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationReadback;
import com.catering.v2s.platform.workspace.application.WorkspaceCommandReceiptService;
import com.catering.v2s.platform.workspace.application.persistence.WorkspaceCommandReceiptPersistence;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import java.sql.ResultSet;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementSetter;
import org.springframework.jdbc.core.ResultSetExtractor;

class CommandReceiptJacksonTest {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final TimeProvider TIME = () -> 1_785_000_000_000L;
    private static final String REQUEST = "receipt-jackson-request";

    @Test
    void organizationHierarchyReceiptReplaysLegacyAndCanonicalizesEscapedText() throws Exception {
        UUID workspace = UUID.randomUUID();
        UUID id = UUID.randomUUID();
        String escaped = "Node" + '"' + '\\';
        OrganizationNodeReadback expected = new OrganizationNodeReadback(
                id,
                workspace,
                "group-\\\"",
                null,
                "PROJECT",
                "P-1",
                escaped,
                escaped,
                "ENABLED",
                4L,
                5L,
                6L,
                List.of("Prep", escaped),
                Map.of("label", escaped),
                7L);
        ObjectNode legacy = JSON.createObjectNode();
        legacyField(legacy, "id", id.toString());
        legacyField(legacy, "workspaceUuid", workspace.toString());
        legacyField(legacy, "groupWorkspaceKey", expected.groupWorkspaceKey());
        legacyField(legacy, "parentId", null);
        legacyField(legacy, "nodeType", expected.nodeType());
        legacyField(legacy, "code", expected.code());
        legacyField(legacy, "name", expected.name());
        legacyField(legacy, "notes", expected.notes());
        legacyField(legacy, "status", expected.status());
        legacyField(legacy, "version", String.valueOf(expected.version()));
        legacyField(legacy, "createdAtEpochMillis", String.valueOf(expected.createdAtEpochMillis()));
        legacyField(legacy, "updatedAtEpochMillis", String.valueOf(expected.updatedAtEpochMillis()));
        legacyListField(legacy, "phaseNames", expected.phaseNames());
        legacyMapField(legacy, "extensionValues", expected.extensionValues());
        legacyField(legacy, "extensionRuleRevision", String.valueOf(expected.extensionRuleRevision()));

        JdbcTemplate jdbc = existingReceiptJdbc(legacy.toString());
        OrganizationNodeReadback actual = new OrganizationHierarchyCommandReceiptService(jdbc, TIME)
                .execute(workspace, "organization-receipt-0001", REQUEST, () -> {
                    throw new AssertionError("legacy receipt must replay");
                });

        assertEquals(expected, actual);
        assertEquals(expected, JSON.readValue(canonicalJson(jdbc), OrganizationNodeReadback.class));
    }

    @Test
    void commercialGroupReceiptReplaysLegacyAndCanonicalizesEscapedText() throws Exception {
        UUID workspace = UUID.randomUUID();
        UUID id = UUID.randomUUID();
        String escaped = "Group" + '"' + '\\';
        CommercialGroupReadback expected = new CommercialGroupReadback(
                id, "group-key", escaped, escaped, 2L, escaped, 3L, 4L, Map.of("label", escaped), 5L);
        ObjectNode legacy = JSON.createObjectNode();
        legacyField(legacy, "id", id.toString());
        legacyField(legacy, "groupWorkspaceKey", expected.groupWorkspaceKey());
        legacyField(legacy, "commercialGroupCode", expected.commercialGroupCode());
        legacyField(legacy, "commercialGroupName", expected.commercialGroupName());
        legacyField(legacy, "revision", String.valueOf(expected.revision()));
        legacyField(legacy, "createdByPlatformSubject", expected.createdByPlatformSubject());
        legacyField(legacy, "createdAtEpochMillis", String.valueOf(expected.createdAtEpochMillis()));
        legacyField(legacy, "updatedAtEpochMillis", String.valueOf(expected.updatedAtEpochMillis()));
        legacyMapField(legacy, "extensionValues", expected.extensionValues());
        legacyField(legacy, "extensionRuleRevision", String.valueOf(expected.extensionRuleRevision()));

        JdbcTemplate jdbc = existingReceiptJdbc(legacy.toString());
        CommercialGroupReadback actual = new CommercialGroupCommandReceiptService(jdbc, TIME)
                .execute(workspace, "commercial-receipt-0001", REQUEST, () -> {
                    throw new AssertionError("legacy receipt must replay");
                });

        assertEquals(expected, actual);
        assertEquals(expected, JSON.readValue(canonicalJson(jdbc), CommercialGroupReadback.class));
    }

    @Test
    void workspaceReceiptReplaysLegacyAndCanonicalizesEscapedText() throws Exception {
        UUID workspace = UUID.randomUUID();
        String escaped = "Workspace" + '"' + '\\';
        WorkspaceAdministrationReadback expected = new WorkspaceAdministrationReadback(
                workspace, "group-key", escaped, escaped, escaped, escaped, "ENABLED", 1L, 2L, 3L, 4L, true);
        ObjectNode legacy = JSON.createObjectNode();
        legacyField(legacy, "workspaceUuid", expected.workspaceUuid().toString());
        legacyField(legacy, "groupWorkspaceKey", expected.groupWorkspaceKey());
        legacyField(legacy, "name", expected.name());
        legacyField(legacy, "operationsTitle", expected.operationsTitle());
        legacyField(legacy, "logoAssetRef", expected.logoAssetRef());
        legacyField(legacy, "notes", expected.notes());
        legacyField(legacy, "status", expected.status());
        legacyField(legacy, "statusChangedAtEpochMillis", String.valueOf(expected.statusChangedAtEpochMillis()));
        legacyField(legacy, "version", String.valueOf(expected.version()));
        legacyField(legacy, "createdAtEpochMillis", String.valueOf(expected.createdAtEpochMillis()));
        legacyField(legacy, "updatedAtEpochMillis", String.valueOf(expected.updatedAtEpochMillis()));
        legacyField(legacy, "commercialGroupInitialized", String.valueOf(expected.commercialGroupInitialized()));

        JdbcTemplate jdbc = existingReceiptJdbc(legacy.toString());
        WorkspaceAdministrationReadback actual = new WorkspaceCommandReceiptService(
                        new WorkspaceCommandReceiptPersistence(jdbc), TIME)
                .execute("group-key", "workspace-receipt-0001", REQUEST, () -> {
                    throw new AssertionError("legacy receipt must replay");
                });

        assertEquals(expected, actual);
        assertEquals(expected, JSON.readValue(canonicalJson(jdbc), WorkspaceAdministrationReadback.class));
    }

    @Test
    void platformReceiptReplaysLegacyAndCanonicalizesEscapedText() throws Exception {
        UUID id = UUID.randomUUID();
        String escaped = "Admin" + '"' + '\\';
        PlatformAuthenticationService.PlatformAdminReadback expected =
                new PlatformAuthenticationService.PlatformAdminReadback(
                        id, escaped, escaped, null, "ENABLED", true, 2L, 3L, 4L, null, escaped);
        ObjectNode legacy = JSON.createObjectNode();
        legacyField(legacy, "id", id.toString());
        legacyField(legacy, "loginName", expected.loginName());
        legacyField(legacy, "displayName", expected.displayName());
        legacyField(legacy, "mobile", null);
        legacyField(legacy, "status", expected.status());
        legacyField(legacy, "builtIn", String.valueOf(expected.builtIn()));
        legacyField(legacy, "version", String.valueOf(expected.version()));
        legacyField(legacy, "createdAt", String.valueOf(expected.createdAtEpochMillis()));
        legacyField(legacy, "updatedAt", String.valueOf(expected.updatedAtEpochMillis()));
        legacyField(legacy, "lastLoginAt", null);
        legacyField(legacy, "auditSummary", expected.auditSummary());

        JdbcTemplate jdbc = existingReceiptJdbc(legacy.toString());
        PlatformAuthenticationService.PlatformAdminReadback actual = new PlatformCommandReceiptService(jdbc, TIME)
                .execute("platform-receipt-0001", REQUEST, () -> {
                    throw new AssertionError("legacy receipt must replay");
                });

        assertEquals(expected, actual);
        assertEquals(
                expected,
                JSON.readValue(canonicalJson(jdbc), PlatformAuthenticationService.PlatformAdminReadback.class));
    }

    private static JdbcTemplate existingReceiptJdbc(String legacyJson) throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ResultSet result = mock(ResultSet.class);
        when(result.next()).thenReturn(true);
        when(result.getString(1)).thenReturn(Sha256Hex.digest(REQUEST));
        when(result.getString(2)).thenReturn(legacyJson);
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class)))
                .thenAnswer(invocation -> {
                    ResultSetExtractor<?> extractor = invocation.getArgument(2);
                    return extractor.extractData(result);
                });
        return jdbc;
    }

    private static String canonicalJson(JdbcTemplate jdbc) {
        ArgumentCaptor<Object[]> arguments = ArgumentCaptor.forClass(Object[].class);
        verify(jdbc).update(contains("UPDATE"), arguments.capture());
        return Arrays.stream(arguments.getValue())
                .filter(String.class::isInstance)
                .map(String.class::cast)
                .filter(value -> value.startsWith("{"))
                .findFirst()
                .orElseThrow();
    }

    private static void legacyField(ObjectNode target, String name, String value) {
        target.put(name, value == null ? "-" : encode(value));
    }

    private static void legacyListField(ObjectNode target, String name, List<String> values) {
        legacyField(
                target,
                name,
                values.stream().map(CommandReceiptJacksonTest::encode).collect(Collectors.joining(",")));
    }

    private static void legacyMapField(ObjectNode target, String name, Map<String, String> values) {
        legacyField(
                target,
                name,
                values.entrySet().stream()
                        .sorted(Map.Entry.comparingByKey())
                        .map(entry -> encode(entry.getKey()) + ":" + encode(entry.getValue()))
                        .collect(Collectors.joining(",")));
    }

    private static String encode(String value) {
        return Base64.getEncoder().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }
}
