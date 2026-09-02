package com.catering.v2s.salesmenu.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.salesmenu.api.SalesMenuOwnerApi;
import com.catering.v2s.salesmenu.domain.SalesMenuAggregate;
import com.catering.v2s.salesmenu.domain.SalesMenuCommandReadbackStatus;
import com.catering.v2s.salesmenu.domain.SalesMenuItemPageQuery;
import com.catering.v2s.salesmenu.domain.SalesMenuItemQuery;
import com.catering.v2s.salesmenu.domain.SalesMenuItemTarget;
import com.catering.v2s.salesmenu.domain.SalesMenuPageRequest;
import com.catering.v2s.salesmenu.domain.SalesMenuSchedule;
import com.catering.v2s.salesmenu.domain.SalesMenuScope;
import com.catering.v2s.salesmenu.domain.SalesMenuTarget;
import com.catering.v2s.salesmenu.domain.SalesMenuVersionKind;
import com.catering.v2s.salesmenu.infrastructure.SalesMenuRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.RowMapper;

class SalesMenuOwnerServiceReadModelTest {
    private static final UUID WORKSPACE = UUID.fromString("11111111-1111-4111-8111-111111111111");
    private static final UUID STORE = UUID.fromString("22222222-2222-4222-8222-222222222222");
    private static final UUID MENU = UUID.fromString("33333333-3333-4333-8333-333333333333");
    private static final UUID SECTION = UUID.fromString("44444444-4444-4444-8444-444444444444");
    private static final UUID ITEM_ONE = UUID.fromString("55555555-5555-4555-8555-555555555555");
    private static final UUID ITEM_TWO = UUID.fromString("66666666-6666-4666-8666-666666666666");
    private static final UUID DRAFT = UUID.fromString("77777777-7777-4777-8777-777777777777");
    private static final UUID PUBLISHED = UUID.fromString("88888888-8888-4888-8888-888888888888");
    private static final UUID ASSET_ONE = UUID.fromString("99999999-9999-4999-8999-999999999999");
    private static final UUID ASSET_TWO = UUID.fromString("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void draftItemPageReadsMediaForAllRowsWithOneOwnerSetQuery() throws Exception {
        SalesMenuRepository repository = mock(SalesMenuRepository.class);
        AtomicInteger mediaQueries = new AtomicInteger();
        when(repository.find(any(SalesMenuTarget.class))).thenReturn(Optional.of(menu(null)));
        when(repository.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    RowMapper mapper = invocation.getArgument(1, RowMapper.class);
                    if (sql.contains("current_draft_version_ref")) return List.of(mapper.mapRow(uuidResult(DRAFT), 0));
                    if (sql.contains("FROM sales_menu.sales_version_item v")) {
                        return List.of(
                                mapper.mapRow(itemResult(DRAFT, ITEM_ONE, 0), 0),
                                mapper.mapRow(itemResult(DRAFT, ITEM_TWO, 1), 1));
                    }
                    if (sql.contains("sales_version_item_media")) {
                        mediaQueries.incrementAndGet();
                        return List.of(
                                mapper.mapRow(mediaResult(ITEM_ONE, ASSET_ONE, 0), 0),
                                mapper.mapRow(mediaResult(ITEM_TWO, ASSET_TWO, 0), 1));
                    }
                    throw new AssertionError("unexpected query: " + sql);
                });

        var page = service(repository)
                .listDraftItems(new SalesMenuItemPageQuery(
                        new SalesMenuTarget(scope(), MENU),
                        SalesMenuVersionKind.DRAFT,
                        SECTION,
                        null,
                        new SalesMenuPageRequest(null, 20)));

