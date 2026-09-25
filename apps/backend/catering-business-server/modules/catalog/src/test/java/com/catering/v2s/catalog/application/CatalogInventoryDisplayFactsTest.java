package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.catalog.api.CatalogProductionTagOwnerApi;
import com.catering.v2s.catalog.application.persistence.CatalogWorkbenchReadPersistence;
import com.catering.v2s.platform.asset.api.CatalogAssetReferenceLock;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class CatalogInventoryDisplayFactsTest {
    @Test
    void displayFactShapeHasExactlyFiveComponentsAndAbsentIsExplicit() {
        assertEquals(
                List.of("itemRef", "itemName", "skuName", "materialRole", "categoryDisplayName"),
                Arrays.stream(CatalogOwnerApi.InventoryDisplayFact.class.getRecordComponents())
                        .map(component -> component.getName())
                        .toList());

        UUID itemRef = UUID.randomUUID();
        CatalogOwnerApi.InventoryDisplayFact absent = CatalogOwnerApi.InventoryDisplayFact.absent(itemRef);
        assertEquals(itemRef, absent.itemRef());
        assertFalse(absent.present());
        assertNull(absent.itemName());
        assertNull(absent.skuName());
        assertNull(absent.materialRole());
        assertNull(absent.categoryDisplayName());
    }

    @Test
    void ownerProjectionUsesOneSetQueryAndRestoresInputOrderWithAbsentRefs() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        UUID missing = UUID.randomUUID();
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenAnswer(invocation -> {
            @SuppressWarnings("unchecked")
            RowMapper<CatalogWorkbenchReadPersistence.InventoryDisplayFactRow> mapper =
                    (RowMapper<CatalogWorkbenchReadPersistence.InventoryDisplayFactRow>) invocation.getArgument(1);
            return List.of(
                    mapper.mapRow(row(first, "first", "First SKU", "MATERIAL", "First Category"), 0),
                    mapper.mapRow(row(second, "second", null, null, null), 1));
        });
        CatalogOwnerService service = new CatalogOwnerService(
                jdbc,
                new ObjectMapper(),
                () -> 1_785_000_000_000L,
                mock(CatalogAssetReferenceLock.class),
                mock(CatalogProductionTagOwnerApi.class),
                null);

        List<CatalogOwnerApi.InventoryDisplayFact> facts =
                service.readInventoryDisplayFacts("scope", "brand", List.of(second, missing, first, second));

        assertEquals(
                List.of(second, missing, first, second),
                facts.stream().map(fact -> fact.itemRef()).toList());
        assertTrue(facts.get(0).present());
        assertEquals("second", facts.get(0).itemName());
        assertFalse(facts.get(1).present());
        assertEquals("first", facts.get(2).itemName());
        assertEquals("First SKU", facts.get(2).skuName());
        verify(jdbc, times(1)).query(anyString(), any(RowMapper.class), any(Object[].class));

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).query(sql.capture(), any(RowMapper.class), any(Object[].class));
        assertTrue(sql.getValue().contains("item.item_ref IN (?,?,?)"));
        assertTrue(sql.getValue().contains("catalog.catalog_sku"));
        assertTrue(sql.getValue().contains("catalog.catalog_category"));
        assertFalse(sql.getValue().contains("SELECT " + "*"));
    }

    private static ResultSet row(
            UUID itemRef, String itemName, String skuName, String materialRole, String categoryDisplayName)
            throws Exception {
        ResultSet row = mock(ResultSet.class);
        when(row.getObject(1, UUID.class)).thenReturn(itemRef);
        when(row.getString(2)).thenReturn(itemName);
        when(row.getString(3)).thenReturn(skuName);
        when(row.getString(4)).thenReturn(materialRole);
        when(row.getString(5)).thenReturn(categoryDisplayName);
        return row;
    }
}
