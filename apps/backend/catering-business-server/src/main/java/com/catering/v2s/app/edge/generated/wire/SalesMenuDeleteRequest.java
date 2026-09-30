// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = SalesMenuDeleteRequest.Deserializer.class)
public record SalesMenuDeleteRequest(
    Long expectedVersion
) {

  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<SalesMenuDeleteRequest> {
    @Override
    public SalesMenuDeleteRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (SalesMenuDeleteRequest) context.handleUnexpectedToken(SalesMenuDeleteRequest.class, parser);
      Long expectedVersion = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(SalesMenuDeleteRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(SalesMenuDeleteRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(SalesMenuDeleteRequest.class, "property value is required");
        switch (property) {
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(SalesMenuDeleteRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(SalesMenuDeleteRequest.class, "object must end with END_OBJECT");
      if (expectedVersion == null) return context.reportInputMismatch(SalesMenuDeleteRequest.class, "missing required property expectedVersion");
      return new SalesMenuDeleteRequest(expectedVersion);
    }
  }
}