        assertEquals(List.of(ASSET_ONE), page.items().get(0).displayMedia().assetRefs());
        assertEquals(List.of(ASSET_TWO), page.items().get(1).displayMedia().assetRefs());
        assertEquals(1, mediaQueries.get());
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void publishedItemPageReadsMediaAndManualStatusAsOneSetEach() throws Exception {
        SalesMenuRepository repository = mock(SalesMenuRepository.class);
        AtomicInteger mediaQueries = new AtomicInteger();
        AtomicInteger manualQueries = new AtomicInteger();
        when(repository.find(any(SalesMenuTarget.class))).thenReturn(Optional.of(menu(0L)));
        when(repository.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    RowMapper mapper = invocation.getArgument(1, RowMapper.class);
                    if (sql.contains("sales_command_receipt")) return List.of();
                    if (sql.contains("latest_published_version_ref"))
                        return List.of(mapper.mapRow(uuidResult(PUBLISHED), 0));
                    if (sql.contains("FROM sales_menu.sales_version_item v")) {
                        return List.of(
                                mapper.mapRow(itemResult(PUBLISHED, ITEM_ONE, 0), 0),
                                mapper.mapRow(itemResult(PUBLISHED, ITEM_TWO, 1), 1));
                    }
                    if (sql.contains("sales_version_item_media")) {
                        mediaQueries.incrementAndGet();
                        return List.of(mapper.mapRow(mediaResult(ITEM_ONE, ASSET_ONE, 0), 0));
                    }
                    if (sql.contains("sales_manual_status_current")) {
                        manualQueries.incrementAndGet();
                        return List.of(mapper.mapRow(manualResult(ITEM_ONE), 0));
                    }
                    throw new AssertionError("unexpected query: " + sql);
                });

