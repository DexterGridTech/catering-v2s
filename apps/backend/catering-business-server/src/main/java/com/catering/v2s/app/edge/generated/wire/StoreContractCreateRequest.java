// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = StoreContractCreateRequest.Deserializer.class)
public record StoreContractCreateRequest(
    String storeId,
    String phaseName,
    String contractNo,
    String effectiveFrom,
    String effectiveTo,
    String note,
    tools.jackson.databind.JsonNode extensionValues,
    Long expectedExtensionRuleRevision,
    java.util.List<StoreContractItem> items,
    String phaseNameSnapshot
) {

  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<StoreContractCreateRequest> {
    @Override
    public StoreContractCreateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (StoreContractCreateRequest) context.handleUnexpectedToken(StoreContractCreateRequest.class, parser);
      String storeId = null;
      String phaseName = null;
      String contractNo = null;
      String effectiveFrom = null;
      String effectiveTo = null;
      String note = null;
      tools.jackson.databind.JsonNode extensionValues = null;
      Long expectedExtensionRuleRevision = null;
      java.util.List<StoreContractItem> items = null;
      String phaseNameSnapshot = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(StoreContractCreateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(StoreContractCreateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(StoreContractCreateRequest.class, "property value is required");
        switch (property) {
          case "storeId" -> storeId = context.readValue(parser, String.class);
          case "phaseName" -> phaseName = context.readValue(parser, String.class);
          case "contractNo" -> contractNo = context.readValue(parser, String.class);
          case "effectiveFrom" -> effectiveFrom = context.readValue(parser, String.class);
          case "effectiveTo" -> effectiveTo = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, String.class));
          case "note" -> note = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, String.class));
          case "extensionValues" -> extensionValues = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readTree(parser));
          case "expectedExtensionRuleRevision" -> expectedExtensionRuleRevision = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, Long.class));
          case "items" -> items = context.readValue(parser, new tools.jackson.core.type.TypeReference<java.util.List<StoreContractItem>>() {});
          case "phaseNameSnapshot" -> phaseNameSnapshot = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, String.class));
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(StoreContractCreateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(StoreContractCreateRequest.class, "object must end with END_OBJECT");
      if (storeId == null) return context.reportInputMismatch(StoreContractCreateRequest.class, "missing required property storeId");
      if (phaseName == null) return context.reportInputMismatch(StoreContractCreateRequest.class, "missing required property phaseName");
      if (contractNo == null) return context.reportInputMismatch(StoreContractCreateRequest.class, "missing required property contractNo");
      if (effectiveFrom == null) return context.reportInputMismatch(StoreContractCreateRequest.class, "missing required property effectiveFrom");
      if (!seen.contains("effectiveTo")) return context.reportInputMismatch(StoreContractCreateRequest.class, "missing required property effectiveTo");
      if (items == null) return context.reportInputMismatch(StoreContractCreateRequest.class, "missing required property items");
      return new StoreContractCreateRequest(storeId, phaseName, contractNo, effectiveFrom, effectiveTo, note, extensionValues, expectedExtensionRuleRevision, items, phaseNameSnapshot);
    }
  }
}
