package com.catering.v2s.terminaldataserver.config;

import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.extension.BeforeAllCallback;
import org.junit.jupiter.api.extension.ExtensionContext;
import reactor.blockhound.BlockHound;

/** Installs BlockHound once in the isolated TDS test JVM before any test context starts. */
public final class TdsBlockHoundExtension implements BeforeAllCallback {
    private static final AtomicBoolean INSTALLED = new AtomicBoolean();

    @Override
    public void beforeAll(ExtensionContext context) {
        if (INSTALLED.compareAndSet(false, true)) BlockHound.install();
    }
}
