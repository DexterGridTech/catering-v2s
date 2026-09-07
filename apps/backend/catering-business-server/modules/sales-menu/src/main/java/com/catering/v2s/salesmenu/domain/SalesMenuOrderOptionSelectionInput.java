package com.catering.v2s.salesmenu.domain;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

public record SalesMenuOrderOptionSelectionInput(UUID definitionRef, List<UUID> selectedValueRefs) {
    public SalesMenuOrderOptionSelectionInput {
        Objects.requireNonNull(definitionRef, "definitionRef");
        selectedValueRefs = List.copyOf(Objects.requireNonNull(selectedValueRefs, "selectedValueRefs"));
        selectedValueRefs.forEach(valueRef -> Objects.requireNonNull(valueRef, "selectedValueRefs contains null"));
    }
}
