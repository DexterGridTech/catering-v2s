// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = OrganizationStoreUpdateRequest.Deserializer.class)
public record OrganizationStoreUpdateRequest(
    String name,
    String headCompanyId,
    String notes,
    tools.jackson.databind.JsonNode extensionValues,
    Long extensionRuleRevision,
    Long expectedVersion,
    OrganizationStoreOperatingRuleValues operatingRuleSwitches
) {

  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<OrganizationStoreUpdateRequest> {
    @Override
    public OrganizationStoreUpdateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (OrganizationStoreUpdateRequest) context.handleUnexpectedToken(OrganizationStoreUpdateRequest.class, parser);
      String name = null;
      String headCompanyId = null;
      String notes = null;
      tools.jackson.databind.JsonNode extensionValues = null;
      Long extensionRuleRevision = null;
      Long expectedVersion = null;
      OrganizationStoreOperatingRuleValues operatingRuleSwitches = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(OrganizationStoreUpdateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(OrganizationStoreUpdateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(OrganizationStoreUpdateRequest.class, "property value is required");
        switch (property) {
          case "name" -> name = context.readValue(parser, String.class);
          case "headCompanyId" -> headCompanyId = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, String.class));
          case "notes" -> notes = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, String.class));
          case "extensionValues" -> extensionValues = context.readTree(parser);
          case "extensionRuleRevision" -> extensionRuleRevision = context.readValue(parser, Long.class);
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          case "operatingRuleSwitches" -> operatingRuleSwitches = context.readValue(parser, OrganizationStoreOperatingRuleValues.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(OrganizationStoreUpdateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(OrganizationStoreUpdateRequest.class, "object must end with END_OBJECT");
      if (name == null) return context.reportInputMismatch(OrganizationStoreUpdateRequest.class, "missing required property name");
      if (extensionValues == null) return context.reportInputMismatch(OrganizationStoreUpdateRequest.class, "missing required property extensionValues");
      if (extensionRuleRevision == null) return context.reportInputMismatch(OrganizationStoreUpdateRequest.class, "missing required property extensionRuleRevision");
      if (expectedVersion == null) return context.reportInputMismatch(OrganizationStoreUpdateRequest.class, "missing required property expectedVersion");
      if (operatingRuleSwitches == null) return context.reportInputMismatch(OrganizationStoreUpdateRequest.class, "missing required property operatingRuleSwitches");
      return new OrganizationStoreUpdateRequest(name, headCompanyId, notes, extensionValues, extensionRuleRevision, expectedVersion, operatingRuleSwitches);
    }
  }
}
