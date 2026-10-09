// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = TerminalUpdateRuleStatusRequest.Deserializer.class)
public record TerminalUpdateRuleStatusRequest(
    Long revision,
    String status,
    String reason
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<TerminalUpdateRuleStatusRequest> {
    @Override
    public TerminalUpdateRuleStatusRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (TerminalUpdateRuleStatusRequest) context.handleUnexpectedToken(TerminalUpdateRuleStatusRequest.class, parser);
      Long revision = null;
      String status = null;
      String reason = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(TerminalUpdateRuleStatusRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(TerminalUpdateRuleStatusRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(TerminalUpdateRuleStatusRequest.class, "property value is required");
        switch (property) {
          case "revision" -> revision = context.readValue(parser, Long.class);
          case "status" -> status = context.readValue(parser, String.class);
          case "reason" -> reason = context.readValue(parser, String.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(TerminalUpdateRuleStatusRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(TerminalUpdateRuleStatusRequest.class, "object must end with END_OBJECT");
      if (revision == null) return context.reportInputMismatch(TerminalUpdateRuleStatusRequest.class, "missing required property revision");
      if (status == null) return context.reportInputMismatch(TerminalUpdateRuleStatusRequest.class, "missing required property status");
      return new TerminalUpdateRuleStatusRequest(revision, status, reason);
    }
  }
}
