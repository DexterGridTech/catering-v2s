package com.catering.v2s.catalog.application.persistence;

import com.catering.v2s.catalog.application.persistence.CatalogPreparationFactsSql;
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
public class CatalogPreparationFacts {
    private static final java.util.Set<String> PROFILE_FIELDS =
            java.util.Set.of("productionDisplayName", "estimatedPreparationSeconds", "preparationNotes");
    private static final java.util.Set<String> EFFECT_FIELDS =
            java.util.Set.of("instruction", "preparationSecondsDelta");

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public CatalogPreparationFacts(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public void validateProfile(JsonNode profile) {
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

    public void validateOverride(JsonNode override) {
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

    public void validateEffect(JsonNode effect) {
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

    public Map<UUID, JsonNode> readItemProfiles(Collection<UUID> itemRefs) {
        if (itemRefs == null || itemRefs.isEmpty()) return Map.of();
        List<UUID> refs = distinct(itemRefs);
        Map<UUID, JsonNode> result = new LinkedHashMap<>();
        jdbc.query(
                CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_SELECT_CATALOG_ITEM_ITEM_REF_PREPARATION_PROFILE_TEXT
                        + placeholders(refs.size())
                        + CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_CLOSE_PAREN,
                statement -> bind(statement, refs),
                rows -> {
                    while (rows.next()) result.put(rows.getObject(1, UUID.class), parseNullable(rows.getString(2)));
                    return null;
                });
        return Collections.unmodifiableMap(new LinkedHashMap<>(result));
    }

    public Map<UUID, JsonNode> readSkuOverrides(Collection<UUID> skuRefs) {
        if (skuRefs == null || skuRefs.isEmpty()) return Map.of();
        List<UUID> refs = distinct(skuRefs);
        Map<UUID, JsonNode> result = new LinkedHashMap<>();
        jdbc.query(
                CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_SELECT_CATALOG_SKU_PRODUCT_SKU_REF_PREPARATION_OVERRIDE_TEXT
                        + placeholders(refs.size())
                        + CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_CLOSE_PAREN_ALTERNATE_A,
                statement -> bind(statement, refs),
                rows -> {
                    while (rows.next()) result.put(rows.getObject(1, UUID.class), parseNullable(rows.getString(2)));
                    return null;
                });
        return Collections.unmodifiableMap(new LinkedHashMap<>(result));
    }

    public Map<UUID, Map<UUID, JsonNode>> readOptionEffects(Collection<UUID> itemRefs) {
        if (itemRefs == null || itemRefs.isEmpty()) return Map.of();
        List<UUID> refs = distinct(itemRefs);
        String placeholders = placeholders(refs.size());
        Map<UUID, Map<UUID, JsonNode>> result = new LinkedHashMap<>();
        refs.forEach(ref -> result.put(ref, new LinkedHashMap<>()));
        jdbc.query(
                CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_SELECT_CONFIG_ITEM_REF_OVERRIDE_ORDER_OPTION_DEFINITION_VALUE_REF
                        + CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_FROM_CLAUSE_CATALOG_ITEM_ORDER_OPTION_CONFIG_CONFIG
                        + CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_CONTINUATION_CATALOG_ITEM_ORDER_OPTION_VALUE_OV_OVERRIDE
                        + CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_CONTINUATION_OVERRIDE_ITEM_ORDER_OPTION_CONFIG_REF_CONFIG
                        + CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_WHERE_CONFIG_ITEM_REF
                        + placeholders
                        + CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_CLOSE_PAREN_OVERRIDE_PREPARATION_EFFECT
                        + CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_ORDER_BY_CONFIG_ITEM_REF_OVERRIDE_ORDER_OPTION_DEFINITION_VALUE_REF,
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
    public DetailReadback readDetailFacts(Collection<UUID> itemRefs, Collection<UUID> skuRefs) {
        if (itemRefs == null || itemRefs.isEmpty()) return DetailReadback.empty();
        List<UUID> items = distinct(itemRefs);
        List<UUID> skus = skuRefs == null ? List.of() : distinct(skuRefs);
        Map<UUID, JsonNode> itemProfiles = new LinkedHashMap<>();
        Map<UUID, JsonNode> skuOverrides = new LinkedHashMap<>();
        Map<UUID, Map<UUID, JsonNode>> optionEffects = new LinkedHashMap<>();
        items.forEach(itemRef -> optionEffects.put(itemRef, new LinkedHashMap<>()));
        String itemPlaceholders = placeholders(items.size());
        StringBuilder sql = new StringBuilder(
                CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_SELECT_ITEM_FACT_KIND_ITEM_REF_RELATED_REF
                        + CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_FROM_CLAUSE_CATALOG_ITEM_ITEM_REF
                        + itemPlaceholders
                        + CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_CLOSE_PAREN_EFFECT_CONFIG_ITEM_REF_OVERRIDE
                        + CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_CONTINUATION_CATALOG_ITEM_ORDER_OPTION_CONFIG
                        + CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_CONTINUATION_CATALOG_ITEM_ORDER_OPTION_VALUE_OV_OVERRIDE_ALTERNATE_A
                        + CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_CONTINUATION_OVERRIDE_ITEM_ORDER_OPTION_CONFIG_REF_CONFIG_ALTERNATE_A
                        + CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_CONTINUATION_CONFIG_ITEM_REF
                        + itemPlaceholders
                        + CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_CLOSE_PAREN_OVERRIDE_PREPARATION_EFFECT_ALTERNATE_A);
        if (!skus.isEmpty())
            sql.append(CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_UNION_SKU_ITEM_REF_PRODUCT_SKU_REF_PREPARATION_OVERRIDE
                            + CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_FROM_CLAUSE_CATALOG_SKU_SKU_PRODUCT_SKU_REF)
                    .append(placeholders(skus.size()))
                    .append(')');
        sql.append(CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_ORDER_BY_FACT_KIND_ITEM_REF_RELATED_REF);
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

    public record DetailReadback(
            Map<UUID, JsonNode> itemProfiles,
            Map<UUID, JsonNode> skuOverrides,
            Map<UUID, Map<UUID, JsonNode>> optionEffects) {
        public static DetailReadback empty() {
            return new DetailReadback(Map.of(), Map.of(), Map.of());
        }
    }

    public void replaceItemProfile(UUID itemRef, JsonNode profile) {
        jdbc.update(
                CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_UPDATE_CATALOG_ITEM_PREPARATION_PROFILE_ITEM_REF,
                jsonOrNull(profile),
                itemRef);
    }

    public void replaceSkuOverrides(UUID itemRef, Map<UUID, JsonNode> overrides) {
        jdbc.update(CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_UPDATE_CATALOG_SKU_PREPARATION_OVERRIDE_ITEM_REF, itemRef);
        if (overrides == null || overrides.isEmpty()) return;
        List<Object[]> values = new ArrayList<>();
        for (Map.Entry<UUID, JsonNode> entry : overrides.entrySet())
            values.add(new Object[] {jsonOrNull(entry.getValue()), itemRef, entry.getKey()});
        jdbc.batchUpdate(
                CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_UPDATE_CATALOG_SKU_PREPARATION_OVERRIDE
                        + CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_WHERE_ITEM_REF_PRODUCT_SKU_REF,
                values);
    }

    /** Replaces option effects only on the current item's existing override rows. */
    public void replaceOptionEffects(UUID itemRef, Map<UUID, JsonNode> effects) {
        jdbc.update(
                CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_UPDATE_CATALOG_ITEM_ORDER_OPTION_VALUE_OV_OVERRIDE_PREPARATION_EFFECT
                        + CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_FROM_CLAUSE_CATALOG_ITEM_ORDER_OPTION_CONFIG_CONFIG_ALTERNATE_A
                        + CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_WHERE_OVERRIDE_ITEM_ORDER_OPTION_CONFIG_REF_CONFIG
                        + CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_CONDITION_CONFIG_ITEM_REF,
                itemRef);
        if (effects == null || effects.isEmpty()) return;
        List<Object[]> values = new ArrayList<>();
        for (Map.Entry<UUID, JsonNode> entry : effects.entrySet())
            values.add(new Object[] {jsonOrNull(entry.getValue()), itemRef, entry.getKey()});
        jdbc.batchUpdate(
                CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_UPDATE_CATALOG_ITEM_ORDER_OPTION_VALUE_OV_OVERRIDE
                        + CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_SET_PREPARATION_EFFECT
                        + CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_FROM_CLAUSE_CATALOG_ITEM_ORDER_OPTION_CONFIG_CONFIG_ALTERNATE_B
                        + CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_WHERE_OVERRIDE_ITEM_ORDER_OPTION_CONFIG_REF_CONFIG_ALTERNATE_A
                        + CatalogPreparationFactsSql.CATALOG_PREPARATION_FACTS_CONDITION_CONFIG_ITEM_REF_OVERRIDE_ORDER_OPTION_DEFINITION_VALUE_REF,
                values);
    }

    public void copyWithinScope(
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
        return String.join(
                CatalogPreparationFactsSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(count, CatalogPreparationFactsSql.PARAMETER_PLACEHOLDER));
    }

    private static void bind(java.sql.PreparedStatement statement, List<UUID> refs) throws java.sql.SQLException {
        for (int index = 0; index < refs.size(); index++) statement.setObject(index + 1, refs.get(index));
    }
}
