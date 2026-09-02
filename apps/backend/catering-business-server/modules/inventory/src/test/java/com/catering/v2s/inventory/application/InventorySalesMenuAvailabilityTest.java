package com.catering.v2s.inventory.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
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

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementSetter;
import org.springframework.jdbc.core.ResultSetExtractor;

class InventorySalesMenuAvailabilityTest {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final int TARGET_COLUMN_COUNT = 24;

    @Test
    void availabilityUsesOneScopedIdentityReadAndKeepsAbsentIdentities() throws Exception {
        UUID itemRef = UUID.fromString("00000000-0000-0000-0000-000000000001");
        UUID skuRef = UUID.fromString("00000000-0000-0000-0000-000000000002");
        UUID itemTargetRef = UUID.fromString("00000000-0000-0000-0000-000000000101");
        UUID skuTargetRef = UUID.fromString("00000000-0000-0000-0000-000000000102");
        InventoryOwnerApi.InventoryTargetRef itemIdentity = new InventoryOwnerApi.InventoryTargetRef(itemRef, null);
        InventoryOwnerApi.InventoryTargetRef skuIdentity = new InventoryOwnerApi.InventoryTargetRef(itemRef, skuRef);
        InventoryOwnerApi.InventoryTargetRef lowIdentity =
                new InventoryOwnerApi.InventoryTargetRef(UUID.randomUUID(), null);
        InventoryOwnerApi.InventoryTargetRef outOfStockIdentity =
                new InventoryOwnerApi.InventoryTargetRef(UUID.randomUUID(), null);
        InventoryOwnerApi.InventoryTargetRef negativeAllowedIdentity =
                new InventoryOwnerApi.InventoryTargetRef(UUID.randomUUID(), null);
        InventoryOwnerApi.InventoryTargetRef negativeDeniedIdentity =
                new InventoryOwnerApi.InventoryTargetRef(UUID.randomUUID(), null);
        InventoryOwnerApi.InventoryTargetRef unknownIdentity =
                new InventoryOwnerApi.InventoryTargetRef(UUID.randomUUID(), null);
        InventoryOwnerApi.InventoryTargetRef absentIdentity =
                new InventoryOwnerApi.InventoryTargetRef(UUID.randomUUID(), null);
        List<TargetFixture> rows = List.of(
                target(itemIdentity, itemTargetRef, "5", "{\"conversionFactor\":1}"),
                target(skuIdentity, skuTargetRef, "5", "{\"conversionFactor\":1}"),
                target(lowIdentity, UUID.randomUUID(), "1", "{\"conversionFactor\":1,\"lowStockThreshold\":2}"),
                target(outOfStockIdentity, UUID.randomUUID(), "0", "{\"conversionFactor\":1}"),
                target(
                        negativeAllowedIdentity,
                        UUID.randomUUID(),
                        "-1",
                        "{\"conversionFactor\":1,\"allowNegative\":true}"),
                target(
                        negativeDeniedIdentity,
                        UUID.randomUUID(),
                        "-1",
                        "{\"conversionFactor\":1,\"allowNegative\":false}"),
                target(unknownIdentity, UUID.randomUUID(), "5", "{\"unknown\":true}"));
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class)))
                .thenAnswer(invocation -> {
                    ResultSetExtractor<?> extractor = invocation.getArgument(2);
                    return extractor.extractData(targetRows(rows));
                });
        InventoryOwnerService service = new InventoryOwnerService(jdbc, MAPPER, () -> 1L);
        Set<InventoryOwnerApi.InventoryTargetRef> requested = new LinkedHashSet<>(List.of(
                itemIdentity,
                skuIdentity,
                lowIdentity,
                outOfStockIdentity,
                negativeAllowedIdentity,
                negativeDeniedIdentity,
                unknownIdentity,
                absentIdentity));

        List<InventoryOwnerApi.InventoryAvailabilityFact> facts =
                service.readSalesMenuAvailability("store-node", "brand-a", requested);
        Map<InventoryOwnerApi.InventoryTargetRef, InventoryOwnerApi.InventoryAvailabilityFact> byIdentity =
                facts.stream()
                        .collect(java.util.stream.Collectors.toMap(
                                InventoryOwnerApi.InventoryAvailabilityFact::identity,
                                fact -> fact,
                                (first, ignored) -> first,
                                LinkedHashMap::new));

        assertEquals(requested, new LinkedHashSet<>(byIdentity.keySet()));
        assertEquals(itemTargetRef, byIdentity.get(itemIdentity).targetRef());
        assertEquals(skuTargetRef, byIdentity.get(skuIdentity).targetRef());
        assertNotEquals(itemIdentity.itemRef(), itemTargetRef);
        assertNotEquals(skuIdentity.productSkuRef(), skuTargetRef);
        assertAvailable(byIdentity.get(itemIdentity));
        assertAvailable(byIdentity.get(skuIdentity));
        assertAvailable(byIdentity.get(lowIdentity));
        assertEquals(
                InventoryOwnerApi.InventoryAvailabilityState.AUTO_UNAVAILABLE,
                byIdentity.get(outOfStockIdentity).state());
        assertEquals(
                InventoryOwnerApi.InventoryAvailabilityReason.OUT_OF_STOCK,
                byIdentity.get(outOfStockIdentity).reason());
        assertAvailable(byIdentity.get(negativeAllowedIdentity));
        assertEquals(
                InventoryOwnerApi.InventoryAvailabilityState.AUTO_UNAVAILABLE,
                byIdentity.get(negativeDeniedIdentity).state());
        assertEquals(
                InventoryOwnerApi.InventoryAvailabilityReason.NEGATIVE_NOT_ALLOWED,
                byIdentity.get(negativeDeniedIdentity).reason());
        assertEquals(
                InventoryOwnerApi.InventoryAvailabilityState.UNKNOWN,
                byIdentity.get(unknownIdentity).state());
        assertEquals(
                InventoryOwnerApi.InventoryAvailabilityReason.READ_UNAVAILABLE,
                byIdentity.get(unknownIdentity).reason());
        assertNull(byIdentity.get(absentIdentity).targetRef());
        assertFalse(byIdentity.get(absentIdentity).targetExists());
        assertEquals(
                InventoryOwnerApi.InventoryAvailabilityApplicability.NOT_APPLICABLE,
                byIdentity.get(absentIdentity).applicability());
        assertNull(byIdentity.get(absentIdentity).state());
        assertNull(byIdentity.get(absentIdentity).reason());

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<PreparedStatementSetter> setter = ArgumentCaptor.forClass(PreparedStatementSetter.class);
        verify(jdbc, times(1)).query(sql.capture(), setter.capture(), any(ResultSetExtractor.class));
        String statement = sql.getValue().toUpperCase(Locale.ROOT);
        assertTrue(statement.contains("DATA_NODE_REF=?"));
        assertTrue(statement.contains("BRAND_REF=?"));
        assertTrue(statement.contains("ITEM_REF=?"));
        assertTrue(statement.contains("PRODUCT_SKU_REF IS NOT DISTINCT FROM ?"));
        assertFalse(statement.contains("TARGET_REF = ANY(?::UUID[])"));
        assertEquals(requested.size(), occurrences(statement, "PRODUCT_SKU_REF IS NOT DISTINCT FROM ?"));
        assertFalse(statement.contains("OFFSET"));
        assertFalse(statement.contains("COUNT("));
        assertFalse(statement.contains("TOTAL"));

        PreparedStatement preparedStatement = mock(PreparedStatement.class);
        setter.getValue().setValues(preparedStatement);
        verify(preparedStatement).setString(1, "store-node");
        verify(preparedStatement).setString(2, "brand-a");
        verify(preparedStatement).setObject(3, itemRef);
        verify(preparedStatement).setObject(4, (Object) null);
        verify(preparedStatement).setObject(5, itemRef);
        verify(preparedStatement).setObject(6, skuRef);
    }

    @Test
    void availabilityRecordDoesNotExposeRawInventoryStatesOrScreenFields() {
        assertEquals(
                List.of("identity", "targetRef", "targetExists", "applicability", "state", "reason"),
                Arrays.stream(InventoryOwnerApi.InventoryAvailabilityFact.class.getRecordComponents())
                        .map(component -> component.getName())
                        .toList());
        assertEquals(
                List.of("itemRef", "productSkuRef"),
                Arrays.stream(InventoryOwnerApi.InventoryTargetRef.class.getRecordComponents())
                        .map(component -> component.getName())
                        .toList());
        assertEquals(
                Set.of("AVAILABLE", "AUTO_UNAVAILABLE", "UNKNOWN"),
                Arrays.stream(InventoryOwnerApi.InventoryAvailabilityState.values())
                        .map(Enum::name)
                        .collect(java.util.stream.Collectors.toSet()));
        assertFalse(Arrays.stream(InventoryOwnerApi.InventoryAvailabilityState.values())
                .map(Enum::name)
                .anyMatch(Set.of("LOW", "OUT", "NEGATIVE")::contains));
    }

    @Test
    void availabilityRequiresStoreDataNodeAndBrandScopeBeforeReading() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        InventoryOwnerService service = new InventoryOwnerService(jdbc, MAPPER, () -> 1L);

        InventoryOwnerApi.Problem missingDataNode = assertThrows(
                InventoryOwnerApi.Problem.class,
                () -> service.readSalesMenuAvailability(
                        " ", "brand-a", Set.of(new InventoryOwnerApi.InventoryTargetRef(UUID.randomUUID(), null))));
        InventoryOwnerApi.Problem missingBrand = assertThrows(
                InventoryOwnerApi.Problem.class,
                () -> service.readSalesMenuAvailability(
                        "store-node", "", Set.of(new InventoryOwnerApi.InventoryTargetRef(UUID.randomUUID(), null))));

        assertEquals("SCOPE_FORBIDDEN", missingDataNode.code());
        assertEquals("SCOPE_FORBIDDEN", missingBrand.code());
        verifyNoInteractions(jdbc);
    }

    private static void assertAvailable(InventoryOwnerApi.InventoryAvailabilityFact fact) {
        assertTrue(fact.targetExists());
        assertEquals(InventoryOwnerApi.InventoryAvailabilityApplicability.APPLICABLE, fact.applicability());
        assertEquals(InventoryOwnerApi.InventoryAvailabilityState.AVAILABLE, fact.state());
        assertNull(fact.reason());
    }

    private static TargetFixture target(
            InventoryOwnerApi.InventoryTargetRef identity, UUID targetRef, String balance, String configuration) {
        return new TargetFixture(identity, targetRef, new BigDecimal(balance), configuration);
    }

    private static int occurrences(String value, String token) {
        int count = 0;
        for (int offset = 0; (offset = value.indexOf(token, offset)) >= 0; offset += token.length()) count++;
        return count;
    }

    private static ResultSet targetRows(List<TargetFixture> rows) {
        int[] cursor = {-1};
        return (ResultSet) Proxy.newProxyInstance(
                InventorySalesMenuAvailabilityTest.class.getClassLoader(),
                new Class<?>[] {ResultSet.class},
                (proxy, method, args) -> {
                    switch (method.getName()) {
                        case "next" -> {
                            cursor[0]++;
                            return cursor[0] < rows.size();
                        }
                        case "getMetaData" -> {
                            return metadata();
                        }
                        default -> {
                            TargetFixture row = rows.get(cursor[0]);
                            int column = (Integer) args[0];
                            return switch (method.getName()) {
                                case "getObject" -> switch (column) {
                                    case 1 -> row.targetRef();
                                    case 2 -> row.identity().itemRef();
                                    case 3 -> row.identity().productSkuRef();
                                    default -> null;
                                };
                                case "getString" -> switch (column) {
                                    case 8 -> row.configuration();
                                    case 22 -> "ENABLED";
                                    case 23 -> "DIRECT";
                                    default -> null;
                                };
                                case "getBigDecimal" -> switch (column) {
                                    case 7 -> row.balance();
                                    case 21 -> BigDecimal.ONE;
                                    default -> null;
                                };
                                case "getLong" -> 1L;
                                case "getBoolean" -> false;
                                case "getInt" -> 0;
                                default -> throw new UnsupportedOperationException(method.getName());
                            };
                        }
                    }
                });
    }

    private static ResultSetMetaData metadata() {
        return (ResultSetMetaData) Proxy.newProxyInstance(
                InventorySalesMenuAvailabilityTest.class.getClassLoader(),
                new Class<?>[] {ResultSetMetaData.class},
                (proxy, method, args) -> {
                    if ("getColumnCount".equals(method.getName())) return TARGET_COLUMN_COUNT;
                    if (method.getReturnType() == boolean.class) return false;
                    if (method.getReturnType() == int.class) return 0;
                    if (method.getReturnType() == long.class) return 0L;
                    return null;
                });
    }

    private record TargetFixture(
            InventoryOwnerApi.InventoryTargetRef identity, UUID targetRef, BigDecimal balance, String configuration) {}
}
