package com.catering.v2s.salesmenu.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.businesschannel.api.BusinessChannelOwnerApi;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.OrganizationOwnerApi;
import com.catering.v2s.platform.asset.api.SalesMenuAssetReadApi;
import com.catering.v2s.platform.asset.api.SalesMenuAssetUsage;
import com.catering.v2s.salesmenu.api.SalesMenuAssetCommandApi;
import com.catering.v2s.salesmenu.api.SalesMenuOwnerApi;
import com.catering.v2s.salesmenu.domain.SalesMenuAggregate;
import com.catering.v2s.salesmenu.domain.SalesMenuAssetTarget;
import com.catering.v2s.salesmenu.domain.SalesMenuCommandReadbackStatus;
import com.catering.v2s.salesmenu.domain.SalesMenuDisplayMediaMode;
import com.catering.v2s.salesmenu.domain.SalesMenuItemPageQuery;
import com.catering.v2s.salesmenu.domain.SalesMenuItemQuery;
import com.catering.v2s.salesmenu.domain.SalesMenuItemTarget;
import com.catering.v2s.salesmenu.domain.SalesMenuMoveDirection;
import com.catering.v2s.salesmenu.domain.SalesMenuPageRequest;
import com.catering.v2s.salesmenu.domain.SalesMenuSaleContentInput;
import com.catering.v2s.salesmenu.domain.SalesMenuSaleContentKind;
import com.catering.v2s.salesmenu.domain.SalesMenuSchedule;
import com.catering.v2s.salesmenu.domain.SalesMenuScope;
import com.catering.v2s.salesmenu.domain.SalesMenuSkuPrice;
import com.catering.v2s.salesmenu.domain.SalesMenuTarget;
import com.catering.v2s.salesmenu.domain.SalesMenuVersionKind;
import com.catering.v2s.salesmenu.infrastructure.SalesMenuRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.springframework.jdbc.core.RowMapper;

