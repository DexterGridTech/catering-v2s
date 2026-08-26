package com.catering.v2s.catalog.application;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Owner-local typed preparation facts. Profiles remain parent JSONB because they have no independent lifecycle; this
 * class only owns their persistence and readback, not shape admission or UI vocabulary.
 */
final class CatalogPreparationFacts {
    private static final java.util.Set<String> PROFILE_FIELDS =
            java.util.Set.of("productionDisplayName", "estimatedPreparationSeconds", "preparationNotes");
    private static final java.util.Set<String> EFFECT_FIELDS =
            java.util.Set.of("instruction", "preparationSecondsDelta");

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    CatalogPreparationFacts(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    void validateProfile(JsonNode profile) {
        if (profile == null || profile.isMissingNode() || profile.isNull()) return;
        if (!profile.isObject()) throw problem("CATALOG_PREPARATION_TARGET_MISMATCH", "制作信息必须是对象");
        for (String field : iterable(profile.fieldNames())) {
            if (!PROFILE_FIELDS.contains(field)) {
                throw problem("CATALOG_PREPARATION_UNKNOWN_FIELD", "制作信息包含不支持的字段");
            }
        }
        validateText(profile, "productionDisplayName", 120, "制作单显示名称");
        validateText(profile, "preparationNotes", 1000, "制作说明");
        validateNonNegativeInteger(profile, "estimatedPreparationSeconds", "预计制作时长");
    }

    void validateOverride(JsonNode override) {
        if (override == null || override.isMissingNode() || override.isNull()) return;
        if (!override.isObject()) throw problem("CATALOG_PREPARATION_TARGET_MISMATCH", "规格制作设置无效");
        for (String field : iterable(override.fieldNames()))
            if (!java.util.Set.of("mode", "profile").contains(field))
                throw problem("CATALOG_PREPARATION_UNKNOWN_FIELD", "规格制作设置包含不支持的字段");
        String mode = override.path("mode").asText("");
        JsonNode profile = override.get("profile");
        if ("INHERIT_ITEM".equals(mode)) {
            if (profile != null && !profile.isNull()) {
                // spotless:off
                throw problem(
                    "CATALOG_PREPARATION_TARGET_MISMATCH",
                    "使用商品默认制作信息时不能填写单独设置"
                );
                // spotless:on
            }
        } else if ("OVERRIDE".equals(mode)) {
            if (profile == null || profile.isNull()) {
                // spotless:off
                throw problem(
                    "CATALOG_PREPARATION_TARGET_MISMATCH",
                    "单独设置制作信息时必须填写完整内容"
                );
                // spotless:on
            }
            validateProfile(profile);
        } else throw problem("CATALOG_PREPARATION_TARGET_MISMATCH", "规格制作设置方式无效");
    }

    void validateEffect(JsonNode effect) {
        if (effect == null || effect.isMissingNode() || effect.isNull()) return;
        if (!effect.isObject()) {
            throw problem("CATALOG_PREPARATION_TARGET_MISMATCH", "选项制作变化必须是对象");
        }
        for (String field : iterable(effect.fieldNames())) {
            if (!EFFECT_FIELDS.contains(field)) {
                throw problem("CATALOG_PREPARATION_UNKNOWN_FIELD", "选项制作变化包含不支持的字段");
            }
        }
        validateText(effect, "instruction", 1000, "追加制作说明");
        validateNonNegativeInteger(effect, "preparationSecondsDelta", "增加制作时长");
    }

    private void validateText(JsonNode object, String field, int maxLength, String label) {
        JsonNode value = object.get(field);
        if (value == null || value.isNull()) return;
        if (!value.isTextual() || value.asText().length() > maxLength) {
            // spotless:off
            throw problem(
                "CATALOG_PREPARATION_TARGET_MISMATCH",
                label + "长度不能超过" + maxLength + "个字符"
            );
            // spotless:on
        }
    }

    private void validateNonNegativeInteger(JsonNode object, String field, String label) {
        JsonNode value = object.get(field);
        if (value == null || value.isNull()) return;
        if (!value.isIntegralNumber() || new BigInteger(value.asText()).signum() < 0)
            throw problem("CATALOG_PREPARATION_DURATION_INVALID", label + "必须是非负整数");
    }

    private static CatalogOwnerApi.Problem problem(String code, String detail) {
        return new CatalogOwnerApi.Problem(code, 422, detail);
    }

    private static Iterable<String> iterable(java.util.Iterator<String> iterator) {
        return () -> iterator;
    }

    Map<UUID, JsonNode> readItemProfiles(Collection<UUID> itemRefs) {
        if (itemRefs == null || itemRefs.isEmpty()) return Map.of();
        List<UUID> refs = distinct(itemRefs);
        Map<UUID, JsonNode> result = new LinkedHashMap<>();
        jdbc.query(
                "SELECT item_ref,preparation_profile::text FROM catalog.catalog_item WHERE item_ref IN ("
                        + placeholders(refs.size())
                        + ")",
                statement -> bind(statement, refs),
                rows -> {
                    while (rows.next()) result.put(rows.getObject(1, UUID.class), parseNullable(rows.getString(2)));
                    return null;
                });
        return Collections.unmodifiableMap(new LinkedHashMap<>(result));
    }

    Map<UUID, JsonNode> readSkuOverrides(Collection<UUID> skuRefs) {
        if (skuRefs == null || skuRefs.isEmpty()) return Map.of();
        List<UUID> refs = distinct(skuRefs);
        Map<UUID, JsonNode> result = new LinkedHashMap<>();
        jdbc.query(
                "SELECT product_sku_ref,preparation_override::text FROM catalog.catalog_sku WHERE product_sku_ref IN ("
                        + placeholders(refs.size())
                        + ")",
                statement -> bind(statement, refs),
                rows -> {
                    while (rows.next()) result.put(rows.getObject(1, UUID.class), parseNullable(rows.getString(2)));
                    return null;
                });
        return Collections.unmodifiableMap(new LinkedHashMap<>(result));
    }

    Map<UUID, Map<UUID, JsonNode>> readOptionEffects(Collection<UUID> itemRefs) {
        if (itemRefs == null || itemRefs.isEmpty()) return Map.of();
        List<UUID> refs = distinct(itemRefs);
        String placeholders = placeholders(refs.size());
        Map<UUID, Map<UUID, JsonNode>> result = new LinkedHashMap<>();
        refs.forEach(ref -> result.put(ref, new LinkedHashMap<>()));
        jdbc.query(
                "SELECT config.item_ref,override.order_option_definition_value_ref,override.preparation_effect::text "
                        + "FROM catalog.catalog_item_order_option_config config JOIN "
                        + "catalog.catalog_item_order_option_value_override override ON "
                        + "override.item_order_option_config_ref=config.item_order_option_config_ref "
                        + "WHERE config.item_ref IN ("
                        + placeholders
                        + ") AND override.preparation_effect IS NOT NULL "
                        + "ORDER BY config.item_ref,override.order_option_definition_value_ref",
                statement -> bind(statement, refs),
                rows -> {
                    while (rows.next())
                        result.get(rows.getObject(1, UUID.class))
                                .put(rows.getObject(2, UUID.class), parseNullable(rows.getString(3)));
                    return null;
                });
        Map<UUID, Map<UUID, JsonNode>> copy = new LinkedHashMap<>();
        result.forEach((itemRef, effects) -> copy.put(itemRef, Map.copyOf(effects)));
        return Map.copyOf(copy);
    }

    /**
     * Detail hydration needs the three preparation fact families together. They remain separate persisted facts, but a
     * detail request must not pay three database round trips merely to reconstruct one owner-owned read model.
     */
    DetailReadback readDetailFacts(Collection<UUID> itemRefs, Collection<UUID> skuRefs) {
        if (itemRefs == null || itemRefs.isEmpty()) return DetailReadback.empty();
        List<UUID> items = distinct(itemRefs);
        List<UUID> skus = skuRefs == null ? List.of() : distinct(skuRefs);
        Map<UUID, JsonNode> itemProfiles = new LinkedHashMap<>();
        Map<UUID, JsonNode> skuOverrides = new LinkedHashMap<>();
        Map<UUID, Map<UUID, JsonNode>> optionEffects = new LinkedHashMap<>();
        items.forEach(itemRef -> optionEffects.put(itemRef, new LinkedHashMap<>()));
        String itemPlaceholders = placeholders(items.size());
        StringBuilder sql = new StringBuilder(
                "SELECT 'ITEM' AS fact_kind,item_ref,NULL::uuid AS related_ref,preparation_profile::text AS value "
                        + "FROM catalog.catalog_item WHERE item_ref IN ("
                        + itemPlaceholders
                        + ") UNION ALL SELECT 'EFFECT',config.item_ref,override.order_option_definition_value_ref,"
                        + "override.preparation_effect::text FROM catalog.catalog_item_order_option_config config JOIN "
                        + "catalog.catalog_item_order_option_value_override override ON "
                        + "override.item_order_option_config_ref=config.item_order_option_config_ref WHERE "
                        + "config.item_ref IN ("
                        + itemPlaceholders
                        + ") AND override.preparation_effect IS NOT NULL");
        if (!skus.isEmpty())
            sql.append(" UNION ALL SELECT 'SKU',sku.item_ref,sku.product_sku_ref,sku.preparation_override::text "
                            + "FROM catalog.catalog_sku sku WHERE sku.product_sku_ref IN (")
                    .append(placeholders(skus.size()))
                    .append(')');
        sql.append(" ORDER BY fact_kind,item_ref,related_ref");
        jdbc.query(
                sql.toString(),
                statement -> {
                    int index = 1;
                    for (UUID itemRef : items) statement.setObject(index++, itemRef);
                    for (UUID itemRef : items) statement.setObject(index++, itemRef);
                    for (UUID skuRef : skus) statement.setObject(index++, skuRef);
                },
                rows -> {
                    while (rows.next()) {
                        String factKind = rows.getString(1);
                        UUID itemRef = rows.getObject(2, UUID.class);
                        UUID relatedRef = rows.getObject(3, UUID.class);
                        JsonNode value = parseNullable(rows.getString(4));
                        switch (factKind) {
                            case "ITEM" -> itemProfiles.put(itemRef, value);
                            case "SKU" -> skuOverrides.put(relatedRef, value);
                            case "EFFECT" -> optionEffects
                                    .computeIfAbsent(itemRef, ignored -> new LinkedHashMap<>())
                                    .put(relatedRef, value);
                            default -> throw invalidDetailFactKind();
                        }
                    }
                    return null;
                });
        Map<UUID, Map<UUID, JsonNode>> immutableEffects = new LinkedHashMap<>();
        optionEffects.forEach((itemRef, effects) -> immutableEffects.put(itemRef, Map.copyOf(effects)));
        return new DetailReadback(
                Collections.unmodifiableMap(new LinkedHashMap<>(itemProfiles)),
                Collections.unmodifiableMap(new LinkedHashMap<>(skuOverrides)),
                Map.copyOf(immutableEffects));
    }

    private CatalogOwnerApi.Problem invalidDetailFactKind() {
        return new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "制作信息读取类型无效");
    }

