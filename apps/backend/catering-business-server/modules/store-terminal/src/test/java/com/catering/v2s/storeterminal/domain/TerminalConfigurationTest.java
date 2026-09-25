package com.catering.v2s.storeterminal.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TerminalConfigurationTest {
    @Test
    void preservesMultipleKitchenInstancesAndIndependentScenePrinterSets() {
        TerminalConfiguration configuration = TerminalConfiguration.create(
                "laptop",
                List.of(
                        printer(ref(1), "票据机", "GENERIC_THERMAL_58", "THERMAL_58", "USB", "USB-01"),
                        printer(ref(20), "标签机一", "GENERIC_LABEL_40_30", "LABEL_40_30", "USB", "USB-03"),
                        printer(
                                client("label-printer-2"),
                                "标签机二",
                                "GENERIC_LABEL_40_30",
                                "LABEL_40_30",
                                "USB",
                                "USB-02")),
                List.of(
                        function(
                                ref(2),
                                "KITCHEN_PRINT",
                                List.of(range("PRODUCTION_TAG", false, List.of(uuid(10)))),
                                List.of(
                                        scene(
                                                "PREPARATION_TICKET",
                                                List.of("DINE_IN"),
                                                List.of(printerBinding(ref(1)))),
                                        scene(
                                                "LABEL_PREPARATION_TICKET",
                                                List.of("TAKEAWAY"),
                                                List.of(
                                                        printerBinding(ref(20)),
                                                        printerBinding(client("label-printer-2")))))),
                        function(
                                client("kitchen-2"),
                                "KITCHEN_PRINT",
                                List.of(range("PRODUCTION_TAG", true, List.of())),
                                List.of(scene("PREPARATION_TICKET", List.of(), List.of())))));

        assertEquals(2, configuration.functions().size());
        assertEquals(
                2,
                configuration
                        .functions()
                        .getFirst()
                        .scenes()
                        .getLast()
                        .printers()
                        .size());
        assertEquals("kitchen-2", configuration.functions().getLast().identity().clientKey());
    }

    @Test
    void requiresAtLeastOneFunctionAndRejectsUnsupportedDeviceCombinations() {
        assertRule(
                TerminalConfiguration.Rule.FUNCTION_REQUIRED,
                () -> TerminalConfiguration.create("laptop", List.of(), List.of()));
        assertRule(
                TerminalConfiguration.Rule.FUNCTION_DEVICE_UNSUPPORTED,
                () -> TerminalConfiguration.create(
                        "mobile", List.of(), List.of(function(client("kds"), "KDS", List.of(), List.of()))));
    }

    @Test
    void rejectsRepeatedSingletonFunctionsButAllowsUnboundedKitchenFunctions() {
        assertRule(
                TerminalConfiguration.Rule.FUNCTION_DUPLICATE_SINGLETON,
                () -> TerminalConfiguration.create(
                        "laptop",
                        List.of(),
                        List.of(
                                function(client("cashier-1"), "ORDERING_CASHIER", List.of(), List.of()),
                                function(client("cashier-2"), "ORDERING_CASHIER", List.of(), List.of()))));

        TerminalConfiguration configuration = TerminalConfiguration.create(
                "mobile",
                List.of(),
                List.of(
                        function(client("kitchen-a"), "KITCHEN_PRINT", List.of(), List.of()),
                        function(client("kitchen-b"), "KITCHEN_PRINT", List.of(), List.of()),
                        function(client("kitchen-c"), "KITCHEN_PRINT", List.of(), List.of())));
        assertEquals(3, configuration.functions().size());
    }

    @Test
    void enforcesRequestIdentityUniquenessAcrossPrinterAndFunctionItems() {
        String printerName = "机一";
        var duplicatePrinter =
                printer(client("same-key"), printerName, "GENERIC_THERMAL_58", "THERMAL_58", "USB", "USB-01");
        assertRule(
                TerminalConfiguration.Rule.IDENTITY_DUPLICATE,
                () -> TerminalConfiguration.create(
                        "laptop",
                        List.of(duplicatePrinter),
                        List.of(function(client("same-key"), "KITCHEN_PRINT", List.of(), List.of()))));
        assertRule(
                TerminalConfiguration.Rule.IDENTITY_INVALID,
                () -> TerminalConfiguration.create(
                        "laptop",
                        List.of(printer(
                                new TerminalConfiguration.ChildIdentity(uuid(1), "also-client-key"),
                                "机一",
                                "GENERIC_THERMAL_58",
                                "THERMAL_58",
                                "USB",
                                "USB-01")),
                        List.of(function(client("kitchen"), "KITCHEN_PRINT", List.of(), List.of()))));
        assertRule(
                TerminalConfiguration.Rule.IDENTITY_INVALID,
                () -> TerminalConfiguration.create(
                        "laptop",
                        List.of(printer(
                                new TerminalConfiguration.ChildIdentity(null, null),
                                "机一",
                                "GENERIC_THERMAL_58",
                                "THERMAL_58",
                                "USB",
                                "USB-01")),
                        List.of(function(client("kitchen"), "KITCHEN_PRINT", List.of(), List.of()))));
    }

    @Test
    void rejectsDisallowedRangesScenesOrderTypesAndPrinterPaperRelationships() {
        String thermalPrinterName = "票据机";
        var thermalPrinter =
                printer(client("thermal"), thermalPrinterName, "GENERIC_THERMAL_58", "THERMAL_58", "USB", "USB-01");
        assertRule(
                TerminalConfiguration.Rule.RANGE_NOT_ALLOWED,
                () -> TerminalConfiguration.create(
                        "laptop",
                        List.of(),
                        List.of(function(
                                client("kitchen"),
                                "KITCHEN_PRINT",
                                List.of(range("DELIVERY", false, List.of())),
                                List.of()))));
        assertRule(
                TerminalConfiguration.Rule.SCENE_NOT_ALLOWED,
                () -> TerminalConfiguration.create(
                        "laptop",
                        List.of(),
                        List.of(function(
                                client("kitchen"),
                                "KITCHEN_PRINT",
                                List.of(),
                                List.of(scene("CHECKOUT_TICKET", List.of(), List.of()))))));
        assertRule(
                TerminalConfiguration.Rule.ORDER_TYPE_INVALID,
                () -> TerminalConfiguration.create(
                        "laptop",
                        List.of(),
                        List.of(function(
                                client("kitchen"),
                                "KITCHEN_PRINT",
                                List.of(),
                                List.of(scene("PREPARATION_TICKET", List.of("UNKNOWN"), List.of()))))));
        assertRule(TerminalConfiguration.Rule.SCENE_PAPER_SPEC_UNSUPPORTED, () -> {
            TerminalConfiguration.Printer labelPrinter =
                    printer(client("label"), "标签机", "GENERIC_LABEL_40_30", "LABEL_40_30", "USB", "USB-01");
            TerminalConfiguration.SceneSelection labelScene =
                    scene("PREPARATION_TICKET", List.of(), List.of(printerBinding(client("label"))));
            TerminalConfiguration.Function kitchen =
                    function(client("kitchen"), "KITCHEN_PRINT", List.of(), List.of(labelScene));
            TerminalConfiguration.create("laptop", List.of(labelPrinter), List.of(kitchen));
        });
        assertRule(
                TerminalConfiguration.Rule.RANGE_SELECTION_INVALID,
                () -> TerminalConfiguration.create(
                        "laptop",
                        List.of(),
                        List.of(function(
                                client("cashier"),
                                "ORDERING_CASHIER",
                                List.of(range("TABLE_AREA", true, List.of(uuid(1)))),
                                List.of()))));
        assertRule(
                TerminalConfiguration.Rule.RANGE_SELECTION_INVALID,
                () -> TerminalConfiguration.create(
                        "laptop",
                        List.of(),
                        List.of(function(
                                client("confirmation"),
                                "ORDER_CONFIRMATION",
                                List.of(range("DELIVERY", false, List.of(uuid(1)))),
                                List.of()))));
        assertRule(
                TerminalConfiguration.Rule.RANGE_SELECTION_INVALID,
                () -> TerminalConfiguration.create(
                        "laptop",
                        List.of(),
                        List.of(function(
                                client("cashier"),
                                "ORDERING_CASHIER",
                                List.of(range("TABLE_AREA", false, List.of(uuid(1), uuid(1)))),
                                List.of()))));
        assertRule(
                TerminalConfiguration.Rule.SCENE_PRINTER_INVALID,
                () -> TerminalConfiguration.create(
                        "laptop",
                        List.of(),
                        List.of(function(
                                client("cashier"),
                                "ORDERING_CASHIER",
                                List.of(),
                                List.of(scene("CHECKOUT_TICKET", List.of(), List.of(printerBinding(ref(900)))))))));
        assertRule(
                TerminalConfiguration.Rule.SCENE_DUPLICATE,
                () -> TerminalConfiguration.create(
                        "laptop",
                        List.of(),
                        List.of(function(
                                client("cashier"),
                                "ORDERING_CASHIER",
                                List.of(),
                                List.of(
                                        scene("CHECKOUT_TICKET", List.of(), List.of()),
                                        scene("CHECKOUT_TICKET", List.of(), List.of()))))));
        assertRule(
                TerminalConfiguration.Rule.SCENE_PRINTER_DUPLICATE,
                () -> TerminalConfiguration.create(
                        "laptop",
                        List.of(thermalPrinter),
                        List.of(function(
                                client("cashier"),
                                "ORDERING_CASHIER",
                                List.of(),
                                List.of(scene(
                                        "CHECKOUT_TICKET",
                                        List.of(),
                                        List.of(
                                                printerBinding(client("thermal")),
                                                printerBinding(client("thermal")))))))));
    }

    @Test
    void acceptsEveryDeclaredScopeShapeWithoutAddingRestrictionsToEmptyScopes() {
        TerminalConfiguration allAndSingletonScopes = TerminalConfiguration.create(
                "laptop",
                List.of(),
                List.of(
                        function(
                                client("cashier"),
                                "ORDERING_CASHIER",
                                List.of(range("TABLE_AREA", true, List.of()), range("NO_TABLE", false, List.of())),
                                List.of()),
                        function(
                                client("confirmation"),
                                "ORDER_CONFIRMATION",
                                List.of(range("DELIVERY", false, List.of())),
                                List.of()),
                        function(
                                client("kitchen-all"),
                                "KITCHEN_PRINT",
                                List.of(range("PRODUCTION_TAG", true, List.of())),
                                List.of()),
                        function(client("queue"), "QUEUE_CALL", List.of(), List.of())));
        assertEquals(4, allAndSingletonScopes.functions().size());

        TerminalConfiguration selectedEntityScopes = TerminalConfiguration.create(
                "laptop",
                List.of(),
                List.of(
                        function(
                                client("cashier-selected"),
                                "ORDERING_CASHIER",
                                List.of(range("TABLE_AREA", false, List.of(uuid(100)))),
                                List.of()),
                        function(
                                client("kitchen-selected"),
                                "KITCHEN_PRINT",
                                List.of(range("PRODUCTION_TAG", false, List.of(uuid(101)))),
                                List.of())));
        assertEquals(
                1,
                selectedEntityScopes
                        .functions()
                        .getFirst()
                        .ranges()
                        .getFirst()
                        .refs()
                        .size());
    }

    @Test
    void rejectsAllOrEntityReferencesForNonEntityScopeKinds() {
        assertRule(
                TerminalConfiguration.Rule.RANGE_SELECTION_INVALID,
                () -> TerminalConfiguration.create(
                        "laptop",
                        List.of(),
                        List.of(function(
                                client("cashier"),
                                "ORDERING_CASHIER",
                                List.of(range("NO_TABLE", true, List.of())),
                                List.of()))));
        assertRule(
                TerminalConfiguration.Rule.RANGE_SELECTION_INVALID,
                () -> TerminalConfiguration.create(
                        "laptop",
                        List.of(),
                        List.of(function(
                                client("confirmation"),
                                "ORDER_CONFIRMATION",
                                List.of(range("DELIVERY", true, List.of())),
                                List.of()))));
        assertRule(
                TerminalConfiguration.Rule.RANGE_NOT_ALLOWED,
                () -> TerminalConfiguration.create(
                        "laptop",
                        List.of(),
                        List.of(function(
                                client("queue"),
                                "QUEUE_CALL",
                                List.of(range("NONE", false, List.of(uuid(1)))),
                                List.of()))));
        assertRule(
                TerminalConfiguration.Rule.RANGE_NOT_ALLOWED,
                () -> TerminalConfiguration.create(
                        "laptop",
                        List.of(),
                        List.of(function(
                                client("queue-all"),
                                "QUEUE_CALL",
                                List.of(range("NONE", true, List.of())),
                                List.of()))));
        assertRule(
                TerminalConfiguration.Rule.RANGE_SELECTION_INVALID,
                () -> TerminalConfiguration.create(
                        "laptop",
                        List.of(),
                        List.of(function(
                                client("kitchen"),
                                "KITCHEN_PRINT",
                                List.of(range("PRODUCTION_TAG", true, List.of(uuid(1)))),
                                List.of()))));
    }

    @Test
    void enforcesPerPrinterNamesAndUsbBluetoothIdentifiersWithoutCrossMethodDeduplication() {
        String paddedFrontDeskName = "  前台机 ";
        String frontDeskName = "前台机";
        var paddedFrontDeskPrinter =
                printer(client("p1"), paddedFrontDeskName, "GENERIC_THERMAL_58", "THERMAL_58", "USB", "USB-01");
        var frontDeskPrinter =
                printer(client("p2"), frontDeskName, "GENERIC_THERMAL_58", "THERMAL_58", "BLUETOOTH", "BT-01");
        assertRule(
                TerminalConfiguration.Rule.PRINTER_NAME_DUPLICATE,
                () -> TerminalConfiguration.create(
                        "laptop",
                        List.of(paddedFrontDeskPrinter, frontDeskPrinter),
                        List.of(function(client("cashier"), "ORDERING_CASHIER", List.of(), List.of()))));
        assertRule(
                TerminalConfiguration.Rule.CONNECTION_IDENTIFIER_DUPLICATE,
                () -> TerminalConfiguration.create(
                        "laptop",
                        List.of(
                                printer(client("p1"), "机一", "GENERIC_THERMAL_58", "THERMAL_58", "USB", "USB-01"),
                                printer(client("p2"), "机二", "GENERIC_THERMAL_58", "THERMAL_58", "USB", "USB-01")),
                        List.of(function(client("cashier"), "ORDERING_CASHIER", List.of(), List.of()))));
        TerminalConfiguration.create(
                "laptop",
                List.of(
                        printer(client("usb"), "USB", "GENERIC_THERMAL_58", "THERMAL_58", "USB", "SAME-ID"),
                        printer(client("bt"), "BT", "GENERIC_THERMAL_58", "THERMAL_58", "BLUETOOTH", "SAME-ID")),
                List.of(function(client("cashier"), "ORDERING_CASHIER", List.of(), List.of())));
    }

    private static TerminalConfiguration.Printer printer(
            TerminalConfiguration.ChildIdentity identity,
            String name,
            String model,
            String paper,
            String connection,
            String parameter) {
        return new TerminalConfiguration.Printer(
                identity, name, PrinterSpecification.of("GENERIC", model, paper, connection, parameter));
    }

    private static TerminalConfiguration.Function function(
            TerminalConfiguration.ChildIdentity identity,
            String key,
            List<TerminalConfiguration.RangeSelection> ranges,
            List<TerminalConfiguration.SceneSelection> scenes) {
        return new TerminalConfiguration.Function(identity, key, ranges, scenes);
    }

    private static TerminalConfiguration.RangeSelection range(String key, boolean all, List<UUID> refs) {
        return new TerminalConfiguration.RangeSelection(key, all, refs);
    }

    private static TerminalConfiguration.SceneSelection scene(
            String key, List<String> orderTypes, List<TerminalConfiguration.PrinterBinding> printers) {
        return new TerminalConfiguration.SceneSelection(key, orderTypes, printers);
    }

    private static TerminalConfiguration.PrinterBinding printerBinding(TerminalConfiguration.ChildIdentity identity) {
        return new TerminalConfiguration.PrinterBinding(identity);
    }

    private static TerminalConfiguration.ChildIdentity ref(long suffix) {
        return new TerminalConfiguration.ChildIdentity(uuid(suffix), null);
    }

    private static UUID uuid(long suffix) {
        return UUID.fromString("30000000-0000-4000-8000-%012d".formatted(suffix));
    }

    private static TerminalConfiguration.ChildIdentity client(String value) {
        return new TerminalConfiguration.ChildIdentity(null, value);
    }

    private static void assertRule(TerminalConfiguration.Rule expected, Runnable action) {
        TerminalConfiguration.InvalidConfigurationException failure =
                assertThrows(TerminalConfiguration.InvalidConfigurationException.class, action::run);
        assertEquals(expected, failure.rule());
    }
}
