package com.catering.v2s.app.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockingDetails;

import com.catering.v2s.collaboration.application.persistence.CollaborationOwnerPersistence;
import com.catering.v2s.collaboration.application.persistence.CollaborationOwnerPersistence.AuditRecord;
import com.catering.v2s.collaboration.application.persistence.CollaborationOwnerPersistence.BindingRow;
import com.catering.v2s.collaboration.application.persistence.CollaborationOwnerPersistence.EnablementKind;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.PreparedStatement;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.mockito.invocation.Invocation;
import org.mockito.invocation.InvocationOnMock;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementSetter;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.core.RowMapper;

class CollaborationOwnerEffectiveSqlCaptureTest {
    private static final UUID WORKSPACE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID BINDING = UUID.fromString("00000000-0000-0000-0000-000000000002");
    private static final UUID NODE = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final long NOW = 1_790_000_000_000L;
    private static final String WORKSPACE_KEY = "workspace-key";

    @Test
    void capturesEveryCollaborationPersistenceExecutionPoint() throws Exception {
        List<Point> points = new ArrayList<>();
        TimeProvider time = () -> NOW;

        capture(points, "collaboration/owner-enablements/read-tree/query/01", jdbc ->
                new CollaborationOwnerPersistence(jdbc, time).readTree(WORKSPACE, WORKSPACE_KEY));
        for (EnablementKind kind : EnablementKind.values()) {
            capture(points, "collaboration/owner-enablements/read-one/query/" + kind.name(), jdbc ->
                    new CollaborationOwnerPersistence(jdbc, time).readEnablement(kind, WORKSPACE, WORKSPACE_KEY, "CODE"));
            capture(points, "collaboration/owner-enablements/read-one-for-update/query/" + kind.name(), jdbc ->
                    new CollaborationOwnerPersistence(jdbc, time)
                            .readEnablementForUpdate(kind, WORKSPACE, WORKSPACE_KEY, "CODE"));
            capture(points, "collaboration/owner-enablements/read-all/query/" + kind.name(), jdbc ->
                    new CollaborationOwnerPersistence(jdbc, time).readEnablements(kind, WORKSPACE, WORKSPACE_KEY));
            capture(points, "collaboration/owner-enablements/lock/query/" + kind.name(), jdbc ->
                    new CollaborationOwnerPersistence(jdbc, time).lockEnablement(kind, WORKSPACE, WORKSPACE_KEY, "CODE"));
            capture(points, "collaboration/owner-enablements/insert/update/" + kind.name(), jdbc ->
                    new CollaborationOwnerPersistence(jdbc, time)
                            .insertEnablement(kind, WORKSPACE, WORKSPACE_KEY, "CODE", "ENABLED"));
            capture(points, "collaboration/owner-enablements/update/update/" + kind.name(), jdbc ->
                    new CollaborationOwnerPersistence(jdbc, time)
                            .updateEnablement(kind, WORKSPACE, WORKSPACE_KEY, "CODE", "DISABLED", 7L));
        }

        CollaborationOwnerPersistence.BindingRow row = bindingRow();
        capture(points, "collaboration/owner-binding/read/query/01", jdbc ->
                new CollaborationOwnerPersistence(jdbc, time).readBinding(WORKSPACE, WORKSPACE_KEY, BINDING));
        capture(points, "collaboration/owner-binding/read-for-update/query/01", jdbc ->
                new CollaborationOwnerPersistence(jdbc, time).readBindingForUpdate(WORKSPACE, WORKSPACE_KEY, BINDING));
        capture(points, "collaboration/owner-binding/read-by-reference/query/01", jdbc ->
                new CollaborationOwnerPersistence(jdbc, time).readBindingByReference(BINDING));
        for (String sortKey : List.of("NODE", "BUSINESS", "EXTERNAL_OWNER_ID", "STATUS")) {
            for (String direction : List.of("ASC", "DESC")) {
                String branch = sortKey + "_" + direction;
                capture(points, "collaboration/owner-binding/page/query/" + branch, jdbc ->
                        new CollaborationOwnerPersistence(jdbc, time)
                                .pageBindings(WORKSPACE, WORKSPACE_KEY, "PROVIDER", "name", "node", sortKey, direction, 10, 20L));
            }
        }
        for (String direction : List.of("ASC", "DESC")) {
            capture(points, "collaboration/owner-binding/page/query/DEFAULT_" + direction, jdbc ->
                    new CollaborationOwnerPersistence(jdbc, time)
                            .pageBindings(WORKSPACE, WORKSPACE_KEY, "PROVIDER", "name", "node", "BINDING_NAME", direction, 10, 20L));
        }
        capture(points, "collaboration/owner-binding/find-for-node/query/01", jdbc ->
                new CollaborationOwnerPersistence(jdbc, time)
                        .findBindingsForNode(WORKSPACE, WORKSPACE_KEY, "PROVIDER", "STORE", NODE.toString()));
        capture(points, "collaboration/owner-binding/insert/query/01", jdbc ->
                new CollaborationOwnerPersistence(jdbc, time)
                        .insertBinding(WORKSPACE, WORKSPACE_KEY, "SYSTEM", "PROVIDER", "TAKEAWAY", "STORE", NODE.toString(), "Binding", "owner", "EFFECTIVE"));
        capture(points, "collaboration/owner-binding/update/update/01", jdbc ->
                new CollaborationOwnerPersistence(jdbc, time)
                        .updateBinding(BINDING, WORKSPACE, WORKSPACE_KEY, "Binding 2", "owner-2", 7L));
        capture(points, "collaboration/owner-binding/delete/query/01", jdbc ->
                new CollaborationOwnerPersistence(jdbc, time).deleteBinding(BINDING, WORKSPACE, WORKSPACE_KEY, 7L));
        capture(points, "collaboration/owner-binding/authorization/update/01", jdbc ->
                new CollaborationOwnerPersistence(jdbc, time)
                        .applyAuthorization(BINDING, "owner", "authorization", 7L));
        capture(points, "collaboration/owner-binding/revocation/update/01", jdbc ->
                new CollaborationOwnerPersistence(jdbc, time).applyRevocation(BINDING, 7L));
        capture(points, "collaboration/owner-binding/node-path/query/01", jdbc ->
                new CollaborationOwnerPersistence(jdbc, time).readNodePath(row));
        capture(points, "collaboration/audit/insert/update/01", jdbc ->
                new CollaborationOwnerPersistence(jdbc, time)
                        .writeAudit(new AuditRecord(
                                WORKSPACE,
                                WORKSPACE_KEY,
                                BINDING.toString(),
                                "OWNER_BINDING",
                                "BINDING_UPDATED",
                                "SYSTEM",
                                null,
                                "system",
                                "{}")));

        assertEquals(34, points.size());
        assertEquals(points.size(), points.stream().map(Point::key).distinct().count());
        assertTrue(points.stream().allMatch(point -> !point.sql().isBlank()));
        writeCapture(points);
    }

