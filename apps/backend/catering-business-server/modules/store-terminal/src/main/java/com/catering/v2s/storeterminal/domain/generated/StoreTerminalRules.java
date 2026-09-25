// GENERATED FILE. DO NOT EDIT. sourceSha256=4781c98eb12af0e83eeab190d99c2e0861a42fffbd78cffa5e63b06e771d092c
package com.catering.v2s.storeterminal.domain.generated;

import java.util.List;

public final class StoreTerminalRules {
    public static final String SOURCE_SHA256 = "4781c98eb12af0e83eeab190d99c2e0861a42fffbd78cffa5e63b06e771d092c";

    public record DeviceType(String key, String label, String description) {}

    public record FunctionRule(
            String key,
            String label,
            List<String> supportedDeviceTypeKeys,
            Integer maxPerTerminal,
            List<String> allowedRangeKeys) {}

    public record RangeRule(String key, String label) {}

    public record SceneRule(String key, String label, String functionKey, List<String> allowedPaperSpecKeys) {}

    public record PaperSpec(String key, String label, String kind, double widthMm, Double lengthMm) {}

    public record ConnectionParameter(
            String key,
            String label,
            String valueKind,
            boolean required,
            String pattern,
            Integer minLength,
            Integer maxLength,
            boolean rejectUnicodeControlCharacters) {}

    public record ConnectionMethod(String key, String label, ConnectionParameter parameter) {}

    public record OrderType(String key, String label) {}

    public record PrinterBrand(String key, String label) {}

    public record PrinterModel(
            String key,
            String brandKey,
            String label,
            List<String> paperSpecKeys,
            List<String> allowedConnectionMethodKeys,
            String evidenceUri) {}

    public static final String RANGE_TABLE_AREA = "TABLE_AREA";
    public static final String RANGE_NO_TABLE = "NO_TABLE";
    public static final String RANGE_DELIVERY = "DELIVERY";
    public static final String RANGE_PRODUCTION_TAG = "PRODUCTION_TAG";

    // spotless:off
    public static final List<DeviceType> DEVICE_TYPES = List.of(
            new DeviceType("laptop", "台式", "台式可配置全部六类功能"),
            new DeviceType("mobile", "手持", "手持不支持 KDS 与出餐"));

    public static final List<FunctionRule> FUNCTION_RULES = List.of(
            new FunctionRule(
                    "ORDERING_CASHIER",
                    "点餐收银",
                    List.of("laptop", "mobile"),
                    1,
                    List.of("TABLE_AREA", "NO_TABLE")),
            new FunctionRule(
                    "ORDER_CONFIRMATION",
                    "接单确认",
                    List.of("laptop", "mobile"),
                    1,
                    List.of("TABLE_AREA", "NO_TABLE", "DELIVERY")),
            new FunctionRule("KDS", "KDS", List.of("laptop"), 1, List.of("PRODUCTION_TAG")),
            new FunctionRule("KITCHEN_PRINT", "厨打", List.of("laptop", "mobile"), null, List.of("PRODUCTION_TAG")),
            new FunctionRule("DISPATCH", "出餐", List.of("laptop"), 1, List.of("TABLE_AREA", "NO_TABLE", "DELIVERY")),
            new FunctionRule("QUEUE_CALL", "排队叫号", List.of("laptop", "mobile"), 1, List.of()));

    public static final List<RangeRule> RANGE_RULES = List.of(
            new RangeRule("TABLE_AREA", "桌台区"),
            new RangeRule("NO_TABLE", "无桌台"),
            new RangeRule("DELIVERY", "外卖"),
            new RangeRule("PRODUCTION_TAG", "生产标签"));

