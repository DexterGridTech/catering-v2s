package com.catering.v2s.app.acceptance;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;

final class BackendAcceptanceScenarioCatalog {
    private BackendAcceptanceScenarioCatalog() {
    }

    static List<ScenarioDefinition> discover(BackendAcceptanceTest host) {
        List<Object> groups = List.of(
                new IamAcceptanceScenarios(host),
                new OrganizationAcceptanceScenarios(host),
                new CommercialContractAcceptanceScenarios(host),
                new AssetAcceptanceScenarios(host),
                new CatalogAcceptanceScenarios(host));
        return groups.stream()
                .flatMap(target -> Arrays.stream(target.getClass().getDeclaredMethods())
                        .filter(method -> method.isAnnotationPresent(AcceptanceScenario.class))
                        .map(method -> new ScenarioDefinition(target, method, method.getAnnotation(AcceptanceScenario.class))))
                .sorted((left, right) -> left.annotation().id().compareTo(right.annotation().id()))
                .toList();
    }
}
