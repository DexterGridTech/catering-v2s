package com.catering.v2s.platform.iam.application.persistence;

import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed JDBC execution boundary for platform command receipt replay facts. */
@Repository
public class PlatformCommandReceiptPersistence {
    private final JdbcTemplate jdbc;

    public PlatformCommandReceiptPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record Receipt(String requestHash, String responseJson) {}

    public void lock(String idempotencyKey) {
        AdvisoryLock.acquireHashText(jdbc, idempotencyKey);
    }

    public Optional<Receipt> find(String idempotencyKey) {
        return jdbc.query(
                PlatformCommandReceiptServiceSql.FIND,
                statement -> statement.setString(1, idempotencyKey),
                result -> result.next()
                        ? Optional.of(new Receipt(result.getString(1), result.getString(2)))
                        : Optional.empty());
    }

    public int upgradeLegacyResponse(String responseJson, String idempotencyKey) {
        return jdbc.update(PlatformCommandReceiptServiceSql.UPGRADE_LEGACY_RESPONSE, responseJson, idempotencyKey);
    }

    public int insert(String idempotencyKey, String requestHash, String responseJson, long createdAt) {
        return jdbc.update(
                PlatformCommandReceiptServiceSql.INSERT,
                idempotencyKey,
                requestHash,
                responseJson,
                createdAt);
    }
}
