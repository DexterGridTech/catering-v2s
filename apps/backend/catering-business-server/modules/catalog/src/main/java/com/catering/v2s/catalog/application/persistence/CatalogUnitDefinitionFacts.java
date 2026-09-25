package com.catering.v2s.catalog.application.persistence;

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
public class CatalogUnitDefinitionFacts {
    static final int MAX_UNITS = 99;
    private final JdbcTemplate jdbc;

    public CatalogUnitDefinitionFacts(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<CatalogOwnerApi.UnitDefinitionReadback> list(
            String scope,
            String brand,
            boolean includeInactive,
            CatalogOwnerApi.UnitDimension dimension,
            String query,
            String status) {
        String normalizedQuery = query == null ? "" : query.trim();
        if (status != null && !Set.of("ENABLED", "DISABLED", "VOIDED").contains(status))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "单位状态筛选不合法");
        StringBuilder sql = new StringBuilder(
                CatalogUnitDefinitionFactsSql
                                .CATALOG_UNIT_DEFINITION_FACTS_SELECT_UNIT_DEFINITION_UNIT_REF_CODE_NAME_DIMENSION
                        + CatalogUnitDefinitionFactsSql.CATALOG_UNIT_DEFINITION_FACTS_WHERE_DATA_NODE_REF_BRAND_REF);
        List<Object> arguments = new java.util.ArrayList<>(List.of(scope, brand));
        if (status != null) {
            sql.append(CatalogUnitDefinitionFactsSql.CATALOG_UNIT_DEFINITION_FACTS_CONDITION_STATUS);
            arguments.add(status);
        } else if (!includeInactive) {
            sql.append(CatalogUnitDefinitionFactsSql.CATALOG_UNIT_DEFINITION_FACTS_CONDITION_STATUS_ENABLED);
        }
        if (dimension != null) {
            sql.append(CatalogUnitDefinitionFactsSql.CATALOG_UNIT_DEFINITION_FACTS_CONDITION_DIMENSION);
            arguments.add(dimension.name());
        }
        if (!normalizedQuery.isBlank()) {
            sql.append(CatalogUnitDefinitionFactsSql.CATALOG_UNIT_DEFINITION_FACTS_CONDITION_CODE_CHR_NAME_ILIKE);
            arguments.add(normalizedQuery);
        }
        sql.append(CatalogUnitDefinitionFactsSql.CATALOG_UNIT_DEFINITION_FACTS_ORDER_BY_NAME_CODE_UNIT_REF);
        List<UnitRow> rows = jdbc.query(sql.toString(), (result, row) -> row(result), arguments.toArray());
        if (rows.size() == 100)
            throw new CatalogOwnerApi.Problem(
                    "CATALOG_UNIT_LIMIT_EXCEEDED",
                    422,
                    /* format-wrap */
                    "计量单位数量超过可维护范围，请先整理单位库");
        return rows.stream().map(this::readback).toList();
    }

