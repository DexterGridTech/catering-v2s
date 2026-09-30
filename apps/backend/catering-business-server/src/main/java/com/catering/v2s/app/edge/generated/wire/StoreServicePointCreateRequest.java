// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = StoreServicePointCreateRequest.Deserializer.class)
public record StoreServicePointCreateRequest(
    String name,
    String code,
    StoreServicePointType pointType,
    tools.jackson.databind.JsonNode seatCapacity,
    tools.jackson.databind.JsonNode tableShape,
    tools.jackson.databind.JsonNode reservable,
    java.util.UUID imageAssetRef,
    tools.jackson.databind.JsonNode imageBindGrant,
    tools.jackson.databind.JsonNode extensionValues,
    tools.jackson.databind.JsonNode extensionRuleRevision
) {
  @Override
  public String toString() {
    return "StoreServicePointCreateRequest["
        + "name=" + name
        + ", code=" + code
        + ", pointType=" + pointType
        + ", seatCapacity=" + seatCapacity
        + ", tableShape=" + tableShape
        + ", reservable=" + reservable
        + ", imageAssetRef=" + imageAssetRef
        + ", redacted=" + "[REDACTED]"
        + ", extensionValues=" + extensionValues
        + ", extensionRuleRevision=" + extensionRuleRevision
        + "]";
  }


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<StoreServicePointCreateRequest> {
    @Override
    public StoreServicePointCreateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (StoreServicePointCreateRequest) context.handleUnexpectedToken(StoreServicePointCreateRequest.class, parser);
      String name = null;
      String code = null;
      StoreServicePointType pointType = null;
      tools.jackson.databind.JsonNode seatCapacity = null;
      tools.jackson.databind.JsonNode tableShape = null;
      tools.jackson.databind.JsonNode reservable = null;
      java.util.UUID imageAssetRef = null;
      tools.jackson.databind.JsonNode imageBindGrant = null;
      tools.jackson.databind.JsonNode extensionValues = null;
      tools.jackson.databind.JsonNode extensionRuleRevision = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(StoreServicePointCreateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(StoreServicePointCreateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(StoreServicePointCreateRequest.class, "property value is required");
        switch (property) {
          case "name" -> name = context.readValue(parser, String.class);
          case "code" -> code = context.readValue(parser, String.class);
          case "pointType" -> pointType = context.readValue(parser, StoreServicePointType.class);
          case "seatCapacity" -> seatCapacity = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readTree(parser));
          case "tableShape" -> tableShape = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readTree(parser));
          case "reservable" -> reservable = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readTree(parser));
          case "imageAssetRef" -> imageAssetRef = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, java.util.UUID.class));
          case "imageBindGrant" -> imageBindGrant = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readTree(parser));
          case "extensionValues" -> extensionValues = context.readTree(parser);
          case "extensionRuleRevision" -> extensionRuleRevision = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readTree(parser));
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(StoreServicePointCreateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(StoreServicePointCreateRequest.class, "object must end with END_OBJECT");
      if (name == null) return context.reportInputMismatch(StoreServicePointCreateRequest.class, "missing required property name");
      if (code == null) return context.reportInputMismatch(StoreServicePointCreateRequest.class, "missing required property code");
      if (pointType == null) return context.reportInputMismatch(StoreServicePointCreateRequest.class, "missing required property pointType");
      if (extensionValues == null) return context.reportInputMismatch(StoreServicePointCreateRequest.class, "missing required property extensionValues");
      return new StoreServicePointCreateRequest(name, code, pointType, seatCapacity, tableShape, reservable, imageAssetRef, imageBindGrant, extensionValues, extensionRuleRevision);
    }
  }
}
