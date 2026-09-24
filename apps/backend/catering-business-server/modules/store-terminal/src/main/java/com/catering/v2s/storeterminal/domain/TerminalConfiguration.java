package com.catering.v2s.storeterminal.domain;

import com.catering.v2s.storeterminal.domain.generated.StoreTerminalRules;
import com.catering.v2s.storeterminal.domain.generated.StoreTerminalRules.FunctionRule;
import com.catering.v2s.storeterminal.domain.generated.StoreTerminalRules.SceneRule;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/** Validated printer/function configuration for one terminal. Cross-owner refs are validated by its owner. */
public final class TerminalConfiguration {
    private final List<Printer> printers;
    private final List<Function> functions;

    private TerminalConfiguration(List<Printer> printers, List<Function> functions) {
        this.printers = List.copyOf(printers);
        this.functions = List.copyOf(functions);
    }

    public static TerminalConfiguration create(String deviceTypeKey, List<Printer> printers, List<Function> functions) {
        Objects.requireNonNull(deviceTypeKey, "deviceTypeKey");
        List<Printer> immutablePrinters = List.copyOf(printers);
        List<Function> immutableFunctions = List.copyOf(functions);
        validate(deviceTypeKey, immutablePrinters, immutableFunctions);
        return new TerminalConfiguration(immutablePrinters, immutableFunctions);
    }

    private static void validate(String deviceTypeKey, List<Printer> printers, List<Function> functions) {
        boolean supportedDevice = StoreTerminalRules.DEVICE_TYPES.stream()
                .anyMatch(device -> device.key().equals(deviceTypeKey));
        if (!supportedDevice) {
            throw invalid(Rule.FUNCTION_DEVICE_UNSUPPORTED);
        }
        if (functions.isEmpty()) {
            throw invalid(Rule.FUNCTION_REQUIRED);
        }

        Map<IdentityKey, String> childIdentities = new HashMap<>();
        Set<String> printerNames = new HashSet<>();
        Map<String, Set<String>> connectionIdentifiers = new HashMap<>();
        Map<IdentityKey, Printer> printersByIdentity = new HashMap<>();

        for (Printer printer : printers) {
            Objects.requireNonNull(printer, "printer");
            IdentityKey identity = identityKey(printer.identity());
            addUniqueIdentity(childIdentities, identity);
            String normalizedName = printer.name().trim();
            if (normalizedName.isEmpty()) {
                throw invalid(Rule.PRINTER_NAME_INVALID);
            }
            if (!printerNames.add(normalizedName)) {
                throw invalid(Rule.PRINTER_NAME_DUPLICATE);
            }
            PrinterSpecification specification = Objects.requireNonNull(printer.specification(), "specification");
            String connectionMethod = specification.connectionMethodKey();
            if ("USB".equals(connectionMethod) || "BLUETOOTH".equals(connectionMethod)) {
                String identifier = specification.connectionParameter();
                Set<String> identifiers =
                        connectionIdentifiers.computeIfAbsent(connectionMethod, ignored -> new HashSet<>());
                if (!identifiers.add(identifier)) {
                    throw invalid(Rule.CONNECTION_IDENTIFIER_DUPLICATE);
                }
            }
            printersByIdentity.put(identity, printer);
        }

        Map<String, Integer> functionCounts = new HashMap<>();
        for (Function function : functions) {
            Objects.requireNonNull(function, "function");
            IdentityKey functionIdentity = identityKey(function.identity());
            addUniqueIdentity(childIdentities, functionIdentity);

            FunctionRule functionRule = StoreTerminalRules.FUNCTION_RULES.stream()
                    .filter(rule -> rule.key().equals(function.key()))
                    .findFirst()
                    .orElseThrow(() -> invalid(Rule.FUNCTION_DEVICE_UNSUPPORTED));
            if (!functionRule.supportedDeviceTypeKeys().contains(deviceTypeKey)) {
                throw invalid(Rule.FUNCTION_DEVICE_UNSUPPORTED);
            }
            int count = functionCounts.merge(function.key(), 1, Integer::sum);
            if (functionRule.maxPerTerminal() != null && count > functionRule.maxPerTerminal()) {
                throw invalid(Rule.FUNCTION_DUPLICATE_SINGLETON);
            }

            validateRanges(functionRule, function.ranges());
            validateScenes(functionRule, function.scenes(), printersByIdentity);
        }
    }

    private static void validateRanges(FunctionRule functionRule, List<RangeSelection> ranges) {
        Set<String> seenRangeKeys = new HashSet<>();
        for (RangeSelection range : ranges) {
            Objects.requireNonNull(range, "range");
            if (!functionRule.allowedRangeKeys().contains(range.key())) {
                throw invalid(Rule.RANGE_NOT_ALLOWED);
            }
            if (!seenRangeKeys.add(range.key())) {
                throw invalid(Rule.RANGE_SELECTION_INVALID);
            }
            if (range.all() && !range.refs().isEmpty()) {
                throw invalid(Rule.RANGE_SELECTION_INVALID);
            }
            if (new HashSet<>(range.refs()).size() != range.refs().size()) {
                throw invalid(Rule.RANGE_SELECTION_INVALID);
            }
            if (range.all() && !("TABLE_AREA".equals(range.key()) || "PRODUCTION_TAG".equals(range.key()))) {
                throw invalid(Rule.RANGE_SELECTION_INVALID);
            }
            if (!range.refs().isEmpty()
                    && !("TABLE_AREA".equals(range.key()) || "PRODUCTION_TAG".equals(range.key()))) {
                throw invalid(Rule.RANGE_SELECTION_INVALID);
            }
        }
    }

