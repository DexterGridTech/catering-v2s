package com.catering.v2s.catalog.application;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;

/** Owner-local unit-definition aggregate. A list deliberately reads one extra row: 100 is an error, never page two. */
final class CatalogUnitDefinitionFacts {
    static final int MAX_UNITS = 99;
    private final JdbcTemplate jdbc;

    CatalogUnitDefinitionFacts(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    List<CatalogOwnerApi.UnitDefinitionReadback> list(
            String scope,
            String brand,
            boolean includeInactive,
            CatalogOwnerApi.UnitDimension dimension,
            String query,
            String status) {
        String normalizedQuery = query == null ? "" : query.trim();
        if (status != null && !"ENABLED".equals(status) && !"DISABLED".equals(status))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "单位状态筛选不合法");
        StringBuilder sql = new StringBuilder(
                "SELECT unit_ref,code,name,dimension,precision,status,version FROM catalog.unit_definition "
                        + "WHERE data_node_ref=? AND brand_ref=? ");
        List<Object> arguments = new java.util.ArrayList<>(List.of(scope, brand));
        if (status != null) {
            sql.append("AND status=? ");
            arguments.add(status);
        } else if (!includeInactive) {
            sql.append("AND status='ENABLED' ");
        }
        if (dimension != null) {
            sql.append("AND dimension=? ");
            arguments.add(dimension.name());
        }
        if (!normalizedQuery.isBlank()) {
            sql.append("AND (code || chr(1) || name) ILIKE '%' || ? || '%' ");
            arguments.add(normalizedQuery);
        }
        sql.append("ORDER BY name,code,unit_ref LIMIT 100");
        List<UnitRow> rows = jdbc.query(sql.toString(), (result, row) -> row(result), arguments.toArray());
        if (rows.size() == 100)
            throw new CatalogOwnerApi.Problem(
                    "CATALOG_UNIT_LIMIT_EXCEEDED",
                    422,
                    /* format-wrap */
                    "计量单位数量超过可维护范围，请先整理单位库");
        return rows.stream().map(this::readback).toList();
    }

    CatalogOwnerApi.UnitDefinitionReadback create(
            String scope, String brand, CatalogOwnerApi.UnitDefinitionCreateCommand command, long now) {
        validate(command.code(), command.name(), command.unitDimension(), command.precision());
        // The limit is an invariant, not merely a UI/list guard.  One scope lock serializes the count-and-insert.
        AdvisoryLock.acquire(jdbc, "catalog-unit-definition", scope, brand);
        long existing = jdbc.queryForObject(
                "SELECT count(*) FROM catalog.unit_definition WHERE data_node_ref=? AND brand_ref=?",
                Long.class,
                scope,
                brand);
        if (existing >= MAX_UNITS)
            throw new CatalogOwnerApi.Problem(
                    "CATALOG_UNIT_LIMIT_EXCEEDED",
                    422,
                    /* format-wrap */
                    "计量单位数量超过可维护范围，请先整理单位库");
        UUID ref = UUID.randomUUID();
        try {
            jdbc.update(
                    "INSERT INTO catalog.unit_definition(unit_ref,data_node_ref,brand_ref,code,name,dimension,preci"
                            + "sion,status,version,created_at_epoch_millis,updated_at_epoch_millis) "
                            + "VALUES(?,?,?,?,?,?,?,'ENABLED',1,?,?)",
                    ref,
                    scope,
                    brand,
                    command.code(),
                    command.name(),
                    command.unitDimension().name(),
                    command.precision(),
                    now,
                    now);
        } catch (DuplicateKeyException failure) {
            throw new CatalogOwnerApi.Problem("DUPLICATE_CODE", 409, "单位编码已存在", failure);
        }
        return readback(require(scope, brand, ref));
    }

