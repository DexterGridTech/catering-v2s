package com.catering.v2s.app.edge.operations.salesmenu;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;

class OperationsSalesMenuControllerRouteTest {
    private static final List<Route> ROUTES = List.of(
            new Route("getOperationsSalesMenus", "salesMenus", GetMapping.class, List.of()),
            new Route("getOperationsSalesMenu", "salesMenu", GetMapping.class, List.of("/{salesMenuRef}")),
            new Route(
                    "getOperationsSalesMenuDraftSections",
                    "draftSections",
                    GetMapping.class,
                    List.of("/{salesMenuRef}/draft/sections")),
            new Route(
                    "getOperationsSalesMenuDraftItems",
                    "draftItems",
                    GetMapping.class,
                    List.of("/{salesMenuRef}/draft/sections/{salesSectionRef}/items")),
            new Route(
                    "getOperationsSalesMenuDraftItem",
                    "draftItem",
                    GetMapping.class,
                    List.of("/{salesMenuRef}/draft/items/{salesItemRef}")),
            new Route(
                    "getOperationsSalesMenuPublishedSections",
                    "publishedSections",
                    GetMapping.class,
                    List.of("/{salesMenuRef}/published/sections")),
            new Route(
                    "getOperationsSalesMenuPublishedItems",
                    "publishedItems",
                    GetMapping.class,
                    List.of("/{salesMenuRef}/published/sections/{salesSectionRef}/items")),
            new Route(
                    "getOperationsSalesMenuPublishedItem",
                    "publishedItem",
                    GetMapping.class,
                    List.of("/{salesMenuRef}/published/items/{salesItemRef}")),
            new Route(
                    "getOperationsSalesMenuItemCandidates",
                    "candidates",
                    GetMapping.class,
                    List.of("/{salesMenuRef}/draft/item-candidates")),
            new Route(
                    "getOperationsSalesMenuPublicationPreview",
                    "publicationPreview",
                    GetMapping.class,
                    List.of("/{salesMenuRef}/draft/publication-preview")),
            new Route(
                    "getOperationsSalesMenuOperationRecords",
                    "operationRecords",
                    GetMapping.class,
                    List.of("/{salesMenuRef}/sales-menu-operation-records")),
            new Route("createOperationsSalesMenu", "create", PostMapping.class, List.of()),
            new Route("copyOperationsSalesMenu", "copy", PostMapping.class, List.of("/{salesMenuRef}/copies")),
            new Route("renameOperationsSalesMenu", "rename", PatchMapping.class, List.of("/{salesMenuRef}/name")),
            new Route("archiveOperationsSalesMenu", "archive", PostMapping.class, List.of("/{salesMenuRef}/archive")),
            new Route(
                    "setOperationsSalesMenuActivation",
                    "activation",
                    PutMapping.class,
                    List.of("/{salesMenuRef}/channels/{channelRef}/activation")),
            new Route(
                    "updateOperationsSalesMenuSchedule",
                    "schedule",
                    PutMapping.class,
                    List.of("/{salesMenuRef}/draft/schedule")),
            new Route(
                    "createOperationsSalesMenuSection",
                    "createSection",
                    PostMapping.class,
                    List.of("/{salesMenuRef}/draft/sections")),
            new Route(
                    "renameOperationsSalesMenuSection",
                    "renameSection",
                    PatchMapping.class,
                    List.of("/{salesMenuRef}/draft/sections/{salesSectionRef}/name")),
            new Route(
                    "deleteOperationsSalesMenuSection",
                    "deleteSection",
                    DeleteMapping.class,
                    List.of("/{salesMenuRef}/draft/sections/{salesSectionRef}")),
            new Route(
                    "moveOperationsSalesMenuSection",
                    "moveSection",
                    PostMapping.class,
                    List.of("/{salesMenuRef}/draft/sections/{salesSectionRef}/move")),
            new Route(
                    "addOperationsSalesMenuItems",
                    "addItems",
                    PostMapping.class,
                    List.of("/{salesMenuRef}/draft/sections/{salesSectionRef}/items")),
            new Route(
                    "updateOperationsSalesMenuItem",
                    "updateItem",
                    PutMapping.class,
                    List.of("/{salesMenuRef}/draft/items/{salesItemRef}")),
            new Route(
                    "deleteOperationsSalesMenuItem",
                    "deleteItem",
                    DeleteMapping.class,
                    List.of("/{salesMenuRef}/draft/items/{salesItemRef}")),
            new Route(
                    "moveOperationsSalesMenuItem",
                    "moveItem",
                    PostMapping.class,
                    List.of("/{salesMenuRef}/draft/items/{salesItemRef}/move")),
            new Route(
                    "publishOperationsSalesMenu",
                    "publish",
                    PostMapping.class,
                    List.of("/{salesMenuRef}/publications")),
            new Route(
                    "setOperationsSalesMenuItemSoldOut",
                    "manualSoldOut",
                    PostMapping.class,
                    List.of("/{salesMenuRef}/published/items/{salesItemRef}/channels/{channelRef}/manual-sold-out")),
            new Route(
                    "restoreOperationsSalesMenuItemSale",
                    "manualRestore",
                    PostMapping.class,
                    List.of("/{salesMenuRef}/published/items/{salesItemRef}/channels/{channelRef}/manual-restore")));

