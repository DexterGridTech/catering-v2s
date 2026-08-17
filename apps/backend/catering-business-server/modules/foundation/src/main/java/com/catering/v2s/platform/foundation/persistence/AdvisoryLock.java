package com.catering.v2s.platform.foundation.persistence;

import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;

/** Acquires transaction-scoped PostgreSQL advisory locks without owning business semantics. */
public final class AdvisoryLock {
    private AdvisoryLock() {}

    public static void acquire(JdbcTemplate jdbc, String namespace, String scopeKey, String idempotencyKey) {
        jdbc.queryForList(
                "SELECT pg_advisory_xact_lock(hashtext(CAST(? AS text)), hashtext(CAST(? AS text)))",
                namespace + ":" + scopeKey,
                idempotencyKey);
    }

    public static void acquire(JdbcTemplate jdbc, int namespaceTag, UUID ref) {
        jdbc.queryForList(
                "SELECT pg_advisory_xact_lock(?, ?)", namespaceTag ^ (int) (ref.getMostSignificantBits() >>> 32), (int)
                        ref.getLeastSignificantBits());
    }
}