    CatalogOwnerApi.UnitDefinitionReadback update(
            String scope, String brand, CatalogOwnerApi.UnitDefinitionUpdateCommand command, long now) {
        lock(command.unitRef());
        UnitRow current = require(scope, brand, command.unitRef());
        String code = command.code() == null ? current.code() : command.code();
        CatalogOwnerApi.UnitDimension dimension =
                command.unitDimension() == null ? current.dimension() : command.unitDimension();
        int precision = command.precision() == null ? current.precision() : command.precision();
        validate(code, command.name(), dimension, precision);
        if (isReferenced(current.ref())
                && (!current.code().equals(code)
                        || current.dimension() != dimension
                        || current.precision() != precision))
            throw new CatalogOwnerApi.Problem(
                    "CATALOG_UNIT_IN_USE",
                    409,
                    /* format-wrap */
                    "该单位已被使用；如需改变此项，请新建计量单位后在后续配置中选择");
        int changed;
        try {
            changed = jdbc.update(
                    "UPDATE catalog.unit_definition SET code=?,name=?,dimension=?,precision=?,version=version+1,upd"
                            + "ated_at_epoch_millis=? "
                            + "WHERE unit_ref=? AND version=?",
                    code,
                    command.name(),
                    dimension.name(),
                    precision,
                    now,
                    current.ref(),
                    command.expectedVersion());
        } catch (DuplicateKeyException failure) {
            throw new CatalogOwnerApi.Problem("DUPLICATE_CODE", 409, "单位编码已存在", failure);
        }
        if (changed != 1) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "单位定义版本已变化");
        return readback(require(scope, brand, current.ref()));
    }

    CatalogOwnerApi.UnitDefinitionReadback disable(
            String scope, String brand, UUID unitRef, long expectedVersion, long now) {
        lock(unitRef);
        UnitRow current = require(scope, brand, unitRef);
        if (current.version() != expectedVersion)
            throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "单位定义版本已变化");
        if (jdbc.update(
                        "UPDATE catalog.unit_definition SET status='DISABLED',version=version+1,updated_at_epoch_mi"
                                + "llis=? "
                                + "WHERE unit_ref=? AND version=? AND status='ENABLED'",
                        now,
                        unitRef,
                        expectedVersion)
                != 1) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "单位定义版本已变化");
        return readback(require(scope, brand, unitRef));
    }

    void delete(String scope, String brand, UUID unitRef, long expectedVersion) {
        lock(unitRef);
        UnitRow current = require(scope, brand, unitRef);
        if (current.version() != expectedVersion)
            throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "单位定义版本已变化");
        if (isReferenced(unitRef))
            throw new CatalogOwnerApi.Problem(
                    "CATALOG_UNIT_IN_USE",
                    409,
                    /* format-wrap */
                    "该计量单位正在使用，不能删除。");
        if (jdbc.update("DELETE FROM catalog.unit_definition WHERE unit_ref=? AND version=?", unitRef, expectedVersion)
                != 1) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "单位定义版本已变化");
    }

    boolean definitionShapeChanges(CatalogOwnerApi.UnitDefinitionUpdateCommand command) {
        UnitRow current = requireForChange(command.unitRef());
        return command.code() != null && !current.code().equals(command.code())
                || command.unitDimension() != null && current.dimension() != command.unitDimension()
                || command.precision() != null && current.precision() != command.precision();
    }

    CatalogOwnerApi.UnitDefinitionReadback requireActive(String scope, String brand, UUID ref) {
        lock(ref);
        UnitRow row = require(scope, brand, ref);
        if (!"ENABLED".equals(row.status()))
            throw new CatalogOwnerApi.Problem(
                    "UNIT_NOT_ACTIVE",
                    422,
                    /* format-wrap */
                    "基础计量单位必须是启用状态");
        return readback(row);
    }

    /**
     * Resolves the complete active unit set under deterministic locks. Save validation must not turn one unit
     * assignment into one round trip per SKU; the returned map is the same owner fact that the write consumes.
     */
    Map<UUID, CatalogOwnerApi.UnitDefinitionReadback> requireActiveAll(
            String scope, String brand, Collection<UUID> refs) {
        return requireAll(scope, brand, refs, true);
    }

    /** Read an existing binding without treating a disabled definition as a missing fact. */
    CatalogOwnerApi.UnitDefinitionReadback requireInScope(String scope, String brand, UUID ref) {
        lock(ref);
        return readback(require(scope, brand, ref));
    }

    /** Resolves copied unit definitions in one scoped read after the batch insert. */
    Map<UUID, CatalogOwnerApi.UnitDefinitionReadback> requireInScopeAll(
            String scope, String brand, Collection<UUID> refs) {
        return requireAll(scope, brand, refs, false);
    }

    private Map<UUID, CatalogOwnerApi.UnitDefinitionReadback> requireAll(
            String scope, String brand, Collection<UUID> refs, boolean activeOnly) {
        List<UUID> ordered = refs == null
                ? List.of()
                : refs.stream().filter(Objects::nonNull).distinct().sorted().toList();
        if (ordered.isEmpty()) return Map.of();
        String placeholders = String.join(",", java.util.Collections.nCopies(ordered.size(), "?"));
        String lockValues = String.join(",", java.util.Collections.nCopies(ordered.size(), "(?,?)"));
        List<Object> args = new ArrayList<>();
        for (UUID ref : ordered) {
            args.add(0x554E4954 ^ (int) (ref.getMostSignificantBits() >>> 32));
            args.add((int) ref.getLeastSignificantBits());
        }
        args.add(scope);
        args.add(brand);
        args.addAll(ordered);
        args.add(ordered.size());
        List<UnitRow> rows = jdbc.query(
                "WITH unit_locks AS MATERIALIZED (SELECT pg_advisory_xact_lock(lock_key_one,lock_key_two) "
                        + "FROM (VALUES "
                        + lockValues
                        + ") AS requested_locks(lock_key_one,lock_key_two)) "
                        + "SELECT unit_ref,code,name,dimension,precision,status,version FROM catalog.unit_definition "
                        + "WHERE data_node_ref=? AND brand_ref=? AND unit_ref IN ("
                        + placeholders
                        + ") AND (SELECT count(*) FROM unit_locks)=? FOR UPDATE",
                (result, row) -> row(result),
                args.toArray());
        Map<UUID, UnitRow> byRef = new LinkedHashMap<>();
        rows.forEach(row -> byRef.put(row.ref(), row));
        for (UUID ref : ordered) {
            UnitRow row = byRef.get(ref);
            if (row == null) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "单位定义不存在");
            if (activeOnly && !"ENABLED".equals(row.status()))
                throw new CatalogOwnerApi.Problem(
                        "UNIT_NOT_ACTIVE",
                        422,
                        /* format-wrap */
                        "基础计量单位必须是启用状态");
        }
        Map<UUID, CatalogOwnerApi.UnitDefinitionReadback> result = new LinkedHashMap<>();
        ordered.forEach(ref -> result.put(ref, readback(byRef.get(ref))));
        return Map.copyOf(result);
    }

    private void lock(UUID unitRef) {
        if (unitRef == null) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "unitRef is required");
        AdvisoryLock.acquire(jdbc, 0x554E4954, unitRef);
    }

    private UnitRow requireForChange(UUID ref) {
        List<UnitRow> rows = jdbc.query(
                "SELECT unit_ref,code,name,dimension,precision,status,version FROM catalog.unit_definition WHERE un"
                        + "it_ref=?",
                (result, row) -> row(result),
                ref);
        if (rows.isEmpty()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "单位定义不存在");
        return rows.getFirst();
    }

    private UnitRow require(String scope, String brand, UUID ref) {
        List<UnitRow> rows = jdbc.query(
                "SELECT unit_ref,code,name,dimension,precision,status,version FROM catalog.unit_definition "
                        + "WHERE data_node_ref=? AND brand_ref=? AND unit_ref=?",
                (result, row) -> row(result),
                scope,
                brand,
                ref);
        if (rows.isEmpty()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "单位定义不存在");
        return rows.getFirst();
    }

    boolean isReferenced(UUID ref) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM catalog.catalog_item WHERE sales_unit_ref=? OR base_measure_unit_ref=?) "
                        + "OR EXISTS (SELECT 1 FROM catalog.catalog_sku WHERE sales_unit_override_ref=? OR base_mea"
                        + "sure_unit_override_ref=?) "
                        + "OR EXISTS (SELECT 1 FROM catalog.catalog_order_option_definition_material WHERE consumpt"
                        + "ion_unit_ref=?)",
                Boolean.class,
                ref,
                ref,
                ref,
                ref,
                ref));
    }

    Set<UUID> referencedRefs(Collection<UUID> refs) {
        List<UUID> ordered = refs == null
                ? List.of()
                : new ArrayList<>(new LinkedHashSet<>(
                        refs.stream().filter(Objects::nonNull).toList()));
        if (ordered.isEmpty()) return Set.of();
        String placeholders = String.join(",", java.util.Collections.nCopies(ordered.size(), "?"));
        List<Object> arguments = new ArrayList<>();
        arguments.addAll(ordered);
        arguments.addAll(ordered);
        arguments.addAll(ordered);
        arguments.addAll(ordered);
        arguments.addAll(ordered);
        return Set.copyOf(jdbc.query(
                "SELECT ref FROM ("
                        + "SELECT sales_unit_ref AS ref FROM catalog.catalog_item WHERE sales_unit_ref IN ("
                        + placeholders + ") UNION SELECT base_measure_unit_ref FROM catalog.catalog_item WHERE "
                        + "base_measure_unit_ref IN (" + placeholders + ") UNION SELECT sales_unit_override_ref FROM "
                        + "catalog.catalog_sku WHERE sales_unit_override_ref IN (" + placeholders
                        + ") UNION SELECT base_measure_unit_override_ref FROM catalog.catalog_sku WHERE "
                        + "base_measure_unit_override_ref IN (" + placeholders
                        + ") UNION SELECT consumption_unit_ref FROM catalog.catalog_order_option_definition_material "
                        + "WHERE consumption_unit_ref IN (" + placeholders + ")) referenced WHERE ref IS NOT NULL",
                statement -> {
                    for (int index = 0; index < arguments.size(); index++)
                        statement.setObject(index + 1, arguments.get(index));
                },
                (result, rowNumber) -> result.getObject(1, UUID.class)));
    }

    private CatalogOwnerApi.UnitDefinitionReadback readback(UnitRow row) {
        return new CatalogOwnerApi.UnitDefinitionReadback(
                row.ref(), row.code(), row.name(), row.dimension(), row.precision(), row.status(), row.version());
    }

    private static UnitRow row(java.sql.ResultSet result) throws java.sql.SQLException {
        return new UnitRow(
                result.getObject(1, UUID.class),
                result.getString(2),
                result.getString(3),
                CatalogOwnerApi.UnitDimension.valueOf(result.getString(4)),
                result.getInt(5),
                result.getString(6),
                result.getLong(7));
    }

    private static void validate(String code, String name, CatalogOwnerApi.UnitDimension dimension, int precision) {
        if (code == null || code.isBlank() || name == null || name.isBlank() || dimension == null || precision < 0)
            throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR",
                    422,
                    /* format-wrap */
                    "单位编码、名称、类别和精度必须有效");
    }

    private record UnitRow(
            UUID ref,
            String code,
            String name,
            CatalogOwnerApi.UnitDimension dimension,
            int precision,
            String status,
            long version) {}
}
