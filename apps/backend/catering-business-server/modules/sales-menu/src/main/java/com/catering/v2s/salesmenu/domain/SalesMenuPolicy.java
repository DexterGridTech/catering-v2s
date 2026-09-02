package com.catering.v2s.salesmenu.domain;

/** Closed owner limits from the sales-menu design; business decisions remain in the owner service. */
public final class SalesMenuPolicy {
    public static final int MAX_CUSTOM_ASSETS = 6;
    public static final int PAGE_SIZE = 20;

    private SalesMenuPolicy() {}
}