    @Test
    void allThirtySalesMenuOperationsHaveOneExplicitEdgeRoute() throws Exception {
        Set<String> actual = Arrays.stream(OperationsSalesMenuController.class.getDeclaredMethods())
                .filter(method -> hasRouteAnnotation(method))
                .map(Method::getName)
                .collect(Collectors.toSet());
        Set<String> expected = ROUTES.stream().map(Route::controllerMethod).collect(Collectors.toSet());
        assertEquals(expected, actual, "sales-menu controller route set drifted");

        for (Route route : ROUTES) {
            Method method = controllerMethod(route.controllerMethod());
            assertEquals(route.annotationType(), route.annotation(method).annotationType(), route.operationId());
            assertEquals(route.paths(), route.paths(method), route.operationId() + " route path drifted");
        }
    }

    @Test
    void salesMenuControllerKeepsTheApprovedStoreScopedBasePath() {
        assertEquals(
                "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus",
                OperationsSalesMenuController.class.getAnnotation(
                                org.springframework.web.bind.annotation.RequestMapping.class)
                        .value()[0]);
    }

    private static boolean hasRouteAnnotation(Method method) {
        return method.isAnnotationPresent(GetMapping.class)
                || method.isAnnotationPresent(PostMapping.class)
                || method.isAnnotationPresent(PatchMapping.class)
                || method.isAnnotationPresent(PutMapping.class)
                || method.isAnnotationPresent(DeleteMapping.class);
    }

    private static Method controllerMethod(String name) {
        return Arrays.stream(OperationsSalesMenuController.class.getDeclaredMethods())
                .filter(method -> method.getName().equals(name))
                .findFirst()
                .orElseThrow();
    }

    private record Route(
            String operationId,
            String controllerMethod,
            Class<? extends java.lang.annotation.Annotation> annotationType,
            List<String> paths) {
        private java.lang.annotation.Annotation annotation(Method method) {
            return method.getAnnotation(annotationType);
        }

        private List<String> paths(Method method) {
            if (annotationType == GetMapping.class)
                return List.of(method.getAnnotation(GetMapping.class).value());
            if (annotationType == PostMapping.class)
                return List.of(method.getAnnotation(PostMapping.class).value());
            if (annotationType == PatchMapping.class)
                return List.of(method.getAnnotation(PatchMapping.class).value());
            if (annotationType == PutMapping.class)
                return List.of(method.getAnnotation(PutMapping.class).value());
            return List.of(method.getAnnotation(DeleteMapping.class).value());
        }
    }
}
