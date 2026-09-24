// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = StoreContractUpdateRequest.Deserializer.class)
public record StoreContractUpdateRequest(
    String phaseName,
    String effectiveFrom,
    String effectiveTo,
    String note,
    tools.jackson.databind.JsonNode extensionValues,
    Long expectedExtensionRuleRevision,
    Long expectedVersion,
    java.util.List<StoreContractItem> items,
    String phaseNameSnapshot
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<StoreContractUpdateRequest> {
    @Override
    public StoreContractUpdateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (StoreContractUpdateRequest) context.handleUnexpectedToken(StoreContractUpdateRequest.class, parser);
      String phaseName = null;
      String effectiveFrom = null;
      String effectiveTo = null;
      String note = null;
      tools.jackson.databind.JsonNode extensionValues = null;
      Long expectedExtensionRuleRevision = null;
      Long expectedVersion = null;
      java.util.List<StoreContractItem> items = null;
      String phaseNameSnapshot = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(StoreContractUpdateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(StoreContractUpdateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(StoreContractUpdateRequest.class, "property value is required");
        switch (property) {
          case "phaseName" -> phaseName = context.readValue(parser, String.class);
          case "effectiveFrom" -> effectiveFrom = context.readValue(parser, String.class);
          case "effectiveTo" -> effectiveTo = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, String.class));
          case "note" -> note = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, String.class));
          case "extensionValues" -> extensionValues = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readTree(parser));
          case "expectedExtensionRuleRevision" -> expectedExtensionRuleRevision = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, Long.class));
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          case "items" -> items = context.readValue(parser, new tools.jackson.core.type.TypeReference<java.util.List<StoreContractItem>>() {});
          case "phaseNameSnapshot" -> phaseNameSnapshot = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, String.class));
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(StoreContractUpdateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(StoreContractUpdateRequest.class, "object must end with END_OBJECT");
      if (phaseName == null) return context.reportInputMismatch(StoreContractUpdateRequest.class, "missing required property phaseName");
      if (effectiveFrom == null) return context.reportInputMismatch(StoreContractUpdateRequest.class, "missing required property effectiveFrom");
      if (!seen.contains("effectiveTo")) return context.reportInputMismatch(StoreContractUpdateRequest.class, "missing required property effectiveTo");
      if (expectedVersion == null) return context.reportInputMismatch(StoreContractUpdateRequest.class, "missing required property expectedVersion");
      if (items == null) return context.reportInputMismatch(StoreContractUpdateRequest.class, "missing required property items");
      return new StoreContractUpdateRequest(phaseName, effectiveFrom, effectiveTo, note, extensionValues, expectedExtensionRuleRevision, expectedVersion, items, phaseNameSnapshot);
    }
  }
}
