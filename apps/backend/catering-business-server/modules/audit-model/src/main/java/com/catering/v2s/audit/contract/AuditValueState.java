package com.catering.v2s.audit.contract;

/** Distinguishes the four value states that a new audit change can represent. */
public enum AuditValueState {
    MISSING,
    NULL,
    CLEARED,
    VALUE
}
