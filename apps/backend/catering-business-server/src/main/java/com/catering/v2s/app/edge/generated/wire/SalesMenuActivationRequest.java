// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = SalesMenuActivationRequest.Deserializer.class)
public record SalesMenuActivationRequest(
    String status,
    Long expectedVersion
) {

  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<SalesMenuActivationRequest> {
    @Override
    public SalesMenuActivationRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (SalesMenuActivationRequest) context.handleUnexpectedToken(SalesMenuActivationRequest.class, parser);
      String status = null;
      Long expectedVersion = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(SalesMenuActivationRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(SalesMenuActivationRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(SalesMenuActivationRequest.class, "property value is required");
        switch (property) {
          case "status" -> status = context.readValue(parser, String.class);
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(SalesMenuActivationRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(SalesMenuActivationRequest.class, "object must end with END_OBJECT");
      if (status == null) return context.reportInputMismatch(SalesMenuActivationRequest.class, "missing required property status");
      if (expectedVersion == null) return context.reportInputMismatch(SalesMenuActivationRequest.class, "missing required property expectedVersion");
      return new SalesMenuActivationRequest(status, expectedVersion);
    }
  }
}
