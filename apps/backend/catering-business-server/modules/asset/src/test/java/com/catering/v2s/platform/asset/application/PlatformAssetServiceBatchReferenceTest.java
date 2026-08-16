package com.catering.v2s.platform.asset.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;

import java.io.InputStream;
import java.lang.reflect.Proxy;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;

/** Proves that one page-sized distinct logo set uses one owner metadata query without Docker. */
class PlatformAssetServiceBatchReferenceTest {
    @Test
    void distinctReferencesUseOneBoundedMetadataQuery() {
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        AtomicInteger queryCount = new AtomicInteger();
        AtomicInteger row = new AtomicInteger(-1);
        List<UUID> bound = new ArrayList<>();
        PreparedStatement statement = preparedStatement(bound);
        ResultSet result = resultSet(first, second, row);
        JdbcTemplate jdbc = new JdbcTemplate() {
            @Override
            public <T> T query(
                    String sql,
                    org.springframework.jdbc.core.PreparedStatementSetter setter,
                    org.springframework.jdbc.core.ResultSetExtractor<T> extractor) {
                queryCount.incrementAndGet();
                assertEquals(
                        "SELECT asset_ref, object_key, content_type, sha256 FROM platform_asset.staged_asset WHERE "
                                + "status='ACTIVE' AND asset_ref IN (?,?)",
                        sql);
                try {
                    setter.setValues(statement);
                    return extractor.extractData(result);
                } catch (java.sql.SQLException failure) {
                    throw new AssertionError(failure);
                }
            }
        };
        // This is a read-only query-shape test with a JdbcTemplate stub. Supply an explicit
        // transaction manager rather than relying on a nonexistent DataSource in the stub.
        PlatformAssetService assets =
                new PlatformAssetService(jdbc, () -> 1L, new MemoryObjects(), mock(PlatformTransactionManager.class));

        var references = assets.requireActivePublicReferences(List.of(first, second, first));

        assertEquals(1, queryCount.get());
        assertEquals(List.of(first, second), bound);
        assertEquals(2, references.size());
        assertEquals("https://assets.test/first", references.get(first).publicUrl());
        assertEquals("https://assets.test/second", references.get(second).publicUrl());
    }

    private static PreparedStatement preparedStatement(List<UUID> bound) {
        return (PreparedStatement) Proxy.newProxyInstance(
                PlatformAssetServiceBatchReferenceTest.class.getClassLoader(),
                new Class<?>[] {PreparedStatement.class},
                (proxy, method, arguments) -> {
                    if ("setObject".equals(method.getName())
                            && arguments.length == 2
                            && arguments[0] instanceof Integer) {
                        bound.add((UUID) arguments[1]);
                        return null;
                    }
                    return defaultValue(method.getReturnType());
                });
    }

    private static ResultSet resultSet(UUID first, UUID second, AtomicInteger row) {
        return (ResultSet) Proxy.newProxyInstance(
                PlatformAssetServiceBatchReferenceTest.class.getClassLoader(),
                new Class<?>[] {ResultSet.class},
                (proxy, method, arguments) -> {
                    if ("next".equals(method.getName())) return row.incrementAndGet() < 2;
                    if ("getObject".equals(method.getName())
                            && arguments.length == 2
                            && "asset_ref".equals(arguments[0])) return row.get() == 0 ? first : second;
                    if ("getString".equals(method.getName()) && "object_key".equals(arguments[0]))
                        return row.get() == 0 ? "objects/first" : "objects/second";
                    if ("getString".equals(method.getName()) && "content_type".equals(arguments[0])) return "image/png";
                    if ("getString".equals(method.getName()) && "sha256".equals(arguments[0]))
                        return row.get() == 0 ? "first" : "second";
                    return defaultValue(method.getReturnType());
                });
    }

    private static Object defaultValue(Class<?> type) {
        if (!type.isPrimitive()) return null;
        if (type == boolean.class) return false;
        if (type == byte.class) return (byte) 0;
        if (type == short.class) return (short) 0;
        if (type == int.class) return 0;
        if (type == long.class) return 0L;
        if (type == float.class) return 0F;
        if (type == double.class) return 0D;
        if (type == char.class) return '\0';
        throw new IllegalArgumentException("unsupported primitive");
    }

    private static final class MemoryObjects implements AssetObjectStorage {
        @Override
        public String bucketName() {
            return "assets";
        }

        @Override
        public String objectKey(String suffix) {
            return suffix;
        }

        @Override
        public boolean ownsObjectKey(String key) {
            return true;
        }

        @Override
        public void put(String key, String contentType, long size, InputStream bytes) {
            throw new UnsupportedOperationException();
        }

        @Override
        public boolean exists(String key) {
            return "objects/first".equals(key) || "objects/second".equals(key);
        }

        @Override
        public String publicUrl(String key) {
            return "https://assets.test/" + key.substring("objects/".length());
        }

        @Override
        public void delete(String key) {
            throw new UnsupportedOperationException();
        }
    }
}
