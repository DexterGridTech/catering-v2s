package com.catering.v2s.salesmenu.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.platform.foundation.collection.OpaqueCollectionCursor;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.salesmenu.api.SalesMenuOwnerApi;
import com.catering.v2s.salesmenu.api.SalesMenuReadback;
import com.catering.v2s.salesmenu.domain.SalesMenuCursorIdentity;
import com.catering.v2s.salesmenu.domain.SalesMenuAggregate;
import com.catering.v2s.salesmenu.domain.SalesMenuListQuery;
import com.catering.v2s.salesmenu.domain.SalesMenuOperationQuery;
import com.catering.v2s.salesmenu.domain.SalesMenuPageRequest;
import com.catering.v2s.salesmenu.domain.SalesMenuSchedule;
import com.catering.v2s.salesmenu.domain.SalesMenuScope;
import com.catering.v2s.salesmenu.domain.SalesMenuTarget;
import com.catering.v2s.salesmenu.infrastructure.SalesMenuRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.RowMapper;

class SalesMenuOwnerServiceQueryTest {
    private static final UUID WORKSPACE = UUID.fromString("11111111-1111-4111-8111-111111111111");
    private static final UUID STORE = UUID.fromString("22222222-2222-4222-8222-222222222222");
    private static final UUID CHANNEL = UUID.fromString("33333333-3333-4333-8333-333333333333");
    private static final UUID TIE_BREAKER = UUID.fromString("44444444-4444-4444-8444-444444444444");
    private static final UUID MENU = UUID.fromString("77777777-7777-4777-8777-777777777777");

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void menuListUsesScopedKeysetLookaheadAndReturnsTheRequestCursor() {
        SalesMenuRepository repository = mock(SalesMenuRepository.class);
        when(repository.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenReturn(List.of());
        SalesMenuOwnerService service = new SalesMenuOwnerService(repository, fixedTime(), new ObjectMapper());
        SalesMenuScope scope = scope();

        var page = service.listMenus(
                new SalesMenuListQuery(scope, CHANNEL, "  wings  ", new SalesMenuPageRequest(null, 20)));

        assertTrue(page.items().isEmpty());
        assertNull(page.cursor());
        assertNull(page.nextCursor());
        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object[]> arguments = ArgumentCaptor.forClass(Object[].class);
        verify(repository).query(sql.capture(), any(RowMapper.class), arguments.capture());
        assertTrue(sql.getValue().contains("ORDER BY c.name,c.collection_ref LIMIT ?"));
        assertEquals(CHANNEL, arguments.getValue()[0]);
        assertEquals(WORKSPACE, arguments.getValue()[1]);
        assertEquals("group-1", arguments.getValue()[2]);
        assertEquals(STORE, arguments.getValue()[3]);
        assertEquals("%wings%", arguments.getValue()[4]);
        assertEquals(21, arguments.getValue()[5]);
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void menuReadbacksKeepAggregateCasVersionSeparateFromDraftRevision() throws Exception {
        SalesMenuRepository repository = mock(SalesMenuRepository.class);
        when(repository.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenAnswer(invocation -> {
                    RowMapper mapper = invocation.getArgument(1, RowMapper.class);
                    return List.of(mapper.mapRow(menuListResult(), 0));
                });

        var page = new SalesMenuOwnerService(repository, fixedTime(), new ObjectMapper())
                .listMenus(new SalesMenuListQuery(scope(), CHANNEL, "", new SalesMenuPageRequest(null, 20)));

        assertEquals(31L, page.items().getFirst().version());
        assertEquals(26L, page.items().getFirst().draftRevision());
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void menuDetailReadbackUsesTheAggregateCasVersion() throws Exception {
        SalesMenuRepository repository = mock(SalesMenuRepository.class);
        when(repository.find(any(SalesMenuTarget.class)))
                .thenReturn(Optional.of(menuWithVersions(31L, 26L)));
        when(repository.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenAnswer(invocation -> {
                    RowMapper mapper = invocation.getArgument(1, RowMapper.class);
                    return List.of(mapper.mapRow(activationResult(), 0));
                });

        var detail = new SalesMenuOwnerService(repository, fixedTime(), new ObjectMapper())
                .readMenu(new SalesMenuTarget(scope(), MENU), CHANNEL);

        assertEquals(31L, detail.version());
        assertEquals(26L, detail.draftRevision());
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void aCursorIsAcceptedOnlyForTheExactMenuListIdentity() {
        SalesMenuRepository repository = mock(SalesMenuRepository.class);
        when(repository.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenReturn(List.of());
        SalesMenuOwnerService service = new SalesMenuOwnerService(repository, fixedTime(), new ObjectMapper());
        SalesMenuScope scope = scope();
        SalesMenuPageRequest firstPage = new SalesMenuPageRequest(null, 20);
        SalesMenuCursorIdentity identity = new SalesMenuCursorIdentity(
                "getOperationsSalesMenus", scope, CHANNEL, null, null, null, "MANAGEMENT", "wings", 20);
        String cursor = OpaqueCollectionCursor.encode(identity.value(), "Wings", TIE_BREAKER);

        var page = service.listMenus(
                new SalesMenuListQuery(scope, CHANNEL, "wings", new SalesMenuPageRequest(cursor, 20)));

        assertEquals(cursor, page.cursor());
        verify(repository).query(anyString(), any(RowMapper.class), any(Object[].class));
    }

    @Test
    void aCursorFromAnotherScopeIsRejectedBeforeTheOwnerQuery() {
        SalesMenuRepository repository = mock(SalesMenuRepository.class);
        SalesMenuOwnerService service = new SalesMenuOwnerService(repository, fixedTime(), new ObjectMapper());
        SalesMenuScope scope = scope();
        SalesMenuCursorIdentity otherScopeIdentity = new SalesMenuCursorIdentity(
                "getOperationsSalesMenus",
                new SalesMenuScope(WORKSPACE, "other-group", STORE),
                CHANNEL,
                null,
                null,
                null,
                "MANAGEMENT",
                "wings",
                20);
        String cursor = OpaqueCollectionCursor.encode(otherScopeIdentity.value(), "Wings", TIE_BREAKER);

        SalesMenuOwnerApi.Problem problem = assertThrows(
                SalesMenuOwnerApi.Problem.class,
                () -> service.listMenus(
                        new SalesMenuListQuery(scope, CHANNEL, "wings", new SalesMenuPageRequest(cursor, 20))));

        assertEquals("VALIDATION_ERROR", problem.code());
        assertNotNull(problem.getCause());
        verifyNoInteractions(repository);
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void operationRecordsIncludeMenuWideAndSelectedChannelRecords() throws Exception {
        UUID channelA = UUID.fromString("55555555-5555-4555-8555-555555555555");
        UUID channelB = UUID.fromString("66666666-6666-4666-8666-666666666666");
        SalesMenuRepository repository = mock(SalesMenuRepository.class);
        AtomicReference<String> sql = new AtomicReference<>();
        List<UUID> requestedChannels = new ArrayList<>();
        when(repository.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenAnswer(invocation -> {
                    sql.set(invocation.getArgument(0, String.class));
                    RowMapper mapper = invocation.getArgument(1, RowMapper.class);
                    Object[] invocationArguments = invocation.getArguments();
                    Object[] arguments = invocationArguments.length == 3
                                    && invocationArguments[2] instanceof Object[] varargArguments
                            ? varargArguments
                            : Arrays.copyOfRange(invocationArguments, 2, invocationArguments.length);
                    requestedChannels.add((UUID) arguments[4]);
                    return List.of(
                            mapper.mapRow(operationResult("menu-wide"), 0),
                            mapper.mapRow(operationResult("channel-" + requestedChannels.getLast()), 1));
                });
        SalesMenuOwnerService service = new SalesMenuOwnerService(repository, fixedTime(), new ObjectMapper());

        var pageA = service.listOperationRecords(operationQuery(channelA));
        var pageB = service.listOperationRecords(operationQuery(channelB));

        assertEquals(List.of(channelA, channelB), requestedChannels);
        assertTrue(sql.get().contains("collection_ref=? AND (channel_ref IS NULL OR channel_ref=?)"));
        assertEquals(
                List.of("menu-wide", "channel-" + channelA),
                pageA.items().stream()
                        .map(SalesMenuReadback.OperationRecord::operationKind)
                        .toList());
        assertEquals(
                List.of("menu-wide", "channel-" + channelB),
                pageB.items().stream()
                        .map(SalesMenuReadback.OperationRecord::operationKind)
                        .toList());
    }

    private static SalesMenuOperationQuery operationQuery(UUID channel) {
        return new SalesMenuOperationQuery(
                new SalesMenuTarget(scope(), MENU), channel, new SalesMenuPageRequest(null, 20));
    }

    private static ResultSet operationResult(String operationKind) throws Exception {
        ResultSet result = mock(ResultSet.class);
        when(result.getObject("record_ref", UUID.class)).thenReturn(TIE_BREAKER);
        when(result.getLong("occurred_at_epoch_millis")).thenReturn(1_788_000_000_000L);
        when(result.getString("operation_kind")).thenReturn(operationKind);
        when(result.getObject("collection_ref", UUID.class)).thenReturn(MENU);
        when(result.getObject("target_ref", UUID.class)).thenReturn(MENU);
        when(result.getString("result")).thenReturn("SUCCESS");
        when(result.getString("failure_code")).thenReturn(null);
        when(result.getString("actor_display_snapshot")).thenReturn("operator");
        return result;
    }

    private static ResultSet menuListResult() throws Exception {
        ResultSet result = mock(ResultSet.class);
        when(result.getObject("collection_ref", UUID.class)).thenReturn(MENU);
        when(result.getObject("store_ref", UUID.class)).thenReturn(STORE);
        when(result.getString("name")).thenReturn("Menu");
        when(result.getObject("archived_at_epoch_millis", Long.class)).thenReturn(null);
        when(result.getLong("version")).thenReturn(31L);
        when(result.getLong("draft_revision")).thenReturn(26L);
        when(result.getObject("published_revision", Long.class)).thenReturn(null);
        when(result.getObject("latest_published_source_draft_revision", Long.class)).thenReturn(null);
        when(result.getString("schedule_kind")).thenReturn("ALL_DAY");
        when(result.getObject("channel_ref", UUID.class)).thenReturn(CHANNEL);
        when(result.getString("status")).thenReturn("ENABLED");
        when(result.getObject("activation_version", Long.class)).thenReturn(2L);
        return result;
    }

    private static ResultSet activationResult() throws Exception {
        ResultSet result = mock(ResultSet.class);
        when(result.getObject("channel_ref", UUID.class)).thenReturn(CHANNEL);
        when(result.getString("status")).thenReturn("ENABLED");
        when(result.getLong("version")).thenReturn(2L);
        return result;
    }

    private static SalesMenuAggregate menuWithVersions(long version, long draftRevision) {
        return new SalesMenuAggregate(
                MENU,
                scope(),
                "Menu",
                false,
                version,
                draftRevision,
                null,
                null,
                SalesMenuSchedule.allDay(),
                null);
    }

    private static SalesMenuScope scope() {
        return new SalesMenuScope(WORKSPACE, "group-1", STORE);
    }

    private static TimeProvider fixedTime() {
        return () -> 1_788_000_000_000L;
    }
}
