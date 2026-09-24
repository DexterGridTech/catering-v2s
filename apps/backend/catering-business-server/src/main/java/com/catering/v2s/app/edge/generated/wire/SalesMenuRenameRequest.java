// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = SalesMenuRenameRequest.Deserializer.class)
public record SalesMenuRenameRequest(
    String name,
    Long expectedVersion
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<SalesMenuRenameRequest> {
    @Override
    public SalesMenuRenameRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (SalesMenuRenameRequest) context.handleUnexpectedToken(SalesMenuRenameRequest.class, parser);
      String name = null;
      Long expectedVersion = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(SalesMenuRenameRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(SalesMenuRenameRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(SalesMenuRenameRequest.class, "property value is required");
        switch (property) {
          case "name" -> name = context.readValue(parser, String.class);
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(SalesMenuRenameRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(SalesMenuRenameRequest.class, "object must end with END_OBJECT");
      if (name == null) return context.reportInputMismatch(SalesMenuRenameRequest.class, "missing required property name");
      if (expectedVersion == null) return context.reportInputMismatch(SalesMenuRenameRequest.class, "missing required property expectedVersion");
      return new SalesMenuRenameRequest(name, expectedVersion);
    }
  }
}
