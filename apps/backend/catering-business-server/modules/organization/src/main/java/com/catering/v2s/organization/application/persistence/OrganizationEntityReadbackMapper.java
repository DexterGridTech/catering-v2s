package com.catering.v2s.organization.application.persistence;

import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/** Result-set mapping shared by typed organization persistence boundaries. */
public final class OrganizationEntityReadbackMapper {
    private static final ObjectMapper JSON = new ObjectMapper();

    private OrganizationEntityReadbackMapper() {}

    public static OrganizationEntityReadback read(String type, ResultSet result) throws SQLException {
        return new OrganizationEntityReadback(
                result.getObject(1, UUID.class),
                type,
                result.getObject(2, UUID.class),
                result.getString(3),
                result.getString(4),
                result.getString(5),
                result.getString(6),
                result.getString(7),
                result.getString(11),
                result.getLong(12),
                result.getString(8),
                result.getString(9),
                result.getString(10),
                result.getLong(13),
                result.getLong(14),
                result.getLong(15),
                readExtensionObject(result.getString(16)));
    }

    public static Map<String, String> readExtensionObject(String source) throws SQLException {
        try {
            JsonNode node = JSON.readTree(source);
            if (!node.isObject()) throw new SQLException("organization extension values are not an object");
            Map<String, String> values = new LinkedHashMap<>();
            node.fields()
                    .forEachRemaining(
                            entry -> values.put(entry.getKey(), entry.getValue().toString()));
            return Map.copyOf(values);
        } catch (java.io.IOException failure) {
            throw new SQLException("organization extension values are invalid", failure);
        }
    }
}
