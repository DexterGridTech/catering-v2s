package com.catering.v2s.app.bootstrap;

import com.catering.v2s.platform.access.PlatformAccessModule;

public final class BusinessServerBoundary {
    private BusinessServerBoundary() {}

    public static String moduleName() {
        return PlatformAccessModule.NAME;
    }
}
