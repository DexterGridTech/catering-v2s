// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = CommercialGroupUpdateRequest.Deserializer.class)
public record CommercialGroupUpdateRequest(
    String groupCode,
    String groupName,
    tools.jackson.databind.JsonNode extensionValues,
    Long expectedVersion
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<CommercialGroupUpdateRequest> {
    @Override
    public CommercialGroupUpdateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (CommercialGroupUpdateRequest) context.handleUnexpectedToken(CommercialGroupUpdateRequest.class, parser);
      String groupCode = null;
      String groupName = null;
      tools.jackson.databind.JsonNode extensionValues = null;
      Long expectedVersion = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(CommercialGroupUpdateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(CommercialGroupUpdateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(CommercialGroupUpdateRequest.class, "property value is required");
        switch (property) {
          case "groupCode" -> groupCode = context.readValue(parser, String.class);
          case "groupName" -> groupName = context.readValue(parser, String.class);
          case "extensionValues" -> extensionValues = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readTree(parser));
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(CommercialGroupUpdateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(CommercialGroupUpdateRequest.class, "object must end with END_OBJECT");
      if (groupCode == null) return context.reportInputMismatch(CommercialGroupUpdateRequest.class, "missing required property groupCode");
      if (groupName == null) return context.reportInputMismatch(CommercialGroupUpdateRequest.class, "missing required property groupName");
      if (expectedVersion == null) return context.reportInputMismatch(CommercialGroupUpdateRequest.class, "missing required property expectedVersion");
      return new CommercialGroupUpdateRequest(groupCode, groupName, extensionValues, expectedVersion);
    }
  }
}
