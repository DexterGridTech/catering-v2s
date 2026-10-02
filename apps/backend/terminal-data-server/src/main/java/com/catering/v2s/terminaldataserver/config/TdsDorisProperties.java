package com.catering.v2s.terminaldataserver.config;

import java.net.URI;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Required private endpoint and table-scoped credentials for the TDS history sink. */
@ConfigurationProperties("v2s.tds.doris")
public record TdsDorisProperties(String endpoint, String database, String table, String username, String password) {
    public TdsDorisProperties {
        if (endpoint == null || endpoint.isBlank()) throw new IllegalArgumentException("TDS_DORIS_ENDPOINT_REQUIRED");
        URI uri;
        try {
            uri = URI.create(endpoint);
        } catch (IllegalArgumentException invalid) {
            throw new IllegalArgumentException("TDS_DORIS_ENDPOINT_INVALID", invalid);
        }
        if (!"http".equalsIgnoreCase(uri.getScheme())
                || uri.getHost() == null
                || uri.getUserInfo() != null
                || uri.getQuery() != null
                || uri.getFragment() != null
                || (uri.getPath() != null && !uri.getPath().isEmpty())) {
            throw new IllegalArgumentException("TDS_DORIS_ENDPOINT_INVALID");
        }
        requireIdentifier(database, "TDS_DORIS_DATABASE_INVALID");
        requireIdentifier(table, "TDS_DORIS_TABLE_INVALID");
        if (username == null || username.isBlank() || password == null || password.isEmpty()) {
            throw new IllegalArgumentException("TDS_DORIS_CREDENTIALS_REQUIRED");
        }
    }

    @Override
    public String toString() {
        return "TdsDorisProperties[endpoint=" + endpoint + ", database=" + database + ", table=" + table
                + ", username=<redacted>, password=<redacted>]";
    }

    private static void requireIdentifier(String value, String code) {
        if (value == null || !value.matches("[A-Za-z_][A-Za-z0-9_]{0,63}")) {
            throw new IllegalArgumentException(code);
        }
    }
}