class SalesMenuOwnerServiceOwnerApiTest {
    private static final UUID WORKSPACE = UUID.fromString("11111111-1111-4111-8111-111111111111");
    private static final UUID STORE = UUID.fromString("22222222-2222-4222-8222-222222222222");
    private static final UUID CHANNEL = UUID.fromString("33333333-3333-4333-8333-333333333333");
    private static final UUID MENU = UUID.fromString("44444444-4444-4444-8444-444444444444");
    private static final UUID SECTION = UUID.fromString("55555555-5555-4555-8555-555555555555");
    private static final UUID SALES_ITEM = UUID.fromString("66666666-6666-4666-8666-666666666666");
    private static final UUID CATALOG_ITEM = UUID.fromString("77777777-7777-4777-8777-777777777777");
    private static final UUID SKU = UUID.fromString("88888888-8888-4888-8888-888888888888");
    private static final UUID ASSET = UUID.fromString("99999999-9999-4999-8999-999999999999");
    private static final UUID DRAFT = UUID.fromString("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    private static final UUID PUBLISHED = UUID.fromString("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    private static final UUID ORDER_OPTION_DEFINITION = UUID.fromString("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    private static final UUID ORDER_OPTION_VALUE = UUID.fromString("dddddddd-dddd-4ddd-8ddd-dddddddddddd");

    private record UpdateCall(String sql, Object[] arguments) {}

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void draftSkuReadUsesCatalogFactsAndOneAssetSetReadButReturnsPersistedPrice() throws Exception {
        SalesMenuRepository repository = mock(SalesMenuRepository.class);
        CatalogOwnerApi catalog = mock(CatalogOwnerApi.class);
        InventoryOwnerApi inventory = mock(InventoryOwnerApi.class);
        BusinessChannelOwnerApi channels = mock(BusinessChannelOwnerApi.class);
        OrganizationOwnerApi organization = mock(OrganizationOwnerApi.class);
        SalesMenuAssetReadApi assets = mock(SalesMenuAssetReadApi.class);
        when(repository.find(any(SalesMenuTarget.class))).thenReturn(Optional.of(menu(null)));
        when(organization.requireSalesMenuStore(WORKSPACE, "group-1", STORE))
                .thenReturn(new OrganizationOwnerApi.SalesMenuStoreJudgment(STORE, "ENABLED", null, "node", "brand"));
        when(catalog.readSalesMenuItemFacts(anyString(), anyString(), anySet()))
                .thenReturn(Map.of(CATALOG_ITEM, catalogFacts()));
        when(assets.readSalesMenuItemImages(anySet()))
                .thenReturn(Map.of(
                        ASSET,
                        new SalesMenuAssetReadApi.SalesMenuItemImage(
                                ASSET,
                                new SalesMenuAssetReadApi.PublicReference("https://asset", "image/png", "digest"),
                                SalesMenuAssetUsage.SALES_MENU_ITEM_IMAGE,
                                "ACTIVE",
                                1,
                                100)));
        when(repository.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    RowMapper mapper = invocation.getArgument(1, RowMapper.class);
                    if (sql.contains("sales_command_receipt")) return List.of();
                    if (sql.contains("current_draft_version_ref")) return List.of(mapper.mapRow(uuidResult(DRAFT), 0));
                    if (sql.contains("FROM sales_menu.sales_version_item v"))
                        return List.of(
                                mapper.mapRow(itemResult(DRAFT, 1, "SKU_VARIANT_SALE_COUNTED", null, "CUSTOM"), 0));
                    if (sql.contains("sales_version_item_media")) return List.of(mapper.mapRow(mediaResult(), 0));
                    if (sql.contains("sales_version_item_sku")) return List.of(mapper.mapRow(skuResult(), 0));
                    if (sql.contains("sales_version_item_order_option")) return List.of();
                    throw new AssertionError("unexpected query: " + sql);
                });

        var result = service(repository, catalog, inventory, channels, organization, assets)
                .readDraftItem(new SalesMenuItemQuery(
                        new SalesMenuItemTarget(new SalesMenuTarget(scope(), MENU), SALES_ITEM),
                        SalesMenuVersionKind.DRAFT,
                        null));

        assertEquals("SKU", result.productShape());
        assertEquals("SKU_SELECTION", result.saleContent().kind().name());
        assertEquals(null, result.saleContent().listedPriceCents());
        assertEquals(155L, result.saleContent().skuPrices().getFirst().listedPriceCents());
        assertEquals(120L, result.saleContent().skuPrices().getFirst().standardPriceCents());
        assertEquals(ASSET, result.catalogPrimaryImageAssetRef());
        assertTrue(result.catalogOrderOptions().isEmpty());
        verify(catalog).readSalesMenuItemFacts("node", "brand", Set.of(CATALOG_ITEM));
        verify(assets).readSalesMenuItemImages(Set.of(ASSET));
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void publishedReadUsesOneTypedInventorySetReadAndOneManualSetRead() throws Exception {
        SalesMenuRepository repository = mock(SalesMenuRepository.class);
        CatalogOwnerApi catalog = mock(CatalogOwnerApi.class);
        InventoryOwnerApi inventory = mock(InventoryOwnerApi.class);
        BusinessChannelOwnerApi channels = mock(BusinessChannelOwnerApi.class);
        OrganizationOwnerApi organization = mock(OrganizationOwnerApi.class);
        when(repository.find(any(SalesMenuTarget.class))).thenReturn(Optional.of(menu(0L)));
        when(organization.requireSalesMenuStore(WORKSPACE, "group-1", STORE))
                .thenReturn(new OrganizationOwnerApi.SalesMenuStoreJudgment(STORE, "ENABLED", null, "node", "brand"));
        when(channels.requireSalesMenuChannel(WORKSPACE, "group-1", STORE.toString(), CHANNEL))
                .thenReturn(new BusinessChannelOwnerApi.SalesMenuChannelJudgment(
                        CHANNEL,
                        UUID.randomUUID(),
                        STORE.toString(),
                        "INTERNAL",
                        "STORE",
                        "DINE_IN",
                        "NOT_APPLICABLE",
                        "ENABLED",
                        1));
        when(inventory.readSalesMenuAvailability(anyString(), anyString(), anySet()))
                .thenReturn(List.of(InventoryOwnerApi.InventoryAvailabilityFact.available(
                        new InventoryOwnerApi.InventoryTargetRef(CATALOG_ITEM, null), UUID.randomUUID())));
        when(repository.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    RowMapper mapper = invocation.getArgument(1, RowMapper.class);
                    if (sql.contains("latest_published_version_ref"))
                        return List.of(mapper.mapRow(uuidResult(PUBLISHED), 0));
                    if (sql.contains("FROM sales_menu.sales_version_item v"))
                        return List.of(mapper.mapRow(
                                itemResult(PUBLISHED, 1, "STANDARD_SALE_COUNTED", 100L, "INHERIT_CATALOG"), 0));
                    if (sql.contains("sales_version_item_sku")) return List.of();
                    if (sql.contains("sales_version_item_media")) return List.of();
                    if (sql.contains("sales_version_item_order_option")) return List.of();
                    if (sql.contains("sales_manual_status_current")) return List.of();
                    throw new AssertionError("unexpected query: " + sql);
                });

        var result = service(repository, catalog, inventory, channels, organization, null)
                .listPublishedItems(new SalesMenuItemPageQuery(
                        new SalesMenuTarget(scope(), MENU),
                        SalesMenuVersionKind.PUBLISHED,
                        SECTION,
                        CHANNEL,
                        new SalesMenuPageRequest(null, 20)));

        assertEquals(
                "AVAILABLE", result.items().getFirst().inventoryAvailability().state());
        verify(inventory)
                .readSalesMenuAvailability(
                        "node", "brand", Set.of(new InventoryOwnerApi.InventoryTargetRef(CATALOG_ITEM, null)));
        verify(repository)
                .query(
                        ArgumentMatchers.contains("sales_manual_status_current"),
                        any(RowMapper.class),
                        any(Object[].class));
        verifyNoInteractions(catalog);
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void disabledStoreBlocksPublishBeforeCollectionCas() {
        SalesMenuRepository repository = mock(SalesMenuRepository.class);
        CatalogOwnerApi catalog = mock(CatalogOwnerApi.class);
        InventoryOwnerApi inventory = mock(InventoryOwnerApi.class);
        BusinessChannelOwnerApi channels = mock(BusinessChannelOwnerApi.class);
        OrganizationOwnerApi organization = mock(OrganizationOwnerApi.class);
        when(repository.findForUpdate(any(SalesMenuTarget.class))).thenReturn(Optional.of(menu(null)));
        when(repository.find(any(SalesMenuTarget.class))).thenReturn(Optional.of(menu(null)));
        when(repository.update(anyString(), any(Object[].class))).thenReturn(1);
        when(organization.requireSalesMenuStore(WORKSPACE, "group-1", STORE))
                .thenReturn(new OrganizationOwnerApi.SalesMenuStoreJudgment(STORE, "DISABLED", null, "node", "brand"));
        when(repository.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    RowMapper mapper = invocation.getArgument(1, RowMapper.class);
                    if (sql.contains("sales_command_receipt")) return List.of();
                    if (sql.contains("current_draft_version_ref")) return List.of(mapper.mapRow(uuidResult(DRAFT), 0));
                    if (sql.contains("sales_collection_activation")) return List.of();
                    if (sql.contains("FROM sales_menu.sales_version_item v")) return List.of();
                    throw new AssertionError("unexpected query: " + sql);
                });

        SalesMenuOwnerApi.Problem failure = assertThrows(SalesMenuOwnerApi.Problem.class, () -> service(
                        repository, catalog, inventory, channels, organization, null)
                .publish(new SalesMenuOwnerApi.PublishCommand(commandContext(), 1)));

        assertEquals("SALES_MENU_STORE_DISABLED", failure.code());
        verify(repository, never()).compareAndSetVersion(any(SalesMenuTarget.class), anyLong());
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void ownerRecheckFailsBeforeReceiptWrite() {
        SalesMenuRepository repository = mock(SalesMenuRepository.class);
        CatalogOwnerApi catalog = mock(CatalogOwnerApi.class);
        InventoryOwnerApi inventory = mock(InventoryOwnerApi.class);
        BusinessChannelOwnerApi channels = mock(BusinessChannelOwnerApi.class);
        OrganizationOwnerApi organization = mock(OrganizationOwnerApi.class);
        when(repository.findForUpdate(any(SalesMenuTarget.class))).thenReturn(Optional.of(menu(null)));
        when(repository.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenAnswer(invocation -> List.of());
        when(organization.requireSalesMenuStore(WORKSPACE, "group-1", STORE))
                .thenThrow(new SalesMenuOwnerApi.Problem("STORE_SCOPE_DENIED", 403, "门店范围无效"));

        SalesMenuOwnerApi.Problem failure = assertThrows(SalesMenuOwnerApi.Problem.class, () -> service(
                        repository, catalog, inventory, channels, organization, null)
                .rename(new SalesMenuOwnerApi.RenameCommand(commandContext(), 1, "Renamed")));

        assertEquals("STORE_SCOPE_DENIED", failure.code());
        verify(repository, never()).update(ArgumentMatchers.contains("sales_command_receipt"), any(Object[].class));
    }

    @Test
    void ineligibleChannelRejectionUsesStoreTargetProofBeforeRecording() {
        SalesMenuRepository repository = mock(SalesMenuRepository.class);
        CatalogOwnerApi catalog = mock(CatalogOwnerApi.class);
        InventoryOwnerApi inventory = mock(InventoryOwnerApi.class);
        BusinessChannelOwnerApi channels = mock(BusinessChannelOwnerApi.class);
        OrganizationOwnerApi organization = mock(OrganizationOwnerApi.class);
        when(repository.find(any(SalesMenuTarget.class))).thenReturn(Optional.of(menu(null)));
        when(repository.update(anyString(), any(Object[].class))).thenReturn(1);
        when(organization.requireSalesMenuStore(WORKSPACE, "group-1", STORE))
                .thenReturn(new OrganizationOwnerApi.SalesMenuStoreJudgment(STORE, "ENABLED", null, "node", "brand"));
        when(channels.salesMenuChannelBelongsToStore(WORKSPACE, "group-1", STORE.toString(), CHANNEL))
                .thenReturn(true);

        var result = service(repository, catalog, inventory, channels, organization, null)
                .recordRejectedOperation(new SalesMenuOwnerApi.RejectedOperationCommand(
                        commandContext(),
                        "setOperationsSalesMenuActivation",
                        MENU,
                        "SALES_MENU_CHANNEL_INELIGIBLE",
                        CHANNEL));

        assertEquals("FAILED", result.result().name());
        verify(channels).salesMenuChannelBelongsToStore(WORKSPACE, "group-1", STORE.toString(), CHANNEL);
        verify(channels, never()).requireSalesMenuChannel(any(), anyString(), anyString(), any());
        verify(repository).update(ArgumentMatchers.contains("sales_operation_record"), any(Object[].class));
    }

    @Test
    void commandReceiptIsWrittenOnlyAfterOwnerCasAndBusinessRecord() {
        SalesMenuRepository repository = mock(SalesMenuRepository.class);
        CatalogOwnerApi catalog = mock(CatalogOwnerApi.class);
        InventoryOwnerApi inventory = mock(InventoryOwnerApi.class);
        BusinessChannelOwnerApi channels = mock(BusinessChannelOwnerApi.class);
        OrganizationOwnerApi organization = mock(OrganizationOwnerApi.class);
        when(repository.findForUpdate(any(SalesMenuTarget.class))).thenReturn(Optional.of(menu(null)));
        when(repository.find(any(SalesMenuTarget.class))).thenReturn(Optional.of(menu(7L, null)));
        when(repository.update(anyString(), any(Object[].class))).thenReturn(1);
        when(repository.compareAndSetVersion(any(SalesMenuTarget.class), anyLong()))
                .thenReturn(true);
        when(organization.requireSalesMenuStore(WORKSPACE, "group-1", STORE))
                .thenReturn(new OrganizationOwnerApi.SalesMenuStoreJudgment(STORE, "ENABLED", null, "node", "brand"));
        when(repository.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenReturn(List.of());

        var result = service(repository, catalog, inventory, channels, organization, null)
                .rename(new SalesMenuOwnerApi.RenameCommand(commandContext(), 1, "Renamed"));

        assertEquals(7L, result.version(), "command readback must come from the persisted owner fact");

        var order = inOrder(repository);
        order.verify(repository).lockCommandReceipt(WORKSPACE, "renameOperationsSalesMenu", "publish-store-disabled");
        order.verify(repository).findForUpdate(any(SalesMenuTarget.class));
        order.verify(repository)
                .query(ArgumentMatchers.contains("sales_command_receipt"), any(RowMapper.class), any(Object[].class));
        order.verify(repository).compareAndSetVersion(commandContext().target(), 1L);
        order.verify(repository)
                .update(ArgumentMatchers.contains("UPDATE sales_menu.sales_collection SET name"), any(Object[].class));
        order.verify(repository).update(ArgumentMatchers.contains("sales_operation_record"), any(Object[].class));
        order.verify(repository).update(ArgumentMatchers.contains("sales_command_receipt"), any(Object[].class));
        verify(repository, never()).update(ArgumentMatchers.contains("IN_PROGRESS"), any(Object[].class));
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void draftScheduleMutationAdvancesDraftRevisionAfterCollectionCas() {
        SalesMenuRepository repository = mock(SalesMenuRepository.class);
        CatalogOwnerApi catalog = mock(CatalogOwnerApi.class);
        InventoryOwnerApi inventory = mock(InventoryOwnerApi.class);
        BusinessChannelOwnerApi channels = mock(BusinessChannelOwnerApi.class);
        OrganizationOwnerApi organization = mock(OrganizationOwnerApi.class);
        List<UpdateCall> writes = new ArrayList<>();
        when(repository.findForUpdate(any(SalesMenuTarget.class))).thenReturn(Optional.of(menu(null)));
        when(repository.find(any(SalesMenuTarget.class))).thenReturn(Optional.of(menu(2L, null)));
        when(repository.update(anyString(), any(Object[].class))).thenAnswer(invocation -> {
            Object[] invocationArguments = invocation.getArguments();
            writes.add(new UpdateCall(
                    invocation.getArgument(0, String.class),
                    Arrays.copyOfRange(invocationArguments, 1, invocationArguments.length)));
            return 1;
        });
        when(repository.compareAndSetVersion(any(SalesMenuTarget.class), anyLong()))
                .thenReturn(true);
        when(organization.requireSalesMenuStore(WORKSPACE, "group-1", STORE))
                .thenReturn(new OrganizationOwnerApi.SalesMenuStoreJudgment(STORE, "ENABLED", null, "node", "brand"));
        when(repository.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    RowMapper mapper = invocation.getArgument(1, RowMapper.class);
                    if (sql.contains("sales_command_receipt")) return List.of();
                    if (sql.contains("current_draft_version_ref")) {
                        return List.of(mapper.mapRow(uuidResult(DRAFT), 0));
                    }
                    throw new AssertionError("unexpected query: " + sql);
                });

        var result = service(repository, catalog, inventory, channels, organization, null)
                .updateSchedule(new SalesMenuOwnerApi.ScheduleCommand(
                        commandContext(),
                        SalesMenuSchedule.daily(java.time.LocalTime.of(11, 0), java.time.LocalTime.of(14, 0)),
                        1));

        assertEquals(SalesMenuCommandReadbackStatus.APPLIED, result.readbackStatus());
        UpdateCall revisionUpdate = writes.stream()
                .filter(write -> write.sql().contains("sales_collection_version SET revision=revision+1"))
                .findFirst()
                .orElseThrow();
        assertEquals(DRAFT, revisionUpdate.arguments()[0]);
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void disabledMenuActivationDoesNotBlockPublish() {
        SalesMenuRepository repository = mock(SalesMenuRepository.class);
        CatalogOwnerApi catalog = mock(CatalogOwnerApi.class);
        InventoryOwnerApi inventory = mock(InventoryOwnerApi.class);
        BusinessChannelOwnerApi channels = mock(BusinessChannelOwnerApi.class);
        OrganizationOwnerApi organization = mock(OrganizationOwnerApi.class);
        when(repository.findForUpdate(any(SalesMenuTarget.class))).thenReturn(Optional.of(menu(null)));
        when(repository.find(any(SalesMenuTarget.class))).thenReturn(Optional.of(menu(null)));
        when(repository.update(anyString(), any(Object[].class))).thenReturn(1);
        when(repository.compareAndSetVersion(any(SalesMenuTarget.class), anyLong()))
                .thenReturn(true);
        when(organization.requireSalesMenuStore(WORKSPACE, "group-1", STORE))
                .thenReturn(new OrganizationOwnerApi.SalesMenuStoreJudgment(STORE, "ENABLED", null, "node", "brand"));
        when(repository.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    RowMapper mapper = invocation.getArgument(1, RowMapper.class);
                    if (sql.contains("sales_command_receipt")) return List.of();
                    if (sql.contains("current_draft_version_ref")) {
                        return List.of(mapper.mapRow(uuidResult(DRAFT), 0));
                    }
                    if (sql.contains("sales_collection_activation")) {
                        assertTrue(sql.contains("status='ENABLED'"));
                        return List.of();
                    }
                    if (sql.contains("FROM sales_menu.sales_version_item v")) return List.of();
                    throw new AssertionError("unexpected query: " + sql);
                });

        var result = service(repository, catalog, inventory, channels, organization, null)
                .publish(new SalesMenuOwnerApi.PublishCommand(commandContext(), 1));

        assertEquals(SalesMenuCommandReadbackStatus.PUBLISHED, result.readbackStatus());
        verify(channels, never()).requireSalesMenuChannel(any(), any(), any(), any());
        verify(repository).compareAndSetVersion(commandContext().target(), 1L);
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void publishUsesMonotonicPublicationRevisionAndCurrentDraftRevision() {
        SalesMenuRepository repository = mock(SalesMenuRepository.class);
        CatalogOwnerApi catalog = mock(CatalogOwnerApi.class);
        InventoryOwnerApi inventory = mock(InventoryOwnerApi.class);
        BusinessChannelOwnerApi channels = mock(BusinessChannelOwnerApi.class);
        OrganizationOwnerApi organization = mock(OrganizationOwnerApi.class);
        List<UpdateCall> writes = new ArrayList<>();
        when(repository.findForUpdate(any(SalesMenuTarget.class))).thenReturn(Optional.of(menu(1L, 1L)));
        when(repository.find(any(SalesMenuTarget.class))).thenReturn(Optional.of(menu(2L, 2L)));
        when(repository.update(anyString(), any(Object[].class))).thenAnswer(invocation -> {
            Object[] invocationArguments = invocation.getArguments();
            writes.add(new UpdateCall(
                    invocation.getArgument(0, String.class),
                    Arrays.copyOfRange(invocationArguments, 1, invocationArguments.length)));
            return 1;
        });
        when(repository.compareAndSetVersion(any(SalesMenuTarget.class), anyLong()))
                .thenReturn(true);
        when(organization.requireSalesMenuStore(WORKSPACE, "group-1", STORE))
                .thenReturn(new OrganizationOwnerApi.SalesMenuStoreJudgment(STORE, "ENABLED", null, "node", "brand"));
        when(repository.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    RowMapper mapper = invocation.getArgument(1, RowMapper.class);
                    if (sql.contains("sales_command_receipt")) return List.of();
                    if (sql.contains("current_draft_version_ref")) {
                        return List.of(mapper.mapRow(uuidResult(DRAFT), 0));
                    }
                    if (sql.contains("sales_collection_activation")) return List.of();
                    if (sql.contains("FROM sales_menu.sales_version_item v")) return List.of();
                    throw new AssertionError("unexpected query: " + sql);
                });

        var result = service(repository, catalog, inventory, channels, organization, null)
                .publish(new SalesMenuOwnerApi.PublishCommand(commandContext(), 1));

        assertEquals(SalesMenuCommandReadbackStatus.PUBLISHED, result.readbackStatus());
        UpdateCall versionInsert = writes.stream()
                .filter(write -> write.sql().contains("INSERT INTO sales_menu.sales_collection_version"))
                .findFirst()
                .orElseThrow();
        assertEquals(2L, versionInsert.arguments()[3], "publication revision increments from the latest publication");
        assertEquals(0L, versionInsert.arguments()[8], "publication source points at the current draft revision");
        UpdateCall publicationInsert = writes.stream()
                .filter(write -> write.sql().contains("INSERT INTO sales_menu.sales_publication"))
                .findFirst()
                .orElseThrow();
        assertEquals(0L, publicationInsert.arguments()[3], "publication records the current draft revision");
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void copyKeepsDefinitionAndScheduleButDoesNotCopySourceActivationRelation() {
        SalesMenuRepository repository = mock(SalesMenuRepository.class);
        CatalogOwnerApi catalog = mock(CatalogOwnerApi.class);
        InventoryOwnerApi inventory = mock(InventoryOwnerApi.class);
        BusinessChannelOwnerApi channels = mock(BusinessChannelOwnerApi.class);
        OrganizationOwnerApi organization = mock(OrganizationOwnerApi.class);
        when(repository.findForUpdate(any(SalesMenuTarget.class))).thenReturn(Optional.of(menu(null)));
        when(repository.find(any(SalesMenuTarget.class))).thenReturn(Optional.of(menu(null)));
        when(repository.update(anyString(), any(Object[].class))).thenReturn(1);
        when(repository.compareAndSetVersion(any(SalesMenuTarget.class), anyLong()))
                .thenReturn(true);
        when(organization.requireSalesMenuStore(WORKSPACE, "group-1", STORE))
                .thenReturn(new OrganizationOwnerApi.SalesMenuStoreJudgment(STORE, "ENABLED", null, "node", "brand"));
        when(repository.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    RowMapper mapper = invocation.getArgument(1, RowMapper.class);
                    if (sql.contains("sales_command_receipt")) return List.of();
                    if (sql.contains("current_draft_version_ref")) return List.of(mapper.mapRow(uuidResult(DRAFT), 0));
                    if (sql.contains("sales_collection_activation")) {
                        throw new AssertionError("copy must not read or create source activation relations");
                    }
                    if (sql.contains("sales_version_section")) return List.of();
                    if (sql.contains("FROM sales_menu.sales_version_item v")) return List.of();
                    throw new AssertionError("unexpected query: " + sql);
                });

        var result = service(repository, catalog, inventory, channels, organization, null)
                .copy(new SalesMenuOwnerApi.CopyCommand(commandContext(), 1));

        assertEquals(SalesMenuCommandReadbackStatus.APPLIED, result.readbackStatus());
        verify(repository, never())
                .query(
                        ArgumentMatchers.contains("sales_collection_activation"),
                        any(RowMapper.class),
                        any(Object[].class));
        verify(repository, never())
                .update(ArgumentMatchers.contains("sales_collection_activation"), any(Object[].class));
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void copyReusesExistingCustomAssetRefWithoutCallingAssetLifecycle() {
        SalesMenuRepository repository = mock(SalesMenuRepository.class);
        CatalogOwnerApi catalog = mock(CatalogOwnerApi.class);
        InventoryOwnerApi inventory = mock(InventoryOwnerApi.class);
        BusinessChannelOwnerApi channels = mock(BusinessChannelOwnerApi.class);
        OrganizationOwnerApi organization = mock(OrganizationOwnerApi.class);
        List<Object[]> writes = new ArrayList<>();
        when(repository.findForUpdate(any(SalesMenuTarget.class))).thenReturn(Optional.of(menu(null)));
        when(repository.find(any(SalesMenuTarget.class))).thenReturn(Optional.of(menu(null)));
        when(repository.compareAndSetVersion(any(SalesMenuTarget.class), anyLong()))
                .thenReturn(true);
        when(repository.update(anyString(), any(Object[].class))).thenAnswer(invocation -> {
            Object[] arguments = invocation.getArguments();
            writes.add(Arrays.copyOfRange(arguments, 1, arguments.length));
            return 1;
        });
        when(organization.requireSalesMenuStore(WORKSPACE, "group-1", STORE))
                .thenReturn(new OrganizationOwnerApi.SalesMenuStoreJudgment(STORE, "ENABLED", null, "node", "brand"));
        when(repository.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    RowMapper mapper = invocation.getArgument(1, RowMapper.class);
                    if (sql.contains("sales_command_receipt")) return List.of();
                    if (sql.contains("current_draft_version_ref")) return List.of(mapper.mapRow(uuidResult(DRAFT), 0));
                    if (sql.contains("sales_collection_activation")) {
                        throw new AssertionError("copy must not read source activation relations");
                    }
                    if (sql.contains("sales_version_section")) return List.of(mapper.mapRow(sectionResult(), 0));
                    if (sql.contains("sales_version_item_sku")) return List.of();
                    if (sql.contains("sales_version_item_media")) return List.of(mapper.mapRow(mediaResult(), 0));
                    if (sql.contains("sales_version_item_order_option")) return List.of();
                    if (sql.contains("FROM sales_menu.sales_version_item v")) {
                        return List.of(
                                mapper.mapRow(itemResult(DRAFT, 1, "SKU_VARIANT_SALE_COUNTED", null, "CUSTOM"), 0));
                    }
                    throw new AssertionError("unexpected query: " + sql);
                });

        var result = service(repository, catalog, inventory, channels, organization, null)
                .copy(new SalesMenuOwnerApi.CopyCommand(commandContext(), 1));

        assertEquals(SalesMenuCommandReadbackStatus.APPLIED, result.readbackStatus());
        assertEquals(
                1,
                writes.stream()
                        .filter(args -> args.length == 4
                                && ASSET.equals(args[2])
                                && Integer.valueOf(0).equals(args[3]))
                        .count());
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void updateItemReusesActiveCustomAssetRefWithoutClaimingIt() throws Exception {
        SalesMenuRepository repository = mock(SalesMenuRepository.class);
        CatalogOwnerApi catalog = mock(CatalogOwnerApi.class);
        InventoryOwnerApi inventory = mock(InventoryOwnerApi.class);
        BusinessChannelOwnerApi channels = mock(BusinessChannelOwnerApi.class);
        OrganizationOwnerApi organization = mock(OrganizationOwnerApi.class);
        SalesMenuAssetReadApi assets = mock(SalesMenuAssetReadApi.class);
        SalesMenuOwnerApi.ItemUpdateCommand command = new SalesMenuOwnerApi.ItemUpdateCommand(
                commandContext(),
                SALES_ITEM,
                "Menu item",
                new SalesMenuSaleContentInput(
                        SalesMenuSaleContentKind.SKU_SELECTION,
                        null,
                        List.of(new SalesMenuSkuPrice(SKU, "Small", "SKU-1", 120L, 155L))),
                new com.catering.v2s.salesmenu.domain.SalesMenuOrderingConstraints(1, 1),
                new com.catering.v2s.salesmenu.domain.SalesMenuDisplayMedia(
                        SalesMenuDisplayMediaMode.CUSTOM, List.of(ASSET), ASSET),
                List.of(),
                1L);

        when(repository.findForUpdate(any(SalesMenuTarget.class))).thenReturn(Optional.of(menu(null)));
        when(repository.find(any(SalesMenuTarget.class))).thenReturn(Optional.of(menu(null)));
        when(repository.update(anyString(), any(Object[].class))).thenReturn(1);
        when(repository.compareAndSetVersion(any(SalesMenuTarget.class), anyLong()))
                .thenReturn(true);
        when(organization.requireSalesMenuStore(WORKSPACE, "group-1", STORE))
                .thenReturn(new OrganizationOwnerApi.SalesMenuStoreJudgment(STORE, "ENABLED", null, "node", "brand"));
        when(catalog.readSalesMenuItemFacts(anyString(), anyString(), anySet()))
                .thenReturn(Map.of(CATALOG_ITEM, catalogFacts()));
        when(assets.readSalesMenuItemImages(Set.of(ASSET)))
                .thenReturn(Map.of(
                        ASSET,
                        new SalesMenuAssetReadApi.SalesMenuItemImage(
                                ASSET, null, SalesMenuAssetUsage.SALES_MENU_ITEM_IMAGE, "ACTIVE", 2, 100)));
        when(repository.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    RowMapper mapper = invocation.getArgument(1, RowMapper.class);
                    if (sql.contains("sales_command_receipt")) return List.of();
                    if (sql.contains("SELECT 1 FROM sales_menu.sales_version_item WHERE")) {
                        return List.of(mapper.mapRow(booleanResult(true), 0));
                    }
                    if (sql.contains("SELECT version FROM sales_menu.sales_version_item")) {
                        return List.of(mapper.mapRow(longResult(1L), 0));
                    }
                    if (sql.contains("current_draft_version_ref")) {
                        return List.of(mapper.mapRow(uuidResult(DRAFT), 0));
                    }
                    if (sql.contains("FROM sales_menu.sales_version_item v")) {
                        return List.of(
                                mapper.mapRow(itemResult(DRAFT, 1, "SKU_VARIANT_SALE_COUNTED", null, "CUSTOM"), 0));
                    }
                    throw new AssertionError("unexpected query: " + sql);
                });

        var result = service(repository, catalog, inventory, channels, organization, assets)
                .updateItem(command);

        assertEquals(SalesMenuCommandReadbackStatus.APPLIED, result.readbackStatus());
        verify(assets).readSalesMenuItemImages(Set.of(ASSET));
        verify(repository).compareAndSetVersion(commandContext().target(), 1L);
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void updateItemFailsClosedWhenCustomAssetCannotBeVerified() throws Exception {
        SalesMenuRepository repository = mock(SalesMenuRepository.class);
        CatalogOwnerApi catalog = mock(CatalogOwnerApi.class);
        InventoryOwnerApi inventory = mock(InventoryOwnerApi.class);
        BusinessChannelOwnerApi channels = mock(BusinessChannelOwnerApi.class);
        OrganizationOwnerApi organization = mock(OrganizationOwnerApi.class);
        SalesMenuOwnerApi.ItemUpdateCommand command = new SalesMenuOwnerApi.ItemUpdateCommand(
                commandContext(),
                SALES_ITEM,
                "Menu item",
                new SalesMenuSaleContentInput(
                        SalesMenuSaleContentKind.SKU_SELECTION,
                        null,
                        List.of(new SalesMenuSkuPrice(SKU, "Small", "SKU-1", 120L, 155L))),
                new com.catering.v2s.salesmenu.domain.SalesMenuOrderingConstraints(1, 1),
                new com.catering.v2s.salesmenu.domain.SalesMenuDisplayMedia(
                        SalesMenuDisplayMediaMode.CUSTOM, List.of(ASSET), ASSET),
                List.of(),
                1L);

        when(repository.findForUpdate(any(SalesMenuTarget.class))).thenReturn(Optional.of(menu(null)));
        when(repository.find(any(SalesMenuTarget.class))).thenReturn(Optional.of(menu(null)));
        when(repository.update(anyString(), any(Object[].class))).thenReturn(1);
        when(repository.compareAndSetVersion(any(SalesMenuTarget.class), anyLong()))
                .thenReturn(true);
        when(organization.requireSalesMenuStore(WORKSPACE, "group-1", STORE))
                .thenReturn(new OrganizationOwnerApi.SalesMenuStoreJudgment(STORE, "ENABLED", null, "node", "brand"));
        when(catalog.readSalesMenuItemFacts(anyString(), anyString(), anySet()))
                .thenReturn(Map.of(CATALOG_ITEM, catalogFacts()));
        when(repository.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    RowMapper mapper = invocation.getArgument(1, RowMapper.class);
                    if (sql.contains("sales_command_receipt")) return List.of();
                    if (sql.contains("SELECT 1 FROM sales_menu.sales_version_item WHERE")) {
                        return List.of(mapper.mapRow(booleanResult(true), 0));
                    }
                    if (sql.contains("SELECT version FROM sales_menu.sales_version_item")) {
                        return List.of(mapper.mapRow(longResult(1L), 0));
                    }
                    if (sql.contains("current_draft_version_ref")) {
                        return List.of(mapper.mapRow(uuidResult(DRAFT), 0));
                    }
                    if (sql.contains("FROM sales_menu.sales_version_item v")) {
                        return List.of(
                                mapper.mapRow(itemResult(DRAFT, 1, "SKU_VARIANT_SALE_COUNTED", null, "CUSTOM"), 0));
                    }
                    throw new AssertionError("unexpected query: " + sql);
                });

        SalesMenuOwnerApi.Problem failure = assertThrows(SalesMenuOwnerApi.Problem.class, () -> service(
                        repository, catalog, inventory, channels, organization, null)
                .updateItem(command));

        assertEquals("SALES_MENU_ASSET_INVALID", failure.code());
        verify(repository).compareAndSetVersion(commandContext().target(), 1L);
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void updateItemClaimsStagedCustomImageAgainstTheCurrentItemTargetBeforeSaving() throws Exception {
        SalesMenuRepository repository = mock(SalesMenuRepository.class);
        CatalogOwnerApi catalog = mock(CatalogOwnerApi.class);
        InventoryOwnerApi inventory = mock(InventoryOwnerApi.class);
        BusinessChannelOwnerApi channels = mock(BusinessChannelOwnerApi.class);
        OrganizationOwnerApi organization = mock(OrganizationOwnerApi.class);
        SalesMenuAssetReadApi assets = mock(SalesMenuAssetReadApi.class);
        SalesMenuAssetCommandApi assetCommands = mock(SalesMenuAssetCommandApi.class);
        SalesMenuAssetCommandApi.AssetBinding binding = new SalesMenuAssetCommandApi.AssetBinding(ASSET, "bind-grant");
        SalesMenuOwnerApi.ItemUpdateCommand command = new SalesMenuOwnerApi.ItemUpdateCommand(
                commandContext(),
                SALES_ITEM,
                "Menu item",
                new SalesMenuSaleContentInput(
                        SalesMenuSaleContentKind.SKU_SELECTION,
                        null,
                        List.of(new SalesMenuSkuPrice(SKU, "Small", "SKU-1", 120L, 155L))),
                new com.catering.v2s.salesmenu.domain.SalesMenuOrderingConstraints(1, 1),
                new com.catering.v2s.salesmenu.domain.SalesMenuDisplayMedia(
                        SalesMenuDisplayMediaMode.CUSTOM, List.of(ASSET), ASSET),
                List.of(binding),
                1L);

        when(repository.findForUpdate(any(SalesMenuTarget.class))).thenReturn(Optional.of(menu(null)));
        when(repository.find(any(SalesMenuTarget.class))).thenReturn(Optional.of(menu(null)));
        when(repository.update(anyString(), any(Object[].class))).thenReturn(1);
        when(repository.compareAndSetVersion(any(SalesMenuTarget.class), anyLong()))
                .thenReturn(true);
        when(organization.requireSalesMenuStore(WORKSPACE, "group-1", STORE))
                .thenReturn(new OrganizationOwnerApi.SalesMenuStoreJudgment(STORE, "ENABLED", null, "node", "brand"));
        when(catalog.readSalesMenuItemFacts(anyString(), anyString(), anySet()))
                .thenReturn(Map.of(CATALOG_ITEM, catalogFacts()));
        when(assets.readSalesMenuItemImages(Set.of(ASSET)))
                .thenReturn(Map.of(
                        ASSET,
                        new SalesMenuAssetReadApi.SalesMenuItemImage(
                                ASSET, null, SalesMenuAssetUsage.SALES_MENU_ITEM_IMAGE, "STAGED", 1, 100)));
        SalesMenuAssetTarget assetTarget = new SalesMenuAssetTarget(
                "group-1",
                STORE,
                MENU,
                SALES_ITEM,
                com.catering.v2s.salesmenu.domain.SalesMenuAssetUsage.SALES_MENU_ITEM_IMAGE,
                1L);
        when(assetCommands.claimSalesMenuItemImages(
                        any(com.catering.v2s.salesmenu.domain.SalesMenuAssetTarget.class),
                        any(OperationsOwnerScopeGrant.class),
                        anyLong(),
                        any(List.class)))
                .thenReturn(new com.catering.v2s.salesmenu.api.SalesMenuReadback.AssetClaim(
                        assetTarget,
                        List.of(new com.catering.v2s.salesmenu.api.SalesMenuReadback.ClaimedAsset(
                                ASSET, "ACTIVE", 2L))));
        when(repository.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    RowMapper mapper = invocation.getArgument(1, RowMapper.class);
                    if (sql.contains("sales_command_receipt")) return List.of();
                    if (sql.contains("SELECT 1 FROM sales_menu.sales_version_item WHERE")) {
                        return List.of(mapper.mapRow(booleanResult(true), 0));
                    }
                    if (sql.contains("SELECT version FROM sales_menu.sales_version_item")) {
                        return List.of(mapper.mapRow(longResult(1L), 0));
                    }
                    if (sql.contains("current_draft_version_ref")) {
                        return List.of(mapper.mapRow(uuidResult(DRAFT), 0));
                    }
                    if (sql.contains("FROM sales_menu.sales_version_item v")) {
                        return List.of(
                                mapper.mapRow(itemResult(DRAFT, 1, "SKU_VARIANT_SALE_COUNTED", null, "CUSTOM"), 0));
                    }
                    throw new AssertionError("unexpected query: " + sql);
                });

        var result = new SalesMenuOwnerService(
                        repository,
                        () -> 1_788_000_000_000L,
                        new ObjectMapper().findAndRegisterModules(),
                        catalog,
                        inventory,
                        channels,
                        organization,
                        assets,
                        assetCommands,
                        null)
                .updateItem(command);

        assertEquals(SalesMenuCommandReadbackStatus.APPLIED, result.readbackStatus());
        verify(assets, never()).readSalesMenuItemImages(anySet());
        verify(assetCommands)
                .claimSalesMenuItemImages(assetTarget, commandContext().ownerScopeGrant(), 1L, List.of(binding));
        verify(repository).compareAndSetVersion(commandContext().target(), 1L);
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void moveCommandsReuseTheReceiptLockedCurrentRow() throws Exception {
        assertMoveReusesReceiptLockedCurrentRow(false);
        assertMoveReusesReceiptLockedCurrentRow(true);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static void assertMoveReusesReceiptLockedCurrentRow(boolean itemMove) throws Exception {
        SalesMenuRepository repository = mock(SalesMenuRepository.class);
        CatalogOwnerApi catalog = mock(CatalogOwnerApi.class);
        InventoryOwnerApi inventory = mock(InventoryOwnerApi.class);
        BusinessChannelOwnerApi channels = mock(BusinessChannelOwnerApi.class);
        OrganizationOwnerApi organization = mock(OrganizationOwnerApi.class);
        List<String> queries = new ArrayList<>();
        String currentTargetQuery = itemMove
                ? "WHERE version_ref=? AND sales_item_ref=? FOR UPDATE"
                : "WHERE collection_ref=? AND version_ref=? AND section_ref=? FOR UPDATE";

        when(repository.findForUpdate(any(SalesMenuTarget.class))).thenReturn(Optional.of(menu(null)));
        when(repository.find(any(SalesMenuTarget.class))).thenReturn(Optional.of(menu(2L, null)));
        when(repository.compareAndSetVersion(any(SalesMenuTarget.class), anyLong()))
                .thenReturn(true);
        when(repository.update(anyString(), any(Object[].class))).thenReturn(1);
        when(organization.requireSalesMenuStore(WORKSPACE, "group-1", STORE))
                .thenReturn(new OrganizationOwnerApi.SalesMenuStoreJudgment(STORE, "ENABLED", null, "node", "brand"));
        when(repository.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    RowMapper mapper = invocation.getArgument(1, RowMapper.class);
                    queries.add(sql);
                    if (sql.contains("sales_command_receipt")) return List.of();
                    if (sql.contains("current_draft_version_ref")) {
                        return List.of(mapper.mapRow(uuidResult(DRAFT), 0));
                    }
                    if (sql.contains(currentTargetQuery)) {
                        return List.of(mapper.mapRow(moveCurrentResult(SECTION, 1L), 0));
                    }
                    if (sql.contains("ORDER BY display_order")) {
                        return List.of(mapper.mapRow(moveTargetResult(UUID.randomUUID(), 0L), 0));
                    }
                    if (sql.contains("COALESCE(max(display_order)")) {
                        return List.of(mapper.mapRow(longResult(2L), 0));
                    }
                    throw new AssertionError("unexpected query: " + sql);
                });

        SalesMenuOwnerService service = service(repository, catalog, inventory, channels, organization, null);
        if (itemMove) {
            service.moveItem(
                    new SalesMenuOwnerApi.ItemMoveCommand(commandContext(), SALES_ITEM, SalesMenuMoveDirection.UP, 1L));
        } else {
            service.moveSection(
                    new SalesMenuOwnerApi.SectionMoveCommand(commandContext(), SECTION, SalesMenuMoveDirection.UP, 1L));
        }

        assertEquals(
                1,
                queries.stream().filter(sql -> sql.contains(currentTargetQuery)).count());
        assertTrue(queries.indexOf(queries.stream()
                        .filter(sql -> sql.contains(currentTargetQuery))
                        .findFirst()
                        .orElseThrow())
                < queries.indexOf(queries.stream()
                        .filter(sql -> sql.contains("sales_command_receipt"))
                        .findFirst()
                        .orElseThrow()));
    }

    private static SalesMenuOwnerService service(
            SalesMenuRepository repository,
            CatalogOwnerApi catalog,
            InventoryOwnerApi inventory,
            BusinessChannelOwnerApi channels,
            OrganizationOwnerApi organization,
            SalesMenuAssetReadApi assets) {
        return new SalesMenuOwnerService(
                repository,
                () -> 1_788_000_000_000L,
                new ObjectMapper().findAndRegisterModules(),
                catalog,
                inventory,
                channels,
                organization,
                assets);
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
                "publish-store-disabled");
    }

    private static SalesMenuAggregate menu(Long publishedRevision) {
        return menu(1L, publishedRevision);
    }

    private static SalesMenuAggregate menu(long version, Long publishedRevision) {
        return new SalesMenuAggregate(
                MENU,
                scope(),
                "Menu",
                false,
                version,
                0,
                publishedRevision,
                publishedRevision == null ? null : 0L,
                SalesMenuSchedule.allDay(),
                publishedRevision == null ? null : SalesMenuSchedule.allDay());
    }

    private static CatalogOwnerApi.SalesMenuItemFacts catalogFacts() {
        return new CatalogOwnerApi.SalesMenuItemFacts(
                CATALOG_ITEM,
                "SKU-ITEM",
                "Persisted item",
                "SKU_VARIANT_SALE_COUNTED",
                "ENABLED",
                3,
                List.of(),
                120L,
                null,
                ASSET,
                List.of(ASSET),
                List.of(),
                new CatalogOwnerApi.SalesMenuSkuSummary("SKU", 1, 1, 1, List.of("size"), 120L, 120L),
                List.of(new CatalogOwnerApi.SalesMenuSkuFact(
                        SKU, "SKU-1", "Small", 120L, true, "ENABLED", 4, 0, "digest", List.of(), List.of())),
                List.of());
    }

    private static ResultSet uuidResult(UUID value) throws Exception {
        ResultSet result = mock(ResultSet.class);
        when(result.getObject(1, UUID.class)).thenReturn(value);
        return result;
    }

    private static ResultSet booleanResult(boolean value) throws Exception {
        ResultSet result = mock(ResultSet.class);
        when(result.getBoolean(1)).thenReturn(value);
        return result;
    }

    private static ResultSet longResult(long value) throws Exception {
        ResultSet result = mock(ResultSet.class);
        when(result.getLong(1)).thenReturn(value);
        return result;
    }

    private static ResultSet moveCurrentResult(UUID section, long displayOrder) throws Exception {
        ResultSet result = mock(ResultSet.class);
        when(result.getObject("section_ref", UUID.class)).thenReturn(section);
        when(result.getLong("display_order")).thenReturn(displayOrder);
        return result;
    }

    private static ResultSet moveTargetResult(UUID ref, long displayOrder) throws Exception {
        ResultSet result = mock(ResultSet.class);
        when(result.getObject(1, UUID.class)).thenReturn(ref);
        when(result.getLong(2)).thenReturn(displayOrder);
        return result;
    }

    private static ResultSet sectionResult() throws Exception {
        ResultSet result = mock(ResultSet.class);
        when(result.getObject("section_ref", UUID.class)).thenReturn(SECTION);
        when(result.getString("name")).thenReturn("Section");
        when(result.getLong("display_order")).thenReturn(0L);
        return result;
    }

    private static ResultSet itemResult(
            UUID version, long itemVersion, String shape, Long listedPrice, String mediaMode) throws Exception {
        ResultSet result = mock(ResultSet.class);
        when(result.getObject("version_ref", UUID.class)).thenReturn(version);
        when(result.getObject("sales_item_ref", UUID.class)).thenReturn(SALES_ITEM);
        when(result.getObject("catalog_item_ref", UUID.class)).thenReturn(CATALOG_ITEM);
        when(result.getObject("section_ref", UUID.class)).thenReturn(SECTION);
        when(result.getLong("display_order")).thenReturn(0L);
        when(result.getLong("version")).thenReturn(itemVersion);
        when(result.getString("display_name_override")).thenReturn(null);
        when(result.getString("resolved_item_name")).thenReturn("Persisted item");
        when(result.getString("resolved_item_code")).thenReturn("SKU-ITEM");
        when(result.getString("resolved_product_shape")).thenReturn(shape);
        when(result.getObject("listed_price_cents", Long.class)).thenReturn(listedPrice);
        when(result.getString("ordering_constraints_json")).thenReturn("{}");
        when(result.getString("display_media_mode")).thenReturn(mediaMode);
        when(result.getBoolean("can_move_up")).thenReturn(false);
        when(result.getBoolean("can_move_down")).thenReturn(false);
        return result;
    }

    private static ResultSet skuResult() throws Exception {
        ResultSet result = mock(ResultSet.class);
        when(result.getObject("sales_item_ref", UUID.class)).thenReturn(SALES_ITEM);
        when(result.getObject("sku_ref", UUID.class)).thenReturn(SKU);
        when(result.getLong("listed_price_cents")).thenReturn(155L);
        when(result.getString("resolved_sku_code")).thenReturn("SKU-1");
        when(result.getString("resolved_sku_name")).thenReturn("Small");
        when(result.getLong("default_price_cents")).thenReturn(120L);
        when(result.getLong("display_order")).thenReturn(0L);
        return result;
    }

    private static ResultSet mediaResult() throws Exception {
        ResultSet result = mock(ResultSet.class);
        when(result.getObject("sales_item_ref", UUID.class)).thenReturn(SALES_ITEM);
        when(result.getObject("asset_ref", UUID.class)).thenReturn(ASSET);
        when(result.getLong("display_order")).thenReturn(0L);
        return result;
    }
}
