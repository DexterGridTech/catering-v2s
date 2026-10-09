// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = TerminalUpdateReportRecent.Deserializer.class)
public record TerminalUpdateReportRecent(
    String state,
    String reason,
    Long changedAtEpochMillis,
    java.util.UUID ruleRef,
    java.util.UUID fullArtifactRef,
    java.util.UUID hotArtifactRef
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<TerminalUpdateReportRecent> {
    @Override
    public TerminalUpdateReportRecent deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (TerminalUpdateReportRecent) context.handleUnexpectedToken(TerminalUpdateReportRecent.class, parser);
      String state = null;
      String reason = null;
      Long changedAtEpochMillis = null;
      java.util.UUID ruleRef = null;
      java.util.UUID fullArtifactRef = null;
      java.util.UUID hotArtifactRef = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(TerminalUpdateReportRecent.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(TerminalUpdateReportRecent.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(TerminalUpdateReportRecent.class, "property value is required");
        switch (property) {
          case "state" -> state = context.readValue(parser, String.class);
          case "reason" -> reason = context.readValue(parser, String.class);
          case "changedAtEpochMillis" -> changedAtEpochMillis = context.readValue(parser, Long.class);
          case "ruleRef" -> ruleRef = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, java.util.UUID.class));
          case "fullArtifactRef" -> fullArtifactRef = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, java.util.UUID.class));
          case "hotArtifactRef" -> hotArtifactRef = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, java.util.UUID.class));
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(TerminalUpdateReportRecent.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(TerminalUpdateReportRecent.class, "object must end with END_OBJECT");
      if (state == null) return context.reportInputMismatch(TerminalUpdateReportRecent.class, "missing required property state");
      if (reason == null) return context.reportInputMismatch(TerminalUpdateReportRecent.class, "missing required property reason");
      if (changedAtEpochMillis == null) return context.reportInputMismatch(TerminalUpdateReportRecent.class, "missing required property changedAtEpochMillis");
      if (!seen.contains("ruleRef")) return context.reportInputMismatch(TerminalUpdateReportRecent.class, "missing required property ruleRef");
      if (!seen.contains("fullArtifactRef")) return context.reportInputMismatch(TerminalUpdateReportRecent.class, "missing required property fullArtifactRef");
      if (!seen.contains("hotArtifactRef")) return context.reportInputMismatch(TerminalUpdateReportRecent.class, "missing required property hotArtifactRef");
      return new TerminalUpdateReportRecent(state, reason, changedAtEpochMillis, ruleRef, fullArtifactRef, hotArtifactRef);
    }
  }
}
