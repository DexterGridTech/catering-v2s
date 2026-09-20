package com.catering.v2s.audit.contract;

/** Value-only audit write SPI; an owner supplies the table and transaction-bound persistence adapter. */
@FunctionalInterface
public interface AuditEventWriter {
    int write(AuditEvent event);
}
