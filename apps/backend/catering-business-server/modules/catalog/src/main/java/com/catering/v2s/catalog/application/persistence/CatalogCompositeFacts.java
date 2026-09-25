package com.catering.v2s.catalog.application.persistence;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;

/** Composite groups and components are catalog relations; JSON is reconstructed only at the owner boundary. */
public class CatalogCompositeFacts {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public CatalogCompositeFacts(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public Map<UUID, ArrayNode> readByItemRefs(Collection<UUID> itemRefs) {
        if (itemRefs == null || itemRefs.isEmpty()) return Map.of();
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        String placeholders = String.join(
                CatalogCompositeFactsSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(refs.size(), CatalogCompositeFactsSql.PARAMETER_PLACEHOLDER));
        Map<UUID, ArrayNode> result = new LinkedHashMap<>();
        Map<UUID, ObjectNode> groups = new LinkedHashMap<>();
        refs.forEach(ref -> result.put(ref, mapper.createArrayNode()));
        jdbc.query(
                CatalogCompositeFactsSql.CATALOG_COMPOSITE_FACTS_SELECT
                        + CatalogCompositeFactsSql
                                .CATALOG_COMPOSITE_FACTS_GROUP_ROW_ITEM_REF_GROUP_ROW_COMPOSITE_GROUP_REF_GROUP_ROW_GROUP_CODE_GROUP_ROW_GROUP_NAME_GROUP_ROW_SELECTION_RULE_COMPONENT_ITEM_REF_COMPONENT_PRODUCT_SKU_REF_COMPONENT
                        + CatalogCompositeFactsSql
                                .CATALOG_COMPOSITE_FACTS_QUANTITY_COMPONENT_UNIT_COMPONENT_IS_DEFAULT_COMPONENT_EXTRA_PRICE_COMPONENT_STATUS_COMPONENT_SKU_SKU_CODE_SKU_SKU_NAME
                        + CatalogCompositeFactsSql.CATALOG_COMPOSITE_FACTS_FROM_CLAUSE_CATALOG_COMPOSITE_GROUP_GROUP_ROW
                        + CatalogCompositeFactsSql.CATALOG_COMPOSITE_FACTS_JOIN
                        + CatalogCompositeFactsSql.CATALOG_COMPOSITE_FACTS_CATALOG_COMPOSITE_COMPONENT_COMPONENT
                        + CatalogCompositeFactsSql
                                .CATALOG_COMPOSITE_FACTS_CATALOG_ITEM_COMPONENT_COMPOSITE_GROUP_REF_GROUP_ROW
                        + CatalogCompositeFactsSql.CATALOG_COMPOSITE_FACTS_ITEM
                        + CatalogCompositeFactsSql
                                .CATALOG_COMPOSITE_FACTS_JOIN_CONDITION_CATALOG_SKU_ITEM_ITEM_REF_COMPONENT_COMPONENT_ITEM_REF
                        + CatalogCompositeFactsSql.CATALOG_COMPOSITE_FACTS_SKU_ITEM_REF_COMPONENT_COMPONENT_ITEM_REF
                        + CatalogCompositeFactsSql.CATALOG_COMPOSITE_FACTS_WHERE_GROUP_ROW_ITEM_REF
                        + placeholders
                        + CatalogCompositeFactsSql.CATALOG_COMPOSITE_FACTS_CLOSE_PAREN_ORDER_BY
                        + CatalogCompositeFactsSql.CATALOG_COMPOSITE_FACTS_GROUP_ROW_ITEM_REF_DISPLAY_ORDER_GROUP_CODE
                        + CatalogCompositeFactsSql.CATALOG_COMPOSITE_FACTS_COMPONENT_COMPOSITE_COMPONENT_REF,
                statement -> {
                    for (int index = 0; index < refs.size(); index++) statement.setObject(index + 1, refs.get(index));
                },
                rows -> {
                    while (rows.next()) {
                        UUID itemRef = rows.getObject(1, UUID.class);
                        UUID groupRef = rows.getObject(2, UUID.class);
                        ObjectNode group = groups.get(groupRef);
                        if (group == null) {
                            group = result.get(itemRef).addObject();
                            group.put("groupCode", rows.getString(3));
                            group.put("groupName", rows.getString(4));
                            group.put("selectionRule", rows.getString(5));
                            group.put("minSelections", rows.getInt(6));
                            group.put("maxSelections", rows.getInt(7));
                            group.put("displayOrder", rows.getInt(8));
                            group.putArray("components");
                            groups.put(groupRef, group);
                        }
                        UUID componentRef = rows.getObject(9, UUID.class);
                        if (componentRef == null) continue;
                        ObjectNode component = group.withArray("components").addObject();
                        component.put("itemRef", rows.getObject(10, UUID.class).toString());
                        if (rows.getObject(11) == null) component.putNull("productSkuRef");
                        else
                            component.put(
                                    "productSkuRef",
                                    rows.getObject(11, UUID.class).toString());
                        component.put("itemCode", rows.getString(18));
                        String itemName = rows.getString(19);
                        // spotless:off
                        if (itemName == null || itemName.isBlank())
                            throw new CatalogOwnerApi.Problem(
                                    "RESULT_UNKNOWN", 500, "套餐内容的商品名称读取失败");
                        // spotless:on
                        component.put("itemName", itemName);
                        if (rows.getString(20) == null) component.putNull("skuCode");
                        else component.put("skuCode", rows.getString(20));
                        String skuName = rows.getString(21);
                        // spotless:off
                        if (rows.getObject(11) != null && (skuName == null || skuName.isBlank()))
                            throw new CatalogOwnerApi.Problem(
                                    "RESULT_UNKNOWN", 500, "套餐内容的规格名称读取失败");
                        // spotless:on
                        if (skuName == null) component.putNull("skuName");
                        else component.put("skuName", skuName);
                        component.put(
                                "quantity",
                                rows.getBigDecimal(12).stripTrailingZeros().toPlainString());
                        component.put("unit", rows.getString(13));
                        component.put("default", rows.getBoolean(14));
                        if (rows.getObject(15) == null) component.putNull("extraPrice");
                        else component.put("extraPrice", rows.getLong(15));
                        component.put("status", rows.getString(16));
                        component.put("displayOrder", rows.getInt(17));
                    }
                    return null;
                });
        return Map.copyOf(result);
    }

    public void replace(UUID itemRef, ArrayNode submittedGroups) {
        List<Group> groups = normalize(submittedGroups);
        Map<String, ExistingGroup> existing = existingGroups(itemRef);
        boolean groupOrderChanges = groups.stream()
                .anyMatch(group -> existing.containsKey(group.code())
                        && existing.get(group.code()).displayOrder() != group.displayOrder());
        if (groupOrderChanges)
            jdbc.update(
                    CatalogCompositeFactsSql
                            .CATALOG_COMPOSITE_FACTS_UPDATE_CATALOG_COMPOSITE_GROUP_DISPLAY_ORDER_ITEM_REF,
                    itemRef);
        LinkedHashSet<String> retainedCodes = new LinkedHashSet<>();
        for (Group group : groups) {
            retainedCodes.add(group.code());
            ExistingGroup current = existing.get(group.code());
            UUID groupRef = current == null ? UUID.randomUUID() : current.ref();
            if (current == null) {
                jdbc.update(
                        CatalogCompositeFactsSql.CATALOG_COMPOSITE_FACTS_INSERT_INTO
                                + CatalogCompositeFactsSql
                                        .CATALOG_COMPOSITE_FACTS_CATALOG_CATALOG_COMPOSITE_GROUP_COMPOSITE_GROUP_REF_ITEM_REF_GROUP_CODE_GROUP_NAME_SELECTION_RULE_MIN_SELECTIONS_MAX_SELECTIONS_DISPLAY_ORDER_MIN_SELECTIONS_MAX_SELECTIONS_DISPLAY_ORDER_VALUES,
                        groupRef,
                        itemRef,
                        group.code(),
                        group.name(),
                        group.selectionRule(),
                        group.minSelections(),
                        group.maxSelections(),
                        group.displayOrder());
            } else if (groupOrderChanges || !current.matches(group)) {
                jdbc.update(
                        CatalogCompositeFactsSql
                                        .CATALOG_COMPOSITE_FACTS_UPDATE_CATALOG_COMPOSITE_GROUP_UPDATE_CATALOG_CATALOG_COMPO
                                + CatalogCompositeFactsSql
                                        .CATALOG_COMPOSITE_FACTS_GROUP_NAME_SELECTION_RULE_MIN_SELECTIONS_MAX_SELECTIONS
                                + CatalogCompositeFactsSql.CATALOG_COMPOSITE_FACTS_WHERE
                                + CatalogCompositeFactsSql.CATALOG_COMPOSITE_FACTS_COMPOSITE_GROUP_REF,
                        group.name(),
                        group.selectionRule(),
                        group.minSelections(),
                        group.maxSelections(),
                        group.displayOrder(),
                        groupRef);
            }
            replaceComponents(groupRef, group.components());
        }
        existing.entrySet().stream()
                .filter(entry -> !retainedCodes.contains(entry.getKey()))
                .map(entry -> entry.getValue().ref())
                .forEach(groupRef -> {
                    jdbc.update(
                            CatalogCompositeFactsSql
                                    .CATALOG_COMPOSITE_FACTS_DELETE_CATALOG_COMPOSITE_COMPONENT_COMPOSITE_GROUP_REF,
                            groupRef);
                    jdbc.update(
                            CatalogCompositeFactsSql
                                    .CATALOG_COMPOSITE_FACTS_DELETE_CATALOG_COMPOSITE_GROUP_COMPOSITE_GROUP_REF,
                            groupRef);
                });
    }

    /** Inserts composite facts for freshly-created copy targets in two owner-local batches. */
    public void insertForCopy(Map<UUID, ArrayNode> groupsByItem) {
        List<CopyGroup> groups = new ArrayList<>();
        if (groupsByItem != null)
            for (Map.Entry<UUID, ArrayNode> entry : groupsByItem.entrySet()) {
                for (Group group : normalize(entry.getValue()))
                    groups.add(new CopyGroup(UUID.randomUUID(), entry.getKey(), group));
            }
        if (groups.isEmpty()) return;
        List<Object[]> groupRows = new ArrayList<>();
        List<Object[]> componentRows = new ArrayList<>();
        for (CopyGroup copyGroup : groups) {
            Group group = copyGroup.group();
            groupRows.add(new Object[] {
                copyGroup.ref(),
                copyGroup.itemRef(),
                group.code(),
                group.name(),
                group.selectionRule(),
                group.minSelections(),
                group.maxSelections(),
                group.displayOrder()
            });
            for (Component component : group.components())
                componentRows.add(new Object[] {
                    UUID.randomUUID(),
                    copyGroup.ref(),
                    component.itemRef(),
                    component.productSkuRef(),
                    component.quantity(),
                    component.unit(),
                    component.isDefault(),
                    component.extraPrice(),
                    component.status(),
                    component.displayOrder()
                });
        }
        jdbc.batchUpdate(
                CatalogCompositeFactsSql.CATALOG_COMPOSITE_FACTS_INSERT_INTO_ALTERNATE_A
                        + CatalogCompositeFactsSql
                                .CATALOG_COMPOSITE_FACTS_CATALOG_CATALOG_COMPOSITE_GROUP_COMPOSITE_GROUP_REF_ITEM_REF_GROUP_CODE_GROUP_NAME_SELECTION_RULE_MIN_SELECTIONS_MAX_SELECTIONS_DISPLAY_ORDER_MIN_SELECTIONS_MAX_SELECTIONS_DISPLAY_ORDER_VALUES_ALTERNATE_A,
                groupRows);
        if (!componentRows.isEmpty())
            jdbc.batchUpdate(
                    CatalogCompositeFactsSql.CATALOG_COMPOSITE_FACTS_INSERT_INTO_ALTERNATE_B
                            + CatalogCompositeFactsSql
                                    .CATALOG_COMPOSITE_FACTS_CATALOG_CATALOG_COMPOSITE_COMPONENT_COMPOSITE_COMPONENT_REF_COMPOSITE_GROUP_REF_COMPONENT_ITEM_REF_PRODUCT_SKU_REF_QUANTITY_UNIT_IS_DEFAULT_EXTRA_PRICE_IS_DEFAULT_EXTRA_PRICE_STATUS_DISPLAY_ORDER
                            + CatalogCompositeFactsSql.CATALOG_COMPOSITE_FACTS_VALUES,
                    componentRows);
    }

    private Map<String, ExistingGroup> existingGroups(UUID itemRef) {
        return jdbc.query(
                CatalogCompositeFactsSql.CATALOG_COMPOSITE_FACTS_SELECT_ALTERNATE_A
                        + CatalogCompositeFactsSql
                                .CATALOG_COMPOSITE_FACTS_COMPOSITE_GROUP_REF_GROUP_CODE_GROUP_NAME_SELECTION_RULE_MIN_SELECTIONS_MAX_SELECTIONS_DISPLAY_ORDER_FROM_CATALOG_CATALOG_COMPOSITE_GROUP_CATALOG_CATALOG_COMPOSITE_GROUP_WHERE_ITEM_REF,
                rows -> {
                    Map<String, ExistingGroup> groups = new LinkedHashMap<>();
                    while (rows.next())
                        groups.put(
                                rows.getString(2),
                                new ExistingGroup(
                                        rows.getObject(1, UUID.class),
                                        rows.getString(3),
                                        rows.getString(4),
                                        rows.getInt(5),
                                        rows.getInt(6),
                                        rows.getInt(7)));
                    return groups;
                },
                itemRef);
    }

    private void replaceComponents(UUID groupRef, List<Component> components) {
        Map<Integer, ExistingComponent> existing = jdbc.query(
                CatalogCompositeFactsSql.CATALOG_COMPOSITE_FACTS_SELECT_ALTERNATE_B
                        + CatalogCompositeFactsSql
                                .CATALOG_COMPOSITE_FACTS_COMPOSITE_COMPONENT_REF_COMPONENT_ITEM_REF_PRODUCT_SKU_REF_QUANTITY_UNIT_IS_DEFAULT_EXTRA_PRICE_QUANTITY_UNIT_IS_DEFAULT_EXTRA_PRICE
                        + CatalogCompositeFactsSql.CATALOG_COMPOSITE_FACTS_CATALOG_COMPOSITE_COMPONENT_ALTERNATE_B,
                rows -> {
                    Map<Integer, ExistingComponent> values = new LinkedHashMap<>();
                    while (rows.next())
                        values.put(
                                rows.getInt(9),
                                new ExistingComponent(
                                        rows.getObject(1, UUID.class),
                                        rows.getObject(2, UUID.class),
                                        rows.getObject(3, UUID.class),
                                        rows.getBigDecimal(4),
                                        rows.getString(5),
                                        rows.getBoolean(6),
                                        rows.getObject(7, Long.class),
                                        rows.getString(8),
                                        rows.getInt(9)));
                    return values;
                },
                groupRef);
        boolean orderChanges = components.stream()
                .anyMatch(component -> existing.containsKey(component.displayOrder())
                        && !existing.get(component.displayOrder()).sameIdentity(component));
        if (orderChanges)
            jdbc.update(
                    CatalogCompositeFactsSql.CATALOG_COMPOSITE_FACTS_UPDATE_CATALOG_COMPOSITE_COMPONENT_DISPLAY_ORDER
                            + CatalogCompositeFactsSql.CATALOG_COMPOSITE_FACTS_COMPOSITE_GROUP_REF_ALTERNATE_A,
                    groupRef);
        LinkedHashSet<Integer> retainedOrders = new LinkedHashSet<>();
        for (Component component : components) {
            retainedOrders.add(component.displayOrder());
            ExistingComponent current = existing.get(component.displayOrder());
            if (current == null) {
                jdbc.update(
                        CatalogCompositeFactsSql.CATALOG_COMPOSITE_FACTS_INSERT_INTO_ALTERNATE_C
                                + CatalogCompositeFactsSql
                                        .CATALOG_COMPOSITE_FACTS_CATALOG_CATALOG_COMPOSITE_COMPONENT_COMPOSITE_COMPONENT_REF_COMPOSITE_GROUP_REF_COMPONENT_ITEM_REF_PRODUCT_SKU_REF_QUANTITY_UNIT_IS_DEFAULT_EXTRA_PRICE_IS_DEFAULT_EXTRA_PRICE_STATUS_DISPLAY_ORDER_ALTERNATE_A
                                + CatalogCompositeFactsSql.CATALOG_COMPOSITE_FACTS_CLOSE_PAREN
                                + CatalogCompositeFactsSql.CATALOG_COMPOSITE_FACTS_VALUES_ALTERNATE_A,
                        UUID.randomUUID(),
                        groupRef,
                        component.itemRef(),
                        component.productSkuRef(),
                        component.quantity(),
                        component.unit(),
                        component.isDefault(),
                        component.extraPrice(),
                        component.status(),
                        component.displayOrder());
            } else if (orderChanges || !current.matches(component)) {
                jdbc.update(
                        CatalogCompositeFactsSql
                                        .CATALOG_COMPOSITE_FACTS_UPDATE_CATALOG_COMPOSITE_COMPONENT_UPDATE_CATALOG_CATALOG_COMPO
                                + CatalogCompositeFactsSql
                                        .CATALOG_COMPOSITE_FACTS_COMPONENT_ITEM_REF_PRODUCT_SKU_REF_QUANTITY_UNIT
                                + CatalogCompositeFactsSql
                                        .CATALOG_COMPOSITE_FACTS_STATUS_DISPLAY_ORDER_WHERE_COMPOSITE_COMPONENT_REF_STATUS_DISPLAY_ORDER_WHERE_COMPOSITE_COMPONENT_REF,
                        component.itemRef(),
                        component.productSkuRef(),
                        component.quantity(),
                        component.unit(),
                        component.isDefault(),
                        component.extraPrice(),
                        component.status(),
                        component.displayOrder(),
                        current.ref());
            }
        }
        existing.entrySet().stream()
                .filter(entry -> !retainedOrders.contains(entry.getKey()))
                .map(entry -> entry.getValue().ref())
                .forEach(ref -> jdbc.update(
                        CatalogCompositeFactsSql
                                .CATALOG_COMPOSITE_FACTS_DELETE_CATALOG_COMPOSITE_COMPONENT_COMPOSITE_COMPONENT_REF,
                        ref));
    }

    private static List<Group> normalize(ArrayNode submittedGroups) {
        if (submittedGroups == null) return List.of();
        List<Group> result = new ArrayList<>();
        LinkedHashSet<String> groupCodes = new LinkedHashSet<>();
        int groupOrder = 0;
        for (JsonNode value : submittedGroups) {
            if (!value.isObject()) throw problem("compositeGroups must contain objects");
            String code = required(value, "groupCode", "code");
            if (!groupCodes.add(code)) throw problem("compositeGroups cannot contain duplicate groupCode");
            String name = required(value, "groupName", "name");
            String selectionRule = text(value, "selectionRule", "selectionMode", "REQUIRED");
            int min = value.path("minSelections").asInt(0);
            int max = value.has("maxSelections") ? value.path("maxSelections").asInt(min) : min;
            if (min < 0 || max < min) throw problem("composite group selection range is invalid");
            int displayOrder =
                    value.has("displayOrder") ? value.path("displayOrder").asInt() : groupOrder;
            if (displayOrder < 0) throw problem("composite group displayOrder must not be negative");
            JsonNode values = value.path("components").isArray() ? value.path("components") : value.path("items");
            List<Component> components = new ArrayList<>();
            int componentOrder = 0;
            LinkedHashSet<Integer> componentOrders = new LinkedHashSet<>();
            if (values.isArray())
                for (JsonNode component : values) {
                    UUID itemRef = uuid(component, "itemRef");
                    UUID skuRef = optionalUuid(component, "productSkuRef");
                    BigDecimal quantity;
                    try {
                        quantity = new BigDecimal(text(component, "quantity", null, "1"));
                    } catch (NumberFormatException failure) {
                        throw problem("component quantity is invalid", failure);
                    }
                    if (quantity.signum() <= 0) throw problem("component quantity must be positive");
                    String unit = text(component, "unit", null, "");
                    int order = component.has("displayOrder")
                            ? component.path("displayOrder").asInt()
                            : componentOrder;
                    if (order < 0) throw problem("component displayOrder must not be negative");
                    if (!componentOrders.add(order)) throw problem("components cannot contain duplicate displayOrder");
                    Long extraPrice = component.path("extraPrice").isIntegralNumber()
                            ? component.path("extraPrice").asLong()
                            : null;
                    components.add(new Component(
                            itemRef,
                            skuRef,
                            quantity,
                            unit,
                            component.path("default").asBoolean(false),
                            extraPrice,
                            text(component, "status", null, "ENABLED"),
                            order));
                    componentOrder++;
                }
            result.add(new Group(code, name, selectionRule, min, max, displayOrder, List.copyOf(components)));
            groupOrder++;
        }
        return List.copyOf(result);
    }

    private static UUID uuid(JsonNode node, String field) {
        UUID value = optionalUuid(node, field);
        if (value == null) throw problem(field + " is required");
        return value;
    }

    private static UUID optionalUuid(JsonNode node, String field) {
        if (!node.hasNonNull(field)) return null;
        try {
            return UUID.fromString(node.path(field).asText());
        } catch (IllegalArgumentException failure) {
            throw problem(field + " must be UUID", failure);
        }
    }

    private static String required(JsonNode node, String primary, String legacy) {
        String value = text(node, primary, legacy, "");
        if (value.isBlank()) throw problem(primary + " is required");
        return value;
    }

    private static String text(JsonNode node, String primary, String legacy, String fallback) {
        String value = node.path(primary).asText("");
        if (value.isBlank() && legacy != null) value = node.path(legacy).asText("");
        return value.isBlank() ? fallback : value;
    }

    private static CatalogOwnerApi.Problem problem(String message) {
        return new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, message);
    }

