// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = OrganizationStoreOperatingRuleValues.Deserializer.class)
public record OrganizationStoreOperatingRuleValues(
    Boolean catalogManagementEnabled,
    Boolean externalCatalogSyncEnabled,
    String openPlatformDeveloperCode,
    Boolean reservationEnabled,
    Boolean reservationDepositEnabled,
    Boolean queueCallEnabled,
    Boolean tableManagementEnabled,
    Boolean tableStatusEnabled,
    Boolean tableWaitCallEnabled,
    Boolean banquetOrderEnabled,
    Boolean pickupCallEnabled,
    Boolean receivableEnabled
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<OrganizationStoreOperatingRuleValues> {
    @Override
    public OrganizationStoreOperatingRuleValues deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (OrganizationStoreOperatingRuleValues) context.handleUnexpectedToken(OrganizationStoreOperatingRuleValues.class, parser);
      Boolean catalogManagementEnabled = null;
      Boolean externalCatalogSyncEnabled = null;
      String openPlatformDeveloperCode = null;
      Boolean reservationEnabled = null;
      Boolean reservationDepositEnabled = null;
      Boolean queueCallEnabled = null;
      Boolean tableManagementEnabled = null;
      Boolean tableStatusEnabled = null;
      Boolean tableWaitCallEnabled = null;
      Boolean banquetOrderEnabled = null;
      Boolean pickupCallEnabled = null;
      Boolean receivableEnabled = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(OrganizationStoreOperatingRuleValues.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(OrganizationStoreOperatingRuleValues.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(OrganizationStoreOperatingRuleValues.class, "property value is required");
        switch (property) {
          case "catalogManagementEnabled" -> {
            if (parser.currentToken() != tools.jackson.core.JsonToken.VALUE_TRUE && parser.currentToken() != tools.jackson.core.JsonToken.VALUE_FALSE) return context.reportInputMismatch(OrganizationStoreOperatingRuleValues.class, "property catalogManagementEnabled must be boolean");
            catalogManagementEnabled = parser.getBooleanValue();
          }
          case "externalCatalogSyncEnabled" -> {
            if (parser.currentToken() != tools.jackson.core.JsonToken.VALUE_TRUE && parser.currentToken() != tools.jackson.core.JsonToken.VALUE_FALSE) return context.reportInputMismatch(OrganizationStoreOperatingRuleValues.class, "property externalCatalogSyncEnabled must be boolean");
            externalCatalogSyncEnabled = parser.getBooleanValue();
          }
          case "openPlatformDeveloperCode" -> {
            if (parser.currentToken() != tools.jackson.core.JsonToken.VALUE_STRING) return context.reportInputMismatch(OrganizationStoreOperatingRuleValues.class, "property openPlatformDeveloperCode must be string");
            openPlatformDeveloperCode = parser.getString();
          }
          case "reservationEnabled" -> {
            if (parser.currentToken() != tools.jackson.core.JsonToken.VALUE_TRUE && parser.currentToken() != tools.jackson.core.JsonToken.VALUE_FALSE) return context.reportInputMismatch(OrganizationStoreOperatingRuleValues.class, "property reservationEnabled must be boolean");
            reservationEnabled = parser.getBooleanValue();
          }
          case "reservationDepositEnabled" -> {
            if (parser.currentToken() != tools.jackson.core.JsonToken.VALUE_TRUE && parser.currentToken() != tools.jackson.core.JsonToken.VALUE_FALSE) return context.reportInputMismatch(OrganizationStoreOperatingRuleValues.class, "property reservationDepositEnabled must be boolean");
            reservationDepositEnabled = parser.getBooleanValue();
          }
          case "queueCallEnabled" -> {
            if (parser.currentToken() != tools.jackson.core.JsonToken.VALUE_TRUE && parser.currentToken() != tools.jackson.core.JsonToken.VALUE_FALSE) return context.reportInputMismatch(OrganizationStoreOperatingRuleValues.class, "property queueCallEnabled must be boolean");
            queueCallEnabled = parser.getBooleanValue();
          }
          case "tableManagementEnabled" -> {
            if (parser.currentToken() != tools.jackson.core.JsonToken.VALUE_TRUE && parser.currentToken() != tools.jackson.core.JsonToken.VALUE_FALSE) return context.reportInputMismatch(OrganizationStoreOperatingRuleValues.class, "property tableManagementEnabled must be boolean");
            tableManagementEnabled = parser.getBooleanValue();
          }
          case "tableStatusEnabled" -> {
            if (parser.currentToken() != tools.jackson.core.JsonToken.VALUE_TRUE && parser.currentToken() != tools.jackson.core.JsonToken.VALUE_FALSE) return context.reportInputMismatch(OrganizationStoreOperatingRuleValues.class, "property tableStatusEnabled must be boolean");
            tableStatusEnabled = parser.getBooleanValue();
          }
          case "tableWaitCallEnabled" -> {
            if (parser.currentToken() != tools.jackson.core.JsonToken.VALUE_TRUE && parser.currentToken() != tools.jackson.core.JsonToken.VALUE_FALSE) return context.reportInputMismatch(OrganizationStoreOperatingRuleValues.class, "property tableWaitCallEnabled must be boolean");
            tableWaitCallEnabled = parser.getBooleanValue();
          }
          case "banquetOrderEnabled" -> {
            if (parser.currentToken() != tools.jackson.core.JsonToken.VALUE_TRUE && parser.currentToken() != tools.jackson.core.JsonToken.VALUE_FALSE) return context.reportInputMismatch(OrganizationStoreOperatingRuleValues.class, "property banquetOrderEnabled must be boolean");
            banquetOrderEnabled = parser.getBooleanValue();
          }
          case "pickupCallEnabled" -> {
            if (parser.currentToken() != tools.jackson.core.JsonToken.VALUE_TRUE && parser.currentToken() != tools.jackson.core.JsonToken.VALUE_FALSE) return context.reportInputMismatch(OrganizationStoreOperatingRuleValues.class, "property pickupCallEnabled must be boolean");
            pickupCallEnabled = parser.getBooleanValue();
          }
          case "receivableEnabled" -> {
            if (parser.currentToken() != tools.jackson.core.JsonToken.VALUE_TRUE && parser.currentToken() != tools.jackson.core.JsonToken.VALUE_FALSE) return context.reportInputMismatch(OrganizationStoreOperatingRuleValues.class, "property receivableEnabled must be boolean");
            receivableEnabled = parser.getBooleanValue();
          }
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(OrganizationStoreOperatingRuleValues.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(OrganizationStoreOperatingRuleValues.class, "object must end with END_OBJECT");
      if (catalogManagementEnabled == null) return context.reportInputMismatch(OrganizationStoreOperatingRuleValues.class, "missing required property catalogManagementEnabled");
      if (externalCatalogSyncEnabled == null) return context.reportInputMismatch(OrganizationStoreOperatingRuleValues.class, "missing required property externalCatalogSyncEnabled");
      if (openPlatformDeveloperCode == null) return context.reportInputMismatch(OrganizationStoreOperatingRuleValues.class, "missing required property openPlatformDeveloperCode");
      if (reservationEnabled == null) return context.reportInputMismatch(OrganizationStoreOperatingRuleValues.class, "missing required property reservationEnabled");
      if (reservationDepositEnabled == null) return context.reportInputMismatch(OrganizationStoreOperatingRuleValues.class, "missing required property reservationDepositEnabled");
      if (queueCallEnabled == null) return context.reportInputMismatch(OrganizationStoreOperatingRuleValues.class, "missing required property queueCallEnabled");
      if (tableManagementEnabled == null) return context.reportInputMismatch(OrganizationStoreOperatingRuleValues.class, "missing required property tableManagementEnabled");
      if (tableStatusEnabled == null) return context.reportInputMismatch(OrganizationStoreOperatingRuleValues.class, "missing required property tableStatusEnabled");
      if (tableWaitCallEnabled == null) return context.reportInputMismatch(OrganizationStoreOperatingRuleValues.class, "missing required property tableWaitCallEnabled");
      if (banquetOrderEnabled == null) return context.reportInputMismatch(OrganizationStoreOperatingRuleValues.class, "missing required property banquetOrderEnabled");
      if (pickupCallEnabled == null) return context.reportInputMismatch(OrganizationStoreOperatingRuleValues.class, "missing required property pickupCallEnabled");
      if (receivableEnabled == null) return context.reportInputMismatch(OrganizationStoreOperatingRuleValues.class, "missing required property receivableEnabled");
      return new OrganizationStoreOperatingRuleValues(catalogManagementEnabled, externalCatalogSyncEnabled, openPlatformDeveloperCode, reservationEnabled, reservationDepositEnabled, queueCallEnabled, tableManagementEnabled, tableStatusEnabled, tableWaitCallEnabled, banquetOrderEnabled, pickupCallEnabled, receivableEnabled);
    }
  }
}
