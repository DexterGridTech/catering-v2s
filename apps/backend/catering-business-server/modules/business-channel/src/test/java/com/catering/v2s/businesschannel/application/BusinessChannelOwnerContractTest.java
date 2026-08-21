package com.catering.v2s.businesschannel.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import com.catering.v2s.businesschannel.api.BusinessChannelReadback;
import com.catering.v2s.collaboration.api.CollaborationBindingReadApi;
import com.catering.v2s.collaboration.api.CollaborationCatalogReadApi;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementSetter;
import org.springframework.jdbc.core.RowMapper;

class BusinessChannelOwnerContractTest {
    @Test
    void readbackDoesNotExposeAdapterSecretsOrOpaqueAuthorizationValues() {
        assertFalse(hasRecordComponent(BusinessChannelReadback.Channel.class, "authorizationRef"));
        assertFalse(hasRecordComponent(BusinessChannelReadback.Channel.class, "externalOwnerId"));
        assertFalse(hasRecordComponent(BusinessChannelReadback.Channel.class, "token"));
    }

    @Test
    void nullableChannelCodeIsReturnedExactly() {
        // Legacy rows may still have no code; new commands require a user-entered immutable code.
        BusinessChannelReadback.Channel withoutCode = channel(null);
        BusinessChannelReadback.Channel withCode = channel("  keep-me  ");
        assertNull(withoutCode.channelCode());
        assertEquals("  keep-me  ", withCode.channelCode());
    }

