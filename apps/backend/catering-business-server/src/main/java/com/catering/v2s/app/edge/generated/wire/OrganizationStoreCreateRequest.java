// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = OrganizationStoreCreateRequest.Deserializer.class)
public record OrganizationStoreCreateRequest(
    String brandId,
    String tenantId,
    String headCompanyId,
    String code,
    String name,
    String notes,
    tools.jackson.databind.JsonNode extensionValues,
    OrganizationStoreOperatingRuleValues operatingRuleSwitches
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<OrganizationStoreCreateRequest> {
    @Override
    public OrganizationStoreCreateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (OrganizationStoreCreateRequest) context.handleUnexpectedToken(OrganizationStoreCreateRequest.class, parser);
      String brandId = null;
      String tenantId = null;
      String headCompanyId = null;
      String code = null;
      String name = null;
      String notes = null;
      tools.jackson.databind.JsonNode extensionValues = null;
      OrganizationStoreOperatingRuleValues operatingRuleSwitches = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(OrganizationStoreCreateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(OrganizationStoreCreateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(OrganizationStoreCreateRequest.class, "property value is required");
        switch (property) {
          case "brandId" -> brandId = context.readValue(parser, String.class);
          case "tenantId" -> tenantId = context.readValue(parser, String.class);
          case "headCompanyId" -> headCompanyId = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, String.class));
          case "code" -> code = context.readValue(parser, String.class);
          case "name" -> name = context.readValue(parser, String.class);
          case "notes" -> notes = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, String.class));
          case "extensionValues" -> extensionValues = context.readTree(parser);
          case "operatingRuleSwitches" -> operatingRuleSwitches = context.readValue(parser, OrganizationStoreOperatingRuleValues.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(OrganizationStoreCreateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(OrganizationStoreCreateRequest.class, "object must end with END_OBJECT");
      if (brandId == null) return context.reportInputMismatch(OrganizationStoreCreateRequest.class, "missing required property brandId");
      if (tenantId == null) return context.reportInputMismatch(OrganizationStoreCreateRequest.class, "missing required property tenantId");
      if (code == null) return context.reportInputMismatch(OrganizationStoreCreateRequest.class, "missing required property code");
      if (name == null) return context.reportInputMismatch(OrganizationStoreCreateRequest.class, "missing required property name");
      return new OrganizationStoreCreateRequest(brandId, tenantId, headCompanyId, code, name, notes, extensionValues, operatingRuleSwitches);
    }
  }
}