    record DetailReadback(
            Map<UUID, JsonNode> itemProfiles,
            Map<UUID, JsonNode> skuOverrides,
            Map<UUID, Map<UUID, JsonNode>> optionEffects) {
        static DetailReadback empty() {
            return new DetailReadback(Map.of(), Map.of(), Map.of());
        }
    }

    void replaceItemProfile(UUID itemRef, JsonNode profile) {
        jdbc.update(
                "UPDATE catalog.catalog_item SET preparation_profile=CAST(? AS JSONB) WHERE item_ref=?",
                jsonOrNull(profile),
                itemRef);
    }

    void replaceSkuOverrides(UUID itemRef, Map<UUID, JsonNode> overrides) {
        jdbc.update("UPDATE catalog.catalog_sku SET preparation_override=NULL WHERE item_ref=?", itemRef);
        if (overrides == null || overrides.isEmpty()) return;
        List<Object[]> values = new ArrayList<>();
        for (Map.Entry<UUID, JsonNode> entry : overrides.entrySet())
            values.add(new Object[] {jsonOrNull(entry.getValue()), itemRef, entry.getKey()});
        jdbc.batchUpdate(
                "UPDATE catalog.catalog_sku SET preparation_override=CAST(? AS JSONB) "
                        + "WHERE item_ref=? AND product_sku_ref=?",
                values);
    }

