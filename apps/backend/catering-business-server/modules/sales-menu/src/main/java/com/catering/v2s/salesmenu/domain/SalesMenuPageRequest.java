package com.catering.v2s.salesmenu.domain;

/** A bounded, opaque-cursor page request; offset pagination is not part of this owner boundary. */
public record SalesMenuPageRequest(String cursor, int pageSize) {
    public SalesMenuPageRequest {
        if (pageSize != SalesMenuPolicy.PAGE_SIZE) {
            throw new IllegalArgumentException("pageSize must be 20");
        }
        if (cursor != null && cursor.length() > 512) {
            throw new IllegalArgumentException("cursor is too long");
        }
    }

    public static SalesMenuPageRequest firstPage(int pageSize) {
        return new SalesMenuPageRequest(null, pageSize);
    }
}
