package com.catering.v2s.storeterminal.domain;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class PrinterSpecificationTest {
    @Test
    void acceptsGeneratedBuiltinAndExternalModelCombinations() {
        PrinterSpecification builtin =
                PrinterSpecification.of("GENERIC", "BUILTIN_THERMAL_58", "THERMAL_58", "BUILT_IN", null);
        PrinterSpecification external =
                PrinterSpecification.of("GENERIC", "GENERIC_LABEL_40_30", "LABEL_40_30", "USB", "USB-01");

        assertEquals("BUILTIN_THERMAL_58", builtin.modelKey());
        assertEquals("USB-01", external.connectionParameter());
    }

    @Test
    void rejectsUnknownAndMismatchedBrandOrModel() {
        assertField(
                PrinterSpecification.Field.BRAND,
                () -> PrinterSpecification.of("UNKNOWN", "EPSON_TM_T88VII", "THERMAL_58", "NETWORK", "192.0.2.10"));
        assertField(
                PrinterSpecification.Field.MODEL,
                () -> PrinterSpecification.of("EPSON", "ZEBRA_ZD421D", "LABEL_40_30", "USB", "USB-01"));
        assertField(
                PrinterSpecification.Field.MODEL,
                () -> PrinterSpecification.of("EPSON", "UNKNOWN_MODEL", "THERMAL_58", "USB", "USB-01"));
    }

    @Test
    void rejectsPaperAndConnectionMethodsNotSupportedBySelectedModel() {
        assertField(
                PrinterSpecification.Field.PAPER_SPEC,
                () -> PrinterSpecification.of("ZEBRA", "ZEBRA_ZD411D", "LABEL_80_50", "USB", "USB-01"));
        assertField(
                PrinterSpecification.Field.CONNECTION_METHOD,
                () -> PrinterSpecification.of("GENERIC", "BUILTIN_THERMAL_58", "THERMAL_58", "NETWORK", "192.0.2.10"));
        assertField(
                PrinterSpecification.Field.CONNECTION_METHOD,
                () -> PrinterSpecification.of("GENERIC", "GENERIC_THERMAL_58", "THERMAL_58", "BUILT_IN", null));
    }

    @Test
    void validatesConnectionParametersFromGeneratedRules() {
        assertField(
                PrinterSpecification.Field.CONNECTION_PARAMETER,
                "999.0.2.10",
                () -> PrinterSpecification.of("EPSON", "EPSON_TM_T88VII", "THERMAL_58", "NETWORK", "999.0.2.10"));
        assertField(
                PrinterSpecification.Field.CONNECTION_PARAMETER,
                () -> PrinterSpecification.of("GENERIC", "GENERIC_LABEL_40_30", "LABEL_40_30", "USB", ""));
        assertField(
                PrinterSpecification.Field.CONNECTION_PARAMETER,
                "USB-SECRET-\u0001-01",
                () -> PrinterSpecification.of(
                        "GENERIC", "GENERIC_LABEL_40_30", "LABEL_40_30", "USB", "USB-SECRET-\u0001-01"));
        assertField(
                PrinterSpecification.Field.CONNECTION_PARAMETER,
                () -> PrinterSpecification.of("GENERIC", "BUILTIN_THERMAL_58", "THERMAL_58", "BUILT_IN", "unexpected"));
    }

    @Test
    void acceptsOneValidPrinterForEachGeneratedConnectionMethod() {
        assertDoesNotThrow(
                () -> PrinterSpecification.of("EPSON", "EPSON_TM_T88VII", "THERMAL_58", "NETWORK", "192.0.2.10"));
        assertDoesNotThrow(() ->
                PrinterSpecification.of("GENERIC", "GENERIC_THERMAL_58", "THERMAL_58", "CLOUD", "cloud-device-01"));
        assertDoesNotThrow(
                () -> PrinterSpecification.of("GENERIC", "GENERIC_THERMAL_58", "THERMAL_58", "USB", "USB-01"));
        assertDoesNotThrow(
                () -> PrinterSpecification.of("GENERIC", "GENERIC_THERMAL_58", "THERMAL_58", "BLUETOOTH", "BT-01"));
        assertDoesNotThrow(
                () -> PrinterSpecification.of("GENERIC", "BUILTIN_THERMAL_58", "THERMAL_58", "BUILT_IN", null));
    }

    @Test
    void rejectsMissingRequiredParametersForEveryExternalConnectionMethod() {
        assertField(
                PrinterSpecification.Field.CONNECTION_PARAMETER,
                () -> PrinterSpecification.of("EPSON", "EPSON_TM_T88VII", "THERMAL_58", "NETWORK", null));
        assertField(
                PrinterSpecification.Field.CONNECTION_PARAMETER,
                () -> PrinterSpecification.of("GENERIC", "GENERIC_THERMAL_58", "THERMAL_58", "CLOUD", null));
        assertField(
                PrinterSpecification.Field.CONNECTION_PARAMETER,
                () -> PrinterSpecification.of("GENERIC", "GENERIC_THERMAL_58", "THERMAL_58", "USB", null));
        assertField(
                PrinterSpecification.Field.CONNECTION_PARAMETER,
                () -> PrinterSpecification.of("GENERIC", "GENERIC_THERMAL_58", "THERMAL_58", "BLUETOOTH", null));
    }

    @Test
    void enforcesIdentifierLengthByUnicodeCodePoint() {
        String maxLength = "😀" + "A".repeat(159);
        String tooLong = "😀" + "A".repeat(160);

        assertDoesNotThrow(
                () -> PrinterSpecification.of("GENERIC", "GENERIC_LABEL_40_30", "LABEL_40_30", "USB", maxLength));
        assertField(
                PrinterSpecification.Field.CONNECTION_PARAMETER,
                () -> PrinterSpecification.of("GENERIC", "GENERIC_LABEL_40_30", "LABEL_40_30", "USB", tooLong));
        assertField(
                PrinterSpecification.Field.CONNECTION_PARAMETER,
                "BT-SECRET-\u0001",
                () -> PrinterSpecification.of(
                        "GENERIC", "GENERIC_THERMAL_58", "THERMAL_58", "BLUETOOTH", "BT-SECRET-\u0001"));
    }

    private static void assertField(PrinterSpecification.Field field, Runnable action) {
        PrinterSpecification.InvalidRuleException failure =
                assertThrows(PrinterSpecification.InvalidRuleException.class, action::run);
        assertEquals(field, failure.field());
    }

    private static void assertField(PrinterSpecification.Field field, String submittedValue, Runnable action) {
        PrinterSpecification.InvalidRuleException failure =
                assertThrows(PrinterSpecification.InvalidRuleException.class, action::run);
        assertEquals(field, failure.field());
        assertFalse(failure.getMessage().contains(submittedValue));
    }
}
