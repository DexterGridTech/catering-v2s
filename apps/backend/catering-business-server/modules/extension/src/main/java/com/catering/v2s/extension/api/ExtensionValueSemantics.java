package com.catering.v2s.extension.api;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

/** Shared validation for canonical extension scalar values at every owner boundary. */
public final class ExtensionValueSemantics {
    private ExtensionValueSemantics() {}

    public static boolean isCanonicalDate(String value) {
        if (value == null) return false;
        try {
            LocalDate.parse(value, DateTimeFormatter.ISO_LOCAL_DATE);
            return true;
        } catch (DateTimeParseException failure) {
            return false;
        }
    }
}
