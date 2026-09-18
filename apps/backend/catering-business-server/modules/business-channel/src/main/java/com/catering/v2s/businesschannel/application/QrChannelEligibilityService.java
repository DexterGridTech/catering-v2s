package com.catering.v2s.businesschannel.application;

import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import com.catering.v2s.organization.api.QrChannelEligibilityLookup;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Business-channel owner projection used by the store QR configuration and QR generation readback. */
@Service
public final class QrChannelEligibilityService implements QrChannelEligibilityLookup {
    private static final int MAX_CANDIDATES = 100;
    private static final String GROUP_WORKSPACE_QUERY =
            "SELECT c.channel_ref, c.template_ref, c.channel_code, c.channel_name, c.status AS channel_status, "
                    + "c.binding_ref, t.template_name, t.status AS template_status, t.url_rule, "
                    + "t.access_kind, t.operator_kind, t.order_kind, t.dine_in_form "
                    + "FROM business_channel.business_channel c "
                    + "JOIN business_channel.business_channel_template t "
                    + "  ON t.template_ref=c.template_ref "
                    + " AND t.workspace_uuid=c.workspace_uuid "
                    + " AND t.group_workspace_key=c.group_workspace_key "
                    + "WHERE c.workspace_uuid=? AND c.group_workspace_key=? "
                    + "  AND c.target_node_type='STORE' AND c.target_node_ref=? ";
    private final JdbcTemplate jdbc;

    public QrChannelEligibilityService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<Candidate> listCandidates(UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef) {
        List<CandidateRow> rows = jdbc.query(
                GROUP_WORKSPACE_QUERY
                        + "  AND t.access_kind='INTERNAL' AND t.operator_kind='STORE' "
                        + "  AND t.order_kind='DINE_IN' AND t.dine_in_form='QR' "
                        + "  AND c.status='ENABLED' AND t.status='ENABLED' "
                        + "ORDER BY c.channel_name, c.channel_ref LIMIT ?",
                QrChannelEligibilityService::row,
                workspaceUuid,
                groupWorkspaceKey,
                storeRef.toString(),
                MAX_CANDIDATES + 1);
        if (rows.size() > MAX_CANDIDATES) {
            throw new BusinessChannelCommandApi.Problem(
                    "QR_CHANNEL_CANDIDATE_OVERFLOW", 422, "二维码渠道候选超过系统支持的数量上限");
        }
        return rows.stream().map(QrChannelEligibilityService::candidate).toList();
    }

    @Override
    public Candidate read(UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef, UUID channelRef) {
        if (channelRef == null) return null;
        List<CandidateRow> rows = jdbc.query(
                GROUP_WORKSPACE_QUERY + "  AND c.channel_ref=?",
                QrChannelEligibilityService::row,
                workspaceUuid,
                groupWorkspaceKey,
                storeRef.toString(),
                channelRef);
        return rows.isEmpty() ? null : candidate(rows.getFirst());
    }

    @Override
    public Candidate requireEligible(UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef, UUID channelRef) {
        Candidate candidate = read(workspaceUuid, groupWorkspaceKey, storeRef, channelRef);
        if (candidate == null
                || !"INTERNAL".equals(candidate.accessKind())
                || !"STORE".equals(candidate.operatorKind())
                || !"DINE_IN".equals(candidate.orderKind())
                || !"QR".equals(candidate.dineInForm())
                || !"ENABLED".equals(candidate.status())
                || !"ENABLED".equals(candidate.templateStatus())
                || !"NOT_REQUIRED".equals(candidate.bindingStatus())) {
            throw new BusinessChannelCommandApi.Problem(
                    "QR_CHANNEL_INELIGIBLE", 422, "所选门店渠道不满足二维码下单条件");
        }
        return candidate;
    }

    @Override
    public String deriveUrl(
            Candidate candidate, String groupWorkspaceKey, UUID servicePointRef) {
        return candidate == null ? null : appendParameters(candidate.urlRule(), groupWorkspaceKey, servicePointRef);
    }

    private static Candidate candidate(CandidateRow row) {
        return new Candidate(
                row.channelRef,
                row.templateRef,
                row.channelCode,
                row.channelName,
                row.templateName,
                row.channelStatus,
                "INTERNAL".equals(row.accessKind)
                        ? "NOT_REQUIRED"
                        : row.bindingRef == null ? "UNBOUND" : "BOUND",
                row.urlRule,
                row.templateStatus,
                row.accessKind,
                row.operatorKind,
                row.orderKind,
                row.dineInForm);
    }

    private static CandidateRow row(ResultSet result, int ignored) throws SQLException {
        return new CandidateRow(
                result.getObject("channel_ref", UUID.class),
                result.getObject("template_ref", UUID.class),
                result.getString("channel_code"),
                result.getString("channel_name"),
                result.getString("template_name"),
                result.getString("channel_status"),
                result.getObject("binding_ref", UUID.class),
                result.getString("template_status"),
                result.getString("url_rule"),
                result.getString("access_kind"),
                result.getString("operator_kind"),
                result.getString("order_kind"),
                result.getString("dine_in_form"));
    }

    /** One URL parser/serializer for both validity and derived QR URL construction. */
    static String appendParameters(String rawUrl, String groupWorkspaceKey, UUID servicePointRef) {
        if (rawUrl == null || rawUrl.isBlank() || groupWorkspaceKey == null || servicePointRef == null) return null;
        String url = rawUrl.trim();
        try {
            URI parsed = new URI(url);
            if (parsed.getScheme() == null
                    || !("http".equalsIgnoreCase(parsed.getScheme()) || "https".equalsIgnoreCase(parsed.getScheme()))
                    || parsed.getHost() == null
                    || containsWhitespace(url)) return null;
            String base = url;
            String fragment = "";
            int fragmentIndex = base.indexOf('#');
            if (fragmentIndex >= 0) {
                fragment = base.substring(fragmentIndex);
                base = base.substring(0, fragmentIndex);
            }
            int queryIndex = base.indexOf('?');
            String path = queryIndex < 0 ? base : base.substring(0, queryIndex);
            String query = queryIndex < 0 ? "" : base.substring(queryIndex + 1);
            List<String> retained = new ArrayList<>();
            if (!query.isEmpty()) {
                for (String part : query.split("&", -1)) {
                    if (part.isEmpty()) continue;
                    String name = part;
                    int equals = part.indexOf('=');
                    if (equals >= 0) name = part.substring(0, equals);
                    String decoded = java.net.URLDecoder.decode(name, StandardCharsets.UTF_8);
                    if (!"groupWorkspaceKey".equals(decoded) && !"servicePointRef".equals(decoded)) retained.add(part);
                }
            }
            retained.add(encoded("groupWorkspaceKey") + "=" + encoded(groupWorkspaceKey));
            retained.add(encoded("servicePointRef") + "=" + encoded(servicePointRef.toString()));
            return path + "?" + String.join("&", retained) + fragment;
        } catch (URISyntaxException | IllegalArgumentException invalid) {
            return null;
        }
    }

    private static String encoded(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private static boolean containsWhitespace(String value) {
        return value.chars().anyMatch(Character::isWhitespace);
    }

    private record CandidateRow(
            UUID channelRef,
            UUID templateRef,
            String channelCode,
            String channelName,
            String templateName,
            String channelStatus,
            UUID bindingRef,
            String templateStatus,
            String urlRule,
            String accessKind,
            String operatorKind,
            String orderKind,
            String dineInForm) {}
}