    private static void validateScenes(
            FunctionRule functionRule, List<SceneSelection> scenes, Map<IdentityKey, Printer> printersByIdentity) {
        Set<String> seenSceneKeys = new HashSet<>();
        for (SceneSelection scene : scenes) {
            Objects.requireNonNull(scene, "scene");
            SceneRule sceneRule = StoreTerminalRules.scenesForFunction(functionRule.key()).stream()
                    .filter(rule -> rule.key().equals(scene.key()))
                    .findFirst()
                    .orElseThrow(() -> invalid(Rule.SCENE_NOT_ALLOWED));
            if (!seenSceneKeys.add(scene.key())) {
                throw invalid(Rule.SCENE_DUPLICATE);
            }

            Set<String> seenOrderTypes = new HashSet<>();
            for (String orderType : scene.orderTypes()) {
                boolean known = StoreTerminalRules.ORDER_TYPES.stream()
                        .anyMatch(type -> type.key().equals(orderType));
                if (!known) {
                    throw invalid(Rule.ORDER_TYPE_INVALID);
                }
                if (!seenOrderTypes.add(orderType)) {
                    throw invalid(Rule.ORDER_TYPE_DUPLICATE);
                }
            }

            Set<IdentityKey> seenPrinterIdentities = new HashSet<>();
            for (PrinterBinding binding : scene.printers()) {
                Objects.requireNonNull(binding, "printer binding");
                IdentityKey printerIdentity = identityKey(binding.identity());
                if (!seenPrinterIdentities.add(printerIdentity)) {
                    throw invalid(Rule.SCENE_PRINTER_DUPLICATE);
                }
                Printer printer = printersByIdentity.get(printerIdentity);
                if (printer == null) {
                    throw invalid(Rule.SCENE_PRINTER_INVALID);
                }
                if (!sceneRule
                        .allowedPaperSpecKeys()
                        .contains(printer.specification().paperSpecKey())) {
                    throw invalid(Rule.SCENE_PAPER_SPEC_UNSUPPORTED);
                }
            }
        }
    }

    private static IdentityKey identityKey(ChildIdentity identity) {
        Objects.requireNonNull(identity, "identity");
        boolean hasRef = identity.ref() != null;
        boolean hasClientKey =
                identity.clientKey() != null && !identity.clientKey().isBlank();
        if (hasRef == hasClientKey || (identity.clientKey() != null && !hasClientKey)) {
            throw invalid(Rule.IDENTITY_INVALID);
        }
        return hasRef
                ? new IdentityKey("ref", identity.ref().toString())
                : new IdentityKey("clientKey", identity.clientKey());
    }

    private static void addUniqueIdentity(Map<IdentityKey, String> identities, IdentityKey identity) {
        if (identities.putIfAbsent(identity, "present") != null) {
            throw invalid(Rule.IDENTITY_DUPLICATE);
        }
    }

    private static InvalidConfigurationException invalid(Rule rule) {
        return new InvalidConfigurationException(rule);
    }

    public List<Printer> printers() {
        return printers;
    }

    public List<Function> functions() {
        return functions;
    }

    private record IdentityKey(String kind, String value) {}

    public record ChildIdentity(UUID ref, String clientKey) {}

    public record Printer(ChildIdentity identity, String name, PrinterSpecification specification) {
        public Printer {
            Objects.requireNonNull(name, "name");
        }
    }

    public record Function(
            ChildIdentity identity, String key, List<RangeSelection> ranges, List<SceneSelection> scenes) {
        public Function {
            Objects.requireNonNull(key, "key");
            ranges = List.copyOf(ranges);
            scenes = List.copyOf(scenes);
        }
    }

    public record RangeSelection(String key, boolean all, List<UUID> refs) {
        public RangeSelection {
            Objects.requireNonNull(key, "key");
            refs = List.copyOf(refs);
        }
    }

    public record SceneSelection(String key, List<String> orderTypes, List<PrinterBinding> printers) {
        public SceneSelection {
            Objects.requireNonNull(key, "key");
            orderTypes = List.copyOf(orderTypes);
            printers = List.copyOf(printers);
        }
    }

    public record PrinterBinding(ChildIdentity identity) {}

    public enum Rule {
        FUNCTION_REQUIRED,
        FUNCTION_DEVICE_UNSUPPORTED,
        FUNCTION_DUPLICATE_SINGLETON,
        IDENTITY_DUPLICATE,
        IDENTITY_INVALID,
        RANGE_NOT_ALLOWED,
        RANGE_SELECTION_INVALID,
        SCENE_NOT_ALLOWED,
        SCENE_DUPLICATE,
        ORDER_TYPE_INVALID,
        ORDER_TYPE_DUPLICATE,
        SCENE_PRINTER_INVALID,
        SCENE_PRINTER_DUPLICATE,
        SCENE_PAPER_SPEC_UNSUPPORTED,
        PRINTER_NAME_INVALID,
        PRINTER_NAME_DUPLICATE,
        CONNECTION_IDENTIFIER_DUPLICATE
    }

    public static final class InvalidConfigurationException extends IllegalArgumentException {
        private final Rule rule;

        private InvalidConfigurationException(Rule rule) {
            super("Invalid terminal configuration rule: " + Objects.requireNonNull(rule, "rule"));
            this.rule = rule;
        }

        public Rule rule() {
            return rule;
        }
    }
}
