package com.catering.v2s.catalog.application;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;

/** Order-option group and value identities are relational; the owner rebuilds the established nested response shape. */
final class CatalogOrderOptionFacts {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    CatalogOrderOptionFacts(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    Map<UUID, ArrayNode> readByItemRefs(Collection<UUID> itemRefs) {
        if (itemRefs == null || itemRefs.isEmpty()) return Map.of();
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        String placeholders = String.join(",", Collections.nCopies(refs.size(), "?"));
        Map<UUID, ArrayNode> result = new LinkedHashMap<>();
        Map<UUID, ObjectNode> groups = new LinkedHashMap<>();
        refs.forEach(ref -> result.put(ref, mapper.createArrayNode()));
        jdbc.query(
                "SELECT "
                        + "group_row.item_ref,group_row.order_option_group_ref,group_row.group_code,group_row.group_nam"
                        + "e,gr"
                        + "oup_row.selection_mode,group_row.is_required,group_row.display_order,value_row.order_option_"
                        + "valu"
                        + "e_ref,value_row.value_code,value_row.value_name,value_row.is_default,value_row.attribute_val"
                        + "ue_r"
                        + "ef,value_row.extra_price,value_row.production_effects::text,value_row.display_order FROM "
                        + "catalog.catalog_order_option_group group_row LEFT JOIN catalog.catalog_order_option_value "
                        + "value_row ON value_row.order_option_group_ref=group_row.order_option_group_ref WHERE "
                        + "group_row.item_ref IN ("
                        + placeholders
                        + ") ORDER BY "
                        + "group_row.item_ref,group_row.display_order,group_row.group_code,value_row.display_order,"
                        + "value_row.order_option_value_ref",
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
                            group.put("selectionMode", rows.getString(5));
                            group.put("required", rows.getBoolean(6));
                            group.put("displayOrder", rows.getInt(7));
                            group.putArray("values");
                            groups.put(groupRef, group);
                        }
                        UUID valueRef = rows.getObject(8, UUID.class);
                        if (valueRef == null) continue;
                        ObjectNode value = group.withArray("values").addObject();
                        value.put("valueRef", valueRef.toString());
                        value.put("code", rows.getString(9));
                        value.put("name", rows.getString(10));
                        value.put("default", rows.getBoolean(11));
                        if (rows.getObject(12) == null) value.putNull("attributeValueRef");
                        else
                            value.put(
                                    "attributeValueRef",
                                    rows.getObject(12, UUID.class).toString());
                        if (rows.getObject(13) == null) value.putNull("extraPrice");
                        else value.put("extraPrice", rows.getLong(13));
                        try {
                            JsonNode effects = mapper.readTree(rows.getString(14));
                            value.set("productionEffects", effects.isArray() ? effects : mapper.createArrayNode());
                        } catch (Exception failure) {
                            throw new IllegalStateException(
                                    "order option production effects are invalid JSON", failure);
                        }
                        value.put("displayOrder", rows.getInt(15));
                    }
                    return null;
                });
        return Map.copyOf(result);
    }

    void replace(UUID itemRef, ArrayNode submittedGroups) {
        List<Group> groups = normalize(submittedGroups);
        Map<String, ExistingGroup> existing = existingGroups(itemRef);
        boolean groupOrderChanges = groups.stream()
                .anyMatch(group -> existing.containsKey(group.code())
                        && existing.get(group.code()).displayOrder() != group.displayOrder());
        boolean groupOrderCollision = groups.stream().anyMatch(group -> existing.entrySet().stream()
                .anyMatch(entry -> entry.getValue().displayOrder() == group.displayOrder()
                        && !entry.getKey().equals(group.code())));
        boolean shiftGroupOrders = groupOrderChanges || groupOrderCollision;
        if (shiftGroupOrders)
            jdbc.update(
                    "UPDATE catalog.catalog_order_option_group SET display_order=display_order+1000000 WHERE "
                            + "item_ref=?",
                    itemRef);
        LinkedHashSet<String> retainedCodes = new LinkedHashSet<>();
        for (Group group : groups) {
            retainedCodes.add(group.code());
            ExistingGroup current = existing.get(group.code());
            UUID groupRef = current == null ? UUID.randomUUID() : current.ref();
            if (current == null) {
                jdbc.update(
                        "INSERT INTO "
                                + "catalog.catalog_order_option_group(order_option_group_ref,item_ref,group_code,group_"
                                + "name"
                                + ",selection_mode,is_required,display_order) VALUES(?,?,?,?,?,?,?)",
                        groupRef,
                        itemRef,
                        group.code(),
                        group.name(),
                        group.selectionMode(),
                        group.required(),
                        group.displayOrder());
            } else if (shiftGroupOrders || !current.matches(group)) {
                jdbc.update(
                        "UPDATE catalog.catalog_order_option_group SET "
                                + "group_name=?,selection_mode=?,is_required=?,display_order=? WHERE "
                                + "order_option_group_ref=?",
                        group.name(),
                        group.selectionMode(),
                        group.required(),
                        group.displayOrder(),
                        groupRef);
            }
            replaceValues(groupRef, group.values());
        }
        existing.entrySet().stream()
                .filter(entry -> !retainedCodes.contains(entry.getKey()))
                .map(entry -> entry.getValue().ref())
                .forEach(groupRef -> {
                    jdbc.update(
                            "DELETE FROM catalog.catalog_order_option_value WHERE order_option_group_ref=?", groupRef);
                    jdbc.update(
                            "DELETE FROM catalog.catalog_order_option_group WHERE order_option_group_ref=?", groupRef);
                });
    }

    /** Inserts option facts for freshly-created copy targets in two owner-local batches. */
    void insertForCopy(Map<UUID, ArrayNode> groupsByItem) {
        List<CopyGroup> groups = new ArrayList<>();
        if (groupsByItem != null)
            for (Map.Entry<UUID, ArrayNode> entry : groupsByItem.entrySet()) {
                for (Group group : normalize(entry.getValue()))
                    groups.add(new CopyGroup(UUID.randomUUID(), entry.getKey(), group));
            }
        if (groups.isEmpty()) return;
        List<Object[]> groupRows = new ArrayList<>();
        List<Object[]> valueRows = new ArrayList<>();
        for (CopyGroup copyGroup : groups) {
            Group group = copyGroup.group();
            groupRows.add(new Object[] {
                copyGroup.ref(),
                copyGroup.itemRef(),
                group.code(),
                group.name(),
                group.selectionMode(),
                group.required(),
                group.displayOrder()
            });
            for (Value value : group.values())
                valueRows.add(new Object[] {
                    UUID.randomUUID(),
                    copyGroup.ref(),
                    value.code(),
                    value.name(),
                    value.isDefault(),
                    value.attributeValueRef(),
                    value.extraPrice(),
                    value.productionEffects().toString(),
                    value.displayOrder()
                });
        }
        jdbc.batchUpdate(
                "INSERT INTO "
                        + "catalog.catalog_order_option_group(order_option_group_ref,item_ref,group_code,group_name,sel"
                        + "ecti"
                        + "on_mode,is_required,display_order) VALUES(?,?,?,?,?,?,?)",
                groupRows);
        if (!valueRows.isEmpty())
            jdbc.batchUpdate(
                    "INSERT INTO "
                            + "catalog.catalog_order_option_value(order_option_value_ref,order_option_group_ref,value_c"
                            + "ode,"
                            + "value_name,is_default,attribute_value_ref,extra_price,production_effects,display_order) "
                            + "VALUES(?,?,?,?,?,?,?,CAST(? AS JSONB),?)",
                    valueRows);
    }

    private Map<String, ExistingGroup> existingGroups(UUID itemRef) {
        return jdbc.query(
                "SELECT order_option_group_ref,group_code,group_name,selection_mode,is_required,display_order FROM "
                        + "catalog.catalog_order_option_group WHERE item_ref=?",
                rows -> {
                    Map<String, ExistingGroup> groups = new LinkedHashMap<>();
                    while (rows.next())
                        groups.put(
                                rows.getString(2),
                                new ExistingGroup(
                                        rows.getObject(1, UUID.class),
                                        rows.getString(3),
                                        rows.getString(4),
                                        rows.getBoolean(5),
                                        rows.getInt(6)));
                    return groups;
                },
                itemRef);
    }

    private void replaceValues(UUID groupRef, List<Value> values) {
        Map<String, ExistingValue> existing = jdbc.query(
                "SELECT "
                        + "order_option_value_ref,value_code,value_name,is_default,attribute_value_ref,extra_price,prod"
                        + "ucti"
                        + "on_effects::text,display_order FROM catalog.catalog_order_option_value WHERE "
                        + "order_option_group_ref=?",
                rows -> {
                    Map<String, ExistingValue> result = new LinkedHashMap<>();
                    while (rows.next())
                        result.put(
                                rows.getString(2),
                                new ExistingValue(
                                        rows.getObject(1, UUID.class),
                                        rows.getString(3),
                                        rows.getBoolean(4),
                                        rows.getObject(5, UUID.class),
                                        rows.getObject(6, Long.class),
                                        json(rows.getString(7)),
                                        rows.getInt(8)));
                    return result;
                },
                groupRef);
        boolean orderChanges = values.stream()
                .anyMatch(value -> existing.containsKey(value.code())
                        && existing.get(value.code()).displayOrder() != value.displayOrder());
        boolean orderCollision = values.stream().anyMatch(value -> existing.entrySet().stream()
                .anyMatch(entry -> entry.getValue().displayOrder() == value.displayOrder()
                        && !entry.getKey().equals(value.code())));
        boolean shiftValueOrders = orderChanges || orderCollision;
        if (shiftValueOrders)
            jdbc.update(
                    "UPDATE catalog.catalog_order_option_value SET display_order=display_order+1000000 WHERE "
                            + "order_option_group_ref=?",
                    groupRef);
        LinkedHashSet<String> retainedCodes = new LinkedHashSet<>();
        for (Value value : values) {
            retainedCodes.add(value.code());
            ExistingValue current = existing.get(value.code());
            if (current == null) {
                jdbc.update(
                        "INSERT INTO "
                                + "catalog.catalog_order_option_value(order_option_value_ref,order_option_group_ref,val"
                                + "ue_c"
                                + "ode,value_name,is_default,attribute_value_ref,extra_price,production_effects,display"
                                + "_ord"
                                + "er) VALUES(?,?,?,?,?,?,?,CAST(? AS JSONB),?)",
                        UUID.randomUUID(),
                        groupRef,
                        value.code(),
                        value.name(),
                        value.isDefault(),
                        value.attributeValueRef(),
                        value.extraPrice(),
                        value.productionEffects().toString(),
                        value.displayOrder());
            } else if (shiftValueOrders || !current.matches(value)) {
                jdbc.update(
                        "UPDATE catalog.catalog_order_option_value SET "
                                + "value_name=?,is_default=?,attribute_value_ref=?,extra_price=?,production_effects=CAS"
                                + "T(? "
                                + "AS JSONB),display_order=? WHERE order_option_value_ref=?",
                        value.name(),
                        value.isDefault(),
                        value.attributeValueRef(),
                        value.extraPrice(),
                        value.productionEffects().toString(),
                        value.displayOrder(),
                        current.ref());
            }
        }
        existing.entrySet().stream()
                .filter(entry -> !retainedCodes.contains(entry.getKey()))
                .map(entry -> entry.getValue().ref())
                .forEach(ref -> jdbc.update(
                        "DELETE FROM catalog.catalog_order_option_value WHERE order_option_value_ref=?", ref));
    }

    private static List<Group> normalize(ArrayNode submittedGroups) {
        if (submittedGroups == null) return List.of();
        List<Group> groups = new ArrayList<>();
        LinkedHashSet<String> codes = new LinkedHashSet<>();
        LinkedHashSet<Integer> groupOrders = new LinkedHashSet<>();
        int groupOrder = 0;
        for (JsonNode group : submittedGroups) {
            if (!group.isObject()) throw problem("orderOptions must contain objects");
            String code = required(group, "groupCode", "code");
            if (!codes.add(code)) throw problem("orderOptions cannot contain duplicate groupCode");
            String name = required(group, "groupName", "name");
            int displayOrder =
                    group.has("displayOrder") ? group.path("displayOrder").asInt() : groupOrder;
            if (displayOrder < 0) throw problem("order option displayOrder must not be negative");
            if (!groupOrders.add(displayOrder)) throw problem("orderOptions cannot contain duplicate displayOrder");
            JsonNode submittedValues = group.path("values").isArray() ? group.path("values") : group.path("options");
            List<Value> values = new ArrayList<>();
            LinkedHashSet<String> valueCodes = new LinkedHashSet<>();
            LinkedHashSet<Integer> valueOrders = new LinkedHashSet<>();
            int valueOrder = 0;
            if (submittedValues.isArray())
                for (JsonNode value : submittedValues) {
                    String valueCode = required(value, "code", "valueCode");
                    if (!valueCodes.add(valueCode)) throw problem("order option values cannot contain duplicate code");
                    int order = value.has("displayOrder")
                            ? value.path("displayOrder").asInt()
                            : valueOrder;
                    if (order < 0) throw problem("order option value displayOrder must not be negative");
                    if (!valueOrders.add(order))
                        throw problem("order option values cannot contain duplicate displayOrder");
                    values.add(new Value(
                            valueCode,
                            required(value, "name", "valueName"),
                            value.path("default").asBoolean(false),
                            optionalUuid(value, "attributeValueRef"),
                            value.path("extraPrice").isIntegralNumber()
                                    ? value.path("extraPrice").asLong()
                                    : null,
                            value.path("productionEffects").isArray()
                                    ? value.path("productionEffects").deepCopy()
                                    : com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.arrayNode(),
                            order));
                    valueOrder++;
                }
            groups.add(new Group(
                    code,
                    name,
                    text(group, "selectionMode", "selectionRule", "SINGLE"),
                    group.path("required").asBoolean(false),
                    displayOrder,
                    List.copyOf(values)));
            groupOrder++;
        }
        return List.copyOf(groups);
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
        String result = text(node, primary, legacy, "");
        if (result.isBlank()) throw problem(primary + " is required");
        return result;
    }

    private static String text(JsonNode node, String primary, String legacy, String fallback) {
        String result = node.path(primary).asText("");
        if (result.isBlank() && legacy != null) result = node.path(legacy).asText("");
        return result.isBlank() ? fallback : result;
    }

    private static CatalogOwnerApi.Problem problem(String message) {
        return new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, message);
    }

    private static CatalogOwnerApi.Problem problem(String message, Throwable cause) {
        return new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, message, cause);
    }

    private JsonNode json(String value) {
        try {
            return mapper.readTree(value);
        } catch (Exception failure) {
            throw new IllegalStateException("order option production effects are invalid JSON", failure);
        }
    }

    private record ExistingGroup(UUID ref, String name, String selectionMode, boolean required, int displayOrder) {
        boolean matches(Group group) {
            return name.equals(group.name())
                    && selectionMode.equals(group.selectionMode())
                    && required == group.required()
                    && displayOrder == group.displayOrder();
        }
    }

    private record ExistingValue(
            UUID ref,
            String name,
            boolean isDefault,
            UUID attributeValueRef,
            Long extraPrice,
            JsonNode productionEffects,
            int displayOrder) {
        boolean matches(Value value) {
            return name.equals(value.name())
                    && isDefault == value.isDefault()
                    && java.util.Objects.equals(attributeValueRef, value.attributeValueRef())
                    && java.util.Objects.equals(extraPrice, value.extraPrice())
                    && productionEffects.equals(value.productionEffects())
                    && displayOrder == value.displayOrder();
        }
    }

    private record Group(
            String code, String name, String selectionMode, boolean required, int displayOrder, List<Value> values) {}

    private record Value(
            String code,
            String name,
            boolean isDefault,
            UUID attributeValueRef,
            Long extraPrice,
            JsonNode productionEffects,
            int displayOrder) {}

    private record CopyGroup(UUID ref, UUID itemRef, Group group) {}
}