    public CatalogOwnerApi.UnitDefinitionReadback create(
            String scope, String brand, CatalogOwnerApi.UnitDefinitionCreateCommand command, long now) {
        validate(command.code(), command.name(), command.unitDimension(), command.precision());
        // The limit is an invariant, not merely a UI/list guard.  One scope lock serializes the count-and-insert.
        AdvisoryLock.acquire(jdbc, "catalog-unit-definition", scope, brand);
        long existing = jdbc.queryForObject(
                CatalogUnitDefinitionFactsSql
                        .CATALOG_UNIT_DEFINITION_FACTS_SELECT_UNIT_DEFINITION_DATA_NODE_REF_BRAND_REF,
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
                    CatalogUnitDefinitionFactsSql
                                    .CATALOG_UNIT_DEFINITION_FACTS_INSERT_INTO_CATALOG_UNIT_DEFINITION_UNIT_REF_DATA_NODE_REF_BRAND_REF_CODE_NAME_DIMENSION_STATUS_VERSION_CREATED_AT_EPOCH_MILLIS_UPDATED_AT_EPOCH_MILLIS
                            + CatalogUnitDefinitionFactsSql.CATALOG_UNIT_DEFINITION_FACTS_VALUES_ENABLED,
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

    public CatalogOwnerApi.UnitDefinitionReadback update(
            String scope, String brand, CatalogOwnerApi.UnitDefinitionUpdateCommand command, long now) {
        lock(command.unitRef());
        UnitRow current = require(scope, brand, command.unitRef());
        if ("VOIDED".equals(current.status()))
            throw new CatalogOwnerApi.Problem("VOIDED_RECORD_IMMUTABLE", 409, "已作废的单位定义不可修改");
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
                    CatalogUnitDefinitionFactsSql
                                    .CATALOG_UNIT_DEFINITION_FACTS_UPDATE_CATALOG_UNIT_DEFINITION_SET_CODE_NAME_DIMENSION_PRECISION_VERSION_UPDATED_AT_EPOCH_MILLIS_DIMENSION_PRECISION_VERSION_UPDATED_AT_EPOCH_MILLIS
                            + CatalogUnitDefinitionFactsSql.CATALOG_UNIT_DEFINITION_FACTS_WHERE_UNIT_REF_VERSION,
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

    public CatalogOwnerApi.UnitDefinitionReadback transition(
            String scope, String brand, CatalogOwnerApi.UnitDefinitionStatusTransitionCommand command, long now) {
        lock(command.unitRef());
        UnitRow current = require(scope, brand, command.unitRef());
        if (!Set.of("ENABLED", "DISABLED", "VOIDED").contains(command.targetStatus()))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "单位状态不合法");
        if ("VOIDED".equals(current.status()))
            throw new CatalogOwnerApi.Problem("VOIDED_RECORD_IMMUTABLE", 409, "已作废的单位定义不可修改");
        if (current.version() != command.expectedVersion())
            throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "单位定义版本已变化");
        if ("VOIDED".equals(command.targetStatus()) && isReferenced(current.ref()))
            // spotless:off
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_BLOCKS_VOID", 422, "单位定义仍被商品或库存事实引用，不能作废");
            // spotless:on
        if (jdbc.update(
                        CatalogUnitDefinitionFactsSql
                                        .CATALOG_UNIT_DEFINITION_FACTS_UPDATE_UNIT_DEFINITION_STATUS_VERSION_UPDATED_AT_EPOCH_MILLIS
                                + CatalogUnitDefinitionFactsSql
                                        .CATALOG_UNIT_DEFINITION_FACTS_WHERE_UNIT_REF_VERSION_STATUS_VOIDED,
                        command.targetStatus(),
                        now,
                        current.ref(),
                        command.expectedVersion())
                != 1) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "单位定义版本已变化");
        return readback(require(scope, brand, current.ref()));
    }

    public boolean definitionShapeChanges(CatalogOwnerApi.UnitDefinitionUpdateCommand command) {
        UnitRow current = requireForChange(command.unitRef());
        return command.code() != null && !current.code().equals(command.code())
                || command.unitDimension() != null && current.dimension() != command.unitDimension()
                || command.precision() != null && current.precision() != command.precision();
    }

