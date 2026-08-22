package com.catering.v2s.platform.foundation.persistence;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** Acquires transaction-scoped PostgreSQL advisory locks without owning business semantics. */
public final class AdvisoryLock {
    private static final Object TRANSACTION_LOCKS_RESOURCE = new Object();

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

    /** Acquires a stable set of UUID locks in one database round trip. */
    public static void acquireAll(JdbcTemplate jdbc, int namespaceTag, Collection<UUID> refs) {
        if (refs == null || refs.isEmpty()) return;
        List<UUID> ordered = new ArrayList<>(new LinkedHashSet<>(refs));
        ordered.removeIf(java.util.Objects::isNull);
        ordered.sort(UUID::compareTo);
        if (ordered.isEmpty()) return;

        Set<String> acquired = transactionLocks();
        List<UUID> pending = ordered.stream()
                .filter(ref -> acquired == null || !acquired.contains(lockKey(namespaceTag, ref)))
                .toList();
        if (pending.isEmpty()) return;
        String projections = String.join(",", Collections.nCopies(pending.size(), "pg_advisory_xact_lock(?, ?)"));
        List<Object> arguments = new ArrayList<>(pending.size() * 2);
        for (UUID ref : pending) {
            arguments.add(namespaceTag ^ (int) (ref.getMostSignificantBits() >>> 32));
            arguments.add((int) ref.getLeastSignificantBits());
        }
        jdbc.queryForList("SELECT " + projections, arguments.toArray());
        if (acquired != null) pending.forEach(ref -> acquired.add(lockKey(namespaceTag, ref)));
    }

    private static String lockKey(int namespaceTag, UUID ref) {
        return namespaceTag + ":" + ref;
    }

    @SuppressWarnings("unchecked")
    private static Set<String> transactionLocks() {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) return null;
        if (TransactionSynchronizationManager.hasResource(TRANSACTION_LOCKS_RESOURCE))
            return (Set<String>) TransactionSynchronizationManager.getResource(TRANSACTION_LOCKS_RESOURCE);
        Set<String> acquired = new LinkedHashSet<>();
        TransactionSynchronizationManager.bindResource(TRANSACTION_LOCKS_RESOURCE, acquired);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (TransactionSynchronizationManager.hasResource(TRANSACTION_LOCKS_RESOURCE))
                    TransactionSynchronizationManager.unbindResource(TRANSACTION_LOCKS_RESOURCE);
            }
        });
        return acquired;
    }
}
