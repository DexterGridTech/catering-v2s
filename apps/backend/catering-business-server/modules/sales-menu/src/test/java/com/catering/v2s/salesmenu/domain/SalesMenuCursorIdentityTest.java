package com.catering.v2s.salesmenu.domain;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.platform.foundation.collection.CanonicalCursorIdentity;
import com.catering.v2s.platform.foundation.collection.OpaqueCollectionCursor;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class SalesMenuCursorIdentityTest {
    private static final UUID WORKSPACE = UUID.fromString("11111111-1111-4111-8111-111111111111");
    private static final UUID STORE = UUID.fromString("22222222-2222-4222-8222-222222222222");
    private static final UUID CHANNEL = UUID.fromString("33333333-3333-4333-8333-333333333333");
    private static final UUID MENU = UUID.fromString("44444444-4444-4444-8444-444444444444");
    private static final UUID VERSION = UUID.fromString("55555555-5555-4555-8555-555555555555");
    private static final UUID SECTION = UUID.fromString("66666666-6666-4666-8666-666666666666");
    private static final UUID TIE_BREAKER = UUID.fromString("77777777-7777-4777-8777-777777777777");

    @Test
    void identityBindsAllOwnerAndViewDimensions() {
        SalesMenuCursorIdentity identity = identity();

        assertEquals(11, CanonicalCursorIdentity.decode(identity.value(), 11).size());
    }

    @Test
    void cursorMustMatchTheFullIdentityIncludingPageSizeAndSection() {
        SalesMenuCursorIdentity identity = identity();
        String cursor = OpaqueCollectionCursor.encode(identity.value(), "100", TIE_BREAKER);

        assertDoesNotThrow(() -> OpaqueCollectionCursor.decode(cursor, identity.value()));
        List<String> wrongPageSizeComponents = new ArrayList<>(CanonicalCursorIdentity.decode(identity.value(), 11));
        wrongPageSizeComponents.set(10, "50");
        String wrongPageSizeIdentity = CanonicalCursorIdentity.encode(wrongPageSizeComponents.toArray(String[]::new));
        assertThrows(
                OpaqueCollectionCursor.InvalidCursor.class,
                () -> OpaqueCollectionCursor.decode(cursor, wrongPageSizeIdentity));
        assertThrows(
                OpaqueCollectionCursor.InvalidCursor.class,
                () -> OpaqueCollectionCursor.decode(
                        cursor, identity.value().replace(SECTION.toString(), MENU.toString())));
    }

    @Test
    void pageSizeMustBeFixedAtTwentyForRequestsAndCursorIdentities() {
        assertDoesNotThrow(() -> SalesMenuPageRequest.firstPage(20));
        assertDoesNotThrow(() -> identity(20));
        for (int invalidPageSize : new int[] {1, 19, 21, 100}) {
            assertThrows(IllegalArgumentException.class, () -> SalesMenuPageRequest.firstPage(invalidPageSize));
            assertThrows(IllegalArgumentException.class, () -> identity(invalidPageSize));
        }
    }

    @Test
    void filterAndModeDelimitersCannotCollide() {
        SalesMenuCursorIdentity filterWithDelimiter = new SalesMenuCursorIdentity(
                "operation",
                new SalesMenuScope(WORKSPACE, "group-1", STORE),
                CHANNEL,
                MENU,
                VERSION,
                SECTION,
                "DRAFT",
                "keyword|x",
                20);
        SalesMenuCursorIdentity modeWithDelimiter = new SalesMenuCursorIdentity(
                "operation",
                new SalesMenuScope(WORKSPACE, "group-1", STORE),
                CHANNEL,
                MENU,
                VERSION,
                SECTION,
                "DRAFT|keyword",
                "x",
                20);
        assertNotEquals(filterWithDelimiter.value(), modeWithDelimiter.value());
    }

    private static SalesMenuCursorIdentity identity() {
        return identity(20);
    }

    private static SalesMenuCursorIdentity identity(int pageSize) {
        return new SalesMenuCursorIdentity(
                "getOperationsSalesMenuDraftItems",
                new SalesMenuScope(WORKSPACE, "group-1", STORE),
                CHANNEL,
                MENU,
                VERSION,
                SECTION,
                "DRAFT",
                "keyword",
                pageSize);
    }
}
