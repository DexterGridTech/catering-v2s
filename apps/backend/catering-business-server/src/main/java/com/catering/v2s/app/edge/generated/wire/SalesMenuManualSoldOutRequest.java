// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = SalesMenuManualSoldOutRequest.Deserializer.class)
public record SalesMenuManualSoldOutRequest(
    SalesMenuManualSoldOutRequestTarget target,
    String reason,
    Long expectedVersion
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<SalesMenuManualSoldOutRequest> {
    @Override
    public SalesMenuManualSoldOutRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (SalesMenuManualSoldOutRequest) context.handleUnexpectedToken(SalesMenuManualSoldOutRequest.class, parser);
      SalesMenuManualSoldOutRequestTarget target = null;
      String reason = null;
      Long expectedVersion = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(SalesMenuManualSoldOutRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(SalesMenuManualSoldOutRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(SalesMenuManualSoldOutRequest.class, "property value is required");
        switch (property) {
          case "target" -> target = context.readValue(parser, SalesMenuManualSoldOutRequestTarget.class);
          case "reason" -> reason = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, String.class));
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(SalesMenuManualSoldOutRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(SalesMenuManualSoldOutRequest.class, "object must end with END_OBJECT");
      if (target == null) return context.reportInputMismatch(SalesMenuManualSoldOutRequest.class, "missing required property target");
      if (!seen.contains("reason")) return context.reportInputMismatch(SalesMenuManualSoldOutRequest.class, "missing required property reason");
      if (expectedVersion == null) return context.reportInputMismatch(SalesMenuManualSoldOutRequest.class, "missing required property expectedVersion");
      return new SalesMenuManualSoldOutRequest(target, reason, expectedVersion);
    }
  }
}
