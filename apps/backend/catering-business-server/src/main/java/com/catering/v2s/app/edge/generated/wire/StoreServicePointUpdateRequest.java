// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = StoreServicePointUpdateRequest.Deserializer.class)
public record StoreServicePointUpdateRequest(
    String name,
    String code,
    StoreServicePointType pointType,
    StoreServicePointStatus status,
    tools.jackson.databind.JsonNode seatCapacity,
    tools.jackson.databind.JsonNode tableShape,
    tools.jackson.databind.JsonNode reservable,
    java.util.UUID imageAssetRef,
    tools.jackson.databind.JsonNode imageBindGrant,
    tools.jackson.databind.JsonNode extensionValues,
    tools.jackson.databind.JsonNode extensionRuleRevision,
    Long expectedVersion
) {
  @Override
  public String toString() {
    return "StoreServicePointUpdateRequest["
        + "name=" + name
        + ", code=" + code
        + ", pointType=" + pointType
        + ", status=" + status
        + ", seatCapacity=" + seatCapacity
        + ", tableShape=" + tableShape
        + ", reservable=" + reservable
        + ", imageAssetRef=" + imageAssetRef
        + ", redacted=" + "[REDACTED]"
        + ", extensionValues=" + extensionValues
        + ", extensionRuleRevision=" + extensionRuleRevision
        + ", expectedVersion=" + expectedVersion
        + "]";
  }


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<StoreServicePointUpdateRequest> {
    @Override
    public StoreServicePointUpdateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (StoreServicePointUpdateRequest) context.handleUnexpectedToken(StoreServicePointUpdateRequest.class, parser);
      String name = null;
      String code = null;
      StoreServicePointType pointType = null;
      StoreServicePointStatus status = null;
      tools.jackson.databind.JsonNode seatCapacity = null;
      tools.jackson.databind.JsonNode tableShape = null;
      tools.jackson.databind.JsonNode reservable = null;
      java.util.UUID imageAssetRef = null;
      tools.jackson.databind.JsonNode imageBindGrant = null;
      tools.jackson.databind.JsonNode extensionValues = null;
      tools.jackson.databind.JsonNode extensionRuleRevision = null;
      Long expectedVersion = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(StoreServicePointUpdateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(StoreServicePointUpdateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(StoreServicePointUpdateRequest.class, "property value is required");
        switch (property) {
          case "name" -> name = context.readValue(parser, String.class);
          case "code" -> code = context.readValue(parser, String.class);
          case "pointType" -> pointType = context.readValue(parser, StoreServicePointType.class);
          case "status" -> status = context.readValue(parser, StoreServicePointStatus.class);
          case "seatCapacity" -> seatCapacity = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readTree(parser));
          case "tableShape" -> tableShape = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readTree(parser));
          case "reservable" -> reservable = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readTree(parser));
          case "imageAssetRef" -> imageAssetRef = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, java.util.UUID.class));
          case "imageBindGrant" -> imageBindGrant = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readTree(parser));
          case "extensionValues" -> extensionValues = context.readTree(parser);
          case "extensionRuleRevision" -> extensionRuleRevision = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readTree(parser));
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(StoreServicePointUpdateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(StoreServicePointUpdateRequest.class, "object must end with END_OBJECT");
      if (name == null) return context.reportInputMismatch(StoreServicePointUpdateRequest.class, "missing required property name");
      if (code == null) return context.reportInputMismatch(StoreServicePointUpdateRequest.class, "missing required property code");
      if (pointType == null) return context.reportInputMismatch(StoreServicePointUpdateRequest.class, "missing required property pointType");
      if (status == null) return context.reportInputMismatch(StoreServicePointUpdateRequest.class, "missing required property status");
      if (extensionValues == null) return context.reportInputMismatch(StoreServicePointUpdateRequest.class, "missing required property extensionValues");
      if (expectedVersion == null) return context.reportInputMismatch(StoreServicePointUpdateRequest.class, "missing required property expectedVersion");
      return new StoreServicePointUpdateRequest(name, code, pointType, status, seatCapacity, tableShape, reservable, imageAssetRef, imageBindGrant, extensionValues, extensionRuleRevision, expectedVersion);
    }
  }
}
