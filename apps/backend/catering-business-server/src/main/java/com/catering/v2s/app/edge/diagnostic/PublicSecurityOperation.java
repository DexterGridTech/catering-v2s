package com.catering.v2s.app.edge.diagnostic;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** Fixed public authentication/recovery operation identity; never derived from a request value. */
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
public @interface PublicSecurityOperation {
    String id();

    String owner();
}
