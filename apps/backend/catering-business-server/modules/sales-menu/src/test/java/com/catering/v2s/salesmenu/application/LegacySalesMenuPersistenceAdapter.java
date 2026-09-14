package com.catering.v2s.salesmenu.application;

import com.catering.v2s.salesmenu.application.persistence.SalesMenuPersistence;
import com.catering.v2s.salesmenu.domain.SalesMenuAggregate;
import com.catering.v2s.salesmenu.domain.SalesMenuTarget;
import com.catering.v2s.salesmenu.infrastructure.SalesMenuRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

/**
 * Test-only adapter for legacy SQL-mocking fixtures.
 *
 * <p>The production boundary remains {@link SalesMenuPersistence}; this adapter is deliberately confined to tests so
 * existing focused fixtures can migrate independently without reintroducing a production raw-SQL bean or constructor.
 */
final class LegacySalesMenuPersistenceAdapter extends SalesMenuPersistence {
    private final SalesMenuRepository repository;

    LegacySalesMenuPersistenceAdapter(SalesMenuRepository repository) {
        super((JdbcTemplate) null);
        this.repository = repository;
    }

    @Override
    public Optional<SalesMenuAggregate> find(SalesMenuTarget target) {
        return repository.find(target);
    }

    @Override
    public Optional<SalesMenuAggregate> findForUpdate(SalesMenuTarget target) {
        return repository.findForUpdate(target);
    }

    @Override
    public boolean compareAndSetVersion(SalesMenuTarget target, long expectedVersion) {
        return repository.compareAndSetVersion(target, expectedVersion);
    }

    @Override
    public void lockCommandReceipt(UUID workspaceUuid, String operationId, String idempotencyKey) {
        repository.lockCommandReceipt(workspaceUuid, operationId, idempotencyKey);
    }

    @Override
    protected <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... arguments) {
        return repository.query(sql, rowMapper, arguments);
    }

    @Override
    protected int update(String sql, Object... arguments) {
        return repository.update(sql, arguments);
    }
}