    public CatalogOwnerApi.UnitDefinitionReadback requireActive(String scope, String brand, UUID ref) {
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
    public Map<UUID, CatalogOwnerApi.UnitDefinitionReadback> requireActiveAll(
            String scope, String brand, Collection<UUID> refs) {
        return requireAll(scope, brand, refs, true);
    }

    /** Read an existing binding without treating a disabled definition as a missing fact. */
    public CatalogOwnerApi.UnitDefinitionReadback requireInScope(String scope, String brand, UUID ref) {
        lock(ref);
        return readback(require(scope, brand, ref));
    }

    /** Resolves copied unit definitions in one scoped read after the batch insert. */
    public Map<UUID, CatalogOwnerApi.UnitDefinitionReadback> requireInScopeAll(
            String scope, String brand, Collection<UUID> refs) {
        return requireAll(scope, brand, refs, false);
    }

    private Map<UUID, CatalogOwnerApi.UnitDefinitionReadback> requireAll(
            String scope, String brand, Collection<UUID> refs, boolean activeOnly) {
        List<UUID> ordered = refs == null
                ? List.of()
                : refs.stream().filter(Objects::nonNull).distinct().sorted().toList();
        if (ordered.isEmpty()) return Map.of();
        String placeholders = String.join(
                CatalogUnitDefinitionFactsSql.PLACEHOLDER_SEPARATOR,
                java.util.Collections.nCopies(ordered.size(), CatalogUnitDefinitionFactsSql.PARAMETER_PLACEHOLDER));
        String lockValues = String.join(
                CatalogUnitDefinitionFactsSql.PLACEHOLDER_SEPARATOR,
                java.util.Collections.nCopies(ordered.size(), CatalogUnitDefinitionFactsSql.LOCK_VALUE_TUPLE));
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
                CatalogUnitDefinitionFactsSql
                                .CATALOG_UNIT_DEFINITION_FACTS_CTE_UNIT_LOCKS_PG_ADVISORY_XACT_LOCK_LOCK_KEY_ONE_LOCK_KEY_TWO
                        + CatalogUnitDefinitionFactsSql.CATALOG_UNIT_DEFINITION_FACTS_FROM_CLAUSE_FROM_VALUES
                        + lockValues
                        + CatalogUnitDefinitionFactsSql
                                .CATALOG_UNIT_DEFINITION_FACTS_CLOSE_PAREN_REQUESTED_LOCKS_LOCK_KEY_ONE_LOCK_KEY_TWO
                        + CatalogUnitDefinitionFactsSql
                                .CATALOG_UNIT_DEFINITION_FACTS_SELECT_UNIT_DEFINITION_UNIT_REF_CODE_NAME_DIMENSION_ALTERNATE_A
                        + CatalogUnitDefinitionFactsSql
                                .CATALOG_UNIT_DEFINITION_FACTS_WHERE_DATA_NODE_REF_BRAND_REF_UNIT_REF
                        + placeholders
                        + CatalogUnitDefinitionFactsSql
                                .CATALOG_UNIT_DEFINITION_FACTS_CLOSE_PAREN_UNIT_LOCKS_AND_SELECT_COUNT_FROM_UNIT_L,
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
                CatalogUnitDefinitionFactsSql
                        .CATALOG_UNIT_DEFINITION_FACTS_SELECT_UNIT_REF_CODE_NAME_DIMENSION_PRECISION_STATUS_VERSION_FROM_CATALOG_UNIT_DEFINITION_WHERE_UNIT_REF,
                (result, row) -> row(result),
                ref);
        if (rows.isEmpty()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "单位定义不存在");
        return rows.getFirst();
    }

    private UnitRow require(String scope, String brand, UUID ref) {
        List<UnitRow> rows = jdbc.query(
                CatalogUnitDefinitionFactsSql
                                .CATALOG_UNIT_DEFINITION_FACTS_SELECT_UNIT_DEFINITION_UNIT_REF_CODE_NAME_DIMENSION_ALTERNATE_C
                        + CatalogUnitDefinitionFactsSql
                                .CATALOG_UNIT_DEFINITION_FACTS_WHERE_DATA_NODE_REF_BRAND_REF_UNIT_REF_ALTERNATE_A,
                (result, row) -> row(result),
                scope,
                brand,
                ref);
        if (rows.isEmpty()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "单位定义不存在");
        return rows.getFirst();
    }