    private static CatalogOwnerApi.Problem problem(String message, Throwable cause) {
        return new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, message, cause);
    }

    private record ExistingGroup(
            UUID ref, String name, String selectionRule, int minSelections, int maxSelections, int displayOrder) {
        boolean matches(Group group) {
            return name.equals(group.name())
                    && selectionRule.equals(group.selectionRule())
                    && minSelections == group.minSelections()
                    && maxSelections == group.maxSelections()
                    && displayOrder == group.displayOrder();
        }
    }

    private record ExistingComponent(
            UUID ref,
            UUID itemRef,
            UUID productSkuRef,
            BigDecimal quantity,
            String unit,
            boolean isDefault,
            Long extraPrice,
            String status,
            int displayOrder) {
        boolean sameIdentity(Component component) {
            return displayOrder == component.displayOrder();
        }

        boolean matches(Component component) {
            return itemRef.equals(component.itemRef())
                    && java.util.Objects.equals(productSkuRef, component.productSkuRef())
                    && quantity.compareTo(component.quantity()) == 0
                    && unit.equals(component.unit())
                    && isDefault == component.isDefault()
                    && java.util.Objects.equals(extraPrice, component.extraPrice())
                    && status.equals(component.status())
                    && displayOrder == component.displayOrder();
        }
    }

    private record Group(
            String code,
            String name,
            String selectionRule,
            int minSelections,
            int maxSelections,
            int displayOrder,
            List<Component> components) {}

    private record Component(
            UUID itemRef,
            UUID productSkuRef,
            BigDecimal quantity,
            String unit,
            boolean isDefault,
            Long extraPrice,
            String status,
            int displayOrder) {}

    private record CopyGroup(UUID ref, UUID itemRef, Group group) {}
}
