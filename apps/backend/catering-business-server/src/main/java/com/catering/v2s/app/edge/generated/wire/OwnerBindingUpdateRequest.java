// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = OwnerBindingUpdateRequest.Deserializer.class)
public record OwnerBindingUpdateRequest(
    tools.jackson.databind.JsonNode bindingDisplayName,
    tools.jackson.databind.JsonNode externalOwnerId,
    Long expectedVersion
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<OwnerBindingUpdateRequest> {
    @Override
    public OwnerBindingUpdateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (OwnerBindingUpdateRequest) context.handleUnexpectedToken(OwnerBindingUpdateRequest.class, parser);
      tools.jackson.databind.JsonNode bindingDisplayName = null;
      tools.jackson.databind.JsonNode externalOwnerId = null;
      Long expectedVersion = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(OwnerBindingUpdateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(OwnerBindingUpdateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(OwnerBindingUpdateRequest.class, "property value is required");
        switch (property) {
          case "bindingDisplayName" -> bindingDisplayName = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readTree(parser));
          case "externalOwnerId" -> externalOwnerId = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readTree(parser));
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(OwnerBindingUpdateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(OwnerBindingUpdateRequest.class, "object must end with END_OBJECT");
      if (!seen.contains("bindingDisplayName")) return context.reportInputMismatch(OwnerBindingUpdateRequest.class, "missing required property bindingDisplayName");
      if (expectedVersion == null) return context.reportInputMismatch(OwnerBindingUpdateRequest.class, "missing required property expectedVersion");
      return new OwnerBindingUpdateRequest(bindingDisplayName, externalOwnerId, expectedVersion);
    }
  }
}