    public boolean isReferenced(UUID ref) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                CatalogUnitDefinitionFactsSql
                                .CATALOG_UNIT_DEFINITION_FACTS_SELECT_CATALOG_ITEM_SALES_UNIT_REF_BASE_MEASURE_UNIT_REF
                        + CatalogUnitDefinitionFactsSql
                                .CATALOG_UNIT_DEFINITION_FACTS_OR_EXISTS_SELECT_FROM_CATALOG_CATALOG_SKU_WHERE_SALES_UNIT_OVERRIDE_REF_OR_BASE_MEASURE_UNIT_OVERRIDE_REF_WHERE_SALES_UNIT_OVERRIDE_REF_OR_BASE_MEASURE_UNIT_OVERRIDE_REF
                        + CatalogUnitDefinitionFactsSql
                                .CATALOG_UNIT_DEFINITION_FACTS_OR_EXISTS_SELECT_FROM_CATALOG_CATALOG_ORDER_OPTION_DEFINITION_MATERIAL_WHERE_CONSUMPTION_UNIT_REF_CATALOG_CATALOG_ORDER_OPTION_DEFINITION_MATERIAL_WHERE_CONSUMPTION_UNIT_REF,
                Boolean.class,
                ref,
                ref,
                ref,
                ref,
                ref));
    }

    public Set<UUID> referencedRefs(Collection<UUID> refs) {
        List<UUID> ordered = refs == null
                ? List.of()
                : new ArrayList<>(new LinkedHashSet<>(
                        refs.stream().filter(Objects::nonNull).toList()));
        if (ordered.isEmpty()) return Set.of();
        String placeholders = String.join(
                CatalogUnitDefinitionFactsSql.PLACEHOLDER_SEPARATOR,
                java.util.Collections.nCopies(ordered.size(), CatalogUnitDefinitionFactsSql.PARAMETER_PLACEHOLDER));
        List<Object> arguments = new ArrayList<>();
        arguments.addAll(ordered);
        arguments.addAll(ordered);
        arguments.addAll(ordered);
        arguments.addAll(ordered);
        arguments.addAll(ordered);
        return Set.copyOf(jdbc.query(
                CatalogUnitDefinitionFactsSql.CATALOG_UNIT_DEFINITION_FACTS_SELECT_REF
                        + CatalogUnitDefinitionFactsSql
                                .CATALOG_UNIT_DEFINITION_FACTS_SELECT_CATALOG_ITEM_SALES_UNIT_REF_REF
                        + placeholders
                        + CatalogUnitDefinitionFactsSql
                                .CATALOG_UNIT_DEFINITION_FACTS_CLOSE_PAREN_CATALOG_ITEM_BASE_MEASURE_UNIT_REF
                        + CatalogUnitDefinitionFactsSql.CATALOG_UNIT_DEFINITION_FACTS_BASE_MEASURE_UNIT_REF
                        + placeholders
                        + CatalogUnitDefinitionFactsSql
                                .CATALOG_UNIT_DEFINITION_FACTS_CLOSE_PAREN_SALES_UNIT_OVERRIDE_REF
                        + CatalogUnitDefinitionFactsSql
                                .CATALOG_UNIT_DEFINITION_FACTS_CATALOG_SKU_SALES_UNIT_OVERRIDE_REF
                        + placeholders
                        + CatalogUnitDefinitionFactsSql
                                .CATALOG_UNIT_DEFINITION_FACTS_CLOSE_PAREN_CATALOG_SKU_BASE_MEASURE_UNIT_OVERRIDE_REF
                        + CatalogUnitDefinitionFactsSql.CATALOG_UNIT_DEFINITION_FACTS_BASE_MEASURE_UNIT_OVERRIDE_REF
                        + placeholders
                        + CatalogUnitDefinitionFactsSql
                                .CATALOG_UNIT_DEFINITION_FACTS_CLOSE_PAREN_CATALOG_ORDER_OPTION_DEFINITION_MA_CONSUMPTION_UNIT_REF
                        + CatalogUnitDefinitionFactsSql.CATALOG_UNIT_DEFINITION_FACTS_WHERE_CONSUMPTION_UNIT_REF
                        + placeholders
                        + CatalogUnitDefinitionFactsSql.CATALOG_UNIT_DEFINITION_FACTS_CLOSE_PAREN_REFERENCED_REF,
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
