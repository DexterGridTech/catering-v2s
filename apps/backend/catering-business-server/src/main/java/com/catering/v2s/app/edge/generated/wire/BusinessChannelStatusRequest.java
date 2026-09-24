// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = BusinessChannelStatusRequest.Deserializer.class)
public record BusinessChannelStatusRequest(
    String status,
    Long expectedVersion
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<BusinessChannelStatusRequest> {
    @Override
    public BusinessChannelStatusRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (BusinessChannelStatusRequest) context.handleUnexpectedToken(BusinessChannelStatusRequest.class, parser);
      String status = null;
      Long expectedVersion = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(BusinessChannelStatusRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(BusinessChannelStatusRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(BusinessChannelStatusRequest.class, "property value is required");
        switch (property) {
          case "status" -> status = context.readValue(parser, String.class);
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(BusinessChannelStatusRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(BusinessChannelStatusRequest.class, "object must end with END_OBJECT");
      if (status == null) return context.reportInputMismatch(BusinessChannelStatusRequest.class, "missing required property status");
      if (expectedVersion == null) return context.reportInputMismatch(BusinessChannelStatusRequest.class, "missing required property expectedVersion");
      return new BusinessChannelStatusRequest(status, expectedVersion);
    }
  }
}