        var page = service(repository)
                .listPublishedItems(new SalesMenuItemPageQuery(
                        new SalesMenuTarget(scope(), MENU),
                        SalesMenuVersionKind.PUBLISHED,
                        SECTION,
                        UUID.fromString("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
                        new SalesMenuPageRequest(null, 20)));

        assertEquals(List.of(ASSET_ONE), page.items().get(0).displayMedia().assetRefs());
        assertEquals(List.of(), page.items().get(1).displayMedia().assetRefs());
        assertEquals(1, mediaQueries.get());
        assertEquals(1, manualQueries.get());
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void draftItemDetailUsesASelectiveItemQuery() throws Exception {
        SalesMenuRepository repository = mock(SalesMenuRepository.class);
        when(repository.find(any(SalesMenuTarget.class))).thenReturn(Optional.of(menu(null)));
        when(repository.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    RowMapper mapper = invocation.getArgument(1, RowMapper.class);
                    if (sql.contains("current_draft_version_ref")) return List.of(mapper.mapRow(uuidResult(DRAFT), 0));
                    if (sql.contains("FROM sales_menu.sales_version_item v"))
                        return List.of(mapper.mapRow(itemResult(DRAFT, ITEM_TWO, 1), 0));
                    if (sql.contains("sales_version_item_media")) return List.of();
                    throw new AssertionError("unexpected query: " + sql);
                });

        service(repository)
                .readDraftItem(new SalesMenuItemQuery(
                        new SalesMenuItemTarget(new SalesMenuTarget(scope(), MENU), ITEM_TWO),
                        SalesMenuVersionKind.DRAFT,
                        null));

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object[]> arguments = ArgumentCaptor.forClass(Object[].class);
        verify(repository, times(3)).query(sql.capture(), any(RowMapper.class), arguments.capture());
        int itemQuery = sql.getAllValues().stream()
                .mapToInt(value -> value.contains("FROM sales_menu.sales_version_item v") ? 1 : 0)
                .sum();
        assertEquals(1, itemQuery);
        int itemQueryIndex = 0;
        while (!sql.getAllValues().get(itemQueryIndex).contains("FROM sales_menu.sales_version_item v"))
            itemQueryIndex++;
        assertTrue(sql.getAllValues().get(itemQueryIndex).contains("WHERE v.version_ref=? AND v.sales_item_ref=?"));
        assertEquals(ITEM_TWO, arguments.getAllValues().get(itemQueryIndex)[1]);
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void publishedItemDetailUsesASelectiveItemQuery() throws Exception {
        SalesMenuRepository repository = mock(SalesMenuRepository.class);
        UUID channel = UUID.fromString("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
        when(repository.find(any(SalesMenuTarget.class))).thenReturn(Optional.of(menu(0L)));
        when(repository.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    RowMapper mapper = invocation.getArgument(1, RowMapper.class);
                    if (sql.contains("sales_command_receipt")) return List.of();
                    if (sql.contains("latest_published_version_ref"))
                        return List.of(mapper.mapRow(uuidResult(PUBLISHED), 0));
                    if (sql.contains("FROM sales_menu.sales_version_item v"))
                        return List.of(mapper.mapRow(itemResult(PUBLISHED, ITEM_TWO, 1), 0));
                    if (sql.contains("sales_version_item_media")) return List.of();
                    if (sql.contains("sales_manual_status_current")) return List.of();
                    throw new AssertionError("unexpected query: " + sql);
                });

        service(repository)
                .readPublishedItem(new SalesMenuItemQuery(
                        new SalesMenuItemTarget(new SalesMenuTarget(scope(), MENU), ITEM_TWO),
                        SalesMenuVersionKind.PUBLISHED,
                        channel));

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object[]> arguments = ArgumentCaptor.forClass(Object[].class);
        verify(repository, times(4)).query(sql.capture(), any(RowMapper.class), arguments.capture());
        int itemQueryIndex = 0;
        while (!sql.getAllValues().get(itemQueryIndex).contains("FROM sales_menu.sales_version_item v"))
            itemQueryIndex++;
        assertTrue(sql.getAllValues().get(itemQueryIndex).contains("WHERE v.version_ref=? AND v.sales_item_ref=?"));
        assertEquals(ITEM_TWO, arguments.getAllValues().get(itemQueryIndex)[1]);
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void manualStatusTargetsPublishedMembershipAfterDraftRemoval() throws Exception {
        SalesMenuRepository repository = mock(SalesMenuRepository.class);
        when(repository.findForUpdate(any(SalesMenuTarget.class))).thenReturn(Optional.of(menu(0L)));
        when(repository.find(any(SalesMenuTarget.class))).thenReturn(Optional.of(menu(1L)));
        when(repository.update(anyString(), any(Object[].class))).thenReturn(1);
        when(repository.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    RowMapper mapper = invocation.getArgument(1, RowMapper.class);
                    if (sql.contains("sales_command_receipt")) return List.of();
                    if (sql.contains("latest_published_version_ref"))
                        return List.of(mapper.mapRow(uuidResult(PUBLISHED), 0));
                    if (sql.contains("WHERE version_ref=? AND sales_item_ref=?")) {
                        ResultSet result = mock(ResultSet.class);
                        when(result.getBoolean(1)).thenReturn(true);
                        return List.of(mapper.mapRow(result, 0));
                    }
                    throw new AssertionError("unexpected query: " + sql);
                });

        var command = new SalesMenuOwnerApi.ManualSoldOutCommand(
                commandContext(), UUID.fromString("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"), ITEM_TWO, "temporary", 1L);

        assertEquals(
                SalesMenuCommandReadbackStatus.APPLIED,
                service(repository).setManualSoldOut(command).readbackStatus());

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object[]> arguments = ArgumentCaptor.forClass(Object[].class);
        verify(repository, times(3)).query(sql.capture(), any(RowMapper.class), arguments.capture());
        int publishedVersionQuery = 0;
        int itemQueryIndex = -1;
        int receiptQuery = 0;
        for (int index = 0; index < sql.getAllValues().size(); index++) {
            String statement = sql.getAllValues().get(index);
            if (statement.contains("latest_published_version_ref")) publishedVersionQuery++;
            if (statement.contains("WHERE version_ref=? AND sales_item_ref=?")) itemQueryIndex = index;
            if (statement.contains("sales_command_receipt")) receiptQuery++;
        }
        assertEquals(1, publishedVersionQuery);
        assertTrue(itemQueryIndex >= 0);
        assertEquals(1, receiptQuery);
        assertEquals(PUBLISHED, arguments.getAllValues().get(itemQueryIndex)[0]);
        assertEquals(ITEM_TWO, arguments.getAllValues().get(itemQueryIndex)[1]);
    }

    private static SalesMenuOwnerService service(SalesMenuRepository repository) {
        TimeProvider time = () -> 1_788_000_000_000L;
        return new SalesMenuOwnerService(repository, time, new ObjectMapper());
    }

    private static SalesMenuScope scope() {
        return new SalesMenuScope(WORKSPACE, "group-1", STORE);
    }

    private static SalesMenuOwnerApi.CommandContext commandContext() {
        return new SalesMenuOwnerApi.CommandContext(
                scope(),
                MENU,
                new OperationsOwnerScopeGrant(
                        WORKSPACE,
                        "group-1",
                        "OWNER_RECHECK_SALES_MENU",
                        "EDIT_STORE_SALES_MENU",
                        "STORE",
                        STORE,
                        "STORE",
                        STORE,
                        List.of()),
                1L,
                AuditActor.system(),
                "manual-status-test");
    }

    private static SalesMenuAggregate menu(Long publishedRevision) {
        return new SalesMenuAggregate(
                MENU,
                scope(),
                "Menu",
                false,
                1,
                0,
                publishedRevision,
                publishedRevision == null ? null : 0L,
                SalesMenuSchedule.allDay(),
                publishedRevision == null ? null : SalesMenuSchedule.allDay());
    }

    private static ResultSet uuidResult(UUID value) throws Exception {
        ResultSet result = mock(ResultSet.class);
        when(result.getObject(1, UUID.class)).thenReturn(value);
        return result;
    }

    private static ResultSet itemResult(UUID version, UUID item, long order) throws Exception {
        ResultSet result = mock(ResultSet.class);
        when(result.getObject("version_ref", UUID.class)).thenReturn(version);
        when(result.getObject("sales_item_ref", UUID.class)).thenReturn(item);
        when(result.getObject("catalog_item_ref", UUID.class)).thenReturn(UUID.randomUUID());
        when(result.getObject("section_ref", UUID.class)).thenReturn(SECTION);
        when(result.getLong("display_order")).thenReturn(order);
        when(result.getLong("version")).thenReturn(1L);
        when(result.getString("display_name_override")).thenReturn(null);
        when(result.getString("resolved_item_name")).thenReturn("Item " + order);
        when(result.getString("resolved_item_code")).thenReturn("ITEM-" + order);
        when(result.getString("resolved_product_shape")).thenReturn("DIRECT");
        when(result.getObject("listed_price_cents", Long.class)).thenReturn(100L);
        when(result.getString("ordering_constraints_json")).thenReturn("{\"minItemQuantity\":1,\"quantityStep\":1}");
        when(result.getString("display_media_mode")).thenReturn("CUSTOM");
        when(result.getBoolean("can_move_up")).thenReturn(order > 0);
        when(result.getBoolean("can_move_down")).thenReturn(order == 0);
        return result;
    }

    private static ResultSet mediaResult(UUID item, UUID asset, long order) throws Exception {
        ResultSet result = mock(ResultSet.class);
        when(result.getObject("sales_item_ref", UUID.class)).thenReturn(item);
        when(result.getObject("asset_ref", UUID.class)).thenReturn(asset);
        when(result.getLong("display_order")).thenReturn(order);
        return result;
    }

    private static ResultSet manualResult(UUID item) throws Exception {
        ResultSet result = mock(ResultSet.class);
        when(result.getObject("sales_item_ref", UUID.class)).thenReturn(item);
        when(result.getString("state")).thenReturn("MANUAL_SOLD_OUT");
        when(result.getString("reason")).thenReturn("temporary");
        when(result.getObject("changed_at_epoch_millis", Long.class)).thenReturn(1_788_000_000_000L);
        when(result.getString("actor_display_snapshot")).thenReturn("operator");
        return result;
    }
}
