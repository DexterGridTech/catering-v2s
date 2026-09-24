package com.catering.v2s.storeterminal.domain;

import com.catering.v2s.storeterminal.domain.generated.StoreTerminalRules;
import com.catering.v2s.storeterminal.domain.generated.StoreTerminalRules.ConnectionMethod;
import com.catering.v2s.storeterminal.domain.generated.StoreTerminalRules.ConnectionParameter;
import com.catering.v2s.storeterminal.domain.generated.StoreTerminalRules.PrinterModel;
import java.util.Objects;

public final class PrinterSpecification {
    private final String brandKey;
    private final String modelKey;
    private final String paperSpecKey;
    private final String connectionMethodKey;
    private final String connectionParameter;

    private PrinterSpecification(
            String brandKey,
            String modelKey,
            String paperSpecKey,
            String connectionMethodKey,
            String connectionParameter) {
        this.brandKey = brandKey;
        this.modelKey = modelKey;
        this.paperSpecKey = paperSpecKey;
        this.connectionMethodKey = connectionMethodKey;
        this.connectionParameter = connectionParameter;
    }

    public static PrinterSpecification of(
            String brandKey,
            String modelKey,
            String paperSpecKey,
            String connectionMethodKey,
            String connectionParameter) {
        boolean knownBrand = StoreTerminalRules.PRINTER_BRANDS.stream()
                .anyMatch(brand -> brand.key().equals(brandKey));
        if (!knownBrand) {
            throw invalid(Field.BRAND);
        }

        PrinterModel model = StoreTerminalRules.PRINTER_MODELS.stream()
                .filter(candidate -> candidate.key().equals(modelKey))
                .findFirst()
                .orElseThrow(() -> invalid(Field.MODEL));
        if (!model.brandKey().equals(brandKey)) {
            throw invalid(Field.MODEL);
        }

        boolean knownPaperSpec = StoreTerminalRules.PAPER_SPECS.stream()
                .anyMatch(paper -> paper.key().equals(paperSpecKey));
        if (!knownPaperSpec || !StoreTerminalRules.printerModelSupportsPaper(modelKey, paperSpecKey)) {
            throw invalid(Field.PAPER_SPEC);
        }

        ConnectionMethod connectionMethod = StoreTerminalRules.CONNECTION_METHODS.stream()
                .filter(candidate -> candidate.key().equals(connectionMethodKey))
                .findFirst()
                .orElseThrow(() -> invalid(Field.CONNECTION_METHOD));
        if (!StoreTerminalRules.printerModelSupportsConnection(modelKey, connectionMethodKey)) {
            throw invalid(Field.CONNECTION_METHOD);
        }

        validateConnectionParameter(connectionMethod.parameter(), connectionParameter);
        return new PrinterSpecification(brandKey, modelKey, paperSpecKey, connectionMethodKey, connectionParameter);
    }

    private static void validateConnectionParameter(ConnectionParameter rule, String value) {
        if (rule == null) {
            if (value != null) {
                throw invalid(Field.CONNECTION_PARAMETER);
            }
            return;
        }

        if (value == null) {
            if (rule.required()) {
                throw invalid(Field.CONNECTION_PARAMETER);
            }
            return;
        }

        int length = value.codePointCount(0, value.length());
        if ((rule.minLength() != null && length < rule.minLength())
                || (rule.maxLength() != null && length > rule.maxLength())) {
            throw invalid(Field.CONNECTION_PARAMETER);
        }
        if (rule.rejectUnicodeControlCharacters() && value.codePoints().anyMatch(Character::isISOControl)) {
            throw invalid(Field.CONNECTION_PARAMETER);
        }
        if (rule.pattern() != null && !value.matches(rule.pattern())) {
            throw invalid(Field.CONNECTION_PARAMETER);
        }
    }

    private static InvalidRuleException invalid(Field field) {
        return new InvalidRuleException(field);
    }

    public String brandKey() {
        return brandKey;
    }

    public String modelKey() {
        return modelKey;
    }

    public String paperSpecKey() {
        return paperSpecKey;
    }

    public String connectionMethodKey() {
        return connectionMethodKey;
    }

    public String connectionParameter() {
        return connectionParameter;
    }

    public enum Field {
        BRAND,
        MODEL,
        PAPER_SPEC,
        CONNECTION_METHOD,
        CONNECTION_PARAMETER
    }

    public static final class InvalidRuleException extends IllegalArgumentException {
        private final Field field;

        private InvalidRuleException(Field field) {
            super("Invalid printer rule field: " + Objects.requireNonNull(field, "field"));
            this.field = field;
        }

        public Field field() {
            return field;
        }
    }
}
