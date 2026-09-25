package com.catering.v2s.platform.workspace.application.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditReadScope;
import com.catering.v2s.platform.access.PlatformExecutionContext;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationPageRequest;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationReadback;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.invocation.InvocationOnMock;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementSetter;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.core.RowMapper;

class WorkspaceEffectiveSqlCaptureTest {
    @Test
    void capturesEveryWorkspacePersistenceExecutionPoint() throws Exception {
        List<Capture> captures = new ArrayList<>();
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        doAnswer(invocation -> {
                    captures.add(new Capture(
                            "update", invocation.getArgument(0, String.class), varargValues(invocation, 1).length));
                    return 1;
                })
                .when(jdbc)
                .update(anyString(), any(Object[].class));
        doAnswer(invocation -> {
                    captures.add(new Capture(
                            "queryForList",
                            invocation.getArgument(0, String.class),
                            varargValues(invocation, 1).length));
                    return List.of();
                })
                .when(jdbc)
                .queryForList(anyString(), any(Object[].class));
        doAnswer(invocation -> {
                    captures.add(new Capture(
                            "queryForObject",
                            invocation.getArgument(0, String.class),
                            varargValues(invocation, 2).length));
                    return 41L;
                })
                .when(jdbc)
                .queryForObject(anyString(), eq(Long.class), any(Object[].class));
        doAnswer(invocation -> {
                    captures.add(new Capture(
                            "query", invocation.getArgument(0, String.class), varargValues(invocation, 2).length));
                    return List.of();
                })
                .when(jdbc)
                .query(anyString(), any(RowMapper.class), any(Object[].class));
        doAnswer(invocation -> {
                    PreparedStatement statement = mock(PreparedStatement.class);
                    List<Integer> boundSlots = new ArrayList<>();
                    doAnswer(binding -> {
                                boundSlots.add(binding.getArgument(0, Integer.class));
                                return null;
                            })
                            .when(statement)
                            .setString(anyInt(), nullable(String.class));
                    doAnswer(binding -> {
                                boundSlots.add(binding.getArgument(0, Integer.class));
                                return null;
                            })
                            .when(statement)
                            .setObject(anyInt(), nullable(Object.class));
                    doAnswer(binding -> {
                                boundSlots.add(binding.getArgument(0, Integer.class));
                                return null;
                            })
                            .when(statement)
                            .setLong(anyInt(), anyLong());
                    invocation.getArgument(1, PreparedStatementSetter.class).setValues(statement);
                    captures.add(
                            new Capture("queryExtractor", invocation.getArgument(0, String.class), boundSlots.size()));
                    ResultSet rows = mock(ResultSet.class);
                    org.mockito.Mockito.when(rows.next()).thenReturn(false);
                    return invocation.getArgument(2, ResultSetExtractor.class).extractData(rows);
                })
                .when(jdbc)
                .query(
                        anyString(),
                        any(org.springframework.jdbc.core.PreparedStatementSetter.class),
                        any(ResultSetExtractor.class));

        UUID workspaceUuid = UUID.randomUUID();
        String key = "workspace-key";
        WorkspaceAdministrationPersistence administration = new WorkspaceAdministrationPersistence(jdbc);
        administration.create(
                workspaceUuid,
                key,
                "Workspace",
                "workspace",
                "Operations",
                UUID.randomUUID().toString(),
                null,
                1L);
        administration.page(new WorkspaceAdministrationPageRequest(null, null, null, null, 1, 20, "NAME", "ASC"));
        administration.findByKey(key);
        administration.findStatus(workspaceUuid, key);
        administration.updateDisplay("Workspace", "workspace", "Operations", null, null, 2L, key, 1L);
        administration.transitionStatus("DISABLED", 3L, key, 1L);
        administration.findLegacyId(workspaceUuid, key);
        WorkspaceAdministrationReadback workspace = new WorkspaceAdministrationReadback(
                workspaceUuid, key, "Workspace", "Operations", null, null, "ENABLED", 1L, 1L, 1L, 2L, false);
        administration.insertAudit(
                UUID.randomUUID(), workspace, 41L, "GROUP_WORKSPACE_UPDATED", AuditActor.system(), 3L, "[]");

        new PlatformWorkspaceAuditHistoryPersistence(jdbc)
                .readGroupWorkspace(new AuditReadScope(workspaceUuid, key), key, 20L);

        WorkspaceCommandReceiptPersistence receipts = new WorkspaceCommandReceiptPersistence(jdbc);
        receipts.lock(key, "receipt-key-0001");
        receipts.find(key, "receipt-key-0001");
        receipts.upgradeLegacyResponse(key, "receipt-key-0001", "{}");
        receipts.insert(key, workspaceUuid, "receipt-key-0001", "request-hash", "{}", 4L);

        PlatformExecutionContext context = mock(PlatformExecutionContext.class);
        JdbcGroupWorkspaceRepository repository = new JdbcGroupWorkspaceRepository(jdbc);
        repository.list(context, null, null);
        repository.detail(context, key);

        assertEquals(15, captures.size());
        assertEquals(
                List.of(
                        "update",
                        "query",
                        "queryExtractor",
                        "queryExtractor",
                        "query",
                        "update",
                        "queryForObject",
                        "update",
                        "queryExtractor",
                        "queryForList",
                        "queryExtractor",
                        "update",
                        "update",
                        "query",
                        "query"),
                captures.stream().map(Capture::sink).toList());
        assertEquals(
                List.of(10, 10, 1, 2, 8, 5, 2, 10, 5, 2, 2, 3, 6, 4, 1),
                captures.stream().map(Capture::parameterCount).toList());
        assertTrue(captures.stream().allMatch(capture -> !capture.sql().isBlank()));
        assertFalse(captures.stream().anyMatch(capture -> capture.sql().contains("? ?")));

        StringBuilder xml = new StringBuilder("<workspace-effective-sql-capture-after>\n");
        for (int index = 0; index < captures.size(); index++) {
            Capture capture = captures.get(index);
            xml.append("  <point index=\"")
                    .append(index + 1)
                    .append("\" sink=\"")
                    .append(capture.sink())
                    .append("\" parameterCount=\"")
                    .append(capture.parameterCount())
                    .append("\"><![CDATA[")
                    .append(capture.sql())
                    .append("]]></point>\n");
        }
        xml.append("</workspace-effective-sql-capture-after>\n");
        Files.writeString(Path.of("workspace-effective-sql-capture-after.xml").toAbsolutePath(), xml);
    }

    private static Object[] varargValues(InvocationOnMock invocation, int fixedArgumentCount) {
        Object[] arguments = invocation.getArguments();
        if (arguments.length == fixedArgumentCount + 1 && arguments[fixedArgumentCount] instanceof Object[] values)
            return values;
        return Arrays.copyOfRange(arguments, fixedArgumentCount, arguments.length);
    }

    private record Capture(String sink, String sql, int parameterCount) {}
}
