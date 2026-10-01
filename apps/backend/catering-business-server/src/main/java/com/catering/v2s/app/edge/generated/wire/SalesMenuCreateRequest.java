// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = SalesMenuCreateRequest.Deserializer.class)
public record SalesMenuCreateRequest(
    java.util.UUID channelRef,
    String name
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<SalesMenuCreateRequest> {
    @Override
    public SalesMenuCreateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (SalesMenuCreateRequest) context.handleUnexpectedToken(SalesMenuCreateRequest.class, parser);
      java.util.UUID channelRef = null;
      String name = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(SalesMenuCreateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(SalesMenuCreateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(SalesMenuCreateRequest.class, "property value is required");
        switch (property) {
          case "channelRef" -> channelRef = context.readValue(parser, java.util.UUID.class);
          case "name" -> name = context.readValue(parser, String.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(SalesMenuCreateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(SalesMenuCreateRequest.class, "object must end with END_OBJECT");
      if (channelRef == null) return context.reportInputMismatch(SalesMenuCreateRequest.class, "missing required property channelRef");
      if (name == null) return context.reportInputMismatch(SalesMenuCreateRequest.class, "missing required property name");
      return new SalesMenuCreateRequest(channelRef, name);
    }
  }
}
