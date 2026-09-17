// GENERATED FILE. DO NOT EDIT. sourceSha256=cc6e9e397769e5919abbeb4a6dd487746e0f2354434453307cd9f5c8eb15e262
package com.catering.v2s.organization.domain.generated;

import java.io.Serializable;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class StoreOperatingRuleCatalog {
    public static final String SOURCE_SHA256 = "cc6e9e397769e5919abbeb4a6dd487746e0f2354434453307cd9f5c8eb15e262";

    public enum ValueType { BOOLEAN, NUMBER, STRING }

    public record Definition(String key, String label, ValueType type, Object defaultValue, String parentKey, int displayOrder) {}

    /** Closed rule-value boundary shared by organization commands and readbacks. */
    public record Values(Map<String, ?> entries) {
        public Values {
            if (entries == null) throw new IllegalArgumentException("operating rule values are required");
            entries = Map.copyOf(entries);
        }

        public Object get(String key) { return entries.get(key); }

        public boolean containsKey(String key) { return entries.containsKey(key); }

        public Map<String, ?> asMap() { return entries; }
    }

    private static final List<Definition> DEFINITIONS = List.of(
        new Definition("catalogManagementEnabled", "是否启用商品、库存和菜单管理", ValueType.BOOLEAN, Boolean.FALSE, null, 1),
        new Definition("externalCatalogSyncEnabled", "是否启用外部商品、库存、菜单同步", ValueType.BOOLEAN, Boolean.FALSE, "catalogManagementEnabled", 2),
        new Definition("openPlatformDeveloperCode", "开放平台开发者编码", ValueType.STRING, "", "externalCatalogSyncEnabled", 3),
        new Definition("reservationEnabled", "是否启用预约功能", ValueType.BOOLEAN, Boolean.FALSE, "catalogManagementEnabled", 4),
        new Definition("reservationDepositEnabled", "是否支持押金预约", ValueType.BOOLEAN, Boolean.FALSE, "reservationEnabled", 5),
        new Definition("queueCallEnabled", "是否启用排队叫号", ValueType.BOOLEAN, Boolean.FALSE, "catalogManagementEnabled", 6),
        new Definition("tableManagementEnabled", "是否启用桌台和二维码管理", ValueType.BOOLEAN, Boolean.FALSE, "catalogManagementEnabled", 7),
        new Definition("tableStatusEnabled", "是否启用桌台状态管理", ValueType.BOOLEAN, Boolean.FALSE, "tableManagementEnabled", 8),
        new Definition("tableWaitCallEnabled", "是否支持「等叫」功能", ValueType.BOOLEAN, Boolean.FALSE, "tableStatusEnabled", 9),
        new Definition("banquetOrderEnabled", "是否支持宴会订单", ValueType.BOOLEAN, Boolean.FALSE, "tableStatusEnabled", 10),
        new Definition("pickupCallEnabled", "是否启用取餐叫号", ValueType.BOOLEAN, Boolean.FALSE, "catalogManagementEnabled", 11),
        new Definition("receivableEnabled", "是否支持应收单管理", ValueType.BOOLEAN, Boolean.FALSE, null, 12)
    );

    private StoreOperatingRuleCatalog() {}

    public static List<Definition> definitions() { return DEFINITIONS; }

    public static Definition definition(String key) {
        return DEFINITIONS.stream().filter(value -> value.key().equals(key)).findFirst().orElse(null);
    }

    public static Map<String, Serializable> defaults() {
        var result = new LinkedHashMap<String, Serializable>();
        for (Definition definition : DEFINITIONS) result.put(definition.key(), (Serializable) definition.defaultValue());
        return result;
    }

    public static Values values(Map<String, ?> values, boolean requireComplete) {
        validate(values, requireComplete);
        return new Values(values == null || values.isEmpty() ? defaults() : values);
    }

    public static void validate(Map<String, ?> values, boolean requireComplete) {
        if (values == null || values.isEmpty()) {
            if (requireComplete) throw new IllegalArgumentException("operating rule values must be complete");
            return;
        }
        if (values.size() != DEFINITIONS.size()) throw new IllegalArgumentException("operating rule keys are incomplete");
        for (Definition definition : DEFINITIONS) {
            if (!values.containsKey(definition.key())) throw new IllegalArgumentException("missing operating rule key");
            Object value = values.get(definition.key());
            if (value == null || !matches(definition.type(), value)) throw new IllegalArgumentException("operating rule value type is invalid");
        }
        if (values.keySet().stream().anyMatch(key -> definition(key) == null))
            throw new IllegalArgumentException("unknown operating rule key");
    }

    private static boolean matches(ValueType type, Object value) {
        return switch (type) {
            case BOOLEAN -> value instanceof Boolean;
            case NUMBER -> value instanceof Number;
            case STRING -> value instanceof String;
        };
    }

    public static Map<String, Serializable> resolved(Map<String, ?> values) {
        var result = new LinkedHashMap<String, Serializable>(defaults());
        if (values == null || values.isEmpty()) return result;
        validate(values, true);
        for (Definition definition : DEFINITIONS) result.put(definition.key(), (Serializable) values.get(definition.key()));
        return result;
    }

    public static boolean applicable(Map<String, ?> values, String key) {
        Definition definition = definition(key);
        if (definition == null) throw new IllegalArgumentException("unknown operating rule key");
        return definition.parentKey() == null || effective(values, definition.parentKey()).equals(Boolean.TRUE);
    }

    public static Object effective(Map<String, ?> values, String key) {
        Definition definition = definition(key);
        if (definition == null) throw new IllegalArgumentException("unknown operating rule key");
        Object value = resolved(values).get(key);
        return definition.type() == ValueType.BOOLEAN && !applicable(values, key) ? Boolean.FALSE : value;
    }

    public static List<String> keys() { return List.of("catalogManagementEnabled", "externalCatalogSyncEnabled", "openPlatformDeveloperCode", "reservationEnabled", "reservationDepositEnabled", "queueCallEnabled", "tableManagementEnabled", "tableStatusEnabled", "tableWaitCallEnabled", "banquetOrderEnabled", "pickupCallEnabled", "receivableEnabled"); }
}
