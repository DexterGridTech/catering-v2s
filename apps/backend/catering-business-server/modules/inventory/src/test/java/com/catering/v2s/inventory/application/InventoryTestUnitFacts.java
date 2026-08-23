package com.catering.v2s.inventory.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;

/** Shared test fixture for the immutable unit facts required by inventory targets and BOM rows. */
final class InventoryTestUnitFacts {
    static final UUID CONSUMPTION_UNIT_REF = UUID.fromString("00000000-0000-0000-0000-000000000001");
    static final String CONSUMPTION_UNIT_CODE = "PORTION";
    static final String CONSUMPTION_UNIT_NAME = "份";
    static final String CONSUMPTION_UNIT_DIMENSION = "COUNT";
    static final int CONSUMPTION_UNIT_PRECISION = 0;

    private InventoryTestUnitFacts() {}

    static ObjectNode consumptionUnitSnapshot(ObjectMapper mapper) {
        return mapper.createObjectNode()
                .put("unitRef", CONSUMPTION_UNIT_REF.toString())
                .put("code", CONSUMPTION_UNIT_CODE)
                .put("name", CONSUMPTION_UNIT_NAME)
                .put("unitDimension", CONSUMPTION_UNIT_DIMENSION)
                .put("precision", CONSUMPTION_UNIT_PRECISION);
    }

    static void insertDirectTarget(
            JdbcTemplate jdbc,
            UUID targetRef,
            UUID scope,
            String brand,
            UUID itemRef,
            UUID productSkuRef,
            String itemCode,
            String skuCode,
            BigDecimal balance,
            long version) {
        jdbc.update(
                "INSERT INTO inventory.stock_target("
                        + "target_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,item_code,sku_code,"
                        + "measure_mode,inventory_mode,configuration,balance,version,created_at_epoch_millis,"
                        + "updated_at_epoch_millis,consumption_unit_ref,consumption_unit_code,consumption_unit_name,"
                        + "consumption_unit_dimension,consumption_unit_precision) "
                        + "VALUES(?,?,?,?,?,?,?,'COUNTED','DIRECT',CAST(? AS JSONB),?,?,1,1,?,?,?,?,?)",
                targetRef,
                scope.toString(),
                brand,
                itemRef,
                productSkuRef,
                itemCode,
                skuCode,
                "{\"mode\":\"DIRECT\",\"allowNegative\":false,\"conversionFactor\":1}",
                balance,
                version,
                CONSUMPTION_UNIT_REF,
                CONSUMPTION_UNIT_CODE,
                CONSUMPTION_UNIT_NAME,
                CONSUMPTION_UNIT_DIMENSION,
                CONSUMPTION_UNIT_PRECISION);
    }

    static String consumptionUnitSnapshotJson() {
        return "{\"unitRef\":\""
                + CONSUMPTION_UNIT_REF
                + "\",\"code\":\""
                + CONSUMPTION_UNIT_CODE
                + "\",\"name\":\""
                + CONSUMPTION_UNIT_NAME
                + "\",\"unitDimension\":\""
                + CONSUMPTION_UNIT_DIMENSION
                + "\",\"precision\":"
                + CONSUMPTION_UNIT_PRECISION
                + "}";
    }
}