    private static BindingRow bindingRow() {
        return new BindingRow(
                BINDING,
                WORKSPACE,
                WORKSPACE_KEY,
                "SYSTEM",
                "PROVIDER",
                "TAKEAWAY",
                "STORE",
                NODE.toString(),
                "Binding",
                "owner",
                null,
                "EFFECTIVE",
                null,
                null,
                null,
                7L,
                NOW,
                NOW,
                NOW);
    }

    private static void capture(List<Point> points, String key, Consumer<JdbcTemplate> action) {
        List<RawCall> calls = new ArrayList<>();
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        configure(jdbc, calls);
        action.accept(jdbc);
        assertEquals(1, calls.size(), key + " must have exactly one JDBC execution");
        RawCall call = calls.get(0);
        points.add(new Point(key, call.sink(), call.sql(), call.slots()));
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static void configure(JdbcTemplate jdbc, List<RawCall> calls) {
        doAnswer(invocation -> {
                    calls.add(new RawCall(
                            "query",
                            invocation.getArgument(0),
                            captureSetter(invocation.getArgument(1))));
                    return List.of();
                })
                .when(jdbc)
                .query(anyString(), any(PreparedStatementSetter.class), any(RowMapper.class));
        doAnswer(invocation -> {
                    calls.add(new RawCall(
                            "query",
                            invocation.getArgument(0),
                            captureSetter(invocation.getArgument(1))));
                    return null;
                })
                .when(jdbc)
                .query(anyString(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class));
        doAnswer(invocation -> {
                    calls.add(new RawCall(
                            "query",
                            invocation.getArgument(0),
                            captureSetter(invocation.getArgument(1))));
                    return null;
                })
                .when(jdbc)
                .query(anyString(), any(ResultSetExtractor.class));
        doAnswer(invocation -> {
                    calls.add(new RawCall(
                            "queryForList",
                            invocation.getArgument(0),
                            describeValues(varargValues(invocation))));
                    return List.of();
                })
                .when(jdbc)
                .queryForList(anyString(), any(Object[].class));
        doAnswer(invocation -> {
                    calls.add(new RawCall(
                            "update",
                            invocation.getArgument(0),
                            describeValues(varargValues(invocation))));
                    return 1;
                })
                .when(jdbc)
                .update(anyString(), any(Object[].class));
    }

    private static List<String> captureSetter(PreparedStatementSetter setter) throws Exception {
        PreparedStatement statement = mock(PreparedStatement.class);
        setter.setValues(statement);
        Collection<Invocation> invocations = mockingDetails(statement).getInvocations();
        return invocations.stream().map(CollaborationOwnerEffectiveSqlCaptureTest::describeInvocation).toList();
    }

    private static List<String> describeValues(Object[] values) {
        return Arrays.stream(values).map(CollaborationOwnerEffectiveSqlCaptureTest::describeValue).toList();
    }

    private static Object[] varargValues(InvocationOnMock invocation) {
        Object[] arguments = invocation.getArguments();
        if (arguments.length == 2 && arguments[1] instanceof Object[] values) return values;
        return Arrays.copyOfRange(arguments, 1, arguments.length);
    }

    private static String describeInvocation(Invocation invocation) {
        return invocation.getMethod().getName()
                + "["
                + Arrays.stream(invocation.getArguments())
                        .map(CollaborationOwnerEffectiveSqlCaptureTest::describeValue)
                        .collect(Collectors.joining(","))
                + "]";
    }

    private static String describeValue(Object value) {
        if (value == null) return "null";
        if (value instanceof UUID) return "UUID";
        if (value instanceof Number) return "NUMBER";
        if (value instanceof String string) return "String:" + string;
        return value.getClass().getSimpleName();
    }

    private static void writeCapture(List<Point> points) throws Exception {
        Path output = Path.of("collaboration-effective-sql-capture-after.xml").toAbsolutePath();
        Files.createDirectories(output.getParent());
        String body = points.stream()
                .map(point -> "  <point key=\"" + escape(point.key())
                        + "\" sink=\"" + escape(point.sink())
                        + "\" slots=\"" + escape(String.join("|", point.slots()))
                        + "\"><![CDATA[" + point.sql().replace("]]>", "]]]]><![CDATA[>") + "]]></point>")
                .collect(Collectors.joining("\n"));
        Files.writeString(output, "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<sql-capture phase=\"after\">\n"
                + body
                + "\n</sql-capture>\n");
    }

    private static String escape(String value) {
        return value.replace("&", "&amp;")
                .replace("\"", "&quot;")
                .replace("<", "&lt;")
                .replace(">", "&gt;");
    }

    private record RawCall(String sink, String sql, List<String> slots) {}

    private record Point(String key, String sink, String sql, List<String> slots) {}
}
