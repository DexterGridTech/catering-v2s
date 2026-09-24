// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = OwnerBindingDeleteRequest.Deserializer.class)
public record OwnerBindingDeleteRequest(
    Long expectedVersion
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<OwnerBindingDeleteRequest> {
    @Override
    public OwnerBindingDeleteRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (OwnerBindingDeleteRequest) context.handleUnexpectedToken(OwnerBindingDeleteRequest.class, parser);
      Long expectedVersion = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(OwnerBindingDeleteRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(OwnerBindingDeleteRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(OwnerBindingDeleteRequest.class, "property value is required");
        switch (property) {
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(OwnerBindingDeleteRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(OwnerBindingDeleteRequest.class, "object must end with END_OBJECT");
      if (expectedVersion == null) return context.reportInputMismatch(OwnerBindingDeleteRequest.class, "missing required property expectedVersion");
      return new OwnerBindingDeleteRequest(expectedVersion);
    }
  }
}
