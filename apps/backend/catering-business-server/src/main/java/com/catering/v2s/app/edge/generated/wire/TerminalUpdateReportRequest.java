// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = TerminalUpdateReportRequest.Deserializer.class)
public record TerminalUpdateReportRequest(
    java.util.UUID reportId,
    Long reportSequence,
    java.util.UUID taskId,
    TerminalUpdateReportActual actual,
    TerminalUpdateReportRecent recent
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<TerminalUpdateReportRequest> {
    @Override
    public TerminalUpdateReportRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (TerminalUpdateReportRequest) context.handleUnexpectedToken(TerminalUpdateReportRequest.class, parser);
      java.util.UUID reportId = null;
      Long reportSequence = null;
      java.util.UUID taskId = null;
      TerminalUpdateReportActual actual = null;
      TerminalUpdateReportRecent recent = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(TerminalUpdateReportRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(TerminalUpdateReportRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(TerminalUpdateReportRequest.class, "property value is required");
        switch (property) {
          case "reportId" -> reportId = context.readValue(parser, java.util.UUID.class);
          case "reportSequence" -> reportSequence = context.readValue(parser, Long.class);
          case "taskId" -> taskId = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, java.util.UUID.class));
          case "actual" -> actual = context.readValue(parser, TerminalUpdateReportActual.class);
          case "recent" -> recent = context.readValue(parser, TerminalUpdateReportRecent.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(TerminalUpdateReportRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(TerminalUpdateReportRequest.class, "object must end with END_OBJECT");
      if (reportId == null) return context.reportInputMismatch(TerminalUpdateReportRequest.class, "missing required property reportId");
      if (reportSequence == null) return context.reportInputMismatch(TerminalUpdateReportRequest.class, "missing required property reportSequence");
      if (!seen.contains("taskId")) return context.reportInputMismatch(TerminalUpdateReportRequest.class, "missing required property taskId");
      if (actual == null) return context.reportInputMismatch(TerminalUpdateReportRequest.class, "missing required property actual");
      if (recent == null) return context.reportInputMismatch(TerminalUpdateReportRequest.class, "missing required property recent");
      return new TerminalUpdateReportRequest(reportId, reportSequence, taskId, actual, recent);
    }
  }
}