    /** Replaces option effects only on the current item's existing override rows. */
    void replaceOptionEffects(UUID itemRef, Map<UUID, JsonNode> effects) {
        jdbc.update(
                "UPDATE catalog.catalog_item_order_option_value_override override SET preparation_effect=NULL "
                        + "FROM catalog.catalog_item_order_option_config config "
                        + "WHERE override.item_order_option_config_ref=config.item_order_option_config_ref "
                        + "AND config.item_ref=?",
                itemRef);
        if (effects == null || effects.isEmpty()) return;
        List<Object[]> values = new ArrayList<>();
        for (Map.Entry<UUID, JsonNode> entry : effects.entrySet())
            values.add(new Object[] {jsonOrNull(entry.getValue()), itemRef, entry.getKey()});
        jdbc.batchUpdate(
                "UPDATE catalog.catalog_item_order_option_value_override override "
                        + "SET preparation_effect=CAST(? AS JSONB) "
                        + "FROM catalog.catalog_item_order_option_config config "
                        + "WHERE override.item_order_option_config_ref=config.item_order_option_config_ref "
                        + "AND config.item_ref=? AND override.order_option_definition_value_ref=?",
                values);
    }

    void copyWithinScope(
            UUID sourceItemRef,
            UUID targetItemRef,
            Map<UUID, UUID> skuRefMapping,
            Map<UUID, UUID> optionValueRefMapping) {
        JsonNode itemProfile = readItemProfiles(List.of(sourceItemRef)).get(sourceItemRef);
        replaceItemProfile(targetItemRef, itemProfile);
        Map<UUID, JsonNode> sourceOverrides = readSkuOverrides(skuRefMapping.keySet());
        Map<UUID, JsonNode> targetOverrides = new LinkedHashMap<>();
        sourceOverrides.forEach((sourceSkuRef, override) -> {
            UUID targetSkuRef = skuRefMapping.get(sourceSkuRef);
            if (targetSkuRef == null)
                // spotless:off
                throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED",
                    422,
                    "复制规格制作信息未完成映射"
                );
                // spotless:on
            targetOverrides.put(targetSkuRef, override == null ? null : override.deepCopy());
        });
        replaceSkuOverrides(targetItemRef, targetOverrides);
        Map<UUID, JsonNode> sourceEffects =
                readOptionEffects(List.of(sourceItemRef)).getOrDefault(sourceItemRef, Map.of());
        Map<UUID, JsonNode> targetEffects = new LinkedHashMap<>();
        sourceEffects.forEach((sourceValueRef, effect) -> {
            UUID targetValueRef = optionValueRefMapping.getOrDefault(sourceValueRef, sourceValueRef);
            targetEffects.put(targetValueRef, effect == null ? null : effect.deepCopy());
        });
        replaceOptionEffects(targetItemRef, targetEffects);
    }

    private JsonNode parseNullable(String value) {
        if (value == null) return null;
        try {
            return mapper.readTree(value);
        } catch (Exception failure) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "制作信息读取失败", failure);
        }
    }

    private String jsonOrNull(JsonNode value) {
        if (value == null || value.isNull()) return null;
        try {
            return mapper.writeValueAsString(value);
        } catch (Exception failure) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "制作信息无法保存", failure);
        }
    }

    private static List<UUID> distinct(Collection<UUID> values) {
        return List.copyOf(new LinkedHashSet<>(values));
    }

    private static String placeholders(int count) {
        return String.join(",", Collections.nCopies(count, "?"));
    }

    private static void bind(java.sql.PreparedStatement statement, List<UUID> refs) throws java.sql.SQLException {
        for (int index = 0; index < refs.size(); index++) statement.setObject(index + 1, refs.get(index));
    }
}
