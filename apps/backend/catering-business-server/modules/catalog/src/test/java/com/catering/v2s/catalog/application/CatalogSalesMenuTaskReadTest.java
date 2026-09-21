package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.catalog.api.CatalogProductionTagOwnerApi;
import com.catering.v2s.platform.asset.api.CatalogAssetReferenceLock;
import com.catering.v2s.platform.foundation.collection.OpaqueCollectionCursor;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementSetter;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.core.RowMapper;

class CatalogSalesMenuTaskReadTest {
    private static final UUID ITEM_REF = UUID.fromString("11111111-1111-4111-8111-111111111111");
    private static final UUID OTHER_ITEM_REF = UUID.fromString("22222222-2222-4222-8222-222222222222");
    private static final UUID CATEGORY_REF = UUID.fromString("33333333-3333-4333-8333-333333333333");
    private static final UUID IMAGE_REF = UUID.fromString("44444444-4444-4444-8444-444444444444");
    private static final UUID SECOND_IMAGE_REF = UUID.fromString("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab");
    private static final UUID SKU_REF = UUID.fromString("55555555-5555-4555-8555-555555555555");
    private static final UUID UNIT_REF = UUID.fromString("99999999-9999-4999-8999-999999999999");
    private static final UUID ATTRIBUTE_REF = UUID.fromString("66666666-6666-4666-8666-666666666666");
    private static final UUID VALUE_REF = UUID.fromString("77777777-7777-4777-8777-777777777777");
    private static final UUID TIE_BREAKER = UUID.fromString("88888888-8888-4888-8888-888888888888");
    private static final UUID ORDER_OPTION_CONFIG_REF = UUID.fromString("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    private static final UUID ORDER_OPTION_DEFINITION_REF = UUID.fromString("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    private static final UUID ORDER_OPTION_VALUE_REF = UUID.fromString("cccccccc-cccc-4ccc-8ccc-cccccccccccc");

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void candidatePageUsesScopedOpaqueKeysetAndLookaheadWithoutScreenOrOffsetReads() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        AtomicInteger itemQueries = new AtomicInteger();
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenAnswer(invocation -> {
            RowMapper mapper = invocation.getArgument(1, RowMapper.class);
            if (itemQueries.getAndIncrement() > 0) return List.of();
            List<Object> rows = new ArrayList<>();
            for (int index = 0; index < 21; index++)
                rows.add(mapper.mapRow(
                        itemRow(
                                UUID.nameUUIDFromBytes(("item-" + index).getBytes()),
                                String.format("ITEM-%02d", index),
                                "Item " + index,
                                199L),
                        index));
            return rows;
        });
        stubEmptyFactQueries(jdbc);
        CatalogOwnerService service = service(jdbc);

        CatalogOwnerApi.SalesMenuCandidatePage first = service.readSalesMenuCandidatePage(
                new CatalogOwnerApi.SalesMenuCandidatePageQuery("scope", "brand", CATEGORY_REF, "  item  ", null, 20));

        assertEquals(20, first.items().size());
        assertNull(first.cursor());
        assertNotNull(first.nextCursor());
        assertEquals("ITEM-00", first.items().getFirst().itemCode());
        assertEquals(199L, first.items().getFirst().defaultPriceCents());
        assertTrue(first.items().getFirst().categoryRefs().isEmpty());

        CatalogOwnerApi.SalesMenuCandidatePage second =
                service.readSalesMenuCandidatePage(new CatalogOwnerApi.SalesMenuCandidatePageQuery(
                        "scope", "brand", CATEGORY_REF, "item", first.nextCursor(), 20));
        assertEquals(first.nextCursor(), second.cursor());
        assertTrue(second.items().isEmpty());

        ArgumentCaptor<String> baseSql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object[]> baseArguments = ArgumentCaptor.forClass(Object[].class);
        verify(jdbc, times(2)).query(baseSql.capture(), any(RowMapper.class), baseArguments.capture());
        assertTrue(baseSql.getAllValues().getFirst().contains("i.data_node_ref=? AND i.brand_ref=?"));
        assertTrue(baseSql.getAllValues().getFirst().contains("i.status <> 'VOIDED'"));
        assertTrue(baseSql.getAllValues().getFirst().contains("standardSalePrice"));
        assertTrue(baseSql.getAllValues().getFirst().contains("ORDER BY i.code,i.item_ref LIMIT ?"));
        assertTrue(baseSql.getAllValues().getFirst().contains("category.data_node_ref=i.data_node_ref"));
        assertTrue(baseSql.getAllValues().getFirst().contains("category.status <> 'VOIDED'"));
        assertTrue(baseSql.getAllValues().get(1).contains("i.code > ? OR (i.code = ? AND i.item_ref > ?)"));
        assertTrue(baseSql.getAllValues().stream().noneMatch(sql -> sql.contains("OFFSET")));
        assertEquals(
                21,
                baseArguments.getAllValues()
                        .getFirst()[baseArguments.getAllValues().getFirst().length - 1]);
        assertEquals("%item%", baseArguments.getAllValues().getFirst()[2]);
        assertEquals("%item%", baseArguments.getAllValues().getFirst()[3]);
        assertEquals(CATEGORY_REF, baseArguments.getAllValues().getFirst()[4]);

        ArgumentCaptor<String> factSql = ArgumentCaptor.forClass(String.class);
        verify(jdbc, times(3))
                .query(factSql.capture(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class));
        assertTrue(factSql.getAllValues().stream().anyMatch(sql -> sql.contains("catalog.catalog_sku")));
        assertTrue(factSql.getAllValues().stream().anyMatch(sql -> sql.contains("sku.status <> 'VOIDED'")));
        assertTrue(factSql.getAllValues().stream().anyMatch(sql -> sql.contains("catalog.catalog_item_image")));
        assertTrue(factSql.getAllValues().stream().anyMatch(sql -> sql.contains("catalog.catalog_item_category")));
        assertTrue(factSql.getAllValues().stream().anyMatch(sql -> sql.contains("category.name")));
        assertTrue(factSql.getAllValues().stream().anyMatch(sql -> sql.contains("category.data_node_ref=?")));
        assertTrue(factSql.getAllValues().stream().noneMatch(sql -> sql.contains("sales_menu")));
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void candidatePageReturnsScopedCategoryNamesAndDefaultPrice() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenAnswer(invocation -> {
            RowMapper mapper = invocation.getArgument(1, RowMapper.class);
            return List.of(mapper.mapRow(itemRow(ITEM_REF, "ITEM-1", "Item 1", 123L), 0));
        });
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    ResultSet result = mock(ResultSet.class);
                    if (sql.contains("category.name")) categoryNameRow(result);
                    else when(result.next()).thenReturn(false);
                    return invocation.getArgument(2, ResultSetExtractor.class).extractData(result);
                });

        CatalogOwnerApi.SalesMenuCandidate candidate = service(jdbc)
                .readSalesMenuCandidatePage(
                        new CatalogOwnerApi.SalesMenuCandidatePageQuery("scope", "brand", null, "", null, 20))
                .items()
                .getFirst();

        assertEquals(123L, candidate.defaultPriceCents());
        assertEquals(List.of(CATEGORY_REF), candidate.categoryRefs());
        assertEquals(List.of("饮品"), candidate.categoryNames());
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void itemFactsUseOneScopedSetReadAndOmitAbsentOrVoidedItems() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenAnswer(invocation -> {
            RowMapper mapper = invocation.getArgument(1, RowMapper.class);
            return List.of(mapper.mapRow(itemRow(ITEM_REF, "ITEM-1", "Item 1", null), 0));
        });
        stubEmptyFactQueries(jdbc);
        CatalogOwnerService service = service(jdbc);

        var facts = service.readSalesMenuItemFacts("scope", "brand", Set.of(ITEM_REF, OTHER_ITEM_REF));

        assertEquals(Set.of(ITEM_REF), facts.keySet());
        assertEquals("ITEM-1", facts.get(ITEM_REF).itemCode());
        assertEquals("STANDARD_SALE_COUNTED", facts.get(ITEM_REF).shapeKey());

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object[]> arguments = ArgumentCaptor.forClass(Object[].class);
        verify(jdbc).query(sql.capture(), any(RowMapper.class), arguments.capture());
        assertTrue(sql.getValue().contains("i.data_node_ref=? AND i.brand_ref=?"));
        assertTrue(sql.getValue().contains("i.item_ref IN (?,?)"));
        assertTrue(sql.getValue().contains("i.status <> 'VOIDED'"));
        assertTrue(sql.getValue().contains("ORDER BY i.item_ref"));
        assertTrue(!sql.getValue().contains("OFFSET"));
        assertEquals("scope", arguments.getValue()[0]);
        assertEquals("brand", arguments.getValue()[1]);
        assertEquals(
                Set.of(ITEM_REF, OTHER_ITEM_REF),
                Set.of(arguments.getValue()[2], arguments.getValue()[3]));
        verify(jdbc, times(5)).query(anyString(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class));
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void itemReferenceFactsAvoidHydratingDependentSalesMenuFacts() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenAnswer(invocation -> {
            RowMapper mapper = invocation.getArgument(1, RowMapper.class);
            return List.of(mapper.mapRow(itemRow(ITEM_REF, "ITEM-1", "Item 1", null), 0));
        });
        CatalogOwnerService service = service(jdbc);

        var facts = service.readSalesMenuItemReferenceFacts("scope", "brand", Set.of(ITEM_REF));

        assertEquals(Set.of(ITEM_REF), facts.keySet());
        assertEquals("ITEM-1", facts.get(ITEM_REF).itemCode());
        assertEquals("Item 1", facts.get(ITEM_REF).itemName());
        assertEquals("STANDARD_SALE_COUNTED", facts.get(ITEM_REF).shapeKey());
        verify(jdbc, times(1)).query(anyString(), any(RowMapper.class), any(Object[].class));
        verify(jdbc, times(0)).query(anyString(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class));
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void itemFactsReturnTypedImageCollectionDefaultPriceCategoryAndAuthoritativeSkuFacts() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenAnswer(invocation -> {
            RowMapper mapper = invocation.getArgument(1, RowMapper.class);
            return List.of(mapper.mapRow(itemRow(ITEM_REF, "SKU-ITEM", "Coffee", 123L), 0));
        });
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    ResultSet result = mock(ResultSet.class);
                    if (sql.contains("catalog.catalog_sku sku")) skuRow(result);
                    else if (sql.contains("catalog.catalog_item_order_option_config")) orderOptionRow(result);
                    else if (sql.contains("FROM catalog.catalog_item WHERE item_ref IN")) unitRow(result);
                    else if (sql.contains("catalog.catalog_item_image")) imageRow(result);
                    else if (sql.contains("catalog.catalog_item_category")) categoryRow(result);
                    else throw new AssertionError("unexpected catalog fact query: " + sql);
                    return invocation.getArgument(2, ResultSetExtractor.class).extractData(result);
                });
        CatalogOwnerService service = service(jdbc);

        var facts = service.readSalesMenuItemFacts("scope", "brand", Set.of(ITEM_REF))
                .get(ITEM_REF);

        assertEquals(123L, facts.defaultPriceCents());
        assertNotNull(facts.salesUnitSnapshot());
        assertEquals(UNIT_REF, facts.salesUnitSnapshot().unitRef());
        assertEquals("COUNT", facts.salesUnitSnapshot().code());
        assertEquals("个", facts.salesUnitSnapshot().name());
        assertEquals("COUNT", facts.salesUnitSnapshot().unitDimension());
        assertEquals(0, facts.salesUnitSnapshot().precision());
        assertEquals(IMAGE_REF, facts.defaultImageAssetRef());
        assertEquals(List.of(IMAGE_REF, SECOND_IMAGE_REF), facts.imageAssetRefs());
        assertEquals(1, facts.orderOptions().size());
        assertEquals("甜度", facts.orderOptions().getFirst().name());
        assertEquals("SINGLE", facts.orderOptions().getFirst().selectionMode());
        assertEquals(1, facts.orderOptions().getFirst().values().size());
        assertEquals("少糖", facts.orderOptions().getFirst().values().getFirst().name());
        assertEquals(List.of(CATEGORY_REF), facts.categoryRefs());
        assertEquals(1, facts.skus().size());
        assertEquals(SKU_REF, facts.skus().getFirst().productSkuRef());
        assertEquals("SKU-1", facts.skus().getFirst().skuCode());
        assertEquals("Small", facts.skus().getFirst().skuName());
        assertEquals("ENABLED", facts.skus().getFirst().status());
        assertEquals(750L, facts.skus().getFirst().standardSalePrice());
        assertEquals(
                "size", facts.skus().getFirst().attributeValueRefs().getFirst().attributeCode());
        assertEquals(
                "S", facts.skus().getFirst().attributeValueRefs().getFirst().valueCode());
        assertEquals(1, facts.skuSummary().enabledCount());
        assertEquals(1, facts.skuSummary().totalCount());
        assertEquals(750L, facts.skuSummary().standardSalePriceMin());
        assertEquals(750L, facts.skuSummary().standardSalePriceMax());
        assertEquals(List.of("尺寸"), facts.skuSummary().dimensions());
        assertEquals(1, facts.variantAxes().size());
        assertEquals(ATTRIBUTE_REF, facts.variantAxes().getFirst().attributeRef());
        assertEquals("size", facts.variantAxes().getFirst().attributeCode());
        assertEquals(
                VALUE_REF, facts.variantAxes().getFirst().values().getFirst().valueRef());
        assertEquals("S", facts.variantAxes().getFirst().values().getFirst().valueCode());
    }

    @Test
    void fixedTwentyPageAndCursorIdentityAreEnforcedBeforeJdbc() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        CatalogOwnerService service = service(jdbc);

        assertThrows(
                IllegalArgumentException.class,
                () -> new CatalogOwnerApi.SalesMenuCandidatePageQuery("scope", "brand", null, null, null, 19));

        String foreignCursor = OpaqueCollectionCursor.encode("another-query", "ITEM-1", TIE_BREAKER);
        CatalogOwnerApi.Problem problem = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> service.readSalesMenuCandidatePage(new CatalogOwnerApi.SalesMenuCandidatePageQuery(
                        "scope", "brand", null, null, foreignCursor, 20)));
        assertEquals("VALIDATION_ERROR", problem.code());
        verifyNoInteractions(jdbc);
    }

    private static CatalogOwnerService service(JdbcTemplate jdbc) {
        return new CatalogOwnerService(
                jdbc,
                new ObjectMapper(),
                () -> 1_785_000_000_000L,
                mock(CatalogAssetReferenceLock.class),
                mock(CatalogProductionTagOwnerApi.class),
                null);
    }

    private static void stubEmptyFactQueries(JdbcTemplate jdbc) throws Exception {
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class)))
                .thenAnswer(invocation -> {
                    ResultSet result = mock(ResultSet.class);
                    when(result.next()).thenReturn(false);
                    return invocation.getArgument(2, ResultSetExtractor.class).extractData(result);
                });
    }

    private static ResultSet itemRow(UUID itemRef, String code, String name, Long defaultPrice) throws Exception {
        ResultSet result = mock(ResultSet.class);
        when(result.getObject(1, UUID.class)).thenReturn(itemRef);
        when(result.getString(2)).thenReturn(code);
        when(result.getString(3)).thenReturn(name);
        when(result.getString(4)).thenReturn("STANDARD_SALE_COUNTED");
        when(result.getString(5)).thenReturn("ENABLED");
        when(result.getObject(6, Long.class)).thenReturn(defaultPrice);
        when(result.getLong(7)).thenReturn(1L);
        return result;
    }

    private static void skuRow(ResultSet result) throws Exception {
        when(result.next()).thenReturn(true, false);
        when(result.getObject(1, UUID.class)).thenReturn(ITEM_REF);
        when(result.getObject(2, UUID.class)).thenReturn(SKU_REF);
        when(result.getString(3)).thenReturn("SKU-1");
        when(result.getString(4)).thenReturn("Small");
        when(result.getObject(5)).thenReturn(750L);
        when(result.getLong(5)).thenReturn(750L);
        when(result.getBoolean(6)).thenReturn(true);
        when(result.getString(7)).thenReturn("ENABLED");
        when(result.getLong(8)).thenReturn(4L);
        when(result.getInt(9)).thenReturn(0);
        when(result.getString(10)).thenReturn("digest-1");
        when(result.getString(31)).thenReturn("");
        when(result.getString(32)).thenReturn(null);
        when(result.getLong(33)).thenReturn(99L);
        when(result.getString(34))
                .thenReturn("[{\"attributeRef\":\"" + ATTRIBUTE_REF + "\",\"attributeCode\":\"size\","
                        + "\"attributeName\":\"尺寸\",\"displayOrder\":0,\"values\":[{"
                        + "\"valueRef\":\"" + VALUE_REF + "\",\"valueCode\":\"S\","
                        + "\"valueLabel\":\"小\",\"status\":\"ENABLED\",\"displayOrder\":0}]}]");
        when(result.getObject(23, UUID.class)).thenReturn(ATTRIBUTE_REF);
        when(result.getString(24)).thenReturn("size");
        when(result.getString(25)).thenReturn("尺寸");
        when(result.getObject(26, UUID.class)).thenReturn(VALUE_REF);
        when(result.getString(27)).thenReturn("S");
        when(result.getString(28)).thenReturn("小");
        when(result.getString(29)).thenReturn("ENABLED");
        when(result.getInt(30)).thenReturn(0);
    }

    private static void imageRow(ResultSet result) throws Exception {
        when(result.next()).thenReturn(true, true, false);
        when(result.getObject(1, UUID.class)).thenReturn(ITEM_REF);
        when(result.getObject(2, UUID.class)).thenReturn(IMAGE_REF, SECOND_IMAGE_REF);
    }

    private static void orderOptionRow(ResultSet result) throws Exception {
        when(result.next()).thenReturn(true, false);
        when(result.getObject(1, UUID.class)).thenReturn(ITEM_REF);
        when(result.getObject(2, UUID.class)).thenReturn(ORDER_OPTION_CONFIG_REF);
        when(result.getObject(3, UUID.class)).thenReturn(ORDER_OPTION_DEFINITION_REF);
        when(result.getString(4)).thenReturn("甜度");
        when(result.getString(5)).thenReturn("SINGLE");
        when(result.getInt(6)).thenReturn(0);
        when(result.getBoolean(7)).thenReturn(true);
        when(result.getObject(8)).thenReturn(1);
        when(result.getInt(8)).thenReturn(1);
        when(result.getObject(9)).thenReturn(1);
        when(result.getInt(9)).thenReturn(1);
        when(result.getObject(10, UUID.class)).thenReturn(ORDER_OPTION_VALUE_REF);
        when(result.getString(11)).thenReturn("少糖");
        when(result.getInt(12)).thenReturn(0);
        when(result.getObject(13)).thenReturn(1);
        when(result.getBoolean(14)).thenReturn(false);
        when(result.getObject(15)).thenReturn(null);
        when(result.getString(16)).thenReturn(null);
    }

    private static void unitRow(ResultSet result) throws Exception {
        when(result.next()).thenReturn(true, false);
        when(result.getObject(1, UUID.class)).thenReturn(ITEM_REF);
        when(result.getObject(2, UUID.class)).thenReturn(UNIT_REF);
        when(result.getString(3)).thenReturn("COUNT");
        when(result.getString(4)).thenReturn("个");
        when(result.getString(5)).thenReturn("COUNT");
        when(result.getInt(6)).thenReturn(0);
        when(result.getObject(7, UUID.class)).thenReturn(null);
    }

    private static void categoryRow(ResultSet result) throws Exception {
        when(result.next()).thenReturn(true, false);
        when(result.getObject(1, UUID.class)).thenReturn(ITEM_REF);
        when(result.getObject(2, UUID.class)).thenReturn(CATEGORY_REF);
    }

    private static void categoryNameRow(ResultSet result) throws Exception {
        when(result.next()).thenReturn(true, false);
        when(result.getObject(1, UUID.class)).thenReturn(ITEM_REF);
        when(result.getObject(2, UUID.class)).thenReturn(CATEGORY_REF);
        when(result.getString(3)).thenReturn("饮品");
    }
}