    public static final List<SceneRule> SCENE_RULES = List.of(
            new SceneRule(
                    "TABLE_ORDER_TICKET",
                    "客单（压桌单）",
                    "ORDERING_CASHIER",
                    List.of("THERMAL_58", "THERMAL_80")),
            new SceneRule("PRECHECK_TICKET", "预结单", "ORDERING_CASHIER", List.of("THERMAL_58", "THERMAL_80")),
            new SceneRule("CHECKOUT_TICKET", "结账单", "ORDERING_CASHIER", List.of("THERMAL_58", "THERMAL_80")),
            new SceneRule("PICKUP_TICKET", "取餐单", "ORDERING_CASHIER", List.of("THERMAL_58", "THERMAL_80")),
            new SceneRule(
                    "REVERSE_CHECKOUT_TICKET", "反结账单", "ORDERING_CASHIER", List.of("THERMAL_58", "THERMAL_80")),
            new SceneRule("REFUND_RECEIPT", "退款小票", "ORDERING_CASHIER", List.of("THERMAL_58", "THERMAL_80")),
            new SceneRule("PREPARATION_TICKET", "制作单", "KITCHEN_PRINT", List.of("THERMAL_58", "THERMAL_80")),
            new SceneRule("RETURN_TICKET", "退菜单", "KITCHEN_PRINT", List.of("THERMAL_58", "THERMAL_80")),
            new SceneRule("EXPEDITE_TICKET", "催菜单", "KITCHEN_PRINT", List.of("THERMAL_58", "THERMAL_80")),
            new SceneRule(
                    "START_PREPARATION_TICKET", "起菜单", "KITCHEN_PRINT", List.of("THERMAL_58", "THERMAL_80")),
            new SceneRule(
                    "LABEL_PREPARATION_TICKET",
                    "标签制作联",
                    "KITCHEN_PRINT",
                    List.of("LABEL_40_30", "LABEL_40_60", "LABEL_50_30", "LABEL_60_40", "LABEL_80_50")),
            new SceneRule("DISH_CHECK_SUMMARY", "划菜总单", "DISPATCH", List.of("THERMAL_58", "THERMAL_80")),
            new SceneRule("FOOD_DELIVERY_TICKET", "传菜单", "DISPATCH", List.of("THERMAL_58", "THERMAL_80")),
            new SceneRule("DELIVERY_TICKET", "配送单", "DISPATCH", List.of("THERMAL_58", "THERMAL_80")),
            new SceneRule("DELIVERY_MERCHANT_COPY", "外卖商家联", "DISPATCH", List.of("THERMAL_58", "THERMAL_80")),
            new SceneRule("DELIVERY_CUSTOMER_COPY", "外卖顾客联", "DISPATCH", List.of("THERMAL_58", "THERMAL_80")),
            new SceneRule("QUEUE_NUMBER_TICKET", "排队号票", "QUEUE_CALL", List.of("THERMAL_58", "THERMAL_80")));

    public static final List<PaperSpec> PAPER_SPECS = List.of(
            new PaperSpec("THERMAL_58", "热敏 58 毫米", "THERMAL_ROLL", 58.0, null),
            new PaperSpec("THERMAL_80", "热敏 80 毫米", "THERMAL_ROLL", 80.0, null),
            new PaperSpec("LABEL_40_30", "标签 40×30 毫米", "LABEL", 40.0, 30.0),
            new PaperSpec("LABEL_40_60", "标签 40×60 毫米", "LABEL", 40.0, 60.0),
            new PaperSpec("LABEL_50_30", "标签 50×30 毫米", "LABEL", 50.0, 30.0),
            new PaperSpec("LABEL_60_40", "标签 60×40 毫米", "LABEL", 60.0, 40.0),
            new PaperSpec("LABEL_80_50", "标签 80×50 毫米", "LABEL", 80.0, 50.0));

    public static final List<ConnectionMethod> CONNECTION_METHODS = List.of(
            new ConnectionMethod(
                    "NETWORK",
                    "网口",
                    new ConnectionParameter(
                            "ipAddress",
                            "IP 地址",
                            "IPV4",
                            true,
                            "^(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])(\\.(25[0-5]|2[0" +
                            "-4][0-9]|1[0-9]{2}|[1-9]?[0-9])){3}$",
                            null,
                            null,
                            false)),
            new ConnectionMethod(
                    "CLOUD",
                    "云端",
                    new ConnectionParameter("deviceId", "设备 ID", "IDENTIFIER", true, null, 1, 160, true)),
            new ConnectionMethod(
                    "USB",
                    "USB",
                    new ConnectionParameter(
                            "deviceIdentifier",
                            "USB 设备标识",
                            "IDENTIFIER",
                            true,
                            null,
                            1,
                            160,
                            true)),
            new ConnectionMethod(
                    "BLUETOOTH",
                    "蓝牙",
                    new ConnectionParameter(
                            "deviceIdentifier",
                            "蓝牙设备标识",
                            "IDENTIFIER",
                            true,
                            null,
                            1,
                            160,
                            true)),
            new ConnectionMethod("BUILT_IN", "设备内置", null));

    public static final List<OrderType> ORDER_TYPES = List.of(
            new OrderType("DINE_IN", "堂食"),
            new OrderType("DELIVERY", "外卖"),
            new OrderType("TAKEAWAY", "外带"));

    public static final List<PrinterBrand> PRINTER_BRANDS = List.of(
            new PrinterBrand("EPSON", "爱普生"),
            new PrinterBrand("ZEBRA", "斑马"),
            new PrinterBrand("GENERIC", "通用设备"));