    @Test
    void staleOperationsContextIsRejectedBeforeReceiptReplayOrWrite() {
        UUID workspace = UUID.randomUUID();
        UUID project = UUID.randomUUID();
        BusinessChannelCommandReceiptService receipts = mock(BusinessChannelCommandReceiptService.class);
        BusinessChannelOwnerService service = new BusinessChannelOwnerService(
                mock(JdbcTemplate.class),
                (TimeProvider) () -> 1_785_000_000_000L,
                mock(CollaborationCatalogReadApi.class),
                mock(CollaborationBindingReadApi.class),
                receipts);
        OperationsOwnerScopeGrant staleGrant = new OperationsOwnerScopeGrant(
                workspace,
                "workspace-key",
                "REQ_CREATE_OPERATIONS_BUSINESS_CHANNEL_TEMPLATE",
                "BC-BUSINESS-CHANNEL-PROJECT-EDIT",
                "PROJECT",
                project,
                "PROJECT",
                project,
                List.of(),
                42L);
        BusinessChannelCommandApi.CreateTemplateCommand command = new BusinessChannelCommandApi.CreateTemplateCommand(
                workspace,
                "workspace-key",
                project,
                "Internal takeaway",
                "INTERNAL_TAKEAWAY",
                "INTERNAL",
                "PROJECT",
                "TAKEAWAY",
                null,
                null,
                41L,
                "business-channel-stale-01",
                AuditActor.system(),
                staleGrant);

        BusinessChannelCommandApi.Problem problem = org.junit.jupiter.api.Assertions.assertThrows(
                BusinessChannelCommandApi.Problem.class, () -> service.createTemplate(command));
        assertEquals("AUTHORIZATION_REQUIRED", problem.code());
        verifyNoInteractions(receipts);
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void boundedChannelReadReturnsTheExactSetAndIgnoresRequestPageSize() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        List<UUID> refs = List.of(UUID.randomUUID(), UUID.randomUUID());
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(RowMapper.class)))
                .thenAnswer(invocation -> {
                    RowMapper mapper = invocation.getArgument(2);
                    List<Object> rows = new ArrayList<>();
                    for (int index = 0; index < refs.size(); index++) {
                        rows.add(mapper.mapRow(channelRow(refs.get(index)), index));
                    }
                    return rows;
                });

        BusinessChannelReadback.ChannelPage page = readService(jdbc)
                .pageChannels(
                        UUID.randomUUID(),
                        "workspace-key",
                        "PROJECT",
                        UUID.randomUUID().toString(),
                        null,
                        null,
                        null);

        assertEquals(
                refs,
                page.items().stream()
                        .map(BusinessChannelReadback.Channel::channelRef)
                        .toList());
        assertEquals("NOT_REQUIRED", page.items().get(0).bindingStatus());
        assertNull(page.nextCursor());
        assertEquals(refs.size(), page.total());

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<PreparedStatementSetter> setter = ArgumentCaptor.forClass(PreparedStatementSetter.class);
        verify(jdbc).query(sql.capture(), setter.capture(), any(RowMapper.class));
        assertFalse(sql.getValue().contains("COUNT(*)"));
        assertFalse(sql.getValue().contains("channel_ref > ?"));
        PreparedStatement statement = mock(PreparedStatement.class);
        setter.getValue().setValues(statement);
        verify(statement).setObject(5, BusinessChannelOwnerService.BOUNDED_READ_LIMIT + 1);
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void boundedChannelReadRejectsOverflowInsteadOfSilentlyTruncating() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(RowMapper.class)))
                .thenAnswer(invocation -> {
                    RowMapper mapper = invocation.getArgument(2);
                    List<Object> rows = new ArrayList<>();
                    for (int index = 0; index < BusinessChannelOwnerService.BOUNDED_READ_LIMIT + 1; index++) {
                        rows.add(mapper.mapRow(channelRow(UUID.randomUUID()), index));
                    }
                    return rows;
                });

        BusinessChannelCommandApi.Problem problem =
                assertThrows(BusinessChannelCommandApi.Problem.class, () -> readService(jdbc)
                        .pageChannels(
                                UUID.randomUUID(),
                                "workspace-key",
                                "STORE",
                                UUID.randomUUID().toString(),
                                null,
                                null,
                                null));

        assertEquals("PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION", problem.code());
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void boundedTemplateReadUsesTheSameFixedSourceLimit() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(RowMapper.class)))
                .thenAnswer(invocation -> {
                    RowMapper mapper = invocation.getArgument(2);
                    return List.of(mapper.mapRow(templateRow(UUID.randomUUID()), 0));
                });

        BusinessChannelReadback.TemplatePage page = readService(jdbc)
                .pageTemplates(UUID.randomUUID(), "workspace-key", UUID.randomUUID(), null, null, null, null);

        assertEquals(1, page.items().size());
        assertNull(page.nextCursor());
        assertEquals(1, page.total());
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void boundedTemplateReadRejectsOverflowInsteadOfReturningAPartialSet() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(RowMapper.class)))
                .thenAnswer(invocation -> {
                    RowMapper mapper = invocation.getArgument(2);
                    List<Object> rows = new ArrayList<>();
                    for (int index = 0; index < BusinessChannelOwnerService.BOUNDED_READ_LIMIT + 1; index++) {
                        rows.add(mapper.mapRow(templateRow(UUID.randomUUID()), index));
                    }
                    return rows;
                });

        BusinessChannelCommandApi.Problem problem =
                assertThrows(BusinessChannelCommandApi.Problem.class, () -> readService(jdbc)
                        .pageTemplates(UUID.randomUUID(), "workspace-key", UUID.randomUUID(), null, null, null, null));

        assertEquals("PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION", problem.code());
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void boundedChannelReadUsesTheRequestedColumnAndDirection() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(RowMapper.class)))
                .thenAnswer(invocation -> {
                    RowMapper mapper = invocation.getArgument(2);
                    return List.of(mapper.mapRow(channelRow(UUID.randomUUID()), 0));
                });

        readService(jdbc)
                .pageChannels(
                        UUID.randomUUID(),
                        "workspace-key",
                        "PROJECT",
                        UUID.randomUUID().toString(),
                        null,
                        "CHANNEL_NAME",
                        "DESC");

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).query(sql.capture(), any(PreparedStatementSetter.class), any(RowMapper.class));
        assertTrue(sql.getValue().contains("ORDER BY c.channel_name DESC, c.channel_ref"));
    }

    @Test
    void boundedReadRejectsUnsupportedSortKeyBeforeQuerying() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);

        BusinessChannelCommandApi.Problem problem =
                assertThrows(BusinessChannelCommandApi.Problem.class, () -> readService(jdbc)
                        .pageTemplates(
                                UUID.randomUUID(), "workspace-key", UUID.randomUUID(), null, null, "UNKNOWN", "ASC"));

        assertEquals("VALIDATION_ERROR", problem.code());
        verifyNoInteractions(jdbc);
    }

    @Test
    void boundedReadRejectsDirectionWithoutAColumnBeforeQuerying() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);

        BusinessChannelCommandApi.Problem problem =
                assertThrows(BusinessChannelCommandApi.Problem.class, () -> readService(jdbc)
                        .pageChannels(
                                UUID.randomUUID(),
                                "workspace-key",
                                "PROJECT",
                                UUID.randomUUID().toString(),
                                null,
                                null,
                                "ASC"));

        assertEquals("VALIDATION_ERROR", problem.code());
        verifyNoInteractions(jdbc);
    }

    @Test
    void storeTemplateCandidateReadRejectsUnsupportedSortBeforeQuerying() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);

        BusinessChannelCommandApi.Problem problem =
                assertThrows(BusinessChannelCommandApi.Problem.class, () -> readService(jdbc)
                        .pageStoreTemplateCandidates(
                                UUID.randomUUID(),
                                "workspace-key",
                                UUID.randomUUID(),
                                UUID.randomUUID().toString(),
                                null,
                                50,
                                "UNKNOWN",
                                "ASC"));

        assertEquals("VALIDATION_ERROR", problem.code());
        verifyNoInteractions(jdbc);
    }

    private static BusinessChannelOwnerService readService(JdbcTemplate jdbc) {
        return new BusinessChannelOwnerService(
                jdbc,
                (TimeProvider) () -> 1_785_000_000_000L,
                mock(CollaborationCatalogReadApi.class),
                mock(CollaborationBindingReadApi.class),
                mock(BusinessChannelCommandReceiptService.class));
    }

    private static ResultSet channelRow(UUID channelRef) throws Exception {
        ResultSet row = mock(ResultSet.class);
        when(row.getObject("channel_ref", UUID.class)).thenReturn(channelRef);
        when(row.getObject("template_ref", UUID.class)).thenReturn(UUID.randomUUID());
        when(row.getString("target_node_type")).thenReturn("PROJECT");
        when(row.getString("target_node_ref")).thenReturn(UUID.randomUUID().toString());
        when(row.getString("channel_code")).thenReturn("CHANNEL-CODE");
        when(row.getString("channel_name")).thenReturn("Channel");
        when(row.getObject("binding_ref", UUID.class)).thenReturn(null);
        when(row.getString("template_access_kind")).thenReturn("INTERNAL");
        when(row.getString("status")).thenReturn("DRAFT");
        when(row.getLong("version")).thenReturn(1L);
        return row;
    }

    private static ResultSet templateRow(UUID templateRef) throws Exception {
        ResultSet row = mock(ResultSet.class);
        when(row.getObject("template_ref", UUID.class)).thenReturn(templateRef);
        when(row.getObject("project_ref", UUID.class)).thenReturn(UUID.randomUUID());
        when(row.getString("template_name")).thenReturn("Template");
        when(row.getString("access_kind")).thenReturn("INTERNAL");
        when(row.getString("operator_kind")).thenReturn("PROJECT");
        when(row.getString("order_kind")).thenReturn("TAKEAWAY");
        when(row.getString("dine_in_form")).thenReturn(null);
        when(row.getString("provider_code")).thenReturn(null);
        when(row.getString("status")).thenReturn("ENABLED");
        when(row.getLong("version")).thenReturn(1L);
        return row;
    }

    private static BusinessChannelReadback.Channel channel(String channelCode) {
        return new BusinessChannelReadback.Channel(
                UUID.randomUUID(),
                UUID.randomUUID(),
                "PROJECT",
                UUID.randomUUID().toString(),
                channelCode,
                "Channel",
                null,
                "NOT_REQUIRED",
                "DRAFT",
                List.of(),
                1);
    }

    private static boolean hasRecordComponent(Class<?> type, String name) {
        return java.util.Arrays.stream(type.getRecordComponents())
                .anyMatch(component -> component.getName().equals(name));
    }
}
