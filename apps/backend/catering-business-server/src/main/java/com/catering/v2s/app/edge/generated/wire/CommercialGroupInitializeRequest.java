// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = CommercialGroupInitializeRequest.Deserializer.class)
public record CommercialGroupInitializeRequest(
    String groupCode,
    String groupName,
    String idempotencyKey,
    tools.jackson.databind.JsonNode extensionValues
) {

  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<CommercialGroupInitializeRequest> {
    @Override
    public CommercialGroupInitializeRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (CommercialGroupInitializeRequest) context.handleUnexpectedToken(CommercialGroupInitializeRequest.class, parser);
      String groupCode = null;
      String groupName = null;
      String idempotencyKey = null;
      tools.jackson.databind.JsonNode extensionValues = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(CommercialGroupInitializeRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(CommercialGroupInitializeRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(CommercialGroupInitializeRequest.class, "property value is required");
        switch (property) {
          case "groupCode" -> groupCode = context.readValue(parser, String.class);
          case "groupName" -> groupName = context.readValue(parser, String.class);
          case "idempotencyKey" -> idempotencyKey = context.readValue(parser, String.class);
          case "extensionValues" -> extensionValues = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readTree(parser));
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(CommercialGroupInitializeRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(CommercialGroupInitializeRequest.class, "object must end with END_OBJECT");
      if (groupCode == null) return context.reportInputMismatch(CommercialGroupInitializeRequest.class, "missing required property groupCode");
      if (groupName == null) return context.reportInputMismatch(CommercialGroupInitializeRequest.class, "missing required property groupName");
      if (idempotencyKey == null) return context.reportInputMismatch(CommercialGroupInitializeRequest.class, "missing required property idempotencyKey");
      return new CommercialGroupInitializeRequest(groupCode, groupName, idempotencyKey, extensionValues);
    }
  }
}
