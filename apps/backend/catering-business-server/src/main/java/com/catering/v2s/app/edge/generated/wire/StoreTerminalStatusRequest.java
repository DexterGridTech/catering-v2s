// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = StoreTerminalStatusRequest.Deserializer.class)
public record StoreTerminalStatusRequest(
    StoreTerminalStatus status,
    Long expectedVersion
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<StoreTerminalStatusRequest> {
    @Override
    public StoreTerminalStatusRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (StoreTerminalStatusRequest) context.handleUnexpectedToken(StoreTerminalStatusRequest.class, parser);
      StoreTerminalStatus status = null;
      Long expectedVersion = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(StoreTerminalStatusRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(StoreTerminalStatusRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(StoreTerminalStatusRequest.class, "property value is required");
        switch (property) {
          case "status" -> status = context.readValue(parser, StoreTerminalStatus.class);
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(StoreTerminalStatusRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(StoreTerminalStatusRequest.class, "object must end with END_OBJECT");
      if (status == null) return context.reportInputMismatch(StoreTerminalStatusRequest.class, "missing required property status");
      if (expectedVersion == null) return context.reportInputMismatch(StoreTerminalStatusRequest.class, "missing required property expectedVersion");
      return new StoreTerminalStatusRequest(status, expectedVersion);
    }
  }
}
