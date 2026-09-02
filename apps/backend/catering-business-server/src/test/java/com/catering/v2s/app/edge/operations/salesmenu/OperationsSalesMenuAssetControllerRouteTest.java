package com.catering.v2s.app.edge.operations.salesmenu;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.PostMapping;

class OperationsSalesMenuAssetControllerRouteTest {
    @Test
    void exposesOnlyTheTwoTargetBoundAssetOperations() throws Exception {
        Set<String> actual = Arrays.stream(OperationsSalesMenuAssetController.class.getDeclaredMethods())
                .filter(method -> method.isAnnotationPresent(PostMapping.class))
                .map(java.lang.reflect.Method::getName)
                .collect(Collectors.toSet());
        assertEquals(Set.of("stage", "release"), actual);

        PostMapping stage = controllerMethod("stage").getAnnotation(PostMapping.class);
        assertEquals(Set.of("/{salesMenuRef}/draft/items/{salesItemRef}/assets/stage"), Set.of(stage.value()));
        assertTrue(Arrays.asList(stage.consumes()).contains("multipart/form-data"));

        PostMapping release = controllerMethod("release").getAnnotation(PostMapping.class);
        assertEquals(
                Set.of("/{salesMenuRef}/draft/items/{salesItemRef}/assets/stage/{assetRef}/release"),
                Set.of(release.value()));
    }

    private static java.lang.reflect.Method controllerMethod(String name) {
        return Arrays.stream(OperationsSalesMenuAssetController.class.getDeclaredMethods())
                .filter(method -> method.getName().equals(name))
                .findFirst()
                .orElseThrow();
    }
}