    public static final List<PrinterModel> PRINTER_MODELS = List.of(            new PrinterModel(
                    "EPSON_TM_T88VII",
                    "EPSON",
                    "TM-T88VII",
                    List.of("THERMAL_58", "THERMAL_80"),
                    List.of("USB", "BLUETOOTH", "NETWORK"),
                    "https://files.support.epson.com/pdf/pos/bulk/tm-t88vii_trg_e" +
                            "n_revg.pdf"),             new PrinterModel(
                    "ZEBRA_ZD421D",
                    "ZEBRA",
                    "ZD421 Direct Thermal",
                    List.of("LABEL_40_30", "LABEL_40_60", "LABEL_50_30", "LABEL_60_40", "LABEL_80_50"),
                    List.of("USB", "BLUETOOTH", "NETWORK"),
                    "https://www.zebra.com/us/en/products/spec-sheets/printers/de" +
                            "sktop/zd400-series.html"),             new PrinterModel(
                    "ZEBRA_ZD411D",
                    "ZEBRA",
                    "ZD411 Direct Thermal",
                    List.of("LABEL_40_30", "LABEL_40_60", "LABEL_50_30", "LABEL_60_40"),
                    List.of("USB", "BLUETOOTH", "NETWORK"),
                    "https://www.zebra.com/us/en/products/spec-sheets/printers/de" +
                            "sktop/zd400-series.html"),             new PrinterModel(
                    "GENERIC_THERMAL_58",
                    "GENERIC",
                    "通用热敏 58 毫米",
                    List.of("THERMAL_58"),
                    List.of("USB", "BLUETOOTH", "NETWORK", "CLOUD"),
                    null),             new PrinterModel(
                    "GENERIC_THERMAL_80",
                    "GENERIC",
                    "通用热敏 80 毫米",
                    List.of("THERMAL_80"),
                    List.of("USB", "BLUETOOTH", "NETWORK", "CLOUD"),
                    null),             new PrinterModel(
                    "GENERIC_LABEL_40_30",
                    "GENERIC",
                    "通用标签 40×30 毫米",
                    List.of("LABEL_40_30"),
                    List.of("USB", "BLUETOOTH", "NETWORK", "CLOUD"),
                    null),             new PrinterModel(
                    "GENERIC_LABEL_40_60",
                    "GENERIC",
                    "通用标签 40×60 毫米",
                    List.of("LABEL_40_60"),
                    List.of("USB", "BLUETOOTH", "NETWORK", "CLOUD"),
                    null),             new PrinterModel(
                    "GENERIC_LABEL_50_30",
                    "GENERIC",
                    "通用标签 50×30 毫米",
                    List.of("LABEL_50_30"),
                    List.of("USB", "BLUETOOTH", "NETWORK", "CLOUD"),
                    null),             new PrinterModel(
                    "GENERIC_LABEL_60_40",
                    "GENERIC",
                    "通用标签 60×40 毫米",
                    List.of("LABEL_60_40"),
                    List.of("USB", "BLUETOOTH", "NETWORK", "CLOUD"),
                    null),             new PrinterModel(
                    "GENERIC_LABEL_80_50",
                    "GENERIC",
                    "通用标签 80×50 毫米",
                    List.of("LABEL_80_50"),
                    List.of("USB", "BLUETOOTH", "NETWORK", "CLOUD"),
                    null),             new PrinterModel(
                    "BUILTIN_THERMAL_58",
                    "GENERIC",
                    "设备内置热敏 58 毫米",
                    List.of("THERMAL_58"),
                    List.of("BUILT_IN"),
                    null),             new PrinterModel(
                    "BUILTIN_THERMAL_80",
                    "GENERIC",
                    "设备内置热敏 80 毫米",
                    List.of("THERMAL_80"),
                    List.of("BUILT_IN"),
                    null));
    // spotless:on

    private StoreTerminalRules() {}

    public static List<SceneRule> scenesForFunction(String functionKey) {
        return SCENE_RULES.stream()
                .filter(scene -> scene.functionKey().equals(functionKey))
                .toList();
    }

    public static boolean functionSupportsDevice(String functionKey, String deviceTypeKey) {
        return FUNCTION_RULES.stream()
                .filter(rule -> rule.key().equals(functionKey))
                .findFirst()
                .map(rule -> rule.supportedDeviceTypeKeys().contains(deviceTypeKey))
                .orElse(false);
    }

    public static boolean printerModelSupportsPaper(String modelKey, String paperSpecKey) {
        return PRINTER_MODELS.stream()
                .filter(model -> model.key().equals(modelKey))
                .findFirst()
                .map(model -> model.paperSpecKeys().contains(paperSpecKey))
                .orElse(false);
    }

    public static boolean printerModelSupportsConnection(String modelKey, String connectionMethodKey) {
        return PRINTER_MODELS.stream()
                .filter(model -> model.key().equals(modelKey))
                .findFirst()
                .map(model -> model.allowedConnectionMethodKeys().contains(connectionMethodKey))
                .orElse(false);
    }
}
